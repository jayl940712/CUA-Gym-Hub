# webarena_shopping_admin_mock — TODO

> Status: **READY FOR DEV**
> Source: `http://localhost:7780/admin` · image `shopping_admin_final_0719` · container `shopping_admin`
> Recon: `SOURCE.md` | Routes: `ROUTES.md` | Design: `DESIGN.md` | Data: `assets/data_model.md`
> Requirements spec: `assets/TASKS.md` (184 WebArena tasks)
> Recon mode: **FULL** (docker + DB + HTTP + CSS)

## Status Legend
- `[ ]` Not started · `[~]` In progress · `[x]` Done

Counts (checkbox lines in this file, recounted round 5 — the old
`P0 44 · P1 27 · P2 18` line was a planning estimate, not a count of what is
written here):

| Section | Items | `[x]` | `[~]` | `[ ]` |
|---|---|---|---|---|
| P0 — Shell, Routing, Data Pipeline | 14 | 13 | 1 | 0 |
| P1 — Sales / Catalog / Customers / Marketing / Content / Reports | 45 | 44 | 1 | 0 |
| P2 — Depth & Realism | 20 | 20 | 0 | 0 |
| Data Seed | 16 | 16 | 0 | 0 |
| **Total** | **95** | **93** | **2** | **0** |

