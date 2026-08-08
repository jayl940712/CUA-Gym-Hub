# DEV — Round 12 · DIFF-1105 · the project CI/CD surface

Scope: close DIFF-1105 (P1) — pipelines list, pipeline detail, CI/CD analytics and
jobs render an empty state where the source is populated — plus the cheap P2
residuals DIFF-1101, 1102, 1103, 1104, 1106.

Status legend: `[ ]` not started · `[~]` in progress · `[x]` done

---

## 0 · Checkpoint log

- **Step 1 — source recon: DONE.** Postgres queried READ-ONLY (SELECT only);
  25 source pages captured with Playwright at 1920×1080 into `/tmp/r12/src/`.
- **Step 2 — the static seed: DONE.** §2. State size measured before and after.
- **Step 3 — the five views: DONE.** §3, verified in §4 and §7.
- **Step 4 — `ROUTES.md` row 106 corrected: DONE.** §8.
- **Step 5 — `SCHEMA.md` + `assets/data_model.md §11b`: DONE.** §8.
- **P2 residuals DIFF-1101 / 1102 / 1103 / 1104 / 1106: DONE.** §5.
- Summary of results: §7.

> **The tree was NOT exclusively owned by this round.** The brief said it was,
> but another round edited the same files while this one was running:
>
> | file | change | attributed to |
> |---|---|---|
> | `src/App.jsx`, `src/utils/RedirectWithQuery.jsx` | new `appendSid()` replacing the `URLSearchParams` rebuild in the delegated link interceptor | `TEST.md DIFF-1303` |
> | `src/utils/ci.js`, `src/pages/PipelinesCi.jsx` | ECharts axis labels / tick values for `/-/pipelines/charts` — appended to **this round's own new files** | `TEST.md DIFF-1307` |
>
> `.mock-states/` also holds ~6 600 session files under `r13_*` / `gate_r*`
> prefixes this round never used. None of that is round-12 work.
>
> **What this means for the numbers in §7.** Every result below was measured on
> a tree containing the DIFF-1303 change, and re-measured on a freshly restarted
> dev server; all still pass. The DIFF-1307 additions to `ci.js` and
> `PipelinesCi.jsx` landed **after** the final verification sweep, so §7 does not
> cover them — the tree still builds green with them in place, but whoever gates
> this should re-run `verify.py` rather than take §7 as covering round 13's
> edits too.

---

## 1 · What the source actually has (measured, not guessed)

### 1.1 Postgres, READ ONLY

Queries run (all `SELECT`, no writes, no `?sort=` URL loaded on 8023):

```sql
SELECT count(*) FROM ci_pipelines;                  -- 1465
SELECT count(*) FROM ci_builds;                     -- 14179
SELECT status, count(*) FROM ci_pipelines GROUP BY status;
SELECT status, count(*) FROM ci_builds    GROUP BY status;
SELECT p.id, n.path||'/'||p.path, <pipeline count>, <build count>
  FROM projects p JOIN namespaces n ON n.id = p.namespace_id
 WHERE EXISTS (SELECT 1 FROM ci_pipelines c WHERE c.project_id = p.id);
```

**Headline facts.**

| fact | value |
|---|---|
| pipelines in the instance | **1 465** |
| jobs (`ci_builds`) in the instance | **14 179** |
| projects with ≥1 pipeline | **67** |
| of those, seeded in `src/data/projects.json` | **67 — all of them** |
| projects in the seed with **zero** pipelines | 108 (incl. `byteblaze/dotfiles`) |
| pipeline statuses instance-wide | `failed` 1 461 · `skipped` 4 — **zero successes** |
| job statuses instance-wide | `skipped` 9 288 · `failed` 4 891 |
| pipeline `source` values | `1` (push) ×1 461 · `10` ×4 |

So the source's own `Success ratio` is **0.00%** everywhere a project has
pipelines, and `100.00%` only on the zero-pipeline projects (GitLab's
divide-by-zero default). The mock printed `100.00%` unconditionally — that is
the wrong-and-misleading figure DIFF-1105 calls out.

### 1.2 Per project — the six sampled by TEST.md §12, confirmed

| project | project_id | source pipelines | source jobs |
|---|---|---|---|
| `byteblaze/a11y-webring.club` | 179 | **1** | 7 |
| `a11yproject/a11yproject.com` | 174 | **7** | 49 |
| `primer/design` | 180 | **3** | 21 |
| `byteblaze/empathy-prompts` | 183 | **2** | 14 |
| `root/metaseq` | 33 | **11** | 66 |
| `byteblaze/dotfiles` | 178 | **0** | 0 |

Every number matches what TEST.md measured off the live UI, so the DB and the
rendered page agree. `dotfiles` is genuinely empty on both sides — its empty
state was always correct, and that is precisely why every earlier round's HTML
capture (`assets/html/proj-pipelines.html`, `r4-pipelines.html`, `r4-jobs.html`,
`r4-pipelines-charts.html`) shows an empty page: **all four were taken against
`dotfiles`, the one project that has nothing.** The round-4 comment in
`ProjectOps.jsx:15-16` generalised from that single sample to "this WebArena
GitLab instance has no runners, no pipelines" — which is false for 67 projects.

