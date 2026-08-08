# webarena_gitlab_mock — Audit (shard 1 of 3: **MIGRATION PARITY**)

> Round: post foundation + 3 concurrent feature shards
> Date: 2026-08-07
> Dimension: migration parity only (routes, route shape, anchors, seed integrity,
> network/auth, visible-string fidelity). Dead handlers = shard 2, data pipeline =
> shard 3.
> Method: react-router-dom 6.30.4 `matchRoutes` replay of all 145 anchor routes
> against the real route table parsed out of `src/App.jsx`; programmatic
> ROUTES.md ↔ App.jsx diff; seed id range analysis; grep sweeps; string
> spot-checks against `assets/html/`.

*(findings appended as confirmed — see `## Summary` at the end for counts)*

---

## P0

### PARITY-001 · `nextIds.label` (1800) collides with 104 real seeded label ids
- **File**: `src/utils/dataManager.js:185` (`nextIds: { … label: 1800 … }`),
  mirrored in `assets/data_model.md:390`
- **Consumers**: `src/pages/NewLabel.jsx:53`, `src/pages/LabelsList.jsx:180`
  (`allocateId('label')` → `src/context/AppContext.jsx:68-79`)
- **Issue**: `src/data/labels.json` holds **104 labels with `id >= 1800`**
  (1805, 1806, …, max **1926**). The first label a task creates is allocated
  `id: 1800`, the 6th gets `1805` — which is already a real label. From then on
  every created label shadows a seeded one. Anything that resolves a label by id
  (`/-/labels/:id/edit`, `label_ids` on issues/MRs, React `key={label.id}`) will
  hit or render the wrong record.
- **Fix**: raise the counter above the real max — `label: 2000`. Update
  `assets/data_model.md:390` in the same edit so the two stop disagreeing with
  the data.

### PARITY-002 · `nextIds.note` (310000) collides with 111 real seeded note ids
- **File**: `src/utils/dataManager.js:184`, mirrored in `assets/data_model.md:391`
- **Consumer**: `src/pages/NotesTimeline.jsx:92` (`allocateId('note')`)
- **Issue**: `src/data/notes.json` holds **111 notes with `id >= 310000`**
  (310014, 310017, …, max **310826**). Every comment posted on an issue or MR
  during the first ~800 allocations can duplicate an existing note id. Comment
  posting is on the critical path for a large block of tasks
  (`#notes-list` is an anchor locator on both issue and MR detail), so a
  duplicate-key render or an edit hitting the wrong note is a live task risk.
- **Fix**: `note: 320000`. Update `assets/data_model.md:391` too.

*(The other six counters are clean and were verified: project 194 > max 193,
group 7 > max 6, issue 90000 > max 83820, mr 140000 > max 139277, milestone
600 > max 589, member 600 > max 205 — zero seeded records at or above each.)*

### PARITY-003 · 10 programmatic `navigate()` calls drop `?sid=` — all of them on anchored create/edit flows
- **Files / lines** (each builds a fresh URL and never re-attaches `sid`):

  | file:line | call | flow |
  |---|---|---|
  | `src/pages/NewIssue.jsx:83` | `navigate(\`${base}/-/issues/${iid}\`)` | after **Create issue** |
  | `src/pages/EditIssue.jsx:62` | `navigate(\`${base}/-/issues/${issue.iid}\`)` | after **Save changes** on an issue |
  | `src/pages/NewMergeRequest.jsx:114` | `navigate(\`${base}/-/merge_requests/new?${p}\`)` (`p = new URLSearchParams()`) | **Compare branches and continue** |
  | `src/pages/NewMergeRequest.jsx:188` | `navigate(\`${base}/-/merge_requests/${iid}\`)` | after **Create merge request** |
  | `src/pages/EditMergeRequest.jsx:66` | `navigate(\`${base}/-/merge_requests/${mr.iid}\`)` | after **Save changes** on an MR |
  | `src/pages/NewMilestone.jsx:57` | `navigate(\`${base}/-/milestones/${milestone.iid}\`)` | after **Save changes** (edit) |
  | `src/pages/NewMilestone.jsx:75` | `navigate(\`${base}/-/milestones/${nextIid}\`)` | after **Create milestone** |
  | `src/pages/NewLabel.jsx:61` | `navigate(\`${base}/-/labels\`)` | after **Create label** |
  | `src/pages/DashboardTodos.jsx:147` | `navigate('/dashboard/todos', { replace: true })` | after a todo action |
  | `src/pages/Search.jsx:208` | `navigate(withParams({…}))`, and `withParams` at `Search.jsx:102-113` starts from `new URLSearchParams()` | search filter submit (Status / Confidentiality) |

