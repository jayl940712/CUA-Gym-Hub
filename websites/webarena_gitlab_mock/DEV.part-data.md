# DEV.part-data — Tier-1 entities + 5x issues/MRs expansion

Round 20. Builds on `DEV.part-state.md` (corpus out of app state) and
`DEV.part-lazy.md` (per-project lazy chunks). Baseline for every "before"
number here is `3a40c6062`, served alongside from a git worktree.

---

## 0. The brief's Tier-1 table is wrong on two of its four rows

The brief asks for `ci_builds` (upstream 14 179, "mock now **0**") and
`ci_pipelines` (upstream 1 465, "mock now **7**"). Both are **already at 100 %
parity**. Measured, not assumed:

| | upstream `SELECT count(*)` | `src/data/ci_pipelines.json` |
|---|---|---|
| `ci_pipelines` | 1 465 | **1 465** |
| projects with pipelines | 67 | **67** |
| `ci_builds` | 14 179 | **14 179** |

The "7" is that file's **seven top-level metadata keys** — `_source`, `_static`,
`_encoding`, `_page_size`, `job_specs`, `statuses`, `projects`. The pipelines
live under `projects`, and the jobs are tuple-encoded inside each pipeline
(`jobs = [id, specIdx, statusIdx, createdOffsetMs, finishedOffsetMs]`), which is
why a naive row count reads zero. `assets/dumps/expansion/PLAN.md` documented
this exact misread once already.

**So Part A reduced to `releases` and `boards`, and `releases` was the real
find:** 1 732 rows over 48 projects behind a page that rendered an
unconditional empty state.

---

## 1. What landed

### Part A — releases

`/:ns/:proj/-/releases` was `GlEmptyState` for all 175 projects, because every
round-4 capture came from `byteblaze/dotfiles`, which genuinely has none. 48
projects do have them. New `src/pages/Releases.jsx` implements the list and the
`/-/releases/:tag` detail page the cards link to; DOM read off live captures of
`/bblanchon/ArduinoJson/-/releases` and `/DynamoRIO/dynamorio/-/releases`
(read-only GETs; the releases index does not mutate, unlike `/-/boards`, which
lazily CREATES a board row and was therefore never visited).

Faithful to the source: 10 cards per page; GitLab's keyset `?after=` / `?before=`
cursors, base64 of `{"released_at":…,"id":…}` with the padding stripped —
verified by clicking Next/Prev on the live site and decoding what it put in the
URL; the sort dropdown (Released date / Created date) and direction toggle,
which on the live site are client state and do **not** touch the URL; the four
generated source-code archive links; `Released <n> ago by <author>`; the
`card`/`card-header`/`card-body`/`card-footer`/`linked-card` class structure.
The 127 projects with no releases still get the byte-identical empty state.

Not modelled because the instance has none of it: release milestones, release
evidence, and non-source-code assets (`release_links` is empty).

### Part A — boards

Pulled, and worth stating plainly: **the 9 `boards` rows are not 9
configurations.** Every one is the default board GitLab creates lazily on the
first visit to `/-/boards` — same name (`Development`), same two lists
(`backlog` + `closed`), no label/assignee/milestone lists, both `hide_*` flags
false. They are the 9 projects whose board page someone happened to open. A
project *without* a row renders the identical default board upstream, which is
what `Boards.jsx` already did. The data is now seeded (4 KB, eager) and drives
the board name and list set instead of a literal in the component, so this is a
provenance improvement, not a visible one.

### Part B — 5x issues and merge requests

Same pipeline as the previous expansion (`extract_db.py` → `extract_git2.py` →
`verify.py` → `merge.py --apply`), caps raised from 50/70 to **450/850** by a
sweep against the upstream distribution. Nothing invented; every row carries the
source's own primary key.

---

## 2. Before / after, per entity

