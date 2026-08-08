# DEV round 14 — DIFF-1303 URL form + criterion-5 documentation

> Agent: dev (r14-urlform) · started 2026-08-08
> Scope: DIFF-1303 (P0-in-practice), DOC-1301, DOC-1302, DIFF-1104, DIFF-1106,
> DIFF-1304…1309, NOTE-1301.

## 0 · Status — final

- [x] **DIFF-1303** — closed. 24/24 on the acceptance test (§3).
- [x] **DOC-1302** — `SCHEMA.md` + `assets/data_model.md` + `TODO.md` corrected (§4).
- [x] **DOC-1301** — `ROUTES.md` rows 106 and 107 verified correct (§4).
- [x] **DIFF-1104** — root was already right; the subdirectory view was not (§5).
- [x] **DIFF-1106** — already closed by round 12; re-verified on 7 pickers (§6).
- [x] DIFF-1101, DIFF-1304, DIFF-1306, DIFF-1307, DIFF-1309 (§7)
- [ ] **DIFF-1308** — not fixed; the gating rule is not derivable (§7)
- [ ] **DIFF-1305** — re-priced; the click paths all exist, the seed gap does not
      cost a task, and attaching the labels to sampled issues is left undone (§7)
- [x] NOTE-1301 — confirmed not a bug

## 1 · DIFF-1303 — the spec

The 12 anchored `url_match` tasks and their expected URLs, read out of
`assets/task_anchors.json`:

| task | expected URL |
|---|---|
| webarena-45  | `/a11yproject/a11yproject.com/-/issues/?sort=created_date&state=opened` |
| webarena-46  | `/primer/design/-/issues/?sort=updated_desc&state=opened&first_page_size=20` |
| webarena-102 | `/a11yproject/a11yproject.com/-/issues/?label_name%5B%5D=help%20wanted` |
| webarena-103 | `/kkroening/ffmpeg-python/-/issues/?label_name%5B%5D=question` |
| webarena-104 | `/keycloak/keycloak/-/issues/?label_name%5B%5D=flaky-test` |
| webarena-105 | `/OpenAPITools/openapi-generator/-/issues/?label_name%5B%5D=OpenAPI%20Generator%20CLI` |
| webarena-106 | `/umano/AndroidSlidingUpPanel/-/issues/?state=opened&not%5Blabel_name%5D%5B%5D=BUG` |
| webarena-339 | `/a11yproject/a11yproject.com/-/issues/?label_name%5B%5D=bug` |
| webarena-340 | `/primer/design/-/issues/?label_name%5B%5D=type%3A%20bug%20%F0%9F%90%9E` |
| webarena-341 | `/root/metaseq/-/issues/?label_name%5B%5D=enhancement` |
| webarena-342 | `/root/metaseq/-/issues/?search=OPT%20model&sort=created_asc&state=opened&label_name%5B%5D=question&first_page_size=20` |
| webarena-343 | `/root/metaseq/-/issues/?label_name%5B%5D=None` |

Two properties fall out of the set:

1. **Trailing slash before the `?`** on every project-scoped `/-/issues` URL.
   (`/dashboard/merge_requests?assignee_username=byteblaze` — webarena-156 and
   -357 — has **no** slash, so the slash is project-scoped, not global.)
2. **Escaping is `encodeURIComponent` on both key and value**, not
   `URLSearchParams.toString()`: space is `%20` (not `+`), `[]` is `%5B%5D`,
   `:` is `%3A`, 🐞 is `%F0%9F%90%9E`. That is exactly what GitLab's
   `issuable_item.vue#labelTarget()` emits
   (`?${encodeURIComponent(`${labelFilterParam}[]`)}=${encodeURIComponent(label.title)}`).
3. **Parameter order** is consistent across all 12: `search`, `sort`, `state`,
   filters (`label_name[]`, `not[label_name][]`, …), then the page params
   (`first_page_size`). `sid` is a mock-only addition and rides last.

Extra params in the agent's URL are harmless to `URLEvaluator` (it only checks
`ref_query ⊆ pred_query`), and a *longer* base path is harmless too because the
base-path test is `ref_base_path in pred_base_path` — a substring test. So
emitting the slash form is safe for the non-slash anchors as well, but the mock
follows the anchors exactly rather than relying on that.

