# Shopping Admin Mock — Audit (dimension: DATA PIPELINE + SCHEMA)

> Round: 4
> Date: 2026-08-06
> Audited by: audit agent (shard `pipeline`)
> Dev server driven live at `http://localhost:5189` with chromium/playwright.
> Siblings own DOM-locator parity and handlers.

---

## TASK 1 — the five invariants, re-proven empirically

All five **PASS**. Every result below was produced by driving a real browser
against a running dev server and reading `GET /go?sid=` immediately afterwards;
none of it is inferred from code.

### (a) Brand-new UN-INJECTED sid — PASS

sid `P4A01`, never injected, `.mock-states/` entries deleted first via
`{"action":"reset"}`.

```
load /admin/cms/page/            -> state_diff = {}          (nothing spurious)
edit page_id 1 title -> Save     -> banner "You saved the page."
                                 -> state_diff = ['cmsPages']
diff shape                       -> cmsPages: {old, new}     (field-level, not whole-tree)
pageerrors                       -> []
```

The FIRST mutation is the FIRST thing in the diff. No boot-time write, no
all-keys diff.

### (b) FULLY-INJECTED sid — PASS

sid `P4B01`, injected with a complete 43-key tree (taken from a virgin `/go`
baseline) carrying two edits: `cmsPages[0].title = 'INJECTED-FULL-B'` and
`searchTerms[0].query_text = 'INJECTED-QUERY-B'`.

```
initial_state key count after inject : 43
grid renders 'INJECTED-FULL-B'       : True     <-- injected task state loads
state_diff immediately after load    : []       <-- inject is the baseline, not a mutation
state_diff after navigating away     : []       <-- no drift from mere navigation
```

### (c) PARTIALLY-INJECTED sid — PASS, no mega-diff

sid `P4C01`, injected with a **one-key, one-row** partial:
`{"cmsPages":[{page_id:1, title:'PARTIAL-C-ONLY', …}]}`.

```
initial_state key count      : 43     <-- merged over defaults, not truncated to 1
customers still in initial   : 70     <-- untouched keys survive the partial inject
grid renders 'PARTIAL-C-ONLY': True
state_diff after load        : []     <-- NO all-false mega-diff
then edit block_id 1 -> Save : banner "You saved the block."
                             : state_diff = ['cmsBlocks']   <-- only the key touched
pageerrors                   : []
```

This is the invariant that `mergeOverDefaults()` + the `set_initial`-before-
`set_current` ordering in `AppContext.jsx:88-92` exists to protect, and it holds.

### (d) 20 distinct sids in ONE browser profile — PASS (round-3 P0 stays closed)

Twenty sids (`P4D01`…`P4D20`, exceeding the 18 asked for), all driven in a
**single** `browser.new_context()` so they share one localStorage origin. For
each: reset → edit CMS page 1 title → Save → navigate to the Customers grid →
read `/go`.

```
sids driven          : 20
failures             : []        (a failure = any of: exception, 0 customer rows,
                                  own title missing, diff != ['cmsPages'],
                                  initial key count != 43)
customer grid rows   : 70 on every one of the 20
state_diff           : ['cmsPages'] on every one of the 20, each containing
                       only its OWN title
initial key count    : 43 on every one of the 20
pageerrors           : []
localStorage keys at end of run : 46
```

No quota failure, no grid collapse, no cross-talk. The round-3 P0 is closed and
survives a 20-sid profile.

### (e) AppContext reads localStorage BEFORE `initializeData()` — PASS

`src/context/AppContext.jsx:58-59` — `readStoredState(sid)` / `readStoredInitial(sid)`,
both `localStorage.getItem` wrappers (`src/utils/dataManager.js:212`, `:215`).
The first `initializeData()` call is at `:67`, the second at `:83`. The ⚠️
comment at `:55-57` names the hazard explicitly. Cases (b) and (c) confirm the
behavioural consequence.

---

## TASK 2 — state size, and where the 225-row url_rewrite seed landed

### Measured

`createInitialData()` minified, from a live `GET /go` on a virgin sid,
`json.dumps(initial_state, separators=(',',':'))`:

**329,014 bytes (321 KB) · 43 top-level keys**

| Round | Bytes | Δ | Keys | Δ |
|---|---|---|---|---|
| 1 | 328,547 | — | 36 | — |
| 2 | 328,578 | +31 | 36 | 0 |
| 3 | 328,826 | +248 | 41 | +5 |
| **4** | **329,014** | **+188** | **43** | **+2** |

Budget is ~1–2 MB. This is **16% of the low end**. Growth remains negligible.

