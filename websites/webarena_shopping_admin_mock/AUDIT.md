# AUDIT — webarena_shopping_admin_mock

> ## ⚠️ STALE — this file stopped at round 5; the migration ran to round 12
>
> **Do not use these counts as the current state.** From round 6 onward the migration was
> driven by the *test* shards rather than by fresh audit rounds, so the audit part-files were
> not re-run. Current dimension rounds on disk: parity **3**, handlers **4**, pipeline **4**,
> dom **5**.
>
> **For the current state read [`TEST.md`](TEST.md)** (round 12, interrupted), which supersedes
> the P1/P2 tallies below. In particular, most of the 9 P1s listed here were closed in rounds
> 6–12 and the open set is now different — see `TEST.md` §3.
>
> What has *not* changed and is still accurate: **zero open P0 in every dimension**, and every
> P0 ever filed against this mock was fixed and independently re-verified.
>
> If a future round wants a current audit rather than a current test report, the three
> dimension shards (parity / handlers / pipeline) need re-running; the DOM dimension has
> effectively been kept current through the test shards instead.

> **Round 5** · Date: **2026-08-06** · Consolidated from four specialist audit shards
> and the four round-4 test shards.
>
> **Overall health: the migration has NO open P0 in any dimension, and zero false
> successes.** Every P0 ever filed against this mock — parity, pipeline, handlers and
> DOM — has been fixed and independently re-verified. What is left is a P1 tail
> concentrated almost entirely in one dimension (DOM-locator fidelity) and a long,
> well-characterised P2 backlog.

| | Combined open |
|---|---|
| **P0** | **0** |
| **P1** | **9** |
| **P2** | **24** (audit dimensions) **+ 40** carried in the test shards' own backlogs |

Source shards — read them for the evidence behind any entry:
[`AUDIT.part-parity.md`](AUDIT.part-parity.md) ·
[`AUDIT.part-handlers.md`](AUDIT.part-handlers.md) ·
[`AUDIT.part-pipeline.md`](AUDIT.part-pipeline.md) ·
[`AUDIT.part-dom.md`](AUDIT.part-dom.md) ·
[`TEST.part-dom.md`](TEST.part-dom.md) · [`TEST.part-sales.md`](TEST.part-sales.md) ·
[`TEST.part-catalog.md`](TEST.part-catalog.md) · [`TEST.part-reports.md`](TEST.part-reports.md)

**Provenance warning — read this before using the DOM entries.**
`AUDIT.part-dom.md` was **still round-4 content when this file was written**
(mtime 02:13, unchanged; header still reads the round-4 sweep, counts still
P0 6 / P1 14 / P2 10). A sibling agent was rewriting it for round 5 concurrently and
had not landed. **Every round-4 DOM audit finding was dispositioned by
`TEST.part-dom.md` (round 4), which is what this file consolidates from**: all six DOM
P0s fixed and re-verified by DOM diff, twelve of the fourteen DOM P1s fixed, two
partial. The open DOM entries below are therefore the test shard's `NEW-DOM-2xx`
series, not the audit shard's. If `AUDIT.part-dom.md` has since been rewritten for
round 5, reconcile §3–§5 against it — the ids are stable, so a diff is cheap.

This file is a **prioritised fix list, not a summary**. Work straight down it. Nothing
here was re-audited or re-judged during consolidation; every finding is carried at the
priority its shard filed it, and every closure is attributed to the round and the
evidence that closed it.

---

## 1. Status by dimension

| Dimension | P0 | P1 | P2 | Last audited | Verdict |
|---|---|---|---|---|---|
| **Parity** — routes · seeds · no-network/no-auth · visible strings · task coverage | **0** | **0** | **3** | **round 3** (no round-4 audit run) | The round-3 P0 (PARITY-019, 11 bare source paths 404) and all four round-3 P1s were fixed by the round-4 dev pass. What remains is three **documentation** defects in `ROUTES.md`. **The whole dimension is two rounds stale — see §8.** |
| **Handlers** — dead controls, empty handlers, stubs | **0** | **1** | **9** | round 4 | Round 4 closed both P1s and five of nine P2s. **Zero dead affordances, zero empty handlers, zero false successes** in `src/`, machine-checked. All 259 `ROUTE_TABLE` rows supply a real component; no page is a stub. |
| **Pipeline** — state tracking, `/go`, contract, SCHEMA | **0** | **0** | **4** | round 4 | **All five invariants PASS**, proven on a live server across ~80 sids. Both round-4 P1s (PIPELINE-024, PIPELINE-027) were fixed by the post-audit dev pass and are confirmed in code. State is 329,014 B / 43 keys = **16% of the low end of budget**. Every declared key has a writer. |
| **DOM** — evaluator selector fidelity | **0** | **7** | **8** | round 4 (audit file still round-4; dispositioned by round-4 test) | **All six P0s fixed and independently re-verified by DOM diff.** The `checkbox-without-value` defect class is eradicated. The open P1s are the residue plus the same defect classes discovered one surface over — and **the swept surface is small** (§8). |

Plus one P1 filed by a test shard rather than an audit shard: **DIFF-R35** (§3, P1-i).

Cross-cutting, all re-proven in round 4: `src/App.jsx` has **259** `ROUTE_TABLE` rows,
0 duplicates, every row supplies a real component; **0 external network requests**;
**0 auth gates**; `sid` survives every navigation; `npm run build` clean;
**0 of 184 WebArena tasks blocked**; **false-success count 0**.

### Defects filed under two dimensions — deduplicated here

- **HANDLERS-031 ≡ pipeline's `getStockItem` signature note** — one defect, one entry (§5).
- **HANDLERS-018 ≡ parity's "legacy report grids have no inline filter row" ≡ DIFF-R33** —
  one defect, three ids, one entry (§5).
- **NEW-DOM-200 ≡ DOM-006 one surface over** — DOM-006 was fixed on the product form and
  the identical defect survives on every grid; carried once, as NEW-DOM-200 (§4).
- **DIFF-R35 ≡ DOM-005 one surface over** — same relationship; carried once, as DIFF-R35 (§4).

---

## 2. P0 — **NONE OPEN**

**There is no open P0 in any of the four dimensions. This is the headline of round 5.**

Every P0 ever filed against this migration is closed, each against real evidence and each
independently re-verified by a shard that did not write the fix:

| P0 | Dimension | Closed in | Re-verified by |
|---|---|---|---|
| DOM-100 · grid filter inputs carry no `name` | dom | round 4 | `TEST.part-dom.md` — named-control set diff, mock 2 → 27 named controls, **0 source names missing** |
| DOM-101 · grid `data-action` hooks absent | dom | round 4 | `TEST.part-dom.md` — driven by `[data-action=…]`; orders/customers match the source's set exactly |
| DOM-102 · `customer_group`/`payment_method` were text inputs | dom | round 4 | `TEST.part-dom.md` — both are `<select>`, option value/label lists byte-identical |
| DOM-103 · `status` had a fabricated option + wrong order | dom | round 4 | `TEST.part-dom.md` — 13 options, source order; `stripe_pending` gone |
| DOM-104 · `store_id` unnamed, empty option label lost | dom | round 4 | `TEST.part-dom.md` — `name="store_id"`, `All Store Views` restored |
| DOM-105 · cart price rule missing `customer_group_ids` | dom | round 4 | `TEST.part-dom.md` **end-to-end through `/go`**, and `TEST.part-reports.md` — tasks 699–703 all pass with the evaluator's exact JSON |
| PARITY-019 · 11 bare source paths 404 | parity | round 4 | all 11 bare rows now present in `ROUTE_TABLE`; row count 237 → 259 |
| Round-2 localStorage-quota P0 | pipeline | round 3 | `AUDIT.part-pipeline.md` round 4 — 20 sids in one browser profile, all correct |
| DIFF-R25 · URL Rewrites grid empty | reports test | round 4 | `TEST.part-reports.md` — 225 rows, columns and row content source-identical |
| BUG-107 / BUG-108 / BUG-109 · product toggles + Configurations wizard | catalog test | round 4 | `TEST.part-catalog.md` — element-for-element vs the live source; wizard driven end to end |
| DIFF-R01 / DIFF-R06 · Bestsellers date range, Shipping Report empty | reports test | round 2 | `TEST.part-reports.md` |

**False successes across the entire migration: 0.** Confirmed independently three ways in
round 4 — pipeline drove all twelve PIPELINE-021 buttons live (every one now writes state
or declines honestly), handlers scanned every `onClick={() => addMessage(…)}` site in
`src/` (18 hits, none a false success), and the sales test shard re-drove the last carried
case (Dashboard → Reload Data) on a virgin sid.

---

## 3. P1 — nine open

**Seven of the nine are DOM-locator defects.** If you have one dev pass, spend it here:
these are the findings that make a control invisible or un-drivable to an evaluator's
selector, which is the defect class that has produced every P0 this migration has had.

### P1-a · NEW-DOM-200 · Every grid range filter is `type="number"` / `type="date"`; the source uses `type="text"` — **Playwright throws**

- **Dimension**: dom · **filed round 4 by the test shard** · *the DOM-006 defect class,
  one surface over*
- **File**: `src/components/grid/AdminGrid.jsx:472` and `:482` —
  `type={col.filterType === 'date' ? 'date' : 'number'}` (**confirmed still present**)
- **Routes**: **every** shared grid — `/admin/sales/order/`, `/admin/catalog/product/`,
  `/admin/customer/index/`, and the 100+ routes rendering the shared grid. Highest fanout
  of any open finding.
- **What is wrong**: an evaluator or agent calling `page.fill()` / `type()` with anything
  non-numeric gets a **hard exception**, not a wrong value:
  ```
  playwright._impl._errors.Error: Page.fill: Error: Cannot type text into input[type=number]
    - locator resolved to <input value="" type="number" … name="base_grand_total[from]"/>
  ```
  `type="date"` reports `.value` as ISO `YYYY-MM-DD` where the source's datepicker reports
  localized `M/D/YY`.
- **What the source does**: `<input class="admin__control-text" type="text" data-bind="…">`
  for every one of them, with validation in JS.
- **Affected fields**: orders — `base_grand_total`, `grand_total`, `subtotal`,
  `shipping_and_handling`, `total_refunded` (number), `created_at` (date); products —
  `entity_id`, `price`, `qty` (number), `updated_at` (date); customers — `entity_id`
  (number), `created_at`, `dob` (date).
- **Fix**: `type="text"` on every grid filter input; keep numeric validation in JS. This is
  exactly the fix that closed DOM-006 on the product form — copy it.
- **Tasks blocked**: none named, but this breaks the *mechanism* tasks 676–680 exercise, and
  it fails loudly rather than silently.

### P1-b · NEW-DOM-205 · Product grid: 4 range filters should be single text filters, `store_id` is missing, 3 filters are the wrong element kind

- **Dimension**: dom · filed round 4 by the test shard
- **File**: `src/pages/catalog/ProductGrid.jsx` (column definitions, `filterType` at `:85+`)
- **Route**: `/admin/catalog/product/` filter panel
- **What is wrong**:
  - `cost`, `msrp`, `special_price`, `weight` render as `[from]`+`[to]` pairs — **8 controls
    where the source has 4 single text filters**. `document.querySelector('[name="cost"]')`
    returns `null`.
  - `[name="store_id"]` returns `null`; the source renders a `<select>`.
  - Element-kind divergence (the DOM-102 class), so the enumerated vocabulary is
    undiscoverable from the DOM:

    | name | source | mock |
    |---|---|---|
    | `country_of_manufacture` | `<select>` | `<input type="text">` |
    | `custom_design` | `<select>` | `<input type="text">` |
    | `manufacturer` | `<select>` | `<input type="text">` |
- **Also (P2 half)**: the mock invents **19 filters the source does not render on this grid**
  (`custom_design_from[from|to]`, `custom_design_to[from|to]`, `custom_layout`,
  `gift_message_available`, `news_from_date[from|to]`, `news_to_date[from|to]`,
  `page_layout`, `short_description`, `special_from_date[from|to]`,
  `special_to_date[from|to]`, `websites`) — 49 named filters vs the source's 30. Extra names
  break nothing, but they are selector-visible vocabulary the source does not have.
- **Fix**: make the four single text filters, add the `store_id` select, convert the three
  to `<select>` with the source's option sets, and drop the 19 extras.
- **Tasks blocked**: none named.

### P1-c · NEW-DOM-207 · Order-view sub-tab grids render no controls; the source renders ~30 named filters eagerly

- **Dimension**: dom · filed round 4 by the test shard · *the DOM-100 defect class*
- **Route**: `/admin/sales/order/view/order_id/299/` (Invoices / Credit Memos / Shipments panes)
- **Selectors that return `null`**: `[name="order_increment_id"]`, `[name="state"]`,
  `[name="order_status"]`, `[name="adjustment_positive[from]"]`, `[name="total_qty[from]"]`,
  `[name="order_created_at[from]"]`, …
- **What the source does**: renders the sub-grids with their **full column headers and
  filter rows on cold load**, before any tab is clicked, even when the order has no such
  records. Full source `[name]` set on this page is 49 entries.
- **What the mock does**: 18 controls, all from the order-comment form plus the global
  `query`. Clicking a tab by selector switches the pane correctly, but each pane contains
  **zero `<th>` and zero named controls** — just `We couldn't find any records.`
- **Fix**: render the three sub-grids with their source column sets and filter rows,
  eagerly, regardless of row count.
- **Tasks blocked**: none. Tasks 496–500 assert `must_include` on the *text* of
  `/sales/order/commentsHistory/order_id/N/active_tab/order_shipments/`, not on these
  inputs — which is why this is P1 and not P0. But an agent asked to find a shipment
  within an order has no selector to drive.

