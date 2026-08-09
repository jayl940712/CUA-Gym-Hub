# webarena_shopping_mock — Test Report (Round 11, CLOSING ACCEPTANCE)

> Round: 11 — closing acceptance after dev shard T closed the last open TODO item (fotorama gallery DOM)
> Date: 2026-08-09 · Mock: dev 5230 + rebuilt preview 5231 · Source: http://10.186.197.203:7770 (live, login asserted hard, read-only)
> Tested by: playwright agent in real chromium, 1920x1080 and 1280x720, dev AND preview
> Round 10's full acceptance report is preserved at TEST.round10-prev.md.

## Verdict: PASS — 0 P0, 0 P1 functional, 0 P0/P1 source-vs-mock differences

Covers BOTH benchmarks: the 192 webarena shopping tasks and the 479 visualwebarena shopping tasks.

| Metric | Result |
|---|---|
| ROUTES.md rows verified, dev | 42 / 42 |
| ROUTES.md rows verified, rebuilt preview | 42 / 42 |
| Cold deep-link failures | 0 |
| `?sid=` preservation failures | 0 |
| `.fotorama__stage__frame` non-zero with a real image (PDP x server x viewport) | 24 / 24 |
| webarena + VWA evaluator selectors resolving on their own page | 27 / 27 |
| Evaluator /media URLs serving real JPEGs (dev / preview) | 42 / 42 each |
| Tasks replayed / completable | 12 / 12 |
| Primary controls hit-tested at 1920 / 1280 | 31 / 31 each |
| Console errors / external requests | 0 / 0 |
| P2 | 2 |

Round 10 (TEST.round10-prev.md) independently returned PASS on the wider sweep:
368/368 anchor routes, 40/40 benchmark `?q=` values matching the source's count,
216 search terms swept against the live source, 22/22 tasks replayed, 132/132 hit-tests.

TEST COMPLETE: webarena_shopping_mock — PASS

---

# webarena_shopping_mock — Closing Acceptance Check (shard `close`)

> Round: 11 (closing acceptance)
> Date: 2026-08-09
> Mock dev:     http://localhost:5230   (`npm run dev`)
> Mock preview: http://localhost:5231   (`npm run preview`, from a FRESH `npm run build`)
> Source: http://localhost:7770 (absolute base http://10.186.197.203:7770) — reachable: **YES**,
> login asserted HARD (`GET /customer/account/` → `h1 = "My Account"`) on every source run.
> Source treated strictly READ-ONLY (navigation + geometry reads only).
> Scratch: /tmp/pw-close/ · sid prefix `cl_`
> Tested by: playwright agent (closing acceptance shard)

> NOTE ON PORTS: the brief named 5217 for dev, but 5217 was still held by shard T's
> preview server (pid 2405295) and this shard does not kill servers it does not own.
> This shard therefore runs its own dev on **5230** and its own rebuilt preview on
> **5231**. `npm run build` was re-run from scratch at the start of this round.

## Summary

| Metric | Count |
|--------|-------|
| ROUTES.md rows verified (cold + params + `sid`), **dev** | **42 / 42** |
| ROUTES.md rows verified (cold + params + `sid`), **rebuilt preview** | **42 / 42** |
| Cold deep-link failures | **0** |
| `?sid=` preservation failures | **0** |
| `.fotorama__stage__frame` resolving, non-zero, real image (PDP × server × viewport) | **24 / 24** |
| Active frame matching the live source, per product | **5 / 5** |
| WA + VWA evaluator selectors resolving on their own page | **27 / 27** |
| Evaluator `/media/**` URLs serving real JPEGs (dev · preview) | **42 / 42 · 42 / 42** |
| Review-anchor SKUs matching the source | **9 / 9** |
| Tasks replayed / completable | **12 / 12** |
| Primary controls hit-tested at 1920 and 1280 | **31 / 31 · 31 / 31** |
| Console errors · external requests (22-page walk × 4 combinations) | **0 · 0** |
| Source-vs-mock diffs found | 2 (both **P2**) |
| ❌ **P0** | **0** |
| ❌ **P1 functional** | **0** |
| ❌ **P0 / P1 source-vs-mock** | **0** |
| ⚠️ P2 | 2 |

---

## 1. The fix — `.fotorama__stage__frame`

**Verdict: the fix holds. `.fotorama__stage__frame` resolves to non-zero-sized nodes
containing the real product image on every PDP measured, in all 4 server×viewport
combinations. The 7 `page_image_query` tasks now have something to crop.**

Products chosen to cover the stated axes: `34309` (pre-existing, 2 images, 500 px
assets), `1088` (single-image), `8525` (4 images, downsampled 320 px assets),
`97705` (newly seeded, 4 images), `76525` (pre-existing, 2 images, non-square asset).
Run at **1920x1080 and 1280x720**, on **dev 5230** and **rebuilt preview 5231**.

### 1a. Node existence, size, and content — mock

