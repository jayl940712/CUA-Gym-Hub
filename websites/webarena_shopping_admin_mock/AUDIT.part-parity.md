# AUDIT.part-parity — webarena_shopping_admin_mock

> Dimension: **MIGRATION PARITY** (routes · seed integrity · no-network/no-auth ·
> visible strings · task coverage)
> Round: **3** · Date: 2026-08-06 · Audited by: audit agent (parity shard)
>
> Sibling shards cover dead handlers (`AUDIT.part-handlers.md`) and the data
> pipeline (`AUDIT.part-pipeline.md`). Findings are numbered `PARITY-NNN`;
> round-1/2 ids are retained for anything not genuinely fixed.

## Counts

**P0 = 1 · P1 = 4 · P2 = 4 · total 9**

- P0: **PARITY-019** (11 bare source paths 404)
- P1: **PARITY-018**, **PARITY-020**, **PARITY-021**, **PARITY-022**
- P2: **PARITY-013** (carried, still unfixed), **PARITY-023**, **PARITY-024**, **PARITY-025**

**Seed integrity is CLEAN.** No `src/data/*.json` file was modified in round 3
(newest seed mtime 21:45; the round-3 edits all start at 22:2x). The three
count/total fixes were checked individually against the live MySQL DB and none
of them fabricated, deleted or reshaped a row.

---

## How this round was verified

Docker reachable; every seed claim below checked read-only against
`docker exec shopping_admin mysql -u magentouser -pMyPassword magentodb`.

- All **237** `ROUTE_TABLE` paths extracted from `src/App.jsx`, concretised, and
  loaded in headless chromium against `vite preview` on :5203 with `?sid=auditp3`
  — **235 distinct URLs, 0 external requests, 0 responses ≥400, 0 page errors.**
- **67 `document.title` values** diffed against the `<title>` of the matching
  capture in `assets/html/`.
- **Differential report testing** against the live source at
  `http://localhost:7780/admin`, logged in, read-only: 19 report/grid pages
  rendered on both sides from the *same* URL and diffed cell by cell.
- **Non-determinism control**: every source page whose rows differed was re-loaded
  3× to separate a mock defect from an unstable source query. This retracts two
  candidate findings (see §2.6) and is why PARITY-016 and PARITY-015 close.
- Magento's own collection classes read out of the container
  (`vendor/magento/module-reports/Model/ResourceModel/Review/Product/Collection.php`)
  to establish what the source actually computes.

**Second-pass re-verification.** The report below was re-checked end to end by a
second run before being finalised. Independently reproduced, not taken on trust:
PARITY-008 (`Reviews.jsx:558` `label: 'Rating'`; live header `ID · Rating · Sort
Order · Is Active`), PARITY-009 including both stragglers found again from
scratch (`/admin/search/term/` → `Search Terms / Magento Admin`;
`system_design_theme` → `Themes / Design / Content / …` vs the capture's `Design
/ Content / …`), PARITY-013 (still unfixed, `OrderView.jsx:153-273`),
PARITY-016 (`reportUtils.js:304`), PARITY-017 (`file(1)` → UTF-8 text),
PARITY-019 (bare paths, logged-in browser check above), PARITY-021
(`show_actual_columns` written at `SalesReports.jsx:47`, read by no column
builder), PARITY-025 (`ROUTES.md` row numbers 31/33/35/38 each duplicated), the
Product-Attributes seed check (81 seed rows vs 81 `eav_attribute` rows;
`is_visible=0` returns exactly the 15 pinned codes; 66 both sides), the
`web/unsecure/base_url` seed value (`http://10.186.197.203:7780/`, matching
`core_config_data` config_id 2 verbatim), and the no-network / no-auth greps.

---

# TASK 1 — Round-2 disposition table

