# DEV.r2-lists — Round 2 fix shard 3 of 3 (lists, search, repo views)

Build: **PASS** (`vite build`, 157 modules, no warnings beyond the pre-existing
chunk-size note). Built to `dist-shard3/` and removed, to avoid racing the other
two shards on `dist/`.

Verified by driving chromium at 1920×1080 against `npm run dev -- --port 5213`.
**23 cold deep-links, 0 console errors, 0 pageerrors, `?sid=` survived every load
and every control click.** Every mutation re-checked after a full reload.

---

## Closed

### BUG-A01 · **P0** · project-list sort dropdown dropped `?sid=` — FIXED

The menu emitted query-only hrefs (`href="?sort=name_asc"`), which the global
interceptor in `src/App.jsx:107` skips, so the browser did a real navigation that
replaced the entire query string.

The source does **not** emit query-only hrefs — `assets/html/dashboard-projects-yours.html`
has `href="/dashboard/projects?sort=name_asc"`. Matching the source closes the bug
without touching `App.jsx` (shard 1's file): rooted hrefs go through the interceptor
and keep `sid`.

Verified: `/dashboard/projects?sid=sidtest` → open menu → `Name, descending` →
`…?sort=name_desc&sid=sidtest`, list reordered, toggle label updated.

**Class sweep of my files** — three more sid-dropping controls found and fixed,
all the same `href="?…"` shape:
- `DashboardProjects.jsx` pagination (`?page=N` × 3 links) → rooted, now also
  carries the active name/archived/personal/sort facets.
- `ExploreProjects.jsx` `Next` link → rooted with facets.
- `IssuablesList.jsx:69` `LabelPill` — a dead export (no importers) whose href was
  `?label_name[]=…`. Deleted rather than repaired, so it cannot be picked up later.
  The live row-label links at `:623` were already rooted on `listBase`.

After the sweep, `grep -rE 'href=\{?[\`"'"'"']\?' src/` returns nothing.

### DIFF-003 · P1 · default sort is `Name`, not `Updated date` — FIXED

**Capture used: `assets/html/dashboard-projects-yours.html`** (mtime 12:33:38) and
`assets/html/dashboard-projects.html` (12:33:33). Both show
`<span class="dropdown-toggle-text">Name</span>`, `<a class="is-active" href="…?sort=name_asc">`,
and an alphabetical row order starting `a11y-syntax-highlighting`.

I did **not** load any `?sort=` URL on port 8023. `assets/html/dashboard-sorted.html`
(12:33 → **12:56:58**, 23 minutes later) shows `Most stars` because it *was* captured
that way and made GitLab persist a new `projects_sort` on byteblaze's record. That
capture is deliberately unused; the two clean captures predate it, which is the
evidence that `name_asc` is the shipped image's real preference.

`DEFAULT_PROJECT_SORT = 'name_asc'` now drives `/`, `/dashboard/projects`,
`/dashboard/projects/starred` and `/explore*`.

### BUG-B02 · P1 · sort-direction toggle emitted an invalid value — FIXED

`String(sort).replace(/_(asc|desc)$/,'')` left `created_date` intact, so the
`base === 'created'` branch never fired and the toggle appended `_asc` →
`created_date_asc`, which no sort handler matches.

GitLab's pairs are not a suffix swap (`closed_at` ↔ `closed_at_desc`,
`milestone` ↔ `milestone_due_desc`), so I replaced the arithmetic with the explicit
pair table from `assets/README.md §5a.6` ("Reverse-value aliases"). `sortLabel` now
falls back through the twin so both directions render the same title, and
`isAscending` reads the table instead of a `_asc$` regex.

Verified across 8 starting sorts on `/a11yproject/a11yproject.com/-/issues`:

| start | → toggled to | list reordered |
|---|---|---|
| `created_date` | `created_asc` | ✅ `[Post] HOWTO: Ajax with ARIA-LIVE` → `Create an Offline page` (exactly the proof case in the bug report) |
| `title_asc` | `title_desc` | ✅ |
| `updated_desc` | `updated_asc` | ✅ |
| `popularity` | `popularity_asc` | ✅ |
| `due_date_desc` | `due_date` | ✅ |
| `milestone_due_desc` | `milestone` | ⚠ valid token, no reorder — see "Left open" |
| `closed_at_desc` | `closed_at` | ⚠ same |
| `priority_desc` | `priority_desc` | correct: §5a.6 says priority has no reverse |

