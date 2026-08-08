# gitlab — Route Parity Map

> Source: http://localhost:8023 (GitLab CE 15.7.5, container `gitlab`)
> Discovered by: plan agent, 2026-08-07
> Method: logged-in Playwright crawl as `byteblaze` + href harvest from 68 captured
> DOMs + `config/routes/*.rb` inside the container.
> Anchor coverage: every one of the 145 routes in `assets/task_anchors.md` maps to a
> row below. See `## Anchor Route Coverage`.

**No path prefix.** `external_url` is `http://<host>:8023`, so project paths are
plain: `/byteblaze/dotfiles`, never `/gitlab/byteblaze/dotfiles`.

**The `/-/` infix is load-bearing.** GitLab disambiguates project sub-resources
from repo paths with a literal `-` segment: `/:ns/:proj/-/issues/719`. A handful
of legacy routes sit *outside* it (`/:ns/:proj/edit`, `/:ns/:proj/activity`) —
those are not typos, reproduce them as written.

**`:ref` may contain `/`.** `amwhalen/archive-my-tweets` has a branch called
`github/fork/chtitux/addRssFeed`, and webarena-788 starts on
`/-/tree/github/fork/chtitux/addRssFeed`. Every ref-bearing route is registered
as a bare splat and resolved against the project's real branch/tag list by
`src/components/layout/RefRoute.jsx` (longest matching prefix wins), so the
pages still see a correct `:ref` + path split.

**Trailing slash before query.** Several anchor URLs are written
`/-/issues/?label_name[]=bug` (slash before `?`). GitLab serves both forms. The
mock router MUST accept both `/-/issues?x` and `/-/issues/?x`.

Priority: **P0** = app cannot render/route without it · **P1** = a workflow a
WebArena task targets · **P2** = depth/realism.

---

## 1. Root, Dashboard, Explore

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 1 | `/` | GET | `/` | Dashboard → "Your projects" list. Identical body to row 2. **Anchor route for 168 tasks** (the landing URL). | `projects.json`, `users.json` | P0 | [x] |
| 2 | `/dashboard/projects` | GET | `/dashboard/projects` | Projects Yours/Starred/Explore tabs, sort dropdown, search box, project cards | `projects.json` | P0 | [x] |
| 3 | `/dashboard/projects/starred` | GET | same | Starred-only project list | `projects.json`, `stars.json` | P1 | [x] |
| 4 | `/dashboard/groups` | GET | same | Groups the user belongs to; "New group" button; empty state | `groups.json`, `members.json` | P1 | [x] |
| 5 | `/dashboard/issues` | GET | same | Cross-project issue list, filtered-search token bar | `issues.json`, `projects.json` | P0 | [x] |
| 6 | `/dashboard/merge_requests` | GET | same | Cross-project MR list, filtered-search token bar | `merge_requests.json` | P0 | [x] |
| 7 | `/dashboard/todos` | GET | same | To-Do List; Done/Pending tabs; per-item "Done" button | `todos.json` | P1 | [x] |
| 8 | `/dashboard/todos/:id` | DELETE→POST | `/dashboard/todos/:id` (mark done) | Marks one todo done, re-renders list | `todos.json` | P2 | [x] |
| 9 | `/dashboard/todos/:id/restore` | PATCH | same | Undo a done todo | `todos.json` | P2 | [x] |
| 10 | `/dashboard/todos/destroy_all` | POST | same | "Mark all as done" | `todos.json` | P2 | [x] |
| 11 | `/dashboard/activity` | GET | same | Activity feed; `?filter=starred` | `events.json` | P2 | [x] |
| 12 | `/dashboard/milestones` | GET | same | Cross-project milestone list, Open/Closed tabs | `milestones.json` | P1 | [x] |
| 13 | `/dashboard/snippets` | GET | same | Snippets list — **empty in source** (0 snippet rows). Render the real empty state. | — | P2 | [x] |
| 14 | `/explore` | GET | `/explore` | Explore projects (same body as `/explore/projects`). **Anchor (webarena-258).** | `projects.json` | P0 | [x] |
| 15 | `/explore/projects` | GET | same | All visible projects, paginated 20/page | `projects.json` | P0 | [x] |
| 16 | `/explore/projects/trending` | GET | same | Trending tab | `projects.json` | P1 | [x] |
| 17 | `/explore/projects/starred` | GET | same | Most-starred tab | `projects.json` | P1 | [x] |
| 18 | `/explore/projects/topics` | GET | same | Topics list (empty in source) | — | P2 | [x] |
| 19 | `/explore/groups` | GET | same | Public group list | `groups.json` | P1 | [x] |
| 20 | `/explore/snippets` | GET | same | Public snippets (empty) | — | P2 | [x] |

## 2. Search

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 21 | `/search` | GET | `/search` | Search landing: "What are you searching for?" + group/project scope pickers | — | P1 | [x] |
| 22 | `/search?search=<q>&scope=projects` | GET | same | Result page, scope tabs: Projects / Issues / Merge requests / Milestones / Users / Comments / Wiki, each with a count badge | all seeds | P1 | [x] |
| 23 | `/search?project_id=<id>&search=<q>` | GET | same | Search scoped to one project (this is what the in-project search box emits) | all seeds | P1 | [x] |
| 24 | `/search/opensearch.xml` | GET | — | **Not migrated** (browser plumbing) | — | — | — |

