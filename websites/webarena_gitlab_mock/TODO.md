# webarena_gitlab_mock — TODO

> Status: **READY FOR DEV**
> Source: http://localhost:8023 · image `gitlab-populated-final-port8023:latest` · container `gitlab`
> App: GitLab CE **15.7.5** · Default user: **byteblaze** (id 2330, "Byte Blaze")
> Recon: `SOURCE.md` | Routes: `ROUTES.md` | Design: `DESIGN.md` | Views: `assets/README.md` | Data: `assets/data_model.md`
> Task contract: `assets/task_anchors.md` — **204 tasks, 145 anchor routes, 252 anchor strings, 25 anchor locators**
> Recon mode: **FULL** (docker exec + gitlab-psql + git + logged-in Playwright crawl)

## Status Legend
- [ ] Not started · [~] In progress · [x] Done

> **Status cells reconciled against reality by the round-3 audit (2026-08-07).**
> Every `[x]` below was re-checked; **zero false completions were found** — no item
> claiming done is a stub or a `<Placeholder>`. Several items were *under*-claimed
> and have been promoted; each promotion names the evidence inline. The remaining
> `[ ]`/`[~]` items are the honest work list for the next round. Where an item is
> `[x]` but the implementation is thinner than the source, that is stated on the
> item rather than hidden by the checkbox.

---

## Read this before writing any code

GitLab's anchor set is unlike reddit's or shopping's: **66 of the 145 anchor
routes name records that do not exist in the source.** They are the
post-conditions of *creation* tasks — the evaluator navigates to
`/byteblaze/AGISite` or `/groups/x-lab/-/group_members` only after the agent has
created that project or group. So on this site the **write paths are the
product**, not a finishing touch:

| Flow | Tasks | Where |
|---|---|---|
| Create project (blank / from template) | 22 | P1-A |
| Add project member at a named role | 20 | P1-B |
| Create file / edit file in a repo | 20 | P1-C |
| Create group + add group members | 5 | P1-D |
| Fork a project | 10 | P1-E |
| Create issue with assignee + due date | 8 | P1-F |
| Create merge request with reviewer | 6 | P1-G |
| Create milestone with start/due dates | 5 | P1-H |
| Post a comment on an issue/MR | 8 | P1-I |
| Star / follow / set profile status / set website URL | 17 | P1-J |
| Read the contributors graph | 20 | P1-K |

Build P0 (shell + routing + read views) and then work P1 **in that table's
order**. A beautiful read-only GitLab scores near zero here.

**Do not pre-seed the records those tasks create.** A project that already exists
makes the create flow fail ("path has already been taken") and the task scores 0.

---

## P0 — Shell, Routing, Data Pipeline

- [x] Scaffold from `websites/mixpanel_mock`: `package.json`, `vite.config.js` with
      `secureMockApiPlugin()` **first** in `plugins[]`, then the `mock-api` plugin
      registered under **both** `configureServer` **and** `configurePreviewServer`.
      Endpoints `/post`, `/state`, `/go`, `/upload`, `/files`; state at
      `.mock-states/<sid>.json` + `<sid>.initial.json`; sid sanitized with
      `sid.replace(/[^a-zA-Z0-9_-]/g, '')`.
- [x] `src/utils/dataManager.js`: `getSessionId`, `storageKey`, `initialKey`,
      `fetchCustomState`, `createInitialData`, `initializeData(sid, customState)`,
      `saveState(state, sid)` → POSTs `{action:'set_current', state}`.
- [x] `src/context/AppContext.jsx`: check `localStorage.getItem(initialKey(sid))`
      **before** calling `initializeData()`, or injected task state never loads.
- [x] `createInitialData()` loading the 12 mutable seed modules
      (`projects, users, groups, issues, merge_requests, notes, labels,
      milestones, members, stars, follows, todos`) — see `assets/data_model.md §12`.
      **Import the 6 git modules (`repo_files, repo_trees, commits, contributors,
      branches, tags`) as static reference, NOT into state.** They are 2.4 MB and
      never mutate except by file create/edit; model those as a small
      `state.repo.fileOverlay` keyed `"<full_path>:<ref>:<path>"` that shadows
      `repo_files.json`. Mutable state stays at ~2.1 MB.
- [x] `nextIds` counters in state so created records don't collide with real ids.
      ⚠️ The constants originally written here (`note: 310000, label: 1800`) were
      **inside** the real seed id range and silently corrupted the `/go` diff.
      They are no longer constants: `SEED_NEXT_IDS` in `src/utils/dataManager.js`
      derives all eight from `max(seed id) + 1` at module load, and
      `AppContext.allocateId` additionally skips any id already present in the
      target collection. Re-verified round 3 by creating **two of every kind in
      one session** (project, group, issue, MR, note, label, milestone, member):
      16/16 flows, every id real and unique, zero duplicates, zero nulls.
- [x] `/go` route + `src/utils/stateTracker.js`.
- [x] `RedirectWithQuery` instead of `<Navigate>` everywhere so `?sid=` survives
      every redirect, form submit and programmatic navigation.
- [x] **Router must accept a trailing slash before the query string.**
      `/-/issues/?label_name%5B%5D=bug` and `/-/issues?label_name[]=bug` are the
      same page; 12 anchor URLs use the slash form.
