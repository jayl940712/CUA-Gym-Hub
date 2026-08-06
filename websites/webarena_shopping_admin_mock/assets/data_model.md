# shopping_admin — Data Model

> Derived from the live `magentodb` schema inside container `shopping_admin`
> (read-only, via `assets/dumps/mysql.py`). Seed files live in `src/data/` and are
> owned by the data/extraction agent; this document is the contract they satisfy.

**Prime directive: never regenerate an identifier.** Every id, SKU, increment id,
email, nickname, price and timestamp below is a literal from the source database
and is referenced by at least one WebArena task. Renumbering anything breaks the
evaluator.

---

## 1. Identifier map — what must never change

| Identifier | Format | Range in this dataset | Referenced by |
|---|---|---|---|
| `sales_order.entity_id` | int | 1–308, contiguous | Order routes, tasks 470–474, 491–500, 538–542 |
| `sales_order.increment_id` | `%09d` string | `000000001`–`000000308`, **always `entity_id` zero-padded to 9** | Rendered order numbers; tasks say "order #308" |
| `sales_order_address.entity_id` | int | 1–~616, two per order (billing + shipping) | `/admin/sales/order/address/address_id/:id/`, tasks 538–542 |
| `sales_invoice.increment_id` | `%09d` | `000000001`, `000000002` (order 1, order 2) | Tasks 94, 95 |
| `sales_shipment.increment_id` | `%09d` | `000000001`–`000000003` (orders 1, 2, 300) | — |
| `sales_creditmemo.increment_id` | `%09d` | `000000001` (order 2) | — |
| `customer_entity.entity_id` | int | 1–70 | `/admin/customer/index/edit/id/:id/` |
| `customer_entity.email` | string | e.g. `roni_cost@example.com`, `coolcat321@hotmail.com`, `hannah.lim@gmail.com` | Tasks 208–212, 243–244, 289 |
| `catalog_product_entity.entity_id` | int | 1–2040 | Every product task URL |
| `catalog_product_entity.sku` | string | `24-MB01`, `MH05`, `WSH09-29-White`, `WH11-S-Blue` | Tasks 187, 290 |
| `eav_attribute_set.attribute_set_id` | int | 4 Default, 9 Top, 10 Bottom, 11 Gear, 12 Sprite Stasis Ball, 13 Sprite Yoga Strap, 14 Downloadable, 15 Bag | Tasks 694–698 |
| `eav_attribute_option.option_id` | int | e.g. color Blue=50, Black=49, Yellow=60; size S=167, 34=177, 38=179 | Tasks 694–698 assert on these numeric option ids |
| `review.review_id` | int | 1–353 with gaps (351 rows) | Tasks 771–776 |
| `cms_page.page_id` | int | 1–6 | Tasks 486–490 |
| `theme.theme_id` | int | 1 Magento Blank, 2 Magento 2 backend, 3 Magento Luma | Tasks 374, 375 |
| `customer_group.customer_group_id` | int | 0 NOT LOGGED IN, 1 General, 2 Wholesale, 3 Retailer | Tasks 699–703 (`customer_group_ids: [1]`) |
| `catalog_category_entity.entity_id` | int | 1–40 (2 = Default Category root, 3 = Gear) | Category routes |
| `search_query.query_id` | int | 1, 5, 9, 11, 13, 19, 25 (7 rows, non-contiguous) | Tasks 41–43, 127 |

---

## 2. Entities

### `orders` → `src/data/orders.json` (308 records — the full table)

One object per order; nested addresses/items/payment so the order-view page needs
no joins.

```
entity_id            int          1..308
increment_id         string       "000000302"
state                string       new|processing|complete|closed|canceled|holded
status               string       pending|processing|complete|closed|canceled|holded|fraud
customer_id          int|null
customer_email       string
customer_firstname   string
customer_lastname    string
customer_group_id    int
created_at           string       "2023-05-31 06:55:09"   (UTC, 2022-01-01 .. 2023-05-31)
updated_at           string
total_item_count     int
total_qty_ordered    float
subtotal, subtotal_incl_tax, shipping_amount, shipping_incl_tax,
tax_amount, grand_total, total_paid, total_due, total_invoiced   float
shipping_description string       "Flat Rate - Fixed"
shipping_method      string       "flatrate_flatrate"
billing_address_id   int          -> addresses[].entity_id
shipping_address_id  int
weight               float
addresses[]          { entity_id, parent_id, address_type: billing|shipping,
                       firstname, lastname, street[], city, region, region_id,
                       postcode, country_id, telephone, email }
items[]              { item_id, product_id, sku, name, qty_ordered, price,
                       original_price, discount_amount, row_total, tax_amount,
                       product_options{size,color} }
payment              { method, additional_information, amount_ordered }
invoices[]           increment ids
shipments[]          increment ids
comments[]           { created_at, status, comment, is_customer_notified,
                       is_visible_on_front }   ← REQUIRED, may be [] initially
```

