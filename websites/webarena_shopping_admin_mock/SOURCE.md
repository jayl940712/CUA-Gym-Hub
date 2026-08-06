# shopping_admin — Source Recon Record

> Source: `http://localhost:7780/admin` (container-internal base URL is
> `http://10.186.197.203:7780/`, i.e. `$(hostname -I | awk '{print $1}')`)
> Docker image: `shopping_admin_final_0719:latest` · container: `shopping_admin`
> Recon by: plan agent, 2026-08-05 · **Recon mode: FULL** (docker + HTTP + DB)

---

## 1. Stack

| Layer | What it is |
|---|---|
| Application | **Magento 2 Open Source, adminhtml (backend) area** |
| Runtime | PHP-FPM + Apache inside a single container |
| Database | MySQL/MariaDB, schema `magentodb`, user `magentouser` / `MyPassword` |
| Frontend theme | `Magento/backend` (the Magento admin "Luma backend" theme) |
| Static root | `/static/version1681922233/adminhtml/Magento/backend/en_US/` |
| Admin JS | Knockout.js + Magento UI components (`Magento_Ui/js/grid/listing` etc.) |
| Grids | **Magento UI-component grids** (`*_listing` XML), rendered client-side from a JSON `data-mage-init` blob embedded in the page, and refreshed over XHR |
| Storefront twin | The same catalog/order data is served by the `shopping` container on :7770 |

The admin front name is `admin`, so **every admin URL is prefixed `/admin/`**,
and Magento's own module route follows it — hence the doubled segment in
`/admin/admin/dashboard/` (front name `admin` + `Magento_Backend` route `admin`).

## 2. Access

| Probe | Result |
|---|---|
| `docker ps --filter name=shopping_admin` | **OK** — `shopping_admin  shopping_admin_final_0719  Up 9 hours` |
| `curl --noproxy '*' http://localhost:7780/admin` | **302** → `/admin/admin/` → login form (expected; unauthenticated) |
| `docker exec shopping_admin mysql -u magentouser -pMyPassword magentodb` | **OK** — full read access |

Recon was therefore **FULL**: DB queries, rendered-DOM capture, and CSS
extraction were all available. All DB access was read-only; `assets/dumps/mysql.py`
hard-rejects any statement that does not begin `SELECT`/`SHOW`/`DESC`. Nothing was
mutated through the admin UI either.

### Login flow (source only — the mock must NOT reproduce it)

1. `GET /admin/` → 302 → `GET /admin/admin/` → 302 → `/admin/admin/auth/login/`
2. `POST /admin/admin/auth/login/` with `login[username]=admin`,
   `login[password]=admin1234`. Sets `admin` cookie (path `/admin`) + `PHPSESSID`.
3. Redirects to `/admin/admin/dashboard/`.
4. Logout is `GET /admin/admin/auth/logout/`.

HTML capture used a curl cookie jar seeded by that POST
(`assets/dumps/` → helper `fetch.sh`, jar at `/tmp/recon/shopping_admin/cj.txt`).

### Admin URL key / secret key — verified OFF

Stock Magento appends a per-route `/key/<sha256>/` segment to admin URLs. **This
deployment has it disabled.** Verified two ways:

- every `href` in the captured dashboard DOM is bare, e.g.
  `http://10.186.197.203:7780/admin/sales/order/` — no `/key/` segment anywhere
  in 81 captured pages;
- `core_config_data` has no `admin/url/use_secret_key` row and
  `admin/security/use_form_key = 0`.

Also off: `admin/captcha/enable = 0`, `admin/usage/enabled = 0`.
`admin/security/session_lifetime = 360000` (100 h), `admin/security/admin_account_sharing = 1`.

**Mock rule:** emit bare paths, but *accept and ignore* a `/key/<anything>/`
suffix if an agent ever supplies one, per `WEBARENA_MIGRATION.md` §6.

### Trailing slashes

Magento accepts both `/admin/sales/order` and `/admin/sales/order/` and its own
menu emits the **trailing-slash** form. WebArena task URLs use both forms
(`.../reports/report_sales/sales` vs `.../reports/report_sales/tax/`).
**The mock must treat trailing slash as optional on every route.**

## 3. Scale of the real data (from the DB)

