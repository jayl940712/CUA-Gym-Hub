import { secureMockApiPlugin } from '../../shared/secureMockApiPlugin.mjs';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { createHash } from 'crypto'
import { TextDecoder } from 'util'
// createInitialData comes from ./src/utils/initialState.js, NOT dataManager.js.
// dataManager imports 2.9 MB of static git data for its accessors and this
// module is evaluated in the node process that answers every /go; initialState
// imports only overlayShape.js and one 382-byte JSON file.
import { createInitialData } from './src/utils/initialState.js'
import { computeStateDiff } from './src/utils/stateTracker.js'

const STATE_DIR = path.join(process.cwd(), '.mock-states')
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true })

const FILES_DIR = path.join(process.cwd(), '.mock-files')
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true })

const SID_RE = /^[a-zA-Z0-9_-]{1,128}$/
const MAX_BODY_BYTES = 64 * 1024 * 1024
const MAX_UPLOAD_BYTES = 64 * 1024 * 1024
const mutationQueues = new Map()
let tempCounter = 0

class HttpError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}

function validateSid(sid) {
  if (sid === null || sid === undefined || sid === '') return null
  if (!SID_RE.test(sid)) {
    throw new HttpError(400, 'Invalid sid: use 1-128 letters, numbers, underscores, or hyphens.')
  }
  return sid
}

function getStateFile(sid) {
  if (!sid) return path.join(process.cwd(), '.mock-state.json')
  return path.join(STATE_DIR, `${sid}.json`)
}

function getInitialStateFile(sid) {
  if (!sid) return path.join(process.cwd(), '.mock-state.initial.json')
  return path.join(STATE_DIR, `${sid}.initial.json`)
}

function readJsonFile(file) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch (e) {
    console.error(`Error reading ${file}:`, e)
    throw new HttpError(500, 'Stored state could not be read.')
  }
  return null
}

function readState(sid) {
  return readJsonFile(getStateFile(sid))
}

// State files are written COMPACT, not pretty-printed. The seed is ~2.1 MB of
// JSON and 2-space indentation added ~750 KB of pure whitespace to it — paid on
// every /post write and again on every /go, which reads and re-parses BOTH the
// current and the initial file. Nothing consumes these files by eye; /go and
// /state serve them as JSON.
function atomicWrite(file, data) {
  const temp = path.join(path.dirname(file), `.tmp-${process.pid}-${Date.now()}-${tempCounter++}`)
  try {
    fs.writeFileSync(temp, data, { encoding: 'utf8', flag: 'wx' })
    fs.renameSync(temp, file)
  } catch (e) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp) } catch (_) {}
    console.error(`Error writing ${file}:`, e)
    throw new HttpError(500, 'State could not be written.')
  }
}

function atomicWriteBuffer(file, data) {
  const temp = path.join(path.dirname(file), `.tmp-${process.pid}-${Date.now()}-${tempCounter++}`)
  try {
    fs.writeFileSync(temp, data, { flag: 'wx' })
    fs.renameSync(temp, file)
  } catch (e) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp) } catch (_) {}
    console.error(`Error writing ${file}:`, e)
    throw new HttpError(500, 'File could not be written.')
  }
}

function writeState(sid, state) {
  atomicWrite(getStateFile(sid), JSON.stringify(state))
}

function writeInitialState(sid, state) {
  atomicWrite(getInitialStateFile(sid), JSON.stringify(state))
}

function readInitialState(sid) {
  return readJsonFile(getInitialStateFile(sid))
}

function clearState(sid) {
  try {
    const file = getStateFile(sid)
    if (fs.existsSync(file)) fs.unlinkSync(file)
    const initFile = getInitialStateFile(sid)
    if (fs.existsSync(initFile)) fs.unlinkSync(initFile)
  } catch (e) {
    console.error('Error clearing state:', e)
    throw new HttpError(500, 'State could not be cleared.')
  }
}

function parseQuery(url) {
  try {
    return Object.fromEntries(new URL(url || '/', 'http://localhost').searchParams)
  } catch (_) {
    throw new HttpError(400, 'Malformed query string.')
  }
}

function requestSid(req) {
  const query = parseQuery(req.url || '')
  const supplied = Object.prototype.hasOwnProperty.call(query, 'sid')
  const sid = query.sid
  if (supplied && !sid) throw new HttpError(400, 'Invalid sid: value must not be empty.')
  if (sid === '_default') throw new HttpError(400, 'Invalid sid: _default is reserved.')
  return validateSid(sid)
}

