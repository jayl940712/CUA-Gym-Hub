# DEV.r4-schema — round 4, shard B (schema + seed budget)

> Shard B owned `SCHEMA.md`, `assets/data_model.md`, `src/utils/dataManager.js`,
> `src/data/**`. Nothing outside that list was written.
> Dev server driven on port 5232; chromium via `/tmp/pwvenv/bin/python` with
> `LD_LIBRARY_PATH=/tmp/sysroot/...`. Build re-run at the end: **PASS**.

---

## 1 · Final measured state size

| | bytes | MB |
|---|---|---|
| before | 2 240 000 (approx, `/go` measured 2.14 MB) | **2.14** |
| **after** | **2 043 078** | **1.948** |

Measured off a cold `GET /go?sid=…` `initial_state`, minified. This is inside
`WEBARENA_MIGRATION.md §4.4`'s ~1–2 MB budget, so **PARITY-008 / P1-6 is closed
on the state itself**, not just on the wire.

### What was cut, and the evidence each field is dead

The obvious cut is unsafe and was **not** made: 36 of the 252 anchor strings occur
verbatim inside note bodies, so `notes` cannot be sampled down. Only *fields* were
removed, and only where a field has **no reader anywhere in `src/`** and **no
anchor in any of its values**.

| Field | Saved | No reader — evidence | No anchor — evidence |
|---|---|---|---|
| `notes.discussion_id` | **95.3 KB** | Only occurrence outside `src/data/` is `NotesTimeline.jsx:322,351`, both **writes** on note creation. Zero reads. | Values are 40-char git hashes and are never rendered. |
| `notes.resolved_by_id` | **37.5 KB** | `NotesTimeline.jsx:327,356` — writes of literal `null`. Zero reads. | `null` in **1 599 / 1 599** rows. |
| `notes.resolved_at` | **32.8 KB** | `NotesTimeline.jsx:326,355` — writes of literal `null`. Zero reads. | `null` in **1 599 / 1 599** rows. |
| `notes.type` | **23.4 KB** | `grep -ranE 'n\.type\|note\.type' src/` → 0 hits. No diff-note / thread surface exists to consume it. | `null` in 1 459/1 599; the rest are `LegacyDiffNote` / `DiffNote`. |
| `users.admin` | **17.7 KB** | `grep -ranE '\.admin\b\|u\.admin' src/` → 0 data hits (only the word "administrator" in copy). No admin surface exists. | `false` in **1 132 / 1 133**. |
| **total** | **206.7 KB** | | |

**Anchor safety proof.** Diffing the raw file bytes of `notes.json` +
`users.json` before and after the cut, against all 252 anchor strings, 145 anchor
routes and 26 anchor locators in `assets/task_anchors.json`:

```
anchor strings present BEFORE the cut and absent AFTER: 0
anchor routes  lost: 0
anchor locators lost: 0
row counts and full id sequences: byte-identical
```

No id, slug, username, path, iid or timestamp was renamed or regenerated.

**Cuts I deliberately did NOT make** — each looks like filler and is not:

- `mergeRequests.squash` (12.1 KB, `false` in all 729 rows) — `EditMergeRequest.jsx:34` reads it.
- `issues.closed_by_id` / `mergeRequests.closed_by_id` (13.2 KB) — no view reads them yet, but the close flow **writes** them. A field a shipped mutation writes belongs in the schema.
- `stars.created_at` (24.4 KB) — `Starrers.jsx:80` renders it.
- `users.email` (41.1 KB) — 12 anchor strings occur inside the values.

**One hand-back for shard A:** `NotesTimeline.jsx:322-327,351-356` still writes
`discussion_id`, `resolved_at`, `resolved_by_id` on notes it creates. Harmless (an
added record ships whole in the diff), but a created note and a seeded note now
have different shapes. Drop those three lines when convenient.

---

## 2 · The empirically derived state-key set (P1-1)

**Method — driving, not grepping.** 43 + 23 + 12 + 6 flows were driven in real
chromium, each on its own `?sid=`, and `GET /go?sid=` was read back and its
`state_diff` key set captured. Where a `changed` entry appeared, the *changed
fields* were extracted per record, so the result is field-level, not
collection-level. `SCHEMA.md` was then reconciled against the captured union.