| Finding | R2 priority | Status now | Evidence |
|---|---|---|---|
| **PARITY-008** Ratings column "Rating Name" | P1 | ✅ **FIXED** | `src/pages/reviews/Reviews.jsx:558` is now `label: 'Rating'`, with the source citation at `:555-556`. Live `/admin/review/rating/` renders `ID · Rating · Sort Order · Is Active` and `4 records found`. Matches `assets/html/review-rating.html`. |
| **PARITY-009** `document.title` drops the menu path | P1 | ✅ **FIXED** (2 stragglers → PARITY-018) | `src/components/layout/PageShell.jsx:26-29` now composes `[pageTitle, ...menuTitlePath(pathname, pageTitle), 'Magento Admin']`; `menuTitlePath` at `src/components/layout/adminMenu.js:358-369`. **60 of 67** titles are now byte-identical to the source capture, including the three the round-2 report called out (`Orders / Operations / Sales / Magento Admin`, `Customers / Customers / Magento Admin`, `Ratings / Attributes / Stores / Magento Admin`) and `#000000299 / Orders / Operations / Sales / Magento Admin`. Five of the seven remaining "mismatches" were my probe using the `/index` alias; the two genuine ones are PARITY-018. |
| **PARITY-013** Order-view button order + `#back` target | P2 | ❌ **NOT FIXED** | `src/pages/sales/OrderView.jsx` id order unchanged: `back`(153) · `guest_to_customer`(164) · cancel(174) · `send_notification`(188) · unhold/hold(198/208) · `order_invoice`(222) · `order_creditmemo`(234) · `order_ship`(246) · `order_reorder`(257) · `order_edit`(267). Re-derived the source order myself from all four captures (`assets/html/sales-order-view-{299,302,304,308}.html`, ids `sales-order-ready-for-pickup-*-button`): `Back · Login as Customer · **Edit** · Cancel · Send Email · Hold · Invoice · Ship · Reorder`. Edit is 3rd on the source, last in the mock. `#back` at `:157` still navigates to `/admin/sales/order/`. Carried below. |
| **PARITY-015** Customer grid sort glyph | P2 | ✅ **RESOLVED — not reproducible** | Live source `/admin/customer/index/` renders `th.data-grid-th _sortable _draggable **_ascend**` on `Name`; the mock renders `data-grid-th col-name _sortable **_ascend**`. Same direction glyph, same A→Z data. The round-1 reference screenshot that showed a descend glyph was stale. **Close this; no work needed.** |
| **PARITY-016** Bestsellers picks top-5 by quantity, not `rating_pos <= 5` | P1 | ✅ **FIXED** | `src/components/reports/reportUtils.js:304` — `main.filter(r => Number(r.rating_pos) <= limit && inRange(...))`, with the boundary-select path correctly left alone (`:283-299`) and the rationale documented at `:160-184`. Differential check, `period=year 1/1/2022–12/31/2022`, same URL both sides: **identical**, `Total 20`, `Quest Lumaflex™ Band $19.00 5 · Sprite Stasis Ball 55 cm $23.00 4 · Sprite Stasis Ball 65 cm $27.00 4 · Cruise Dual Analog Watch $55.00 4 · Affirm Water Bottle $7.00 3`. |
| **PARITY-017** literal NUL byte in `reportUtils.js` | P2 | ✅ **FIXED** | `file(1)` now reports `JavaScript source, Unicode text, UTF-8 text`; byte scan returns **0** NUL bytes; `grep` finds 356 matches in the file without `-a`. |

**Round-2 clearance: 4 fixed, 1 resolved-as-not-a-defect, 1 (P2) untouched. No round-2 finding regressed.**

---

# TASK 2 — Fresh sweep (round 3)

## 2.1 Route parity

| Check | Result |
|---|---|
| `ROUTE_TABLE` size | 237 rows, unchanged from round 2 |
| **Duplicate / shadowed paths** | ✅ none — `grep -oP "path: '\K[^']+" src/App.jsx \| sort \| uniq -d` is empty. Matters because `src/App.jsx` keys rows by `r.path`. |
| **Rows missing a `component`** | ✅ none — every row supplies one; the `<AreaPage/>` fallback is still dead code |
| **Cold deep-load** | ✅ 235/235 distinct URLs rendered from a cold load; 0 page errors, 0 responses ≥400 |
| **New Add-New/Edit form routes render a real form, not the grid** | ✅ **all confirmed** (see table below) |
| **`[x]` honesty in `ROUTES.md`** | ✅ 137 `[x]`, 2 `[~]` (rows 28/29, order placement — accurate); but the *prose* of the secondary-paths section is now stale → PARITY-023 |
| **Bare source paths** | ❌ **11 paths that answer 200 on the source render `404 Error` in the mock** → PARITY-019 |
| **Build** | ✅ `npm run build` clean, 158 modules |

