# webarena_gitlab_mock — Test Report

> Round: **15** (gating round)
> Date: 2026-08-08
> Mock: http://localhost:5341 (dev) · http://localhost:5342 (`npm run preview`, production bundle)
> Source: http://localhost:8023 — **reachable: YES** (anonymous; read-only — no `?sort=` URL loaded on 8023, no POST, no form submit, no login)
> Postgres: read-only `docker exec gitlab gitlab-psql` (SELECT only)
> Tested by: playwright agent
> Previous round archived at `TEST.round13-prev.md`
>
> **Archive note (round 17):** this file is a faithful restoration of round 15's
> `TEST.md`. Round 17 overwrote `TEST.md` before archiving it and restored the
> content here from the copy it had read. Content is unchanged from round 15
> apart from this note.

## 1 · Summary

| Metric | Count |
|--------|-------|
| ROUTES.md rows verified (cold, fresh context, fresh `?sid=`) — **dev bundle** | **153 / 153 clean** |
| …same sweep re-run on the **production** bundle (`npm run preview`) | **153 / 153 clean** |
| Cold deep-link failures · blank pages · pageerrors | **0 · 0 · 0** (both bundles) |
| Console errors — dev bundle | **0** (round 13's one `validateDOMNesting` warning is gone) |
| Console errors — production bundle | **0** |
| `?sid=` lost on load / after an in-app navigation | **0 / 0** |
| Horizontal overflow at 1280×720 | **0 / 153** |
| Anchor routes resolving | **145 / 145** |
| Anchor string pairs (page-bound) | **243** · 5 pristine · 168 on a task-created 404 · 70 mutation post-conditions · **0 wrongly missing** |
| Anchor locators resolving | **25 / 25** live (page, locator) pairs |
| **DIFF-1303 acceptance** — controls driven | **10 / 12** produce an evaluator-passing URL (9/12 byte-exact) |
| **DIFF-1303 acceptance** — anchor URL entered directly | **12 / 12 preserved byte-for-byte, 12 / 12 evaluator-passing** |
| Accepted URL forms (slash / no-slash / `%5B%5D` / literal `[]` / `%20` / `%3A` / 🐞) | **10 / 10** |
| Tasks replayed / completable end to end | **21 / 21** |
| Cold state size (`/go`, minified, `ensure_ascii=False`) | **2 069 758 B = 1.974 MiB** — matches `SCHEMA.md` exactly |
| Session isolation · reset · injection · UTF-8 chunk boundary | **PASS · PASS · PASS · 25/25** |
| `npm run build` | **PASS** — 172 modules, 3.79 s |
| ✅ P0 functional bugs | **0** |
| P1 functional bugs | **0** |
| Source-vs-mock **P0** differences | **0** |
| Source-vs-mock **P1** differences | **1 — DIFF-1501 (new)** |
| Source-vs-mock P2 differences | 3 carried, 6 closed this round |

**Verdict: FAIL on criterion 4, PASS on the other five.** Everything round 14 was
asked to fix is fixed and independently re-verified — DIFF-1303, DOC-1301,
DOC-1302, DIFF-1104, DIFF-1106 — and five carried P2s closed alongside them. The
single blocker is a **new** finding this round (**DIFF-1501**): the
filtered-search token bar on every issue and MR list responds to a click on the
source and does nothing in the mock, and it is the only click path to the anchor
URLs of webarena-106 and webarena-343.

---

## 2 · DIFF-1303 — the round-14 fix, re-run from scratch

Every one of the 12 anchored tasks was driven through the mock's own controls
from its own start URL, **and** separately entered directly at its anchor URL.

| task | control driven | driven URL == anchor **exactly** | `URLEvaluator` on the driven URL | anchor URL **preserved** on direct entry | evaluator on direct entry |
|---|---|---|---|---|---|
| webarena-45 | sidebar `Issues` → sort menu `Created date` | ✗ (extra `&first_page_size=20`) | **1** | ✅ | 1 |
| webarena-46 | sidebar `Issues` → sort menu `Updated date` | ✅ | 1 | ✅ | 1 |
| webarena-102 | issues list → `help wanted` chip on a row | ✅ | 1 | ✅ | 1 |
| webarena-103 | `/-/labels` → the `question` row's `Issues` link | ✅ | 1 | ✅ | 1 |
| webarena-104 | `/-/labels` (page 2) → `flaky-test` | ✅ | 1 | ✅ | 1 |
| webarena-105 | `/-/labels` → `OpenAPI Generator CLI` | ✅ | 1 | ✅ | 1 |
| webarena-106 | — **no click path exists** (DIFF-1501) | ✗ | 0 | ✅ | 1 |
| webarena-339 | issues list → `bug` chip | ✅ | 1 | ✅ | 1 |
| webarena-340 | issues list → `type: bug 🐞` chip | ✅ | 1 | ✅ | 1 |
| webarena-341 | issues list → `enhancement` chip | ✅ | 1 | ✅ | 1 |
| webarena-342 | `question` chip → sort `Created date` → direction toggle → search `OPT model` | ✅ | 1 | ✅ | 1 |
| webarena-343 | — **no click path exists** (DIFF-1501) | ✗ | 0 | ✅ | 1 |

```
exact-on-drive 9/12 · evaluator-on-drive 10/12 · preserved-on-direct 12/12 · evaluator-on-direct 12/12
0 console errors, 0 pageerrors across all 24 drives
```

**The trailing slash is correct on both halves and correctly scoped.** Harvested
from the live DOM: the project MR list emits **23 / 23** control hrefs with the
slash and **0** without; `/dashboard/issues` and `/dashboard/merge_requests` emit
**0** slashed forms of their own paths (their 16 own-path hrefs are all
`…/dashboard/issues?…`), which is what webarena-156 and -357 anchor on. Arriving
on `/-/issues/?…` and clicking a chip no longer strips the slash.

Round 14's claim of "24/24" is confirmed in substance. I score it 10/12 rather
than 12/12 only because I count webarena-106 and -343 as *not driven* — round 14
appears to have counted them as driven by URL entry.

### 2.1 The extra `&first_page_size=20` — checked specifically, as asked

Round 14 claimed the extra param "matches the source". Two facts, both measured:

1. **It is a form GitLab itself emits.** Two of the twelve anchors — recorded off
   the live source by WebArena's own authors — contain it verbatim: webarena-46
   (`?sort=updated_desc&state=opened&first_page_size=20`) and webarena-342
   (`…&label_name%5B%5D=question&first_page_size=20`). The two source captures in
   `assets/html/` taken at exactly those URLs (`issues-primer-updated.html`,
   `issues-metaseq-search.html`) carry `first_page_size=20` five times each; **no
   other issue-list capture in `assets/html/` contains the string at all**.
2. **It cannot break `url_match` either way.** `URLEvaluator` under
   `GOLD in PRED` iterates the *reference* query keys only —
   `for k, vals in ref_queries: query_score *= any(v in pred_query.get(k, []))`.
   Extra keys in the prediction are never penalised. I re-implemented the
   evaluator against `assets/task_anchors.json` and scored every driven URL with
   it: webarena-45 scores **1** despite the extra param.

I could not click the source's own sort control to compare hrefs directly — the
read-only rule forbids loading a `?sort=` URL on 8023 — and I say so rather than
implying I did. What is established is that the param is a real GitLab-emitted
param on this exact page, and that it is inert for the evaluator.

---

## 3 · Route parity — every ROUTES.md row, cold, on both bundles

153 probe URLs covering all 131 numbered rows plus row 127b (rows 24, 34, 42, 68,
77, 85 are declared not-migrated; rows 107a/107b are `[ ]`). Each probe: fresh
browser context, fresh `?sid=`, straight to the deep link with no click-through,
then checked for render, console errors, uncaught pageerrors, `sid` after load,
`sid` after clicking the first visible in-app link, horizontal overflow at
1280×720, and placeholder copy.

```
dev  (5341)  TOTAL 153   CLEAN 153   PROBLEM 0
prod (5342)  TOTAL 153   CLEAN 153   PROBLEM 0
```

| check | dev | production |
|---|---|---|
| cold-load failures | 0 / 153 | 0 / 153 |
| blank pages | 0 / 153 | 0 / 153 |
| uncaught pageerrors | 0 / 153 | 0 / 153 |
| console errors | **0 / 153** | **0 / 153** |
| `sid` dropped on load | 0 / 153 | 0 / 153 |
| `sid` dropped after an in-app navigation | 0 / 153 | 0 / 153 |
| horizontal overflow at 1280×720 | 0 / 153 | 0 / 153 |
| `<Placeholder>` / "has not been implemented yet" | 0 / 153 | 0 / 153 |

Round 13's single dev-only console error (`NOTE-1301`, React
`validateDOMNesting` on `/-/pipelines/charts`) **no longer fires** — the sweep is
clean on the dev bundle too. `/explore/snippets` remains the one short body
(94 chars): GitLab's own `No snippets found` empty state.

