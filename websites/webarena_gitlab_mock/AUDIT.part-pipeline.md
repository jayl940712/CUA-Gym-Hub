# webarena_gitlab_mock — Audit part: DATA PIPELINE & SCHEMA

> Shard 3 of 3 · dimension: `pipeline` (workflow items 3–4)
> Date: 2026-08-07 · Mode: FULL
> Method: every finding below is tagged **[DRIVEN]** (reproduced in a real
> chromium session against `npm run dev -- --port 5184`) or **[READ]** (source
> inspection only).

---

## Summary

| Category | Issues |
|---|---|
| P0 | 1 |
| P1 | 3 |
| P2 | 3 |

**Pipeline verdict: the state pipeline works end to end.** `state update →
saveState → POST /post{set_current} → .mock-states/<sid>.json → /go` was driven
for 14 distinct mutations and produced a correct, human-readable diff every
time. The one P0 is an id-allocator range bug that silently corrupts the diff,
not a plumbing break.

---

## P0

### PIPELINE-001 · `nextIds.label` and `nextIds.note` start *inside* the seed id range — created records collide with real records and `/go` reports them as edits to seed data  **[DRIVEN]**

- **File**: `src/utils/dataManager.js:178-187` (`createInitialData().nextIds`)
- **Spec claimed**: `label:1800`, `note:310000` are above every real seed id.
- **Reality** (measured over `src/data/labels.json` / `notes.json`):

  | counter | start | max seed id | seed ids ≥ start | allocations until first collision |
  |---|---|---|---|---|
  | `label` | 1800 | **1926** | 104 | **6th label** |
  | `note` | 310000 | **310826** | 111 | **15th note** |

  The other six counters are clean: `project 194 > 193`, `group 7 > 6`,
  `issue 90000 > 83820`, `mr 140000 > 139277`, `milestone 600 > 589`,
  `member 600 > 205`.

- **Reproduced** (sid `pipeF`, six labels created through
  `/byteblaze/dotfiles/-/labels/new`):

  ```
  created labels: 1800..1805
  DUPLICATE label ids in state: [1805]
     rows: [(1805,'bug',project 178), (1805,'AUDITLBL6',project 193)]
  /go labels.added:   1800..1804          <- the 6th label is MISSING
  /go labels.changed: [1805 'bug' -> 'AUDITLBL6']
  ```

- **Why it is P0**: `stateTracker.js` `indexBy()` keys keyed collections by `id`
  in a `Map`, so a duplicate id is silently swallowed — last writer wins. The
  agent's 6th label never appears in `labels.added`; instead the evaluator sees
  project 178's real `bug` label mutated. Every UI lookup by label id
  (`indexes.labelsById`) is likewise ambiguous. This is exactly the
  silent-reward-signal-loss class.
- **Fix**: raise the two starts above the real maxima, e.g.
  `label: 2000`, `note: 320000`. Consider also making `allocateId` skip ids
  already present in the collection as a belt-and-braces guard.

---

## P1

### PIPELINE-002 · Fork copies every blob of the source repo into `state.repo.fileOverlay`, defeating the mutable/static split  **[DRIVEN]**

- **File**: `src/components/create/mutations.js` (fork path) — the overlay writes
  are visible in `/go`.
- **Reproduced** (sid `pipeE`, fork of `byteblaze/dotfiles` into `AUDIT-Group`):
  `/go` emitted **16** `repo.fileOverlay.AUDIT-Group/dotfiles:<ref>:<path>` keys,
  one per blob, plus tree/commit/branch overlays. `byteblaze/dotfiles` carries
  57 KB of blob bodies; that whole payload is now duplicated inside state.
  (Session grew 2.88 MB → 2.97 MB over the fork plus a group-create and a
  member-invite in the same session; the fork is the dominant contributor.)
- **Impact**: the whole point of the 12/6 split (audit item 5) is that the 2.4 MB
  git tier never enters the POSTed payload. `repo_files.json` holds 1.05 MB of
  blob bodies across 159 projects; every fork re-inserts one project's share into
  every subsequent `/post` and into **both** halves of every `/go` response. It
  also buries the meaningful diff: the fork's real signal (`projects.added`,
  `forks_count +1`) is drowned in 16 file-body entries.