- **Issue**: `WEBARENA_MIGRATION.md §5` — "Any redirect, form post, or
  programmatic navigation must preserve `sid`." These ten do not. The repo
  already contains **three** helpers that do it correctly
  (`useQueryNavigate` in `src/utils/RedirectWithQuery.jsx:31`, `useGo` in
  `src/components/create/useGo.js`, `useNavigateWithQuery` in
  `src/components/issuable/Controls.jsx:23`) and only 2 files import any of them
  — the three feature shards each wrote their own and then used raw `navigate`
  anyway.
- **Severity note (be accurate)**: this is not total session loss —
  `getSessionId()` (`src/utils/dataManager.js:61-70`) falls back to
  `sessionStorage`, so state keeps flowing to the right `.mock-states/<sid>.json`
  after the sid leaves the URL. What breaks is (a) the **`url_match` evaluator**,
  which reads the agent's final URL, and (b) any deep link the agent copies or
  the harness re-drives. Issue creation, MR creation, milestone creation and
  label creation are exactly the flows whose evaluators then check a URL, so
  keep this at P0.
- **Fix**: replace each raw `navigate(` above with `useQueryNavigate()` (or the
  local `useGo` / `useNavigateWithQuery`). For `Search.jsx:102` seed
  `withParams` from the live search: `const p = new URLSearchParams(); const sid
  = q.searchParams.get('sid')` … and `if (sid) p.set('sid', sid)` before the
  return, so the emitted param order stays source-faithful (§23) with `sid`
  appended last.

*(Verified clean — these `navigate()` calls DO seed from the live query string
and keep `sid`: `Branches.jsx:145`, `Tags.jsx:63`, `Compare.jsx:48`,
`RepoCommits.jsx:87`, `Search.jsx:99`, `NewTag.jsx:46`, `NewBranch.jsx:49`,
`NewGroup.jsx:107`, `NewProject.jsx:193`. The one bare `<Navigate>` at
`RepoBlob.jsx:66` also copies `location.search`, so it is fine.)*

---

## P1

### PARITY-004 · Branch names containing `/` are parsed as `ref` + path — the `archive-my-tweets` anchor start URL renders an empty directory
- **Files**: `src/pages/RepoTree.jsx:112-113` (`params.ref` / `params['*']`), and the
  same pattern in `RepoBlob.jsx:45-46`, `RepoCommits.jsx:49`, `EditFile.jsx`,
  `NewFile.jsx`, `FindFile.jsx`, `Contributors.jsx`, `NetworkGraph.jsx`
- **Route**: `src/App.jsx:215` `/:ns/:proj/-/tree/:ref/*`
- **Anchor**: `/amwhalen/archive-my-tweets/-/tree/github/fork/chtitux/addRssFeed`
  — the `start_url` of **webarena-788**
- **Verified against the source capture** `assets/html/tree-archivetweets-fork.html`:
  its `<title>` is `Files · github/fork/chtitux/addRssFeed · Andrew M. Whalen /
  archive-my-tweets · GitLab`, the ref switcher reads
  `github/fork/chtitux/addRssFeed`, and the body is the **repository root**.
  `assets/data/branches.json` and `contributors.json` both key this project by
  the full slash-bearing name, so the seed is right — only the parse is wrong.
- **What the mock does instead**: react-router binds `ref = "github"` and
  `* = "fork/chtitux/addRssFeed"`. `getRepoTree(state, project, "github")`
  ignores the ref and returns the default tree, then `entriesAt(tree,
  "fork/chtitux/addRssFeed")` matches nothing, so the page renders
  **"This directory is empty."** with a ref switcher showing `github`.
  webarena-788's agent is dropped onto a broken page.
- **Related, worse**: `/:ns/:proj/-/graphs/:ref` (`App.jsx:229`),
  `/-/network/:ref` (231) and `/-/find_file/:ref` (232) are **single-segment**
  patterns, so `/amwhalen/archive-my-tweets/-/graphs/github/fork/chtitux/addRssFeed`
  does not match any route at all and falls through to `NotFound`. Every ref
  switcher on those pages emits exactly that href for this branch.
