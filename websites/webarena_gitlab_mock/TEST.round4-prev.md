# webarena_gitlab_mock — Consolidated Test Report

> Round: 3 (consolidation + re-verification)
> Date: 2026-08-07
> Consolidates: `TEST.part-routes-a.md` (ROUTES.md §1–§5, rows 1–66),
> `TEST.part-routes-b.md` (§6–§13, rows 66–131),
> `TEST.part-anchors.md` (task contract, locators, replay, session pipeline).
> Re-verification: audit shard C, chromium 1920×1080 against
> `npm run dev -- --port 5223`.

Every finding below is marked **CLOSED** / **OPEN** / **DEFERRED** against the
round-2 fix reports, and CLOSED findings say whether *this* round re-drove them or
is relying on a dev shard's report.

---

## 1 · Coverage — the hard numbers

These are preserved verbatim from the three test shards, not summarised away.

### Route parity

| Measure | Result |
|---|---|
| **Anchor routes cold-loaded** (`assets/task_anchors.json`) | **145 / 145** |
| …rendering seed content | 80 |
| …404 in the mock **and** on the source (creation post-conditions) | 60 |
| **Anchor routes the source serves but the mock 404s** | **0** — the mock's 404 set is a strict *subset* of the source's (65) |
| `?sid=` preserved after cold load | **145 / 145** |
| Console errors / pageerrors on anchor loads | **0** |
| Distinct URLs cold-loaded, shard A (rows 1–66) | **118**, 0 failures, 0 console errors, sid 118/118 |
| Distinct URLs cold-loaded, shard B (rows 66–131) | **111**, 0 failures, 0 console errors, sid 111/111 |
| Anchor query URLs accepted in encoded + trailing-slash form | **13 / 13** |
| Trailing-slash / URL-encoded param forms, shard A | **4 / 4** |
| Interactive flows exercised, shard A | **34** |
| Rows driven interactively (not just loaded), shard B | **27** |

### Round-3 re-verification sweeps

| Sweep | Result |
|---|---|
| **`assets/route_smoke.py`** — 201 routes (145 anchor + 56 clicked-to shells), fresh `?sid=` each, fails on any console error / pageerror / empty body | **201 / 201 clean**, 0 console errors, 0 pageerrors |
| …plus the 7 case-insensitive canonical redirects | **7 / 7**, `?sid=` preserved on each |
| **ROUTES.md row sweep** — one concrete probe URL per numbered row, fresh browser context each | **132 / 132 loaded**; 103 real views, 20 `<Placeholder>`, 3 unrouted, 6 not-migrated; **0 sid losses, 0 console errors, 0 false completions** |
| **Creation-flow sweep** — two records through every id-allocating flow in one session | **16 / 16 flows passed**; 0 null ids, 0 duplicates, 0 seed collisions, exactly 1 persisted write per mutation |

### Task contract

| Measure | Result |
|---|---|
| **Anchor (string, page) pairs tested** | **243** (the 252 anchor strings split into 141 page-bound → 243 pairs, and 111 `(answer)`/`last`) |
| …present verbatim in the mock today | 5 |
| …absent in the mock **and** absent on the source at the same path | **238** — every miss was re-tested on the live source |
| **…absent in the mock but present on the source** | **0 — zero mock-side string gaps** |
| `(answer)`/`last` strings spot-checked on their source page | ~30 across 13 pages, **0 gaps** |
| **Anchor locators verified working** | **23 / 25** (the 2 excluded are `.submission__inner`, Reddit selectors for webarena-681–688 — not this site) |
| **WebArena tasks replayed end to end, shard C** | **20 attempted / 20 completable in the UI / 19 whose evaluator passed** at the time; the 1 exception (webarena-481) was BUG-001, now closed |
| **WebArena tasks replayed end to end, shard B** | **35 replayed / 34 pass / 1 fail** (webarena-396, BUG-B01, now closed) |
| `/-/raw/` bare-text parity with the source | **4 / 4 byte-identical** (2214, 9640, 483, 6057 chars), single `<pre>`, zero app chrome |

