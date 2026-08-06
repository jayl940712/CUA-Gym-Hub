# webarena_shopping_admin_mock — Test Report (part: sales / shell / dashboard)

> Round: **12** · Date: 2026-08-06
> Mock: **http://localhost:5201** (port 5197 was already held by a sibling process;
> vite auto-selected 5201 for the server I started from this working tree. All results
> below are from **my own** server on 5201.)
> Source: http://localhost:7780/admin (reachable: YES, admin/admin1234, strictly read-only)
> Tested by: playwright agent (test12-func) · shard: SHELL, DASHBOARD, SALES (1–38), CATALOG+CUSTOMERS (39–59), CONTENT+STORES/SYSTEM (101–134)
> Status: IN PROGRESS — written incrementally.

## Task 1 — Cold route parity sweep (COMPLETE)

**118 URLs**, each in a **fresh browser context**, cold-loaded with `?sid=parity_test`,
never clicked into. Covers every ROUTES.md row in my shard plus trailing-slash
variants, two `/key/<hash>/` variants, `/admin`, `/admin/admin/`, param variants and `/go`.

**Result: 118 / 118 pass.** 0 white screens, 0 NotFound/AreaPage fallbacks,
0 `sid` losses, 0 console errors, 0 pageerrors, 0 external network requests, 0 broken images.
`GET /go?sid=parity_test` → **200** with `{initial_state, current_state, state_diff}`.

Rows 1–38 (shell / dashboard / sales):

| ROUTES # | Path | Cold 200 | Correct view (h1) | sid kept | console/pageerror | ext req | broken img |
|---|---|---|---|---|---|---|---|
| 1 | `/admin` | ✅ | Dashboard | ✅ | 0 | 0 | 0 |
| 1b | `/admin/` | ✅ | Dashboard | ✅ | 0 | 0 | 0 |
| 2 | `/admin/admin/` | ✅ | Dashboard | ✅ | 0 | 0 | 0 |
| 3 | `/admin/admin/dashboard/` | ✅ | Dashboard | ✅ | 0 | 0 | 0 |
| 3b | `/admin/admin/dashboard` | ✅ | Dashboard | ✅ | 0 | 0 | 0 |
| 3k | `/admin/admin/dashboard/key/abc123def456/` | ✅ | Dashboard | ✅ | 0 | 0 | 0 |
| 4 | `/admin/admin/dashboard/productsViewed/` | ✅ | Dashboard | ✅ | 0 | 0 | 0 |
| 5 | `/admin/admin/dashboard/customersMost/` | ✅ | Dashboard | ✅ | 0 | 0 | 0 |
| 6 | `/admin/admin/dashboard/customersNewest/` | ✅ | Dashboard | ✅ | 0 | 0 | 0 |
| 7 | `/admin/admin/notification/` | ✅ | Notifications | ✅ | 0 | 0 | 0 |
| 7b | `/admin/admin/notification/index/` | ✅ | Notifications | ✅ | 0 | 0 | 0 |
| 8 | `/admin/admin/system_account/index/` | ✅ | My Account | ✅ | 0 | 0 | 0 |
| 10 | `/admin/sales/order/` | ✅ | Orders | ✅ | 0 | 0 | 0 |
| 10b | `/admin/sales/order/index/` | ✅ | Orders | ✅ | 0 | 0 | 0 |
| 10c | `/admin/sales/order/index/?search=Grace` | ✅ | Orders | ✅ | 0 | 0 | 0 |
| 11 | `/admin/sales/order/view/order_id/1/` | ✅ | #000000001 | ✅ | 0 | 0 | 0 |
| 11b | `/admin/sales/order/view/order_id/299/` | ✅ | #000000299 | ✅ | 0 | 0 | 0 |
| 11k | `/admin/sales/order/view/order_id/2/key/9f8e7d6c5b4a/` | ✅ | #000000002 | ✅ | 0 | 0 | 0 |
| 13 | `/admin/sales/order/commentsHistory/order_id/1/` | ✅ | #000000001 | ✅ | 0 | 0 | 0 |
| 14 | `/admin/sales/order/commentsHistory/order_id/1/active_tab/order_shipments/` | ✅ | #000000001 | ✅ | 0 | 0 | 0 |
| 15 | `/admin/sales/order/address/address_id/1/` | ✅ | Edit Order Address | ✅ | 0 | 0 | 0 |
| 21 | `/admin/sales/order_invoice/start/order_id/1/` | ✅ | #000000001 | ✅ | 0 | 0 | 0 |
| 22 | `/admin/sales/order_invoice/new/order_id/1/` | ✅ | #000000001 | ✅ | 0 | 0 | 0 |
| 24 | `/admin/admin/order_shipment/start/order_id/1/` | ✅ | #000000001 | ✅ | 0 | 0 | 0 |
| 25 | `/admin/admin/order_shipment/new/order_id/1/` | ✅ | #000000001 | ✅ | 0 | 0 | 0 |
| 27 | `/admin/sales/order_creditmemo/new/order_id/1/` | ✅ | 404 Error | ✅ | 0 | 0 | 0 |
| 27b | `/admin/sales/order_creditmemo/new/creditmemo_id/1/` | ✅ | New Memo | ✅ | 0 | 0 | 0 |
| 28 | `/admin/sales/order_create/reorder/order_id/1/` | ✅ | Create New Order | ✅ | 0 | 0 | 0 |
| 28b | `/admin/sales/order_edit/start/order_id/1/` | ✅ | Create New Order | ✅ | 0 | 0 | 0 |
| 29 | `/admin/sales/order_create/start/customer_id/1/` | ✅ | Create New Order | ✅ | 0 | 0 | 0 |
| 30 | `/admin/sales/invoice/` | ✅ | Invoices | ✅ | 0 | 0 | 0 |
| 31 | `/admin/sales/invoice/view/invoice_id/1/` | ✅ | #000000001 | ✅ | 0 | 0 | 0 |
| 32 | `/admin/sales/shipment/` | ✅ | Shipments | ✅ | 0 | 0 | 0 |
| 33 | `/admin/sales/shipment/view/shipment_id/1/` | ✅ | #000000001 | ✅ | 0 | 0 | 0 |
| 34 | `/admin/sales/creditmemo/` | ✅ | Credit Memos | ✅ | 0 | 0 | 0 |
| 35 | `/admin/sales/creditmemo/view/creditmemo_id/1/` | ✅ | View Memo | ✅ | 0 | 0 | 0 |
| 36 | `/admin/sales/transactions/` | ✅ | Transactions | ✅ | 0 | 0 | 0 |
| 37 | `/admin/paypal/billing_agreement/` | ✅ | Billing Agreements | ✅ | 0 | 0 | 0 |
| 38 | `/admin/sales/order_status/` | ✅ | Order Status | ✅ | 0 | 0 | 0 |
| 38b | `/admin/sales/order_status/new/` | ✅ | Create New Order Status | ✅ | 0 | 0 | 0 |
| 38c | `/admin/sales/order_status/assign/` | ✅ | Assign Order Status to State | ✅ | 0 | 0 | 0 |
| 38d | `/admin/sales/order_status/edit/status/processing/` | ✅ | Edit Order Status | ✅ | 0 | 0 | 0 |
Rows 39–59 / 74 / 101–134 are tabulated in `TEST.part-catalog.md` (same run).