The two new keys are `newOrders: []` (`src/utils/dataManager.js:308` — the
PIPELINE-008 fix) and `lockedAdminUsers: []` (`:269` — the PIPELINE-021 Unlock
fix). Both are empty containers backing genuinely new writers; between them they
cost 30 bytes. The remaining +158 B is the seven new `systemConfig` sub-keys
(`cacheStatus`, `cacheFlushLog`, `indexerModes`, `indexerStatuses`,
`notificationOverrides`, `integrationStatus`, `unlockedAdminUserIds`,
`dataManager.js:280-293`), which took `systemConfig` from 1,585 B to 1,736 B.

### The url_rewrite seed did NOT land in state — CONFIRMED CLEAN

`src/data/urlRewrites.json` is **63,107 bytes / 225 rows**. It is imported as a
**static ES module** at `src/pages/marketing/Marketing.jsx:8`
(`import urlRewriteSeed from '../../data/urlRewrites.json'`) and is **absent from
`createInitialData()`** — `grep -n urlRewrite src/utils/dataManager.js` returns
nothing, and no `urlRewrite*` key appears in the 43-key live baseline.

The editable overlay is done the right way: `useUrlRewrites`
(`Marketing.jsx:831-872`) reads the static seed and layers three small mutable
overlays — `url_rewrites` (added rows), `url_rewrite_edits` (`{id: patch}`),
`url_rewrite_deleted` (`[id]`) — all nested under the already-declared
`systemConfig` key. At baseline they are absent, so they cost 0 bytes. Had the
225 rows been copied into state this would have been a +63 KB (+19%) regression
POSTed and diffed on every `/go`; it was not.

One nit: those three sub-keys are **not** declared in `createInitialData()`'s
`systemConfig` literal, unlike its seven siblings which are. Because they nest
under a declared top-level key the diff still surfaces them correctly, so this is
cosmetic, not a correctness break — filed as PIPELINE-026 (P2).

### Full in-state size census (43 keys, virgin baseline)

```
182,334 reviews          1,507 invoices           302 customerGroups
 52,694 customers        1,481 catalogPriceRules  255 adminUsers
 35,665 cmsBlocks        1,350 orderStatuses      …
 31,177 cmsPages         1,100 searchTerms
  5,972 cartPriceRules     747 creditMemos
  3,729 coreConfig         588 shipmentItems
  2,505 taxConfig          407 invoiceItems
  1,970 shipments          373 adminRoles
  1,736 systemConfig
```

Nineteen keys are 2 bytes at baseline (the empty overlays and arrays).

### No other bulk corpus has crept into state

`src/data/` is 4.8 MB on disk; 321 KB of it enters state. The ~4.4 MB balance —
`products` (1.26 M), `orders` (968 K), `reportAggregates` (792 K), `stockItems`
(701 K), `orderGrid` (279 K), `urlRewrites` (63 K), `productDescriptions`,
`categories`, attribute metadata, `reviewSummaries`, `customerGrid`,
`stockReservations`, `reviewStatuses` — is imported statically
(`src/utils/staticData.js`, plus the direct `urlRewrites` import) and never
enters state. Confirmed by `initial_keys = 43` holding identically across all 20
sids of invariant (d) and every sid of the Task-4 sweep.

No derived or computed views are persisted: grid sort/filter/pagination live in
URL params and component state (`src/utils/gridUtils.js`); merged entity reads go
through `src/utils/selectors.js`.

---

## TASK 3 — round-3 disposition

Every open round-3 finding re-verified this round with file:line evidence and,
where it is observable, a live `/go` read.