| product | frames | first is `.fotorama__active` | active image | `naturalW×H`, `complete` | frame box | hit-test 3/3 |
|---|---|---|---|---|---|---|
| 34309 | 2 | ✅ | `B07SYHF5R2.1.jpg` | 500×500, true | 706.8 × 706.8 | ✅ `img.fotorama__img`, `inFrame` |
| 1088  | 1 | ✅ | `B083W36M47.0.jpg` | 500×500, true | 706.8 × 706.8 | ✅ |
| 8525  | 4 | ✅ | `B07GJX3J66.1_1.jpg` | 320×320, true | 706.8 × 706.8 | ✅ |
| 97705 | 4 | ✅ | `B098JYFFYH.1_1.jpg` | 500×500, true | 706.8 × 706.8 | ✅ |
| 76525 | 2 | ✅ | `B086GNDL8K.1.jpg` | 415×500, true | 706.8 × 706.8 | ✅ |

Identical on dev/preview and 1920/1280 — all 20 combinations. Hit-test is
`elementFromPoint` at the frame's centre, 25/30 % and 75/70 %, after
`scrollIntoView({block:'center'})`; all three points land on `img.fotorama__img`
inside the frame.

> Method note, so it is not mistaken for a finding: an unscrolled `elementFromPoint`
> at 1280x720 returns `null` for the centre point, because the 706.8 px-tall frame
> starts at y≈508 and its centre is below the 720 px fold. That is the viewport, not
> the DOM. With `scrollIntoView` it is 3/3 at both viewports.

### 1b. **The active frame matches the source image-for-image on all 5 products**

This is the sharpest check available, because it is what a `page_image_query`
evaluator actually crops. Source (real browser, fotorama JS run) vs mock:

| product | source active | mock active | match |
|---|---|---|---|
| 34309 | `B07SYHF5R2.1.jpg` | `B07SYHF5R2.1.jpg` | ✅ |
| 1088  | `B083W36M47.0.jpg` | `B083W36M47.0.jpg` | ✅ |
| 8525  | `B07GJX3J66.1_1.jpg` | `B07GJX3J66.1_1.jpg` | ✅ |
| 97705 | `B098JYFFYH.1_1.jpg` | `B098JYFFYH.1_1.jpg` | ✅ |
| 76525 | `B086GNDL8K.1.jpg` | `B086GNDL8K.1.jpg` | ✅ |

DEV.part-T §7's claim that it also closed the stale DIFF-003 ("PDP opens on the
wrong gallery slide") is **confirmed independently here** — including on the two
4-image products, where the base-role image is neither `gallery[0]` nor the last.

### 1c. Box geometry vs the live source, `div.product.media` subtree, 1920

| selector | source | mock | delta |
|---|---|---|---|
| `.gallery-placeholder` | 706.8 × 801 | 706.8 × 800.8 | 0.2 |
| `.fotorama` / `.fotorama__wrap` | 706.8 × 801 | 706.8 × 800.8 | 0.2 |
| `.fotorama__stage` / `__stage__shaft` | 706.8 × 707 | 706.8 × 706.8 | 0.2 |
| `.fotorama__stage__frame` | 706.8 × 707 @ x −368.8 / 340 | 706.8 × 706.8 @ x 340 / −368.8 | 0.2 + order (§1d) |
| `.fotorama__img` (stage) | 700 × 700 @ 343.4 | 699.7 × 699.7 @ 343.5 | 0.3 |
| `.fotorama__nav-wrap` / `__nav` | 706.8 × 94 | 706.8 × 94 | **0** |
| `.fotorama__nav__shaft` | 182 × 94 (2 img) / 366 × 94 (4 img) | 182 × 94 / 366 × 94 | **0** |
| `.fotorama__nav__frame` | 92 × 94, 90 × 94 (4 img: 92/92/92/90) | identical | **0** |
| `.fotorama__thumb` | 90 × 90 | 90 × 90 | **0** |
| `.fotorama__thumb-border` | 90 × 90 | 90 × 90 | **0** |
| `.fotorama__arr` | 80 × 707 @ 340 / 966.8 | 80 × 706.8 @ 340 / 966.8 | 0.2 |
| `.product.media` | 706.8 × 801 | 706.8 × 800.8 | 0.2 |

Single-image product `1088`: source and mock **both** give
`.fotorama__nav-wrap` 0×0, `.fotorama__nav__shaft` 0×0, `.fotorama__nav__frame` 0
nodes, and **both arrows 0×0** — exact parity on the single-image special case.

The residual 0.2–0.3 px is the source's fotorama JS writing integral
`width/height: 707px` inline onto a 706.797 px column where the mock uses
`aspect-ratio: 1/1`. Independently reproduced here; sub-pixel, **P2 at most, and
I am not filing it** — it is below the threshold at which any evaluator or agent
can observe it.

### 1d. The one divergence, re-measured and priced

Multi-image products: the source keeps a recycled sliding window of **at most 3**
frames (`[next, active, prev]` for the 4-image products, `[prev, active]` for the
2-image ones); the mock renders **one frame per image with the active one first**.

| product | source frames | mock frames |
|---|---|---|
| 34309 | 2 | 2 |
| 1088 | 1 | 1 |
| 76525 | 2 | 2 |
| 8525 | 3 (of 4 thumbs) | 4 |
| 97705 | 3 (of 4 thumbs) | 4 |

Priced as **not a finding**, and I checked the reasoning rather than taking
DEV.part-T's word for it:
- `query_selector('.fotorama__stage__frame')` — the harness's own single-element
  form — returns the **on-screen active photo on the mock** and an **off-stage
  frame at x −368.8 on the source**. The mock is strictly better for the
  evaluator, never worse.
