# DEV — fix shard 3 of 3 · dead controls, sid loss, header parity

> App: `websites/webarena_gitlab_mock/` · owned files: `src/pages/**`,
> `src/components/ui/**` (new), feature CSS under `src/components/`.
> Everything below was driven in real chromium at `http://localhost:5193` with
> `?sid=`, and every mutation was re-read **after a reload** and confirmed in
> `/go?sid=` `state_diff`.
>
> `npm run build`: **PASS**.
> 40-route crawl after the changes: **0 JS errors, 0 blank pages.**

---

## New shared primitives

### `src/components/ui/Dropdown.jsx`

The one real GitLab dropdown. Open/close state, click-outside dismissal
(`mousedown` **and** `focusin`), `Escape` closes and returns focus to the
toggle, and the aria attributes BootstrapVue emits on the source
(`aria-haspopup="true"`, `aria-expanded`). Markup is entirely caller-controlled
— `as` / `className` / `toggleAs` / `toggleClassName` / `toggleProps` /
`menuAs` / `menuClassName` / `menuProps` — so each call site keeps the source's
verbatim classes and `data-*` attributes. `closeOnSelect={false}` for menus that
hold inputs (clone URLs, the group/project pickers).

Also exports `useOutsideClose(ref, onClose, active)`.

### `src/components/ui/QueryForm.jsx`

A `<form method="get">` that submits through the router. Reproduces the
browser's own serialisation (every named enabled field, in document order,
empty values included), then appends the live `sid` last so the source's param
order is unchanged. `method=` and `action=` stay on the element so the captured
DOM is verbatim.

---

## Closed

### P0 · HANDLER-001 — every GitLab-style dropdown was dead

All 15 call sites now route through `Dropdown`, plus the ref switcher
(HANDLER-002) which had no menu at all.

| Route | Control | File |
|---|---|---|
| `/:ns/:proj` | **Clone** | `src/pages/ProjectOverview.jsx` |
| `/:ns/:proj` | **Add to tree** `+` | `src/pages/ProjectOverview.jsx` |
| `/:ns/:proj` | ref switcher — now `RefSwitcher` (HANDLER-002) | `src/pages/ProjectOverview.jsx` |
| 4 issuable routes | sort | `src/pages/IssuablesList.jsx` |
| 4 issuable routes | **Show N items** | `src/pages/IssuablesList.jsx` |
| `/-/issues` | **Import issues** | `src/pages/IssuablesList.jsx` |
| `/-/labels` | sort | `src/pages/LabelsList.jsx` |
| `/-/milestones` | sort | `src/pages/MilestonesList.jsx` |
| `/dashboard/projects{,/starred}` | sort | `src/pages/DashboardProjects.jsx` |
| `/dashboard/todos` | sort | `src/pages/DashboardTodos.jsx` |
| `/dashboard/todos` | all **five** `FilterDropdown`s | `src/pages/DashboardTodos.jsx` |
| `/-/branches/*` | sort | `src/pages/Branches.jsx` |
| `/-/tags` | sort | `src/pages/Tags.jsx` |
| `/-/merge_requests/:iid` | **Code** | `src/pages/MergeRequestDetail.jsx` |
| issue/MR detail | Activity **Sort or filter** | `src/pages/NotesTimeline.jsx` |
| `/-/project_members` | Invite-a-group group picker | `src/pages/MembersTable.jsx` |
| `/-/project_members` | Import-modal project picker | `src/pages/MembersTable.jsx` |

**Clicked, on `/byteblaze/dotfiles?sid=fix3`:**

```
clone menu before: False   after: True   after Escape: False
ssh  value: ssh://git@__GITLAB_SSH__/byteblaze/dotfiles.git
http value: http://localhost:5193/byteblaze/dotfiles.git
'git clone ssh://' present in body text: True
add-to-tree "New file" visible: True   after outside click: False
ref switcher dropdown content visible: True
```