- [x] **Router must accept URL-encoded params**: `label_name%5B%5D` → `label_name[]`,
      `not%5Blabel_name%5D%5B%5D` → `not[label_name][]`, `%20`→space,
      `%3A`→`:`, `%F0%9F%90%9E`→`🐞`.
- [x] App shell per `DESIGN.md §4` and `assets/README.md §1`: fixed top navbar,
      collapsible left contextual sidebar, content area, and a right sidebar on
      issue/MR pages. Sidebar contents switch between project / group / user /
      dashboard context.
- [x] Routing for every `ROUTES.md` row. P0 rows first (1, 2, 5, 6, 14, 15, 25,
      30, 33, 35, 36, 44–48, 50, 51, 62, 63, 66, 69–71, 78, 79, 83, 90–92, 94, 95,
      119, 121, 124–126).
- [x] `/:ns/:proj/-/raw/:ref/*path` must serve **bare text with no app chrome** —
      `<pre>`-free plain body, matching the source's `text/plain` response.
      15 tasks read these URLs. If it renders inside the SPA shell, they all fail.
- [x] A `/help/*` catch-all rendering a Documentation stub, so no chrome link 404s.
- [x] `SCHEMA.md` with the state table and the Observable State Changes table.

---

## P1-A — Create project  *(22 tasks — the single highest-value flow)*

- [x] `[ROUTES #124]` `/projects/new` — **three** cards (verified in the source
      DOM; there is no "Run CI/CD for external repository" card on this build):
      **"Create blank project"**, **"Create from template"**, **"Import project"**,
      under the page heading **"Create new project"**. Clicking one switches to the
      panel and sets the hash (`#blank_project`, `#create_from_template`,
      `#import_project`).
- [x] `[ROUTES #125]` Blank-project form. Fields in the source's order:
      **Project name** (required), **Project URL** (namespace dropdown showing
      `byteblaze` + any group the user owns, then `/`), **Project slug**,
      **Visibility Level** radios — **Private** / **Internal** / **Public**, each
      with the source's helper copy (identical to the `.visibility-icon` titles
      below, minus the leading `"<Level> - "`), then a **Project Configuration**
      section with two checkboxes: **"Initialize repository with a README"**
      (checked by default) and **"Enable Static Application Security Testing (SAST)"**.
      Buttons: **Create project**, **Cancel**.
      **There is no "Project description" field on this form** — descriptions are
      set later at `/:ns/:proj/edit`, or by the template. See `assets/README.md §19a`
      for the field-by-field DOM.
      - Slug derivation must match GitLab: task 566 creates a project named
        `Do it myself` and the anchor route is `/byteblaze/Do-it-myself/...` —
        so **case is preserved and spaces become `-`**. Runs of `.`/`_`/space
        collapse to a single `-`; leading/trailing `-` stripped.
      - On submit: append to `projects`, add an owner row to `members`
        (access_level 50), create a `main` branch, and — when "Initialize
        repository with a README" is checked — create `README.md` containing
        `# <Project name>\n\n` and a commit titled **`Initial commit`**
        (ANCHOR, tasks 747, 752). Then navigate to `/:ns/:slug`.
- [x] `[ROUTES #126]` Template gallery. Render the real GitLab 15.7 template list
      with exact names and descriptions (source: `lib/gitlab/project_template.rb`).
      Each row has the template name, description, a **Preview** link and a
      **Use template** button. The four templates tasks require:

      | Name | Description (verbatim) |
      |---|---|
      | `Pages/Jekyll` | `Everything you need to create a GitLab Pages site using Jekyll` |
      | `Pages/Plain HTML` | `Everything you need to create a GitLab Pages site using plain HTML` |
      | `Android` | `A ready-to-go template for use with Android apps` |
      | `NodeJS Express` | `Includes an MVC structure to help you get started` |

      Also list at least: `Ruby on Rails`, `Spring`, `iOS (Swift)`, `.NET Core`,
      `Go Micro`, `Pages/Bridgetown`, `Pages/Gatsby`, `Pages/Hugo`, `Pages/Pelican`,
      `Pages/GitBook`, `Pages/Hexo`, `Pages/Middleman`, `Netlify/Hugo`,
      `Netlify/Jekyll`, `Netlify/Plain HTML`, `Netlify/GitBook`, `Netlify/Hexo`,
      `SalesforceDX`, `Serverless Framework/JS`, `Jsonnet for Dynamic Child Pipelines`,
      `GitLab Cluster Management`, `Kotlin Native Linux`, `TYPO3 Distribution`,
      `Gitpod/Spring Petclinic`, `Tencent Serverless Framework/NextjsSSR`.
- [x] **Template creation post-conditions (ANCHOR, tasks 748–756).** Creating from
      a template must:
      - set the project **description** to the template's own README blurb, because
        the evaluator reads `document.querySelector('.home-panel-description-markdown').outerText`:
        - `Pages/Jekyll` → `Example Jekyll site using GitLab Pages: https://pages.gitlab.io/jekyll`
        - `Pages/Plain HTML` → `Example plain HTML site using GitLab Pages: https://pages.gitlab.io/plain-html`
      - create a first commit whose title is exactly
        **`Initialized from '<Template Name>' project template`** —
        `Initialized from 'Android' project template`,
        `Initialized from 'NodeJS Express' project template`. This must be visible
        on `/:ns/:proj/-/commits` (**bare, no ref** — see P0).
