/**
 * Overlay resolution — the single place where the frozen corpus and the
 * agent's mutations are merged.
 *
 * `AppProvider` holds two objects:
 *
 *   core   the PERSISTED state. Small. Holds only what an agent can create or
 *          change: the overlay keys plus forums/users/votes/session keys.
 *          This is what goes to localStorage, `POST set_current`, and `/go`.
 *   state  `materialize(core)` — core plus fully merged `submissions`,
 *          `comments` and `userDirectory` arrays. Never persisted.
 *
 * Because there is exactly ONE materialization point, no view can disagree
 * with another about whether a record exists: the forum listing, the
 * permalink, the user profile, search, the comment tree and `/go` all read the
 * same merged arrays. That was the specific failure mode this design risked.
 *
 * BACKWARD-COMPATIBLE INJECTION. `dataManager.initializeData()` still merges an
 * injected task state shallowly, so a harness POSTing a full `submissions`
 * array puts that array on `core`. `baseSubmissions()` prefers it, so the
 * injected array becomes the base verbatim — same records, same order, same
 * render as before this refactor — and the overlay applies on top of it. The
 * lighter path is to inject only `newSubmissions` / `submissionEdits` /
 * `deletedSubmissions` and let the frozen corpus stand, which is what task
 * setup should do now: adding one post costs one record, not 8,012.
 */
import { FROZEN_SUBMISSIONS, FROZEN_COMMENTS, FROZEN_USER_DIRECTORY } from '../data/frozen.js'
import { emptyOverlay } from './overlayShape.js'

export { emptyOverlay }

export function baseSubmissions(core) {
  return Array.isArray(core?.submissions) ? core.submissions : FROZEN_SUBMISSIONS
}

export function baseComments(core) {
  return Array.isArray(core?.comments) ? core.comments : FROZEN_COMMENTS
}

export function baseUserDirectory(core) {
  return core?.userDirectory && typeof core.userDirectory === 'object'
    ? core.userDirectory
    : FROZEN_USER_DIRECTORY
}

/**
 * `id -> record` for a base array, cached on the array identity.
 *
 * The frozen arrays are module constants, so their index is built once for the
 * page's lifetime. Without this, `getSubmission()` was a linear scan of 8,012
 * records on every submission-page render.
 */
const indexCache = new WeakMap()
export function indexById(arr) {
  let m = indexCache.get(arr)
  if (!m) {
    m = new Map()
    for (const r of arr) m.set(String(r.id), r)
    indexCache.set(arr, m)
  }
  return m
}

function isEmpty(v) {
  if (Array.isArray(v)) return v.length === 0
  if (v && typeof v === 'object') return Object.keys(v).length === 0
  return true
}

/** True when nothing in `core` changes the base arrays — the cold-boot case. */
function overlayIsInert(core) {
  return isEmpty(core.newSubmissions) && isEmpty(core.submissionEdits) &&
    isEmpty(core.deletedSubmissions) && isEmpty(core.newComments) &&
    isEmpty(core.commentEdits) && isEmpty(core.deletedComments) &&
    isEmpty(core.deletedForums) && isEmpty(core.forumRenames) &&
    isEmpty(core.userRenames)
}

/** Apply an ordered rename list to a single value. */
function rename(list, value) {
  let v = value
  for (const r of list) if (v === r.from) v = r.to
  return v
}

/* ------------------------------------------------------------------ *
 * Read side                                                           *
 * ------------------------------------------------------------------ */

