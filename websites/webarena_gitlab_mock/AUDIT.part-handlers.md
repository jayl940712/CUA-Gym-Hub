# AUDIT — shard 2 · Unimplemented UI / dead handlers

> App: `websites/webarena_gitlab_mock/` · Source: http://localhost:8023 (read-only, not mutated)
> Dimension: **dead controls, mutations that never persist, stubs presented as done**
> Mock driven live at `http://localhost:5183` with real chromium (1920×1080), always with `?sid=`.
> Every finding is tagged **[clicked]** (reproduced in a browser) or **[source]**
> (read from code, not exercised).

| Priority | Count |
|---|---|
| P0 | 1 (one root cause, 15 call sites; blocks 5 anchored tasks outright) |
| P1 | 4 |
| P2 | 8 |

**Non-persisting mutations found: zero.** Every write path I drove end to end
survived a reload and appeared in `/go?sid=` `state_diff` — see
[§ Verified working](#verified-working-do-not-re-report) for the 20 flows I
confirmed, including all three flows the dev shards handed back.

---

## P0

### HANDLER-001 · Every GitLab-style dropdown built without open state is dead

**One root cause, 15 call sites.** `src/styles/global.css:330` sets
`.dropdown-menu { display: none }`; only `.dropdown-menu.show` /
`.dropdown.show > .dropdown-menu` reveal it. Fifteen places render
`<div className="dropdown">` + `<button className="gl-dropdown-toggle">` with
**no `onClick` and no `open` state**, so the toggle is inert and the menu can
never be seen. The components that got it right
(`MembersTable.RoleDropdown`, `Navbar.Dropdown`, `Controls.SelectDropdown`,
`RefSwitcher`) all keep a `useState` and append `' show'`.

**[clicked]** — each row was reproduced by loading the page with `?sid=`,
clicking the toggle, and re-reading `is_visible()` on the menu. All returned
`false`.

| Route | Control | File:line |
|---|---|---|
| `/:ns/:proj` | **Clone** dropdown — holds the `git clone ssh://…` strings | `src/pages/ProjectOverview.jsx:234` |
| `/:ns/:proj` | **Add to tree** `+` (New file / Upload file / New branch / New tag) | `src/pages/ProjectOverview.jsx:217` |
| `/:ns/:proj` | branch/ref switcher — see HANDLER-002 | `src/pages/ProjectOverview.jsx:210` |
| `/-/issues`, `/-/merge_requests`, `/dashboard/issues`, `/dashboard/merge_requests` | **sort** dropdown (10 issue / 9 MR options) | `src/pages/IssuablesList.jsx:266` |
| same four routes | **Show N items** page-size dropdown | `src/pages/IssuablesList.jsx:501` |
| `/-/issues` | **Import issues** dropdown (Import CSV / Import from Jira) | `src/pages/IssuablesList.jsx:128` |
| `/-/labels` | sort dropdown (6 options) | `src/pages/LabelsList.jsx:236` |
| `/-/milestones` | sort dropdown (6 options) | `src/pages/MilestonesList.jsx:199` |
| `/dashboard/projects`, `/dashboard/projects/starred` | sort dropdown (7 options) | `src/pages/DashboardProjects.jsx:119` |
| `/dashboard/todos` | sort dropdown | `src/pages/DashboardTodos.jsx:253` |
| `/dashboard/todos` | all **five** filter dropdowns (Group / Project / Author / Type / Action), shared `FilterDropdown` | `src/pages/DashboardTodos.jsx:294` |
| `/-/branches/{active,stale,all}` | sort dropdown | `src/pages/Branches.jsx:191` |
| `/-/tags` | sort dropdown | `src/pages/Tags.jsx:89` |
| `/-/merge_requests/:iid` | **Code** dropdown (Check out branch / Open in Web IDE) | `src/pages/MergeRequestDetail.jsx:123` |
| `/-/issues/:iid`, `/-/merge_requests/:iid` | Activity **Sort or filter** dropdown | `src/pages/NotesTimeline.jsx:125` |
| `/-/project_members` → Invite-a-group modal | group picker | `src/pages/MembersTable.jsx:463` |
| `/-/project_members` → Import modal | project picker (the search box below it still works) | `src/pages/MembersTable.jsx:569` |

#### Why this is P0

**`ProjectOverview.jsx:234` (Clone) blocks 5 anchored `exact_match` tasks.**
webarena-293/294/295/296/297 must *read the clone URL off the page and answer
with it*:

```
git clone ssh://git@__GITLAB_SSH__/convexegg/super_awesome_robot.git   webarena-293
git clone ssh://git@__GITLAB_SSH__/convexegg/chatgpt.git               webarena-294
git clone ssh://git@__GITLAB_SSH__/root/metaseq.git                    webarena-295
ssh://git@__GITLAB_SSH__/eriklindernoren/PyTorch-GAN.git               webarena-296
ssh://git@__GITLAB_SSH__/yjlou/2019-nCov.git                           webarena-297
```

The strings are in the markup at `ProjectOverview.jsx:240` and are **correct**.
But on `/byteblaze/dotfiles?sid=aud1`:

```
clone menu visible BEFORE click: False
clone menu visible AFTER  click: False
document.body.innerText.includes('git clone ssh://')  ->  False
```

The source hides this behind a dropdown too, so the fix is **make the toggle
work**, not render the URL inline.

**`ProjectOverview.jsx:217` (Add to tree) is the source's primary entry into
P1-C (20 tasks).** New file / New branch / New tag are otherwise reachable only
by typing the URL. Degraded rather than blocked — the `Add README` /
`Add LICENSE` chips at `ProjectOverview.jsx:252` still work and are what tasks
411–414/736 actually use.

The sort/filter dropdowns render correct `<a href="?sort=…">` links **inside**
the hidden menu, so the URL form of every sort still works and an agent dropped
on `?sort=due_date_desc` gets the right list. Only the click path is dead. On
their own those would be P1; they are listed here because they share one fix.

**Fix (one pattern, 15 call sites):** apply the treatment
`MembersTable.RoleDropdown` (`src/pages/MembersTable.jsx:36-71`) already uses —
`const [open, setOpen] = useState(false)`,
``className={`dropdown${open ? ' show' : ''}`}``, `onClick={() => setOpen(o => !o)}`
on the toggle, plus an outside-click close. Better: lift `Navbar.Dropdown`
(`src/components/layout/Navbar.jsx:19-32`, which is already generic and correct)
into `src/components/layout/GlDropdown.jsx` and replace all 15 call sites, so a
new page cannot reintroduce this.

---

## P1

### HANDLER-002 · Project-overview ref switcher has no menu at all

- **File**: `src/pages/ProjectOverview.jsx:208-214`
- **Control**: the `main` / branch-name button left of the file browser
- **Now** **[clicked]**: `<div className="dropdown">` contains only the
  `<button>` — there is **no `.dropdown-menu` child whatsoever**, so unlike the
  other 14 in HANDLER-001 there is nothing to reveal even after the state fix.
  Clicking does nothing.
- **Should**: open a branch/tag picker over `getBranches(state, project)` /
  `getTags(...)` and navigate to `/:ns/:proj/-/tree/<ref>`.
- **Impact**: P1-K anchors read non-default refs
  (`/dehenne/awesome-visibility/-/graphs/master`,
  `/amwhalen/archive-my-tweets/-/graphs/php52`). Those URLs resolve directly, so
  no anchor is blocked — but an agent browsing to a non-default branch has no
  affordance on the project's main page.
- **Fix**: reuse `src/components/people/RefSwitcher.jsx`, which already
  implements exactly this correctly (it is used on `RepoTree`/`RepoCommits`).

### HANDLER-003 · Native `<form method="get">` submits drop `?sid=` from the URL

- **Now** **[clicked]** on `/byteblaze/a11y-webring.club/-/issues?sid=e10_form`:
  typing `ring` into the filtered-search box and clicking the search button gave

  ```
  http://localhost:5183/byteblaze/a11y-webring.club/-/issues?state=opened&search=ring
  sid still present: False
  ```

  `useGlobalLinkInterception` (`src/App.jsx:89-118`) only intercepts
  `a[href]` clicks. A native GET form submit is a full-page navigation and is not
  intercepted, so every param except the form's own fields is discarded.
- **Not a state loss**: `getSessionId()` (`src/utils/dataManager.js:61-70`) falls
  back to `sessionStorage`, so subsequent mutations still land on the right
  session in the same tab. The damage is that the agent's URL — which
  `url_match` evaluators read and which the harness may re-use — silently loses
  the session id, and every search costs a full page reload.
- **Affected forms** **[source]**, all confirmed to have no `onSubmit`:

  | File:line | Form |
  |---|---|
  | `src/pages/IssuablesList.jsx:242` | issue / MR filtered-search bar (4 routes) |
  | `src/pages/LabelsList.jsx:229` | label `Filter` |
  | `src/pages/MilestonesList.jsx:192` | `Filter by milestone name` |
  | `src/pages/DashboardTodos.jsx:233` | todos filter form |
  | `src/pages/DashboardProjects.jsx:113` | `Filter by name` |
  | `src/pages/ExploreProjects.jsx:62` | explore search |

- **Fix**: give each form an `onSubmit` that `preventDefault()`s and calls
  `useQueryNavigate()` (`src/utils/RedirectWithQuery.jsx:32`), building the
  target from `new FormData(e.target)`. Keep `method="get"` and `action=` on the
  element so the captured DOM stays verbatim. `Navbar.submitSearch`
  (`src/components/layout/Navbar.jsx:51-58`) is the correct in-repo model.

### HANDLER-004 · "Compare branches and continue" silently no-ops with no source branch

- **File**: `src/pages/NewMergeRequest.jsx:106-114`
- **Control**: the step-1 submit button on `/:ns/:proj/-/merge_requests/new`
- **Now** **[clicked]** on `/byteblaze/a11y-webring.club/-/merge_requests/new`:
  the source-branch dropdown defaults to `Select source branch` (state `null`),
  the submit button is **enabled**, and clicking it hits
  `if (!source) return` — URL unchanged, no error rendered
  (`document.querySelector('.gl-alert-danger, .gl-field-error')` → `null`).
  Textbook silent failure: the agent clicks the primary CTA and nothing happens
  with no explanation.
- **Should**: the source's form carries `js-requires-input` and keeps the button
  **disabled** until a source branch is chosen.
- **Impact**: P1-G is 6 tasks (webarena-666/667/668/806). Once a branch *is*
  picked the whole flow works and persists — verified: step 2 reached,
  `.block.reviewer` → `Reviewer|Edit|Byte Blaze` after reload, banner chips
  `['fix-forced-colors-mode', 'main']` in the anchored `[0]`/`[1]` order,
  `state_diff` `['mergeRequests','nextIds.mr']`. So this costs an agent a retry
  loop rather than the task, but it is the exact failure mode that burns
  rollout steps.
- **Fix**: `disabled={!source}` on the submit button at
  `src/pages/NewMergeRequest.jsx:136`, or set an error string instead of the bare
  `return`.

### HANDLER-005 · "Edit issues" bulk mode is a stub, and TODO.md marks it `[x]`

- **Files**: `src/pages/IssuesList.jsx:18,44,46`,
  `src/pages/MergeRequestsList.jsx:16,43,46`,
  `src/pages/IssuablesList.jsx:316-322`
- **Control**: the `Edit issues` / `Edit merge requests` button in `.nav-controls`
- **Now** **[source]**: `onToggleBulk` flips `bulkMode`, which renders a
  per-row `<input type="checkbox" className="custom-control-input" …>` with
  **no `checked` and no `onChange`** (uncontrolled, no selection state) and
  **no bulk-edit sidebar at all**. The source opens a right-hand panel with
  Status / Assignee / Milestone / Labels / Subscriptions and an
  `Update all issues` button. Nothing here can change any issue.
- **Claimed done**: TODO.md P1-F line 261 marks "**Edit issues** bulk mode" `[x]`.
- **Impact**: no anchor route or string depends on bulk edit — I cross-checked
  all 145 anchor routes. Filed at P1 only because it is a `[x]` item that does
  nothing; by task impact alone it is P2.
- **Fix**: either build the sidebar (selection state + a `Update all issues`
  handler calling `updateIn('issues', …)`), or flip the TODO item back to `[ ]`
  and delete the checkbox rendering so the affordance is not advertised.

---

## P2

### HANDLER-006 · One-off dead buttons

All **[source]** from a static scan of every `<button>` / `<select>` /
controlled `<input>` in `src/**`, cross-checked against the anchor set — none is
on an anchored flow. Grouped by file; each has no `onClick` and no
`type="submit"`.

| File:line | Control | Notes |
|---|---|---|
| `src/components/layout/Navbar.jsx:256` | `What's new` | source opens a drawer |
| `src/components/layout/Navbar.jsx:263` | `Keyboard shortcuts` | source opens a modal |
| `src/components/layout/Breadcrumbs.jsx:58` | `toggle-mobile-nav` | mobile-only in the source |
| `src/components/layout/ProjectSidebar.jsx:203` | `Close sidebar` | the `Collapse sidebar` control 5 lines above **does** work |
| `src/components/issuable/Controls.jsx:435` | `Attach a file or image` | markdown toolbar |
| `src/components/issuable/Controls.jsx:440` | `Go full screen` (zen) | markdown toolbar |
| `src/components/issuable/Controls.jsx:248` | `Invite Members` in the assignee-dropdown footer | explicit `onClick={e => e.preventDefault()}` |
| `src/pages/IssuablesList.jsx:125` | `Export as CSV` | |
| `src/pages/IssueDetail.jsx:136` | 👎 award and `Add reaction` | the 👍 button at :133 **does** increment `upvotes` |
| `src/pages/IssueDetail.jsx:300` | `Add time entry` | |
| `src/pages/IssueDetail.jsx:405` | `Move issue` | |
| `src/pages/MergeRequestDetail.jsx:195` | `Add reaction` | |
| `src/pages/MergeRequestDetail.jsx:211` | `Edit commit message` | Merge / Close / Mark as draft next to it all work |
| `src/pages/Branches.jsx:87` | `Delete branch` (per row) | |
| `src/pages/Branches.jsx:209` | `Delete merged branches` | |
| `src/pages/Tags.jsx:132` | `Delete tag` (per row) | |
| `src/pages/MilestoneDetail.jsx:208` | `Delete` milestone | `Close milestone` / `Edit` work |
| `src/pages/MembersTable.jsx:206` | member `Search` button | the filter box next to it is live on `onChange`, so this is cosmetic |
| `src/pages/ProfileAccount.jsx:39` | `Enable two-factor authentication` | |
| `src/pages/ProfileSettings.jsx:151` | `Choose file…` avatar picker | |
| `src/pages/ProjectSettingsGeneral.jsx:212` | avatar file picker | |
| `src/pages/ProjectSettingsGeneral.jsx:271` | 17 feature-permission `<select>`s — `defaultValue`, no `onChange` | changes are visually accepted and silently discarded |
| `src/pages/MembersTable.jsx:367` | `Also unassign this user from related issues…` checkbox in the remove-member modal | uncontrolled |

The `disabled` buttons at `ProjectSettingsGeneral.jsx:476` (`Transfer project`),
`ProfileAccount.jsx:89` (`Delete account`) and `NewMergeRequest.jsx:38`
(the project-name chip) are **correct** — the source renders them disabled too.

### HANDLER-007 · "Invite a group" modal is a non-functional shell

- **File**: `src/pages/MembersTable.jsx:451-489`
- **Now** **[source]**: the group picker button (`:463`) is dead, the search box
  (`:467`) has no `value`/`onChange`, the role `<select>` (`:473`) is
  uncontrolled, the expiration input (`:486`) is uncontrolled, and the `Invite`
  button (`:456`) is hardcoded `disabled` with no handler. `No matching results`
  renders unconditionally.
- **Impact**: none of the 20 P1-B tasks invites a *group* — they all use
  `Invite members`, which works fully (verified below). Cosmetic.
- **Fix**: either wire it against `state.groups` mirroring `invite()` at
  `MembersTable.jsx:131-150`, or leave it; if left, at least state so in
  `SCHEMA.md`.

### HANDLER-008 · Members table renders no **Groups** tab

- **File**: `src/pages/MembersTable.jsx:186-195`
- **Now** **[source]**: only the `Members` tab with its count badge is rendered.
- **Should**: TODO.md P1-B line 168 specifies "Members/Groups tabs"; the source
  shows both.
- **Impact**: unanchored — `gitlab_get_project_memeber_role` reads the Members
  table, which is correct.

### HANDLER-009 · Fork header does not show "Forked from &lt;source&gt;"

- **File**: `src/pages/ProjectOverview.jsx:113-157`
- **Now** **[clicked]**: forked `yjlou/2019-nCov` → `byteblaze/2019-nCov` through
  the UI; the fork is real (22 tree rows, `forked_from` written to state, appears
  in `[data-qa-selector="projects_list"]`), but
  `document.body.innerText.includes('Forked from')` → `false` on the fork's page.
- **Should**: render `Forked from <source name_with_namespace>` under the title.
  `forkProject()` (`src/components/create/mutations.js`) already writes
  `project.forked_from = {id, full_path, name, name_with_namespace}`.
- **Impact**: unanchored; no evaluator reads it. This is the one P1-E bullet
  `DEV.part-create.md` handed back — **confirmed real**, and cosmetic.

### HANDLER-010 · `slugify()` in `src/utils/format.js` is wrong but has zero callers

- **File**: `src/utils/format.js:122-128`
- **Now** **[source]**: `.replace(/[ ._]+/g, '-')` collapses `_` and `.` to `-`,
  so `nolan_honest_fans` → `nolan-honest-fans`. GitLab preserves them —
  `DEV.part-create.md` measured this on the live site by typing into
  `#project_name` and reading `#project_path` back.
- **Confirmed scope**: `grep -rn slugify src/` returns exactly **two** hits — the
  definition itself and a warning comment at
  `src/components/create/mutations.js:41`. **Nothing imports it.** Creation goes
  through `mutations.js:deriveSlug()`, which is correct — verified live:
  `Do it myself` → `Do-it-myself`, `coding_friends` → `coding_friends`,
  `AGISite` → `AGISite`.
- So this is the third dev handback and it is **real but latent** — a trap for
  the next author, not a live defect. Fix to
  `str.trim().replace(/[^A-Za-z0-9_.-]+/g, '-')` (case preserved), or delete the
  export.

### HANDLER-011 · Navbar "Set status" is a link, not the modal the TODO specifies

- **File**: `src/components/layout/Navbar.jsx:290`
- **Now** **[clicked]**: clicking it navigates to
  `/-/profile?set_status=1&sid=…` (sid **is** preserved). No modal opens, and
  `set_status` is not read anywhere in `src/` — the profile page just renders
  with its inline "Current status" field.
- **Impact**: none on tasks. Typing `Cruising` into that field and clicking
  `Update profile settings` produces
  `document.querySelector('.cover-status').lastChild.textContent === "Cruising"`
  on `/byteblaze`, persisted (`state_diff` `['currentUser.status','users']`) —
  webarena-418…422 pass via this path. This is the second dev handback:
  **confirmed as a missing second entry point, not a gap.**
- **Fix**: read `?set_status=1` in `ProfileSettings.jsx` and open the status
  editor focused, or lift it into a real modal from the avatar menu.

### HANDLER-012 · 35 routes render the `<Placeholder>` "not implemented yet" copy

- **File**: `src/components/layout/Placeholder.jsx`, wired at
  `src/App.jsx:248,249,273-306,310`
- **Now** **[clicked]** via a 60-route crawl: each renders the literal string
  *"This view is registered in `ROUTES.md` as row **#N** and has not been
  implemented yet."* — visible placeholder copy an agent will read.
- **Cross-checked against all 145 anchor routes: zero overlap.** Every one is
  under TODO.md P2 `[ROUTES #99–118]` / `#76`, all of which are still `[ ]`.
  So nothing is mislabelled `[x]` here.
- One inconsistency worth a line: `src/App.jsx:297`
  (`/:ns/:proj/-/snippets/new`) is still `<Placeholder>` even though
  `src/pages/NewSnippet.jsx` exists and is wired at the global `/-/snippets/new`.
- **Fix**: replace the placeholder body with the source's real empty-state copy
  for those leaves (TODO.md already asks for this: "render the shell + the real
  empty copy so the left sidebar has **no dead links**"). Point
  `App.jsx:297` at `<NewSnippet />`.

### HANDLER-013 · Minor uncontrolled inputs

- `src/pages/ProfileNotifications.jsx:48` — notification-email `<select>` is
  uncontrolled, but has exactly one option; harmless.
- `src/pages/MembersTable.jsx:23,35` — the two `<select>`s flagged by the scan
  are inside the Invite-a-group shell (HANDLER-007).

---

## Verified working — do not re-report

Driven end to end in chromium with `?sid=`, re-read after a **reload**, and
confirmed in `/go?sid=` `state_diff`. Listed because two of these are dev-shard
handbacks that are **already fixed**, and re-reporting them would cost the dev
agent a round.

| Flow | Evidence | `state_diff` |
|---|---|---|
| **Star / Unstar** (`ProjectOverview.jsx:145`) — *handback #1 is RESOLVED* | `Star 0` → click → `Unstar 1` → reload → `Unstar 1`; `/users/byteblaze/starred` lists it | `projects`, `stars`, `ui.starredProjectIds` |
| Post a comment (P1-I, 8 tasks) | `#notes-list` lastElementChild `.timeline-discussion-body` `outerText` === `'lgtm'` before **and** after reload | `issues`, `notes`, `nextIds.note` |
| Follow a user (P1-J) | `.user-profile` on `/users/byteblaze/following` contains `@yjlou` | `users`, `follows` |
| Set status (418–422) | `.cover-status` `lastChild.textContent` === `"Cruising"` | `currentUser.status`, `users` |
| Website URL (448–452) | `.profile-header [itemprop="url"]` `outerText` === `egg.tart.com` | `currentUser.website_url`, `users` |
| Create blank project (P1-A) | slug `AGISite` case-preserved; `/-/commits` contains `Initial commit` | `projects`, `members`, 4 `repo.*Overlay`, `nextIds.*` |
| Create from template (748–756) | `Pages/Jekyll` → description `Example Jekyll site using GitLab Pages: https://pages.gitlab.io/jekyll`; commit `Initialized from 'Pages/Jekyll' project template` | `projects`, `members`, 4 file overlays |
| Invite member + role read-back (P1-B, 20 tasks) | `gitlab_get_project_memeber_role`-shaped read of `@abisubramanya27` → `Guest`, still `Guest` after reload | `members`, `nextIds.member` |
| Create file incl. nested folder (552–555) | `real_space/urls.txt` → `/-/raw/main/real_space/urls.txt` returns the body | `repo.fileOverlay.*`, `treeOverlay`, `commitOverlay` |
| Web IDE create + commit (556–566) | New file → `Create file` → editor enables → `Commit` → `/-/raw/main/AUDITME.md` returns `# audit` | `repo.fileOverlay.*` |
| Fork (P1-E, 10 tasks) | `yjlou/2019-nCov` → `/byteblaze/2019-nCov`, 22 tree rows, in `[data-qa-selector="projects_list"]` | `projects`, `members`, 5 file overlays, `nextIds.*` |
| Create group (799–803) | `coding_friends` slug preserved; `/groups/coding_friends/-/group_members` resolves | `groups`, `members`, `nextIds.*` |
| Create issue + due date (658–660, 808) | `[data-testid="sidebar-due-date"]` → `Due date|Edit|Dec 31, 2030|-|remove due date`, same after reload | `issues`, `nextIds.issue` |
| Create MR + reviewer (666–668, 806) | `.block.reviewer` → `Reviewer|Edit|Byte Blaze` after reload; chips `['fix-forced-colors-mode','main']` | `mergeRequests`, `nextIds.mr` |
| Create milestone (590–594) | `.block.start_date`/`.block.due_date` correct; `#content-body` contains `Jan 16, 2030–Jan 30, 2030` | `milestones`, `nextIds.milestone` |
| Issue sidebar edit-in-place | assignee set via Edit → `.block.assignee` → `Byte Blaze` after reload | `issues` |
| Close issue | status badge → `Closed` | `issues` |
| Create label | `audit-label` appears on `/-/labels` | `labels`, `nextIds.label` |
| Todos `Mark as done` **and** `Mark all as done` | 5 → 4 rows + navbar badge 5 → 4; then 0 rows + `Nothing is on your to-do list. Nice work!` | `todos` |
| Project settings description (`/:ns/:proj/edit`) | `AUDIT DESC` renders in `.home-panel-description-markdown` | `projects` |
| Profile preferences | 12 `ui.preferences.*` keys written | `ui.preferences.*` |
| Blob file actions | `Edit` / `Replace` / `Delete` / `Web IDE` / `Raw` all visible and `Edit` reaches `/-/edit/main/README.md` with a live editor | — |

A 60-route crawl (dashboards, explore, profile tabs, repo views, group,
issue/MR/label/milestone lists, `/projects/new`, `/groups/new`, `/search`,
`/help`) produced **zero uncaught JS errors, zero blank pages, and zero
placeholders outside the 35 in HANDLER-012**.

---

## Out-of-dimension observations

- `src/components/layout/Navbar.jsx:261,262,266,267` and
  `src/pages/NewProject.jsx:455` contain absolute `https://about.gitlab.com` /
  `forum.gitlab.com` / `gitlab.com` hrefs — offline-purity is shard 1's call.
- `src/components/layout/routeContext.js` treats `/groups/new` as a group named
  `new` (dev-create's third handback); it is worked around with a
  `body.page-new-group` class. Routing, not handlers.
- `state.snippets` is created lazily by `NewSnippet.jsx` and is not in
  `SCHEMA.md`'s 12 mutable modules — shard 3's call.
