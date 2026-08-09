# webarena_shopping_mock — Audit Report

> Round: **12 — FINAL gate**, over the exact tree that is proposed for release
> (post-shard-**S** search parity, post-shard-**T** fotorama gallery).
> Date: 2026-08-09
> Audited by: audit agent
> **Dimension audited: MIGRATION PARITY + SEED INTEGRITY.**
> Handlers, DESIGN.md tokens and the `/post` `/state` `/go` internals were
> audited in round 3 and are not re-covered beyond the release gates below.
> Full working notes — every query, script and measurement:
> **`AUDIT.part-final.md`**. Previous rounds: `AUDIT.part-round9.md`,
> `AUDIT.part-todo-reconcile.md`, `AUDIT.part-round8.md`.

---

## P0 count: **1**

**There is one P0, and it blocks six visualwebarena tasks.**

Six `__SHOPPING__` product pages that are **task start URLs** render the mock's
404 page (`Whoops, our bad...`). All six exist on the live source (6/6 HTTP 200)
and all six are absent from the seed, media included. Each task asks the agent to
look at *that product's image* on OneStopMarket and match it against a
classifieds listing, so the mock does not error — it makes the task unachievable
and **silently scores 0**.

**Everything else measures clean, and cleanly.** Whole-population seed integrity
against the container is exact on products, descriptions, options, reviews,
categories, listings and orders. 380/380 anchored routes render, 43/43 media
anchors serve, 174/174 evaluator SKUs resolve, 992 anchor-string `|OR|` groups
leave 0 real gaps, shard S's key folding is provably lossless, shard T's gallery
rewrite is correct for all 11 358 products, and `npm run build` passes.

### Why nine rounds missed it

Every earlier anchor sweep selected shopping tasks by **`web_name == "shopping"`**,
which yields **671** tasks. Selecting by *"has a `__SHOPPING__` URL in `web[]`"*
yields **679**. The eight extra are visualwebarena cross-site tasks whose
`web_name` is `["classifieds"]` but which **start the agent on a OneStopMarket
PDP**. Six of those eight PDPs are unseeded. Scanning all 1 720 tasks over every
field adds nothing beyond those 679, so the universe is now closed at **380**
routes and **43** media URLs.

A second, compounding reason: "the route renders an `h1`" was treated as a pass.
The mock's 404 page has `h1 = "Whoops, our bad..."`, so an h1-only check scores a
404 green. That is very likely how "376/376 clean" was reached in rounds 7, 8
and 9. This audit asserts `Whoops, our bad` / `title == 404 Not Found`
separately.

## Summary

| Category | Issues |
|----------|--------|
| **Anchored routes that 404 (real gaps)** | **1 finding — 6 routes, 6 tasks** |
| Route parity breaks (`ROUTES.md`) | 0 |
| Missing anchored strings / SKUs / media / locators | 0 |
| Seed integrity breaks (records dropped, mutated, duplicated, fabricated) | 0 |
| Seed values that disagree with the container | 0 |
| Network / auth leaks | 0 |
| Shard S regressions (key folding, min query length) | 0 |
| Shard T regressions (gallery DOM) | 0 |
| Schema staleness | 1 (**fixed in this round** — F12-002) |
| Stale artifacts / checks narrower than they read | 3 (R8-003, R8-006, F12-003) |
| Cosmetic / no evaluator exposure | 3 (R8-004, R9-002, R9-003) |
| **Total findings** | **9** — **1 P0**, **0 P1**, **8 P2** |

## Verification posture

Nothing here is adopted from a dev or prior-audit claim. I ran my own
`npm run build` (`✓ built in 16.54s`, exit 0) and served the result with
`vite preview` on `:5240`. Ground truth was re-dumped from container `shopping`
by my own SELECT-only queries; the container was never written to and the live
source was only ever navigated (login + GET). Login to the source was asserted
**hard** — `/customer/account/` must render `h1 = "My Account"` — before any
logged-in comparison.