- `query_selector_all` returns a superset that still includes the active frame.
- Nothing moves on screen: `left` is still `(i − active) × (stage + 2)`, so the
  extra frames sit off-stage at −1077.6 / −1786.4, exactly like the source's.
- It is exact parity for the 1- and 2-image products, which DEV.part-T reports as
  11 331 of 11 358 catalogue rows.

---

### 1e. Independent pixel diff, `div.product.media` element shot, source vs mock @1920

| product | element size src / mock | mean abs diff | pixels > 40 |
|---|---|---|---|
| 34309 (2 img, 500 px assets) | 707 × 801 / 707 × 801 | **2.12 / 255** | **0.17 %** |
| 1088 (1 img, 500 px assets) | 707 × 707 / 707 × 707 | **1.02 / 255** | **0.00 %** |

DEV.part-T's 2.1 / 1.0 numbers reproduce exactly. Element boxes are pixel-identical.

---

## 2. PDP regression sweep

Every item the brief named, driven on **dev 5230 and rebuilt preview 5231**, at
**1920x1080 and 1280x720** — 4 combinations × 6 PDPs.

| check | result |
|---|---|
| VWA price chain `#maincontent > div.columns > div > div.product-info-main > div.product-info-price > div.price-box.price-final_price > span > span` | ✅ resolves on all 6 PDPs × 4 combinations; values `$219.99 / $25.00 / $6.29 / $2.14 / $19.99 / $43.45` — **all identical to the source** |
| VWA title chain `#maincontent > div.page-title-wrapper.product > h1 > span` | ✅ resolves with the correct product name on all 6 × 4 |
| duplicated thumbnails | ✅ none — thumb `src` set is unique on every PDP (2 / 1 / 4 / 4 / 2) |
| React key collisions | ✅ none — 0 console **errors** and 0 `pageerror` on preview across all runs; dev emits only the two pre-existing React Router v7 future-flag *warnings* |
| `Skip to the beginning / end of the images gallery` | ✅ both present verbatim on all 6 PDPs, alongside `Skip to Content`; `#gallery-prev-area` and `#gallery-next-area` both present |
| PDP media-column geometry | ✅ `div.product.media` = **706.8 × 801** (multi-img) / **706.8 × 707** (single-img) on the source, and 706.8 × 800.8 / 706.8 × 706.8 on the mock, **at both 1920 and 1280** — the 57 % split holds across the breakpoint |
| configurable options | ✅ radio counts match the source exactly: `1088` 2, `8525` 6 (Size + Style), `76525` 5 (Color); option group titles render |
| `table#productDetails_detailBullets_sections1` | ✅ present on all 6; row labels match the source **character for character**, including the U+200F RTL marks Magento emits (`Manufacturer ‏`, `ASIN ‏`) and the `#180 in Beard Conditioners & Oils` sales-rank row |
| out-of-stock PDP (`/coffeecakes-apple-walnut-coffee-cake.html`) | ✅ `#qty` 0 nodes, `#product-addtocart-button` 0, `.action.tocompare` 0, `.stock` = `OUT OF STOCK`, `Add to Wish List` **present** — **all five match the source exactly** (the source also keeps wishlist on an OOS product), and 1 real stage frame still renders |
| reviews | ✅ tab label matches the source verbatim including the count: `Reviews 12` on 76525, `Reviews 10` on the OOS cake, bare `Reviews` on 34309/1088/8525/97705 |
| **cold deep-link onto a PDP** | ✅ `window.__docSeq == 1`, exactly **1 document request**, **0 flash frames** |

### 2a. Cold deep-link paint — method and result

A `requestAnimationFrame` sampler installed via `add_init_script` *before* navigation
recorded `[stage frames, #description length, tab count, review items]` on every frame.
On all 24 cold loads the **first non-empty sample already carried gallery + description
+ tabs together** — e.g. 8525 `[4, 8572, 2, 0]`, 76525 `[2, 1892, 2, 10]`. There is no
intermediate frame in which the gallery painted while description or tabs were empty,
and `__docSeq` stayed at 1, so nothing reloads.

### 2b. Gallery interaction

Driven on the rebuilt preview at both viewports, 4-image product `8525`:

| action | result |
|---|---|
| thumb click (indices 2, 0, 3) | ✅ active frame, active thumb and `.fotorama__thumb-border` `translate3d` offset all move together (0 / 92 / 276 px) |
| `Enter` on a focused `.fotorama__nav__frame` | ✅ switches the active frame |
| prev arrow, stepped through all 4 images | ✅ `1_1 → 0_1 → 1 → 0`, one step per click |
| first `.fotorama__stage__frame` stays the active one after every navigation | ✅ |
| `<img>` nodes are moved, not remounted, when the order changes | ✅ (identity marks survive re-render) |

---

## 3. Contract regression sweep

### 3a. Route parity — **42 / 42 ROUTES.md rows, on dev AND rebuilt preview**

Fresh browser context per row, cold, `wait_until='commit'`, `?sid=cl_parity`,
external-request interceptor armed.