### 3.1 Accepted URL forms

All ten forms load, render the correct filtered row set, build the correct
filter token, and **preserve the incoming encoding byte-for-byte** (the mock does
not rewrite `%5B%5D` to `[]` or `%20` to `+`, and does not add or remove the
trailing slash):

| form | rows | token rendered |
|---|---|---|
| `/-/issues?label_name[]=bug` | 3 | `Label = ~bug` |
| `/-/issues/?label_name[]=bug` | 3 | `Label = ~bug` |
| `/-/issues/?label_name%5B%5D=bug` | 3 | `Label = ~bug` |
| `/-/issues/?label_name%5B%5D=help%20wanted` | 4 | `Label = ~help wanted` |
| `/-/issues/?label_name[]=help wanted` | 4 | `Label = ~help wanted` |
| `/primer/design/-/issues/?label_name%5B%5D=type%3A%20bug%20%F0%9F%90%9E` | 2 | `Label = ~type: bug 🐞` |
| `…?label_name[]=type: bug 🐞` (literal) | 2 | `Label = ~type: bug 🐞` |
| `…?state=opened&not%5Blabel_name%5D%5B%5D=BUG` | 20 | `Label != ~BUG` |
| `…?state=opened&not[label_name][]=BUG` (literal) | 20 | `Label != ~BUG` |
| webarena-342's five-param form | 1 | `Label = ~question` |

