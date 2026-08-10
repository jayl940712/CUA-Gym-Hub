import sessionSeed from '../data/session_seed.json'

const BASE_KEY = 'classifieds_mock_state'
const BASE_INITIAL_KEY = 'classifieds_mock_initial_state'
const SID_KEY = 'classifieds_sid'
const SID_PATTERN = /^[a-zA-Z0-9_-]{1,128}$/

function checkedSid(sid) {
  if (sid === null || sid === undefined) return null
  if (!SID_PATTERN.test(sid)) throw new Error('Invalid session id')
  return sid
}

function revisionKey(sid) {
  return checkedSid(sid) || '_default'
}

export function getSessionId() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const sid = checkedSid(params.get('sid'))
  if (sid) {
    try { sessionStorage.setItem(SID_KEY, sid) } catch (e) {}
    return sid
  }
  try { return checkedSid(sessionStorage.getItem(SID_KEY)) } catch (e) { return null }
}

export function storageKey(sid) {
  sid = checkedSid(sid)
  return sid ? `${BASE_KEY}_${sid}` : BASE_KEY
}

export function initialKey(sid) {
  sid = checkedSid(sid)
  return sid ? `${BASE_INITIAL_KEY}_${sid}` : BASE_INITIAL_KEY
}

const serverRevisions = new Map()
const revisionBlocked = new Set()
const revisionConflictListeners = new Set()

export function subscribeRevisionConflicts(listener) {
  revisionConflictListeners.add(listener)
  return () => revisionConflictListeners.delete(listener)
}

function revisionConflict(sid, message = 'State persistence paused for revision recovery') {
  const error = new Error(message)
  error.revisionConflict = true
  error.sid = sid
  return error
}

export async function fetchServerState(sid) {
  const empty = { available: false, current: null, initial: null, revision: 0 }
  try {
    sid = checkedSid(sid)
    const url = sid ? `/state?sid=${encodeURIComponent(sid)}` : '/state'
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return empty
    const data = await res.json()
    if (!Object.prototype.hasOwnProperty.call(data, 'has_custom_state')) return empty
    const revision = Number.isSafeInteger(data.revision) ? data.revision : 0
    serverRevisions.set(revisionKey(sid), revision)
    return {
      available: true,
      current: data.has_custom_state && data.stored_state ? data.stored_state : null,
      initial: data.has_initial_state && data.initial_state ? data.initial_state : null,
      revision,
    }
  } catch (e) {
    console.error('Unable to read server state:', e)
  }
  return empty
}

export async function fetchCustomState(sid) {
  return (await fetchServerState(sid)).current
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch (e) {
    return null
  }
}

export function readStoredState(sid) {
  return readJson(storageKey(sid))
}

export function readStoredInitial(sid) {
  return readJson(initialKey(sid))
}

export function writeStoredInitial(sid, state) {
  localStorage.setItem(initialKey(sid), JSON.stringify(state))
}

export function mergeOverDefaults(partial) {
  return { ...createInitialData(), ...(partial || {}) }
}

export function sameState(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return a === b
  const canonical = value => JSON.stringify(value, (_key, item) =>
    item && typeof item === 'object' && !Array.isArray(item)
      ? Object.keys(item).sort().reduce((result, key) => {
        result[key] = item[key]
        return result
      }, {})
      : item)
  return canonical(a) === canonical(b)
}

/**
 * The whole mutable session state. Shape is fixed by assets/data_model.md §9.
 * ~2 KB — the 84,149-item catalogue is static reference data and NEVER lives here,
 * because /go serialises and diffs this object on every call.
 */
export function createInitialData() {
  return {
    user: { ...sessionSeed.user },
    comments: sessionSeed.comments.map(c => ({ ...c })),
    myItems: [...sessionSeed.myItems],
    itemOverrides: {},
    deletedItemIds: [],
    newItems: [],
    nextItemId: sessionSeed.nextItemId,
    nextCommentId: sessionSeed.nextCommentId,
    contactMessages: [],
    sendFriendMessages: [],
    alerts: [],
    marks: []
  }
}