function sendError(res, error) {
  const statusCode = error instanceof HttpError ? error.statusCode : 500
  if (!(error instanceof HttpError)) console.error('Unexpected mock API error:', error)
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify({ error: error.message || 'Internal server error.' }))
}

function enqueueMutation(sid, task) {
  const key = sid || '_default'
  const previous = mutationQueues.get(key) || Promise.resolve()
  const current = previous.catch(() => {}).then(task)
  mutationQueues.set(key, current)
  return current.finally(() => {
    if (mutationQueues.get(key) === current) mutationQueues.delete(key)
  })
}

function equalState(a, b) {
  const canonical = value => JSON.stringify(value, (_key, item) =>
    (item && typeof item === 'object' && !Array.isArray(item))
      ? Object.keys(item).sort().reduce((out, key) => {
          out[key] = item[key]
          return out
        }, {})
      : item)
  return canonical(a) === canonical(b)
}

function requireState(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `${label} must be a JSON object.`)
  }
  return value
}

function deepMerge(target, source) {
  const result = { ...target }
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

// Delegates to src/utils/stateTracker.js so /go emits per-record
// added/removed/changed sets instead of dumping whole 600-row arrays.
function calculateStateDiff(initial, current) {
  return computeStateDiff(initial, current)
}

// ---------------------------------------------------------------------------
// Transport compression (PARITY-008 / PIPELINE-005).
//
// The state is ~2.2 MB of JSON, so /go ships ~4.5 MB (initial + current) on
// EVERY call and each mutation POSTs another ~2.2 MB. The records themselves
// cannot shrink — assets/task_anchors.md whitelists 145 routes and 252 strings
// across them, and dropping an anchored record is a P0 — so the saving is taken
// on the wire instead, where it costs nothing semantically:
//
//   /go   4.47 MB -> 1.10 MB      POST /post  2.23 MB -> 0.55 MB
//
// gzip level 1: 13 ms for 2.2 MB and 4.1x, vs 30 ms for 4.5x at level 6. /go is
// on the per-step path of every rollout, so latency wins over ratio.
//
// The FILES under .mock-states/ stay plain JSON — the harness reads them
// directly. Only the HTTP bodies are compressed, and only when the client
// advertises support.
// ---------------------------------------------------------------------------
const GZIP_MIN_BYTES = 1024

function sendJson(req, res, payload, extraHeaders = {}) {
  const buf = Buffer.from(JSON.stringify(payload), 'utf-8')
  res.setHeader('Content-Type', 'application/json')
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v)
  res.setHeader('Vary', 'Accept-Encoding')
  const accepts = /(^|[\s,])gzip($|[\s,;])/.test(String(req.headers['accept-encoding'] || ''))
  if (accepts && buf.length >= GZIP_MIN_BYTES) {
    const gz = zlib.gzipSync(buf, { level: 1 })
    res.setHeader('Content-Encoding', 'gzip')
    res.setHeader('Content-Length', gz.length)
    res.end(gz)
    return
  }
  res.setHeader('Content-Length', buf.length)
  res.end(buf)
}

/**
 * Whole request body as a UTF-8 string.
 *
 * Buffer first, decode ONCE. `body += chunk` decodes each chunk on its own, so
 * a multi-byte codepoint straddling a chunk boundary becomes U+FFFD — silent
 * corruption of a ~2 MB payload full of anchored non-ASCII strings (BUG-004,
 * measured at 2.2% of writes). Also transparently inflates a gzipped body, so
 * saveState can compress before it posts.
 */
async function readBody(req) {
  const chunks = []
  let size = 0
  const declared = Number(req.headers['content-length'] || 0)
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    throw new HttpError(413, 'Request body is too large.')
  }
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += part.length
    if (size > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.')
    chunks.push(part)
  }
  let buf = Buffer.concat(chunks)
  const enc = String(req.headers['content-encoding'] || '').toLowerCase()
  try {
    if (enc === 'gzip') buf = zlib.gunzipSync(buf, { maxOutputLength: MAX_BODY_BYTES })
    else if (enc === 'deflate') buf = zlib.inflateSync(buf, { maxOutputLength: MAX_BODY_BYTES })
    else if (enc && enc !== 'identity') throw new HttpError(415, `Unsupported content encoding: ${enc}`)
  } catch (e) {
    if (e instanceof HttpError) throw e
    throw new HttpError(400, 'Compressed request body is malformed or too large.')
  }
  if (buf.length > MAX_BODY_BYTES) throw new HttpError(413, 'Request body is too large.')
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buf)
  } catch (_) {
    throw new HttpError(400, 'Request body is not valid UTF-8.')
  }
}

