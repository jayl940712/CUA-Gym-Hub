# shopping (One Stop Market) — Route Parity Map

> Source: `http://localhost:7770` → redirects to absolute base `http://10.186.197.203:7770/`
> Container: `shopping` · image `shopping_final_0712:latest` · Magento 2.4 (Luma-derived "blank" theme)
> Discovered by: plan agent, 2026-08-05 (live crawl + `curl` probe of every path below; all returned HTTP 200 unless noted)
> Mock dir: `websites/webarena_shopping_mock/`

Every route below was probed against the live container. `sid` is an **additive**
query param on every mock route and never replaces a source param.

---

## 1. Storefront / Catalog

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 1 | `/` | GET | `/` | Home CMS page: `<h1>One Stop Market</h1>`, "Product Showcases" widget, 5-col grid, 12/page, 24 total | `homepage.json`, `products.json` | P0 | [x] |
| 2 | `/?pbaocw=2` | GET | `/?pbaocw=2` | Home widget page 2 (widget-scoped pager param, **not** `p`) | `homepage.json` | P1 | [x] |
| 3 | `/<url_path>.html` | GET | `/:categoryPath(*).html` | Category listing. `url_path` is the full slash path, e.g. `/electronics/headphones.html`, `/clothing-shoes-jewelry/men/shoes.html`, `/video-games.html` | `categories.json`, `products.json`, `listings.json` | P0 | [x] |
| 4 | `/catalog/category/view/id/:id` | GET | `/catalog/category/view/id/:id` | Same category page, id-addressed (verified 200 for id 60 → "Headphones - Electronics") | `categories.json` | P1 | [x] |
| 5 | `/<url_key>.html` | GET | `/:productUrlKey.html` | Product detail page | `products.json`, `productOptions.json`, `productDescriptions.json`, `reviews.json` | P0 | [x] |
| 6 | `/catalog/product/view/id/:id` | GET | `/catalog/product/view/id/:id` | Same PDP, id-addressed (verified 200 for id 76525) | `products.json` | P1 | [x] |
| 7 | `/review/product/listAjax/id/:id/` | GET (XHR) | `/review/product/listAjax/id/:id` | Review list fragment loaded when the "Reviews (N)" tab is clicked. In the mock render it inline; keep the route resolvable | `reviews.json` | P2 | [x] |
| 8 | `/catalog/product_compare/index/` | GET | `/catalog/product_compare/index/` | `<h1>Compare Products</h1>` (document `<title>` is the different string `Products Comparison List - Magento Commerce`). Empty state: "You have no items to compare." | session state | P2 | [x] |

## 2. Search

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 9 | `/catalogsearch/result/?q=<term>` | GET | same | Search results. Title `Search results for: '<term>'` | `listings.json`, `products.json` | P0 | [x] |
| 10 | `/catalogsearch/result/index/?q=<term>` | GET | same | Identical page; WebArena tasks use **both** spellings — both must resolve | `listings.json` | P0 | [x] |
| 11 | `/catalogsearch/result/?q=<nomatch>` | GET | same | Empty state: "Your search returned no results." + "Related search terms" block | `listings.json` | P1 | [x] |
| 12 | `/catalogsearch/advanced/` | GET | same | Advanced Search form | static | P1 | [x] |
| 13 | `/catalogsearch/advanced/result/?name=…&sku=…&price[from]=…&price[to]=…` | GET | same | "Advanced Search Results" | `products.json` | P2 | [x] |
| 14 | `/search/term/popular/` | GET | same | "Search Terms" tag cloud, font-size scaled by popularity | `searchTerms.json` | P2 | [x] |

## 3. Cart & Checkout

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 15 | `/checkout/cart/` | GET | `/checkout/cart/` | "Shopping Cart" — item table (Item/Price/Qty/Subtotal), per-row Move to Wishlist / Edit / Remove item, Summary box, Proceed to Checkout | `cart.json` | P0 | [x] |
| 16 | `/checkout/cart` (no trailing slash) | GET | same | Same page (task `webarena-*` start URLs use both) | — | P0 | [x] |
| 17 | `/checkout/cart/add/product/:id/` | POST | in-app action | Add to cart from a grid tile or the PDP | mutation | P0 | [x] |
| 18 | `/checkout/cart/configure/id/:itemId/product_id/:productId/` | GET | same | Edit a cart line's custom options (verified 200) | `cart.json`, `productOptions.json` | P2 | [x] |
| 19 | `/checkout/cart/delete/id/:itemId/` | POST | in-app action | Remove item | mutation | P1 | [x] |
| 20 | `/checkout/` | GET | `/checkout/` (`#shipping` → `#payment`) | Two-step accordion checkout: Shipping Address + Shipping Methods, then Review & Payments | `cart.json`, `customer.json` | P1 | [x] |
| 21 | `/checkout/onepage/success/` | GET | same | "Thank you for your purchase!" + new increment id | mutation | P1 | [x] |

