import customer from '../data/customer.json'
import cart from '../data/cart.json'
import orders from '../data/orders.json'
import wishlist from '../data/wishlist.json'

const BASE_KEY = 'webarena_shopping_mock_state'
const BASE_INITIAL_KEY = 'webarena_shopping_mock_initial_state'

export function getSessionId() {
  const params = new URLSearchParams(window.location.search)
  const sid = params.get('sid')
  if (sid) {
    sessionStorage.setItem('webarena_shopping_sid', sid)
    return sid
  }
  return sessionStorage.getItem('webarena_shopping_sid') || null
}

export function storageKey(sid) {
  return sid ? `${BASE_KEY}_${sid}` : BASE_KEY
}

export function initialKey(sid) {
  return sid ? `${BASE_INITIAL_KEY}_${sid}` : BASE_INITIAL_KEY
}

export async function fetchCustomState(sid) {
  return (await fetchServerState(sid)).current
}

/**
 * Read what the SERVER believes about this sid.
 *
 * Returns `{current, initial}`, either of which is `null` when the server has
 * no such file. That distinction is load-bearing at boot:
 *
 *   - `current === null` → the server has no record of this sid at all
 *     (`.mock-states/` is gitignored, so it is absent on every fresh deploy).
 *     If the browser still holds localStorage for the sid, the client must
 *     re-publish, or `/go` silently reports the DEFAULT tree with an empty
 *     `state_diff` while the UI shows a mutated one. (PIPELINE-002)
 *   - `current !== null` and it differs from localStorage → the state was
 *     written by something other than this browser: a task inject
 *     (`{"action":"set"}`), a `{"action":"reset"}`, or another profile driving
 *     the same sid. The server is the authority for `/go`, so it wins.
 *     (PIPELINE-001, PIPELINE-P1-a)
 *
 * Degrades safely: under `CUA_GYM_HARDENED=1` the shared secure plugin serves
 * `/state` with a different shape (the raw state object, no `has_custom_state`),
 * so both fields come back `null` and boot behaves exactly as it did before.
 */
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
      current: data.has_custom_state && data.stored_state ? data.stored_state : null,
      initial: data.has_initial_state && data.initial_state ? data.initial_state : null,
    }
  } catch (e) {}
  return empty
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? null : JSON.parse(raw)
  } catch (e) { return null }
}

/** The state this browser last rendered for `sid`, or null. */
export function readStoredState(sid) { return readJson(storageKey(sid)) }

/** The baseline this browser recorded for `sid`, or null. */
export function readStoredInitial(sid) { return readJson(initialKey(sid)) }

/** Keep the client's notion of the baseline in step with the server's. */
export function writeStoredInitial(sid, state) {
  localStorage.setItem(initialKey(sid), JSON.stringify(state))
}

/** Fill a possibly-partial injected/stored state out to the full 15-key tree. */
export function mergeOverDefaults(partial) {
  return { ...createInitialData(), ...(partial || {}) }
}

/**
 * Key-order-independent deep equality. The two sides of every comparison here
 * have been through a JSON round trip on different machines (localStorage vs.
 * the state file), so a raw string compare would be fragile.
 */
export function sameState(a, b) {
  if (a === null || a === undefined || b === null || b === undefined) return a === b
  const canonical = v => JSON.stringify(v, (_k, val) =>
    (val && typeof val === 'object' && !Array.isArray(val))
      ? Object.keys(val).sort().reduce((o, k) => { o[k] = val[k]; return o }, {})
      : val)
  return canonical(a) === canonical(b)
}

/**
 * Only MUTABLE entities live in session state. The catalog (products,
 * categories, reviews, options, descriptions, listings) is static reference
 * data imported directly by components — it must never enter the state tree,
 * because /go POSTs, diffs and returns the whole state on every call.
 * See assets/data_model.md §14.
 */
