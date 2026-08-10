# webarena_shopping_mock — State Schema

Mock of the WebArena **Shopping (One Stop Market)** site — Magento 2 storefront,
container `shopping`, image `shopping_final_0712`, source `http://localhost:7770`
(absolute base `http://10.186.197.203:7770/`).

The app boots **pre-logged-in as Emma Lopez** (`emma.lopez@gmail.com`,
`customer_entity.entity_id = 27`). There is no login, no logout gate and no
network traffic at runtime.

> **Figures current as of round 12 (2026-08-09)** — the final audit, over the
> post-shard-S / post-shard-T tree. Every seed row below was re-measured against
> container `shopping` whole-population, and every byte figure against a `dist/`
> built by the auditor.

---

## 1. Static catalog vs. session state

Only **mutable** entities live in session state. The catalog is static reference
data imported directly by components and never enters the state tree — the whole
state is POSTed, diffed and returned by `/go` on every call, and the catalog is
**65 MB** on disk.

| File | Rows | Loaded by | In state? |
|---|---|---|---|
| `src/data/products.json` | **11 358** | `utils/catalog.js` (static import) | no |
| `src/data/categories.json` | 301 | `utils/catalog.js` (static import) | no |
| `src/data/listings.json` | **1 554** captured listings (**629** under `/catalogsearch/`), indexed to **1 552** distinct exact keys — see §6.1 | `utils/catalog.js` (static import) | no |
| `src/data/homepage.json` | 1 | `utils/catalog.js` (static import) | no |
| `src/data/searchTerms.json` | 100 | `utils/catalog.js` (static import) | no |
| `src/data/storeConfig.json` | 1 | `utils/catalog.js` (static import) | no |
| `src/data/productDescriptions.json` | **11 358** (one per seeded product; 0 gaps) | **pipeline artifact only — no longer imported.** `build_seed.py` / `clean_desc.py` / `vwa_merge.py` / `vwa_backfill.py` still write it and the audit still compares it against `catalog_product_entity_text`; the app reads the shards below | no |
| `src/data/descriptions/d00…d31.json` | the same **11 358**, split by `id % 32` (R8-001, `assets/dumps/build_desc_shards.py`; `--check` proves the merge is byte-identical) | `utils/catalog.js` (**`import.meta.glob`**, one chunk each, ~1.1 MB raw / ~0.31 MB gz). A PDP pulls **one**; search / advanced search / compare / list-mode tiles pull all 32 | no |
| `src/data/reviewCounts.json` | 3 351 products → seeded review count (35 710 B; `assets/dumps/build_review_counts.py`) | `utils/catalog.js` (**static import**, rides in the `seed` chunk) — lets the PDP print its `Reviews N` tab label without the 5.18 MB-gz review corpus | no |
| `src/data/productOptions.json` | **4 884** groups | `utils/catalog.js` (**`import()`**) | no |
| `src/data/reviews.json` | **32 594** (every approved container review for the seeded population — see §5) | `utils/catalog.js` (**`import()`**) | no |
| `src/searchindex/s00…s63.json` | prebuilt inverted token index over the 11 358 name/sku/description documents — **73 404** tokens, **1 944 170** postings (base-36 delta-encoded, `.`-joined), 6.2 MB raw across **64** shards (shard Q). No token appears in two shards | `utils/catalog.js` (**`import.meta.glob`**). A search pulls only the shards its query's tokens hash into — **2** for the two-word `zebra pillow` — instead of the 34.71 MB description corpus | no |
| `src/data/privacyPolicy.js` | CMS HTML | `pages/CmsPages.jsx` | no |
| `src/data/customer.json` | 1 customer + 1 address | `utils/dataManager.js` | **yes** |
| `src/data/cart.json` | 3 quote lines (item ids 554–556) | `utils/dataManager.js` | **yes** |
| `src/data/orders.json` | 37 orders / 100 lines | `utils/dataManager.js` | **yes** |
| `src/data/wishlist.json` | 0 | `utils/dataManager.js` | **yes** |

`createInitialData()` output is **65 KB** (66 634 bytes, measured via
`GET /go?sid=<fresh>` → `initial_state`); `orders` is 60 037 of those bytes. The
full `/go` body (initial + current + diff) is **123 357 B**.

### 1.1 Deferred catalog chunks — per-view gating (round 8)

