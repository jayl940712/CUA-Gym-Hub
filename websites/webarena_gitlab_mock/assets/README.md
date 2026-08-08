# GitLab 15.7.5 — UI specification for the React mock

This file is the **complete UI contract** for `webarena_gitlab_mock`. It was written by
reading the rendered DOM of the live WebArena GitLab instance (GitLab Community Edition
**15.7.5**, `http://localhost:8023`, logged in as **byteblaze** / display name
**Byte Blaze**) plus the authoritative Haml templates inside the container. A dev agent
should be able to rebuild every view from this document without ever seeing the source.

**Every string in backticks is verbatim copy.** Do not paraphrase, re-case, re-punctuate
or "improve" it. Where a string, route or DOM selector is marked `(ANCHOR)` it appears in
`assets/task_anchors.md` and a WebArena evaluator compares against it literally — those
are hard requirements, not suggestions.

Companion inputs in this directory:

| File | What it is |
|---|---|
| `assets/task_anchors.md` | the task contract: 145 anchor routes, 252 anchor strings, 25 anchor DOM locators |
| `assets/html/*.html` | 68 captured rendered-DOM pages |
| `assets/screenshots/reference/*.png` | 66 reference screenshots @ 1920x1080 |

---

## 0. Global conventions

### 0.1 Page shell

Every page is one of two shells.

**Shell A — dashboard / explore / user / settings pages (no project context).**

```
┌───────────────────────────────────────────────────────────────────────┐
│ .navbar-gitlab                       x=0     w=1920   h=48   (fixed)  │
├───────────────────────────────────────────────────────────────────────┤
│      .container-fluid.container-limited   x=320  w=1280               │
│        └ #content-body                    x=336  w=1248               │
└───────────────────────────────────────────────────────────────────────┘
```
No `.nav-sidebar`. `.content-wrapper` spans the full 1920px.

**Shell B — project / group pages.**

```
┌───────────────────────────────────────────────────────────────────────┐
│ .navbar-gitlab                            x=0     w=1920  h=48        │
├──────────────┬────────────────────────────────────────────────────────┤
│ .nav-sidebar │ .content-wrapper                x=256  w=1664          │
│ x=0  w=256   │   .breadcrumbs                  w=990   h=48           │
│ (collapsible)│   .container-fluid.container-limited  w=990            │
│              │     #content-body               x=609  w=958           │
└──────────────┴────────────────────────────────────────────────────────┘
```

**Shell B+ — issue / merge-request detail** adds a third column:

```
  #content-body / .issuable-details   x=464  w=958
  .right-sidebar.js-issuable-sidebar  x=1630 w=290   (full height, collapsible to 62px)
    └ .issuable-context-form          x=1651 w=349
```

Note `#content-body` shifts left (609 → 464) on issuable pages because the right sidebar
takes 290px out of the content wrapper.

### 0.2 Design tokens (measured with `getComputedStyle` on the live site)

| Token | Value | Where |
|---|---|---|
| Body font | `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Noto Sans", Ubuntu, Cantarell, "Helvetica Neue", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"` | `body` |
| Body font-size | `14px` | `body` |
| Body background | `#FFFFFF` | `body` |
| Text / gray-900 | `#333238` `rgb(51,50,56)` | default text, sidebar links |
| Navbar background | `#292961` `rgb(41,41,97)` (Indigo-900 — the default "Indigo" theme) | `.navbar-gitlab` |
| Left sidebar background | `#FBFAFD` `rgb(251,250,253)` (gray-10) | `.nav-sidebar` |
| Breadcrumb bar background | transparent | `.breadcrumbs` |
| Primary / confirm button | bg `#1F75CB` `rgb(31,117,203)`, text `#FFFFFF`, border `#DCDCDE`, radius `4px`, font-size `14px`, padding `8px 12px` | `.btn.gl-button.btn-confirm` |
| Default button | bg `rgba(31,30,36,0.08)`, text `#333238`, border `#DEDEE3` | `.btn.gl-button.btn-default` |
| `h1` on dashboards | `28px / 600` | `.page-title` |
| `h1` on project pages | `23px / 600` | `.title` |
| `h3` | `18.2px` | |
| Active tab | color `#000`, `border-bottom-color: #000`, `font-weight: 600` | `.nav-links .nav-link.active` |

GitLab's utility-class system (`gl-*`) is everywhere in the DOM — `gl-mr-3`, `gl-display-flex`,
`gl-font-monospace`, `gl-text-gray-500`, `gl-font-sm`, `gl-font-weight-bold`. **Keep the
class names**, even if you implement them with your own CSS: several evaluators select on
them (notably `a.gl-font-monospace` on MR pages).

### 0.3 Relative time — the two formats

GitLab renders timestamps as a `<time class="js-timeago">` element whose *text* is a
humanised delta and whose `title` is the absolute time:

```html
<time class="js-timeago"
      title="Mar 27, 2023 8:21am PDT"
      datetime="2023-03-27T15:21:00Z"
      data-toggle="tooltip" data-placement="bottom" data-container="body">3 years ago</time>
```

- **Text (visible)**: `just now`, `1 minute ago`, `26 minutes ago`, `1 hour ago`,
  `5 hours ago`, `1 day ago`, `3 days ago`, `1 week ago`, `1 month ago`, `1 year ago`,
  `3 years ago`, `7 years ago`. Computed live from `datetime` against the browser clock —
  reproduce it as a real function, not a frozen string.
- **`title` tooltip (absolute)**: `Mon D, YYYY h:mmam TZ` — e.g. `Apr 1, 2020 9:13pm PDT`,
  `Dec 30, 2018 11:42am PST`, `Jan 22, 2023 4:03pm PST`. Note: no leading zero on the day
  or the hour; lowercase `am`/`pm` with no space; the timezone abbreviation follows the
  user's `Time zone` profile setting (this instance renders `PDT`/`PST`).
- **`datetime` attribute**: ISO-8601 UTC with `Z`, e.g. `2022-08-11T16:10:01Z`.
- **Bare absolute dates** (no `<time>` element, no relative form) are used for
  *user-entered* dates — milestone start/due dates, issue due dates.
  Format: **`%b %-d, %Y`** — abbreviated month, no zero-padded day, comma, 4-digit year.
  e.g. `Dec 31, 2030`, `Apr 1, 2033`, `Jan 16, 2030`, `Mar 15, 2044`, `Jul 18, 2033`.
  Many of these are ANCHOR strings, so the format is load-bearing.
- **One exception — the profile "Member since" line** uses Rails' `to_s(:long)`, i.e. the
  **full month name**: `Member since March 23, 2023`. Do not abbreviate it.
- Commit-list date group headers use a third form — see §11.

> **Container clock caveat.** The captures were taken while the container clock read
> 2026, so a 2023 commit renders as `3 years ago`. Store real `datetime` values in the
> seed and compute the relative string at render time; never hard-code `3 years ago`.

### 0.4 Avatars

Two mechanisms, both must be supported:

1. **Gravatar** — `https://www.gravatar.com/avatar/<md5>?s=<size>&d=identicon`
   (e.g. `.../99a4297c867eada2606b9b6973f081f9?s=48&d=identicon`, `?s=80`).
   The mock is **offline**: do not fetch gravatar.com. Ship local placeholder images or
   render the identicon fallback for every user, but keep the `<img>` `src` shape if any
   evaluator reads it (none currently do).
2. **Identicon tile** — a letter tile used for projects/groups without an avatar:
   `<span class="gl-avatar gl-avatar-s48 gl-avatar-identicon gl-avatar-identicon-bg1">D</span>`.
   Background variants are `gl-avatar-identicon-bg1` … `gl-avatar-identicon-bg7`, chosen
   deterministically from the entity id. The letter is the first character of the name,
   uppercased.

Size classes: `gl-avatar-s16 / s24 / s32 / s48 / s64 / s96`, plus the legacy
`.avatar.s16 / .s24 / .s26 / .s32 / .s40 / .s48 / .s64 / .s96` and `.avatar-circle`
(users are circles, projects/groups are rounded squares — `.rect-avatar`).

### 0.5 Document title

`<title>` follows `<Page> · <Context> · GitLab`:

| Route | `<title>` |
|---|---|
| `/` and `/dashboard/projects` | `Projects · Dashboard · GitLab` |
| `/dashboard/projects/starred` | `Dashboard · GitLab` |
| `/dashboard/groups` | `Groups · Dashboard · GitLab` |
| `/dashboard/issues?...` | `Issues · Dashboard · GitLab` |
| `/dashboard/merge_requests?...` | `Merge requests · Dashboard · GitLab` |
| `/dashboard/todos` | `To-Do List · Dashboard · GitLab` |
| `/dashboard/activity` | `Activity · Dashboard · GitLab` |
| `/dashboard/milestones` | `Milestones · Dashboard · GitLab` |
| `/dashboard/snippets` | `Snippets · Dashboard · GitLab` |
| `/explore`, `/explore/projects/trending`, `/explore/projects/starred` | `Projects · Explore · GitLab` |
| `/explore/groups` | `Groups · Explore · GitLab` |
| `/byteblaze` and all `/users/byteblaze/*` | `Byte Blaze · GitLab` |
| `/-/profile` | `Edit Profile · User Settings · GitLab` |
| `/-/profile/preferences` | `Preferences · User Settings · GitLab` |
| `/search` | `Search · GitLab` ; with a query → `foo · Search · GitLab` |
| `/projects/new` | `New Project · GitLab` |
| `/groups/new` | `New Group · GitLab` |
| `/byteblaze/dotfiles` | `Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/dotfiles/-/tree/main` | `Files · main · Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/dotfiles/-/issues` | `Issues · Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/dotfiles/-/merge_requests` | `Merge requests · Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/dotfiles/-/milestones` | `Milestones · Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/dotfiles/-/project_members` | `Members · Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/dotfiles/-/labels` | `Labels · Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/dotfiles/-/commits/main` | `Commits · main · Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/dotfiles/-/branches` | `Branches · Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/dotfiles/-/tags` | `Tags · Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/dotfiles/activity` | `Activity · Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/dotfiles/edit` | `General · Settings · Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/dotfiles/-/forks` | `Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/dotfiles/-/merge_requests/new` | `New merge request · Byte Blaze / dotfiles · GitLab` |

The separator is U+00B7 MIDDLE DOT surrounded by single spaces.

### 0.6 Global dismissible alert banners

Two banners render **above the breadcrumbs on every project page** in this instance
(visible in `screenshots/reference/proj-dotfiles.png`). They push all content down ~200px,
so reproduce them or the screenshots will not line up. Each has an `×` close button on the
far right (`.js-close`, `aria-label="Dismiss"`), and dismissal is client-side only.

1. Warning banner (`.alert.alert-warning` / `.gl-alert-warning`, ⚠ icon):
   `You can't push or pull repositories using SSH until you add an SSH key to your profile.`
   with two buttons: `Add SSH key` (`.btn-confirm`, href `/-/profile/keys`) and
   `Don't show again` (`.btn-default`).
2. Info banner (`.alert.alert-info` / `.gl-alert-info`, ⓘ icon), two lines:
   `The Auto DevOps pipeline has been enabled and will be used if no alternative CI configuration file is found.`
   `Container registry is not enabled on this GitLab instance. Ask an administrator to enable it in order for Auto DevOps to work.`
   with two buttons: `Settings` (`.btn-confirm`) and `More information` (`.btn-default`).

### 0.7 URL conventions the evaluators depend on

- Project-scoped resources live under `/-/`: `/:ns/:proj/-/issues`, `/-/merge_requests`,
  `/-/milestones`, `/-/labels`, `/-/project_members`, `/-/tree/:ref/*path`,
  `/-/blob/:ref/*path`, `/-/raw/:ref/*path`, `/-/commits/:ref`, `/-/branches`, `/-/tags`,
  `/-/graphs/:ref`, `/-/network/:ref`, `/-/forks`, `/-/issues/new`,
  `/-/merge_requests/new`. **Exceptions that do NOT use `/-/`:** `/:ns/:proj/activity`
  and `/:ns/:proj/edit`.
- Groups: `/groups/:group`, `/groups/:group/-/group_members`, `/groups/new`.
  A bare `/:group` also resolves to the group overview when the namespace is a group.
- Users: `/:username` (profile), `/users/:username/{activity,groups,starred,followers,following,projects,contributed,snippets}`.
- **Trailing-slash tolerance is required.** Several anchor routes are written with a
  slash before the query string, e.g.
  `/a11yproject/a11yproject.com/-/issues/?label_name%5B%5D=bug` and
  `/root/metaseq/-/issues/?label_name%5B%5D=None`. `/-/issues` and `/-/issues/` must both
  render the list.
- **Repeated array params.** Labels are `label_name[]=<name>` (URL-encoded as
  `label_name%5B%5D=`), negated labels are `not[label_name][]=<name>`
  (`not%5Blabel_name%5D%5B%5D=`). Multiple labels repeat the param.
- Common query params: `scope` (`all` | `assigned_to_me` | `created_by_me`),
  `state` (`opened` | `closed` | `merged` | `all`), `sort`, `search`,
  `assignee_username`, `author_username`, `reviewer_username`, `milestone_title`,
  `label_name[]`, `not[label_name][]`, `first_page_size`, `page`.

### 0.8 Component inventory (implement once, reuse everywhere)

| Component | DOM |
|---|---|
| Dropdown | Two flavours coexist. Legacy: `.dropdown > .dropdown-menu-toggle + .dropdown-menu > .dropdown-header, li > a.dropdown-item, .divider`. GitLab-UI/BootstrapVue: `.dropdown.b-dropdown.gl-dropdown.btn-group > button.gl-dropdown-toggle > .gl-dropdown-button-text` + `.dropdown-menu > .gl-dropdown-inner > .gl-dropdown-contents > li.gl-dropdown-section-header / li.gl-dropdown-item(.is-active)`. **`.gl-new-dropdown` does not exist in 15.7.5** — zero occurrences across all 68 captures. See §1d. |
| Button | `.btn.gl-button` + one of `.btn-confirm` `.btn-default` `.btn-danger` `.btn-success` `.btn-dashed` `.btn-link`, plus a size `.btn-sm` `.btn-md`, plus `.btn-icon` / `.btn-block`. Label lives in `.gl-button-text`. |
| Icon | `<svg class="s16 gl-icon"><use href="/assets/icons-<hash>.svg#<name>"></use></svg>` — sprite reference. Reproduce with any icon set; keep `.gl-icon` and the size class. |
| Badge / pill | `.gl-badge.badge.badge-pill` + `badge-info` (blue), `badge-success` (green), `badge-muted` (gray), `badge-warning`, `badge-danger`; sizes `.sm`/`.md`. |
| Counter badge | `.badge.badge-pill.gl-tab-counter-badge` (tab counts), `.count` (sidebar counts). |
| Tabs | `<ul class="nav-links nav-tabs nav"><li class="nav-item"><a class="nav-link active">` — GitLab-UI variant is `.gl-tabs-nav` / `.gl-tab-nav-item-active`. |
| Pagination (issuable lists) | `<div class="gl-keyset-pagination btn-group">` containing two buttons labelled exactly `Prev` and `Next`; the unavailable direction is `disabled`. This is what `/-/issues` and `/-/merge_requests` use — there are **no page numbers** on those lists. |
| Pagination (numbered) | `.gl-pagination` `<ul class="pagination">` with `.page-item.prev`, `.page-item` (numbers), `.page-item.next`, `.page-item.disabled`, `.page-item.active`. Used on project/group/explore lists. Labels: `Prev`, `Next`. |
| Modal | `.modal.show > .modal-dialog > .modal-content > .modal-header (.modal-title + .close/×) / .modal-body / .modal-footer`, backdrop `.modal-backdrop`. |
| Toast / flash | `.flash-container.flash-container-page` > `.flash-alert` / `.flash-notice` / `.flash-warning`; GitLab-UI toast is `.gl-toast`. |
| Tooltip | Bootstrap-style: `data-toggle="tooltip"` + `title` on the element; rendered into `.tooltip.show > .tooltip-inner`. |
| Relative time | `<time class="js-timeago" datetime title data-toggle="tooltip">` (§0.3). |
| Filtered search | `.filtered-search-wrapper` / `.gl-filtered-search`, `[data-testid="filtered-search-input"]` — see §5a. |
| Markdown body | `.md` (rendered), `.md-area` / `.md-header` / `.md-write-holder` / `.md-preview-holder` (editor). |
| Emoji | `<gl-emoji title="triangular ruler" data-name="triangular_ruler" data-unicode-version="6.0">📐</gl-emoji>` — a custom element. Keep the tag name, `title`, `data-name` and `data-unicode-version`; the emoji character is the element's text. |
| Empty state | `<div class="row empty-state">` > a `.svg-content` column (illustration) + a text column with `<h1>`/`<h4>` heading + `<p>` body (often ending in a `Learn more.` docs link) + a CTA `.btn`. Newer views use `.gl-empty-state` > `.gl-empty-state-content`. |

### 0.9 Anchor-locator index — which section defines each evaluator selector

All 25 `program_html` locators from `assets/task_anchors.md`, and where this document
pins them down. **If a selector below does not exist in the finished mock, those tasks
fail outright.**

| Evaluator locator | Defined in | Notes |
|---|---|---|
| `document.querySelector("#content-body").outerText` | §0.1, §16b | the main content `<main id="content-body" class="content">` on the milestone page |
| `document.querySelector('.block.assignee').outerText` | §14b | issue right-sidebar Assignee block |
| `document.querySelector('.block.due_date').outerText` | **§16b only** | ⚠ `.block.due_date` exists **only on the milestone detail page**. The issue sidebar's due-date widget is `<div class="block" data-testid="sidebar-due-date">` — it has no `due_date` class. Two different views, two different selectors. |
| `document.querySelector('.block.start_date').outerText` | §16b | milestone sidebar only |
| `document.querySelector('.block.reviewer').outerText` | §15d | MR right-sidebar Reviewer block |
| `document.querySelector('[data-testid="sidebar-due-date"').outerText` | §14b | the **issue** sidebar due-date block. Note the evaluator's unbalanced bracket — it still matches in JS |
| `document.querySelector('[data-qa-selector="title_content"]').outerText` | §14, §15b | issuable title `<h1>` |
| `document.querySelector('.detail-page-description').outerText` | §14 | issue description wrapper |
| `document.querySelectorAll(".detail-page-description > a.gl-font-monospace")[0]` / `[1]` | §15b | MR source branch = index 0, target branch = index 1; both must be **direct children** of `.detail-page-description` |
| `document.querySelector('[id="notes-list"').lastElementChild.querySelector('.timeline-discussion-body …')` | §14, §15c | `<ul id="notes-list">`; the last `<li>` must be the newest note |
| `document.querySelector('.cover-status').lastChild.textContent` | §7 | profile status: emoji element then a **bare text node** holding the message |
| `document.querySelector('.profile-header [itemprop="url"]').outerText` | §7 | profile website link |
| `document.querySelector('.user-profile').outerText` | §7, §8a | profile wrapper, read on `/users/byteblaze/following` |
| `document.querySelector('.home-panel-description-markdown').outerText` | §9 | project overview description |
| `document.querySelector('.visibility-icon').getAttribute('title')` | §2, §9 | must carry the full visibility sentence in `title` |
| `document.querySelector('[data-qa-selector="projects_list"').outerText` | §2 | the `<ul>` wrapping the dashboard project rows |
| `func:gitlab_get_project_memeber_role(__page__, '<username>')` | §17 | reads a member's role out of the members table by username |
| `document.querySelector('.submission__inner').outerText` (+ `.submission_…`) | — | **Reddit** selector, not GitLab; cross-site tasks webarena-681…688 |

### 0.10 Things the mock must NOT do

- No network. Gravatar, `about.gitlab.com`, `forum.gitlab.com` and the docs links are
  external — render them as inert `<a href>` targets; never fetch.
- No auth. The session is permanently byteblaze; `/users/sign_out` may be a no-op link.
- The tasks *mutate* state (create issues, projects, milestones, members, groups; edit
  the profile; comment on MRs). All of §14, §15, §16, §17, §19, §20, §21, §22 must be
  writable against local state, and the resulting record must render on the anchor route
  afterwards.

---

---

> Applies to **every** page unless stated otherwise. Sources: captured DOM
> `assets/html/proj-dotfiles.html`, `proj-a11yproject.html`, `proj-a11yproject-issues.html`,
> `proj-primer-milestones.html`, `dashboard-projects.html`, `dashboard-issues.html`,
> `explore-groups.html`, `labels-a11y.html`; screenshots `proj-dotfiles.png`,
> `dashboard-projects.png`; plus live Playwright probes of `http://localhost:8023`
> (top-nav mega-menu subviews, focused search dropdown, help dropdown, What's-new drawer,
> keyboard-shortcuts modal, group sidebar at `/robert1003`, collapsed-sidebar metrics).

---

## 1. Global chrome — top navbar

### 1.1 Route / applicability

Rendered on **every** authenticated route. Logged in as **byteblaze** / display name **Byte Blaze**.
`<title>` patterns (record these — an evaluator may read `document.title`):

| Page kind | `<title>` |
|---|---|
| Dashboard list | `Projects · Dashboard · GitLab`, `Issues · Dashboard · GitLab`, `To-Do List · Dashboard · GitLab` |
| Explore | `Projects · Explore · GitLab` |
| Project overview | `Byte Blaze / dotfiles · GitLab` |
| Project sub-page | `Issues · Byte Blaze / dotfiles · GitLab`, `Milestones · Primer / design · GitLab`, `Members · Byte Blaze / dotfiles · GitLab` |
| Repo files/blob | `Files · main · Byte Blaze / dotfiles · GitLab` |
| Issue detail | `Rethink the homepage's content (#719) · Issues · The A11Y Project / a11yproject.com · GitLab` |
| MR detail | `Octovisuals Page (!450) · Merge requests · Primer / design · GitLab` |
| User profile | `Byte Blaze · GitLab` |
| New project | `New Project · GitLab` |

Separator is U+00B7 MIDDLE DOT surrounded by single spaces.

### 1.2 Box structure & colours

```
<body class="ui-indigo tab-width-8 gl-browser-chrome gl-platform-linux page-initialised">
  <header class="navbar navbar-gitlab navbar-expand-sm js-navbar" data-qa-selector="navbar">
    <a class="gl-sr-only gl-accessibility" href="#content-body">Skip to content</a>
    <div class="container-fluid">
      <div class="header-content js-header-content"> … </div>
    </div>
  </header>
  <div id="whats-new-app" data-version-digest="3303dbbd…"></div>
  <div class="js-set-status-modal-wrapper" data-current-emoji="" data-current-message=""
       data-default-emoji="speech_balloon"></div>
  <div class="layout-page hide-when-top-nav-responsive-open page-with-contextual-sidebar"> … </div>
```

| Element | x | y | w | h | notes |
|---|---|---|---|---|---|
| `.navbar-gitlab` | 0 | 0 | 1920 | 48 | `position: fixed; z-index: 1000; background: rgb(41,41,97)` (`#292961`, the `ui-indigo` theme) |
| `.navbar-gitlab .container-fluid` | 16 | 0 | 1888 | 48 | |
| `.title-container` (logo) | 16 | 0 | 73 | 48 | |
| `#logo` | 8 | 4 | 41 | 40 | |
| `.navbar-sub-nav` (hamburger) | 57 | 0 | 32 | 48 | link colour `rgb(209,209,240)` = `#d1d1f0` |
| `.header-search` (search box) | 99 | 8 | 320 | 32 | `background: rgba(209,209,240,0.2)`, rounded |
| `.header-new` (`+`) | 1532 | 4 | 52 | 40 | |
| `.user-counter` (each) | 1588+ | 4 | 62 | 40 | |
| `.header-user-avatar` | 1850 | 12 | 24 | 24 | circle, `border: 1px solid rgba(31,30,36,0.08)` |

Default nav link/icon colour `#d1d1f0`; hover/active gets a lighter translucent white pill.
`body { font-size: 14px; background: #fff; color: rgb(51,50,56) }`.

Visual left→right order (see `proj-dotfiles.png`): **tanuki logo → hamburger → search box →
(flex gap) → `+`▾ → issues▪13 → MR▪8▾ → todo▪5 → `?`▾ → avatar▾**.

### 1.3 Skip link

```html
<a class="gl-sr-only gl-accessibility" href="#content-body">Skip to content</a>
```
First focusable element in the document. Text exactly `Skip to content`.

### 1.4 Logo

```html
<div class="title">
  <span class="gl-sr-only">GitLab</span>
  <a title="Dashboard" id="logo" class="has-tooltip" href="/">
    <svg class="tanuki-logo" width="25" height="24" viewBox="0 0 25 24"> … </svg>
  </a>
</div>
```
- href `/` — (ANCHOR: `/` is an anchor route for 168 tasks)
- `title="Dashboard"` (tooltip), sr-only label `GitLab`.
- Tanuki paths carry classes `tanuki-shape tanuki` (`#E24329`), `right-cheek` (`#FC6D26`),
  `chin` (`#FCA326`), `left-cheek` (`#FC6D26`).

### 1.5 Hamburger mega-menu (`.navbar-sub-nav`)

```html
<ul class="nav navbar-sub-nav">
  <li class="nav-item b-nav-dropdown dropdown gl-dropdown"
      data-qa-selector="navbar_dropdown" data-qa-title="Menu" id="__BVID__104">
    <a role="button" aria-haspopup="true" aria-expanded="false" href="#" target="_self"
       class="nav-link dropdown-toggle top-nav-toggle js-top-nav-dropdown-toggle
              gl-px-3! dropdown-toggle-no-caret" id="__BVID__104__BV_toggle_">
      <svg data-testid="hamburger-icon" class="gl-icon s16">…#hamburger</svg>
    </a>
    <ul class="dropdown-menu gl-mt-3! gl-max-w-none! gl-max-h-none! gl-sm-w-auto!
               js-top-nav-dropdown-menu"> … </ul>
```
There is **no caret** on this toggle and **no visible text label** — hamburger icon only.
`data-qa-title="Menu"`. (`__BVID__nnn` ids are BootstrapVue auto-ids and vary per page; do not
rely on them, but they *do* appear in the real DOM.)

**Panel layout** — two columns inside `<form class="b-dropdown-form gl-p-0">`:

| Column | class | width token |
|---|---|---|
| left rail | `div[data-testid="menu-sidebar"].gl-w-grid-size-30.gl-flex-shrink-0.gl-bg-gray-10.gl-p-3` | 30 grid units, grey `#fbfafd`-ish |
| right pane | `div[data-testid="menu-subview"][data-qa-selector="menu_subview_container"].gl-w-grid-size-40.gl-overflow-hidden.gl-p-3` | 40 grid units |

**Left rail contents** (exact order, all `data-testid="menu-item"`):

| # | Element | Text | href / behaviour | selectors |
|---|---|---|---|---|
| — | `strong[data-testid="menu-header"]` | `Switch to` | — | `.gl-px-4.gl-py-2.gl-text-gray-900.gl-display-block` |
| 1 | `<button>` | `Projects` | swaps right pane to projects subview | `aria-label="Projects"`, `data-qa-selector="projects_dropdown"`, `data-track-label="projects_dropdown"`, icon `#project`, trailing `#chevron-right`. Bold + `active` class when this subview is showing |
| 2 | `<button>` | `Groups` | swaps right pane to groups subview | `aria-label="Groups"`, `data-qa-selector="groups_dropdown"`, icon `#group`, trailing `#chevron-right` |
| — | `strong[data-testid="menu-header"]` | `Explore` | — | `.gl-pt-3!` |
| 3 | `<a>` | `Milestones` | `/dashboard/milestones` | `aria-label="Milestones"`, icon `#clock` |
| 4 | `<a>` | `Snippets` | `/dashboard/snippets` | `aria-label="Snippets"`, `data-qa-selector="snippets_link"`, icon `#snippet` |
| 5 | `<a>` | `Activity` | `/dashboard/activity` | `aria-label="Activity"`, icon `#history` |

`Explore` is a **section header only** — there is no `Explore` menu item and no link to
`/explore` in this dropdown (verified live). `/explore` is still a real route (reached from
the Projects page `Explore` tab).

Button class string (all five items share it):
`btn top-nav-menu-item gl-display-block gl-pr-3! gl-w-full btn-default btn-md gl-button btn-default-tertiary gl-mt-1`
(the active one adds `gl-shadow-none! gl-font-weight-bold! active`).

**Right pane — Projects subview** (the default):

```
div[data-testid="frequent-items-container"].frequent-items-dropdown-container
 └ .frequent-items-dropdown-content
    ├ div[data-testid="frequent-items-search-input"].search-input-container
    │   └ .gl-search-box-by-type  >  input[type=search]
    │        placeholder="Search your projects"  aria-label="Search your projects"
    ├ div[data-testid="header"].section-header   →  "Frequently visited"
    └ .frequent-items-list-container > ul[data-testid="frequent-items-list"].list-unstyled
         └ li.section-empty.gl-mb-3  →  "Projects you visit often will appear here"
```
Footer of the pane:
```html
<div data-testid="menu-section" class="gl-pt-3 gl-border-1 gl-border-t-solid gl-border-gray-50">
  <a aria-label="View all projects" data-qa-selector="menu_item_link"
     data-qa-title="View all projects" href="/dashboard/projects"
     class="btn top-nav-menu-item … btn-default-tertiary" data-testid="menu-item">
     View all projects</a>
</div>
```

**Right pane — Groups subview** (click `Groups` in the rail; verified live):
identical structure, with
- input `placeholder="Search your groups"` / `aria-label="Search your groups"`
- header `Frequently visited`
- empty copy `Groups you visit often will appear here`
- footer link `View all groups` → `/dashboard/groups` (`data-qa-title="View all groups"`)

Both subviews stay mounted; the inactive one gets `style="display: none"`.

**Hidden keyboard-shortcut links** (rendered right after the `<ul class="nav navbar-sub-nav">`,
inside `<div class="hidden">`; they must exist for shortcut/eval targeting):

| class | text | href |
|---|---|---|
| `dashboard-shortcuts-projects` | `Projects` | `/dashboard/projects` |
| `dashboard-shortcuts-groups` | `Groups` | `/dashboard/groups` |
| `dashboard-shortcuts-milestones` | `Milestones` | `/dashboard/milestones` |
| `dashboard-shortcuts-snippets` | `Snippets` | `/dashboard/snippets` |
| `dashboard-shortcuts-activity` | `Activity` | `/dashboard/activity` |

### 1.6 Search box

Container: `li.nav-item.header-search-new.gl-display-none.gl-lg-display-block.gl-w-full`
inside `div.navbar-collapse.…​.global-search-container.hide-when-top-nav-responsive-open`.

```html
<div class="header-search is-not-active gl-relative gl-w-full" id="js-header-search"
     data-autocomplete-path="/search/autocomplete"
     data-issues-path="/dashboard/issues"
     data-mr-path="/dashboard/merge_requests"
     data-search-path="/search"
     data-search-context='{"project":{"id":193,"name":"dotfiles"},
        "project_metadata":{"issues_path":"/byteblaze/dotfiles/-/issues",
        "mr_path":"/byteblaze/dotfiles/-/merge_requests"},
        "code_search":true,"ref":"main","scope":null,"for_snippets":null}'>
  <form action="/search" accept-charset="UTF-8" method="get">
    <div class="gl-search-box-by-type">
      <svg data-testid="search-icon" class="gl-search-box-by-type-search-icon gl-icon s16">
      <input autocomplete="off" class="form-control gl-form-input gl-search-box-by-type-input"
             data-qa-selector="search_box" id="search" name="search"
             placeholder="Search GitLab" type="text">
    </div>
    <input type="hidden" name="project_id"    id="project_id"    value="193"  autocomplete="off">
    <input type="hidden" name="scope"         id="scope"                       autocomplete="off">
    <input type="hidden" name="search_code"   id="search_code"   value="true" autocomplete="off">
    <input type="hidden" name="snippets"      id="snippets"                    autocomplete="off">
    <input type="hidden" name="repository_ref" id="repository_ref" value="main" autocomplete="off">
    <input type="hidden" name="nav_source"    id="nav_source"    value="navbar" autocomplete="off">
    <kbd class="gl-absolute gl-right-3 gl-top-0 keyboard-shortcut-helper gl-z-index-1 has-tooltip"
         data-html="true" data-placement="bottom"
         title="Use the shortcut key &lt;kbd&gt;/&lt;/kbd&gt; to start a search">/</kbd>
  </form>
</div>
```

Placeholder is `Search GitLab` in **both** scopes. What changes inside a project:

| | Dashboard / global page | Inside a project (`/byteblaze/dotfiles`) |
|---|---|---|
| `data-search-context` | `{"for_snippets":null}` | full object incl. `project.id`, `project.name`, `project_metadata`, `code_search:true`, `ref` |
| hidden `project_id` | **absent** | `<input … value="193">` |
| hidden `scope` | **absent** | present, empty value |
| hidden `search_code` | **absent** | present, `value="true"` |
| hidden `snippets` | present, empty | present, empty |
| hidden `repository_ref` | present, empty | `value="main"` |
| small-screen search icon link | `href="/search"` | `href="/search?project_id=193"` |

The small-screen fallback is
`li.nav-item.d-none.d-sm-inline-block.d-lg-none > a[title="Search"][aria-label="Search"]`.

**Focused state** (click / press `/`): the whole widget re-renders as
`<form role="search" aria-label="Search GitLab" data-testid="header-search-form"
class="header-search gl-relative gl-rounded-base gl-w-full is-focused">` (the wrapper loses
`is-not-active`, gains `is-focused`; the `/` kbd hint gets `style="display:none"`), and a
dropdown appears:

```
div[data-testid="header-search-dropdown-menu"].header-search-dropdown-menu
  .gl-overflow-y-auto.gl-absolute.gl-w-full.gl-bg-white.gl-border-1.gl-rounded-base
  .gl-border-solid.gl-border-gray-200.gl-shadow-x0-y2-b4-s0.gl-mt-3
 └ .header-search-dropdown-content.gl-py-2
    ├ li.gl-dropdown-section-header > header.dropdown-header  →  <scope name>
    └ li.gl-dropdown-item > a.dropdown-item  ×5
```
Plus two sr-only live regions:
`span#search-input-description` → `Type for new suggestions to appear below.` and
`span[data-testid="search-results-description"]` →
`5 default results provided. Use the up and down arrow keys to navigate search results list.`

| `id` | label / text | href in a project (`dotfiles`) | href on a dashboard page |
|---|---|---|---|
| section header | `dotfiles` (project name) | — | `All GitLab` |
| `default-issues-assigned` | `Issues assigned to me` | `/byteblaze/dotfiles/-/issues/?assignee_username=byteblaze` | `/dashboard/issues/?assignee_username=byteblaze` |
| `default-issues-created` | `Issues I've created` | `/byteblaze/dotfiles/-/issues/?author_username=byteblaze` | `/dashboard/issues/?author_username=byteblaze` |
| `default-mrs-assigned` | `Merge requests assigned to me` | `/byteblaze/dotfiles/-/merge_requests/?assignee_username=byteblaze` | `/dashboard/merge_requests/?assignee_username=byteblaze` |
| `default-mrs-reviewer` | `Merge requests that I'm a reviewer` | `/byteblaze/dotfiles/-/merge_requests/?reviewer_username=byteblaze` | `/dashboard/merge_requests/?reviewer_username=byteblaze` |
| `default-mrs-created` | `Merge requests I've created` | `/byteblaze/dotfiles/-/merge_requests/?author_username=byteblaze` | `/dashboard/merge_requests/?author_username=byteblaze` |

Each item's `<a>` carries `role="menuitem" tabindex="-1"` and the visible text sits in
`div.gl-dropdown-item-text-wrapper > p.gl-dropdown-item-text-primary > span[aria-hidden="true"]`.

Submitting the form navigates to `/search?search=<q>&nav_source=navbar[&project_id=…]`
(**do not auto-submit in the mock beyond navigation**).

### 1.7 `+` create-new dropdown

```html
<li class="header-new gl-flex-grow-1 gl-flex-shrink-1 dropdown gl-display-none
           gl-sm-display-block gl-white-space-nowrap gl-text-right"
    data-track-action="click_dropdown" data-track-label="new_dropdown">
  <a class="header-new-dropdown-toggle has-tooltip gl-display-flex"
     id="js-onboarding-new-project-link" title="Create new..." aria-label="Create new..."
     data-toggle="dropdown" data-placement="bottom" data-container="body"
     data-display="static" data-qa-selector="new_menu_toggle" href="/projects/new">
     <svg class="s16" data-testid="plus-square-icon">…</svg>
     <svg class="s16 caret-down" data-testid="chevron-down-icon">…</svg>
  </a>
  <div class="dropdown-menu dropdown-menu-right dropdown-extended-height"> <ul> … </ul> </div>
</li>
```
Tooltip / aria-label are both exactly `Create new...` (three ASCII dots). The toggle itself
links to `/projects/new`.

**Inside a project** — two groups:

| Group header (`li.dropdown-bold-header`) | Item text | href | extra |
|---|---|---|---|
| `This project` | `New issue` | `/byteblaze/dotfiles/-/issues/new` | `data-qa-selector="new_issue_link"`, `data-track-action="click_link_new_issue"` |
| | `New merge request` | `/byteblaze/dotfiles/-/merge_requests/new` | `data-track-action="click_link_new_mr"` |
| | `New snippet` | `/byteblaze/dotfiles/-/snippets/new` | `data-track-action="click_link_new_snippet_project"` |
| | `Invite members 🤝` | `/byteblaze/dotfiles/-/project_members` | text node `Invite members ` + `<gl-emoji title="handshake" data-name="handshake" data-unicode-version="9.0" aria-hidden="true" class="gl-font-base gl-vertical-align-baseline">🤝</gl-emoji>` |
| *(`li.divider`)* | | | |
| `GitLab` | `New project/repository` | `/projects/new` | `data-qa-selector="global_new_project_link"` |
| | `New group` | `/groups/new` | `data-qa-selector="global_new_group_link"` |
| | `New snippet` | `/-/snippets/new` | `data-qa-selector="global_new_snippet_link"` |

**Outside a project** (dashboard / explore / group / profile): **no headers and no divider** —
just the three `GitLab` links (`New project/repository`, `New group`, `New snippet`) in a bare
`<ul>`.

### 1.8 Counters (`li.user-counter`)

All three sit in `div.navbar-collapse.gl-transition-medium.collapse >
ul.nav.navbar-nav.gl-w-full.gl-align-items-center.gl-justify-content-end`.

**Issues** (icon `#issues`):
```html
<li class="user-counter">
  <a title="Issues" aria-label="Issues" class="dashboard-shortcuts-issues js-prefetch-document"
     data-qa-selector="issues_shortcut_button" data-toggle="tooltip" data-placement="bottom"
     data-container="body" data-track-action="click_issues_link"
     href="/dashboard/issues?assignee_username=byteblaze">
    <svg class="s16" data-testid="issues-icon">
    <span aria-label="13 assigned issues"
          class="gl-badge badge badge-pill badge-success sm gl-ml-n2 ">13</span>
  </a>
</li>
```
- href `/dashboard/issues?assignee_username=byteblaze`, count **`13`**, `badge-success`
  (green `#c3e6cd` on `#24663b`), aria-label `13 assigned issues`. No dropdown.

**Merge requests** (icon `#git-merge`) — `li.user-counter.dropdown`:
```html
<a class="dashboard-shortcuts-merge_requests has-tooltip" title="Merge requests"
   aria-label="Merge requests" data-qa-selector="merge_requests_shortcut_button"
   data-toggle="dropdown" data-placement="bottom" data-container="body"
   href="/dashboard/merge_requests?assignee_username=byteblaze">
  <svg class="s16" data-testid="git-merge-icon">
  <span aria-label="8 merge requests"
        class="gl-badge badge badge-pill badge-warning sm js-merge-requests-count gl-ml-n2 ">8</span>
  <svg class="s16 caret-down" data-testid="chevron-down-icon">
</a>
<div class="dropdown-menu dropdown-menu-right"><ul>
  <li class="dropdown-header">Merge requests</li>
  <li><a class="gl-display-flex! gl-align-items-center js-prefetch-document"
         href="/dashboard/merge_requests?assignee_username=byteblaze">Assigned to you
      <span class="gl-badge badge badge-pill badge-neutral sm js-assigned-mr-count gl-ml-auto">3</span></a></li>
  <li><a class="dashboard-shortcuts-review_requests gl-display-flex! gl-align-items-center js-prefetch-document"
         href="/dashboard/merge_requests?reviewer_username=byteblaze">Review requests for you
      <span class="gl-badge badge badge-pill badge-neutral sm js-reviewer-mr-count gl-ml-auto">5</span></a></li>
</ul></div>
```
- count **`8`**, `badge-warning` (orange `#f5d9a8` on `#8f4700`); dropdown header `Merge requests`,
  items `Assigned to you` **`3`** and `Review requests for you` **`5`**, both `badge-neutral`.
- (ANCHOR) `/dashboard/merge_requests?assignee_username=byteblaze` (webarena-156) and
  `/dashboard/merge_requests?reviewer_username=byteblaze` (webarena-357) are anchor routes.
- Note this toggle is a **dropdown** (`data-toggle="dropdown"`) — clicking opens the menu; the
  `href` is the fallback target.

**To-Do List** (icon `#todo-done`):
```html
<a title="To-Do List" aria-label="To-Do List" class="shortcuts-todos js-prefetch-document"
   data-qa-selector="todos_shortcut_button" data-toggle="tooltip" data-placement="bottom"
   data-container="body" href="/dashboard/todos">
  <svg class="s16" data-testid="todo-done-icon">
  <span aria-label="Todos count"
        class="gl-badge badge badge-pill badge-info sm js-todos-count gl-ml-n2 ">5</span>
</a>
```
- count **`5`**, `badge-info` (blue `#cbe2f9` on `#0b5cad`), aria-label literally `Todos count`.
- (ANCHOR) `/dashboard/todos` (webarena-44).

All three badges: `.gl-badge.badge.badge-pill.<variant>.sm`, 12px/400, height 16px,
padding `0 8px`, `border-radius: 160px`, plus `gl-ml-n2` (pulls the badge onto the icon).
Note the trailing space inside the class attribute (`… gl-ml-n2 "`) — harmless, reproduce or not.

### 1.9 Help `?` dropdown

```html
<li class="nav-item header-help dropdown d-none d-md-block with-notifications"
    data-track-action="click_question_mark_link" data-track-label="main_navigation">
  <a class="header-help-dropdown-toggle gl-relative" data-toggle="dropdown" href="/help">
    <span class="gl-sr-only">Help</span>
    <svg class="s16" data-testid="question-o-icon">
    <span class="notification-dot rounded-circle gl-absolute"></span>
    <svg class="s16 caret-down" data-testid="chevron-down-icon">
  </a>
  <div class="dropdown-menu dropdown-menu-right"><ul> … </ul></div>
</li>
```
The `.notification-dot.rounded-circle.gl-absolute` is the small orange dot on the `?` icon
(present because What's-new is unread); the wrapper `<li>` carries `with-notifications`.

| Order | Element | Text | Target |
|---|---|---|---|
| 1 | `<li>` empty | *(blank spacer li)* | — |
| 2 | `button.js-whats-new-trigger.gl-justify-content-space-between.gl-align-items-center.gl-display-flex!` | `What's new` + `<span class="gl-badge badge badge-pill badge-muted sm js-whats-new-notification-count">10</span>` | opens the What's-new drawer |
| 3 | `<a>` | `Help` | `/help` |
| 4 | `<a>` | `Support` | `https://about.gitlab.com/getting-help/` |
| 5 | `a.text-nowrap[target=_blank][rel="noopener noreferrer"]` | `Community forum` | `https://forum.gitlab.com` |
| 6 | `button.js-shortcuts-modal-trigger` | `Keyboard shortcuts` + `<kbd aria-hidden="true" class="flat float-right">?</kbd>` | opens the shortcuts modal |
| 7 | `li.divider` | — | — |
| 8 | `<a>` | `Submit feedback` | `https://about.gitlab.com/submit-feedback` |
| 9 | `a.text-nowrap[target=_blank]` | `Contribute to GitLab` | `https://about.gitlab.com/contributing` |

The `?` apostrophe in `What's new` is a plain ASCII `'`.

**What's-new drawer** (clicking `What's new`) — mounts into `#whats-new-app` and renders
`<aside class="gl-drawer whats-new-drawer gl-reset-line-height gl-drawer-default">`:
- `.gl-drawer-header > .gl-drawer-title > h4.page-title.gl-my-2` → `What's new`
- close button `button.btn.gl-drawer-close-button.btn-default.btn-sm.gl-button.btn-default-tertiary.btn-icon`
  with `aria-label="Close drawer"`
- `.gl-drawer-body.gl-drawer-body-scrim > .gl-p-0 > .gl-infinite-scroll-container`
  (`style="max-height: 965px"`), one `div.gl-py-6.gl-px-6.gl-border-b-1.gl-border-b-solid.gl-border-b-gray-100`
  per release item containing: an image link (`a[data-testid="whats-new-image-link"]` wrapping
  `.whats-new-item-image.gl-bg-size-cover`), a title link
  (`a.gl-link.whats-new-item-title-link` → `h5[data-test-id="feature-name"].gl-font-lg.gl-my-0`),
  `div[data-testid="release-date"].gl-mb-3` (e.g. `December 21, 2022`), tier badges
  `span.badge.gl-mr-2.badge-tier.badge-pill.gl-badge.md` with texts `Free` / `Premium` / `Ultimate`,
  the body markdown, and a `Learn more` link.
- First two GitLab 15.7 items observed: `Introducing the GitLab CLI` (Dec 21 2022, Free/Premium/Ultimate)
  and `Browser-based DAST general availability` (Dec 21 2022, Ultimate).
- The drawer is decorative for the tasks; a mock may stub it, but keep `#whats-new-app` and the
  `10` badge.

**Keyboard-shortcuts modal** (clicking `Keyboard shortcuts`, or pressing `?`):
```html
<div id="keyboard-shortcut-modal" role="dialog" aria-label="Keyboard shortcuts"
     class="modal fade show gl-modal" aria-modal="true" style="display:block">
  <div class="modal-dialog modal-lg"><div class="modal-content">
    <header class="modal-header"><h4 class="modal-title">Keyboard shortcuts</h4>
      <button aria-label="Close" class="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon">
    </header>
    <div class="modal-body shortcut-help-body gl-p-0!">
      … search input aria-label="Search keyboard shortcuts", placeholder "Search" …
      … toggle: span[data-testid="toggle-label"] "Toggle shortcuts",
        button[role=switch][aria-checked=true].gl-toggle.is-checked …
      <div class="shortcut-help-container">
        <section class="shortcut-help-mapping">
          <strong class="shortcut-help-mapping-title …">Global Shortcuts</strong> …
```

### 1.10 User avatar dropdown

```html
<li class="nav-item header-user js-nav-user-dropdown dropdown"
    data-qa-selector="user_menu" data-testid="user-menu"
    data-track-action="click_dropdown" data-track-label="profile_dropdown">
  <a class="header-user-dropdown-toggle" data-toggle="dropdown" href="/byteblaze">
    <img alt="Byte Blaze" width="24" height="24" loading="lazy"
         class="gl-avatar gl-avatar-s24 header-user-avatar gl-avatar-circle"
         data-qa-selector="user_avatar_content"
         src="https://www.gravatar.com/avatar/99a4297c867eada2606b9b6973f081f9?s=48&d=identicon"
         srcset="…?s=48&d=identicon 1x, …?s=48&d=identicon 2x">
    <svg class="s16 caret-down" data-testid="chevron-down-icon">
  </a>
  <div class="dropdown-menu dropdown-menu-right"><ul> … </ul></div>
</li>
```

**Avatar URL pattern (site-wide):**
`https://www.gravatar.com/avatar/<md5-of-email>?s=<px>&d=identicon`.
byteblaze's hash is `99a4297c867eada2606b9b6973f081f9`. Navbar uses `s=48` rendered at 24×24.
Elsewhere: `s=80` for `gl-avatar-s32`, `s=180`/`s=800` for profile headers.
The mock must serve these locally (no network) — mirror the images or generate identicons.

Dropdown items in order:

| Order | Markup | Text |
|---|---|---|
| 1 | `li.current-user > a.gl-line-height-20![data-user="byteblaze"][data-testid="user-profile-link"][data-qa-selector="user_profile_link"][href="/byteblaze"]` | `<div class="gl-font-weight-bold">Byte Blaze</div>` then `@byteblaze` |
| 2 | `li.divider` | — |
| 3 | `button.gl-button.btn.btn-link.menu-item.js-set-status-modal-trigger.ready` | `Set status` |
| 4 | `a[data-qa-selector="edit_profile_link"][href="/-/profile"]` | `Edit profile` |
| 5 | `a[href="/-/profile/preferences"]` | `Preferences` |
| 6 | `li.divider.d-md-none` | — |
| 7–11 | `li.d-md-none` × 5 | `Help` → `/help`, `Support` → `https://about.gitlab.com/getting-help/`, `Community forum` → `https://forum.gitlab.com`, `Submit feedback` → `https://about.gitlab.com/submit-feedback`, `Contribute to GitLab` → `https://about.gitlab.com/contributing` |
| 12 | `li.divider` | — |
| 13 | `a.sign-out-link[data-qa-selector="sign_out_link"][href="/users/sign_out"]` | `Sign out` |

Items 7–11 are the same Help group repeated, hidden at ≥ md (`d-md-none`) — at 1920px the
visible menu reads: `Byte Blaze / @byteblaze`, `Set status`, `Edit profile`, `Preferences`,
`Sign out` (verified live).
`Set status` opens the status modal mounted at
`div.js-set-status-modal-wrapper[data-current-emoji=""][data-current-message=""][data-default-emoji="speech_balloon"]`.

### 1.11 Responsive / mobile bits (keep for a11y-string parity)

```html
<button class="navbar-toggler d-block d-sm-none gl-border-none!"
        data-testid="top-nav-responsive-toggle" data-qa-selector="mobile_navbar_button" type="button">
  <span class="sr-only">Toggle navigation</span>
  <span class="more-icon gl-px-3 gl-font-sm gl-font-weight-bold">
    <svg data-testid="hamburger-icon" class="s16"> <span class="gl-pr-2">Menu</span>
  </span>
</button>
```
A duplicate mobile menu tree is rendered at the very end of `<body>` inside
`div.top-nav-responsive.layout-page.content-wrapper-margin` (contains `h1.gl-m-0.gl-font-size-h2…`
with text `Menu`, a `Search` link, `Create new...` with the three GitLab links, and the
`Switch to` rail). Only visible below the `sm` breakpoint.

---

## 1b. Global chrome — left sidebar (project)

### 1b.1 Container & metrics

```html
<div class="layout-page hide-when-top-nav-responsive-open page-with-contextual-sidebar">
  <aside class="nav-sidebar" aria-label="Project navigation">
    <div class="nav-sidebar-inner-scroll">
      <ul class="sidebar-top-level-items" data-qa-selector="project_sidebar"> … </ul>
      <a class="toggle-sidebar-button js-toggle-sidebar rspec-toggle-sidebar"
         role="button" title="Toggle sidebar" type="button">
         <svg …#angle-double-left> <span class="collapse-text gl-ml-3">Collapse sidebar</span></a>
      <button name="button" type="button" class="close-nav-button">
         <svg …#close> <span class="collapse-text gl-ml-3">Close sidebar</span></button>
    </div>
  </aside>
  <div class="content-wrapper content-wrapper-margin"> … </div>
</div>
```

| State | `.nav-sidebar` width | `.layout-page` classes | `.content-wrapper` x/width | `#content-body` x (990-wide page) |
|---|---|---|---|---|
| **expanded** (default) | **256px** | `layout-page hide-when-top-nav-responsive-open page-with-contextual-sidebar` | 256 / 1664 | 609 |
| **collapsed** | **56px** | … + `page-with-icon-sidebar`; `aside` gains `sidebar-collapsed-desktop js-sidebar-collapsed` | 56 / 1864 | 509 |

- `.nav-sidebar` — `position: fixed; top: 48px; z-index: 600; background: rgb(251,250,253)` (`#fbfafd`),
  height = viewport − 48. `.nav-sidebar-inner-scroll` is 255px (1px right border on the aside).
- `.toggle-sidebar-button` is **fixed to the bottom** of the rail: `x 0, width 255, height 48`,
  background `#fbfafd`, `title="Toggle sidebar"`, label `Collapse sidebar` (arrow `«`).
  When collapsed the label is hidden (`.collapse-text` clipped) and the arrow flips.
- `.close-nav-button` (label `Close sidebar`) is the mobile-only variant.
- `.toggle-mobile-nav` in the breadcrumbs bar has sr-only text `Open sidebar` (see §1d).

### 1b.2 Context header (project tile)

```html
<li data-track-label="scope_menu" data-container="body" data-placement="right"
    class="context-header has-tooltip active" title="dotfiles">
  <a aria-label="dotfiles" class="shortcuts-project rspec-project-link gl-link"
     data-qa-selector="sidebar_menu_link" data-qa-menu-item="Project scope"
     href="/byteblaze/dotfiles">
    <span class="avatar-container rect-avatar s32 project_avatar">
      <span class="avatar avatar-tile s32 identicon bg5">D</span>
    </span>
    <span class="sidebar-context-title">dotfiles</span>
  </a>
</li>
```
- `li.context-header` = 256×40 at y 50; the `<a>` is 240 wide, padding `4px`, font-weight 600.
- Tile: 32×32 square (`rect-avatar`, `border-radius: 0`), single uppercase initial of the project
  name, background from the `bgN` palette (dotfiles = `bg5` → `rgb(236,244,238)` on `rgb(51,50,56)`;
  `bg7` → `rgb(236,236,239)`). If the project has a real avatar it is an `<img class="avatar
  avatar-tile s32">` instead.
- `.active` is added only on the project **overview** page; other project pages drop it
  (verified: `proj-dotfiles.html` has `context-header has-tooltip active`,
  `proj-a11yproject-issues.html` has `context-header has-tooltip`).
- `.sidebar-context-title` — 14px/600, x 52.

### 1b.3 Full section list

Every top-level `<li>` carries `data-track-label="<key>_menu"` and its `<a>` carries
`data-qa-selector="sidebar_menu_link"`, `data-qa-menu-item="<Label>"`, `class="… gl-link"`,
`aria-label="<Label>"`, and (when it has a submenu) `has-sub-items`. Structure:

```html
<li data-track-label="issues_menu" class="active">
  <a aria-label="Issues" class="shortcuts-issues has-sub-items gl-link"
     data-qa-selector="sidebar_menu_link" data-qa-menu-item="Issues"
     href="/byteblaze/dotfiles/-/issues">
    <span class="nav-icon-container"><svg data-testid="issues-icon" class="s16">…</svg></span>
    <span class="nav-item-name" id="js-onboarding-issues-link">Issues</span>
    <span class="gl-badge badge badge-pill badge-info sm count issue_counter">0</span>
  </a>
  <ul class="sidebar-sub-level-items">
    <li class="fly-out-top-item"><span class="fly-out-top-item-container">
        <strong class="fly-out-top-item-name">Issues</strong>
        <span class="gl-badge badge badge-pill badge-info sm count fly-out-badge issue_counter">0</span>
    </span></li>
    <li class="divider fly-out-top-item"></li>
    <li data-track-label="issue_list" class="active">
      <a aria-label="Issues" class="gl-link" data-qa-selector="sidebar_menu_item_link"
         data-qa-menu-item="List" href="/byteblaze/dotfiles/-/issues">List</a></li>
    …
  </ul>
</li>
```
The first two `<li>`s of every `.sidebar-sub-level-items` (`.fly-out-top-item` and
`.divider.fly-out-top-item`) are **only** shown in the collapsed-rail fly-out. Menus that have no
real sub-items use `<ul class="sidebar-sub-level-items is-fly-out-only">` (Merge requests, Wiki,
Snippets).

Complete inventory (hrefs shown for `byteblaze/dotfiles`; substitute `<ns>/<proj>`):

| # | Top item (`nav-item-name`) | icon `data-testid` | top href | `data-track-label` | Sub-items → `aria-label` / visible text → href |
|---|---|---|---|---|---|
| 1 | `Project information` (`<li class="home">`, link class `shortcuts-project-information`) | `project-icon` | `/byteblaze/dotfiles/activity` | `project_information_menu` | `Activity` → `/…/activity` (`shortcuts-project-activity`); `Labels` → `/…/-/labels`; `Members` → `/…/-/project_members` (`id="js-onboarding-members-link"`) |
| 2 | `Repository` (`shortcuts-tree`; name span `id="js-onboarding-repo-link"`) | `doc-text-icon` | `/…/-/tree/main` | `repository_menu` | `Files` → `/…/-/tree/main`; `Commits` → `/…/-/commits/main` (`id="js-onboarding-commits-link"`); `Branches` → `/…/-/branches` (`id="js-onboarding-branches-link"`); `Tags` → `/…/-/tags`; `Contributors` → `/…/-/graphs/main`; `Graph` → `/…/-/network/main`; `Compare` → `/…/-/compare?from=main&to=main` |
| 3 | `Issues` + badge (`shortcuts-issues`; name span `id="js-onboarding-issues-link"`) | `issues-icon` | `/…/-/issues` | `issues_menu` | `List` (aria `Issues`) → `/…/-/issues`; `Boards` → `/…/-/boards`; `Service Desk` → `/…/-/issues/service_desk`; `Milestones` → `/…/-/milestones` |
| 4 | `Merge requests` + badge (`shortcuts-merge_requests`; span `id="js-onboarding-mr-link"`) | `git-merge-icon` | `/…/-/merge_requests` | `merge_requests_menu` | *(fly-out only)* |
| 5 | `CI/CD` (`shortcuts-pipelines rspec-link-pipelines`; span `id="js-onboarding-pipelines-link"`) | `rocket-icon` | `/…/-/pipelines` | `ci_cd_menu` | `Pipelines` → `/…/-/pipelines`; `Editor` → `/…/-/ci/editor?branch_name=main`; `Jobs` → `/…/-/jobs` (`shortcuts-builds`); `Schedules` → `/…/-/pipeline_schedules` |
| 6 | `Security & Compliance` | `shield-icon` | `/…/-/security/configuration` | `security_compliance_menu` | `Configuration` → `/…/-/security/configuration` |
| 7 | `Deployments` (`shortcuts-deployments`) | `deployments-icon` | `/…/-/environments` | `deployments_menu` | `Environments` → `/…/-/environments`; `Feature Flags` → `/…/-/feature_flags`; `Releases` → `/…/-/releases` |
| 8 | `Packages and registries` | `package-icon` | `/…/-/packages` | `packages_registries_menu` | `Package Registry` → `/…/-/packages` (`shortcuts-container-registry`); `Infrastructure Registry` → `/…/-/infrastructure_registry` |
| 9 | `Infrastructure` (`shortcuts-infrastructure`) | `cloud-gear-icon` | `/…/-/clusters` | `infrastructure_menu` | `Kubernetes clusters` → `/…/-/clusters`; `Terraform` → `/…/-/terraform`; `Google Cloud` → `/…/-/google_cloud/configuration` |
| 10 | `Monitor` (`shortcuts-monitor`) | `monitor-icon` | `/…/-/metrics` | `monitor_menu` | `Metrics` → `/…/-/metrics`; `Error Tracking` → `/…/-/error_tracking`; `Alerts` → `/…/-/alert_management`; `Incidents` → `/…/-/incidents` |
| 11 | `Analytics` (`shortcuts-analytics`) | `chart-icon` | `/…/-/value_stream_analytics` | `analytics_menu` | `Value stream` → `/…/-/value_stream_analytics`; `CI/CD` → `/…/-/pipelines/charts`; `Repository` → `/…/-/graphs/main/charts` |
| 12 | `Wiki` (`shortcuts-wiki`) | `book-icon` | `/…/-/wikis/home` | `wiki_menu` | *(fly-out only)* |
| 13 | `Snippets` (`shortcuts-snippets`) | `snippet-icon` | `/…/-/snippets` | `snippets_menu` | *(fly-out only)* |
| 14 | `Settings` (span `id="js-onboarding-settings-link"`) | `settings-icon` | `/…/edit` | `settings_menu` | `General` → `/…/edit`; `Integrations` → `/…/-/settings/integrations`; `Webhooks` → `/…/-/hooks`; `Access Tokens` → `/…/-/settings/access_tokens`; `Repository` → `/…/-/settings/repository`; `Merge requests` → `/…/-/settings/merge_requests`; `CI/CD` → `/…/-/settings/ci_cd`; `Packages and registries` → `/…/-/settings/packages_and_registries`; `Monitor` → `/…/-/settings/operations`; `Usage Quotas` → `/…/-/usage_quotas` |

`Security & Compliance` is written in the DOM as `Security &amp; Compliance` — visible text is
`Security & Compliance` with a real ampersand.

**Counter badges.** `Issues` and `Merge requests` each render
`<span class="gl-badge badge badge-pill badge-info sm count issue_counter">` /
`… count merge_counter js-merge-counter">`, plus a duplicate inside the fly-out header with the
extra class `fly-out-badge`. Observed values: `byteblaze/dotfiles` → `0` / `0`;
`a11yproject/a11yproject.com` → `40` / `10`. These are the **open** counts.

**Hidden shortcut links** (rendered as the last six `<li class="hidden">` of
`.sidebar-top-level-items`, before the toggle button):

| class | `aria-label` / text | href |
|---|---|---|
| `shortcuts-project-activity` | `Activity` | `/byteblaze/dotfiles/activity` |
| `shortcuts-network` | `Graph` | `/byteblaze/dotfiles/-/network/main` |
| `shortcuts-new-issue` | `Create a new issue` | `/byteblaze/dotfiles/-/issues/new` |
| `shortcuts-builds` | `Jobs` | `/byteblaze/dotfiles/-/jobs` |
| `shortcuts-commits` | `Commits` | `/byteblaze/dotfiles/-/commits/main` |
| `shortcuts-issue-boards` | `Issue Boards` | `/byteblaze/dotfiles/-/boards` |

### 1b.4 Item styling / active state

| Selector | box | style |
|---|---|---|
| `.sidebar-top-level-items > li > a` | x 8, w 239, h 32, padding `8px 12px`, radius 4px | 14px/400, colour `rgb(51,50,56)` |
| `.nav-icon-container` | 16×16 at x 20 | icon slot |
| `.sidebar-top-level-items > li.active > a` | same box | **font-weight 600**, transparent background (the highlight is a left indicator bar) |
| `.sidebar-sub-level-items > li > a` | padding `8px 12px 8px 36px`, radius 4px | 14px/400 |
| `.sidebar-sub-level-items > li.active > a` | same | **font-weight 600**, `background: rgba(31,30,36,0.08)` |
| `.sidebar-sub-level-items` (expanded) | w 255 | only rendered open under the active top item |

Active-state rule: the top-level `<li>` matching the current section gets `class="active"`; its
`<ul class="sidebar-sub-level-items">` is expanded; the matching sub `<li>` gets `class="active"`;
the fly-out header `<li class="fly-out-top-item active">` also gets it.

### 1b.5 A11y strings to reproduce verbatim

`Project navigation` (aside aria-label) · `Toggle sidebar` (title) · `Collapse sidebar` ·
`Close sidebar` · `Open sidebar` · `Menu` (`data-qa-title` on the navbar dropdown and the
responsive `h1`) · `Toggle navigation` (sr-only on `.navbar-toggler`).

---

## 1c. Global chrome — left sidebar (group) and dashboard (no sidebar)

### 1c.1 Group sidebar

`<aside class="nav-sidebar" aria-label="Group navigation">` with
`<ul class="sidebar-top-level-items" data-qa-selector="group_sidebar">`.
Same geometry, same toggle button, same fly-out mechanics as the project sidebar.
Only one real group exists in the seed: **`robert1003`** at `/robert1003`
(`/coding_friends`, `/crew`, `/n-lab`, `/webagent`, `/x-lab` do **not** exist yet — those are
create-a-group task targets, and their `/groups/<name>/-/group_members` routes are anchors).
**`primer` and `a11yproject` are USERS, not groups** — `/primer` renders a user profile page
(no left sidebar at all).

Context header:
```html
<li data-track-label="scope_menu" class="context-header has-tooltip active" title="robert1003">
  <a aria-label="robert1003" class="gl-link" data-qa-selector="sidebar_menu_link"
     data-qa-menu-item="Group scope" href="/robert1003">
    <span class="avatar-container rect-avatar s32 group_avatar">
      <span class="avatar avatar-tile s32 identicon bg7">R</span></span>
    <span class="sidebar-context-title">robert1003</span></a></li>
```
(`project_avatar` → `group_avatar` is the only tile difference.)

Sections — **four** only:

| # | Top item | top href | `data-track-label` | Sub-items |
|---|---|---|---|---|
| 1 | `Group information` (`has-sub-items`, `data-qa-menu-item="Group information"`) | `/groups/robert1003/-/activity` | `group_information_menu` | `Activity` → `/groups/<g>/-/activity`; `Labels` → `/groups/<g>/-/labels`; `Members` → `/groups/<g>/-/group_members` |
| 2 | `Issues` + `issue_counter` badge (`1`) | `/groups/robert1003/-/issues` | `issues_menu` | `List` (aria `Issues`) → `/groups/<g>/-/issues`; `Board` → `/groups/<g>/-/boards`; `Milestones` → `/groups/<g>/-/milestones` |
| 3 | `Merge requests` + `merge_counter js-merge-counter` badge (`0`) | `/groups/robert1003/-/merge_requests` | `merge_requests_menu` | *(fly-out only)* |
| 4 | `Packages and registries` | `/groups/robert1003/-/packages` | `packages_registries_menu` | `Package Registry` → `/groups/<g>/-/packages` |

Note the group Issues sub-item is `Board` (singular), unlike the project's `Boards`.
Group URLs are namespaced under `/groups/<name>/-/…`, while the group landing page is
`/<name>` (no `/groups` prefix). `<title>` is `robert1003 · GitLab`.
Sidebar innerText renders as:
```
R
robert1003
Group information
Issues
1
Merge requests
0
Packages and registries
Collapse sidebar
```

Breadcrumbs on a group page are a single item:
`ul.breadcrumbs-list > li > a.group-path.breadcrumb-item-text.js-breadcrumb-item-text[href="/robert1003"]`
→ `robert1003`, followed by the `chevron-lg-right` separator svg.

### 1c.2 Dashboard / explore / profile pages — NO left sidebar

`/dashboard/*`, `/explore*`, `/-/profile*`, `/projects/new`, `/groups/new`, `/search`,
`/users/<u>/*` and the user profile `/<username>` render:

```html
<div class="layout-page hide-when-top-nav-responsive-open">   <!-- no page-with-contextual-sidebar -->
  <div class="content-wrapper">
    <div class="mobile-overlay"></div>
    <div class="alert-wrapper gl-force-block-formatting-context"> … </div>
    <div class="container-fluid container-limited ">
      <main class="content" id="content-body">
        <div class="flash-container flash-container-page sticky" data-qa-selector="flash_container"></div>
        <div class="page-title-holder d-flex align-items-center">
          <h1 class="page-title gl-font-size-h-display">Projects</h1>
          <div class="page-title-controls"> … </div>
        </div>
        …
```

- **No `<aside class="nav-sidebar">` and no `<nav class="breadcrumbs">` at all.**
- `.content-wrapper` spans the full 1920. `.container-fluid.container-limited` = **1280px**
  centred at x 320; `#content-body` = **1248px at x 336** (1280 − 2×16 padding).
- Page heading lives in `.page-title-holder.d-flex.align-items-center` with
  `h1.page-title.gl-font-size-h-display` (e.g. `Projects`, `Issues`, `To-Do List`) and an
  optional `.page-title-controls` on the right holding the primary action button
  (e.g. `a[data-qa-selector="new_project_button"].btn.btn-confirm` → `New project`).
- (ANCHOR) `document.querySelector("#content-body").outerText` is used by webarena-590…593 —
  `#content-body` must exist on every page with the right id.
- Exception: the **user profile** page `/byteblaze` uses an unlimited container —
  `#content-body` measured at x 0, width 1920.

### 1c.3 Container-width rule (applies to §1b pages too)

`.container-fluid.container-limited` has `max-width: 1280px`; adding `limit-container-width`
narrows it to `990px`. Both are centred in the space left of the right sidebar (if any).
Measured at 1920×1080:

| Route | `.breadcrumbs` classes | breadcrumbs x/w | `#content-body` x/w |
|---|---|---|---|
| `/byteblaze/dotfiles` | `breadcrumbs container-fluid container-limited container-limited limit-container-width project-highlight-puc` | 593 / 990 | 609 / 958 |
| `/byteblaze/dotfiles/-/tree/main` | `… container-limited limit-container-width project-highlight-puc` | 593 / 990 | 609 / 958 |
| `/byteblaze/dotfiles/-/blob/main/LICENSE` | same | 593 / 990 | 609 / 958 |
| `/byteblaze/dotfiles/-/issues` | `… container-limited project-highlight-puc` | 448 / 1280 | 464 / 1248 |
| `/byteblaze/dotfiles/-/milestones` | `… container-limited project-highlight-puc` | 448 / 1280 | 464 / 1248 |
| `/byteblaze/dotfiles/-/project_members` | `… container-limited project-highlight-puc` | 448 / 1280 | 464 / 1248 |
| `/a11yproject/a11yproject.com/-/issues/719` | `… container-limited limit-container-width project-highlight-puc` | 448 / 990 | 464 / 958 |
| `/primer/design/-/merge_requests/450` | `… container-limited merge-request-container limit-container-width project-highlight-puc` | 448 / 990 | 464 / 958 |
| `/dashboard/projects`, `/dashboard/issues`, `/explore` | *(no breadcrumbs)* | — | 336 / 1248 |
| `/byteblaze` (profile) | *(no breadcrumbs)* | — | 0 / 1920 |

Rule of thumb: **detail/overview/repo views are 990-wide (`limit-container-width`); list views
are 1280-wide.** Issue/MR detail pages sit at x 448 because the 290px `.right-sidebar` shrinks
the centring area to 256…1630.

---

## 1d. Global chrome — breadcrumbs, page title area, footer, shared components

### 1d.1 Breadcrumbs bar

Rendered by `layouts/nav/_breadcrumbs.html.haml`, immediately after `.alert-wrapper` and
immediately before the content `.container-fluid`:

```html
<nav aria-label="Breadcrumbs"
     class="breadcrumbs container-fluid container-limited [limit-container-width] project-highlight-puc">
  <div class="breadcrumbs-container">                     <!-- add border-bottom-0 on MR pages -->
    <button name="button" type="button" class="toggle-mobile-nav"
            data-qa-selector="toggle_mobile_nav_button">
      <span class="sr-only">Open sidebar</span>
      <svg class="s18" data-testid="sidebar-icon">…#sidebar</svg>
    </button>
    <div class="breadcrumbs-links" data-testid="breadcrumb-links"
         data-qa-selector="breadcrumb_links_content">
      <ul class="list-unstyled breadcrumbs-list js-breadcrumbs-list">
        <li><a href="/byteblaze">Byte Blaze</a></li>
        <li><a href="/byteblaze/dotfiles">
              <span class="breadcrumb-item-text js-breadcrumb-item-text">dotfiles</span></a></li>
        <li data-qa-selector="breadcrumb_current_link" data-testid="breadcrumb-current-link">
          <a href="/byteblaze/dotfiles/-/issues">Issues</a></li>
      </ul>
    </div>
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"BreadcrumbList",
      "itemListElement":[{"@type":"ListItem","position":1,"name":"…","item":"http://localhost:8023/…"}]}</script>
  </div>
</nav>
```

- Geometry: height **48px**; `.breadcrumbs-container` is `width − 32` (958 on a 990 bar,
  1248 on a 1280 bar), `position: relative`, `border-bottom: 1px solid rgb(220,220,222)`.
  `.breadcrumbs-list` is 20px tall, vertically centred (y = bar top + 14).
- Link colour `rgb(115,114,120)` (`#737278`), **font-size 12px**. The last item is styled the
  same (no bold).
- Separator: `<svg class="s8 breadcrumbs-list-angle" data-testid="chevron-lg-right-icon">`
  emitted **after** each item that has one (present on group breadcrumbs; on project
  breadcrumbs the separator is drawn by CSS `::after` on `li`).
- `.breadcrumbs-container.border-bottom-0` on MR detail pages (`@no_breadcrumb_border`).

**Observed breadcrumb trails (verbatim):**

| Page | Items (text → href) |
|---|---|
| `/byteblaze/dotfiles` | `Byte Blaze` → `/byteblaze` · `dotfiles` → `/byteblaze/dotfiles` |
| `/a11yproject/a11yproject.com` | `The A11Y Project` → `/a11yproject` · `a11yproject.com` → `/a11yproject/a11yproject.com` |
| `/byteblaze/dotfiles/-/issues` | `Byte Blaze` · `dotfiles` · **`Issues`** → `/byteblaze/dotfiles/-/issues` |
| `/byteblaze/dotfiles/-/labels` | `Byte Blaze` · `dotfiles` · `Labels` → `…/-/labels` |
| `/byteblaze/dotfiles/-/project_members` | `Byte Blaze` · `dotfiles` · `Members` → `…/-/project_members` |
| `/byteblaze/dotfiles/-/tree/main` and `…/-/blob/main/LICENSE` | `Byte Blaze` · `dotfiles` · `Repository` → `…/-/tree/main` |
| `/primer/design/-/milestones` | `Primer` → `/primer` · `design` → `/primer/design` · `Milestones` → `/primer/design/-/milestones` |
| `/byteblaze/dotfiles/-/issues/new` | `Byte Blaze` · `dotfiles` · `Issues` · `New` → `…/-/issues/new` |
| `/a11yproject/a11yproject.com/-/issues/719` | `The A11Y Project` · `a11yproject.com` · `Issues` · **`#719`** → `…/-/issues/719` |
| `/primer/design/-/merge_requests/450` | `Primer` · `design` · `Merge requests` · **`!450`** → `…/-/merge_requests/450` |
| `/robert1003` (group) | `robert1003` → `/robert1003` (single `a.group-path.breadcrumb-item-text.js-breadcrumb-item-text`) |

Shape is therefore **`Namespace / project [/ Section [/ #id]]`**; the namespace uses the
**display name** (`Byte Blaze`, `The A11Y Project`, `Primer`) but the href uses the path
(`/byteblaze`, `/a11yproject`, `/primer`). Only the middle (project) item wraps its text in
`span.breadcrumb-item-text.js-breadcrumb-item-text`. The last `<li>` always carries
`data-qa-selector="breadcrumb_current_link"` / `data-testid="breadcrumb-current-link"`
(except on the project-overview page, where the project *is* the last item and no
`breadcrumb-current-link` is emitted).

**`.breadcrumbs-sub-title` does not exist in GitLab 15.7.5** — it is a legacy class; nothing in
the 68 captured pages or in `_breadcrumbs.html.haml` emits it. Do not implement it.
The classes an evaluator can realistically target are `.breadcrumbs`, `.breadcrumbs-container`,
`.breadcrumbs-links`, `.breadcrumbs-list`, `.js-breadcrumbs-list`, `.breadcrumb-item-text`,
`.js-breadcrumb-item-text`, `[data-testid="breadcrumb-links"]`,
`[data-testid="breadcrumb-current-link"]`.
Note `.title` is a **navbar** class (the logo wrapper), not a breadcrumbs class.

### 1d.2 Page title area / alerts / flash

Order inside `.content-wrapper`:

```
.mobile-overlay
.alert-wrapper.gl-force-block-formatting-context      ← dismissible page-level banners
<nav class="breadcrumbs …">                            ← only when a left sidebar exists
.container-fluid.container-limited[.limit-container-width]
  <main class="content" id="content-body">
    .flash-container.flash-container-page.sticky[data-qa-selector="flash_container"]
    .page-title-holder.d-flex.align-items-center  >  h1.page-title.gl-font-size-h-display
                                                     + .page-title-controls
    … page body …
```

**`.alert-wrapper` banners** seen on `/byteblaze/dotfiles` (two, both dismissible via
`button.btn.gl-dismiss-btn.…​.btn-icon.js-close[aria-label="Dismiss"]`):

1. `div.gl-alert.js-no-ssh-message.gl-alert-warning` →
   `You can't push or pull repositories using SSH until you add an SSH key to your profile.`
   Actions: `a.gl-alert-action.btn.btn-confirm.btn-md.gl-button[href="/-/profile/keys"]` →
   `Add SSH key`; `a.gl-alert-action.btn.btn-default.btn-md.gl-button[href="/-/profile?user%5Bhide_no_ssh_key%5D=true"]`
   → `Don't show again`. Dismiss class `js-hide-no-ssh-message`.
2. `div.gl-alert.auto-devops-implicitly-enabled-banner.gl-alert-info[data-qa-selector="auto_devops_banner_content"]` →
   `The Auto DevOps pipeline has been enabled and will be used if no alternative CI configuration file is found.`
   then `Container registry is not enabled on this GitLab instance. Ask an administrator to enable it in order for Auto DevOps to work.`
   Actions: `a.alert-link.btn.gl-button.btn-confirm[href="/byteblaze/dotfiles/-/settings/ci_cd"]` → `Settings`;
   `a.alert-link.btn.gl-button.btn-default.gl-ml-3[href="/help/topics/autodevops/index.md"]` → `More information`.
   Dismiss class `hide-auto-devops-implicitly-enabled-banner`.

Both are visible in `proj-dotfiles.png` and push the breadcrumbs down to y ≈ 268.

**Flash / toast** — `layouts/_flash.html.haml`:
```
.flash-container.flash-container-page.sticky{ data: { qa_selector: 'flash_container' } }
```
is rendered (usually empty) as the **first child of `#content-body`** on every page. Message
mapping:

| flash key | rendered as |
|---|---|
| `alert` | `Pajamas::AlertComponent` variant **danger**, dismissible, `class="flash-alert"`, `data-testid="alert-danger"` |
| `notice` | variant **info**, dismissible, `class="flash-notice"`, `data-testid="alert-info"` |
| `success` | variant **success**, dismissible, `class="flash-success"`, `data-testid="alert-success"` |
| `warning` | variant **warning**, *not* dismissible, `class="flash-warning"`, `data-testid="alert-warning"` |
| `toast` | `<div class="js-toast-message" data-message="…">` — JS picks it up and shows a GitLab-UI toast (`.gl-toast`) |
| `raw` | raw HTML |

Alert markup is `div.gl-alert.gl-alert-<variant>` > optional
`button.btn.gl-dismiss-btn.btn-default.btn-sm.gl-button.btn-default-tertiary.btn-icon[aria-label="Dismiss"]`
+ `div.gl-alert-content > div.gl-alert-body` (+ optional `div.gl-alert-actions`).
No `.gl-toast` instance was observable read-only (all toast triggers are mutations); implement it
as a bottom-left floating `.gl-toast` if you need one.

### 1d.3 Footer

**There is no footer.** `document.querySelector('footer')` returns `null` on every page
(verified live on `/byteblaze/dotfiles`). The document ends with the responsive
`div.top-nav-responsive.layout-page.content-wrapper-margin` block and script tags. Do not add one.

### 1d.4 Shared component vocabulary (implement once, reuse everywhere)

**Dropdowns.** GitLab 15.7 ships two flavours; both appear in the chrome.

*a) Bootstrap-style (used by the navbar `+`, MR counter, `?`, avatar):*
```
li.dropdown  >  a[data-toggle="dropdown"]  +  div.dropdown-menu.dropdown-menu-right[.dropdown-extended-height]
                                                  > ul > li[.dropdown-header|.dropdown-bold-header|.divider] > a|button
```
`li.dropdown-header` = grey uppercase-ish section label; `li.dropdown-bold-header` = bold section
label; `li.divider` = 1px separator.

*b) GitLab-UI / BootstrapVue (`.gl-dropdown`) — used everywhere in page bodies:*
```html
<div class="dropdown b-dropdown gl-dropdown btn-group" data-testid="…" id="__BVID__n">
  <button aria-haspopup="true" aria-expanded="false" id="__BVID__n__BV_toggle_"
          class="btn dropdown-toggle btn-default btn-md gl-button gl-dropdown-toggle
                 [dropdown-icon-only]">
     <svg …> <span class="gl-dropdown-button-text">Label</span> <svg …#chevron-down>
  </button>
  <ul role="menu" tabindex="-1" class="dropdown-menu" aria-labelledby="__BVID__n__BV_toggle_">
    <div class="gl-dropdown-inner">
      <div class="gl-dropdown-contents">
        <li role="presentation" class="gl-dropdown-section-header">
            <header role="heading" class="dropdown-header">Section</header></li>
        <li role="presentation" class="gl-dropdown-item is-active">
          <button role="menuitem" class="dropdown-item">
            <svg …#mobile-issue-close>
            <div class="gl-dropdown-item-text-wrapper">
              <p class="gl-dropdown-item-text-primary">…</p>
              <p class="gl-dropdown-item-text-secondary">…</p>
            </div>
          </button></li>
      </div>
    </div>
  </ul>
</div>
```
Selected rows get `.gl-dropdown-item.is-active` and show a check icon.
Also `.gl-dropdown-toggle.dropdown-toggle-split` for split buttons and
`.gl-new-dropdown` — **note: `.gl-new-dropdown` does not exist in 15.7.5** (zero occurrences in
the captured DOM). Use `.gl-dropdown` + `.dropdown-menu` + `.dropdown-header`.

**Buttons.** `class="btn <variant> <size> gl-button [btn-icon] [btn-<variant>-tertiary]"`.

| Class | background | text | border | notes |
|---|---|---|---|---|
| `.btn.btn-confirm.btn-md.gl-button` | `rgb(31,117,203)` `#1f75cb` | `#fff` | none | primary CTA |
| `.btn.btn-default.btn-md.gl-button` | `#fff` | `rgb(51,50,56)` | `1px solid rgb(220,220,222)` | secondary |
| `.btn.btn-danger.btn-md.gl-button` | `rgb(221,43,14)` `#dd2b0e` | `#fff` | `rgb(201,28,0)` | destructive |
| `.btn-md` | — | — | — | height **32px**, padding `8px 12px`, radius 4px, 14px/400 |
| `.btn-sm` | — | — | — | height **24px**, padding `4px 8px` |
| `.gl-button.btn-icon` | — | `rgb(83,81,88)` | — | square, padding `8px`, 32×32 |
| `…-tertiary` (`btn-default-tertiary`) | transparent | — | none | text-only/ghost |
| `.btn-link.menu-item` | — | — | — | dropdown-item shaped button |

**Badges.** `span.gl-badge.badge.badge-pill.badge-<variant>.<size>` — `sm` = 16px tall,
padding `0 8px`; `md` = 24px tall, padding `4px 8px`. Always 12px / weight 400 /
`border-radius: 160px`.

| variant | background | colour |
|---|---|---|
| `badge-info` | `rgb(203,226,249)` `#cbe2f9` | `rgb(11,92,173)` `#0b5cad` |
| `badge-success` | `rgb(195,230,205)` `#c3e6cd` | `rgb(36,102,59)` `#24663b` |
| `badge-warning` | `rgb(245,217,168)` `#f5d9a8` | `rgb(143,71,0)` `#8f4700` |
| `badge-danger` | `rgb(253,212,205)` `#fdd4cd` | `rgb(174,24,0)` `#ae1800` |
| `badge-muted` | `rgb(236,236,239)` `#ececef` | `rgb(98,97,104)` `#626168` |
| `badge-neutral` | `rgb(220,220,222)` `#dcdcde` | `rgb(83,81,88)` `#535158` |

Extra badge modifiers used by chrome: `.count`, `.issue_counter`, `.merge_counter`,
`.js-merge-counter`, `.fly-out-badge`, `.js-todos-count`, `.js-merge-requests-count`,
`.js-assigned-mr-count`, `.js-reviewer-mr-count`, `.js-whats-new-notification-count`,
`.gl-tab-counter-badge`, `.badge-tier`.

**Tabs.** Two idioms coexist:

*a) GitLab-UI tabs* (issue/MR state filters, markdown Write/Preview):
```html
<ul class="issues-state-filters gl-border-b-0 gl-flex-grow-1 nav gl-tabs-nav">
  <li class="nav-item">
    <a id="state-opened" class="nav-link gl-tab-nav-item active gl-tab-nav-item-active"
       title="Filter by issues that are currently open." data-state="opened"
       href="/dashboard/issues?assignee_username=byteblaze&scope=all&state=opened">
      <span>Open</span>
      <span class="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge
                   gl-display-none gl-sm-display-inline-flex">13</span></a></li>
  <li class="nav-item"><a id="state-closed" data-qa-selector="closed_issues_link"
       class="nav-link gl-tab-nav-item" …>Closed <span class="…gl-tab-counter-badge">53</span></a></li>
  <li class="nav-item"><a id="state-all" class="nav-link gl-tab-nav-item" …>All …</a></li>
</ul>
```
Active tab = `.nav-link.gl-tab-nav-item.active.gl-tab-nav-item-active`, font-weight 600,
padding `16px 12px`, height 48, with an accent underline.
Wrapper for BootstrapVue variants: `div.tabs.gl-tabs > div > ul[role=tablist].nav.gl-tabs-nav`.

*b) Legacy `nav-links`* (dashboard activity filters):
```html
<ul class="nav-links event-filter scrolling-tabs nav nav-tabs is-initialized">
  <li class="active"><a class="event-filter-link" id="all_event_filter"
      title="Filter by all" href="/dashboard/activity"><span> All</span></a></li>
  <li><a class="event-filter-link" id="push_event_filter" title="Filter by push events" …><span> Push events</span></a></li>
  …
</ul>
```
Here the **`<li>`** gets `.active`, not the `<a>`. Both forms must exist.

**Pagination.**
```html
<div class="gl-pagination gl-mt-3">
  <ul class="pagination justify-content-center">
    <li class="page-item js-previous-button disabled">
      <a rel="prev" class="page-link" href="#"><svg …#chevron-lg-left> Prev</a></li>
    <li class="page-item js-pagination-page active js-first-button">
      <a class="page-link active" href="/a11yproject/a11yproject.com/-/labels">1</a></li>
    <li class="page-item js-pagination-page sibling js-last-button d-none d-md-block">
      <a rel="next" class="page-link" href="/a11yproject/a11yproject.com/-/labels?page=2">2</a></li>
    <li class="page-item js-next-button">
      <a rel="next" class="page-link" href="…?page=2">Next <svg …#chevron-lg-right></a></li>
  </ul>
</div>
```
Labels are exactly `Prev` and `Next`. Disabled edges get `li.page-item.disabled` + `href="#"`.
Some lists render only the `Next` item (e.g. `/explore` →
`<li class="page-item next"><a rel="next" class="page-link" href="/explore/projects?non_archived=true&page=2&sort=name_asc">Next</a></li>`).
The paging query param is `?page=N`, appended to the existing query string.

**Avatars.** Two families:

| Family | markup | shape |
|---|---|---|
| Image | `<img class="gl-avatar gl-avatar-sNN gl-avatar-circle" src="https://www.gravatar.com/avatar/<md5>?s=<2×NN>&d=identicon" alt="…">` | circle, `border: 1px solid rgba(31,30,36,0.08)` |
| Identicon tile | `<span class="avatar-container rect-avatar sNN project_avatar\|group_avatar"><span class="avatar avatar-tile sNN identicon bgN">D</span></span>` | square (`border-radius: 0`), first letter of the name |

Sizes in use: **s16, s24, s32, s40, s64, s96** (`gl-avatar-s16` … / `.avatar.s32` …).
`s24` → 24×24, `s32` → 32×32, `s64` → 64×64 (project home panel), `s96` → profile header.
Identicon palette classes `bg1`…`bg7` (observed: `bg5` = `rgb(236,244,238)` mint,
`bg7` = `rgb(236,236,239)` grey); text colour always `rgb(51,50,56)`.
Legacy classes `.avatar`, `.avatar-circle`, `.avatar-tile`, `.avatar-container`, `.rect-avatar`
all appear and are worth reproducing.

**Modals.**
```html
<div id="<name>-modal" role="dialog" aria-label="…" aria-modal="true"
     class="modal fade show gl-modal" style="display:block">
  <div class="modal-dialog [modal-lg|modal-sm]">
    <span tabindex="0"></span>
    <div class="modal-content" tabindex="-1">
      <header class="modal-header">
        <h4 class="modal-title">Keyboard shortcuts</h4>
        <button aria-label="Close" type="button"
                class="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon"></button>
      </header>
      <div class="modal-body"> … </div>
      <footer class="modal-footer"> … </footer>
    </div>
  </div>
</div>
```
Backdrop is `div.modal-backdrop.fade.show`. Note GitLab renders the header as `<header>` and the
footer as `<footer>` (still classed `.modal-header` / `.modal-footer`).

**Relative time.** Two variants, both with a `title` tooltip in
`MMM D, YYYY h:mma TZ` form (timezone abbreviation is the *server*'s — `PDT`/`PST`, and `UTC`
in some server-rendered spots):

| Where | markup | example |
|---|---|---|
| Server-rendered lists (issues, MRs, dashboards) | `<time class="js-timeago" title="Mar 27, 2023 1:16pm PDT" datetime="2023-03-27T20:16:17Z" data-toggle="tooltip" data-placement="bottom" data-container="body">3 years ago</time>` | `9 years ago`, `3 years ago` |
| Vue-rendered (repo tree, project home, issue notes) | `<time title="Nov 3, 2019 2:34pm PST" datetime="2019-11-03T17:34:32.000-05:00" class="">6 years ago</time>` (no `js-timeago`; sometimes `data-v-…`) | `6 years ago` |

`data-placement` is `bottom` in most lists and `top` in a few (`explore.html`, issue headers).
The visible text is always the humanised `N <unit> ago` form; the absolute `Mar 27, 2023` form
appears in *content* (milestone dates, "Member since March 27, 2023"), not in `<time>` text.
`datetime` is either a `Z`-suffixed ISO string or an offset ISO string with milliseconds —
both forms occur; either is fine as long as the visible text and `title` match.

**Other chrome hooks worth reproducing verbatim:**
`.gl-search-box-by-type` / `.gl-search-box-by-type-input` / `.gl-search-box-by-type-search-icon`
(every search field), `.gl-alert` + `.gl-alert-<variant>` + `.gl-alert-body` + `.gl-alert-actions`,
`.gl-toggle` + `[role=switch][aria-checked]`, `.gl-drawer` + `.gl-drawer-header/-body/-title`,
`kbd.flat.float-right`, `.gl-icon.s16` / `.s18` / `.s8` for sprite icons
(`<svg class="s16" data-testid="<name>-icon"><use href="/assets/icons-<digest>.svg#<name>"></use></svg>`).
Icon names used in the chrome: `hamburger`, `project`, `group`, `chevron-right`, `chevron-down`,
`chevron-lg-right`, `chevron-lg-left`, `clock`, `snippet`, `history`, `search`, `plus-square`,
`issues`, `git-merge`, `todo-done`, `question-o`, `close`, `sidebar`, `doc-text`, `rocket`,
`shield`, `deployments`, `package`, `cloud-gear`, `monitor`, `chart`, `book`, `settings`.

---

All routes in this part render the **dashboard chrome**: fixed top navbar only, **no left
project sidebar**. Measured live @1920x1080 on every one of the 8 pages in this part:

| Element | x | width |
|---|---|---|
| `.navbar-gitlab` (fixed top bar) | 0 | 1920 |
| `.container-fluid.container-limited` | 320 | 1280 |
| `main.content#content-body` | **336** | **1248** |

DOM skeleton shared by every page here:

```html
<div class="layout-page hide-when-top-nav-responsive-open">
  <div class="content-wrapper content-wrapper-margin">
    <div class="mobile-overlay"></div>
    <div class="alert-wrapper gl-force-block-formatting-context">
      <div class="container-fluid container-limited ">
        <main class="content" id="content-body">
          <div class="flash-container flash-container-page sticky" data-qa-selector="flash_container"></div>
          <div class="page-title-holder d-flex align-items-center">
            <h1 class="page-title gl-font-size-h-display">…</h1>
            <div class="page-title-controls">…</div>   <!-- optional -->
          </div>
          <div class="top-area">
            <ul class="… nav gl-tabs-nav">…tabs…</ul>
            <div class="nav-controls">…search / sort / buttons…</div>
          </div>
          …page body…
```

`body { font-size: 14px; background: #fff }`. `h1.page-title.gl-font-size-h-display` renders
at ~32px/700 in the screenshots.

### Relative-time format (applies to every page in this part)

GitLab emits a server-rendered absolute string inside `<time class="js-timeago">` and a
front-end script rewrites the text to a relative phrase on load:

```html
<time class="js-timeago"
      title="Mar 27, 2023 4:22pm PDT"
      datetime="2023-03-27T23:22:59Z"
      data-toggle="tooltip" data-placement="top" data-container="body">3 years ago</time>
```

* **Visible text**: `3 years ago` (every seeded record in this part is `3 years ago`;
  the seed timestamps are all Mar–Apr 2023 and the reference capture is 2026).
* **`title=` tooltip**: `Mmm D, YYYY h:mmam|pm PDT` — e.g. `Mar 27, 2023 4:22pm PDT`,
  `Mar 27, 2023 1:15pm PDT`, `Apr 24, 2023 2:22pm PDT`. Timezone suffix is always `PDT`
  for these seeds. No leading zero on day-of-month or hour; am/pm lowercase, no space.
* **`datetime=`**: ISO-8601 Zulu, e.g. `2023-03-27T23:22:59Z`.
* Milestones do **not** use `js-timeago` — they print a plain absolute date
  (`expired on Dec 31, 2019`, `expired on Jan 14, 2014`).

---

## 2. `/` and `/dashboard/projects` — project list

### 2.1 Routes and title

| Route | `<title>` | `body[data-page]` | Notes |
|---|---|---|---|
| `/` | `Projects · Dashboard · GitLab` | `root:index` | **No redirect** — `/` stays `/` |
| `/dashboard/projects` | `Projects · Dashboard · GitLab` | `dashboard:projects:index` | byte-for-byte the same rendered list |

`/` and `/dashboard/projects` render **identical** page bodies (same h1, same tabs, same
sub-tabs, same 14 rows, same order). The **only** difference is that all self-referential
query links are built against the current path: on `/` the sort links are `/?sort=…`, on
`/dashboard/projects` they are `/dashboard/projects?sort=…`.

Query-string variants that resolve (all on either base path):

| Query | Effect |
|---|---|
| `?sort=name_asc` (default) | A→Z by project name |
| `?sort=name_desc` | Z→A |
| `?sort=latest_activity_desc` | most-recently-updated first |
| `?sort=latest_activity_asc` | oldest updated first |
| `?sort=created_desc` | newest created first |
| `?sort=created_asc` | oldest created first |
| `?sort=stars_desc` | most stars first → order: `a11yproject.com, design, millennials-to-snake-people, empathy-prompts, a11y-webring.club, ericwbailey.website, accessible-html-content-patterns, a11y-syntax-highlighting, cloud-to-butt, dotfiles, gimmiethat.space, remove-board-…, solarized-prism-theme, timeit` |
| `?personal=true&sort=name_asc` | "Personal" sub-tab → **12** rows (drops `The A11Y Project / a11yproject.com` and `Primer / design`) |
| `?archived=true&sort=name_asc` | show archived too (none seeded → same 14) |
| `?archived=only&sort=name_asc` | archived only (none seeded → empty state) |
| `?name=<q>` | name filter (form GET). Live it submits `?sort=<current>&name=<q>&sort=<current>` — duplicate `sort` is harmless; the mock should accept `?name=` alone. |

**Sort persistence (important):** GitLab stores the chosen sort in the user preference
`projects_sort`, so once you visit `?sort=stars_desc` a later bare visit to `/` still
renders `Most stars` in the dropdown toggle and the hidden `#sort` input. The reference
snapshot state is `name_asc`. A mock may keep this in memory/localStorage or simply
ignore persistence; the *default* must be `name_asc` / toggle label `Name`.

### 2.2 Page header

```html
<div class="page-title-holder d-flex align-items-center">
  <h1 class="page-title gl-font-size-h-display">Projects</h1>
  <div class="page-title-controls">
    <a class="gl-button btn btn-md btn-confirm " data-qa-selector="new_project_button"
       href="/projects/new"><span class="gl-button-text">New project</span></a>
  </div>
</div>
```

* h1 text: `Projects` (identical on `/`, `/dashboard/projects`, `/dashboard/projects/starred`).
* Button label: `New project`, blue/confirm, right-aligned, → `/projects/new`.
  `data-qa-selector="new_project_button"`.

### 2.3 Tab strip — VERIFIED LABELS

The brief's guess (`Your projects` / `Starred projects` / `Explore projects`) is **wrong**.
The actual labels in 15.7.5 (`dashboard/_projects_nav.html.haml`) are:

| Order | Label (verbatim) | Counter badge | href | Active on |
|---|---|---|---|---|
| 1 | `Yours` | `14` | `/dashboard/projects` | `/` **and** `/dashboard/projects` |
| 2 | `Starred` | `3` | `/dashboard/projects/starred` | `/dashboard/projects/starred` |
| 3 | `Explore` | *(no badge)* | `/explore` | `/explore`, `/explore/projects/*` |
| 4 | `Topics` | *(no badge)* | `/explore/projects/topics` | topics page |

Markup:

```html
<div class="top-area">
 <div class="scrolling-tabs-container inner-page-scroll-tabs gl-flex-grow-1 gl-min-w-0">
  <div class="fade-left">…chevron-lg-left svg…</div>
  <div class="fade-right">…chevron-lg-right svg…</div>
  <ul class="scrolling-tabs nav-links gl-display-flex gl-flex-grow-1 gl-w-full nav gl-tabs-nav nav gl-tabs-nav is-initialized">
    <li class="nav-item">
      <a class="shortcuts-activity nav-link gl-tab-nav-item active gl-tab-nav-item-active" href="/dashboard/projects">
        Yours
        <span class="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge">14</span>
      </a></li>
    <li class="nav-item"><a class="nav-link gl-tab-nav-item" href="/dashboard/projects/starred">
        Starred <span class="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge">3</span></a></li>
    <li class="nav-item"><a class="nav-link gl-tab-nav-item" href="/explore">Explore</a></li>
    <li class="nav-item"><a class="nav-link gl-tab-nav-item" href="/explore/projects/topics">Topics</a></li>
  </ul>
 </div>
 <div class="nav-controls"> …search form + sort dropdown… </div>
</div>
```

* Active tab classes: `active gl-tab-nav-item-active` (bold text + 2px indigo underline).
* Clicking a tab **is a full navigation and does change the URL** — `Yours` →
  `/dashboard/projects`, `Starred` → `/dashboard/projects/starred`, `Explore` →
  `/explore`, `Topics` → `/explore/projects/topics`. Note that on `/` the `Yours` tab is
  active but its href is `/dashboard/projects`, so clicking it moves you off `/`.

### 2.4 Second-level sub-tabs `All` / `Personal`

Present on `/` and `/dashboard/projects`. **Absent on `/dashboard/projects/starred`**
(verified: `document.querySelectorAll('.nav-block').length === 0` there).

```html
<div class="nav-block">
  <ul class="nav gl-tabs-nav">
    <li class="nav-item"><a class="nav-link gl-tab-nav-item active gl-tab-nav-item-active"
        href="/dashboard/projects">All</a></li>
    <li class="nav-item"><a class="nav-link gl-tab-nav-item"
        href="/dashboard/projects?personal=true&sort=name_asc">Personal</a></li>
  </ul>
</div>
```

(on `/` the Personal href is `/?personal=true&sort=name_asc` and the All href is
`/dashboard/projects`.) `All` = 14 rows, `Personal` = 12 rows. URL changes.

### 2.5 Search / filter input

```html
<form class="project-filter-form" id="project-filter-form"
      data-qa-selector="project_filter_form_container" action="/dashboard/projects" method="get">
  <input class="project-filter-form-field form-control input-short js-projects-list-filter"
         id="project-filter-form-field" placeholder="Filter by name" type="search" name="name">
  <input id="sort" value="name_asc" type="hidden" name="sort">
  <input class="gl-display-none!" type="submit" name="commit">
  <div class="dropdown js-project-filter-dropdown-wrap gl-display-inline"> …sort dropdown… </div>
</form>
```

* Placeholder: **`Filter by name`** (confirmed).
* Debounced auto-submit (~1 s after typing stops) → full page reload with `?name=<q>`.
* Rendered ~277px wide, immediately left of the sort dropdown, both right-aligned in
  `.nav-controls`.

### 2.6 Sort dropdown

Toggle button:

```html
<button class="dropdown-menu-toggle " id="sort-projects-dropdown" type="button">
  <span class="dropdown-toggle-text ">Name</span>
  …chevron-down svg…
</button>
```

* **Default toggle label is `Name`** (not `Updated date`, not `Last created`). It always
  echoes the currently selected sort option's label.
* Menu: `<ul class="dropdown-menu dropdown-menu-right dropdown-menu-selectable">`, three
  groups separated by `<li class="divider">`. Selected entry gets `class="is-active"`
  (renders a check icon).

| Group | Option label (verbatim) | href on `/dashboard/projects` | href on `/` | resulting `?sort=` |
|---|---|---|---|---|
| header `Sort by` | — | — | — | — |
| | `Updated date` | `/dashboard/projects?sort=latest_activity_desc` | `/?sort=latest_activity_desc` | `latest_activity_desc` |
| | `Last created` | `…?sort=created_desc` | `/?sort=created_desc` | `created_desc` |
| | `Name` *(is-active by default)* | `…?sort=name_asc` | `/?sort=name_asc` | `name_asc` |
| | `Name, descending` | `…?sort=name_desc` | `/?sort=name_desc` | `name_desc` |
| | `Most stars` | `…?sort=stars_desc` | `/?sort=stars_desc` | `stars_desc` |
| | `Oldest updated` | `…?sort=latest_activity_asc` | `/?sort=latest_activity_asc` | `latest_activity_asc` |
| | `Oldest created` | `…?sort=created_asc` | `/?sort=created_asc` | `created_asc` |
| divider | | | | |
| | `Hide archived projects` *(is-active)* | `…?sort=name_asc` | `/?sort=name_asc` | — |
| | `Show archived projects` | `…?archived=true&sort=name_asc` | `/?archived=true&sort=name_asc` | `archived=true` |
| | `Show archived projects only` | `…?archived=only&sort=name_asc` | `/?archived=only&sort=name_asc` | `archived=only` |
| divider | | | | |
| | `Owned by anyone` *(is-active)* | `…?sort=name_asc` | `/?sort=name_asc` | — |
| | `Owned by me` | `…?personal=true&sort=name_asc` | `/?personal=true&sort=name_asc` | `personal=true` |

The dropdown header literal is `Sort by` (`<li class="dropdown-header">Sort by</li>`).

**There is NO separate asc/desc toggle button** on this page in 15.7.5. Direction is baked
into the option (`Name` vs `Name, descending`, `Updated date` vs `Oldest updated`,
`Last created` vs `Oldest created`). Do not render an extra arrow button.

### 2.7 The list container (ANCHOR)

```html
<div class="js-projects-list-holder" data-qa-selector="projects_list">
  <ul class="projects-list gl-text-secondary gl-w-full gl-my-2">
    <li class="project-row"> … </li>
    …
  </ul>
</div>
```

* **ANCHOR — `document.querySelector('[data-qa-selector="projects_list"').outerText`
  (webarena-522).** The attribute sits on the **`div.js-projects-list-holder`**, the direct
  parent of `ul.projects-list`. Note the grader's selector is missing its closing `]`;
  browsers still parse it, but the mock must carry the attribute on exactly this element.
* Its `outerText` is the concatenation of every visible row. Per row it yields, in order:
  avatar letter, `<Namespace>\n/`, `<project-name>`, (blank for the visibility icon),
  role badge, description, **star count**, `Updated`, `3 years ago`, then **again**
  star / fork / MR / issue counts and `Updated` `3 years ago`. The duplication is real —
  each row contains a mobile-only `.controls` block (stars + updated) *and* a
  desktop `.project-controls` block (stars, forks, MRs, issues + updated). Reproduce both
  or the outerText will not match GitLab's.
* Task **webarena-522** ("Fork all repos from facebook under byteblaze") checks that
  after the fork actions this outerText `must_include` **`create-react-app`** and
  **`buck`** on `/dashboard/projects`. Neither project is in the seeded 14 rows — they
  must exist as forkable upstream projects (namespace `facebook`) and forking them must
  insert `Byte Blaze / buck` and `Byte Blaze / create-react-app` rows into this list.

### 2.8 Row anatomy (verbatim, using the real first row)

```html
<li class="project-row">
  <!-- ① avatar cell -->
  <div class="project-cell gl-w-11">
    <a class="project" href="/byteblaze/a11y-syntax-highlighting">
      <div alt="" class="gl-avatar gl-avatar-s48 gl-mr-5 gl-avatar-identicon gl-avatar-identicon-bg5">A</div>
    </a>
  </div>

  <!-- ② details cell -->
  <div class="project-cell">
    <div class="project-details gl-pr-9 gl-sm-pr-0 gl-w-full gl-display-flex gl-flex-direction-column"
         data-qa-selector="project_content">
      <div class="gl-display-flex gl-align-items-center gl-flex-wrap-wrap">
        <h2 class="gl-font-base gl-line-height-20 gl-my-0">
          <a class="text-plain gl-mr-3 js-prefetch-document" href="/byteblaze/a11y-syntax-highlighting">
            <span class="namespace-name gl-font-weight-normal">Byte Blaze /
            </span><span class="project-name">a11y-syntax-highlighting</span>
          </a>
        </h2>
        <span class="gl-mr-3 has-tooltip"
              title="Public - The project can be accessed without any authentication.">
          <svg class="s14"><use href="…icons.svg#earth"></use></svg>
        </span>
        <span class="user-access-role gl-display-block gl-m-0" data-qa-selector="user_role_content">Owner</span>
      </div>
      <div class="description gl-display-none gl-sm-display-block gl-overflow-hidden gl-mr-3 gl-mt-2">
        <gl-emoji title="lipstick" …>💄</gl-emoji> Accessible light and dark syntax highlighting themes
      </div>
      <!-- mobile-only duplicate of stars + updated -->
      <div class="gl-display-flex gl-mt-3 gl-sm-display-none!">
        <div class="controls gl-display-flex gl-align-items-center">
          <a class="… icon-wrapper has-tooltip stars" href="…/-/starrers" title="Stars">…star svg…1</a>
        </div>
        <div class="updated-note gl-ml-3 gl-sm-ml-0">Updated <time …>3 years ago</time></div>
      </div>
    </div>
  </div>

  <!-- ③ controls cell (desktop) -->
  <div class="project-cell gl-xs-display-none!">
    <div class="project-controls gl-display-flex gl-flex-direction-column gl-w-full gl-lg-flex-direction-row gl-justify-content-space-between"
         data-testid="project_controls">
      <div class="controls gl-display-flex gl-align-items-center">
        <a class="gl-display-flex gl-align-items-center gl-mr-5 gl-reset-color! icon-wrapper has-tooltip stars"
           href="/byteblaze/a11y-syntax-highlighting/-/starrers" title="Stars">…star svg…1</a>
        <a class="… icon-wrapper has-tooltip forks"
           href="/byteblaze/a11y-syntax-highlighting/-/forks" title="Forks">…fork svg…0</a>
        <a class="… icon-wrapper has-tooltip merge-requests"
           href="/byteblaze/a11y-syntax-highlighting/-/merge_requests" title="Merge requests">…git-merge svg…0</a>
        <a class="… icon-wrapper has-tooltip issues"
           href="/byteblaze/a11y-syntax-highlighting/-/issues" title="Issues">…issues svg…1</a>
      </div>
      <div class="updated-note gl-white-space-nowrap gl-justify-content-end">
        Updated <time class="js-timeago" title="Mar 27, 2023 4:22pm PDT" datetime="2023-03-27T23:22:59Z">3 years ago</time>
      </div>
    </div>
  </div>
</li>
```

Field-by-field:

| Part | Selector | Content / rule |
|---|---|---|
| Avatar tile | `a.project > div.gl-avatar.gl-avatar-s48.gl-mr-5` | 48×48 rounded square. Identicon variant adds `gl-avatar-identicon gl-avatar-identicon-bgN` (N = 1…7) and the **first letter of the project name, uppercased** as text. A project with an uploaded avatar instead renders `<img class="gl-avatar gl-avatar-s48 gl-mr-5" src="/<ns>/<proj>/-/avatar?width=48">` — the only seeded example is `cloud-to-butt`. |
| Namespace | `h2 a.text-plain > span.namespace-name` | e.g. `Byte Blaze / ` — normal weight, grey; note the trailing `/ ` is inside the span |
| Name | `span.project-name` | bold/dark, e.g. `a11y-syntax-highlighting` |
| Row link | `h2 > a.text-plain.gl-mr-3.js-prefetch-document` | `href="/<namespace-path>/<project-path>"` |
| Visibility icon | `span.gl-mr-3.has-tooltip` + `title` | see below |
| Access role | `span.user-access-role.gl-display-block.gl-m-0[data-qa-selector="user_role_content"]` | `Owner` \| `Maintainer` \| `Developer` — small grey pill with 1px border |
| Description | `div.description…` | markdown-rendered; leading `<gl-emoji>` for the emoji-prefixed ones |
| Stars | `a.stars[title="Stars"]` → `/<ns>/<proj>/-/starrers` | star icon + count |
| Forks | `a.forks[title="Forks"]` → `/<ns>/<proj>/-/forks` | fork icon + count |
| Merge requests | `a.merge-requests[title="Merge requests"]` → `/<ns>/<proj>/-/merge_requests` | git-merge icon + count |
| Issues | `a.issues[title="Issues"]` → `/<ns>/<proj>/-/issues` | issues icon + count |
| Updated stamp | `div.updated-note` | literal `Updated ` + `<time class="js-timeago">3 years ago</time>` |

**Visibility icon `title` strings — record exactly** (ANCHOR-adjacent: the anchor
`document.querySelector('.visibility-icon').getAttribute('title')` for webarena-742/743/
744/745 targets the *project home page* element, which is
`<span class="visibility-icon gl-text-secondary has-tooltip gl-ml-2" data-container="body" title="…">`.
On the **dashboard list** the same tooltip text is carried by
`<span class="gl-mr-3 has-tooltip" title="…">` — the class `visibility-icon` is **not**
present in the dashboard list markup, verified: `dashboard-projects.html` contains 0
occurrences of `visibility-icon`. Use the identical title strings in both places.)

| Visibility | Icon (`use href="…icons.svg#…"`) | `title` (verbatim, `<Label> - <description>`) |
|---|---|---|
| Public | `#earth` | `Public - The project can be accessed without any authentication.` |
| Internal | `#shield` | `Internal - The project can be accessed by any logged in user except external users.` (string taken from `visibility_level_helper.rb`; **no internal project is seeded**, so it never appears in a capture) |
| Private | `#lock` | `Private - Project access must be granted explicitly to each user. If this project is part of a group, access is granted to members of the group.` |

Group visibility (for `/dashboard/groups` / `/explore/groups`) uses a different sentence:
`Public - The group and any public projects can be viewed without any authentication.`

### 2.9 Exact seed data — the 14 rows on `/` (and `/dashboard/projects`) page 1, in order

Default sort `name_asc`. Every row's updated string is `Updated 3 years ago`.

| # | Namespace | Project | Visibility | Role | ★ | ⑂ | MR | Issues | `<time title=>` / `datetime=` | Avatar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `Byte Blaze /` | `a11y-syntax-highlighting` | Public | `Owner` | 1 | 0 | 0 | 1 | `Mar 27, 2023 4:22pm PDT` / `2023-03-27T23:22:59Z` | identicon `A`, bg5 |
| 2 | `Byte Blaze /` | `a11y-webring.club` | Public | `Owner` | 2 | 0 | 1 | 4 | `Mar 27, 2023 4:22pm PDT` / `2023-03-27T23:22:59Z` | identicon `A`, bg5 |
| 3 | `The A11Y Project /` | `a11yproject.com` | Public | `Maintainer` | 21 | 0 | 10 | 40 | `Mar 27, 2023 1:15pm PDT` / `2023-03-27T20:15:32Z` | identicon `A`, bg7 |
| 4 | `Byte Blaze /` | `accessible-html-content-patterns` | **Private** | `Owner` | 1 | 0 | 0 | 0 | `Mar 27, 2023 4:22pm PDT` / `2023-03-27T23:22:59Z` | identicon `A`, bg4 |
| 5 | `Byte Blaze /` | `cloud-to-butt` | Public | `Owner` | 0 | 0 | 0 | 0 | `Mar 27, 2023 4:22pm PDT` / `2023-03-27T23:22:59Z` | **uploaded image** `/byteblaze/cloud-to-butt/-/avatar?width=48` |
| 6 | `Primer /` | `design` | Public | `Developer` | 21 | 0 | 16 | 21 | `Mar 27, 2023 2:04pm PDT` / `2023-03-27T21:04:10Z` | identicon `D`, bg6 |
| 7 | `Byte Blaze /` | `dotfiles` | Public | `Owner` | 0 | 0 | 0 | 0 | `Mar 27, 2023 4:22pm PDT` / `2023-03-27T23:22:59Z` | identicon `D`, bg5 |
| 8 | `Byte Blaze /` | `empathy-prompts` | Public | `Owner` | 6 | 1 | 2 | 6 | `Mar 27, 2023 4:22pm PDT` / `2023-03-27T23:22:59Z` | identicon `E`, bg2 |
| 9 | `Byte Blaze /` | `ericwbailey.website` | Public | `Owner` | 2 | 0 | 0 | 0 | `Mar 27, 2023 4:22pm PDT` / `2023-03-27T23:22:59Z` | identicon `E`, bg1 |
| 10 | `Byte Blaze /` | `gimmiethat.space` | **Private** | `Owner` | 0 | 0 | 0 | 0 | `Apr 24, 2023 2:22pm PDT` / `2023-04-24T21:22:22Z` | identicon `G`, bg3 |
| 11 | `Byte Blaze /` | `millennials-to-snake-people` | Public | `Owner` | 6 | 0 | 2 | 4 | `Mar 27, 2023 4:22pm PDT` / `2023-03-27T23:22:59Z` | identicon `M`, bg6 |
| 12 | `Byte Blaze /` | `remove-board-movement-events-from-the-github-issue-timeline` | Public | `Owner` | 0 | 1 | 0 | 0 | `Mar 27, 2023 4:22pm PDT` / `2023-03-27T23:22:59Z` | identicon `R`, bg7 |
| 13 | `Byte Blaze /` | `solarized-prism-theme` | **Private** | `Owner` | 0 | 0 | 0 | 0 | `Apr 24, 2023 2:23pm PDT` / `2023-04-24T21:23:51Z` | identicon `S`, bg7 |
| 14 | `Byte Blaze /` | `timeit` | Public | `Owner` | 0 | 0 | 0 | 0 | `Mar 27, 2023 4:22pm PDT` / `2023-03-27T23:22:59Z` | identicon `T`, bg2 |

Descriptions (verbatim, emoji included):

| Project | Description |
|---|---|
| `a11y-syntax-highlighting` | `💄 Accessible light and dark syntax highlighting themes` |
| `a11y-webring.club` | `🌐 A webring for digital accessibility practitioners.` |
| `a11yproject.com` | `The A11Y Project is a community-driven effort to make digital accessibility easier.` |
| `accessible-html-content-patterns` | `♿️ The full HTML5 Doctor Element Index as well as common markup patterns for quick reference.` |
| `cloud-to-butt` | `Chrome extension that replaces occurrences of 'the cloud' with 'my butt'` |
| `design` | `Primer Design Guidelines` |
| `dotfiles` | `🤖 Computer setup` |
| `empathy-prompts` | `💡 Ideas to help consider Inclusive Design principles when making things for others to use.` |
| `ericwbailey.website` | `📐 Repo for my personal website.` |
| `gimmiethat.space` | `I need some space.` |
| `millennials-to-snake-people` | `🐍 Chrome extension that replaces occurrences of 'Millennials' with 'Snake People'` |
| `remove-board-movement-events-from-the-github-issue-timeline` | `This extension can remove and restore the presence of timeline items generated by a project board event from GitHub's timeline.` |
| `solarized-prism-theme` | `solarized theme for prism.js` |
| `timeit` | `Rails implementation of time tracking tool timeit` |

(Anchor strings satisfied by these rows: `Computer setup`, `dotfiles`,
`cloud-to-butt`, `gimmiethat.space`, `timeit`, `solarized-prism-theme`,
`remove-board-movement-events-from-the-github-issue-timeline`,
`Chrome extension that replaces occurrences of 'the cloud' with 'my butt'`.)

The `Personal` sub-tab (`?personal=true`) drops rows 3 and 6 → 12 rows.

### 2.10 Pagination

Page size is **20** (`shared/projects/_list.html.haml`, `projects_limit = 20`); the pager
is `paginate_collection` → a `.gl-pagination` block below the `<ul>`. With 14 (or 3, or
12) rows **no pager renders at all**: `dashboard-projects.html` contains **0** occurrences
of `gl-pagination` / `page-item`. Only implement a pager if the mock ever exceeds 20 rows
(it will after forking for webarena-522 — 16 rows, still under 20).

### 2.11 Empty state

When the filter matches nothing (`/dashboard/projects?name=zzz`) the holder is replaced by:

```html
<div class="js-projects-list-holder" data-qa-selector="projects_list">
  <div class="nothing-here-block">
    <div class="svg-content">
      <img class="js-lazy-loaded" src="/assets/illustrations/profile-page/personal-project-….svg"
           width="75" height="75" loading="lazy" data-qa_selector="js_lazy_loaded_content">
      <div class="text-content">
        <h5>This user doesn't have any personal projects</h5>
      </div>
    </div>
  </div>
</div>
```

Exact copy: **`This user doesn't have any personal projects`** (straight ASCII apostrophe,
inside an `<h5>`). No button. The `data-qa-selector="projects_list"` attribute is still
present, so the anchor selector never returns `null`.

### 2.12 Component inventory (this view)

| Component | Notes |
|---|---|
| Primary tab strip | 4 tabs, 2 counter badges, horizontal-scroll wrapper with `.fade-left`/`.fade-right` chevrons |
| Secondary tab strip | `All` / `Personal`, only on Yours |
| Search input | debounced GET form |
| Sort dropdown | Bootstrap-style `.dropdown-menu-selectable` with 3 groups, `is-active` check marks |
| List | `ul.projects-list > li.project-row`, 3 cells; row border-bottom `1px solid #dbdbdb` |
| Tooltips | native `title=` on visibility icon and each of the 4 counters (`Stars`, `Forks`, `Merge requests`, `Issues`) |
| No modals, no toasts, no pager |

---

## 3. `/dashboard/projects/starred`

### 3.1 Route and title

| Route | `<title>` | `body[data-page]` |
|---|---|---|
| `/dashboard/projects/starred` | **`Dashboard · GitLab`** | `dashboard:projects:starred` |

Note the title is **shorter** than the Yours page — it has **no** `Projects · ` prefix.
This is a real GitLab quirk; copy it exactly.

Query variants: `?sort=<any of the 7 values>`, `?archived=true|only`, `?personal=true`,
`?name=<q>` — all against the base `/dashboard/projects/starred`.

### 3.2 Box structure

Identical to §2: `#content-body` at x=336, width 1248; `h1.page-title` = **`Projects`**
(same heading as Yours — it is *not* "Starred projects"); `New project` button in
`.page-title-controls`; same 4-tab strip with `Starred` carrying
`active gl-tab-nav-item-active`; same `Filter by name` search and same sort dropdown
(toggle label `Name`).

**Difference from §2:** the `All` / `Personal` `.nav-block` sub-tab strip is **absent**
(verified live: `document.querySelectorAll('.nav-block').length === 0`).

Sort dropdown hrefs on this page (same 12 entries, same labels, same order):

```
/dashboard/projects/starred?sort=latest_activity_desc    Updated date
/dashboard/projects/starred?sort=created_desc            Last created
/dashboard/projects/starred?sort=name_asc                Name          (is-active)
/dashboard/projects/starred?sort=name_desc               Name, descending
/dashboard/projects/starred?sort=stars_desc              Most stars
/dashboard/projects/starred?sort=latest_activity_asc     Oldest updated
/dashboard/projects/starred?sort=created_asc             Oldest created
--- divider ---
/dashboard/projects/starred?sort=name_asc                Hide archived projects   (is-active)
/dashboard/projects/starred?archived=true&sort=name_asc  Show archived projects
/dashboard/projects/starred?archived=only&sort=name_asc  Show archived projects only
--- divider ---
/dashboard/projects/starred?sort=name_asc                Owned by anyone          (is-active)
/dashboard/projects/starred?personal=true&sort=name_asc  Owned by me
```

### 3.3 Seed data — exactly 3 rows, in order

Same `li.project-row` anatomy and same `[data-qa-selector="projects_list"]` container.

| # | Namespace | Project | Visibility | Role | ★ | ⑂ | MR | Issues | `<time title=>` | Avatar |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `The A11Y Project /` | `a11yproject.com` | Public | `Maintainer` | 21 | 0 | 10 | 40 | `Mar 27, 2023 1:15pm PDT` (`2023-03-27T20:15:32Z`) | identicon `A`, bg7 |
| 2 | `Byte Blaze /` | `accessible-html-content-patterns` | Private | `Owner` | 1 | 0 | 0 | 0 | `Mar 27, 2023 4:22pm PDT` (`2023-03-27T23:22:59Z`) | identicon `A`, bg4 |
| 3 | `Byte Blaze /` | `empathy-prompts` | Public | `Owner` | 6 | 1 | 2 | 6 | `Mar 27, 2023 4:22pm PDT` (`2023-03-27T23:22:59Z`) | identicon `E`, bg2 |

Descriptions as in §2.9. All updated stamps read `Updated 3 years ago`.
The `Starred` tab badge count (`3`) must stay in sync with this list; the same badge is
also shown on `/` and `/dashboard/projects`.

### 3.4 Empty state (not reached with the current seed)

If the starred list is empty, `shared/empty_states/_profile_tabs` renders with:
heading `Star projects to track their progress and show your appreciation.`,
illustration `illustrations/starred_empty.svg`, primary button `Explore projects` →
`/explore/projects`. (Visitor-view variant: `This user hasn't starred any projects`.)

---

## 4a. `/dashboard/groups`

### 4a.1 Route and title

| Route | `<title>` | `body[data-page]` |
|---|---|---|
| `/dashboard/groups` | `Groups · Dashboard · GitLab` | `dashboard:groups:index` |
| `/dashboard/groups?sort=<v>` | same | same |
| `/dashboard/groups?filter=<q>` | same | same |

`#content-body` x=336 w=1248.

### 4a.2 Header

```html
<div class="page-title-holder d-flex align-items-center">
  <h1 class="page-title gl-font-size-h-display">Groups</h1>
  <div class="page-title-controls">
    <a class="gl-button btn btn-md btn-confirm " data-testid="new-group-button"
       data-qa-selector="new_group_button" href="/groups/new">
      <span class="gl-button-text">New group</span></a>
  </div>
</div>
```

h1 = `Groups`; button = `New group` (blue, → `/groups/new`).

### 4a.3 Tabs

```html
<div class="top-area">
  <ul class="gl-flex-grow-1 gl-border-0 nav gl-tabs-nav">
    <li class="nav-item"><a class="nav-link gl-tab-nav-item active gl-tab-nav-item-active"
        href="/dashboard/groups">Your groups</a></li>
    <li class="nav-item"><a class="nav-link gl-tab-nav-item"
        data-qa-selector="public_groups_tab" href="/explore/groups">Explore public groups</a></li>
  </ul>
  <div class="nav-controls"> …search + sort… </div>
</div>
```

| Label (verbatim) | href | Counter badge |
|---|---|---|
| `Your groups` | `/dashboard/groups` | none |
| `Explore public groups` | `/explore/groups` | none |

Clicking `Explore public groups` navigates to `/explore/groups` (URL changes).
Unlike the projects tabs there are **no count badges** here.

### 4a.4 Search box

```html
<form class="group-filter-form js-group-filter-form" id="group-filter-form"
      action="/dashboard/groups" accept-charset="UTF-8" method="get">
  <input type="search" name="filter" id="group-filter-form-field"
         placeholder="Search by name"
         class="group-filter-form-field form-control js-groups-list-filter"
         data-qa-selector="groups_filter_field" spellcheck="false">
</form>
```

Placeholder is **`Search by name`** (not `Filter by name`). Submits `?filter=<q>`.
Rendered ~197px wide, left of the sort dropdown.

### 4a.5 Sort dropdown

This is a GitLab-UI **listbox** (`js-redirect-listbox`), not the Bootstrap dropdown used on
the projects page:

```html
<div data-testid="group_sort_by_dropdown">
 <div class="gl-dropdown dropdown btn-group dropdown b-dropdown gl-dropdown btn-group js-redirect-listbox">
  <button id="dropdown-toggle-btn-1" data-testid="base-dropdown-toggle" aria-haspopup="listbox"
          type="button" class="btn btn-default btn-md gl-button gl-dropdown-toggle dropdown-toggle">
    <span class="gl-button-text"><span class="gl-dropdown-button-text">Last created</span>
      <svg data-testid="chevron-down-icon" …/></span>
  </button>
  <div class="dropdown-menu" data-testid="base-dropdown-menu">
    <div class="gl-dropdown-inner">
      <ul class="gl-dropdown-contents gl-list-style-none gl-pl-0 gl-mb-0" id="listbox">
        <li role="option" tabindex="-1" class="gl-dropdown-item gl-listbox-item">
          <span class="dropdown-item">
            <svg data-testid="dropdown-item-checkbox" class="gl-icon s16 gl-dropdown-item-check-icon gl-visibility-hidden gl-mt-3 gl-align-self-start">…</svg>
            <span class="gl-dropdown-item-text-wrapper">Name</span></span></li>
        …
      </ul>
    </div>
  </div>
 </div>
</div>
```

* **Default toggle label: `Last created`** (differs from the projects page, whose default
  is `Name`).
* The `<li>`s carry **no `href`** — selection is JS-driven and performs a full navigation.
  Verified live by clicking each item:

| # | Option label (verbatim) | Resulting URL |
|---|---|---|
| 1 | `Name` | `/dashboard/groups?sort=name_asc` |
| 2 | `Name, descending` | `/dashboard/groups?sort=name_desc` |
| 3 | `Last created` *(default/selected)* | `/dashboard/groups?sort=created_desc` |
| 4 | `Oldest created` | `/dashboard/groups?sort=created_asc` |
| 5 | `Updated date` | `/dashboard/groups?sort=latest_activity_desc` |
| 6 | `Oldest updated` | `/dashboard/groups?sort=latest_activity_asc` |

The selected item's `dropdown-item-checkbox` svg loses `gl-visibility-hidden`.

### 4a.6 Empty state — VERBATIM COPY

**byteblaze belongs to no groups in this snapshot.** The page renders zero group rows;
there is no `.groups-list-tree-container` / group tree at all, only:

```html
<div class="empty-state">
  <div class="row gl-align-items-center gl-justify-content-center">
    <div class="order-md-2">
      <svg width="249" height="368" viewBox="891 156 249 368" …>…GitLab "pocket + folders" illustration…</svg>
    </div>
    <div class="text-content order-md-1 gl-m-0!">
      <h4>A group is a collection of several projects.</h4>
      <p>If you organize your projects under a group, it works like a folder.</p>
      <p>You can manage your group member’s permissions and access to each project in the group.</p>
    </div>
  </div>
</div>
```

Exact strings:

1. `A group is a collection of several projects.` — inside `<h4>`, wraps onto two lines at
   1248px (`A group is a collection of several` / `projects.`).
2. `If you organize your projects under a group, it works like a folder.` — `<p>`
3. `You can manage your group member’s permissions and access to each project in the group.` — `<p>`

**Apostrophe check (asked explicitly):** line 3 uses **U+2019 RIGHT SINGLE QUOTATION MARK**
(`member’s`), *not* the ASCII `'`. Verified byte-wise in the DOM capture. Lines 1 and 2
contain no apostrophes.

* There is **no empty-state CTA button** and **no additional empty-state heading** beyond
  the `<h4>` above. (The `New group` button lives only in `.page-title-controls`.)
* Layout: two columns inside a centred `.row` — text column on the left
  (`order-md-1`, x≈622, ~410px wide, top ≈332), illustration on the right
  (`order-md-2`, x≈1067, 249×368). Tabs/search/sort remain visible above it.

### 4a.7 Notes for the mock

Groups **do** exist on the instance (anchor routes `/groups/coding_friends/-/group_members`,
`/groups/crew/-/group_members`, `/groups/n-lab/-/group_members`,
`/groups/webagent/-/group_members`, `/groups/x-lab/-/group_members`, plus the namespaces
`primer` and `a11yproject`). byteblaze is simply not a *group member* of any of them, so
`/dashboard/groups` is empty while `/explore/groups` is not. Keep those two data sources
separate.

---

## 4b. `/dashboard/todos`

**ANCHOR route** — `/dashboard/todos` (webarena-44: *"Open my todos page"*, `url_match`).
The route must exist and be reachable from `/` (the navbar to-do icon with badge `5`
links to it: `<a href="/dashboard/todos" aria-label="To-Do List" title="To-Do List">5</a>`).

### 4b.1 Routes and title

| Route | `<title>` | `body[data-page]` |
|---|---|---|
| `/dashboard/todos` | `To-Do List · Dashboard · GitLab` | `dashboard:todos:index` |
| `/dashboard/todos?state=pending` | same | same (identical to bare route) |
| `/dashboard/todos?state=done` | same | same |
| `/dashboard/todos?project_id=<id>` | same | filtered |
| `/dashboard/todos?group_id=<id>` | same | filtered |
| `/dashboard/todos?author_id=<id>` | same | filtered |
| `/dashboard/todos?type=Issue\|MergeRequest\|DesignManagement::Design\|AlertManagement::Alert` | same | filtered |
| `/dashboard/todos?action_id=<n>` | same | filtered |
| `/dashboard/todos?sort=label_priority\|created_desc\|created_asc\|updated_desc` | same | sorted |

`#content-body` x=336 w=1248.

### 4b.2 Header

```html
<div class="page-title-holder d-flex align-items-center">
  <h1 class="page-title gl-font-size-h-display">To-Do List</h1>
</div>
```

h1 = **`To-Do List`** (hyphen, capital L). **No** `.page-title-controls` — there is no
button next to the heading.

### 4b.3 Tabs + bulk buttons

```html
<div class="top-area">
  <ul class="gl-flex-grow-1 gl-border-0 nav gl-tabs-nav">
    <li class="nav-item"><a class="js-todos-pending nav-link gl-tab-nav-item active gl-tab-nav-item-active"
        href="/dashboard/todos?state=pending">To Do
        <span class="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge js-todos-badge">5</span></a></li>
    <li class="nav-item"><a class="js-todos-done nav-link gl-tab-nav-item"
        href="/dashboard/todos?state=done">Done
        <span class="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge js-todos-badge">2</span></a></li>
  </ul>
  <div class="nav-controls">
    <div class="gl-mr-3">
      <a class="gl-button btn btn-default btn-loading align-items-center js-todos-mark-all"
         href="/dashboard/todos/destroy_all">
        <span class="gl-spinner-container">…</span>Mark all as done</a>
      <a class="gl-button btn btn-default btn-loading align-items-center js-todos-undo-all hidden"
         href="/dashboard/todos/bulk_restore">
        <span class="gl-spinner-container">…</span>Undo mark all as done</a>
    </div>
  </div>
</div>
```

| Label (verbatim) | href | Badge |
|---|---|---|
| `To Do` | `/dashboard/todos?state=pending` | `5` |
| `Done` | `/dashboard/todos?state=done` | `2` |

* Buttons: `Mark all as done` (visible on the To Do tab, right-aligned, white/secondary,
  → `POST`-ish to `/dashboard/todos/destroy_all`) and `Undo mark all as done`
  (`href="/dashboard/todos/bulk_restore"`, rendered with class `hidden`; it is swapped in
  by JS after "Mark all as done" succeeds).
* **On the `Done` tab `.nav-controls` is empty** — verified live: neither
  `.js-todos-mark-all` nor `.js-todos-undo-all` is visible on `?state=done`.
* The badge counts are also mirrored in the navbar to-do counter (`5`).

### 4b.4 Filter bar — five dropdowns + one sort dropdown

```html
<div class="todos-filters">
  <div class="issues-details-filters row-content-block second-block">
    <form class="filter-form gl-display-flex gl-flex-direction-column gl-sm-flex-direction-row"
          action="/dashboard/todos" method="get">
      <div class="filter-categories gl-display-flex … gl-flex-grow-1 gl-flex-wrap gl-mx-n2">
        <div class="filter-item gl-m-2">…Group…</div>
        <div class="filter-item gl-m-2">…Project…</div>
        <div class="filter-item gl-m-2">…Author…</div>
        <div class="filter-item gl-m-2">…Type…</div>
        <div class="filter-item actions-filter gl-m-2">…Action…</div>
      </div>
      <div class="filter-item sort-filter gl-mt-3 gl-sm-mt-0 gl-mb-0 gl-sm-mb-0">…sort…</div>
    </form>
  </div>
</div>
```

The bar sits on a light-grey band (`.row-content-block.second-block`) directly under the
tabs. Left-to-right visual order (matches the screenshot): **Group, Project, Author, Type,
Action**, then the sort dropdown pushed to the far right.

| # | Toggle button class | Toggle label (default) | Dropdown title | Search input placeholder | Options (verbatim, in order) | URL param on select |
|---|---|---|---|---|---|---|
| 1 | `.js-group-search.js-filter-submit` | `Group` | `Filter by group` | `Search groups` | *(AJAX; live returns `No matching results` — byteblaze has no groups)* | `?group_id=<id>` |
| 2 | `.js-project-search.js-filter-submit` | `Project` | `Filter by project` | `Search projects` | `Byte Blaze / dotfiles`, `Byte Blaze / timeit`, `Byte Blaze / cloud-to-butt`, `Byte Blaze / solarized-prism-theme`, `Byte Blaze / millennials-to-snake-people`, `Byte Blaze / a11y-syntax-highlighting`, `Byte Blaze / accessible-html-content-patterns`, `Byte Blaze / gimmiethat.space`, `Byte Blaze / empathy-prompts`, `Byte Blaze / ericwbailey.website`, `Byte Blaze / remove-board-movement-events-from-the-github-issue-timeline`, `Primer / design`, `Byte Blaze / a11y-webring.club`, `The A11Y Project / a11yproject.com` | `?project_id=<id>` (e.g. `Primer / design` → `?project_id=180`) |
| 3 | `.js-user-search.js-filter-submit.js-author-search` | `Author` | `Filter by author` | `Search authors` | `Any Author`, then `Byte Blaze` / `@byteblaze`, `Roshan Jossy` / `@Roshanjossey` (each entry is name on line 1 + `@username` on line 2, with avatar) | `?author_id=<id>` (Roshan Jossy → `?author_id=2264`) |
| 4 | `.js-type-search.js-filter-submit` | `Type` | *(none)* | *(none)* | `Any Type` *(is-active)*, `Issue`, `Merge request`, `Design`, `Alert` | `?type=Issue` (label→value: `Issue`→`Issue`, `Merge request`→`MergeRequest`, `Design`→`DesignManagement::Design`, `Alert`→`AlertManagement::Alert`) |
| 5 | `.js-action-search.js-filter-submit` (wrapper `.actions-filter`) | `Action` | *(none)* | *(none)* | `Any Action` *(is-active)*, `Assigned`, `Review requested`, `Mentioned`, `Added`, `Pipelines`, `Member access requested` | `?action_id=<n>` (`Assigned` → `?action_id=1`) |

Shared markup for the AJAX ones:

```html
<div class="dropdown ">
  <button class="dropdown-menu-toggle js-project-search js-filter-submit gl-xs-w-full!" type="button">
    <span class="dropdown-toggle-text is-default">Project</span> …chevron-down…
  </button>
  <div class="dropdown-menu dropdown-select dropdown-menu-selectable dropdown-menu-project js-filter-submit">
    <div class="dropdown-title gl-display-flex"><span class="gl-ml-auto">Filter by project</span>
      <button class="dropdown-title-button dropdown-menu-close gl-ml-auto" aria-label="Close" type="button">…</button></div>
    <div class="dropdown-input"><input class="dropdown-input-field" data-qa-selector="dropdown_input_field"
        placeholder="Search projects" type="search">…</div>
    <div class="dropdown-content " data-qa-selector="dropdown_list_content"></div>
    <div class="dropdown-loading"><div class="gl-spinner-container gl-mt-7">…</div></div>
  </div>
</div>
```

Menu class per filter: `.dropdown-menu-group`, `.dropdown-menu-project`,
`.dropdown-menu-user.dropdown-menu-author`, `.dropdown-menu-type`, `.dropdown-menu-action`.
Type/Action have **no** title bar and **no** search input — just
`.dropdown-content > ul > li > a` (the first `<a>` carries `class="is-active"`,
`href="#"`; navigation is done by JS).

**Selecting a filter changes the URL** and reloads; the toggle's
`.dropdown-toggle-text` loses `is-default` and shows the chosen label (e.g. `Issue`,
`Assigned`, `Roshan Jossy`, `Primer / design`).

Sort dropdown (far right):

```html
<div class="filter-item sort-filter …">
  <div class="dropdown">
    <button class="dropdown-menu-toggle dropdown-menu-toggle-sort gl-xs-w-full!" type="button">
      <span class="light">Last created</span> …chevron-down…</button>
    <ul class="dropdown-menu dropdown-menu-sort dropdown-menu-right">
      <li><a href="/dashboard/todos?sort=label_priority">Label priority</a></li>
      <li><a href="/dashboard/todos?sort=created_desc">Last created</a></li>
      <li><a href="/dashboard/todos?sort=created_asc">Oldest created</a></li>
      <li><a href="/dashboard/todos?sort=updated_desc">Updated date</a></li>
    </ul>
  </div>
</div>
```

Default label **`Last created`**. (There is no separate asc/desc arrow button.)

### 4b.5 List container

```html
<div class="row js-todos-all">
  <div class="col js-todos-list-container" data-qa-selector="todos_list_container">
    <div class="js-todos-options" data-page="1" data-per-page="5" data-total-pages="1">
      <ul class="content-list todos-list">
        <li class="todo … todo-pending" id="todo_2978">…</li>
        …
      </ul>
    </div>
  </div>
</div>
```

`data-per-page="5"`, `data-total-pages="1"` with the current seed → no pager rendered.

### 4b.6 Row anatomy (verbatim markup)

```html
<li class="todo gl-hover-border-blue-200 gl-hover-bg-blue-50 gl-hover-cursor-pointer gl-relative todo-pending"
    id="todo_2978">
 <div class="gl-display-flex gl-flex-direction-column gl-sm-flex-direction-row gl-sm-align-items-center">
  <div class="todo-item gl-overflow-hidden gl-overflow-x-auto gl-align-self-center gl-w-full"
       data-qa-selector="todo_item_container">

   <!-- line 1: small grey title line -->
   <div class="todo-title gl-pt-2 gl-pb-3 gl-px-2 gl-md-mb-1 gl-font-sm gl-text-gray-500">
     <span class="todo-target-title" data-qa-selector="todo_target_title_content"
           id="todo_2978_describer">feat: add WCAG levels ·</span>
     <span><span class="namespace-name">The A11Y Project / </span><span class="project-name">a11yproject.com</span></span>
     <span class="todo-label">
       <a class="todo-target-link gl-text-gray-500! gl-text-decoration-none!"
          aria-describedby="todo_2978_describer" aria-label="Merge Request !1270"
          href="/a11yproject/a11yproject.com/-/merge_requests/1270">!1270</a></span>
   </div>

   <!-- line 2: avatar + sentence -->
   <div class="todo-body gl-mb-2 gl-px-2 gl-display-flex gl-align-items-flex-start gl-lg-align-items-center">
     <div class="todo-avatar gl-display-none gl-sm-display-inline-block">
       <a href="/Roshanjossey"><img alt="Roshan Jossy's avatar"
          src="https://www.gravatar.com/avatar/a4c3286b786eb7c48f102211d991516f?s=48&d=identicon"
          data-container="body" class="avatar s24 d-none d-sm-inline-block has-tooltip"
          title="Roshan Jossy"></a>
     </div>
     <div class="todo-note">
       <div class="author-name bold gl-display-inline">
         <a title="Roshan Jossy" href="/Roshanjossey">Roshan Jossy</a></div>
       <span class="action-name" data-qa-selector="todo_action_name_content">assigned you.</span>
     </div>
   </div>
  </div>

  <div class="todo-timestamp gl-white-space-nowrap gl-sm-ml-3 gl-mt-2 gl-mb-2 gl-sm-my-0 gl-px-2 gl-sm-px-0">
    <span class="todo-timestamp gl-font-sm gl-text-gray-500">
      <time class="js-timeago" title="Mar 27, 2023 4:21pm PDT" datetime="2023-03-27T23:21:23Z"
            data-toggle="tooltip" data-placement="top" data-container="body">3 years ago</time></span>
  </div>

  <div class="todo-actions gl-mr-4 gl-px-2 gl-sm-px-0 gl-sm-mx-0">
    <a class="gl-button btn btn-md btn-default btn-loading btn-icon gl-display-flex js-done-todo has-tooltip"
       href="/dashboard/todos/2978" title="Mark as done">…check svg + spinner…</a>
    <a class="gl-button btn btn-md btn-default btn-loading btn-icon gl-display-flex js-undo-todo hidden has-tooltip"
       href="/dashboard/todos/2978/restore" title="Undo">…redo svg + spinner…</a>
  </div>
 </div>
</li>
```

Notes:

* `li` id is `todo_<id>`; state class is `todo-pending` (To Do tab) or `todo-done` (Done tab).
* The whole row is clickable (`gl-hover-cursor-pointer`, hover = `gl-hover-bg-blue-50` +
  `gl-hover-border-blue-200`) and navigates to the target's URL.
* `.todo-target-title` text ends with a literal ` ·` middot separator, then the
  namespace/project, then the reference (`!1270`, `#1`) as the only real `<a>` on line 1.
* `aria-label` on the reference link is `Merge Request !<iid>` or `Issue #<iid>`.
* Action button is an **icon-only** square button (`Mark as done`, check-mark icon) at the
  far right; the hidden sibling `Undo` (`/dashboard/todos/<id>/restore`, title `Undo`) is
  swapped in after marking done.
* On the **Done** tab the single action button is instead
  `class="… js-add-todo has-tooltip"`, `href="/dashboard/todos/<id>/restore"`,
  `title="Add a to do"`.
* Sentence variants observed:
  * third-party author: `<div class="author-name bold gl-display-inline"><a>Roshan Jossy</a></div>` + `<span class="action-name">assigned you.</span>`
  * self: `<a title="You" href="/byteblaze">You</a>` + `<span class="action-name">assigned</span>` + `<span class="action-name">to yourself.</span>` (renders as `You assigned to yourself.`)
  * system: no author element at all, just `<span class="action-name">Could not merge.</span>`

### 4b.7 Seeded todos — VERBATIM, all 5 on the `To Do` tab (default sort `Last created`)

| # | `li` id | Target title | Namespace / project | Ref | Ref href | Avatar (user) | Sentence | `<time title=>` / `datetime=` | Visible time |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `todo_2978` | `feat: add WCAG levels` | `The A11Y Project / a11yproject.com` | `!1270` | `/a11yproject/a11yproject.com/-/merge_requests/1270` | `Roshan Jossy` (`/Roshanjossey`, gravatar `a4c3286b786eb7c48f102211d991516f`) | **`Roshan Jossy`** ` assigned you.` | `Mar 27, 2023 4:21pm PDT` / `2023-03-27T23:21:23Z` | `3 years ago` |
| 2 | `todo_2976` | `update or remove 404 links` | `The A11Y Project / a11yproject.com` | `!1485` | `/a11yproject/a11yproject.com/-/merge_requests/1485` | `Roshan Jossy` | **`Roshan Jossy`** ` assigned you.` | `Mar 27, 2023 4:19pm PDT` / `2023-03-27T23:19:56Z` | `3 years ago` |
| 3 | `todo_2972` | `Tm Theme Editor` | `Byte Blaze / a11y-syntax-highlighting` | `#1` | `/byteblaze/a11y-syntax-highlighting/-/issues/1` | `Byte Blaze` (`/byteblaze`, gravatar `99a4297c867eada2606b9b6973f081f9`) | **`You`** ` assigned to yourself.` | `Mar 27, 2023 4:15pm PDT` / `2023-03-27T23:15:19Z` | `3 years ago` |
| 4 | `todo_2971` | `Add verification functions` | `Byte Blaze / a11y-webring.club` | `!40` | `/byteblaze/a11y-webring.club/-/merge_requests/40` | `Byte Blaze` | **`You`** ` assigned to yourself.` | `Mar 27, 2023 4:14pm PDT` / `2023-03-27T23:14:49Z` | `3 years ago` |
| 5 | `todo_2970` | `Add color utility classes` | `The A11Y Project / a11yproject.com` | `!1071` | `/a11yproject/a11yproject.com/-/merge_requests/1071` | `Byte Blaze` | *(no author)* `Could not merge.` | `Mar 27, 2023 4:07pm PDT` / `2023-03-27T23:07:29Z` | `3 years ago` |

Full `innerText` of each row (pipe = newline), useful for diffing:

```
feat: add WCAG levels | · | The A11Y Project / a11yproject.com | !1270 | Roshan Jossy | assigned you. | 3 years ago
update or remove 404 links | · | The A11Y Project / a11yproject.com | !1485 | Roshan Jossy | assigned you. | 3 years ago
Tm Theme Editor | · | Byte Blaze / a11y-syntax-highlighting | #1 | You | assigned | to yourself. | 3 years ago
Add verification functions | · | Byte Blaze / a11y-webring.club | !40 | You | assigned | to yourself. | 3 years ago
Add color utility classes | · | The A11Y Project / a11yproject.com | !1071 | Could not merge. | 3 years ago
```

### 4b.8 Seeded todos — the 2 on the `Done` tab (`/dashboard/todos?state=done`)

| # | `li` id (class `todo-done`) | Target title | Namespace / project | Ref | Ref href | Sentence | `<time title=>` / `datetime=` | Action button |
|---|---|---|---|---|---|---|---|---|
| 1 | `todo_2974` | `update or remove 404 links` | `The A11Y Project / a11yproject.com` | `!1485` | `/a11yproject/a11yproject.com/-/merge_requests/1485` | `You assigned to yourself.` | `Mar 27, 2023 4:18pm PDT` / `2023-03-27T23:18:33Z` | `js-add-todo`, `/dashboard/todos/2974/restore`, title `Add a to do` |
| 2 | `todo_2973` | `[Post] HOWTO: Use JAWS on Windows` | `The A11Y Project / a11yproject.com` | `#1526` | `/a11yproject/a11yproject.com/-/issues/1526` | `You assigned to yourself.` | `Mar 27, 2023 4:16pm PDT` / `2023-03-27T23:16:25Z` | `js-add-todo`, `/dashboard/todos/2973/restore`, title `Add a to do` |

### 4b.9 Empty state

Reached when a filter matches nothing (e.g. `/dashboard/todos?project_id=180`) or when
all todos are done:

```html
<div class="row js-todos-all">
  <div class="col todos-all-done empty-state">
    <div class="svg-content svg-250">
      <img class="js-lazy-loaded" src="/assets/illustrations/todos_all_done-….svg"
           loading="lazy" data-qa_selector="js_lazy_loaded_content">
    </div>
    <div class="text-content gl-text-center">
      <h4>Nothing is on your to-do list. Nice work!</h4>
    </div>
  </div>
</div>
```

Exact copy: **`Nothing is on your to-do list. Nice work!`** The tabs, badges and the filter
bar all stay rendered above it (badges keep showing `5` / `2`).

### 4b.10 Selectors an evaluator may target

`h1.page-title` · `.js-todos-pending` / `.js-todos-done` · `.js-todos-badge` ·
`.js-todos-mark-all` / `.js-todos-undo-all` · `[data-qa-selector="todos_list_container"]` ·
`.js-todos-options[data-page][data-per-page][data-total-pages]` · `ul.todos-list` ·
`li.todo#todo_<id>` (`.todo-pending` / `.todo-done`) ·
`[data-qa-selector="todo_item_container"]` · `[data-qa-selector="todo_target_title_content"]` ·
`[data-qa-selector="todo_action_name_content"]` · `.todo-target-link` · `.todo-avatar` ·
`.author-name` · `.action-name` · `.todo-timestamp` · `.js-done-todo` / `.js-undo-todo` /
`.js-add-todo` · `[data-qa-selector="dropdown_input_field"]` ·
`[data-qa-selector="dropdown_list_content"]`.

---

## 4c. `/dashboard/activity`

### 4c.1 Routes and title

| Route | `<title>` | `body[data-page]` |
|---|---|---|
| `/dashboard/activity` | `Activity · Dashboard · GitLab` | `dashboard:activity` |
| `/dashboard/activity?filter=starred` | same | same |
| `/dashboard/activity?filter=followed` | same | same |

`#content-body` x=336 w=1248.

### 4c.2 Header

```html
<div class="page-title-holder d-flex align-items-center">
  <h1 class="page-title gl-font-size-h-display">Activity</h1>
</div>
```

h1 = `Activity`. **No** `.page-title-controls` / no button beside the heading.

### 4c.3 Primary tabs — VERIFIED

```html
<div class="top-area">
  <ul class="gl-border-b-0 nav gl-tabs-nav" data-testid="dashboard-activity-tabs">
    <li class="nav-item"><a class="nav-link gl-tab-nav-item active gl-tab-nav-item-active"
        href="/dashboard/activity">Your projects</a></li>
    <li class="nav-item"><a class="nav-link gl-tab-nav-item"
        href="/dashboard/activity?filter=starred">Starred projects</a></li>
    <li class="nav-item"><a class="nav-link gl-tab-nav-item"
        href="/dashboard/activity?filter=followed">Followed users</a></li>
  </ul>
</div>
```

| Label (verbatim) | href | Notes |
|---|---|---|
| `Your projects` | `/dashboard/activity` | default/active |
| `Starred projects` | `/dashboard/activity?filter=starred` | URL changes |
| `Followed users` | `/dashboard/activity?filter=followed` | URL changes — the brief's guess "Your activity" is wrong |

Container has `data-testid="dashboard-activity-tabs"`. No count badges.

### 4c.4 Secondary event-type filter strip + RSS control

```html
<section class="activities">
 <div class="nav-block activities">
  <div class="scrolling-tabs-container inner-page-scroll-tabs is-smaller flex-fill">
   <div class="fade-left">…</div><div class="fade-right">…</div>
   <ul class="nav-links event-filter scrolling-tabs nav nav-tabs is-initialized">
     <li class="active"><a class="event-filter-link" id="all_event_filter"      title="Filter by all"           href="/dashboard/activity"><span> All</span></a></li>
     <li><a class="event-filter-link" id="push_event_filter"     title="Filter by push events"   href="/dashboard/activity"><span> Push events</span></a></li>
     <li><a class="event-filter-link" id="merged_event_filter"   title="Filter by merge events"  href="/dashboard/activity"><span> Merge events</span></a></li>
     <li><a class="event-filter-link" id="issue_event_filter"    title="Filter by issue events"  href="/dashboard/activity"><span> Issue events</span></a></li>
     <li><a class="event-filter-link" id="comments_event_filter" title="Filter by comments"      href="/dashboard/activity"><span> Comments</span></a></li>
     <li><a class="event-filter-link" id="wiki_event_filter"     title="Filter by wiki"          href="/dashboard/activity"><span> Wiki</span></a></li>
     <li><a class="event-filter-link" id="designs_event_filter"  title="Filter by designs"       href="/dashboard/activity"><span> Designs</span></a></li>
     <li><a class="event-filter-link" id="team_event_filter"     title="Filter by team"          href="/dashboard/activity"><span> Team</span></a></li>
   </ul>
  </div>
  <div class="controls">
    <a title="Subscribe" aria-label="Subscribe"
       class="gl-button btn btn-icon btn-md btn-default gl-display-none gl-sm-display-inline-flex"
       href="/dashboard/projects.atom?feed_token=TMN_bBn9Z48qVbUFZV45">…rss svg (data-testid="rss-icon")…</a>
  </div>
 </div>
 <div class="content_list">…</div>
 <div class="loading"><div class="gl-spinner-container">…</div></div>
</section>
```

| Filter tab (verbatim, note the leading space inside `<span>`) | `id` | `title` | href |
|---|---|---|---|
| `All` | `all_event_filter` | `Filter by all` | `/dashboard/activity` |
| `Push events` | `push_event_filter` | `Filter by push events` | `/dashboard/activity` |
| `Merge events` | `merged_event_filter` | `Filter by merge events` | `/dashboard/activity` |
| `Issue events` | `issue_event_filter` | `Filter by issue events` | `/dashboard/activity` |
| `Comments` | `comments_event_filter` | `Filter by comments` | `/dashboard/activity` |
| `Wiki` | `wiki_event_filter` | `Filter by wiki` | `/dashboard/activity` |
| `Designs` | `designs_event_filter` | `Filter by designs` | `/dashboard/activity` |
| `Team` | `team_event_filter` | `Filter by team` | `/dashboard/activity` |

* Every one of these hrefs is the **same path** — the filter is applied via a cookie set
  by JS, so **the URL does not change** when you click them (unlike the primary tabs).
  The active `<li>` gets `class="active"`.
* Feed control: a single **icon-only RSS/"Subscribe" button** (no visible text; `title` and
  `aria-label` are both `Subscribe`), right-aligned in `.controls`, → the atom feed
  `/dashboard/projects.atom?feed_token=TMN_bBn9Z48qVbUFZV45`.
  **`TMN_bBn9Z48qVbUFZV45` is an ANCHOR string** (webarena-259, `exact_match` on the
  answer) — the feed token must be exactly this value wherever a feed link is rendered.
* **There is no calendar/iCal button on the dashboard activity page** (that control lives
  on the user profile page). Do not add one.

### 4c.5 Feed content — EMPTY in this snapshot

All three tabs render the same empty block (verified live on `/dashboard/activity`,
`?filter=starred`, `?filter=followed`, and also on project-level activity such as
`/byteblaze/dotfiles/-/activity`): **the instance has zero events seeded.**

```html
<div class="content_list">
  <div class="nothing-here-block">
    <div class="svg-content">
      <img class="js-lazy-loaded" width="75" height="75"
           src="/assets/illustrations/profile-page/activity-….svg">
      <div class="text-content">No activities found</div>
    </div>
  </div>
</div>
<div class="loading"><div class="gl-spinner-container"><span class="gl-spinner gl-spinner-md gl-spinner-dark gl-vertical-align-text-bottom!" aria-label="Loading"></span></div></div>
```

Exact copy: **`No activities found`** (inside `div.text-content`, centred, bold ~16px,
illustration above it, block centred at ~x=960, top ≈250–350).
The `.loading` spinner div sits below and is hidden unless infinite-scroll fires.

So: **no event sentences are seeded — there are none to record.** For completeness, when
events *do* exist GitLab renders `.content_list > .event-item`, each containing an
`img.avatar.s40`, then `<span class="event-user-info"><a class="author-name">Name</a>
<span class="author-username">@user</span></span>`, an action verb line
(`pushed to branch` / `opened` / `closed` / `commented on` / `accepted`), the target link,
` at ` + the project link, and a `<span class="event-body">` / a `js-timeago` `<time>` with
the same tooltip format as §"Relative-time format". A mock that seeds no events only needs
the empty block above.

---

## 4d. `/dashboard/milestones`

### 4d.1 Routes and title

| Route | `<title>` | `body[data-page]` |
|---|---|---|
| `/dashboard/milestones` | `Milestones · Dashboard · GitLab` | `dashboard:milestones:index` |
| `/dashboard/milestones?state=opened` | same | Open tab (same as bare route) |
| `/dashboard/milestones?sort=due_date_desc&state=closed` | same | Closed tab |
| `/dashboard/milestones?sort=due_date_desc&state=all` | same | All tab |
| `/dashboard/milestones?search_title=<q>` | same | filtered |

`#content-body` x=336 w=1248.

### 4d.2 Header + split button

```html
<div class="page-title-holder d-flex align-items-center">
  <h1 class="page-title gl-font-size-h-display">Milestones</h1>
  <div class="page-title-controls">
    <div class="dropdown b-dropdown gl-dropdown btn-group project-item-select-holder gl-display-inline-flex!">
      <a class="btn gl-button btn-confirm split-content-button js-new-project-item-link block-truncated"
         data-label="Milestone" data-type="milestones" href="">Select project to create milestone</a>
      <div class="select2-container project-item-select gl-absolute! gl-visibility-hidden ajax-project-select" id="s2id_project_path">
        <a class="select2-choice select2-default" href="javascript:void(0)">
          <span class="select2-chosen" id="select2-chosen-1">Search for project or group</span>
          <abbr class="select2-search-choice-close"></abbr><span class="select2-arrow"><b></b></span></a>
        …<input class="select2-input" id="s2id_autogen1_search" type="text">…
        <ul class="select2-results" id="select2-results-1"></ul>
      </div>
      <input type="hidden" name="project_path" id="project_path"
             class="project-item-select gl-absolute! gl-visibility-hidden ajax-project-select"
             data-include-groups="true" data-order-by="last_activity_at"
             data-relative-path="-/milestones/new">
      <button class="btn dropdown-toggle btn-confirm btn-md gl-button gl-dropdown-toggle dropdown-toggle-split new-project-item-select-button"
              aria-label="Toggle project select">…chevron-down…</button>
    </div>
  </div>
</div>
```

* h1 = `Milestones`.
* Blue **split button**: main label `Select project to create milestone`, plus a narrow
  caret half (`aria-label="Toggle project select"`). Opening the caret reveals a select2
  project search whose placeholder text is `Search for project or group`; picking a
  project navigates to `/<ns>/<proj>/-/milestones/new`.

### 4d.3 Tabs + search

```html
<div class="top-area">
  <ul class="gl-border-b-0 gl-flex-grow-1 nav gl-tabs-nav" data-testid="milestones-filter">
    <li class="nav-item"><a class="nav-link gl-tab-nav-item active gl-tab-nav-item-active"
        href="/dashboard/milestones?state=opened">Open
        <span class="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge gl-display-none gl-sm-display-inline-flex">4</span></a></li>
    <li class="nav-item"><a class="nav-link gl-tab-nav-item"
        href="/dashboard/milestones?sort=due_date_desc&state=closed">Closed
        <span class="gl-badge …">2</span></a></li>
    <li class="nav-item"><a class="nav-link gl-tab-nav-item"
        href="/dashboard/milestones?sort=due_date_desc&state=all">All
        <span class="gl-badge …">6</span></a></li>
  </ul>
  <div class="nav-controls">
    <form …>
      <input class="form-control gl-form-input input-short" id="search_title"
             placeholder="Filter by milestone name" type="search" name="search_title">
      <input id="state" type="hidden" name="state">
      <input id="sort" type="hidden" name="sort">
    </form>
  </div>
</div>
```

| Tab (verbatim) | Badge | href |
|---|---|---|
| `Open` | `4` | `/dashboard/milestones?state=opened` |
| `Closed` | `2` | `/dashboard/milestones?sort=due_date_desc&state=closed` |
| `All` | `6` | `/dashboard/milestones?sort=due_date_desc&state=all` |

Search placeholder: **`Filter by milestone name`** (submits `?search_title=<q>`).
There is **no** sort dropdown on this page (sort is carried in the tab hrefs only).

### 4d.4 Row anatomy

```html
<div class="milestones">
 <ul class="content-list">
  <li class="milestone milestone-open" id="milestone_589">
   <div class="row">
    <div class="col-md-6">
      <div class="gl-mb-2">
        <strong data-qa-milestone-title="2019 Replatforming" data-qa-selector="milestone_link">
          <a href="/a11yproject/a11yproject.com/-/milestones/6">2019 Replatforming</a>
        </strong>
         - Project Milestone
      </div>
      <div class="text-tertiary gl-mb-2">expired on Dec 31, 2019</div>
      <div>
        <span class="gl-badge badge badge-pill badge-warning md gl-mb-2">Expired</span>
        <span class="gl-badge badge badge-pill badge-muted md gl-white-space-normal gl-text-left">The A11Y Project / a11yproject.com</span>
      </div>
    </div>
    <div class="col-md-4 milestone-progress">
      <div class="progress"><div class="progress-bar bg-success" style="width: 0%;"></div></div>
      <a href="/dashboard/issues?milestone_title=2019+Replatforming">0 Issues</a>
      ·
      <a href="/dashboard/merge_requests?milestone_title=2019+Replatforming">0 Merge requests</a>
      <div class="float-lg-right light">0% complete</div>
    </div>
    <div class="col-md-2">
      <div class="milestone-actions d-flex justify-content-sm-start justify-content-md-end">
        <a class="btn gl-button btn-default btn-default-secondary btn-sm gl-ml-3" rel="nofollow" data-method="put"
           href="/a11yproject/a11yproject.com/-/milestones/6?milestone%5Bstate_event%5D=close">Close Milestone</a>
      </div>
    </div>
   </div>
  </li>
 </ul>
</div>
```

| Part | Rule |
|---|---|
| Title | `<strong data-qa-selector="milestone_link"><a href="/<ns>/<proj>/-/milestones/<iid>">Title</a></strong>` followed by the literal text ` - Project Milestone` (leading space, spaced hyphen) |
| Due-date line | `<div class="text-tertiary gl-mb-2">expired on <Mmm D, YYYY></div>` — **omitted entirely** when the milestone has no due date (see `2015 Design Refresh`) |
| State badge | open+past-due → `<span class="gl-badge badge badge-pill badge-warning md gl-mb-2">Expired</span>` (amber); closed → `badge-danger` `Closed` (red) |
| Project badge | `<span class="gl-badge badge badge-pill badge-muted md gl-white-space-normal gl-text-left">The A11Y Project / a11yproject.com</span>` |
| Progress bar | `.progress > .progress-bar.bg-success` with inline `style="width: N%;"` (green) |
| Counts | `<a href="/dashboard/issues?milestone_title=<url+encoded title>">N Issues</a>` + literal ` · ` + `<a href="/dashboard/merge_requests?milestone_title=…">N Merge requests</a>` (singular/plural is *not* adjusted: `0 Issues`, `2 Issues`) |
| Percent | `<div class="float-lg-right light">N% complete</div>` |
| Action button | open → `Close Milestone`, `class="btn gl-button btn-default btn-default-secondary btn-sm gl-ml-3"`, `data-method="put"`, `href="/<ns>/<proj>/-/milestones/<iid>?milestone%5Bstate_event%5D=close"`; closed → `Reopen Milestone`, `class="btn gl-button btn-sm gl-ml-3"`, `href="…?milestone%5Bstate_event%5D=activate"` |
| Row `li` class | `milestone milestone-open` / `milestone milestone-closed`, `id="milestone_<db-id>"` |

Milestone dates here are **absolute** (`Dec 31, 2019`), never relative — no `js-timeago`.

### 4d.5 Seed data

**Open tab (`?state=opened`) — 4 rows, in order:**

| # | `li` id | Title | Link | Due line | Badge | Project | Issues | MRs | Bar | % |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `milestone_589` | `2019 Replatforming` | `/a11yproject/a11yproject.com/-/milestones/6` | `expired on Dec 31, 2019` | `Expired` | `The A11Y Project / a11yproject.com` | `0 Issues` | `0 Merge requests` | `width: 0%;` | `0% complete` |
| 2 | `milestone_588` | `Living Styleguide` | `…/-/milestones/5` | `expired on Dec 31, 2019` | `Expired` | same | `0 Issues` | `0 Merge requests` | `width: 0%;` | `0% complete` |
| 3 | `milestone_587` | `2019 Redesign` | `…/-/milestones/4` | `expired on Dec 31, 2019` | `Expired` | same | `2 Issues` | `0 Merge requests` | `width: 100%;` | `100% complete` |
| 4 | `milestone_586` | `Content Updates for 2019` | `…/-/milestones/3` | `expired on Dec 31, 2019` | `Expired` | same | `18 Issues` | `8 Merge requests` | `width: 83%;` | `83% complete` |

**Closed tab (`?sort=due_date_desc&state=closed`) — 2 rows, in order:**

| # | `li` id | Title | Link | Due line | Badge | Issues | MRs | Bar | % | Action |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `milestone_585` | `Winter Sprint` | `/a11yproject/a11yproject.com/-/milestones/1` | `expired on Jan 14, 2014` | `Closed` | `12 Issues` | `0 Merge requests` | `width: 100%;` | `100% complete` | `Reopen Milestone` |
| 2 | `milestone_584` | `2015 Design Refresh` | `/a11yproject/a11yproject.com/-/milestones/2` | **(none — no due-date div)** | `Closed` | `4 Issues` | `0 Merge requests` | `width: 100%;` | `100% complete` | `Reopen Milestone` |

**All tab (`?sort=due_date_desc&state=all`) — 6 rows in this order:**
`milestone_585 (Winter Sprint, closed)`, `milestone_589`, `milestone_588`, `milestone_587`,
`milestone_586`, `milestone_584 (2015 Design Refresh, closed)`.

Every milestone belongs to `The A11Y Project / a11yproject.com`. Milestone-count links use
`milestone_title=` with `+` for spaces: `2019+Replatforming`, `Living+Styleguide`,
`2019+Redesign`, `Content+Updates+for+2019`, `Winter+Sprint`, `2015+Design+Refresh`.

### 4d.6 Empty state

Reached via e.g. `/dashboard/milestones?search_title=zzzz`:

```html
<div class="row empty-state">
  <div class="col-12">
    <div class="svg-content">
      <img class="js-lazy-loaded" src="/assets/illustrations/milestone_burndown_chart-….svg"
           loading="lazy" data-qa_selector="js_lazy_loaded_content">
    </div>
  </div>
  <div class="col-12">
    <div class="text-content">
      <h4 class="text-center">There are no open milestones</h4>
      <p class="state-description text-center">
        Create a milestone to better track your issues and merge requests.
        <a href="/help/user/project/milestones/index">Learn more.</a>
      </p>
      <div class="page-title-controls">…the same "Select project to create milestone" split button…</div>
    </div>
  </div>
</div>
```

Exact copy:
* heading `There are no open milestones` (`<h4 class="text-center">`)
* body `Create a milestone to better track your issues and merge requests. ` +
  link text `Learn more.` → `/help/user/project/milestones/index`
* a second copy of the `Select project to create milestone` split button below the text.

(On the Closed/All tabs the heading becomes `There are no closed milestones` /
`There are no milestones` respectively — the mock only needs the open variant if it never
empties the other tabs.)

---

## 4e. `/dashboard/snippets`

### 4e.1 Route and title

| Route | `<title>` | `body[data-page]` |
|---|---|---|
| `/dashboard/snippets` | `Snippets · Dashboard · GitLab` | `dashboard:snippets:index` |

`#content-body` x=336 w=1248.

### 4e.2 Header

```html
<div class="page-title-holder d-flex align-items-center">
  <h1 class="page-title gl-font-size-h-display">Snippets</h1>
</div>
```

h1 = `Snippets`. **No** `.page-title-controls` — there is **no** "New snippet" button next
to the heading in this (empty) state; the only `New snippet` button is inside the empty
state itself. (The navbar `+` menu also has `New snippet` → `/-/snippets/new`.)

### 4e.3 Tabs

```html
<div class="top-area">
  <ul class="gl-border-0 nav gl-tabs-nav">
    <li class="nav-item"><a class="nav-link gl-tab-nav-item active gl-tab-nav-item-active"
        href="/dashboard/snippets" title="Your snippets">Your snippets</a></li>
    <li class="nav-item"><a class="nav-link gl-tab-nav-item"
        href="/explore/snippets" title="Explore snippets">Explore snippets</a></li>
  </ul>
</div>
```

| Label (verbatim) | `title=` | href |
|---|---|---|
| `Your snippets` | `Your snippets` | `/dashboard/snippets` |
| `Explore snippets` | `Explore snippets` | `/explore/snippets` |

No count badges. `.nav-controls` is absent (no search box, no sort dropdown) because the
list is empty. Clicking `Explore snippets` changes the URL.

### 4e.4 Body — EMPTY, verbatim copy

byteblaze has **no snippets**. The whole body is the empty state:

```html
<div class="row empty-state">
  <div class="col-12">
    <div class="svg-content" data-qa-selector="svg_content">
      <img class="js-lazy-loaded" src="/assets/illustrations/snippets_empty-….svg"
           loading="lazy" data-qa_selector="js_lazy_loaded_content">
    </div>
  </div>
  <div class="col-12">
    <div class="text-content gl-text-center gl-pt-0">
      <h4>Code snippets</h4>
      <p class="gl-mb-0">Store, share, and embed small pieces of code and text.</p>
      <div class="gl-mt-3">
        <a class="btn gl-button btn-confirm" title="New snippet" id="new_snippet_link"
           data-qa-selector="create_first_snippet_link" href="/-/snippets/new">New snippet</a>
        <a class="btn gl-button btn-default" title="Documentation"
           href="/help/user/snippets.md">Documentation</a>
      </div>
    </div>
  </div>
</div>
```

Exact strings:
* heading `Code snippets` (`<h4>`, centred, ~24px bold)
* body `Store, share, and embed small pieces of code and text.` (`<p class="gl-mb-0">`)
* primary button `New snippet` (blue, `id="new_snippet_link"`,
  `data-qa-selector="create_first_snippet_link"`, `title="New snippet"`, → `/-/snippets/new`)
* secondary button `Documentation` (white/default, `title="Documentation"`,
  → `/help/user/snippets.md`)

Layout: illustration (~400px wide, scissors + code cards + padlock) centred at ~x=960,
top ≈240–540; text block centred beneath it (heading top ≈570, paragraph ≈608, buttons
row ≈645). Everything is horizontally centred inside the 1248px content column.

---

### Cross-cutting notes for the dev agent

1. **Every page in this part shares the dashboard chrome** (`.navbar-gitlab`, no left
   sidebar, `#content-body` at x=336/1248). Build one `DashboardLayout` and reuse it.
2. **Titles**: `<X> · Dashboard · GitLab` for all of them *except*
   `/dashboard/projects/starred`, which is just `Dashboard · GitLab`.
3. **All h1s** use `class="page-title gl-font-size-h-display"`; the projects h1 is
   `Projects` on all three project routes.
4. **Counter badges** (`14`, `3`, `5`, `2`, `4`, `2`, `6`) all use
   `<span class="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge">`;
   the milestones ones additionally carry `gl-display-none gl-sm-display-inline-flex`.
5. **Active tab** = `class="nav-link gl-tab-nav-item active gl-tab-nav-item-active"`.
6. **Two different dropdown idioms** coexist and must be reproduced faithfully:
   the legacy Bootstrap `.dropdown-menu-toggle` + `.dropdown-menu-selectable` with real
   `<a href>` options (projects sort, todos filters/sort), and the newer GitLab-UI
   `.gl-dropdown` / `js-redirect-listbox` with `<li role="option">` and JS navigation
   (groups sort).
7. **ANCHORs touched in this part**: `/dashboard/projects` +
   `[data-qa-selector="projects_list"]` outerText must contain `buck` and
   `create-react-app` after forking (webarena-522); `/dashboard/todos` must exist
   (webarena-44); the atom feed token `TMN_bBn9Z48qVbUFZV45` (webarena-259); the
   visibility tooltip strings behind `.visibility-icon` (webarena-742/743/744/745);
   `/` itself is the start URL for 168 tasks, so its 14-row project list is the most
   load-bearing seed in the whole site.

---

## 5a. `/dashboard/issues` — filtered-search bar, tabs, sort, row anatomy

### 5a.1 Routes & `<title>`

| Route | `<title>` | Notes |
|---|---|---|
| `/dashboard/issues` | `Issues · Dashboard · GitLab` | **no filter set** → empty state (see 5a.9) |
| `/dashboard/issues?scope=all&state=opened&assignee_username=byteblaze` | `Issues · Dashboard · GitLab` | **(ANCHOR** — webarena-804, -810, -811**)** |
| `/dashboard/issues?scope=all&state=opened&assignee_username=primer` | idem | **(ANCHOR** — webarena-804**)** |
| `/dashboard/issues?scope=all&state=opened&assignee_username=Roshanjossey` | idem | **(ANCHOR** — webarena-446**)** |
| `/dashboard/issues?scope=all&state=opened&assignee_username=Seirdy` | idem | **(ANCHOR** — webarena-447**)** |
| `/dashboard/issues?assignee_username=byteblaze` | idem | the top-navbar "Issues" badge links here (no `scope`/`state`); server defaults `state=opened`, `scope=all` |
| `/dashboard/issues.atom?...&feed_token=…` | — | RSS |
| `/dashboard/issues.ics?...&feed_token=…` | — | iCal |

No breadcrumb bar on this page (`@hide_top_links = true`). No left sidebar.

### 5a.2 Box structure @1920×1080

| Element | x | width | height |
|---|---|---|---|
| `#content-body` (inside `.container-fluid.container-limited`) | 336 | **1248** | — |
| `.page-title-holder.d-flex.align-items-center` | 336 | 1248 | 69 |
| `h1.page-title.gl-font-size-h-display` (`Issues`) | 336 | 99 | 36 — `font-size:28px; font-weight:600; color:#333238` |
| `.page-title-controls` (split button, right-aligned) | 1323 | 261 | 32 |
| `.top-area` (tabs row) | 336 | 1248 | 49 |
| `.top-area > ul.issues-state-filters` | 336 | 845 | 48 |
| `.top-area > .nav-controls` (RSS / calendar) | 1181 | 403 | 48 |
| `.issues-filters` (search bar row) | 336 | 1248 | 68 |
| `.filtered-search-box` (white pill: history dropdown + tokens) | 352 | 1046 | 34 |
| `.filtered-search-box-input-container` | 506 | 855 | 32 |
| `.filter-dropdown-container` (sort dropdown + direction btn) | 1398 | 170 | 34 |
| `ul.content-list.issues-list.issuable-list` | 336 | 1248 | — |
| `ul.issues-list > li.issue` | 336 | 1248 | **64** (single-label row; ~64–70) |
| `.issuable-main-info` | 352 | 915 | 43 |
| `.issuable-meta` | 1277 | 291 | 43 |
| `.issuable-timestamp` (`updated 3 years ago`) | 1423 | 145 | 21 — `color:#737278` |
| `li.filtered-search-token` (the `Assignee = Byte Blaze` chip) | 518 | 251 | 25 |

### 5a.3 Page header

```html
<div class="page-title-holder d-flex align-items-center">
  <h1 class="page-title gl-font-size-h-display">Issues</h1>
  <div class="page-title-controls">
    <div class="dropdown b-dropdown gl-dropdown btn-group project-item-select-holder gl-display-inline-flex!">
      <a class="btn gl-button btn-confirm split-content-button js-new-project-item-link block-truncated"
         href="" data-label="issue" data-type="issues">Select project to create issue</a>
      <input type="hidden" name="project_path" id="project_path"
             class="project-item-select gl-absolute! gl-visibility-hidden ajax-project-select"
             data-order-by="last_activity_at" data-relative-path="issues/new" data-with-issues-enabled="true">
      <button aria-label="Toggle project select"
              class="btn dropdown-toggle btn-confirm btn-md gl-button gl-dropdown-toggle dropdown-toggle-split new-project-item-select-button"></button>
    </div>
  </div>
</div>
```

- Button label verbatim: `Select project to create issue` (blue `btn-confirm`, with a caret split-button on its right whose `aria-label` is `Toggle project select`). Opening the caret shows a project-picker dropdown with a `Search for project` search field.
- Note the raw HTML ships the anchor **empty**; the label text is injected client-side from `data-label="issue"`. Mock should just render the final string.

### 5a.4 Open / Closed / All tabs

```html
<div class="top-area">
  <ul class="issues-state-filters gl-border-b-0 gl-flex-grow-1 nav gl-tabs-nav">
    <li class="nav-item"><a id="state-opened" data-state="opened"
        title="Filter by issues that are currently open."
        class="nav-link gl-tab-nav-item active gl-tab-nav-item-active"
        href="/dashboard/issues?assignee_username=byteblaze&scope=all&state=opened">
        <span>Open</span> <span class="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge gl-display-none gl-sm-display-inline-flex">13</span></a></li>
    <li class="nav-item"><a id="state-closed" data-state="closed" data-qa-selector="closed_issues_link"
        title="Filter by issues that are currently closed." class="nav-link gl-tab-nav-item"
        href="…&state=closed"><span>Closed</span> <span class="gl-badge …">53</span></a></li>
    <li class="nav-item"><a id="state-all" data-state="all"
        title="Show all issues." class="nav-link gl-tab-nav-item"
        href="…&state=all"><span>All</span> <span class="gl-badge …">66</span></a></li>
  </ul>
  <div class="nav-controls"> … RSS / calendar … </div>
</div>
```

| Tab | Label | Tooltip (`title=`) | id | Resulting query | Count on `?assignee_username=byteblaze` |
|---|---|---|---|---|---|
| 1 | `Open` | `Filter by issues that are currently open.` | `state-opened` | `?…&state=opened` | **13** |
| 2 | `Closed` | `Filter by issues that are currently closed.` | `state-closed` (also `data-qa-selector="closed_issues_link"`) | `?…&state=closed` | **53** |
| 3 | `All` | `Show all issues.` | `state-all` | `?…&state=all` | **66** |

- Counts render only when at least one filter is set; on bare `/dashboard/issues` the badges are **absent** entirely (labels `Open` / `Closed` / `All` alone).
- Active tab classes: `nav-link gl-tab-nav-item active gl-tab-nav-item-active`.
- Other observed counts: `?assignee_username=Roshanjossey` → Open **4**, Closed **0**, All **4**. `?assignee_username=Seirdy` → 0/0/0. `?assignee_username=primer` → 0/0/0. `?assignee_username=nosuchuser` → 0/0/0. `?author_username=byteblaze&state=opened` → 19 rows.

**`.nav-controls`** (right of tabs), two `gl-button btn btn-md btn-default has-tooltip` links:

| Label (visible) | `aria-label` | `data-testid` | href |
|---|---|---|---|
| `Subscribe to RSS feed` | `Subscribe to RSS feed` | `rss-feed-link` | `/dashboard/issues.atom?assignee_username=byteblaze&feed_token=TMN_bBn9Z48qVbUFZV45&scope=all&state=opened` |
| `Subscribe to calendar` | `Subscribe to calendar` | — | `/dashboard/issues.ics?assignee_username=byteblaze&due_date=next_month_and_previous_two_weeks&feed_token=TMN_bBn9Z48qVbUFZV45&scope=all&sort=closest_future_date&state=opened` |

Icons `data-testid="rss-icon"` / `data-testid="calendar-icon"`.

### 5a.5 The filtered-search token bar (legacy `filtered-search-wrapper`)

> **IMPORTANT** — GitLab 15.7's *dashboard* issue/MR lists use the **legacy jQuery/droplab** filtered search (`.filtered-search-wrapper`, `#filtered-search-issues`), **not** the newer Vue `.gl-filtered-search` / `[data-testid="filtered-search-input"]` component (that one is used on *project* issue lists). Everything below is verbatim from the live DOM.

Container chain:

```
form.filter-form.js-filter-form.w-100  (method=get, action=<page_filter_path>)
└ .issues-other-filters.filtered-search-wrapper.d-flex.flex-column.flex-md-row
  └ .filtered-search-box                                   ← white rounded pill, x=352 w=1046 h=34
    ├ .dropdown.filtered-search-history-dropdown-wrapper   ← "Recent searches" button
    └ .filtered-search-box-input-container.droplab-dropdown
      ├ .scroll-container > ul.tokens-container.list-unstyled
      │   ├ li.js-visual-token.filtered-search-token.search-token-assignee   ← existing token chip
      │   └ li.input-token > input#filtered-search-issues.form-control.filtered-search
      ├ #js-dropdown-hint.filtered-search-input-dropdown-menu.dropdown-menu.hint-dropdown
      ├ #js-dropdown-operator …  #js-dropdown-author …  #js-dropdown-assignee …
      ├ #js-dropdown-reviewer …  #js-dropdown-approved-by …  #js-dropdown-milestone …
      ├ #js-dropdown-release …   #js-dropdown-label …        #js-dropdown-my-reaction …
      ├ #js-dropdown-wip …       #js-dropdown-confidential … #js-dropdown-target-branch …
      └ #js-dropdown-environment …
    └ button.clear-search (svg `data-testid="close-icon"`, class `clear-search-icon`)  ← "✕" at the far right of the pill
```

**Placeholder.** `<input … id="filtered-search-issues" class="form-control filtered-search" autocomplete="off" placeholder="Search or filter results..." data-dropdown-trigger="#js-dropdown-hint" data-labels-endpoint="/dashboard/labels" data-milestones-endpoint="/dashboard/milestones">`
- Exact placeholder string: `Search or filter results...` (three literal periods, **not** an ellipsis char).
- **When at least one token chip is present the placeholder attribute is emptied** (`placeholder=""`) — verified: bare `/dashboard/issues` has the placeholder, `?assignee_username=byteblaze` has `placeholder=""`.
- On MR pages the id is `#filtered-search-merge_requests`.
- A free-text `?search=` value is *not* a chip — it is put into `input.value` (e.g. `?search=WCAG` → `input.value === "WCAG"`).

**Existing token chip** — exact markup for `Assignee = Byte Blaze`:

```html
<li class="js-visual-token filtered-search-token search-token-assignee">
  <div class="selectable" role="button">
    <div class=" name">assignee</div>
    <div class="operator">=</div>
    <div class="value-container" data-original-value="@byteblaze">
      <div class=" value">
        <img class="avatar s20" src="https://www.gravatar.com/avatar/99a4297c867eada2606b9b6973f081f9?s=80&d=identicon" alt="">
        Byte Blaze
      </div>
      <div class="remove-token" role="button">
        <svg class="s16 close-icon"><use xlink:href="…#close"></use></svg>
      </div>
    </div>
  </div>
</li>
```

- `.name` text is lowercase in the DOM (`assignee`) but rendered **`Assignee`** because CSS applies `text-transform: capitalize`. Chip background `rgb(236,236,239)` (`#ececef`), height 25px.
- `.operator` renders `=` (or `!=` for negated filters).
- Value = 20px round avatar + the user's **display name** when the username resolves (`Byte Blaze`, `Roshan Jossy`, `Rohan Kumar`, `Primer`); when it does not resolve the raw `@nosuchuser` is shown with no avatar.
- `.remove-token` is the ✕ that deletes the token; the outer `.clear-search` ✕ (right edge of the pill) clears **all** tokens + text.
- Token `li` class is `search-token-<key>`, e.g. `search-token-assignee`, `search-token-author`, `search-token-label`, `search-token-milestone`, `search-token-reviewer`.

**Focus → hint dropdown** `#js-dropdown-hint` (`ul.filter-dropdown > li.filter-dropdown-item[data-hint][data-tag]`, each with an icon + `span.js-filter-hint`). **Verified live**, in this exact order:

*Issues (`/dashboard/issues`)* — 7 entries:

| Visible label | `data-hint` | `data-tag` | icon |
|---|---|---|---|
| `Author` | `author` | `:@author` | `pencil` |
| `Assignee` | `assignee` | `:@assignee` | `user` |
| `Milestone` | `milestone` | `:%milestone` | `clock` |
| `Release` | `release` | `:tag name` | `rocket` |
| `Label` | `label` | `:~label` | `labels` |
| `My-Reaction` | `my-reaction` | `:emoji` | `thumb-up` |
| `Search for this text` | `search` | `search` (`data-action="submit"`) | `search` |

*Merge requests (`/dashboard/merge_requests`)* — 13 entries:
`Author`, `Assignee`, `Reviewer`, `Approved-By`, `Milestone`, `Release`, `Label`, `My-Reaction`, `Draft`, `Environment`, `Deployed-before`, `Deployed-after`, `Search for this text`
(`data-hint` values: `author, assignee, reviewer, approved-by, milestone, release, label, my-reaction, draft, environment, deployed-before, deployed-after, search`; `data-tag` values: `:@author, :@assignee, :@reviewer, :@approved-by, :%milestone, :tag name, :~label, :emoji, :Yes or No, :environment, :deployed_before, :deployed_after, search`).
`Confidential` is **not** offered on the dashboard (the `#js-dropdown-confidential` menu exists in the DOM with `Yes`/`No` but is only reachable on project issue lists).

**Value dropdowns** (all `div.filtered-search-input-dropdown-menu.dropdown-menu`):

| id | Static entries (verbatim) |
|---|---|
| `#js-dropdown-operator` | template rows `{{ title }}` + `span.btn-helptext {{ help }}` — populated with `=` / `!=` |
| `#js-dropdown-author` | current user row (avatar 40px, `Byte Blaze` / `@byteblaze`) then dynamic `{{name}}` / `@{{username}}` |
| `#js-dropdown-assignee` | `None`, `Any`, `<divider>`, current user, then dynamic users |
| `#js-dropdown-reviewer` | `None`, `Any`, `<divider>`, current user, then dynamic users |
| `#js-dropdown-approved-by` | `None`, `Any`, `<divider>`, current user, then dynamic users |
| `#js-dropdown-milestone` | `None`, `Any`, `Upcoming`, `Started`, `<divider>`, then dynamic `{{title}}` |
| `#js-dropdown-release` | `None`, `Any`, `<divider>`, dynamic `{{title}}` |
| `#js-dropdown-label` | `None`, `Any`, `<divider>`, dynamic rows = `span.dropdown-label-box` (colour swatch) + `span.label-title.js-data-value {{title}}` |
| `#js-dropdown-my-reaction` | `None`, `Any`, `<divider>`, dynamic `<gl-emoji>` + `{{name}}` |
| `#js-dropdown-wip` | `Yes`, `No` |
| `#js-dropdown-confidential` | `Yes`, `No` |
| `#js-dropdown-target-branch` | dynamic `{{title}}` (monospace) — MR only, suppressed on the dashboard (`disable_target_branch: true`) |
| `#js-dropdown-environment` | dynamic `{{title}}` |

**Recent searches dropdown** (left end of the pill):

```html
<div class="dropdown filtered-search-history-dropdown-wrapper">
  <button class="dropdown-menu-toggle gl-button btn btn-default filtered-search-history-dropdown-toggle-button" data-toggle="dropdown">
    <span class="dropdown-toggle-text">
      <span class="d-md-none"><svg data-testid="history-icon">…</svg></span>
      <span class="d-none d-md-inline">Recent searches</span>
    </span>
    <svg class="s16 dropdown-menu-toggle-icon gl-top-3" data-testid="chevron-down-icon">…</svg>
  </button>
  <div class="dropdown-menu dropdown-select filtered-search-history-dropdown">
    <div class="dropdown-content filtered-search-history-dropdown-content" data-qa-selector="dropdown_list_content">
      <ul>
        <li data-testid="dropdown-item">
          <button class="filtered-search-history-dropdown-item js-dropdown-button">
            <span><span class="filtered-search-history-dropdown-token js-dropdown-token">
              <span class="name">assignee:</span> <span class="name">=</span> <span class="value">@byteblaze</span>
            </span></span>
            <span class="filtered-search-history-dropdown-search-token"></span>
          </button>
        </li>
        <li class="divider"></li>
        <li><button data-testid="clear-button" type="button" class="filtered-search-history-clear-button">Clear recent searches</button></li>
      </ul>
    </div>
    <div class="dropdown-loading">…gl-spinner, aria-label="Loading"…</div>
  </div>
</div>
```

- Button label: `Recent searches`. Item token format: `assignee:` `=` `@byteblaze` (note the trailing colon on the key, and the **raw** `@username`, not the display name). Footer button: `Clear recent searches`.
- Backed by **localStorage** (per-user key), not the server. Every filtered page load appends the current search, so after visiting an anchor URL the dropdown always contains at least that one entry. The empty-state string that ships in the bundle is `You don't have any recent searches`.

**Query params — applying a token rewrites the URL query string** (the form is `method="get"`; the client serialises tokens into params and navigates). Verified round-trips:

| Param | Example | Effect / rendered token |
|---|---|---|
| `scope` | `scope=all` | `all` \| `assigned_to_me` \| `created_by_me`. Only `all` combined with a `*_username` filter yields results on the dashboard; `assigned_to_me`/`created_by_me` alone counts as *no filter set* → "Please select at least one filter to see results". |
| `state` | `state=opened` | `opened` \| `closed` \| `all` (MRs add `merged`) |
| `assignee_username` | `assignee_username=byteblaze` | chip `Assignee = Byte Blaze` |
| `author_username` | `author_username=byteblaze` | chip `Author = Byte Blaze` |
| `reviewer_username` | `reviewer_username=byteblaze` | chip `Reviewer = Byte Blaze` (MRs) |
| `label_name[]` (URL-encoded `label_name%5B%5D`) | `label_name[]=feature` | chip `Label = ~feature` (repeatable) |
| `not[label_name][]` (`not%5Blabel_name%5D%5B%5D`) | `not[label_name][]=feature` | chip `Label != ~feature` |
| `milestone_title` | `milestone_title=Content Updates for 2019` | chip `Milestone = %"Content Updates for 2019"` (quotes appear when the title contains spaces) |
| `search` | `search=WCAG` | free text → `input#filtered-search-issues.value = "WCAG"`, no chip |
| `sort` | `sort=created_date` | see 5a.6 |
| `page` | `page=2` | offset pagination, 20 rows/page |
| `first_page_size` | `first_page_size=20` | **accepted but ignored** on the dashboard (it is a keyset-pagination param of the *Vue* project issue list, e.g. `/primer/design/-/issues/?sort=updated_desc&state=opened&first_page_size=20` (ANCHOR) and `/root/metaseq/-/issues/?search=OPT%20model&sort=created_asc&state=opened&label_name%5B%5D=question&first_page_size=20` (ANCHOR)). Reproduce it in the URL, do not let it change output. |
| `feed_token` | on `.atom`/`.ics` only | `TMN_bBn9Z48qVbUFZV45` for byteblaze |

Param order emitted by GitLab's own links is **alphabetical** (`assignee_username`, `page`, `scope`, `sort`, `state`), e.g. `/dashboard/issues?assignee_username=byteblaze&scope=all&state=closed`. Incoming anchor URLs use a different order (`?scope=all&state=opened&assignee_username=byteblaze`) — the mock must accept any order.

### 5a.6 Sort dropdown + direction toggle

```html
<div class="filter-dropdown-container gl-display-flex gl-flex-direction-column gl-md-flex-direction-row gl-align-items-flex-start">
 <div class="gl-ml-3"><div class="btn-group" role="group">
   <div class="gl-dropdown dropdown btn-group b-dropdown js-redirect-listbox">
     <button id="dropdown-toggle-btn-1" data-testid="base-dropdown-toggle" aria-haspopup="listbox"
             class="btn btn-default btn-md gl-button gl-dropdown-toggle dropdown-toggle">
       <span class="gl-button-text"><span class="gl-dropdown-button-text">Created date</span>
         <svg data-testid="chevron-down-icon" class="gl-button-icon dropdown-chevron gl-icon s16">…</svg></span>
     </button>
     <div data-testid="base-dropdown-menu" class="dropdown-menu">
       <div class="gl-dropdown-inner">
         <ul id="listbox" role="listbox" class="gl-dropdown-contents gl-list-style-none gl-pl-0 gl-mb-0">
           <li role="option" class="gl-dropdown-item gl-listbox-item"><span class="dropdown-item">
             <svg data-testid="dropdown-item-checkbox" class="gl-icon s16 gl-dropdown-item-check-icon gl-visibility-hidden gl-mt-3 gl-align-self-start">…#mobile-issue-close…</svg>
             <span class="gl-dropdown-item-text-wrapper">Priority</span></span></li>
           … one <li> per option, the selected one has aria-selected="true" and no gl-visibility-hidden on the check icon …
         </ul>
       </div></div>
   </div>
   <a type="button" class="gl-button btn btn-default btn-icon has-tooltip reverse-sort-btn rspec-reverse-sort"
      title="Sort direction"
      href="/dashboard/issues?assignee_username=byteblaze&scope=all&sort=created_asc&state=opened">
     <svg class="s16" data-testid="sort-highest-icon"><use href="…#sort-highest"></use></svg>
   </a>
 </div></div>
</div>
```

**Issues menu — every option, verbatim, in DOM order, with the `?sort=` value it produces:**

| # | Menu label | `?sort=` value | Reverse (what `Sort direction` flips to) |
|---|---|---|---|
| 1 | `Priority` | `priority` | (no reverse mapping; button still rendered) |
| 2 | `Created date` | `created_date` | `created_asc` |
| 3 | `Closed date` | `closed_at` | `closed_at_desc` |
| 4 | `Updated date` | `updated_desc` | `updated_asc` |
| 5 | `Milestone due date` | `milestone` | `milestone_due_desc` |
| 6 | `Due date` | `due_date` | `due_date_desc` |
| 7 | `Popularity` | `popularity` | `popularity_asc` |
| 8 | `Label priority` | `label_priority` | — |
| 9 | `Manual` | `relative_position` | — |
| 10 | `Title` | `title_asc` | `title_desc` |

**Merge-requests menu** — same list minus `Due date` and `Manual`, plus `Merged date`, i.e. 9 options in DOM order:
`Priority` (`priority`), `Created date` (`created_date`), `Closed date` (`closed_at`), `Updated date` (`updated_desc`), `Milestone due date` (`milestone`), `Popularity` (`popularity`), `Label priority` (`label_priority`), `Merged date` (`merged_at`), `Title` (`title_asc`).

Reverse-value aliases (both directions render the **same toggle label**, because GitLab maps the "descending twin" back onto the canonical title):
`created_asc → Created date`, `updated_asc → Updated date`, `milestone_due_desc → Milestone due date`, `due_date_desc → Due date`, `merged_at_desc → Merged date`, `closed_at_desc → Closed date`, `popularity_asc → Popularity`, `title_desc → Title`. Also `created_desc` is an accepted alias of `created_date`.

**Sort-direction button:**
- `<a class="gl-button btn btn-default btn-icon has-tooltip reverse-sort-btn rspec-reverse-sort" title="Sort direction">` — tooltip literally `Sort direction`.
- Icon `data-testid="sort-highest-icon"` (`#sort-highest`, arrow pointing down = currently **descending**) vs `data-testid="sort-lowest-icon"` (`#sort-lowest` = currently **ascending**).
- It is a plain link; its `href` is the current URL with `sort=` swapped to the reverse value.

**Bulk edit / `Edit issues`:** **not present** on `/dashboard/issues` or `/dashboard/merge_requests` (`@can_bulk_update` is false outside a project). There is no `check-all-holder`, no per-row `.issue-check` checkbox and no `Edit issues` button here — that button only exists on project-scoped lists.

**⚠ Sort persistence caveat (important for the mock):** GitLab stores the last-used sort **server-side per user** in `user_preferences.issues_sort` / `merge_requests_sort` / `projects_sort`. Any page visited with an explicit `?sort=` (including *project* issue lists) rewrites it, so the "current" sort seen on the dashboard drifts. GitLab's own defaults when nothing is stored are:
`state=opened|all → created_date` (newest created first), `state=closed|merged → updated_desc`.
**Recommendation: the mock should derive sort purely from the `sort` query param, defaulting to `created_date`.** (The pristine capture in `assets/html/dashboard-issues.html` happened to have `created_asc` stored, which is why its rows are oldest-first while the reference screenshot shows Better sharing solution → … → #71.)

### 5a.7 List-row anatomy (`li.issue`)

```html
<ul class="content-list issues-list issuable-list">
<li class="issue" id="issue_83756" data-id="83756" data-labels="[]"
    url="/byteblaze/a11y-syntax-highlighting/-/issues/1"
    data-qa-selector="issue_container" data-qa-issue-title="Tm Theme Editor">
 <div class="issuable-info-container">
  <div class="issuable-main-info">
    <div class="issue-title title">
      <span class="issue-title-text js-onboarding-issue-item" dir="auto">
        <!-- if confidential: <span class="has-tooltip" title="Confidential"><svg …#eye-slash…></svg></span> -->
        <a class="js-prefetch-document" href="/byteblaze/a11y-syntax-highlighting/-/issues/1">Tm Theme Editor</a>
      </span>
      <!-- if the description has checkboxes: -->
      <span class="task-status d-none d-sm-inline-block">&nbsp;1 of 3 checklist items completed</span>
    </div>
    <div class="issuable-info">
      <span class="issuable-reference">byteblaze/a11y-syntax-highlighting#1</span>
      <span class="issuable-authored d-none d-sm-inline-block">
        &middot;
        created <time class="js-timeago" title="Apr 1, 2020 9:13pm PDT" datetime="2020-04-02T04:13:58Z"
                      data-toggle="tooltip" data-placement="bottom" data-container="body">6 years ago</time>
        by <a class="author-link js-user-link" data-user-id="2394" data-username="earlev4" data-name="earle" href="/earlev4"><span class="author">earle</span></a>
      </span>
      <!-- optional milestone -->
      <span class="issuable-milestone d-none d-sm-inline-block">&nbsp;
        <a data-html="true" data-toggle="tooltip" data-title="Dec 31, 2019 (&lt;strong&gt;Past due&lt;/strong&gt;)"
           href="/a11yproject/a11yproject.com/-/issues?milestone_title=Content+Updates+for+2019">
          <svg class="s16 gl-vertical-align-text-bottom" data-testid="clock-icon">…</svg> Content Updates for 2019</a></span>
      <!-- optional due date -->
      <span class="issuable-due-date d-none d-sm-inline-block has-tooltip" title="Due date">&nbsp;<svg …#calendar…></svg> Nov 22, 2022</span>
      <!-- labels -->
      &nbsp;
      <span class="gl-label gl-label-sm"><a class="gl-link gl-label-link"
        href="/byteblaze/empathy-prompts/-/issues?label_name%5B%5D=%5BPriority%5D+Medium">
        <span class="gl-label-text gl-label-text-dark" data-container="body" data-html="true"
              style="background-color: #fef2c0">[Priority] Medium</span></a></span>
    </div>
  </div>
  <div class="issuable-meta">
    <ul class="controls">
      <li class="issuable-status">CLOSED</li>                        <!-- closed rows only; "CLOSED (MOVED)" if moved -->
      <li class="gl-display-flex">                                    <!-- assignees -->
        <a class="author-link has-tooltip" title="Assigned to Byte Blaze" data-container="body"
           data-qa-selector="assignee_link" href="/byteblaze">
          <img width="16" class="avatar avatar-inline s16 js-lazy-loaded" alt=""
               src="https://www.gravatar.com/avatar/…?s=32&d=identicon"></a>
      </li>
      <li class="gl-display-none gl-sm-display-block has-tooltip" title="Related merge requests" data-testid="merge-requests"><svg …#merge-request…></svg> 2</li>
      <li class="gl-display-none gl-sm-display-block has-tooltip" title="Upvotes"   data-testid="issuable-upvotes"><svg …#thumb-up…></svg> 3</li>
      <li class="gl-display-none gl-sm-display-block has-tooltip" title="Downvotes" data-testid="issuable-downvotes"><svg …#thumb-down…></svg> 1</li>
      <li class="gl-display-none gl-sm-display-block">
        <a class="has-tooltip" title="Comments" data-testid="issuable-comments"
           href="/byteblaze/a11y-syntax-highlighting/-/issues/1#notes">
          <svg class="s16 gl-vertical-align-text-bottom" data-testid="comments-icon">…</svg> 14</a></li>
    </ul>
    <div class="float-right issuable-timestamp d-none d-sm-inline-block">
      <span>updated <time class="js-timeago" title="Mar 27, 2023 4:15pm PDT" datetime="2023-03-27T23:15:19Z"
                          data-toggle="tooltip" data-placement="bottom" data-container="body">3 years ago</time></span>
    </div>
  </div>
 </div>
</li>
```

Field-by-field:

| Field | Selector | Exact wording / format |
|---|---|---|
| Row | `ul.issues-list.issuable-list > li.issue` | `id="issue_<db id>"`, `data-id`, `data-labels="[…]"`, `url="<path>"`, `data-qa-selector="issue_container"`, `data-qa-issue-title="<title>"` |
| Confidential icon | `.issue-title-text > span.has-tooltip[title="Confidential"]` | tooltip `Confidential`, icon `eye-slash` — **none present in this seed** |
| Hidden-issue icon | `.issue-title-text` | rendered by `hidden_issue_icon` (spam-hidden); not present in this seed |
| Title link | `.issue-title.title a.js-prefetch-document` | bold 14px, `href` = issue path |
| Task status | `span.task-status.d-none.d-sm-inline-block` | e.g. `1 of 3 checklist items completed`, `3 of 3 checklist items completed` (greyed, right of the title) |
| Reference | `span.issuable-reference` | `byteblaze/a11y-webring.club#71` (full path + `#iid`; MRs use `!iid`) |
| Authored line | `span.issuable-authored.d-none.d-sm-inline-block` | `· created 3 years ago by Byte Blaze` — literally `·` (`&middot;`) then `created ` + relative time + ` by ` + author link |
| Author link | `a.author-link.js-user-link[data-user-id][data-username][data-name] > span.author` | display name (`Byte Blaze`, `Rohan Kumar`, `Administrator`, `earle`) |
| Milestone chip | `span.issuable-milestone.d-none.d-sm-inline-block > a` | clock icon + milestone title, `data-title` tooltip e.g. `Dec 31, 2019 (<strong>Past due</strong>)`; href `…/-/issues?milestone_title=<title urlencoded with +>` |
| Due date | `span.issuable-due-date…` (`.cred` when overdue and open) | `has-tooltip` `title="Due date"`, calendar icon + `Nov 22, 2022` (medium format) |
| Labels | `span.gl-label.gl-label-sm > a.gl-link.gl-label-link > span.gl-label-text` | text = label title; inline `style="background-color: #RRGGBB"`; class `gl-label-text-dark` on light backgrounds, `gl-label-text-light` on dark; href = `…/-/issues?label_name%5B%5D=<title>` |
| Closed badge | `li.issuable-status` | `CLOSED` (or `CLOSED (MOVED)`) |
| Assignee avatars | `li.gl-display-flex > a.author-link.has-tooltip[data-qa-selector="assignee_link"] > img.avatar.avatar-inline.s16` | tooltip **`Assigned to Byte Blaze`**; max 4 rendered, then `span.avatar-counter` with tooltip `+%{n} more assignees` and text `+n` |
| Related-MR count | `li[data-testid="merge-requests"]` | tooltip `Related merge requests` |
| Upvotes | `li[data-testid="issuable-upvotes"]` | tooltip `Upvotes`, thumb-up icon + count (only when > 0 — **0 rows in this seed have any**) |
| Downvotes | `li[data-testid="issuable-downvotes"]` | tooltip `Downvotes`, thumb-down icon (only when > 0) |
| Comment bubble | `a[data-testid="issuable-comments"]` (`title="Comments"`, extra class `no-comments` when count is 0) | comments icon + count, href `<issue path>#notes` |
| Right timestamp | `.float-right.issuable-timestamp.d-none.d-sm-inline-block` | `updated 3 years ago`; for closed issues instead `closed 3 years ago` |

**Relative-time format.** Every date in these lists is a `<time class="js-timeago">`:
- Visible text: `9 years ago`, `7 years ago`, `6 years ago`, `5 years ago`, `4 years ago`, `3 years ago` (`X years ago` / `X months ago` / `X days ago` / `just now`).
- `title=` tooltip: **`Mar 27, 2023 1:16pm PDT`** — `MMM D, YYYY h:mma TZ`, lower-case am/pm, no space before am/pm, viewer timezone abbreviation appended (`PDT`/`PST`).
- `datetime=` is ISO-8601 UTC with `Z`: `2023-03-27T20:16:17Z`.
- Also `data-toggle="tooltip" data-placement="bottom" data-container="body"`.
- Absolute `Mar 27, 2023` style (no time) is used only in due-date chips and milestone tooltips, not in the `created/updated` lines.

### 5a.8 Seeded content on the anchor pages (verified against the live site)

#### `/dashboard/issues?scope=all&state=opened&assignee_username=byteblaze` (ANCHOR)
Tabs `Open 13` / `Closed 53` / `All 66`. 13 rows, no pagination. Full row text (listed newest-created first; re-sort as needed):

| # | Title | Task status | Reference | Author | created (`title=`) | Labels (colour) | 💬 | updated (`title=`) |
|---|---|---|---|---|---|---|---|---|
| 1 | `[Feature suggestion] Support linking to an accessibility statement` | `1 of 3 checklist items completed` | `byteblaze/a11y-webring.club#71` | `Rohan Kumar` | Feb 2, 2023 1:51pm PST | `being discussed` #3060C3, `feature` #67F06F | 1 | Mar 27, 2023 1:17pm PDT |
| 2 | `[Feature suggestion] WCAG trash panda mode` | `1 of 3 checklist items completed` | `byteblaze/a11y-webring.club#39` | `Byte Blaze` | Jan 22, 2023 11:23am PST | `feature` #67F06F, `help wanted` #008672 | 0 | Mar 27, 2023 1:17pm PDT |
| 3 | `[Feature suggestion] Add a submission form` | `1 of 3 checklist items completed` | `byteblaze/a11y-webring.club#30` | `Byte Blaze` | Jan 20, 2023 12:16pm PST | `feature` #67F06F | 0 | Mar 27, 2023 1:17pm PDT |
| 4 | `[Feature suggestion] Color theme slider` | `1 of 3 checklist items completed` | `byteblaze/a11y-webring.club#21` | `Byte Blaze` | Jan 18, 2023 7:58pm PST | `feature` #67F06F, `help wanted` #008672 | 0 | Mar 27, 2023 1:17pm PDT |
| 5 | `Link to WCAG 2.1 instead of 2.0?` | — | `a11yproject/a11yproject.com#1460` | `Byte Blaze` | Aug 11, 2022 9:10am PDT | `claimed` #3b4bbf, `content` #ffce29 | 0 | Mar 23, 2023 1:42am PDT |
| 6 | `The process for writing for us is both scattered and buried` | — | `a11yproject/a11yproject.com#1360` | `Byte Blaze` | Oct 10, 2021 5:35pm PDT | `content` #ffce29, `design` #ffce29 | 2 | Mar 23, 2023 1:41am PDT |
| 7 | `Non-Github contribution guidelines need clarification` | — | `a11yproject/a11yproject.com#1294` | `Byte Blaze` | Jun 16, 2021 7:18pm PDT | `claimed` #3b4bbf, `content` #ffce29 | 2 | Mar 23, 2023 1:41am PDT |
| 8 | `Outdated dependencies` | — | `byteblaze/empathy-prompts#18` | `Byte Blaze` | Jun 1, 2021 5:52pm PDT | `[Priority] Critical` #e11d21, `[Status] Submitted` #fef2c0, `[Type] Bug` #e11d21 | 0 | Mar 27, 2023 1:16pm PDT |
| 9 | `Inaccessibility: Low contrast .c-card__additional in Featured Resource Card` | — | `a11yproject/a11yproject.com#1208` | `Administrator` | Mar 12, 2021 7:56am PST | `accessibility` #e11d21, `resource` #e2fed2, `styling` #f1cbe6 | 7 | Mar 23, 2023 1:41am PDT |
| 10 | `Tm Theme Editor` | — | `byteblaze/a11y-syntax-highlighting#1` | `earle` | Apr 1, 2020 9:13pm PDT | *(none)* | 14 | Mar 27, 2023 4:15pm PDT |
| 11 | `Empathy Balloons` | — | `byteblaze/empathy-prompts#10` | `Rik Williams` | Jun 21, 2019 3:37am PDT | `[Priority] Low` #bfe5bf, `[Status] Accepted` #009800, `[Type] Enhancement` #c7def8 | 2 | Mar 27, 2023 1:16pm PDT |
| 12 | `Better initial load experience` | — | `byteblaze/empathy-prompts#8` | `Byte Blaze` | May 17, 2017 7:29pm PDT | `[Priority] Low` #bfe5bf, `[Status] Submitted` #fef2c0, `[Type] Enhancement` #c7def8 | 0 | Mar 27, 2023 1:16pm PDT |
| 13 | `Better sharing solution` | — | `byteblaze/empathy-prompts#6` | `Byte Blaze` | May 4, 2017 6:31pm PDT | `[Priority] Medium` #fef2c0, `[Status] Submitted` #fef2c0, `[Type] Enhancement` #c7def8 | 2 | Mar 27, 2023 1:16pm PDT |

All 13 have a single assignee avatar with tooltip `Assigned to Byte Blaze`.

Real `data-id` / `id="issue_<id>"` values on the live site (rows 1→13 in the table above):
`83751, 83747, 83746, 83745, 83673, 83647, 83626, 83733, 83604, 83756, 83731, 83744, 83741`.
Each row also carries `url="<issue path>"`, `data-labels="[…label ids…]"`, `data-qa-selector="issue_container"` and `data-qa-issue-title="<title>"`. Any stable ids work in the mock; only the `issue_<id>` / `data-qa-*` *patterns* matter to graders.

#### ⚠ The four ANCHOR strings are **post-action** state, not seed state

| Anchor string | Where the grader looks | Current live state |
|---|---|---|
| `Add documentation on using Flash alerts in dialog components` (ANCHOR, webarena-804/-810) | `/dashboard/issues?scope=all&state=opened&assignee_username=byteblaze` **and** `…=primer` | Issue **`primer/design#104`**, open, currently assigned to **`yaili` (Inayaili León)**, author `emplums`, created 2020-05-20, label `area: documentation`. **Not** on either dashboard page yet. |
| `Clarify usage of flash alert` (ANCHOR, webarena-804/-810) | same two URLs | Issue **`primer/design#316`**, open, **unassigned**, author `lukasoppermann`, created 2022-10-21, labels `area: documentation`, `effort: low`, `type: bug 🐞`. **Not** on either dashboard page yet. |
| `404s, bad host, timeouts, bad urls for URLs linked from website` (ANCHOR, webarena-446/-811) | `…&assignee_username=Roshanjossey` and `…&assignee_username=byteblaze` | Issue **`a11yproject/a11yproject.com#1478`**, title verbatim **`[Bug]  404s, bad host, timeouts, bad urls for URLs linked from website`** (note the **double space** after `[Bug]`), open, **unassigned**, 6 comments, created 2022-10-03, updated 2023-03-01. **Not** on either dashboard page yet. |
| `linking to an accessibility statement` (ANCHOR, webarena-447) | `/dashboard/issues?scope=all&state=opened&assignee_username=Seirdy` | Issue `byteblaze/a11y-webring.club#71` `[Feature suggestion] Support linking to an accessibility statement`, currently assigned to **byteblaze only**. `?assignee_username=Seirdy` currently returns **0 rows** + the "Sorry, your filter produced no results" empty state. |

→ **The mock must implement issue assignment as a real mutation** (from the issue detail page's right sidebar) and have `/dashboard/issues?...&assignee_username=<u>` re-query that mutated state. webarena-804 additionally requires *adding `primer` as an assignee* (its second check is `assignee_username=primer`), so **multi-assignee** support is required, and the row must then render two avatars (`Assigned to Byte Blaze`, `Assigned to Primer`). `primer` is a real **user** (id 2367, name `Primer`), not a group.

#### `/dashboard/issues?scope=all&state=opened&assignee_username=primer` (ANCHOR)
Tabs `Open 0` / `Closed 0` / `All 0`. Token chip renders `Assignee = Primer`. Body = the *filtered* empty state (5a.9).

#### `/dashboard/issues?scope=all&state=opened&assignee_username=Roshanjossey` (ANCHOR)
Tabs `Open 4` / `Closed 0` / `All 4`. Token chip `Assignee = Roshan Jossy`. 4 rows, all assigned to `Roshan Jossy` (tooltip `Assigned to Roshan Jossy`), all in `a11yproject/a11yproject.com`:

| Title | Task status | Reference | Author | created | Labels | 💬 | updated |
|---|---|---|---|---|---|---|---|
| `Create an Offline page` | — | `a11yproject/a11yproject.com#1064` | `Byte Blaze` | Aug 16, 2020 4:12pm PDT | `claimed` #3b4bbf, `design` #ffce29, `feature` #d4c5f9, `help wanted` #e11d21, `javascript` #f1cbe6 | 6 | Mar 27, 2023 11:50am PDT |
| `Article: Starting a design with accessibility` | — | `a11yproject/a11yproject.com#1334` | `Steve Barnett` | Aug 21, 2021 4:14pm PDT | `claimed` #3b4bbf, `post` #e2fed2 | 1 | Mar 27, 2023 11:40am PDT |
| `[Post] Bake accessibility into your design and development process` | `3 of 3 checklist items completed` | `a11yproject/a11yproject.com#1447` | `Matt Obee` | Jul 4, 2022 8:51am PDT | `claimed` #3b4bbf, `post` #e2fed2 | 1 | Mar 27, 2023 11:48am PDT |
| `[Post] HOWTO: Ajax with ARIA-LIVE` | `3 of 3 checklist items completed` | `a11yproject/a11yproject.com#1533` | `Paul McFedries` | Mar 22, 2023 10:48am PDT | `claimed` #3b4bbf, `post` #e2fed2 | 0 | Mar 27, 2023 11:38am PDT |

#### `/dashboard/issues?scope=all&state=opened&assignee_username=Seirdy` (ANCHOR)
Tabs `Open 0` / `Closed 0` / `All 0`. Token chip `Assignee = Rohan Kumar`. Filtered empty state.

#### `?state=closed&assignee_username=byteblaze` (for reference)
53 rows over **3 pages** (20/page). Rows carry `li.issuable-status` → `CLOSED`, and the right-hand timestamp reads `closed 3 years ago`. Milestone chips appear here, e.g. `Content Updates for 2019` with tooltip `Dec 31, 2019 (Past due)` on `a11yproject/a11yproject.com`.

### 5a.9 Empty states

**No filter set** (`/dashboard/issues`, or `?scope=assigned_to_me`/`created_by_me` with nothing else):

```html
<div class="row empty-state text-center">
  <div class="col-12"><div class="svg-130 gl-mt-3">
     <img src="/assets/illustrations/issue-dashboard_results-without-filter-….svg"></div></div>
  <div class="col-12"><div class="text-content">
     <h4>Please select at least one filter to see results</h4></div></div>
</div>
```
Copy verbatim: `Please select at least one filter to see results`. State tabs render **without** count badges in this mode.

**Filter set but no matches** (`assignee_username=primer`, `=Seirdy`, `=nosuchuser`, `state=closed` on MRs, …):

```html
<div class="row empty-state">
  <div class="col-12"><div class="svg-content"><img src="/assets/illustrations/issues-….svg"></div></div>
  <div class="col-12"><div class="text-content">
    <h4 class="text-center">Sorry, your filter produced no results</h4>
    <p class="text-center">To widen your search, change or remove filters above</p>
  </div></div>
</div>
```
Copy verbatim: `Sorry, your filter produced no results` / `To widen your search, change or remove filters above`. (On the dashboard there is **no** "New issue" button under it.)

### 5a.10 Pagination

Offset pagination, **20 rows per page**, rendered by the `gitlab` Kaminari theme:

```html
<div class="gl-pagination gl-mt-3">
 <ul class="pagination justify-content-center">
  <li class="page-item js-previous-button disabled"><a rel="prev" class="page-link" href="#">Prev</a></li>
  <li class="page-item js-pagination-page active js-first-button"><a class="page-link active" href="/dashboard/issues?assignee_username=byteblaze&scope=all&state=closed">1</a></li>
  <li class="page-item js-pagination-page sibling d-none d-md-block"><a rel="next" class="page-link" href="…&page=2&…">2</a></li>
  <li class="page-item js-pagination-page js-last-button d-none d-md-block"><a class="page-link" href="…&page=3&…">3</a></li>
  <li class="page-item js-next-button"><a rel="next" class="page-link" href="…&page=2&…">Next</a></li>
 </ul>
</div>
```

- Labels `Prev` and `Next`; when on page 1 the Prev `li` gets `disabled` and `href="#"`; when on the last page the Next `li` gets `disabled`.
- With ≥5 pages the Prev/Next anchors carry left/right chevron SVGs (`data-testid="chevron-lg-left-icon"` / `chevron-lg-right-icon`) and the page numbers get classes `js-first-button`, `sibling`, `active`, `js-last-button`.
- Centred (`justify-content-center`), 12px above the list.

### 5a.11 Component inventory (this view)

| Component | Selector | URL-changing? |
|---|---|---|
| Split "create issue" button | `.project-item-select-holder a.js-new-project-item-link` + `button.new-project-item-select-button` | opens a project-picker dropdown (`Search for project`); choosing navigates to `/<ns>/<proj>/-/issues/new` |
| State tabs | `ul.issues-state-filters a#state-opened|state-closed|state-all` | **yes** — `?state=` |
| RSS / calendar | `.nav-controls a[data-testid="rss-feed-link"]`, sibling | navigates to `.atom` / `.ics` |
| Recent-searches dropdown | `.filtered-search-history-dropdown-toggle-button` | selecting an entry **yes** (re-applies params) |
| Token bar | `.filtered-search-box`, `#filtered-search-issues` | **yes** on submit (Enter) |
| Token remove ✕ | `li.filtered-search-token .remove-token` | **yes** |
| Clear-all ✕ | `button.clear-search` | **yes** |
| Sort dropdown | `.js-redirect-listbox button[data-testid="base-dropdown-toggle"]` → `ul#listbox li[role=option]` | **yes** — `?sort=` |
| Sort-direction | `a.reverse-sort-btn.rspec-reverse-sort` (`title="Sort direction"`) | **yes** — `?sort=` reverse value |
| Pagination | `.gl-pagination a.page-link` | **yes** — `?page=` |
| Tooltips | any `.has-tooltip` / `[data-toggle="tooltip"]` | no |


## 5b. `/dashboard/merge_requests`

### 5b.1 Routes & `<title>`

| Route | `<title>` |
|---|---|
| `/dashboard/merge_requests` | `Merge requests · Dashboard · GitLab` |
| `/dashboard/merge_requests?assignee_username=byteblaze` | idem — **(ANCHOR** — webarena-156, "Go to the merge requests assigned to me", `url_match`**)** |
| `/dashboard/merge_requests?reviewer_username=byteblaze` | idem — **(ANCHOR** — webarena-357, "Go to the merge requests requiring my review"**)** |
| `/dashboard/merge_requests?assignee_username=byteblaze&state=merged|closed|all` | idem |

Reachable from the navbar MR icon (badge `8`), whose dropdown contains `Assigned to you 3` → `/dashboard/merge_requests?assignee_username=byteblaze` and `Review requests for you 5` → `/dashboard/merge_requests?reviewer_username=byteblaze`.

Layout is identical to 5a.2 (no breadcrumb, no sidebar, `#content-body` x=336 w=1248).

### 5b.2 Header

```html
<div class="page-title-holder d-flex align-items-start flex-column flex-sm-row align-items-sm-center">
  <h1 class="page-title gl-font-size-h-display">Merge requests</h1>
  <div class="page-title-controls ml-0 mb-3 ml-sm-auto mb-sm-0">
    … split button, label "Select project to create merge request", data-type="merge_requests" …
  </div>
</div>
```
- h1 verbatim: `Merge requests` (lower-case r).
- Button verbatim: `Select project to create merge request`; caret `aria-label="Toggle project select"`.
- **No** RSS / calendar buttons on this page (`.top-area` has no `.nav-controls`).

### 5b.3 Open / Merged / Closed / All tabs

| Tab | Label | Tooltip (`title=`) | id | Query | `?assignee_username=byteblaze` | `?reviewer_username=byteblaze` |
|---|---|---|---|---|---|---|
| 1 | `Open` | `Filter by merge requests that are currently open.` | `state-opened` | `?…&state=opened` | **3** | **5** |
| 2 | `Merged` | `Filter by merge requests that are currently merged.` | `state-merged` | `?…&state=merged` | **3** | **147** |
| 3 | `Closed` | `Filter by merge requests that are currently closed and unmerged.` | `state-closed` | `?…&state=closed` | **0** | **7** |
| 4 | `All` | `Show all merge requests.` | `state-all` | `?…&state=all` | **6** | **159** |

Same `ul.issues-state-filters.gl-border-b-0.gl-flex-grow-1.nav.gl-tabs-nav` markup and `gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge` counters as issues.

### 5b.4 Filtered-search bar & sort

Identical component to 5a.5/5a.6, with these deltas:
- input id `#filtered-search-merge_requests`.
- 13 hint entries (listed in 5a.5), incl. `Reviewer`, `Approved-By`, `Draft`, `Environment`, `Deployed-before`, `Deployed-after`.
- `#js-dropdown-target-branch` is suppressed on the dashboard (`disable_target_branch: true`).
- Sort menu: 9 options ending `Merged date` (`merged_at`) then `Title` (`title_asc`); no `Due date`, no `Manual`.
- Sort direction link e.g. `/dashboard/merge_requests?assignee_username=byteblaze&sort=created_asc`, `title="Sort direction"`.
- Token chips: `Assignee = Byte Blaze` on the assignee anchor page, `Reviewer = Byte Blaze` on the reviewer anchor page.
- Extra query params relative to issues: `reviewer_username`, `approved_by_usernames[]`, `draft=yes|no`, `environment`, `deployed_before`, `deployed_after`, `target_branch`.

### 5b.5 Row anatomy (`li.merge-request`)

```html
<ul class="content-list mr-list issuable-list">
<li class="merge-request" id="merge_request_138783" data-id="138783" data-labels="[]">
 <div class="issuable-info-container">
  <div class="issuable-main-info">
    <div class="merge-request-title title">
      <span class="merge-request-title-text js-onboarding-mr-item">
        <a class="js-prefetch-document" href="/byteblaze/a11y-webring.club/-/merge_requests/40">Add verification functions</a>
      </span>
      <!-- optional: <span class="task-status d-none d-sm-inline-block">&nbsp;2 of 5 checklist items completed</span> -->
    </div>
    <div class="issuable-info">
      <span class="issuable-reference">byteblaze/a11y-webring.club!40</span>
      <span class="issuable-authored d-none d-sm-inline-block">
        &middot; created <time class="js-timeago" title="Jan 22, 2023 11:29am PST" datetime="2023-01-22T19:29:17Z" …>3 years ago</time>
        by <a class="author-link js-user-link" data-user-id="2365" data-username="davepgreene" data-name="Dave Greene" href="/davepgreene"><span class="author">Dave Greene</span></a>
      </span>
      <!-- optional milestone: span.issuable-milestone -->
      <!-- optional target branch (only when != default branch):
           <span class="project-ref-path has-tooltip" title="Target branch">&nbsp;<a class="ref-name" href="…"><svg …#branch…></svg> release-1.2</a></span> -->
      &nbsp;
      <span class="gl-label gl-label-sm"><a class="gl-link gl-label-link" href="/a11yproject/a11yproject.com/-/merge_requests?label_name%5B%5D=data">
        <span class="gl-label-text gl-label-text-dark" style="background-color: #f1cbe6">data</span></a></span>
    </div>
  </div>
  <div class="issuable-meta">
    <ul class="controls d-flex align-items-end">
      <li class="issuable-status d-none d-sm-inline-block">MERGED</li>   <!-- or: <svg …#cancel…></svg> CLOSED -->
      <li class="issuable-pipeline-status d-none d-sm-flex">
        <a class="ci-status-link ci-status-icon ci-status-icon-failed has-tooltip d-flex"
           title="Pipeline: failed" data-placement="left" href="/…/-/pipelines/1823">
          <svg class="s16" data-testid="status_failed-icon">…</svg></a></li>
      <li class="issuable-pipeline-broken d-none d-sm-flex">
        <a class="has-tooltip" title="Cannot be merged automatically" href="/…/-/merge_requests/1270">
          <svg class="s16" data-testid="warning-solid-icon">…</svg></a></li>
      <li class="gl-display-flex gl-align-items-center">          <!-- assignees -->
        <a class="author-link has-tooltip" title="Assigned to Byte Blaze" data-qa-selector="assignee_link" href="/byteblaze"><img …s16…></a></li>
      <li class="gl-display-flex issuable-reviewers">             <!-- reviewers -->
        <a class="author-link has-tooltip" title="Review requested from Byte Blaze" data-qa-selector="assignee_link" href="/byteblaze"><img …s16…></a>
        <a class="author-link has-tooltip" title="Review requested from Agustina Chaer" …></a>
        <a class="author-link has-tooltip" title="Review requested from EJ Mason" …></a></li>
      <li class="d-none d-sm-inline-block has-tooltip text-success" title="1 approver">
        <svg class="align-middle" …#approval…></svg> Approved</li>
      <li class="gl-display-none gl-sm-display-block">
        <a class="has-tooltip" title="Comments" data-testid="issuable-comments" href="/…/-/merge_requests/1270#notes">
          <svg class="s16 gl-vertical-align-text-bottom" data-testid="comments-icon">…</svg> 17</a></li>
    </ul>
    <div class="float-right issuable-updated-at d-none d-sm-inline-block">
      <span>updated <time class="js-timeago merge_request_updated_ago" title="Mar 27, 2023 4:21pm PDT" datetime="2023-03-27T23:21:22Z" …>3 years ago</time></span>
    </div>
  </div>
 </div>
</li>
```

Deltas vs `li.issue`:
- Row class `merge-request`, dom id `merge_request_<id>`; **no** `url=` / `data-qa-*` attributes.
- Reference uses `!` : `a11yproject/a11yproject.com!1485`.
- Right timestamp wrapper class is **`issuable-updated-at`** (not `issuable-timestamp`) and the `<time>` gets the extra class `merge_request_updated_ago`. Text always `updated <relative> ago` (never "closed …").
- Status badges: `MERGED` (plain text) and `CLOSED` (cancel icon + text), both inside `li.issuable-status.d-none.d-sm-inline-block`.
- Pipeline status chip `li.issuable-pipeline-status` with `a.ci-status-link.ci-status-icon.ci-status-icon-<state>` and tooltip `Pipeline: failed` (also `Pipeline: passed`, `Pipeline: running`, …), `data-placement="left"`.
- Merge-conflict chip `li.issuable-pipeline-broken`, tooltip `Cannot be merged automatically`, icon `warning-solid`.
- Reviewer avatars in `li.issuable-reviewers`, tooltip **`Review requested from <name>`**; overflow `span.avatar-counter` tooltip `+%{n} more reviewers`.
- Approvals chip: `li.d-none.d-sm-inline-block.has-tooltip.text-success` with visible text **`Approved`** and tooltip `1 approver` / `2 approvers` (or `1 approver (you've approved)` / `N approvers (you've approved)` when the viewer approved). Icon `approval` (or `approval-solid` when self-approved).
- Labels link to `…/-/merge_requests?label_name%5B%5D=<title>`.

### 5b.6 Seeded content — `?assignee_username=byteblaze` (ANCHOR)

Tabs `Open 3` / `Merged 3` / `Closed 0` / `All 6`. Token `Assignee = Byte Blaze`. 3 rows, no pagination:

| Title | Reference | Author | created | Labels | Pipeline | Conflict | Assignees | Reviewers | 💬 | updated |
|---|---|---|---|---|---|---|---|---|---|---|
| `Add verification functions` | `byteblaze/a11y-webring.club!40` | `Dave Greene` | Jan 22, 2023 11:29am PST | — | `Pipeline: failed` | — | `Assigned to Byte Blaze` | — | 0 | Mar 27, 2023 4:14pm PDT |
| `update or remove 404 links` | `a11yproject/a11yproject.com!1485` | `Roshan Jossy` | Oct 24, 2022 2:43pm PDT | — | `Pipeline: failed` | `Cannot be merged automatically` | `Assigned to Byte Blaze` | — | 0 | Mar 27, 2023 4:19pm PDT |
| `feat: add WCAG levels` | `a11yproject/a11yproject.com!1270` | `Agustina Chaer` | May 9, 2021 7:37am PDT | `data` #f1cbe6, `javascript` #f1cbe6, `markup` #f1cbe6, `styling` #f1cbe6 | `Pipeline: failed` | `Cannot be merged automatically` | `Assigned to Byte Blaze` | `Byte Blaze`, `Agustina Chaer`, `EJ Mason` | 17 | Mar 27, 2023 4:21pm PDT |

### 5b.7 Seeded content — `?reviewer_username=byteblaze` (ANCHOR)

Tabs `Open 5` / `Merged 147` / `Closed 7` / `All 159`. Token `Reviewer = Byte Blaze`. 5 rows, no pagination on the Open tab:

| Title | Reference | Author | created | Labels | Pipeline | Conflict | Assignees | Reviewers | Approvals | 💬 | updated |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `WIP - Post: Pitfalls of accessible components` | `a11yproject/a11yproject.com!1490` | `Erik Kroes` | Nov 30, 2022 12:47am PST | — | `Pipeline: failed` | — | — | `Byte Blaze` | — | 26 | Mar 23, 2023 1:20am PDT |
| `How to: Article how to make an accessible nav with dropdowns` | `a11yproject/a11yproject.com!1472` | `James Bateson` | Sep 4, 2022 9:23am PDT | — | `Pipeline: failed` | — | — | `James Bateson`, `Byte Blaze` | — | 50 | Mar 23, 2023 12:43am PDT |
| `Feat/toggle checklist groups` | `a11yproject/a11yproject.com!1280` | `rachel fischoff` | May 21, 2021 2:08pm PDT | `checklist` #e2fed2, `javascript` #f1cbe6, `markup` #f1cbe6 | `Pipeline: failed` | — | — | `rachel fischoff`, `Byte Blaze`, `EJ Mason` | **`Approved`** | 22 | Mar 23, 2023 1:46am PDT |
| `feat: add WCAG levels` | `a11yproject/a11yproject.com!1270` | `Agustina Chaer` | May 9, 2021 7:37am PDT | `data`, `javascript`, `markup`, `styling` (all #f1cbe6) | `Pipeline: failed` | `Cannot be merged automatically` | `Byte Blaze` | `Byte Blaze`, `Agustina Chaer`, `EJ Mason` | — | 17 | Mar 27, 2023 4:21pm PDT |
| `Fix card focus edge cases` | `a11yproject/a11yproject.com!1265` | `EJ Mason` | Apr 29, 2021 11:49am PDT | `accessibility` #e11d21, `styling` #f1cbe6 | *(none)* | `Cannot be merged automatically` | `Assigned to EJ Mason` | `Byte Blaze` | — | 1 | Mar 23, 2023 1:46am PDT |

### 5b.8 Other states / pagination / empty state

- `?assignee_username=byteblaze&state=merged` → 3 rows, each with `li.issuable-status` → `MERGED`.
- `?assignee_username=byteblaze&state=closed` → 0 rows → `Sorry, your filter produced no results` / `To widen your search, change or remove filters above`.
- `?reviewer_username=byteblaze&state=merged` → 147 rows over **8 pages** (20/page). Full pager on page 4:
  `Prev` · `1` · `2` · `3` · **`4`** (active) · `5` · `6` · `7` · `8` · `Next`, hrefs `/dashboard/merge_requests?page=N&reviewer_username=byteblaze&state=merged`. Page-1 link omits `page`.
- Bare `/dashboard/merge_requests` (no filter) → `Please select at least one filter to see results`, tabs without counts.
- MR "no results with filters" empty state is the same copy but with illustration `illustrations/merge_requests.svg` and wrapper class `.row.empty-state.merge-requests`.


## 6a. `/explore` and `/explore/projects/trending`

### 6a.1 Routes & `<title>`

| Route | `<title>` | Notes |
|---|---|---|
| `/explore` | `Projects · Explore · GitLab` | **(ANCHOR** — webarena-258 "Open the public projects listing", `url_match`**)** |
| `/explore/projects` | `Projects · Explore · GitLab` | identical page; `All` sub-tab active |
| `/explore/projects/starred` | `Projects · Explore · GitLab` | see 6b |
| `/explore/projects/trending` | `Projects · Explore · GitLab` | see 6a.6 |
| `/explore/projects/topics` | `Projects · Explore · GitLab` | 4th outer tab (adjacent, not documented in depth here) |

**All `/explore*` routes are reachable logged-out** — verified HTTP 200 with no session. `/groups/*` and `/dashboard/*` are not (they 302 to `/users/sign_in`). The logged-out rendering is materially different (6a.5).

No breadcrumb bar, no left sidebar. `#content-body` at x=336, width **1248**, inside `.container-fluid.container-limited`.

### 6a.2 Logged-in page chrome (byteblaze)

```html
<div class="page-title-holder d-flex align-items-center">
  <h1 class="page-title gl-font-size-h-display">Projects</h1>       <!-- 28px / 600, x=336 w=129 -->
  <div class="page-title-controls">
    <a data-qa-selector="new_project_button" class="gl-button btn btn-md btn-confirm" href="/projects/new">
      <span class="gl-button-text">New project</span></a>
  </div>
</div>
```

**h1 is `Projects`, not "Explore projects"**, when signed in. Button `New project` (blue).

**Outer tab strip** — `.top-area > .scrolling-tabs-container.inner-page-scroll-tabs > ul.scrolling-tabs.nav-links.nav.gl-tabs-nav.is-initialized` (with `.fade-left` / `.fade-right` overlays):

| Tab label | href | Count badge | Active on |
|---|---|---|---|
| `Yours` | `/dashboard/projects` | `14` | — |
| `Starred` | `/dashboard/projects/starred` | `3` | — |
| `Explore` | `/explore` | — | `/explore`, `/explore/projects`, `/explore/projects/starred`, `/explore/projects/trending` |
| `Topics` | `/explore/projects/topics` | — | `/explore/projects/topics` |

Badges: `span.gl-badge.badge.badge-pill.badge-muted.sm.gl-tab-counter-badge`. The `Yours` link also carries class `shortcuts-activity`. All four carry `data-placement="right"`.

**`.nav-controls`** on the same row — the project filter form:

```html
<form class="project-filter-form" id="project-filter-form" data-qa-selector="project_filter_form_container"
      action="/explore?sort=name_asc" method="get" accept-charset="UTF-8">
  <input type="search" name="name" id="project-filter-form-field" placeholder="Filter by name"
         class="project-filter-form-field form-control input-short js-projects-list-filter" spellcheck="false">
  <input type="hidden" name="sort" id="sort" value="name_asc" autocomplete="off">
  <input type="submit" name="commit" class="gl-display-none!" data-disable-with="">
  <div class="dropdown js-project-filter-dropdown-wrap gl-display-inline">
    <button class="dropdown-menu-toggle" id="sort-projects-dropdown" type="button" data-toggle="dropdown" data-display="static">
      <span class="dropdown-toggle-text">Name</span></button>
    <ul class="dropdown-menu dropdown-menu-right dropdown-menu-selectable"> … </ul>
  </div>
</form>
```
- Search input placeholder verbatim: **`Filter by name`** (no ellipsis). x=1140, w=280, h=34. Param name is `name`.
- Sort toggle button x=1424 w=160 h=35; `#sort-projects-dropdown`, current label in `span.dropdown-toggle-text`.

**Sort dropdown — every entry verbatim, in DOM order** (a `ul.dropdown-menu.dropdown-menu-right.dropdown-menu-selectable`; the active entries carry `class="is-active"`):

| Section | Label | href (on `/explore`) → `?sort=` |
|---|---|---|
| `Sort by` (`li.dropdown-header`) | — | — |
| | `Updated date` | `/explore?sort=latest_activity_desc` |
| | `Last created` | `/explore?sort=created_desc` |
| | `Name` | `/explore?sort=name_asc` |
| | `Name, descending` | `/explore?sort=name_desc` |
| | `Most stars` | `/explore?sort=stars_desc` |
| | `Oldest updated` | `/explore?sort=latest_activity_asc` |
| | `Oldest created` | `/explore?sort=created_asc` |
| `<li class="divider">` | | |
| | `Hide archived projects` | `/explore?sort=<current>` (default, `is-active`) |
| | `Show archived projects` | `/explore?archived=true&sort=<current>` |
| | `Show archived projects only` | `/explore?archived=only&sort=<current>` |
| `<li class="divider">` | | |
| | `Owned by anyone` | `/explore?sort=<current>` (default, `is-active`) — **logged-in only** |
| | `Owned by me` | `/explore?personal=true&sort=<current>` — **logged-in only** |

Default sort: **logged-in byteblaze → `Name` (`sort=name_asc`)** (this is the state in the pristine snapshot); **logged-out → `Updated date` (`sort=latest_activity_desc`)**. Like the issue sort, the logged-in value is persisted in `user_preferences.projects_sort`, so treat `?sort=` as authoritative and default to `name_asc` to match the reference screenshots.

**Second `.top-area`** — the visibility row:

```html
<div class="top-area">
  <ul class="gl-display-flex gl-flex-grow-1 gl-border-none nav gl-tabs-nav">
    <li class="nav-item"><a class="nav-link gl-tab-nav-item active gl-tab-nav-item-active" href="/explore/projects">All</a></li>
    <li class="nav-item"><a class="nav-link gl-tab-nav-item" href="/explore/projects/starred">Most stars</a></li>
    <li class="nav-item"><a class="nav-link gl-tab-nav-item" href="/explore/projects/trending">Trending</a></li>
  </ul>
  <div class="nav-controls">
    <span class="gl-float-left">Visibility:</span>
    <div class="gl-dropdown dropdown btn-group b-dropdown js-redirect-listbox gl-ml-3">
      <button data-testid="base-dropdown-toggle" class="btn btn-default btn-md gl-button gl-dropdown-toggle dropdown-toggle">
        <span class="gl-button-text"><span class="gl-dropdown-button-text">Any</span></span></button>
      <div data-testid="base-dropdown-menu" class="dropdown-menu"><div class="gl-dropdown-inner">
        <ul id="listbox" role="listbox" class="gl-dropdown-contents …">
          <li role="option" aria-selected="true" class="gl-dropdown-item gl-listbox-item"><span class="dropdown-item"><span class="gl-dropdown-item-text-wrapper">Any</span></span></li>
          <li role="option" …>… Private …</li>
          <li role="option" …>… Internal …</li>
          <li role="option" …>… Public …</li>
        </ul></div></div>
    </div>
  </div>
</div>
```

**Sub-tab labels (verbatim, 3 of them): `All` / `Most stars` / `Trending`.** (There is **no** "Explore" sub-tab — "Explore" is one of the *outer* tabs `Yours / Starred / Explore / Topics`.)

Visibility control: literal text `Visibility:` (in `span.gl-float-left`) followed by a `gl_redirect_listbox_tag`. Options verbatim + resulting query (verified against `ExploreHelper#projects_filter_items`):

| Option | href |
|---|---|
| `Any` *(default, `aria-selected="true"`)* | current path with **no** `visibility_level` param |
| `Private` | `?visibility_level=0` |
| `Internal` | `?visibility_level=10` |
| `Public` | `?visibility_level=20` |

The whole `Visibility:` control is rendered **only when signed in** (`- if current_user`).

### 6a.3 Project row anatomy (`li.project-row`)

Container `div.js-projects-list-holder[data-qa-selector="projects_list"] > ul.projects-list.gl-text-secondary.gl-w-full.gl-my-2`.

```html
<li class="project-row">                                    <!-- x=336 w=1248 h≈90 -->
  <div class="project-cell gl-w-11">                        <!-- x=336 w=64 : avatar column -->
    <a class="project" href="/a11yproject/a11yproject.com">
      <div alt="" class="gl-avatar gl-avatar-s48 gl-mr-5 gl-avatar-identicon gl-avatar-identicon-bg7">A</div>
    </a>
  </div>
  <div class="project-cell">
    <div class="project-details gl-pr-9 gl-sm-pr-0 gl-w-full gl-display-flex gl-flex-direction-column"
         data-qa-project-name="a11yproject.com" data-qa-selector="project_content">   <!-- x=400 w=625 -->
      <div class="gl-display-flex gl-align-items-center gl-flex-wrap-wrap">
        <h2 class="gl-font-base gl-line-height-20 gl-my-0">
          <a class="text-plain gl-mr-3 js-prefetch-document" href="/a11yproject/a11yproject.com">
            <span class="namespace-name gl-font-weight-normal">The A11Y Project /</span>
            <span class="project-name">a11yproject.com</span></a>
        </h2>
        <span class="gl-mr-3 has-tooltip" data-container="body" data-placement="top"
              title="Public - The project can be accessed without any authentication.">
          <svg class="s16" data-testid="earth-icon"><use href="…#earth"></use></svg></span>
        <span class="user-access-role gl-display-block gl-m-0" data-qa-selector="user_role_content">Maintainer</span>
      </div>
      <div class="description gl-display-none gl-sm-display-block gl-overflow-hidden gl-mr-3 gl-mt-2">
        <p data-sourcepos="1:1-1:83" dir="auto">The A11Y Project is a community-driven effort to make digital accessibility easier.</p>
      </div>
      <!-- mobile-only duplicate of the counters + updated note -->
      <div class="gl-display-flex gl-mt-3 gl-sm-display-none!"> … </div>
    </div>
  </div>
  <div class="project-cell gl-xs-display-none!">
    <div class="project-controls gl-display-flex gl-flex-direction-column gl-w-full gl-lg-flex-direction-row gl-justify-content-space-between"
         data-testid="project_controls">                    <!-- x=1099 w=485 -->
      <div class="controls gl-display-flex gl-align-items-center">
        <a class="… icon-wrapper has-tooltip stars"          title="Stars"          href="/a11yproject/a11yproject.com/-/starrers"><svg class="s14 gl-mr-2" data-testid="star-o-icon">…</svg> 21</a>
        <a class="… icon-wrapper has-tooltip forks"          title="Forks"          href="/a11yproject/a11yproject.com/-/forks"><svg class="s14 gl-mr-2" data-testid="fork-icon">…</svg> 0</a>
        <a class="… icon-wrapper has-tooltip merge-requests" title="Merge requests" href="/a11yproject/a11yproject.com/-/merge_requests"><svg class="s14 gl-mr-2" data-testid="git-merge-icon">…</svg> 10</a>
        <a class="… icon-wrapper has-tooltip issues"         title="Issues"         href="/a11yproject/a11yproject.com/-/issues"><svg class="s14 gl-mr-2" data-testid="issues-icon">…</svg> 40</a>
      </div>
      <div class="updated-note gl-white-space-nowrap gl-justify-content-end">
        <span>Updated <time class="js-timeago" title="Mar 27, 2023 1:15pm PDT" datetime="2023-03-27T20:15:32Z"
                            data-toggle="tooltip" data-placement="top" data-container="body">3 years ago</time></span>
      </div>
    </div>
  </div>
</li>
```

| Field | Selector | Notes |
|---|---|---|
| Avatar | `a.project > div.gl-avatar.gl-avatar-s48.gl-avatar-identicon.gl-avatar-identicon-bg<1-7>` | 48px rounded square, first character of the project name (`A`, `2`, `C`, `P`, …), pastel bg picked by `gl-avatar-identicon-bg1..bg7`. **Every project in this seed uses an identicon**, none has an uploaded avatar image. |
| Namespace / name | `h2 > a.text-plain > span.namespace-name` + `span.project-name` | rendered as `The A11Y Project / a11yproject.com` — namespace in normal weight, project name **bold** |
| Visibility icon | `span.has-tooltip > svg.s16[data-testid="earth-icon"]` (public, 19/20 rows on page 1) / `[data-testid="lock-icon"]` (private, verified on `accessible-html-content-patterns`) / `[data-testid="shield-icon"]` (internal — not present in this seed) | tooltips: `Public - The project can be accessed without any authentication.` · `Private - Project access must be granted explicitly to each user. If this project is part of a group, access is granted to members of the group.` · `Internal - The project can be accessed by any logged in user except external users.` |
| Access-role badge | `span.user-access-role[data-qa-selector="user_role_content"]` | pill; observed values `Owner`, `Maintainer`. Absent for projects the viewer is not a member of, and **always absent when logged out**. |
| Description | `div.description > p[data-sourcepos]` | rendered markdown, clamped; may contain emoji (`💄`, `🌐`, `♿️`, `📟`) |
| Counters | `.project-controls .controls a.icon-wrapper.stars|forks|merge-requests|issues` | tooltips verbatim `Stars`, `Forks`, `Merge requests`, `Issues`; hrefs `…/-/starrers`, `…/-/forks`, `…/-/merge_requests`, `…/-/issues`; numbers abbreviate above 1000 (`1.5k`, `1.6k`, `3.5k`) |
| Updated | `.updated-note > span` | literally `Updated ` + `<time class="js-timeago">3 years ago</time>`; tooltip `Mar 27, 2023 1:15pm PDT`, `data-placement="top"` |

### 6a.4 `/explore` first page (logged-in, `sort=name_asc`, 20 rows)

| # | Namespace / name | Vis | Role | Description | ★ | ⑂ | MR | ⓘ Issues | Updated (tooltip) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `yjlou / 2019-nCov` | Public | — | `Use Google Maps Timeline data to compare with COVID-19 patient history location.` | 8 | 0 | 0 | 0 | Mar 19, 2023 1:05pm PDT |
| 2 | `Byte Blaze / a11y-syntax-highlighting` | Public | `Owner` | `💄 Accessible light and dark syntax highlighting themes` | 1 | 0 | 0 | 1 | Mar 27, 2023 4:22pm PDT |
| 3 | `Byte Blaze / a11y-webring.club` | Public | `Owner` | `🌐 A webring for digital accessibility practitioners.` | 2 | 0 | 1 | 4 | Mar 27, 2023 4:22pm PDT |
| 4 | `The A11Y Project / a11yproject.com` | Public | `Maintainer` | `The A11Y Project is a community-driven effort to make digital accessibility easier.` | 21 | 0 | 10 | 40 | Mar 27, 2023 1:15pm PDT |
| 5 | `Abishek S / abisubramanya27` | Public | — | *(none)* | 0 | 0 | 0 | 0 | Feb 2, 2023 4:08pm PST |
| 6 | `Byte Blaze / accessible-html-content-patterns` | **Private** | `Owner` | `♿️ The full HTML5 Doctor Element Index as well as common markup patterns for quick reference.` | 1 | 0 | 0 | 0 | Mar 27, 2023 4:22pm PDT |
| 7 | `thoughtbot, inc. / administrate` | Public | — | `A Rails engine that helps you put together a super-flexible admin dashboard.` | 44 | 0 | 32 | 96 | Mar 20, 2023 1:40pm PDT |
| 8 | `0ang3el / aem-hacker` | Public | — | *(none)* | 12 | 0 | 2 | 12 | Mar 20, 2023 7:19am PDT |
| 9 | `Abishek S / Amazon_ML_Challenge_2021` | Public | — | *(none)* | 0 | 0 | 0 | 0 | Feb 2, 2023 4:08pm PST |
| 10 | `CellularPrivacy / Android-IMSI-Catcher-Detector` | Public | — | `AIMSICD • Fight IMSI-Catcher, StingRay and silent SMS!` | 28 | 0 | 5 | 162 | Mar 19, 2023 7:53pm PDT |
| 11 | `Georgi Eftimov / android-patternview` | Public | — | `Pattern view for android.That one using lock or unlock.` | 0 | 0 | 0 | 0 | Mar 20, 2023 7:19am PDT |
| 12 | `simple-android-framework / android_design_patterns_analysis` | Public | — | `Android源码设计模式分析项目` | 7 | 0 | 2 | 5 | Mar 20, 2023 7:19am PDT |
| 13 | `Koushik Dutta / AndroidAsync` | Public | — | `Asynchronous socket, http(s) (client+server) and websocket library for android. Based on nio, not threads.` | 46 | 0 | 19 | 333 | Mar 20, 2023 9:17am PDT |
| 14 | `Umano: News Read To You / AndroidSlidingUpPanel` | Public | — | `This library provides a simple way to add a draggable sliding up panel (popularized by Google Music and Google Maps) to your Android application. Brought to you by Umano.` | 55 | 0 | 34 | 267 | Mar 20, 2023 12:06pm PDT |
| 15 | `Auth0 / angular-storage` | Public | — | `A storage library for AngularJS done right` | 0 | 0 | 0 | 0 | Mar 19, 2023 1:14pm PDT |
| 16 | `Abishek S / AppliedProgrammingLab` | Public | — | *(none)* | 0 | 0 | 0 | 0 | Feb 2, 2023 4:08pm PST |
| 17 | `Arachni - Web Application Security Scanner Framework / arachni` | Public | — | `Web Application Security Scanner Framework` | 34 | 0 | 8 | 125 | Mar 20, 2023 6:38am PDT |
| 18 | `Jakub Klinkovský / arch-wiki-docs` | Public | — | `A script to download pages from Arch Wiki for offline browsing` | 5 | 0 | 2 | 3 | Mar 20, 2023 7:19am PDT |
| 19 | `Andrew M. Whalen / archive-my-tweets` | Public | — | `Archive your tweets to easily browse and search - all on your own website and in your control.` | 8 | 0 | 1 | 14 | Mar 19, 2023 6:38pm PDT |
| 20 | `Benoît Blanchon / ArduinoJson` | Public | — | `📟 JSON library for Arduino and embedded C++. Simple and efficient.` | 22 | 0 | 0 | 24 | Mar 20, 2023 6:13am PDT |

**Pagination** — `without_count`, so only a `Next` control:
```html
<div class="gl-pagination gl-mt-3">
  <ul class="pagination justify-content-center">
    <li class="page-item next"><a rel="next" class="page-link" href="/explore/projects?non_archived=true&page=2&sort=name_asc">Next</a></li>
  </ul>
</div>
```
Note the injected `non_archived=true` param and that the pager targets `/explore/projects` even when you arrived via `/explore`. Page limit is 50 (`PAGE_LIMIT`) — beyond that GitLab renders a "page out of bounds" error page.

### 6a.5 Logged-out `/explore`

Everything above changes to:

```html
<div class="explore-title text-center">
  <h2>Explore GitLab</h2>
  <p class="lead">Discover projects, groups and snippets. Share your projects with others</p>
  <br>
</div>
```
- `h1.page-title` `Projects`, the `New project` button and the `Yours / Starred / Explore / Topics` outer tab strip are **all absent**.
- The `All / Most stars / Trending` sub-tab strip, the `Filter by name` box and the sort dropdown remain; the sort dropdown loses the `Owned by anyone` / `Owned by me` section and defaults to `Updated date` (`latest_activity_desc`).
- No `Visibility:` control (only public projects are visible anyway).
- Rows lose the `span.user-access-role` badge.
- Same copy is used on `/explore/projects/starred`, `/explore/projects/trending`, `/explore/groups` and `/explore/snippets` when logged out.

### 6a.6 `/explore/projects/trending`

- URL `/explore/projects/trending`; `<title>` `Projects · Explore · GitLab`.
- Outer tab `Explore` active; **sub-tab `Trending` active** (`class="nav-link gl-tab-nav-item active gl-tab-nav-item-active"`), `All` and `Most stars` inactive.
- Filter form `action="/explore/projects/trending?sort=name_asc"`; sort links all point at `/explore/projects/trending?sort=…`.
- **Content: EMPTY.** The seed has no trending projects (trending = projects with recent starring activity, and the seed's star events are backdated). Verified 0 rows both logged-in and logged-out, in the pristine `assets/html/explore-projects-trending.html` and live.

```html
<div class="js-projects-list-holder" data-qa-selector="projects_list">
  <div class="nothing-here-block">
    <div class="svg-content">
      <img src="/assets/illustrations/profile-page/personal-project-….svg" width="75" height="75">
      <div class="text-content">
        <h5>Explore public groups to find projects to contribute to.</h5>
      </div>
    </div>
  </div>
</div>
```
Empty-state copy verbatim: **`Explore public groups to find projects to contribute to.`** (inside an `h5`). No pagination.


## 6b. `/explore/projects/starred`

- URL `/explore/projects/starred`; `<title>` `Projects · Explore · GitLab`.
- Outer tab `Explore` active; **sub-tab `Most stars` active**; `All` and `Trending` inactive.
- Same header (`h1 Projects` + `New project`), same `Filter by name` box, same sort dropdown (`action="/explore/projects/starred?sort=name_asc"`), same `Visibility: Any` control.
- The controller does `load_projects.reorder('star_count DESC')`, so the list is **always ordered by star count descending regardless of the `sort` param** — the sort dropdown still shows `Name` but the rows come back star-ordered. Reproduce that behaviour.
- 20 rows/page; pager `Next` → `/explore/projects/starred?non_archived=true&page=2&sort=name_asc`.

First page (verified live, 20 rows):

| # | Namespace / name | ★ | ⑂ | MR | Issues | Description |
|---|---|---|---|---|---|---|
| 1 | `Umano: News Read To You / AndroidSlidingUpPanel` | 55 | 0 | 34 | 267 | `This library provides a simple way to add a draggable sliding up panel (popularized by Google Music and Google Maps) to your Android application. Brought to you by Umano.` |
| 2 | `Meta / create-react-app` | 52 | 0 | 417 | 1.5k | `Set up a modern web app by running one command.` |
| 3 | `Karl Kroening / ffmpeg-python` | 51 | 0 | 34 | 402 | `Python bindings for FFmpeg - with complex filtering support` |
| 4 | `mk-j / PHP_XLSXWriter` | 47 | 0 | 24 | 101 | `Lightwight XLSX Excel Spreadsheet Writer in PHP` |
| 5 | `Koushik Dutta / AndroidAsync` | 46 | 0 | 19 | 333 | `Asynchronous socket, http(s) (client+server) and websocket library for android. Based on nio, not threads.` |
| 6 | `Erik Linder-Norén / PyTorch-GAN` | 45 | 0 | 24 | 102 | `PyTorch implementations of Generative Adversarial Networks.` |
| 7 | `thoughtbot, inc. / administrate` | 44 | 0 | 32 | 96 | `A Rails engine that helps you put together a super-flexible admin dashboard.` |
| 8 | `Keycloak / keycloak` | 43 | 0 | 230 | 1.6k | `Open Source Identity and Access Management For Modern Applications and Services` |
| 9 | `OpenAPI Tools / openapi-generator` | 42 | 0 | 402 | 3.5k | `OpenAPI Generator allows generation of API client libraries (SDK generation), server stubs, documentation and configuration automatically given an OpenAPI Spec (v2, v3)` |
| 10 | `William Ting / autojump` | 42 | 0 | 54 | 158 | `A cd command that learns - easily navigate directories from the command line` |
| 11 | `Yue Zhao / pyod` | 41 | 0 | 16 | 144 | `A Comprehensive and Scalable Python Library for Outlier Detection (Anomaly Detection)` |
| 12 | `Cap'n Proto / capnproto` | 39 | 0 | 47 | 136 | `Cap'n Proto serialization/RPC system - core tools and C++ library` |
| 13 | `PyAV / PyAV` | 39 | 0 | 26 | 37 | `Pythonic bindings for FFmpeg's libraries.` |
| 14 | `http ... PARTY! / node-http-proxy` | 38 | 0 | 102 | 482 | `A full-featured http proxy for node.js` |
| 15 | `Zhongyi Tong / electronic-wechat` | 35 | 0 | 10 | 198 | `💬 A better WeChat on macOS and Linux. Built with Electron by Zhongyi Tong.` |
| 16 | `Youfou / wxpy` | 35 | 0 | 8 | 295 | `微信机器人 / 可能是最优雅的微信个人号 API ✨✨` |
| 17 | `Matt Harvey / five-video-classification-methods` | 35 | 0 | 7 | 47 | `Code that accompanies my blog post outlining five video classification methods in Keras and TensorFlow` |
| 18 | `covid19india / covid19india-react` | 34 | 0 | 11 | 27 | `Tracking the impact of COVID-19 in India` |
| 19 | `Arachni - Web Application Security Scanner Framework / arachni` | 34 | 0 | 8 | 125 | `Web Application Security Scanner Framework` |
| 20 | `Meta / buck` | 34 | 0 | 22 | 201 | `A fast build system that encourages the creation of small, reusable modules over a variety of platforms and languages.` |

All rows are Public with no access-role badge. Row anatomy identical to 6a.3.


## 6c. `/explore/groups`

### 6c.1 Route, title, chrome

- URL `/explore/groups`; `<title>` **`Groups · Explore · GitLab`**.
- Logged-in header:
```html
<div class="page-title-holder d-flex align-items-center">
  <h1 class="page-title gl-font-size-h-display">Groups</h1>
  <div class="page-title-controls">
    <a data-qa-selector="new_group_button" data-testid="new-group-button" class="gl-button btn btn-md btn-confirm" href="/groups/new">
      <span class="gl-button-text">New group</span></a>
  </div>
</div>
```
  **h1 is `Groups`** (not "Explore groups") when signed in; button `New group`.
- Tab strip `ul.gl-flex-grow-1.gl-border-0.nav.gl-tabs-nav`:

| Label | href | Active | extra attr |
|---|---|---|---|
| `Your groups` | `/dashboard/groups` | — | — |
| `Explore public groups` | `/explore/groups` | ✔ | `data-qa-selector="public_groups_tab"` |

  **Logged out** the whole header is replaced by the `.explore-title` block (`Explore GitLab` / `Discover projects, groups and snippets. Share your projects with others`) and the single tab is labelled **`Explore Groups`** (capital G) with href `/explore/groups`.

- Search: `<form class="group-filter-form js-group-filter-form" id="group-filter-form" action="/explore/groups" method="get"><input type="search" name="filter" id="group-filter-form-field" placeholder="Search by name" class="group-filter-form-field form-control js-groups-list-filter" data-qa-selector="groups_filter_field" spellcheck="false"></form>`
  Placeholder verbatim: **`Search by name`**; param name `filter`.

- Sort dropdown `div[data-testid="group_sort_by_dropdown"] > .js-redirect-listbox`, toggle text **`Last created`** (default). Options verbatim, in DOM order, with the `?sort=` value each produces:

| Label | `?sort=` |
|---|---|
| `Name` | `name_asc` |
| `Name, descending` | `name_desc` |
| `Last created` | `created_desc` *(selected by default, `aria-selected="true"`)* |
| `Oldest created` | `created_asc` |
| `Updated date` | `latest_activity_desc` |
| `Oldest updated` | `latest_activity_asc` |

- Landing banner (`div.explore-groups.landing.content-block.js-explore-groups-landing`) with a dismiss `button.dismiss-button[aria-label="Dismiss"]` (✕, top-right) and copy:
  - `Below you will find all the groups that are public.`
  - `You can easily contribute to them by requesting to join these groups.`
  It is a light-blue full-width panel with a group illustration on the left. **It gains class `hide` once dismissed** (state kept in localStorage), which is why the live capture with the shared session shows it hidden while `assets/screenshots/reference/explore-groups.png` shows it visible. Render it visible by default.

### 6c.2 Group row anatomy (Vue `groups-list-tree`)

Container: `div.js-groups-list-holder > div > div.groups-list-tree-container[data-qa-selector="groups_list_tree_container"] > ul.groups-list.group-list-tree.gl-display-flex.gl-flex-direction-column.gl-m-0`.

```html
<li id="group-6" data-testid="group-overview-item-6" class="group-row">
 <div class="group-row-contents d-flex align-items-center py-2 pr-3">
   <div class="folder-toggle-wrap gl-mr-2 d-flex align-items-center">
     <span class="folder-caret gl-display-inline-block gl-text-secondary gl-w-5 gl-mr-2">
       <svg data-testid="chevron-right-icon" class="gl-icon s12">…</svg></span>
     <span class="item-type-icon gl-display-inline-block gl-text-secondary">
       <svg data-testid="subgroup-icon" class="gl-icon s16">…</svg></span>
   </div>
   <a href="/robert1003" aria-label="robert1003" class="gl-display-none gl-text-decoration-none! gl-mr-3 gl-sm-display-flex">
     <div class="gl-avatar gl-avatar-identicon gl-avatar-s32 gl-avatar-identicon-bg7">R</div></a>
   <div class="group-text-container d-flex flex-fill align-items-center">
     <div class="group-text flex-grow-1 flex-shrink-1">
       <div class="gl-display-flex gl-align-items-center gl-flex-wrap title namespace-title gl-font-weight-bold gl-mr-3">
         <a data-testid="group-name" href="/robert1003" title="robert1003" class="no-expand gl-mr-3 gl-text-gray-900!">robert1003</a>
         <svg data-testid="group-visibility-icon"
              title="Public - The group and any public projects can be viewed without any authentication."
              class="gl-display-inline-flex gl-align-items-center gl-mr-3 gl-text-gray-500 gl-icon s16"><use href="…#earth"></use></svg>
       </div>
     </div>
     <div class="metadata gl-display-flex gl-flex-grow-1 gl-flex-shrink-0 gl-flex-wrap justify-content-md-between">
       <div class="stats gl-text-gray-500 group-stats gl-mt-2 gl-display-none gl-md-display-flex gl-align-items-center">
         <span class="number-subgroups gl-ml-5" data-testid="subgroups-count" title="Subgroups" data-placement="bottom" data-container="body">
           <svg data-testid="subgroup-icon" class="gl-icon s16">…</svg>
           <span data-testid="itemStatValue" class="stat-value"> 0 </span></span>
         <span class="number-projects gl-ml-5" data-testid="projects-count" title="Projects" data-placement="bottom" data-container="body">
           <svg data-testid="project-icon" class="gl-icon s16">…</svg>
           <span data-testid="itemStatValue" class="stat-value"> 1 </span></span>
         <span class="number-users gl-ml-5" title="Direct members" data-placement="bottom" data-container="body">
           <svg data-testid="users-icon" class="gl-icon s16">…</svg>
           <span data-testid="itemStatValue" class="stat-value"> 1 </span></span>
       </div>
     </div>
   </div>
 </div>
</li>
```

| Field | Selector | Notes |
|---|---|---|
| Row | `li.group-row` | `id="group-<id>"`, `data-testid="group-overview-item-<id>"` |
| Expand caret | `.folder-toggle-wrap .folder-caret svg[data-testid="chevron-right-icon"]` | 12px; rotates to `chevron-down-icon` when a group with subgroups is expanded inline |
| Type icon | `.item-type-icon svg[data-testid="subgroup-icon"]` | 16px |
| Avatar | `a[aria-label=<path>] > div.gl-avatar.gl-avatar-identicon.gl-avatar-s32.gl-avatar-identicon-bg<1-7>` | 32px, first letter, identicon |
| Name | `a[data-testid="group-name"].no-expand.gl-mr-3.gl-text-gray-900!` | bold, `title=<path>`, href `/<path>` |
| Visibility icon | `svg[data-testid="group-visibility-icon"]` | `title="Public - The group and any public projects can be viewed without any authentication."` (private → `The group and its projects can only be viewed by members.`; internal → `The group and any internal projects can be viewed by any logged in user except external users.`) |
| Description | `.group-text .description` | omitted entirely when the group has none |
| Counters (right) | `span.number-subgroups[data-testid="subgroups-count"]`, `span.number-projects[data-testid="projects-count"]`, `span.number-users` | tooltips verbatim **`Subgroups`**, **`Projects`**, **`Direct members`**; each value in `span.stat-value[data-testid="itemStatValue"]` (note the surrounding spaces in the text node) |

There is **no** `N projects` / `N members` text — the counts are icon + number with tooltips only.

### 6c.3 Seeded groups — and the missing ANCHOR groups

The whole instance contains **only two `Group` namespaces**:

| id | name | path | visibility | shown on `/explore/groups`? |
|---|---|---|---|---|
| 2 | `GitLab Instance` | `gitlab-instance-58545a48` | Internal (10) | no |
| 6 | `robert1003` | `robert1003` | Public (20) | **yes — the only row** |

So `/explore/groups` renders exactly **one** `li.group-row`: `robert1003`, public, `Subgroups 0`, `Projects 1`, `Direct members 1`, no description. No pagination controls.

Everything else that looks like an organisation (`a11yproject` = "The A11Y Project", `primer` = "Primer", `thoughtbot` = "thoughtbot, inc.", `CellularPrivacy`, `Arachni`, …) is a **User namespace**, not a group — 2 399 user namespaces vs 2 groups.

**ANCHOR groups — DO NOT EXIST in this snapshot.** Verified with an authenticated session; every one returns HTTP **404** (`<title>Not Found`):

| ANCHOR route | Task | Live status |
|---|---|---|
| `/groups/coding_friends/-/group_members` | webarena-802 | **404** — group `coding_friends` does not exist |
| `/groups/crew/-/group_members` | webarena-801 | **404** |
| `/groups/n-lab/-/group_members` | webarena-799 | **404** |
| `/groups/webagent/-/group_members` | webarena-803 | **404** |
| `/groups/x-lab/-/group_members` | webarena-800 | **404** |

These are **post-action** anchors: each task is *"create a new group "<name>" with members …"* and the grader then loads `/groups/<path>/-/group_members` looking for `@username` strings. The mock therefore needs:
1. a working `/groups/new` create-group flow that registers a new group at path `<name>`,
2. a member-invite flow on the new group,
3. `/groups/<path>/-/group_members` rendering `@<username>` for each member,
4. and newly created **public** groups then appearing on `/explore/groups` (and `/dashboard/groups`).

Required member usernames per task (from the anchor table): `n-lab` → `@patou @egpast @westurner @jontutcher`; `x-lab` → `@JonasVautherin @dilipchandima @dawiss1337 @bmyun @DCMJY`; `crew` → `@ASWATFZLLC @patrickhlauke @westurner @linkmatrix`; `coding_friends` → `@qhduan @Agnes-U`; `webagent` → `@pandey2000 @sayakpaul`.

### 6c.4 Empty state

Reachable via the search box, e.g. `/explore/groups?filter=zzzz` — verified live:

```html
<section class="gl-display-flex empty-state gl-text-center gl-flex-direction-column" data-testid="search-empty-state">
  <div class="gl-max-w-full"></div>
  <div class="gl-max-w-full gl-m-auto"><div class="gl-mx-auto gl-my-0 gl-p-5">
    <h1 class="gl-font-size-h-display gl-line-height-36 h4">No results found</h1>
    <p class="gl-mt-3">Edit your search and try again</p>
    <div class="gl-display-flex gl-flex-wrap gl-justify-content-center"></div>
  </div></div>
</section>
```
Copy verbatim: **`No results found`** (in an `h1`) / **`Edit your search and try again`** (in a `p`). `data-testid="search-empty-state"`.


## 6d. `/explore/snippets`

- URL `/explore/snippets`; `<title>` **`Snippets · Explore · GitLab`**.
- Reachable logged-out (HTTP 200).

Logged-in body (`#content-body`) in full:

```html
<div class="page-title-holder d-flex align-items-center">
  <h1 class="page-title gl-font-size-h-display">Snippets</h1>
</div>
<div class="top-area">
  <ul class="gl-border-0 nav gl-tabs-nav">
    <li class="nav-item"><a title="Your snippets" class="nav-link gl-tab-nav-item" href="/dashboard/snippets">Your snippets</a></li>
    <li class="nav-item"><a title="Explore snippets" class="nav-link gl-tab-nav-item active gl-tab-nav-item-active" href="/explore/snippets">Explore snippets</a></li>
  </ul>
</div>
<div class="nothing-here-block">No snippets found</div>
```

| Item | Verbatim |
|---|---|
| `h1.page-title.gl-font-size-h-display` | `Snippets` |
| Tab 1 | `Your snippets` → `/dashboard/snippets` (also `title="Your snippets"`) |
| Tab 2 (active) | `Explore snippets` → `/explore/snippets` (also `title="Explore snippets"`) |
| Body | `<div class="nothing-here-block">No snippets found</div>` |

- **No** `New snippet` button on this page, **no** search box, **no** sort dropdown, **no** pagination.
- Empty-state copy verbatim: **`No snippets found`** (plain text directly inside `.nothing-here-block`, no illustration, no `h5`).
- **Content: the instance has zero public snippets** — verified logged-in and logged-out, live and in the pristine `assets/html/explore-snippets.html`.
- Logged out: the `h1` + tab strip are replaced by the `.explore-title` block (`<h2>Explore GitLab</h2>` + `<p class="lead">Discover projects, groups and snippets. Share your projects with others</p>`), followed by the same `<div class="nothing-here-block">No snippets found</div>`.
- When snippets do exist the list is `ul.content-list > li.snippet-row` — not exercisable in this seed.

---

## 7. `/byteblaze` — user profile header and tab strip

### 7.1 Routes and `<title>`

| Route | Rendered by | `<title>` | Notes |
|---|---|---|---|
| `/byteblaze` (ANCHOR — webarena-418…422, 448…452) | `users#show` | `Byte Blaze · GitLab` | Overview tab active |
| `/users/byteblaze/activity` | `users#activity` (renders `show`) | `Byte Blaze · GitLab` | Activity tab active |
| `/users/byteblaze/groups` | `users#groups` | `Byte Blaze · GitLab` | |
| `/users/byteblaze/contributed` | `users#contributed` | `Byte Blaze · GitLab` | |
| `/users/byteblaze/projects` | `users#projects` | `Byte Blaze · GitLab` | |
| `/users/byteblaze/starred` (ANCHOR — webarena-523…527) | `users#starred` | `Byte Blaze · GitLab` | |
| `/users/byteblaze/snippets` | `users#snippets` | `Byte Blaze · GitLab` | |
| `/users/byteblaze/followers` | `users#followers` | `Byte Blaze · GitLab` | |
| `/users/byteblaze/following` (ANCHOR — webarena-533…537) | `users#following` | `Byte Blaze · GitLab` | |

**Every one of these nine routes renders the *identical* full page** (same `.user-profile`
header, same tab strip, all nine `.tab-pane` divs). The only difference is which
`<li>`/`<a>` in the tab strip has `class="active"` and which `.tab-pane` has
`class="tab-pane active"`. There is **no** `?tab=` query-string variant.

Also live but not needed as a page: `/byteblaze.atom?feed_token=TMN_bBn9Z48qVbUFZV45`
(RSS), and the JSON tab endpoints `/users/byteblaze/<tab>.json`
(`groups|contributed|projects|starred|snippets|followers|following`) which return
`{"html": "<fragment>"}` (projects tabs return `{"html":..., "count":N}`), plus
`/users/byteblaze/calendar.json` and `/users/byteblaze/calendar_activities?date=YYYY-M-D`.

### 7.2 Box structure (measured live @1920×1080)

There is **no left sidebar** on user-profile pages (`@no_container = true`,
`@hide_breadcrumbs = true`, `@hide_top_links = true`). Only the 48px top navbar.

| Element | x | y | width | height | notes |
|---|---|---|---|---|---|
| `.navbar-gitlab` | 0 | 0 | 1920 | 48 | global (see shared brief) |
| `main#content-body.content` | 0 | 48 | 1920 | auto | `itemscope itemtype="http://schema.org/Person"` |
| `.user-profile` | 0 | 48 | 1920 | auto | outermost wrapper (ANCHOR target) |
| `.cover-block.user-cover-block` | 0 | 48 | 1920 | 389 | `background: #fbfafd`; `padding: 24px 0 0`; `text-align: center` |
| `.cover-controls` | 1824 | 64 | 76 | 32 | floated top-right button group |
| `.profile-header` | 16 | 72 | 1888 | 306 | (ANCHOR scope for `[itemprop="url"]`) |
| `.avatar-holder` | 915 | 72 | 90 | 96 | centred |
| `.avatar-holder img.gl-avatar` | 915 | 72 | **96** | **96** | `border-radius: 50%` (circle) |
| `.user-info` | 16 | 188 | 1888 | 138 | |
| `h1.cover-title` | 16 | 188 | 1888 | 28 | `font-size: 23px; font-weight: 600; color: #333238` |
| `.profile-user-bio` | 660 | 336 | 600 | 42 | max-width 600px, centred |
| `.scrolling-tabs-container` | 0 | 388 | 1920 | 49 | holds the tab `<ul>` |
| `ul.nav-links.user-profile-nav` | 0 | 388 | 1920 | 49 | centred; bottom border 1px `#dcdcde` |
| `.container-fluid.container-limited` | 320 | 437 | **1280** | auto | wraps `.tab-content` |
| `.tab-content` | 336 | 437 | **1248** | auto | (matches the dashboard `#content-body` 336/1248 numbers) |

Overview two-column split inside `.tab-content`:

| Element | x | width |
|---|---|---|
| `.calendar-block` (`.col-12`) | 321 | 1278 |
| `svg.contrib-calendar` | 498 | **924** (h 169) |
| `.activities-block` (`.col-md-12.col-lg-6`) | 336 | 604 |
| `.projects-block` (`.col-md-12.col-lg-6`) | 980 | 604 |

### 7.3 `.cover-controls` — buttons for the logged-in owner

For **byteblaze viewing byteblaze** exactly **two** icon-only buttons render, in this order,
right-aligned:

```html
<div class="cover-controls d-flex px-2 pb-4 d-sm-block p-sm-0">
  <a class="gl-button btn btn-icon btn-md btn-default gl-flex-grow-1 gl-mx-1 has-tooltip"
     title="Edit profile" aria-label="Edit profile"
     data-toggle="tooltip" data-placement="bottom" data-container="body" href="/-/profile">
    <svg class="s16 gl-icon gl-button-icon" data-testid="pencil-icon">…#pencil</svg>
  </a>
  <a class="gl-button btn btn-icon btn-md btn-default gl-flex-grow-1 gl-mx-1 has-tooltip"
     title="Subscribe"
     data-toggle="tooltip" data-placement="bottom" data-container="body"
     href="/byteblaze.atom?feed_token=TMN_bBn9Z48qVbUFZV45">
    <svg class="s16 gl-icon gl-button-icon" data-testid="rss-icon">…#rss</svg>
  </a>
</div>
```

* Tooltip strings (verbatim): `Edit profile`, `Subscribe`.
* **No** `Follow`/`Unfollow` button, **no** `Report abuse to administrator` button, **no**
  GPG-key button, **no** `View user in admin area` button — those only render when the
  viewer is *not* the profile owner (or is an admin). For completeness, on **another
  user's** profile (e.g. `/lahwaacz`) the same slot renders, in order:
  * `Report abuse to administrator` (icon `error`, href `/-/abuse_reports/new?user_id=<id>&ref_url=<referer>`)
    — or a disabled danger button titled `Already reported for abuse` if already reported;
  * `Subscribe` (rss);
  * a submit form with a single button labelled **`Follow`**
    (`btn-confirm`, `data-qa-selector="follow_user_link"`, `data-track-label="follow_from_profile"`,
    POST `/users/<u>/follow.json`) or **`Unfollow`**
    (`data-track-label="unfollow_from_profile"`, POST `/users/<u>/unfollow.json`).
    Both redirect back to the referring page. **This is the control tasks
    webarena-533…537 drive** to build the Following list.
  * `View public GPG key` / `View public GPG keys` (only if verified GPG keys exist).

### 7.4 `.profile-header` — full DOM, in render order

```html
<div class="profile-header">
  <div class="avatar-holder">
    <a target="_blank" rel="noopener noreferrer"
       href="https://www.gravatar.com/avatar/99a4297c867eada2606b9b6973f081f9?s=800&d=identicon">
      <img srcset="…?s=192&d=identicon 1x, …?s=192&d=identicon 2x"
           alt="" class="gl-avatar gl-avatar-s96  gl-avatar-circle"
           height="96" width="96" loading="lazy" itemprop="image"
           src="https://www.gravatar.com/avatar/99a4297c867eada2606b9b6973f081f9?s=192&d=identicon">
    </a>
  </div>
  <div class="user-info">
    <h1 class="cover-title" itemprop="name">
      Byte Blaze
    </h1>

    <!-- ==== .cover-status goes HERE, between h1.cover-title and users/_profile_basic_info ==== -->

    <!-- users/_profile_basic_info -->
    <div class="gl-text-gray-900 gl-mt-4">
      <div class="gl-mb-3 gl-display-inline-block middle-dot-divider">
        @byteblaze
      </div>
      <div class="gl-mb-3 gl-display-inline-block middle-dot-divider">
        User ID: 2330
        <button class="btn btn-clipboard gl-button btn-default-tertiary btn-icon btn-sm"
                data-toggle="tooltip" data-placement="bottom" data-container="body"
                data-title="Copy user ID" data-clipboard-text="2330" type="button"
                title="Copy user ID" aria-label="Copy user ID" aria-live="polite">
          <svg class="s16 gl-icon" data-testid="copy-to-clipboard-icon">…#copy-to-clipboard</svg>
        </button>
      </div>
      <div class="gl-mb-3 gl-display-inline-block middle-dot-divider">
        Member since March 23, 2023
      </div>
    </div>

    <!-- location / local time / organisation row -->
    <div class="gl-text-gray-900 mb-1 mb-sm-2">
      <div class="gl-mb-3 middle-dot-divider-sm gl-display-block gl-sm-display-inline-block"
           itemprop="address" itemscope="" itemtype="https://schema.org/PostalAddress">
        <svg class="s16 fgray" data-testid="location-icon">…#location</svg>
        <span itemprop="addressLocality">
          Boston, MA
        </span>
      </div>
      <div class="gl-mb-3 middle-dot-divider-sm gl-display-block gl-sm-display-inline-block">
        <svg class="s16 fgray" data-testid="work-icon">…#work</svg>
        <span>
          <span itemprop="worksFor">@github </span>
        </span>
      </div>
    </div>

    <!-- social / website / public-email row — EMPTY in the seed state -->
    <div class="gl-text-gray-900">
    </div>

    <!-- followers / following -->
    <div class="gl-text-gray-900">
      <svg class="s16 gl-vertical-align-middle gl-text-gray-500" data-testid="users-icon">…#users</svg>
      <div class="gl-mb-3 gl-display-inline-block middle-dot-divider">
        <a href="/users/byteblaze/followers">2 followers
        </a>
      </div>
      <div class="gl-mb-3 gl-display-inline-block middle-dot-divider">
        <a data-qa-selector="following_link" href="/users/byteblaze/following">3
        following
        </a>
      </div>
    </div>
  </div>

  <div class="gl-text-gray-900">
    <div class="profile-user-bio">
      Inclusive design and accessibility advocate. Accessibility and design systems wonk for @primer.
    </div>
  </div>
</div>
```

Field-by-field values (all verbatim):

| Field | Value | Markup |
|---|---|---|
| Avatar | Gravatar identicon | 96×96 circle. `src` = `https://www.gravatar.com/avatar/<md5(email)>?s=192&d=identicon`; wrapping `<a href>` uses `?s=800&d=identicon`, `target="_blank" rel="noopener noreferrer"`. md5 for byteblaze (`ericwbailey@fakegithub.com`) = `99a4297c867eada2606b9b6973f081f9`. **Mock must serve these locally (no-network rule)** — keep the class names and the 96px circle. |
| Display name | `Byte Blaze` | `h1.cover-title` **`itemprop="name"`** |
| Pronouns | *(none)* | would be `<span class="gl-font-base gl-text-gray-500 gl-vertical-align-middle">(they/them)</span>` inside the h1 |
| Busy marker | *(none)* | if the status has `availability: busy`, an extra `<span class="gl-font-base gl-text-gray-500 gl-vertical-align-middle">(Busy)</span>` is appended inside `h1.cover-title` |
| Handle | `@byteblaze` | plain text in a `middle-dot-divider` div |
| User ID line | `User ID: 2330` + copy button | tooltip/aria `Copy user ID`, `data-clipboard-text="2330"` |
| Member-since line | **`Member since March 23, 2023`** | ⚠ EXACT format is Rails `to_s(:long)` → `Month D, YYYY` (full month name, no leading zero). It is **NOT** `Mar 27, 2023`. |
| Location | `Boston, MA` | icon `data-testid="location-icon"` (`#location`), wrapper `itemprop="address" itemscope itemtype="https://schema.org/PostalAddress"`, value in `<span itemprop="addressLocality">` |
| Local time | *(absent — user has no timezone)* | would be `data-testid="user-local-time"` with a `#clock` icon |
| Organisation | `@github` (note the trailing space inside the span) | icon `data-testid="work-icon"` (`#work`), value in `<span itemprop="worksFor">`. (If a job title existed it would render `<span itemprop="jobTitle">Title</span> at <span itemprop="worksFor">Org</span>`.) |
| Website | *(absent in seed)* | see §7.5 — **ANCHOR** |
| Public email | *(absent)* | would be `<a itemprop="email" href="mailto:…">` |
| Followers | `2 followers` → `/users/byteblaze/followers` | pluralised: `1 follower` / `%{count} followers` |
| Following | `3` + newline + `following` → `/users/byteblaze/following`, `data-qa-selector="following_link"` | count and the word `following` are two separate nodes (renders as `3 following`) |
| Bio | `Inclusive design and accessibility advocate. Accessibility and design systems wonk for @primer.` | `.profile-user-bio`, outside `.user-info`, still inside `.profile-header` |

The four separator dots you see (`@byteblaze · User ID: 2330 · Member since …`) are CSS
`::after` content on `.middle-dot-divider` / `.middle-dot-divider-sm`, not text nodes.

### 7.5 ANCHOR — `.cover-status` (status emoji + message)

**Locator:** `document.querySelector('.cover-status').lastChild.textContent`
(ANCHOR — webarena-418, 419, 420, 421, 422)

Status values graded with `exact_match` (WebArena lower-cases + strips before comparing):

| Task | Required text | Anchor |
|---|---|---|
| webarena-418 | `Cruising` | ANCHOR |
| webarena-419 | `Enjoying life` | ANCHOR |
| webarena-420 | `Playing Badminton` | ANCHOR |
| webarena-421 | `Resting due to leg injury` | ANCHOR |
| webarena-422 | `Out of Office` | ANCHOR |

In the seed state byteblaze has **no** status row, so `.cover-status` **does not exist**
(`user_statuses` table is empty for every user on this instance — there is no live example
to copy; the markup below is taken from `app/views/users/show.html.haml`,
`EmojiHelper#emoji_icon`, `Gitlab::Emoji.gl_emoji_tag` and `UserStatus`).

The element is rendered only when `@user.status&.customized?` — i.e. when the message is
present **or** the emoji differs from the default `speech_balloon`. It sits **immediately
after `h1.cover-title`** and **before** the `@handle / User ID / Member since` block:

```html
<div class="cover-status gl-display-inline-flex gl-align-items-center">
<gl-emoji title="speech balloon" data-name="speech_balloon" data-unicode-version="6.0" class="gl-mr-2">💬</gl-emoji>
Cruising
</div>
```

Hard requirements for the mock:

1. The wrapper class list is exactly `cover-status gl-display-inline-flex gl-align-items-center`.
2. First child = the emoji element, a **`<gl-emoji>`** custom element (not an `<img>`, not a
   `<span>`). Attribute order as GitLab emits it: `title`, `data-name`,
   `data-unicode-version`, then the caller-supplied `class="gl-mr-2"`. Its text content is
   the literal emoji character (codepoints).
3. **`lastChild` must be a bare text node holding the message.** GitLab renders the message
   with `markdown_field(@user.status, :message)` through the `:emoji` Banzai pipeline
   (`HtmlEntityFilter → SanitizationFilter → EmojiFilter`) — **no markdown, no `<p>`
   wrapper**. So for a plain message like `Cruising` the output is the raw string.
   Do **not** wrap the message in a `<span>`/`<p>` — that would make `lastChild` an element
   and `lastChild.textContent` would still work, but any trailing element (e.g. a clear
   button) after the message would break the anchor. Keep the message last.
   Leading/trailing whitespace/newlines around the message are fine (HAML emits
   `"\nCruising\n"`; the grader strips).
4. Emoji reference data (from `public/-/emojis/2/emojis.json`), for the default and a few
   plausible picks:

   | `data-name` | char | `data-unicode-version` | `title` |
   |---|---|---|---|
   | `speech_balloon` (**default**, `UserStatus::DEFAULT_EMOJI`) | 💬 | `6.0` | `speech balloon` |
   | `palm_tree` | 🌴 | `6.0` | `palm tree` |
   | `badminton` | 🏸 | `8.0` | `badminton racquet` |
   | `sleeping` | 😴 | `6.1` | `sleeping face` |
   | `house` | 🏠 | `6.0` | `house building` |
   | `airplane` | ✈ | `1.1` | `airplane` |

   The grader never reads the emoji, only `lastChild`. Using `speech_balloon` 💬 for every
   status is faithful: the Set-status modal ships `data-default-emoji="speech_balloon"`
   and submits that when the user types a message without picking an emoji.

**How the status is set (the mutation the agent performs).** Navbar avatar dropdown →
`Set status` opens a Bootstrap-Vue modal `#set-user-status-modal` mounted into
`<div class="js-set-status-modal-wrapper" data-current-emoji="" data-current-message=""
data-default-emoji="speech_balloon"></div>` (that div is present in the page source on
every page). Modal contents, verbatim:

| Element | Copy / selector |
|---|---|
| Modal title | `Set a status` (`h4.modal-title`) |
| Emoji picker toggle | `.emoji-picker` dropdown; placeholder `data-testid="no-emoji-placeholder"` showing the `slight-smile`/`smiley`/`smile` icons |
| Message input | `placeholder="What's your status?"`, `input.gl-form-input.form-control.js-gfm-input-initialized` |
| Clear button in the input group | `title="Clear status"` / `aria-label="Clear status"`, class `js-clear-user-status-button`, `#close` icon |
| Busy checkbox | label `Set yourself as busy`, help text `Displays that you are busy or not able to respond`, `data-testid="user-availability-checkbox"` |
| Clear-status-after | legend `Clear status after`, dropdown `data-testid="clear-status-at-dropdown"`, default button text `Never` (options come from `UserStatus::CLEAR_STATUS_QUICK_OPTIONS`: 30 minutes / 3 hours / 8 hours / 1 day / 3 days / 7 days / 30 days) |
| Footer buttons | `Remove status` and `Set status` |

The same status fields also exist on the **Edit profile** page `/-/profile`
("Current status" section). Either path must end up rendering `.cover-status` on
`/byteblaze`.

### 7.6 ANCHOR — `.profile-header [itemprop="url"]` (website line)

**Locator:** `document.querySelector('.profile-header [itemprop="url"]').outerText`
(ANCHOR — webarena-448, 449, 450, 451, 452)

| Task | Typed into the profile form | Required `outerText` | Anchor |
|---|---|---|---|
| webarena-448 | `https://egg.tart.com` | `egg.tart.com` | ANCHOR (`exact_match`) |
| webarena-449 | `helloworld.xyz` | `helloworld.xyz` | ANCHOR |
| webarena-450 | `https://a11yproject.contributor.me` | `a11yproject.contributor.me` | ANCHOR |
| webarena-451 | `www.byteblaze.com` | `www.byteblaze.com` | ANCHOR |
| webarena-452 | `https://byteblaze.github.io` | `byteblaze.github.io` | ANCHOR |

Not present in the seed state (`users.website_url = ''` for every user on this instance).
When set, it renders inside the third `.gl-text-gray-900` row of `.user-info`
(the row that is empty in the seed), in this exact shape:

```html
<div class="gl-text-gray-900">
<div class="gl-mb-3 middle-dot-divider-sm gl-display-block gl-sm-display-inline-block">
<a target="_blank" rel="me noopener noreferrer nofollow" itemprop="url" href="https://egg.tart.com">egg.tart.com</a>
</div>
</div>
```

Rules (from `User#short_website_url` / `User#full_website_url`):

* **Link text = the bare host, scheme stripped.** `short_website_url` = `website_url.sub(/\Ahttps?:\/\//, '')`.
  So `https://egg.tart.com` → text `egg.tart.com`; `www.byteblaze.com` (stored without a
  scheme) → text `www.byteblaze.com` (unchanged). A `www.` prefix is **kept**; only
  `http://` / `https://` is removed. No trailing slash is added or removed.
* **`href` = `full_website_url`**: the stored value if it already starts with `http://` or
  `https://`, otherwise `"http://" + website_url`. So `helloworld.xyz` → `href="http://helloworld.xyz"`
  but text `helloworld.xyz`; `https://byteblaze.github.io` → `href="https://byteblaze.github.io"`.
* Attributes, in emitted order: `target="_blank"`, `rel="me noopener noreferrer nofollow"`,
  `itemprop="url"`, `href="…"` (Rails `link_to` puts `href` last).
* `.profile-header` is the required scope. The only other `itemprop` inside
  `.profile-header` are `image` (avatar `<img>`), `name` (h1), `address`/`addressLocality`,
  `worksFor`, and — if a public email is shown — `email`. **`itemprop="url"` must be unique
  inside `.profile-header`** so `querySelector` finds the website link.
* The wrapper div class list is `gl-mb-3 middle-dot-divider-sm gl-display-block gl-sm-display-inline-block`
  (same "stacking" divider as the location and organisation lines).

**How the URL is set:** `/-/profile` (Edit profile), "Main settings" → field
`<label for="user_website_url">Website url</label>` /
`<input id="user_website_url" name="user[website_url]" type="text" placeholder="https://website.com"
class="gl-form-input form-control gl-md-form-input-lg">`, saved with the
`Update profile settings` button.

### 7.7 Tab strip

```html
<div class="scrolling-tabs-container">
  <div class="fade-left"><svg class="s12" data-testid="chevron-lg-left-icon">…</svg></div>
  <div class="fade-right"><svg class="s12" data-testid="chevron-lg-right-icon">…</svg></div>
  <ul class="nav-links user-profile-nav scrolling-tabs nav nav-tabs is-initialized"> … </ul>
</div>
```

Exactly nine tabs, in this order, **no counts / no badges on any of them**:

| # | `<li>` class | Label (verbatim) | `href` | `data-target` | `data-action` | `data-endpoint` |
|---|---|---|---|---|---|---|
| 1 | `js-overview-tab` | `Overview` | `/byteblaze` | `div#js-overview` | `overview` | — |
| 2 | `js-activity-tab` | `Activity` | `/users/byteblaze/activity` | `div#activity` | `activity` | — |
| 3 | `js-groups-tab` | `Groups` | `/users/byteblaze/groups` | `div#groups` | `groups` | `/users/byteblaze/groups.json` |
| 4 | `js-contributed-tab` | `Contributed projects` | `/users/byteblaze/contributed` | `div#contributed` | `contributed` | `/users/byteblaze/contributed.json` |
| 5 | `js-projects-tab` | `Personal projects` | `/users/byteblaze/projects` | `div#projects` | `projects` | `/users/byteblaze/projects.json` |
| 6 | `js-starred-tab` | `Starred projects` | `/users/byteblaze/starred` | `div#starred` | `starred` | `/users/byteblaze/starred.json` |
| 7 | `js-snippets-tab` | `Snippets` | `/users/byteblaze/snippets` | `div#snippets` | `snippets` | `/users/byteblaze/snippets.json` |
| 8 | `js-followers-tab` | `Followers` | `/users/byteblaze/followers` | `div#followers` | `followers` | `/users/byteblaze/followers.json` |
| 9 | `js-following-tab` | `Following` | `/users/byteblaze/following` | `div#following` | `following` | `/users/byteblaze/following.json` |

Every `<a>` also carries `data-toggle="tab"`.

* **Default active:** `Overview` (its `<a>` gets `class="active"`); its pane is
  `<div class="tab-pane active" id="js-overview">`.
* **Does clicking change the URL? YES.** The tab JS is `UserTabs`: on
  `shown.bs.tab` it lazily AJAX-loads the pane and then calls `setCurrentAction(href)`,
  which strips trailing slashes, re-appends `location.search + location.hash`, and calls
  `window.history.replaceState({url}, document.title, url)`. So the address bar becomes
  `/byteblaze`, `/users/byteblaze/activity`, `/users/byteblaze/groups`, … with **no page
  reload** (`replaceState`, so no new history entry). Direct navigation to the same URLs
  server-renders the corresponding pane as active. The mock may implement this as plain
  client-side routing.
* Styling: `padding: 16px 12px` per link; inactive `color: #737278; font-weight: 400`;
  active `color: #000; font-weight: 600` with a 2px bottom indicator bar; the `<ul>` is
  horizontally centred and full-width with a hairline bottom border.
* `.fade-left` / `.fade-right` chevrons are the horizontal-overflow affordance and are
  invisible at 1920px.

### 7.8 Overview tab body (`#js-overview`)

Order of rows inside `#js-overview`:

1. `.row.d-none.d-sm-flex` → `.col-12.calendar-block.gl-my-3` → the contribution calendar
   (see §7.9). Hidden below the `sm` breakpoint.
2. `.row` → `.col-12.user-calendar-activities` — empty; filled with the per-day activity
   list when a calendar cell is clicked.
3. `.row` with the two half-width columns:

**Left — `.col-md-12.col-lg-6 > .activities-block`**

```
<h4 class="gl-flex-grow-1">Activity</h4>   <a class="hide js-view-all" href="/users/byteblaze/activity">View all</a>
```
Heading `Activity`; the `View all` link is **hidden** (`class="hide js-view-all"`) because
byteblaze has 0 events — `UserTabs` only removes `hide` when the JSON response reports
`count > 0`. Body is `.overview-content-list[data-href="/users/byteblaze/activity"]
[data-qa-selector="user_activity_content"]` containing the empty state:

```html
<div class="nothing-here-block p-5">
  <div class="svg-content">
    <img class="js-lazy-loaded" src="/assets/illustrations/profile-page/activity-….svg" width="75" height="75" loading="lazy">
    <div class="text-content">
      <h5>Join or create a group to start contributing by commenting on issues or submitting merge requests!</h5>
      <a class="gl-button btn btn-confirm btn-inverted" href="/explore/groups">Explore groups</a>
      <a class="gl-button btn btn-confirm" href="/groups/new">New group</a>
    </div>
  </div>
</div>
```
Verbatim copy: `Join or create a group to start contributing by commenting on issues or submitting merge requests!`,
buttons `Explore groups` (outlined) and `New group` (filled blue).

**Right — `.col-md-12.col-lg-6 > .projects-block`**

Heading `Personal projects`; `<a class="js-view-all" href="/users/byteblaze/projects">View all</a>`
(**visible** here). Body `.overview-content-list[data-href="/users/byteblaze/projects"]` →
`.js-projects-list-holder[data-qa-selector="projects_list"]` →
`ul.projects-list.gl-text-secondary.gl-w-full.gl-my-2.compact` with **10** `li.project-row`
(request params `limit=10&skip_pagination=true&skip_namespace=true&compact_mode=true`, so
the `.namespace-name` span is present but **empty** and no pager is rendered).

Order is **project id descending** (the `projects_order_id_desc` default), which for
byteblaze is:

| # | Project (`.project-name`) | href | Visibility icon (`title=`) | Role | Description (`.description`) | ★ | ⑂ | Updated |
|---|---|---|---|---|---|---|---|---|
| 1 | `solarized-prism-theme` | `/byteblaze/solarized-prism-theme` | lock — `Private - Project access must be granted explicitly to each user. If this project is part of a group, access is granted to members of the group.` | `Owner` | `solarized theme for prism.js` | 0 | 0 | `3 years ago` / `Apr 24, 2023 2:23pm PDT` / `2023-04-24T21:23:51Z` |
| 2 | `gimmiethat.space` | `/byteblaze/gimmiethat.space` | lock — Private | `Owner` | `I need some space.` | 0 | 0 | `3 years ago` / `Apr 24, 2023 2:22pm PDT` / `2023-04-24T21:22:22Z` |
| 3 | `ericwbailey.website` | `/byteblaze/ericwbailey.website` | earth — `Public - The project can be accessed without any authentication.` | `Owner` | `📐 Repo for my personal website.` (emoji is `<gl-emoji title="triangular ruler" data-name="triangular_ruler" data-unicode-version="6.0">📐</gl-emoji>`) | 2 | 0 | `3 years ago` / `Mar 27, 2023 4:22pm PDT` / `2023-03-27T23:22:59Z` |
| 4 | `empathy-prompts` | `/byteblaze/empathy-prompts` | earth — Public | `Owner` | `💡 Ideas to help consider Inclusive Design principles when making things for others to use.` (`bulb`) | 6 | 1 | same as above |
| 5 | `accessible-html-content-patterns` | `/byteblaze/accessible-html-content-patterns` | lock — Private | `Owner` | `♿️ The full HTML5 Doctor Element Index as well as common markup patterns for quick reference.` (`wheelchair`, `unicode-version 4.1`, followed by a VS16) | 1 | 0 | same |
| 6 | `a11y-syntax-highlighting` | `/byteblaze/a11y-syntax-highlighting` | earth — Public | `Owner` | `💄 Accessible light and dark syntax highlighting themes` (`lipstick`) | 1 | 0 | same |
| 7 | `millennials-to-snake-people` | `/byteblaze/millennials-to-snake-people` | earth — Public | `Owner` | `🐍 Chrome extension that replaces occurrences of 'Millennials' with 'Snake People'` (`snake`) | 6 | 0 | same |
| 8 | `cloud-to-butt` | `/byteblaze/cloud-to-butt` | earth — Public | `Owner` | `Chrome extension that replaces occurrences of 'the cloud' with 'my butt'` | 0 | 0 | same |
| 9 | `timeit` | `/byteblaze/timeit` | earth — Public | `Owner` | `Rails implementation of time tracking tool timeit` | 0 | 0 | same |
| 10 | `a11y-webring.club` | `/byteblaze/a11y-webring.club` | earth — Public | `Owner` | `🌐 A webring for digital accessibility practitioners.` (`globe_with_meridians`) | 2 | 0 | same |

In **compact** mode only the ★ (Stars) and ⑂ (Forks) counters render — no MR/issue
counters. Both are links: `…/-/starrers` (`title="Stars"`, icon `data-testid="star-o-icon"`)
and `…/-/forks` (`title="Forks"`, icon `data-testid="fork-icon"`).

### 7.9 Contribution calendar

There is **no `N contributions in the last year` heading** in GitLab 15.7 — the calendar is
just an SVG plus a caption. Rendered (client-side, from `/users/byteblaze/calendar.json`) as:

```html
<div class="user-calendar light"
     data-calendar-activities-path="/users/byteblaze/calendar_activities"
     data-calendar-path="/users/byteblaze/calendar.json" data-utc-offset="0">
  <div class="calendar">
    <div class="js-contrib-calendar">
      <svg width="924" height="169" class="contrib-calendar"> … </svg>
    </div>
    <div class="calendar-hint">Issues, merge requests, pushes, and comments.</div>
  </div>
</div>
```

* **Caption:** `Issues, merge requests, pushes, and comments.` (`.calendar-hint`,
  right-aligned under the grid).
* **Grid:** 53 week columns × 7 day rows. Cell `15×15`, spacing 17px
  (`daySizeWithSpace`). Week groups are `<g transform="translate(18 + 17*i, 18)">`;
  each cell is `<rect x="0" y="{17*((day+7-firstDayOfWeek)%7)}" width="15" height="15"
  data-level="0|1|2|3|4" class="user-contrib-cell has-tooltip" data-html="true"
  data-container="body" title="…">`. The window is the last 12 months
  (6 months if the container is narrower than 918px).
* **Month labels:** `<text x="…" y="10" class="user-contrib-text">Aug</text>` … three-letter
  month abbreviations, one per month boundary, left→right. In the reference capture:
  `Aug Sep Oct Nov Dec Jan Feb Mar Apr May Jun Jul Aug` at
  x = 35, 103, 171, 239, 324, 392, 460, 528, 613, 681, 766, 834, 902.
* **Day-of-week labels:** only three — `M`, `W`, `F` —
  `<text text-anchor="middle" x="8" y="{29 + 17*rowIdx}" class="user-contrib-text">`
  (y = 46, 80, 114 for a Sunday-first week).
* **Tooltip format** (HTML tooltip, `data-html="true"`):
  `` `${count} contributions<br /><span class="gl-text-gray-300">${Weekday} ${Mon D, YYYY}</span>` ``
  * 0 → `No contributions<br /><span class="gl-text-gray-300">Thursday Aug 7, 2025</span>`
  * 1 → `1 contribution<br /><span class="gl-text-gray-300">Wednesday Mar 29, 2023</span>`
  * n>1 → `2 contributions<br /><span class="gl-text-gray-300">Wednesday Mar 29, 2023</span>`
  * Weekday is the full name; date is `mmm d, yyyy` (`Mar 29, 2023`, no leading zero).
* **Legend:** a final `<g transform="translate(18, 152)">` containing **5** rects at
  x = 0, 17, 34, 51, 68, y = 0, each `class="user-contrib-cell has-tooltip contrib-legend"`
  with `data-level` 0…4 and `title` of:
  `No contributions`, `1-9 contributions`, `10-19 contributions`, `20-29 contributions`,
  `30+ contributions`. **There are no `Less` / `More` text labels** (that is GitHub, not
  GitLab). Level colours run light-grey → light-blue → blue → dark navy.
* **Interaction:** clicking a cell GETs
  `/users/byteblaze/calendar_activities?date=YYYY-M-D` and injects the HTML into
  `.user-calendar-activities`; clicking the same cell again clears it. Failure toast:
  `An error occurred while retrieving calendar activity`.
* **Loading / error states:** before the JSON resolves the container holds
  `<div class="gl-spinner-container gl-my-8">…</div>` plus a hidden
  `<div class="user-calendar-error invisible">There was an error loading users activity
  calendar. <a class="js-retry-load" href="#">Retry</a></div>`. Copy verbatim:
  `There was an error loading users activity calendar.` and `Retry`.
* byteblaze's real calendar is **entirely empty** (every cell `data-level="0"` /
  `No contributions`).

### 7.10 Date formats used on the profile

| Where | Format | Example |
|---|---|---|
| `Member since` line | absolute, long month | `Member since March 23, 2023` |
| Project rows (`Updated …`) | relative | `3 years ago` |
| …their `<time title>` tooltip | absolute + time + tz | `Mar 27, 2023 4:22pm PDT`, `Apr 24, 2023 2:23pm PDT` |
| …their `<time datetime>` | ISO-8601 UTC | `2023-03-27T23:22:59Z` |
| Calendar cell tooltip | weekday + short month | `Wednesday Mar 29, 2023` |

Project-row `<time>` markup:
```html
<time class="js-timeago" title="Mar 27, 2023 4:22pm PDT" datetime="2023-03-27T23:22:59Z"
      data-toggle="tooltip" data-placement="top" data-container="body">3 years ago</time>
```
(The `3 years ago` text is what the server ships; `js-timeago` re-computes it client-side.)

### 7.11 Selector inventory for §7

| Selector | Purpose |
|---|---|
| `.user-profile` | **ANCHOR** wrapper — `document.querySelector('.user-profile').outerText` (webarena-533…537) |
| `.cover-block.user-cover-block` | header band |
| `.cover-controls` | top-right icon buttons |
| `.profile-header` | **ANCHOR** scope for `[itemprop="url"]` (webarena-448…452) |
| `.avatar-holder`, `img.gl-avatar.gl-avatar-s96.gl-avatar-circle` | avatar |
| `h1.cover-title[itemprop="name"]` | display name |
| `.cover-status` | **ANCHOR** status (webarena-418…422) |
| `.user-info` | header text block |
| `.profile-user-bio` | bio |
| `.middle-dot-divider`, `.middle-dot-divider-sm` | dot-separated header chips |
| `[itemprop="address"]`, `[itemprop="addressLocality"]`, `[itemprop="worksFor"]`, `[itemprop="image"]`, `[itemprop="url"]`, `[itemprop="email"]` | schema.org/Person microdata |
| `[data-qa-selector="following_link"]` | the `3 following` link |
| `ul.nav-links.user-profile-nav`, `li.js-<tab>-tab` | tab strip |
| `.tab-content`, `.tab-pane#js-overview|#activity|#groups|#contributed|#projects|#starred|#snippets|#followers|#following` | panes |
| `.js-projects-list-holder[data-qa-selector="projects_list"]`, `ul.projects-list`, `li.project-row` | project lists |
| `[data-qa-selector="project_content"]`, `[data-qa-project-name]`, `[data-qa-selector="user_role_content"]` | project row internals |
| `[data-testid="project_controls"]` | right-hand counters block |
| `.js-contrib-calendar`, `svg.contrib-calendar`, `.user-contrib-cell`, `.contrib-legend`, `.calendar-hint`, `.user-calendar-activities` | calendar |
| `.nothing-here-block`, `.svg-content`, `.text-content` | empty states |
| `.js-set-status-modal-wrapper[data-default-emoji="speech_balloon"]` | status modal mount point |
| `svg[data-testid="pencil-icon"|"rss-icon"|"location-icon"|"work-icon"|"users-icon"|"copy-to-clipboard-icon"|"lock-icon"|"earth-icon"|"star-o-icon"|"fork-icon"|"git-merge-icon"|"issues-icon"]` | icons |

---

## 8a. `/users/byteblaze/following` and `/users/byteblaze/followers`

### 8a.1 Routes

| Route | Active tab | Pane | `<title>` |
|---|---|---|---|
| `/users/byteblaze/following` (**ANCHOR** — webarena-533, 534, 535, 536, 537) | `Following` | `div#following.tab-pane.active` | `Byte Blaze · GitLab` |
| `/users/byteblaze/followers` | `Followers` | `div#followers.tab-pane.active` | `Byte Blaze · GitLab` |

Same header + tab strip as §7 (identical in every respect, including
`2 followers` / `3 following` and the bio). No page-level heading, no toolbar, no search
box, no sort control, no counts on the tabs.

### 8a.2 ANCHOR — `document.querySelector('.user-profile').outerText`

(ANCHOR — webarena-533, 534, 535, 536, 537, all `must_include`.)

`.user-profile` is the **whole profile block** (header + tab strip + tab content), so its
`outerText` includes the header text and then the visible pane. Verbatim `outerText`
captured live on `/users/byteblaze/following` (`\n` shown as real line breaks):

```
 
Byte Blaze
@byteblaze  User ID: 2330 
  Member since March 23, 2023
 Boston, MA   @github
 2 followers  3 following
Inclusive design and accessibility advocate. Accessibility and design systems wonk for @primer.
Overview
Activity
Groups
Contributed projects
Personal projects
Starred projects
Snippets
Followers
Following
The A11Y Project
@a11yproject
Steven Frank
@panicsteve
Primer
@primer
```

(The `/users/byteblaze/followers` equivalent ends `Steven Frank / @panicsteve / 小子欠扁 / @xiaozi`.)

**Requirement for the mock:** every followed user's `@handle` must be *rendered text*
inside `.user-profile` on `/users/byteblaze/following`. Handles that must be readable
there once the corresponding follow task is performed:

| Handle | Display name | user id | Tasks |
|---|---|---|---|
| `@yjlou` (ANCHOR) | `yjlou` | 168 | webarena-533, 537 |
| `@koush` (ANCHOR) | `Koushik Dutta` | 1912 | webarena-534 |
| `@ghost` (ANCHOR) | `Ghost User` | 42 | webarena-535 |
| `@lahwaacz` (ANCHOR) | `Jakub Klinkovský` | 1842 | webarena-534, 535, 536, 537 |
| `@bblanchon` (ANCHOR) | `Benoît Blanchon` | 597 | webarena-535 |
| `@R1kk3r` (ANCHOR) | `R1kk3r` | 454 | webarena-536 |
| `@convexegg` (ANCHOR) | `Convex Eggtart` | 43 | webarena-533, 537 |
| `@vinta` (ANCHOR) | `Vinta Chen` | 278 | webarena-534, 537 |
| `@abisubramanya27` (ANCHOR) | `Abishek S` | 5 | webarena-536, 537 |

The tasks phrase the targets by **display name** (`Follow ["Jakub Klinkovský", "Koushik",
"Vinta Chen"]`, `Follow ["Jakub K", "ghost", "Benoît Blanchon"]`, `Follow ["Abishek"]`, …),
so those display names must be findable via search / user pages, and each user's profile
page must expose a working **`Follow`** button (§7.3) that adds them here.

### 8a.3 Pane body — the user-card grid

Both panes use `shared/users/index` → `shared/users/_user`, a plain Bootstrap grid (no
pager unless > 20 users; `.page(params[:page])` → `.gl-pagination` would appear below):

```html
<div class="tab-pane active" id="following">
  <div class="row gl-mt-3">
    <div class="col-lg-3 col-md-4 col-sm-12">
      <div class="gl-card gl-mb-5">
        <div class="gl-card-body">
          <img srcset="https://www.gravatar.com/avatar/<md5>?s=96&d=identicon 1x, …?s=96&d=identicon 2x"
               alt="" class="gl-avatar gl-avatar-s48 gl-float-left gl-mr-3 gl-avatar-circle"
               height="48" width="48" loading="lazy"
               src="https://www.gravatar.com/avatar/<md5>?s=96&d=identicon">
          <div class="user-info">
            <div class="block-truncated">
              <a class="user js-user-link" data-user-id="2325" data-qa-selector="user_link"
                 data-qa-username="a11yproject" href="/a11yproject">The A11Y Project</a>
            </div>
            <div class="block-truncated">
              <span class="gl-text-gray-900">@a11yproject</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    … one .col-lg-3 per user …
  </div>
</div>
```

Card anatomy — **there is no location line, no follow button, no stats on these cards**:

| Part | Detail |
|---|---|
| Column | `.col-lg-3.col-md-4.col-sm-12` → 4 per row at ≥1200px (320px wide incl. 15px gutters) |
| Card | `.gl-card.gl-mb-5` — `background:#fff`, `border:1px solid #dcdcde`, `border-radius:4px`, w 290 h 82 |
| Body | `.gl-card-body` — `padding:16px` |
| Avatar | `img.gl-avatar.gl-avatar-s48.gl-float-left.gl-mr-3.gl-avatar-circle`, 48×48, `border-radius:50%`, `border:1px solid rgba(31,30,36,.08)` |
| Name | `a.user.js-user-link` → `/<username>` (bare, no `/users/` prefix), colour `#1f75cb`, 14px. Attributes: `data-user-id`, `data-qa-selector="user_link"`, `data-qa-username` |
| Handle | `<span class="gl-text-gray-900">@handle</span>` inside a second `.block-truncated`, colour `#333238`, 14px |

**Card link href is `/<username>`** (e.g. `/a11yproject`, `/panicsteve`, `/primer`) — the
same route family as `/byteblaze`.

### 8a.4 Seed data

`/users/byteblaze/following` — **3 cards**, in this order:

| # | Name | Handle | href | user id | gravatar md5 |
|---|---|---|---|---|---|
| 1 | `The A11Y Project` | `@a11yproject` | `/a11yproject` | 2325 | `557821a1c86255ab123c746353012b48` |
| 2 | `Steven Frank` | `@panicsteve` | `/panicsteve` | 2348 | `b2bacdcd1386f1e1b6fc4ceef9c9e2a4` |
| 3 | `Primer` | `@primer` | `/primer` | 2367 | `dcb7992be07bc8df1387127ae43f6b18` |

`/users/byteblaze/followers` — **2 cards**, in this order:

| # | Name | Handle | href | user id | gravatar md5 |
|---|---|---|---|---|---|
| 1 | `Steven Frank` | `@panicsteve` | `/panicsteve` | 2348 | `b2bacdcd1386f1e1b6fc4ceef9c9e2a4` |
| 2 | `小子欠扁` | `@xiaozi` | `/xiaozi` | 2347 | `104af1b1378d5614ccd0afa7b185add0` |

gravatar md5s for the nine follow-target users (md5 of the lower-cased email):
`yjlou 361c2ae1e18e2a331a6f6ee64fe93169`, `koush 95583fc3a71a528048e2af5310e762f6`,
`ghost 4249f4df72b475e7894fabed1c5888cf`, `lahwaacz bd22653ae918e73f888f9e773b420e43`,
`bblanchon 4d347064259c7049422bad8aa06b6081`, `R1kk3r 9144a76566fb684ef6dea86d5604bb99`,
`convexegg 60c7c9344248a6055e765d3b5c8bb046`, `vinta 46717f92e3121be9c1dfb2148c8fc941`,
`abisubramanya27 1f5a1e15b9a48728110c78d90fe55bd2`. (Serve locally — no network.)

### 8a.5 Behaviour

* Following a user must (a) add a card here, (b) bump the header `N following` count,
  (c) flip the target's profile button from `Follow` to `Unfollow`.
* Ordering is `user.followees` / `user.followers` in `users.id` order of the join rows
  (the seed order above is what the live instance renders; there is no sort control).
* Empty state: if the list is empty the pane renders **nothing at all** — no illustration,
  no copy (the `shared/users/index` partial has no empty branch). Do not invent one.
* No relative or absolute dates appear anywhere on these two tabs.

---

## 8b. `/users/byteblaze/starred`

**Route (ANCHOR — webarena-523, 524, 525, 526, 527).** `<title>`: `Byte Blaze · GitLab`.
Active tab `Starred projects`; pane `div#starred.tab-pane.active`.
Header and tab strip identical to §7. No page heading, no filter/sort toolbar, no pager
in the seed state.

### 8b.1 ANCHOR requirements

The evaluator has an **empty locator** — it matches against the whole page text of
`/users/byteblaze/starred` with `must_include` (case-insensitive):

| Task | Required project names (must all appear) |
|---|---|
| webarena-527 | `AndroidSlidingUpPanel` |
| webarena-526 | + `create-react-app`, `ffmpeg-python` |
| webarena-525 | + `PHP_XLSXWriter` |
| webarena-523 | + `AndroidAsync` |
| webarena-524 | + `Pytorch-GAN`, `administrate`, `keycloak` |

All eight strings are ANCHOR: `AndroidAsync`, `AndroidSlidingUpPanel`, `PHP_XLSXWriter`,
`Pytorch-GAN` (the real project is spelled `PyTorch-GAN`; the anchor compare is
case-insensitive so `PyTorch-GAN` satisfies it), `create-react-app`, `ffmpeg-python`,
`administrate`, `keycloak`.

These are the top-8 most-starred projects on the instance, so the starring flow is:
`/explore?sort=stars_desc` (or `/explore/projects?sort=stars_desc`) → open each project →
click ★ Star → the project appears in this list. Their data (needed to render the rows
once starred):

| Rank | Project id | Namespace (display) / path | Project | ★ | ⑂ | MRs | Issues | Visibility | Description |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 152 | `Umano: News Read To You` / `umano` | `AndroidSlidingUpPanel` | 55 | 0 | 34 | 267 | Public | `This library provides a simple way to add a draggable sliding up panel (popularized by Google Music and Google Maps) to your Android application. Brought to you by Umano.` |
| 2 | 122 | `Meta` / `facebook` | `create-react-app` | 52 | 0 | 417 | 1.5k | Public | `Set up a modern web app by running one command.` |
| 3 | 133 | `Karl Kroening` / `kkroening` | `ffmpeg-python` | 51 | 0 | 34 | 402 | Public | `Python bindings for FFmpeg - with complex filtering support` |
| 4 | 99 | `mk-j` / `mk-j` | `PHP_XLSXWriter` | 47 | 0 | 24 | 101 | Public | `Lightwight XLSX Excel Spreadsheet Writer in PHP` |
| 5 | 145 | `Koushik Dutta` / `koush` | `AndroidAsync` | 46 | 0 | 19 | 333 | Public | `Asynchronous socket, http(s) (client+server) and websocket library for android. Based on nio, not threads.` |
| 6 | 86 | `Erik Linder-Norén` / `eriklindernoren` | `PyTorch-GAN` | 45 | 0 | 24 | 102 | Public | `PyTorch implementations of Generative Adversarial Networks.` |
| 7 | 113 | `thoughtbot, inc.` / `thoughtbot` | `administrate` | 44 | 0 | 32 | 96 | Public | `A Rails engine that helps you put together a super-flexible admin dashboard.` |
| 8 | 143 | `Keycloak` / `keycloak` | `keycloak` | 43 | 0 | 230 | 1.6k | Public | `Open Source Identity and Access Management For Modern Applications and Services` |

(The next two, for context: `openapi-generator` 42 ★ (`OpenAPI Tools`), `autojump` 42 ★
(`William Ting`).) Every one shows `Updated 3 years ago`.

### 8b.2 Ordering

`StarredProjectsFinder` uses the `ProjectsFinder` default sort, which is
**`projects_order_id_desc` — project `id` DESC** (not star count, not activity, not
alphabetical). Confirmed against the seed: ids 185, 183, 174.

So after starring the eight anchors, the mock must list them id-descending:
`AndroidSlidingUpPanel` (152), `AndroidAsync` (145), `keycloak` (143), `ffmpeg-python`
(133), `create-react-app` (122), `administrate` (113), `PHP_XLSXWriter` (99),
`PyTorch-GAN` (86) — followed by the three seed rows (185, 183, 174). Ordering is not
graded, but reproduce it.

### 8b.3 FULL seed starred list (3 rows, in render order)

| # | Namespace (`.namespace-name`) | Project (`.project-name`) | href | Visibility | Role | Description | ★ | ⑂ | MRs | Issues | Updated (rel / `title` / `datetime`) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `Byte Blaze` | `accessible-html-content-patterns` | `/byteblaze/accessible-html-content-patterns` | **Private** — icon `data-testid="lock-icon"`, `title="Private - Project access must be granted explicitly to each user. If this project is part of a group, access is granted to members of the group."` | `Owner` | `♿️ The full HTML5 Doctor Element Index as well as common markup patterns for quick reference.` — `<p data-sourcepos="1:1-1:97" dir="auto"><gl-emoji title="wheelchair symbol" data-name="wheelchair" data-unicode-version="4.1">♿</gl-emoji>️ The full HTML5 …</p>` (note the standalone U+FE0F after the `</gl-emoji>`) | 1 | 0 | — | — | `3 years ago` / `Mar 27, 2023 4:22pm PDT` / `2023-03-27T23:22:59Z` |
| 2 | `Byte Blaze` | `empathy-prompts` | `/byteblaze/empathy-prompts` | **Public** — icon `data-testid="earth-icon"`, `title="Public - The project can be accessed without any authentication."` | `Owner` | `💡 Ideas to help consider Inclusive Design principles when making things for others to use.` (`<gl-emoji title="electric light bulb" data-name="bulb" data-unicode-version="6.0">💡</gl-emoji>`, `data-sourcepos="1:1-1:93"`) | 6 | 1 | 2 | 6 | `3 years ago` / `Mar 27, 2023 4:22pm PDT` / `2023-03-27T23:22:59Z` |
| 3 | `The A11Y Project` | `a11yproject.com` | `/a11yproject/a11yproject.com` | **Public** — earth icon, same title | `Maintainer` | `The A11Y Project is a community-driven effort to make digital accessibility easier.` (`data-sourcepos="1:1-1:83"`) | 21 | 0 | 10 | 40 | `3 years ago` / `Mar 27, 2023 1:15pm PDT` / `2023-03-27T20:15:32Z` |

Note rows 1's counter block only has Stars + Forks (a private project the viewer owns with
0 MRs/issues shows just those two); rows 2 and 3 additionally show Merge requests and
Issues. GitLab omits a counter link entirely when its value is 0 for MRs/issues, but always
renders Stars and Forks.

### 8b.4 Row markup (`shared/projects/_project`, non-compact)

```html
<div class="js-projects-list-holder" data-qa-selector="projects_list">
<ul class="projects-list gl-text-secondary gl-w-full gl-my-2">
  <li class="project-row">
    <div class="project-cell gl-w-11">
      <a class="project" href="/byteblaze/accessible-html-content-patterns">
        <div alt="" class="gl-avatar gl-avatar-s48 gl-mr-5 gl-avatar-identicon gl-avatar-identicon-bg4">A</div>
      </a>
    </div>
    <div class="project-cell">
      <div class="project-details gl-pr-9 gl-sm-pr-0 gl-w-full gl-display-flex gl-flex-direction-column"
           data-qa-project-name="accessible-html-content-patterns" data-qa-selector="project_content">
        <div class="gl-display-flex gl-align-items-center gl-flex-wrap-wrap">
          <h2 class="gl-font-base gl-line-height-20 gl-my-0">
            <a class="text-plain gl-mr-3 js-prefetch-document" href="/byteblaze/accessible-html-content-patterns">
              <span class="namespace-name gl-font-weight-normal">
                Byte Blaze
                /
              </span>
              <span class="project-name">accessible-html-content-patterns</span>
            </a>
          </h2>
          <span class="gl-mr-3 has-tooltip" data-container="body" data-placement="top"
                title="Private - Project access must be granted explicitly to each user. …">
            <svg class="s16" data-testid="lock-icon">…#lock</svg>
          </span>
          <span class="user-access-role gl-display-block gl-m-0" data-qa-selector="user_role_content">Owner</span>
        </div>
        <div class="description gl-display-none gl-sm-display-block gl-overflow-hidden gl-mr-3 gl-mt-2">
          <p data-sourcepos="1:1-1:97" dir="auto">…</p>
        </div>
        <!-- duplicate mobile-only controls: .gl-display-flex.gl-mt-3.gl-sm-display-none! -->
      </div>
    </div>
    <div class="project-cell gl-xs-display-none!">
      <div class="project-controls gl-display-flex gl-flex-direction-column gl-w-full gl-lg-flex-direction-row gl-justify-content-space-between"
           data-testid="project_controls">
        <div class="controls gl-display-flex gl-align-items-center">
          <a class="… icon-wrapper has-tooltip stars"          title="Stars"          href="…/-/starrers">      <svg data-testid="star-o-icon">   1 </a>
          <a class="… icon-wrapper has-tooltip forks"          title="Forks"          href="…/-/forks">         <svg data-testid="fork-icon">    0 </a>
          <a class="… icon-wrapper has-tooltip merge-requests" title="Merge requests" href="…/-/merge_requests"><svg data-testid="git-merge-icon"> 2 </a>
          <a class="… icon-wrapper has-tooltip issues"         title="Issues"         href="…/-/issues">        <svg data-testid="issues-icon">   6 </a>
        </div>
        <div class="updated-note gl-white-space-nowrap gl-justify-content-end">
          <span>
            Updated
            <time class="js-timeago" title="Mar 27, 2023 4:22pm PDT" datetime="2023-03-27T23:22:59Z"
                  data-toggle="tooltip" data-placement="top" data-container="body">3 years ago</time>
          </span>
        </div>
      </div>
    </div>
  </li>
</ul>
</div>
```

Each row renders its counters **twice** — once inside `.project-details` in a
`.gl-display-flex.gl-mt-3.gl-sm-display-none!` div (mobile, Stars only + Updated) and once
in the right-hand `.project-cell.gl-xs-display-none!` (desktop). The mock may render only
the desktop copy but must keep the classes/`data-testid`s.

Measured @1920: `ul.projects-list` x=336 w=1248; `li.project-row` h≈91, `padding:10px 0`,
1px bottom hairline; avatar cell `.project-cell.gl-w-11` w=64 (48px identicon +16);
`.project-details` x=400 w=625 (`padding-right:48px`); `h2` 14px/600 `#333238`;
`.description` 14px `#737278`; `.user-access-role` 12px pill, `border:1px solid #dcdcde`,
`border-radius:100px`, `padding:0 8px`; `.project-controls` x=1105 w=479.

Identicon avatars: `div.gl-avatar.gl-avatar-s48.gl-mr-5.gl-avatar-identicon.gl-avatar-identicon-bg<N>`
containing the project's first letter, `N` = `(project.id % 7) + 1`.

Verbatim visibility tooltip strings (used site-wide):
* `Public - The project can be accessed without any authentication.`
* `Private - Project access must be granted explicitly to each user. If this project is part of a group, access is granted to members of the group.`
* (internal) `Internal - The project can be accessed by any logged in user except external users.`

### 8b.5 Empty state

If nothing is starred, the pane renders (from `shared/empty_states/_profile_tabs`, owner
branch):

```html
<div class="nothing-here-block">
  <div class="svg-content">
    <img src="/assets/illustrations/profile-page/starred-….svg" width="75" height="75">
    <div class="text-content">
      <h5>You don't have starred projects yet.</h5>
      <p>Visit a project page and press on a star icon. Then, you can find the project on this page.</p>
      <a class="gl-button btn btn-confirm" href="/explore/projects/starred">Explore projects</a>
    </div>
  </div>
</div>
```
(Not observable on byteblaze — the list is non-empty. Structure mirrors the Groups empty
state in §8c, which *is* observed.)

### 8b.6 Dates

Only relative `3 years ago` is shown; absolute `Mar 27, 2023 4:22pm PDT` lives in the
`title=` tooltip and ISO `2023-03-27T23:22:59Z` in `datetime=`. No `Member since`-style
long dates in the pane.

---

## 8c. `/users/byteblaze/groups`

**Route.** `<title>`: `Byte Blaze · GitLab`. Active tab `Groups`; pane
`div#groups.tab-pane.active`. Same header/tab strip as §7. Not an anchor route.

### 8c.1 Observed state — EMPTY

byteblaze is a member of **no groups** (`JoinedGroupsFinder` returns nothing; the only user
on this instance with group memberships is `root`). The pane renders the owner-branch
empty state, verbatim:

```html
<div class="tab-pane active" id="groups">
  <div class="nothing-here-block">
    <div class="svg-content">
      <img class="js-lazy-loaded"
           src="/assets/illustrations/profile-page/groups-b5260ce8ad30a5782a6f08b03a324a2bbcdefff98719028fe39a33b5d0efa81b.svg"
           width="75" height="75" loading="lazy" data-qa_selector="js_lazy_loaded_content">
      <div class="text-content">
        <h5>You can create a group for several dependent projects.</h5>
        <p>Groups are the best way to manage projects and members.</p>
        <a class="gl-button btn btn-confirm" href="/groups/new">New group</a>
      </div>
    </div>
  </div>
</div>
```

* `h5` (bold, centred): `You can create a group for several dependent projects.`
* `p`: `Groups are the best way to manage projects and members.`
* Button (filled blue, centred): `New group` → `/groups/new`
* Illustration: a 75×75 folder-with-plus SVG above the text, all centred in the 1248px column.
* A *visitor* looking at someone else's empty Groups tab would instead see only the single
  `h5` visitor message with no `p` and no button.

### 8c.2 Non-empty rendering (`shared/groups/_list` → `_group`)

Captured from `/users/root/groups` so the dev agent has the shape if a group is ever joined:

```html
<ul class="content-list">
  <li class="group-row py-3 gl-align-items-center gl-display-flex!">
    <div class="avatar-container rect-avatar s40 gl-flex-shrink-0">
      <a href="/robert1003"><span class="avatar s40 identicon bg7">R</span></a>
    </div>
    <div class="gl-min-w-0 gl-flex-grow-1">
      <div class="title">
        <a class="group-name" href="/robert1003">robert1003</a>
      </div>
    </div>
    <div class="stats gl-text-gray-500 gl-flex-shrink-0">
      <span class="gl-ml-5"><svg class="s16 gl-vertical-align-text-bottom" data-testid="bookmark-icon">…</svg> 1</span>
      <span class="gl-ml-5"><svg class="s16 gl-vertical-align-text-bottom" data-testid="users-icon">…</svg> 1</span>
      <span class="gl-ml-5 visibility-icon has-tooltip" data-container="body" data-placement="left"
            title="Public - The group and any public projects can be viewed without any authentication.">
        <svg class="s16" data-testid="earth-icon">…</svg>
      </span>
    </div>
  </li>
</ul>
```

* Group avatar is a **square** identicon (`rect-avatar s40`, 40×40) — unlike the circular
  user avatars.
* `.stats` = projects count (`bookmark-icon`), members count (`users-icon`), then a
  `.visibility-icon` with tooltip. Group visibility tooltips (verbatim):
  * `Public - The group and any public projects can be viewed without any authentication.`
  * `Internal - The group and any internal projects can be viewed by any logged in user except external users.` (icon `shield-icon`)
  * `Private - The group and its projects can only be viewed by members.` (icon `lock-icon`)
* Group descriptions, when present, render as a `.description` div under `.title`.
* No dates are shown on group rows.

---

## 8d. `/users/byteblaze/activity`

**Route.** `<title>`: `Byte Blaze · GitLab`. Active tab `Activity`; pane
`div#activity.tab-pane.active`. Same header/tab strip as §7. Not an anchor route.

### 8d.1 Pane structure

```html
<div class="tab-pane active" id="activity">
  <div class="flash-container"></div>
  <h4 class="prepend-top-20">
    Most Recent Activity
  </h4>
  <div class="content_list" data-href="/users/byteblaze/activity"> …events or empty state… </div>
  <div class="loading" style="display: none;">
    <div class="gl-spinner-container" role="status">
      <span aria-label="Loading" class="gl-spinner gl-spinner-md gl-spinner-dark gl-vertical-align-text-bottom!"></span>
    </div>
  </div>
</div>
```

* Heading (verbatim, `h4.prepend-top-20`, left-aligned at x≈336, ~23px bold):
  **`Most Recent Activity`**. Note this differs from the Overview left-column heading,
  which is just `Activity`.
* `.content_list` is filled by an infinite-scroll AJAX pager
  (`GET /users/byteblaze/activity?limit=20&offset=…`, `Events` list, 20 per page).
* This pane is **only** rendered when the viewer `can?(:read_cross_project)`.

### 8d.2 Observed state — EMPTY

byteblaze has **no events**, so `.content_list` holds the same empty state as the Overview
Activity column (verbatim):

```html
<div class="nothing-here-block">
  <div class="svg-content">
    <img class="js-lazy-loaded"
         src="/assets/illustrations/profile-page/activity-e4ee12d7f972f2f4b9988f0662981a2a826bca8b3354c95a3d4b29877cc8d5ab.svg"
         width="75" height="75" loading="lazy" data-qa_selector="js_lazy_loaded_content">
    <div class="text-content">
      <h5>Join or create a group to start contributing by commenting on issues or submitting merge requests!</h5>
      <a class="gl-button btn btn-confirm btn-inverted" href="/explore/groups">Explore groups</a>
      <a class="gl-button btn btn-confirm" href="/groups/new">New group</a>
    </div>
  </div>
</div>
```

* `h5`: `Join or create a group to start contributing by commenting on issues or submitting merge requests!`
* Buttons side by side, centred: `Explore groups` (outlined blue, `btn-confirm btn-inverted`,
  → `/explore/groups`) and `New group` (filled blue, → `/groups/new`).
* On the Activity **tab** the block has no `p-5` class; in the Overview column the JS adds
  `p-5` after the empty response (`.nothing-here-block.p-5`).
* Illustration: 75×75 speech-bubble/lines SVG.

### 8d.3 Activity-feed row shape (for reference)

Not observable for byteblaze; the feed renders `events/_event` rows into `.content_list` as
`<li class="event-item">` with:
`.event-item-timestamp` on the right holding
`<time class="js-timeago" title="Mar 27, 2023 4:22pm PDT" datetime="2023-03-27T23:22:59Z">3 years ago</time>`,
a 32px circular user avatar, an event line
(`<a class="author-name">Byte Blaze</a> opened <a class="has-tooltip">#18</a> at <a>byteblaze/empathy-prompts</a>`),
and for push events a `.pushed-commit` block. Rows are grouped under
`<div class="js-timeago-render">` day headers only on the dashboard feed, not here.

### 8d.4 Dates on this tab

Relative only (`3 years ago`) in the visible text, with the absolute
`Mon D, YYYY h:mmam/pm TZ` form in `title=` and ISO-8601 UTC in `datetime=`. The header's
`Member since March 23, 2023` is the only absolute date visible on the page.

---

## 9. Project overview page (`/:ns/:proj`)

### 9.1 Routes & titles

| Route | `<title>` |
|---|---|
| `/byteblaze/dotfiles` | `Byte Blaze / dotfiles · GitLab` |
| `/byteblaze/gimmiethat.space` | `Byte Blaze / gimmiethat.space · GitLab` |
| `/a11yproject/a11yproject.com` | `The A11Y Project / a11yproject.com · GitLab` |
| `/primer/design` | `Primer / design · GitLab` |
| `/root/metaseq` | `Administrator / metaseq · GitLab` |
| `/CellularPrivacy/Android-IMSI-Catcher-Detector` | `CellularPrivacy / Android-IMSI-Catcher-Detector · GitLab` |

Title pattern: `<Namespace human name> / <project path> · GitLab`. **Namespace human name**, not
the URL slug (`Byte Blaze`, `The A11Y Project`, `Administrator`, `Convex Eggtart`, `Primer`,
`Henning Leutz`). No page-title prefix on the project root (unlike sub-pages).

Top breadcrumb bar (`.breadcrumbs-list.js-breadcrumbs-list > li`), 2 items only:

```
<a href="/byteblaze"> Byte Blaze    ›    <a href="/byteblaze/dotfiles"> dotfiles
```

ANCHOR routes in this section (project root pages the graders load):
`/byteblaze/11711_gitlab` (756), `/byteblaze/AGISite` (751), `/byteblaze/AutoAGI` (744),
`/byteblaze/agi_index` (750), `/byteblaze/awesome-llms` (745), `/byteblaze/awesome_web_agents` (747),
`/byteblaze/llm_bulk_inference` (746), `/byteblaze/planner` (742), `/byteblaze/project_site` (749),
`/byteblaze/web_agent` (752), `/byteblaze/web_agent_android_xl` (748), `/byteblaze/web_agent_android_xs` (753),
`/byteblaze/web_agent_index` (755), `/byteblaze/web_agent_nodejs` (754), `/byteblaze/web_arena` (743),
`/byteblaze/gimmiethat.space` (441–445), `/a11yproject/a11yproject.com` (205–207, 303–305 …).

> **IMPORTANT**: every one of `planner`, `web_arena`, `agi_index`, `AGISite`, `web_agent_index`,
> `11711_gitlab`, `AutoAGI`, `awesome-llms`, `awesome_web_agents`, `llm_bulk_inference`,
> `project_site`, `web_agent`, `web_agent_android_xl`, `web_agent_android_xs`, `web_agent_nodejs`
> returns **404 on the live instance** — they do not exist in the seed. They are projects the
> *task* creates (via `/projects/new`), and the grader then loads the project root of the
> newly-created project. So the mock must render this whole view **for user-created projects too**.

### 9.2 Box structure

| Element | x | width |
|---|---|---|
| `.nav-sidebar` (project sidebar) | 0 | 256 |
| `.content-wrapper` | 256 | 1664 |
| `#content-body` | **609** | **958** — this page is `limit-container-width` (990px `.container-limited`, centred) |

Vertical order inside `#content-body`:

1. `div.flash-container.flash-container-page.sticky[data-qa-selector="flash_container"]`
2. `div.project-home-panel.js-show-on-project-root.gl-my-5` (header block, §9.3)
3. `div.progress.repository-languages-bar.js-show-on-project-root` (thin language bar)
4. `div.project-show-files`
   - `div#tree-holder.tree-holder.clearfix.js-per-page`
     - `.info-well…project-last-commit` (last-commit banner, §9.6)
     - `div#js-code-owners` (empty)
     - `.nav-block` → `.tree-ref-container` (ref switcher + breadcrumb + `+` dropdown) and `.tree-controls` (right-hand buttons) — §9.5
     - `.project-buttons.gl-mb-5.js-show-on-project-root[data-qa-selector="project_buttons"]` (README / LICENSE / … chips, §9.7)
     - `div > .tree-content-holder > .table-holder.bordered-box > table.tree-table` (file browser, §9.6)
     - `article.file-holder.limited-width-container.readme-holder` (README render, §9.8)
   - `div#modal-create-new-dir`, `div#modal-upload-blob` (bootstrap modals, hidden)

Above `#content-body` two dismissible page alerts are usually present (global chrome, not
part of this view): *"You can't push or pull repositories using SSH until you add an SSH key
to your profile."* with `Add SSH key` / `Don't show again`, and the Auto DevOps info alert.

### 9.3 Project header row — `.project-home-panel`

Exact markup (dotfiles):

```html
<div class="project-home-panel js-show-on-project-root gl-my-5">
 <div class="gl-display-flex gl-justify-content-space-between gl-flex-wrap gl-sm-flex-direction-column gl-mb-3 gl-gap-5">
  <div class="home-panel-title-row gl-display-flex gl-align-items-center">
   <div class="avatar-container rect-avatar s64 home-panel-avatar gl-flex-shrink-0 gl-w-11 gl-h-11 gl-mr-3! float-none">
     <span class="avatar avatar-tile s64 identicon bg5">D</span>
   </div>
   <div>
    <h1 class="home-panel-title gl-font-size-h1 gl-mt-3 gl-mb-2 gl-display-flex"
        data-qa-selector="project_name_content" itemprop="name">
      dotfiles
      <span class="visibility-icon gl-text-secondary has-tooltip gl-ml-2" data-container="body"
            title="Public - The project can be accessed without any authentication.">
        <svg class="s16 icon" data-testid="earth-icon">…</svg>
      </span>
    </h1>
    <div class="home-panel-metadata gl-font-sm gl-text-secondary gl-font-base gl-font-weight-normal gl-line-height-normal"
         data-qa-selector="project_id_content" itemprop="identifier">
      <span class="gl-display-inline-block gl-vertical-align-middle">
        Project ID: 193
        <button class="btn btn-clipboard gl-button btn-default-tertiary btn-icon btn-sm"
                title="Copy project ID" aria-label="Copy project ID" data-clipboard-text="193"
                data-toggle="tooltip" data-placement="bottom" data-container="body"
                aria-live="polite" type="button"><svg data-testid="copy-to-clipboard-icon"></svg></button>
      </span>
      <span class="gl-ml-3 gl-mb-3"><!-- access-request link, see below --></span>
    </div>
   </div>
  </div>
  <div class="project-repo-buttons gl-display-flex gl-justify-content-md-end gl-align-items-center gl-flex-wrap gl-gap-3">…</div>
 </div>
 <nav class="project-stats">…</nav>
 <div class="gl-my-3"><!-- topics, empty in this instance --></div>
 <div class="home-panel-home-desc mt-1">…</div>
</div>
```

**Avatar tile** — `span.avatar.avatar-tile.s64.identicon.bg{N}` containing the first letter of the
project name (uppercased). `N = (project.id % 7) + 1`. Verified: dotfiles id 193 → `bg5`;
gimmiethat.space 184 → `bg3`; a11yproject.com 174 → `bg7`; metaseq 33 → `bg6`; design 180 → `bg6`;
Android-IMSI-Catcher-Detector 61 → `bg6`. Projects with an uploaded avatar render an `<img
class="avatar avatar-tile s64" …>` instead (e.g. `cloud-to-butt`). Tile is 64×64, square
(`rect-avatar`).

**`.visibility-icon` (ANCHOR — `document.querySelector('.visibility-icon').getAttribute('title')`,
webarena-742/743/744/745).** The three FULL title strings, verbatim from
`app/helpers/visibility_level_helper.rb` (`"#{label} - #{description}"`):

| Level | `title=` (verbatim) | icon `data-testid` |
|---|---|---|
| Public | `Public - The project can be accessed without any authentication.` | `earth-icon` (sprite `#earth`) |
| Internal | `Internal - The project can be accessed by any logged in user except external users.` | `shield-icon` (sprite `#shield`) |
| Private | `Private - Project access must be granted explicitly to each user. If this project is part of a group, access is granted to members of the group.` | `lock-icon` (sprite `#lock`) |

Task 742 asserts the title **contains `private`** (lower-case) → the description sentence carries
it. Tasks 743/744/745 assert it contains `public` → *"…can be accessed without any
authentication."* — note the word `public` only appears in the capitalised label `Public`, and the
grader's `must_include` is case-insensitive on the harness side; **render the full string above
verbatim**. Observed live: `/byteblaze/dotfiles`, `/a11yproject/a11yproject.com`, `/primer/design`,
`/root/metaseq`, `/vinta/awesome-python`, `/CellularPrivacy/…` = Public;
`/byteblaze/gimmiethat.space` = Private.

**Project ID line** — literal text `Project ID: {id}` (`s_('ProjectPage|Project ID: %{project_id}')`)
followed by the copy button `title="Copy project ID"` / `aria-label="Copy project ID"` /
`data-clipboard-text="{id}"`.

**Access-request link** (second `<span class="gl-ml-3 gl-mb-3">` inside `.home-panel-metadata`):
- member, non-owner → `<a class="js-leave-link" data-qa-selector="leave_group_link"
  href="/:ns/:proj/-/project_members/leave" aria-label="Leave project">Leave project</a>`
  (a11yproject.com, primer/design)
- non-member → `<a href="/:ns/:proj/-/project_members/request_access">Request Access</a>`
  (root/metaseq, CellularPrivacy/…, convexegg/*)
- owner (byteblaze's own projects) → span is empty.

**Button group `.project-repo-buttons`** (right-aligned, in DOM order):

| Control | Markup | Behaviour |
|---|---|---|
| Notification dropdown | `div.dropdown.b-dropdown.gl-dropdown.btn-group[data-testid="notification-dropdown"]`, icon-only toggle (`data-testid="notifications-icon"` + `chevron-down-icon`) | opens a menu of 6 items, each `button[data-testid="notification-item"]` with bold title + grey subtitle: `Global` / `Use your global notification setting` (active, check icon), `Watch` / `You will receive notifications for any activity`, `Participate` / `You will only receive notifications for threads you have participated in`, `On mention` / `You will receive notifications only for comments in which you were @mentioned`, `Disabled` / `You will not get any notifications via email`, divider, `Custom` / `You will only receive notifications for the events you choose`. No URL change. |
| Star | `div.count-badge.d-inline-flex.align-item-stretch.btn-group` → `button.gl-button.btn.btn-md.btn-default.star-btn.toggle-star[data-endpoint="/:ns/:proj/toggle_star.json"]` with `star-o-icon` + `<span class="gl-button-text">Star</span>` | POSTs; when starred the label becomes `Unstar` and the icon `star-icon` |
| Star count | `<a class="gl-button btn btn-default has-tooltip star-count count" href="/:ns/:proj/-/starrers" title="Starrers">0</a>` | navigates to `/-/starrers`. dotfiles `0`, a11yproject.com `21`, primer/design `21` |
| Fork | `<a class="gl-button btn btn-default fork-btn" href="/:ns/:proj/-/forks/new">` with `fork-icon` + `<span>Fork</span>` | → `/-/forks/new` |
| Fork count | `<a class="gl-button btn btn-default count has-tooltip fork-count" href="/:ns/:proj/-/forks" title="Forks">0</a>` | → `/-/forks`. Every project in this instance has `0`. |

### 9.4 `nav.project-stats` — the counts row

```html
<nav class="project-stats"><ul class="nav gl-gap-5">
 <li class="nav-item"><a class="nav-link gl-display-flex gl-align-items-center stat-link" href="…">
   <svg class="s16 icon gl-mr-2 gl-text-gray-500" data-testid="commit-icon"></svg>
   <strong class="project-stat-value">553</strong> Commits</a></li>
 …
</ul></nav>
```

| Item | icon `data-testid` | href | label (singular / plural) |
|---|---|---|---|
| Commits | `commit-icon` | `/:ns/:proj/-/commits/{default_branch}` | `Commit` / `Commits` |
| Branches | `branch-icon` | `/:ns/:proj/-/branches` | `Branch` / `Branches` |
| Tags | `label-icon` | `/:ns/:proj/-/tags` | `Tag` / `Tags` |
| Storage | `disk-icon` | `/:ns/:proj/-/usage_quotas` (owner only; otherwise not a link) | `Project Storage` (value is the humanised size) |
| Releases | `deployments-icon` | `/:ns/:proj/-/releases` | `Release` / `Releases` — **omitted entirely when count is 0** |

The number lives in `<strong class="project-stat-value">`, thousands-separated with `,`
(`2,320`, `2,642`). The unit word is a *text node after* the `<strong>`, so `.outerText` reads
`553\n Commits`. **Pluralisation is real** — `1 Commit`, `1 Branch` (verified on
`/convexegg/super_awesome_robot`: `1 Commit`, `1 Branch`, `0 Tags`, `72 KB Project Storage`;
`/byteblaze/gimmiethat.space`: `3 Commits`, `1 Branch`, `0 Tags`, `82 KB Project Storage`).
`0 Tags` uses the plural. Storage sizes render as `2.7 MB`, `82 KB`, `85.5 MB`, `97.8 MB`,
`32.4 MB`, `258.9 MB`, `72 KB`.

Observed values:

| Project | Commits | Branches | Tags | Storage | Releases |
|---|---|---|---|---|---|
| byteblaze/dotfiles | 553 | 2 | 0 | 2.7 MB | – |
| byteblaze/gimmiethat.space | 3 | 1 | 0 | 82 KB | – |
| a11yproject/a11yproject.com | 2,320 | 15 | 5 | 85.5 MB | 5 |
| primer/design | 921 | 38 | 0 | 97.8 MB | – |
| root/metaseq | 272 | 112 | 0 | 32.4 MB | – |
| CellularPrivacy/Android-IMSI-Catcher-Detector | 2,642 | 11 | 49 | 258.9 MB | – |
| convexegg/super_awesome_robot, convexegg/chatgpt | 1 | 1 | 0 | 72 KB | – |

### 9.5 Description block — `.home-panel-description-markdown` (ANCHOR)

```html
<div class="home-panel-home-desc mt-1">
  <div class="home-panel-description text-break">
    <div class="home-panel-description-markdown read-more-container" itemprop="description">
      <p data-sourcepos="1:1-1:19" dir="auto"><gl-emoji title="robot face" data-name="robot" data-unicode-version="8.0">🤖</gl-emoji> Computer setup</p>
    </div>
    <button class="btn gl-button btn-blank btn-link js-read-more-trigger d-lg-none" type="button">Read more</button>
  </div>
</div>
```

The whole `.home-panel-home-desc` is **omitted when the project has no description**.
`document.querySelector('.home-panel-description-markdown').outerText` is an **ANCHOR**
(webarena-750, 751, 755, 756). Values that must be reproducible:

| Project | `.home-panel-description-markdown` outerText | Task |
|---|---|---|
| `/byteblaze/agi_index`, `/byteblaze/web_agent_index` | `Example plain HTML site using GitLab Pages: https://pages.gitlab.io/plain-html` | 750, 755 |
| `/byteblaze/AGISite`, `/byteblaze/11711_gitlab` | `Example Jekyll site using GitLab Pages: https://pages.gitlab.io/jekyll` | 751, 756 |

Those two strings are the **descriptions carried by the built-in project templates**
`Pages/Plain HTML` (`plainhtml`) and `Pages/Jekyll` (`jekyll`). When a project is created from a
template on `/projects/new`, GitLab copies the template repo's description into the new project,
so the mock must seed the same description for template-created projects.

Live descriptions on seeded projects (verbatim):

| Project | description |
|---|---|
| byteblaze/dotfiles | `🤖 Computer setup` (leading `robot face` emoji, rendered via `<gl-emoji title="robot face" data-name="robot">`) |
| byteblaze/gimmiethat.space | `I need some space.` |
| a11yproject/a11yproject.com | `The A11Y Project is a community-driven effort to make digital accessibility easier.` |
| primer/design | `Primer Design Guidelines` |
| root/metaseq | `Repo for external large-scale work` |
| CellularPrivacy/Android-IMSI-Catcher-Detector | `AIMSICD • Fight IMSI-Catcher, StingRay and silent SMS!` |

Markdown is rendered (paragraph wrapper `<p data-sourcepos="…" dir="auto">`); autolinked URLs
become `<a href>`. `Read more` button is `d-lg-none` (mobile only).

`div.progress.repository-languages-bar.js-show-on-project-root` sits directly below the panel: a
row of `div.progress-bar.has-tooltip` segments whose `title` attribute contains *HTML*, e.g.
`<span class="repository-language-bar-tooltip-language">Shell</span>&nbsp;<span class="repository-language-bar-tooltip-share">98.0%</span>`.
dotfiles = Shell 98.0% / JavaScript 1.3% / AppleScript 0.6%.

### 9.6 The button row above the file browser (`.nav-block`)

Left half — `div.tree-ref-container.gl-display-flex.mb-2.mb-md-0`:

**(a) Ref switcher** — Vue `ref-selector` (the *new* dropdown; note blob/graph/network pages use a
different, legacy one — see §10b/§12c):

```html
<div class="dropdown b-dropdown gl-dropdown ref-selector gl-w-full btn-group" id="__BVID__47">
  <button class="btn dropdown-toggle btn-default btn-md gl-font-monospace gl-button gl-dropdown-toggle">
    <span class="gl-dropdown-button-text">main</span><svg data-testid="chevron-down-icon"></svg>
  </button>
  <ul class="dropdown-menu" role="menu">
    <div class="gl-dropdown-inner">
      <div class="gl-dropdown-header gl-border-b-0!">
        <p class="gl-dropdown-header-top">Select Git revision</p>
        <div class="gl-search-box-by-type">
          <input class="gl-form-input gl-search-box-by-type-input form-control"
                 data-qa-selector="ref_selector_searchbox"
                 placeholder="Search by Git revision" aria-label="Search by Git revision" type="search">
        </div>
      </div>
      <div class="gl-dropdown-contents">
        <div data-testid="branches-section" data-qa-selector="branches_section"> … </div>
        <div data-testid="tags-section" data-qa-selector="tags_section"> … </div>
      </div>
    </div>
  </ul>
</div>
```

- Section headers: `<li class="gl-dropdown-section-header"><header class="dropdown-header">`
  containing `<div data-testid="section-header"><span class="gl-mr-2 gl-mb-1">Branches</span>
  <span class="badge badge-neutral badge-pill gl-badge md">2</span></div>`. Same for `Tags`.
  (`.gl-dropdown-section-header` innerText reads `Branches  2` / `Tags  5`.)
- Each entry: `button.dropdown-item` with `svg[data-testid="mobile-issue-close-icon"]` (check mark,
  visible only for the current ref), `<span class="gl-font-monospace">main</span>`, and — for the
  default branch — `<span class="badge badge-info badge-pill gl-badge sm">default</span>`.
- Selecting a ref navigates to the same page with the ref swapped
  (`/:ns/:proj/-/tree/{ref}` from the project root, `/-/commits/{ref}` on commits, etc.).
- dotfiles branches: `main` (default), `master`. a11yproject.com: 15 branches, 5 tags.

**(b) Files breadcrumb** — `<nav aria-label="Files breadcrumb"><ol class="breadcrumb repo-breadcrumb">`:
on the project root there is exactly one link `<a href="/:ns/:proj/-/tree/{ref}/">{project path}</a>`
(rendered as `dotfiles /`) followed by the `+` dropdown item.

**(c) `+` "Add to tree" dropdown** — `div.dropdown…[data-testid="add-to-tree"][data-qa-selector="add_to_tree_dropdown"]`,
toggle `button.add-to-tree` with `<span class="sr-only">Add to tree</span>` + `plus-icon` +
`chevron-down-icon`. Full menu:

| Section header | Item | href |
|---|---|---|
| `This directory` | `New file` (`data-qa-selector="new_file_menu_item"`) | `/:ns/:proj/-/new/{ref}/{path}` |
| | `Upload file` | `#modal-upload-blob` (opens modal) |
| | `New directory` | `#modal-create-new-dir` (opens modal) |
| *(divider)* | | |
| `This repository` | `New branch` | `/:ns/:proj/-/branches/new` |
| | `New tag` | `/:ns/:proj/-/tags/new` |

Right half — `div.tree-controls > div.d-block.d-sm-flex.flex-wrap.align-items-start.gl-children-ml-sm-3.gl-first-child-ml-sm-0`,
in DOM/visual order:

| # | Control | Markup / href | Note |
|---|---|---|---|
| 1 | `History` | `<a class="btn btn-default btn-md gl-button" href="/:ns/:proj/-/commits/{ref}/{path}">` | **only on `/-/tree/…`, absent on the project root** |
| 2 | `Find file` | `<a class="gl-button btn btn-default shortcuts-find-file" href="/:ns/:proj/-/find_file/{ref}">` | |
| 3 | `Web IDE` | `<a id="web-ide-link" class="btn btn-default btn-md gl-button btn-default-secondary" data-qa-selector="web_ide_button" data-track-label="web_ide" href="/-/ide/project/:ns/:proj/edit/{ref}/-/">` | |
| 4 | Download | `button.gl-button.btn.btn-default.dropdown-toggle.gl-dropdown-toggle.dropdown-icon-only.has-tooltip[data-qa-selector="download_source_code_button"][title="Download"][aria-label="Download"]` containing `download-icon`, `<span class="sr-only">Select Archive Format</span>`, `chevron-down-icon` | see below |
| 5 | `Clone` | `<a id="clone-dropdown" class="gl-button btn btn-confirm clone-dropdown-btn" data-qa-selector="clone_dropdown" href="#">` | see below |

**Download dropdown panel** (`div.dropdown-menu.dropdown-menu-right`):
`<h5 class="m-0 dropdown-bold-header">Download source code</h5>` then a `btn-group` of 4 links:

```
zip      → /:ns/:proj/-/archive/{ref}/{proj}-{ref}.zip      (btn-confirm)
tar.gz   → /:ns/:proj/-/archive/{ref}/{proj}-{ref}.tar.gz
tar.bz2  → /:ns/:proj/-/archive/{ref}/{proj}-{ref}.tar.bz2
tar      → /:ns/:proj/-/archive/{ref}/{proj}-{ref}.tar
```

(also an empty `div#js-directory-downloads` for per-directory downloads).

**Clone dropdown panel** — `ul.dropdown-menu.dropdown-menu-large.dropdown-menu-selectable.clone-options-dropdown.dropdown-menu-right[data-qa-selector="clone_dropdown_content"]`:

| Row | Content |
|---|---|
| `<label class="label-bold">Clone with SSH</label>` | `<input id="ssh_project_clone" class="js-select-on-focus form-control" data-qa-selector="ssh_clone_url_content" name="ssh_project_clone" type="text" readonly value="ssh://git@10.186.197.203:2222/byteblaze/dotfiles.git">` + `<button class="btn input-group-text gl-button btn btn-icon btn-default" title="Copy URL" aria-label="Copy URL">` with `copy-to-clipboard-icon` |
| `<label class="label-bold">Clone with HTTP</label>` | `<input id="http_project_clone" … data-qa-selector="http_clone_url_content" name="http_project_clone" readonly value="http://10.186.197.203:8023/byteblaze/dotfiles.git">` + same copy button |
| `<li class="divider mt-2">` | |
| `<label class="label-bold gl-px-4!">Open in your IDE</label>` | 4 `<a class="dropdown-item open-with-link">`: `Visual Studio Code (SSH)` → `vscode://vscode.git/clone?url={urlencoded ssh url}`, `Visual Studio Code (HTTPS)` → `vscode://vscode.git/clone?url={urlencoded http url}`, `IntelliJ IDEA (SSH)` → `jetbrains://idea/checkout/git?idea.required.plugins.id=Git4Idea&checkout.repo={urlencoded ssh url}`, `IntelliJ IDEA (HTTPS)` → same with the http url |

**Host used by the live instance** (ANCHOR-relevant, webarena-293…297):
- SSH: `ssh://git@10.186.197.203:2222/{ns}/{proj}.git` → this is `__GITLAB_SSH__` =
  **`10.186.197.203:2222`** (external IP + SSH port 2222, *not* `localhost`).
- HTTP: `http://10.186.197.203:8023/{ns}/{proj}.git`.

Anchor answer strings the agent has to be able to read off this panel:
`git clone ssh://git@__GITLAB_SSH__/convexegg/super_awesome_robot.git` (293),
`git clone ssh://git@__GITLAB_SSH__/convexegg/chatgpt.git` (294),
`git clone ssh://git@__GITLAB_SSH__/root/metaseq.git` (295),
`ssh://git@__GITLAB_SSH__/eriklindernoren/PyTorch-GAN.git` (296),
`ssh://git@__GITLAB_SSH__/yjlou/2019-nCov.git` (297).
The `git clone ` prefix form comes from the **empty-repo** page's *Create a new repository* code
block (`convexegg/super_awesome_robot` and `convexegg/chatgpt` each have 1 commit so they render
the normal page — the agent constructs `git clone ` + the SSH input value). **Render the exact
`ssh://git@HOST:PORT/ns/proj.git` shape in `#ssh_project_clone`.**

There is also a mobile-only clone control (`div.project-clone-holder.d-block.d-md-none`) with
`Copy HTTP clone URL` / `Copy SSH clone URL` items — hidden at 1920px.

### 9.7 Last-commit banner — `.info-well.project-last-commit`

```html
<div class="info-well gl-display-none gl-sm-display-flex project-last-commit gl-flex-direction-column">
 <div class="well-segment commit gl-p-5 gl-w-full gl-display-flex">
  <span class="gl-my-2 gl-mr-4"><img class="gl-avatar gl-avatar-circle gl-avatar-s32" alt="user avatar" src="…"></span>
  <div class="commit-detail flex-list gl-display-flex gl-justify-content-space-between gl-align-items-flex-start gl-flex-grow-1 gl-min-w-0">
    <div class="commit-content" data-qa-selector="commit_content">
      <a class="gl-link commit-row-message item-title" href="/:ns/:proj/-/commit/{full-sha}">Update .macos</a>
      <!-- if the commit has a body: <button class="btn text-expander … button-ellipsis-horizontal" title="Toggle commit description" aria-label="Toggle commit description"> then <pre class="commit-row-description gl-mb-3 gl-white-space-pre-line"> -->
      <div class="committer">Eric Bailey authored
        <time title="Mar 19, 2023 9:00am PDT" datetime="2023-03-19T12:00:51-04:00">3 years ago</time>
      </div>
    </div>
    <div class="gl-flex-grow-1"></div>
    <div class="commit-actions gl-display-flex gl-flex-align gl-align-items-center gl-flex-direction-row">
      <div><a class="btn gpg-status-box invalid" role="button">Unverified</a></div>
      <div class="gl-ml-4 js-commit-sha-group btn-group" role="group">
        <span class="gl-font-monospace gl-button btn btn-label btn-md" data-testid="last-commit-id-label">
          <span class="gl-button-text">218b5e72</span></span>
        <button class="btn input-group-text btn-default btn-md gl-button btn-default-secondary btn-icon"
                id="clipboard-button-1" title="Copy commit SHA" aria-label="Copy commit SHA"
                data-clipboard-text="218b5e72424aca8b580e52342dbb92bd4bd076c8"><svg data-testid="copy-to-clipboard-icon"></svg></button>
      </div>
    </div>
  </div>
  <div id="js-code-owners"></div>
 </div>
</div>
```

- The author name is a plain text node (`Eric Bailey`) followed by literal `authored` then the
  `<time>`. `.committer` outerText reads `Eric Bailey authored 3 years ago`.
- Short SHA is 8 hex chars.
- `Unverified` badge (`a.btn.gpg-status-box.invalid`) appears for GPG-signed-but-unverified
  commits (dotfiles); it is **absent** on gimmiethat.space (unsigned commits).
- On the a11yproject nested-tree capture the message is truncated to `Update...` with the
  expander button and a `<pre class="commit-row-description">` holding the body.

### 9.8 File browser table

```html
<div class="tree-content-holder"><div class="table-holder bordered-box">
 <table class="table tree-table gl-table-layout-fixed" data-qa-selector="file_tree_table"
        aria-label="Files, directories, and submodules in the path / for commit reference main">
  <thead><tr>
    <th id="name">Name</th>
    <th class="d-none d-sm-table-cell" id="last-commit">Last commit</th>
    <th class="text-right" id="last-update">Last update</th>
  </tr></thead>
  <tbody>
   <tr class="tree-item">
     <td class="tree-item-file-name cursor-default position-relative">
       <a class="tree-item-link str-truncated" data-qa-selector="file_name_link"
          href="/byteblaze/dotfiles/-/tree/main/.mackup" title=".mackup">
         <span class="mr-1 position-relative text-secondary"><svg data-testid="folder-icon"></svg></span>
         <span class="position-relative">.mackup</span></a></td>
     <td class="d-none d-sm-table-cell tree-commit cursor-default gl-text-secondary">
       <a class="gl-link str-truncated-100 tree-commit-link gl-text-secondary"
          href="/byteblaze/dotfiles/-/commit/2e96e2a9…" title="Remove atom config settings&#10;">Remove atom config settings</a>
       <div></div></td>
     <td class="tree-time-ago text-right cursor-default gl-text-secondary">
       <time title="Nov 3, 2019 2:34pm PST" datetime="2019-11-03T17:34:32.000-05:00">6 years ago</time></td>
   </tr>
  </tbody>
 </table>
</div></div>
```

- `aria-label` pattern: `Files, directories, and submodules in the path {path or /} for commit reference {ref}`.
- Directories sort first, then files, each alphabetically (dotfiles first because of `.`).
  Directory rows link to `/-/tree/{ref}/{path}` with a `folder-icon`; file rows link to
  `/-/blob/{ref}/{path}` with a file-type icon (`data-testid` varies: generic file, `.gitignore`
  and `.gitconfig` get a red git icon, `.js` a yellow JS icon, etc.).
- The commit-message link `title` attribute carries the **full** commit message including the
  trailing newline; the visible text is the first line only.
- **Relative-time column**: `<time title="{ABS}" datetime="{ISO}">{REL}</time>` with
  `{REL}` = `3 years ago` / `6 years ago` / `10 years ago`, `{ABS}` = `Nov 3, 2019 2:34pm PST`
  (i.e. `MMM D, YYYY h:mma TZ`, local-tz abbreviation `PST`/`PDT`), `{ISO}` =
  `2019-11-03T17:34:32.000-05:00`. Note that on the *tree* table the `<time>` has **no**
  `js-timeago` class (server-rendered), whereas on commits/branches/tags lists it does.
- Nested trees additionally get a first row `<tr class="tree-item"><td class="tree-item-file-name"
  title="Go to parent directory"><a href="…/-/tree/{ref}/{parent}" aria-label="Go to parent">..</a></td></tr>`
  (no last-commit / last-update cells).
- No pagination controls; the whole directory is rendered (dotfiles root = 39 rows,
  a11yproject `src` = 23 rows).

### 9.9 CTA chips — `.project-buttons`

```html
<div class="project-buttons gl-mb-5 js-show-on-project-root" data-qa-selector="project_buttons">
 <ul class="nav gl-gap-3">
  <li class="nav-item"><a class="nav-link gl-display-flex gl-align-items-center gl-button btn btn-default" href="…"><svg data-testid="doc-text-icon"></svg>README</a></li>
  …
 </ul>
</div>
```

Two visual variants: **existing artefact** → `btn btn-default` (solid outline) with a
`doc-text`/`scale`/`settings` icon; **missing artefact** → `btn btn-dashed` (dashed outline) with a
`plus-square-o` icon. Order (from `ProjectPresenter#statistics_buttons`, `btn-dashed`-less items
are hoisted first): README, LICENSE, CHANGELOG, CONTRIBUTING, Auto DevOps, Kubernetes, CI/CD,
Integrations — but items whose `class_modifier` is set sort ahead, giving the observed order:

| Condition | Label | href |
|---|---|---|
| README exists | `README` (icon `doc-text-icon`) | `/:ns/:proj/-/blob/{ref}/README.md` (or `#readme` if the default project view is "readme") |
| README missing | `Add README` | `/:ns/:proj/-/new/{ref}?commit_message=Add+README.md&file_name=README.md` |
| LICENSE exists | the short licence name in `<span class="project-stat-value">`, e.g. `MIT License`, `GNU GPLv3`, icon `scale-icon` | `/:ns/:proj/-/blob/{ref}/LICENSE` |
| LICENSE missing | `Add LICENSE` (wrapped in `<span class="add-license-link d-flex">`) | `/:ns/:proj/-/new/{ref}?commit_message=Add+LICENSE&file_name=LICENSE` |
| CHANGELOG exists | `CHANGELOG` | `/:ns/:proj/-/blob/{ref}/CHANGELOG…` |
| CHANGELOG missing | `Add CHANGELOG` | `/:ns/:proj/-/new/{ref}?commit_message=Add+CHANGELOG&file_name=CHANGELOG` |
| CONTRIBUTING exists | `CONTRIBUTING` | `/:ns/:proj/-/blob/{ref}/CONTRIBUTING.md` |
| CONTRIBUTING missing | `Add CONTRIBUTING` | `/:ns/:proj/-/new/{ref}?commit_message=Add+CONTRIBUTING&file_name=CONTRIBUTING.md` |
| Auto DevOps on | `Auto DevOps enabled` (icon `settings-icon`, `btn-default`) | `/:ns/:proj/-/settings/ci_cd#autodevops-settings` |
| Auto DevOps off | `Enable Auto DevOps` (`btn-dashed`) | same href |
| no cluster | `Add Kubernetes cluster` | `/:ns/:proj/-/clusters` |
| has cluster | `Kubernetes` | `/:ns/:proj/-/clusters/{id}` |
| no `.gitlab-ci.yml` and no Auto DevOps | `Set up CI/CD` | `/:ns/:proj/-/ci/editor` |
| `.gitlab-ci.yml` exists | `CI/CD configuration` | `/:ns/:proj/-/ci/editor` |
| owner | `Configure Integrations` (icon `settings-icon`) | `/:ns/:proj/-/settings/integrations` |

Observed sets:
- dotfiles: `README`, `Auto DevOps enabled`, `Add LICENSE`, `Add CHANGELOG`, `Add CONTRIBUTING`, `Add Kubernetes cluster`, `Configure Integrations`
- gimmiethat.space: `MIT License`, `Auto DevOps enabled`, `Add README`, `Add CHANGELOG`, `Add CONTRIBUTING`, `Add Kubernetes cluster`, `Configure Integrations`
- a11yproject.com: `README`, `Add LICENSE`, `Add CHANGELOG`, `Add CONTRIBUTING`, `Enable Auto DevOps`, `Add Kubernetes cluster`, `Set up CI/CD`, `Configure Integrations`
- primer/design: `README`, `MIT License`, `CONTRIBUTING`
- root/metaseq: `README`, `MIT License`, `CHANGELOG`
- CellularPrivacy/…: `README`, `GNU GPLv3`, `CHANGELOG`

(Non-members only see the "exists" chips — no `Add …`, no `Configure Integrations`.)

### 9.10 README render below the tree

```html
<article class="file-holder limited-width-container readme-holder">
  <div class="js-file-title file-title-flex-parent">
    <div class="file-header-content">
      <svg data-testid="doc-text-icon"></svg>
      <a class="gl-link" href="/byteblaze/dotfiles/-/blob/main/README.md"><strong>README.md</strong></a>
    </div>
  </div>
  <div class="blob-viewer" data-qa-selector="blob_viewer_content">
    <div><div class="blob-viewer">
      <div class="file-content md">  … rendered GFM …  </div>
    </div></div>
  </div>
</article>
```

- Heading anchors are emitted as `<h1><a class="anchor" id="user-content-new-system-setup"
  href="#new-system-setup"></a>New System Setup</h1>` — i.e. an empty `<a class="anchor">`
  *before* the text, `id` prefixed with `user-content-`, `href` without the prefix.
- The block is present only when the repo has a README (absent on gimmiethat.space).
- It is `limited-width-container` even on wide pages.
- Same article is rendered at the bottom of `/-/tree/{ref}` (root). On nested tree paths it
  renders the README resolvable for that path (observed: `/-/tree/main/src` → none;
  `/-/tree/main/src/_posts` → the repo-root README — inconsistent; safest is to render the repo
  README only at the tree root and on the project overview).

### 9.11 Empty-repository variant of this page

If the project has no commits, `.project-home-panel` gets the extra class `empty-project`,
`nav.project-stats` is **empty** (`empty_repo_statistics_anchors` returns `[]`), and instead of the
file browser the page shows:

- `<h4 class="gl-mt-0 gl-mb-3">The repository for this project is empty</h4>`
- `<p>You can get started by cloning the repository or start adding files to it with one of the following options.</p>`
- a `.project-buttons[data-qa-selector="quick_actions_container"]` containing the Clone dropdown
  then the dashed chips `Upload file` (href `#modal-upload-blob`, class `js-upload-file-trigger`),
  `New file` (href `/-/ide/project/:ns/:proj/edit/{ref}`), `Add README`, `Add LICENSE`,
  `Add CHANGELOG`, `Add CONTRIBUTING`, `Set up CI/CD`, `Configure Integrations`
- `.empty-wrapper.gl-mt-4` with `<h3 id="repo-command-line-instructions" class="page-title-empty">Command line instructions</h3>`,
  `<p>You can also upload existing files from your computer using the instructions below.</p>`,
  then `.git-empty.js-git-empty` with `<h5>` sections `Git global setup`,
  `Create a new repository`, `Push an existing folder`, `Push an existing Git repository`,
  each followed by `<pre class="bg-light">`. The `Create a new repository` block starts with
  `git clone <span class="js-clone">ssh://git@10.186.197.203:2222/ns/proj.git</span>` — this is
  the literal source of the `git clone ssh://git@__GITLAB_SSH__/…` anchor answers.

---

## 10a. File tree (`/-/tree/:ref/:path`)

### Routes & titles

| Route | `<title>` | breadcrumb trail |
|---|---|---|
| `/byteblaze/dotfiles/-/tree/main` (ANCHOR, webarena-660) | `Files · main · Byte Blaze / dotfiles · GitLab` | `Byte Blaze › dotfiles › Repository` |
| `/a11yproject/a11yproject.com/-/tree/main/src` | `src · main · The A11Y Project / a11yproject.com · GitLab` | `Byte Blaze… › a11yproject.com › Repository` |
| `/amwhalen/archive-my-tweets/-/tree/github/fork/chtitux/addRssFeed` (ANCHOR, webarena-788) | `Files · github/fork/chtitux/addRssFeed · Andrew M. Whalen / archive-my-tweets · GitLab` | — |

Title pattern: `{last path segment or "Files"} · {ref} · {Namespace} / {project} · GitLab`.
Third breadcrumb item is always the literal `Repository`, href `/:ns/:proj/-/tree/{ref}{/path}`.

**Ref names can contain slashes** (`github/fork/chtitux/addRssFeed`) — the router must resolve the
longest matching ref, not split on the first `/`.

`#content-body` **x = 609, width = 958** (`limit-container-width`, same as the project overview).

### Structure

Identical to §9.6–§9.10 minus the `.project-home-panel`, `.repository-languages-bar` and
`.project-buttons` (all three carry `js-show-on-project-root` and are simply not emitted). Order:

1. `.flash-container` — a redirect from a missing blob lands here with
   `<div class="gl-alert flash-notice gl-alert-info" data-testid="alert-info" role="alert">` →
   `.gl-alert-body` text `"LICENSE" did not exist on "main"` plus a dismiss button
   (`button.gl-dismiss-btn…js-close[aria-label="Dismiss"]`).
2. `div#tree-holder.tree-holder.clearfix.js-per-page`
   - `.info-well…project-last-commit` (identical to §9.7)
   - `div#js-code-owners`
   - `.nav-block.gl-display-flex.gl-xs-flex-direction-column.gl-align-items-stretch`
     → `.tree-ref-container` (ref selector + `Files breadcrumb` + `+` dropdown) and `.tree-controls`
   - `div > .tree-content-holder > .table-holder.bordered-box > table.tree-table`
   - `article.file-holder.limited-width-container.readme-holder`
3. `div#modal-create-new-dir`, `div#modal-upload-blob`

`.tree-controls` here is `History` · `Find file` · `Web IDE` · Download(icon) · `Clone` —
i.e. exactly the project-root row **plus a leading `History`** (`/:ns/:proj/-/commits/{ref}/`).

**Breadcrumb with a path** — each segment is its own linked `<li class="breadcrumb-item">`,
cumulative hrefs, last one gets `router-link-exact-active router-link-active`:

```html
<nav aria-label="Files breadcrumb"><ol class="breadcrumb repo-breadcrumb">
  <li class="breadcrumb-item"><a class="router-link-active" href="/a11yproject/a11yproject.com/-/tree/main/">a11yproject.com</a></li>
  <li class="breadcrumb-item"><a class="router-link-exact-active router-link-active" href="/a11yproject/a11yproject.com/-/tree/main/src">src</a></li>
  <li class="breadcrumb-item"><!-- the + add-to-tree dropdown --></li>
</ol></nav>
```

Visually rendered as `a11yproject.com / src / [+ ▾]`.

`New file` inside the `+` dropdown becomes `/:ns/:proj/-/new/{ref}/{current path}`.

### Anchors that read this view

- webarena-660 loads `/byteblaze/dotfiles/-/tree/main` and needs `add support for oh-my-zsh`,
  `Abishek S`, `Jul 18, 2033` reachable via the issue created from here — the tree page itself only
  has to exist and be navigable.
- webarena-788 loads `/amwhalen/archive-my-tweets/-/tree/github/fork/chtitux/addRssFeed`, then the
  contributors page (see §12c).

---

## 10b. Blob view (`/-/blob/:ref/:path`) and raw (`/-/raw/:ref/:path`)

### 10b.1 Routes, titles, and the dotfiles-LICENSE gotcha

| Route | status | `<title>` |
|---|---|---|
| `/byteblaze/cloud-to-butt/-/blob/master/LICENSE.txt` (ANCHOR 411) | 200 | `LICENSE.txt · master · Byte Blaze / cloud-to-butt · GitLab` |
| `/byteblaze/accessible-html-content-patterns/-/blob/main/LICENSE` (ANCHOR 412) | 200 | `LICENSE · main · Byte Blaze / accessible-html-content-patterns · GitLab` |
| `/byteblaze/a11y-syntax-highlighting/-/blob/main/LICENSE` (ANCHOR 413) | 200 | `LICENSE · main · …` |
| `/byteblaze/gimmiethat.space/-/blob/main/LICENSE` (ANCHOR 736) | 200 | `LICENSE · main · Byte Blaze / gimmiethat.space · GitLab` |
| `/byteblaze/dotfiles/-/blob/main/README.md` | 200 | `README.md · main · Byte Blaze / dotfiles · GitLab` |
| **`/byteblaze/dotfiles/-/blob/main/LICENSE`** (ANCHOR 414, 736) | **302 → `/byteblaze/dotfiles/-/tree/main`** | `Files · main · Byte Blaze / dotfiles · GitLab` |

**Explanation for the bad capture.** `assets/html/proj-dotfiles-blob-license.html` (and
`/tmp/glwork/html/proj-dotfiles-blob-license2.html`) both show a *tree* page: I re-verified on the
live instance that `byteblaze/dotfiles` has **no `LICENSE` file at `main`** (its file list goes
`.mackup .ssh .zsh Adobe .bash_profile .brew .crontab …`, and the project overview shows an
`Add LICENSE` dashed chip). GitLab therefore redirects a missing blob to the tree root and flashes
`"LICENSE" did not exist on "main"`. Correspondingly
`GET /byteblaze/dotfiles/-/raw/main/LICENSE` returns **HTTP 404** with the standard GitLab
`<title>Not Found</title>` / `404` / `Page Not Found` /
`Make sure the address is correct and the page hasn't moved.` error page — that is why
`assets/html/proj-dotfiles-raw-license.html` is a 404 page.

The anchors 414/736 (`MIT License`, `The above copyright notice and this permission notice shall be
included in al…` on `/byteblaze/dotfiles/-/blob/main/LICENSE`) are **post-condition** anchors: the
task *adds* an MIT LICENSE to dotfiles, then the grader reads the blob. The mock must therefore
(a) redirect + flash for a missing blob, and (b) render a real blob page for the newly-created
file. `gimmiethat.space` already has a LICENSE — `1.04 KiB`, MIT — use it as the reference render.

Missing-blob redirect behaviour (verified live):
`GET /:ns/:proj/-/blob/{ref}/{missing}` → `302` → `/:ns/:proj/-/tree/{ref}` with flash
`"{missing}" did not exist on "{ref}"` (double quotes around both, exactly as shown).

### 10b.2 Box structure

`#content-body` **x = 464, width = 1248** (full width — *not* limited). Breadcrumb trail is
`Byte Blaze › cloud-to-butt › Repository` (third item href = the blob URL itself).

```
#content-body
├─ .flash-container.flash-container-page.sticky
├─ .js-signature-container
└─ div#tree-holder.tree-holder
   ├─ .nav-block
   │  ├─ .tree-ref-container > .tree-ref-holder > form.project-refs-form   ← LEGACY ref dropdown
   │  ├─ ul.breadcrumb.repo-breadcrumb
   │  └─ .tree-controls.gl-children-ml-sm-3
   ├─ .info-well.d-none.d-sm-block  (last-commit banner, blob flavour)
   ├─ div#js-code-owners
   ├─ .well-segment.blob-auxiliary-viewer   (licence / package.json summary strip — optional)
   └─ div#blob-content-holder.blob-content-holder.js-per-page
      └─ div > .file-holder
         ├─ .js-file-title.file-title-flex-parent
         └─ .file-content.code.js-syntax-highlight.blob-content… (or .blob-viewer for rendered md)
```

### 10b.3 Ref switcher on blob (LEGACY widget — different from tree!)

```html
<form class="project-refs-form">
  <input type="hidden" id="destination" name="destination" value="blob">
  <input type="hidden" name="path" value="LICENSE.txt">
  <div class="dropdown">
    <button type="button" class="dropdown-menu-toggle js-project-refs-dropdown"
            data-testid="branches-select" data-qa-selector="branches_dropdown">
      <span class="dropdown-toggle-text ">master</span><svg data-testid="chevron-down-icon"></svg>
    </button>
    <div class="dropdown-menu dropdown-menu-selectable git-revision-dropdown dropdown-menu-paging"
         data-qa-selector="branches_dropdown_content">
      <div class="dropdown-page-one">
        <div class="dropdown-title gl-display-flex">
          <span class="gl-ml-auto">Switch branch/tag</span>
          <button class="dropdown-title-button dropdown-menu-close gl-ml-auto" aria-label="Close">×</button>
        </div>
        <div class="dropdown-input">
          <input type="search" class="dropdown-input-field" data-qa-selector="dropdown_input_field"
                 placeholder="Search branches and tags">
        </div>
        <div class="dropdown-content"><!-- AJAX list, grouped under Branches / Tags headers --></div>
        <div class="dropdown-loading">…gl-spinner…</div>
      </div>
    </div>
  </div>
</form>
```

Copy differs from the tree widget: header `Switch branch/tag`, placeholder
`Search branches and tags` (vs `Select Git revision` / `Search by Git revision`). The same legacy
widget is used on `/-/graphs/:ref` and `/-/network/:ref`.

### 10b.4 Blob breadcrumb & `.tree-controls`

```html
<ul class="breadcrumb repo-breadcrumb">
  <li class="breadcrumb-item"><a href="/byteblaze/cloud-to-butt/-/tree/master">cloud-to-butt</a></li>
  <li class="breadcrumb-item"><a href="/byteblaze/cloud-to-butt/-/blob/master/LICENSE.txt"><strong>LICENSE.txt</strong></a></li>
</ul>
```

Intermediate directories get their own `<li>` linking to `/-/tree/{ref}/{partial path}`; the final
file segment is wrapped in `<strong>` and links to itself.

`.tree-controls.gl-children-ml-sm-3` (four plain buttons, in this exact order):

| Label | class | href |
|---|---|---|
| `Find file` | `gl-button btn btn-default shortcuts-find-file` | `/:ns/:proj/-/find_file/{ref}` |
| `Blame` | `gl-button btn btn-default js-blob-blame-link` | `/:ns/:proj/-/blame/{ref}/{path}` |
| `History` | `gl-button btn btn-default` | `/:ns/:proj/-/commits/{ref}/{path}` |
| `Permalink` | `gl-button btn btn-default js-data-file-blob-permalink-url` | `/:ns/:proj/-/blob/{full-commit-sha}/{path}` |

### 10b.5 Last-commit banner (blob flavour) — `.info-well.d-none.d-sm-block`

```html
<div class="info-well d-none d-sm-block"><div class="well-segment">
 <ul class="blob-commit-info">
  <li class="commit flex-row js-toggle-container" id="commit-ccfb9833">
   <div class="avatar-cell d-none d-sm-block">
     <a href="mailto:stevenf@panic.com"><img class="avatar s40 d-none d-sm-inline-block" title="Steven Frank" alt="Steven Frank's avatar" src="…"></a></div>
   <div class="commit-detail flex-list gl-display-flex gl-justify-content-space-between gl-align-items-flex-start gl-flex-grow-1 gl-min-w-0">
     <div class="commit-content" data-qa-selector="commit_content">
       <a class="commit-row-message item-title js-onboarding-commit-item " href="/byteblaze/cloud-to-butt/-/commit/ccfb9833…">Create LICENSE.txt</a>
       <span class="commit-row-message d-inline d-sm-none">· ccfb9833</span>
       <div class="committer">
         <a class="commit-author-link" href="mailto:stevenf@panic.com">Steven Frank</a> authored
         <time class="js-timeago" title="Feb 24, 2014 11:38am PST" datetime="2014-02-24T19:38:53Z">12 years ago</time>
       </div>
     </div>
     <div class="commit-actions flex-row">
       <div class="js-commit-pipeline-status"></div>
       <div class="commit-sha-group btn-group d-none d-sm-flex">
         <div class="label label-monospace monospace">ccfb9833</div>
         <button class="btn gl-button btn btn-default btn-icon" title="Copy commit SHA" aria-label="Copy commit SHA" data-clipboard-text="ccfb9833af53…"><svg data-testid="copy-to-clipboard-icon"></svg></button>
       </div>
     </div>
   </div>
  </li>
 </ul>
</div></div>
```

Note the *author name is a link* (`a.commit-author-link` → `mailto:`) here, unlike the tree page's
plain text node. The `<time>` here **does** carry `class="js-timeago"`, `datetime` is UTC-Z
(`2014-02-24T19:38:53Z`) and `title` is local (`Feb 24, 2014 11:38am PST`).

### 10b.6 Auxiliary viewer strip (`.well-segment.blob-auxiliary-viewer`)

Rendered for recognised files (LICENSE, package.json, …):

```html
<div class="well-segment blob-auxiliary-viewer"><div class="blob-viewer">
  <svg data-testid="scale-icon"></svg>
  This project is licensed under the <strong>MIT License</strong>. <a href="http://choosealicense.com/licenses/mit/">Learn more</a>
</div></div>
```

cloud-to-butt reads: `This project is licensed under the Do What The F*ck You Want To Public
License. Learn more` (link `http://choosealicense.com/licenses/wtfpl/`).
gimmiethat.space reads: `This project is licensed under the MIT License. Learn more`.

### 10b.7 File header row — `.js-file-title.file-title-flex-parent`

Left (`div.gl-display-flex`):

- **(markdown only)** a table-of-contents dropdown: `div.dropdown.b-dropdown.gl-dropdown.gl-mr-2.gl-pr-2.btn-group`
  with an icon-only toggle carrying `svg[data-testid="list-bulleted-icon"]`.
- `div.file-header-content.d-flex.align-items-center.lh-100`
  - file-type icon `<span><svg …></svg></span>`
  - `<strong class="file-title-name mr-1 js-blob-header-filepath" data-qa-selector="file_title_content">LICENSE.txt</strong>`
  - `<button class="btn btn-default btn-md gl-button btn-default-tertiary btn-icon btn-clipboard btn-transparent lh-100 position-static" title="Copy file path" aria-label="Copy file path" data-clipboard-text='{"text":"LICENSE.txt","gfm":"`LICENSE.txt`"}'>` (`copy-to-clipboard-icon`)
  - `<small class="gl-mr-3">483 bytes</small>` — the **file size**. Format: `483 bytes`,
    `1.04 KiB` (gimmiethat LICENSE), `1.08 KiB` (metaseq LICENSE), `9.42 KiB` (dotfiles README.md).
    Binary-prefix units (`bytes` / `KiB` / `MiB`), 2 decimals for KiB.

Right (`div.gl-display-flex.gl-flex-wrap.file-actions`) — **exact order**:

| # | Control | Markup |
|---|---|---|
| 1 | *(markdown/rendered files only)* source/rendered toggle | `div.js-blob-viewer-switcher.mx-2.btn-group[role=group]` with two `button.js-blob-viewer-switch-btn`: `title="Display source" aria-label="Display source"` (`code-icon`) and `title="Display rendered file" aria-label="Display rendered file"` (`document-icon`, gets class `selected` by default) |
| 2 | `Open in Web IDE` split button | `div.dropdown.b-dropdown.gl-dropdown.btn-group#web-ide-link[data-qa-selector="action_dropdown"]` → `<a class="btn btn-confirm btn-md gl-button split-content-button" id="web-ide-link__BV_button_" href="/-/ide/project/:ns/:proj/edit/{ref}/-/{path}"><span class="gl-dropdown-button-text" data-qa-selector="web_ide_button" data-track-label="web_ide">Open in Web IDE</span></a>` + `button#web-ide-link__BV_toggle_.dropdown-toggle-split` with `<span class="sr-only">Toggle dropdown</span>` |
| 2b | its menu | `button[data-testid="action_webide"][data-qa-selector="webide_menu_item"]` → bold `Open in Web IDE` + secondary `Quickly and easily edit multiple files in your project.`; divider; `button[data-testid="action_edit"][data-qa-selector="edit_menu_item"]` → bold `Edit` + secondary `Edit this file only.` |
| 3 | Replace / Delete group | `div.gl-mr-3 > div.btn-group[role=group]` with `button[data-testid="replace"]` → `Replace` and `button[data-testid="delete"]` → `Delete` (each `btn btn-default btn-md gl-button`, opens a modal) |
| 4 | icon group | `div.btn-group[data-qa-selector="default_actions_container"][role=group]` containing: `button.js-copy-blob-source-btn[data-testid="copyContentsButton"][data-qa-selector="copy_contents_button"][title="Copy file contents"][aria-label="Copy file contents"]` (`copy-to-clipboard-icon`; gets `disabled` while a rendered view is shown), `<a title="Open raw" aria-label="Open raw" href="/:ns/:proj/-/raw/{ref}/{path}">` (`doc-code-icon`), `<a title="Download" aria-label="Download" href="http://localhost:8023/:ns/:proj/-/raw/{ref}/{path}?inline=false">` (`download-icon` — note the **absolute** URL) |

There is **no `Lock` button** in this GitLab CE build (file locking is a Premium feature) and there
is **no standalone `Edit` button** — `Edit` only exists inside the Web-IDE split-button menu.
Non-members see the same button set, except the split-button's primary `href` becomes
`#modal-confirm-fork-webide` (verified on `/root/metaseq/-/blob/main/LICENSE`).

### 10b.8 Content area — plain (source) rendering

```html
<div class="file-content code js-syntax-highlight blob-content gl-display-flex gl-flex-direction-column gl-overflow-auto blob-viewer white"
     data-qa-selector="blob_viewer_file_content">
 <div><div>
  <div class="gl-display-flex">
    <div class="gl-p-0! gl-absolute gl-z-index-3 diff-line-num gl-border-r gl-display-flex line-links line-numbers">
      <a class="gl-user-select-none gl-shadow-none! file-line-num" id="L1" href="#L1">1</a>
    </div>
    <pre class="gl-p-0! gl-w-full gl-overflow-visible! gl-border-none! code highlight gl-line-height-0">
      <code><span class="line" id="LC1" data-testid="content"><span class="…">DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE</span></span></code>
    </pre>
  </div>
  <!-- one such .gl-display-flex block per line, L2/LC2, L3/LC3, … -->
 </div></div>
</div>
```

- One `div.gl-display-flex` **per source line**; line-number anchor `<a class="file-line-num"
  id="L{n}" href="#L{n}">{n}</a>` inside `.line-numbers` (also classed `diff-line-num line-links`);
  content `<span class="line" id="LC{n}" data-testid="content">`.
- Empty lines produce an empty `<span class="line" id="LC{n}">`.
- The theme class on the container is `white` (`.blob-content … white`).
- `.blob-content` / `.line-numbers` / `#L1` / `#LC1` / `.file-line-num` are all real, targetable
  selectors here.

### 10b.9 Content area — rendered markdown

For `.md` blobs the source block is replaced by
`<div class="blob-viewer js-syntax-highlight"><div><div class="blob-viewer"><div class="file-content md"> …GFM… </div></div></div></div>`
(same renderer as the README block, §9.10), and the `Display source` / `Display rendered file`
toggle appears in the header. Anchor headings identical to §9.10.

### 10b.10 Raw route — `/-/raw/:ref/:path`

- Response is **`Content-Type: text/plain; charset=utf-8`** with the file bytes and **no GitLab
  chrome at all**. Browsers show it inside `<pre style="word-wrap: break-word; white-space: pre-wrap;">`
  (that's the browser's own text viewer, visible in `proj-gimmiethat-raw-index.html`).
- `?inline=false` sets `Content-Disposition: attachment` (the `Download` button).
- Missing file → **404** GitLab error page: `<title>Not Found</title>`, big `404`,
  `Page Not Found`, `Make sure the address is correct and the page hasn't moved.` and a
  `Please contact your GitLab administrator if you think this is a mistake.` line.
- ANCHOR raw routes whose *content* is graded (all of these are files the task creates, so the mock
  must serve user-created files as raw text):
  `/byteblaze/gimmiethat.space/-/raw/main/index.html` (441–445, contents must include
  `<title>GIVE ME SPACE</title>` / `<title>Welcome to my site</title>` /
  `<title>Not an interesting site</title>` / `<title>Title Wanted</title>` / `<title>Hello</title>`),
  `/byteblaze/gimmiethat.space/-/raw/main/{real_space,news,moive_space,funny_pic}/urls.txt`
  (552–555), and `/byteblaze/{Awesome_DIY_ideas,Do-it-myself,TODO,fun_thing_to_do,live_a_life,
  nolan_*,bafta_awards_nolan}/-/raw/main/README.md` (556–566).
  The grader fetches the raw URL and does `must_include` on the plain-text body, so raw **must
  return the literal file text, not HTML**.

---

## 11. `/-/commits/:ref` — commit list

### Routes & titles

| Route | behaviour |
|---|---|
| `/:ns/:proj/-/commits` | **302 → `/:ns/:proj/-/commits/{default_branch}`** |
| `/byteblaze/dotfiles/-/commits/main` | 200, `<title>Commits · main · Byte Blaze / dotfiles · GitLab</title>` |
| `?search=Pika` | filters by commit message |
| `?author=Eric%20Bailey` | filters by author |
| `?offset=40` | next page (infinite scroll) |
| `?feed_token=…&format=atom` | Atom feed |

ANCHOR routes: `/byteblaze/awesome_web_agents/-/commits` (747), `/byteblaze/project_site/-/commits`
(749), `/byteblaze/web_agent/-/commits` (752), `/byteblaze/web_agent_android_xl/-/commits` (748),
`/byteblaze/web_agent_android_xs/-/commits` (753), `/byteblaze/web_agent_nodejs/-/commits` (754).
All six projects are **created by the task**, so the mock must render this page for a fresh repo
and the commit titles must be readable in the list:

| Commit message (ANCHOR, `must_include`) | Where |
|---|---|
| `Initial commit` | `/byteblaze/awesome_web_agents/-/commits`, `/byteblaze/web_agent/-/commits` (blank project + README) |
| `Initialized from 'Android' project template` | `/byteblaze/web_agent_android_xl/-/commits`, `/byteblaze/web_agent_android_xs/-/commits` |
| `Initialized from 'NodeJS Express' project template` | `/byteblaze/project_site/-/commits`, `/byteblaze/web_agent_nodejs/-/commits` |

(Note the graders hit `/-/commits` **without a ref** — the redirect to the default branch must work.)

Breadcrumb trail: `Byte Blaze › dotfiles › Commits` (3rd item href = the commits URL).
`#content-body` **x = 464, width = 1248** (full width).

### Layout

```
#content-body
└─ div.js-project-commits-show[data-commits-limit="40"]
   ├─ .tree-holder
   │  └─ .nav-block
   │     ├─ .tree-ref-container > .tree-ref-holder > div#js-project-commits-ref-switcher   ← NEW ref-selector widget
   │     ├─ ul.breadcrumb.repo-breadcrumb   →  <li><a href="/:ns/:proj/-/commits/{ref}">dotfiles</a></li>
   │     ├─ div#js-author-dropdown           ← the "Author" dropdown
   │     └─ .tree-controls
   │        ├─ .control          → form.commits-search-form.js-signature-container
   │        └─ .control.d-none.d-md-block → RSS link
   └─ div#project_{id}
      └─ ol#commits-list.list-unstyled.content_list
```

**Ref switcher** — same Vue `ref-selector` as the tree page (`Select Git revision` /
`Search by Git revision`, `Branches` / `Tags` sections with count pills). Selecting a ref navigates
to `/:ns/:proj/-/commits/{ref}`.

**Author filter** — `div.dropdown.b-dropdown.gl-dropdown.w-100.gl-mt-3.mt-sm-0.btn-group` whose
toggle text is `Author` (or the selected author's name). Menu:

- `<header class="dropdown-header">Search by author</header>` + divider
- search box `input.gl-form-input.gl-search-box-by-type-input[type=search][placeholder="Search"][aria-label="Search"]`
- item `Any Author`, divider, then one item per project member: 32px avatar +
  `<div>Byte Blaze</div><div>byteblaze</div>` (display name over username)
- Selecting sets `?author={name}` on the URL (verified: `?author=Eric%20Bailey` → 200).

**Message search** — `<form class="commits-search-form js-signature-container" method="get"
action="/:ns/:proj/-/commits/{ref}">` containing
`<input type="search" name="search" id="commits-search" class="form-control gl-form-input input-short gl-mt-3 gl-sm-mt-0 gl-min-w-full" placeholder="Search by message" spellcheck="false">`.
Submitting sets `?search=…`.

**RSS** — `<a class="btn gl-button btn-default btn-icon" title="Commits feed"
href="/:ns/:proj/-/commits/{ref}?feed_token=TMN_bBn9Z48qVbUFZV45&format=atom">` with `rss-icon`.

There are **no `Email patches` / `Plain diff` buttons on the commit *list*** — those live on the
single-commit page (`/-/commit/{sha}`). If the ref has an open MR the header additionally shows
`View open merge request`; otherwise, when a new MR can be created from the ref, a
`Create merge request` confirm button appears left of the search box.

### Row anatomy

Date group header:

```html
<li class="commit-header js-commit-header" data-day="2023-03-19">
  <span class="day">19 Mar, 2023</span>
  <span class="commits-count">1 commit</span>
</li>
```

**Date format is `%d %b, %Y` → `19 Mar, 2023`, `31 Jan, 2023`, `04 Mar, 2016` (zero-padded day,
3-letter month, comma before the year).** Count text is `n_("%d commit","%d commits")` →
`1 commit` / `2 commits`.

Then `<li class="commits-row" data-day="…"><ul class="content-list commit-list flex-list">` holding
one `<li>` per commit:

```html
<li class="commit flex-row js-toggle-container" id="commit-218b5e72">
  <div class="avatar-cell d-none d-sm-block">
    <a href="mailto:ericwbailey@users.noreply.github.com">
      <img class="avatar s40 d-none d-sm-inline-block" title="Eric Bailey" alt="Eric Bailey's avatar" src="…"></a></div>
  <div class="commit-detail flex-list gl-display-flex gl-justify-content-space-between gl-align-items-flex-start gl-flex-grow-1 gl-min-w-0">
    <div class="commit-content" data-qa-selector="commit_content">
      <a class="commit-row-message item-title js-onboarding-commit-item " href="/byteblaze/dotfiles/-/commit/218b5e72424aca8b580e52342dbb92bd4bd076c8">Update .macos</a>
      <span class="commit-row-message d-inline d-sm-none">· 218b5e72</span>
      <div class="committer">
        <a class="commit-author-link" href="mailto:ericwbailey@users.noreply.github.com">Eric Bailey</a>
        authored
        <time class="js-timeago" title="Mar 19, 2023 9:00am PDT" datetime="2023-03-19T16:00:51Z">3 years ago</time>
      </div>
    </div>
    <div class="commit-actions flex-row">
      <button class="btn gpg-status-box js-loading-gpg-badge"><div class="gl-spinner-container" role="status" aria-label="Loading">…</div></button>
      <div class="js-commit-pipeline-status" data-endpoint="/byteblaze/dotfiles/-/commit/218b5e72…/pipelines?ref=main"></div>
      <div class="commit-sha-group btn-group d-none d-sm-flex">
        <div class="label label-monospace monospace">218b5e72</div>
        <button class="btn gl-button btn btn-default btn-icon" title="Copy commit SHA" aria-label="Copy commit SHA" data-clipboard-text="218b5e72424aca8b580e52342dbb92bd4bd076c8"><svg data-testid="copy-to-clipboard-icon"></svg></button>
        <a class="btn gl-button btn-default btn-icon has-tooltip" href="/byteblaze/dotfiles/-/tree/218b5e72424aca8b580e52342dbb92bd4bd076c8" title="Browse Files"><svg data-testid="folder-open-icon"></svg></a>
      </div>
    </div>
  </div>
</li>
```

Right-hand controls in DOM order: GPG badge (a spinner placeholder that resolves to
`Unverified` / nothing), pipeline-status slot (empty in this instance — no CI), then the
`commit-sha-group` = short SHA label · copy-SHA button (`title="Copy commit SHA"`) ·
`Browse Files` link (`title="Browse Files"`, → `/-/tree/{full sha}`).

Commits with a body get the extra
`<button class="btn text-expander … button-ellipsis-horizontal" title="Toggle commit description" aria-label="Toggle commit description">`
and a hidden `<pre class="commit-row-description">`.

### Pagination

`div.js-project-commits-show` carries **`data-commits-limit="40"`** — 40 commits are rendered
server-side, the rest load by **infinite scroll** (`?offset=40`, verified 200). There is **no
numbered pager and no Prev/Next**. A `gl-loading-icon` (`.loading.hide`) sits after the list.

### Empty / no-results states

- Filtered to nothing: `<div class="commits-empty gl-mt-6">` with an illustration,
  `<h4>Your search didn't match any commits.</h4>` and `<p>Try changing or removing filters.</p>`
  (verified live with `?search=zzzzzz`).
- If commits were truncated: a warning alert
  `%s additional commits have been omitted to prevent performance issues.` (singular
  `%s additional commit has been omitted to prevent performance issues.`).

---

## 12a. `/-/branches`

### Routes & titles

| Route | tab |
|---|---|
| `/:ns/:proj/-/branches` | `Overview` (active) |
| `/:ns/:proj/-/branches/active` | `Active` |
| `/:ns/:proj/-/branches/stale` | `Stale` |
| `/:ns/:proj/-/branches/all` | `All` |
| `…/all?search=foo` / `…/all?sort=name_asc` | filter / sort |

`<title>` = `Branches · Byte Blaze / dotfiles · GitLab` on every tab.
Breadcrumbs: `Byte Blaze › dotfiles › Repository › Branches` (the `Repository` item links to
`/:ns/:proj/-/tree/{ref}`, the last to the current branches URL).
`#content-body` **x = 464, width = 1248**.

### Header

```html
<div class="top-area gl-border-0">
 <ul class="gl-flex-grow-1 gl-border-b-0 nav gl-tabs-nav">
  <li class="nav-item"><a class="nav-link gl-tab-nav-item active gl-tab-nav-item-active" href="/byteblaze/dotfiles/-/branches" title="Show overview of the branches">Overview</a></li>
  <li class="nav-item"><a class="nav-link gl-tab-nav-item" href="/byteblaze/dotfiles/-/branches/active" title="Show active branches">Active</a></li>
  <li class="nav-item"><a class="nav-link gl-tab-nav-item" href="/byteblaze/dotfiles/-/branches/stale"  title="Show stale branches">Stale</a></li>
  <li class="nav-item"><a class="nav-link gl-tab-nav-item" href="/byteblaze/dotfiles/-/branches/all"    title="Show all branches">All</a></li>
 </ul>
 <div class="nav-controls">…</div>
</div>
<div class="js-branch-list"
     data-diverging-counts-endpoint="/byteblaze/dotfiles/branches.json"
     data-default-branch="main"></div>
```

Tabs carry **no counts**. `.nav-controls`, left→right:

1. Search — `div.input-group.gl-search-box-by-click.gl-mr-3[data-testid="branch-search"][role=group]`
   → `input.gl-form-input.gl-search-box-by-click-input.form-control[data-testid="branch-search"]`
   **`placeholder="Filter by branch name"` `aria-label="Filter by branch name"` `type="search"`**
   + `button[data-testid="search-button"][aria-label="Search"]` with `search-icon`.
   Submitting → `?search=…`.
2. Sort dropdown — **only rendered on the `Active` / `Stale` / `All` tabs, NOT on `Overview`**.
   `div.gl-dropdown.dropdown.btn-group.gl-mr-3[data-testid="branches-dropdown"]`, toggle text
   defaults to `Updated date`. Options (`ul#listbox[role=listbox]` → `li.gl-dropdown-item.gl-listbox-item[role=option]`):

   | Label | `?sort=` |
   |---|---|
   | `Name` | `name_asc` |
   | `Oldest updated` | `updated_asc` |
   | `Updated date` (default) | `updated_desc` |

3. `<button class="btn gl-mr-3 btn-danger btn-md gl-button btn-danger-secondary" data-qa-selector="delete_merged_branches_button">Delete merged branches</button>` (opens a confirm modal; push permission only)
4. `<a class="gl-button btn btn-confirm" href="/:ns/:proj/-/branches/new">New branch</a>`

### Overview tab body — two cards

`Overview` renders up to `@overview_max_branches` (5) of each set inside
`div.gl-card.gl-mb-5` cards:

- `<div class="gl-card-header">Active branches</div>`
- `<div class="gl-card-header">Stale branches</div>`

each with `<div class="gl-card-body gl-py-0"><ul class="content-list all-branches" data-qa-selector="all_branches_container">…</ul></div>`.
A card is **omitted entirely when its set is empty** (dotfiles shows only `Stale branches`,
because both `main` and `master` are >3 months old). If a set has more than 5 branches the card
gets a centred footer link `<a id="state-active" data-state="active" href="/:ns/:proj/-/branches/active">Show more active branches</a>`
(resp. `Show more stale branches`).

`Active` / `Stale` / `All` tabs render a bare `<ul class="content-list all-branches">` (no cards)
followed by pagination.

### Branch row

```html
<li class="branch-item gl-display-flex! gl-align-items-center! js-branch-item js-branch-master"
    data-name="master" data-qa-selector="branch_container" data-qa-name="master">
 <div class="branch-info">
  <div class="gl-display-flex gl-align-items-center">
    <svg data-testid="branch-icon" class="s12 gl-flex-shrink-0"></svg>
    <a class="item-title str-truncated-100 ref-name gl-ml-3" data-qa-selector="branch_link"
       href="/byteblaze/dotfiles/-/tree/master">master</a>
    <button class="btn btn-clipboard gl-button btn-default-tertiary btn-icon btn-sm"
            title="Copy branch name" aria-label="Copy branch name" data-clipboard-text="master"></button>
    <!-- badges, in this order, only when applicable: -->
    <span class="gl-badge badge badge-pill badge-info sm gl-ml-2" data-qa-selector="badge_content">default</span>
    <span class="gl-badge badge badge-pill badge-info sm gl-ml-2" data-qa-selector="badge_content"
          title="Merged into main" data-toggle="tooltip">merged</span>
    <span class="gl-badge badge badge-pill badge-success sm gl-ml-2" data-qa-selector="badge_content">protected</span>
  </div>
  <div class="block-truncated"><div class="branch-commit cgray">
    <div class="icon-container commit-icon"><svg></svg></div>
    <a class="commit-sha" href="/byteblaze/dotfiles/-/commit/e19ab89a021a57e1f8d354cea6bb87df09c7c504">e19ab89a</a>
    ·
    <span class="str-truncated"><a class="commit-row-message cgray" href="/…/-/commit/e19ab89a…">Update .functions</a></span>
    ·
    <time class="js-timeago" title="Aug 24, 2020 5:56pm PDT" datetime="2020-08-25T00:56:10Z">5 years ago</time>
  </div></div>
 </div>

 <!-- divergence graph: present for every branch EXCEPT the default branch -->
 <div class="divergence-graph px-2 d-none d-md-block" title="109 commits behind main, 39 commits ahead">
   <div class="position-relative float-left pt-1 graph-side h-100">
     <div class="position-absolute bar js-graph-bar rounded-left position-right-0" style="width:…"></div>
     <span class="d-block pt-1 pr-1 count js-graph-count text-right">109</span></div>
   <div class="graph-separator float-left mt-1"></div>
   <div class="position-relative float-left pt-1 graph-side h-100">
     <div class="position-absolute bar js-graph-bar rounded-right position-left-0" style="width:…"></div>
     <span class="d-block pt-1 pr-1 count js-graph-count text-left">39</span></div>
 </div>

 <div class="controls d-none d-md-block">
   <a class="gl-button btn btn-md btn-default " href="/:ns/:proj/-/merge_requests/new?merge_request%5Bsource_branch%5D=master"><span class="gl-button-text">Merge request</span></a>
   <a class="gl-button btn btn-default js-onboarding-compare-branches " href="/:ns/:proj/-/compare?from=main&amp;to=master" title="Compare">Compare</a>
   <div class="project-action-button dropdown gl-dropdown inline"><!-- Download / Select Archive Format, identical to §9.6 but with {ref}=master --></div>
   <button class="btn js-delete-branch-button btn-default btn-md gl-button btn-icon"
           data-qa-selector="delete_branch_button" title="Delete branch" aria-label="Delete branch"><svg data-testid="remove-icon"></svg></button>
 </div>
</li>
```

Per-branch differences observed on dotfiles:

| Branch | badges | divergence | controls |
|---|---|---|---|
| `master` | – | `109` behind / `39` ahead, tooltip `109 commits behind main, 39 commits ahead` | `Merge request`, `Compare`, Download▾, Delete branch |
| `main` | `default`, `protected` | *(none — default branch)* | Download▾, Delete branch **disabled** with `title="The default branch cannot be deleted" aria-label="The default branch cannot be deleted"` |

The `li` class carries the branch name verbatim: `js-branch-{name}` (slashes included, e.g.
`js-branch-github/fork/Roshanjossey/1478-fix-404-urls`).

### Empty states

- No branches at all: `<div class="nothing-here-block">No branches to show</div>`
- Filter with no hits: same `.nothing-here-block` with `No branches to show`
  (verified live: `/-/branches/all?search=zzz`).
- Gitaly down: `Unable to load branches`.

---

## 12b. `/-/tags`

`<title>` = `Tags · Byte Blaze / dotfiles · GitLab`.
Breadcrumbs: `Byte Blaze › dotfiles › Tags`. `#content-body` **x = 464, width = 1248**.
Query params: `?search=…`, `?sort=…`, `?feed_token=…&format=atom`.

### Header — `div.flex-list > div.top-area.adjust`

- Left: `<div class="nav-text row-main-content">Tags give the ability to mark specific points in history as being important</div>`
- Right `.nav-controls`:
  1. `div.input-group.gl-search-box-by-click.gl-pr-3[data-testid="tag-search"][role=group]` →
     `input[data-testid="tag-search"][placeholder="Filter by tag name"][aria-label="Filter by tag name"][type=search]`
     + `button[data-testid="search-button"][aria-label="Search"]` (`search-icon`). → `?search=`
  2. sort dropdown `div.dropdown.b-dropdown.gl-dropdown.btn-group[data-testid="tags-dropdown"]`,
     toggle text `Updated date`, menu `ul.dropdown-menu.dropdown-menu-right`:

     | Label | `?sort=` |
     |---|---|
     | `Name` | `name_asc` |
     | `Oldest updated` | `updated_asc` |
     | `Updated date` (default) | `updated_desc` |
     | `Latest version` | `version_desc` |
     | `Oldest version` | `version_asc` |

  3. `<a class="btn gl-button btn-default btn-icon has-tooltip gl-ml-auto" title="Tags feed" href="/:ns/:proj/-/tags?feed_token=…&format=atom">` (`rss-icon`)
  4. `<a class="btn gl-button btn-confirm" data-qa-selector="new_tag_button" href="/:ns/:proj/-/tags/new">New tag</a>`

### Body — `div.tags`

Populated (`/a11yproject/a11yproject.com/-/tags`, 5 tags):

```html
<ul class="flex-list content-list">
 <li class="flex-row js-tag-list gl-white-space-normal! gl-align-items-flex-start!">
  <div class="row-main-content">
    <svg data-testid="tag-icon"></svg>
    <a class="item-title ref-name" href="/a11yproject/a11yproject.com/-/tags/1.5.0">1.5.0</a>
    <div class="block-truncated"><div class="branch-commit cgray">
      <div class="icon-container commit-icon"><svg></svg></div>
      <a class="commit-sha" href="/…/-/commit/eb922de5fa61827b6d11b9b1245c9d59ad30993b">eb922de5</a> ·
      <span class="str-truncated"><a class="commit-row-message cgray" href="/…/-/commit/eb922de5…">Update package versions (#1185)</a></span> ·
      <time class="js-timeago" title="Jan 31, 2021 4:30pm PST" datetime="2021-02-01T00:30:33Z">5 years ago</time>
    </div></div>
    <!-- annotated-tag message would render here as .description.md -->
    <div class="gl-text-secondary"><svg data-testid="rocket-icon"></svg> Release
      <a class="gl-text-blue-600!" href="/a11yproject/a11yproject.com/-/releases/1.5.0">1.5.0</a></div>
  </div>
  <div class="row-fixed-content controls flex-row">
    <div class="project-action-button dropdown gl-dropdown inline"><!-- Download ▾ / Select Archive Format, archives named {proj}-{tag}.zip etc. --></div>
    <a class="btn gl-button btn-default btn-icon btn-edit has-tooltip gl-mr-3!" href="/…/-/releases/1.5.0/edit" title="Edit release"><svg data-testid="pencil-icon"></svg></a>
    <button class="gl-button btn btn-icon btn-md btn-default js-delete-tag-button" title="Delete tag" aria-label="Delete tag"><svg data-testid="remove-icon"></svg></button>
  </div>
 </li>
</ul>
<!-- then: kaminari .gl-pagination when > 1 page -->
```

### Empty states (verbatim)

No tags at all (dotfiles):

```html
<div class="tags"><div class="nothing-here-block">
  Repository has no tags yet.
  <br>
  <small>
    Use git tag command to add a new one:
    <br>
    <span class="monospace">git tag -a v1.4 -m 'version 1.4'</span>
  </small>
</div></div>
```

Search with no hits: `<div class="nothing-here-block">Sorry, your filter produced no results.</div>`
(verified live with `?search=zzz`).

---

## 12c. `/-/graphs/:ref` — contributors

### Routes & titles

| Route | title |
|---|---|
| `/byteblaze/dotfiles/-/graphs/main` | `Contributors · Byte Blaze / dotfiles · GitLab` |
| **`/dehenne/awesome-visibility/-/graphs/master`** (ANCHOR, webarena-787) | `Contributors · Henning Leutz / awesome-visibility · GitLab` |
| `/root/metaseq/-/graphs/main` | `Contributors · Administrator / metaseq · GitLab` |
| `/amwhalen/archive-my-tweets/-/graphs/php52` | `Contributors · Andrew M. Whalen / archive-my-tweets · GitLab` |
| `/primer/design/-/graphs/main` | `Contributors · Primer / design · GitLab` |
| `/a11yproject/a11yproject.com/-/graphs/main` | `Contributors · The A11Y Project / a11yproject.com · GitLab` |

Note the namespace **path** is `dehenne` while the display name is `Henning Leutz` — the mock must
keep that mapping. Sibling route `/-/graphs/:ref/charts` (Analytics → Repository) also exists.
Breadcrumbs: `Byte Blaze › dotfiles › Contributors`. `#content-body` **x = 464, width = 1248**.

### Header — `div.sub-header-block.gl-bg-gray-10.gl-p-5`

- Ref dropdown: the **legacy** `form.project-refs-form` widget (`<input type="hidden" id="destination"
  name="destination" value="graphs">`, toggle `button.dropdown-menu-toggle.js-project-refs-dropdown[data-testid="branches-select"][data-qa-selector="branches_dropdown"]`
  showing the ref, panel title `Switch branch/tag`, search placeholder `Search branches and tags`).
  Selecting navigates to `/:ns/:proj/-/graphs/{ref}`.
- `<a class="btn gl-button btn-default" href="/:ns/:proj/-/commits/{ref}">History</a>`

### Body — `div.contributors-charts`

```html
<div class="contributors-charts">
  <h4 class="gl-mb-2 gl-mt-5">Commits to main</h4>
  <span>Excluding merge commits. Limited to 6,000 commits.</span>
  <div><!-- the big area/bar chart --></div>
  <div class="row">
    <div class="col-lg-6 col-12 gl-my-5">
      <h4 class="gl-mb-2 gl-mt-0">Eric Bailey</h4>
      <p class="gl-mb-3">537 commits (ericwbailey@users.noreply.github.com)</p>
      <div><!-- mini chart --></div>
    </div>
    …
  </div>
</div>
```

**Exact copy (verified — the brief's guessed one-sentence form is wrong):** the heading is
`<h4>Commits to {ref}</h4>` (e.g. `Commits to main`, `Commits to master`, `Commits to php52`) and
the caption is a *separate* `<span>` reading exactly
`Excluding merge commits. Limited to 6,000 commits.`

**Per-contributor card**: `h4` = the author's *name*; `p` = `{n} commits ({email})` —
**pluralised**: `1 commit (binumathew1988@gmail.com)`, `51 commits (leutz@pcsg.de)`. Cards are
sorted by commit count descending, two per row (`col-lg-6`). The same human can appear multiple
times under different e-mail addresses (Eric Bailey twice, Scott Vinkle twice, …) — GitLab groups
by e-mail, not by user.

**Charts**: GitLab uses `@gitlab/ui` ECharts. Top chart = commits-over-time area chart with
`Number of commits` y-axis label, month/year x-axis ticks (`Apr Jul Oct 2017 Apr Jul …`), a
brush/zoom slider below, and an inline legend
`<div class="gl-legend-inline"> … <span class="gl-truncate gl-font-weight-bold" title="Commits">Commits</span> … <span>Avg: 215m · Max: 20</span></div>`.
Per-contributor charts have a `Commits` y-axis label and the same legend line
(`Avg: 209m · Max: 20`, `Avg: 5.83m · Max: 7`). Tooltip container:
`div.gl-chart-tooltip[id^="ec_"]`.

### Data the graders need (webarena-317 — "top 3 contributors of metaseq")

`/root/metaseq/-/graphs/main` cards, in order:

| Name | line |
|---|---|
| Susan Zhang | `70 commits (suchenzang@users.noreply.github.com)` → answer `Susan Zhang: 70` |
| Stephen Roller | `51 commits (roller@fb.com)` → `Stephen Roller: 51` |
| Peter Albert | `12 commits (37597043+xirider@users.noreply.github.com)` → `Peter Albert: 12` |
| Zachary DeVito | `12 commits (zdevito@gmail.com)` |
| Kunal Chakrabarty | `10 commits (kunal1612@users.noreply.github.com)` |
| ngoyal2707 | `9 commits (ngoyal2707@users.noreply.github.com)` |
| lilisierrayu | `8 commits (86027527+lilisierrayu@users.noreply.github.com)` |
| Srinivasan Iyer | `7 commits (sviyer@fb.com)` |
| ruanslv | `7 commits (ruanslv@gmail.com)` |
| Punit Singh Koura | `7 commits (punitkoura@meta.com)` |

`/dehenne/awesome-visibility/-/graphs/master` (ANCHOR 787, expected answer `0`): heading
`Commits to master`; cards `Henning Leutz 51 commits (leutz@pcsg.de)`,
`Jérémie Zarca 3 commits (jzarca01@users.noreply.github.com)`,
`James Ivings 2 commits (james.ivings@gmail.com)`, then eight one-commit contributors —
`Binu Mathew 1 commit (binumathew1988@gmail.com)`, `Capela 1 commit (diogo.capela@mindera.com)`,
`Jared Rhizor 1 commit (me@jaredrhizor.com)`, `Alexander Isora 1 commit (alexdot78@gmail.com)`,
`Caleb Peterson 1 commit (caleb.peterson@cubicle6.com)`,
`Robert DeVore 1 commit (deviodigital@gmail.com)`, `Bruce 1 commit (t15thbruce@outlook.de)`.

`/amwhalen/archive-my-tweets/-/graphs/php52` (webarena-788 → `Andrew M. Whalen`,
`github@amwhalen.com`): `Andrew M. Whalen 14 commits (github@amwhalen.com)`,
`andrew.whalen 7 commits (andrew.whalen@d93f9b6f-941f-f72b-29eb-9d76ad2ed331)`,
`ProgVal 6 commits (progval@progval.net)`,
`andrew.whalen@gmail.com 6 commits (andrew.whalen@gmail.com@d93f9b6f-941f-f72b-29eb-9d76ad2ed331)`.

`/byteblaze/dotfiles/-/graphs/main`: `Eric Bailey 537 commits (ericwbailey@users.noreply.github.com)`,
`Eric Bailey 15 commits (eric.w.bailey@gmail.com)`.

`/a11yproject/a11yproject.com/-/graphs/main` top 10: `Eric Bailey 422 (eric.w.bailey@gmail.com)`,
`Eric Bailey 410 (ericwbailey@users.noreply.github.com)`, `Dave Rupert 87 (rupato@gmail.com)`,
`Scott Vinkle 64 (svinkle@users.noreply.github.com)`, `Scott O'Hara 57 (scottaohara@users.noreply.github.com)`,
`Jerry Jones 54 (jones.jeremydavid@gmail.com)`, `grayghostvisuals 52 (grayghost@grayghostvisuals.com)`,
`EJ Mason 48 (eliasjmason@gmail.com)`, `Scott Vinkle 41 (svinkle@gmail.com)`,
`Scott O'Hara 39 (scottaohara@gmail.com)`.

`/primer/design/-/graphs/main` top 10: `Shawn Allen 95`, `Inayaili León 77`,
`Aurora Pleguezuelo 66`, `Joshua Shao 54`, `Emily Brick 38`, `Cole Bemis 35`,
`Chelsea Adelman 29`, `dependabot[bot] 27`, `Mike Perrotti 26`, `Vinicius Depizzol 26`.

---

## 12d. `/-/network/:ref` — repository graph

`<title>` = `Graph · main · Byte Blaze / dotfiles · GitLab`
(pattern `Graph · {ref} · {Namespace} / {project} · GitLab`).
Breadcrumbs: `Byte Blaze › dotfiles › Graph`. `#content-body` **x = 464, width = 1248**.
Sidebar item is `Repository → Graph`.

```
#content-body
├─ div.row-content-block.second-block.content-component-block.gl-px-0.gl-py-3
│  ├─ .tree-ref-holder > form.project-refs-form   ← LEGACY ref widget, hidden input destination="graph"
│  └─ div.oneline  →  "You can move around the graph by using the arrow keys."
└─ div.gl-mt-5
   └─ div.project-network.gl-border-1.gl-border-solid.gl-border-gray-300
      ├─ div.controls.gl-bg-gray-50.gl-p-2.gl-font-base.gl-text-gray-400.gl-border-b-1.gl-border-b-solid.gl-border-b-gray-300
      │  └─ form.form-inline.network-form
      │     ├─ input#extended_sha1.search-input.form-control.gl-form-input.input-mx-250.search-sha.gl-mr-2[name="extended_sha1"][placeholder="Git revision"][type="text"]
      │     ├─ button.gl-button.btn.btn-icon.btn-md.btn-confirm[type=submit]  (search-icon)
      │     └─ div.inline.gl-ml-5 > div.form-check.light
      │        ├─ input#filter_ref.form-check-input[type=checkbox][name="filter_ref"][value="1"]
      │        └─ label.form-check-label[for="filter_ref"] → <span>Begin with the selected commit</span>
      └─ div.network-graph.gl-bg-white.gl-overflow-scroll.gl-overflow-x-hidden
         ├─ <svg>   ← the graph, drawn client-side from /:ns/:proj/-/network/{ref}.json
         └─ gl-spinner (Loading)
```

**Copy corrections vs. the brief**: the checkbox label is `Begin with the selected commit`
(there is **no** "Show whole repository graph" control), the search box placeholder is
`Git revision` (name `extended_sha1`), and the hint line above the box is
`You can move around the graph by using the arrow keys.`

**The SVG graph** (rendered by `network/branch_graph.js`, ~1080px tall, scrollable):
- Two dark gutter columns on the left, ~46px + ~46px wide: the first shows the **month
  abbreviation** (`Mar`, `Jan`, `Sep`, `Aug`, `Jul`, `Jun`, …) only on the row where the month
  changes; the second shows the **day of month** (`19`, `30`, `29`, `22`, `21`, …) only when it
  changes. Both in white monospace on `#2e2e2e`-ish background.
- To the right, a vertical **red commit line** with a small filled circle per commit; the commit
  rows are laid out one per line, newest at top.
- Each commit row: a 20px round author avatar then the commit title in monospace
  (`Update .macos`, `Update .scss-lint.yml`, `Add Pika`, `Update README.md`, …).
- Branch/tag heads get a grey rounded label to the left of the dot with a left-pointing arrow,
  e.g. `main ▸◂`; the currently selected ref's label is highlighted.
- Merge commits fork the line into additional coloured lanes (not present in dotfiles, which is
  linear).
- Keyboard: arrow keys pan the SVG.

Data endpoint: `GET /:ns/:proj/-/network/{ref}.json?filter_ref=…&limit=…` returning
`{commits: [...], days: [[day, month], ...]}`.

---

## 12e. `/-/forks` and `/:ns/:proj/activity`

### 12e.1 `/:ns/:proj/-/forks`

`<title>` = `Byte Blaze / dotfiles · GitLab` (**same as the project root — no page-title prefix**).
Breadcrumbs: `Byte Blaze › dotfiles › Byte Blaze / dotfiles` (the third crumb is the project's
*full name*, href = the forks URL). `#content-body` **x = 464, width = 1248**.

```
#content-body
├─ div.top-area
│  ├─ div.nav-text  →  "0 forks: 0 public, 0 internal, and 0 private"
│  └─ div.gl-display-flex.gl-sm-flex-direction-column.gl-md-align-items-center
│     ├─ form#project-filter-form.project-filter-form.gl-display-flex.gl-mt-3.gl-md-mt-0 (GET, action = current URL)
│     │  └─ input#filter_projects.projects-list-filter.project-filter-form-field.form-control.input-short.gl-flex-grow-1
│     │        [name="filter_projects"][type="search"][placeholder="Search forks"][spellcheck="false"]
│     ├─ div.dropdown.gl-display-inline.gl-md-ml-3.issue-sort-dropdown.gl-mt-3.gl-md-mt-0
│     │  └─ .btn-group[role=group] > .btn-group[role=group] > .js-redirect-listbox
│     │        toggle text "Created date"; options: "Created date" (?sort=created_desc) / "Updated date" (?sort=latest_activity_desc)
│     │     + <a class="gl-button btn btn-default btn-icon has-tooltip reverse-sort-btn rspec-reverse-sort"
│     │          href="/byteblaze/dotfiles/-/forks?sort=created_asc" title="Sort direction"> (sort-highest-icon)
│     └─ <a class="btn gl-button btn-confirm gl-md-ml-3 gl-mt-3 gl-md-mt-0" href="/:ns/:proj/-/forks/new" title="Fork project">
│           <svg data-testid="fork-icon"></svg><span>Fork</span></a>
└─ div.js-projects-list-holder[data-qa-selector="projects_list"]
```

**Count line** (verbatim template): `{pluralize(total,'fork')}: {public} public, {internal} internal, and {private} private`
→ `0 forks: 0 public, 0 internal, and 0 private`; with one fork it would read `1 fork: 1 public, 0 internal, and 0 private`.

**Empty state (the only state present in this instance — every project has 0 forks; verified on
dotfiles, a11yproject.com and primer/design):**

```html
<div class="js-projects-list-holder" data-qa-selector="projects_list">
  <div class="nothing-here-block">
    <div class="svg-content"><img class="js-lazy-loaded" src="…illustrations/…"></div>
    <div class="text-content"><h5>This user doesn't have any personal projects</h5></div>
  </div>
</div>
```

(Note the copy is the generic personal-projects empty state, not a fork-specific one.)

If forks existed, `.js-projects-list-holder` would hold the standard shared projects list
(`ul.projects-list` → `li.project-row` with avatar, `.project-full-name` = `Namespace / project`,
description, star / fork / issue / MR counts, visibility icon and `Updated {rel} ago`) — the exact
same component as `/dashboard/projects`.

If the current user already forked the project the `Fork` button is replaced by
`<a href="/{user}/{fork}" title="Go to your fork" class="btn gl-button btn-confirm gl-md-ml-3">…Fork</a>`.

### 12e.2 `/:ns/:proj/activity`

`<title>` = `Activity · Byte Blaze / dotfiles · GitLab`.
Breadcrumbs: `Byte Blaze › dotfiles › Activity`. `#content-body` **x = 464, width = 1248**.
Sidebar: `Project information → Activity`. This route is also the target of the sidebar's
`Project information` parent link.

```
#content-body
├─ div.nav-block.d-none.d-sm-flex.activities.gl-static
│  ├─ div.scrolling-tabs-container.inner-page-scroll-tabs.is-smaller.flex-fill
│  │  ├─ div.fade-left  (chevron-lg-left-icon)
│  │  ├─ div.fade-right (chevron-lg-right-icon)
│  │  └─ ul.nav-links.event-filter.scrolling-tabs.nav.nav-tabs.is-initialized
│  └─ div.controls.gl-display-flex
│     └─ <a class="btn gl-button btn-default btn-icon d-none d-sm-inline-flex has-tooltip"
│            title="Subscribe" href="/byteblaze/dotfiles.atom?feed_token=TMN_bBn9Z48qVbUFZV45"> (rss-icon)
├─ div.content_list.project-activity
└─ div.loading  (gl-spinner, infinite scroll)
```

Filter tabs — each is `<li [class="active"]><a class="event-filter-link" id="{key}_event_filter"
href="{current path}" title="{tooltip}"><span> {label}</span></a></li>`:

| Label | `id` | `title` |
|---|---|---|
| `All` (active by default) | `all_event_filter` | `Filter by all` |
| `Push events` | `push_event_filter` | `Filter by push events` |
| `Merge events` | `merged_event_filter` | `Filter by merge events` |
| `Issue events` | `issue_event_filter` | `Filter by issue events` |
| `Comments` | `comments_event_filter` | `Filter by comments` |
| `Wiki` | `wiki_event_filter` | `Filter by wiki` |
| `Designs` | `designs_event_filter` | `Filter by designs` |
| `Team` | `team_event_filter` | `Filter by team` |

All `href`s are the **plain current path** (`/byteblaze/dotfiles/activity`); the JS intercepts the
click, requests `…/activity?event_filter={key}&limit=20` and swaps `.content_list` — **the visible
URL does not change**, and the choice persists in the `event_filter` cookie.

**Empty state — this is the ONLY state in this instance.** The seed database contains no `events`
rows, so *every* project activity feed (dotfiles, a11yproject.com, …) renders:

```html
<div class="content_list project-activity">
  <div class="nothing-here-block">
    <div class="svg-content"><img class="js-lazy-loaded" src="…"></div>
    <div class="text-content"><h5>No activities found</h5></div>
  </div>
</div>
```

If events existed, each row would be `<li class="event-item">` with a 40px avatar, a bold author
link, an event verb (`pushed to branch`, `opened issue`, `commented on`, `joined project`), the
target link, a `<time class="js-timeago">` and, for pushes, a nested commit list plus a
`Compare with previous version` link — same component as `/dashboard/activity` and
`/users/:u/activity`.

---

### Cross-cutting notes for the implementer

- **Relative-time convention across all views in this part**: `<time class="js-timeago"
  title="{Mon D, YYYY h:mma TZ}" datetime="{ISO8601}">{n years ago}</time>`. The tree table is the
  one place the `js-timeago` class is absent and the `datetime` uses a numeric offset
  (`2019-11-03T17:34:32.000-05:00`) rather than `Z`. Tooltip examples verbatim:
  `Mar 19, 2023 9:00am PDT`, `Nov 3, 2019 2:34pm PST`, `Feb 24, 2014 11:38am PST`,
  `Jan 31, 2021 4:30pm PST`. The "today" of the captures is **2026** (`Mar 2023` renders as
  `3 years ago`, `Mar 2016` as `10 years ago`).
- **Two different ref-picker widgets** must be built:
  `ref-selector` (Vue, `Select Git revision` / `Search by Git revision`, `Branches`/`Tags` sections
  with count pills, monospace toggle) on **project root / tree / commits**; and the legacy
  `js-project-refs-dropdown` (`Switch branch/tag` / `Search branches and tags`,
  `dropdown-menu-paging`) on **blob / graphs / network**.
- **`feed_token`** in every RSS href is the constant `TMN_bBn9Z48qVbUFZV45` for byteblaze.
- **`#content-body` width rule**: project root and `/-/tree/…` are `limit-container-width`
  (x=609, w=958); blob, commits, branches, tags, graphs, network, forks and activity are full
  width (x=464, w=1248).
- Every `has-tooltip` / `data-toggle="tooltip"` element renders its text from the `title`
  attribute — graders read `title` directly, so keep them.

---

## 13. `/-/issues` — issue list

### 13.1 Routes and `<title>`

| Route | Notes |
|---|---|
| `/:namespace/:project/-/issues` | canonical, no query string. Renders "Open" tab. |
| `/:namespace/:project/-/issues/` | **trailing slash** — this is the form every filtered/sorted link and every WebArena anchor URL uses. Must resolve identically. |
| `/:namespace/:project/-/issues/?<params>` | see §13b for the full param list |

`<title>` is always `Issues · <Group display name> / <project path> · GitLab` — **the query string never changes it**. Verified:

| URL | `<title>` |
|---|---|
| `/a11yproject/a11yproject.com/-/issues` | `Issues · The A11Y Project / a11yproject.com · GitLab` |
| `/a11yproject/a11yproject.com/-/issues/?label_name%5B%5D=bug` | `Issues · The A11Y Project / a11yproject.com · GitLab` |
| `/root/metaseq/-/issues` | `Issues · Administrator / metaseq · GitLab` |
| `/byteblaze/dotfiles/-/issues` | `Issues · Byte Blaze / dotfiles · GitLab` |
| `/primer/design/-/issues/?sort=updated_desc&state=opened&first_page_size=20` | `Issues · Primer / design · GitLab` |
| `/vinta/awesome-python/-/issues` | `Issues · Vinta Chen / awesome-python · GitLab` |
| `/umano/AndroidSlidingUpPanel/-/issues/?state=opened&not%5Blabel_name%5D%5B%5D=BUG` | `Issues · Umano: News Read To You / AndroidSlidingUpPanel · GitLab` |
| `/OpenAPITools/openapi-generator/-/issues/?label_name%5B%5D=OpenAPI%20Generator%20CLI` | `Issues · OpenAPI Tools / openapi-generator · GitLab` |
| `/kkroening/ffmpeg-python/-/issues/?label_name%5B%5D=question` | `Issues · Karl Kroening / ffmpeg-python · GitLab` |
| `/keycloak/keycloak/-/issues/?label_name%5B%5D=flaky-test` | `Issues · Keycloak / keycloak · GitLab` |
| `/0ang3el/aem-hacker/-/issues` | `Issues · 0ang3el / aem-hacker · GitLab` |
| `/convexegg/chatgpt/-/issues` | `Issues · Convex Eggtart / Chatgpt · GitLab` |

**There is NO `<h1>Issues</h1>` on this page.** GitLab 15.7 identifies the page only with
(a) the breadcrumb and (b) the left-sidebar "Issues ▸ List" item being active. Verified against
the DOM and the screenshot.

Breadcrumb (`.breadcrumbs`, the `.container-limited` strip at x≈448–593, width 990, height 48):
`The A11Y Project` › `a11yproject.com` › `Issues`
(links: `/a11yproject`, `/a11yproject/a11yproject.com`, `/a11yproject/a11yproject.com/-/issues`).
The last crumb `Issues` is bold/current.

### 13.2 Box structure

```
navbar-gitlab (0, 1920×48, fixed)
nav-sidebar   (0, 256 wide)  — project sidebar, "Issues" item active with count badge, sub-items
                               List / Boards / Service Desk / Milestones
content-wrapper (x=256, 1664 wide)
  .breadcrumbs        (container-limited, 990 wide)
  main#content-body   (x=609, width 958)
    .flash-container.flash-container-page.sticky[data-qa-selector="flash_container"]  (empty)
    .js-jira-issues-import-status-root
    div > .issuable-list-container
        1. .top-area            (tabs on the left, .nav-controls on the right)
        2. .vue-filtered-search-bar-container...row-content-block
                                [data-qa-selector="issuable_search_container"]
        3. aside.issues-bulk-update.right-sidebar.right-sidebar-collapsed  (bulk-edit panel)
        4. ul.content-list.issuable-list.issues-list
        5. .gl-text-center.gl-mt-6.gl-relative   (pagination + page-size dropdown)
```

`#content-body` on this page has `itemscope itemtype="http://schema.org/SoftwareSourceCode"`.

### 13.3 `.top-area` — tabs + action buttons

**Tabs** — `div.tabs.gl-tabs...issuable-state-filters` › `ul.nav.gl-tabs-nav` › `li.nav-item` ›
`a.nav-link.gl-tab-nav-item` (active one adds `.active.gl-tab-nav-item-active`, `aria-selected="true"`).
Each tab is `<span title="…" data-qa-selector="…">Label</span>` plus
`<span class="badge gl-tab-counter-badge badge-muted badge-pill gl-badge sm">count</span>`.

| Label | `title=` tooltip | `data-qa-selector` | `?state=` |
|---|---|---|---|
| `Open` | `Filter by issues that are currently opened.` | `opened_issuables_tab` | `opened` (default; omitted on a bare URL) |
| `Closed` | `Filter by issues that are currently closed.` | `closed_issuables_tab` | `closed` |
| `All` | `Show all issues.` | `all_issuables_tab` | `all` |

The `<a>`s are `href="#"`; the click is handled in JS and **does** rewrite the URL, e.g. clicking
`Closed` from `/a11yproject/a11yproject.com/-/issues` yields
`/a11yproject/a11yproject.com/-/issues/?sort=created_date&state=closed&first_page_size=20`
(the current sort and page size are always echoed back into the URL).

Observed counts (Open / Closed / All) — seed data, all verbatim:

| Project | Open | Closed | All |
|---|---|---|---|
| `a11yproject/a11yproject.com` | 40 | 570 | 610 |
| `a11yproject/a11yproject.com` `?label_name[]=bug` | 3 | 64 | 67 |
| `a11yproject/a11yproject.com` `?label_name[]=help wanted` | 8 | 25 | 33 |
| `root/metaseq` | 95 | 157 | 252 |
| `root/metaseq` `?label_name[]=None` | 5 | 7 | 12 |
| `root/metaseq` `?label_name[]=enhancement` | 29 | 38 | 67 |
| `root/metaseq` `?label_name[]=question` (+search) | 8 | 34 | 42 |
| `primer/design` | 21 | 35 | 56 |
| `primer/design` `?label_name[]=type: bug 🐞` | 2 | 1 | 3 |
| `vinta/awesome-python` | 13 | 498 | 511 |
| `umano/AndroidSlidingUpPanel` `?not[label_name][]=BUG` | 263 | 531 | 794 |
| `kkroening/ffmpeg-python` `?label_name[]=question` | 9 | 31 | 40 |
| `keycloak/keycloak` `?label_name[]=flaky-test` | 16 | 41 | 57 |
| `OpenAPITools/openapi-generator` `?label_name[]=OpenAPI Generator CLI` | 4 | 10 | 14 |
| `0ang3el/aem-hacker` | 12 | 2 | 14 |

**`.nav-controls`** (right side of `.top-area`). Contents depend on permission:

| Order | Element | Exact attributes | Shown when |
|---|---|---|---|
| 1 | RSS icon button | `<a class="btn btn-default btn-md gl-button btn-icon" title="Subscribe to RSS feed" aria-label="Subscribe to RSS feed" href="/<ns>/<proj>/-/issues.atom?feed_token=TMN_bBn9Z48qVbUFZV45">` | always (signed in) |
| 2 | Calendar icon button | `title="Subscribe to calendar" aria-label="Subscribe to calendar" href="/<ns>/<proj>/-/issues.ics?due_date=next_month_and_previous_two_weeks&feed_token=TMN_bBn9Z48qVbUFZV45&sort=closest_future_date"` | always |
| 3 | Export icon button | `<button aria-label="Export as CSV" data-qa-selector="export_as_csv_button" class="btn btn-default btn-md gl-button btn-icon">` (no `title`) | always |
| 4 | Import split-dropdown | `<div class="dropdown … gl-dropdown …" data-qa-selector="import_issues_dropdown">` toggle has `<span class="gl-dropdown-button-text gl-sr-only">Import issues</span>`; menu items `Import CSV` (button) and `Import from Jira` (`<a data-qa-selector="import_from_jira_link" href="/<ns>/<proj>/-/import/jira">`) | only if user can admin issues (a11yproject, primer, byteblaze projects). Absent on `root/metaseq`, `vinta/awesome-python`, `0ang3el/aem-hacker`, `keycloak/keycloak`, `kkroening/ffmpeg-python`, `umano/…`, `OpenAPITools/…` |
| 5 | `Edit issues` | `<button class="btn btn-default btn-md gl-button"><span class="gl-button-text">Edit issues</span></button>` | same permission gate as (4) |
| 6 | `New issue` | `<a class="btn btn-confirm btn-md gl-button" href="/<ns>/<proj>/-/issues/new"><span class="gl-button-text">New issue</span></a>` | always |

Note the RSS/ICS hrefs echo the current filter, e.g. on
`/primer/design/-/issues/?sort=updated_desc&state=opened&first_page_size=20`:
`/primer/design/-/issues.atom?feed_token=TMN_bBn9Z48qVbUFZV45&first_page_size=20&sort=updated_desc&state=opened`.
`feed_token=TMN_bBn9Z48qVbUFZV45` is a real anchor value (webarena-259, exact_match answer).

Also present on the projects that have zero issues (empty state) but **not** in `.nav-controls`:
the Import dropdown there renders with a visible label `Import issues` (not sr-only).

### 13.4 Filtered-search bar

Wrapper: `<div class="vue-filtered-search-bar-container gl-md-display-flex gl-flex-grow-1 gl-border-t-none row-content-block" data-qa-selector="issuable_search_container">`.

Left group `<div role="group" class="input-group gl-search-box-by-click flex-grow-1" data-testid="filtered-search-input">`:

1. **History dropdown** (`.gl-search-box-by-click-history`): toggle has `<span class="gl-sr-only">Toggle history</span>`.
   Menu content: header `Recent searches` with a `title="Close" aria-label="Close"` X button, a divider,
   then `You don't have any recent searches`.
2. **Token strip** `.gl-filtered-search-scrollable`. When empty it holds a single
   `<div data-testid="filtered-search-term" class="gl-h-auto gl-filtered-search-term gl-filtered-search-item gl-filtered-search-last-item">`
   containing
   `<input placeholder="Search or filter results..." aria-label="Search or filter results..." data-testid="filtered-search-term-input" class="gl-filtered-search-term-input">`
   (three literal dots, **not** an ellipsis character).
3. **Search button** `<button aria-label="Search" data-testid="search-button" class="btn gl-search-box-by-click-search-button …">`.

**Token suggestion list offered on focus** (verified live, `ul.dropdown-menu.gl-filtered-search-suggestion-list`,
items `li.gl-dropdown-item.gl-filtered-search-suggestion > a[data-testid="filtered-search-suggestion"]`),
exactly 9 entries in this order:

`Assignee`, `Author`, `Confidential`, `Label`, `Milestone`, `My-Reaction`, `Release`, `Search Within`, `Type`

(There is **no** Epic / Iteration / Weight token — those are EE-only and this is CE 15.7.5.)

**Applied token DOM** (`[data-testid="filtered-search-token"]`, three
`[data-testid="filtered-search-token-segment"]` children):

```html
<div data-testid="filtered-search-token" class="gl-filtered-search-token gl-filtered-search-item gl-filtered-search-token-hover">
  <div data-testid="filtered-search-token-segment" class="gl-filtered-search-token-segment">
    <span class="gl-filtered-search-token-type gl-token gl-token-default-variant gl-token-view-only gl-cursor-pointer">
      <span class="gl-token-content">Label</span></span></div>
  <div data-testid="filtered-search-token-segment" class="gl-filtered-search-token-segment">
    <span class="gl-filtered-search-token-operator gl-token gl-token-search-value-variant gl-token-view-only gl-cursor-pointer">
      <span class="gl-token-content">=</span></span></div>
  <div data-testid="filtered-search-token-segment" class="gl-filtered-search-token-segment">
    <span class="gl-token gl-token-search-value-variant gl-filtered-search-token-data gl-cursor-pointer"
          style="background-color: rgb(225, 29, 33); color: rgb(255, 255, 255);">
      <span class="gl-token-content">~bug <button aria-label="Close" class="btn gl-token-close …"></button></span>
    </span></div>
</div>
```

- Operators rendered verbatim: `=` and `!=` (there is no other operator in the UI).
- A Label value is prefixed with `~` (`~bug`, `~help wanted`, `~None`, `~BUG`, `~question`,
  `~type: bug 🐞`, `~OpenAPI Generator CLI`, `~flaky-test`, `~enhancement`).
  A Milestone value is prefixed with `%` (`%Content Updates for 2019`, `%None`).
  Assignee/Author values are the **display name** (`Byte Blaze`), not the handle.
- The label token's chip is coloured with the label's own colour
  (`background-color`, and `color` = `#FFFFFF` for dark labels / `#333333` for light labels).
- Free-text search terms become one `[data-testid="filtered-search-term"]` per whitespace-delimited
  word — e.g. `?search=OPT model` renders two term chips, `OPT` and `model`.

**URL parameters produced** (all verified live against `/a11yproject/a11yproject.com/-/issues/`):

| Param | Token rendered | Example |
|---|---|---|
| `state` | tab selection | `state=opened` / `state=closed` / `state=all` |
| `label_name[]` (URL-encoded `label_name%5B%5D`) | `Label = ~<name>` | `?label_name%5B%5D=bug` (ANCHOR, webarena-339) |
| repeated `label_name[]` | one token per label | `?label_name[]=bug&label_name[]=post` |
| `not[label_name][]` (`not%5Blabel_name%5D%5B%5D`) | `Label != ~<name>` | `?state=opened&not%5Blabel_name%5D%5B%5D=BUG` (ANCHOR, webarena-106) |
| `assignee_username` | `Assignee = <Display Name>` | `?assignee_username=byteblaze` → token `Assignee = Byte Blaze`; `?assignee_username=None` → `Assignee = None` |
| `author_username` | `Author = <Display Name>` | `?author_username=byteblaze` → `Author = Byte Blaze` |
| `milestone_title` | `Milestone = %<title>` | `?milestone_title=Content%20Updates%20for%202019` |
| `my_reaction_emoji` | `My-Reaction = <emoji name>` | `?my_reaction_emoji=thumbsup` |
| `confidential` | `Confidential = Yes` | `?confidential=yes` |
| `search` | free-text chips | `?search=OPT%20model` |
| `in` | `Search Within = Titles` | `?search=post&in=TITLE` |
| `type[]` (`type%5B%5D`) | `Type = issue` | `?type%5B%5D=issue` |
| `sort` | sort dropdown label | see §13.5 |
| `first_page_size` / `last_page_size` | page size dropdown | `first_page_size=20` (default), `50`, `100` |
| `page_after` / `page_before` | keyset pagination cursor (base64 JSON) | `page_after=eyJkdWVfZGF0ZSI6bnVsbCwiaWQiOiI4MzYyNyJ9` |

### 13.5 Sort dropdown + direction toggle

`<div role="group" class="sort-dropdown-container d-flex btn-group">` contains
(a) a `gl-dropdown` whose toggle text is `<span class="gl-dropdown-button-text">Created date</span>`
and (b) an icon-only direction button.

Menu items are `li.gl-dropdown-item > button.dropdown-item > … > p.gl-dropdown-item-text-primary`.
**Exactly ten options, in this order**, with the `?sort=` value each produces
(verified by clicking each one live):

| # | Label (verbatim) | resulting `?sort=` |
|---|---|---|
| 1 | `Priority` | `priority_desc` |
| 2 | `Created date` | `created_date` |
| 3 | `Updated date` | `updated_desc` |
| 4 | `Closed date` | `closed_at_desc` |
| 5 | `Milestone due date` | `milestone_due_desc` |
| 6 | `Due date` | `due_date_desc` |
| 7 | `Popularity` | `popularity` |
| 8 | `Label priority` | `label_priority_desc` |
| 9 | `Manual` | `relative_position` |
| 10 | `Title` | `title_asc` |

Selecting an option navigates to
`…/-/issues/?sort=<value>&state=opened&first_page_size=20`.
The ascending twins (`created_asc`, `updated_asc`, `due_date_asc`, `priority_asc`,
`label_priority_asc`, `closed_at_asc`, `milestone_due_asc`, `title_desc`) are produced by the
**direction toggle**, not by the menu. `?sort=created_asc` and `?sort=created_date`
both display the label `Created date`.

Direction toggle: `<button title="Sort direction: Ascending" aria-label="Sort direction: Ascending" class="btn flex-shrink-1 btn-default btn-md gl-button btn-icon">` — the title states the **current** direction
(`Sort direction: Ascending` / `Sort direction: Descending`) and clicking it flips the sort suffix.

Anchors: `?sort=created_date&state=opened` (webarena-45, ANCHOR),
`?sort=updated_desc&state=opened&first_page_size=20` (webarena-46, ANCHOR),
`?search=OPT%20model&sort=created_asc&state=opened&label_name%5B%5D=question&first_page_size=20`
(webarena-342, ANCHOR).

> ⚠️ The sort choice is a **server-side per-user preference**. A bare
> `/-/issues` inherits whatever sort the user last used. The recon captures were taken while the
> preference happened to be `created_asc`, which is why
> `assets/html/proj-a11yproject-issues.html` and `issues-label-bug.html` list rows
> oldest-first while `issues-sort-created.html` (explicit `?sort=created_date`) lists newest-first.
> GitLab's factory default — and the live instance's current state — is `created_date`
> (newest first). **For the mock, default to `sort=created_date` descending** and treat the
> unparameterised page as identical to `?sort=created_date&state=opened`.

### 13.6 List row anatomy

`ul.content-list.issuable-list.issues-list` › one `li` per issue:

```html
<li id="issuable_83092" data-labels="[1768,1769]" data-qa-issue-id="83092"
    class="issue gl-display-flex! gl-px-5!"
    data-qa-selector="issuable_container"
    data-qa-issuable-title="List of Post Ideas">
```

| Field | Selector / markup | Exact copy & format |
|---|---|---|
| bulk-edit checkbox | `div.gl-form-checkbox.issue-check.gl-mr-0.custom-control.custom-checkbox > input.custom-control-input[data-id][data-iid][data-type="ISSUE"]` + `label.custom-control-label > span.gl-sr-only` = the issue title | **only rendered while "Edit issues" mode is on** |
| title wrapper | `div[data-testid="issuable-title"].issue-title.title` | — |
| title link | `a[data-qa-selector="issuable_title_link"].gl-link.issue-title-text[dir="auto"]` | text = issue title. `href` is emitted **absolute** by the Vue list (`http://10.186.197.203:8023/<ns>/<proj>/-/issues/<iid>`); the mock should use the relative `/<ns>/<proj>/-/issues/<iid>` |
| task/checklist counter | `span[data-testid="task-status"].task-status.gl-display-none.gl-sm-display-inline-block!.gl-ml-3` | `37 of 52 checklist items completed`, `0 of 4 checklist items completed`, `3 of 3 checklist items completed`. Omitted when the description has no task list |
| meta line wrapper | `div.issuable-info` | starts with an issue-type icon `<span><svg/><span class="gl-sr-only">Issue</span></span>` |
| reference | `span[data-testid="issuable-reference"].issuable-reference` | `#12`, `#1533` … |
| separator | `<span aria-hidden="true">·</span>` inside `span.gl-display-none.gl-sm-display-inline` | `·` |
| authored line | `span.issuable-authored.gl-mr-3` | literal text **`created `** then the time then **` by `** then the author link. **The word is `created`, NOT `opened`.** Rendered: `created 13 years ago by Administrator` |
| created-at time | `span[data-testid="issuable-created-at"][title="…"]` | body `13 years ago` / `8 years ago` / `3 years ago`; `title` = `Jan 13, 2013 1:48pm PST` (`MMM D, YYYY h:mma TZ`, TZ is `PST`/`PDT`). It is a `<span>`, **not** a `<time>` — no `datetime` attribute on the list page |
| author | `a[data-testid="issuable-author"].gl-link.author-link.js-user-link` with `data-user-id`, `data-username`, `data-name`, `data-avatar-url`; inner `<span class="author">Byte Blaze</span>` | display name |
| milestone chip | `span[data-testid="issuable-milestone"].issuable-milestone.gl-mr-3 > a.gl-link[title="…"][href="/<ns>/<proj>/-/milestones/<id>"]` with a clock icon | text `Content Updates for 2019`; `title="Dec 31, 2019 (Past due)"` |
| labels group | `<span role="group" aria-label="Labels">` then one chip each | see below |
| label chip | `span.gl-label.gl-label-sm.gl-label-text-dark` (or `.gl-label-text-light`), 2nd+ chips add `.gl-ml-2`; inline style `--label-background-color: #d4c5f9; --label-inset-border: inset 0 0 0 1px #d4c5f9;`; inside `a.gl-link.gl-label-link[href="?label_name[]=<urlencoded>"]` › `span.gl-label-text` | e.g. `help wanted` (#e11d21, light text), `idea`/`enhancement`/`question` (#d4c5f9), `article audit`/`redesign`/`content` (#ffce29), `good first issue`/`post`/`checklist` (#e2fed2), `claimed` (#3b4bbf, light text), `accessibility` (#e11d21), `design` (#ffce29), `bug`, `javascript`, `styling`, `eleventy`, `gulp`, `node`, `feature` |
| right column | `div.issuable-meta > ul.controls` | — |
| status | `li.issuable-status` | empty on the Open tab; contains the literal text `CLOSED` on the Closed/All tabs |
| assignee stack | `li > div.gl-align-items-center.gl-display-flex.gl-ml-3 > a.gl-link.gl-avatar-link.user-avatar-link.js-no-trigger.author-link[data-qa-selector="assignee_link"] > span > img.gl-avatar.gl-avatar-circle.gl-avatar-s16.gl-mr-2!` | `alt="Assigned to Byte Blaze"`. The whole `<li>` is omitted when unassigned |
| upvote/downvote/blocked slot | `<ul class="gl-display-contents">` with three empty slots | in this seed data **no** row has upvotes/downvotes, so the slots render as `<!---->`. When present GitLab uses `li[data-testid="issuable-upvotes"]` / `li[data-testid="issuable-downvotes"]` |
| comment bubble | `li[data-testid="issuable-comments"].gl-display-none.gl-sm-display-block > a.gl-link.gl-reset-color![title="Comments"][href=".../-/issues/<iid>#notes"]` with a comment icon then the count | `61`, `24`, `3`, `0` … |
| updated timestamp | `div[data-testid="issuable-timestamp"].gl-text-gray-500.gl-display-none.gl-sm-display-inline-block[title="…"]` | body `updated 3 years ago`; `title="Mar 23, 2023 1:36am PDT"` |

Note the real `data-testid` values differ from what one might guess: it is
`data-qa-selector="issuable_title_link"` (not `data-testid="issuable-title-link"`); the *wrapper*
carries `data-testid="issuable-title"`.

### 13.7 Bulk edit ("Edit issues")

Clicking `Edit issues` (read-only inspection only — never press `Update all`):

- `aside.issues-bulk-update.right-sidebar` flips `right-sidebar-collapsed` → `right-sidebar-expanded`
  and slides in from the right (measured 349 px wide, top 48).
- A **"Select all"** checkbox appears in the search-bar row:
  `div.gl-form-checkbox.gl-align-self-center.custom-control.custom-checkbox > input#… + label > span.gl-sr-only` = `Select all`.
- Every row gains its `.issue-check` checkbox (see §13.6).
- The panel is `<form class="bulk-update" action="/<ns>/<proj>/-/issues/bulk_update" method="post">`
  with a hidden `authenticity_token`. Rendered innerText, verbatim and in order:

```
Update all
Cancel
Status
Select status
Assignee
Select assignee
Labels
Select labels
Milestone
Select milestone
Subscriptions
Select subscription
Move selected
```

| Block | Markup |
|---|---|
| header | `.block.issuable-sidebar-header` › `.filter-item.inline.update-issues-btn.float-left > button[type=submit][disabled].gl-button.btn.btn-md.btn-confirm.js-update-selected-issues` = `Update all`; `button.gl-button.btn.btn-md.btn-default.js-bulk-update-menu-hide.float-right` = `Cancel` |
| Status | `.block > .title` = `Status`; dropdown `title="Change status"`, toggle text `Select status`, items `Open` (`title="Open"`) and `Closed` (`title="Closed"`); hidden `input[name="update[state_event]"]` |
| Assignee | `.block > .title` = `Assignee`; `button.dropdown-menu-toggle.js-user-search.js-update-assignee…[data-field-name="update[assignee_ids][]"]` with `<span class="dropdown-toggle-text">Select assignee</span>`; menu title `Assign to`, search input `placeholder="Search authors"` |
| Labels | `.block > .title` = `Labels`; `.filter-item.labels-filter` › `button.js-label-select.js-multiselect[data-default-label="Labels"][data-field-name="update[label_ids][]"][data-qa-selector="issuable_label_dropdown"]` with text `Select labels`; menu title `Apply a label`, search `placeholder="Search"` |
| Milestone | `.block > .title` = `Milestone`; `.js-milestone-dropdown-root[data-full-path][data-workspace-type="project"]` → toggle `Select milestone` |
| Subscriptions | `.block > .title` = `Subscriptions`; `.js-subscriptions-dropdown` → toggle `Select subscription` |
| Move | `.block > .js-move-issues[data-project-full-path][data-projects-fetch-path="/-/autocomplete/projects?project_id=<id>"]` → button `Move selected` |
| hidden | `input#update_issuable_ids[name="update[issuable_ids]"]`, `input#state_event[name="state_event"]` |

The same `<aside>`/`<form>` markup is present (with `.issuable-sidebar.hidden`) even on the
empty-state pages.

### 13.8 Pagination

Last child of `.issuable-list-container`:
`<div class="gl-text-center gl-mt-6 gl-relative">`.

- Keyset pager `<div role="group" class="gl-keyset-pagination btn-group">` with exactly two buttons —
  **no numbered pages**:
  - `<button data-testid="prevButton" disabled class="btn btn-default btn-md disabled gl-button">` → `← Prev`
    (icon then the word `Prev`, inside `span.gl-button-text > div.gl-display-flex.gl-align-center`)
  - `<button data-testid="nextButton" class="btn btn-default btn-md gl-button">` → `Next →`
- Clicking `Next` pushes
  `?sort=<sort>&state=<state>&first_page_size=20&page_after=<base64>`;
  `Prev` pushes `?…&last_page_size=20&page_before=<base64>`.
  The cursor is base64 of a JSON object, e.g. `{"due_date":null,"id":"83627"}`.
- Page-size dropdown, absolutely positioned right (`div.dropdown.gl-dropdown.gl-absolute.gl-right-0`):
  toggle text `Show 20 items`; menu items `Show 20 items`, `Show 50 items`, `Show 100 items`
  (each wrapped in `<span class="gl-white-space-nowrap">`). Selecting one yields
  `?…&first_page_size=50`. **Default page size = 20 rows.**
- The pager block is rendered even when the result set fits one page (both buttons then disabled/enabled accordingly).

### 13.9 Relative-time format summary (list page)

| Where | Body text | `title=` tooltip | element |
|---|---|---|---|
| created | `13 years ago`, `8 years ago`, `7 years ago`, `6 years ago`, `5 years ago`, `4 years ago`, `3 years ago` | `Jan 13, 2013 1:48pm PST` / `Mar 22, 2023 10:48am PDT` | `span[data-testid="issuable-created-at"]` |
| updated | `updated 3 years ago` | `Mar 23, 2023 1:36am PDT` | `div[data-testid="issuable-timestamp"]` |
| milestone chip | `Content Updates for 2019` | `Dec 31, 2019 (Past due)` | `a` inside `span[data-testid="issuable-milestone"]` |

The instance clock is **2026**, which is why 2023 records read `3 years ago` and a 2013 record reads
`13 years ago`. Reproduce the *rendered strings* rather than recomputing from `Date.now()`.

---

## 13b. `/-/issues` — filtered / sorted / label variants and the empty state

### 13b.1 Anchor URLs that must resolve and render

| URL | Task | What must render |
|---|---|---|
| `/a11yproject/a11yproject.com/-/issues/?label_name%5B%5D=bug` | webarena-339 (ANCHOR) | token `Label = ~bug`, tabs `Open 3 / Closed 64 / All 67`, 3 rows |
| `/a11yproject/a11yproject.com/-/issues/?label_name%5B%5D=help%20wanted` | webarena-102 (ANCHOR) | token `Label = ~help wanted`, tabs `8 / 25 / 33`, 8 rows |
| `/a11yproject/a11yproject.com/-/issues/?sort=created_date&state=opened` | webarena-45 (ANCHOR) | sort label `Created date`, direction `Sort direction: Descending`, newest first |
| `/a11yproject/a11yproject.com/-/issues` | webarena-658, 809 (ANCHOR) | plain open list |
| `/primer/design/-/issues/?label_name%5B%5D=type%3A%20bug%20%F0%9F%90%9E` | webarena-340 (ANCHOR) | token `Label = ~type: bug 🐞`, tabs `2 / 1 / 3` |
| `/primer/design/-/issues/?sort=updated_desc&state=opened&first_page_size=20` | webarena-46 (ANCHOR) | sort label `Updated date`, tabs `21 / 35 / 56` |
| `/root/metaseq/-/issues/?label_name%5B%5D=None` | webarena-343 (ANCHOR) | token `Label = ~None`, tabs `5 / 7 / 12`, 5 rows, **no label chips on any row** |
| `/root/metaseq/-/issues/?label_name%5B%5D=enhancement` | webarena-341 (ANCHOR) | token `Label = ~enhancement`, tabs `29 / 38 / 67` |
| `/root/metaseq/-/issues/?search=OPT%20model&sort=created_asc&state=opened&label_name%5B%5D=question&first_page_size=20` | webarena-342 (ANCHOR) | token `Label = ~question` + free-text chips `OPT` and `model`, sort `Created date` / `Sort direction: Ascending`, tabs `8 / 34 / 42`, 8 rows |
| `/umano/AndroidSlidingUpPanel/-/issues/?state=opened&not%5Blabel_name%5D%5B%5D=BUG` | webarena-106 (ANCHOR) | token `Label != ~BUG`, tabs `263 / 531 / 794` |
| `/kkroening/ffmpeg-python/-/issues/?label_name%5B%5D=question` | webarena-103 (ANCHOR) | token `Label = ~question`, tabs `9 / 31 / 40`, 9 rows |
| `/keycloak/keycloak/-/issues/?label_name%5B%5D=flaky-test` | webarena-104 (ANCHOR) | token `Label = ~flaky-test`, tabs `16 / 41 / 57`, 16 rows |
| `/OpenAPITools/openapi-generator/-/issues/?label_name%5B%5D=OpenAPI%20Generator%20CLI` | webarena-105 (ANCHOR) | token `Label = ~OpenAPI Generator CLI`, tabs `4 / 10 / 14`, 4 rows |
| `/0ang3el/aem-hacker/-/issues` | webarena-662 (ANCHOR) | tabs `12 / 2 / 14` |
| `/convexegg/chatgpt/-/issues` | webarena-661 (ANCHOR) | **empty state** (project has zero issues) |
| `/vinta/awesome-python/-/issues` | webarena-664 (ANCHOR) | tabs `13 / 498 / 511` |
| `/root/metaseq/-/issues` | webarena-663 (ANCHOR) | tabs `95 / 157 / 252` |
| `/byteblaze/dotfiles/-/issues` | webarena-670 (ANCHOR) | **empty state** |
| `/byteblaze/empathy-prompts/-/issues` | webarena-659 (ANCHOR) | list |
| `/byteblaze/a11y-syntax-highlighting/-/issues` | webarena-665 (ANCHOR) | list |
| `/byteblaze/cloud-to-butt/-/issues` | webarena-808 (ANCHOR) | list |
| `/byteblaze/solarized-prism-theme/-/issues` | webarena-669 (ANCHOR) | list |

### 13b.2 Exact rows of the small anchor result sets

Format: `#iid | title | author | created | labels | comments | updated`

**`/a11yproject/a11yproject.com/-/issues/?label_name[]=bug`** (3 rows, ascending in the capture):
```
#1408 | In error state, focused controls take on purple or red-and-purple focus indicator | EJ Mason      | 4 years ago | bug, claimed, design                     | 0 | updated 3 years ago
#1419 | Investigate if <details>/<summary> is a good choice for our Checklist              | Byte Blaze    | 4 years ago | bug, help wanted                         | 0 | updated 4 years ago
#1478 | [Bug]  404s, bad host, timeouts, bad urls for URLs linked from website             | Roshan Jossy  | 3 years ago | bug, content, good first issue, help wanted | 6 | updated 3 years ago
```
(`[Bug]  404s, …` has **two spaces** after `[Bug]`. The string
`404s, bad host, timeouts, bad urls for URLs linked from website` is an ANCHOR, webarena-446/811.)

**`/a11yproject/a11yproject.com/-/issues/?label_name[]=help wanted`** (8 rows):
```
#1521 | [Feature] Add a broken link checker to the CI/CD pipeline | Philip Wong  | 3 years ago  | feature, help wanted | 0 | updated 3 years ago
#1478 | [Bug]  404s, bad host, timeouts, bad urls for URLs linked from website | Roshan Jossy | 3 years ago | bug, content, good first issue, help wanted | 6 | updated 3 years ago
#1419 | Investigate if <details>/<summary> is a good choice for our Checklist | Byte Blaze | 4 years ago | bug, help wanted | 0 | updated 4 years ago
#1064 | Create an Offline page | Byte Blaze | 5 years ago | claimed, design, feature, help wanted, javascript | 6 | updated 3 years ago
#940  | Add functionality to expand/collapse sections of the checklist, or the entire checklist page | Byte Blaze | 6 years ago | enhancement, good first issue, help wanted, javascript, styling | 6 | updated 5 years ago
#937  | Set up environment variables | Byte Blaze | 6 years ago | claimed, eleventy, help wanted, redesign | 5 | updated 3 years ago
#934  | Audit redesign spacing sizes and turn them into variables | Byte Blaze | 6 years ago | claimed, good first issue, help wanted, redesign, styling | 6 | updated 3 years ago
#12   | List of Post Ideas | Administrator | 13 years ago | help wanted, idea | 61 | updated 3 years ago
```

**`/root/metaseq/-/issues/?label_name[]=None`** (5 rows, no labels):
```
#596 | Fine-tune and collect data for fine-tuning OPT models | Administrator | 3 years ago | — | 0 | updated 3 years ago
#470 | Data processing details in pretraining                | Administrator | 3 years ago | — | 1 | updated 3 years ago
#319 | Host logbooks outside of Github                       | Administrator | 3 years ago | — | 2 | updated 3 years ago
#238 | Release Planning                                      | Administrator | 4 years ago | — | 0 | updated 3 years ago
#13  | Validate args to prevent RuntimeError: attn_batches % batches_per_block == 0 | Administrator | 4 years ago | — | 1 | updated 4 years ago
```

**`/root/metaseq/-/issues/?search=OPT model&sort=created_asc&state=opened&label_name[]=question&first_page_size=20`** (8 rows):
```
#7   | Figure out potential duplication in ConfigStore | Administrator | 4 years ago | better-eng, cleanup, config, question | 1 | updated 3 years ago
#89  | assert key_padding_mask.size(1) == src_len in 350M model | Administrator | 4 years ago | question | 0 | updated 4 years ago
#131 | DGX 2 with 16 V100 | Administrator | 4 years ago | question | 21 | updated 3 years ago
#146 | Running OPT 175B with different hardware configurations | Administrator | 4 years ago | question | 21 | updated 3 years ago
#211 | How to load pretrained weight in finetuning? | Administrator | 4 years ago | question | 2 | updated 4 years ago
#407 | `convert_to_singleton` seems to hang for OPT-66B | Administrator | 3 years ago | question | 38 | updated 3 years ago
#526 | How to prevent duplicate output? Repeated sentences? I want to generate longer texts | Administrator | 3 years ago | question | 0 | updated 3 years ago
#614 | Import a Megatron-LM or HuggingFace OPT/GPT2 model file(s) | Administrator | 3 years ago | question | 0 | updated 3 years ago
```

**`/OpenAPITools/openapi-generator/-/issues/?label_name[]=OpenAPI Generator CLI`** (4 rows):
```
#1811 | [REQ] Provide templating authoring details in config-help or generate CLI command (or subcommands of generate) | Jim Schubert  | 7 years ago | Enhancement: Feature, OpenAPI Generator CLI | 0 | updated 6 years ago
#214  | [cli] Add bash completion script, and install with Homebrew | Jim Schubert  | 8 years ago | Enhancement: Feature, OpenAPI Generator CLI | 0 | updated 8 years ago
#137  | Replace '--generator-name' with multiple switches to select a generator | Administrator | 8 years ago | General: Suggestion, OpenAPI Generator CLI, OpenAPI Generator Maven Plugin | 0 | updated 7 years ago
#94   | Users should be able to query configurable vendor extensions via CLI | Jim Schubert | 8 years ago | Enhancement: Feature, OpenAPI Generator CLI | 0 | updated 8 years ago
```

**`/primer/design/-/issues/?label_name[]=type: bug 🐞`** (2 rows):
```
#33  | Path alias doesn't work        | Administrator   | 7 years ago | type: bug 🐞                                  | 0 | updated 3 years ago
#316 | Clarify usage of flash alert   | Lukas Oppermann | 3 years ago | area: documentation, effort: low, type: bug 🐞 | 0 | updated 3 years ago
```
(`Clarify usage of flash alert` is an ANCHOR string, webarena-804/810.)

**`/kkroening/ffmpeg-python/-/issues/?label_name[]=question`** (9 rows):
```
#218 | Can't pass value-less options?                          | Administrator | 7 years ago | answered, enhancement, question | 3 | updated 3 years ago
#217 | How to replace a keyframe with another image            | Administrator | 7 years ago | question | 4 | updated 7 years ago
#205 | Size of 1080p frame too large                           | Administrator | 7 years ago | question | 2 | updated 7 years ago
#202 | Add example: "split_silence_video"                      | Administrator | 7 years ago | question | 1 | updated 7 years ago
#185 | get ffmpeg command                                      | Administrator | 7 years ago | question | 1 | updated 7 years ago
#184 | How to cut (`trim`) video and audio with timestamps     | Administrator | 7 years ago | question | 9 | updated 3 years ago
#166 | Library problem under python 2.7                        | Administrator | 7 years ago | question | 6 | updated 5 years ago
#156 | Memory file -> numpy -> memory file                     | Administrator | 7 years ago | question | 5 | updated 3 years ago
#137 | Support for concat 'demuxer' instead of concat filter?  | Administrator | 7 years ago | question | 0 | updated 3 years ago
```

**`/keycloak/keycloak/-/issues/?label_name[]=flaky-test`** (16 rows; all titled
`Flaky test: org.keycloak.testsuite.…`, all `0` comments, all `updated 3 years ago`):
```
#17613 Flaky test: org.keycloak.testsuite.ui.account2.SmokeTest#baseFunctionalityTest                | Michal Hajas  | area/ci, flaky-test, kind/bug, team/continuous-testing
#17448 Flaky test: org.keycloak.testsuite.ui.account2.SigningInTest#updatePasswordTest               | Administrator | area/ci, flaky-test, kind/bug, team/continuous-testing
#17431 Flaky test: org.keycloak.testsuite.federation.sync.SyncFederationTest#test04IgnoredSync       | Administrator | area/ci, flaky-test, kind/bug, team/continuous-testing
#17430 Flaky test: org.keycloak.testsuite.federation.sync.SyncFederationTest#test03ConcurrentSync    | Administrator | area/ci, flaky-test, kind/bug, team/continuous-testing
#17357 Flaky test: org.keycloak.testsuite.ui.account2.ApplicationsTest#navigationTest                | Administrator | area/ci, flaky-test, kind/bug, team/continuous-testing
#17282 Flaky test: org.keycloak.testsuite.webauthn.account.WebAuthnSigningInTest#availableAuthenticatorsAfterRemove | Administrator | area/ci, flaky-test, kind/bug, team/continuous-testing
#17072 Flaky test: org.keycloak.testsuite.model.UserSessionProviderOfflineTest#testOnClientRemoved   | Administrator | area/ci, flaky-test, kind/bug
#17071 Flaky test: org.keycloak.testsuite.model.UserSessionProviderTest#testRestartSession           | Administrator | area/ci, flaky-test, kind/bug
#16671 Flaky test: org.keycloak.testsuite.model.session.OfflineSessionPersistenceTest#testPersistenceMultipleNodesClientSessionsAtRandomNode | Administrator | area/ci, area/storage, flaky-test, kind/bug, team/store
#16571 Flaky test: org.keycloak.testsuite.model.session.OfflineSessionPersistenceTest#testPersistenceMultipleNodesClientSessionAtSameNode    | Administrator | area/ci, area/storage, flaky-test, kind/bug, team/store
#16570 Flaky test: org.keycloak.testsuite.model.session.OfflineSessionPersistenceTest#testLazyOfflineUserSessionFetching                     | Administrator | area/ci, area/storage, flaky-test, kind/bug, team/store
#16569 Flaky test: org.keycloak.testsuite.model.session.UserSessionInitializerTest#testUserSessionInitializerWithDeletingClient              | Administrator | area/ci, area/storage, flaky-test, kind/bug, team/store
#16565 Flaky test: org.keycloak.testsuite.model.session.UserSessionProviderOfflineModelTest#testOfflineSessionLazyLoading                    | Administrator | area/ci, area/storage, flaky-test, kind/bug, team/store
#16564 Flaky test: org.keycloak.testsuite.model.session.OfflineSessionPersistenceTest#testPersistenceClientSessionsMultipleNodes             | Administrator | area/infinispan, area/storage, flaky-test, kind/bug, team/store
#16521 Flaky test: org.keycloak.testsuite.admin.ComponentsTest#testConcurrencyWithChildren           | Administrator | area/storage, flaky-test, kind/bug, team/store
#16511 Flaky test: org.keycloak.testsuite.model.session.UserSessionProviderOfflineModelTest#testExpired | Administrator | area/ci, area/storage, flaky-test, kind/bug, team/store
```

**`/a11yproject/a11yproject.com/-/issues/?state=closed`** first rows (for the Closed tab, note the
`CLOSED` badge in `li.issuable-status`):
```
#1517 Deprecate GitHub Discussions                                   | Byte Blaze    | 3 years ago | administration    | CLOSED | 2 | updated 3 years ago
#1497 Deprecate our GitHub Projects content                          | Byte Blaze    | 3 years ago | administration    | CLOSED | 1 | updated 3 years ago
#1439 [Post] New post: On respecting preference for reduced motion   | Administrator | 4 years ago | claimed, post     | CLOSED | 2 | updated 3 years ago   (3 of 3 checklist items completed)
#1405 Post: A Beginner's Guide to ADA Web Compliance                 | Administrator | 4 years ago | claimed, post     | CLOSED | 6 | updated 3 years ago   (3 of 3 checklist items completed)
#1413 [Bug] Footer - Incorrect Year                                  | Administrator | 4 years ago | bug               | CLOSED | 2 | updated 3 years ago
#1407 Standardize our posts title case                               | Byte Blaze    | 4 years ago | content           | CLOSED | 1 | updated 3 years ago
```

### 13b.3 Empty state A — the project has **no issues at all**

Verified live at `/byteblaze/gimmiethat.space/-/issues`, `/byteblaze/dotfiles/-/issues`,
`/convexegg/chatgpt/-/issues`. In this state the whole `.top-area` (tabs + nav-controls),
the filtered-search bar, the sort dropdown and the pager are **all absent** —
`#content-body` contains only the empty-state section, the Jira footer and the (hidden) bulk-update aside.

```html
<section class="gl-display-flex empty-state gl-text-center gl-flex-direction-column">
  <div class="gl-max-w-full"><div class="svg-250 svg-content">
    <img src="/assets/illustrations/issues-b4cb30d5143b86be2f594c7a384296dfba0b25199db87382c3746b79dafd6161.svg"
         alt="" role="img" class="gl-max-w-full gl-dark-invert-keep-hue"></div></div>
  <div class="gl-max-w-full gl-m-auto"><div class="gl-mx-auto gl-my-0 gl-p-5">
    <h1 class="gl-font-size-h-display gl-line-height-36 h4">
      Use issues to collaborate on ideas, solve problems, and plan work
    </h1>
    <p class="gl-mt-3"><a href="/help/user/project/issues/index" class="gl-link">
      Learn more about issues.</a></p>
    <div class="gl-display-flex gl-flex-wrap gl-justify-content-center">
      <a href="/<ns>/<proj>/-/issues/new" class="btn btn-confirm btn-md gl-button">
        <span class="gl-button-text">New issue</span></a>
      <div class="gl-w-full gl-sm-w-auto gl-sm-mr-3"><div role="group" class="gl-w-full btn-group">
        <div class="dropdown … gl-dropdown …" data-qa-selector="import_issues_dropdown">
          <button …><span class="gl-dropdown-button-text">Import issues</span></button>
          <ul role="menu" class="dropdown-menu">
            … <p class="gl-dropdown-item-text-primary">Import CSV</p> …
            … <a data-qa-selector="import_from_jira_link" href="/<ns>/<proj>/-/import/jira">
                 <p class="gl-dropdown-item-text-primary">Import from Jira</p></a> …
          </ul></div></div></div>
    </div></div></div>
</section>
<hr>
<p class="gl-text-center gl-font-weight-bold gl-mb-0">Using Jira for issue tracking?</p>
<p class="gl-text-center gl-mb-0">
  <a href="http://localhost:8023/help/integration/jira/issues#view-jira-issues" class="gl-link">Enable the Jira integration</a>
  to view your Jira issues in GitLab.</p>
<p class="gl-text-center gl-text-secondary">This feature requires a Premium plan.</p>
```

Verbatim copy checklist:
- heading `Use issues to collaborate on ideas, solve problems, and plan work`
- link `Learn more about issues.` (trailing period included)
- primary CTA `New issue`
- secondary dropdown label `Import issues`, items `Import CSV`, `Import from Jira`
- footer `Using Jira for issue tracking?` / `Enable the Jira integration` + ` to view your Jira issues in GitLab.` / `This feature requires a Premium plan.`

> The brief's guess (`There are no open issues` / `To keep this project going, create a new issue`)
> does **not** appear anywhere in GitLab 15.7.5 — do not use it.

### 13b.4 Empty state B — filter matched nothing

Verified live at `/a11yproject/a11yproject.com/-/issues/?search=zzzqqqxyz&state=opened`.
Here the tabs, search bar and sort dropdown **are** still rendered; only the list is replaced:

```html
<section class="gl-display-flex empty-state gl-text-center gl-flex-direction-column">
  <div class="gl-max-w-full"><div class="svg-250 svg-content"><img src="/assets/illustrations/issues-….svg" alt="" role="img" class="gl-max-w-full gl-dark-invert-keep-hue"></div></div>
  <div class="gl-max-w-full gl-m-auto"><div class="gl-mx-auto gl-my-0 gl-p-5">
    <h1 class="gl-font-size-h-display gl-line-height-36 h4">Sorry, your filter produced no results</h1>
    <p class="gl-mt-3">To widen your search, change or remove filters above</p>
    <div class="gl-display-flex gl-flex-wrap gl-justify-content-center">
      <a href="/<ns>/<proj>/-/issues/new" class="btn btn-confirm btn-md gl-button">
        <span class="gl-button-text">New issue</span></a></div>
  </div></div>
</section>
```
Verbatim: `Sorry, your filter produced no results` /
`To widen your search, change or remove filters above` (no trailing period) / `New issue`.

---

## 14. Issue detail page (`/-/issues/:iid`)

### 14.1 Routes and `<title>`

`/:namespace/:project/-/issues/:iid`

`<title>` = `<issue title> (#<iid>) · Issues · <Group> / <project> · GitLab`

| URL | `<title>` |
|---|---|
| `/a11yproject/a11yproject.com/-/issues/719` (ANCHOR webarena-177, 182) | `Rethink the homepage's content (#719) · Issues · The A11Y Project / a11yproject.com · GitLab` |
| `/a11yproject/a11yproject.com/-/issues/566` (ANCHOR webarena-178) | `Better Event page UX (#566) · Issues · The A11Y Project / a11yproject.com · GitLab` |
| `/a11yproject/a11yproject.com/-/issues/1517` (ANCHOR webarena-179) | `Deprecate GitHub Discussions (#1517) · Issues · The A11Y Project / a11yproject.com · GitLab` |
| `/byteblaze/empathy-prompts/-/issues/18` (ANCHOR webarena-175, 180) | `Outdated dependencies (#18) · Issues · Byte Blaze / empathy-prompts · GitLab` |
| `/byteblaze/empathy-prompts/-/issues/8` (ANCHOR webarena-173) | `Better initial load experience (#8) · Issues · Byte Blaze / empathy-prompts · GitLab` |
| `/byteblaze/a11y-syntax-highlighting/-/issues/1` (ANCHOR webarena-176, 181) | `Tm Theme Editor (#1) · Issues · Byte Blaze / a11y-syntax-highlighting · GitLab` |
| `/byteblaze/a11y-webring.club/-/issues/71` (ANCHOR webarena-174) | `[Feature suggestion] Support linking to an accessibility statement (#71) · Issues · Byte Blaze / a11y-webring.club · GitLab` |
| `/0ang3el/aem-hacker/-/issues/28` | `OSError: [Errno 98] Address already in use (#28) · Issues · 0ang3el / aem-hacker · GitLab` |

Breadcrumb: `Byte Blaze` › `a11y-syntax-highlighting` › `Issues` › `#1`
(i.e. namespace display name, project path, `Issues`, `#<iid>`).

### 14.2 Box structure (measured live @1920×1080, left project sidebar expanded)

| Element | x | width |
|---|---|---|
| `.issuable-details` (main column) | **464** | **958** |
| `.detail-page-header` / `.detail-page-description` | 464 | 958 |
| `aside.right-sidebar.js-right-sidebar.js-issuable-sidebar.right-sidebar-expanded` | **1630** | **290** (top 48, full height) |
| same, `.right-sidebar-collapsed` | 1858 | **62** |

When the sidebar is collapsed the main column keeps its 958 px width but shifts right to x=578.

Main-column child order:
```
.issuable-details
  .detail-page-header
    .detail-page-header-body.gl-flex-wrap-wrap        (status badge, author line, gutter toggle)
    .detail-page-header-actions.gl-display-flex.gl-align-self-start   (buttons)
  .detail-page-description.content-block.js-detail-page-description.gl-pb-0.gl-border-none
      div > div > .title-container  ( h1[data-qa-selector="title_content"] + edit pencil )
                > div               ( edit-form mount, empty )
                > .description.js-task-list-container.is-task-list-enabled
                     > div.md[data-testid="gfm-content"]     ← the rendered markdown
                     > textarea.hidden.js-task-list-field[data-testid="textarea"]
      small.edited-text.js-issue-widgets    (only when the issue has been edited)
      .js-issue-widgets  →  .emoji-block.emoji-block-sticky  (award emoji + create-MR widget)
  .js-issue-widgets   (designs drop-zone, Tasks widget, Linked items widget)
  .js-issue-widgets   (#notes: Activity heading, #notes-list, comment form)
```

### 14.3 `.detail-page-header`

```html
<div class="detail-page-header">
  <div class="detail-page-header-body gl-flex-wrap-wrap">
    <!-- BOTH badges are always in the DOM; the inactive one carries class "hidden" -->
    <span class="gl-badge badge badge-pill badge-info md  issuable-status-badge gl-mr-3 issuable-status-badge-closed">
      <svg …/><div class="gl-display-none gl-sm-display-block gl-ml-2">Closed</div></span>
    <span class="gl-badge badge badge-pill badge-success md hidden issuable-status-badge gl-mr-3 issuable-status-badge-open">
      <svg …/><span class="gl-display-none gl-sm-display-block gl-ml-2">Open</span></span>
    <div class="gl-display-inline-block"><!-- confidential badge mount, empty here --></div>
    <span class="gl-mr-2" aria-hidden="true"><svg …/></span>
    <span class="gl-mr-2">Issue created
      <time class="js-timeago" title="Dec 30, 2018 11:42am PST" datetime="2018-12-30T19:42:28Z"
            data-toggle="tooltip" data-placement="top" data-container="body">7 years ago</time> by </span>
    <strong>
      <a class="author-link js-user-link d-none d-sm-inline" data-user-id="2330" data-username="byteblaze"
         data-name="Byte Blaze" href="/byteblaze">
        <img width="24" class="avatar avatar-inline s24 js-lazy-loaded" alt=""
             src="https://www.gravatar.com/avatar/…?s=48&d=identicon" loading="lazy"
             data-qa_selector="js_lazy_loaded_content">
        <span class="author">Byte Blaze</span></a>
      <a class="author-link js-user-link d-inline d-sm-none" …><span class="author">@byteblaze</span></a>
    </strong>
    <span class="user-access-role has-tooltip d-none d-xl-inline-block gl-ml-3"
          title="This user has the maintainer role in the a11yproject.com project.">Maintainer</span>
    <span class="has-tooltip gl-ml-2" title="1st contribution!"></span>
    <span id="task_status" class="d-none d-md-inline-block gl-ml-3"></span>
    <span id="task_status_short" class="d-md-none"></span>
    <a class="btn gl-button btn-default btn-icon float-right gl-display-block d-sm-none
              gutter-toggle issuable-gutter-toggle js-sidebar-toggle" href="#"><svg …/></a>
  </div>
  <div class="detail-page-header-actions gl-display-flex gl-align-self-start"> … </div>
</div>
```

Key facts:
- Status badge classes: **open** → `.gl-badge.badge.badge-pill.badge-success.md.issuable-status-badge.issuable-status-badge-open`, text `Open`;
  **closed** → `.gl-badge.badge.badge-pill.badge-info.md.issuable-status-badge.issuable-status-badge-closed`, text `Closed`.
  Each has a leading icon (issue-open / issue-close).
- The author sentence is exactly **`Issue created <relative> by <Name>`** — one line,
  `Issue created 7 years ago by Byte Blaze`. (Not "Created by …".)
- Access-role pill values seen: `Maintainer`, `Owner`, `Contributor` (title
  `This user has the <role> role in the <project> project.`).
- `<time class="js-timeago" title="Dec 30, 2018 11:42am PST" datetime="2018-12-30T19:42:28Z">7 years ago</time>` —
  note the header **does** use a real `<time>` with a `datetime` attribute (ISO 8601 Z), unlike the list rows.
- No `Confidential` badge exists in this seed data (the mount point `div.gl-display-inline-block` is empty);
  when set GitLab renders a `Confidential` badge there.

**Right-side action buttons** — permission-dependent, verified live:

| Context | Rendered |
|---|---|
| Open issue in a project you own (`/byteblaze/empathy-prompts/-/issues/18`) | `<button data-qa-selector="close_issue_button" class="btn gl-display-none gl-sm-display-inline-flex! btn-default btn-md gl-button">Close issue</button>` then the ⋮ dropdown `[data-qa-selector="issue_actions_ellipsis_dropdown"][data-testid="desktop-dropdown"][title="Issue actions"][aria-label="Issue actions"]` containing `New related issue` (`href="/<ns>/<proj>/-/issues/new?add_related_issue=<iid>"`) and `Delete issue` (`data-qa-selector="delete_issue_button"`) |
| Closed issue you can edit (`/a11yproject/…/-/issues/719`) | `<button data-qa-selector="reopen_issue_button" …>Reopen issue</button>` + ⋮ with `New related issue` only |
| Issue in a project you cannot edit (`/root/metaseq/-/issues/1`) | no close/reopen button; ⋮ contains `New related issue` and `Report abuse to administrator` (`href="/-/abuse_reports/new?ref_url=…&user_id=…"`) |

There is also a mobile-only dropdown `[data-qa-selector="issue_actions_dropdown"][data-testid="mobile-dropdown"]`
with visible text `Issue actions`, holding the same items plus
`Reopen issue` (`data-qa-selector="mobile_reopen_issue_button"`) /
`Close issue` (`data-qa-selector="mobile_close_issue_button"`).
The ⋮ toggle carries `<span class="gl-dropdown-button-text gl-sr-only">Issue actions</span>`.

**There is no `New issue` button and no `Lock issue` item in this header** — locking lives in the
right sidebar (§14b.7).

### 14.4 The title — ANCHOR

```html
<div class="title-container">
  <h1 data-qa-selector="title_content" dir="auto" class="title gl-font-size-h-display">Rethink the homepage's content</h1>
  <button title="Edit title and description" aria-label="Edit title and description" type="button"
          class="btn btn-edit js-issuable-edit btn-default btn-md gl-button btn-icon"><svg …/></button>
</div>
```

**(ANCHOR — `document.querySelector('[data-qa-selector="title_content"]').outerText`,
webarena-658, 659, 660, 808.)** Verified: the element is an `<h1>` with
`class="title gl-font-size-h-display"` (there is **no** `page-title` class, contrary to the brief's
guess) and `dir="auto"`. Its `outerText` is exactly the issue title with no decoration:

| Page | `outerText` |
|---|---|
| `/a11yproject/…/-/issues/719` | `Rethink the homepage's content` |
| `/a11yproject/…/-/issues/566` | `Better Event page UX` |
| `/a11yproject/…/-/issues/1517` | `Deprecate GitHub Discussions` |
| `/byteblaze/empathy-prompts/-/issues/18` | `Outdated dependencies` |
| `/byteblaze/a11y-syntax-highlighting/-/issues/1` | `Tm Theme Editor` |
| `/byteblaze/a11y-webring.club/-/issues/71` | `[Feature suggestion] Support linking to an accessibility statement` |
| `/0ang3el/aem-hacker/-/issues/28` | `OSError: [Errno 98] Address already in use` |

Anchor tasks 658/659/660/808 create a *new* issue and then read this element, so it must reflect
whatever title the user typed (`Integrating LLMs for better prompts`, `add support for oh-my-zsh`,
`Let's keep the project alive` are the anchor titles).

### 14.5 `.detail-page-description` — ANCHOR

```html
<div class="detail-page-description content-block js-detail-page-description gl-pb-0 gl-border-none">
```

**(ANCHOR — `document.querySelector('.detail-page-description').outerText`, webarena-661…664.)**

What `outerText` actually contains, in order:
1. the `<h1>` title,
2. a blank line,
3. the **rendered markdown description body** (`div.md[data-testid="gfm-content"]` inside
   `div.description.js-task-list-container.is-task-list-enabled`),
4. the `Edited <relative> by <Name>` line **if** the issue has been edited,
5. `👍`, `0`, `👎`, `0`, `Add reaction` from the award-emoji row,
6. `Create merge request` only when the create-MR widget is enabled (it is `hidden` on most issues).

Verified live, `/a11yproject/a11yproject.com/-/issues/719`:

```
Rethink the homepage's content

Right now it feels a little strange to be just dumped into the post categories with little explanation. What I'd like to do is:

Explain what "a11y" means and point to this article. I think it's important to stress how "a11y" speaks specifically to web accessibility concerns.
Point to the checklist as a good place to get started if you don't know where to begin (and possibly revise checklist content, as well).
Surface other site content in the form of highlights. I'm thinking things like the latest post, featured members of the a11y community, new resources and events, that sort of thing.
👍
0
👎
0
Add reaction
```

Verified live, `/byteblaze/a11y-syntax-highlighting/-/issues/1` (an *edited* issue):
```
Tm Theme Editor

Hi!

Good day to you! I greatly appreciate the efforts and work going into the a11y-syntax-highlighting project. …
…
Thanks so much!

Edited 3 years ago by Byte Blaze
👍
0
👎
0
Add reaction
Create merge request
```

Verified live, `/0ang3el/aem-hacker/-/issues/28` — contains the ANCHOR string
`OSError: [Errno 98] Address already in use` (webarena-662) in both the title and the body:
```
OSError: [Errno 98] Address already in use

While I run this cmd: python3 aem_hacker.py -u https://site.com --host 100.000.00.000 The error comes.

Traceback (most recent call last):
  File "aem_hacker.py", line 1676, in <module>
    main()
  …
OSError: [Errno 98] Address already in use

Solutions? Thank you

👍
0
👎
0
Add reaction
```

> The other three locator anchors are **create-then-read** tasks: webarena-661 posts an issue in
> `/convexegg/chatgpt` whose description must contain `connection refused`, webarena-663 posts in
> `/root/metaseq` with `llama`, webarena-664 posts in `/vinta/awesome-python` with `Python 3.11`.
> None of those strings exists in the current seed data (searched — 0 hits). So the mock's
> **new-issue flow must round-trip the typed description into `.detail-page-description`**.

Markdown rendering inside `div.md[data-testid="gfm-content"]`:
- paragraphs `<p data-sourcepos="1:1-1:127" dir="auto">`
- lists `<ul data-sourcepos="…" dir="auto"> <li data-sourcepos="…">`
- task lists render an SVG checkbox glyph at the start of each `<li>`
- external links get `rel="nofollow noreferrer noopener" target="_blank"`
- fenced code renders as `<pre class="code highlight">` blocks; inline code as `<code>`
- `@mentions` render as `<a class="gfm gfm-project_member js-user-link" data-reference-type="user" href="/<user>">@handle</a>`
- headings, `<em>`, `<strong>` as usual
- the hidden sibling `<textarea class="hidden js-task-list-field" data-testid="textarea"
  data-update-url="/<ns>/<proj>/-/issues/<iid>.json">` holds the raw markdown

Edited footer:
```html
<small class="edited-text js-issue-widgets">Edited
  <time title="Mar 27, 2023 4:15pm PDT" datetime="2023-03-27T23:15:19+00:00" class="">3 years ago</time>
  by <a href="/byteblaze" class="author-link gl-hover-text-decoration-underline"><span>Byte Blaze</span></a>
</small>
```
Rendered: `Edited 3 years ago by Byte Blaze`.

### 14.6 `.emoji-block` (award emoji row)

```html
<div class="emoji-block emoji-block-sticky">
  <div class="row gl-m-0 gl-justify-content-space-between">
    <div class="js-noteable-awards">
      <div class="gl-display-flex gl-flex-wrap gl-justify-content-space-between gl-pt-3">
        <div class="awards js-awards-block">
          <button title="" data-testid="award-button" class="btn gl-mr-3 gl-my-2 btn-default btn-md gl-button">
            <span data-testid="award-html" class="award-emoji-block">
              <gl-emoji data-name="thumbsup" data-unicode-version="6.0" title="thumbs up sign">👍</gl-emoji></span>
            <span class="gl-button-text"><span class="js-counter">0</span></span></button>
          <button … ><gl-emoji data-name="thumbsdown" … title="thumbs down sign">👎</gl-emoji>
            <span class="gl-button-text"><span class="js-counter">0</span></span></button>
          <div class="award-menu-holder gl-my-2">
            <div class="emoji-picker" title="Add reaction" data-testid="emoji-picker">
              <div class="dropdown b-dropdown gl-dropdown position-static btn-group">
                <button class="btn dropdown-toggle … add-reaction-button btn-icon gl-relative! gl-button gl-dropdown-toggle btn-default-secondary">
                  <span class="gl-sr-only">Add reaction</span>
                  <span class="reaction-control-icon reaction-control-icon-neutral">…</span>
                  <span class="reaction-control-icon reaction-control-icon-positive">…</span>
                  <span class="reaction-control-icon reaction-control-icon-super-positive">…</span>
                </button><ul role="menu" class="dropdown-menu dropdown-extended-height dropdown-menu-right"></ul>
              </div></div></div>
        </div></div></div>
    <div class="new-branch-col gl-font-size-0 gl-my-2">
      <div class="create-mr-dropdown-wrap … js-create-mr hidden" …>  … </div></div>
  </div></div>
```
- `👍 0` and `👎 0` on every issue in this seed (no reactions anywhere).
- Smiley `Add reaction` button (sr-only label, `title="Add reaction"` on the wrapper).
- The `create-mr-dropdown-wrap` is usually `hidden`; when visible it shows
  `New branch unavailable` / `Create merge request` with a split dropdown
  (`Create merge request and branch`, `Create branch`) and the fields
  `Branch name` / `This field is required.` / `Source (branch or tag)` / `This field is required.`.

### 14.7 The other `.js-issue-widgets` block (designs / tasks / linked items)

Rendered text, verbatim:
```
Drag your designs here or click to upload.

Tasks
0
Add

No tasks are currently assigned. Use tasks to break down this issue into smaller parts.

Linked items
0
Add

Link issues together to show that they're related. Learn more.
```
- Designs drop-zone: `Drag your designs here or ` + link `click to upload` + `.`
- `Tasks` card: heading `Tasks`, a count badge `0`, an `Add` split-button, a collapse chevron,
  body `No tasks are currently assigned. Use tasks to break down this issue into smaller parts.`
- `Linked items` card: heading `Linked items`, count `0`, `Add` button, collapse chevron,
  body `Link issues together to show that they're related.` + link `Learn more.`

### 14.8 Activity / notes timeline

Container `#notes` (inside the last `.js-issue-widgets`).

**Header row**
```html
<div class="gl-display-flex gl-sm-align-items-center gl-flex-direction-column gl-sm-flex-direction-row gl-justify-content-space-between gl-pt-5">
  <h2 class="gl-font-size-h1 gl-m-0">Activity</h2>
  <div class="gl-display-flex gl-gap-3 gl-w-full gl-sm-w-auto gl-mt-3 gl-sm-mt-0">
    <div id="discussion-preferences" data-testid="discussion-preferences" class="gl-display-inline-block gl-vertical-align-bottom full-width-mobile">
      <div id="discussion-preferences-dropdown" class="dropdown b-dropdown gl-dropdown full-width-mobile btn-group"
           data-qa-selector="discussion_preferences_dropdown">
        <button id="discussion-preferences-dropdown__BV_toggle_" …>
          <span class="gl-dropdown-button-text">Sort or filter</span> …</button>
```
Heading is `Activity` (an `<h2>`). The single dropdown is labelled **`Sort or filter`** and its
menu contains, in order (a sort group, a `li.gl-dropdown-divider`, then a filter group):

| Group | `id` on the wrapper | Item | class / attr |
|---|---|---|---|
| sort | `#discussion-sort` | `Newest first` | `li.gl-dropdown-item.js-newest-first` |
| sort | `#discussion-sort` | `Oldest first` | `li.gl-dropdown-item.js-oldest-first` |
| filter | `#discussion-filter.discussion-filter-container.js-discussion-filter-container` | `Show all activity` | `button[data-filter-type="all"][data-qa-selector="filter_menu_item"]`, its `li` has `.is-active` by default |
| filter | | `Show comments only` | `button[data-filter-type="comments"][data-qa-selector="filter_menu_item"]` |
| filter | | `Show history only` | `button[data-filter-type="history"][data-qa-selector="filter_menu_item"]` |

Full innerText of the open dropdown:
`Sort or filter / Newest first / Oldest first / Show all activity / Show comments only / Show history only`.
Default order is **oldest first**; these controls do **not** change the URL.

**`#notes-list`** — `<ul class="notes main-notes-list timeline" id="notes-list">`
(ANCHOR-relevant: `document.querySelector('[id="notes-list"').lastElementChild.querySelector('.timeline-discussion-body …')`,
webarena-390…393; the anchor is written for merge requests but the DOM is shared, so an issue's
`#notes-list` must use the identical classes).

**System note** (`li.timeline-entry.note.system-note.note-wrapper`, `id="note_<sha1|id>"`):
```html
<li class="timeline-entry note system-note note-wrapper" id="note_74b4c47c…">
 <div class="timeline-entry-inner">
  <div class="timeline-icon"><svg …/></div>
  <div class="timeline-content">
   <div class="note-header"><div class="note-header-info">
     <a href="/byteblaze" data-user-id="2330" data-username="byteblaze" class="author-name-link js-user-link">
       <span class="note-header-author-name gl-font-weight-bold">Byte Blaze</span></a>
     <span class="note-headline-light note-headline-meta">
       <span data-qa-selector="system_note_content" class="system-note-message">
         <span>added <span class="gl-label gl-label-sm"><a class="gfm gfm-label has-tooltip gl-link gl-label-link"
              data-label="1754" data-project="174" data-reference-type="label"
              href="/a11yproject/a11yproject.com/-/issues?label_name=administration">
              <span style="background-color: #ffce29" class="gl-label-text gl-label-text-dark">administration</span>
            </a></span> label</span></span>
       <span class="system-note-separator"></span>
       <a href="#note_74b4c47c…" class="note-timestamp system-note-separator">
         <time title="Feb 25, 2023 4:21pm PST" datetime="2023-02-26T00:21:19.000Z">3 years ago</time></a>
       <div role="status" class="gl-spinner-container editing-spinner">…</div>
     </span></div></div>
   <div class="note-body"><div class="note-text md"><p dir="auto">added … label</p></div></div>
  </div></div></li>
```
Note the system-note message is duplicated: once inside `.note-header .system-note-message`
and once inside `.note-body .note-text.md`.

Observed system-note wordings (verbatim, rendered as `<Name> <message> <relative>`):
```
Byte Blaze added  administration  label 3 years ago      (the label pill sits between "added" and "label")
Byte Blaze assigned to @ericwbailey 3 years ago
Byte Blaze closed 3 years ago
Byte Blaze changed title from Better event UX to Better Event page UX 8 years ago
Byte Blaze changed the description 3 years ago
Byte Blaze removed time estimate 3 years ago
Byte Blaze changed milestone to %Content Updates for 2019 7 years ago
Byte Blaze added 1 deleted label 7 years ago
Rohan Kumar added  feature  label 3 years ago
```
(`changed title from X to Y` renders X struck-through and Y underlined via `<s>`/`<b>` in the real
markup; `changed milestone to %Name` links the milestone; `mentioned in issue #NNN` /
`mentioned in merge request !NNN` use the same shape.)

**User comment** (`li.timeline-entry.note.note-wrapper.note-comment.note-row-<id>.is-editable`,
`id="note_<id>"`, `data-note-id`, `data-award-url="/<ns>/<proj>/notes/<id>/toggle_award_emoji"`,
`data-qa-selector="noteable_note_container"`):
```
li.timeline-entry.note.note-wrapper.note-comment.note-row-305163.is-editable#note_305163
  div.timeline-entry-inner
    div.timeline-avatar.gl-float-left > a.gl-link.gl-avatar-link[href="/mxmason"]
        > img.gl-avatar.gl-avatar-circle.gl-avatar-s32[alt="EJ Mason"]
    div.timeline-content
      div.note-header > div.note-header-info
          a.author-name-link.js-user-link[href="/mxmason"][data-user-id][data-username]
             > span.note-header-author-name.gl-font-weight-bold  →  "EJ Mason"
          span.text-nowrap.author-username > a.author-username-link > span.note-headline-light → "@mxmason"
          span.note-headline-light.note-headline-meta
             > span.system-note-message > span.d-none.d-sm-inline  →  "·"
             > span.system-note-separator
             > a.note-timestamp.system-note-separator[href="#note_305163"]
                  > time[title="Jan 4, 2019 8:45am PST"][datetime="2019-01-04T16:45:29.000Z"] → "7 years ago"
             > div.gl-spinner-container.editing-spinner[aria-label="Comment is being updated"]
      div.note-actions
          span.badge…badge-muted.badge-pill.gl-badge.md[title="This user has previously committed to the a11yproject.com project."] → "Contributor"
          span.note-actions__mobile-spacer
          div.emoji-picker[data-testid="note-emoji-button"]     (smiley, add reaction)
          button.js-reply-button[title="Reply to comment"][aria-label="Reply to comment"][data-track-label="reply_comment_button"]
          button.note-action-button.js-note-edit[title="Edit comment"][aria-label="Edit comment"][data-qa-selector="note_edit_button"]
          div.dropdown.more-actions > button.more-actions-toggle[title="More actions"][aria-label="More actions"]
             ul.dropdown-menu.more-actions-dropdown.dropdown-open-left
                 a  → "Report abuse to administrator"  href="/-/abuse_reports/new?ref_url=…&user_id=…"
                 button (li.js-btn-copy-note-link) → "Copy link"  data-clipboard-text=<absolute note URL>
                 button[data-testid="assign-user"] → "Assign to commenting user"
                 button (li.js-note-delete) → <span class="text-danger">Delete comment</span>
      div.timeline-discussion-body            ← the ANCHOR class
          div.note-body.js-task-list-container.is-task-list-enabled
              div.note-text.md   ← rendered comment markdown
              textarea.hidden.js-task-list-field[data-update-url="/<ns>/<proj>/notes/<id>"]
          div.timeline-discussion-body-footer
```
Role pills observed on comments: `Contributor`, `Owner`, `Maintainer`, and `Author` (shown when the
commenter is the issue author — e.g. `Byte Blaze @byteblaze · 8 years ago  Author  Maintainer`).

Note timestamps are always `<relative> ago` in the body with an absolute
`title="Jan 4, 2019 8:45am PST"` (`MMM D, YYYY h:mma TZ`) and an ISO `datetime` attribute.

Sample activity (issue 719) so the mock has real content:
```
Byte Blaze assigned to @ericwbailey 7 years ago
Byte Blaze added 1 deleted label 7 years ago
Byte Blaze changed milestone to %Content Updates for 2019 7 years ago
EJ Mason @mxmason · 7 years ago [Contributor]
  Wish I had something more useful to say than "I agree." I think explaining a11y is critical,
  because people in this community often assume it is understood. Sometimes it isn't, and I
  default to saying "web accessibility" wherever I can because of it.
Byte Blaze added 1 deleted label 7 years ago
Administrator @root · 7 years ago [Contributor]
  Created by: webuxr
  For @ericwbailey's first point, what about doing something as simple as adding an abbreviation
  element to the H1?
  <h1 class="a11y-title"> … </h1>
  …
```

### 14.9 The comment form — **do not submit**

`div.js-comment-form > ul.notes.notes-form.timeline > li.timeline-entry.note-form >
 div.timeline-entry-inner > div.timeline-content.timeline-content-form >
 form.new-note.common-note-form.gfm-form.js-main-target-form`

Structure:
- `.comment-warning-wrapper.gl-border-solid.gl-border-1.gl-rounded-base.gl-border-gray-100`
  wraps `div[data-testid="comment-field-alert-container"].error-alert` and
  `div.js-vue-markdown-field.md-area.position-relative.gfm-form`.
- `.md-header` holds a `gl-tabs` bar with two tabs:
  `Write` (`a.nav-link.gl-py-4.gl-px-3.js-md-write-button`, active) and
  `Preview` (`a.nav-link.gl-py-4.gl-px-3.js-md-preview-button`),
  plus `div[data-testid="md-header-toolbar"].md-header-toolbar.gl-ml-auto.gl-py-2.gl-justify-content-center`.

**Markdown toolbar buttons, exact order and exact `title`/`aria-label` strings**
(each `button.btn.js-md.btn-default.btn-md.gl-button.btn-default-tertiary.btn-icon`):

| # | `title` = `aria-label` | `data-md-tag` |
|---|---|---|
| 1 | `Add bold text (Ctrl+B)` | `**` |
| 2 | `Add italic text (Ctrl+I)` | `_` |
| 3 | `Add strikethrough text (Ctrl+⇧X)` | `~~` |
| 4 | `Insert a quote` | `> ` |
| 5 | `Insert code` | `` ` `` (block `` ``` ``) |
| 6 | `Add a link (Ctrl+K)` | `[{text}](url)` |
| 7 | `Add a bullet list` | `- ` |
| 8 | `Add a numbered list` | `1. ` |
| 9 | `Add a checklist` | `- [ ] ` |
| 10 | `Indent line (Ctrl+])` | — **hidden** (`gl-display-none`) |
| 11 | `Outdent line (Ctrl+[)` | — **hidden** (`gl-display-none`) |
| 12 | `Add a collapsible section` | `<details><summary>Click to expand</summary>\n{text}\n</details>` |
| 13 | `Add a table` | `\| header \| header \|` … |
| 14 | `Attach a file or image` | `button[data-testid="button-attach-file"]` (no `js-md`) |
| 15 | `Go full screen` | `button.js-md.js-zen-enter` |

> Note the exact strings differ from the brief's guesses: it is
> `Add strikethrough text (Ctrl+⇧X)` (with the shortcut), and the attach button is
> `Attach a file or image` — there is no `Attach a file or select one` string.

Textarea:
```html
<textarea id="note-body" dir="auto" name="note[note]" data-qa-selector="comment_field"
          data-testid="comment-field" data-supports-quick-actions="true" aria-label="Comment"
          placeholder="Write a comment or drag your files here…"
          class="note-textarea js-vue-comment-form js-note-text js-gfm-input js-autosize markdown-area …"></textarea>
```
The placeholder ends with a real **U+2026 horizontal ellipsis** (`…`), not three dots.
It sits inside `div.md-write-holder > div.zen-backdrop.div-dropzone-wrapper > div.div-dropzone.dz-clickable`.

Below the textarea, `div.comment-toolbar.clearfix`:
`<div class="toolbar-text"> Supports <a href="/help/user/markdown" …>Markdown</a>. For <a href="/help/user/project/quick_actions" …>quick actions</a>, type <kbd>/</kbd>.</div>`
→ renders as `Supports Markdown. For quick actions, type /.`
Plus the upload progress spans (`0%`, hidden) and a `Cancel` button (hidden).

Preview pane: `div.js-vue-md-preview.md.md-preview-holder` (`display:none` until `Preview` is clicked).

`div.note-form-actions`:
1. `<div class="gl-form-checkbox gl-mb-2 custom-control custom-checkbox"><input data-testid="internal-note-checkbox" …><label>Make this an internal note <svg/></label></div>`
2. split-button `div.dropdown.gl-dropdown.js-comment-button.js-comment-submit-button.comment-type-dropdown[data-testid="comment-button"][data-qa-selector="comment_button"]`:
   - main `<button disabled class="btn btn-confirm btn-md disabled gl-button split-content-button"><span class="gl-dropdown-button-text">Comment</span></button>`
     (disabled until the textarea is non-empty)
   - caret `<button …><span class="sr-only">Toggle dropdown</span></button>`
   - menu items:
     - `<strong>Comment</strong>` + `<p class="gl-m-0">Add a general comment to this issue.</p>`
     - divider
     - `<strong>Start thread</strong>` + `<p class="gl-m-0">Discuss a specific suggestion or question.</p>` (`data-qa-selector="discussion_menu_item"`)
3. `<button data-testid="close-reopen-button" class="btn btn-default btn-md gl-button btn-close js-note-target-close btn-comment btn-comment-and-close"><span class="gl-button-text">Close issue</span></button>`
   — text is `Close issue` on an open issue (`.btn-close.js-note-target-close`) and
   `Reopen issue` on a closed one (`.btn-reopen.js-note-target-reopen`).

Whole-form innerText (open issue):
`Write / Preview / <14 icon buttons> / Supports Markdown. For quick actions, type /. / Make this an internal note / Comment / Toggle dropdown / Close issue`

**None of these controls may be clicked by the recon tooling; in the mock they must exist and be
interactive because the create/comment tasks depend on them.**

---

## 14b. Issue detail — right sidebar blocks (exact DOM)

Wrapper (from `app/views/shared/issuable/_sidebar.html.haml`):

```html
<aside class="right-sidebar js-right-sidebar js-issuable-sidebar right-sidebar-expanded"
       data-signed-in="" data-issuable-type="issue" aria-live="polite" aria-label="issue">
  <div class="issuable-sidebar">
    <div class="issuable-sidebar-header"> … </div>
    <form class="issuable-context-form inline-update js-issuable-update"
          action="/<ns>/<proj>/-/issues/<iid>.json" data-remote="true"> … all blocks … </form>
    <script class="js-sidebar-options" type="application/json">{…}</script>
  </div>
</aside>
```

Collapsed variant: the `aside` swaps `right-sidebar-expanded` → `right-sidebar-collapsed`
(width 290 → 62). Every block keeps a `.sidebar-collapsed-icon` child that is the only visible thing
in the collapsed rail; all `.hide-collapsed` children are hidden.

### Sidebar header + collapse toggle

```html
<div class="issuable-sidebar-header">
  <a aria-label="Toggle sidebar" class="gutter-toggle float-right js-sidebar-toggle has-tooltip"
     role="button" href="#" title="Collapse sidebar"
     data-boundary="viewport" data-container="body" data-placement="left">
    <span class="js-sidebar-toggle-container" data-is-expanded="true"><svg/><svg/></span></a>
  <div data-testid="sidebar-todo">
    <button aria-label="Add a to do" issuable-type="issue" issuable-id="gid://gitlab/Issue/83395"
            class="btn hide-collapsed btn-default btn-sm gl-button">
      <span class="gl-button-text">Add a to do</span></button>
    <button title="Add a to do" type="reset"
            class="btn sidebar-collapsed-icon sidebar-collapsed-container gl-rounded-0! gl-shadow-none! btn-default btn-md gl-button btn-default-tertiary">
      <span class="gl-button-text"><svg/></span></button></div>
</div>
```
- `aria-label="Toggle sidebar"` is constant; `title` alternates
  `Collapse sidebar` (expanded) ⇄ `Expand sidebar` (collapsed);
  `span.js-sidebar-toggle-container[data-is-expanded]` flips `true`/`false`.
- The to-do button reads `Add a to do` (becomes `Mark as done` once a to-do exists).
- There is also a mobile-only duplicate toggle inside `.detail-page-header-body`
  (`a.gutter-toggle.issuable-gutter-toggle.js-sidebar-toggle.d-sm-none`).

**Block order in the DOM (verified live, issue 719):**

| # | Block | Selector |
|---|---|---|
| 1 | Assignee | `.block.assignee` |
| 2 | Labels | `.block.labels` (`.labels-select-wrapper.gl-relative.block.labels.js-labels-block`) |
| 3 | Milestone | `.block.milestone` |
| 4 | Due date | `div.block[data-testid="sidebar-due-date"]` |
| 5 | Time tracking | `.block.time-tracking` |
| 6 | Confidentiality | `.block.confidentiality` |
| 7 | Lock issue | `.block.issuable-sidebar-item.lock` |
| 8 | Notifications | `.block.subscriptions` |
| 9 | Participants | `.block.participants` |
| 10 | Reference | `.block.with-sub-blocks` |
| 11 | Move issue | `.block.js-sidebar-move-issue-block` (only when the user can move the issue) |

Visual order in the screenshot matches: Assignee, Labels, Milestone, Due date, Time tracking,
Confidentiality, Lock issue, Notifications, N participants, Reference, Move issue.

---

### 1. `.block.assignee` — ANCHOR

**(ANCHOR — `document.querySelector('.block.assignee').outerText`, webarena-658, 659, 660, 808.)**

```html
<div class="block assignee" data-qa-selector="assignee_block_container" data-testid="assignee-block-container">
 <div>
  <div class="hide-collapsed gl-line-height-20 gl-mb-2 gl-text-gray-900 gl-font-weight-bold">
    Assignee
    <a href="#" data-test-id="edit-link" data-qa-selector="edit_link"
       data-track-action="click_edit_button" data-track-label="right_sidebar" data-track-property="assignee"
       class="js-sidebar-dropdown-toggle edit-link btn gl-text-gray-900! gl-ml-auto hide-collapsed btn-default btn-sm gl-button btn-default-tertiary float-right">Edit</a>
  </div>
  <div root-path="">
    <div title="Byte Blaze" class="sidebar-collapsed-icon sidebar-collapsed-user">
      <button class="gl-button btn-link"><span class="position-relative">
        <img alt="Byte Blaze's avatar" src="https://www.gravatar.com/avatar/…?s=80&d=identicon"
             width="24" data-qa-selector="avatar_image" class="avatar avatar-inline m-0 s24"></span>
        <span class="author">Byte Blaze</span></button></div>
    <div data-testid="expanded-assignee" class="value hide-collapsed">
      <div><div class="gl-display-flex gl-flex-wrap">
        <div class="assignee-grid gl-display-grid gl-align-items-center gl-w-full">
          <a title="Byte Blaze" data-user-id="2330" data-placement="left" href="/byteblaze"
             class="gl-link gl-display-inline-block js-user-link gl-word-break-word" data-css-area="user">
            <span class="gl-display-flex"><span class="position-relative"><img alt="Byte Blaze's avatar" …
                  class="avatar avatar-inline m-0 s24"></span>
              <div data-testid="username" data-qa-selector="username"
                   class="gl-ml-3 gl-line-height-normal gl-display-grid gl-align-items-center">
                <span class="">Byte Blaze</span></div></span></a>
        </div></div></div></div>
  </div>
 </div>
 <div class="js-sidebar-assignee-data selectbox hide-collapsed">
   <input type="hidden" name="issue[assignee_ids][]" value="2330" data-avatar-url="…" data-name="Byte Blaze" data-username="byteblaze">
   <div class="dropdown js-sidebar-assignee-dropdown">
     <button class="dropdown-menu-toggle js-user-search js-author-search js-multiselect js-save-user-data js-invite-members-track"
             data-first-user="byteblaze" data-current-user="true" data-iid="719" data-issuable-type="issue"
             data-project-id="174" data-field-name="issue[assignee_ids][]"
             data-issue-update="/<ns>/<proj>/-/issues/<iid>.json" data-dropdown-title="Select assignee"
             data-dropdown-header="Assignee" data-max-select="1" data-toggle="dropdown">
       <span class="dropdown-toggle-text ">Select assignee</span></button>
     <div class="dropdown-menu dropdown-select dropdown-menu-user dropdown-menu-selectable dropdown-menu-author dropdown-extended-height">
       <div class="dropdown-title gl-display-flex"><span class="gl-ml-auto">Assign to</span>
         <button class="dropdown-title-button dropdown-menu-close" aria-label="Close">…</button></div>
       <div class="dropdown-input"><input type="search" data-qa-selector="dropdown_input_field"
            class="dropdown-input-field" placeholder="Search users"></div>
       <div class="dropdown-content"></div><div class="dropdown-loading">…</div>
       <div class="dropdown-footer">… Invite Members …</div>
     </div></div>
 </div>
</div>
```

**Header text is count-dependent:**
- 1 assignee → header word is `Assignee`
- 0 assignees → header word is **`0 Assignees`**, and the value is
  ```html
  <span data-testid="no-value" class="no-value">None
    -
    <button data-testid="assign-yourself" data-qa-selector="assign_yourself_button"
            class="gl-button btn-link gl-reset-color!">assign yourself</button></span>
  ```
  i.e. the **`assign yourself`** quick link (lowercase, preceded by ` - `).
  Collapsed icon title is `Assignee(s)` in that case.

`outerText` shapes actually observed (all seven captured issues have Byte Blaze assigned):
```
Assignee
Edit
Byte Blaze
Byte Blaze
Select assignee
Assign to
Invite Members
```
and unassigned (`/a11yproject/…/-/issues/12`):
```
0 Assignees
Edit
None - assign yourself
```

Anchor expectations (the agent assigns someone, then the grader reads this element):
`Roshan Jossy` (webarena-658), `Roshan Jossey` (webarena-659), `Abishek S` (webarena-660),
`Byte Blaze` (webarena-808). The **display name must be readable inside `.block.assignee`**.

---

### 2. `.block.labels`

```html
<div data-testid="sidebar-labels" data-qa-selector="labels_block"
     class="labels-select-wrapper gl-relative block labels js-labels-block">
 <div>
  <div class="gl-display-flex gl-align-items-center gl-line-height-20 gl-text-gray-900 gl-font-weight-bold">
    <span data-testid="title" class="hide-collapsed">Labels</span>
    <button data-testid="edit-button" data-qa-selector="edit_link"
            class="btn gl-text-gray-900! gl-ml-auto hide-collapsed gl-mr-n2 shortcut-sidebar-dropdown-toggle btn-default btn-sm gl-button btn-default-tertiary">
      <span class="gl-button-text">Edit</span></button></div>
  <div data-testid="collapsed-content" class="gl-line-height-14">
    <div data-testid="value-wrapper" class="value issuable-show-labels js-value has-labels">
      <div title="enhancement, redesign" class="sidebar-collapsed-icon"><svg/>
        <span class="collapse-truncated-title gl-pt-2 gl-px-3 gl-font-sm">2</span></div>
      <span data-qa-selector="selected_label_content" data-qa-label-name="enhancement"
            class="gl-label hide-collapsed gl-label-text-dark"
            style="--label-background-color: #d4c5f9; --label-inset-border: inset 0 0 0 2px #d4c5f9;">
        <a tabindex="0" href="/<ns>/<proj>/-/issues?label_name[]=enhancement" class="gl-link gl-label-link">
          <span class="gl-label-text">enhancement</span></a>
        <button aria-label="Remove label" class="btn gl-label-close gl-p-0! btn-reset btn-sm gl-button btn-reset-tertiary btn-icon">…</button>
      </span>
      … one <span class="gl-label …"> per label …
    </div></div>
  <div data-testid="expanded-content" style="display:none"> … same pills + the label dropdown … </div>
 </div>
</div>
```
- Header `Labels`, `Edit` button on the right (`[data-testid="edit-button"]`).
- Each pill is `span.gl-label` with `--label-background-color` / `--label-inset-border` custom
  properties and a `.gl-label-text` span; light-background labels add `.gl-label-text-dark`,
  dark ones `.gl-label-text-light`. Each pill has an `aria-label="Remove label"` X button.
- Collapsed rail shows an icon + the label count (`2`), `title="enhancement, redesign"`.
- With no labels the value is the literal `None` (`0` in the collapsed count) and the collapsed
  icon title is `Label`.
- Expanded dropdown copy: title `Assign labels`, empty message `No matching results`,
  footer links `Create project label` and `Manage project labels`.

Observed values: `enhancement`+`redesign` (#719), `administration` (#1517), none (#566, a11ysyntax#1),
`[Priority] Critical`+`[Status] Submitted`+`[Type] Bug` (empathy#18),
`[Priority] Low`+`[Status] Submitted`+`[Type] Enhancement` (empathy#8),
`being discussed`+`feature` (a11y-webring#71).

---

### 3. `.block.milestone`

```html
<div class="block milestone" data-qa-selector="milestone_block" data-testid="sidebar-milestones">
 <div data-testid="milestone-edit">
  <div class="gl-display-flex gl-align-items-center gl-line-height-20 gl-text-gray-900 gl-font-weight-bold">
    <span data-testid="title" class="hide-collapsed">Milestone</span>
    <button id="milestone-edit" data-testid="edit-button" data-qa-selector="edit_link"
            data-track-action="click_edit_button" data-track-label="right_sidebar" data-track-property="milestone"
            class="btn gl-text-gray-900! gl-ml-auto hide-collapsed gl-mr-n2 shortcut-sidebar-dropdown-toggle btn-default btn-sm gl-button btn-default-tertiary">
      <span class="gl-button-text">Edit</span></button></div>
  <div data-testid="collapsed-content" class="gl-line-height-14">
    <div title="Milestone" class="sidebar-collapsed-icon"><svg/>
      <span class="collapse-truncated-title gl-pt-2 gl-px-3 gl-font-sm">Content Updates for 2019</span></div>
    <div data-testid="select-milestone" class="hide-collapsed">
      <a data-qa-selector="milestone_link" href="/<ns>/<proj>/-/milestones/3"
         class="gl-link gl-reset-color gl-hover-text-blue-800">Content Updates for 2019 <span>(expired)</span></a>
    </div></div>
  <div data-testid="expanded-content" style="display:none">
    <div class="dropdown b-dropdown gl-dropdown"><button class="btn dropdown-toggle … btn-block gl-m-0 gl-button gl-dropdown-toggle">
      <span class="gl-dropdown-button-text">Content Updates for 2019</span></button>
      <ul role="menu" class="dropdown-menu"></ul></div></div>
 </div></div>
```
- Header `Milestone` + `Edit`.
- Value: a link to `/<ns>/<proj>/-/milestones/<id>`; a past-due milestone appends
  ` <span>(expired)</span>` → rendered `Content Updates for 2019 (expired)`.
- With no milestone the value renders `None` and the collapsed icon shows `No milestone`;
  the expanded dropdown toggle text is `Milestone`.
  (`outerText` shape then: `Milestone / Edit / No milestone / None / Milestone`.)

---

### 4. Due date — **`[data-testid="sidebar-due-date"]`** (ANCHOR) — ⚠️ `.block.due_date` DOES NOT EXIST HERE

**(ANCHOR — `document.querySelector('[data-testid="sidebar-due-date"').outerText`,
webarena-658, 659, 660, 808.)**

> **Correction to the brief:** on an *issue detail* page GitLab 15.7.5 renders the due-date widget as
> a **plain `<div class="block">` carrying `data-testid="sidebar-due-date"`**. There is
> **no `due_date` class** — `document.querySelector('.block.due_date')` returns `null` on every one of
> the seven captured issue pages and on the live site. The Haml mount point is a bare
> `.js-sidebar-due-date-widget-root` which the Vue widget replaces.
>
> The other anchor, `document.querySelector('.block.due_date').outerText`
> (webarena-590, 591, 592, 593), belongs to the **milestone** pages
> (`/primer/design/-/milestones`, `/byteblaze/dotfiles/-/milestones`) together with
> `.block.start_date` and `#content-body` — see the milestones section of this spec, not this one.
> Both selectors must exist, but on **different** views.

```html
<div data-testid="sidebar-due-date" class="block">
  <div class="gl-display-flex gl-align-items-center gl-line-height-20 gl-text-gray-900 gl-font-weight-bold">
    <span data-testid="title" class="hide-collapsed">Due date</span>
    <button data-testid="edit-button" data-qa-selector="edit_link"
            data-track-action="click_edit_button" data-track-label="right_sidebar" data-track-property="dueDate"
            class="btn gl-text-gray-900! gl-ml-auto hide-collapsed gl-mr-n2 shortcut-sidebar-dropdown-toggle btn-default btn-sm gl-button btn-default-tertiary">
      <span class="gl-button-text">Edit</span></button></div>

  <div data-testid="collapsed-content" class="gl-line-height-14">
    <div title="Due date" class="sidebar-collapsed-icon"><svg/>
      <span class="gl-pt-2 gl-px-3 gl-font-sm">None</span></div>
    <div class="gl-display-flex gl-align-items-center hide-collapsed">
      <span data-testid="sidebar-date-value" class="gl-text-gray-500">None</span>
    </div></div>

  <div data-testid="expanded-content" class="gl-mt-3" style="display:none">
    <div class="gl-relative gl-datepicker d-inline-block gl-w-full gl-form-input-md">
      <div class="gl-relative">
        <input type="text" placeholder="YYYY-MM-DD" autocomplete="off" aria-label="Enter date"
               data-testid="gl-datepicker-input" class="gl-form-input gl-w-full form-control gl-pr-7!">
        <div class="gl-datepicker-actions">
          <button aria-label="Open datepicker" class="btn gl-pointer-events-auto btn-default btn-sm gl-button btn-default-tertiary btn-icon">…</button>
        </div></div>
      <div class="pika-single gl-datepicker-theme position-absolute is-hidden is-bound"></div>
    </div></div>
</div>
```

**When a date IS set** (confirmed from the shipped `sidebar_formatted_date` component in
`pages.projects.issues.show.5a8396ff.chunk.js`), the value row becomes:

```html
<div class="gl-display-flex gl-align-items-center hide-collapsed">
  <span data-testid="sidebar-date-value" class="gl-text-gray-900">Dec 31, 2030</span>
  <div class="gl-display-flex">
    <span class="gl-px-2">-</span>
    <button data-testid="reset-button" class="btn btn-link gl-text-gray-500!">remove due date</button>
  </div></div>
```
and the collapsed rail shows the same formatted date instead of `None`.

`outerText` shapes:
- no date → `Due date / Edit / None / None` (the value appears twice: collapsed icon + expanded span)
- with a date → `Due date / Edit / Dec 31, 2030 / Dec 31, 2030 - remove due date`

**Date format is `MMM D, YYYY`** — no leading zero on the day, comma before the year:
`Dec 31, 2030` (ANCHOR webarena-658), `Apr 1, 2033` (ANCHOR webarena-659),
`Jul 18, 2033` (ANCHOR webarena-660), `Mar 31, 2033` (ANCHOR webarena-808),
`Jan 3, 2030` (ANCHOR webarena-809).
Reset-button label is lower-case `remove due date` (`remove start date` on epics).
Empty label is `None`.

---

### 5. `.block.time-tracking`

```html
<div class="block time-tracking">
  <div data-testid="time-tracker" class="time-tracker sidebar-help-wrap">
    <div title="Time tracking" data-testid="collapsedState" class="sidebar-collapsed-icon"><svg/>
      <div class="time-tracking-collapsed-summary"><div class="no-tracking">
        <span class="no-value collapse-truncated-title gl-pt-2 gl-px-3 gl-font-sm"> None </span></div></div></div>
    <div class="hide-collapsed gl-line-height-20 gl-text-gray-900 gl-display-flex gl-align-items-center gl-font-weight-bold">
      Time tracking
      <button data-testid="add-time-entry-button" title="Add time entry"
              class="btn gl-ml-auto btn-default btn-sm gl-button btn-default-tertiary">
        <span class="gl-button-text"><svg/></span></button></div>
    <div class="hide-collapsed">
      <div data-testid="noTrackingPane"><span class="gl-text-gray-500">No estimate or time spent</span></div>
    </div></div></div>
```
- Header `Time tracking`; the control on the right is a **`+` button** with
  `title="Add time entry"` (`data-testid="add-time-entry-button"`) — in this build it is a plus icon,
  **not** a `?` help icon.
- Body copy verbatim: `No estimate or time spent`.
- Collapsed rail shows ` None ` under a clock icon, `title="Time tracking"`.
- There is **no `#issuable-time-tracker` id** in 15.7.5 — use `.block.time-tracking` /
  `[data-testid="time-tracker"]`.
- `outerText`: `None / Time tracking / No estimate or time spent`.

---

### 6. `.block.confidentiality`

```html
<div class="block confidentiality">
  <div class="gl-display-flex gl-align-items-center gl-line-height-20 gl-text-gray-900 gl-font-weight-bold">
    <span data-testid="title" class="hide-collapsed">Confidentiality</span>
    <button data-testid="edit-button" data-qa-selector="edit_link"
            data-track-property="confidentiality" class="btn … btn-default-tertiary">
      <span class="gl-button-text">Edit</span></button></div>
  <div data-testid="collapsed-content" class="gl-line-height-14"><div><div class="">
    <div title="Not confidential" data-testid="sidebar-collapsed-icon" class="sidebar-collapsed-icon"><svg/></div>
    <svg/><span data-testid="confidential-text" class="hide-collapsed">Not confidential</span>
  </div></div></div>
  <div data-testid="expanded-content" style="display:none">
    <div>…<span data-testid="confidential-text" class="hide-collapsed">Not confidential</span></div>
    <div class="dropdown show"><div class="dropdown-menu sidebar-item-warning-message"><div>
      <p data-testid="warning-message">You are going to turn on confidentiality. Only project members with
        <strong>at least the Reporter role, the author, and assignees</strong> can view or be notified about this issue.</p>
      <div class="sidebar-item-warning-message-actions">
        <button data-testid="confidential-cancel" class="btn gl-mr-3 btn-default btn-md gl-button">
          <span class="gl-button-text">Cancel</span></button>
        <button data-testid="confidential-toggle" class="btn btn-confirm btn-md gl-button btn-confirm-secondary">
          <span class="gl-button-text">Turn on</span></button></div></div></div></div></div>
</div>
```
Verbatim strings: `Confidentiality`, `Edit`, `Not confidential` (or `Confidential`),
warning `You are going to turn on confidentiality. Only project members with at least the Reporter role, the author, and assignees can view or be notified about this issue.`,
buttons `Cancel` and `Turn on`.

---

### 7. `.block.issuable-sidebar-item.lock` — the "Lock issue" block

> The real class list is `block issuable-sidebar-item lock`. **`.block.lock-issue` does not exist**;
> select with `.block.lock`.

```html
<div class="block issuable-sidebar-item lock">
  <div data-testid="sidebar-collapse-icon" class="sidebar-collapsed-icon"><svg data-testid="lock-open-icon"/></div>
  <div class="hide-collapsed gl-line-height-20 gl-mb-2 gl-text-gray-900 gl-font-weight-bold">
    Lock issue
    <a href="#" data-testid="edit-link" data-track-action="click_edit_button"
       data-track-label="right_sidebar" data-track-property="lock_issue"
       class="float-right lock-edit btn gl-text-gray-900! gl-ml-auto hide-collapsed btn-default btn-sm gl-button btn-default-tertiary gl-mr-n2">Edit</a></div>
  <div class="value sidebar-item-value hide-collapsed">
    <div data-testid="lock-status" class="sidebar-item-value no-value hide-collapsed">Unlocked</div></div>
</div>
```
Verbatim: `Lock issue`, `Edit`, `Unlocked` (`Locked` when locked; the icon swaps
`lock-open-icon` → `lock-icon`). `outerText`: `Lock issue / Edit / Unlocked`.

---

### 8. `.block.subscriptions` — Notifications

```html
<div class="block subscriptions">
  <div class="gl-display-flex gl-align-items-center gl-line-height-20 gl-text-gray-900 gl-font-weight-bold">
    <span data-testid="title" class="hide-collapsed">Notifications</span>
    <div data-testid="subscription-toggle" class="gl-toggle-wrapper gl-display-flex gl-mb-0 hide-collapsed gl-ml-auto gl-flex-direction-column">
      <span id="toggle-label-4" data-testid="toggle-label" class="gl-toggle-label gl-flex-shrink-0 gl-sr-only">Notifications</span>
      <button role="switch" aria-checked="true" aria-labelledby="toggle-label-4"
              class="gl-flex-shrink-0 gl-toggle is-checked"><span class="toggle-icon"><svg/></span></button>
    </div></div>
  <div data-testid="collapsed-content" class="gl-line-height-14">
    <span title="Notifications on" class="sidebar-collapsed-icon"><svg/></span>
    <div class="gl-mt-3 hide-collapsed gl-text-gray-500" style="display:none">Disabled by project owner</div></div>
  <div data-testid="expanded-content" class="gl-mt-3" style="display:none"></div>
</div>
```
- Label `Notifications`, control is a `button.gl-toggle` (`.is-checked` when subscribed,
  `role="switch"`, `aria-checked`).
- Collapsed icon `title="Notifications on"` / `"Notifications off"`.
- Hidden helper text `Disabled by project owner` (shown only when the project disabled notifications).
- `outerText` when the helper text is force-shown (as in the static captures):
  `Notifications / Notifications / Disabled by project owner`.

---

### 9. `.block.participants`

```html
<div class="block participants">
  <div title="3 participants" class="sidebar-collapsed-icon"><svg data-testid="users-icon"/>
    <span data-testid="collapsed-count" class="gl-pt-2 gl-px-3 gl-font-sm">3</span></div>
  <div class="title hide-collapsed gl-mb-2! gl-line-height-20 gl-font-weight-bold">3 participants</div>
  <div class="hide-collapsed gl-display-flex gl-flex-wrap">
    <div class="participants-author gl-display-inline-block gl-pr-3 gl-pb-3">
      <a href="/byteblaze" class="author-link"><span>
        <img src="https://www.gravatar.com/avatar/…?s=80&d=identicon" alt="Byte Blaze"
             class="gl-avatar gl-avatar-circle gl-avatar-s24 gl-mr-0!"></span></a></div>
    … one per participant …
  </div></div>
```
- Title is pluralised: `1 participant` / `2 participants` / `3 participants`.
- Collapsed rail shows the users icon plus the count, `title="3 participants"`.
- Avatars are 24 px circles, `alt` = the participant's display name, linking to `/<username>`.
- If more than 7 participants GitLab appends a `+ N more` toggle button.

---

### 10. `.block.with-sub-blocks` — the Reference block

```html
<div class="block with-sub-blocks">
  <div class="sub-block">
    <button id="clipboard-button-7" title="Copy Reference" aria-label="Copy Reference" aria-live="polite"
            data-clipboard-text="a11yproject/a11yproject.com#719" data-clipboard-handle-tooltip="false"
            class="btn btn-default btn-md gl-button btn-default-tertiary btn-icon sidebar-collapsed-icon js-dont-change-state gl-rounded-0! gl-hover-bg-transparent"><svg/></button>
    <div class="gl-display-flex gl-align-items-center gl-justify-content-space-between hide-collapsed">
      <span title="a11yproject/a11yproject.com#719"
            class="gl-overflow-hidden gl-text-overflow-ellipsis gl-white-space-nowrap">Reference: a11yproject/a11yproject.com#719</span>
      <button id="clipboard-button-6" title="Copy Reference" aria-label="Copy Reference" aria-live="polite"
              data-clipboard-text="a11yproject/a11yproject.com#719"
              class="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon"><svg/></button>
    </div></div></div>
```
- Visible text: `Reference: <namespace>/<project>#<iid>` (e.g. `Reference: a11yproject/a11yproject.com#719`).
  It is truncated with an ellipsis at 290 px, and the full value is in `title=`.
- The copy button's `title`/`aria-label` is **`Copy Reference`** (capital R), `aria-live="polite"`,
  `data-clipboard-text` = the bare reference. There are two of them: one is the collapsed-rail icon
  (`.sidebar-collapsed-icon.js-dont-change-state`), one is the inline one.

---

### 11. `.block.js-sidebar-move-issue-block` (only when the user may move the issue)

```html
<div class="block js-sidebar-move-issue-block">
  <div class="sidebar-collapsed-icon" title="Move issue" data-toggle="tooltip" data-placement="left"><svg data-testid="long-arrow-icon"/></div>
  <div class="dropdown sidebar-move-issue-dropdown hide-collapsed">
    <button class="gl-button btn btn-block btn-md btn-default js-sidebar-dropdown-toggle js-move-issue" data-toggle="dropdown">
      <span class="gl-button-text">Move issue</span></button>
    <div class="dropdown-menu dropdown-menu-selectable dropdown-extended-height">
      <div class="dropdown-title gl-display-flex"><span class="gl-ml-auto">Move issue</span>
        <button class="dropdown-title-button dropdown-menu-close" aria-label="Close">…</button></div>
      <div class="dropdown-input"><input type="search" name="sidebar-move-issue-dropdown-search"
           data-qa-selector="dropdown_input_field" class="dropdown-input-field" placeholder="Search project"></div>
      <div class="dropdown-content"></div><div class="dropdown-loading">…</div>
      <div class="dropdown-footer"><div class="dropdown-footer-content">
        <button class="gl-button btn btn-confirm sidebar-move-issue-confirmation-button js-move-issue-confirmation-button" disabled>Move</button>
      </div></div></div></div></div>
```
Verbatim: block button `Move issue`, dropdown title `Move issue`, search `placeholder="Search project"`,
confirm `Move`.

---

### Collapsed-rail rendering

After clicking `.js-sidebar-toggle`, `aside` becomes
`right-sidebar js-right-sidebar js-issuable-sidebar right-sidebar-collapsed` at x=1858, width **62**.
Only `.sidebar-collapsed-icon` children render. Measured collapsed rail contents for issue 719
(icon `title` → visible text):

```
Add a to do              → (icon only)
Byte Blaze               → (assignee avatar)
enhancement, redesign    → 2
Milestone                → Content Updates for 2019
Due date                 → None
Time tracking            → None
Not confidential         → (icon only)
(lock)                   → (icon only)
Notifications on         → (icon only)
3 participants           → 3
Copy Reference           → (icon only)
Move issue               → (icon only)
```
i.e. `aside.innerText` collapses to `2 / Content Updates for 2019 / None / None / 3`.
Collapsing does not change the URL; the state is stored in a browser cookie (`collapsed_gutter`).

---

## 15a. `/-/merge_requests` — MR list

### Routes & `<title>`

| Route | `<title>` |
|---|---|
| `/:ns/:project/-/merge_requests` | `Merge requests · The A11Y Project / a11yproject.com · GitLab` |
| `/:ns/:project/-/merge_requests?state=opened` (default, same page) | idem |
| `/:ns/:project/-/merge_requests?state=merged` | idem |
| `/:ns/:project/-/merge_requests?state=closed` | idem |
| `/:ns/:project/-/merge_requests?state=all` | idem |
| `/:ns/:project/-/merge_requests?page=2&state=all` | idem |
| `/:ns/:project/-/merge_requests/new` | `New merge request · The A11Y Project / a11yproject.com · GitLab` |
| `/:ns/:project/-/merge_requests.atom?feed_token=<token>&state=opened` | RSS (not HTML) |

Title pattern: `Merge requests · <Group Name> / <project name> · GitLab`.
For `primer/design`: `Merge requests · Primer / design · GitLab`.
For `byteblaze/dotfiles`: `Merge requests · Byte Blaze / dotfiles · GitLab`.

**ANCHOR routes** — `/a11yproject/a11yproject.com/-/merge_requests` (ANCHOR, webarena-668, 806)
and `/primer/design/-/merge_requests` (ANCHOR, webarena-666, 667). Both are used as
`reference_url` for `url_match` *and* as the starting point for a **create-MR** flow
(see 15b `### /-/merge_requests/new`) — the graders then read
`.detail-page-description > a.gl-font-monospace` and `.block.reviewer` on the *resulting*
MR page. So both the list page AND the new-MR flow must work for those two projects.

### Box structure

Standard project page: `.navbar-gitlab` 0/1920/48, `.nav-sidebar` 0/256,
`.content-wrapper` 256/1664, breadcrumbs `.container-fluid.container-limited` 448–593/990,
`#content-body` 609/958. No right sidebar.

Breadcrumb: `The A11Y Project › a11yproject.com › Merge requests`
(hrefs `/a11yproject`, `/a11yproject/a11yproject.com`, `/a11yproject/a11yproject.com/-/merge_requests`).
Left-sidebar item `Merge requests` is active and carries the **open** count badge
(`10` for a11yproject, `16` for primer/design, `0` for dotfiles).

Vertical order inside `#content-body`:
1. `div.top-area` — state tabs (left) + `div.nav-controls` (right)
2. `div.issues-filters` → `form.filter-form.js-filter-form.w-100` — `Recent searches` dropdown + filtered-search input + `.filter-dropdown-container` (sort dropdown + reverse-sort icon button)
3. bulk-edit sidebar (hidden until `Edit merge requests` is clicked)
4. `ul.content-list.mr-list.issuable-list` → `li.merge-request` rows
5. `div.gl-pagination.gl-mt-3` (only when > 20 results)

### State tabs — `div.top-area > ul.issues-state-filters.gl-border-b-0.gl-flex-grow-1.nav.gl-tabs-nav`

Each tab is `li.nav-item > a.nav-link.gl-tab-nav-item` (active tab adds
`active gl-tab-nav-item-active`), with `id`, `data-state`, `title`, and a count badge
`span.gl-badge.badge.badge-pill.badge-muted.sm.gl-tab-counter-badge.gl-display-none.gl-sm-display-inline-flex`.

| Label | `id` | `data-state` | href | `title=` tooltip |
|---|---|---|---|---|
| `Open` | `state-opened` | `opened` | `…/-/merge_requests?state=opened` | `Filter by merge requests that are currently open.` |
| `Merged` | `state-merged` | `merged` | `…/-/merge_requests?state=merged` | `Filter by merge requests that are currently merged.` |
| `Closed` | `state-closed` | `closed` | `…/-/merge_requests?state=closed` | `Filter by merge requests that are currently closed and unmerged.` |
| `All` | `state-all` | `all` | `…/-/merge_requests?state=all` | `Show all merge requests.` |

Real counts (must match exactly):

| Project | Open | Merged | Closed | All |
|---|---|---|---|---|
| `a11yproject/a11yproject.com` (ANCHOR) | `10` | `816` | `87` | `913` |
| `primer/design` (ANCHOR) | `16` | `295` | `82` | `393` |
| `byteblaze/empathy-prompts` | `2` | `1` | `1` | `4` |
| `byteblaze/a11y-webring.club` | `1` | `78` | `7` | `86` |
| `byteblaze/dotfiles` | 0 → whole tab strip + filter bar is **not rendered**, only the empty state |

### `div.nav-controls` (right of the tabs), left→right

1. `a.gl-button.btn.btn-md.btn-default.has-tooltip` `data-testid="rss-feed-link"`
   `aria-label="Subscribe to RSS feed"`, `href="/…/-/merge_requests.atom?feed_token=TMN_bBn9Z48qVbUFZV45&state=opened"`,
   icon `data-testid="rss-icon"`, visible text `Subscribe to RSS feed`.
2. `div.gl-mr-3 > div.btn-group[role=group] > button.btn.btn-default.btn-md.gl-button.btn-icon`
   `aria-label="Export as CSV"`, `data-qa-selector="export_as_csv_button"`, icon `data-testid="export-icon"`,
   **no visible text** (icon only). Opens a modal:
   - heading `Export merge requests`
   - `10 merge requests selected`
   - body `The CSV export will be created in the background. Once finished, it will be sent to ericwbailey@fakegithub.com in an attachment.`
   - buttons `Cancel`, `Export merge requests`
3. `button.gl-button.btn.btn-md.btn-default.gl-mr-3.js-bulk-update-toggle[type=submit]` text `Edit merge requests`.
   Toggles the bulk-edit right panel (does **not** change the URL). Panel contents:
   `Update all`, `Cancel`, then labelled selects `Status` → `Select status` (options `Open` / `Closed`),
   `Assignee` → `Select assignee` (dropdown title `Assign to`, search placeholder `Search authors`),
   `Labels` → `Select labels` (dropdown title `Apply a label`, placeholder `Search`),
   `Milestone` → `Select milestone`, `Subscriptions` → `Select subscription`
   (dropdown title `Change subscription`, options `Subscribe` / `Unsubscribe`).
   It also un-hides a `Select all` checkbox (`#check-all-issues`) and per-row checkboxes
   (`div.issue-check.gl-mr-3.hidden` → `input#selected_merge_request_<id>`).
4. `a.gl-button.btn.btn-md.btn-confirm` text `New merge request`, href `/…/-/merge_requests/new`.

### Filtered-search bar

`form.filter-form.js-filter-form.w-100[method=get][action="/…/-/merge_requests?"]` containing
`div.issues-other-filters.filtered-search-wrapper`:

- `div.dropdown.filtered-search-history-dropdown-wrapper` → button text `Recent searches`
  (mobile shows an icon). Empty-state inside: `You don't have any recent searches`.
- `div.filtered-search-box-input-container` → `input#filtered-search-merge_requests.form-control.filtered-search`
  with **placeholder `Search or filter results...`**.
- `button.clear-search.hidden` with `data-testid="close-icon"`.

**Token hint dropdown (`#js-dropdown-hint`) — the tokens actually offered, in order:**

`Author`, `Assignee`, `Reviewer`, `Approved-By`, `Milestone`, `Release`, `Label`,
`My-Reaction`, `Draft`, `Target-Branch`, `Environment`, `Deployed-before`,
`Deployed-after`, `Search for this text`

> **There is NO `Source-Branch` token.** `Target-Branch` exists, `Source-Branch` does not.
> There is also no `Confidential` token on MRs (that dropdown markup exists in the DOM but is
> not offered in the hint list).

Per-token dropdowns present in the DOM: `#js-dropdown-author`, `#js-dropdown-assignee`,
`#js-dropdown-reviewer`, `#js-dropdown-approved-by`, `#js-dropdown-milestone`,
`#js-dropdown-release`, `#js-dropdown-label`, `#js-dropdown-my-reaction`,
`#js-dropdown-wip`, `#js-dropdown-confidential`, `#js-dropdown-target-branch`,
`#js-dropdown-environment`. User dropdowns list `Byte Blaze / @byteblaze` first plus the
static rows `None` and `Any`; milestone dropdown adds `Upcoming` and `Started`;
Draft/`wip` dropdown offers `Yes` / `No`.

Applied tokens render as `.filtered-search-token` with text like
`Assignee = Byte Blaze`, `Reviewer = Byte Blaze`, `Label = ~javascript`,
`Target-Branch = main`, `Milestone = None`.

**Query parameters — verified live on `/a11yproject/a11yproject.com/-/merge_requests`:**

| Param | Example | Works? | Notes |
|---|---|---|---|
| `state` | `?state=opened|merged|closed|all` | yes | drives the tabs |
| `scope` | `?scope=all` | yes | emitted together with assignee/reviewer |
| `assignee_username` | `?scope=all&state=opened&assignee_username=byteblaze` | yes (2 rows) | token `Assignee = Byte Blaze` |
| `reviewer_username` | `?scope=all&state=opened&reviewer_username=byteblaze` | yes (5 rows) | token `Reviewer = Byte Blaze` |
| `label_name[]` | `?label_name%5B%5D=javascript` | yes (3 rows) | token `Label = ~javascript`; repeatable |
| `milestone_title` | `?milestone_title=None&state=all` | yes | token `Milestone = None` |
| `target_branch` | `?target_branch=main&state=all` | yes | token `Target-Branch = main` |
| `search` | `?search=zzzznotfound` | yes | free-text; empty result → “no results” state |
| `sort` | see table below | yes | |
| `page` | `?page=2&state=all` | yes | |
| **`source_branch`** | `?source_branch=redesign&state=all` | **NO** | ignored — returns the unfiltered page and produces **no** token. Do not implement. |
| `approved_by_usernames[]`, `author_username`, `my_reaction_emoji`, `draft`, `environment`, `deployed_before`, `deployed_after`, `release_tag` | | present as tokens | not exercised by any anchor |

Row-label links use `?label_name%5B%5D=<label>` (no `state`), e.g.
`/a11yproject/a11yproject.com/-/merge_requests?label_name%5B%5D=checklist`.

### Sort dropdown

`div.filter-dropdown-container` → `div.btn-group[role=group]` →
`div.gl-dropdown.dropdown.btn-group.b-dropdown.js-redirect-listbox`
→ toggle `button.btn.btn-default.btn-md.gl-button.gl-dropdown-toggle.dropdown-toggle`
`data-testid="base-dropdown-toggle"` with label span `.gl-dropdown-button-text`.
Default label: **`Created date`**. Menu is `ul#listbox[role=listbox]` of
`li.gl-dropdown-item.gl-listbox-item[role=option]`; the selected one gets `aria-selected="true"`
and a visible check icon (`data-testid="dropdown-item-checkbox"`).

Every option verbatim, in DOM order, with the URL it navigates to (verified by clicking each):

| Label | Resulting URL |
|---|---|
| `Priority` | `?sort=priority` |
| `Created date` | `?sort=created_date` |
| `Closed date` | `?sort=closed_at` |
| `Updated date` | `?sort=updated_desc` |
| `Milestone due date` | `?sort=milestone` |
| `Popularity` | `?sort=popularity` |
| `Label priority` | `?sort=label_priority` |
| **`Merged date`** (MR-only) | **`?sort=merged_at`** |
| `Title` | `?sort=title_asc` |

Next to it: `a.gl-button.btn.btn-default.btn-icon.has-tooltip.reverse-sort-btn.rspec-reverse-sort`
with `title="Sort direction"` and `href="/…/-/merge_requests?sort=created_asc"` (i.e. it flips
the current sort key’s direction; with `state=all` it is `?sort=created_asc&state=all`).
Icon `data-testid="sort-highest-icon"` / `sort-lowest-icon`.

> Note: GitLab’s MR-list issuable-sort widget shows `Merged date` even on the Open tab.
> The `merged_at_desc` value referenced in some docs is **not** what this build emits —
> it emits `merged_at`. Record `?sort=merged_at`.

### Row anatomy — `ul.content-list.mr-list.issuable-list > li.merge-request`

`li.merge-request` carries `id="merge_request_<internal id>"`, `data-id="<internal id>"`,
`data-labels="[1757, 1771, 1772]"` (array of label ids, `[]` when none).
Merged rows add class `merged`; closed rows add class `closed`.

```
li.merge-request#merge_request_72594[data-id][data-labels]
├── div.issue-check.gl-mr-3.hidden
│   └── div.gl-form-checkbox.custom-control.custom-checkbox
│       ├── input#selected_merge_request_72594.custom-control-input[type=checkbox][name=selected_merge_request_72594][data-id]
│       └── label.custom-control-label > span > span.gl-sr-only  → the MR title
└── div.issuable-info-container
    ├── div.issuable-main-info
    │   ├── div.merge-request-title.title
    │   │   ├── span.merge-request-title-text.js-onboarding-mr-item
    │   │   │   └── a.js-prefetch-document[href="/…/-/merge_requests/1531"]  → title text
    │   │   └── span.task-status.d-none.d-sm-inline-block      (only when the description has a checklist)
    │   └── div.issuable-info
    │       ├── span.issuable-reference                        → "!1531"
    │       ├── span.issuable-authored.d-none.d-sm-inline-block
    │       │     "·\ncreated <time …>3 years ago</time> by <a.author-link.js-user-link><span.author>David A. Kennedy</span></a>"
    │       ├── span.project-ref-path.has-tooltip[title="Target branch"]   (ONLY when target ≠ default branch)
    │       │   └── a.ref-name[href="/…/-/commits/gh-pages"] > svg.s12.fork-sprite[data-testid=branch-icon] + "gh-pages"
    │       └── span.gl-label.gl-label-sm × N
    │           └── a.gl-link.gl-label-link[href="…?label_name%5B%5D=checklist"]
    │               └── span.gl-label-text.gl-label-text-dark|gl-label-text-light[style="background-color: #e2fed2"]
    └── div.issuable-meta
        ├── ul.controls.d-flex.align-items-end
        │   ├── li.issuable-pipeline-status.d-none.d-sm-flex          (pipeline icon)
        │   ├── li.issuable-status.d-none.d-sm-inline-block           (MERGED / CLOSED, list-state rows only)
        │   ├── li.gl-display-flex.gl-align-items-center              (assignee avatars)
        │   ├── li.gl-display-flex.issuable-reviewers                 (reviewer avatars)
        │   ├── li.d-none.d-sm-inline-block.has-tooltip.text-success  ("Approved")
        │   └── li.gl-display-none.gl-sm-display-block                (comment bubble)
        └── div.float-right.issuable-updated-at.d-none.d-sm-inline-block
            └── span > "updated <time class='js-timeago merge_request_updated_ago' …>3 years ago</time>"
```

Field-by-field:

| Field | DOM | Verbatim example |
|---|---|---|
| Title | `a.js-prefetch-document` inside `span.merge-request-title-text.js-onboarding-mr-item` inside `div.merge-request-title.title` | `Add draft of What is Semantic HTML post` |
| Checklist progress | `span.task-status.d-none.d-sm-inline-block` (leading `&nbsp;`) | `9 of 11 checklist items completed`, `4 of 4 checklist items completed`, `0 of 8 checklist items completed` |
| Reference | `span.issuable-reference` | `!1531` |
| Authored line | `span.issuable-authored.d-none.d-sm-inline-block`, literally `·` then `created ` then `<time>` then ` by ` then author link | `· created 3 years ago by David A. Kennedy` |
| Author link | `a.author-link.js-user-link[data-user-id][data-username][data-name][href="/davidakennedy"] > span.author` | `David A. Kennedy` |
| Target-branch chip | `span.project-ref-path.has-tooltip[title="Target branch"] > a.ref-name` — **rendered only when the target branch is NOT the project default branch**; none of the 10 open a11yproject MRs show it (all target `main`), but every merged/closed `gh-pages` MR does | `gh-pages` |
| Pipeline | `li.issuable-pipeline-status` → `a.ci-status-link.ci-status-icon.ci-status-icon-failed.has-tooltip.d-flex[title="Pipeline: failed"][data-placement=left][href="/…/-/pipelines/1820"]` with `svg.s16[data-testid="status_failed-icon"]` | tooltip `Pipeline: failed` |
| Merge-conflict warning | `a.has-tooltip[title="Cannot be merged automatically"][href="/…/-/merge_requests/1485"]` with a warning triangle icon, sits in the same `ul.controls` | tooltip `Cannot be merged automatically` |
| Assignee avatars | `li.gl-display-flex.gl-align-items-center` → `a.author-link.has-tooltip[data-qa-selector="assignee_link"][title="Assigned to Roshan Jossy"]` → `img.avatar.avatar-inline.s16[width=16]` (gravatar `?s=32&d=identicon`) | tooltip `Assigned to Roshan Jossy` |
| Reviewer avatars | `li.gl-display-flex.issuable-reviewers` → same `a.author-link.has-tooltip[data-qa-selector="assignee_link"]` but `title="Review requested from Byte Blaze"` | tooltip `Review requested from EJ Mason` |
| Approvals | `li.d-none.d-sm-inline-block.has-tooltip.text-success` → `svg.s16.align-middle[data-testid="approval-icon"]` or `[data-testid="approval-solid-icon"]` + text `Approved`. Tooltips seen: `1 approver`, `1 approver (you've approved)` (solid icon = you approved) | `Approved` |
| Comment bubble | `li.gl-display-none.gl-sm-display-block` → `a.has-tooltip[title="Comments"][data-testid="issuable-comments"][href="/…/-/merge_requests/1531#notes"]` with `svg.s16.gl-vertical-align-text-bottom[data-testid="comments-icon"]` + count. When count is 0 the `<a>` gets the extra class `no-comments` | `0`, `26`, `50` |
| Milestone | `span.issuable-milestone` — **never rendered in this dataset** (0 MRs across a11yproject, primer/design, empathy-prompts, a11y-webring have a milestone) | — |
| List-state badge | `li.issuable-status.d-none.d-sm-inline-block` — merged rows: plain text `MERGED` (no icon); closed rows: `svg.s16.gl-vertical-align-text-bottom[data-testid="cancel-icon"]` + `CLOSED` | `MERGED` / `CLOSED` |
| Updated | `div.float-right.issuable-updated-at.d-none.d-sm-inline-block > span` → `updated <time class="js-timeago merge_request_updated_ago">…</time>` | `updated 3 years ago` |

### Relative-time format

Both `<time>` elements in a row use the *relative* rendering (`3 years ago`, `5 years ago`,
`6 years ago`, `11 years ago`) via `class="js-timeago"` + Bootstrap tooltip attrs
`data-toggle="tooltip" data-placement="bottom" data-container="body"`.

- `title` attribute = **local-time absolute**, e.g. `title="Mar 18, 2023 7:00pm PDT"`,
  `title="Nov 30, 2022 12:47am PST"`, `title="Mar 27, 2023 11:37am PDT"`.
  Format: `MMM D, YYYY h:mma ZZZ` (America/Los_Angeles, so `PDT`/`PST` — **not** UTC).
- `datetime` attribute = ISO-8601 UTC with `Z`, e.g. `datetime="2023-03-19T02:00:38Z"`.
- The updated `<time>` additionally has class `merge_request_updated_ago`.

### Pagination

Only rendered when > 20 rows. `div.gl-pagination.gl-mt-3 > ul.pagination.justify-content-center`:

```
li.page-item.js-previous-button.disabled  > a.page-link[rel=prev][href="#"]  svg[data-testid=chevron-lg-left-icon] + "Prev"
li.page-item.js-pagination-page.active.js-first-button > a.page-link.active[href="/…/-/merge_requests?state=all"] "1"
li.page-item.js-pagination-page.sibling.d-none.d-md-block > a.page-link[rel=next][href="…?page=2&state=all"] "2"
li.page-item.js-pagination-page.d-none.d-md-block  → "3" "4" "5"
li.page-item.disabled.d-none.d-md-block > a.page-link[href="#"] "…"
li.page-item.js-pagination-page.js-last-button.d-none.d-md-block > a.page-link[href="…?page=46&state=all"] "46"
li.page-item.js-next-button > a.page-link[rel=next][href="…?page=2&state=all"] "Next" + svg[data-testid=chevron-lg-right-icon]
```

Page size is **20**. `a11yproject ?state=all` → 913 MRs → 46 pages.
Labels verbatim: `Prev`, `…`, `Next`.

### Empty states (verbatim)

**A. Project has zero merge requests** (`/byteblaze/dotfiles/-/merge_requests`) — the tab strip,
the filter bar and the sort dropdown are **all absent**; `#content-body` contains only:

```html
<div class="row empty-state merge-requests">
  <div class="col-12"><div class="svg-content">
    <img class="js-lazy-loaded" src="/assets/illustrations/merge_requests-1738c3fb…svg" loading="lazy">
  </div></div>
  <div class="col-12"><div class="text-content">
    <h4>Merge requests are a place to propose changes you've made to a project and discuss those changes with others</h4>
    <p>Interested parties can even contribute by pushing commits if they want to.</p>
    <div class="text-center">
      <a class="gl-button btn btn-confirm" title="New merge request" id="new_merge_request_link"
         data-qa-selector="new_merge_request_button" href="/byteblaze/dotfiles/-/merge_requests/new">New merge request</a>
    </div>
  </div></div>
</div>
```

Heading verbatim: `Merge requests are a place to propose changes you've made to a project and discuss those changes with others`
Body verbatim: `Interested parties can even contribute by pushing commits if they want to.`

**B. Filter produced no results** (e.g. `?search=zzzznotfound`) — tabs remain (all counts show `0`),
same `div.row.empty-state.merge-requests` wrapper but centred text and no `id`/`data-qa-selector`
on the button:

```
<h4 class="text-center">Sorry, your filter produced no results</h4>
<p class="text-center">To widen your search, change or remove filters above</p>
<a class="gl-button btn btn-confirm" title="New merge request" href="/…/-/merge_requests/new">New merge request</a>
```

### Anchor content check — what actually renders

**`/a11yproject/a11yproject.com/-/merge_requests`** (ANCHOR, webarena-668, 806) — Open tab,
sorted by Created date desc, exactly these 10 rows in this order:

| # | Title | Ref | created | author | labels | pipeline | assignee | reviewers | approvals | comments | updated |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `Add draft of What is Semantic HTML post` | `!1531` | 3 years ago | `David A. Kennedy` | — | failed (#1820) | `Roshan Jossy` | — | — | `0` | 3 years ago |
| 2 | `WIP - Post: Pitfalls of accessible components` | `!1490` | 3 years ago | `Erik Kroes` | — | failed (#1818) | — | `Byte Blaze` | — | `26` | 3 years ago |
| 3 | `update or remove 404 links` | `!1485` | 3 years ago | `Roshan Jossy` | — | failed (#1819) + `Cannot be merged automatically` | `Byte Blaze` | — | — | `0` | 3 years ago |
| 4 | `How to: Article how to make an accessible nav with dropdowns` | `!1472` | 3 years ago | `James Bateson` | — | failed (#1817) | — | `James Bateson`, `Byte Blaze` | — | `50` | 3 years ago |
| 5 | `Feat/toggle checklist groups` | `!1280` | 5 years ago | `rachel fischoff` | `checklist` `javascript` `markup` | failed (#1815) | — | `rachel fischoff`, `Byte Blaze`, `EJ Mason` | `Approved` (`1 approver (you've approved)`) | `22` | 3 years ago |
| 6 | `feat: add WCAG levels` | `!1270` | 5 years ago | `Agustina Chaer` | `data` `javascript` `markup` `styling` | failed (#1816) + `Cannot be merged automatically` | `Byte Blaze` | `Byte Blaze`, `Agustina Chaer`, `EJ Mason` | — | `17` | 3 years ago |
| 7 | `Fix card focus edge cases` | `!1265` | 5 years ago | `EJ Mason` | `accessibility` `styling` | `Cannot be merged automatically` | `EJ Mason` | `Byte Blaze` | — | `1` | 3 years ago |
| 8 | `Add environment variables to project` | `!1178` | 5 years ago | `Dan Matthew` | `javascript` `markup` `node` | failed (#1814) + `Cannot be merged automatically` | — | `Dan Matthew` | — | `4` | 3 years ago |
| 9 | `Remove Gulp in Favor of NPM CLI` | `!1141` | 5 years ago | `Wayne Elgin` | — | `Cannot be merged automatically` | — | — | — | `1` | 5 years ago |
| 10 | `Add color utility classes` | `!1071` | 5 years ago | `Byte Blaze` | — | `Cannot be merged automatically` | — | — | — | `0` | 5 years ago |

Anchor strings reachable from here: `main` (ANCHOR, webarena-668) and
`feature/markdown-figure-block` (ANCHOR, webarena-806) are **branch names**, not list text —
they must exist in the project’s branch list and be selectable in `/-/merge_requests/new`.
`redesign` (ANCHOR, webarena-668, 806) likewise. `Roshan Jossy` (ANCHOR, webarena-668)
**does** render on this list (author of `!1485`, assignee of `!1531`) and must exist as a
reviewer-assignable user. `Byte Blaze` (ANCHOR, webarena-806) renders as author of `!1071`.

**`/primer/design/-/merge_requests`** (ANCHOR, webarena-666, 667) — Open tab, 16 rows,
first 14 in order:

| # | Title | Ref | created | author | extras |
|---|---|---|---|---|---|
| 1 | `Octovisuals Page` | `!450` | 3 years ago | `Josh Bowden` | comments `2` |
| 2 | `Add NavList interface guidelines` | `!448` | 3 years ago | `Mike Perrotti` | reviewer `Emily Brick`; `Approved` (`1 approver`); comments `4` |
| 3 | `Integrate Primer Bot into the docs` | `!446` | 3 years ago | `Cole Bemis` | label `status: blocked :construction:`; comments `1` |
| 4 | `Add IconButton to interface guidelines` | `!444` | 3 years ago | `Mike Perrotti` | `Approved`; comments `2` |
| 5 | `Color docs` | `!424` | 3 years ago | `Katie Langerman` | comments `0` |
| 6 | `[WIP] starting to add figma to new docs` | `!404` | 3 years ago | `Lukas Oppermann` | task-status `9 of 11 checklist items completed`; label `figma`; assignee `Daniel Guillan`; reviewers `Cole Bemis`,`Emily Brick`,`Daniel Guillan`,`Josep Martins`; comments `4` |
| 7 | `Improve build time` | `!390` | 3 years ago | `Cole Bemis` | comments `0` |
| 8 | `Automate figma docs from json` | `!349` | 3 years ago | `Lukas Oppermann` | task-status `4 of 4 checklist items completed`; comments `4` |
| 9 | `Update descriptive-buttons.mdx` | `!303` | 3 years ago | `Mujahid Bappai` | comments `4` |
| 10 | `[WIP] Single page component docs prototype` | `!294` | 3 years ago | `Katie Langerman` | comments `9` |
| 11 | ``Chore: fix variant suffix and grammar error at `/design/foundations/color` `` | `!204` | 4 years ago | `Matt` | comments `1` |
| 12 | `Improve blankslate documentation` | `!202` | 4 years ago | `Allie Thu` | comments `3` |
| 13 | `Button component interface guidelines` | `!193` | 4 years ago | `Pavithra Kodmad` | task-status `0 of 8 checklist items completed`; comments `43` |
| 14 | `Add truncated token input example` | — | 4 years ago | — | (below the fold) |

Anchor strings for webarena-666/667: `Primer` (must_include on `.block.reviewer`) means the
**group `Primer` must be assignable as a reviewer** — it is reachable because the reviewer
dropdown lists project members. `dialog`, `dialog-component`, `bump-doctocat` (ANCHOR) are
**branches of `primer/design`** — all three verified present in `/primer/design/refs`
(full branch list: `a11y/context-menu-accessibility-docs`, `adrianmg-img-fix-pewpew`,
`alliethu-update-accessibility-docs`, `autocomplete-updates`, `bs/format-fix`,
**`bump-doctocat`**, `consolidated-docs-prototype`, `debug-build-time`, **`dialog`**,
**`dialog-component`**, `feature/move-about`, `figma-docs`,
`github/fork/TheeMattOliver/chore-spelling-subtle-color`, `github/fork/mbappai/patch-2`,
`github/fork/superbryntendo/danger`, `layout-docs`, `link-docs`, `main`, `mp/buttongroup`,
`mp/icon-button`, `mp/nav-list-docs`, `mp/save-patterns`, `mp/truncated-token-input`,
`new-IA-figma`, `octovisuals-page`, `overlay`, `pk/button-component`, `primer-bot`,
`primitive-docs`, `rails_components`, `rezrah/github-pages-deployment`, `sid/test`,
`single-page-component-docs`, `underline-nav-interface-guidelines`, `update-blankslate`,
`update-buttons-docs`, `users/yaili/spacing-doc`, `yaili-patch-1`).

`a11yproject/a11yproject.com` full branch list (needed for webarena-668/806):
`add-color-utility-classes`, `chore/add-vscode-settings`, `feature/markdown-figure`,
**`feature/markdown-figure-block`**, `feature/replace-gulp`, `fix/card-focus-edge-cases`,
`github/fork/Roshanjossey/1478-fix-404-urls`, `github/fork/aguscha333/feat/add-wcag-levels`,
`github/fork/danielmatthew/add-env-vars`,
`github/fork/davidakennedy/davidakennedy-semantic-html`,
`github/fork/erikkroes/feature/blog-component-pitfalls`,
`github/fork/jimbateson/Article-HOW-TO-make-an-accessible-nav-with-dropdowns`,
`github/fork/rachel-fischoff/feat/toggle-checklist-groups`, **`main`**, **`redesign`**.

---

## 15b. MR detail page (`/-/merge_requests/:iid`) — header, branch chips, tabs

### Routes & `<title>`

| Route | `<title>` |
|---|---|
| `/:ns/:project/-/merge_requests/:iid` | `Add draft of What is Semantic HTML post (!1531) · Merge requests · The A11Y Project / a11yproject.com · GitLab` |
| `…/:iid/commits` | same |
| `…/:iid/pipelines` | same |
| `…/:iid/diffs` | same |
| `…/:iid/edit` | edit form (not covered here) |
| `…/:iid.patch`, `…/:iid.diff` | raw downloads |

Title pattern: `<MR title> (!<iid>) · Merge requests · <Group> / <project> · GitLab`.
Breadcrumb: `The A11Y Project › a11yproject.com › Merge requests › !1531` (last crumb is the
bare reference `!1531`, bold, not a link on the current page).

Anchor routes: `/a11yproject/a11yproject.com/-/merge_requests/1071` (ANCHOR, webarena-392),
`/1265` (ANCHOR, webarena-391), `/1270` (ANCHOR, webarena-416), `/1485` (ANCHOR, webarena-417),
`/1531` (ANCHOR, webarena-390), `/byteblaze/a11y-webring.club/-/merge_requests/40`
(ANCHOR, webarena-415), `/byteblaze/empathy-prompts/-/merge_requests/19` (ANCHOR, webarena-393),
`/primer/design/-/merge_requests/450` (ANCHOR, webarena-389).

### Box structure (measured live @1920×1080)

| Element | x | width |
|---|---|---|
| `#content-body` | **464** | **958** |
| `.issuable-details` | **464** | **958** |
| `.detail-page-description` | 464 | 958 |
| `.merge-request-tabs-container` | 464 | 958 |
| `.right-sidebar.js-right-sidebar.js-issuable-sidebar.right-sidebar-expanded` | **1630** | **290** |

Note the MR/issue detail page **is not** container-limited: `#content-body` starts at 464,
not the 609 used on other project pages.

Vertical order of `.issuable-details`:
`.detail-page-header` → `.detail-page-description` (branch line) → `.merge-request-tabs-container`
→ `#diff-notes-app` / `.issuable-discussion` (MR description markdown + award emoji block)
→ `.mr-state-widget` → `Activity` heading + `Sort or filter` → `ul#notes-list` → comment form.

### `.detail-page-header`

```html
<div class="detail-page-header border-bottom-0 pt-0 pb-0 gl-display-block gl-md-display-flex!">
  <div class="detail-page-header-body">
    <div class="issuable-meta gl-display-flex">
      <div class="gl-display-inline-block"></div>
      <h1 class="title page-title gl-font-size-h-display gl-my-0 gl-display-inline-block"
          data-qa-selector="title_content">Octovisuals Page</h1>
    </div>
    <div><button class="…gutter-toggle issuable-gutter-toggle js-sidebar-toggle gl-sm-display-none!"
                 type="button"><svg data-testid="chevron-double-lg-left-icon"></button></div>
  </div>
  <div class="detail-page-header-actions gl-align-self-start is-merge-request js-issuable-actions gl-display-flex">…</div>
</div>
```

**`[data-qa-selector="title_content"]` DOES exist on MRs** — it is the `<h1.title.page-title>`
holding the MR title. Verified on `!450` → `Octovisuals Page`, `!1531` →
`Add draft of What is Semantic HTML post`, `!1265` → `Fix card focus edge cases`,
`!1270` → `feat: add WCAG levels`, `!1485` → `update or remove 404 links`,
`!1071` → `Add color utility classes`, `!19` → `Fix broken link`, `!40` → `Add verification functions`.
(The `title_content` anchor in `task_anchors.md` is registered for issues, but the selector is
identical on MRs — keep it.)

> **The status badge is NOT in the header.** It lives at the start of `.detail-page-description`
> (see below). `.detail-page-header` contains only the title + the sidebar-toggle + the actions.

**`.detail-page-header-actions` buttons, left→right:**

1. `a.gl-display-none.gl-md-display-block.btn.gl-button.btn-default.js-issuable-edit`
   `data-qa-selector="edit_button"` href `/…/-/merge_requests/450/edit` → text `Edit`
2. `Code` dropdown — `button.btn.dropdown-toggle.btn-confirm.gl-button.gl-dropdown-toggle`
   `data-toggle="dropdown"` `data-qa-selector="mr_code_dropdown"`, label span
   `.gl-dropdown-button-text` = `Code`, chevron `data-testid="chevron-down-icon"`.
   Menu `div.dropdown-menu.dropdown-menu-right`:
   | item | element |
   |---|---|
   | section header `Review changes` | `li.gl-dropdown-section-header > header.dropdown-header` |
   | `Check out branch` | `li.gl-dropdown-item > button.dropdown-item.js-check-out-modal-trigger` (opens a modal, no navigation) |
   | `Open in Web IDE` | `a.dropdown-item[target=_blank][data-qa-selector="open_in_web_ide_button"]` href `/-/ide/project/primer/design/merge_requests/450` |
   | divider | `li.gl-dropdown-divider > hr.dropdown-divider` |
   | section header `Download` | `li.gl-dropdown-section-header > header.dropdown-header` |
   | `Email patches` | `a.dropdown-item[download][data-qa-selector="download_email_patches_menu_item"]` href `/primer/design/-/merge_requests/450.patch` |
   | `Plain diff` | `a.dropdown-item[download][data-qa-selector="download_plain_diff_menu_item"]` href `/primer/design/-/merge_requests/450.diff` |
3. `⋮` overflow — `div.btn-group.gl-md-ml-3.gl-display-flex.dropdown.gl-dropdown` with two
   toggles: a desktop icon-only one (`data-testid="merge-request-actions"`,
   `data-title="Merge request actions"`, `data-aria-label="Merge request actions"`,
   `svg[data-testid="ellipsis_v-icon"]`) and a mobile full-width one whose visible text is
   `Merge request actions`.
   Menu items **on an open MR**:
   | item | element / href |
   |---|---|
   | `Edit` (mobile only, `gl-md-display-none!`) | `a.dropdown-item` → `/…/450/edit` |
   | `Mark as draft` | `a.dropdown-item.js-draft-toggle-button[rel=nofollow][data-method=put]` → `/…/450?merge_request%5Bwip_event%5D=draft` |
   | `Close merge request` — rendered as two text nodes `Close` + `merge request` inside `div.gl-dropdown-item-text-wrapper`, so `innerText` is `"Close\nmerge request"` | `li.gl-dropdown-item.js-close-item > a.dropdown-item[rel=nofollow][data-method=put]` → `/…/450?merge_request%5Bstate_event%5D=close` |
   | `Report abuse to administrator` | `a.dropdown-item` → `/-/abuse_reports/new?ref_url=<encoded MR url>&user_id=2368` |
   On a **merged** MR the close item is gone (items: `Edit`, `Report abuse to administrator`).
   On a **closed** MR it becomes `Reopen merge request`.

`.detail-page-header-actions` `outerText` on an open, merged and closed MR is `Edit\nCode`
(the ⋮ toggle contributes no text on desktop).

### `.detail-page-description` and the branch chips — **CRITICAL ANCHOR**

On a merge request `.detail-page-description` is **not** the description body; it is the
one-line “requested to merge” banner. Exact element:

```html
<div class="detail-page-description py-2 gl-display-flex gl-align-items-center gl-flex-wrap">
  <span class="badge issuable-status-badge gl-mr-3 badge-success badge-pill gl-badge md issuable-status-badge-open gl-vertical-align-bottom">
    <svg data-testid="merge-request-open-icon" role="img" aria-hidden="true" class="gl-icon s16">…</svg>
    <span class="gl-display-none gl-sm-display-block gl-ml-2">Open</span>
  </span>
  <a class="author-link gl-font-weight-bold gl-mr-2 js-user-link"
     data-user-id="2368" data-username="JoshBowdenConcepts" data-name="Josh Bowden"
     href="/JoshBowdenConcepts"><span class="author">Josh Bowden</span></a>
  requested to merge
  <a title="octovisuals-page"
     class="gl-text-blue-500! gl-font-monospace gl-bg-blue-50 gl-rounded-base gl-font-sm gl-px-2 gl-display-inline-block gl-text-truncate gl-max-w-26 gl-mx-2"
     href="/primer/design/-/tree/octovisuals-page">octovisuals-page</a>
  <button class="btn btn btn-default btn-sm gl-button btn-default-tertiary btn-icon gl-display-none! gl-md-display-inline-block! js-source-branch-copy"
          data-toggle="tooltip" data-placement="bottom" data-container="body"
          data-title="Copy branch name" data-clipboard-text="octovisuals-page"
          type="button" title="Copy branch name" aria-label="Copy branch name" aria-live="polite">
    <svg class="s16 gl-icon" data-testid="copy-to-clipboard-icon">…</svg>
  </button>
  into
  <a title="main"
     class="gl-text-blue-500! gl-font-monospace gl-bg-blue-50 gl-rounded-base gl-font-sm gl-px-2 gl-display-inline-block gl-text-truncate gl-max-w-26 gl-mx-2"
     href="/primer/design/-/tree/main">main</a>
  <time class="js-timeago gl-display-inline-block" title="Mar 23, 2023 7:46am PDT"
        datetime="2023-03-23T14:46:57Z" data-toggle="tooltip" data-placement="top"
        data-container="body">3 years ago</time>
</div>
```

Verbatim sentence (note the **lowercase** `requested`, and the literal words `into`):

> `<Author Display Name> requested to merge <source-branch> into <target-branch> <relative time>`

**Full class list on both branch anchors (identical string, copy it exactly):**

```
gl-text-blue-500! gl-font-monospace gl-bg-blue-50 gl-rounded-base gl-font-sm gl-px-2 gl-display-inline-block gl-text-truncate gl-max-w-26 gl-mx-2
```

Both anchors carry `title="<full branch name>"` and `href="/<ns>/<project>/-/tree/<branch>"`.
The visual ellipsis (`github/fork/davidakennedy/…`) is **pure CSS** (`gl-text-truncate` +
`gl-max-w-26`); `outerText`/`innerText` still return the **full** branch name.

**Copy buttons:** there is exactly **one** copy button, placed *between* the source anchor and
the word `into` — `button.js-source-branch-copy` with
`title="Copy branch name"` / `aria-label="Copy branch name"` / `data-title="Copy branch name"` /
`data-clipboard-text="<source branch>"` and icon `data-testid="copy-to-clipboard-icon"`.
**There is NO copy button after the target branch.** Because it is a `<button>`, not an `<a>`,
it does not disturb the `a.gl-font-monospace` index.

**Index confirmation — `document.querySelectorAll(".detail-page-description > a.gl-font-monospace")`
(ANCHOR, webarena-666, 667, 668, 806):**

- `[0]` = **SOURCE** branch — `.outerText` = the source branch name
- `[1]` = **TARGET** branch — `.outerText` = the target branch name

There are exactly 2 matches; the author link is `a.author-link…js-user-link` (no
`gl-font-monospace`) so it is not matched. **Both anchors must be direct children of
`.detail-page-description`** — the `>` combinator matters.

Verified live:

| Page | `[0].outerText` | `[1].outerText` | `.detail-page-description.outerText` |
|---|---|---|---|
| `/primer/design/-/merge_requests/450` | `octovisuals-page` | `main` | `Open\nJosh Bowden\nrequested to merge\noctovisuals-page\ninto\nmain\n3 years ago` |
| `/a11yproject/a11yproject.com/-/merge_requests/1531` | `github/fork/davidakennedy/davidakennedy-semantic-html` | `main` | `Open\nDavid A. Kennedy\nrequested to merge\ngithub/fork/davidakennedy/davidakennedy-semantic-html\ninto\nmain\n3 years ago` |
| `…/1071` | `add-color-utility-classes` | `main` | `Open\nByte Blaze\nrequested to merge\nadd-color-utility-classes\ninto\nmain\n5 years ago` |
| `…/1265` | `fix/card-focus-edge-cases` | `main` | `Open\nEJ Mason\nrequested to merge\nfix/card-focus-edge-cases\ninto\nmain\n5 years ago` |
| `…/1270` | `github/fork/aguscha333/feat/add-wcag-levels` | `main` | `Open\nAgustina Chaer\nrequested to merge\n…\ninto\nmain\n5 years ago` |
| `…/1485` | `github/fork/Roshanjossey/1478-fix-404-urls` | `main` | `Open\nRoshan Jossy\nrequested to merge\n…\ninto\nmain\n3 years ago` |
| `/byteblaze/empathy-prompts/-/merge_requests/19` | `github/fork/matuzo/main` | `main` | `Open\nManuel Matuzovic\nrequested to merge\ngithub/fork/matuzo/main\ninto\nmain\n5 years ago` |
| `/byteblaze/a11y-webring.club/-/merge_requests/40` | `github/fork/davepgreene/add-verification-function` | `main` | `Open\nDave Greene\nrequested to merge\n…\ninto\nmain\n3 years ago` |
| `…/863` (merged, non-default target) | `github/fork/himynameisdave/checklist-typo` | `gh-pages` | `Merged\nAdministrator\nrequested to merge\n…\ninto\ngh-pages\n6 years ago` |
| `…/327` (closed) | `github/fork/joe-watkins/feature/lazyLoadFooter` | `gh-pages` | `Closed\nAdministrator\nrequested to merge\n…\ninto\ngh-pages\n11 years ago` |

**RECORDED REALITY vs the expectation in the brief:** the anchor values
`dialog-component`/`dialog`, `dialog-component`/`bump-doctocat`, `redesign`/`main`,
`redesign`/`feature/markdown-figure-block` do **not** exist on any pre-seeded MR. They are the
*output* of the create-MR tasks (webarena-666/667/668/806): the agent must create a new MR from
the anchor source branch into the anchor target branch, and the resulting MR detail page must
render exactly the DOM above with `[0]` = the chosen source and `[1]` = the chosen target.

### Status badge variants (inside `.detail-page-description`)

| State | classes | icon `data-testid` | text |
|---|---|---|---|
| Open | `badge issuable-status-badge gl-mr-3 badge-success badge-pill gl-badge md issuable-status-badge-open gl-vertical-align-bottom` | `merge-request-open-icon` | `Open` |
| Merged | `badge issuable-status-badge gl-mr-3 badge-info badge-pill gl-badge md issuable-status-badge-merged gl-vertical-align-bottom` | `merge-icon` | `Merged` |
| Closed | `badge issuable-status-badge gl-mr-3 badge-danger badge-pill gl-badge md issuable-status-badge-closed gl-vertical-align-bottom` | `merge-request-close-icon` | `Closed` |

The label text sits in `span.gl-display-none.gl-sm-display-block.gl-ml-2`.
`<time>` in this banner uses `data-placement="top"` (list rows use `bottom`).

### Tab strip

```html
<div class="merge-request-tabs-container gl-display-flex gl-justify-content-space-between">
  <ul class="merge-request-tabs nav-tabs nav nav-links gl-display-flex gl-flex-nowrap gl-m-0 gl-p-0">
    <li class="notes-tab active" data-qa-selector="notes_tab">
      <a data-action="show" data-target="#notes" data-toggle="tabvue"
         href="/a11yproject/a11yproject.com/-/merge_requests/1531">Overview
         <span class="gl-badge badge badge-pill badge-muted sm js-discussions-count">0</span></a></li>
    <li class="commits-tab" data-qa-selector="commits_tab">
      <a data-action="commits" data-target="#commits" data-toggle="tabvue"
         href="…/1531/commits">Commits <span class="gl-badge badge badge-pill badge-muted sm">1</span></a></li>
    <li class="pipelines-tab">
      <a data-action="pipelines" data-target="#pipelines" data-toggle="tabvue"
         href="…/1531/pipelines">Pipelines <span class="gl-badge badge badge-pill badge-muted sm js-pipelines-mr-count">1</span></a></li>
    <li class="diffs-tab js-diffs-tab" data-qa-selector="diffs_tab" id="diffs-tab">
      <a data-action="diffs" data-target="#diffs" data-toggle="tabvue"
         href="…/1531/diffs">Changes <span class="gl-badge badge badge-pill badge-muted sm">2</span></a></li>
  </ul>
  <div class="d-flex flex-wrap align-items-center justify-content-lg-end"></div>
</div>
```

Labels exactly: `Overview`, `Commits`, `Pipelines`, `Changes` (NOT “Diffs”).
Order: Overview, Commits, Pipelines, Changes.
Hrefs: `/-/merge_requests/:iid`, `/-/merge_requests/:iid/commits`,
`/-/merge_requests/:iid/pipelines`, `/-/merge_requests/:iid/diffs`.
Clicking **does** change the URL (`history.pushState`, no full reload) — verified:
Commits → `…/1265/commits`, Pipelines → `…/1265/pipelines`, Changes → `…/1265/diffs`,
Overview → `…/1265`.

Counts observed:

| MR | Overview | Commits | Pipelines | Changes |
|---|---|---|---|---|
| a11y `!1531` | `0` | `1` | `1` | `2` |
| a11y `!1071` | `0` | `5` | `0` | `34` |
| a11y `!1265` | `1` | `1` | `0` | `2` |
| a11y `!1270` | `17` | `6` | `1` | `3` |
| a11y `!1485` | `0` | `1` | `1` | `2` |
| empathy `!19` | `1` | `1` | `1` | `1` |
| webring `!40` | `0` | `4` | `1` | `7` |
| primer `!450` | `2` | `5` | `0` | `5` |

The Overview badge (`js-discussions-count`) counts **user comments/threads only**, not system notes.

### MR description body + award emoji

Directly under the tabs, `div.issuable-discussion.js-vue-notes-event` contains a *second*
`div.detail-page-description.gl-pb-0` (the markdown body) —
`div.description.js-task-list-container.is-task-list-enabled[data-qa-selector="description_content"] > div.md`
plus a hidden `textarea.js-task-list-field`. Then
`div.emoji-block.emoji-list-container.js-noteable-awards` with the two default award buttons
(`👍 0`, `👎 0`, `data-testid="award-button"`, counter span `.js-counter`) and an
`Add reaction` emoji picker (`div.emoji-picker[title="Add reaction"][data-testid="emoji-picker"]`,
`button.add-reaction-button`, `span.gl-sr-only` text `Add reaction`).

> Careful: there are **two** `.detail-page-description` elements on an MR page. The anchor
> selector `.detail-page-description > a.gl-font-monospace` only matches inside the **first**
> (banner) one, because the second contains no direct `a.gl-font-monospace` child. `querySelectorAll`
> still scans both — so make sure the markdown body never emits a direct-child
> `a.gl-font-monospace`. Also note `document.querySelector('.detail-page-description')` returns
> the **banner**, not the body.

If the MR has a description, `!450` renders `Summary` + prose; `!1531` renders `See #1530.`;
`!1071` renders `This PR builds off of https://github.com/a11yproject/a11yproject.com/pull/1053.`

### `/-/merge_requests/new` — the create flow (anchor-critical for webarena-666/667/668/806)

**Step 1 — branch compare.** `GET /:ns/:project/-/merge_requests/new`
(`<title>` `New merge request · The A11Y Project / a11yproject.com · GitLab`,
breadcrumb `… › Merge requests › New`).

`#content-body` text, verbatim:

```
New merge request
Source branch
a11yproject/a11yproject.com
Select source branch
Select a branch to compare
Target branch
a11yproject/a11yproject.com
main
<latest commit on target>
Compare branches and continue
```

DOM: `h1` (page heading, no `.title` class here) `New merge request`, then
`form#new_merge_request.merge-request-form.js-requires-input.gfm-form[method=get][action="/…/-/merge_requests/new"]`
→ `div.js-merge-request-new-compare.row[data-source-branch-url="/…/-/merge_requests/new/branch_from"][data-target-branch-url="/…/-/merge_requests/new/branch_to"]`
with two `div.col-lg-6 > div.card-new-merge-request` columns:

| Column | `h2.gl-font-size-h2` | project dropdown | branch dropdown |
|---|---|---|---|
| left | `Source branch` | `button.dropdown-menu-toggle.js-compare-dropdown.js-source-project` label = project full path, `data-default-text="Select source project"`; menu title `Select source project`, search placeholder `Search projects`; hidden `input#merge_request_source_project_id[name="merge_request[source_project_id]"]` | `button.dropdown-menu-toggle.js-compare-dropdown.js-source-branch.monospace` `data-qa-selector="source_branch_dropdown"` label `Select source branch`; menu title `Select source branch`, search placeholder `Search branches`; hidden `input#merge_request_source_branch[name="merge_request[source_branch]"]` |
| right | `Target branch` | `…js-target-project`, `data-default-text="Select target project"`; menu title `Select target project` | `…js-target-branch.monospace`, label pre-filled with the default branch `main`, `data-selected="main"`; menu title `Select target branch`; hidden `input#merge_request_target_branch[name="merge_request[target_branch]"]` value `main` |

Each column has a `div.gl-bg-gray-50.gl-rounded-base.gl-mx-2.gl-my-4` preview area with
`div.compare-commit-empty.js-source-commit-empty` / `.js-target-commit-empty` whose copy is
`Select a branch to compare`, a loading spinner, and `ul.list-unstyled.mr_source_commit` /
`.mr_target_commit` showing the tip commit (avatar, `a.commit-row-message.item-title`,
`div.committer` = `<author> authored <time>3 years ago</time>`, `Toggle commit description`
expander, GPG `Unverified` badge, short SHA, `Copy commit SHA` button).

Submit: `Compare branches and continue` (`button[type=submit]`, `btn-confirm`).
The form is `method=get`, so it navigates to
`/…/-/merge_requests/new?utf8=✓&merge_request%5Bsource_project_id%5D=174&merge_request%5Bsource_branch%5D=<src>&merge_request%5Btarget_project_id%5D=174&merge_request%5Btarget_branch%5D=<tgt>`.
The minimal working URL is
`/…/-/merge_requests/new?merge_request%5Bsource_branch%5D=redesign&merge_request%5Btarget_branch%5D=main`.

**Step 2 — the MR form.** Same route + the two branch params. `<title>` unchanged.
`#content-body` text, verbatim:

```
New merge request
From redesign into main   Change branches
Title (required)
Remove the Draft prefix from the title to allow this merge request to be merged when it's ready.

Add description templates to help your contributors to communicate effectively!

Description
Write
Preview
…
Supports Markdown. For quick actions, type /.
Assignee
Unassigned
 Assign to me
Reviewer
Unassigned
Milestone
Select milestone
Labels
Labels
Merge options
Delete source branch when merge request is accepted.
Squash commits when merge request is accepted. 
Create merge request
 Cancel
```

`form#new_merge_request.merge-request-form.common-note-form.js-requires-input.js-quick-submit.gfm-form[method=post][action="/…/-/merge_requests"]`:

| Region | Markup / copy |
|---|---|
| Branch selector | `div.form-group.row.d-flex.gl-px-5.branch-selector` → `<span>From <code>redesign</code> into </span><code data-branch-name="main" id="js-target-branch-title">main</code>&nbsp;<a href="…?change_branches=true&merge_request%5Bsource_branch%5D=redesign&merge_request%5Bsource_project_id%5D=174&merge_request%5Btarget_branch%5D=main&merge_request%5Btarget_project_id%5D=174">Change branches</a>` |
| Title | `label[for=merge_request_title]` text `Title (required)`; `input#merge_request_title.form-control.pad[name="merge_request[title]"][required][maxlength=255][data-qa-selector="issuable_form_title_field"][autofocus][size=255][dir=auto]`. **Auto-prefilled** (observed values for the four anchor branch pairs are in the table below). Hint below toggles between `Remove the `Draft` prefix from the title to allow this merge request to be merged when it's ready.` (`div.js-wip-explanation`) and `Start the title with `Draft:` to prevent a merge request draft from merging before it's ready.` (`div.js-no-wip-explanation`), plus `Add description templates to help your contributors to communicate effectively!` |
| Description | `label[for=merge_request_description]` `Description`; `textarea#merge_request_description.note-textarea.rspec-issuable-form-description[name="merge_request[description]"][data-qa-selector="issuable_form_description_field"]` placeholder **`Describe the goal of the changes and what reviewers should be aware of.`**; `Write` / `Preview` tabs; footer `Supports Markdown. For quick actions, type /.` |
| Assignee | `div.form-group.row.merge-request-assignee`, `label[for=merge_request_assignee_id]` `Assignee`; toggle `button.dropdown-menu-toggle.js-user-search.js-assignee-search…` with `data-default-label="Unassigned"`, `data-dropdown-header="Assignee"`, `data-max-select="1"`; menu title `Select assignee`, search placeholder `Search users`. Next to it `a.assign-to-me-link[data-qa-selector="assign_to_me_link"]` text `Assign to me`; hidden `input[name="merge_request[assignee_ids][]"][value="0"]` |
| **Reviewer** | `div.form-group.row.merge-request-reviewer`, `label[for=merge_request_reviewer_id]` **`Reviewer`**; toggle `button.dropdown-menu-toggle.js-reviewer-search.js-multiselect.js-save-user-data` `data-default-label="Unassigned"`, `data-dropdown-header="Reviewer"`, `data-max-select="1"`, `data-target-branch="dialog"`; menu title **`Request review from`**, search placeholder `Search users`; hidden `input[name="merge_request[reviewer_ids][]"][value="0"]`. **This is what feeds `.block.reviewer` on the created MR (ANCHOR webarena-666/667/668/806).** |
| Milestone | `div.form-group.row.issue-milestone`, label `Milestone`; `div.gl-dropdown[data-qa-selector="issuable_milestone_dropdown"]` with button text `Select milestone`; hidden `input[name="merge_request[milestone_id]"]` |
| Labels | label `Labels`; `button.dropdown-menu-toggle.js-label-select…[data-qa-selector="issuable_label_dropdown"]` default text `Labels`; menu title `Select label`, placeholder `Search`, footer links `Create project label` / `Manage project labels`; second page `Create project label` with `Name new label`, colour swatches, `Create` / `Cancel` |
| Merge options | `label` `Merge options`; checkbox `#merge_request_force_remove_source_branch[name="merge_request[force_remove_source_branch]"]` **checked by default**, label `Delete source branch when merge request is accepted.`; checkbox `#merge_request_squash[name="merge_request[squash]"]`, label `Squash commits when merge request is accepted.` + a help `?` link to `/help/user/project/merge_requests/squash_and_merge` |
| Contribution note | only when the project has `CONTRIBUTING.md` (primer/design does): `Please review the contribution guidelines for this project.` with `contribution guidelines` linking to `/primer/design/-/blob/main/CONTRIBUTING.md` |
| Submit | `button.gl-button.btn.btn-md.btn-confirm.gl-mr-2[type=submit][data-qa-selector="issuable_create_button"]` text **`Create merge request`**; `a.btn.gl-button.btn-default.js-reset-autosave[href="/…/-/merge_requests"]` text `Cancel` |
| Hidden state | `merge_request[lock_version]=0`, `merge_request[source_project_id]`, `merge_request[source_branch]`, `merge_request[target_project_id]`, `merge_request[target_branch]`, `merge_request_diff_head_sha`, `authenticity_token` |

Below the form, a second tab strip (`.merge-request-tabs-container` →
`ul.merge-request-tabs.nav.nav-tabs…`) with only two tabs:

| tab | href |
|---|---|
| `Commits` `11` (`li.commits-tab.new-tab.active`) | `/primer/design/-/merge_requests/new?merge_request%5Bsource_branch%5D=dialog-component&merge_request%5Btarget_branch%5D=dialog` |
| `Changes` `8` (`li.diffs-tab`, `data-qa-selector="diffs_tab"`) | `/primer/design/-/merge_requests/new/diffs?merge_request%5Bsource_branch%5D=…&merge_request%5Btarget_branch%5D=…` |

Commits are grouped by date with headings like `22 Jul, 2022 3 commits`, `19 Jul, 2022 1 commit`.
When there is no diff between the branches the whole area (including the tab strip) is replaced
by a centred heading **`There are no commits yet.`** plus two skeleton placeholder rows.

**Observed step-2 state for the four ANCHOR branch pairs** (webarena-666, 667, 668, 806) —
prefilled title, branch-selector line and tab counts:

| Task | URL params | `#merge_request_title` value | `.branch-selector` text | tabs |
|---|---|---|---|---|
| webarena-666 | `source_branch=dialog-component&target_branch=dialog` (primer/design) | `update generic link text guidance (#272)` | `From dialog-component into dialog Change branches` | `Commits 11`, `Changes 8` |
| webarena-667 | `source_branch=dialog-component&target_branch=bump-doctocat` (primer/design) | `Autocomplete interface guideline updates (#267)` | `From dialog-component into bump-doctocat Change branches` | `Commits 12`, `Changes 9` |
| webarena-668 | `source_branch=redesign&target_branch=main` (a11yproject) | `Draft: Redesign` | `From redesign into main Change branches` | none — `There are no commits yet.` |
| webarena-806 | `source_branch=redesign&target_branch=feature%2Fmarkdown-figure-block` (a11yproject) | `Draft: Redesign` | `From redesign into feature/markdown-figure-block Change branches` | none — `There are no commits yet.` |

So: when the compare yields commits, the title is prefilled from a commit subject; when it
yields none, the title is the humanized branch name with a `Draft: ` prefix
(`redesign` → `Draft: Redesign`), and the `js-wip-explanation` hint
(`Remove the Draft prefix …`) is the visible one. Even with zero commits the
`Create merge request` button is enabled and the MR can be created — this is exactly what
webarena-668 and webarena-806 require.

`POST /:ns/:project/-/merge_requests` creates the MR and redirects to
`/:ns/:project/-/merge_requests/:new_iid`, which must then render the branch chips and
`.block.reviewer` described above.

---

## 15c. MR detail — notes timeline and comment form

### `Activity` heading + `Sort or filter`

Between the merge widget and the notes list:

```html
<div class="gl-display-flex gl-sm-align-items-center gl-flex-direction-column gl-sm-flex-direction-row gl-justify-content-space-between gl-pt-5">
  <h2 class="gl-font-size-h1 gl-m-0">Activity</h2>
  <div class="gl-display-flex gl-gap-3 gl-w-full gl-sm-w-auto gl-mt-3 gl-sm-mt-0">
    <div id="discussion-preferences" data-testid="discussion-preferences" class="gl-display-inline-block gl-vertical-align-bottom full-width-mobile">
      <div id="discussion-preferences-dropdown" class="dropdown b-dropdown gl-dropdown full-width-mobile btn-group"
           data-qa-selector="discussion_preferences_dropdown">
        <button …class="btn dropdown-toggle btn-default btn-md gl-button gl-dropdown-toggle">
          <span class="gl-dropdown-button-text">Sort or filter</span><svg data-testid="chevron-down-icon"></button>
        …
```

Menu (`ul.dropdown-menu.dropdown-menu-right`), verbatim, in order:

| item | element |
|---|---|
| `Newest first` | `div#discussion-sort > li.gl-dropdown-item.js-newest-first` |
| `Oldest first` | `li.gl-dropdown-item.js-oldest-first` |
| — divider — | `li.gl-dropdown-divider > hr.dropdown-divider` |
| `Show all activity` | `div#discussion-filter.discussion-filter-container.js-discussion-filter-container > li.gl-dropdown-item.is-active` `button[data-filter-type="all"][data-qa-selector="filter_menu_item"]` |
| `Show comments only` | `button[data-filter-type="comments"]` |
| `Show history only` | `button[data-filter-type="history"]` |

Selecting a filter does **not** change the URL.

### `#notes-list` — exact nesting (ANCHOR)

```
ul#notes-list.notes.main-notes-list.timeline           ← id="notes-list", tagName UL
└── li.timeline-entry.note.note-wrapper…#note_<id>     ← one per note, in chronological order
```

The list element is always present, even when there are zero notes
(`/a11yproject/a11yproject.com/-/merge_requests/1071` has `#notes-list` with 0 children).

**Two kinds of `li`:**

**(1) User comment** — class
`timeline-entry note note-wrapper note-comment note-row-<id>` (plus ` is-editable` when the
current user may edit it), `id="note_<id>"`, `data-note-id="<id>"`,
`data-award-url="/<ns>/<project>/notes/<id>/toggle_award_emoji"`,
`data-qa-selector="noteable_note_container"`.

```
li.timeline-entry.note.note-wrapper.note-comment.note-row-310691#note_310691
└── div.timeline-entry-inner
    ├── div.timeline-avatar.gl-float-left
    │   └── a.gl-link.gl-avatar-link[href="/JoshBowdenConcepts"]
    │       └── img.gl-avatar.gl-avatar-circle.gl-avatar-s32[alt="Josh Bowden"]
    └── div.timeline-content
        ├── div.note-header
        │   ├── div.note-header-info
        │   │   ├── a.author-name-link.js-user-link[href][data-user-id][data-username]
        │   │   │   └── span.note-header-author-name.gl-font-weight-bold   → "Josh Bowden"
        │   │   ├── span.text-nowrap.author-username
        │   │   │   └── a.author-username-link > span.note-headline-light  → "@JoshBowdenConcepts"
        │   │   └── span.note-headline-light.note-headline-meta
        │   │       ├── span.system-note-message[data-qa-selector="system_note_content"] > span.d-none.d-sm-inline "·"
        │   │       ├── span.system-note-separator
        │   │       └── a.note-timestamp.system-note-separator[href="#note_310691"]
        │   │           └── time[title="Mar 24, 2023 12:00pm PDT"][datetime="2023-03-24T19:00:19.000Z"] "3 years ago"
        │   └── div.note-actions
        │       ├── span.badge…badge-muted.badge-pill.gl-badge.md[title="This user is the author of this merge request."] "Author"
        │       │   (or [title="This user has previously committed to the a11yproject.com project."] "Contributor")
        │       ├── div.emoji-picker[data-testid="note-emoji-button"] → button.note-emoji-button
        │       ├── button.js-reply-button[title="Reply to comment"][aria-label="Reply to comment"]
        │       ├── button.js-note-edit[title="Edit comment"][aria-label="Edit comment"][data-qa-selector="note_edit_button"]  (own notes only)
        │       └── div.dropdown.more-actions > button[title="More actions"][aria-label="More actions"]
        │           └── ul.dropdown-menu.more-actions-dropdown.dropdown-open-left
        │               ├── li.gl-dropdown-item > a "Report abuse to administrator"
        │               ├── li.gl-dropdown-item.js-btn-copy-note-link > button "Copy link"
        │               └── li.gl-dropdown-item.js-note-delete > button > span.text-danger "Delete comment"
        ├── div.timeline-discussion-body                       ← ★ the ANCHOR element
        │   ├── div.note-body[.js-task-list-container.is-task-list-enabled]
        │   │   ├── div.note-text.md                           ← rendered markdown (<p dir="auto" data-sourcepos=…>)
        │   │   └── textarea.hidden.js-task-list-field[data-update-url="/…/notes/302674"]
        │   └── div.timeline-discussion-body-footer
        └── (nothing else)
```

**(2) System note** — class `timeline-entry note system-note note-wrapper`, `id="note_<id>"`.
It has **NO** `.timeline-discussion-body` and **no** `.timeline-avatar`:

```
li.timeline-entry.note.system-note.note-wrapper#note_299192
└── div.timeline-entry-inner
    ├── div.timeline-icon > svg
    └── div.timeline-content
        ├── div.note-header > div.note-header-info
        │   ├── a.author-name-link.js-user-link > span.note-header-author-name.gl-font-weight-bold "Administrator"
        │   └── span.note-headline-light.note-headline-meta
        │       ├── span.system-note-message[data-qa-selector="system_note_content"]
        │       │   └── span  "restored source branch <code>github/fork/davidakennedy/davidakennedy-semantic-html</code>"
        │       └── a.note-timestamp.system-note-separator[href="#note_299192"] > time "3 years ago"
        └── div.note-body
            └── div.note-text.md > p "restored source branch <code>…</code>"
```

### The ANCHOR selector

```js
document.querySelector('[id="notes-list"').lastElementChild
        .querySelector('.timeline-discussion-body').outerText
```
(ANCHOR — webarena-390, 391, 392, 393; the same expression is also used by webarena-415, 416, 417.
Note the evaluator’s selector string is literally `'[id="notes-list"'` — an unbalanced bracket
that Chrome still parses as `[id="notes-list"]`.)

`.timeline-discussion-body.outerText` yields the **rendered markdown text only** — no author,
no timestamp. Verified live on `/a11yproject/a11yproject.com/-/merge_requests/1265`:

```
"Created by: SaptakS\n\nI am not able to reproduce #1208 anymore after @ericwbailey refactored the card resources. Can you tell me the steps to reproduce so I can verify that it's fixed?"
```

and on `/primer/design/-/merge_requests/450`:

```
"Octicons: A scaleable set of icons handcrafted with ❤️ by us at GitHub to be used freely in your projects and applications"
```

**Current (read-only, pre-task) state of each anchor MR — verified live:**

| MR | `#notes-list` children | last child class | anchor expression today |
|---|---|---|---|
| a11y `!1531` (ANCHOR webarena-390 → `lgtm`) | 2 | `timeline-entry note system-note note-wrapper` | **throws** (system note has no `.timeline-discussion-body`) |
| a11y `!1265` (ANCHOR webarena-391 → `close because non reproducible`) | 6 | `timeline-entry note note-wrapper note-comment note-row-302674 is-editable` | `"Created by: SaptakS\n\nI am not able to reproduce #1208 …"` |
| a11y `!1071` (ANCHOR webarena-392 → `Good idea`) | **0** | — | **throws** (`#notes-list` is empty) |
| a11y `!1270` (ANCHOR webarena-416 → `Thank you`) | 23 | system-note | throws |
| a11y `!1485` (ANCHOR webarena-417 → `@Roshanjossey`) | 6 | system-note | throws |
| empathy `!19` (ANCHOR webarena-393 → `lgtm`) | 2 | system-note | throws |
| webring `!40` (ANCHOR webarena-415 → `@davepgreene`) | 3 | system-note | throws |
| primer `!450` (ANCHOR webarena-389 → must_include `Thanks, working on reviews`) | 2 | `timeline-entry note note-wrapper note-comment note-row-310691` | `"Octicons: A scaleable set of icons handcrafted with ❤️ …"` |

**Implication for the mock (hard requirement):** these anchors are *post-condition* checks.
After the agent posts a comment, the mock must **append a new `li.timeline-entry.note.note-wrapper.note-comment`
as the LAST child of `ul#notes-list`** (after any system notes), containing
`div.timeline-discussion-body > div.note-body > div.note-text.md > p` whose text is **exactly**
the submitted comment, with no leading/trailing whitespace. `outerText` must equal exactly
`lgtm` / `Good idea` / `close because non reproducible` / `Thank you` / `@Roshanjossey` /
`@davepgreene`, and must *include* `Thanks, working on reviews` for webarena-389.
Do not wrap the text in anything that adds visible text inside `.timeline-discussion-body`
(the author name / timestamp / action buttons live in `.note-header`, which is a **sibling**,
not a child, of `.timeline-discussion-body`).
`#notes-list` must exist and be appendable even when it starts empty (`!1071`).
webarena-389 uses `locator: ""` (whole-page `must_include`), so any visible rendering suffices there.

### Comment form

`div.js-comment-form` → `ul.notes.notes-form.timeline` →
`li.timeline-entry.note-form` → `div.timeline-entry-inner` →
`div.timeline-content.timeline-content-form` →
`form.new-note.common-note-form.gfm-form.js-main-target-form`.

- Wrapper `div.comment-warning-wrapper.gl-border-solid.gl-border-1.gl-rounded-base.gl-border-gray-100`
  with `div.error-alert[data-testid="comment-field-alert-container"]`.
- `div.js-vue-markdown-field.md-area.position-relative.gfm-form` → `div.md-header` →
  `div.tabs.gl-tabs` → `ul.nav.gl-tabs-nav[role=tablist]`:
  - `a.nav-link.active.gl-py-4.gl-px-3.js-md-write-button.gl-tab-nav-item.gl-tab-nav-item-active[role=tab][aria-selected=true]` → **`Write`**
  - `a.nav-link.gl-py-4.gl-px-3.js-md-preview-button.gl-tab-nav-item[role=tab]` → **`Preview`**
- Toolbar `div.md-header-toolbar.gl-ml-auto.gl-py-2.gl-justify-content-center[data-testid="md-header-toolbar"]`,
  each button `button.btn.js-md.btn-default.btn-md.gl-button.btn-default-tertiary.btn-icon`
  with `data-container="body"` and matching `title` + `aria-label`. **Exact tooltips, in order:**

  | # | tooltip (`title` = `aria-label`) | `data-md-tag` / command | visible? |
  |---|---|---|---|
  | 1 | `Add bold text (Ctrl+B)` | `**` | yes |
  | 2 | `Add italic text (Ctrl+I)` | `_` | yes |
  | 3 | `Add strikethrough text (Ctrl+⇧X)` | `~~` | yes |
  | 4 | `Insert a quote` | `> ` (prepend) | yes |
  | 5 | `Insert code` | `` ` `` / block ` ``` ` | yes |
  | 6 | `Add a link (Ctrl+K)` | `[{text}](url)` | yes |
  | 7 | `Add a bullet list` | `- ` (prepend) | yes |
  | 8 | `Add a numbered list` | `1. ` (prepend) | yes |
  | 9 | `Add a checklist` | `- [ ] ` (prepend) | yes |
  | 10 | `Indent line (Ctrl+])` | `indentLines` | **hidden** (`gl-display-none`) |
  | 11 | `Outdent line (Ctrl+[)` | `outdentLines` | **hidden** (`gl-display-none`) |
  | 12 | `Add a collapsible section` | `<details><summary>Click to expand</summary>\n{text}\n</details>` | yes |
  | 13 | `Add a table` | `\| header \| header \|…` | yes |
  | 14 | `Attach a file or image` | `js-attach-file-button`, `data-testid="button-attach-file"` | yes |
  | 15 | `Go full screen` | `js-zen-enter` | yes |

- Textarea: `textarea#note-body[name="note[note]"]`
  `class="note-textarea js-vue-comment-form js-note-text js-gfm-input js-autosize markdown-area"`
  `data-qa-selector="comment_field"`, `aria-label="Comment"`,
  **placeholder `Write a comment or drag your files here…`** (note the single-character `…`).
- Footer `div.comment-toolbar` → `div.toolbar-text`:
  `Supports Markdown. For quick actions, type /.`
  (`Markdown` → `/help/user/markdown`, `quick actions` → `/help/user/project/quick_actions`,
  `/` wrapped in `<kbd>`).
- Actions row `div.note-form-actions`:
  - Split button `div.gl-dropdown.gl-mr-3.js-comment-button.js-comment-submit-button.comment-type-dropdown.btn-group`
    `data-testid="comment-button"` `data-qa-selector="comment_button"`:
    - main `button.btn.btn-confirm.btn-md.gl-button.split-content-button` → span
      `.gl-dropdown-button-text` = **`Comment`** (`disabled` while the textarea is empty)
    - toggle `button.dropdown-toggle.btn-confirm.gl-button.gl-dropdown-toggle.dropdown-toggle-split`
      with `span.sr-only` = `Toggle dropdown`
    - menu items:
      | primary text | secondary text |
      |---|---|
      | **`Comment`** (`<strong>`) | `Add a general comment to this merge request.` |
      | — divider — | |
      | **`Start thread`** (`<strong>`, `button[data-qa-selector="discussion_menu_item"]`) | `Discuss a specific suggestion or question that needs to be resolved.` |
  - `button.btn.btn-default.btn-md.gl-button.btn-close.js-note-target-close.btn-comment.btn-comment-and-close[data-testid="close-reopen-button"]`
    → **`Close merge request`** on an open MR, **`Reopen merge request`** on a closed MR,
    and **absent entirely** on a merged MR.

**Never click `Comment`, `Start thread`, `Close merge request` or `Reopen merge request` during
recon.** (Not clicked here.)

---

## 15d. MR detail — right sidebar blocks (exact DOM) and the merge widget

### Sidebar container

```html
<aside class="right-sidebar js-right-sidebar js-issuable-sidebar right-sidebar-expanded"
       data-signed-in="…">
  <div class="issuable-sidebar">
    <div class="issuable-sidebar-header">
      <a class="gutter-toggle float-right js-sidebar-toggle has-tooltip" href="#" role="button"
         aria-label="Toggle sidebar" title="Collapse sidebar" data-placement="left"
         data-boundary="viewport" data-container="body">
        <span class="js-sidebar-toggle-container" data-is-expanded="true"><svg/><svg/></span></a>
      <div data-testid="sidebar-todo">
        <button class="btn hide-collapsed btn-default btn-sm gl-button" type="button"
                aria-label="Mark as done" issuable-type="merge_request"
                issuable-id="gid://gitlab/MergeRequest/72135">
          <span class="gl-button-text">Mark as done</span></button>
        <button class="btn sidebar-collapsed-icon …" type="reset" title="Mark as done">…</button>
      </div>
    </div>
    <form class="issuable-context-form inline-update js-issuable-update"
          action="/…/-/merge_requests/1071.json" method="post" data-remote="true">
      … all the .block elements …
    </form>
  </div>
</aside>
```

Top button label is **`Mark as done`** when a to-do already exists for the MR, and
**`Add a to do`** when it does not (both seen in the reference screenshots).
Collapse control tooltip: `Collapse sidebar` (`aria-label="Toggle sidebar"`).

### Blocks, IN ORDER, with exact class strings

| # | selector | full `class` attribute | other attrs |
|---|---|---|---|
| 1 | `.block.assignee` | `block assignee` | `data-qa-selector="assignee_block_container"` `data-testid="assignee-block-container"` |
| 2 | **`.block.reviewer`** (ANCHOR) | `block reviewer` | `data-qa-selector="reviewers_block_container"` |
| 3 | `.block.labels` | `labels-select-wrapper gl-relative block labels js-labels-block` | — |
| 4 | `.block.milestone` | `block milestone` | `data-qa-selector="milestone_block"` `data-testid="sidebar-milestones"` |
| 5 | `.block.time-tracking` | `block time-tracking` | inner `div.time-tracker.sidebar-help-wrap[data-testid="time-tracker"]` |
| 6 | `.block.lock` | `block issuable-sidebar-item lock` | — |
| 7 | `.block.subscriptions` | `block subscriptions` | — |
| 8 | `.block.participants` | `block participants` | — |
| 9 | `.block.with-sub-blocks` | `block with-sub-blocks` | reference + source-branch sub-blocks |

> Visual order in the screenshots matches DOM order: Assignee, Reviewers, Labels, Milestone,
> Time tracking, Lock merge request, Notifications, participants, reference/source-branch.
> There is **no** `.block.due_date` and no `.block.weight` on merge requests
> (those exist only on issues).

### Real `outerText` per block (live)

`/a11yproject/a11yproject.com/-/merge_requests/1531`:

| block | `outerText` |
|---|---|
| `.block.assignee` | `Assignee\nEdit\nRoshan Jossy` |
| `.block.reviewer` | `0 Reviewers\nEdit\nNone - assign yourself` |
| `.block.labels` | `Labels\nEdit\nNone` |
| `.block.milestone` | `Milestone\nEdit\nNone` |
| `.block.time-tracking` | `Time tracking\nNo estimate or time spent` |
| `.block.lock` | `Lock merge request\nEdit\nUnlocked` |
| `.block.subscriptions` | `Notifications\nNotifications` |
| `.block.participants` | `3 participants` |
| `.block.with-sub-blocks` | `Reference: a11yproject/a11yproject.com!1531\nSource branch: github/fork/davidakennedy/davidakennedy-semantic-html` |

`/a11yproject/a11yproject.com/-/merge_requests/1265`:

| block | `outerText` |
|---|---|
| `.block.assignee` | `Assignee\nEdit\nEJ Mason` |
| **`.block.reviewer`** | **`Reviewer\nEdit\nByte Blaze`** |
| `.block.labels` | `Labels\nEdit\naccessibility\nstyling` |
| `.block.milestone` | `Milestone\nEdit\nNone` |
| `.block.time-tracking` | `Time tracking\nNo estimate or time spent` |
| `.block.lock` | `Lock merge request\nEdit\nUnlocked` |
| `.block.subscriptions` | `Notifications\nNotifications` |
| `.block.participants` | `3 participants` |
| `.block.with-sub-blocks` | `Reference: a11yproject/a11yproject.com!1265\nSource branch: fix/card-focus-edge-cases` |

`/a11yproject/a11yproject.com/-/merge_requests/1270`:
`.block.assignee` → `Assignee\nEdit\nByte Blaze`;
**`.block.reviewer` → `3 Reviewers\nEdit\nByte Blaze\nEJ Mason\nAgustina Chaer`**;
`.block.labels` → `Labels\nEdit\ndata\njavascript\nmarkup\nstyling`; `.block.participants` → `5 participants`;
`.block.with-sub-blocks` → `Reference: a11yproject/a11yproject.com!1270\nSource branch: github/fork/aguscha333/feat/add-wcag-levels`.

`/a11yproject/a11yproject.com/-/merge_requests/1280`:
`.block.assignee` → `0 Assignees\nEdit\nNone - assign yourself`;
`.block.reviewer` → `3 Reviewers\nEdit\nByte Blaze\nEJ Mason\nrachel fischoff`;
`.block.participants` → `4 participants`.

`/primer/design/-/merge_requests/450`, `/a11yproject/…/1071`, `/a11yproject/…/1485`,
`/byteblaze/empathy-prompts/-/merge_requests/19`, `/byteblaze/a11y-webring.club/-/merge_requests/40`:
`.block.reviewer` → `0 Reviewers\nEdit\nNone - assign yourself`.

### `.block.reviewer` — exact DOM (ANCHOR, webarena-666, 667, 668, 806)

**Header text rule (critical):** the header is `<n> Reviewers` when n ≠ 1, and the bare word
**`Reviewer`** (no count) when n = 1. So a freshly-created MR with one reviewer produces
`outerText` = `Reviewer\nEdit\n<Display Name>` — which satisfies the `must_include` anchors
`Primer` / `Roshan Jossy` / `Byte Blaze`.

**Zero reviewers:**

```html
<div class="block reviewer" data-qa-selector="reviewers_block_container">
  <div><div class="hide-collapsed gl-line-height-20 gl-mb-2 gl-text-gray-900 gl-font-weight-bold">
      0 Reviewers
      <a href="#" class="js-sidebar-dropdown-toggle edit-link btn gl-text-gray-900! gl-ml-auto hide-collapsed btn-default btn-sm gl-button btn-default-tertiary float-right"
         data-track-action="click_edit_button" data-track-label="right_sidebar"
         data-track-property="reviewer" data-qa-selector="reviewers_edit_button">Edit</a>
    </div>
    <div>
      <div title="Reviewer(s)" class="sidebar-collapsed-icon sidebar-collapsed-user" issuable-type="merge_request"><svg/></div>
      <div class="value hide-collapsed">
        <span data-testid="no-value" class="no-value">
          None
          -
          <button type="button" data-testid="assign-yourself" data-qa-selector="assign_yourself_button"
                  class="gl-button btn-link gl-reset-color!">assign yourself</button>
        </span>
      </div>
    </div>
  </div>
  <div class="selectbox hide-collapsed">
    <div></div>
    <div class="dropdown js-sidebar-reviewer-dropdown">
      <button class="dropdown-menu-toggle js-reviewer-search js-author-search js-multiselect js-save-user-data js-invite-members-track"
              data-field-name="merge_request[reviewer_ids][]" data-dropdown-title="Request review from"
              data-dropdown-header="Reviewer" data-max-select="1" data-null-user="true"
              data-issue-update="/…/-/merge_requests/1531.json" data-toggle="dropdown">
        <span class="dropdown-toggle-text ">Request review from</span></button>
      <div class="dropdown-menu dropdown-select dropdown-menu-user dropdown-menu-selectable dropdown-menu-author dropdown-extended-height">
        <div class="dropdown-title gl-display-flex"><span class="gl-ml-auto">Request review from</span>
          <button class="dropdown-title-button dropdown-menu-close gl-ml-auto" aria-label="Close" type="button"></button></div>
        <div class="dropdown-input"><input type="search" class="dropdown-input-field" placeholder="Search users"
              data-qa-selector="dropdown_input_field" autocomplete="off"></div>
        <div class="dropdown-content" data-qa-selector="dropdown_list_content"></div>
        <div class="dropdown-footer"><ul class="dropdown-footer-list"><li>
          <a class="gl-link" data-qa-selector="invite_members_button" data-test-id="invite-members-button"
             data-track-action="click_invite_members" data-track-label="edit_reviewer" href="#">Invite Members</a>
        </li></ul></div>
        <div class="dropdown-loading">…</div>
      </div>
    </div>
  </div>
</div>
```

Empty-state copy renders as three text nodes producing `None - assign yourself`
(`None`, `-`, and a `<button>` reading `assign yourself`).

**One reviewer:** the header text becomes `Reviewer`, and the value area becomes

```html
<div><div title="Byte Blaze" class="sidebar-collapsed-icon sidebar-collapsed-user" issuable-type="merge_request">
      <button type="button" class="btn-link gl-button">
        <span class="position-relative"><img alt="Byte Blaze's avatar" width="24"
              src="https://www.gravatar.com/avatar/99a4297c867eada2606b9b6973f081f9?s=80&d=identicon"
              data-qa-selector="avatar_image" class="avatar avatar-inline m-0 s24"></span>
        <span class="author"> Byte Blaze </span></button></div>
  <div class="value hide-collapsed"><div>
    <div data-testid="reviewer" class="gl-display-grid gl-align-items-center reviewer-grid gl-mr-2">
      <a title="" href="http://10.186.197.203:8023/byteblaze"
         class="gl-link gl-display-inline-block js-user-link gl-word-break-word gl-mr-2" data-css-area="user">
        <span class="gl-display-flex">
          <span class="position-relative" issuable-type="merge_request">
            <img alt="Byte Blaze's avatar" width="24" src="…" data-qa-selector="avatar_image"
                 class="avatar avatar-inline m-0 s24"></span>
          <div class="gl-ml-3 gl-line-height-normal gl-display-grid gl-align-items-center">Byte Blaze</div>
        </span></a>
    </div></div></div></div>
```

plus, inside `div.selectbox.hide-collapsed`, one
`input[type=hidden][name="merge_request[reviewer_ids][]"][value="2330"]` carrying
`data-avatar-url`, `data-name="Byte Blaze"`, `data-username="byteblaze"`, `data-can-merge="true"`.

**Observed reality vs the brief’s question:** the expanded reviewer row shows the **display
name only** — the `@handle` is **not** rendered (unlike issue assignees on some versions).
`.block.reviewer.outerText` for one reviewer is therefore exactly `Reviewer\nEdit\nByte Blaze`.
The `must_include` anchors (`Primer`, `Roshan Jossy`, `Byte Blaze`) all match on display name.

**Re-request-review button:** the `div[data-testid="reviewer"].reviewer-grid` is where GitLab
renders the re-request button (`button[data-testid="re-request-review"]`, tooltip
`Re-request review`) — **not present on any MR in this instance** (it only appears once the
reviewer has already left a review). Not observed; safe to omit.

### `.block.assignee` — exact DOM

Header `Assignee` (1 assignee) / `0 Assignees` (none) / `<n> Assignees`;
`a.js-sidebar-dropdown-toggle.edit-link…[data-test-id="edit-link"][data-qa-selector="edit_link"][data-track-property="assignee"]` → `Edit`.
Value: `div[data-testid="expanded-assignee"].value.hide-collapsed` →
`div.assignee-grid.gl-display-grid.gl-align-items-center.gl-w-full` →
`a.gl-link.gl-display-inline-block.js-user-link.gl-word-break-word[data-css-area="user"]`
(with `title="Cannot merge"` `data-placement="left"` when the user lacks merge rights) →
`img.avatar.avatar-inline.m-0.s24[data-qa-selector="avatar_image"]` +
`div[data-testid="username"][data-qa-selector="username"]` → the display name.
Collapsed icon `div.sidebar-collapsed-icon.sidebar-collapsed-user[title="EJ Mason (cannot merge)"]`.
Empty state identical to reviewers: `None - assign yourself` with
`button[data-testid="assign-yourself"][data-qa-selector="assign_yourself_button"]`.
Hidden input `merge_request[assignee_ids][]`; dropdown
`div.dropdown.js-sidebar-assignee-dropdown` with toggle text `Select assignee`,
menu title `Assign to`, search placeholder `Search users`, footer `Invite Members`.
(ANCHOR `document.querySelector('.block.assignee').outerText` is registered for issues
— webarena-658/659/660/808 — but the selector is identical here.)

### `.block.labels`

`div.labels-select-wrapper.gl-relative.block.labels.js-labels-block`.
Header `Labels` + `Edit`. Value = `None` when empty, otherwise one
`a.gl-label-link` chip per label rendering the label title (`accessibility`, `styling`, …).

### `.block.milestone`

```html
<div class="block milestone" data-qa-selector="milestone_block" data-testid="sidebar-milestones">
  <div data-testid="milestone-edit">
    <div class="gl-display-flex gl-align-items-center gl-line-height-20 gl-text-gray-900 gl-font-weight-bold">
      <span data-testid="title" class="hide-collapsed">Milestone</span>
      <button id="milestone-edit" data-testid="edit-button" data-qa-selector="edit_link"
              data-track-action="click_edit_button" data-track-label="right_sidebar"
              data-track-property="milestone"
              class="btn gl-text-gray-900! gl-ml-auto hide-collapsed gl-mr-n2 shortcut-sidebar-dropdown-toggle btn-default btn-sm gl-button btn-default-tertiary">
        <span class="gl-button-text">Edit</span></button>
    </div>
    <div data-testid="collapsed-content" class="gl-line-height-14">
      <div title="Milestone" class="sidebar-collapsed-icon"><svg/>
        <span class="collapse-truncated-title gl-pt-2 gl-px-3 gl-font-sm">No milestone</span></div>
      <div data-testid="select-milestone" class="hide-collapsed">
        <span class="gl-text-gray-500">None</span></div>
    </div>
    <div data-testid="expanded-content" style="display: none;">… gl-dropdown, button text "Milestone" …</div>
  </div>
</div>
```

Every MR in this dataset has `None`. Collapsed tooltip text is `No milestone`.

### `.block.time-tracking`

```html
<div class="block time-tracking">
  <div data-testid="time-tracker" class="time-tracker sidebar-help-wrap">
    <div title="Time tracking" data-testid="collapsedState" class="sidebar-collapsed-icon"><svg/>
      <div class="time-tracking-collapsed-summary"><div class="no-tracking">
        <span class="no-value collapse-truncated-title gl-pt-2 gl-px-3 gl-font-sm"> None </span></div></div></div>
    <div class="hide-collapsed gl-line-height-20 gl-text-gray-900 gl-display-flex gl-align-items-center gl-font-weight-bold">
      Time tracking
      <button data-testid="add-time-entry-button" title="Add time entry" type="button"
              class="btn gl-ml-auto btn-default btn-sm gl-button btn-default-tertiary">
        <span class="gl-button-text"><svg/></span></button></div>
    <div class="hide-collapsed">
      <div data-testid="noTrackingPane"><span class="gl-text-gray-500">No estimate or time spent</span></div></div>
  </div>
</div>
```

Note: the affordance is a `+` **icon button** with `title="Add time entry"`, not an `Edit` link.

### `.block.lock`

`div.block.issuable-sidebar-item.lock`. Header `Lock merge request` + `Edit`,
value `Unlocked`. (On issues the header reads `Lock issue`.)

### `.block.subscriptions`

Header span `[data-testid="title"]` = `Notifications`, plus a GitLab toggle
`div[data-testid="subscription-toggle"].gl-toggle-wrapper` containing
`span#toggle-label-<n>[data-testid="toggle-label"].gl-toggle-label.gl-sr-only` = `Notifications`
and `button[role=switch][aria-checked="true"].gl-toggle.is-checked`.
Hence `outerText` = `Notifications\nNotifications` (the sr-only label duplicates it).
Collapsed icon `span.sidebar-collapsed-icon[title="Notifications on"]`.
Hidden disabled state text: `Disabled by project owner`.

### `.block.participants`

```html
<div class="block participants">
  <div title="3 participants" class="sidebar-collapsed-icon"><svg/>
    <span data-testid="collapsed-count" class="gl-pt-2 gl-px-3 gl-font-sm">3</span></div>
  <div class="title hide-collapsed gl-mb-2! gl-line-height-20 gl-font-weight-bold">3 participants</div>
  <div class="hide-collapsed gl-display-flex gl-flex-wrap">
    <div class="participants-author gl-display-inline-block gl-pr-3 gl-pb-3">
      <a href="http://10.186.197.203:8023/byteblaze" class="author-link"><span>
        <img src="https://www.gravatar.com/avatar/…?s=80&d=identicon" alt="Byte Blaze"
             class="gl-avatar gl-avatar-circle gl-avatar-s24 gl-mr-0!" data-src="…"></span></a></div>
    … one .participants-author per participant …
  </div>
</div>
```

Heading is `<n> participants` (also `1 participant`, singular, as on `!450` / `!1071`).
There is **no** `Edit` link on this block.

### `.block.with-sub-blocks` — Reference + Source branch

```html
<div class="block with-sub-blocks">
  <div class="sub-block">
    <button id="clipboard-button-5" title="Copy Reference" aria-label="Copy Reference" aria-live="polite"
            data-clipboard-text="a11yproject/a11yproject.com!1265" data-clipboard-handle-tooltip="false"
            type="button"
            class="btn btn-default btn-md gl-button btn-default-tertiary btn-icon sidebar-collapsed-icon js-dont-change-state gl-rounded-0! gl-hover-bg-transparent"><svg/></button>
    <div class="gl-display-flex gl-align-items-center gl-justify-content-space-between hide-collapsed">
      <span title="a11yproject/a11yproject.com!1265"
            class="gl-overflow-hidden gl-text-overflow-ellipsis gl-white-space-nowrap">Reference: a11yproject/a11yproject.com!1265</span>
      <button id="clipboard-button-4" title="Copy Reference" aria-label="Copy Reference" aria-live="polite"
              data-clipboard-text="a11yproject/a11yproject.com!1265"
              class="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon"><svg/></button>
    </div>
  </div>
  <div class="sub-block js-sidebar-source-branch">
    <div class="sidebar-collapsed-icon js-dont-change-state">
      <button class="btn btn-clipboard gl-button btn-default-tertiary btn-icon btn-sm js-source-branch-copy"
              data-toggle="tooltip" data-placement="left" data-container="body"
              data-title="Copy branch name" data-boundary="viewport"
              data-clipboard-text="fix/card-focus-edge-cases" type="button"
              title="Copy branch name" aria-label="Copy branch name" aria-live="polite"><svg/></button>
    </div>
    <div class="gl-display-flex gl-align-items-center gl-justify-content-space-between gl-mb-2 hide-collapsed">
      <span class="gl-overflow-hidden gl-text-overflow-ellipsis gl-white-space-nowrap">
        Source branch: <span class="gl-font-monospace" data-testid="ref-name"
                             title="fix/card-focus-edge-cases">fix/card-focus-edge-cases</span>
      </span>
      <button class="btn btn-clipboard gl-button btn-default-tertiary btn-icon btn-sm js-source-branch-copy"
              data-toggle="tooltip" data-placement="left" data-container="body"
              data-title="Copy branch name" data-boundary="viewport"
              data-clipboard-text="fix/card-focus-edge-cases" type="button"
              title="Copy branch name" aria-label="Copy branch name" aria-live="polite"><svg/></button>
    </div>
  </div>
</div>
```

Verbatim prefixes: `Reference: ` and `Source branch: `. Tooltips: `Copy Reference`,
`Copy branch name`. The source-branch value is rendered in a
`span.gl-font-monospace[data-testid="ref-name"]` (note: this is a `<span>`, **not** an `<a>`,
so it does not affect the `.detail-page-description > a.gl-font-monospace` anchor).

---

### The merge widget — `.mr-state-widget`

Root: `div.mr-state-widget.gl-mt-3`, containing 1..n
`div.mr-section-container.mr-widget-workflow` sections. Each section is
`div.mr-widget-section` → `div.mr-widget-content` / `div.mr-widget-body.media`.
The primary status row is `div.mr-widget-body.media[service="[object Object]"]`.
`div[data-qa-selector="mr_widget_content"]` wraps the main state section, and the expandable
detail region is `div[data-testid="ready_to_merge_state"].gl-border-t-1.gl-border-t-solid.gl-border-gray-100.gl-pl-7`.

### Sections in order

**1. Pipeline line** (only when a pipeline exists) —
`div.ci-widget.media` → status icon link (`span[data-testid="ci-icon-wrapper"].ci-status-icon.ci-status-icon-failed`,
`svg[data-testid="status_failed-icon"].gl-icon.s24`), then
`div[data-testid="pipeline-info-container"][data-qa-selector="merge_request_pipeline_info_content"].gl-font-weight-bold`:

> `Pipeline #1820 failed for 35b52ef0 on github/fork/davidakennedy/davidakennedy-semantic-html 3 years ago`

Structure: literal `Pipeline` + `a.gl-link.pipeline-id.pipeline-number[data-testid="pipeline-id"][data-qa-selector="pipeline_link"]` (`#1820`)
+ status word (`failed`) + `for` + `a.gl-link.commit-sha[data-testid="commit-link"]` (`35b52ef0`)
+ `on` + `span.label-branch.label-truncate.js-show-tooltip > a` (branch) +
`time[data-testid="finished-at"]`. Right side: `div[data-testid="pipeline-mini-graph"]` with per-stage
dropdowns, each `div[data-testid="mini-pipeline-graph-dropdown"]` with
`aria-label="View Stage: build: failed"` / `"View Stage: test: failed"`.

**2. Approvals** — `div.js-mr-approvals.d-flex.align-items-start.align-items-md-center`,
icon container `div.circle-icon-container.gl-mr-3` with `svg[data-testid="approval-icon"].gl-icon.s24`.
- Not-yet-approved: `button[data-qa-selector="approve_button"].btn.gl-mr-5.btn-confirm.btn-md.gl-button`
  text **`Approve`**, followed by `div.d-flex.align-items-center` →
  `span.text-muted` text **`Approval is optional`** and a help link
  `a.gl-link.d-flex-center[title="About this feature"][href="/help/user/project/merge_requests/approvals/index.md"]`
  with `svg[data-testid="question-o-icon"]`.
- Already approved by you: `div[data-qa-selector="approvals_summary_content"]` →
  `span.gl-font-weight-bold` **`Approved by you`** + the approver avatar
  (`a.gl-link.gl-avatar-link.user-avatar-link`). The `Approve` button is replaced.
Other strings in the bundle (not observed here): `Approved by @%{username}`,
`Approved by you and others`, `Approve additionally`.

**3. State section.** Observed states:

**(a) Ready to merge** (`/a11yproject/…/1531`, `/byteblaze/empathy-prompts/-/merge_requests/19`,
`/byteblaze/a11y-webring.club/-/merge_requests/40`)

```html
<div class="mr-widget-body media" service="[object Object]">
  <div class="gl-w-6 gl-h-6 gl-display-flex gl-align-self-start gl-mr-3">…
    <svg data-testid="status-success-icon" aria-label="Success " data-qa-selector="status_success_icon" class="gl-display-block gl-icon s12">…</div>
  <p class="media-body gl-m-0! gl-font-weight-bold gl-text-gray-900!">Ready to merge!</p>
</div>
<div data-testid="ready_to_merge_state" class="gl-border-t-1 gl-border-t-solid gl-border-gray-100 gl-pl-7 gl-bg-gray-10">
  <div class="mr-widget-body mr-widget-body-ready-merge media gl-display-flex gl-align-items-center">
    <div class="media-body"><div class="mr-widget-body-controls gl-display-flex gl-align-items-center gl-flex-wrap">
      <div class="gl-form-checkbox js-remove-source-branch-checkbox …custom-control custom-checkbox">
        <input id="remove-source-branch-input" type="checkbox" class="custom-control-input" value="true">
        <label for="remove-source-branch-input" class="custom-control-label">Delete source branch</label></div>
      <div class="gl-form-checkbox js-squash-checkbox …">
        <input data-qa-selector="squash_checkbox" id="6" type="checkbox" name="squash" class="custom-control-input" value="true">
        <label for="6" class="custom-control-label">Squash commits</label></div>
      <a title="What is squashing?" href="/help/user/project/merge_requests/squash_and_merge" target="_blank"
         class="gl-link gl-text-blue-600"><svg data-testid="question-o-icon"/><span class="sr-only">What is squashing?</span></a>
      <div class="gl-form-checkbox …">
        <input data-testid="widget_edit_commit_message" id="7" type="checkbox" class="custom-control-input" value="true">
        <label for="7" class="custom-control-label">Edit commit message</label></div>
      <div class="gl-w-full gl-text-gray-500 … mr-widget-merge-details">
        <span><span class="gl-font-weight-bold">1</span> commit and <span class="gl-font-weight-bold">1</span> merge commit will be added to <span class="label-branch gl-font-weight-bold">main</span>.</span>
        ·
        <section class="mr-ready-merge-related-links gl-display-inline">
          <p class="gl-display-inline gl-m-0 gl-font-sm!">Mentions issue <span><a class="gfm gfm-issue" href="/…/-/issues/1530">#1530</a></span></p></section></div>
      <div role="group" class="gl-align-self-start btn-group">
        <button data-testid="merge-button" data-qa-selector="merge_button" type="button"
                class="btn accept-merge-request btn-confirm btn-md gl-button">
          <span class="gl-button-text">Merge...</span></button></div>
    </div></div></div>
</div>
```

Verbatim strings: **`Ready to merge!`**, checkbox labels **`Delete source branch`**,
**`Squash commits`**, **`Edit commit message`** (NOT “Modify merge commit” — that label does
not exist in this build), sr-only help text `What is squashing?`, and the merge button label
**`Merge...`** (three ASCII dots, `button[data-testid="merge-button"][data-qa-selector="merge_button"].accept-merge-request`).
Summary sentence: `<n> commit and 1 merge commit will be added to <target>.` /
`<n> commits and 1 merge commit will be added to <target>.`
Related links: `Mentions issue #1530` / `Mentions issues …` / `Closes issue #1209` / `Closes issues …`.
On `!40` the summary also carries `The source branch is 90 commits behind the target branch · `.

**(b) Ready to merge (no write access)** (`/primer/design/-/merge_requests/450`)

> `Ready to merge by members who can write to the target branch.`

No checkboxes, no merge button; the `Merge details` list is shown instead:
`The source branch is 7 commits behind the target branch`,
`5 commits and 1 merge commit will be added to main.`,
`Source branch will not be deleted.`

**(c) Merge conflicts** (`/a11yproject/…/1071`, `/1265`, `/1270`, `/1485`)

Status row `div.mr-widget-body.media.gl-display-flex.gl-align-items-center` with a red icon
(`gl-text-red-500`) and
`span.bold.gl-ml-0!.gl-text-body!.gl-flex-grow-1.gl-w-full.gl-md-w-auto.gl-mr-2`:

> **`Merge blocked: merge conflicts must be resolved.`**

Action buttons in `div.state-container-action-buttons`:
- `button[data-testid="merge-locally-button"].js-check-out-modal-trigger.btn-confirm.btn-sm.gl-button.btn-confirm-secondary` → **`Resolve locally`**
- `a[data-testid="resolve-conflicts-button"][href="/…/-/merge_requests/1265/conflicts"].btn-confirm.btn-sm.gl-button` → **`Resolve conflicts`**
  (absent on `!1071`, where the conflict cannot be resolved in the UI)
- collapse toggle `button[title="Collapse merge details"]`

Detail region `div[data-qa-selector="merged_status_content"].mr-widget-merge-details`:

```
<p class="gl-mb-2 gl-text-gray-900">Merge details</p>
<ul class="gl-pl-4 gl-mb-0 gl-ml-3 gl-text-gray-600">
  <li>The source branch is <a class="gl-link" href="/…/-/commits/main">481 commits behind</a> the target branch</li>
  <li><span><b>5</b> commits and <b>1</b> merge commit will be added to <span class="label-branch gl-font-weight-bold">main</span>.</span></li>
  <li>Source branch will not be deleted.</li>
  <li>… Mentions issue #1208 / Closes issue #1209 …</li>
</ul>
```

Verbatim: `Merge details`, `The source branch is <n> commits behind the target branch`,
`Source branch will not be deleted.`

**(d) Merged** (`/a11yproject/…/1292`, `/863`)

```html
<div class="mr-widget-body media gl-display-flex gl-align-items-center gl-bg-blue-50">
  …<h4 class="js-mr-widget-author">
    Merged by
    <a href="http://…/byteblaze" class="gl-link mr-widget-author">
      <img class="avatar avatar-inline s16" alt="Byte Blaze"><span class="author">Byte Blaze</span></a>
    <span class="sr-only">5 years ago (Jul 14, 2021 7:51am PDT)</span>
    <time aria-hidden="" title="Jul 14, 2021 7:51am PDT"> 5 years ago </time></h4>
  <div class="… state-container-action-buttons …"></div>
  <button title="Collapse merge details" …>
</div>
<div data-testid="ready_to_merge_state" class="gl-border-t-1 gl-border-t-solid gl-border-gray-100 gl-pl-7">
  … <p class="gl-mb-2 gl-text-gray-900">Merge details</p>
  <ul class="gl-pl-4 gl-mb-0 gl-ml-3 gl-text-gray-600">
    <li><span>Changes merged into <span class="label-branch gl-font-weight-bold">main</span> with
        <a data-testid="merge-commit-sha" class="gl-link label-branch" href="/…/-/commit/bbaaad30…">bbaaad30</a>.</span></li>
    <li>Deleted the source branch.</li>
    <li>… Mentions issue #12 …</li>
  </ul>
</div>
```

Verbatim: **`Merged by`** + author link + `<n> years ago`;
`Changes merged into <target> with <short sha>.`;
**`Deleted the source branch.`** (the alternate is `Did not delete the source branch.`).
`outerText` of `.mr-state-widget` on `!1292`:
`Approved by you \nMerged by Byte Blaze \n5 years ago (Jul 14, 2021 7:51am PDT)\n5 years ago\n\nMerge details\n\nChanges merged into main with bbaaad30.\nDeleted the source branch.\n\nMentions issue #12`
(the duplication comes from the `sr-only` span + the `<time>` element).

> There is **no** literal string `The source branch has been deleted` in this build — I grepped
> the whole `gitlab-rails` webpack bundle. Use `Deleted the source branch.` /
> `Did not delete the source branch.`

**(e) Closed** (`/a11yproject/…/327`)

`.mr-state-widget.outerText`:
`Approval is optional\nClosed by \n(Aug 7, 2026 12:53pm PDT)\nReopen\n\nMerge details\n\nThe changes were not merged into gh-pages.`

Verbatim: **`Closed by`** + author link + relative time; a **`Reopen`** button; detail list
`The changes were not merged into gh-pages.`
(On `!327` the closing user’s display name is blank — the underlying user is deleted, so the
widget renders `Closed by ` with an empty author. Reproduce the layout, not the blank.)

### Merge-widget copy I could NOT observe (present in the JS bundle, no seeded MR triggers them)

`Merge blocked: all required approvals must be given.` ·
`Merge blocked: all status checks must pass.` ·
`Merge blocked: all threads must be resolved.` ·
`Merge blocked: fast-forward merge is not possible.\nTo merge this request, first rebase locally.` ·
`Merge blocked: merge request must be marked as ready. It's still marked as draft.` ·
`Merge blocked: new changes were just added.` ·
`Merge blocked: pipeline must succeed. It's waiting for a manual action to continue.` ·
`Merge blocked: pipeline must succeed. It's waiting for a manual job to continue.` ·
`Merge blocked: pipeline must succeed. Push a commit that fixes the failure, or learn about other solutions.` ·
`Merge blocked: the source branch must be rebased onto the target branch.` ·
`Merge blocked: you can only merge after the above items are resolved.` ·
`Set by %{merge_author} to be merged automatically when the pipeline succeeds` ·
`Revert this merge request in a new merge request` / `Revert` ·
`Cherry-pick this merge request in a new merge request` / `Cherry-pick`.

There is **no** `Modify merge commit` label in 15.7.5 — the checkbox is `Edit commit message`.

### `Check out branch` modal

Triggered by `button.js-check-out-modal-trigger` (both the `Code ▾ → Check out branch` item and
the `Resolve locally` button). Not opened during this recon — record only the trigger labels
`Check out branch` and `Resolve locally`.

### Dashboard cross-reference

`/dashboard/merge_requests?assignee_username=byteblaze` (ANCHOR, webarena-156) and
`/dashboard/merge_requests?reviewer_username=byteblaze` (ANCHOR, webarena-357) are
`url_match`-only and are covered by the dashboard part; the navbar exposes them via the
merge-request icon (`a[title="Merge requests"][href="/dashboard/merge_requests?assignee_username=byteblaze"]`
with badge `8`) whose dropdown lists `Assigned to you` `3` and `Review requests for you` `5`.

---

## 16a. `/-/labels`

### Routes & title

| Route | `<title>` |
|---|---|
| `/:ns/:proj/-/labels` | `Labels · Byte Blaze / dotfiles · GitLab` (pattern: `Labels · <Owner Name> / <project> · GitLab`) |
| `/:ns/:proj/-/labels?subscribed=true` | same |
| `/:ns/:proj/-/labels?search=<q>` | same |
| `/:ns/:proj/-/labels?sort=<key>` | same |
| `/:ns/:proj/-/labels?page=2` | same |
| `/:ns/:proj/-/labels/new` | `New Label · Byte Blaze / dotfiles · GitLab` |
| `/:ns/:proj/-/labels/:id/edit` | `Edit Label · … · GitLab` |

Anchor-adjacent: labels drive the issue-filter anchors
`/a11yproject/a11yproject.com/-/issues/?label_name%5B%5D=bug` (ANCHOR, webarena-339),
`…?label_name%5B%5D=help%20wanted` (ANCHOR, webarena-102),
`/primer/design/-/issues/?label_name%5B%5D=type%3A%20bug%20%F0%9F%90%9E` (ANCHOR, webarena-340),
`/root/metaseq/-/issues/?label_name%5B%5D=enhancement` (ANCHOR), `…=None` (ANCHOR),
`/keycloak/keycloak/-/issues/?label_name%5B%5D=flaky-test` (ANCHOR),
`/kkroening/ffmpeg-python/-/issues/?label_name%5B%5D=question` (ANCHOR),
`/OpenAPITools/openapi-generator/-/issues/?label_name%5B%5D=OpenAPI%20Generator%20CLI` (ANCHOR),
`/umano/AndroidSlidingUpPanel/-/issues/?state=opened&not%5Blabel_name%5D%5B%5D=BUG` (ANCHOR).
So the label *titles* below must exist verbatim per project.

### Box structure

- Top navbar `.navbar-gitlab` 0/1920/48 (fixed).
- Left project sidebar `.nav-sidebar` 0/256. Active item: **Project information → Labels**
  (`<a href="/byteblaze/dotfiles/-/labels" aria-label="Labels">Labels</a>`).
- `.breadcrumbs` bar, breadcrumb trail: `Byte Blaze` › `dotfiles` › `Labels`
  (for a11yproject: `The A11Y Project` › `a11yproject.com` › `Labels`).
  On `/-/labels/new` a 4th crumb `New` is appended.
- `#content-body` measured **x=464, width=1248** (`.content-wrapper` = 256/1664). No right sidebar.

Breadcrumb DOM (identical shape on every page in this part):
```html
<nav class="breadcrumbs container-fluid container-limited project-highlight-puc" aria-label="Breadcrumbs">
 <div class="breadcrumbs-container">
  <button class="toggle-mobile-nav" data-qa-selector="toggle_mobile_nav_button"><span class="sr-only">Open sidebar</span>…</button>
  <div class="breadcrumbs-links" data-testid="breadcrumb-links" data-qa-selector="breadcrumb_links_content">
   <ul class="list-unstyled breadcrumbs-list js-breadcrumbs-list">
    <li><a href="/a11yproject">The A11Y Project</a><svg chevron-lg-right-icon></li>
    <li><a href="/a11yproject/a11yproject.com"><span class="breadcrumb-item-text js-breadcrumb-item-text">a11yproject.com</span></a><svg…></li>
    <li data-testid="breadcrumb-current-link" data-qa-selector="breadcrumb_current_link"><a href="…/-/labels">Labels</a></li>
```

### Header strip (`.top-area.adjust`) — only rendered when the project has ≥1 label, OR a `search`/`subscribed` param is present

Left: `ul.gl-flex-grow-1.gl-border-0.nav.gl-tabs-nav` with two tabs (no counters):

| Tab | href | active class |
|---|---|---|
| `All` | `/:ns/:proj/-/labels` | `nav-link gl-tab-nav-item active gl-tab-nav-item-active` |
| `Subscribed` | `/:ns/:proj/-/labels?subscribed=true` | `nav-link gl-tab-nav-item` |

Right (`.nav-controls`), in DOM order:

1. Search form (GET). `<input id="label-search" class="form-control search-text-input input-short" type="search" name="search" placeholder="Filter" spellcheck=false autofocus>` plus a hidden `<input id="subscribed" name="subscribed">`, and a submit `<button aria-label="Submit search">` with a search icon. Submits to `?search=<q>` (URL changes).
2. Sort dropdown — a `gl-dropdown … js-redirect-listbox`; toggle `<button data-testid="base-dropdown-toggle">` whose `.gl-dropdown-button-text` shows the current sort label (default `Name`). Menu `div[data-testid="base-dropdown-menu"] > .gl-dropdown-inner > ul#listbox[role=listbox]`, items `li.gl-dropdown-item.gl-listbox-item[role=option]`.

   | Option label | `?sort=` value |
   |---|---|
   | `Name` (default) | `name_asc` |
   | `Name, descending` | `name_desc` |
   | `Last created` | `created_desc` |
   | `Oldest created` | `created_asc` |
   | `Updated date` | `updated_desc` |
   | `Oldest updated` | `updated_asc` |

   (`?sort=name_desc` verified live; it changes the URL and reverses the list.)
3. `<a class="gl-button btn btn-md btn-confirm" data-qa-selector="create_new_label_button" href="/:ns/:proj/-/labels/new">New label</a>`

There is **no** `Promote to group label` CTA at the page level and **no**
`Generate a default set of labels` button in this strip — the latter only exists in the
empty state (below).

### Body (`.labels-container.gl-mt-5`)

1. `<p class="text-muted">Labels can be applied to issues and merge requests. Star a label to make it a priority label.</p>`
   (omitted when `search` is present).
2. `.prioritized-labels.gl-mb-7`
   - `<h4 class="gl-mt-3">Prioritized Labels</h4>` (capital L)
   - `<p class="text-muted">Drag to reorder prioritized labels and change their relative priority.</p>`
   - `.manage-labels-list.js-prioritized-labels` → when empty:
     `#js-priority-labels-empty-state.priority-labels-empty-state` containing an illustration
     `div.svg-content[data-qa-selector="label_svg_content"]` and `<p>Star labels to start sorting by priority</p>`.
   - If `search` is present and no prioritized match: `.nothing-here-block` → `No prioritized labels with such name or description`.
   - **Every project on this instance has zero prioritized labels**, so the empty state always shows.
3. `.other-labels` → `<h4>Other Labels</h4>` + `.manage-labels-list.js-other-labels` containing the `li.label-list-item`s + pager.

### Label row anatomy — `li.label-list-item.gl-p-5.gl-border-b`

`id="project_label_<id>"`, `data-id="<id>"`. Three children:

```html
<li class="label-list-item gl-p-5 gl-border-b" id="project_label_1927">
  <div class="label-name gl-flex-shrink-0 gl-mt-2 gl-mr-5">
    <span class="gl-label">
      <span class="gl-label-text gl-label-text-light" style="background-color: #fc2929">bug</span>
    </span>
  </div>
  <div class="label-description gl-overflow-hidden gl-w-full">
    <div class="gl-display-flex gl-align-items-stretch gl-flex-wrap gl-mt-2">
      <div class="gl-flex-basis-half gl-flex-grow-1 gl-overflow-hidden gl-mr-5">
        <!-- if the label HAS a description: the rendered markdown goes here.
             if NOT: this full-path chip is rendered instead -->
        <div class="label-badge gl-bg-gray-50 gl-max-w-full gl-text-truncate"
             title="Byte Blaze / dotfiles">Byte Blaze / dotfiles</div>
      </div>
      <ul class="label-links gl-m-0 gl-p-0 gl-white-space-nowrap">
        <li class="inline"><a class="gl-text-blue-600!"
            href="/byteblaze/dotfiles/-/issues?label_name%5B%5D=bug">Issues</a></li>
        ·
        <li class="inline"><a class="gl-text-blue-600!"
            href="/byteblaze/dotfiles/-/merge_requests?label_name%5B%5D=bug">Merge requests</a></li>
      </ul>
    </div>
  </div>
  <ul class="label-actions-list"> … </ul>
</li>
```

Notes:
- The link labels are literally `Issues` and `Merge requests` (NOT `N issues` / `N merge requests` — there are no counts here). Separator between them is a middot `·` text node.
- The two links are only rendered when the project has issues / MRs enabled.
- Space in a title is `+`-encoded in these hrefs: `…?label_name%5B%5D=help+wanted`.
- `.gl-label-text-light` = white text (dark bg); `.gl-label-text-dark` = dark text (light bg). Colour is an inline `style="background-color: #rrggbb"` on the `.gl-label-text` span.
- If the label is prioritized, an extra `li.js-priority-badge.inline.gl-ml-3` with
  `<div class="label-badge gl-bg-blue-50">Prioritized label</div>` is appended to `.label-links`
  (also available as `<template id="js-badge-item-template">` at the bottom of the page).

`ul.label-actions-list` items, in order:

| # | Element | Copy / tooltip |
|---|---|---|
| 1 | `li.gl-display-inline-block.js-toggle-priority.gl-ml-3` with **two** tertiary icon buttons | `button.remove-priority.has-tooltip[title="Remove priority"][aria-label="Deprioritize label"]` (star icon) and `button.add-priority.has-tooltip[title="Prioritize"][aria-label="Prioritize label"]` (star-o icon). Only one is visible at a time. |
| 2 | `li` → `a.edit.has-tooltip` `href="/:ns/:proj/-/labels/<id>/edit"` `title="Edit"` | pencil icon |
| 3 | `li` → `.dropdown` with `button.js-label-options-dropdown[aria-label="Label actions dropdown"]` (⋮ `ellipsis_v` icon) and `.dropdown-menu.dropdown-open-left > ul` | see below |
| 4 | `li.label-subscription.js-label-subscription.gl-ml-3` → `button.js-subscribe-button.gl-w-full[title="Subscribe at project level"]` with text `Subscribe` | toggles to `Unsubscribe` |

⋮ menu contents (verified live on `/byteblaze/dotfiles/-/labels`):
```html
<div class="dropdown-menu dropdown-open-left show"><ul><li><span>
  <button class="gl-button btn btn-md btn-default btn-default-tertiary text-danger js-delete-label-modal-button"
          data-label-name="bug" data-subject-name="dotfiles"
          data-destroy-path="/byteblaze/dotfiles/-/labels/1927"><span class="gl-button-text">Delete</span></button>
</span></li></ul></div>
```
It contains **only `Delete`**. A `Promote to group label` `<li>` is prepended *only* when the
label's project lives inside a group AND the user can admin that group's labels — no project
visible to `byteblaze` on this instance satisfies that, so it is never shown in the base data.
(Copy, if you implement it: `Promote to group label`, `button.js-promote-project-label-button`.)

The `Edit`-icon and the ⋮ menu and the priority buttons are all gated on
`can?(current_user, :admin_label, …)`; on a project where byteblaze is not a maintainer they
disappear and only `Subscribe` remains.

**Delete-label modal** (opened by the ⋮ → `Delete` button; `id="modal-delete-label-N___BV_modal_content_"`):
- Header `<h4 class="modal-title">Delete label: bug</h4>` (title = `Delete label: ` + the label name)
- Body: `<strong>bug</strong> will be permanently deleted from dotfiles. This cannot be undone.`
  (pattern: `<b>{label}</b> will be permanently deleted from {project name}. This cannot be undone.`)
- Footer: `Cancel` (`btn-default-secondary`) and
  `<a data-method="delete" data-testid="delete-button" href="/byteblaze/dotfiles/-/labels/1927" class="btn btn-danger …"><span class="gl-button-text">Delete label</span></a>`
- Close `X` button `aria-label="Close"`.

### Pagination

20 labels per page. Rendered as `div.gl-pagination.gl-mt-3 > ul.pagination.justify-content-center`
inside `.other-labels`, after the list. Items:
`li.page-item.js-previous-button[.disabled] > a.page-link` → chevron + `Prev`;
`li.page-item.js-pagination-page[.active][.sibling][.js-first-button][.js-last-button][.d-none.d-md-block] > a.page-link` → `1`, `2`;
`li.page-item.js-next-button[.disabled] > a.page-link` → `Next` + chevron.
Hrefs: page 1 = bare path, page 2 = `?page=2`. Disabled buttons use `href="#"`.

### EMPTY state — verbatim (verified live on `/byteblaze/timeit/-/labels`)

When the project has **no** labels and no `search`/`subscribed` param, the whole `.top-area`
(tabs / Filter / sort / New label) is **not rendered at all**. `#content-body` innerText is exactly:

```
Labels can be applied to issues and merge requests to categorize them.

You can also star a label to make it a priority label.

New label Generate a default set of labels
```

DOM:
```html
<div class="row empty-state labels">
  <div class="col-12"><div class="svg-content" data-qa-selector="label_svg_content">
      <img class="js-lazy-loaded" src="/assets/illustrations/labels-….svg" loading="lazy"
           data-qa_selector="js_lazy_loaded_content"></div></div>
  <div class="col-12"><div class="text-content">
      <h4>Labels can be applied to issues and merge requests to categorize them.</h4>
      <p>You can also star a label to make it a priority label.</p>
      <div class="text-center">
        <a class="btn gl-button btn-confirm" title="New label" id="new_label_link"
           href="/byteblaze/timeit/-/labels/new">New label</a>
        <a class="btn gl-button btn-confirm-secondary" title="Generate a default set of labels"
           id="generate_labels_link" rel="nofollow" data-method="post"
           href="/byteblaze/timeit/-/labels/generate">Generate a default set of labels</a>
      </div></div></div>
</div>
```

`Generate a default set of labels` POSTs to `…/-/labels/generate` and creates these 8 labels
(`Gitlab::IssuesLabels.generate`), then redirects back to `…/-/labels`:

| title | colour |
|---|---|
| `bug` | `#d9534f` |
| `critical` | `#d9534f` |
| `confirmed` | `#d9534f` |
| `documentation` | `#f0ad4e` |
| `support` | `#f0ad4e` |
| `discussion` | `#428bca` |
| `suggestion` | `#428bca` |
| `enhancement` | `#5cb85c` |

### Other "nothing found" states (verbatim, all `.nothing-here-block`)

| Condition | Copy |
|---|---|
| `?search=zzzz`, project has labels but none match | `No labels with such name or description` |
| `?search=…` and some *available* labels exist but no *other* labels match | heading `Other Labels` + `No other labels with such name or description` |
| `?search=…`, no prioritized match | `No prioritized labels with such name or description` |
| `?subscribed=true` with no subscriptions | `You do not have any subscriptions yet` |

Verified live: `/byteblaze/dotfiles/-/labels?subscribed=true` `#content-body` innerText =
`All / Subscribed / Name / New label / Labels can be applied to issues and merge requests. Star a label to make it a priority label. / You do not have any subscriptions yet`
and `?search=zzzz` = `All / Subscribed / Name / New label / No labels with such name or description`
(note: with a `search` present the `text-muted` intro paragraph and the Prioritized/Other headings are suppressed).

### Seed data — exact label lists

`/byteblaze/dotfiles/-/labels` (7 labels, ids 1927–1933, all `label-badge` = `Byte Blaze / dotfiles`, no descriptions):

| id | title | background-color | text class |
|---|---|---|---|
| 1927 | `bug` | `#fc2929` | light |
| 1928 | `duplicate` | `#cccccc` | dark |
| 1929 | `enhancement` | `#84b6eb` | dark |
| 1930 | `help wanted` | `#159818` | light |
| 1931 | `invalid` | `#e6e6e6` | dark |
| 1932 | `question` | `#cc317c` | light |
| 1933 | `wontfix` | `#ffffff` | dark |

`/a11yproject/a11yproject.com/-/labels` (31 labels, ids 1752–1782, badge `The A11Y Project / a11yproject.com`, 20 on page 1, 11 on page 2):

page 1 — `abandoned` `#737373`, `accessibility` `#e11d21`, `administration` `#ffce29`,
`article audit` `#ffce29`, `bug` `#e11d21` (ANCHOR), `checklist` `#e2fed2`, `claimed` `#3b4bbf`,
`content` `#ffce29`, `data` `#f1cbe6`, `dependencies` `#f1cbe6`, `design` `#ffce29`,
`eleventy` `#f1cbe6`, `enhancement` `#d4c5f9`, `feature` `#d4c5f9`, `good first issue` `#e2fed2`,
`gulp` `#f1cbe6`, `help wanted` `#e11d21` (ANCHOR), `idea` `#d4c5f9`, `in review` `#3b4bbf`,
`javascript` `#f1cbe6`.

page 2 — `markup` `#f1cbe6`, `netlify` `#f1cbe6`, `node` `#f1cbe6`,
`not ready for merge` `#3b4bbf`, `post` `#e2fed2`, `question` `#d4c5f9`, `redesign` `#ffce29`,
`rejected` `#737373`, `resource` `#e2fed2`, `spam` `#e11d21`, `styling` `#f1cbe6`.

`/byteblaze/gimmiethat.space/-/labels` (9, ids 1888–1896 — the GitHub default palette):
`bug` `#d73a4a`, `documentation` `#0075ca`, `duplicate` `#cfd3d7`, `enhancement` `#a2eeef`,
`good first issue` `#7057ff`, `help wanted` `#008672`, `invalid` `#e4e669`, `question` `#d876e3`,
`wontfix` `#ffffff`.

`/byteblaze/timeit/-/labels` → **0 labels** (use it to reproduce the empty state).

### `/-/labels/new` (and `/-/labels/:id/edit`)

`<h1 class="page-title gl-font-size-h-display">New Label</h1>` (edit page: `Edit Label`).
`<form class="label-form js-quick-submit js-requires-input" id="new_label">`:

| Field | DOM |
|---|---|
| `Title` | `<label for="label_title">Title</label>` `<input id="label_title" class="gl-form-input form-control js-label-title" data-qa-selector="label_title_field" name="label[title]" type=text>` |
| `Description` | `<label for="label_description">Description</label>` `<input id="label_description" class="gl-form-input form-control js-quick-submit" data-qa-selector="label_description_field" name="label[description]" type=text>` (a single-line text input, **not** a textarea, no markdown toolbar) |
| `Background color` | `<label for="label_color">Background color</label>`, `.input-group` with `.input-group-prepend > .input-group-text.label-color-preview` swatch + `<input id="label_color" class="gl-form-input form-control" data-qa-selector="label_color_field" name="label[color]" value="#6699cc">` |

Help text under the colour field: `<div class="form-text text-muted">Choose any color.<br>Or you can choose one of the suggested colors below</div>`
followed by `.suggest-colors` — 21 `<a class="has-tooltip" href="#" title="…">` swatches with titles, in order:
`Green-cyan`, `Dark sea green`, `Medium sea green`, `Green screen`, `Dark green`, `Blue-gray`,
`Blue`, `Lavender`, `Dark violet`, `Deep violet`, `Gray`, `Charcoal grey`, `Champagne`,
`Rose red`, `Magenta-pink`, `Crimson`, `Red`, `Dark coral`, `Titanium yellow`, `Carrot orange`,
`Aztec Gold`.

Footer `.gl-display-flex.gl-justify-content-space-between`:
`<button class="gl-button btn btn-md btn-confirm js-save-button gl-mr-2 disabled" data-qa-selector="label_create_button" type="submit">Create label</button>`
(starts `disabled` until Title is non-empty — `js-requires-input`) and
`<a class="gl-button btn btn-md btn-default" href="/:ns/:proj/-/labels">Cancel</a>`.

---

## 16b. `/-/milestones` and milestone detail

### Routes & titles

| Route | `<title>` | Notes |
|---|---|---|
| `/byteblaze/dotfiles/-/milestones` | `Milestones · Byte Blaze / dotfiles · GitLab` | **ANCHOR** (webarena-593, 594) — currently EMPTY |
| `/primer/design/-/milestones` | `Milestones · Primer / design · GitLab` | **ANCHOR** (webarena-590, 591, 592) — currently EMPTY |
| `/:ns/:proj/-/milestones?state=opened` \| `…?sort=due_date_desc&state=closed` \| `…&state=all` | same | tab links |
| `/:ns/:proj/-/milestones?search_title=<q>` | same | filter form |
| `/:ns/:proj/-/milestones?sort=<key>` | same | |
| `/:ns/:proj/-/milestones/new` | `New Milestone · Byte Blaze / dotfiles · GitLab` | |
| `/:ns/:proj/-/milestones/:iid` | `<Milestone title> · Milestones · Byte Blaze / dotfiles · GitLab` | **ANCHOR** target of `#content-body`, `.block.start_date`, `.block.due_date` |
| `/:ns/:proj/-/milestones/:iid/edit` | `Edit Milestone · … · GitLab` | |
| `/:ns/:proj/-/milestones/:iid?milestone%5Bstate_event%5D=close` / `…=activate` | — | PUT-style links |
| `/dashboard/milestones` | `Milestones · Dashboard · GitLab` | cross-project list |

Breadcrumbs: `Byte Blaze` › `dotfiles` › `Milestones` ( › `New` on the new form,
› `<milestone title>` on the detail page). Left sidebar active item: **Issues → Milestones**
(`/:ns/:proj/-/milestones`).

`#content-body`: **x=464, width=1248** on list/new. On the **detail** page it is
**x=319, width=1248** because the affixed right sidebar occupies **x=1630, width=290**
(`.content-wrapper` 256/1664).

### List page header (`.top-area`) — only when ≥1 milestone exists in any state

Tabs `ul.gl-border-b-0.gl-flex-grow-1.nav.gl-tabs-nav[data-testid="milestones-filter"]`:

| Tab | href | badge |
|---|---|---|
| `Open` | `?state=opened` | `span.gl-badge.badge.badge-pill.badge-muted.sm.gl-tab-counter-badge.gl-display-none.gl-sm-display-inline-flex` |
| `Closed` | `?sort=due_date_desc&state=closed` | ditto |
| `All` | `?sort=due_date_desc&state=all` | ditto |

Observed on `/a11yproject/a11yproject.com/-/milestones`: `Open 4`, `Closed 2`, `All 6`.

`.nav-controls`:
1. GET form: `<input id="search_title" name="search_title" type="search" class="form-control gl-form-input input-short" placeholder="Filter by milestone name">` + hidden `#state` and `#sort` inputs.
2. Sort dropdown `div[data-testid="milestone_sort_by_dropdown"]` (gl-dropdown / js-redirect-listbox), current value in `.gl-dropdown-button-text` (default `Due soon`). Options:
   `Due soon`, `Due later`, `Start soon`, `Start later`, `Name, ascending`, `Name, descending`
   (`?sort=` values `due_date_asc`, `due_date_desc`, `start_date_asc`, `start_date_desc`, `name_asc`, `name_desc`).
3. `<a class="gl-button btn btn-confirm gl-ml-3" data-qa-selector="new_project_milestone_link" href="/:ns/:proj/-/milestones/new" title="New milestone">New milestone</a>`

### Milestone row anatomy — `li.milestone.milestone-open` / `li.milestone.milestone-closed`, `id="milestone_<db id>"`

Inside `.milestones > ul.content-list`. Three bootstrap columns:

**`.col-md-6`**
```html
<div class="gl-mb-2">
  <strong data-qa-selector="milestone_link" data-qa-milestone-title="…">
    <a href="/a11yproject/a11yproject.com/-/milestones/3">Content Updates for 2019</a></strong>
  <!-- on /dashboard/milestones and group lists only: -->  - Project Milestone
</div>
<div class="text-tertiary gl-mb-2">expired on Dec 31, 2019</div>   <!-- milestone_date_range -->
<div>
  <span class="gl-badge badge badge-pill badge-warning md gl-mb-2">Expired</span>
  <span class="gl-badge badge badge-pill badge-muted md gl-white-space-normal gl-text-left">The A11Y Project / a11yproject.com</span>
</div>
```

**Date-range line (`milestone_date_range` / `timebox_date_range`) — exact formulas.**
Date format everywhere here is Rails `:medium` = `%b %-d, %Y` → e.g. `Jan 16, 2030`, `Mar 8, 2030`, `May 1, 2044`.

| Case | String |
|---|---|
| start **and** due | `<start>–<due>` — U+2013 EN DASH, **no spaces** → `Jan 16, 2030–Jan 30, 2030` |
| due only, past | `expired on Dec 31, 2019` |
| due only, future | `expires on Jan 30, 2030` |
| start only, past | `started on Mar 1, 2019` |
| start only, future | `starts on Mar 15, 2044` |
| neither | line is not rendered at all |

**Badge (`shared/_milestone_expired`)** — 0..2 badges, in this order:

| Condition | Badge | classes |
|---|---|---|
| `due_date && due_date.past?` && not closed | `Expired` | `badge-warning` |
| `start_date && start_date.future?` | `Upcoming` | `badge-info` |
| `closed?` | `Closed` | `badge-danger` |

Then the project full-name chip `badge-muted` (`The A11Y Project / a11yproject.com`).
On a group milestone the chip is `badge-info` with the group full name.

**`.col-md-4.milestone-progress`**
```html
<div class="progress"><div class="progress-bar bg-success" style="width: 83%;"></div></div>
<a href="/a11yproject/a11yproject.com/-/issues?milestone_title=Content+Updates+for+2019">18 Issues</a>
·
<a href="/a11yproject/a11yproject.com/-/merge_requests?milestone_title=Content+Updates+for+2019">8 Merge requests</a>
<div class="float-lg-right light">83% complete</div>
```
Counts are `pluralize(n, 'Issue')` / `pluralize(n, 'Merge request')` → `0 Issues`, `1 Issue`,
`18 Issues`, `0 Merge requests`, `8 Merge requests`. Separator is a middot `·`.
The percentage line is `N% complete` (e.g. `0% complete`, `83% complete`, `100% complete`).
On `/dashboard/milestones` the two links point at `/dashboard/issues?milestone_title=…` and
`/dashboard/merge_requests?milestone_title=…` instead.

**`.col-md-2` → `.milestone-actions.d-flex.justify-content-sm-start.justify-content-md-end`**
There is **no ⋮ menu on the list page**. A single link button:

| State | Copy | href | classes |
|---|---|---|---|
| open | `Close Milestone` | `/:ns/:proj/-/milestones/:iid?milestone%5Bstate_event%5D=close` | `btn gl-button btn-default btn-default-secondary btn-sm gl-ml-3` |
| closed | `Reopen Milestone` | `…?milestone%5Bstate_event%5D=activate` | `btn gl-button btn-sm gl-ml-3` |

(If the project is in a group and the user can admin group milestones, a disabled tertiary
`level-up` icon button titled `Promote to Group Milestone` is prepended. Not reachable here.)

### EMPTY state — verbatim (this is what `/byteblaze/dotfiles/-/milestones` and `/primer/design/-/milestones` show TODAY — both ANCHOR routes)

No `.top-area` at all. `#content-body`:

```html
<div class="row empty-state">
  <div class="col-12"><div class="svg-content"><img class="js-lazy-loaded"></div></div>
  <div class="col-12"><div class="text-content text-center">
    <h4>Use milestones to track issues and merge requests over a fixed period of time</h4>
    <p class="state-description">Organize issues and merge requests into a cohesive group, and set optional start and due dates.
      <a href="/help/user/project/milestones/index">Learn more.</a></p>
    <div class="text-center">
      <a class="gl-button btn btn-confirm" data-qa-selector="new_project_milestone_link"
         href="/byteblaze/dotfiles/-/milestones/new" title="New milestone">New milestone</a>
    </div>
  </div></div>
</div>
```
Strings verified verbatim: `Use milestones to track issues and merge requests over a fixed period of time`,
`Organize issues and merge requests into a cohesive group, and set optional start and due dates.`,
`Learn more.`, `New milestone`.

Because webarena-590..594 *create* milestones on these two projects, the mock must switch this
page from the empty state to the populated list once a milestone is created.

### Seed data — the only milestones on the instance

All belong to `/a11yproject/a11yproject.com`. Project-level list: `Open 4`, `Closed 2`, `All 6`.

| iid | db id | title | date line | badge | issues | MRs | progress |
|---|---|---|---|---|---|---|---|
| 6 | 589 | `2019 Replatforming` | `expired on Dec 31, 2019` | `Expired` | 0 Issues | 0 Merge requests | `0% complete` |
| 5 | 588 | `Living Styleguide` | `expired on Dec 31, 2019` | `Expired` | 0 Issues | 0 Merge requests | `0% complete` |
| 4 | 587 | `2019 Redesign` | `expired on Dec 31, 2019` | `Expired` | 2 Issues | 0 Merge requests | `100% complete` |
| 3 | 586 | `Content Updates for 2019` | `expired on Dec 31, 2019` | `Expired` | 18 Issues | 8 Merge requests | `83% complete` |
| 1 | 585 | `Winter Sprint` (closed) | `expired on Jan 14, 2014` | `Closed` | 12 Issues | 0 Merge requests | `100% complete` |
| 2 | 584 | `2015 Design Refresh` (closed) | *(none — no dates)* | `Closed` | 4 Issues | 0 Merge requests | `100% complete` |

None of them has a start date, so `.block.start_date` always renders `No start date` in the
base data. Every task-created milestone (see below) *will* have one.

`/dashboard/milestones` renders the same rows with ` - Project Milestone` appended after the
title link and a `Select project to create milestone` split-button in the page header
(`h1.page-title.gl-font-size-h-display` = `Milestones`, select2 placeholder `Search for project or group`).

### Milestone DETAIL page `/-/milestones/:iid` — **ANCHOR-critical**

Evaluators run, on this page:
- `document.querySelector("#content-body").outerText` (ANCHOR — webarena-590..593)
- `document.querySelector('.block.start_date').outerText` (ANCHOR — webarena-590..593)
- `document.querySelector('.block.due_date').outerText` (ANCHOR — webarena-590..593)

**The right sidebar is INSIDE `#content-body`** (verified: `#content-body.contains(.right-sidebar) === true`),
so `#content-body`.outerText contains the title, description, tabs *and* both dates.

Structure of `#content-body`, in order:

**1. `div.detail-page-header.milestone-page-header`**
```html
<div class="status-box gl-bg-orange-500">Past due</div>
<div class="header-text-content">
  <span class="identifier"><strong>Milestone</strong></span>
  expired on Dec 31, 2019            <!-- milestone_date_range, same formulas as the list -->
</div>
<div class="milestone-buttons">
  <a class="gl-button btn btn-md btn-default btn-grouped" href="…/-/milestones/3/edit">Edit</a>
  <a class="gl-button btn btn-md btn-default btn-grouped btn-close"
     href="…/-/milestones/3?milestone%5Bstate_event%5D=close">Close milestone</a>
  <button class="gl-button btn btn-md btn-danger js-delete-milestone-button btn-grouped" disabled>
     <span class="gl-button-text"><span class="gl-spinner-container gl-mr-2 js-loading-icon hidden">…</span>Delete</span></button>
  <button class="gl-button btn btn-icon btn-md btn-default btn-grouped gl-float-right! gl-sm-display-none js-sidebar-toggle"
          aria-label="Toggle sidebar">…</button>
</div>
```
`.status-box` copy + class (`milestone_status_string` / `status_box_class`):

| Condition (in this order) | text | class |
|---|---|---|
| `closed?` | `Closed` | `gl-bg-red-500` (status_box) — note `expired?` wins if also past due → `gl-bg-orange-500` |
| `expired?` (due date in the past) | `Past due` | `gl-bg-orange-500` |
| `upcoming?` (start date in the future) | `Upcoming` | `gl-bg-gray-500` |
| otherwise | `Open` | `gl-bg-green-500` |

When closed, the header button reads `Reopen milestone` and links to `…?milestone%5Bstate_event%5D=activate`.
If the project belongs to a group there is an extra disabled `Promote` button + `#promote-milestone-modal`.

**2. `div.detail-page-description.milestone-detail`**
```html
<h2 class="gl-m-0" data-qa-selector="milestone_title_content">Content Updates for 2019</h2>
<div data-qa-selector="milestone_description_content">
  <div class="description md gl-px-0 gl-pt-4 gl-border-1 gl-border-t-solid gl-border-gray-100">
    <p>…rendered markdown…</p>
  </div>
</div>
```
(When all issues are closed, a `shared/milestones/_milestone_complete_alert` is rendered here with
`All issues for this milestone are closed.` + `You may close the milestone now.` (group) or
`Navigate to the project to close the milestone.` (project).)

**3. Tabs — `.scrolling-tabs-container.inner-page-scroll-tabs.is-smaller`**
`ul.scrolling-tabs.js-milestone-tabs.nav.gl-tabs-nav[role=tablist]` with `.fade-left` / `.fade-right`
chevron overlays. Each is `<a class="nav-link gl-tab-nav-item" id="gl_tab_nav__tab_N" href="#tab-…" role="tab">`
followed by `<span class="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge">N</span>`.

| Tab | href | example count |
|---|---|---|
| `Issues` (active by default; URL gets `#tab-issues`) | `#tab-issues` | `18` |
| `Merge requests` | `#tab-merge-requests` | `8` |
| `Participants` | `#tab-participants` | `1` |
| `Labels` | `#tab-labels` | `8` |

Panes: `div.tab-content.milestone-content > div.tab-pane[.active]#tab-issues|#tab-merge-requests|#tab-participants|#tab-labels`.

**4. Issues pane — three equal columns (`div.row.gl-mt-3` → 3× `div.col-md-4`)**

| Column header (verbatim) | list id |
|---|---|
| `Unstarted Issues (open and unassigned)` | `ul#issues-list-unassigned` |
| `Ongoing Issues (open and assigned)` | `ul#issues-list-ongoing` |
| `Completed Issues (closed)` | `ul#issues-list-closed` |

Each column is `div.gl-card.gl-mb-5` → `div.gl-card-header.gl-display-flex` containing
`div.gl-flex-grow-2` (the title) and `div.gl-ml-3.gl-flex-shrink-0.gl-font-weight-bold.gl-white-space-nowrap.gl-text-gray-500 > span` (issues icon + count),
then `div.gl-card-body.gl-py-0 > ul.content-list.milestone-issues-list`.
An empty column keeps the card and shows `0`, with an empty `<ul>` (the middle column's header
additionally carries `gl-border-bottom-0 gl-rounded-base`).

Row: `li.issuable-row`
```html
<span><a href="…/-/issues/773" title="Article Audit: Use skip navigation links">Article Audit: Use skip navigation links</a></span>
<div class="issuable-detail">
  <a class="issue-link" href="…/-/issues/773"><span class="issuable-number">#773</span></a>
  <span class="gl-label gl-label-sm"><a class="gl-link gl-label-link"
      href="…/-/issues?label_name=article+audit&milestone_title=Content+Updates+for+2019&state=all">
      <span class="gl-label-text gl-label-text-dark">article audit</span></a></span>
  …
  <span class="assignee-icon">
    <a class="has-tooltip" href="…/-/issues?assignee_id=2330&milestone_title=…&state=all"
       title="Assigned to Byte Blaze"><img class="avatar s16 js-lazy-loaded"></a>
  </span>
</div>
```

**Participants pane**: `ul.bordered-list > li > a[title=<name>].gl-display-flex` → 32px avatar +
`div` with `<strong>{user.name}</strong>` and `<small class="cgray">{username}</small>` (bare username, no `@`).

**Labels pane**: `ul.bordered-list.manage-labels-list > li.no-border` → the label pill (linking to
`…/-/issues?milestone_title=…&label_name=…`), `span.prepend-description-left` with the label
description, and a right-floated `div.float-right.d-none.d-lg-block` with two tertiary buttons:
`N open issue` / `N open issues` and `N closed issue` / `N closed issues`.

### Right sidebar — `aside.right-sidebar.js-right-sidebar.right-sidebar-expanded[aria-label="Milestone"]`

x=1630, width=290. Inner wrapper `div.issuable-sidebar.milestone-sidebar`. Blocks in order:

1. `div.block.milestone-progress.issuable-sidebar-header` — collapse toggle
   `a.gutter-toggle.float-right.js-sidebar-toggle.has-tooltip[title="Collapse sidebar"][aria-label="Toggle sidebar"]`,
   `.title.hide-collapsed` = `<strong class="bold">83%</strong><span class="hide-collapsed"> complete </span>`,
   `.value.hide-collapsed` = `div.progress > div.progress-bar.bg-success[style="width: 83%;"]`.
2. `div.block.milestone-progress.hide-expanded` — collapsed-mode duplicate with
   `title="Progress<br />83% complete"`.
3. **`div.block.start_date.hide-collapsed`** (ANCHOR selector `.block.start_date`)
   ```html
   <div class="block start_date hide-collapsed">
     <div class="title">Start date
       <a class="js-sidebar-dropdown-toggle edit-link float-right" href="…/-/milestones/3/edit">Edit</a></div>
     <div class="value">
       <span class="value-content" data-qa-selector="start_date_content">
         <span class="no-value">No start date</span>            <!-- when unset -->
         <!-- when set: --> <span class="bold">Jan 16, 2030</span>
       </span></div>
   </div>
   ```
   `.outerText` when unset (verified live): `Start date\nEdit\nNo start date`
   `.outerText` when set: `Start date\nEdit\nJan 16, 2030`
   The `Edit` link is only rendered when the user can admin the milestone.
4. **`div.block.due_date`** (ANCHOR selector `.block.due_date`)
   ```html
   <div class="block due_date">
     <div class="sidebar-collapsed-icon">   <!-- collapsed-mode only -->
       <span aria-hidden="true"><svg data-testid="calendar-icon">…</svg></span>
       <span class="collapsed-milestone-date">
         Until
         <div class="milestone-date has-tooltip" title="End date <br /> Dec 31, 2019 (over 6 years ago)">Dec 31 2019</div>
       </span></div>
     <div class="title hide-collapsed">Due date
       <a class="js-sidebar-dropdown-toggle edit-link float-right" href="…/-/milestones/3/edit">Edit</a></div>
     <div class="value hide-collapsed">
       <span class="value-content" data-qa-selector="due_date_content"><span class="bold">Dec 31, 2019</span></span>
       (<span class="remaining-days"><strong>Past due</strong></span>)
     </div>
   </div>
   ```
   `.outerText` (verified live): `Due date\nEdit\nDec 31, 2019 (Past due)`
   When no due date: `<span class="no-value">No due date</span>` and no `(…)` suffix.

   **`.remaining-days` copy (`remaining_days_in_words(due_date, start_date)`), evaluated top-down:**

   | Condition | Text |
   |---|---|
   | due date in the past | `Past due` (wrapped in `<strong>`) |
   | due date is today | `Today` |
   | start date in the future | `Upcoming` |
   | else, due date set | `distance_of_time_in_words(due, today)` with digits bolded, `about ` stripped, then ` remaining` (future) or ` ago` (past). e.g. `4 years remaining`, `3 days remaining` |
   | else, start date in the past | `N days elapsed` / `N day elapsed` |
   | else | nothing (the `( )` wrapper is not rendered) |

   Collapsed-mode `.collapsed-milestone-date` prefix: `Until` (due only), `From` (start only),
   `None` (neither); with both dates it renders `<start %b %-d[ %Y]>`, `.date-separator` = `-`,
   `<due %b %-d %Y>`.
5. `div.block.issues` — `.title.hide-collapsed` = `Issues` + muted `sm` badge with the count,
   plus a right-floated `New issue` link (`href="/:ns/:proj/-/issues/new?issue[milestone_id]=<id>"`, `title="New Issue"`).
   `.value.hide-collapsed.bold` has two `span.milestone-stat` links: `Open: 3` and `Closed: 15`.
6. `div.block` → `div.js-sidebar-time-tracking-root`, rendering `Time tracking` /
   `No estimate or time spent`.
7. `div.block.merge-requests` — title `Merge requests` + badge; three `span.milestone-stat`
   links `Open: 0`, `Closed: 0`, `Merged: 8`.
8. `div.block.releases` — title `Release` / `Releases`; `div.no-value` = `None` when 0.
9. `div.block.reference` — `Reference:` + `<span title="…">a11yproject/a11yproject.com%"Content Updates for 2019"</span>`
   plus two clipboard buttons `title="Copy reference"`.

Full sidebar `.outerText` for milestone 3 (verbatim reference):
```
83% complete
Start date
Edit
No start date
Due date
Edit
Dec 31, 2019 (Past due)
Issues 18
New issue
Open: 3
Closed: 15
Time tracking
No estimate or time spent
Merge requests 8
Open: 0
Closed: 0
Merged: 8
Releases
None
Reference: a11yproject/a11yproject.com%"Content Updates for 2019"
```

### ANCHOR date values the mock must be able to render

All are `%b %-d, %Y`, all appear via `.block.start_date` / `.block.due_date` / `#content-body` of a
milestone the *task* creates:

| Task | milestone | start date | due date |
|---|---|---|---|
| webarena-590 | on `/primer/design` | `Jan 16, 2030` (ANCHOR) | `Jan 30, 2030` (ANCHOR) |
| webarena-591 | on `/primer/design` | `Jan 16, 2030` (ANCHOR) | `Feb 5, 2030` (ANCHOR) |
| webarena-592 | on `/primer/design` | `Mar 8, 2030` (ANCHOR) | `Feb 16, 2030` (ANCHOR) |
| webarena-593 | on `/byteblaze/dotfiles` | `Mar 15, 2044` (ANCHOR) | `Mar 30, 2044` (ANCHOR) |
| webarena-594 | on `/byteblaze/dotfiles` | `May 1, 2044` (ANCHOR) | `May 21, 2044` (ANCHOR) |

Milestone titles used by those tasks (ANCHOR strings that must round-trip through create → list → detail):
`product launch`, `code review`, `sensitive information`, `all branches to main`,
`zsh comprehensive support` (webarena-594, ANCHOR).
Since all these dates are in the future, the created milestones render badge `Upcoming`,
status box `Upcoming` (`gl-bg-gray-500`), date-range line `Jan 16, 2030–Jan 30, 2030`, and
`.block.due_date` outerText `Due date\nEdit\nJan 30, 2030 (Upcoming)`.

### `/-/milestones/new` (and `/-/milestones/:iid/edit`)

`<h1 class="page-title gl-font-size-h-display">New Milestone</h1>` then `<hr>`, then
`<form class="milestone-form common-note-form js-quick-submit js-requires-input gfm-form" id="new_milestone">`.
Row layout is `div.form-group.row` with `div.col-form-label.col-sm-2` labels.

| Field | Label | Input |
|---|---|---|
| Title | `Title` (`for="milestone_title"`) | `input#milestone_title.form-control.gl-form-input[data-qa-selector="milestone_title_field"][name="milestone[title]"]` in `.col-sm-10` |
| Start date | `Start Date` (`for="milestone_start_date"`) | `input#milestone_start_date.datepicker.form-control.gl-form-input[data-qa-selector="start_date_field"][name="milestone[start_date]"] placeholder="Select start date"` in `.col-sm-4`, followed by `<a class="inline float-right gl-mt-2 js-clear-start-date" href="#">Clear start date</a>` and a `div.pika-single.gitlab-theme.animate-picker.is-hidden.is-bound` calendar |
| Due date | `Due Date` (`for="milestone_due_date"`) | `input#milestone_due_date.datepicker…[data-qa-selector="due_date_field"][name="milestone[due_date]"] placeholder="Select due date"`, `<a class="inline float-right gl-mt-2 js-clear-due-date" href="#">Clear due date</a>`, pika calendar |
| Description | `Description` (`for="milestone_description"`) | full GFM editor (below) |

Note the labels are `Start Date` / `Due Date` (title-cased) on the **form**, but
`Start date` / `Due date` in the **sidebar**. Both matter.
Start Date and Due Date share one `div.form-group.row.` (two `col-sm-2` labels + two `col-sm-4` inputs).

Description editor (`div.form-group.row.milestone-description > .col-sm-10 > div.md-area.position-relative`):
- `div.md-header` → `ul.clearfix.nav-links.nav.gl-tabs-nav` with `li.md-header-tab.active > button.js-md-write-button` = `Write`, `li.md-header-tab > button.js-md-preview-button` = `Preview`, then `li.md-header-toolbar.active.gl-py-2 > div.md-header-toolbar.active` containing icon buttons with these exact `title`/`aria-label`s, in order:
  `Add bold text (Ctrl+B)`, `Add italic text (Ctrl+I)`, `Add strikethrough text (Ctrl+⇧X)`,
  `Insert a quote`, `Insert code`, `Add a link (Ctrl+K)`, `Add a bullet list`,
  `Add a numbered list`, `Add a checklist`, `Indent line (Ctrl+])` *(hidden)*,
  `Outdent line (Ctrl+[)` *(hidden)*, `Add a collapsible section`, `Add a table`,
  `Attach a file or image` (`data-testid="button-attach-file"`), `Go full screen`.
- `div.md-write-holder > .zen-backdrop.div-dropzone-wrapper > .div-dropzone.dz-clickable >`
  `textarea#milestone_description.note-textarea.js-gfm-input.js-autosize.markdown-area[data-qa-selector="milestone_description_field"][name="milestone[description]"] placeholder="Write milestone description..."`
- `div.comment-toolbar.clearfix` → `div.toolbar-text` = `Supports <a href="/help/user/markdown">Markdown</a>`,
  plus upload progress machinery (`0%`, `Try again`, `or`, `attach a new file`, `.`, `Cancel`).
- `div.md.md-preview-holder.js-md-preview.hide`, `div.referenced-commands.hide`, `div.error-alert`.

Footer `div.form-actions`:
`<button class="gl-button btn btn-md btn-confirm disabled" data-qa-selector="create_milestone_button" type="submit">Create milestone</button>`
(disabled until Title is filled — `js-requires-input`) and
`<a class="gl-button btn btn-default btn-cancel" href="/:ns/:proj/-/milestones">Cancel</a>`.

The edit form is identical but `<h1>Edit Milestone</h1>` and the submit button reads `Save changes`.

### Delete-milestone control

On the detail page the `Delete` button is `button.gl-button.btn.btn-md.btn-danger.js-delete-milestone-button.btn-grouped`
rendered **`disabled`** in the server HTML (Vue enables it), carrying
`data-milestone-id`, `data-milestone-title`, `data-milestone-url`, `data-milestone-issue-count`,
`data-milestone-merge-request-count`. The modal mounts into `#js-delete-milestone-modal`.

---

## 17. `/-/project_members`

**ANCHOR route for ~20 tasks** — see the list in `task_anchors.md`
(`/byteblaze/dotfiles/-/project_members` webarena-481..485,
`/a11yproject/a11yproject.com/-/project_members` webarena-568,
`/byteblaze/solarized-prism-theme/-/project_members` webarena-480,
`/byteblaze/timeit/-/project_members` webarena-570/579,
`/byteblaze/gimmiethat.space/-/project_members` webarena-567,
`/byteblaze/a11y-webring.club/-/project_members` webarena-576,
`/byteblaze/accessible-html-content-patterns/-/project_members` webarena-569,
`/byteblaze/millennials-to-snake-people/-/project_members` webarena-578,
`/byteblaze/remove-board-movement-events-from-the-github-issue-timeline/-/project_members` webarena-577,
plus webarena-742..751 on the *newly created* projects
`planner`, `web_arena`, `AutoAGI`, `awesome-llms`, `llm_bulk_inference`, `awesome_web_agents`,
`web_agent_android_xl`, `project_site`, `agi_index`, `AGISite`.)

### Route & title

`/:ns/:proj/-/project_members` → `<title>Members · Byte Blaze / dotfiles · GitLab</title>`
Query variants that the page itself generates:
`?sort=name_asc` `?sort=name_desc` `?sort=last_joined` `?sort=access_level_asc`
`?sort=oldest_created_user` `?sort=oldest_last_activity` `?sort=recent_sign_in`,
and `?tab=groups` `?tab=invited` `?tab=access_requests`
(tabs with zero rows are not rendered, so those `?tab=` URLs silently fall back to Members).

Breadcrumb: `Byte Blaze` › `dotfiles` › `Members`. Left sidebar active item:
**Project information → Members** (`href="/:ns/:proj/-/project_members" aria-label="Members"`).
`#content-body` **x=464, width=1248**; no right sidebar.

### Page header — `div.row.gl-mt-3 > div.col-lg-12 > div.gl-display-flex.gl-flex-wrap`

```html
<h4>Project members</h4>
<p class="gl-w-full order-md-1">You can invite a new member to <strong>dotfiles</strong> or invite another group.</p>
<div class="gl-display-flex gl-flex-wrap gl-align-items-flex-start gl-ml-auto gl-md-w-auto gl-w-full gl-mt-3">
  <button class="btn btn-default btn-md gl-button gl-md-w-auto gl-w-full">Import from a project</button>
  <button class="btn btn-default btn-md gl-button gl-md-w-auto gl-w-full gl-md-ml-3 gl-md-mt-0 gl-mt-3"
          data-qa-selector="invite_a_group_button">Invite a group</button>
  <button class="btn btn-confirm btn-md gl-button gl-md-w-auto gl-w-full gl-md-ml-3 gl-md-mt-0 gl-mt-3"
          data-qa-selector="invite_members_button">Invite members</button>
</div>
```
Heading verbatim: `Project members`.
Intro verbatim: `You can invite a new member to ` + `<strong>{project.name}</strong>` + ` or invite another group.`
(e.g. `You can invite a new member to a11yproject.com or invite another group.`)
Note the `<p>` uses `order-md-1` so it renders *below* the three buttons in the flex row —
visually: heading top-left, three buttons top-right, intro paragraph on the next line.

Non-admin variant (not reachable as byteblaze on any project here): heading `Project members`
and the paragraph `Members can be added by project <i>Maintainers</i> or <i>Owners</i>`, no buttons.

### Tab strip

`div.tabs.gl-tabs > div > ul.nav.gl-tabs-nav[role=tablist]`, each tab
`li.nav-item > a.nav-link.gl-tab-nav-item[role=tab]` containing `<span>{label}</span>` and
`<span class="badge gl-tab-counter-badge badge-muted badge-pill gl-badge sm">{count}</span>`.
Panels: `div.tab-content.gl-tab-content > div.tab-pane[.active][role=tabpanel]`.

| Label | `?tab=` value | shown when |
|---|---|---|
| `Members` | *(none — default)* | always |
| `Groups` | `groups` (`data-qa-selector="groups_list_tab"`) | ≥1 invited group |
| `Invited` | `invited` | ≥1 pending invite AND `canManageMembers` |
| `Access requests` | `access_requests` | ≥1 request AND `canManageAccessRequests` |

Observed counts in the base data: `Members 1` (dotfiles, timeit, millennials-to-snake-people,
remove-board-…, a11y-webring.club, accessible-html-content-patterns),
`Members 2` (solarized-prism-theme, gimmiethat.space, primer/design),
`Members 3` (a11yproject.com). No project has Groups / Invited / Access requests.

### Toolbar — `div.gl-bg-gray-10.gl-p-3.gl-md-display-flex`

Left: `div.vue-filtered-search-bar-container[data-testid="members-filtered-search-bar"]` →
`div.input-group.gl-search-box-by-click[data-testid="filtered-search-input"]` containing
- a history dropdown button (`Toggle history`, menu: `Recent searches`, `You don't have any recent searches`, a `Close` button),
- `input.gl-filtered-search-term-input[data-testid="filtered-search-term-input"][data-qa-selector="search_bar_input"] placeholder="Filter members" aria-label="Filter members"`,
- a submit `button[data-testid="search-button"][data-qa-selector="search_button"][aria-label="Search"]`.

Right: `div.gl-sorting[data-testid="members-sort-dropdown"]` — a **gl-dropdown of sort *keys*
plus a separate direction toggle button** (NOT `Account, ascending` style combined labels).

Toggle text = current key (default `Account`). Menu items are `<a class="dropdown-item">` links:

| Item | href |
|---|---|
| `Account` (default, `.active`) | `?sort=name_asc` |
| `Access granted` | `?sort=last_joined` |
| `Max role` | `?sort=access_level_asc` |
| `Created on` | `?sort=oldest_created_user` |
| `Last activity` | `?sort=oldest_last_activity` |
| `Last sign-in` | `?sort=recent_sign_in` |

Then `<button class="btn btn-default btn-md gl-button btn-icon sorting-direction-button" title="Sort direction: Ascending" aria-label="Sorting Direction: Ascending">` with a `sort-lowest` icon.
Clicking it flips to `?sort=name_desc` and the title becomes `Sort direction: Descending`
(verified live). Descending counterparts: `name_desc`, `first_joined`, `access_level_desc`,
`recent_created_user`, `recent_last_activity`, `oldest_sign_in`.

### Members TABLE

```html
<table class="table b-table gl-table members-table b-table-stacked-lg"
       data-testid="members-table" role="table">
```
`<thead><tr>` — **exact `<th>` order** (verified identical on project and group pages):

| # | `<th>` text | `<th>` class |
|---|---|---|
| 1 | `Account` | — |
| 2 | `Source` | `col-meta` |
| 3 | `Access granted` | `col-meta` |
| 4 | `Max role` | `col-max-role` |
| 5 | `Expiration` | `col-expiration` |
| 6 | `Created on` | — |
| 7 | `Last activity` | — |
| 8 | *(visually hidden)* `<span class="gl-sr-only" data-testid="col-actions">Actions</span>` | `col-actions` |

> The brief's guessed order (`Account, Source, Access granted, Expiration, Max role`) is **wrong**:
> `Max role` comes **before** `Expiration`, and there are two extra columns
> (`Created on`, `Last activity`) before the actions column.

Row: `<tr id="__BVID__NN__row_<member id>" data-testid="members-table-row-<member id>" data-qa-selector="member_row" role="row">`.
Every `<td>` wraps its content in a bare `<div>`.

**Cell 1 — Account**
```html
<td role="cell"><div>
  <a class="gl-link gl-avatar-link js-user-link" href="http://<host>/byteblaze">
    <div class="gl-avatar-labeled" alt="Byte Blaze">
      <img class="gl-avatar gl-avatar-circle gl-avatar-s48">
      <div class="gl-avatar-labeled-labels gl-text-left!">
        <div class="gl-display-flex gl-flex-wrap gl-align-items-center gl-text-left! gl-mx-n1 gl-my-n1">
          <span class="gl-avatar-labeled-label">Byte Blaze</span>
          <div class="gl-p-1"><span class="badge badge-success badge-pill gl-badge sm">It's you</span></div>
        </div>
        <span class="gl-avatar-labeled-sublabel">@byteblaze</span>
      </div></div></a>
</div></td>
```
Display name in `.gl-avatar-labeled-label`, `@handle` in `.gl-avatar-labeled-sublabel` on a second
line. Badge `It's you` (`badge-success badge-pill gl-badge sm`) only on the current user's row.
The whole cell is one link to the user profile. Avatar size 48 (`gl-avatar-s48`).
(Possible extra badges here in other data: `Blocked`, `2FA`.)

**Cell 2 — Source** — `<td class="col-meta"><div><span>Direct member</span></div></td>`.
Every member on this instance is `Direct member`. For an inherited membership the cell instead
holds a link to the source group/project (`<Group> / <Project>`) plus an `Inherited` tooltip.

**Cell 3 — Access granted** — relative time + granter:
```html
<td class="col-meta"><div><span>
  <time title="Mar 27, 2023 1:37pm PDT" datetime="2023-03-27T20:37:47.740Z">3 years ago</time>
  by <a href="http://<host>/root">Administrator</a>
</span></div></td>
```
- Visible text: `3 years ago` (relative).
- `title=` absolute format: `%b %-d, %Y %-I:%M%p %Z` → `Mar 27, 2023 1:37pm PDT`,
  `Mar 23, 2023 12:30am PDT`, `Jan 30, 2023 10:33pm PST`.
- `datetime=` is the ISO-8601 UTC instant with milliseconds, e.g. `2023-03-27T20:37:47.740Z`.
- The ` by <granter>` suffix is a profile link; it is omitted when there is no `created_by`
  (e.g. the `@root` row on `/groups/robert1003/-/group_members`).

**Cell 4 — Max role** — TWO possible renderings. **This is what
`gitlab_get_project_memeber_role(page, '<username>')` reads, so both must be right.**

*(a) not editable* (`member.canUpdate === false`): a static pill
```html
<td class="col-max-role"><div><span class="badge badge-muted badge-pill gl-badge md">Owner</span></div></td>
```
*(b) editable*: a **GitLab dropdown, not a native `<select>`**
```html
<td class="col-max-role"><div>
  <div class="dropdown b-dropdown gl-dropdown btn-group">
    <button class="btn dropdown-toggle btn-default btn-md gl-button gl-dropdown-toggle"
            data-qa-selector="access_level_dropdown">
      <span class="gl-dropdown-button-text">Developer</span><svg chevron-down-icon></button>
    <ul class="dropdown-menu" role="menu"><div class="gl-dropdown-inner">
      <div class="gl-dropdown-header gl-border-b-0!"><p class="gl-dropdown-header-top">Change role</p></div>
      <div class="gl-dropdown-contents">
        <li class="gl-dropdown-item"><button class="dropdown-item" data-qa-selector="access_level_link" role="menuitem">
          <svg dropdown-item-checkbox><div class="gl-dropdown-item-text-wrapper">
            <p class="gl-dropdown-item-text-primary">Guest</p></div></button></li>
        … Reporter … Developer … Maintainer … [Owner] …
      </div></div></ul></div>
</div></td>
```
Dropdown header text: `Change role`. Option set depends on the *current user's* own role:
- current user is **Owner** of the project → options `Guest`, `Reporter`, `Developer`, `Maintainer`, `Owner` (5)
- current user is **Maintainer** → options `Guest`, `Reporter`, `Developer`, `Maintainer` (4)

**How to read a role for a username** (mirror this in the mock):
find the `tr` whose `.gl-avatar-labeled-sublabel` is `@<username>`, then read
`td.col-max-role .gl-dropdown-button-text` if present, else `td.col-max-role .badge`.
Role strings that are ANCHORs: `Guest` (webarena-481..484, 570), `Reporter` (webarena-578),
`Developer` (webarena-576), `Maintainer` (webarena-577), plus `Owner`.

**Cell 5 — Expiration** — always a datepicker input, even when empty:
```html
<td class="col-expiration"><div>
  <div class="gl-max-w-full gl-datepicker d-inline-block gl-w-full gl-form-input-md"><div class="gl-relative">
    <input class="gl-form-input gl-w-full form-control gl-pr-7!" data-testid="gl-datepicker-input"
           placeholder="Expiration date" aria-label="Enter date" type="text">
    <div class="gl-datepicker-actions"><span class="gl-px-2 gl-text-gray-400"
         data-testid="datepicker-calendar-icon"><svg calendar-icon></span></div>
  </div></div></div></td>
```
Placeholder is `Expiration date`. No member on this instance has an expiration set, so the input
is always blank (innerText of the cell is `''` — **never the word `Never`**).
The icon is `gl-text-gray-400` on read-only rows and `gl-text-gray-500` on editable rows.

**Cell 6 — Created on** and **Cell 7 — Last activity** — `<td><div><span>23 Mar, 2023</span></div></td>`.
Format here is `%-d %b, %Y` (day first, comma after the month) — e.g. `23 Mar, 2023`,
`6 Aug, 2026`, `26 Mar, 2023`, `2 Feb, 2023`, `16 Mar, 2023`, `18 Jan, 2023`, `16 Jun, 2023`.
Note this differs from every other date format on the site.

**Cell 8 — Actions** (`td.col-actions`) — `div > div.gl-display-flex.gl-flex-align-items-center.gl-justify-content-end.gl-mx-n1 > div.gl-px-1`:

| Case | Control |
|---|---|
| the current user's own row | `<button class="btn btn-danger btn-md gl-button btn-icon" title="Leave" aria-label="Leave">` with a `leave` icon (solid red square icon button) |
| a removable member | `<button class="btn btn-danger btn-md gl-button btn-danger-secondary" data-qa-selector="delete_member_button"><span class="gl-button-text">Remove member</span></button>` (red outline button) |
| the project Owner, viewed by a non-owner | **empty cell** — the `td` gets `col-actions gl-display-none! gl-lg-display-table-cell!` and contains no button. Verified for `@a11yproject` on a11yproject.com and `@primer` on primer/design. |

There is **no ⋮ menu and no trash icon** in the members table in 15.7.

**Owner's own row, verbatim** (`/byteblaze/dotfiles/-/project_members`):
Byte Blaze | `It's you` badge | `@byteblaze` | `Direct member` | `3 years ago by Administrator`
(`title="Mar 27, 2023 1:37pm PDT"`) | Max role = **static `Owner` badge, not a dropdown** |
empty `Expiration date` picker | `23 Mar, 2023` | `6 Aug, 2026` | red icon `Leave` button.

**Remove-member confirmation modal** (`id="remove-member-modal___BV_modal_content_"`), captured live:
- Header `<h4 class="modal-title">Remove member</h4>` (NOT `Remove user from project`)
- Body: a `<form action="/byteblaze/gimmiethat.space/-/project_members/204" method="post">` with
  `<p>Are you sure you want to remove yjlou from "Byte Blaze / gimmiethat.space"?</p>`
  (pattern: `Are you sure you want to remove {username} from "{Owner Name} / {project}"?`),
  hidden `_method=delete` + `authenticity_token`, and a checkbox
  `<label>Also unassign this user from related issues and merge requests</label>` (`name="unassign_issuables" value="true"`).
- Footer: `Cancel` (`btn-default`) and `Remove member` (`btn-danger`).
- Close `X` `aria-label="Close"`.

### Invite members modal — **read-only capture, never submitted**

Trigger: `button[data-qa-selector="invite_members_button"]` = `Invite members`.
Modal root `#invite-members-modal-N___BV_modal_content_`; body wrapper
`div[data-testid="invite-modal-initial-content"].invite-modal-content`.

- Title: `<h4 class="modal-title">Invite members</h4>`
- Sub-copy (`div[data-testid="modal-base-intro-text"]`): `You're inviting members to the ` +
  `<strong>dotfiles</strong>` + ` project.` (verbatim: `You're inviting members to the dotfiles project.`)
- **Field 1** — `<label for="…_search">Username or email address</label>`; the control is a
  `div.gl-token-selector` wrapping
  `<input type="text" data-testid="members-token-select-input" data-qa-selector="members_token_select_input" id="…_search" placeholder="">`.
  The string `Select members or type email addresses` is the **help text below the field**
  (`<small class="form-text text-gl-muted">`), **not** the placeholder — the placeholder is empty.
  Its dropdown shows `No matches found` when there are no results.
- **Field 2** — `<label for="…_dropdown">Select a role</label>`; a **native `<select>`**:
  ```html
  <select class="gl-form-select custom-select" data-qa-selector="access_level_dropdown">
    <option value="10">Guest</option><option value="20">Reporter</option>
    <option value="30">Developer</option><option value="40">Maintainer</option>
    <option value="50">Owner</option></select>
  ```
  Help text below: `<a href="/help/user/permissions" rel="noopener" target="_blank" class="gl-link">Read more</a> about role permissions`
  → renders as `Read more about role permissions`. There is **no per-option help text** in this modal.
- **Field 3** — `<label for="…_expires_at">Access expiration date (optional)</label>` (not
  `Access expiration date`); `<input type="text" placeholder="YYYY-MM-DD" data-testid="gl-datepicker-input" aria-label="Enter date">`
  plus a calendar icon and a `div.pika-single.gl-datepicker-theme` popup.
  (Placeholder is `YYYY-MM-DD` here — `Expiration date` is only used in the members *table*.)
- Footer: `<button class="btn js-modal-action-cancel btn-default btn-md gl-button">Cancel</button>`
  and `<button data-qa-selector="invite_button" class="btn js-modal-action-primary btn-confirm btn-md gl-button">Invite</button>`.

Full modal innerText, verbatim:
```
Invite members

You're inviting members to the dotfiles project.

Username or email address
Select members or type email addresses
Select a role
Guest
Reporter
Developer
Maintainer
Owner
Read more about role permissions
Access expiration date (optional)
Cancel
Invite
```

### Invite a group modal

Trigger `button[data-qa-selector="invite_a_group_button"]` = `Invite a group`; root
`#invite-groups-modal-N___BV_modal_content_`.
- Title `Invite a group`; sub-copy `You're inviting a group to the dotfiles project.`
- `<label>Select a group to invite</label>` → gl-dropdown `[data-testid="group-select-dropdown"]`
  with button text `Select a group`, an inner search box
  `placeholder="Search groups"` `data-qa-selector="group_select_dropdown_search_field"`, and
  `<p data-testid="empty-result-message">No matching results</p>` when nothing matches.
- Same `Select a role` `<select>` (Guest/Reporter/Developer/Maintainer/Owner) + `Read more about role permissions`.
- Same `Access expiration date (optional)` + `YYYY-MM-DD`.
- Footer `Cancel` / `Invite` (the `Invite` button starts **disabled**).

### Import from a project modal

Trigger `Import from a project` (`div.js-import-project-members-trigger`); root
`#import-a-project-modal-N___BV_modal_content_`.
- Title `Import members from another project`
- `<p>You're importing members to the <strong>dotfiles</strong> project.</p>`
- `<label id="project-select">Project</label>` → gl-dropdown `[data-testid="project-select-dropdown"]`,
  button text `Select a project`, inner search `placeholder="Search projects"`
  `data-qa-selector="project_select_dropdown_search_field"`; items are 32px labelled avatars whose
  label is the project full name (`Byte Blaze / dotfiles`, `Byte Blaze / timeit`, …).
- Helper paragraph: `Only project members (not group members) are imported, and they get the same permissions as the project you import from.`
- Footer `Cancel` / `Import project members`.

### Pagination

No project on this instance has enough members to paginate; `.gl-pagination` is absent.
When it appears it is the same `ul.pagination.justify-content-center` widget as on the labels page
(`Prev` / numbered pages / `Next`) using `?page=N`.

### EXACT member lists (verified live, all 8 columns)

**`/byteblaze/dotfiles/-/project_members` — tab `Members 1`** (ANCHOR, webarena-481..485)

| Account | Source | Access granted | Max role | Expiration | Created on | Last activity | Actions |
|---|---|---|---|---|---|---|---|
| Byte Blaze `It's you` `@byteblaze` | `Direct member` | `3 years ago` (`title="Mar 27, 2023 1:37pm PDT"`, `datetime="2023-03-27T20:37:47.740Z"`) `by Administrator` | `Owner` (badge) | *(empty)* | `23 Mar, 2023` | `6 Aug, 2026` | `Leave` icon |

Tasks 481–485 add `@abisubramanya27` (→ `Guest`, ANCHOR), `@yjlou` (ANCHOR),
`@koush`, `@lahwaacz`, `@vinta` to this project and assert their roles via
`gitlab_get_project_memeber_role`.

**`/a11yproject/a11yproject.com/-/project_members` — tab `Members 3`** (ANCHOR, webarena-568)

| Account | Source | Access granted | Max role | Expiration | Created on | Last activity | Actions |
|---|---|---|---|---|---|---|---|
| Byte Blaze `It's you` `@byteblaze` | `Direct member` | `3 years ago by The A11Y Project` (`title="Mar 27, 2023 1:15pm PDT"`, `datetime="2023-03-27T20:15:31.973Z"`) | `Maintainer` (badge) | *(empty)* | `23 Mar, 2023` | `6 Aug, 2026` | `Leave` icon |
| Roshan Jossy `@Roshanjossey` | `Direct member` | `3 years ago by The A11Y Project` (`title="Mar 23, 2023 8:14am PDT"`, `datetime="2023-03-23T15:14:02.818Z"`) | `Developer` (**dropdown**, options `Guest`/`Reporter`/`Developer`/`Maintainer`) | *(empty)* | `23 Mar, 2023` | `26 Mar, 2023` | `Remove member` |
| The A11Y Project `@a11yproject` | `Direct member` | `3 years ago by Administrator` (`title="Mar 23, 2023 12:30am PDT"`, `datetime="2023-03-23T07:30:54.673Z"`) | `Owner` (badge) | *(empty)* | `23 Mar, 2023` | `26 Mar, 2023` | *(none)* |

Note: byteblaze is only Maintainer here, so the role dropdowns top out at `Maintainer` and the
Owner row is untouchable. webarena-568 adds `@abisubramanya27` and `@vinta` (both ANCHOR).

**Other projects (base state, all verified live)**

| Project | Members | Rows |
|---|---|---|
| `/byteblaze/timeit` | 1 | Byte Blaze `@byteblaze` · `3 years ago by Byte Blaze` (`Mar 27, 2023 1:35pm PDT`) · `Owner` · `23 Mar, 2023` · `6 Aug, 2026` · `Leave` |
| `/byteblaze/solarized-prism-theme` | 2 | Abishek S `@abisubramanya27` · `3 years ago by Byte Blaze` (`Apr 24, 2023 2:23pm PDT`) · **`Guest`** dropdown (5 opts incl. `Owner`) · `2 Feb, 2023` · `26 Mar, 2023` · `Remove member` — and Byte Blaze `@byteblaze` · `by Byte Blaze` (`Mar 27, 2023 1:34pm PDT`) · `Owner` badge · `23 Mar, 2023` · `6 Aug, 2026` · `Leave`. (webarena-480 answer is `yjlou`.) |
| `/byteblaze/gimmiethat.space` | 2 | Byte Blaze `@byteblaze` · `by Administrator` (`Mar 27, 2023 1:11pm PDT`) · `Owner` · `Leave`; **yjlou `@yjlou`** · `by Byte Blaze` (`Apr 24, 2023 2:22pm PDT`) · **`Developer`** dropdown (5 opts) · `16 Mar, 2023` · `18 Mar, 2023` · `Remove member` |
| `/byteblaze/millennials-to-snake-people` | 1 | Byte Blaze `Owner`, `by Administrator` (`Mar 27, 2023 1:33pm PDT`) |
| `/byteblaze/remove-board-movement-events-from-the-github-issue-timeline` | 1 | Byte Blaze `Owner`, `by Administrator` (`Mar 27, 2023 1:11pm PDT`) |
| `/byteblaze/a11y-webring.club` | 1 | Byte Blaze `Owner`, `by Administrator` (`Mar 27, 2023 1:10pm PDT`) |
| `/byteblaze/accessible-html-content-patterns` | 1 | Byte Blaze `Owner`, `by Administrator` (`Mar 27, 2023 1:11pm PDT`) |
| `/primer/design` | 2 | Byte Blaze `@byteblaze` `It's you` · `by Primer` (`Mar 27, 2023 1:39pm PDT`) · **`Developer`** badge · `6 Aug, 2026` · `Leave`; Primer `@primer` · `by Administrator` (`Mar 27, 2023 1:11pm PDT`) · `Owner` badge · `27 Mar, 2023` · `26 Mar, 2023` · *(no actions)* |

All `Created on` values for byteblaze rows are `23 Mar, 2023` and `Last activity` is `6 Aug, 2026`
(today-ish — it tracks the logged-in user's activity, so treat it as "now" in the mock).

### Handles that must be invitable (all exist as real users — display names for the mock seed)

| handle | display name |
|---|---|
| `@abisubramanya27` (ANCHOR) | Abishek S |
| `@vinta` (ANCHOR) | Vinta Chen (`Vinta Chen` is itself an ANCHOR string on `/byteblaze/agi_index/-/project_members`) |
| `@bblanchon` (ANCHOR) | Benoît Blanchon |
| `@convexegg` (ANCHOR) | Convex Eggtart |
| `@primer` (ANCHOR) | Primer |
| `@Seirdy` (ANCHOR) | Rohan Kumar |
| `@V13Axel` (ANCHOR) | Alex Dills |
| `@alexhutnik` (ANCHOR) | Alex Hutnik |
| `@a11yproject` (ANCHOR) | The A11Y Project |
| `@yjlou` (ANCHOR) | yjlou |
| `@lahwaacz` (ANCHOR) | Jakub Klinkovský |
| `@koush` | Koushik Dutta |
| `@Roshanjossey` | Roshan Jossy |

---

## 18a. `/groups/:group` — group overview

### VERIFIED FINDING: only ONE group exists on this instance

I re-ran the probe. Confirmed HTTP statuses (logged in as byteblaze):

| Path | Status |
|---|---|
| `/coding_friends` | **404** (`<title>Not Found</title>`) |
| `/groups/coding_friends` | **404** |
| `/groups/coding_friends/-/group_members` | **404** |
| `/groups/primer` | **404** |
| `/groups/a11yproject`, `/groups/keycloak`, `/groups/OpenAPITools`, `/groups/root`, `/groups/vinta`, `/groups/auth0` | **404** |
| `/primer` | 200 — but it is a **user** profile, not a group |
| `/dashboard/groups` | 200 — **empty state** (byteblaze belongs to no group) |
| `/explore/groups` | 200 — exactly **one** `li.group-row` |
| **`/groups/robert1003`** | **200** ✅ |
| **`/robert1003`** | **200** ✅ (same page — the bare namespace path resolves to the group) |
| **`/groups/robert1003/-/group_members`** | **200** ✅ |
| `/groups/new` | 200 |

So: **`robert1003` is the only group.** Every other namespace that owns projects
(`byteblaze`, `a11yproject`, `primer`, `keycloak`, `OpenAPITools`, `umano`, `kkroening`,
`convexegg`, `root`, `vinta`, `auth0`, `koush`, `lahwaacz`, `0ang3el`, `dehenne`, `amwhalen`,
`CellularPrivacy`) is a **user namespace**, which is why `/groups/<them>` 404s and why no
project on the instance has a group-level Labels/Milestones/promote affordance.

Real captures already in the repo: `assets/html/group-robert1003.html`,
`assets/html/group-members-robert1003.html` (+ matching `.png`s). Use them.

`/explore/groups` content (`li.group-row#group-6[data-testid="group-overview-item-6"]`):
identicon `R` (bg7), `a[data-testid="group-name"][href="/robert1003"][title="robert1003"]` = `robert1003`,
a `group-visibility-icon`, and three stats
(`number-subgroups` title `Subgroups` = `0`, `number-projects` title `Projects` = `1`,
`number-users` title `Direct members` = `1`), each value in `span.stat-value[data-testid="itemStatValue"]`.

`/dashboard/groups` empty state (verbatim):
```
A group is a collection of several projects.
If you organize your projects under a group, it works like a folder.
You can manage your group member’s permissions and access to each project in the group.
```
(note the curly apostrophe in `member’s`) — inside `div.empty-state > div.row… > div.text-content.order-md-1.gl-m-0!`
with `<h4>` for the first line and `<p>` for the other two, and an illustration in `div.order-md-2`.
Both `/dashboard/groups` and `/explore/groups` share the page header
`<h1 class="page-title gl-font-size-h-display">Groups</h1>` +
`<a class="gl-button btn btn-md btn-confirm" data-testid="new-group-button" data-qa-selector="new_group_button" href="/groups/new">New group</a>`,
the tab pair `Your groups` (`/dashboard/groups`) / `Explore public groups` (`/explore/groups`,
`data-qa-selector="public_groups_tab"`), a filter
`input#group-filter-form-field[data-qa-selector="groups_filter_field"] placeholder="Search by name" name="filter"`,
and a sort dropdown `[data-testid="group_sort_by_dropdown"]` defaulting to `Last created` with options
`Name`, `Name, descending`, `Last created`, `Oldest created`, `Updated date`, `Oldest updated`.
`/explore/groups` also has a dismissible landing block (`.explore-groups.landing.js-explore-groups-landing.hide`)
with `Below you will find all the groups that are public.` and
`You can easily contribute to them by requesting to join these groups.`

### Route & title

`/groups/:group` and `/:group` both render the group overview.
`<title>robert1003 · GitLab</title>` (pattern `<group name> · GitLab`).
Breadcrumb: a single crumb `robert1003` (`@skip_current_level_breadcrumb = true`).
`#content-body` **x=609, width=958** — the group overview uses
`limit-container-width` (`@content_class = "limit-container-width"`), unlike the members page.

Left sidebar (`.nav-sidebar`, 256px) for a group, innerText:
```
R
robert1003
Group information
Issues        1
Merge requests 0
Packages and registries
Collapse sidebar
```
Expanded, `Group information` has sub-items `Activity`, `Labels`, `Members`
(see `group-members-robert1003.png`) — routes `/groups/:g/-/activity`, `/groups/:g/-/labels`,
`/groups/:g/-/group_members`. Groups owned by the user additionally show
`Settings`, `Subgroup information`, etc.

### Body

**1. `div.group-home-panel`** →
`div.gl-display-flex.gl-justify-content-space-between.gl-flex-wrap.gl-sm-flex-direction-column.gl-gap-3.gl-my-5`

Left `div.home-panel-title-row.gl-display-flex.gl-align-items-center`:
```html
<div class="avatar-container rect-avatar s64 home-panel-avatar gl-flex-shrink-0 float-none gl-mr-3!">
  <span class="avatar avatar-tile s64 identicon bg7">R</span></div>
<div>
  <h1 class="home-panel-title gl-font-size-h1 gl-mt-3 gl-mb-2 gl-display-flex">robert1003
    <span class="visibility-icon gl-text-secondary has-tooltip gl-ml-2"
          title="Public - The group and any public projects can be viewed without any authentication.">
      <svg earth-icon></span></h1>
  <div class="home-panel-metadata gl-text-secondary gl-font-base gl-font-weight-normal gl-line-height-normal"
       data-qa-selector="group_id_content">
    <span class="gl-display-inline-block gl-vertical-align-middle">Group ID: 6
      <button class="btn btn-clipboard gl-button btn-default-tertiary btn-icon btn-sm"
              title="Copy group ID" aria-label="Copy group ID" data-clipboard-text="6"><svg copy-to-clipboard-icon></button>
    </span>
    <span class="gl-ml-3 gl-mb-3"><a href="/groups/robert1003/-/group_members/request_access">Request Access</a></span>
  </div></div>
```
`Group ID: 6`, `Copy group ID`, `Request Access` (only for non-members; members see
`Leave group` / nothing). Visibility tooltip strings mirror the new-group form
(`Private - The group and its projects can only be viewed by members.` /
`Internal - …` / `Public - The group and any public projects can be viewed without any authentication.`).
If the group has a description, it renders under the title as `.home-panel-description`.

Right `div.home-panel-buttons[data-testid="group-buttons"]`: a notification bell gl-dropdown
(`[data-testid="notification-dropdown"]`) whose items are
`Global` / `Use your global notification setting`, `Watch` / `You will receive notifications for any activity`,
`Participate` / `You will only receive notifications for threads you have participated in`,
`On mention` / `You will receive notifications only for comments in which you were @mentioned`,
`Disabled` / `You will not get any notifications via email`, a divider, then
`Custom` / `You will only receive notifications for the events you choose`.
(For an owned group there are also `New project` / `New subgroup` buttons.)

**2. Tabs `div.tabs.gl-tabs`** — `Subgroups and projects` (active), `Shared projects`,
`Archived projects`; then an inline `li.gl-flex-grow-1…` holding
a search box (`input[data-qa-selector="groups_filter_field"] placeholder="Search" aria-label="Search"`)
and a sort gl-dropdown `[data-testid="group_sort_by_dropdown"]` defaulting to `Name` with options
`Name`, `Created`, `Updated`, `Stars`, plus a `sorting-direction-button[title="Sort direction"][aria-label="Sorting Direction: Ascending"]`.

**3. Panel `div.tab-content.gl-pt-0.gl-tab-content` → `div.groups-list-tree-container[data-qa-selector="groups_list_tree_container"] > ul.groups-list.group-list-tree`**

Row = `li.group-row#group-<id>[data-testid="group-overview-item-<id>"]` →
`div.group-row-contents.d-flex.align-items-center.py-2.pr-3[.project-row-contents]` containing
- `div.folder-toggle-wrap` → `span.folder-caret` (chevron-right) + `span.item-type-icon` (`subgroup` icon for subgroups, `project` icon for projects)
- a 32px avatar link
- `div.group-text-container` → `div.group-text` → `div.…title.namespace-title.gl-font-weight-bold.gl-mr-3` with
  `a.no-expand.gl-mr-3.gl-text-gray-900![data-testid="group-name"][title="robert1003 / dotfiles"]` = `dotfiles`
  and a `group-visibility-icon`
- `div.metadata > div.stats.gl-text-gray-500.group-stats…` — for a **project** row:
  `span.project-stars` (star icon + `span.stat-value[data-testid="itemStatValue"]` = `0`) and
  `div.last-updated > <time title="Feb 17, 2023 7:29am PST" datetime="2023-02-17T15:29:34.421Z">3 years ago</time>`.
  For a **subgroup** row: `number-subgroups`/`number-projects`/`number-users` as on `/explore/groups`.

`robert1003` contains exactly one project: `dotfiles` at `/robert1003/dotfiles`
(`li#group-2`, identicon `D` bg3, 0 stars, updated `3 years ago`).
`Shared projects` and `Archived projects` panes are empty `div.tab-pane`s.

### `/groups/new` — the group creation form (the mock MUST support this: 5 anchor groups are created by tasks)

`<title>New Group · GitLab</title>`. No breadcrumbs, no left sidebar (`#content-body` x=336, w=1248).
Reachable from the `+` menu (`New group` → `/groups/new`) and the `New group` button on
`/dashboard/groups` and `/explore/groups`.

`div.group-edit-container.gl-mt-5 > div.container` →
`<h2 class="gl-my-7 gl-font-size-h1 gl-text-center">Create new group</h2>` and two selector panels
(`a.new-namespace-panel[data-qa-selector="panel_link"]`):

| Panel | `href` | heading | copy |
|---|---|---|---|
| 1 | `#create-group-pane` | `Create group` | `Assemble related projects together and grant members access to several projects at once.` |
| 2 | `#import-group-pane` | `Import group` | `Import a group and related data from another GitLab instance.` |

`#create-group-pane > form#new_group.group-form.gl-show-field-errors.gl-mt-3`:

| Field | DOM / copy |
|---|---|
| `Group name` | `input#group_name[data-qa-selector="group_name_field"][name="group[name]"] placeholder="My awesome group"`; invalid feedback `Enter a descriptive name for your group.`; help `Must start with letter, digit, emoji, or underscore. Can also contain periods, dashes, spaces, and parentheses.` |
| `Group URL` | `.input-group` with prefix `<div class="input-group-text group-root-path">http://localhost:8023/</div>` and `input#group_path[data-qa-selector="group_path_field"][name="group[path]"] placeholder="my-awesome-group"`; valid feedback `Group path is available.` |
| `Visibility level` | `<p>Who will be able to see this group? <a href="/help/user/public_access">View the documentation</a></p>` then three radios in `.visibility-level-setting`: `Private` (`#group_visibility_level_0`, value 0, `data-qa-selector="private_radio"`, lock icon) — `The group and its projects can only be viewed by members.`; `Internal` (`#group_visibility_level_10`, value 10, `internal_radio`, shield icon) — `The group and any internal projects can be viewed by any logged in user except external users.`; `Public` (`#group_visibility_level_20`, value 20, `public_radio`, earth icon, **checked by default**) — `The group and any public projects can be viewed without any authentication.` |
| personalization block | label `Now, personalize your GitLab experience`, `<p>We'll use this to help surface the right features and information to you.</p>` |
| `Role` | `select#user_role[name="user[role]"]` options `Software Developer`, `Development Team Lead`, `Devops Engineer`, `Systems Administrator`, `Security Analyst`, `Data Analyst`, `Product Manager`, `Product Designer`, `Other` |
| `Who will be using this group?` | radios `#group_setup_for_company_true` = `My company or team`, `#group_setup_for_company_false` = `Just me` |
| `What will you use this group for?` | `select#group_jobs_to_be_done` options (first is blank): `I want to learn the basics of Git`, `I want to move my repository to GitLab from somewhere else`, `I want to store my code`, `I want to explore GitLab to see if it’s worth switching to`, `I want to use GitLab CI with my existing repository`, `A different reason` |
| invite section | `div.row.js-invite-members-section` |
| actions | `<button class="gl-button btn btn-md btn-confirm" data-qa-selector="create_group_button" type="submit">Create group</button>` and `<a class="gl-button btn btn-md btn-default" href="/dashboard/groups">Cancel</a>` |

`#import-group-pane` (secondary, unlikely to be exercised): `Import groups from another instance of GitLab`
+ `History` link, warning `Not all related objects are migrated.` `More info` `.`,
`Provide credentials for another instance of GitLab to import your groups directly.`,
`GitLab source URL` (`placeholder="https://gitlab.example.com"`, error `Please fill in GitLab source URL.`),
`Personal access token` (`placeholder="e.g. h8d3f016698e..."`, error `Please fill in your personal access token.`),
`Connect instance`; below it `Import group from file` with the deprecation alert
`This feature is deprecated and replaced by group migration.`

On submit, GitLab redirects to `/<path>` (the group overview) and the creator becomes **Owner**.

---

## 18b. `/groups/:group/-/group_members`

### Routes & title

| Route | `<title>` |
|---|---|
| `/groups/:group/-/group_members` | `Group members · robert1003 · GitLab` (pattern `Group members · <group name> · GitLab`) |
| `?sort=name_asc` / `name_desc` / `last_joined` / `access_level_asc` / `oldest_created_user` / `oldest_last_activity` / `recent_sign_in` | same |
| `?tab=groups` / `?tab=invited` / `?tab=access_requests` | same |
| `/groups/:group/-/group_members/request_access` | (POST target of `Request Access`) |

Breadcrumb: `robert1003` › `Group members`. Left sidebar active item **Group information → Members**.
`#content-body` **x=464, width=1248**.

### ANCHOR routes — these five do NOT exist yet and must be creatable

| Route | Task | Handles that must appear (all ANCHOR) |
|---|---|---|
| `/groups/n-lab/-/group_members` | webarena-799 | `@egpast`, `@jontutcher`, `@patou`, `@westurner` |
| `/groups/x-lab/-/group_members` | webarena-800 | `@DCMJY`, `@JonasVautherin`, `@bmyun`, `@dawiss1337`, `@dilipchandima` |
| `/groups/crew/-/group_members` | webarena-801 | `@ASWATFZLLC`, `@linkmatrix`, `@patrickhlauke`, `@westurner` |
| `/groups/coding_friends/-/group_members` | webarena-802 | `@Agnes-U`, `@qhduan` |
| `/groups/webagent/-/group_members` | webarena-803 | `@pandey2000`, `@sayakpaul` |

All 16 usernames resolve to real users on the live instance (HTTP 200). Display names for the seed:

| handle | display name | | handle | display name |
|---|---|---|---|---|
| `@Agnes-U` | `Agnes-U` | | `@DCMJY` | `DCMJY` |
| `@qhduan` | `段清华DEAN` | | `@JonasVautherin` | `Jonas Vautherin` |
| `@ASWATFZLLC` | `Aswat FZ LLC` | | `@bmyun` | `윤보미` |
| `@linkmatrix` | `Robert` | | `@dawiss1337` | `Davis` |
| `@patrickhlauke` | `Patrick H. Lauke` | | `@dilipchandima` | `Dileepa Chandima` |
| `@westurner` | `Wes Turner` | | `@pandey2000` | `Aman Pandey` |
| `@egpast` | `egpast` | | `@sayakpaul` | `Sayak Paul` |
| `@jontutcher` | `Jon Tutcher` | | `@patou` | `Patrice De Saint Steban` |

Because the tasks *create* these groups (via `/groups/new`) and then invite members, the mock must:
1. accept a group creation and register the namespace at `/groups/<path>` **and** `/<path>`;
2. render `/groups/<path>/-/group_members` with the owner row plus the invited rows;
3. surface the `@handle` text so `must_include` string checks pass.

### Page header — `div.row.gl-mt-3 > div.col-lg-12 > div.gl-display-flex.gl-flex-wrap`

Rendered **only when `can_admin_group_member?`** (i.e. the viewer is an Owner). On
`/groups/robert1003/-/group_members` byteblaze is not a member, so this div is **empty** —
no heading, no buttons — and the tab strip is the first visible thing. For a group the user owns
(which is what all five anchor routes will be), the Haml
`groups/group_members/index.html.haml` renders:

```html
<h4>Group members</h4>
<p class="gl-w-full order-md-1">You're viewing members of <strong>coding_friends</strong>.</p>
<div class="gl-display-flex gl-flex-wrap gl-align-items-flex-start gl-ml-auto gl-md-w-auto gl-w-full gl-mt-3">
  <!-- .js-invite-group-trigger  -->
  <button class="btn btn-default btn-md gl-button gl-md-w-auto gl-w-full"
          data-qa-selector="invite_a_group_button">Invite a group</button>
  <!-- .js-invite-members-trigger -->
  <button class="btn btn-confirm btn-md gl-button gl-md-w-auto gl-w-full gl-md-ml-3 gl-md-mt-0 gl-mt-3"
          data-qa-selector="invite_members_button">Invite members</button>
</div>
```
Heading verbatim `Group members`; sub-copy verbatim
`You're viewing members of <strong>{group.name}</strong>.` (`group_member_header_subtext`).
Note there is **no `Import from a project`** button on a group page (only `Invite a group` and
`Invite members`, in that DOM order — the opposite spacing classes from the project page).

The `Invite members` / `Invite a group` modals are **identical to §17**, except the intro copy
substitutes "group" for "project":
`You're inviting members to the coding_friends group.` and
`You're inviting a group to the coding_friends group.`
Same fields (`Username or email address` + help `Select members or type email addresses`;
native `<select>` `Select a role` with `Guest`/`Reporter`/`Developer`/`Maintainer`/`Owner`
(values 10/20/30/40/50) + `Read more about role permissions`;
`Access expiration date (optional)` with placeholder `YYYY-MM-DD`), same `Cancel` / `Invite` footer.

### Tabs, toolbar, table — identical components to §17

Tab strip: `Members` + count badge (plus `Groups` / `Invited` / `Access requests` when non-empty).
Toolbar: history dropdown + `placeholder="Filter members"` input + `Search` button, and the
`Account` sort dropdown with `Account` / `Access granted` / `Max role` / `Created on` /
`Last activity` / `Last sign-in` (hrefs become `/groups/:g/-/group_members?sort=…`) plus the
`sorting-direction-button`.

`<table class="table b-table gl-table members-table b-table-stacked-lg" data-testid="members-table">`
with the **same 7 named `<th>`s**: `Account`, `Source`, `Access granted`, `Max role`,
`Expiration`, `Created on`, `Last activity`. The 8th `col-actions` `<th>` is **omitted entirely**
when the viewer cannot manage members (verified on `/groups/robert1003/-/group_members`);
on an owned group it is present, exactly as in §17.

Row cells behave exactly as in §17: Account = 48px avatar + display name + `@handle` sublabel
(+ `It's you` badge for the current user), Source = `Direct member`, Access granted =
`<time title="Jan 30, 2023 10:33pm PST" datetime="2023-01-31T06:33:09.357Z">3 years ago</time>`
(with `by <granter>` only when `created_by` exists), Max role = badge or `Change role` dropdown,
Expiration = blank datepicker with `placeholder="Expiration date"`, Created on / Last activity in
`%-d %b, %Y`, Actions = `Leave` icon / `Remove member` / nothing.

### The one REAL group members page — `/groups/robert1003/-/group_members` (verbatim)

Tab: `Members 1`. No header block, no Actions column.

| Account | Source | Access granted | Max role | Expiration | Created on | Last activity |
|---|---|---|---|---|---|---|
| Administrator `@root` (link `/root`) | `Direct member` | `3 years ago` — `title="Jan 30, 2023 10:33pm PST"`, `datetime="2023-01-31T06:33:09.357Z"`, **no `by …` suffix** | `Owner` (static `span.badge.badge-muted.badge-pill.gl-badge.md`) | *(empty, placeholder `Expiration date`)* | `18 Jan, 2023` | `16 Jun, 2023` |

### What a task-created group's members page must look like

For `/groups/coding_friends/-/group_members` after webarena-802:

```
Group members
You're viewing members of coding_friends.                    [Invite a group] [Invite members]

Members  3

[Filter members]                                              Account ⌄  ⇅

Account            Source          Access granted   Max role     Expiration        Created on   Last activity
Byte Blaze         Direct member   just now         Owner        Expiration date   …            …
 It's you
 @byteblaze
Agnes-U            Direct member   just now by      Guest ⌄      Expiration date   …            …
 @Agnes-U                          Byte Blaze
段清华DEAN          Direct member   just now by      Guest ⌄      Expiration date   …            …
 @qhduan                           Byte Blaze
```
- The creator (`byteblaze`) is the **sole Owner**: Max role renders as the **static `Owner` badge**
  (he cannot change or remove his own last-owner membership) — mirror the `@a11yproject` /
  `@primer` owner rows in §17.
- Invited members get a **`Change role` dropdown** with all five options
  `Guest`, `Reporter`, `Developer`, `Maintainer`, `Owner` (because the viewer is an Owner) and a
  `Remove member` button (`data-qa-selector="delete_member_button"`).
- The `@handle` text is what the `must_include` evaluators read — it lives in
  `span.gl-avatar-labeled-sublabel`, always prefixed with `@`.
- Remove-member modal copy for a group: title `Remove member`, body
  `Are you sure you want to remove <username> from "<group name>"?`, checkbox
  `Also unassign this user from related issues and merge requests`, footer `Cancel` / `Remove member`.

### Group-level Labels / Milestones (reachable once a group exists)

`/groups/:g/-/labels` and `/groups/:g/-/milestones` reuse the components documented in §16a/§16b
with these differences: the `New label` button href is `/groups/:g/-/labels/new`; label rows have
no `Promote to group label` item (they *are* group labels) and gain
`Subscribe at group level` in the subscribe split-dropdown; milestone rows append
` - Group Milestone` after the title and use an `info`-variant group-name badge; the milestone
sidebar omits the `Releases` block.

---

## 19a. `/projects/new` — new project

### Route & title
| | |
|---|---|
| Path | `/projects/new` |
| Hash variants | `/projects/new#blank_project`, `/projects/new#create_from_template`, `/projects/new#import_project` |
| `<title>` | `New Project · GitLab` |
| Source capture | `assets/html/new-project.html`, `assets/screenshots/reference/new-project.png` |

**No left sidebar, no breadcrumb bar** on the landing screen. There is *no* `.nav-sidebar` and *no* `.breadcrumbs` element on this route (verified live: both `null`).

### Box structure (measured live @1920×1080)
| Element | x | width |
|---|---|---|
| `#content-body` (`main.content`) | 336 | **1248** |
| `#content-body .container` | 390 | **1140** |
| `h2.gl-my-7.gl-font-size-h1.gl-text-center` | 405 | 1110 |
| `.new-namespace-panel-wrapper` (one card) | 405 (first) | **555** (2 per row, `gl-float-left gl-px-3`) |
| `#blank-project-pane` / `#new_project` when a pane is open | 656 | **929** |

DOM skeleton:
```
main#content-body
 └ div.flash-container.flash-container-page.sticky[data-qa-selector="flash_container"]
 └ div.project-edit-container.gl-mt-5
    └ div.project-edit-errors
    └ div.container.gl-display-flex.gl-flex-direction-column
       ├ h2.gl-my-7.gl-font-size-h1.gl-text-center  → "Create new project"
       ├ div.new-namespace-panel-wrapper × 3   (the option cards)
       ├ div.gl-pt-5.gl-text-center            (command-line hint)
       └ div.row → div.tab-pane#blank-project-pane
                   div.tab-pane#create-from-template-pane
                   div.tab-pane#import-project-pane
```

### Landing screen — heading + option cards
Heading: `Create new project` (h2, centred).

**There are only THREE cards, not four.** ⚠️ `Run CI/CD for external repository` / `#cicd_for_external_repo` **does not exist** in this build — `grep -c 'cicd_for_external_repo' new-project.html` = 0, and only three `.new-namespace-panel-wrapper` elements exist. Do not render a 4th card.

Each card is `<a class="new-namespace-panel …" data-qa-selector="panel_link" href="#…">` containing
`div.new-namespace-panel-illustration` (SVG illustration) + `div.gl-pl-4` > `h3.gl-font-size-h2.gl-reset-color` + `p.gl-text-gray-900`.

| # | href (anchor) | `h3` title (verbatim) | `p` description (verbatim) | icon |
|---|---|---|---|---|
| 1 | `#blank_project` | `Create blank project` | `Create a blank project to store your files, plan your work, and collaborate on code, among other things.` | folder outline with a `+` circle badge (purple) |
| 2 | `#create_from_template` | `Create from template` | `Create a project pre-populated with the necessary files to get you started quickly.` | stacked folders with a `+` circle badge |
| 3 | `#import_project` | `Import project` | `Migrate your data from an external source like GitHub, Bitbucket, or another instance of GitLab.` | `</>` circle + dashes + `→` circle pointing at a document |

⚠️ Card 1 reads **`store your files`**, NOT “house your files”.

Layout: cards 1 and 2 share row 1; card 3 sits alone on row 2 (2-up grid, `gl-display-inline-block gl-float-left`, each `.gl-w-full` inside a 555px wrapper).

Below the grid, centred:
`div.gl-pt-5.gl-text-center` → `You can also create a project from the command line.` + `<a href="#">Show command</a>`.

**URL behaviour:** clicking a card sets the hash only — `/projects/new` → `/projects/new#blank_project` (no page load). The 3-card grid is then **hidden** and the corresponding `.tab-pane` gets `.active`. Landing on `/projects/new#blank_project` directly renders the pane straight away.

### Pane chrome (shown when a pane is active)
A two-column layout inside `.container`:
- **left `div.col-lg-3`** — the card's illustration, an `h3`-style title (e.g. `Create blank project`) and the same description paragraph repeated.
- **right `div.col-lg-9`** — a `nav.gl-breadcrumbs[aria-label="Breadcrumb"]` > `ol.breadcrumb.gl-breadcrumb-list` with two `li.gl-breadcrumb-item`:
  1. `<a href="#"><span>New project</span></a>` + `span.gl-breadcrumb-separator` (chevron-right icon)
  2. `<a aria-current="page" href="#blank_project"><span>Create blank project</span></a>`
  then the form.

  (For the group page the equivalent reads `New group` › `Create group`.)

### Blank-project form (`#blank-project-pane` > `form#new_project`, POST `/projects`)
| Order | Label (verbatim) | Control | id | name | data-qa-selector | placeholder / value |
|---|---|---|---|---|---|---|
| 1 | `Project name` | text, `.form-control.gl-form-input.input-lg`, `required` | `project_name` | `project[name]` | `project_name` | `My awesome project` |
| — | (error slot) | `div.gl-field-error.hidden#project_name_error` | | | | |
| 2 | `Project URL` | static namespace box | `project_namespace_id` (hidden, value `2505`) | `project[namespace_id]` | — | text shown: `http://localhost:8023/byteblaze/` |
| 3 | `Project slug` | text, `required` | `project_path` | `project[path]` | `project_path` | `my-awesome-project` |
| 4 | `Visibility Level` | radio group (see below) | | `project[visibility_level]` | | |
| 5 | `Project Configuration` | checkbox group (see below) | | | | |

- `Project name` sits in `div.form-group.project-name.col-sm-12`; `Project URL` in `div.form-group.project-path.col-sm-6.gl-pr-0`; `Project slug` in `div.form-group.project-path.col-sm-6`. Between the two halves is a literal `/` in `div.gl-align-self-center.gl-pl-5`.
- The namespace box is `div.input-group-prepend.static-namespace.flex-shrink-0.has-tooltip` with `title="http://localhost:8023/byteblaze/"`; its inner `div.input-group-text.border-0` renders `http://localhost:8023/byteblaze/`. In 15.7.5 it is a **static text box, not a `<select>`** (byteblaze has no group namespaces).
- Hidden error text under the slug: `Pick a group or namespace where you want to create this project.` (`div.js-group-namespace-error.form-text.gl-text-red-500.gl-display-none`).
- Muted helper: `Want to organize several dependent projects under the same namespace?` + `<a href="/groups/new">Create a group.</a>`
- Hidden success alert (`.js-user-readme-repo`, `gl-display-none`): **`byteblaze / byteblaze`** `is a project that you can use to add a README to your GitLab profile. Create a public project and initialize the repository with a README to get started.` + `Learn more.` → `/help/user/profile/index#add-details-to-your-profile-with-a-readme`

⚠️ **There is NO `Project description (optional)` textarea in the blank-project pane.** Verified two ways: `id="project_description"` occurs only at byte offsets 124856 (template pane) and 144453 (import pane), and live `document.querySelector('#blank-project-pane textarea')` → `null`. The description textarea **does** exist in the *Create from template* and *Import project* panes.

#### Visibility Level radio group
Label `Visibility Level` (`label.label-bold[for=project_visibility_level]`) followed by
`<a href="/help/user/public_access" aria-label="Documentation for Visibility Level">` (question-mark icon).
Container `div.visibility-level-setting`; each option is `div.gl-form-radio.custom-control.custom-radio` > `input.custom-control-input` + `label.custom-control-label.js-visibility-level-radio` + `p.help-text[data-testid="pajamas-component-help-text"]` > `span.option-description`.

| value | id | data-qa-selector | Label | Help text (`span.option-description`, verbatim) | icon |
|---|---|---|---|---|---|
| `0` | `project_visibility_level_0` | `private_radio` | `Private` | `Project access must be granted explicitly to each user. If this project is part of a group, access is granted to members of the group.` | padlock |
| `10` | `project_visibility_level_10` | `internal_radio` | `Internal` | `The project can be accessed by any logged in user except external users.` | shield |
| `20` | `project_visibility_level_20` | `public_radio` | `Public` | `The project can be accessed without any authentication.` | globe/earth |

**Default: `Public` is `checked`.** (ANCHOR-relevant: webarena-742…746 assert `Private`/`private`, webarena-743/744/745 assert `public` — the mock must let the user flip this and must persist it so `/:ns/:proj` renders `.visibility-icon[title]` accordingly.)

#### Project Configuration checkboxes
Label `Project Configuration` (`label.label-bold[for=project_project_configuration]`).

| id | name | data-qa-selector | Label (verbatim) | Help text (verbatim) | default |
|---|---|---|---|---|---|
| `project_initialize_with_readme` | `project[initialize_with_readme]` | `initialize_with_readme_checkbox` | `Initialize repository with a README` | `Allows you to immediately clone this project’s repository. Skip this if you plan to push up an existing repository.` (note the **curly apostrophe** `’`) | **checked** |
| `project_initialize_with_sast` | `project[initialize_with_sast]` | `initialize_with_sast_checkbox` | `Enable Static Application Security Testing (SAST)` | `Analyze your source code for known security vulnerabilities.` + `<a href="/help/user/application_security/sast/index">Learn more.</a>` | unchecked |

(ANCHOR-relevant: webarena-556…566 create repos **with a README**, so `Initialize repository with a README` must actually seed a `README.md` reachable at `/:ns/:proj/-/raw/main/README.md`.)

#### Buttons
| Element | Classes / attrs | Text |
|---|---|---|
| Submit | `button.gl-button.btn.btn-md.btn-confirm.js-create-project-button[type=submit][data-qa-selector="project_create_button"]` | `Create project` |
| Cancel | `a.btn.gl-button.btn-default.btn-cancel[href="/dashboard/projects"]` | `Cancel` |

Every blank-pane input also carries `data-track-label="blank_project" data-track-action="activate_form_input"`.

### `Create from template` pane (`#create-from-template-pane`)
- Card above the form: `Learn how to` + `<a href="https://gitlab.com/gitlab-org/project-templates/contributing">contribute to the built-in templates</a>`.
- Inner tab strip `ul.nav-links.scrolling-tabs.nav.gl-tabs-nav`: ⚠️ **only ONE tab exists** — `li.nav-item.built-in-tab` > `<a class="active nav-link gl-tab-nav-item" href="#built-in">Built-in</a>` with `span.gl-badge.badge-pill.badge-muted.sm.gl-tab-counter-badge` = `30`. There is **no** `Instance` / `Group` / `Sample` tab in this build.
- Tab body `div.project-templates-buttons.import-buttons.tab-pane.active#built-in`; each row is
  `div.template-option.d-flex.align-items-center[data-qa-selector="template_option_container"]`
  → `div.logo.gl-mr-3.px-1 > img.btn-template-icon.icon-<key>`
  → `div.description` (name) + `div.text-muted` (description)
  → `div.controls.d-flex.align-items-center` → `<a class="btn gl-button btn-default gl-mr-3" href="…">Preview</a>` + `<label class="btn gl-button btn-confirm template-button choose-template gl-mb-0" data-testid="use_template_<key>" for="<key>"><input id="<key>" type="radio" name="project[template_name]" value="<key>"><span data-qa-selector="use_template_button">Use template</span></label>`.

All 30 rows in order (`key | name | description`), all verbatim:

| key | Name | Description |
|---|---|---|
| `rails` | `Ruby on Rails` | `Includes an MVC structure, Gemfile, Rakefile, along with many others, to help you get started` |
| `spring` | `Spring` | `Includes an MVC structure, mvnw and pom.xml to help you get started` |
| `express` | `NodeJS Express` | `Includes an MVC structure to help you get started` |
| `iosswift` | `iOS (Swift)` | `A ready-to-go template for use with iOS Swift apps` |
| `dotnetcore` | `.NET Core` | `A .NET Core console application template, customizable for any .NET Core project` |
| `android` | `Android` | `A ready-to-go template for use with Android apps` |
| `gomicro` | `Go Micro` | `Go Micro is a framework for micro service development` |
| `bridgetown` | `Pages/Bridgetown` | `Everything you need to create a GitLab Pages site using Bridgetown` |
| `gatsby` | `Pages/Gatsby` | `Everything you need to create a GitLab Pages site using Gatsby` |
| `hugo` | `Pages/Hugo` | `Everything you need to create a GitLab Pages site using Hugo` |
| `pelican` | `Pages/Pelican` | `Everything you need to create a GitLab Pages site using Pelican` |
| `jekyll` | `Pages/Jekyll` | `Everything you need to create a GitLab Pages site using Jekyll` |
| `plainhtml` | `Pages/Plain HTML` | `Everything you need to create a GitLab Pages site using plain HTML` |
| `gitbook` | `Pages/GitBook` | `Everything you need to create a GitLab Pages site using GitBook` |
| `hexo` | `Pages/Hexo` | `Everything you need to create a GitLab Pages site using Hexo` |
| `middleman` | `Pages/Middleman` | `Everything you need to create a GitLab Pages site using Middleman` |
| `gitpod_spring_petclinic` | `Gitpod/Spring Petclinic` | `A Gitpod configured Webapplication in Spring and Java` |
| `nfhugo` | `Netlify/Hugo` | `A Hugo site that uses Netlify for CI/CD instead of GitLab, but still with all the other great GitLab features` |
| `nfjekyll` | `Netlify/Jekyll` | `A Jekyll site that uses Netlify for CI/CD instead of GitLab, but still with all the other great GitLab features` |
| `nfplainhtml` | `Netlify/Plain HTML` | `A plain HTML site that uses Netlify for CI/CD instead of GitLab, but still with all the other great GitLab features` |
| `nfgitbook` | `Netlify/GitBook` | `A GitBook site that uses Netlify for CI/CD instead of GitLab, but still with all the other great GitLab features` |
| `nfhexo` | `Netlify/Hexo` | `A Hexo site that uses Netlify for CI/CD instead of GitLab, but still with all the other great GitLab features` |
| `salesforcedx` | `SalesforceDX` | `A project boilerplate for Salesforce App development with Salesforce Developer tools` |
| `serverless_framework` | `Serverless Framework/JS` | `A basic page and serverless function that uses AWS Lambda, AWS API Gateway, and GitLab Pages` |
| `tencent_serverless_framework` | `Tencent Serverless Framework/NextjsSSR` | `A project boilerplate for Tencent Serverless Framework that uses Next.js SSR` |
| `jsonnet` | `Jsonnet for Dynamic Child Pipelines` | `An example showing how to use Jsonnet with GitLab dynamic child pipelines` |
| `cluster_management` | `GitLab Cluster Management` | `An example project for managing Kubernetes clusters integrated with GitLab` |
| `kotlin_native_linux` | `Kotlin Native Linux` | `A basic template for developing Linux programs using Kotlin Native` |
| `typo3_distribution` | `TYPO3 Distribution` | `A template for starting a new TYPO3 project` |
| `sample` | `Sample GitLab Project` | `An example project that shows off the best practices for setting up GitLab for your own organization, including sample issues, merge requests, and milestones` |

(Anchor-relevant commit messages `Initialized from 'Android' project template` / `Initialized from 'NodeJS Express' project template` come from the `android` and `express` templates — webarena-748/749/753/754.)

After picking a template the pane shows the same field set as the blank form **plus** `Project description (optional)` (`textarea#project_description[name="project[description]"][rows=3][maxlength=250][placeholder="Description format"][data-qa-selector="project_description"]`).

### `Import project` pane (`#import-project-pane`)
Header row: `h4` `Import project from` + right-aligned `<a class="gl-link gl-ml-auto gl-font-weight-normal" href="/import/history">History</a>`.

Provider grid — each is `a`/`button` with class `gl-button btn btn-md btn-default … js-import-project-btn`, in this exact order:

| # | Label (verbatim) | `data-platform` | href / action |
|---|---|---|---|
| 1 | `GitLab export` | `gitlab_export` | `href="#"`, `data-href="/import/gitlab_project/new"` |
| 2 | `GitLab.com` | — | `js-how-to-import-link`, modal `Import projects from GitLab.com` — body: `To enable importing projects from GitLab.com, ask your GitLab administrator to configure <a href="/help/integration/…">…` |
| 3 | `GitHub` | `github` | `/import/github/new` |
| 4 | `Bitbucket Cloud` | — | `js-how-to-import-link`, modal `Import projects from Bitbucket` |
| 5 | `Bitbucket Server` | `bitbucket_server` | `/import/bitbucket_server/status` |
| 6 | `FogBugz` | `fogbugz` | `/import/fogbugz/new` |
| 7 | `Gitea` | `gitea` | `/import/gitea/new` |
| 8 | `Repository by URL` | `repo_url` | `<button type="button" class="js-toggle-button js-import-git-toggle-button">` (expands the inline Git-URL form) |
| 9 | `Manifest file` | `manifest_file` | `/import/manifest/new` |
| 10 | `Phabricator tasks` | `phabricator` | `/import/phabricator/new` |

⚠️ The label is `Repository by URL` (not “Repo by URL”) and there is no plain “Bitbucket” — it is split into `Bitbucket Cloud` / `Bitbucket Server`.

Repo-by-URL body copy (verbatim, one paragraph each):
- `The repository must be accessible over http://, https:// or git://.`
- `When using the http:// or https:// protocols, please provide the exact URL to the repository. HTTP redirects will not be followed.`
- `If your HTTP repository is not publicly accessible, add your credentials.`
- `The import will time out after 180 minutes. For repositories that take longer, use a clone/push combination.`
- `To import an SVN repository, check out this document.` (`this document` → `/help/user/project/import/svn`)

Fields: `Git repository URL` (errors `This field is required.`, `There is not a valid Git repository at this URL.`, `If your HTTP repository is not publicly accessible, verify your credentials.`), `Username (optional)`, `Password (optional)`, then `Project name`, `Project URL`, `Project slug`, `Project description (optional)`, `Visibility Level` (same three radios/help text), `Create project` / `Cancel`.

---

## 19b. `/groups/new` — new group

### Route & title
| | |
|---|---|
| Path | `/groups/new`; hash variants `#create-group-pane`, `#import-group-pane` |
| `<title>` | `New Group · GitLab` |
| Capture | `assets/html/new-group.html`, `screenshots/reference/new-group.png` |

No left sidebar, no breadcrumb bar. `#content-body` x=336 w=**1248**; `.container` x=390 w=**1140**; card wrapper w=**555**; open pane `#create-group-pane` x=656 w=**929**.

### Landing screen
Heading `h2.gl-my-7.gl-font-size-h1.gl-text-center` → `Create new group`.
Root wrapper is `div.group-edit-container.gl-mt-5`.

Two cards (`a.new-namespace-panel[data-qa-selector="panel_link"]`), same markup as 19a:

| href | `h3` title | `p` description (verbatim) |
|---|---|---|
| `#create-group-pane` | `Create group` | `Assemble related projects together and grant members access to several projects at once.` |
| `#import-group-pane` | `Import group` | `Import a group and related data from another GitLab instance.` |

Cards sit side by side on one row. No command-line hint line here.

### Create-group pane (`#create-group-pane` > `form#new_group.group-form.gl-show-field-errors.gl-mt-3`)
Left `col-lg-3` aside (verbatim, three blocks):
- title `Create group`
- `Groups allow you to manage and collaborate across multiple projects. Members of a group have access to all of its projects.` (`Groups` is a link → `/help/user/group/index`)
- `Groups can also be nested by creating subgroups.` (`subgroups` → `/help/user/group/subgroups/index`)

Right `col-lg-9` starts with a dismissible info alert (`div.gl-alert.gl-alert-info`, rendered client-side — **not present in the saved HTML**, only live):
- title `You're creating a new top-level group`
- body `Members, projects, trials, and paid subscriptions are tied to a specific top-level group. If you are already a member of a top-level group, you can create a subgroup so your new work is part of your existing top-level group. Do you want to create a subgroup instead?`
- primary button `Learn more about subgroups` → `/help/user/group/subgroups/index`
- an `×` dismiss button.

Then breadcrumb `New group` › `Create group` (same `nav.gl-breadcrumbs` markup as 19a).

| Order | Label | id | name | data-qa-selector | placeholder | helper / feedback |
|---|---|---|---|---|---|---|
| 1 | `Group name` | `group_name` | `group[name]` | `group_name_field` | `My awesome group` | `small.form-text.text-gl-muted`: `Must start with letter, digit, emoji, or underscore. Can also contain periods, dashes, spaces, and parentheses.` — invalid-feedback: `Enter a descriptive name for your group.` |
| 2 | `Group URL` | `group_path` | `group[path]` | `group_path_field` | `my-awesome-group` | prefix `div.input-group-text.group-root-path` → `http://localhost:8023/` ; valid-feedback `Group path is available.` ; `maxlength="255"` |

Hidden: `input#group_parent_id[name="group[parent_id]"]`.

⚠️ **There is NO `Group description (optional)` field on this form** — `group[description]` does not appear anywhere in the DOM (verified: `grep 'group\[description\]'` → 0 hits; live `#create-group-pane textarea` → `null`).

#### Visibility level
`label.label-bold` → `Visibility level`, then muted line `Who will be able to see this group?` + `<a href="/help/user/public_access">View the documentation</a>`, then `div.visibility-level-setting`:

| value | id | data-qa-selector | Label | Help text (verbatim) |
|---|---|---|---|---|
| `0` | `group_visibility_level_0` | `private_radio` | `Private` | `The group and its projects can only be viewed by members.` |
| `10` | `group_visibility_level_10` | `internal_radio` | `Internal` | `The group and any internal projects can be viewed by any logged in user except external users.` |
| `20` | `group_visibility_level_20` | `public_radio` | `Public` | `The group and any public projects can be viewed without any authentication.` |

**Default: `Public` checked.**

#### Personalization block
`label.label-bold` → `Now, personalize your GitLab experience`
muted: `We'll use this to help surface the right features and information to you.`

**`Role`** — `select#user_role[name="user[role]"]` in `div.form-group.col-sm-4`, options verbatim:

| value | option text |
|---|---|
| `software_developer` | `Software Developer` |
| `development_team_lead` | `Development Team Lead` |
| `devops_engineer` | `Devops Engineer` |
| `systems_administrator` | `Systems Administrator` |
| `security_analyst` | `Security Analyst` |
| `data_analyst` | `Data Analyst` |
| `product_manager` | `Product Manager` |
| `product_designer` | `Product Designer` |
| `other` | `Other` |

**`Who will be using this group?`** — a *radio pair*, not a select: `label[for=group_setup_for_company]`, then
- `input#group_setup_for_company_true[value=true][name="group[setup_for_company]"]` → label `My company or team`
- `input#group_setup_for_company_false[value=false]` → label `Just me`

**`What will you use this group for?`** — `select#group_jobs_to_be_done[name="group[jobs_to_be_done]"]`:

| value | option text |
|---|---|
| `` (empty, first) | *(blank)* |
| `basics` | `I want to learn the basics of Git` |
| `move_repository` | `I want to move my repository to GitLab from somewhere else` |
| `code_storage` | `I want to store my code` |
| `exploring` | `I want to explore GitLab to see if it’s worth switching to` (curly `’`) |
| `ci` | `I want to use GitLab CI with my existing repository` |
| `other` | `A different reason` |

There is an empty `div.row.js-invite-members-section` between these and the buttons.

#### Buttons
| Element | Text |
|---|---|
| `button.gl-button.btn.btn-md.btn-confirm[type=submit][data-qa-selector="create_group_button"]` | `Create group` |
| `a.gl-button.btn.btn-md.btn-default[href="/dashboard/groups"]` | `Cancel` |

### Import-group pane (`#import-group-pane`)
Two stacked forms:
1. `h4` `Import groups from another instance of GitLab` + `<a href="/import/bulk_imports/history">History</a>`
   warning alert: `Not all related objects are migrated.` + `More info` (`/help/user/group/import/index.md`) + `.`
   `p.gl-mt-3`: `Provide credentials for another instance of GitLab to import your groups directly.`
   - `GitLab source URL` — `input#import_gitlab_url[name=bulk_import_gitlab_url][placeholder="https://gitlab.example.com"][title="Please fill in GitLab source URL."]`, error `Please fill in GitLab source URL.`
   - `Personal access token` — helper: `Create a token with api and read_repository scopes in the` `user settings` `of the source GitLab instance. For` `security reasons` `, set a short expiration date for the token. Keep in mind that large migrations take more time.` ; `input#import_gitlab_token[name=bulk_import_gitlab_access_token][placeholder="e.g. h8d3f016698e…"]`, error `Please fill in your personal access token.`
   - submit `Connect instance` (`data-qa-selector="connect_instance_button"`)
2. `Import group from file` (deprecated banner: `This feature is deprecated and replaced by` `group migration` `.`)
   - `Group name` (`#import_group_name`), `Group URL` (`#import_group_path`, same prefix/help), `Upload file` with helper `To import a group, navigate to the group settings for the GitLab source instance,` `generate an export file` `, and upload it here.`
   - file picker: `button.js-filepicker-button` → `Choose file…` and `span.file_name.js-filepicker-filename` → `No file chosen.`
   - submit `Import`

---

## 20. `/-/issues/new` — new issue form

### Route & title
⚠️ **`/-/issues/new` does not exist** — live GET returns **404** (`Not Found`). The real route is project-scoped:

| | |
|---|---|
| Path | `/:namespace/:project/-/issues/new` (captured: `/byteblaze/dotfiles/-/issues/new`) |
| Variant | `/:ns/:proj/-/issues/new?issuable_template=incident&issue%5Bissue_type%5D=incident` (Incident type) |
| `<title>` | `New Issue · Byte Blaze / dotfiles · GitLab` |
| Capture | `assets/html/proj-dotfiles-new-issue.html`, `screenshots/reference/proj-dotfiles-new-issue.png` |
| Entry points | project sidebar `Issues › List` → `New issue`; the sidebar “+” fly-out `Create a new issue` → `/byteblaze/dotfiles/-/issues/new` |

### Box structure
Project left sidebar present (`.nav-sidebar` w=256). Breadcrumb: `Byte Blaze` › `dotfiles` › `Issues` › `New`.

| Element | x | width |
|---|---|---|
| `#content-body` | 464 | **1248** |
| `form#new_issue` | 464 | 1248 |
| `#issue_title` | 464 | 1248 |
| `.md-area` (description) | 464 | 1248 |
| `.merge-request-assignee` (left col-lg-6) | 449 | 639 |
| `#issuable-due-date` (right col-lg-6) | 1103 | 250 |

Page title: `h1.page-title.gl-font-size-h-display` → `New Issue`, inside `div.top-area.gl-lg-flex-direction-row.gl-border-bottom-0`.
Form: `form#new_issue.issue-form.common-note-form.gl-mt-3.js-quick-submit.gl-show-field-errors.gfm-form`.

### Fields
| # | Label (verbatim) | Control | id | name | data-qa-selector | notes |
|---|---|---|---|---|---|---|
| 1 | `Title (required)` | `input.form-control.pad[type=text][required][maxlength=255]` wrapped in `div[data-testid="issue-title-input-field"]` | `issue_title` | `issue[title]` | `issuable_form_title_field` | **no `placeholder` attribute** |
| — | — | hidden error `p.gl-field-error.hidden` → `This field is required.` | | | | |
| — | — | `p.form-text.text-muted` → `Add ` + `<a href="/help/user/project/description_templates">description templates</a>` + ` to help your contributors to communicate effectively!` | | | | ⚠️ the copy is `Add description templates to help your contributors to communicate effectively!`, **not** “Add description templates to help…” prefixed differently |
| — | `Similar issues` | `div.form-group > div.gl-pb-3` label `Similar issues` + empty `ul.gl-list-style-none.gl-m-0.gl-p-0` (populated by AJAX as you type a title) | | | | |
| 2 | `Type` | dropdown | — | — | — | see below |
| 3 | `Description` | markdown editor | `issue_description` | `issue[description]` | `issuable_form_description_field` | placeholder `Write a description or drag your files here…` (ellipsis char `…`) |
| 4 | — | confidential checkbox | `issue_confidential` | `issue[confidential]` (+ hidden `0`) | — | label `This issue is confidential and should only be visible to team members with at least Reporter access.` |
| 5 | `Assignee` | dropdown + link | — | `issue[assignee_ids][]` (hidden `0`) | — | see below |
| 6 | `Milestone` | GlDropdown | — | `issue[milestone_id]` | `issuable_milestone_dropdown` | |
| 7 | `Labels` | dropdown | `issue_label_ids` | `issue[label_ids][]` | `issuable_label_dropdown` | |
| 8 | `Due date` | datepicker | `issuable-due-date` | `issue[due_date]` | — | placeholder `Select due date` |

Hidden tail inputs: `issue_issue_type` = `issue`, `issue_lock_version` = `0`.

#### `Type` dropdown
`label[for=issue_type]` → `Type` + `span#popovercontainer` (question-mark popover icon).
Toggle: `button.dropdown-menu-toggle` with `span.dropdown-toggle-text.is-default` → `Issue`.
Menu `div.dropdown-menu.dropdown-menu-selectable.dropdown-select`, title row `Select type` + close button (`aria-label="Close"`), content `div.dropdown-content[data-testid="issue-type-select-dropdown"]`:

| Item | class | href |
|---|---|---|
| `Issue` | `is-active` | `/byteblaze/dotfiles/-/issues/new` |
| `Incident` | | `/byteblaze/dotfiles/-/issues/new?issuable_template=incident&issue%5Bissue_type%5D=incident` |

Open-state innerText: `Select type | Issue | Incident`. **Selecting `Incident` changes the URL** (full navigation).

#### Description editor
`div.md-area.position-relative` > `div.md-header` > `ul.clearfix.nav-links.nav.gl-tabs-nav`:
- `li.md-header-tab.active` > `button.js-md-write-button.gl-py-3!` → `Write`
- `li.md-header-tab` > `button.js-md-preview-button.gl-py-3!` → `Preview`
- `li.md-header-toolbar.active.gl-py-2` > `div.md-header-toolbar.active` with the icon buttons.

Toolbar buttons in order — all `button.gl-button.btn.btn-default-tertiary.btn-icon.js-md.has-tooltip` with `title` **=** `aria-label` and `data-container="body"`:

| # | icon | `title` / `aria-label` (verbatim) | `data-md-tag` |
|---|---|---|---|
| 1 | bold | `Add bold text (Ctrl+B)` | `**` |
| 2 | italic | `Add italic text (Ctrl+I)` | `_` |
| 3 | strikethrough | `Add strikethrough text (Ctrl+⇧X)` | `~~` |
| 4 | quote | `Insert a quote` | `> ` |
| 5 | code | `Insert code` | `` ` `` |
| 6 | link | `Add a link (Ctrl+K)` | `[{text}](url)` |
| 7 | bullet list | `Add a bullet list` | `- ` |
| 8 | numbered list | `Add a numbered list` | `1. ` |
| 9 | checklist | `Add a checklist` | `- [ ] ` |
| 10 | indent (`gl-display-none`) | `Indent line (Ctrl+])` | — |
| 11 | outdent (`gl-display-none`) | `Outdent line (Ctrl+[)` | — |
| 12 | collapsible | `Add a collapsible section` | `<details><summary>Click to expand</summary>\n{text}\n</details>` |
| 13 | table | `Add a table` | `\| header \| header \|\n\| ------ \| ------ \|\n\| \| \|\n\| \| \|` |
| 14 | paperclip (`js-attach-file-button`, `data-testid="button-attach-file"`) | `Attach a file or image` | — |
| 15 | expand (`js-zen-enter`) | `Go full screen` | — |

*(Screenshot order left→right: B, I, S, quote, `</>`, link, bullet, numbered, checklist, collapsible, table, paperclip, fullscreen — items 10/11 are hidden.)*

Below the textarea, `div.comment-toolbar.clearfix > div.toolbar-text`:
`Supports ` + `<a href="/help/user/markdown">Markdown</a>` + `. For ` + `<a href="/help/user/project/quick_actions">quick actions</a>` + `, type ` + `<kbd>/</kbd>` + `.`

Upload feedback strings (hidden until used): `0%`, `Try again`, `or`, `attach a new file`, `.`, `Cancel`.
Referenced-users warning (hidden): `You are about to add` `0` `people to the discussion. Proceed with caution.`
Template-swap warning (`div.js-template-warning.hidden`): `Applying a template will replace the existing issue description. Any changes you have made will be lost.` + buttons `Apply template` / `Cancel`.

#### Assignee
`div.form-group.row.merge-request-assignee` > `label.col-12[for=issue_assignee_id]` → `Assignee`.
Toggle `button.dropdown-menu-toggle.js-user-search.js-assignee-search.js-multiselect.js-save-user-data` with `span.dropdown-toggle-text.is-default` → `Unassigned`.
Menu `div.dropdown-menu.dropdown-select.dropdown-menu-user.dropdown-menu-selectable.dropdown-menu-assignee`:
- title `Select assignee` + close button
- search input `input.dropdown-input-field[type=search][placeholder="Search users"][data-qa-selector="dropdown_input_field"]`
- `div.dropdown-content[data-qa-selector="dropdown_list_content"]`; open-state text on dotfiles: `Select assignee | Unassigned | Byte Blaze | @byteblaze`
- `<a class="assign-to-me-link gl-white-space-nowrap gl-pl-4" data-qa-selector="assign_to_me_link" href="#">Assign to me</a>` sits to the right of the toggle.

#### Milestone
`label.col-12[for=issue_milestone_id]` → `Milestone`; GlDropdown `div.dropdown.b-dropdown.gl-dropdown[data-qa-selector="issuable_milestone_dropdown"]`, toggle text `Select milestone`.
Open-state text (dotfiles, which has milestones seeded elsewhere): `Assign milestone | No milestone | No milestone found | Manage milestones`.

#### Labels
`label.col-12[for=issue_label_ids]` → `Labels`; toggle `button.dropdown-menu-toggle.js-label-select…[data-qa-selector="issuable_label_dropdown"]` with text `Labels`.
Menu `div.dropdown-menu.dropdown-select.dropdown-menu-paging.dropdown-menu-labels.dropdown-menu-selectable.dropdown-extended-height`:
- page one: title `Select label` + close; search `input.dropdown-input-field[placeholder="Search"]`; content; footer `ul.dropdown-footer-list` → `<a class="dropdown-toggle-page" href="#">Create project label</a>` and `<a href="/byteblaze/dotfiles/-/labels">Manage project labels</a>`
- open-state text on dotfiles: `Select label | No label | bug | duplicate | enhancement | help wanted | invalid | question | wontfix | Create project label | Manage project labels`
- page two (`div.dropdown-page-two.dropdown-new-label`): back button (`aria-label="Go back"`), title `Create project label`, `input#new_label_name[placeholder="Name new label"]`, a swatch grid `div.suggest-colors.suggest-colors-dropdown` whose `a.has-tooltip` titles are, in order: `Green-cyan`, `Dark sea green`, `Medium sea green`, `Green screen`, `Dark green`, `Blue-gray`, `Blue`, `Lavender`, `Dark violet`, `Deep violet`, `Gray`, `Charcoal grey`, `Champagne`, `Rose red`, `Magenta-pink`, `Crimson`, `Red`, `Dark coral`, `Titanium yellow`, `Carrot orange`, `Aztec Gold`; then `input#new_label_color[placeholder="Assign custom color like #FF0000"]`, buttons `Create` (disabled until valid) / `Cancel`.

#### Due date
`label.col-12[for=issue_due_date]` → `Due date`; `input#issuable-due-date.datepicker.form-control.gl-form-input[name="issue[due_date]"][placeholder="Select due date"]`; a Pikaday calendar `div.pika-single.gitlab-theme.animate-picker.is-hidden.is-bound`.

#### Footer buttons
`div.gl-mt-5.footer-block`:
| Element | Text |
|---|---|
| `button.gl-button.btn.btn-md.btn-confirm.gl-mr-2[type=submit][data-qa-selector="issuable_create_button"]` | `Create issue` |
| `a.btn.gl-button.btn-default.js-reset-autosave[href="/byteblaze/dotfiles/-/issues"]` | `Cancel` |

### Placeholders on this page (complete, verbatim)
`Write a description or drag your files here…` · `Search users` · `Search` (labels) · `Select due date` · `Name new label` · `Assign custom color like #FF0000`. The **title input has no placeholder**.

---

## 21. `/:ns/:proj/edit` — project settings (General)

### Route & title
| | |
|---|---|
| Path | `/:namespace/:project/edit` (captured `/byteblaze/dotfiles/edit`) |
| `<title>` | `General · Settings · Byte Blaze / dotfiles · GitLab` |
| Capture | `assets/html/proj-dotfiles-settings.html`, `screenshots/reference/proj-dotfiles-settings.png` |

Breadcrumb: `Byte Blaze` › `dotfiles` › `General Settings`. There is **no `<h1>`** on the page — “General Settings” only appears in the breadcrumb.

### Box structure
| Element | x | width |
|---|---|---|
| `.nav-sidebar` | 0 | 256 |
| `.breadcrumbs` | 593 | 990 |
| `#content-body` | 609 | **958** |

Top of `#content-body`: `div.flash-container.flash-container-page.sticky[data-qa-selector="flash_container"]`, then a page-search box
`div.gl-my-5 > div.gl-search-box-by-type > input.gl-form-input.gl-search-box-by-type-input.form-control[type=search][placeholder="Search page"][aria-label="Search page"]` — typing filters the `.js-search-settings-section` blocks.

### Left settings sub-nav (project sidebar → `Settings`)
Parent item `Settings` → `/byteblaze/dotfiles/edit`. Sub-items and hrefs (exact order):

| Label | href |
|---|---|
| `General` | `/byteblaze/dotfiles/edit` |
| `Integrations` | `/byteblaze/dotfiles/-/settings/integrations` |
| `Webhooks` | `/byteblaze/dotfiles/-/hooks` |
| `Access Tokens` | `/byteblaze/dotfiles/-/settings/access_tokens` |
| `Repository` | `/byteblaze/dotfiles/-/settings/repository` |
| `Merge requests` | `/byteblaze/dotfiles/-/settings/merge_requests` |
| `CI/CD` | `/byteblaze/dotfiles/-/settings/ci_cd` |
| `Packages and registries` | `/byteblaze/dotfiles/-/settings/packages_and_registries` |
| `Monitor` | `/byteblaze/dotfiles/-/settings/operations` |
| `Usage Quotas` | `/byteblaze/dotfiles/-/usage_quotas` |

`General` carries the active styling on this route.

### Collapsible sections (exact set, in DOM order)
Each is `<section class="settings … no-animate">` with
`div.settings-header > h4.settings-title.js-settings-toggle.js-settings-toggle-trigger-only` (the title itself toggles),
`button.gl-button.btn.btn-md.btn-default.js-settings-toggle` (right-aligned, text `Expand` when collapsed / `Collapse` when expanded),
a description paragraph, then `div.settings-content`.

| # | `section` id / class | Title (verbatim) | Description (verbatim) | default state | `data-qa-selector` |
|---|---|---|---|---|---|
| 1 | `#js-general-settings` `.settings.general-settings.no-animate.expanded` | `Naming, topics, avatar` | `Update your project name, topics, description, and avatar.` | **expanded** (button reads `Collapse`) | — |
| 2 | `#js-shared-permissions` `.settings.sharing-permissions.no-animate` | `Visibility, project features, permissions` | `Choose visibility level, enable/disable project features and their permissions, disable email notifications, and show default award emoji.` | collapsed (`Expand`) | `visibility_features_permissions_content` |
| 3 | *(un-titled)* `section.settings.expanded` | — | contains only the info alert **`Merge requests and approvals settings have moved.`** / body `On the left sidebar, select ` + `<a href="/byteblaze/dotfiles/-/settings/merge_requests">Settings > Merge requests</a>` + ` to view them.` with a `Dismiss` `×` | always shown | — |
| 4 | `section.settings.no-animate` | `Badges` | `Customize this project's badges.` + `<a href="/help/user/project/badges">What are badges?</a>` | collapsed | `badges_settings_content` |
| 5 | `#js-service-desk` `.settings.js-service-desk-setting-wrapper.no-animate` | `Service Desk` | `Enable and disable Service Desk. Some additional configuration might be required.` + `<a href="/help/user/project/service_desk">Learn more</a>` + `.` | collapsed | `service_desk_settings_content` |
| 6 | `#js-project-advanced-settings` `.settings.advanced-settings.no-animate` | `Advanced` | `Housekeeping, export, archive, change path, transfer, and delete.` | collapsed | `advanced_settings_content` |

### Section 1 — `Naming, topics, avatar`
`form#edit_project_193.edit-project.js-general-settings-form` (hidden `_method=patch`, `update_section=js-general-settings`).

| Order | Label (verbatim) | Control | id | name | data-qa-selector | current value on dotfiles |
|---|---|---|---|---|---|---|
| 1 | `Project name` | `input.form-control.gl-form-input` in `div.form-group.col-md-5` | `project_name_edit` | `project[name]` | `project_name_field` | `dotfiles` |
| 2 | `Project ID` | `input.form-control.gl-form-input.w-auto` **`readonly`** in `div.form-group.col-md-7` | `project_id` | `project[id]` | — | `193` |
| 3 | `Topics` | GlTokenSelector (`div.gl-token-selector…`) with inner `input[placeholder="Search for topic"]`; empty-menu item `No matches found` (disabled); hidden `input#project_topic_list_field[name="project[topics]"]` | | | | empty |
| 4 | `Project description (optional)` | `textarea.form-control.gl-form-input[rows=3]` | `project_description` | `project[description]` | — | `🤖 Computer setup` (ANCHOR — webarena-685 needs `Computer setup`) |
| 5 | `Repository size limit (MB)` | `input.form-control[type=number]` **`disabled`** | `project_disabled_repository_size_limit` | `project[disabled_repository_size_limit]` | — | empty; helper `Want to use this feature for free?` `Read more about the` + `<a href="/help/user/admin_area/settings/usage_statistics.md#registration-features-program">Registration Features Program</a>` + `.` |
| 6 | `Project avatar` | `div.avatar-container.rect-avatar.s90 > span.avatar.project-avatar.s90.identicon.bg5` (letter `D`), then `span.js-filepicker` with `button.js-filepicker-button` → `Choose file…` and `span.file_name.js-filepicker-filename` → `No file chosen.`; hidden `input#project_avatar[type=file][name="project[avatar]"]` | | | | helper `div.form-text.text-muted` → `Max file size is 200 KB.` |

Submit: `button.gl-button.btn.btn-md.btn-confirm.gl-mt-6[type=submit][data-qa-selector="save_naming_topics_avatar_button"]` → `Save changes`. **It is rendered `disabled` until a field changes.**

⚠️ The filepicker button label uses a real ellipsis: `Choose file…`, and the filename span reads `No file chosen.` **with a trailing period**.

### Section 2 — `Visibility, project features, permissions`
`form#reduce-visibility-form.sharing-permissions-form` (`_method=patch`, `update_section=js-shared-permissions`).

**Block A — `div.project-visibility-setting.gl-border-1.gl-border-solid.gl-border-gray-100`:**
- `label.label-bold` → `Project visibility`
- `span.text-muted` → `Manage who can see the project in the public access directory.` + `<a href="/help/user/public_access">Learn more</a>` + `.`
- `select.form-control.select-control[name="project[visibility_level]"][data-qa-selector="project_visibility_dropdown"]` — options `0` `Private`, `10` `Internal`, `20` `Public` (dotfiles = `Public`)
- `span.gl-display-block.gl-text-gray-500.gl-mt-2` → live description of the selection, e.g. `Accessible by anyone, regardless of authentication.`
- `div.gl-mt-4` → `strong.gl-display-block` `Additional options` then `label.gl-line-height-28.gl-font-weight-normal.gl-mb-0` with a checkbox (+ hidden `project[request_access_enabled]=true`) → **`Users can request access`**

**Block B — `div.gl-border-1.gl-border-solid.gl-border-t-none.gl-border-gray-100.gl-mb-5.gl-bg-gray-10`** — the feature rows.

Each row is `div.project-feature-row` containing `label.label-bold` (name), `span.text-muted` (description, sometimes with a `Learn more` link + `.`), and `div.project-feature-controls.gl-display-flex.gl-align-items-center.gl-my-3.gl-mx-0` holding:
- a hidden `input[name="project[project_feature_attributes][<x>_access_level]"]`
- a GlToggle: `div.gl-toggle-wrapper[data-testid="toggle-wrapper"]` > `span.gl-toggle-label.gl-sr-only[data-testid="toggle-label"]` (= the row name) + `button.gl-toggle.is-checked`
- a `div.select-wrapper.gl-flex-grow-1 > select.form-control.project-repo-select.select-control` with **exactly two options**: `10` → `Only Project Members`, `20` → `Everyone With Access` (in that DOM order).

Rows, in exact order with real nesting (`project-feature-setting-group.gl-pl-7` = indented child group):

| Row (label verbatim) | nesting | access-level field | has select? | dotfiles value | Description (verbatim) |
|---|---|---|---|---|---|
| `Issues` | top | `issues_access_level` | yes | `20` | `Flexible tool to collaboratively develop ideas and plan work in this project.` + `Learn more` (`/help/user/project/issues/index`) `.` |
| `Repository` | top | `repository_access_level` | yes | `20` | `View and edit files in this project. When set to **Everyone With Access** non-project members have only read access.` (yes — the literal `**` markdown asterisks are rendered) |
| `Merge requests` | **child of Repository** | `merge_requests_access_level` | yes | `20` | `Submit changes to be merged upstream.` |
| `Forks` | **child of Repository** | `forking_access_level` | yes | `20` | `Users can copy the repository to a new project.` |
| `Git Large File Storage (LFS)` | **child of Repository** | `project[lfs_enabled]` (hidden `true`) | **no select**, toggle only | on | `Manages large files such as audio, video, and graphics files.` + `Learn more` (`/help/topics/git/lfs/index`) `.` |
| `CI/CD` | **child of Repository** | `builds_access_level` | yes | `20` | `Build, test, and deploy your changes.` |
| `Analytics` | top | `analytics_access_level` | yes | `20` | `View project analytics.` |
| `Security & Compliance` | top | `security_and_compliance_access_level` | yes | `10` | `Security & Compliance for this project` (no trailing period) |
| `Wiki` | top | `wiki_access_level` | yes | `20` | `Pages for project documentation.` |
| `Snippets` | top | `snippets_access_level` | yes | `20` | `Share code with others outside the project.` |
| `Package registry` | top (`div.project-feature-row[data-testid="package-registry-access-level"]`) | `package_registry_enabled` (hidden `true`) + hidden `package_registry_access_level=30` | **no select**, toggle only | on | `Publish, store, and view packages in a project.` + `Learn more` (`/help/user/packages/index`) `.` |
| `Monitor` | top | `monitor_access_level` | yes | `20` | `Monitor the health of your project and respond to incidents.` |
| `Metrics Dashboard` | **child of Monitor** | `metrics_dashboard_access_level` | yes (**select only, no toggle**) | `10` | `Visualize the project's performance metrics.` |
| `Environments` | top | `environments_access_level` | yes | `20` | `Every project can make deployments to environments either via CI/CD or API calls. Non-project members have read-only access.` + `Learn more` (`/help/ci/environments/index`) `.` |
| `Feature flags` | top | `feature_flags_access_level` | yes | `20` | `Roll out new features without redeploying with feature flags.` + `Learn more` (`/help/operations/feature_flags`) `.` |
| `Infrastructure` | top | `infrastructure_access_level` | yes | `20` | `Configure your infrastructure.` + `Learn more` (`/help/user/infrastructure/index`) `.` |
| `Releases` | top | `releases_access_level` | yes | `20` | `Combine git tags with release notes, release evidence, and assets to create a release.` + `Learn more` (`/help/user/project/releases/index`) `.` |

⚠️ **The label is `Package registry` (lower-case r), not `Packages`.** ⚠️ The following rows named in the brief **do not exist** in 15.7.5 CE: `Packages`, `Container Registry`, `Requirements`, `Pages`, `Operations`. `Metrics Dashboard` is an extra row the brief omitted.

Then three trailing rows (all inside block B):
| Element | Copy (verbatim) |
|---|---|
| `div.project-feature-row.mb-3 > label.js-emails-disabled` + checkbox (+ hidden `project[emails_disabled]=false`) | `Disable email notifications` — helper `span.form-text.text-muted` → `Override user notification preferences for all project members.` |
| `div.project-feature-row.mb-3` > `input#19[name="project[project_setting_attributes][show_default_award_emojis]"]` | `Show default award emojis` — helper `p.help-text` → `Always show thumbs-up and thumbs-down award emoji buttons on issues, merge requests, and snippets.` |
| `div.project-feature-row.gl-mb-5` > `input#20[name="project[project_setting_attributes][warn_about_potentially_unwanted_characters]"]` | `Warn about Potentially Unwanted Characters` — helper `p.help-text` → `Highlight the usage of hidden unicode characters. These have innocent uses for right-to-left languages, but can also be used in potential exploits.` |

Submit: `button.btn.btn-confirm.btn-md.gl-button[type=submit][data-testid="project-features-save-button"][data-qa-selector="visibility_features_permissions_save_button"]` → `Save changes`.

### Section 4 — `Badges`
Two `form.gl-mt-3.gl-mb-3.needs-validation` (`data-testid="edit-badge"` and `data-testid="add-new-badge"`) with identical fields:
| Label | id | data-qa-selector | helper |
|---|---|---|---|
| `Name` | `badge-name` | `badge_name_field` | — |
| `Link` | `badge-link-url` (`type=URL`, required) | `badge_link_url_field` | `Supported ` + `<a href="/help/user/project/badges">variables</a>` + `: %{project_path}, %{project_title}, %{project_name}, %{project_id}, %{default_branch}, %{commit_sha}` ; example `Example: https://example.gitlab.com/%{project_path}` ; invalid-feedback `Enter a valid URL` |
| `Badge image URL` | `badge-image-url` (`type=URL`, required) | `badge_image_url_field` | same variables list ; `Example: https://example.gitlab.com/%{project_path}/badges/%{default_branch}/pipeline.svg` |
| `Badge image preview` | `#badge-preview` | `badge_image_link` | states `No badge image`, `No image to preview`, reload button `title="Reload badge image"` |

Edit form footer (`div.row-content-block`): `Cancel` (`data-testid="cancelEditing"`) + `Save changes` (`data-testid="saveEditing"`).
Add form footer: `Add badge` (`data-qa-selector="add_badge_button"`).
List card: `div.card > div.card-header` → `Your badges` + `span.badge.badge-muted.badge-pill.gl-badge.sm` → `0`; body → `This project has no badges`.

### Section 5 — `Service Desk`
Content is a promo banner `section.gl-banner.js-service-desk-callout#promote_service_desk`:
- `h1.gl-banner-title` → `Improve customer support with Service Desk`
- body → `Service Desk allows people to create issues in your GitLab instance without their own user account. It provides a unique email address for end users to create issues in a project. Replies can be sent either through the GitLab interface or by email. End users only see threads through email.`
- CTA `a.btn.btn-md.btn-confirm.gl-button.js-close-callout[href="/help/user/project/service_desk.html#configuring-service-desk"]` → `Configure Service Desk`
- close button `aria-label="Dismiss Service Desk promotion"`

### Section 6 — `Advanced` — action cards (exact set & order)
Each is `div.sub-section`. **NEVER click any of these.**

| # | Heading (verbatim) | Heading class | Description (verbatim) | Action control |
|---|---|---|---|---|
| 1 | `Housekeeping` | plain | `Runs a number of housekeeping tasks within the current repository, such as compressing file revisions and removing unreachable objects.` + `<a href="/help/administration/housekeeping">Learn more.</a>` | `a.btn.gl-button.btn-default[href="/byteblaze/dotfiles/housekeeping"]` → `Run housekeeping` |
| 2 | `Export project` (`div.sub-section[data-qa-selector="export_project_content"]`) | plain | `Export this project with all its related data in order to move it to a new GitLab instance. When the exported file is ready, you can download it from this page or from the download link in the email notification you will receive. You can then import it when creating a new project.` + `<a href="/help/user/project/settings/import_export">Learn more.</a>` then `The following items will be exported:` list → `Project and wiki repositories`, `Project uploads`, `Project configuration, excluding integrations`, `Issues with comments, merge requests with diffs and comments, labels, milestones, snippets, and other project entities`, `LFS objects`, `Issue Boards`, `Design Management files and data`; then `The following items will NOT be exported:` → `Job logs and artifacts`, `Container registry images`, `CI variables`, `Pipeline triggers`, `Webhooks`, `Any encrypted tokens` | `a.btn.gl-button.btn-default[data-qa-selector="export_project_link"][href="/byteblaze/dotfiles/export"]` → `Export project` |
| 3 | `Archive project` | `h4.warning-title` | `Archiving the project makes it entirely read-only. It is hidden from the dashboard and doesn't display in searches.` / `The repository cannot be committed to, and no issues, comments, or other entities can be created.` + `<a href="/help/user/project/settings/index#archive-a-project">Learn more.</a>` | `a.gl-button.btn.btn-confirm[data-qa-selector="archive_project_link"][href="/byteblaze/dotfiles/archive"][aria-label="Archive project"]` → `Archive project` |
| 4 | `Change path` (`div.sub-section.rename-repository`) | `h4.warning-title` | `A project’s repository name defines its URL (the one you use to access the project via a browser) and its place on the file disk where GitLab is installed.` + `<a href="/help/user/project/settings/index#rename-a-repository">Learn more.</a>` / `Be careful. Renaming a project's repository can have unintended side effects.` / `You will need to update your local repositories to point to the new location.` ; label `Path` with prefix `http://localhost:8023/byteblaze/` and `input#project_path[name="project[path]"][data-qa-selector="project_path_field"]` value `dotfiles` | `input.gl-button.btn.btn-danger[type=submit][value="Change path"][data-qa-selector="change_path_button"]` → **`Change path`** (danger/red) |
| 5 | `Transfer project` (`div.sub-section[data-qa-selector="transfer_project_content"]`) | `h4.danger-title` | `Transfer your project into another namespace.` + `<a href="…#transfer-a-project-to-another-namespace">Learn more.</a>` / `When you transfer your project to a group, you can easily manage multiple projects, view usage quotas for storage, pipeline minutes, and users, and start a trial or upgrade to a paid tier.` / `Don't have a group?` + `<a href="/groups/new">Create one</a>` / `Things to be aware of before transferring:` → `Be careful. Changing the project's namespace can have unintended side effects.`, `You can only transfer the project to namespaces you manage.`, `You will need to update your local repositories to point to the new location.`, `Project visibility level will be changed to match namespace rules when transferring to a group.` ; `fieldset > legend` `Select a new namespace`; GlDropdown `[data-testid="transfer-locations-dropdown"][data-qa-selector="namespaces_list"]` toggle text `Select a new namespace`, search `input[placeholder="Search"][data-qa-selector="namespaces_list_search"]` | `button.btn.btn-danger.btn-md.disabled.gl-button[data-testid="confirm-danger-button"][data-qa-selector="transfer_project_button"][disabled]` → `Transfer project` |
| 6 | `Delete project` | `h4.danger-title` | `Deleting the project will delete its repository and all related resources, including issues and merge requests.` + `<a href="/help/user/project/settings/index#remove-a-fork-relationship">Learn more.</a>` / `Deleted projects cannot be restored!` | `button.btn.btn-danger.btn-md.gl-button[type=button][data-qa-selector="delete_button"]` → `Delete project` (opens a confirm modal) |

⚠️ **`Remove fork relationship` and `Rename repository` are NOT separate cards.** `Rename repository` is the section titled `Change path`; `Remove fork relationship` only renders on projects that *are* forks (dotfiles is not) — check `tree-archivetweets-fork.html` / `proj-dotfiles-forks.html` if you need it.

Trailing overlay: `div.save-project-loader.hide` → `Saving project.` / `Please wait a moment, this page will automatically refresh when ready.`

---

## 22a. `/-/profile` — Edit profile

### Route & title
| | |
|---|---|
| Path | `/-/profile` |
| `<title>` | `Edit Profile · User Settings · GitLab` |
| Capture | `assets/html/profile-account.html`, `screenshots/reference/profile-account.png` |
| Breadcrumb | `User Settings` › `Edit Profile` |

### Box structure
| Element | x | width |
|---|---|---|
| `.nav-sidebar` (context header `User Settings`, avatar = the byteblaze gravatar) | 0 | 256 |
| `.breadcrumbs` | 593 | 990 |
| `#content-body` | 609 | **958** |

Every section is a `div.row.js-search-settings-section` with a left `div.col-lg-4.profile-settings-sidebar` (h4 title + muted blurb) and a right `div.col-lg-8` (the fields). Above them sits the same `input[placeholder="Search page"][aria-label="Search page"]` box as the project settings page.

Form: `form#edit_user_2330.edit-user.js-edit-user.gl-mt-3.js-quick-submit.gl-show-field-errors.js-password-prompt-form` (`_method=put`).

### Left settings sub-nav (`.nav-sidebar`)
Context header `User Settings` → `/-/profile`. Items (order + hrefs):

| Label | href |
|---|---|
| `Profile` (active on this route) | `/-/profile` |
| `Account` | `/-/profile/account` |
| `Applications` | `/-/profile/applications` |
| `Chat` | `/-/profile/chat_names` |
| `Access Tokens` | `/-/profile/personal_access_tokens` |
| `Emails` | `/-/profile/emails` |
| `Password` | `/-/profile/password/edit` |
| `Notifications` | `/-/profile/notifications` |
| `SSH Keys` | `/-/profile/keys` |
| `GPG Keys` | `/-/profile/gpg_keys` |
| `Preferences` | `/-/profile/preferences` |
| `Active Sessions` | `/-/profile/active_sessions` |
| `Authentication log` | `/-/profile/audit_log` |

(The hover fly-out duplicates each item; the fly-out label for the last one is `Authentication Log` with a capital L, the sidebar label is `Authentication log`.)
Footer: `Collapse sidebar`.

### Section `Public avatar`
Left: h4 `Public avatar`; blurb `You can upload your avatar here or change it at ` + `<a href="https://gravatar.com">gravatar.com</a>`.
Right: `div.avatar-image > a[href="https://www.gravatar.com/avatar/99a4297c867eada2606b9b6973f081f9?s=800&d=identicon"] > img.gl-avatar.gl-avatar-s96.gl-float-left.gl-mr-5.gl-avatar-circle`, then
`h5.gl-mt-0` → `Upload new avatar`,
`button.gl-button.btn.btn-md.btn-default.js-choose-user-avatar-button` → **`Choose file...`** (three ASCII dots here, unlike the project page's `…`),
`span.gl-ml-3.js-avatar-filename` → `No file chosen.`,
hidden `input#user_avatar-trigger[type=file][name="user[avatar]-trigger"]`,
`div.gl-text-gray-500` → **`The maximum file size allowed is 200KB.`**

⚠️ There is **no `Remove avatar` button** while the avatar comes from Gravatar (no uploaded avatar). It only appears once a custom avatar is uploaded.

A modal `div.modal.modal-profile-crop` is present in the DOM: title `Position and size your new avatar`, footer button `Set new profile picture`.

### Section `Current status`  ← ANCHOR-critical
Left: h4 `Current status`; blurb `This emoji and message will appear on your profile and throughout the interface.`
Right (all inside `div.col-lg-8`):

| Element | Details |
|---|---|
| hidden inputs | `user[status][emoji]`, `user[status][message]`, `user[status][availability]` (value `not_set`), `user[status][clear_status_after]` |
| emoji picker | `div.emoji-picker > div.dropdown.b-dropdown.gl-dropdown.position-static.btn-group.gl-h-full` with `button.emoji-menu-toggle-button` containing `span.gl-relative[data-testid="no-emoji-placeholder"]` (a smiley outline). Menu is `ul.dropdown-menu.dropdown-extended-height`. |
| status message | `input.gl-form-input.form-control.js-gfm-input-initialized[type=text]` **placeholder `What's your status?`** (straight apostrophe). Its id is auto-generated (`__BVID__19`) — target it by placeholder or by `.input-group input[type=text]` inside this section. |
| clear button | `button.js-clear-user-status-button[title="Clear status"][aria-label="Clear status"]` (an `×`) in `div.input-group-append` |
| busy checkbox | `input.custom-control-input[data-testid="user-availability-checkbox"][value=true]` + `label` → **`Set yourself as busy`**, help `p.help-text` → **`Displays that you are busy or not able to respond`** |
| clear-after | `fieldset > legend` → `Clear status after`, then GlDropdown `div[data-testid="clear-status-at-dropdown"]`, toggle text default `Never` |

⚠️ **`Clear status after` options are NOT the list in the brief.** Verified live and in the DOM — the eight `button.dropdown-item` entries, each with a `data-testid`:

| `data-testid` | Label (verbatim) |
|---|---|
| `never` | `Never` |
| `thirtyMinutes` | `30 minutes` |
| `threeHours` | `3 hours` |
| `eightHours` | `8 hours` |
| `oneDay` | `1 day` |
| `threeDays` | `3 days` |
| `oneWeek` | `7 days` |
| `oneMonth` | `30 days` |

(There is no `1 hour`, `4 hours`, `Today`, `This week`, or `Thirty days`.)

**ANCHOR wiring (webarena-418…422):** the evaluator runs
`document.querySelector('.cover-status').lastChild.textContent` on **`/byteblaze`** and compares (exact_match) against one of
`Cruising` (ANCHOR), `Enjoying life` (ANCHOR), `Playing Badminton` (ANCHOR), `Resting due to leg injury` (ANCHOR), `Out of Office` (ANCHOR).
So editing this `What's your status?` input and pressing `Update profile settings` **must persist to the profile page's `.cover-status`**. The same status can also be set from the top-nav user dropdown → `Set status`, which opens a modal titled **`Set a status`** with the same emoji picker, the same `What's your status?` input, the same `Set yourself as busy` checkbox, the same `Clear status after` dropdown, and buttons `Remove status` + `Set status`.
Current live value: **empty**.

### Section `Time settings`
Left: h4 `Time settings`; blurb `Set your local time zone.`
Right: `label[for=user_user_timezone]` → `Time zone`; hidden `input#user_timezone[name="user[timezone]"]`; GlDropdown `button.gl-dropdown-toggle` with `span.gl-dropdown-button-text` → **`Select timezone`** (nothing selected), inside `div.gl-md-form-input-lg`; menu `ul.dropdown-menu.gl-w-full!`.

### Section `Main settings`
Left: h4 `Main settings`; blurb `This information will appear on your profile.`
Right, in exact DOM order. All text inputs are `input.gl-form-input.form-control` (most also `.gl-md-form-input-lg`); each field has a hidden `p.gl-field-error.hidden` → `This field is required.`

| # | Label (verbatim) | id | name | current value (byteblaze) | placeholder | helper `small.form-text.text-gl-muted` (verbatim) |
|---|---|---|---|---|---|---|
| 1 | `Full name` | `user_name` | `user[name]` | `Byte Blaze` | — | `Enter your name, so people you know can recognize you.` ; also `title="Using emojis in names seems fun, but please try to set a status message instead"`, `required` ; wrapper `div.form-group.gl-form-group.col-md-9.rspec-full-name` |
| 2 | `User ID` | `user_id` | `user[id]` | `2330` | — | **`readonly`**, wrapper `div.form-group.gl-form-group.col-md-3` (sits on the same row as Full name) |
| 3 | `Pronouns` | `user_pronouns` | `user[pronouns]` | *(empty)* | — | `Enter your pronouns to let people know how to refer to you.` |
| 4 | `Pronunciation` | `user_pronunciation` | `user[pronunciation]` | *(empty)* | — | `Enter how your name is pronounced to help people address you correctly.` |
| 5 | `Email` | `user_email` | `user[email]` | `ericwbailey@fakegithub.com` | — | `We also use email for avatar detection if no avatar is uploaded.` ; `required` ; followed by hidden `input#user_validation_password.js-password-prompt-field[name="user[validation_password]"][value="validation_password"]` |
| 6 | `Public email` | `user_public_email` | `user[public_email]` | *(first option)* | — | `select.gl-form-select.custom-select` — options: `""` → `Do not show on profile`, `ericwbailey@fakegithub.com` → `ericwbailey@fakegithub.com`. Helper `This email will be displayed on your public profile.` |
| 7 | `Commit email` | `user_commit_email` | `user[commit_email]` | `""` (selected) | — | `select` — options: `""` → `Use primary email (ericwbailey@fakegithub.com)` *(selected)*, `_private` → `Use a private email - 2330-byteblaze@users.noreply.db0150aa304d`, `ericwbailey@fakegithub.com` → `ericwbailey@fakegithub.com`. Helper `This email will be used for web based operations, such as edits and merges.` + `<a href="/help/user/profile/index#change-the-email-displayed-on-your-commits">Learn more.</a>` |
| 8 | `Skype` | `user_skype` | `user[skype]` | *(empty)* | `username` | — |
| 9 | `Linkedin` | `user_linkedin` | `user[linkedin]` | *(empty)* | — | `Your LinkedIn profile name from linkedin.com/in/profilename` ⚠️ the **label is `Linkedin`**, not `LinkedIn` |
| 10 | `Twitter` | `user_twitter` | `user[twitter]` | *(empty)* | `@username` | — |
| 11 | `Website url` | `user_website_url` | `user[website_url]` | *(empty)* | `https://website.com` | — |
| 12 | `Location` | `user_location` | `user[location]` | `Boston, MA` | `City, country` | — |
| 13 | `Job title` | `user_job_title` | `user[job_title]` | *(empty)* | — | — |
| 14 | `Organization` | `user_organization` | `user[organization]` | `@github ` (**trailing space**) | — | `Who you represent or work for.` |
| 15 | `Bio` | `user_bio` | `user[bio]` | `Inclusive design and accessibility advocate. Accessibility and design systems wonk for @primer.` | — | `textarea.gl-form-input.gl-form-textarea.form-control[rows=4][maxlength=250]`; helper `Tell us about yourself in fewer than 250 characters.` |

**ANCHOR wiring (webarena-448…452):** the evaluator runs
`document.querySelector('.profile-header [itemprop="url"]').outerText` on **`/byteblaze`** and exact-matches
`egg.tart.com` (ANCHOR), `helloworld.xyz` (ANCHOR), `a11yproject.contributor.me` (ANCHOR), `www.byteblaze.com` (ANCHOR), `byteblaze.github.io` (ANCHOR).
So **`input#user_website_url[name="user[website_url]"]`** is the field the mock must wire to `/byteblaze`'s `[itemprop="url"]`, and the profile page must render the value **without the scheme** (GitLab strips `http(s)://` for display). Starting value is empty.

### Checkbox fieldsets (after Main settings, still inside `col-lg-8`)
| `legend.col-form-label` (verbatim) | checkbox id / name | label (verbatim) | help |
|---|---|---|---|
| `Private profile` | `user_private_profile` / `user[private_profile]` (+ hidden `0`) | `Don't display activity-related personal information on your profile.` | trailing `<a href="/help/user/profile/index.md#make-your-user-profile-page-private">` (question-mark icon) |
| `Private contributions` | `user_include_private_contributions` / `user[include_private_contributions]` (+ hidden `0`) | `Include private contributions on my profile` | `p.help-text[data-testid="pajamas-component-help-text"]` → `Choose to show contributions of private projects on your public profile without any project, repository or organization information.` |

⚠️ There is **no `Enabled` checkbox** on this page.

### Footer
`div.row.js-hide-when-nothing-matches-search > div.col-lg-12`:
| Element | Text |
|---|---|
| `button.gl-button.btn.btn-md.btn-confirm.gl-mr-3.js-password-prompt-btn[type=submit]` | `Update profile settings` |
| `a.gl-button.btn.btn-md.btn-default[href="/byteblaze"]` | `Cancel` |

---

## 22b. `/-/profile/preferences` — Preferences

### Route & title
| | |
|---|---|
| Path | `/-/profile/preferences` |
| `<title>` | `Preferences · User Settings · GitLab` |
| Capture | `assets/html/profile-preferences.html`, `screenshots/reference/profile-preferences.png` |
| Breadcrumb | `User Settings` › `Preferences` |

Same shell as 22a: `.nav-sidebar` (256, `Preferences` active), `#content-body` x=609 w=**958**, the `Search page` box at the top, then `form#profile-preferences-form.edit_user` (`_method=put`). Each block is `div.row.js-preferences-form.js-search-settings-section` with `div.col-lg-4` (h4 + blurb) + `div.col-lg-8`.

The page preloads 10 `<link>` theme stylesheets (`/assets/themes/theme_indigo-*.css`, `theme_light_indigo`, `theme_blue`, `theme_light_blue`, `theme_green`, `theme_light_green`, `theme_red`, `theme_light_red`, `theme_gray`, `theme_light_gray`).

### 1. `Color theme`
Left `div.col-lg-4.application-theme#navigation-theme`: h4 `Color theme`, blurb `Customize the color of GitLab.`
Right `div.col-lg-8.application-theme > div.row`: each swatch is `label.col-6.col-sm-4.col-md-3.gl-mb-5.gl-text-center` > `div.preview.<cls>` (the colour block) + `div.gl-form-radio.custom-control.custom-radio` > `input.custom-control-input` + `label.custom-control-label`.
**Four per row @1920.**

| order | `theme_id` value | input id | preview class | Label (verbatim) |
|---|---|---|---|---|
| 1 | `1` | `user_theme_id_1` | `ui-indigo` | `Indigo` **(checked)** |
| 2 | `6` | `user_theme_id_6` | `ui-light-indigo` | `Light Indigo` |
| 3 | `4` | `user_theme_id_4` | `ui-blue` | `Blue` |
| 4 | `7` | `user_theme_id_7` | `ui-light-blue` | `Light Blue` |
| 5 | `5` | `user_theme_id_5` | `ui-green` | `Green` |
| 6 | `8` | `user_theme_id_8` | `ui-light-green` | `Light Green` |
| 7 | `9` | `user_theme_id_9` | `ui-red` | `Red` |
| 8 | `10` | `user_theme_id_10` | `ui-light-red` | `Light Red` |
| 9 | `2` | `user_theme_id_2` | `ui-gray` | `Gray` |
| 10 | `3` | `user_theme_id_3` | `ui-light-gray` | `Light Gray` |
| 11 | `11` | `user_theme_id_11` | `gl-dark` | `Dark Mode (alpha)` |

⚠️ The 9th/11th labels are **`Gray`** and **`Dark Mode (alpha)`** — there is no plain `Dark` or plain `Light` theme.

### 2. `Syntax highlighting theme`
Left `div.col-lg-4.profile-settings-sidebar#syntax-highlighting-theme`: h4 `Syntax highlighting theme`, blurb `This setting allows you to customize the appearance of the syntax.` + `<a href="/help/user/profile/preferences#syntax-highlighting-theme">Learn more</a>` + `.`
Right `div.col-lg-8.syntax-theme`: `label > div.preview > img` (a code sample thumbnail) + radio. **Three per row.**

| `color_scheme_id` | input id | Label |
|---|---|---|
| `1` | `user_color_scheme_id_1` | `Light` **(checked)** |
| `2` | `user_color_scheme_id_2` | `Dark` |
| `3` | `user_color_scheme_id_3` | `Solarized Light` |
| `4` | `user_color_scheme_id_4` | `Solarized Dark` |
| `5` | `user_color_scheme_id_5` | `Monokai` |
| `6` | `user_color_scheme_id_6` | `None` |

### 3. `Diff colors`
Left `div.col-lg-4.profile-settings-sidebar#diffs-colors`: h4 `Diff colors`, blurb `Customize the colors of removed and added lines in diffs.`
Right:
- `label` → `Preview` above `table.code.white` — a side-by-side (`parallel`) diff sample whose left/right lines are:
  `# Removed content` / `# Added content`, `v = 1`, `s = "string"`, *(blank)*, `for i in range(-10, 10):`, `print(i + 1)`, *(blank)*, `class LinkedList(object):`, `def __init__(self, x):`, `self.val = x`, `self.next = None`
- `Color for removed lines` — `label[for=color-picker-1]`; `input#color-picker-1[type=color]` inside `div[data-testid="color-preview"]` + a text input; invalid-feedback `Please enter a valid hex (#RRGGBB or #RGB) color value`; helper `Enter any color or choose one of the suggested colors below.`; four swatch links `a.gl-link.gl-rounded-base.gl-w-7.gl-h-7[href="#"]` with `title` = `Orange`, `Blue`, `Default removal color`, `Default addition color`; hidden `input#user_diffs_deletion_color[name="user[diffs_deletion_color]"]`
- `Color for added lines` — identical structure with `#color-picker-2` and hidden `input#user_diffs_addition_color[name="user[diffs_addition_color]"]`

### 4. `Behavior`
Left `div.col-lg-4.profile-settings-sidebar#behavior`: h4 `Behavior`, blurb `This setting allows you to customize the behavior of the system layout and default views.` + `<a href="/help/user/profile/preferences#behavior">Learn more</a>` + `.`

| Order | Label (verbatim) | Control | id / name | options / default | helper (verbatim) |
|---|---|---|---|---|---|
| 1 | `Layout width` | `select.gl-form-select.custom-select` | `user_layout` / `user[layout]` | `fixed` → `Fixed` **(selected)**, `fluid` → `Fluid` | `Choose between fixed (max. 1280px) and fluid (100%) application layout.` |
| 2 | `Dashboard` | Select2 (`div.select2-container#s2id_user_dashboard` wrapping `select.select2#user_dashboard`) | `user_dashboard` / `user[dashboard]` | see below | `Choose what content you want to see by default on your dashboard.` |
| 3 | `Project overview content` | `select.gl-form-select.custom-select` | `user_project_view` / `user[project_view]` | `files` → `Files and Readme (default)` **(selected)**, `activity` → `Activity`, `readme` → `Readme` | `Choose what content you want to see on a project’s overview page.` (curly `’`) |
| 4 | — | checkbox (+ hidden `0`) | `user_render_whitespace_in_code` / `user[render_whitespace_in_code]` | unchecked | label `Render whitespace characters in the Web IDE` |
| 5 | — | checkbox (+ hidden `0`) | `user_show_whitespace_in_diffs` / `user[show_whitespace_in_diffs]` | **checked** | label `Show whitespace changes in diffs` |
| 6 | — | checkbox (+ hidden `0`) | `user_view_diffs_file_by_file` / `user[view_diffs_file_by_file]` | unchecked | label `Show one file at a time on merge request's Changes tab`; help `Instead of all the files changed, show only one file at a time. To switch between files, use the file browser.` |
| 7 | — | checkbox (+ hidden `0`) | `user_markdown_surround_selection` / `user[markdown_surround_selection]` | **checked** | label `Surround text selection when typing quotes or brackets`; help `When you type in a description or comment box, selected text is surrounded by the corresponding character after typing one of the following characters: " , ' , ` , ( , [ , { , < , * , _ .` |
| 8 | — | checkbox (+ hidden `0`) | `user_markdown_automatic_lists` / `user[markdown_automatic_lists]` | **checked** | label `Automatically add new list items`; help `When you type in a description or comment box, pressing Enter in a list adds a new item below.` |
| 9 | `Tab width` | `input.form-control.gl-form-input[type=number][required]` | `user_tab_width` / `user[tab_width]` | value `8` | `Must be a number between 1 and 12` |

`Dashboard` options (verbatim, in order):

| value | option text |
|---|---|
| `projects` | `Your Projects (default)` **(selected)** |
| `stars` | `Starred Projects` |
| `project_activity` | `Your Projects' Activity` |
| `starred_project_activity` | `Starred Projects' Activity` |
| `groups` | `Your Groups` |
| `todos` | `Your To-Do List` |
| `issues` | `Assigned Issues` |
| `merge_requests` | `Assigned merge requests` |
| `followed_user_activity` | `Followed Users' Activity` |

⚠️ The label is **`Dashboard`**, not “Default dashboard”. ⚠️ There is **no** `Homepage content`, **no** `Group overview content`, and **no** `Show shortcut buttons above files on project overview` in this build. `Use relative times` lives in `Time preferences` (below), not in `Behavior`, and `Show whitespace changes in diffs` appears exactly **once**.

### 5. `Localization`
Left `div.col-lg-4.profile-settings-sidebar#localization`: h4 `Localization`, blurb `Customize language and region related settings.` + `<a href="/help/user/profile/preferences#localization">Learn more</a>` + `.`

- **`Language`** — Select2 (`#s2id_user_preferred_language` wrapping `select.select2#user_preferred_language[name="user[preferred_language]"]`); shown value `English (100% translated)`. Options verbatim:

| value | option text |
|---|---|
| `zh_CN` | `Chinese, Simplified - 简体中文 (97% translated)` |
| `zh_TW` | `Chinese, Traditional (Taiwan) - 繁體中文 (台灣) (99% translated)` |
| `da_DK` | `Danish - dansk (36% translated)` |
| `en` | `English (100% translated)` **(selected)** |
| `fr` | `French - français (94% translated)` |
| `de` | `German - Deutsch (17% translated)` |
| `ja` | `Japanese - 日本語 (30% translated)` |
| `ko` | `Korean - 한국어 (20% translated)` |
| `nb_NO` | `Norwegian (Bokmål) - norsk (bokmål) (24% translated)` |
| `pl_PL` | `Polish - polski (3% translated)` |
| `pt_BR` | `Portuguese (Brazil) - português (Brasil) (57% translated)` |
| `ro_RO` | `Romanian - română (96% translated)` |
| `ru` | `Russian - русский (26% translated)` |
| `si_LK` | `Sinhalese - සිංහල (11% translated)` |
| `es` | `Spanish - español (35% translated)` |
| `tr_TR` | `Turkish - Türkçe (11% translated)` |
| `uk` | `Ukrainian - українська (52% translated)` |

  Helper: `This feature is experimental and translations are not yet complete.` + `<a class="text-nowrap" href="http://localhost:8023/help/development/i18n/translation">Help translate GitLab into your language</a>` + external-link icon (`aria-label="Open new window"`).

- **`First day of the week`** — `select.gl-form-select.custom-select#user_first_day_of_week[name="user[first_day_of_week]"]`:

| value | option text |
|---|---|
| `""` | `System default (Sunday)` **(selected)** |
| `0` | `Sunday` |
| `1` | `Monday` |
| `6` | `Saturday` |

### 6. `Time preferences`
Left `div.col-lg-4.profile-settings-sidebar#time-preferences`: h4 `Time preferences`, blurb `Configure how dates and times display for you.` + `<a href="/help/user/profile/preferences#time-preferences">Learn more</a>` + `.`
Right: single checkbox `input#user_time_display_relative[name="user[time_display_relative]"][value=1]` (+ hidden `0`) — **checked** — label `Use relative times`, help `p.help-text[data-testid="pajamas-component-help-text"]` → **`For example: 30 minutes ago.`**

*(This is what makes list/detail pages render `3 years ago` rather than absolute dates.)*

### 7. Integrations
⚠️ **There is no `Integrations` section (no Gitpod, no Sourcegraph) on this page in 15.7.5 CE as deployed.** Do not build one.

### Footer
`div.row.gl-mt-3.js-preferences-form.js-search-settings-section > div.col-sm-12.js-hide-when-nothing-matches-search`
→ `button.btn.btn-confirm.btn-md.gl-button[type=submit][name="commit"][value="Save changes"]` → `Save changes`

---

## 23. `/search` and `/search?search=foo&scope=projects`

### Routes & titles
| Path | `<title>` |
|---|---|
| `/search` | `Search · GitLab` |
| `/search?search=foo&scope=projects` | `foo · Search · GitLab` |
| `/search?search=accessibility&scope=issues` | `accessibility · Search · GitLab` |
| `/search?search=dotfiles&scope=projects` | (capture `assets/html/search-results.html`) |

Captures: `assets/html/search-blank.html` + `search-blank.png`; `assets/html/search-results.html` + `search-results.png` (term `dotfiles`, projects scope); `assets/html/search-issues.html` + `search-issues.png`; extra live: `/tmp/glwork/html/search-projects.html` (`foo`/projects), `/tmp/glwork/html/search-issues.html` (`accessibility`/issues).

**No left sidebar, no breadcrumb.** `#content-body` x=**336** w=**1248** (dashboard-style width).

### Common top form (`section.search-page-form`)
```
main#content-body
 └ div.flash-container…
 └ div.page-title-holder.gl-display-flex.gl-flex-wrap.gl-justify-content-space-between
    └ h1.page-title.gl-font-size-h-display.gl-mr-5  → "Search"
 └ div.gl-mt-3
    └ section.search-page-form.gl-lg-display-flex.gl-flex-direction-column
       └ div.gl-lg-display-flex.gl-flex-direction-row.gl-align-items-flex-end
          ├ div.gl-flex-grow-1…      (query input)
          ├ div.gl-mb-4.gl-lg-mb-0.gl-lg-mx-3   (Group filter)
          └ div.gl-mb-4.gl-lg-mb-0.gl-lg-ml-3   (Project filter)
       └ hr.gl-mt-5.gl-mb-0.gl-border-gray-100
```

| Control | Markup | Strings |
|---|---|---|
| Query label | bare `<label>` | `What are you searching for?` |
| Query input | `input#dashboard_search.gl-form-input.gl-search-box-by-click-input.form-control[type=search][name=search]` inside `div.input-group.gl-search-box-by-click#dashboard_search[name=search]` | placeholder **and** `aria-label` = `Search for projects, issues, etc.` |
| Clear button | `button.gl-clear-icon-button.gl-search-box-by-click-clear-button…[data-testid="filtered-search-clear-button"][name=clear]` — **only rendered when the input has a value** | `title`/`aria-label` = `Clear` |
| Search button | `div.input-group-append > button.gl-search-box-by-click-search-button.btn-default.btn-md.gl-button.btn-icon[data-testid="search-button"]` | `aria-label` = `Search`; magnifier icon only, **no visible “Search” text** |
| Group filter | `div.dropdown.b-dropdown.gl-dropdown.gl-w-full.btn-group[data-testid="group-filter"]`, toggle `span.dropdown-toggle-text.gl-flex-grow-1.gl-text-truncate` | label `Group`; toggle text `Any`; menu header `p.gl-dropdown-header-top` → `Filter results by group`; inner search `input[placeholder="Search"][aria-label="Search"]`; first item `Any` (in a bordered `li`). On this instance byteblaze's group list is **empty**, so the menu is just `Filter results by group` / `Any`. |
| Project filter | `div…[data-testid="project-filter"]` | label `Project`; toggle text `Any`; menu header `Filter results by project`; same inner search; first item `Any`, then one row per project rendered as *avatar-letter · project name · namespace name*, e.g. `D · dotfiles · Byte Blaze`, `T · timeit · Byte Blaze`, `cloud-to-butt · Byte Blaze`, `S · solarized-prism-theme · Byte Blaze`, `M · millennials-to-snake-people · Byte Blaze`, `A · a11y-syntax-highlighting · Byte Blaze`, `A · accessible-html-content-patterns · Byte Blaze`, `G · gimmiethat.space · Byte Blaze`, `E · empathy-prompts · Byte Blaze`, `E · ericwbailey.website · Byte Blaze`, `R · remove-board-movement-events-from-the-github-issue-timeline · Byte Blaze`, `D · design · Primer`, `A · a11y-webring.club · Byte Blaze`, `A · a11yproject.com · The A11Y Project` |

Blank `/search` layout (from `search-blank.png`): title `Search` at x≈336; the query group spans x≈336–1076; `Group` dropdown x≈1090 w≈235; `Project` dropdown x≈1345 w≈235; a horizontal rule under the row; **nothing else below it** (no scope strip, no results area — `div.results` is absent).

### Results page (`/search?search=…&scope=…`)
Below the `<hr>` appears `div.results.gl-md-display-flex.gl-mt-0` containing two columns:

| Column | Element | x | width |
|---|---|---|---|
| left | `section.search-sidebar.gl-display-flex.gl-flex-direction-column.gl-mr-4.gl-mb-6.gl-mt-5` | 336 | **240** |
| right | `div.gl-w-full.gl-flex-grow-1.gl-overflow-x-hidden` | 588 | **996** |

⚠️ **The scope selector is a vertical pill list in the LEFT sidebar, not a horizontal tab strip.**
`nav[data-testid="search-filter"] > ul.nav.nav-pills.flex-column`; each `li.nav-item.gl-mb-1` > `a.nav-link.gl-display-flex.gl-flex-direction-row.gl-flex-wrap-nowrap.gl-justify-content-space-between.gl-text-gray-900` (+ `active gl-font-weight-bold` on the current one), with the count in a trailing
`span.gl-font-sm.gl-font-weight-normal.gl-text-gray-500` (active scope uses `gl-text-gray-900`).

**Exactly FIVE scopes render at the global level, in this order:**

| Order | Label (verbatim) | href pattern | count for `foo` | count for `accessibility` | count for `dotfiles` |
|---|---|---|---|---|---|
| 1 | `Projects` | `/search?scope=projects&search=<q>` | `0` | `2` | `2` |
| 2 | `Issues` | `/search?scope=issues&search=<q>` | `99` | `99` | `19` |
| 3 | `Merge requests` | `/search?scope=merge_requests&search=<q>` | `99` | `99` | `5` |
| 4 | `Milestones` | `/search?scope=milestones&search=<q>` | `1` | `3` | `0` |
| 5 | `Users` | `/search?scope=users&search=<q>` | `0` | `0` | `0` |

⚠️ **`Comments` (`notes`), `Wiki` (`wiki_blobs`), `Code` (`blobs`), `Commits` (`commits`) and `snippet_titles` do NOT render at global scope.** Verified live: `/search?search=X&scope=notes|wiki_blobs|blobs|commits|snippet_titles` all return HTTP 200 but **silently fall back to the `projects` scope** (the tab strip still shows only the five above, `Projects` is active, and the empty state says “…any projects matching X”). Those scopes only exist under `/:ns/:proj/-/search` and `/groups/:g/-/search`.
⚠️ Counts are **capped at `99`** (GitLab's `limited_count`), so render `99` verbatim rather than a real total.

**Default scope:** `/search?search=foo` with no `scope` param behaves as `scope=projects` (the URL is left unchanged — no redirect — and `Projects` is `active`).

Clicking a scope pill is a **full navigation** to `/search?scope=<scope>&search=<q>` (note the param order: `scope` first, then `search`).

⚠️ **There is no `N results for "foo"` header anywhere in the DOM.** The only place the phrasing exists is the page metadata: `<meta name="description" content="projects results for term 'foo'">` (also `og:description` / `twitter:description`). Do not render a visible results-count header.

#### Left filter panel (per scope)
`section.search-sidebar` also contains a `<form class="gl-pt-5 gl-md-pt-0">` *only for the issues and merge-requests scopes*:

| scope | filter groups |
|---|---|
| `projects` | **none** — sidebar is just the 5 pills |
| `issues` | `h5.gl-mt-0` `Status` → radios `Any status`, `Open`, `Closed` (values `""`, `opened`, `closed`); `<hr>`; `h5.gl-mt-0` `Confidentiality` → radios `Any confidentiality`, `Confidential`, `Not confidential` (values `""`, `yes`, `no`); `<hr>`; `button.btn.btn-confirm.btn-md.disabled.gl-button[type=submit]` → `Apply` (disabled until a radio changes) |
| `merge_requests` | `Status` → `Any status`, `Open`, `Merged`, `Closed`; then `Apply` |
| `milestones` | **none** |
| `users` | **none** |

Radios are `div.gl-form-radio.custom-control.custom-radio > input.custom-control-input + label.custom-control-label` inside a `div.gl-form-checkbox-group.bv-no-focus-ring`, each group wrapped in `div.gl-px-5`.

#### Sort bar (issues & merge-requests scopes only)
`div.search-results-status > div.gl-display-flex.gl-flex-direction-column > div.gl-p-5.gl-display-flex` containing a `btn-group`:
- GlDropdown toggle text `Created date`; items `Created date`, `Updated date`, `Popularity`
- `button.btn.btn-default.btn-md.gl-button.btn-icon[title="Sort direction: Descending"][aria-label="Sort direction: Descending"]`
Then `hr.gl-mb-5.gl-mt-0.gl-border-gray-100.gl-w-full`.

#### Result-row anatomy — `scope=projects`
The projects scope **reuses the dashboard projects list**:
```
div.search-results
 └ div.term
    └ div.js-projects-list-holder[data-qa-selector="projects_list"]     ← (ANCHOR-shaped selector, cf. webarena-522)
       └ ul.projects-list.gl-text-secondary.gl-w-full.gl-my-2
          └ li.project-row
             ├ div.project-cell.gl-w-11
             │   └ a.project[href="/byteblaze/a11y-webring.club"] > div.gl-avatar.gl-avatar-s48.gl-avatar-identicon.gl-avatar-identicon-bg5  ("A")
             ├ div.project-cell
             │   └ div.project-details.gl-pr-9…[data-qa-project-name="a11y-webring.club"][data-qa-selector="project_content"]
             │      ├ h2.gl-font-base.gl-line-height-20.gl-my-0
             │      │   └ a.text-plain.gl-mr-3.js-prefetch-document[href="/byteblaze/a11y-webring.club"]
             │      │        span.namespace-name.gl-font-weight-normal → "Byte Blaze / "
             │      │        span.project-name                        → "a11y-webring.club"
             │      ├ span.gl-mr-3.has-tooltip[title="Public - The project can be accessed without any authentication."] > svg[data-testid="earth-icon"]
             │      ├ span.user-access-role.gl-display-block.gl-m-0[data-qa-selector="user_role_content"] → "Owner"
             │      └ div.description.gl-display-none.gl-sm-display-block… → the project description markdown
             └ div.project-cell.gl-xs-display-none!
                 └ div.project-controls…[data-testid="project_controls"]
                    ├ div.controls  → stars / forks / MRs / issues counters
                    │    a.icon-wrapper.has-tooltip.stars[title="Stars"][href="…/-/starrers"]  svg[data-testid="star-o-icon"] + count
                    │    a.icon-wrapper.has-tooltip.forks[title="Forks"][href="…/-/forks"]     svg[data-testid="fork-icon"] + count
                    └ div.updated-note.gl-ml-3 > span → "Updated " + <time class="js-timeago" title="Mar 27, 2023 4:22pm PDT" datetime="2023-03-27T23:22:59Z">3 years ago</time>
```
Visible row copy from `search-results.png` (`dotfiles`): `Byte Blaze / dotfiles` 🌐 `Owner` … `☆ 0  ⑂ 0  ⑃ 0  ▯ 0` … `Updated 3 years ago`; second row `robert1003 / dotfiles` 🌐 … `Updated 3 years ago`.
The namespace part is normal weight, the project name is **bold**.

#### Result-row anatomy — `scope=issues`
```
div.search-results
 └ div.search-result-row.gl-display-flex.gl-sm-flex-direction-row.gl-flex-direction-column.gl-align-items-center.gl-pb-3!.gl-mt-5.gl-mb-0!
    ├ div.col-sm-9
    │   ├ span.gl-display-flex.gl-align-items-center
    │   │    span.gl-badge.badge.badge-pill.badge-success.sm   → "Open"     (badge-info + "Closed" for closed)
    │   │    a.gl-w-full[data-track-action="click_text"][data-track-label="issue_title"][data-track-property="search_result"][href="/keycloak/keycloak/-/issues/19185"]
    │   │        span.term.str-truncated.gl-font-weight-bold.gl-ml-2 → the issue title
    │   ├ div.gl-text-gray-500.gl-my-3
    │   │    "Keycloak / keycloak #19185" · "·" · "created " ·
    │   │    <time class="js-timeago" title="Mar 20, 2023 9:46am PDT" datetime="2023-03-20T16:46:22Z" data-toggle="tooltip" data-placement="bottom" data-container="body">3 years ago</time>
    │   │    " by " a.author-link.js-user-link[href="/root"] > span.author → "Administrator"
    │   └ div.description.term.gl-px-0 → truncated description; matched terms are wrapped in
    │        span.gl-text-gray-900.gl-font-weight-bold
    └ div.col-sm-3.gl-mt-3.gl-sm-mt-0.gl-text-right
        span.gl-text-gray-500 → "updated " + <time class="js-timeago" title="Mar 20, 2023 9:47am PDT" datetime="2023-03-20T16:47:54Z">3 years ago</time>
```
Reference row (verbatim): `Open` · `Upgrade 21.0.1 from 20.0.5 - throws certificate error` · `Keycloak / keycloak #19185` `·` `created` `3 years ago` `by` `Administrator` · `updated` `3 years ago`.
A closed one: `Closed` · `Inaccessibility : The titles of the posts' highlight are custom links which do not receive keyboard focus.` · `The A11Y Project / a11yproject.com #1532`.

#### Result-row anatomy — `scope=merge_requests`
Identical to issues, except the reference is `!445` instead of `#19185`, `data-track-label="mergerequest_title"`, and the badge can be `Merged` (`badge-info`), e.g.
`Merged` · `Update ActionMenu docs` · `Primer / design !445` `·` `created` `3 years ago` `by` `Katie Langerman` · `updated` `3 years ago`.
Author link carries `data-user-id`, `data-username`, `data-name`.

#### Result-row anatomy — `scope=milestones`
`<h4><a data-track-action="click_text" data-track-label="milestone_title" data-track-property="search_result" href="/a11yproject/a11yproject.com/-/milestones/5"><span class="term str-truncated">Living Styleguide</span></a></h4>` followed by `div.description.term > p` with the truncated milestone description.

#### Result-row anatomy — `scope=users`
```
div.search-results > ul.content-list > li
   div.avatar-cell > a[href="/byteblaze"] > img.avatar.s40.has-tooltip[alt="Byte Blaze's avatar"][title="Byte Blaze"]
   div.user-info > a[href="/byteblaze"]
        div.item-title → "Byte Blaze"
        div.cgray      → "@byteblaze"
```

### Relative-time format on this page
All timestamps use `<time class="js-timeago" data-toggle="tooltip" data-placement="bottom" data-container="body">` with
- text = `3 years ago` (relative, because `Use relative times` is on),
- `title` = **`Mar 20, 2023 9:46am PDT`** (note: local `PDT`/`PST` on search rows; project rows use `Mar 27, 2023 4:22pm PDT`, `data-placement="top"`),
- `datetime` = ISO-8601 UTC, e.g. `2023-03-20T16:46:22Z`.

### Empty state
```html
<div class="search_box gl-my-8 gl-text-center">
  <div class="search_glyph"></div>
  <h4>
    <svg class="s24 gl-vertical-align-text-bottom" data-testid="search-icon">…</svg>
    We couldn't find any projects matching <code>zzzqqq</code>
  </h4>
</div>
```
The noun tracks the scope (verified verbatim for each):
| scope | copy |
|---|---|
| `projects` | `We couldn't find any projects matching foo` |
| `issues` | `We couldn't find any issues matching zzzqqq` |
| `merge_requests` | `We couldn't find any merge requests matching zzzqqq` |
| `milestones` | `We couldn't find any milestones matching zzzqqq` |
| `users` | `We couldn't find any users matching zzzqqq` |

The search term is wrapped in `<code>`; the apostrophe in `couldn't` is a plain ASCII `'`. The empty state replaces the whole right column (the left pill list still renders, with `0` counts).

### Pagination
`div.gl-pagination.gl-mt-3 > ul.pagination.justify-content-center` — a **prev/next-only** pager (no numbered pages):
```html
<li class="page-item next">
  <a rel="next" class="page-link" href="/search?page=2&amp;scope=issues&amp;search=accessibility">Next <svg data-testid="chevron-lg-right-icon">…</svg></a>
</li>
```
On page 2+ there is also `<li class="page-item prev"><a rel="prev" class="page-link" href="/search?page=1&amp;scope=…&amp;search=…">… Prev</a></li>`.
Param order in the generated href: `page`, then `scope`, then `search`. When there is nothing to paginate the `ul.pagination` is rendered **empty** (e.g. the users scope) rather than omitted.

### Component inventory (section 23)
| Component | Selector | URL effect |
|---|---|---|
| Query input + magnifier | `#dashboard_search`, `[data-testid="search-button"]` | submits → `/search?search=<q>&…` |
| Clear button | `[data-testid="filtered-search-clear-button"]` | clears input only |
| Group dropdown | `[data-testid="group-filter"]` | adds `&group_id=<id>` |
| Project dropdown | `[data-testid="project-filter"]` | adds `&project_id=<id>` |
| Scope pills | `[data-testid="search-filter"] a.nav-link` | `/search?scope=<s>&search=<q>` |
| Status / Confidentiality radios + `Apply` | `.search-sidebar form` | `&state=opened|closed` (+ `&confidential=yes|no`) |
| Sort dropdown + direction toggle | `.search-results-status .btn-group` | `&sort=created_desc|updated_desc|popularity` |
| Pager | `.gl-pagination .page-link` | `&page=N` |

---

## 24. Coverage, gaps, and traps

### 24.1 View coverage

All 23 required views are specified above. Nothing was skipped.

| # | View | Section | Observed live? |
|---|---|---|---|
| 1 | Global chrome (navbar + left sidebar) | §1, §1b, §1c, §1d | yes |
| 2 | `/` and `/dashboard/projects` | §2 | yes |
| 3 | `/dashboard/projects/starred` | §3 | yes |
| 4 | `/dashboard/{groups,todos,activity,milestones,snippets}` | §4a–§4e | yes (activity feed is empty — see below) |
| 5 | `/dashboard/issues`, `/dashboard/merge_requests` | §5a, §5b | yes |
| 6 | `/explore`, `/explore/projects/{trending,starred}`, `/explore/groups` | §6a–§6d | yes (trending + snippets are empty) |
| 7 | `/byteblaze` profile | §7 | header/tabs yes; `.cover-status` + website link **reconstructed from source** |
| 8 | `/users/byteblaze/{following,followers,starred,groups,activity}` | §8a–§8d | yes (groups + activity are empty for byteblaze) |
| 9 | Project overview | §9 | yes |
| 10 | Tree + blob | §10a, §10b | yes |
| 11 | `/-/commits/:ref` | §11 | yes |
| 12 | `/-/branches`, `/-/tags`, `/-/graphs/:ref`, `/-/network/:ref` | §12a–§12e | yes |
| 13 | `/-/issues` list | §13, §13b | yes |
| 14 | Issue detail + right sidebar | §14, §14b | yes |
| 15 | `/-/merge_requests` list + MR detail | §15a–§15d | yes |
| 16 | `/-/labels`, `/-/milestones`, milestone detail | §16a, §16b | yes (milestone detail observed on `a11yproject.com/-/milestones/3`) |
| 17 | `/-/project_members` | §17 | yes |
| 18 | `/groups/:group`, `/groups/:group/-/group_members` | §18a, §18b | overview yes (`robert1003`); a **populated owned** members page **reconstructed from source** |
| 19 | `/projects/new`, `/groups/new` | §19a, §19b | yes |
| 20 | `/-/issues/new` | §20 | yes |
| 21 | `/:ns/:proj/edit` | §21 | yes |
| 22 | `/-/profile`, `/-/profile/preferences` | §22a, §22b | yes |
| 23 | `/search` + results | §23 | yes |

### 24.2 What is empty in this snapshot (and therefore unobservable)

These are **not** bugs in the recon — the seed genuinely has no data for them. Where the
DOM is documented above it was reconstructed from the GitLab 15.7.5 Haml/Ruby/webpack
sources inside the container, and is flagged as such at the point of use.

- **All activity feeds are empty.** `events` has no rows, so `/dashboard/activity`,
  `/users/byteblaze/activity`, `/:ns/:proj/activity` and the profile Overview activity
  column all render `No activities found`.
- **byteblaze belongs to no groups**, has **no user status**, and has an **empty
  `website_url`** — so `.cover-status` and `.profile-header [itemprop="url"]` are absent
  from the live DOM. Both are ANCHOR targets; the tasks *set* them.
- **Only one group exists instance-wide** (`robert1003`, plus the internal
  `gitlab-instance-…` namespace). Every other project-owning namespace — `primer`,
  `a11yproject`, `keycloak`, `root`, `vinta`, `auth0`, `koush` — is a **user**, not a group.
- **No fork lists**: every project reports 0 forks.
- **No due date is set on any issue**, no issue has upvotes/downvotes, and no MR carries
  a milestone.
- `/explore/projects/trending` and `/explore/snippets` and `/dashboard/snippets` are empty.

### 24.3 The big trap: most anchors are post-conditions, not seed state

A large share of `assets/task_anchors.md` describes the state *after* the agent completes
the task, not what is on the site today. Concretely:

- **All 15 project routes in webarena-742…756** (`/byteblaze/planner`,
  `/byteblaze/web_arena`, `/byteblaze/AGISite`, `/byteblaze/agi_index`,
  `/byteblaze/web_agent*`, `/byteblaze/project_site`, …) currently **404**. They are
  created by `/projects/new`. Same for `nolan_*`, `Awesome_DIY_ideas`, `TODO`,
  `Do it myself`, `fun_thing_to_do`, `live_a_life`.
- **All five group routes in webarena-799…803** (`coding_friends`, `crew`, `n-lab`,
  `x-lab`, `webagent`) **404**. They are created via `/groups/new`, then members are
  invited.
- `/byteblaze/dotfiles/-/blob/main/LICENSE` **302s to `/-/tree/main`** today, because
  dotfiles has no LICENSE. The file is added by the task.
- webarena-666/667/668/806 read `.block.reviewer` and the branch chips on an MR that
  does not exist yet — the branch names are real, the MR is not.
- webarena-590…594 read `.block.start_date` / `.block.due_date` / `#content-body` on a
  milestone that does not exist yet.
- webarena-658…660/808 read `.block.assignee`, `[data-qa-selector="title_content"]` and
  `[data-testid="sidebar-due-date"]` on an issue whose assignee and due date the agent sets.
- webarena-390…393 read the **last** child of `#notes-list` — a comment the agent posts.
- webarena-418…422 / 448…452 read the profile status and website the agent edits.

**Therefore the mock cannot be a static render.** Creation and edit flows for projects,
groups, group/project members, issues, merge requests, milestones, labels, comments,
issue assignee/due-date/labels/milestone, MR reviewers, file creation, and the profile
form must all mutate local state and be reflected on the corresponding anchor route
immediately afterwards.

### 24.4 Corrections to commonly-assumed GitLab strings

Recorded here because they were wrong in the initial recon brief and are easy to
get wrong again:

| Assumed | Actually in 15.7.5 |
|---|---|
| `.gl-new-dropdown` | does not exist — use `.gl-dropdown` (§1d) |
| `.breadcrumbs-sub-title` | does not exist (§1d) |
| Dashboard project tabs `Your projects` / `Starred projects` / `Explore projects` | `Yours` / `Starred` / `Explore` / `Topics` (§2) |
| Issue rows say `opened N ago by X` | `created N years ago by X` (§13) |
| Issue empty state `There are no open issues` | `Use issues to collaborate on ideas, solve problems, and plan work` (§13) |
| `.block.due_date` on issues | issues use `[data-testid="sidebar-due-date"]` on a bare `.block`; `.block.due_date` is milestone-only (§14b, §16b) |
| `.block.lock-issue` | `block issuable-sidebar-item lock` (§14b) |
| `#issuable-time-tracker` | `.block.time-tracking` (§14b) |
| MR `.detail-page-description` is the description body | it is the **`… requested to merge <src> into <tgt> …`** banner (§15b) |
| `Modify merge commit` | `Edit commit message` (§15d) |
| `The source branch has been deleted` | `Deleted the source branch.` (§15d) |
| MR sort `Merged date` → `merged_at_desc` | `?sort=merged_at` (§15a) |
| `/projects/new` has 4 cards incl. `Run CI/CD for external repository` | **3** cards (§19a) |
| Blank-project form has `Project description (optional)` | it does not (§19a) |
| `/-/issues/new` | the route is `/:ns/:proj/-/issues/new` (§20) |
| Members columns `Account, Source, Access granted, Expiration, Max role` | `Account, Source, Access granted, Max role, Expiration, Created on, Last activity` (§17) |
| Labels headings `Prioritized labels` / `Other labels` | `Prioritized Labels` / `Other Labels` (§16a) |
| Milestone range `Jan 16, 2030 – Jan 30, 2030` | `Jan 16, 2030–Jan 30, 2030` (EN DASH, **no spaces**) (§16b) |
| Commit date headers `Mar 27, 2023` | `19 Mar, 2023` (`%d %b, %Y`) (§11) |
| Profile `Member since Mar 23, 2023` | `Member since March 23, 2023` (full month) (§7) |
| Contribution calendar `N contributions in the last year` + `Less…More` | neither exists; caption is `Issues, merge requests, pushes, and comments.` (§7) |
| Search scopes render as a tab strip | a 240px **vertical pill list** in a left sidebar; only 5 scopes exist (§23) |
| Network page `Show whole repository graph` | `Begin with the selected commit` (§12d) |
| Contributors caption one line | `<h4>Commits to main</h4>` + `Excluding merge commits. Limited to 6,000 commits.` (§12c) |

### 24.5 Host-dependent values

The clone URLs on this instance resolve to `10.186.197.203`, not `localhost`:

- SSH: `ssh://git@10.186.197.203:2222/<ns>/<proj>.git`
- HTTP: `http://10.186.197.203:8023/<ns>/<proj>.git`

WebArena's evaluator substitutes `__GITLAB__` / `__GITLAB_SSH__` for these, so the mock
should render whatever host it is actually served from rather than hard-coding either.