### P1-d · NEW-DOM-202 · Order-address `country_id` over-corrected from 60 to 249 options

- **Dimension**: dom · filed round 4 by the test shard · *residue of DOM-014, which is
  otherwise fixed*
- **Files**: `src/pages/sales/OrderAddressEdit.jsx`; country list in
  `src/components/sales/directoryData.js`
- **Route / selector**: `/admin/sales/order/address/address_id/597/` · `[name="country_id"]`
- **Fixed in round 4**: the blank leading option is present, `AG`/`BA` render as
  `Antigua & Barbuda` / `Bosnia & Herzegovina` (no more double-escaped `&amp;`), and the
  `region` free-text input now renders with the source's `data-ui-id`.
- **Still wrong**: the mock ships the **full ISO list (249)** where this Magento install
  exposes only its **60 allowed countries**. `selectedIndex` is therefore still offset
  against the source for most countries — which is precisely what DOM-014 was raised to
  prevent, now failing in the opposite direction.
- **Fix**: truncate `country_id` to the source's 60-option list.
- **Tasks blocked**: none. Tasks 538–542 read `region_id`, which is byte-identical.

### P1-e · NEW-DOM-203 · Customer grid `billing_country_id` has 2 options; the source has 249

- **Dimension**: dom · filed round 4 by the test shard · **the exact inverse of P1-d, on a
  different page — fix both together or you will re-open one**
- **File**: `src/pages/customers/CustomerGrid.jsx` (column definitions)
- **Route / selector**: `/admin/customer/index/` filter panel · `[name="billing_country_id"]`
- **Source**: 249 options — `["",""], ["AF","Afghanistan"], ["AL","Albania"], ["DZ","Algeria"], …`
- **Mock**: `[["", ""], ["US", "United States"]]`. `select_option('AF')` **throws**.
- **Fix**: render the full country list here.
- **Tasks blocked**: none named.

### P1-f · NEW-DOM-204 · Product-grid `attribute_set_id` and `type_id` option ORDER differs from the source

- **Dimension**: dom · filed round 4 by the test shard · *the surviving half of DOM-103,
  whose ordering half was fixed on the orders grid only*
- **File**: `src/pages/catalog/ProductGrid.jsx:103` (`type_id`), `:113` (`attribute_set_id`)
- **The option sets are identical — this is purely ordering**:
  ```
  attribute_set_id
    src : '', 4=Default, 9=Top, 10=Bottom, 11=Gear, 12=Sprite Stasis Ball,
               13=Sprite Yoga Strap, 14=Downloadable, 15=Bag      (Magento sort_order)
    mock: '', 15=Bag, 10=Bottom, 4=Default, 14=Downloadable, 11=Gear,
               12=Sprite Stasis Ball, 13=Sprite Yoga Strap, 9=Top  (alphabetical by label)

  type_id
    src : '', simple, virtual, bundle, downloadable, configurable, grouped
    mock: '', simple, configurable, grouped, virtual, bundle, downloadable
  ```
- **Why it matters**: `select.options[N]` and `selectedIndex` resolve to a different
  attribute set / product type. **WebArena does use `selectedIndex` — task 759.**
  (`visibility` and `status` on this grid are exact matches on both value and order.)
- **Fix**: emit both in the source's order.

### P1-g · NEW-DOM-208 · Review-grid row checkboxes still carry no `id` (DOM-017, **still broken**)

- **Dimension**: dom · filed round 4 by the test shard · *the legacy-grid half of DOM-017;
  the shared-grid half was fixed*
- **File**: `src/components/reviews/LegacyReviewGrid.jsx:379`
- **Route / selector**: `/admin/review/product/index/` · `#id_539`
- **Source**: `<input type="checkbox" name="reviews" id="id_539" data-role="select-row" value="353" class="admin__control-checkbox">`
- **Mock**: same element **without the `id`**. `name`, `data-role`, `class` and `value` are
  all correct.
- **Fix**: add `id="id_<rowIndex>"`. One attribute.
- **Tasks**: adjacent to 771 (bulk-approve reviews).

### P1-h · HANDLERS-034 · `order_status/edit/status/:status/` renders the grid, not the source's edit form

- **Dimension**: handlers · round 4 · **confirmed still open**
- **File**: `src/App.jsx:446` —
  `{ row: 38, path: '/admin/sales/order_status/edit/status/:status', title: 'Order Status', component: <OrderStatusGrid /> }`.
  `ROUTES.md:362` records the alias under "Resolved to the area's own index page".
  No `OrderStatusEdit` component exists in `src/` (grepped).
- **What the source does** (verified live, authenticated, read-only —
  `GET /admin/sales/order_status/edit/status/processing/`): `200`, 54,950 bytes,
  `<h1>Edit Order Status</h1>`, toolbar `Back · Reset · Save Status`, with the Status Label
  field and its per-store-view label rows. **A real editor, not an alias of the grid.**
- **What is wrong**: the URL is reachable and the URL an evaluator reads is right, but the
  agent lands on the Order Status listing — no Status Label input, no `Save Status`. There
  is no way to rename an existing order status in the mock.
- **Mitigating (why P1, not P0)**: nothing in `assets/TASKS.md` edits an order status
  (grepped), and the source's own grid has no `Edit` link — every `order_status`-bearing
  anchor in `assets/html/sales-order-status.html` is the breadcrumb. The page is
  typed-URL-only.
- **Fix**: point the route at an `OrderStatusEdit` that reuses `OrderStatusNew`'s form
  (`src/pages/sales/OrderStatusForms.jsx` already proves the shape) seeded from
  `state.orderStatuses` by `:status`, saving through
  `updateCollectionItem('orderStatuses', 'status', …)` — the helper
  `src/pages/sales/OrderStatusGrid.jsx:52` already uses. Then delete the `ROUTES.md:362`
  alias row.

### P1-i · DIFF-R35 · Legacy report grids default `Period` to `year`; the source defaults to `day`

- **Dimension**: dom / parity · **filed round 4 by the reports test shard**, not by an audit
  shard · *the DOM-005 defect class one surface over — `AUDIT.part-dom.md`'s "Not reached"
  section predicted exactly this*
- **File**: the legacy report control panel — `LegacyFilterToolbar`
  (`src/pages/reports/LegacyReports.jsx:67-102`)
- **What is wrong**: DOM-005 was fixed on `/admin/reports/report_sales/sales/`
  (`#sales_report_period_type` now reads `day` on cold load). The **legacy** report panels
  still default `Period` to `year`. An agent that leaves the control alone produces a
  different report from the source's, and any evaluator asserting the untouched default
  reads the wrong value.
- **Fix**: default `Period` to `day` on the legacy panels too.
- **Tasks**: adjacent to 706, 708, 710–713 — see `TEST.part-reports.md` §"New Source-vs-Mock
  Differences this round" for the per-report detail.