`productDescriptions`, `productOptions` and `reviews` are **not** statically
imported. `utils/catalog.js` tracks the three `import()`ed modules individually
(`ensureDetail(['descriptions'])`, …) with a subscription so an installed module
re-renders whatever view is waiting on it. The synchronous readers
(`getDescription`, `getOptions`, `reviews`, `buildSearchCorpus`) keep working
unchanged once a module is installed. Loading is fired twice:

- `src/main.jsx` calls `loadCatalogDetail()` at module entry, before React
  mounts, so all three chunks are in flight from t=0. It no longer gates
  anything.
- `src/context/AppContext.jsx:88` awaits **`options` only**:
  `Promise.all([fetchServerState(sid), ensureDetail(['options'])])`. `options`
  stays because it is read from *synchronous mutators* (`addToCart` →
  `sortLineOptions`, `reorder`) rather than from render.

Per-view requirements (`components/DetailGate.jsx` → `useDetailReady(mods)`,
called in the page component; `components/Page.jsx` renders the empty
`<main id="maincontent">` shell with the chrome on screen while modules land):

| view | waits on |
|---|---|
| `/`, category grid, cart, checkout, account, orders, wishlist | nothing |
| category `?product_list_mode=list`, compare | `descriptions` |
| **search** | the **token-index shards** its query's terms hash into (shard Q) — *not* `descriptions` |
| **PDP** | all three (Details tab, option fields, review list) |
| `/review/product/listAjax/` | `reviews` |

> **Round-12 correction.** The two tables below were written at round 8, before
> shard Q replaced the raw-description search matcher with the prebuilt index.
> They are kept for the history of the R8-001 fix; the *current* per-route chunk
> cost is the round-12 table further down, and the row that moved is **search**:
> it no longer pulls `seed-descriptions-*` at all.

Measured on the rebuilt `dist/` at 1280×720, cold context per route, in-page
`MutationObserver` + `PerformanceResourceTiming` (polling from the driver
mis-measures: a big synchronous JSON parse blocks `page.evaluate`):

| route | chrome painted | main content readable | seed chunks before main content | bytes before main content |
|---|---|---|---|---|
| `/` | 542 ms | **570 ms** | **2 / 4** | 2.35 MB gz / 12.50 MB raw |
| category | 520 ms | **554 ms** | **2 / 4** | 2.35 MB gz / 12.50 MB raw |
| `/checkout/cart/` | 489 ms | **509 ms** | **2 / 4** | 2.35 MB gz / 12.50 MB raw |
| `/sales/order/history/` | 500 ms | **521 ms** | **2 / 4** | 2.35 MB gz / 12.50 MB raw |
| **PDP** | 583 ms | **1 463 ms** | **4 / 4** | **16.88 MB gz / 65.30 MB raw** |
| **search** | 486 ms | **1 449 ms** | **4 / 4** | **16.88 MB gz / 65.30 MB raw** |

The app-wide `Loading...` is gone — no route shows it at any point.

| Chunk | Raw | gzip | Blocking main content on |
|---|---|---|---|
| `index.html` | 552 B | — | every route |
| `index-*.css` | 42.1 KB | 8.3 KB | every route |
| `vendor-*.js` (react, router) | 164.0 KB | 53.3 KB | every route |
| `index-*.js` (app) | 181.9 KB | 44.0 KB | every route |
| `seed-*.js` (products, categories, listings, homepage, searchTerms, storeConfig) | 9.12 MB | 1.97 MB | every route — static import |
| `seed-options-*.js` | 3.38 MB | 0.39 MB | every route — awaited in the boot gate |
| `seed-descriptions-*.js` | 34.71 MB | 9.35 MB | **PDP, search, compare, list mode** |
| `seed-reviews-*.js` | 18.09 MB | 5.19 MB | **PDP, `/review/product/listAjax/`** |

So the honest first-paint cost is **two numbers**, not one: **2.35 MB gzip /
12.50 MB raw** for the home page, categories, cart, checkout and account, and
**16.88 MB gzip / 65.30 MB raw** for the PDP and the search page. `dist/` is
**339 MB** total, of which `public/media` is 276 MB.

**Round-12 measurement — the chunk set each route actually fetches on the
shipping build.** Cold browser context per route, `vite preview`, 1280×720,
`PerformanceResourceTiming` read in-page after `networkidle` (so these are
*fetched* bytes, encoded/gzip, not merely blocking bytes):