| checked | dev 5230 | preview 5231 |
|---|---|---|
| rows loaded cold, correct view | **42 / 42** | **42 / 42** |
| `#maincontent` present and non-trivial | 42 / 42 | 42 / 42 |
| original query params preserved after render | 42 / 42 | 42 / 42 |
| `?sid=cl_parity` still in the address bar | **42 / 42** | **42 / 42** |
| stuck on `Loading...` | 0 | 0 |
| console errors · external requests | **0 · 0** | **0 · 0** |

Alias spellings all resolve (`/checkout/cart` ≡ `/checkout/cart/`, `/wishlist/` ≡
`/wishlist/index/index/`, `/contact` ≡ `/contact/`, `/catalogsearch/result/` ≡
`/catalogsearch/result/index/`). The malformed
`…sport-specific-clothing.html&product_list_order=price` renders the 404 page, as the
source does. Row 38 is not migrated by contract.

**Rows that only pass with real ids — re-verified with real ids, not the placeholders
the previous round's script carried.** A 404 page satisfies a naive "route loads"
check, so these three were driven separately:

| row | real value used | result |
|---|---|---|
| 5 `/<url_key>.html` | `/bath-bloom-mango-tangerine-body-scrub-…-facial-mask.html` (real `urlKey` out of `products.json`) | ✅ PDP renders, `h1` and `<title>` correct, `sid` kept |
| 18 `/checkout/cart/configure/id/:itemId/product_id/:productId/` | `554 / 15033`, read live out of `/go?sid=cl_cart` | ✅ renders the configure page for that cart line |
| 35 `/review/customer/view/id/:reviewId/` | `400000`, the id of a review **submitted during this run** | ✅ **cold** deep-link renders `Review Details` with the submitted title, body, `Rating 100%`, `Submitted on 8/9/26`, `sid` kept |

### 3b. In-app mutating routes (17 / 19 / 31 / 33) and the review flow

| row | action | result |
|---|---|---|
| 17 | PDP → Add to Cart | ✅ `You added SUNSITT 3-Piece Wicker Outdoor Bistro Table Set … to your shopping cart.` — Magento's message verbatim; cart goes to 4 `.item-info` rows; `/go` `current_state.cart` carries `quoteId 255` and the new line |
| 19 | cart row → Remove item | ✅ 4 → 3 rows |
| 31 | `/sales/order/reorder/order_id/189/` | ✅ lands on `Shopping Cart` with the order's lines |
| 33 | PDP → Add to Wish List | ✅ (see §4) |
| 34 | submit a review with **nothing filled** | ✅ validation copy matches Magento exactly: `Please select one of each ratings above.` + three × `This is a required field.` |
| 34 | submit a complete review | ✅ `You submitted your review for moderation.` — verbatim; the row then appears in `/review/customer/` with columns `Created · Product Name · Rating · Review` and a `See Details` link to `/review/customer/view/id/400000/` |

---

### 3c. Evaluator selectors — every WA + VWA anchor selector, on the page it belongs to

| page | selector | nodes | first value |
|---|---|---|---|
| `/sales/order/view/order_id/189/` | `.order-details-items.ordered` | 1 | `Items Ordered … Product Name SKU Price Qty Subtotal …` |
| | `.box-order-shipping-address` | 1 | `Shipping Address Emma Lopez 101 S San Mateo Dr …` |
| | `#maincontent > … > div.box.box-order-shipping-address > div > address` | 1 | ✅ |
| | `.page-title` | 1 | `Order # 000000189` |
| `/customer/address` | `.box.box-address-billing > .box-content` | 1 | `Emma Lopez … T: 6505551212` |
| | `.box.box-address-shipping > .box-content` | 1 | ✅ |
| | `.box-address-billing > div.box-content > address > a` | 1 | `6505551212` (the `.substring(0,3)` VWA-345 asserts on) |
| | `.box-address-shipping` / `.box-address-billing` | 1 / 1 | ✅ |
| `/customer/account/` | both `block-dashboard-addresses` billing + shipping `address` chains | 1 / 1 | ✅ |
| `/newsletter/manage/` | `[title="General Subscription"]` | 1 | `.checked` togglable |
| `/contact/` | `[title="What’s on your mind?"]` (curly apostrophe) | 1 | `.value` writable |
| PDP | title chain · price chain · `.fotorama__stage__frame` · `table#productDetails_detailBullets_sections1` | 1 · 1 · 2 · 1 | ✅ |
| `/wishlist/` | `.products-grid.wishlist` | 1 | product name present |
| `/checkout/cart/` | `#shopping-cart-table` · `.item-info` · `.item-options` · `td.col.item > div > dl > dd` · `dd:nth-child(4)` | 1 · 4 · 2 · 3 · 1 | `Large` / `Blue` |
| `/checkout/` step 2 | `#opc-sidebar > div.opc-block-summary > div > div.content.minicart-items > div > ol` | 1 | itemised list with qty + price |

> Three selectors read as failures on my first pass because I probed them on the
> wrong page. Checked against the raw jsonl rather than guessing:
> `.box.box-address-*` belongs to `__SHOPPING__/customer/address` (webarena-571…575),
> `.item-info` to `__SHOPPING__/checkout/cart/` (visualwebarena-168). On their own
> pages both resolve. Recorded so a later round does not re-derive them as bugs.
>
> `.products-grid .wishlist .product-image-photo` (4 tasks) selects **0 nodes on the
> mock and 0 on the source** — the selector has a space where Magento's class is
> `.products-grid.wishlist`. Parity, as `AUDIT.part-todo-reconcile` already recorded.

