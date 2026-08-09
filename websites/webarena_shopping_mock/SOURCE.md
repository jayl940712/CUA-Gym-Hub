# shopping (One Stop Market) — Recon Record

> Target mock: `websites/webarena_shopping_mock/`
> Recon by: plan agent, 2026-08-05. This run resumed an interrupted earlier run;
> the 24 HTML captures and the three order dumps it produced were reused, not
> re-scraped.

---

## Access

| Probe | Result |
|---|---|
| `docker ps --filter name=shopping` | `shopping` — image `shopping_final_0712`, `0.0.0.0:7770->80/tcp`, **Up** |
| `curl -sL --noproxy '*' http://localhost:7770` | **200**, redirects to the absolute base `http://10.186.197.203:7770/` |
| `docker exec shopping mysql -u magentouser -pMyPassword magentodb` | **works** |
| Login `emma.lopez@gmail.com` / `Password.123` | **works** (POST `/customer/account/loginPost` → `/customer/account/`) |

**Recon mode: FULL.** Both the database and the live site were available and
both were used.

Practical notes for anyone re-running this:

- Always pass `--noproxy '*'` to `curl`; the environment has a proxy that
  otherwise intercepts `10.186.197.203`.
- The site 302s every request to the absolute `web/unsecure/base_url`
  (`http://10.186.197.203:7770/`), so `curl` needs `-L` or the absolute host.
- There is **no Node and no system Playwright** in this sandbox and no sudo.
  Screenshots were taken by creating a venv (`/tmp/pwvenv`), running
  `playwright install chromium`, then supplying the missing GTK/ATK shared
  libraries without root: `apt-get download` the dependency closure into
  `/tmp/debs`, `dpkg-deb -x` each into `/tmp/sysroot`, and launch with
  `LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu`. Scripts:
  `assets/dumps/shots.py`, `shots2.py`, `tokens.py`, `tokens2.py`.

### Read-only discipline

The container is a benchmark instance and was treated as read-only:

- Only `SELECT` statements were issued. No `INSERT` / `UPDATE` / `DELETE`, no
  DDL, no temp tables.
- No mutating form was submitted through the UI. Specifically: nothing was added
  to the cart or the wishlist, no review was posted, no address was saved, no
  contact form submitted, and **`Next` / `Place Order` were never clicked on
  `/checkout/`**.
- The only state-changing action was logging in, which creates a session and
  nothing else. Emma's cart still holds exactly the 3 items it held before.

---

## Stack

| Layer | Detail |
|---|---|
| Application | Magento 2 (Open Source), storefront only |
| Theme | **`Magento/blank`** with a custom text wordmark — not Luma. Static assets under `/static/version1681826198/frontend/Magento/blank/en_US/` |
| Server | PHP-FPM + nginx inside the container; MySQL, Elasticsearch, Redis, Varnish ports are all exposed on the container but only 80 is published as 7770 |
| Database | MySQL `magentodb`, user `magentouser` / `MyPassword` |
| Locale | `en_US`, currency `USD`, timezone **`America/New_York`** |
| Store name in UI | `One Stop Market` (`design/header/welcome` = `Welcome to One Stop Market`) |
| Catalog size | 104 368 products, 303 categories, 308 939 approved reviews |
| Default customer | Emma Lopez, `customer_entity.entity_id = 27` |

---

## What was captured

| Artefact | Location | Count / size |
|---|---|---|
| Route map | `ROUTES.md` | 42 routes, 12 query params |
| Design tokens | `DESIGN.md` | measured via `getComputedStyle` on the live site |
| Per-view UI reference | `assets/README.md` | 18 views + component inventory |
| Data model | `assets/data_model.md` | 13 entities |
| Screenshots | `assets/screenshots/reference/` | 36 PNGs at 1440×900, full-page |
| Page HTML | `assets/html/` | 36 pages (4.8 MB) |
| Listing HTML corpus | `assets/dumps/listings-html/` (gitignored) | 121 pages |
| Raw DB dumps | `assets/dumps/*.jsonl` (gitignored) | products, options, gallery, reviews, descriptions, categories, orders, order items, order addresses, search terms |
| Recon scripts | `assets/dumps/*.py`, `*.sql`, `*.sh` | reproducible end-to-end |
| Curated seed | `src/data/*.json` | 12 files, **4.61 MB** |