The audit named **seven** keys. All seven are confirmed by a captured diff, and
the drive found **nine more that were also undocumented**, plus a whole undeclared
`ui` sub-surface.

### The seven the audit named — all confirmed

| Key | Flow driven | Captured diff |
|---|---|---|
| `groupLinks` | Invite a group | `groupLinks` (whole-value `{old,new}` — it is not a keyed collection) |
| `repo.forkOrigin` | Fork `yjlou/2019-nCov` | `repo.forkOrigin.byteblaze/2019-nCov = {"new":"yjlou/2019-nCov"}` — and **zero `repo.fileOverlay` keys**, confirming the alias, not a blob copy |
| `project.feature_settings` | Visibility & permissions save | `projects[].feature_settings` — one object keyed by feature, each `{enabled, level:"10"\|"20"}`, 17 features. Also emits `projects[].request_access_enabled` and `projects[].visibility`. |
| `issue.awards` | 👍/👎/reaction on an issue | `issues[].awards` (`[{name,count}]`) |
| `issue.downvotes` | same | `issues[].downvotes` (and `issues[].upvotes`) |
| `issue.time_estimate` / `.total_time_spent` | issue sidebar time tracking | ⚠ **not captured** — see §5. The handler is `IssueDetail.jsx:450,454`; the keys are certain from the code, the capture is not. |
| `issue.moved_from` | ⋮ → Move issue | `issues[].moved_from` = `"<source full_path>#<source iid>"`, alongside `.project_id`, `.iid`, `.label_ids` |

### The ones nobody had listed — this is the answer to "is there an eighth"

There is. There are nine, and one of them is a whole sub-surface.

| Key | Flow | Note |
|---|---|---|
| **`mergeRequests[].force_remove_source_branch`** | Edit an MR | Not in any audit list, not in the old schema, and not in the seed — created on first edit. |
| **`mergeRequests[].discussion_locked`** · **`issues[].discussion_locked`** | Lock issue / Lock merge request | Same shape as `confidential`; absent from the seed. |
| **`mergeRequests[].merge_status`** | Merge an MR | In the seed, but the *mutation* was undocumented. |
| **`mergeRequests[].awards` / `.downvotes` / `.upvotes`** | MR reactions | The audit listed these for issues only; MRs have the identical surface. |
| **`currentUser.two_factor_enabled`** | `/-/profile/account` | Created on first toggle; `currentUser` only, not mirrored into `users`. |
| **`projects[].request_access_enabled`** | Visibility & permissions save | Rides with `feature_settings`. |
| **`ui.accessTokens`** | `/-/profile/personal_access_tokens` | Created on first use. ⚠ not captured (§5). |
| **`ui.feedToken`** | *reset this token* | Shadows `currentUser.feed_token`. ⚠ not captured (§5). |
| **`ui.preferences.<14 sub-keys>`** | `/-/profile/preferences` | The diff emits **one dotted key per changed preference**, not one `ui.preferences` key. Captured: `themeId colorSchemeId layout dashboard projectView tabWidth language firstDayOfWeek timeDisplayRelative render_whitespace_in_code show_whitespace_in_diffs view_diffs_file_by_file markdown_surround_selection markdown_automatic_lists`. The old schema listed 10 and got 4 of the names wrong. |
| **`ui.notificationLevels.<scope>`** | `/-/profile/notifications` | Keys are `global` and `project:<id>` — captured, previously undocumented as a format. |

### Corrections to the old SCHEMA.md that the drive forced

- **`ui.starredProjectIds` was still documented and does not exist.** It was removed in round 3 (PARITY-009) and the schema — including its Minimal Inject Example — still told a task to inject it. A task copying that example would have written a key nothing reads.
- **`nextIds` values were all wrong**: the schema said `issue 90000 · mr 140000 · note 310000 · label 1800 · milestone 600 · member 600`. The real, *derived* values are `issue 83821 · mr 139278 · note 310827 · label 1927 · milestone 590 · member 206`. The schema also still carried a "⚠ Known defect" block for PIPELINE-001, which was closed a round ago.
- **`state.repo` was described as copying a fork's blobs into the overlays.** It has not done that since round 3 — it writes one `forkOrigin` string. The schema's own prose contradicted the fix.
- **`snippets` and `groupLinks` were missing from the top-level table**; `groupLinks` entirely, `snippets` only in prose.
- **`notes.discussion_id` / `.type` / `.resolved_*` are gone** from the seed (§1).
- The mutable/static split said "18 modules". There are **20** (§3).