`comments[]` is what `#order_history_block .note-list` renders and what tasks
491–500 assert on. If the extraction did not populate it, the dev agent must add
the field (default `[]`) — it is the mutation target for five task families.

**Status distribution (must be reproduced exactly):**
complete 153 · canceled 142 · pending 10 · processing 2 · closed 1 = 308.

**Anchor orders** (task-referenced; verified values):

| id | status | created_at | Bill-to | Grand total | billing_address_id |
|---|---|---|---|---|---|
| 299 | pending | 2023-05-31 06:55:09 | Sarah Miller | 219.40 | 598 |
| 301 | pending | 2023-04-19 23:41:16 | Alex Johnson | 76.40 | 602 |
| 302 | pending | 2023-04-19 23:41:29 | Jane Doe | 183.50 | 604 |
| 304 | pending | 2023-04-19 23:41:55 | Alexander Thomas | 215.00 | 608 |
| 307 | pending | 2023-04-19 23:42:25 | Grace Nguyen | 101.20 | 614 |
| 308 | pending | 2023-04-19 23:42:37 | Grace Nguyen | 175.40 | 616 |
| 65 | pending | 2023-05-28 10:43:55 | Grace Nguyen | 210.00 | 130 |
| 125 | processing | 2023-05-24 12:28:12 | Matt Baker | 166.40 | 250 |

299 is the newest pending order (task 199, 203). The newest canceled order is
dated **2023-05-23** (task 202) with customer email `harrypotterfan1@gmail.com`
(task 198). The oldest complete order is billed to **John Lee** (task 200).

### `products` → `src/data/products.json` (2040 records — the full table)

```
entity_id, sku, type_id (simple|configurable|bundle|grouped), attribute_set_id,
created_at, updated_at, qty, is_in_stock (1|0), salable_quantity,
websites[], category_ids[], name, price (null for configurables),
status (1 Enabled | 2 Disabled), visibility (1..4), url_key, tax_class_id,
color, size, material, sale, new, eco_collection, erin_recommends,
performance_fabric, image, small_image, thumbnail, swatch_image,
gift_message_available, media_gallery[], description_ref
```

`description_ref` is a content-hash key into `productDescriptions.json`
(deduplicated HTML bodies) — keeps the seed under budget.

`price` is `null` on configurable parents, matching Magento. The grid shows the
child price range; the edit form's `product[price]` on a configurable is
read-only. Every task that edits a price targets a **simple** child id.

**Anchor products:**

| id | SKU | Name | Type | Price | Tasks |
|---|---|---|---|---|---|
| 126 | MH05 | Hollister Backyard Sweatshirt | configurable | — | 423 |
| 111,114,117,120,123 | MH05-\* | Hollister Backyard Sweatshirt variants | simple | 52.00 → 47.00 | 777 |
| 350 | MJ09 | Taurus Elements Shell | configurable | 65.00 | 501 |
| 872 | MP12-33-Blue | Cronus Yoga Pant-33-Blue | simple | 48.00 | 768 |
| 1130 | WH07 | Phoebe Zipper Sweatshirt | configurable | 59.00 | 547 |
| 1210 | WH12 | Circe Hooded Ice Fleece | configurable | 68.00 | 112, 121, 215, 243, 772 |
| 1396 | WJ12 | Olivia 1/4 Zip Light Jacket | configurable | 77.00 | 113, 122, 244 |