| route | seed chunks | seed bytes (encoded) | total JS+CSS (encoded) | `Loading…` |
|---|---|---|---|---|
| `/` | **3** | 7.54 MB | 7.65 MB | no |
| category (`/video-games.html`) | **3** | 7.54 MB | 7.65 MB | no |
| `/checkout/cart/` | **3** | 7.54 MB | 7.65 MB | no |
| **search, uncaptured** (`?q=zebra+pillow`) | **5** | 7.66 MB | 7.77 MB | no |
| **PDP** (`/catalog/product/view/id/34309/`) | **4** | 7.86 MB | 7.97 MB | no |

The search route's 5 are `seed`, `seed-options`, `seed-reviews` and **two token-index
shards** (`s23`, `s27`) — `seed-descriptions-*` is **absent**, which is R8-001's
fix landing. The PDP's 4 are `seed`, `seed-options`, `seed-reviews` and exactly
**one** description shard (`d05` for id 34309), never all 32.

`seed-reviews-*` is fetched on every route because `src/main.jsx` kicks
`loadCatalogDetail()` off before React mounts; it is not *awaited* by any route
but the PDP and `/review/product/listAjax/`, which is why no route shows
`Loading…`.

Remaining lever: the PDP needs all three by construction unless the
description/review panes are allowed to fill in after the shell (which would
reintroduce a flash).

---

## 2. State tree

`createInitialData()` in `src/utils/dataManager.js`.

| Key | Type | Initial value | Notes |
|---|---|---|---|
| `customer` | object | Emma Lopez, id 27 | `id`, `email`, `firstname`, `lastname`, `dob`, `gender`, `groupId`, `createdAt`, `defaultBilling` (26), `defaultShipping` (26), `assistanceAllowed` (`false`) |
| `addresses` | array | 1 address, id 26 | `{id, firstname, lastname, company, street[], city, region, regionId, postcode, countryId, country, telephone, isDefaultBilling, isDefaultShipping}` |
| `cart` | object | quote 255, 3 lines (`itemId` 554–556), subtotal $350.42 | `{quoteId, items[]}`; item = `{itemId, productId, sku, name, price, qty, rowTotal, options[]}`; option = `{optionId, label, optionTypeId, value}`. `options` is stored **sorted by `sort_order ASC, optionId ASC`** by `sortLineOptions()` (`AppContext.jsx:29-39`) at write time — `addToCart`, `updateCartItem`, `reorder` and, transitively, `placeOrder` all go through it, and no render-time re-sort remains. Seeded lines with no `optionId` pass through untouched |
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
| `nextCartItemId` | number | `557` | Derived at boot as `max(cart.items[].itemId) + 1` over the seeded cart (554/555/556), **not** hard-coded — a fresh line must not shadow a seeded, URL-addressable one |
| `nextWishlistItemId` | number | `1` | |
| `lastPlacedOrderId` | number | *(absent)* | Written by `placeOrder`; read by the success page |

### 2.1 Default IDs

The real Magento identifiers a task injector or evaluator will reference.

