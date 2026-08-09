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
 */
import users from './users.json'
import projects from './projects.json'
import groups from './groups.json'
import issues from './issues.json'
import mergeRequests from './merge_requests.json'
import notes from './notes.json'
import labels from './labels.json'
import milestones from './milestones.json'
import members from './members.json'
import todos from './todos.json'
import stars from './stars.json'
import follows from './follows.json'

/** Keyed by the STATE key, not the file name (`mergeRequests` ≠ merge_requests). */
export const FROZEN = Object.freeze({
  users,
  projects,
  groups,
  issues,
  mergeRequests,
  notes,
  labels,
  milestones,
  members,
  todos,
  stars,
  follows,
})

export default FROZEN
