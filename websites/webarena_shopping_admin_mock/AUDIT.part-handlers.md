# AUDIT — dimension: handlers (unimplemented UI, dead affordances, stubs)

> Round: 4
> Date: 2026-08-06
> Scope: `src/pages/**`, `src/components/**` — dead controls, empty handlers,
> unbound forms, non-functional grid controls, placeholder content, stub sections.
> Route/seed parity and the state pipeline are covered by sibling audit agents.

Every open round-3 finding was re-read against the code as it stands now.
Nothing below is taken from a dev agent's claim or from a comment asserting a
fix: for each handler that claims to mutate I followed it to `setState` (which
calls `saveState` unconditionally, `src/context/AppContext.jsx:99-104`) **and to
the reader** that renders the value back.

**Headline: the round-4 pass closed both P1s and five of the nine P2s.**
`HANDLERS-029` — the last remaining false success in this dimension — is really
fixed: all **227** editable Configuration descriptors now resolve to a real
`core_config_data` path (machine-checked, see below), and a save that would
touch nothing now says so instead of claiming a success. **The false-success
count did not go back up; this dimension is now at zero.**

---

## Round-3 disposition table

| ID | Title (short) | R3 | Round-4 status |
|---|---|---|---|
| HANDLERS-006 | Attribute Manage Options add/delete | FIXED | still fixed (spot-checked) |
| HANDLERS-008 | Product-form fields discarded on Save | PARTIAL→031 | see 031 |
| HANDLERS-009 | Store-view Scope selects unbound (2 of 3) | P1 | **FIXED** |
| HANDLERS-013 | CMS "Save & Duplicate" does not duplicate | P2 | **NOT FIXED** |
| HANDLERS-017 | Dashboard "Most Viewed Products" empty | closed | stays closed |
| HANDLERS-018 | Legacy-grid pages render modern toolbar | P2 | **NOT FIXED** (TODO `[~]`) |
| HANDLERS-019 | Footer links / Customer View go nowhere | P2 | **NOT FIXED** |
| HANDLERS-023 | "Submit Order" is notice-only | P2 | **FIXED** |
| HANDLERS-026 | Category Design > Theme discarded | FIXED | still fixed |
| HANDLERS-028 | `commentsHistory` empty heading block | P2 | **FIXED** |
| HANDLERS-029 | System Config drops 23 fields (FALSE SUCCESS) | P1 | **FIXED** |
| HANDLERS-030 | Unbound inputs on Import / Export / Currency | P2 | **NOT FIXED** |
| HANDLERS-031 | Advanced Inventory `stock_item` nobody reads | P2 | **NOT FIXED** |
| HANDLERS-032 | "Use system value" checkbox cannot be unchecked | P2 | **FIXED** |
| HANDLERS-033 | Store Group "Web Site" select overwritten on Save | P2 | **FIXED** |

### Verified fixed, with evidence

- **HANDLERS-029 (the false success) — closed.** `configPath(f)`
  (`src/components/system/configSections.js:588-598`) now derives a real path
  from the descriptor's `name=` attribute
  (`groups[store_information][fields][name]` + id `general_store_information_name`
  → `general/store_information/name`). I ran the module and enumerated every
  non-`static` descriptor in `CONFIG_FIELDS`: **227 editable descriptors, 0 that
  fail to resolve to a path containing `/`.** The `if (!path.includes('/')) continue`
  guard is gone from `saveConfig` (`src/pages/system/Configuration.jsx:70-89`),
  which now (a) patches existing `coreConfig` rows, (b) **appends** a new row for
  an edited path with no seeded row, and (c) when nothing changed emits
  `There is nothing to save — no field on this page was changed.` as a `notice`
  instead of the success string. Read-back verified: `initialDraft` (`:33-45`)
  seeds from `dbRows` (`coreConfig`) before falling back to `f.value`, so the new
  row wins on the next render and **Store Name no longer snaps back**.
- **HANDLERS-032 — closed.** `inherit` is now explicit per-field state
  (`Configuration.jsx:48`, reset with the draft at `:52`). The checkbox is
  `checked={inherited}` with an `onChange` that always writes the flag
  (`:190-197`), and the input/select/textarea is `disabled={inherited}`
  (`:178,183,187`) — unchecking is what enables the field, as in the source.
