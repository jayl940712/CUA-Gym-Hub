# DEV round 10 — closing the last P1 diffs

Round: 10 · sole dev agent · owns the whole tree.
Input: `TEST.md` §8, §9.2, §10 (round 9, gating round).
Goal: criterion 4 — zero P1 source-vs-mock diffs — plus the six P2 handbacks.

Written incrementally. Anything below marked `DONE` is landed in the tree.

---

## Recon notes (ground truth pulled this round)

### DIFF-901 — the seed gap is real

`src/data/merge_requests.json` carries **no per-MR commit data at all** (fields
are `id, iid, project_id, source_project_id, title, description, author_id,
state, draft, source_branch, target_branch, milestone_id, merge_status,
assignee_ids, reviewer_ids, label_ids, created_at, updated_at, merged_at,
merged_by_id, user_notes_count, squash`). `MergeRequestDetail.jsx:144` calls
`getCommits(state, project, mr.source_branch)`, and `getCommits` ignores the ref
entirely (`dataManager.js:499`) — it returns the project's whole frozen history.
That is why every MR of `a11y-webring.club` shows the same 40 commits.

So this is a **SEED GAP**, extracted read-only from Postgres, not approximated.

Source of truth (SELECT only, `gitlab` container, `gitlabhq_production`):

```sql
SELECT mr.id, mr.iid, mr.target_project_id, d.commits_count, d.files_count,
       d.real_size, c.relative_order, encode(c.sha,'hex'), c.message,
       c.authored_date, c.committed_date, au.name, au.email, cu.name, cu.email
FROM merge_requests mr
JOIN merge_request_diffs d        ON d.id = mr.latest_merge_request_diff_id
JOIN merge_request_diff_commits c ON c.merge_request_diff_id = d.id
LEFT JOIN merge_request_diff_commit_users au ON au.id = c.commit_author_id
LEFT JOIN merge_request_diff_commit_users cu ON cu.id = c.committer_id
WHERE mr.id IN (<the 729 ids already in merge_requests.json>)
ORDER BY mr.id, c.relative_order;
```

729 / 729 seeded MRs resolve a diff. 2 543 commit rows, 4 968 changed files.

Cross-check against the live source, MR `!40` of `byteblaze/a11y-webring.club`
(mr id 138783):

| badge | source HTML | DB |
|---|---|---|
| `Commits` | 4 | `commits_count = 4`, 4 diff-commit rows |
| `Pipelines` | 1 | 1 row in `ci_pipelines` for project 179 |
| `Changes` | 7 | `files_count = 7` |

The pipeline row's `sha` is `4817a445d1b74904…`, i.e. the MR's own
`relative_order = 0` commit, and its `ref` is the MR's source branch — so the
Pipelines badge is `ci_pipelines WHERE project_id = source_project_id AND ref =
source_branch AND sha IN (mr commit shas)`, which is GitLab's `all_pipelines`.

Rendered-DOM capture of the source's Commits tab (it is a Vue island — the
server HTML ships an empty `<div id="commits">`, so this had to come from a real
browser) saved to `assets/html/mr-a11ywebring-40-commits.html`.

Shape differences from the project commit list already in `RepoCommits.jsx`:
- row link is `…/-/merge_requests/:iid/diffs?commit_id=<sha>`, not `/-/commit/<sha>`
- no `Browse Files` button; a `js-commit-pipeline-status` div sits in its place
- an extra `<span class="commit-row-message d-inline d-sm-none">·<sha8></span>`
- day grouping, `commit-header` / `commits-row` structure and the
  `DD Mon, YYYY` + `N commit(s)` header are identical.

---

## DIFF-902 — file-tree ordering — **DONE**

`src/pages/RepoTree.jsx` `entriesAt()` sorted with `localeCompare`, which is
case-insensitive. Replaced with a `byName` comparator that is a plain `<` on the
raw name (UTF-16 code units == UTF-8 byte order across the BMP). Directories
still sort before files.

