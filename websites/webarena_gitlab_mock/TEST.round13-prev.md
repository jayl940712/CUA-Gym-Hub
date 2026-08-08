# webarena_gitlab_mock — Test Report

> Round: **13** (gating round)
> Date: 2026-08-08
> Mock: http://localhost:5321 (dev) · http://localhost:5322 (`npm run preview`, production bundle)
> Source: http://localhost:8023 — **reachable: YES** (anonymous; read-only, no `?sort=` loaded, no POST)
> Postgres: reachable read-only via `docker exec gitlab gitlab-psql` (SELECT only)
> Tested by: playwright agent
> Previous round archived at `TEST.round11-prev.md`

## 1 · Summary

| Metric | Count |
|--------|-------|
| ROUTES.md rows verified (cold, fresh sid, fresh context) | **131 + 127b / 131 + 127b** (153 probe URLs) |
| Cold deep-link failures | **0** |
| `?sid=` lost on load | **0** |
| `?sid=` lost after an in-app navigation | **0** |
| Console errors / pageerrors on the **production** bundle | **0** |
| Console errors on the **dev** bundle | **1** (React dev-only `validateDOMNesting`, see NOTE-1301) |
| Horizontal overflow at 1280×720 | **0 / 153** |
| Anchor routes resolving | **145 / 145** |
| Anchor strings — page-bound pairs | **243** · 5 present pristine · 168 on a page a task creates · 70 mutation post-conditions · **0 wrongly missing** |
| Anchor locators resolving | **25 / 25** live (page, locator) pairs |
| CI seed vs source Postgres — pipelines | **1 465 / 1 465** field-for-field |
| CI seed vs source Postgres — jobs | **14 179 / 14 179** field-for-field |
| CI views vs live source (per project) | **14 / 14** comparable projects exact |
| Tasks replayed / completable | **23 / 22** (webarena-105 completable only by direct URL entry — DIFF-1303) |
| Cold state size (`/go`, minified, `ensure_ascii=False`) | **1 974 KiB** — unchanged from round 11, inside budget |
| `ci_pipelines.json` bytes in state / `/go` | **0** |
| Session isolation · reset · injection · UTF-8 chunk boundary | **PASS · PASS · PASS · 25/25** |
| `npm run build` | **PASS** (171 modules, 3.85 s) |
| ✅ P0 functional bugs | **0** |
| ✅ P1 functional bugs | **0** |
| Source-vs-mock **P0** differences | **0** |
| Source-vs-mock **P1** differences | **1** — DIFF-1303 |
| Source-vs-mock P2 differences / notes | 6 new + 5 carried |
| Documentation defects | 2 — `ROUTES.md` row 106, `SCHEMA.md` static-module table |

**Verdict: FAIL on two of six gating criteria.** §15 has the breakdown. Round 12's
CI/CD work itself is correct — verified against Postgres row by row and against
the live source view by view — but it shipped without updating `ROUTES.md` row
106 or `SCHEMA.md`, and an independent probe this round turned up a P1
source-vs-mock URL difference (DIFF-1303) that no previous round had looked for.

---

## 2 · Round 12 · DIFF-1105 — verified end to end, not taken on trust

### 2.1 The compaction is lossless — proven against Postgres, row by row

`src/data/ci_pipelines.json` was decoded in full (`job_specs` dictionary expanded,
job tuples re-inflated from their millisecond offsets against each pipeline's own
`created_at`) and compared field-for-field against a fresh `SELECT` from the
container.

```
pipelines compared: 1465   errors: 0
jobs      compared: 14179  errors: 0
```

| axis | checked | mismatches |
|---|---|---|
| projects carrying pipelines | 67 seed / 67 DB, **key sets identical** | 0 |
| per-project pipeline and job counts | 67 × 2 | **0** |
| pipeline `id`, `iid`, `ref`, `sha`, `status`, `source`, `duration` | 1 465 × 7 | **0** |
| pipeline `created_at` / `started_at` / `finished_at` (to the millisecond) | 1 465 × 3 | **0** |
| job `id`, `name`, `stage`, `stage_idx`, `allow_failure`, `status` | 14 179 × 6 | **0** |
| job `created_at` / `finished_at` re-derived from the ms offsets | 14 179 × 2 | **0** |

Totals reconcile exactly: **1 465 pipelines · 14 179 jobs · 67 projects**, and the
108 seeded projects with no CI rows have no entry in the seed at all. `source`
decodes `1 → push` / `10 → merge_request_event` correctly. `ci_builds.started_at`
is NULL on all 14 179 source rows, so dropping it loses nothing.

### 2.2 Populated exactly where the source is populated, empty exactly where it is empty

15 projects driven on **both** sides at 1920×1080 — pipelines list, jobs list and
CI/CD analytics. 14 are comparable; the 15th (`byteblaze/accessible-html-content-patterns`)
is `visibility_level = 0` in the source DB, so the anonymous source session gets a
302 to the login page and there is nothing to compare — it has no `ci_pipelines`
rows either, so the mock's empty state is right.

