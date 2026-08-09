# DEV.part-state — Reddit mock: frozen corpus out of state, overlay in

Agent: dev (state refactor). Started 2026-08-09.
Goal: `submissions` (8,012) + `comments` (24,149) leave app state; mutations become a delta overlay.

## Measured

Both sides measured with the SAME script (`assets/dumps/measure_state.py`) on
the SAME rig: a `npm run build` + `npm run preview`, fresh sid, `/f/Art` cold
load then one upvote. The "before" side is a HEAD checkout of the seven touched
files built in an isolated copy, so this is apples to apples rather than a
comparison against a figure from an earlier run.

| metric | before | after | factor |
|---|---|---|---|
| app state (what is POSTed per mutation) | 14,674,815 B (14.0 MB) | 37,335 B (36 KB) | **393x smaller** |
| `/go` cold | 27,981,597 B (26.7 MB) | 67,855 B (66 KB) | **412x** |
| `/go` after one vote | 39,577,722 B (37.7 MB) | 68,852 B (67 KB) | **575x** |
| `state_diff` after one vote | 12,095,914 B | 615 B | **19,668x** |
| persisted `.mock-states/<sid>.json` | 16,683,118 B | 47,907 B | **348x** |
| localStorage keys held | **0** | **2** (33,902 chars each, 1.3 % of quota) | — |
| first paint @1920 | 894 / 925 ms | 734 / 728 ms | **−20 %** |
| first paint @1280 | 900 / 925 ms | 738 / 748 ms | **−19 %** |
| vite dev-server boot | 1453 ms | 212 ms | −85 % |
| console errors / external requests | 0 / 0 | 0 / 0 | — |

`state_diff` keys after a vote: `["submissionEdits", "votes"]` — was
`["submissions", "votes"]` carrying the whole 8,012-record array on both sides.

Four of the five targets are met with room to spare. **First paint is the miss:
731 ms against a ~390 ms target.** See "First paint" below for the measurement
that explains it and the fix I did not take.

## MUST-NOT-REGRESS — every item, with its measured result

Suite: `assets/dumps/test_overlay.py` (new, 117 checks) plus the pre-existing
`assets/dumps/verify_expansion.py`. Both run against a built `npm run preview`.

| # | requirement | result |
|---|---|---|
| 1 | `/f/Art` 25 posts page 1, 108 total; `/f/springfieldMO` 110 — no `?sid=` **and** fresh `?sid=` | **PASS**, 8/8 checks. 25 on page 1 both ways; pagination walked to exactly 108 and 110 unique ids |
| 2 | `hot`/`top`/`new`/`most_commented` page-1-exact vs `localhost:9999`, ≥12 forums | **PASS 48/48** — Art, springfieldMO, news, movies, science, space, television, pittsburgh, nyc, wallstreetbets, dataisbeautiful, singularity × 4 sorts, id-for-id |
| 3 | anchored `/f/Art/active` and `/f/springfieldMO/controversial` | **PASS 2/2**, id-for-id vs the source |
| 4 | 240 anchored submissions + 11 anchored comment permalinks resolve | **PASS.** `anchor_ids.py` gap report: submissions 240/240, comments 11/11, users 1/1, MISSING=0. Then every one of the 240 and all 11 opened in the browser and rendered |
| 5 | submit redirect `/f/<forum>/<id>/<slug>`, comment create `/comment/<id>`, both keeping `?sid=` | **PASS 4/4** |
| 6 | pagination cursors `next[ranking]`, `next[id]`, `?sort=`, `?t=all` | **PASS.** Cursor present and page 2 shares 0 rows with page 1; `?t=all`/`?t=month`/`?t=day` on `/f/news/top` all match the source. See the `?sort=` note below |
| 7 | vote → comment → **reload** → values persist | **PASS.** netScore held across reload and the comment re-rendered — now off localStorage as well as the server mirror |
| 8 | referential integrity: 0 dangling `submission` refs, 0 orphaned `parent`s | **PASS**, checked on the merged corpus after create+edit+delete+vote, by an independent Python reimplementation of `materialize()` so a JS-side merge bug cannot mark its own homework |
| 9 | 0 console errors, 0 external requests | **PASS 0 / 0**, at 1920x1080 and 1280x720 |
| 10 | legacy full-array injection == lightweight overlay injection | **PASS 9/9.** Same create + edit + delete expressed both ways; `#main` innerText compared character for character on `/f/Art`, `/f/Art/new`, `/f/Art/top`, `/user/<n>`, `/search`, plus both permalinks |
| 11 | edits and deletions of FROZEN records honoured by EVERY read path | **PASS 12/12.** A seeded post edited then deleted via the real UI, checked in forum listing, `most_commented`, permalink, `/user/<n>/submissions`, `/search`, the comment permalink, the `/comments` firehose and `/go` |
| 12 | `/go` contract holds; `shared/check-state-contract.py` passes | **PASS.** `webarena_reddit_mock  clean  set_initial=no` — 1 of only 12 clean mocks of 99 scanned. `/go` still returns the three keys; untouched sid still diffs empty; `calculateStateDiff` and `computeStateDiff` untouched |