Verified in a real browser, mock vs live source, entry list read off the tree
table and compared element by element:

| project | result |
|---|---|
| `primer/design` (mixed case: `CODE_OF_CONDUCT.md` … `babel-defines.js`) | **MATCH**, 20 / 20 |
| `byteblaze/dotfiles` | **MATCH**, 39 / 39 |
| `a11yproject/a11yproject.com` | **MATCH**, 23 / 23 |
| `byteblaze/a11y-webring.club` | **MATCH**, 27 / 27 |
| `…/-/tree/main/data` | **MATCH**, 3 / 3 |
| `…/-/tree/main/data/members` | **MATCH**, 39 / 39 |

`zhongyang219/TrafficMonitor` differs, but **not on ordering**: the mock's 11
entries are in exactly the source's order; the source additionally lists 7
directories (`.github/workflows`, `OpenHardwareMonitorApi`, `PluginDemo`,
`Screenshots`, `TrafficMonitor`, `UpdateLog`, `include`) that the seed never
sampled — `repo_trees.json` holds 11 top-level blobs for that project and no
sub-tree blobs, so `entriesAt()` has nothing to derive the directories from.
Pre-existing seed-sampling gap, unchanged by this round, logged below.

## DIFF-903 — the phantom `"data` directory — **DONE, root cause fixed in the seed**

Not a renderer bug. `git ls-tree` quotes any path containing a non-ASCII byte
and escapes those bytes in octal (`core.quotePath`, on by default):

```
"data/members/Cristian D\303\255az.json"
```

The extraction stored that rendering verbatim, so the leading `"` became a path
component and `entriesAt()` correctly derived a directory called `"data`. Five
paths were affected, in two projects:

| seed | paths |
|---|---|
| `repo_trees.json` | 4 in `byteblaze/a11y-webring.club` (`Cristian Díaz`, `Luce Carević`, `Taner Aydın`, `Zoë Bijl`), 1 in `zhongyang219/TrafficMonitor` (`皮肤制作教程.md`) |
| `tree_last_commits.json` | the same 5, plus the two derived directory keys `"data` and `"data/members` |
| `repo_files.json` | none — no blob body was sampled for those paths |

Fixed by decoding git's C-style quoting in place (`/tmp/fix_quoted_paths.py`,
the same octal/escape rules git's `unquote_c_style` uses). The two phantom
directory keys collapse onto the real `data` / `data/members` entries that were
already there. No id, sha or timestamp was touched.

Confirmed against the live source: `…/-/tree/main/data/members` now lists the
same **39** files in the same order as the source, `Cristian Díaz.json` and
`Luce Carević.json` among them, and there is exactly one `data` directory.

## DIFF-901 — MR Commits tab — **DONE**

New STATIC seed `src/data/merge_request_diffs.json` (478 KB, 729 MRs, 2 543
commit rows, 112 pipelines), imported as `staticRepo.mrDiffs` and read through
`getMrDiff(mr)` in `dataManager.js`. It is reference data: it is never copied
into `state`, so the mutable-state budget is untouched.

`MergeRequestDetail.jsx` no longer calls `getCommits(state, project,
mr.source_branch)` — that accessor is ref-agnostic and was handing every MR the
project's own 40-commit history.

Tab badges are now all four of the source's, from the MR's own record.
Verified in a real browser at 1280×720 and 1920×1080, mock vs live source:

| MR | source tabs | mock tabs |
|---|---|---|
| `byteblaze/a11y-webring.club!40` | `Overview 0 · Commits 4 · Pipelines 1 · Changes 7` | **identical** |
| `a11yproject/a11yproject.com!1265` | `Overview 1 · Commits 1 · Pipelines 0 · Changes 2` | **identical** |
| `a11yproject/a11yproject.com!1531` | `Overview 0 · Commits 1 · Pipelines 1 · Changes 2` | **identical** |