function getFilesDir(sid) {
  const dir = path.join(FILES_DIR, sid || '_default')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

async function readBuffer(req, maxBytes) {
  const chunks = []
  let size = 0
  const declared = Number(req.headers['content-length'] || 0)
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, 'Upload is too large.')
  }
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += part.length
    if (size > maxBytes) throw new HttpError(413, 'Upload is too large.')
    chunks.push(part)
  }
  return Buffer.concat(chunks)
}

function parseMultipart(buf, boundary) {
  const files = []
  const boundaryBuf = Buffer.from('--' + boundary)
  const parts = []
  let start = 0
  while (true) {
    const idx = buf.indexOf(boundaryBuf, start)
    if (idx === -1) break
    if (start > 0) { const partEnd = idx - 2; if (partEnd > start) parts.push(buf.slice(start, partEnd)) }
    start = idx + boundaryBuf.length + 2
  }
  for (const part of parts) {
    const headerEnd = part.indexOf('\r\n\r\n')
    if (headerEnd === -1) continue
    const headerStr = part.slice(0, headerEnd).toString('utf-8')
    const body = part.slice(headerEnd + 4)
    const nameMatch = headerStr.match(/name="([^"]*)"/)
    const filenameMatch = headerStr.match(/filename="([^"]*)"/)
    const ctMatch = headerStr.match(/Content-Type:\s*(.+)/i)
    if (filenameMatch && filenameMatch[1]) {
      files.push({ fieldName: nameMatch ? nameMatch[1] : 'file', filename: filenameMatch[1], contentType: ctMatch ? ctMatch[1].trim() : 'application/octet-stream', data: body })
    }
  }
  return files
}

