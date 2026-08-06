# One Stop Market — Per-View UI Reference

> Captured from the live container at 1440×900.
> Screenshots: `screenshots/reference/*.png` (36 captures).
> Raw HTML: `html/*.html` (36 pages) — read these for exact class names and copy.
> Full listing-HTML corpus (121 pages, gitignored): `dumps/listings-html/`.
>
> Every string in `"quotes"` below is verbatim from the source DOM. Evaluators
> string-match rendered page text, so reproduce them character for character
> (including the apostrophes in `Search results for: 'usb wifi'` and
> `Kids' Bedding`).

---

## 0. Global chrome (every page)

Three stacked bands above the content, one below.

**Panel bar** (`.panel.wrapper`, 41 px tall, white, 1 px bottom rule)
Right-aligned links in this order: `My Account` · `My Wish List` · `Sign Out`,
then the welcome text `Welcome to One Stop Market` in plain black (not a link).
On the far left, visually hidden until focused: `Skip to Content`, `Toggle Nav`.
Above everything, two cookie/JS warning strings exist in the DOM but are hidden:
`"The store will not work correctly when cookies are disabled."` and
`"JavaScript seems to be disabled in your browser."`

**Header** (`.header.content`, 87 px, `padding: 30px 20px 0`)
- Left: the wordmark `One Stop Market`, 200 × 27, links to `/`.
- Right: search input `placeholder="Search entire store here..."` (250 × 32) with
  a magnifier button inside on the right; below it the `Advanced Search` link;
  to its right the cart icon with a numeric badge (**3** on boot).
- Typing ≥ 3 chars in the search box opens an autocomplete list of previous
  search terms with their result counts (see `36-search-autocomplete.png`).
- Clicking the cart icon opens the **mini-cart** dropdown: `My Cart`, the 3 line
  items with thumbnail / name / qty stepper / price, `Subtotal $350.42`,
  a `Proceed to Checkout` primary button and a `View and Edit Cart` link.

**Nav band** (`.nav-sections`, full-bleed `#f5f5f5`, wraps to two rows at 1440 px)
12 top-level categories in `position` order:
`Beauty & Personal Care`, `Sports & Outdoors`, `Clothing, Shoes & Jewelry`,
`Home & Kitchen`, `Office Products`, `Tools & Home Improvement`,
`Health & Household`, `Patio, Lawn & Garden`, `Electronics`,
`Cell Phones & Accessories`, `Video Games`, `Grocery & Gourmet Food`.
Each has a `▾` caret. Hover opens a **single-column white flyout** (1 px `#d1d1d1`
border, ~230 px wide) listing the level-3 children, each with a `›` if it has
children of its own (see `32-nav-megamenu-open.png`). Hovering a child opens a
second flyout to its right. The whole tree is present in the DOM at page load.

**Footer** (310 px)
Left column of links: `Privacy and Cookie Policy`, `Search Terms`,
`Advanced Search`, `Contact Us` — the current page's link renders as bold black
text instead of a blue link. Right: newsletter box
`placeholder="Enter your email address"` + `Subscribe` button.
Below: `Copyright © 2013-present Magento, Inc. All rights reserved.` and
`Help Us Keep Magento Healthy` + `Report All Bugs` link.

**Sidebar blocks** appear on most non-home pages under the main sidebar content:
- `Compare Products` → `You have no items to compare.`
- `My Wish List` → `You have no items in your wish list.`
- On the 404 page only, also `Recently Ordered` → `Last Ordered Items`.

---

## 1. Home — `/` (`01-home.png`, `34-home-page2.png`)

No sidebar; the content column is full 1240 px wide.

- `<h1>One Stop Market</h1>` (40 px / 300).
- Block title `Product Showcases` (18 px bold).
- **5-column** product grid (the only 5-col grid on the site — every other grid
  is 4-col because of the sidebar). 12 tiles per page, 24 total.
- Tile: image (240 × 300 box) → name (blue-on-hover, 14 px) → star widget +
  `N Reviews` link (omitted entirely when the product has no reviews) → price
  (14 px bold) → `Add to Cart` primary button + heart icon + compare icon.
- Footer of the block: `Items 1 to 12 of 24 total`, then a pager `1 2 ›`.
- **The pager param is `pbaocw`, not `p`** — `/?p=2` silently returns page 1.

## 2. Category listing — `/<url_path>.html` (`02`, `03`, `04`, `05`, `06`, `29`, `30`, `35`)

- Breadcrumbs: `Home › Electronics › Headphones` (12 px; the last crumb is plain
  grey text, not a link).