- [x] `.visibility-icon` on the project header must carry the source `title`
      **verbatim** (ANCHOR, tasks 742–756):
      - private → `Private - Project access must be granted explicitly to each user. If this project is part of a group, access is granted to members of the group.`
      - internal → `Internal - The project can be accessed by any logged in user except external users.`
      - public → `Public - The project can be accessed without any authentication.`

---

## P1-B — Project members  *(20 tasks)*

- [x] `[ROUTES #94]` `/:ns/:proj/-/project_members` — members table with columns
      **Account**, **Source**, **Access granted**, **Max role**, **Expiration**,
      **Created on**, **Last activity** (that order — verified in the source DOM),
      an **Invite members** button, a filtered-search box, and Members/Groups tabs.
      Each Account cell renders the avatar, the display name, and **`@username`**
      on its own line — 20 anchors match on `@abisubramanya27`, `@vinta`,
      `@primer`, `@convexegg`, `@Seirdy`, `@bblanchon`, `@lahwaacz`, `@yjlou`,
      `@alexhutnik`, `@V13Axel`. Rendering only the display name fails all of them.
- [x] `[ROUTES #95]` **Invite members modal.** Title **"Invite members"**, a
      username/name typeahead over `users.json` (multi-select chips), a
      **"Select a role"** dropdown with exactly **Guest / Reporter / Developer /
      Maintainer / Owner**, an **Access expiration date** field, and
      **Invite** / **Cancel**. On invite: append to `members` with the matching
      `access_level` and re-render the table. The evaluator helper
      `gitlab_get_project_memeber_role(page, '<username>')` reads the Max-role
      cell of that user's row, so the role text must be one of the six labels
      in `assets/data_model.md §9`, spelled exactly.
- [x] The owner row renders **Owner** and shows "It's you" next to byteblaze.
- [x] `[ROUTES #121]` `/groups/:group/-/group_members` — same table, same modal.

---

## P1-C — Repository file create / edit  *(20 tasks)*

- [x] `[ROUTES #62]` `/:ns/:proj/-/new/:ref` — new-file page. **File name** input
      (accepts `folder/name.ext`, which creates the folder), a large code editor,
      **Commit message** textarea (defaults to `Add new file`), **Target Branch**
      input, a "Start a new merge request" checkbox, **Commit changes** and
      **Cancel**. Honour `?file_name=` and `?commit_message=` prefills.
      - Creating `real_space/urls.txt` must make
        `/-/tree/main/real_space` and `/-/raw/main/real_space/urls.txt` resolve
        (ANCHOR, tasks 552–555).
- [x] `[ROUTES #63]` `/:ns/:proj/-/edit/:ref/*path` — same editor pre-filled with
      the current content; **Commit changes** writes to `state.repo.fileOverlay`
      and appends a commit. Task 441–445 edit `index.html`'s `<title>` and the
      evaluator reads `/-/raw/main/index.html`, so the overlay must be what
      `/-/raw` serves.
- [x] `[ROUTES #47]` Blob view file actions must include a working **Edit** button
      routing to `/-/edit/:ref/*path`, plus **Web IDE**, **Replace**, **Delete**,
      **Raw**, **Blame**, **History**, **Permalink**, and a copy-path button.
- [x] "Add LICENSE" affordance: the project overview shows an **Add LICENSE**
      button when the repo has none, linking to
      `/-/new/main?commit_message=Add+LICENSE&file_name=LICENSE`, and the editor
      offers a license-template dropdown containing at least **MIT License** and
      **Apache License 2.0**. Tasks 411–414 and 736 read back
      `MIT License`, `GENERAL PUBLIC LICENSE`, `Apache License`,
      `http://www.apache.org/licenses/LICENSE-2.0`, and
      `The above copyright notice and this permission notice shall be included in all copies…`.
      Ship those license bodies verbatim as static text.
- [x] Web IDE (`/-/ide/project/:ns/:proj/edit/:ref/-/`) — tasks 562–566 say "Use
      the Web IDE". A simple two-pane editor (file tree + textarea + Commit) that
      writes the same overlay is enough; it does not need to look like the real IDE.

---

## P1-D — Groups  *(5 tasks)*

- [x] `[ROUTES #119]` `/groups/new` — **Group name**, **Group URL** (slug derived
      from the name), **Visibility level** radios (Private / Internal / Public with
      source helper copy), **Role**, **Who will be using this group?**
      (My company or team / Just me), **What will you use this group for?**,
      and **Create group**. On submit append to `groups`, add byteblaze as Owner,
      then navigate to `/:slug`.
- [x] `[ROUTES #120]` `/:group` group overview — Subgroups and projects /
      Shared projects / Archived projects tabs, "New subgroup" + "New project"
      buttons, and the real empty state for a brand-new group.
- [x] `[ROUTES #121]` `/groups/:group/-/group_members` reachable **immediately
      after creation** for slugs `n-lab`, `x-lab`, `crew`, `coding_friends`,
      `webagent` (ANCHOR, tasks 799–803).

---

## P1-E — Fork  *(10 tasks)*