## 2 · DIFF-1303 — what changed

New module **`src/utils/issuableUrl.js`** owns the form:

| export | job |
|---|---|
| `issuableListPath(base)` | `/…/-/issues` → `/…/-/issues/`; `/dashboard/…` untouched |
| `encodePairs(pairs)` | `encodeURIComponent(k)=encodeURIComponent(v)` — `%20`, not `+` |
| `issuableListUrl(base, params, overrides, opts)` | canonical order + `state` / `first_page_size` defaults |
| `labelFilterUrl(base, title, param)` | GitLab's `labelTarget()` — one param, whole query replaced |

Call sites moved onto it:

| file | control |
|---|---|
| `src/pages/IssuablesList.jsx` `StateTabs` | Open / Closed / Merged / All tabs |
| `src/pages/IssuablesList.jsx` `FilteredSearchBar` | sort menu, `Sort direction`, search submit |
| `src/pages/IssuablesList.jsx` `IssuableListBody` | `Prev` / `Next`, `Show N items` |
| `src/pages/IssuablesList.jsx` `IssuableRow` | the row's label pills |
| `src/pages/LabelsList.jsx` | each label's `Issues` / `Merge requests` link |
| `src/pages/IssueDetail.jsx`, `MergeRequestDetail.jsx` | sidebar label pills |
| `src/pages/NotesTimeline.jsx` | `added ~label` system-note pills |
| `src/pages/MilestoneDetail.jsx`, `MilestonesList.jsx` | every link into a filtered issue list |

Three defects fell out of the same pass and are fixed with it:

- **The search submit dropped the active filters.** `FilteredSearchBar` used
  `QueryForm`, which rebuilds the URL from the form's own fields — `state`,
  `sort`, `search` — so submitting a search from a label-filtered list threw the
  label away. webarena-342 needs `search`, `sort`, `state`, `label_name[]` and
  `first_page_size` in one URL, so it could not be reached by clicking at all.
  The submit now merges into the live query instead of replacing it.
- **`?label_name=…` without the brackets.** `MilestoneDetail.jsx` (three links)
  and `NotesTimeline.jsx` emitted `label_name=` where `filterIssuables()` reads
  `label_name[]`, so those pills navigated to a list that ignored them.
- **`?sid=` was lost on any href carrying a fragment.** The global link
  interceptor split on `?` before `#`, so `/…/-/issues/12#notes` became
  `…#notes?sid=x`; `parsePath` reads `#` first, so the sid ended up inside the
  hash. `appendSid()` splits the fragment off first.

### The preservation half

`src/App.jsx`'s global link interceptor used to rebuild every href through
`URLSearchParams`, which re-encoded `%20` as `+` and could reorder the query. It
now navigates to the href **verbatim** and appends only `sid=`, via the new
`appendSid()` in `src/utils/RedirectWithQuery.jsx`. `useRawNavigate()` does the
same for the one programmatic caller (the search submit).

Nothing normalises the URL on arrival, so an agent dropped on an anchor URL
keeps it byte-for-byte — including the trailing slash, the `%5B%5D`, the `%20`,
the `%3A` and the `%F0%9F%90%9E`.

## 3 · DIFF-1303 — acceptance run

`/tmp/r14_urlform.py`, chromium at 1280×720 against `npm run dev --port 5331`.
Two phases per task: **preserve** navigates straight to the anchor URL and
compares `page.url` as a string; **emit** drives the mock's own control and
scores the result with WebArena's `URLEvaluator` (`GOLD in PRED`) reimplemented
from its published source.

**24 / 24 PASS · 0 console errors · 0 pageerrors.**

