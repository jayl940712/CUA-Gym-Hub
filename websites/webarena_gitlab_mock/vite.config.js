import { secureMockApiPlugin } from '../../shared/secureMockApiPlugin.mjs';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { createHash } from 'crypto'
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

function getStateFile(sid) {
  if (!sid) return path.join(process.cwd(), '.mock-state.json')
  const safeSid = sid.replace(/[^a-zA-Z0-9_-]/g, '')
  return path.join(STATE_DIR, `${safeSid}.json`)
}

function getInitialStateFile(sid) {
  if (!sid) return path.join(process.cwd(), '.mock-state.initial.json')
  const safeSid = sid.replace(/[^a-zA-Z0-9_-]/g, '')
  return path.join(STATE_DIR, `${safeSid}.initial.json`)
}

function readState(sid) {
  try {
    const file = getStateFile(sid)
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch (e) { console.error('Error reading state:', e) }
  return null
}

// State files are written COMPACT, not pretty-printed. The seed is ~2.1 MB of
// JSON and 2-space indentation added ~750 KB of pure whitespace to it — paid on
// every /post write and again on every /go, which reads and re-parses BOTH the
// current and the initial file. Nothing consumes these files by eye; /go and
// /state serve them as JSON.
function writeState(sid, state) {
  try { fs.writeFileSync(getStateFile(sid), JSON.stringify(state)); return true }
  catch (e) { console.error('Error writing state:', e); return false }
}

function writeInitialStateIfMissing(sid, state) {
  try {
    const initFile = getInitialStateFile(sid)
    if (!fs.existsSync(initFile)) fs.writeFileSync(initFile, JSON.stringify(state))
    return true
  } catch (e) { console.error('Error writing initial state:', e); return false }
}

function readInitialState(sid) {
  try {
    const f = getInitialStateFile(sid)
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'))
  } catch (e) { console.error('Error reading initial state:', e) }
  return null
}

function clearState(sid) {
  try {
    const file = getStateFile(sid)
    if (fs.existsSync(file)) fs.unlinkSync(file)
    const initFile = getInitialStateFile(sid)
    if (fs.existsSync(initFile)) fs.unlinkSync(initFile)
    return true
  } catch (e) { console.error('Error clearing state:', e); return false }
}

function parseQuery(url) {
  const idx = url.indexOf('?')
  if (idx === -1) return {}
  const params = {}
  url.substring(idx + 1).split('&').forEach(pair => {
    const [k, v] = pair.split('=')
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '')
  })
  return params
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
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  let buf = Buffer.concat(chunks)
  const enc = String(req.headers['content-encoding'] || '').toLowerCase()
  if (enc === 'gzip') buf = zlib.gunzipSync(buf)
  else if (enc === 'deflate') buf = zlib.inflateSync(buf)
  return buf.toString('utf-8')
}