- **Fix**: add a shared `resolveRef(project, refParam, splatParam)` helper that
  concatenates `ref + '/' + splat`, then picks the **longest** prefix that is a
  known branch or tag (`getBranches` / `getTags`), returning `{ ref, path }`;
  fall back to `{ ref: refParam, path: splat }` when nothing matches. Use it in
  every `:ref/*` page. Add `/*` variants of the `graphs` / `network` /
  `find_file` routes so the multi-segment ref can match at all.
  (`/-/graphs/php52` — the ref webarena-788's *answer* needs — already works, so
  the task is recoverable; this is P1, not P0.)

### PARITY-005 · Issue-detail header says `Created …`, the source says `Issue created …`, and the header action buttons are wrong
- **File**: `src/pages/IssueDetail.jsx:102-112`
- **Source** (`assets/html/issue-a11y-719.html`, extracted text; `assets/README.md`
  §14.3): `Closed Open Issue created 7 years ago by Byte Blaze @byteblaze
  Maintainer Issue actions Reopen issue New related issue …`
- **Mock**: `Created 7 years ago by Byte Blaze` — the literal word `Issue` is
  missing, and there is no `user-access-role` pill.
- **Also wrong, same block** (`IssueDetail.jsx:108-112`): the mock's
  `.detail-page-header-actions` renders `Edit` + `New issue`. §24.4/§14.3 pin it
  to a `Close issue` / `Reopen issue` button
  (`data-qa-selector="close_issue_button"` / `reopen_issue_button"`) plus a `⋮`
  dropdown titled `Issue actions` containing `New related issue`
  (`href="/<ns>/<proj>/-/issues/new?add_related_issue=<iid>"`) and
  `Delete issue`. Neither `Edit` nor `New issue` exists there in the source.
  This is also why ROUTES.md row 72 (`?add_related_issue=`) is still `[ ]` —
  the link that produces that URL has no home.
- **Fix**: change the sentence to `{'Issue created '}<TimeAgo …>{' by '}…`, and
  rebuild the actions block per §14.3's table (close/reopen wired to the same
  state setter `NotesTimeline.jsx:84-85` already uses, plus the ⋮ dropdown with
  the two links).

### PARITY-006 · The HTTP clone URL hard-codes `localhost:8023`; the source renders the instance host
- **File**: `src/pages/ProjectOverview.jsx:242` —
  `` `http://localhost:8023/${project.full_path}.git` ``
- **Source** (`assets/html/proj-dotfiles.html`, all 7 clone-widget occurrences):
  `ssh://git@10.186.197.203:2222/byteblaze/dotfiles.git` and
  `http://10.186.197.203:8023/byteblaze/dotfiles.git`. `assets/README.md §24.5`:
  *"the mock should render whatever host it is actually served from rather than
  hard-coding either."*
- **Inconsistent within one widget**: line 240 correctly emits the
  `__GITLAB_SSH__` placeholder for the SSH URL; line 242 hard-codes a host for
  the HTTP URL two lines below it.
- **Fix**: use `window.location.origin` (or a `__GITLAB__` placeholder to match
  line 240) at line 242.
- **Scope check, so the dev agent does not over-correct**: the *other* nine
  `localhost:8023` occurrences — `NewProject.jsx:252,257,258,355`,
  `NewGroup.jsx:221`, `GroupSettings.jsx:148`, `ForkProject.jsx:154,155`,
  `ProfileAccount.jsx:75`, `ProjectSettingsGeneral.jsx:458` — are **correct as
  written**. I checked them against `assets/html/new-project.html`,
  `new-group.html`, `proj-forks-new.html`, `proj-dotfiles-settings.html` and
  `profile-account.html`: the source really does render
  `http://localhost:8023/byteblaze/` as the Project-URL / group-URL / username
  prefix on those forms (GitLab uses `root_url` there, not `external_url`).
  Leave them alone.
- No anchor string contains a host — I checked all 252; the only values
  containing `http` are Apache license text and the two GitLab Pages template
  descriptions. So this is fidelity, not a task-breaker.