| # | Round-3 finding | Round-4 status | Evidence |
|---|---|---|---|
| PIPELINE-005 | Catalog Price Rule create/edit stub; "Apply Rules" false success | **STILL FIXED** | `<CatalogPriceRuleForm />` on both routes (`src/App.jsx:424-425`); writers at `src/pages/marketing/Marketing.jsx:968-987`. Re-driven this round on the sibling surface: Cart Price Rule save (sid `P4PR1`) → banner `You saved the rule.`, `state_diff=['cartPriceRules']`. |
| PIPELINE-008 | "Submit Order" on Create New Order is not tracked | **FIXED** | `newOrders: []` now declared (`src/utils/dataManager.js:308`); Submit Order assembles the order, appends it, seeds `orderComments`, and redirects (`src/pages/sales/OrderCreate.jsx:98-168`). Driven live via the entry point that carries items: `/admin/sales/order_create/reorder/order_id/1/` → banner `You created the order.` → `state_diff=['newOrders','orderComments']` → lands on `/admin/sales/order/view/order_id/309/` → the Sales > Orders grid then reports **309 records found** (was 308) and `newOrders=[{entity_id:309, increment_id:'000000309'}]`. Note the `start/customer_id/N` entry point still has no product chooser, so it declines with the source's own `Please specify order items.` (`:102`) — an honest error, not a false success. |
| PIPELINE-011 | `addOrderComment` / `resetState` dead exports | **STILL FIXED** | `grep -rn "addOrderComment\|resetState" src/` returns nothing. Order comments go through the page's own `setState` → `saveState`; re-driven live (sid `P4OC1`) → banner `You submitted the order comment.`, `state_diff=['orderComments']`. |
| PIPELINE-013 | Ratings create/edit stub; `ratings` has no writer | **STILL FIXED** | `<RatingForm />` on both routes (`src/App.jsx:426-427`); writers at `src/pages/reviews/Reviews.jsx:614-656`. Sibling re-drive: Review save (sid `P4RV1`) → `state_diff=['reviews']`. |
| PIPELINE-019 | Config fields with no `path` save silently — FALSE SUCCESS | **FIXED** | The `includes('/')` guard is gone; `configPath(f)` (`src/components/system/configSections.js:588-598`) derives `general_store_information_name` → `general/store_information/name` from the descriptor's `name` attribute, so **every** editable descriptor resolves to a real path (`src/pages/system/Configuration.jsx:40`, `:156`, comment at `:62-73`). Driven live on the exact field that failed last round: <br>`P4T01` Store Name → banner `You saved the configuration.`, `state_diff=['coreConfig']` <br>`P4T02` Store Phone → `state_diff=['coreConfig']` <br>`P4T03` state_required (already had a path) → `state_diff=['coreConfig']` <br>`P4T05` Store Name → save → **reload** → field still reads `PERSIST-CHECK` <br>`P4T04` save with nothing changed → `There is nothing to save — no field on this page was changed.` (`notice`), `state_diff=[]` — the new no-op branch at `:87-90` refuses to claim a save it did not make. |
| PIPELINE-020 | The only wishlist mutation in the app is unreachable | **NOT FIXED** | `src/data/wishlists.json` still seeds two wishlists with `items: []`. Driven live (sid `P4U17`, customer 15 → Wish List tab): `We couldn't find any records.`, **0** Delete links, `state_diff=[]`. The writer (`src/context/AppContext.jsx:224-232`, wired at `src/pages/customers/CustomerEdit.jsx:563-569`) is correct and still unreachable. Stays P2 — this is a seed gap, not a pipeline gap. |
| PIPELINE-021 | Twelve success messages with no state footprint | **FIXED — 0 remain** | All twelve re-driven live this round; every one now either writes state or declines honestly. Table below. |
| PIPELINE-022 | `compactState()` re-stringifies large mutated arrays on every save | **NOT FIXED** | `src/utils/dataManager.js:169-182` is byte-identical: the `v === defaults[k]` fast path still falls through to `JSON.stringify(v) === JSON.stringify(defaults[k])` for any already-mutated key. Still not observable — 0 page errors across ~80 driven sids this round. Stays P2. |
| PIPELINE-023 | Documented declines that are fine | **UNCHANGED, still fine** | `src/pages/customers/CustomerEdit.jsx` Reset Password / Force Sign-In re-driven (sid `P4X03`): banners `The customer will receive an email with a link to reset password.` / `You have signed out the customer from all devices.`, `state_diff=[]` — both are mail/session side effects with no DB footprint in the source either. **Dashboard "Reload Data" leaves this list**: it is now a real writer (see PIPELINE-024). |

### PIPELINE-021 — the twelve, re-driven live, one sid each