| Entity | Id | Notes |
|---|---|---|
| Customer | `27` | Emma Lopez, `emma.lopez@gmail.com`, group 1, created `2023-04-23 16:42:28` |
| Address | `26` | 101 S San Mateo Dr, San Mateo, California 94010, US, T 6505551212 — both default billing and default shipping |
| Cart / quote | `255` | 3 lines, `itemId` **554–556**, subtotal **$350.42** |
| Cart line products | `15033` (B087QSCXGT, $250.80) · `15787` (B08JLHHCM6, $40.99) · `10617` (B09LQTV3RX, $58.63, options Size=Large `23919` / Color=Blue `23922`) | |
| Orders | `entityId` 148–189 → `incrementId` `000000148`–`000000189` | 37 rows: 25 complete, 9 canceled, 3 pending. **No** processing / on-hold / out-for-delivery order exists |
| Frequently-referenced orders | `170` (canceled, 5/17/23, $365.42) · `180` (complete, March 11 2023, $65.32) · `189` (pending, 5/2/23, $754.99) | |
| Wish list | — | boots empty |
| Compare list | — | boots empty |
| Next-id counters | order `190` · review `400000` · address `27` · cart item `557` · wishlist item `1` | a placed order becomes `000000190` |

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
    "nextCartItemId": 557
  }
}
```

Read back with `GET /go?sid=<sid>` → `{initial_state, current_state, state_diff}`.
Restore with `{"action":"reset"}`; it rewrites the current state from the
baseline immediately, and the browser picks it up on its next page load (§4.1
case (a)) — there is no push channel to a page that is already open.

### 2.3 How the `/go` baseline is established

`{"action":"set"}` normalises a partial object over `createInitialData()` and
writes that complete tree to both current and initial state before responding.
A freshly injected session therefore has `state_diff == {}` even before a
browser opens.

The browser uses an internal race-safe `restore` action only when state files
are genuinely absent. It fills missing current/baseline files while existing
files still equal the browser's view; if a concurrent task `set` wins, restore
returns `restored:false` and the browser re-fetches the injected state.
`set_initial` remains accepted for backward compatibility, but normal task
setup and browser boot do not rely on it.

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
| ↳ order-line ids | — | The new order's `items[].itemId` continue from `max(itemId)` across **all** seeded order lines, allocated at place time (`AppContext.jsx:432-434`). There is no `nextOrderItemId` state key. The old `100000 + idx` scheme collided, and the order view renders `id="order-item-row-<itemId>"`, so duplicates were addressable |
| Pick a shipping address card at checkout, then Place Order | `/checkout/#shipping` → `/checkout/onepage/success/` | the new order's `shippingAddress`/`billingAddress` record the **selected** address, not `customer.defaultShipping` |
| `+ New Address` at checkout → fill the popup → `Ship Here` | `/checkout/#shipping` (`#opc-new-shipping-address` modal) | `addresses`, `nextAddressId`; the new card is auto-selected, so a subsequent Place Order writes it into the order. Goes through the same `saveAddress()` action, so it is visible to `/go` rather than being UI-only |
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
| `/go?sid=` | GET | `{initial_state, current_state, state_diff}`; a missing baseline falls back to `createInitialData()`, never to current state |
| `/upload?sid=` | POST | multipart upload (unused by this site, kept for contract parity) |
| `/files/:sid/:name` | GET | uploaded file download |

Uploads are content-addressed and isolated by SID. Legacy `reset` restores JSON
state but deliberately leaves session fixture files available.

State files live at `.mock-states/<sid>.json` and `.mock-states/<sid>.initial.json`.
A supplied `sid` must fully match `[A-Za-z0-9_-]{1,128}`; invalid and empty
supplied values are rejected instead of being lossy-sanitised into a colliding
filename. Omitting `sid` remains supported for the default-state compatibility
route.

The server buffers each request body as bytes and decodes UTF-8 once, rejects
malformed JSON, non-object state, and state bodies over 10 MiB, serializes
mutations per `sid`, and writes each state file through a same-directory
temporary file followed by an atomic rename. A failed write returns an error
response rather than a success acknowledgement.

Browser `saveState()` calls made in the same tick coalesce to the newest whole
state and are serialized per `sid` across ticks. `flushState()` forces any
pending write to start and resolves only after all queued writes have landed;
it rejects on a failed request. Top-level diffing compares the union of baseline
and current keys, so deleting a top-level key remains observable.

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
| **a. Adopt** | server has a current state | The server wins and becomes the rendered/local state; its baseline is mirrored locally. |
| **b. Restore** | server is reachable but one or both files are absent | Render the local/default state and issue guarded `restore`; a concurrent inject wins and is re-fetched. |
| **c. Offline fallback** | `/state` is unavailable | Render localStorage/defaults without posting anything that could overwrite an unseen injection. |

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
  browser profile may still hold a mutated session. Without the restore, `/go`
  falls back to `createInitialData()` and reports the DEFAULT tree with
  `state_diff: {}` while the agent's browser shows a mutated one.

**Restore can never erase a real diff.** It fills only missing files and checks
all existing files against the supplied values in the same serialized mutation.
If they differ, nothing is written.

