# DEV.part-lazy — per-project lazy loading of the gitlab corpus

Goal: first paint stops scaling with total corpus size. Architecture only — no seed
expansion this round.

## 0. Starting facts (verified by reading, not re-derived)

- `src/data/frozen.js` statically imports the 12 mutable seed modules; `src/utils/overlay.js`
  imports it; `src/context/AppContext.jsx` imports `overlay.js`. Whole corpus in the eager
  module graph on every route.
- `src/utils/dataManager.js` **also** statically imports 7 STATIC git modules
  (`repo_files` 3.3 MB, `repo_trees` 2.5, `commits` 1.2, `contributors` 0.37, `branches` 0.15,
  `tags` 0.024, `merge_request_diffs` 2.2) and exposes them as `staticRepo`.
  These are read through **synchronous accessors** (`getRepoFile`, `getRepoTree`,
  `getCommits`, `getBranches`, `getTags`, `getContributors`, `getMrDiff`, `contributorRefs`).
  The team-lead brief did not mention this second import site — it is ~9.7 MB, i.e. the
  larger half of the problem.
- Three more one-off static imports outside `dataManager`:
  - `src/utils/ci.js` → `ci_pipelines.json` (1.06 MB)
  - `src/pages/RepoTree.jsx` → `tree_last_commits.json` (0.38 MB)
  - `src/pages/NotesTimeline.jsx` → `resource_events.json` (1.15 MB)
  - `src/pages/ProjectOverview.jsx` → `repo_languages.json` (0.012 MB)
- Total `src/data`: 23.8 MB on disk.

## 1. Running log

(appended as work proceeds)

### Stage 1 — per-project chunks (LANDED, build passes)

`assets/dumps/build_lazy_chunks.py` slices 16.81 MB into `src/data/by-project/<id>.json`
(173 chunks; median 72.5 KB, p90 208 KB, max 539 KB = project 58). Moved out of the
eager graph: repo_files, repo_trees, commits, contributors, branches, tags,
tree_last_commits, merge_request_diffs, notes, resource_events, ci_pipelines.projects.

Runtime: `src/data/lazy.js` (registry + `import.meta.glob`), `useProjectChunk` gate in
`src/App.jsx` (App returns null until the route's chunk resolves — same early return that
already covered hydration), `AppContext` re-materializes on chunk load, accessors in
`dataManager.js` read the chunk instead of `staticRepo`.

Measured eager payload after Stage 1: **8.16 MB** (from ~24 MB).
Of that, `seed-issues` 2.93 MB + `seed-merge_requests` 3.27 MB = 6.2 MB — so Stage 2
(metadata index vs lazy bodies) is where the remaining win is.

Gotcha for anyone grepping this repo: `src/components/create/mutations.js` contains two
literal `\x00` bytes (FNV hash separators), so plain `grep` treats it as binary and
silently reports no matches. Use `grep -a`. That cost a build cycle here.

### Stage 2 — issue/MR metadata index + lazy bodies (LANDED, build passes)

`description` (2.91 MB, 54 % of issues.json and 35 % of merge_requests.json) moved into
the per-project chunks (`issueBodies` / `mrBodies`) plus one combined
`search_bodies.json` for `/search`. What stays eager is a TUPLE-encoded metadata index
per collection — the repeated JSON key names were 56 %/54 % of those files:

| file | plain objects | tuple-encoded |
|---|---|---|
| issues_index.json | 1.41 MB | **0.61 MB** |
| merge_requests_index.json | 2.26 MB | **1.03 MB** |

`src/data/frozen.js:unpack()` rebuilds plain objects at load (~6 ms for 8 562 rows,
against ~66 ms of JSON.parse saved). `overlay.withBody()` splices the description back
on at the single materialization point, memoised on (record, chunk version) — without
that memo `reconcileCollection` would have compared a fresh object against every base
record and tombstoned all 3 926 issues into `issueEdits` on the first write.

### Eager payload (from dist/index.html's entry + modulepreload set)

| | bytes |
|---|---|
| before (HEAD) | ~24 MB of seed + 1.18 MB app JS |
| after Stage 1 | 8.16 MB |
| **after Stage 2** | **3.58 MB** — 1.18 MB app JS + 0.05 CSS + **2.34 MB seed** |