New/edit form routes verified live (h1 · `document.title` · a real `<form>`/`<fieldset>` present · grid absent):

| Route | h1 | Renders |
|---|---|---|
| `/admin/catalog/product_attribute/new/` | New Product Attribute | form, 11 inputs ✅ |
| `/admin/catalog/product_set/add/` | New Attribute Set | form ✅ |
| `/admin/catalog_rule/promo_catalog/new/` | New Catalog Price Rule | form, 9 inputs ✅ |
| `/admin/review/rating/new/` | New Rating | form, 6 inputs ✅ |
| `/admin/admin/system_config/edit/section/general/` · `/section/currency/` | Configuration | form, 30 / 21 inputs, section-specific ✅ |
| `/admin/checkout/agreement/new/` · `/admin/admin/system_variable/new/` · `/admin/newsletter/template/new/` · `/admin/admin/integration/new/` · `/admin/admin/sitemap/new/` · `/admin/admin/email_template/new/` · `/admin/sales/order_status/{new,assign}/` · `/admin/tax/{rate/add,rule/new}/` · `/admin/admin/user/new/` · `/admin/customer/index/new/` · `/admin/catalog/product/new/` | (each its own) | all real forms ✅ |

h1 spot-checks against the live source all match, including the non-obvious ones:
`/admin/admin/system_store/newWebsite/` → `Stores` (both), `/admin/admin/widget_instance/new/` → `Widgets` (both),
`/admin/catalog/category/add/` → `Default Category (ID: 2)` (both).