- **Fix**: model a fork as an *alias*, not a copy — record
  `state.repo.forkOrigin["<new full_path>"] = "<source full_path>"` and have the
  `dataManager.js` accessors (`getRepoFile` / `getRepoTree` / `getCommits` /
  `getBranches`) fall through to the origin's static entry when the new project
  has no overlay of its own. Only blobs the task subsequently *edits* in the fork
  should land in `fileOverlay`.
- **Note**: blank project create is already correct — it writes exactly one
  `README.md` overlay key. Only fork over-copies.

### PIPELINE-003 · `state.snippets` is absent from `createInitialData()`, so it appears in the diff with no baseline  **[DRIVEN]**

- **Files**: `src/utils/dataManager.js:129-189` (no `snippets` key);
  `src/pages/NewSnippet.jsx:41` (`const snippets = prev.snippets || []`).
- **Reproduced** (sid `pipeC`): creating a snippet emitted
  `"snippets": {"new": [ … ]}` with **no `old`** — `JSON.stringify` drops the
  `undefined` baseline. It also falls through `stateTracker.js`'s
  `KEYED_COLLECTIONS` to the whole-array value diff instead of the
  `added/removed/changed` shape every other collection uses.
- **Fix**: add `snippets: []` to `createInitialData()` and `snippets: 'id'` to
  `KEYED_COLLECTIONS` in `src/utils/stateTracker.js:8`. Snippet ids are
  allocated locally (`1 + max(existing)`, `NewSnippet.jsx:42`) rather than from
  `nextIds`; that is acceptable while the seed has no snippets, but a
  `nextIds.snippet` would be more consistent.

### PIPELINE-004 · `allocateId` and the follow-up write issue two independent `POST /post` requests for one logical mutation  **[READ]**

- **File**: `src/context/AppContext.jsx:68-79` (`allocateId`) vs `84-86`
  (`appendTo`).
- **Issue**: `allocateId` calls `saveState()` from inside its own updater, then
  the caller's `appendTo` calls `saveState()` again. Two `fetch()` calls are
  dispatched back to back; the first carries the bumped counter *without* the new
  record, the second carries both. The server handler is a plain overwrite
  (`vite.config.js:200-207`), so if the browser dispatches them on different
  pooled connections and they land out of order, the created record is dropped
  from `.mock-states/<sid>.json` while the counter bump survives.
- **Not observed in 14 driven mutations** — the ordering held every time — but it
  is a real race with no backstop.
- **Fix**: either debounce `saveState` (coalesce writes within ~50 ms, which is
  the mixpanel_mock pattern), or have `allocateId` not persist at all and let the
  caller's single `setState` carry both the counter bump and the record.
- **Secondary**: `allocateId` returns a value captured inside a `setState`
  updater, which only works because React eagerly evaluates the first queued
  update. If a caller ever calls `setState` on the app state *before*
  `allocateId` in the same handler, `allocateId` returns `null`. No current
  caller does (`NewIssue`, `NewMergeRequest`, `NewMilestone`, `NewLabel`,
  `LabelsList`, `MembersTable`, `NotesTimeline` all allocate first), but it is a
  loaded gun.

---

## P2

### PIPELINE-005 · Session payload is 2.88 MB, above the ~1–2 MB budget  **[DRIVEN]**

- `WEBARENA_MIGRATION.md §4.4` budgets 1–2 MB. A cold `.mock-states/<sid>.json`
  is 2.88 MB pretty-printed (~2.2 MB minified), and `/go` returns it **twice**
  (`initial_state` + `current_state`) → ~5.8 MB per `/go` call.
- The 12/6 split is already doing its job (the 2.4 MB git tier is correctly
  excluded — see the verification table below); the remainder is genuinely
  mutable. `users.json` is 272 KB for 1 133 users of which the UI only ever
  renders a few dozen; trimming it is the cheapest win if the budget matters.
- Not blocking: `/go` responds in well under a second at this size.

### PIPELINE-006 · `nextIds.group` bump is not reflected in the group slug casing rule  **[DRIVEN]**

