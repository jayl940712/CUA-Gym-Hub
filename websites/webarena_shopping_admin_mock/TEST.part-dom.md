# TEST — Evaluator DOM-Locator Verification (`TEST.part-dom.md`)

> Round: **12** · Date: 2026-08-06
> Mock: **http://localhost:5191** · Source: **http://localhost:7780/admin** (reachable: **YES**, logged in as `admin`). **READ-ONLY.**
> Dimension: **DOM / selector fidelity + selector-driven interaction.** No styling findings.
> Method: byte-for-byte the rounds 8–11 method. `/tmp/pw-dom12/` is a clone of `/tmp/pw-dom11/`
> with the sid changed to `parity_dom12`; same URL set (232 paths), same extractor, same differ, so
> per-class numbers are directly comparable round-over-round.

> **Read-only disclosure.** The source was navigated and read. Two source-side grid *filters* were
> exercised (`newsletter/template` `type`, `newsletter/queue` `status`) — filter state only, no
> record was created, edited or deleted. Nothing was submitted on the source.

**STATUS: (filled in at §6)**

---

## 1 · Task 1 — F-01c / F-01d: verified by driving them by VALUE — **BOTH FIXED**

Scripts `/tmp/pw-dom12/t1.py`, `t1b.py`, `t1c.py`; raw `/tmp/pw-dom12/t1.json`, `t1c.json`.
Both sides driven, not just read.

### 1.1 · F-01c · `/admin/newsletter/template/` `select[name="type"]` — **FIXED ✅**

| check | result |
|---|---|
| source option list | `[['', ''], ['2', 'html'], ['1', 'text']]` |
| mock option list | `[['', ''], ['2', 'html'], ['1', 'text']]` |
| **identical (value + label + order)** | **YES — element-for-element** |
| `page.select_option('[name="type"]', '2')` on the mock | **no exception** |
| `select.value` immediately after | `"2"` (accepted, did not revert) |
| effect — filter applied, URL written | `…/newsletter/template/index/filter/dHlwZT0y/?sid=…` → base64-decodes to **`type=2`** |
| `select_option(value='1')` (`text`) | no exception → `filter/dHlwZT0x/` = `type=1` |
| source, same call `select_option('[name="type"]','2')` | **no exception**, value `2`, source URL also carries a `filter/` blob |
| console / page errors during the pass | **0** |
| `?sid=` after the filter navigation | **preserved** |

The value the evaluator sends is now the value Magento sends. Round 11's `html`/`text` literals
are gone.

### 1.2 · F-01d · `/admin/newsletter/queue/` `select[name="status"]` — **FIXED ✅** (verified by value, not by label)

| check | result |
|---|---|
| source option list | `[['',''], ['3','Sent'], ['2','Cancelled'], ['0','Not Sent'], ['1','Sending'], ['4','Paused']]` |
| mock option list | `[['',''], ['3','Sent'], ['2','Cancelled'], ['0','Not Sent'], ['1','Sending'], ['4','Paused']]` |
| **identical** | **YES** — the swap is gone: `Sent` is **3**, `Cancelled` is **2**, matching the source |
| `select_option('[name="status"]', '3')` → mock URL | `filter/c3RhdHVzPTM%3D/` → base64 `status=3` — i.e. **Sent**, the source's meaning |
| `select_option('[name="status"]', '2')` → mock URL | `filter/c3RhdHVzPTI%3D/` → `status=2` — **Cancelled** |
| all five statuses driven by value (`3,2,0,1,4`) | no exception on any; each round-trips into the URL as its own numeric id and the select re-reads back the same value |
| console / page errors | **0** across all five |
| `?sid=` | preserved on every filter navigation |

**Row-level check, and an honest limitation.** The instruction was to confirm the grid shows the
Sent records and not the Cancelled ones. Driven on both sides:

| | source | mock |
|---|---|---|
| `/admin/newsletter/queue/` unfiltered | `0 records found` — *"We couldn't find any records."* | `0 records found` — same string |
| after `status = 3` (Sent) | `0 records found` | `0 records found` |
| after `status = 2` (Cancelled) | `0 records found` | `0 records found` |

**The live source's newsletter queue is genuinely empty** (as is the newsletter template grid:
`0 records found` / *"No Templates Found"* on both sides). So no row set exists on either side to
disagree about, and a row-content assertion is vacuous here — that is *parity*, not a gap. What
**is** now provable, and is what the bug was about, is that the id the evaluator selects (`3`)
carries the source's meaning (Sent) all the way into the mock's filter state, instead of silently
meaning Cancelled. Verified through the base64 filter payload in the URL, which is the mock's
observable filter state, for all five status ids.