| Button | sid | Banner | `state_diff` | Verdict |
|---|---|---|---|---|
| Cache Management → Enable | `P4T06` | `1 cache type(s) enabled.` | `['systemConfig']` | TRACKED |
| Cache Management → Refresh | `P4T07` | `1 cache type(s) refreshed.` | `['systemConfig']` | TRACKED |
| Flush JavaScript/CSS Cache | `P4Y1285` | `The JavaScript/CSS cache has been cleaned.` | `['systemConfig']` | TRACKED |
| Flush Static Files Cache | `P4Y9208` | `The static files cache has been cleaned.` | `['systemConfig']` | TRACKED |
| Flush Catalog Images Cache | `P4Y9020` | `The image cache was cleaned.` | `['systemConfig']` | TRACKED |
| Flush Cache Storage | `P4Y5454` | `You flushed the cache storage.` | `['systemConfig']` | TRACKED |
| Index Management → Update on Save | `P4T08` | `1 indexer(s) are invalidated.` | `['systemConfig']` | TRACKED |
| Index Management → Update by Schedule | `P4T09` | `1 indexer(s) are invalidated.` | `['systemConfig']` | TRACKED |
| Notifications → Mark as Read | `P4T10` | `A total of 1 record(s) have been marked as Read.` | `['systemConfig']` | TRACKED |
| Notifications → Remove | `P4U16` | `A total of 1 record(s) have been removed.` | `['systemConfig']` | TRACKED |
| Integrations → Reauthorize | `P4Z03` | `The integration 'Magento Analytics user' has been reauthorized.` | `['systemConfig']` | TRACKED |
| Tax → Import Tax Rates | `P4T12` | `Invalid file upload attempt.` (`error`) with no file; parses a real CSV into `taxConfig.rates` otherwise (`src/pages/system/Tax.jsx:177-230`) | `[]` on the decline | HONEST DECLINE |
| Encryption Key → Change | `P4Z01` | `Key changing is disabled in this environment.` (`notice`) | `[]` | HONEST DECLINE |
| Log out all other sessions | `P4Z02` | `There are no other open sessions to terminate.` (`notice`) | `[]` | HONEST DECLINE |
| Locked Users → Unlock | `P4T13` | grid is empty (`We couldn't find any records.`) | n/a | LATENT — writer exists (`src/pages/system/Permissions.jsx:126-135` → `lockedAdminUsers` / `systemConfig.unlockedAdminUserIds`), grid has 0 rows. PIPELINE-025 (P2) |
| Bulk Actions → Remove | `P4T14` | grid is empty (`0 records found`) | n/a | LATENT — PIPELINE-025 (P2) |

**Count of false successes remaining in the migration: 0.** The dashboard
"Reload Data" case named in the brief is closed — it now writes real state (sid
`P4X02`, banner `We updated lifetime statistic.`, `state_diff=['dashboardStatistics']`)
— but the key it writes is undeclared, which is PIPELINE-024 below.

---

## TASK 4 — fresh sweep

### 4.1 Contract conformance (WEBARENA_MIGRATION.md §5)

| Requirement | Status | Evidence |
|---|---|---|
| `secureMockApiPlugin()` FIRST in `plugins[]` | PASS | `vite.config.js:332` — first element, before `react()` |
| `mock-api` under `configureServer` | PASS | `vite.config.js:336` |
| `mock-api` under `configurePreviewServer` | PASS | `vite.config.js:337` — same `setupMiddlewares(server)`, so dev and preview cannot drift |
| Endpoint `/post` | PASS | `vite.config.js:221` — actions `set`, `set_initial`, `set_current`, `reset`; all four exercised live |
| Endpoint `/state` | PASS | `vite.config.js:291`; verified live (`200`) |
| Endpoint `/go` | PASS | `vite.config.js:314` → `{initial_state, current_state, state_diff}`; verified live on ~80 sids this round |
| Endpoint `/upload` | PASS | `vite.config.js:181` |
| Endpoint `/files` | PASS | `vite.config.js:205` |
| State at `.mock-states/<sid>.json` + `<sid>.initial.json` | PASS | `vite.config.js:15-25`; both files observed on disk for every driven sid |
| sid sanitized `replace(/[^a-zA-Z0-9_-]/g,'')` | PASS | all five call sites: `vite.config.js:17`, `:23`, `:148`, `:198`, `:209` |
| dataManager exports the full required set | PASS | `getSessionId` `:69`, `storageKey` `:79`, `initialKey` `:83`, `fetchCustomState` `:87`, `createInitialData` `:241`, `initializeData(sid, customState)` `:339`, `saveState(state, sid)` → `{action:'set_current', state}` `:390`. Additive: `fetchServerState` `:105`, `readStoredState` `:212`, `readStoredInitial` `:215`, `writeStoredInitial` `:218`, `mergeOverDefaults` `:223`, `sameState` `:232`, `publishInitialState` `:381`, `staticData` `:404`. |
| AppContext checks `localStorage.getItem(initialKey(sid))` BEFORE `initializeData()` | PASS | Task 1(e) |
| `RedirectWithQuery`, never a bare `<Navigate>` | PASS | `src/App.jsx:105` (RedirectWithQuery) and `:116` (the `/key/<hash>` stripper, which re-appends `location.search`) are the only two `<Navigate>` in the tree; every other redirect goes through `useSidNavigate`. |
| **`/go` route in `src/App.jsx`** | **FAIL** | **PIPELINE-027 (P1)** — no `<Route path="/go">` exists. Both reference mocks have one (`websites/mixpanel_mock/src/App.jsx:26`, `websites/webarena_shopping_mock/src/App.jsx:205`). |

### 4.2 Untracked mutations — every mutating action driven live

Each row is a real click in a real browser, with `GET /go?sid=` read immediately
after, on a sid reset to virgin first.

**Round-4-touched surfaces (the ones the brief called out):**

