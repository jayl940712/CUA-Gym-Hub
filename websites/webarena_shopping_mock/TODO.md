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
- [x] Sidebar `Recently Ordered` / `Last Ordered Items` block — **not rendered**,
      which matches the source. The markup exists on every account page and the
      404 but ships `class="block-title no-display"` and is only un-hidden by
      Knockout once the `lastordereditems` customer-data section returns items.
      On this container that section answers HTTP 400 ("section source isn't
      supported"), so it is never visible. See `27-404.png` / `15-account-dashboard.png`.
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