**Low-stock anchors** (tasks 183–187): the only products with single-digit qty are
`WH11-S-Blue` (Eos V-Neck Hoodie-S-Blue, material **Eos**) and `WS08-XS-Blue`
(Minerva LumaTech™ V-Tee-XS-Blue, material **Minerva**) at 2–3 units, and
**Sinbad Fitness Tank** at 0. No product has exactly 10 (task 183 answer is N/A).
The Low Stock Report must therefore sort ascending by qty and show those rows.

### `customers` → `src/data/customers.json` (70 records — the full table)

```
entity_id, website_id, email, group_id, store_id, created_at, updated_at,
is_active, created_in, firstname, lastname, dob, gender,
default_billing, default_shipping, disable_auto_group_change,
name, billing_full, shipping_full, billing_telephone,
addresses[] { entity_id, firstname, lastname, street[], city, region,
              region_id, postcode, country_id, telephone,
              is_default_billing, is_default_shipping }
```

`billing_telephone` is stored **as displayed** — the grid shows the raw string,
including formatting variants. Tasks 208–212 search by
`+1 2058812302`, `2137418080`, `2065555555`, `8015551212`, `555-229-3326`, so
the customer grid's keyword search must match on the phone column with the exact
stored punctuation.

**Anchor customers:** Veronica Costello (1, `roni_cost@example.com`,
`(555) 229-3326`), Samantha Jones (`coolcat321@hotmail.com`, `3055551212`, most
cancellations = 9), Hannah Lim (`hannah.lim@gmail.com`), Emma Lopez
(`emma.lopez@gmail.com`), Sophia Young (city **Boston**), Amanda Kim (city
**Hoboken, New Jersey**).

### `customerGroups` → `src/data/customerGroups.json` (4 records)

`{customer_group_id, customer_group_code, tax_class_id}` — 0 NOT LOGGED IN,
1 General, 2 Wholesale, 3 Retailer.

### `reviews` → `src/data/reviews.json` (**MISSING — must be created**, 351 records)

Join of `review` + `review_detail` + `rating_option_vote`:

```
review_id        int      1..353 (2 gaps)
created_at       string   all in April 2023
entity_pk_value  int      -> product entity_id
status_id        int      1 Approved | 2 Pending | 3 Not Approved
title            string   "Quite good"
detail           string   full review body (searched by tasks 11-15, 119-123, 213-217)
nickname         string   "Hannah Lim", "Shaunte", "Arden", "Carlo", "Teofila"
customer_id      int|null
store_id         int      1
ratings          { Quality: 1..5, Value: 1..5, Price: 1..5, Rating: 1..5 }
```

Rating codes come from `rating`: 1 Quality, 2 Value, 3 Price, 4 Rating.

**Counts that are answers:** 351 total (tasks 344, 347); 346 approved (78);
5 pending (77); 0 not approved (79); 351 in Apr 2023 (345); 0 in 2022 (346);
0 in May 2023 (348).

**The 5 pending reviews, verbatim:**

| review_id | product | nickname | title |
|---|---|---|---|
| 347 | 1396 Olivia 1/4 Zip Light Jacket | Jane Smith | Quite good |
| 349 | 1396 | seam miller | OKish |
| 351 | 1396 | Emma | won't recommand |
| 352 | 1210 Circe Hooded Ice Fleece | customer | Good but not perfect |
| 353 | 1210 | Hannah Lim | Bad! |

Tasks 771–774 approve/delete exactly these. Tasks 775/776 delete reviews
51 (nickname **Arden**) and 93, 109 (**Carlo**).

Keyword counts the review search must reproduce: `disappointed` → 4,
`satisfied` → 2, `decent` → 2, `best` → 2, `not useful` → 0 (tasks 11–15).

> **Known WebArena quirk:** task 772 asserts on
> `/admin/review/product/edit/id/999`, and there is no review 999. The assertion
> passes because a non-existent review renders `Rating isn't Available`. The mock
> must therefore render that string for **any** unknown or deleted review id
> rather than 404.

### `searchTerms` → `src/data/searchTerms.json` (**MISSING — must be created**, 7 records)

Verbatim from `search_query`, ordered by popularity (Uses) desc:

| query_id | query_text | num_results | popularity |
|---|---|---|---|
| 11 | hollister | 1 | 19 |
| 1 | Joust Bag | 10 | 4 |
| 19 | nike | 0 | 3 |
| 13 | Antonia Racer Tank | 23 | 2 |
| 5 | MT02-M-Gray | 115 | 1 |
| 9 | WP10 | 1 | 1 |
| 25 | tanks | 23 | 1 |