**`set_current` never establishes the baseline.** It carries the *post*-mutation
tree; adopting that as `initial_state` would make `state_diff` `{}` on a mutated
session. When the baseline file is missing, `/go` compares current state with
`createInitialData()` so the mutation stays visible.

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
  holds **1 554** captured listings (**629** of them searches) with the source's own
  ordering, `totalCount` and facet buckets. `resolveListing()` prefers an exact
  captured listing, then a captured listing with the same filters (for the
  count), then the seed. Category pages with no capture fall back to
  `categories[].dbProductCount`. A captured page names ids the seed may not
  hold; `resolveListing()` renders the captured products that *are* seeded in
  source order, then tops the page up from the derived pool. At 11 358 products,
  **49.6 %** of captured ids resolve (4 452 / 8 973) and **718 / 1 554** listings
  resolve completely. Round 8 added **167** captured pages — every listing-shaped
  URL any shopping task starts on or asserts against, over **both** task files
  (`assets/dumps/task_urls.vwa.txt`, 224 URLs, all captured). The absolute
  resolution *rate* fell (52.1 % → 49.6 %) because the denominator grew faster
  than the seed: the new captures reference 8 973 ids of which **4 520** are
  still unseeded (`assets/dumps/UNSEEDED_LISTING_IDS.remaining.txt`).
  Audit verified 42 of the captured pages against the live source: **42 / 42**
  identical page-1 product ids **in source order**, identical `Items X-Y of Z`,
  identical pagination slices.
  The 4 listings added in round 6 are the two anchored paginated pages
  (`/grocery-gourmet-food/fresh-meal-kits.html?p=5&product_list_order=name`,
  `/video-games/legacy-systems/playstation-systems.html?p=3`) and their page-1
  siblings; they are captured because `sortProducts()`'s `localeCompare` name
  collation and its entity-id `position` fallback do **not** reproduce the
  source's ordering on *derived* pages.
- **Listability matches Magento's out-of-stock rule.** `isListable()`
  (`utils/catalog.js:118`) tests `status === 1 && visibility >= 4 && p.inStock`.
  `cataloginventory/options/show_out_of_stock` has **no row** in the source's
  `core_config_data`, so Magento defaults it to `0` and drops out-of-stock
  products from every category listing, search result and price index. Verified
  against the container at 11 358 products (round 8): the **11 097** products
  `isListable()` accepts are **exactly** the seeded rows present in
  `catalog_product_index_price` (`customer_group_id=0`, `website_id=1`, 101 235
  rows), and the **261** it rejects are exactly the rows absent from it —
  **0** shown that the source hides, **0** hidden that the source shows. Cross-checked against the live rendered source on 5 categories, whose
  own item totals equal
  `catalog_category_product_index_store1 ∩ catalog_product_index_price` in every
  case (244: 81, 187: 288, 46: 372, 31: 265, 15: 3 125).
  `visibility >= 4` is still narrower than Magento's `IN (2,4)` and stays inert —
  every seeded product has `visibility === 4`.
- ~~**86 seeded products carry no description.**~~ **CLOSED (round 7, re-verified
  round 8).** All **11 358 / 11 358** seeded products ship a description, and
  every one is byte-identical to `clean_desc(container, store_id=1)` — verified
  whole population against the container, 0 differing, 0 keyed to an unseeded
  product.
- ~~**`reviewsCount` and shipped review bodies disagree.**~~ **CLOSED (round 7)**
  by backfilling the bodies, never by clamping the count. **32 594** bodies now
  ship — every approved container review for the seeded population (all 308 939
  container reviews are `status_id = 1`), 0 fabricated, 0 missing, 0 duplicate
  `reviewId`. Products short (`reviewsCount` > bodies) **2 517 → 0**. The
  residual products shipping more bodies than `reviewsCount` or a body with
  `reviewsCount == 0` are the container's own `review_entity_summary` drift,
  reproduced deliberately — see `SOURCE.md` "Decisions on record".
- ~~**5 review fields substitute `U+000A` for `U+0085` / `U+2028`.**~~
  **CLOSED (round 8, `AUDIT.md` R7-003).** Fixed at the dump
  (`assets/dumps/vwa_backfill.py:59` splits on `"\n"`, not `str.splitlines()`)
  and repaired whole-population by `assets/dumps/fix_review_bytes.py`. Audit
  re-verified against all 308 939 container `review ⋈ review_detail` rows:
  **32 594 / 32 594 byte-identical** on `title`, `detail` **and** `nickname`.
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
shape so `products.json` values resolve unchanged — **21 302 files, 276 MB**.
Encoding is tiered: the 1 105 round-1 products keep their original 500×500
files; backfilled PDP-anchored products are 500×500 q72, and backfilled
category-depth products are 320×320 q64.