- [x] `[ROUTES #66]` `/:ns/:proj/-/forks/new` — "Fork project" page, namespace
      picker (cards for `byteblaze` and each owned group), project name / slug /
      description / visibility fields, **Fork project** button.
- [x] Forking copies the source project's name, description, repo tree, files,
      commits and branches into `<namespace>/<path>`, sets
      `forked_from` on the new project, increments the source's `forks_count`, and
      navigates to the fork. The project header then shows
      **"Forked from <source full name>"**.
- [x] The **Fork** button + count on the project header routes here.
- [x] Tasks 394–398 fork `yjlou/2019-nCov`, `convexegg/chatgpt`,
      `eriklindernoren/PyTorch-GAN`, `root/metaseq`, and `aklsh/{CacheEval,SimCache,
      dots,nvidia-patch,viewgrades-scraper}` into `byteblaze/`. Task 522 forks
      **both** `facebook/create-react-app` and `facebook/buck`, then reads
      `[data-qa-selector="projects_list"]` on `/dashboard/projects` — so
      **`/dashboard/projects` must carry that `data-qa-selector`** and list the forks.

---

## P1-F — Issues  *(8 creation tasks + all the read views)*

- [x] Issue list rows read **`created N years ago by X`**, not "opened N ago"
      (`assets/README.md §13`). The new-issue route is `/:ns/:proj/-/issues/new`.
- [x] `[ROUTES #69]` Issue list: **Open** / **Closed** / **All** tabs with counts,
      the filtered-search token bar (Assignee, Author, Milestone, Label, My-Reaction,
      Confidential + free text), a sort dropdown, **New issue** button, **Edit
      issues** bulk mode, and pagination. Filters must implement the semantics in
      `ROUTES.md § Query Parameters`, including `label_name[]=None` (no label) and
      `not[label_name][]=X` (exclude).
- [x] `[ROUTES #70]` Issue detail. Required DOM (evaluators select these exactly):
      - `[data-qa-selector="title_content"]` around the issue title
      - `.detail-page-description` around the description body
      - `#notes-list` for the activity timeline (see P1-I)
      - right sidebar blocks in source order, each with the source's classes:
        `.block.assignee`, `.block.milestone`, the **due-date block**,
        `.block.time-tracking`, `.block.labels`, `.block.confidentiality`,
        `.block.lock`, `.block.participants`, `.block.subscriptions`,
        `.block.reference`
      - the status badge reads **Open** or **Closed**
- [x] **Due-date selector — two views, two different selectors. Do not unify them.**
      Verified against the source DOM (`assets/README.md §14b`, §16b):
      - On an **issue**, the block is `<div class="block" data-testid="sidebar-due-date">`.
        There is **no `.block.due_date` class on an issue page.** Tasks 658–660 and
        808 select `[data-testid="sidebar-due-date"]`.
      - `.block.due_date` and `.block.start_date` exist **only on milestone detail**,
        where tasks 590–593 select them (see P1-H).
      Adding `.due_date` to the issue sidebar or `data-testid` to the milestone
      blocks would look harmless and silently mis-serve one of the two task sets.
- [x] `[ROUTES #71]` New-issue form: **Title**, **Type** (Issue/Incident),
      **Description** with Write/Preview tabs and the markdown toolbar,
      **Assignee** (with an "Assign to me" link), **Milestone**, **Labels**,
      **Due date** (date picker), **This issue is confidential** checkbox,
      **Create issue** / **Cancel**.
- [x] Sidebar edit-in-place: clicking **Edit** on Assignee / Milestone / Due date /
      Labels opens the dropdown and applies immediately. Tasks 658–660 and 808
      create an issue, assign a user and set a due date, then read
      `.block.assignee` and `[data-testid="sidebar-due-date"]`.
- [x] Date rendering must be GitLab's: **`Dec 31, 2030`**, **`Apr 1, 2033`**,
      **`Jul 18, 2033`**, **`Mar 31, 2033`**, **`Jan 3, 2030`** — `MMM D, YYYY`,
      no leading zero. These are literal anchor strings.
      **Other date formats on this build are different — do not reuse `MMM D, YYYY`
      everywhere** (all verified in `assets/README.md`):
      - commit-list date headers: **`19 Mar, 2023`** (`D MMM, YYYY`) — §11
      - profile "Member since": **`Member since March 23, 2023`** (full month) — §7
      - milestone date range: **`Jan 16, 2030–Jan 30, 2030`** — EN DASH, **no
        surrounding spaces** — §16b
- [x] Assignee block renders the assignee's **display name** (e.g. `Roshan Jossey`,
      `Abishek S`, `Byte Blaze`) — anchors 658, 659, 660, 806, 808, 809 match on it.
- [x] `[ROUTES #5]` `/dashboard/issues` with `scope`, `state`, `assignee_username`,
      `milestone_title` — five anchor URLs use it.

---

## P1-G — Merge requests  *(6 creation tasks)*

- [x] `[ROUTES #78]` MR list — as issues, plus the source→target branch line and
      the pipeline/approval columns.
