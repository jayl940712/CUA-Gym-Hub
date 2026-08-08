// ---------------------------------------------------------------------------
// webarena_gitlab_mock — session + state plumbing
//
// Seed split (assets/data_model.md §12, TODO.md P0):
//
//   MUTABLE (12 modules) -> live inside `state`, POSTed to /post, diffed by /go
//     projects users groups issues merge_requests notes labels milestones
//     members stars follows todos
//
//   STATIC (7 git modules) -> imported as reference data, NEVER copied into
//   state. They total ~2.9 MB and only ever change through file create/edit,
//   which is modelled as a small set of overlays under `state.repo`.
//     repo_files repo_trees commits contributors branches tags
//     merge_request_diffs
//
// Read git data through the accessors at the bottom of this file
// (getRepoTree / getRepoFile / getCommits / getBranches / getTags /
//  getContributors) so the overlays are always applied.
// ---------------------------------------------------------------------------

import { accessLabel } from './format.js'
import projectsSeed from '../data/projects.json'
import usersSeed from '../data/users.json'
import groupsSeed from '../data/groups.json'
import issuesSeed from '../data/issues.json'
import mergeRequestsSeed from '../data/merge_requests.json'
import notesSeed from '../data/notes.json'
import labelsSeed from '../data/labels.json'
import milestonesSeed from '../data/milestones.json'
import membersSeed from '../data/members.json'
import starsSeed from '../data/stars.json'
import followsSeed from '../data/follows.json'
import todosSeed from '../data/todos.json'

// --- STATIC git reference data (not part of state) --------------------------
import repoFilesStatic from '../data/repo_files.json'
import repoTreesStatic from '../data/repo_trees.json'
import commitsStatic from '../data/commits.json'
import contributorsStatic from '../data/contributors.json'
import branchesStatic from '../data/branches.json'
import tagsStatic from '../data/tags.json'
import mrDiffsStatic from '../data/merge_request_diffs.json'

export const staticRepo = {
  files: repoFilesStatic,
  trees: repoTreesStatic,
  commits: commitsStatic,
  contributors: contributorsStatic,
  branches: branchesStatic,
  tags: tagsStatic,
  mrDiffs: mrDiffsStatic,
}

const BASE_KEY = 'webarena_gitlab_mock_state'
const BASE_INITIAL_KEY = 'webarena_gitlab_mock_initial_state'

// ---------------------------------------------------------------------------
// Id allocation floors — DERIVED, never hard-coded.
//
// The counters used to be literals (`label: 1800`, `note: 310000`) chosen by
// eyeballing the seed. Both started *inside* the real id range: 104 seeded
// labels sit at id >= 1800 and 111 seeded notes at id >= 310000. The 6th label
// a task created was allocated 1805 — already taken — so stateTracker's
// indexBy() collapsed the pair and /go reported the creation as an EDIT to a
// seeded record. Every evaluator reading that diff saw the wrong thing.
//
// Deriving max(existing)+1 at module load means the counters cannot drift out
// of range again when the seed is resampled.
// ---------------------------------------------------------------------------

function maxId(rows, key = 'id') {
  let max = 0
  if (!Array.isArray(rows)) return max
  for (const r of rows) {
    const v = r && r[key]
    if (typeof v === 'number' && Number.isFinite(v) && v > max) max = v
  }
  return max
}

