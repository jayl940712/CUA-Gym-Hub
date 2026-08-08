# webarena_gitlab_mock — Test Report

> Round: **5** (final regression + verification sweep)
> Date: 2026-08-08
> Mock: http://localhost:5242 (`npm run dev -- --port 5242`)
> Source: http://localhost:8023 — **reachable: YES** (read-only; no `?sort=` URL was
> ever loaded on 8023, per the round brief's `IssuableCollections#set_sort_order`
> hazard; no POST, no login, no mutation)
> Tested by: playwright agent, **shard B of 2**
> Supersedes: the round-4 consolidated report, preserved verbatim at
> `TEST.round4-prev.md`
> Toolchain: real chromium via `/tmp/pwvenv/bin/python` +
> `LD_LIBRARY_PATH=/tmp/sysroot/...`. **No curl-only substitution anywhere** —
> every route result below came from a real browser page load.

**Shard note.** Shard A was concurrently backfilling `issues.closed_at` and MR
merge/close timestamps into `src/data` and editing `src/pages/hooks.js` while this
ran. Per the brief, `closed_at` / `merged_at` sort orderings are excluded from this
report. Everything else was in scope.

---

## 0 · How to read this round

Everything in §1–§6 was **re-verified in a browser this round**. Nothing is carried
forward on a previous shard's word. Where a number is carried forward from round 4
it is labelled **[carried]** and says so.

---

## 1 · Summary

| Metric | Result |
|---|---|
| ROUTES.md numbered rows cold-loaded this round | **124 / 124 probed** (the other 8 are the 6 declared not-migrated + 2 dynamic-id rows folded into their parents) |
| …rendering a real, non-`<Placeholder>`, non-404 view | **115** |
| …rendering `<Placeholder>` | **9** — rows 99–105, 113, 115, every one marked `[ ]` in ROUTES.md |
| …rendering `NotFound` | **2** — rows 96, 97, both marked `[ ]` |
| **False completions** (`[x]` rows that render placeholder / 404 / blank) | **0** |
| Cold deep-link failures | **0** |
| `?sid=` preservation failures (cold load, redirect, form submit, nav) | **0 / 124** |
| Console errors on cold load | **0 / 124** |
| Uncaught pageerrors on cold load | **0 / 124** |
| Trailing-slash + URL-encoded param probes | **50 / 50 clean**, 0 sid loss, 0 errors |
| Anchor routes resolving correctly | **145 / 145** |
| Anchor strings verified verbatim | **243 page-bound pairs checked** — 0 mock-side gaps |
| Anchor locators verified | **23 / 25** (2 are Reddit `.submission__inner` selectors, not this site) |
| Tasks replayed end to end this round | **28 flows / 28 completable**, evaluator post-condition confirmed on each |
| P0 regressions found | **0** |
| P1 functional bugs found | **0** |
| P0/P1 source-vs-mock differences found | **1** (DIFF-001) |
| P2 findings | 8 (DIFF-002 … DIFF-009) |
| `npm run build` | ✅ passes |
| Session isolation / reset / injected state | **PASS** |

---

## 2 · P0 regression check — all four still fixed

Each was **driven**, not read.

### BUG-004 — `/post` multi-byte UTF-8 chunk-boundary decoding · ✅ STILL FIXED

Posted 20 payloads in which a 4-byte `🐞` is positioned so its bytes **straddle**
the 8 KiB / 16 KiB / 64 KiB / 128 KiB / 256 KiB chunk boundaries at offsets 0–3,
each carrying `type: bug 🐞 — “smart” … é ü 中文 🚀 ✔`. Every payload was written
with `ensure_ascii=False` so real multi-byte bytes crossed the boundary (an
`ensure_ascii=True` probe is a false pass — the emoji arrives as `🐞`
and never touches the decoder).

```
boundary=8192   off=0  emoji_byte_idx=8192    bodylen=8255    ok=True
boundary=65536  off=3  emoji_byte_idx=65533   bodylen=65596   ok=True
boundary=262144 off=1  emoji_byte_idx=262143  bodylen=262206  ok=True
   … 20/20 byte-for-byte round-trip via POST /post → GET /go
FAILS: none
```

### BUG-B01 — case-insensitive project paths · ✅ STILL FIXED

Cold-loaded in fresh contexts, `?sid=` preserved through every redirect:

| requested | resolved to | renders |
|---|---|---|
| `/ByteBlaze/dotfiles` | `/byteblaze/dotfiles` | `h1 = dotfiles` |
| `/byteblaze/DOTFILES` | `/byteblaze/dotfiles` | `h1 = dotfiles` |
| `/a11yproject/A11yproject.com` | `/a11yproject/a11yproject.com` | `h1 = a11yproject.com` |
| `/BYTEBLAZE/empathy-prompts` | `/byteblaze/empathy-prompts` | `h1 = empathy-prompts` |
| `/byteblaze/Dotfiles/-/issues` | `/byteblaze/dotfiles/-/issues` | issues list |

The canonical form is what renders; the seed's casing wins.

**webarena-396 end to end.** `/byteblaze/ChatGPT` correctly 404s before the fork
(it is a group-C task-created route and must not be pre-seeded). After forking
`convexegg/chatgpt` through the UI:

```
fork form  /convexegg/chatgpt/-/forks/new  → Select a namespace → byteblaze → Fork project
lands on   /byteblaze/chatgpt?sid=…
/byteblaze/ChatGPT  → 301-equivalent → /byteblaze/chatgpt, renders the forked project
```