function mergeSubmissions(core) {
  const base = baseSubmissions(core)
  const created = core.newSubmissions || []
  if (overlayIsInert(core)) return base   // inert implies `created` is empty too

  const edits = core.submissionEdits || {}
  const deleted = new Set((core.deletedSubmissions || []).map(String))
  const deadForums = new Set((core.deletedForums || []).map(f => String(f).toLowerCase()))
  const fRenames = core.forumRenames || []
  const uRenames = core.userRenames || []
  const out = []

  for (let i = 0; i < base.length + created.length; i++) {
    const raw = i < base.length ? base[i] : created[i - base.length]
    const id = String(raw.id)
    if (deleted.has(id)) continue
    let rec = edits[id] || raw
    // Renames run BEFORE the deleted-forum test: `/f/<name>/delete` records the
    // forum's CURRENT name, while a frozen record still carries its original.
    if (fRenames.length || uRenames.length) {
      const forum = rename(fRenames, rec.forum)
      const author = rename(uRenames, rec.author)
      if (forum !== rec.forum || author !== rec.author) rec = { ...rec, forum, author }
    }
    if (deadForums.size && deadForums.has(String(rec.forum).toLowerCase())) continue
    out.push(rec)
  }
  return out
}

/**
 * @param alive ids of submissions that survived, or `null` when nothing was
 *   deleted. A comment whose submission is gone is a dangling reference, which
 *   is what `deleteSubmission()` and `/f/<name>/delete` used to prune by hand.
 */
function mergeComments(core, alive) {
  const base = baseComments(core)
  const created = core.newComments || []
  if (overlayIsInert(core)) return base   // inert implies `created` is empty too

  const edits = core.commentEdits || {}
  const deleted = new Set((core.deletedComments || []).map(String))
  const uRenames = core.userRenames || []
  const out = []

  for (let i = 0; i < base.length + created.length; i++) {
    const raw = i < base.length ? base[i] : created[i - base.length]
    const id = String(raw.id)
    if (deleted.has(id)) continue
    let rec = edits[id] || raw
    if (alive && !alive.has(String(rec.submission))) continue
    if (uRenames.length) {
      const author = rename(uRenames, rec.author)
      if (author !== rec.author) rec = { ...rec, author }
    }
    out.push(rec)
  }
  return out
}

function mergeUserDirectory(core) {
  const base = baseUserDirectory(core)
  const renames = core.userRenames || []
  if (!renames.length) return base
  const out = { ...base }
  for (const r of renames) {
    if (out[r.from] !== undefined) { out[r.to] = out[r.from]; delete out[r.from] }
  }
  return out
}

/**
 * core -> the object the React tree reads. Adds the merged arrays and the
 * id indexes the selectors use; leaves `core`'s own keys untouched.
 */
export function materialize(core) {
  if (!core) return core
  const submissions = mergeSubmissions(core)

  // Only pay for the alive-set when something could actually have removed a
  // submission; on a cold session `mergeSubmissions` returned the frozen array.
  const nothingRemoved = isEmpty(core.deletedSubmissions) && isEmpty(core.deletedForums)
  const alive = nothingRemoved ? null : new Set(submissions.map(s => String(s.id)))
  const comments = mergeComments(core, alive)

  return {
    ...core,
    submissions,
    comments,
    userDirectory: mergeUserDirectory(core)
  }
}

/** Comments grouped by submission id, in array order. */
export function groupCommentsBySubmission(comments) {
  const m = new Map()
  for (const c of comments) {
    const k = String(c.submission)
    const bucket = m.get(k)
    if (bucket) bucket.push(c)
    else m.set(k, [c])
  }
  return m
}

/* ------------------------------------------------------------------ *
 * Write side — every helper takes `core` and returns a new `core`      *
 * ------------------------------------------------------------------ */

/** The current value of a submission, edits applied, renames NOT applied. */
export function resolveSubmission(core, id) {
  const key = String(id)
  if ((core.deletedSubmissions || []).some(d => String(d) === key)) return null
  const edited = (core.submissionEdits || {})[key]
  if (edited) return edited
  const fromBase = indexById(baseSubmissions(core)).get(key)
  if (fromBase) return fromBase
  return (core.newSubmissions || []).find(s => String(s.id) === key) || null
}

