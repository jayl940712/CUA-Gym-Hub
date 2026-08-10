/**
 * The frozen GitLab corpus — imported, never copied into app state.
 *
 * 1 599 notes + 729 merge requests + 613 issues + 1 133 users + 175 projects +
 * 630 labels + 202 milestones + 569 stars + 183 members + 202 misc rows is
 * 2 072 728 bytes of JSON. Putting it in `createInitialData()` made the app
 * state 2.07 MB, so every mutation POSTed 2.07 MB, `/go` returned 4.15 MB, and
 * the two localStorage keys a session needs came to 4 137 340 UTF-16 units —
 * 79 % of Chrome's ~5 MB per-origin quota, with 49 "create" tasks, 22 "star"
 * tasks and 20 "assign" tasks ready to push it over. Past the quota
 * `dataManager.persist()` drops BOTH keys and persistence dies silently.
 *
 * Agents do create and edit these records — far more of this corpus is mutable
 * than reddit's was — but they only ever touch a handful per rollout. So the
 * corpus is read-only BASE data and the mutations are a delta:
 * `src/utils/overlay.js` merges the two on read.
 *
 * Import this module ONLY from `overlay.js`, so that `initialState.js` — and
 * therefore `vite.config.js`, which calls `createInitialData()` on every `/go`
 * — stays free of the payload.
 *
 * ---------------------------------------------------------------------------
 * ELEVEN MODULES, NOT TWELVE — `notes` IS LAZY, AND TWO ARE INDEXES
 * ---------------------------------------------------------------------------
 * `notes.json` is 4.56 MB, the largest module in the seed, and it is read by
 * exactly two views: `IssueDetail` and `MergeRequestDetail`, both through
 * `NotesTimeline`, both project routes. So it is sliced per project into
 * `by-project/<id>.json` and `overlay.baseArray('notes')` reads
 * `lazy.lazyNotes()` — the concatenation of whatever chunks are loaded —
 * instead of a module constant. `src/data/lazy.js` explains why a partially
 * loaded base array is sound for this collection and would NOT be for issues,
 * merge requests or any of the nine below.
 *
 * The eleven that remain are cross-cutting: the navbar, both sidebars, the
 * dashboards and `/search` read across every project on every route, so a
 * partial view of them would be wrong rather than merely late. They also grow
 * with the number of projects and users, not with the number of issues, notes
 * and commits — which is the axis the seed expands along.
 *
 * `issues` and `mergeRequests` are the two that DO grow along that axis, so they
 * are here as METADATA INDEXES: every field except `description`, tuple-encoded
 * (see `unpack` below). Existence, state, assignees, labels, milestones and
 * titles are global and eager — the navbar and the dashboards genuinely need
 * them on every route, and `overlay.reconcileCollection()` needs a COMPLETE base
 * array or it would mint a deletion tombstone for every unloaded record. Only
 * the bodies are lazy.
 */
import users from './users.json'
import projects from './projects.json'
import groups from './groups.json'
import issuesIndex from './issues_index.json'
import mergeRequestsIndex from './merge_requests_index.json'
import labels from './labels.json'
import milestones from './milestones.json'
import members from './members.json'
import todos from './todos.json'
import stars from './stars.json'
import follows from './follows.json'

/**
 * `{fields, rows}` -> `[{…}, …]`.
 *
 * `issues_index.json` and `merge_requests_index.json` are TUPLE-encoded: one
 * shared field-name list, then a bare array per record. The repeated JSON keys
 * were 56 % of the issue index and 54 % of the merge-request index — 1.41 ->
 * 0.62 MB and 2.26 -> 1.03 MB — and they are pure overhead, because every
 * record has the same shape. Rebuilding the objects here costs ~6 ms for the
 * 8 562 rows, against ~66 ms of JSON.parse saved.
 *
 * The result is plain objects with exactly the keys the records had before the
 * split, minus `description`, which `overlay.withBody()` splices back on from
 * the project's lazy chunk. Nothing downstream knows the encoding exists.
 */
function unpack(packed) {
  const fields = packed.fields
  const rows = packed.rows
  const width = fields.length
  const out = new Array(rows.length)
  for (let r = 0; r < rows.length; r += 1) {
    const row = rows[r]
    const rec = {}
    for (let f = 0; f < width; f += 1) rec[fields[f]] = row[f]
    out[r] = rec
  }
  return out
}

const issues = unpack(issuesIndex)
const mergeRequests = unpack(mergeRequestsIndex)

/** Keyed by the STATE key, not the file name (`mergeRequests` ≠ merge_requests). */
export const FROZEN = Object.freeze({
  users,
  projects,
  groups,
  issues,
  mergeRequests,
  labels,
  milestones,
  members,
  todos,
  stars,
  follows,
})

export default FROZEN