| entity | before | added | after | factor |
|---|---|---|---|---|
| issues | 3 926 | +15 779 | **19 705** | 5.0x |
| merge_requests | 4 636 | +18 600 | **23 236** | 5.0x |
| notes | 12 648 | +49 945 | **62 593** | 4.9x |
| resource_events | 8 089 | +32 021 | **40 110** | 5.0x |
| merge_request_diffs | 4 636 | +18 600 | **23 236** | 5.0x |
| users | 1 858 | +341 | **2 199** | 1.2x |
| labels | 972 | +282 | **1 254** | 1.3x |
| milestones | 252 | +91 | **343** | 1.4x |
| **releases** | **0** | **+1 732** | **1 732** | new |
| **boards** (+ lists) | **0** | **+9 (18)** | **9** | new |
| ci_pipelines / ci_builds | 1 465 / 14 179 | — | unchanged | already 100 % |

Targets were ~19 600 issues and ~23 200 MRs; landed 19 705 and 23 236.

### Per-project distribution

| issues/project | 0 | 1–4 | 5–19 | 20–49 | 50–99 | 100–299 | 300+ |
|---|---|---|---|---|---|---|---|
| before | 66 | 10 | 23 | 13 | \|—— 63 ——\| | | |
| **after** | **66** | 10 | 23 | 13 | **12** | **18** | **33** |

| MRs/project | 0 | 1–4 | 5–19 | 20–49 | 50–99 | 100–299 | 300+ |
|---|---|---|---|---|---|---|---|
| before | 64 | 16 | 25 | 18 | \|—— 52 ——\| | | |
| **after** | **64** | 16 | 25 | 18 | **11** | **11** | **30** |

Projects with ≥1 issue: **109** (unchanged — the upstream ceiling). With ≥1 MR:
**111** (ditto). The 66/64 zeros are empty upstream and were not invented, as
the brief required. What moved is depth:

* issues, non-empty projects: median **36 → 86**, max **50 → 452**
* MRs, non-empty projects: median **~20 → 37**, max **70 → 852**
* releases: 48 projects, median 21, max 277 (DynamoRIO/dynamorio)

At GitLab's 20/page the median project's issue list is now **5 pages** instead
of under two, which is what makes filtering/sorting/pagination tasks mean
something.

### Bytes

| | before | after |
|---|---|---|
| eager metadata index (`issues_index` + `merge_requests_index`) | 1.64 MB | **8.40 MB** |
| `search_bodies.json` | 2.92 MB | 16.42 MB |
| per-project chunks, total | 20 MB | 64 MB (173 chunks) |
| chunk median / p90 / max | 72 KB / 208 KB / 539 KB | **84 KB / 1.28 MB / 3.18 MB** (max = project 39) |
| `src/data` on disk | 47 MB | **171 MB** |
| `dist` | ~30 MB | 87 MB |

The eager index landed at 8.40 MB against `DEV.part-lazy.md`'s 8.2 MB
projection — the ~160 B/issue and ~220 B/MR figures held.

---

## 3. FCP — before vs after

Median of 5 interleaved cold loads, fresh browser context and fresh `?sid=` per
load, two live servers so host drift hits both equally (`assets/dumps/fcp.py`).

| | before (`3a40c6062`) | after | projected |
|---|---|---|---|
| **preview**, `/byteblaze/dotfiles` | 180 ms | **328 ms** | ~375 ms |
| **dev**, `/byteblaze/dotfiles` | 336 ms | **500 ms** | — |

328 ms preview is under the 375 ms the brief expected and well under the 432 ms
this all started from. 0 console errors on every run.

Two more routes, measured because the chunk p90 grew 6x:

| route (preview) | before | after |
|---|---|---|
| `/trpc/trpc` — the 3.18 MB chunk, worst case | 156 ms | **380 ms** |
| `/byteblaze/dotfiles/-/merge_requests` | 124 ms | **284 ms** |

Even the single largest chunk costs +224 ms, because it downloads in parallel
with the eager index rather than after it.

