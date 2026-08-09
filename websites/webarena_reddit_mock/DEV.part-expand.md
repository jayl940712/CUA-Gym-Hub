# DEV.part-expand — seed expansion (posts 3x, comments 8x, image recompress)

Agent: dev seed-expansion. Started 2026-08-09.
Mode: FULL. Source: postmill @ localhost:9999, container `forum`, db `postmill` (READ-ONLY, SELECT only).

## Baseline (measured)
| | mock | source | share |
|---|---|---|---|
| submissions | 2,359 | 127,391 | 1.9% |
| comments | 2,593 | 2,551,513 | 0.10% |
| forums | 95 | 95 | 100% |
| users (`userDirectory`) | 3,899 | 661,782 | 0.6% |
| images (`images` table) | 769 manifest / 770 files | 31,467 | 2.4% |
| submission image bytes | 80.7 MB, mean 102.3 KB (jpg 634 / png 105 / gif 30) | | |
| thumbs | 1x 2.1 MB, 2x 5.9 MB | | |

Existing per-forum selection rule, reverse-engineered and confirmed against the
container: **top-N by `ranking DESC, id DESC` per forum**. e.g. `/f/news` holds
exactly the source's top 51 by ranking (108576, 43558, 43482, 43551, 65154 …).
The expansion reuses that rule so hot-sort page composition stays faithful.

---

## Phase 0 — anchor contract (DONE)

`shared/extract-task-anchors-vwa.py --site reddit` →
`assets/task_anchors_vwa.{json,md}`.

```
tasks            : 208  [page_image_query=24, program_html=85, string_match=70, url_match=51]
image tasks      : 82
anchor routes    : 242   anchor strings : 194   anchor locators : 22
evaluator funcs  : 7
```

Combined contract is **337 tasks** (129 webarena + 208 VWA). New reusable script
`assets/dumps/anchor_ids.py` resolves both contracts down to primary keys and
diffs them against `src/data/`:

```
task_anchors.json        subs=56   comments=2   forums=45  users=1
task_anchors_vwa.json    subs=184  comments=9   forums=36  users=1

submissions  anchored=240  present=105  MISSING=135
comments     anchored=11   present=2    MISSING=9
forums       anchored=64   present=54   MISSING=10   -> 0 real (see below)
users        anchored=1    present=1    MISSING=0
```

### FINDING (the headline number)