- Typing `AUDIT Group` derives the slug `AUDIT-Group` (`deriveSlug`,
  `src/components/create/mutations.js`), so the group lives at
  `/groups/AUDIT-Group/-/group_members`; the lowercase URL 404s. Real GitLab
  lowercases namespace slugs. The anchored task groups (`n-lab`, `x-lab`, `crew`,
  `coding_friends`, `webagent`) are already lowercase so no anchor breaks — hence
  P2, and it is arguably shard-1's lane, but it surfaced while driving the state
  write so it is recorded here.

### PIPELINE-007 · `reset` semantics differ from the audit-doctrine default  **[DRIVEN]**

- `vite.config.js:179-190`: `action:'reset'` **restores** `<sid>.json` from
  `<sid>.initial.json` and keeps both files, rather than deleting both.
- This matches the brief ("reset must restore the initial state") and is the more
  useful behaviour for RL rollouts, but it diverges from
  `.claude/agents/audit.md §3b` ("reset action: deletes both files"). Flagging so
  the divergence is a decision, not an accident. Verified: after reset,
  `/go` reports an empty `state_diff`.

---

## Verified by driving — end-to-end pipeline

Dev server: `npm run dev -- --port 5184`. Browser: chromium via
`/tmp/pwvenv/bin/python` + playwright, `LD_LIBRARY_PATH` set. Zero console
errors and zero page errors across all sessions.

| # | Mutation driven | Route | `.mock-states/<sid>.json` changed | `/go` `state_diff` |
|---|---|---|---|---|
| 1 | cold load, no injection | `/` | both `<sid>.json` + `<sid>.initial.json` written | `{}` — correct pristine baseline |
| 2 | star a project | `/byteblaze/dotfiles` | ✅ | `stars.added:[{project_id:193,user_id:2330}]`, `projects.changed:[193]`, `ui.starredProjectIds {old:[174,183,185] new:[…,193]}` |
| 3 | create issue | `/…/-/issues/new` | ✅ | `issues.added:1` (id 90000, iid 1), `nextIds.issue 90000→90001` |
| 4 | comment on issue | `/…/-/issues/1` | ✅ | `notes.added:1` (id 310000), `issues.changed` (`user_notes_count 0→1`), `nextIds.note` |
| 5 | close issue | `/…/-/issues/1` | ✅ | `issues[].state → 'closed'` |
| 6 | create file | `/…/-/new/main` | ✅ | `repo.fileOverlay.byteblaze/dotfiles:main:AUDIT.txt`, `repo.treeOverlay…`, `repo.commitOverlay…`, `projects.changed` |
| 7 | edit file | `/…/-/edit/main/README.md` | ✅ | `repo.fileOverlay.byteblaze/dotfiles:main:README.md` |
| 8 | **overlay shadows static seed** | `/…/-/blob/main/README.md` | — | edited body renders on the blob page, i.e. `fileOverlay` really does shadow `repo_files.json` |
| 9 | follow a user | `/aklsh` | ✅ | `follows.added:[{follower_id:2330,followee_id:7}]`, `users.changed:2` (both counters) |
| 10 | create milestone | `/…/-/milestones/new` | ✅ | `milestones.added:1` (id 600, iid 1), `nextIds.milestone` |
| 11 | create label | `/…/-/labels/new` | ✅ | `labels.added:1` (id 1800), `nextIds.label` |
| 12 | profile `website_url` | `/-/profile` | ✅ | `users.changed` **and** `currentUser.website_url` both updated (no drift) |
| 13 | create blank project | `/projects/new` | ✅ | `projects.added:1` (id 194, `byteblaze/AUDIT-Proj`), `members.added:1` (id 600, `access_level 50 / "Owner"`), `repo.fileOverlay…README.md`, `treeOverlay`, `commitOverlay`, `branchOverlay`, `nextIds.project`+`nextIds.member` |
| 14 | create group | `/groups/new#create-group-pane` | ✅ | `groups.added:1` (id 7), `members.added:1` (`source_type:'namespace'`, Owner), `nextIds.group 7→8` |
| 15 | fork a project | `/…/-/forks/new` | ✅ | `projects.added:1` (`forked_from` populated), source `forks_count 0→1`, `nextIds.project` — plus the over-copy in PIPELINE-002 |
| 16 | invite project member | `/…/-/project_members` | ✅ | `members.added:1` (id 602, `Developer`), `nextIds.member` |
| 17 | mark todo done | `/dashboard/todos` | ✅ | `todos.changed:[{id:2978, state 'pending'→'done'}]` |
| 18 | create snippet | `/-/snippets/new` | ✅ | `snippets` appears (see PIPELINE-003) |