The clone widget was also rebuilt to the source's real markup
(`assets/html/proj-dotfiles.html`): `div.git-clone-holder.js-git-clone-holder`,
an `<a class="clone-dropdown-btn" data-qa-selector="clone_dropdown">` toggle, a
`<ul class="dropdown-menu … clone-options-dropdown">` with readonly
`#ssh_project_clone` / `#http_project_clone` inputs + Copy-URL buttons, the
`Open in your IDE` section, and the full `git clone …` sentence (which is what
webarena-293…297 answer with).

While converting them, three things inside those menus that were themselves
dead were also wired: `Import CSV` now opens the source's **Import issues**
modal, the todos filter dropdowns' search boxes now narrow their option list,
and the Activity **Sort or filter** entries now actually sort (`Newest first` /
`Oldest first`) and filter (`Show all activity` / `comments only` / `history
only`). Verified: 3 notes → 0 with `Show comments only`.

> Note on `d-none`: the source's clone holder carries `d-none d-md-inline-block`
> and the issue header's author link carries `d-none d-sm-inline`. This
> stylesheet has `.d-none { display:none !important }` and **no responsive
> re-show**, so copying those classes verbatim made both invisible. Both are
> rendered without the responsive pair, matching the desktop view. Called out
> here because it will bite the next author who copies markup from
> `assets/html/`.

### P0 · PARITY-003 — `navigate()` dropping `?sid=`

**9 of the 10 reported call sites were already correct** and the audit
mis-scored them: `NewIssue.jsx:83`, `EditIssue.jsx:62`,
`NewMergeRequest.jsx:114,188`, `EditMergeRequest.jsx:66`,
`NewMilestone.jsx:57,75`, `NewLabel.jsx:61`, `DashboardTodos.jsx:147` all bind
`navigate` to `useNavigateWithQuery()` from
`src/components/issuable/Controls.jsx:23`, which re-attaches `sid`. A grep for
`navigate(` does not distinguish that from react-router's `useNavigate`.

**`src/pages/Search.jsx` was the one real defect** and is fixed. It imported
react-router's `useNavigate` directly, and `withParams()` (`Search.jsx:102`)
builds from a fresh `URLSearchParams`, so the Status/Confidentiality filter
submit dropped `sid`. Now uses `useQueryNavigate()` with `{ keepQuery: false }`
— which re-attaches `sid` and nothing else, so a filter submit still *replaces*
the filter set rather than merging the old one back.

```
before: /search?scope=issues&search=accessibility&state=opened
after : /search?scope=issues&search=accessibility&state=opened&sid=fix3b
```

### P1 · HANDLER-003 — native GET form submits dropping `?sid=`

All six forms now use `QueryForm`:
`IssuablesList.jsx` (4 routes) · `LabelsList.jsx` · `MilestonesList.jsx` ·
`DashboardTodos.jsx` · `DashboardProjects.jsx` · `ExploreProjects.jsx`.

```
type "ring" + click Search on /byteblaze/a11y-webring.club/-/issues?sid=fix3
-> /byteblaze/a11y-webring.club/-/issues?state=opened&sort=created_date&search=ring&sid=fix3
```

A hidden `sort` (and `non_archived` on explore) field was added to the forms
that had none, so a search no longer silently resets the active sort — which is
what the source's Vue filtered-search does. Hidden fields, no visible DOM change.

### P1 · HANDLER-004 — "Compare branches and continue" silent no-op

`src/pages/NewMergeRequest.jsx` — `disabled={!source}` on the step-1 submit,
matching the source's `js-requires-input`. Verified: button reports
`is_disabled() == True` on a fresh `/-/merge_requests/new`.

### P1 · HANDLER-005 — "Edit issues" bulk mode was a stub