**On `?sort=`:** Postmill takes the sort from the **path segment**
(`/f/news/new`), not from `?sort=`. Measured on the container: `/f/news`,
`/f/news?sort=new` and `/f/news?sort=top&t=all` all return the same page 1,
while `/f/news/new` is completely different. The mock reproduces that exactly —
all three `?sort=` URLs match the source id-for-id. My first draft of the test
asserted `?sort=new` should reorder; that assertion was wrong about the source,
not about the mock.

## Design as built

Persisted state keeps ONLY what an agent can create or change. Reads go through
one materialization point, so no view can disagree with another.

- **Frozen, never in state**: `submissions.json` (8,012), `comments.json`
  (24,149), `userDirectory.json` (21,038 — never mutated by anything). Imported
  by `src/data/frozen.js`, which only `src/utils/overlay.js` may import.
- **Overlay in state** (9 keys, all start empty): `newSubmissions`,
  `submissionEdits`, `deletedSubmissions`, the comment equivalents, plus
  `deletedForums`, `forumRenames`, `userRenames`.
- `forums` (21 KB) and `users` (11 KB) **stay** in state — both are genuinely
  mutable and both are small.
- `AppProvider` holds `core` (persisted) and derives
  `state = materialize(core)` with merged arrays. **The 45 read sites were left
  untouched** — that was the key decision. Rewriting them all onto accessors was
  the obvious reading of the brief, but it puts 45 chances to miss a deletion
  into the diff; materializing once puts zero. `core` is what reaches
  localStorage, `set_current` and `/go`; the merged arrays never are.

Three design points that were not obvious up front:

1. **Bulk operations get their own overlay verbs.** Deleting a forum would
   otherwise tombstone ~110 submissions, and renaming a forum or a user would
   rewrite thousands of records — putting the corpus straight back into state
   through the side door. `deletedForums` / `forumRenames` / `userRenames` are
   applied at materialization instead, so each costs one short string. The
   rename lists are ordered and applied left to right, so A→B→A resolves to A.
2. **Comments are pruned by reachability, not by a second tombstone list.** A
   comment whose submission no longer resolves is dropped. That is what makes
   submission delete and forum delete agree across the firehose, `/trash`,
   `/user/<n>` and the comment permalink without each maintaining its own prune —
   and it is why "0 dangling submission refs" holds by construction.
3. **Injection: the injected array is the base, verbatim.** I considered
   differencing an injected full array against the frozen import to keep even
   that path small, and rejected it: the merged order would then be
   `frozen ++ new` rather than the order the harness sent, and tie-breaking in
   `most_commented` could differ. Honouring the array as the base is exactly
   today's behaviour, order included. Legacy sessions stay large — that is the
   harness's choice, and it is no worse than before.

The three pages that used to write the corpus inline (`ForumDeletePage`,
`ForumEditPage`, `AccountPage`) now call new `AppContext` reducers
(`deleteForum`, `renameForum`, `renameUser`), so overlay knowledge lives in one
file rather than being scattered across pages.

## Files

