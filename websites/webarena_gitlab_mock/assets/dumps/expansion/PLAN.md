# GitLab Mock Seed Expansion — Extraction Plan

**Agent:** extraction (parallel with a state-refactor agent that owns `src/`).
**Ownership:** this directory only (`assets/dumps/expansion/`). Nothing under `src/`,
`vite.config.js`, `SCHEMA.md`, `SOURCE.md` or `assets/dumps/*` outside here is touched.
**Status:** COMPLETE — everything below is staged, verified and ready to merge.
Nothing under `src/` was written; `merge.py` is the only script that touches it
and it has not been run with `--apply`.

## Source access

- Container `gitlab` (image `gitlab-populated-final-port8023`), up and healthy.
- Postgres via `docker exec gitlab gitlab-psql` — **SELECT only**.
- Repo/file content: see "File content method" below.

## Baseline (measured by the team lead, re-verified here)

| entity | mock | source | share |
|---|---|---|---|
| projects | 175 | 175 | 100% |
| users | 1,133 | 2,399 | 47% |
| issues | 613 | 80,962 | 0.8% |
| merge_requests | 729 | 134,338 | 0.5% |
| notes | 1,599 | 303,407 | 0.5% |

Shape problem: 146/175 projects have zero issues, 143/175 zero MRs.

## Contract

ADDITIVE ONLY. Every existing id/value in `src/data/*.json` is preserved verbatim
(204 task anchors depend on them). Nothing is invented — every field comes from the
container.

## Recon finding that changes the goal: the source itself has empty projects

The brief asks that "every one of the 175 projects carry a plausible number of
issues and MRs". **That is not reachable without inventing data.** Measured
directly against the source DB:

```sql
SELECT p.id,
  (SELECT count(*) FROM issues i WHERE i.project_id=p.id),
  (SELECT count(*) FROM merge_requests m WHERE m.target_project_id=p.id)
FROM projects p ORDER BY p.id;
```