## 3. User profile

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 25 | `/:username` | GET | `/:username` | Profile: header (avatar, name, `@handle`, status, "Member since …", bio, location, org, `[itemprop="url"]` website) + tab strip; body = Activity. **Anchor `/byteblaze` (10 tasks).** Locator `.profile-header [itemprop="url"]`, `.cover-status`, `.user-profile`. | `users.json` | P0 | [x] |
| 26 | `/users/:username/activity` | GET | same | Activity tab | `events.json` | P1 | [x] |
| 27 | `/users/:username/groups` | GET | same | Groups tab | `groups.json` | P1 | [x] |
| 28 | `/users/:username/contributed` | GET | same | Contributed projects tab | `projects.json` | P1 | [x] |
| 29 | `/users/:username/projects` | GET | same | Personal projects tab | `projects.json` | P1 | [x] |
| 30 | `/users/:username/starred` | GET | same | Starred projects tab. **Anchor (webarena-523…527).** | `stars.json` | P0 | [x] |
| 31 | `/users/:username/snippets` | GET | same | Snippets tab (empty) | — | P2 | [x] |
| 32 | `/users/:username/followers` | GET | same | Followers tab, `.user-profile` grid of user cards | `follows.json` | P1 | [x] |
| 33 | `/users/:username/following` | GET | same | Following tab. **Anchor (webarena-533…537).** Locator `.user-profile`. | `follows.json` | P0 | [x] |
| 34 | `/:username.atom?feed_token=` | GET | — | **Not migrated** (Atom feed) | — | — | — |

## 4. User settings (`/-/profile`)

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 35 | `/-/profile` | GET/PUT | `/-/profile` | Edit profile: avatar upload, Name, User ID, Email, Public email, Job title, Pronouns, Pronunciation, Bio, Time settings, Main settings (Location, Organization, Website URL, Twitter, LinkedIn, Skype, Discord), "Update profile settings" button. **Tasks 448–452 edit the website URL here and read it back at `/byteblaze`.** | `users.json` | P0 | [x] |
| 36 | `/-/profile` (status modal) | PUT | `/-/profile` `?…` | "Set status" modal: emoji picker, "What's your status?" text, "Busy" checkbox, clear-after dropdown. **Tasks 418–422 set the status string, read back via `.cover-status`.** | `users.json` | P0 | [x] |
| 37 | `/-/profile/account` | GET | same | Account: change username, delete account, feed token | `users.json` | P1 | [x] |
| 38 | `/-/profile/preferences` | GET/PUT | same | Preferences: color theme, syntax theme, behavior, localization, time preferences | `preferences` in state | P1 | [x] |
| 39 | `/-/profile/notifications` | GET | same | Notification settings | static | P2 | [x] |
| 40 | `/-/profile/keys` | GET | same | SSH keys (empty) | — | P2 | [x] |
| 41 | `/-/profile/emails` | GET | same | Emails | `users.json` | P2 | [x] |
| 42 | `/-/profile/password/edit` | GET | — | **Not migrated** (auth) | — | — | — |
| 43 | `/-/profile/personal_access_tokens`, `/gpg_keys`, `/chat_names`, `/active_sessions`, `/applications`, `/audit_log` | GET | same | Render the page shell + real empty state; no functionality | — | P2 | [x] |

## 5. Project — overview & repository

`:ns` = namespace path (user or group), `:proj` = project path.

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 44 | `/:ns/:proj` | GET | `/:ns/:proj` | Project overview: header (avatar, name, visibility icon, "Project ID: N" + copy, Star/Fork/Notification buttons with counts), clone dropdown, stats row (Commits/Branches/Tags/Project Storage), repository-languages bar, CTA chips (README, detected licence name, CHANGELOG, CONTRIBUTING), file browser, README render, right info panel. **Anchor for ~30 tasks.** Locators `.home-panel-description-markdown`, `.visibility-icon[title]`. | `projects.json`, `repo_trees.json`, `repo_languages.json` | P0 | [x] |
| 45 | `/:ns/:proj/-/tree/:ref` | GET | same | File tree at ref root. **Anchor `/byteblaze/dotfiles/-/tree/main`.** | `repo_trees.json` | P0 | [x] |
| 46 | `/:ns/:proj/-/tree/:ref/*path` | GET | same | File tree in a sub-directory; breadcrumb | `repo_trees.json` | P0 | [x] |
| 47 | `/:ns/:proj/-/blob/:ref/*path` | GET | same | Blob view: breadcrumb, ref switcher, Edit / Web IDE / Replace / Delete / Raw / Blame / History / Permalink, line-numbered content. **Anchors: `…/-/blob/main/LICENSE` on 4 projects.** | `repo_files.json` | P0 | [x] |
| 48 | `/:ns/:proj/-/raw/:ref/*path` | GET | same | Plain-text file body, `Content-Type: text/plain`, **no GitLab chrome**. **Anchor for 15 tasks** (all the `README.md` / `urls.txt` / `index.html` content checks). Must render as bare text, not inside the SPA shell. | `repo_files.json` | P0 | [x] |
| 49 | `/:ns/:proj/-/blame/:ref/*path` | GET | same | Blame view | `repo_files.json` | P2 | [x] |
| 50 | `/:ns/:proj/-/commits/:ref` | GET | same | Commit list grouped by date. **Anchors: `/byteblaze/{awesome_web_agents,project_site,web_agent,web_agent_android_xl,web_agent_android_xs,web_agent_nodejs}/-/commits`** (note: no `:ref` — GitLab redirects to the default branch). | `commits.json` | P0 | [x] |
| 51 | `/:ns/:proj/-/commits` | GET | redirect → `/-/commits/:default_branch` | Bare form must resolve — six anchors use it | `projects.json` | P0 | [x] |
| 52 | `/:ns/:proj/-/commit/:sha` | GET | same | Single-commit page: message, author, diff stat | `commits.json` | P1 | [x] |
| 53 | `/:ns/:proj/-/branches` | GET | same | Branch list; `?state=active\|stale\|all` sub-paths `/active`, `/stale`, `/all` | `branches.json` | P1 | [x] |
| 54 | `/:ns/:proj/-/branches/new` | GET/POST | same | New branch form | `branches.json` | P2 | [x] |
| 55 | `/:ns/:proj/-/tags` | GET | same | Tag list + empty state | `tags.json` | P2 | [x] |
| 56 | `/:ns/:proj/-/tags/new` | GET/POST | same | New tag form | `tags.json` | P2 | [x] |
| 57 | `/:ns/:proj/-/graphs/:ref` | GET | same | **Contributors** graph: per-author commit counts. **Anchor `/dehenne/awesome-visibility/-/graphs/master` (webarena-787)** — note the ref is `master`, not `main`. | `commits.json` | P1 | [x] |
| 58 | `/:ns/:proj/-/graphs/:ref/charts` | GET | same | Repository analytics charts | `commits.json` | P2 | [x] |
| 59 | `/:ns/:proj/-/network/:ref` | GET | same | Commit graph canvas | `commits.json` | P2 | [x] |
| 60 | `/:ns/:proj/-/find_file/:ref` | GET | same | Fuzzy file finder | `repo_trees.json` | P2 | [x] |
| 61 | `/:ns/:proj/-/compare?from=&to=` | GET | same | Compare-refs form + diff | `branches.json` | P2 | [x] |
| 62 | `/:ns/:proj/-/new/:ref` | GET/POST | same | **New file** form: file-name input, branch input, commit message, editor, "Commit changes". Also `?file_name=LICENSE&commit_message=Add+LICENSE`. **P0 — 20+ creation tasks route through here.** | `repo_files.json` | P0 | [x] |
| 63 | `/:ns/:proj/-/edit/:ref/*path` | GET/POST | same | Edit an existing file | `repo_files.json` | P0 | [x] |
| 64 | `/:ns/:proj/-/starrers` | GET | same | "Starrers" list, Explore/Search tabs | `stars.json` | P1 | [x] |
| 65 | `/:ns/:proj/-/forks` | GET | same | Fork list (`?sort=`) | `projects.json` | P1 | [x] |
| 66 | `/:ns/:proj/-/forks/new` | GET/POST | same | **Fork project** — choose namespace. Tasks 394–398 fork upstream repos into `byteblaze/`. | `projects.json` | P0 | [x] |
| 67 | `/:ns/:proj/activity` | GET | same | Project activity feed (**no `/-/`**) — source has zero `events` rows for these projects, so `No activities found` with the 8 filter tabs | `events.json` | P2 | [x] |
| 68 | `/:ns/:proj/-/archive/:ref/<name>.{zip,tar,tar.gz,tar.bz2}` | GET | — | **Not migrated** (binary download) | — | — | — |