Seed contents: 1 105 products · 301 categories · 3 080 reviews · 424 option
groups · 37 orders / 100 order lines · 1 customer + 1 address · 3 cart lines ·
121 captured listings (48 of them searches) · 60 search terms.

---

## Observations that will bite the dev agent if missed

1. **`store_id` matters for product descriptions.** At `store_id = 0` every
   `description` row is the literal string `"This is the description placeholder
   for the product"`. The real HTML lives at `store_id = 1`. Names are at
   `store_id = 0` (only 64 of 1 105 have a store-1 override).

2. **There are no configurable products.** All 1 105 seeded products are
   `type_id = simple`; Size/Color variants are Magento *custom options* of type
   `radio`. Don't build swatches.

3. **`?cat=<id>` on a parent category page filters to a descendant** and returns
   exactly the same result set as visiting the child directly — but the `<h1>`
   stays the parent's name. Verified:
   `/clothing-shoes-jewelry.html?cat=145` and
   `/clothing-shoes-jewelry/men/shoes.html` both render `Items 1 - 12 of 2523`,
   with titles `Clothing, Shoes & Jewelry` and `Shoes` respectively. Several
   WebArena start URLs use the `?cat=` form.

4. **`price=` stacks.** Task URLs contain `price=0-10%2C0-100` (two buckets).
   The rendered "Now Shopping by" chip shows only the narrowest
   (`$0.00 - $9.99`) and the result count matches that bucket alone.

5. **The home-page pager param is `pbaocw`, not `p`.** It's the widget instance
   hash. `/?p=2` silently returns page 1.

6. **Search pages have a `Relevance` sort option; category pages have
   `Position`.** Default sort differs accordingly.

7. **Price filter buckets are computed per result set**, not fixed. Headphones
   unfiltered → `$0.00 - $999.99 (628)` / `$1,000.00 and above (3)`. Men's Shoes
   filtered to `0-10,0-100` → `$1.00 - $1.99 (3)`, `$2.00 - $2.99 (2)`, …
   `listings.json` carries the captured buckets; copy them.

8. **Timezone is load-bearing.** `America/New_York`. Order 170 stores
   `2023-05-18 03:39:44` UTC and the order grid prints `5/17/23`. Grids use
   `M/D/YY`; the order view uses `March 11, 2023`.

9. **Category product counts differ between the DB and the storefront.**
   `COUNT(*)` over `catalog_category_product` includes disabled/invisible rows:
   cat 60 → 650 in the DB, `of 631` rendered. Prefer the captured
   `listings.json[].totalCount`.

10. **Search is fuzzy.** `q=asdfghjkl` returns `1 Item`, not an empty state, and
    `q=iphone 12 phone case` returns 43 033 results — Elasticsearch OR-matching
    across the whole 104 k catalog. A client-side mock cannot reproduce these
    counts by computation; that's why `listings.json` exists.

11. **A malformed URL 404s rather than degrading.** The WebArena start URL
    `/clothing-shoes-jewelry/sport-specific-clothing.html&product_list_order=price`
    (note `&` where `?` belongs) renders `Whoops, our bad...`. The mock's
    catch-all must behave the same.

12. **The store has no customer service phone number.**
    `general/store_information/phone` is NULL and no phone appears on
    `/contact/` or in the footer. The WebArena task expects `N/A`. Do not
    fabricate one.

13. **Emma's order statuses are only `complete` (25), `canceled` (9) and
    `pending` (3).** Tasks that ask for the most recent "processing" / "on hold"
    / "out for delivery" order expect `N/A` — the mock must genuinely have none.

14. **The arithmetic in the order-history task cluster reproduces exactly**
    against the seeded 37 orders: "past four months" → 3 orders / **$845.49**,
    "past year" → **$6 560.69**, both matching the WebArena reference answers to
    the cent. Do not adjust any order total.

---

## WebArena task surface

`/tmp/recon/shopping/tasks.txt` (also copied to `assets/dumps/`) holds the
**192 shopping intents** extracted from `webarena.jsonl` — 187 shopping-only and
5 shopping+reddit. Their start URLs resolve to 45 distinct product/category
paths (`assets/dumps/task_urls.txt`), every one of which is in the seed.

