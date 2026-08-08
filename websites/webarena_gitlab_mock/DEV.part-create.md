# DEV PROGRESS — webarena_gitlab_mock · shard A (creation / mutation flows)

Scope: TODO.md **P1-A** (create project, 22 tasks), **P1-C** (repo file create/edit,
20 tasks), **P1-D** (groups, 5 tasks), **P1-E** (fork, 10 tasks) — 57 WebArena tasks.

**Build: PASS** — `(cd websites/webarena_gitlab_mock && npm run build)` → 152 modules,
no errors.

**Verified in a real browser** (chromium via `/tmp/pwvenv` + `LD_LIBRARY_PATH`
sysroot, dev server on :5183, 1920×1080). 38 functional assertions, all passing,
plus side-by-side screenshot comparison against
`assets/screenshots/reference/{new-project,new-project-blank,new-group,proj-newfile-dotfiles,proj-forks-new}.png`.

---

## Completed

### P1-A — create project  `[ROUTES #124 #125 #126 #127]`
- `src/pages/NewProject.jsx` — landing screen with **three** cards (not four),
  verbatim copy, hash panes `#blank_project` / `#create_from_template` /
  `#import_project`. Deep links to a hash render the pane directly; opening a
  pane hides the heading and the grid, as the source does.
- Blank form in the source's field order, with the namespace box, slug,
  Visibility Level radios (Public default) and the two Project Configuration
  checkboxes. No description field on the blank pane — that is deliberate.
- Template gallery: all **30** built-in templates with verbatim names and
  descriptions, `Preview` + `Use template`, `Built-in` tab counter = 30.
- Import pane: the 10 providers in source order; `Repository by URL` expands the
  inline Git-URL form and can actually create a project.
- Creating a project appends `projects` + an owner `members` row (level 50),
  bumps `nextIds`, and writes the first commit into the repo overlays.

**Anchors confirmed live:**
| Anchor | Result |
|---|---|
| `.visibility-icon` `title` starts `Private - …` (742–756) | ✅ |
| `/byteblaze/<slug>/-/commits` contains `Initial commit` (747, 752) | ✅ |
| `…/-/commits` contains `Initialized from 'Pages/Jekyll' project template` | ✅ |
| `.home-panel-description-markdown` = `Example Jekyll site using GitLab Pages: https://pages.gitlab.io/jekyll` (751, 756) | ✅ |
| `…/-/raw/main/README.md` = `# <name>` after "Initialize repository with a README" | ✅ |
| record survives reload and appears in `/dashboard/projects` | ✅ |

### P1-C — repository file create / edit  `[ROUTES #62 #63]`
- `src/pages/NewFile.jsx`, `src/pages/EditFile.jsx`, shared
  `src/components/create/FileEditor.jsx`.
- `?file_name=` / `?commit_message=` prefills work, so the project overview's
  **Add LICENSE** chip lands on a pre-filled editor.
- `Select a template type` (`.gitignore`, `.gitlab-ci.yml`,
  `.metrics-dashboard.yml`, `Dockerfile`, `LICENSE`) and, for LICENSE, the
  `Apply a template` licence dropdown.
- **Licence bodies are the real ones**, pulled read-only out of the container
  (`GET /api/v4/templates/licenses/<key>`) into
  `src/components/create/licenses.js` — 13 licences, `[fullname]`/`[project]`
  substituted like GitLab does. Tasks 411–414 and 736 match on `MIT License`,
  `Apache License`, `http://www.apache.org/licenses/LICENSE-2.0`,
  `GENERAL PUBLIC LICENSE` and the MIT "The above copyright notice…" clause —
  all present verbatim.
- Nested paths create folders: `real_space/urls.txt` makes both
  `/-/tree/main/real_space` and `/-/raw/main/real_space/urls.txt` resolve
  (webarena-552…555). ✅ verified.
- Editing `index.html` and reading `/-/raw/main/index.html` returns the edit
  (webarena-441…445). ✅ verified.
- Target Branch is editable; changing it creates the branch and reveals the
  "Start a **new merge request** with these changes" checkbox, exactly as the
  source hides/shows it.