---

## Task 2 — Grid + functional regression (COMPLETE)

Eight grids driven end-to-end in a real browser on **my own server (5201)**, every
control clicked and every result read back.

**0 console errors · 0 pageerrors · 0 controls raising under Playwright across all eight grids.**

| Grid | records | keyword search | filter → chip | Clear all | Columns chooser | Default View | Export | pager | sort ↑↓ | select-all | mass Actions |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Orders | 308 | ✅ → 15 | ✅ chip, → 308 | ✅ → 308, 0 chips | ✅ 22 boxes, 12->11, Reset→12 | ✅ | ✅ `orders.csv` | ✅ ‹ of 2 ›, p1 `000000299` → p2 `000000180`, prev restores ✅ | ✅ asc `000000001` / desc `000000308` | 200 selected | Cancel · Hold · Unhold · Print Invoices · Print Packing Slips · Print Credit Memos · Print Shipping Labels |
| Products | 2040 | ✅ → 16 | ✅ chip, → 2040 | ✅ → 2040, 0 chips | ✅ 37 boxes, 15->14, Reset→15 | ✅ | — (absent, parity) | ✅ ‹ of 11 ›, p1 `45` → p2 `49`, prev restores ✅ | ✅ asc `1` / desc `2040` | 200 selected | Delete · Change status / Enable · Change status / Disable · Update attributes |
| Customers | 70 | ✅ → 1 | ✅ chip, → 70 | ✅ → 70, 0 chips | ✅ 26 boxes, 9->8, Reset→9 | ✅ | ✅ `customers.csv` | n/a `of 1`, Next disabled ✅ | ✅ asc `William Chang` / desc `Adam Garcia` | 70 selected | Delete · Subscribe to Newsletter · Unsubscribe from Newsletter · Edit · Assign a Customer Group / General · Assign a Customer Group / Wholesale · Assign a Customer Group / Retailer |
| Invoices | 2 | ✅ → 2 | ✅ chip, → 0 | ✅ → 2, 0 chips | ✅ 15 boxes, 10->9, Reset→10 | ✅ | ✅ `invoices.csv` | n/a `of 1`, Next disabled ✅ | ✅ asc `000000002` / desc `000000001` | 2 selected | PDF Invoices |
| Shipments | 3 | ✅ → 2 | ✅ chip, → 0 | ✅ → 3, 0 chips | ✅ 13 boxes, 8->7, Reset→8 | ✅ | ✅ `shipments.csv` | n/a `of 1`, Next disabled ✅ | ✅ asc `000000003` / desc `000000001` | 3 selected | PDF Shipments · Print Shipping Labels |
| CreditMemos | 1 | ✅ → 1 | ✅ chip, → 0 | ✅ → 1, 0 chips | ✅ 13 boxes, 9->8, Reset→9 | ✅ | ✅ `creditmemos.csv` | n/a `of 1`, Next disabled ✅ | ✅ asc `000000001` / desc `000000001` (1 row — no reorder possible) | 1 selected | PDF Credit Memos |
| CMSPages | 6 | ✅ → 1 | ✅ chip, → 0 | ✅ → 6, 0 chips | ✅ 9 boxes, 10->9, Reset→10 | ✅ | ✅ `cms_page.csv` | n/a `of 1`, Next disabled ✅ | ✅ asc `6` / desc `1` | 6 selected | Delete · Disable · Enable |
| URLRewrites | 225 | n/a (source has no keyword box) | ✅ chip, → 225 | ✅ → 225, 0 chips | ✅ 6 boxes, 7->6, Reset→7 | ✅ | — (absent, parity) | ✅ ‹ of 12 ›, p1 `237` → p2 `205`, prev restores ✅ | ✅ asc `1` / desc `237` | 20 selected | Delete |