`/admin/sales/order_creditmemo/{start,new}/order_id/299/` rendering `404 Error` is
**correct** — `assets/html/sales-order-creditmemo-new-299.html` is itself the
source's 404 (`We can't create credit memo for the order. 404 Error Page not
found.`). Not a finding. (The mock omits that message banner; too minor to file.)

## 2.2 Seed integrity — CLEAN, no fabrication

**No seed file was written in round 3.** `find src/data -newermt "2026-08-05 22:20"` is
empty; the newest is `stockReservations.json` at 21:45. Every round-3 fix was made in
render/compute code, which is the right place. Each was still verified against the DB:

| Round-3 fix | What dev did | Independent DB check | Verdict |
|---|---|---|---|
| **Product Attributes 15 phantom rows** | `src/pages/catalog/ProductAttributes.jsx:38-42` adds `GRID_HIDDEN_ATTRIBUTE_CODES` (15 codes) and filters at `:102` | `SELECT a.attribute_code FROM eav_attribute a JOIN catalog_eav_attribute c ON c.attribute_id=a.attribute_id WHERE a.entity_type_id=4 AND c.is_visible=0` returns **exactly those 15 codes, verbatim**: `created_at, custom_layout_update, has_options, image_label, links_exist, links_purchased_separately, links_title, minimal_price, old_id, required_options, samples_title, small_image_label, thumbnail_label, updated_at, url_path`. `is_visible=1` count = **66**. Source grid: `66 records found`. Mock grid: `66 records found`. | ✅ **legitimate** — reproduces `addVisibleFilter()`. The seed still carries **all 81** attributes (81 in `src/data/productAttributes.json` = 81 in `eav_attribute` for `catalog_product`); nothing was deleted to make the count match. |
| **Bestsellers row selection** | `reportUtils.js:304` filters on `rating_pos` | `rating_pos` is a real stored column in `sales_bestsellers_aggregated_{daily,monthly,yearly}`; it was already in the seed and previously unused | ✅ **legitimate** — no new data |
| **Dashboard bestsellers tie-break** | deterministic ordering in `src/pages/Dashboard.jsx` | source re-loaded 3×: run 0 = `Sprite Stasis Ball 65 / Quest / Sprite Yoga Strap 6`, runs 1–2 = `Quest / Sprite Yoga Strap 6 / Sprite Stasis Ball 65`. **The source is non-deterministic**; totals and membership identical on both sides | ✅ **legitimate** — see §2.6 |

Invented-literal grep still clean: no `faker`, no `Math.random()` in data construction,
no `Lorem`, no `User 1`/`Item 2` sequences.

Row counts and identifiers re-spot-checked against the DB: orders **308**, customers
**70**, reviews **351**, products **2040**, attributes **81**, attribute sets **8**,
ratings **4** — all exact.

## 2.3 No network / no auth — CLEAN

| Check | Result |
|---|---|
| Runtime requests over 235 page loads | ✅ **0 external**, **0 responses ≥400**, **0 page errors** |
| `fetch(` sites | ✅ 4, all mock endpoints — `src/utils/dataManager.js:90,109` (`/state?sid=`), `:351,364` (`/post?sid=`) |
| `XMLHttpRequest` / `axios` / `sendBeacon` / dynamic `import()` | ✅ none |
| External URLs in `src/` + `index.html` | ✅ 7 hits, all inert: 4 verbatim cookie-help links inside the `cms_page` seed body (`src/data/cmsPages.json:59`), the real `web/unsecure/base_url` config row (`src/data/coreConfig.json:238`), the source's own magento.com splash `<a>` (`src/pages/reports/LegacyReports.jsx:764`), and **`http://localhost:7780/admin` in a doc comment** at `src/components/system/RecordForm.jsx:19` — confirmed absent from `dist/assets/*.js`, so it is not a subresource. |
| Auth gates | ✅ none — no `isAuthenticated` / `requireAuth` / `ProtectedRoute` / login redirect anywhere in `src/` |
| `sid`-stripping navigation | ✅ every bare `<Navigate>` (`src/App.jsx:105,116`, `src/pages/content/CmsPages.jsx:404`, `src/pages/customers/CustomerSave.jsx:12`, `src/pages/catalog/ProductSave.jsx:16`) appends `location.search`. Only internal `href="/"` is the favicon in `index.html`. |

## 2.4 Visible-string parity

67 `document.title` values diffed against `assets/html/*.html`: **60 exact, 2 genuine
mismatches** (PARITY-018), 5 false positives from probing the `/index` alias.

Grid headers verified live against the captures — all exact:

| Route | Rendered | |
|---|---|---|
| `/admin/catalog/product_attribute/` | `Attribute Code · Default Label · Required · System · Visible · Scope · Searchable · Use in Layered Navigation · Comparable` + `66 records found` | ✅ |
| `/admin/review/rating/` | `ID · Rating · Sort Order · Is Active` + `4 records found` | ✅ |
| `/admin/catalog/product_set/` | `Set` + `8 records found` | ✅ |
| `/admin/customer/index/` | `Options · Name · Email · Group · Phone · ZIP · Country · State/Province · Customer Since` | ✅ |
| Orders / Invoiced / Shipping / Refunded / Coupons / Ordered-Products reports | full column set + every row | ✅ byte-identical |

Report content diffed cell-by-cell against the live source from the same URL:

| Report | Result |
|---|---|
| Invoiced 2022 · Shipping 2022 · Refunded 2022 · Coupons 2022 · Ordered Products 2022 · Products in Carts | ✅ **byte-identical** |
| Bestsellers 2022 (year) | ✅ **byte-identical** incl. rank 5 |
| Bestsellers Q1-2022 / 2023 / Jan-2023 | ✅ totals and all task-relevant ranks match; residual row permutation is source non-determinism (§2.6) |
| Orders Report 2022 (monthly) | ✅ all 13 rows + totals identical **in the 10 default columns**; ❌ the 7 "actual value" columns are missing → PARITY-021 |
| Tax Report 2022 | ⚠️ one cell → PARITY-024 |
| Product Reviews Report | ❌ every `Average` / `Average (Approved)` value is wrong → PARITY-020 |
| Search Terms Report | ❌ Store cell renders as run-on text → PARITY-022 |

## 2.5 Task coverage (`assets/TASKS.md`, 184 tasks)

**No task is blocked.** None of the 11 bare paths in PARITY-019 is named by a task,
and no task reads the Product Reviews Report averages (the closest, webarena-112–116,
read individual review star ratings, which are correct).

Bestseller answers re-verified end to end against the live source this round:

| Task | Expected | Mock |
|---|---|---|
| webarena-0 | Quest Lumaflex™ Band | ✅ |
| webarena-3 | Quest Lumaflex™ Band + a Stasis Ball | ✅ (`Sprite Stasis Ball 55 cm`) |
| webarena-4 | Impulse Duffle, Overnight Duffle, Hawkeye Yoga Short-32-Blue | ✅ all three, top-3 |
| webarena-6 | Sprite Yoga Strap 6 foot + Overnight Duffle/Ida Workout Parachute Pant-29-Purple | ✅ ranks 1–3 |

## 2.6 Retracted — the source is non-deterministic, the mock is not wrong

Three row-ordering differences looked like defects and are not. Each source URL was
re-loaded 3× back-to-back:

- **Dashboard "Bestsellers" tile** — 2 distinct orderings across 3 runs (the three
  qty-6 products permute).
- **Bestsellers Report, 2023/year** — 3 distinct rank-4/5 pairs across 3 runs
  (`Layla Tee-XS-Green + Hawkeye Yoga Short-36-Gray`, `Angel Light Running
  Short-29-Purple + Layla Tee`, `Hawkeye Yoga Short-32-Blue + Sprite Stasis Ball
  65 cm`). All at `qty_ordered = 2`.
- **Product Reviews Report** — 3 distinct page-1 orderings across 3 runs.

Magento orders these by `qty_ordered DESC` / `review_cnt DESC` with no tie-break
column, so MySQL returns an arbitrary permutation. The mock's deterministic
`product_id ASC` tie-break is the correct call and **must be kept**. Totals and row
membership above the tie boundary agree on both sides in every case.

---

# P0

### PARITY-019 · Eleven bare source paths return 200 on the source and `404 Error` in the mock — NEW

- **File**: `src/App.jsx` `ROUTE_TABLE` — each of these has an `/index` row but no bare row
- **What the source does**: Magento's front controller defaults a missing action to
  `index`, so `/admin/<front>/<controller>/` is a live URL for every controller. All
  eleven were loaded on `http://localhost:7780` while logged in and returned **200**
  with a real page:

  | Source path | Source h1 | Mock |
  |---|---|---|
  | `/admin/customer/` | Customers | `404 Error` |
  | `/admin/review/product/` | Reviews | `404 Error` |
  | `/admin/search/synonyms/` | Search Synonyms | `404 Error` |
  | `/admin/media_gallery/media/` | Manage Gallery | `404 Error` |
  | `/admin/inventory/source/` | Manage Sources | `404 Error` |
  | `/admin/admin/url_rewrite/` | URL Rewrites | `404 Error` |
  | `/admin/admin/system_account/` | My Account | `404 Error` |
  | `/admin/loginascustomer_log/log/` | Login as Customer Log | `404 Error` |
  | `/admin/bulk/` | Bulk Actions Log | `404 Error` |
  | `/admin/marketplace/` | Magento Marketplace | `404 Error` |
  | `/admin/inventory/stock/` | Manage Stock | `404 Error` |

  Re-confirmed independently at the end of round 3 by logging a headless browser
  into `http://localhost:7780/admin` and loading each path: `/admin/customer/`
  → `Customers / Customers / Magento Admin`, h1 `Customers` (byte-identical to
  `/admin/customer/index/`); `/admin/review/product/` → h1 `Reviews`;
  `/admin/bulk/` → h1 `Bulk Actions Log`; `/admin/inventory/stock/` → h1
  `Manage Stock`. All four render `404 Error` in the mock. (A plain `curl`
  check is useless here — the source answers 200 with the login form for every
  path, including nonexistent ones, so this must be done with a logged-in
  session.)

- **Why P0**: this is exactly the "source path unreachable in the mock" case. It is
  also *inconsistent* — `/admin/search/term`, `/admin/sales/order` and
  `/admin/sales/creditmemo` all have bare rows, so an agent that generalises from
  those to `/admin/customer/` lands on a 404. No `assets/TASKS.md` task names one of
  these URLs today, which is the only thing keeping the blast radius small.
- **Fix**: for each of the 11, add a `ROUTE_TABLE` row with the bare path pointing at
  the same component as the existing `/index` row (mirroring how
  `src/App.jsx:176-177` already pairs `/admin/sales/creditmemo` with
  `/admin/sales/creditmemo/index`). Then re-run the `/index`-without-bare check —
  `python3 -c "…"` over the extracted paths — and keep it at zero.

---

# P1

### PARITY-018 · Two residual `document.title` menu-path misses — NEW (tail of PARITY-009)

- **File**: `src/components/layout/adminMenu.js:97` and `:136`
- **`/admin/search/term/`** (the bare path an agent types, and the path the source's
  own menu resolves to) → mock `Search Terms / Magento Admin`; source
  `Search Terms / SEO & Search / Marketing / Magento Admin`. The `/index` alias is
  correct, so this is purely the `match:` array at `adminMenu.js:97` listing
  `/admin/search/term/index`, `…/edit`, `…/new` but not `/admin/search/term` itself.
  Same class of miss on `/admin/inventory/source/new/` and
  `/admin/inventory/stock/new/`, which render `Manage Sources / Magento Admin`
  instead of `… / Inventory / Stores / Magento Admin`.
- **`/admin/admin/system_design_theme/`** → mock
  `Themes / Design / Content / Magento Admin`; source `Design / Content / Magento
  Admin`. The source's `<h1>` *is* `Themes` (both sides agree) but its `<title>` does
  **not** prepend the page title for this route. Confirmed live and in
  `assets/html/system-design-theme.html`.
- **Fix**: (a) add the bare `/admin/search/term` and the inventory `new`/`edit`
  prefixes to the relevant `match:` arrays; (b) give the Themes menu item an explicit
  `titlePath`/override so `PageShell` emits `Design / Content / Magento Admin`.
  Cross-check the result against all 95 `<title>`s in `assets/html/` — the sweep that
  found these two is a ~20-line script and should be kept.

### PARITY-020 · Product Reviews Report recomputes averages instead of reading the aggregate — NEW

- **File**: `src/pages/reports/LegacyReports.jsx:572-573` and `:582-586`
- **What the source does**: `Magento\Reports\Model\ResourceModel\Review\Product\Collection::_joinReview()`
  (read out of the container at
  `vendor/magento/module-reports/Model/ResourceModel/Review/Product/Collection.php`)
  joins **`rating_option_vote_aggregated`** and computes
  `avg_rating = SUM(table_rating.percent)/COUNT(table_rating.rating_id)` and
  `avg_rating_approved = SUM(percent_approved)/COUNT(rating_id)`. `percent` is stored
  **already rounded to an integer**.
- **What the mock does**: averages the raw per-review percents
  (`r.ratings.reduce(…)/r.ratings.length`, `:572-573`), then averages those
  (`:582`), producing unrounded values.
- **Evidence** — same page, same row, both sides:

  ```
  product           source                mock
  4  Wayfarer …     67.0000 / 67.0000     66.6667 / 66.6667
  737 Caesar …      47.0000 / 47.0000     46.6667 / 46.6667
  414 Montana …     53.0000 / 53.0000     53.3333 / 53.3333
  ```

  DB confirms the source's numbers are stored, not derived:
  `rating_option_vote_aggregated` → `entity_pk_value=4 → percent 67`,
  `737 → 47`, `1396 → percent 60, percent_approved 0` (matching the source's
  `1396 Olivia 1/4 Zip Light Jacket · 3 · 60.0000 · 0.0000`).
- **Impact**: every `Average` and `Average (Approved)` cell on a P0-priority report is
  wrong by a fraction. No task reads them today, which keeps this P1.
- **Fix**: the correct values are **already in the seed** —
  `src/data/reviewSummaries.json` carries `rating_summary` per
  `(entity_pk_value, store_id)` with exactly the source's integers (`3 → 67`,
  `4 → 67`, `6 → 67`, `414 → 53`, `737 → 47`). Read `rating_summary` for
  `store_id > 0` instead of averaging. `percent_approved` has no seed column yet —
  extract the 254 rows of `rating_option_vote_aggregated` into a small
  `ratingVoteAggregates.json` (it is ~10 KB) and read both columns from it, which
  also makes the mock structurally match Magento.

