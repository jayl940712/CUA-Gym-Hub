/**
 * Overlay resolution — the SINGLE place where the frozen corpus and the agent's
 * mutations are merged, and the single place they are taken apart again.
 *
 * `AppProvider` holds two objects:
 *
 *   core    the PERSISTED state. ~2 KB cold. Holds only what an agent can
 *           create or change: the 36 overlay keys plus currentUser / repo / ui /
 *           nextIds / snippets. This is what goes to localStorage,
 *           `POST set_current`, and `/go`.
 *   state   `materialize(core)` — core plus the twelve fully merged collections
 *           (`users projects groups issues mergeRequests notes labels
 *           milestones members todos stars follows`). Never persisted.
 *
 * Because there is exactly ONE materialization point, no view can disagree with
 * another about whether a record exists. GitLab has many views over the same
 * records — the project issue list, the issue detail page, the global dashboard
 * (`/dashboard/issues`, `/dashboard/merge_requests`, `/dashboard/milestones`),
 * the user profile, `/dashboard/todos`, `/search`, the activity feeds, the
 * boards and the milestone burndown — and every one of them reads
 * `useApp().state`, so they all see the same merged arrays. That was the
 * specific failure mode this design risked.
 *
 * ---------------------------------------------------------------------------
 * WHY THE WRITE SIDE IS A RECONCILER AND NOT A SET OF OVERLAY VERBS
 * ---------------------------------------------------------------------------
 * `webarena_reddit_mock` gave each mutation an explicit overlay verb
 * (`addSubmission`, `patchComment`, `removeSubmission`). That works when there
 * are three mutation shapes. GitLab has 79 write sites across 33 direct
 * `setState(prev => …)` reducers, the four generic helpers in `AppContext`
 * (`appendTo` / `updateIn` / `removeFrom` / `setUi`) and six reducers in
 * `src/components/create/mutations.js` — issues, MRs, notes, members, labels,
 * milestones, projects, groups, stars, follows and todos are all created,
 * field-edited AND deleted. Rewriting all of them to overlay verbs would have
 * been 79 chances to miss one, and a missed one is invisible: the UI still
 * renders, only persistence and `/go` are wrong.
 *
 * So the write side keeps the existing reducers exactly as they are — they go
 * on receiving the fully merged `state` and returning a fully merged `state` —
 * and `dematerialize()` derives the delta from the result. Every reducer in
 * this app is immutable (`{...prev, issues: prev.issues.map(…)}`), so an
 * untouched collection comes back REFERENCE-IDENTICAL and is skipped in O(1);
 * only the collection a reducer actually rewrote is scanned. One note added to
 * the 1 599-note corpus costs one 1 599-element pass, ~0.3 ms.
 *
 * The invariant that makes this sound is `dematerialize(core, materialize(core))
 * === core`-equivalent: reconciling an unchanged materialized state produces an
 * empty delta. `assets/dumps/test_overlay.py` §5 asserts it directly.
 *
 * ---------------------------------------------------------------------------
 * BACKWARD-COMPATIBLE INJECTION
 * ---------------------------------------------------------------------------
 * `dataManager.initializeData()` still merges an injected task state shallowly,
 * so a harness POSTing a full `issues` array puts that array on `core`.
 * `baseArray()` prefers it, so the injected array becomes the base verbatim —
 * same records, same order, same render as before this refactor — and the
 * overlay applies on top of it. The lighter path is to inject only `newIssues` /
 * `issueEdits` / `deletedIssues` and let the frozen corpus stand, which is what
 * task setup should do now: adding one issue costs one record, not 613.
 *
 * Both paths are proved to render identically in `assets/dumps/test_overlay.py`.
 */
import { FROZEN } from '../data/frozen.js'
import { lazyNotes, bodyFor, dataVersion, EMPTY } from '../data/lazy.js'
import {
  OVERLAY_COLLECTIONS, OVERLAY_KEYS, OVERLAY_COLLECTION_NAMES,
  recordKey, emptyOverlay, toCore, SEED_NEXT_IDS, ID_KIND_COLLECTION,
} from './overlayShape.js'

