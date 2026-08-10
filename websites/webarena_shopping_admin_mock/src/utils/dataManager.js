/**
 * Session state for webarena_shopping_admin_mock.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THE STATE IS SPLIT (read before adding anything to createInitialData)
 * ─────────────────────────────────────────────────────────────────────────────
 * The whole state object is POSTed to /post on every mutation, stored per-sid,
 * diffed, and returned in full by /go. The hub budget for that blob is ~1-2 MB.
 * `src/data/` totals 4.7 MB, so it CANNOT all live in state.
 *
 * The split is by *mutability*, not by importance:
 *
 *   IN STATE  — entities the admin UI can create, edit or delete, and that are
 *               small enough to carry whole: reviews, customers, CMS pages and
 *               blocks, cart/catalog price rules, search terms, invoices,
 *               shipments, credit memos, order status history, config values,
 *               admin users/roles, customer groups, ratings, coupons,
 *               newsletter subscribers, wishlists.
 *
 *   OVERLAY   — entities the admin can mutate but which are far too large to
 *               copy (products 1.26 MB, orders 0.99 MB). Their base records are
 *               static imports (`staticData.js`); state carries only a sparse
 *               patch map keyed by id, plus arrays for runtime-created records.
 *               `/go`'s state_diff then contains exactly what the agent changed,
 *               which is what the evaluator wants anyway.
 *
 *   STATIC    — bulk read-only reference data that never enters state at all:
 *               product descriptions, stock items, report aggregates, the
 *               category tree, attribute metadata (sets / options / super
 *               attributes), review summaries, and the pre-flattened
 *               order/customer grid projections.
 *
 * Read merged entities through `selectors.js`. Never read `staticData.js`
 * directly in a page — you will miss the session overlay.
 */

import * as S from './staticData.js'
import { computeStateDiff, computeDeepStateDiff, verifyTrackerCoverage } from './stateTracker.js'

import customersSeed from '../data/customers.json'
import customerGroupsSeed from '../data/customerGroups.json'
import reviewsSeed from '../data/reviews.json'
import searchTermsSeed from '../data/searchTerms.json'
import invoicesSeed from '../data/invoices.json'
import invoiceItemsSeed from '../data/invoiceItems.json'
import shipmentsSeed from '../data/shipments.json'
import shipmentItemsSeed from '../data/shipmentItems.json'
import shipmentTracksSeed from '../data/shipmentTracks.json'
import creditMemosSeed from '../data/creditMemos.json'
import orderStatusHistorySeed from '../data/orderStatusHistory.json'
import orderStatusesSeed from '../data/orderStatuses.json'
import cmsPagesSeed from '../data/cmsPages.json'
import cmsBlocksSeed from '../data/cmsBlocks.json'
import cartPriceRulesSeed from '../data/cartPriceRules.json'
import catalogPriceRulesSeed from '../data/catalogPriceRules.json'
import couponsSeed from '../data/coupons.json'
import ratingsSeed from '../data/ratings.json'
import adminUsersSeed from '../data/adminUsers.json'
import adminRolesSeed from '../data/adminRoles.json'
import coreConfigSeed from '../data/coreConfig.json'
import systemConfigSeed from '../data/systemConfig.json'
import taxConfigSeed from '../data/taxConfig.json'
import newsletterSubscribersSeed from '../data/newsletterSubscribers.json'
import wishlistsSeed from '../data/wishlists.json'

const BASE_KEY = 'shopping_admin_mock_state'
const BASE_INITIAL_KEY = 'shopping_admin_mock_initial_state'
const SID_KEY = 'shopping_admin_sid'

export function getSessionId() {
  const params = new URLSearchParams(window.location.search)
  const sid = params.get('sid')
  if (sid) {
    sessionStorage.setItem(SID_KEY, sid)
    return sid
  }
  return sessionStorage.getItem(SID_KEY) || null
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
  } catch (e) { /* no server (built static host) — fall back to defaults */ }
  return null
}

/**
 * Everything the server knows about `sid`: the current state AND the /go
 * baseline. `fetchCustomState` only answers the first half, which is not
 * enough for the boot reconciliation in AppContext — it has to distinguish
 * "server has nothing at all" from "server holds a state this browser did not
 * write" (PIPELINE-009).
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
  } catch (e) { /* no server (built static host) — fall back to defaults */ }
  return empty
}

