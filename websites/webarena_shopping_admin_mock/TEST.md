# webarena_shopping_admin_mock — Consolidated Test Report

> **Round: 12 (INTERRUPTED)** · Date: 2026-08-06
> Source: `http://localhost:7780/admin` (reachable, `admin`/`admin1234`, **strictly read-only** —
> no shard mutated source state)
> Consolidated by: orchestrator, **by hand**, after the round was halted by the operator
> partway through the test sweep.
>
> **New here? Read [`STATUS.md`](STATUS.md) first** — it is the handoff entry point and covers
> settled questions, operational gotchas, and how to resume.

**Read this header before the numbers.** Round 12 was stopped by the operator while its three
test shards were still running. This file is therefore a consolidation of **partial** evidence.
Every figure below is something a shard actually measured and wrote to disk; nothing here is
inferred from an unfinished section. What was *not* measured is listed explicitly in §6 and is
counted as **NOT VERIFIED**, never as passing.

This replaces the round-11 consolidation, which was stale in the opposite direction: it recorded
rows 60–100 as unverified because the reports shard was mid-write, and that shard then finished
clean.

---

## 1 · VERDICT

**Not a PASS, and not yet decidable.** Two of the four completion criteria are met on the
evidence on disk; one is failed; one cannot be evaluated because the work that would have
evaluated it did not run.

| Criterion | Status | Evidence on disk |
|---|---|---|
| **Zero P0** | ✅ **MET** | No shard reports a P0. 118/118 cold URLs pass in the func shard (0 white screens, 0 NotFound/AreaPage fallbacks, 0 sid losses, 0 console errors, 0 external requests, 0 broken images); 36/36 grid routes cold-load in the reports shard; 232 routes swept both sides in the DOM shard with 0 load failures. |
| **Zero P1 functional** | ❌ **NOT MET** | **5 P1s**, all found this round by a *new* measurement method: `D-01`, `D-01b`, `D-02`, `D-03`, `D-04`. See §3. |
| **Zero P0/P1 source-vs-mock differences** | ❌ **NOT MET** | The same five are themselves source-vs-mock differences, each measured on both sides in one run. |
| **All ROUTES.md rows verified** | ⚠️ **PARTIAL** | Cold-load parity is verified for every row (118 func + 36 reports + 232 DOM URLs). But the false-success hunt, pipeline invariants, task-answer re-run and legacy-grid id sequences did **not** run — see §6. |

**Recommendation: one more round.** The gap is small and fully enumerated, but it is real.

---

## 2 · What round 12 confirmed

**The two P1s that went into the round are fixed**, verified independently by two shards, and
verified *by value* rather than by label — which is the whole point, since the labels were always
correct.

| Finding | Route | Was | Now | Verified by |
|---|---|---|---|---|
| `F-01c` | `/admin/newsletter/template/` `select[name="type"]` | values `html`/`text`; `select_option(value="2")` **raised** | `('','')`, `('2','html')`, `('1','text')` — identical to source, same order | reports + dom shards |
| `F-01d` | `/admin/newsletter/queue/` `select[name="status"]` | `Sent`/`Cancelled` **swapped** — silently filtered the wrong status | `Sent`=**3**, `Cancelled`=**2**, matching source | reports + dom shards |

7 source-side values driven on the mock with `select_option(value=…)`: **0 exceptions**, value
round-trips into the base64 filter segment and is re-applied after reload, `?sid=` kept on all 14
loads.

**Four defect classes are genuinely zero**, measured from-scratch over all 232 routes — not zero
within a subset:

| defect class | round-11 | round-12 |
|---|---|---|
| (a) element-kind drift | 0 | **0 — HELD** |
| (c) duplicate `name` (Playwright strict-mode) | 0 | **0 — HELD** |
| (e) checkbox with no explicit `value` | 0 | **0 — HELD** (202 boxes) |
| (f) `disabled`/`readonly` where source is enabled | 0 | **0 — HELD** (F-04 stays closed) |

**Grid classification holds at 36/36** — every grid route classifies identically (LEGACY / MODERN /
PLAIN) on both sides, with records-count text and class matching on 34/36.

---

## 3 · Open P1s — all five are new, and why they were invisible before

The DOM shard found a **structural blind spot in its own prior method**. Rounds 8–11 matched
selects **by `name`** across the two sides. A select whose `name` itself drifted therefore landed
in "source-only" on one side and "mock-only" on the other, and its option arrays were *never
compared*. Re-running it as a **per-page select-set comparison** exposed 8 pages where the mock
renders a select the source does not have at that name — 5 of them P1.

| # | Route | Source | Mock | Defect |
|---|---|---|---|---|
| **D-01** | `/admin/admin/widget_instance/new/` | `theme_id` = `('1','Magento Blank')`, `('3','Magento Luma')` | `theme` = `('Magento Luma','Magento Luma')`, … | value == label; source uses numeric theme ids |
| **D-01b** | same | `code` = `('cms_page_link',…)` short codes | `type` = PHP FQCNs (`Magento\Cms\Block\Widget\Page\Link`) | wrong value vocabulary; blank sentinel absent |
| **D-02** | `/admin/admin/system_design/new/` | `design[design]` = `('1','Magento Blank')`, `('3','Magento Luma')` | `design` = `('Magento/luma',…)` | theme *path* strings where source uses numeric ids; name drift; order reversed |
| **D-03** | `/admin/search/synonyms/new/` | `scope_id` = `('0:0','All Websites')`, `('1:0','All Store Views')`, `('1:1','Default Store View')` | `scope` = `('all',…)`, `('website_1','Main Website')`, `('store_1',…)` | **invented values** + a changed middle label |
| **D-04** | `/admin/checkout/agreement/new/` | `stores[]` = `('0','All Store Views')`, `('1','Default Store View')` | `store_id` = `('1','Default Store View')` | name drift **+ the `0 / All Store Views` option is trimmed** |