- [x] `[ROUTES #79]` MR detail. Required DOM:
      - **`.detail-page-description` on an MR is the "requested to merge" banner,
        not the description body.** The source renders it as
        `<author> requested to merge <source> into <target> <relative-time>`, and
        the two branch names inside it are `a.gl-font-monospace` links —
        **`[0]` = source branch, `[1]` = target branch** (ANCHOR 666–668, 806;
        verified on 10 MRs, `assets/README.md §15b`). There are **two**
        `.detail-page-description` elements on the page and the banner must be the
        **first** in document order, because the evaluator uses `querySelectorAll`
        and indexes from it. Getting this backwards inverts source/target on four
        tasks.
      - `.block.reviewer` in the right sidebar, alongside `.block.assignee`
      - `#notes-list`
      - Overview / Commits / Changes tabs, and the merge widget with
        **Merge**, **Close merge request**, **Mark as draft**, and
        **Edit commit message** (not "Modify merge commit")
- [x] `[ROUTES #84]` New MR: step 1 **Source branch** / **Target branch** pickers +
      **Compare branches and continue**; step 2 the full form with Title,
      Description, **Assignee**, **Reviewer**, Milestone, Labels, and
      **Create merge request**. Tasks 666–668 and 806 create an MR from a named
      source branch into a named target branch and assign a reviewer.
- [x] `[ROUTES #83]` MR edit — changing the Reviewer must be reachable both from
      the sidebar and from `/-/merge_requests/:iid/edit`.
- [x] `[ROUTES #6]` `/dashboard/merge_requests` with `assignee_username` and
      `reviewer_username` (anchors 156, 357).

---

## P1-H — Milestones  *(5 tasks)*

- [x] `[ROUTES #91]` `/-/milestones/new` — **Title**, **Description**,
      **Start Date**, **Due Date**, **Create milestone**.
- [x] `[ROUTES #92]` Milestone detail — the whole page body wrapped in
      **`#content-body`**, with `.block.start_date` and `.block.due_date` in the
      right column (these classes exist **here only**, not on issues — see P1-F).
      Tasks 590–594 read all three. Individual dates format `MMM D, YYYY`; the
      range renders as `Jan 16, 2030–Jan 30, 2030` with a bare EN DASH and
      **no surrounding spaces**.
- [x] `[ROUTES #90]` Milestone list with Open/Closed tabs and per-milestone
      issue/MR progress bars.

---

## P1-I — Comments  *(8 tasks)*

- [x] Comment form under the timeline: **Write** / **Preview** tabs, markdown
      toolbar, a textarea placeholder **"Write a comment or drag your files here…"**,
      a **Comment** button and a "Close issue" / "Close merge request" split action.
- [x] Posting appends to `notes` and renders as the **last** element of
      `#notes-list`, with the body inside `.timeline-discussion-body`. Tasks
      390–393 run
      `document.querySelector('[id="notes-list"]').lastElementChild.querySelector('.timeline-discussion-body').outerText`
      and expect exactly `lgtm`, `close because non reproducible`, `Good idea`,
      `Thank you`. Do not append a signature, timestamp, or trailing whitespace
      inside that element.
- [x] System notes render as grey activity lines, user notes as comment cards with
      avatar, `@author`, relative time, and an actions menu.

---

## P1-J — Profile, stars, follows  *(17 tasks)*

- [x] `[ROUTES #35]` `/-/profile` — the **Website URL** field writes
      `users[byteblaze].website_url`; `/byteblaze` then renders it inside
      `.profile-header [itemprop="url"]` **verbatim, with no scheme added**.
      Tasks 448–452 expect exactly `egg.tart.com`, `helloworld.xyz`,
      `a11yproject.contributor.me`, `www.byteblaze.com`, `byteblaze.github.io`.
- [x] `[ROUTES #36]` **Set status** modal (opened from the avatar menu and from the
      profile page): emoji picker, "What's your status?" input, "Busy" checkbox,
      "Clear status after" dropdown. `/byteblaze` renders it in `.cover-status`
      such that `.cover-status.lastChild.textContent` is exactly the message —
      `Cruising`, `Enjoying life`, `Playing Badminton`,
      `Resting due to leg injury`, `Out of Office` (tasks 418–422). Put the emoji
      in its own preceding element so the **last** child is the bare message text.
- [x] `[ROUTES #30]` `/users/byteblaze/starred` and the **Star / Unstar** button on
      every project header (with a live count). Tasks 523–527 star the top-N
      most-starred repos and read the starred list back.
      *Marker was stale; driven green in round 5 and re-confirmed round 6.*
      `Star | 55` → `Unstar | 56`, survives reload, appears on
      `/users/byteblaze/starred`, and Unstar reverses both. webarena-523 replays.
- [x] `[ROUTES #33]` `/users/byteblaze/following` rendering `.user-profile` with a
      card per followed user showing **`@username`**. A **Follow / Unfollow**
      button on every user profile. Tasks 533–537 follow named users then read the
      list. The source only has 5 follow rows — the rest come from the task.
- [x] `[ROUTES #43]` `/-/profile/personal_access_tokens` must display the feed
      token **`TMN_bBn9Z48qVbUFZV45`** (ANCHOR, `exact_match`, webarena-259).
      *Route corrected round 6 (TEST DIFF-007).* The source puts the Feed token
      section on `/-/profile/personal_access_tokens`, masked behind
      `********************` with the real value in the DOM, **not** on
      `/-/profile/account`. `src/pages/ProfileKeys.jsx` matches that (BUG-A10).