- `<h1>` = the category name.
- **Left sidebar, 207 px** — `Shop By` (18 px bold), then subtitle
  `Shopping Options`, then one `<dt>/<dd>` pair per filter:
  - `Category` → child categories with counts, e.g. `Over-Ear Headphones (148)`.
    Each link is `?cat=<id>` appended to the *current* URL.
  - `Price` → computed buckets with counts, e.g. `$0.00 - $999.99 (628)`,
    `$1,000.00 and above (3)`. Bucket width adapts to the filtered range — see
    `data_model.md` §9.
  When a filter is active a `Now Shopping by` block appears above `Shop By` with
  one chip per active filter (`Price  $0.00 - $9.99  ✕`) and a `Clear All` link.
- **Toolbar** (above the grid): grid/list view toggle (two icon buttons),
  `Items 1-12 of 631`, and on the right `Sort By [Position ▾]` plus a
  direction arrow button (`title="Set Descending Direction"` when currently asc).
- **4-column grid**, same tile anatomy as §1.
- **Below the grid**: pager `1 2 3 4 5 ›` on the left, `Show [12 ▾] per page` on
  the right. `?p=2` → `Items 13-24 of 631`.
- List view (`?product_list_mode=list`, `35-category-list-view.png`): one product
  per row, image left, name/rating/price/description right, actions in a column.

## 3. Search results — `/catalogsearch/result/?q=…` (`07`, `08`, `09`)

Same skeleton as §2 with four differences:

1. `<h1>` and the last breadcrumb are `Search results for: 'usb wifi'` (straight
   single quotes around the term, term lower-cased exactly as submitted).
2. The `Sort By` select is `Relevance / Product Name / Price` with **Relevance
   selected**; category pages have `Position / Product Name / Price`.
3. The `Shop By` panel is present only when the result set is large enough to
   have facets; a 1-result page shows only the `Compare Products` /
   `My Wish List` sidebar blocks (`09-search-no-results.png`).
4. The header search input stays populated with the query.

Note: Magento's search here is fuzzy — a nonsense query like `asdfghjkl` still
returns `1 Item`, not an empty state. Reproduce that from `listings.json` rather
than inventing an empty-results screen.

## 4. Advanced search — `/catalogsearch/advanced/` (`10-advanced-search.png`)

`<h1>Advanced Search</h1>` over a `Catalog Advanced Search` fieldset with
per-attribute inputs (Product Name, SKU, Description, Short Description, Price
from/to, Color, Manufacturer) and a `Search` primary button. Submits to
`/catalogsearch/advanced/result/` → `<h1>Advanced Search Results</h1>`.

## 5. Product detail — `/<url_key>.html` (`11`, `12`, `13`, `31`)

- Breadcrumb `Home › <full product name>`.
- `<h1>` = the full product name (40 px / 300, wraps to 3 lines routinely).
- **Left ~55 %**: main image with `‹ ›` arrows, thumbnail strip below (the active
  thumbnail gets a 2 px orange outline).
- **Right ~45 %**:
  - `IN STOCK` (bold) · `SKU` label + grey SKU value on one line.
  - Star widget · `12 Reviews` link (jumps to `#reviews`) · `Add Your Review` link.
  - Price, 18 px bold.
  - One labelled radio group per custom option, e.g. `Color *` with
    `Black & Blue / Black & Gold / Black & Red / White & Gold / White & Rose Gold`.
    The `*` is red and the group is required — submitting without a selection
    shows `This is a required field.` under the group and blocks the add.
  - `Qty` numeric input (52 × 52) + `Add to Cart` primary button (137 × 52).
  - Secondary row: `Add to Wish List` · `Add to Compare` (11 px, grey buttons).
- **Tab strip** below: `Details` | `Reviews (12)`.
  - `Details` renders the description HTML — typically an `<h2>Product Quick
    Look</h2>` with a `<ul>` of feature bullets, then a two-column spec table
    (`Package Dimensions`, `Item Weight`, `Manufacturer`, `Batteries`,
    `Date First Available`).
  - `Reviews (N)` (`31-product-reviews-tab.png`) loads via
    `/review/product/listAjax/id/<id>/` and renders:
    - `Customer Reviews` heading;
    - per review: `<h3>` title, then a line `Rating ★★★★★ <review body>`,
      then `Review by <nickname>`, then `Posted on 4/20/23`;
    - 10 per page with a `1 2 ›` pager;
    - then `You're reviewing: <product name>` and the submit form:
      `Your Rating *` (5 radio stars), `Nickname *`, `Summary *`, `Review *`,
      `Submit Review` button.
- Successful add-to-cart shows a green message bar at the top of the page:
  `You added <product name> to your shopping cart.` and the cart badge increments.

## 6. Cart — `/checkout/cart/` (`14-cart.png`)

- `<h1>Shopping Cart</h1>`, no sidebar.
- Item table, columns `Item | Price | Qty | Subtotal`. Each row: thumbnail (left,
  ~100 px), product name as a link, selected options rendered under the name as
  `Size: Large` / `Color: Blue` (bold label, plain value), a qty text input, and
  a row of three secondary buttons `Move to Wishlist` `Edit` `Remove item`.