## 4. Customer Account (mock boots pre-logged-in as Emma Lopez)

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 22 | `/customer/account/` | GET | same | "My Account" dashboard: Account Information + Address Book summary blocks | `customer.json` | P0 | [x] |
| 23 | `/customer/account/edit/` | GET | same | "Account Information" form (First/Last Name, `Change Email`, `Change Password` checkboxes) | `customer.json` | P1 | [x] |
| 24 | `/customer/account/edit/changepass/1/` | GET | same | Same form with the password fields expanded | `customer.json` | P2 | [x] |
| 25 | `/customer/address/` | GET | same | "Address Book": Default Billing / Default Shipping cards + "Additional Address Entries" table | `customer.json` | P0 | [x] |
| 26 | `/customer/address/edit/id/:addressId/` | GET | same | "Edit Address" form (verified for id 26) | `customer.json` | P0 | [x] |
| 27 | `/customer/address/new/` | GET | same | "Add New Address" form (verified 200) | — | P1 | [x] |
| 28 | `/sales/order/history/` | GET | same | "My Orders" grid: Order # / Date / Order Total / Status / Action(View Order, Reorder). 10 per page, 37 rows, 4 pages | `orders.json` | P0 | [x] |
| 29 | `/sales/order/view/order_id/:id/` | GET | same | "Order # 0000001NN" — status, order date, Reorder / Print Order, Items Ordered table, totals, Order Information (addresses, shipping method, payment method) | `orders.json` | P0 | [x] |
| 30 | `/sales/order/print/order_id/:id/` | GET | same | Print-friendly order view (verified 200) | `orders.json` | P2 | [x] |
| 31 | `/sales/order/reorder/order_id/:id/` | GET | in-app action | Copies the order's items into the cart, redirects to `/checkout/cart/` | mutation | P1 | [x] |
| 32 | `/wishlist/` and `/wishlist/index/index/` | GET | same | "My Wish List". Seeded empty: "You have no items in your wish list." | `wishlist.json` | P0 | [x] |
| 33 | `/wishlist/index/add/product/:id/` | POST | in-app action | Add to wishlist (from grid heart icon or PDP "Add to Wish List") | mutation | P1 | [x] |
| 34 | `/review/customer/` | GET | same | "My Product Reviews". Seeded empty | `reviews.json` (customerId 27) | P1 | [x] |
| 35 | `/review/customer/view/id/:reviewId/` | GET | same | Single submitted review detail | `reviews.json` | P2 | [x] |
| 36 | `/downloadable/customer/products/` | GET | same | "My Downloadable Products". Empty state: "You have not purchased any downloadable products yet." | — | P2 | [x] |
| 37 | `/newsletter/manage/` | GET | same | "Newsletter Subscriptions" — single checkbox "General Subscription" + Save button | `customer.json.newsletterSubscribed` | P1 | [x] |
| 38 | `/customer/account/login/` | GET | — | 302 when already authenticated. **Not migrated** | — | — | — |

## 5. CMS / Static

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 39 | `/contact/` and `/contact` | GET | same | "Contact Us" / "Write Us" form: Name, Email, Phone Number, "What's on your mind?", Submit. Name+Email prefilled for the logged-in customer | `customer.json` | P0 | [x] |
| 40 | `/privacy-policy-cookie-restriction-mode` | GET | same | Privacy and Cookie Policy CMS page | static | P2 | [x] |
| 41 | any unmatched path | GET | `*` | 404 CMS page — `<h1>Whoops, our bad...</h1>` | static | P1 | [x] |
| 42 | `/go` | GET | `/go` | CUA-Gym state endpoint (mock-only, not in source) | state tracker | P0 | [x] |

---

## Query Parameters

### Product listing toolbar (category, search results, advanced-search results)