### Visual

| Measure | Result |
|---|---|
| Screenshot files in `assets/screenshots/diff/` | **52 files = 26 matched `source_`/`mock_` pairs** |
| Shard A pairs | 12 (`/`, `/dashboard/todos`, `/explore/projects/trending`, `/search?…`, `/byteblaze`, `/-/profile`, `/byteblaze/dotfiles`, `…/-/tree/main`, `…/-/blob/main/.bash_profile`, `…/-/commits/main`, `…/-/branches`, `/dehenne/awesome-visibility/-/graphs/master`) |
| Shard B pairs | 14 (`issues_list`, `issue_detail`, `mr_list`, `mr_detail`, `labels`, `milestones`, `project_members`, `projects_new`, `groups_new`, `group_members`, `issues_new`, `milestones_new`, `labels_new`, `proj_settings`) |
| Pages whose structural copy matched the source 100% | `/projects/new`, `/groups/new`, `/-/labels/new`; `/-/labels` and the `/-/milestones` empty state character-identical |

---

## 2 · P0 findings — all four CLOSED, all re-verified this round

### BUG-001 · Members `<td>`s missing `data-label` → `func:gitlab_get_project_memeber_role` returned nothing — **CLOSED ✔**

Blocked webarena-481/482/483/484/485/576/577/578/579 (9 tasks, 12 locator
assertions) regardless of how correctly the invite flow worked.

**Re-verified by running the evaluator's own two-step DOM lookup** on
`/byteblaze/dotfiles/-/project_members`:

```
td[data-label='Account'] span.gl-avatar-labeled-sublabel  ->  ['@byteblaze']
index                                                     ->  0
td.col-max-role span[0]                                   ->  'Owner'
```

`MembersTable.jsx` now emits the source's full attribute set per cell
(`aria-colindex`, `data-label`, `role`, the `col-*` classes) copied verbatim out of
`assets/html/proj-dotfiles-members.html`. Group and project members share the
component, so both are fixed. The fixing shard also verified it **differentially**
against the live source on three paths — `dotfiles` (1 row, Owner),
`a11y-webring.club` (1 row, Owner), `a11yproject.com` (3 rows, Maintainer) —
identical on both sides including row count.

### BUG-004 · `/post` decoded the request body chunk-by-chunk, corrupting multi-byte UTF-8 — **CLOSED ✔**

Observed at 8 of 362 `.mock-states/<sid>.json` files (2.2%), with two sessions
corrupting at the *same* character offset 717945 — the signature of a chunk-boundary
split, not random damage. Silent, and the anchor set is full of multi-byte strings.

**Re-proved independently, not accepted on report.** POSTed a ~2 MB state whose
marker interleaves 🐞, `Erik Linder-Norén`, `윤보미`, `1993–2003` (EN DASH), `…`,
`Mewen Le Hô`, 🤖 and ♿️ at a shifting stride so every codepoint lands on every
possible residue of a chunk boundary, then read it back off `/go`:

```
plain request path : roundtrip identical = True   U+FFFD count = 0
gzip  request path : roundtrip identical = True   U+FFFD count = 0
```

Both paths matter — the browser now gzips `/post` bodies, so the plain path alone
would not have proved it.

*Related:* `TEST.part-anchors.md` logged one unreproducible coarse `/go` diff
(whole top-level collections instead of `['currentUser.status','users']`) in the
same run as a BUG-004 corruption, and noted that a corrupted current state would
explain it exactly. It has not recurred in any subsequent session, including this
round's 16-mutation sweep, whose diff was precise. Treat as explained by BUG-004.

### BUG-A01 · Project-list sort dropdown dropped `?sid=` — **CLOSED ✔**

`/` is the anchor route for 168 tasks. The menu emitted query-only hrefs
(`href="?sort=name_asc"`), which the global `<a href>` interceptor skips, so the
browser did a real navigation that replaced the whole query string.

Fixed by matching the source, which emits rooted hrefs. **Re-verified:**