| project | pipelines `All` src / mock | jobs `All` src / mock | analytics src / mock |
|---|---|---|---|
| `byteblaze/a11y-webring.club` | 1 / 1 | 7 / 7 | identical |
| `a11yproject/a11yproject.com` | 7 / 7 | 49 / 49 | identical |
| `primer/design` | 3 / 3 | 21 / 21 | identical |
| `byteblaze/empathy-prompts` | 2 / 2 | 14 / 14 | identical |
| `root/metaseq` | 11 / 11 | 66 / 66 | identical |
| `gulpjs/gulp` | 3 / 3 | 21 / 21 | identical |
| `abisubramanya27/ChAII-docker` | 1 / 1 | 5 / 5 | identical |
| `torquebox/jruby-maven-plugins` | 1 / 1 | 8 / 8 | identical |
| `OpenAPITools/openapi-generator` | 389 / 389 | `1,000+` / `1,000+` | identical |
| `keycloak/keycloak` | 231 / 231 | `1,000+` / `1,000+` | identical |
| `vinta/awesome-python` | 195 / 195 | `1,000+` / `1,000+` | identical |
| `firstcontributions/first-contributions` | 2 / 2 | **0 / 0** | identical |
| `byteblaze/dotfiles` | **0 / 0** | **0 / 0** | identical |
| `byteblaze/cloud-to-butt` | **0 / 0** | **0 / 0** | identical |

**No over-population and no under-population.** The two zero-pipeline projects and
the one zero-job-but-two-pipeline project (`first-contributions`, whose pipelines
died on a yaml error) all read the same on both sides.

### 2.3 The success ratio is computed, not hardcoded

Analytics strings compared verbatim, source vs mock:

| project | `Total:` | `Successful:` | `Failed:` | `Success ratio:` |
|---|---|---|---|---|
| `a11y-webring.club` | `1 pipeline` | `0 pipelines` | `1 pipeline` | **`0.00%`** ✅ both |
| `a11yproject.com` | `7 pipelines` | `0 pipelines` | `7 pipelines` | `0.00%` ✅ both |
| `keycloak/keycloak` | `231 pipelines` | `0 pipelines` | **`227 pipelines`** | `0.00%` ✅ both |
| `openapi-generator` | `389 pipelines` | `0 pipelines` | `389 pipelines` | `0.00%` ✅ both |
| `byteblaze/dotfiles` | `0 pipelines` | `0 pipelines` | `0 pipelines` | **`100.00%`** ✅ both |

`keycloak` is the discriminating case: 231 pipelines of which only 227 are
`failed` (4 are `skipped`), and the mock prints `227 pipelines` in the `Failed:`
slot — a hardcoded or naive `total - successful` implementation would print 231.
The `100.00%` on zero-pipeline projects is GitLab's own divide-by-zero fallback and
is reproduced only there. Singular/plural (`1 pipeline` vs `7 pipelines`) matches.

### 2.4 `/-/pipelines/:id` returns a real page, and is scoped to its project

9 pipeline detail pages driven on both sides. Every one: source **200**, mock
renders the pipeline (no 404), with identical counters and identical job sets.

| project | pipeline | `Jobs` src/mock | `Failed Jobs` src/mock | job-name set |
|---|---|---|---|---|
| `byteblaze/a11y-webring.club` | 1823 | 7 / 7 | 3 / 3 | identical (7) |
| `a11yproject/a11yproject.com` | 1820 | 7 / 7 | 3 / 3 | identical (7) |
| `root/metaseq` | 21 | 6 / 6 | 3 / 3 | identical (6) |
| `primer/design` | 1828 | 7 / 7 | 3 / 3 | identical (7) |
| `byteblaze/empathy-prompts` | 1825 | 7 / 7 | 3 / 3 | identical (7) |
| `OpenAPITools/openapi-generator` | 789 | **14 / 14** | 4 / 4 | identical (all 14 names) |
| `keycloak/keycloak` | 1809 | 11 / 11 | 3 / 3 | identical (11) |
| `gulpjs/gulp` | 1378 | 7 / 7 | 3 / 3 | identical (7) |
| `firstcontributions/first-contributions` | 1822 | — / — | — / — | **0 jobs both sides** |

Negative cases behave: `/byteblaze/dotfiles/-/pipelines/1823` (a real pipeline id
belonging to a *different* project) and `/byteblaze/a11y-webring.club/-/pipelines/999999`
both render the mock's 404 — the id is scoped to the project, not global. Five
pipeline ids I picked from the wrong project during the first pass 404'd on the
**source** too, and the mock 404'd identically on all five.

**0 console errors and 0 pageerrors across every CI page, on the production bundle.**

### 2.5 List rows, page sizes and the pager — exact, including the sliding window

`/OpenAPITools/openapi-generator/-/pipelines` driven on both sides at pages
**1, 2, 6, 13 and 26** (389 pipelines → 26 pages):

| page | source pager | mock pager | rows | first three iids |
|---|---|---|---|---|
| 1 | `Prev 1 2 3 4 5 … 26 Next` | identical | 15 / 15 | `#789 #788 #787` both |
| 2 | `Prev 1 2 3 4 5 6 … 26 Next` | identical | 15 / 15 | `#774 #773 #772` both |
| 6 | `Prev 1 2 3 4 5 6 7 8 9 10 … 26 Next` | identical | 15 / 15 | `#714 #713 #712` both |
| 13 | `Prev 1 … 9 10 11 12 13 14 15 16 17 … 26 Next` | identical | 15 / 15 | `#609 #608 #607` both |
| 26 | `Prev 1 … 22 23 24 25 26 Next` | identical | **14 / 14** | `#1421 #413 #412` both |