---

## 4 · The four closed P0s — re-verified this round

| bug | check run this round | result |
|---|---|---|
| **BUG-004** · multi-byte UTF-8 through `/post` | 25 payloads padding `🐞 Ünïcödé — 日本語 «test» ♿️ Erik Linder-Norén 윤보미` to every offset from 65 520 to 65 544 around the 65 536-byte chunk boundary, POSTed and read back through `/go` | **25 / 25 exact round-trips · 0 replacement chars** — still closed |
| **BUG-B01** · case-insensitive project paths | `/byteblaze/DOTFILES`, `/ROOT/metaseq`, `/root/METASEQ`, `/convexegg/ChatGPT`, `/BYTEBLAZE/dotfiles/-/issues`, `/ByteBlaze`, `/users/ByteBlaze` | **7 / 7** canonicalise with `?sid=` intact, 0 404s, 0 console errors — still closed |
| **BUG-001** · members `<td data-label>` | ran the evaluator's own lookup on three projects: `tbody tr` → `td[data-label="Max role"]` | `dotfiles` → `Owner`, `a11yproject` → `Maintainer` / `Developer` / `Owner`, `solarized-prism-theme` → `Guest` / `Owner`; all 8 `data-label`s present on every row — still closed |
| **BUG-A01** · `?sid=` on the sort dropdown | drove the real dropdown on `/dashboard/projects`, `/explore/projects` and `/` → `Name, descending` | all three land on `…?sort=name_desc&sid=r15a01x` — still closed |

---

## 5 · Anchor contract — machine-diffed against round 13

| check | round 13 | **round 15** | delta |
|---|---|---|---|
| anchor routes loaded cold, fresh context + fresh sid | 145 / 145 | **145 / 145** | **0** |
| …load failures · console errors · pageerrors · `sid` losses | 0 · 0 · 0 · 0 | **0 · 0 · 0 · 0** | 0 |
| …rendering the 404 page (all task-created entities) | 65 | **65** | 0 |
| page-bound anchor string pairs | 243 | **243** | 0 |
| …present on the pristine seed | 5 | **5** | 0 |
| …absent because the page is a task-created 404 | 168 | **168** | 0 |
| …absent because they are a mutation post-condition | 70 | **70** | 0 |
| **strings the pristine seed should carry but does not** | 0 | **0** | 0 |
| `program_html` locators resolving | 25 | **25** | 0 |

The five pristine strings are unchanged: `Thank you` on a11yproject MR 1270,
`@Roshanjossey` on MR 1485, `MIT License` on `gimmiethat.space/-/blob/main/LICENSE`,
and the two `404` strings. The 70 post-conditions were re-triaged and §9 drives a
sample of them to appearance. **The anchor contract is bit-for-bit where round 13
left it — round 14's URL-plumbing changes perturbed nothing.**

---

## 6 · Session isolation, reset, injected state, `/go`

| check | result |
|---|---|
| two sids mutated independently via `/post` `set_current` | `r15E` `state_diff` → `{"a": {"old": 1, "new": 2}}`; `r15B` untouched → `{}` — **isolated** |
| `{"action":"reset"}` | `state_diff` → `{}` and `current_state.a` back to `1` — **restored** |
| `{"action":"set"}` custom-state injection with multi-byte content | `/go` echoes `R15 Injected Name 🐞 Ünïcödé` — honoured on first load |
| `/go` top-level keys | `currentUser follows groups issues labels members mergeRequests milestones nextIds notes projects repo snippets stars todos ui users` — **17, no CI key** |
| CI fingerprints in the whole `/go` payload (`ci_pipelines`, `job_specs`, `stage_idx`) | **0 / 3** — the 1 037 KB CI seed still costs mutable state zero bytes |
| cold state size | **2 069 758 B = 1.974 MiB**, byte-identical to `SCHEMA.md`'s figure |
| per-task sids in §9 | 21 independent sids, each with its own `state_diff`, no cross-talk |

A note for a future round so it is not re-chased: POSTing `set_current` to a
**brand-new** sid writes the initial state as well (`writeInitialStateIfMissing`),
so the first `/go` on that sid legitimately reports an empty diff. Mutate twice,
or drive the UI, to see a diff. This is correct behaviour, not a defect.

---

## 7 · Responsive geometry — re-measured against the live source

`getBoundingClientRect()` on **both** sides, same path, same viewport:

