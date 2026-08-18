import { secureMockApiPlugin } from '../../shared/secureMockApiPlugin.mjs';
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'
import { createHash, randomUUID } from 'crypto'
import { createInitialData } from './src/utils/dataManager.js'

const STATE_DIR = path.join(process.cwd(), '.mock-states')
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true })

const FILES_DIR = path.join(process.cwd(), '.mock-files')
if (!fs.existsSync(FILES_DIR)) fs.mkdirSync(FILES_DIR, { recursive: true })

const SID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/
const FILE_PATTERN = /^(?!\.{1,2}$)[a-zA-Z0-9._-]{1,255}$/
const MAX_JSON_BODY_BYTES = 16 * 1024 * 1024
const MAX_UPLOAD_BODY_BYTES = 64 * 1024 * 1024

function validateSid(sid) {
  if (sid === null || sid === undefined) return null
  if (!SID_PATTERN.test(sid)) {
    const error = new Error('sid must match [a-zA-Z0-9_-]{1,128}')
    error.statusCode = 400
    throw error
  }
  return sid
}

function stateKey(sid) {
  return validateSid(sid) || '_default'
}

function getStateFile(sid) {
  if (!sid) return path.join(process.cwd(), '.mock-state.json')
  return path.join(STATE_DIR, `${validateSid(sid)}.json`)
}

function getInitialStateFile(sid) {
  if (!sid) return path.join(process.cwd(), '.mock-state.initial.json')
  return path.join(STATE_DIR, `${validateSid(sid)}.initial.json`)
}

function getRevisionFile(sid) {
  if (!sid) return path.join(process.cwd(), '.mock-state.revision')
  return path.join(STATE_DIR, `${validateSid(sid)}.revision`)
}

function atomicWriteFile(file, value) {
  const temp = path.join(path.dirname(file), `.tmp-${process.pid}-${randomUUID()}`)
  try {
    fs.writeFileSync(temp, value)
    fs.renameSync(temp, file)
  } catch (error) {
    try { if (fs.existsSync(temp)) fs.unlinkSync(temp) } catch {}
    throw error
  }
}

function atomicWriteJson(file, value) {
  atomicWriteFile(file, JSON.stringify(value, null, 2))
}

function readState(sid) {
  try {
    const file = getStateFile(sid)
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'))
  } catch (e) { console.error('Error reading state:', e) }
  return null
}

function writeState(sid, state) {
  atomicWriteJson(getStateFile(sid), state)
}

function writeInitialStateUnconditional(sid, state) {
  atomicWriteJson(getInitialStateFile(sid), state)
}

function writeInitialState(sid, state) {
  const initFile = getInitialStateFile(sid)
  const current = readState(sid)
  if (!fs.existsSync(initFile) && current !== null) {
    return { written: false, reason: 'current state exists without a baseline' }
  }
  if (fs.existsSync(initFile)) {
    const initial = readInitialState(sid)
    if (current !== null && JSON.stringify(current) !== JSON.stringify(initial)) {
      return { written: false, reason: 'session already mutated' }
    }
  }
  atomicWriteJson(initFile, state)
  return { written: true }
}

function readInitialState(sid) {
  try {
    const f = getInitialStateFile(sid)
    if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf-8'))
  } catch (e) { console.error('Error reading initial state:', e) }
  return null
}

function clearState(sid) {
  const file = getStateFile(sid)
  if (fs.existsSync(file)) fs.unlinkSync(file)
  const initFile = getInitialStateFile(sid)
  if (fs.existsSync(initFile)) fs.unlinkSync(initFile)
  const revisionFile = getRevisionFile(sid)
  if (fs.existsSync(revisionFile)) fs.unlinkSync(revisionFile)
}

function readRevision(sid) {
  try {
    const value = Number(fs.readFileSync(getRevisionFile(sid), 'utf-8'))
    return Number.isSafeInteger(value) && value >= 0 ? value : 0
  } catch (error) {
    if (error.code !== 'ENOENT') console.error('Error reading revision:', error)
    return 0
  }
}

function nextRevision(sid) {
  const revision = readRevision(sid) + 1
  atomicWriteFile(getRevisionFile(sid), String(revision))
  return revision
}

function assertFreshRevision(sid, supplied) {
  const revision = readRevision(sid)
  if (supplied === undefined) return revision
  if (!Number.isSafeInteger(supplied) || supplied < 0) {
    const error = new Error('base_revision must be a non-negative integer')
    error.statusCode = 400
    error.revision = revision
    throw error
  }
  if (supplied !== revision) {
    const error = new Error(`Stale state revision: expected ${revision}, received ${supplied}`)
    error.statusCode = 409
    error.revision = revision
    throw error
  }
  return revision
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
  const dir = path.join(FILES_DIR, stateKey(sid))
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return dir
}

