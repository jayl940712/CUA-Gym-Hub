# DEV part-merge — gitlab seed expansion merge + verify

Serial step after `2f77c4a8b` (state refactor) and the extraction agent's staged
`assets/dumps/expansion/`. Job: run `merge.py`, verify nothing regressed, decide
the first-paint question, commit.

Rig: `PATH=/tmp/node-v20.18.1-linux-x64/bin`,
`LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu:/tmp/sysroot/lib/x86_64-linux-gnu`.
Dev server 5321, preview server 5322.

---

## 0. Baseline, measured on THIS host before touching anything

`DEV.part-state.md`'s numbers reproduce, so before/after below is a like-for-like
comparison rather than a comparison against someone else's host:

| | part-state reported | measured here (pre-merge) |
|---|---|---|
| FCP `npm run dev` | 440 ms | **444 ms** (456 444 444 424 428) |
| FCP `npm run preview` | 372 ms | **368 ms** (356 368 356 372 372) |
| cold `/go` | 2 997 B | **2 997 B** |
| cold state | 1 473 B | **1 473 B** |
| bundle | 7 480 108 B | 7 452 890 B JS + 51 kB CSS |

FCP method (`assets/dumps/fcp.py`, new): median of 5 cold loads of
`/byteblaze/dotfiles`, **interleaved** dev↔preview so host drift hits both
equally; fresh browser context and fresh `?sid=` per load.

Housekeeping: port 5321 was held by an orphaned vite from the state agent's
deleted `/tmp/gl-before` worktree (pid 2618521, cwd `(deleted)`). Killed it.

---

## 1. Merge — done, exactly as PLAN.md projected

`verify.py` → all checks passed. `merge.py` dry run → matched PLAN.md's table
row for row. `merge.py --apply` (slim file-content tier, the default) written.

| entity | before | after | factor |
|---|---|---|---|
| issues | 613 | **3 926** | 6.4x |
| merge_requests | 729 | **4 636** | 6.4x |
| notes | 1 599 | **12 648** | 7.9x |
| users | 1 133 | **1 858** | 1.6x |
| labels | 630 | **972** | 1.5x |
| milestones | 202 | **252** | 1.2x |
| resource_events | 1 207 | **8 089** | 6.7x |
| merge_request_diffs | 729 | **4 636** | 6.4x |
| repo_trees entries | 3 131 | **23 309** | 7.4x |
| commits | 1 990 | **4 539** | 2.3x |
| repo_files | 159 projects / 551 files | **171 projects / 1 863 files** | |
| projects | 175 | 175 (untouched) | |
| `src/data` total | 6.67 MB | **24.4 MB** | 3.7x |

`merge.py` asserts every pre-existing record is byte-identical before writing;
it wrote, so that assertion held for all 11 files. Originals saved as
`src/data/*.prexpand`.

### verify.py output (verbatim)

```
uniqueness
  ok   issues: 3926 unique ids          ok   issues: (project_id, iid) unique
  ok   merge_requests: 4636 unique ids  ok   merge_requests: (project_id, iid) unique
  ok   notes: 12648 unique ids
referential integrity
  ok   every author / assignee / label / milestone / target resolves
per-project distribution
  issues  before: 0=146  1-4=3  5-19=18  20-49=7  50+=1
  issues  after : 0=66   1-4=10 5-19=23  20-49=13 50+=63
  MRs     before: 0=143  1-4=6  5-19=16  20-49=9  50+=1
  MRs     after : 0=64   1-4=16 5-19=25  20-49=18 50+=52
  projects with >=1 issue: 29 -> 109   with >=1 MR: 32 -> 111
  projects with a file tree: 173   with real file content: 162
ALL CHECKS PASSED
```

109/111 is the upstream ceiling — the residual 66/64 projects are empty in the
source DB and were correctly not invented.

---

## 2. THE MOST IMPORTANT CHECK — the corpus did NOT leak back into state

The expansion is 3.7x more data and **every state-size number is byte-identical
to the pre-expansion baseline.** The overlay refactor is intact.