### PARITY-021 · "Show Actual Values" is rendered but not honored — the 7 actual columns never appear — NEW

- **File**: `src/components/reports/ReportPage.jsx:214-219` renders the control;
  `src/pages/reports/SalesReports.jsx:47` defaults it to `'0'`; nothing consumes it.
- **What the source does**: with `show_actual_columns=1` the Orders Report renders
  **17** columns —
  `Interval · Orders · Sales Items · **Items** · Sales Total · **Revenue** · **Profit** · Invoiced · **Paid** · Refunded · Sales Tax · **Tax** · Sales Shipping · **Shipping** · Sales Discount · **Discount** · Canceled`.
- **What the mock does**: always renders the 10 default columns, whatever the value.
  Verified with the identical base64 `/filter/` URL on both sides — the 13 monthly
  rows and the totals row agree cell-for-cell in the 10 shared columns, so only the
  paired "actual" columns are missing.
- **Impact**: a documented query param that the source's own UI emits is ignored, and
  the control is a dead affordance. Applies to every sales report that offers it.
- **Fix**: thread `show_actual_columns` from the decoded filter into the column set of
  `SalesReports.jsx`; when `'1'`, insert the seven paired columns after their
  aggregate twin, in the source's order above. The underlying numbers are already
  computed (the source's actual columns are `$0.00`/`0` for this dataset except
  `Items 1`, `Profit -$7.64`, `Paid $39.64`, `Tax $0.00`).

