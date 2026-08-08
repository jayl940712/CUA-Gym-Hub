# DEV — shard B (issues, merge requests, milestones, labels, comments, todos)

Build: **PASS** (`npm run build`, 152 modules, includes the other shards' files).
Verification: real chromium at 1920×1080 against `npm run dev -- --port 5182`.

---

## Anchor verification (driven end to end in a browser, not inspected by eye)

| Anchor | Locator / value read back | Result |
|---|---|---|
| webarena-658/659/660/808 | `document.querySelector('.block.assignee').outerText` | `Assignee\nEdit\nRoshan Jossy` — matches §14b's recorded shape |
| webarena-658…808 | `document.querySelector('[data-testid="sidebar-due-date"').outerText` | `Due date\nEdit\nDec 31, 2030\n-\nremove due date` |
| §0.9 separation | `document.querySelector('.block.due_date')` on an **issue** | `null` (correct — that class is milestone-only) |
| webarena-590…593 | `.block.start_date` / `.block.due_date` on a created milestone | `Start date\nEdit\nJan 16, 2030` / `Due date\nEdit\nJan 30, 2030 (Upcoming)` |
| webarena-590…593 | `#content-body` contains `Jan 16, 2030–Jan 30, 2030` | true (bare EN DASH, no spaces) |
| webarena-666/667/668/806 | `.block.reviewer` after creating an MR with a reviewer | `Reviewer\nEdit\nByte Blaze` |
| webarena-666…806 | `querySelectorAll('.detail-page-description > a.gl-font-monospace')` | `['redesign', 'main']` — `[0]` source, `[1]` target |
| §15b | `document.querySelector('.detail-page-description').outerText` | the banner, not the body |
| webarena-390…393 | `#notes-list` lastElementChild `.timeline-discussion-body` outerText | exactly `lgtm` (no signature/timestamp/whitespace) |
| webarena-44 | `/dashboard/todos` | badges `5` / `2`; row 1 innerText matches §4b.7 verbatim |
| webarena-339/102/340/341/343/106/103/104/105/342 | filter tokens on the anchored list URLs | `Label = ~bug`, `~help wanted`, `~type: bug 🐞`, `~None`, `Label != ~BUG`, `~question` + free-text chips `OPT` / `model` |

`/go?sid=` `state_diff` after the issue flow reported `issues.added`, `notes.added`,
`nextIds.issue`, `nextIds.note` — every mutation is visible to the reward signal.

---

## Completed

### P1-F — Issues
- [x] `[ROUTES #71]` **`/:ns/:proj/-/issues/new`** — `NewIssue.jsx`. Title (required) with the
  `This field is required.` error, Type dropdown (Issue / Incident, the Incident item navigates
  to the source's `?issuable_template=incident&issue%5Bissue_type%5D=incident` URL), markdown
  editor with the 15 toolbar buttons and their verbatim `title`s, confidentiality checkbox,
  Assignee (+ `Assign to me`), Milestone, Labels, Due date, `Create issue` / `Cancel`.
  Honours `?add_related_issue=` and `?issue[milestone_id]=` prefills.
- [x] `[ROUTES #73]` `/-/issues/:iid/edit` — `EditIssue.jsx`, same form, `Save changes`.
- [x] `[ROUTES #70]` Issue detail sidebar rebuilt to §14b: block **order** is now the source's
  (Assignee, Labels, Milestone, Due date, Time tracking, Confidentiality, Lock issue,
  Notifications, Participants, Reference, Move issue) — it was Assignee/Milestone/Due-date/
  Time/Labels before. Class strings corrected: `.block.issuable-sidebar-item.lock`,
  `.block.with-sub-blocks` (was `.block.reference`), `Copy Reference` capital R.
  Assignee header is count-dependent (`Assignee` / `0 Assignees` / `n Assignees`) and the empty
  value renders `None - assign yourself` as three nodes.
- [x] Sidebar **edit-in-place** on Assignee / Labels / Milestone / Due date / Confidentiality /
  Lock / Notifications — each writes through `updateIn` immediately.
- [x] `[ROUTES #69]` Issue list — removed the `<h1>Issues</h1>` (§13.1: this page has none),
  moved the buttons into `.top-area > .nav-controls` with the RSS / calendar / Export /
  Import-issues / `Edit issues` / `New issue` set, added the applied-token strip, the ten
  verbatim sort options plus the direction toggle, the page-size dropdown, the `CLOSED` /
  `MERGED` `li.issuable-status`, and both empty states verbatim (§13b.3 / §13b.4).
- [x] `[ROUTES #5]` `/dashboard/issues` — state tabs added; `scope`, `state`,
  `assignee_username`, `milestone_title` all drive the list.

### P1-G — Merge requests
- [x] `[ROUTES #84]` **`/-/merge_requests/new`** — `NewMergeRequest.jsx`, both steps on one
  route. Step 1: source/target branch pickers over `branches.json` with the tip-commit preview
  and `Compare branches and continue`. Step 2: branch-selector line, prefilled title,
  Description, Assignee, **Reviewer**, Milestone, Labels, merge options, `Create merge request`.
- [x] `[ROUTES #83]` `/-/merge_requests/:iid/edit` — `EditMergeRequest.jsx`; the Reviewer is
  changeable here **and** from the sidebar.
- [x] `[ROUTES #79]` MR sidebar rebuilt to §15d order (Assignee, Reviewer, Labels, Milestone,
  Time tracking, Lock, Notifications, Participants, `.block.with-sub-blocks` with the
  `Source branch:` sub-block). Reviewer/assignee headers follow the `n ≠ 1 → plural` rule.
- [x] `[ROUTES #86]` `/-/merge_requests/:iid/conflicts`.
- [x] Fixed the banner spacing: `.detail-page-description` is a flex row, so the literal spaces
  in `requested to merge` / `into` were being stripped — they are real margins now. The two
  `a.gl-font-monospace` elements are still direct children, so the anchor indices hold.
- [x] `[ROUTES #6]` `/dashboard/merge_requests` — state tabs, `assignee_username`,
  `reviewer_username`.

### P1-H — Milestones
- [x] `[ROUTES #91/#93]` `/-/milestones/new` and `…/:iid/edit` — `NewMilestone.jsx`.
  Form labels are `Start Date` / `Due Date` (title-cased, as on the form) while the sidebar
  uses `Start date` / `Due date`.
- [x] `[ROUTES #92]` Milestone detail rebuilt to §16b: `.status-box` (`Past due` / `Upcoming` /
  `Open` / `Closed`), `Milestone <date range>` header line, `Edit` / `Close milestone` /
  `Delete`, the four tabs, the three-column issues pane with the verbatim column headings,
  Participants and Labels panes, and the full right sidebar (progress, `.block.start_date`,
  `.block.due_date` with the `remaining_days_in_words` suffix, Issues, Time tracking,
  Merge requests, Releases, Reference). `?milestone[state_event]=close|activate` works.
- [x] `[ROUTES #90]` Milestone list rebuilt: three-column rows, `Expired` / `Upcoming` /
  `Closed` badges, project chip, `N Issues · N Merge requests`, `N% complete`,
  `Close Milestone` / `Reopen Milestone`, `search_title` filter, the six sort options, and the
  verbatim empty state (which `/byteblaze/dotfiles` and `/primer/design` both show today).
- [x] `[ROUTES #12]` `/dashboard/milestones` reuses those rows with ` - Project Milestone`.

### P1-I — Comments
- [x] The comment form and the `#notes-list` contract were already correct; verified the
  anchored read returns exactly `lgtm` with no extra nodes inside
  `.timeline-discussion-body`.

### P2 landed inside this shard's files
- [x] `[ROUTES #87/88/89]` `/-/labels`, `/-/labels/new`, `/-/labels/:id/edit` —
  `Prioritized Labels` / `Other Labels` (title case), All/Subscribed tabs, `Filter` search,
  six sort options, 20/page pager, per-row Issues / Merge requests links with `+`-encoded
  spaces, prioritise / edit / ⋮ Delete (with the verbatim modal) / Subscribe, the empty state
  and a working `Generate a default set of labels` producing the real 8 defaults.
- [x] `[ROUTES #7/8/9/10]` `/dashboard/todos` + `…/:id`, `…/:id/restore`, `…/destroy_all` —
  `DashboardTodos.jsx`. Row markup matches §4b.6 including the `·` separator, the
  `Issue #N` / `Merge Request !N` aria-labels and the three sentence variants
  (`Roshan Jossy assigned you.` / `You assigned to yourself.` / `Could not merge.`).
  Five filter dropdowns + sort, and the verbatim `Nothing is on your to-do list. Nice work!`.
- [x] `[ROUTES #75]` `/-/boards` — Open / Closed lists with real issue cards.
- [x] `[ROUTES #74]` `/-/issues/service_desk` empty state.

---

## Known deviations (deliberate, with reasons)

1. **Tab counts are seed counts, not source counts.** `/a11yproject/…/-/issues` shows
   `Open 22 / Closed 34 / All 56` where the live site shows `40 / 570 / 610`, because
   `issues.json` is a 613-row sample of ~5 000. This is TODO.md "Known Gaps #2" — the badges
   are rendered from the seed as instructed. Same for `?search=OPT model` (1 row vs 8).
   **Not a code bug; it needs a larger seed to close.** Flagging it because several
   `program_html` evaluators read row *content*, not counts, so the impact should be limited
   to tasks that count rows.
2. **New-MR title prefill.** §15b records `Draft: Redesign` for webarena-668/806 because the
   compare yields no commits. The mock cannot compute a diff, so it prefills the source
   branch's tip-commit subject and falls back to `Draft: <Humanized branch>` only when the two
   branches share a tip SHA. For `redesign → main` it therefore prefills
   `Update Readme per Redesign` rather than `Draft: Redesign`. The title is **not** an anchor
   for any of the four MR-creation tasks (they read `.block.reviewer` and the branch chips,
   both correct), and the field is editable.
3. **Assignee/Reviewer dropdowns search the whole user directory**, with project members and
   byteblaze listed first. Restricting them to `members.json` would make webarena-658/659/660
   (`Roshan Jossy`, `Abishek S`) and webarena-666 (`Primer`) unsatisfiable — none of those
   users is a member row on the project the task targets.
4. **Date inputs are native `<input type="date">`**, not Pikaday. An agent can type
   `2030-12-31` or use the OS picker; the emitted value is the `YYYY-MM-DD` the seed stores,
   and the rendered output is the anchored `MMM D, YYYY`.
5. **Emoji render as tofu in the headless container** (`🐞`, `👍`). That is a missing font in
   the test rig, not markup — the label title string is correct in the DOM.

## Seed gaps hit (did NOT fabricate)
- None. Every record rendered here came from `src/data/*.json`.

## Files touched
Created: `src/components/issuable/Controls.jsx`, `src/pages/{NewIssue,EditIssue,NewMergeRequest,
EditMergeRequest,NewMilestone,LabelsList,NewLabel,EditLabel,Boards,ServiceDesk,DashboardTodos,
DashboardMilestones}.jsx`.
Rewritten: `src/pages/{IssuablesList,IssuesList,MergeRequestsList,IssueDetail,
MergeRequestDetail,MilestonesList,MilestoneDetail}.jsx`.
Edited: `src/pages/{DashboardIssues,DashboardMergeRequests}.jsx`, and 17 `<Route>` lines in
`src/App.jsx` (one surgical edit each, no rewrite).