> **Two store-scope traps, one of which I hit.** I checked for store-scoped EAV
> overrides *before* comparing and found **7 841** products carrying store-1 rows
> for `name`, `status` and `visibility`. A store-0-only dump would have reported
> 7 841 false name mismatches. (Round 9 recorded the sibling trap on
> `description`, where store 0 is an admin placeholder for all 104 368 rows.)
> **Any future audit comparing Magento EAV must pin the store scope and use
> `COALESCE(store1, store0)`.**

> **Three findings I raised and then withdrew** rather than shipping them.
> (1) `categories[].dbProductCount` disagrees with **both**
> `catalog_category_product` and `catalog_category_product_index_store1` on 289
> of 301 categories — but the **live source renders the seed's number**, 29/29
> across a stratified sample. Both tables are the wrong denominator. (2) 19
> anchor strings looked absent from the seed; they are all present — a raw-text
> scan reports false absences on product names containing `"`, which is
> JSON-escaped in the file. (3) 338 sweep routes "failed" on my first pass
> because I reused one browser context across 380 sids and blew the origin's
> localStorage quota after 42. Each is written up in `AUDIT.part-final.md`;
> none is a defect.

---

# P0

## F12-001 · Six anchored task-start PDPs render the 404 page

- **Files**: `src/data/products.json`, `src/data/descriptions/dNN.json`,
  `src/data/productOptions.json`, `src/data/reviews.json`,
  `public/media/catalog/product/B/0/`
- **Not a regression** from shard S or T — neither touched the seed (proven by
  mtime: newest seed file 01:13, shard S 03:36–03:45, shard T 06:07–06:17)

| entity_id | sku | task | `web[]` slot | source | in seed | media |
|---|---|---|---|---|---|---|
| 102585 | `B07T7NHZ6V` | `visualwebarena-876` | `web[0]` | **200** | **no** | **missing** |
| 31278 | `B07HKR2QP9` | `visualwebarena-900` | `web[1]` | **200** | **no** | **missing** |
| 95401 | `B09GBF3LL2` | `visualwebarena-901` | `web[0]` | **200** | **no** | **missing** |
| 4865 | `B08KWBD79C` | `visualwebarena-902` | `web[1]` | **200** | **no** | **missing** |
| 14869 | `B08P6WNTP4` | `visualwebarena-903` | `web[1]` | **200** | **no** | **missing** |
| 34713 | `B081T9WK66` | `visualwebarena-904` | `web[1]` | **200** | **no** | **missing** |

All six questions have the same shape — *"…the top left animal in the first
image of the listing on OneStopMarket"*, *"…the shape on the right side of the
hoodie shown on OneStopMarket"*, *"…the third animal from the left shown in the
product image on OneStopMarket"*. The PDP **image** is the task's only input, and
the agent is dropped straight onto it. The evaluator asserts a
`__CLASSIFIEDS__` URL, so nothing throws; the task is simply impossible and
scores 0 every time.

**Fix**: seed the six products from the container the same way the tier-B round-8
products were seeded, and copy their media. What each needs, counted from the
container:

| entity_id | sku | price | gallery entries | option groups | approved reviews |
|---|---|---|---|---|---|
| 4865 | `B08KWBD79C` | 7.20 | 2 | 0 | 0 |
| 14869 | `B08P6WNTP4` | 19.99 | 2 | 1 | 0 |
| 31278 | `B07HKR2QP9` | 15.94 | 2 | 1 | 0 |
| 34713 | `B081T9WK66` | 32.83 | 1 | 0 | 0 |
| 95401 | `B09GBF3LL2` | 0.55 | 2 | 2 | 0 |
| 102585 | `B07T7NHZ6V` | 8.99 | 2 | 0 | **8** |

Because the tasks are image tasks, these six should be seeded at **tier A** —
the **full** gallery, and media copied at the **highest resolution available**,
not the ≤ 320 px downsample most of `public/media` carries. A 320 px copy may
still be legible enough to answer "what animal is top-left", but it is the one
thing these six tasks are graded on, so do not economise here.