| | pre-expansion | post-expansion |
|---|---|---|
| cold state | 1 473 B | **1 473 B** |
| two localStorage keys | 2 946 UTF-16 (0.06 % quota) | **2 946 (0.06 %)** |
| cold `/go` | 2 997 B | **2 997 B** |
| `/go` after star | 4 315 B | **4 315 B** |
| `/go` after create issue | 3 858 B | **3 858 B** |
| `/go` after comment | 4 510 B | **4 510 B** |
| `/go` after merging a FROZEN MR | 4 179 B | 4 523 B |
| `/go` after invite member | 3 436 B | **3 436 B** |
| `state_diff` on untouched sid | `{}` | `{}` |

(The frozen-MR row differs only because the suite picks a different seeded MR to
merge now that there are 4 636 of them; still ~4.5 KB, not ~4 MB.)

`SEED_NEXT_IDS` re-verified independently against the EXPANDED seed — this was
the highest-risk item, since a counter landing inside the new id range would mint
duplicate ids and make `/go` report creations as edits to seed data:

```
project 193<194  group 6<7  issue 83820<83821  mr 139277<139278
note 310826<310827  label 1926<1927  milestone 589<590  member 205<206
collisions: 0
```

---

## 3. Must-not-regress battery

| check | baseline | now |
|---|---|---|
| `npm run build` | PASS | **PASS** (23 907 kB JS, 6 053 kB gzip) |
| `assets/route_smoke.py` | 201 routes, 0 failing | **201 routes, 0 failing** |
| 7 case-insensitive redirects keep `sid` | 7/7 | **7/7** |
| `assets/dumps/routes_sweep.py` | 116 driven / 116 pass | **116 driven / 116 pass** |
| external requests over 30 routes | 0 | **0** |
| `assets/dumps/test_overlay.py` @1920 **and** @1280 | 93 passed / 0 failed | **93 passed / 0 failed** |
| 13 creative flows end-to-end + reload + `/go` | all report | **all report** |
| frozen-record edit/delete honoured by every view | pass | **pass** |
| legacy vs lightweight injection | identical | **identical** |
| `shared/check-state-contract.py` | gitlab clean | **gitlab clean** |
| console errors | 0 | **0** |
| `assets/dumps/check_next_ids.py` | matches | **matches** |

---

## 4. THE DECISION POINT — first paint regressed, and it is real

| | before | after (slim) | delta |
|---|---|---|---|
| FCP `npm run preview` | 368 ms | **896 ms** | **+528 ms, 2.4x** |
| FCP `npm run dev` | 444 ms | **636 ms** | +192 ms, 1.4x |
| bundle JS | 7.45 MB | **23.9 MB** | 3.2x |
| bundle gzip | 1.98 MB | 6.05 MB | 3.1x |

Not shippable silently. Investigation below.

### Hypothesis tested and REJECTED: build-only `json: { stringify: true }`

`DEV.part-state.md` reverted `json.stringify` globally because it costs +1.1 s in
**dev**. That reasoning is dev-specific, and the corpus is now 3.7x bigger, so I
tested a variant the state agent did not: enable it for `command === 'build'`
only, leaving dev untouched.

| | preview FCP | bundle |
|---|---|---|
| slim, no stringify | 896 ms | 23.9 MB |
| slim, build-only stringify | **916 ms** | 25.8 MB |

No win — 20 ms worse, +1.9 MB. The state agent's conclusion holds at 24 MB too,
for a reason that is now clear: the cost is not JSON parse strategy, it is the
sheer volume of bytes fetched and evaluated. **Reverted; `vite.config.js` is
byte-identical to its committed state.** Do not retry this.

### Where the bytes actually go

Eager cost of `/byteblaze/dotfiles`, by module:

| module | KB | does the project-overview route need it? |
|---|---|---|
| notes | 4 452 | no |
| merge_requests | 3 444 | no |
| repo_files | 3 264 | only THIS project's README |
| issues | 3 041 | no |
| repo_trees | 2 425 | only THIS project's tree |
| merge_request_diffs | 2 163 | no |
| commits | 1 154 | only THIS project's tip |
| resource_events | 1 127 | no |
| ci_pipelines | 1 062 | no |
| tree_last_commits | 377 | only THIS project |
| contributors | 366 | no |
| users / projects / labels / rest | ~800 | yes |