| Action | sid | Banner | `state_diff` |
|---|---|---|---|
| Configurations wizard → Select Attributes → Attribute Values → Bulk Images & Price → Summary → **Generate Products** → Save | `P4V02` | `Product Configurations. 3 product(s) have been generated.` + `You saved the product.` | `['newProducts','productDescriptionOverrides','productOverrides']` |
| Configurations → **Add Products Manually** → search `Hoodie` → Add → Save | `P4W03` | `MH02-XS-Black has been added to the configurations.` + `You saved the product.` | `['productDescriptionOverrides','productOverrides']` |
| **Credit memo creation** (`order_creditmemo/new/creditmemo_id/1/` → Refund Offline) | `P4U01` | `You created the credit memo.` | `['creditMemos','orderComments']` |
| Credit memo `new/order_id/1/` (the source 404s here) | `P4U02` | `We can't create credit memo for the order.` on a 404 page | `[]` — correct, a 404 mutates nothing |
| **Email — order** | `P4U03` | `You sent the order email.` → `/admin/sales/order/view/order_id/1/` | `['orderOverrides']` |
| **Email — invoice** | `P4U04` | `You sent the message.` → `/admin/sales/invoice/view/order_id/1/invoice_id/1/` | `['invoices']` |
| **Email — shipment** | `P4U05` | `You sent the shipment.` → `/admin/admin/order_shipment/view/shipment_id/1/` | `['shipments']` |
| **Email — credit memo** | `P4U06` | `You sent the message.` → `/admin/sales/order_creditmemo/view/creditmemo_id/1/` | `['creditMemos']` |
| Email a nonexistent invoice (`invoice_id/999`) | `P4U07` | **no banner** | `[]` — declines silently rather than claiming a send |
| **URL Rewrite create** | `P4U08` | `The URL Rewrite has been saved.` | `['systemConfig']` |
| **URL Rewrite edit** (seed row 1) | `P4U09` | `The URL Rewrite has been saved.` | `['systemConfig']` |
| **URL Rewrite delete** (seed row 1) | `P4U10` | `You deleted the URL Rewrite.` | `['systemConfig']` |
| URL Rewrite grid population | `P4U11` | — | grid reports **225 records found**, matching the source row count |
| **System Config field persistence** | `P4T01/02/03/04/05` | see PIPELINE-019 above | `['coreConfig']`, and the value survives a reload |

**Everything else, driven live this round:**

| Action | sid | `state_diff` |
|---|---|---|
| CMS page save | `P4A01` | `['cmsPages']` |
| CMS block save | `P4C01` | `['cmsBlocks']` |
| CMS block delete | `P4CB1` | `['cmsBlocks']` |
| Order Hold | `P4O300Hol` | `['orderComments','orderOverrides']` |
| Order Unhold | `P4QUnh` | `['orderComments','orderOverrides']` |
| Order Cancel | `P4QCan` | `['orderComments','orderOverrides']` |
| Invoice submit | `P4QINV` | `['invoiceItems','invoices','orderOverrides']` |
| Shipment submit | `P4QSHP` | `['orderComments','orderOverrides','shipmentItems','shipments']` |
| Order Submit Comment | `P4OC1` | `['orderComments']` |
| Order create (reorder) | `P4W01` | `['newOrders','orderComments']` |
| Customer save | `P4QCU` | `['customers']` |
| Category save | `P4QCT` | `['categoryOverrides']` |
| Products grid Delete mass action | `P4PD1` | `['deletedProductIds']` |
| Review save | `P4RV1` | `['reviews']` |
| Cart price rule save | `P4PR1` | `['cartPriceRules']` |
| Newsletter Unsubscribe mass action | `P4V05` | `['newsletterSubscribers']` |
| Search term save | `P4V06` | `['searchTerms']` |
| Admin user create | `P4QAU` | `['adminRoles','adminUsers']` |
| Order status create | `P4OS1` | `['orderStatuses']` |
| Grid → Save View As | `P4X01` | `['gridBookmarks']` (`{sales_order_grid: {"P4 Saved View": ""}}`) |
| Dashboard Reload Data | `P4X02` | `['dashboardStatistics']` — but see PIPELINE-024 |

**Every one of the 43 declared keys has at least one writer** outside
`dataManager.js` (checked by grep, key by key). `wishlists`' writer is reachable
only if the seed gains items (PIPELINE-020). **No mutation was found that lives
only in component state.** The three that used to (`Tools.jsx` cache statuses,
indexer modes, notification rows) now go through `useSystemMap` /
`useSystemLog` → `systemConfig` → `setState` → `saveState`.

`grep` for undeclared top-level state keys written via `{...prev, KEY:}` across
all of `src/`: exactly one hit, `dashboardStatistics` (PIPELINE-024). The other
four hits (`is_active`, `type`, `subscriber_status`, `updated_at`) are row-level
object spreads inside declared collections, not state keys.

