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
  catch (e) { return false }
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