> **Round-5 honesty audit.** Every previously-unchecked box was checked against
> the files on disk *and* against the running app in a real browser before being
> ticked; the evidence is written into each line. Nothing is ticked on the
> strength of another agent's report. One item is `[~]` and is the honest
> remaining work: the legacy-grid generalisation (P0), which **landed in round 6** as
> `src/components/reports/LegacyGrid.jsx` and is applied to Low Stock, Search Terms
> Report and Abandoned Carts; it stays `[~]` only because Order Status and the three
> splat routes live in files this shard does not own. The Low Stock Report
> discrepancy ([ROUTES #88]) was **arbitrated against the live source in round 6
> and closed** — the source shows `0 records found`, so the mock's empty grid is
> parity and the TASKS 183-187 expectation was the stale side.

---

## P0 — Shell, Routing, Data Pipeline

- [x] Scaffold from `websites/mixpanel_mock`: `package.json`, `vite.config.js` with `secureMockApiPlugin()` **first** in `plugins[]`, `mock-api` registered under **both** `configureServer` and `configurePreviewServer`, endpoints `/post`, `/state`, `/go`, `/upload`, `/files`, state files at `.mock-states/<sid>.json` + `<sid>.initial.json`, sid sanitized with `sid.replace(/[^a-zA-Z0-9_-]/g,'')`
- [x] `src/utils/dataManager.js`: `getSessionId`, `storageKey`, `initialKey`, `fetchCustomState`, `createInitialData`, `initializeData(sid, customState)`, `saveState(state, sid)` POSTing `{action:'set_current', state}`, plus `fetchServerState` / `publishInitialState` (`{action:'set_initial'}`) for the /go baseline
- [x] `createInitialData()` loading `src/data/*.json` per `assets/data_model.md` §4, including the **size-budget mitigation** (static bulk imports + mutation overlay in session state — raw `products.json` + `orders.json` are 2.25 MB and will blow the `/go` budget)
- [x] `src/context/AppContext.jsx`: boot reconciles server vs. localStorage (ADOPT / REPUBLISH / COLD BOOT) and publishes the baseline with `set_initial` *before* the first `set_current`; localStorage is still read **before** any `initializeData()` call
- [x] `src/App.jsx`: `/go` route + `RedirectWithQuery` (never bare `<Navigate>`) so `?sid=` survives every redirect
- [x] `src/utils/stateTracker.js` covering every mutation in the Observable State Changes table — **done round 5**. Exports `computeStateDiff` (a byte-for-byte reimplementation of `calculateStateDiff` in `vite.config.js`, so the in-app `/go` page and a cold `GET /go` return the same object — verified equal in a browser), `computeDeepStateDiff` (path-granular, distinguishes the `systemConfig.*` writers from one another), `OBSERVABLE_STATE_CHANGES` (all **82 rows** of SCHEMA.md's table as data, **67 distinct paths** over **44 root keys**), `describeStateDiff` / `untrackedPaths`, and `verifyTrackerCoverage(baseline)`. The coverage check runs on every boot from `AppContext` and is exposed as `window.__mockTrackerCoverage()`; it currently returns `{ok: true, undeclaredRoots: [], undeclaredSubPaths: []}`. It **complements** the server diff rather than replacing it — `/go` is still answered by `vite.config.js`
- [x] `SCHEMA.md` with the state table and Observable State Changes table — file exists (254 lines), rewritten by the round-4 pipeline audit against the running code and a live `GET /go`: 43-key state table, Default IDs, minimal-inject example, and the Observable State Changes table in 7 sections
- [x] **URL handling**: trailing slash optional on every route; accept and ignore a `/key/<hash>/` suffix; `?sid=` is additive and never replaces a source param
- [x] `/admin` and `/admin/admin/` redirect to `/admin/admin/dashboard/` **without a login screen** — the app boots as user `admin`
- [x] App shell per `DESIGN.md` §4: fixed 88 px rail (`#373330`) with the 10 menu items in source order (Dashboard, Sales, Catalog, Customers, Marketing, Content, Reports, Stores, System, Find Partners & Extensions), hover flyout submenu (`#4a4542`, slides from `left:100%`), content column `calc(100% - 8.8rem)`, `.page-header` padding `1.5rem 3rem`, `.page-content` padding `0 3rem 3rem`, 28 px `#41362f` page title, page-actions button row
- [x] Header bar: global search box (submits to `/admin/<section>/index/?search=<term>`), notifications bell dropdown, "Welcome, admin" user dropdown (Account Setting / Customer View / Sign Out — Sign Out is a no-op)
- [x] **Reusable UI-component grid** (`<AdminGrid>`) — this one component serves ROUTES rows 10, 30, 32, 34, 39, 52, 60, 101. It must have: "Search by keyword" box, **Filters** panel (per-column inputs / selects / date ranges) with Cancel + Apply Filters, **Default View** bookmark dropdown, **Columns** chooser (checkbox list, "N out of M visible"), Export dropdown (CSV / Excel XML), `.admin__data-grid-filters-current` **Active filters** chip strip (`._show` when non-empty, chips labelled `Status: Complete`, each with an X, plus "Clear all"), "N records found", per-page select 20/30/50/100/200, prev/next pager with page-number input, sortable `.data-grid-th._sortable` headers with asc/desc arrows, row checkboxes + "Select All / Select All on This Page", and a mass **Actions** dropdown
- [~] **Generalised (round 6).** `src/components/reports/LegacyGrid.jsx` is the reusable legacy grid extracted from `src/components/reviews/LegacyReviewGrid.jsx`: `Export to: [CSV|Excel XML] [Export]`, Search + Reset Filter, `N records found` + `#<grid>_massaction-count`, `name="limit"` per-page select, pager, an optional massaction bar, and a `<tr class="data-grid-filters" data-role="filter-form">` inside `<thead>` driven by a column spec (`text` / `range` / `daterange` / `select` / `store` / `none`) emitting the source's own `name` attributes. Applied round 6 to **Low Stock** (`gridLowstock`, DIFF-R60 — DOM verified against `assets/html/reports-product-lowstock.html`, still `0 records found` exactly as the live source is), **Search Terms Report** (`searchReportGrid` — 7/7 rows byte-identical to the live source, ID-desc) and **Abandoned Carts** (`gridAbandoned`, DIFF-R57). Path-segment URL state (`sort/<col>/dir/<asc|desc>/limit/<n>/page/<n>/filter/<base64>/`) is implemented and switches on automatically once a splat route matches. **Still owed**: (a) splat rows in `src/App.jsx` for `/admin/reports/report_product/lowstock/*`, `/admin/search/term/report/*` and `/admin/reports/report_shopcart/abandoned/*` so those grids drive the URL rather than component state; (b) **Order Status** (`/admin/sales/order_status/`) which still renders `AdminGrid`; ~~(c) **Cart Price Rules** (`/admin/sales_rule/promo_quote/`) and **Catalog Price Rule** (`/admin/catalog_rule/promo_catalog/`), whose source grids carry a filter row the mock has not got (DIFF-R63).~~ **DONE round 8** — both converted to `LegacyGrid`; all 10 / 6 source filter `name`s present and driveable (`rule_website` via the new `col.filterId`), `<thead>` is 2 rows on both sides, row data and default order unchanged (4 / 2 records, `rule_id` asc). **NEEDS FILE: `src/App.jsx`, `src/pages/sales/OrderStatusGrid.jsx`, `src/pages/marketing/Marketing.jsx`**. Round 7 added the pieces those three need and applied them to **Refresh Statistics** (`gridRefreshStatistics`, DIFF-R56 — `_massaction-select` + Submit + `_massaction-mass-select`, one `<thead>` row, no filter row, no export, no pager): `LegacyGrid` now takes `pager={false}`, `exportable={false}`, `rowSelectName` and renders the source's mass-select helper.
- [x] Flash message bar (`.message` `#fffbbb`) rendered above the page title, cleared on next navigation

## P1 — Sales

- [x] [ROUTES #10] **Orders grid** `/admin/sales/order/`. Columns in source order: checkbox, ID (`000000302`), Purchase Point ("Main Website / Main Website Store / Default Store View"), Purchase Date, Bill-to Name, Ship-to Name, Grand Total (Base), Grand Total (Purchased), Status, Action → "View". 308 records. Mass actions: Cancel, Hold, Unhold, Print Invoices, Print Packing Slips, Print Credit Memos, Print All, Print Shipping Labels. Status filter values must render chips labelled exactly **Pending, Processing, Suspected Fraud, Complete, Closed, Canceled, On Hold** — tasks 676–680 string-match `document.querySelector("div.admin__data-grid-filters-current").outerText`
- [x] [ROUTES #11] **Order view** `/admin/sales/order/view/order_id/:id/`. Left `.admin__page-nav`: Information, Invoices, Credit Memos, Shipments, Comments History, Transactions. Page title `#000000302`. Buttons: Back, Send Email, `#order-view-cancel-button` "Cancel", `#order-view-hold-button` "Hold", `#order_invoice` "Invoice", `#order_ship` "Ship", `#order_reorder` "Reorder", `#order_edit` "Edit". Body sections: Order & Account Information (Order Date, Order Status in `#order_status`, Purchased From, Customer Name link → `/admin/customer/index/edit/id/:id/`, Email, Customer Group), Address Information (Billing Address + Shipping Address, each with an **Edit** link → `/admin/sales/order/address/address_id/:addressId/`), Payment & Shipping Method, **Items Ordered** table (Product / Item Status / Original Price / Price / Qty / Subtotal / Tax Amount / Tax Percent / Discount Amount / Row Total), Order Total: `#order_history_block` with a Comment textarea, Status select, "Notify Customer by Email" + "Visible on Storefront" checkboxes, **Submit Comment** button, and the `.note-list` history below
- [x] [ROUTES #16] **Add order comment** — POST prepends `{created_at, status, comment, is_customer_notified, is_visible_on_front}` to `orders[id].comments`; the newest entry must be `.note-list`'s `firstElementChild` and its `.note-list-comment` must contain the raw comment text (tasks 491–495 assert exactly this DOM path)
- [x] [ROUTES #17] **Cancel order** — `#order-view-cancel-button` → confirm modal ("Are you sure you want to cancel this order?") → status becomes **`Canceled`** in `#order_status`, a history entry is appended, success message "You canceled the order." (tasks 470–474; orders 299, 301, 302, 305, 307)
- [x] [ROUTES #18/#19] **Hold / Unhold** — status ⇄ `On Hold`, button label swaps
- [x] [ROUTES #15] **Edit Order Address** `/admin/sales/order/address/address_id/:id/`. Fields: Name Prefix, First Name, Middle Name/Initial, Last Name, Name Suffix, Company, Street Address (2 lines), City, Country (select), State/Province (select, must render full names — "New York", "California", "Texas", "Florida"), Zip/Postal Code, VAT Number, Phone Number, Fax. Save → order view, address block updated, success message. Tasks 538–542 assert the new street/city/state/zip strings appear on `/admin/sales/order/view/order_id/:id`
- [x] [ROUTES #24/#25/#26] **Ship flow.** `#order_ship` navigates to `/admin/admin/order_shipment/start/order_id/:id/` → `/admin/admin/order_shipment/new/order_id/:id/`. The New Shipment page has a **Shipping Information** panel with an "Add Tracking Number" button that appends a row of `Carrier` select / `Title` text / `Number` text. Carrier options and their labels: `custom` → Custom Value, `dhl` → DHL, `fedex` → Federal Express, `ups` → United Parcel Service, `usps` → United States Postal Service. Submit Shipment appends the comment **`Tracking number <number> for <Carrier label> assigned`** to the order's comment history — that exact sentence is asserted by tasks 496–500 on `/admin/sales/order/commentsHistory/order_id/:id/active_tab/order_shipments/`
- [x] [ROUTES #13/#14] **Comments History tab** at `/admin/sales/order/commentsHistory/order_id/:id/` and `.../active_tab/order_shipments/` — renders the `.note-list` standalone (this is an AJAX partial in the source; in the mock render it as a page so a deep link works)
- [x] [ROUTES #21/#22/#23] **Invoice flow** — Items to Invoice with per-item Qty, "Update Qty's", Invoice Totals, Append Comments, Email Copy of Invoice, Submit Invoice; creates an invoice row and moves the order to Processing/Complete
- [x] [ROUTES #30/#31] **Invoices grid + invoice view** — 2 rows; the view must show Grand Total `$36.39` (invoice `000000001`) and `$39.64` (`000000002`) for tasks 94/95
- [x] [ROUTES #32/#33] **Shipments grid + shipment view** — 3 rows, with Shipping and Tracking Information on the view
- [x] [ROUTES #34/#35] **Credit Memos grid + view** — 1 row
- [x] [ROUTES #36/#37/#38] Transactions grid (empty state "We couldn't find any records."), Billing Agreements (empty), Order Status list

## P1 — Catalog

- [x] [ROUTES #39] **Products grid** `/admin/catalog/product/`. Columns: checkbox, ID, Thumbnail, Name, Type, Attribute Set, SKU, Price, Quantity, Salable Quantity, Visibility, Status, Websites, Last Updated At, Action → "Edit". 2040 records. Split **Add Product ▾** button (Simple Product / Configurable Product / Grouped Product / Virtual Product / Bundle Product / Downloadable Product) linking to `/admin/catalog/product/new/set/4/type/<type>/`. Mass actions: Delete, Change status (Enable/Disable), Update attributes. Filters panel must include ID from/to, Price from/to, Quantity from/to, Last Updated from/to, Store View, Name, Type, Attribute Set, SKU, Visibility, Status
- [x] [ROUTES #40] **Product edit form** `/admin/catalog/product/edit/id/:id/`. Header: product name as page title, buttons Back, Add Attribute, Save ▾ (Save & New / Save & Duplicate / Save & Close), and a Delete in the Save menu. Fields with **these exact `name` attributes** (asserted by 30+ tasks): `product[name]`, `product[sku]`, `product[price]`, `product[status]` (toggle: 1 Enable / 2 Disable), `product[quantity_and_stock_status][qty]`, `product[quantity_and_stock_status][is_in_stock]` (select: 1 In Stock / 0 Out of Stock), `product[weight]`, `product[attribute_set_id]`, `product[visibility]`, `product[categories]`, `product[country_of_manufacture]`, the attribute selects `product[color]`, `product[size]`, `product[material]`, and the boolean switchers `product[sale]` / `product[new]` (checkbox, `value` 1/0 — not selects; BUG-108). Collapsible sections below: Content (description editor), Configurations, Product Reviews, Images and Videos, Search Engine Optimization, Related Products/Up-Sells/Cross-Sells, Customizable Options, Product in Websites, Design, Schedule Design Update, Gift Options. **Images And Videos is a real Manage Gallery** — per-image Alt Text (`product[media_gallery][images][N][label]`), the source's Base / Small / Thumbnail role checkboxes, Hide from Product Page, Delete image, and a file picker to add one; every edit is written by `buildPatch()` and lands in `productOverrides`
- [x] [ROUTES #42] **Product save** persists to session state and survives navigation. Price must be formatted to 2 decimals on reload (`27.00`, `62.10`, `38.25`, `29.50`, `19.80`, `36.80`, `47.00`, `64.88`, `20.40`, `64.00`, `32.88`, `22.33`, `21.56` are the asserted values). Quantity must be an integer string (`5`, `478`, `112`, `156`, `50`, `42`)
- [x] [ROUTES #41] **Configurable product Configurations section** — `[data-index="configurable"]` whose outerText lists variant names (`Phoebe Zipper Sweatshirt-S-Brown`, `Minerva LumaTech™ V-Tee-XXXL-Green`, `Diana Tights-30-Blue`, …), each row showing Image, Name, SKU, Price, Quantity, Weight, Status, Attributes, Actions, under the source's own intro copy and `Current Variations` heading. **Done (BUG-109):** `Edit Configurations` now opens the source's four-step `Create Product Configurations` slide-out — Step 1 Select Attributes (the 3 global user-defined dropdown attributes, pre-checked from the parent), Step 2 Attribute Values (Select All / Deselect All / Remove Attribute), Step 3 Bulk Images, Price and Quantity, Step 4 Summary — and `Generate Products` creates one child per missing combination through `addProduct`/`patchProduct`, so the new rows reach /go's `state_diff` (`newProducts` + `productOverrides`). `Add Products Manually` associates an existing simple product. New attribute values (XXXL/XXS) are added where the source adds them: Catalog > Product Attributes > the attribute > Add Option
- [x] [ROUTES #43] **New Product** `/admin/catalog/product/new/set/:setId/type/simple/` — attribute-set selector defaulting to the `set` path param (Top=9, Bottom=10, Gear=11); Save creates a product with the next free `entity_id` and lands on the edit page with "You saved the product." (tasks 694–698 read the field values on `url=last`)
- [x] [ROUTES #44/#45] **Categories** page: jsTree with Default Category (ID: 2) root and 40 nodes, "Add Root Category" / "Add Subcategory" buttons, right pane with Enable Category / Include in Menu / Category Name, Content, Display Settings, SEO, Products in Category grid, Design
- [x] [ROUTES #48] **Attribute Sets** grid — 8 rows
- [x] [ROUTES #46/#47] Product Attributes grid + attribute edit with Manage Options (must show the real numeric option ids so tasks 694–698 are discoverable)

## P1 — Customers

- [x] [ROUTES #52] **Customers grid** `/admin/customer/index/`. Columns: checkbox, Name, Email, Group, Phone, ZIP, Country, State/Province, Customer Since, Web Site, Confirmed email, Account Created in, Billing Address, Shipping Address, Date of Birth, Tax VAT Number, Gender, Action → "Edit". 70 records. Keyword search must match the **Phone** column with stored punctuation (`+1 2058812302`, `555-229-3326`) — tasks 208–212
- [x] [ROUTES #53] **Customer edit** `/admin/customer/index/edit/id/:id/`. Left nav: Customer View, Account Information, Addresses, Orders, Shopping cart, Newsletter, Billing Agreements, Product Reviews, Wish List. **Customer View** default tab: Personal Information (Last Logged In, Account Lock, Confirmed email, Account Created, Account Created in, Customer Group) + Default Billing Address block. The **Orders** tab must list that customer's orders (needed for "most cancellations" workflows), and **Addresses** must show the city (tasks 759–760 read Sophia Young → Boston, Amanda Kim → Hoboken NJ)
- [x] [ROUTES #54/#55] New Customer form + save
- [x] [ROUTES #56] Customer Groups grid — 4 rows
- [x] [ROUTES #58] Customers Now Online grid

## P1 — Marketing & reviews

- [x] [ROUTES #65] **Reviews grid** `/admin/review/product/index/` (legacy grid, 351 rows). Columns: checkbox, ID, Created, Status, Title, Nickname, Review, Visibility, Type, Product, SKU, Action → "Edit". Inline filter row: ID from/to, Created from/to (date pickers), Status select (All/Approved/Pending/Not Approved), Title text, Nickname text, Review text, Visibility select, Type select, Product text, SKU text. Mass Actions: Update Status (Approved/Pending/Not Approved), Delete. The **Review** column text search is what answers tasks 11–15 (`disappointed` → 4 records found, `satisfied` → 2, `decent` → 2, `best` → 2, `not useful` → 0), so the record counter must be correct under filtering
- [x] [ROUTES #66] **Pending Reviews** `/admin/review/product/pending/` — same grid pre-filtered to Pending (5 rows: 347, 349, 351, 352, 353)
- [x] [ROUTES #67] **Edit Review** `/admin/review/product/edit/id/:id/`. Product name + SKU (linked), "Posted By" nickname, Summary Rating stars, **Detailed Rating** radio matrix (Quality / Value / Price / Rating × 1–5 stars), `select[name="status_id"]` (1 Approved / 2 Pending / 3 Not Approved), Nickname, Summary of Review, Review textarea. Buttons: Back, Delete Review, Save Review. **An unknown or deleted review id must render `Rating isn't Available` rather than 404** (tasks 772–776 assert that string, including on the non-existent id 999)
- [x] [ROUTES #68] Review save (status change) and delete, both reflected in the grid counts
- [x] [ROUTES #60/#61/#62/#63] **Cart Price Rules.** Grid columns: ID, Rule, Coupon Code, Start, End, Status, Web Site. New/Edit form sections: Rule Information (`Rule Name`, Description, Active toggle, Websites multiselect [Main Website], **Customer Groups** multiselect [NOT LOGGED IN, General, Wholesale, Retailer], Coupon select [No Coupon / Specific Coupon], Uses per Customer, From, To, Priority), Conditions, **Actions** (Apply select → *Percent of product price discount* / *Fixed amount discount* / *Fixed amount discount for whole cart* / *Buy X get Y free*; Discount Amount; Maximum Qty Discount is Applied To; Discard subsequent rules; Apply to Shipping Amount; Free Shipping), Labels, Related Banners. Save must write `{name, customer_group_ids, simple_action, discount_amount}` into state using **those exact key names and value encodings** (`by_percent` / `cart_fixed`, discount amount as a string) — tasks 699–703
- [x] [ROUTES #70/#71] Search Terms grid + edit
- [x] [ROUTES #72] **Search Terms Report** `/admin/search/term/report/` — legacy grid sorted by Uses desc: Search Query, Store, Results, Uses. Rows: hollister 1/19, Joust Bag 10/4, nike 0/3, Antonia Racer Tank 23/2, MT02-M-Gray 115/1, WP10 1/1, tanks 23/1 (tasks 41–43, 127)

## P1 — Content

- [x] [ROUTES #101] **CMS Pages grid** — 6 rows. Columns: ID, Title, URL Key, Layout, Store View, Status, Created, Modified, Action → Select ▾ (Edit / View / Delete)
- [x] [ROUTES #102] **CMS page edit** `/admin/cms/page/edit/page_id/:id/` — `input[name="title"]` is the evaluator target (tasks 486–490). Sections: Enable Page toggle, Page Title, Content, Search Engine Optimization (URL Key, Meta Title/Keywords/Description), Page in Websites, Design, Custom Design Update. Buttons: Back, Delete Page, Save ▾ (Save & Duplicate / Save & Close), Save & Continue Edit
- [x] [ROUTES #103] New CMS page + save
- [x] [ROUTES #108/#109] **Design > Themes** grid (**2 rows** — the grid lists frontend themes only; verified live) and **theme settings page** `/admin/admin/system_design_theme/edit/id/:id/` — Theme Title, Parent Theme, Theme Path, Theme Version + Theme Files left nav. `id/1` Magento Blank, `id/3` Magento Luma (tasks 374, 375 navigate here by URL)
- [x] [ROUTES #107] Design Configuration grid (Default / Website / Store View scope rows, Edit action)

## P1 — Reports

- [x] **Shared report header component** — `input#sales_report_from` and `input#sales_report_to` (text + date-picker, format `M/D/YY`), Period select (Day/Month/Year), Show By, Order Status select (Any / Specified), Empty Rows checkbox, Show Actual Values checkbox, and a **Show Report** button. Tasks 704–713 assert the two input values after the agent types a range, so the inputs must retain what was typed **and** the values must survive the Show Report round-trip
- [x] [ROUTES #80] **Orders Report** `/admin/reports/report_sales/sales/` — Interval, Orders, Sales Items, Sales Total, Invoiced, Refunded, Sales Tax, Shipping, Discounts, Canceled; computed from `orders.json`. Monthly period must reproduce the completed-order counts in `assets/data_model.md` §5 (tasks 107–111)
- [x] [ROUTES #86] **Bestsellers Report** `/admin/reports/report_sales/bestsellers/` — Interval, Product, Price, Order Quantity, ranked desc. Must yield "Quest Lumaflex™ Band" as #1 for 2022 and the Duffle products for Jan 2023 (tasks 0–6, 713)
- [x] [ROUTES #88] **Low Stock Report** `/admin/reports/report_product/lowstock/` — **ARBITRATED AGAINST THE LIVE SOURCE (round 6) — CLOSED. The mock is correct; this line was the stale side.** Loaded `http://localhost:7780/admin/reports/report_product/lowstock/` read-only in a browser: the source renders `0 records found` / "We couldn't find any records." and its columns are **Product · SKU · Quantity · Source Code** (the earlier "Source Code · Quantity" reading was wrong; `ROUTES.md` row 88 is corrected). Sinbad Fitness Tank, WH11-S-Blue and WS08-XS-Blue do NOT appear on the source, so the tasks 183-187 expectation of populated rows is struck. `src/pages/reports/LegacyReports.jsx:466-494` (Magento's `addSourceItemInStockFilter` plus `qty < notify_stock_qty`, with every product at `notify_stock_qty = 1`) is right as written and needs no change. **Do not re-open without re-checking the live source first.**
- [x] [ROUTES #91] **Order Count Report** `/admin/reports/report_customer/orders/` — Customer, Orders, Average Order Amount, Total Order Amount (tasks 62–65)
- [x] [ROUTES #81/#83/#84/#85/#89] Tax, Shipping, Refunds, Coupons, Product Views reports — same header, correct column sets (tasks 706, 708, 710, 711, 712)
- [x] [ROUTES #82/#87/#92/#93/#94/#95/#96] Invoice, Ordered Products, Order Total, New Accounts, Customer Reviews, Product Reviews (+ per-product detail) reports

## P2 — Depth & Realism

- [x] [ROUTES #4/#5/#6] Dashboard tab AJAX partials as real routes (Most Viewed Products, New Customers, Customers)
- [x] [ROUTES #3] Dashboard chart (Orders/Amounts toggle) and the Lifetime Sales / Average Order / Last Orders / Last Search Terms / Top Search Terms tiles computed from the seed
- [x] [ROUTES #27/#28/#29] Credit-memo creation (form + refund totals + state write, and the source's 404 for a non-invoiced order is reproduced), Reorder / Create New Order — **Submit Order now places the order**: `newOrders` is a declared key in `createInitialData()`, `getOrder`/`getOrders`/`getOrderGridRows` concatenate it over the static corpus, the new order gets the next `entity_id`/`increment_id` and its first `orderComments` history row, and Submit redirects to `/admin/sales/order/view/order_id/:newId/`
- [x] [ROUTES #64] Catalog Price Rule grid + form — **already built (round ≤4), verified round 5.** `/admin/catalog_rule/promo_catalog/` renders 2 seeded rules from `catalogPriceRules.json`; `/new/` saves a rule and the grid then shows 3 rows, with `state_diff = {catalogPriceRules}` in `/go`
- [x] [ROUTES #69] Ratings grid (Quality / Value / Price) — **already built, verified round 5.** `/admin/review/rating/` renders 4 rows (Quality, Value, Price, Rating) from `ratings.json`; `/edit/id/1/` opens with page title `Quality`
- [x] [ROUTES #73] Search Synonyms — **already built, verified round 5.** `/admin/search/synonyms/` renders; `/new/` with `input[name=synonyms]` + `select[name=scope]` + Save Synonym Group wrote `systemConfig.synonyms = [{group_id: 1, synonyms: "shorts,pants,trousers", scope: "all", …}]` into `/go`'s `state_diff`
- [x] [ROUTES #74] **URL Rewrites** — all 225 `url_rewrite` rows extracted into `src/data/urlRewrites.json` (DIFF-R25); grid renders `225 records found` / 12 pages, ID desc, columns `☐ · ID · Store View · Request Path · Target Path · Redirect Type · Action`, mass-action Delete, edit form over a `state.systemConfig` overlay
- [x] [ROUTES #75–#78] Newsletter Templates / Queue / Subscribers / Problem Reports — **already built, verified round 5.** All four routes render with the source's page titles (`Newsletter Templates`, `Newsletter Queue`, `Newsletter Subscribers`, `Newsletter Problems Report`), grid rows, and 15–17 controls each; Subscribers carries the source's `type` (Customer/Guest) and `status_label` (Subscribed / Not Activated / Unsubscribed / Unconfirmed) filter selects. Templates write `systemConfig.newsletter_templates`; Subscribers write `newsletterSubscribers`
- [x] [ROUTES #79] Terms and Conditions — **already built, verified round 5.** `/admin/checkout/agreement/` renders; `/new/` (fields `name`, `is_active`, `is_html`, `mode`, `store_id`, `checkbox_text`, `content`, `content_height` + Save Condition) wrote `systemConfig.checkout_agreements = [{agreement_id: 1, name: "Round5 Terms", …}]` into `/go`'s `state_diff`
- [x] [ROUTES #97/#98/#99/#100] Products in Carts, Abandoned Carts, Refresh Statistics, Advanced Reporting splash — **already built, verified round 5.** `report_shopcart/product` (columns ID · Product · Price · Carts · Orders), `report_shopcart/abandoned` (Customer · Email · Number of Items · Subtotal · Applied Rule IDs), `report_statistics` (8 rows + Actions mass-action bar; writer confirmed at `src/pages/reports/LegacyReports.jsx:749-765` writing `systemConfig.report_statistics`), and the Advanced Reporting splash with the source's copy and a "Go to Advanced Reporting" action. **Caveat:** the Refresh Statistics *mass action* was not driven end-to-end in the browser — the grid's Actions menu did not open under automation; the writer is verified by code, not by a `/go` read
- [x] [ROUTES #104/#105/#106/#110/#111] CMS Blocks, Widgets, Media Gallery, Design Schedule, PageBuilder Templates
- [x] [ROUTES #112/#113/#114] All Stores, Configuration section nav + real field maps for `general`, `currency`, `catalog`, `sales`, `admin` (and `design`, which the source answers with the General body). Field labels, input names, option lists and effective values scraped off the live admin; edits create/patch `core_config_data` rows so they land in /go's state_diff
- [x] [ROUTES #115/#116] Currency Rates, Currency Symbols
- [x] [ROUTES #117/#118/#119] Tax Zones and Rates, Tax Rules, Import/Export Tax Rates
- [x] [ROUTES #120/#121/#122] All Users (1 row: `admin`), User Roles (Administrators), Custom Variables
- [x] [ROUTES #123/#124] Cache Management (buttons render a success message, no-op), Index Management
- [x] [ROUTES #125/#126/#127/#128/#129/#130] Import, Export, Import History, Integrations, Bulk Actions Log, Site Map, Email Templates
- [x] [ROUTES #7/#8] Notifications grid, My Account form
- [x] [ROUTES #131/#132/#133] Login Sessions, Locked Users, Encryption Key
- [x] Product images: copy `/media/catalog/product/**` thumbnails into `public/` or substitute same-dimension placeholders (see `SOURCE.md` §5.6) — **the second option is in place and verified round 5.** The Products grid's Thumbnail column renders `<ThumbnailPlaceholder>` (`src/components/catalog/FormControls.jsx:152`), an inline SVG in `.admin__thumbnail-placeholder`, styled `5rem × 5rem` in `src/components/catalog/adminForm.css:472` — measured **50 × 50 px** in the browser, matching Magento admin's `.admin__control-thumbnail`. On `/admin/catalog/product/` all **200 rows on the page render a placeholder**, the document contains **zero `<img>` elements**, zero broken images, and zero external network requests. No hotlinking to `localhost:7780`, per `TRADEMARKS.md`. *Fidelity note (not a defect):* the source shows real product photography for products that have it; the mock shows a neutral placeholder for every product, which is what this item permits

---

## Data Seed

Owned by the extraction agent; this is the acceptance list. See
`assets/data_model.md` for shapes.

- [x] `products.json` — 2040 real records (ids 1–2040, real SKUs/prices/qty)
- [x] `productDescriptions.json` — deduplicated description HTML, keyed by hash
- [x] `orders.json` — 308 real orders with nested addresses/items/payment
- [x] `customers.json` — 70 real customers with addresses and phone numbers
- [x] `customerGroups.json` — 4 groups
- [x] `attributeSets.json` — 8 sets with real ids
- [x] `attributeOptions.json` — 12 attributes with real numeric option ids
All of the below were re-verified against the files on disk **and** against the
running app in a browser during round 5 — a file present but unwired would not
count. Record counts were read with `JSON.parse(...).length`, wiring was
confirmed by the value appearing in `GET /go`'s `initial_state` (which is
`createInitialData()`) and by the corresponding grid rendering it.

- [x] **`reviews.json` — 351 records** (review + review_detail + ratings). Blocks tasks 11–15, 77–79, 112–123, 213–217, 243–247, 344–348, 771–776, 790 — file is a 351-element array; imported at `dataManager.js:41` into `createInitialData().reviews`; `/admin/review/product/index/` renders **"351 records found"** with the legacy in-`<thead>` filter row carrying the source's `name` attributes (`review_id`, `created_at[from]`, `created_at[to]`, `status`, `title`, `nickname`, `detail`, `visible_in`, `type`, `name`, `sku`)
- [x] **`searchTerms.json` — 7 records** with `num_results` and `popularity`. Blocks tasks 41–43, 127 — 7-element array, wired at `dataManager.js:42`; `/admin/search/term/` renders and contains `hollister`
- [x] **`invoices.json` (2), `shipments.json` (3), `creditmemos.json` (1)**. Blocks tasks 94, 95 — counts confirmed exactly 2 / 3 / 1 (`creditMemos.json`, camel-cased on disk); all three wired at `dataManager.js:43-48` and present in `/go`'s `initial_state`
- [x] **`cmsPages.json` — 6 pages**. Blocks tasks 486–490 — 6-element array, wired at `dataManager.js:51`; a partial inject of `{"cmsPages": [...]}` for a fresh sid rendered the injected title in `/admin/cms/page/`, proving the seed is the live source for that grid
- [x] **`themes.json` — 3 themes**. Blocks tasks 374, 375 — **3 themes are seeded with real ids and paths** (`1 Magento/blank`, `2 Magento/backend`, `3 Magento/luma`), but they live in `src/data/systemConfig.json` under `themes[]`, **not** in a separate `themes.json`; there is no file by that name. The Themes grid correctly lists only the **2 `area: "frontend"`** rows (ids 1 and 3), which is what the live source shows — see [ROUTES #108]. Ticked on substance; the filename in this line is stale
- [x] **`categories.json` — 40 categories** (root 1, Default Category 2, Gear 3) — 40-element array; loaded as STATIC reference data via `src/utils/staticData.js` (not carried in state, by the size-budget split), and `/admin/catalog/category/` renders the tree
- [x] **`cartPriceRules.json` — start as `[]`**; grows at runtime. Blocks tasks 699–703 — **superseded, and better than specified**: the file holds the source's **4 real rules** (`1 Buy 3 tee shirts and get the 4th free`, `2 Spend $50 or more - shipping is free!`, `3 20% OFF Ever $200-plus purchase!*`, `4 $4 Luma water bottle (save 70%)`) rather than an empty array, and still grows at runtime. Real identifiers beat a synthetic empty start, so this line's `[]` requirement is deliberately not met
- [x] Verify `orders[].comments[]` exists (default `[]`) — it is the mutation target for tasks 491–500 — **superseded by the overlay architecture**: `orders.json` records carry **no** `comments` key (orders are a 0.99 MB STATIC corpus and cannot live in state). The mutation target is the declared state key `orderComments: {[entity_id]: Comment[]}`. Verified end-to-end: Hold on order 300 for a brand-new sid produced `state_diff` keys `["orderComments", "orderOverrides"]` in `GET /go`
- [x] Sanity check per `WEBARENA_MIGRATION.md` §4.5 — something to search for: `hollister` present in the Search Terms grid ✓; a list long enough to paginate: `/admin/catalog/product/` reports **"2040 records found"** ✓; a filterable text corpus: reviews grid reports **"351 records found"** ✓. **Something to sort by low-stock qty is NOT exercisable — and must not be**: the live source itself reports `0 records found` on that report (arbitrated round 6, see [ROUTES #88])

---

## Round 10 — global grid-kind classification (done)

- [x] **Enumerate every grid route in `ROUTES.md`, classify each against the live
  source, fix every mismatch in one pass.** Full table in `ROUTES.md` §12.
  28 mismatches found (24 legacy-served-as-modern, 3 plain-legacy-served-as-modern,
  1 non-defect), 27 fixed. New shared component
  `src/components/grid/LegacyAdminGrid.jsx` renders `<LegacyGrid>` from
  `<AdminGrid>`-shaped props so a page converts with a one-word swap — that is
  what made a whole-app pass possible where five directory-at-a-time rounds failed.
- [x] `DIFF-R61` `/admin/sales/order_status/` — legacy chrome, Export removed,
  source row order (`SOURCE_ROW_ORDER`, transcribed) restored.
- [x] `DIFF-R80/R81/R82` newsletter subscriber / template / queue — converted,
  and template/queue regained the `Template Type` + `Action` columns they dropped.

## Round 12 — app-wide `<select>` option-VALUE sweep (done)

The defect class: option **labels** correct, option **values** re-derived, so the
page reads right in a screenshot and in the accessibility tree while
`select_option(value=…)` either raises or — worse — silently selects the wrong
thing. Swept all 232 concrete URLs on both sides, 2 040 `<select>`s paired by
`(name|id, nth)`, option `(value, label)` pairs diffed in order.
Scripts `/tmp/fix16/sweep.py` + `/tmp/fix16/diff.py`.

- [x] **F-01c** `/admin/newsletter/template/` `[name="type"]` — values were
  `html`/`text`; the source's are Magento's `TemplateTypesInterface` constants
  `2` (html) / `1` (text), confirmed in the container at
  `Newsletter/Block/Adminhtml/Template/Grid.php`. Cell now renders the label for
  the stored numeric (Magento `type=options` column) and a saved template gets
  `template_type: 2`, matching `Template\Save.php`.
- [x] **F-01d** `/admin/newsletter/queue/` `[name="status"]` — `Sent` and
  `Cancelled` were swapped. `Newsletter/Model/Queue.php`: `STATUS_CANCEL = 2`,
  `STATUS_SENT = 3`. This one did not raise; it filtered to the wrong status.
- [x] **F-01g (new)** `/admin/indexer/indexer/list/`
  `#gridIndexer_massaction-select` — values were `realtime` / `schedule` /
  `invalidate`; the source's are `change_mode_onthefly` /
  `change_mode_changelog` / `invalidate_index`. Same class as F-01c, found only
  because the sweep covered massaction selects too.
- [x] **F-01h (new)** `/admin/admin/cache/` `#cache_grid_massaction-select` —
  option ORDER was `Refresh · Enable · Disable`; the source's
  `adminhtml_cache_block.xml` declares `Enable · Disable · Refresh`, so
  selection by index landed on the wrong action.
- [x] **F-01i (new)** massaction **default selection**. Magento's massaction
  layout takes `<item name="selected">1</item>`; three grids use it and the mock
  started all three on the placeholder — `/admin/admin/cache/` (`refresh`),
  `/admin/admin/locks/` (`unlock`), `/admin/reports/report_statistics/`
  (`refresh_recent`). New `massActionDefault` prop on `LegacyGrid` /
  `LegacyAdminGrid`; the select also gains the source's `_selected` modifier
  when an action is chosen. All 13 massaction selects now agree on
  `value` + `selectedIndex` with the source.
- [x] **F-06c** `/admin/sales/order_create/start/` `[name="billing_country_id"]`
  blank-sentinel label — `All Countries` there (Magento's legacy `country`
  column filter), `''` on `/admin/customer/index/`. `CustomerGrid` serves both
  routes and now spells the label per route.

After the fixes the sweep re-ran clean: **502 matching**, and of the 7 remaining
non-matches **5 are the known P2 export path-suffix rows (F-05)** and **2 are the
refuted `product_attribute/edit/attribute_id/new/` phantom** — the source
redirects that URL to the attribute grid, so the two sides are not the same
element.

### Open, verified against the source but NOT fixed this round

- [ ] **P2 — export select values drop the grid-state path suffix (F-05).** Five
  rows, all `<grid>_export`: `/admin/reports/report_product/downloads/store/1/`
  and `/lowstock/store/1/` lose `store/1/`,
  `/lowstock/sort/qty/dir/asc/limit/50/` loses its sort/limit segments, and
  `/admin/reports/report_review/product/detail/id/{1,14}/` lose the source's
  (literally empty-valued) `detail/id/` suffix. Same option count, same labels,
  same order; only the URL each value carries differs, and the host already
  differs by construction.
- [ ] **P1? — extend the value sweep to cold-load `select.value`.** This round
  compared option LISTS app-wide but cold-load SELECTION only for the 13
  massaction selects — where it found 3 defects. The source has 133 non-config
  selects whose selected option is not the first (list in the round-12 dev
  report); each is a place where an evaluator reading the control, or submitting
  without touching it, can diverge silently. React does not emit a `selected`
  attribute, so this must be measured as the DOM `value`/`selectedIndex`
  property on both sides, not scraped from `outerHTML`.

- [ ] **P1 — modern-grid records-count class.** On the SOURCE the modern
  UI-component grids put `N records found` in `.admin__control-support-text`,
  the same class the legacy grids use; there is no
  `.admin__data-grid-records-count` there at all. The mock uses
  `.admin__data-grid-records-count` on all 9 modern grids. Measured on
  `/admin/sales/order/`, `/admin/catalog/product/`, `/admin/customer/index/`,
  `/admin/admin/url_rewrite/index/`, `/admin/cms/page/`. Left alone deliberately:
  it is one shared change across every modern grid, the round-9 test shard's own
  discriminator names the mock's class as the expected one, and the visible TEXT
  (which evaluators string-match) is already identical.
- [ ] **P2 — `formatDateTime` drops the comma before the time.** Source
  `Apr 19, 2023, 12:13:23 PM`; mock `Apr 19, 2023 12:13:23 PM`. Visible on the
  Import History and Notifications grids and anywhere else the helper is used.
  `src/utils/formatters.js` was not an owned file this round.
- [ ] **P2 — Notifications severity is upper-cased in the mock** (`CRITICAL`)
  and lower-case on the source (`critical`).
- [x] **P2 — F-05 (round 9) is still live**: `/admin/reports/report_product/sold/`,
  `/admin/reports/report_customer/orders/`, `/totals/`, `/accounts/` render no
  `Export to:` block, where the source has `gridProductsSold_export`,
  `gridOrdersCustomer_export`, `gridTotalsCustomer_export`,
  `gridAccounts_export`. Those are the `IntervalGrid` report pages, a different
  component from the grid-kind class.
  *Round 11 — `IntervalGrid` now takes `exportPaths` and renders the source's
  block on all four; option values are the export controller's absolute URL
  (F-04's shape), the button is `title="Export"` / `widget-button-0`, and the
  Order Status grid still has none, matching the source's inverse case.*

---

## Out of Scope

- **Login / logout / registration / password reset** — the app boots as `admin`
- **Admin URL secret keys, form keys, CAPTCHA** — the *features* are off in the source too (`SOURCE.md` §2). This is NOT licence to render their config CONTROLS `disabled`: `admin/security/use_form_key` and `admin/captcha/enable` both carry a `core_config_data` row, so the source renders them **enabled and unchecked**, and `fill`/`select_option` on a disabled element RAISES. Round 11 / F-04 — see `src/pages/system/Configuration.jsx`
- **Server-side machinery**: cache flush, reindex, cron, import/export execution, email sending, PDF generation for Print Invoices / Packing Slips — render the affordance and a success message, do nothing
- **External services**: Adobe Commerce marketplace, Advanced Reporting signup, Braintree, PayPal reports, New Relic
- **Real permissions / multi-user** — one admin user, one role
- **Storefront routes** (`../antonia-racer-tank.html`, `../bella-tank.html`, `../selene-yoga-hoodie.html`, `../radiant-tee.html`, `../affirm-water-bottle.html`) — tasks 464 and 543–546 assert there; that is `webarena_shopping_mock`'s surface. This mock only has to **persist** the description edit.
- **Map routes** (tasks 759–760) — `webarena_map_mock`'s surface; only the customer-city lookup belongs here
- **Any runtime network call** — the mock must work fully offline