```
menu hrefs: ['/dashboard/projects?sort=latest_activity_desc',
             '/dashboard/projects?sort=created_desc',
             '/dashboard/projects?sort=name_asc', …]
click 'Name, descending' -> /dashboard/projects?sort=name_desc&sid=vf3…
```

The fixing shard swept the class and found three more (`DashboardProjects`
pagination, `ExploreProjects` Next, a dead `LabelPill` export it deleted rather
than repaired). `grep -rE 'href=\{?["\`]\?' src/` now returns nothing.

### BUG-B01 · Project paths not resolved case-insensitively — **CLOSED ✔**

webarena-396 could never pass: `convexegg/chatgpt`'s real path is lowercase, so any
correct fork lands at `/byteblaze/chatgpt`, and only GitLab's case-insensitive 301
makes the annotated `/byteblaze/ChatGPT` resolve.

`src/utils/canonicalPath.js` + a rendered `<RedirectWithQuery>` in `App.jsx`, done
once ahead of `<Routes>` so it covers `/:ns/:proj`, every `/-/…` sub-route,
`/groups/:group/…` and `/users/:username/…`. Lookup maps are lowercase-keyed and
real-casing-valued — nothing in `src/data` was lowercased.

**Re-verified, 7/7, `?sid=` intact on each:**

```
/byteblaze/DOTFILES          -> /byteblaze/dotfiles
/ROOT/metaseq                -> /root/metaseq
/root/METASEQ                -> /root/metaseq
/convexegg/ChatGPT           -> /convexegg/chatgpt
/BYTEBLAZE/dotfiles/-/issues -> /byteblaze/dotfiles/-/issues
/ByteBlaze                   -> /byteblaze
/users/ByteBlaze             -> /users/byteblaze
```

Correctly scoped: only namespace and project segments are rewritten. Refs, blob
paths and iids pass through byte-for-byte — git is case-sensitive.

---

## 3 · P1 findings

### CLOSED and re-verified this round

| ID | Finding | Evidence |
|---|---|---|
| BUG-002 | Invite modal defaulted to **Developer**; source defaults to **Guest** | `select[data-qa-selector=access_level_dropdown]` → `{value:'10', text:'Guest'}`. Five of the nine member tasks say "invite him as a guest" and rely on the default. |
| BUG-003 / DIFF-A08 | SSH clone rendered the literal `__GITLAB_SSH__` | `#ssh_project_clone` → `ssh://git@localhost:2222/byteblaze/dotfiles.git`. WebArena substitutes `__GITLAB_SSH__` into the *reference* answer, so the literal could never match. Unblocks webarena-293…297. Only the SSH **port** (2222) stays constant — it is the git daemon's, not the web server's. |
| BUG-B03 / BUG-007 | Invited members written with `id: null`, duplicate React keys | Two invitees in one submit → ids `[210, 211]`, one persisted write, no duplicate-key warning. A third invite in the same session → `212`. See `AUDIT.md §0`. |
| BUG-A02 | Tree `Last commit` / `Last update` columns blank on every project | **Landed during this audit.** `src/data/tree_last_commits.json` (369 KB) appeared at 17:36; verified at 17:45 on `/byteblaze/dotfiles/-/tree/main`: `.mackup → Remove atom config settings → 6 years ago`, `.ssh → Update config → 9 years ago`, `.zsh → Update .functions → 3 years ago` — the source's exact values. The previous round correctly **refused to fabricate this** (no commit carried a path list); the seed now carries it. |
| BUG-A04 | `/explore/projects/trending` rendered a fabricated most-starred list | 0 project cards; body carries the source's `Explore public groups to find projects to contribute to.` GitLab CE drives this from `trending_projects`, empty on this instance. |
| BUG-A05 | `Yours` badge showed the filtered count | `Yours 14` on both `/dashboard/projects` and `/dashboard/projects/starred`. |
| BUG-B02 (URL half) | Sort-direction toggle emitted the invalid `created_date_asc` | `?sort=created_date` + toggle → `?sort=created_asc` — a real GitLab token and webarena-342's anchor value. Replaced the suffix arithmetic with the explicit reverse-pair table from `assets/README.md §5a.6`, because GitLab's pairs are not suffix swaps (`closed_at` ↔ `closed_at_desc`, `milestone` ↔ `milestone_due_desc`). |