Page size 15 for pipelines, 30 for jobs with no pager, and the `1,000+` count cap
all match the source. Row content matches verbatim — status, relative age, commit
title, `#iid`, ref, short SHA, `latest` / `Auto DevOps` badges, `Download artifacts`.
Job rows match too, including `#16329`-style job ids, `allowed to fail`,
`created by test` and the job name. The only divergence is a missing space
(DIFF-1301, P2).

### 2.6 `ci_pipelines.json` is not in mutable state and not in `/go` — confirmed

| check | result |
|---|---|
| `grep -rn ci_pipelines src/` | only `src/utils/ci.js:16`, which the four CI views import |
| referenced by `createInitialData()` / `dataManager.js` | **no** |
| `/go` top-level keys | `currentUser follows groups issues labels members mergeRequests milestones nextIds notes projects repo snippets stars todos ui users` — **17, no CI key** |
| CI fingerprints in the whole `/go` payload (`job_specs`, `ci_pipelines`, `stage_idx`, a real job id `16323`) | **0 / 4** |
| cold state size, `json.dumps(..., ensure_ascii=False, separators=(',',':'))` | **2 069 758 bytes = 1.974 MiB** — byte-identical to the `.mock-states/<sid>.json` on disk and to round 11's figure |

The 1 037 KiB seed cost the mutable state exactly zero, as designed. (`SCHEMA.md`
still quotes 2 076 882 bytes from round 10 — 7 KB stale, see DOC-1302.)

---

## 3 · Route parity — every ROUTES.md row, cold, this round

**153 probe URLs** covering all 131 numbered rows plus row 127b. Rows 24, 34, 77
and 85 are declared not-migrated in `ROUTES.md` and are not probed. Every probe
used a **fresh browser context and a fresh `?sid=`**, went straight to the deep
link with no click-through, and was checked for: render, console errors, uncaught
pageerrors, `sid` after load, `sid` after clicking the first visible in-app link,
horizontal overflow at 1280×720, and placeholder copy.

```
TOTAL 153   CLEAN 151   PROBLEM 2
```

| check | result |
|---|---|
| cold-load failures | **0 / 153** |
| blank pages | **0 / 153** |
| uncaught pageerrors | **0 / 153** |
| `sid` dropped on load | **0 / 153** |
| `sid` dropped after an in-app navigation | **0 / 153** |
| horizontal overflow at 1280×720 | **0 / 153** |
| `<Placeholder>` / "has not been implemented yet" | **0 / 153** |
| console errors (dev bundle) | **1 / 153** — NOTE-1301, React dev-only |
| console errors (production bundle) | **0** |

The two flagged probes:

| row | probe | verdict |
|---|---|---|
| 36 | `/-/profile` expected literal `Set status` | **probe error, not a bug.** `Set status` is the navbar dropdown's wording; the settings page carries the control as an input whose *placeholder* is `What's your status?`, which `innerText` cannot see. The affordance works — §9 drives webarena-418 end to end through it. Same class as round 9's `Most starred` / `Most stars` correction. |
| 106 | `/-/pipelines/charts` React `validateDOMNesting` warning | **NOTE-1301** — dev-mode only, and the markup is faithful to the source. See §12. |

`/explore/snippets` is the one short body (94 chars) — GitLab's own
`No snippets found` empty state, read by hand, unchanged from round 11.

Dynamic rows were resolved from the seed at run time (row 89 → the first
`/-/labels/:id/edit` href harvested off the labels page). Rows 92/93 were driven
against `OpenAPITools/openapi-generator` because `a11y-webring.club` has no
milestone; both render with `#content-body`, `.block.start_date` and
`.block.due_date` present (§5).

Two probes I chose badly are worth recording so a later round does not re-chase
them: `/byteblaze/a11y-webring.club/-/issues/40` and `…/-/issues/40/edit` render
the 404 page because that project's issue iids stop at 4 — MR 40 exists, issue 40
does not. The **source** 404s on the same paths.

---

## 4 · The four closed P0s — re-verified on the round-12 tree

| bug | check run this round | result |
|---|---|---|
| **BUG-004** · multi-byte UTF-8 through `/post` | 25 payloads padding `🐞 Ünïcödé — 日本語 «test»` to every offset from 65 520 to 65 544 around the 65 536-byte chunk boundary, POSTed and read back through `/go` | **25 / 25 exact round-trips · 0 failures** — still closed |
| **BUG-B01** · case-insensitive project paths | `/byteblaze/DOTFILES`, `/ROOT/metaseq`, `/root/METASEQ`, `/convexegg/ChatGPT`, `/BYTEBLAZE/dotfiles/-/issues`, `/ByteBlaze`, `/users/ByteBlaze` | **7 / 7** canonicalise with `?sid=` intact — still closed |
| **BUG-001** · members `<td data-label>` | drove the real evaluator lookup after inviting: find the `tbody tr` containing `@abisubramanya27`, read `td[data-label="Max role"]` | returns **`Guest`**; same lookup on `yjlou` after inviting to `solarized-prism-theme` returns **`Developer`** — still closed |
| **BUG-A01** · `?sid=` on the sort dropdown | part of the 153-probe sweep — `sid` survived every in-app navigation, including sort/state links | **0 losses** — still closed |

---

## 5 · Anchor contract — re-run from scratch on the round-12 seed