Every value emitted is now a real GitLab token, so `sort=created_asc`
(webarena-342's anchor) is reachable by clicking. MR list verified too.

Also matched the source's button per §5a.6: `title="Sort direction"` (was
`Sort direction: Descending`), classes `has-tooltip reverse-sort-btn rspec-reverse-sort`,
and `sort-highest`/`sort-lowest` icons instead of chevrons.

### BUG-A03 / BUG-005 · P1 · fork form was a silent no-op — FIXED

The old code set a single top-of-form `error` string; it never surfaced. Replaced
with the source's own mechanism: per-field BootstrapVue `invalid-feedback` blocks,
with the copy taken verbatim from `assets/html/proj-forks-new.html` —
**`Please select a namespace`** and **`Please select a visibility level`** are the
two strings the source actually ships. Fields also get `is-invalid`, and each
clears its own error on the next interaction.

Verified: `/root/metaseq/-/forks/new` → `Fork project` with nothing filled renders
`Please select a namespace`. Happy path unaffected — namespace → submit →
`/byteblaze/metaseq?sid=fk3`, resolves after reload.

### BUG-B04 · P1 · fork form did not re-derive the slug — FIXED

`#fork-name`'s `onChange` now re-derives `#fork-slug`. The source uses lodash
`kebabCase`, not the `slugify` that `/projects/new` uses — that is why the live
site turns `ChatGPT` into `chat-gpt` rather than `chatgpt`. Implemented a
lodash-compatible word splitter rather than reusing the new-project helper, since
the two forms genuinely differ.

Verified on `/convexegg/chatgpt/-/forks/new`: prefill `Chatgpt`/`chatgpt`, typing
`ChatGPT` → slug `chat-gpt`. Prefill still comes from `project.path` untouched, so
a fork submitted without retyping still lands at `/byteblaze/chatgpt`.

### BUG-A04 · P1 · `/explore/projects/trending` fabricated a list — FIXED

Now renders the source's empty state verbatim from
`assets/html/explore-projects-trending.html`: `<div class="nothing-here-block">`
containing `Explore public groups to find projects to contribute to.` and **zero**
project cards. GitLab CE drives this from the `trending_projects` table, which is
empty on this instance. `/explore/projects/starred` keeps its star-ordered list.

Verified: 0 rows, body text matches.

### BUG-A05 · P1 · `Yours` badge showed the filtered count — FIXED

The badges are now computed from the unfiltered owned/starred sets. Verified
`Yours 14 · Starred 3` on `/dashboard/projects`, `/dashboard/projects/starred`,
`?name=dotfiles`, `?archived=true` and `?page=2`.

### BUG-A06 · P1 · cards dropped the role badge and 2 of 4 counters — FIXED

