import { secureMockApiPlugin } from '../../shared/secureMockApiPlugin.mjs';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { createHash, randomUUID } from 'crypto'
import { TextDecoder } from 'util'
import { createInitialData } from './src/utils/dataManager.js'

const STATE_DIR = path.join(process.cwd(), '.mock-states')
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true })

const FILES_DIR = path.join(process.cwd(), '.mock-files')
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true })

const SID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/
const MAX_STATE_BODY_BYTES = 10 * 1024 * 1024
const MAX_UPLOAD_BODY_BYTES = 25 * 1024 * 1024
const mutationQueues = new Map()

class ApiError extends Error {
  constructor(statusCode, message) {
    super(message)
    this.statusCode = statusCode
  }
}

function validateSid(sid, supplied = false) {
  if (sid === null || sid === undefined || sid === '') {
    if (supplied) throw new ApiError(400, 'Invalid sid: value must not be empty')
    return null
  }
  if (supplied && sid === '_default') {
    throw new ApiError(400, 'Invalid sid: _default is reserved')
  }
  if (!SID_PATTERN.test(sid)) {
    throw new ApiError(400, 'Invalid sid: use 1-128 letters, numbers, hyphens, or underscores')
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

function readState(sid) {
  try {
    const file = getStateFile(sid)
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch (e) { console.error('Error reading state:', e) }
  return null
}

async function atomicWriteJson(file, state) {
  const temp = path.join(path.dirname(file), `.tmp-${process.pid}-${randomUUID()}`)
  try {
    await fs.promises.writeFile(temp, JSON.stringify(state, null, 2), 'utf-8')
    await fs.promises.rename(temp, file)
  } catch (e) {
    await fs.promises.unlink(temp).catch(() => {})
    throw e
  }
}

async function atomicWriteBuffer(file, data) {
  const temp = path.join(path.dirname(file), `.tmp-${process.pid}-${randomUUID()}`)
  try {
    await fs.promises.writeFile(temp, data)
    await fs.promises.rename(temp, file)
  } catch (e) {
    await fs.promises.unlink(temp).catch(() => {})
    throw e
  }
}

async function writeState(sid, state) {
  await atomicWriteJson(getStateFile(sid), state)
}

/**
 * Unconditionally (re)write the /go baseline. Only `{action:'set'}` may do
 * this: that verb *is* the task injector declaring the session's starting
 * state, so a baseline left over from a previous rollout on the same sid must
 * not survive it. Everything else goes through `writeInitialState`, which is
 * guarded.
 *
 * NOTE: `set_current` deliberately does NOT write a baseline — see the comment
 * on the `set_current` branch below (PIPELINE-003).
 */
async function writeInitialStateUnconditional(sid, state) {
  await atomicWriteJson(getInitialStateFile(sid), state)
}

/**
 * Publish the /go baseline (`action: 'set_initial'`).
 *
 * Why this verb exists. SCHEMA.md §2.2 lets a task inject a *partial* state
 * (`{"action":"set","state":{"newsletterSubscribed":true}}`). `set` writes that
 * object to both the current and the initial file. The app then merges it over
 * createInitialData() and republishes the whole tree via `set_current`, which
 * does not touch the baseline — so without a correction /go would diff a full
 * tree against a one-key baseline and report every defaulted key as a mutation.
 * `set_initial` lets the app republish the merged tree as the baseline at boot.
 *
 * The guard. A baseline may only be republished while the session has no
 * observable changes — i.e. the stored current state is absent or still
 * deep-equal to the stored baseline. Without it, a cold load in a fresh
 * browser context (empty localStorage, `sid` that has already been driven)
 * would take the *post-mutation* state as the new baseline and the mutation
 * would silently vanish from `state_diff` — an empty diff is indistinguishable
 * from a correct no-op, which is far worse than the phantom keys this fixes.
 */
async function writeInitialState(sid, state) {
  const initFile = getInitialStateFile(sid)
  if (fs.existsSync(initFile)) {
    const current = readState(sid)
    const initial = readInitialState(sid)
    if (current !== null && JSON.stringify(current) !== JSON.stringify(initial)) {
      return { written: false, reason: 'session already mutated' }
    }
  }
  await atomicWriteJson(initFile, state)
  return { written: true }
}

function readInitialState(sid) {
  try {
    const f = getInitialStateFile(sid)
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'))
  } catch (e) { console.error('Error reading initial state:', e) }
  return null
}

async function clearState(sid) {
  try {
    const file = getStateFile(sid)
    const initFile = getInitialStateFile(sid)
    await Promise.all([
      fs.promises.unlink(file).catch(e => { if (e.code !== 'ENOENT') throw e }),
      fs.promises.unlink(initFile).catch(e => { if (e.code !== 'ENOENT') throw e }),
    ])
  } catch (e) {
    console.error('Error clearing state:', e)
    throw e
  }
}

function parseQuery(url) {
  const idx = url.indexOf('?')
  if (idx === -1) return {}
  return Object.fromEntries(new URLSearchParams(url.substring(idx + 1)))
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

function equalState(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

function calculateStateDiff(initial, current) {
  const diff = {}
  const keys = new Set([
    ...Object.keys(initial || {}),
    ...Object.keys(current || {}),
  ])
  for (const key of keys) {
    if (!initial || JSON.stringify(current[key]) !== JSON.stringify(initial[key])) {
      const hasOld = !!initial && Object.prototype.hasOwnProperty.call(initial, key)
      const hasNew = !!current && Object.prototype.hasOwnProperty.call(current, key)
      diff[key] = {
        old: hasOld ? initial[key] : null,
        new: hasNew ? current[key] : null,
      }
    }
  }
  return diff
}

function getFilesDir(sid) {
  const dir = path.join(FILES_DIR, sid || '_default')
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

async function readBody(req) {
  const maxBytes = MAX_STATE_BODY_BYTES
  const declared = Number(req.headers['content-length'])
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ApiError(413, `Request body exceeds ${maxBytes} bytes`)
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.length
    if (size > maxBytes) throw new ApiError(413, `Request body exceeds ${maxBytes} bytes`)
    chunks.push(buf)
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks))
  } catch {
    throw new ApiError(400, 'Request body is not valid UTF-8')
  }
}

async function readUploadBody(req) {
  const declared = Number(req.headers['content-length'])
  if (Number.isFinite(declared) && declared > MAX_UPLOAD_BODY_BYTES) {
    throw new ApiError(413, `Request body exceeds ${MAX_UPLOAD_BODY_BYTES} bytes`)
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buf.length
    if (size > MAX_UPLOAD_BODY_BYTES) {
      throw new ApiError(413, `Request body exceeds ${MAX_UPLOAD_BODY_BYTES} bytes`)
    }
    chunks.push(buf)
  }
  return Buffer.concat(chunks)
}

function queueMutation(sid, operation) {
  const key = sid || ''
  const previous = mutationQueues.get(key) || Promise.resolve()
  const next = previous.catch(() => {}).then(operation)
  mutationQueues.set(key, next)
  void next.finally(() => {
    if (mutationQueues.get(key) === next) mutationQueues.delete(key)
  }).catch(() => {})
  return next
}

async function waitForMutation(sid) {
  const pending = mutationQueues.get(sid || '')
  if (pending) await pending
}

function sendJson(res, payload, statusCode = 200) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function sendError(res, error) {
  const status = error instanceof ApiError ? error.statusCode : 500
  if (status === 500) console.error('Mock API error:', error)
  sendJson(res, { error: status === 500 ? 'State persistence failed' : error.message }, status)
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

/**
 * Magento serves product images resized, from
 * `/media/catalog/product/cache/<hash>/<A>/<B>/<file>` — that is the shape the
 * source's own PDP emits, and the shape VisualWebArena's
 * `page_image_query.eval_fuzzy_image_match` evaluators download to SSIM-compare
 * (9 tasks: visualwebarena-510, 649-653, 673-675). The mock ships exactly one
 * size per image under the uncached path, so collapse the cache segment onto it
 * rather than duplicating 250 MB of media per hash.
 *
 * Hash-agnostic on purpose: two hashes appear across today's tasks
 * (`829a59e57f886f8cf0598ffca4f8a940`, `89ff578b9cd87e0600daac45c9e1ea98`) and a
 * future task may use a third. Registered inside setupMiddlewares() so it is
 * installed by BOTH configureServer and configurePreviewServer, and — because
 * Vite calls those hooks before installing its own middlewares — it rewrites the
 * URL before static serving and before the SPA fallback that was previously
 * answering these requests with 552 B of index.html.
 */
function mediaFileExists(root, urlPath) {
  let rel
  try {
    rel = decodeURIComponent(urlPath.split('?')[0].split('#')[0])
  } catch {
    return false // undecodable %-escape: nothing on disk can match it
  }
  if (rel.includes('\0')) return false
  const abs = path.resolve(root, '.' + rel)
  const mediaRoot = path.join(root, 'media')
  // Containment check, so `..` segments cannot report a file outside /media
  // as present. Static serving already refuses to serve them; this keeps the
  // 404 honest rather than letting a traversal fall through to the SPA.
  if (abs !== mediaRoot && !abs.startsWith(mediaRoot + path.sep)) return false
  try {
    return fs.statSync(abs).isFile()
  } catch {
    return false
  }
}

/**
 * R6-004: answer 404 for anything under `/media/**` that is not on disk.
 *
 * Without this, an unmatched media URL falls through to Vite's SPA fallback and
 * comes back as 552 B of index.html at **200 text/html**. That is precisely how
 * R5-002 stayed hidden for four rounds: an evaluator downloading a product image
 * sees a 200 and only a content-type check reveals it got HTML. Nothing is
 * broken today (19 225 referenced paths, 19 225 files, 0 missing), so this
 * changes no behaviour — it converts the next regression of that class from
 * silent into loud.
 *
 * `root` is the directory the server actually serves static files from, and it
 * differs between the two hooks (dev: `public/`, preview: `dist/`). Passing it in
 * rather than probing both matters: probing both would report a file as present
 * in dev because a stale `dist/` still holds it, and hand back the SPA fallback
 * anyway.
 */
function mediaMiddleware(root) {
  return function rewriteMagentoImageCachePath(req, res, next) {
    req.url = req.url.replace(
      /^\/media\/catalog\/product\/cache\/[0-9a-f]+\//i,
      '/media/catalog/product/'
    )
    if (/^\/media\//.test(req.url) && !mediaFileExists(root, req.url)) {
      res.statusCode = 404
      res.setHeader('Content-Type', 'text/plain')
      res.end('Not found')
      return
    }
    next()
  }
}

function setupMiddlewares(server, mediaRoot) {
  server.middlewares.use(mediaMiddleware(mediaRoot))

  server.middlewares.use('/upload', async (req, res, next) => {
    if (req.method !== 'POST') return next()
    try {
      const query = parseQuery(req.url || '')
      const sid = validateSid(query.sid, Object.prototype.hasOwnProperty.call(query, 'sid'))
      const contentType = req.headers['content-type'] || ''
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i)
      if (!boundaryMatch) throw new ApiError(400, 'multipart required')
      const buf = await readUploadBody(req)
      const files = parseMultipart(buf, boundaryMatch[1] || boundaryMatch[2].trim())
      if (files.length === 0) throw new ApiError(400, 'No files found')
      const filesDir = getFilesDir(sid)
      const uploaded = []
      for (const file of files) {
        const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 238)
        const digest = createHash('sha256').update(file.data).digest('hex').slice(0, 16)
        const storedName = `${digest}_${safeFilename}`
        await atomicWriteBuffer(path.join(filesDir, storedName), file.data)
        uploaded.push({ original_name: file.filename, stored_name: storedName, size: file.data.length, content_type: file.contentType, url: `/files/${sid || '_default'}/${storedName}` })
      }
      sendJson(res, { success: true, files: uploaded })
    } catch (e) {
      sendError(res, e)
    }
  })

  server.middlewares.use('/files', (req, res, next) => {
    if (req.method !== 'GET') return next()
    const parts = (req.url || '').split('/').filter(Boolean)
    if (parts.length !== 2) { res.statusCode = 404; res.end('Not found'); return }
    const sid = parts[0]
    const filename = parts[1]
    if (!SID_PATTERN.test(sid) || !/^[a-zA-Z0-9._-]+$/.test(filename) || filename === '.' || filename === '..') {
      res.statusCode = 400; res.end('Invalid file path'); return
    }
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
    try {
      const query = parseQuery(req.url || '')
      const sid = validateSid(query.sid, Object.prototype.hasOwnProperty.call(query, 'sid'))
      const body = await readBody(req)
      let data
      try {
        data = JSON.parse(body)
      } catch {
        throw new ApiError(400, 'Malformed JSON body')
      }
      if (!data || typeof data !== 'object' || Array.isArray(data)) {
        throw new ApiError(400, 'JSON body must be an object')
      }
      const action = data.action || 'set'
      const result = await queueMutation(sid, async () => {
        if (action === 'reset') {
          const initial = readInitialState(sid)
          if (initial !== null) {
            await writeState(sid, initial)
            return { success: true, sid, message: 'State reset to initial.' }
          }
          await clearState(sid)
          return { success: true, sid, message: 'State cleared.' }
        }

        if (!Object.prototype.hasOwnProperty.call(data, 'state')) {
          throw new ApiError(400, `Action ${action} requires state`)
        }
        const newState = data.state
        if (!newState || typeof newState !== 'object' || Array.isArray(newState)) {
          throw new ApiError(400, 'state must be a JSON object')
        }
        if (action === 'set') {
          const normalized = { ...createInitialData(), ...newState }
          await writeState(sid, normalized)
          // The set injector verb unconditionally replaces both
          // current state and baseline, including on a reused sid.
          await writeInitialStateUnconditional(sid, normalized)
          return { success: true, sid, message: 'State set.', state: normalized }
        }
        if (action === 'set_initial') {
          const writeResult = await writeInitialState(sid, newState)
          return { success: true, sid, message: writeResult.written ? 'Initial state published.' : `Initial state left untouched: ${writeResult.reason}.`, written: writeResult.written }
        }
        if (action === 'restore') {
          if (!Object.prototype.hasOwnProperty.call(data, 'initial_state')) {
            throw new ApiError(400, 'restore requires initial_state')
          }
          const initialState = data.initial_state
          if (!initialState || typeof initialState !== 'object' || Array.isArray(initialState)) {
            throw new ApiError(400, 'initial_state must be a JSON object')
          }
          const current = readState(sid)
          const initial = readInitialState(sid)
          const compatible = (current === null || equalState(current, newState))
            && (initial === null || equalState(initial, initialState))
          if (!compatible) return { success: true, sid, restored: false }
          if (initial === null) await writeInitialStateUnconditional(sid, initialState)
          if (current === null) await writeState(sid, newState)
          return { success: true, sid, restored: true }
        }
        if (action === 'set_current') {
          const currentState = readState(sid) || {}
          const mergedState = data.merge ? deepMerge(currentState, newState) : newState
          await writeState(sid, mergedState)
          // Deliberately does not establish or replace the baseline.
          return { success: true, message: 'Current state updated.', state: mergedState }
        }
        throw new ApiError(400, 'Unknown action')
      })
      sendJson(res, result)
    } catch (e) {
      sendError(res, e)
    }
  })

  server.middlewares.use('/state', async (req, res, next) => {
    if (req.method !== 'GET') return next()
    try {
      const query = parseQuery(req.url || '')
      const sid = validateSid(query.sid, Object.prototype.hasOwnProperty.call(query, 'sid'))
      await waitForMutation(sid)
      const state = readState(sid)
      const initial = readInitialState(sid)
      res.setHeader('Cache-Control', 'no-cache, no-store')
      sendJson(res, {
        stored_state: state,
        has_custom_state: state !== null,
        initial_state: initial,
        has_initial_state: initial !== null,
        sid,
      })
    } catch (e) {
      sendError(res, e)
    }
  })

  server.middlewares.use('/go', async (req, res, next) => {
    if (req.method !== 'GET') return next()
    try {
      const query = parseQuery(req.url || '')
      const sid = validateSid(query.sid, Object.prototype.hasOwnProperty.call(query, 'sid'))
      await waitForMutation(sid)
      const currentState = readState(sid)
      const initialState = readInitialState(sid)
      const defaultState = createInitialData()
      // A missing baseline must compare current state with defaults, never with
      // itself, or the first mutation is hidden behind an empty diff.
      const initial = initialState || defaultState
      const current = currentState || initial
      const stateDiff = calculateStateDiff(initial, current)
      res.setHeader('Cache-Control', 'no-cache, no-store')
      sendJson(res, { initial_state: initial, current_state: current, state_diff: stateDiff })
    } catch (e) {
      sendError(res, e)
    }
  })
}

/**
 * Preload the boot-gate detail chunk.
 *
 * `AppContext` awaits `ensureDetail(['options'])` before it renders anything,
 * and `main.jsx` starts that import "before React mounts" to overlap it with
 * the app shell. But `main.jsx` imports `catalog.js`, which STATICALLY imports
 * `products.json`, so nothing in `main.jsx` runs until the whole 16 MB `seed`
 * chunk has downloaded, parsed and executed. Measured on the doubled seed: the
 * `seed-options` request does not start until **t=535 ms**, immediately after
 * `seed` finishes at ~530 ms, and then costs another **122 ms** entirely on the
 * critical path. The overlap the comment describes never happened.
 *
 * Vite emits `modulepreload` links for STATIC imports of the entry only, and
 * `options` is a dynamic import, so it gets none. This adds it, which is the
 * whole fix: the browser starts both chunks at t≈10 ms and the options
 * transfer disappears inside the seed transfer instead of following it.
 *
 * Deliberately narrow. It preloads ONLY chunks the boot gate actually blocks
 * on — not `seed-reviews` or `seed-descriptions-*`, which are lazy by design
 * and whose whole point (R8-001) is to stay off the first paint.
 */
function preloadBootChunks() {
  return {
    name: 'preload-boot-chunks',
    enforce: 'post',
    apply: 'build',
    // NOT `transformIndexHtml`: Vite runs that hook *before* the chunk
    // filenames (which carry a content hash) are known, so the href could only
    // ever be a guess. `generateBundle` sees both the emitted chunks and the
    // emitted `index.html` asset, so the real hashed name is available and the
    // link is written straight into the HTML source.
    generateBundle(_options, bundle) {
      const hrefs = Object.keys(bundle)
        .filter(f => /(^|\/)seed-options-[^/]*\.js$/.test(f))
        .map(f => '/' + f)
      const html = Object.values(bundle).find(
        a => a.type === 'asset' && a.fileName.endsWith('index.html'))
      if (!html || !hrefs.length) {
        // Loud rather than silent: if the chunk is ever renamed, the preload
        // quietly vanishing would look exactly like the optimisation not
        // working, and cost another round to rediscover.
        this.warn('preload-boot-chunks: no seed-options chunk found; boot gate will serialise')
        return
      }
      const links = hrefs
        .map(h => `<link rel="modulepreload" crossorigin href="${h}">`).join('\n    ')
      html.source = String(html.source).replace('</head>', `  ${links}\n  </head>`)
    },
  }
}

export default defineConfig({
  base: '/',
  // Shard V measured `json: { stringify: true }` here — emitting `JSON.parse("…")`
  // instead of Vite 5.4's default object literal — on the doubled 22 721-product
  // seed. It is SLOWER, not faster: cold time-to-readable-content went 942 ms ->
  // 1 257 ms on every route, and the `seed` chunk grew 16.0 -> 17.1 MB. Recorded
  // so the next round does not spend the measurement again.
  plugins: [secureMockApiPlugin(), preloadBootChunks(),
    react(),
    {
      name: 'mock-api',
      // The static root differs between the two: dev serves publicDir, preview
      // serves the build output. mediaMiddleware() needs the right one to decide
      // whether a /media/** path is genuinely missing (R6-004).
      configureServer(server) { setupMiddlewares(server, path.join(process.cwd(), 'public')) },
      configurePreviewServer(server) { setupMiddlewares(server, path.join(process.cwd(), 'dist')) }
    }
  ],
  build: {
    // The frozen catalog seed is ~19 MB of JSON. It is split three ways:
    //
    //   seed              products + categories + listings + the small configs.
    //                     Every listing route resolves against these, so they
    //                     stay statically imported by utils/catalog.js.
    //   seed-descriptions
    //   seed-options      per-product detail, imported dynamically by
    //   seed-reviews      utils/catalog.js#loadCatalogDetail().
    //
    // One chunk per file rather than one lazy bundle: the browser fetches the
    // three in parallel, and a change to reviews.json no longer invalidates the
    // cached descriptions. All four are same-origin static chunks — still
    // fully offline.
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          // R8-001: the description corpus ships as 32 shards keyed `id % 32`
          // (assets/dumps/build_desc_shards.py) so a PDP downloads one product's
          // description rather than 11 358 of them. Each shard MUST stay its own
          // chunk — the `/src/data/` catch-all below would otherwise fold all 32
          // back into the always-loaded `seed` chunk, which is the exact
          // regression this split exists to undo. `seed-` prefix on purpose:
          // every first-paint measurement filters resources on it.
          const shard = id.match(/\/src\/data\/descriptions\/(d\d+)\.json/)
          if (shard) return `seed-descriptions-${shard[1]}`
          // Still matched so a stray import of the unsharded corpus (the seed
          // pipeline's artifact — see build_desc_shards.py) never lands in `seed`.
          if (id.includes('/src/data/productDescriptions.json')) return 'seed-descriptions'
          if (id.includes('/src/data/productOptions.json')) return 'seed-options'
          if (id.includes('/src/data/reviews.json')) return 'seed-reviews'
          if (id.includes('/src/data/')) return 'seed'
          if (id.includes('node_modules')) return 'vendor'
          return undefined
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
