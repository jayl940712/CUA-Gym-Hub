# shopping (One Stop Market) — Data Model

> Derived from the live MySQL schema inside container `shopping`
> (`mysql -u magentouser -pMyPassword magentodb`), read-only `SELECT` only.
> Raw dumps: `assets/dumps/*.jsonl`. Curation script: `assets/dumps/build_seed.py`.
> Seeds: `src/data/*.json`.

---

## 0. Source scale vs. seeded sample

| Entity | Rows in the container | Rows seeded | Why this many |
|---|---|---|---|
| `catalog_product_entity` | 104 368 | **1 105** | Every product reachable from a WebArena task start URL, every product in Emma's 37 orders, every product in her cart, all 24 home-page showcase products, and the full first page of all 121 captured category/search listings |
| `catalog_category_entity` | 303 | **301** (all except `Root Catalog` id 1 and `Default Category` id 2) | The mega-menu renders the entire tree; you cannot sample it |
| `review` (approved) | 308 939 | **3 080** across 355 products | All reviews for the ~180 "priority" products (task-referenced, ordered, in cart, home, top-3 of every captured search); 12 each for the rest — 12 is the natural count for most products in this dataset |
| `sales_order` (Emma) | 37 | **37** (all) | The order-history task cluster does arithmetic across the whole history; sampling would break it |
| `sales_order_item` (Emma) | 100 | **100** (all) | — |
| `customer_entity` | 27 | **1** (Emma, id 27) | Single-user mock |
| `customer_address_entity` (Emma) | 1 | **1** (id 26) | — |
| `quote_item` (Emma active cart 255) | 3 | **3** | Real pre-existing cart; several tasks say "discard any items in your cart if it is not empty" |
| `wishlist_item` (Emma) | 0 | **0** | Genuinely empty — the source renders "You have no items in your wish list." |
| `search_query` (`display_in_terms=1`) | many | **60** most popular | Backs `/search/term/popular/` |

Product-price span in the seed: **$0.01 – $28 283.99**. 352 of the 1 105 seeded
products carry a rating summary; 424 carry configurable custom options.

---

## 1. Product

**Source:** Magento EAV. `catalog_product_entity` joined against
`catalog_product_entity_{varchar,decimal,int,text}` at `store_id = 0`
(`store_id = 1` for `description` — see the note below), plus
`cataloginventory_stock_item` and `review_entity_summary`.

Attribute ids used (from `eav_attribute` where `entity_type_code='catalog_product'`):
`name`=73, `price`=77, `special_price`=78, `description`=75, `short_description`=76,
`image`=87, `small_image`=88, `thumbnail`=89, `status`=97, `visibility`=99,
`url_key`=121, `weight`=82, `color`=93, `manufacturer`=83.

`src/data/products.json` — array of:

```jsonc
{
  "id": 76525,                       // catalog_product_entity.entity_id — NEVER regenerate
  "sku": "B086GNDL8K",               // real Amazon ASIN used as the SKU
  "typeId": "simple",                // every one of the 1105 seeded products is "simple"
  "name": "6S Wireless Headphones Over Ear,Noise Canceling Hi-Fi Bass Foldable Stereo Wireless Kid Headsets Earbuds with Built-in Mic, Micro SD/TF, FM for iPhone/Samsung/iPad/PC (Black & Gold)",
  "urlKey": "6s-wireless-headphones-over-ear-noise-canceling-hi-fi-bass-foldable-stereo-wireless-kid-headsets-earbuds-with-built-in-mic-micro-sd-tf-fm-for-iphone-samsung-ipad-pc-black-gold",
  "price": 19.99,
  "specialPrice": null,              // non-null on the handful of "sale" products
  "image": "/B/0/B086GNDL8K.1.jpg",  // path suffix, see §Images
  "smallImage": "/B/0/B086GNDL8K.0.jpg",
  "thumbnail":  "/B/0/B086GNDL8K.0.jpg",
  "gallery": ["/B/0/B086GNDL8K.0.jpg", "/B/0/B086GNDL8K.1.jpg"],
  "status": 1,                       // 1 = enabled, 2 = disabled
  "visibility": 4,                   // 4 = Catalog, Search
  "qty": 100,
  "inStock": true,
  "ratingSummary": 80,               // percent 0-100, from review_entity_summary
  "reviewsCount": 12,
  "categoryIds": [2, 11, 60, 210],   // catalog_category_product
  "createdAt": "2023-04-11 17:21:09"
}
```