- `RepoBlob.jsx`'s existing `Edit` / `Replace` / `Delete` menu items all resolve:
  `?replace=1` opens an empty buffer, `?delete=1` opens a delete confirmation.
- `src/pages/WebIde.jsx` — file tree + editor + commit panel writing the same
  overlay, so webarena-556…566 ("Use the Web IDE to create the README") work
  end to end on a freshly created repo. ✅ verified.

### P1-D — groups  `[ROUTES #119 #122 #123]`
- `src/pages/NewGroup.jsx` — both cards, the create pane with Group name,
  Group URL, Visibility level (group-specific help text, which differs from the
  project one), Role, "Who will be using this group?", "What will you use this
  group for?", plus the import pane. No description field, matching the source.
- Creating a group appends `groups` + an Owner `members` row.
  `/groups/coding_friends/-/group_members` resolves immediately afterwards and
  the group shows on `/dashboard/groups` and `/explore/groups`. ✅ verified
  (webarena-799…803).
- `src/pages/DashboardGroups.jsx`, `ExploreGroups.jsx`, `GroupsList.jsx` —
  tabs, `Search by name`, the six-option `Last created` listbox, the group-row
  anatomy with the three counters, the verbatim `/dashboard/groups` empty state
  (including the U+2019 in `member’s`), and the `No results found` search state.