/* ------------------------------------------------------------------------ *
 * localStorage economics (BUG-100)
 *
 * The full state tree serialises to ~330 KB, and every sid writes it TWICE
 * (current + baseline). Chromium's origin quota is 5 MB, so the 7th sid in a
 * browser profile threw QuotaExceededError out of setItem — which, being
 * unhandled, killed the boot effect and left every grid rendering zero rows
 * with no error surface. Parallel RL rollouts reuse one profile across dozens
 * of sids, so this had to become unbounded, not merely bigger.
 *
 * Three layers, in order of how much they buy:
 *
 *   1. STORE ONLY THE DELTA. Virtually all of those 330 KB are seed arrays
 *      identical to createInitialData(). Persist just the keys that actually
 *      differ; rehydrate by merging back over the defaults on read. A pristine
 *      session now costs 2 bytes (`{}`) instead of 330 KB, and even a heavily
 *      mutated one costs only what was mutated.
 *   2. EVICT FOREIGN SIDS ON PRESSURE. If a write still overflows, drop every
 *      other sid's keys and retry. Safe because the server's
 *      `.mock-states/<sid>.json` is the real source of truth: a wiped sid
 *      re-adopts from the server on its next boot (AppContext case (a)) with
 *      its baseline — and therefore its state_diff — intact.
 *   3. DEGRADE, NEVER THROW. If it still will not fit, give up on the cache
 *      silently. The app keeps rendering from memory and /go keeps working.
 * ------------------------------------------------------------------------ */

function mockStorageKeys() {
  const out = []
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i)
    if (k && (k.startsWith(BASE_KEY) || k.startsWith(BASE_INITIAL_KEY))) out.push(k)
  }
  return out
}

/** Drop every sid's cache except `keepSid`'s. */
function evictForeignSessions(keepSid) {
  const keep = new Set([storageKey(keepSid), initialKey(keepSid)])
  for (const k of mockStorageKeys()) {
    if (!keep.has(k)) { try { localStorage.removeItem(k) } catch (e) { /* ignore */ } }
  }
}

/**
 * Strip every key still equal to its createInitialData() default. The reference
 * check is the fast path: createInitialData() hands out the same seed objects
 * every call, so an untouched key is `===` its default and never gets
 * stringified.
 */
function compactState(state) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return state
  const defaults = createInitialData()
  const out = {}
  for (const k of Object.keys(state)) {
    const v = state[k]
    if (k in defaults) {
      if (v === defaults[k]) continue
      if (JSON.stringify(v) === JSON.stringify(defaults[k])) continue
    }
    out[k] = v
  }
  return out
}

/** Write a state under `key`, shedding other sessions rather than throwing. */
function writeState(key, state, sid) {
  let payload
  try { payload = JSON.stringify(compactState(state)) }
  catch (e) { return false }

  try { localStorage.setItem(key, payload); return true } catch (e) { /* quota */ }

  evictForeignSessions(sid)
  try { localStorage.setItem(key, payload); return true } catch (e) { /* still too big */ }

  // Last resort: leave no half-truth behind. A missing cache entry makes the
  // next boot re-adopt from the server, which is correct; a stale one would not.
  try { localStorage.removeItem(key) } catch (e) { /* ignore */ }
  return false
}

function readJson(key) {
  try {
    const raw = localStorage.getItem(key)
    if (raw === null) return null
    // Stored compacted (see writeState). Older builds wrote the full tree;
    // merging a full tree over the defaults is a no-op, so both formats load.
    return mergeOverDefaults(JSON.parse(raw))
  } catch (e) { return null }
}

/** The state this browser last rendered for `sid`, or null. */
export function readStoredState(sid) { return readJson(storageKey(sid)) }

/** The baseline this browser recorded for `sid`, or null. */
export function readStoredInitial(sid) { return readJson(initialKey(sid)) }

/** Keep the client's notion of the baseline in step with the server's. */
export function writeStoredInitial(sid, state) {
  writeState(initialKey(sid), state, sid)
}

/** Fill a possibly-partial injected/stored state out to the full key tree. */
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

