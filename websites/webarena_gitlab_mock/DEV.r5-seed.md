# DEV.r5-seed.md — Round 5, shard A (seed backfill: closed_at / merged_at)

> Owned: `src/data/**`, `assets/data_model.md`, `SCHEMA.md`,
> `src/utils/dataManager.js`, `src/pages/hooks.js`. Nothing else touched.
> Build: **PASS** (`vite v5.4.21`, 163 modules, `index.js` 5 769 kB / gzip 1 530 kB)
> Verified in real chromium at `http://localhost:5241`, fresh `?sid=` per check,
> zero page errors.
> Source access: `docker exec gitlab gitlab-psql` — **`SELECT` only**. No `?sort=`
> URL was loaded on port 8023.

---

## 0 · Answer to the question the brief asked

Two fields, two different outcomes.

| | outcome |
|---|---|
| `merge_requests.merged_at` | **The data was there.** Backfilled 286 of 729 rows from `merge_request_metrics`. `?sort=merged_at` now orders, verified row-for-row against the source DB. |
| `issues.closed_at` / `closed_by_id` | **The data genuinely is not there.** The snapshot populated `issues.closed_at` on **1 row in 80 962**. Fields left null, recorded under Gaps. |
| MR `closed_at` | **Also genuinely not there.** GitLab reads it from `merge_request_metrics.latest_closed_at`, set on **1 row in 134 338**. Field left absent, recorded under Gaps. |

So the previous round was right on `closed_at` and wrong only in assuming the
same about `merged_at` — that one was extractable, and now is extracted.

**State size: 2 032 068 → 2 063 847 bytes (1.938 MB → 1.968 MB, +31 779 / +0.030 MB.)**
Inside `WEBARENA_MIGRATION.md §4.4`'s ~1–2 MB budget, with ~33 KB of headroom.

---

## 1 · The SQL

### 1.1 Where the columns actually live

`\d merge_requests` has **no** `merged_at` and **no** `closed_at`. Confirmed
against the running source's own Ruby rather than assumed
(`app/models/merge_request.rb`):

```ruby
scope :order_by_metric, ->(metric, direction) do            # :360
  column_expression = MergeRequest::Metrics.arel_table[metric]
  …order_expression: column_expression_with_direction.nulls_last,
    nullable: :nulls_last…
  order.apply_cursor_conditions(join_metrics).order(order)
end
scope :order_merged_at_asc,  -> { order_by_metric(:merged_at, 'ASC') }         # :385
scope :order_closed_at_asc,  -> { order_by_metric(:latest_closed_at, 'ASC') }  # :387
def self.sort_by_attribute(method, excluded_labels: [])                        # :481
  when 'merged_at', 'merged_at_asc' then order_merged_at_asc
  when 'closed_at', 'closed_at_asc' then order_closed_at_asc
```

Issues are the plain column (`app/models/issue.rb:160`):

```ruby
scope :order_closed_at_asc,  -> { reorder(arel_table[:closed_at].asc.nulls_last) }
scope :order_closed_at_desc, -> { reorder(arel_table[:closed_at].desc.nulls_last) }
```

So: MR merged date → `merge_request_metrics.merged_at`; MR closed date →
`merge_request_metrics.latest_closed_at`; issue closed date → `issues.closed_at`.
All three nulls-last in **both** directions, which is what `sortIssuables`
already did.

### 1.2 Coverage probes

```sql
-- whole-DB coverage, issues
SELECT count(*), count(*) FILTER (WHERE state_id=2), count(closed_at), count(closed_by_id)
FROM issues;
--  80962 | 65416 | 1 | 1

-- the one row that has it (project 3, iid 18) — NOT in the seed
SELECT id, iid, project_id, closed_at, closed_by_id FROM issues
WHERE closed_at IS NOT NULL OR closed_by_id IS NOT NULL;
--  18 | 18 | 3 | 2021-02-15 15:56:35.021+00 | 1

-- whole-DB coverage, MRs
SELECT count(*), count(*) FILTER (WHERE mr.state_id=3), count(m.merged_at),
       count(m.latest_closed_at), count(m.id)
FROM merge_requests mr LEFT JOIN merge_request_metrics m ON m.merge_request_id=mr.id;
--  134338 | 101277 | 22023 | 1 | 32696
```

### 1.3 The two joins against the seed's own ids

`$IDS` is the literal id list read out of the existing seed — `mr.id` from
`merge_requests.json` (729) and `id` from `issues.json` (613). No sampling
predicate, no `LIMIT`: a field backfill on the rows already present.

