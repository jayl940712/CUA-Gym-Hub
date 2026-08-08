# DEV — shard C: people, profile, repository browsing, search

Scope: TODO.md **P1-B** (project members, 20 tasks), **P1-J** (profile / stars /
follows, 17 tasks), **P1-K** (contributors graph, 20 tasks), plus the
repository-browsing and search read views. 57 WebArena tasks.

Build: **PASS** (`npm run build`, 152 modules, 2.5s).
Verification: **67/67 browser checks pass** against a real chromium at 1920×1080
(script kept at `/tmp/verifyC.py`), plus a separate injected-state run proving
the group-members post-condition.

---

## Anchors closed

Every anchor in this shard was driven end to end in a browser, not just
rendered — the write-path anchors were produced by clicking through the UI and
then read back exactly the way the evaluator reads them.

| Anchor | How it was verified | Result |
|---|---|---|
| `document.querySelector('.cover-status').lastChild.textContent` (tasks 418–422) | typed `Cruising` into `/-/profile` → `Update profile settings` → read on `/byteblaze` | `'Cruising'` |
| `document.querySelector('.profile-header [itemprop="url"]').outerText` (448–452) | typed `https://egg.tart.com` into `#user_website_url` → read on `/byteblaze` | `egg.tart.com`, `href="https://egg.tart.com"` |
| `document.querySelector('.user-profile').outerText` on `/users/byteblaze/following` (533–537) | clicked **Follow** on `/yjlou` | contains `@yjlou`, keeps the 3 seeded handles, header count moves 3 → 4 |
| `func:gitlab_get_project_memeber_role(page, 'abisubramanya27')` (481–485, 567–579, 742–751) | invited via the modal at role **Guest** on `/byteblaze/dotfiles/-/project_members` | `Guest`, and still `Guest` after reload |
| `/users/byteblaze/starred` whole-page match (523–527) | seeded rows render; ordering is project-id DESC per §8b.2 | pass |
| feed token `TMN_bBn9Z48qVbUFZV45` (`exact_match`, webarena-259) | `/-/profile/account` | rendered verbatim from `users.json` |
| `/dehenne/awesome-visibility/-/graphs/master` (787) and `/amwhalen/archive-my-tweets/-/graphs/php52` (788) | non-default refs | `Commits to master`, `51 commits (leutz@pcsg.de)`, `1 commit (binumathew1988@gmail.com)`, `14 commits (github@amwhalen.com)` |
| `/root/metaseq/-/graphs/main` top-3 (317) | | `70 commits (suchenzang@…)`, `51 commits (roller@fb.com)`, `12 commits (37597043+xirider@…)` |
| bare `/:ns/:proj/-/commits` (6 anchors) | `/byteblaze/dotfiles/-/commits` | resolves to the default branch, header `19 Mar, 2023`, count `1 commit` |
| `/:ns/:proj/-/raw/:ref/*path` (15 tasks) | | bare text, **zero** app chrome (no `.navbar-gitlab`, no `.nav-sidebar`, no `.breadcrumbs`); missing file → the source's real 404 page |
| `/groups/{coding_friends,…}/-/group_members` (799–803) | injected the created group + invited members as task state | `Group members`, `@byteblaze` Owner, `@Agnes-U` / `@qhduan` Guest, no `Import from a project` button |

All 16 usernames the five group-creation tasks invite (`@Agnes-U`, `@qhduan`,
`@westurner`, `@DCMJY`, `@JonasVautherin`, `@bmyun`, `@dawiss1337`,
`@dilipchandima`, `@ASWATFZLLC`, `@linkmatrix`, `@patrickhlauke`, `@egpast`,
`@jontutcher`, `@patou`, `@pandey2000`, `@sayakpaul`) are present in
`users.json` — checked, no seed gap.

---

## Traps the spec flagged, and what was actually built

- **Members table column order.** `Max role` comes **before** `Expiration`, and
  there are two extra columns (`Created on`, `Last activity`) before the
  sr-only actions column. Verified in the DOM: `['Account', 'Source',
  'Access granted', 'Max role', 'Expiration', 'Created on', 'Last activity',
  'Actions']`.