- Bottom-left `‹ Continue Shopping`, bottom-right `⟳ Update Shopping Cart`.
- **Right rail** `Summary` panel (285 px, `#f5f5f5`): collapsible
  `Estimate Shipping and Tax`, then `Subtotal $350.42`, `Order Total $350.42`
  (bold), collapsible `Apply Discount Code`, a full-width `Proceed to Checkout`
  primary button, and a `Check Out with Multiple Addresses` link.
- Empty state (not seeded, but reachable after removing all items):
  `You have no items in your shopping cart.`

## 7. Checkout — `/checkout/` (`28-checkout.png`)

Two-step accordion with a progress bar `Shipping` → `Review & Payments`.
Step 1 (`#shipping`): the saved address rendered as a selectable card,
`+ New Address` button, and a `Shipping Methods` radio table
(`Flat Rate — Fixed — $5.00`), then a `Next` primary button.
Step 2 (`#payment`): `Payment Method` = `Check / Money order`, an Order Summary
rail, and a `Place Order` primary button → `/checkout/onepage/success/` with
`Thank you for your purchase!` and the new increment id.

> Recon note: I did **not** click `Next` or `Place Order` on the live site — that
> would have written to the benchmark instance's quote. Step 2 is described from
> the checkout DOM and Magento's stock two-step layout; flagged in `SOURCE.md`.

## 8. My Account dashboard — `/customer/account/` (`15-account-dashboard.png`)

**Left sidebar, 252 px** — the account nav, in this exact order with two hairline
separators:

```
My Account                 ← current row: black, 600 weight, 3px #ff5501 left marker
My Orders
My Downloadable Products
My Wish List
───────────────────────────
Address Book
Account Information
Stored Payment Methods
───────────────────────────
My Product Reviews
Newsletter Subscriptions
```

**Main column**:
- `<h1>My Account</h1>`
- `Account Information` (two columns):
  left `Contact Information` → `Emma Lopez`, `emma.lopez@gmail.com`,
  `Edit` `Change Password` links;
  right `Newsletters` → `You aren't subscribed to our newsletter.` + `Edit`.
- `Address Book`  `Manage Addresses` — two columns
  `Default Billing Address` / `Default Shipping Address`, each printing
  `Emma Lopez / 101 S San Mateo Dr / San Mateo, California, 94010 /
  United States / T: 6505551212` and an `Edit Address` link.
- `Recent Orders`  `View All` — the 5 newest orders in a table
  `Order # | Date | Ship To | Order Total | Status | Action(View Order, Reorder)`.

## 9. My Orders — `/sales/order/history/` (`19-order-history.png`)

`<h1>My Orders</h1>`, same account sidebar. Table columns
`Order # | Date | Order Total | Status | Action`. Action cell holds two links,
`View Order` and `Reorder`. Rows sorted **newest first by date**, 10 per page.
Footer: `Items 1 to 10 of 37 total` on the left, pager `1 2 3 4 ›` centre,
`Show [10 ▾] per page` right.
Dates print as `M/D/YY` in **America/New_York** — order 170's stored
`2023-05-18 03:39:44` UTC prints as `5/17/23`.

## 10. Order view — `/sales/order/view/order_id/:id/` (`20`, `21`)

- `<h1>Order # 000000180</h1>`
- Status word on its own line (`Complete` / `Canceled` / `Pending`), then
  `Order Date: March 11, 2023` (long month form).
- `Reorder` link on the left, `Print Order` on the right.
- Tab strip with the single active tab `Items Ordered`.
- `Items Ordered` table: `Product Name | SKU | Price | Qty | Subtotal`.
  Selected custom options print under the name as a bold label on one line and
  the value on the next (`Color` / `Black`). The Qty cell prints `Ordered: 1`.
- Right-aligned totals block: `Subtotal`, `Shipping & Handling`,
  `Grand Total` (bold).
- `Order Information` section, two columns:
  left `Shipping Address` then `Billing Address` (same block format as §8, with
  the phone as a `T: 6505551212` tel link);
  right `Shipping Method` → `Flat Rate - Fixed`, then `Payment Method` →
  `Check / Money order`.

## 11. Address Book — `/customer/address/` (`17`) and edit (`18`)

`<h1>Address Book</h1>` with an `Add New Address` primary button, then
`Default Addresses` (the two cards, each with `Change Billing Address` /
`Change Shipping Address` links) and `Additional Address Entries` — which for
Emma renders the empty state `You have no other address entries in your address book.`

