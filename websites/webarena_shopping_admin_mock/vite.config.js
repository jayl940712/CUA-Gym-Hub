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
 * on the `set_current` branch below (PIPELINE-001).
 */
async function writeInitialStateUnconditional(sid, state) {
  await atomicWriteJson(getInitialStateFile(sid), state)
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

function setupMiddlewares(server) {
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