export function createInitialData() {
  return {
    customer: {
      id: customer.id,
      email: customer.email,
      firstname: customer.firstname,
      lastname: customer.lastname,
      dob: customer.dob,
      gender: customer.gender,
      groupId: customer.groupId,
      createdAt: customer.createdAt,
      defaultBilling: customer.defaultBilling,
      defaultShipping: customer.defaultShipping,
      // "Allow remote shopping assistance" on /customer/account/edit/.
      // Magento stores it in login_as_customer_assistance_allowed, not in the
      // customer_entity row the seed was dumped from, so it is defaulted here
      // rather than in customer.json. `false` is what the source renders:
      // assets/html/account-edit.html ships
      // <input type="checkbox" name="assistance_allowed_checkbox" ...> with no
      // `checked` attribute and a paired <input type="hidden"
      // name="assistance_allowed" value=""/> for Emma.
      assistanceAllowed: false,
    },
    addresses: JSON.parse(JSON.stringify(customer.addresses)),
    cart: {
      quoteId: cart.quoteId,
      items: JSON.parse(JSON.stringify(cart.items)),
    },
    orders: JSON.parse(JSON.stringify(orders)),
    wishlist: { items: JSON.parse(JSON.stringify(wishlist.items)) },
    compareList: { items: [] },
    myReviews: [],
    contactSubmissions: [],
    newsletterSubscribed: customer.newsletterSubscribed,
    nextOrderIncrementId: 190,
    nextOrderEntityId: 190,
    nextReviewId: 400000,
    nextAddressId: 27,
    // The seeded cart carries the container's REAL quote_item ids — 554, 555,
    // 556 on quote 255 (`SELECT item_id FROM quote_item WHERE quote_id=255`,
    // and assets/html/cart.html's `name="cart[554][qty]"`). They are
    // URL-addressable via /checkout/cart/configure/id/:itemId/ and
    // /checkout/cart/delete/id/:itemId/, so the allocator for newly added
    // lines must start ABOVE the seeded maximum or a fresh line would shadow a
    // seeded one and both routes would resolve to the wrong item. 557 is what
    // Magento's auto-increment would hand out next. Derived from the seed
    // rather than hard-coded so it cannot drift if the cart seed is rebuilt.
    nextCartItemId: cart.items.reduce((m, i) => Math.max(m, i.itemId), 0) + 1,
    nextWishlistItemId: 1,
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

/**
 * Publish the merged boot state as /go's baseline.
 *
 * A task may inject a *partial* state (SCHEMA.md §2.2). The plugin writes that
 * partial object to both the current and the initial state file, so unless the
 * app corrects the baseline, /go diffs the full merged tree against the
 * one-key partial and reports every defaulted key as a phantom mutation.
 *
 * Posted on EVERY boot, not just the first one, because the server's state
 * files can vanish under a live session (`.mock-states/` is gitignored, so it
 * is absent on a fresh deploy) and nothing else would ever restore them —
 * PIPELINE-002. This is safe precisely because the plugin refuses the write
 * whenever the stored current state exists and differs from the stored
 * baseline: a reload of an already-driven sid can never overwrite a real diff,
 * while a session whose baseline file is simply missing is repaired.
 */
export function publishInitialState(state, sid = null) {
  return enqueuePost(sid, { action: 'set_initial', state })
}

/*
 * Whole-state writes must never overlap. React can schedule several mutations
 * in one event, and an older set_current response arriving last would otherwise
 * overwrite the newest state on the server. Writes from the same tick coalesce
 * to the latest snapshot; writes across ticks are serialized per sid.
 */
const pendingWrite = new Map()
let writeChain = Promise.resolve()
let flushScheduled = false
let pendingRuns = []

function sidKey(sid) {
  return sid || ''
}

async function post(sid, payload) {
  const sidParam = sid ? `?sid=${encodeURIComponent(sid)}` : ''
  const response = await fetch(`/post${sidParam}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  let data = null
  try { data = await response.json() } catch (_) {}
  if (!response.ok) {
    const detail = data && data.error ? `: ${data.error}` : ''
    throw new Error(`State write failed (${response.status})${detail}`)
  }
  return data || {}
}

function enqueuePost(sid, payload) {
  // The rejection branch keeps later writes moving after a failed request;
  // this request's own rejection remains visible to flushState() and callers.
  const run = writeChain.then(
    () => post(sid, payload),
    () => post(sid, payload),
  )
  writeChain = run.catch(error => {
    console.error('[state persistence]', error)
  })
  pendingRuns.push(run)
  return run
}

function flushPendingWrites() {
  flushScheduled = false
  const writes = [...pendingWrite.values()]
  pendingWrite.clear()
  for (const { sid, state } of writes) {
    enqueuePost(sid, { action: 'set_current', state })
  }
}

export function saveState(state, sid = null) {
  try {
    localStorage.setItem(storageKey(sid), JSON.stringify(state))
  } catch (error) {
    // localStorage is only a render cache; the authoritative server write must
    // still be queued even when the cache is unavailable or over quota.
    console.error('[state persistence] Browser cache write failed', error)
  }
  pendingWrite.set(sidKey(sid), { sid, state })
  if (flushScheduled) return
  flushScheduled = true
  if (typeof queueMicrotask === 'function') queueMicrotask(flushPendingWrites)
  else Promise.resolve().then(flushPendingWrites)
}

export function restoreServerState(initialState, currentState, sid = null) {
  return enqueuePost(sid, {
    action: 'restore',
    initial_state: initialState,
    state: currentState,
  })
}

/** Force queued writes to start and resolve once every sid has persisted. */
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