---

## 4. P2 — twenty-four open across the audit dimensions

Terse by design. Full evidence and fix text is in each shard file under the same id.

### DOM (8)

- **NEW-DOM-201** · Products grid lacks `data-action="advanced-select-search"` and
  `close-advanced-select` — the source's attribute-set ui-select; the mock renders a plain
  `<select>`, so the hooks have nothing to attach to. Orders and customers grids match the
  source's `data-action` set exactly.
- **NEW-DOM-206** · Customer grid `group_id` includes `0 = NOT LOGGED IN`, which the source
  omits on a registered-customer grid, and the order differs (source is alphabetical by
  label). The mock also adds 6 filters the source lacks; no source filter is missing.
- **NEW-DOM-209** · Orders-grid Columns chooser offers 22 columns; the source offers 46.
  The 22 cover every column the source *displays* by default plus 11 more; the 24 omitted
  are available-but-hidden source columns. No task drives them.
- **NEW-DOM-210** · `Print All` still missing from the orders mass-actions menu (was DOM-020).
- **NEW-DOM-211** · Product form: 6 MSI `data-index` values still absent (`sources`,
  `assign_sources_container`, `assign_sources_button`, `assigned_sources`,
  `salable_quantity`, `thumbnail_image_text`). Residue of DOM-002, which went 11 → 67 of the
  source's 73.
- **NEW-DOM-212** · Review edit: `stores[]` hidden input absent; save button is `id="save"`
  where the source uses `id="save_button"`. Residue of DOM-004.
- **NEW-DOM-213** · Global search still merges the source's two elements into one (was
  DOM-008). `[name="query"].value` is always `""` on the source, reflects typed text on the
  mock. Present on **every** admin page.
- **DOM-019** · Applied-filter chips render the visible word `Remove` where the source uses
  an icon-only button, so chip `outerText` differs. Tasks 676–680 pass (`must_include`), but
  an `exact_match` on that node would break. **⚠ `TEST.part-dom.md` marks this "❌ STILL"
  in its disposition table but omits it from its P2 count of 7 — carried here as open;
  the count discrepancy is the test file's, not a judgement made during consolidation.**

### Handlers (9)

- **HANDLERS-013** · CMS page `Save & Duplicate` does not duplicate — `save(true)` saves the
  *same* page and returns to its own edit form (`src/pages/content/CmsPages.jsx:188-216`,
  `:238-239`). Byte-identical to rounds 2, 3 and 4. Fix: relabel to `Save & Continue Edit`
  (what the id and code both say) **or** insert a copy with a fresh `page_id` and a
  `-1`-suffixed `identifier`, as `ProductEdit.save('duplicate')` already does.
- **HANDLERS-018 ≡ DIFF-R33 ≡ parity's inline-filter-row note** · Legacy-grid pages still
  render the modern toolbar. `src/components/reviews/LegacyReviewGrid.jsx` (397 lines) is
  fully functional and is the only legacy grid; it backs only the Reviews listings. Still on
  `<AdminGrid>` where the source uses the legacy widget: `sales/OrderStatusGrid.jsx`,
  `system/Tax.jsx`, `system/Permissions.jsx`, `marketing/Marketing.jsx` (Search Terms /
  Newsletter / Catalog Rules), `catalog/AttributeSets.jsx`, `catalog/ProductAttributes.jsx`.
  The reviews grid **did** gain the full inline filter row in round 4 (DIFF-R33); Ratings,
  Search Terms, Search Terms Report, URL Rewrites, Product Reviews Report, Downloads,
  Abandoned Carts, Catalog Price Rule, Newsletter Templates/Queue and Terms and Conditions
  still lack it. Tracked `[~]` at `TODO.md:30`. Fix: generalise `LegacyReviewGrid`.
- **HANDLERS-019** · Footer links and "Customer View" go nowhere.
  `src/components/layout/AdminFooter.jsx:13-15` — `Privacy Policy`, `Account Activity`,
  `Report an Issue` are `href="#"` + `preventDefault`; these are the only dead `href="#"`
  anchors in `src/`. `src/components/layout/AdminHeader.jsx:144` — `Customer View` links to
  `/`, bouncing to the dashboard. Fix: point `Account Activity` at
  `/admin/security/session/activity/` (which exists); give the other two and `Customer View`
  the notice treatment.
- **HANDLERS-030** · 12 unbound inputs on Import / Export / Tax-import / Currency —
  `src/pages/system/Tools.jsx:251,263,272,281,290,299,310,318,362,370`,
  `src/pages/system/Tax.jsx:257`, `src/pages/system/Stores.jsx:126`. **These are the only
  uncontrolled form controls left in `src/`** (brace-aware tag walk). The *actions* are the
  server-side machinery `TODO.md:149` scopes out and already emit the source's message —
  only the field binding is missing, so a typed value is lost on re-render. Fix: bind to
  local state (the sibling `entity`/`behavior` fields at `Tools.jsx:202-203` already are)
  or mark them `disabled`.