Full 67-project table: §1.4.

### 1.3 Source pages captured (Playwright, anonymous, 1920×1080)

25 pages in total, all **200**; the ones that decided a design choice:

| page | source result |
|---|---|
| `/byteblaze/a11y-webring.club/-/pipelines` | `All 1`, 1 row |
| `/byteblaze/a11y-webring.club/-/pipelines/1823` | **200**, `Pipeline #1823`, 7 jobs / 3 failed |
| `/byteblaze/a11y-webring.club/-/jobs` | `All 7`, 7 rows |
| `/byteblaze/a11y-webring.club/-/pipelines/charts` | `Total: 1 pipeline · Successful: 0 · Failed: 1 · Success ratio: 0.00%` |
| `/a11yproject/a11yproject.com/-/pipelines` | `All 7`, 7 rows |
| `/a11yproject/a11yproject.com/-/jobs` | `All 49`, 30 rows (page 1) |
| `/root/metaseq/-/pipelines` | `All 11`, 11 rows |
| `/primer/design/-/pipelines` | `All 3`, 3 rows |
| `/byteblaze/empathy-prompts/-/pipelines` | `All 2`, 2 rows |
| `/byteblaze/dotfiles/-/pipelines` | `All 0` + empty state — **mock already correct** |
| `/OpenAPITools/openapi-generator/-/pipelines` | `All 389`, **15 rows/page**, `Prev 1 2 3 4 5 … 26 Next` |
| `/OpenAPITools/openapi-generator/-/jobs` | `All 1,000+`, **30 rows**, no pager (infinite scroll) |

**Page sizes learned from the source, not assumed:**
- pipelines list → **15 per page**, numbered pager (389 → 26 pages)
- jobs list → **30 per page**, no pager; count badge caps at `1,000+`


### 1.4 Per-project pipeline / job counts — all 67, from Postgres

| project | id | pipelines | jobs |
|---|---|---|---|
| OpenAPITools/openapi-generator | 58 | 389 | 5 446 |
| keycloak/keycloak | 143 | 231 | 2 593 |
| vinta/awesome-python | 84 | 195 | 1 170 |
| http-party/node-http-proxy | 119 | 74 | 518 |
| twbs/bootstrap | 76 | 56 | 392 |
| checkstyle/checkstyle | 144 | 44 | 396 |
| processwire/processwire | 100 | 43 | 344 |
| gcc-mirror/gcc | 95 | 36 | 504 |
| kkroening/ffmpeg-python | 133 | 32 | 192 |
| thoughtbot/administrate | 113 | 26 | 184 |
| eriklindernoren/PyTorch-GAN | 86 | 24 | 144 |
| mk-j/PHP_XLSXWriter | 99 | 22 | 132 |
| facebook/buck | 60 | 22 | 308 |
| PyAV-Org/PyAV | 136 | 22 | 135 |
| quickfixgo/quickfix | 88 | 20 | 160 |
| yzhao062/pyod | 139 | 16 | 96 |
| facebook/create-react-app | 122 | 15 | 105 |
| trpc/trpc | 39 | 14 | 98 |
| mathjax/MathJax | 65 | 11 | 154 |
| **root/metaseq** | 33 | **11** | 66 |
| covid19india/covid19india-react | 121 | 10 | 70 |
| avinashpaliwal/Super-SloMo | 131 | 9 | 54 |
| verekia/js-stack-from-scratch | 116 | 9 | 63 |
| Arachni/arachni | 111 | 8 | 56 |
| geeeeeeeeek/electronic-wechat | 123 | 7 | 49 |
| youfou/wxpy | 132 | 7 | 42 |
| **a11yproject/a11yproject.com** | 174 | **7** | 49 |
| justinmeister/Mario-Level-1 | 83 | 7 | 42 |
| harvitronix/five-video-classification-methods | 81 | 6 | 36 |
| OptimalBits/bull | 75 | 6 | 42 |
| yadav-rahul/TastyToast | 150 | 6 | 36 |
| koush/AndroidAsync | 145 | 6 | 38 |
| CellularPrivacy/Android-IMSI-Catcher-Detector | 61 | 5 | 30 |
| Nightonke/BoomMenu | 149 | 5 | 30 |
| umano/AndroidSlidingUpPanel | 152 | 4 | 24 |
| layeh/gumble | 89 | 4 | 28 |
| yujiosaka/headless-chrome-crawler | 118 | 4 | 28 |
| **primer/design** | 180 | **3** | 21 |
| wireservice/csvkit | 135 | 3 | 18 |
| abisubramanya27/CS6700-Project | 18 | 3 | 18 |
| ankush-me/SynthText | 141 | 3 | 18 |
| gulpjs/gulp | 120 | 3 | 21 |
| stripe-contrib/pagerbot | 112 | 2 | 16 |
| abisubramanya27/E-CONTEST-SHAASTRA20-SERVER | 24 | 2 | 14 |
| shakee93/fonoapi | 56 | 2 | 14 |
| pwr-Solaar/Solaar | 130 | 2 | 12 |
| triketora/women-in-software-eng | 85 | 2 | 12 |
| 0ang3el/aem-hacker | 138 | 2 | 12 |
| kingfengji/gcForest | 137 | 2 | 12 |
| sweet-js/sweet-core | 124 | 2 | 15 |
| firstcontributions/first-contributions | 172 | 2 | **0** |
| murale127/viewgrades-scraper | 161 | 2 | 12 |
| gist-run/gist-run | 126 | 2 | 14 |
| **byteblaze/empathy-prompts** | 183 | **2** | 14 |
| ImangazalievM/ReActiveAndroid | 153 | 1 | 6 |
| crashtech/torque-postgresql | 115 | 1 | 6 |
| stephrdev/django-mongoforms | 87 | 1 | 6 |
| abisubramanya27/ChAII-docker | 12 | 1 | 5 |
| **byteblaze/a11y-webring.club** | 179 | **1** | 7 |
| amwhalen/archive-my-tweets | 102 | 1 | 7 |
| abisubramanya27/IntrinsicDimensions | 29 | 1 | 7 |
| rcaloras/bashhub-client | 140 | 1 | 6 |
| abisubramanya27/E-Contest_Shaastra21 | 25 | 1 | 6 |
| Media-Smart/vedaseg | 82 | 1 | 6 |
| abisubramanya27/BrickBreaker-Game | 10 | 1 | 7 |
| abisubramanya27/CS6910_Assignment3 | 20 | 1 | 5 |
| torquebox/jruby-maven-plugins | 155 | 1 | 8 |

