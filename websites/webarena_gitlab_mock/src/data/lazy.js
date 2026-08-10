/**
 * Per-project lazy loading of the gitlab corpus.
 *
 * ---------------------------------------------------------------------------
 * THE PROBLEM THIS SOLVES
 * ---------------------------------------------------------------------------
 * `src/data` is 23.8 MB and all of it used to be in the EAGER module graph:
 * `frozen.js` -> `overlay.js` -> `AppContext`, plus a second and larger import
 * site in `dataManager.js` for the seven STATIC git modules. Measured on this
 * app, bundled JSON parses at ~32 ms/MB over a ~130 ms floor, so first paint
 * scaled with TOTAL corpus size — 508 ms — and the planned 3-5x seed expansion
 * would have taken it to 1.6-2.5 s regardless of which page was being opened.
 *
 * 16.8 MB of that corpus is per-project: nobody opening `/byteblaze/dotfiles`
 * needs facebook/react's commits, notes, diffs or CI jobs.
 * `assets/dumps/build_lazy_chunks.py` slices it into `by-project/<id>.json`
 * (median 72 KB, p90 208 KB, max 539 KB) and this module loads them on demand.
 *
 * ---------------------------------------------------------------------------
 * THE RULE THAT KEEPS IT CORRECT
 * ---------------------------------------------------------------------------
 * `App` does not render a project route until that project's chunk is resolved
 * (`useProjectChunk` in src/App.jsx, gating on the same `loading` return that
 * already covered state hydration). So a component NEVER observes a
 * half-loaded project: it sees no page at all, then the finished page. This is
 * what makes cold deep-links safe — an RL agent dropped on
 * `/byteblaze/dotfiles/-/merge_requests/40/diffs` gets the real diff on first
 * paint, not an empty state that fills in a tick later.
 *
 * The chunks are strictly ADDITIVE and never evicted, so `loaded` only ever
 * grows. That is what lets `overlay.js` treat the currently-loaded note set as
 * a stable base array: a note can appear later, but one can never vanish, so no
 * spurious deletion tombstone can be derived. See `lazyNotes()` below.
 *
 * ---------------------------------------------------------------------------
 * WHAT IS *NOT* HERE (deliberately eager)
 * ---------------------------------------------------------------------------
 * projects, users, groups, labels, milestones, members, stars, follows, todos,
 * current_user, repo_languages, the CI header, and the issue/MR metadata index.
 * Those are cross-cutting: the navbar's assigned-issue counts, the project and
 * group sidebars' open-issue counts, `/dashboard/issues`, `/search` and
 * `/dashboard/milestones` all read across every project on every route, so a
 * partial view of them would be silently WRONG rather than merely late. They
 * also grow with the number of projects/users rather than with the number of
 * issues, notes and commits, which is the axis the seed expands along.
 */
import projects from './projects.json'

/**
 * Vite turns this into one dynamic-import stub per file at build time, and each
 * becomes its own chunk. `{ eager: false }` is the default and is what makes
 * these `import()` calls rather than static edges — the whole point.
 */
const LOADERS = import.meta.glob('./by-project/*.json')

const loaderFor = id => LOADERS[`./by-project/${id}.json`] || null

/** lower-cased full_path -> project id, for resolving a URL before state exists. */
const ID_BY_PATH = new Map(projects.map(p => [String(p.full_path).toLowerCase(), p.id]))

/** Shared empty array — reference-stable, so it never invalidates a memo. */
const EMPTY = Object.freeze([])
export { EMPTY }

const loaded = new Map()    // id -> chunk object
const inflight = new Map()  // id -> Promise<void>

let version = 0
const listeners = new Set()

function bump() {
  version += 1
  for (const fn of Array.from(listeners)) fn(version)
}

/** Notified after every chunk load, so `AppProvider` can re-materialize. */
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function dataVersion() { return version }

/** The loaded chunk for a project id, or `null`. Never triggers a load. */
export function chunkFor(id) {
  if (id == null) return null
  return loaded.get(Number(id)) || null
}