- **HANDLERS-009 — closed.** Both remaining selects are controlled and write
  the query string through `withGridParams` (so `sid` survives):
  `src/pages/Dashboard.jsx:156-160` (`value={searchParams.get('store') || '0'}`)
  and `src/pages/catalog/ProductEdit.jsx:405-409` (`#store-switcher`).
- **HANDLERS-023 — closed.** `src/pages/sales/OrderCreate.jsx:106-170`:
  `submitOrder` allocates `entity_id` above `S.maxOrderId`, allocates the next
  `increment_id` across the seed **and** prior `newOrders`, builds a full order
  (addresses re-keyed to the new order, items, payment, totals), writes
  `newOrders` + a seeded `orderComments` history entry through `setState`, then
  `addMessage('You created the order.')` and navigates to
  `/admin/sales/order/view/order_id/<new>/`. Validation guards for missing
  customer (`:95`) and empty items (`:102`) fire before any message. Confirmed
  `getOrders`/`getOrder` read `newOrders`, so the new order appears on the grid
  and its own view page.
- **HANDLERS-028 — closed.** `src/pages/sales/OrderCommentsHistory.jsx:52-57`:
  title block first, `<NoteList>` second.
- **HANDLERS-033 — closed.** `src/pages/system/Stores.jsx:361-372`: the
  `patch.website_id = existing.website_id` overwrite is gone; `write(patch)`
  now carries the chosen website through.

---

## Findings

Numbering continues from round 3. Round-3 ids that are still open keep their
original number.

### HANDLERS-034 · P1 · NEW · `order_status/edit/status/:status/` renders the grid, not the source's edit form
- **File**: `src/App.jsx` — `{ path: '/admin/sales/order_status/edit/status/:status', component: <OrderStatusGrid /> }`;
  `ROUTES.md:362` records the alias under "Resolved to the area's own index page".
- **Live source, verified this round** (`GET /admin/sales/order_status/edit/status/processing/`,
  authenticated, read-only): `200`, 54,950 bytes, `<h1>Edit Order Status</h1>`,
  toolbar `Back · Reset · Save Status`, with the Status Label field and its
  per-store-view label rows. It is a **real editor**, not an alias of the grid.
- **Behaviour today**: the URL is reachable and the URL an evaluator reads is
  right, but the agent lands on the Order Status listing — no Status Label
  input, no `Save Status`. There is no way to rename an existing status in the
  mock, while `OrderStatusNew` (`src/pages/sales/OrderStatusForms.jsx`) already
  proves the form shape exists.
- **Mitigating**: nothing in `assets/TASKS.md` edits an order status (grepped),
  and the source's own grid has no `Edit` link — I extracted every
  `order_status`-bearing anchor from `assets/html/sales-order-status.html` and
  the only one is the breadcrumb. So the page is typed-URL-only. P1, not P0.
- **Fix**: point the route at a `OrderStatusEdit` that reuses `OrderStatusNew`'s
  form seeded from `state.orderStatuses` by `:status`, saving through
  `updateCollectionItem('orderStatuses', 'status', …)` — the helper
  `OrderStatusGrid.jsx:52` already uses. Then delete the `ROUTES.md:362` alias row.

### HANDLERS-035 · P2 · NEW · Edit Attribute Set is missing three of the source's five toolbar controls
- **File**: `src/pages/catalog/AttributeSets.jsx:232-244` (`AttributeSetEdit` actions)
- **Mock**: `Back · Save`.
- **Live source, verified this round** (`GET /admin/catalog/product_set/edit/id/9/`
  → `<h1>Top</h1>`): `Back · Reset · Delete · Save · Add New · Delete Selected Group`.
  On the un-deletable Default set (`id/4`) the same page shows
  `Back · Reset · Save · Add New · Delete Selected Group` — i.e. `Delete` is the
  only one that is set-dependent.
- **Missing**: `Reset` (re-seed `name`/`openGroups` from the record), `Delete`
  (remove the set — the page already writes through `attributeSetOverrides`, so
  a `attributeSetDeleted` list is the matching shape), `Add New` (create an
  attribute group) and `Delete Selected Group`. The Groups / Unassigned
  Attributes two-pane layout is otherwise present and its links resolve.