**Implemented** rather than un-ticking TODO.md (which I do not own).
`IssuableListBody` keeps selection state, the per-row checkbox is controlled,
and `BulkUpdateSidebar` (`src/pages/IssuablesList.jsx`) renders the source's
right-hand panel: Status · Assignee · Milestone · Labels (multi) · Subscriptions
(issues only) · `Update all issues` / `Update all merge requests`. Every field
left on `No change` is untouched, as in the source. `.right-sidebar` is
`position: fixed`, so the list gets `padding-right: var(--right-sidebar-width)`
while bulk mode is on.

```
Edit issues -> sidebar visible: True
check one row -> sidebar header: "1 selected"
Status=Closed -> Update all issues -> reload -> Closed tab count 6 -> 7
```

### P1 · PARITY-005 — issue-detail header

`src/pages/IssueDetail.jsx`. The sentence is now `Issue created …` (was
`Created …`), preceded by the issue-type icon and followed by the
`.user-access-role` pill with the source's tooltip
(`This user has the maintainer role in the <project> project.`), derived from
the author's real membership.

The action block was rebuilt per §14.3: `Close issue` / `Reopen issue`
(`data-qa-selector="close_issue_button"` / `reopen_issue_button"`) plus a `⋮`
`Issue actions` dropdown containing `New related issue`
(`…/-/issues/new?add_related_issue=<iid>`) and `Delete issue` (confirm modal →
`removeFrom('issues')` → back to the list). The `Edit` and `New issue` buttons
the source does not have are gone.

```
rendered: Closed | Issue created 7 years ago by | Byte Blaze | Maintainer
        | Reopen issue | Issue actions
```

**ROUTES.md row 72 (`?add_related_issue=`) is now reachable** — `NewIssue.jsx:27`
already read the param; the link that produces the URL simply had no home. That
row can be marked `[x]` by whoever owns ROUTES.md.

### P1 · PARITY-006 — hard-coded clone host

`src/pages/ProjectOverview.jsx` — the HTTP clone URL is derived from
`window.location.origin`. The SSH URL keeps the `__GITLAB_SSH__` placeholder
(unchanged, as the audit specified). The other nine `localhost:8023`
occurrences the audit marked correct were left alone.

### P1 · Handbacks

- **Star / Unstar** — already present and working at
  `ProjectOverview.jsx:145`; the handlers audit reached the same conclusion.
  What I did fix: `toggleStar` also wrote `ui.starredProjectIds`, which shard 1
  is deleting — that sync block is removed, so the write is `state.stars` +
  `projects[].star_count` (the visible count and the dashboard-sort anchor).
  Without this the toggle would have thrown on `undefined.filter` the moment
  shard 1 landed. Verified: `Unstar 1` → click → `Star 0` → reload → `Star 0`.
- **Forked from** — `ProjectOverview.jsx` renders
  `Forked from <name_with_namespace>` linking to the parent, from
  `project.forked_from`.

### P2

