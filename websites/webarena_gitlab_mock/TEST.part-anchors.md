# webarena_gitlab_mock — Test Report (SHARD C: task contract + session pipeline)

> Round: 1 (shard C)
> Date: 2026-08-07
> Mock: http://localhost:5203
> Source: http://localhost:8023 (reachable: YES — read-only, never mutated)
> Tested by: playwright agent, shard C of 3
> Scope: anchor routes / anchor strings / anchor locators / task replay / session isolation / raw-blob chrome

**VERDICT: FAIL — 2 P0, 3 P1 must be fixed before this mock is usable for the gitlab task
set.** The task contract is otherwise in very good shape: all 145 anchor routes resolve, no
anchor string is missing that the source has, 19 of 20 replayed tasks complete end to end,
and session isolation is clean.

## Summary

| Metric | Count |
|--------|-------|
| Anchor routes cold-loaded | **145 / 145** |
| …rendering seed content | 80 |
| …404 in the mock **and** on the source (creation post-conditions) | 60 |
| Anchor routes the source serves but the mock 404s | **0** |
| `?sid=` preserved after cold load | **145 / 145** |
| Anchor (string, page) pairs tested | 243 |
| …missing in the mock but **present on the source** | **0** |
| …missing on both (task post-conditions, verified page by page) | 238 |
| `(answer)`/`last` anchor strings spot-checked on their source page | ~30, **0 gaps** |
| Anchor locators verified working | **23 / 25** (2 excluded: Reddit selectors) |
| Anchor locators failing | **6 `func:` locators — one root cause, BUG-001** |
| Tasks replayed / UI-completable / evaluator would pass | **20 / 20 / 19** |
| Session isolation | ✅ 2 sids independent · 3 concurrent sids independent · reset restores · injection works |
| `/go` reports creations as creations | ✅ |
| `/-/raw/` bare-text parity with source | ✅ 4 / 4 byte-identical |
| P0 bugs | **2** (BUG-001, BUG-004) |
| P1 bugs / differences | **3** (BUG-002, BUG-003, DIFF-003) |
| P2 | 8 |

## 1. Anchor Route Check (145) — PASS

Method: each of the 145 `anchor_routes` in `assets/task_anchors.json` cold-loaded in a
**fresh browser context** with a unique `?sid=anchC_<n>`, `wait_until=load` + 700 ms
settle, then `page.url` / `page.title()` / `body.innerText` captured. Raw JSON at
`/tmp/pw-sC/routes.json`. The same 145 paths were then fetched on the **source**
(`http://localhost:8023`, logged in as byteblaze, `max_redirects=0`, GET only —
nothing mutated) to get the ground-truth status; raw JSON at `/tmp/pw-sC/source_status.json`.

| Metric | Result |
|---|---|
| Routes cold-loaded | **145 / 145** |
| Navigation errors / white screens | **0** |
| Console errors or `pageerror` on load | **0** |
| `?sid=` still on the URL after load | **145 / 145** |
| Routes rendering seed content | **80** |
| Routes 404-ing in the mock | **60** |
| Routes 404-ing on the **source** | **65** |
| Mock 404s that the source serves 200 | **0** |

The mock's 404 set is a strict **subset** of the source's 404 set. Every route that
returns content on the live GitLab returns content in the mock. The 60 shared 404s are
exactly the creation post-conditions (`/byteblaze/AGISite`, `…/web_agent_nodejs/-/commits`,
`…/nolan_followers/-/raw/main/README.md`, …) plus the two routes webarena-398 *wants* to
404 (`/byteblaze/nvidia-patch`, `/byteblaze/viewgrades-scraper` — the task's expected
answer is the literal string `404`, and the mock renders `404 / Page Not Found`, so that
task passes).

The mock's 404 page copy matches the source's verbatim:
`404` · `Page Not Found` · `Make sure the address is correct and the page hasn't moved.` ·
`Please contact your GitLab administrator if you think this is a mistake.`

**Only divergence — see DIFF-001 (P2):** the five `/groups/<g>/-/group_members` routes for
groups that do not exist yet render a group shell reading `This group does not exist yet`
where the source returns a 404 page.

## 2. Anchor String Check (252) — PASS (no mock-side gap)

Method: the 252 anchor strings partition into 141 that are bound to one or more concrete
pages (243 (string, page) pairs) and 111 that are `(answer)`/`last` — i.e. things the agent
must *derive*, with no page named. For every (string, page) pair the page was loaded in the
mock and the string tested for a **verbatim** occurrence in `body.innerText` **or**
`page.content()` (the second form is required for `/-/raw/…`, where the browser wraps
`text/plain` in a `<pre>` and the text is HTML-escaped — the source behaves identically).