// Re-exported so a reader of overlay.js gets the whole vocabulary from one
// place; `toCore` itself lives in the import-free module because
// `dataManager.initializeData()` needs it and must not pull in the corpus.
export {
  emptyOverlay, toCore, OVERLAY_COLLECTIONS, OVERLAY_KEYS, OVERLAY_COLLECTION_NAMES, recordKey,
}

const SPEC_BY_NAME = new Map(OVERLAY_COLLECTIONS.map(c => [c.name, c]))

/**
 * The base array for `name`: the harness's injected array when there is one,
 * otherwise the frozen corpus.
 *
 * `notes` is the one collection whose base is LAZY — it is the concatenation of
 * the per-project chunks loaded so far (src/data/lazy.js). That array is
 * memoised on the chunk version, so it is reference-stable between loads and
 * `mergeCollection`'s inert fast path and `dematerialize`'s identity skip both
 * keep working. An injected `notes` array still wins, exactly as before, so a
 * harness fixture is unaffected by the split.
 *
 * The empty fallback is a shared frozen constant rather than a fresh `[]`: a new
 * array on every call would make an inert collection look changed on every
 * render.
 */
export function baseArray(core, name) {
  const injected = core && core[name]
  if (Array.isArray(injected)) return injected
  if (name === 'notes') return lazyNotes()
  return FROZEN[name] || EMPTY
}

/**
 * `key -> record` for a base array, cached on the array's identity.
 *
 * The frozen arrays are module constants, so their index is built once for the
 * page's lifetime. Without this, resolving one issue would be a linear scan of
 * 613 records on every render, and reconciling one note a 1 599-record scan
 * plus a fresh 1 599-entry Map on every keystroke-driven write.
 */
const indexCache = new WeakMap()
export function indexByKey(arr, spec) {
  // Keyed by array AND collection: `recordKey` differs per spec (`id` vs the
  // stars/follows composite), so caching on the array alone would hand back an
  // index built under the wrong key function if two collections ever shared an
  // array object — which a task fixture reusing one parsed value could do.
  let bySpec = indexCache.get(arr)
  if (!bySpec) { bySpec = new Map(); indexCache.set(arr, bySpec) }
  let m = bySpec.get(spec.name)
  if (!m) {
    m = new Map()
    for (const r of arr) m.set(recordKey(spec, r), r)
    bySpec.set(spec.name, m)
  }
  return m
}

/* ------------------------------------------------------------------ *
 * Lazy bodies                                                         *
 * ------------------------------------------------------------------ */

/**
 * The eager base record for an issue / merge request carries every field EXCEPT
 * `description` (src/data/frozen.js); the description lives in the project's
 * lazy chunk. This splices it back on, and it is the ONLY place that does — so
 * a record is either whole or consistently body-less, never half of each.
 *
 * `hasOwnProperty`, not truthiness, decides. A record the UI produced always has
 * its own `description` key (`{...issue, state: 'closed'}` carries it forward,
 * and the edit forms write it explicitly), so an agent who empties a description
 * gets `''` and NOT the seed body resurrected on the next render. Only the index
 * records — which never had the key — get spliced.
 *
 * MEMOISED, and that is load-bearing rather than a micro-optimisation.
 * `reconcileCollection()` calls this on the base record and compares the result
 * with what the reducer returned; a fresh object each time would make all 3 926
 * issues compare unequal on every write, so every one of them would be
 * JSON.stringify'd and tombstoned into `issueEdits`. Returning the SAME object
 * `materialize()` handed out keeps that comparison a reference check.
 *
 * The cache is dropped whenever a chunk arrives, because a body that was
 * `undefined` a moment ago may now be present.
 */
let bodyCache = new WeakMap()
let bodyCacheVersion = -1

function withBody(spec, rec) {
  if (!spec.body || !rec) return rec
  if (Object.prototype.hasOwnProperty.call(rec, spec.body)) return rec

  const v = dataVersion()
  if (bodyCacheVersion !== v) { bodyCache = new WeakMap(); bodyCacheVersion = v }
  const hit = bodyCache.get(rec)
  if (hit !== undefined) return hit

  const body = bodyFor(spec.name, rec.project_id, String(rec.id))
  // No body loaded yet: hand back the record ITSELF, so the identity check above
  // still holds and no wrapper object is allocated per render on the dashboard.
  const out = body === undefined ? rec : { ...rec, [spec.body]: body }
  bodyCache.set(rec, out)
  return out
}