Fork validation was also exercised negatively: forking `byteblaze/dotfiles` into
the `byteblaze` namespace correctly refuses with `Path has already been taken`
and writes nothing.

---

## Verified — audit items 2 / 3 / 5 / 6 / 7

### Item 2 · `vite.config.js`  **[DRIVEN + READ]**

| Requirement | Status | Evidence |
|---|---|---|
| `secureMockApiPlugin()` first in `plugins[]` | ✅ | `vite.config.js:244` |
| `mock-api` under `configureServer` | ✅ | `vite.config.js:248` |
| `mock-api` under `configurePreviewServer` | ✅ | `vite.config.js:249` — both delegate to the same `setupMiddlewares(server)` |
| `/post` | ✅ | driven — `set`, `set_current`, `reset` all exercised |
| `/state` | ✅ | driven — returns `{stored_state, has_custom_state, sid}` |
| `/go` | ✅ | driven — `{initial_state, current_state, state_diff}` |
| `/upload` | ✅ | `vite.config.js:130` |
| `/files` | ✅ | `vite.config.js:154` |
| sid sanitised `sid.replace(/[^a-zA-Z0-9_-]/g,'')` | ✅ | `vite.config.js:18, 25, 97, 147, 158` — every path-forming site |

`set_current` also calls `writeInitialStateIfMissing`, which would capture an
already-mutated baseline on a cold session. That hole is closed by
`publishInitialState()` (`dataManager.js:234-241`) firing `action:'set'` at boot
before any mutation — **verified**: after a cold load with no injection, `/go`
returned `state_diff: {}`.

### Item 3 · `src/utils/dataManager.js`  **[READ]**

All seven required exports present and correctly shaped:
`getSessionId` (`:61`, `?sid=` → `sessionStorage` fallback), `storageKey` (`:72`),
`initialKey` (`:76`), `fetchCustomState` (`:80`), `createInitialData` (`:129`),
`initializeData(sid, customState)` (`:195`, handles all three cases),
`saveState(state, sid)` (`:243`, localStorage + `POST {action:'set_current'}`).
Plus `publishInitialState` (`:234`) and the six git accessors.

### Item 4 · `AppContext.jsx` reads `initialKey` before `initializeData`  **[DRIVEN]**

- **Order is correct**: `src/context/AppContext.jsx:21` reads
  `localStorage.getItem(initialKey(sid))` into `isRefresh` **before** either
  `initializeData()` branch runs.
- **Verified by injecting a custom state and confirming it beats the default
  seed** — not just by reading the order. Method: `POST /post?sid=injX
  {action:'set', state}` where `state` was the default seed with three markers
  changed, then a cold browser load of `/?sid=injX`.

  | Check | Result |
  |---|---|
  | `.mock-states/injX.initial.json` written by the `set` | ✅ |
  | injected `projects[0].description = "INJECTED-DESCRIPTION-MARKER"` survives the load | ✅ (default seed value would have been `🤖 Computer setup`) |
  | injected `issues` truncated to 2 rows survives (default is 613) | ✅ 2 |
  | injected `nextIds.issue = 99999` survives (default is 90000) | ✅ 99999 |
  | `/go` `state_diff` immediately after load | `{}` — the app did **not** overwrite the injection |
  | marker actually renders on `/byteblaze/dotfiles` | ✅ present in the DOM |
  | after `pg.reload()` (the `isRefresh` branch) the injection still wins | ✅, diff still `{}` |

  If the order were inverted, `isRefresh` would be `true` on the very first load,
  `fetchCustomState()` would never run, and all four injected values would have
  come back as defaults. They did not.

### Item 5 · mutable/static seed split  **[DRIVEN]**

- `.mock-states/<sid>.json` top-level keys are exactly:
  `currentUser, users, projects, groups, issues, mergeRequests, notes, labels,
  milestones, members, stars, follows, todos, repo, ui, nextIds`.
- **No git module leaked**: `repo_files`, `repo_trees`, `commits`,
  `contributors`, `branches`, `tags` are all absent from state. They are imported
  into the module-level `staticRepo` (`dataManager.js:41-48`) only.