~15.7 MB of the 23.9 MB is data this route never reads, and another ~7 MB is
per-project data of which it needs one project's slice.

Measured slope: 7.45 MB → 368 ms, 23.9 MB → 896 ms ⇒ ~32 ms/MB, ~130 ms floor.
Getting back to ~400 ms means an eager bundle around 8.5 MB.

### What I chose: one rollup chunk per seed module

The tell was that **preview regressed harder than dev** (2.4x vs 1.4x) even
though dev serves strictly more bytes. Dev already ships each JSON module as its
own file, so the browser fetches ~24 in parallel and parses each as it lands;
the production build was one 23.9 MB file that had to arrive *in full* before a
single byte could execute. The regression was mostly serialization, not volume.

`vite.config.js` now sets `build.rollupOptions.output.manualChunks` to emit one
chunk per `src/data/*.json`:

| | before merge | after merge, 1 chunk | after merge, per-module |
|---|---|---|---|
| FCP preview | 368 ms | 896 ms | **508 ms** (488 / 512 / 508 over 3 runs) |
| FCP dev | 444 ms | 636 ms | 628 ms (rollup does not run in dev) |
| dist | 7.45 MB | 23.9 MB, 1 JS file | 24 MB, **25 JS files** |

**Recovered 388 ms of the 528 ms regression for a 5-line config change.**

**What it cost: nothing semantically.** Every chunk is still a *static* import,
so the same bytes are fetched and all data is present on first render. No route
manifest, no readiness gate, no component change, no possibility of a route
rendering with a half-loaded corpus. Verified by re-running the whole battery
against the CHUNKED PREVIEW BUILD, not just dev — `route_smoke` 201/201,
`test_overlay` 93/0, `routes_sweep` 116/116.

**Residual: +140 ms vs the pre-expansion 368 ms, for 3.7x the data.** I am
shipping that rather than hiding it. It is a real cost and it is bounded and
measured.

### What I did NOT do, and why

**True lazy-loading (the shopping `ensureDetail` pattern).** This is the only
thing that closes the remaining 140 ms, and it is a genuine subsystem, not a
config change. `webarena_shopping_mock`'s version is ~250 lines of registry
(`src/utils/catalog.js`: 32 description shards + 64 search-index shards +
`ensureDetail` + `subscribeCatalogDetail` + a boot gate that must never reject).
GitLab needs more than shopping does, because shopping's lazy modules are
read-only catalog detail while gitlab's three biggest — `notes`, `issues`,
`merge_requests` — are **overlay collections that 79 write sites mutate**. Making
them lazy means `materialize()` can return `[]` for a collection that simply has
not landed yet, and every list, board, search and dashboard view would need a
readiness gate or it silently renders "no issues" — a P0 that looks like a
working page. Done wrong it breaks task anchors invisibly, which is exactly the
failure mode this mock cannot have.

That needs its own round with its own verification pass, so I stopped at the
change that is provably safe. The design work is done and the budget measured:

| module | KB | needed by `/byteblaze/dotfiles`? | shardable by |
|---|---|---|---|
| notes | 4 452 | no | issue/MR detail only |
| merge_requests | 3 444 | no | project |
| repo_files | 3 264 | one README | project |
| issues | 3 041 | no | project |
| repo_trees | 2 425 | one tree | project |
| merge_request_diffs | 2 163 | no | project |
| commits | 1 154 | one tip | project |
| resource_events | 1 127 | no | issue/MR detail only |
| ci_pipelines | 1 062 | no | project |
| tree_last_commits | 377 | one project | project |
| contributors | 366 | no | project |

Recommended order for that round, easiest and safest first:
1. `merge_request_diffs`, `ci_pipelines`, `contributors`, `resource_events`,
   `tree_last_commits` (5.1 MB) — **not in app state**, already behind accessors
   in `dataManager.js` / `utils/ci.js`, so no overlay interaction at all.
2. `repo_files` / `repo_trees` / `commits` sharded per project (6.8 MB) — also
   outside state; keyed by project already.