**Verdict: F-01c and F-01d are both closed. Class (b) real defects: 2 → 0.**

## 2 · Task 2 — independent app-wide `<select>` option-value sweep

Re-derived from scratch, not from the dev's enumeration. **232 routes crawled on BOTH sides,
0 load failures on either side** (`/tmp/pw-dom12/src.{0,1,2}.json`, `mock.{0,1,2}.json`;
78+77+77 = 232 each). Every `<select>` on every page was captured with its full ordered
`(value, label)` array; differ `/tmp/pw-dom12/selsweep.py`, raw `/tmp/pw-dom12/selsweep.json`.

### 2.1 · Totals

| measure | count |
|---|---|
| `<select>` instances captured, source | 1814 |
| `<select>` instances captured, mock | 538 |
| instances matched by `name` on both sides | **485** |
| matched instances whose option array differs in **any** way | **20** |
| …of which are real option-value defects | **0** |
| selects present on one side only (name sets differ) | 1329 src-only / 53 mock-only |
| **NEW class-(b) defects found via the name-set comparison** | **8** (§2.3) |

### 2.2 · The 20 matched-instance differences, classified

| class | rows | defect? |
|---|---|---|
| `*_export` selects whose values differ **only** by host (`http://10.186.197.203:7780/…` → `http://localhost:5191/…`) | **13** | **NO** — settled rounds 8–11, explicitly out of scope this round |
| `*_export` selects where the mock also drops the source's grid-state path suffix (`/store/1/`, `/sort/qty/dir/asc/limit/50/`, `/detail/id/`) | **5** | **P2**, carried (round-11 F-05) |
| `/admin/catalog/product_attribute/edit/attribute_id/new/` `is_global`, `is_required` | **2** | **NOT a defect — refuted round 11.** The source 302s that URL to the attribute **grid**, so the differ matches a grid column filter against a form field. Not re-filed. |
| values differ / reordered / trimmed / invented on a matched select | **0** | — |

**Zero matched selects show fabricated, reordered or trimmed values.** F-01a–f are all closed;
no select anywhere looks computed from seed rows.

### 2.3 · The blind spot round 11 had — and 8 real defects it hides

Matching selects **by `name`** cannot see a select whose `name` itself drifted: the source's
element lands in "src-only" and the mock's in "mock-only", and the option arrays are never
compared. I re-ran the comparison as a **per-page select-set** comparison instead
(`/tmp/pw-dom12/t2b.py`, `t2c.py`; raw `t2b.json`, `t2c.json`), driving both sides with the
filter panel expanded and 4 s settle on the source so Knockout-rendered filters exist in the DOM.

That removes the false positives (customer-listing, inventory-source, design-config grid filters
etc. are just lazily rendered on the source and match once expanded) and leaves **8 pages where
the mock renders a select the source does not have at that name — 4 of them with the exact
"friendly value" signature this round is about.**