- **HANDLERS-031** *(≡ pipeline's `getStockItem` note — one defect, one id)* · Advanced
  Inventory writes a `stock_item` nobody reads. `src/utils/selectors.js:216` is
  `getStockItem(productId)` — **no `state` argument** — so it can only return the static
  `S.stockItemByProductId` row; `buildPatch` nests the three fields under
  `patch.stock_item` (`src/pages/catalog/ProductEdit.jsx:325-330`) and nothing in `src/`
  reads `productOverrides[*].stock_item`. Editing Out-of-Stock Threshold / Maximum Qty
  Allowed in Cart / Backorders, saving and reopening shows the old values. The write *does*
  reach state, so `/go` sees it and the reward signal is not lost — hence P2, but the UI
  contradicts the state. Fix: `getStockItem(state, productId)` merging
  `state.productOverrides[id]?.stock_item`, updating the two call sites
  (`ProductEdit.jsx:115`, `:326`).
- **HANDLERS-035** · Edit Attribute Set is missing three of the source's five toolbar
  controls. `src/pages/catalog/AttributeSets.jsx:232-244` renders `Back · Save`; the source
  renders `Back · Reset · Delete · Save · Add New · Delete Selected Group` (`Delete` is the
  only set-dependent one). Fix: `Reset` and `Delete` first (one-liners against the existing
  `attributeSetOverrides` map); `Add New` / `Delete Selected Group` need an
  `attribute_group` overlay and can follow. Tasks 694–698 only *select* a set, never edit one.
- **HANDLERS-036** · "Add New URL Rewrite" is missing the source's `Create URL Rewrite` type
  selector. `src/pages/marketing/Marketing.jsx:1283-1355` — `entity_type` is carried in
  `initial` (`:1315`) but absent from `fields` (`:1324-1333`), so a new rewrite is always
  `custom`. **The edit form is correct; only the New form is short one control.** Fix:
  prepend a select bound to `entity_type` (`custom`/`product`/`category`/`cms-page`) on the
  create path only.
- **HANDLERS-037** · "Login as Customer" reports a login that did not happen.
  `src/pages/customers/CustomerEdit.jsx:227` emits
  `You are logged in as customer: <email>` with no state write and no navigation; the source
  opens the storefront, which is `TODO.md` Out-of-Scope. Not counted as a false success —
  it asserts a *navigation*, not a data change — but it is the nearest remaining shape.
  Fix: `notice` type, text saying the storefront is not part of this mock, matching how
  `Inventory.jsx:96` and `External.jsx:181` already decline.
- **HANDLERS-038** · Wizard step 1 "Create New Attribute" navigates away and destroys the
  wizard. `src/pages/catalog/ProductEdit.jsx:1140-1143` navigates to
  `/admin/catalog/product_attribute/new/`; the source opens it **in a modal on top of the
  wizard** and returns to step 1 with the attribute pre-checked. Wizard state and any
  unsaved product edits are lost with no route back. Everything else in the four-step
  wizard was re-verified end to end and works. Fix: render the form in the wizard's modal,
  or stash wizard state in `sessionStorage` and restore on return.

### Pipeline (4)

- **PIPELINE-020** · The only wishlist mutation in the app is unreachable. The writer
  (`src/context/AppContext.jsx:224-232`, wired at
  `src/pages/customers/CustomerEdit.jsx:563-569`) is **correct**; both seeded wishlists
  carry `items: []` (customers 15 and 70, `src/data/wishlists.json`), so the tab renders
  `We couldn't find any records.` and the Delete link never appears. Verified live, sid
  `P4U17`. **Seed gap, not a pipeline gap — seed ownership sits with plan/dev.** If the
  source tables really are empty, record that in `SCHEMA.md` and close it.
- **PIPELINE-022** · `compactState()` re-stringifies large mutated arrays on every save.
  `src/utils/dataManager.js:169-182` — the `v === defaults[k]` fast path covers untouched
  keys, but any already-mutated key falls through to `JSON.stringify` on **every**
  subsequent save (with `reviews` mutated, 2 × 182 KB per save). **Not observable**: 0 page
  errors, no dropped frames across ~80 sids and ~60 mutations in round 4. Fix: deep-compare
  only keys whose reference differs *and* whose serialised default is under a size
  threshold; above it, treat a reference-differing key as dirty.
- **PIPELINE-025** · Two correct handlers are latent because their grids are empty —
  Locked Users → Unlock (`src/pages/system/Permissions.jsx:116-135`) and Bulk Actions →
  Remove (`src/pages/system/Tools.jsx:600-620`). Both have real writers; both grids render
  `We couldn't find any records.` because `lock_expires` is NULL for every `admin_user` row
  in this deployment, which makes the empty grid **genuine parity**. **No fix required** —
  recorded so it is not re-reported as an untracked mutation. Both are injectable.
- **PIPELINE-026** · The three url_rewrite overlay sub-keys (`url_rewrites`,
  `url_rewrite_edits`, `url_rewrite_deleted`, written at
  `src/pages/marketing/Marketing.jsx:851-869`) are not declared in `createInitialData()`'s
  `systemConfig` literal (`src/utils/dataManager.js:274-293`), unlike their seven siblings.
  They nest under a declared top-level key so the diff surfaces them correctly — a
  documentation/consistency nit, not a correctness break. Fix: declare them with the same
  comment style.

### Parity (3) — all three are **documentation**, last verified round 3

- **PARITY-023** · `ROUTES.md:354+` "Secondary create/edit paths" **understates the mock**.
  The section is headed *"Resolved to the area's own index page — the editor behind them is
  out of scope"*, but round 3 built real forms behind ~10 of those rows (catalog price rule,
  rating, synonym group, checkout agreement, newsletter template, custom variable,
  integration, sitemap, email template, design change). **Independently corroborated by the
  round-4 handlers shard** (`ROUTES.md:370-378` still stale). The
  `/admin/inventory/{source,stock}/…` rows **are** still accurate. Fix: move the ten rows
  into the "Implemented as real, state-writing forms" table above and name what each writes.
- **PARITY-024** · Tax Report totals row shows an Orders count where the source leaves it
  blank. Source emits an empty `th.col-qty.col-orders_count`; the mock emits
  `<th class="col-orders_count col-number">1</th>`. Data row and tax total are both correct.
  **Last verified round 3; no round-4 check.** Fix: suppress the orders-count total on the
  tax report only.
- **PARITY-025** · Duplicate row numbers in `ROUTES.md` — **confirmed still present**:
  `:60-61` (two rows numbered 31), `:63-64` (33), `:66-67` (35), `:70-72` (**three** rows
  numbered 38). No route is broken; this is a doc-integrity hazard, since the `row:`
  back-references in `src/App.jsx` are ambiguous. Fix: renumber and update the matching
  `row:` fields.

### Carried in the test shards' own backlogs (40) — not re-listed here

These are cosmetic/parity defects filed by the round-4 test shards, each with source-vs-mock
evidence in its own file. They are real and open; they are grouped rather than expanded so
this file stays a working fix list.

| File | Count | Ids | Theme |
|---|---|---|---|
| `TEST.part-sales.md` | 13 | DIFF-006, 008, 009, 010, 011, 014, 019, 102, 103, 104, 105, 107, 205 | Visual chrome (grid overflow, `Filters` button styling, header height), `document.title` breadcrumb segments, order-view button *float* (the button **order** is fixed — see §5), dashboard tile cells rendered as links. *(DIFF-101 improved this round — the mock now emits real `\xa0` runs, source uses ordinary spaces; DIFF-201 and DIFF-202 are recorded for accuracy, not proposed for change.)* |
| `TEST.part-catalog.md` | 9 | DIFF-013, 014, 015, 016, 017, 018, 019, 020 | Export buttons on four grids the source lacks them; Stores grid omits `(Code: …)`; CMS page extra actions + `Yes` leak; category missing Schedule Design Update + scope switcher; Customer Groups Action column expanded |
| `TEST.part-reports.md` | 18 | BUG-R02 residual, BUG-R03, DIFF-R16, R18, R19, R20, R21, R22, R24, R27, R28, R30, R32, R33, R34, R36, R37, R38 | Legacy-grid Export controls, column-label drift across marketing grids, missing `Total` row on Ordered Products, timestamp comma, date normalisation, inline filter rows (≡ HANDLERS-018) |

---

## 5. Verified fixed — **DO NOT RE-AUDIT**

Five rounds of findings exist and agents keep re-deriving old analysis. Everything in this
section is closed against real evidence, by a round that is named. **Re-litigating any of it
wastes a round.**

### Closed by the round-4 dev pass (post-audit)

