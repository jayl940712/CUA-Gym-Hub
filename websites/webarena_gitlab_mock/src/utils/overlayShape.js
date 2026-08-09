/**
 * The overlay's key list, its empty value, and the id floors — deliberately
 * IMPORT-FREE.
 *
 * `src/utils/initialState.js` needs the shape for `createInitialData()`, and
 * `vite.config.js` imports `createInitialData()` to baseline every `/go`.
 * Keeping this module free of `src/data/frozen.js` is what stops the vite
 * config — and therefore the node process answering `/go` — from pulling in the
 * 2 MB mutable corpus and the 2.9 MB of static git data behind it.
 *
 * See `src/utils/overlay.js` for how the keys below are resolved on read.
 */

/**
 * The twelve collections that are frozen base data plus a delta.
 *
 * `name`    the key the React tree reads — `state.issues`, `state.notes`, …
 *           Materialized by `overlay.materialize()`, NEVER persisted.
 * `created` array of records the agent created, in insertion order.
 * `edits`   `{ [key]: fullRecord }` — a FROZEN record's replacement value.
 * `deleted` array of keys of frozen records the agent removed (tombstones).
 * `key`     what identifies a record. `'id'` for the ten keyed collections;
 *           `stars` and `follows` have no id in the source either (they are
 *           join rows) so they are keyed on their composite, which is also how
 *           `stateTracker.js` already set-diffs them.
 *
 * The three delta keys are flat top-level state keys rather than a nested
 * `overlay` object so that `/go`'s `state_diff` names them directly — a harness
 * reading the diff sees `newIssues` / `issueEdits` / `deletedIssues` at the top
 * level, the same shape `webarena_reddit_mock` settled on.
 */
export const OVERLAY_COLLECTIONS = Object.freeze([
  { name: 'users', created: 'newUsers', edits: 'userEdits', deleted: 'deletedUsers', key: 'id' },
  { name: 'projects', created: 'newProjects', edits: 'projectEdits', deleted: 'deletedProjects', key: 'id' },
  { name: 'groups', created: 'newGroups', edits: 'groupEdits', deleted: 'deletedGroups', key: 'id' },
  { name: 'issues', created: 'newIssues', edits: 'issueEdits', deleted: 'deletedIssues', key: 'id' },
  { name: 'mergeRequests', created: 'newMergeRequests', edits: 'mergeRequestEdits', deleted: 'deletedMergeRequests', key: 'id' },
  { name: 'notes', created: 'newNotes', edits: 'noteEdits', deleted: 'deletedNotes', key: 'id' },
  { name: 'labels', created: 'newLabels', edits: 'labelEdits', deleted: 'deletedLabels', key: 'id' },
  { name: 'milestones', created: 'newMilestones', edits: 'milestoneEdits', deleted: 'deletedMilestones', key: 'id' },
  { name: 'members', created: 'newMembers', edits: 'memberEdits', deleted: 'deletedMembers', key: 'id' },
  { name: 'todos', created: 'newTodos', edits: 'todoEdits', deleted: 'deletedTodos', key: 'id' },
  { name: 'stars', created: 'newStars', edits: 'starEdits', deleted: 'deletedStars', key: ['project_id', 'user_id'] },
  { name: 'follows', created: 'newFollows', edits: 'followEdits', deleted: 'deletedFollows', key: ['follower_id', 'followee_id'] },
])

/** Every overlay key, flat — used by SCHEMA.md and the injection docs. */
export const OVERLAY_KEYS = Object.freeze(
  OVERLAY_COLLECTIONS.flatMap(c => [c.created, c.edits, c.deleted])
)

/** The materialized collection names, flat. */
export const OVERLAY_COLLECTION_NAMES = Object.freeze(OVERLAY_COLLECTIONS.map(c => c.name))

/** Stable identity for one record of `spec`'s collection. */
export function recordKey(spec, rec) {
  if (!rec) return ''
  if (typeof spec.key === 'string') return String(rec[spec.key])
  return spec.key.map(k => String(rec[k])).join(':')
}

export function emptyOverlay() {
  const o = {}
  for (const c of OVERLAY_COLLECTIONS) {
    o[c.created] = []
    o[c.edits] = {}
    o[c.deleted] = []
  }
  return o
}

/**
 * Id allocation floors — `1 + max(id)` over each frozen seed.
 *
 * These were derived at module load from the seed arrays until the corpus left
 * `dataManager.js`; deriving them still would drag all 2 MB back into
 * `vite.config.js`. They are therefore literals, and `src/utils/overlay.js`
 * re-derives them from the frozen corpus in DEV and logs a loud error if any
 * has drifted below the real maximum. Do not hand-edit: run
 * `assets/dumps/check_next_ids.py` after any reseed and paste its output.
 *
 * Why the floor matters (this was a real defect, see SCHEMA.md): a counter that
 * starts INSIDE the seed's id range mints a duplicate id, `stateTracker`'s
 * `indexBy()` keys by id, the second record silently replaces the first, and
 * `/go` reports a creation as an edit to seed data. `AppContext.allocateId`
 * keeps its `taken` scan as the runtime backstop.
 */
export const SEED_NEXT_IDS = Object.freeze({
  project: 194,
  group: 7,
  issue: 83821,
  mr: 139278,
  note: 310827,
  label: 1927,
  milestone: 590,
  member: 206,
})

/** The state collection each `allocateId(kind)` writes into — collision guard. */
export const ID_KIND_COLLECTION = Object.freeze({
  project: 'projects',
  group: 'groups',
  issue: 'issues',
  mr: 'mergeRequests',
  note: 'notes',
  label: 'labels',
  milestone: 'milestones',
  member: 'members',
})

/**
 * Fold a raw persisted object into overlay shape.
 *
 * Anything reaching `AppProvider` from outside — `GET /state`, a stale
 * `localStorage` value written before this refactor, a task fixture — may be
 * missing overlay keys, or may be a pre-refactor snapshot that carries the full
 * corpus as plain arrays. Both are legal inputs: the missing keys are filled
 * with empties, and full arrays are simply left in place, where `baseArray()`
 * treats them as the base.
 */
export function toCore(raw) {
  if (!raw || typeof raw !== 'object') return raw
  const out = { ...emptyOverlay(), ...raw }
  for (const spec of OVERLAY_COLLECTIONS) {
    if (!Array.isArray(out[spec.created])) out[spec.created] = []
    if (!out[spec.edits] || typeof out[spec.edits] !== 'object' || Array.isArray(out[spec.edits])) out[spec.edits] = {}
    if (!Array.isArray(out[spec.deleted])) out[spec.deleted] = []
  }
  return out
}