function setupMiddlewares(server) {
  server.middlewares.use('/upload', async (req, res, next) => {
    if (req.method !== 'POST') return next()
    try {
      const sid = requestSid(req)
      const contentType = req.headers['content-type'] || ''
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
      if (!boundaryMatch) throw new HttpError(400, 'multipart required')
      const buf = await readBuffer(req, MAX_UPLOAD_BYTES)
      const files = parseMultipart(buf, (boundaryMatch[1] || boundaryMatch[2]).trim())
      if (files.length === 0) throw new HttpError(400, 'No files found')
      const filesDir = getFilesDir(sid)
      const uploaded = []
      for (const file of files) {
        const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 246)
        // The prefix is a CONTENT hash, not a random id. GitLab's upload surfaces
        // (issue attachments, avatars) put the returned `url` into state, so a
        // random prefix would mint a fresh value into the /go diff on every run
        // and make any task touching an upload non-reproducible. Hashing the bytes
        // keeps names unique per distinct file, makes re-uploading the same file
        // idempotent, and is stable across runs.
        const storedName = `${createHash('sha1').update(file.data).digest('hex').slice(0, 8)}_${safeFilename}`
        atomicWriteBuffer(path.join(filesDir, storedName), file.data)
        uploaded.push({ original_name: file.filename, stored_name: storedName, size: file.data.length, content_type: file.contentType, url: `/files/${sid || '_default'}/${storedName}` })
      }
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ success: true, files: uploaded }))
    } catch (e) {
      sendError(res, e)
    }
  })

  server.middlewares.use('/files', (req, res, next) => {
    if (req.method !== 'GET') return next()
    try {
      const pathname = new URL(req.url || '/', 'http://localhost').pathname
      const parts = pathname.split('/').filter(Boolean).map(decodeURIComponent)
      if (parts.length !== 2) { res.statusCode = 404; res.end('Not found'); return }
      const sid = validateSid(parts[0])
      const filename = parts[1]
      if (!/^[a-zA-Z0-9._-]+$/.test(filename)) throw new HttpError(400, 'Invalid filename.')
      const filePath = path.join(FILES_DIR, sid || '_default', filename)
      if (!fs.existsSync(filePath)) { res.statusCode = 404; res.end('Not found'); return }
      const ext = path.extname(filename).toLowerCase()
      const mimeMap = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.txt': 'text/plain', '.csv': 'text/csv' }
      const ct = mimeMap[ext] || 'application/octet-stream'
      const fileData = fs.readFileSync(filePath)
      res.setHeader('Content-Type', ct); res.setHeader('Content-Length', fileData.length)
      res.end(fileData)
    } catch (e) {
      sendError(res, e)
    }
  })

  server.middlewares.use('/post', async (req, res, next) => {
    if (req.method !== 'POST') return next()
    try {
      const sid = requestSid(req)
      const body = await readBody(req)
      const data = JSON.parse(body)
      const action = data.action || 'set'
      const result = await enqueueMutation(sid, () => {
        // `reset` restores current state from the baseline and deliberately
        // keeps the baseline. With no baseline it clears the orphaned current.
        if (action === 'reset') {
          const initial = readInitialState(sid)
          if (initial !== null) {
            writeState(sid, initial)
            return { success: true, sid, message: 'State reset to initial.' }
          }
          clearState(sid)
          return { success: true, sid, message: 'State cleared.' }
        }

        // Harness setup is a complete rebaseline operation. Retrying `set` on
        // an existing sid must replace BOTH files, otherwise the old baseline
        // creates a phantom pre-task diff.
        if (action === 'set') {
          if (!Object.prototype.hasOwnProperty.call(data, 'state')) {
            throw new HttpError(400, 'set requires a state value.')
          }
          requireState(data.state, 'state')
          writeInitialState(sid, data.state)
          writeState(sid, data.state)
          return { success: true, sid, message: 'State set.' }
        }

        // Internal cold/recovery publication. It only fills missing files when
        // every existing file still matches the caller's view. A concurrent
        // harness injection therefore always wins instead of being overwritten
        // by stale localStorage between GET /state and this request.
        if (action === 'restore') {
          if (!Object.prototype.hasOwnProperty.call(data, 'state')
              || !Object.prototype.hasOwnProperty.call(data, 'initial_state')) {
            throw new HttpError(400, 'restore requires state and initial_state.')
          }
          requireState(data.state, 'state')
          requireState(data.initial_state, 'initial_state')
          const current = readState(sid)
          const initial = readInitialState(sid)
          const compatible = (current === null || equalState(current, data.state))
            && (initial === null || equalState(initial, data.initial_state))
          if (!compatible) return { success: true, sid, restored: false }
          if (initial === null) writeInitialState(sid, data.initial_state)
          if (current === null) writeState(sid, data.state)
          return { success: true, sid, restored: true }
        }

        // `set_current` writes <sid>.json ONLY. It must NEVER seed the
        // baseline: on a fresh session the first mutation would otherwise
        // become invisible to /go.
        if (action === 'set_current') {
          if (!Object.prototype.hasOwnProperty.call(data, 'state')) {
            throw new HttpError(400, 'set_current requires a state value.')
          }
          requireState(data.state, 'state')
          const currentState = readState(sid) || {}
          const newState = data.merge ? deepMerge(currentState, data.state) : data.state
          writeState(sid, newState)
          return { success: true, sid, message: 'Current state updated.' }
        }
        throw new HttpError(400, 'Unknown action')
      })
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(result))
    } catch (e) {
      sendError(res, e instanceof SyntaxError ? new HttpError(400, 'Malformed JSON body.') : e)
    }
  })

  server.middlewares.use('/state', (req, res, next) => {
    if (req.method !== 'GET') return next()
    try {
      const sid = requestSid(req)
      const state = readState(sid)
      const initial = readInitialState(sid)
      sendJson(req, res, {
        stored_state: state,
        has_custom_state: state !== null,
        initial_state: initial,
        has_initial_state: initial !== null,
        sid,
      }, { 'Cache-Control': 'no-cache, no-store' })
    } catch (e) {
      sendError(res, e)
    }
  })

  server.middlewares.use('/go', (req, res, next) => {
    if (req.method !== 'GET') return next()
    try {
      const sid = requestSid(req)
      const currentState = readState(sid)
      const initialState = readInitialState(sid)
      const defaultState = createInitialData()
      // NEVER `initialState || currentState || defaultState` — a missing
      // baseline must compare against the pristine default, not against itself.
      const initial = initialState || defaultState
      const current = currentState || initial
      const stateDiff = calculateStateDiff(initial, current)
      sendJson(req, res, { initial_state: initial, current_state: current, state_diff: stateDiff },
        { 'Cache-Control': 'no-cache, no-store' })
    } catch (e) {
      sendError(res, e)
    }
  })
}