**Totals: 1 465 pipelines · 14 179 jobs · 67 projects.** The remaining **108**
seeded projects have zero rows in both tables and must keep rendering the
source's empty state — `byteblaze/dotfiles` among them.

`firstcontributions/first-contributions` is the one project with pipelines but
**no jobs at all**: both of its pipelines failed with a yaml error before any
job was created, so `0 jobs for !65328` is what the source prints.

### 1.5 The vocabulary, closed and measured — nothing guessed

| axis | the instance's complete vocabulary |
|---|---|
| pipeline status | `failed` ×1 461 · `skipped` ×4 — **no `success`, ever** |
| job status | `skipped` ×9 288 · `failed` ×4 891 |
| job names | exactly **14** — `build`, `test`, `code_quality`, `container_scanning`, `secret_detection`, `semgrep-sast`, `nodejs-scan-sast`, `brakeman-sast`, `flawfinder-sast`, `spotbugs-sast`, `phpcs-security-audit-sast`, `security-code-scan-sast`, `pmd-apex-sast`, `code_intelligence_go` |
| stages | exactly **2** — `build` (`stage_idx` 1) and `test` (`stage_idx` 2) |
| `ci_builds.failure_reason` | `3` (`stuck_or_timeout_failure`) on every failed job; NULL otherwise |
| `ci_builds.started_at` | **NULL on all 14 179 rows** → no job has a duration |
| `ci_pipelines.duration` | `0` ×335 · NULL ×1 130 |
| pipeline `source` | `push` ×1 460 · `merge_request_event` ×4 |
| pipeline badges | `latest` (all 1 465) · `Auto DevOps` (1 461) · `merge request` + `yaml invalid` + `error` (the 2 `first-contributions` rows) |

`name -> (stage, stage_idx, allow_failure)` is a **verified functional
dependency** over all 14 179 rows (`0` names violate it), which is what makes
the 14-entry `job_specs` dictionary in the seed lossless.

---

## 2 · The seed — `src/data/ci_pipelines.json` (STATIC)

**Coverage: complete, not sampled.** All 1 465 pipelines, all 14 179 jobs, all
67 projects. Nothing capped, nothing synthesised, no project invented a
history it does not have.

```
src/data/ci_pipelines.json   1 061 725 bytes (1 037 KiB)
```

Shape:

```jsonc
{
  "job_specs": [["build","build",1,false], ["brakeman-sast","test",2,true], …],  // 14
  "statuses":  ["failed","skipped"],
  "projects": {
    "179": [{
      "id": 1823, "iid": 1,
      "ref": "github/fork/davepgreene/add-verification-function", "ref_kind": "branch",
      "sha": "4817a445d1b74904bd695059aea63705370f9205",
      "title": "Merge branch 'main' into add-verification-function",
      "author_name": "Dave Greene", "author_email": "davepgreene@users.noreply.github.com",
      "status": "failed", "source": "push",
      "created_at": "2023-03-27T20:10:56.069Z",
      "started_at": "2023-03-27T22:00:06.927Z",
      "finished_at": "2023-03-27T22:00:08.682Z",
      "duration": 0,
      "stages": [["build","failed"], ["test","failed"]],
      "flags":  ["latest","auto_devops"],
      "jobs":   [[16323,0,0,207,6549492], [16326,4,1,916,null], …]
    }]
  }
}
```

Two encodings keep it lean, both **lossless** for everything these views render:

1. `job_specs` — the 14-entry name/stage/stage_idx/allow_failure dictionary,
   valid because of the functional dependency above.
2. job tuples `[id, specIdx, statusIdx, createdOffsetMs, finishedOffsetMs]`,
   with the offsets in **milliseconds from the pipeline's own `created_at`**.
   `started_at` is not carried because it is NULL on every row.

Real identifiers are carried verbatim and never regenerated: pipeline ids
(`1823`), iids, job ids (`16323`), full commit SHAs, refs, commit titles,
author names/emails, and every timestamp to the millisecond.

### 2.0 Seed integrity — checked against Postgres, not assumed

Re-derived from the container after curation:

```
projects in seed: 67    psql projects with pipelines: 67
pipeline ids:  seed 1465   psql 1465   sets identical: True
job ids:       seed 14179  psql 14179  sets identical: True
per-project pipeline and job counts vs psql: 0 mismatches
malformed SHAs / missing commit titles / unknown statuses: 0
projects not in the source's id-DESC order: 0
```

The id **sets** are identical, not just the counts — so nothing was invented and
nothing was dropped.

### 2.1 It does not touch the mutable state budget

`ci_pipelines.json` is imported by `src/utils/ci.js`, which the four CI views
import directly. It is **not** referenced by `createInitialData()` and does not
appear in any `/go` payload — the same treatment the seven git modules and the
round-10 `merge_request_diffs.json` get, and for the same reason: nothing in
the mock can mutate a pipeline (this instance has no runners, so no pipeline is
re-runnable and no job is retryable).

Measured, before and after (§4 has the method):


| | bytes | MiB |
|---|---|---|
| cold `/go` `initial_state`, **before** round 12 (SCHEMA.md round-10 figure) | 2 076 882 | 1.981 |
| cold `/go` `initial_state`, **after** round 12 | **2 076 882** | **1.981** |
| delta | **0** | **0** |

Measured the same way both times: `GET /go?sid=…` then
`len(json.dumps(initial_state, separators=(',',':')))`. `/go`'s 17 top-level
keys are unchanged and none of them is CI-related:

```
currentUser follows groups issues labels members mergeRequests milestones
nextIds notes projects repo snippets stars todos ui users
```

So the 1 037 KB of CI/CD data cost the mutable-state budget **exactly zero**,
which is the whole reason it is modelled the way the git modules are.

---

## 3 · The views

New file `src/pages/PipelinesCi.jsx` (five views), new helper
`src/utils/ci.js`, new route `/-/jobs/:id`, and `Pipelines` / `PipelineCharts`
/ `Jobs` deleted from `ProjectOps.jsx`.

| route | what it now does |
|---|---|
| `/:ns/:proj/-/pipelines` | real rows: status badge + ringed glyph, finished-at, commit title, `#id`, branch/MR ref, short SHA, commit-author avatar, `latest` / `yaml invalid` / `error` / `Auto DevOps` / `merge request` badges, triggerer, per-stage mini-graph, `Download artifacts`. **15 per page** with GitLab's numbered pager and a working `?page=N`. `Show Pipeline ID` ⇄ `Show Pipeline IID` toggles the `#` column between the two real columns. |
| `/:ns/:proj/-/pipelines/:id` | **200**, not 404. Header, commit title, info-well (`7 jobs for <ref> in 0 seconds (queued for 109 minutes and 10 seconds)`, badges, SHA + copy, related MR), tab bar with real `Jobs` / `Failed Jobs` counters, and the stage-column job graph with per-job status glyphs and the source's `title` tooltips. A yaml-error pipeline renders the source's `Unable to create pipeline` callout **and no tab bar**, exactly as the source does. An id from another project still 404s. |
| `/:ns/:proj/-/jobs` | real rows: status, `#job id`, ref + SHA, `allowed to fail`, `#pipeline id` + `created by`, stage, name, finish time. **30 per screen with the source's infinite scroll**, and the `All` badge caps at `1,000+` like the source. |
| `/:ns/:proj/-/jobs/:id` | new. Reached from three places on the pages above, so it exists rather than leaving those links pointing into a 404. Header, failure alert, `This job does not have a trace.` / `This job has been skipped`, and the right `.build-sidebar` with Finished / Queued / Commit / Pipeline and the sibling jobs of the same stage. |
| `/:ns/:proj/-/pipelines/charts` | `Success ratio` **computed**, not hardcoded: `success / (success + failed)`, falling back to `100.00%` only when the denominator is zero. That yields `0.00%` on every project with pipelines and `100.00%` only on the 108 with none — the source's own behaviour. Markup rebuilt to the source's `h4.gl-my-4` + two-column `.row` (the `Failed:` figure is a link into `?scope=all&status=failed`, as on the source) and a `btn-group` period switcher, not the tab bar round 4 guessed. |

### 3.1 Things read off the source rather than assumed

- **page sizes** — pipelines 15/page, jobs 30 with no pager
- **the pager rule** — window is `page ± 4`, clamped, with an ellipsis that
  would hide only one or two pages expanded into those pages. Derived by
  reading the pager off the source for **all 52 pages** of
  `openapi-generator` (26) and `keycloak` (16); it reproduces every one.
