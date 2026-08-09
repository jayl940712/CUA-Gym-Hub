# webarena_shopping_mock — TODO

> Status: **READY FOR DEV**
> Source: `http://localhost:7770` (absolute base `http://10.186.197.203:7770/`) · image `shopping_final_0712:latest` · container `shopping`
> Recon: `SOURCE.md` | Routes: `ROUTES.md` | Design: `DESIGN.md` | Data: `assets/data_model.md` | UI: `assets/README.md`
> Screenshots: `assets/screenshots/reference/` (36) · HTML: `assets/html/` (36)
> **Recon mode: FULL** (docker + DB + live site all available)

Read `SOURCE.md` § "Observations that will bite the dev agent if missed" before
writing any code — 14 numbered traps, each of which will cost you a rewrite.

## Status Legend
- `[ ]` Not started · `[~]` In progress · `[x]` Done

---

## P0 — Shell, Routing, Data Pipeline

- [x] Scaffold from `websites/mixpanel_mock`: `package.json`, `index.html`,
      `vite.config.js` with `secureMockApiPlugin()` **first** in `plugins[]`, then
      the `mock-api` plugin registered under **both** `configureServer` and
      `configurePreviewServer`. Endpoints `/post`, `/state`, `/go`, `/upload`,
      `/files`. State files at `.mock-states/<sid>.json` + `<sid>.initial.json`,
      sid sanitised with `sid.replace(/[^a-zA-Z0-9_-]/g, '')`.
- [x] `src/utils/dataManager.js`: `getSessionId`, `storageKey`, `initialKey`,
      `fetchCustomState`, `createInitialData`, `initializeData(sid, customState)`,
      `saveState(state, sid)` → POSTs `{action:'set_current', state}`.
      **`createInitialData()` returns only the mutable slice** — see
      `assets/data_model.md` §14. The catalog JSON is imported directly by
      components and must never enter state (it is 4.3 MB and `/go` diffs the
      whole state on every call).
- [x] `src/context/AppContext.jsx`: check `localStorage.getItem(initialKey(sid))`
      **before** calling `initializeData()`, or injected task state never loads.
- [x] `src/App.jsx`: `/go` route; `RedirectWithQuery` instead of `<Navigate>`
      everywhere so `?sid=` survives every redirect, form post and programmatic
      navigation. Deep links must work on first load (an agent may be dropped
      straight onto `/sales/order/view/order_id/180?sid=x`).
- [x] `src/utils/stateTracker.js` + `SCHEMA.md` with the state table and the
      Observable State Changes table.
- [x] App shell per `DESIGN.md` §4: panel bar 41 px → header 87 px
      (`padding: 30px 20px 0`) → nav band `#f5f5f5` (wraps to two rows at
      1440 px) → `.page-main` max-width **1280 px** with `padding: 0 20px` →
      footer. Sidebar 207 px on category pages, 252 px on account pages.
      Full copy for every band is in `assets/README.md` §0.
- [x] Routing for **all 42 rows in `ROUTES.md`**, including:
      - the two product URL shapes (`/:urlKey.html` and `/catalog/product/view/id/:id`)
      - the two category URL shapes (`/:urlPath(*).html` and `/catalog/category/view/id/:id`)
      - **both** `/catalogsearch/result/?q=` and `/catalogsearch/result/index/?q=`
      - trailing-slash-optional on `/checkout/cart`, `/contact`
      - a catch-all `*` that renders the 404 page (`assets/README.md` §18) —
        including for `…sport-specific-clothing.html&product_list_order=price`
- [x] Load the 12 seed modules from `src/data/` (see `assets/data_model.md`).

---

## P1 — Core Site Features

Each item names the `ROUTES.md` row it satisfies.

### Catalog browsing