| task | expected (anchor) | mock emits after the click | verdict |
|---|---|---|---|
| webarena-45 | `…/-/issues/?sort=created_date&state=opened` | `…/-/issues/?sort=created_date&state=opened&first_page_size=20` | PASS |
| webarena-46 | `…/-/issues/?sort=updated_desc&state=opened&first_page_size=20` | identical | PASS |
| webarena-102 | `…/-/issues/?label_name%5B%5D=help%20wanted` | identical | PASS |
| webarena-103 | `…/-/issues/?label_name%5B%5D=question` | identical | PASS |
| webarena-104 | `…/-/issues/?label_name%5B%5D=flaky-test` | identical | PASS |
| webarena-105 | `…/-/issues/?label_name%5B%5D=OpenAPI%20Generator%20CLI` | identical | PASS |
| webarena-106 | `…/-/issues/?state=opened&not%5Blabel_name%5D%5B%5D=BUG` | `…&first_page_size=20` | PASS |
| webarena-339 | `…/-/issues/?label_name%5B%5D=bug` | identical | PASS |
| webarena-340 | `…/-/issues/?label_name%5B%5D=type%3A%20bug%20%F0%9F%90%9E` | identical | PASS |
| webarena-341 | `…/-/issues/?label_name%5B%5D=enhancement` | identical | PASS |
| webarena-342 | `…/-/issues/?search=OPT%20model&sort=created_asc&state=opened&label_name%5B%5D=question&first_page_size=20` | identical | PASS |
| webarena-343 | `…/-/issues/?label_name%5B%5D=None` | `…?state=opened&label_name%5B%5D=None&first_page_size=20` | PASS |

Nine of the twelve are byte-identical to the anchor. The other three are strict
supersets by `first_page_size=20` (and `state=opened` on 343), which
`URLEvaluator` ignores — it only requires `ref_query ⊆ pred_query`. That
superset is deliberate and not avoidable: webarena-45 and webarena-46 are the
**same sort control** recorded with and without `first_page_size`, so one of the
two must be a superset, and omitting it would make webarena-46 score 0 outright.

Click paths driven (no direct URL entry in the emit phase):

- **45, 46** — sort menu → `Created date` / `Updated date`.
- **102, 339, 340, 341** — a label pill on an issue row.
- **103, 104, 105** — `/-/labels` → the `Filter` box → the label's `Issues` link.
  (`keycloak` has 87 labels and `openapi-generator` 148, so the anchored label is
  on page 5 / page 8 of a 20-per-page index; the page's own filter reaches it.
  TEST.md DIFF-1305 reports these labels as *undiscoverable* — they are in the
  seed and on `/-/labels`, they are just past page 1. What is genuinely missing
  is a pill on a sampled issue; see §5.)
- **106, 343** — no mock control builds a `not[label_name][]` or a `None` token
  (the source builds them from typed filtered-search tokens, which the mock's
  plain search box does not implement). Driven from the anchor URL through a
  state tab instead, which is what proves the form survives a subsequent click.
- **342** — `/-/labels` → `question` → `Issues` → type `OPT model` → `Search` →
  sort menu `Created date` → `Sort direction`. Four controls, all five params
  present at the end.

## 4 · Criterion 5 — documentation

Both `SCHEMA.md` and `assets/data_model.md` had already been given
`ci_pipelines.json` and the `Static (11)` table between the round-13 report
(03:07) and this round (03:26–03:27), and `ROUTES.md` rows 106 and 107 already
read correctly. What was still wrong, and is now fixed:

| where | was | now |
|---|---|---|
| `SCHEMA.md` "Mutable vs static seed" | `22 JSON modules, ~5.5 MB` | `23 JSON modules, ~6.4 MB` (measured: 6 663 293 B across 23 files) |
| `SCHEMA.md` cold-state figure | `2 076 882 bytes (1.981 MiB)` | `2 069 758 bytes (1.974 MiB)`, with the encoding stated |
| `SCHEMA.md` headroom | `~19 KB` | `~27 KB` |
| `SCHEMA.md` static-module prose | `Seven of the ten` / `The other three` | `Seven of the eleven` / `The other four` |
| `SCHEMA.md` static-module table | the `ci_pipelines.json` row was separated from the table by a blank line, so it rendered as a second one-row table with no header | one table, four rows |
| `assets/data_model.md` §11b | `cold state is 2 076 882 bytes before and after` | `2 069 758 bytes`, plus the explicit `0 bytes in /go` |
| `assets/data_model.md` §14 | `11 modules, ~4.5 MB` | `11 modules, 4 594 506 B / ~4.38 MB` (measured) |
| `TODO.md` note 6 | asserted the current size is `2 076 882` | corrected, with a pointer to the encoding note |