### PARITY-007 · `/users/:username` redirects to `/` instead of `/:username`
- **File**: `src/App.jsx:203` — `<Route path="/users/:username" element={<RedirectWithQuery to="/" />} />`
- **Issue**: GitLab redirects `/users/byteblaze` → `/byteblaze`. The mock throws
  the username away and lands the agent on the dashboard. No anchor uses the bare
  form (only `/users/byteblaze/{starred,following}`), so this is not a task
  break, but it is a silent wrong-page for a URL agents type constantly.
- **Fix**: render `<UserProfile />` (it already reads `params.username`), or
  redirect to `/${username}` preserving the query.

### PARITY-008 · Mutable seed is 2.13 MB — over the budget that `/go` diffs on every call
- **Files**: `src/utils/dataManager.js:137-148` (`createInitialData()` returns the
  12 mutable modules verbatim)
- **Measured**: notes 708 KB · merge_requests 480 KB · issues 425 KB · users
  265 KB · projects 99 KB · labels 79 KB · milestones 47 KB · stars 42 KB ·
  members 33 KB · todos 1 KB · groups + follows <1 KB → **2.13 MB**. The 6 git
  modules (2.37 MB) are correctly kept OUT of state.
- **Issue**: `WEBARENA_MIGRATION.md §4.4` budgets `createInitialData()` at
  ~1–2 MB because the whole state is POSTed, diffed and returned by `/go` on
  every call. `dataManager.js:92-99` already documents that two UTF-16 copies of
  this blow the 5 MB localStorage quota and that the code silently drops both
  keys when it does — i.e. the size is already causing a fallback path in
  production.
- **Fix (cheapest first)**: `notes.json` is 708 KB / 1,599 rows and only 7
  detail pages carry anchor threads. Trim to the anchored noteables plus ~2
  pages of depth on a handful of others; that alone brings the total under
  1.5 MB. Do **not** trim `issues`/`merge_requests` — the dashboard filter
  anchors need the breadth.

---

## P2

### PARITY-009 · `ui.starredProjectIds` is a derived duplicate of `state.stars` that nothing reads
- **File**: `src/utils/dataManager.js:168-170` (built from `starsSeed`),
  maintained at `src/pages/ProjectOverview.jsx:102-106`
- **Issue**: every reader of "is this starred" goes through `state.stars`
  (`ProjectOverview.jsx:52`, `DashboardProjects.jsx:61`, `UserProfile.jsx:245`,
  `Starrers.jsx:32`). `ui.starredProjectIds` has no consumer, is kept in sync by
  exactly one call site, and inflates the `/go` diff with a second signal for the
  same action — the "derived views must not be persisted into state" rule in
  `.claude/agents/audit.md` §1.5b.
- **Fix**: delete the key from `createInitialData()` and the sync block in
  `toggleStar`.

### PARITY-010 · `/-/profile/account` renders the feed token in DOM the source does not have
- **File**: `src/pages/ProfileAccount.jsx:19` (`useState(true)` for `revealed`)
  and `:66` (`<p>{`Feed token: ${token}`}</p>`)
- **Issue**: `assets/html/profile-account.html` contains **no** occurrence of
  `TMN_bBn9Z48qVbUFZV45` or the string `feed_token` — the source masks the token
  behind its reveal control. The mock ships it revealed by default *and* adds a
  second, invented `<p>Feed token: …</p>` paragraph.
- **Not a task risk** — webarena-259 is a `string_match`/`exact_match` on the
  agent's *answer*, and the token is legitimately reachable from the feed hrefs
  the mock already emits (`IssuablesList.jsx:107-121`). This is invented DOM, so
  it belongs in the log rather than in a fix round.
- **Fix**: default `revealed` to `false` and drop the extra `<p>`.

### PARITY-011 · Three ROUTES.md status cells disagree with the code
- `ROUTES.md:194` row **114** (`/:ns/:proj/-/graphs/:ref/charts`) is `[ ]` while
  `ROUTES.md:110` row **58** — the same path — is `[x]`. The route is real
  (`App.jsx:230` → `RepoAnalytics`). Mark 114 `[x]` or delete the duplicate row.
- `ROUTES.md:143` row **81** (`…/merge_requests/:iid/diffs`) and `:144` row **82**
  (`…/pipelines`) are `[ ]`, but both are registered and point at
  `MergeRequestDetail` with a real `tab` prop (`App.jsx:257,258`). Under-claimed.
- Header count drift: `ROUTES.md` now has **132** numbered rows (99 `[x]`, 27
  `[ ]`, 6 `—`), not the 131/98 the round brief quotes. Row `127b` is the extra.