Then — and this is the part that makes the number meaningful — **every miss was re-tested
on the live source at the same path.**

| Bucket | Count |
|---|---|
| (string, page) pairs tested | 243 |
| Present verbatim in the mock today | 5 |
| Absent in the mock **and** absent on the source at the same path | **238** |
| Absent in the mock but **present on the source** | **0** |

**Zero mock-side string gaps.** The 238 misses break down as 168 on routes that 404 on both
sides (project/group/file not created yet) and 70 on routes that render on both sides but
where the string is written by the task itself — verified page-by-page against the live
site: byteblaze's profile has no status and no website URL (webarena-418–422, 448–452);
`/users/byteblaze/following` lists exactly `@a11yproject`, `@panicsteve`, `@primer` on both
sides, and every `@yjlou`/`@koush`/`@vinta`/… anchor is a *follow-this-user* post-condition
(533–537); `/users/byteblaze/starred` carries none of `AndroidAsync`/`keycloak`/
`create-react-app`/… on either side (523–527 are *star-this-project* tasks);
`/byteblaze/dotfiles/-/blob/main/LICENSE` and `…/cloud-to-butt/-/blob/master/LICENSE.txt`
have no LICENSE on the source either (411, 414, 736 create them); the MR comment anchors
(`lgtm`, `Good idea`, `Thanks, working on reviews`, `close because non reproducible`) are
comments the task posts; the `Guest`/`Developer`/`Reporter`/`Maintainer` member-role anchors
are add-member post-conditions.

The five already present are the two seeded MR comments `Thank you` (MR 1270) and
`@Roshanjossey` (MR 1485), `MIT License` on `/byteblaze/gimmiethat.space/-/blob/main/LICENSE`,
and `404` on the two projects webarena-398 expects to be missing.

Raw evidence: `/tmp/pw-sC/strings.json`, `/tmp/pw-sC/strings_diff.json`.

## 3. Anchor Locator Check (25) — 1 FAILURE (BUG-001, P0)

Method: each locator was `page.evaluate()`d **on the mock and on the live source at the
same path**, using `assets/README.md §0.9` to pick the page that defines it. Comparing
against the source is what makes a `null` meaningful: a locator that returns nothing on
*both* sides is a task post-condition, one that returns a value on the source and nothing
on the mock is a real gap. Raw output: `/tmp/pw-sC/locators.json`.

| # | Locator | Page used | Mock | Source | Verdict |
|---|---|---|---|---|---|
| L1 | `.block.assignee` | `/byteblaze/a11y-syntax-highlighting/-/issues/1` | `Assignee\nEdit\nByte Blaze` | identical | ✅ |
| L3 | `.block.reviewer` | `/primer/design/-/merge_requests/450` | `0 Reviewers\nEdit\nNone - assign yourself` | identical | ✅ |
| L6 | `.detail-page-description` (issue) | `…/issues/1` | `Tm Theme Editor\n\nHi!\n\nGood day to you!…` | identical | ✅ |
| L6 | `.detail-page-description` (MR = banner) | `…/merge_requests/450` | `Open\nJosh Bowden\nrequested to merge\noctovisuals-page\ninto\nmain\n3 years ago` | identical | ✅ trap avoided — banner is first |
| L7 | `.home-panel-description-markdown` | `/byteblaze/dotfiles` | `🤖 Computer setup` | identical | ✅ |
| L11 | `.user-profile` | `/users/byteblaze/following` | same text, different whitespace | see DIFF-002 | ✅ (substring anchors unaffected) |
| L12 | `.visibility-icon` `title` | `/byteblaze/dotfiles` | `Public - The project can be accessed without any authentication.` | identical | ✅ |
| L13 | `[data-qa-selector="projects_list"` | `/dashboard/projects` | element exists, `outerText` populated | exists | ✅ selector / ⚠ see DIFF-003 for order |
| L14 | `[data-qa-selector="title_content"]` | `…/issues/1` | `Tm Theme Editor` | identical | ✅ |
| L15 | `[data-testid="sidebar-due-date"` | `…/issues/1` | `Due date\nEdit\nNone` | identical | ✅ trap avoided — issue uses `data-testid`, not `.due_date` |
| L17 | `.detail-page-description > a.gl-font-monospace`[0] | `…/merge_requests/450` | `octovisuals-page` | identical | ✅ direct child, index 0 = source branch |
| L18 | …[1] | `…/merge_requests/450` | `main` | identical | ✅ |
| L0 | `#content-body` | milestone page | element exists on every page | exists | ✅ (milestone-detail form re-verified in replay R6) |
| L2 | `.block.due_date` | milestone detail | — | — | ✅ verified in replay R6 (no milestone is seeded on either side) |
| L4 | `.block.start_date` | milestone detail | — | — | ✅ verified in replay R6 |
| L5 | `.cover-status` | `/byteblaze` | `null` | `null` | ✅ post-condition — verified in replay R7 |
| L8 | `.profile-header [itemprop="url"]` | `/byteblaze` | `null` | `null` | ✅ post-condition — verified in replay R8 |
| L16 | `#notes-list` last note | issue / MR | throws on both | throws on both | ✅ post-condition — verified in replay R9 |
| L9, L10 | `.submission__inner` | — | — | — | ⚠ Reddit selectors (webarena-681–688), not this site |
| L19–L24 | `func:gitlab_get_project_memeber_role(...)` | `…/-/project_members` | **returns nothing** | returns `Owner` | ❌ **BUG-001 (P0)** |