function getFilesDir(sid) {
  const safeSid = (sid || '_default').replace(/[^a-zA-Z0-9_-]/g, '')
  const dir = path.join(FILES_DIR, safeSid)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
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
    const query = parseQuery(req.url || '')
    const sid = query.sid || null
    const contentType = req.headers['content-type'] || ''
    const boundaryMatch = contentType.match(/boundary=(.+)/)
    if (!boundaryMatch) { res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'multipart required' })); return }
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    const buf = Buffer.concat(chunks)
    const files = parseMultipart(buf, boundaryMatch[1])
    if (files.length === 0) { res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'No files found' })); return }
    const filesDir = getFilesDir(sid)
    const uploaded = []
    for (const file of files) {
      const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_')
      // The prefix is a CONTENT hash, not a random id. GitLab's upload surfaces
      // (issue attachments, avatars) put the returned `url` into state, so a
      // random prefix would mint a fresh value into the /go diff on every run
      // and make any task touching an upload non-reproducible. Hashing the bytes
      // keeps names unique per distinct file, makes re-uploading the same file
      // idempotent, and is stable across runs.
      const storedName = `${createHash('sha1').update(file.data).digest('hex').slice(0, 8)}_${safeFilename}`
      fs.writeFileSync(path.join(filesDir, storedName), file.data)
      const safeSid = (sid || '_default').replace(/[^a-zA-Z0-9_-]/g, '')
      uploaded.push({ original_name: file.filename, stored_name: storedName, size: file.data.length, content_type: file.contentType, url: `/files/${safeSid}/${storedName}` })
    }
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify({ success: true, files: uploaded }))
  })

  server.middlewares.use('/files', (req, res, next) => {
    if (req.method !== 'GET') return next()
    const parts = (req.url || '').split('/').filter(Boolean)
    if (parts.length < 2) { res.statusCode = 404; res.end('Not found'); return }
    const sid = parts[0].replace(/[^a-zA-Z0-9_-]/g, '')
    const filename = parts.slice(1).join('/').replace(/[^a-zA-Z0-9._-]/g, '_')
    const filePath = path.join(FILES_DIR, sid, filename)
    if (!fs.existsSync(filePath)) { res.statusCode = 404; res.end('Not found'); return }
    const ext = path.extname(filename).toLowerCase()
    const mimeMap = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.txt': 'text/plain', '.csv': 'text/csv' }
    const ct = mimeMap[ext] || 'application/octet-stream'
    const fileData = fs.readFileSync(filePath)
    res.setHeader('Content-Type', ct); res.setHeader('Content-Length', fileData.length)
    res.end(fileData)
  })

  server.middlewares.use('/post', async (req, res, next) => {
    if (req.method !== 'POST') return next()
    const query = parseQuery(req.url || '')
    const sid = query.sid || null
    const body = await readBody(req)
    try {
      const data = JSON.parse(body)
      const action = data.action || 'set'
      // `reset` RESTORES <sid>.json from <sid>.initial.json and keeps both
      // files. This is a deliberate divergence from .claude/agents/audit.md §3b
      // ("reset deletes both files"), not an oversight:
      //   - the migration brief specifies "reset must restore the initial state",
      //     which an RL rollout needs between episodes;
      //   - deleting the baseline would make the next /go diff against a
      //     freshly-captured (already-mutated) baseline instead of the injected
      //     task state, which is exactly the failure publishInitialState exists
      //     to prevent.
      // Delete-both semantics are still reachable: when there is no baseline to
      // restore, reset falls through to clearState() below.
      if (action === 'reset') {
        const initial = readInitialState(sid)
        if (initial) {
          writeState(sid, initial)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, sid, message: 'State reset to initial.' }))
        } else {
          clearState(sid)
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ success: true, sid, message: 'State cleared.' }))
        }
        return
      }
      // The two write actions acknowledge, they do not echo the state back.
      // The stored state is ~2.1 MB; mirroring it into every response meant a
      // 2 MB download per mutation for a body no caller reads (saveState and
      // publishInitialState both discard it). `GET /state` and `GET /go` are
      // how you read state back.
      if (action === 'set') {
        const newState = data.state
        writeState(sid, newState)
        writeInitialStateIfMissing(sid, newState)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, sid, message: 'State set.' }))
        return
      }
      // `set_current` writes <sid>.json ONLY. It must NEVER seed
      // <sid>.initial.json: on a fresh session the first mutation would become
      // the baseline, so initial == current and /go would report an empty
      // state_diff forever. That is defect A in shared/check-state-contract.py.
      // The baseline is seeded by `set` — which AppContext's
      // publishInitialState() posts once at boot on a cold session — or by the
      // eval harness injecting task state.
      if (action === 'set_current') {
        const currentState = readState(sid) || {}
        const newState = data.merge ? deepMerge(currentState, data.state) : data.state
        writeState(sid, newState)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, sid, message: 'Current state updated.' }))
        return
      }
      res.statusCode = 400; res.end(JSON.stringify({ error: 'Unknown action' }))
    } catch (e) {
      res.statusCode = 400; res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify({ error: e.message }))
    }
  })

  server.middlewares.use('/state', (req, res, next) => {
    if (req.method !== 'GET') return next()
    const query = parseQuery(req.url || '')
    const sid = query.sid || null
    const state = readState(sid)
    sendJson(req, res, { stored_state: state, has_custom_state: state !== null, sid },
      { 'Cache-Control': 'no-cache, no-store' })
  })

  server.middlewares.use('/go', (req, res, next) => {
    if (req.method !== 'GET') return next()
    const query = parseQuery(req.url || '')
    const sid = query.sid || null
    const currentState = readState(sid)
    const initialState = readInitialState(sid)
    const defaultState = createInitialData()
    // NEVER `initialState || currentState || defaultState` — that turns a
    // missing baseline into a self-comparison and the diff is empty by another
    // route (defect B in shared/check-state-contract.py). A never-seeded sid
    // baselines against createInitialData(), which is exactly what the client
    // boots from, so GET /go?sid=<untouched> reports state_diff == {}.
    const initial = initialState || defaultState
    const current = currentState || initial
    const stateDiff = calculateStateDiff(initial, current)
    sendJson(req, res, { initial_state: initial, current_state: current, state_diff: stateDiff },
      { 'Cache-Control': 'no-cache, no-store' })
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
