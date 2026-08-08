# DEV — Fix shard 1 (pipeline / state plumbing)

> Owned files: `src/utils/**`, `src/context/**`, `vite.config.js`
> Verified by driving chromium against `npm run dev -- --port 5191`, not by reading.
> Build: **PASS** (`npm run build`, 155 modules, 2.6 s).

---

## CLOSED

### P0 — PIPELINE-001 / PARITY-001 / PARITY-002 · id counters collided with the seed

`nextIds` is no longer a table of hand-picked constants. `src/utils/dataManager.js`
now derives every counter from the seed at module load:

```js
export const SEED_NEXT_IDS = Object.freeze({
  project:   maxId(projectsSeed)      + 1,
  group:     maxId(groupsSeed)        + 1,
  issue:     maxId(issuesSeed)        + 1,
  mr:        maxId(mergeRequestsSeed) + 1,
  note:      maxId(notesSeed)         + 1,
  label:     maxId(labelsSeed)        + 1,
  milestone: maxId(milestonesSeed)    + 1,
  member:    maxId(membersSeed)       + 1,
})
```

All eight, not just the two that were caught. Resampling the seed can no longer
put a counter back inside the real id range.

| counter | was | now | real max in seed |
|---|---|---|---|
| project | 194 | **194** | 193 |
| group | 7 | **7** | 6 |
| issue | 90000 | **83821** | 83820 |
| mr | 140000 | **139278** | 139277 |
| note | 310000 ❌ | **310827** | 310826 |
| label | 1800 ❌ | **1927** | 1926 |
| milestone | 600 | **590** | 589 |
| member | 600 | **206** | 205 |

Second guard, in `src/context/AppContext.jsx` `allocateId`: the candidate id is
now checked against the ids already present in the target collection
(`ID_KIND_COLLECTION` maps `kind → state collection`) and skipped past if taken.
That covers the case the derivation cannot — a task injecting records at or
above the counter.

**Driven** (sid `fix1L`, the exact PIPELINE-001 repro — six labels created back
to back through `/byteblaze/dotfiles/-/labels/new`):

```
BEFORE:  labels.added   1800..1804          <- the 6th label MISSING
         labels.changed [1805 'bug' -> 'AUDITLBL6']   <- reported as a SEED EDIT

AFTER:   labels.added   [(1927,'FIX1LBL1') (1928,'FIX1LBL2') (1929,'FIX1LBL3')
                         (1930,'FIX1LBL4') (1931,'FIX1LBL5') (1932,'FIX1LBL6')]
         labels.changed []
         labels.removed 0
         nextIds.label  1927 -> 1933
```

Duplicate-id sweep over the whole post-mutation state: `labels 636 unique ·
notes 1599 · issues 613 · mergeRequests 729 · projects 175 · groups 2 ·
milestones 202 · members 183 · users 1133 · todos 7` — **zero duplicates in any
collection.**

Also driven end to end for the other allocation paths: a comment allocated note
**310827** (`notes.added` 1, `notes.changed` 0, `issues.changed` 83730
`user_notes_count 2→3`); a blank project create allocated project **194** and
member **206** (`mutations.js` reads `prev.nextIds` directly rather than through
`allocateId`, so it was worth confirming separately).

### P1 — PIPELINE-003 · `state.snippets` had no baseline

`createInitialData()` now returns `snippets: []`, and `snippets: 'id'` was added
to `KEYED_COLLECTIONS` in `src/utils/stateTracker.js`.

**Driven** (sid `fix1S`) — creating a snippet now diffs in the same shape as
every other collection:

```
initial_state.snippets = []
state_diff.snippets = {"added":[{"id":1,"title":"FIX1 snippet",…}],"removed":[],"changed":[]}
```

Previously: `{"new":[…]}` with no `old` at all.

### P1 — PIPELINE-004 · two POSTs per logical mutation

Two independent changes, both needed:

1. **`allocateId` no longer persists.** It was calling `saveState()` from inside
   its own updater, then the caller's `appendTo` called it again. The counter
   bump now rides the caller's single `setState`, which carries the new record
   too. `prev` in the second updater is the result of the first, so nothing is
   lost.