Task 41–43: top terms are `hollister`, `Joust Bag`, `Antonia Racer Tank`.
Task 127 "top 3 that match available products" excludes `nike` (0 results), which
is why the **Results** column must be present and correct.

### `invoices` / `shipments` / `creditmemos` → **MISSING — must be created**

```
invoices    [ {entity_id:1, increment_id:"000000001", order_id:1,   grand_total:36.39, created_at:"2023-04-19 16:15:45", state:2},
              {entity_id:2, increment_id:"000000002", order_id:2,   grand_total:39.64, created_at:"2023-04-19 16:15:47", state:2} ]
shipments   [ {entity_id:1, increment_id:"000000001", order_id:1,   total_qty:1, created_at:"2023-04-19 16:15:46"},
              {entity_id:2, increment_id:"000000002", order_id:2,   total_qty:1, created_at:"2023-04-19 16:15:47"},
              {entity_id:3, increment_id:"000000003", order_id:300, total_qty:2, created_at:"2023-04-23 22:09:21"} ]
creditmemos [ {entity_id:1, increment_id:"000000001", order_id:2,   grand_total:39.64, created_at:"2023-04-19 16:15:47"} ]
```

Invoice state `2` = Paid. Grand totals 36.39 and 39.64 are the answers to tasks
94 and 95 — do not round.

### `cmsPages` → `src/data/cmsPages.json` (**MISSING — must be created**, 6 records)

| page_id | title | identifier (URL key) |
|---|---|---|
| 1 | 404 Not Found | `no-route` |
| 2 | Home Page | `home` |
| 3 | Enable Cookies | `enable-cookies` |
| 4 | Privacy Policy | `privacy-policy-cookie-restriction-mode` |
| 5 | About us | `about-us` |
| 6 | Customer Service | `customer-service` |

Plus `is_active`, `page_layout`, `content`, `content_heading`, `meta_title`,
`meta_keywords`, `meta_description`, `creation_time`, `update_time`, `store_id`.
Tasks 486–490 rewrite `title` on ids 1–5.

### `themes` → `src/data/themes.json` (**MISSING**, 3 records)

`{theme_id, theme_path, theme_title, parent_id, area, theme_version}` —
1 `Magento/blank` "Magento Blank", 2 `Magento/backend` "Magento 2 backend",
3 `Magento/luma` "Magento Luma" (parent = 1).

### `categories` → `src/data/categories.json` (**MISSING**, 40 records)

`{entity_id, parent_id, path, position, level, children_count, name, is_active,
include_in_menu, url_key, product_count}`. Root = 1, Default Category = 2,
Gear = 3.

### `attributeSets` / `attributeOptions` → present

`attributeSets.json` maps `"9" → "Top"` etc.
`attributeOptions.json` maps attribute code → `{option_id: label}` for
`activity, category_gear, climate, collar, color, features_bags, format, gender,
material, pattern, size, sleeve`. **The numeric option ids are asserted by tasks
694–698** (e.g. `product[size]` must equal `"167"` for S, `product[color]`
`"50"` for Blue, `"49"` for Black, `"60"` for Yellow, `product[size]` `"177"`
for 34 and `"179"` for 38).

### `cartPriceRules` → `src/data/cartPriceRules.json` (**MISSING — start empty `[]`**)

Created at runtime by tasks 699–703. Shape must use Magento's own field names so
the evaluator's JSON match works:

```json
{ "rule_id": 1, "name": "spring sale", "description": "",
  "is_active": 1, "website_ids": [1], "customer_group_ids": [1],
  "coupon_type": 1, "simple_action": "by_percent", "discount_amount": "20",
  "discount_qty": null, "discount_step": 0, "stop_rules_processing": false,
  "apply_to_shipping": false, "simple_free_shipping": "0",
  "from_date": null, "to_date": null, "sort_order": 0, "uses_per_customer": 0 }
```

`simple_action` values: `by_percent` (Percent of product price discount),
`by_fixed` (Fixed amount discount), `cart_fixed` (Fixed amount discount for whole
cart), `buy_x_get_y`. `discount_amount` is a **string**, matching the API.

---

## 3. Relationships / referential integrity