### 3d. Checkout → latest order, end to end, with a COLD reload on the same sid

PDP (with a required option, qty 2) → cart → `/checkout/` → shipping method → **Next** →
`/checkout/?sid=…#payment` → **Place Order**:

| step | result |
|---|---|
| cart totals | `Subtotal $400.42 · Shipping (Flat Rate - Fixed) $25.00 · Order Total $425.42` |
| step 2 URL | `#payment` written to the address bar, `sid` intact |
| `#opc-sidebar` | 1 node — `Order Summary · Cart Subtotal $400.42 · Shipping Flat Rate - Fixed $25.00 · Order Total $425.42 · 5 Items in Cart · Ship To: Emma Lopez …` |
| success page | `/checkout/onepage/success/?sid=cl_buy3` — `Thank you for your purchase!` / `Your order number is: 000000190.` |
| **COLD reload, new browser context, same sid** | `/sales/order/history/` top row `000000190 · 8/9/26 · $425.42 · Pending`; the order view renders `.order-details-items.ordered` with the purchased SKU |
| `/go` `state_diff` | `cart, orders, nextOrderIncrementId, nextOrderEntityId, nextCartItemId, lastPlacedOrderId` |

### 3e. Media contract — dev and preview

| probe | dev 5230 | preview 5231 |
|---|---|---|
| `/media/catalog/product/B/0/B07SYHF5R2.1.jpg` | 200, `FF D8 FF`, `image/jpeg`, 51 266 B | identical |
| `/media/catalog/product/B/0/B086GNDL8K.1.jpg` | 200, `FF D8 FF`, 34 854 B | identical |
| `/media/catalog/product/Z/Z/NO_SUCH_FILE_xyz.jpg` | **404** `text/plain` | **404** |
| `/media/catalog/product/cache/deadbeef/x.jpg` | **404** | **404** |
| `/media/` | **404** | **404** |
| **all 42 distinct `/media/**` URLs named in `webarena.jsonl` + `visualwebarena.jsonl`** | **42 / 42** HTTP 200 with real JPEG magic | **42 / 42** |

### 3f. Session isolation, injected state, `/go`

| check | result |
|---|---|
| two sids, independent state | ✅ `cl_iso1._probe == "one"`, `cl_iso2._probe == "two"` |
| injected initial state loads into the app | ✅ `/customer/account/` renders `Injected Persona / injected@example.com`, `/newsletter/manage/` checkbox pre-checked, wishlist pre-populated — so `AppContext` reads `initialKey(sid)` before `initializeData()` |
| a second sid is unaffected by the injection | ✅ `cl_clean` still renders `Emma Lopez` |
| `reset` restores | ✅ `state_diff` returns to `{}` and current == initial |
| `/go` shape | ✅ `initial_state`, `current_state`, `state_diff` |
| `state_diff` covers real mutations | ✅ 6 keys after a purchase; `cart` after add-to-cart |
| **`/go` size with the catalog out of state** | ✅ baseline sid **125 466 B**; `current_state` top keys are `addresses, cart, compareList, contactSubmissions, customer, lastPlacedOrderId, myReviews, newsletterSubscribed, next*, orders, wishlist` — **no products / reviews / descriptions**, so the 11 358-row catalogue never crosses the wire |

> Method note: a raw `POST {action:"set_current"}` to a sid that has no
> `.initial.json` yet makes the posted state *both* initial and current, so `/go`
> reports an empty `state_diff`. That is the harness's baseline-establishment rule,
> not a diff bug — the app-driven path produces the 6-key diff above. Likewise, a
> hand-made wishlist item that omits `wishlistItemId / sku / name / price` renders
> `$0.00`; the shape `SCHEMA.md` documents renders correctly.

---

## 4. Task replay

**12 tasks replayed across both benchmarks, 12 completable.** Driven the way an agent
would — search boxes and links, no direct URL entry unless the task starts there —
on the rebuilt preview at 1280x720.