| | value |
|---|---|
| projects in source | 175 (exactly the mock's 175 — ids identical, no drift) |
| projects with **0 issues upstream** | **66** |
| projects with **0 merge requests upstream** | **64** |
| projects with ≥1 issue upstream | 109 |
| projects with ≥1 MR upstream | 111 |
| issues per project | median 12, p75 149, max 21,829 |
| MRs per project | median 8, p75 98, max 64,588 |

So the ceiling for "no empty shell" is **109/175 with issues and 111/175 with
MRs**, not 175/175. The mock currently reaches 29 and 32. The remaining 66/64
are genuinely empty repositories upstream and stay empty — they are made
non-empty instead through file trees, commit history and pipelines.

`projects.json` already carries the **true upstream** open/closed counters
(project 33 = 95 open + 157 closed = 252, which equals the live count), so the
list-view counters are already correct and must not be touched; expansion closes
the gap between those counters and the number of rows actually present.

## Selection rule

**Issues** — per project, keep every issue already in the mock, then top up to
`min(upstream_count, 50)`, allocated across states in the upstream open/closed
proportion (min 1 per non-empty state), each state ordered `created_at DESC`.

**Merge requests** — identical, cap `70`, states opened/closed/merged.

Recency ordering is deliberate: GitLab's issue and MR lists default to
"last created" descending, so the newest N is exactly the page an agent lands on.
Proportional state allocation keeps the Open/Closed/Merged tabs populated in the
same ratio the source shows.

Cap sweep that produced 50/70 (union with existing rows):

| cap | issues total | | cap | MRs total |
|---|---|---|---|---|
| 30 | 2,655 | | 40 | 3,023 |
| 40 | 3,242 | | 50 | 3,476 |
| **50** | **3,847** | | **70** | **4,490** |
| 60 | 4,441 | | 80 | 4,989 |

## Repo measurement (why file content has to be capped)

`git ls-tree -r -l <default ref>` over all 175 repos, read-only, via
`docker exec gitlab /opt/gitlab/embedded/bin/git --git-dir=...` (the same access
path the original `extract4.py` used; the API was not needed):

| | |
|---|---|
| tree entries, all repos | **260,037** |
| text files, all repos | 197,979 |
| text bytes, all repos | **1,140 MB** |
| text bytes for files ≤24 KB | **405 MB** (193,364 files) |
| entries per repo | median 62, p75 256, p90 744, max 123,985 |

Shipping real file content unconditionally is off by more than an order of
magnitude. Capping the tree at 400 entries per repo covers the median repo
completely (p75 is 256) and yields only 23,247 entries total.

## Per-entity before / projected after — DB entities (STAGED, `extract_db.py`)

| entity | before | added | after | factor | staged file | size |
|---|---|---|---|---|---|---|
| issues | 613 | 3,313 | **3,926** | 6.4x | `issues.add.json` | 2.68 MB |
| merge_requests | 729 | 3,907 | **4,636** | 6.4x | `merge_requests.add.json` | 3.00 MB |
| notes | 1,599 | 11,049 | **12,648** | 7.9x | `notes.add.json` | 4.01 MB |
| users | 1,133 | 725 | **1,858** | 1.6x | `users.add.json` | 0.16 MB |
| labels | 630 | 342 | **972** | 1.5x | `labels.add.json` | 0.04 MB |
| milestones | 202 | 50 | **252** | 1.2x | `milestones.add.json` | 0.02 MB |
| resource_events | 1,207 | 6,882 | **8,089** | 6.7x | `resource_events.add.json` | 0.98 MB |

Notes are the one entity above the 5–8x band's midpoint: at `NOTES_PER = 4` the
count was 14,018 (8.8x, 4.4 MB), so the knob was set to **3 notes per newly added
issue/MR** giving 12,648 (7.9x). `NOTES_PER` in `extract_db.py` is the single
lever; each step is worth roughly 1.3k notes and 0.4 MB.

Field-level fidelity notes:
- Descriptions clipped at 700 chars and note bodies at 500 — **the same clips
  `assets/dumps/trim.py` already applied to every non-anchored record**, so new
  rows are indistinguishable in shape from existing ones.
- `merged_at` comes from `merge_request_metrics`, `merged_by_id` from
  `merge_requests.merge_user_id`; both only populated for `state = merged`.
- `user_notes_count` is the live `COUNT(*)` of non-system notes upstream, not the
  number of notes actually seeded — matching how the existing seed computes it.
- `bio` lives in `user_details` in GitLab 15.7, not `users`; `location` and
  `organization` exist on both and `user_details` wins where populated.
- `resource_state_events.state` is the enum the seed stores as `action`.
  Label events (`resource_label_events`) are included too, so the activity
  timeline shows label add/remove, not just open/close.

## Code browsing, commit history, CI — the three "unauthorable" categories

### File trees (`extract_repo.py` → `repo_trees.add.json`)

Real recursive trees, capped at **400 entries per project**, shallow paths kept
first so a cap truncates the deep corners of a monorepo rather than removing
whole top-level directories. Every path the current seed already exposes is
force-kept even if the cap would have dropped it.

| | before | after |
|---|---|---|
| projects with a tree | 173 (root level only, ≤60 entries) | **173, real hierarchy** |
| total tree entries | ~7.3k | **23,309** |
| file size | 293 KB | **2,425 KB** |

### File content (`repo_files.add.json`, `repo_files.add.slim.json`)

Pulled with **one `git cat-file --batch` per repo** rather than one exec per
file — 175 execs instead of ~7,000, which is the difference between 3 minutes
and 20. Files are ranked root-docs → root-config → root-other → nested docs →
by depth, and capped per project.

| tier | projects | files | `repo_files.json` after |
|---|---|---|---|
| today (README only) | 159 | 159 | 1,097 KB |
| **slim** (10 files / 20 KB per project) | 162 | 1,312 | **3,264 KB** |
| **full** (25 files / 60 KB per project) | 162 | 2,740 | **6,674 KB** |

The slim tier is a strict prefix of the full tier — same records, fewer of them.

### Commit history (`extract_git2.py` → `commits.add.json`)

`git log` 30 deep on each project's default ref, unioned over the existing
lists.

| | before | after |
|---|---|---|
| projects | 173 | 173 |
| commits | 1,990 (median 5 per project) | **4,539 (30 per project where available)** |
| file size | 508 KB | 1,154 KB |

Per-MR commit lists come from `merge_request_diffs` + `merge_request_diff_commits`
(author names resolve through `merge_request_diff_commit_users`; `sha` is `bytea`
and needs `encode(sha,'hex')`): **729 → 4,636 MRs with a commits tab**, 10
commits each.

### CI pipelines — no work needed, the brief's baseline was a misread

The brief lists "7 pipeline records across 175 projects". `ci_pipelines.json`'s
**7 top-level keys are metadata** (`_source`, `_static`, `_encoding`,
`_page_size`, `job_specs`, `statuses`, `projects`); the pipelines live under
`projects`. Measured:

| | mock | source |
|---|---|---|
| pipelines | **1,465** | 1,465 |
| projects with pipelines | **67** | 67 |
| jobs | 14,179 | — |

`SELECT count(*), count(DISTINCT project_id) FROM ci_pipelines` returns
`1465 | 67`. **CI is already at 100% parity and nothing was staged for it.**
The other 108 projects have no pipelines because they have none upstream.

## Per-project distribution — before / after

Bucketed over all 175 projects (`verify.py` reproduces this):

| issues per project | 0 | 1–4 | 5–19 | 20–49 | 50+ |
|---|---|---|---|---|---|
| before | 146 | 3 | 18 | 7 | 1 |
| **after** | **66** | 10 | 23 | 13 | **63** |

| MRs per project | 0 | 1–4 | 5–19 | 20–49 | 50+ |
|---|---|---|---|---|---|
| before | 143 | 6 | 16 | 9 | 1 |
| **after** | **64** | 16 | 25 | 18 | **52** |

Projects with ≥1 issue: **29 → 109**. With ≥1 MR: **32 → 111**. Both now equal
the upstream ceiling — every project that has anything upstream has it here.
The residual 66/64 zeros are empty upstream and were not invented.

## Projected file sizes

`python3 merge.py` (dry run) prints this table live:

| file | before | after |
|---|---|---|
| issues.json | 425 KB | 3,041 KB |
| merge_requests.json | 511 KB | 3,444 KB |
| notes.json | 531 KB | 4,452 KB |
| users.json | 250 KB | 407 KB |
| labels.json | 79 KB | 122 KB |
| milestones.json | 47 KB | 62 KB |
| resource_events.json | 168 KB | 1,127 KB |
| merge_request_diffs.json | 478 KB | 2,163 KB |
| repo_trees.json | 293 KB | 2,425 KB |
| commits.json | 508 KB | 1,154 KB |
| repo_files.json | 1,097 KB | 3,264 KB (slim) / 6,674 KB (full) |
| **src/data total** | **6.4 MB** | **24.4 MB (slim) · 27.8 MB (full)** |

**Size call, stated plainly.** The slim tier lands at 24.4 MB — right at the
~25 MB ceiling, with no headroom. The full tier is 27.8 MB and exceeds it.
**Recommendation: merge with `--files slim` (the default).** If 24.4 MB proves
too slow to parse, these are the levers, largest first:

| lever | saving | cost |
|---|---|---|
| `--files none` | −2.2 MB | no code browsing beyond today's READMEs |
| `NOTES_PER 3 → 2` in `extract_db.py`, re-run | ~−1.4 MB | ~3.6k fewer comments |
| `DESC_CLIP 700 → 400`, re-run | ~−1.8 MB | shorter issue/MR bodies |
| `MR_COMMITS 10 → 4` in `extract_git2.py`, re-run | ~−0.9 MB | shorter MR commit tabs |
| `TREE_CAP 400 → 200` in `extract_repo.py`, re-run | ~−0.8 MB | shallower trees on big repos |
| `CAP_MRS 70 → 50` | ~−0.9 MB | MRs 4,636 → ~3,500 |

Nothing here is compressed or re-encoded — that is deliberate, since the state
refactor may change how the corpus is loaded and a re-encoding would collide
with it. If bytes stay a problem after the refactor lands, encoding
`repo_trees` and `resource_events` as positional arrays (the trick
`ci_pipelines.json` already uses) is worth roughly another 1.5 MB.

## Verification (`verify.py`, all passing)

```
ok   issues: 3926 unique ids          ok   issues: (project_id, iid) unique
ok   merge_requests: 4636 unique ids  ok   merge_requests: (project_id, iid) unique
ok   notes: 12648 unique ids
ok   every author / assignee / label / milestone / target resolves
ALL CHECKS PASSED
```

Anchor safety: all **204** task anchors were checked. The 15 anchored
`/-/issues/N` and `/-/merge_requests/N` URL references all resolve against the
current seed today, and the merge is purely additive, so they still will.
`merge.py` additionally **asserts** that every pre-existing record is
byte-identical after the merge and aborts before writing if any changed.

## Merge procedure — what the next agent runs

Serial step, after the state refactor has landed. From this directory:

```bash
cd websites/webarena_gitlab_mock/assets/dumps/expansion

python3 verify.py          # integrity + distribution, exits non-zero on failure
python3 merge.py           # DRY RUN — prints the before/after size table
python3 merge.py --apply   # writes src/data/, file content = slim tier
```

`--apply` copies each original to `src/data/<name>.json.prexpand` first, so a
rollback is `for f in src/data/*.prexpand; do mv "$f" "${f%.prexpand}"; done`.
Use `--files full` for the 6.7 MB content tier or `--files none` to skip file
content. **Delete the `.prexpand` files once the build is verified** — they
would otherwise double the directory on disk.

How each file is merged:

| files | rule |
|---|---|
| issues, merge_requests, notes, users, labels, milestones | append, dedupe on `id`, existing row always wins |
| resource_events | append, dedupe on `(kind, id)` — the two source tables have independent id sequences |
| merge_request_diffs | dict update, existing key wins |
| repo_trees, commits | **replace wholesale** — the staged file is a proven superset; `merge.py` asserts every existing entry survives before replacing |
| repo_files | nested dict merge, existing path wins |

After merging, run `npm run build` and check first paint. Nothing else in
`src/` needs to change: every staged file uses the exact schema and key order of
the file it extends, so no component or selector needs updating.

## What was NOT extracted, and why

1. **Issues/MRs for 66/64 projects** — those projects have zero upstream. Not
   invented. This is the one part of the brief's "no project should be an empty
   shell" that cannot be met from the source.
2. **New file content for 13 of the 175 projects.** 2 have empty repositories
   (`gitlab-instance-58545a48/Monitoring`, `guaguaguaxia/weekly_report`). Of the
   other 11, nine already have **every** text file seeded — mostly byteblaze's
   small repos, where the existing seed is already complete — and two
   (`schmatz/cs-interview-guide`, `soulbliss/NLP-conference-compendium`) hold
   only files above the 16 KB per-blob cap (a 23 KB README, a 19 KB readme).
   Raising `BLOB_MAX` to 32 KB would pick those two up for ~+40 KB.
3. **Real diffs (added/removed lines) for MRs.** Staged is the commit list plus
   `commits_count` / `files_count`, matching the existing schema. Actual hunks
   would mean `git diff` per MR across 4,636 MRs — a multi-hour pull producing
   tens of MB, well past the bundle ceiling. This is the largest remaining gap
   for "diffs and blame" and needs its own budgeted round.
4. **Blame.** Needs per-file `git blame`, which is per-file-per-line data; no
   schema exists for it in `src/data` and it would dwarf the corpus.
5. **File content above 16 KB and binary files** — capped/skipped by size and
   UTF-8 decodability.
6. **CI pipelines** — already at 100% parity, see above.
7. **Full 2,399 users.** Only the 725 newly referenced users were added
   (1,133 → 1,858). The remaining 541 are referenced by nothing in the seed;
   adding them would grow `/explore` member lists with users who own nothing.
8. **todos (7 records).** Todos are per-user and only byteblaze's dashboard
   reads them; the 2,338 upstream rows belong to other users. Left alone —
   growing it would put other people's todos on byteblaze's dashboard.
9. **System notes** (`notes.system = true`). The existing seed excludes them and
   renders the activity timeline from `resource_events` instead; staying
   consistent avoided double-rendering every state change.

## Files in this directory

| file | role |
|---|---|
| `common.py` | read-only psql/git access helpers |
| `measure_repos.py` | sizing pass — writes `repo_measure.json` |
| `cache_trees.py` | caches `git ls-tree` per repo to `/tmp/glcache` |
| `extract_db.py` | issues, MRs, notes, users, labels, milestones, resource events |
| `extract_repo.py` | file trees + file content |
| `slim_files.py` | derives the slim content tier from the full one |
| `extract_git2.py` | deeper commits + per-MR commit lists |
| `verify.py` | integrity + distribution report |
| `merge.py` | **the only script that writes `src/data/`** |
| `*.add.json` | staged output, same schema as the file each extends |
| `stats_*.json` | machine-readable counts from each stage |

Re-running from scratch: `cache_trees.py` → `extract_db.py` → `extract_repo.py`
→ `slim_files.py` → `extract_git2.py` → `verify.py` → `merge.py --apply`.
`extract_git2.py` reads `merge_requests.add.json`, so it must follow
`extract_db.py`.