3. `notes` / `issues` / `merge_requests` (10.9 MB) — in state; needs the route
   manifest and a **fail-safe default of "load everything"** so an unlisted route
   is slow rather than wrong.

**`--files none`** was rejected as the fallback: it saves 2.2 MB (~70 ms by the
measured 32 ms/MB slope), would not have fixed anything on its own, and costs all
code browsing beyond READMEs. The chunk split is strictly better on both axes.

---

## 5. Anchor contract

`route_smoke.py` cold-loads all **145 anchor routes** (plus 56 more shells) —
201 routes, 0 failing, on both dev and the chunked preview build.

For the 252 anchor **strings** I wrote `assets/dumps/check_anchor_strings.py`,
and the first result was alarming: 238 of 243 page-bound pairs "missing". It is
not a real finding, and the way I established that is the point:

1. Built a worktree of the pre-merge commit `2f77c4a8b`, served it on 5323, and
   ran the **identical script** against both.
2. Result: **238 missing before, 238 after, and `comm` reports the two sorted
   sets are byte-identical — zero regressions, zero fixes.**

The absolute number is an artifact of the input. `shared/extract-task-anchors.py`
keys `anchor_strings` by string VALUE globally and unions `pages` across every
task that ever asserted it, so common values ("Private", "0", "@vinta") collect
the pages of dozens of unrelated tasks and the page x string cross-product then
demands each value on all of them. Many `program_html` `required_contents` are
also only expected *after* the agent acts, which a cold load cannot show. The
script's docstring now says all of this so the next agent does not read 238 as
238 broken anchors, and its summary line says the count is not a defect count.

One trap worth recording: my first version sampled `innerText` 250 ms after
`load`. The expanded build paints at 628 ms, the pre-merge one at 444 ms, so a
fixed sample would have read the slower build earlier in its own render and
**manufactured a regression out of pure timing**. It now waits for the DOM to go
quiescent. Any future before/after comparison on this mock needs the same care.

The strongest anchor guarantee is structural, not observational: `merge.py`
asserts every pre-existing record is byte-identical before writing, and it wrote.
The 175 projects and the 613/729/1 599 seed records that all 204 anchors resolve
against are unchanged.

---

## 6. Final state — the shipping build

| | value |
|---|---|
| `npm run build` | **PASS**, 24 MB dist, 25 JS chunks |
| FCP preview / dev | **508 ms** / 628 ms |
| cold state | **1 473 B** (unchanged) |
| cold `/go`, dev and preview | **2 997 B** (unchanged) |
| localStorage | **0.06 % of quota** (unchanged) |
| `route_smoke.py` dev / preview | **201/201** / **201/201** |
| `routes_sweep.py` | **116 driven, 0 failing**, 2 not-a-GET skips |
| `test_overlay.py` dev / preview, @1920 + @1280 | **93/0** / **93/0** |
| `check_next_ids.py` | matches, 0 collisions |
| `check-state-contract.py` | gitlab **clean** |
| console errors | **0** |
| external requests | **0** across 30 routes |
| anchor strings pre vs post | **identical sets, 0 regressions** |

## 7. Housekeeping

* `src/data/*.prexpand` (11 files, 6.7 MB) deleted after the build verified, per
  PLAN.md — they are NOT gitignored and would otherwise have been committed.
* `*.add.json` (~21 MB) deliberately **not** committed: intermediate artifacts
  fully derived from the container by the scripts, and their content is now in
  `src/data`. The scripts + `PLAN.md` ARE committed (`git add -f`, since
  `.gitignore`'s `!**/assets/dumps/*.py` negation is depth-1 only and does not
  reach `dumps/expansion/`) so the expansion is reproducible.
* I used `git add -f` rather than widening `.gitignore`, because `.gitignore` has
  another agent's uncommitted edit in it and I did not want to commit their work.
* `/tmp/glcache` left alone — it is a `/tmp` scratch cache, already outside the
  repo.
* Killed an orphaned vite (pid 2618521) from the state agent's deleted
  `/tmp/gl-before` worktree that was squatting on port 5321.
* `/tmp/gl-pre` worktree and ports 5321/5322/5323 released at the end.