| Cluster | ~Tasks | Routes (`ROUTES.md` rows) |
|---|---|---|
| Review mining on a given PDP | 20 | 5, 7 |
| Order-history arithmetic & lookups | 35 | 28, 29 |
| Category browse / filter / sort | 30 | 3, 4 + `cat`/`price`/`product_list_order` |
| Search + search sort | 20 | 9, 10, 11 |
| "Go to the product page for X" (market survey) | 15 | 3, 5 |
| Wishlist adds | 12 | 5, 32, 33 |
| Contact-form refund requests | 12 | 39 |
| Write a product review | 5 | 5, 7, 34 |
| Reorder a cancelled order + checkout | 5 | 28, 29, 31, 15, 20, 21 |
| Buy highest-rated within a budget | 7 | 3, 5, 15, 20, 21 |
| Address book update | 5 | 22, 25, 26, 27 |
| Change delivery address on an existing order | 5 | 28, 29 (+ contact form; not supported natively by Magento) |
| Newsletter subscribe | 1 | 37 |
| Price range / brand aggregation | 6 | 9, 3 |

---

## Gaps / unverified

Everything in this section is something I could **not** observe. The dev agent
must not silently guess past it.

1. **Checkout beyond step 1 was not exercised.** I loaded `/checkout/` and read
   its DOM, but did not click `Next` or `Place Order` because both write to the
   live quote. The step-2 (`Review & Payments`) layout, the exact
   `/checkout/onepage/success/` copy, and the increment-id allocation behaviour
   are described from the checkout DOM + Magento's stock two-step layout, **not
   from a rendered capture**. Verify against the source before trusting the
   success-page strings.

2. **No mutating flow was observed end to end.** Add-to-cart, add-to-wishlist,
   review submission, address save, newsletter save, and contact-form submit are
   all described from their forms and from Magento's standard success messages.
   The exact green-bar strings in `assets/README.md` for those flows are the
   Magento defaults and should be treated as high-confidence-but-unverified.

3. **Search / filter result counts for *uncaptured* URLs cannot be computed.**
   `src/data/listings.json` now holds **1 383 captured listing snapshots**
   (up from 121 — see `assets/dumps/capture_listings.py`, run 2026-08-05).
   The corpus covers:
   - every listing URL in `assets/dumps/task_urls.txt`;
   - every layered-nav facet URL (`?cat=`, `?price=`, and stacked
     `?cat=…&price=…`) reachable by **one click** from an already-captured
     page — i.e. every price bucket the nav itself offers on every captured
     category, 934 URLs;
   - `?price=` on every captured category path for the seven ranges real task
     URLs use (`0-100`, `0-1000`, `200-300`, `0-10,0-100`, `20-30,0-100`,
     `100-200`, `1000-`), 265 URLs;
   - `/catalogsearch/result/?q=…` for all **60** terms on
     `/search/term/popular/` plus 19 further terms named in ROUTES.md/TEST.md,
     63 URLs.

   For those the count, the toolbar string, the facet block and the page-1
   product ids are the source's own. **Anything outside that set is still an
   approximation** and *will* disagree with the source on the count: the seed
   holds 1 105 of the container's 104 368 products, so a derived count lands
   near 1 % of the real one (`?q=chair` → mock 29, source 3 420). The fallback
   matcher (`searchSeed` in `src/utils/catalog.js`) now reproduces Magento's
   *semantics* — OR across tokens, word-boundary matching, plural-insensitive,
   scoring name/sku/url_key above description exactly as `search_weight` does —
   so the *records* are sensible (`?q=hair dryer` no longer returns chairs and
   furniture), but the *magnitude* cannot be reproduced from a 1 % sample and is
   never faked.

4. **Pagination beyond the captured page(s).** For most listings only page 1 was
   captured (page 2 as well for Headphones, Video Games and `q=usb wifi`). Deep
   pages will be synthesised from the seeded pool and will not match the source
   item-for-item.

4b. **A captured page can name products the seed does not hold.** The captures
   record the source's real page-1 entity ids, but the seed is a 1 105-product
   sample, so for a filter deep enough to leave the sample behind the grid is
   topped up from the seeded pool after the captured products that *are* seeded
   (`resolveListing` in `src/utils/catalog.js`). Two observed extremes:
   `/electronics/headphones.html?cat=210&price=0-100` renders 3 of the source's
   first 12 plus 1 filler; `/clothing-shoes-jewelry/women/clothing.html?price=200-300`
   renders the correct `Items 1-12 of 24` over an **empty** grid because the
   sample holds no women's clothing in that price band at all. The count is
   always the source's; the grid is best-effort and never invents a product.