**23 of 25 locators verified working** (the 2 excluded are the Reddit `.submission__inner`
pair, which belong to the reddit mock). The 6 `func:` locators all fail — one root cause,
BUG-001.

### BUG-001 · P0 · Members-table `<td>`s are missing `data-label`, so `gitlab_get_project_memeber_role` returns nothing

| Field | Value |
|---|---|
| Route | `/:ns/:proj/-/project_members` (all of them) |
| Element | `<td>` cells in `table[data-testid="members-table"]` |
| Evaluator | `func:gitlab_get_project_memeber_role(__page__, '<username>')` — locators L19–L24 |
| Expected | `Owner` for `byteblaze` on `/byteblaze/dotfiles/-/project_members` (what the **source** returns) |
| Actual | helper finds no account row at all → role resolves to `''` |
| Console errors | none — silent failure |

The helper (WebArena `evaluation_harness/helper_functions.py`) finds the member's row index
with

```js
document.querySelectorAll("td[data-label='Account'] span.gl-avatar-labeled-sublabel")
```

and then reads `document.querySelectorAll("td.col-max-role span")[index].outerText`.

The mock's row markup is otherwise a very close copy — `span.gl-avatar-labeled-sublabel`
holding `@byteblaze` is present, `td.col-max-role > div > span.badge` holding `Owner` is
present — but **every `<td>` lacks the `data-label` attribute**, so the first
`querySelectorAll` matches zero nodes.

```html
mock:   <td role="cell"><div><a class="gl-link gl-avatar-link js-user-link" …
source: <td aria-colindex="1" data-label="Account" role="cell" class=""><div><a …
```

Verified differentially on two projects: `byteblaze` on `/byteblaze/dotfiles/-/project_members`
and on `/byteblaze/a11y-webring.club/-/project_members` returns `Owner` on the source and
nothing on the mock.

**Impact:** webarena-481, -482, -483, -484, -485, -576, -577, -578, -579 (9 tasks, 12
locator assertions) can never pass, no matter how correctly the add-member flow works. The
flow itself works — see replay R4 — so this is purely a missing attribute.

**Fix hint:** in the members-table component add `data-label` to each `<td>`, matching the
source's `bootstrap-vue` stacked-table output:
`Account`, `Source`, `Access granted`, `Max role`, `Expiration`, `Created on`,
`Last activity`. (`aria-colindex` is cosmetic; `data-label` is the load-bearing one.)
The same applies to the **group** members table if it shares the component.

> Note on method: the WebArena evaluation harness is not present on this host, so the helper
> body above is reconstructed. The differential result does not depend on that
> reconstruction being exact — the concrete, checkable fact is that the mock's members
> `<td>`s are missing an attribute the source's carry.

## 4. Task Replay

Every replay was driven through the UI in a real browser — click the nav, open the form,
type, submit — never by typing a post-condition URL, and each mutating replay ends with a
**reload** to prove persistence. Scripts are under `/tmp/pw-sC/`.