async function readBuffer(req, maxBytes) {
  const declared = Number(req.headers['content-length'])
  if (Number.isFinite(declared) && declared > maxBytes) {
    const error = new Error(`Request body exceeds ${maxBytes} bytes`)
    error.statusCode = 413
    throw error
  }
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
    size += buffer.length
    if (size > maxBytes) {
      const error = new Error(`Request body exceeds ${maxBytes} bytes`)
      error.statusCode = 413
      throw error
    }
    chunks.push(buffer)
  }
  return Buffer.concat(chunks, size)
}

async function readJsonBody(req) {
  const buffer = await readBuffer(req, MAX_JSON_BODY_BYTES)
  let body
  try {
    body = new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch {
    const error = new Error('Request body is not valid UTF-8')
    error.statusCode = 400
    throw error
  }
  let data
  try {
    data = JSON.parse(body)
  } catch {
    const error = new Error('Request body is not valid JSON')
    error.statusCode = 400
    throw error
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    const error = new Error('Request body must be a JSON object')
    error.statusCode = 400
    throw error
  }
  return data
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(payload))
}

function sendError(res, error) {
  console.error('Mock API error:', error)
  sendJson(res, error.statusCode || 500, {
    error: error.message || 'Internal server error',
    ...(Number.isSafeInteger(error.revision) ? { revision: error.revision } : {}),
  })
}

function requestSid(req) {
  const query = parseQuery(req.url || '')
  const supplied = Object.prototype.hasOwnProperty.call(query, 'sid')
  if (supplied && query.sid === '_default') {
    const error = new Error('sid _default is reserved')
    error.statusCode = 400
    throw error
  }
  return validateSid(supplied ? query.sid : null)
}

function requireStateObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    const error = new Error('state must be a JSON object')
    error.statusCode = 400
    throw error
  }
  return value
}

