import { secureMockApiPlugin } from '../../shared/secureMockApiPlugin.mjs';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import { createHash } from 'crypto'
import { TextDecoder } from 'util'
import { createInitialData } from './src/utils/dataManager.js'

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
  atomicWrite(getStateFile(sid), JSON.stringify(state, null, 2))
}

function writeInitialState(sid, state) {
  atomicWrite(getInitialStateFile(sid), JSON.stringify(state, null, 2))
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

function calculateStateDiff(initial, current) {
  const diff = {}
  const keys = new Set([
    ...Object.keys(initial || {}),
    ...Object.keys(current || {}),
  ])
  for (const key of keys) {
    const hasInitial = !!initial && Object.prototype.hasOwnProperty.call(initial, key)
    const hasCurrent = !!current && Object.prototype.hasOwnProperty.call(current, key)
    if (!hasInitial || !hasCurrent
        || JSON.stringify(current[key]) !== JSON.stringify(initial[key])) {
      diff[key] = {
        old: hasInitial ? initial[key] : null,
        new: hasCurrent ? current[key] : null,
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

async function readBuffer(req, maxBytes, tooLargeMessage) {
  const chunks = []
  let size = 0
  const declared = Number(req.headers['content-length'] || 0)
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new HttpError(413, tooLargeMessage)
  }
  for await (const chunk of req) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += part.length
    if (size > maxBytes) throw new HttpError(413, tooLargeMessage)
    chunks.push(part)
  }
  return Buffer.concat(chunks)
}

async function readBody(req) {
  let buf = await readBuffer(req, MAX_BODY_BYTES, 'Request body is too large.')
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
      const buf = await readBuffer(req, MAX_UPLOAD_BYTES, 'Upload is too large.')
      const files = parseMultipart(buf, (boundaryMatch[1] || boundaryMatch[2]).trim())
      if (files.length === 0) throw new HttpError(400, 'No files found')
      const filesDir = getFilesDir(sid)
      const uploaded = []
      for (const file of files) {
        const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 246)
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
      // Buffer first and decode once with a fatal UTF-8 decoder. This preserves
      // multi-byte characters split across transport chunks and rejects invalid
      // byte sequences instead of persisting U+FFFD replacements.
      const body = await readBody(req)
      const data = JSON.parse(body)
      const action = data.action || 'set'
      const result = await enqueueMutation(sid, () => {
        if (action === 'reset') {
          clearState(sid)
          return { success: true, sid, message: 'State cleared.' }
        }
        if (action === 'set') {
          if (!Object.prototype.hasOwnProperty.call(data, 'state')) {
            throw new HttpError(400, 'set requires a state value.')
          }
          requireState(data.state, 'state')
          // Retried harness setup is a complete rebaseline, not a current-only
          // overwrite over a stale initial file.
          writeInitialState(sid, data.state)
          writeState(sid, data.state)
          return { success: true, sid, message: 'State set.', state: data.state }
        }
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
        if (action === 'set_current') {
          // Current-only is intentionally baseline-free on a fresh sid.
          if (!Object.prototype.hasOwnProperty.call(data, 'state')) {
            throw new HttpError(400, 'set_current requires a state value.')
          }
          requireState(data.state, 'state')
          const currentState = readState(sid) || {}
          const newState = data.merge ? deepMerge(currentState, data.state) : data.state
          writeState(sid, newState)
          return { success: true, sid, message: 'Current state updated.', state: newState }
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
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-cache, no-store')
      res.end(JSON.stringify({
        stored_state: state,
        has_custom_state: state !== null,
        initial_state: initial,
        has_initial_state: initial !== null,
        sid,
      }))
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
      // No currentState fallback: a missing baseline compares against defaults.
      const initial = initialState || defaultState
      const current = currentState || initial
      const stateDiff = calculateStateDiff(initial, current)
      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-cache, no-store')
      res.end(JSON.stringify({ initial_state: initial, current_state: current, state_diff: stateDiff }))
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
  // `stringify: true` emits every JSON module as `JSON.parse("…")` instead of a
  // JS object literal. V8 parses a JSON string materially faster than the
  // equivalent literal, and this bundle carries a 14.6 MB corpus
  // (submissions.json + comments.json + userDirectory.json), so this is the
  // dominant remaining cost of first paint. Safe here: every JSON import in
  // src/ is a default import — `stringify: true` only breaks named ones.
  json: { stringify: true },
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