export function initializeData(sid = null, customState = null) {
  const key = storageKey(sid)
  const initKey = initialKey(sid)

  if (customState !== null) {
    const merged = mergeOverDefaults(customState)
    localStorage.setItem(key, JSON.stringify(merged))
    localStorage.setItem(initKey, JSON.stringify(merged))
    return merged
  }

  const stored = localStorage.getItem(key)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (!localStorage.getItem(initKey)) {
        localStorage.setItem(initKey, JSON.stringify(parsed))
      }
      return parsed
    } catch (e) {}
  }

  const data = createInitialData()
  localStorage.setItem(key, JSON.stringify(data))
  localStorage.setItem(initKey, JSON.stringify(data))
  return data
}

let pendingWrites = new Map()
let flushScheduled = false
let writeChain = Promise.resolve()
let pendingRuns = []

function enqueueWrite(operation) {
  const run = writeChain.catch(() => {}).then(operation)
  writeChain = run.catch(error => {
    console.error('State write failed:', error)
  })
  pendingRuns.push(run)
  return run
}

async function post(sid, payload) {
  sid = checkedSid(sid)
  const key = revisionKey(sid)
  if (payload.action === 'set_current' && revisionBlocked.has(key)) {
    throw revisionConflict(sid)
  }
  const knownRevision = serverRevisions.get(key)
  const body = { ...payload }
  if ((payload.action === 'set_current' || payload.action === 'set_initial' || payload.action === 'restore')
      && Number.isSafeInteger(knownRevision)) {
    body.base_revision = knownRevision
  }

  const sidParam = sid ? `?sid=${encodeURIComponent(sid)}` : ''
  const res = await fetch(`/post${sidParam}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  let data = null
  try { data = await res.json() } catch (e) {}
  if (data && Number.isSafeInteger(data.revision)) {
    serverRevisions.set(key, data.revision)
  }
  if (!res.ok) {
    const error = new Error((data && data.error) || `State write failed (${res.status})`)
    if (res.status === 409) {
      error.revisionConflict = true
      error.sid = sid
      revisionBlocked.add(key)
      pendingWrites.delete(key)
      for (const listener of revisionConflictListeners) {
        try { listener(sid) } catch (listenerError) {
          console.error('Revision conflict listener failed:', listenerError)
        }
      }
    }
    throw error
  }
  return data
}

function flushPendingWrites() {
  flushScheduled = false
  if (pendingWrites.size === 0) return
  const writes = pendingWrites
  pendingWrites = new Map()
  for (const { sid, state } of writes.values()) {
    enqueueWrite(() => post(sid, { action: 'set_current', state }))
  }
}

export function publishInitialState(state, sid = null) {
  // A boot-time baseline publication must stay ordered with any state write
  // already queued for this browser.
  flushPendingWrites()
  return enqueueWrite(() => post(sid, { action: 'set_initial', state }))
}

export function restoreServerState(initialState, currentState, sid = null) {
  flushPendingWrites()
  return enqueueWrite(() => post(sid, {
    action: 'restore',
    initial_state: initialState,
    state: currentState,
  }))
}

export function acknowledgeHandledWrites(sid = null) {
  pendingRuns = []
  revisionBlocked.delete(revisionKey(sid))
}

export function saveState(state, sid = null) {
  const sidValue = checkedSid(sid)
  if (revisionBlocked.has(revisionKey(sidValue))) return false
  const key = storageKey(sid)
  try {
    localStorage.setItem(key, JSON.stringify(state))
  } catch (e) {
    console.error('Unable to persist browser state:', e)
  }

  // Coalesce same-tick writes per SID, then serialize all whole-state posts.
  pendingWrites.set(revisionKey(sidValue), { sid: sidValue, state })
  if (flushScheduled) return
  flushScheduled = true
  if (typeof queueMicrotask === 'function') queueMicrotask(flushPendingWrites)
  else Promise.resolve().then(flushPendingWrites)
  return true
}

/** Force all queued writes out and reject if the final acknowledged write fails. */
export async function flushState() {
  flushPendingWrites()
  const runs = [...pendingRuns]
  let results
  try {
    results = await Promise.allSettled(runs)
  } finally {
    const completed = new Set(runs)
    pendingRuns = pendingRuns.filter(run => !completed.has(run))
  }
  const failure = results.find(result => result.status === 'rejected')
  if (failure) throw failure.reason
}
