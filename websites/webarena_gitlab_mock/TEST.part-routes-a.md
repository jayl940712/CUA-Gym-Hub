# webarena_gitlab_mock — TEST part: routes A (ROUTES.md §1–§5, rows 1–66)

> Shard: A of 3 · Mock: http://localhost:5201 · Source: http://localhost:8023 (reachable: YES)
> Scope: dashboard/explore, search, user profile, user settings, project overview & repository
> Tested by: playwright agent (chromium, 1920x1080)
> Status: COMPLETE for the assigned range.

## Summary

| Metric | Count |
|---|---|
| ROUTES.md rows in my range verified | **60 / 60** implemented rows (rows 1–66; rows 24/34/42 are "not migrated", row 67 is `[ ]`) |
| Distinct URLs cold-loaded in a fresh context | 118 |
| Cold deep-link failures | **0** |
| Console errors / pageerrors across all loads | **0** |
| `?sid=` preservation failures | **1** (BUG-A01 — the project-list sort dropdown) |
| Trailing-slash + URL-encoded param forms accepted | 4 / 4 |
| Interactive flows exercised | 34 |
| P0 bugs | **1** (BUG-A01) |
| P1 bugs / differences | **10** (BUG-A02…A10, DIFF-A08) |
| P2 bugs / differences | 12 |
| Rows I did **not** reach | 0 in range (see "Coverage") |

**Headline:** the range is in good shape. Every route resolves cold, nothing throws,
and the P0 anchor mutation flows in my range (profile status → `.cover-status`,
website URL → `.profile-header [itemprop=url]`, new file → `/-/raw/…`, edit file,
fork → `/byteblaze/<name>`, star → starrers + starred tab) all complete end to end and
persist across reload. The single P0 is a `?sid=` drop on one dropdown; the P1s are
missing list-view affordances rather than broken ones.

## Route Parity Results — cold load, fresh context, `?sid=parity_test_a`

Every URL below was loaded in a **brand-new browser context** (no prior click-through),
with `sid=parity_test_a` appended. "sid kept" = the sid was still on `page.url` after
the load settled. Console errors were captured via `console`/`pageerror` listeners.

**Zero console errors and zero pageerrors across all 118 cold loads.**
**`sid=` survived every cold load (118/118).** The one `sid` loss in this shard happens
on a *click*, not a load — see BUG-A01.

### §1 Root, dashboard, explore (rows 1–20)

| Row | Path (+`?sid=`) | Cold load | Correct view | Params honored | sid kept |
|---|---|---|---|---|---|
| 1 | `/` | ✅ | ✅ Projects · Yours/Starred/Explore | — | ✅ |
| 2 | `/dashboard/projects` | ✅ | ✅ | — | ✅ |
| 2 | `…?sort=name_asc` | ✅ | ✅ | ✅ reorders | ✅ |
| 2 | `…?name=dotfiles` | ✅ | ✅ 1 card | ✅ filters | ✅ |
| 2 | `…?page=2` | ✅ | ✅ empty (14 projects < 20/pg) | ✅ | ✅ |
| 2 | `…?personal=true` | ✅ | ✅ | ⚠️ no visible change (all 14 are personal) | ✅ |
| 2 | `…?archived=true` | ✅ | ✅ empty state | ✅ | ✅ |
| 3 | `/dashboard/projects/starred` | ✅ | ✅ 3 starred | — | ✅ |
| 4 | `/dashboard/groups` | ✅ | ✅ empty state | — | ✅ |
| 5 | `/dashboard/issues` | ✅ | ✅ | — | ✅ |
| 5 | `…?scope=all` / `?state=closed` / `?sort=created_asc` / `?assignee_username=byteblaze` | ✅ | ✅ | ✅ each changes the list | ✅ |
| 6 | `/dashboard/merge_requests` (+`?reviewer_username=`, `?state=merged`) | ✅ | ✅ | ✅ | ✅ |
| 7 | `/dashboard/todos` (+`?state=done`, `?sort=created_asc`) | ✅ | ✅ To Do 5 / Done 2 | ✅ | ✅ |
| 11 | `/dashboard/activity` (+`?filter=starred`) | ✅ | ⚠️ see DIFF-A02 | ❌ `filter=starred` renders identically | ✅ |
| 12 | `/dashboard/milestones` (+`?state=closed`) | ✅ | ✅ Open 4 / Closed 2 / All 6 | ✅ | ✅ |
| 13 | `/dashboard/snippets` | ✅ | ✅ real empty state | — | ✅ |
| 14 | `/explore` | ✅ | ✅ identical body to `/explore/projects` | — | ✅ |
| 15 | `/explore/projects` (+`?sort=stars_desc`, `?page=2`, `?name=a11y`) | ✅ | ✅ | ✅ | ✅ |
| 16 | `/explore/projects/trending` | ✅ | ❌ see BUG-A04 | — | ✅ |
| 17 | `/explore/projects/starred` | ✅ | ✅ | — | ✅ |
| 18 | `/explore/projects/topics` | ✅ | ✅ empty state | — | ✅ |
| 19 | `/explore/groups` | ✅ | ✅ robert1003 listed | — | ✅ |
| 20 | `/explore/snippets` | ✅ | ✅ "No snippets found" | — | ✅ |

### §2 Search (rows 21–23)