| check | result |
|---|---|
| anchor routes loaded, fresh context + fresh sid each | **145 / 145** · 0 load failures · 0 console errors · 0 pageerrors · 0 `sid` losses |
| …rendering the 404 page | **65** — read one by one; **every one** is an entity a task is supposed to create (`/byteblaze/TODO`, `/byteblaze/web_agent_*`, `/groups/{x-lab,crew,n-lab,webagent,coding_friends}/-/group_members`, the `nolan_*` repos, the `gimmiethat.space` sub-folder `urls.txt` files). **No seeded entity 404s, and no to-be-created entity pre-exists.** |
| page-bound anchor string pairs | **243** |
| …present on the pristine seed | **5** — `Thank you` on a11yproject MR 1270, `@Roshanjossey` on MR 1485, `MIT License` on `gimmiethat.space/-/blob/main/LICENSE`, and the two `404` strings |
| …absent because the page itself is a task-created 404 | **168** |
| …absent because they are the post-condition of a mutating task | **70** — triaged individually (status strings, followed users, starred repos, invited members, edited LICENSE/README bodies, assigned-issue titles). §9 drives a sample and they appear |
| **strings the pristine seed should already carry but does not** | **0** |
| `program_html` locators | **25** live (page, locator) pairs resolve — `#content-body`, `.user-profile`, `[data-qa-selector="projects_list"`, `.visibility-icon`, `.block.assignee`, `.block.reviewer`, `.detail-page-description`, `[data-qa-selector="title_content"]`, `.block.due_date`, `.block.start_date`, `.detail-page-description > a.gl-font-monospace` |

**Machine-diffed against round 11: 243 pairs → identical partition (5 / 168 / 70),
145 / 145 routes.** Round 11 counted 68 routes as 404 where I count 65; the
delta is the three `/-/raw/…` anchor paths, which serve `text/plain` and
therefore never contain the string `Page Not Found` that both sweeps test for.
The underlying set is unchanged. **The round-12 seed perturbed nothing in the
anchor contract.**

---

## 6 · Session isolation, reset, injected state

| check | result |
|---|---|
| mutate sid `isoA` via `/post` `set_current` | `/go?sid=isoA` `state_diff` → `['_probe']` |
| sid `isoB`, untouched | `state_diff` empty — **isolated** |
| `{"action":"reset"}` on `isoA` | `state_diff` empty again — **restored** |
| inject custom state (`set` with a renamed `currentUser`) | `/go` echoes `R13 Injected Name` — honoured on first load |
| UTF-8 across the chunk boundary | 25 / 25 (§4) |
| per-task sids used in §9 | 22 independent sids, each with its own `state_diff` — no cross-talk |

---

## 7 · Round-8 responsive work — re-verified against the live source

`getBoundingClientRect()` on **both** sides, same path, same viewport:

| width | page | side | `#content-body` x–right (w) | `aside.nav-sidebar` | `aside.right-sidebar` | overflow-x |
|---|---|---|---|---|---|---|
| 1280 | MR 40 | SOURCE | 272 – 974 (702) | 0 – 256 | 990 – 1280 | none |
| 1280 | MR 40 | **MOCK** | **272 – 974 (702)** | **0 – 256** | **990 – 1280** | **none** |
| 1280 | issue 1478 | SOURCE / MOCK | 272 – 974 (702) both | 0 – 256 both | 990 – 1280 both | none both |
| 1600 | MR / issue | SOURCE / MOCK | 304 – 1262 (958) both | 0 – 256 both | 1310 – 1600 both | none both |
| 1920 | MR / issue | SOURCE / MOCK | 464 – 1422 (958) both | 0 – 256 both | 1630 – 1920 both | none both |

**12 / 12 measurements identical, 0 horizontal overflow.** webarena-418 and
webarena-448 were driven end to end at 1280×720 and `.cover-status` /
`.profile-header [itemprop="url"]` return `Cruising` and `egg.tart.com` after a
reload (§9).

---

## 8 · State budget and build

| check | result |
|---|---|
| `npm run build` | **PASS** — `✓ 171 modules transformed · built in 3.85s`; only the pre-existing 500 KB chunk advisory |
| `npm run preview` on the production bundle | serves the state API; `/go?sid=` answers |
| console errors / pageerrors on the production bundle across 8 pages incl. all four CI views | **0** |
| cold state size | **1.974 MiB** (§2.6) |
| bundle | `index-*.js` 7 425 KB raw / 1 978 KB gzip — up ~1 MB on round 11 from the CI seed, which is bundled but not stateful |

---

## 9 · Task replays — 23 tasks driven end to end at 1280×720

Every mutation was performed through the UI (no direct state writes), the
post-condition asserted at its real URL, the page **reloaded**, and `/go?sid=`
read to confirm the mutation is a creation rather than a silent edit.