export function createInitialData() {
  return {
    /* ---- full mutable copies (small entities) ---- */
    customers: customersSeed,
    customerGroups: customerGroupsSeed,
    reviews: reviewsSeed,
    searchTerms: searchTermsSeed,
    invoices: invoicesSeed,
    invoiceItems: invoiceItemsSeed,
    shipments: shipmentsSeed,
    shipmentItems: shipmentItemsSeed,
    shipmentTracks: shipmentTracksSeed,
    creditMemos: creditMemosSeed,
    orderStatusHistory: orderStatusHistorySeed,
    orderStatuses: orderStatusesSeed,
    cmsPages: cmsPagesSeed,
    cmsBlocks: cmsBlocksSeed,
    cartPriceRules: cartPriceRulesSeed,
    catalogPriceRules: catalogPriceRulesSeed,
    coupons: couponsSeed,
    ratings: ratingsSeed,
    adminUsers: adminUsersSeed,
    adminRoles: adminRolesSeed,
    /* System > Permissions > Locked Users. Empty because the source is empty —
     * `lock_expires` is NULL for every row of `admin_user` in this deployment
     * (verified read-only against the container), so an empty grid IS parity.
     * Declared anyway so the grid is injectable and its Unlock action has
     * something real to write against (PIPELINE-021). */
    lockedAdminUsers: [],
    coreConfig: coreConfigSeed,
    /* The maintenance screens (Cache / Index Management, Notifications,
     * Integrations, Refresh Statistics) overlay the static rows in
     * `components/system/systemData.js` rather than copying them, so their
     * overlay keys are declared here — an undeclared key would be missing from
     * the baseline and its first write would look like a whole-object change.
     * See `useSystemMap` / `useSystemLog` in `components/system/RecordForm.jsx`. */
    systemConfig: {
      ...systemConfigSeed,
      // { [cache tag]: 'Enabled' | 'Disabled' }
      cacheStatus: {},
      // [{ target, at }] — Refresh and the five Flush buttons
      cacheFlushLog: [],
      // { [indexer_id]: 'UPDATE ON SAVE' | 'UPDATE BY SCHEDULE' }
      indexerModes: {},
      // { [indexer_id]: 'READY' | 'REINDEX REQUIRED' }
      indexerStatuses: {},
      // { [notification_id]: { is_read?: 1, removed?: true } }
      notificationOverrides: {},
      // { [integration_id]: 'Active' | 'Inactive' }
      integrationStatus: {},
      // ids unlocked through System > Permissions > Locked Users
      unlockedAdminUserIds: [],

      /* The `useSystemCollection` / overlay sub-keys below were previously
       * written at runtime without being declared here (PIPELINE-026). An
       * undeclared sub-key is absent from the baseline, so the first write
       * diffs `systemConfig` as a blob whose `old` simply lacks the key —
       * the evaluator sees a whole-object creation instead of "this collection
       * gained a row". Declaring them empty makes every one of these actions
       * diff as {old: [], new: [row]}. `stateTracker.verifyTrackerCoverage()`
       * is the regression guard: it fails if a tracked path is not declared.
       *
       * Empty rather than seeded on purpose — each is an OVERLAY over static
       * rows in `components/system/systemData.js` / `content/contentData.js`,
       * and its readers do `state?.systemConfig?.[key] || []`. */
      // Content > Widgets — [{ instance_id, ... }]
      widgets: [],
      // Content > Design > Schedule — [{ design_change_id, ... }]
      design_changes: [],
      // Marketing > SEO & Search > Search Synonyms — [{ group_id, ... }]
      synonyms: [],
      // Marketing > Newsletter Templates — [{ template_id, ... }]
      newsletter_templates: [],
      // Marketing > URL Rewrites: rows added / edited / deleted over the
      // static 225-row `urlRewrites.json` corpus
      url_rewrites: [],
      url_rewrite_edits: {},
      url_rewrite_deleted: [],
      // Reports > Refresh Statistics — { [report id]: last-refreshed stamp }
      report_statistics: {},
      // System > Integrations — [{ integration_id, ... }]
      integrations: [],
      // System > Site Map — [{ sitemap_id, ... }]
      sitemaps: [],
      // System > Email Templates — [{ template_id, ... }]
      email_templates: [],
      // Stores > Currency Symbols — { [currency code]: symbol }
      currency_symbols: {},
    },
    // Dashboard > Reload Data — { lifetime_refreshed_at, lifetime_refresh_count }.
    // Declared here so the first refresh diffs as {old, new} like every other key
    // instead of {new} only (PIPELINE-024).
    dashboardStatistics: {},
    taxConfig: taxConfigSeed,
    newsletterSubscribers: newsletterSubscribersSeed,
    wishlists: wishlistsSeed,

    /* ---- sparse overlays over the static bulk corpora ---- */
    // { [entity_id]: Partial<Order> } — status/state and any edited field
    orderOverrides: {},
    // { [entity_id]: Comment[] } — the full comment list once an order gains one
    orderComments: {},
    // { [address_id]: Partial<Address> } — order address edits
    orderAddressOverrides: {},
    // orders created through Sales > Orders > Create New Order (PIPELINE-008).
    // Concatenated over the static corpus by getOrders/getOrder/getOrderGridRows,
    // exactly as newProducts is over the product corpus.
    newOrders: [],
    // { [entity_id]: Partial<Product> }
    productOverrides: {},
    // { [entity_id]: string } — edited description HTML (base lives in productDescriptions.json)
    productDescriptionOverrides: {},
    // products created through Catalog > Add Product
    newProducts: [],
    // ids removed by the Products grid "Delete" mass action
    deletedProductIds: [],
    // { [entity_id]: Partial<Category> }
    categoryOverrides: {},
    // categories created through Catalog > Categories > Add Root/Subcategory
    newCategories: [],
    // ids removed by Catalog > Categories > Delete
    deletedCategoryIds: [],
    // { [attribute_id]: Partial<Attribute> } — Stores > Attributes > Product edits
    productAttributeOverrides: {},
    // attributes created through Stores > Attributes > Product > Add New Attribute
    newProductAttributes: [],
    // { [attribute_set_id]: Partial<AttributeSet> } — Stores > Attribute Set edits
    attributeSetOverrides: {},
    // sets created through Stores > Attribute Set > Add Attribute Set
    newAttributeSets: [],
    // review ids deleted through Marketing > Reviews
    deletedReviewIds: [],

    /* ---- grid bookmarks ("Default View") the admin can save per listing ---- */
    gridBookmarks: {},
  }
}