| Finding | What landed |
|---|---|
| HANDLER-006 `Export as CSV` | Opens the source's **Export issues** modal (`The CSV export will be created in the background…`) |
| HANDLER-006 issue 👎 / `Add reaction` | 👎 increments `issue.downvotes`; `Add reaction` is a real emoji picker writing `issue.awards[]`. Verified `👍 0 👎 1 🎉 1` after reload |
| HANDLER-006 `Add time entry` | Estimate / Time spent fields writing `time_estimate` / `total_time_spent`; the block renders `Estimated: 1h 30m · Spent: 45m` after reload |
| HANDLER-006 `Move issue` | Project picker over the user's memberships; moves the issue, allocates a fresh `iid`, navigates. Verified: `…/a11yproject.com/-/issues/1534` |
| HANDLER-006 MR `Add reaction` | Same picker on `MergeRequestDetail`, writing `upvotes`/`downvotes`/`awards` |
| HANDLER-006 MR `Edit commit message` | Toggles a textarea bound to `mr.merge_commit_message` |
| HANDLER-006 `Delete` milestone | Was `disabled`; now a confirm modal that detaches the milestone from issues/MRs, removes it, and returns to the list. Verified 4 → 3 rows across a reload |
| HANDLER-006 members `Search` button | Applies the trimmed filter (the box was already live on `onChange`) |
| HANDLER-006 remove-member `Also unassign…` checkbox | Controlled; when checked, drops the user from `assignee_ids` / `reviewer_ids` on issues and MRs before removing the membership |
| HANDLER-006 avatar pickers (profile + project settings) | Real hidden `<input type="file">` driven by the button, filename rendered in the `js-*-filename` span |
| HANDLER-006 **17 feature-permission `<select>`s** | Were `defaultValue` with no `onChange` — changes were visually accepted and silently discarded. Now controlled and persisted to `project.feature_settings` by `Save changes`. Verified: `20` → `10` → reload → `10` |
| HANDLER-007 Invite-a-group modal | Fully wired against `state.groups`, writing `state.groupLinks` |
| HANDLER-008 members **Groups** tab | Added, with the count badge and a Group / Max role / Expiration / remove table. Verified: invite → reload → `GitLab Instance` present; `state_diff` `{'groupLinks': {'new': [...]}}` |
| HANDLER-011 navbar `Set status` | `ProfileSettings` reads `?set_status=1`, scrolls `#current-status` into view and focuses the message field. Verified `document.activeElement` name is `user[status][message]` |
| HANDLER-013 uncontrolled inputs | The `MembersTable.jsx:23,35` selects were in the Invite-a-group shell and are now controlled. `ProfileNotifications.jsx:48` left as-is (one option, harmless) |
| PARITY-009 (my half) | `ui.starredProjectIds` sync removed from `toggleStar` |
| PARITY-010 feed token | `revealed` defaults to `false` (source masks it); the invented `<p>Feed token: …</p>` is deleted. Also wired the previously dead `Enable two-factor authentication` button to toggle `currentUser.two_factor_enabled` |

---

## NOT closed

### HANDLER-012 — 35 `<Placeholder>` routes · NEEDS FILE

`NEEDS FILE: src/App.jsx` — the 35 placeholder routes are wired at
`App.jsx:248,249,273-306,310`, and the copy lives in
`src/components/layout/Placeholder.jsx`. Both belong to shard 2. The
`/:ns/:proj/-/snippets/new` → `<NewSnippet />` repoint is in the same file.
Nothing in my tree can reach them.

### HANDLER-006 `Delete branch` / `Delete merged branches` / `Delete tag` · NEEDS FILE

`NEEDS FILE: src/utils/dataManager.js (shard 1)` — `getBranches()` /
`getTags()` are read-through over `staticRepo` plus an **additive**
`repo.branchOverlay` / `repo.tagOverlay`. There is no deletion channel, so a
delete implemented only inside `Branches.jsx`/`Tags.jsx` would vanish from those
pages while the project-overview `N Branches` counter and every ref switcher
kept showing the branch. That is a worse failure than the current inert button,
so I left it rather than shipping a half-visible delete.

Suggested fix for whoever owns `dataManager.js`: add
`repo.branchDeletions[fullPath]` / `repo.tagDeletions[fullPath]` (arrays of
names) and filter them out at the end of `getBranches` / `getTags`. The page-side
handler is then three lines.

### HANDLER-006 items outside my ownership

`Navbar.jsx` (`What's new`, `Keyboard shortcuts`), `Breadcrumbs.jsx`
(`toggle-mobile-nav`), `ProjectSidebar.jsx` (`Close sidebar`) → shard 2.
`Controls.jsx` (`Attach a file or image`, `Go full screen`, `Invite Members` in
the assignee footer) → not in my file list.

---

## New state key — needs a `SCHEMA.md` row

`state.groupLinks` is created lazily on the first `Invite a group` (the same
pattern `NewSnippet.jsx` uses for `state.snippets`). Shape:

```js
{ id, source_type: 'project'|'namespace', source_id, group_id,
  group_name, group_path, access_level, access_label, expires_at, created_at }
```

It appears correctly in `/go` `state_diff`. `SCHEMA.md` is owned by another
shard — it needs a row in the mutable-modules table and in Observable State
Changes (`Invite a group` → `groupLinks`).

Two other fields are now written that `SCHEMA.md` does not list:
`project.feature_settings` (the 17 feature permissions),
`issue.downvotes` / `issue.awards[]` / `issue.time_estimate` /
`issue.total_time_spent` / `issue.moved_from`, and the MR equivalents.

---

## Verification commands

```bash
export PATH="/tmp/node-v20.18.1-linux-x64/bin:$PATH"
(cd websites/webarena_gitlab_mock && npm run dev -- --port 5193)
(cd websites/webarena_gitlab_mock && npm run build)     # PASS
```

---

# Addendum — routed edits (second pass)

## The four white-screen routes were already fixed

`ReferenceError: QueryForm is not defined` was real, and it was mine — I
introduced `QueryForm` and hit exactly this gap mid-round. It was fixed before
my first report; shard 1's reproduction was against a build from the window in
between. Current state, all six files that use `QueryForm` import it:

```
DashboardProjects  1    ExploreProjects  1    DashboardTodos  1
LabelsList         1    IssuablesList    1    MilestonesList  1
```

Re-verified cold in chromium — a **fresh browser context per route** (empty
localStorage) and a fresh `?sid=`, asserting on real content rather than the
absence of a console error:

```
/                                       body=1799  main=1762  errs=[]   project rows: 14
/explore                                body=2505  main=2468  errs=[]   project rows: 20
/dashboard/todos                        body= 635  main= 598  errs=[]   todo rows:     5
/a11yproject/a11yproject.com/-/labels   body=2599  main=1903  errs=[]   label rows:   20
/dashboard/projects                     body=1799  main=1762  errs=[]   project rows: 14
```

### Sweep for the same class of bug — clean

Static sweep of all 76 `src/**/*.jsx`: every capitalised JSX element reference
checked against that file's imports, local declarations and destructured
bindings, with comments stripped. **One** hit, a false positive:
`src/components/ui/Dropdown.jsx` `['MenuTag', 'Tag', 'ToggleTag']` — those are
`as:`-renamed props (`as: Tag = 'div'`, `toggleAs: ToggleTag`,
`menuAs: MenuTag`), confirmed by reading the file. No other unimported
component anywhere in the app.

Worth noting for the round: `npm run build` cannot catch this class of bug —
Rollup does not resolve JSX identifiers, so an unimported component is a runtime
`ReferenceError` that builds clean. The 40-route crawl I run does catch it (it
listens on `pageerror` and asserts a non-empty body), which is how I found it
the first time.

## PIPELINE-002 — fork no longer copies the repo

`forkProject()` now writes exactly:

```js
repo: { ...prev.repo, forkOrigin: { ...(prev.repo.forkOrigin || {}), [fullPath]: source.full_path } }
```

The blob/tree/commit/branch copy loops are deleted, along with the now-unused
`ref` local. Reads resolve through shard 1's `originPath()` fall-through.

**Clicked**, forking `yjlou/2019-nCov` → `byteblaze/2019-nCov`:

```
tree rows: 22      commit stat: 344 Commits     branch stat: 4 Branch
/-/commits/master commit rows: 40              "Forked from" present: True
state_diff keys: ['members', 'nextIds.member', 'nextIds.project', 'projects',
                  'repo.forkOrigin.byteblaze/2019-nCov']
state_diff size: 2,500 bytes   (the copy it replaced was 26,636 bytes for this repo;
                                49,709 bytes of blobs alone for first-contributions)
```

Post-fork edits stay local — forked `firstcontributions/first-contributions`,
then created `FORKNOTE.md` on the fork:

```
fileOverlay keys after the edit: ['repo.fileOverlay.byteblaze/first-contributions:main:FORKNOTE.md']
total diff after the edit: 3,320 bytes
source  /firstcontributions/first-contributions/-/raw/main/FORKNOTE.md : absent
fork    /byteblaze/first-contributions/-/raw/main/FORKNOTE.md          : present
```

⚠️ **One behaviour deliberately dropped, flagged for your call.** The old code
also copied the *source's* `fileOverlay` entries into the fork, so an edit made
to a project **before** forking it travelled with the fork. `originPath()`
resolves the **static** layer only, so that no longer happens. I followed the
instruction exactly ("write exactly … and nothing else") rather than
reintroducing a bounded copy of just the source overlay, which would have been
cheap (it is only the handful of blobs a task edited, not the repo). No seeded
task forks a project it has already edited, so nothing regresses today. Say the
word if you want the narrow overlay inheritance back.

## New P1 — deterministic commit SHAs

`makeSha()` was `Math.random()` per hex digit. It is now five FNV-1a passes over
a caller-supplied seed (5 x 8 = 40 hex chars). `writeFiles()` seeds it with the
repo path, the ref, the commit title, **the current commit depth for that ref**,
and every file's path + body — the depth term is what keeps two identical
commits from colliding.

**Clicked**, creating `SHATEST.md` under three fresh sids in fresh browser
contexts:

```
runA (same content): f1ed16363aa0a0c4b352674929cf29806152ff30
runB (same content): f1ed16363aa0a0c4b352674929cf29806152ff30   <- identical
runC (diff content): 6d9f7677bbaf3b3db0a08b02164fa89967d41f09   <- distinct
```

`makeSha` has exactly one caller (`writeFiles`), so nothing else needed touching.

## Timestamp shapes — one correction to the routing you gave me

Done at 25 of the 28 `new Date().toISOString()` sites in `src/pages/**`. Two
corrections to the list:

**1. The seed has TWO Postgres sub-shapes, and they are per-collection.**
`dbStamp()` emitted only the microsecond form, which would still have mismatched
half the collections:

| shape | collections |
|---|---|
| `2023-03-19 16:45:03.408771` | labels · members · stars · users |
| `2022-11-13 10:47:48` | notes · issues · milestones · merge_requests |

`dbStamp` now takes `{ micros }` and each call site is routed to its own
collection's shape. Verified at runtime off `/go`:

```
labels created_at = '2026-08-07 22:53:08.455000'   micros: True
stars  created_at = '2026-08-07 22:53:11.038000'   micros: True
notes  created_at = '2026-08-07 22:53:13'          plain:  True
```

**2. `NewTag.jsx:43` and `NewBranch.jsx:46` must NOT use `dbStamp`.** Your list
included `NewTag:43`. Those two fields are git-shaped in the seed, not
Postgres-shaped:

```
branches.json  committed_date: '2023-01-30T07:21:34+08:00'
tags.json      date:           '2022-05-05T13:03:16-07:00'
```

Both now use the existing `gitStamp()`. Using `dbStamp` there would have made a
created tag the only Postgres-shaped value in a git-shaped collection — the
exact inconsistency this sweep is removing, just pointed the other way.

**3. Left alone: `MembersTable.jsx:394.`** It is
`formatCommitDate(isSelf ? new Date().toISOString() : user.created_at)` — a
render-time argument that is formatted immediately and never stored, so it
cannot appear in a diff.

Four files (`EditIssue`, `EditMergeRequest`, `NewIssue`, `NewMergeRequest`) had
the new import spliced into the middle of an existing multi-line import by my
edit script; caught and repaired before the build.

## PARITY-009

Confirmed closed on my half — `grep -c starredProjectIds src/pages/ProjectOverview.jsx` → `0`.

## Gates after this pass

```
npm run build                : PASS
40-route crawl               : 0 JS errors, 0 blank pages
unbound-JSX-component sweep  : 0 real hits
```