## 6. Project — issues

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 69 | `/:ns/:proj/-/issues` | GET | same (also accept `/-/issues/`) | Issue list: Open/Closed/All tabs with counts, filtered-search bar, sort dropdown, "New issue" button, bulk edit, pagination. **Anchor for 10 tasks.** | `issues.json` | P0 | [x] |
| 70 | `/:ns/:proj/-/issues/:iid` | GET | same | Issue detail. **Anchors: a11yproject 719/566/1517, empathy-prompts 8/18, a11y-syntax-highlighting 1, a11y-webring.club 71.** Locators `[data-qa-selector="title_content"]`, `.detail-page-description`, `.block.assignee`, `[data-testid="sidebar-due-date"]`, `#notes-list`. | `issues.json`, `notes.json` | P0 | [x] |
| 71 | `/:ns/:proj/-/issues/new` | GET/POST | same | New issue form: Title, Type, Description (+markdown toolbar & Write/Preview tabs), Assignee, Milestone, Labels, Due date, Confidential checkbox, "Create issue" / "Cancel". | `issues.json` | P0 | [x] |
| 72 | `/:ns/:proj/-/issues/new?add_related_issue=:iid` | GET | same | Prefills "relates to #N" | `issues.json` | P2 | [x] |
| 73 | `/:ns/:proj/-/issues/:iid/edit` | GET/PUT | same | Edit issue title/description | `issues.json` | P1 | [x] |
| 74 | `/:ns/:proj/-/issues/service_desk` | GET | same | Service Desk tab (empty state) | — | P2 | [x] |
| 75 | `/:ns/:proj/-/boards` | GET | same | Issue board (Open / Closed lists) | `issues.json` | P2 | [x] |
| 76 | `/:ns/:proj/-/incidents`, `/-/alert_management` | GET | same | Empty-state pages, copy verbatim from the source | — | P2 | [x] |
| 77 | `/:ns/:proj/-/issues.atom`, `.ics` | GET | — | **Not migrated** (feeds) | — | — | — |

## 7. Project — merge requests

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 78 | `/:ns/:proj/-/merge_requests` | GET | same | MR list, same anatomy as issues + source/target branch. **Anchors on a11yproject, primer/design.** | `merge_requests.json` | P0 | [x] |
| 79 | `/:ns/:proj/-/merge_requests/:iid` | GET | same | MR detail (Overview tab). **Anchors: a11yproject 1071/1265/1270/1485/1531, primer/design 450, empathy-prompts 19, a11y-webring.club 40.** Locators `.block.reviewer`, `.detail-page-description > a.gl-font-monospace` (idx 0 = source branch, idx 1 = target branch), `#notes-list`. | `merge_requests.json`, `notes.json` | P0 | [x] |
| 80 | `/:ns/:proj/-/merge_requests/:iid/commits` | GET | same | Commits tab — the MR's OWN commits (source branch minus target), day-grouped, with the `Commits` badge | `merge_request_diffs.json` | P1 | [x] |
| 81 | `/:ns/:proj/-/merge_requests/:iid/diffs` | GET | same | Changes tab. Renders the source's `Changes` badge (`files_count`) and names the two branches; the line-by-line diff bodies are **not** carried — they are ~19 MB in `merge_request_diff_files` for the seeded MRs. No task reads them (TEST.md DIFF-904). | `merge_request_diffs.json` (counts only) | P2 | [~] |
| 82 | `/:ns/:proj/-/merge_requests/:iid/pipelines` | GET | same | Pipelines tab — the MR's own pipeline row where it has one (112 of 729 MRs do), otherwise `There are currently no pipelines.` | `merge_request_diffs.json` | P2 | [x] |
| 83 | `/:ns/:proj/-/merge_requests/:iid/edit` | GET/PUT | same | Edit MR — title, description, assignee, **reviewer**, labels, milestone | `merge_requests.json` | P0 | [x] |
| 84 | `/:ns/:proj/-/merge_requests/new` | GET/POST | same | New MR: source/target branch pickers → detail form | `merge_requests.json` | P1 | [x] |
| 85 | `/:ns/:proj/-/merge_requests/:iid.diff`, `.patch` | GET | — | **Not migrated** (raw diff download) | — | — | — |
| 86 | `/:ns/:proj/-/merge_requests/:iid/conflicts` | GET | same | Conflict resolution UI | `merge_requests.json` | P2 | [x] |