| # | route | source select | mock select | value drift | pri |
|---|---|---|---|---|---|
| D-01 | `/admin/admin/widget_instance/new/` | `theme_id` = `['','-- Please Select --'],['1','Magento Blank'],['3','Magento Luma']` | `theme` = `['Magento Luma','Magento Luma'],['Magento Blank','Magento Blank']` | **value == label; source uses numeric theme ids** | **P1** |
| D-01b | same route | `code` = `['','-- Please Select --'],['cms_page_link',…],['cms_static_block',…]` | `type` = `['Magento\\Cms\\Block\\Widget\\Page\\Link',…]` | mock uses PHP FQCNs; source uses short codes; blank sentinel absent | **P1** |
| D-02 | `/admin/admin/system_design/new/` | `design[design]` = `['','-- Please Select --'],['1','Magento Blank'],['3','Magento Luma']` | `design` = `['Magento/luma','Magento Luma'],['Magento/blank','Magento Blank']` | **theme *path* strings where the source uses numeric ids**; also name drift and order reversed | **P1** |
| D-02b | same route | `design[store_id]` = `['1','Default Store View']` | `store_id` (same options) | name drift only | P2 |
| D-03 | `/admin/search/synonyms/new/` | `scope_id` = `['0:0','All Websites'],['1:0','All Store Views'],['1:1','Default Store View']` | `scope` = `['all','All Websites'],['website_1','Main Website'],['store_1','Default Store View']` | **invented `all`/`website_1`/`store_1` values AND a changed middle label** (`All Store Views` → `Main Website`) | **P1** |
| D-04 | `/admin/checkout/agreement/new/` | `stores[]` = `['0','All Store Views'],['1','Default Store View']` | `store_id` = `['1','Default Store View']` | name drift **+ the `0 / All Store Views` option is trimmed** | **P1** |
| D-05 | `/admin/customer/group/new/`, `/edit/id/1/` | `tax_class` = `['3','Retail Customer']` | `tax_class_id` = same options | name drift only (values correct) | P2 |
| D-06 | `/admin/review/rating/new/`, `/edit/id/1/` | `stores[]` = `['1','Default Store View']` | `visibility` = same options | name drift only | P2 |
| D-07 | `/admin/theme/design_config/edit/scope/*` (4 routes) | `theme_theme_id` = `['','-- No Theme --'],['1','Magento Blank'],['3','Magento Luma']` | `theme_id` = `['',''],['','-- No Theme --'],['1',…],['3',…]` | name drift **+ an extra duplicate `value=""` option prepended**, so `select_option(value='')` is ambiguous | P2 |
| D-08 | `/admin/admin/user/edit/user_id/1/`, `/new/` | *(no such select — Magento renders the role as a grid of radios, and no `is_active` select on this page)* | `is_active` = `['1','Active'],['0','Inactive']`, `user_role` = `['1','Administrators']` | mock **invents** two selects | P2 |

Three further per-page set differences that are **completeness**, not value drift, reported for
the record:

- `/admin/catalog/product_attribute/new/` — source renders **24** selects, mock **7**; 14 named
  storefront-property selects are absent on the mock (`is_searchable`, `is_filterable`,
  `is_filterable_in_search`, `is_visible_on_front`, `is_visible_in_advanced_search`,
  `is_comparable`, `is_html_allowed_on_front`, `is_used_for_promo_rules`, `used_for_sort_by`,
  `used_in_product_listing`, `search_weight`, `default_value_yesno`,
  `update_product_preview_image`, `use_product_image_for_swatch`). I clicked every tab-like
  affordance on the mock first (`.admin__page-nav-item a`, collapsibles, `.data-tab-item a`) —
  **0 clickable tabs found and the count did not change**, so this is not lazy rendering. **P2**
  (no `assets/TASKS.md` task creates a product *attribute*; tasks 694–698 create *products*).
- `/admin/customer/group/*` — source also has `customer_group_excluded_websites[]`, mock has none. P2.
- `/admin/catalog/product/edit/id/1/` — source's attribute-set control is `select[name="attribute-set-name"]`,
  the mock's is `select[name="product[attribute_set_id]"]` (option **values identical**, order
  differs: source DB order `4,9,10,11,…`, mock alphabetical by label `15,10,4,14,…`); the mock
  additionally renders `product[categories]`, which the source does not emit as a `<select>`.
  Relevant to tasks **694–698** ("Use attribute set top/bottom/gear"), which is why it is called
  out, but those tasks are scored on final state rather than on this selector → **P2**.

**Signature check the orchestrator asked for** — every mock option value in the app was scanned
for "friendly" strings where Magento uses ids. Hits: `Magento Luma`/`Magento Blank` (D-01),
`Magento/luma`/`Magento/blank` (D-02), `all`/`website_1`/`store_1` (D-03). `html`/`text`,
`active`, `enabled` as *values*: **none left anywhere** — `newsletter/template` now uses `2`/`1`,
`inventory/source` uses `1`/`0`, `checkout/agreement` `is_active` uses `1`/`0`, all matching the
source. The remaining non-numeric values that are **correct** (verified equal to the source):
`frontend_input` (`text`, `textarea`, …), `frontend_class` (`validate-number`, …),
`simple_action` (`by_percent`, …), and the country/locale codes.

## 3 · Task 3 — defect-class sweep, round 11 → round 12

Same extractor, same differ, same URL set as rounds 8–11, so the numbers are directly comparable.
Comparable set = **178 unique pages** (158 primary + 20 form sub-routes); extension set = **54**
pages, reported separately in §3.1. **0 load failures on either side, both sets.**