### CLOSED on the fixing shard's report (driven by them, not re-driven here)

| ID | Finding | What landed |
|---|---|---|
| BUG-A03 / BUG-005 | Fork form submitted as a silent no-op with no namespace | Per-field BootstrapVue `invalid-feedback`, copy verbatim from `assets/html/proj-forks-new.html`: `Please select a namespace`, `Please select a visibility level`. |
| BUG-A06 | Cards dropped the role badge and 2 of 4 counters | All four counters in source order (stars · forks · MRs · issues), plus a `user-access-role` badge derived from `members.json` and rendered only where the user is a member — 4 of 20 explore rows, matching the source. |
| BUG-A07 | Tab strip missing `Topics`; explore lost the strip entirely | New shared `src/components/ui/ProjectsNav.jsx` with all 15 source menu items in source order; `?personal=true`, `?archived=`, `?visibility_level=` all gained real controls. Tail is open — see BUG-A12. |
| BUG-A08 | `/dashboard/activity` showed the **groups** empty state | Replaced with the source's bare `No activities found`; `?filter=starred` now selects its tab (the previous "identical bodies" reading was innerText-only — the difference is a class). byteblaze has zero `events` rows on the source, so no feed was fabricated. |
| BUG-A09 | `/search` was one column where the source is two | Scoped `<style>` in `Search.jsx` (not shared `global.css`, which other shards were editing). Measured after: `.results` is flex, 240px rail at x=336, results at x=592, both selects 240px inline, `list-style:none`, active pill `rgb(220,220,222)`. |
| BUG-A10 | Feed token on the wrong settings page; reveal was a no-op | Section moved to `/-/profile/personal_access_tokens`, where GitLab 15.7 actually serves it. Reveal flips `********************` → `TMN_bBn9Z48qVbUFZV45` (read off `users.json`, never invented). The `Social sign-in` section the source has nowhere was deleted. ⚠️ **This contradicts `SOURCE.md §7`**, which says the token renders on `/-/profile/account` — `SOURCE.md` is wrong and should be corrected. |
| BUG-B04 | Fork form did not re-derive the slug | Uses a lodash-compatible `kebabCase`, **not** the new-project helper: the two forms genuinely differ on the live site (`ChatGPT` → `chat-gpt` on fork, `AGISite` → `AGISite` on new project). |
| DIFF-003 / DIFF-A01 | Default project sort was `Updated date`; source shows `Name` | `DEFAULT_PROJECT_SORT = 'name_asc'`, derived from two captures that **predate** the round's own `?sort=` loads. |

### OPEN at P1

| ID | Finding | Where |
|---|---|---|
| **BUG-B02 (data half)** | `sortIssuables` has no case for `milestone`, `milestone_due_desc`, `closed_at`, `closed_at_desc`, `priority`, `priority_desc`, `label_priority`, `relative_position` — all fall through to created-desc | `src/pages/hooks.js:99-107`. The toggle now emits correct tokens, so picking `Milestone due date` changes the URL and leaves the list unchanged: a **silent no-op on the busiest list in the app**. |
| **BUG-B05** | `http://localhost:8023/` hard-coded as the URL prefix in six forms | `NewProject.jsx:252,257,258,355`, `NewGroup.jsx:221`, `GroupSettings.jsx:148`, `ProjectSettingsGeneral.jsx:485`. **Disputed:** `AUDIT.part-parity.md` checked the captured DOMs and says the source really renders `localhost:8023` there (GitLab uses `root_url` on these forms) and they should be left alone; `TEST.part-routes-b.md` and `assets/README.md §24.5` say host-dependent values must come from the serving origin. `src/utils/instance.js` shipped `instanceUrlPrefix()` and none of the six adopted it. No anchor reads these strings. **Needs a decision, not more analysis.** |