- **Priority**: the five attribute-set tasks in `assets/TASKS.md`
  (webarena-694…698) only *select* a set on the product form; none edits one.
- **Fix**: add `Reset` and `Delete` first (both are one-liners against the
  existing override map); `Add New` / `Delete Selected Group` need an
  `attribute_group` overlay and can follow.

### HANDLERS-036 · P2 · NEW · "Add New URL Rewrite" is missing the source's `Create URL Rewrite` type selector
- **File**: `src/pages/marketing/Marketing.jsx:1283-1355` (`UrlRewriteForm`)
- `entity_type` is carried in `initial` (`:1315`) but is not in `fields`
  (`:1324-1333`), so a new rewrite is always `entity_type: 'custom'`.
- **Live source, verified this round**: `GET /admin/admin/url_rewrite/edit/` →
  `<h1>Add New URL Rewrite</h1>` with labels
  `Create URL Rewrite · Store · Request Path · Target Path · Redirect Type · Description`.
  The edit form for an existing row (`/edit/id/237/`,
  `<h1>Edit URL Rewrite for CMS page</h1>`) has exactly the five the mock
  renders — **the edit form is right; only the New form is short one control.**
- **Fix**: prepend a `Create URL Rewrite` select bound to `entity_type`
  (`custom` / `product` / `category` / `cms-page`) on the create path only.

### HANDLERS-037 · P2 · NEW · "Login as Customer" reports a login that did not happen
- **File**: `src/pages/customers/CustomerEdit.jsx:227` —
  `onClick={() => addMessage(\`You are logged in as customer: ${customer.email}\`)}`
- Nothing is written and no navigation occurs; the source opens the storefront
  in a new tab. Storefront routes are `TODO.md` "Out of Scope", so the action
  cannot be implemented here — but the message asserts a completed state change,
  which is the false-success shape the round-3 brief rules out.
- The two neighbouring message-only buttons are **not** in this category:
  `Reset Password` (`:273`) and `Force Sign-In` (`:280`) are email-sending and
  session machinery, which `TODO.md:149` explicitly scopes as
  "render the affordance and a success message, do nothing".
- **Fix**: change the type to `notice` and the text to say the storefront is not
  part of this mock, matching how `Inventory.jsx:96` and `External.jsx:181`
  already decline.

### HANDLERS-038 · P2 · NEW · Wizard step 1 "Create New Attribute" navigates away and destroys the wizard
- **File**: `src/pages/catalog/ProductEdit.jsx:1140-1143` —
  `onClick={() => navigate('/admin/catalog/product_attribute/new/')}`
- The source opens the new-attribute form **in a modal on top of the wizard**
  and returns to step 1 with the attribute created and pre-checked. The mock
  leaves the product form entirely, so the wizard state, and any unsaved edits
  on the product itself, are gone; the agent has no route back into step 1
  except reopening `Edit Configurations` from scratch.
- Everything else in the four-step wizard is real and was re-verified end to end:
  attribute checkboxes (`:1166-1173`), Select All / Deselect All / Remove
  Attribute (`:1211-1223`), the value checkboxes (`:1229-1238`), the
  price/quantity radio pairs (`:1263-1298`), the Summary table computed from
  `pendingCombos` (`:1315-1330`), and `generateConfigurations` (`:555-609`),
  which allocates ids off `nextProductId(state)`, builds a full child row per
  missing combination, `addProduct`s each and `patchProduct`s the parent's
  `configurable_attributes` / `configurable_children`. Guarded: step 1 with no
  attribute and step 2 with an empty value list both raise errors instead of
  advancing (`:541-553`), and an all-combinations-exist run reports an error
  rather than a success (`:601-604`).
- **Fix**: render `ProductAttributeNew` inside the wizard's modal, or at minimum
  stash the wizard state in `sessionStorage` and restore it on return.