**Where the 7 KB went.** The three figures in circulation are three encodings of
the same state, and no round said which it used:

| measurement | bytes |
|---|---|
| UTF-8, as served and POSTed — **the budget figure** | **2 069 758** |
| `ensure_ascii=True` (every `é`, 🐞 escaped as `\uXXXX`) | 2 076 882 |
| JS `String.length` (UTF-16 code units) | 2 065 872 |

`SCHEMA.md` now states the method inline so the next round does not re-derive
this.

## 5 · DIFF-1104 — file-tree column widths

Measured, not eyeballed: `/tmp/r14_tree.py` reads `getBoundingClientRect` and
`getComputedStyle` off the same three paths on the mock and on the source
(read-only GETs, no `?sort=`), at 1280×720 and 1920×1080.

**Round 12's fix was correct for the repository root and the report's own
measurement was taken there — but the class it added is wrong one level down.**
The source carries `gl-table-layout-fixed` **only at the root**; inside a
directory the `..` row's `colspan="3"` cell makes a fixed layout meaningless and
GitLab drops the class:

| path | source | mock before | mock now |
|---|---|---|---|
| `/byteblaze/dotfiles/-/tree/main` | `fixed` · 319 / 319 / 319 | `fixed` · 319 / 319 / 319 | unchanged ✅ |
| `/byteblaze/a11y-webring.club/-/tree/main` | `fixed` · 319 / 319 / 319 | `fixed` · 319 / 319 / 319 | unchanged ✅ |
| `/byteblaze/dotfiles/-/tree/main/.mackup` | **`auto`** · 216 / 472 / 269 | `fixed` · 319 / 319 / 319 | **`auto`** · 220 / 481 / 255 |

Identical at both viewports. Everything the round-11 report listed as wrong is
now exact on both sides: row height 42, cell padding `10px 16px`, font-size 14,
`.tree-commit-link` `hidden / ellipsis / nowrap / max-width 100%`,
`.tree-item-link` `hidden / ellipsis / nowrap / max-width 82%`, and the two
links' rendered widths agree to the pixel (205 / 226 / 80 / 69 / 76).

Also fixed while in there:

- **`.bordered-box` had no border at all.** The source's `1px solid #dcdcde` +
  `4px` radius was missing, so `.table-holder` was 958 wide with the table filling
  all 958; the source's table is 956 inside a 958 holder. Now matched.
- **The `..` parent row is the source's markup verbatim** — `title="Go to parent
  directory"` on the cell, `class="router-link-active"` and
  `aria-label="Go to parent"` on the link, the link text ` .. ` with its spaces,
  and the trailing slash on the href back to the root.

**Residual, honestly stated:** in the subdirectory view the three columns come out
220 / 481 / 255 against the source's 216 / 472 / 269 — up to 14 px on one column.
Under `table-layout: auto` the widths are content-derived, and the rendered text
is identical on both sides (`.gitkeep | Remove atom config settings | 6 years
ago`), as are font-family, font-weight (700 on the headers), letter-spacing,
padding and the table's own width. I could not localise the remaining delta and
did not want to hard-code a width to paper over it, which is what `auto` exists to
avoid. The structural defect DIFF-1104 opened on — `fixed` where the source is
`auto`, and 182 / 685 / 91 where the source is 319 / 319 / 319 — is closed.

## 6 · DIFF-1106 — sidebar picker second click

**Already closed; re-verified, not taken on trust.** Round 12's `defaultOpen`
works. Driven at 1280×720 on the dev bundle, one click on `Edit` in each block:

| page | block | menu visible after ONE click | options |
|---|---|---|---|
| `/a11yproject/a11yproject.com/-/issues/566` | `.block.assignee` | yes | 50 |
| " | `.block.labels` | yes | 32 |
| " | `.block.milestone` | yes | 5 |
| `/byteblaze/a11y-webring.club/-/merge_requests/40` | `.block.assignee` | yes | 50 |
| " | `.block.reviewer` | yes | 50 |
| " | `.block.labels` | yes | 13 |
| " | `.block.milestone` | yes | 1 |

The search box (`input[data-qa-selector="dropdown_input_field"]`) is visible on
the first click too. Round 13's reproduction used `/-/issues/404`, which is not a
seeded issue on that project — the page it landed on has no sidebar at all.

