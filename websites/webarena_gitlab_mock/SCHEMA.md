# webarena_gitlab_mock Schema

**Base URL**: `http://localhost:<port>/`
**Go Endpoint**: `GET /go?sid=<sid>` → `{initial_state, current_state, state_diff}`
**Inject**: `POST /post?sid=<sid>` with body `{"action":"set","state":{...}}`
**Reset**: `POST /post?sid=<sid>` with body `{"action":"reset"}` → deletes current and initial state files
**State read**: `GET /state?sid=<sid>` → `{stored_state, has_custom_state, sid}`
**Upload**: `POST /upload?sid=<sid>` (multipart) → `.mock-files/<sid>/`; served at `GET /files/<sid>/<name>`

Uploads are content-addressed and isolated by SID. Legacy `reset` deletes JSON
state but deliberately leaves session fixture files available.

Source of truth: `src/utils/dataManager.js` (`createInitialData`). Session state
lives at `.mock-states/<sid>.json` with a frozen baseline at
`.mock-states/<sid>.initial.json`. The app boots pre-logged-in as **byteblaze**
(user id `2330`); there is no auth, no server, and no runtime network call.

> **How the tables below were produced.** The Observable State Changes table is
> not derived by reading the code. Every mutation flow the mock supports was
> driven in a real chromium session on its own `?sid=`, and the `state_diff`
> that `GET /go?sid=` actually returned was captured and reconciled against this
> document. Rows marked ✅ carry a captured diff; rows marked ⚠ are reachable in
> the UI but the drive could not complete them, and the keys are stated from the
> handler rather than from a capture. Nothing here is inferred from a grep alone.

---

## Frozen corpus, overlay, and static seed

`src/data/` holds **23.8 MB of canonical seed JSON**, of which only **2.34 MB is
loaded eagerly**. Four tiers:

| Tier | State key / module | Where they live |
|---|---|---|
| **Frozen corpus, eager (9)** | `projects` `users` `groups` `labels` `milestones` `members` `stars` `follows` `todos` | `src/data/frozen.js` — read-only base data. **Not copied into state.** `overlay.materialize()` merges them with the session's delta on read, so `state.projects` is still a complete array to every component. |
| **Frozen corpus, eager INDEX (2)** | `issues` `mergeRequests` | `issues_index.json` / `merge_requests_index.json` — every field **except `description`**, tuple-encoded and rebuilt by `frozen.js:unpack()`. Existence is global and eager; the body is not. |
| **Frozen corpus, LAZY (1)** | `notes` | per project, in `src/data/by-project/<id>.json`. `overlay.baseArray('notes')` returns the concatenation of the chunks loaded so far. |
| **Overlay (36 keys)** | `new<X>` / `<x>Edits` / `deleted<X>` for each of the 12 above | **this is what is persisted** — POSTed to `/post`, diffed by `/go`, written to localStorage |
| **Static, LAZY** | `repo_files` `repo_trees` `commits` `contributors` `branches` `tags` `merge_request_diffs` `tree_last_commits` `resource_events` `ci_pipelines.projects` + issue/MR `description` | reference data in the same per-project chunk — read through the accessors in `dataManager.js` and `ci.js`, **never** copied into state |
| **Static, eager** | `repo_languages` (11 KB) `ci_header` (0.6 KB) `current_user` (0.4 KB) | too small and too cross-cutting to split |

(`current_user.json` is byteblaze's row extracted verbatim from `users.json` so
that `createInitialData()` can seed `currentUser` without importing the user
corpus.)

The corpus names above are the **state keys** — the names components read and
the names this document uses. One differs from its file name: `mergeRequests` is
loaded from `src/data/merge_requests.json`. The static names are file names;
they have no state key, by definition.

### Per-project lazy loading

`assets/dumps/build_lazy_chunks.py` derives `src/data/by-project/<project id>.json`
(173 chunks, 19.7 MB total, median 82 KB, p90 261 KB, max 606 KB) plus the two
indexes, `ci_header.json` and `search_bodies.json` from the monolithic seeds. **The
monoliths stay canonical** — the extract scripts keep writing them and nothing in
`src/` imports them. Re-run the script after any reseed:

```bash
python3 assets/dumps/build_lazy_chunks.py            # rebuild
python3 assets/dumps/build_lazy_chunks.py --verify   # non-zero if stale
```

A chunk holds one project's `files` `tree` `commits` `contributors` `branches`
`tags` `treeLastCommits` `notes` `resourceEvents` `mrDiffs` `pipelines`
`issueBodies` `mrBodies`. `src/data/lazy.js` loads them with `import.meta.glob`
+ `import()`, never evicts one, and notifies `AppContext`, which re-commits the
same core so the merge is rebuilt through the **one** materialization point.