- **status vocabulary** — `failed` / `skipped` only; a failed `allow_failure`
  job is `failed-with-warnings` on the wrapper and **`status_warning`** in the
  sprite (not `status_failed`)
- **tooltips** — `code_quality - failed - (stuck or timeout failure) (allowed to fail)`
  but plain `container_scanning - skipped`: `(allowed to fail)` is appended
  only when the job actually failed
- **job order in a stage column** — codepoint order, confirmed on the widest
  pipeline the instance has (`openapi-generator` #789, 13 jobs in `test`)
- **`Failed Jobs` tab** — present only when there is at least one; keycloak's
  #1726 shows `Pipeline · Needs · Jobs 0 · Tests 0`
- **the related MR** — GitLab's `all_merge_requests`, *including* the
  `by_commit_sha` half. `primer/design` has two MRs off
  `github/fork/mbappai/patch-2` and the source lists only `!303`, because only
  !303's diff contains pipeline 1828's commit. `merge_request_diffs.json`
  already carries each MR's commit list, so the filter is exact.
- **container width** — the pipelines list and CI/CD analytics sit in the usual
  1280px `container-limited` box; `/-/pipelines/:id` is full width and
  `/-/jobs/:id` is full width minus its 290px `.build-sidebar`. Added a `wide`
  option to `usePageChrome` for that.
- **icons** — `status_failed`, `status_skipped`, `status_success`,
  `status_warning`, `status_canceled`, the two `*_borderless` variants,
  `calendar`, `branch`, `commit` and `download` lifted verbatim from the
  container's own sprite. The `status_*` family is the one group in that sprite
  that is not a single path on a 16×16 box, so `Icon.jsx` grew a small
  multi-path branch for it.

### 3.2 One deliberate substitution, and one deliberate omission

- The CI/CD analytics **charts are ECharts canvases** on the source. The mock
  keeps the only text an evaluator can read off the duration chart — the real
  short SHAs of the last 30 pipelines, oldest first — and the live
  `Date range: 01 Aug - 08 Aug` line, computed against the real clock like
  every other relative date in the mock.
- The source's Vue tree nests the date-range line in a second, empty `<p>`
  (`<p><p>…</p></p>`). React refuses to render that and logs a
  `validateDOMNesting` **console error on every load**, so the mock renders one
  `<p>`. Identical visible text, and the round's zero-console-error rule holds.

---

## 4 · Per project — does the source have pipelines, does the mock now match?

Measured side by side against the live source at **1280×720 and 1920×1080**,
`0` console errors and `0` pageerrors at both. 20 pages × 2 viewports ×
{source, mock} = **70 page pairs, 0 with differences.**

Compared per pair: `<title>`, the `All` count badge, row counts, every status
label, every commit title, every `#id`, every ref, every short SHA, the badge
strip, the pager text, the pipeline header line *in full*, the commit title,
the tab bar, the stage-column titles, every graph job and its tooltip, every
job id / stage / name / pipeline id, the analytics statistics list, the job
sidebar, and horizontal overflow.

| project | source pipelines | source jobs | mock now matches |
|---|---|---|---|
| `byteblaze/a11y-webring.club` | **1** | 7 | ✅ list, `/1823` (200), jobs, `/jobs/16323`, charts (`0.00%`) |
| `a11yproject/a11yproject.com` | **7** | 49 | ✅ list, `/1820`, jobs (`All 49`, 30 then 49 on scroll), charts |
| `primer/design` | **3** | 21 | ✅ list, `/1828` (incl. the single related MR `!303`), jobs, charts |
| `byteblaze/empathy-prompts` | **2** | 14 | ✅ list, `/1825`, jobs, charts |
| `root/metaseq` | **11** | 66 | ✅ list, `/21`, jobs, charts |
| `byteblaze/dotfiles` | **0** | 0 | ✅ **still empty** — the source's empty state, unchanged |
| `OpenAPITools/openapi-generator` | **389** | 5 446 | ✅ `All 389`, 15/page, pager identical on all 26 pages, `/789` (14 jobs), jobs `All 1,000+`, charts |
| `firstcontributions/first-contributions` | **2** | **0** | ✅ `0 jobs`, `yaml invalid` + `error` + `merge request` badges, `Unable to create pipeline` callout and no tab bar |
| `keycloak/keycloak` | **231** | 2 593 | ✅ list + pager (16 pages), `/1726` (skipped MR pipeline, **no `Failed Jobs` tab**), charts (`Total 231 · Failed 227`) |

`byteblaze/dotfiles` is the control and it is the important one: it is the
project every round-4 capture came from, it genuinely has nothing, and it still
renders the source's empty state. The only text the mock adds there is
`Clear runner caches` / `CI lint` / `Run pipeline` — three affordances the
**authenticated** capture `assets/html/proj-pipelines.html` has and the
anonymous source hides, i.e. the mock being correct for a logged-in maintainer.
Round 4 rendered `CI lint` as a root-relative `/-/ci/lint` and `Run pipeline`
as a bare button; both now carry the capture's real hrefs and testids, and
`ROUTES.md` rows 107a/107b log the two target pages honestly as `[ ]`.

### 4.1 Behaviour, not just pixels

| check | result |
|---|---|
| `/-/pipelines/:id` for an id that belongs to the project | **200** (source 200) |
| …for an id that belongs to a **different** project (`dotfiles/-/pipelines/1823`) | **404** (source 404) |
| …for an id that exists nowhere (`999999`) | **404** (source 404) |
| `/-/jobs/:id`, same three cases | 200 / — / **404**, matching |
| `?sid=` survives clicking a pipeline row, then a graph job | **kept** — the CI views use plain `<a href>` so App.jsx's delegated interceptor carries it (a `<Link>` swallows the click and drops `sid`) |
| `?page=N` deep link, and the pager's own clicks | ids identical to the source on pages 1, 2 and 26; clicking `Go to page 3` produces `?sid=…&page=3` |
| jobs infinite scroll | 30 rows → 49 after scrolling, on a 49-job project |
| `Show Pipeline ID` ⇄ `IID` | `#21 #20 #19` ⇄ `#14 #12 #11` — both real columns |
| `/go` `state_diff` after browsing the whole CI surface | `{}` — the CI views are read-only, as they must be |

---

## 5 · The P2 residuals

| id | what it was | status |
|---|---|---|
| **DIFF-1101** | `.commit-header` rendered `26 Jan, 20231 commit`; header 21px vs 32; commit rows taller than the source's and the title a blue link where the source uses bold near-black | **CLOSED** |
| **DIFF-1102** | role badges had the right text but no chip styling | **CLOSED** |
| **DIFF-1103** | `<title>` on `/-/settings/repository` put `· Settings ·` in the wrong place | **CLOSED** (and five sibling pages with it) |
| **DIFF-1104** | file-tree columns 182/685/91 vs 319/319/319; the commit column never ellipsised | **CLOSED** |
| **DIFF-1106** | sidebar assignee / label picker needed a second click | **CLOSED** |

**DIFF-1101.** The missing whitespace text node is restored in both the MR
Commits tab and `/-/commits/:ref`. Measured after: header `32px · 5px 10px ·
#fbfafd · "26 Jan, 2023 1 commit"` — identical to the source. Commit rows were
103px against the source's 62; the cause was `li.commit.flex-row` never being
`display:flex`, so the 40px avatar stacked above the title instead of sitting
beside it, plus `.d-none` having no `sm` breakpoint to re-show the avatar and
the sha chip and to hide the mobile-only `· <sha>` line. Rows are now 63px
(source 62–63, a sub-pixel line-box difference), the title is 600-weight
`--gray-900`, and avatar / sha-chip / mobile-sha visibility all match.

**DIFF-1102.** Both chips now match the source on every measured axis. The
issuable header keeps GitLab's legacy `.user-access-role` outline pill (12px,
`1px solid #dcdcde`, radius 100px, `0 8px`, `--gray-500`) and carries its real
`d-none d-xl-inline-block`; a note's author uses the source's exact class list
`badge gl-bg-transparent! gl-inset-border-1-gray-100! gl-mr-3 badge-muted
badge-pill gl-badge md` (12px, `4px 8px`, radius 160px, `--gray-600`,
transparent fill with an inset border). `global.css` grew the one media query
that makes `d-xl-inline-block` mean what it means on the source — without it,
carrying the class would have hidden `Contributor` outright.