/** One counter per creatable entity. Keys match `allocateId(kind)` in AppContext. */
export const SEED_NEXT_IDS = Object.freeze({
  project: maxId(projectsSeed) + 1,
  group: maxId(groupsSeed) + 1,
  issue: maxId(issuesSeed) + 1,
  mr: maxId(mergeRequestsSeed) + 1,
  note: maxId(notesSeed) + 1,
  label: maxId(labelsSeed) + 1,
  milestone: maxId(milestonesSeed) + 1,
  member: maxId(membersSeed) + 1,
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

/** WebArena default user for this site. */
export const CURRENT_USER_ID = 2330
export const CURRENT_USERNAME = 'byteblaze'

/**
 * Slug for a NAMESPACE (group) path — lower-cased.
 *
 * GitLab lower-cases namespace paths and does NOT lower-case project paths.
 * `deriveSlug()` in src/components/create/mutations.js is shared by both and
 * preserves case, which is correct for projects — the anchors are deliberately
 * mixed case (`/byteblaze/AGISite`, `/byteblaze/Awesome_DIY_ideas`) — but wrong
 * for groups: `AUDIT Group` became `/groups/AUDIT-Group` and the lowercase URL
 * a task navigates to 404'd (AUDIT P2-14).
 *
 * Kept identical to `deriveSlug()` apart from the final `.toLowerCase()`, so
 * `_` and `.` survive (`nolan_honest_fans`, `11711_gitlab` are anchor routes)
 * and only runs of other characters collapse to `-`.
 *
 * Group *creation* and the group **Change path** form are the only two callers
 * this belongs to; every project path stays on `deriveSlug()`.
 */
export function deriveGroupSlug(name) {
  const slug = String(name || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug === '-' ? '' : slug
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------

export function getSessionId() {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  const sid = params.get('sid')
  if (sid) {
    try { sessionStorage.setItem('gitlab_sid', sid) } catch (e) { /* private mode */ }
    return sid
  }
  try { return sessionStorage.getItem('gitlab_sid') || null } catch (e) { return null }
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
  } catch (e) { /* offline / no dev server */ }
  return null
}

// ---------------------------------------------------------------------------
// localStorage with quota tolerance
//
// The mutable seed is ~2.2 MB of JSON. Chrome bills localStorage in UTF-16,
// so two copies can exceed the 5 MB origin quota. When a write fails we drop
// BOTH keys and let the next load rehydrate from the dev server's
// .mock-states/<sid>.json via fetchCustomState(). /go's diff stays correct
// either way because the server writes <sid>.initial.json exactly once.
// ---------------------------------------------------------------------------

function lsSet(key, value) {
  try { localStorage.setItem(key, value); return true } catch (e) { return false }
}

function lsRemove(key) {
  try { localStorage.removeItem(key) } catch (e) { /* ignore */ }
}

/**
 * Persist current (and optionally baseline) state.
 * The current-state key is always written first: if it does not fit, the
 * initial key is removed too, so `initialKey present => storageKey present`
 * always holds and AppContext's first-load check stays truthful.
 */
function persist(sid, state, alsoInitial) {
  const json = JSON.stringify(state)
  const ok = lsSet(storageKey(sid), json)
  if (!ok) { lsRemove(storageKey(sid)); lsRemove(initialKey(sid)); return false }
  if (alsoInitial) {
    if (!lsSet(initialKey(sid), json)) { lsRemove(storageKey(sid)); lsRemove(initialKey(sid)); return false }
  }
  return true
}

// ---------------------------------------------------------------------------
// createInitialData
// ---------------------------------------------------------------------------

export function createInitialData() {
  const currentUser = usersSeed.find(u => u.id === CURRENT_USER_ID) || usersSeed[0]

  return {
    // who the app is booted as (no auth — migration contract §4)
    currentUser: { ...currentUser },

    // --- the 12 mutable modules ---------------------------------------------
    users: usersSeed,
    projects: projectsSeed,
    groups: groupsSeed,
    issues: issuesSeed,
    mergeRequests: mergeRequestsSeed,
    notes: notesSeed,
    labels: labelsSeed,
    milestones: milestonesSeed,
    members: membersSeed,
    stars: starsSeed,
    follows: followsSeed,
    todos: todosSeed,

    // The source instance has no snippets. The key still needs a baseline, or
    // a created snippet lands in the /go diff as `{"new": […]}` with no `old`
    // and falls out of the keyed-collection shape every other list uses.
    snippets: [],

    // --- git overlays --------------------------------------------------------
    // The 6 git modules stay static. Anything a task writes lands here and
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
      // copy: the accessors below resolve a forked project's git data through
      // the origin's STATIC entry, so forking does not drag 57 KB of blob
      // bodies into the POSTed payload. Only blobs edited *after* the fork
      // land in fileOverlay.
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
    // Derived from the seed — see SEED_NEXT_IDS above.
    nextIds: { ...SEED_NEXT_IDS },
  }
}

// ---------------------------------------------------------------------------
// initializeData / saveState
// ---------------------------------------------------------------------------

export function initializeData(sid = null, customState = null) {
  if (customState) {
    const defaults = createInitialData()
    const merged = { ...defaults, ...customState }
    // keep nested defaults alive when a task injects only part of a subtree
    merged.repo = { ...defaults.repo, ...(customState.repo || {}) }
    merged.ui = { ...defaults.ui, ...(customState.ui || {}) }
    merged.nextIds = { ...defaults.nextIds, ...(customState.nextIds || {}) }
    persist(sid, merged, true)
    return merged
  }

  const stored = (() => {
    try { return localStorage.getItem(storageKey(sid)) } catch (e) { return null }
  })()
  if (stored) {
    try {
      const parsed = JSON.parse(stored)
      try {
        if (!localStorage.getItem(initialKey(sid))) lsSet(initialKey(sid), stored)
      } catch (e) { /* ignore */ }
      return parsed
    } catch (e) { /* corrupt -> fall through to defaults */ }
  }

  const data = createInitialData()
  persist(sid, data, true)
  return data
}

/**
 * Publish the pristine state as the session baseline.
 *
 * The server writes <sid>.initial.json on the FIRST /post it sees. Without
 * this call that first post is a mutation, so the baseline captures the
 * already-mutated state and /go reports an empty diff for it — the first
 * action of every rollout would be invisible to the reward signal.
 * Call this once, at boot, when the session has no stored state yet.
 */
export function publishInitialState(state, sid = null) {
  // Goes through the same write chain as saveState: if the agent mutates
  // within the first tick after boot, this baseline post must still land first
  // or it would overwrite the mutation with the pristine seed.
  writeChain = writeChain.then(() => post(sid, { action: 'set', state })).catch(() => {})
  return writeChain
}

// ---------------------------------------------------------------------------
// Persisted writes: coalesced and strictly ordered.
//
// `POST /post {set_current}` is a whole-state overwrite on the server, so two
// in-flight posts that land out of order silently drop whichever mutation the
// loser was carrying. One logical mutation used to issue two of them (the
// allocateId counter bump, then the record itself), so the created record could
// be overwritten by the counter-only payload. Two guards:
//
//   1. Coalesce — writes queued within the same task collapse into one POST
//      carrying the latest state. A microtask, not a timer: /go must reflect a
//      mutation as soon as the click's work is done, so no added latency.
//   2. Serialize — the next POST is chained onto the previous one's promise, so
//      a later state can never land before an earlier one even across ticks.
//
// (AppContext's allocateId no longer persists at all; the caller's own setState
// carries both the counter bump and the record. This is the backstop.)
// ---------------------------------------------------------------------------

let pendingWrite = null   // { sid, state } — latest state awaiting a flush
let flushScheduled = false
let writeChain = Promise.resolve()

/**
 * Encode a /post payload, gzipping it when the browser can (PIPELINE-005).
 *
 * The state is ~2.2 MB and every mutation ships all of it; gzip takes that to
 * ~0.55 MB. The server inflates on `Content-Encoding: gzip` (vite.config.js
 * readBody) and still accepts a plain body, so an environment without
 * CompressionStream — or a failure inside it — falls back transparently rather
 * than losing the write.
 */
async function encodePost(payload) {
  const json = JSON.stringify(payload)
  if (typeof CompressionStream === 'undefined' || typeof Blob === 'undefined') {
    return { body: json, headers: { 'Content-Type': 'application/json' } }
  }
  try {
    const stream = new Blob([json]).stream().pipeThrough(new CompressionStream('gzip'))
    const body = await new Response(stream).arrayBuffer()
    return { body, headers: { 'Content-Type': 'application/json', 'Content-Encoding': 'gzip' } }
  } catch (e) {
    return { body: json, headers: { 'Content-Type': 'application/json' } }
  }
}

async function post(sid, payload) {
  const sidParam = sid ? `?sid=${encodeURIComponent(sid)}` : ''
  const { body, headers } = await encodePost(payload)
  return fetch(`/post${sidParam}`, { method: 'POST', headers, body }).catch(() => {})
}

function postState(sid, state) {
  return post(sid, { action: 'set_current', state })
}

function flushPendingWrite() {
  flushScheduled = false
  if (!pendingWrite) return
  const { sid, state } = pendingWrite
  pendingWrite = null
  writeChain = writeChain.then(() => postState(sid, state)).catch(() => {})
}

export function saveState(state, sid = null) {
  persist(sid, state, false)
  pendingWrite = { sid, state }
  if (flushScheduled) return
  flushScheduled = true
  if (typeof queueMicrotask === 'function') queueMicrotask(flushPendingWrite)
  else Promise.resolve().then(flushPendingWrite)
}

/** Force any queued write out now, and resolve when it has landed. */
export function flushState() {
  flushPendingWrite()
  return writeChain
}

// ---------------------------------------------------------------------------
// Git accessors — static module + state overlay
// ---------------------------------------------------------------------------

/** Default ref for a project, from the seed (NOT always "main"). */
export function defaultBranchOf(project) {
  return (project && project.default_branch) || 'main'
}

export function fileOverlayKey(fullPath, ref, path) {
  return `${fullPath}:${ref}:${path}`
}

/**
 * The full_path whose STATIC git data backs `fullPath`.
 *
 * A fork has no entry in repo_files/repo_trees/commits/branches/tags — it only
 * records `state.repo.forkOrigin[fork] = source`. Every static read walks that
 * chain, so reads fall through to the source project's frozen data instead of
 * the fork copying it into state. Overlay reads keep using the fork's OWN path,
 * so an edit made after the fork stays local to the fork.
 *
 * Chains (fork of a fork) are followed; a cycle stops at the repeat.
 */
export function originPath(state, fullPath) {
  const map = state && state.repo && state.repo.forkOrigin
  if (!map) return fullPath
  let p = fullPath
  const seen = new Set([p])
  while (Object.prototype.hasOwnProperty.call(map, p)) {
    const next = map[p]
    if (!next || seen.has(next)) break
    seen.add(next)
    p = next
  }
  return p
}

/**
 * File body for <fullPath>@<ref>:<path>.
 * Returns `undefined` when the path is not a known blob, `null` when a task
 * deleted it. `repo_files.json` stores default-ref blobs under a bare path and
 * non-default-ref blobs under "<ref>:<path>" (data_model §11).
 */
export function getRepoFile(state, project, ref, path) {
  if (!project) return undefined
  const fullPath = project.full_path
  const overlay = state && state.repo && state.repo.fileOverlay
  if (overlay) {
    const k = fileOverlayKey(fullPath, ref, path)
    if (Object.prototype.hasOwnProperty.call(overlay, k)) return overlay[k]
  }
  const bucket = staticRepo.files[originPath(state, fullPath)]
  if (!bucket) return undefined
  if (ref !== defaultBranchOf(project)) {
    const scoped = bucket[`${ref}:${path}`]
    if (scoped !== undefined) return scoped
  }
  return bucket[path]
}

/** Flat blob list for a ref: static tree + entries added by tasks. */
export function getRepoTree(state, project, ref) {
  if (!project) return []
  const fullPath = project.full_path
  const base = staticRepo.trees[originPath(state, fullPath)] || []
  const extra = (state && state.repo && state.repo.treeOverlay
    && state.repo.treeOverlay[`${fullPath}:${ref}`]) || []
  const deleted = new Set()
  const overlay = (state && state.repo && state.repo.fileOverlay) || {}
  const prefix = `${fullPath}:${ref}:`
  for (const k of Object.keys(overlay)) {
    if (k.startsWith(prefix) && overlay[k] === null) deleted.add(k.slice(prefix.length))
  }
  const seen = new Set()
  const out = []
  for (const e of [...base, ...extra]) {
    if (deleted.has(e.path) || seen.has(e.path)) continue
    seen.add(e.path)
    out.push(e)
  }
  return out
}

/** Commit list for a ref, newest first. */
export function getCommits(state, project, ref) {
  if (!project) return []
  const fullPath = project.full_path
  const rec = staticRepo.commits[originPath(state, fullPath)]
  const base = rec && (!ref || rec.ref === ref || !rec.ref) ? (rec.list || []) : (rec ? rec.list || [] : [])
  const extra = (state && state.repo && state.repo.commitOverlay
    && state.repo.commitOverlay[`${fullPath}:${ref}`]) || []
  return [...extra, ...base]
}

/**
 * An MR's OWN diff — the commits on its source branch that are not on its
 * target, plus the counts its three tab badges show (TEST.md DIFF-901).
 *
 * GitLab reads this from `merge_request_diff_commits` joined through
 * `merge_request_diffs`; `merge_request_diffs.json` is that join, frozen, keyed
 * on the merge-request id. It is NOT derivable from `commits.json` — that file
 * holds the project's default-branch history, which is why `getCommits(state,
 * project, mr.source_branch)` used to hand every MR of a project the same 40
 * commits regardless of its branches.
 *
 * Returns `null` for an MR the seed has no diff for — an MR a task created
 * in-session. Callers render the empty state rather than a wrong list.
 */
export function getMrDiff(mr) {
  if (!mr) return null
  const rec = staticRepo.mrDiffs[String(mr.id)]
  if (!rec) return null
  return {
    commitsCount: rec.commits_count,
    filesCount: rec.files_count,
    pipeline: rec.pipeline || null,
    commits: (rec.commits || []).map(
      ([sha, title, author_name, author_email, committed_date, authored_date]) => ({
        sha, title, author_name, author_email, committed_date, authored_date,
      })),
  }
}

/** Names a task deleted from `bucket` ('branchDeletions' | 'tagDeletions'). */
function deletedNames(state, bucket, fullPath) {
  const map = state && state.repo && state.repo[bucket]
  const list = map && map[fullPath]
  return new Set(Array.isArray(list) ? list : [])
}

export function getBranches(state, project) {
  if (!project) return []
  const fullPath = project.full_path
  const base = staticRepo.branches[originPath(state, fullPath)] || []
  const extra = (state && state.repo && state.repo.branchOverlay
    && state.repo.branchOverlay[fullPath]) || []
  const deleted = deletedNames(state, 'branchDeletions', fullPath)
  const seen = new Set()
  return [...base, ...extra].filter(b => (deleted.has(b.name) || seen.has(b.name)
    ? false
    : (seen.add(b.name), true)))
}

export function getTags(state, project) {
  if (!project) return []
  const fullPath = project.full_path
  const base = staticRepo.tags[originPath(state, fullPath)] || []
  const extra = (state && state.repo && state.repo.tagOverlay
    && state.repo.tagOverlay[fullPath]) || []
  const deleted = deletedNames(state, 'tagDeletions', fullPath)
  return [...base, ...extra].filter(t => !deleted.has(t.name))
}

/**
 * Record a branch/tag deletion. Returns the next state; callers do
 * `setState(prev => deleteRefs(prev, project, 'branch', ['old-feature']))`.
 *
 * `kind` is `'branch'` or `'tag'`. Deleting a name that is only in the additive
 * overlay still records it here, so the read-through stays a single rule and a
 * re-created branch of the same name is a plain overlay push that this filter
 * would otherwise silently swallow — so the name is dropped from the deletion
 * list on re-create. Idempotent: deleting twice is a no-op.
 */
export function deleteRefs(state, project, kind, names) {
  if (!state || !project || !names || !names.length) return state
  const bucket = kind === 'tag' ? 'tagDeletions' : 'branchDeletions'
  const fullPath = project.full_path
  const cur = (state.repo && state.repo[bucket] && state.repo[bucket][fullPath]) || []
  const next = [...cur]
  for (const n of names) if (!next.includes(n)) next.push(n)
  if (next.length === cur.length) return state
  return {
    ...state,
    repo: { ...state.repo, [bucket]: { ...(state.repo[bucket] || {}), [fullPath]: next } },
  }
}

/** Undo a recorded deletion — used when a task re-creates a ref of the same name. */
export function undeleteRef(state, project, kind, name) {
  if (!state || !project) return state
  const bucket = kind === 'tag' ? 'tagDeletions' : 'branchDeletions'
  const fullPath = project.full_path
  const cur = (state.repo && state.repo[bucket] && state.repo[bucket][fullPath]) || []
  if (!cur.includes(name)) return state
  return {
    ...state,
    repo: {
      ...state.repo,
      [bucket]: { ...(state.repo[bucket] || {}), [fullPath]: cur.filter(n => n !== name) },
    },
  }
}

/**
 * Contributor aggregate for a ref (assets/data_model.md §11).
 * `state` is optional and only needed so a forked project resolves through its
 * origin; existing two-argument calls keep working unchanged.
 */
export function getContributors(project, ref, state = null) {
  if (!project) return null
  const rec = staticRepo.contributors[originPath(state, project.full_path)]
  if (!rec) return null
  if (ref && rec[ref]) return rec[ref]
  const keys = Object.keys(rec)
  return keys.length ? rec[keys[0]] : null
}

/**
 * The `.user-access-role` pill next to an issuable author or a note author
 * (TEST.md DIFF-906). GitLab shows the member role when the user is a member,
 * and falls back to `Contributor` when they are not a member but have committed
 * to the repository. Both tooltip strings are the source's own — see
 * `assets/html/issue-a11ywebring-71.html`, where `@Seirdy` reads
 * `Contributor` / "This user has previously committed to the a11y-webring.club
 * project."
 *
 * The contributor test matches on name first and address second: the seed's
 * user emails were anonymised to `@fakegithub.com` while `contributors.json`
 * carries the real commit addresses, so an address-only test would never fire.
 */
export function projectRoleFor(state, project, user) {
  if (!state || !project || !user) return null
  const member = state.members.find(m => m.source_type === 'project'
    && m.source_id === project.id && m.user_id === user.id)
  if (member) {
    const label = accessLabel(member.access_level)
    if (!label) return null
    return { label, title: `This user has the ${label.toLowerCase()} role in the ${project.name} project.` }
  }
  const rec = getContributors(project, project.default_branch, state)
  const authors = (rec && rec.authors) || []
  const hit = authors.some(a => a.name === user.name
    || (user.email && a.email && a.email.toLowerCase() === String(user.email).toLowerCase()))
  if (!hit) return null
  return {
    label: 'Contributor',
    title: `This user has previously committed to the ${project.name} project.`,
  }
}

/** Refs a project has contributor data for — used by /-/graphs/:ref. */
export function contributorRefs(project, state = null) {
  if (!project) return []
  const rec = staticRepo.contributors[originPath(state, project.full_path)]
  return rec ? Object.keys(rec) : []
}