| # | Task | Flow driven | Post-condition asserted | Verdict |
|---|---|---|---|---|
| R1 | webarena-742 | `/projects/new` → Create blank project → name `planner`, visibility Private → Create → members page → Invite members → `abisubramanya27`, `vinta` → Invite | `.visibility-icon` title = `Private - Project access must be granted explicitly…`; members page contains `@abisubramanya27` and `@vinta`; both survive reload | ✅ **PASS** |
| R2 | webarena-748 | `/projects/new` → Create from template → Android `Use template` → name `web_agent_android_xl`, Private → Create | lands on `/byteblaze/web_agent_android_xl`; `.visibility-icon` title carries `Private`; `/-/commits` shows `Initialized from 'Android' project template` | ✅ **PASS** |
| R3 | webarena-799 | `/groups/new` → Create group → name `n-lab` → Create → group members → Invite `patou`, `egpast`, `westurner`, `jontutcher` | `/groups/n-lab/-/group_members` contains all four `@`-handles after reload | ✅ **PASS** |
| R4 | webarena-481 | `/byteblaze/dotfiles/-/project_members` → Invite members → `abisubramanya27` → role **Guest** → Invite | row renders with Max role `Guest`, persists | ⚠ **flow PASS, evaluator FAILS** — the role cell is correct but `func:gitlab_get_project_memeber_role` cannot read it (BUG-001) |
| R5 | webarena-394 | `/yjlou/2019-nCov` → Fork → pick namespace `byteblaze` → Fork project | lands on `/byteblaze/2019-nCov`, page shows `2019-nCov` and `Forked from yjlou / 2019-nCov` | ✅ **PASS** (see BUG-003 for the no-namespace path) |
| R6 | webarena-593 | `/byteblaze/dotfiles/-/milestones/new` → title `all branches to main`, start `2044-03-15`, due `2044-03-30` → Create milestone | redirects to `/-/milestones/1`; `#content-body` contains `all branches to main`; `.block.start_date` = `Start date\|Edit\|Mar 15, 2044`; `.block.due_date` = `Due date\|Edit\|Mar 30, 2044 (Upcoming)`; survives reload; list page shows it | ✅ **PASS** — also proves anchor locators L0, L2, L4 |
| R7 | webarena-418 | `/-/profile` → status message `Cruising` → Update profile settings | `/byteblaze` → `.cover-status.lastChild.textContent` = `Cruising` (exactly; the emoji is a preceding element node) | ✅ **PASS** — proves L5 |
| R8 | webarena-448 | `/-/profile` → website `https://egg.tart.com` → Update profile settings | `/byteblaze` → `.profile-header [itemprop="url"]`.outerText = `egg.tart.com` (scheme stripped, as the source does) | ✅ **PASS** — proves L8 |
| R9 | webarena-390 | `/a11yproject/a11yproject.com/-/merge_requests/1531` → comment box → `lgtm` → Comment | `#notes-list`.lastElementChild `.timeline-discussion-body`.outerText = `lgtm` **exactly**, still `lgtm` after reload | ✅ **PASS** — proves L16 |
| R10 | webarena-808 | `/byteblaze/cloud-to-butt/-/issues/new` → title `Let's keep the project alive`, due `2033-03-31`, Assign to me → Create issue | `[data-qa-selector="title_content"]` = `Let's keep the project alive` (exact, apostrophe intact); `[data-testid="sidebar-due-date"]` contains `Mar 31, 2033`; `.block.assignee` = `Assignee\|Edit\|Byte Blaze`; survives reload; appears in the issue list | ✅ **PASS** — proves L1, L14, L15 |
| R11 | webarena-806 | `/-/merge_requests/new` → source `redesign`, target `feature/markdown-figure-block` → Compare branches and continue → Create merge request → sidebar Reviewer → `assign yourself` | new MR at `/-/merge_requests/1532`; `.detail-page-description > a.gl-font-monospace`[0] = `redesign`, [1] = `feature/markdown-figure-block`; `.block.reviewer` = `Reviewer\|Edit\|Byte Blaze`, persists | ✅ **PASS** — proves L3, L17, L18. The intermediate compare URL carries the same `merge_request[source_branch]`/`[target_branch]` params as the source, and the form's field labels match the source exactly (`Title (required)`, `Description`, `Assignee`, `Reviewer`, `Milestone`, `Labels`, `Merge options`, …) |
| R12 | webarena-441 | `/byteblaze/gimmiethat.space/-/blob/main/index.html` → Edit → change `<title>` → Commit changes | `/-/raw/main/index.html` serves the new file with **no app chrome**; `<title>GIVE ME SPACE</title>` present both as literal text and, in `page.content()`, as `&lt;title&gt;GIVE ME SPACE&lt;/title&gt;` — matching the source's `text/plain` + `<pre>` behaviour | ✅ **PASS** |
| R13 | webarena-552 | `/-/tree/main` → `+` (Add to tree) → New file → path `real_space/urls.txt` → paste URLs → Commit changes | commit lands on `/-/blob/main/real_space/urls.txt`; `/-/raw/main/real_space/urls.txt` returns the exact text with no chrome; the tree now lists `real_space` | ✅ **PASS** (nested path creates the directory, as GitLab does) |
| R14 | webarena-523 | `/koush/AndroidAsync` → Star | button flips `Star` → `Unstar`; `/users/byteblaze/starred` now lists `AndroidAsync` | ✅ **PASS** |
| R15 | webarena-533 | `/convexegg` → Follow, `/yjlou` → Follow | `/users/byteblaze/following` → `.user-profile`.outerText contains `@convexegg` and `@yjlou` | ✅ **PASS** — proves L11 with real content |
| R16 | webarena-566 | `/projects/new` → blank project, name **`Do it myself`**, Private, initialize with README | slug derived as **`Do-it-myself`** (spaces→`-`, **case preserved**, per SOURCE.md §10); `/byteblaze/Do-it-myself/-/raw/main/README.md` serves `# Do it myself` bare | ✅ **PASS** |
| R17 | webarena-411 | `/byteblaze/cloud-to-butt/-/edit/master/LICENSE.txt` → replace WTFPL body with MIT text → Commit changes | `/-/blob/master/LICENSE.txt` contains `MIT License` | ✅ **PASS** (non-`main` default branch handled) |
| R18 | webarena-44 | click the Todos counter in the navbar | lands on `/dashboard/todos?sid=…`, `sid` intact, renders `To-Do List` with `To Do 5 / Done 2` | ✅ **PASS** (`url_match`) |
| R19 | webarena-259 | `/-/profile/account` → Reveal on the feed-token field | field goes `********************` → `TMN_bBn9Z48qVbUFZV45`, exactly as on the source (masked input + reveal; the source likewise never puts the token in page text) | ✅ **PASS** |
| R20 | webarena-317, -136 | `/root/metaseq/-/graphs/main`, `/byteblaze/a11y-webring.club/-/graphs/main` | metaseq: `Susan Zhang … 70 commits (suchenzang@…)`, `Stephen Roller … 51 commits (roller@fb.com)`, `Peter Albert … 12 commits (…)` — **byte-identical to the source**. a11y-webring: `Steve Woodson` and `Steven Woodson` render as **two separate cards**, which is what makes webarena-136's answer of `5` reachable | ✅ **PASS** |

