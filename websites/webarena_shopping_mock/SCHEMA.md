# webarena_shopping_mock — State Schema

Mock of the WebArena **Shopping (One Stop Market)** site — Magento 2 storefront,
container `shopping`, image `shopping_final_0712`, source `http://localhost:7770`
(absolute base `http://10.186.197.203:7770/`).

The app boots **pre-logged-in as Emma Lopez** (`emma.lopez@gmail.com`,
`customer_entity.entity_id = 27`). There is no login, no logout gate and no
network traffic at runtime.

---

## 1. Static catalog vs. session state

Only **mutable** entities live in session state. The catalog is static reference
data imported directly by components and never enters the state tree — the whole
state is POSTed, diffed and returned by `/go` on every call, and the catalog is
~4.3 MB.

| File | Rows | Loaded by | In state? |
|---|---|---|---|
| `src/data/products.json` | 1 105 | `utils/catalog.js` | no |
| `src/data/categories.json` | 301 | `utils/catalog.js` | no |
| `src/data/reviews.json` | 3 080 | `utils/catalog.js` | no |
| `src/data/productOptions.json` | 424 groups | `utils/catalog.js` | no |
| `src/data/productDescriptions.json` | 1 105 | `utils/catalog.js` | no |
| `src/data/listings.json` | 121 captured listings | `utils/catalog.js` | no |
| `src/data/homepage.json` | 1 | `utils/catalog.js` | no |
| `src/data/searchTerms.json` | 60 | `utils/catalog.js` | no |
| `src/data/storeConfig.json` | 1 | `utils/catalog.js` | no |
| `src/data/privacyPolicy.js` | CMS HTML | `pages/CmsPages.jsx` | no |
| `src/data/customer.json` | 1 customer + 1 address | `utils/dataManager.js` | **yes** |
| `src/data/cart.json` | 3 quote lines | `utils/dataManager.js` | **yes** |
| `src/data/orders.json` | 37 orders / 100 lines | `utils/dataManager.js` | **yes** |
| `src/data/wishlist.json` | 0 | `utils/dataManager.js` | **yes** |

`createInitialData()` output is **65 KB** (66 610 bytes, measured via
`GET /go?sid=<fresh>`).

---

## 2. State tree

`createInitialData()` in `src/utils/dataManager.js`.

| Key | Type | Initial value | Notes |
|---|---|---|---|
| `customer` | object | Emma Lopez, id 27 | `id`, `email`, `firstname`, `lastname`, `dob`, `gender`, `groupId`, `createdAt`, `defaultBilling` (26), `defaultShipping` (26), `assistanceAllowed` (`false`) |
| `addresses` | array | 1 address, id 26 | `{id, firstname, lastname, company, street[], city, region, regionId, postcode, countryId, country, telephone, isDefaultBilling, isDefaultShipping}` |
| `cart` | object | quote 255, 3 lines, subtotal $350.42 | `{quoteId, items[]}`; item = `{itemId, productId, sku, name, price, qty, options[]}`; option = `{optionId, optionTypeId, label, value}` |
| `orders` | array | 37 orders, `000000148`–`000000189` | Shape per `assets/data_model.md` §6. Newest-first is computed at render time, not stored |
| `wishlist` | object | `{items: []}` | item = `{wishlistItemId, productId, sku, name, price, qty, description, addedAt}` |
| `compareList` | object | `{items: []}` | item = `{productId, sku, name}` |
| `myReviews` | array | `[]` | Reviews submitted this session; concatenated on top of `reviews.json` on the PDP |
| `contactSubmissions` | array | `[]` | `{name, email, telephone, comment, submittedAt}` |
| `newsletterSubscribed` | boolean | `false` | `newsletter_subscriber` has no row for Emma on the source |
| `nextOrderIncrementId` | number | `190` | Next increment id after `000000189` |
| `nextOrderEntityId` | number | `190` | |
| `nextReviewId` | number | `400000` | |
| `nextAddressId` | number | `27` | |
| `nextCartItemId` | number | `4` | |
| `nextWishlistItemId` | number | `1` | |
| `lastPlacedOrderId` | number | *(absent)* | Written by `placeOrder`; read by the success page |

### 2.1 Default IDs

The real Magento identifiers a task injector or evaluator will reference.