**Important — `typeId` is always `simple`.** This dataset has **no configurable
products**. Size/Color variants are Magento *custom options* of type `radio` on the
simple product (see §2). Do not build a configurable-product/swatch system.

**Rendering rules taken from the source:**
- `status !== 1` or `visibility < 4` → the product must not appear in listings.
- `specialPrice` present → render the special price as the final price with the
  regular price struck through in `#ff5216`.
- `ratingSummary` drives the star widget as a **percentage width**, not a rounded
  star count (`title="73%"` on the live site).

---

## 2. Product custom options

**Source:** `catalog_product_option` + `catalog_product_option_title` +
`catalog_product_option_type_value` + `catalog_product_option_type_title` +
`catalog_product_option_type_price`.

`src/data/productOptions.json` — object keyed by product id (string):

```jsonc
"10617": [
  { "optionId": 4348, "title": "Size",  "type": "radio", "isRequire": true, "sortOrder": 0,
    "values": [
      { "optionTypeId": 23917, "title": "Small",    "price": 0, "priceType": "fixed" },
      { "optionTypeId": 23919, "title": "Large",    "price": 0, "priceType": "fixed" },
      { "optionTypeId": 23921, "title": "XX-Large", "price": 0, "priceType": "fixed" }
    ] },
  { "optionId": 4349, "title": "Color", "type": "radio", "isRequire": true, "sortOrder": 0,
    "values": [ { "optionTypeId": 23922, "title": "Blue", "price": 0, "priceType": "fixed" }, … ] }
]
```

All 424 option groups are `type: "radio"` and render on the PDP as a labelled
radio list with a red `*` when `isRequire`. Common titles: `Color`, `Size`,
`Style`, `Pattern Name`, `Flavor Name`, `Capacity`. **Add to Cart must block with
a validation message when a required option is unselected** — that is real source
behaviour and several tasks ("Choose any available variant") depend on it.

`optionTypeId` values must be preserved verbatim: cart lines and order lines
reference them (`quote_item_option.option_<optionId> = <optionTypeId>`).

---

## 3. Product description

**Source:** `catalog_product_entity_text` attribute 75 at **`store_id = 1`**.
(At `store_id = 0` every row is the placeholder string
`"This is the description placeholder for the product"` — a trap; use store 1.)

`src/data/productDescriptions.json` — `{ "<productId>": "<html>" }`.

The raw corpus is 16.2 M chars of scraped Amazon markup over 1 105 products
(dumped verbatim to `assets/dumps/descriptions.jsonl`; lengths verified equal to
`CHAR_LENGTH(value)` in the container). `build_seed.py` runs it through
`clean_desc.clean()` and writes **every record in full — there is no length
cap** → 3 508 006 chars / **3.5 MB** of HTML across 1 105 ids, 0 records dropped
or added.

`clean_desc.clean()` is the only thing that removes anything, and it removes
only what would make the mock hit the network (WEBARENA_MIGRATION.md §1):
`<script>/<style>/<noscript>` blocks, CSS `url(…)`/`@import` pointing at an
absolute URL, media elements (`img`, `source`, `link`, `video`, `iframe`, …)
whose fetching attribute holds an absolute URL, and any leftover fetching
attribute with an absolute URL. It then drops the empty `dpx-aplus-*` wrapper
divs and the noisy `data-*`/`class`/`id`/`style` attributes and collapses
whitespace. `src/utils/html.js` re-applies the same rules at render time as a
second layer. **No visible prose is removed** — verified by extracting the
`.product.attribute.description` block from the live source for 47 products
(including 76401, 99660, 18110, 86940, 104499, 2806, 15033) and diffing the
plain-text projection word by word: 47/47 identical, 0 words missing, 0 added.

> **History (AUDIT PARITY-001).** Until 2026-08-05 this step capped each
> description at 600 chars (5 000 for a hand-picked "priority" id list),
> truncating 829 of 1 105 records — often mid-word (76401 kept 597 of 19 819
> chars; 99660 kept only carousel chrome and zero prose). WebArena tasks mine
> description text, so the cap made those unanswerable. Do not reintroduce a
> cap without declaring it in `SOURCE.md`'s gaps.

**Known gaps: none.** All 1 105 products have a non-empty description at
`store_id = 1`; the shortest is 162 chars. Nothing had to be invented or
omitted.