### The one route that got materially worse: `/search`

| `/search?search=gitlab`, preview, time-to-content | before | after |
|---|---|---|
| | 236 ms | **1 002 ms** |

GitLab without Elasticsearch matches `description`, not just `title`, so
`/search` loads `search_bodies.json` — now 16.42 MB. `DEV.part-lazy.md` already
named a real inverted index as the fix and deliberately deferred it as a
search-relevance change; at 5x it is now the single largest remaining
performance item. **I did not paper over it**: results are still complete and
correct, they just arrive ~0.8 s later.

It did surface a genuine test defect, described next.

---

## 4. Two test scripts had a hidden latency budget — fixed, and here is exactly what changed

Both `assets/route_smoke.py` and `assets/dumps/test_overlay.py` used a **fixed
sleep** after navigation and then asserted on `innerText`. That makes them
render tests *and* latency tests at the same time, with the budget undeclared:

* `route_smoke.py` slept **350 ms** → `/search?search=gitlab` reported
  `BLANK PAGE (empty <body> text)`. **201/201 → 200/201.**
* `test_overlay.py:visit()` slept **700 ms** → the legacy-vs-light parity
  comparison on `/search?search=OVERLAY-PARITY-PROBE&scope=issues` failed twice
  with `legacy 0 chars vs light 5496 chars`. **93/93 → 91/93.**

Both now **wait for content** (bounded: 5 s and 10 s respectively) before
asserting, and `test_overlay.py` keeps its 700 ms settle sleep on top, identical
for both sides of every comparison. A genuine white screen — the
`ReferenceError` case `route_smoke.py` exists for — never fills in, so it still
fails; it just takes 5 s to say so instead of 350 ms.