### 4.3 Session isolation — PASS

Two sids driven in one browser, then reset:

```
P4ISOA  edit CMS page 1 -> diff ['cmsPages']  titles ['ISO-A-TITLE', 'Home Page', 'Enable Cookies']
P4ISOB  edit CMS page 1 -> diff ['cmsPages']  titles ['ISO-B-TITLE', 'Home Page', 'Enable Cookies']
reset P4ISOA
  P4ISOA diff []                 titles ['404 Not Found', 'Home Page', …]  <-- seed restored
  P4ISOB diff ['cmsPages']       titles ['ISO-B-TITLE', …]                 <-- untouched by A's reset
  P4ISOA reloaded in the SAME browser context: #page_title reads '404 Not Found'
  P4ISOA diff after reload: []                                             <-- reset reached the UI
```

Plus the 20-sid run of invariant (d): 20 sids in one profile, each diff carrying
exactly its own title, no cross-talk in either direction.

---

## P0

**None.** All five invariants re-proven empirically. No mutation is invisible to
`/go`. Injected state loads on every inject shape (full, partial, none). No
contract element is missing from `vite.config.js` or `dataManager.js`, and
`secureMockApiPlugin()` is still first in `plugins[]`. State size is 16% of the
low end of budget and the 225-row url_rewrite seed stayed out of state. Storage
survives 20 sids in one origin.

---

## P1

### PIPELINE-024 · `dashboardStatistics` is written but not declared in `createInitialData()`
- **Files**: writer `src/pages/Dashboard.jsx:37-41`; baseline
  `src/utils/dataManager.js:241-336` (43 keys, none of them this one)
- **Issue**: round 4 turned Dashboard → Reload Data from a false success into a
  real writer, which is the right fix — but the key it writes was never added to
  the baseline. This is the same class as round 2's PIPELINE-014
  (`attributeSetOverrides`), which was fixed by declaring it. Verified live
  (sid `P4X02`):
  ```
  click "Reload Data"
    -> banner       "We updated lifetime statistic."
    -> initial_state contains 'dashboardStatistics' : False
    -> initial_state key count                      : 43
    -> state_diff   {"dashboardStatistics": {"new": {...}}}   <-- no "old" member
  ```
  Every other key in the app diffs as `{old, new}`; this one diffs as `{new}`
  only, because there is nothing in the baseline to compare against. An
  evaluator that reads `state_diff[key].old` gets `undefined` for this key and
  for no other. It is also the only key an injected task state cannot establish
  a baseline for through the normal `createInitialData()` shape.
- **Not P0**: the mutation *is* visible in `/go` and survives reload —
  `mergeOverDefaults()` (`dataManager.js:223`) spreads the partial over the
  defaults and `compactState()` (`:169-182`) keeps keys absent from `defaults`,
  so the value round-trips correctly. The break is in baseline completeness and
  diff shape, not in observability.
- **Fix**: one line in `createInitialData()`, next to `systemConfig`:
  ```js
  // Dashboard > Reload Data — { lifetime_refreshed_at, lifetime_refresh_count }
  dashboardStatistics: {},
  ```

### PIPELINE-027 · No `/go` route in `src/App.jsx`
- **File**: `src/App.jsx` — `grep '"/go"'` returns nothing
- **Spec**: WEBARENA_MIGRATION.md §5 — "`src/App.jsx`: `/go` route, and
  `RedirectWithQuery` instead of `<Navigate>`". Both reference mocks implement
  it: `websites/mixpanel_mock/src/App.jsx:26` and
  `websites/webarena_shopping_mock/src/App.jsx:205`, each rendering a `GoPage`
  that prints `{initial_state, current_state, state_diff}` as a `<pre>` from the
  client's own view of state.
- **Issue**: this mock has the server-side `/go` middleware
  (`vite.config.js:314`) and nothing else. The middleware is registered under
  both `configureServer` and `configurePreviewServer` and is matched before
  Vite's SPA fallback, so `GET /go?sid=` returns the right JSON in dev and in
  preview — proven ~80 times this round. What is missing is the client-side
  viewer, which is what you get if you open `/go?sid=` in a page that has
  already booted the SPA, and which reads the *browser's* state rather than the
  server file.
- **Not P0**: the endpoint the RL harness calls works, and every invariant in
  Task 1 was proven through it. Filing P1 rather than P0 because the functional
  contract ("`/go?sid=` exposes `{initial_state, current_state, state_diff}`") is
  satisfied; it is the literal §5 element and the reference-parity that are
  missing.