- **The Expiration cell is a blank datepicker, never the word `Never`.** The
  previous draft rendered `Never`; the source's cell `innerText` is `''`, and a
  role read that walks the row would have picked up the wrong text. Now `''`.
- **Max role is a gl-dropdown, not a `<select>`.** A native select leaks every
  option into the cell text and breaks
  `gitlab_get_project_memeber_role`. Closed dropdown → the label is the only
  text. Owner rows and the current user's own row render the static badge
  instead, matching `@a11yproject` / `@primer` in §17.
- **Role option count is viewer-dependent.** Owner → 5 options; Maintainer → 4;
  rows above the viewer's own level are not editable. Derived from the viewer's
  own membership row, so `/a11yproject/a11yproject.com` behaves like the source.
- **Three different date formats, kept separate.** Members `Created on` uses
  `%-d %b, %Y` (`23 Mar, 2023`); commit-list headers use zero-padded
  `%d %b, %Y` (`19 Mar, 2023`, `04 Mar, 2016`) via a local helper rather than
  `formatCommitDate`, which is non-padded; the profile uses the full month
  (`Member since March 23, 2023`).
- **`.cover-status` and `.profile-header [itemprop="url"]` do not exist in the
  live DOM** — recon flagged both. Built from the Haml templates as described:
  the emoji is a `<gl-emoji>` element and the message is the **last** child and
  a bare text node, so nothing may ever be appended after it; the website link
  strips only `http(s)://` from the visible text (a `www.` prefix is kept) while
  the `href` gets a scheme added when the stored value has none.
- **The `·` separators in the profile header are CSS `::after` content**, not
  text nodes. Putting them in the DOM would corrupt the `.user-profile`
  outerText anchor, so they live in the scoped stylesheet.
- **Missing-blob redirect.** `/byteblaze/dotfiles/-/blob/main/LICENSE` 302s to
  the tree root and flashes `"LICENSE" did not exist on "main"` — verified.
  Anchors 414/736 are post-conditions, so the same route renders a real blob
  once the file exists.
- **Search is a 240px vertical pill list in a left sidebar with exactly five
  scopes**, not a tab strip. `notes` / `wiki_blobs` / `blobs` / `commits` fall
  back to `projects` without changing the URL. Counts capped at `99`. There is
  deliberately **no** `N results for "foo"` header.
- **Branches vs tags empty states are different strings.** Branches uses
  `No branches to show` for both the no-branches and the no-matches case; tags
  uses `Repository has no tags yet.` / `Sorry, your filter produced no results.`
- **Blob header has no standalone `Edit` button and no `Lock`** in 15.7 CE —
  `Edit` lives inside the `Open in Web IDE` split button.

## Contributors graph — how the 20 read tasks are answerable

`/-/graphs/:ref` renders `Commits to {ref}`, the verbatim caption
`Excluding merge commits. Limited to 6,000 commits.`, an overall
commits-over-time chart, and one `col-lg-6` card per author (two per row) with
the author's name, a pluralised `{n} commits ({email})` line and that author's
own chart. Cards are e-mail-keyed and **not** de-duplicated, so Eric Bailey
appears twice on dotfiles exactly as in the source.

The tasks that ask "how many commits did X make on date D" cannot be answered
off a chart, so each author with per-day data also gets a collapsible
**Commits per day** table (date + count, newest first). That is an addition to
the source's DOM, but it is inside the author's card, it does not disturb any
anchored string, and without it the expected answers (`0`, `1`, `2`, `5`, `14`,
`16`, `414`) are not readable.

---

## Files