---

## 4 · P2 findings

### CLOSED

| ID | Finding | Evidence |
|---|---|---|
| BUG-B06 | Raw HTML leaked as literal text in comment bodies | **Re-verified ✔.** `/a11yproject/a11yproject.com/-/issues/719`: 2 images rendered, 1 heading, 8 code spans, 2 links; `document.body.innerText` contains no literal `<img `. External `src` parked on `data-canonical-src` behind a local data-URI placeholder, so zero network calls. |
| BUG-B07 | MR list rows showed `<source> into <target>` chips the source omits | Removed. Row now reads `Octovisuals Page \| !450 · created 3 years ago by Josh Bowden \| 2 \| updated 3 years ago`. |
| BUG-B10 | Group members page showed owner-only affordances to a non-owner | **Measured, not guessed** — three viewer roles on the source: Owner (h4 + intro + 3 buttons, `aria-colcount=8`), Developer (h4 only), non-member (empty header, `aria-colcount=7`). Implemented as `canManageMembers()`. The Owner case re-verified here. |
| BUG-A11 | `/-/profile/account` copy drift (4 items) | All four against `assets/html/profile-account2.html`. The `12 personal projects will be removed` count is **derived**, so it stays true after a create or fork. |
| BUG-A13 | Stray `×` glyph in `innerText` on 5 pages | Swapped for the `close` icon. |
| DIFF-A02 | `/byteblaze` Personal projects panel | Compact cards drop the namespace prefix and render the role badge; the spurious `View all` under Activity is hidden with `display:none` alongside GitLab's own `.hide` class, keeping the DOM shape. |
| DIFF-A06 | Card link colour and row density | Namespace greyed, name bold near-black, 600px description wrap, filter input and sort toggle inline. |
| DIFF-A09 (partly) | Repo pages dropped source affordances | `Add to tree` now works. Still absent: `Select Archive Format`, the `Unverified` commit badge, per-branch ahead/behind counts, the `Merge request`/`Compare` links on `/-/branches`. |

### OPEN

| ID | Finding | Where |
|---|---|---|
| BUG-006 | Newly created group shows the "no permissions" empty state to its own Owner | `src/pages/GroupOverview.jsx:47,51`. Post-condition page of 5 group-creation tasks. Two rounds of `NEEDS FILE`; the source's two real empty states were pulled out of the container and are quoted in `DEV.r2-members.md`, and `MembersTable.jsx` already exports the predicate. |
| BUG-B08 (part 1) | Issue/MR system notes drop the actor; label/milestone/closed events missing | `src/pages/NotesTimeline.jsx`. `src/data/resource_events.json` (168 KB) landed this round and is **not yet referenced by `dataManager.js`**. |
| BUG-B09 | `/:ns/:proj/edit` is 25 structural copy lines vs the source's 130 | Not a false completion — the page is real and its controls persist — but ROUTES.md row 98 now says so. No task routes through project settings. |
| BUG-B11 | Markdown toolbar renders `B I S ❝ </> 🔗 • 1. ☑ ▾ ▦ 📎 ⤢` as text | `src/components/issuable/Controls.jsx:388`. Lands in `innerText` and any `string_match` over the page body; GitLab's are icon-only SVGs. |
| BUG-A12 | `/explore/projects/topics` invented empty state + its own tab strip | `src/pages/ExploreTopics.jsx`. |
| DIFF-001 | `/groups/<g>/-/group_members` renders a shell for groups that do not exist | Invented copy `This group does not exist yet` where the source 404s. Deliberate (lets a task-created group render before state settles) but the copy is invented. |
| DIFF-004 | `/-/blob/:ref/<missing path>` does not redirect to `/-/tree/:ref` | Only affects the pre-creation view of file-create tasks. |
| DIFF-A04 | `/-/forks` empty state is the *profile* empty state | `This user doesn't have any personal projects` under the fork counts. |
| DIFF-A07 | `/dashboard/todos` actor name wraps to its own line | Everything else on the page matches exactly. |
| DIFF-A10 | Unseeded blob shows `This file is not displayed because it is too large or is binary.` for a 3 KB shell script | The *behaviour* is expected (`repo_files.json` is partial by design and `SOURCE.md` asks for a graceful placeholder); the **copy asserts a false reason an agent could repeat as an answer**. |
| — | Sampling artifact worth one cheap round | `/keycloak/keycloak/-/issues/?label_name[]=flaky-test`, `/kkroening/ffmpeg-python/-/issues/?label_name[]=question` and `/OpenAPITools/openapi-generator/-/issues/?label_name[]=OpenAPI Generator CLI` render **0 rows** where the source has 16 / 9 / 4 — the 44-issue per-project sample happens to contain no issue carrying the anchored label. All five evaluators (webarena-103/104/105/106, -343) are **`url_match` only**, so nothing fails. Bias the next per-project sample to include ≥1 issue per anchored label. |