2. **`saveState` coalesces and serializes** (`src/utils/dataManager.js`). Writes
   queued in the same task collapse into one POST carrying the latest state
   (a **microtask**, not a timer — `/go` must reflect a mutation as soon as the
   click's work is done, so this adds no latency). Each POST is then chained onto
   the previous one's promise, so a later state can never land before an earlier
   one even across ticks. `publishInitialState` goes through the same chain, so a
   mutation in the first tick after boot can no longer be overwritten by the
   pristine baseline post. A `flushState()` export forces the queue out.

**Driven** — POST count for one logical mutation, measured on the network:

| mutation | POST `/post` before | after |
|---|---|---|
| post a comment | 2 | **1** |
| star a project | 2 | **1** |
| create a snippet | 2 | **1** |

### P1 — PIPELINE-002 · fork copied every blob into `fileOverlay` — **read side closed, write side handed off**

A fork is now modelled as an **alias**. `state.repo.forkOrigin` maps
`"<fork full_path>" → "<source full_path>"`, and a new `originPath(state, fullPath)`
walks that chain (fork-of-a-fork included, cycle-safe). Every static read in
`dataManager.js` goes through it — `getRepoFile`, `getRepoTree`, `getCommits`,
`getBranches`, `getTags`, `getContributors`. Overlay reads still use the fork's
**own** path, so a file edited after the fork stays local to the fork, which is
the behaviour that matters.

`getContributors` / `contributorRefs` gained an **optional trailing `state`
argument**; existing two-argument callers are unchanged and simply do not get
fork fallthrough for the contributors page.

**Driven** (sid `fix1F`): injected `byteblaze/dotfiles-fork` with
`forkOrigin: {"byteblaze/dotfiles-fork": "byteblaze/dotfiles"}` and **zero**
`fileOverlay` keys, then compared it against the source project page for page:

| route | source body | fork body | |
|---|---|---|---|
| `/-/tree/main` | 40 tree rows | **40 tree rows** | match |
| `/-/blob/main/README.md` | 7059 chars | 7074 | match (delta = project name in breadcrumb) |
| `/-/commits/main` | 3295 | 3310 | match |
| `/-/branches` | 893 | 903 | match |
| `/-/tags` | 0 | 0 | match |

Zero console errors, zero page errors. `state_diff` for the fork is empty of
blob bodies.

**Still needed — I do not own the file.** See "Handed off" below: until
`forkProject()` in `src/components/create/mutations.js` stops copying, the
over-copy is still live. The read side is ready and waiting for it.

### P2 — PIPELINE-007 · `reset` semantics

Behaviour **unchanged** — this is a decision, now recorded as one. `vite.config.js`
carries a comment explaining why `reset` restores `<sid>.json` from
`<sid>.initial.json` and keeps both files rather than deleting them per
`.claude/agents/audit.md §3b`: the migration brief requires restore, an RL rollout
needs it between episodes, and deleting the baseline would make the next `/go`
diff against a freshly-captured (already-mutated) baseline instead of the injected
task state — exactly what `publishInitialState` exists to prevent. Delete-both is
still reachable: with no baseline to restore, `reset` falls through to
`clearState()`.

**Driven:** `POST {action:'reset'}` → `{"success":true,"message":"State reset to
initial."}`, and `/go` `state_diff` `{}` immediately after.

### P2 — PARITY-009 · `ui.starredProjectIds`

Removed from `createInitialData()`, per the orchestrator's ruling. `state.stars`
is now the single source of truth. No crash window materialised: shard 3 had
already deleted the `ProjectOverview.jsx:100-107` sync block by the time I made
the edit, so both halves landed in the same round. `grep -rn starredProjectIds
src/` returns nothing.

**Driven** (sid `fix1S`): starring `byteblaze/dotfiles` emits exactly
`projects` + `stars` in the diff, no `ui.*` key, one POST.

### Cross-shard — `slugify()` in `src/utils/format.js`

Fixed even though it is latent (HANDLER-010: zero callers). It collapsed `_` and
`.` to `-`, which would have rewritten every underscore-named anchor route
(`nolan_honest_fans`, `web_agent_android_xl`, `11711_gitlab`, `coding_friends`, …)
the moment anyone wired it up. Now `trim().replace(/[^a-zA-Z0-9_.-]+/g,'-')` with
edges stripped and case preserved — identical to `deriveSlug()` in `mutations.js`.
The comment records that the two should be collapsed into one when a round owns
both files.

---

## PARTIAL — P1 PARITY-008 / P2 PIPELINE-005 · payload size

**Stopped at the safe point, as the brief instructs.** I did not touch anchored
data and did not sample out any record.

What landed, all in `vite.config.js`, all zero-risk:

| | before | after |
|---|---|---|
| `.mock-states/<sid>.json` on disk | 2.88 MB | **2.23 MB** (compact, not 2-space indented — indentation was ~650 KB of pure whitespace, paid on every `/post` write and re-parsed on both halves of every `/go`) |
| `POST /post` response body | ~2.2 MB (echoed the whole state) | **69 bytes** |
| `GET /go` response | ~5.8 MB | **4.25 MB** |

The `/post` echo is the bigger practical win: it was a 2.2 MB download **per
mutation** for a body no caller reads (`saveState` and `publishInitialState` both
discard the response; `/state` and `/go` are how you read state back).

**What I did NOT do, and why.** `createInitialData()` output is still 2.23 MB,
above the ~1–2 MB budget. Getting under it needs the seed itself cut, and I
found no safe way to do that from inside `src/utils/`:

- I measured every field. The bulk is `notes.body` 249 KB, `issues.description`
  208 KB, `merge_requests.description` 165 KB — all rendered page text.
- I grepped every candidate field for readers. Everything has one except
  `notes.discussion_id` (92 KB, written by `NotesTimeline.jsx:111` and never
  read). It is a real seed identifier and the obvious first cut, but dropping an
  identifier is a seed decision, not a shard's.
- Dropping the 190 users no record references buys only **43 KB** of 264 KB, and
  they are still reachable through the search "Users" scope.
- **The notes trim the audit recommends is not safe as specified.** I checked the
  whitelist: **36 of the 252 anchor strings occur verbatim inside note bodies**,
  across 33 distinct notes — i.e. agent answers are being read out of comment
  threads. Trimming "unanchored noteables" would silently delete the answer to a
  `string_match` task, which is a P0 regression traded for a P1 budget number.

Recommendation: the real fix is a seed re-cut, which `.claude/agents/dev.md` §3
makes an explicit **serial orchestrator step** ("never regenerate seed data while
sharded"). Cheapest order for whoever runs it: drop `notes.discussion_id`
(92 KB), then trim note bodies only for noteables that survive an
anchor-string containment check.

---

## Nondeterminism audit of owned files (requested by the orchestrator)

Swept `src/utils/**`, `src/context/**`, `vite.config.js` for `Math.random`,
`Date.now`, `new Date`, `randomUUID`, `crypto`, `performance.now`.

**One real hit, fixed — `vite.config.js:150`.** The `/upload` handler named
stored files `${randomUUID().slice(0,8)}_${filename}`. GitLab's upload surfaces
(issue attachments, avatars) put the returned `url` into state, so once anyone
wires them up that random prefix lands in the `/go` diff and changes on every
run — the same class as the `makeSha()` bug. Latent today (`/upload` has **zero**
callers in `src/`), fixed anyway. The prefix is now a SHA-1 of the file bytes,
which is stable across runs, unique per distinct file, and idempotent on
re-upload.

**Driven** (port 5192): the same bytes uploaded under two different sids both
stored as `8744f828_fix1up.txt`; different bytes stored as `28a153cd_fix1up2.txt`;
`GET /files/<sid>/8744f828_fix1up.txt` returns 200 with the right body.

**No other hits.** `src/utils/format.js` is the only other file with date calls
and they are all render-time — `parseDate`, `formatTimeTooltip`, `isoDateTime`
derive display strings from seed values and never touch state. `timeAgo(value,
now = Date.now())` produces drifting text ("3 years ago") by design, per the
file header, and matches the source's live behaviour; it is not persisted.
`dataManager.js`, `stateTracker.js`, `markdown.js`, `RedirectWithQuery.jsx` and
`AppContext.jsx` mint no values at all.

**Adjacent finding, not mine to fix — created timestamps use the wrong shape.**
The seed stores Postgres dumps: `"2023-03-19 16:45:03.408771"`. `mutations.js`
has `dbStamp()`, which produces exactly that, and the create flows use it. But
~20 call sites across `src/pages/**` mint `new Date().toISOString()` instead →
`"2026-08-07T22:25:27.722Z"`, a visibly different format from every seeded record
in the same collection (`NewIssue:60`, `NewLabel:50,58`, `NewMilestone:47`,
`LabelsList:185`, `MembersTable:145,581,676`, `ProjectOverview:105`,
`NewSnippet:53`, `ProfileKeys:62`, `IssueDetail:94,143`, `IssuablesList:395,398`,
`EditIssue:60`, `EditMergeRequest:64`, `MilestoneDetail:120`, `NewTag:43`).
Not a correctness break — `format.js parseDate()` normalises both shapes, so
rendering and lexicographic sorting are unaffected — but a created record is
trivially distinguishable from a seeded one in the diff. The fix is to import
`dbStamp` from `mutations.js` at those call sites. Legitimately "now", so per
the orchestrator's rule the value stays; only the format is wrong.

---

## Handed off — NEEDS FILE

1. **`src/components/create/mutations.js` — `forkProject()` (blocks PIPELINE-002
   write side).** Delete the whole `// --- copy the repo ---` block (`:377-403`)
   and the four `*Overlay` writes at `:424-430`. Replace with:

   ```js
   repo: {
     ...prev.repo,
     forkOrigin: { ...(prev.repo.forkOrigin || {}), [fullPath]: source.full_path },
   },
   ```

   Nothing else. Reads resolve through the origin automatically — verified above.
   Two follow-ons in the same file once that lands: `writeFiles()` builds its
   `known` set and its branch-exists check from `staticRepo.trees[fullPath]` /
   `staticRepo.branches[fullPath]`, which are empty for a fork; they should use
   `originPath(prev, fullPath)`. Harmless today (`getRepoTree` dedupes by path),
   but it puts redundant entries in `treeOverlay`.

2. **`src/components/create/mutations.js` — `deriveSlug()` (PIPELINE-006, P2).**
   Not fixed: `deriveSlug` is shared by project and group creation, and the
   project anchors are deliberately mixed case (`/byteblaze/Do-it-myself`,
   `/byteblaze/AGISite`, `/byteblaze/Awesome_DIY_ideas`). Lower-casing it for
   groups needs a separate group-only path — a one-line `deriveGroupSlug()` that
   wraps `deriveSlug(name).toLowerCase()`, called from `NewGroup.jsx` and
   `GroupSettings.jsx`. Real GitLab lower-cases namespace slugs; no anchor breaks
   either way (all five anchored groups are already lowercase), which is why it
   stayed P2 rather than my guessing at it across three files I do not own.

3. **`src/components/create/mutations.js:62` — `makeSha()` uses `Math.random()`.**
   Reported out of dimension by the parity auditor and still true. Commit SHAs
   land in `state.repo.commitOverlay`, so the `/go` diff is non-deterministic
   across runs. Deriving the sha from path + body + title would make forks and
   file-creates reproducible.

---

## Blocking bug found while verifying — NOT mine, reported to the lead

Four routes are a white screen right now with
`ReferenceError: QueryForm is not defined`:

```
src/pages/DashboardProjects.jsx:113
src/pages/ExploreProjects.jsx:62
src/pages/DashboardTodos.jsx:233
src/pages/LabelsList.jsx:229
```

All four use `<QueryForm>` without importing it; only
`src/pages/IssuablesList.jsx:9` has the import. `/`, `/explore`,
`/dashboard/todos` and `/…/-/labels` all render an empty body. **`npm run build`
does not catch this** — it is a runtime ReferenceError, not a resolve error — so
it will pass the build gate and still be broken. One line per file.

---

## Regression sweep

Route smoke over 20 routes, blank-project create, reset, and two-session
isolation, all in chromium:

- **Renders clean:** `/dashboard/issues`, `/byteblaze/dotfiles`,
  `…/-/tree/main`, `…/-/issues`, `…/-/issues/1`, `…/-/merge_requests`,
  `…/-/milestones`, `…/-/project_members`, `/users/byteblaze`, `/-/profile`,
  `/groups/n-lab`, `/search?search=empathy`.
- **Empty:** the four `QueryForm` routes above — pre-existing, another shard's.
- **404, correctly:** `/nolan_honest_fans`, `/byteblaze/Awesome_DIY_ideas` —
  group-B/C anchor paths `ROUTES.md` says must not be pre-seeded.
- **Create project:** lands on `/byteblaze/FIX1-Proj`, diff is
  `projects.added (194)` + `members.added (206)` + four `repo.*Overlay` keys +
  both counters. No duplicate ids.
- **Reset:** `state_diff` `{}` afterwards.
- **Isolation:** `fix1IA` starred 193, `fix1IB` starred 190, neither session saw
  the other.