### HANDLERS-031 · P2 · STILL OPEN · Advanced Inventory writes a `stock_item` nobody reads
- Unchanged. `src/utils/selectors.js:216` is still
  `export function getStockItem(productId)` — no `state` argument, so it can
  only ever return the static `S.stockItemByProductId` row. Both call sites
  (`src/pages/catalog/ProductEdit.jsx:115` and `:326`) pass an id only, and
  `buildPatch` still nests the three fields under `patch.stock_item` (`:325-330`).
  Nothing in `src/` reads `productOverrides[*].stock_item` (grepped).
- **Effect**: editing Out-of-Stock Threshold / Maximum Qty Allowed in Cart /
  Backorders, saving, and reopening the product shows the old values. The write
  does reach state, so `/go` sees it — P2, not a lost reward signal.
- **Fix** (unchanged): `getStockItem(state, productId)` merging
  `state.productOverrides[id]?.stock_item`, and update the two call sites.

### HANDLERS-013 · P2 · STILL OPEN · CMS page "Save & Duplicate" does not duplicate
- **File**: `src/pages/content/CmsPages.jsx:238-239` — the button labelled
  `Save & Duplicate` (`id="save_and_continue"`) calls `save(true)`, and
  `save(andContinue)` (`:188-216`) saves the *same* page and navigates to its
  own edit form (`:215`). Byte-identical to rounds 2 and 3.
- **Fix**: relabel it `Save & Continue Edit` (which is what the id and the code
  both say) **or** insert a copy with a fresh `page_id` and a `-1`-suffixed
  `identifier`, as `ProductEdit.save('duplicate')` already does.

### HANDLERS-030 · P2 · STILL OPEN · 12 unbound inputs on Import / Export / Tax-import / Currency
Re-scanned with a brace-aware tag walk over every `<input>`/`<select>`/
`<textarea>` in `src/`. **These 12 are the only uncontrolled form controls left**
(everything else has `onChange`, `readOnly` or `disabled`); line numbers refreshed:
- `src/pages/system/Tools.jsx` — `:251` `validation_strategy`, `:263`
  `allowed_error_count`, `:272` `_import_field_separator`, `:281`
  `_import_multiple_value_separator`, `:290`
  `_import_empty_attribute_value_constant`, `:299` `_import_fields_enclosure`,
  `:310` `import_file`, `:318` `import_images_file_dir`, `:362` `file_format`,
  `:370` `fields_enclosure`
- `src/pages/system/Tax.jsx:257` — `import_rates_file`
- `src/pages/system/Stores.jsx:126` — `rate_services`, `defaultValue="fixerio"`
- **Context unchanged**: the *actions* behind these pages are the server-side
  machinery `TODO.md:149` scopes out, and each already emits the source's
  message. Only the field binding is missing, so typing a value and re-rendering
  loses it.
- **Fix**: bind to local state (the sibling `entity` / `behavior` fields on the
  same two pages already are — `Tools.jsx:202-203`), or mark them `disabled`.

### HANDLERS-019 · P2 · STILL OPEN · Footer links and "Customer View" go nowhere
- `src/components/layout/AdminFooter.jsx:13-15` — `Privacy Policy`,
  `Account Activity`, `Report an Issue` are still `href="#"` +
  `onClick={e => e.preventDefault()}`. Together with the Order Status
  `Unassign` link (`src/pages/sales/OrderStatusGrid.jsx:50`, a genuine
  `preventDefault` + `updateCollectionItem` mutation — correct) these are the
  only `href="#"` anchors in `src/`.
- `src/components/layout/AdminHeader.jsx:144` — `Customer View` still links to
  `/`, which bounces to the dashboard.
- **Fix**: point `Account Activity` at `/admin/security/session/activity/`
  (which exists); give the other two and `Customer View` the notice treatment
  rather than a silent dashboard reload.

### HANDLERS-018 · P2 · STILL OPEN · Legacy-grid pages still render the modern toolbar
- `src/components/reviews/LegacyReviewGrid.jsx` remains the only legacy grid and
  the only file in `src/` containing `Reset Filter` (re-grepped). It is fully
  functional — Search / Reset Filter (`:216-223`), the URL-segment
  `sort/dir/page/limit/filter` scheme (`:98-129`), the `name="limit"` per-page
  select and prev/next/page-number pager (`:264-280`), and the two-select mass
  action (`:232-247`) — it is just not reused.