| width | page | `#content-body` | `aside.nav-sidebar` | `aside.right-sidebar` | h-scroll | identical |
|---|---|---|---|---|---|---|
| 1280 | a11y-webring MR 40 | 272 – 974 (702) | 0 – 256 | 990 – 1280 | none | ✅ |
| 1600 | a11y-webring MR 40 | 304 – 1262 (958) | 0 – 256 | 1310 – 1600 | none | ✅ |
| 1920 | a11y-webring MR 40 | 464 – 1422 (958) | 0 – 256 | 1630 – 1920 | none | ✅ |
| 1280 | a11yproject issue 1478 | 272 – 974 (702) | 0 – 256 | 990 – 1280 | none | ✅ |
| 1600 | a11yproject issue 1478 | 304 – 1262 (958) | 0 – 256 | 1310 – 1600 | none | ✅ |
| 1920 | a11yproject issue 1478 | 464 – 1422 (958) | 0 – 256 | 1630 – 1920 | none | ✅ |

**6 / 6 measurement sets identical to the source, 0 horizontal overflow.**
webarena-418 and webarena-448 were driven end to end at 1280×720 (§9) and
`.cover-status` / `.profile-header [itemprop="url"]` return `Cruising` and
`egg.tart.com` after a reload.

---

## 8 · Build and bundle

| check | result |
|---|---|
| `npm run build` | **PASS** — `✓ 172 modules transformed · built in 3.79s`; only the pre-existing 500 KB chunk advisory |
| `npm run preview` on the production bundle | serves the state API; `/go?sid=` answers; **full 153-probe route sweep re-run against it, 153/153 clean** |
| bundle | `index-MUEWoFk4.js` 7 429 KB raw / 1 979 KB gzip |

---

## 9 · Task replays — 21 flows driven end to end at 1280×720

Every mutation was performed through the UI (no direct state writes), the
post-condition asserted at its real URL, the page **reloaded**, and `/go?sid=`
read to confirm a **creation** rather than a silent edit to seed data.

| task | flow driven | evaluator | verdict | `state_diff` |
|---|---|---|---|---|
| webarena-44 | `/` → navbar To-Do List | `url_match /dashboard/todos` | ✅ | — (read-only) |
| webarena-357 | `/` → MR counter → `Review requests for you` | `url_match …?reviewer_username=byteblaze` | ✅ | — |
| webarena-259 | `/-/profile/personal_access_tokens` → reveal | `exact_match TMN_bBn9Z48qVbUFZV45` | ✅ in DOM | — |
| webarena-297 | `/yjlou/2019-nCov` → Clone dropdown | `exact_match ssh://…/yjlou/2019-nCov.git` | ✅ `ssh://git@localhost:2222/yjlou/2019-nCov.git` | — |
| webarena-787 | `/dehenne/awesome-visibility/-/graphs/master` | `string_match` contributor + follower count | ✅ renders | — |
| webarena-389 | primer/design MR 450 → comment → reload | `must_include "Thanks, working on reviews"` | ✅ | `notes, mergeRequests, nextIds.note` |
| webarena-393 | empathy-prompts MR 19 → `lgtm` → reload | `exact_match "lgtm"` on `#notes-list` last child `.timeline-discussion-body` | ✅ locator returns exactly `lgtm` | `notes, mergeRequests, nextIds.note` |
| webarena-415 | a11y-webring MR 40 → `@davepgreene` → reload | `exact_match "@davepgreene"` on the same locator | ✅ returns exactly `@davepgreene` | `notes, mergeRequests, nextIds.note` |
| **webarena-806** | MR list → New merge request → source `redesign` → target `feature/markdown-figure-block` → Compare → Create | `program_html .detail-page-description > a.gl-font-monospace [0]/[1]` | ✅ landed `/-/merge_requests/1532`; `[0]='redesign'`, `[1]='feature/markdown-figure-block'` | `mergeRequests, nextIds.mr` — a **creation** |
| **webarena-590** | primer/design milestones → New milestone → title + start + due → Create | `#content-body` + `.block.start_date` | ✅ `product launch`, `Jan 16, 2030`, due `Jan 30, 2030 (Upcoming)` | `milestones, nextIds.milestone` |
| webarena-394 | `/yjlou/2019-nCov` → Fork → namespace `byteblaze` → Fork project | `must_include "2019-nCov"` at `/byteblaze/2019-nCov` | ✅ | `projects, members, nextIds.project, nextIds.member, repo.forkOrigin.byteblaze/2019-nCov` |
| webarena-411 | cloud-to-butt `LICENSE.txt` → Edit → Commit | `must_include "MIT License"` | ✅ on the blob and on `/-/raw/master/LICENSE.txt` | `projects, repo.commitOverlay…, repo.fileOverlay…` |
| webarena-418 | `/-/profile` → status → Update | `exact_match "Cruising"` on `.cover-status` lastChild | ✅ survives reload | `currentUser.status, users` |
| webarena-448 | `/-/profile` → website URL → Update | `exact_match "egg.tart.com"` on `.profile-header [itemprop="url"]` | ✅ | `currentUser.website_url, users` |
| webarena-481 | dotfiles → Invite members → `abisubramanya27` / Guest → reload | `func:gitlab_get_project_memeber_role` → `Guest` | ✅ | `members, nextIds.member` |
| **webarena-523** | star five repos through the Star button → `/users/byteblaze/starred` | `program_html` 5 names | ✅ 5/5 (`AndroidSlidingUpPanel`, `create-react-app`, `ffmpeg-python`, `PHP_XLSXWriter`, `AndroidAsync`) | `projects, stars` |
| webarena-533 | `/convexegg`, `/yjlou` → Follow ×2 | `must_include @convexegg @yjlou` under `.user-profile` | ✅ | `follows, users` |
| webarena-552 | `/-/new/main` → `real_space/urls.txt` + body → Commit | `must_include` the 5 URLs at `/-/raw/main/real_space/urls.txt` | ✅ | `repo.treeOverlay…`, `repo.fileOverlay…real_space/urls.txt`, `repo.commitOverlay…` — a **creation** |
| webarena-556 | `/projects/new` → blank project `nolan_honest_fans` → new `README.md` | `must_include` 12 film titles at `/-/raw/main/README.md` | ✅ 12/12 | `projects, nextIds.project, repo.branchOverlay…, repo.fileOverlay…` |
| webarena-799 | `/groups/new` → `n-lab` → group members → invite ×4 | `must_include @patou @egpast @westurner @jontutcher` | ✅ 4/4 | `groups, members, nextIds.group, nextIds.member` |
| webarena-808 | cloud-to-butt → New issue → title + assignee + due date → Create → reload | `url_match /-/issues` + 3 locators | ✅ landed `/-/issues/1`; `title_content` exact, `[data-testid="sidebar-due-date"]` = `Mar 31, 2033`, `.block.assignee` = `Byte Blaze` | `issues, nextIds.issue` |