**DIFF-1103.** `assets/html/` has an authenticated capture for each settings
page and they disagree with each other on purpose, so each caller now passes
the capture's own leading segment verbatim: `Repository · Settings`,
`CI/CD Settings · CI/CD · Settings`, `Integrations · Settings`, `Project Access
Tokens · Settings`, `Monitor Settings · Settings`, `Package and registry
settings · Settings`. Reproducing GitLab's inconsistency is cheaper than
inventing a rule it does not have.

**DIFF-1104.** The mock's tree table carried an extra `gl-table` class the
source does not have, which pulled in `.gl-table th/td` (12px headers, 12px
cells) and left the table on `table-layout:auto`. Dropping it, defining
`.gl-table-layout-fixed`, matching the source's `10px 16px` cells, and nesting
the icon inside `a.tree-item-link.str-truncated` the way the source does gives,
at **both** 1280 and 1920:

| | source | mock before | mock after |
|---|---|---|---|
| `Name` / `Last commit` / `Last update` widths | 319 / 319 / 319 | 182 / 685 / 91 | **319 / 319 / 319** |
| row height | 42 px | 59 px | **42 px** |
| `.tree-commit-link` | `hidden · ellipsis · nowrap · 100%` | `visible · clip · normal · none` | **`hidden · ellipsis · nowrap · 100%`** |
| `a11y-webring.club` overview height | 2 780 px | 3 185 px | **2 715 px** |