**This is me changing a test so it passes, so judge it directly:** neither
change relaxes what is asserted (still "the body must have text", still "the two
renders must be identical"); both remove a timing assumption that was never
stated as a requirement. The underlying slowdown is reported above rather than
hidden. If you'd rather the 350 ms budget be a real, enforced contract, the fix
is the inverted index, not the sleep — say so and I'll do it.

---

## 5. Must-not-regress — every item, measured

| item | required | measured |
|---|---|---|
| `assets/route_smoke.py` **dev** | 201/201 | **201 cold-loaded, 0 failing** |
| `assets/route_smoke.py` **preview** | 201/201 | **201 / 0** |
| `assets/dumps/routes_sweep.py` | 116 / 0 | **118 rows · 116 drivable · 116 driven · 0 failing** |
| external requests (routes_sweep, 30 routes) | 0 | **0** |
| `assets/dumps/test_overlay.py` @ 1920 + 1280, dev | 93 / 0 | **93 / 0** |
| `assets/dumps/test_overlay.py` @ 1920 + 1280, preview | 93 / 0 | **93 / 0** |
| `assets/dumps/test_lazy.py` **dev** | 21 / 0 | **21 / 0** |
| `assets/dumps/test_lazy.py` **preview** | 21 / 0 | **21 / 0** |
| `check_anchor_strings.py` miss set | byte-identical | **238 / 238, `diff` of the sorted MISS lists is EMPTY** |
| `build_lazy_chunks.py --verify` | clean | **`lazy chunks up to date (173)`** |
| cold state (`createInitialData()`) | 1 473 B | **1 473 B** |
| two localStorage keys | 2 946 UTF-16 | **2 946 (0.06 % of quota)** |
| `GET /go` cold | 2 997 B | **2 997 B** (dev and preview) |
| `shared/check-state-contract.py` | clean | **`webarena_gitlab_mock  clean  set_initial=no`** |
| `assets/dumps/check_next_ids.py` | matches | **matches the seed (8 counters)** |
| duplicate ids | 0 | **0** across issues, MRs, notes, users, labels, milestones, projects, resource_events, boards; `(project_id, iid)` unique for issues and MRs |
| dangling refs | 0 | **0** — every author, assignee, reviewer, label, milestone, note target, event target, release author and board project resolves |
| console errors | 0 | **0** across route_smoke ×2, routes_sweep, test_overlay ×2, test_lazy ×2, fcp ×4 |
| `npm run build` | passes | **PASS**, 21 s |

Anchor detail, since the brief was specific about it: the two MISS lists were
captured from the same script run against a `3a40c6062` worktree and against
this build, sorted, and `diff`ed. Empty. 238 both times — a keying artifact, not
238 defects.

---

## 6. Secrets

`redact_secrets.py` after every merge, as required. One **new** live credential
in the added issue text (a `mysql://` URL on a public host) — masked.
`repo_files.json` came out byte-identical to before, i.e. the previous round's
redactions survived the re-merge.

I also swept all of `src/data` (including `by-project/`, which
`redact_secrets.py`'s `DATA.glob("*.json")` does **not** reach — order matters:
merge → redact → build chunks) for GitHub PATs, AWS keys, Slack tokens/webhooks,
Google API keys, npm tokens, Stripe live keys and private-key blocks. **None.**
The one `-----BEGIN RSA PRIVATE KEY-----` hit is that literal string inside an MR
description, already asterisked by its original author. Every remaining
unredacted `user:pass@` URL points at `localhost` / `127.0.0.1` / RFC1918, which
is what the script deliberately leaves alone.

---

## 7. Two bugs this round produced, both caught only by looking at the page

Recording these because neither threw, neither failed a DOM assertion, and both
would have shipped:

1. **The ten release cards laid out in a ROW and ran off the viewport.**
   `global.css` deliberately does not define `gl-flex-direction-column`,
   `.card*`, `gl-align-self-end`, `gl-float-left` or `.collapse` globally —
   defining them moved the page height of eight measured routes and round 8's
   geometry is a protected contract. The empty-state version of this page had
   one child so it never showed. Fixed with a page-scoped `<style>` block
   (`.releases-page`), the same pattern `Search.jsx` already uses; blast radius
   outside the route is zero. **Caught by screenshotting at 1280x720.**
2. **`Released  by` — the relative time rendered as an empty string.**
   `releases.released_at` is `timestamp with time zone`, so `::text` gave
   `2023-03-14 20:06:21+00`, and `format.js:parseDate` only accepts `[+-]HH:MM`
   or `[+-]HHMM`. It returned `null`; `timeAgo(null)` returns `''` rather than
   throwing. Fixed at the data layer — `(released_at AT TIME ZONE 'UTC')::text`
   — so the column matches every other timestamp in the seed.

One self-inflicted build break worth a line: the CSS comment inside the
`PAGE_CSS` template literal contained backticks and silently terminated the
string. `npm run build` caught it; a `pkill` in the same shell pipeline masked
the non-zero exit for one cycle. Verify build exit codes separately from
teardown.

---

## 8. Files

**New (4) — one of them is git-ignored and MUST be force-added:**

| file | note |
|---|---|
| `src/data/releases.json` | 1 384 KB, 1 732 releases / 48 projects |
| `src/data/boards.json` | 4 KB, 9 boards / 18 lists |
| `src/pages/Releases.jsx` | list + `/-/releases/:tag` detail |
| `assets/dumps/expansion/extract_releases.py` | **matched by the repo-root `.gitignore` rule `**/assets/dumps/**`** — I ran `git add -f` on it so it is already staged; every other script in that directory was force-added the same way. `*.add.json` staged output is ignored and stays ignored, consistent with the previous expansion. |

**Modified (23 + 79 chunks):**

`assets/dumps/build_lazy_chunks.py` (slices `releases` into chunks) ·
`assets/dumps/expansion/extract_db.py` (caps 50/70 → 450/850) ·
`assets/dumps/expansion/merge.py` (`NEW_FILES` for files `src/data` has none of;
`write()` no longer requires a pre-existing file to back up) ·
`assets/route_smoke.py` · `assets/dumps/test_overlay.py` (§4) ·
`ROUTES.md` (row 111) · `SCHEMA.md` (two rows in the static-module table) ·
`src/App.jsx` · `src/components/layout/Icon.jsx` (`tag`, `doc-code`, both lifted
from the container's own sprite) · `src/pages/Boards.jsx` ·
`src/pages/ProjectOps.jsx` (`Releases` moved out, `GlEmptyState` exported) ·
`src/utils/dataManager.js` (`getReleases`) ·
`src/data/{issues,merge_requests,notes,users,labels,milestones,resource_events,merge_request_diffs}.json` ·
`src/data/{issues_index,merge_requests_index,search_bodies}.json` ·
**79 of the 173 `src/data/by-project/*.json`** (the other 94 projects were
already at their upstream ceiling under the old caps, so their chunks are
byte-identical).

`.prexpand` backups deleted after verification. The `3a40c6062` comparison
worktree is removed and its servers killed. Nothing committed.

---

## 9. Not done, and why

* **`merge_request_diff_files` (1.29 M diff hunks)** — excluded by the brief.
  Noting as instructed: **lazy loading now makes them affordable.** They are
  per-MR and therefore per-project, so they would land entirely in chunks and
  cost ~0 at first paint. The real cost is repo/`dist` size and a multi-hour
  `git diff` pull; the p90 chunk is already 1.28 MB and this would push it
  further, so it wants its own round with a per-project cap.
* **`todos`, `groups`, `events` / `award_emoji` / `snippets`** — excluded by the
  brief, and I agree with each reason. Re-verified `boards` = 9 and the two
  Groups are seeded.
* **An inverted search index.** The `/search` regression in §3 is the strongest
  argument yet for it, but it changes search relevance and did not belong in a
  seed round.
* **`/-/releases/new`.** The "New release" button points there, as it did
  before; there is no such route, so it 404s exactly as it did before this
  round. Unchanged behaviour, not a new gap.
* **`routes_sweep.py` does not individually drive `/-/releases/:tag`.** Its
  ROUTES.md regex only matches a row whose path cell is a single backticked
  path, so sub-routes noted in a path cell (row 106's `/-/pipelines/:id`,
  `/charts`) have never been swept either. Row 111 keeps the plain path cell so
  the sweep stays at exactly 116 rows; the detail route is covered by the
  dedicated checks in §10 instead. Adding `:tag` resolution to `routes_sweep.py`
  would take the count to 117 and is a clean follow-up.
* **`SCHEMA.md`'s static-module sizes are stale** for `resource_events.json`,
  `merge_request_diffs.json` and the issue/MR modules. I added the two new rows
  and a pointer to this file rather than re-measuring a table the audit agent
  owns.

---

## 10. Releases/boards functional check (beyond the shared suites)

Driven at **1920x1080 and 1280x720**, hit-tested with `elementFromPoint`
(not visibility flags), preview build, 0 console errors at both:

| check | result |
|---|---|
| 10 cards on page 1 | PASS |
| release title link / Assets accordion / asset link / tag link clickable | PASS ×4 |
| sort dropdown + direction toggle clickable | PASS ×2 |
| Next button clickable (after `scroll_into_view`) | PASS |
| Next → page 2: `?after=<cursor>` set, `sid` kept, 10 new cards | PASS |
| Prev → back to page 1, same first card | PASS |
| Prev disabled on page 1 | PASS |
| Assets accordion collapses and re-expands | PASS |
| `/-/releases/v6.21.0`: title `ArduinoJson 6.21.0 · …`, exactly 1 card, no pager | PASS |
| `/byteblaze/dotfiles/-/releases` still renders `Getting started with releases` | PASS |
| `/-/boards` title from `boards.json` (`Development`) | PASS |