P2 from the same sweep: `D-02b`, `D-05`, `D-06`, `D-07`, `D-08` (mostly `name` drift with correct
values), plus class (d) — 45 missing button `id`s over 9 pages, 62 missing `data-ui-id` over 28
pages, 11 pages at zero. No task in `assets/TASKS.md` selects on `data-ui-id`.

**Signature check:** every mock option value in the app was scanned for "friendly" strings where
Magento uses ids. `html`/`text`/`active`/`enabled` as *values*: **none left anywhere**. The
remaining non-numeric values (`frontend_input`, `frontend_class`, `simple_action`, country/locale
codes) were each verified equal to the source.

---

## 4 · Provenance of the part-files

| Part-file | Round | Completeness | How recorded here |
|---|---|---|---|
| `TEST.part-dom.md` | 12 | **PARTIAL** — §1–3 complete; Task 4 (throw tests + shared-grid regression), Findings and Summary never written | its §1–3 results used; Task 4 recorded NOT RUN |
| `TEST.part-sales.md` | 12 | **PARTIAL** — Task 1 complete (118-URL sweep); Task 4 (false-success + invariants) never written | Task 1 used; Task 4 recorded NOT RUN |
| `TEST.part-catalog.md` | 12 | **PARTIAL** — Task 1 complete (76 rows of the same sweep); Task 4 never written | same |
| `TEST.part-reports.md` | 12 | **PARTIAL** — Tasks 3 and 4 complete; Tasks 1, 2, 5 never appended; Summary is a placeholder | Tasks 3–4 used; 1, 2, 5 recorded NOT RUN |

No shard's severity has been softened or re-judged. Every finding id is reproduced exactly as its
author filed it. Note that shards have independently reused ids (`F-02`, `F-07` appear in both the
DOM and sales shards) — these are preserved, not merged.

---

## 5 · Carried forward from round 11 — verified, not re-measured this round

These were closed on strong evidence in earlier rounds and were **not** re-tested in round 12.
They are recorded as *previously verified*, not as *verified this round*.

- **`DIFF-S801`** — `canShip()` derived from Magento's real rule, validated over 60 orders across
  every status in the deployment, 13 predicates, **0 disagreements** with the source.
- **`DIFF-R104`** — legacy Reviews grid sort is persisted state; page-2+ id sequences match the
  source exactly; survives paging, per-page changes, filtering and header clicks.
- **`DIFF-R102`**, **`F-05`**, **`F-04`**, **`DIFF-R61/R75/R80/R81/R82/R73`** — all closed.
- **Zero false successes** across 11 consecutive rounds (a success message with an empty
  `state_diff`). **Not re-verified in round 12** — see §6.
- **41/41 task answers** obtainable and matching the source. **Not re-verified in round 12.**
- Five pipeline invariants (first mutation of a virgin un-injected sid appears in `/go`
  `state_diff`; fully-injected sid loads; partially-injected sid produces no all-false mega-diff;
  18+ sids in one browser profile; isolation + reset). **Not re-verified in round 12.**

---

## 6 · NOT TESTED THIS ROUND — the honest gap

The operator stopped the round mid-sweep. The following did **not** run and must not be read as
passing:

1. **False-success hunt** — all three shards. The migration's headline "zero false successes for
   11 rounds" is *not* re-established for round 12's code.
2. **Five pipeline invariants** — not driven this round.
3. **Task-answer re-run (41/41)** — the reports shard's Tasks 1 and 2 never ran. Round 12's dev
   pass touched option values across the app; the answers are *likely* unaffected but unproven.
4. **Legacy-grid per-page record-id sequences** — reports Task 2; `DIFF-R104`'s fix not re-checked.
5. **Throw tests and shared-grid regression** — DOM Task 4; `page.fill` / `page.click` on every
   `[data-action=…]` / `page.select_option` not exercised this round.
6. **`DIFF-S801` re-sample** — func Task 3.

---

## 7 · Next round — recommended scope

1. Fix the five P1s (`D-01`, `D-01b`, `D-02`, `D-03`, `D-04`). All are option-value/name drift on
   *form* selects; take values from the source, never derive from seed rows, never trim a real
   option list.
2. **Sweep the class, not the five instances.** The per-page select-set method that found them is
   in `/tmp/pw-dom12/t2b.py` and `t2c.py` — re-run it app-wide after fixing, because the
   match-by-name method cannot see this class at all.
3. Re-run everything in §6 — that is the bulk of a normal verification round.
4. Optionally close class (d) (button `id`/`data-ui-id`), which has been flat and P2 for four
   rounds.

---

## 8 · Build

`npm run build` **passes** (verified after the round-12 dev pass; only the standard
chunk-size-over-500 kB advisory).