**Also fix the check that missed it**: any future sweep must select shopping
tasks by *"a `__SHOPPING__` URL appears anywhere in the task"*, not by
`web_name`, and must assert the page is not the 404 CMS page rather than merely
that an `h1` exists.

---

# P1

**None.** R9-001 (case-sensitive capture lookup) and DIFF-A01 (no minimum-query
guard) were the round-9 P1s; shard S fixed both and I re-verified them
independently (§3 of the working notes).

---

# P2

## F12-002 · SCHEMA.md was stale — **fixed in this round**

Round 9 recorded `SCHEMA.md` as accurate and "updated for the `searchindex`
shards". It was not: `src/searchindex/` had **no entry at all**, the per-view
gating table still said **search** waits on `descriptions`, and the first-paint
table still carried the pre-index `4/4 chunks, 16.88 MB gz` figure that shard Q
had already invalidated. It also still advised, as a future improvement, the
token index that already exists.

Updated (details in the working notes §6): the `src/searchindex/s00…s63.json`
row (**64** shards, **73 404** tokens, **1 944 170** postings, 6.2 MB — all four
counted by me), the `1 552` distinct exact listing keys, the corrected per-view
table, a round-12 measured chunk table, and a new **§6.1** documenting shard S's
key folding and the minimum-query-length provenance.

## F12-003 · `dist/` does contain external hostnames — inert, but the previous statement was wrong