| Param | Values | Effect | Notes |
|---|---|---|---|
| `product_list_order` | `position` \| `name` \| `price` (+ `relevance` on search pages) | "Sort By" select. Default `position` on category, `relevance` on search | Search pages add a `Relevance` option that category pages do not have |
| `product_list_dir` | `asc` \| `desc` | Sort-direction arrow next to the select. Default `asc` | Toggled by the arrow button, which keeps every other param |
| `product_list_limit` | `12` \| `24` \| `36` | "Show N per page". Default 12 | Verified: `?product_list_limit=24` renders "Items 1 - 24 of 631" |
| `product_list_mode` | `grid` \| `list` | Grid/List view toggle at the top-left of the toolbar | |
| `p` | integer ≥ 1 | Pagination. `?p=2` → "Items 13 - 24 of 631" | Home page uses `pbaocw`, **not** `p` |
| `q` | free text | Search term (search routes only) | Space-encoded as `+` or `%20`; both appear in WebArena task URLs |

### Layered navigation (category + search pages)

| Param | Values | Effect |
|---|---|---|
| `cat` | category id | Filters the current listing to a **descendant category**. Applied on a *parent* page it yields the same result set as visiting the child directly, but the `<h1>` stays the parent's name. Verified: `/clothing-shoes-jewelry.html?cat=145` and `/clothing-shoes-jewelry/men/shoes.html` both render "Items 1 - 12 of 2523" |
| `price` | `<lo>-<hi>`, `<lo>-`, `-<hi>`, or comma-separated stack | Price-bucket filter. Real task URLs include `price=0-100`, `price=200-300`, `price=0-10%2C0-100` (two stacked buckets, intersection semantics), `price=1000-` |

Both render a "Now Shopping by" chip row with a per-filter "Remove This Item" ✕
and a "Clear All" link; each chip's href is the current URL minus that param.

### Other

| Route | Param | Values | Effect |
|---|---|---|---|
| `/` | `pbaocw` | `2` | Home "Product Showcases" widget pager. The token is the widget instance hash and is stable for this deployment |
| `/wishlist/` | `limit` | integer | Wishlist page size (task uses `?limit=50`) |
| `/sales/order/history/` | `p`, `limit` | int | Order grid pagination; default 10/page |
| `/catalogsearch/advanced/result/` | `name`, `sku`, `description`, `price[from]`, `price[to]` | free text / numbers | Advanced search criteria |

### Malformed-URL behaviour worth reproducing

`/clothing-shoes-jewelry/sport-specific-clothing.html&product_list_order=price`
(note the `&` where a `?` belongs — it appears verbatim in a WebArena task start
URL) returns the **404 page**, not the category. The mock's catch-all must do the
same rather than being lenient.

---

## Intentionally Not Migrated

| Source path | Reason |
|---|---|
| `/customer/account/login/`, `/customer/account/logout/`, `/customer/account/create/`, `/customer/account/forgotpassword/` | Mock boots pre-logged-in as `emma.lopez@gmail.com` (migration contract §1) |
| `/customer/account/*` password-change POSTs, `/customer/section/load/` | Server session / private-content machinery |
| `/media/**`, `/static/**` | Magento asset pipeline; the mock ships its own images under `public/` |
| `/checkout/cart/couponPost`, real tax/shipping quote services | Server-side pricing engine — the mock uses the seeded flat-rate values |
| `/rest/**`, `/graphql`, `/soap` | Magento web APIs; no runtime network calls allowed in the mock |
| `/admin/**` | Belongs to the separate `webarena_shopping_admin_mock` migration |

---

## Route Cluster → WebArena Task Mapping

| Task cluster | Routes needed |
|---|---|
| Product search (`webarena` "Open the search results for …") | 9, 10, 11 |
| Search sort/order (`"…listings sorted by ascending price"`) | 9, 10 + `product_list_order`/`product_list_dir` |
| Category browse ("Open the Video Game category page") | 3, 4 |
| Category filter ("filtered to under $100") | 3 + `cat`/`price` |
| Category sort ("most expensive PS4 accessories") | 3 + `product_list_order=price&product_list_dir=desc` |
| Product detail / reviews mining | 5, 6, 7 |
| Add to cart / buy | 5, 15, 17, 20, 21 |
| Reorder a cancelled order | 28, 29, 31, 15, 20, 21 |
| Order history Q&A (spend, statuses, dates) | 28, 29 |
| Wishlist | 5, 32, 33 |
| Address book update | 22, 25, 26, 27 |
| Newsletter subscribe | 37 |
| Contact form / refund request | 39 |
| Write a product review | 5, 7, 34 |
| Customer service phone number | 39 (answer is genuinely absent — see `SOURCE.md`) |