export function resolveComment(core, id) {
  const key = String(id)
  if ((core.deletedComments || []).some(d => String(d) === key)) return null
  const edited = (core.commentEdits || {})[key]
  if (edited) return edited
  const fromBase = indexById(baseComments(core)).get(key)
  if (fromBase) return fromBase
  return (core.newComments || []).find(c => String(c.id) === key) || null
}

/**
 * Field-level edit. A record the agent created is patched in place in
 * `newSubmissions`; a FROZEN record cannot be mutated, so its patched value is
 * stored whole under `submissionEdits[id]` and wins at materialization.
 */
export function patchSubmission(core, id, updates) {
  const key = String(id)
  const created = core.newSubmissions || []
  const idx = created.findIndex(s => String(s.id) === key)
  if (idx !== -1) {
    const next = created.slice()
    next[idx] = { ...next[idx], ...updates }
    return { ...core, newSubmissions: next }
  }
  const current = resolveSubmission(core, key)
  if (!current) return core
  return {
    ...core,
    submissionEdits: { ...(core.submissionEdits || {}), [key]: { ...current, ...updates } }
  }
}

export function patchComment(core, id, updates) {
  const key = String(id)
  const created = core.newComments || []
  const idx = created.findIndex(c => String(c.id) === key)
  if (idx !== -1) {
    const next = created.slice()
    next[idx] = { ...next[idx], ...updates }
    return { ...core, newComments: next }
  }
  const current = resolveComment(core, key)
  if (!current) return core
  return {
    ...core,
    commentEdits: { ...(core.commentEdits || {}), [key]: { ...current, ...updates } }
  }
}

export function addSubmission(core, record) {
  return { ...core, newSubmissions: [...(core.newSubmissions || []), record] }
}

export function addComment(core, record) {
  return { ...core, newComments: [...(core.newComments || []), record] }
}

/**
 * Hard delete. An agent-created record simply leaves `newSubmissions`; a frozen
 * one is tombstoned in `deletedSubmissions`, and every read path honours the
 * tombstone because they all go through `materialize()`.
 */
export function removeSubmission(core, id) {
  const key = String(id)
  const created = core.newSubmissions || []
  if (created.some(s => String(s.id) === key)) {
    const edits = { ...(core.submissionEdits || {}) }
    delete edits[key]
    return {
      ...core,
      newSubmissions: created.filter(s => String(s.id) !== key),
      submissionEdits: edits
    }
  }
  if ((core.deletedSubmissions || []).some(d => String(d) === key)) return core
  const edits = { ...(core.submissionEdits || {}) }
  delete edits[key]
  return {
    ...core,
    submissionEdits: edits,
    deletedSubmissions: [...(core.deletedSubmissions || []), key]
  }
}

export function removeComment(core, id) {
  const key = String(id)
  const created = core.newComments || []
  if (created.some(c => String(c.id) === key)) {
    const edits = { ...(core.commentEdits || {}) }
    delete edits[key]
    return {
      ...core,
      newComments: created.filter(c => String(c.id) !== key),
      commentEdits: edits
    }
  }
  if ((core.deletedComments || []).some(d => String(d) === key)) return core
  const edits = { ...(core.commentEdits || {}) }
  delete edits[key]
  return {
    ...core,
    commentEdits: edits,
    deletedComments: [...(core.deletedComments || []), key]
  }
}

/**
 * Does any live comment have `id` as its parent?
 *
 * `deleteComment()` needs this to choose between Postmill's soft delete (keep
 * the node, blank the body) and a hard delete, and it cannot read the
 * materialized array from inside a pure updater.
 */
export function hasChildComments(core, id) {
  const key = String(id)
  const deleted = new Set((core.deletedComments || []).map(String))
  const edits = core.commentEdits || {}
  for (const src of [baseComments(core), core.newComments || []]) {
    for (const raw of src) {
      const rid = String(raw.id)
      if (deleted.has(rid)) continue
      const rec = edits[rid] || raw
      if (rec.parent !== null && rec.parent !== undefined && String(rec.parent) === key) return true
    }
  }
  return false
}