### PARITY-022 · Search Terms Report Store cell renders as one run-on string — NEW

- **File**: `src/pages/marketing/Marketing.jsx:522` (`<div className="store-view-cell">`
  with `<span>` children) and `src/components/reviews/legacyGrid.css:125`, which
  scopes `.store-view-cell { display: block }` to `#reviewGrid` only — so on the
  Search Terms Report grid the spans stay inline.
- **Source markup** (live, `/admin/search/term/report/`):
  `Main Website<br>&nbsp;&nbsp;&nbsp;Main Website Store<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Default Store View<br>`
  → renders and reads as three indented lines.
- **Mock markup**: `<span>Main Website</span><span>Main Website Store</span><span>Default Store View</span>`
  → `innerText` is `Main WebsiteMain Website StoreDefault Store View`, with no
  separator at all. That is what an agent consuming the accessibility tree sees.
- **Fix**: either make the rule global (`.store-view-cell span { display: block }`) or
  emit the source's `<br>` + `&nbsp;` indentation verbatim. Then re-check every grid
  with a Store/Purchase Point column, not just this one.

---

# P2

### PARITY-013 · Order-view action buttons in the wrong order; "Back" targets a different URL

*(carried from round 1 and round 2 — still not fixed; see the disposition table for
re-verified evidence)*