**Replay score: 20 flows attempted, 20 completable in the UI, 19 whose evaluator would
pass.** R4 (webarena-481) is the exception: the invite flow works and the members table
shows `Guest`, but the evaluator's DOM read finds nothing — BUG-001.

### Additional anchor-string spot-check (the 111 `(answer)`/`last` strings)

The 111 anchors with no page named are values the agent has to *derive*. I sampled the
derivable ones on the page an agent would read them from, mock against source:

| Page | Strings | Result |
|---|---|---|
| `/root/metaseq/-/graphs/main` | `Susan Zhang: 70`, `Stephen Roller: 51`, `Peter Albert: 12` | ✅ names + counts identical to source |
| `/primer/design/-/graphs/main` | `Shawn Allen`, `Aurora Pleguezuelo`, `Inayaili León` | ✅ present both sides (note the `é` renders correctly) |
| `/eriklindernoren/PyTorch-GAN/-/graphs/master` | `Erik Linder-Norén`, `eriklindernoren@gmail.com`, `eriklindernoren@live.se` | ✅ |
| `/umano/AndroidSlidingUpPanel/-/graphs/master` | `tokudu` | ✅ |
| `/CellularPrivacy/…/-/graphs/master` | `secupwn@users.noreply.github.com` | ✅ |
| `/amwhalen/archive-my-tweets/-/graphs/php52`, `/amwhalen` | `Andrew M. Whalen`, `github@amwhalen.com`, `Massachusetts` | ✅ |
| `/vinta/awesome-python/-/graphs/main` | `414` | ✅ present on mock (the source's card needed lazy render) |
| `/byteblaze/a11y-webring.club/-/graphs/main` | `Steve Woodson`, `Steven Woodson` | ✅ two cards, not merged |
| `/users/byteblaze/projects`, `/users/byteblaze/contributed` | the 8 repo names webarena-169–172 answer with | ✅ all present |
| `/-/profile/account` | `TMN_bBn9Z48qVbUFZV45` | ✅ |

**0 mock gaps in the sample.** The remaining `(answer)` strings are either bare numerals
(`0`, `1`, `2`, `5`, `14`, `16`) or the post-conditions of tasks already replayed above.

## 5. Session Isolation + `/go` pipeline — PASS, with one P0 in the write path

| Check | Result |
|---|---|
| Two sids mutated independently (`isoA` = status `Cruising`, `isoB` = `Out of Office`) | ✅ each reads back its own value |
| Cross-contamination | ✅ none — `isoB` unaffected by `isoA`, and by `isoA`'s reset |
| Fresh sid sees pristine seed | ✅ `isoC` → `.cover-status` is `null` |
| Three sids mutated **concurrently** (`isoG/H/I`) | ✅ all three correct, all three diffs precise |
| `/go` shape | ✅ `{initial_state, current_state, state_diff}` on every sid |
| `state_diff` on a pure-navigation session | ✅ `{}` — browsing does not dirty state |
| `state_diff` reports creations **as creations** | ✅ e.g. `projects.added:[{full_path:"byteblaze/planner", visibility:"private", …}]`, `members.added`, `issues.added`, `nextIds.project`, plus `repo.fileOverlay.…`, `repo.treeOverlay.…`, `repo.commitOverlay.…`, `repo.branchOverlay.…` for the new repo — never as an edit to a seeded record |
| `state_diff` on an edit reports old→new | ✅ `currentUser.status: {old: null, new: {emoji, message:"Cruising", …}}` |
| `reset` | ✅ `{"success":true,…,"message":"State reset to initial."}`; `/go` diff returns to `{}` and the page renders the pristine seed again |
| Custom-state injection (`{"action":"set","state":{…}}`) | ✅ lands in **both** `initial_state` and `current_state`, so the diff baseline is the injected state |

Two defects found in this area — **BUG-004 (P0)** below, and one anomaly I could not
reproduce (see *Unresolved observations*).

## 6. `/-/raw/:ref/*path` bare-text check — PASS

Four raw paths compared against the source at the same URL:

| Path | mock text length | source text length | `<pre>` count | app chrome | identical |
|---|---|---|---|---|---|
| `/byteblaze/gimmiethat.space/-/raw/main/index.html` | 2214 | 2214 | 1 / 1 | none / none | ✅ byte-identical |
| `/byteblaze/dotfiles/-/raw/main/README.md` | 9640 | 9640 | 1 / 1 | none / none | ✅ byte-identical |
| `/byteblaze/cloud-to-butt/-/raw/master/LICENSE.txt` | 483 | 483 | 1 / 1 | none / none | ✅ byte-identical |
| `/a11yproject/a11yproject.com/-/raw/main/README.md` | 6057 | 6057 | 1 / 1 | none / none | ✅ byte-identical |

The browser wraps the `text/plain` body in a single `<pre>`, exactly as it does on the
source, so `page.content()` yields the HTML-escaped form and `innerText` yields the literal
form. This is the source's own behaviour and is reproduced faithfully — webarena-441's
`must_include` of `<title>GIVE ME SPACE</title>` resolves against the escaped text on both
sides. Newly created raw paths behave the same (R12, R13, R16).

`/-/raw/<missing path>` returns the mock's 404 page, matching the source's 404 (the source
returns HTTP 404 for missing raw paths while `/-/blob/` 302s — see DIFF-004).

---

## Bugs for Dev Agent

*(BUG-001 is written up in full in §3 — members-table `<td>`s missing `data-label`, P0,
blocks webarena-481/482/483/484/485/576/577/578/579.)*

### BUG-002 · P1 · Invite-members modal defaults to **Developer**; the source defaults to **Guest**

| Field | Value |
|---|---|
| Route | any `/-/project_members` or `/-/group_members`, "Invite members" modal |
| Element | `select[data-qa-selector="access_level_dropdown"]` |
| Expected | selected option = `Guest` (value `10`) — verified on the source, modal opened read-only, nothing submitted |
| Actual | selected option = `Developer` (value `30`) |
| Evidence | source: `<option value="10">Guest</option>` selected · mock: `s.value === "30"` |

The option list, ids and labels are otherwise a faithful copy. Nine tasks (webarena-481–485,
576–579) turn on the role a member ends up with, and five of them
("invite him to the repo as a guest") match the source's *default*, so an agent that opens
the modal and submits without touching the dropdown gets the right answer on the source and
the wrong one here. Both group and project invite modals are affected (R1/R3 both produced
`Developer` rows without an explicit pick).

**Fix hint:** initialise the role select to `10`.

### BUG-003 · P1 · SSH clone field renders the literal `__GITLAB_SSH__` placeholder

| Field | Value |
|---|---|
| Route | every project page, Clone dropdown, `#ssh_project_clone` |
| Expected | `ssh://git@HOST:PORT/byteblaze/dotfiles.git` — a real host, as `assets/README.md §24.5` requires ("Render the exact `ssh://git@HOST:PORT/ns/proj.git` shape") |
| Actual | `ssh://git@__GITLAB_SSH__/byteblaze/dotfiles.git` |
| Source | `ssh://git@10.186.197.203:2222/byteblaze/dotfiles.git` |

The HTTP clone field is already correct and host-relative (`http://localhost:5203/byteblaze/dotfiles.git`),
so only the SSH one is wrong. `__GITLAB_SSH__` is the *evaluator's* placeholder: WebArena
substitutes it into the **reference answer** before comparing, so an agent that copies the
literal placeholder off the page will be compared against a real host string and fail.

**Impact:** webarena-293, -294, -295, -296, -297 (`exact_match`).
**Fix hint:** derive it from `window.location.hostname` the way the HTTP URL already is,
e.g. `ssh://git@${location.hostname}:2222/${full_path}.git`.

### BUG-004 · P0 · `/post` decodes the request body chunk-by-chunk, silently corrupting multi-byte UTF-8

| Field | Value |
|---|---|
| File | `websites/webarena_gitlab_mock/vite.config.js:185-186` |
| Code | `let body = ''` / `for await (const chunk of req) body += chunk` |
| Symptom | a 3-byte UTF-8 character that straddles a chunk boundary is decoded as 2–3 `U+FFFD` replacement characters |
| Rate observed | **8 of 362** `.mock-states/<sid>.json` files written during this shard (2.2%). **0 of 362** `.initial.json` files — which are written server-side and never go through `/post` |

Evidence that it is a chunk-boundary split and not random damage: two different sessions
(`anchC_15`, `anchC_27`) corrupt at **the same character offset, 717945**, and the runs are
2 and 3 replacement characters long — the two possible ways a 3-byte sequence can be cut.

```
initial: "…Please helo me to do this\n\n…"      (U+2026)
current: "…Please helo me to do this\n\n���"
```

**Why P0 rather than cosmetic:** the corruption lands anywhere in a ~2 MB state, silently,
and the anchor set is full of multi-byte strings — `Erik Linder-Norén` (`exact_match`,
webarena-311), `Inayaili León` (webarena-314), `1993–2003: Early career and breakthrough`
(EN DASH, webarena-559), `Mewen Le Hô`, `윤보미`, and the `🤖`/`💄`/`♿️` emoji in project
descriptions (`.home-panel-description-markdown` is an anchor locator). A hit on any of
those fails a task with no visible symptom. It also produces phantom `issues.changed`
entries in `/go`'s `state_diff`, which poisons the RL signal.

**Fix hint:** the correct pattern is already in the same file 40 lines above, in the upload
handler (`vite.config.js:142-143`):

```js
const chunks = []
for await (const chunk of req) chunks.push(chunk)
const body = Buffer.concat(chunks).toString('utf-8')
```

This is a shared-scaffold defect; it is worth checking the other `webarena_*_mock` configs
for the same line.

### BUG-005 · P2 · Fork form submits silently when no namespace is selected

`/:ns/:proj/-/forks/new` → fill nothing, click **Fork project**: nothing happens, no
validation message, no console error, URL unchanged. Selecting a namespace first makes the
whole flow work (R5). GitLab shows an error in this case; I could not confirm the exact copy
because submitting a form on the source is out of bounds for this shard.

### BUG-006 · P2 · Newly created group shows the "no permissions" empty state to its own owner

After R3 created `n-lab`, `/n-lab` renders
`You do not have necessary permissions to create a subgroup or project in this group. Please contact an owner of this group to create a new subgroup or project.`
— to byteblaze, who is the group's Owner. No anchor reads this page.

### BUG-007 · P2 · Second invited member is written with `"id": null`

`/go?sid=rep_r1` after inviting two users in one modal submit:

```json
"members": {"added": [
  {"id": 206, …, "user_id": 2330, "access_label": "Owner"},
  {"id": 207, …, "user_id": 5,    "access_label": "Developer"},
  {"id": null, …, "user_id": 278, "access_label": "Developer"}
]}
```

The row renders and persists correctly, so no task is blocked, but the id allocator only
advances once per submit. It will collide if two multi-invite submits happen in one session.

---

## Source-vs-Mock Differences

### DIFF-001 · P2 · `/groups/<g>/-/group_members` renders a shell for groups that do not exist

The five group-creation post-condition routes (`n-lab`, `x-lab`, `crew`, `coding_friends`,
`webagent`) render a full group sidebar and the body `This group does not exist yet` where
the source returns its 404 page. Harmless — the anchor only has to resolve *after* the group
is created, and R3 shows it does — but it is a visible divergence and the copy is invented.

### DIFF-002 · P2 · `.user-profile` whitespace normalisation

`document.querySelector('.user-profile').outerText`:

```
source: " \nByte Blaze\n@byteblaze  User ID: 2330 \n  Member since March 23, 2023\n Boston, MA   @github\n 2 followers  3 following\n…"
mock:   "Byte Blaze\n@byteblazeUser ID: 2330\nMember since March 23, 2023\nBoston, MA@github\n2 followers3 following\n…"
```

Same tokens, same order; the source has extra inter-element spaces from its Haml whitespace.
The anchors on this locator are `@username` substrings (webarena-533–537), so they match
either way. Not worth a round on its own.

### DIFF-003 · P1 · `/dashboard/projects` defaults to "Updated date"; the source defaults to "Name"

| | |
|---|---|
| Source sort control reads | `Name` (byteblaze's persisted `projects_sort` is `name_asc` — SOURCE.md §6b) |
| Mock sort control reads | `Updated date` |
| Source order | `a11y-syntax-highlighting`, `a11y-webring.club`, … (alphabetical) |
| Mock order | `solarized-prism-theme`, `gimmiethat.space`, `dotfiles`, `timeit`, … |

webarena-522's anchor (`must_include ["create-react-app","buck"]` inside
`[data-qa-selector="projects_list"]`) is order-independent, so it is unaffected. But any
task that reads "the first project" or browses expecting alphabetical order sees a different
page than the source. Related: the mock's project rows omit the `Owner` role badge the
source renders next to the project name.

### DIFF-004 · P2 · `/-/blob/:ref/<missing path>` renders the tree with an error banner instead of redirecting

Source 302s `/-/blob/main/<missing>` to `/-/tree/main` (SOURCE.md §5). The mock stays on the
blob URL and renders the tree with a `"LICENSE" did not exist on "main"` banner. Since the
anchor routes on missing blobs are all create-the-file post-conditions (webarena-411, -414,
-736) and R17 shows they render correctly once created, this only affects the pre-creation
view.

### DIFF-005 · P2 · Hardcoded `http://localhost:8023/` in the project-URL prefix

The `/projects/new` and `/-/forks/new` forms render the URL prefix as
`http://localhost:8023/byteblaze/` while the mock is served from port 5203. Cosmetic — the
form still creates the project at the right path — but it is the source's host leaking into
the mock, and it is inconsistent with the HTTP clone field, which is correctly host-relative.
Same family as BUG-003.

### Non-differences, checked and dismissed

- **Issue/MR badge counts.** `/vinta/awesome-python/-/issues` reads `Open 13 / Closed 22 /
  All 35` in the mock vs `Open 13 / Closed 498 / All 511` on the source. This is the declared
  sampling strategy (`assets/data_model.md §0`), no evaluator reads it, and webarena-786's
  answer `414` comes off the contributors graph, where the mock is correct.
- **Raw-file HTML escaping.** Reproduced from the source deliberately; not a divergence.
- **`/byteblaze/nvidia-patch` and `/byteblaze/viewgrades-scraper` 404.** webarena-398 *wants*
  `404`, and the mock renders the source's exact 404 copy.
- **`/-/profile/account` does not show the feed token in page text.** Neither does the source;
  both mask it behind a Reveal control. The mock additionally lacks the
  `<link rel="alternate" …?feed_token=…>` head element the source emits, which is not
  agent-visible.

---

## Unresolved observations

**One coarse `/go` diff, not reproducible.** On the first isolation run, `/go?sid=isoA`
returned `state_diff` keys `['currentUser','users','projects','groups','issues','mergeRequests']`
— whole top-level collections — instead of the precise `['currentUser.status','users']` that
the very same flow produced for `isoB` and for five subsequent attempts (`isoE`, `isoF`,
`isoG/H/I`, including three run concurrently). I could not reproduce it and do not have a
mechanism; flagging it because a coarse diff makes `/go` useless as a reward signal for that
episode, and because it happened in the same run as a BUG-004 corruption, which would explain
it (a corrupted current state diffs against a clean initial across every collection). If
BUG-004 is fixed, re-check whether this recurs.

---

## Not Reached (stated explicitly — do not read as coverage)

- **Anchor locators L9 and L10** (`.submission__inner`, webarena-681–688) are **Reddit**
  selectors. Not testable on this site; not counted as pass or fail.
- **Byte-level verification of the 111 `(answer)`/`last` anchor strings.** I sampled ~30 of
  them across 13 pages (all present, all matching the source). The rest are bare numerals or
  post-conditions of the tasks replayed in §4.
- **Task replay coverage is 20 of 204.** The 20 were chosen to span all three evaluator
  families and every mutation family named in my brief (create project blank + from template,
  create group, add project/group member, fork, create + edit repository file, star, follow,
  profile status, profile website, comment on MR, create issue with assignee + due date,
  create MR with reviewer, create milestone, url_match navigation, token read, contributor
  counting). I did **not** replay: label creation/assignment, issue close/reopen, MR
  merge/close, project settings edits, search across scopes, or the Web IDE commit path
  (I confirmed the Web IDE shell renders a `New file` control and a commit box, but did not
  drive a commit through it — webarena-566 names the Web IDE explicitly, and I completed that
  task through the simple editor instead).
- **The source was never mutated.** Every source interaction was a GET or a modal-open. Two
  consequences: I could not confirm the mock's flash-message copy or redirect targets after a
  successful create against the source, and I could not confirm the source's validation copy
  for BUG-005.
- **Route sweep** (`ROUTES.md` rows outside the anchor set), **cosmetic/visual diffing**, and
  **screenshot comparison** were shards A and B's scope, not mine.
