# webarena_shopping_admin_mock — Test Report (part: catalog / customers / content / stores-system)

> Round: **12** · Date: 2026-08-06
> Mock: **http://localhost:5201** · Source: http://localhost:7780/admin (reachable: YES)
> Tested by: playwright agent (test12-func) · rows 39–59, 74, 101–134
> Status: IN PROGRESS — written incrementally.

## Task 1 — Cold route parity sweep (COMPLETE)

Part of the same 118-URL fresh-context sweep described in `TEST.part-sales.md`.
**All 76 rows below pass**: correct view, `sid` preserved, 0 console errors,
0 external requests, 0 broken images.

| ROUTES # | Path | Cold 200 | Correct view (h1) | sid kept | console/pageerror | ext req | broken img |
|---|---|---|---|---|---|---|---|
| 39 | `/admin/catalog/product/` | ✅ | Products | ✅ | 0 | 0 | 0 |
| 39b | `/admin/catalog/product/index/` | ✅ | Products | ✅ | 0 | 0 | 0 |
| 39c | `/admin/catalog/product/index/?search=Sprite` | ✅ | Products | ✅ | 0 | 0 | 0 |
| 40 | `/admin/catalog/product/edit/id/1/` | ✅ | Joust Duffle Bag | ✅ | 0 | 0 | 0 |
| 41 | `/admin/catalog/product/edit/id/1170/` | ✅ | Helena Hooded Fleece-M-Gray | ✅ | 0 | 0 | 0 |
| 43 | `/admin/catalog/product/new/set/4/type/simple/` | ✅ | New Product | ✅ | 0 | 0 | 0 |
| 43b | `/admin/catalog/product/new/set/9/type/simple/` | ✅ | New Product | ✅ | 0 | 0 | 0 |
| 44 | `/admin/catalog/category/` | ✅ | Default Category (ID: 2) | ✅ | 0 | 0 | 0 |
| 45 | `/admin/catalog/category/edit/id/3/` | ✅ | Gear (ID: 3) | ✅ | 0 | 0 | 0 |
| 46 | `/admin/catalog/product_attribute/` | ✅ | Product Attributes | ✅ | 0 | 0 | 0 |
| 46a | `/admin/catalog/product_attribute/new/` | ✅ | New Product Attribute | ✅ | 0 | 0 | 0 |
| 47 | `/admin/catalog/product_attribute/edit/attribute_id/93/` | ✅ | Color | ✅ | 0 | 0 | 0 |
| 48 | `/admin/catalog/product_set/` | ✅ | Attribute Sets | ✅ | 0 | 0 | 0 |
| 48a | `/admin/catalog/product_set/add/` | ✅ | New Attribute Set | ✅ | 0 | 0 | 0 |
| 49 | `/admin/catalog/product_set/edit/id/4/` | ✅ | Default | ✅ | 0 | 0 | 0 |
| 50 | `/admin/inventory/source/index/` | ✅ | Manage Sources | ✅ | 0 | 0 | 0 |
| 51 | `/admin/inventory/stock/index/` | ✅ | Manage Stock | ✅ | 0 | 0 | 0 |
| 52 | `/admin/customer/index/` | ✅ | Customers | ✅ | 0 | 0 | 0 |
| 52b | `/admin/customer/index/index/` | ✅ | Customers | ✅ | 0 | 0 | 0 |
| 52c | `/admin/customer/index/index/?search=Veronica` | ✅ | Customers | ✅ | 0 | 0 | 0 |
| 53 | `/admin/customer/index/edit/id/1/` | ✅ | Veronica Costello | ✅ | 0 | 0 | 0 |
| 53b | `/admin/customer/index/edit/id/1/active_tab/orders/` | ✅ | Veronica Costello | ✅ | 0 | 0 | 0 |
| 53c | `/admin/customer/index/orders/id/1/` | ✅ | Veronica Costello | ✅ | 0 | 0 | 0 |
| 53d | `/admin/customer/index/cart/id/1/` | ✅ | Veronica Costello | ✅ | 0 | 0 | 0 |
| 53e | `/admin/customer/index/wishlist/id/1/` | ✅ | Veronica Costello | ✅ | 0 | 0 | 0 |
| 53f | `/admin/review/customer/productReviews/id/1/` | ✅ | Veronica Costello | ✅ | 0 | 0 | 0 |
| 54 | `/admin/customer/index/new/` | ✅ | New Customer | ✅ | 0 | 0 | 0 |
| 56 | `/admin/customer/group/` | ✅ | Customer Groups | ✅ | 0 | 0 | 0 |
| 57 | `/admin/customer/group/new/` | ✅ | New Customer Group | ✅ | 0 | 0 | 0 |
| 57b | `/admin/customer/group/edit/id/1/` | ✅ | General | ✅ | 0 | 0 | 0 |
| 58 | `/admin/customer/online/` | ✅ | Customers Now Online | ✅ | 0 | 0 | 0 |
| 59 | `/admin/loginascustomer_log/log/index/` | ✅ | Login as Customer Log | ✅ | 0 | 0 | 0 |
| 74 | `/admin/admin/url_rewrite/index/` | ✅ | URL Rewrites | ✅ | 0 | 0 | 0 |
| 101 | `/admin/cms/page/` | ✅ | Pages | ✅ | 0 | 0 | 0 |
| 101b | `/admin/cms/page/index/` | ✅ | Pages | ✅ | 0 | 0 | 0 |
| 101c | `/admin/cms/page/index/?search=Home` | ✅ | Pages | ✅ | 0 | 0 | 0 |
| 102 | `/admin/cms/page/edit/page_id/1/` | ✅ | 404 Not Found | ✅ | 0 | 0 | 0 |
| 102b | `/admin/cms/page/edit/page_id/5/` | ✅ | About us | ✅ | 0 | 0 | 0 |
| 103 | `/admin/cms/page/new/` | ✅ | New Page | ✅ | 0 | 0 | 0 |
| 104 | `/admin/cms/block/` | ✅ | Blocks | ✅ | 0 | 0 | 0 |
| 105 | `/admin/admin/widget_instance/` | ✅ | Widgets | ✅ | 0 | 0 | 0 |
| 106 | `/admin/media_gallery/media/index/` | ✅ | Manage Gallery | ✅ | 0 | 0 | 0 |
| 107 | `/admin/theme/design_config/` | ✅ | Design Configuration | ✅ | 0 | 0 | 0 |
| 108 | `/admin/admin/system_design_theme/` | ✅ | Themes | ✅ | 0 | 0 | 0 |
| 109 | `/admin/admin/system_design_theme/edit/id/1/` | ✅ | Theme: Magento Blank | ✅ | 0 | 0 | 0 |
| 109b | `/admin/admin/system_design_theme/edit/id/3/` | ✅ | Theme: Magento Luma | ✅ | 0 | 0 | 0 |
| 110 | `/admin/admin/system_design/` | ✅ | Store Design Schedule | ✅ | 0 | 0 | 0 |
| 111 | `/admin/pagebuilder/template/` | ✅ | Templates | ✅ | 0 | 0 | 0 |
| 112 | `/admin/admin/system_store/` | ✅ | Stores | ✅ | 0 | 0 | 0 |
| 113 | `/admin/admin/system_config/` | ✅ | Configuration | ✅ | 0 | 0 | 0 |
| 114 | `/admin/admin/system_config/edit/section/general/` | ✅ | Configuration | ✅ | 0 | 0 | 0 |
| 114b | `/admin/admin/system_config/edit/section/currency/` | ✅ | Configuration | ✅ | 0 | 0 | 0 |
| 114c | `/admin/admin/system_config/edit/section/catalog/` | ✅ | Configuration | ✅ | 0 | 0 | 0 |
| 114d | `/admin/admin/system_config/edit/section/sales/` | ✅ | Configuration | ✅ | 0 | 0 | 0 |
| 114e | `/admin/admin/system_config/edit/section/admin/` | ✅ | Configuration | ✅ | 0 | 0 | 0 |
| 114f | `/admin/admin/system_config/edit/section/design/` | ✅ | Configuration | ✅ | 0 | 0 | 0 |
| 115 | `/admin/admin/system_currency/` | ✅ | Currency Rates | ✅ | 0 | 0 | 0 |
| 116 | `/admin/admin/system_currencysymbol/` | ✅ | Currency Symbols | ✅ | 0 | 0 | 0 |
| 117 | `/admin/tax/rate/` | ✅ | Tax Zones and Rates | ✅ | 0 | 0 | 0 |
| 118 | `/admin/tax/rule/` | ✅ | Tax Rules | ✅ | 0 | 0 | 0 |
| 119 | `/admin/tax/rate/importExport/` | ✅ | Import and Export Tax Rates | ✅ | 0 | 0 | 0 |
| 120 | `/admin/admin/user/` | ✅ | Users | ✅ | 0 | 0 | 0 |
| 121 | `/admin/admin/user_role/` | ✅ | Roles | ✅ | 0 | 0 | 0 |
| 122 | `/admin/admin/system_variable/` | ✅ | Custom Variables | ✅ | 0 | 0 | 0 |
| 123 | `/admin/admin/cache/` | ✅ | Cache Management | ✅ | 0 | 0 | 0 |
| 124 | `/admin/indexer/indexer/list/` | ✅ | Index Management | ✅ | 0 | 0 | 0 |
| 125 | `/admin/admin/import/` | ✅ | Import | ✅ | 0 | 0 | 0 |
| 125b | `/admin/admin/export/` | ✅ | Export | ✅ | 0 | 0 | 0 |
| 126 | `/admin/admin/history/` | ✅ | Import History | ✅ | 0 | 0 | 0 |
| 127 | `/admin/admin/integration/` | ✅ | Integrations | ✅ | 0 | 0 | 0 |
| 128 | `/admin/bulk/index/` | ✅ | Bulk Actions Log | ✅ | 0 | 0 | 0 |
| 129 | `/admin/admin/sitemap/` | ✅ | Site Map | ✅ | 0 | 0 | 0 |
| 130 | `/admin/admin/email_template/` | ✅ | Email Templates | ✅ | 0 | 0 | 0 |
| 131 | `/admin/security/session/activity/` | ✅ | Account Activity | ✅ | 0 | 0 | 0 |
| 132 | `/admin/admin/locks/` | ✅ | Locked Users | ✅ | 0 | 0 | 0 |
| 133 | `/admin/admin/crypt_key/` | ✅ | Encryption Key | ✅ | 0 | 0 | 0 |
---

## Task 2 — Grid + functional regression

**NOT RUN — round 12 was halted by the operator before this section was measured.** Treat as NOT VERIFIED, not as passing. See `TEST.md` §6.

## Task 3 — Regression

**NOT RUN — round 12 was halted by the operator before this section was measured.** Treat as NOT VERIFIED, not as passing. See `TEST.md` §6.

## Task 4 — False-success hunt

**NOT RUN — round 12 was halted by the operator before this section was measured.** Treat as NOT VERIFIED, not as passing. See `TEST.md` §6.