- **File**: `src/pages/sales/OrderView.jsx:145-280`
- **Source order** (identical across all four captures):
  `Back · Login as Customer · Edit · Cancel · Send Email · Hold · Invoice · Ship · Reorder`
- **Fix**: move the `#order_edit` block (`:267-280`) to immediately after
  `#guest_to_customer` (`:162-172`); point `#back` (`:157`) at
  `/admin/sales/order/index/order_id/${id}/`, which `src/App.jsx:141` already routes.
  All ids, labels and `title=` attributes are otherwise exact — this is a two-line move.

### PARITY-023 · `ROUTES.md` "Secondary create/edit paths" table now understates the mock — NEW

- **File**: `ROUTES.md:325-350`
- The section is headed *"Resolved to the area's own index page at the source URL —
  the editor behind them is out of scope"*, but round 3 implemented real forms behind
  ~10 of those rows. The doc and the code now disagree in the direction that makes the
  mock look worse than it is, and the next dev round will read one or the other:

  | `ROUTES.md` claims renders | Actually renders (verified live) |
  |---|---|
  | `/admin/catalog_rule/promo_catalog/new/` → "Catalog Price Rule" | `New Catalog Price Rule` form |
  | `/admin/review/rating/new/` → "Ratings" | `New Rating` form |
  | `/admin/search/synonyms/new/` → "Search Synonyms" | `New Synonym Group` form |
  | `/admin/checkout/agreement/new/` → "Terms and Conditions" | `New Condition` form |
  | `/admin/newsletter/template/new/` → "Newsletter Templates" | `New Template` form |
  | `/admin/admin/system_variable/new/` → "Custom Variables" | `New Custom Variable` form |
  | `/admin/admin/integration/new/` → "Integrations" | `New Integration` form |
  | `/admin/admin/sitemap/new/` → "Site Map" | `New Site Map` form |
  | `/admin/admin/email_template/new/` → "Email Templates" | `New Template` form |
  | `/admin/admin/system_design/new/` → "Store Design Schedule" | `New Store Design Change` form |

  The `/admin/inventory/{source,stock}/{new,edit…}` rows **are** still accurate — those
  do render the grid.