| Entity | Id | Notes |
|---|---|---|
| Customer | `27` | Emma Lopez, `emma.lopez@gmail.com`, group 1, created `2023-04-23 16:42:28` |
| Address | `26` | 101 S San Mateo Dr, San Mateo, California 94010, US, T 6505551212 — both default billing and default shipping |
| Cart / quote | `255` | 3 lines, `itemId` 1–3, subtotal **$350.42** |
| Cart line products | `15033` (B087QSCXGT, $250.80) · `15787` (B08JLHHCM6, $40.99) · `10617` (B09LQTV3RX, $58.63, options Size=Large `23919` / Color=Blue `23922`) | |
| Orders | `entityId` 148–189 → `incrementId` `000000148`–`000000189` | 37 rows: 25 complete, 9 canceled, 3 pending. **No** processing / on-hold / out-for-delivery order exists |
| Frequently-referenced orders | `170` (canceled, 5/17/23, $365.42) · `180` (complete, March 11 2023, $65.32) · `189` (pending, 5/2/23, $754.99) | |
| Wish list | — | boots empty |
| Compare list | — | boots empty |
| Next-id counters | order `190` · review `400000` · address `27` · cart item `4` · wishlist item `1` | a placed order becomes `000000190` |

Static catalog ids commonly used by tasks (not in state, but needed to build one):
product `76525` (6S Wireless Headphones, 12 reviews), `17500` (87 reviews, 9
review pages), `10617` (has required Size/Color options); category `60`
(Headphones, 631 items), `145` (Shoes), `222` (Earbud Headphones).

### 2.2 Minimal Inject Example

`POST /post?sid=<sid>` with `{"action":"set","state":{…}}`. Any key you omit is
filled from `createInitialData()` (`initializeData` merges your object over the
defaults), so the smallest valid body is a single key:

```json
{ "action": "set", "state": { "newsletterSubscribed": true } }
```

A partial body like this is fully supported and yields `state_diff == {}` on a
freshly booted session — see §2.3 for how the baseline is reconciled.

A fuller example — empty cart, one item already wish-listed, ready for a
"add X to your cart" task:

```json
{
  "action": "set",
  "state": {
    "cart": { "quoteId": 255, "items": [] },
    "wishlist": {
      "items": [
        {
          "wishlistItemId": 1,
          "productId": 76525,
          "sku": "B086GNDL8K",
          "name": "6S Wireless Headphones Over Ear,Noise Canceling Hi-Fi Bass Foldable Stereo Wireless Kid Headsets Earbuds with Built-in Mic, Micro SD/TF, FM for iPhone/Samsung/iPad/PC (Black & Gold)",
          "price": 19.99,
          "qty": 1,
          "description": "",
          "addedAt": "2023-05-01 12:00:00"
        }
      ]
    },
    "nextWishlistItemId": 2,
    "nextCartItemId": 4
  }
}
```

Read back with `GET /go?sid=<sid>` → `{initial_state, current_state, state_diff}`.
Restore with `{"action":"reset"}`; it rewrites the current state from the
baseline immediately, and the browser picks it up on its next page load (§4.1
case (a)) — there is no push channel to a page that is already open.

### 2.3 How the `/go` baseline is established

`{"action":"set"}` writes your object to **both** the current and the initial
state file. When that object is partial, it is not yet a usable `/go` baseline:
the app merges it over `createInitialData()` and republishes the whole tree, so
a diff against the partial object would report all 15 keys as mutations.

The app therefore normalises the baseline itself. On **every** boot for a `sid`
(first load, refresh or deep link — before any UI is interactive) it posts:

```json
{ "action": "set_initial", "state": { …the merged tree… } }
```

and only then posts the usual `set_current`. `set_initial` overwrites the
initial state file, so `state_diff` is `{}` on a freshly injected session
regardless of how few keys you injected. It is posted on every boot rather than
only the first because the server's state files can vanish under a live session
(`.mock-states/` is gitignored) and nothing else would restore them — see §4.1.

**Ordering guarantee.** `set_initial` is refused — with
`"Initial state left untouched: session already mutated."` — whenever the
stored current state exists and differs from the stored baseline. A cold load
in a fresh browser context (empty `localStorage`) on a `sid` that has already
been driven therefore cannot adopt post-mutation state as the baseline and
silently erase a real `state_diff`.

`set_initial` is an app-internal verb. Task setup should keep using `set`;
there is no reason for an injector to call it.

---

## 3. Observable State Changes

Every one of these flows through `AppContext.setState` → `saveState()` →
`POST /post?action=set_current` and therefore shows up in `/go`'s `state_diff`.