| task | flow driven | evaluator | verdict |
|---|---|---|---|
| webarena-44 | `/` → navbar To-Do List | `url_match /dashboard/todos` | ✅ |
| webarena-156 | `/` → navbar MR counter → dropdown → `Assigned to you` | `url_match …?assignee_username=byteblaze` | ✅ (two clicks — the counter opens a dropdown, as on GitLab) |
| webarena-105 | issues list → label chip | `url_match /-/issues/?label_name%5B%5D=OpenAPI%20Generator%20CLI` | ⚠️ **by URL entry only** — DIFF-1303 |
| webarena-168 | `/users/byteblaze/projects`, read star counts | `string_match` fuzzy `N/A` | ✅ 12 personal projects, counts readable |
| webarena-297 | `/yjlou/2019-nCov` → Clone dropdown | `exact_match ssh://git@…/yjlou/2019-nCov.git` | ✅ `ssh://git@localhost:2222/yjlou/2019-nCov.git` |
| webarena-315 | PyTorch-GAN → Repository → Contributors | `must_include` 3 emails | ✅ 3/3 |
| webarena-389 | primer/design MR 450 → comment → reload | `must_include "Thanks, working on reviews"` | ✅ · diff `notes, mergeRequests, nextIds.note` |
| webarena-393 | empathy-prompts MR 19 → `lgtm` → reload → evaluator locator | `exact_match "lgtm"` under `#notes-list` lastElementChild | ✅ locator returns `lgtm` |
| webarena-415 | a11y-webring MR 40 → reply | `must_include "Thank you"` | ✅ |
| webarena-394 | `/yjlou/2019-nCov` → Fork → namespace `byteblaze` → Fork project | `must_include "2019-nCov"` at `/byteblaze/2019-nCov` | ✅ · diff includes `nextIds.project`, `repo.forkOrigin.byteblaze/2019-nCov` — a **creation** |
| webarena-411 | cloud-to-butt `LICENSE.txt` → Edit → Commit changes | `must_include "MIT License"` | ✅ on both the blob and `/-/raw/master/LICENSE.txt` |
| webarena-418 | `/-/profile` → status → Update | `exact_match "Cruising"` on `.cover-status` lastChild | ✅ survives reload · diff `currentUser.status, users` |
| webarena-448 | `/-/profile` → website URL → Update | `exact_match "egg.tart.com"` on `.profile-header [itemprop="url"]` | ✅ · diff `currentUser.website_url, users` |
| webarena-446 | a11yproject 404 issue → sidebar Edit → toggle → search `Roshan` → pick | `must_include` the title at `/dashboard/issues?…assignee_username=Roshanjossey` | ✅ sidebar reads `Assignee Edit Roshan Jossy` · diff `issues` |
| webarena-811 | same issue → `assign yourself` | `must_include` the title at `…assignee_username=byteblaze` | ✅ · diff `issues` |
| webarena-480 | solarized-prism-theme → Invite members → `yjlou` / Developer | `func:gitlab_get_project_memeber_role` → `Developer` | ✅ |
| webarena-481 | dotfiles → Invite members → `abisubramanya27` / Guest | same helper → `Guest` | ✅ · diff `members, nextIds.member` |
| webarena-527 | `/explore/projects/starred` → top repo → Star | `must_include "AndroidSlidingUpPanel"` at `/users/byteblaze/starred` | ✅ · diff `projects, stars` |
| webarena-533 | `/convexegg`, `/yjlou` → Follow ×2 | `must_include @convexegg @yjlou` under `.user-profile` | ✅ · diff `follows, users` |
| webarena-552 | `/-/new/main` → path `real_space/urls.txt` + body → Commit | `must_include` the 5 URLs at `/-/raw/main/real_space/urls.txt` | ✅ · diff includes `repo.treeOverlay…` and `repo.fileOverlay…real_space/urls.txt` — a **creation** |
| webarena-556 | `/projects/new` → blank project `nolan_honest_fans` → new file `README.md` | `must_include` 12 film titles at `/-/raw/main/README.md` | ✅ 12/12 · diff includes `nextIds.project`, `repo.branchOverlay…` |
| webarena-799 | `/groups/new` → Create group → `n-lab` → members ×4 | `must_include @patou @egpast @westurner @jontutcher` | ✅ 4/4 · create diff `groups, members, nextIds.group, nextIds.member` |
| webarena-808 | cloud-to-butt → New issue → title + assignee + due date → Create issue | `url_match /-/issues` + 3 locators | ✅ landed on `/-/issues/1`; after reload `title_content` = `Let's keep the project alive`, `[data-testid="sidebar-due-date"]` = `Mar 31, 2033`, `.block.assignee` = `Byte Blaze` · diff `issues, nextIds.issue` |

**22 / 23 completable end to end. 0 console errors and 0 pageerrors across every
replay.** The one shortfall is webarena-105, which fails only on the URL form the
label chip emits (DIFF-1303) — the page, the filter and the anchor URL itself all
work.

Two flows worth recording because they need a second click and a first pass reads
as a dead control: the navbar MR counter opens a dropdown before it navigates, and
the issue-sidebar assignee needs `Edit` → `.dropdown-menu-toggle` before the list
is visible (DIFF-1106, still as round 11 described it). Both complete.

---

## 10 · Independent hunt — where no previous round looked

Round 12 asked me to keep hunting. Four probes no earlier round ran:

1. **Do the mock's own controls emit the URL form the evaluator wants?** Previous
   rounds verified that anchor URLs *resolve*. Nobody checked what the UI
   *produces*. → **DIFF-1303 (P1)**.
2. **Do list-view counters respond to an active filter?** → **DIFF-1304 (P2)**.
3. **Do the anchor label filters actually select rows?** → **DIFF-1305 (P2)**.
4. **Is the round-12 CI seed lossless?** Decoded the whole seed and diffed it
   against `ci_pipelines` / `ci_builds` row by row → **0 errors in 15 644 rows**
   (§2.1). This one came back clean.

---

## 12 · Source-vs-mock differences

Method: matched pairs at 1920×1080 and 1440×900 on identical paths, plus
behavioural comparison (click the same control on both sides, compare the
resulting URL, row set, counters and text). The source side is **anonymous** —
the read-only rule forbids logging in on 8023 — so any authenticated affordance
the mock shows and the source does not is the mock being correct and is not
listed. Private projects (`visibility_level = 0`, e.g.
`byteblaze/accessible-html-content-patterns`) 302 to the login page and are
simply not comparable.