- **Fix**: copy `websites/mixpanel_mock/src/pages/GoPage.jsx`, adapt its
  `computeStateDiff` import to this mock's diff helper, and add
  `<Route path="/go" element={<GoPage />} />` to `src/App.jsx`.

---

## P2

### PIPELINE-020 (carried) · The only wishlist mutation in the app is unreachable
- **Files**: writer `src/context/AppContext.jsx:224-232`, wired at
  `src/pages/customers/CustomerEdit.jsx:563-569`; seed `src/data/wishlists.json`
- **Issue**: unchanged from round 3. Both seeded wishlists still carry
  `items: []` (customer 15 and customer 70), so the Wish List tab renders
  `We couldn't find any records.` and the Delete link never appears. Verified
  live on customer 15 (sid `P4U17`): 0 delete links, `state_diff=[]`. The
  `wishlists` key remains effectively inject-only.
- **Fix**: seed a handful of `wishlist_item` rows from the container's
  `wishlist_item` table for customers 15 and 70 (real `product_id`, `qty`,
  `added_at`). Seed ownership sits with the plan/dev agents. If the source
  tables really are empty, record that in `SCHEMA.md` and leave it — that is
  already noted in the SCHEMA state table.

### PIPELINE-022 (carried) · `compactState()` re-stringifies large mutated arrays on every save
- **File**: `src/utils/dataManager.js:169-182` — unchanged since round 3
- **Issue**: the reference fast path (`v === defaults[k]`) covers untouched
  keys, but any key the session has already mutated falls through to
  `JSON.stringify(v) === JSON.stringify(defaults[k])` on **every subsequent
  save**. With `reviews` mutated that is 2 × 182 KB of stringification per save.
  Still not observable: 0 page errors and no dropped frames across ~80 sids and
  ~60 mutations this round.
- **Fix**: only deep-compare keys whose reference differs *and* whose serialised
  default is under a size threshold; above it, treat a reference-differing key
  as dirty (which it almost always is).

### PIPELINE-025 · Two correct handlers are latent because their grids are empty
- **Files**: `src/pages/system/Permissions.jsx:116-135` (Locked Users → Unlock),
  `src/pages/system/Tools.jsx:600-620` (Bulk Actions → Remove)
- **Issue**: both now have real writers — Unlock writes `lockedAdminUsers` +
  `systemConfig.unlockedAdminUserIds`, Remove writes
  `systemConfig.notificationOverrides` — but both grids render
  `We couldn't find any records.` (verified live, sids `P4T13` / `P4T14`), so
  neither can be clicked. `lockedAdminUsers: []` is declared with a comment
  (`dataManager.js:264-269`) explaining that `lock_expires` is NULL for every
  `admin_user` row in this deployment, which makes an empty grid genuine parity.
  Recording it so it is not re-reported as an untracked mutation next round.
- **Fix**: none required for parity. Both are injectable, so a task can seed
  `lockedAdminUsers` and exercise Unlock.

### PIPELINE-026 · The url_rewrite overlay sub-keys are not declared in the `systemConfig` literal
- **Files**: writers `src/pages/marketing/Marketing.jsx:851-869`
  (`url_rewrites`, `url_rewrite_edits`, `url_rewrite_deleted`); baseline
  `src/utils/dataManager.js:274-293`
- **Issue**: the seven maintenance overlays nested under `systemConfig`
  (`cacheStatus`, `cacheFlushLog`, `indexerModes`, `indexerStatuses`,
  `notificationOverrides`, `integrationStatus`, `unlockedAdminUserIds`) are all
  declared with comments; these three are not, even though they are written by
  the same mechanism. Because they nest under a declared top-level key the diff
  surfaces them correctly (`state_diff=['systemConfig']`, verified live on
  create/edit/delete, sids `P4U08`/`P4U09`/`P4U10`), so this is a documentation
  and consistency nit rather than a correctness break.
- **Fix**: add the three alongside their siblings with the same comment style.

---

## Data Pipeline Status