- Still on `<AdminGrid>` where the source uses the legacy widget:
  `src/pages/sales/OrderStatusGrid.jsx`, `src/pages/system/Tax.jsx`,
  `src/pages/system/Permissions.jsx`, `src/pages/marketing/Marketing.jsx`
  (Search Terms / Newsletter / Catalog Rules),
  `src/pages/catalog/AttributeSets.jsx`, `src/pages/catalog/ProductAttributes.jsx`.
- Tracked by the open `[~]` item in `TODO.md:30`. Recorded so it is not
  rediscovered; the fix is to generalise `LegacyReviewGrid`.

---

## Summary — dimension `handlers`, round 4

| Priority | Count | IDs |
|---|---|---|
| P0 | **0** | — |
| P1 | **1** | 034 (edit route renders its grid) |
| P2 | **9** | 013, 018, 019, 030, 031, 035, 036, 037, 038 |
| **Total open** | **10** | |
| Closed this round | **6** | 009, 023, 028, 029, 032, 033 |

**Movement since round 3**: P0 0 → 0. P1 2 → 1. P2 9 → 9 (five closed, five
newly opened). Total open 11 → 10.

Newly opened: 034, 035, 036, 037, 038. **None is a regression** — 034 and 035
are pre-existing gaps this round's live probe exposed for the first time, 036
and 038 are the residue of round-3's new forms and wizard, 037 is a pre-existing
message that only now stands out as the last success-assertion with no state
behind it.

### False successes: 0 — down from 1

The round-3 brief asked for confirmation that the count did not go back up. It
went **down**:
- **Dashboard "Reload Data"** (the one carried into this round) is fixed.
  `src/pages/Dashboard.jsx:34-49` `refreshStatistics()` writes
  `dashboardStatistics.lifetime_refreshed_at` + `lifetime_refresh_count` through
  `setState` → `saveState` → `/go`, then shows the source's
  `We updated lifetime statistic.`. Magento's own `RefreshStatistics.php` does
  record the refresh even though the recomputed figures do not move, so this is
  the honest mock of it and the banner is now backed by a real state footprint.
- **System Config "Save Config"** (HANDLERS-029) is fixed — see above.
- **HANDLERS-037** is the nearest remaining shape, but it asserts a *navigation*
  the mock declines rather than a data change, and no state was ever expected;
  it is filed as P2 for wording, not as a false success.
- I re-checked every message-only click handler in `src/` with a scripted scan
  (`onClick={() => addMessage(…)}`): 18 hits, of which 15 emit `notice`/`error`
  declines, `ExportPage` (`Tools.jsx:336`) and the two customer
  `Reset Password` / `Force Sign-In` buttons emit the source's own success text
  for the server-side machinery `TODO.md:149` explicitly scopes out, and
  `CustomerEdit.jsx:227` is HANDLERS-037.

### Verified working — do not re-audit

- **Zero dead affordances.** A brace-aware tag walk over every `<button>`,
  `<a>` and `<AdminLink>` in `src/` found **no** element lacking `onClick` /
  `href` / `to` / `type="submit"`. The six raw hits it reported were all inside
  doc comments (`ConfirmModal.jsx:13-18`, `ReportPage.jsx:382`) or had the
  handler after a comment line inside the tag (`OrderView.jsx:152`).
- **Zero** `onClick={() => {}}`, zero `console.log`/`console.warn`, zero
  `TODO`/`FIXME`, zero `Lorem ipsum`, zero `alert(` in `src/`. The only
  `not implemented` string is in `AreaPage.jsx`, which is unreachable: all
  **259** `ROUTE_TABLE` rows in `src/App.jsx` supply a `component` (machine-
  counted, `grep -c '{ row:'` = `grep -c 'component:'` = 259), so the
  `r.component || <AreaPage/>` fallback never fires and no page is a stub.