**Where I stopped short:** 24 of the ~74 table rows are marked ⚠ rather than ✅ —
reachable in the UI, handler known, but my drive did not complete them. They are
listed in §5 with the reason. I did not mark any of them ✅.

---

## 3 · P2-11 — the two seed modules are now documented

Both are **STATIC reference data** and are documented as such in `SCHEMA.md`
("Mutable vs static seed") and `assets/data_model.md`. Neither is in
`createInitialData()` — verified by reading the live `/go` `initial_state` key
list, which contains no `treeLastCommits` and no `resourceEvents`.

| Module | Size | Wired? | Verified how |
|---|---|---|---|
| `tree_last_commits.json` | 369 KB | **yes** — `src/pages/RepoTree.jsx:12` | already had a `data_model.md §11` section; confirmed still imported and outside state. |
| `resource_events.json` | 168 KB | **yes, now** — `src/pages/NotesTimeline.jsx:10` | The round-3 audit reported it unreferenced; that reading predates the timeline shard. New section `assets/data_model.md §11a` documents its shape: one flat array, 1 207 rows, `kind` ∈ `state` (688) / `label` (500) / `milestone` (19), which is GitLab's `resource_state_events` + `resource_label_events` + `resource_milestone_events` merged. Every `user_id` / `label_id` / `milestone_id` resolves inside the seed. |

The mutable/static table in `SCHEMA.md` now reads **Mutable (12) / Static (8)**
and states explicitly that these two must never enter state — 537 KB would put the
budget straight back over.

---

## 4 · Code delivered in `src/utils/dataManager.js`

### P2-1 — the branch/tag deletion channel is available (message for shard A)

`state.repo.branchDeletions[fullPath]` and `state.repo.tagDeletions[fullPath]`
now exist in `createInitialData()`, and `getBranches` / `getTags` filter the
merged static+overlay list through them, so a deleted name disappears whether it
came from the static module or from the additive overlay.

Two pure helpers are exported:

```js
import { deleteRefs, undeleteRef } from '../utils/dataManager.js'

// Delete branch
setState(prev => deleteRefs(prev, project, 'branch', ['old-feature']))
// Delete merged branches
setState(prev => deleteRefs(prev, project, 'branch', mergedNames))
// Delete tag
setState(prev => deleteRefs(prev, project, 'tag', ['v1.0.0']))
```

Both are idempotent and return the previous object unchanged when nothing moves,
so a no-op click does not emit a `/go` diff. `undeleteRef` is there for the case
where a task re-creates a ref of the same name — the additive overlay push would
otherwise be swallowed by the deletion filter.

`Branches.jsx:92,211` and `Tags.jsx:133` are shard A's files; the page handler is
now three lines each. Both keys are documented in `SCHEMA.md`
(`state.repo` table and the Observable State Changes table).

### P2-14 — `deriveGroupSlug()` (exact change for shard A)

`dataManager.js` now exports:

```js
export function deriveGroupSlug(name)   // deriveSlug() + .toLowerCase()
```

Identical to `mutations.js`'s `deriveSlug()` in every respect except the final
`.toLowerCase()`, so `_` and `.` still survive (`nolan_honest_fans`,
`11711_gitlab` are anchor routes) and only runs of other characters collapse
to `-`.

**Exactly two call sites should change, both group-only. Do not touch any project
path — the project anchors are deliberately mixed case
(`/byteblaze/AGISite`, `/byteblaze/Awesome_DIY_ideas`).**

| File | Line | Change |
|---|---|---|
| `src/pages/NewGroup.jsx` | 7 | `import { createGroup, deriveSlug } from '../components/create/mutations.js'` → keep `createGroup`; add `import { deriveGroupSlug } from '../utils/dataManager.js'` |
| `src/pages/NewGroup.jsx` | 112 | `setPath(deriveSlug(value))` → `setPath(deriveGroupSlug(value))` |
| `src/pages/NewGroup.jsx` | 119 | `(path \|\| deriveSlug(trimmed))` → `(path \|\| deriveGroupSlug(trimmed))` |
| `src/pages/GroupSettings.jsx` | 7 | add `import { deriveGroupSlug } from '../utils/dataManager.js'` |
| `src/pages/GroupSettings.jsx` | 58 | `const next = deriveSlug(path)` → `const next = deriveGroupSlug(path)` |