`ProductImage` (`components/ProductImage.jsx:24`) resolves
`path || product.smallImage || product.thumbnail || product.image` and, on
`onError`, substitutes a deterministic inline SVG keyed off the SKU — so there
is never a broken image and never an external request. `ProductPage` reads
`product.gallery` directly.

| Field | Paths that resolve on disk |
|---|---|
| `image` | **11 358 / 11 358** |
| `gallery` (every entry) | **11 358 / 11 358** |
| `smallImage` | **11 358 / 11 358** |
| `thumbnail` | **11 358 / 11 358** |

**21 302** distinct paths are referenced and **21 302** files exist: **0 missing,
0 orphans**. **0 / 11 358** products repeat a gallery entry.

Gallery *contents* match the container exactly for **10 412 / 11 358** products
(order-sensitive comparison against the container's `position`-ordered list,
disabled entries excluded). The **946** that differ are all **new this round**;
**0** pre-existing product regressed. Every one is *short*, never long, never
reordered, and always an order-preserving subset — 1 shipped entry where the
container has 2 (942 cases), 3 (1) or 4 (3). This is the round-8 **tier-B**
decision: the 1 103 products seeded purely so that a captured task-start listing
renders its real tile set get name, price, SKU, url key, main image, options and
reviews, but only the main image in `gallery`. **0** of the 43 evaluator
`/media` URLs are affected. The SVG placeholder is unreachable in normal
browsing — measured 0 placeholders and 0 broken images across 15 listing/search
surfaces plus a populated cart and wishlist, at 1280×720 and 1920×1080.

`/media/catalog/product/cache/<hash>/<A>/<B>/<file>` — Magento's resized-image
path, and the shape the source's own PDP emits — **is served** (the vite media
middleware strips the `/cache/<hash>/` segment). Verified round 8 on the built
preview: **43 / 43** of the distinct evaluator `/media` URLs return HTTP 200 with
real JPEG magic; unmatched `/media/**` and four traversal forms all return
`404 text/plain` rather than falling through to the SPA.

---

## 6.1 Search-query normalisation and the minimum query length (shard S)

`resolveListing()` looks a page up in an index keyed by path + query params.
`listingKey()` (`src/utils/catalog.js:645-662`) **folds the `q` component only** —
`trim` → collapse internal whitespace runs → lowercase — on the index-build and
the lookup side at once. `cat` (an entity id) and `price` (a numeric range) are
left alone.

**Effect on the seed: none.** The 1 554 captures produce **1 552** distinct exact
keys. Exactly two pairs merge:

| merged key | captures merged |
|---|---|
| `/catalogsearch/result/?q=amazon basic` | `q=Amazon basic` + `q=amazon basic` |
| `/catalogsearch/result/?q=lays` | `q=Lays` + `q= Lays` |

Audited field by field: within each pair `toolbarAmount`, `totalCount`,
`productIds`, `sorterOptions`, `limiterOptions`, `sortDirNext`, `currentFilters`
and `pageLinks` are **identical**. The only differing fields are `url`,
`query.q`, `title` and the `q=` echoed inside `filters[].options[].href` — and
none of those four reaches the screen: the page title and `h1` are rebuilt from
the URL's own `q` via `searchQueryText()`, and `categoryFacets()` /
`priceFacets()` take only the `cat` / `price` parameter out of a captured href
(`paramFromCapturedHref`) and rebuild the link from the current URL.
**0 captures shadowed, 0 mis-keyed, 0 data lost.** `src/data/listings.json` is
unmodified.

`MIN_QUERY_LENGTH` (`src/utils/catalog.js:894`) reads
`storeConfig.minQueryLength` and falls back to **3**. The container's effective
value **is 3**: `core_config_data` holds **0** rows matching `catalog/search%` at
any scope, so `module-catalog-search/etc/config.xml`'s
`<min_query_length>3</min_query_length>` applies. `storeConfig.json` does not
currently carry the key, so the fallback is what runs; the value is right, and a
future seed re-extraction that captures the row wins without a code change.

Below the minimum the mock reproduces the source's `_noresults` branch: the
notice `Minimum Search query length is 3`, the `dl.block` "Related search terms"
recommendations, **no** toolbar, **no** grid, an empty `.sidebar-main` — with
`<title>`, `h1` and breadcrumbs unchanged. An empty or whitespace-only `q`
redirects to `/` (carrying `sid`), which is what the source's
`Controller\Result\Index` does.