**21 / 21 completable end to end. 0 console errors and 0 pageerrors across every
replay.**

Three flows need a specific technique that a first pass mis-reads as a dead
control; all three complete, and all three match how GitLab's own controls work.
Recorded so a later round does not report them as bugs:

- The **new-MR branch pickers** are dropdowns with a type-to-filter input, not
  `<select>`s. On a repo with ~30 branches the wanted branch is below the fold
  until you type into the dropdown's search box — exactly GitLab's behaviour.
  The target picker's toggle shows the default branch (`main`), not
  `Select target branch`, because the target defaults to the default branch.
- The **new-issue assignee** picker's toggle reads `Unassigned`; clicking it
  opens a scoped `.dropdown-menu` containing `Byte Blaze @byteblaze`.
- The **comment submit** button is `form.common-note-form button[type=submit].btn-confirm`.
  A naive `button:has-text("Comment")` matches the hidden `Show comments only`
  item inside the sort dropdown first and times out. My first pass made exactly
  this mistake and recorded three false failures; re-driven with the right
  selector all three pass, including the two `exact_match` locators.

---

## 10 · Independent hunt — where no previous round looked

Six probes no earlier round ran:

1. **Does the filtered-search token bar respond to a click, as the source's
   does?** → **DIFF-1501 (P1)**, §12.
2. **Do the `/dashboard/*` lists wrongly inherit the new trailing slash?** No —
   0 violations across 16 own-path hrefs on each of the two dashboards. Round 14
   scoped the change correctly.
3. **Do all 17 issue sort tokens actually reorder, or do 8 fall through?**
   (AUDIT `P1-2` asserts they fall through.) Driven on
   `a11yproject.com` `state=all`: **8 distinct orderings from 17 tokens**, and
   every collapse is provably faithful. Queried the source DB to check:
   `closed_at` is NULL on **610 / 610** a11yproject issues and on **80 961 /
   80 962** instance-wide, `due_date` is set on **3** issues instance-wide,
   `relative_position` on **31**, and `label_priorities` is empty. Those keys tie
   for every sampled row, so GitLab would produce the same order. **AUDIT P1-2 is
   stale and should be closed** — `src/pages/hooks.js` now implements every
   token, including GitLab's three-tier milestone null shape.
4. **Is the repo-tree seed truncated in a way the UI exposes?** Yes, and it is
   **declared**, so not a finding: `assets/data_model.md` states *"Full recursive
   tree for all 12 `byteblaze/*` projects; two levels for the deep set; root
   level only for the rest."* `/a11yproject/a11yproject.com/-/tree/main/src`
   therefore shows 33 of the source's 58 entries (all 13 sub-directories are
   depth-2 and absent), and `/src/_data` renders an empty directory. Neither is
   reachable by clicking. See §12 NOTE-1501 for the one behavioural aspect worth
   recording.
5. **Are there quoted or escaped paths anywhere in the seed?** `repo_trees.json`
   (173 projects, 3 131 entries) and `repo_files.json`: **0** paths containing a
   quote or backslash. Round 10's finding stays closed.
6. **Does `/go`'s diff behave on a fresh sid?** It reports empty, correctly —
   see the §6 note.

---

## 11 · Source-vs-mock — closed this round

Re-measured against the live source; all six now match.