`ProjectRow` now renders, in the source's DOM order, `stars · forks · merge
requests · issues` — all four, at zero too (confirmed on all 14 rows of
`dashboard-projects-yours.html` and all 20 of `explore.html`). Counts come from
`open_mrs_count` / `open_issues_count`, already in `projects.json`.

The `user-access-role` badge (`data-qa-selector="user_role_content"`) is derived
from `members.json` and renders **only** where the current user is a member — 4 of
20 rows on explore, matching the source exactly. Verified: `Owner` on byteblaze's
repos, `Maintainer` on `a11yproject.com`, `Developer` on `primer/design`.

Bonus: `ProjectRow` already accepted an unused `compact` prop from
`UserProfile.jsx:485`; it now honours it by dropping the namespace prefix, which
closes half of DIFF-A02 (profile panel showing `Byte Blaze / solarized-prism-theme`
instead of the bare path).

### BUG-A07 · P1 · tab strip missing `Topics`, explore lost the strip — FIXED

New shared `src/components/ui/ProjectsNav.jsx`:
- `ProjectsPrimaryTabs` — `Yours N · Starred N · Explore · Topics` on **all** of
  `/`, `/dashboard/projects`, `/dashboard/projects/starred`, `/explore*`.
- `ProjectsFilterControls` — the filter form with the sort dropdown nested inside
  it, as the source nests them, carrying all 15 source menu items in source order:
  `Sort by` header, the 7 sorts, divider, `Hide/Show archived projects`,
  `Show archived projects only`, divider, `Owned by anyone`, `Owned by me`.
- `filterArchived` — the tri-state the three menu items imply (unset hides
  archived, `true` shows all, `only` shows archived alone), so those items are no
  longer dead affordances.

Also landed the pieces that came with it:
- The secondary explore row is now in the source's order — `All · Most stars ·
  Trending` (was `All · Trending · Most stars`).
- The `Visibility: Any/Private/Internal/Public` filter now exists and drives
  `?visibility_level=0|10|20`.
- The `All · Personal` second row renders on `/` and `/dashboard/projects` and is
  correctly absent on `/dashboard/projects/starred` and the explore pages
  (checked against all five captures), giving `?personal=true` a UI control.
- Sort labels corrected to the source's: `Last created` (`created_desc`),
  `Most stars` (`stars_desc`), `Oldest created` (`created_asc`) — the mock had
  `Created date` / `Stars` / `Last created`.

Verified by clicking: `Topics` tab → `/explore/projects/topics?sid=…`;
`Show archived projects` → `?archived=true&sort=name_asc&sid=…`; `Personal` →
`?personal=true&sid=…`; `Public` → `?visibility_level=20&sort=name_asc&sid=…`.

### BUG-A08 · P1 · `/dashboard/activity` wrong empty state — FIXED

The body was the **groups** empty state. Replaced with the source's, verbatim from
`assets/html/dashboard-activity.html`: a bare `No activities found`. Also added the
hidden `.loading` spinner the source ships and switched the Subscribe control to
the `rss` icon with the source's responsive classes.

`?filter=starred` / `?filter=followed` do select their tab — verified,
`Starred projects` carries `gl-tab-nav-item-active`. The previous shard's
"identical bodies" reading was innerText-only; the difference is a class, and the
source's three tabs render identical text too, because all three feeds are empty.
**byteblaze has zero `events` rows, so no feed was fabricated.**

### BUG-A09 · P1 · `/search` layout diverged — FIXED

Root cause: the markup already carried the source's `gl-lg-display-flex` /
`nav-pills` class names, but `src/styles/global.css` does not implement those
GitLab utilities — measured `.results { display: block }` and
`.search-sidebar ul { list-style: disc }`. The selects were 1248px, stacked.

Fixed with a scoped `<style>` inside `Search.jsx` rather than editing the shared
`global.css`, which is not mine and which other shards are touching this round.
Geometry per `assets/README.md §23`.

Measured after the fix: `.results` is `flex`; sidebar 240px at x=336 with the
results column beside it at x=592; both selects 240px, inline with the query
input; `list-style: none`; active pill background `rgb(220,220,222)`.

### BUG-A13 · P2 · stray `×` glyph — FIXED in my files

`/search`'s clear button rendered a literal `×` into `innerText` (and into any
`string_match` over the page body). Swapped for the `close` icon. Same sweep
across my files fixed three more: `RepoTree.jsx` flash dismiss, `LabelsList.jsx`
delete-modal dismiss, and both `Layout.jsx` banner dismisses.

Verified: `/search?search=OPT%20model` body no longer contains `×`.

### BUG-B07 · P2 · MR rows showed branch chips the source omits — FIXED

Removed the `<source> into <target>` span from the MR list row. Verified:
`Octovisuals Page | !450 · created 3 years ago by Josh Bowden | 2 | updated 3 years ago`,
which is GitLab 15.7's row.

### DIFF-A05 / BUG-B05 (my file only) · hardcoded source host — FIXED

`ForkProject.jsx` rendered `http://localhost:8023/` as the Project URL prefix.
Now `window.location.origin`, matching what `ProjectOverview.jsx` already does.
Verified: `http://localhost:5213/`. The other five files in BUG-B05 are not mine.

### DIFF-A06 · P2 · card link colour and row density — FIXED

Source greys `namespace /` and bolds the project name in near-black; the mock had
the whole title in link blue and descriptions running the full content width.
Fixed in the shared style block, along with the boxed role badge and a 600px
description wrap. Also made the filter input and sort toggle sit inline, which
they did not.

---

## Not closed, and why

### BUG-A02 · P1 · tree `Last commit` / `Last update` — **SEED GAP, did not fabricate**

The data does not exist in this mock. I checked every source of it:

- `commits.json` — 1990 commits across all projects, and the complete field set is
  `{sha, author_name, author_email, authored_date, committed_date, title}`.
  **No file/path list on any commit.**
- `repo_trees.json` — entries are `{path, type, mode, size, sha}`. No
  `last_commit_*` fields.
- `assets/dumps/` — extraction scripts only, no commit-path dump.
- `grep -rl 'logs_tree\|last_commit' assets/dumps src/data` → no hits.