Edit form (`/customer/address/edit/id/26/`): `<h1>Edit Address</h1>`, fields
`First Name*`, `Last Name*`, `Company`, `Phone Number*`, `Street Address*`
(2 lines), `City*`, `State/Province*` (select), `Zip/Postal Code*`,
`Country*` (select, `United States`), plus checkboxes
`Use as my default billing address` / `Use as my default shipping address`
(both checked and disabled when this is the only address), and a `Save Address`
primary button. Success shows the green bar `You saved the address.`

## 12. Wish List — `/wishlist/` (`22-wishlist.png`)

`<h1>My Wish List</h1>`, empty state `You have no items in your wish list.`
Populated it becomes a 4-column grid of tiles with a comment textarea, a qty
input, `Add to Cart`, an edit pencil and a remove ✕ per tile, plus
`Update Wish List` and `Share Wish List` buttons.

## 13. My Product Reviews — `/review/customer/` (`23-my-reviews.png`)

`<h1>My Product Reviews</h1>`. Seeded empty: `You have submitted no reviews.`
Populated: table `Created | Product Name | Rating | Review` with a `See Details`
link per row.

## 14. My Downloadable Products — `/downloadable/customer/products/` (`24`)

`<h1>My Downloadable Products</h1>`, empty state
`You have not purchased any downloadable products yet.`

## 15. Newsletter Subscriptions — `/newsletter/manage/` (`25`)

`<h1>Newsletter Subscriptions</h1>`, a single checkbox
`General Subscription` (unchecked on boot) and a `Save` primary button.
Saving shows `We have saved your subscription.`

## 16. Contact Us — `/contact/` (`26-contact.png`)

No sidebar; the form sits in a narrow left column. `<h1>Contact Us</h1>`, then
the sub-heading `Write Us` and the lead
`Jot us a note and we'll get back to you as quickly as possible.`
Fields, in order: `Name *` (prefilled `Emma Lopez`), `Email *` (prefilled
`emma.lopez@gmail.com`), `Phone Number`, `What's on your mind? *` (textarea),
then a `Submit` primary button. Success renders the green bar
`Thanks for contacting us with your comments and questions. We'll respond to you very soon.`

**There is no phone number anywhere on this page or in `core_config_data` —
`general/store_information/phone` is NULL.** The WebArena task "Get the customer
service phone number" expects `N/A`. Do not invent one.

## 17. Search Terms — `/search/term/popular/`

`<h1>Search Terms</h1>` and a tag cloud of the 60 most popular queries; each
term's font-size scales with its popularity (the source sets
`element.style.fontSize = '75%'` inline per `<li>`). Each term links to
`/catalogsearch/result/?q=<term>`.

## 18. 404 — any unmatched path (`27-404.png`)

`<h1>Whoops, our bad...</h1>` then:

```
The page you requested was not found, and we have a fine guess why.

If you typed the URL directly, please make sure the spelling is correct.
If you clicked on a link to get here, the link is outdated.

What can you do?
Have no fear, help is near! There are many ways you can get back on track with Magento Store.

Go back to the previous page.
Use the search bar at the top of the page to search for your products.
Follow these links to get you back on track!
Store Home  |  My Account
```

Reached by, among others, the malformed task URL
`/clothing-shoes-jewelry/sport-specific-clothing.html&product_list_order=price`.

---

## Component inventory

| Component | Appears on | Behaviour |
|---|---|---|
| Mega-menu flyout | every page | hover-open, two levels deep, closes on mouseleave |
| Search autocomplete | every page | opens at ≥3 chars, lists prior search terms + result counts |
| Mini-cart dropdown | every page | click the cart icon; qty steppers mutate the cart live |
| Grid/list view toggle | category, search | writes `product_list_mode` |
| Sort select + direction arrow | category, search | writes `product_list_order` / `product_list_dir`; the arrow's title flips between "Set Descending Direction" and "Set Ascending Direction" |
| Per-page limiter | category, search, orders, wishlist | writes `product_list_limit` / `limit` |
| Pager | category, search, home, orders, reviews | writes `p` (`pbaocw` on home) |
| Layered-nav filter list | category, large search results | writes `cat` / `price` |
| "Now Shopping by" chips | category with active filters | each ✕ removes only its own param |
| PDP tab strip | product | `Details` / `Reviews (N)`; Reviews lazily fetched |
| Star rating widget | tiles, PDP, review rows | percentage-width clip, `title="73%"` |
| Required-option radio group | PDP | blocks Add to Cart with `This is a required field.` |
| Qty stepper | PDP, cart, mini-cart, wishlist | plain number input, no +/- buttons |
| Green success message bar | after any successful mutation | `.message-success`, top of `.page-main` |
| Collapsible account nav | all `/customer`, `/sales`, `/wishlist`, `/review/customer` pages | 3 px `#ff5501` marker on the current row |
| Checkout accordion | `/checkout/` | `#shipping` → `#payment` |
