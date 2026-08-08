# webarena_gitlab_mock Schema

**Base URL**: `http://localhost:<port>/`
**Go Endpoint**: `GET /go?sid=<sid>` → `{initial_state, current_state, state_diff}`
**Inject**: `POST /post?sid=<sid>` with body `{"action":"set","state":{...}}`
**Reset**: `POST /post?sid=<sid>` with body `{"action":"reset"}` → restores `<sid>.json` from `<sid>.initial.json`
**State read**: `GET /state?sid=<sid>` → `{stored_state, has_custom_state, sid}`
**Upload**: `POST /upload?sid=<sid>` (multipart) → `.mock-files/<sid>/`; served at `GET /files/<sid>/<name>`

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

## Mutable vs static seed

`src/data/` holds **23 JSON modules, ~6.4 MB**, split in two tiers:

| Tier | State key / module | Where they live |
|---|---|---|
| **Mutable (12)** | `projects` `users` `groups` `issues` `mergeRequests` `notes` `labels` `milestones` `members` `stars` `follows` `todos` | copied into `state` — POSTed to `/post`, diffed by `/go` |
| **Static (11)** | `repo_files` `repo_trees` `commits` `contributors` `branches` `tags` `merge_request_diffs` `tree_last_commits` `resource_events` `repo_languages` `ci_pipelines` | reference data — imported at module scope, **never** copied into state |

The mutable names above are the **state keys** — the names `/go` returns and the
rest of this document uses. One differs from its file name: `mergeRequests` is
loaded from `src/data/merge_requests.json`. The static names are file names;
they have no state key, by definition.

**Cold state size: 2 072 728 bytes (1.976 MiB) minified** — re-measured off
`GET /go` in round 16 (`json.dumps(..., separators=(',',':'), ensure_ascii=False)`,
the same method TEST.md §1 uses, and the same figure it reports). It moved by
**+2 970 bytes** from round 14's `2 069 758`, and the delta is fully accounted
for: round 16 added `auto_devops_quick_link:true` to the 99 seeded projects that
render the quick link on the source (TEST.md **DIFF-1308**), which is
99 × 30 bytes exactly. No other mutable field or row changed. Round 12 added
no mutable field and no mutable row: its 1 037 KB of CI/CD data is a STATIC
module (see the table below), so the POSTed/diffed state is unmoved. Two earlier
figures stood here and were wrong for different reasons (TEST.md **DOC-1302**).
2 043 078 (1.948 MiB) was the round-4 number and simply went stale. 2 076 882 was
measured with **non-ASCII escaped** (`ensure_ascii=True`, every `é` and 🐞 as
`\uXXXX`); the seed is served and POSTed as UTF-8, so that overcounts by exactly
7 124 bytes. For reference the same state is 2 065 872 JS `String.length` units,
which is a third number again — always state the encoding when you re-measure.
**Remaining headroom to 2 MiB is ~27 KB**, so the next round that wants to add a
field to a mutable seed should measure first.
Round 10's own additions went the other way: `merge_request_diffs.json` (478 KB)
and `repo_languages.json` (12 KB) are STATIC modules outside `state`, and the
only mutable change was repointing `projects[].repo_size` at
`project_statistics.storage_size` — **+27 bytes** across all 175 projects.

That is inside `WEBARENA_MIGRATION.md §4.4`'s ~1–2 MB budget. It got there in
round 4 by dropping five fields that had no reader in `src/` and no anchor in any
value — `notes.discussion_id`, `notes.type`, `notes.resolved_at`,
`notes.resolved_by_id`, `users.admin` (206.7 KB). Sampling `notes` down is
**unsafe** and was not done: 36 of the 252 anchor strings occur verbatim inside
note bodies. See `assets/data_model.md §12.1` for the evidence table.

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

The other four are imported directly by the one page or helper that renders
them and are equally static:

| Module | Size | Imported by | Holds |
|---|---|---|---|
| `tree_last_commits.json` | 369 KB | `src/pages/RepoTree.jsx:12` | per-path "last commit" for the tree view's **Last commit** / **Last update** columns and the blob page's commit well. 173 projects, 3 435 paths, 1 721 commits. |
| `resource_events.json` | 168 KB | `src/pages/NotesTimeline.jsx:10` | GitLab's `resource_state_events` / `resource_label_events` / `resource_milestone_events` (1 207 rows). Since 11.x these are *not* in the `notes` table, so the timeline was missing every close/reopen, label and milestone event without it. |
| `repo_languages.json` | 12 KB | `src/pages/ProjectOverview.jsx` | `repository_languages` × `programming_languages` — name, hex colour and share for 151 projects, 407 rows. Drives the `.repository-languages-bar` strip (TEST.md DIFF-907). |
| `ci_pipelines.json` | 1 037 KB | `src/utils/ci.js` (→ `src/pages/PipelinesCi.jsx`) | **round 12, TEST.md DIFF-1105.** The project CI/CD surface: **all 1 465 pipelines and all 14 179 jobs** the source has, across the **67** of 175 seeded projects that have any — complete, not sampled. Drives `/-/pipelines`, `/-/pipelines/:id`, `/-/pipelines/charts`, `/-/jobs` and `/-/jobs/:id`. Shape in `assets/data_model.md §11b`. |

`merge_request_diffs.json` (478 KB) joins them as a git-derived module read only
through `getMrDiff()`: 729 merge requests, 2 543 diff commits, 112 pipelines —
an MR's own commit list, its `Commits` / `Pipelines` / `Changes` badge counts,
and the pipeline row its Pipelines tab shows (TEST.md DIFF-901). Round 12's
`ci_pipelines.json` is the project-level counterpart, and is why the MR
Pipelines tab and the project pipelines list no longer contradict each other.

**None of them may enter `createInitialData()`.** They are historical, nothing
mutates them, and ~1 MB of dead weight in every POSTed state would put the budget
back over. `assets/data_model.md §11` and `§11a` describe their shapes.

A cold session payload is ~2.7 MB pretty-printed. `dataManager.persist()` writes
the current-state key to localStorage first and only then the baseline key, so
`initialKey present ⇒ storageKey present`. If a write exceeds the browser quota
both keys are dropped and the next load rehydrates from
`.mock-states/<sid>.json` via `fetchCustomState()`; `/go`'s diff stays correct
because the server writes `<sid>.initial.json` exactly once. `AppContext` also
calls `publishInitialState()` (`{action:'set'}`) at boot on a cold session with
no injected state, so the baseline is pristine and the first mutation is visible
in `state_diff`. `POST /post` bodies are gzipped by the client when
`CompressionStream` exists and inflated by the server, with a transparent plain
fallback.

---

## State Schema