function normalizedState(value) {
  return { ...createInitialData(), ...requireStateObject(value || {}) }
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
      const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;\s]+))/)
      if (!boundaryMatch) {
        const error = new Error('multipart/form-data boundary required')
        error.statusCode = 400
        throw error
      }
      const buf = await readBuffer(req, MAX_UPLOAD_BODY_BYTES)
      const files = parseMultipart(buf, boundaryMatch[1] || boundaryMatch[2])
      if (files.length === 0) {
        const error = new Error('No files found')
        error.statusCode = 400
        throw error
      }
      const filesDir = getFilesDir(sid)
      const uploaded = []
      for (const file of files) {
        const safeFilename = file.filename.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 180) || 'file'
        const digest = createHash('sha256').update(file.data).digest('hex')
        const storedName = `${digest}_${safeFilename}`
        atomicWriteFile(path.join(filesDir, storedName), file.data)
        const sidPath = stateKey(sid)
        uploaded.push({ original_name: file.filename, stored_name: storedName, size: file.data.length, content_type: file.contentType, url: `/files/${sidPath}/${storedName}` })
      }
      sendJson(res, 200, { success: true, files: uploaded })
    } catch (error) {
      sendError(res, error)
    }
  })

  server.middlewares.use('/files', (req, res, next) => {
    if (req.method !== 'GET') return next()
    try {
      const parts = (req.url || '').split('?')[0].split('/').filter(Boolean).map(decodeURIComponent)
      if (parts.length !== 2) {
        const error = new Error('Not found')
        error.statusCode = 404
        throw error
      }
      const sid = parts[0] === '_default' ? '_default' : validateSid(parts[0])
      const filename = parts[1]
      if (!FILE_PATTERN.test(filename)) {
        const error = new Error('Not found')
        error.statusCode = 404
        throw error
      }
      const filePath = path.join(FILES_DIR, sid, filename)
      if (!fs.existsSync(filePath)) {
        const error = new Error('Not found')
        error.statusCode = 404
        throw error
      }
      const ext = path.extname(filename).toLowerCase()
      const mimeMap = { '.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.webp': 'image/webp', '.txt': 'text/plain', '.csv': 'text/csv' }
      const ct = mimeMap[ext] || 'application/octet-stream'
      const fileData = fs.readFileSync(filePath)
      res.setHeader('Content-Type', ct); res.setHeader('Content-Length', fileData.length)
      res.end(fileData)
    } catch (error) {
      if (error instanceof URIError) error.statusCode = 400
      sendError(res, error)
    }
  })

  server.middlewares.use('/post', async (req, res, next) => {
    if (req.method !== 'POST') return next()
    try {
      const sid = requestSid(req)
      const data = await readJsonBody(req)
      const action = data.action || 'set'
      if (action === 'reset') {
        assertFreshRevision(sid, data.base_revision)
        clearState(sid)
        sendJson(res, 200, { success: true, sid, message: 'State cleared.' })
        return
      }
      if (action === 'set') {
        // `set` is task setup: normalize a partial injection and always replace
        // both files, even when this SID was used by an earlier rollout.
        const newState = normalizedState(data.state)
        writeInitialStateUnconditional(sid, newState)
        writeState(sid, newState)
        const revision = nextRevision(sid)
        sendJson(res, 200, { success: true, sid, revision, message: 'State set.', state: newState })
        return
      }
      if (action === 'set_initial') {
        assertFreshRevision(sid, data.base_revision)
        const newState = normalizedState(data.state)
        const result = writeInitialState(sid, newState)
        const revision = result.written ? nextRevision(sid) : readRevision(sid)
        sendJson(res, 200, {
          success: true,
          sid,
          revision,
          written: result.written,
          message: result.written
            ? 'Initial state published.'
            : `Initial state left untouched: ${result.reason}.`,
        })
        return
      }
      if (action === 'restore') {
        if (!Object.prototype.hasOwnProperty.call(data, 'state')
            || !Object.prototype.hasOwnProperty.call(data, 'initial_state')) {
          const error = new Error('restore requires state and initial_state')
          error.statusCode = 400
          throw error
        }
        assertFreshRevision(sid, data.base_revision)
        const newState = normalizedState(data.state)
        const initialValue = normalizedState(data.initial_state)
        const current = readState(sid)
        const initial = readInitialState(sid)
        const compatible = (current === null || JSON.stringify(current) === JSON.stringify(newState))
          && (initial === null || JSON.stringify(initial) === JSON.stringify(initialValue))
        if (!compatible) {
          sendJson(res, 200, { success: true, sid, revision: readRevision(sid), restored: false })
          return
        }
        let changed = false
        if (initial === null) {
          writeInitialStateUnconditional(sid, initialValue)
          changed = true
        }
        if (current === null) {
          writeState(sid, newState)
          changed = true
        }
        const revision = changed ? nextRevision(sid) : readRevision(sid)
        sendJson(res, 200, { success: true, sid, revision, restored: true })
        return
      }
      if (action === 'set_current') {
        assertFreshRevision(sid, data.base_revision)
        const currentState = readState(sid) || {}
        const update = requireStateObject(data.state)
        const newState = data.merge ? deepMerge(currentState, update) : update
        writeState(sid, newState)
        // Deliberately never create or modify the baseline here: this payload is
        // post-action state and must not absorb the first task mutation.
        const revision = nextRevision(sid)
        sendJson(res, 200, { success: true, sid, revision, message: 'Current state updated.', state: newState })
        return
      }
      const error = new Error('Unknown action')
      error.statusCode = 400
      throw error
    } catch (error) {
      sendError(res, error)
    }
  })

  server.middlewares.use('/state', (req, res, next) => {
    if (req.method !== 'GET') return next()
    try {
      const sid = requestSid(req)
      const state = readState(sid)
      const initial = readInitialState(sid)
      res.setHeader('Cache-Control', 'no-cache, no-store')
      sendJson(res, 200, {
        stored_state: state,
        has_custom_state: state !== null,
        initial_state: initial,
        has_initial_state: initial !== null,
        revision: readRevision(sid),
        sid,
      })
    } catch (error) {
      sendError(res, error)
    }
  })

  server.middlewares.use('/go', (req, res, next) => {
    if (req.method !== 'GET') return next()
    try {
      const sid = requestSid(req)
      const currentState = readState(sid)
      const initialState = readInitialState(sid)
      const defaultState = createInitialData()
      const initial = initialState || defaultState
      const current = currentState || initial
      const stateDiff = calculateStateDiff(initial, current)
      res.setHeader('Cache-Control', 'no-cache, no-store')
      sendJson(res, 200, {
        initial_state: initial,
        current_state: current,
        state_diff: stateDiff,
        revision: readRevision(sid),
      })
    } catch (error) {
      sendError(res, error)
    }
  })
}

export default defineConfig({
  base: '/',
  plugins: [
    secureMockApiPlugin(),
    react(),
    {
      name: 'mock-api',
      configureServer(server) { setupMiddlewares(server) },
      configurePreviewServer(server) { setupMiddlewares(server) }
    }
  ],
  esbuild: { loader: 'jsx', include: /src\/.*\.jsx?$/, exclude: [] },
  optimizeDeps: { esbuildOptions: { loader: { '.js': 'jsx' } } },
  build: {
    // The catalogue shards are dynamically imported; keep them as separate chunks
    // and do not inline any asset (they are megabytes each).
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 40000
  },
  server: {
    port: 0, strictPort: false, allowedHosts: true,
    watch: {
      usePolling: true, interval: 1000,
      ignored: ['**/assets/**', '**/public/img/**', '**/node_modules/**', '**/.mock-states/**', '**/.mock-files/**']
    },
    hmr: { port: 0 }
  },
  preview: { port: 0, host: '0.0.0.0', allowedHosts: true }
})
