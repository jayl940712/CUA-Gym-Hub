# assets/ — recon artefacts for webarena_shopping_admin_mock

Everything here was captured from the live source
`http://localhost:7780/admin` (container `shopping_admin`, image
`shopping_admin_final_0719`) between 2026-08-05 13:00 and 18:40 UTC.
All capture was **read-only**: no writes through the admin UI, no
`UPDATE`/`INSERT`/`DELETE` against the database.

| Path | What it is |
|---|---|
| `TASKS.md` | The 184 WebArena `shopping_admin` tasks with expected answers, extracted from `/webarena/webarena.jsonl`. **This is the requirements spec** — `ROUTES.md` and `TODO.md` are both derived from it. |
| `data_model.md` | Real entity/id model: tables, id ranges, identifiers that must never be regenerated, `createInitialData()` shape, and the counts that are task answers. |
| `html/` | 93 raw admin pages, one file per route (see index below). |
| `dumps/` | Read-only DB extraction scripts and intermediate dumps. |
| `screenshots/` | Reference captures of the live site (owned by the screenshot agent). |

---

## How the HTML was captured

The admin requires a session, so capture used a curl cookie jar seeded by a
login POST rather than plain `curl`:

```bash
# one-time: POST login[username]=admin&login[password]=admin1234 to
#   http://10.186.197.203:7780/admin/admin/auth/login/  -c /tmp/recon/shopping_admin/cj.txt
# then, per page:
bash /tmp/recon/shopping_admin/fetch.sh <slug> <path-after-/admin/>
```

`fetch.sh` writes `assets/html/<slug>.html` and prints the status code and byte
size. `--noproxy '*'` is mandatory in this environment. The cookie jar lives in
`/tmp` and expires; re-run the login POST if pages come back as the login form.

Pages are the **server-rendered DOM**, which for Magento UI-component grids means
the grid body is *not* in the HTML — it arrives as a JSON blob inside a
`data-mage-init` attribute and is rendered by Knockout. Read that blob for column
definitions, filter definitions, mass-action lists and per-page options; read the
surrounding markup for the page chrome, buttons and headings.

### Live-site facts worth re-reading rather than re-deriving

- The full admin menu (all 10 top-level items and every submenu link) is embedded
  in **every** page; `dashboard.html` is the convenient copy.
- No `/key/<hash>/` segment appears anywhere — admin secret keys are off.
- The base URL inside rendered links is `http://10.186.197.203:7780/`
  (`web/unsecure/base_url`), not `localhost`.

---

## html/ index