### DEFERRED

| ID | Finding | Why |
|---|---|---|
| DIFF-002 | `.user-profile` `outerText` whitespace differs | Same tokens, same order; the delta is the source's Haml inter-element whitespace. Every anchor on this locator is an `@username` substring and matches either way. Matching it byte-for-byte means hand-placing whitespace text nodes — fragile churn for no evaluator gain. |
| BUG-B08 (part 2) | Designs dropzone missing | Has no backing state. Adding the markup unwired would create exactly the dead affordance `SANDBOX_COMPLETENESS_GUIDE.md` forbids; wiring it means a new `designs` entity. Correctly left out and flagged. |
| — | `/-/raw/` responds `Content-Type: text/html`, not `text/plain` | A client-rendered SPA cannot set it. The rendered text is byte-identical to the source on all 4 tested paths, and the browser wraps it in a single `<pre>` exactly as the source does. |

---

## 5 · Task replay — what actually completed

### Shard C: 20 flows, driven through the UI, each ending in a reload

Never by typing a post-condition URL. **20 completable in the UI, 19 whose
evaluator passed at the time** — the 1 exception was webarena-481, blocked by
BUG-001, now closed.

| # | Task | Proves | Verdict |
|---|---|---|---|
| R1 | webarena-742 | create blank project + invite 2 members; `.visibility-icon` title | ✅ |
| R2 | webarena-748 | create from Android template; `Initialized from 'Android' project template` | ✅ |
| R3 | webarena-799 | create group `n-lab` + invite 4; `/groups/n-lab/-/group_members` resolves | ✅ |
| R4 | webarena-481 | invite as Guest | ⚠️ flow PASS, evaluator FAIL (BUG-001) → **now ✅** |
| R5 | webarena-394 | fork → `/byteblaze/2019-nCov`, `Forked from yjlou / 2019-nCov` | ✅ |
| R6 | webarena-593 | milestone create; **proves locators L0, L2, L4** (`#content-body`, `.block.due_date`, `.block.start_date`) | ✅ |
| R7 | webarena-418 | profile status; **proves L5** (`.cover-status`.lastChild = `Cruising`) | ✅ |
| R8 | webarena-448 | website URL; **proves L8** (`.profile-header [itemprop=url]` = `egg.tart.com`, scheme stripped as the source does) | ✅ |
| R9 | webarena-390 | MR comment; **proves L16** (`#notes-list`.lastElementChild `.timeline-discussion-body` = `lgtm` exactly) | ✅ |
| R10 | webarena-808 | issue + assignee + due date; **proves L1, L14, L15** | ✅ |
| R11 | webarena-806 | MR + reviewer; **proves L3, L17, L18** (branch chips `[0]`=source `[1]`=target) | ✅ |
| R12 | webarena-441 | edit a blob → `/-/raw/` serves it with no chrome, escaped form matches the source | ✅ |
| R13 | webarena-552 | new file at a nested path `real_space/urls.txt` — creates the directory, as GitLab does | ✅ |
| R14 | webarena-523 | star → `/users/byteblaze/starred` | ✅ |
| R15 | webarena-533 | follow ×2; **proves L11** with real content | ✅ |
| R16 | webarena-566 | slug case preservation: `Do it myself` → `Do-it-myself` | ✅ |
| R17 | webarena-411 | edit `LICENSE.txt` on a **non-`main`** default branch (`master`) | ✅ |
| R18 | webarena-44 | navbar Todos counter → `url_match` | ✅ |
| R19 | webarena-259 | feed-token reveal | ✅ |
| R20 | webarena-317, -136 | contributor graphs byte-identical to the source; `Steve Woodson` and `Steven Woodson` render as **two** cards, which is what makes -136's answer of `5` reachable | ✅ |

