import { secureMockApiPlugin } from '../../shared/secureMockApiPlugin.mjs';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { randomUUID } from 'crypto'
import { createInitialData } from './src/utils/dataManager.js'

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

function writeState(sid, state) {
  try { fs.writeFileSync(getStateFile(sid), JSON.stringify(state, null, 2)); return true }
  catch (e) { console.error('Error writing state:', e); return false }
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
function writeInitialStateUnconditional(sid, state) {
  try {
    fs.writeFileSync(getInitialStateFile(sid), JSON.stringify(state, null, 2))
    return true
  } catch (e) { console.error('Error writing initial state:', e); return false }
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
function writeInitialState(sid, state) {
  try {
    const initFile = getInitialStateFile(sid)
    if (fs.existsSync(initFile)) {
      const current = readState(sid)
      const initial = readInitialState(sid)
      if (current !== null && JSON.stringify(current) !== JSON.stringify(initial)) {
        return { written: false, reason: 'session already mutated' }
      }
    }
    fs.writeFileSync(initFile, JSON.stringify(state, null, 2))
    return { written: true }
  } catch (e) {
    console.error('Error writing initial state:', e)
    return { written: false, reason: e.message }
  }
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

function calculateStateDiff(initial, current) {
  const diff = {}
  for (const key in current) {
    if (!initial || JSON.stringify(current[key]) !== JSON.stringify(initial[key])) {
      diff[key] = { old: initial ? initial[key] : undefined, new: current[key] }
    }
  }
  return diff
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
      const storedName = `${randomUUID().slice(0, 8)}_${safeFilename}`
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
    let body = ''
    for await (const chunk of req) body += chunk
    try {
      const data = JSON.parse(body)
      const action = data.action || 'set'
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
      if (action === 'set') {
        const newState = data.state
        writeState(sid, newState)
        // `set` is the injector's verb: the state it carries is the session's
        // starting point by definition, so it establishes the baseline even if
        // a previous rollout on this sid left one behind. (The app then
        // normalises a *partial* inject into the full 15-key tree with
        // `set_initial` — see SCHEMA.md §2.3.)
        writeInitialStateUnconditional(sid, newState)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, sid, message: 'State set.', state: newState }))
        return
      }
      if (action === 'set_initial') {
        const newState = data.state
        const result = writeInitialState(sid, newState)
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, sid, message: result.written ? 'Initial state published.' : `Initial state left untouched: ${result.reason}.`, written: result.written }))
        return
      }
      if (action === 'set_current') {
        const currentState = readState(sid) || {}
        const newState = data.merge ? deepMerge(currentState, data.state) : data.state
        writeState(sid, newState)
        // PIPELINE-003: `set_current` carries the POST-mutation tree and must
        // NEVER establish the baseline. It used to call
        // writeInitialStateIfMissing() here, so whenever `<sid>.initial.json`
        // was absent (fresh deploy — `.mock-states/` is gitignored — or a
        // wiped/reset session) the mutated tree became the baseline;
        // `initial === current` made state_diff `{}`, and writeInitialState's
        // guard then permanently refused the app's `set_initial` correction.
        // An empty diff on a mutated session is indistinguishable from a
        // correct no-op, so the RL reward signal read clean on a dirty session.
        //
        // With this gone, a missing baseline merely degrades `/go` to
        // `initial = current` *transiently*: the app's next `set_initial`
        // (posted on every boot, see AppContext) finds no baseline file, is
        // therefore unguarded, and repairs it.
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ success: true, message: 'Current state updated.', state: newState }))
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
    const initial = readInitialState(sid)
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-cache, no-store')
    // `stored_state` / `has_custom_state` are the hub contract. `initial_state`
    // / `has_initial_state` are additive: the app reads them at boot so it can
    // tell "the server has no record of this sid" (republish from localStorage)
    // apart from "the server holds a state this browser did not write"
    // (a task inject or a `reset` — adopt it). Consumers that do not know
    // these fields are unaffected.
    res.end(JSON.stringify({
      stored_state: state,
      has_custom_state: state !== null,
      initial_state: initial,
      has_initial_state: initial !== null,
      sid,
    }))
  })

  server.middlewares.use('/go', (req, res, next) => {
    if (req.method !== 'GET') return next()
    const query = parseQuery(req.url || '')
    const sid = query.sid || null
    const currentState = readState(sid)
    const initialState = readInitialState(sid)
    const defaultState = createInitialData()
    const initial = initialState || currentState || defaultState
    const current = currentState || initial
    const stateDiff = calculateStateDiff(initial, current)
    res.setHeader('Content-Type', 'application/json')
    res.setHeader('Cache-Control', 'no-cache, no-store')
    res.end(JSON.stringify({ initial_state: initial, current_state: current, state_diff: stateDiff }))
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