### Sales
| File | Source path |
|---|---|
| `sales-order-grid.html` | `/admin/sales/order/` |
| `sales-order-view-299.html` | `/admin/sales/order/view/order_id/299/` (newest pending) |
| `sales-order-view-302.html` | `/admin/sales/order/view/order_id/302/` |
| `sales-order-view-304.html` | `/admin/sales/order/view/order_id/304/` |
| `sales-order-view-308.html` | `/admin/sales/order/view/order_id/308/` |
| `sales-order-address-603.html` | `/admin/sales/order/address/address_id/603/` (order 302's address) |
| `sales-order-comments-308.html` | `/admin/sales/order/commentsHistory/order_id/308/` |
| `sales-order-invoice-new-302.html` | `/admin/sales/order_invoice/new/order_id/302/` |
| `sales-order-invoice-view-1.html` | `/admin/sales/invoice/view/invoice_id/1/` |
| `sales-order-shipment-new-308.html` | `/admin/admin/order_shipment/start/order_id/308/` → the New Shipment form |
| `sales-order-shipment-new-304.html` | `/admin/sales/order_shipment/new/order_id/304/` — **404 body**, kept as evidence that this path is wrong; use `admin/order_shipment/start/...` |
| `sales-order-creditmemo-new-299.html` | `/admin/sales/order_creditmemo/new/order_id/299/` — **404 body** (order not invoiced) |
| `sales-invoice-grid.html` | `/admin/sales/invoice/` |
| `sales-shipment-grid.html` | `/admin/sales/shipment/` |
| `sales-creditmemo-grid.html` | `/admin/sales/creditmemo/` |
| `sales-transactions.html` | `/admin/sales/transactions/` |
| `sales-order-status.html` | `/admin/sales/order_status/` |

### Catalog
| File | Source path |
|---|---|
| `catalog-product-grid.html` | `/admin/catalog/product/` |
| `catalog-product-edit-126.html` | `/admin/catalog/product/edit/id/126/` (Hollister Backyard Sweatshirt, configurable) |
| `catalog-product-edit-1130-configurable.html` | `/admin/catalog/product/edit/id/1130/` (Phoebe Zipper Sweatshirt — the reference for the Configurations section) |
| `catalog-product-new.html` | `/admin/catalog/product/new/set/4/type/simple/` |
| `catalog-category.html` | `/admin/catalog/category/` (Default Category, ID 2) |
| `catalog-category-edit-3.html` | `/admin/catalog/category/edit/id/3/` (Gear) |
| `catalog-product-attribute.html` | `/admin/catalog/product_attribute/` |
| `catalog-product-set.html` | `/admin/catalog/product_set/` |
| `inventory-source.html`, `inventory-stock.html` | `/admin/inventory/source/index/`, `/admin/inventory/stock/index/` |

### Customers
| File | Source path |
|---|---|
| `customer-index.html` | `/admin/customer/index/` |
| `customer-edit-1.html` | `/admin/customer/index/edit/id/1/` (Veronica Costello) |
| `customer-new.html` | `/admin/customer/index/new/` |
| `customer-group.html` | `/admin/customer/group/` |
| `customer-online.html` | `/admin/customer/online/` |

### Marketing & reviews
| File | Source path |
|---|---|
| `marketing-cart-rule.html` | `/admin/sales_rule/promo_quote/` |
| `marketing-cart-rule-new.html` | `/admin/sales_rule/promo_quote/new/` |
| `marketing-catalog-rule.html` | `/admin/catalog_rule/promo_catalog/` |
| `review-product-index.html` | `/admin/review/product/index/` |
| `review-product-pending.html` | `/admin/review/product/pending/` |
| `review-product-edit-351.html` | `/admin/review/product/edit/id/351/` (pending, negative) |
| `review-product-edit-352.html` | `/admin/review/product/edit/id/352/` (pending, task 771) |
| `review-rating.html` | `/admin/review/rating/` |
| `search-term.html` | `/admin/search/term/` |
| `search-term-edit.html` | `/admin/search/term/edit/id/1/` (Joust Bag) |
| `search-term-report.html` | `/admin/search/term/report/` |
| `search-synonyms.html` | `/admin/search/synonyms/index/` |
| `url-rewrite.html` | `/admin/admin/url_rewrite/index/` |
| `newsletter-template.html`, `newsletter-queue.html`, `newsletter-subscriber.html` | `/admin/newsletter/{template,queue,subscriber}/` |
| `checkout-agreement.html` | `/admin/checkout/agreement/` |

### Content
| File | Source path |
|---|---|
| `cms-page.html` | `/admin/cms/page/` |
| `cms-page-edit-1.html` | `/admin/cms/page/edit/page_id/1/` (404 Not Found page) |
| `cms-page-new.html` | `/admin/cms/page/new/` |
| `cms-block.html` | `/admin/cms/block/` |
| `widget-instance.html` | `/admin/admin/widget_instance/` |
| `media-gallery.html` | `/admin/media_gallery/media/index/` |
| `theme-design-config.html` | `/admin/theme/design_config/` |
| `system-design-theme.html` | `/admin/admin/system_design_theme/` |
| `system-design-theme-edit-1.html` | `/admin/admin/system_design_theme/edit/id/1/` (Magento Blank — task 374) |

### Reports
| File | Source path |
|---|---|
| `reports-sales.html` | `/admin/reports/report_sales/sales/` |
| `reports-tax.html` | `/admin/reports/report_sales/tax/` |
| `reports-invoiced.html` | `/admin/reports/report_sales/invoiced/` |
| `reports-shipping.html` | `/admin/reports/report_sales/shipping/` |
| `reports-refunded.html` | `/admin/reports/report_sales/refunded/` |
| `reports-coupons.html` | `/admin/reports/report_sales/coupons/` |
| `reports-bestsellers.html` | `/admin/reports/report_sales/bestsellers/` |
| `reports-product-sold.html` | `/admin/reports/report_product/sold/` |
| `reports-product-lowstock.html` | `/admin/reports/report_product/lowstock/` |
| `reports-product-viewed.html` | `/admin/reports/report_product/viewed/` |
| `reports-product-downloads.html` | `/admin/reports/report_product/downloads/` |
| `reports-customer-orders.html` | `/admin/reports/report_customer/orders/` |
| `reports-customer-totals.html` | `/admin/reports/report_customer/totals/` |
| `reports-customer-accounts.html` | `/admin/reports/report_customer/accounts/` |
| `reports-review-customer.html` | `/admin/reports/report_review/customer/` |
| `reports-review-product.html` | `/admin/reports/report_review/product/` |
| `reports-shopcart-product.html`, `reports-shopcart-abandoned.html` | `/admin/reports/report_shopcart/{product,abandoned}/` |
| `reports-statistics.html` | `/admin/reports/report_statistics/` |
| `analytics-reports.html` | `/admin/analytics/reports/show/` |

### Stores / System / shell
| File | Source path |
|---|---|
| `dashboard.html` | `/admin/admin/dashboard/` — **also the canonical copy of the full admin menu** |
| `system-store.html` | `/admin/admin/system_store/` |
| `system-config.html` | `/admin/admin/system_config/` |
| `system-config-general.html` | `/admin/admin/system_config/edit/section/general/` |
| `system-config-currency.html` | `/admin/admin/system_config/edit/section/currency/` |
| `admin-system-currency.html`, `admin-system-currencysymbol.html` | `/admin/admin/system_currency/`, `/admin/admin/system_currencysymbol/` |
| `tax-rate.html`, `tax-rule.html` | `/admin/tax/rate/`, `/admin/tax/rule/` |
| `admin-user.html`, `admin-user-role.html` | `/admin/admin/user/`, `/admin/admin/user_role/` |
| `admin-system-variable.html` | `/admin/admin/system_variable/` |
| `admin-cache.html` | `/admin/admin/cache/` |
| `admin-import.html`, `admin-export.html` | `/admin/admin/import/`, `/admin/admin/export/` |
| `admin-notification.html` | `/admin/admin/notification/` |
| `admin-system-account.html` | `/admin/admin/system_account/index/` |

---

## dumps/

| File | What it does |
|---|---|
| `mysql.py` | **Read-only MySQL helper.** `raw(sql)` refuses anything not starting `SELECT`/`SHOW`/`DESC`; `rows(json_expr, rest)` returns one dict per row, base64-wrapping the payload server-side because `mysql -B` escapes tabs/newlines and corrupts JSON. **Reuse this for any further DB query** rather than shelling out to `docker exec mysql` by hand. |
| `eav.py` | Resolves Magento EAV attribute values (`catalog_product_entity_{varchar,int,decimal,text}`) into flat product dicts. |
| `extract_products.py` | Builds the raw product dump from EAV + stock + website/category links. |
| `curate_products.py` | Trims the raw dump into `src/data/products.json` and splits descriptions into `productDescriptions.json`. |
| `extract_customers.py` | Builds `customers.json` (customer EAV + addresses). |
| `extract_sales.py` | Builds `orders.json` (orders + addresses + items + payment). |
| `products.json`, `productOptions.json` | Intermediate raw dumps, pre-curation. |

Still to write (see `TODO.md` § Data Seed): extractors for reviews, search terms,
invoices/shipments/credit memos, CMS pages, themes and categories.

CSS for `DESIGN.md` came from
`http://localhost:7780/static/version1681922233/adminhtml/Magento/backend/en_US/css/styles.css`
(576 KB), saved to `/tmp/recon/shopping_admin/styles.css` — not committed, since
it is a vendor build artefact and `DESIGN.md` records every token taken from it
alongside its source selector.