| task | flow attempted | evaluator | verdict |
|---|---|---|---|
| webarena-188 | order history → newest `Canceled` row | `string_match "365.42"` | ✅ `000000170 · 5/17/23 · $365.42 · Canceled` |
| webarena-465 | search → PDP → Add to Wish List → `/wishlist/?limit=50` | `.products-grid.wishlist` outerText ⊃ product name | ✅ `Tide PODS Spring Meadow Scent HE Turbo Laundry Detergent Pacs, 81 Count` verbatim |
| webarena-521 | `/newsletter/manage/` → check → Save → reload | `[title="General Subscription"].checked` `exact_match "true"` | ✅ `true`, and it survives the reload |
| webarena-528 | `/contact/` → fill `What’s on your mind?` | value ⊃ `refund`, `it broke after three days of use`, `000000180`, `12.99` | ✅ all four |
| webarena-571 | address book → Change Billing Address → set default both → save | both `.box.box-address-*` boxes ⊃ 3 strings | ✅ `231 Willow Way · Suite 100 · Chicago, Illinois, 60601` in **both** boxes — note the mock renders Magento's `Chicago, Illinois, 60601` form, not the task's `IL` input |
| webarena-436 / vwa-325 family | search → PDP → cart → checkout → **Place Order** → cold reload → latest order | `.order-details-items.ordered` ⊃ SKU | ✅ SKU `B07CL9G718` present at `/sales/order/view/order_id/190/` |
| visualwebarena-100 | search `hawaiian shirt` → PDP → wishlist | `.products-grid.wishlist` textContent ⊃ `hawaiian` | ✅ |
| visualwebarena-153 | search `Microsoft Xbox` → PDP | `shopping_get_product_attributes('manufacturer |OR| brand name')` ⊃ `Microsoft` **and** `page_image_query` on `.fotorama__stage__frame` | ✅ `Microsoft Xbox One X 1TB PlayerUnknown's Battlegroun Bundle` → manufacturer `‎Microsoft` (U+200E preserved, as Magento emits) + 2 non-zero frames |
| visualwebarena-168 | search mochi → PDP → pick option → add to cart → `/checkout/cart/` | lambda: `.item-info` find → `td.col.item > div > dl > dd` | ✅ returns `Bubble Milk Tea`, the `exact_match` |
| visualwebarena-295 | search → PDP | `page_image_query` crop of `.fotorama__stage__frame` | ✅ 707 × 707 frame holding a loaded 320 × 320 bitmap |
| `shopping_get_sku_latest_review_rating` family | PDP → Reviews tab, **all 9 SKUs the VWA locators name** | latest review author + rating | ✅ **9 / 9 identical to the source** — see below |
| `page_image_query .product-image-photo` (compare) | 2 PDPs → Add to Compare → compare page | image nodes with real bitmaps | ✅ 2 × 500 × 500, `complete` |

### 4a. Two replays that failed on my first attempt and why neither is a mock bug

Both were checked **against the live source** before being written off:

| symptom | source | conclusion |
|---|---|---|
| `?q=xbox` → none of the first 12 results has manufacturer `Microsoft` | source `?q=xbox` gives `Items 1-12 of 839` whose manufacturers are `Shenzhen Yuyuanxin…`, `HiPALLUSEUDIRECT`, `Hyperkin`, `ReaSnow`, `ViMount`, `Extremerate` — **also no Microsoft** | my flow, not the mock. With the flow an agent would actually use (`Microsoft Xbox`) the task passes on the mock |
| `shopping_get_sku_latest_review_rating("B07SYHF5R2")` → 0 reviews | source PDP 34309 also shows a bare `Reviews` tab and **0 `.review-item`** | the task cannot pass on the source either — upstream annotation defect, not filed |

### 4b. Review anchors — all 9 SKUs named by VWA locators, source vs mock

| SKU | source tab / reviews | mock tab / reviews | |
|---|---|---|---|
| B07SYHF5R2 | `Reviews` / 0 | `Reviews` / 0 | ✅ |
| B095NHLW6F | `Reviews` / 0 | `Reviews` / 0 | ✅ |
| **B097YHDSVG** | `Reviews 3` / 3 | `Reviews 3` / 3 | ✅ |
| B09PQ6G5WL | `Reviews` / 0 | `Reviews` / 0 | ✅ |
| B09QYJJNW2 | `Reviews` / 0 | `Reviews` / 0 | ✅ |
| **B00BH4V6HE** | `Reviews 3` / 3 | `Reviews 3` / 3 | ✅ |
| B09P55GY2P | `Reviews` / 0 | `Reviews` / 0 | ✅ |
| B09P819K5N | `Reviews` / 0 | `Reviews` / 0 | ✅ |
| B09S3PK7R3 | `Reviews` / 0 | `Reviews` / 0 | ✅ |

On `B00BH4V6HE` the latest review renders **character-for-character identically** on
both sides: `One Star · Rating 20% · basically broken · Review by Ben · Posted on 4/21/23`.
**9 / 9 parity**, including the seven that are empty on both.

---

## 5. Console / network / hit-test

### 5a. Console and external requests — 22-page click-through, both servers, both viewports

| server | viewport | pages | console **errors** | external requests | warnings |
|---|---|---|---|---|---|
| dev 5230 | 1920×1080 | 22 | **0** | **0** | 44 — the two pre-existing React Router v7 future-flag warnings, ×22 loads |
| dev 5230 | 1280×720 | 22 | **0** | **0** | 44, same two |
| preview 5231 | 1920×1080 | 22 | **0** | **0** | **0** |
| preview 5231 | 1280×720 | 22 | **0** | **0** | **0** |

The walk covers home, a sorted+limited category, a price-filtered category, search, three
PDPs (multi-image, 4-image, out-of-stock), cart, all account pages, wishlist, reviews,
newsletter, contact, advanced search, popular terms, compare, privacy policy, downloadables
and the 404. The external-request interceptor **aborts** anything not on the mock origin;
nothing was ever aborted.

### 5b. `elementFromPoint` hit-test of every primary control — **0 non-hits at either viewport**

31 controls across 6 pages, each scrolled to centre and probed at its own centre point:

| page | controls verified |
|---|---|
| `/` | `#search`, `a.logo`, `a.action.showcart`, header panel links, a grid tile link |
| `/video-games.html` | `#sorter`, `#limiter`, sort-direction arrow, grid/list toggle, tile `Add to Cart`, tile wishlist, tile compare, pager link, `#toolbar-amount` |
| PDP `76525` | `#qty`, `#product-addtocart-button`, `Add to Wish List`, `Add to Compare`, tab title, **`.fotorama__stage__frame` (707 × 707)**, `.fotorama__nav__frame` (92 × 94), `.fotorama__arr--prev` (80 × 707), option label |
| `/customer/account/` | account-nav link |
| `/catalogsearch/advanced/` | `#name`, `#sku`, `#price`, submit |
| `/checkout/cart/` | qty input, Update, Remove item, Proceed to Checkout |

Header-panel measurements worth recording so they are not misread later: `Skip to Content`
is 1 × 1 and `Compare Products 0 items` is 0 × 0 — both are Magento's own behaviour
(offscreen skip link, hidden empty compare link). `My Account`, `My Wish List`,
`Sign Out` and `Welcome, Emma Lopez!` all render and hit.

---

## ✅ Passing Tests (summary of what was actually driven)

- `.fotorama__stage__frame` exists, is 706.8 × 706.8, holds a loaded product bitmap, and
  is hit-testable on 6 PDPs × dev/preview × 1920/1280
- The active frame matches the source's active image on 5 / 5 products
- Whole fotorama box model within 0.2 px of the source; nav strip, thumbs and border
  offsets **exactly** equal
- 42 / 42 ROUTES.md rows cold, `sid` intact, on both servers
- Rows 5 / 18 / 35 re-verified with real ids rather than placeholders
- Every WA + VWA evaluator selector resolves on its own page
- 42 / 42 evaluator `/media` URLs serve real JPEGs on both servers; unmatched `/media/**` 404s
- Checkout → success → cold reload → latest order, end to end
- Session isolation, injected initial state, `reset`, `state_diff`, `/go` = 125 KB
- 12 / 12 replayed tasks completable
- 9 / 9 review-anchor SKUs identical to the source
- 0 console errors, 0 external requests, 0 non-hits

---

## ❌ Bugs for Dev Agent

**None.** No P0 and no P1 functional bug was found in this round. Nothing regressed from
the fotorama rewrite; the two differences recorded below are P2 and pre-date shard T.

---

## Source-vs-Mock Differences

### DIFF-CLOSE-01 · **P2** · Gallery arrows clamp on the mock; the source loops

| Field | Value |
|-------|-------|
| Path | any multi-image PDP, e.g. `/catalog/product/view/id/8525/` |
| Element | `.fotorama__arr--prev` / `.fotorama__arr--next` |
| Source behavior | The gallery **wraps**. Measured by clicking `next` three times from the initial (last) image: `1_1 → 0 → 1 → 0_1`. Both arrows stayed `opacity: 1`, `pointer-events: auto`, `visibility: visible` and **never received `fotorama__arr--disabled`** at any index. The off-stage frame at `x = +1048.8` on load holds `B07GJX3J66.0.jpg` — gallery index **0** while the active index is **3** — which is itself proof of the wrap. |
| Mock behavior | The gallery **clamps**. On load the next arrow already carries `fotorama__arr--disabled`, `opacity: 0`, `pointer-events: none`; prev walks `1_1 → 0_1 → 1 → 0` and then goes disabled. |
| Visible consequence | Because the mock (correctly, per DEV.part-T §7) opens on the base-role image, and that image is the **last** gallery index on all four multi-image products measured (34309, 76525, 8525, 97705), the `›` arrow the source paints on the right edge of the stage is **absent on the mock at first paint on every multi-image PDP**. Confirmed visually in `/tmp/pw-close/src_8525_pdp.png` vs `/tmp/pw-close/mock_8525_pdp.png`. |
| Fix hint | `src/styles/globals.css:1031-1033` — the comment asserts *"they clamp rather than wrap: at either end the source adds `fotorama__arr--disabled`"*. That is the inverted premise; the source never emits that class with ≥ 2 images. The arrow handlers in `src/pages/ProductPage.jsx` need `(i ± 1 + n) % n` and the `--disabled` branch removed for `n > 1`. Single-image products are already correct on both sides (`display: none`, 0×0 arrows). |

**Why P2 and not P1.** I considered P1 under "pagination semantics differ" and priced it
down deliberately: every gallery image stays reachable on the mock via the thumbnail
strip and the prev arrow, so no capability is lost; the evaluator's target
(`.fotorama__stage__frame`, first match = active) is correct; and no shopping or VWA
task in `assets/task_anchors.md` pages a product gallery. It is also **not a regression
from shard T** — the clamp logic predates the fotorama rewrite; the rewrite only made
it measurable against the source. It does not block the verdict.

### DIFF-CLOSE-02 · **P2** · Arrow glyph is a bordered box, not Magento's sprite chevron