**Cost.** The corpus is imported statically by `src/utils/catalog.js` and never
enters `createInitialData()`, so the `/go` state-diff budget is unaffected —
but it dominates the `seed` JS chunk: 4.58 MB → 6.90 MB raw, 1.22 MB → 1.83 MB
gzipped when the cap was removed.

Typical shape after cleaning:

```html
<div><h2>Product Quick Look</h2><div><div><ul>
  <li><span>♫[ Hi-Fi Bass Sound]:Powerful 57mm stereo driver …</span></li> …
</ul></div></div></div>
```

Many products also carry a two-column spec table (`Package Dimensions`,
`Item Weight`, `Manufacturer`, `Batteries`, `Date First Available`) inside the
same blob — render the description HTML as-is inside the **Details** tab.

---

## 4. Category

**Source:** `catalog_category_entity` + `catalog_category_entity_varchar`
(`name`=45, `url_key`=119, `url_path`=120) + `catalog_category_entity_int`
(`is_active`=46, `include_in_menu`=69), with a `COUNT(*)` over
`catalog_category_product`.

`src/data/categories.json` — array of:

```jsonc
{
  "id": 60, "parentId": 11, "name": "Headphones",
  "urlKey": "headphones", "urlPath": "electronics/headphones",
  "level": 3, "position": 6, "childrenCount": 3,
  "isActive": true, "includeInMenu": true,
  "dbProductCount": 650
}
```

- `level` 2 = the 12 top-level menu categories, 3 = second level, 4 = leaf.
- The 12 top-level categories, in **menu order** (`position`):
  Beauty & Personal Care (3), Sports & Outdoors (4), Clothing, Shoes & Jewelry (5),
  Home & Kitchen (6), Office Products (7), Tools & Home Improvement (8),
  Health & Household (9), Patio, Lawn & Garden (10), Electronics (11),
  Cell Phones & Accessories (12), Video Games (13), Grocery & Gourmet Food (14).
- Category URL = `/` + `urlPath` + `.html`. Also addressable as
  `/catalog/category/view/id/<id>`.

**`dbProductCount` is the raw `catalog_category_product` count and is slightly
higher than the number the storefront prints** (it includes disabled /
not-visible products): cat 60 → DB 650, rendered "of 631"; cat 236 → DB 236,
rendered "of 228". Prefer `listings.json[].totalCount` when a listing was
captured; fall back to `dbProductCount` otherwise, and say so in `SCHEMA.md`.

---

## 5. Review

**Source:** `review` + `review_detail` + `rating_option_vote` (rating id 4 = the
"Rating" star rating; ids 1–3 Quality/Value/Price are unused in this dataset).
Only `status_id = 1` (approved) rows are seeded.

`src/data/reviews.json` — array of:

```jsonc
{
  "reviewId": 289770,
  "productId": 2345,
  "title": "miracle water!",
  "detail": "Yes this is pricey but kind of worth it for the size of the primer …",
  "nickname": "victoria",
  "customerId": null,          // every seeded review is anonymous; Emma (27) has none
  "rating": 5,                 // 1-5, from rating_option_vote.value
  "createdAt": "2023-04-22 03:56:17"
}
```

Rendering (from the live Reviews tab):

- Section heading `Customer Reviews`, 10 reviews per page, pager `1 2 >`.
- Per review: `<h3>` title, then `Rating` label + the star widget + the review
  body on the same line, then `Review by <nickname>`, then `Posted on 4/20/23`
  (M/D/YY, **America/New_York**).
- `product.reviewsCount` / `ratingSummary` come from `review_entity_summary` and
  are what the grid tiles and the PDP header show — keep them consistent with
  the number of seeded reviews for that product where you can, and treat the
  summary values as authoritative when you cannot.
- A submitted review is added with `customerId: 27` and appears on
  `/review/customer/`.

Deliberately kept for depth: product **17500** has 87 reviews (2+ pages of the
review pager); product **17143** has 112 in the source (trimmed to 12 here).

---

## 6. Order

**Source:** `sales_order`, `sales_order_item`, `sales_order_address`,
`sales_order_payment`.

`src/data/orders.json` — array, newest `entityId` first:

```jsonc
{
  "entityId": 180,
  "incrementId": "000000180",       // what the UI prints: "Order # 000000180"
  "status": "complete",             // complete | canceled | pending  (only these three exist)
  "state": "complete",
  "createdAt": "2023-03-11 14:44:12",   // UTC — render in America/New_York
  "grandTotal": 65.32, "subtotal": 40.32,
  "shippingAmount": 25, "taxAmount": 0, "discountAmount": 0,
  "totalQtyOrdered": 5,
  "shippingDescription": "Flat Rate - Fixed",
  "shippingMethod": "flatrate_flatrate",
  "paymentMethod": "checkmo", "paymentTitle": "Check / Money order",
  "customerEmail": "emma.lopez@gmail.com",
  "billingAddress":  { "firstname": "Emma", "lastname": "Lopez",
                       "street": "101 S San Mateo Dr", "city": "San Mateo",
                       "region": "California", "postcode": "94010",
                       "country_id": "US", "telephone": "6505551212",
                       "company": null, "email": null },
  "shippingAddress": { … same … },
  "items": [
    { "itemId": 508, "productId": 87456, "sku": "B087QJN9W1",
      "name": "IDweel iPhone SE 2020 Case with Tempered Glass Screen Protector …",
      "price": 12.99, "qtyOrdered": 1, "rowTotal": 12.99, "productType": "simple",
      "options": [ { "label": "Color", "value": "Black" } ] }
  ]
}
```

Facts the order-history task cluster depends on — **verified against the seed**:

| Fact | Value |
|---|---|
| Order id range | 148 – 189 (37 orders; 186 belongs to a different customer and is absent) |
| Status counts | complete 25, canceled 9, pending 3 |
| Date range | 2022-03-02 11:01:12 → 2023-05-18 03:39:44 (UTC) |
| First purchase | order 148-era, `2022-03-02` |
| Most recent order overall | `000000170`, **canceled**, 5/17/23 (2023-05-18 03:39 UTC → 5/17 EDT) |
| Most recent complete | `000000180`, $65.32, 3/11/23 |
| Most recent pending | `000000189`, $754.99, 5/2/23 |
| Most recent canceled | `000000170`, $365.42, 5/17/23 |
| "past year" (2022-06-12 → 2023-06-12), complete | 21 orders, **$6 560.69** — matches the WebArena reference answer exactly |
| "past four months" (2023-02-12 → 2023-06-12), complete | 3 orders, **$845.49** — matches exactly |
| Statuses that do **not** exist | processing, on hold, out for delivery (the corresponding tasks expect "N/A") |
| Payment / shipping | every order: `Check / Money order`, `Flat Rate - Fixed` |

**Timezone is load-bearing.** `general/locale/timezone = America/New_York`.
Order 170 stores `2023-05-18 03:39:44` but the order grid prints `5/17/23`.
Render every stored UTC timestamp in `America/New_York` with Magento's short
format (`M/D/YY` in grids, `Month D, YYYY` on the order view — "March 11, 2023").

---

## 7. Customer & address

`src/data/customer.json`:

```jsonc
{
  "id": 27, "email": "emma.lopez@gmail.com",
  "firstname": "Emma", "lastname": "Lopez",
  "dob": null, "gender": null, "createdAt": "2023-04-23 16:42:28",
  "groupId": 1, "defaultBilling": 26, "defaultShipping": 26,
  "newsletterSubscribed": false,
  "addresses": [
    { "id": 26, "firstname": "Emma", "lastname": "Lopez", "company": null,
      "street": ["101 S San Mateo Dr"], "city": "San Mateo",
      "region": "California", "regionId": 12, "postcode": "94010",
      "countryId": "US", "country": "United States", "telephone": "6505551212",
      "isDefaultBilling": true, "isDefaultShipping": true }
  ]
}
```

Emma has exactly one address, which is both defaults — so `/customer/address/`
renders the two default cards and an empty "Additional Address Entries" table.
`newsletter_subscriber` has **no row** for her, so `/newsletter/manage/` boots
unchecked.

---

## 8. Cart (quote)

`src/data/cart.json` — the real active quote 255, `updated_at 2023-05-05 19:28:17`:

| Line | Product id | SKU | Price | Options |
|---|---|---|---|---|
| Uttermost Volterra Crackled Taupe-Gray Ceramic Table Lamp | 15033 | B087QSCXGT | $250.80 | — |
| NOZE Rustic Coat Rack Wall Mounted Shelf with 4 Hooks … | 15787 | B08JLHHCM6 | $40.99 | — |
| Plus Size Lingerie for Women Sexy for Sex Naughty Eyelash Lace Bodysuit … | 10617 | B09LQTV3RX | $58.63 | Size: Large (23919), Color: Blue (23922) |