| User action | Route | State keys changed |
|---|---|---|
| Add to cart from a grid tile | any listing | `cart.items`, `nextCartItemId` |
| Add to cart from the PDP (qty + custom options) | `/<url_key>.html` | `cart.items`, `nextCartItemId` |
| Add to cart via `/checkout/cart/add/product/:id/` | that route | `cart.items`, `nextCartItemId` |
| Change a cart line qty (cart page or mini-cart) | `/checkout/cart/` | `cart.items` |
| Update Shopping Cart | `/checkout/cart/` | `cart.items` |
| Remove item | `/checkout/cart/`, `/checkout/cart/delete/id/:id/` | `cart.items` |
| Edit a cart line's options | `/checkout/cart/configure/id/:itemId/product_id/:productId/` | `cart.items` |
| Move to Wishlist | `/checkout/cart/` | `cart.items`, `wishlist.items`, `nextWishlistItemId` |
| Place Order | `/checkout/` → `/checkout/onepage/success/` | `orders`, `cart.items` (emptied), `nextOrderIncrementId`, `nextOrderEntityId`, `lastPlacedOrderId` |
| Pick a shipping address card at checkout, then Place Order | `/checkout/#shipping` → `/checkout/onepage/success/` | the new order's `shippingAddress`/`billingAddress` record the **selected** address, not `customer.defaultShipping` |
| Reorder | `/sales/order/view/…`, `/sales/order/history/`, `/customer/account/`, `/sales/order/reorder/order_id/:id/` | `cart.items`, `nextCartItemId` |
| Add to Wish List (tile heart or PDP button) | any listing, `/<url_key>.html`, `/wishlist/index/add/product/:id/` | `wishlist.items`, `nextWishlistItemId` |
| Update Wish List (qty / comment) | `/wishlist/` | `wishlist.items` |
| Remove wish-list item | `/wishlist/`, sidebar block | `wishlist.items` |
| Add wish-list item to cart | `/wishlist/` | `cart.items`, `wishlist.items`, `nextCartItemId` |
| Add to Compare | any listing, `/<url_key>.html` | `compareList.items` |
| Remove from Compare / Clear All | sidebar block, `/catalog/product_compare/index/` | `compareList.items` |
| Submit Review | `/<url_key>.html` Reviews tab | `myReviews`, `nextReviewId` |
| Save account information | `/customer/account/edit/` | `customer` (`firstname`, `lastname`, `email` when *Change Email* is ticked, and `assistanceAllowed` from *Allow remote shopping assistance*) |
| Save address (new) | `/customer/address/new/` | `addresses`, `nextAddressId`, `customer.defaultBilling`/`defaultShipping` if flagged |
| Save address (edit) | `/customer/address/edit/id/:id/` | `addresses`, `customer.defaultBilling`/`defaultShipping` if flagged |
| Delete address | `/customer/address/` | `addresses` |
| Newsletter Save | `/newsletter/manage/` | `newsletterSubscribed` |
| Footer newsletter Subscribe | any page | `newsletterSubscribed` |
| Contact form Submit | `/contact/` | `contactSubmissions` |

---

## 4. Session API

`vite.config.js` registers `secureMockApiPlugin()` first, then the `mock-api`
plugin under **both** `configureServer` and `configurePreviewServer`.

| Endpoint | Method | Purpose |
|---|---|---|
| `/post?sid=` | POST | `{action: 'set' \| 'set_current' \| 'set_initial' \| 'reset', state}` — `set_initial` republishes the `/go` baseline and is app-internal, see §2.3 |
| `/state?sid=` | GET | `{stored_state, has_custom_state, initial_state, has_initial_state, sid}` |
| `/go?sid=` | GET | `{initial_state, current_state, state_diff}` |
| `/upload?sid=` | POST | multipart upload (unused by this site, kept for contract parity) |
| `/files/:sid/:name` | GET | uploaded file download |

State files live at `.mock-states/<sid>.json` and `.mock-states/<sid>.initial.json`;
`sid` is sanitised with `sid.replace(/[^a-zA-Z0-9_-]/g, '')`.

`initial_state` / `has_initial_state` on `/state` are additive to the hub
contract. The app reads them at boot to tell *"the server has no record of this
sid"* apart from *"the server holds a state this browser did not write"*; see
§4.1. A consumer that only knows `stored_state` / `has_custom_state` is
unaffected.

### 4.1 Boot, refresh and reset

The server owns the reward signal, so **the browser never renders a session the
server does not know about, and never lets the server hold a session the browser
has diverged from.** Every boot — first load, refresh, deep link — runs the same
three-way decision in `AppContext` (`src/context/AppContext.jsx`), against
`GET /state?sid=`:

| # | Condition | Behaviour |
|---|---|---|
| **a. Adopt** | server has a current state **and it differs from `localStorage`** | The server wins. Its state is merged over `createInitialData()` (an inject may be partial) and becomes what the app renders. `localStorage`'s baseline is replaced by the server's baseline when it has one. |
| **b. Republish** | server agrees with `localStorage`, or has nothing, and this browser holds a baseline for the `sid` | Render from `localStorage`, then post `set_initial` (the stored baseline) followed by `set_current` (the stored current), so a server that has lost its state files is repaired. |
| **c. Cold boot** | neither side has anything | Seed from `createInitialData()`, publish it as both baseline and current. |

Every path ends with `set_initial` then `set_current`, in that order.

Why each case exists:

- **(a)** is what makes a task inject win over stale `localStorage`. A rollout
  retry that reuses a `sid` in a browser profile that already booted it would
  otherwise render the *previous* rollout's cart and ignore the injected state
  entirely. It is also how a server-side `{"action":"reset"}` reaches the UI:
  `reset` rewrites `<sid>.json` from the baseline, which then differs from
  `localStorage`, so the next page load adopts it. `AppContext.resetState()`
  covers the other direction (client-initiated), and goes through `setState` so
  the reset is itself posted as `set_current`.
- **(b)** is what keeps `/go` truthful when `.mock-states/` is absent —
  it is gitignored, so it is **empty on every fresh deploy** while a persistent
  browser profile may still hold a mutated session. Without the republish, `/go`
  falls back to `createInitialData()` and reports the DEFAULT tree with
  `state_diff: {}` while the agent's browser shows a mutated one.

**Republishing can never erase a real diff.** `set_initial` is refused whenever
the stored current state exists and differs from the stored baseline (§2.3), so
on a plain reload of an already-driven `sid` the baseline write is a no-op and
`state_diff` survives. It only lands when the baseline file is genuinely missing.

**`set_current` never establishes the baseline.** It carries the *post*-mutation
tree; adopting that as `initial_state` would make `state_diff` `{}` on a mutated
session, and — because the `set_initial` guard would then see
`current !== initial` — would make the corruption permanent and silent. A
missing baseline instead degrades `/go` to `initial = current` only until the
next boot's `set_initial`, which finds no baseline file, is therefore unguarded,
and repairs it.

**`{"action":"set"}` always (re)writes the baseline**, even if the `sid` already
has one. That verb is the task injector declaring the session's starting point,
so a baseline left behind by a previous rollout must not survive it.

> **Hardened mode (`CUA_GYM_HARDENED=1`) is a known gap, and it is not this
> app's to close.** `shared/secureMockApiPlugin.mjs` serves `/state` with a
> different shape and answers `400 Unknown action` for `set_initial`, so the
> baseline normalisation in §2.3 and cases (a)/(b) above do not apply there.
> Boot degrades safely — both `/state` fields read as absent and the app takes
> case (b)/(c) exactly as it did before — but a partial inject will still show
> up as phantom keys in `state_diff`. Tracked in `AUDIT.md` "Cross-shard notes".

---

## 5. Rendering rules that depend on the seed

- **Timezone is load-bearing.** `general/locale/timezone = America/New_York`.
  Order 170 stores `2023-05-18 03:39:44` UTC and must print `5/17/23`. Grids use
  `M/D/YY`; the order view uses `March 11, 2023`. See `src/utils/format.js`.
- **Listing counts come from the source, not from the seed.** `listings.json`
  holds 121 captured listings (48 of them searches) with the source's own
  ordering, `totalCount` and facet buckets. `resolveListing()` prefers an exact
  captured listing, then a captured listing with the same filters (for the
  count), then the seed. Category pages with no capture fall back to
  `categories[].dbProductCount`.
- **Search is fuzzy on the source.** `q=asdfghjkl` returns `1 Item`. Captured
  queries reproduce that exactly; uncaptured queries fall back to token matching
  over `products.json[].name`/`sku` and report a seed-derived count.
- **`?cat=<id>` on a parent category** filters to a descendant while the `<h1>`
  stays the parent's name.
- **`price=` stacks on commas** (`price=0-10,0-100`); Magento intersects the
  buckets so the narrowest wins, and the "Now Shopping by" chip shows only that
  one.
- **Rating is a percentage-width clip**, not a rounded star count
  (`title="73%"`), driven by `products[].ratingSummary`.
- **Custom options sort by `sort_order ASC, title ASC`** — which is why the
  topiary PDP shows `Color` above `Size`.
- **The home-page pager param is `pbaocw`, not `p`.**
- **Flat-rate shipping is $5.00 _per item_**, not a flat $5 or $15 per order.
  `carriers/flatrate` is `price = 5.00, type = per item`; every one of the 37
  seeded orders satisfies `shippingAmount == 5 × totalQtyOrdered`. The
  `$15.00` in `assets/screenshots/reference/28-checkout.png` is `5 × 3` for
  Emma's 3-line boot cart — do not hardcode it.
- **The store has no phone number.** `general/store_information/phone` is NULL
  and none is rendered anywhere.
- **Emma's orders are only `complete` (25), `canceled` (9) and `pending` (3).**
  There is genuinely no processing / on-hold / out-for-delivery order.

## 6. Product images

Real product JPEGs were copied out of the container into
`public/media/catalog/product/<A>/<B>/<SKU>.<n>.jpg`, keeping the source path
shape so `products.json` values resolve unchanged — 2 080 files, ~55 MB, covering
every seeded product. `ProductImage` falls back to a deterministic inline SVG
placeholder keyed off the SKU if a file is ever missing, so there is never a
broken image and never an external request.