| Field | Value |
|-------|-------|
| Element | `.fotorama__arr__arr` |
| Source | 80 × 80, transparent background, chevron drawn from the Luma sprite `background-image: url(.../static/version1681…)`, `border: 0`, `color: #333` |
| Mock | 32 × 44, `background: rgba(255,255,255,.85)`, `border: 1px solid #d1d1d1`, `color: #555`, inline SVG chevron |
| Impact | Purely cosmetic; it is inside the 0.17 % of pixels that differ on the 34309 element diff. Hit area (`.fotorama__arr`, 80 × 707) is identical to the source, so nothing about clickability changes. |

### Explicitly NOT filed

- **0.2–0.3 px** on `.fotorama__stage` / `__frame` / `.product.media` — the source's
  fotorama JS writes integral `707px` onto a 706.797 px column; the mock uses
  `aspect-ratio: 1/1`. Sub-pixel, unobservable, and the mock's version is viewport-stable.
- **Frame DOM order and count on multi-image products** — analysed in §1d; the mock's
  ordering is strictly better for `query_selector('.fotorama__stage__frame')`.
- **Media resolution** — declared and accepted per the brief.

---

## Round History — round 10 → round 11 (this round)

| carried item | status |
|---|---|
| `AUDIT.part-todo-reconcile` **NOT-DONE-1** — `.fotorama__stage__frame` matched 0 nodes, 7 `page_image_query` tasks unresolvable | ✅ **FIXED and independently verified.** Nodes exist, are 706.8 × 706.8, hold the real bitmap, are hit-testable, and the active frame matches the source image-for-image on 5 / 5 products |
| `TEST.round3-stale` **DIFF-003** — PDP opens on the wrong gallery slide (recorded N/A by shard R) | ✅ **FIXED for real**, confirmed on the two 4-image products where the base image is neither `gallery[0]` nor obvious |
| `DEV.part-M` open item — `.product.media` 694 vs source 707 | ✅ closed; 706.8 on both, at 1920 **and** 1280 |
| Round 10's 42 / 42 route parity, 0 P0 / 0 P1 | ✅ **holds** — re-derived from scratch on a fresh `npm run build`, on both servers |
| Round 10's `#opc-sidebar`, price-chain and title-chain fixes | ✅ **not regressed** |
| Newly measured this round | DIFF-CLOSE-01 (gallery clamp vs loop, **P2**), DIFF-CLOSE-02 (arrow glyph styling, **P2**) — neither is a regression from shard T |

## Method

- Real chromium via `LD_LIBRARY_PATH=/tmp/sysroot/...`; node 20.18.1 from `/tmp`.
- `npm run build` re-run from scratch at the start of the round; preview served from
  that `dist`.
- Source login asserted **hard** on every source run: `GET /customer/account/` must
  render `h1 == "My Account"`. **It fired once** — a run aborted with
  `SOURCE LOGIN FAILED: h1 = ['Customer Login']` when the form submit raced, and was
  re-run with the retrying login. Exactly the false-pass the brief warned about; no
  source measurement in this report was taken from an unauthenticated session.
- Source strictly read-only: navigation, `getComputedStyle`, `getBoundingClientRect`,
  element screenshots, and gallery arrow clicks (a pure client-side view change — no
  form submit, no POST, no store mutation). No cart, order, account or review write
  ever touched the source.
- Scratch under `/tmp/pw-close/`, sids prefixed `cl_`. Findings written into this file
  as each was confirmed, not batched at the end.

## Verdict

**0 P0 · 0 P1 functional · 0 P0/P1 source-vs-mock · 42 / 42 ROUTES.md rows verified**

Remaining known issues, **P2 only**:
- DIFF-CLOSE-01 — product-gallery arrows clamp where the source loops; the `›` arrow is
  therefore absent at first paint on multi-image PDPs. Every image stays reachable; no
  task pages a gallery.
- DIFF-CLOSE-02 — `.fotorama__arr__arr` is a 32 × 44 bordered chevron rather than
  Magento's 80 × 80 sprite. Hit area unchanged.
- Declared and accepted: mock media are downsampled copies (≤ 320 px for ~91 % of files).
- Sub-pixel: 0.2–0.3 px on the fotorama stage box, from the source's integral inline
  `707px` against the mock's `aspect-ratio: 1/1`.

```
TEST COMPLETE: webarena_shopping_mock — PASS ✅

Round:          11 (closing acceptance)
Route parity:   42/42 ROUTES.md rows verified cold, params + sid intact — on dev AND rebuilt preview
The fix:        .fotorama__stage__frame resolves non-zero with the real product image on
                24/24 PDP × server × viewport combinations; active frame matches the live
                source on 5/5 products; whole fotorama box model within 0.2 px, nav strip exact
Evaluator DOM:  27/27 WA+VWA anchor selectors resolve · 42/42 evaluator /media URLs serve real
                JPEGs on both servers · 9/9 review-anchor SKUs identical to the source
Task replay:    12/12 sampled tasks completable end to end across both benchmarks
Interactions:   31/31 primary controls hit-tested at 1920x1080 AND 1280x720, 0 non-hits
Source diff:    0 P0/P1 differences vs http://localhost:7770 (login asserted hard)
Session isolation: two sids independent, injected initial state loads, reset restores ✅
/go endpoint:   state_diff reflects every tested mutation; 125 KB with the catalogue out of state ✅
Console/network: 0 errors, 0 external requests over a 22-page walk × 4 server/viewport combinations
```