| id | round 13 | **round 15** |
|---|---|---|
| **DIFF-1104** · file-tree column widths | mock `182 / 685 / 91` vs source `319 / 319 / 319`; `.tree-commit-link` `visible / clip / normal / none` vs `hidden / ellipsis / nowrap / 100%` | **CLOSED.** `/byteblaze/dotfiles/-/tree/main` and `/a11yproject/a11yproject.com/-/tree/main`: **`319 / 319 / 319` on both sides**, and `.tree-commit-link` computed style is `hidden / ellipsis / nowrap / 100%` on both. Sub-directory views differ by 4–12 px purely because `table-layout` is content-derived and the seeded row sets differ (§10 probe 4). |
| **DIFF-1106** · sidebar picker needed a second click | `Edit` → `.dropdown-menu-toggle` → list | **CLOSED.** One `Edit` click on `/a11yproject/a11yproject.com/-/issues/1478` makes `.block.assignee .dropdown-menu` visible. |
| **DIFF-1101** · MR commit-header whitespace | mock `26 Jan, 20231 commit` | **CLOSED.** Mock and source both read `26 Jan, 2023 1 commit` / `22 Jan, 2023 3 commits`, and `06 Jun, 2021 1 commit` … on a11yproject MR 1270. |
| **DIFF-1103** · settings `<title>` | mock `Repository Settings · …` | **CLOSED.** All three now byte-identical to the source captures: `Repository · Settings · Byte Blaze / dotfiles · GitLab`, `CI/CD Settings · CI/CD · Settings · …`, `General · Settings · …`. |
| **DIFF-1306** · pipelines-list ref/SHA spacing | mock `…function9c06ccbb` | **CLOSED.** Mock `#1823 github/fork/davepgreene/add-verification-function  4817a445`; the source is the same modulo one trailing space. Reproduced on `/root/metaseq/-/pipelines` too. |
| **DIFF-1304** · state-tab counters ignored the filter | mock printed 22/34/56 under every filter | **CLOSED.** Counters now recompute: `(none)` 22/34/56 → `label_name[]=bug` 3/12/15 → `label_name[]=help wanted` 4/1/5. The absolute gap against the source (40/570/610) is the declared issue sampling, not a defect. |
| **DIFF-1307** · analytics date range + missing chart | mock `02 Aug - 08 Aug`, second chart absent | **CLOSED.** `#content-body` `innerText` is **byte-identical** to the source on `/a11yproject/a11yproject.com/-/pipelines/charts`, including `Date range: 01 Aug - 08 Aug`, both charts' axis labels (`Minutes`/`Commit`, `Pipelines`/`Date`), the `01 August … 08 August` ticks and the `all` / `success` legend. |
| **NOTE-1301** · dev-only `validateDOMNesting` | 1 console error in the dev sweep | **GONE** — 0 console errors on both bundles. |

### Re-verified as *not* differences

- **DIFF-001 banner gating** — the dismissible `Auto DevOps will automatically
  build…` banner is absent on **both** sides across all 12 sampled projects.
- **MR commits tab** (round 10) — a11y-webring MR 40: badge `4`, 4 commits both
  sides. primer/design MR 450: badge `5`, 5 commits both sides.
- **Tree ordering** — root trees on `dotfiles` (39 entries) and `a11yproject.com`
  (23 entries) are in **identical order** to the source, directories first.
- **Quoted / escaped seed paths** — 0 across 3 131 tree entries and all file maps.
- **CI/CD views** (round 12) — 9 view/project pairs re-driven on both sides:
  `a11y-webring.club` 1 pipeline / 7 jobs, `a11yproject.com` 7 / 49,
  `root/metaseq` 11 / 66 — **counts identical on every one**, and the three
  analytics pages agree on `Total:`, `Successful:`, `Failed:` and `Success ratio:`.

---

## 12 · Source-vs-mock differences — open

### DIFF-1501 · **P1** · The filtered-search token bar does not open its suggestion list

| Field | Value |
|-------|-------|
| Paths | every issue and MR list: `/:ns/:proj/-/issues`, `/-/merge_requests`, `/dashboard/issues`, `/dashboard/merge_requests` |
| Element | `input[data-testid="filtered-search-term-input"]` (`Search or filter results...`) |
| Action | click the input, then type |
| **Source** | clicking opens `div.dropdown-menu.gl-filtered-search-suggestion-list` with **7 visible entries** — `Assignee`, `Author`, `Label`, `Milestone`, `Release`, `Search Within`, `Type`. Typing `lab` narrows it to `Label`; picking a filter then offers `=` / `!=` and a value list including `None` / `Any`. Measured on `http://localhost:8023/root/metaseq/-/issues`: element count 1 164 → 1 177 after typing. |
| **Mock** | clicking produces **no visible dropdown at all** (0 visible suggestion elements before and after typing; DOM element count unchanged at 1 133). The input does accept free text, and Enter submits it as `search=…`, which works — webarena-342 passes through it. |
| Impact | **webarena-106** (`not[label_name][]=BUG`) and **webarena-343** (`label_name[]=None`) have **no click path in the mock**. Confirmed by source read: nothing in `src/` emits either param — `labelFilterUrl()` is only ever called with `label_name`, from the label chips, `LabelsList.jsx`, `IssueDetail.jsx` and `MergeRequestDetail.jsx`. The same gap removes the click path to the project-scoped assignee / author / milestone / type filters. |
| Not P0 | both tasks are `url_match`, and both anchor URLs work perfectly by direct entry: they load, render the correct filtered rows (20 rows for the `!= BUG` filter), keep `?sid=`, and are preserved byte-for-byte (§2). An agent that navigates by URL scores 1. |
| Priced P1, honestly | it costs **zero task passes**. It is P1 because a visible affordance on the busiest list in the app responds on the source and does nothing in the mock, and because it is the only click path to two anchored URLs. |
| Fix hint | `FilteredSearchBar` in `src/pages/IssuablesList.jsx` already renders applied tokens (`Tokens`) and already knows every param it needs. What is missing is the input's suggestion list: on focus render the 7 source entries, on pick render the `=` / `!=` operator step, then a value list (project labels + `None` + `Any` for `Label`, project members for `Assignee`/`Author`, project milestones for `Milestone`). On submit, route through `issuableListUrl()` with `label_name[]` or `not[label_name][]` — which already produces the correct slashed, `encodeURIComponent`-escaped form. |