/**
 * True when `id` needs nothing further: either its chunk is loaded, or the seed
 * has no chunk for it at all (108 of the 175 projects have no CI data, a
 * session-created project has no git data, and both are legitimate).
 */
export function projectReady(id) {
  if (id == null) return true
  const n = Number(id)
  return loaded.has(n) || loaderFor(n) === null
}

/** Load `ids` (array or single). Resolves when every one of them is ready. */
export function ensureProjects(ids) {
  const list = (Array.isArray(ids) ? ids : [ids])
    .map(Number)
    .filter(n => Number.isFinite(n) && !loaded.has(n))
  if (list.length === 0) return Promise.resolve()

  return Promise.all(list.map(n => {
    const pending = inflight.get(n)
    if (pending) return pending
    const load = loaderFor(n)
    if (!load) return Promise.resolve()
    const p = load()
      .then(mod => {
        loaded.set(n, (mod && mod.default) || mod || {})
        inflight.delete(n)
        bump()
      })
      .catch(() => {
        // A chunk that cannot be fetched must not wedge the route forever: mark
        // it empty so `projectReady` goes true and the page renders its normal
        // empty state, exactly as it does for a project the seed never covered.
        loaded.set(n, {})
        inflight.delete(n)
        bump()
      })
    inflight.set(n, p)
    return p
  })).then(() => undefined)
}

/**
 * The project full_path a URL points at, lower-cased, or `null`.
 *
 * Two shapes cover every project route in `src/App.jsx`:
 *   `/<ns>/<proj>/-/…`                     — the `/-/` marker is authoritative
 *   `/-/ide/project/<ns>/<proj>/edit/…`    — the Web IDE's inverted form
 * Everything else (`/<ns>/<proj>`, `/<ns>/<proj>/edit`, `/<ns>/<proj>/activity`)
 * is resolved by matching the longest leading path prefix that is a real
 * project, which also rejects `/dashboard/issues`, `/explore/projects`,
 * `/groups/<g>` and `/users/<u>` without needing a reserved-word list.
 *
 * `known` is an optional `path => bool` over the LIVE project list. It matters
 * for one case: a project the agent created — in particular a FORK, whose git
 * data lives in its source project's chunk. The seed map cannot see it, so
 * without `known` the fork's path would not resolve, the gate would await
 * nothing, and every repo view on the fork would render empty. `App` passes a
 * predicate backed by `indexes.projectsByPathLower`; the seed map is the
 * fallback for the module-init prefetch, which runs before state exists.
 */
export function projectPathFromPathname(pathname, known) {
  const has = known || (p => ID_BY_PATH.has(p))
  const raw = String(pathname || '').replace(/^\/+|\/+$/g, '')
  if (!raw) return null

  const segs = raw.split('/')

  if (raw.startsWith('-/ide/project/')) {
    const rest = segs.slice(3)
    if (rest.length >= 2) {
      const cand = `${rest[0]}/${rest[1]}`.toLowerCase()
      if (has(cand)) return cand
    }
    return null
  }

  const dash = segs.indexOf('-')
  if (dash >= 2) {
    const cand = segs.slice(0, dash).join('/').toLowerCase()
    return has(cand) ? cand : null
  }

  // Longest-prefix match. GitLab allows nested namespaces, so try deeper first.
  for (let k = Math.min(segs.length, 4); k >= 2; k -= 1) {
    const cand = segs.slice(0, k).join('/').toLowerCase()
    if (has(cand)) return cand
  }
  return null
}

/** Project id for a lower-cased full_path, or `null`. */
export function projectIdForPath(path) {
  if (!path) return null
  const id = ID_BY_PATH.get(String(path).toLowerCase())
  return id === undefined ? null : id
}