Commit rows and day headers on `!40` also match the source exactly —
`26 Jan, 2023 / 1 commit` then `22 Jan, 2023 / 3 commits`, titles
`Merge branch 'main' into add-verification-function`, `Register both
verification functions to run on a schedule.`, `Added two different verification
functions.`, `Don't include vscode debug stuff.` — and the DOM is the source's
(`ol#commits-list` › `li.commit-header` / `li.commits-row` › `li.commit`, row
link to `…/diffs?commit_id=<sha>`).

0 console errors, 0 pageerrors at both viewports.

An MR a task creates in-session has no frozen diff; its tabs read `0` and its
lists render empty rather than borrowing another MR's commits.

---

## DIFF-904 — MR Changes tab vs `ROUTES.md` row 81 — **DONE (row corrected, and the tab improved)**

The row's claim was not made true: the diff bodies for the 729 seeded MRs are
**19 231 119 bytes** in `merge_request_diff_files` (measured, SELECT only), and
the paths alone are another 682 KB. Carrying either to satisfy a P2 that no
evaluator reads is a bad trade against a ~19 KB state headroom and a ~5.5 MB
seed. Rows 80 / 81 / 82 now say what actually ships:

- 80 → data source `merge_request_diffs.json`, "the MR's OWN commits", `[x]`
- 81 → `[~]`, P2, states plainly that the badge count is real and the diff
  bodies are not carried, with the 19 MB reason
- 82 → the Pipelines tab and its real pipeline row