The bug report's hint that "`commits.json` already carries per-path commit
history" is not correct — the blob `History` link and `/-/commits/:ref` both work
off the whole-branch commit list, not a per-path one. Joining "newest commit
touching this path" would require inventing a mapping, so the cells stay empty
(which is also GitLab's own pre-XHR state, since the real site fills them from
`/-/refs/<ref>/logs_tree`). I left a comment at `src/pages/RepoTree.jsx:93`
recording exactly what a seed rebuild would need to capture.

**To close this: the seed rebuild must record touched paths per commit.**

### NEEDS FILE — outside my ownership

```
NEEDS FILE: src/utils/markdown.js — `escapeHtml()` escapes raw HTML before any
  inline rule runs, so an <img> in a comment body renders as literal text.
  GFM passes a safelist of raw inline HTML through. (blocks BUG-B06)

NEEDS FILE: src/pages/NotesTimeline.jsx — system notes render "assigned to
  @ericwbailey 7 years ago" with no actor; the source prefixes "Byte Blaze".
  Label / milestone / closed events are also missing. (blocks BUG-B08, part 1)

NEEDS FILE: src/components/issuable/Controls.jsx — TOOLBAR_GLYPH at :388 renders
  literal `B I S ❝ </> 🔗 • 1. ☑ ▾ ▦ 📎 ⤢` into innerText where GitLab uses
  icon-only SVGs. One-line swap to <Icon name={key} />; Icon.jsx (mine) would
  need the ~12 glyph paths added. (blocks BUG-B11)

NEEDS FILE: src/pages/ExploreTopics.jsx — needs the shared <ProjectsPrimaryTabs>
  (its strip still reads `Explore topics · Most starred · Trending · All ·
  Topics`) and the source's empty-state copy `Add topics to projects to help
  users find them.` in place of the invented two lines. Import
  `../components/ui/ProjectsNav.jsx`. (blocks BUG-A12, and the tail of BUG-A07)

NEEDS FILE: src/pages/hooks.js — `sortIssuables` has no case for `milestone`,
  `milestone_due_desc`, `closed_at`, `closed_at_desc`, `priority`,
  `priority_desc`, `label_priority` or `relative_position`; they all fall through
  to created-desc. The direction toggle now emits correct tokens for these, but
  the list does not reorder. (finishes BUG-B02's data layer)
```

### BUG-B08 part 2 · Designs section — deliberately not added

The source's `data-testid="designs-root"` dropzone (`Drag your designs here or
click to upload.`) has no backing state in this mock. Adding the markup without
wiring it would create exactly the dead affordance
`SANDBOX_COMPLETENESS_GUIDE.md` forbids, and wiring it means a new `designs`
entity in the state schema — bigger than this shard. Left out and flagged rather
than half-built.

### Not reached this round

`DIFF-A01` (already a non-finding — the mock now matches the clean capture),
`DIFF-A04` (fork-list empty-state copy, `Forks.jsx`, not mine), `DIFF-A07`
(todos actor wrap, `DashboardTodos.jsx`, not mine), `DIFF-A09` (repo-page
affordances: `Add to tree`, `Select Archive Format`, `Unverified` badge, branch
ahead/behind), `DIFF-A10` / `DIFF-004` (unseeded-blob placeholder copy and the
missing-blob redirect, `RepoBlob.jsx` — mine, but out of budget).

---

## Files changed

```
src/components/ui/ProjectsNav.jsx     NEW — shared tab strip, sort menu, archived filter
src/components/ui/Dropdown.jsx        (unchanged, reused)
src/components/layout/Icon.jsx        +star-o, rss, sort-highest, sort-lowest
src/components/layout/Layout.jsx      × → <Icon name="close">, +Icon import
src/pages/DashboardProjects.jsx       A01 A05 A06 A07 DIFF-003 DIFF-A06 + pagination sweep
src/pages/ExploreProjects.jsx         A04 A07 + visibility filter + pagination sweep
src/pages/DashboardActivity.jsx       A08
src/pages/Search.jsx                  A09 A13
src/pages/ForkProject.jsx             A03/005 B04 DIFF-A05
src/pages/IssuablesList.jsx           B02 B07 + dead LabelPill removed
src/pages/RepoTree.jsx                A13 + BUG-A02 seed-gap note
src/pages/LabelsList.jsx              A13
```

No file outside `APP_PATH` was touched. No `src/data/*.json` was regenerated. No
identifier was renamed. No request was made to port 8023 during this shard.
