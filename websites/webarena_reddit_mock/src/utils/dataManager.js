import forums from '../data/forums.json'
import users from '../data/users.json'
import currentUserSeed from '../data/currentUser.json'
import { emptyOverlay } from './overlayShape.js'

// NOTE: submissions.json (6.2 MB), comments.json (8.4 MB) and userDirectory.json
// (652 KB) are deliberately NOT imported here. They are the frozen corpus, they
// live in `src/data/frozen.js`, and only `src/utils/overlay.js` pulls them in —
// which keeps them out of `vite.config.js`, whose `/go` handler calls
// `createInitialData()` on every request.

const BASE_KEY = 'webarena_reddit_mock_state'
const BASE_INITIAL_KEY = 'webarena_reddit_mock_initial_state'
const KEY_PREFIX = 'webarena_reddit_mock_'

export function getSessionId() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const sid = params.get('sid')
  if (sid) {
    try { sessionStorage.setItem('reddit_sid', sid) } catch (_) {}
    return sid
  }
  try { return sessionStorage.getItem('reddit_sid') || null } catch (_) { return null }
}

export function storageKey(sid) {
  return sid ? `${BASE_KEY}_${sid}` : BASE_KEY
}

export function initialKey(sid) {
  return sid ? `${BASE_INITIAL_KEY}_${sid}` : BASE_INITIAL_KEY
}

export async function fetchServerState(sid) {
  const empty = { available: false, current: null, initial: null }
  try {
    const url = sid ? `/state?sid=${encodeURIComponent(sid)}` : '/state'
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return empty
    const data = await res.json()
    if (!Object.prototype.hasOwnProperty.call(data, 'has_custom_state')) return empty
    return {
      available: true,
      current: data.has_custom_state ? data.stored_state : null,
      initial: data.has_initial_state ? data.initial_state : null,
    }
  } catch (e) {
    console.warn('Unable to read server state:', e)
    return empty
  }
}

export async function fetchCustomState(sid) {
  return (await fetchServerState(sid)).current
}

/**
 * The PERSISTED state — what is POSTed, diffed and returned by `/go`.
 *
 * Shape defined in assets/data_model.md §7 and SCHEMA.md. Everything here is
 * something an agent can create or change:
 *
 *   forums / users            small (21 KB / 11 KB) and both are mutable —
 *                             /f/create, /f/<n>/edit, /user/<n>/bio
 *   votes … messages          session keys, per-agent by definition
 *   overlay keys              the delta against the frozen corpus
 *
 * `submissions`, `comments` and `userDirectory` are NOT here. They are frozen
 * base data (`src/data/frozen.js`) merged on read by `overlay.materialize()`.
 * A harness may still inject them and they will be honoured as the base —
 * see the header of `src/utils/overlay.js`.
 *
 * NOTE: images.json is a static asset manifest, NOT mutable state — it is
 * imported directly by components so it never inflates the /go diff.
 */
export function createInitialData() {
  const votes = { submissions: {}, comments: {} }
  for (const v of currentUserSeed.submissionVotes || []) {
    votes.submissions[String(v.submission)] = v.upvote ? 1 : -1
  }
  for (const v of currentUserSeed.commentVotes || []) {
    votes.comments[String(v.comment)] = v.upvote ? 1 : -1
  }

  return {
    ...emptyOverlay(),
    currentUser: { ...currentUserSeed.user },
    forums: forums.map(f => ({ ...f })),
    users: users.map(u => ({ ...u })),
    votes,
    subscriptions: [...(currentUserSeed.subscriptions || [])],
    moderatorOf: [],
    hiddenForums: [],
    blockedUsers: [],
    notifications: [],
    messages: [],
    nextSubmissionId: 200000,
    nextCommentId: 3000000,
    nextForumId: 20000
  }
}

/**
 * `localStorage.setItem` that can never throw.
 *
 * With the frozen corpus out of state a session's two keys are ~35 KB, far
 * inside Chrome's ~5 MB per-origin quota, so persistence now actually works.
 * The guard stays because a harness may still inject a full `submissions`
 * array as the base (overlay.js) and blow the quota again: before it existed a
 * `QuotaExceededError` escaped `initializeData()`, propagated out of
 * AppProvider's boot `.then()`, and left the app stuck on "Loading…" forever
 * (AUDIT PIPELINE-002). Losing persistence is survivable; losing the page is not.
 */
