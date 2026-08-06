# webarena_shopping_admin_mock — Migration Status / Handoff

> Written **2026-08-06** by the orchestrator after the operator halted the run partway through
> round 12. This is the entry point: read this first, then `TEST.md`.
>
> **The run was stopped deliberately, not because it failed.** Nothing crashed, no agent died
> holding unsaved work, and no file was left half-written by a killed process — the four round-12
> part-files were flushed to disk before their shards were stopped. What is missing is the
> *second half of round 12's verification*, enumerated in `TEST.md` §6.

---

## 1 · Where it stands

| | |
|---|---|
| **Build** | `npm run build` **passes** |
| **Routes** | 141 route rows in `ROUTES.md`; **137 `[x]`**. Cold-load parity verified for every row (118 func URLs + 36 reports + 232 DOM URLs, 0 failures, 0 `?sid=` losses) |
| **Open P0** | **0** — in every dimension, and every P0 ever filed has been fixed and independently re-verified |
| **Open P1** | **5** — `D-01`, `D-01b`, `D-02`, `D-03`, `D-04`, all `<select>` option-value/name drift on *form* pages (`TEST.md` §3) |
| **TODO** | 104 done · 1 partial · 5 open (all P2 except one P1 and one "P1?") |
| **Seeds** | 42 JSON files, 4.8 MB on disk, all extracted read-only from the container; `createInitialData()` ≈ 321 KB / 41 keys, well inside the ~1–2 MB contract budget |
| **Docs** | `TEST.md` round 12 (interrupted) · `AUDIT.md` **stale at round 5** (banner added) · `SCHEMA.md` round 4 · `ROUTES.md` current |

### The four route rows not marked `[x]`

| Row | Path | Why |
|---|---|---|
| 9 | `/admin/admin/auth/logout/` | **Deliberately not migrated** — the mock is permanently logged in, per the migration contract |
| 28 | `/admin/sales/order_create/reorder/…` · `order_edit/start/…` | Screen renders; order *placement* is a declared decline |
| 29 | `/admin/sales/order_create/start/customer_id/:id/` | Same |
| 134 | `/go` | Works (served by the vite plugin **and** an in-app route); the row is bookkeeping, not a gap |

---

## 2 · What is solid

These were established over multiple rounds with independent re-verification, and should **not**
be re-litigated by a future round:

- **Zero false successes** across 11 consecutive rounds. A "false success" here means a success
  banner with an empty `/go` `state_diff` — a control that tells an RL agent a state change
  happened when it did not. The count went 12 → 0 and stayed there. *(Not re-measured in round 12
  — see §4.)*
- **Pipeline invariants**, proven empirically rather than by reading code: first mutation of a
  brand-new un-injected sid appears in `state_diff`; fully-injected sid loads; partially-injected
  sid produces no all-false mega-diff; **18+ distinct sids in one browser profile** (a real P0 —
  the 7th sid used to blow the localStorage quota and grids silently rendered zero rows);
  isolation and reset both clean.
- **41/41 task answers** obtainable and matching the live source.
- **`canShip()`** derived from Magento's actual rule and validated over **60 orders × 13
  predicates × 0 disagreements**.
- **Grid classification 36/36** — every grid renders LEGACY / MODERN / PLAIN exactly as the source
  does.
- **Four DOM defect classes at genuine zero** over all 232 routes: element-kind drift, duplicate
  `name` (Playwright strict-mode), checkbox-without-`value`, and `disabled`-where-source-enabled.

### Settled questions — do not re-open

- **Low Stock Report showing `0 records found` is CORRECT.** Arbitrated in round 5 by loading the
  live source, which is genuinely empty. `assets/TASKS.md` tasks 183–187 expect rows; **the task
  key is the stale side**, not the mock. Do not loosen the filter to make rows appear.
- **`F-00` (5–17 routes "rendering the mock's 404 where the source renders a view") was REFUTED** —
  all 21 URLs driven on both sides, 21/21 agreement.
- **Export-select absolute URLs** rewritten to the mock's host are not defects.
- **`/admin/admin/url_rewrite/`** renders a 1-row `<thead>` on the source too — not a defect.
- Three WebArena answer keys disagree with the live source and the mock correctly follows the
  source (reviews mentioning "disappointed"; task 43's rank-3 search term; task 3's rank-2 2022
  bestseller). Do not "fix" the mock toward a stale key.

---

## 3 · The five open P1s

All are the same shape: an option list on a *form* select whose **values** (not labels) diverge
from the source, usually together with a drifted `name`. Detail and both sides' option arrays are
in `TEST.md` §3 and `TEST.part-dom.md` §2.3.

`D-01`/`D-01b` widget instance · `D-02` design schedule · `D-03` search synonyms ·
`D-04` checkout agreement.

**Fix the class, not the five.** These were invisible for four rounds because the differ matched
selects **by `name`**, so a select whose name also drifted was never compared at all. The
per-page **select-set** comparison that found them is at `/tmp/pw-dom12/t2b.py` and `t2c.py`
(note: `/tmp` is volatile — re-derive if gone). Re-run it app-wide after fixing.

---

## 4 · What round 12 did NOT verify

Stopped mid-sweep. None of this is failing; it is simply **unmeasured for the current code**:

1. False-success hunt (all shards)
2. The five pipeline invariants
3. The 41/41 task-answer re-run
4. Legacy-grid per-page record-id sequences (`DIFF-R104`'s guard)
5. Throw tests + shared-grid regression
6. `DIFF-S801` re-sample

Round 12's dev pass changed `<select>` option values across the app. That is a low-risk change for
items 1–6, but "low-risk" is not "verified".

---

## 5 · To resume

```bash
export PATH="/tmp/node-v20.18.1-linux-x64/bin:$PATH"
export LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu:/tmp/sysroot/lib/x86_64-linux-gnu
bash shared/setup-toolchain.sh --check || bash shared/setup-toolchain.sh   # /tmp is volatile
(cd websites/webarena_shopping_admin_mock && npm run dev -- --port 5180)
```

Source: `http://localhost:7780/admin`, `admin` / `admin1234`, container `shopping_admin`.
**Recon and testing against the source are strictly read-only** — a polluted WebArena instance
invalidates the benchmark.

**Suggested next round:** fix the five P1s → re-run the select-set sweep app-wide → re-run
everything in §4. That is roughly one normal dev→test round.

---

## 6 · Operational notes for whoever runs this next

- **Subagents leak dev servers.** This run accumulated **35 orphaned vite processes** across 12
  rounds because shards started servers and did not always stop them. Kill by explicit PID, not
  `pkill -f vite` — a broad `pkill` pattern matches the agent's own shell wrapper and kills the
  command before it reaches the targets (this happened here; exit 144, and the first kill did
  almost nothing).
- **Ports drift.** Shards were told to use fixed ports but repeatedly found them already bound and
  silently fell through to another (5197 → 5201, 5196 → 5197). Any report quoting a port may not
  match its brief.
- **Finding ids collide across shards.** `F-02` and `F-07` exist independently in both the DOM and
  sales shards. They were deliberately preserved rather than merged — check which shard a finding
  came from before acting on it.
- **A partial part-file must be recorded as NOT VERIFIED, never as passing.** This happened three
  times when a consolidation read a sibling mid-write; each time the consolidating agent recorded
  the rows as unverified, which was correct — and twice the shard then finished clean, so the
  consolidated verdict *understated* the true state. Re-read part-files immediately before
  consolidating.
