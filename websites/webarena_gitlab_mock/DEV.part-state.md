# DEV part-state — gitlab frozen-corpus / overlay refactor

Move the frozen corpus OUT of app state; persist the delta instead.
Reference implementation followed: `websites/webarena_reddit_mock/`.

## Design (differs from reddit — read this before touching it)

Reddit gave each mutation an explicit overlay verb (`addSubmission`,
`patchComment`, `removeSubmission`). That works for three mutation shapes.
GitLab has **79 write sites**: 33 direct `setState(prev => …)` reducers, the four
generic helpers in `AppContext` (`appendTo`/`updateIn`/`removeFrom`/`setUi`) and
six reducers in `src/components/create/mutations.js`. Issues, MRs, notes,
members, labels, milestones, projects, groups, stars, follows and todos are all
created, field-edited AND deleted.

So the **read** side is reddit's (one `materialize(core)`), and the **write**
side is a **reconciler**: reducers are untouched — still handed the merged state,
still return a merged state — and `dematerialize(core, prev, next)` derives the
delta. Immutable reducers return untouched collections reference-identically, so
11 of 12 are skipped in O(1) per write; only the one that changed is scanned.

Verified up front, before committing to the reconciler: all 79 write sites are
immutable, all append at the end, and every sort is on a copy (`[...rows].sort`)
— so no reducer mutates the frozen arrays in place and base-then-created ordering
is not observable (every list view sorts explicitly).

Twelve overlaid collections × 3 keys = 36 flat overlay keys:
`new<X>` / `<x>Edits` / `deleted<X>` for
`users projects groups issues mergeRequests notes labels milestones members
todos stars follows`. `stars`/`follows` are keyed on their composite (no id in
the source either). `snippets`/`groupLinks`/`repo`/`ui`/`nextIds`/`currentUser`
stay plain state — nothing about them is frozen.

## Files

| File | Change |
|---|---|
| `src/data/frozen.js` | **new** — the 12 seed modules, imported by `overlay.js` only |
| `src/utils/overlayShape.js` | **new** — import-free: key list, `emptyOverlay()`, `toCore()`, `SEED_NEXT_IDS`, `ID_KIND_COLLECTION` |
| `src/utils/overlay.js` | **new** — `materialize()` / `dematerialize()`, the single merge point |
| `src/utils/initialState.js` | **new** — `createInitialData()`, split out so `vite.config.js` stops importing ~4.9 MB of JSON via `dataManager.js` |
| `src/data/current_user.json` | **new** — byteblaze's row, extracted verbatim from `users.json` (382 B) |
| `assets/dumps/test_overlay.py` | **new** — the regression suite |
| `assets/dumps/compare_render.py` | **new** — before/after render diff against a pre-refactor worktree |
| `assets/dumps/check_next_ids.py` | **new** — guards the now-literal id floors against a reseed |
| `assets/dumps/routes_sweep.py` | **new** — drives every ROUTES.md row cold + asserts zero external requests |
| `src/utils/dataManager.js` | corpus imports dropped; re-exports `createInitialData` & the id constants; `initializeData` folds through `toCore()` |
| `src/context/AppContext.jsx` | holds `core` + `state = materialize(core)`; `setState` reconciles; exposes `coreState` |
| `vite.config.js` | light import; **state-contract defects A+B fixed** |
| `SCHEMA.md` / `SOURCE.md` | rewritten seed-tier, overlay keys, injection, diff-shape and quota sections |

`SEED_NEXT_IDS` had to become literals (it was `max(seed id)+1` derived at module
load, which is exactly what dragged the corpus into `vite.config.js`). Three
guards: `overlay.checkSeedNextIds()` logs loudly in DEV if a literal drops below
the corpus, `assets/dumps/check_next_ids.py` is the CI-able version, and
`allocateId`'s existing `taken` scan is the runtime backstop.

## Measured

| | before | after |
|---|---|---|
| `createInitialData()` / cold state | 2 072 728 B | **1 473 B** (−99.93 %) |
| two localStorage keys (UTF-16 units) | 4 137 340 = **78.9 % of quota** | **2 946 = 0.06 %** |
| `GET /go` cold, whole payload | 4 145 507 B | **2 997 B** |
| `GET /go` after one star | 4 146 855 B (measured) | **4 315 B** (961×) |
| `GET /go` after a mutation | — | **3 436 – 5 368 B** across 8 driven flows |
| `POST /post` body per mutation | 2 072 797 B | **~2–5 KB** |
| `state_diff` on an untouched sid | `{}` | `{}` |
| first contentful paint, `npm run preview` | 448 ms | **372 ms** |
| first contentful paint, `npm run dev` | 532 ms | **440 ms** |
| production bundle | 7 480 108 B | 7 480 108 B (unchanged) |

FCP is the median of 5 interleaved cold loads of `/byteblaze/dotfiles` against
two live servers, so drift hits both equally.

**`json: { stringify: true }` was tried and REVERTED.** Reddit sets it and it
helps there (14.6 MB in three modules); gitlab's ~6.4 MB is spread over 24
modules and it measured as no production win (380 vs 372 ms), +411 KB of bundle,
and **+1.1 s in dev** (1564 vs 440 ms FCP, DCL 307 → 1428 ms). Dev is what every
agent round loads. The reasoning and the numbers are in `vite.config.js` so it
does not get re-added by copying reddit.

