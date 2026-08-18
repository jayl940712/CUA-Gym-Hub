# webarena_shopping_admin_mock Schema

> Round 4 · 2026-08-06 · rewritten against the running code and a live `GET /go`.

**Base URL**: `http://localhost:<port>/admin/`
**Go Endpoint**: `GET /go?sid=<sid>` → `{initial_state, current_state, state_diff}`
**Inject**: `POST /post?sid=<sid>` with body `{"action":"set","state":{...}}`
**Set current only**: `POST /post?sid=<sid>` with `{"action":"set_current","state":{...}}`
**Set baseline only**: `POST /post?sid=<sid>` with `{"action":"set_initial","state":{...}}`
**Reset**: `POST /post?sid=<sid>` with body `{"action":"reset"}`
**State read**: `GET /state?sid=<sid>`
**Upload**: `POST /upload?sid=<sid>` · **Serve**: `GET /files/<sid>/<filename>`

Uploads are content-addressed and isolated by SID. Legacy `reset` deletes JSON
state but deliberately leaves session fixture files available.

The app boots pre-logged-in as `admin` (WebArena's `admin` / `admin1234`). There
is no login gate. `?sid=` rides on every URL and survives every redirect.

Injected state may be **partial** — server-side `set` fills the rest of the tree
from `createInitialData()`, so `{"cmsPages":[…]}` alone is a valid inject and
produces no spurious diff before a browser opens. Browser recovery uses an
internal guarded `restore` action; it fills only missing files and refuses to
overwrite a concurrent task injection.

A supplied `sid` must fully match `[A-Za-z0-9_-]{1,128}`; invalid and empty
supplied values are rejected rather than sanitised into a colliding filename.
Omitting `sid` remains supported for default-state compatibility. The server
buffers request bytes before one UTF-8 decode, rejects malformed JSON,
non-object state, and state bodies over 10 MiB, serializes mutations per `sid`,
and atomically renames
temporary state files into place. Write failures return error responses.

Browser `saveState()` calls in one tick coalesce to the newest whole state and
are serialized per `sid` across ticks. Exported `flushState()` forces pending
writes to start and resolves after all queued writes land, rejecting on failure.
Top-level diffing compares the union of baseline and current keys. If a baseline
file is missing, `/go` compares current state with `createInitialData()` rather
than comparing current state with itself.

---

## How the state is split

`src/data/` is 4.8 MB; the state blob is approximately **321 KB across 44
top-level keys**, because the split is by *mutability*, not importance
(`src/utils/dataManager.js:1-35`):

| Tier | What | Where |
|---|---|---|
| **IN STATE** | small entities the admin can create/edit/delete, carried whole | `createInitialData()` |
| **OVERLAY** | large mutable entities (products 1.26 MB, orders 0.99 MB) — only a sparse `{id: patch}` map plus arrays of runtime-created records live in state | `*Overrides`, `new*`, `deleted*Ids` |
| **STATIC** | bulk read-only reference data, never in state: product descriptions, stock items, report aggregates, the category tree, attribute metadata, review summaries, the order/customer grid projections, and the **225-row `url_rewrite` corpus** | `src/utils/staticData.js`; `urlRewrites.json` imported directly at `src/pages/marketing/Marketing.jsx:8` |

Read merged entities through `src/utils/selectors.js` — reading `staticData.js`
directly in a page misses the session overlay.

---

## State Schema

| Key | Type | Seed source | Description |
|-----|------|-------------|-------------|
| `adminUsers` | array(1) | `src/data/adminUsers.json` | `{user_id, firstname, lastname, email, username, created, modified, logdate, lognum, is_active, role_id}` — the `admin` account |
| `adminRoles` | array(3) | `src/data/adminRoles.json` | `{role_id, parent_id, tree_level, sort_order, role_type, user_id, user_type, role_name, resources[]}` |
| `lockedAdminUsers` | array(0) | — (empty by design) | Rows for System > Permissions > Locked Users. Empty because `lock_expires` is NULL for every `admin_user` row in the source deployment; declared so the grid is injectable and Unlock has something to write. |
| `customers` | array(70) | `src/data/customers.json` | `{entity_id, website_id, email, group_id, store_id, created_at, updated_at, is_active, created_in, firstname, lastname, dob, gender, taxvat, addresses[]}` |
| `customerGroups` | array(4) | `src/data/customerGroups.json` | `{customer_group_id, customer_group_code, tax_class_id}` |
| `wishlists` | array(2) | `src/data/wishlists.json` | `{wishlist_id, customer_id, shared, updated_at, items[]}` — **both seeded rows have `items: []`**, matching the source's empty `wishlist_item` table, so the Wish List tab's Delete link is currently unreachable |
| `reviews` | array(351) | `src/data/reviews.json` | `{review_id, created_at, entity_id, entity_pk_value, status_id, status_code, store_id, title, detail, nickname, customer_id, product_name, sku, ratings{}}` — the largest key at 182 KB |
| `deletedReviewIds` | array(0) | — | Review ids removed through Marketing > Reviews |
| `ratings` | array(4) | `src/data/ratings.json` | `{rating_id, entity_id, rating_code, position, is_active, options[]}` |
| `cmsPages` | array(6) | `src/data/cmsPages.json` | `{page_id, title, identifier, page_layout, meta_*, content_heading, content, creation_time, update_time, is_active, store_ids[]}` |
| `cmsBlocks` | array(17) | `src/data/cmsBlocks.json` | `{block_id, title, identifier, content, creation_time, update_time, is_active, store_ids[]}` |
| `searchTerms` | array(7) | `src/data/searchTerms.json` | `{query_id, query_text, num_results, popularity, redirect, store_id, display_in_terms, updated_at}` |
| `newsletterSubscribers` | array(1) | `src/data/newsletterSubscribers.json` | `{subscriber_id, store_id, customer_id, subscriber_email, subscriber_status, name, website_id}` |
| `cartPriceRules` | array(4) | `src/data/cartPriceRules.json` | `{rule_id, name, description, from_date, to_date, uses_per_customer, is_active, conditions_serialized, actions_serialized, coupon_type, discount_amount, website_ids[], customer_group_ids[]}` |
| `catalogPriceRules` | array(2) | `src/data/catalogPriceRules.json` | Same shape plus `stop_rules_processing`, `sort_order`, `applied_at` (stamped by Apply Rules) |
| `coupons` | array(1) | `src/data/coupons.json` | `{coupon_id, rule_id, code, usage_limit, usage_per_customer, times_used, expiration_date, is_primary, created_at}` |
| `orderStatuses` | array(13) | `src/data/orderStatuses.json` | `{status, label, state, is_default, visible_on_front}` |
| `orderStatusHistory` | array(1) | `src/data/orderStatusHistory.json` | `{entity_id, parent_id, is_customer_notified, is_visible_on_front, comment, status, created_at, entity_name}` |
| `orderOverrides` | object(0) | — | `{[entity_id]: Partial<Order>}` — status/state transitions and edited order fields, layered over the static `orders` corpus |
| `orderComments` | object(0) | — | `{[entity_id]: Comment[]}` — the full comment list once an order gains one |
| `orderAddressOverrides` | object(0) | — | `{[address_id]: Partial<Address>}` — order billing/shipping address edits |
| `newOrders` | array(0) | — | Orders placed through Create New Order; concatenated over the static corpus by `getOrders`/`getOrder`/`getOrderGridRows`. Ids continue the real sequence from `staticData.maxOrderId` (309 is the first). |
| `invoices` | array(2) | `src/data/invoices.json` | `{entity_id, increment_id, state, store_id, store_name, order_id, order_increment_id, order_created_at, customer_name, grand_total, created_at, email_sent}` |
| `invoiceItems` | array(2) | `src/data/invoiceItems.json` | `{entity_id, parent_id, order_item_id, sku, name, qty, price, row_total, tax_amount}` |
| `shipments` | array(3) | `src/data/shipments.json` | `{entity_id, increment_id, store_id, order_increment_id, order_id, order_created_at, customer_name, total_qty, shipment_status, order_status, billing_name, email_sent}` |
| `shipmentItems` | array(4) | `src/data/shipmentItems.json` | `{entity_id, parent_id, order_item_id, sku, name, qty, price, row_total, weight}` |
| `shipmentTracks` | array(0) | — | `{entity_id, parent_id, order_id, carrier_code, title, track_number, created_at}` — tracking numbers added on a shipment |
| `creditMemos` | array(1) | `src/data/creditMemos.json` | `{entity_id, increment_id, created_at, updated_at, order_id, order_increment_id, order_created_at, billing_name, state, base_grand_total, order_status, items[], email_sent}` |
| `productOverrides` | object(0) | — | `{[entity_id]: Partial<Product>}` — every product-edit field, plus `configurable_children` / `configurable_attributes` when the Configurations wizard runs |
| `productDescriptionOverrides` | object(0) | — | `{[entity_id]: string}` — edited description HTML; the base lives in the static `productDescriptions.json` |
| `newProducts` | array(0) | — | Products created through Catalog > Add Product **and** the variants generated by the Configurations wizard |
| `deletedProductIds` | array(0) | — | Ids removed by the Products grid Delete mass action |
| `categoryOverrides` | object(0) | — | `{[entity_id]: Partial<Category>}` |
| `newCategories` | array(0) | — | Categories created through Add Root / Add Subcategory |
| `deletedCategoryIds` | array(0) | — | Ids removed by Catalog > Categories > Delete |
| `productAttributeOverrides` | object(0) | — | `{[attribute_id]: Partial<Attribute>}` — Stores > Attributes > Product edits |
| `newProductAttributes` | array(0) | — | Attributes created through Add New Attribute |
| `attributeSetOverrides` | object(0) | — | `{[attribute_set_id]: Partial<AttributeSet>}` |
| `newAttributeSets` | array(0) | — | Sets created through Stores > Attribute Set > Add Attribute Set |
| `coreConfig` | array(34) | `src/data/coreConfig.json` | `{config_id, scope, scope_id, path, value}` — the `core_config_data` table. Editing a field with no seeded row appends one, exactly as Magento does on first override. |
| `systemConfig` | object(26) | `src/data/systemConfig.json` + 19 declared overlays | Seed keys: `{websites[], store_groups[], stores[], themes[], currency_rates[], variables[], checkout_agreements[]}`. Baseline overlay defaults: `{cacheStatus{}, cacheFlushLog[], indexerModes{}, indexerStatuses{}, notificationOverrides{}, integrationStatus{}, unlockedAdminUserIds[], widgets[], design_changes[], synonyms[], newsletter_templates[], url_rewrites[], url_rewrite_edits{}, url_rewrite_deleted[], report_statistics{}, integrations[], sitemaps[], email_templates[], currency_symbols{}}`. |
| `dashboardStatistics` | object(0) | — | `{}` initially; Dashboard > Reload Data writes `{lifetime_refreshed_at, lifetime_refresh_count}`. |
| `taxConfig` | object(6) | `src/data/taxConfig.json` | `{classes[], rates[], rules[], calculations[], rate_titles[], shipping_tablerate[]}` |
| `gridBookmarks` | object(0) | — | `{[gridId]: {[viewName]: queryString}}` — views saved through any grid's Default View > Save View as |

### Baseline completeness

`dashboardStatistics` and all documented URL-rewrite overlay keys are declared
in `createInitialData()`. Their first mutation therefore has a precise `old`
value (`{}` or `[]`) instead of appearing as an undeclared object creation.

### Default IDs

- **Admin user**: `user_id 1`, username `admin`. **Roles**: 1 (Administrators), 2, 3.
- **Customers**: `entity_id` 1–70; `1` = Veronica Costello (`roni_cost@example.com`), `15` and `70` own the two wishlists.
- **Customer groups**: 0 NOT LOGGED IN, 1 General, 2 Wholesale, 3 Retailer.
- **Orders**: 308 in the static corpus, `entity_id` 1–308 / `increment_id` `000000001`–`000000308`. Order `300` is *processing*, `299` is on the Sales grid's first page. The first order created in-session is `309` / `000000309`.
- **Invoices**: 1 (order 1), 2 (order 2). **Shipments**: 1 (order 1), 2 (order 2), 3 (order 300). **Credit memos**: 1 (order 2) — the only reachable credit-memo form is `/admin/sales/order_creditmemo/new/creditmemo_id/1/`, matching the source, where `canCreditmemo()` is false for all 308 orders.
- **Products**: 2044 in the static corpus. Configurable parents include `62` (MH01, Chaz Kangeroo Hoodie), `78` (MH02), `94` (MH03), each with 15 children over `size` + `color`.
- **CMS pages**: 1 (404 Not Found), 2 (Home Page), 3 (Enable Cookies), 4 (Privacy and Cookie Policy), 5 (About us), 6 (Customer Service). **CMS blocks**: 1–17.
- **Ratings**: 1 Quality, 2 Value, 3 Price, 4 Rating. **Reviews**: 351 rows, `review_id` from the source.
- **Cart price rules**: 1–4. **Catalog price rules**: 1–2. **Coupon**: 1.
- **URL rewrites** (static, not in state): 225 rows, `url_rewrite_id` from the source.
- **Order statuses**: 13 rows, `pending`, `processing`, `complete`, `closed`, `canceled`, `holded`, `fraud`, …

---

## Minimal Inject Example

A partial inject is merged over `createInitialData()`, so only the keys a task
cares about need to be present.

```json
{
  "action": "set",
  "state": {
    "cmsPages": [
      { "page_id": 1, "title": "404 Not Found", "identifier": "no-route",
        "is_active": 1, "creation_time": "2023-04-19 16:12:16",
        "update_time": "2023-04-19 16:12:16" }
    ],
    "orderOverrides": {
      "300": { "status": "holded", "state": "holded" }
    },
    "coreConfig": [
      { "config_id": 1, "scope": "default", "scope_id": 0,
        "path": "general/store_information/name", "value": "One Stop Market" }
    ]
  }
}
```

---

## Observable State Changes (for LLM evaluation)

Every row below was driven in a real browser during the round-4 audit and its
`state_diff` read from `GET /go?sid=` immediately afterwards, except the handful
marked *(writer verified by code)* — those have a confirmed writer at the cited
path but no reachable affordance in the current seed.

### Sales

| User Action | State Field Changed |
|---|---|
| Order view → **Hold** | `orderOverrides[id].{status,state}`, `orderComments[id][]` |
| Order view → **Unhold** | `orderOverrides[id].{status,state}`, `orderComments[id][]` |
| Order view → **Cancel** | `orderOverrides[id].{status,state}`, `orderComments[id][]` |
| Order view → **Submit Comment** | `orderComments[id][]` |
| Order view → **Send Email** | `orderOverrides[id].email_sent`, newest un-notified `orderStatusHistory` row → `is_customer_notified: 1` |
| Order view → Invoice → **Submit Invoice** | `invoices[]`, `invoiceItems[]`, `orderOverrides[id].{status,state,total_invoiced}` |
| Order view → Ship → **Submit Shipment** | `shipments[]`, `shipmentItems[]`, `orderOverrides[id].{status,state}`, `orderComments[id][]` |
| Shipment view → **Add Tracking Number** / remove | `shipmentTracks[]` |
| Order edit → billing/shipping address save | `orderAddressOverrides[address_id]` |
| **Create New Order** (`reorder`/`edit`) → **Submit Order** | `newOrders[]`, `orderComments[newId][]` |
| Credit Memo (`new/creditmemo_id/1/`) → **Refund Offline** | `creditMemos[]`, `orderComments[order_id][]` |
| Invoice view → **Send Email** | `invoices[i].email_sent` |
| Shipment view → **Send Email** | `shipments[i].email_sent` |
| Credit Memo view → **Send Email** | `creditMemos[i].email_sent` |
| Sales > Order Statuses → **Create New Status** / edit | `orderStatuses[]` |
| Any grid → Default View → **Save View as** | `gridBookmarks[gridId][name]` |

### Catalog

| User Action | State Field Changed |
|---|---|
| Product edit → **Save** | `productOverrides[id]`, `productDescriptionOverrides[id]` |
| Catalog > **Add Product** → Save | `newProducts[]` |
| Products grid → **Delete** mass action | `deletedProductIds[]` |
| Products grid → **Update attributes** mass action | `productOverrides[id]` |
| Configurations → **Edit Configurations** wizard → **Generate Products** → Save | `newProducts[]`, `productOverrides[parent].{configurable_children,configurable_attributes}` |
| Configurations → **Add Products Manually** → Add → Save | `productOverrides[parent].configurable_children` |
| Category tree → **Save** | `categoryOverrides[id]` |
| Category tree → **Add Root/Subcategory** | `newCategories[]`, `categoryOverrides[parent]` |
| Category tree → **Delete** | `deletedCategoryIds[]` |
| Stores > Attributes > Product → edit → Save | `productAttributeOverrides[attribute_id]` |
| Stores > Attributes > Product → **Add New Attribute** | `newProductAttributes[]` |
| Stores > Attribute Set → rename / Save | `attributeSetOverrides[set_id]` |
| Stores > Attribute Set → **Add Attribute Set** | `newAttributeSets[]` |

### Customers

| User Action | State Field Changed |
|---|---|
| Customer edit → **Save Customer** | `customers[i]` |
| Customer grid → Delete / mass actions | `customers[]` |
| Customer Groups → create / edit / delete | `customerGroups[]` |
| Customer edit → Wish List tab → **Delete** | `wishlists[i].items[]` *(writer verified by code — `src/context/AppContext.jsx:224-232`; unreachable in the current seed, both wishlists have `items: []`)* |
| Customer edit → **Reset Password** / **Force Sign-In** | *none* — mail/session side effects, declared declines, `state_diff = []` |

### Content

| User Action | State Field Changed |
|---|---|
| Content > Pages → edit / create → **Save Page** | `cmsPages[]` |
| Content > Pages → **Delete** | `cmsPages[]` |
| Content > Blocks → edit / create → **Save Block** | `cmsBlocks[]` |
| Content > Blocks → **Delete Block** | `cmsBlocks[]` |

### Marketing

| User Action | State Field Changed |
|---|---|
| Cart Price Rules → create / edit → **Save** | `cartPriceRules[]`, `coupons[]` |
| Cart Price Rules → **Delete** | `cartPriceRules[]`, `coupons[]` |
| Catalog Price Rules → create / edit / delete | `catalogPriceRules[]` |
| Catalog Price Rules → **Apply Rules** | `catalogPriceRules[i].applied_at` |
| Search Terms → create / edit / delete | `searchTerms[]` |
| Newsletter Subscribers → **Unsubscribe** / **Delete** mass action | `newsletterSubscribers[]` |
| **URL Rewrites → Save** (new row) | `systemConfig.url_rewrites[]` |
| **URL Rewrites → Save** (seed row) | `systemConfig.url_rewrite_edits[id]` |
| **URL Rewrites → Delete** (seed row) | `systemConfig.url_rewrite_deleted[]` |
| Reviews → edit → **Save Review** | `reviews[]` |
| Reviews → **New Review** | `reviews[]` |
| Reviews → **Delete** mass action | `deletedReviewIds[]` |
| Ratings → create / edit / delete | `ratings[]` |

### Reports & Dashboard

| User Action | State Field Changed |
|---|---|
| Reports > Refresh Statistics → mass action | `systemConfig.report_statistics` |
| **Dashboard → Reload Data** | `dashboardStatistics.{lifetime_refreshed_at, lifetime_refresh_count}` |

### Stores & System

| User Action | State Field Changed |
|---|---|
| **Stores > Configuration → Save Config** (any field, including Store Name / Phone, which have no descriptor `path`) | `coreConfig[]` — existing rows patched, new rows appended |
| Stores > Configuration → Save with nothing changed | *none* — declines with `There is nothing to save…` (`notice`), `state_diff = []` |
| Stores > Tax Zones and Rates → **Save Rate** | `taxConfig.rates[]` |
| Stores > Tax Rules → **Save Rule** | `taxConfig.rules[]`, `taxConfig.calculations[]` |
| Stores > Tax → **Import Tax Rates** with a valid CSV | `taxConfig.rates[]` (upsert on `Code`) |
| Stores > Tax → Import with no/invalid file | *none* — `Invalid file upload attempt.` (`error`) |
| System > **Cache Management → Enable / Disable / Refresh** | `systemConfig.cacheStatus[tag]` |
| System > Cache Management → any **Flush** button | `systemConfig.cacheFlushLog[]` |
| System > **Index Management → Update on Save / by Schedule / Reindex** | `systemConfig.indexerModes[id]`, `systemConfig.indexerStatuses[id]` |
| System > **Notifications → Mark as Read** | `systemConfig.notificationOverrides[id].is_read` |
| System > **Notifications → Remove** | `systemConfig.notificationOverrides[id].removed` |
| System > **Integrations → Reauthorize** | `systemConfig.integrationStatus[id]` |
| System > Integrations → create / edit (`useSystemCollection`) | `systemConfig.integrations[]` — a seeded row's edit is stored as a new state row under the same `integration_id`; deleting a seeded one declines with `System integrations cannot be deleted.` |
| System > All Users → create / edit / delete | `adminUsers[]`, `adminRoles[i].user_id` |
| System > User Roles → create / edit / delete | `adminRoles[]` |
| System > Permissions > Locked Users → **Unlock** | `lockedAdminUsers[]`, `systemConfig.unlockedAdminUserIds[]` *(writer verified by code — `src/pages/system/Permissions.jsx:126-135`; latent, the grid is empty, matching the source)* |
| System > Bulk Actions Log → **Remove** | `systemConfig.notificationOverrides[id].removed` *(writer verified by code — `src/pages/system/Tools.jsx:600-620`; latent, the grid is empty)* |
| System > **Encryption Key → Change** | *none* — `Key changing is disabled in this environment.` (`notice`) |
| Account Activity → **Log out all other sessions** | *none* — `There are no other open sessions to terminate.` (`notice`) |

**Nothing in this migration prints a success message without a matching state
change.** Actions that cannot mutate anything decline explicitly with a `notice`
or `error` and leave `state_diff` empty — those rows are listed above so they are
not mistaken for missing tracking.