### Shard B: 35 tasks against their real evaluators — 34 pass, 1 fail

Members (481, 576, 578, 570) · Issues (808, 809, 658, 660, 659) · MRs (666, 667,
668, 806) · Groups (799, 800, 802, 803) · Projects (742, 743, 744, 747, 748, 749,
750, 751) · MR comments (389, 390, 391, 392, 393, 416, 417) · Milestone (593) ·
Forks (394, 395, 396, 397, 398).

The single failure was **webarena-396** (BUG-B01) — **now closed and re-verified.**

**webarena-659 is an upstream annotation error, not a mock defect.** It requires
`.block.assignee ⊃ "Roshan Jossey"`; the source's own DB has
`Roshanjossey | Roshan Jossy`, and webarena-658 asks for the same user and spells it
`Roshan Jossy`. It fails on the live GitLab too. **Do not "fix" the seed.** Add it
to `SOURCE.md § Three anchors that appear to be wrong in webarena.jsonl` as a
fourth.

---

## 6 · Session pipeline and `/go`

| Check | Result |
|---|---|
| Two sids mutated independently | ✅ each reads back its own value |
| Cross-contamination | ✅ none, including across a `reset` |
| Three sids mutated **concurrently** | ✅ all three correct, all three diffs precise |
| Fresh sid sees the pristine seed | ✅ |
| `/go` shape | ✅ `{initial_state, current_state, state_diff}` on every sid |
| `state_diff` on a pure-navigation session | ✅ `{}` — browsing does not dirty state; re-confirmed round 3 (7 read-only route loads → **0** POSTs) |
| `state_diff` reports creations **as creations** | ✅ re-confirmed: the 16-creation sweep produced `projects/groups/issues/mergeRequests/notes/labels/milestones/members` `added` + the matching `nextIds.*` bumps + the new repo overlays, and **nothing** reported as an edit to a seeded record |
| `state_diff` on an edit reports old→new | ✅ |
| `reset` | ✅ `{"success":true,…}`; diff returns to `{}`; `current_state` byte-identical to `initial_state` |
| Custom-state injection | ✅ lands in **both** halves, so the diff baseline is the injected state; survives a reload |
| One logical mutation = one persisted write | ✅ **measured across 16 mutations of 8 kinds: exactly 1 POST each** |
| Preview-server parity | ✅ driven against the committed `dist/`; no preview-only regression; sid traversal `?sid=../../pwn` contained |

---

## 7 · What was NOT covered — read this as the gap list

**Not tested at all**

- **Task replay is 20 of 204 (shard C) + 35 (shard B) = 55 distinct tasks.** The
  rest were not replayed. The 20 were chosen to span all three evaluator families
  and every mutation family; the 35 covered rows 66–131.
- **Not replayed by anyone:** label assignment to an issue, issue close/reopen as a
  task, MR merge/close as a task, project-settings edits, search across scopes as a
  task, and the **Web IDE commit path** (webarena-566 names the Web IDE explicitly;
  it was completed through the simple editor instead — a separate audit did drive a
  Web IDE create+commit successfully, but not as a scored replay).
- **`/-/merge_requests/:iid/diffs` content** — `SOURCE.md` records that MR diffs
  were never extracted, so there is no seed behind it. The tab renders; its
  contents are not comparable.
