# shopping_admin — Route Parity Map

> Source: `http://localhost:7780/admin` · image `shopping_admin_final_0719` · container `shopping_admin`
> Discovered by: plan agent, 2026-08-05, from (a) the rendered admin menu in
> `assets/html/dashboard.html`, (b) 93 captured pages in `assets/html/`, and
> (c) every URL referenced by the 184 tasks in `assets/TASKS.md`.

**Mock route = source path verbatim, plus `?sid=` as an additive query param.**
Trailing slash is optional everywhere (the source accepts both). A `/key/<hash>/`
suffix must be accepted and ignored if present, though this deployment never
emits one (see `SOURCE.md` §2).

Priority rule: **P0** = required by at least one `assets/TASKS.md` task, or the
app cannot route without it. **P1** = reachable from the menu and part of a
plausible admin workflow. **P2** = menu-reachable depth / config surface.

Status legend: `[ ]` not implemented · `[~]` partial · `[x]` done.

---

## 1. Dashboard & shell

| # | Source path | Method | Renders | Data source | Tasks | Pri | Status |
|---|---|---|---|---|---|---|---|
| 1 | `/admin` | GET | Redirect → `/admin/admin/dashboard/` (source 302s via login; **mock goes straight to the dashboard, already logged in**) | — | entry | P0 | [x] |
| 2 | `/admin/admin/` | GET | Same redirect target as #1 | — | entry | P0 | [x] |
| 3 | `/admin/admin/dashboard/` | GET | Dashboard: Advanced Reporting banner, Lifetime Sales / Average Order / Last Orders / Last Search Terms / Top Search Terms tiles, Bestsellers–Most Viewed–New–Customers tabbed grid, Revenue/Tax/Shipping/Quantity chart | `orders.json`, `products.json`, `customers.json`, `searchTerms.json` | — | P0 | [x] |
| 4 | `/admin/admin/dashboard/productsViewed/` | GET | AJAX partial: "Most Viewed Products" tab body | `products.json` | — | P1 | [x] |
| 5 | `/admin/admin/dashboard/customersMost/` | GET | AJAX partial: "Customers" tab body (most orders) | `customers.json` | — | P1 | [x] |
| 6 | `/admin/admin/dashboard/customersNewest/` | GET | AJAX partial: "New Customers" tab body | `customers.json` | — | P1 | [x] |
| 7 | `/admin/admin/notification/` (alias `/admin/admin/notification/index/`) | GET | Notifications grid | static | — | P2 | [x] |
| 8 | `/admin/admin/system_account/index/` | GET | "My Account" form for user `admin` | static | — | P2 | [x] |
| 9 | `/admin/admin/auth/logout/` | GET | **Not migrated** — mock is permanently logged in | — | — | — | n/a |

## 2. Sales

