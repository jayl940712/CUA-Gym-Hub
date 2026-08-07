import forums from '../data/forums.json'
import submissions from '../data/submissions.json'
import comments from '../data/comments.json'
import users from '../data/users.json'
import userDirectory from '../data/userDirectory.json'
import currentUserSeed from '../data/currentUser.json'

const BASE_KEY = 'webarena_reddit_mock_state'
const BASE_INITIAL_KEY = 'webarena_reddit_mock_initial_state'
const KEY_PREFIX = 'webarena_reddit_mock_'

export function getSessionId() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const sid = params.get('sid')
  if (sid) {
    sessionStorage.setItem('reddit_sid', sid)
    return sid
  }
  return sessionStorage.getItem('reddit_sid') || null
}

export function storageKey(sid) {
  return sid ? `${BASE_KEY}_${sid}` : BASE_KEY
}

export function initialKey(sid) {
  return sid ? `${BASE_INITIAL_KEY}_${sid}` : BASE_INITIAL_KEY
}

export async function fetchCustomState(sid) {
  try {
    const url = sid ? `/state?sid=${encodeURIComponent(sid)}` : '/state'
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) return null
    const data = await res.json()
    if (data.has_custom_state && data.stored_state) return data.stored_state
  } catch (e) { /* offline / built preview without the plugin */ }
  return null
}

// Shape defined in assets/data_model.md §7.
// NOTE: images.json is a static asset manifest, NOT mutable state — it is
// imported directly by components so it never inflates the /go diff.
export function createInitialData() {
  const votes = { submissions: {}, comments: {} }
  for (const v of currentUserSeed.submissionVotes || []) {
    votes.submissions[String(v.submission)] = v.upvote ? 1 : -1
  }
  for (const v of currentUserSeed.commentVotes || []) {
    votes.comments[String(v.comment)] = v.upvote ? 1 : -1
  }

  return {
    currentUser: { ...currentUserSeed.user },
    forums: forums.map(f => ({ ...f })),
    submissions: submissions.map(s => ({ ...s })),
    comments: comments.map(c => ({ ...c })),
    users: users.map(u => ({ ...u })),
    userDirectory: { ...userDirectory },
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
 * The serialized seed is ~2.2 MB per key and `initializeData()` writes two of
 * them, so one sid consumes ~4.4 MB of Chrome's ~5 MB per-origin quota. Before
 * this guard a `QuotaExceededError` escaped `initializeData()`, propagated out
 * of AppProvider's boot `.then()`, and left the app stuck on "Loading…"
 * forever (AUDIT PIPELINE-002). Losing persistence is survivable; losing the
 * page is not.
 */
function safeSetItem(key, value) {
  try { localStorage.setItem(key, value); return true }
  catch (e) { return false }
}

/**
 * Drop every *other* sid's cached state before writing ours.
 *
 * One sid nearly fills the origin quota, so a browser context reused across
 * rollouts (the common RL harness shape) could otherwise never boot a second
 * sid. Eviction makes sequential sids work indefinitely; the server mirror at
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

export function initializeData(sid = null, customState = null) {
  const key = storageKey(sid)
  const initKey = initialKey(sid)

  evictForeignSessions(sid)

  if (customState) {
    const defaults = createInitialData()
    const merged = { ...defaults, ...customState }
    const json = JSON.stringify(merged)
    safeSetItem(key, json)
    safeSetItem(initKey, json)
    return merged
  }

  const stored = localStorage.getItem(key)
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      if (!localStorage.getItem(initKey)) {
        safeSetItem(initKey, stored)
      }
      return parsed
    } catch (e) { /* corrupt — fall through to defaults */ }
  }

  const data = createInitialData()
  const json = JSON.stringify(data)
  safeSetItem(key, json)
  safeSetItem(initKey, json)
  return data
}

export function saveState(state, sid = null) {
  const key = storageKey(sid)
  try { localStorage.setItem(key, JSON.stringify(state)) } catch (e) { /* quota */ }

  const sidParam = sid ? `?sid=${encodeURIComponent(sid)}` : ''
  fetch(`/post${sidParam}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set_current', state })
  }).catch(() => {})
}