### DIFF-1303 · **P1** · In-page filter controls emit `/-/issues?…`; the source emits `/-/issues/?…`

| Field | Value |
|-------|-------|
| Paths | every `/:ns/:proj/-/issues` filter control — label chips, state tabs, sort |
| Source | clicking a label chip on `/OpenAPITools/openapi-generator/-/issues` lands on `…/-/issues/?label_name%5B%5D=Issue%3A%20Bug` — **trailing slash before the `?`**. Reproduced on `/a11yproject/a11yproject.com/-/issues` → `…/-/issues/?label_name%5B%5D=claimed` and on `/root/metaseq/-/issues` → `…/-/issues/?label_name%5B%5D=enhancement`. GitLab's chip `href` is the relative `?label_name[]=…` and its router pushes the slash form. |
| Mock | the chip `href` is the absolute `/…/-/issues?label_name%5B%5D=claimed` — **no slash**. State tabs emit `/-/issues?sid=…&state=opened`; the sort dropdown emits `/-/issues?sid=…&sort=created_date`. |
| Worse | the mock **strips a slash the agent already had**: starting on `/-/issues/?sid=…` and clicking any chip navigates to `/-/issues?…`. So an agent dropped on the anchor URL loses the passing form the moment it touches a filter. |
| Impact | **12 anchor routes / 12 tasks** are written with the slash: webarena-45, 46, 102, 103, 104, 105, 106, 339, 340, 341, 342, 343. WebArena's `URLEvaluator` under `GOLD in PRED` splits both URLs into `netloc + path` and does `ref_base_path in pred_base_path` — a **substring** test. `…/-/issues/` is not a substring of `…/-/issues`, so `base_score = 0` and the task scores 0. The same click on the source scores 1. |
| Not P0 | the mock **accepts and preserves** the slash form on direct navigation — all 12 anchor URLs load, render the right view, keep `?sid=`, and `location.pathname` still ends in `/`. An agent that navigates by URL passes. So the task is completable; the natural click path silently is not. |
| Caveat, stated honestly | the WebArena evaluation harness is not installed on this host, so I reasoned about `URLEvaluator` from its published implementation rather than executing it. What is **measured**, on both sides, is that the source's UI produces the trailing-slash form and the mock's does not. |
| Fix hint | emit the source's form from the issue/MR list controls — the label chip, the `state=` tabs and the sort menu should build `${base}/-/issues/?…` (and `/-/merge_requests/?…`) rather than `${base}/-/issues?…`, and must not rewrite an incoming `/-/issues/` to `/-/issues`. The router already accepts both, so nothing else has to change. |

### DIFF-1304 · **P2** · Issue state-tab counters ignore the active filter

| | `/-/issues` | `?label_name[]=bug` | `?label_name[]=help wanted` |
|---|---|---|---|
| **source** `Open / Closed / All` | 40 / 570 / 610 | **3 / 64 / 67** | **8 / 25 / 33** |
| **mock** `Open / Closed / All` | 22 / 34 / 56 | **22 / 34 / 56** | **22 / 34 / 56** |
| rows rendered, source / mock | 50 / 90 | 7 / 13 | 18 / 17 |

The **row list is filtered correctly** on both sides; only the three tab counters
are computed over the whole project in the mock and recomputed under the filter
in the source. (The unfiltered 40/570/610 vs 22/34/56 gap is the declared issue
sampling and is not a finding.) **P2 because it costs zero tasks:** all 21
counting tasks in `webarena.jsonl` count *commits* or *followers*, none counts
filtered issues. It is the most task-relevant P2 in this list, though — any future
"how many open X issues" task would read the wrong number off the tab.

### DIFF-1305 · **P2** · Three anchor label filters select nothing

| project | label | source rows | mock rows | label on the mock's `/-/labels` |
|---|---|---|---|---|
| `OpenAPITools/openapi-generator` | `OpenAPI Generator CLI` | 8 | **0** | no |
| `keycloak/keycloak` | `flaky-test` | 36 | **0** | no |
| `kkroening/ffmpeg-python` | `question` | 18 | **0** | **yes**, but no sampled issue carries it |
| `a11yproject.com` | `bug` / `help wanted` | 7 / 18 | 13 / 17 | yes |
| `primer/design` | `type: bug 🐞` | 4 | 8 | no (chip renders on issues) |
| `root/metaseq` | `enhancement` / `None` | 40 / 10 | 24 / 4 | yes / no |
| `umano/AndroidSlidingUpPanel` | `not[BUG]` | 40 | 80 | yes |

All nine are `url_match`-only tasks (103, 104, 105, 339–343, 45), so an empty
result does not fail the evaluator — the URL is what is scored, and it resolves.
But on three of them the label is undiscoverable in the mock, so the click path
that would build the URL does not exist. Fixing it is a seed job: make at least
one sampled issue per project carry each anchored label.

### DIFF-1306 · **P2** · Pipelines-list rows miss the space between ref and short SHA

Source `…/add-verification-function 9c06ccbb` · mock `…/add-verification-function9c06ccbb`.
Same missing-whitespace-text-node class as DIFF-1101, on `/-/pipelines` rows for
every project. The jobs list has it right. No anchor reads it.

### DIFF-1307 · **P2** · CI/CD Analytics: date range off by one, and the second chart is absent