These are documentation-only; no code change.

---

## Summary

| Category | Issues |
|---|---|
| Route parity breaks (missing / renamed / lost / duplicated) | **0** |
| Anchor routes with no home | **0** |
| Route-shape breaks (trailing slash, %-decoding) | **0** |
| Seed integrity breaks | **2** (PARITY-001, -002 — both id counters) |
| Network / auth leaks | **0** |
| `sid` survival | **1** (PARITY-003, 10 call sites) |
| Ref parsing | **1** (PARITY-004) |
| Visible-string fidelity | **2** (PARITY-005, -006) |
| Seed size | **1** (PARITY-008) |
| Other | **3** (PARITY-007, -009, -010) + 1 doc-only (PARITY-011) |
| **Total** | **11** (P0=3, P1=5, P2=3) |

## Migration Parity Status

| Check | Status | Notes |
|---|---|---|
| Route coverage (ROUTES.md) | ✅ | **99/99** rows marked `[x]` resolve to a real, non-`<Placeholder>` component. Verified by replaying a concrete probe URL per row through `matchRoutes` against the parsed `App.jsx` table. **Zero false completions.** The 27 `[ ]` rows either render `<Placeholder>` (rows 67, 76, 99–118) or are genuinely unrouted (rows 72, 96, 97) — all consistent with their status cell. |
| Concurrent-edit damage | ✅ | 146 `<Route>` elements parsed, **0 duplicate paths**, 0 lost. The three shards' edits to `App.jsx` merged cleanly. react-router v6 ranks by specificity, not source order, so the `/:name` and `/:ns/:proj` catch-alls at lines 314–315 cannot shadow any static route — verified for `/help`, `/explore`, `/search`, `/go`, `/projects/new`, `/groups/:group`, `/users/:username`, `/-/profile`. |
| `/-/` infix preserved verbatim | ✅ | Every `/-/` path in ROUTES.md is registered with the literal `-` segment. |
| Legacy non-`/-/` routes | ✅ | `/:ns/:proj/edit` → `ProjectSettingsGeneral` (`App.jsx:309`) and `/:ns/:proj/activity` → `Placeholder` (310, row 67 is `[ ]`, consistent). Reproduced as written, not "corrected". |
| Trailing slash before query | ✅ | react-router 6.30.4 compiles `end:true` patterns with a trailing `\/*$`. Confirmed empirically on 9 forms including all four `…/-/issues/?…` anchor projects, `…/-/merge_requests/`, `/dashboard/issues/`, `/explore/`, `/byteblaze/`, `/byteblaze/dotfiles/`. All 12 slash-before-query anchor URLs resolve. |
| URL-encoded params decode | ✅ | `useQuery` (`src/pages/hooks.js:18-23`) wraps `useSearchParams`, which decodes `%5B%5D`→`[]`, `%20`→space, `%3A`→`:`, `%F0%9F%90%9E`→🐞 before the key lookup. `filterIssuables` reads `getAll('label_name[]')` and `getAll('not[label_name][]')` and special-cases `None`/`Any`. All 18 query-bearing anchor URLs parse, and **every label named in a filter anchor exists in that project's `labels.json`** — including `type: bug 🐞`, `OpenAPI Generator CLI`, `flaky-test`, `help wanted`, `question`, `enhancement`, `BUG`. |
| Anchor route coverage | ✅ | **145/145** anchor routes match a route, and **none** lands on `<Placeholder>` or `<NotFound>`. |
| Anchor data present for group-A routes | ✅ | Cross-checked every anchor path against the seed: all 37 pre-existing projects, all 7 anchor issue iids, all 8 anchor MR iids, both anchor milestone lists, `dehenne/awesome-visibility` contributors keyed by `master`, `amwhalen/archive-my-tweets` keyed by `php52`. The only "missing" records are the 61 group-B/C paths ROUTES.md explicitly says must **not** be pre-seeded. Confirmed correct: `assets/html/proj-dotfiles-raw-license.html` is a captured **404**, so dotfiles genuinely has no LICENSE and the seed is right to omit it. |
| Anchor strings | ⚠️ | Sampled all 252. 58 are post-condition page text and 54 are agent answers — neither is seedable. Verified the **preconditions** they depend on instead, and they hold: the top-8 `star_count` ordering is exactly `AndroidSlidingUpPanel 55 · create-react-app 52 · ffmpeg-python 51 · PHP_XLSXWriter 47 · AndroidAsync 46 · PyTorch-GAN 45 · administrate 44 · keycloak 43` (webarena-523/524); all four assign-target issues exist and are `opened`; all 14 named users exist; the 3 pre-existing LICENSE blobs exist with the right content; `github@amwhalen.com` is in `contributors.json` and `Contributors.jsx:165` renders it. One mismatch found → PARITY-005. |
| Anchor locators (25) | ✅ | All 25 have a defining element. Spot-verified the eight tricky ones: `.block.start_date`/`.block.due_date` exist **only** on `MilestoneDetail.jsx:336,350` while the issue sidebar correctly uses a bare `.block[data-testid="sidebar-due-date"]` (`IssueDetail.jsx:268`) — the §24.4 correction; `.detail-page-description > a.gl-font-monospace` are direct children at `MergeRequestDetail.jsx:157,167` with `[0]`=source `[1]`=target and no competing `.detail-page-description` on the page; `.cover-status`'s last child is a bare text node (`UserProfile.jsx:349-353`); `.profile-header [itemprop="url"]` (`UserProfile.jsx:402`); `#content-body` on `Layout.jsx:140` with the milestone sidebar inside it; `#notes-list` + `.timeline-discussion-body` (`NotesTimeline.jsx:145,67`); `[data-qa-selector="projects_list"]` (`DashboardProjects.jsx:156`); `[data-qa-selector="title_content"]` as an `<h1 class="title gl-font-size-h-display">` per §14.4. The 5 `func:gitlab_get_project_memeber_role` locators read the Max-role cell, and `MembersTable.jsx:242-249` emits all 8 columns in source order. |
| Deep links render cold | ✅ | Every page component resolves its entity from URL params via `useProject()` / `useParams()` against `state`, not from click-through context. No route depends on prior navigation. |
| `sid` survives navigation | ❌ | PARITY-003 — 10 raw `navigate()` call sites. The delegated `<a href>` interceptor (`App.jsx:89-118`) is correct and covers link clicks; form submits are the hole. |
| Seed uses real identifiers | ⚠️ | Identifiers themselves are clean — no `faker`, no `Math.random()` in seed construction, no `Lorem ipsum` fabrication (the 2 hits in `repo_files.json` are genuine upstream README text), no sequential placeholder names. `createInitialData()` imports the JSON modules directly, no drifted inline copy. The failure is the **allocation counters** (PARITY-001/002). |
| Seed size | ⚠️ | 2.13 MB mutable (in state) + 2.37 MB static (correctly excluded). Over budget — PARITY-008. |
| Derived views kept out of state | ⚠️ | One violation: `ui.starredProjectIds` (PARITY-009). |
| Zero external network calls | ✅ | Only 4 `fetch(` in `src/`: `GoPage.jsx:19` → `/go`, `dataManager.js:83` → `/state`, `:236` and `:247` → `/post`. No `XMLHttpRequest`, `axios`, `WebSocket`, `EventSource`, `sendBeacon`. No CDN, font, avatar, or tile host in `src/` or `index.html`; `index.html` loads only `/favicon.svg` and `/src/main.jsx`, and `global.css` `@import`s only a local file. The ~40 `https://` string literals are all **rendered text** (license bodies, GitLab Pages template blurbs, and the chrome's `about.gitlab.com` help links, which the source has too) — nothing is fetched. |
| No auth gates | ✅ | No route guard, no redirect-to-login anywhere. `/users/sign_in` and `/users/sign_out` both `RedirectWithQuery to="/"` (`App.jsx:199-200`). App boots as `byteblaze` (`CURRENT_USER_ID = 2330`, matching the source's real user id) with no session check. |
| Visible-string fidelity | ⚠️ | ~30 spot-checks against `assets/html/` and §24.4. **All 23 documented recon corrections verified honoured** (see below). 2 mismatches found: PARITY-005 (`Issue created` + header actions) and PARITY-006 (HTTP clone URL). |

### The §24.4 / §24.5 recon corrections — verified one by one

Checked against the code, not assumed. All honoured unless noted:

`.gl-new-dropdown` absent ✅ · `.breadcrumbs-sub-title` absent ✅ · dashboard tabs `Yours`/`Starred`/`Explore` (`DashboardProjects.jsx:98,104,109`) ✅ · issue rows `created … by` not `opened` (`IssuablesList.jsx:334`) ✅ · issue empty state `Use issues to collaborate on ideas…` (`IssuablesList.jsx:412`) ✅ · `.block.due_date` milestone-only ✅ · `block issuable-sidebar-item lock` ✅ · `.block.time-tracking` ✅ · MR `.detail-page-description` = the `requested to merge` banner (`MergeRequestDetail.jsx:141`) ✅ · `Edit commit message` ✅ · MR sort `?sort=merged_at` (`IssuablesList.jsx:48`) ✅ · `/projects/new` has **3** cards (`NewProject.jsx:19,52,58,63`) ✅ · blank-project form has **no** description — `withDescription:false` at `NewProject.jsx:373`, `true` only for the template and import panes, which is exactly what `assets/html/new-project-blank.html` shows (its 2 `Project description` occurrences are both inside `create-from-template-pane` / `import-project-pane`) ✅ · members columns in source order ✅ · `Prioritized Labels`/`Other Labels` title-cased (`LabelsList.jsx:270,293`) ✅ · milestone range EN DASH with no spaces (`format.js:66-71`) ✅ · commit headers zero-padded `19 Mar, 2023` (`RepoCommits.jsx:33-37`, deliberately *not* the non-padded `formatCommitDate` the members table uses) ✅ · `Member since March 23, 2023` full month (`format.js:57`) ✅ · no contribution-count heading, caption is `Issues, merge requests, pushes, and comments.` (`UserProfile.jsx:457`) ✅ · search = **5** scopes as a vertical pill list (`Search.jsx:23-29`) ✅ · `Begin with the selected commit` (`NetworkGraph.jsx:80`) ✅ · `Commits to {ref}` + `Excluding merge commits. Limited to 6,000 commits.` (`Contributors.jsx:150-151`) ✅ · §24.5 host handling ⚠️ **partially** — see PARITY-006.

Plus the three corrections called out in the round brief:
- **merged MR badge is `badge-info` blue, not purple** ✅ — `MergeRequestDetail.jsx:41` returns `badge-info issuable-status-badge-merged`, matching §15b's table. Closed MR is correctly `badge-danger` while a closed **issue** is correctly `badge-info` (`IssueDetail.jsx:98`) — the two differ in 15.7 and the mock gets both right.
- **buttons use `border-width:0` + inset box-shadow** ✅ — `src/styles/global.css:231-254`: `.btn, .gl-button { border: 0 }` and every variant draws its edge with `box-shadow: inset 0 0 0 1px …`.
- **MR `.detail-page-description` is the banner** ✅ — see above.

### Not checked (be explicit)

- I did **not** open a browser or run the dev server; every route/anchor claim above is from `matchRoutes` replay plus source reading. Runtime render errors are playwright's round.
- I did **not** log into the live source (it 302s to sign-in unauthenticated); source comparisons come from the 145 captured DOMs in `assets/html/` and `assets/README.md`.
- I sampled ~30 visible strings, not all of them. Sections I did **not** string-check: `/dashboard/activity`, `/dashboard/todos` row copy, boards, snippets, notifications, preferences, web IDE, compare, network graph, help.
- Whether each handler actually mutates state (shard 2) and whether those mutations reach `/go` (shard 3) are out of my dimension and untested here.

## Out-of-dimension observations (one line each — for the owning shard)

- **handlers**: `src/pages/ExploreProjects.jsx:18-19` builds a `starCounts` Map that is never read; the sort correctly uses `project.star_count`, so it is dead code, not a bug.
- **handlers**: `src/pages/GroupsList.jsx` is not imported by `App.jsx` or any page — orphaned module.
- **pipeline**: `src/components/create/mutations.js:62` uses `Math.random()` to mint commit SHAs, which land in `state.repo.commitOverlay` and therefore make the `/go` diff non-deterministic across runs.
- **design**: `global.css:245-264` styles `.gl-button.btn-default` etc.; components that emit `className="btn btn-default"` **without** `gl-button` (e.g. `RepoTree.jsx:191-192`) render borderless and transparent.
- **design**: `UserProfile.jsx:350` passes `class=` (not `className=`) to the custom `<gl-emoji>` element; React 18 does not forward `class` on custom elements.