### DIFF-1305 · **P2** · Three anchor label filters select zero rows

| project | label | source rows | mock rows |
|---|---|---|---|
| `OpenAPITools/openapi-generator` | `OpenAPI Generator CLI` | 4 | **0** |
| `keycloak/keycloak` | `flaky-test` | 16 | **0** |
| `kkroening/ffmpeg-python` | `question` | 9 | **0** |
| `root/metaseq` | `enhancement` | 20 | 6 |

All are `url_match`-only tasks, and the URL resolves, so no evaluator fails.
**Improved since round 13** in one respect: all three labels are now reachable by
clicking (the project `/-/labels` page lists them and its `Issues` link builds the
anchor URL — that is how webarena-103/104/105 were driven in §2), so the click
path exists; the result list is simply empty. Fixing it is a seed job: make at
least one sampled issue per project carry the anchored label.

### DIFF-1308 · **P2** · `Auto DevOps enabled` quick link on every project overview

Re-measured on the same 12 projects. Source shows it on **4** (`byteblaze/dotfiles`,
`yjlou/2019-nCov`, `byteblaze/cloud-to-butt`, `byteblaze/timeit`) and hides it on
the other 8; the mock renders it on **12 / 12** (`ProjectOverview.jsx:240`, added
unconditionally). No anchor or task reads it. Unchanged from round 13.

### DIFF-1309 · **P2** · Pipeline-detail `Stage` / `Job dependencies` toggle is inert

Re-measured on `/byteblaze/a11y-webring.club/-/pipelines/1823`: both buttons
render and are clickable; clicking leaves `document.body.innerText` byte-identical.
The source regroups the pipeline graph. All jobs are listed either way, so nothing
is hidden. Unchanged from round 13.

### NOTE-1501 · A tree path with no seeded children renders an empty listing where the source redirects

`/byteblaze/dotfiles/-/tree/main/todo` (a path that does not exist in the source
either) → the **source 302s to `/-/tree/main`** and shows the repo root; the mock
stays on the URL and renders a `..`-only table. Same class as AUDIT `P2-5` for
blobs. `/a11yproject/a11yproject.com/-/tree/main/src/_data` behaves the same way
because depth-2 entries are outside the declared tree sample. Neither path is
linked from anywhere in the mock, no anchor uses one, and no task navigates to
one — recorded, not priced.

### Carried, unchanged, and previously accepted

| id | status |
|---|---|
| DIFF-1102 · role-badge chip styling | unverifiable from an anonymous source; round 11's text-identity finding stands |
| Blob syntax highlighting | accepted P2 (TODO.md) |
| DIFF-906 attachment dropzone · DIFF-907 GPG badge / file icons | deferred by agreement |

---

## 13 · Bugs for the dev agent

### Functional bugs

**None.** No P0 and no P1 **functional** bug was found this round. All four
historical P0s re-verified closed (§4).

### Handbacks

| id | priority | what | where |
|---|---|---|---|
| **DIFF-1501** | **P1** | the filtered-search token bar opens a 7-entry suggestion list on the source and nothing in the mock; it is the only click path to webarena-106's `not[label_name][]` and webarena-343's `label_name[]=None` | §12 |
| DIFF-1305 | P2 | three anchor label filters select zero rows (no sampled issue carries the label) | §12 |
| DIFF-1308 | P2 | `Auto DevOps enabled` quick link rendered on 12/12 project overviews (source: 4/12) | §12 |
| DIFF-1309 | P2 | pipeline-detail `Stage` / `Job dependencies` group-by toggle is inert | §12 |
| DIFF-1102 | P2 | role-badge chip styling — unverifiable anonymously | §12 |
| AUDIT `P1-2` | — | **stale, please close.** `sortIssuables` implements all 17 tokens; the 8 that collapse do so because the source's own columns are NULL (§10 probe 3) | `AUDIT.md` |

---

## 14 · Round history