| | source | mock |
|---|---|---|
| `Date range` for `Last week` | `01 Aug - 08 Aug` (8 days) | `02 Aug - 08 Aug` (7 days) |
| duration chart | ECharts canvas with `Minutes` / `Commit` axes and a `0 … 1` scale | the real short SHAs only |
| pipelines-over-time chart | second ECharts canvas: `Pipelines` / `Date` axes, `01 August … 08 August`, `all success` legend | **not rendered at all** |

`PipelinesCi.jsx:1192` uses `(days - 1) * 86400000`; the source's window is
`today - days`. The three period buttons themselves work — `Last month` →
`10 Jul - 08 Aug`, `Last year` → `09 Aug - 08 Aug`, and `.selected` moves. The
missing chart is a deliberate simplification (canvases are not readable by an
evaluator), but the source's axis labels *are* rendered text.

### DIFF-1308 · **P2** · `Auto DevOps enabled` quick-link shown on every project overview

Source shows it on **4 of 12** sampled projects (`byteblaze/dotfiles`,
`yjlou/2019-nCov`, `byteblaze/cloud-to-butt`, `byteblaze/timeit`) and hides it on
the other 8 (`a11y-webring.club`, `a11yproject.com`, `primer/design`,
`root/metaseq`, `openapi-generator`, `gimmiethat.space`, `empathy-prompts`,
`keycloak`). The mock renders it on **12 of 12** — `ProjectOverview.jsx:240` adds
it unconditionally. It links to `/-/settings/ci_cd#autodevops-settings`; no anchor
or task reads it. **Priced conservatively** — the gating rule is not derivable
from `project_auto_devops` (all 67 rows are `enabled = false`) and the source side
is anonymous, so I could not establish it definitively.

*Distinct from DIFF-001*, which is the dismissible yellow `Auto DevOps will
automatically build…` banner in `Layout.jsx`. That is absent on both sides for all
12 projects and its gating is unchanged.

### DIFF-1309 · **P2** · Pipeline-detail `Stage` / `Job dependencies` group-by toggle is inert

On `/-/pipelines/1823` and `/-/pipelines/21`, clicking either button leaves the
rendered body byte-identical. The source regroups the pipeline graph. All jobs are
listed either way, so nothing is hidden.

### NOTE-1301 · React `validateDOMNesting` warning on `/-/pipelines/charts`

`PipelinesCi.jsx:1176` renders `<p><p>{...}</p></p>`. **The markup is faithful** —
the source's own Vue output is `<p><p>Date range: 01 Aug - 08 Aug</p> </p>`. React
logs `<p> cannot appear as a descendant of <p>` **in dev mode only**; the
production bundle is clean (verified on `npm run preview`, 0 console errors across
all four CI views). Not a bug, but it is the one console error in the dev sweep and
is recorded so a later round does not re-chase it.

### Carried P2s — re-measured this round, all still open