- **Fix**: move the ten rows above into the "Implemented as real, state-writing forms"
  table directly above them and name what each writes.

### PARITY-024 · Tax Report totals row shows an Orders count where the source leaves it blank — NEW

- **File**: the tax report totals row builder (rendered by
  `src/components/reports/ReportPage.jsx`; the totals cell is `col-orders_count`)
- **Source** (live, `/admin/reports/report_sales/tax/`, monthly 2022):
  `<tr class="totals">` → `Total | (blank) | (blank) | (blank) | $2.64` — Magento's tax
  grid deliberately emits an empty `th.col-qty.col-orders_count`.
- **Mock**: `<th class="col-orders_count col-number">1</th>` → `Total | | | 1 | $2.64`.
- The data row (`4/2022 · US-MI-*-Rate 1 · 8.25 · 1 · $2.64`) and the tax total are
  both correct; this is one cell in the footer.
- **Fix**: suppress the orders-count total on the tax report only.

### PARITY-025 · Duplicate row numbers in `ROUTES.md` — NEW

- **File**: `ROUTES.md:60-61` (two rows numbered 31), `:63-64` (33), `:66-67` (35),
  `:70-72` (three rows numbered 38)
- Rows appended in earlier fix rounds reused the number of the row above them, so
  "row 38" now refers to three different source paths and the `row:` back-references in
  `src/App.jsx` are ambiguous. No route is broken — this is purely a doc-integrity
  hazard for the next agent that cites a row number.
- **Fix**: renumber the appended rows and update the `row:` fields in `src/App.jsx`
  that point at them.

---

## Migration Parity Status

| Check | Status | Notes |
|---|---|---|
| Route coverage (`ROUTES.md`) | ✅ | 237 `ROUTE_TABLE` rows; every documented source path resolves |
| Route coverage (source URL sweep) | ❌ | **11 bare `/admin/<front>/<controller>/` paths 404** (PARITY-019) |
| Duplicate / shadowed routes | ✅ | 0 duplicates across 237 rows |
| `[x]` rows rendering `<AreaPage>` | ✅ | none; fallback still dead code |
| New Add-New/Edit forms render a real form | ✅ | all 20 probed render a form, not the grid |
| Path/param fidelity | ✅ | source paths verbatim; `/key/<hash>/` accepted and stripped |
| Query params drive behavior | ⚠️ | `filters[*]`, `paging[*]`, `sorting[*]`, `?search=` and the base64 `/filter/` codec all honored; `show_actual_columns` is not (PARITY-021) |
| Deep links render cold | ✅ | 235/235 |
| `sid` survives navigation | ✅ | every `<Navigate>` appends `location.search` |
| Seed uses real identifiers | ✅ | 308 / 70 / 351 / 2040 / 81 / 8 / 4 — all exact vs DB |
| Round-3 count fixes fabricate data | ✅ | **no** — no seed file written; the 15 hidden codes match `is_visible=0` verbatim |
| Report computations | ⚠️ | 7 reports byte-identical; Bestsellers now correct; Product Reviews averages wrong (PARITY-020) |
| Zero external network calls | ✅ | 0 external requests over 235 page loads; 0 responses ≥400 |
| No auth gates | ✅ | none in `src/` |
| Visible-string fidelity | ⚠️ | 67 title checks (60 exact, 2 real misses) + ~25 header/report checks (2 misses) |
| Task coverage | ✅ | 0 of 184 tasks blocked |

## Out-of-dimension observations

*(one line each — do not double-report)*

- `handlers`: the source's legacy report grids (Search Terms Report, Low Stock,
  Product Reviews, Customer Reviews) each render an **inline filter row** as the
  second `<tr>`; the mock's equivalents have none.
- `handlers`: `ROUTES.md` rows 28/29 remain honestly `[~]` — order placement in
  `src/pages/sales/OrderCreate.jsx` is still not wired.
- `pipeline`: `src/pages/catalog/ProductAttributes.jsx:13-18` still asks whoever owns
  `dataManager.js` to declare `productAttributeOverrides` in `createInitialData()` /
  `SCHEMA.md`.