| Entity | Table | Count | ID range | Notes |
|---|---|---|---|---|
| Orders | `sales_order` | 308 | `entity_id` 1–308 | `increment_id` `000000001`–`000000308`, 1:1 with entity_id |
| Order status | `sales_order.status` | — | — | complete 153, canceled 142, pending 10, processing 2, closed 1 |
| Invoices | `sales_invoice` | 2 | 1–2 | `000000001`, `000000002` |
| Shipments | `sales_shipment` | 3 | — | |
| Credit memos | `sales_creditmemo` | 1 | — | |
| Customers | `customer_entity` | 70 | 1–70 | |
| Customer groups | `customer_group` | 4 | 0–3 | NOT LOGGED IN / General / Wholesale / Retailer |
| Products | `catalog_product_entity` | 2040 | 1–2040 | simple 1891, configurable 147, bundle 1, grouped 1 |
| Attribute sets | `eav_attribute_set` (entity 4) | 8 | 4,9–15 | Default 4, Top 9, Bottom 10, Gear 11, Sprite Stasis Ball 12, Sprite Yoga Strap 13, Downloadable 14, Bag 15 |
| Categories | `catalog_category_entity` | 40 | 1–40 | |
| Reviews | `review` | 351 | `review_id` 1–353 (2 gaps) | status 1 (Approved) 346, status 2 (Pending) 5, status 3 (Not Approved) 0 |
| CMS pages | `cms_page` | 6 | 1–6 | 404 Not Found / Home Page / Enable Cookies / Privacy Policy / About us / Customer Service |
| Themes | `theme` | 3 | 1–3 | 1 Magento Blank, 2 Magento 2 backend, 3 Magento Luma |
| Search terms | `search_query` | 7 | — | top term `hollister` |

These counts are **answers to WebArena tasks** (e.g. task 344 "how many reviews"
→ 351; task 77 pending reviews → 5; task 78 approved → 346). The seed must
reproduce the counts the grids display, not just a sample — see
`assets/data_model.md` §"Counts that are answers".

## 4. Structural observations

- **Layout.** Fixed 88 px dark icon rail on the left (`.menu-wrapper`, bg `#373330`),
  everything else in `.page-wrapper` (`width: calc(100% - 8.8rem)`). Inside it:
  `.page-header` (search / notifications / admin-user dropdown),
  `.page-title-wrapper` + `.page-actions` button row, then `.page-content`
  (padding `0 3rem 3rem`). Hovering a rail icon slides out a dark `#4a4542`
  submenu panel from `left: 100%`.