**135 of 240 anchored submissions (56%) and 9 of 11 anchored comment permalinks
were missing from the seed** before this run. Every one of them is a route a
real evaluator navigates to or asserts on. They were missing because
`assets/task_anchors.json` only ever covered `webarena.jsonl` — the 208
visualwebarena tasks (62% of reddit's task surface) never influenced selection.

The 10 "missing" forums are all false positives, verified against the container:

| Name | Verdict |
|---|---|
| `Cyberpunk`, `Karaoke`, `PlantsForCatParents`, `cmu_lti`, `sci_fi` | do **not** exist on the source either — these are `/f/<name>/edit` routes from *create-a-forum* tasks. Correctly absent. |
| `games` | no such forum on the source. |
| `earthporn` | lower-case spelling in a task string; the real forum `EarthPorn` is present. |
| `deeplearning \|OR\| __REDDIT__`, `machinelearning \|OR\| __REDDIT__`, `washington \|OR\| __REDDIT__` | `\|OR\|` alternation artifacts of the anchor string parser, not paths. |

Forum coverage is genuinely **95/95 = 100%**.

---

## Decision: `commentCount` stays at the SOURCE value (option a)

Decided by the anchors, not by preference. Four independent evaluator classes
read the source's comment count:

1. **`string_match` answers are the count itself.** VWA "How many comments did
   the post with this image receive?" has `must_include: ["146"]`, `["23"]`,
   `["29"]`; "Tell me how many comments this post has" has `["121"]` and
   `["28"]` (the latter on `/f/food/82940`). Renumbering to the seeded count
   fails all of these outright.
2. **A pagination cursor embeds it.** Anchor route
   `/f/EarthPorn/most_commented?t=all&next[commentCount]=89&next[id]=76289`
   requires submission 76289 to carry `commentCount = 89` exactly.
3. **`most_commented` sort order** is anchored on `/f/aww`,
   `/f/MechanicalKeyboards`, `/f/EarthPorn`, plus webarena's "subscribe from the
   all-time most commented post in f/pittsburgh". Reordering by seeded counts
   changes which post is first.
4. **Counting tasks over the thread** ("how many comments mention 'spicy'" →
   `11`; "how many comments are removed or deleted" → `16`) need the *real*
   thread present, which argues for deepening the threads rather than shrinking
   the advertised number.

So `commentCount` is anchored data and is left verbatim. The cost is the known
one — a listing can advertise more comments than the seeded thread shows. That
is mitigated, not eliminated, by raising seeded comments 8x and by giving every
anchored post a cap of 60. Reasoning is written into `SOURCE.md` so it is not
re-litigated.

---

## Phase 1 — selection + extraction (IN PROGRESS)

`assets/dumps/extract_expansion.py` (new, re-runnable, SELECT-only). Order:
frozen 2,359 → +135 anchored → per-forum 3x deepening by `ranking DESC, id DESC`
→ global ranking fill for forums shallower than 3x.

Comments: deterministic per-post cap from a heavy-tailed ladder
(30% zero / 25% one / 17% two / 12% four / 8% seven / 5% twelve / 3% twenty-five,
mean 2.98), capped by the post's real `comment_count`, never shrinking a post
that already has seeded comments, and **60 for every anchored post**. The cap is
applied over `ORDER BY timestamp, id`, which is ancestor-closed in Postmill (a
reply is always newer than its parent), so `parent` chains never dangle.

## Phase 2 — images (PENDING)
## Phase 3 — merge + build + browser verification (PENDING)

---

## Phase 1 — selection + extraction (DONE)

### The selection rule changed mid-round, on evidence

The first pass deepened each forum 3x by `ranking DESC, id DESC` (the rule that
produced the existing seed) and landed exactly on 7,077 posts. Then I measured
what that actually bought, per sort, per forum, against the container:

| | `hot` | `top` | `new` | `most_commented` |
|---|---|---|---|---|
| **before this round** (2,359 posts) | 5/95 | 5/95 | 5/95 | 5/95 |
| 3x-by-ranking (7,077 posts) | ~95/95 | poor | poor | poor |
| **shipped rule** (7,978 posts) | **95/95** | **95/95** | **95/95** | **95/95** |

("N/95" = forums whose first page of that sort is byte-identical to the source's
ordering.) 3x-by-ranking bought three correct `hot` pages and left the other
three sorts unreliable — while the anchor contract navigates to
`/f/EarthPorn/top?t=all`, `/f/MechanicalKeyboards/top?t=all&next[netScore]=2415`
(page **2** of top), `/f/aww/most_commented`, `/f/pics/new`, `/f/memes/new`,
`/f/arlingtonva/new` and more. Concretely, under the old rule `/f/food` and
`/f/Newark` reported the **wrong** all-time most-commented post.

The shipped rule takes, per forum, the source's top `hot`<=50 and
`top`/`new`/`most_commented`<=25, plus depth-25 coverage for the 13 anchored
(forum, sort) pairs including `Art/active` and `springfieldMO/controversial`.
`active` and `controversial` are deliberately **not** covered for all 95 forums:
`controversial` is `net_score ASC`, a set disjoint from everything else, and
blanket coverage costs ~2,400 extra posts to satisfy one anchor route.

At depth 50 the shipped seed is exact for `hot` 95/95 and `top` 94/95; `new` and
`most_commented` are exact for page 1 only, by design.

### Comment distribution (target: mean 3, realistic shape)

Deterministic per-post cap (sha256 of the id, so it is reproducible), heavy-
tailed, clipped to the post's real `comment_count`, never below what the frozen
seed already held, and 40 for every anchored post.

| comments on a post | 0 | 1 | 2 | 3 | 4-9 | 10-25 | >25 |
|---|---|---|---|---|---|---|---|
| share of posts | 34.8% | 21.1% | 14.5% | 11.3% | 13.0% | 2.9% | 2.4% |

(the source has 36.4% at zero, median 8, mean 20). **Posts with at least one
comment went from 427/2,359 = 18% to 4,612/7,077 = 65%.** All 2,593 pre-existing
comments are preserved — 905 of them fall outside the (timestamp, id) window the
caps select over, so they are re-added by id explicitly. Ancestor closure is
enforced, so `parent` never dangles: 0 orphans, verified.

---

## Phase 2 — images (DONE)

| | files | bytes | mean |
|---|---|---|---|
| container originals for this set | 2,748 | ~3.4 GB | ~1.3 MB |
| **before** | 770 | 80.7 MB | 102.3 KB |
| **after** | 2,748 | **143.4 MB** | **51.0 KB** |

3.6x the images for 1.8x the bytes; mean file size halved. Per format after:
JPEG 2,602 / 131.7 MB / 49.4 KB · GIF 128 / 10.1 MB / 77.2 KB · PNG 18 / 1.6 MB /
85.5 KB. Thumbs: 1x 2,748 / 4.5 MB / 1.6 KB, 2x 2,748 / 11.6 MB / 4.1 KB.

Three things that were not obvious and cost a re-run each:

1. **Dispatch on decoded format, not extension.** 45 `.png` files already hold
   JPEG bytes from the 2026-08-06 pass; re-wrapping them as real PNG inflated
   them ~20x. Content-based dispatch also lets the 295 genuine photo-PNGs
   (372 MB) become JPEG under their original names — browsers sniff.
2. **`Image.quantize(method=MEDIANCUT)` refuses RGBA.** It raises "Fast Octree
   and libimagequant are the only valid methods", which the per-file `try` turned
   into a silent skip — every GIF and every transparent PNG passed through
   untouched, leaving 888 MB of GIF on disk while the log said "done".
   `FASTOCTREE` fixes it; GIFs went 1,360 MB → 15.1 MB (90x).
3. **The container has no thumbnail cache.** LiipImagine builds
   `media/cache/submission_thumbnail_{1x,2x}` lazily, so only 5 files exist there;
   a `docker cp`/tar of the directory returns nothing and hangs on the file list.
   `fetch_images.py` now generates them locally from the filter config
   (`70/140 outbound`, quality 60), verified against the 769 previously shipped
   thumbnails at 4-12/255 mean absolute difference — resampling noise, same crop.

`images.json` is regenerated from disk at the end of every run: **2,748 entries,
2,748 referenced, 0 missing, 0 orphaned, 0 above 1000px, 0 without a thumbnail.**
`--prune` removed 601 orphan files (28.1 MB) left behind when the selection rule
changed mid-round.

---

## Phase 3 — merge, build, browser verification (DONE)

Build: **PASS** (`npm run build`, 6.6 s). Verified in headless chromium against a
real `npm run preview` on :5310, at **1920x1080 and 1280x720**, with the live
source at :9999 side by side.

### Final numbers

| | before | after |
|---|---|---|
| submissions | 2,359 | **8,012** (3.40x) |
| comments | 2,593 | **24,149** (9.31x) |
| comments per post | 1.10 | **3.01** |
| posts with >=1 comment | 427 (18%) | **4,760 (59%)** |
| `userDirectory` | 3,899 | **21,038** |
| forums | 95 | 95 (100% of source) |
| images | 770 files / 80.7 MB / 102.3 KB | **2,748 / 143.4 MB / 51.0 KB** |

Comments-per-post distribution: 0 → 40.6%, 1 → 19.2%, 2 → 12.8%, 3 → 9.1%,
4-9 → 13.7%, 10-25 → 2.5%, >25 → 2.1%. (Source: 36.4% at zero, median 8.)

### Anchored records that were missing and are now seeded

| | anchored | present before | **missing before** | present now |
|---|---|---|---|---|
| submissions | 240 | 105 | **135** | **240** |
| comment permalinks | 11 | 2 | **9** | **11** |
| forums | 64 | 54 | 10 → **0 real** | 54 |
| users | 1 | 1 | 0 | 1 |
| page-scoped anchor strings the live source renders | 10 | 7 | **3** | **10** |

The last row was found late and is worth calling out: three `program_html`
strings (`Valenyn` on `/f/memes/21059`, `vote` on `/f/headphones/126662` and
`/f/photoshopbattles/24783`) live inside *specific comments* that a
cap-by-timestamp drops. `anchor_ids.page_string_anchors()` + a content-matched
pull in `extract_expansion.py` now re-adds them by body/author match. The other
252 page-scoped anchor strings are absent from the **live source** too — they are
content the agent creates (new comments, edited bios, new forums), a capability
contract, not a seed contract.

### Must-not-regress — each item, measured

| Item | Result |
|---|---|
| 129 webarena anchors resolve | **PASS.** 314/321 anchor routes across both contracts render `#main`. The 7 that do not: 5 `/f/<name>/edit` create-a-forum routes + `/f/games`, all **404 on the live source too**; and `/submission_images/361ec602….jpg`, which is an image (200, `image/jpeg`, 53,993 B — as is the anchored `.gif`, 200, `image/gif`, 41,351 B). |
| `assets/task_anchors.md` strings verbatim | **PASS.** 10/10 of the page-scoped strings the live source renders (7/10 before). |
| ROUTES rows render cold with `?sid=` | **PASS.** Every one of the 321 anchor routes was loaded cold on an unseen sid. |
| Params drive behaviour | **PASS.** `?sort=`, `?t=all` and the `next[...]` cursor all change output; page 2 of `/f/news` is `next[ranking]=3396&next[id]=65117` and shares no rows with page 1. |
| `sid` survives navigation / redirects / form submits | **PASS.** Pagination, comment create and submit all keep it. |
| Sort output vs source | **PASS, and much improved.** Page-1 exact, of 95 forums: `hot` 5→**95**, `top` 5→**95**, `new` 5→**95**, `most_commented` 5→**95**. At depth 50: `hot` 95, `top` 94. `active` 18/95 and `controversial` 9/95, including both anchored ones (`/f/Art/active`, `/f/springfieldMO/controversial`). All 9 anchored sort routes match the source id-for-id. |
| Page counts / composition | **PASS.** `/f/news` page 1 = 25 rows matching the source id-for-id; page 2 = 25 rows, disjoint. |
| Submit redirect shape | **PASS.** `/submit` → `/f/news/200000/expansion-probe-post?sid=subprobe2`. |
| Comment-create redirect shape | **PASS.** → `/f/news/108576/naval-academy-renames-building-after-jimmy-carter/comment/3000000?sid=…`. |
| `/go` state **shape** | **PASS.** `{initial_state, current_state, state_diff}`; diff keys after a vote + comment: `submissions, comments, votes, nextCommentId`. |
| `/go` state **size** | **REGRESSED — see below.** 4.51 MB → **27.98 MB** cold; 54.2 MB after one vote. |
| Corpus out of app state | **Not achieved — it was never true.** `createInitialData()` has always put `submissions` and `comments` in state; only `images.json` is out. See below. |
| First paint | 388 ms → **901 ms** @1920, 344 ms → **863 ms** @1280 (cold, unseen sid, `/f/news`, built preview). |
| 0 console errors | **PASS.** 0 across the 321-route sweep, the post pages, and both viewports. |
| 0 external requests | **PASS.** 0 at both viewports. |
| Frozen seed untouched | **PASS.** The 2,359 original submissions are a byte-identical prefix of the new file; all 2,593 original comments are present (905 of them had to be re-added by id — they fall outside the timestamp window the caps select over). |
| Referential integrity | **PASS.** 0 duplicate ids, 0 dangling `submission` refs, **0 orphaned `parent`s**, 0 authors absent from `userDirectory`. |

### The one real regression: state size, and what it does and does not break

`createInitialData()` output went **2.70 MB → 13.85 MB**. Consequences, measured:

* **localStorage persistence is now off.** Two keys want ~27.6 M chars against
  Chrome's 5,242,880-char quota; **0 keys held** (was 2). `safeSetItem` swallows
  the quota error, so the page still boots.
* **Correctness is preserved, and I verified it end to end.** Upvote 108576
  (8928 → 8929), post a comment, **reload**: netScore is still 8929 and the
  comment still renders, served entirely from `.mock-states/<sid>.json` via
  `GET /state`. This is the fallback `SCHEMA.md` already documented as
  authoritative; the doc's now-obsolete quota-headroom budget has been rewritten
  with the new numbers.
* **`/go` is 27.98 MB cold and 54.17 MB after one vote**, because
  `calculateStateDiff` is per-top-level-key: changing one submission emits the
  whole old *and* whole new `submissions` array.

I did **not** change the state shape or the diff algorithm — "`/go` state shape
must not regress" is explicit, and a diff-format change is not a seed-round call.
The fix, for whoever takes it: make `calculateStateDiff` element-wise for arrays
whose members carry `id` (shape-preserving — `state_diff.submissions.old/new`
would hold the one changed record instead of 8,012), or move the frozen corpus
out of `state` into imported modules with an id-keyed mutation overlay. Either
one also removes the localStorage problem.

### Known limitations, not fixed

* A post can advertise more comments than its thread renders — deliberate, see
  the `commentCount` decision. `/f/Newark/35682` (the source's all-time
  most-commented Newark post, now correctly seeded) drew a cap of 0 and renders
  an empty thread. A "sort leaders get a comment floor" rule would fix this class
  for ~4k more comments; I did not spend it given the state-size pressure.
* `active` and `controversial` are page-1-exact for only 18/95 and 9/95 forums
  (the anchored ones are covered). Blanket `controversial` coverage costs ~2,400
  extra posts for one anchor route.
* 4 image files failed to re-encode (2 truncated PNGs, 2 GIFs with an overflowing
  frame delay). All four are fixed: `LOAD_TRUNCATED_IMAGES` and a `min(duration,
  65535)` clamp are in the script, and the one file that had been corrupted to
  224 bytes was re-pulled and re-encoded. 0 broken images at render time.

### Pipeline is committed and re-runnable

`.gitignore` was changed from `assets/dumps/` to `assets/dumps/*` +
`!assets/dumps/*.py` — you cannot re-include a file inside an ignored directory,
so the directory itself must not be ignored. Committed:

| Script | Role |
|---|---|
| `anchor_ids.py` | both anchor contracts → submission/comment/forum/user ids, (forum, sort) pairs, page-scoped strings; runnable as a gap report |
| `extract_expansion.py` | selection + SELECT-only extraction from the container |
| `fetch_images.py` | tar-stream the images out; generate thumbs from the LiipImagine config |
| `compress_images.py` | 1000px + hard compress, `--only-oversized`, `--prune`, rebuild `images.json` from disk |
| `merge_seed.py` | additive merge with abort-on-violation invariants and a slug-port self-check |
| `verify_expansion.py` | the browser verification above, both viewports, source side by side |

Order: `anchor_ids` → `extract_expansion` → `merge_seed` → `fetch_images` →
`compress_images` → `compress_images --prune` → `npm run build` →
`verify_expansion`.