## 7 · The P2 batch

| id | status | evidence |
|---|---|---|
| **DIFF-1101** · MR commit-header whitespace | ✅ **already closed, re-verified** | source and mock both read `26 Jan, 2023 1 commit` / `22 Jan, 2023 3 commits` on a11y-webring MR 40, and `19 Mar, 2023 1 commit` on `/byteblaze/dotfiles/-/commits/main` |
| **DIFF-1304** · state-tab counters ignore the filter | ✅ **fixed** | new `issuableStateCounts()` in `src/pages/hooks.js` applies every filter except `state`. `/-/issues` → `22 / 34 / 56`; `?label_name[]=bug` → `3 / 12 / 15`; `?label_name[]=help wanted` → `4 / 1 / 5`. The absolute numbers stay below the source's (56 sampled issues vs 610 — the declared sampling), but the counters now move with the filter, which is what the finding was about. Wired on all four lists: `IssuesList`, `MergeRequestsList`, `DashboardIssues`, `DashboardMergeRequests`. |
| **DIFF-1305** · three anchor labels select nothing | ⚠️ **partly re-priced, not fixed** | the labels are **not** undiscoverable: `flaky-test`, `OpenAPI Generator CLI` and `question` are all in `labels.json` and all render on `/-/labels` — they are on pages 5, 8 and 1 of a 20-per-page index and the page's own `Filter` box reaches them. All three tasks are now click-drivable end to end (§3). What is genuinely missing is a pill on a sampled issue, i.e. the filtered list is empty. That is a seed job (pick issues that really carry the label out of the container) and I did not do it — it costs no task, since all nine are `url_match`-only. |
| **DIFF-1306** · ref / short SHA run together | ✅ **fixed** | JSX drops the newline between sibling elements. Row now reads `#1823 github/fork/davepgreene/add-verification-function  4817a445` and `latest Auto DevOps`; before it was `#1823github/…4817a445` and `latestAuto DevOps`. Residual: the source has **two** spaces after `#1823` where the mock has one — an element-boundary artefact of the source's own DOM, not a missing separator. |
| **DIFF-1307** · analytics date range + missing chart | ✅ **fixed** | the date range was already correct (`dateRange()` uses `days * 86400000`, both sides print `01 Aug - 08 Aug`). The two charts' **rendered text** was missing and is now byte-identical to the source on `/byteblaze/a11y-webring.club/-/pipelines/charts`: `Minutes · Commit · 0 0.2 0.4 0.6 0.8 1 · 4817a445` and `Pipelines · Date · 0 1 · 01 August … 08 August · all success`. The ECharts canvases themselves are still not reproduced — an evaluator cannot read a canvas. New helpers `durationTicks`, `countTicks`, `pipelinesPerDay` in `src/utils/ci.js`; counts come from the real `created_at`s. |
| **DIFF-1308** · `Auto DevOps enabled` on every overview | ❌ **not fixed** | the source shows it on 4 of 12 and `project_auto_devops.enabled` is `false` on all 67 rows, so the gating rule is not derivable from the seed and the source side is anonymous. Guessing a rule would make 8 projects right and risk making 4 wrong. Left for a round that can query the instance CI settings. |
| **DIFF-1309** · group-by toggle inert | ✅ **fixed** | `Job dependencies` now regroups: one column per job, headed by that job's stage, instead of one column per stage. New `needsColumns()` in `src/utils/ci.js`. `ci_builds.needs` is empty on all 14 179 rows (no runner ever ran), so every job is a dependency root and the flat layout is the correct degenerate case. Residual: the source orders the columns `build, code_quality, test, container_scanning, nodejs-scan-sast, secret_detection, semgrep-sast` and the mock `build, test, code_quality, container_scanning, nodejs-scan-sast, semgrep-sast, secret_detection`; the source's order is not stage order, id order or alphabetical, and I would be guessing. The control is no longer dead, which was the finding. |
| **NOTE-1301** | not a bug — the mock renders one `<p>`, the production bundle logs nothing, and 0 console errors were seen this round on either bundle |

Two things noticed in passing and **not** fixed, recorded so they are not lost:

- `/byteblaze/dotfiles/-/commits/main` groups one commit under `30 Jan, 2023`
  where the source says `31 Jan, 2023` — a day-boundary/timezone difference in
  the commit grouping, not a whitespace one. Unanchored.
- The navbar's global search input is also `name="search"`, so a bare
  `input[name="search"]` selector hits it before the issue list's filter box.
  That is faithful — the source has the same collision — but it is what made the
  webarena-342 drive look broken at first.

## 8 · Verification summary

All on the toolchain in `WEBARENA_MIGRATION.md §0`; source reads were plain GETs,
no `?sort=` URL was loaded on 8023, and nothing was written to the container.

| check | result |
|---|---|
| DIFF-1303 acceptance (`/tmp/r14_urlform.py`), 12 tasks × preserve + emit | **24 / 24 PASS**, 0 console errors |
| 145 anchor routes, cold, fresh sid (`/tmp/r14_routes.py`) | 0 console errors, 0 pageerrors; 66 "failures" are all routes a task *creates* — 56 projects absent from the seed by design, 5 groups a task creates, 4 files a task creates, 1 legitimate blob→tree redirect |
| `?sid=` survival across in-app clicks (`/tmp/r14_sid.py`) | 15 pages, **68 clicks, 0 sid lost**, 0 console errors |
| production bundle sweep (`/tmp/r14_final.py`), 26 pages × 1280 and 1920 | **0 console errors, 0 pageerrors, 0 horizontal overflow**; nav 0–256 at both widths |
| file-tree geometry, mock vs source, 3 paths × 2 viewports | root exact; subdirectory now `auto` as the source is (§5) |
| CI/CD charts text, mock vs source | byte-identical |
| session isolation · `set` / `set_current` / `reset` · `state_diff` | PASS — two sids independent, diff reports both changed keys, reset restores |
| cold state size on `/go` (preview bundle) | **2 069 758 B / 1.974 MiB** — unchanged, inside budget |
| `npm run build` | PASS — 172 modules, ~3.8 s, only the pre-existing chunk advisory |
| `npm run preview` serves `/go` | PASS |

## 9 · Re-verified on the rebuilt production bundle

Everything above was first driven on the dev server (`--port 5331`) and then
re-run against `npm run preview` on the final build (`--port 5333`):

- DIFF-1303 acceptance: **24 / 24 PASS**, 0 console errors
- 26-page × 2-viewport sweep: **0 console errors, 0 pageerrors, 0 horizontal
  overflow**, nav `0–256` at 1280 and 1920
- `/go?sid=` answers; cold state **2 069 758 B**
- `npm run build`: PASS, 172 modules

## 10 · Files touched

| file | why |
|---|---|
| `src/utils/issuableUrl.js` | **new** — the single place the issue/MR list URL form is built |
| `src/utils/RedirectWithQuery.jsx` | `appendSid()` (textual, fragment-safe) and `useRawNavigate()` |
| `src/App.jsx` | the global link interceptor navigates hrefs verbatim + `sid` |
| `src/pages/IssuablesList.jsx` | state tabs, sort menu, sort direction, search submit, label pills, pagination |
| `src/pages/IssuesList.jsx`, `MergeRequestsList.jsx`, `DashboardIssues.jsx`, `DashboardMergeRequests.jsx` | filtered state-tab counters (DIFF-1304) |
| `src/pages/hooks.js` | `issuableStateCounts()` |
| `src/pages/LabelsList.jsx`, `IssueDetail.jsx`, `MergeRequestDetail.jsx`, `NotesTimeline.jsx`, `MilestoneDetail.jsx`, `MilestonesList.jsx` | label / milestone links into a filtered list |
| `src/pages/RepoTree.jsx` | DIFF-1104 subdirectory layout + the `..` row |
| `src/styles/global.css` | `.bordered-box` border and radius |
| `src/pages/PipelinesCi.jsx`, `src/utils/ci.js` | DIFF-1306, DIFF-1307, DIFF-1309 |
| `SCHEMA.md`, `assets/data_model.md`, `TODO.md`, `ROUTES.md` | criterion 5 (§4) and the URL-form contract |

No file under `src/data/` was touched. No identifier was renamed. No seed was
regenerated. Nothing was written to the WebArena container.