| Row | Path | Cold load | Correct view | sid kept |
|---|---|---|---|---|
| 21 | `/search` | ✅ | ✅ landing | ✅ |
| 22 | `/search?search=OPT%20model&scope=projects` | ✅ | ✅ | ✅ |
| 22 | `…&scope=issues` / `merge_requests` / `milestones` / `users` / `notes` | ✅ | ✅ each scope renders its own result set | ✅ |
| 23 | `/search?project_id=169&search=bug` | ✅ | ✅ | ✅ |

### §3 User profile (rows 25–33)

| Row | Path | Cold load | Correct view | sid kept |
|---|---|---|---|---|
| 25 | `/byteblaze` | ✅ | ✅ profile header + tabs | ✅ |
| 25 | `/users/byteblaze` | ✅ | ✅ same body | ✅ |
| 26–33 | `/users/byteblaze/{activity,groups,contributed,projects,starred,snippets,followers,following}` | ✅ (8/8) | ✅ each tab renders its own content | ✅ |

### §4 User settings (rows 35–43)

| Row | Path | Cold load | Correct view | sid kept |
|---|---|---|---|---|
| 35 | `/-/profile` | ✅ | ✅ full edit form | ✅ |
| 37 | `/-/profile/account` | ✅ | ⚠️ see BUG-A10 / BUG-A11 | ✅ |
| 38 | `/-/profile/preferences` | ✅ | ✅ | ✅ |
| 39 | `/-/profile/notifications` | ✅ | ✅ | ✅ |
| 40 | `/-/profile/keys` | ✅ | ✅ empty state | ✅ |
| 41 | `/-/profile/emails` | ✅ | ✅ | ✅ |
| 43 | `/-/profile/{personal_access_tokens,gpg_keys,chat_names,active_sessions,applications,audit_log}` | ✅ (6/6) | ✅ shell + empty state, no 404 | ✅ |

### §5 Project overview & repository (rows 44–66)

| Row | Path | Cold load | Correct view | sid kept |
|---|---|---|---|---|
| 44 | `/byteblaze/dotfiles`, `/a11yproject/a11yproject.com`, `/root/metaseq`, `/CellularPrivacy/Android-IMSI-Catcher-Detector` | ✅ (4/4) | ✅ | ✅ |
| 45 | `/byteblaze/dotfiles/-/tree/main` | ✅ | ✅ | ✅ |
| 45 | `/amwhalen/archive-my-tweets/-/tree/github/fork/chtitux/addRssFeed` (slash-bearing ref) | ✅ | ✅ ref resolved correctly | ✅ |
| 46 | `/a11yproject/a11yproject.com/-/tree/main/.github` | ✅ | ✅ subdir + breadcrumb | ✅ |
| 47 | `/-/blob/main/README.md`, and the 4 anchor `LICENSE` blobs (gimmiethat.space, cloud-to-butt@master, a11y-syntax-highlighting, accessible-html-content-patterns) | ✅ (5/5) | ✅ | ✅ |
| 48 | `/-/raw/…` — **verified bare**, see "Raw route" below | ✅ | ✅ | ✅ |
| 49 | `/-/blame/main/README.md` | ✅ | ✅ | ✅ |
| 50 | `/-/commits/main` | ✅ | ✅ | ✅ |
| 51 | `/-/commits` (bare, no ref) | ✅ | ✅ resolves to default branch; `cloud-to-butt` correctly uses `master` | ✅ |
| 52 | `/-/commit/218b5e72…` | ✅ | ✅ | ✅ |
| 53 | `/-/branches` + `/active` + `/stale` + `/all` + `?state=stale` | ✅ (5/5) | ✅ | ✅ |
| 54 | `/-/branches/new` | ✅ | ✅ form | ✅ |
| 55 | `/-/tags` (dotfiles empty, a11yproject populated) | ✅ | ✅ | ✅ |
| 56 | `/-/tags/new` | ✅ | ✅ form | ✅ |
| 57 | `/dehenne/awesome-visibility/-/graphs/master` (anchor, ref=master) | ✅ | ✅ contributors | ✅ |
| 57 | `/a11yproject/a11yproject.com/-/graphs/main` | ✅ | ✅ | ✅ |
| 58 | `/-/graphs/main/charts` | ✅ | ✅ | ✅ |
| 59 | `/-/network/main` | ✅ | ✅ | ✅ |
| 60 | `/-/find_file/main` | ✅ | ✅ | ✅ |
| 61 | `/-/compare` + `?from=main&to=main` | ✅ | ✅ | ✅ |
| 62 | `/-/new/main` + `?file_name=LICENSE&commit_message=Add+LICENSE` | ✅ | ✅ prefill honored | ✅ |
| 63 | `/-/edit/main/README.md` | ✅ | ✅ | ✅ |
| 64 | `/-/starrers` | ✅ | ⚠️ see DIFF-A03 | ✅ |
| 65 | `/-/forks` + `?sort=created_desc` | ✅ | ⚠️ see DIFF-A04 | ✅ |
| 66 | `/-/forks/new` | ✅ | ⚠️ see DIFF-A05 | ✅ |
| 67 | `/byteblaze/dotfiles/activity` | ✅ | `<Placeholder>` — **ROUTES.md marks this row `[ ]`, so not reported as a bug** | ✅ |

### Trailing slash + URL-encoded params