5. **84 of the 301 categories have no seeded products** (217 are populated). Those
   leaf categories will render an empty grid where the source shows products.
   If a task turns out to need one, re-run
   `assets/dumps/fetch_listings.sh` with that path and re-run `build_seed.py`.

6. ~~**Product images were not copied out of the container.**~~ **CLOSED
   (round 6).** All four image fields resolve for all seeded products:
   **19 225 referenced paths ↔ 19 225 files** under `public/media/`, 0 missing,
   0 orphans. See `assets/dumps/vwa_images.py` for the re-encoding tiers.

7. ~~**Rating percentages vs. seeded review counts can disagree.**~~
   **SUPERSEDED (round 7).** Every approved review the container holds for a
   seeded product now ships — 30 105 bodies. See
   "R6-005 — review bodies vs `reviewsCount`" below. `ratingSummary` is still the
   source's `review_entity_summary` percentage and is still not recomputed from
   the shipped bodies, deliberately: it is what the tiles and the PDP header
   print on the source.

8. **`Stored Payment Methods`, `Check Out with Multiple Addresses`,
   `Share Wish List`, and the compare-list detail page** were seen as links but
   their target pages were not captured.

9. **The mini-cart, autocomplete and mega-menu were captured open**, but their
   full interaction surface (qty stepper writes, autocomplete keyboard nav) was
   not exercised.

10. **Advanced-search result behaviour** was probed only far enough to confirm
    `/catalogsearch/advanced/result/?name=headphones` returns 200 with the title
    `Advanced Search Results`. The field list in `assets/README.md` §4 is read
    from the form DOM, not from a submitted query per field.

---

## Decisions on record

Each of these was re-litigated at least once because the reasoning lived only in
a shard report. They are written here so the next round does not spend a shard
re-deriving them. Every one is backed by a measurement against container
`shopping` or the live source at `http://10.186.197.203:7770`.

### R6-005 — review bodies vs `reviewsCount`: **ship the bodies, never clamp the count**

**Decision (round 7, shard L): backfilled. `reviewsCount` is never modified.**

`reviewsCount` is the container's `review_entity_summary.reviews_count`. Until
round 7 the seed shipped review *bodies* for tier-A products only, so 2 517
products advertised more reviews than they listed. Two fixes were on the table
and they are not equivalent:

| | backfill the bodies (**chosen**) | clamp `reviewsCount` to bodies shipped |
|---|---|---|
| fabricates review text | no | no |
| `reviewsCount` still equals the container's value | **yes** | **no** — alters 2 517 records |
| products satisfying `shopping_get_num_reviews >= 12` | **1 676** | **273** (from 1 654) |
| cost | `reviews.json` 2.97 → **17.37 MB** | free |

Clamping loses on both counts that matter. It would be the seed's first
deliberate disagreement with the container on a product field — the thing every
audit round measures as "0 fabricated / 0 mismatched" — and `shopping_get_num_reviews`
is a **live VWA evaluator function** (`visualwebarena-158`, `visualwebarena-165`,
both `required_values: [">= 12"]`), so clamping would shrink the pool of products
able to satisfy it by **83 %**. That is a task-cost regression wearing the
clothes of a consistency fix. The 14.4 MB is the honest price of keeping every
container value intact; `seed-reviews` is a lazily-imported chunk and `/go` is
unaffected (still exactly **123 357 B** — the catalog is not in app state).

**Do not "fix" the residual 36 + 43.** After the backfill, 36 products ship more
bodies than `reviewsCount` and 43 have `reviewsCount == 0` while shipping a body.
This is the **source's own drift**, faithfully reproduced, not a mock defect:

- `review_entity_summary` is a denormalised aggregate Magento recomputes on save,
  and it has drifted in this container.
- It is **not** store scoping: `review ⋈ review_store store_id=1` returns the
  same counts as unscoped (12 / 8 / 10 for products 1492 / 3593 / 89814), while
  the summary rows say 11 / 7 / 9.
