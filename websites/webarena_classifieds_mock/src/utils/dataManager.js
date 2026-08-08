import sessionSeed from '../data/session_seed.json'

const BASE_KEY = 'classifieds_mock_state'
const BASE_INITIAL_KEY = 'classifieds_mock_initial_state'
const SID_KEY = 'classifieds_sid'

export function getSessionId() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const sid = params.get('sid')
  if (sid) {
    try { sessionStorage.setItem(SID_KEY, sid) } catch (e) {}
    return sid
  }
  try { return sessionStorage.getItem(SID_KEY) || null } catch (e) { return null }
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
  } catch (e) {}
  return null
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

  if (customState) {
    const defaults = createInitialData()
    const merged = { ...defaults, ...customState }
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

export function saveState(state, sid = null) {
  const key = storageKey(sid)
  try { localStorage.setItem(key, JSON.stringify(state)) } catch (e) {}

  const sidParam = sid ? `?sid=${encodeURIComponent(sid)}` : ''
  fetch(`/post${sidParam}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set_current', state })
  }).catch(() => {})
}