| Form tested | Result |
|---|---|
| `/dashboard/issues/?scope=all` (slash before `?`) | ✅ identical body to `/dashboard/issues?scope=all` |
| `/byteblaze/dotfiles/-/tree/main/` (trailing slash) | ✅ identical body to no-slash form |
| `/a11yproject/a11yproject.com/-/issues/?label_name%5B%5D=help%20wanted` | ✅ decoded, filtered |
| `/a11yproject/a11yproject.com/-/issues/?sort=created_date&state=opened` | ✅ |

### Raw route (`/:ns/:proj/-/raw/:ref/*path`) — task item 4

Verified on 4 files. The rendered DOM is a **single `<pre>` inside `#root`** and nothing
else: `header` count 0, `nav` count 0, `.navbar` count 0, `.layout-page` count 0, and the
body text contains no "Skip to content". File bodies are the real content
(`# New System Setup…` for dotfiles, the raw `<!DOCTYPE html>` source for
gimmiethat.space/index.html). ✅ PASS.

One caveat, logged as P2 below: the response `Content-Type` is `text/html`, not
`text/plain`, because a client-rendered SPA cannot set it. Rendered text is correct.

## ❌ Bugs for Dev Agent

### BUG-A01 · **P0** · The project-list sort dropdown drops `?sid=`

| Field | Value |
|---|---|
| Route | `/` , `/dashboard/projects` , `/dashboard/projects/starred` (ROUTES.md rows 1–3; `/` is the anchor route for **168 tasks**) |
| Element | The sort dropdown (`Updated date ▾`) |
| Action | Load `/dashboard/projects?sid=sidtest`, open the sort menu, click any item |
| Expected | `…/dashboard/projects?sort=name_asc&sid=sidtest` |
| Actual | `http://localhost:5201/dashboard/projects?sort=name_asc` — **`sid` is gone**, and with it the session's mutated state |
| Console errors | None (silent) |
| Root cause | `src/pages/DashboardProjects.jsx:137-143` renders the menu as query-only relative links, `<li><a href="?sort=name_asc">Name</a></li>`. The global interceptor in `src/App.jsx:107` bails on anything that does not start with `/` (`if (!href.startsWith('/')) return`), so the browser performs a real navigation that **replaces the whole query string**. |
| Blast radius | 7 links, all in `DashboardProjects.jsx`. `grep -rn 'href="?' --include=*.jsx src/` finds no others — every other sort/filter/tab control in my range builds a rooted path and keeps `sid` correctly (verified on explore tabs, explore filter box, dashboard filter box, profile tabs, branch tabs, milestone tabs, todos filters, todos sort). |
| Fix hint | Either emit rooted hrefs (`/dashboard/projects?sort=name_asc`) like every other control, or extend the interceptor to also handle `href` values starting with `?` by merging into the current path + `sid`. The second is the safer fix — it closes the class, not the instance. |

### BUG-A02 · P1 · Repository file tree renders "Last commit" and "Last update" as blank cells