### Round 13 → Round 15

| finding | status |
|---|---|
| **DIFF-1303 · P1** · filter controls emitted the slashless form and stripped an incoming slash | ✅ **FIXED and independently re-verified.** 12/12 anchor URLs preserved byte-for-byte on direct entry; 10/12 driven controls produce an evaluator-passing URL; project lists emit 23/23 slashed hrefs and the dashboards 0/16 — the scoping is right |
| **DOC-1301** · `ROUTES.md` row 106 | ✅ **FIXED** — row 106 now describes the populated CI/CD surface with the round-12 correction note, row 107 carries its own note |
| **DOC-1302** · `SCHEMA.md` missing `ci_pipelines.json` | ✅ **FIXED** — module table reads **Static (11)**, `ci_pipelines.json` documented with its size and readers, cold-state figure `2 069 758` re-measured and **exactly matches my measurement** |
| **DIFF-1104** · file-tree column widths | ✅ **FIXED** — 319/319/319 and identical `.tree-commit-link` computed style on both sides |
| **DIFF-1106** · sidebar picker second click | ✅ **FIXED** — one click |
| DIFF-1101 · MR commit-header whitespace | ✅ **FIXED** |
| DIFF-1103 · settings `<title>` | ✅ **FIXED** — byte-identical to the captures |
| DIFF-1304 · state-tab counters | ✅ **FIXED** |
| DIFF-1306 · pipelines ref/SHA spacing | ✅ **FIXED** |
| DIFF-1307 · analytics date range + charts | ✅ **FIXED** — `#content-body` byte-identical |
| NOTE-1301 · dev-only React warning | ✅ gone |
| DIFF-1305 / 1308 / 1309 / 1102 | ❌ still open (all P2) |
| BUG-001 / 004 / A01 / B01 | ✅ all still closed |
| 145 anchor routes · 243 string pairs · 25 locators | ✅ identical partition, zero drift |
| — | **NEW: DIFF-1501 (P1); NOTE-1501** |

---

## 15 · Gating criteria

| # | criterion | verdict | evidence |
|---|---|---|---|
| 1 | Every `ROUTES.md` row verified (cold load + params + sid) | **PASS** | §3 — 153 probes covering all 131 rows + 127b, run on **both** the dev and the production bundle: 153/153 clean each. 0 cold-load failures, 0 pageerrors, 0 console errors, 0 sid losses, 0 overflow, 0 placeholders. Params: §3.1, 10/10 URL forms honoured and preserved |
| 2 | All P0 and P1 `TODO.md` items `[x]` | **PASS** | 3 items remain open, none P0/P1: blob syntax highlighting (accepted P2), the `assets/data_model.md §14` checklist (`[~]`, process), and the seed-size budget note (P2, explicitly not a blocker) |
| 3 | `AUDIT.md` zero P0 | **PASS** | `AUDIT.md` §1 records **P0: none**; nothing found this round is a P0. (Its `P1-2` is stale — §10 probe 3 — but the criterion is P0) |
| 4 | `TEST.md` zero P0, zero P1 functional, zero P0/P1 source-vs-mock differences | **FAIL** | zero P0 ✅, zero P1 functional ✅, zero P0 source-diff ✅ — but **one P1 source-vs-mock difference: DIFF-1501** |
| 5 | `SCHEMA.md` current | **PASS** | `ci_pipelines.json` documented (size, readers, `assets/data_model.md §11b` cross-reference); module table reads **Static (11)** and lists eleven; the cold-state figure `2 069 758 B` matches my own `/go` measurement **byte for byte**; all seven state keys AUDIT `P1-1` flagged (`groupLinks`, `repo.forkOrigin`, `feature_settings`, `awards`, `downvotes`, `time_estimate`, `moved_from`) plus the three repo overlays are present |
| 6 | `npm run build` passes | **PASS** | `✓ 172 modules transformed · built in 3.79s`, only the pre-existing chunk-size advisory; and the production bundle it emits passes the full 153-probe sweep |

**Overall: FAIL, one criterion short, on one new P1.**

Round 14's work is fully vindicated and then some: both criteria it was handed
are closed, and five carried P2s closed with them. DIFF-1303's fix is correct in
both directions and correctly scoped — the anchor URL survives direct entry
byte-for-byte on all twelve tasks, and the dashboards did not inherit the slash.
The extra `first_page_size=20` is a real GitLab-emitted param and is provably
inert under `URLEvaluator`. Nothing regressed: 153/153 routes cold on **both**
bundles with zero console errors, the anchor contract is bit-for-bit where round
13 left it, 21/21 replayed tasks complete, the responsive geometry matches the
source at three widths, state is 1.974 MiB and isolation/reset/injection all work.

The one blocker is new, and it is the kind of thing that only shows up when you
click a control instead of loading a URL: **the filtered-search token bar is
inert**. It costs zero task passes today — both affected tasks pass by URL — but
it is a visible affordance that responds on the source and not in the mock, and
it is the sole click path to two anchored URLs. That is a P1 by the rubric and I
am not rounding it down.
