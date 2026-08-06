# webarena_shopping_admin_mock — Test Report (part: reports)

> Round: 12
> Date: 2026-08-06
> Mock: http://localhost:5193
> Source: http://localhost:7780/admin  (reachable: YES, logged in as `admin`)
> Shard: MARKETING + REPORTS + REVIEWS + NEWSLETTER (ROUTES.md rows 60–100, §12 grid rows 19–52)
> Tested by: playwright agent (test12-reports)

## Summary

> **ROUND 12 INCOMPLETE — halted by the operator mid-round.**
>
> **Written and measured:** Task 3 (newsletter selects driven by value — both fixes hold) and
> Task 4 (grid classification, 36/36 unchanged). Those results stand.
>
> **NOT RUN:** Task 1 (round-12 fix disposition), Task 2 (full task-answer re-run and legacy-grid
> per-page record-id sequences), Task 5 (route sweep + false-success hunt). Treat those as
> **NOT VERIFIED**, not as passing.
>
> Shard totals for the portion that ran: **P0 0 · P1 0 · P2 1** (`DIFF-R120`, records-count text
> on 2 of 36 grids). This is *not* a shard-clean verdict — it is a partial one. See `TEST.md` §6.

## Task 3 — Newsletter selects, driven by VALUE — ✅ BOTH FIXES HOLD

Both round-12 dev fixes are in this shard. Verified by reading the source's own
option list, then driving the mock **by value** with `select_option(value=…)`.

### 3a. Option `(value, label)` lists — byte-identical to the source

| route | select | source | mock | verdict |
|---|---|---|---|---|
| `/admin/newsletter/template/` | `select[name="type"]` | `('', '')`, `('2','html')`, `('1','text')` | identical, same order | ✅ |
| `/admin/newsletter/queue/` | `select[name="status"]` | `('', '')`, `('3','Sent')`, `('2','Cancelled')`, `('0','Not Sent')`, `('1','Sending')`, `('4','Paused')` | identical, same order | ✅ |

The round-11 defects are gone: the template `type` select no longer carries
`html`/`text` as *values*, and `Sent`/`Cancelled` are no longer swapped
(`Sent`=**3**, `Cancelled`=**2**, matching the source).

### 3b. Driven by value — 7 selections, 0 exceptions

Every source-side value selected on the mock in a fresh context, then `Search`
clicked, then the grid re-read:

| route | value | label | `select_option` | after Search: mock records | source records | select value round-trip |
|---|---|---|---|---|---|---|
| `newsletter/template/` | `2` | html | ✅ no exception | `0 records found` | `0 records found` | `2` ✅ |
| `newsletter/template/` | `1` | text | ✅ | `0 records found` | `0 records found` | `1` ✅ |
| `newsletter/queue/` | `3` | Sent | ✅ | `0 records found` | `0 records found` | `3` ✅ |
| `newsletter/queue/` | `2` | Cancelled | ✅ | `0 records found` | `0 records found` | `2` ✅ |
| `newsletter/queue/` | `0` | Not Sent | ✅ | `0 records found` | `0 records found` | `0` ✅ |
| `newsletter/queue/` | `1` | Sending | ✅ | `0 records found` | `0 records found` | `1` ✅ |
| `newsletter/queue/` | `4` | Paused | ✅ | `0 records found` | `0 records found` | `4` ✅ |

Rendered `<tbody>` rows identical on both sides for all 7 (both grids are
genuinely empty on the source, so every status filter legitimately yields
`0 records found`; the record **content** cannot discriminate the values here —
which is exactly why this was checked by value + round-trip and not by label).

The selected value also survives into the mock's URL as the base64 filter segment
and is re-applied to the control after the reload, e.g.
`…/newsletter/queue/index/filter/c3RhdHVzPTM%3D/?sid=r12sel` → `status=3`, and
`…/newsletter/template/index/filter/dHlwZT0y/?sid=r12sel` → `type=2`. `?sid=` kept
on all 14 loads.

**One cosmetic note (not a defect, not counted):** the source's own filter segment
for the template grid also carries the two date-picker locale keys
(`added_at[locale]=en_US&modified_at[locale]=en_US`) that the mock omits, and the
source appends `/form_key/<hash>/` — an explicitly-dropped source quirk.

## Task 4 — Grid classification, re-derived from both sides — ✅ 36 / 36 UNCHANGED

Discriminator applied identically to both sides in a real browser
(LEGACY = 2-row `<thead>` + `Search` + `Reset Filter`; MODERN = 1-row + keyword box /
Filters panel; PLAIN = legacy grid with no filter row).