- `src/pages/GroupSettings.jsx` (#123) and
  `src/components/create/GroupRollup.jsx` (#122 — activity / issues /
  merge_requests / milestones / labels / boards / packages) so the group sidebar
  has no dead links; the rollups aggregate over the group's projects.

### P1-E — fork  `[ROUTES #65 #66]`
- `src/pages/ForkProject.jsx` — the source's two-column page, namespace dropdown
  (search + `Namespaces` header), name / slug / description, the fork-specific
  visibility help text, `Fork project` / `Cancel`.
- `forkProject()` copies the source tree, file bodies, commit list and branches
  into the fork's overlays, sets `forked_from`, and increments the source's
  `forks_count`. The fork is browsable, not a stub.
- `src/pages/Forks.jsx` (#65) — the `N forks: A public, B internal, and C private`
  count line, search, sort, and the source's `This user doesn't have any personal
  projects` empty state. The `Fork` CTA flips to "Go to your fork" once forked.
- ✅ verified: forking `yjlou/2019-nCov` produces `/byteblaze/2019-nCov`, which
  appears inside `[data-qa-selector="projects_list"]` on `/dashboard/projects`
  (webarena-394…398, 522). `/byteblaze/nvidia-patch` still renders `404`, which
  webarena-398 requires.

### Also landed
- `src/pages/ProjectSettingsGeneral.jsx` (#98) — all six collapsible sections
  with verbatim titles/descriptions; Naming (name, ID, topics, description,
  avatar), Visibility with the full 17-row feature table, Badges, Service Desk,
  and a working Advanced block (housekeeping, export, archive/unarchive, change
  path, delete with confirmation).
- `src/pages/NewSnippet.jsx` (#128).

Every one of these writes through `AppContext.setState` → `saveState()` →
`POST /post?action=set_current`, so all of it lands in `/go`'s `state_diff`.
Observed keys after a full run: `projects`, `groups`, `members`,
`repo.fileOverlay.*`, `repo.treeOverlay.*`, `repo.commitOverlay.*`,
`repo.branchOverlay.*`, `nextIds.{project,group,member}`.

---

## Decisions worth knowing

1. **Slug derivation deviates from the source on purpose — and `utils/format.js`'s
   `slugify()` is wrong.** Measured on the live site (typed into `#project_name`,
   read `#project_path` back; no submit, no container write):
   `'Do it myself' → 'do-it-myself'`, `'nolan_honest_fans' → 'nolan_honest_fans'`,
   `'Awesome_DIY_ideas' → 'awesome_diy_ideas'` — i.e.
   `trim().toLowerCase().replace(/[^a-zA-Z0-9_.-]+/g,'-')`. The anchor routes are
   mixed case (`/byteblaze/Do-it-myself/-/raw/main/README.md`, `/byteblaze/AGISite`,
   `/byteblaze/TODO`), which on the real site resolve through GitLab's
   case-insensitive route lookup. The mock has no such lookup, so
   `components/create/mutations.js:deriveSlug()` keeps everything **except** the
   lower-casing — this is what TODO.md P1-A and `assets/data_model.md §12` already
   pinned.
   ⚠️ `src/utils/format.js` also exports a `slugify()` that collapses `_` → `-`.
   That breaks ~15 anchor routes (`nolan_honest_fans`, `web_agent_android_xl`,
   `11711_gitlab`, `coding_friends`, `agi_index`, `web_agent`, …). Nothing else
   imports it yet, so nothing is broken today, but it is a trap. See
   **NEEDS FILE** below.
2. **Licence bodies are container-sourced, not hand-written.** 176 KB of static
   JS, outside `state` — it never touches the POSTed payload.
3. **`state.snippets`** is created lazily by `NewSnippet.jsx` because SCHEMA.md's
   12 mutable modules do not include snippets. `stateTracker.js` falls back to a
   recursive value diff for unknown keys, so the write still shows in `/go`.
   No anchors depend on it; flagging it so `SCHEMA.md` can absorb it.
4. **Template file sets are synthetic.** Only the four anchored templates
   (Pages/Jekyll, Pages/Plain HTML, Android, NodeJS Express) matter, and only
   their *description* and *commit title* are anchored — both verbatim. The file
   bodies the templates drop in are plausible stand-ins, not the real
   `gitlab-org/project-templates` repos, which are not in the seed.

---

## NEEDS FILE (outside this shard's ownership)

- **`src/utils/format.js`** — `slugify()` collapses `_`/`.` to `-`. It must be
  `str.trim().replace(/[^a-zA-Z0-9_.-]+/g,'-')` (case preserved) or it will break
  every underscore-named anchor route the moment something imports it. Blocks:
  latent P1-A/P1-C anchor breakage.
- **`src/components/layout/routeContext.js`** — `resolveRouteContext()` matches
  `/groups/new` as a group context, so `Layout` draws a contextual sidebar for a
  group literally named "new". The source shows no sidebar and no breadcrumb bar
  on `/groups/new` (assets/README.md §19b). Worked around inside this shard with
  a `body.page-new-group` class + rules in `components/create/create.css`; the
  proper fix is to exclude `new` from the `root === 'groups'` branch, after which
  the workaround can be deleted.
- **`src/pages/ProjectOverview.jsx`** — TODO.md P1-E asks the project header to
  show **"Forked from &lt;source full name&gt;"** on a fork. `forkProject()` already
  writes `project.forked_from = {id, full_path, name, name_with_namespace}`;
  the header just needs to render it. Not anchored (no evaluator reads it), so
  it is cosmetic, but it is the one P1-E bullet I could not land.
- **`SCHEMA.md`** — §6 "Not yet wired" rows for create-project, create-file,
  create-group and fork are now wired and can move up; `state.snippets` should be
  documented (see decision 3).

## Seed gaps hit (nothing fabricated)

None that blocked a task. The four anchored project templates have no real file
corpus in the seed (see decision 4) — only their description and commit title are
anchored, and both are exact.

---

## Files

Created: `src/pages/{NewProject,NewGroup,ForkProject,NewFile,EditFile,WebIde,Forks,GroupsList,DashboardGroups,ExploreGroups,GroupSettings,ProjectSettingsGeneral,NewSnippet}.jsx`,
`src/components/create/{mutations.js,templates.js,licenses.js,FileEditor.jsx,GroupRollup.jsx,useGo.js,create.css}`.

`src/App.jsx`: one import block plus 20 `<Route>` element swaps, all inside this
shard's allotted paths. `ROUTES.md` rows 4, 19, 62, 63, 65, 66, 98, 119, 122–129
marked `[x]`; TODO.md P1-A / P1-C / P1-D / P1-E items marked `[x]`.