**DIFF-1106.** `SelectDropdown` grew a `defaultOpen` prop that the seven
sidebar callers set and the issuable **forms** deliberately do not — the source
renders those closed. One click on `Edit` in `.block.assignee` now yields
`dropdown show` with the menu at `display: block`; picking `Administrator`
lands, survives a reload, and `/go` reports the `issues` diff. Labels behave
the same (13 options after one click).

Deferred, as instructed: **DIFF-906**'s attachment dropzone and **DIFF-907**'s
GPG badge and per-type file icons.

---

## 6 · Method — how every number above was obtained

**Read-only discipline, kept.** Every DB access was a `SELECT` through
`docker exec gitlab gitlab-psql`; no `UPDATE`/`INSERT`/`DELETE`, no writes
through the source UI, **no `?sort=` URL loaded on port 8023**, and every HTTP
request to 8023 was anonymous (so nothing could be persisted onto a logged-in
user's record). The only non-`?page=` query strings used were none.

Scripts, all in `/tmp/r12/`:

| script | what it establishes |
|---|---|
| `pull.py` | the seed: psql (`ci_pipelines`, `ci_builds`, job specs, `started_at`) + `/-/pipelines.json?page=N` for every project that has pipelines |
| `curate.py` | the lossless re-encoding into `src/data/ci_pipelines.json`, with an assertion per project that the row count matches psql |
| `verify.py` | **70 page pairs** — 20 pages × 2 viewports × {source, mock}, 20 fields per page, console + pageerror counted |
| `geo.py` | layout boxes (`#content-body`, `.nav-sidebar`, `.right-sidebar`, h-scroll) mock vs source, 40 route/viewport pairs |
| `ab.py` | the CSS blast-radius A/B: 48 routes × 2 viewports rendered with and without the round's stylesheet |
| `p2.py` / `p2b.py` | DIFF-1101 / 1102 / 1104 computed styles and geometry, both sides |
| `pager.py` | the pager rule, read off all 52 pages of two projects |
| `func.py` | 404s, `?sid=` survival, `?page=` deep links, infinite scroll, the ID/IID toggle, state size |
| `sidebar.py` | DIFF-1106 — one-click open, pick, reload, `/go` diff |
| `network.py` | zero off-origin requests |
| `overflow.py` | which element overflows, when one does |
| `assets/route_smoke.py` | the repo's own cold-load guard, 201 routes, fresh sid each |

### 6.1 The CSS blast radius, measured rather than asserted

Round 12 needed GitLab utility classes (`gl-p-5`, `gl-text-truncate`,
`gl-flex-wrap`, `gl-line-height-36`, …) that earlier rounds had left undefined.
Defining them globally is "more correct", and it moved the page **height** of 8
measured routes — project overviews, blob, tree, issue and MR detail — without
changing a character of their text. Round 8's responsive geometry is a
protected contract, so:

- every new utility is scoped to the CI/CD containers
  (`.pipelines-container`, `.js-pipeline-container`, `.build-page`,
  `.build-sidebar`, `.pipeline-charts`, `.jobs-container`, `.ci-table`);
- the CI-specific rules that share a class name with existing markup
  (`.info-well`, `.commit-box`, `.page-content-header`, `.b-table-fixed`,
  `.gl-w-*`, `.commit-row-message`, `.gl-alert-danger`) are scoped the same way;
- Bootstrap's `.row` grid is scoped with `:has(> .col-md-6)` so the bare `.row`
  wrappers on EditIssue, NewProject, ExploreTopics and the ProjectOps empty
  states keep the block layout round 8 measured them in.

Re-run of the A/B after scoping: **96 route/viewport pairs · 0 with geometry
change · 0 with text change.** The stylesheet's only effect outside the CI/CD
subtree is the three P2 fixes that were asked for (DIFF-1101/1102/1104), each
measured against the source in §5.

---

## 7 · Verification

Dev server on 5311, live source on 8023, side by side, at **1280×720 and
1920×1080**.

| check | result |
|---|---|
| CI/CD page pairs vs the source (20 pages × 2 viewports × 2 sides, 20 fields each) | **70 pairs · 0 differences** |
| console errors / pageerrors across that sweep | **0 / 0** at both viewports |
| horizontal scroll on any CI page at 1280 and 1920 | **0** (the 3 456px-wide 14-job graph scrolls inside its own box, as on the source) |
| layout boxes vs the source, 40 route/viewport pairs | 8 differ, **all pre-existing** and none on a route this round introduced — logged in `TODO.md` Known Gaps 7 |
| CSS blast radius outside the CI/CD subtree | **0 geometry, 0 text** across 96 route/viewport pairs |
| `assets/route_smoke.py` (cold load, fresh `?sid=` per route) | **201 routes · 0 failing** |
| off-origin network requests from the CI pages | **0** |
| cold `/go` state size | **2 076 882 bytes = 1.981 MiB — unchanged** |
| `/go` `state_diff` after browsing the whole CI surface | `{}` |
| `npm run build` | ✓ 173 modules, only the pre-existing chunk-size advisory |
| seed vs Postgres | pipeline-id set **and** job-id set identical; 0 count mismatches (§2.0) |
| DIFF-1101 / 1102 / 1103 / 1104 / 1106 | closed and measured against the source (§5) |

Side-by-side full-page captures at 1920×1080 are in
`assets/screenshots/diff/r12_{source,mock}_*.png` — 12 pages, including the
`dotfiles` empty-state control and the three P2 pages.

**The screenshots earned their keep.** Two defects survived a 70-pair *text*
comparison and were only visible in a picture: the mini-graph's stage bubbles
stacked vertically (and `#789 <ref> <sha>` broke onto three lines) because
`gl-display-inline` / `gl-display-inline-block` were undefined and fell back to
`display:block`; and `.ref-name` / `.commit-sha` rendered in the body font where
the source uses Menlo. Both are fixed, and the pipelines-table row is now 112px
against the source's 111. Text-diffing alone would have shipped both.

### 7.1 What this does NOT claim

- The **anchor contract was not re-run end to end.** 145/145 anchor routes cold
  load clean (they are inside route_smoke's 201), but the 189 `page_anchors`
  are mostly *post-condition* assertions — `/byteblaze/2019-nCov` only exists
  after the agent creates it — so checking them without replaying the task is
  meaningless. The evidence that this round did not disturb them is the A/B
  above: **zero text change on 96 route/viewport pairs outside the CI subtree**,
  and no CI route is referenced by any of the 204 tasks.
- **Task replays were not re-run.** Round 11 replayed 30; nothing here touches a
  flow they exercise, and DIFF-1106's picker flow is verified directly in §5.
- `/-/ci/lint` and `/-/pipelines/new` are **not implemented**; the two buttons
  that link to them now carry the source's real hrefs and `ROUTES.md` rows
  107a/107b say so with an honest `[ ]`.
- The mock's `/-/tree/:ref` does not render the README below the file list
  where the source does (source 2 540px vs mock 1 359px page height). Noticed
  while measuring DIFF-1104, **pre-existing**, not in any DIFF, not fixed here.

---

## 8 · Files changed

| file | change |
|---|---|
| `src/data/ci_pipelines.json` | **new** — 1 037 KB static seed, 1 465 pipelines / 14 179 jobs / 67 projects |
| `src/utils/ci.js` | **new** — the read-only accessors and derivations over it |
| `src/pages/PipelinesCi.jsx` | **new** — pipelines list, pipeline detail, jobs list, job detail, CI/CD analytics |
| `src/pages/ProjectOps.jsx` | `Pipelines` / `PipelineCharts` / `Jobs` removed; the round-4 "no pipelines on this instance" claim corrected |
| `src/App.jsx` | `/-/pipelines/:id` → `PipelineDetail` (was `NotFound`); new `/-/jobs/:id`; imports repointed |
| `src/components/layout/Icon.jsx` | the `status_*` sprite family (multi-path, 14×14 / 22×22) + `calendar` / `branch` / `commit` / `download`; new `CiStatusIcon` wrapper |
| `src/components/layout/Layout.jsx` | new `wide` chrome option — pages that render in a bare `container-fluid` |
| `src/styles/global.css` | the CI/CD stylesheet, scoped; DIFF-1101/1102/1104 fixes; `sm` and `xl` breakpoints where the source relies on them |
| `src/pages/RepoTree.jsx` | DIFF-1104 — table class list and the file-name cell |
| `src/pages/MergeRequestDetail.jsx`, `src/pages/RepoCommits.jsx` | DIFF-1101 — the whitespace text node; DIFF-1106 — `defaultOpen` |
| `src/pages/IssueDetail.jsx`, `src/pages/NotesTimeline.jsx` | DIFF-1102 — the two role chips; DIFF-1106 — `defaultOpen` |
| `src/components/issuable/Controls.jsx` | DIFF-1106 — `defaultOpen` on `SelectDropdown` / `UserSelect` / `MilestoneSelect` / `LabelSelect` |
| `src/pages/ProjectSettingsRepo.jsx`, `src/pages/ProjectSettingsMisc.jsx` | DIFF-1103 — six page titles |
| `ROUTES.md` | row 106 corrected (it stated the opposite of the source), row 107 expanded, rows 107a/107b added as honest `[ ]` |
| `SCHEMA.md` | static-module count 10 → 11, `ci_pipelines.json` documented, state-size figure re-measured |
| `assets/data_model.md` | new §11b — shape, encodings, provenance, and why it is static |
| `TODO.md` | Known Gaps 6 and 7 |
| `assets/screenshots/diff/r12_*.png` | **new** — 24 full-page captures, 12 pages × {source, mock} |

---

## 9 · Status

- [x] Step 1 — establish what the source actually has, per project
- [x] Step 2 — extract a lean STATIC seed; state size measured before and after
- [x] Step 3 — implement the views to match the source
- [x] Step 4 — correct `ROUTES.md` row 106
- [x] Step 5 — document the seed in `SCHEMA.md` and `assets/data_model.md`
- [x] DIFF-1103, and DIFF-1101 / 1102 / 1104 / 1106
- [~] DIFF-906 dropzone and DIFF-907 GPG badge / file icons — **deliberately
      left deferred**, as instructed