function safeSetItem(key, value) {
  try { localStorage.setItem(key, value); return true }
  catch (e) {
    console.warn(`Unable to persist browser state at ${key}:`, e)
    return false
  }
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch (e) {
    console.warn(`Unable to read browser state at ${key}:`, e)
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
  return safeSetItem(initialKey(sid), JSON.stringify(state))
}

export function sameState(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return a === b
  const canonical = value => JSON.stringify(value, (_key, item) =>
    (item && typeof item === 'object' && !Array.isArray(item))
      ? Object.keys(item).sort().reduce((out, key) => {
          out[key] = item[key]
          return out
        }, {})
      : item)
  return canonical(a) === canonical(b)
}

/**
 * Drop every *other* sid's cached state before writing ours.
 *
 * Overlay-sized sessions no longer threaten the quota on their own, but a
 * browser context reused across many rollouts still accumulates a key pair per
 * sid — and a legacy full-array injection can fill the origin by itself.
 * Eviction makes sequential sids work indefinitely; the server mirror at
 * `.mock-states/<sid>.json` remains the source of truth for any evicted sid,
 * so nothing is actually lost — a reload re-hydrates it from `GET /state`.
 */
function evictForeignSessions(sid) {
  try {
    if (typeof localStorage === 'undefined') return
    const keep = new Set([storageKey(sid), initialKey(sid)])
    const doomed = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && k.startsWith(KEY_PREFIX) && !keep.has(k)) doomed.push(k)
    }
    for (const k of doomed) localStorage.removeItem(k)
  } catch (e) { /* storage unavailable */ }
}

export function mergeOverDefaults(customState) {
  return { ...createInitialData(), ...(customState || {}) }
}

export function initializeData(sid = null, customState = null) {
  const key = storageKey(sid)
  const initKey = initialKey(sid)

  evictForeignSessions(sid)

  if (customState !== null && customState !== undefined) {
    const merged = mergeOverDefaults(customState)
    const json = JSON.stringify(merged)
    safeSetItem(key, json)
    safeSetItem(initKey, json)
    return merged
  }

  const parsed = readJson(key)
  if (parsed !== null) {
    if (readJson(initKey) === null) {
      safeSetItem(initKey, JSON.stringify(parsed))
    }
    return parsed
  }

  const data = createInitialData()
  const json = JSON.stringify(data)
  safeSetItem(key, json)
  safeSetItem(initKey, json)
  return data
}

const pendingWrites = new Map()
let flushScheduled = false
let writeChain = Promise.resolve()
let pendingRuns = []

async function encodePost(payload) {
  const json = JSON.stringify(payload)
  if (typeof CompressionStream === 'undefined' || typeof Blob === 'undefined') {
    return { body: json, headers: { 'Content-Type': 'application/json' } }
  }
  try {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))
    const body = await new Response(stream).arrayBuffer()
    return { body, headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' } }
  } catch (_) {
    return { body: json, headers: { 'Content-Type': 'application/json' } }
  }
}

async function post(sid, payload) {
  const sidParam = sid ? `?sid=${encodeURIComponent(sid)}` : ''
  const { body, headers } = await encodePost(payload)
  const response = await fetch(`/post${sidParam}`, { method: 'POST', headers, body })
  if (!response.ok) {
    let detail = ''
    try { detail = (await response.json()).error || '' } catch (_) {}
    throw new Error(`State write failed (${response.status})${detail ? `: ${detail}` : ''}`)
  }
  return response.json()
}

function enqueueWrite(operation) {
  const run = writeChain.catch(() => {}).then(operation)
  writeChain = run.catch(error => {
    console.error('State persistence failed:', error)
  })
  pendingRuns.push(run)
  return run
}

function flushPendingWrite() {
  flushScheduled = false
  if (pendingWrites.size === 0) return
  const writes = [...pendingWrites.entries()]
  pendingWrites.clear()
  for (const [sid, state] of writes) {
    enqueueWrite(() => post(sid || null, { action: 'set_current', state }))
  }
}

export function saveState(state, sid = null) {
  safeSetItem(storageKey(sid), JSON.stringify(state))
  pendingWrites.set(sid || '', state)
  if (flushScheduled) return writeChain
  flushScheduled = true
  if (typeof queueMicrotask === 'function') queueMicrotask(flushPendingWrite)
  else Promise.resolve().then(flushPendingWrite)
  return writeChain
}

export function restoreServerState(initialState, currentState, sid = null) {
  return enqueueWrite(() => post(sid, {
    action: 'restore',
    initial_state: initialState,
    state: currentState,
  }))
}

export async function flushState() {
  flushPendingWrite()
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