Seed bytes on a cold project route: **24 MB -> 2.34 MB eager + one 72 KB median chunk.**

## 2. Design decisions and why

### The brief's shape, and where I diverged

The lead's sketch was: eager reference data + eager slim index for issues/MRs +
lazy per-project bodies/notes/diffs/commits/files/trees. That is what shipped, with
three additions the code forced:

1. **`dataManager.js` was a second, larger eager import site.** The brief named only
   `frozen.js`. The seven STATIC git modules imported there are 9.7 MB — more than the
   frozen corpus — and they were read through *synchronous* accessors used by ~90 project
   routes. Keeping those accessors synchronous (and gating the route instead) is what kept
   this a contained change rather than an async refactor of 90 pages.
2. **`ci_pipelines`, `resource_events`, `tree_last_commits` were three more.** 2.6 MB in
   one-off page-level imports. All three are per-project and went into the chunk.
3. **The index had to be tuple-encoded to actually hit the goal.** A plain-object index of
   every field but `description` is 3.67 MB — bigger than the whole eager budget. The
   repeated JSON key names are 56 %/54 % of those files. Tuple encoding takes it to
   1.64 MB, which is what turns "~250 B eager per issue" into ~160 B.

### What I did NOT do, and why

- **I did not make `state.issues` / `state.mergeRequests` per-project.** The navbar
  (`Navbar.jsx:205`) computes assigned-issue and assigned/reviewer-MR counts across every
  project and renders on **every route**; both sidebars do the same for open counts; the
  three dashboards, the group rollups and `/search` are all cross-project. More decisively,
  `overlay.reconcileCollection()` derives deletion tombstones as "in the base array but not
  in the reducer's output" — a partially loaded base would tombstone every unloaded
  project's issues on the first write, and that corruption would be invisible until `/go`
  was read. Existence is global; only bodies are lazy.
- **I did not gate per route.** ~90 project routes read chunk data; a per-route data
  declaration would be ~90 chances to forget one, each failing silently as an empty file
  tree or a missing discussion. One chunk per project, awaited for the whole project
  subtree, cannot be got wrong, and the over-fetch is a median 72 KB (~2 ms).
- **I did not delete the monolithic `src/data/*.json`.** They stay canonical: the extract
  scripts write them, `routes_sweep.py` and `check_next_ids.py` read them, and the next
  round's seed expansion will keep working unchanged. The chunks are derived artifacts,
  committed, with `build_lazy_chunks.py --verify` to catch a reseed that forgot to rebuild.
  Cost: issue/MR bodies exist twice in `dist` (chunks + `search_bodies.json`). Only loaded
  bytes matter and no route loads both.
- **I did not touch `json: { stringify: true }`.** Reverted twice before with measurements;
  the reasoning is in `vite.config.js`.
- **I did not expand the seed.** Explicitly out of scope this round.

### The one property everything hangs on

`materialize(core)` is still the single merge point. Lazy loading adds exactly two things
to it: `baseArray('notes')` returns the loaded chunks' notes instead of a module constant,
and `withBody()` splices `description` onto index records. Both are inside that one
function, so no view can disagree with another. A chunk arriving re-commits the same core
through `commit()`, the same path every write uses.

The subtle trap, and the fix: `withBody` **must** be memoised. `reconcileCollection()`
compares the base record against what the reducer returned; a freshly-allocated spliced
object every call would make all 3 926 issues compare unequal on the first write and
tombstone every one of them into `issueEdits`. `assets/dumps/test_lazy.py` §6 asserts no
overlay key exceeds 50 records after a mutation, which is what would have caught it.

## 3. Bug found and fixed by this work

**A fork created in-session rendered an empty repository.** A fork has no chunk of its
own — `originChunk()` in `dataManager.js` walks `state.repo.forkOrigin` to the source
project's chunk. The first version of the route gate resolved the URL against the SEED
path map only, so `/byteblaze/a11yproject.com` (a fork made by the agent, not in
`projects.json`) resolved to nothing, no chunk was awaited, and every repo view rendered
its empty state while looking perfectly healthy. Fixed by resolving through
`indexes.projectsByPathLower` — the live project list — and walking the fork chain from
there. `assets/dumps/test_lazy.py` §5 now creates a fork and deep-links to its file tree
and commit list in a COLD browser context; it asserts 6/6 of the origin's top-level paths
render.