`shared/check-state-contract.py`: was `A+B`, now **clean** — 13 of 99 mocks.

## Verification (all re-run on the shipping build)

| Check | Result |
|---|---|
| `npm run build` | **PASS** — 7 480 108 B bundle, 2 003 kB gzip |
| `shared/check-state-contract.py` | **clean** (was `A+B`) — 13 of 99 mocks |
| `assets/route_smoke.py` | **201 routes cold-loaded, 0 failing**; 7/7 case-insensitive redirects keep `sid` |
| `assets/dumps/routes_sweep.py` — every ROUTES.md row | **116 driven / 116 pass**, `sid` intact on all; 2 rows skipped as not-a-GET (`.atom` feed, archive download) |
| external requests over 30 routes | **0** |
| console errors | **0** across route smoke, the sweep and the overlay suite |
| `assets/dumps/test_overlay.py` @ 1920×1080 + 1280×720 | **93 passed, 0 failed** |
| `assets/dumps/compare_render.py` before vs after | **175 / 176 routes render identically**; the 1 diff is the port number in the page's own `Current path: http://localhost:5321/byteblaze` text |
| `assets/dumps/check_next_ids.py` | matches the seed (8 counters) |

The 13 creative flows in the overlay suite each drive end to end, **reload**, and
are still there, with `/go` reporting them:

| flow | `state_diff` keys | `/go` after |
|---|---|---|
| star a project | `newStars`, `projectEdits.193` | 4 315 B |
| create an issue | `newIssues`, `nextIds.issue` | 3 858 B |
| comment on it | `newNotes` | 4 510 B |
| close it | `newIssues` | 4 544 B |
| create a label | `newLabels`, `nextIds.label` | 3 336 B |
| create a milestone | `newMilestones`, `nextIds.milestone` | 3 486 B |
| create a merge request | `newMergeRequests` | 3 962 B |
| assign the issue | `newIssues` | 4 552 B |
| add a label to the issue | `newIssues` | 4 552 B |
| create a milestone in-session | `newMilestones` | 5 044 B |
| set that milestone on the issue | `newIssues` | 5 042 B |
| **merge a SEEDED (frozen) MR** | **`mergeRequestEdits`** | 4 179 B |
| invite a project member | `newMembers`, `nextIds.member` | 3 436 B |

Plus, on FROZEN records: an `issueEdits` entry is visible in the project issue
list, the issue detail heading, `/search`, `/-/boards` **and** the global
dashboard, and a `deletedIssues` tombstone removes the record from all of them —
which is the "one view disagrees with another" failure this design existed to
prevent. Legacy full-array injection and lightweight overlay injection render
character-identically across list, detail, dashboard and search.

## Not done, and why

* **`AUDIT.md` and `TEST.md` still quote 2 072 728 B as the cold state.** They are
  owned by the audit and playwright agents (`.claude/agents/dev.md`: "Do not edit
  `AUDIT.md` or `TEST.md`"), so they were left for those agents to re-measure.
  Every figure they quote is now stale by design, not wrong-in-substance.
* **`assets/data_model.md` was annotated, not rewritten.** It is a plan-agent
  artifact and its field-by-field descriptions are all still correct — only the
  `createInitialData()` shape in §0 and §12 changed, so those two carry an
  explicit superseded note pointing at `SCHEMA.md`.
* **The ~70-row Observable State Changes table was not rewritten row by row.**
  The key rename is mechanical (`X.added` → `newX`, `X.changed` on a frozen
  record → `xEdits.<id>`, …), so `SCHEMA.md` states the mapping once, above the
  table, rather than making 70 hand edits that could each go wrong. Rows naming
  `repo.*` / `ui.*` / `nextIds.*` / `currentUser` / `snippets` / `groupLinks` are
  unaffected and untouched.
* **`xEdits.<id>` carries only `new`, never `old`.** The pre-edit value is not in
  state to diff against. It is recoverable — the frozen record is in
  `src/data/<module>.json`, checked in and deterministic — and `SCHEMA.md` says
  so and names the file per collection. Fixing it properly would mean changing
  `computeStateDiff`, which the brief forbids and 89 mocks share.

## Status log
- [x] recon: reddit reference, gitlab write surface
- [x] overlayShape.js / frozen.js / overlay.js / initialState.js written
- [x] dataManager.js + AppContext.jsx rewired
- [x] vite.config.js: contract A+B fixed, light import, json.stringify
- [x] `npm run build` PASS
- [x] cold `/go` measured
- [x] `assets/route_smoke.py`: **201 routes cold-loaded, 0 failing**, sid kept
      through every case-insensitive redirect
- [x] `assets/dumps/test_overlay.py` at 1920×1080 and 1280×720
- [x] `assets/dumps/compare_render.py` before/after
- [x] `assets/dumps/routes_sweep.py` — every ROUTES.md row
- [x] `json: { stringify: true }` tried, measured, REVERTED (see vite.config.js)
- [x] docs
- [x] committed