export function initializeData(sid = null, customState = null) {
  const key = storageKey(sid)
  const initKey = initialKey(sid)

  if (customState) {
    const defaults = createInitialData()
    const merged = { ...defaults, ...customState }
    writeState(key, merged, sid)
    writeState(initKey, merged, sid)
    return merged
  }

  // Forward-compatibility: readJson merges over defaults, so a state written by
  // an older build gains keys added since without clobbering anything.
  const stored = readJson(key)
  if (stored) {
    if (localStorage.getItem(initKey) === null) writeState(initKey, stored, sid)
    return stored
  }

  const data = createInitialData()
  writeState(key, data, sid)
  writeState(initKey, data, sid)
  return data
}

/**
 * Publish the merged boot state as /go's baseline.
 *
 * A task may inject a *partial* state. The plugin writes that partial object to
 * both the current and the initial state file, so unless the app corrects the
 * baseline, /go diffs the full merged tree against the one-key partial and
 * reports every defaulted key as a phantom mutation (PIPELINE-002).
 *
 * Posted on EVERY boot, not just the first one, because the server's state
 * files can vanish under a live session (`.mock-states/` is gitignored, so it
 * is absent on a fresh deploy) and nothing else would ever restore them. This
 * is safe precisely because the plugin refuses the write whenever the stored
 * current state exists and differs from the stored baseline: a reload of an
 * already-driven sid can never overwrite a real diff, while a session whose
 * baseline file is simply missing is repaired.
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
  // localStorage is only a render cache — the POST below is what /go reads, so
  // it happens whether or not the cache write fits (BUG-100).
  writeState(storageKey(sid), state, sid)
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

/** Re-exported so callers do not have to know where the bulk corpora live. */
export { S as staticData }

/**
 * The client-side diff, re-exported from here so no page has to reimplement it.
 * `computeStateDiff` is server-parity (see stateTracker.js); use it for anything
 * that must agree with `GET /go`. `computeDeepStateDiff` is the path-granular
 * variant for inspection only.
 */
export { computeStateDiff, computeDeepStateDiff }

/**
 * Diff this session against its own recorded baseline, exactly as `/go` would.
 * Handy from the console (`window.__mockStateDiff()`, wired below) and used by
 * the boot-time coverage assertion.
 */
export function stateDiffForSession(sid = null, current = null) {
  const initial = readStoredInitial(sid)
  const now = current || readStoredState(sid)
  return computeStateDiff(initial, now)
}

/**
 * Boot-time assertion that every path in stateTracker's Observable State
 * Changes table is declared in `createInitialData()`. An undeclared path diffs
 * as `{new}` with no `old` member on its first write, which reads to an
 * evaluator as "this object was created" rather than "this field changed" —
 * PIPELINE-024 and PIPELINE-026 were both instances of it.
 *
 * Warn-only, deliberately: a schema drift must never stop the app from
 * rendering. It surfaces in the console and, in dev, is what the audit agent
 * greps for.
 */
export function assertTrackerCoverage() {
  const result = verifyTrackerCoverage(createInitialData())
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.warn(
      '[stateTracker] Observable State Changes table names state paths that ' +
      'createInitialData() does not declare — their first write will diff ' +
      'without an `old` member:',
      { undeclaredRoots: result.undeclaredRoots, undeclaredSubPaths: result.undeclaredSubPaths }
    )
  }
  return result
}

if (typeof window !== 'undefined') {
  // Console handles for manual verification of the /go contract from the page
  // itself, without having to shell out to curl.
  window.__mockStateDiff = stateDiffForSession
  window.__mockTrackerCoverage = () => verifyTrackerCoverage(createInitialData())
}