- The live source agrees with the mock, not with its own summary. Product 1492
  (`carmel-orthodontic-wax-…-dental-patient-wax`): the PDP prints
  **"11  Reviews"**, and `/review/product/listAjax/id/1492/` renders **10**
  review items with `?p=2` rendering **2** more — **the source says 11 and lists
  12.**
- For the 43, the container has **no `review_entity_summary` row at all** while
  holding 1 approved review; the source's `listAjax` renders that review and the
  PDP shows no "N Reviews" link. The mock does the same.

So the accurate statement is: *the mock is at exact source parity on all 3 011
products with reviews; the source is internally inconsistent on 79 of them and
the mock reproduces that.* Clamping or padding these would move the mock **away**
from the source.

### R6-007 — `webarena-280` is an **upstream task defect**, not a mock gap

**Do not fabricate a product to satisfy it, and do not count it against the
mock's task coverage.**

Its 12th anchor differs from product 40793's container name by whitespace the
annotator normalised. Every recovery route was checked and all are closed:

| route | result |
|---|---|
| a different product whose name equals the anchor | none — whitespace-normalised search over all 112 209 name rows returns only 40793 |
| a different whitespace form in the container | none — store 0 **and** store 1 both hold `13 Mini/ 13 Pro/ 13 Pro Max/ 12` |
| a name the source *renders* differently from what the DB stores | no — the anchor appears **0** times in the source's own 146 256-byte PDP; the spaced form appears 4 times |

`must_include` is a case-insensitive substring test against the agent's answer
string and does **not** normalise whitespace. The anchor therefore appears
nowhere on the source's own rendered page, so an agent browsing the **real
WebArena site** would emit the spaced form and fail the same assertion.
**webarena-280 is unpassable on WebArena itself.** The mock is at exact parity on
the only field involved.

### Anchored-name checks must use substring semantics *and* read `locator`

Two P0-class gaps were found by fixing the *method*, not by looking harder:

1. `visualwebarena-50`'s anchor `Short Sleeve Dry-Fit Workout Shirt - Loppet,
   2-Pack` is a **substring** of the container's own name
   `Craft Women’s Short Sleeve Dry-Fit Workout Shirt - Loppet, 2-Pack`
   (entity 27498). An exact-equality check reports it missing and a naive fix
   invents a product.
2. `visualwebarena-173` names its product **inside a `locator` lambda**
   (`textContent.includes('Jo Malone Grapefruit Cologne Spray for Women, 1 Ounce')`),
   not in `required_contents`. An extractor that reads only
   `must_include`/`exact_match` cannot see it at all. Adding a scan of quoted
   string literals in `locator` raised the VWA denominator 207 → 213 and
   surfaced three genuinely missing products (entities 6977, 43702, 43782).

Both fixes above are real. The number that closed the section — "**259 / 259**"
— was not, and neither was the method behind it. **Round 8 correction:** the
sweep that produced 259 dropped `|OR|` alternation and imposed a **12-character
floor** on what counted as an anchor string, and both filters hid live misses.
`EOS R6` is 6 characters; `Boo Berry` is 9; `Alpha A7 II` is 11; and
`"Count Chocula |OR| COUNT CHOCULA"` kept whole is 32 characters that match no
product on earth. It also read product **names only**, so every anchor that is a
*reviewer's* nickname looked like a missing product and was triaged away.

Six blocked tasks were behind those three filters.

### The anchor sweep — `assets/dumps/anchor_sweep.py` is the procedure, not a number

Re-run it every round. `python3 assets/dumps/anchor_sweep.py --refresh` re-dumps
the container and exits non-zero if any assertion string is untriaged. Its
denominator is defined by six refusals, each of which corresponds to a round
that reported a clean pass and was refuted:

| refusal | the round it cost |
|---|---|
| no length floor — `must_include` is `str.__contains__` and has no length semantics | 7 (`EOS R6`, `Boo Berry`, `Alpha A7 II`) |
| `\|OR\|` split **and** `.strip()` on every branch | 7 (`Count Chocula`) |
| the **whole** `eval` object, walked structure-blind — `string_match`, `url_match`, `program_html`, `page_image_query`, `func:`/`lambda:` locators and their quoted literals | 6 (`visualwebarena-173`'s locator) |
| substring, not equality | 5 (`visualwebarena-50`) |
| every store view | 6 |
| **every surface**, not just names — names, SKU/url-key, review nickname/title/detail, option titles and values, category names, and the order/customer/cart records | 8 (`visualwebarena-67`, `-70`) |

and by one rule it does keep, because the evaluator keeps it: a `|OR|` branch
that misses while a sibling resolves is reported but is **not** a blocked task.

Filtering is the *result*, never the input. Every string that resolves in the
container and not in the seed is printed with its tasks, its slots and its
candidate container entities, and the only way one leaves the list is a person
adding it to `FALSE_POSITIVES` **with a reason** — or the record being seeded.
The sweep re-checks that table and prints any entry that is no longer a miss as
`STALE`, so an allow-list cannot outlive the reason it was written.

**Closing number, round 8:** 671 shopping tasks (192 webarena + 479
visualwebarena) → **3 256 assertion slots**, **1 325 distinct strings**, **706**
resolving on some container surface, **707** on some seed surface, **25**
container-hit/seed-miss, **21** with no resolving sibling, and **0 untriaged**.
The 21 triaged split three ways, all recorded in `FALSE_POSITIVES` with the task
text that establishes each:

- **4 typed inputs** — `La Jolla`, `Urbana`, `15213`, `EmLo`. The task states
  them ("*order it to 3235 Voigt Dr, La Jolla, CA 92093*"); they must be
  **enterable**, and seeding them would be fabrication.
- **16 derived price answers** — `399.99`, `94.99`, `0.14`, … A price the agent
  reads off a page. The container hit is coincidence (`0.14` inside
  `10.14 Ounce`), so a substring sweep can neither confirm nor refute these; the
  captured-listing corpus is what governs them.
- **1 image-read answer** — `toucan` (`visualwebarena-219`). Read off a product
  photo, not off any text field; what the seed owes it is the right tile with the
  right image on `/clothing-shoes-jewelry/men/uniforms-work-safety.html`, which
  is a listing-capture property.

Two by-products of the same walk, both settled: **0** evaluator-named SKUs absent
from the seed, and **43** distinct evaluator `/media` URLs — distinct *URL* after
`|OR|` splitting over both task files, which is the playwright agent's 43 and not
the 42 that rounds 6–7 recorded. A sweep that de-duplicates by SKU collapses the
`B09F3TW5CP.0` / `.1` pairs and lands on 42.

### Task start URLs must be captured, not derived — and 167 of them were not

Closing the anchored-*name* class exposed the class underneath it. Four of the
six blocked tasks do not ask about a name at all; they ask about a **position**:

> `visualwebarena-208` — "What is the name of the monster on that **brown box in
> the bottom row**?", starting on
> `/grocery-gourmet-food/breakfast-foods/cereals.html?p=5`
> `visualwebarena-67` — "…the **second product in the first row**", starting on
> `/beauty-personal-care/hair-care/hair-coloring-products.html`

Seeding the product does nothing for those unless the *page* is the source's
page. `src/utils/catalog.js` serves a captured listing verbatim and derives an
approximation for anything uncaptured, so an uncaptured start URL means the tile
grid an agent is asked about is one the mock invented.

`assets/dumps/task_urls.txt` was derived from `webarena.jsonl` alone, so all 479
visualwebarena shopping tasks contributed **zero** capture targets. And
`capture_listings.py`'s target filter dropped every bare `.html` as "a product
detail page, not a listing", which is only true for slugs that are not
categories — `hair-coloring-products.html` is one.

Both are fixed. `anchor_sweep.py --emit-task-urls` writes
`assets/dumps/task_urls.vwa.txt` (**224** listing-shaped URLs, from `web` and
from the `eval` object, over both files), `capture_listings.py` reads every
`task_urls*.txt` generation, and it now accepts a bare `.html` whose slug is a
category `urlPath`. That found **167 uncaptured task start URLs**, all since
captured from the live source (0 failures) — `src/data/listings.json` 1 387 →
**1 554**.

**Known gap, sized and deferred.** Captured listings name real product ids, and
the seed does not hold all of them. Of the **8 973** ids the captured corpus
references, **5 624** were unseeded. The **1 104** that appear on the 167 newly
captured task start URLs are seeded this round (tier B: real name, price, SKU,
url key, main image, options and reviews; no gallery). The remaining **4 520**
sit on listings no shopping task starts on, and are listed in
`assets/dumps/UNSEEDED_LISTING_IDS.remaining.txt` for whoever closes it (that
file is gitignored like every bulk dump; regenerate it as
`{ids in src/data/listings.json[].productIds} - {ids in src/data/products.json}`,
which is a set operation over the shipped seed and so cannot drift from what is
actually missing). Until then those pages render the seeded subset of the
source's tile set.

### R7-003 — the review-byte defect, and why it was a dump bug rather than five rows

`vwa_backfill.jrows()` split mysql's output with `str.splitlines()`, which breaks
on **U+0085 NEL** and **U+2028 LINE SEPARATOR** as well as `\n`. A review body
containing either was cut into two halves that would not parse as JSON, and
`vwa_merge.jl()`'s continuation path rejoined them with a literal `\n` — same
length, one character silently substituted.

Fixed at the source (`split("\n")`, never `splitlines()`), and repaired over the
**whole** shipped population rather than the five ids the audit happened to find,
by `assets/dumps/fix_review_bytes.py`: 30 154 seeded reviews re-read from the
container, **5 fields** differed (4 `detail`, 1 `nickname`) and were overwritten.
A second run of the same script reports **none** — so the property is
`32 594 / 32 594` byte-identical `title`/`detail`/`nickname`, measured, not
asserted.

### R6-006 — `dbProductCount` is fixed; per-category `position` **cannot** be, and here is the proof

**`dbProductCount`: fixed (round 7).** The seeded value was `COUNT(*)` over
`catalog_category_product`, which counts rows the storefront never renders.
Magento's listing collection reads the category index and inner-joins the
**price index**; that join is the entire difference. Re-derived by
`assets/dumps/vwa_catcounts.py`:

```sql
SELECT i.category_id, COUNT(DISTINCT i.product_id)
FROM catalog_category_product_index_store1 i
JOIN catalog_product_index_price p
  ON p.entity_id = i.product_id AND p.customer_group_id = 0 AND p.website_id = 1