```sql
-- MRs (the one that produced data)
SELECT mr.id,
       COALESCE(to_char(m.merged_at, 'YYYY-MM-DD HH24:MI:SS'), ''),
       COALESCE(m.merged_by_id::text, ''),
       COALESCE(to_char(m.latest_closed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD HH24:MI:SS'), ''),
       COALESCE(m.latest_closed_by_id::text, '')
FROM merge_requests mr
LEFT JOIN merge_request_metrics m ON m.merge_request_id = mr.id
WHERE mr.id IN ($IDS) ORDER BY mr.id;
--  729 rows | merged_at 286 | merged_by_id 210 | latest_closed_at 0 | latest_closed_by_id 0

-- Issues (the one that produced nothing)
SELECT id, COALESCE(to_char(closed_at AT TIME ZONE 'UTC','YYYY-MM-DD HH24:MI:SS'),''),
       COALESCE(closed_by_id::text,'')
FROM issues WHERE id IN ($IDS) AND (closed_at IS NOT NULL OR closed_by_id IS NOT NULL);
--  0 rows.   (control: SELECT count(*) FROM issues WHERE id IN ($IDS) -> 613,
--             so all 613 seeded ids do resolve; they are simply all NULL.)
```

`merged_at` is `timestamp without time zone` and takes no conversion;
`latest_closed_at` and `issues.closed_at` are `timestamptz` and are read
`AT TIME ZONE 'UTC'`. Output format matches the seed's existing
`"YYYY-MM-DD HH:MM:SS"`.

---

## 2 · Rows backfilled

Only `src/data/merge_requests.json` changed. `merged_at` and `merged_by_id` were
inserted **after `updated_at`**, on all 729 rows, null where the source is null.

| | count |
|---|---|
| MR rows in the seed | 729 (unchanged) |
| `merged_at` populated | **286** |
| `merged_by_id` populated | **210** (76 metrics rows have `merged_at` but no `merged_by_id`) |
| `merged` state | 314 |
| `merged` but left NULL | 28 — no `merge_request_metrics` row at the source |
| non-`merged` rows carrying a `merged_at` | **0** |
| `closed_at` written onto an MR row | **0** |
| `issues.json` rows changed | **0** |

All 18 distinct `merged_by_id` values resolve inside `users.json` (checked).
No two seeded MRs in the same project share a `merged_at`, so no tie-break
ambiguity arises (checked).

### Identity guard

The backfill script refused to write unless every pre-existing field on every row
was byte-identical, and an independent re-check against the pre-backfill copy
confirms it after the fact:

```
rows 729  anomalies 0
added keys per row: exactly ["merged_at","merged_by_id"]  removed: none
id/iid sequence identical: true
```

No id, iid, slug, username, path or existing timestamp was renamed, regenerated
or reordered. No record added or removed.

---

## 3 · State size, before and after

Measured off `GET /go?sid=…` on a cold session, `JSON.stringify(initial_state).length`:

| | bytes | MB |
|---|---|---|
| before | 2 032 068 | **1.938** |
| after | 2 063 847 | **1.968** |
| delta | +31 779 | +0.030 |

Budget is not regressed and not blown. It is, however, tight: ~33 KB from 2 MB.
Recorded in `assets/data_model.md §12` so the next round knows the next field to
ride in state should displace one rather than join it.

Per-key after the backfill: `notes` 530.2 KB · `mergeRequests` 510.5 KB ·
`issues` 424.4 KB · `users` 248.8 KB · `projects` 98.5 KB · rest < 80 KB.

I did **not** spend the budget on shape-only nulls that no source column backs:
MR `closed_at` would have cost ~13 KB of pure `null` and is absent instead.

---

## 4 · Which sort tokens now actually order

Verified in chromium against **Postgres ground truth**, not against "it looks
different". Ground truth is the source's own ordering,
`ORDER BY m.merged_at <dir> NULLS LAST, m.id DESC`, restricted to seeded ids.

### 4.1 `merged_at` — CONFIRMED CORRECT

`byteblaze/a11y-webring.club` (39 merged MRs with `merged_at`) matched page 1
of both directions exactly. But that project merged its MRs in creation order,
so `merged_at_desc` there is *indistinguishable* from `created_date` — proving
nothing. So the real check ran on `kkroening/ffmpeg-python`, chosen because 14 of
its 16 merged rows sit at a different rank under `merged_at` than under
`created_at`:

```
source  merged_at ASC   442 440 417 433 430 493 494 639 641 469 642 596 643 680 679 681
mock    ?sort=merged_at 442 440 417 433 430 493 494 639 641 469 642 596 643 680 679 681   MATCH

source  merged_at DESC       681 679 680 643 596 642 469 641 639 494 493 430 433 417 440 442
mock ?sort=merged_at_desc    681 679 680 643 596 642 469 641 639 494 493 430 433 417 440 442   MATCH

contrast, ?sort=created_date 681 680 679 643 642 641 639 596 494 493 469 442 440 433 430 417
```

`merged_at_asc` is identical to `merged_at`, as the token table requires.
The order is different from every other token **and** it is the source's order.

### 4.2 `closed_at` / `closed_at_desc` — still inert on the seed, correctly so

Inert on issues and on MRs, because the source is inert. Both fall through to
the `id DESC` tie-break, which on `keycloak/keycloak` is a genuinely different
order from `created_date` — but that difference is the tie-break, not the field,
and I am not claiming it as a pass.

What *does* pass is the in-session path. Closing an issue through the UI writes a
real `closed_at`, and it then orders — driven end to end, one sid:

```
?sort=closed_at_desc before   19190 19183 19186 19185 19164 …
  -> open #19185, click "Close issue"
?sort=closed_at_desc after    19185 19190 19183 19186 19164 …   moved to rank 1
?sort=closed_at  (asc) after  19185 19190 19183 19186 19164 …   also rank 1
```

Rank 1 under **both** directions is the correct nulls-last answer, not a bug: one
non-null row among 20 sorts first ascending and first descending. `/go?sid=` for
that session reports `issues.changed` carrying the new `closed_at`.

### 4.3 Round-4's other tokens — no regression

All 18 tokens re-driven on `/keycloak/keycloak/-/issues?state=all`, one fresh
sid each, 0 page errors. Every one still produces an order distinct from
`created_date`; `due_date`/`popularity`/`label_priority`/`relative_position`
still collapse onto the shared `id DESC` shape round 4 documented, and
`milestone*`/`priority*` still produce their own three-tier shape.

---

## 5 · Gaps / unverified

1. **`issues.closed_at` and `issues.closed_by_id` are unrecoverable for this
   snapshot.** 1 populated row in 80 962, and it is not one of the 613 sampled
   issues. The GitLab import that built this image never wrote the column.
   Reaching that single row would mean swapping out a sampled issue, and the
   sampled set contains anchors. The fields stay null. No timestamp was
   synthesised — a fabricated `closed_at` would order `?sort=closed_at`
   confidently and wrongly, which is worse than ordering nothing.
   → `assets/data_model.md §4.1`.

2. **MR close date likewise.** `merge_request_metrics.latest_closed_at` is set on
   1 row in 134 338 and 0 of the 729 sampled. No `closed_at` key was added to MR
   seed rows at all.
   → `assets/data_model.md §5.2`.

3. **28 `merged` MRs have no `merged_at`** because they have no
   `merge_request_metrics` row at the source. Faithful; they sort nulls-last.

4. **Deliberate deviation — tie-break column.** GitLab ties `merged_at` on
   `merge_request_metrics.id DESC`; the mock has no metrics table and ties on
   `merge_requests.id DESC` like every other token. Indistinguishable on this
   seed (no intra-project `merged_at` ties). Documented in `hooks.js`.

5. **Deliberate deviation — `join_metrics` is an INNER join.** On the real
   GitLab, `?sort=merged_at` therefore silently *drops* every MR with no metrics
   row — 238 of the 729 sampled. The mock keeps them and sorts them nulls-last.
   A sort that changes the row count reads as a bug to an agent; I judged
   nulls-last the more defensible behaviour, but it is a real difference and is
   on the record in `assets/data_model.md §5.2` in case a task depends on the
   count.

---

## 6 · Handback — one file I do not own

`src/pages/MergeRequestDetail.jsx:305` renders the merged banner as:

```jsx
<span>Merged by {author ? author.name : 'a user'} <TimeAgo value={mr.updated_at} /></span>
```

Both halves are wrong and both are now fixable: it names the MR's **author**
rather than whoever merged it, and it timestamps from `updated_at` rather than
the merge. `merged_by_id` (210 rows) and `merged_at` (286 rows) are now on the
row, so this can read `mr.merged_by_id` / `mr.merged_at` with a fallback to the
current behaviour where they are null.

Relatedly, the Merge button at `:287` writes only
`{ state: 'merged', merge_status: 'can_be_merged' }`. It should also write
`merged_at` (now) and `merged_by_id` (`currentUser.id`), the way the close
handlers already write `closed_at`/`closed_by_id` — otherwise an MR merged
in-session sorts nulls-last under `?sort=merged_at` and shows the wrong banner.
`SCHEMA.md`'s Observable-State-Changes row for "Close / reopen / merge an MR"
was left describing current behaviour and will need `.merged_at`, `.merged_by_id`
appended once that lands.

---

## 7 · Files changed

| File | Change |
|---|---|
| `src/data/merge_requests.json` | `merged_at` + `merged_by_id` on all 729 rows (286 / 210 populated). Purely additive. |
| `src/data/issues.json` | **unchanged** — nothing to backfill. |
| `src/pages/hooks.js` | Replaced the now-stale `sortIssuables` comment claiming the seed has no `merged_at`; documented the real coverage, the source's null-shape for both `closed_at` families, and the tie-break deviation. No logic change — the token cases were already correct and now have data. |
| `SCHEMA.md` | `mergeRequests` / `issues` state-table rows updated for the new and the deliberately-absent fields. |
| `assets/data_model.md` | New §4.1 (issue closed-date gap), §5.1 (merged_at backfill), §5.2 (MR closed-date gap + the two deviations); §5 example updated; §4 example corrected (it showed a populated `closed_at`, which no seeded row has); §12 and the §0 headline re-measured. |
| `src/utils/dataManager.js` | **unchanged** — `mergeRequestsSeed` is imported whole, so the new fields reach `createInitialData()` with no code change. Confirmed via `/go`. |