| # | Source path | Method | Renders | Data source | Tasks | Pri | Status |
|---|---|---|---|---|---|---|---|
| 10 | `/admin/sales/order/` (alias `/admin/sales/order/index/`) | GET | **Orders grid** — UI-component grid, 308 rows. Columns: ID, Purchase Point, Purchase Date, Bill-to Name, Ship-to Name, Grand Total (Base), Grand Total (Purchased), Status, Action(View). Search, Filters, Default View, Columns, Export, "N records found", per-page 20/30/50/100/200, pager, mass Actions (Cancel, Hold, Unhold, Print Invoices/Packing Slips/Credit Memos/Shipping Labels) | `orders.json` | 193–204, 288–292, 128–131, 676–680 | P0 | [x] |
| 11 | `/admin/sales/order/view/order_id/:id/` | GET | **Order view.** Left nav: Information / Invoices / Credit Memos / Shipments / Comments History (the live source has **no** Transactions item). Header `#order_status`, order # `000000NNN`, Account Information, Address Information (Billing + Shipping, each with an "Edit" link), Payment & Shipping Method, Items Ordered table, Order Total + `#order_history_block` comment form. Buttons `#order_edit`, `#order_reorder`, `#order_invoice`, `#order_ship`, `#order-view-cancel-button`, `#order-view-hold-button`, Send Email, `#guest_to_customer` ("Login as Customer"), Back | `orders.json` | 470–474, 491–495, 538–542 | P0 | [x] |
| 12 | `/admin/sales/order/view/order_id/:id/#order_history` etc. | GET | Same page, left-nav tab anchors | `orders.json` | — | P1 | [x] |
| 13 | `/admin/sales/order/commentsHistory/order_id/:id/` | GET | Comments-history tab body — `.note-list` of `{timestamp, status, comment, notified}` | `orders.json` | 496–500 | P0 | [x] |
| 14 | `/admin/sales/order/commentsHistory/order_id/:id/active_tab/order_shipments/` | GET | Same body, shipments tab preselected — this exact URL is the evaluator target for the tracking-number tasks | `orders.json` | 496–500 | P0 | [x] |
| 15 | `/admin/sales/order/address/address_id/:addressId/` | GET/POST | **Edit Order Address** form: Name Prefix, First/Middle/Last Name, Suffix, Company, Street Address 1–2, City, Country, State/Province, Zip, VAT, Phone, Fax. Save → back to the order view with a success message | `orders.json` (`billing_address_id` / `shipping_address_id`) | 538–542 | P0 | [x] |
| 16 | `/admin/sales/order/addComment/order_id/:id/` | POST | Adds a history comment `{status, comment, is_customer_notified, is_visible_on_front}`; prepends to `#order_history_block .note-list` | `orders.json` | 491–495 | P0 | [x] |
| 17 | `/admin/sales/order/cancel/order_id/:id/` | POST | Sets status → `Canceled`, appends a history entry, redirects to the order view with "You canceled the order." | `orders.json` | 470–474 | P0 | [x] |
| 18 | `/admin/sales/order/hold/order_id/:id/` | POST | Status → `On Hold` | `orders.json` | 680 (filter value) | P1 | [x] |
| 19 | `/admin/sales/order/unhold/order_id/:id/` | POST | Status → previous state | `orders.json` | — | P1 | [x] |
| 20 | `/admin/sales/order/email/order_id/:id/` | POST | "You sent the order email." message only. (An earlier revision of this row said `emailOrder`; the live source's `#send_notification` button uses `/email/` — the mock routes both.) | — | — | P2 | [x] |
| 21 | `/admin/sales/order_invoice/start/order_id/:id/` | GET | Redirect → new-invoice form | — | — | P1 | [x] |
| 22 | `/admin/sales/order_invoice/new/order_id/:id/` | GET | **New Invoice** form: order summary, Items to Invoice with Qty inputs, Update Qty's, Invoice Totals, Append Comments, Email Copy of Invoice, "Submit Invoice" | `orders.json` | — | P1 | [x] |
| 23 | `/admin/sales/order_invoice/save/order_id/:id/` | POST | Creates an invoice, order → `Processing`/`Complete` | `orders.json`, `invoices.json` | — | P1 | [x] |
| 24 | `/admin/admin/order_shipment/start/order_id/:id/` | GET | Redirect → new-shipment form (note the doubled `admin/admin`; this is the URL the `#order_ship` button uses) | — | 496–500 | P0 | [x] |
| 25 | `/admin/admin/order_shipment/new/order_id/:id/` | GET | **New Shipment** form: order summary, **Shipping Information** panel with "Add Tracking Number" → rows of `Carrier` (Custom Value / DHL / Federal Express / United Parcel Service / United States Postal Service) + `Title` + `Number`, Items to Ship, Append Comments, "Submit Shipment" | `orders.json` | 496–500 | P0 | [x] |
| 26 | `/admin/admin/order_shipment/save/order_id/:id/` | POST | Creates a shipment; appends the comment **`Tracking number <N> for <Carrier label> assigned`** to the order's comment history (exact string asserted by tasks 496–500) | `orders.json`, `shipments.json` | 496–500 | P0 | [x] |
| 27 | `/admin/sales/order_creditmemo/start\|new/order_id/:id/` (± `/invoice_id/:invoiceId/`) | GET | **404 on the source for every order** (`order_id` 1/2/3/4/5/299 all tested) — banner `We can't create credit memo for the order.` over `404 Error` / `Page not found.`. `canCreditmemo()` needs `total_paid > total_refunded`, which no seeded order satisfies. `start/` 302s to `new/`. Mock reproduces the 404 + banner (DIFF-204) | `orders.json` | — | P2 | [x] |
| 27 | `/admin/sales/order_creditmemo/start\|new/creditmemo_id/:creditmemoId/` | GET | The **only** 200 on this controller: `New Memo` refund form for an existing memo. `h1` = `New Memo`, page actions `Back` · `Reset`, items table has `Return to Stock` + Ordered/Invoiced/Shipped/Refunded qty sub-table, `Refund Offline` at the foot of Refund Totals. Unknown id → 404 + `This creditmemo no longer exists.` | `creditMemos.json`, `orders.json` | `creditMemos`, `orderComments` | P2 | [x] |
| 28 | `/admin/sales/order_create/reorder/order_id/:id/` · `/admin/sales/order_edit/start/order_id/:id/` | GET | Create-new-order flow prefilled from an existing order. **Screen renders with the real item/address/account data; placing the order is not wired** — needs a `newOrders` collection in state (see TODO) | `orders.json` | — | P2 | [~] |
| 29 | `/admin/sales/order_create/start/customer_id/:id/` | GET | Create New Order wizard, prefilled from the customer. Same placement limit as #28 | `customers.json` | — | P2 | [~] |
| 30 | `/admin/sales/invoice/` | GET | **Invoices grid** — 2 rows. Columns: Invoice, Invoice Date, Order #, Order Date, Bill-to Name, Status, Grand Total (Base), Grand Total (Purchased), Action | `invoices.json` | 94, 95 | P0 | [x] |
| 31 | `/admin/sales/invoice/view/invoice_id/:id/` | GET | Invoice view: `#000000001`, order/account/address/payment blocks, buttons `Back` · `Login as Customer` · `Send Email` · `Print`, Items Invoiced (incl. Discount Amount), Invoice Totals (Grand Total `36.39` / `39.64`), `Invoice History` comment form | `invoices.json` | 94, 95 | P0 | [x] |
| 31 | `/admin/sales/order_invoice/email/order_id/:id/invoice_id/:invoiceId/` | GET | `Send Email` target — "You sent the message.", sets `email_sent`, then redirects to **`/admin/sales/invoice/view/order_id/:id/invoice_id/:invoiceId/`** (the source's own target, verified; that alias is also routed) | — | `invoices` | P2 | [x] |
| 32 | `/admin/sales/shipment/` | GET | **Shipments grid** — 3 rows. Columns: Shipment, Ship Date, Order #, Order Date, Ship-to Name, Total Quantity, Action | `shipments.json` | — | P1 | [x] |
| 33 | `/admin/sales/shipment/view/shipment_id/:id/` | GET | Shipment view: buttons `Back` · `Login as Customer` · `Print` · `Send Tracking Information`; Shipping and Tracking Information is editable (with `Total Shipping Charges`), `Inventory` (Source: Default Source), `Items Shipped`, `Order Total` → `Shipment History` comment form (Add Tracking Number / Delete, writes `shipmentTracks` + the `Tracking number <N> for <Carrier> assigned` order comment) | `shipments.json` | — | P1 | [x] |
| 33 | `/admin/admin/order_shipment/email/shipment_id/:shipmentId/` | GET | `Send Tracking Information` target — "You sent the shipment.", sets `email_sent`, then redirects to **`/admin/admin/order_shipment/view/shipment_id/:id/`** (the source's own target, verified; that alias is also routed) | — | `shipments` | P2 | [x] |
| 34 | `/admin/sales/creditmemo/` | GET | **Credit Memos grid** — 1 row. Columns: Credit Memo, Created, Order #, Order Date, Bill-to Name, Status, Refunded, Action | `creditMemos.json` | — | P1 | [x] |
| 35 | `/admin/sales/creditmemo/view/creditmemo_id/:id/` | GET | Credit memo view: page title is the literal `View Memo`; buttons `Back` · `Login as Customer` · `Send Email` · `Print`; `Memo Total` → `Credit Memo History` comment form; Credit Memo Totals | `creditMemos.json` | — | P2 | [x] |
| 35 | `/admin/sales/order_creditmemo/email/creditmemo_id/:creditmemoId/order_id/:id/` | GET | `Send Email` target — "You sent the message.", sets `email_sent`, then redirects to **`/admin/sales/order_creditmemo/view/creditmemo_id/:id/`** (the source's own target, verified; that alias and its `/order_id/:orderId/` form are also routed) | — | `creditMemos` | P2 | [x] |
| 36 | `/admin/sales/transactions/` | GET | Transactions grid (empty — "We couldn't find any records.") | — | — | P2 | [x] |
| 37 | `/admin/paypal/billing_agreement/` | GET | Billing Agreements grid (empty) | — | — | P2 | [x] |
| 38 | `/admin/sales/order_status/` | GET | Order Status list (legacy grid). Columns: Status · Status Code · Default Status · Visible On Storefront · State Code and Title · Action; "Create New Status" + "Assign Status to State" buttons. Per-row `Unassign` clears the state through `orderStatuses` | `orderStatuses.json` | — | P2 | [x] |
| 38 | `/admin/sales/order_status/new/` | GET | **Create New Order Status** — `Order Status Information` (Status Code, Status Label) + `Store View Specific Labels`; `Save Status` appends to `orderStatuses` ("You saved the order status.") | `orderStatuses.json` | — | P2 | [x] |
| 38 | `/admin/sales/order_status/assign/` | GET | **Assign Order Status to State** — `Assignment Information` (Order Status, Order State, Use Order Status As Default, Visible On Storefront); `Save Status Assignment` writes the state onto the status ("You assigned the order status.") | `orderStatuses.json` | — | P2 | [x] |
| 38 | `/admin/sales/order_status/edit/status/:status/` | GET | **Edit Order Status** (HANDLERS-034) — `Order Status Information` (Status Label only; the source renders no Status Code input here) + `Store View Specific Labels`; toolbar `Back · Reset · Save Status`; `Save Status` patches `orderStatuses` ("You saved the order status.") | `orderStatuses.json` | — | P1 | [x] |

## 3. Catalog

| # | Source path | Method | Renders | Data source | Tasks | Pri | Status |
|---|---|---|---|---|---|---|---|
| 39 | `/admin/catalog/product/` (alias `/admin/catalog/product/index/`) | GET | **Products grid** — UI-component grid, 2040 rows. Columns: checkbox, ID, Thumbnail, Name, Type, Attribute Set, SKU, Price, Quantity, Salable Quantity, Visibility, Status, Websites, Last Updated At, Action(Edit). Search/Filters/Columns/Export/per-page/pager, mass Actions (Delete, Change status, Update attributes), split **Add Product** button with type dropdown | `products.json` | 694–698, 501–505, 777–782, 423, 453–457 | P0 | [x] |
| 40 | `/admin/catalog/product/edit/id/:id/` | GET | **Product edit form.** Inputs must carry the real Magento names: `product[name]`, `product[sku]`, `product[price]`, `product[status]` (switcher whose `value` reads 1=Enable / 2=Disable), `product[quantity_and_stock_status][qty]`, `product[quantity_and_stock_status][is_in_stock]` (1/0), `product[weight]`, `product[attribute_set_id]`, `product[visibility]`, `product[categories]`, `product[country_of_manufacture]`, plus attribute selects `product[color]`, `product[size]`, `product[material]` and the boolean switchers `product[sale]` / `product[new]` (`input[type=checkbox]` with `value` 1/0, like the source — not selects). Collapsible sections: Content, Configurations, Product Reviews, Images and Videos, Search Engine Optimization, Related Products/Up-Sells/Cross-Sells, Customizable Options, Product in Websites, Design, Schedule Design Update, Gift Options | `products.json`, `productDescriptions.json`, `attributeOptions.json` | 423, 453–463, 501–505, 547–551, 768–770, 777–782 | P0 | [x] |
| 41 | `/admin/catalog/product/edit/id/:id/` (configurable) | GET | Same page + `[data-index="configurable"]` Configurations grid whose outerText lists variant names (`Phoebe Zipper Sweatshirt-S-Brown`), with "Add Products Manually" and the four-step "Create Product Configurations" wizard (Select Attributes / Attribute Values / Bulk Images, Price and Quantity / Summary / Generate Products) | `products.json` | 547–551 | P0 | [x] |
| 42 | `/admin/catalog/product/save/id/:id/` | POST | Persists the edit; redirects to the grid (or stays, per Save arrow) with "You saved the product." | `products.json` | all product tasks | P0 | [x] |
| 43 | `/admin/catalog/product/new/set/:setId/type/:type/` | GET | **New Product** form (`set/4/type/simple` is the default; task 694 uses Top=9, 695/696 Bottom=10, 697/698 Gear=11). Same field names as #40 | `attributeSets.json`, `attributeOptions.json` | 694–698 | P0 | [x] |
| 44 | `/admin/catalog/category/` | GET | **Categories** page: jsTree category tree (Default Category ID 2 root, 40 nodes) + category edit form to the right | `categories.json` | — | P1 | [x] |
| 45 | `/admin/catalog/category/edit/id/:id/` | GET | Category edit (e.g. `id/3` = "Gear (ID: 3)"): Enable Category, Include in Menu, Category Name, Content, Display Settings, Search Engine Optimization, **Products in Category** grid, Design | `categories.json`, `products.json` | — | P1 | [x] |
| 46 | `/admin/catalog/product_attribute/` | GET | Product Attributes grid (legacy): Attribute Code, Default Label, Required, System, Visible, Scope, Searchable, Use in Layered Navigation, Comparable. 9 columns, no Action column, rows clickable; `66 records found` (`catalog_eav_attribute.is_visible=1`) | `productAttributes.json` | — | P2 | [x] |
| 46a | `/admin/catalog/product_attribute/new/` | GET | New Product Attribute — tabs Properties / Manage Labels / Storefront Properties; `Back · Reset · Save and Continue Edit · Save Attribute` | `newProductAttributes` | — | P1 | [x] |
| 47 | `/admin/catalog/product_attribute/edit/attribute_id/:id/` | GET | Attribute edit incl. Manage Options (values like Blue=50, S=167) | `attributeOptions.json` | 694–698 (option ids) | P2 | [x] |
| 48 | `/admin/catalog/product_set/` | GET | Attribute Sets grid — 8 rows (Default, Top, Bottom, Gear, Sprite Stasis Ball, Sprite Yoga Strap, Downloadable, Bag) | `attributeSets.json` | 694–698 | P1 | [x] |
| 48a | `/admin/catalog/product_set/add/` | GET | New Attribute Set — `Name` + `Based On`, `Save · Back` | `newAttributeSets` | — | P1 | [x] |
| 49 | `/admin/catalog/product_set/edit/id/:id/` | GET | Attribute-set tree editor | `attributeSets.json` | — | P2 | [x] |
| 50 | `/admin/inventory/source/index/` | GET | Manage Sources grid (Default Source) | static | — | P2 | [x] |
| 51 | `/admin/inventory/stock/index/` | GET | Manage Stock grid (Default Stock) | static | — | P2 | [x] |

## 4. Customers

| # | Source path | Method | Renders | Data source | Tasks | Pri | Status |
|---|---|---|---|---|---|---|---|
| 52 | `/admin/customer/index/` (alias `/admin/customer/index/index/`) | GET | **Customers grid ("All Customers")** — 70 rows. Columns: checkbox, Name, Email, Group, Phone, ZIP, Country, State/Province, Customer Since, Web Site, Confirmed email, Account Created in, Billing Address, Shipping Address, Date of Birth, Tax VAT Number, Gender, Action(Edit). Search/Filters/Columns/Export, mass Actions (Delete, Subscribe/Unsubscribe to Newsletter, Assign a Customer Group, Edit) | `customers.json` | 157, 208–212, 62–65, 759–760 | P0 | [x] |
| 53 | `/admin/customer/index/edit/id/:id/` · `/admin/customer/index/edit/id/:id/active_tab/:tab/` · `/admin/customer/index/orders/id/:id/` · `/admin/customer/index/cart/id/:id/` · `/admin/customer/index/wishlist/id/:id/` · `/admin/review/customer/productReviews/id/:id/` | GET | **Customer edit.** Left nav: Customer View, Account Information, Addresses, Orders, Shopping cart, Newsletter, Billing Agreements, Product Reviews, Wish List. Customer View shows Personal Information (Last Logged In, Account Lock, Confirmed email, Account Created, …), Default Billing Address | `customers.json`, `orders.json` | 208–212, 759–760 | P0 | [x] |
| 54 | `/admin/customer/index/new/` | GET | New Customer form (Account Information, Addresses) | — | — | P1 | [x] |
| 55 | `/admin/customer/index/save/` | POST | Persists customer create/edit | `customers.json` | — | P1 | [x] |
| 56 | `/admin/customer/group/` | GET | Customer Groups grid — 4 rows (NOT LOGGED IN 0, General 1, Wholesale 2, Retailer 3) | `customerGroups.json` | 699–703 (`customer_group_ids: [1]` = General) | P1 | [x] |
| 57 | `/admin/customer/group/new/` · `/edit/id/:id/` | GET | Customer group form | `customerGroups.json` | — | P2 | [x] |
| 58 | `/admin/customer/online/` | GET | "Customers Now Online" grid (Last Activity, First/Last Name, Email, Last URL, Type) | — | — | P2 | [x] |
| 59 | `/admin/loginascustomer_log/log/index/` | GET | Login as Customer Log grid (empty) | — | — | P2 | [x] |

## 5. Marketing

| # | Source path | Method | Renders | Data source | Tasks | Pri | Status |
|---|---|---|---|---|---|---|---|
| 60 | `/admin/sales_rule/promo_quote/` | GET | **Cart Price Rules** grid: ID, Rule, Coupon Code, Start, End, Status, Web Site | `cartPriceRules.json` | 699–703 | P0 | [x] |
| 61 | `/admin/sales_rule/promo_quote/new/` | GET | **New Cart Price Rule** form. Rule Information: `Rule Name`, Description, Active toggle, **Websites** multiselect, **Customer Groups** multiselect (NOT LOGGED IN / General / Wholesale / Retailer), Coupon (No Coupon / Specific Coupon), Uses per Customer, From/To, Priority. Then Conditions, **Actions** (Apply: *Percent of product price discount* → `by_percent`, *Fixed amount discount* → `by_fixed`, *Fixed amount discount for whole cart* → `cart_fixed`, *Buy X get Y free* → `buy_x_get_y`; Discount Amount; Maximum Qty Discount is Applied To; Discard subsequent rules; Apply to Shipping Amount; Free Shipping), Labels, Related Banners | `customerGroups.json` | 699–703 | P0 | [x] |
| 62 | `/admin/sales_rule/promo_quote/edit/id/:id/` | GET | Same form, populated | `cartPriceRules.json` | 699–703 | P0 | [x] |
| 63 | `/admin/sales_rule/promo_quote/save/` | POST | Persists the rule. **State must expose `name`, `customer_group_ids`, `simple_action`, `discount_amount`** with those exact keys (evaluator `func:shopping_admin_get_cart_price_rule`) | `cartPriceRules.json` | 699–703 | P0 | [x] |
| 64 | `/admin/catalog_rule/promo_catalog/` | GET | Catalog Price Rule grid + "Add New Rule". **Not empty — 2 seeded rules** (`1 20% off all Women's and Men's Pants`, `2 Spring sale`), "2 records found" | `catalogPriceRules.json` | — | P2 | [x] |
| 65 | `/admin/review/product/index/` (also `/customerId/:id/` and `/productId/:id/`, both of which pre-filter the grid) | GET | **Reviews grid** (legacy grid, 351 rows). Columns: checkbox, ID, Created, Status (Approved/Pending/Not Approved), Title, Nickname, Review, Visibility, Type, Product, SKU, Action(Edit). Inline filter row (`[name="review_id"|"created_at[from]"|"status"|"title"|"nickname"|"detail"|"visible_in"|"type"|"name"|"sku"]`) + Reset Filter/Search; mass Actions Update Status / Delete. Grid state rides as `/key/value/` path pairs (`sort`,`dir`,`page`,`limit`,`filter/<base64>`) | `reviews.json` | 11–15, 77–79, 112–123, 213–217, 243–247, 344–348, 771–776, 790 | P0 | [x] |
| 66 | `/admin/review/product/pending/` | GET | Same grid pre-filtered to Pending — 5 rows | `reviews.json` | 77, 772–774 | P0 | [x] |
| 67 | `/admin/review/product/edit/id/:id/` · `/admin/review/product/edit/id/:id/ret/:ret/` (`ret=pending` sends Back/Save to the Pending grid) | GET | **Edit Review**: Product name/SKU, Posted By, Summary Rating, Detailed Rating (`Rating` radio matrix), `status_id` select (1 Approved / 2 Pending / 3 Not Approved), Nickname, Summary of Review, Review. **A deleted review's page must render the string `Rating isn't Available`** (asserted by tasks 772–776) | `reviews.json` | 771–776 | P0 | [x] |
| 68 | `/admin/review/product/save/` · `/admin/review/product/save/id/:id/` · `/admin/review/product/delete/id/:id/` · `/admin/review/product/massUpdateStatus/ret/:ret/` · `/admin/review/product/massDelete/ret/:ret/` | POST | Persist status change / delete | `reviews.json` | 771–776 | P0 | [x] |
| 69 | `/admin/review/rating/` | GET | Ratings grid. Columns: ID · Rating · Sort Order · Is Active (the seeded rows are Quality, Value, Price, Rating) | static | — | P2 | [x] |
| 70 | `/admin/search/term/` (alias `/admin/search/term/index/`) | GET | **Search Terms** grid: checkbox, Search Query, Store, Results, Uses, Redirect URL, Suggested Terms, Action(Edit); mass Action Delete; Add New Search Term. (No ID column — the report grid at row 72 is the one with ID/Hits; `assets/html/search-term.html` is ground truth.) | `searchTerms.json` | 127 | P0 | [x] |
| 71 | `/admin/search/term/edit/id/:id/` | GET | Edit Search Term. **`h1` is the search term itself** (`Joust Bag` for id 1), not "Edit Search Term". Fields `query_id` (hidden) · Search Query · Store · **Number of results** (`num_results`) · **Number of Uses** (`popularity`) · Redirect URL · Display in Suggested Terms; buttons `Back · Reset · Delete Search · Save Search`. There is no "Synonym For" field on the source (DIFF-R29) | `searchTerms.json` | — | P1 | [x] |
| 72 | `/admin/search/term/report/` | GET | **Search Terms Report** — legacy grid, columns `ID · Search Query · Store · Results · Hits`, default sort **ID desc** (verified live — no sort arrow on Hits). Default order: `tanks`, `nike`, `Antonia Racer Tank`, `hollister`, `WP10`, `MT02-M-Gray`, `Joust Bag`; tasks 41–43 require clicking **Hits** to rank | `searchTerms.json` | 41–43, 127 | P0 | [x] |
| 73 | `/admin/search/synonyms/index/` | GET | Search Synonyms grid (empty) | — | — | P2 | [x] |
| 74 | `/admin/admin/url_rewrite/index/` | GET | URL Rewrites grid — **225 records, 12 pages at 20/page**, default sort **ID desc**. Columns `☐ Options · ID · Store View · Request Path · Target Path · Redirect Type · Action` (a `Select` link per row). No Description column and **no Export** on the source; mass action `Delete` (DIFF-R25) | `urlRewrites.json` | — | P2 | [x] |
| 75 | `/admin/newsletter/template/` | GET | Newsletter Templates grid | — | — | P2 | [x] |
| 76 | `/admin/newsletter/queue/` | GET | Newsletter Queue grid | — | — | P2 | [x] |
| 77 | `/admin/newsletter/subscriber/` | GET | Newsletter Subscribers grid — 1 row (`john.smith.xyz@gmail.com`, Customer, Subscribed), "1 records found" | `newsletterSubscribers.json` | — | P2 | [x] |
| 78 | `/admin/newsletter/problem/` | GET | Newsletter Problem Reports grid | — | — | P2 | [x] |
| 79 | `/admin/checkout/agreement/` | GET | Terms and Conditions grid | — | — | P2 | [x] |

## 6. Reports

All Sales/Product reports share a header with **`#sales_report_from`,
`#sales_report_to`** date inputs (M/D/YY format, e.g. `2/1/23`), a **Period**
select (Day / Month / Year), **Show By / Order Status / Empty Rows / Show Actual
Values** controls and a **Show Report** button. Tasks 704–713 assert on those two
input ids, so they must exist with exactly those ids on every report route below.

| # | Source path | Method | Renders | Data source | Tasks | Pri | Status |
|---|---|---|---|---|---|---|---|
| 80 | `/admin/reports/report_sales/sales/` | GET | **Orders Report** — interval rows: Interval, Orders, Sales Items, Sales Total, Invoiced, Refunded, Sales Tax, Shipping, Discounts, Canceled | `orders.json` | 107–111, 704, 705, 707, 709 | P0 | [x] |
| 81 | `/admin/reports/report_sales/tax/` | GET | **Tax Report** | `orders.json` | 708 | P0 | [x] |
| 82 | `/admin/reports/report_sales/invoiced/` | GET | **Invoice Report** | `invoices.json` | — | P1 | [x] |
| 83 | `/admin/reports/report_sales/shipping/` | GET | **Shipping Report** — reads `sales_shipping_aggregated_order` (Date Used = *Order Created*, the default); *First Invoice Created Date* reads `sales_shipping_aggregated`. No canceled-status default here, unlike the Orders Report: 2022 = 215 orders / $3,145.00 / $5.00 | `reportAggregatesOrder.json` | 710 | P0 | [x] |
| 84 | `/admin/reports/report_sales/refunded/` | GET | **Refunds Report** | `creditMemos.json` | 706 | P0 | [x] |
| 85 | `/admin/reports/report_sales/coupons/` | GET | **Coupons Report** | `orders.json` | 712 | P0 | [x] |
| 86 | `/admin/reports/report_sales/bestsellers/` | GET | **Bestsellers Report** — Interval, Product, Price, Order Quantity. Drives "top-N best-selling product in \<period\>" | `orders.json`, `products.json` | 0–6, 713 | P0 | [x] |
| 87 | `/admin/reports/report_product/sold/` | GET | **Ordered Products Report** — Product, Quantity Ordered | `orders.json` | 0–6 (alt route) | P1 | [x] |
| 88 | `/admin/reports/report_product/lowstock/` | GET | **Low Stock Report** — legacy grid, columns in this order: Product, SKU, **Quantity, Source Code** (corrected round 6 against the live source; earlier rounds had Source Code and Quantity transposed), sortable by Quantity. **ARBITRATED — the empty grid is CORRECT.** The live source renders `0 records found` for this route, so the mock's empty grid is parity and the TODO / TASKS 183–187 expectation of populated rows is the stale side. The filter is `quantity > 0 AND quantity < notify_stock_qty` and every product in this deployment sits at `notify_stock_qty = 1`, so nothing can qualify. "Products with N units left" is answered from Catalog > Products, not here. **Do not re-open this: check the live source before proposing rows for this grid.** | `products.json` | 183–187 | P0 | [x] |
| 89 | `/admin/reports/report_product/viewed/` | GET | **Product Views Report** | `products.json` | 711 | P0 | [x] |
| 90 | `/admin/reports/report_product/downloads/` | GET | Downloads Report (empty) | — | — | P2 | [x] |
| 91 | `/admin/reports/report_customer/orders/` | GET | **Order Count Report** — Interval, Customer, Orders, Average, Total. Answers "customer(s) with the most orders" | `customers.json`, `orders.json` | 62–65 | P0 | [x] |
| 92 | `/admin/reports/report_customer/totals/` | GET | **Order Total Report** | `customers.json`, `orders.json` | 62–65 (alt) | P1 | [x] |
| 93 | `/admin/reports/report_customer/accounts/` | GET | **New Accounts Report** | `customers.json` | — | P1 | [x] |
| 94 | `/admin/reports/report_review/customer/` | GET | **Customer Reviews Report** — Customer, Reviews | `reviews.json` | 112–123 (alt) | P1 | [x] |
| 95 | `/admin/reports/report_review/product/` | GET | **Product Reviews Report** — Product, Reviews, Average Rating, Last Review | `reviews.json` | 344–348 (alt) | P1 | [x] |
| 96 | `/admin/reports/report_review/product/detail/id/:productId/` | GET | Per-product review list | `reviews.json` | — | P1 | [x] |
| 97 | `/admin/reports/report_shopcart/product/` | GET | Products in Carts | — | — | P2 | [x] |
| 98 | `/admin/reports/report_shopcart/abandoned/` | GET | Abandoned Carts | — | — | P2 | [x] |
| 99 | `/admin/reports/report_statistics/` | GET | Refresh Statistics grid (report row per statistic, "Refresh Lifetime Statistics" mass action) | static | — | P2 | [x] |
| 100 | `/admin/analytics/reports/show/` | GET | "Advanced Reporting" splash (external product upsell) | static | — | P2 | [x] |

## 7. Content (CMS & design)

| # | Source path | Method | Renders | Data source | Tasks | Pri | Status |
|---|---|---|---|---|---|---|---|
| 101 | `/admin/cms/page/` (alias `/admin/cms/page/index/`) | GET | **CMS Pages grid** — 6 rows: ID, Title, URL Key, Layout, Store View, Status, Created, Modified, Action(Select→Edit/View/Delete) | `cmsPages.json` | 486–490 | P0 | [x] |
| 102 | `/admin/cms/page/edit/page_id/:id/` | GET | **CMS page edit.** `input[name="title"]` is the evaluator target. Sections: Enable Page toggle, Page Title, Content (PageBuilder/editor), Search Engine Optimization (URL Key, Meta Title/Keywords/Description), Page in Websites, Design, Custom Design Update. Page ids: 1 = 404 Not Found, 2 = Home Page, 3 = Enable Cookies, 4 = Privacy Policy, 5 = About us, 6 = Customer Service | `cmsPages.json` | 486–490 | P0 | [x] |
| 103 | `/admin/cms/page/new/` · `/admin/cms/page/save/` | GET/POST | New page form / persist | `cmsPages.json` | 486–490 | P0 | [x] |
| 104 | `/admin/cms/block/` | GET | CMS Blocks grid | `cmsBlocks.json` | — | P2 | [x] |
| 105 | `/admin/admin/widget_instance/` | GET | Widgets grid | — | — | P2 | [x] |
| 106 | `/admin/media_gallery/media/index/` | GET | Manage Gallery (media browser) | — | — | P2 | [x] |
| 107 | `/admin/theme/design_config/` | GET | **Design Configuration** grid — 3 rows, columns Default / Website / Store / Store View / Theme Name / Action; the scope cell reads `Global` and every row shows the inherited `Magento Luma`. Edit is an in-row editor in the mock (the source's `/edit/scope/...` route is not in this table) | `systemConfig.json`, `coreConfig.json` | 374, 375 (nav path) | P1 | [x] |
| 108 | `/admin/admin/system_design_theme/` | GET | **Themes grid** — **2 rows** (verified live: the grid lists `area = frontend` only, so the adminhtml theme id 2 is excluded): Magento Blank, Magento Luma. Columns: **Theme Title, Parent Theme, Theme Path, Action(View)** — there is no ID column | `systemConfig.json` `themes` | 374, 375 | P0 | [x] |
| 109 | `/admin/admin/system_design_theme/edit/id/:id/` | GET | **Theme settings page** — Theme Title, Parent Theme, Theme Path, Theme Version, and a Theme Files left-nav. `id/1` = Magento Blank (task 374), `id/3` = Magento Luma (task 375) | `systemConfig.json` (`themes`) | 374, 375 | P0 | [x] |
| 110 | `/admin/admin/system_design/` | GET | Design Schedule grid | — | — | P2 | [x] |
| 111 | `/admin/pagebuilder/template/` | GET | PageBuilder Templates grid | — | — | P2 | [x] |

## 8. Stores / System

| # | Source path | Method | Renders | Data source | Tasks | Pri | Status |
|---|---|---|---|---|---|---|---|
| 112 | `/admin/admin/system_store/` | GET | All Stores: Web Site / Store / Store View table (Main Website / Main Website Store / Default Store View) | static | — | P1 | [x] |
| 113 | `/admin/admin/system_config/` | GET | Configuration — left section nav (General, Catalog, Security, Customers, Sales, Services, Advanced) + the General section form | static | — | P1 | [x] |
| 114 | `/admin/admin/system_config/edit/section/:section/` | GET | Configuration section form (`general`, `currency`, `catalog`, `sales`, `admin`, `design`, …) | static | — | P1 | [x] |
| 115 | `/admin/admin/system_currency/` | GET | Currency Rates | static | — | P2 | [x] |
| 116 | `/admin/admin/system_currencysymbol/` | GET | Currency Symbols | static | — | P2 | [x] |
| 117 | `/admin/tax/rate/` | GET | Tax Zones and Rates grid | `taxConfig.json` (`rates`) | — | P2 | [x] |
| 118 | `/admin/tax/rule/` | GET | Tax Rules grid | `taxConfig.json` (`rules`, `calculations`) | — | P2 | [x] |
| 119 | `/admin/tax/rate/importExport/` | GET | Import/Export Tax Rates | — | — | P2 | [x] |
| 120 | `/admin/admin/user/` | GET | All Users grid — 1 row (`admin`) | static | — | P2 | [x] |
| 121 | `/admin/admin/user_role/` | GET | User Roles grid — Administrators | static | — | P2 | [x] |
| 122 | `/admin/admin/system_variable/` | GET | Custom Variables grid | — | — | P2 | [x] |
| 123 | `/admin/admin/cache/` | GET | Cache Management grid + Flush Magento Cache buttons | static | — | P2 | [x] |
| 124 | `/admin/indexer/indexer/list/` | GET | Index Management grid | static | — | P2 | [x] |
| 125 | `/admin/admin/import/` · `/admin/admin/export/` | GET | Import / Export forms | — | — | P2 | [x] |
| 126 | `/admin/admin/history/` | GET | Import History grid | — | — | P2 | [x] |
| 127 | `/admin/admin/integration/` | GET | Integrations grid | — | — | P2 | [x] |
| 128 | `/admin/bulk/index/` | GET | Bulk Actions Log | — | — | P2 | [x] |
| 129 | `/admin/admin/sitemap/` | GET | Site Map grid | — | — | P2 | [x] |
| 130 | `/admin/admin/email_template/` | GET | Email Templates grid | — | — | P2 | [x] |
| 131 | `/admin/security/session/activity/` | GET | **Account Activity** (the menu label is "Login Sessions" but the `h1` is `Account Activity`): concurrent-session table (IP Address / Time of session start) + "Log out all other sessions" | `adminUsers.json` | — | P2 | [x] |
| 132 | `/admin/admin/locks/` | GET | Locked Users grid | — | — | P2 | [x] |
| 133 | `/admin/admin/crypt_key/` | GET | Encryption Key form | — | — | P2 | [x] |

## 9. Mock-only

| # | Mock route | Renders |
|---|---|---|
| 134 | `/go` | `{initial_state, current_state, state_diff}` per the hub contract. Served two ways: the `vite.config.js` middleware answers a cold `GET /go?sid=` from `.mock-states/`, and `src/pages/GoPage.jsx` (routed in `src/App.jsx`, outside `AdminLayout`) answers an in-app navigation from the browser's own state — the §5 element both reference mocks carry. |

---

## Query Parameters

### UI-component grids (Orders, Products, Customers, Invoices, Shipments, Credit Memos, CMS Pages, Cart Price Rules)

These keep sort/filter/paging state in a client-side **bookmark**, so the source
usually does **not** reflect it in the URL. The one verified URL param is:

| Route | Param | Values | Effect |
|---|---|---|---|
| `/admin/catalog/product/index/` | `search` | any keyword | Keyword search box prefilled + applied. Emitted by the admin global search box. |
| `/admin/customer/index/index/` | `search` | any keyword | ditto |
| `/admin/sales/order/index/` | `search` | any keyword | ditto |
| `/admin/cms/page/index/` | `search` | any keyword | ditto |

Because tasks 676–680 assert on rendered DOM
(`div.admin__data-grid-filters-current`) rather than on the URL, the mock is free
to **additionally** mirror grid state into the query string. Recommended (and a
strict superset of source behaviour):

| Param | Values | Effect |
|---|---|---|
| `filters[status]` | `pending`, `processing`, `complete`, `closed`, `canceled`, `holded`, `fraud` | Orders grid status filter; must render an "Active filters: Status: \<Label\>" chip |
| `sorting[field]` / `sorting[direction]` | column id / `asc`\|`desc` | Column sort |
| `paging[pageSize]` | `20`,`30`,`50`,`100`,`200` | Rows per page |
| `paging[current]` | 1..N | Page number |

**Default page size is per-listing, not a flat 20.** Magento persists the
per-page selector in each grid's saved `ui_bookmark`, and the bookmarks that
ship in the WebArena image are not uniform. Transcribed from the grid config in
`assets/html/` and corroborated by the reference screenshots:

| Grid | Default | Renders |
|---|---|---|
| `/admin/sales/order/` | **200** | `308 records found` · `1 of 2` |
| `/admin/catalog/product/` | **200** | `2,040 records found` · `1 of 11` |
| `/admin/customer/index/` | **100** | `70 records found` · `1 of 1` |
| every other grid | 20 | |

The table lives in `src/utils/gridUtils.js` (`GRID_PAGE_SIZES`), keyed by
`gridId`, and overrides whatever `defaultPageSize` a page passes.

The **filter chip labels** must be the human labels, not the codes:
`Suspected Fraud`, `Processing`, `Canceled`, `Complete`, `On Hold`, `Pending`,
`Closed` (tasks 676–680 string-match these).

### Legacy grid-state path segments (DIFF-R67)

Magento encodes a grid's whole state as **path segments**:

| Segment | Values | Effect |
|---|---|---|
| `sort/<column>` | e.g. `qty`, `created_at`, `popularity`, `label` | Sort column |
| `dir/<asc\|desc>` | | Sort direction |
| `limit/<n>` | `20`,`30`,`50`,`100`,`200` | Rows per page |
| `page/<n>` | 1..N | Page number |
| `filter/<base64>` | base64 of a urlencoded filter string keyed by the grid's own filter `name` attributes (`cXVlcnlfdGV4dD1uaWtl` → `query_text=nike`) | Column filters |
| `store/<id>` | `null` or a store id | The reports' store-scope filter (just another pair) |
| `customerId/<id>`, `productId/<id>` | | Reviews grid pre-filters |

They may appear in any order and combination.

#### The rule that decides whether the source accepts them

An admin URL is `/admin/<front>/<controller>/<action>/<k>/<v>/…`. The pairs are
only reachable when the **action segment is written out**. Omit it and the first
pair slides into the action slot and Magento 404s. Measured on the live source:

| URL | Source |
|---|---|
| `/admin/sales/order_status/sort/label/dir/desc/` | **404** |
| `/admin/sales/order_status/index/sort/label/dir/desc/` | 200, sort applied |
| `/admin/review/product/sort/created_at/dir/asc/` | **404** |
| `/admin/review/product/index/sort/created_at/dir/asc/` | 200, sort applied |
| `/admin/search/term/sort/query_text/dir/asc/` | **404** |
| `/admin/search/term/index/sort/query_text/dir/asc/` | 200 |
| `/admin/reports/report_statistics/sort/name/dir/desc/` | **404** |
| `/admin/reports/report_product/lowstock/sort/qty/dir/asc/limit/50/` | 200, `limit` applied |

The mock reproduces **both** halves: `src/App.jsx` §11 (`GRID_STATE_PATHS`) hangs
a splat route off the action-qualified path only, so the four rows above still
land on `<NotFound />`.

#### Where the state is applied

| Mock grid component | Pages | Segments applied |
|---|---|---|
| `components/reviews/LegacyReviewGrid.jsx` | Reviews, Pending Reviews | `sort` `dir` `page` `limit` `filter` `customerId` `productId` |
| `components/reports/LegacyGrid.jsx` | Search Terms Report, Low Stock, Abandoned Carts | `sort` `dir` `page` `limit` `filter` |
| `components/grid/AdminGrid.jsx` via `components/grid/legacySegments.js` | every other listing route | `sort` `dir` `page` `limit` `filter` mapped onto the query-param state above; a segment naming a column the grid does not have is dropped, as the source drops it |

**Deliberate superset.** On the grids that are UI-component on *both* sides
(Orders, Products, Customers, Invoices, Shipments, Credit Memos, CMS Pages,
Bulk Actions, Media Gallery) the source returns 200 and *ignores* the segments;
the mock resolves the URL and additionally applies whatever names a real column.
Resolving is the parity that matters — the evaluator checks the URL the agent
ends on — and the extra application is never wrong, only more helpful.

### Report date range

Reports post `report_from` / `report_to` / `period_type` / `show_order_statuses`
and re-render. The inputs are `#sales_report_from` and `#sales_report_to`, format
**`M/D/YY`** (e.g. `2/1/23`, `12/31/22`, `1/29/23`). Preset shortcuts do not
exist in the source — the agent types the dates.

### Order view

| Route | Param | Effect |
|---|---|---|
| `/admin/sales/order/commentsHistory/order_id/:id/` | `active_tab/order_shipments` | Path-segment param selecting the Shipments tab |

---

## Intentionally Not Migrated

| Source path | Reason |
|---|---|
| `/admin/admin/auth/login/`, `/logout/` | Mock boots pre-logged-in as `admin` (migration contract §1) |
| `/admin/admin/crypt_key/`, `/admin/admin/cache/` flush actions | Server-side machinery; render the page, no-op the action |
| `/admin/indexer/indexer/list/` reindex actions | Same |
| `/admin/marketplace/index/`, `/admin/analytics/biessentials/signup/`, `/admin/braintree/*`, `/admin/paypal/paypal_reports/` | External SaaS surfaces; render an empty/upsell page only |
| `/admin/admin/import/` and `/export/` job execution | No server; the forms render, submission is a no-op with a message |
| Storefront URLs (`../antonia-racer-tank.html`, `../bella-tank.html`, …) | Belong to `webarena_shopping_mock`; tasks 464 and 543–546 assert there. This mock only has to persist the description edit. |
| Map routes (tasks 759–760) | Belong to `webarena_map_mock`; only the customer-city lookup is in scope here |

---

## Bare controller paths (round-3 fix, PARITY-019)

Magento's front controller defaults a missing action to `index`, so
`/admin/<front>/<controller>/` is a live 200 URL for every controller — an agent
that generalises from `/admin/sales/order/` will type `/admin/customer/`. These
eleven had only an `/index` row and 404'd. Each now routes to the same component
as its `/index` sibling and carries the same `<title>` menu path.

All eleven verified cold in chromium at 1440×900 as fresh deep links with
`?sid=fix_test` (never reached by clicking): correct `<h1>`, no 404, sid survives,
0 page errors, 0 external requests.

| Source path | Row | Renders (`<h1>`, matches source) | Status |
|---|---|---|---|
| `/admin/customer/` | 52 | Customers | [x] |
| `/admin/review/product/` | 65 | Reviews | [x] |
| `/admin/search/synonyms/` | 73 | Search Synonyms | [x] |
| `/admin/media_gallery/media/` | 106 | Manage Gallery | [x] |
| `/admin/inventory/source/` | 50 | Manage Sources | [x] |
| `/admin/admin/url_rewrite/` | 74 | URL Rewrites | [x] |
| `/admin/admin/system_account/` | 8 | My Account | [x] |
| `/admin/loginascustomer_log/log/` | 59 | Login as Customer Log | [x] |
| `/admin/bulk/` | 128 | Bulk Actions Log | [x] |
| `/admin/marketplace/` | — | Magento Marketplace | [x] |
| `/admin/inventory/stock/` | 51 | Manage Stock | [x] |

Keep the invariant: **every `…/index` row needs a bare sibling.**
`grep -oP "path: '\K[^']+" src/App.jsx` → for each path ending `/index`, the
prefix must also be present.

---

## Secondary create/edit paths (added in the audit-fix round, PARITY-010 / HANDLERS-011)

These are GET-navigable source URLs an agent reaches by clicking a grid's
"Add New …" button or a row link. They used to have no route and landed on the
404 page. All 56 verified resolving in chromium at 1440×900.

**Implemented as real, state-writing forms** — the collection behind each is in
session state, so the save shows up in `/go` `state_diff`:

| Source path | Row | Writes |
|---|---|---|
| `/admin/tax/rate/add/` · `/admin/tax/rate/edit/rate/:id/` | 117 | `taxConfig.rates` |
| `/admin/tax/rule/new/` · `/admin/tax/rule/edit/rule/:id/` | 118 | `taxConfig.rules` |
| `/admin/admin/user/new/` · `/admin/admin/user/edit/user_id/:id/` | 120 | `adminUsers` + the `role_type='U'` membership row in `adminRoles` |
| `/admin/admin/user_role/editrole/` · `/editrole/rid/:id/` | 121 | `adminRoles` (one path serves create and edit — no `rid` means create) |
| `/admin/cms/page/delete/page_id/:id/` | 101 | removes from `cmsPages`, then 302s to the grid |
| `/admin/cms/block/delete/block_id/:id/` | 104 | removes from `cmsBlocks`, then 302s to the grid |

**Resolved to the area's own index page at the source URL** — the editor behind
them is out of scope, so the path answers with the honest listing the agent came
from rather than a 404 or invented content. The URL an evaluator checks is
preserved:

| Source path(s) | Row | Renders |
|---|---|---|
| `/admin/admin/dashboard/index/` | 3 | Dashboard (alias) |
| `/admin/sales/order_create/start/` (no `customer_id`) | 29 | Customers — the source's customer picker step |
| `/admin/catalog/category/add/` · `/delete/id/:id/` | 44, 45 | Categories |
| `/admin/catalog/product_attribute/edit/attribute_id/new/` | 46 | New Product Attribute (agent-guessed alias) |
| `/admin/inventory/source/{new,edit/source_code/:code}/` | 50 | Manage Sources |
| `/admin/inventory/stock/{new,edit/stock_id/:id}/` | 51 | Manage Stock |
| `/admin/customer/group/delete/id/:id/` | 56 | Customer Groups |
| `/admin/catalog_rule/promo_catalog/{new,edit/id/:id}/` | 64 | Catalog Price Rule |
| `/admin/review/product/jsonProductInfo/id/:id/` | 65 | New Review, step two. **This is the source's AJAX endpoint, not a page URL** — clicking a chooser row on the source leaves the browser on `/admin/review/product/new/` (verified live), so the mock's chooser does the same and only renders in place. The path stays routed for an agent that types it. |
| `/admin/review/rating/{new,edit/id/:id}/` | 69 | Ratings |
| `/admin/search/synonyms/new/` | 73 | Search Synonyms |
| `/admin/admin/url_rewrite/edit/` · `/edit/id/:id/` | 74 | URL Rewrites |
| `/admin/newsletter/template/new/` | 75 | Newsletter Templates |
| `/admin/checkout/agreement/new/` | 79 | Terms and Conditions |
| `/admin/reports/report_product/lowstock/store/:store/` | 88 | Low Stock Report |
| `/admin/reports/report_product/downloads/store/:store/` | 90 | Downloads Report |
| `/admin/admin/widget_instance/new/` · `/edit/instance_id/:id/code/:code/` | 105 | Widgets |
| `/admin/theme/design_config/edit/scope/{default,websites/scope_id/:id,stores/scope_id/:id}/` | 107 | Design Configuration (row 107 already declares the in-row editor a deliberate deviation) |
| `/admin/admin/system_design/new/` | 110 | Store Design Schedule |
| `/admin/admin/system_store/{newWebsite,newGroup,newStore,editWebsite/website_id/:id,editGroup/group_id/:id,editStore/store_id/:id}/` | 112 | Stores |
| `/admin/admin/system_variable/new/` | 122 | Custom Variables |
| `/admin/admin/integration/{new,edit/id/:id}/` | 127 | Integrations |
| `/admin/admin/sitemap/new/` | 129 | Site Map |
| `/admin/admin/email_template/new/` | 130 | Email Templates |

---

## Task → Route Coverage Check

Every one of the 184 tasks in `assets/TASKS.md` resolves to at least one row above.

| Task group | Tasks | Route rows |
|---|---|---|
| Bestsellers / product type / brand | 0–6 | 86, 87 |
| Review keyword counts, totals, per-product sentiment | 11–15, 77–79, 112–123, 213–217, 243–247, 344–348, 790 | 65, 66, 67, 94, 95 |
| Search terms | 41–43, 127 | 70, 72 |
| Customer order counts | 62–65 | 91, 92, 10 |
| Invoice grand totals | 94, 95 | 30, 31 |
| Monthly completed-order counts | 107–111 | 80, 10 |
| Items sold in last N orders | 128–131 | 10, 11 |
| Customer list / lookup by phone | 157, 208–212 | 52, 53 |
| Low stock | 183–187 | 88, 39 |
| Order payment totals / dates / statuses | 193–204 | 10, 11 |
| Most-cancellations customer | 288–292 | 10, 11, 53 |
| Theme settings pages | 374, 375 | 108, 109 |
| Product on-sale / disable / price / stock edits | 423, 453–463, 501–505, 768–770, 777–782 | 40, 42 |
| Product description edits | 464, 543–546 | 40, 42 (+ storefront mock) |
| Cancel order | 470–474 | 11, 17 |
| CMS page title edits | 486–490 | 101, 102, 103 |
| Order comment notifications | 491–495 | 11, 13, 16 |
| Shipment tracking numbers | 496–500 | 11, 24, 25, 26, 14 |
| Order billing-address edits | 538–542 | 11, 15 |
| Configurable-product variants | 547–551 | 41, 42 |
| Order grid status filters | 676–680 | 10 (+ filter chip strip) |
| New simple products | 694–698 | 39, 43, 48, 47 |
| Cart price rules | 699–703 | 60, 61, 62, 63, 56 |
| Report date ranges | 704–713 | 80, 81, 83, 84, 85, 86, 89 |
| Customer city → map | 759–760 | 52, 53 (+ map mock) |
| Review approve / delete | 771–776 | 65, 66, 67, 68 |

---

## 12. Grid kind classification (round 10 — whole-app, one pass)

Magento renders some admin listings as **LEGACY** `Widget\Grid` blocks and others
as modern **UI-component** grids, and the mock has to pick the same one per
route. Five previous rounds fixed one directory's worth at a time and the next
sweep found the same defect somewhere nobody had looked, so round 10 enumerated
**every** grid route in this file, classified each against the live source
(`http://localhost:7780/admin`, 2026-08-06) and fixed all mismatches in one pass.

Discriminator, applied identically to both sides in a real browser:

| kind | `<thead>` rows | Search / Reset Filter | records count | notes |
|---|---|---|---|---|
| **LEGACY** | 2 (header + in-table filter row) | yes | `.admin__control-support-text` | `select#<grid>_page-limit`, path-segment URL state |
| **PLAIN** | 1, no filter controls | **no** | `.admin__control-support-text` | still a legacy grid — just no filter row |
| **MODERN** | 1 | no (keyword box + Filters panel) | `.admin__data-grid-records-count` in the mock | |

`PLAIN` is a *legacy* grid whose columns declare no filter: Notifications,
Cache Management, Index Management, Products in Carts and the date-range report
family. Classifying those as MODERN was the same defect wearing a different hat.

**Result: 27 of the 28 mismatches fixed; the 28th is not a defect** —
`/admin/media_gallery/media/index/` is a masonry image gallery, not a table
grid, and the "LEGACY" reading there is the sweep picking up the source's
date-picker calendar `<table>`.

| # | route | source | mock BEFORE | mock AFTER |
|---|---|---|---|---|
| 1 | `/admin/admin/notification/` | PLAIN | MODERN | PLAIN **←fixed** |
| 2 | `/admin/sales/order/` | MODERN | MODERN | MODERN |
| 3 | `/admin/sales/invoice/` | MODERN | MODERN | MODERN |
| 4 | `/admin/sales/shipment/` | MODERN | MODERN | MODERN |
| 5 | `/admin/sales/creditmemo/` | MODERN | MODERN | MODERN |
| 6 | `/admin/sales/transactions/` | LEGACY | MODERN | LEGACY **←fixed** |
| 7 | `/admin/paypal/billing_agreement/` | LEGACY | MODERN | LEGACY **←fixed** |
| 8 | `/admin/sales/order_status/` | LEGACY | MODERN | LEGACY **←fixed** |
| 9 | `/admin/catalog/product/` | MODERN | MODERN | MODERN |
| 10 | `/admin/catalog/category/` | NOGRID | NOGRID | NOGRID |
| 11 | `/admin/catalog/product_attribute/` | LEGACY | MODERN | LEGACY **←fixed** |
| 12 | `/admin/catalog/product_set/` | LEGACY | MODERN | LEGACY **←fixed** |
| 13 | `/admin/inventory/source/index/` | MODERN | MODERN | MODERN |
| 14 | `/admin/inventory/stock/index/` | MODERN | MODERN | MODERN |
| 15 | `/admin/customer/index/` | MODERN | MODERN | MODERN |
| 16 | `/admin/customer/group/` | MODERN | MODERN | MODERN |
| 17 | `/admin/customer/online/` | MODERN | MODERN | MODERN |
| 18 | `/admin/loginascustomer_log/log/index/` | MODERN | MODERN | MODERN |
| 19 | `/admin/sales_rule/promo_quote/` | LEGACY | LEGACY | LEGACY |
| 20 | `/admin/catalog_rule/promo_catalog/` | LEGACY | LEGACY | LEGACY |
| 21 | `/admin/review/product/index/` | LEGACY | LEGACY | LEGACY |
| 22 | `/admin/review/product/pending/` | LEGACY | LEGACY | LEGACY |
| 23 | `/admin/review/rating/` | LEGACY | LEGACY | LEGACY |
| 24 | `/admin/search/term/` | LEGACY | LEGACY | LEGACY |
| 25 | `/admin/search/term/report/` | LEGACY | LEGACY | LEGACY |
| 26 | `/admin/search/synonyms/index/` | MODERN | MODERN | MODERN |
| 27 | `/admin/admin/url_rewrite/index/` | MODERN | MODERN | MODERN |
| 28 | `/admin/newsletter/template/` | LEGACY | MODERN | LEGACY **←fixed** |
| 29 | `/admin/newsletter/queue/` | LEGACY | MODERN | LEGACY **←fixed** |
| 30 | `/admin/newsletter/subscriber/` | LEGACY | MODERN | LEGACY **←fixed** |
| 31 | `/admin/newsletter/problem/` | LEGACY | MODERN | LEGACY **←fixed** |
| 32 | `/admin/checkout/agreement/` | LEGACY | MODERN | LEGACY **←fixed** |
| 33 | `/admin/reports/report_sales/sales/` | PLAIN | PLAIN | PLAIN |
| 34 | `/admin/reports/report_sales/tax/` | PLAIN | PLAIN | PLAIN |
| 35 | `/admin/reports/report_sales/invoiced/` | PLAIN | PLAIN | PLAIN |
| 36 | `/admin/reports/report_sales/shipping/` | PLAIN | PLAIN | PLAIN |
| 37 | `/admin/reports/report_sales/refunded/` | PLAIN | PLAIN | PLAIN |
| 38 | `/admin/reports/report_sales/coupons/` | PLAIN | PLAIN | PLAIN |
| 39 | `/admin/reports/report_sales/bestsellers/` | PLAIN | PLAIN | PLAIN |
| 40 | `/admin/reports/report_product/sold/` | PLAIN | PLAIN | PLAIN |
| 41 | `/admin/reports/report_product/lowstock/` | LEGACY | LEGACY | LEGACY |
| 42 | `/admin/reports/report_product/viewed/` | PLAIN | PLAIN | PLAIN |
| 43 | `/admin/reports/report_product/downloads/` | LEGACY | LEGACY | LEGACY |
| 44 | `/admin/reports/report_customer/orders/` | PLAIN | PLAIN | PLAIN |
| 45 | `/admin/reports/report_customer/totals/` | PLAIN | PLAIN | PLAIN |
| 46 | `/admin/reports/report_customer/accounts/` | PLAIN | PLAIN | PLAIN |
| 47 | `/admin/reports/report_review/customer/` | LEGACY | LEGACY | LEGACY |
| 48 | `/admin/reports/report_review/product/` | LEGACY | LEGACY | LEGACY |
| 49 | `/admin/reports/report_review/product/detail/id/14/` | LEGACY | LEGACY | LEGACY |
| 50 | `/admin/reports/report_shopcart/product/` | PLAIN | MODERN | PLAIN **←fixed** |
| 51 | `/admin/reports/report_shopcart/abandoned/` | LEGACY | LEGACY | LEGACY |
| 52 | `/admin/reports/report_statistics/` | PLAIN | PLAIN | PLAIN |
| 53 | `/admin/cms/page/` | MODERN | MODERN | MODERN |
| 54 | `/admin/cms/block/` | MODERN | MODERN | MODERN |
| 55 | `/admin/admin/widget_instance/` | LEGACY | MODERN | LEGACY **←fixed** |
| 56 | `/admin/media_gallery/media/index/` | LEGACY | NOGRID | NOGRID |
| 57 | `/admin/theme/design_config/` | MODERN | MODERN | MODERN |
| 58 | `/admin/admin/system_design_theme/` | MODERN | MODERN | MODERN |
| 59 | `/admin/admin/system_design/` | LEGACY | MODERN | LEGACY **←fixed** |
| 60 | `/admin/pagebuilder/template/` | MODERN | MODERN | MODERN |
| 61 | `/admin/admin/system_store/` | LEGACY | MODERN | LEGACY **←fixed** |
| 62 | `/admin/admin/system_currency/` | PLAIN | PLAIN | PLAIN |
| 63 | `/admin/tax/rate/` | LEGACY | MODERN | LEGACY **←fixed** |
| 64 | `/admin/tax/rule/` | LEGACY | MODERN | LEGACY **←fixed** |
| 65 | `/admin/admin/user/` | LEGACY | MODERN | LEGACY **←fixed** |
| 66 | `/admin/admin/user_role/` | LEGACY | MODERN | LEGACY **←fixed** |
| 67 | `/admin/admin/system_variable/` | LEGACY | MODERN | LEGACY **←fixed** |
| 68 | `/admin/admin/cache/` | PLAIN | MODERN | PLAIN **←fixed** |
| 69 | `/admin/indexer/indexer/list/` | PLAIN | MODERN | PLAIN **←fixed** |
| 70 | `/admin/admin/history/` | LEGACY | MODERN | LEGACY **←fixed** |
| 71 | `/admin/admin/integration/` | LEGACY | MODERN | LEGACY **←fixed** |
| 72 | `/admin/bulk/index/` | MODERN | MODERN | MODERN |
| 73 | `/admin/admin/sitemap/` | LEGACY | MODERN | LEGACY **←fixed** |
| 74 | `/admin/admin/email_template/` | LEGACY | MODERN | LEGACY **←fixed** |
| 75 | `/admin/security/session/activity/` | PLAIN | PLAIN | PLAIN |
| 76 | `/admin/admin/locks/` | LEGACY | MODERN | LEGACY **←fixed** |
| 77 | `/admin/customer/index/edit/id/1/` | NOGRID | NOGRID | NOGRID |
| 78 | `/admin/admin/system_config/` | NOGRID | NOGRID | NOGRID |

Not in the table: `/admin/catalog/category/`, `/admin/customer/index/edit/id/:id/`
and `/admin/admin/system_config/` render no grid on either side, and
`/admin/media_gallery/media/index/` is the gallery described above.

## 13. `<select>` option-value parity (round 12 — whole-app, one pass)

Every one of the 232 concrete URLs in §§1–11 was loaded on both sides in one
run and **every** `<select>` on the page collected, paired by
`(name | id, nth-occurrence)`, and its `(value, label)` option pairs diffed in
order — 2 040 selects. This checks the axis a screenshot and an accessibility
tree cannot: an option list whose labels are right and whose **values** are not
looks correct and still breaks `page.select_option(value=…)`.

| bucket | rows | verdict |
|---|---|---|
| identical value+label list, in order | **502** | ✅ |
| present on the source only | 1 463 | mostly `system_config` sections and lazily-mounted UI-component forms; presence parity, not this sweep's axis |
| present on the mock only | 55 | same, inverted |
| identical but for the export **host** (`10.186.197.203:7780` → `localhost:<mock>`) | 13 | not a defect — settled rounds 8–10 |
| value differs beyond the host: export **path suffix** | **5** | **P2, open** — see `TODO.md` (F-05) |
| option list differs on a URL the source redirects away from | 2 | refuted phantom — `/admin/catalog/product_attribute/edit/attribute_id/new/` 302s to the attribute grid, so the two sides are different elements |

Fixed in this pass (all confirmed byte-identical to the source afterwards, and
driven by value in a real browser):

| route | select | was | now (source's) |
|---|---|---|---|
| `/admin/newsletter/template/` | `type` | `html` / `text` | `2` / `1` |
| `/admin/newsletter/queue/` | `status` | `Sent`=2 · `Cancelled`=3 | `Sent`=3 · `Cancelled`=2 |
| `/admin/indexer/indexer/list/` | `gridIndexer_massaction-select` | `realtime` / `schedule` / `invalidate` | `change_mode_onthefly` / `change_mode_changelog` / `invalidate_index` |
| `/admin/admin/cache/` | `cache_grid_massaction-select` | Refresh · Enable · Disable | Enable · Disable · **Refresh (preselected)** |
| `/admin/admin/locks/` | `lockedAdminsGrid_massaction-select` | placeholder selected | `unlock` preselected |
| `/admin/reports/report_statistics/` | `gridRefreshStatistics_massaction-select` | placeholder selected | `refresh_recent` preselected |
| `/admin/sales/order_create/start/` | `billing_country_id` | blank sentinel label `''` | `All Countries` |