| id | status | evidence |
|---|---|---|
| DIFF-1101 · MR commit-header whitespace | **still open** | mock `26 Jan, 20231 commit` / `22 Jan, 20233 commits` vs source `26 Jan, 2023 1 commit` / `22 Jan, 2023 3 commits`; reproduced on a11y-webring MR 40 and a11yproject MR 1270 |
| DIFF-1102 · role-badge chip styling | **unresolved, unverifiable** | neither side exposes the badge as a leaf element at 1920 (the source's `Contributor` is `d-none d-xl-inline-block`); round 11's text-identity finding stands |
| DIFF-1103 · settings `<title>` | **still open** | mock `Repository Settings · …` / `CI/CD Settings · …` vs `General · Settings · …`; the source 404s these paths anonymously so only the round-11 capture is comparable |
| DIFF-1104 · file-tree column widths | **still open** | mock `Name/Last commit/Last update` = **182 / 685 / 91**, source **319 / 319 / 319**; `.tree-commit-link` mock `visible / clip / normal / none` vs source `hidden / ellipsis / nowrap / 100%` |
| DIFF-1106 · sidebar picker needs a second click | **still open** | `Edit` → `.dropdown-menu-toggle` → list; the flow completes and webarena-446 passes through it |

### Re-verified as *not* differences this round

- **Tree ordering** — 8 projects, 166 entries: directories first, then files, ASCII
  order within each group, matching GitLab.
- **Quoted / escaped seed paths** — none seen in any of the 8 trees.
- **Responsive geometry** — 12/12 measurements identical to the source (§7).
- **DIFF-001 banner gating** — absent on both sides across 12 projects.
- **Pipelines pagination** — 5 pages, sliding window and last-page row count
  identical (§2.5).
- **Job list ordering and content** — identical, including job ids and
  `allowed to fail` (§2.5).

---

## 13 · Bugs for the dev agent

### Functional bugs

**None.** No P0 and no P1 **functional** bug was found this round. All four
historical P0s (BUG-001, BUG-004, BUG-A01, BUG-B01) re-verified closed (§4).

### Handbacks

| id | priority | what | where |
|---|---|---|---|
| **DIFF-1303** | **P1** | issue/MR filter controls emit `/-/issues?…` where the source emits `/-/issues/?…`, and strip an incoming trailing slash — 12 `url_match` anchors fail on the click path | §12 |
| **DOC-1301** | P2 | `ROUTES.md` row 106 still reads *"list + CI/CD Analytics render the source's zero-pipeline state; `/:id` 404s as the source does"* — the opposite of what the code now does, and of what the source does. Row 107 (`/-/jobs`) is a bare `[x]` with no note. Round 12 was asked to correct this and did not. | §15 |
| **DOC-1302** | P2 | `SCHEMA.md` does not mention `ci_pipelines.json` anywhere; its module table still reads **Static (10)** and lists ten. The cold-state figure (2 076 882 B) is 7 KB stale against the measured 2 069 758 B. | §15 |
| DIFF-1304 | P2 | issue state-tab counters ignore the active label filter | §12 |
| DIFF-1305 | P2 | three anchor label filters select zero rows (label absent from the sampled issues) | §12 |
| DIFF-1306 | P2 | pipelines-list rows miss the space between ref and short SHA | §12 |
| DIFF-1307 | P2 | CI/CD analytics date range off by one day; the pipelines-over-time chart and both charts' axis labels are absent | §12 |
| DIFF-1308 | P2 | `Auto DevOps enabled` quick-link rendered on every project overview (source: 4 of 12) | §12 |
| DIFF-1309 | P2 | pipeline-detail `Stage` / `Job dependencies` group-by toggle is inert | §12 |
| DIFF-1101/1102/1103/1104/1106 | P2 | carried from round 11, all still open | §12 |

---

## 14 · Round history

### Round 11 → Round 13

| finding | status |
|---|---|
| **DIFF-1105 · P1** · CI/CD surface empty where the source is populated | ✅ **FIXED and independently verified.** Seed lossless against Postgres on 15 644 rows; 14/14 comparable projects exact on pipelines, jobs and analytics; `/-/pipelines/:id` returns a real page on 9/9 and 404s when the id belongs to another project; the success ratio is computed (`keycloak` prints `227 pipelines` failed of 231, which a naive `total − successful` would not); pagination exact on 5 pages; `0` bytes added to state |
| DIFF-1101 · MR commit-header whitespace | ❌ **still failing** |
| DIFF-1102 · role-badge chip styling | ⚠️ unverifiable from an anonymous source |
| DIFF-1103 · settings `<title>` | ❌ **still failing** |
| DIFF-1104 · file-tree column widths | ❌ **still failing** |
| DIFF-1106 · sidebar picker second click | ❌ still open (flow completes) |
| `ROUTES.md` row 106 corrected | ❌ **not done** → DOC-1301 |
| BUG-001 / 004 / A01 / B01 | ✅ all still closed |
| DIFF-001, DIFF-901…908, tree ordering, responsive geometry | ✅ all still correct |
| — | **NEW: DIFF-1303 (P1); DIFF-1304…1309, DOC-1301, DOC-1302 (P2); NOTE-1301** |

---

## 15 · Gating criteria

| # | criterion | verdict | evidence |
|---|---|---|---|
| 1 | Every `ROUTES.md` row verified (cold load + params + sid) | **PASS** | §3 — 153 probes covering all 131 rows + 127b; 0 cold-load failures, 0 pageerrors, 0 sid losses, 0 overflow, 0 placeholders; 0 console errors on the production bundle |
| 2 | All P0 and P1 `TODO.md` items `[x]` | **PASS** | 3 items remain open, none P0/P1: blob syntax highlighting (accepted P2), the `assets/data_model.md §14` checklist (`[~]`, process), and the seed-size budget note (P2, explicitly not a blocker) |
| 3 | `AUDIT.md` zero P0 | **PASS** | `AUDIT.md` §3 records **P0: none**; nothing found this round is a P0 |
| 4 | `TEST.md` zero P0, zero P1 functional, zero P0/P1 source-vs-mock differences | **FAIL** | zero P0 ✅, zero P1 functional ✅, zero P0 source-diff ✅ — but **one P1 source-vs-mock difference: DIFF-1303** |
| 5 | `SCHEMA.md` current | **FAIL** | `ci_pipelines.json` — a 1 037 KiB seed added in round 12 and consumed by four views — is not documented; the module table still reads **Static (10)**; the cold-state figure is 7 KB stale (DOC-1302) |
| 6 | `npm run build` passes | **PASS** | `✓ 171 modules transformed · built in 3.85s`, only the pre-existing chunk-size advisory |

**Overall: FAIL, two criteria short, for two independent reasons.**

**Criterion 4** fails on DIFF-1303: the mock's own issue/MR filter controls emit a
URL form the WebArena `url_match` evaluator rejects, on 12 anchored tasks, where
the identical click on the source emits the form it accepts — and the mock strips
the correct form if the agent arrives with it. The pages, the filtering and the
anchor URLs all work, which is why it is P1 and not P0.

**Criterion 5** fails on documentation, not on code: round 12 shipped a correct
new seed and four correct views without recording either in `SCHEMA.md`, and
without correcting `ROUTES.md` row 106, which still asserts the opposite of what
both the mock and the source now do. Both are small edits.

Everything else is in good shape, and round 12's work is fully vindicated: the
CI/CD seed is lossless on all 15 644 source rows, the four views match the live
source on every comparable project, the analytics figures are computed rather than
hardcoded, the compaction costs mutable state zero bytes, 145/145 anchor routes
and 243/243 anchor string pairs land exactly where round 11 left them, 22 of 23
replayed tasks complete end to end, session isolation and `/go` are correct, the
state is 1.974 MiB, the responsive geometry matches the source at three widths,
and the whole round produced **0 console errors and 0 pageerrors on the
production bundle**.