Round 9 wrote that `dist/` "contains only `w3.org`, `schema.org`,
`reactjs.org`". The shipping `dist/` also contains **54** external URLs inside
`seed-reviews-*.js`, **6** across five `seed-descriptions-*.js` chunks, and
`www.magentocommerce.com/bug-tracking` (the source's own footer link).

The **conclusion still holds** and I verified it four ways: reviews render as
plain text so a review containing a literal `<iframe src="https://www.youtube.com/embed/…">`
is escaped; the description URLs are body text, not `src=`/`href=` attributes;
there are **0** `<img src="http…">` anywhere in `dist/`; and loading the four
PDPs that carry these strings, with the Reviews tab opened, produced **0**
external requests. Across the whole 380-route sweep: **0** external requests.
Worth restating accurately so the next reader does not think a grep found
something new.

## F12-004 · `MIN_QUERY_LENGTH`'s seed-driven path is inert

`catalog.js:894` reads `storeConfig.minQueryLength` and falls back to 3.
`storeConfig.json` does not carry the key, so the fallback is what runs. The
**value is correct** — `core_config_data` has 0 rows matching `catalog/search%`
at any scope, so the container's effective value is the module default 3 — but
the configurable path is untested until the seed carries the key.
**Fix**: add `"minQueryLength": 3` to `storeConfig.json`.

## R8-006 · `assets/task_anchors.json` still covers `webarena.jsonl` only — STILL OPEN, and now demonstrated harmful

`"source": "/webarena/webarena.jsonl"`, `"task_count": 192`. The 487
visualwebarena shopping tasks are absent from the artifact
`WEBARENA_MIGRATION.md` §4.1 names as *the* anchor file. This round's P0 came
from exactly this failure mode — a denominator narrower than it reads — so this
is no longer theoretical. **Fix**: regenerate over both files, or retire it in
favour of `anchor_sweep.json`, and say which in `SOURCE.md`.

## R8-003 · `anchor_sweep.py`'s URL check still excludes multi-segment paths — STILL OPEN

`assets/dumps/anchor_sweep.py:425` still has no `/` in its character class, so
every multi-segment category URL is filtered out before the check begins. I did
not use the script — this round's sweep is independent. **Fix**: add `/`, and
source URLs from `web` as well as `eval`.

## R8-004 · `listings[].toolbarAmount` still stores a string the source never renders — STILL OPEN

1 212 of 1 521 entries hold `"Items 1 - 12 of N"` against the source's
`"Items 1-12 of N"`. Nothing renders the field — `Toolbar.jsx` rebuilds the
string — so it costs nothing today.

## R9-002 · layered-nav block present on uncaptured search terms where the source omits it — STILL OPEN

Unchanged from round 9. Captured terms — the ones tasks use — are unaffected, and
there are **0** `must_exclude` assertions on any shopping search page.

## R9-003 · review-form legend spacing / `<strong>` display — STILL OPEN

Unchanged from round 9. No evaluator reads it.

---

# Declared and accepted gaps — do not re-litigate

These were established by earlier rounds, re-confirmed by measurement this
round, and are **accepted**, not defects.

| gap | status this round |
|---|---|
| **webarena-280** — `must_include` names an Anker charger that does not exist in the container | **upstream task defect.** Unchanged |
| **webarena-353** `reference_url[2]` — `/…/sport-specific-clothing.html&product_list_order=price` (`&` where Magento needs `?`) | **upstream task defect, measured**: the live source returns **HTTP 404** with `title = 404 Not Found` and `Whoops, our bad...` — the mock renders the same page. It is the third of three `\|OR\|` alternatives; the other two serve 200 on the source **and** render correctly in the mock |
| **`.products-grid .wishlist .product-image-photo`** (4 VWA `page_image_query` tasks) | **upstream evaluator defect, proven from Magento's own source**: `module-wishlist/view/frontend/templates/item/list.phtml:12` emits `<div class="products-grid wishlist">` — one element, both classes — so a *descendant* combinator matches **0 nodes on the real site too** |
| **The sampling ratio** — 11 358 of the container's 104 368 products | Accepted. Result **counts** on uncaptured search terms and facet buckets stay seed-scale; captured pages carry the source's own counts and ordering |
| **Deep pagination beyond seeded depth** | Accepted. Captured pages name ids the seed may not hold; `resolveListing()` renders the captured products that *are* seeded in source order and tops up from the derived pool |
| **Tier-B galleries — 946 products ship 1 image** | Re-verified whole-population: **946/946** are in-order **subsequences** of the container's gallery, **0** invented images, length pairs `1/2` ×942, `1/3` ×1, `1/4` ×3. **10 412 / 11 358** galleries are exact. **0** of the 43 evaluator `/media` URLs affected |
| **Downsampled media** — ~91 % of `public/media` is ≤ 320 px on the long edge | Accepted, *except* for the six products in **F12-001**, whose tasks are graded on the image |
| **`searchTerms.json` holds 100 of the container's 383 terms** | Accepted. The related-terms **algorithm** matches the source exactly; its **membership** is capped by the sample |
| **Description sanitising** — 3 175 of 11 358 descriptions are strict subsets | Accepted and re-verified: **0 invented words** anywhere. 3 157 lose an embedded `m.media-amazon.com` URL; the other **18** lose only inline Amazon A+ `<style>` CSS (and one `<script>`), **no prose** |

---

# Migration Parity Status

| Check | Status | Notes |
|-------|--------|-------|
| Route coverage (`ROUTES.md`) | ✅ | **42** rows: **41** `[x]`, **1** `—` (row 38 `/customer/account/login/`, Not migrated by design). `App.jsx` declares 58 `<Route>`s |
| **Anchor route sweep** | ❌ | **380 / 380** render with an `h1`, but **7** of those render the **404 CMS page**: 1 correctly (webarena-353's malformed URL, which the live source 404s too) and **6 as real gaps** (**F12-001**). So **373 / 380** serve their intended page and **374 / 380** match the source. Universe re-derived threshold-free, `\|OR\|`-aware, over the whole `eval` of **all 1 720 tasks**: 679 touch shopping, 380 distinct routes, and scanning every field adds 0 |
| Anchor strings | ✅ | **992** `\|OR\|` groups; **854** satisfied, **138** unsatisfied and **all 138 classified** as agent-typed input (76), derived answer (54), cross-site assertion (3), URL answer whose route resolves (2), image/OCR answer (1) or webarena-280 (1). **0 real gaps** |
| Anchored SKUs | ✅ | **174 / 174** ASIN-shaped SKUs appearing anywhere in `eval` are in `products.json` |
| **Media contract** | ✅ | **43 / 43** HTTP 200 with JPEG magic on my built preview; unmatched `/media/**` and two traversal forms all **404**. The 43rd is `visualwebarena-650`'s relative `\|OR\|` alternative, which a host-prefixed regex misses |
| Evaluator locators | ✅ | **84** locators + **6** `eval_image_class` driven on their target pages. 0 real gaps; the one selector that cannot resolve is an upstream defect (see declared gaps) |
| Cold deep-link render | ✅ | `Loading…` on **0** of 380 routes |
| Console / page errors | ✅ | **0** across 380 sweep routes, 18 PDP loads, 9 locator pages |
| `sid` survives navigation | ✅ | **380 / 380**. Only 2 `<Navigate>` sites, both query-preserving |
| Seed uses real identifiers | ✅ | Whole population: **11 358 / 11 358** exact on `sku`, `typeId`, `name`, `urlKey`, `price`, `specialPrice`, `image`, `smallImage`, `thumbnail`, `status`, `visibility`, `qty`, `inStock`, `createdAt`, `categoryIds`. 0 duplicate ids, 0 duplicate SKUs, **0 fabricated ids** |
| Seed descriptions | ✅ | **11 358 / 11 358** accounted for: 8 183 tag-stripped identical, 3 175 strict word-subsets, **0 invented words** |
| Seed options | ✅ | **4 884** products, **6 952** options, **42 148** values — **0** mismatches, 0 missing, 0 extra |
| Seed reviews | ✅ | **32 594** = *every* approved container review for the seeded population. 0 missing, 0 fabricated, 0 field mismatches across 7 fields. `reviewCounts.json` 3 351 entries, **0** wrong |
| Seed categories | ✅ | **301 / 301** exact on 9 fields. The 2 container ids absent are `Root Catalog` and `Default Category`, neither browsable. `dbProductCount` verified against the **live source**, 29/29 |
| Seed orders | ✅ | **37 / 37** orders exact on 13 fields, **100 / 100** line items exact on 6 |
| Captured listings vs source | ✅ | 14-listing stratified spot-check: **14 / 14** in agreement on `totalCount` (the one apparent miss is the empty-result page, where the source renders no toolbar and the capture stores 0) |
| Seed size | ⚠️ | `src/data/` 99 MB on disk (`productDescriptions.json` deliberately kept as a pipeline artifact *and* re-sharded), `src/searchindex/` 6.2 MB. What ships: `/go` **123 357 B**; no route fetches more than **7.86 MB** of JS |
| Zero external network calls | ✅ | **0** external requests observed anywhere. `dist/` does contain external hostnames, all inert — see **F12-003** |
| No auth gates | ✅ | No route guard, no login redirect; boots as Emma Lopez |
| **Shard S — key folding** | ✅ | 1 554 captures → **1 552** exact keys; **2** collisions, both same-query pairs, **identical** in `totalCount`, `productIds`, `toolbarAmount`, `sorterOptions`, `limiterOptions`, `sortDirNext`, `currentFilters`, `pageLinks`. The 4 differing fields (`url`, `query.q`, `title`, facet `href`) **never reach the screen**. 0 shadowed, 0 mis-keyed, 0 data lost |
| **Shard S — minimum query length** | ✅ | Container's effective value is **3** (`core_config_data` has 0 `catalog/search%` rows at any scope; no `env.php`/`config.php` override; module default applies). Mock uses 3 |
| **Shard T — gallery** | ✅ | Whole population: **0** duplicate paths, **0** empty galleries, **0** products where `product.image` is missing from the rendered gallery, **11 358 / 11 358** open on the container's base image. Rendered DOM on 9 PDPs × 2 viewports: **18/18** on all 15 assertions |
| Visible-string fidelity | ⚠️ | Unchanged from round 9 (R9-003 open, cosmetic) |

# Data Pipeline Status

| Component | Status | Notes |
|-----------|--------|-------|
| `dataManager.js` | ✅ | Only 3 `fetch(` sites, all to `/state` and `/post` |
| `createInitialData` loads `src/data` | ✅ | Catalog kept **out** of app state — `/go` `initial_state` has 15 keys, **0** catalog keys |
| `vite.config.js` `/post` `/state` `/go` | ✅ | `/go` returns `{initial_state, current_state, state_diff}` |
| Session isolation (`?sid=`) | ✅ | Two sids injected independently, no bleed |
| `.initial.json` handling | ✅ | `set_current` updated `current` only, `initial` unchanged, diff showed the change |
| `reset` | ✅ | Restored `current` to `initial`, diff → `{}`, other sid untouched. Handler byte-identical to the hub reference `mixpanel_mock/vite.config.js` |
| `/go` size | ✅ | **123 357 B** — byte-identical to rounds 8, 9 and both post-shard measurements |
| SCHEMA.md accuracy | ✅ | **Was stale (F12-002); updated this round.** All 15 live state keys documented, 0 undocumented; Observable State Changes table present with **27** action rows (round 9 reported 47 — that figure does not match the file, which has one table of 27) |
| `npm run build` | ✅ | My own run: `✓ built in 16.54s`, **exit 0** |

## SCHEMA.md Updates

Seven changes, listed in **F12-002** and detailed in `AUDIT.part-final.md` §6:
the new `src/searchindex/s00…s63.json` row, the `1 552` listing-key figure, the
corrected per-view gating table, a round-12 measured chunk table replacing the
stale round-8 one, removal of the obsolete "remaining levers" advice, the
round-12 header, and a new **§6.1** documenting shard S.

---

# Fix order for the dev agent

1. **F12-001 (P0)** — seed the six products (102585, 31278, 95401, 4865, 14869,
   34713) at **tier A**: full gallery, options and reviews from the container,
   and media copied at the **highest resolution available**. These six tasks are
   graded on the photo. This is a serial seed step, not a shard action.
2. **Fix the sweep, not just the seed** — select shopping tasks by *"a
   `__SHOPPING__` URL appears anywhere in the task"* (679, not 671), and assert
   pages are not the 404 CMS page rather than merely that an `h1` exists.
   Otherwise the next unseeded start URL is invisible again.
3. **R8-006 (P2)** — regenerate or retire `assets/task_anchors.json`. This
   round's P0 is what a half-scoped anchor artifact costs.
4. **F12-004 (P2)** — add `"minQueryLength": 3` to `storeConfig.json`.
5. **R8-003 (P2)** — one character (`/`) in `anchor_sweep.py:425`.
6. **R8-004 / R9-002 / R9-003 (P2)** — cosmetic; no evaluator reads any of them.

## Recommendation

**Do not declare the migration complete yet.** One seed step stands between this
tree and a clean release: six products and their media. Everything else in this
dimension — whole-population seed integrity, the 380-route anchor contract, the
43-URL media contract, 174/174 SKUs, the string and locator contracts, both post-
audit shards' blast radius, and every standing release gate — measures clean on
my own instruments, and I would sign those off without reservation. Reseed the
six, re-run the corrected sweep, and this is ready.

## Out-of-dimension observations

- `search_query.popularity` in the container has drifted **upward** on 30 of the
  100 seeded terms (`xbox` 2→10, `B091BB3B86` 3→9, `toothbrush` 2→7) because
  every round's `?q=` GET makes Magento log a row. The seed is a faithful
  snapshot; the container moved. Worth a line in `SOURCE.md` so a future round
  does not read it as seed drift.
- `src/data/productDescriptions.json` (34 MB) remains duplicated by
  `src/data/descriptions/d00…d31.json`; I verified the two agree on **0 / 11 358**
  differing entries. Deliberate and disclosed; `dist/` is unaffected.