| Finding | Dimension | Evidence it is closed |
|---|---|---|
| **PARITY-019** (**P0**) 11 bare source paths 404 | parity | All eleven bare rows now present in `ROUTE_TABLE` (`/admin/customer`, `/admin/review/product`, `/admin/search/synonyms`, `/admin/media_gallery/media`, `/admin/inventory/source`, `/admin/admin/url_rewrite`, `/admin/admin/system_account`, `/admin/loginascustomer_log/log`, `/admin/bulk`, `/admin/marketplace`, `/admin/inventory/stock`); row count 237 → **259**, all with components |
| **PIPELINE-024** `dashboardStatistics` undeclared | pipeline | Declared at `src/utils/dataManager.js:297`. The diff now has an `old` member like every other key |
| **PIPELINE-027** no `/go` route in `App.jsx` | pipeline | `src/App.jsx:479-486` — `GoPage` rendered at both `/go` and `/go/`, ahead of the admin chrome, with the §5 rationale in a comment |
| **PARITY-020** Product Reviews Report recomputed averages | parity | `src/components/reports/ratingVoteAggregates.json` extracted and imported at `src/pages/reports/LegacyReports.jsx:12`; `:583-589` sums `percent` / `percent_approved` over that table, structurally matching Magento's `_joinReview()` |
| **PARITY-021** `show_actual_columns` never honored | parity | Consumed at `src/pages/reports/SalesReports.jsx:149` (`SALES_COLUMNS_ACTUAL`) and `:157` (`withActualColumns`) |
| **PARITY-022** Search Terms Report Store cell run-on | parity | `store-view-cell` no longer used by `Marketing.jsx`; `TEST.part-reports.md` §1c: the Store cell text is **character-identical** to the source on both sides |
| **PARITY-018** two residual `document.title` menu-path misses | parity | `src/components/layout/adminMenu.js:100` now lists the bare `/admin/search/term` in `match:`; `:144` gives Themes `titleOmitsPageTitle: true`. `TEST.part-reports.md` DIFF-R29 confirms the search-term title is byte-identical. *(The full 67-title sweep was not re-run — see §8.)* |
| **PARITY-013** order-view button order + `#back` target | parity | `src/pages/sales/OrderView.jsx:166` — `#back` now navigates to `/admin/sales/order/index/order_id/${id}/`; `TEST.part-sales.md` DIFF-014 records the mock rendering the source's order `Back · Login as Customer · Edit · Cancel · Send Email · Hold · Invoice · Ship · Reorder`. **Only the visual float of `Edit` remains, as a styling P2 in `TEST.part-sales.md`** |
| **DOM-100 … DOM-105** (all six **P0**) | dom | `TEST.part-dom.md`, by DOM diff and selector-driven interaction — see §2 |
| **DOM-001, 002, 003, 004, 005, 006, 009, 012, 012b, 013, 015, 016, 018** | dom | `TEST.part-dom.md` per-finding evidence. `data-index` 11 → 67 of the source's 73; rating radios now `id=Rating_1..5` / `value=16..20`; `period_type` defaults to `day` on the sales panel; product form input types match |
| **DOM-014, DOM-017** | dom | **PARTIAL** — the named sub-defects are fixed; the residue is NEW-DOM-202 and NEW-DOM-208 (§3). Do not reopen the parents |
| **HANDLERS-009** store-view scope selects unbound | handlers | `src/pages/Dashboard.jsx:156-160` and `src/pages/catalog/ProductEdit.jsx:405-409` — both controlled, both write the query string through `withGridParams`, `sid` survives |
| **HANDLERS-023 ≡ PIPELINE-008** Submit Order untracked | handlers + pipeline | `src/pages/sales/OrderCreate.jsx:95-170` assembles a full order, allocates `entity_id`/`increment_id`, writes `newOrders` + an `orderComments` entry, redirects to the new order. Driven live: `state_diff=['newOrders','orderComments']`, orders grid then reports **309 records found** |
| **HANDLERS-029 ≡ PIPELINE-019** System Config false success | handlers + pipeline | `configPath(f)` (`src/components/system/configSections.js:588-598`) derives a real path from the descriptor's `name=`; **227 editable descriptors, 0 that fail to resolve**; the `includes('/')` guard is gone; a no-op save now says `There is nothing to save…` as a `notice`. Driven live on five sids, including a save→reload persistence check |
| **HANDLERS-028** empty heading block on `commentsHistory` | handlers | `src/pages/sales/OrderCommentsHistory.jsx:52-57` — title block first, `<NoteList>` second |
| **HANDLERS-032** "Use system value" cannot be unchecked | handlers | `inherit` is explicit per-field state (`Configuration.jsx:48,52,178-197`) |
| **HANDLERS-033** Store Group "Web Site" overwritten on Save | handlers | `src/pages/system/Stores.jsx:361-372` — the overwrite line is gone |
| **PIPELINE-021** twelve success messages with no state footprint | pipeline | **All twelve re-driven live, one sid each.** Nine now write `systemConfig`; three are honest declines (`notice`/`error` with `state_diff=[]`); two are latent on empty grids (PIPELINE-025). **0 remain** |
| **BUG-005** Dashboard "Reload Data" false success | sales test | `src/pages/Dashboard.jsx:34-49` writes `dashboardStatistics.lifetime_refreshed_at` + `lifetime_refresh_count`. Magento's own `RefreshStatistics.php` records the refresh even though the figures do not move, so this is the honest mock. Verified on a genuinely virgin sid |
| **BUG-107, BUG-108, BUG-109** (all **P0**) | catalog test | `product[status]` flips to `"2"`; `product[sale]`/`product[new]` are valued checkboxes; the Configurations wizard completes and appends the variant (`state_diff=['newProducts','productOverrides']`). Tasks 185, 187–195, 501–505, 547–551, 768 now achievable |
| **DIFF-204, DIFF-206, DIFF-203** | sales test | Credit-memo 404/200 cases both match the source incl. banner copy; the three `…/email/…` routes land on the source's own final URLs; the order-address notice banner is present |
| **DIFF-R25** (**P0**), **DIFF-R26**, **DIFF-R29**, **BUG-R02**, **DIFF-R31** | reports test | URL Rewrites grid = 225 rows source-identical; Order Count tie order matches on both sides; Edit Search Term h1/title/fields/buttons source-identical; cart-rule field names complete; Newsletter Problems Report h1/title/columns/empty-message source-identical |
| **Checkbox-without-`value` defect class** | dom | **ERADICATED.** Zero hits across all 11 re-extracted pages plus both grid dumps. BUG-107/108, DOM-009 and DOM-013 were the whole population |

### Closed in rounds 2 and 3 — settled

- **Parity**: PARITY-008 (Ratings column label), PARITY-009 (`document.title` menu path —
  60 of 67 byte-identical; the two stragglers were PARITY-018, now also closed),
  PARITY-015 (**resolved — not reproducible**; the round-1 reference screenshot was stale),
  PARITY-016 (Bestsellers `rating_pos <= 5`), PARITY-017 (literal NUL byte).