- Row counts match SCHEMA.md: users 1133, projects 175, groups 2, issues 613,
  mergeRequests 729, notes 1599, labels 630, milestones 202, members 183,
  stars 569, follows 5, todos 7.
- **`fileOverlay` genuinely shadows `repo_files.json`** — driven: editing
  `README.md` in `byteblaze/dotfiles` then loading
  `/byteblaze/dotfiles/-/blob/main/README.md` renders the edited body.
- Overlay key format is exactly `"<full_path>:<ref>:<path>"` as specified
  (`fileOverlayKey`, `dataManager.js:263`).

### Item 7 · `nextIds`  **[DRIVEN]**

- Counters persist: they live in state, so every bump rides the same
  `set_current` POST and survives reload (`nextIds.project` read back as 195
  after a create + a fork).
- Six of eight are collision-free. Two are not — **PIPELINE-001**.

### Item 6 · session isolation and reset  **[DRIVEN]**

Two separate browser contexts, `sid=isoA` and `sid=isoB`, each starred a
different project at the same time:

| Check | Result |
|---|---|
| `isoA` starred `byteblaze/dotfiles` (193) | `ui.starredProjectIds [174,183,185,**193**]`, `stars.added [{project_id:193}]` |
| `isoB` starred `byteblaze/timeit` (190) | `ui.starredProjectIds [174,183,185,**190**]`, `stars.added [{project_id:190}]` |
| the two diffs are independent | ✅ neither session sees the other's mutation |
| `POST /post?sid=isoA {action:'reset'}` | `{"success":true,"message":"State reset to initial."}` |
| after reset, `/go?sid=isoA` `state_diff` | `{}` |
| after reset, `current_state` byte-identical to `initial_state` | ✅ |
| `isoB` unaffected by `isoA`'s reset | ✅ still `[174,183,185,190]` |

### Preview-server parity  **[DRIVEN]**

`npm run preview -- --port 5185` against the committed `dist/`:

| Check | Result |
|---|---|
| `GET /go?sid=…` on a fresh sid | full `createInitialData()` payload, `state_diff {}` |
| `GET /state?sid=…` | `{"stored_state":null,"has_custom_state":false,"sid":"prevTest"}` |
| `POST /post {action:'set'}` | `{"success":true,…}`, `/go` reflects it |
| sid traversal `?sid=../../pwn` | written to `.mock-states/pwn.json` — sanitiser holds, nothing escaped the directory (test files removed) |
| cold browser load writes `<sid>.json` + `<sid>.initial.json` | ✅ |
| star a project under preview | `stars.added [{project_id:193,user_id:2330}]`, `projects.changed`, `ui.starredProjectIds` — identical to dev |

No preview-only regression.

---

## SCHEMA.md

**UPDATED** — rewritten against the current `createInitialData()` and all three
feature shards. It now follows the `websites/mixpanel_mock/SCHEMA.md` format
(State Schema table → Default IDs → Minimal Inject Example → Observable State
Changes) and adds:

- `state.snippets` (new collection, absent from the default seed)
- the full `state.ui` sub-key table — `unsubscribed`, `labelSubscriptions`,
  `prioritizedLabels`, `sshKeys`, `emails`, the expanded `preferences` object
- the `forked_from` shape on `projects`, `status` on `users`, `topics`,
  `issue_type`, and the per-project counter fields the create shard added
- a 61-row Observable State Changes table in four groups (projects & repository /
  groups & members / issuables / people & profile), replacing the old 12-row
  table plus its "Not yet wired" section — every one of those P1 flows now ships
- ✅ marks on the 16 rows that were driven end to end in this audit
- the PIPELINE-001 counter defect recorded inline next to `nextIds`, so nobody
  reads the counter list as verified-safe
- a Minimal Inject Example (the old file had none)

---

## Out-of-dimension observations

- `/-/merge_requests/new` renders the branch-compare step with no title field;
  the MR create flow needs the "Compare branches and continue" step driven first.
  Not verified end to end here — shard 2's lane.
- `/groups/new` renders only a chooser until `#create-group-pane` is in the hash,
  which matches the source but means a deep link to `/groups/new` alone shows no
  form. Shard 1's lane.