| defect class | round-11 | **round-12** | remaining instances (named, with route) |
|---|---|---|---|
| **(a) element-kind drift** | 0 | **0 — HELD ✅** | **none.** 0 rows over the 178 comparable pages and 0 over the 54 extension pages. The dev's option-value pass touched page and component files app-wide and the class did not reappear. |
| **(b) option lists — values / order / trimming** | 2 real (F-01c, F-01d) | **F-01c and F-01d both FIXED ✅ · 0 on matched selects · 8 NEW found by set comparison ❌** | Matched-by-name selects: **0 real** (20 diff rows = 13 export host rewrites + 5 P2 path-suffix + 2 refuted phantoms). New: **D-01, D-01b, D-02, D-03, D-04 are P1**; D-02b, D-05, D-06, D-07, D-08 are P2. See §2.3 — these were invisible to the round 8–11 differ because the `name` drifted too. |
| **(c) duplicate `name` (strict-mode)** | 0 | **0 — HELD ✅** | **none** on the 178 comparable pages. The extension set's 4 rows are `ratings[1..4]` on `/admin/review/product/jsonProductInfo/id/1/`, which the source serves as **JSON** (no DOM to compare) — vacuous, settled round 10, not a defect. |
| **(d) missing button `id` / `data-ui-id`** | 34 ids / 10 pp · 62 dui / 28 pp · 13 pp at zero | **45 ids / 9 pp · 62 dui / 28 pp · 11 pp at zero** | **P2, still open, essentially flat.** `data-ui-id` totals unchanged; missing `id` count rose 34→45 concentrated on fewer pages (9). Pages rendering **zero** `data-ui-id` improved 13→11. Composition in §3.2. |
| **(e) checkbox with no `value`** | 0 / 287 boxes | **0 / 202 boxes — HELD ✅** | **none.** Absolute mock-side measure of every `input[type=checkbox]` on the comparable pages; also 0/9 on the extension set. (Box count is lower than round 11 because this round's crawl landed on unfiltered grid defaults with fewer selectable rows in view — the *defect* count is the measure, and it is zero.) |
| **(f) `disabled`/`readonly` where the source is enabled** | 0 (F-04 closed) | **0 — HELD ✅** | **none**, over all 232 routes, comparing the `disabled`/`readonly` **attributes** on visible+enabled source controls against their mock counterparts. F-04 stays closed. |

**Direct answer to the completion question:** classes **(a), (c), (e) and (f) are genuinely zero**
— not "zero within a subset", but zero over every matched control on all 232 routes, measured
this round with a from-scratch crawl. Class **(b)'s previously-reported instances are closed**;
what is left in (b) is a set of defects the earlier method structurally could not see, now
enumerated in §2.3.

### 3.1 · Extension set (54 routes)

| class | round-12 | note |
|---|---|---|
| (a) kind drift | **0** | held |
| (b) option rows | 6 | 1 host rewrite + 4 path-suffix P2 + 1 refuted; real defects **0** |
| (c) duplicate `name` | 4 | all `ratings[1..4]` on the JSON endpoint — not a defect |
| (e) checkbox no `value` | **0** / 9 boxes | held |
| (f) disabled/readonly | **0** | held |

### 3.2 · Class (d) detail — 11 pages render zero `data-ui-id`

```
/admin/admin/system_store/editWebsite/website_id/1/   /admin/admin/user_role/editrole/rid/1/
/admin/catalog/product_attribute/new/                 /admin/cms/block/edit/block_id/1/
/admin/newsletter/problem/                            /admin/newsletter/queue/
/admin/newsletter/subscriber/                         /admin/paypal/billing_agreement/
/admin/reports/report_shopcart/product/               /admin/sales/transactions/
/admin/tax/rate/edit/rate/1/
```

Composition shifted again (four of round 11's pages dropped off, two joined). Unchanged in
character: **P2**, still not closed, no evaluator in `assets/TASKS.md` selects on `data-ui-id`.

## 4 · Task 4 — throw tests + shared-grid regression

**NOT RUN — round 12 was halted by the operator before this section was measured.** Treat as NOT VERIFIED, not as passing. See `TEST.md` §6.

## 5 · Findings

**NOT RUN — round 12 was halted by the operator before this section was measured.** Treat as NOT VERIFIED, not as passing. See `TEST.md` §6.

## 6 · Summary

**NOT RUN — round 12 was halted by the operator before this section was measured.** Treat as NOT VERIFIED, not as passing. See `TEST.md` §6.