export default defineConfig({
  base: '/',
  plugins: [secureMockApiPlugin(), 
    react(),
    {
      name: 'mock-api',
      configureServer(server) { setupMiddlewares(server) },
      configurePreviewServer(server) { setupMiddlewares(server) }
    }
  ],
  // NO `json: { stringify: true }` here — it was tried and MEASURED, and it is a
  // regression for this mock. `webarena_reddit_mock` sets it (one 14.6 MB corpus
  // in three modules, where the JSON.parse win dominates); gitlab's ~6.4 MB is
  // spread over 24 modules and behaves differently. Medians of 5 interleaved
  // cold loads of /byteblaze/dotfiles, FCP:
  //
  //   npm run preview   stringify:false  372 ms · bundle 7 480 108 B
  //                     stringify:true   380 ms · bundle 7 891 691 B
  //   npm run dev       stringify:false  440 ms
  //                     stringify:true  1564 ms   <- +1.1 s, DCL 307 -> 1428 ms
  //
  // i.e. no production win, +411 KB of bundle, and a 3.5x slower dev server —
  // dev is what every agent round and every playwright run actually loads.
  // Vite 5's default is `stringify: false`, so this is simply left unset.
  //
  // RE-TESTED after the 6.4x seed expansion took src/data from 6.4 MB to 24.4 MB,
  // on the theory that JSON.parse would finally dominate at that size. It does
  // not — a BUILD-ONLY variant (`json: command === 'build' ? {stringify:true}
  // : undefined`, which sidesteps the dev penalty entirely) measured 916 ms vs
  // 896 ms preview FCP and +1.9 MB of bundle. The cost is not parse strategy,
  // it is total bytes. Do not try this a third time.

  // ---------------------------------------------------------------------------
  // One chunk per seed module. This is what actually recovered first paint.
  //
  // The expansion made the single bundle 23.9 MB, and preview FCP went
  // 368 -> 896 ms while dev only went 444 -> 636 ms. Preview regressing HARDER
  // than dev is the tell: dev already serves each JSON module as its own file,
  // so the browser fetches ~24 of them in parallel and parses each as it lands,
  // while the production build was one 23.9 MB file that had to arrive in full
  // before a single byte of it could execute.
  //
  // Splitting the seed restores that parallelism in production. Medians of 5
  // interleaved cold loads of /byteblaze/dotfiles, same method as above:
  //
  //   npm run preview   one chunk        896 ms
  //                     per-module      488-512 ms   <- -384 ms
  //   npm run dev       unaffected (rollup does not run in dev)
  //
  // Nothing is deferred and no module is dropped: every chunk is still a static
  // import, so the same bytes are still fetched and the same data is available
  // on first render. This is purely a serialization win, which is why it needs
  // no route manifest, no readiness gate and no component changes — verified by
  // route_smoke passing 201/201 against the CHUNKED preview build.
  //
  // This does NOT make the corpus lazy. Getting FCP back to the pre-expansion
  // 368 ms needs true code-splitting (~15.7 MB of the bundle is data the
  // project-overview route never reads); see DEV.part-merge.md §5 for the
  // design and the measured per-module budget.
  // ---------------------------------------------------------------------------
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          const m = /src\/data\/([a-z_]+)\.json$/.exec(id.replace(/\\/g, '/'))
          if (m) return 'seed-' + m[1]
        },
      },
    },
  },
  esbuild: { loader: 'jsx', include: /src\/.*\.jsx?$/, exclude: [] },
  optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },
  server: {
    port: 0, strictPort: false, allowedHosts: true,
    watch: {
      usePolling: true, interval: 1000,
      ignored: ["**/assets/screenshots/**", "**/node_modules/**", "**/.mock-states/**", "**/.mock-files/**"]
    },
    hmr: { port: 0 }
  },
  preview: { port: 0, host: '0.0.0.0', allowedHosts: true }
})