**The gate.** `useProjectChunk()` in `src/App.jsx` resolves the route's project
(including a fork's origin, via `state.repo.forkOrigin`) and `App` returns
`null` until that chunk is in memory — the same early return that already
covered state hydration. A project route therefore never renders half-loaded:
an agent deep-linked onto `/byteblaze/dotfiles/-/merge_requests/40/diffs` gets
the real diff on first paint, not an empty state that fills in a tick later.
`/search?search=…` additionally awaits `search_bodies.json`, because GitLab
without Elasticsearch matches issue/MR **description** as well as title.

**Why issues and MRs are not per-project.** The navbar's assigned-issue counts,
both sidebars' open counts, `/dashboard/issues`, `/dashboard/merge_requests`,
`/dashboard/milestones`, `/search` and the group rollups read across every
project on every route — and `overlay.reconcileCollection()` derives deletion
tombstones from the base array, so a partially loaded base would tombstone every
unloaded project's issues on the first write. `notes` is safe to load partially
because its only two consumers (`IssueDetail`, `MergeRequestDetail`, through
`NotesTimeline`) are project routes behind the gate.

Measured cold-load payload for `/byteblaze/dotfiles`:

| | eager seed bytes | FCP `npm run preview` | FCP `npm run dev` |
|---|---|---|---|
| before | ~24 MB | 432 ms | 580 ms |
| after | **2.34 MB** + one 104 KB chunk | **172 ms** | **376 ms** |

And with the corpus deliberately inflated to **139 MB** (every chunk except
`byteblaze/dotfiles`' padded 5x, `search_bodies` 5x, `dist` 107 MB), preview FCP
on that route was **184 ms** — inside the run-to-run spread of the 172 ms
figure. That is the property this design exists for: **first paint no longer
scales with total corpus size.** What it still scales with is the eager index,
at ~160 B per issue and ~220 B per merge request.

### Why the corpus is frozen

Those 12 modules used to be copied into `createInitialData()`, which made the
cold state **2 072 728 bytes**. Chrome bills `localStorage` in UTF-16 and a
session needs two keys (`webarena_gitlab_mock_state_<sid>` and
`…_initial_state_<sid>`), so a cold session claimed
2 × 2 068 670 = **4 137 340 of the ~5 242 880-unit origin quota — 79 %, before
the agent did anything.** GitLab's task set is overwhelmingly creative (49
"create", 22 "star", 20 "assign", 18 "merge", 15 "invite", 13 "close"), so a
handful of mutations crossed the quota; `persist()` swallowed the
`QuotaExceededError`, dropped both keys, and persistence died **silently**.
Every mutation also POSTed all 2.07 MB, and every `/go` returned 4.15 MB.

Measured after the refactor:

| | before | after |
|---|---|---|
| cold state (`createInitialData()`, minified UTF-8) | 2 072 728 B | **1 473 B** |
| two localStorage keys | 4 137 340 UTF-16 units = **78.9 % of quota** | **2 946 units = 0.06 %** |
| `GET /go` cold, whole payload | 4 145 507 B | **2 997 B** |
| `GET /go` after one star | 4 146 855 B | **4 315 B** (961×) |
| `POST /post` body per mutation | 2 072 797 B | **~2–5 KB** |
| first contentful paint (`npm run preview`) | 448 ms | **372 ms** |

There is no longer a meaningful state budget to blow: the ~1-2 MB ceiling in
`WEBARENA_MIGRATION.md §4.4` now constrains only what a *task* injects, not the
seed. **`assets/data_model.md §12.1` still governs the corpus itself** — notes
may not be sampled down, because 36 of the 252 anchor strings occur verbatim
inside note bodies.

⚠️ **A stale `.mock-states/<sid>.json` can no longer pin an old corpus.** A
snapshot taken before this refactor carries the full arrays;
`overlay.baseArray()` honours them as the base, so it renders — but it renders
*that snapshot's* corpus rather than `src/data/`. Delete stale snapshots
whenever the seed changes.

### The overlay keys

For each frozen collection `X` (state key), three flat top-level keys:

| Key | Type | Holds |
|---|---|---|
| `new<X>` | array | records the agent CREATED, in insertion order, carrying their current value. An edit to a created record is applied in place here. |
| `<x>Edits` | object | `{ "<key>": fullRecord }` — the replacement value for a FROZEN record the agent edited. Wins over the frozen row at materialization. |
| `deleted<X>` | array | keys of FROZEN records the agent removed (tombstones). A created record that is deleted simply leaves `new<X>`. |

Exact names: `newUsers`/`userEdits`/`deletedUsers`,
`newProjects`/`projectEdits`/`deletedProjects`,
`newGroups`/`groupEdits`/`deletedGroups`,
`newIssues`/`issueEdits`/`deletedIssues`,
`newMergeRequests`/`mergeRequestEdits`/`deletedMergeRequests`,
`newNotes`/`noteEdits`/`deletedNotes`,
`newLabels`/`labelEdits`/`deletedLabels`,
`newMilestones`/`milestoneEdits`/`deletedMilestones`,
`newMembers`/`memberEdits`/`deletedMembers`,
`newTodos`/`todoEdits`/`deletedTodos`,
`newStars`/`starEdits`/`deletedStars`,
`newFollows`/`followEdits`/`deletedFollows`.

The record `key` is `String(id)` for the ten id-keyed collections. `stars` and
`follows` have no id in the source either — they are join rows — so their key is
the composite `"<project_id>:<user_id>"` and `"<follower_id>:<followee_id>"`,
which is also how `stateTracker.js` already set-diffs them.

`snippets`, `groupLinks`, `repo`, `ui`, `nextIds` and `currentUser` are NOT
overlaid: nothing about them is frozen, so they stay plain state keys and their
diff shape is unchanged.

### Reading and writing it

There is exactly **one** materialization point, `overlay.materialize(core)`,
called only by `AppProvider.commit()`. `AppProvider` holds two objects:

```
core    the persisted state — overlay keys + currentUser/repo/ui/nextIds/snippets
state   materialize(core) — core plus the twelve fully merged arrays
```

Every component reads `useApp().state`, so the project issue list, the issue
detail page, `/dashboard/issues`, `/dashboard/merge_requests`,
`/dashboard/todos`, the user profile, `/search`, the activity feeds, the boards
and the milestone pages cannot disagree about whether a record exists.
`useApp().coreState` exposes the delta for inspection.

The write side is a **reconciler**, not a set of overlay verbs. All 79 write
sites were left untouched: a reducer is still handed the merged `state` and
still returns a merged `state`, and `overlay.dematerialize()` derives the delta
from what it returned. Immutable reducers return untouched collections
reference-identically, so 11 of 12 are skipped in O(1) per write and only the one
that changed is scanned. The reasoning is in the header of
`src/utils/overlay.js`; `assets/dumps/test_overlay.py` is the regression suite.

---

Seven of the eleven static modules are git-derived and reached through the
`dataManager.js` accessors, so the `state.repo` overlays always apply:

```js
getRepoFile(state, project, ref, path)   // fileOverlay  -> repo_files.json
getRepoTree(state, project, ref)         // treeOverlay + fileOverlay tombstones
getCommits(state, project, ref)          // commitOverlay -> commits.json
getBranches(state, project)              // branchOverlay + branchDeletions
getTags(state, project)                  // tagOverlay + tagDeletions
getContributors(project, ref, state)     // contributors.json (read-only)
getMrDiff(mr)                            // merge_request_diffs.json (read-only)
```

The other six are imported directly by the one page or helper that renders
them and are equally static. (Sizes in this table are as of the round that
added each file; `resource_events.json`, `merge_request_diffs.json` and the two
issue/MR modules all grew with round 20's 5x expansion — see
`DEV.part-data.md` for the current figures.)

| Module | Size | Imported by | Holds |
|---|---|---|---|
| `tree_last_commits.json` | 369 KB | `src/pages/RepoTree.jsx:12` | per-path "last commit" for the tree view's **Last commit** / **Last update** columns and the blob page's commit well. 173 projects, 3 435 paths, 1 721 commits. |
| `resource_events.json` | 168 KB | `src/pages/NotesTimeline.jsx:10` | GitLab's `resource_state_events` / `resource_label_events` / `resource_milestone_events` (1 207 rows). Since 11.x these are *not* in the `notes` table, so the timeline was missing every close/reopen, label and milestone event without it. |
| `repo_languages.json` | 12 KB | `src/pages/ProjectOverview.jsx` | `repository_languages` × `programming_languages` — name, hex colour and share for 151 projects, 407 rows. Drives the `.repository-languages-bar` strip (TEST.md DIFF-907). |
| `ci_pipelines.json` | 1 037 KB | `src/utils/ci.js` (→ `src/pages/PipelinesCi.jsx`) | **round 12, TEST.md DIFF-1105.** The project CI/CD surface: **all 1 465 pipelines and all 14 179 jobs** the source has, across the **67** of 175 seeded projects that have any — complete, not sampled. Drives `/-/pipelines`, `/-/pipelines/:id`, `/-/pipelines/charts`, `/-/jobs` and `/-/jobs/:id`. Shape in `assets/data_model.md §11b`. |
| `releases.json` | 1 384 KB | `dataManager.getReleases()` (→ `src/pages/Releases.jsx`) | **round 20.** `{_source, _static, _page_size: 10, projects: {<id>: [{id, tag, name, description, author_id, released_at, created_at}]}}` — **all 1 732 releases** the source has, across the **48** of 175 projects that have any; complete, not sampled. Drives `/-/releases` and `/-/releases/:tag`. `sha` is empty for every row upstream and is not carried; `released_at` is emitted `AT TIME ZONE 'UTC'` so `format.js:parseDate` accepts it. Sliced into the lazy per-project chunks as `releases`. |
| `boards.json` | 4 KB | `src/pages/Boards.jsx` | **round 20.** The 9 `boards` rows and their 18 `lists`. All nine are the DEFAULT board GitLab creates lazily on the first visit to `/-/boards` — same name (`Development`), same two lists (`backlog` + `closed`), both `hide_*` flags false — so they are the 9 projects someone opened a board on, not 9 configurations. Supplies the board name and list set; a project without a row gets the same default, which is what the source creates for it. Eager (4 KB), not chunked. |

`merge_request_diffs.json` (478 KB) joins them as a git-derived module read only
through `getMrDiff()`: 729 merge requests, 2 543 diff commits, 112 pipelines —
an MR's own commit list, its `Commits` / `Pipelines` / `Changes` badge counts,
and the pipeline row its Pipelines tab shows (TEST.md DIFF-901). Round 12's
`ci_pipelines.json` is the project-level counterpart, and is why the MR
Pipelines tab and the project pipelines list no longer contradict each other.

**None of them may enter `createInitialData()`.** They are historical and
nothing mutates them, so they would be pure dead weight in every POSTed state —
the same reason the twelve mutable modules are now frozen too.
`assets/data_model.md §11` and `§11a` describe their shapes.

A cold session payload is now ~2 KB. `dataManager.persist()` writes
the current-state key to localStorage first and only then the baseline key, so
`initialKey present ⇒ storageKey present`. If a write exceeds the browser quota
both keys are dropped and the next load rehydrates from
`.mock-states/<sid>.json` via `fetchServerState()`. That guard is now only
reachable through a legacy full-array injection — an overlay-sized session is
0.06 % of quota — but it is kept for exactly that case. `/go`'s diff stays
correct either way: harness `{action:'set'}` replaces both current and initial
files on every call, while `{action:'set_current'}` writes current only.
`AppContext` checks server current and initial state before trusting localStorage,
so a reinjection or server reset wins over a warm browser cache. If the server
has genuinely lost one or both files, the client uses the internal guarded
`restore` action; it only fills files that are still absent or equal, so a
concurrent harness injection cannot be overwritten. `POST /post` bodies are
coalesced per tick, serialized across ticks and gzipped by the client when
`CompressionStream` exists and inflated by the server, with a transparent plain
fallback. `flushState()` resolves after queued writes land and rejects on a
failed request.

---

## Injecting task state

`POST /post?sid=<sid>` `{"action":"set","state":{…}}`. Both shapes work, and
`assets/dumps/test_overlay.py §2` proves they render identically:

**Lightweight (preferred).** Inject only the delta and let the frozen corpus
stand — one record instead of 613:

```json
{"action": "set", "state": {
  "newIssues": [{"id": 900001, "iid": 1600, "project_id": 174, "title": "…", "…": "…"}],
  "issueEdits": {"83395": {"id": 83395, "title": "edited", "…": "…"}},
  "deletedIssues": ["83396"]
}}
```

**Legacy (still supported).** Inject a full array and it becomes the BASE —
`overlay.baseArray()` prefers `core.issues` over the frozen corpus, so the app
renders exactly what it rendered before this refactor, with the overlay applying
on top:

```json
{"action": "set", "state": {"issues": [ /* …613 rows… */ ]}}
```

`initializeData()` merges shallowly and runs the result through
`overlay.toCore()`, so a fixture never has to spell out all 36 overlay keys.

---

## State Schema

This is the **materialized** state — `overlay.materialize(core)`, what every
component reads as `useApp().state`. The twelve rows marked 🧊 are frozen corpus
merged with the session's overlay and are **not** persisted under these names;
what `/go` returns for them is the `new<X>` / `<x>Edits` / `deleted<X>` keys
described above. The record shapes below are what a reader sees either way, and
are what an injected record must match.

| Key | Type | Description |
|-----|------|-------------|
| `currentUser` | object | byteblaze, id `2330`. Same shape as a `users` row. Mirrors `users[2330]` — profile edits write **both**. Also carries `two_factor_enabled` once `/-/profile/account` toggles it. |
| 🧊 `users` | array | 1 133 real users. Always `{id, username, name, email, state, created_at, followers, following}`; optionally `bio`, `location`, `organization`, `feed_token` (byteblaze only), `status`, `website_url`, `job_title`, `pronouns`. `status` is `{emoji, message, availability}` or `null`. |
| 🧊 `projects` | array | 175 real projects. `{id, full_path, path, name, namespace{id,path,name,kind}, description, visibility, star_count, forks_count, archived, created_at, last_activity_at, default_branch, commit_count, repo_size, open_issues_count, closed_issues_count, open_mrs_count, merged_mrs_count, closed_mrs_count}`. Written by tasks: `topics`, `forked_from` (`{id, full_path, name, name_with_namespace}` on forks), `feature_settings`, `request_access_enabled`, `default_branch` (Branch defaults on `/-/settings/repository`). Four optional container-derived flags are present **only where they deviate from GitLab's default**, and drive the Auto DevOps banner predicate (`Layout.jsx`): `auto_devops_enabled:false` (67 projects with an explicit `project_auto_devops` row — absent means the project inherits the instance default, which is ON), `has_ci_config:true` (2), `builds_enabled:false` (1), `empty_repo:true` (2). A fifth, `auto_devops_quick_link:true` (99 projects, +2 970 bytes of cold state), is separate and drives only the `Auto DevOps enabled` **quick link** on the project overview (TEST.md **DIFF-1308**, round 16). It is measured off the source per project rather than derived from `auto_devops_enabled`: all 67 explicit opt-outs hide the link, but 9 of the 108 that inherit ON also hide it and only 4 of those are explained by the other three flags. |
| 🧊 `groups` | array | 2 real groups (`{id, path, name, description, visibility}`). Group creation appends here. |
| 🧊 `issues` | array | 613 issues. `{id, iid, project_id, title, description, author_id, state:'opened'\|'closed', confidential, due_date, milestone_id, assignee_ids[], label_ids[], created_at, updated_at, closed_at, closed_by_id, upvotes, user_notes_count}`. `closed_at`/`closed_by_id` are **null on all 613 rows, matching the source** — the snapshot populated `issues.closed_at` on 1 row in 80 962 (`assets/data_model.md §4.1`); they are written when a task closes an issue. Written by tasks: `downvotes`, `awards[]`, `time_estimate`, `total_time_spent`, `discussion_locked`, `moved_from`. |
| 🧊 `mergeRequests` | array | 729 MRs. `{id, iid, project_id, source_project_id, title, description, author_id, state:'opened'\|'closed'\|'merged', draft, source_branch, target_branch, milestone_id, merge_status, assignee_ids[], reviewer_ids[], label_ids[], created_at, updated_at, merged_at, merged_by_id, user_notes_count, squash}`. `merged_at`/`merged_by_id` are the round-5 backfill off `merge_request_metrics` — populated on 286 / 210 rows, null elsewhere (`assets/data_model.md §5.1`); they back `?sort=merged_at`. There is deliberately **no seeded `closed_at`**: the source's `merge_request_metrics.latest_closed_at` is set on 1 row in 134 338 (§5.2). Written by tasks: `upvotes`, `downvotes`, `awards[]`, `discussion_locked`, `merge_commit_message`, `closed_at`, `closed_by_id`. |
| 🧊 `notes` | array | 1 599 notes. `{id, noteable_type:'Issue'\|'MergeRequest', noteable_id, project_id, author_id, body, system, created_at, updated_at}`. `system:true` rows are the grey activity lines and are excluded from `user_notes_count`. **`discussion_id`, `type`, `resolved_at` and `resolved_by_id` were removed from the seed** (see above); `NotesTimeline.jsx` still writes the first three on notes it creates. |
| 🧊 `labels` | array | 630 labels. `{id, project_id, title, color, description, created_at}` (+ `updated_at` once edited). |
| 🧊 `milestones` | array | 202 milestones. `{id, iid, project_id, title, description, state:'active'\|'closed', start_date, due_date, created_at, updated_at}` |
| 🧊 `members` | array | 183 memberships. `{id, source_type:'project'\|'namespace', source_id, user_id, access_level, access_label, created_at, expires_at, created_by_id}`. **Request Access** (ROUTES #97) appends a row carrying an extra `requested_at`; such a row is an access *request*, not a membership, and `MembersTable` excludes it — which is what GitLab does (requests live behind a Maintainer-only tab). **Leave project** (ROUTES #96) removes the row. |
| 🧊 `stars` | array | 569 stars. `{project_id, user_id, created_at}` — set-diffed, no id. |
| 🧊 `follows` | array | 5 follows. `{follower_id, followee_id}` — set-diffed, no id. |
| 🧊 `todos` | array | 7 todos. `{id, user_id, project_id, target_id, target_type, author_id, action, state:'pending'\|'done', created_at, group_id}` |
| `snippets` | array | `[]` in the seed — the source instance has no snippets. The key still needs a baseline, or a created snippet lands in the diff as `{"new": […]}` with no `old`. `{id, title, description, file_name, content, visibility, author_id, created_at}`. Ids are `1 + max(existing)`, **not** from `nextIds`. |
| `groupLinks` | array | **Absent from the seed; created on first use** by *Invite a group* on a members page. `{id, source_type:'project'\|'namespace', source_id, group_id, group_name, group_path, access_level, access_label, expires_at}`. Ids are `1 + max(existing)`, not from `nextIds`. The members page's **Groups** tab only renders when this is non-empty — which is what the source does. |
| `repo` | object | git overlays — see below |
| `ui` | object | client-only view state — see below |
| `nextIds` | object | id allocators — see below |

`access_level` → `access_label` (exact wording; the WebArena evaluator helper
`gitlab_get_project_memeber_role` reads it out of the Max-role cell):
`5 Minimal Access`, `10 Guest`, `20 Reporter`, `30 Developer`, `40 Maintainer`,
`50 Owner`.

### `state.repo` — git overlays

The six git modules are static. Everything a task writes to a repository lands
here and shadows them. Five overlays are **additive**, one is an **alias**, and
two are **subtractive**.

| Key | Key format | Value | Written by |
|---|---|---|---|
| `fileOverlay` | `"<full_path>:<ref>:<path>"` | file body string, or `null` = deleted (tombstone) | new file, edit file, delete file, Web IDE, project create |
| `treeOverlay` | `"<full_path>:<ref>"` | extra `{path,type,mode,size,sha}` entries appended to `repo_trees.json` | same |
| `commitOverlay` | `"<full_path>:<ref>"` | commits **prepended** (newest first) to `commits.json`; `{sha, author_name, author_email, authored_date, committed_date, title}` | same |
| `branchOverlay` | `"<full_path>"` | extra `{name, sha, committed_date, subject}` | new branch, project create |
| `tagOverlay` | `"<full_path>"` | extra `{name, sha, date, message}` | new tag |
| `forkOrigin` | `"<fork full_path>"` | `"<source full_path>"` | **fork a project** |
| `branchDeletions` | `"<full_path>"` | `["<branch name>", …]` | `Delete branch`, `Delete merged branches` |
| `tagDeletions` | `"<full_path>"` | `["<tag name>", …]` | `Delete tag` |

`/-/raw/:ref/*path` and `/-/blob/:ref/*path` serve `fileOverlay` first and fall
back to `repo_files.json`, so a task that edits `index.html` and then reads it
back sees its own edit.

**`forkOrigin` is an alias, not a copy.** A fork has no entry in
`repo_files`/`repo_trees`/`commits`/`branches`/`tags`. Rather than copying the
source repo's blobs into `fileOverlay` — which used to drag ~57 KB per fork into
every POSTed state — `forkProject()` writes one string here and every static read
resolves through `originPath()`. Overlay reads keep using the **fork's own** path,
so an edit made after the fork stays local to the fork. Fork-of-a-fork chains are
followed; a cycle stops at the repeat. A driven fork emits exactly
`['projects', 'members', 'repo.forkOrigin.<fork path>', 'nextIds.project', 'nextIds.member']`.

**`branchDeletions` / `tagDeletions` are the subtractive channel.** The other
overlays only add, so before round 4 the three delete controls on
`/-/branches` and `/-/tags` had nowhere to write. `getBranches` / `getTags` now
filter the merged static+overlay list through these, so a name listed here
disappears whether it came from the static module or from the additive overlay.
`dataManager.js` exports `deleteRefs(state, project, kind, names)` and
`undeleteRef(state, project, kind, name)`; both are pure and idempotent.

### `state.ui` — client-only view state (persisted, but never a task anchor)

Only five keys exist in the seed; the rest are **created on first use** by the
page that owns them. A `/go` diff on a fresh key therefore reads `{"old": null,
"new": …}` rather than appearing as a change.

| Key | In seed | Type | Written by |
|---|---|---|---|
| `notificationLevels` | ✔ `{}` | object | `/-/profile/notifications` — `"global"` / `"project:<id>"` → level |
| `sidebarCollapsed` | ✔ `false` | bool | left contextual sidebar |
| `dismissedAlerts` | ✔ `[]` | string[] | dismissed page banners |
| `preferences` | ✔ `{colorScheme, syntaxTheme}` | object | `/-/profile/preferences` — grows `themeId`, `colorSchemeId`, `layout`, `dashboard`, `projectView`, `tabWidth`, `language`, `firstDayOfWeek`, `timeDisplayRelative`, `render_whitespace_in_code`, `show_whitespace_in_diffs`, `view_diffs_file_by_file`, `markdown_surround_selection`, `markdown_automatic_lists` |
| `projectSettings` | ✔ `{}` | object | the project-settings routes (ROUTES #99–#105), keyed by project `full_path`. One bucket per project, created on first submit: `{branchNameTemplate, autocloseReferencedIssues, mirrors[], protectedBranches[], protectedTags[], deployTokens[], deployKeys[], accessTokens[], merge, ci, ciVariables[], triggers[], deployFreezes[], hooks[], operations, packages}`. `protectedBranches` starts as the project's default branch protected at `Maintainers`/`Maintainers`, which is what the source shows. See `src/pages/projectSettingsStore.js`. |
| `unsubscribed` | — | string[] | issue/MR sidebar Notifications toggle — `"Issue:<id>"` / `"MergeRequest:<id>"` |
| `labelSubscriptions` | — | number[] | **Subscribe** on the labels list |
| `prioritizedLabels` | — | number[] | star-a-label on the labels list |
| `sshKeys` | — | array | `/-/profile/keys` — `{id, title, key, expires_at, created_at}` |
| `emails` | — | string[] | `/-/profile/emails` |
| `accessTokens` | — | array | `/-/profile/personal_access_tokens` — `{id, name, expires_at, scopes[], created_at, token}` |
| `feedToken` | — | string | **reset this token** on `/-/profile/personal_access_tokens`. Shadows `currentUser.feed_token`; readers do `ui.feedToken \|\| currentUser.feed_token`. |

There is deliberately **no** `ui.starredProjectIds`. `state.stars` is the single
source of truth for starring and is what every reader uses (`ProjectOverview`,
`DashboardProjects`, `UserProfile`, `Starrers`). The derived copy that used to
live here emitted a second signal for the same action into every diff.

### `state.nextIds`

Created records must never collide with real container ids. The counters are
**derived at module load** as `max(seed id) + 1` (`SEED_NEXT_IDS` in
`dataManager.js`), never hard-coded:

```
project 194 · group 7 · issue 83821 · mr 139278
note 310827 · label 1927 · milestone 590 · member 206
```

They used to be literals (`label: 1800`, `note: 310000`) chosen by eye, and both
started *inside* the real id range — 104 seeded labels sit at id ≥ 1800 and 111
seeded notes at id ≥ 310000. The 6th label a task created was allocated 1805,
already taken, so `stateTracker`'s `indexBy()` collapsed the pair and `/go`
reported the **creation as an edit to a seeded record**. Deriving the floor means
that cannot come back when the seed is resampled. (`PIPELINE-001` — closed.)

`allocateId(kind)` on the app context *reserves* an id and returns it
synchronously, parking the counter bump in a ref that the caller's own `setState`
folds into the same write. So one logical mutation is exactly one `POST /post`,
and `/go` can never observe a half-applied state. `allocateId` also scans the
target collection and skips past any id a task injected at or above the counter.

`snippets`, `groupLinks` and `todos` have no counter — each derives its next id
from its own collection (`1 + max(existing)`).

### Default IDs

- **Current user**: `2330` / `byteblaze` ("Byte Blaze")
- **Projects**: real GitLab ids `1`–`193`, addressed by `full_path`
  (`byteblaze/dotfiles` = 193, `byteblaze/timeit` = 190,
  `byteblaze/a11y-webring.club` = 179, `byteblaze/empathy-prompts` = 183,
  `byteblaze/a11y-syntax-highlighting` = 186)
- **Groups**: `2` (`gitlab-instance-58545a48`), `6` (`robert1003`)
- **Issues**: real ids up to `83820`, per-project `iid`
- **Merge requests**: real ids up to `139277`
- **Notes**: real ids up to `310826`
- **Labels**: real ids up to `1926`
- **Milestones**: real ids up to `589`
- **Members**: real ids up to `205`
- **Byteblaze's starred projects**: `174`, `183`, `185`

## Minimal Inject Example

A task only has to supply what it cares about — `initializeData()` merges the
injected object over `createInitialData()`, runs it through `overlay.toCore()`
so the 35 overlay keys it omitted are filled in, and merges `repo`, `ui` and
`nextIds` key-by-key so partial subtrees keep their defaults.

**Preferred — inject the delta.** The frozen corpus stands; this adds one issue,
retitles a frozen one, removes another, stars a project and gives byteblaze an
Owner membership. Nine records, not 3 500:

```json
{
  "action": "set",
  "state": {
    "newIssues": [
      {
        "id": 83821, "iid": 1600, "project_id": 174, "title": "Add a dark mode",
        "description": "", "author_id": 2330, "state": "opened",
        "confidential": false, "due_date": null, "milestone_id": null,
        "assignee_ids": [2330], "label_ids": [], "created_at": "2023-05-01 10:00:00",
        "updated_at": "2023-05-01 10:00:00", "closed_at": null, "closed_by_id": null,
        "upvotes": 0, "user_notes_count": 0
      }
    ],
    "issueEdits": {
      "83395": { "id": 83395, "iid": 1408, "project_id": 174, "title": "Retitled by the task", "…": "…" }
    },
    "deletedIssues": ["83396"],
    "newStars": [ { "project_id": 193, "user_id": 2330, "created_at": "2023-05-01 10:00:00" } ],
    "newMembers": [
      { "id": 206, "source_type": "project", "source_id": 193, "user_id": 2330,
        "access_level": 50, "access_label": "Owner", "created_at": "2023-05-01 10:00:00",
        "expires_at": null, "created_by_id": 2330 }
    ],
    "nextIds": { "issue": 83822, "member": 207 },
    "ui": { "preferences": { "colorScheme": "dark" } }
  }
}
```

An entry in `issueEdits` / `deletedIssues` must carry the **full** record and the
**id** as its key (`"<project_id>:<user_id>"` for `stars`,
`"<follower_id>:<followee_id>"` for `follows`). A record put in `newIssues`
should use an id at or above `nextIds.issue`, and `nextIds` should be advanced
past it, or `allocateId`'s collision scan will skip over the injected id and the
counter will look stale.

**Legacy — inject a full array.** Still supported and still renders exactly what
it rendered before the overlay refactor: an array under a corpus name becomes the
BASE, replacing the frozen module wholesale, and the overlay keys apply on top.
Use this only when a task genuinely needs a different corpus; it costs the full
payload and can reach the localStorage quota again.

```json
{
  "action": "set",
  "state": {
    "currentUser": {
      "id": 2330, "username": "byteblaze", "name": "Byte Blaze",
      "email": "ericwbailey@fakegithub.com", "state": "active"
    },
    "users": [
      {"id": 2330, "username": "byteblaze", "name": "Byte Blaze", "email": "ericwbailey@fakegithub.com", "state": "active", "followers": 0, "following": 0}
    ],
    "projects": [
      {
        "id": 193, "full_path": "byteblaze/dotfiles", "path": "dotfiles", "name": "dotfiles",
        "namespace": {"id": 2505, "path": "byteblaze", "name": "Byte Blaze", "kind": "user"},
        "description": "🤖 Computer setup", "visibility": "public",
        "star_count": 0, "forks_count": 0, "archived": false,
        "default_branch": "main", "commit_count": 3, "repo_size": 0,
        "open_issues_count": 0
      }
    ],
    "issues": [], "mergeRequests": [], "notes": [], "labels": [],
    "milestones": [], "groups": [], "stars": [], "follows": [], "todos": [],
    "members": [
      {"id": 202, "source_type": "project", "source_id": 193, "user_id": 2330, "access_level": 50, "access_label": "Owner", "created_at": "2023-03-27 20:37:47", "expires_at": null, "created_by_id": 2330}
    ]
  }
}
```

⚠️ An empty array is **not** "leave the corpus alone" — it is "the corpus is
empty". Omit the key to keep the frozen module.

## Observable State Changes (for LLM evaluation)

Every row flows through `AppContext.setState()` → `overlay.dematerialize()` →
`saveState()` → `POST /post?sid=<sid>` `{action:'set_current'}` →
`.mock-states/<sid>.json` → `/go` `state_diff`.

**Legend.** ✅ = driven in chromium during the round-4 schema pass and the listed
keys are the captured diff. ⚠ = the control is reachable and its handler is
known, but the drive did not complete the flow, so the keys come from the handler.

### ⚠️ Reading this table after the overlay refactor

The **User Action** and **Route** columns are unchanged, and so is which *record
field* moves. What changed is the **key that field's change appears under**,
because a frozen collection is no longer in state. Every row below translates
mechanically — `X` is the state key, `<key>` is `String(id)` (or the composite
for `stars`/`follows`):

| the table says | `/go` `state_diff` now contains |
|---|---|
| `X.added` (a created record) | `newX` → `{"old": [], "new": [ …the record… ]}` |
| `X.changed` → `X[].field` on a **frozen** record | `xEdits.<key>` → `{"new": { …the whole record, field updated… }}` |
| `X.changed` → `X[].field` on a record the agent **created** earlier | `newX` → `{"old": [ …before… ], "new": [ …after… ]}` |
| `X.removed` on a **frozen** record | `deletedX` → `{"old": [], "new": ["<key>"]}` |
| `X.removed` on a record the agent **created** | the record leaves `newX`; `newX` shows the shorter array |

Rows naming `repo.*`, `ui.*`, `nextIds.*`, `currentUser`, `snippets` or
`groupLinks` are **unaffected** — those keys are still plain state and their diff
shape is exactly as documented.

`xEdits.<key>` carries only `new`, never `old`, because the pre-edit value is not
in state to compare against. It is not lost: the frozen record is in
`src/data/<module>.json`, checked in and deterministic, so a consumer that wants
the before-value looks it up by id there. (`users.json` `projects.json`
`groups.json` `issues.json` `merge_requests.json` `notes.json` `labels.json`
`milestones.json` `members.json` `todos.json` `stars.json` `follows.json`.)

### Projects & repository

| User Action | Route | State keys in `state_diff` | |
|---|---|---|---|
| Star / unstar a project | `/:ns/:proj` | `stars.added` / `stars.removed`; `projects.changed` → `projects[].star_count` | ✅ |
| Create blank project (README on) | `/projects/new#blank_project` | `projects.added`; `members.added` (`source_type:'project'`, level 50 `Owner`); `repo.fileOverlay.<fp>:main:README.md`; `repo.treeOverlay.<fp>:main`; `repo.commitOverlay.<fp>:main`; `repo.branchOverlay.<fp>`; `nextIds.project`; `nextIds.member` | ✅ |
| Create blank project (README off) | `/projects/new#blank_project` | `projects.added`; `members.added`; `nextIds.project`; `nextIds.member` — **no repo overlays**, the repo is genuinely empty | ✅ |
| Create project from template | `/projects/new#create_from_template` | as README-on, commit title `Initialized from '<T>' project template`, template files in `repo.fileOverlay` | ⚠ |
| Fork a project | `/:ns/:proj/-/forks/new` | `projects.added` (with `forked_from`); `projects.changed` → `projects[].forks_count` on the source; `members.added`; **`repo.forkOrigin.<fork full_path>`**; `nextIds.project`; `nextIds.member`. No blob copy — see `state.repo` above. | ✅ |
| Create a file | `/:ns/:proj/-/new/:ref` | `repo.fileOverlay.<fp>:<ref>:<path>`; `repo.treeOverlay.<fp>:<ref>`; `repo.commitOverlay.<fp>:<ref>`; `projects.changed` → `projects[].commit_count`, `.repo_size`, `.last_activity_at` | ✅ |
| Edit a file | `/:ns/:proj/-/edit/:ref/*path` | same keys, `fileOverlay` value replaced | ✅ |
| Delete a file | `/:ns/:proj/-/edit/:ref/*path` (delete) | `repo.fileOverlay.<fp>:<ref>:<path>` set to `null` (tombstone); `repo.commitOverlay.<fp>:<ref>`; `projects[].commit_count`, `.last_activity_at` | ✅ |
| Commit from the Web IDE | `/-/ide/project/:ns/:proj/edit/:ref/-/*` | identical to *edit a file* | ✅ |
| Create a branch | `/:ns/:proj/-/branches/new` | `repo.branchOverlay.<fp>` | ✅ |
| Create a tag | `/:ns/:proj/-/tags/new` | `repo.tagOverlay.<fp>` | ✅ |
| **Delete a branch / Delete merged branches** | `/:ns/:proj/-/branches` | **`repo.branchDeletions.<fp>`** — array of deleted names | ⚠ |
| **Delete a tag** | `/:ns/:proj/-/tags` | **`repo.tagDeletions.<fp>`** | ⚠ |
| Rename / re-describe / re-topic a project | `/:ns/:proj/edit` | `projects.changed` → `projects[].name`, `.description`, `.topics` | ✅ |
| Change visibility & feature permissions | `/:ns/:proj/edit` | `projects.changed` → `projects[].visibility`, **`projects[].feature_settings`**, `projects[].request_access_enabled`. `feature_settings` is one object keyed by feature — `{issues, repository, merge_requests, forking, lfs, builds, analytics, security_and_compliance, wiki, snippets, package_registry, monitor, metrics_dashboard, environments, feature_flags, infrastructure, releases}` — each `{enabled: bool, level: "10"\|"20"}` (`10` = Only Project Members, `20` = Everyone With Access). | ✅ |
| Archive / unarchive a project | `/:ns/:proj/edit` (Advanced) | `projects.changed` → `projects[].archived` | ✅ |
| Change project path | `/:ns/:proj/edit` (Advanced) | `projects.changed` → `projects[].path`, `.full_path` | ✅ |
| Delete a project | `/:ns/:proj/edit` (Advanced) → *Yes, delete project* | `projects.removed`; `members.removed` (its rows) | ✅ |

### Groups & members

| User Action | Route | State keys in `state_diff` | |
|---|---|---|---|
| Create a group | `/groups/new#create-group-pane` | `groups.added`; `members.added` (`source_type:'namespace'`, level 50 `Owner`); `nextIds.group`; `nextIds.member` | ✅ |
| Rename / re-describe a group, change visibility | `/groups/:group/edit` | `groups.changed` → `groups[].name`, `.description`, `.visibility` | ✅ |
| Change group path | `/groups/:group/edit` | `groups.changed` → `groups[].path`; `projects.changed` → `projects[].namespace`, `.full_path` for every project inside it | ✅ |
| Delete a group | `/groups/:group/edit` | `groups.removed`; `members.removed` | ✅ |
| Invite project / group members | `/:ns/:proj/-/project_members`, `/groups/:g/-/group_members` | `members.added` (one row per invitee, **one** POST for the whole submit); `nextIds.member` | ✅ |
| **Invite a group** ("Groups" tab) | same | **`groupLinks`** — whole-value diff, `{old, new}`; the collection is created on first use | ✅ |
| Remove a group share | members page, Groups tab | `groupLinks` | ⚠ |
| Import members from another project | members page | one `members.added` row per imported user; `nextIds.member` | ⚠ |
| Change a member's Max role | members table | `members.changed` → `members[].access_level`, `.access_label` | ⚠ |
| Set a membership expiry date | members table | `members.changed` → `members[].expires_at` | ⚠ |
| Remove a member (± unassign issuables) | members table | `members.removed`; optionally `issues.changed` → `issues[].assignee_ids` and `mergeRequests.changed` → `mergeRequests[].assignee_ids`, `.reviewer_ids` | ⚠ |

### Issues & merge requests

| User Action | Route | State keys in `state_diff` | |
|---|---|---|---|
| Create an issue | `/:ns/:proj/-/issues/new` | `issues.added` (`iid` = per-project max + 1); `nextIds.issue` | ✅ |
| Edit an issue | `/:ns/:proj/-/issues/:iid/edit` | `issues.changed` → `issues[].title`, `.description`, `.assignee_ids`, `.label_ids`, `.milestone_id`, `.due_date`, `.confidential`, `.updated_at` | ✅ |
| Close / reopen an issue | issue detail | `issues.changed` → `issues[].state`, `.closed_at`, `.closed_by_id`, `.updated_at`; plus `notes.added` (the system note recording it) and `nextIds.note` | ✅ |
| Post a comment on an issue | issue detail | `notes.added`; `issues.changed` → `issues[].user_notes_count`; `nextIds.note` | ✅ |
| 👍 / 👎 / add a reaction | issue or MR detail | `issues.changed` / `mergeRequests.changed` → `[].upvotes`, **`[].downvotes`**, **`[].awards`** (`[{name, count}]`), `.updated_at` | ✅ |
| Assignee / labels / milestone / due date from the sidebar | issue detail | `issues.changed` → the corresponding field + `.updated_at` | ✅ |
| Toggle Confidentiality / Lock issue | issue detail sidebar | `issues.changed` → `issues[].confidential`, **`issues[].discussion_locked`**, `.updated_at` | ✅ |
| **Add a time estimate / time spent** | issue detail sidebar | `issues.changed` → **`issues[].time_estimate`**, **`issues[].total_time_spent`** (strings, e.g. `"2h"`) | ⚠ |
| **Move issue** | issue detail ⋮ → *Move issue* | `issues.changed` → `issues[].project_id`, `.iid`, `.milestone_id`, `.label_ids`, **`issues[].moved_from`** (`"<source full_path>#<source iid>"`), `.updated_at` | ✅ |
| "Add a to do" / mark done on an issue | issue detail sidebar | `todos.added` (`action: 4`, id = `1 + max(existing)`, **not** `nextIds`) or `todos.changed` → `todos[].state` | ✅ |
| Toggle the Notifications switch | issue / MR detail | `ui.unsubscribed` — `"Issue:<id>"` / `"MergeRequest:<id>"` | ✅ |
| Delete an issue | issue detail ⋮ | `issues.removed` | ⚠ |
| Bulk "Edit issues" → Update all issues | `/:ns/:proj/-/issues` | `issues.changed` → `issues[].state`, `.closed_at`, `.assignee_ids`, `.milestone_id`, `.label_ids`, `.updated_at` across every selected row; `ui.unsubscribed` when the subscription select is used | ⚠ |
| Create a merge request | `/:ns/:proj/-/merge_requests/new` | `mergeRequests.added`; `nextIds.mr` | ✅ |
| Edit an MR | `/:ns/:proj/-/merge_requests/:iid/edit` | `mergeRequests.changed` → `[].title`, `.description`, `.assignee_ids`, `.reviewer_ids`, `.milestone_id`, `.label_ids`, `.squash`, `.force_remove_source_branch`, `.draft`, `.updated_at` | ✅ |
| Close / reopen / merge an MR | MR detail | `mergeRequests.changed` → `[].state`, `.merge_status`, `.updated_at` | ✅ |
| Toggle MR draft | MR detail | `mergeRequests.changed` → `[].draft`, `.title` | ⚠ |
| Edit the merge commit message | MR detail | `mergeRequests.changed` → `[].merge_commit_message` | ⚠ |
| Post a comment on an MR | MR detail | `notes.added`; `mergeRequests.changed` → `[].user_notes_count`; `nextIds.note` | ✅ |

### Labels & milestones

| User Action | Route | State keys in `state_diff` | |
|---|---|---|---|
| Create a label | `/:ns/:proj/-/labels/new` | `labels.added`; `nextIds.label` | ✅ |
| Edit a label | `/:ns/:proj/-/labels/:id/edit` | `labels.changed` → `labels[].title`, `.color`, `.description`, `.updated_at` | ✅ |
| Delete a label | labels list | `labels.removed` | ⚠ |
| "Generate a default set of labels" | labels list | one `labels.added` row per missing default; `nextIds.label` | ✅ |
| Request access to a project | project overview of a project you are not a member of | `members.added` — the new row carries `requested_at` | ✅ |
| Withdraw an access request | same | `members.removed` | ✅ |
| Leave a project | project overview of a project you are a member of but do not own | `members.removed`; redirects to `/dashboard/projects` | ✅ |
| Subscribe to a label | labels list | `ui.labelSubscriptions` | ✅ |
| Prioritise (star) a label | labels list | `ui.prioritizedLabels` | ✅ |
| Create a milestone | `/:ns/:proj/-/milestones/new` | `milestones.added` (`iid` = per-project max + 1); `nextIds.milestone` | ✅ |
| Edit a milestone | `/:ns/:proj/-/milestones/:iid/edit` | `milestones.changed` → `[].title`, `.description`, `.start_date`, `.due_date`, `.updated_at` | ⚠ |
| Close / reopen a milestone | milestone detail | `milestones.changed` → `[].state`, `.updated_at` | ⚠ |
| Delete a milestone | milestone detail | `milestones.removed`; `issues.changed` / `mergeRequests.changed` → `[].milestone_id` set to `null` on everything that referenced it | ⚠ |

### People, profile, misc

| User Action | Route | State keys in `state_diff` | |
|---|---|---|---|
| Follow / unfollow a user | `/:username` | `follows.added` / `follows.removed`; `users.changed` → `users[].followers` and `users[].following` on both users | ✅ |
| Set profile name / bio / location / job title / pronouns / website URL | `/-/profile` | `currentUser.<field>` **and** `users.changed` → `users[].<field>` (kept in sync) | ✅ |
| Set / remove profile status | `/-/profile` | `currentUser.status` + `users.changed` → `users[].status` (`null` when removed) | ✅ |
| Change username | `/-/profile/account` | `currentUser.username` + `users.changed` → `users[].username` | ✅ |
| Toggle two-factor authentication | `/-/profile/account` | `currentUser.two_factor_enabled` | ✅ |
| Save preferences | `/-/profile/preferences` | `ui.preferences.<key>` — one dotted key per changed preference (`themeId`, `colorSchemeId`, `layout`, `dashboard`, `projectView`, `tabWidth`, `language`, `firstDayOfWeek`, `timeDisplayRelative`, `render_whitespace_in_code`, `show_whitespace_in_diffs`, `view_diffs_file_by_file`, `markdown_surround_selection`, `markdown_automatic_lists`) | ✅ |
| Set a notification level | `/-/profile/notifications` | `ui.notificationLevels.global`, `ui.notificationLevels.project:<id>` | ✅ |
| Add / remove an email | `/-/profile/emails` | `ui.emails` | ✅ |
| Add / remove an SSH key | `/-/profile/keys` | `ui.sshKeys` | ⚠ |
| Create / revoke a personal access token | `/-/profile/personal_access_tokens` | **`ui.accessTokens`** | ⚠ |
| Reset the feed token | `/-/profile/personal_access_tokens` | **`ui.feedToken`** (shadows `currentUser.feed_token`) | ⚠ |
| Mark a todo done / restore / mark all done | `/dashboard/todos`, `/dashboard/todos/:id`, `/dashboard/todos/:id/restore`, `/dashboard/todos/destroy_all`, `/dashboard/todos/bulk_restore` | `todos.changed` → `todos[].state` | ✅ |
| Create a snippet | `/-/snippets/new` | `snippets.added` (array created on first use; id = `1 + max(existing)`) | ✅ |
| Protect / unprotect a branch or tag, add a mirror, deploy key, deploy token or project access token, save Branch defaults | `/:ns/:proj/-/settings/repository`, `/-/settings/access_tokens` | `ui.projectSettings.<full_path>` (and `projects[].default_branch` for Branch defaults) | ⚠ |
| Save merge-request / CI-CD / Monitor / Packages settings, add a CI variable, pipeline trigger or deploy freeze | `/:ns/:proj/-/settings/{merge_requests,ci_cd,operations,packages_and_registries}` | `ui.projectSettings.<full_path>` | ⚠ |
| Add / delete a webhook | `/:ns/:proj/-/hooks` | `ui.projectSettings.<full_path>.hooks` | ⚠ |
| Dismiss a page banner | any page with an alert | `ui.dismissedAlerts` | ⚠ |
| Collapse the left sidebar | any project/group page | `ui.sidebarCollapsed` | ⚠ |
| Search / sort / filter any list view | any list route | **nothing** — URL query params only | ✅ |


---

## Diff shape

`src/utils/stateTracker.js` is **unchanged by the overlay refactor** — 89 mocks
share its convention, and shrinking what is persisted made the diff small without
touching the differ. What changed is that the frozen collections are no longer
top-level state keys, so its `KEYED_COLLECTIONS` branch no longer fires for them
and the delta keys fall through to the recursive value diff. A real diff now
looks like this (one created issue, one comment on it, one star, one edit to a
frozen label):

```json
{
  "newIssues":  { "old": [], "new": [ { "id": 83821, "iid": 1600, "title": "…" } ] },
  "newNotes":   { "old": [], "new": [ { "id": 310827, "noteable_type": "Issue", "body": "…" } ] },
  "newStars":   { "old": [], "new": [ { "project_id": 193, "user_id": 2330, "created_at": "…" } ] },
  "labelEdits.1805": { "new": { "id": 1805, "title": "renamed", "color": "#428BCA", "…": "…" } },
  "projectEdits.193": { "new": { "id": 193, "full_path": "byteblaze/dotfiles", "star_count": 1, "…": "…" } },
  "repo.fileOverlay.byteblaze/dotfiles:main:README.md": { "old": null, "new": "…" },
  "repo.forkOrigin.byteblaze/2019-nCov": { "old": null, "new": "yjlou/2019-nCov" },
  "ui.preferences.themeId": { "old": null, "new": "2" },
  "nextIds.issue": { "old": 83821, "new": 83822 }
}
```

The `KEYED_COLLECTIONS` (`added`/`removed`/`changed` by `id`) and set-diff
(`stars`, `follows`) branches of `stateTracker.js` are still live and still
correct — they fire when a task **injects a full array** as the base and then
mutates it, which is the legacy path `overlay.baseArray()` supports. On a
lightweight (overlay-only) session they simply never see those keys.

Everything else — `repo.*`, `ui.*`, `nextIds.*`, `currentUser`, `snippets`,
`groupLinks` — falls back to a recursive value diff keyed by dotted path, exactly
as before. That is why a `repo.*` or `ui.*` row above names the **full dotted
key**: it is what the diff literally contains.

---

## Session API

| Endpoint | Method | Purpose |
|---|---|---|
| `/post?sid=` | POST | `{action:'set'\|'set_current'\|'reset', state, merge?}`. `set` writes `<sid>.json` **and** `<sid>.initial.json`; `set_current` writes `<sid>.json` **only**; `reset` deletes both files. Internal `{action:'restore', state, initial_state}` fills missing files only while existing files still equal the supplied values. |
| `/state?sid=` | GET | `{stored_state, has_custom_state, initial_state, has_initial_state, sid}` |
| `/go?sid=` | GET | `{initial_state, current_state, state_diff}` |
| `/upload?sid=` | POST | multipart upload → `.mock-files/<sid>/` |
| `/files/:sid/:name` | GET | serve an uploaded file |

Provided SIDs must fully match `[A-Za-z0-9_-]{1,128}`; invalid values are
rejected instead of being lossy-sanitised into a colliding filename. Omitting
`sid` retains the legacy default-session behavior. State request bodies are
buffered before one strict UTF-8 decode, bounded at 64 MiB, and state/upload
writes use a same-directory temporary file plus atomic rename. Mutations are
serialized per SID and write/read failures return non-2xx JSON errors. The middleware is
registered under **both** `configureServer` and `configurePreviewServer`, so the
state API works identically under `npm run dev` and `npm run preview` — both were
driven with a real browser. `secureMockApiPlugin()` is first in `plugins[]`.
Responses are gzipped on the wire; with the corpus frozen there is little left to
compress — a cold `/go` is 2 997 B and a `POST /post` after a mutation is a few
KB. (Before the overlay refactor those were 4.47 MB → 1.10 MB and
2.23 MB → 0.49 MB respectively.)

**State-contract compliance.** `shared/check-state-contract.py` reported both of
its defects against this mock and now reports it **clean**:

* **A — `set_current` must not seed the baseline.** It used to call
  `writeInitialStateIfMissing()`, so on a fresh session the first mutation became
  the baseline and `state_diff` was `{}` forever. Removed; the baseline is seeded
  by harness `set`, or by the client's guarded cold-session `restore`.
* **B — `/go` must not fall back to the current state.** It read
  `initialState || currentState || defaultState`, which turns a missing baseline
  into a self-comparison — the same empty diff by another route. It now reads
  `initialState || defaultState`, so a never-seeded sid baselines against
  `createInitialData()`. That is only sound if the server's `createInitialData()`
  matches what the client boots from, which it does:
  `GET /go?sid=<untouched>` returns `state_diff == {}` (asserted by
  `assets/dumps/test_overlay.py §1`).
* **C — repeated `set` rebaselines.** Retrying setup on the same SID replaces
  both current and initial files, preventing an old baseline from producing a
  phantom pre-task diff.