---

## P1-K — Contributors graph  *(20 tasks — pure read, high value)*

- [x] `[ROUTES #57]` `/:ns/:proj/-/graphs/:ref` ("Contributors"). Must render:
      - a **date-range control** and an overall commits-over-time area chart
      - one card per author, sorted by descending commit count, each showing
        the author's **name**, **email**, a line like **`N commits`**, and that
        author's own commits-over-time chart
      - the totals must come from `contributors.json` (see `assets/data_model.md §11`)
- [x] The 13 projects with per-day data must let an agent answer "how many commits
      did X make on date D" — either by the chart being readable or, better, by a
      per-author per-day table/tooltip. Answers the evaluator expects include
      `1`, `2`, `0`, `5`, `14`, `16`, `414`,
      `Susan Zhang: 70`, `Stephen Roller: 51`, `Peter Albert: 12`.
- [x] Non-default refs must work: `/dehenne/awesome-visibility/-/graphs/master`
      and `/amwhalen/archive-my-tweets/-/graphs/php52` are anchors.
- [x] `[ROUTES #50, #51]` `/-/commits/:ref` **and the bare `/-/commits`** (which
      redirects to the default branch) — six anchors use the bare form.
      Commits grouped by date with the source's header format, each row showing
      the message, author, short SHA, and copy/browse actions.

---

## P2 — Depth & Realism

- [x] `[ROUTES #21–23]` Search: landing page, `?search=&scope=` result page, and
      `?project_id=` scoping. **The scope picker is a 240px vertical pill list in a
      left sidebar, not a tab strip, and this build exposes only 5 scopes** —
      see `assets/README.md §23` for the exact list and DOM.
- [x] `[ROUTES #87]` Labels page headings are **`Prioritized Labels`** and
      **`Other Labels`** (title case on both words) — `assets/README.md §16a`.
- [x] `[ROUTES #7–12]` Dashboard todos (with a working **Done** action),
      activity feed, milestones, groups, snippets empty state.
      *Promoted round 3.* All six routes cold-load and render; `Mark as done`,
      `Mark all as done` and the Done-tab restore control all mutate `todos` and
      persist; the activity feed now carries the source's `No activities found`
      empty state and `?filter=starred` selects its tab (BUG-A08 closed).
- [x] `[ROUTES #16–19]` Explore trending / most-starred / topics / groups.
      *Closed round 6 — the "still open" clause was stale.*
      `/explore/projects/trending` renders the source's real empty state
      (BUG-A04), and `src/pages/ExploreTopics.jsx` now renders the shared
      `<ProjectsPrimaryTabs active="topics">` above the source's own
      `shared/empty_states/_topics.html.haml` copy (BUG-A12 closed).
- [x] `[ROUTES #26–32]` The remaining profile tabs.
- [x] `[ROUTES #53–61]` Branches (active/stale/all), tags, network graph,
      file finder, compare.
- [x] `[ROUTES #64, 65]` Starrers list, forks list.
      *Both render real views and were cold-loaded green in round 5
      (`src/pages/Starrers.jsx`, `src/pages/Forks.jsx`); the marker was stale.*
- [x] `[ROUTES #87–89]` Labels list + create/edit with the colour swatch picker;
      scoped-label (`a::b`) two-tone rendering per `DESIGN.md §5`.
- [x] `[ROUTES #98–105]` Project settings pages.
      *Closed round 6.* Row 98 (`/:ns/:proj/edit`) carries all five source
      sections — Naming/topics/avatar, Visibility & permissions, Badges, Service
      Desk and Advanced (rename/transfer/archive/delete) — so BUG-B09 is closed.
      Rows 99–105 are implemented from the logged-in `assets/html/r4-set-*.html`
      captures (`src/pages/ProjectSettingsRepo.jsx`,
      `src/pages/ProjectSettingsMisc.jsx`); every form mutates
      `ui.projectSettings` and survives reload.
      **One declared gap:** the 37 `…/settings/integrations/:slug/edit` pages are
      a Vue app and cannot be recovered from a static capture — see the
      Intentionally-Not-Migrated table in `ROUTES.md`.
- [x] `[ROUTES #106–118]` The CI/CD, analytics and registry leaves. These are
      all empty states in the source; render the shell + the real empty copy so
      the left sidebar has **no dead links**.
      *Closed round 6.* Rows 106–112 and 114–118 landed in round 4
      (`src/pages/ProjectOps.jsx`); rows 113 and 115 landed this round
      (`src/pages/ProjectSettingsMisc.jsx`). **The `<Placeholder>` component has
      been deleted** — `src/components/layout/Placeholder.jsx` no longer exists,
      so the literal sentence *"This view is registered in `ROUTES.md` as row #N
      and has not been implemented yet."* cannot appear anywhere in the app.
- [x] `[ROUTES #38]` `/-/profile/preferences` with a working colour-theme and
      syntax-theme picker.