This is the failure mode the whole gate design is aimed at, and it is worth stating
plainly: a lazy-loading bug here does not throw. It renders a plausible empty page.

## 4. Final measurements (all on the committed build, same host, same session)

FCP = median of 5 interleaved cold loads of `/byteblaze/dotfiles`
(`assets/dumps/fcp.py`), fresh browser context and fresh `?sid=` per load.
"before" is a git worktree of `HEAD` (`7d488c6f0`) served alongside.

| | eager seed bytes | preview FCP | dev FCP |
|---|---|---|---|
| before (HEAD) | ~24 MB | 432 ms | 580 ms |
| after | **2.34 MB** + 104 KB chunk | **164 ms** | **364 ms** |
| after, corpus padded to **139 MB** | 2.34 MB + 104 KB chunk | **168 ms** | — |

The third row is the point. Every per-project chunk except `byteblaze/dotfiles`' was
padded 5x and `search_bodies.json` 5x, taking `src/data` from 23.8 MB to 139.3 MB and
`dist` to 107 MB. FCP on the measured route moved **164 -> 168 ms**, inside the
run-to-run spread of both (raw: 164 164 176 180 164 vs 188 180 168 164 160). Under the
old architecture 139 MB would have been ~4.5 s at the measured 32 ms/MB.

**What still scales, stated honestly.** The eager metadata index does: ~160 B per issue,
~220 B per merge request. 5x the issues and MRs -> index 1.64 -> 8.2 MB -> FCP ~+210 ms.
Everything that comes WITH those records — descriptions, notes, resource events, MR
diffs, commits — is free. Before this change the same 5x cost ~15x more.

### Must-not-regress checklist

| item | before | after |
|---|---|---|
| `assets/route_smoke.py` dev | 201/201 | **201/201** |
| `assets/route_smoke.py` preview | 201/201 | **201/201** |
| `assets/dumps/routes_sweep.py` | 116 driven / 0 failing | **116 / 0** |
| external requests (routes_sweep, 30 routes) | 0 | **0** |
| `assets/dumps/test_overlay.py` (1920 + 1280) | 93 / 0 | **93 / 0** |
| `assets/dumps/check_anchor_strings.py` | 238 of 243 "missing" | **238** — miss sets **byte-identical**, 0 regressions, 0 fixes |
| cold state (`createInitialData()`) | 1 473 B | **1 473 B** |
| `GET /go` cold | 2 997 B | **2 997 B** |
| `shared/check-state-contract.py` | gitlab clean | **clean** |
| `assets/dumps/check_next_ids.py` | matches seed | **matches (8 counters)** |
| console errors across all of the above | 0 | **0** |
| NEW `assets/dumps/test_lazy.py` dev / preview | — | **21 / 0** each |

The creative flows (create issue, create MR, comment, assign, label, milestone, close,
merge, star, invite member — each end to end plus a reload) are `test_overlay.py` §4 and
are inside the 93/0.

### Not done / left for a later round

- **`/search` costs 2.87 MB** when a term is present, because GitLab's non-Elasticsearch
  search matches `description`. That is the one route whose cold load got a chunk of the
  corpus back. A real inverted index over titles+bodies would make it ~200 KB and is the
  obvious next step, but it is a search-relevance change and did not belong in an
  architecture-only round.
- **The eager index is not sharded.** If the next expansion pushes issues past ~20k, the
  index wants splitting by state (`opened` eager, `closed` lazy) — the dashboards and the
  navbar only count open ones. Not worth it at 8.5k records.
- **`src/data/*.json` monoliths are still committed alongside the chunks**, so the repo
  carries the per-project data twice (+17 MB) and issue/MR bodies three times
  (monolith + chunk + `search_bodies.json`). Deliberate: it keeps the extract pipeline
  and `routes_sweep.py` / `check_next_ids.py` working untouched, and repo size was not a
  stated constraint. `build_lazy_chunks.py --verify` is what stops them drifting.
- **Seed expansion** — explicitly out of scope, and the ceiling it was blocked on is gone.
