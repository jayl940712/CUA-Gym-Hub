/**
 * `createInitialData()` and the constants that go with it.
 *
 * This module exists so that `vite.config.js` can import `createInitialData()`
 * — it calls it on every `GET /go` to baseline a session that was never seeded
 * — WITHOUT pulling in `dataManager.js`, which imports 2.9 MB of static git
 * data (`repo_files`, `repo_trees`, `commits`, `contributors`, `branches`,
 * `tags`, `merge_request_diffs`) for its accessors. Nothing here imports
 * anything but `overlayShape.js` and one 382-byte JSON file.
 *
 * `dataManager.js` re-exports everything below, so app code keeps importing
 * from there and no call site changed.
 */
import currentUserSeed from '../data/current_user.json'
import { emptyOverlay, SEED_NEXT_IDS, ID_KIND_COLLECTION } from './overlayShape.js'

export { SEED_NEXT_IDS, ID_KIND_COLLECTION }

/** WebArena default user for this site. */
export const CURRENT_USER_ID = 2330
export const CURRENT_USERNAME = 'byteblaze'

/**
 * The PERSISTED state — what is POSTed, diffed and returned by `/go`.
 *
 * Everything here is something an agent can create or change. The twelve
 * mutable collections (`users projects groups issues mergeRequests notes labels
 * milestones members todos stars follows`) are NOT here: they are frozen base
 * data in `src/data/frozen.js`, merged on read by `overlay.materialize()`, and
 * the mutations against them are the `emptyOverlay()` keys below. See the
 * header of `src/utils/overlay.js`.
 *
 * A harness may still inject any of those twelve as a full array and it will be
 * honoured as the base — `initializeData()` merges shallowly, exactly as before.
 */
export function createInitialData() {
  return {
    // The delta against the frozen corpus — 36 keys, all empty on a cold boot.
    ...emptyOverlay(),

    // who the app is booted as (no auth — migration contract §4).
    // Mirrors the `users` row for id 2330; profile edits write BOTH, which the
    // overlay records as `currentUser.<field>` plus one entry in `userEdits`.
    currentUser: { ...currentUserSeed },

    // The source instance has no snippets, and no snippet is frozen, so this is
    // a plain array rather than an overlaid collection. The key still needs a
    // baseline, or a created snippet lands in the /go diff as `{"new": […]}`
    // with no `old` and falls out of the shape every other list uses.
    snippets: [],

    // --- git overlays --------------------------------------------------------
    // The 7 git modules stay static. Anything a task writes lands here and
    // shadows the static module. Keys are documented in SCHEMA.md.
    repo: {
      // "<full_path>:<ref>:<path>" -> file body (string), or null = deleted
      fileOverlay: {},
      // "<full_path>:<ref>" -> [ {path,type,mode,size,sha}, ... ] extra tree entries
      treeOverlay: {},
      // "<full_path>:<ref>" -> [ commit, ... ] newest-first, prepended to static
      commitOverlay: {},
      // "<full_path>" -> [ {name,sha,committed_date,subject}, ... ] extra branches
      branchOverlay: {},
      // "<full_path>" -> [ {name,sha,date,message}, ... ] extra tags
      tagOverlay: {},
      // "<full_path>" -> [ "<branch name>", ... ] branches deleted by a task.
      // The overlays above are purely ADDITIVE, so `Delete branch` had nowhere
      // to write and the three delete controls were inert (AUDIT P2-1). These
      // two are the subtractive channel: getBranches/getTags filter through
      // them, and a name listed here disappears from the static module as well
      // as from the additive overlay.
      branchDeletions: {},
      // "<full_path>" -> [ "<tag name>", ... ] tags deleted by a task
      tagDeletions: {},
      // "<fork full_path>" -> "<source full_path>".  A fork is an ALIAS, not a
      // copy: the accessors in dataManager.js resolve a forked project's git
      // data through the origin's STATIC entry, so forking does not drag 57 KB
      // of blob bodies into the POSTed payload. Only blobs edited *after* the
      // fork land in fileOverlay.
      forkOrigin: {},
    },

    // --- UI / preference state ------------------------------------------------
    // NOTE: there is deliberately no `starredProjectIds` here. `state.stars` is
    // the single source of truth for starring and is what every reader uses
    // (ProjectOverview, DashboardProjects, UserProfile, Starrers). The derived
    // copy that used to live here had no consumer and emitted a second signal
    // for the same action into every /go diff.
    ui: {
      notificationLevels: {},
      sidebarCollapsed: false,
      dismissedAlerts: [],
      preferences: { colorScheme: 'light', syntaxTheme: 'white' },
      // ROUTES #99–#105 — protected branches/tags, deploy keys/tokens, mirrors,
      // webhooks, CI variables, triggers and the merge/CI/monitor/package
      // setting forms, keyed by project full_path. Empty until an agent submits
      // one of those forms; see src/pages/projectSettingsStore.js.
      projectSettings: {},
    },

    // Created records must never collide with real ids (assets/data_model.md §12).
    // Floors live in overlayShape.js and are DEV-checked against the frozen
    // corpus by `overlay.checkSeedNextIds()`.
    nextIds: { ...SEED_NEXT_IDS },
  }
}

export default createInitialData