| §12 # | route | source | mock | ROUTES.md | verdict |
|---|---|---|---|---|---|
| 19 | `/admin/sales_rule/promo_quote/` | LEGACY | LEGACY | LEGACY | ✅ |
| 20 | `/admin/catalog_rule/promo_catalog/` | LEGACY | LEGACY | LEGACY | ✅ |
| 21 | `/admin/review/product/index/` | LEGACY | LEGACY | LEGACY | ✅ |
| 22 | `/admin/review/product/pending/` | LEGACY | LEGACY | LEGACY | ✅ |
| 23 | `/admin/review/rating/` | LEGACY | LEGACY | LEGACY | ✅ |
| 24 | `/admin/search/term/` | LEGACY | LEGACY | LEGACY | ✅ |
| 25 | `/admin/search/term/report/` | LEGACY | LEGACY | LEGACY | ✅ |
| 26 | `/admin/search/synonyms/index/` | MODERN | MODERN | MODERN | ✅ (see DIFF-R120) |
| 27 | `/admin/admin/url_rewrite/index/` | MODERN | MODERN | MODERN | ✅ 1-row on both — not a defect |
| 28 | `/admin/newsletter/template/` | LEGACY | LEGACY | LEGACY | ✅ |
| 29 | `/admin/newsletter/queue/` | LEGACY | LEGACY | LEGACY | ✅ |
| 30 | `/admin/newsletter/subscriber/` | LEGACY | LEGACY | LEGACY | ✅ |
| 31 | `/admin/newsletter/problem/` | LEGACY | LEGACY | LEGACY | ✅ |
| 32 | `/admin/checkout/agreement/` | LEGACY | LEGACY | LEGACY | ✅ |
| 33 | `/admin/reports/report_sales/sales/` | PLAIN | PLAIN | PLAIN | ✅ |
| 34 | `/admin/reports/report_sales/tax/` | PLAIN | PLAIN | PLAIN | ✅ |
| 35 | `/admin/reports/report_sales/invoiced/` | PLAIN | PLAIN | PLAIN | ✅ |
| 36 | `/admin/reports/report_sales/shipping/` | PLAIN | PLAIN | PLAIN | ✅ |
| 37 | `/admin/reports/report_sales/refunded/` | PLAIN | PLAIN | PLAIN | ✅ |
| 38 | `/admin/reports/report_sales/coupons/` | PLAIN | PLAIN | PLAIN | ✅ |
| 39 | `/admin/reports/report_sales/bestsellers/` | PLAIN | PLAIN | PLAIN | ✅ |
| 40 | `/admin/reports/report_product/sold/` | PLAIN | PLAIN | PLAIN | ✅ |
| 41 | `/admin/reports/report_product/lowstock/` | LEGACY | LEGACY | LEGACY | ✅ |
| 42 | `/admin/reports/report_product/viewed/` | PLAIN | PLAIN | PLAIN | ✅ |
| 43 | `/admin/reports/report_product/downloads/` | LEGACY | LEGACY | LEGACY | ✅ |
| 44 | `/admin/reports/report_customer/orders/` | PLAIN | PLAIN | PLAIN | ✅ |
| 45 | `/admin/reports/report_customer/totals/` | PLAIN | PLAIN | PLAIN | ✅ |
| 46 | `/admin/reports/report_customer/accounts/` | PLAIN | PLAIN | PLAIN | ✅ |
| 47 | `/admin/reports/report_review/customer/` | LEGACY | LEGACY | LEGACY | ✅ |
| 48 | `/admin/reports/report_review/product/` | LEGACY | LEGACY | LEGACY | ✅ |
| 49 | `…/report_review/product/detail/id/14/` | LEGACY | LEGACY | LEGACY | ✅ |
| 50 | `/admin/reports/report_shopcart/product/` | PLAIN | PLAIN | PLAIN | ✅ |
| 51 | `/admin/reports/report_shopcart/abandoned/` | LEGACY | LEGACY | LEGACY | ✅ |
| 52 | `/admin/reports/report_statistics/` | PLAIN | PLAIN | PLAIN | ✅ |
| — | `/admin/analytics/reports/show/` | NOGRID | NOGRID | NOGRID | ✅ |
| — | `/admin/review/rating/edit/id/1/` | NOGRID | NOGRID | NOGRID | ✅ |

Records-count **text and class** also compared: 34/36 identical (`4 records found`,
`351 records found`, `2`, `5`, `7`, `8`, `13`, `66`, `127`, `225`, `0`, `Export to:`).
The two exceptions are DIFF-R120 below. `?sid=r12cls` survived all 36 cold deep
links; 0 uncaught page errors.

**Date-filter cells are NOT a mock defect.** The source's date-range filter cells
read `undefined undefined` in `innerText` (its calendar widget's button titles);
the mock's read empty. The **inputs are identical on both sides** —
`created_at[from]`, `created_at[to]`, `created_at[locale]`;
`from_date[from]/[to]/[locale]`; `to_date[…]` — so the filter is structurally
present and functional. Not reported.

---

**Tasks 1, 2 and 5 were never appended — round 12 was halted by the operator before they ran.**
They are recorded as NOT VERIFIED in `TEST.md` §6. Specifically missing from this shard:
the round-12 fix disposition, the full 41/41 task-answer re-run against the live source, the
legacy-grid per-page record-id sequences (`DIFF-R104`'s guard), and the false-success hunt.