- **Grids are all one component.** Orders, Products, Customers, Invoices,
  Shipments, Credit Memos, Reviews, CMS Pages, Cart Price Rules, Search Terms
  all render the same `admin__data-grid` chrome: a search box ("Search by
  keyword"), **Filters** toggle panel, **Default View** bookmark dropdown,
  **Columns** chooser dropdown, optional **Export** control, an
  `.admin__data-grid-filters-current` "Active filters:" strip (hidden until a
  filter is applied), an "N records found" counter, a per-page selector
  (20/30/50/100/200) and a pager. Selecting rows reveals an **Actions**
  mass-action dropdown. Getting this one component right buys ~15 routes.
  WebArena tasks 676–680 assert on
  `document.querySelector("div.admin__data-grid-filters-current").outerText`,
  so the active-filter chip strip is **load-bearing DOM**, not decoration.
- **Some grids are the older `Magento_Backend` grid**, not the UI component:
  Reports (all of them), Search Terms Report, Reviews (`review/product/index`),
  Order Status, Tax Rules/Rates, Newsletter. These have an inline filter row
  *inside* the table head, a "Reset Filter"/"Search" button pair, and different
  markup. Reports additionally have a **date-range + period + Show Report**
  header with `#sales_report_from` / `#sales_report_to` inputs — asserted by
  WebArena tasks 704–713, so those exact element ids matter.
- **Order view** (`/admin/sales/order/view/order_id/N/`) is a tabbed left-nav
  page (`.admin__page-nav`, items: Information, Invoices, Credit Memos,
  Shipments, Comments History, Transactions). `#order_status` holds the status
  label (asserted by tasks 470–474). `#order_history_block .note-list` holds
  comments (tasks 491–495). Page action buttons carry ids `order_edit`,
  `order_reorder`, `order_invoice`, `order_ship`, plus
  `#order-view-cancel-button` and `#order-view-hold-button`.
- **Product edit** is a single long form with collapsible sections
  (Content, Configurations, Images and Videos, Search Engine Optimization,
  Related Products, Customizable Options, Product in Websites, Design,
  Schedule Design Update, Gift Options, Downloadable Information). Field names
  are `product[<attr>]` — `product[name]`, `product[price]`,
  `product[quantity_and_stock_status][qty]`,
  `product[quantity_and_stock_status][is_in_stock]`, `product[status]`,
  `product[size]`, `product[color]`, `product[sale]`. Nearly every WebArena
  product task asserts on one of those `name=` selectors, so **the input `name`
  attributes are part of the contract**.
- **Configurable products** render a `[data-index="configurable"]` section whose
  outerText lists variant names like `Phoebe Zipper Sweatshirt-S-Brown`
  (tasks 547–551) and a "Create Configurations" wizard.
- **Messages.** Success/error banners are `.message.message-success` /
  `.message-error` at the top of `.page-main-actions`, background `#fffbbb`
  family, and persist one page load.

## 5. Observations that constrain the mock

1. **`increment_id` is `entity_id` zero-padded to 9** for every order in this
   dataset (`302` ⇒ `000000302`). Tasks address orders both ways ("order #308",
   `order_id/308`), so the mock must render `000000308` while routing on `308`.
2. **Order dates run 2022-01-01 … 2023-05-31**; the newest pending order is 299
   at 2023-05-31 and the newest canceled is 2023-05-23 (tasks 199, 202, 203).
   Do not shift dates to "now" — the answers are date-literal.
3. **Reviews are all dated Apr 2023** (task 345: 351 in Apr 2023; task 346: 0
   during 2022; task 348: 0 in May 2023). Keep `created_at` in April 2023.
4. **Only 2 invoices, 3 shipments, 1 credit memo exist.** Those grids are nearly
   empty by design and tasks 94/95 read invoice grand totals 36.39 / 39.64.
5. **`admin` is the only admin user**, `System > All Users` shows one row.
6. Product images are served from `/media/catalog/product/...` on the same host.
   The mock has no server; images must be copied to `public/` or replaced with
   same-dimension placeholders.

## 6. Gaps / unverified — dev must not guess silently

- **Screenshots** are owned by a sibling agent; none were captured by this pass.
  Visual detail in `DESIGN.md` comes from the source CSS, not from pixels.
- **Grid XHR payload shape not reverse-engineered.** The mock filters
  client-side, so this does not matter — but it means I have not verified
  Magento's exact `filters[placeholder]` query-param encoding for every grid.
  What *is* verified is the bookmark/URL behaviour documented in `ROUTES.md`
  §"Query parameters": UI-component grids keep state in a `data-*` bookmark and
  usually do **not** put filters in the URL. Tasks 676–680 assert on rendered
  DOM (`.admin__data-grid-filters-current`), not on the URL, so a mock that
  *does* mirror filters into the query string is a superset and is safe.
- **Shipment/credit-memo "new" pages return 404 for non-invoiced orders.**
  `sales/order_creditmemo/new/order_id/299` and
  `sales/order_shipment/new/order_id/304` both 404'd; the working entry point is
  the button URL `/admin/admin/order_shipment/start/order_id/N/` (note the
  doubled `admin/admin`), which 200s and redirects to the new-shipment form.
  Which orders permit which action is state-dependent and I only sampled 302,
  304, 308.
- **`func:shopping_admin_get_cart_price_rule(...)` evaluators** (tasks 699–703)
  call the Magento REST API against the source. In the mock these can only be
  satisfied by state, not by an API; the dev agent should expose the created rule
  in `/go` state with the same field names (`name`, `customer_group_ids`,
  `simple_action`, `discount_amount`). I did not verify the REST response shape.
- **Tasks 464, 543–546 assert against storefront URLs** (`../antonia-racer-tank.html`),
  i.e. the *shopping* mock, not this one. Cross-mock; out of scope here but the
  admin must actually persist the description edit.
- **Tasks 759–760 assert against the Map mock.** Only the customer city lookup
  (Sophia Young → Boston, Amanda Kim → Hoboken NJ) belongs to this site.
- **Reports are pre-aggregated in Magento** (`sales_order_aggregated_*`). I read
  order rows, not the aggregation tables, so report figures in the mock should be
  computed from the seeded orders. Task 107–111 monthly completed-order counts
  are the acceptance test for that computation.