Per-page selectmenu options are `20 / 30 / 50 / 100 / 200` on every grid; selecting
30 writes `paging[pageSize]=30` to the URL and the row count follows (Orders 30,
Products 30, URL Rewrites 30; the small grids correctly show all 2/3/1/6 rows).
`225 records found` on URL Rewrites ✅ (12 pages at 20/page, p1 `237,236…` → p2 `205…`).

Filters that left the count unchanged (Orders 308, Products 2040, Customers 70,
URL Rewrites 225) picked the *first* option, which genuinely matches every row.
Where a discriminating value was picked the count correctly collapsed to **0**
(Invoices/Credit Memos `Status: Pending`, Shipments `Payment Method`, CMS `Layout: Empty`).

**Note on two round-12 first-pass artefacts, both my harness, not the mock:** the
Columns dropdown does not close on `Escape`, so a first script left it overlaying the
pager and `.action-previous` clicks timed out. Re-run from a clean page load: every
pager works, `Previous` returns to page 1 with the identical first row. Recorded here
so it is not mistaken for a defect.

## Task 3 — Regression on previously-closed findings (COMPLETE)

Every item re-measured **on both sides in the same run**, source logged in as
`admin` (read-only navigation only; no source state was mutated).

### DIFF-S801 — `canShip()` parity · **STILL CLOSED · 21/21 agreement**

21 orders sampled across all five seeded statuses (Complete 153 / Canceled 142 /
Pending 10 / Processing 2 / Closed 1): ids 1,2,3,4,5,6,7,8,9,11,13,16,17,65,125,
299,300,301,302,303,304. For each, both sides were asked (a) does the order view
render `#order_ship`, and (b) does `/admin/admin/order_shipment/new/order_id/:id/`
render a shipment form.

**Mock and source agree on both questions for all 21 orders**, including the two
discriminating cases:

| id | status | `Ship` button mock/src | shipment form mock/src |
|---|---|---|---|
| 4, 9, 11, 13, 16, 17 | Complete | ✅ / ✅ | ✅ / ✅ |
| 65, 299, 301, 302, 303, 304 | Pending | ✅ / ✅ | ✅ / ✅ |
| 125 | Processing | ✅ / ✅ | ✅ / ✅ |
| **300** | **Processing** | **❌ / ❌** | **❌ / ❌** (already fully shipped — the discriminator) |
| 1, 3, 5, 6, 7, 8 | Canceled | ❌ / ❌ | ❌ / ❌ |
| 2 | Closed | ❌ / ❌ | ❌ / ❌ |

### DIFF-S01 / DIFF-S02 — order page-action sets · **No regression**