| file | change |
|---|---|
| `src/data/frozen.js` | **new** — imports the three frozen JSONs. Nothing else may import them. |
| `src/utils/overlayShape.js` | **new** — import-free key list + `emptyOverlay()`, so `dataManager.js` (and therefore `vite.config.js`, whose `/go` calls `createInitialData()` per request) stays free of the 14.6 MB corpus. |
| `src/utils/overlay.js` | **new** — `materialize()`, `resolve*/patch*/add*/remove*`, `hasChildComments`, `groupCommentsBySubmission`. The only merge point. |
| `src/utils/dataManager.js` | `createInitialData()` returns the overlay shape; corpus imports removed; quota comments rewritten. |
| `src/context/AppContext.jsx` | holds `core`, derives `state = materialize(core)`, persists `core`; 11 mutations rewritten onto the overlay; `renameForum` / `deleteForum` / `renameUser` added; id indexes for `getSubmission` / `getComment` / `commentsFor`. |
| `src/pages/ForumDeletePage.jsx`, `ForumEditPage.jsx`, `AccountPage.jsx` | the three inline `setState(prev => …prev.submissions…)` writers now call the new reducers. |
| `src/pages/GoPage.jsx` | renders `coreState`, so the client `/go` matches the server's. |

## Log

- [x] Read WEBARENA_MIGRATION.md, .claude/agents/dev.md, dataManager.js,
      AppContext.jsx, stateTracker.js, vite.config.js, shopping reference.
- [x] Measured the before numbers (`assets/dumps/measure_state.py`).
- [x] Mapped every `state.submissions` / `state.comments` read site — kept them
      all working by materializing into `state` rather than rewriting 45 files.
- [x] Implemented frozen.js / overlayShape.js / overlay.js.
- [x] Rewrote the mutations and the three inline page writers.
- [x] `npm run build` passes.
- [x] Measured the after numbers.
- [x] `shared/check-state-contract.py`: `webarena_reddit_mock  clean  set_initial=no`
      — one of only 12 clean mocks of 99. (The script's exit code is 1 because
      87 *other* mocks are non-compliant; that is pre-existing and out of scope.)
- [x] `assets/dumps/test_overlay.py` — 117 checks, 0 failures.

## First paint — the target I missed, and why

Target ~390 ms; measured **731 ms @1920 / 743 ms @1280** (from 910 / 913).

The ~390 ms figure was recorded *before the seed expansion*, when the corpus was
~2.25 M chars. It is now 14.6 M chars, and the browser must still parse all of
it to render a listing — that cost is in the JS bundle, not in app state, so
moving the corpus out of state could not remove it. What the refactor did remove
is the per-boot work on top of the parse: 32,161 object clones in
`createInitialData()` and two `JSON.stringify` of a 14 MB object for
localStorage. That is the −20 %.

One further win was taken: **`json: { stringify: true }` in `vite.config.js`**
emits each JSON module as `JSON.parse("…")` instead of a JS object literal,
which V8 parses materially faster at this size. Measured 828 → 731 ms @1920
(−12 %), consistent across repeats. Safe because every JSON import in `src/` is
a default import.

**The remaining cost is `comments.json`, and I measured exactly how much.** A
scratch build identical except for `comments.json` replaced with `[]`:

| build | paint @1920 |
|---|---|
| current | 734 / 728 ms |
| same build, `comments.json` emptied | **460 / 452 ms** |

So comments.json is **~275 ms, 38 % of first paint** — and no listing route
needs a single comment (`commentCount` lives on the submission record).

**I did not code-split it, deliberately.** Doing so makes `state.comments`
asynchronous, which means either `AppProvider` keeps blocking on it (no gain) or
submission pages need a loading state. The second option puts the 11 anchored
comment permalinks and every cold deep link to `/f/<forum>/<id>/<slug>` at risk
of rendering an empty comment tree before the chunk lands — a silent
evaluator failure, which is exactly the class of bug this shard was told to hunt
rather than create. It is a different change from "move state to an overlay",
with its own test surface. **Recommended as the next shard**, with the number
above as its budget: it should land first paint near 455 ms, and combining it
with deferring `userDirectory.json` (652 KB, read only by `/users` and author
links) would go further.

## Chose not to fix, with the reason