| Field | Value |
|---|---|
| Route | `/:ns/:proj/-/tree/:ref` and `/-/tree/:ref/*path` (ROUTES.md rows 45/46, both **P0** rows) — reproduced on `/byteblaze/dotfiles/-/tree/main` |
| Expected (source) | `.mackup ⟶ Remove atom config settings ⟶ 6 years ago`, `.ssh ⟶ Update config ⟶ 9 years ago`, one populated pair per row for all 47 entries |
| Actual | The `Name / Last commit / Last update` header row is correct, but **every** `Last commit` and `Last update` cell is empty. Source body text is 8150 chars, mock's is 1487 — the whole delta is these two columns. |
| Impact | The file browser is the primary repo view; "when was this file last touched / by which commit" is unreadable on every project. Two of three columns are dead. |
| Fix hint | `commits.json` already carries per-path commit history (the blob page's `History` link resolves correctly, and `/-/commits/main` renders). Join tree entries to the newest commit touching each path. |
| Screenshots | `assets/screenshots/diff/{source,mock}_byteblaze_dotfiles_tree_main.png` |

### BUG-A03 · P1 · Fork form submits as a silent no-op when no namespace is chosen

| Field | Value |
|---|---|
| Route | `/:ns/:proj/-/forks/new` (row 66, **P0** row — tasks 394–398) |
| Action | Load `/root/metaseq/-/forks/new`, leave `Select a namespace` untouched, click `Fork project` |
| Expected | A validation message, or a disabled button |
| Actual | Nothing at all: URL unchanged, no alert, no console error, no project created |
| Note | **The flow itself works.** Open the namespace dropdown → pick `byteblaze` → `Fork project` navigates to `/byteblaze/metaseq?sid=…` and the project resolves. So this is the silent-failure class, not a broken capability. An agent that clicks submit first (a common pattern) gets no signal that anything is wrong. |
| Fix hint | Disable `Fork project` until a namespace is selected, or render GitLab's inline validation. |

### BUG-A04 · P1 · `/explore/projects/trending` renders the most-starred list; the source is empty

| Field | Value |
|---|---|
| Route | `/explore/projects/trending` (ROUTES.md row 16) |
| Source | Renders **no project cards at all** — body ends at `Explore public groups to find projects to contribute to.` (confirmed live, 194 chars of body text) |
| Mock | Renders 20 project cards, byte-for-byte the same list and order as `/explore/projects/starred` (2810 chars) |
| Impact | An agent asked "what is trending" gets a fabricated answer. `assets/README.md §24.2` already records "`/explore/projects/trending` … empty"; the mock contradicts its own recon note. |
| Fix hint | Trending in GitLab CE requires `trending_projects` rows, of which the source has none. Render the empty state; `/explore/projects/starred` should keep the star-ordered list. |

### BUG-A05 · P1 · Project-list tab badge "Yours" shows the *filtered* count, not the total

| Field | Value |
|---|---|
| Route | `/dashboard/projects`, `/dashboard/projects/starred`, `/` |
| Action | Load `/dashboard/projects/starred` (or `/dashboard/projects?name=dotfiles`, or `?archived=true`) |
| Expected | `Yours 14` always — the source's badge is the user's total project count and never changes with the filter (verified live: `Yours 14 · Starred 3` on every one of those URLs) |
| Actual | `Yours 3` on `/starred`, `Yours 1` on `?name=dotfiles`, `Yours 0` on `?archived=true`, `Yours 14` on `?page=2` |
| Impact | The badge is the natural place an agent reads "how many projects do I have"; it returns a wrong number on any filtered view. |
| Fix hint | Compute the tab badge from the unfiltered owned-projects set, not from the rendered page slice. |

### BUG-A06 · P1 · Project cards drop the role badge and 2 of the 4 stat counters

| Field | Value |
|---|---|
| Route | `/`, `/dashboard/projects`, `/dashboard/projects/starred`, `/explore/projects*`, `/users/:u/starred`, `/users/:u/projects` — every project-card list in §1/§3 |
| Source card | `A · The A11Y Project / a11yproject.com 🌐 [Maintainer]` … stats `★21  ⑂0  ⑄10  ▤40` (stars, forks, **merge requests**, **issues**) … `Updated 3 years ago` |
| Mock card | same avatar + name + description, stats `★21  ⑂0` only, and **no role badge** at all |
| Impact | Two per-project numbers an agent can read straight off a list page are simply absent, and the Owner/Maintainer/Developer role — which distinguishes `byteblaze`'s own repos from `a11yproject.com` — is invisible. |
| Fix hint | `open_issues_count` and `open_mrs_count` are already in `projects.json`; role comes from `members.json`. Source markup order is stars, forks, MRs, issues. |

### BUG-A07 · P1 · Primary tab strip is missing `Topics`, and the explore pages lose the strip entirely

| Field | Value |
|---|---|
| Route | `/`, `/dashboard/projects`, `/dashboard/projects/starred`, `/explore/projects*` |
| Source | Primary strip is `Yours 14 · Starred 3 · Explore · Topics` on **all** of them, and on `/` a second row `All · Personal`; on the explore pages a secondary row ` Name │ All · Most stars · Trending │ Visibility: Any` |
| Mock | Primary strip is `Yours · Starred · Explore` (no `Topics`); on `/explore/*` there is **no** primary strip at all, only `All · Trending · Most stars` — and that secondary row is in the wrong order (source is `All · Most stars · Trending`) |
| Impact | `/explore/projects/topics` (row 18) is implemented but unreachable by clicking; `?personal=true` (row 2) has no UI control at all; the visibility filter is absent. |
| Fix hint | `src/pages/DashboardProjects.jsx` / `ExploreProjects.jsx` should share one tab strip component. |

### BUG-A08 · P1 · `/dashboard/activity?filter=starred` is accepted but changes nothing, and the empty state is the wrong copy

| Field | Value |
|---|---|
| Route | `/dashboard/activity` (ROUTES.md row 11) |
| Action | Cold-load `/dashboard/activity` then `/dashboard/activity?filter=starred` |
| Expected | Source shows `No activities found` for the feed body; `?filter=starred` selects the "Starred projects" tab |
| Actual | Mock shows `Join or create a group to start contributing by commenting on issues or submitting merge requests! / Explore groups New group` (that is the **groups** empty state, not the activity one), and the two URLs render byte-identical bodies — `filter=starred` does not select the Starred tab |
| Impact | P1 (silent no-op param + wrong empty-state copy). Row 11 is a P2 route, so no task is blocked. |
| Fix hint | `src/pages/DashboardActivity.jsx` — read `filter` from the query and set the active tab; use `No activities found`. |

### BUG-A09 · P1 · `/search` layout diverges: full-width stacked selects, bulleted scope list, results below instead of beside

| Field | Value |
|---|---|
| Route | `/search`, `/search?search=…&scope=…` (rows 21–23) |
| Source | One row: wide query input, then a **240px** `Group` select and a **240px** `Project` select side by side. Below: a **boxed left rail** of scope pills (active pill has a grey background) with the result body in a column to its **right**. |
| Mock | Query input on its own full-width row; `Group` label + a **1250px full-width** native `<select>` on the next row; `Project` the same on a third row. Scope list is a `<ul>` rendered **with visible bullet points**, full width, active item underlined rather than grey-boxed, and the result body sits **below** it, not beside it. |
| Screenshots | `assets/screenshots/diff/{source,mock}_search_search_OPT_20model_scope_projects.png` |
| Impact | The page is one column where the source is two, and the scope rail — which `assets/README.md §23` specifically pins as a 240px vertical pill list — does not look like one. Result *content* and the 5 scope names are correct. |
| Fix hint | Reset `list-style` on the scope `<ul>`, constrain the two selects to 240px and put them inline with the input, and lay out rail + results as a two-column flex row. |

### BUG-A10 · P1 · Feed token is on the wrong settings page, and `click to reveal` does nothing

| Field | Value |
|---|---|
| Routes | `/-/profile/account` (row 37) and `/-/profile/personal_access_tokens` (row 43) |
| Anchor | `TMN_bBn9Z48qVbUFZV45` — `exact_match`, webarena-259 |
| Source | `/-/profile/account` has exactly three sections: Two-factor authentication · Change username · Delete account. The **Feed token** section lives on `/-/profile/personal_access_tokens`. |
| Mock | Puts a Feed token section (plus a **Social sign-in** section the source has nowhere) on `/-/profile/account`, and leaves `/-/profile/personal_access_tokens` a bare stub. |
| Also broken | Clicking `click to reveal` is a **no-op**: the input stays at `********************` and the token never reaches `innerText`. The string is present in the page HTML, so the anchor is not lost outright. |
| Impact | An agent following the source's information architecture goes to Access Tokens and finds nothing; the one page that does have the section will not surface the value on click. |
| Fix hint | Move the section to `/-/profile/personal_access_tokens`, drop `Social sign-in`, restore the two missing sentences (see NOTE-1), and wire the reveal button. |

### BUG-A11 · P2 · `/-/profile/account` copy drift

| Source | Mock |
|---|---|
| `Two-factor authentication` | `Two-Factor Authentication` |
| `Changing your username can have unintended side effects. Learn more.` | `Changing your username can have unintended side effects.` (no `Learn more.`) |
| `Path` / `http://localhost:8023/` / **`Current path: http://localhost:8023/byteblaze`** | `Path` / `http://localhost:8023/` — the `Current path:` line is missing |
| `12 personal projects will be removed and cannot be restored.` | `You don't have access to delete this user.` |

### BUG-A12 · P2 · `/explore/projects/topics` empty-state copy differs

| Source | Mock |
|---|---|
| tabs `Projects · Yours 14 · Starred 3 · Explore · Topics`, body `There are no topics to show.` + `Add topics to projects to help users find them.` | tabs `Explore topics · Most starred · Trending · All · Topics`, body `There are no topics to show.` + `Topics are added by project maintainers in the project's general settings.` + `Explore projects` + `175 projects on this instance.` |

### BUG-A13 · P2 · Stray `×` glyph rendered inline on several pages

| Field | Value |
|---|---|
| Routes | `/explore/groups` (after `Last created`), `/search?search=…` (after `What are you searching for?`), `/-/profile` (after the status emoji) |
| Actual | A literal `×` appears in `innerText` where the source has nothing |
| Fix hint | Looks like a dismiss/clear button rendered without its `aria-hidden`/icon wrapper. Harmless visually, but it lands in `page.innerText` and any `string_match` over the page body. |

## Interactive testing — every control I could reach in the range

Every mutation below was re-checked **after a full reload** (and, where it crosses a
route, on the destination route in a fresh navigation). "persists" means the change
survived the reload.

### P0 anchor mutation flows — all ✅

| Flow | Tasks | Result |
|---|---|---|
| `/-/profile` → set Website URL → `Update profile settings` | 448–452 | ✅ flash `Profile was successfully updated`; field persists; `/byteblaze` renders exactly **one** `.profile-header [itemprop="url"]` reading `byteblaze.example.com` |
| `/-/profile` → set status message + `Set yourself as busy` → save | 418–422 | ✅ persists; `/byteblaze` renders `.cover-status` = `💬Ready to merge!`, and `Busy` appears on the profile |
| `/-/profile` → `Remove status` → save | 418–422 | ✅ field clears; `.cover-status` count drops to 0 |
| `/-/new/main` → filename + body + commit message → `Commit changes` | 20+ creation tasks | ✅ redirects to `/-/blob/main/HELLO.md?sid=…`; file appears in the tree; `/-/raw/main/HELLO.md` returns exactly `hello from the playwright agent\n`; the commit shows in `/-/commits/main` |
| `/-/edit/main/HELLO.md` → change body → `Commit changes` | file-edit tasks | ✅ editor pre-filled with the old content; `/-/raw/…` returns the new content |
| `/-/forks/new` → pick namespace `byteblaze` → `Fork project` | 394–398 | ✅ navigates to `/byteblaze/metaseq?sid=…`, which resolves (no 404). See BUG-A03 for the no-namespace path |
| Project overview `Star` toggle | star/starrer tasks | ✅ `Star`→`Unstar`, persists, `/-/starrers` gains `Byte Blaze · It's you · @byteblaze · Starred just now`, `/users/byteblaze/starred` gains the project, `Unstar` reverses all of it |

### Dropdowns — the surface flagged as least-proven. All open and all act.

| Dropdown | Route | Result |
|---|---|---|
| Sort (`Updated date ▾`) | `/dashboard/projects` | opens, 7 items (`Updated date / Oldest updated / Name / Name, descending / Created date / Last created / Stars`), reorders correctly, label sticks after reload — **but drops `sid`, BUG-A01** |
| Status emoji picker | `/-/profile` | ✅ opens, 8 emoji, selecting one updates the toggle |
| `Clear status after` | `/-/profile` | ✅ opens, 8 items (`Never / 30 minutes / 3 hours / 8 hours / 1 day / 3 days / 7 days / 30 days`), selecting updates the toggle |
| Ref selector (`main ▾`) | `/-/tree/main` | ✅ opens `Select Git revision / Branches / main / master`, picking `master` navigates to `/-/tree/master?sid=…` |
| Fork namespace | `/-/forks/new` | ✅ opens `Namespaces / byteblaze`, selecting it enables the fork |
| Todos `Group` | `/dashboard/todos` | ✅ opens, `Filter by group / No matching results` (correct — byteblaze is in no group) |
| Todos `Project` | `/dashboard/todos` | ✅ opens with the real project list; picking one → `?project_id=186&sid=…`, list narrows to 1 row |
| Todos `Author` | `/dashboard/todos` | ✅ `Any Author / Roshan Jossy / Byte Blaze` → `?author_id=…` |
| Todos `Type` | `/dashboard/todos` | ✅ `Any Type / Issue / Merge request / Design / Alert` → `?type=DesignManagement%3A%3ADesign` etc. (encoding correct) |
| Todos `Action` | `/dashboard/todos` | ✅ `Any Action / Assigned / Review requested / Mentioned / Added / Pipelines / Member access requested` → `?action_id=…` |
| Todos sort (`Last created ▾`) | `/dashboard/todos` | ✅ → `?sort=created_asc&sid=…` |
| Clone | project overview | ✅ opens, exposes both clone URLs — but see DIFF-A08 for the SSH one |

All of these keep `?sid=` except the dashboard sort.

### Forms

| Form | Result |
|---|---|
| `/-/branches/new` → `pw-test-branch` → `Create branch` | ✅ → `/-/tree/pw-test-branch?sid=…`; branch listed on `/-/branches` |
| `/-/tags/new` → `v9.9.9` → `Create tag` | ✅ → `/-/tags?sid=…`; tag listed |
| `/-/compare` → `Compare` | ✅ → `?sid=…&from=main&to=main` (sid kept) |
| `/-/find_file/main` "Find by path" | ✅ live-filters 47 → 2 results on `gitconfig` |
| `/dashboard/projects` "Filter by name" | ✅ → `?name=dotfiles&sort=latest_activity_desc&sid=…`, 1 card |
| `/explore/projects` "Filter by name" | ✅ → `?name=a11y&sort=name_asc&non_archived=true&sid=…` |
| `/search` query box → Enter | ✅ → `/search?…&sid=…`; scope pills navigate and keep `sid` |
| `/-/profile/preferences` theme radio → `Save changes` | ✅ persists across reload |
| `/-/profile` timezone `<select>` → save | ✅ persists |

### Todos actions (rows 7–10)

| Action | Result |
|---|---|
| Per-row `Mark as done` (`<a title="Mark as done" href="/dashboard/todos/2978">`) | ✅ `To Do 5 / Done 2` → `4 / 3`, persists |
| `Mark all as done` | ✅ → `0 / 7`, persists |
| Done-tab restore control | ✅ title is `Add a to do` — **which is exactly what the live source uses**, verified on `localhost:8023/dashboard/todos?state=done`. Clicking it goes `5/2` → `6/1` |
| Cold-loading the action routes directly | ✅ `/dashboard/todos/2978` → `4/3`, `/dashboard/todos/2978/restore` → `5/2`, `/dashboard/todos/destroy_all` → `0/7`; each redirects to `/dashboard/todos` **with `sid` intact** |

### Navigation

Tab and link clicks verified to change the view **and** keep `sid`: dashboard
`Starred`/`Explore` tabs, `New project`, profile `Starred projects`/`Followers`/`Following`,
branches `Active`/`Stale`, milestones `Closed`, explore `Most stars`, file-tree directory
and file links, blob `Blame`/`History`/`Permalink`/`Edit`/`Replace`/`Delete`/`Open in Web IDE`,
project-overview `Fork` (→ `/-/forks/new`).

### `/go` and session isolation

```
/go?sid=<mutating sid>  →  {initial_state, current_state, state_diff}
state_diff keys: projects · repo.fileOverlay.byteblaze/dotfiles:main:HELLO.md
                 repo.treeOverlay.… · repo.commitOverlay.… · repo.branchOverlay.…
                 repo.tagOverlay.…
```
The `projects` entry correctly shows `commit_count 553 → 555`, `repo_size 2789212 → 2789271`
and a bumped `last_activity_at`. Every mutation I performed is represented. ✅

Isolation: `POST /post?sid=isoA {"action":"set",…}` → visible on `/go?sid=isoA`, **absent**
from `/go?sid=isoB`; a mutating third sid keeps its own diff untouched; `{"action":"reset"}`
restores. ✅

## Source-vs-Mock Differences

### DIFF-A01 · P2 · Default sort label on the project lists

Source `/` shows sort `Most stars` and orders stars-desc; mock shows `Updated date` and orders by
last activity. **Not reported as a bug**: `SOURCE.md §6b` documents that GitLab persists
`projects_sort` on the *user record*, and the recon pass is disclosed as having written that
preference. ROUTES.md's documented default (`latest_activity_desc`) is what the mock implements.
Flagging only so nobody "fixes" the mock to match a mutated live preference.

### DIFF-A02 · P2 · `/byteblaze` "Personal projects" panel

| | Source | Mock |
|---|---|---|
| card title | `solarized-prism-theme` (bare project path) | `Byte Blaze / solarized-prism-theme` (namespace prefixed) |
| role badge | `Owner` on every card | absent |
| an extra link | — | an extra `View all` under the `Activity` heading that the source does not have |

Profile **header** is an exact match, including `Member since March 23, 2023`, `Boston, MA`,
`@github`, `2 followers 3 following`, the bio, and all 9 tab labels. The
`Issues, merge requests, pushes, and comments.` calendar caption matches §24.4 exactly. ✅

### DIFF-A03 · P2 · `/:ns/:proj/-/starrers` shows 0 starrers for a project the source shows as starred

`/byteblaze/dotfiles/-/starrers` renders `Starrers 0` / `This project isn't starred yet.`
dotfiles genuinely has `star_count: 0` in the seed and on the source card, so this is
self-consistent — noting it only because a starrers page that is always empty is worth a
second look on a project that does have stars (`/a11yproject/a11yproject.com/-/starrers`).

### DIFF-A04 · P2 · `/:ns/:proj/-/forks` empty-state copy

Mock: `0 forks: 0 public, 0 internal, and 0 private` + **`This user doesn't have any personal projects`**.
That last line is the *profile* empty state, not the fork-list one.

### DIFF-A05 · P2 · `/:ns/:proj/-/forks/new` hard-codes the source host

The "Project URL" prefix renders `http://localhost:8023/` while the mock is served from
`http://localhost:5201`. `assets/README.md §24.5` is explicit that host-dependent values must
be derived from the actual serving origin, not hard-coded. Same string also appears on
`/-/profile/account`.

### DIFF-A06 · P2 · Project-card link colour and row density

Source renders `namespace /` in grey and the project name in **bold near-black**; the mock renders
the whole `Byte Blaze / dotfiles` in link blue. Source rows are taller (description wraps at
~600px); mock descriptions run the full content width. Screenshots:
`assets/screenshots/diff/{source,mock}_.png`.

### DIFF-A07 · P2 · `/dashboard/todos` — actor name wraps to its own line

Source renders `**Roshan Jossy** assigned you.` on one line; the mock puts the linked name on
one line and `assigned you.` on the next. Source filter dropdowns are fixed-width (~150px)
boxes; the mock's shrink to fit their label. Everything else on this page — the 5 todo rows,
their titles, project paths, `!1270`/`!1485`/`#1`/`!40`/`!1071` references, `To Do 5 / Done 2`
counts, `Mark all as done` — matches exactly. Screenshots:
`assets/screenshots/diff/{source,mock}_dashboard_todos.png`.

### DIFF-A08 · P1 · Clone dropdown renders the literal `__GITLAB_SSH__` placeholder

| Field | Value |
|---|---|
| Route | `/:ns/:proj` clone dropdown (row 44) — tasks 293–297 read these |
| Mock SSH | `ssh://git@__GITLAB_SSH__/byteblaze/dotfiles.git` |
| Mock HTTP | `http://localhost:5201/byteblaze/dotfiles.git` ← correct, derived from the serving origin |
| Source | `ssh://git@10.186.197.203:2222/byteblaze/dotfiles.git` and `http://10.186.197.203:8023/byteblaze/dotfiles.git` |
| Why it matters | `assets/README.md §24.5` says both must come from the actual host. The HTTP one does; the SSH one ships the raw evaluator token instead. WebArena substitutes `__GITLAB_SSH__` in the *reference* value at eval time, so an agent reporting the literal token will not match the substituted reference. |
| Priority note | I priced this **P1**, not P0, because I could not confirm the substitution direction without running the evaluator. If `__GITLAB_SSH__` is substituted before comparison, tasks 293–297 fail outright and this is a P0. |
| Fix hint | Render `ssh://git@<window.location.hostname>:2222/<ns>/<proj>.git`, mirroring what the HTTP URL already does. |

### DIFF-A09 · P2 · Repo pages drop several source affordances

| Page | In the source, absent from the mock |
|---|---|
| project overview | `Add to tree` button, `Select Archive Format` button, the `Unverified` commit badge, and the last-commit block sits *above* the file-actions row (the mock puts it below). The mock also reorders the quick-action chips — source has `README / Auto DevOps enabled / Add LICENSE / …`, the mock has `README / Add LICENSE / … / Auto DevOps enabled`. |
| `/-/tree/:ref` | `Add to tree`, `Select Archive Format`, `Unverified`, and the `D` project-avatar tile in the left sidebar header |
| `/-/branches` | per-branch ahead/behind counts (`109` / `39`), the `Merge request` and `Compare` links, and `Select Archive Format`. Branch order is also reversed: source lists `master` then `main`, mock lists `main` then `master` (both under `Stale branches`). |
| `/-/blob/:ref/*path` | breadcrumb renders `main / dotfiles / / .bash_profile` — an extra empty segment before the filename. The source's file-action group is `Open in Web IDE / Toggle dropdown / Replace / Delete`; the mock adds a standalone `Edit` button alongside. |

### DIFF-A10 · P2 · Unseeded blob paths show a misleading placeholder

`/byteblaze/dotfiles/-/blob/main/.bash_profile` renders
**`This file is not displayed because it is too large or is binary.`** for a 3.01 KiB plain
shell script. `repo_files.json` is partial by design (14 of dotfiles' 47 blobs are seeded;
551 files across 159 projects), and `SOURCE.md` explicitly says an unseeded path "needs a
graceful placeholder" — so the *behaviour* is expected. The **copy** is not: it asserts a
reason that is false and that an agent could repeat as an answer.

**Explicit non-finding:** line numbering is fine. I initially suspected the blob view had
none, but that was this placeholder. Seeded non-markdown blobs render `#L1` and per-line
anchors correctly (`.finicky.js` 18 lines, `.gitignore` 117), and `README.md` renders as
markdown rather than numbered lines — which is what the source does too.

## ✅ Confirmed matching against the live source

- `/users/byteblaze/following` — **exact** text match, all 3 users, same order (anchor, webarena-533…537)
- `/users/byteblaze/starred` — same 3 projects, same order (anchor, webarena-523…527)
- `/byteblaze` profile header + all 9 tab labels — exact (anchor, 10 tasks)
- `/dashboard/todos` — exact row content and counts
- `/dashboard/groups`, `/dashboard/snippets`, `/explore/snippets` — exact empty states
- `/explore/groups` — same single public group `robert1003` with the same `0 / 1 / 1` counts
- `/-/profile` — every field label and helper string matches, including the exact
  `Use a private email - 2330-byteblaze@users.noreply.db0150aa304d` and the commit-email copy
- `/-/profile/preferences` — 2752 vs 2760 chars, no structural difference found
- `/search` result *content*: the 5 scopes are the right 5 (`Projects/Issues/Merge requests/Milestones/Users`,
  per §24.4, not a 7-tab strip), and `We couldn't find any projects matching OPT model` is verbatim

## Coverage — what I verified and what I did not

**Verified in full:** every implemented row from ROUTES.md §1–§5 (rows 1–66). Rows 24, 34,
42 and 68 are marked "Not migrated" in ROUTES.md and were skipped by design. Row 67
(`/:ns/:proj/activity`) is `[ ]` in ROUTES.md and renders `<Placeholder>` — correct for its
declared state, not reported as a bug. Row 98 (`/:ns/:proj/edit`) sits in §9, outside my
range, but cold-loads fine (I hit it incidentally).

**Not reached / left to another pass, stated plainly:**
- I did not screenshot-compare every §5 route — I captured **12 matched pairs** into
  `assets/screenshots/diff/` (`/`, `/dashboard/todos`, `/explore/projects/trending`,
  `/search?…`, `/byteblaze`, `/-/profile`, `/byteblaze/dotfiles`, `…/-/tree/main`,
  `…/-/blob/main/.bash_profile`, `…/-/commits/main`, `…/-/branches`,
  `/dehenne/awesome-visibility/-/graphs/master`) and text-diffed the rest.
- `/-/network/:ref` (row 59) and `/-/graphs/:ref/charts` (row 58) were cold-loaded and their
  headline numbers read, but I did not verify the chart *values* against the source.
- The `Visibility: Any` filter the source shows on the explore pages has no mock counterpart,
  so there was nothing to exercise (folded into BUG-A07).
- `?personal=true` (row 2) is accepted by the URL but I could not distinguish its effect,
  because all 14 of byteblaze's projects are personal. It is untestable on this seed rather
  than confirmed-working.
- I did not exercise the pagination controls on `/explore/projects` beyond `?page=2`, because
  the mock's card list and the source's differ in length by design (sampling).

**Source discipline:** I navigated and read `localhost:8023` only. No form was submitted, no
record created, edited, starred, followed or deleted on the source. All mutation testing ran
against `localhost:5201` under throwaway sids (`int_a*`, `iso*`, `td*`, `coldtodo*`).

## NOTE-1 · `SOURCE.md §7` is wrong about the feed token

`SOURCE.md §7` says the `exact_match` anchor `TMN_bBn9Z48qVbUFZV45` (webarena-259) "is rendered
on `/-/profile/account`". It is not. I located where it actually lives, on the live source,
logged in as byteblaze:

| Page | token in HTML | token in `innerText` |
|---|---|---|
| `/-/profile/account` | ❌ | ❌ |
| `/-/profile/personal_access_tokens` | ✅ | ❌ (masked input shows `********************`) |
| `/dashboard/issues` | ✅ | ❌ (inside the `?feed_token=` atom href) |

So on GitLab 15.7.5 the **Feed token section lives on `/-/profile/personal_access_tokens`
("Access Tokens")**, below the PAT table, with this copy:

> Feed token
> Your feed token authenticates you when your RSS reader loads a personalized RSS feed or when
> your calendar application loads a personalized calendar. It is visible in those feed URLs.
> It cannot be used to access any other data.
> Feed token
> Keep this token secret. Anyone who has it can read activity and issue RSS feeds or your
> calendar feed as if they were you. If that happens, reset this token.

The mock puts a near-copy of that section on `/-/profile/account` instead (and drops the
sentences `It cannot be used to access any other data.` and `If that happens, reset this
token.`), while `/-/profile/personal_access_tokens` is a bare stub. The token string **is**
in the mock's HTML (`src/pages/ProfileAccount.jsx`, `src/pages/IssuablesList.jsx`), so
webarena-259 is not lost — but an agent that follows the source's information architecture
looks in the wrong place. Whoever owns §4 should move the section to the Access Tokens page,
restore the two missing sentences, and make the reveal control actually work: clicking
`click to reveal` in the mock today leaves the field at `********************` and the token
never enters `innerText`.