`NewProject.jsx:198,205` and `ProjectSettingsGeneral.jsx:149` must **keep**
`deriveSlug`. `mutations.js` itself needs no edit.

---

## 5 · What I could not confirm by driving — honest list

24 Observable rows are marked ⚠. In every case the control exists and the handler
is readable; what I lack is a captured `/go` diff. Grouped by why:

**(a) My selector was wrong and I ran out of budget** — no reason to think these
are broken:
`Create project from template`, `Toggle MR draft`, `Edit merge commit message`,
`Delete an issue`, `Remove a group share`, `Import members from another project`,
`Bulk Edit issues → Update all issues`, `Edit / Close / Delete a milestone`,
`Delete a label`, `Dismiss a page banner`, `Collapse the left sidebar`.

**(b) Genuinely suspicious — worth a look from shard A or the audit:**

1. **`/-/profile/keys` "Add key" cannot be clicked.** The button is present,
   `type="submit"`, and `is_disabled() === False`, but a normal Playwright click
   times out on it, which means it is not *actionable* — obscured by another
   element or zero-size. A `force=True` click also produced no `/go` diff. So
   `ui.sshKeys` was never written in any of my runs. This is the shape of a real
   defect, not a selector miss.
2. **Issue sidebar time tracking never wrote `time_estimate` / `total_time_spent`.**
   The `+` control opens, but filling and blurring the two text inputs produced no
   diff in three attempts. `IssueDetail.jsx:449-454` uses `defaultValue` +
   `onBlur`; worth checking that the inputs I found are the right ones and that
   `onBlur` actually fires.
3. **`/-/profile/personal_access_tokens`**: `#personal_access_token_scopes_api`
   was not present when I re-loaded the page in the compact pass, though the DOM
   recon had listed it. Possibly a render-order flake, possibly conditional.
   `ui.accessTokens` and `ui.feedToken` are therefore both unverified.
4. **Members table role/expiry/remove.** The Max-role control is **not a
   `<select>`** — it is a dropdown button, `aria-label="Change role of <name>"`,
   with a sibling `Remove member`. Selecting through it and confirming the removal
   produced no diff for me. Note the controls only render where byteblaze can
   manage members (`/byteblaze/a11y-webring.club` shows only `Leave`, which is
   correct), so test on `/a11yproject/a11yproject.com`.

**(c) Not yet wired anywhere** — expected, and mine to hand over:
`repo.branchDeletions` / `repo.tagDeletions`. The channel exists and is
documented; §4 is the message to shard A.

---

## 6 · Build

```
vite v5.4.21 building for production
✓ 163 modules transformed
dist/index.html                   0.54 kB │ gzip:     0.35 kB
dist/assets/index-*.css          33.39 kB │ gzip:     7.40 kB
dist/assets/index-*.js        5,740.18 kB │ gzip: 1,527.27 kB
✓ built in 2.95s
```

**PASS.** Only the pre-existing chunk-size advisory. `dataManager.js` also parses
clean under `node --check`.

---

## 7 · One loose thread, stated as an observation and not as a finding

Across all four driving passes a stray `.mock-states/r4d.json`, `r4e.json` and
`r4f.json` appeared alongside the per-flow sids — i.e. some `POST /post` arrived
with a **truncated sid** (`r4d` rather than `r4d07`). It never affected a captured
diff, because every read used the full sid.

**I did not determine the cause and it may well be my own harness**: my first-pass
`nav()` helper appended `?sid=` *after* a URL fragment on the two hash routes
(`/projects/new#blank_project`, `/groups/new#create-group-pane`), which is a bug
in the script, not in the app. I deleted the probe state files before I thought to
diff them, so I cannot now tell the two explanations apart. Recording it so the
next person who sees a short sid has a starting point — **not** filing it as a
routing defect.
