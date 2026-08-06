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

6. **Product images were not copied out of the container.** `products.json`
   carries the real path suffixes; `assets/data_model.md` §13 describes the two
   offline options. Nothing has been decided or done yet — this is open work for
   the dev agent.

7. **Rating percentages vs. seeded review counts can disagree.**
   `ratingSummary` / `reviewsCount` come from `review_entity_summary` (computed
   over all 308 939 source reviews). For the products where I kept only 12 of a
   larger set, the star percentage will not equal the average of the 12 seeded
   reviews. I kept the source summary values because that is what the tiles and
   the PDP header print.

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