- **Handlers** (15 closed in round 3): HANDLERS-006, 007, 008 *(except the HANDLERS-031
  residue)*, 010, 011, 012, 015, 017, 020, 021, 022, 024, 025, 026, 027.
- **Pipeline**: PIPELINE-001 (virgin-sid baseline), PIPELINE-002 (partial-inject mega-diff),
  the **round-2 localStorage-quota P0**, PIPELINE-005 (catalog price rule),
  PIPELINE-011 (dead exports), PIPELINE-013 (ratings stub), PIPELINE-014
  (`attributeSetOverrides` undeclared), PIPELINE-015 (four "Send Email" false successes).
- **Round-2 test shards**: sales DIFF-001, 002, 003, 005, 007, 012, 013, 015, 016, 017, 018,
  020, 021, BUG-001, BUG-002, BUG-003; catalog BUG-001, DIFF-001, 002, 003, 006, 007;
  reports DIFF-R01 (**P0**), DIFF-R06 (**P0**), DIFF-R08, DIFF-R09.
  **DIFF-R02 was withdrawn — not a mock defect** (§6).

### Verified working end to end — do not re-derive

- **`<AdminGrid>` (751 lines) + `gridUtils.js` — no regression** across the round-4 DOM
  rewrite. Keyword search, per-column filters with Apply/Cancel, chips with per-chip Remove
  and Clear all, Columns chooser + Default View, saved bookmarks, Export CSV + Excel XML,
  the Magento `selectmenu` per-page control, the pager, sortable headers **in both
  directions**, page/all checkbox selection with the four-item Options menu, and the Actions
  dropdown gated on `selectable && massActions.length`. All URL-driven; `sid` preserved
  throughout. Re-confirmed on orders, products and customers by the DOM test shard.
- **Zero dead affordances and zero empty handlers in `src/`** — brace-aware tag walk over
  every `<button>`, `<a>`, `<AdminLink>`, `<input>`, `<select>`, `<textarea>`. Zero
  `onClick={() => {}}`, zero `console.log`/`warn`, zero `TODO`/`FIXME`, zero `Lorem ipsum`,
  zero `alert(`. The only `not implemented` string is in the unreachable `AreaPage.jsx` —
  all 259 `ROUTE_TABLE` rows supply a component, so the fallback never fires.
- **All five pipeline invariants PASS**, re-proven empirically: virgin sid (no boot-time
  write), full inject (43 keys adopted as baseline, `state_diff=[]`), partial inject (merged
  over defaults, **no mega-diff**), **20 sids in one browser profile** (all correct, 0
  errors), and localStorage read **before** `initializeData()`.
- **Every contract element of `WEBARENA_MIGRATION.md` §5 conforms** —
  `secureMockApiPlugin()` first in `plugins[]`, `mock-api` under **both** `configureServer`
  and `configurePreviewServer`, `/post` `/state` `/go` `/upload` `/files`, state at
  `.mock-states/<sid>.json` + `<sid>.initial.json`, sid sanitized at all five sites, the
  full `dataManager` export set, and (since the round-4 dev pass) the client-side `/go` route.
- **State size and shape**: 329,014 B / 43 keys = **16% of the low end of budget**;
  ~4.4 MB of bulk corpora correctly kept out of state via `src/utils/staticData.js`,
  including the 63 KB / 225-row `urlRewrites.json` seed, which is imported statically and
  edited through three small overlays. **Every one of the 43 keys has at least one writer.**
- **Session isolation**: 2 sids + 20 sids, no cross-talk; `reset` restores the seed and
  reaches the UI.
- **Seed integrity CLEAN**: orders 308 / customers 70 / reviews 351 / products 2040 /
  attributes 81 / attribute sets 8 / ratings 4 — all exact vs the live DB. The 15 hidden
  attribute codes match `is_visible=0` **verbatim** and nothing was deleted to make a count
  match. No `faker`, no `Math.random()` in data construction.
- **No network, no auth**: 0 external requests over 235 page loads, 4 `fetch(` sites all
  mock endpoints, no `isAuthenticated`/`requireAuth`/`ProtectedRoute` anywhere in `src/`.
- **Full handler inventories** for Sales, Catalog, System, Content/Marketing/Reviews from
  round 3, plus the **Configurations wizard** (all four steps, both guards,
  `generateConfigurations`) and the **URL Rewrites grid** (real shared-grid controls, honest
  overlay, mass Delete) from round 4. Nothing that was working came back broken.

---

## 6. Known gaps and declared declines — deliberately not implemented

These are **not** findings. They are recorded so future rounds do not re-file them.

- **Source non-determinism — the mock's deterministic tie-break must be kept.** Magento
  orders Bestsellers by `qty_ordered DESC` and Product Reviews by `review_cnt DESC` with
  **no tie-break column**, so MySQL returns an arbitrary permutation. Confirmed twice
  independently (parity round 3, reports test round 4) by re-loading each source URL 3×
  back to back: the Dashboard Bestsellers tile gave 2 distinct orderings, the Bestsellers
  Report 2 –3 distinct rank-4/5 pairs, the Product Reviews Report 3 distinct page-1
  orderings; one source load even printed the same product twice. Totals and row membership
  above the tie boundary agree on both sides in every case. **This retracts round-1 DIFF-R02
  and closes PARITY-015/016's residual.** Do not file row-permutation differences against
  these reports again without first re-loading the source 3×.
- **Declared declines (PIPELINE-023)** — no fix required, all verified as mail/session side
  effects with no DB footprint in the source either: `src/pages/customers/CustomerEdit.jsx:273`
  **Reset Password**, `:280` **Force Sign-In**. *(Dashboard "Reload Data" has left this list
  — it is now a real writer.)*
- **Import / Export / Currency Rates actions are out of scope** per `TODO.md:149` —
  server-side machinery. They already emit the source's message. Only the *unbound inputs*
  are filed (HANDLERS-030).
- **Dashboard "Most Viewed Products" is empty — source-accurate.** All four
  `report_viewed_product_*` tables are 0 rows in this deployment. Closed as accurate, not
  as a gap. Likewise the **Dashboard `$0.00` tiles**, which are the literal strings in
  `assets/html/dashboard.html`.
- **`/admin/sales/order_creditmemo/{start,new}/order_id/N/` rendering `404 Error` is
  correct** — the source 404s for every order (`canCreditmemo()` needs
  `total_paid > total_refunded`, which no seeded order satisfies). Verified on both sides,
  banner copy exact.
- **Six system grids start empty** (`sitemaps`, `email_templates`, `synonyms`,
  `url_rewrites`, `newsletter_templates`, `design_changes`) — the source is empty here; the
  round-3 forms write into these collections and their grids read them back.
- **Two latent-but-correct handlers** (PIPELINE-025): Locked Users → Unlock and Bulk
  Actions → Remove. `lock_expires` is NULL for every `admin_user` row in this deployment,
  so the empty grid is genuine parity. Both are injectable.