| Component | Status | Notes |
|---|---|---|
| `dataManager.js` exports | PASS | 7 contract exports + 8 additive helpers |
| `createInitialData` loads `src/data` | PASS | 25 JSON seeds imported; no inline copies |
| State size | PASS | 329,014 B (321 KB), 43 keys, 16% of the 2 MB floor |
| url_rewrite seed kept out of state | PASS | 63 KB / 225 rows imported statically at `Marketing.jsx:8`; overlays only |
| Static/overlay split | PASS | ~4.4 MB of bulk corpora kept out of state; no derived views persisted |
| localStorage under many sids | PASS | 20 sids in one profile, 46 keys, all grids render, all diffs correct, 0 page errors |
| `AppContext` state sync | PASS | every mutation goes through `setState` → `saveState` |
| `AppContext` localStorage-before-`initializeData` | PASS | `:58-59` read, `:67`/`:83` call |
| `AppContext` server resync on reload | PASS | 3-case reconciliation; verified via reset-adoption |
| `vite.config.js` `/post` | PASS | `set` / `set_initial` / `set_current` / `reset`, baseline rules correct |
| `vite.config.js` `/state` | PASS | verified live |
| `vite.config.js` `/go` | PASS | correct diff on virgin / full-inject / partial-inject |
| `/upload`, `/files` | PASS | present under both server hooks |
| `secureMockApiPlugin` first in `plugins[]` | PASS | `vite.config.js:332` |
| `configurePreviewServer` registered | PASS | `vite.config.js:337`, same `setupMiddlewares` as dev |
| Session isolation (`?sid=`) | PASS | 2 sids + 20 sids, no cross-talk |
| `.initial.json` handling | PASS | virgin / full-inject / partial-inject all correct |
| `reset` restores the seed | PASS | verified, and the reset reaches the UI |
| Mutation coverage — sales | PASS | hold/unhold/cancel/invoice/ship/comment/order-create/credit-memo, all tracked |
| Mutation coverage — catalog | PASS | product save, delete, Configurations wizard, Add Products Manually, category, all tracked |
| Mutation coverage — customers / content / marketing / reviews / reports / system | PASS | all tracked |
| Mutation coverage — config fields without a descriptor `path` | PASS | PIPELINE-019 fixed |
| Mutation coverage — order create | PASS | PIPELINE-008 fixed |
| **False-success messages** | **PASS — 0 remain** | all twelve of PIPELINE-021 closed |
| Baseline completeness | FAIL | PIPELINE-024 (`dashboardStatistics` undeclared) |
| `/go` route in `App.jsx` | FAIL | PIPELINE-027 |
| `SCHEMA.md` accuracy | UPDATED | rewritten against the code as it stands |

---

## Counts

| Priority | Count |
|---|---|
| P0 | 0 |
| P1 | 2 |
| P2 | 4 |
| **Total** | **6** |

P1: PIPELINE-024 (`dashboardStatistics` undeclared), PIPELINE-027 (no `/go`
route in `App.jsx`).
P2: PIPELINE-020 (wishlist seed empty), PIPELINE-022 (`compactState` cost),
PIPELINE-025 (two latent handlers, empty grids = parity), PIPELINE-026
(url_rewrite overlay sub-keys undeclared).

Measured `createInitialData()` size: **329,014 bytes (321 KB)** minified,
**43** top-level keys (round 3: 328,826 B / 41 keys — **+188 B, +2 keys**).

---

## Out-of-dimension observations

- `/admin/sales/order_create/start/customer_id/N/` has no product chooser, so an
  order can only be created through `reorder`/`edit`. The decline is honest, but
  Magento's own start-from-customer screen offers "Add Products". Handlers shard.
- The Cart Price Rule edit form has no "Manage Coupon Codes" section, so the
  auto-generation panel is unreachable; `coupons` is written only by rule
  save/delete (`Marketing.jsx:199`, `:210`). Handlers shard.
- Saving a product always diffs `productDescriptionOverrides` alongside
  `productOverrides`, even when the description was not edited. Harmless but
  noisy in the diff. Handlers shard.

---

## Appendix — final verification pass (rows asserted in SCHEMA.md, all driven live)

| Action | sid | Banner | `state_diff` |
|---|---|---|---|
| Customer Group create | `P4S3` | `You saved the customer group.` | `['customerGroups']` |
| Tax Zones and Rates → Save Rate | `P4R02` | `You saved the tax rate.` | `['taxConfig']` |
| Tax Rules → Save Rule | `P4S6` | `You saved the tax rule.` | `['taxConfig']` |
| Search Term delete | `P4R04` | `You deleted the search.` | `['searchTerms']` |
| Shipment → Add Tracking Number | `P4R05` | `You saved the shipment tracking information.` | `['orderComments','shipmentTracks']` |
| Order address edit | `P4R06` | `You updated the order address.` | `['orderAddressOverrides']` |
| Products grid → Update attributes → Save | `P4S5` | `A total of 1 record(s) were updated.` | `['productOverrides']` |
| CMS page delete | `P4R08` | `You deleted the page.` | `['cmsPages']` |

One additional out-of-dimension note from this pass: **New Customer Group saved
with an empty code prints no message at all** (sid `P4S4`: banner `[]`,
`state_diff=[]`). Not a false success — nothing is claimed — but the source
answers `This is a required field.` there, the way `/admin/admin/user/new/` and
`/admin/tax/rule/new/` already do in this mock. Handlers shard.