/**
 * Start the chunk fetch for the URL the tab was opened on, at module-init time.
 *
 * Called for its side effect from the bottom of this file. Without it the fetch
 * cannot start until React has mounted and run an effect, which serialises it
 * after the eager bundle's parse; with it the two overlap and a cold project
 * route costs one round trip less. Purely an optimisation — `useProjectChunk`
 * in App.jsx is what guarantees correctness, and it re-resolves through
 * `state.repo.forkOrigin`, which does not exist yet at module init.
 */
function prefetchForLocation() {
  if (typeof window === 'undefined' || !window.location) return
  const id = projectIdForPath(projectPathFromPathname(window.location.pathname))
  if (id != null) ensureProjects(id)
}

/**
 * Every loaded chunk's notes, concatenated — the base array for `state.notes`.
 *
 * Memoised on `version` so the array is REFERENCE-STABLE between chunk loads.
 * `overlay.mergeCollection()` returns the base array itself when the session has
 * not touched a note, and `dematerialize()` skips a collection whose array came
 * back reference-identical; a fresh array here would defeat both on every render.
 *
 * Notes are the one overlay collection that is only PARTIALLY loaded, and that
 * is sound because the only two consumers are `IssueDetail` and
 * `MergeRequestDetail` (through `NotesTimeline`), both of which are project
 * routes and therefore behind the chunk gate. `state.notes` is complete for the
 * project being viewed, which is the only scope any view reads it at. Deletion
 * tombstones stay correct for the same reason chunks are never evicted: the base
 * only grows, so a note that is absent from a reducer's output is absent because
 * the agent deleted it, never because its chunk had not arrived.
 */
let notesCache = []
let notesVersion = -1
export function lazyNotes() {
  if (notesVersion === version) return notesCache
  const out = []
  for (const chunk of loaded.values()) {
    if (chunk.notes) for (const n of chunk.notes) out.push(n)
  }
  notesCache = out
  notesVersion = version
  return out
}

/* ------------------------------------------------------------------ *
 * Issue / merge-request bodies                                        *
 * ------------------------------------------------------------------ */

/**
 * `search_bodies.json` — every issue and MR description in one module, 2.87 MB.
 *
 * `/search` is the only cross-project view that reads a body: GitLab without
 * Elasticsearch searches title AND description, so a title-only search here
 * would silently return fewer rows than the source. Fanning out to all 173
 * project chunks would cost 19.7 MB to answer one query; this costs 2.87 MB and
 * one request, and no other route ever touches it.
 */
let searchBodies = null
let searchBodiesPending = null

export function searchBodiesReady() { return searchBodies !== null }

export function ensureSearchBodies() {
  if (searchBodies) return Promise.resolve()
  if (!searchBodiesPending) {
    searchBodiesPending = import('./search_bodies.json')
      .then(mod => { searchBodies = (mod && mod.default) || mod || {}; bump() })
      .catch(() => { searchBodies = { issues: {}, mergeRequests: {} }; bump() })
  }
  return searchBodiesPending
}

/**
 * The `description` for one issue / merge request, or `undefined` when nothing
 * loaded so far has it.
 *
 * `collection` is the overlay collection name — `'issues'` or `'mergeRequests'`.
 * The project's own chunk is consulted first because on a project route it is
 * already in memory and is the smaller structure; `search_bodies` is the
 * fallback for `/search`, where no project chunk is loaded at all.
 */
export function bodyFor(collection, projectId, id) {
  const field = collection === 'issues' ? 'issueBodies' : 'mrBodies'
  const chunk = chunkFor(projectId)
  const own = chunk && chunk[field]
  if (own) {
    const hit = own[id]
    if (hit !== undefined) return hit
  }
  if (searchBodies) {
    const hit = searchBodies[collection] && searchBodies[collection][id]
    if (hit !== undefined) return hit
  }
  return undefined
}

/** Resource events for one project — `NotesTimeline` merges them with notes. */
export function resourceEventsFor(projectId) {
  const chunk = chunkFor(projectId)
  return (chunk && chunk.resourceEvents) || EMPTY
}

prefetchForLocation()