GROUP BY i.category_id;
```

Verified against the **live source's own rendered toolbar count on all 301
seeded categories**: **301 / 301 exact**, up from **12 / 301**. (`visibility IN
(2,4)` changes nothing — the index is already visibility-scoped, so the price
join is the operative filter.)

**Per-category `position`: do not implement the recommended fix.** AUDIT R6-006
proposes emitting `{categoryId: position}` per product from
`catalog_category_product.position`. That column does not hold what the fix
assumes, in this container:

| measurement | result |
|---|---|
| `catalog_category_product` rows for category 85 | 103 rows, **1 distinct position**, min = max = **2** |
| same for category 60 | 650 rows, **1 distinct position**, min = max = **2** |
| `catalog_category_product_index_store1.position` for 85 / 60 | identical — also a single value |
| what the column actually encodes | the **depth ordinal of the category in the product's own chain** — product 18312 is `2:0, 13:1, 61:2, 226:3`; product 27498 is `2:0, 5:1, 27:2, 143:3` |

Every product in a category ties, so a `position` sort carries **zero ordering
information**. Shipping the map would add ~0.31 MB to the bundle and change
nothing; wiring `sortProducts()` to it would produce today's order via a longer
path.

Nor is the source's rendered order derivable some other way. For
`electronics/headphones/on-ear-headphones` (`?product_list_order=position`), the
source's page 1 matches **none** of the plausible rules:

| candidate ordering | matches source page 1 | SKUs in common |
|---|---|---|
| `entity_id ASC` | no | 5 / 12 |
| `entity_id DESC` | no | 0 / 12 |
| `created_at ASC` / `DESC` | no | 5 / 12 · 0 / 12 |
| `sku ASC` | no | 4 / 12 |
| `updated_at DESC` | no | 0 / 12 |
| no `ORDER BY` (raw index order) | no | 5 / 12 |

With the sort key a total tie, the source's order is an artefact of MySQL's query
plan, not of any stored value — it is **not reproducible from the database at
all**. The only faithful route for a Position-sorted category page is to
**capture it**, which is exactly what round 6 did for the anchored pages
(`listings.json` 1 383 → 1 387). Treat "derived category ordering differs from
the source on uncaptured pages" as a **declared, structural gap**, not a bug with
a pending fix, and close individual pages by capturing them when a task needs
one.