```
orders.customer_id            -> customers.entity_id            (null for guests)
orders.addresses[].entity_id  -> the address_id in /sales/order/address/address_id/:id/
orders.items[].product_id     -> products.entity_id
orders.items[].sku            -> products.sku
invoices.order_id             -> orders.entity_id
shipments.order_id            -> orders.entity_id
creditmemos.order_id          -> orders.entity_id
reviews.entity_pk_value       -> products.entity_id
products.attribute_set_id     -> attributeSets keys
products.color/size/material  -> attributeOptions[<code>][<option_id>]
products.category_ids[]       -> categories.entity_id
customers.group_id            -> customerGroups.customer_group_id
```

The order-address id space is **global across orders** (299 → 597/598,
302 → 603/604, 308 → 615/616), so `/admin/sales/order/address/address_id/604/`
must resolve without knowing the order — index addresses globally.

---

## 4. `createInitialData()` shape

```js
{
  orders:          Order[],            // 308
  products:        Product[],          // 2040
  productDescriptions: Record<string,string>,
  customers:       Customer[],         // 70
  customerGroups:  CustomerGroup[],    // 4
  reviews:         Review[],           // 351
  searchTerms:     SearchTerm[],       // 7
  invoices:        Invoice[],          // 2
  shipments:       Shipment[],         // 3
  creditmemos:     CreditMemo[],       // 1
  cmsPages:        CmsPage[],          // 6
  categories:      Category[],         // 40
  themes:          Theme[],            // 3
  attributeSets:   Record<string,string>,
  attributeOptions:Record<string,Record<string,string>>,
  cartPriceRules:  [],                 // grows at runtime
  ui: { gridState: {}, messages: [] }  // transient, not part of the diff surface
}
```

**Size budget.** `products.json` (1.26 MB) + `orders.json` (0.99 MB) already
exceed the ~1–2 MB `/go` budget on their own. Recommended mitigations, in order:

1. Strip never-rendered product fields (`media_gallery`, `swatch_image`,
   `gift_message_available`, `eco_collection`, `erin_recommends`,
   `performance_fabric`) — they are not shown in the grid or asserted by tasks.
2. Keep `productDescriptions.json` **out of mutable state**; import it as a
   static module and only put an override map in state (descriptions are edited
   by tasks 464, 543–546, so store `{productId: newDescription}` deltas).
3. If still over budget, keep the immutable bulk (`products`, `orders`) as static
   imports and hold only a **mutation overlay** in session state. The `/go`
   `state_diff` then shows exactly what the agent changed, which is what the
   evaluator wants anyway.

Products and orders cannot simply be sampled down: tasks assert on grid totals
("308 records found"), report aggregates (monthly completed-order counts) and
specific ids scattered across the whole range (product 1861, order 65).

---

## 5. Counts that are answers — regression checklist

| Assertion | Expected | Source |
|---|---|---|
| Orders grid record count | 308 | `sales_order` |
| Orders by status | complete 153, canceled 142, pending 10, processing 2, closed 1 | `sales_order` |
| Customers grid record count | 70 | `customer_entity` |
| Products grid record count | 2040 | `catalog_product_entity` |
| Reviews grid record count | 351 | `review` |
| Pending reviews | 5 | task 77 |
| Approved reviews | 346 | task 78 |
| Not Approved reviews | 0 | task 79 |
| Invoices | 2 | task 94/95 |
| Completed orders per month 2022 | Jan 11, Feb 16, Mar 14, Apr 7–8, May 8, Jun 13, Jul 9, Aug 8, Sep 10, Oct 4, Nov 5, Dec 10 | tasks 109–111 |
| Completed orders per month 2023 | Jan 12, Feb 7, Mar 5, Apr 9, May 5 | task 108 |
| Items sold, most recent N orders | 2→9, 4→16, 5→18, 7→25 | tasks 128–131 |
| Payment totals, last N completed | 2→182.4, 5→555.2 | tasks 193, 194 |
| Payment total, last 5 pending | 885.4 | task 195 |
| Samantha Jones cancellations | 9 | task 292 |

> Tasks 109 and 110 disagree on April 2022 (7 vs 8). That is a WebArena data
> inconsistency, not something to reconcile — compute from the seeded orders and
> let whichever value the data gives stand.