/**
 * `withBody` over a whole base array, memoised on (array identity, chunk version).
 *
 * The cold case — no chunk loaded, so no record gains a body — returns the input
 * array ITSELF. That matters: `mergeCollection` hands this straight back for an
 * inert collection and `dematerialize` skips a collection whose array came back
 * reference-identical, so a fresh array here would defeat both on every render
 * of every route, for the two largest collections in the app.
 */
const bodiedArrays = new WeakMap()

function withBodies(spec, arr) {
  if (!spec.body) return arr
  const v = dataVersion()
  let bySpec = bodiedArrays.get(arr)
  if (!bySpec) { bySpec = new Map(); bodiedArrays.set(arr, bySpec) }
  const hit = bySpec.get(spec.name)
  if (hit && hit.version === v) return hit.out

  let changed = false
  const mapped = new Array(arr.length)
  for (let i = 0; i < arr.length; i += 1) {
    const next = withBody(spec, arr[i])
    if (next !== arr[i]) changed = true
    mapped[i] = next
  }
  const out = changed ? mapped : arr
  bySpec.set(spec.name, { version: v, out })
  return out
}

function isEmpty(v) {
  if (Array.isArray(v)) return v.length === 0
  if (v && typeof v === 'object') return Object.keys(v).length === 0
  return true
}

/** True when nothing in `core` changes `spec`'s base array — the cold case. */
function inert(core, spec) {
  return isEmpty(core[spec.created]) && isEmpty(core[spec.edits]) && isEmpty(core[spec.deleted])
}

/* ------------------------------------------------------------------ *
 * Read side                                                           *
 * ------------------------------------------------------------------ */

function mergeCollection(core, spec) {
  const base = baseArray(core, spec.name)
  // Reference-identical when inert, which is what keeps `state.notes` stable
  // across renders on a session that never touched a note. `spec.body` breaks
  // that identity only for the two collections that HAVE a lazy body, and only
  // once their chunk has arrived — `withBody` memoises, so the mapped array is
  // rebuilt on a chunk load and not on every render.
  if (inert(core, spec)) return withBodies(spec, base)

  const created = core[spec.created] || []
  const edits = core[spec.edits] || {}
  const deleted = new Set((core[spec.deleted] || []).map(String))
  const hasEdits = !isEmpty(edits)
  const out = []

  for (const raw of base) {
    const k = recordKey(spec, raw)
    if (deleted.has(k)) continue
    out.push(hasEdits && Object.prototype.hasOwnProperty.call(edits, k)
      ? edits[k]
      : withBody(spec, raw))
  }
  // Created records are appended, never interleaved. Every GitLab list view
  // sorts explicitly (see `sortProjects` / `sortMilestones` / `sortIssuables`
  // in src/pages/hooks.js), so base-then-created is not an ordering the UI can
  // observe — but a created record CAN also be edited or deleted, so the same
  // three rules apply to it.
  for (const raw of created) {
    const k = recordKey(spec, raw)
    if (deleted.has(k)) continue
    out.push(hasEdits && Object.prototype.hasOwnProperty.call(edits, k) ? edits[k] : raw)
  }
  return out
}

/**
 * core -> the object the React tree reads. Adds the twelve merged collections;
 * leaves every other key of `core` untouched and in place.
 */
export function materialize(core) {
  if (!core) return core
  const out = { ...core }
  for (const spec of OVERLAY_COLLECTIONS) out[spec.name] = mergeCollection(core, spec)
  return out
}

/* ------------------------------------------------------------------ *
 * Write side                                                          *
 * ------------------------------------------------------------------ */

/**
 * Records that are reference-different but value-identical produce no delta.
 *
 * `updateIn('issues', p, patch)` maps the whole array and only rebuilds the
 * matched row, so this fires rarely; it exists so that a reducer which rebuilds
 * rows defensively (`prev.users.map(u => ({...u}))`) does not tombstone 1 133
 * users into `userEdits` and undo the whole point of the refactor.
 */
function sameRecord(a, b) {
  if (a === b) return true
  if (!a || !b) return false
  return JSON.stringify(a) === JSON.stringify(b)
}