| Key | Type | Description |
|-----|------|-------------|
| `currentUser` | object | byteblaze, id `2330`. Same shape as a `users` row. Mirrors `users[2330]` — profile edits write **both**. Also carries `two_factor_enabled` once `/-/profile/account` toggles it. |
| `users` | array | 1 133 real users. Always `{id, username, name, email, state, created_at, followers, following}`; optionally `bio`, `location`, `organization`, `feed_token` (byteblaze only), `status`, `website_url`, `job_title`, `pronouns`. `status` is `{emoji, message, availability}` or `null`. |
| `projects` | array | 175 real projects. `{id, full_path, path, name, namespace{id,path,name,kind}, description, visibility, star_count, forks_count, archived, created_at, last_activity_at, default_branch, commit_count, repo_size, open_issues_count, closed_issues_count, open_mrs_count, merged_mrs_count, closed_mrs_count}`. Written by tasks: `topics`, `forked_from` (`{id, full_path, name, name_with_namespace}` on forks), `feature_settings`, `request_access_enabled`, `default_branch` (Branch defaults on `/-/settings/repository`). Four optional container-derived flags are present **only where they deviate from GitLab's default**, and drive the Auto DevOps banner predicate (`Layout.jsx`): `auto_devops_enabled:false` (67 projects with an explicit `project_auto_devops` row — absent means the project inherits the instance default, which is ON), `has_ci_config:true` (2), `builds_enabled:false` (1), `empty_repo:true` (2). A fifth, `auto_devops_quick_link:true` (99 projects, +2 970 bytes of cold state), is separate and drives only the `Auto DevOps enabled` **quick link** on the project overview (TEST.md **DIFF-1308**, round 16). It is measured off the source per project rather than derived from `auto_devops_enabled`: all 67 explicit opt-outs hide the link, but 9 of the 108 that inherit ON also hide it and only 4 of those are explained by the other three flags. |
| `groups` | array | 2 real groups (`{id, path, name, description, visibility}`). Group creation appends here. |
| `issues` | array | 613 issues. `{id, iid, project_id, title, description, author_id, state:'opened'\|'closed', confidential, due_date, milestone_id, assignee_ids[], label_ids[], created_at, updated_at, closed_at, closed_by_id, upvotes, user_notes_count}`. `closed_at`/`closed_by_id` are **null on all 613 rows, matching the source** — the snapshot populated `issues.closed_at` on 1 row in 80 962 (`assets/data_model.md §4.1`); they are written when a task closes an issue. Written by tasks: `downvotes`, `awards[]`, `time_estimate`, `total_time_spent`, `discussion_locked`, `moved_from`. |
| `mergeRequests` | array | 729 MRs. `{id, iid, project_id, source_project_id, title, description, author_id, state:'opened'\|'closed'\|'merged', draft, source_branch, target_branch, milestone_id, merge_status, assignee_ids[], reviewer_ids[], label_ids[], created_at, updated_at, merged_at, merged_by_id, user_notes_count, squash}`. `merged_at`/`merged_by_id` are the round-5 backfill off `merge_request_metrics` — populated on 286 / 210 rows, null elsewhere (`assets/data_model.md §5.1`); they back `?sort=merged_at`. There is deliberately **no seeded `closed_at`**: the source's `merge_request_metrics.latest_closed_at` is set on 1 row in 134 338 (§5.2). Written by tasks: `upvotes`, `downvotes`, `awards[]`, `discussion_locked`, `merge_commit_message`, `closed_at`, `closed_by_id`. |
| `notes` | array | 1 599 notes. `{id, noteable_type:'Issue'\|'MergeRequest', noteable_id, project_id, author_id, body, system, created_at, updated_at}`. `system:true` rows are the grey activity lines and are excluded from `user_notes_count`. **`discussion_id`, `type`, `resolved_at` and `resolved_by_id` were removed from the seed** (see above); `NotesTimeline.jsx` still writes the first three on notes it creates. |
| `labels` | array | 630 labels. `{id, project_id, title, color, description, created_at}` (+ `updated_at` once edited). |
| `milestones` | array | 202 milestones. `{id, iid, project_id, title, description, state:'active'\|'closed', start_date, due_date, created_at, updated_at}` |
| `members` | array | 183 memberships. `{id, source_type:'project'\|'namespace', source_id, user_id, access_level, access_label, created_at, expires_at, created_by_id}`. **Request Access** (ROUTES #97) appends a row carrying an extra `requested_at`; such a row is an access *request*, not a membership, and `MembersTable` excludes it — which is what GitLab does (requests live behind a Maintainer-only tab). **Leave project** (ROUTES #96) removes the row. |
| `stars` | array | 569 stars. `{project_id, user_id, created_at}` — set-diffed, no id. |
| `follows` | array | 5 follows. `{follower_id, followee_id}` — set-diffed, no id. |
| `todos` | array | 7 todos. `{id, user_id, project_id, target_id, target_type, author_id, action, state:'pending'\|'done', created_at, group_id}` |
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

A task only has to supply the collections it cares about — `initializeData()`
merges the injected object over `createInitialData()`, and `repo`, `ui` and
`nextIds` are merged key-by-key so partial subtrees keep their defaults.

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
    "groups": [],
    "issues": [],
    "mergeRequests": [],
    "notes": [],
    "labels": [],
    "milestones": [],
    "members": [
      {"id": 202, "source_type": "project", "source_id": 193, "user_id": 2330, "access_level": 50, "access_label": "Owner", "created_at": "2023-03-27 20:37:47", "expires_at": null, "created_by_id": 2330}
    ],
    "stars": [],
    "follows": [],
    "todos": [],
    "snippets": [],
    "repo": {
      "fileOverlay": {}, "treeOverlay": {}, "commitOverlay": {},
      "branchOverlay": {}, "tagOverlay": {}, "forkOrigin": {},
      "branchDeletions": {}, "tagDeletions": {}
    },
    "ui": {
      "notificationLevels": {}, "sidebarCollapsed": false, "dismissedAlerts": [],
      "preferences": {"colorScheme": "light", "syntaxTheme": "white"}
    },
    "nextIds": {"project": 194, "group": 7, "issue": 83821, "mr": 139278, "note": 310827, "label": 1927, "milestone": 590, "member": 206}
  }
}
```

## Observable State Changes (for LLM evaluation)

Every row flows through `AppContext.setState()` → `saveState()` →
`POST /post?sid=<sid>` `{action:'set_current'}` → `.mock-states/<sid>.json` →
`/go` `state_diff`.

**Legend.** ✅ = driven in chromium during the round-4 schema pass and the listed
keys are the captured diff. ⚠ = the control is reachable and its handler is
known, but the drive did not complete the flow, so the keys come from the handler.

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

`src/utils/stateTracker.js` diffs id-keyed collections as sets rather than by
array index, so inserting one issue does not emit 613 changed entries:

```json
{
  "issues":  { "added": [ … ], "removed": [ … ], "changed": [ { "id": 83395, "old": {…}, "new": {…} } ] },
  "stars":   { "added": [ { "project_id": 193, "user_id": 2330 } ], "removed": [] },
  "repo.fileOverlay.byteblaze/dotfiles:main:README.md": { "old": null, "new": "…" },
  "repo.forkOrigin.byteblaze/2019-nCov": { "old": null, "new": "yjlou/2019-nCov" },
  "ui.preferences.themeId": { "old": null, "new": "2" },
  "nextIds.issue": { "old": 83821, "new": 83822 }
}
```

Keyed collections (`added`/`removed`/`changed` by `id`): `users projects groups
issues mergeRequests notes labels milestones members todos`.
Set-diffed (`added`/`removed` by value): `stars follows`.
Everything else — `repo.*`, `ui.*`, `nextIds.*`, `currentUser`, `snippets`,
`groupLinks` — falls back to a recursive value diff keyed by dotted path. That is
why a `repo.*` or `ui.*` row above names the **full dotted key**: it is what the
diff literally contains.

---

## Session API

| Endpoint | Method | Purpose |
|---|---|---|
| `/post?sid=` | POST | `{action:'set'\|'set_current'\|'reset', state, merge?}` |
| `/state?sid=` | GET | `{stored_state, has_custom_state, sid}` |
| `/go?sid=` | GET | `{initial_state, current_state, state_diff}` |
| `/upload?sid=` | POST | multipart upload → `.mock-files/<sid>/` |
| `/files/:sid/:name` | GET | serve an uploaded file |

`sid` is sanitised with `sid.replace(/[^a-zA-Z0-9_-]/g, '')` at every
path-forming site (verified: `POST /post?sid=../../pwn` writes
`.mock-states/pwn.json`, never outside the directory). The middleware is
registered under **both** `configureServer` and `configurePreviewServer`, so the
state API works identically under `npm run dev` and `npm run preview` — both were
driven with a real browser. `secureMockApiPlugin()` is first in `plugins[]`.
Responses are gzipped on the wire (`/go` 4.47 MB → 1.10 MB, `POST /post`
2.23 MB → 0.49 MB); the state itself is unchanged by that.