- **Drag-and-drop on `/-/boards`** — the board renders with real cards; dragging was
  never exercised.
- **`/-/labels?subscribed=true`** — loads; **not verified that it actually filters**.
- **`/groups/:group/edit` and `/-/snippets/new` forms were never submitted.**
- **`/projects/new#import_project`** — tiles render; no import driven.
- **`/-/network/:ref` and `/-/graphs/:ref/charts`** — cold-loaded and headline
  numbers read; **chart values not compared to the source**.
- **Pagination on `/explore/projects`** beyond `?page=2` — the mock's list and the
  source's differ in length by design.
- **`?personal=true`** — accepted, but **untestable on this seed**: all 14 of
  byteblaze's projects are personal, so it has no observable effect.

**Tested shallowly**

- **Rows 99–118 (31 routes)** were cold-loaded only. They are `<Placeholder>`
  shells; nothing was driven, and nothing should be read as working.
- **Visible strings** — ~30 spot-checks in shard 1, plus the full 243-pair anchor
  sweep. Sections never string-checked: `/dashboard/activity` body, todos row copy,
  boards, snippets, notifications, preferences, web IDE, compare, network graph,
  help.
- **Screenshot comparison is 26 pairs**, not full coverage; the rest was text-diffed.

**Structurally not verifiable here**

- **The WebArena evaluation harness is not installed on this host.** The
  `func:gitlab_get_project_memeber_role` helper body was reconstructed from
  `evaluation_harness/helper_functions.py`. The differential result does not depend
  on the reconstruction being exact — the checkable fact is that the mock's DOM now
  answers the same query the source's does, with the same value.
- **Anchor locators L9/L10 (`.submission__inner`)** are Reddit selectors for
  webarena-681–688. Not testable on this site; counted as neither pass nor fail.
- **The source was never mutated.** Every interaction with `localhost:8023` was a
  GET or a modal open. Two consequences: the mock's flash-message copy and
  post-create redirect targets were never confirmed against the source, and the
  source's validation copy for the fork form could not be read.

**Environment hazard that affects every source-order comparison**

GitLab persists `issues_sort` / `projects_sort` onto the **user record** whenever a
URL carrying `sort=` is loaded (`IssuableCollections#set_sort_order`). Shard B
measured byteblaze's `issues_sort` changing from `created_date` to `updated_desc`
and `projects_sort` from `stars_desc` to `name_asc` **within one round**, because a
concurrent shard loaded `?sort=` URLs on port 8023. Any comparison of the source's
*unparameterised* list ordering from that round is unreliable. `SOURCE.md §6b`
documents the behaviour; the round did not guard against it. **Do not load `?sort=`
URLs on 8023.**

**Cross-shard hazard observed during this consolidation**

Two shards were editing `src/` while this report was written. For roughly 60
seconds the app served a blank body and threw `isOffsite is not defined` from a
half-written `src/utils/markdown.js` under Vite HMR. It cleared on its own and does
not reproduce. This is the same class as the round's earlier
`ReferenceError: QueryForm is not defined` white-screen — and worth repeating:
**`npm run build` cannot catch it.** Rollup does not resolve JSX identifiers, so an
unimported component builds clean and fails at runtime. `assets/route_smoke.py`
catches it in ~2 seconds and should gate every round.

---

## 8 · Verdict

**Zero open P0. Two open P1.**

Every P0 raised by the three test shards — BUG-001, BUG-004, BUG-A01, BUG-B01 — is
closed, and each was **re-driven in a browser by this consolidation** rather than
accepted on report. The 9 member tasks and webarena-396 that were provably
unpassable are now passable.

Open at P1: `sortIssuables`'s 8 missing sort cases (BUG-B02's data half — a control
that now emits a correct URL the list ignores), and the disputed `localhost:8023`
prefix on six forms (BUG-B05), which needs a decision rather than more analysis.

The remaining 15 open P2s are copy, cosmetics, and depth. None blocks a task, and
each names its file.