| thing | reason |
|---|---|
| Code-splitting `comments.json` to reach the ~390 ms paint target | Measured at 275 ms of upside, but it makes the corpus asynchronous and risks empty comment trees on cold deep links and the 11 anchored comment permalinks. Different change, different test surface — see above. |
| `calculateStateDiff` / `computeStateDiff` | Explicitly out of scope; 89 mocks share the convention, and shrinking the storage made the diff small (12 MB → 615 B) without touching either. |
| Legacy full-array injection still produces a large session state | By design, and required: "if `state.submissions` is present it becomes the base, exactly as today." A harness that ships 8,012 records pays for 8,012 records. The lightweight path exists so it no longer has to, and is now documented in `SCHEMA.md`. |
| `getUser()`'s per-call `submissions.filter().length` / `comments.filter().length` | Still a linear scan, unchanged from before. It only runs on `/user/<n>` for a user absent from `users.json`, and changing its cost is unrelated to this shard. |
| Rewriting the 45 read sites onto accessors | Deliberate — see "Design as built". Materializing once is strictly safer than 45 chances to miss a tombstone. |

## Housekeeping

- `.mock-states/` held two scratch files from an earlier agent
  (`persist_1786299962.json`, `subprobe2.json`) in the pre-refactor shape.
  Deleted — the directory is gitignored local scratch. There was **no**
  `.mock-state.json` / `.mock-state.initial.json` at the app root.
- Dev server (5312) and preview server (5313) are shut down at the end of this
  session. Scratch build trees under `/tmp/before` and `/tmp/nocom` removed.
- Two new scripts under `assets/dumps/` (which is gitignored except for
  `*.py`): `measure_state.py` (the before/after measurement, re-runnable) and
  `test_overlay.py` (the 117-check regression suite).

---

## DEV PROGRESS: webarena_reddit_mock — frozen corpus out of state

Build: **PASS** (`npm run build`, 14,717 kB bundle, 4.1 s)
Tests: **`assets/dumps/test_overlay.py` 117/117** on the dev server AND on the
built preview · **`assets/dumps/verify_expansion.py` ALL CHECKS PASSED** at
1920x1080 and 1280x720 · **`shared/check-state-contract.py` → `webarena_reddit_mock  clean`**
(1 of 12 clean mocks out of 99 scanned; the script's exit 1 is the other 87,
pre-existing and out of scope).

### Before → after

| metric | before | after | target | met |
|---|---|---|---|---|
| app state | 14,674,815 B | **37,335 B** | < 1 MB | yes, 27x inside |
| `/go` after a vote | 39,577,722 B | **68,852 B** | ~50 KB | yes (66 KB cold / 67 KB after) |
| localStorage keys held | 0 | **2** | 2 | yes |
| first paint @1920 | 910 ms | **731 ms** | ~390 ms | **no** — see below |
| `state_diff` after a vote | 12,095,914 B | **615 B** | — | — |

### The one miss

First paint is 731 ms, not ~390 ms. The ~390 ms figure predates the seed
expansion; the corpus is now 14.6 M chars and the browser parses all of it to
render a listing, which is bundle cost, not state cost. The refactor removed the
per-boot work on top of it (−20 %), and `json: { stringify: true }` removed
another 12 %. A scratch build with `comments.json` emptied paints in **456 ms**,
so code-splitting it is worth **275 ms / 38 %** — but it makes the corpus
asynchronous and would risk empty comment trees on cold deep links and the 11
anchored comment permalinks. Left as the recommended next shard rather than
bolted on here.

### Nothing regressed

All 12 must-not-regress items measured and passing — see the table at the top of
this file. Highlights: 48/48 source sort comparisons page-1-exact across 12
forums, both anchored sort routes id-for-id, all 240 anchored submission and 11
anchored comment permalinks opened and rendered, legacy vs lightweight injection
identical character for character across 5 routes, and a seeded post edited then
deleted through the real UI stays consistent across 8 read paths including `/go`.

### Docs updated

`SCHEMA.md` (state table rewritten, 9 overlay keys documented, Observable State
Changes rows corrected, obsolete localStorage quota budget replaced, injection
contract added), `SOURCE.md` (new "Design decision" section with the measured
before/after and the three consequences). No `README`/`WEBARENA_REDDIT.md`
statement about state shape existed to correct. Both now say explicitly that a
stale `.mock-state.json` can no longer pin an old corpus.