Page-action toolbars compared string-for-string, in order:

| id | status | both sides |
|---|---|---|
| 1 | Canceled | `Back · Login as Customer · Reorder` — identical ✅ |
| 3 | Canceled | `Back · Login as Customer · Reorder` — identical ✅ |
| 2 | Closed | `Back · Login as Customer · Send Email · Reorder` — identical ✅ |
| 4 | Complete | `Back · Login as Customer · Send Email · Ship · Reorder` — identical ✅ |
| 300 | Processing | `Back · Login as Customer · Edit · Cancel · Send Email · Hold · Invoice · Reorder` — identical ✅ (8/8) |

### F-14 — `country_id` must not delete `[name="region_id"]` · **No regression**

`/admin/sales/order/address/address_id/1/`, changing Country on both sides:

| country | mock `region_id` nodes / options | source `region_id` nodes / options |
|---|---|---|
| FR | 1 / 97 | 1 / 97 ✅ |
| GB | 1 / 97 | 1 / 97 ✅ |
| US | 1 / 66 | 1 / 66 ✅ |
| CA | 1 / 14 | 1 / 14 ✅ |

`[name="region_id"]` is never removed, option counts are identical on all four,
0 pageerrors on either side.

### F-02 (sales) — order-address `region` · **No regression on the evaluator-visible value; one DOM-property nuance re-measured**

Both sides, after `networkidle` + 3 s settle:

| | `[name=region]` attr | `[name=region]` DOM prop | type | visible | `[name=region_id]` value / label |
|---|---|---|---|---|---|
| Mock | `Michigan` | `Michigan` | text | false (`display:none`) | `33` / `Michigan` |
| Source | `Michigan` | `""` | text | false (`display:none`) | `33` / `Michigan` |

The **`value` attribute matches exactly** on both sides, the hidden input is
`display:none` on both, and the *visible* control — the `region_id` select — reads
`33` / `Michigan` on both. The only divergence is the live DOM property of a
hidden input, which Magento's region JS blanks after it populates the select.
Nothing an evaluator or a rendered-text assertion can see. Recorded as **P2,
new id `F-S1202`**, not as a regression of F-02.

### F-11 (sales) — qty inputs · **No regression**

New Invoice, orders 3 and 4, both sides: **2 qty inputs, both `type="text"`** — identical.
New Shipment, order 4 (the shippable one), both sides: **0 inputs matching `name*=qty`** —
identical; the source names them `shipment[items][N]`, and so does the mock.
(Round 11's "New Shipment order 3 → 2 text qty inputs" reading was an artefact:
order 3 is Canceled, so *neither* side serves a shipment form for it, and the two
inputs matched were the shipments-tab grid filters `total_qty[from]`/`total_qty[to]`.)

### F-08 — **still not definable · recorded NOT VERIFIED**

Unchanged from rounds 10 and 11: no definition of a sales-shard `F-08` exists on
disk. `TEST.md` never states it, the round-9/10 part-files were overwritten, and
the DOM shard's `F-08` is a *different*, P2, per-page-menu finding. I am recording
this as **not verified**, not as a pass.

### New this round — DIFF-S1201 · **P2** · non-shippable shipment redirect lands on a different path

| Field | Value |
|-------|-------|
| Path | `/admin/admin/order_shipment/new/order_id/:id/` for a **non-shippable** order (1, 2, 3, 300) |
| Source | redirects to `/admin/admin/order/view/order_id/:id/`, shows `Cannot do shipment for the order.`, then renders **`404 Error` / `Page not found.`** — the source's own redirect target is not a real route (a Magento frontName quirk) |
| Mock | redirects to `/admin/sales/order/view/order_id/:id/?sid=…`, shows the **identical** message `Cannot do shipment for the order.`, then renders the full working order view |
| Agreement | The refusal itself and the message string match exactly; only the redirect path and the resulting body differ |
| Impact | **P2.** Reachable only by deep-linking an error path — the `Ship` button is correctly absent on all four orders (DIFF-S801, 21/21). No task targets it, and the source's own behaviour there is a dead 404. |
| Note | The **invoice** equivalent is exact parity: `/admin/sales/order_invoice/new/order_id/:id/` for orders 1, 2, 3 redirects to `/admin/sales/order/view/order_id/:id/` on **both** sides with the identical message `The order does not allow an invoice to be created.` |

## Task 4 — False-success hunt + pipeline invariants

**NOT RUN — round 12 was halted by the operator before this section was measured.** Treat as NOT VERIFIED, not as passing. See `TEST.md` §6.