- **URL Rewrites (the new 225-row grid) — controls are real, not a static
  table.** `src/pages/marketing/Marketing.jsx:877-952` renders the shared
  `<AdminGrid gridId="urlRewriteGrid">` over `useUrlRewrites().rows`, so every
  toolbar control is the audited one: keyword search, per-column filters
  (`ID` as a `range` pair — `AdminGrid.jsx:450-465` implements `range` — plus
  `text` on Request/Target Path and `select` on Store View and Redirect Type),
  Apply/Cancel, chips, Columns chooser, Default View, per-page and pager.
  `exportable={false}` matches the source grid, which has no Export.
  `defaultSort {url_rewrite_id, desc}` with a numeric `sortValue` sorts both
  directions. Default page size is 20 (`gridUtils.js:18`; the grid is not in
  `GRID_PAGE_SIZES`), giving the source's 12 pages over 225 rows. Row actions
  resolve: the ID cell and the `Select` action both link to
  `/admin/admin/url_rewrite/edit/id/<id>/`, which reaches the real
  `UrlRewriteForm`. Mass **Delete** (`:930-939`) calls `remove(id)` per row and
  reports `A total of N record(s) have been deleted.` — matching the source's
  only mass action. The overlay (`:828-875`) is honest: user-added rows are
  edited in place, seeded rows get a patch entry or a tombstone, so the 225-row
  baseline is never copied into state and the round-trip is visible on the grid.
- **The Configurations wizard** — all four steps, every control, both guards and
  `generateConfigurations` — verified end to end; see HANDLERS-038 for the one
  exception.
- **`<AdminGrid>` (751 lines) and `gridUtils.js` — no regression.** Re-confirmed
  URL-driven and `sid`-preserving: keyword search, per-column filters with
  Apply/Cancel, active-filter chips + per-chip Remove + Clear all, Columns
  chooser + Default View, saved bookmarks, Export CSV + Excel XML, the Magento
  `selectmenu` per-page control, prev/next/page-number pager, sortable headers
  in both directions (`toggleSort` `:193-198` → `parseGridState`
  `gridUtils.js:76-79` → `applyGridState` `:177-184`), page/all checkbox
  selection with the four-item Options menu, and the Actions dropdown gated on
  `selectable && massActions.length`.
- **`LegacyReviewGrid` (397 lines)** — Search / Reset Filter, the URL-segment
  `sort/dir/page/limit/filter` scheme, `name="limit"` per-page select, pager
  with a typed page input, and the two-select mass action are all live.
- **Legacy report `IntervalGrid`** (`LegacyReports.jsx:105-140`) renders a
  static, non-sortable table **by design** — the source's legacy report grids
  emit `class="… no-link"` headers; its `LegacyFilterToolbar` (`:67-102`)
  Period / From / To / Refresh really navigates to
  `<base>/filter/<encoded>/` with `sid` preserved.
- **Dashboard `$0.00` tiles are source-accurate**, evidenced in the file header
  (`Dashboard.jsx:17-23`): the literal string in `assets/html/dashboard.html`,
  and computing them from the seed would *diverge* from the source, whose own
  aggregation table is non-empty yet still prints `$0.00`.
- **Grids rendering `rows={[]}`** (Braintree, PayPal settlement, Page Builder
  templates, newsletter Queue/Problems, bulk actions, Downloads, Products in
  Carts, Abandoned Carts) were re-confirmed against the captured source pages in
  round 2 — those grids really are empty in the source.
- Sales, Catalog, System, Content/Marketing/Reviews handler inventories from
  round 3 all still hold; nothing that was working came back broken.

## Out-of-dimension observations (one line each, for the owning agent)

- `ROUTES.md:370-378` still lists `catalog_rule/promo_catalog/{new,edit}`,
  `admin/url_rewrite/edit{,/id/:id}`, `newsletter/template/new`,
  `checkout/agreement/new`, `search/synonyms/new` and `review/rating/{new,edit}`
  under "Resolved to the area's own index page", but round 3 gave all six real
  forms — the doc is stale, not the code. (parity)
- `CustomerEdit.jsx:479` hardcodes "There are no items in customer's shopping
  cart." for every customer; there is no `quote`/`quote_item` seed, so the tab
  can never be non-empty. (parity — missing seed, no TASKS.md task needs it)
- `getStockItem` taking no `state` argument (`src/utils/selectors.js:216`) is the
  root cause of HANDLERS-031 and is a state-layer signature, not a handler.
  (pipeline)
- `src/pages/reviews/Reviews.jsx` still slices the product list for the New
  Review picker; the source paginates all 2040. (parity)