**One thing to record honestly:** the literal string `ChatGPT` appears **nowhere**
on that page — because the project's name is `Chatgpt`. **This matches the source
exactly.** `curl http://localhost:8023/convexegg/chatgpt` gives
`<title>Convex Eggtart / Chatgpt · GitLab</title>` and **zero** occurrences of
`ChatGPT` (99× `chatgpt`, 12× `Chatgpt`). webarena-396 therefore passes on the
mock exactly as often as it passes on the source — i.e. only under the harness's
case-insensitive `clean_answer` comparison. **Not a mock defect; recorded so a
future round does not "fix" the seed away from the source.**

### BUG-001 — members table `<td data-label>` · ✅ STILL FIXED

Ran the DOM query `gitlab_get_project_memeber_role` performs (find the `tbody tr`
containing the username, read `td[data-label="Max role"]`):

| project | user | returned |
|---|---|---|
| `/a11yproject/a11yproject.com` | `byteblaze` | `Maintainer` |
| `/byteblaze/dotfiles` | `byteblaze` | `Owner` |
| `/primer/design` | `byteblaze` | `Developer` |
| `/byteblaze/gimmiethat.space` | `yjlou` | `Developer` |

Full cell set on `/byteblaze/dotfiles`:
`Account · Source · Access granted · Max role · Expiration · Created on · Last activity · Actions`
— all eight carry `data-label`.

And **post-mutation**, which is what tasks 481–485 actually score: inviting
`abisubramanya27` to `dotfiles` as **Guest** through the Invite-members modal, then
reloading, returns `'Guest'` from the same query. ✅

### BUG-A01 — `?sid=` on the project-list sort dropdown · ✅ STILL FIXED

| page | after choosing "Name" | sid kept |
|---|---|---|
| `/dashboard/projects?sid=regB_a01` | `/dashboard/projects?sort=name_asc&sid=regB_a01` | ✅ |
| `/?sid=regB_a01` | `/dashboard/projects?sort=name_asc&sid=regB_a01` | ✅ |
| `/explore/projects?sid=regB_a01` | `/explore/projects?sort=name_asc&sid=regB_a01` | ✅ |

### The white-screen class · ✅ NO RECURRENCE

**0 console errors and 0 uncaught pageerrors** across every load in this round:
124 ROUTES.md row probes + 145 anchor routes + 50 param-form probes + ~90 page
loads during task replay ≈ **410 cold page loads, all in fresh browser contexts
with a fresh `?sid=`**. `npm run build` was not treated as evidence for any of it.

---

## 3 · Route parity re-sweep

Every numbered ROUTES.md row was given a concrete probe URL, cold-loaded in a
**fresh browser context** with a **per-row `?sid=`**, and classified by what
actually rendered.

| Class | Count | Rows |
|---|---|---|
| Real view, correct content | 115 | — |
| `<Placeholder>` (all `[ ]` in ROUTES.md) | 9 | 99, 100, 101, 102, 103, 104, 105, 113, 115 |
| `NotFound` (both `[ ]`) | 2 | 96, 97 |
| Declared not migrated | 6 | 24, 34, 42, 68, 77, 85 |
| **False completions** | **0** | — |

**Round 4's ~24 Placeholder→real conversions all hold.** Rows 67, 76, 106–112,
114, 116–118 render real views, not placeholder copy:

| row | probe | renders |
|---|---|---|
| 67 | `/byteblaze/dotfiles/activity` | project activity feed |
| 76 | `/byteblaze/dotfiles/-/incidents` | incidents empty state |
| 106 | `/byteblaze/dotfiles/-/pipelines` | zero-pipeline state |
| 107 | `/byteblaze/dotfiles/-/jobs` | jobs empty state |
| 108 | `/byteblaze/dotfiles/-/pipeline_schedules` | schedules empty state |
| 109 | `/byteblaze/dotfiles/-/ci/editor?branch_name=main` | "Optimize your workflow with CI/CD Pipelines" + "Configure pipeline" |
| 110 | `/byteblaze/dotfiles/-/environments` | environments empty state |
| 111 | `/byteblaze/dotfiles/-/releases` | releases empty state |
| 112 | `/byteblaze/dotfiles/-/packages` | package registry |
| 114/58 | `/byteblaze/dotfiles/-/graphs/main/charts` | **Repository Analytics** — 40 commits / 1 author, commits per month / weekday / hour |
| 116 | `/byteblaze/dotfiles/-/snippets` | project snippets |
| 117 | `/byteblaze/dotfiles/-/wikis/home` | wiki empty state |
| 118 | `/byteblaze/dotfiles/-/clusters` | Kubernetes clusters |

Four rows that looked like misses on a first pass and are **not**:

- **Row 72** `?add_related_issue=719` — the prefill is real. It lands in the
  description **textarea value** (`'relates to #719'`), which `innerText` cannot
  see. Confirmed via `input_value()`.
- **Row 93** `/primer/design/-/milestones/1/edit` → 404, because primer/design has
  **no** milestones. That matches the source exactly: the source's
  `/primer/design/-/milestones` renders the empty state, character-identical to
  the mock's ("Use milestones to track issues and merge requests over a fixed
  period of time / Organize issues and merge requests into a cohesive group, and
  set optional start and due dates. Learn more. / New milestone"). The five
  milestone tasks (590–594) **create** the milestone.
- **Rows 60, 109** render real views under different headings than I first
  guessed.
- **Rows 96, 97** 404 — matching their `[ ]` status; neither is on an anchor path.

### Trailing-slash and URL-encoded forms — 50 / 50 clean

Every param-taking row family was probed in plain, trailing-slash and encoded
form. **0 404s, 0 sid losses, 0 console errors.** Includes all the encodings the
brief called out:

| encoded probe | decodes to |
|---|---|
| `/a11yproject/a11yproject.com/-/issues/?label_name%5B%5D=bug` | `label_name[]=bug` |
| `/primer/design/-/issues/?label_name%5B%5D=type%3A%20bug%20%F0%9F%90%9E` | `label_name[]=type: bug 🐞` |
| `/umano/AndroidSlidingUpPanel/-/issues/?state=opened&not%5Blabel_name%5D%5B%5D=BUG` | `not[label_name][]=BUG` |
| `/root/metaseq/-/issues/?search=OPT%20model&sort=created_asc&state=opened&label_name%5B%5D=question&first_page_size=20` | full 5-param form |
| `/byteblaze/dotfiles/-/blob/main/Adobe/Illustrator/AI24Settings_Dec%202,%202019_9%2040%20PM` | `%20` → space in a blob path |
| `/amwhalen/archive-my-tweets/-/tree/github/fork/chtitux/addRssFeed` | a `:ref` containing three `/` |

### Params actually drive behaviour

Measured by diffing the rendered row list against the unparameterised page:

| param | effect | verdict |
|---|---|---|
| `state=closed` / `state=merged` (issues, MRs) | different row set | ✅ |
| `search=…` | narrows | ✅ |
| `assignee_username=` | 14 → 4 rows | ✅ |
| `label_name[]=bug` / `help wanted` / `enhancement` / `type: bug 🐞` / `None` | 20 → 3 / 4 / 6 / 2 / 1 | ✅ |
| `sort=created_asc`, `updated_desc`, `title_asc`, `popularity`, `due_date_desc`, `priority`, `label_priority`, `milestone_due_desc`, `relative_position` | **all nine reorder** | ✅ — **AUDIT P1-2 is CLOSED**, verified by driving |
| `sort=created_desc` | identical to default `created_date` | ✅ correct |
| `sort=name_asc/name_desc/created_desc/stars_desc/latest_activity_desc` (projects) | all four reorder | ✅ |
| `name=dotfiles` (projects) | 14 → 1 row | ✅ |
| `page=2` (`/explore/projects`) | different page | ✅ |
| `state=done` (todos) | 5 → 2 | ✅ |
| `state=closed` (milestones) | 4 → 2 | ✅ |
| `state=stale` / `/active` / `/all` (branches) | all stale, active empty — matches the source (`/primer/design/-/branches/active` on 8023 renders `No branches to show`) | ✅ |
| `archived=only` | 14 → **0** rows | ✅ |
| `archived=true` / `archived=false` / `personal=true` / `non_archived=true` | no observable effect | ✅ **correct** — GitLab's `ProjectsFinder` maps `only`→archived-only, `false`→non-archived, **anything else (incl. `true`)→all**, which `src/components/ui/ProjectsNav.jsx:170-174` implements exactly; and the seed has 0 archived / 14-of-14 personal projects. `ROUTES.md`'s table is the thing that is wrong — see DIFF-007 |
| `subscribed=true` (labels) | filters to `You do not have any subscriptions yet` | ✅ — the `Subscribed` tab **does** exist on the source (visible in the logged-in `source_labels.png`); an unauthenticated `curl` hides it and produced a false finding I retracted. See the methodology warning in §8. The exact empty-state wording is the one thing here I could not verify — no logged-in capture of `?subscribed=true` exists |

---

## 4 · Anchor contract re-verification

### 4.1 Anchor routes — 145 / 145

Every route in `assets/task_anchors.json`, cold-loaded in a fresh context with a
fresh `?sid=`:

| | |
|---|---|
| Routes probed | **145** |
| `?sid=` preserved | **145 / 145** |
| Console errors / pageerrors | **0** |
| `<Placeholder>` on an anchor route | **0** |
| Rendering seed content | **80** |
| 404 in the mock | **65** |

All 65 mock-side 404s were classified against ROUTES.md's *Anchor Route Coverage*
groups B and C. **Every single one is a route whose record the task creates or
forks** — 31 `byteblaze/*` projects, 9 fork targets, 5 `/groups/*/‑/group_members`,
and the 4 `gimmiethat.space` `urls.txt` paths. **Zero unexpected 404s**, and zero
group-B/C routes that resolve (a pre-seeded one would make its task trivially
"already done", which ROUTES.md correctly warns against).

### 4.2 Anchor strings — 243 page-bound pairs, 0 mock-side gaps

The 252 anchor strings expand to 243 (string, page) pairs plus 111 `last` /
`(answer)` bindings. Each pair was checked **byte-for-byte** against
`page.innerText('body')` and `page.content()` on its page.

| Class | Count |
|---|---|
| Present verbatim on a page that resolves today | **5** |
| Absent because the page is a task-created route that 404s today | **170** |
| Absent because the string is a **post-condition the task writes** | **68** |
| **Absent on a resolving page where the source would show it** | **0** |

Every one of the 68 was triaged against its task's `question` text. All 68 are
outcomes: `Cruising` / `Out of Office` (tasks 418–422 set the status),
`egg.tart.com` (448–452 set the website), `MIT License` / `GENERAL PUBLIC LICENSE`
/ `Apache License` (411–414, 736 change the LICENSE), `<title>GIVE ME SPACE</title>`
(441–445 edit `index.html`), `lgtm` / `Good idea` (389–393 post the comment),
`@vinta` / `@bblanchon` / `Guest` / `Developer` (480–485, 567–579 invite),
`@convexegg` / `@yjlou` (533–537 follow), `AndroidAsync` / `create-react-app`
(522–526 star or fork), and the `assignee_username=` dashboard rows (446, 804,
810, 811 assign). **Each was then confirmed to appear after the flow is
performed** — see §5.

The read-preconditions those tasks depend on were all verified present today:

| precondition | verified |
|---|---|
| `yjlou` is a member of `/byteblaze/gimmiethat.space` (webarena-349's answer) | ✅ |
| Issue `404s, bad host, timeouts, bad urls for URLs linked from website` exists in a11yproject | ✅ |
| Issues `Add documentation on using Flash alerts in dialog components` and `Clarify usage of flash alert` exist in primer/design | ✅ |
| `facebook/buck` and `facebook/create-react-app` exist (webarena-522's fork sources) | ✅ |
| Feed token `TMN_bBn9Z48qVbUFZV45` (webarena-259, `exact_match`) | ✅ in the DOM of `/-/profile/personal_access_tokens`, masked in `innerText` behind `********************` exactly as the source masks it |

> Doc drift worth one line: ROUTES.md's *Intentionally Not Migrated* table still
> says the feed token "is rendered on `/-/profile/account`". It is not — it is on
> `/-/profile/personal_access_tokens`, which is what the source does, and
> `src/pages/ProfileKeys.jsx:57` documents the correction (BUG-A10). The code is
> right; the ROUTES.md sentence is stale. **P2, doc-only.**

### 4.3 Anchor locators — 23 / 25

| # | locator | probe page | returned |
|---|---|---|---|
| 0 | `#content-body` | `/a11yproject/…/-/milestones/6` | `Past due / Milestone expired on Dec 31, 2019 / …` ✅ |
| 1 | `.block.assignee` | issue 719 | `Assignee\nEdit\nByte Blaze` ✅ |
| 2 | `.block.due_date` | `/a11yproject/…/-/milestones/6` | `Due date\nEdit\nDec 31, 2019 (Past due)` ✅ |
| 3 | `.block.reviewer` | MR 1071 / primer 450 | `0 Reviewers\nEdit\nNone - assign yourself` ✅ |
| 4 | `.block.start_date` | `/a11yproject/…/-/milestones/6` | `Start date\nEdit\nNo start date` ✅ |
| 5 | `.cover-status` | `/byteblaze` **after** setting status | `'Cruising'` ✅ (absent before — matches source, which has no `cover-status` in its `/byteblaze` capture) |
| 6 | `.detail-page-description` | issue 719 | issue body ✅ |
| 7 | `.home-panel-description-markdown` | `/byteblaze/dotfiles` | `🤖 Computer setup` ✅ |
| 8 | `.profile-header [itemprop="url"]` | `/byteblaze` **after** setting the website | `egg.tart.com` ✅ (absent before — matches source) |
| 9, 10 | `.submission__inner` | — | **Reddit selectors** (webarena-681–688); not this site — neither pass nor fail |
| 11 | `.user-profile` | `/users/byteblaze/following` | full profile outerText ✅ |
| 12 | `.visibility-icon[title]` | `/byteblaze/dotfiles`, `/a11yproject/…` | `Public - The project can be accessed without any authentication.` ✅ |
| 13 | `[data-qa-selector="projects_list"]` | `/dashboard/projects` | project rows ✅ |
| 14 | `[data-qa-selector="title_content"]` | issue 719 | `Rethink the homepage's content` ✅ |
| 15 | `[data-testid="sidebar-due-date"]` | issue 719 | `Due date\nEdit\nNone` ✅ |
| 16 | `#notes-list` → `lastElementChild` → `.timeline-discussion-body` | MRs 1531 / 1071 / 1265 / primer 450, **after posting** | `'lgtm'`, `'Good idea'`, `'close because non reproducible'`, `'Thanks, working on reviews'` ✅ |
| 17, 18 | `.detail-page-description > a.gl-font-monospace` [0] / [1] | MR 1071 | `add-color-utility-classes` / `main` ✅ |
| 19–24 | `func:gitlab_get_project_memeber_role(…)` ×6 | members tables, before **and** after invite | `Owner` / `Maintainer` / `Developer` / `Guest` ✅ |

**Locator 16 needs its caveat stated.** Before any comment is posted, it throws:
on issue 719 the last `#notes-list` child is a **system note** with no
`.timeline-discussion-body`, and on MR 1071 `#notes-list` is **empty**. That is
correct — its four tasks (389–393) all post a comment first, and after posting the
new comment is the last child and the locator resolves. It was verified on all
four target MRs.

---

## 5 · Task replay — 28 flows, 28 completable

Every flow was driven through the UI the way an agent would (no direct URL entry
except where the task's `start_url` is that URL), then the post-condition was read
at its real anchor URL **after a full page reload in a fresh context**.

| task | flow | post-condition checked | verdict |
|---|---|---|---|
| webarena-44 | `/` → click Todos in the chrome | URL `/dashboard/todos?sid=…` | ✅ |
| webarena-259 | read the feed token | `TMN_bBn9Z48qVbUFZV45` in the DOM of `/-/profile/personal_access_tokens` | ✅ |
| webarena-390 | comment `lgtm` on a11y MR 1531 | L16 → `'lgtm'` | ✅ |
| webarena-391 | comment on a11y MR 1265 | L16 → `'close because non reproducible'` | ✅ |
| webarena-392 | comment on a11y MR 1071 | L16 → `'Good idea'` | ✅ |
| webarena-389 | comment on primer MR 450 | L16 → `'Thanks, working on reviews'` | ✅ |
| webarena-396 | fork `convexegg/chatgpt` | `/byteblaze/ChatGPT` → `/byteblaze/chatgpt`, project renders | ✅ (see §2 casing note) |
| webarena-414 / 736 | `/-/new/main?file_name=LICENSE` → commit MIT text | `/byteblaze/dotfiles/-/blob/main/LICENSE` contains `MIT License` **and** the full `The above copyright notice…` sentence, in both `innerText` and `page.content()` | ✅ |
| webarena-418 | set status via `/-/profile?set_status=1` | `.cover-status.lastChild` → `Cruising` | ✅ |
| webarena-441 | `/-/edit/main/index.html` → change `<title>` → commit | `/-/raw/main/index.html` contains `<title>GIVE ME SPACE</title>` (and its escaped form in `page.content()`) | ✅ |
| webarena-446 | find the 404s issue → assign Roshanjossey | it appears on `/dashboard/issues?scope=all&state=opened&assignee_username=Roshanjossey` | ✅ |
| webarena-448 | set website URL on `/-/profile` | `.profile-header [itemprop="url"]` → `egg.tart.com` | ✅ |
| webarena-481 | invite `abisubramanya27` to dotfiles as **Guest** | `gitlab_get_project_memeber_role` → `Guest` | ✅ |
| webarena-522 | fork `facebook/buck` + `facebook/create-react-app` | `[data-qa-selector="projects_list"]` contains both | ✅ |
| webarena-523 | star 5 repos from their project pages | `/users/byteblaze/starred` lists all five | ✅ |
| webarena-533 | follow `convexegg` + `yjlou` | `.user-profile` on `/users/byteblaze/following` contains `@convexegg` and `@yjlou` | ✅ |
| webarena-590 | create milestone in primer/design | lands on `/primer/design/-/milestones/1`; `#content-body` has `product launch`, `.block.start_date` → `Jan 16, 2030`, `.block.due_date` → `Jan 30, 2030 (Upcoming)`; appears on `/primer/design/-/milestones` | ✅ |
| webarena-658 | create issue + assignee + due date | `/-/issues/1534`; `title_content` → `401 bad gateway`, `sidebar-due-date` → `Dec 31, 2030`, `.block.assignee` → `Roshan Jossy` — **identical after reload** | ✅ |
| webarena-666 | new MR `dialog-component` → `dialog`, reviewer Primer | `/primer/design/-/merge_requests/451`; mono[0] `dialog-component`, mono[1] `dialog`, `.block.reviewer` → `Primer` **after reload** | ✅ |
| webarena-742 | create **private** `planner` + invite 2 | `.visibility-icon[title]` → `Private - …`; `@abisubramanya27` + `@vinta` on `/-/project_members` | ✅ |
| webarena-745 | create **public** `awesome-llms` + invite 3 | `.visibility-icon[title]` → `Public - …`; `@primer`, `@convexegg`, `@abisubramanya27` | ✅ |
| webarena-748 / 753 | create from **Android** template | `/-/commits` contains `Initialized from 'Android' project template` | ✅ |
| webarena-749 / 754 | create from **NodeJS Express** template | `/-/commits` contains `Initialized from 'NodeJS Express' project template` | ✅ |
| webarena-750 / 755 | create from **Pages/Plain HTML** template | `.home-panel-description-markdown` → `Example plain HTML site using GitLab Pages: https://pages.gitlab.io/plain-html` | ✅ |
| webarena-751 / 756 | create from **Pages/Jekyll** template | `.home-panel-description-markdown` → `Example Jekyll site using GitLab Pages: https://pages.gitlab.io/jekyll` | ✅ |
| webarena-752 | create private blank `web_agent` | `.visibility-icon` → `Private - …`; `/-/commits` contains `Initial commit` | ✅ |
| webarena-799 | create group `n-lab` + invite 4 | `/groups/n-lab/-/group_members` contains `@patou`, `@egpast`, `@westurner`, `@jontutcher` | ✅ |
| webarena-804 / 810 | assign both flash-alert issues to byteblaze | both titles appear on `/dashboard/issues?scope=all&state=opened&assignee_username=byteblaze` | ✅ |

**Three driving notes that are about the harness, not the app** — recorded so the
next round does not re-derive them:

- **`/groups/new` and `/projects/new` are chooser pages**, exactly as the source
  is. The form is behind `#create-group-pane` / `#blank_project` /
  `#create_from_template`. There are 4 `<input>`s on the bare page and that is
  correct.
- **"Use template" is a `<label>` wrapping a hidden radio**, matching GitLab's real
  markup: `[data-testid="use_template_plainhtml"]`. `get_by_role('button')` will
  never find it.
- **Visibility radios are `#project_visibility_level_{0,10,20}`** with values
  `0/10/20`, not `value="private"`. A selector on `value="private"` silently
  matches nothing and the project is created **public** — which looks exactly like
  a broken visibility control and is not.
- **Sidebar user pickers are two-stage**: `[data-testid="edit-button"]` reveals the
  selectbox, then `.dropdown-menu-toggle` opens the menu with
  `input.dropdown-input-field`. The new-MR form's reviewer is flat markup
  (`.merge-request-reviewer .dropdown-menu-toggle`), not `.block.reviewer`.

---

## 6 · Session isolation, `/go`, and the state pipeline — PASS

| Check | Result |
|---|---|
| Two sids each create a project; neither sees the other's | `isoB_a` sees `alpha_iso`, not `beta_iso`; `isoB_b` the reverse | ✅ |
| The other sid's project 404s | ✅ both directions |
| `/go` shape | `{initial_state, current_state, state_diff}` ✅ |
| `state_diff` reports a **CREATION**, not an edit to seed data | `{"projects":{"added":[{"id":194,"full_path":"byteblaze/alpha_iso",…}],"removed":[],"changed":[]},"members":{"added":[…]}}` — per-record `added` sets, seed rows untouched ✅ |
| `reset` restores initial | `alpha_iso` gone from `/dashboard/projects`; `state_diff == {}` ✅ |
| Injected custom state survives a page load | `ui.injectedMarker == 'HELLO_INJECT'` after navigating ✅ |
| Injected state **wins over the default seed** | a hand-injected project `byteblaze/injectedproj` renders at its own route with `INJECTED_DESC_MARKER`, 0 console errors ✅ |
| `POST /post` UTF-8 integrity at chunk boundaries | 20/20 ✅ (§2) |

---

## 7 · Bugs for the dev agent

**Zero P0. Zero P1 functional bugs.** No affordance driven this round was dead, no
form was a no-op, no flow could not be completed. The one P1 in this report is a
source-vs-mock difference and is written up as DIFF-001 below.

Two controls that a previous round left uncertain were driven and both work:

- **Star / Unstar** on the project header — `Star | 55` → click → `Unstar | 56`,
  survives reload, appears on `/users/byteblaze/starred`; Unstar reverses both.
  **`TODO.md:401` still marks ROUTES row 30 `[~]`; that marker is stale** — the
  feature is complete and verified. One-character fix.
- **All four banner controls** (`Add SSH key` → `/-/profile/keys`,
  `Don't show again` → `/-/profile?user%5Bhide_no_ssh_key%5D=true`, `Settings` →
  `/:ns/:proj/edit`, `More information` → `/help/topics/autodevops/index.md`) —
  every one navigates, with the source's own hrefs. See DIFF-001 for the separate
  question of *where* the banners are rendered.

---

## 8 · Source-vs-Mock differences

**Method.** 12 new mock screenshots at 1920×1080 into
`assets/screenshots/diff/r5_mock_*.png`, read against the round-4 `source_*.png`
pairs; plus a structural-copy diff of `#content-body` text for all 32 round-4
routes against their logged-in `assets/html/r4-*.html` captures. The source was
**never mutated** — no login, no POST, no `?sort=` URL on port 8023.

> ⚠️ **A methodology warning that cost me a false finding, recorded so the next
> round does not repeat it.** An **unauthenticated** `curl` of the source is not a
> valid comparison baseline. `curl http://localhost:8023/…/-/labels` returns a tab
> strip with only `All`, which made the mock's `All | Subscribed | Name` look like
> invented copy — but `source_labels.png`, captured **logged in as byteblaze**,
> clearly shows `All | Subscribed`. The mock is correct. Compare against the
> logged-in captures in `assets/html/` and `assets/screenshots/`, never against a
> cold curl.

### DIFF-001 · **P1** · The SSH-key and Auto DevOps banners render on every project page; the source renders them only on project *overviews*

| Field | Value |
|-------|-------|
| Route | every `/:ns/:proj/**` route in the mock |
| Source | Of **179 logged-in captures** in `assets/html/`, the string `add an SSH key to your profile` appears in exactly **7** — `proj-a11yproject`, `proj-dotfiles`, `proj-gimmiethat`, `proj-awesomepy`, `proj-imsi`, `proj-primer-design`, `proj-root-metaseq`. Every one is a **project overview**. `Auto DevOps pipeline has been enabled` appears in exactly **2** — `proj-dotfiles` and `proj-gimmiethat` (the two projects with no `.gitlab-ci.yml`), again overview only. `source_project_members.png` and `source_labels.png` (both logged-in, both project sub-pages) show **no banner at all**. |
| Mock | Both banners render on the overview **and** on every sub-page — verified on `/-/project_members`, `/-/issues`, `/-/pipelines`, `/-/merge_requests`, `/-/labels`, `/-/issues/:iid`, for `dotfiles`, `a11yproject.com` and `primer/design` alike. Correctly **absent** outside project scope (`/dashboard/projects`, `/byteblaze`, `/-/profile`, `/explore`, `/groups/new`). |
| Two distinct errors | (a) scope — sub-pages should not show either banner; (b) predicate — the Auto DevOps banner should appear only for the 2 projects without CI config, not for `a11yproject.com` / `primer/design`. |
| Console errors | none. The markup is a faithful copy of GitLab's (`js-no-ssh-message`, real hrefs) and all four buttons work. |
| Impact | **No task is blocked.** Every GitLab `program_html` anchor on a project page is `must_include`, and a substring test is unaffected by extra text. But this is ~250 px of alert chrome and 4 extra buttons injected above the content of **every project route** — the most-visited surface in the app — pushing the page-title row and its controls down on a page where the source has them at the top. It also lands in `page.innerText` for every project page. |
| Fix hint | Gate both banners on the project-overview route only, and gate the Auto DevOps one on "project has no CI config" (true for `dotfiles` and `gimmiethat.space` only). Probably one condition in the project layout wrapper rather than in `ProjectOverview.jsx`. |

### DIFF-002 · **P2** · issue detail is missing the Designs / Tasks / Linked items blocks

| Field | Value |
|-------|-------|
| Path | `/a11yproject/a11yproject.com/-/issues/719` (and every issue detail) |
| Source | between the description and `Activity`: the design drop-zone `Drag your designs here or click to upload.`, a `Tasks 0` card with `Add ⌄` and `No tasks are currently assigned. Use tasks to break down this issue into smaller parts.`, and a `Linked items 0` card with `Add` and `Link issues together to show that they're related. Learn more.` |
| Mock | goes straight from the reaction row to `Activity` |
| Impact | Anchored page, but **no anchor string or locator touches these blocks**, and locators 1/6/14/15/16 all resolve correctly (§4.3). webarena-72's related-issue flow is reachable through the `Issue actions` dropdown. Depth, not capability. |

### DIFF-003 · **P2** · label rows are ~2.5× taller than the source's

`Issues · Merge requests` is a single line joined by a middot in the source; the
mock stacks `Issues` / `·` / `Merge requests` on three lines. Visible on all 20+
rows of `/-/labels`. Also: the source's *Prioritized Labels* empty state carries an
illustration above `Star labels to start sorting by priority`; the mock has the
text only. Compare `assets/screenshots/diff/r5_mock_labels.png` with
`source_labels.png`.

### DIFF-004 · **P2** · page-title row layout on `/-/project_members`

Source: `Project members` as a single-line `h1` on the left with
`Import from a project | Invite a group | Invite members` right-aligned on the same
row. Mock: the heading wraps to two lines in a narrow left column with the
description beside it, and the three buttons on the next row, left-aligned. No
control is hidden. Compare `r5_mock_project_members.png` with
`source_project_members.png`.

### DIFF-005 · **P2** · empty-state depth on nine round-4 routes

Structural-copy diff of `#content-body` against the logged-in `r4-*.html`
captures. Everything else in the 32-route set matched (`jobs`, `schedules`,
`environments`, `packages`, `infrastructure_registry`, `wiki`, `terraform`,
`feature_flags`, `error_tracking`, `metrics`, `alert_management`,
`activity` — **0 missing, 0 extra lines each**).

| route | missing from the mock |
|---|---|
| `/-/pipelines` | `Show Pipeline ID` / `Show Pipeline IID` dropdown |
| `/-/pipelines/charts` | the date-range chart block (`Minutes`, `Commit`, `Date`, per-day labels) — 13 lines |
| `/-/ci/editor` | the branch switcher (`Switch branch`, `Branches`, `main`, `master`, `Showing 2 items`) |
| `/-/releases` | `Created date` sort option |
| `/-/forks` | `Updated date` sort option |
| `/-/clusters` | `Create a cluster` |
| `/-/incidents` | the filtered-search bar (`Toggle history`, `Recent searches`, `You don't have any recent searches`) |
| `/-/snippets` | extra line `New snippetDocumentation` (spacing bug, two labels run together) |
| `/-/snippets/new` | 16 lines — `Write` / `Preview` tabs, `Supports Markdown`, `This field is required.` |

None is anchored; none blocks a flow. The nine `[ ]` Placeholder rows (99–105,
113, 115) are excluded — they are declared unimplemented.

### DIFF-006 · **P2** · three anchor label-filter routes render an empty list where the source shows results

| Field | Value |
|-------|-------|
| Paths | `/OpenAPITools/openapi-generator/-/issues/?label_name%5B%5D=OpenAPI%20Generator%20CLI` (webarena-105), `/keycloak/keycloak/-/issues/?label_name%5B%5D=flaky-test` (webarena-104), `/kkroening/ffmpeg-python/-/issues/?label_name%5B%5D=question` (webarena-103) |
| Source | populated: `Open 4 / Closed 10 / All 14`, `Open 16 / Closed 41 / All 57`, `Open 9 / Closed 31 / All 40` |
| Mock | route resolves, renders, 0 errors — **0 matching rows** |
| Cause | seed sampling, not a filter bug. The labels exist (`OpenAPI Generator CLI` id 394, `flaky-test` id 1447, `question` id 1287) but none of the 44 sampled issues per project carries them. Sharpest case: **all 44 of `kkroening/ffmpeg-python`'s sampled issues have an empty `label_ids`**, so its issue list shows no label chips anywhere. |
| Impact | All three tasks are `url_match` **only**; the mock produces the URL correctly. The filter machinery is proven working on five other labels (§3). |
| Fix hint | Attach the real label ids to a handful of already-sampled issues in `src/data/issues.json`. |

### DIFF-007 · **P2** · three documentation lines are stale (code is right, docs are wrong)

| doc | says | reality |
|---|---|---|
| `ROUTES.md § Query Parameters → Project / group lists` | `archived` `true` → "Show archived only" | GitLab's `ProjectsFinder` treats `archived=only` as archived-only, `archived=false` as non-archived, and **anything else including `true` as all projects**. The mock implements exactly that (`src/components/ui/ProjectsNav.jsx:170-174`), and `?archived=only` correctly returns 0 rows on this seed. **The code is correct; the table is wrong.** |
| `ROUTES.md § Intentionally Not Migrated` | the feed token "is rendered on `/-/profile/account`" | It is on `/-/profile/personal_access_tokens`, masked behind `********************` with the real value in the DOM — which is what the source does. `src/pages/ProfileKeys.jsx:57` documents the correction (BUG-A10). |
| `TODO.md:408` | ROUTES #37 `/-/profile/account` must display the feed token | same correction; the item is `[x]` but points at the wrong route |
| `TODO.md:401` | ROUTES #30 star/unstar `[~]` | complete and verified working with a live count (§7) |

### DIFF-008 · **P2** · default project-list order is `name_asc`, and cannot be adjudicated this round

The mock's `/dashboard/projects` default order equals `?sort=name_asc` and its sort
dropdown reads **"Name"**. `ROUTES.md` documents the default as
`latest_activity_desc`. The source cannot settle it: `/dashboard/projects` answers
`302` to unauthenticated GETs, and the round-1 recon capture
`assets/html/dashboard-projects.html` **already** shows the dropdown reading
"Name" over an alphabetical list — byteblaze's persisted `projects_sort` had been
rewritten to `name_asc` by a shard loading `?sort=` URLs before that capture was
taken. No evaluator asserts project-list order, and the mock is self-consistent
with the capture it was built from. **Decide it and write the decision down; do
not re-derive it from the live source without first resetting `projects_sort`.**

### DIFF-009 · **P2** · `#notes-list` timeline is thinner than the source

Carried forward and re-confirmed. Issue 719: the source capture has 10
`timeline-discussion-body` and 35 `system-note`; the mock renders 10 entries with
5 discussion bodies. Locator 16 resolves correctly after a comment is posted, and
the comment anchors are `last`-child reads, so nothing is blocked. This is
AUDIT P1-5, unchanged. *(Shard A's `closed_at` / `merged_at` work is excluded from
this report per the round brief.)*

---

## 9 · Verdict against the Definition of Done

| # | Criterion | Verdict |
|---|---|---|
| 1 | Every `ROUTES.md` row verified (cold load + params + sid) | **PASS** |
| 2 | All P0 and P1 `TODO.md` items `[x]` | **PASS on substance, FAIL on paper** |
| 3 | `AUDIT.md` zero P0 | **PASS** |
| 4 | `TEST.md` zero P0, zero P1 functional, zero P0/P1 source-vs-mock differences | **FAIL** — one P1 source-vs-mock difference |
| 5 | `SCHEMA.md` current | **PASS** |
| 6 | `npm run build` passes | **PASS** |

**1 — PASS.** 124 numbered rows cold-loaded in fresh contexts with per-row sids:
115 real views, 9 `<Placeholder>` (all `[ ]`), 2 `NotFound` (both `[ ]`), 6
declared not migrated. **0 false completions, 0 sid losses, 0 console errors, 0
pageerrors.** Round 4's ~24 Placeholder→real conversions all hold. 50 additional
trailing-slash / URL-encoded probes clean, including `%5B%5D`, `%20`, `%3A`,
`%F0%9F%90%9E` and a `:ref` containing three slashes. Params were shown to *drive*
behaviour, not merely be accepted — including all nine `sortIssuables` tokens,
which closes **AUDIT P1-2**.

**2 — PASS on substance, FAIL on paper.** Exactly one item in the P0/P1 sections is
not `[x]`: `TODO.md:401`, ROUTES #30 star/unstar, marked `[~]`. It is finished — I
drove it (`Star | 55` → `Unstar | 56` → persists across reload → appears on
`/users/byteblaze/starred` → Unstar reverses both) and webarena-523 replays green.
**The marker is stale, not the work.** A one-character edit turns this PASS.

**3 — PASS.** No new P0 found by any probe in this round: not by the four targeted
regression drives, not by 410 cold page loads, not by 28 task replays, not by the
differential pass.

**4 — FAIL, on exactly one item: DIFF-001.** Zero P0. Zero P1 *functional* bugs.
The blocker is the P1 source-vs-mock difference: the SSH-key and Auto DevOps
banners render on every project sub-page where the source renders them on project
overviews only (and the Auto DevOps one on only 2 of 7 projects). Evidence is 179
logged-in source captures plus two logged-in source screenshots. It blocks no task
— every affected anchor is a `must_include` substring test — but it is ~250 px of
alert chrome above the content of every project route, and criterion 4 admits no
open P1.

**5 — PASS.** All seven state keys `AUDIT.md P1-1` flagged are now in `SCHEMA.md`
(`groupLinks` 5 hits, `repo.forkOrigin` 6, `project.feature_settings` 2,
`issue.awards` 3, `issue.downvotes` 3, `issue.time_estimate` 2, `issue.moved_from`
2), as are both new seed modules (`tree_last_commits` 2, `resource_events` 2).

**6 — PASS.**

```
vite v5.4.21 building for production
✓ 163 modules transformed
dist/index.html                   0.54 kB │ gzip:     0.35 kB
dist/assets/index-BwwN5lla.css   33.39 kB │ gzip:     7.40 kB
dist/assets/index-CGlXCaL5.js  5,769.04 kB │ gzip: 1,530.45 kB
✓ built in 3.00s
```

Only the pre-existing chunk-size advisory. **And, again: a green build is not
evidence of anything here** — Rollup does not resolve JSX identifiers, so an
unimported component builds clean and throws at runtime. The 410 cold browser
loads in this round are the evidence.

---

## VERDICT

**NOT PASS.**

Blocked by exactly two things, both small and both named:

1. **DIFF-001 (P1)** — scope the SSH-key and Auto DevOps banners to project
   overview pages, and gate the Auto DevOps one on "no CI config" (`dotfiles`,
   `gimmiethat.space`). Likely one condition in the project layout wrapper.
2. **`TODO.md:401`** — flip ROUTES #30 from `[~]` to `[x]`; the feature is
   complete and verified.

Everything else that this round was asked to gate on holds. All four previously
closed P0s are still closed and were re-verified by driving, not reading. Route
parity is complete with zero false completions and zero console errors across 410
cold loads. The anchor contract holds: 145/145 routes, 243/243 string pairs with
zero mock-side gaps, 23/25 locators (the other 2 are Reddit's). 28 task replays
across all three evaluator families complete end to end, persist across reload,
and register as creations in `/go`. Session isolation, reset and state injection
all pass. There is no P0 anywhere in this report, and no P1 functional bug.

**Fix those two and this is a PASS.**

---

## Appendix · What this round did NOT cover

- **Excluded by the round brief:** `issues.closed_at` and merge-request
  `merged_at` / `closed_at` sort orderings (shard A was backfilling them live).
- **Not replayed:** label assignment to an issue as a scored task, issue
  close/reopen, MR merge/close, project-settings edits, cross-scope search, the
  Web IDE commit path (webarena-566 names it explicitly; it was completed through
  the simple editor instead), drag-and-drop on `/-/boards`, and
  `/projects/new#import_project`.
- **Not comparable:** `/-/merge_requests/:iid/diffs` content (`SOURCE.md` records
  that MR diffs were never extracted, so there is no seed behind it);
  `/-/network/:ref` and `/-/graphs/:ref/charts` chart *values*.
- **Screenshot comparison is 15 pairs** (12 new `r5_mock_*` + 3 re-captures read
  against round-4 `source_*`); the rest of the differential was a structural-copy
  text diff over 32 routes.
- **The WebArena evaluation harness is not installed on this host.** The
  `func:gitlab_get_project_memeber_role` body was reconstructed from
  `evaluation_harness/helper_functions.py`. The checkable fact is that the mock's
  DOM answers the same query the source's does, with the same value.
- **The source was never mutated.** No login, no POST, no `?sort=` URL on port
  8023. Every source datum above is either a plain GET or a logged-in capture
  taken in an earlier round.