Created: `Contributors.jsx`, `RepoAnalytics.jsx`, `NetworkGraph.jsx`,
`Search.jsx`, `ProfileSettings.jsx`, `ProfileAccount.jsx`,
`ProfilePreferences.jsx`, `ProfileNotifications.jsx`, `ProfileKeys.jsx`
(+ the `ProfileMisc` export for ROUTES #43), `ProfileEmails.jsx`,
`Starrers.jsx`, `Branches.jsx`, `Tags.jsx`, `NewBranch.jsx`, `NewTag.jsx`,
`CommitDetail.jsx`, `Compare.jsx`, `FindFile.jsx`, `DashboardActivity.jsx`,
`ExploreTopics.jsx`, `Snippets.jsx`, and under `src/components/people/`:
`profileUtils.js`, `SettingsSection.jsx`, `ProfileLayout.jsx`, `RefSwitcher.jsx`.

Rewritten: `UserProfile.jsx`, `MembersTable.jsx`, `ProjectMembers.jsx`,
`GroupMembers.jsx`, `RepoTree.jsx`, `RepoBlob.jsx`, `RepoCommits.jsx`,
`RawFile.jsx`.

`src/App.jsx`: 25 `<Route>` lines swapped from `<Placeholder>` to the real
component, one surgical edit each, plus the shard's import block. No other line
touched.

Layout CSS for the profile and the contributors grid is scoped inside those two
components (`.user-profile …`, `.contributors-charts …`) rather than added to
`src/styles/global.css`, which is shared with the other shards.

---

## Not done / handed back

- **`NEEDS FILE: src/pages/ProjectOverview.jsx`** — the **Star / Unstar** button
  and its live count on the project header (TODO P1-J, ROUTES #30). The starred
  *list* at `/users/byteblaze/starred` and `/-/starrers` both read
  `state.stars`, so the moment that button writes `state.stars` the whole flow
  closes; tasks 523–527 currently have no way to star a project from the UI.
  `ProjectOverview.jsx` belongs to another shard.
- **`NEEDS FILE: src/components/layout/Navbar.jsx`** — the avatar-menu
  `Set status` modal (§7.5). The same status is fully settable from
  `/-/profile` ("Current status"), which is the path tasks 418–422 can take, so
  this is a second entry point rather than a gap.
- **`NEEDS FILE: src/pages/DashboardProjects.jsx`** — `ProjectRow` has no
  compact mode. On the profile Overview the source hides the namespace prefix
  and shows an `Owner` pill; the mock renders `Byte Blaze / dotfiles`. Cosmetic,
  unanchored.
- `/:ns/:proj/-/forks` (ROUTES #65) is not mine — it is part of the fork shard.
  `Starrers` (#64) is done.
- `DashboardProjectsStarred.jsx` was deliberately **not** created: the
  `/dashboard/projects/starred` route already points at
  `<DashboardProjects starred />`, and that route line is outside my edit list.

## Flagged for the orchestrator (not a defect I should fix alone)

`/:ns/:proj/-/raw/:ref/*path` is a client-side route, so a **plain HTTP GET**
returns `index.html`; the file body only appears once React has rendered.
WebArena's `program_html` evaluator drives a real browser (`page.goto` then
`page.content()`), so all 15 raw tasks are fine as built — verified in chromium.
But if any harness ever curls those URLs it would get HTML. Serving them as real
`text/plain` from a middleware route would need `vite.config.js`, which is the
foundation shard's file.

Separately, worth knowing: because the source serves raw as `text/plain`,
Chromium wraps it in a `<pre>` and `page.content()` returns HTML-**escaped**
text. So webarena-441's `must_include` of `<title>GIVE ME SPACE</title>` is
compared against `&lt;title&gt;…`. The mock reproduces the source's behaviour
exactly, escaping included — this is a property of the original site, not a
divergence I introduced, and I did not "fix" it by diverging.

## Seed gaps hit (did NOT fabricate)

- `members.json` has no per-member `last_activity_on`. `Created on` is taken
  from the user's account `created_at` (which matches the source exactly:
  byteblaze `23 Mar, 2023`, abisubramanya27 `2 Feb, 2023`); `Last activity`
  renders "today" for the current user and falls back to the account date for
  others, so `@Roshanjossey` shows `23 Mar, 2023` where the source shows
  `26 Mar, 2023`. Unanchored.
- No `events.json`, so `/dashboard/activity` and the profile Activity tab render
  the source's real empty state rather than invented events. byteblaze genuinely
  has zero events on this instance, so this is correct, not a stub.
- `projects.json` has no `topics` field and the instance has no topics, so
  `/explore/projects/topics` is an empty state.
- No diff data, so `/-/commit/:sha` shows the commit metadata plus a
  `Browse files` affordance instead of a fabricated hunk-level diff, and
  `/-/compare` shows the real commit-set difference between the two refs.