The tab body itself no longer says only "not rendered": it now reports the
source's own `files_count` — `7 changed files between github/fork/davepgreene/
add-verification-function and main. Diff contents are not rendered in this
instance.`

## DIFF-905 — project-settings breadcrumb tail — **DONE**

`Breadcrumbs.jsx` mapped `edit` → `Repository` and every `/-/settings/*` page →
a single `Settings`. Neither is derivable from the path segment, so the seven
labels come from the `BreadcrumbList` JSON-LD of the captures in `assets/html/`,
and `resolveRouteContext` now carries `infix` so `/:ns/:proj/edit` (General
Settings) is told apart from `/:ns/:proj/-/edit/:ref/*path` (the file editor).

| page | source | mock (browser, this round) |
|---|---|---|
| `/byteblaze/dotfiles/edit` | `Byte Blaze / dotfiles / General Settings` | **matches** |
| `…/-/settings/repository` | `… / Repository Settings` | **matches** |
| `…/-/settings/ci_cd` | `… / CI/CD Settings` | **matches** |
| `…/-/blob/main/README.md` | `… / Repository` | unchanged — still `Repository` |

`merge_requests` → `Merge requests`, `integrations` → `Integration Settings`,
`access_tokens` → `Access Tokens`, `operations` → `Monitor Settings`,
`packages_and_registries` → `Package and registry settings` are wired from the
same captures.

## DIFF-906 — issue/MR content depth — **DONE (3 of 4 parts)**

**Task lists.** `markdown.js` rendered `- [ ]` as literal text. It now emits the
source's markup — `<ul class="task-list">` › `<li class="task-list-item enabled">`
› `<input type="checkbox" class="task-list-item-checkbox">` — and the issuable
header carries `#task_status` / `#task_status_short`. On issue 71 the mock now
reads **`1 of 3 checklist items completed`**, which is the source's string
character for character, with 3 boxes and 1 ticked.

List items had to be buffered until the list closes (the `task-list` class is on
the `<ul>`), which exposed a latent ordering bug: a lazy continuation line after
a list would have emitted its `<p>` ahead of the list. `flushPara()` now closes
the list first. Verified through the app with an injected description mixing a
task list, a lazy tail, a heading and a plain list:
`UL.task-list · P · H3 · UL` — correct order, `task-list` only on the task list.

**The checkboxes are live**, as they are on the source: ticking one rewrites the
`- [ ]` in the description source and persists. Driven end to end on a fresh sid:
`1 of 3` → click → `2 of 3` → **reload** → `2 of 3`, 2 boxes checked → click →
`1 of 3`; `/go` `state_diff` = `{issues}`. No new state key — it lands on
`issues.changed → [].description`, which `SCHEMA.md` already documents.

(React's synthetic `change` never reaches a node injected through
`dangerouslySetInnerHTML` — it has no fiber. The handler listens for `click`,
which React does dispatch to the nearest fiber ancestor. `onChange` was tried
first and silently did nothing; recorded so it is not re-tried.)

**Author role badges.** `projectRoleFor()` in `dataManager.js` returns the
member role, else `Contributor` when the user has committed to the repository.
Issue 71 now renders both of the source's pills:
`Contributor` / *"This user has previously committed to the a11y-webring.club
project."* on `@Seirdy`, and `Owner` on the note author — the first is verbatim
the source's string and tooltip. The contributor test matches on NAME first
because the seed's user emails were anonymised to `@fakegithub.com` while
`contributors.json` keeps the real commit addresses.

**`Tasks` / `Linked items` cards.** Both now render between the description and
Activity with the source's headings, `0` counts, empty-state copy
(`No tasks are currently assigned. Use tasks to break down this issue into
smaller parts.`, `Link issues together to show that they're related. Learn
more.`) and working collapse toggles.

**Not done — the design dropzone.** `Drag your designs here or click to upload.`
is the visible face of GitLab design management (upload, version, comment on
designs). Shipping the dropzone without it would be a dead affordance. Logged
below rather than faked.

## DIFF-907 — project-overview chrome — **DONE (4 of 6 parts)**

**Languages bar.** New STATIC seed `src/data/repo_languages.json` (12 KB, 151
projects, 407 rows) from `repository_languages` × `programming_languages`.
Rendered where the source puts it, below the home panel. Compared against the
live source on 5 projects — `primer/design`, `a11y-webring.club`, `dotfiles`,
`a11yproject.com`, `root/metaseq` — **name, width and colour identical on all
20 bars**, and the `title` now carries the source's own
`<span class="repository-language-bar-tooltip-language">…` markup.

**Stats row layout.** The markup already matched the source; what was missing was
that `.project-stats .nav` had no rule, so the `<ul>` fell back to a stacked
bulleted list. Added the flex/list-style rule. Now **one row on all 5 projects at
both viewports**. The storage cell is also a `div.stat-text` rather than a link
to `/-/usage_quotas`, which is what the source renders.

**`Project Storage` figure.** Not unanchored drift — the mock was printing
`project_statistics.repository_size` where GitLab prints `storage_size`
(repository + wiki + LFS + packages). `a11y-webring.club`: 1 667 235 → `1.6 MB`
(wrong) vs 2 033 800 → `1.9 MB` (the source's). Repointed `projects[].repo_size`
at `storage_size` for all 175 projects — **+27 bytes of mutable state**. All 5
compared projects now print the source's figure (`97.8 MB`, `85.5 MB`, `32.4 MB`).

**`MIT License` button label.** GitLab runs Licensee over the LICENSE blob.
Licensee is not portable to the browser, so `detectLicense()` matches a licence's
own VERBATIM text in the real blob, and only when that text starts within the
first 128 normalised characters — i.e. with nothing but a copyright header in
front of it. That leading-offset rule is what reproduces Licensee's ~98%
similarity threshold.

Checked against the **live source** on every public seeded project whose LICENSE
body is in the seed: **27 / 27 exact agreement**, including the four that must
read plain `LICENSE` (`vinta/awesome-python`, `koush/AndroidAsync`,
`byteblaze/ericwbailey.website`, and `amwhalen/archive-my-tweets`, which prefixes
its MIT text with a sentence of prose and which a naive substring match got
wrong). GPL uses Licensee's NICKNAME (`GNU GPLv3`), which is what the source
renders. The chip also carries the source's `itemprop="license"` and
`<span class="project-stat-value">` wrapper.

**Not done:** the `Unverified` GPG badge on the commit header (needs
`gpg_signatures`, a further extraction) and per-type coloured file icons. Both
logged below.

## DIFF-908 — `SCHEMA.md` state key — **DONE**

Line 31's table now lists the **state keys** and reads `mergeRequests`, with an
explicit sentence that it is loaded from `src/data/merge_requests.json`. The two
other `merge_requests` occurrences in `SCHEMA.md` (lines 302, 383) are URL path
segments and feature-settings keys, not state keys, and are correct as they are.

---

## Regression evidence

- `assets/route_smoke.py` — **201 routes cold-loaded, 0 failing**, run twice
  (after the DIFF-901/902/903 work and again after the markdown reorder).
- Round-8 geometry unchanged. `#content-body` / `aside.nav-sidebar` /
  `aside.right-sidebar` at 1280: `272–974`, `0–256`, `990–1280`, gap `16`,
  h-overflow `0`; at 1920: `464–1422`, `0–256`, `1630–1920`, gap `208`,
  overflow `0` — on the issue, the MR, the new MR Commits tab and the project
  overview.
- Anchors re-read in a browser: `.detail-page-description > a.gl-font-monospace`
  → `['github/fork/davepgreene/add-verification-function', 'main']`;
  `.block.reviewer`; `[data-qa-selector="title_content"]`; `#notes-list`
  `lastElementChild .timeline-discussion-body`;
  `td[data-label='Account'] span.gl-avatar-labeled-sublabel` +
  `td.col-max-role` → `['Maintainer','Developer','Owner']`;
  `.visibility-icon` title; `.user-profile`; `[data-qa-selector="projects_list"]`.
  All intact, 0 console errors.
- `npm run build` green (`built in 3.21s`), and every check above was taken in a
  real browser, not off the build.
- Cold state **2 076 882 bytes (1.981 MiB)**, `/go` `state_diff` `{}` on an
  untouched sid. `SCHEMA.md`'s 1.948 MiB was the stale round-4 figure; the real
  headroom to 2 MiB is now ~19 KB and `SCHEMA.md` says so.

## Findings this round did NOT close (for TEST.md / the next round)

1. **Project-level Pipelines pages.** `ProjectOps.jsx` asserts "this WebArena
   GitLab instance has no runners, no pipelines" — that was read off
   `byteblaze/dotfiles` and is wrong for the instance: `ci_pipelines` has
   **1 465 rows across the seeded projects**, and
   `/byteblaze/a11y-webring.club/-/pipelines` renders `All 1` plus a real row on
   the source while the mock shows `There are currently no pipelines.`
   `/-/pipelines/1823` is a **200** on the source and a 404 in the mock.
   Because of that, the MR Pipelines tab renders `#1823` and the status as TEXT,
   not links — a link into a 404 would be a dead affordance. Extraction recipe:
   `SELECT id, project_id, sha, ref, status, source, created_at, finished_at
   FROM ci_pipelines WHERE project_id IN (<the 175 seeded ids>)`.
2. **`zhongyang219/TrafficMonitor` tree is missing 7 directories.** The source
   lists `.github/workflows`, `OpenHardwareMonitorApi`, `PluginDemo`,
   `Screenshots`, `TrafficMonitor`, `UpdateLog`, `include`; `repo_trees.json`
   sampled only the project's 11 top-level blobs, and `entriesAt()` derives
   directories from blob paths. Ordering of the 11 it does have matches the
   source exactly. Seed-sampling gap, pre-existing.
3. **Branch counts are capped at 30 per project.** `primer/design` shows
   `30 Branches` against the source's `38`, `root/metaseq` `30` against `112`.
   `branches.json` sampling limit, pre-existing.
4. **`a11yproject/a11yproject.com` overview lacks the `5 Releases` stat item**
   the source shows. Pre-existing.
5. **Design management** (`Drag your designs here or click to upload.`) — see
   DIFF-906.
6. **`Unverified` GPG badge** and **per-type coloured file icons** — see
   DIFF-907.