- [x] **[ROUTES #1, #2] Home page.** `<h1>One Stop Market</h1>`, block title
      `Product Showcases`, **5-column** grid (no sidebar), 12 tiles/page,
      `Items 1 to 12 of 24 total`, pager `1 2 ›`. **The pager query param is
      `pbaocw`, not `p`** (`homepage.json.pageParam`); `/?p=2` must return page 1.
      Product ids are `homepage.json.productIds` (104499 → 104476, descending).

- [x] **[ROUTES #3, #4] Category listing.** Breadcrumbs
      `Home › Electronics › Headphones` (last crumb plain grey text). `<h1>` =
      category name — and it stays the **parent's** name when the page is a
      parent filtered by `?cat=<child>`. Left `Shop By` sidebar (207 px) with
      `Shopping Options` → `Category` (child links with counts, href = current
      URL + `?cat=<id>`) and `Price` (computed buckets with counts, taken
      verbatim from `listings.json[].filters`). Toolbar: grid/list toggle,
      `Items 1-12 of 631`, `Sort By [Position ▾]` + direction arrow
      (`title="Set Descending Direction"` while asc). 4-column grid. Below:
      pager + `Show [12 ▾] per page`.
      Resolve the product list as: captured `listings.json` entry for this exact
      path+query if one exists (use its `productIds` order and `totalCount`),
      else filter `products.json` by `categoryIds` and sort client-side.

- [x] **[ROUTES #3] Layered navigation.** `?cat=<id>` filters to a descendant;
      `?price=<lo>-<hi>` filters by price and **stacks** on commas
      (`price=0-10,0-100` → the narrowest bucket wins, chip reads
      `$0.00 - $9.99`). Render a `Now Shopping by` block above `Shop By` with one
      chip per active filter, each with a `✕` whose href is the current URL minus
      that param, plus a `Clear All` link.

- [x] **[ROUTES #3] Toolbar params.** `product_list_order`
      (`position|name|price`, plus `relevance` on search pages),
      `product_list_dir` (`asc|desc`), `product_list_limit` (12/24/36),
      `product_list_mode` (`grid|list`), `p`. Every control must preserve every
      other param **and `sid`**. Verified target: `?product_list_limit=24` →
      `Items 1 - 24 of 631`; `?p=2` → `Items 13 - 24 of 631`.

- [x] **[ROUTES #3] List view** (`product_list_mode=list`): one product per row,
      image left, name/rating/price/short description right, actions column.
      Reference: `assets/screenshots/reference/35-category-list-view.png`.

- [x] **[ROUTES #9, #10, #11] Search results.** `<h1>` and last breadcrumb are
      `Search results for: 'usb wifi'` — straight single quotes, term echoed
      exactly as submitted. Sort select is `Relevance / Product Name / Price`
      with **Relevance selected by default** (category pages use `Position`).
      For any of the **48 captured queries** in `listings.json`, render its
      `productIds` in the captured order and its `toolbarAmount` verbatim
      (e.g. `Items 1 - 12 of 7123`). For anything else, fall back to
      case-insensitive token matching over `products.json[].name` and report the
      seed-derived count. Keep the header search input populated with `q`.
      Note `q=asdfghjkl` legitimately returns `1 Item` — there is no dead-end
      empty state on this site.

- [x] **[ROUTES #12, #13] Advanced search.** Form at `/catalogsearch/advanced/`
      (`<h1>Advanced Search</h1>`, fieldset `Catalog Advanced Search`); results
      at `/catalogsearch/advanced/result/` (`<h1>Advanced Search Results</h1>`)
      filtering `products.json` by the submitted `name` / `sku` / `description` /
      `price[from]` / `price[to]`.

- [x] **[ROUTES #14] Search Terms** `/search/term/popular/` — tag cloud of
      `searchTerms.json`, font-size scaled by `popularity`, each term links to
      `/catalogsearch/result/?q=<term>`.

### Product detail

- [x] **[ROUTES #5, #6] PDP layout.** Breadcrumb `Home › <full name>`; `<h1>` =
      full product name (40 px / 300); left image gallery with `‹ ›` and a
      thumbnail strip (active thumb gets a 2 px orange outline); right column in
      this exact order: `IN STOCK` · `SKU <sku>` → star widget · `12 Reviews`
      link · `Add Your Review` link → price (18 px bold) → custom-option radio
      groups → `Qty` input (52×52) + `Add to Cart` (137×52) → `Add to Wish List`
      · `Add to Compare` (11 px grey buttons).

- [x] **[ROUTES #5] Custom options.** From `productOptions.json`, keyed by
      product id. All groups are `type: "radio"`, rendered as a labelled radio
      list with a red `*` when `isRequire`. **Add to Cart must block** with
      `This is a required field.` under any unselected required group — several
      tasks say "choose any available variant" and depend on this. Selected
      `optionTypeId`s must ride into the cart line so the cart prints
      `Size: Large` / `Color: Blue`.

- [x] **[ROUTES #5] Details tab.** Render `productDescriptions.json[id]` as HTML
      inside the `Details` tab. Typical shape: `<h2>Product Quick Look</h2>` +
      feature `<ul>` + a spec table (`Package Dimensions`, `Item Weight`,
      `Manufacturer`, `Batteries`, `Date First Available`).

- [x] **[ROUTES #5, #7] Reviews tab.** Tab label `Reviews (12)`. Content:
      `Customer Reviews` heading; per review an `<h3>` title, then a line
      `Rating ★★★★★ <body>`, then `Review by <nickname>`, then
      `Posted on 4/20/23` (M/D/YY, America/New_York); **10 per page** with a
      `1 2 ›` pager (product 17500 has 87 reviews → 9 pages, use it to test).
      Then `You're reviewing: <product name>` and the form: `Your Rating *`
      (5 radio stars), `Nickname *`, `Summary *`, `Review *`, `Submit Review`.
      Submitting appends to `state.myReviews` with `customerId: 27` and the new
      review appears both here and on `/review/customer/`.

- [x] **[ROUTES #5] Star rating widget.** Percentage-width clip driven by
      `ratingSummary` (0-100), with `title="73%"` on the container — **not** a
      rounded whole-star count. Applies to grid tiles, the PDP header and each
      review row.

### Cart, checkout, orders

- [x] **[ROUTES #15, #16, #17, #19] Shopping cart.** `<h1>Shopping Cart</h1>`,
      no sidebar. Table `Item | Price | Qty | Subtotal`; each row shows the
      thumbnail, the name as a link, selected options under the name
      (`Size: Large`), a qty input, and `Move to Wishlist` / `Edit` /
      `Remove item` secondary buttons. `‹ Continue Shopping` bottom-left,
      `⟳ Update Shopping Cart` bottom-right. Right rail `Summary` panel (285 px,
      `#f5f5f5`) with collapsible `Estimate Shipping and Tax`, `Subtotal`,
      `Order Total` (bold), collapsible `Apply Discount Code`,
      `Proceed to Checkout` (255×52) and `Check Out with Multiple Addresses`.
      Boots with the 3 real lines from `cart.json` totalling **$350.42**.
      Empty state: `You have no items in your shopping cart.`

- [x] **[ROUTES #17] Add to cart** from a grid tile, from the PDP (with options
      and qty), and from the mini-cart. Success renders the green bar
      `You added <product name> to your shopping cart.` and increments the header
      cart badge.

- [x] **[ROUTES #20, #21] Checkout.** Two-step accordion, progress bar
      `Shipping` → `Review & Payments`. Step 1 (`#shipping`): the saved address
      as a selected card, `+ New Address`, `Shipping Methods` radio table with
      `Flat Rate — Fixed — $5.00`, `Next` button. Step 2 (`#payment`):
      `Payment Method` = `Check / Money order`, an Order Summary rail,
      `Place Order` → `/checkout/onepage/success/` with
      `Thank you for your purchase!` and a new increment id allocated from
      `state.nextOrderIncrementId` (starts at 190 → `000000190`). Placing an
      order appends to `state.orders`, empties the cart, and the new order must
      appear at the top of `/sales/order/history/`.
      ⚠ Step 2 was **not** captured from the live site — see `SOURCE.md`
      "Gaps" #1 before trusting the exact strings.

- [x] **[ROUTES #28] My Orders grid.** Columns
      `Order # | Date | Order Total | Status | Action(View Order, Reorder)`,
      newest first, **10 per page**, `Items 1 to 10 of 37 total`, pager
      `1 2 3 4 ›`, `Show [10 ▾] per page`. Dates `M/D/YY` in
      **America/New_York** — order 170 stores `2023-05-18 03:39:44` and must
      print `5/17/23`.

- [x] **[ROUTES #29] Order view.** `<h1>Order # 000000180</h1>`, status word on
      its own line, `Order Date: March 11, 2023` (long month), `Reorder` left /
      `Print Order` right, tab `Items Ordered`, table
      `Product Name | SKU | Price | Qty | Subtotal` with custom options printed
      under the name (bold label line, value line) and the qty cell reading
      `Ordered: 1`; right-aligned `Subtotal` / `Shipping & Handling` /
      `Grand Total`; `Order Information` with Shipping Address, Billing Address,
      `Shipping Method: Flat Rate - Fixed`, `Payment Method: Check / Money order`.

- [x] **[ROUTES #31] Reorder.** Copies every line of the order (including
      selected options) into the cart and redirects to `/checkout/cart/`.
      Five WebArena tasks are "I previously ordered X and later cancelled, can
      you reorder it and complete checkout" — this path must work end to end.

- [x] **[ROUTES #30] Print order** — a stripped layout without the site chrome.

### Account

- [x] **[ROUTES #22] Account dashboard.** Account nav sidebar (252 px) in the
      exact order and grouping in `assets/README.md` §8, with the active row
      black / 600 / 3 px `#ff5501` left marker. Main column: `Account
      Information` (Contact Information + Newsletters
      `You aren't subscribed to our newsletter.`), `Address Book` with the two
      default-address cards, and `Recent Orders` (5 newest, with a `Ship To`
      column that the full grid does not have) + `View All`.

- [x] **[ROUTES #23, #24] Account Information form** — First/Last Name,
      `Change Email` and `Change Password` checkboxes that reveal the extra
      fields; `/customer/account/edit/changepass/1/` boots with the password
      fields already expanded.

- [x] **[ROUTES #25, #26, #27] Address book.** `Add New Address` button,
      `Default Addresses` cards, `Additional Address Entries` with the empty
      state `You have no other address entries in your address book.` Edit/new
      form fields per `assets/README.md` §11. Saving shows
      `You saved the address.` and mutates `state.addresses`. Five tasks say
      "I recently moved, my address is … make it my default shipping and billing
      address" — the default checkboxes must actually re-point
      `state.customer.defaultBilling` / `defaultShipping`.

- [x] **[ROUTES #32, #33] Wish list.** Boots empty
      (`You have no items in your wish list.`). Adding from a grid heart icon or
      the PDP `Add to Wish List` appends to `state.wishlist.items` and shows
      `<name> has been added to your Wish List. Click here to continue shopping.`
      Populated view: 4-column tile grid with a comment textarea, qty input,
      `Add to Cart`, edit and remove per tile, plus `Update Wish List` and
      `Share Wish List`. Honour `?limit=50`.

- [x] **[ROUTES #34, #35] My Product Reviews.** Boots
      `You have submitted no reviews.` After a review is submitted, a table
      `Created | Product Name | Rating | Review` with a `See Details` link to
      `/review/customer/view/id/:reviewId/`.

- [x] **[ROUTES #37] Newsletter Subscriptions.** Single `General Subscription`
      checkbox, unchecked on boot, `Save` button, success message
      `We have saved your subscription.`, mutating
      `state.newsletterSubscribed`.

- [x] **[ROUTES #39] Contact Us.** `<h1>Contact Us</h1>`, sub-heading
      `Write Us`, lead `Jot us a note and we'll get back to you as quickly as
      possible.`, fields `Name *` (prefilled `Emma Lopez`), `Email *` (prefilled
      `emma.lopez@gmail.com`), `Phone Number`, `What's on your mind? *`,
      `Submit`. Submitting appends to `state.contactSubmissions` and shows
      `Thanks for contacting us with your comments and questions. We'll respond
      to you very soon.` **Twelve tasks fill this form** (refund requests, coupon
      requests) and five of them explicitly say "do not submit, keep it ready
      for review" — the typed values must be visible in the DOM without a submit.

### Global chrome behaviours

- [x] Mega-menu flyout: hover-open, two levels, 1 px `#d1d1d1` border on white,
      full tree in the DOM at load (`categories.json`).
- [x] Mini-cart dropdown from the cart icon: `My Cart`, line items with qty
      steppers, `Subtotal $350.42`, `Proceed to Checkout`,
      `View and Edit Cart`. Badge shows the item count (3 on boot).
- [x] Search autocomplete: opens at ≥3 characters, lists matching
      `searchTerms.json` entries with their result counts.
- [x] Green success message bar (`.message-success`) at the top of `.page-main`
      after every successful mutation.

---

## P2 — Depth & Realism

- [x] **[ROUTES #8] Compare list** — `/catalog/product_compare/index/`,
      `<h1>Compare Products</h1>` (the document `<title>` is the *different*
      string `Products Comparison List - Magento Commerce`),
      empty state `You have no items to compare.`
      The compare icon on every tile and the PDP `Add to Compare` must populate
      `state.compareList` and update the sidebar block.
- [x] **[ROUTES #18] Cart line edit** — `/checkout/cart/configure/id/:itemId/product_id/:productId/`
      reopens the PDP form pre-filled with the line's options and qty.
- [x] **[ROUTES #40] Privacy and Cookie Policy** CMS page.
- [x] **[ROUTES #36] My Downloadable Products** — empty state
      `You have not purchased any downloadable products yet.`
- [x] `Stored Payment Methods` page (link exists in the account nav; target not
      captured — see `SOURCE.md` Gaps #8).
- [x] Sidebar `Recently Ordered` / `Last Ordered Items` block — **rendered**, in
      `SidebarBlocks.jsx` between Compare Products and My Wish List, which is
      where the source puts it. **Only check this against a LOGGED-IN source
      session** (`span.logged-in` count 2): the section that drives it is
      populated by JS after first paint, and a logged-out session is redirected
      off every account page, so a logged-out probe sees no block at all.
      Logged in as emma.lopez@gmail.com the container answers
      `/customer/section/load/?sections=last-ordered-items` with HTTP 200 and
      three items, and the block measures 276.5x345 on `/customer/account/` and
      206.7x445 on `/electronics/headphones.html`, with 3 `<li>` in
      `#cart-sidebar-reorder`. An earlier round recorded the opposite on the
      strength of a 400 from `?sections=lastordereditems` — that is a typo, not
      a missing feature; the real section name is hyphenated. The reference
      captures `27-404.png` / `15-account-dashboard.png` were taken logged out
      and do not show the block either.
- [x] `Check Out with Multiple Addresses` and `Share Wish List` (link targets not
      captured; stub with a coherent page rather than a dead link).
- [x] Product images — the real JPEGs were copied out of the container.
      2 080 files under `public/media/catalog/product/`; every one of the
      1 105 products' primary image and all gallery references resolve to a
      file on disk. See `assets/data_model.md` §13.

---

## Data Seed

Already produced in `src/data/` (4.61 MB total). Verify these on integration:

- [x] `products.json` — **1 105** products, real `entity_id` / `sku` / `url_key`
      / `price`. Covers every task start URL, every order line, every cart line,
      all 24 home products, and page 1 of all 121 captured listings.
- [x] `categories.json` — **301** categories (the whole tree minus the two roots);
      the mega-menu needs all of them.
- [x] `reviews.json` — **3 080** reviews over 355 products, real
      `review_id` / `nickname` / `title` / `detail` / `rating` / `created_at`.
      Includes the exact reviewer set the review-mining tasks check
      (e.g. product 76525 → `Catso`, `Dibbins`, `Anglebert Dinkherhump`,
      `Michelle Davis`).
- [x] `productOptions.json` — **424** radio option groups with real
      `option_id` / `option_type_id`.
- [x] `productDescriptions.json` — cleaned/truncated store-1 description HTML for
      all 1 105 products.
- [x] `orders.json` — all **37** of Emma's orders / **100** lines, real increment
      ids `000000148`–`000000189`, statuses complete 25 / canceled 9 / pending 3.
      Arithmetic verified against the WebArena reference answers: "past four
      months" → 3 orders / $845.49; "past year" → $6 560.69.
- [x] `customer.json` — Emma Lopez, id 27, one address (id 26), not subscribed.
- [x] `cart.json` — the real 3-line active quote 255, subtotal $350.42, with the
      Size/Color option ids on line 3.
- [x] `wishlist.json` — genuinely empty.
- [x] `listings.json` — **121** captured listings (48 searches) with source
      ordering, `totalCount`, sorter/limiter options, filter buckets and current
      filter chips.
- [x] `homepage.json`, `searchTerms.json`, `storeConfig.json`.

---

## Verification Before Calling It Done

- [x] Every one of the 45 task start URLs in `assets/dumps/task_urls.txt`
      resolves to a non-404 page in the mock.
- [x] `/go?sid=` `state_diff` covers: add/remove/update cart, place order,
      reorder, add/remove wishlist, submit review, save address, set default
      address, newsletter toggle, contact submit, compare add/remove.
- [x] Two sids mutate independently; `reset` restores the initial state.
- [x] Zero runtime network calls after a full click-through (DevTools network
      panel empty).
- [x] Side-by-side against the live site on: home, a category with filters, a
      search result, a PDP with options and reviews, the cart, the order grid,
      an order view, and the account dashboard.
- [x] `npm run build` **and** `npm run preview` both serve the state API.

---

## Out of Scope

- Login / logout / registration / password reset — the app boots as
  `emma.lopez@gmail.com` (Emma Lopez), per the migration contract.
- Real Elasticsearch, Redis, Varnish, cron, mail — search and filtering are
  client-side over the seed plus the captured `listings.json`.
- Magento's EAV machinery, indexers, and the `/rest`, `/graphql`, `/soap` APIs.
- `/media` and `/static` asset pipelines — the mock ships its own images.
- Multi-store / multi-currency / tax engines — one store, USD, tax always $0.
- Configurable products and swatches — **this dataset has none**; variants are
  simple-product custom options.
- The Magento admin panel — that is `webarena_shopping_admin_mock`.

---

## VisualWebArena

> Added by the plan agent, 2026-08-08. Full analysis: `VWA.md`.
> Anchors: `assets/task_anchors_vwa.{json,md}` — regenerate with
> `python3 shared/extract-task-anchors-vwa.py --site shopping`.
>
> Scope: the **479 tasks** in `/webarena/visualwebarena.jsonl` whose `web_name`
> includes `shopping`. This is a separate contract from `webarena.jsonl` (192
> tasks), which the mock already satisfies. Nothing here supersedes the work
> above.
>
> Headline (round 4, as written): the DOM is close, the **data is the wall**.
> 129 / 146 anchored SKUs, 67 / 81 anchored product URLs and 187 / 207 anchored
> product names are absent from the seed — roughly 60 % of the 479 fail on data
> alone. Image coverage is already 100 % (1105 / 1105) and must stay there.
>
> ---
>
> **RECONCILED round 11 (2026-08-09)** — `AUDIT.part-todo-reconcile.md`.
> Every item below was re-checked against the **container DB and the live
> logged-in source in a real browser**, not against a dev report. **20 of 21 are
> genuinely done and are ticked with the evidence inline; 1 is genuinely not.**
> The data wall is gone: 146/146 anchored SKUs, 89/89 anchored product routes,
> 0 unmatched anchored product names, 11 358 products all verified field-for-field
> against `catalog_product_entity`, 0/86 anchored categories empty, and 86/86 with
> the source's true cheapest *and* dearest product seeded.
> **Still open: `.fotorama__stage__frame` (VWA P2 list, reported P1) — 7 tasks.**
> This is the one thing blocking an honest "migration complete".
>
> **Never invent data.** Every product, price, name, description and image comes
> out of the `shopping` container. Extraction recipes: `VWA.md` §4.3. The
> container and the live site are READ-ONLY.

### VWA P0 — blocks whole evaluator families

- [x] Backfill the 129 missing anchored SKUs / 67 missing product URLs / 187
      missing product names, each with its `.0.jpg`/`.1.jpg` gallery copied from
      the container. `src/data/products.json`, `src/data/productDescriptions.json`,
      `public/media/catalog/product/`. Recipes `VWA.md` §4.3. Unblocks ~181 tasks.
      (round 11: 146/146 anchored SKUs and 89/89 anchored product routes resolve
      in `src/data/products.json`; 0 of 229 long anchored name strings unmatched;
      the 6 "missing" url_keys the §4.3 recipe reports are top-level *categories*
      and are all present in `categories.json`. All **11 358** seeded products
      compared field-for-field against a 104 368-row `catalog_product_entity`
      dump — 0 entity_id/sku/name/url_key/price mismatches. 0 missing image files;
      225/225 anchored-SKU galleries position-identical to
      `catalog_product_entity_media_gallery`.)
- [x] Deepen the 86 anchored categories so "least/most expensive X in category Y"
      resolves to the same product as the source. 14 anchored categories have
      **zero** seeded products (worst: `grocery-gourmet-food/breads-bakery/cookies`,
      5 tasks, 0 vs 943 in source). Seed each category's true cheapest and most
      expensive items, not just the head of the default ordering.
      `src/data/products.json`, `src/data/categories.json`. See `VWA.md` §4.1-4.2.
      (round 11: 0 of 86 anchored categories empty, 1 339 → 16 686 seeded products
      in them; against a live 306 176-row category→sku→price dump the mock's
      cheapest SKU matches the source's in **86/86** and the dearest in **86/86**.)
- [x] Prove checkout → latest-order end to end: a real checkout mints an order
      whose id exceeds every seeded id, it appears in `/sales/order/history/`, and
      `/sales/order/view/order_id/<new>/` renders a **populated**
      `.order-details-items.ordered` containing the SKU, product name, chosen
      options and totals, and survives a fresh page load.
      `src/pages/CheckoutPage.jsx`, `src/pages/CheckoutSuccessPage.jsx`,
      `src/pages/OrderViewPage.jsx`, `src/context/`. Gates **117 tasks**
      (`func:shopping_get_latest_order_url()`).
      (round 11, driven in chromium: Place Order → `/checkout/onepage/success/`
      "Your order number is: 000000190" — 190 > max seeded 189 — top row of
      `/sales/order/history/`; `/sales/order/view/order_id/190/`
      `.order-details-items.ordered` = 631 chars with SKU `B087QSCXGT`, name,
      `Ordered1`, Grand Total, and 631 chars again after a hard reload.)
- [x] PDP price DOM: wrap the price in the source's full chain —
      `div.product-info-price > div.price-box.price-final_price[data-product-id] >
      span.price-container.price-final_price.tax.weee >
      span#product-price-<id>.price-wrapper[data-price-amount] > span.price`.
      The mock currently renders only `div.product-info-price > span.price`, so the
      anchor selector returns `null`. `src/pages/ProductPage.jsx:317`. See `VWA.md` §2.4.
      (round 11: `src/pages/ProductPage.jsx:532-556`. VWA's anchor selector
      `#maincontent > div.columns > div > div.product-info-main > div.product-info-price
      > div.price-box.price-final_price > span > span` on
      `/quoizel-tf9404m-grove-park-tiffany-multi-color-floor-lamp.html` returns
      outerHTML **byte-identical to the live source**, trailing space in
      `class="price-wrapper "` included.)
- [x] PDP Brand / Manufacturer: re-extract descriptions preserving the embedded
      `<table id="productDetails_detailBullets_sections1">` markup (0 of 1105
      current descriptions contain it) and render the description as HTML, so
      `func:shopping_get_product_attributes(__page__, 'manufacturer |OR| brand name')`
      can read it. Keep the U+200E mark before each value.
      `src/data/productDescriptions.json`, `src/pages/ProductPage.jsx`.
      (round 11: **11 358 / 11 358** descriptions contain the table, 0 empty, so
      the `No additional information…` fallback at `ProductPage.jsx:769` cannot
      fire; 5 ids sampled against `catalog_product_entity_text` match with U+200E
      intact; PDP renders `table#productDetails_detailBullets_sections1` →
      `Brand ‎Quoizel | Manufacturer ‎Quoizel | …`.)
- [x] Checkout sidebar DOM: set `id="opc-sidebar"` (currently only a class) and
      restructure to `#opc-sidebar > div.opc-block-summary > div.items-in-cart >
      div.content.minicart-items > div > ol.minicart-items > li.product-item`.
      Render the `<ol>` unconditionally — collapse with CSS, never unmount.
      `src/pages/CheckoutPage.jsx:56`. 4 tasks.
      (round 11: `src/pages/CheckoutPage.jsx:271-320`. `#opc-sidebar` → 1; the full
      chain → 3 `li.product-item`; VWA's literal
      `#opc-sidebar > div.opc-block-summary > div > div.content.minicart-items > div > ol`
      → 1; still 3 `li` after collapsing the block, so the `<ol>` is CSS-hidden,
      not unmounted.)
- [x] Cart row DOM: `id="shopping-cart-table"` on the table, `.item-info` on each
      line-item row, and selected options as `td.col.item > div > dl > dd` in
      source order (3 tasks use `dd:nth-child(4)`). `src/pages/CartPage.jsx`.
      8 of the 104 cart tasks depend on this; the other 96 assert page text only.
      (round 11: `src/pages/CartPage.jsx:102-159`. `#shopping-cart-table` present,
      `tr.item-info` → 3, `td.col.item > div > dl > dd` → `["Large","Blue"]` with
      `dt` → `["Size","Color"]`, and `dd:nth-child(4)` → `["Blue"]`.)
- [x] `/checkout/cart/` with a trailing slash must resolve to the cart, not 404 or
      redirect-strip. 6 tasks assert it directly. `src/App.jsx:227`.
      (round 11: both `/checkout/cart?sid=` and `/checkout/cart/?sid=` cold-load to
      `h1 = "Shopping Cart"` with `#shopping-cart-table` present and the URL
      unchanged.)

### VWA P1 — narrows individual task families

- [x] Order item options: the option chosen at add-to-cart time must survive into
      the order and render inside `dl.item-options` (e.g. `Color: Red`).
      `src/pages/OrderViewPage.jsx:29`. 4 `shopping_get_order_product_option` tasks
      plus ~15 that `must_include` a bare colour/size word.
      (round 11: on order **190**, minted by a live checkout,
      `.order-details-items.ordered dl.item-options` → `["Size Large Color Blue"]`
      — the options picked at add-to-cart time.)
- [x] `OrderPrintPage.jsx:27` also carries `.order-details-items.ordered`. Confirm
      route separation so `document.querySelector` never picks the print variant.
      (round 11: `/sales/order/view/order_id/190/` has exactly **1**
      `.order-details-items.ordered`; `/sales/order/print/order_id/190/` is a
      separate route with its own single copy, `h1 = "Order # 000000190"`.)
- [x] PDP title chain: `#maincontent > div.page-title-wrapper.product > h1 > span`
      — note `page-title-wrapper` is a **direct child of `#maincontent`** in the
      source, not inside `div.columns`. `src/pages/ProductPage.jsx`. 6 tasks.
      (round 11: `src/pages/ProductPage.jsx:448-450`; the exact lambda returns
      `"SUNSITT 3-Piece Wicker Outdoor Bistro Table Set …"`.)
- [x] Address selectors: `.box-address-shipping`, `.box-address-billing >
      div.box-content > address > a` (evaluated as `.outerText.substring(0, 3)`,
      an area-code check on the phone link), `.box-order-shipping-address`, and the
      dashboard `.block-dashboard-addresses > .block-content >
      .box-shipping-address > .box-content > address`. Reproduce
      `San Mateo,  California, 94010` **including the double space**.
      `src/pages/AddressBookPage.jsx`, `AccountDashboard.jsx`, `OrderViewPage.jsx`.
      7 tasks.
      (round 11: all **6** selectors — the 4 above plus the dashboard billing box
      and the full `#maincontent > … > div.box.box-order-shipping-address > div >
      address` chain — return `outerText` **byte-identical to the live source** on
      `/customer/account/`, `/customer/address/` and
      `/sales/order/view/order_id/180/`; phone is an `<a>` whose first 3 chars are
      `650`. ⚠ **The double space is HTML-source only**: every one of these
      evaluators reads rendered `outerText`/`textContent`, and the live source's
      own rendered value is the single-spaced `San Mateo, California, 94010` —
      emitting a literal double space would break the `must_include` strings.
      Ticked on source-parity of the rendered value.)
- [x] `/checkout/#payment` directly navigable — landing on that URL opens the
      payment step on a hard load and the hash survives the `?sid=` handling.
      `src/pages/CheckoutPage.jsx:20`. 4 tasks.
      (round 11: hard load of `/checkout/?sid=tr_b2#payment` → `location.hash ===
      '#payment'`, `sid` preserved, `#payment` visible, `Place Order` rendered at
      52 px.)
- [x] Compare list: adding from a category listing and from a PDP both put the
      product **name** into `/catalog/product_compare` text, and the comparison
      survives navigation. `src/pages/ComparePage.jsx`. 4 tasks.
      (round 11: added from a tile on
      `/beauty-personal-care/oral-care/toothbrushes-accessories.html` and from the
      PDP of id 34309 — `/catalog/product_compare/index/` contains **both** names,
      and still does after navigating to `/` and back.)
- [x] Cart `must_exclude`: removing an item removes its name from the DOM, not just
      zeroes the qty. `src/pages/CartPage.jsx`. 2 tasks.
      (round 11: `a.action-delete` on the Uttermost lamp → its name is absent from
      both `document.body.innerText` **and** `page.content()`, rows 3 → 2, and it
      stays absent after a reload.)
- [x] Review evaluators: `src/data/reviews.json` must cover the SKUs named by the
      18 review tasks (`B09PQ6G5WL`, `B07SYHF5R2`, …), and a review submitted in the
      mock must become the newest for that SKU with author, rating and text all
      readable from the PDP DOM. `src/pages/ProductPage.jsx`.
      (round 11: review counts for all **9** named SKUs match the container
      exactly — `B00BH4V6HE` 3/3, `B097YHDSVG` 3/3, the other seven 0/0, i.e. the
      zeros are the source's own state and those tasks require the agent to write
      the review. Submitting on a 0-review SKU (34309) gives 0 → 1 with
      `Review by AuditBot`, `rating-result title="100%"`, body text, surviving a
      reload and appearing on `/review/customer/`; on a 3-review SKU (77962) it
      goes 3 → 4 and the new review is **first**, so
      `shopping_get_sku_latest_review_*` reads the agent's, not a seeded one.)
- [x] Deep pagination: 93 anchor routes carry a `?p=` beyond what the seed can
      produce (e.g. `home-kitchen/wall-art/posters-prints.html?p=23` needs 23 pages,
      the mock has 1). Either seed to depth or record them explicitly as out of
      reach — do not silently renumber pages. See `VWA.md` §4.2.
      (round 11: **seeded to depth**, not deferred. All **90** paginated anchor
      routes cold-loaded in chromium: 90/90 honour the requested page with real
      products, 0 silently renumbered to page 1, 0 empty states —
      `posters-prints.html?p=23` → page 23, `snack-foods.html?p=33` → `Items
      385-396 of 3549`. An 18-route toolbar-amount spot-check against the live
      source: **17/18 identical**; the 1 difference is `product_list_limit=15`,
      logged as TR-P2-01 in `AUDIT.part-todo-reconcile.md`.)

### VWA P2 — depth

- [x] Keep image coverage at 100 % as products are added — every new product ships
      with its real gallery files from the container. `public/media/catalog/product/`.
      (round 11: 11 358 / 11 358 primary images and **every** gallery entry of
      every product resolve on disk — 0 missing, 0 broken; the 225 anchored SKUs'
      galleries are position-identical to
      `catalog_product_entity_media_gallery`.)

- [ ] **NOT DONE — see `AUDIT.part-todo-reconcile.md` § NOT-DONE-1.**
      The 21 `page_image_query` tasks score a screenshot of the finished page
      (usually cart, wishlist or order view). Those views must render real product
      thumbnails, not blank boxes.
      **Reported priority: P1** (this section is headed P2, but a named evaluator
      selector resolving to `null` was treated as P0 elsewhere in this list for 3
      and 4 tasks; this is 7).
      What is verified good: the compare page renders `.product-image-photo`
      (2 nodes, 240×300, real JPEGs), and the wishlist grid renders a real 500 px
      JPEG. `.products-grid .wishlist .product-image-photo` returns 0 on the mock
      **and on the source** — the container's own
      `module-wishlist/.../item/list.phtml:12` emits a single
      `<div class="products-grid wishlist">`, so that descendant selector can
      never match on either side. Do **not** "fix" that one.
      **What remains: `.fotorama__stage__frame` does not exist in the mock — 7
      tasks name it as `eval_image_class`.** Side by side on
      `/catalog/product/view/id/34309/`, the source's `div.product.media` carries
      `.gallery-placeholder` ×1, `.fotorama` ×1, `.fotorama__stage` ×1,
      `.fotorama__stage__frame` ×2 (707×707), `.fotorama__img` ×2 (700×700),
      `.fotorama__nav__frame` ×2 (92×94); the mock emits **0** of every one of
      them, using `gallery-main` / `gallery-thumbs` instead. The images themselves
      are correct (3 real `<img>`, `naturalWidth` 500) — this is a class-naming and
      nesting change, not a visual one, and `src/styles/globals.css:971-994`
      already documents and reproduces the source's fotorama box metrics.
      `src/pages/ProductPage.jsx` (the `div.product.media` gallery block).

- [x] Leave `src/data/wishlist.json` empty (`[]`) — all 57 wishlist tasks add their
      own items; the source wishlist is empty for Emma Lopez too.
      (round 11: `src/data/wishlist.json` is `{"items": []}`; the mock still
      renders `.products-grid.wishlist` with a real JPEG once an item is added.)
- [x] Browser-diff the items marked *verify* in `VWA.md` §2 — those DOM claims come
      from reading JSX, not from a running browser.
      (round 11: every §2 *verify* item driven in real chromium against the live
      logged-in source — §2.1 `Ordered`/qty markup
      `td.col.qty > ul.items-qty > li.item > span.title + span.content` matches the
      source modulo whitespace, §2.1 print separation, §2.1 `dl.item-options`,
      §2.3 cart chain, §2.4 price chain + `#maincontent > div.columns > div >
      div.product-info-main` ancestor + description-fallback frequency, §2.5
      `#opc-sidebar` + `/checkout/#payment`, §2.6 four address chains, §2.7
      compare, §2.8 latest-order end to end. Full table in
      `AUDIT.part-todo-reconcile.md` § P2-21.)