- [x] `[ROUTES #75]` Issue boards.
- [x] Markdown rendering for descriptions, comments and READMEs (headings, lists,
      code fences, tables, task lists, `@mentions`, `#123` / `!123` autolinks,
      emoji shortcodes). The source data is full of it.
      *Promoted round 3.* `src/utils/markdown.js` ships a raw-HTML safelist, so an
      `<img>` inside a comment body renders as an image instead of leaking as
      literal text (BUG-B06 closed). Verified on
      `/a11yproject/a11yproject.com/-/issues/719`: 2 images rendered, 1 heading,
      8 code spans, 2 links, and `document.body.innerText` contains no literal
      `<img `. External `src` values are parked on `data-canonical-src` with a
      local placeholder, so the offline guarantee holds.
- [ ] Syntax highlighting in the blob view (theme in `DESIGN.md`).
      *Re-checked round 3 and still not started.* `/byteblaze/dotfiles/-/blob/main/.gitignore`
      renders 117 line elements and **zero** token spans; nothing in `src/` matches
      `hljs`/`prism`/`highlight` outside `ProfilePreferences.jsx`'s theme picker,
      which currently selects a theme nothing consumes.
- [x] Relative-time formatting matching the source ("3 years ago", "2 weeks ago")
      with the absolute date in a `title` tooltip.
      *Promoted round 3.* Verified: the issue-719 timestamp carries
      `title="Dec 30, 2018 11:42am PST"`.

---

## Data Seed

Seeds live in `src/data/`; the contract is `assets/data_model.md`.

*Row counts re-measured round 3 — every one matches this spec exactly.*

- [x] `projects.json` — **all 175** real projects with real `full_path`,
      `visibility`, `star_count`, `default_branch`, `commit_count` — **175 ✓**
- [x] `users.json` — 1 133 real users incl. every username named in an anchor — **1133 ✓**
- [x] `groups.json` — the 2 real groups (`gitlab-instance-58545a48`, `robert1003`) — **2 ✓**
- [x] `issues.json` — 613 issues; all 10 anchored `(project_id, iid)` present — **613 ✓**
- [x] `merge_requests.json` — 729 MRs; all 8 anchored `(project_id, iid)` present — **729 ✓**
- [x] `notes.json` — 1 599 comments; full thread on every anchored issue/MR — **1599 ✓**
- [x] `labels.json` (630) / `milestones.json` (202) / `members.json` (183) — **630 / 202 / 183 ✓**
- [x] `stars.json` (569) / `follows.json` (5) / `todos.json` (7) — **569 / 5 / 7 ✓**
- [x] `commits.json` (173 projects) / `contributors.json` (173, 13 with per-day
      detail) / `branches.json` / `tags.json` — **173 / 173 / 173 (963 branches) / 17 (208 tags) ✓**
- [x] `repo_trees.json` (173) / `repo_files.json` (551 real file bodies) —
      **173 trees (3 131 entries) / 159 project file maps ✓**
- [x] Verify the checklist in `assets/data_model.md §14` before declaring done.
      ***Run end to end for the first time in round 18 — 9/9 pass.*** Full
      item-by-item results in `AUDIT.md §5`. Both late seed modules are wired and
      documented: `tree_last_commits.json` is consumed by
      `src/pages/RepoTree.jsx:12`, `resource_events.json` by
      `src/pages/NotesTimeline.jsx:12`; both appear in `assets/data_model.md` and
      `SCHEMA.md`.
      **Three of §14's nine items are mis-specified and need their wording fixed
      in `assets/data_model.md` (that file is `plan`'s, not the auditor's):**
      · item 4 names `!1485` as "a long comment thread" — it is 6 notes, **all
        system notes, 0 user comments, on the source too**, and the mock
        reproduces all 6 byte-identically. The deepest seeded threads are
        `a11y-syntax-highlighting#1` (21 entries / 13 comments) and
        `a11yproject.com!1270` (21 / 11); §14 should name one of those.
      · item 6 says `/users/byteblaze/starred` must *list* 8 names — those are
        **post-mutation** anchors for webarena-523…527, so a correct seed must
        NOT pre-contain them. Verified the real requirement instead: the top 8 by
        `star_count` are exactly those 8 projects, all 8 star successfully, and
        all 8 names then render (11 rows, `state_diff ["projects","stars"]`).
        §14 should say "after starring the top 8".
      · item 8 expects the literal `Susan Zhang: 70` on the page. The colon is
        **answer formatting** — webarena-317's anchor is a `string_match`
        `must_include` scoped to `(answer)`. The page correctly renders
        `Susan Zhang 70 commits` / `Stephen Roller 51` / `Peter Albert 12`.