/**
 * Derive the delta for one collection.
 * @returns `{created, edits, deleted}` — always fresh arrays/objects.
 */
function reconcileCollection(core, spec, next) {
  const base = baseArray(core, spec.name)
  const baseIdx = indexByKey(base, spec)
  const created = []
  const edits = {}
  const seen = new Set()

  for (const rec of next) {
    const k = recordKey(spec, rec)
    seen.add(k)
    const from = baseIdx.get(k) === undefined ? undefined : withBody(spec, baseIdx.get(k))
    if (from === undefined) {
      // Not in the base at all: agent-created. An edit to an agent-created
      // record is stored in place here, so `newIssues` always carries the
      // record's CURRENT value and `issueEdits` only ever holds frozen ones.
      created.push(rec)
      continue
    }
    if (!sameRecord(from, rec)) edits[k] = rec
  }

  const deleted = []
  for (const k of baseIdx.keys()) if (!seen.has(k)) deleted.push(k)

  return { created, edits, deleted }
}

/**
 * materialized state -> core.
 *
 * @param core       the current core (supplies the base arrays)
 * @param prevState  the materialized state the reducer was handed, or null.
 *                   Used only to skip untouched collections by identity.
 * @param nextState  what the reducer returned.
 */
export function dematerialize(core, prevState, nextState) {
  if (!nextState) return core
  const out = { ...nextState }

  for (const spec of OVERLAY_COLLECTIONS) {
    const next = nextState[spec.name]

    // The merged array is never persisted. A harness-injected base array on
    // `core` is, and stays exactly as injected — the delta rides on top of it.
    if (Array.isArray(core && core[spec.name])) out[spec.name] = core[spec.name]
    else delete out[spec.name]

    if (!Array.isArray(next)) {
      // A reducer that dropped the key entirely: keep the existing delta.
      out[spec.created] = (core && core[spec.created]) || []
      out[spec.edits] = (core && core[spec.edits]) || {}
      out[spec.deleted] = (core && core[spec.deleted]) || []
      continue
    }

    // Untouched by this reducer — O(1), and the common case for 11 of 12.
    if (prevState && next === prevState[spec.name]) {
      out[spec.created] = (core && core[spec.created]) || []
      out[spec.edits] = (core && core[spec.edits]) || {}
      out[spec.deleted] = (core && core[spec.deleted]) || []
      continue
    }

    const d = reconcileCollection(core || {}, spec, next)
    out[spec.created] = d.created
    out[spec.edits] = d.edits
    out[spec.deleted] = d.deleted
  }

  return out
}

/* ------------------------------------------------------------------ *
 * DEV guard for the hard-coded id floors                              *
 * ------------------------------------------------------------------ */

/**
 * `SEED_NEXT_IDS` in overlayShape.js is a literal so that `vite.config.js` can
 * import `createInitialData()` without the corpus. This module DOES have the
 * corpus, so it is the right place to prove the literals are still above it.
 * Silent drift is the exact defect SCHEMA.md records: a counter inside the seed
 * range mints a duplicate id and `/go` reports a creation as an edit.
 */
export function checkSeedNextIds() {
  const bad = []
  for (const [kind, name] of Object.entries(ID_KIND_COLLECTION)) {
    // `notes` is lazy, so the eager corpus cannot see its real maximum and a
    // check against the chunks loaded so far would pass vacuously on a cold
    // page. `assets/dumps/check_next_ids.py` reads notes.json off disk and is
    // the authority for that one counter.
    if (name === 'notes') continue
    const rows = FROZEN[name] || []
    let max = 0
    for (const r of rows) {
      const v = r && r.id
      if (typeof v === 'number' && Number.isFinite(v) && v > max) max = v
    }
    if (SEED_NEXT_IDS[kind] <= max) bad.push(`${kind}: literal ${SEED_NEXT_IDS[kind]} <= max seed id ${max}`)
  }
  return bad
}

if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV) {
  const bad = checkSeedNextIds()
  if (bad.length) {
    // eslint-disable-next-line no-console
    console.error('SEED_NEXT_IDS in src/utils/overlayShape.js has drifted below the seed:\n  '
      + bad.join('\n  ') + '\nRun: python3 assets/dumps/check_next_ids.py')
  }
}

export { SPEC_BY_NAME }