Subtotal **$350.42**, Order Total **$350.42** (shipping not yet estimated),
3 items / qty 3. The mini-cart badge shows **3**.

---

## 9. Listings (captured ground truth)

`src/data/listings.json` — 121 entries, one per URL actually fetched from the
live site (48 of them `/catalogsearch/…`). This is the file that makes search
relevance and toolbar counts faithful without an Elasticsearch clone.

```jsonc
{
  "url": "/catalogsearch/result/?q=usb+wifi",
  "path": "/catalogsearch/result/",
  "query": { "q": "usb wifi" },
  "title": "Search results for: 'usb wifi'",
  "toolbarAmount": "Items 1 - 12 of 7123",
  "totalCount": 7123,
  "productIds": [75131, 39797, 41247, 101261, 39934, …],   // exact source order
  "sorterOptions": [ {"value":"name","label":"Product Name","selected":false},
                     {"value":"price","label":"Price","selected":false},
                     {"value":"relevance","label":"Relevance","selected":true} ],
  "limiterOptions": [ {"value":"12","selected":true}, {"value":"24"}, {"value":"36"} ],
  "sortDirNext": "asc",
  "filters": [ { "name": "Category",
                 "options": [ {"label":"Beauty & Personal Care","count":637,
                               "href":"/catalogsearch/result/?cat=3&q=usb+wifi"}, … ] } ],
  "currentFilters": [ { "label": "Price", "value": "$0.00 - $9.99" } ],
  "pageLinks": ["2","3","4","5"]
}
```

Two structural facts recorded here that are easy to get wrong:

1. **Search pages offer a `relevance` sort option that category pages do not.**
   Category "Sort By" = Position / Product Name / Price (default Position).
   Search "Sort By" = Relevance / Product Name / Price (default Relevance).
2. **Price filter buckets are computed, not fixed.** On an unfiltered
   Headphones page the buckets are `$0.00 - $999.99 (628)` and
   `$1,000.00 and above (3)`; after filtering Men's Shoes to `price=0-10,0-100`
   they become `$1.00 - $1.99 (3)`, `$2.00 - $2.99 (2)`, … Copy the captured
   buckets rather than deriving your own.

---

## 10. Home page

`src/data/homepage.json`:

```jsonc
{ "title": "One Stop Market", "blockTitle": "Product Showcases",
  "pageParam": "pbaocw", "pageSize": 12, "totalCount": 24,
  "productIds": [104499, 104498, …, 104476] }
```

The block is Magento's "New Products" widget — the 24 highest `entity_id`
products, descending. Its pager param is the widget instance hash **`pbaocw`**,
not `p`; `/?p=2` returns page 1.

---

## 11. Search terms

`src/data/searchTerms.json` — the 60 most popular rows of `search_query` with
`display_in_terms = 1`: `{ queryId, queryText, numResults, popularity }`.
`/search/term/popular/` renders these as a tag cloud whose font-size scales with
popularity (the source writes `element.style.fontSize = '75%'` inline per term).

---

## 12. Store config

`src/data/storeConfig.json` — read from `core_config_data`:

| Key | Value |
|---|---|
| `design/header/welcome` | `Welcome to One Stop Market` |
| `general/locale/code` | `en_US` |
| `general/locale/timezone` | **`America/New_York`** |
| `currency/options/base` | `USD` |
| `general/store_information/phone` | **NULL — the store has no phone number** |
| `general/store_information/name` | NULL |
| Copyright line | `Copyright © 2013-present Magento, Inc. All rights reserved.` |
| Footer note | `Help Us Keep Magento Healthy` + link `Report All Bugs` |
| Grid page size | 12 (options 12 / 24 / 36) |

---

## 13. Images

Source paths are Magento cache URLs:

```
/media/catalog/product/cache/89ff578b9cd87e0600daac45c9e1ea98/B/0/B08LG9TYC9.0.jpg
                                                              └──────┬──────────┘
                                                  stored in products.json as
                                                  "/B/0/B08LG9TYC9.0.jpg"
```

The two path segments before the filename are the first character and second
character of the SKU. Grid thumbnails render at **240 × 300** inside a
`padding-bottom: 125%` aspect box; the PDP main image is ~560 px wide with a
thumbnail strip beneath it.

The mock must not fetch from the container at runtime. Two acceptable options,
both offline:

1. Copy the JPEGs for the seeded products out of the container
   (`docker cp shopping:/var/www/magento2/pub/media/catalog/product/<A>/<B>/ …`)
   into `public/media/catalog/product/<A>/<B>/`, keeping the path shape so
   `products.json` values resolve unchanged. ~1 105 products × 1–3 images.
2. Ship a deterministic local placeholder at the same dimensions
   (240 × 300 / 560 × 700), keyed off the SKU so each product looks stable
   across renders.

Recommend (1) for the ~180 priority products and (2) for the tail, and record
which you did in `SCHEMA.md`.

---

## 14. What `createInitialData()` should return

Only **mutable** entities belong in the session state that `/go` diffs. The
catalog is static reference data and should be imported directly by components,
not copied into state — otherwise every `/go` call POSTs ~4 MB.

```js
// src/utils/dataManager.js
import customer  from '../data/customer.json'
import cart      from '../data/cart.json'
import orders    from '../data/orders.json'
import wishlist  from '../data/wishlist.json'

export function createInitialData() {
  return {
    customer: {
      id: 27, email: customer.email,
      firstname: customer.firstname, lastname: customer.lastname,
      newsletterSubscribed: customer.newsletterSubscribed,
      defaultBilling: customer.defaultBilling,
      defaultShipping: customer.defaultShipping,
    },
    addresses: customer.addresses,          // add / edit / delete / set-default
    cart: { items: cart.items, quoteId: cart.quoteId },
    orders,                                 // reorder appends; address edit mutates
    wishlist: { items: wishlist.items },
    compareList: { items: [] },
    myReviews: [],                          // reviews submitted this session
    contactSubmissions: [],                 // { name, email, phone, comment, submittedAt }
    newsletterSubscribed: false,
    nextOrderIncrementId: 190,              // next id after 000000189
    nextReviewId: 400000,
    nextAddressId: 27,
    nextCartItemId: 4,
  }
}
```

```js
// components import these directly — NOT part of state
import products      from '../data/products.json'
import categories    from '../data/categories.json'
import reviews       from '../data/reviews.json'
import productOptions from '../data/productOptions.json'
import descriptions  from '../data/productDescriptions.json'
import listings      from '../data/listings.json'
import homepage      from '../data/homepage.json'
import searchTerms   from '../data/searchTerms.json'
import storeConfig   from '../data/storeConfig.json'
```

Seeded reviews render from `reviews.json`; `state.myReviews` is concatenated on
top so a review written during a rollout shows on the PDP and on
`/review/customer/`.

---

## 15. Referential integrity to preserve

- `orders[].items[].productId` → `products[].id` — all 100 order lines resolve
  into the seed, so "Reorder" and "the product I bought in March" tasks work.
- `cart.items[].productId` → `products[].id` (15033, 15787, 10617) and
  `cart.items[].options[].optionTypeId` → `productOptions["10617"][].values[].optionTypeId`.
- `products[].categoryIds` → `categories[].id` — 217 distinct categories are
  populated by the seed; the other 84 render an empty listing. That is a known
  gap, listed in `SOURCE.md`.
- `reviews[].productId` → `products[].id`.
- `listings[].productIds` → `products[].id` — all resolve; this was the
  construction rule for the product sample.
- `homepage.productIds` = 104476…104499, all present.
- `customer.defaultBilling` / `defaultShipping` = 26 → `addresses[0].id`.

---

## 16. Seed coverage self-check (per `WEBARENA_MIGRATION.md` §4.5)

| Requirement | Status |
|---|---|
| Something to search for | 48 captured search queries with real result orderings, incl. every query named in a WebArena task |
| Something to sort | Every listing captured in both directions where a task needs it; `price`/`name`/`position`/`relevance` all exercisable |
| A list long enough to paginate | Headphones 631 items (page 1 + page 2 captured); orders 37 rows over 4 pages; product 17500 has 87 reviews over 9 review pages |
| Records every P0/P1 workflow touches | Verified: the 37 task start-URL products, all 100 order lines, all 3 cart lines, the "most expensive PS4 accessory" (`astro-gaming-a50-…`, $253.99, top of cat 236 by price desc), and the 6S-headphones reviewer set (Catso / Dibbins / Anglebert Dinkherhump / Michelle Davis) |
| An order that can be transitioned | Orders in all three real states (complete / canceled / pending) with Reorder available on each |
