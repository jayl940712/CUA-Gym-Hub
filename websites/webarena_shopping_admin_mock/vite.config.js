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
 * on the `set_current` branch below (PIPELINE-001).
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
 * Why this verb exists. A task may inject a *partial* state
 * (`{"action":"set","state":{"searchTerms":[…]}}` — it need not carry all 35
 * keys). `set` writes that object to both the current and the initial file.
 * The app then merges it over createInitialData() and republishes the whole
 * tree via `set_current`, which does not touch the baseline — so without a
 * correction /go would diff a full 35-key tree against a one-key baseline and
 * report all 34 defaulted keys as phantom mutations with `old: undefined`
 * (PIPELINE-002). `set_initial` lets the app republish the merged tree as the
 * baseline at boot, before any mutation.
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
        // normalises a *partial* inject into the full tree with `set_initial`.)
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
        // PIPELINE-001: `set_current` carries the POST-mutation tree and must
        // NEVER establish the baseline. It used to call
        // writeInitialStateIfMissing() here, so whenever `<sid>.initial.json`
        // was absent (fresh deploy — `.mock-states/` is gitignored — or a
        // wiped/reset session) the mutated tree became the baseline;
        // `initial === current` made state_diff `{}`, and every later diff
        // reported the first mutation as its `old`. An empty diff on a mutated
        // session is indistinguishable from a correct no-op, so the RL reward
        // signal read clean on a dirty session.
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