## 8. Project — labels, milestones, members

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 87 | `/:ns/:proj/-/labels` | GET | same | Label list, `?subscribed=true`, "New label" | `labels.json` | P1 | [x] |
| 88 | `/:ns/:proj/-/labels/new` | GET/POST | same | New label: Title, Description, Background color (swatch picker + hex input) | `labels.json` | P1 | [x] |
| 89 | `/:ns/:proj/-/labels/:id/edit` | GET/PUT | same | Edit label | `labels.json` | P1 | [x] |
| 90 | `/:ns/:proj/-/milestones` | GET | same | Milestone list, Open/Closed tabs. **Anchors: `/byteblaze/dotfiles/-/milestones`, `/primer/design/-/milestones`.** | `milestones.json` | P0 | [x] |
| 91 | `/:ns/:proj/-/milestones/new` | GET/POST | same | New milestone: Title, Description, **Start date**, **Due date**. Tasks 590–594 create milestones and the evaluator reads `#content-body`, `.block.start_date`, `.block.due_date`. | `milestones.json` | P0 | [x] |
| 92 | `/:ns/:proj/-/milestones/:iid` | GET | same | Milestone detail: `#content-body`, Issues/Merge requests tabs, `.block.start_date`, `.block.due_date` | `milestones.json`, `issues.json` | P0 | [x] |
| 93 | `/:ns/:proj/-/milestones/:iid/edit` | GET/PUT | same | Edit milestone | `milestones.json` | P1 | [x] |
| 94 | `/:ns/:proj/-/project_members` | GET | same | Members table + "Invite members" modal. **Anchor for 20 tasks.** Evaluator helper `gitlab_get_project_memeber_role(page, '<username>')` reads the row's Max-role cell. | `members.json` | P0 | [x] |
| 95 | `/:ns/:proj/-/project_members` (invite modal) | POST | same | Add a member by username + role → new table row. **P0 — tasks 481–485, 567–579, 742–751 all do this.** | `members.json` | P0 | [x] |
| 96 | `/:ns/:proj/-/project_members/leave` | DELETE | same | Leave project. Rendered as the `Leave project` link in `.home-panel-metadata` on the project overview, gated exactly as `shared/members/_access_request_links.html.haml` gates it (direct member, and not the holder of the project's personal namespace). A bare GET 404s, as on the source. | `members.json` | P2 | [x] |
| 97 | `/:ns/:proj/-/project_members/request_access` | POST | same | Request access — the `Request Access` link on the overview of projects you are not a member of (`/root/metaseq`, `/vinta/awesome-python`, `/CellularPrivacy/Android-IMSI-Catcher-Detector`). Writes a `members` row carrying `requested_at`, which the Members tab excludes; the link then reads `Withdraw Access Request`. | `members.json` | P2 | [x] |

## 9. Project — settings

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 98 | `/:ns/:proj/edit` | GET/PUT | same (**no `/-/`**) | General settings: Naming/topics/avatar (Project name, Project ID, Project description, Topics, avatar), Visibility & access, Badges, Advanced (rename, transfer, archive, delete) | `projects.json` | P1 | [x] |
| 99 | `/:ns/:proj/-/settings/repository` | GET | same | Branch defaults, mirroring, protected branches, protected tags, deploy tokens, deploy keys, repository cleanup — the source's seven collapsed `section.settings` blocks with its own ids. All seven forms mutate `ui.projectSettings`. | `projects.json`, `branches.json`, `tags.json` | P1 | [x] |
| 100 | `/:ns/:proj/-/settings/merge_requests` | GET | same | Merge method, merge options, squash, merge checks, merge/squash commit templates. Single `expanded` section, as on the source. | `projects.json` | P2 | [x] |
| 101 | `/:ns/:proj/-/settings/ci_cd` | GET | same | General pipelines + the three badge panels, Auto DevOps, Runners, Artifacts, Variables, Pipeline triggers, Deploy freezes, Token Access, Secure Files. Host-shaped strings derive from `window.location`. | — | P2 | [x] |
| 102 | `/:ns/:proj/-/settings/integrations` | GET | same | Active-integrations empty table + the source's 37 inactive integrations in its order, each linking to `…/integrations/:slug/edit`. **That edit page is not migrated** — it is a Vue app whose rendered DOM cannot be recovered from a static capture. | — | P2 | [x] |
| 103 | `/:ns/:proj/-/settings/{access_tokens,operations,packages_and_registries}` | GET | same | Access tokens (create form + `This project has no active access tokens.`); Monitor (Metrics, Error tracking, Alerts, Incidents, Grafana); Packages (always-visible two-column duplicate-assets form). | — | P2 | [x] |
| 104 | `/:ns/:proj/-/hooks` | GET | same | Webhook form with the source's 13 trigger checkboxes, URL masking radios and SSL verification; `Project Hooks (0)` / `No webhooks enabled. Select trigger events above.` until one is added. | — | P2 | [x] |
| 105 | `/:ns/:proj/-/usage_quotas` | GET | same | The source's `Repository usage recalculation started` alert, the per-project blurb and the `Storage` tab. | — | P2 | [x] |

## 10. Project — CI/CD, analytics, other sidebar leaves

Most render an empty state in the source. **The CI/CD rows are the exception**
— see the correction on row 106 below. Reproduce the shell + empty copy so the
left sidebar has no dead links.

| # | Source path | Priority | Status |
|---|---|---|---|
| 106 | `/:ns/:proj/-/pipelines` (+ `/:id`, `/charts`) | P2 | [x] — **populated on the 67 projects that have pipelines, empty on the other 108.** The source has 1 465 pipelines across 67 of the 175 seeded projects; the list paginates at 15/page with GitLab's numbered pager, `/-/pipelines/:id` returns **200** for a pipeline belonging to that project (404 otherwise, as the source does), and CI/CD Analytics computes `Success ratio` from the real rows — `0.00%` wherever a project has pipelines (all of them failed), `100.00%` only where it has none. Backed by the static `src/data/ci_pipelines.json`. |
| 107 | `/:ns/:proj/-/jobs` (+ `/:id`) | P2 | [x] — 14 179 real jobs; 30 rows per screen with the source's infinite scroll and its `1,000+` count cap; `/-/jobs/:id` renders the job page the list and the pipeline graph link to |
| 107a | `/:ns/:proj/-/ci/lint` | P2 | [ ] — the `CI lint` button in the pipelines nav-controls points here (the source's own href); the page itself is not implemented |
| 107b | `/:ns/:proj/-/pipelines/new` | P2 | [ ] — likewise for `Run pipeline` |
| 108 | `/:ns/:proj/-/pipeline_schedules` | P2 | [x] |
| 109 | `/:ns/:proj/-/ci/editor?branch_name=:ref` | P2 | [x] |
| 110 | `/:ns/:proj/-/environments` | P2 | [x] |
| 111 | `/:ns/:proj/-/releases` | P2 | [x] |
| 112 | `/:ns/:proj/-/packages`, `/-/infrastructure_registry` | P2 | [x] |
| 113 | `/:ns/:proj/-/value_stream_analytics` | P2 | [x] — filtered-search bar, date range, the 6-stage path nav, Key metrics / DORA metrics and `We don't have enough data to show this stage.` |

> **Correction (round 12, TEST.md DIFF-1105).** Row 106 previously read
> *"list + CI/CD Analytics render the source's zero-pipeline state; `/:id` 404s
> as the source does"*. That was the **opposite** of the source's behaviour and
> came from generalising a single capture: every round-4 CI/CD capture in
> `assets/html/` was taken against `byteblaze/dotfiles`, which is one of the 108
> seeded projects that genuinely have no pipelines. 67 projects do have them,
> and the source returns 200 for all 1 465 pipeline ids. See DEV.r12-cicd.md.
| 114 | `/:ns/:proj/-/graphs/:ref/charts` (duplicate of row 58) | P2 | [x] |
| 115 | `/:ns/:proj/-/security/configuration` | P2 | [x] — Auto DevOps banner, the Ultimate upsell, the three tabs and all 10 scanner cards with their real status badges |
| 116 | `/:ns/:proj/-/snippets`, `/-/snippets/new` | P2 | [x] — `/-/snippets/new` now renders `NewSnippet` (was pointed at `<Placeholder>` while the component existed) |
| 117 | `/:ns/:proj/-/wikis/home` | P2 | [x] — no project on this instance has a wiki, so the source's empty state is the whole view |
| 118 | `/:ns/:proj/-/clusters`, `/-/terraform`, `/-/google_cloud/configuration`, `/-/feature_flags`, `/-/error_tracking`, `/-/metrics`, `/-/monitor` | P2 | [x] — `/-/monitor` 404s and `/-/google_cloud/configuration` renders the 500 page, matching the source's own status codes |

## 11. Groups

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 119 | `/groups/new` | GET/POST | same | New group form: Group name, Group URL (slug, auto-derived), Visibility (Private/Internal/Public), role/purpose selects, "Create group". **P0 — tasks 799–803 create the 5 anchor groups.** | `groups.json` | P0 | [x] |
| 120 | `/:group` | GET | `/:group` | Group overview: subgroup + project list, tabs | `groups.json`, `projects.json` | P1 | [x] |
| 121 | `/groups/:group/-/group_members` | GET/POST | same | Group members table + Invite modal. **Anchors: `/groups/{coding_friends,crew,n-lab,webagent,x-lab}/-/group_members` — none of these groups exist in the source; the tasks create them.** | `members.json` | P0 | [x] |
| 122 | `/groups/:group/-/issues`, `/-/merge_requests`, `/-/milestones`, `/-/labels` | GET | same | Group-scoped rollups | `issues.json` etc | P2 | [x] |
| 123 | `/groups/:group/edit` | GET/PUT | same | Group settings | `groups.json` | P2 | [x] |

## 12. Creation entry points

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 124 | `/projects/new` | GET | `/projects/new` | **Three** options on this build: **Create blank project**, **Create from template**, **Import project** | — | P0 | [x] |
| 125 | `/projects/new#blank_project` | GET/POST | same | Blank-project form: Project name, Project URL (namespace dropdown + slug), Project slug, Visibility Level radios (Private/Internal/Public), Project Configuration ("Initialize repository with a README", "Enable Static Application Security Testing (SAST)"), "Create project". **No description field.** **P0 — 20+ tasks create a project here.** | `projects.json` | P0 | [x] |
| 126 | `/projects/new#create_from_template` | GET/POST | same | Template gallery. **Anchors need these templates: "Pages/Jekyll", "Pages/Plain HTML", "Android", "NodeJS Express"** — tasks 748–756 assert on their seeded first-commit messages and README text. | `templates.json` | P0 | [x] |
| 127 | `/projects/new#import_project` | GET | same | Import source tiles (GitHub, Bitbucket, Repo by URL, …) | — | P2 | [x] |
| 127b | `/search` scopes | GET | same | This build exposes **5** scopes rendered as a 240px vertical pill list in a left sidebar, not a tab strip — see `assets/README.md §23` | all seeds | P1 | [x] |
| 128 | `/-/snippets/new` | GET/POST | same | New snippet form | — | P2 | [x] |
| 129 | `/-/ide/project/:ns/:proj/edit/:ref/-/` | GET | same | Web IDE — render a plausible editor shell; not required by any anchor | `repo_files.json` | P2 | [x] |

## 13. Help

| # | Source path | Mock route | Renders | Priority | Status |
|---|---|---|---|---|---|
| 130 | `/help` | `/help` | Help landing page. Deep `/help/user/...` links are pervasive in the chrome. | P2 | [x] |
| 131 | `/help/*` | `/help/*` | Catch-all: render a "Documentation" stub page rather than a 404, so no chrome link is dead. | P2 | [x] |

---

## Query Parameters

### Issue / MR lists (project scope and `/dashboard/*`)

| Param | Values | Effect |
|---|---|---|
| `state` | `opened` \| `closed` \| `all` | Tab selection. Default `opened`. |
| `scope` | `all` \| `assigned_to_me` \| `created_by_me` | Dashboard-only. `/dashboard/issues?scope=all` is the anchor form. |
| `sort` | `created_date` (= newest first), `created_asc`, `updated_desc`, `updated_asc`, `milestone_due_desc`, `milestone_due_asc`, `due_date_desc`, `due_date_asc`, `priority`, `label_priority`, `popularity`, `title_asc`, `title_desc`, `relative_position` | Reorders. Default `created_date`. Anchors use `created_date`, `created_asc`, `updated_desc`. |
| `label_name[]` | label title, URL-encoded, repeatable | AND filter. Anchor examples: `bug`, `help wanted`, `question`, `enhancement`, `flaky-test`, `OpenAPI Generator CLI`, `type: bug 🐞`. **`label_name[]=None` (webarena-343) means "no label".** |
| `not[label_name][]` | label title | NOT filter. Anchor: `/umano/AndroidSlidingUpPanel/-/issues/?state=opened&not[label_name][]=BUG` (webarena-106). |
| `milestone_title` | milestone title | Filter by milestone. |
| `assignee_username` | username | Anchors: `byteblaze`, `Roshanjossey`, `Seirdy`, `primer`. |
| `reviewer_username` | username | MR-only. Anchor: `byteblaze`. |
| `author_username` | username | Filter by author. |
| `search` | free text | Text search over title+description. Anchor: `search=OPT model`. |
| `first_page_size` | integer | Page size (GraphQL-paged lists). Anchors use `20`. |
| `page` | integer | Offset pagination on non-GraphQL lists. |
| `confidential` | `yes` \| `no` | Confidentiality filter. |
| `my_reaction_emoji` | emoji name | Reaction filter. |

Encoded forms seen in anchors — the router must decode these:
`label_name%5B%5D=` → `label_name[]=`, `not%5Blabel_name%5D%5B%5D=` →
`not[label_name][]=`, `%20` → space, `%F0%9F%90%9E` → `🐞`, `%3A` → `:`.

#### The emitted URL form is part of the contract — TEST.md DIFF-1303

Accepting these params is not enough. Twelve `url_match` tasks (webarena-45, 46,
102, 103, 104, 105, 106, 339, 340, 341, 342, 343) are graded on the URL the agent
**ends on**, and their anchors are written in one specific form:

```
/a11yproject/a11yproject.com/-/issues/?label_name%5B%5D=help%20wanted
                                    ^ trailing slash        ^ %20, not +
```

`URLEvaluator` compares base paths with `ref_base_path in pred_base_path`, a
substring test, so `…/-/issues/` is **not** satisfied by `…/-/issues`. Every
filter, sort, search and pagination control on a project-scoped issue or MR list
therefore emits `…/-/issues/?…` and `…/-/merge_requests/?…`, escaped with
`encodeURIComponent` on both key and value, in the order
`search`, `sort`, `state`, filters, page params — built by
`src/utils/issuableUrl.js`, which is the only place this form is constructed.
`/dashboard/issues` and `/dashboard/merge_requests` take **no** trailing slash
(webarena-156 and -357 anchor without it).

Arriving with the anchor URL must also **preserve** it byte-for-byte: nothing
normalises the query on load, and the global link interceptor in `src/App.jsx`
appends `sid=` as text rather than rebuilding the query through
`URLSearchParams` (which would turn `%20` into `+`). Do not "tidy" either half.

### Project / group lists

| Route | Param | Values | Effect |
|---|---|---|---|
| `/`, `/dashboard/projects`, `/dashboard/projects/starred`, `/explore*` | `sort` | `latest_activity_desc` (default), `latest_activity_asc`, `name_asc`, `name_desc`, `created_desc`, `created_asc`, `stars_desc` | Reorders the card list |
| same | `archived` | `only` | Archived only. GitLab's `ProjectsFinder` treats `archived=false` as non-archived and **anything else, `true` included, as all projects**; the mock implements exactly that (`src/components/ui/ProjectsNav.jsx`). TEST DIFF-007. |
| same | `personal` | `true` | Personal namespaces only |
| same | `non_archived` | `true` | Hide archived (used together with `page`) |
| same | `page` | integer | 20 cards/page |
| same | `name` | free text | The "Filter by name" box |
| `/dashboard/activity` | `filter` | `starred` | Restrict feed to starred projects |
| `/dashboard/todos` | `state` | `pending` \| `done` | Tab |
| `/dashboard/todos` | `sort` | `created_desc`, `created_asc`, `label_priority` | Reorders |
| `/dashboard/milestones` | `state` | `opened` \| `closed` | Tab |
| `/:ns/:proj/-/branches` | `state` | `active` \| `stale` \| `all` | Also exposed as path segments `/active`, `/stale`, `/all` |
| `/:ns/:proj/-/labels` | `subscribed` | `true` | Subscribed labels only |
| `/:ns/:proj/-/forks` | `sort` | `created_asc`, `created_desc`, … | Reorders |

### Search

| Param | Values | Effect |
|---|---|---|
| `search` | free text | The query |
| `scope` | `projects` \| `issues` \| `merge_requests` \| `milestones` \| `users` \| `notes` \| `blobs` \| `wiki_blobs` \| `commits` | Result tab |
| `project_id` | project id | Scope to one project (emitted by the in-project search box) |
| `group_id` | group id | Scope to one group |

### New file / new issue prefill

| Route | Param | Effect |
|---|---|---|
| `/:ns/:proj/-/new/:ref` | `file_name` | Prefills the file-name input |
| `/:ns/:proj/-/new/:ref` | `commit_message` | Prefills the commit message |
| `/:ns/:proj/-/issues/new` | `add_related_issue` | Prefills a "relates to #N" |
| `/:ns/:proj/-/issues/new` | `issuable_template`, `issue[issue_type]` | Incident template |
| `/:ns/:proj/-/merge_requests/new` | `merge_request[source_branch]` | Preselects the source branch |

### Session id

`?sid=<id>` is additive on every route and never replaces a source param.
`/-/issues?label_name[]=bug&sid=task_1` must behave exactly like the source URL.

---

## Intentionally Not Migrated

| Source path | Reason |
|---|---|
| `/users/sign_in`, `/users/sign_up`, `/users/sign_out`, `/users/password/*` | Mock boots pre-logged-in as `byteblaze` (migration contract) |
| `/-/profile/password/edit` | Auth |
| `*.atom`, `*.ics`, `?format=atom`, `?feed_token=` | Feed endpoints; no HTML surface. **But the feed token string `TMN_bBn9Z48qVbUFZV45` must still be visible in the DOM** — it is an `exact_match` anchor (webarena-259). It is rendered on `/-/profile/personal_access_tokens` (masked in the input, real value in the DOM — where the source puts it, see BUG-A10) and inside the feed hrefs, **not** on `/-/profile/account`. TEST DIFF-007. |
| `/:ns/:proj/-/archive/:ref/*.{zip,tar,tar.gz,tar.bz2}` | Binary download |
| `/:ns/:proj/-/merge_requests/:iid.diff`, `.patch` | Raw download |
| `/:ns/:proj/export`, `/archive`, `/housekeeping` | Server-side maintenance |
| `/admin/*` | `byteblaze` is not an admin; the source hides it |
| `/api/v4/*` | No server in the mock |
| `/search/opensearch.xml`, `/-/manifest.json`, `/favicon*`, `/apple-touch-icon.png` | Browser plumbing |
| `/-/abuse_reports/new` | Moderation, unreachable outcome |
| `/-/ide/*` beyond a static shell | Full Web IDE is out of scope |
| Real git over HTTP/SSH | No git in the mock; `git clone ssh://git@__GITLAB_SSH__/…` strings are rendered from data, not produced by a server |
| `/:ns/:proj/-/settings/integrations/:slug/edit` (37 slugs, linked from row 102) | **Not intentional — undetermined.** The per-integration edit page is a Vue app (`js-vue-integration-settings`) whose DOM exists only after its bundle runs, so it cannot be recovered from the static captures in `assets/html/`, and the only logged-in capture we hold is the index. Inventing the form would be a parity break. The index links carry the source's own hrefs; a click currently reaches `NotFound`. Re-capture this page logged-in with a browser before implementing it. |

---

## Status Summary — measured, not asserted (round 6 dev, 2026-08-07)

Every numbered row below was given **one concrete probe URL**, cold-loaded in a
**fresh browser context** with a per-row `?sid=`, and classified by what actually
rendered. Nothing here is inferred from the route table.

**Counts re-derived by parsing this file's own table in round 18** — the previous
block said `132 / 126`, which predated rows 107a, 107b and 127b.

| | Rows |
|---|---|
| Numbered rows in this file | **134** (131 numbered + `107a`, `107b`, `127b`) |
| `[x]` — renders a real view | **125** |
| `[ ]` — renders a placeholder | **0** — the `<Placeholder>` component was deleted in round 4; rows 99–105, 113 and 115 are implemented and rows 96/97 are rendered as the overview's `Leave project` / `Request Access` affordances. Round 18 re-confirmed: `grep -c Placeholder src/App.jsx` → **0**, `Placeholder.jsx` no longer exists, and the literal *"has not been implemented yet"* appears nowhere in `dist/` |
| `[ ]` — genuinely unimplemented | **2** — `107a` `/-/ci/lint` and `107b` `/-/pipelines/new`. Round 18 cold-loaded both: each renders `404 Page Not Found` inside the real project chrome. Honest markers, not false completions |
| `[~]` — renders, materially thinner than the source | **1** — row `81` `/-/merge_requests/:iid/diffs`. Renders the Changes view; the line-by-line diff bodies are not carried (~19 MB in `merge_request_diff_files` for the seeded MRs, no task reads them) |
| `—` — declared not migrated | **6** (24, 34, 42, 68, 77, 85) |
| **False completions** (`[x]` that renders a placeholder / 404 / blank) | **0** |
| `?sid=` lost on cold load | **0 / 134** |
| Console errors or pageerrors on cold load | **0 / 134** |

Independently, `assets/route_smoke.py` cold-loads **201 routes** (all 145 anchor
routes from `assets/task_anchors.json` + 56 shells reached by clicking), each with
a fresh `?sid=`, and asserts the 7 case-insensitive canonical redirects. Result at
audit time: **201/201 clean, 0 console errors, 0 pageerrors, 7/7 redirects**.

**Corrections applied this round:**

- Row **72** (`?add_related_issue=`) `[ ]` → **`[x]`**. It renders a real New Issue
  form and the param is honoured — `src/pages/NewIssue.jsx:27` reads it and seeds
  the description with `relates to #N`. The link that produces the URL now exists
  in the issue-detail `Issue actions` dropdown. Verified by cold load.
- Rows **81**, **82**, **114** were corrected `[ ]` → `[x]` in the previous round
  and re-verified here; all three render real views.

**Rows that are `[x]` and correct but materially thinner than the source** — not
false completions, but do not read them as finished:

- Row **98** `/:ns/:proj/edit` — General settings renders and its controls persist
  (the 17 feature-permission selects now write `project.feature_settings`), but it
  carries ~25 of the source's ~130 structural copy lines. Missing: Badges,
  Advanced (rename / transfer / archive / delete), per-level visibility copy.
- Row **129** Web IDE — a working editor shell (create + commit verified), not a
  real IDE. Declared out of scope in `## Out of Scope`.
- ~~Row **116** `/-/snippets/new` is `[ ]` and points at `<Placeholder>`~~ —
  **STALE, corrected round 18.** The repoint landed; the row is `[x]` and true.
  Cold-loaded both scopes: `/-/snippets/new` and
  `/byteblaze/dotfiles/-/snippets/new` each render the real
  `New Snippet · Title · Description (optional) · Visibility level ·
  Private/Internal/Public · Create snippet · Cancel` form, 0 pageerrors.

---

## Anchor Route Coverage

All 145 anchor routes in `assets/task_anchors.md` are covered by the rows above.
They fall into three groups:

**A. Routes whose record exists in the source today** — must be seeded.
`/`, `/explore`, `/byteblaze`, `/users/byteblaze/{following,starred}`,
`/dashboard/{projects,todos,issues?…,merge_requests?…}`,
`/a11yproject/a11yproject.com{,/-/issues,/-/issues/{719,566,1517},/-/merge_requests,/-/merge_requests/{1071,1265,1270,1485,1531},/-/project_members}`,
`/primer/design{,/-/merge_requests,/-/merge_requests/450,/-/milestones}`,
`/root/metaseq{,/-/issues}`, `/byteblaze/{dotfiles,gimmiethat.space,empathy-prompts,
a11y-syntax-highlighting,a11y-webring.club,cloud-to-butt,solarized-prism-theme,
accessible-html-content-patterns,millennials-to-snake-people,timeit,
remove-board-movement-events-from-the-github-issue-timeline}` and their sub-pages,
`/vinta/awesome-python{,/-/issues}`, `/convexegg/chatgpt/-/issues`,
`/0ang3el/aem-hacker/-/issues`, `/kkroening/ffmpeg-python/-/issues?…`,
`/keycloak/keycloak/-/issues?…`, `/OpenAPITools/openapi-generator/-/issues?…`,
`/umano/AndroidSlidingUpPanel/-/issues?…`, `/CellularPrivacy/Android-IMSI-Catcher-Detector`,
`/dehenne/awesome-visibility/-/graphs/master`, `/amwhalen/archive-my-tweets/-/tree/…`.

**B. Routes whose record the task CREATES** — the route pattern must resolve and
the create flow must produce a record at exactly that path. **Do not pre-seed
these; pre-seeding makes the task trivially "already done" and can itself fail
the evaluator.**
`/byteblaze/{AGISite,AutoAGI,agi_index,awesome-llms,awesome_llm_reading,
awesome_program_aided_reasoning,awesome_web_agents,awesome_webagent,chatgpt_plugin,
llm_bulk_inference,planner,project_site,web_agent,web_agent_android_xl,
web_agent_android_xs,web_agent_index,web_agent_nodejs,web_arena,webagent,
11711_gitlab,nolan_followers,nolan_academy_awards,nolan_honest_fans,nolan_old_fans,
nolan_young_fans,bafta_awards_nolan,Awesome_DIY_ideas,Do-it-myself,TODO,
fun_thing_to_do,live_a_life}` and their `/-/project_members`, `/-/commits`,
`/-/raw/main/README.md` sub-routes;
`/groups/{coding_friends,crew,n-lab,webagent,x-lab}/-/group_members`;
`/byteblaze/gimmiethat.space/-/raw/main/{real_space,news,moive_space,funny_pic}/urls.txt`;
`/byteblaze/{dotfiles,gimmiethat.space}/-/blob/main/LICENSE`.

**C. Routes whose record is a FORK the task creates.**
`/byteblaze/{2019-nCov,ChatGPT,PyTorch-GAN,metaseq,CacheEval,SimCache,dots,
nvidia-patch,viewgrades-scraper}` — forks of `yjlou/2019-nCov`,
`convexegg/chatgpt`, `eriklindernoren/PyTorch-GAN`, `root/metaseq`,
`aklsh/{CacheEval,SimCache,nvidia-patch,viewgrades-scraper}`, `aklsh/dots`.
The fork sources are all present in the source DB and **must** be seeded.

Verified: 145/145 anchor routes map to a row. See `SOURCE.md § Anchor coverage`.