- **`wishlists` is seeded with zero items** (PIPELINE-020) — a seed gap owned by plan/dev,
  not a pipeline defect.
- **`Images And Videos` (Manage Gallery)** on the product form is a read-only file listing
  (`src/pages/catalog/ProductEdit.jsx:1006-1015`) — no buttons, no success message. Nothing
  to track and no false success; a missing feature on the handlers backlog, not a defect.
- **`src/utils/stateTracker.js` is still owed** (`TODO.md:23`, unchecked). The `/go` diff is
  computed server-side by `calculateStateDiff` in `vite.config.js`, which covers every
  top-level state key, so this is structural debt rather than a correctness gap.
  `TODO.md:24` (`SCHEMA.md` state table) is stale — `SCHEMA.md` was rewritten against the
  code in round 4.
- **Out of the DOM contract, listed only so they are not re-filed**: `form_key` (CSRF,
  explicitly dropped by the migration contract), `store_switcher` / `store_group_switcher` /
  `website_switcher` hidden inputs (DOM-007 / DOM-010), the report export select's
  per-request random id (DOM-011), the review-grid date-filter's random id (DOM-022), and
  `_draggable` on grid headers (DOM-021 — column reordering is not implemented). Together
  these account for the entire remaining source-only `[name]` set on the product form, the
  cart price rule form and all three grids. No evaluator reads them.
- **Observed but never filed as numbered findings** (owned by parity, carried since round 3):
  `/admin/review/product/jsonProductInfo/id/N/` is used as a page URL by the New Review
  chooser — the form renders and saves correctly, but the URL an evaluator sees is the
  source's AJAX endpoint; `src/pages/reviews/Reviews.jsx` slices the product list to the
  first 500 rows for that picker where the source paginates all 2040; and
  `CustomerEdit.jsx:479` hardcodes "There are no items in customer's shopping cart." because
  there is no `quote`/`quote_item` seed.
- **New Customer Group saved with an empty code prints no message at all** (sid `P4S4`).
  Not a false success — nothing is claimed — but the source answers `This is a required
  field.` there, as `/admin/admin/user/new/` and `/admin/tax/rule/new/` already do in this
  mock. Handlers backlog, unfiled.

---

## 7. Unswept surface — **where the next P0 most likely hides**

Round 4's DOM sweep produced six P0s from **16 pages**. The mock has **259 routes**.
Absence of findings in the list above is not absence of defects; it is absence of a sweep.
This section is deliberately explicit so that is visible.

### DOM — the largest unswept surface, and the highest-yield

DOM-level source-vs-mock comparison has covered **16 of 259 routes**. Not reached:

- **Report control panels other than `report_sales/sales`** — `refunded`, `tax`, `shipping`,
  `coupons`, `bestsellers`, `report_product/viewed`. **Tasks 706, 708, 710, 711, 712, 713
  target these.** Source DOM was captured to `/tmp/pw-dom/src/` but never diffed against the
  mock. *Round 4 predicted DOM-005 would repeat here if the panel is not shared — and the
  reports test shard then found exactly that (DIFF-R35, §3). Treat the rest of this bullet
  the same way.*
- **New Customer** (`/admin/customer/index/new/`) and the **customer edit sub-tabs**
  (Account Information / Addresses / Orders / Newsletter). Customer edit's *top-level*
  `[name]` set is an exact match; the tabs were never clicked.
- **CMS blocks** (`/admin/cms/block/edit/block_id/N/`) — only CMS *pages* were compared, and
  the CMS page comparison produced DOM-009.
- **System Config section forms** (`/admin/admin/system_config/edit/section/*`) — **none
  compared.** Large surface, many `groups[...][fields][...][value]` names. Note that the
  handlers shard proved all 227 descriptors now *save*; nobody has checked whether their
  `name` attributes match the source's.
- **Attribute and attribute-set forms**
  (`/admin/catalog/product_attribute/edit/attribute_id/N/`,
  `/admin/catalog/product_set/edit/id/N/`).
- **The Configurations wizard modal's own DOM** — the catalog test shard drove the wizard
  end to end (BUG-109), but its controls were never set-diffed against the source's modal.
- **Everything else**: content, marketing, reviews, system, inventory and reports routes not
  named above — roughly 240 routes with no DOM-level comparison at all.

### Parity — two rounds stale

- **No round-4 parity audit ran at all.** Every parity statement in this file is
  last-verified round 3 unless a test shard re-confirmed it.
- The **22 routes added in round 4** (237 → 259 rows, including the eleven PARITY-019 bare
  paths) have **never been parity-swept** — no cold-load sweep, no `document.title` check,
  no h1 check against the source.
- The **67-title `document.title` sweep has not been re-run** since round 3. PARITY-018's fix
  is confirmed in code and on one route, not across all 95 `<title>`s in `assets/html/`.
- `ROUTES.md` and `TODO.md` are known-stale in at least three places (PARITY-023,
  PARITY-025, `TODO.md:24`); nobody has audited the rest of either document.
- **Task coverage was last measured in round 3** (0 of 184 blocked). It has not been
  re-measured against the round-4 code.

### Handlers

- The dimension's *negative* claims are machine-checked and strong (no dead affordance, no
  empty handler, no false success). What is **not** swept is **per-page control-set parity**:
  does each page render the same *set* of toolbar buttons and controls the source does?
  HANDLERS-035 and HANDLERS-036 were both found that way, from live probes of exactly two
  pages. That check has been run on a handful of pages, not systematically.
- The source's **modal-vs-navigation** behaviours (HANDLERS-038 is one instance) have not
  been surveyed.

### Pipeline

- Inject shapes beyond the three tested (virgin / full 43-key / one-key-one-row partial) —
  e.g. a partial carrying a key that does not exist in `createInitialData()`, or a malformed
  tree.
- Writer coverage was established **by grep, key by key** rather than by driving every
  writer; ~60 mutations were driven live out of a larger set.
- `SCHEMA.md` was rewritten in round 4 by the pipeline shard itself; it has not been checked
  by a second party.

---

## 8. Working notes for the next round

1. **Do not look for a P0 in the closed list.** §5 is the settled set. If you believe
   something there is wrong, produce new evidence — do not re-derive the old analysis.
2. **The DOM dimension is where a P0 will come from next**, because it is where every P0 has
   come from and because §7 shows how little of it has been looked at. A DOM sweep over the
   report control panels and the System Config section forms is the highest-value next audit.
3. **Fix P1-d and P1-e together** (NEW-DOM-202 / NEW-DOM-203) — they are the same country
   list failing in opposite directions on two pages.
4. **Two shards must not be double-assigned to one dimension.** Round 3 ran two pipeline
   shards concurrently (ports 5186/5187); their numbers agreed, which was a useful
   cross-check, but it cost a shard that parity needed — which is why parity is two rounds
   stale.
5. `AUDIT.part-dom.md` was mid-rewrite when this file was consolidated. Reconcile before
   relying on §3–§5's DOM entries.