- [x] **Seed size is at the top of budget.** — **CLOSED by the overlay refactor.**
      The 12 mutable modules are now the FROZEN corpus (`src/data/frozen.js`),
      merged on read by `src/utils/overlay.js`, and only the delta is persisted.
      Cold state measured off a live `/go`: **2 072 728 B -> 1 473 B**, and the
      two localStorage keys went from 4 137 340 UTF-16 units (78.9 % of Chrome's
      quota, which is why persistence was dying silently on creative tasks) to
      **2 946 units, 0.06 %**. The seed itself did **not** change: no field was
      trimmed and no row sampled, so the unsafe notes trim below was not needed
      and its finding still stands (**36 of the 252 anchor strings occur verbatim
      inside note bodies**, across 33 notes — never sample `notes`). Kept below
      for the measurement history. See `SCHEMA.md` § *Frozen corpus, overlay, and
      static seed* and `DEV.part-state.md`.

      Re-measured round 6 from a live
      `/go`: `JSON.stringify(initial_state)` is **2 076 855 bytes = 1.981 MiB**
      against `WEBARENA_MIGRATION.md §4`'s ~1–2 MB — ~19 KB of headroom, down from
      round 5's ~33 KB. Round 6 added **+2 001 bytes** (1 977 for the four
      container-derived project flags `auto_devops_enabled` / `has_ci_config` /
      `builds_enabled` / `empty_repo`, present only where they deviate from
      GitLab's default, plus the empty `ui.projectSettings` object); the rest of
      the drift from round 5's 2 063 847 predates this round's edits and is not
      attributed. The 2.14 MB figure this item used to quote was a different
      measurement (minified module source) and is superseded. Two shards tried and both
      correctly stopped: the notes trim the audit first proposed is unsafe —
      **36 of the 252 anchor strings occur verbatim inside note bodies**, across 33
      notes. This needs a **serial** seed re-cut (`.claude/agents/dev.md §3` forbids
      regenerating seed data while sharded). Cheapest safe order: drop
      `notes.discussion_id` (92 KB, zero readers), then trim note bodies only for
      noteables that survive an anchor-string containment check. Wire-level gzip
      already took `/go` from 4.47 MB to 1.10 MB, so this is a P2, not a blocker.
      **Round 10 re-measured 2 076 882 bytes — +27 bytes**, from repointing
      `projects[].repo_size` at `project_statistics.storage_size` (TEST.md
      DIFF-907). Round 10's two new seeds, `merge_request_diffs.json` (478 KB)
      and `repo_languages.json` (12 KB), are STATIC modules and never enter
      `state`. `SCHEMA.md`'s stale 1.948 MiB figure was corrected to agree with
      this item.
      **Round 18 re-measured off a live `/go`: 2 072 728 bytes = 1.976 MiB**,
      minified UTF-8, byte-identical to `SCHEMA.md:39`. This is **inside**
      `WEBARENA_MIGRATION.md §4`'s ~1–2 MB, so the item's heading overstates it —
      it is a **headroom watch item (~27 KB to 2 MiB), not a budget breach**. It
      stays `[ ]` so the next round that wants to add a seed field knows the
      margin, and so the safe-trim order above is not lost. `AUDIT.md`'s old
      **P1-6** claimed 2.14 MB and is closed as a measurement error.

---

## Out of Scope

- Login / logout / registration / password reset — the app boots as **byteblaze**
- Real git, Gitaly, SSH, HTTP clone. The `git clone ssh://git@__GITLAB_SSH__/…`
  strings tasks 293–297 read are rendered from project data in the clone dropdown,
  not produced by a server.
- Atom/ICS feeds, archive downloads, `.diff`/`.patch` endpoints
- `/admin/*` (byteblaze is not an admin), `/api/v4/*`
- CI pipelines that actually run, container/package registries, Kubernetes,
  error tracking, feature flags — shells and empty states only
- Any runtime network call. The mock must work fully offline.

---

## Known Gaps / Watch Items

1. **`.visibility-icon` casing.** The source title begins `Private - …` /
   `Public - …`. Tasks 742–745 require the lowercase forms `private` / `public`
   while 746–756 require `Private`. Reproduce the source string exactly; if the
   harness turns out to be case-sensitive, the lowercase tasks cannot pass on the
   real site either. Do not "fix" this by inventing a different title.
2. **List badge counts drift.** `projects.json` carries the *real* source issue/MR
   counts while the seeded rows are a sample. Render tab badges from the seed.
3. **`user_statuses` is empty in the source** — nobody has a status until a task
   sets one. Don't seed one.
4. Byteblaze's `website_url` is empty in the source. Don't seed one.
5. `repo_files.json` holds documentation files for every project but only ~25
   additional source files per `byteblaze/*` repo. A blob view for a path that is
   in `repo_trees.json` but absent from `repo_files.json` should render the source's
   real "file too large / binary" style placeholder rather than an error.
6. **CI/CD data landed in round 12** (`ci_pipelines.json`, TEST.md DIFF-1105) —
   all 1 465 pipelines and 14 179 jobs, on the 67 of 175 projects that have any.
   It is a STATIC module, so it cost the state budget **0 bytes**; the seed-size
   item above is unchanged, and re-measured in round 14 as **2 069 758 UTF-8
   bytes / 1.974 MiB** (the 2 076 882 quoted above and in round 6/10 was measured
   with non-ASCII escaped — see `SCHEMA.md` "Mutable vs static seed"). The 108 projects the
   source shows as empty still render its empty state — do not "fix" those.
7. **Two container-width differences the round-12 layout sweep surfaced, both
   pre-existing and neither in any DIFF.** `/-/blob/:ref/*` and `/-/commits/:ref`
   render at `limit-container-width` (289–1247 at 1280) where the anonymous
   source is 272–1264, because round 8 put `blob` and `commits` in
   `isLimitedProjectView`'s LIMITED set from an authenticated capture; and the
   mock's `/-/issues` has no collapsed bulk-update `.right-sidebar` where the
   source has a 1px sliver. Worth a look next round; measured, not guessed.
