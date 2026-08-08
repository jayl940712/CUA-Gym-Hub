# DEV — round 8 · responsive layout (BUG-701, BUG-702) + 1280px sibling sweep

Written incrementally. Status markers: `[~]` in progress, `[x]` done, `[!]` blocked.

---

## 1 · Root cause — both bugs, one class

`TEST.md §7` called it: *"the layout reserves space for fixed sidebars using a rule
that only holds at wide viewports"*. Both bugs are that, but with **different**
proximate causes.

### BUG-701 — `/-/profile*` never enters the contextual-sidebar shell at all

`src/components/layout/routeContext.js:27-28`

```js
const { head, infix, rest } = splitPath(pathname)
if (head.length === 0) return { ...empty, section: 'projects' }
```

`splitPath('/-/profile/keys')` → `{ head: [], infix: true, rest: ['profile','keys'] }`.
So **every** `/-/profile*` URL falls into that `head.length === 0` early return and
resolves to `kind: 'dashboard'`. `Layout.jsx:146` therefore computes
`hasSidebar === false`, so:

- `.layout-page` never gets `page-with-contextual-sidebar`
- `.content-wrapper` never gets the left offset (`global.css:48`)
- `containerClass` is `container-fluid container-limited` → **1280px**, not the
  source's 990px `limit-container-width`

Meanwhile `src/components/people/ProfileLayout.jsx:35` renders its own
`<aside className="nav-sidebar" style={{width:220}}>` *inside* `#content-body`,
intending it as an in-flow flex child — but `global.css:154` makes **every**
`.nav-sidebar` `position: fixed; left: 0; z-index: 600`. The aside leaves flow,
pins to the viewport's left edge, and the flex sibling expands to full width
underneath it.

Arithmetic that explains the measured threshold exactly (container 1280 max,
centred in a full-width wrapper, 16px padding):

| viewport | `#content-body` x | nav occupies | overlap |
|---|---|---|---|
| 1920 | (1920−1280)/2 + 16 = **336** | 0–220 | none |
| 1600 | (1600−1280)/2 + 16 = **176** | 0–220 | **44px** |
| 1280 | 0 + 16 = **16** | 0–220 | **204px** |

Matches `TEST.md` BUG-701's `x = 176 (1600) / x = 16 (1280)` measurement.

**What the source does** — `assets/html/profile-preferences.html`, verbatim:

```
<div class="layout-page hide-when-top-nav-responsive-open page-with-contextual-sidebar">
  <aside aria-label="User settings" class="nav-sidebar">…</aside>
  <div class="content-wrapper content-wrapper-margin">
    …<nav class="breadcrumbs container-fluid container-limited limit-container-width">
    <div class="container-fluid container-limited limit-container-width">
      <main class="content" id="content-body">
```

i.e. the settings pages use the **standard shell** with a real 256px fixed
sidebar and a 990px container. Fix = make the mock do the same, not patch CSS
around a mis-nested aside.

### BUG-702 — issuable `.content-wrapper` never reserves the right sidebar

`IssueDetail.jsx:273` / `MergeRequestDetail.jsx:349` render
`<aside class="right-sidebar … right-sidebar-expanded">`, which `global.css:508`
makes `position: fixed; right: 0; width: 290px`. Nothing anywhere adds the
compensating padding, and `.layout-page` never gets the source's
`page-gutter right-sidebar-expanded` classes.

### The source's authoritative rules

Pulled read-only from the container's own stylesheet
(`GET /assets/application-1e8c169a…css`, saved to `/tmp/gl_app.css`) — these are
the four rules that matter, verbatim:

```css
.page-with-contextual-sidebar{transition:padding-left 0.2s}
@media (min-width: 768px){.page-with-contextual-sidebar{padding-left:56px}}
@media (min-width:1200px){.page-with-contextual-sidebar{padding-left:256px}}
@media (min-width: 768px){.page-with-icon-sidebar{padding-left:56px}}

.content-wrapper{width:100%}
@media (min-width:576px){.right-sidebar-collapsed:not(.is-merge-request):not(.wiki-sidebar):not(.build-sidebar):not(.issuable-bulk-update-sidebar) .content-wrapper{padding-right:62px}}
@media (min-width:576px) and (max-width:767.98px){.right-sidebar-expanded:not(.wiki-sidebar):not(.build-sidebar):not(.issuable-bulk-update-sidebar) .content-wrapper{padding-right:62px}}
@media (min-width:768px){.right-sidebar-expanded:not(.is-merge-request) .content-wrapper{padding-right:290px}}
```

So the source's responsive behaviour is: **it does not reflow or collapse
anything between 1200 and 1920** — the reserve is a flat 256px left / 290px right
at every width ≥ 1200. (`body{min-width:992px !important}` hard-floors the
desktop layout; below 1200 the sidebar reserve drops to 56px and GitLab's JS
swaps `page-with-contextual-sidebar` → `page-with-icon-sidebar`.) The mock only
needs the ≥768 and ≥1200 rules to be correct at 1280 / 1600 / 1920, and the flat
reserve is exactly why the source shows **zero** overlap at all three widths
while the mock's centred-container trick only happens to work at 1920.

---

## 2 · Fixes

- [x] **BUG-701** — `/-/profile*` into the standard contextual-sidebar shell
- [x] **BUG-702** — `page-gutter right-sidebar-expanded` + the source's padding rules
- [x] Three-width geometry, mock vs source (§3)
- [x] Control hit-tests + real clicks at three widths (§4)
- [x] webarena-418 / webarena-448 end to end at 1280×720 (§5)
- [x] 1280px sibling sweep — 82 routes (§6)
- [x] No regression: anchor routes, state size, built bundle (§7)

### Files changed

| File | Change |
|---|---|
| `src/styles/tokens.css` | `--right-sidebar-width-collapsed: 62px` (`CSS app.css:5290`) |
| `src/styles/global.css` | left/right gutter rules replaced with the source's own, on `.layout-page` as padding; `div.context-header` rules for the settings sidebar |
| `src/components/layout/routeContext.js` | `/-/profile*` → `kind: 'profile'`, `limited: true` |
| `src/components/layout/UserSettingsSidebar.jsx` | **new** — the source's `aside[aria-label="User settings"]`, a sibling of `.content-wrapper` |
| `src/components/layout/Layout.jsx` | renders that sidebar; builds `.layout-page`'s class list incl. `page-gutter right-sidebar-expanded` and the icon-sidebar swap; `usePageChrome` merges instead of replaces |
| `src/components/layout/Breadcrumbs.jsx` | `User Settings › <page>` trail for `kind: 'profile'` |
| `src/components/layout/Icon.jsx` | 10 sidebar icons, paths lifted from the container's sprite |
| `src/components/people/ProfileLayout.jsx` | no longer renders the aside; registers the breadcrumb leaf |
| `src/pages/IssueDetail.jsx`, `src/pages/MergeRequestDetail.jsx` | `rightSidebar: true` |

Two supporting changes worth calling out because they are behavioural, not cosmetic:

- **`usePageChrome` now merges the keys the caller passed** instead of replacing
  the whole chrome object. React fires the deeper component's effect first, so
  with replace semantics a profile page's own `usePageChrome({title})` clobbered
  the `breadcrumbExtra` that `ProfileLayout` had just set one level down, and the
  `User Settings › Preferences` leaf silently vanished. Cleanup clears exactly
  the keys each call owned.
- **Collapsing the left nav now swaps `page-with-contextual-sidebar` →
  `page-with-icon-sidebar`** on `.layout-page`, which is what GitLab's own
  sidebar JS does. Before, `ProjectSidebar` narrowed the rail to 56px but the
  content column kept its 256px reserve, leaving a 200px dead strip. Found while
  reading the gutter rules; see §6.

---

## 3 · Geometry — mock vs source, three widths

Measured in chromium against the **live container** (plain `GET`, no login, no
mutation, no `?sort=`) and the mock dev server on 5271, same browser, same
context, same run. `content` is `#content-body`, `rsb` is
`aside.right-sidebar`, `nav` is `aside.nav-sidebar`. Script: `/tmp/r8_geom.py`.

```
===== 1920 px =====
  issue detail  SOURCE  content  464–1422 | nav 0–256 | rsb 1630–1920 | gap 208 | hscroll 0
  issue detail  MOCK    content  464–1422 | nav 0–256 | rsb 1630–1920 | gap 208 | hscroll 0
  MR detail     SOURCE  content  464–1422 | nav 0–256 | rsb 1630–1920 | gap 208 | hscroll 0
  MR detail     MOCK    content  464–1422 | nav 0–256 | rsb 1630–1920 | gap 208 | hscroll 0
  issues list   SOURCE  content  464–1712 | nav 0–256 |                          hscroll 0
  issues list   MOCK    content  464–1712 | nav 0–256 |                          hscroll 0
  project ovw   SOURCE  content  609–1567 | nav 0–256 |                          hscroll 0
  project ovw   MOCK    content  609–1567 | nav 0–256 |                          hscroll 0
  profile edit  MOCK    content  609–1567 | nav 0–256 |                          hscroll 0
  profile keys  MOCK    content  609–1567 | nav 0–256 |                          hscroll 0

===== 1600 px =====
  issue detail  SOURCE  content  304–1262 | nav 0–256 | rsb 1310–1600 | gap  48 | hscroll 0
  issue detail  MOCK    content  304–1262 | nav 0–256 | rsb 1310–1600 | gap  48 | hscroll 0
  MR detail     SOURCE  content  304–1262 | nav 0–256 | rsb 1310–1600 | gap  48 | hscroll 0
  MR detail     MOCK    content  304–1262 | nav 0–256 | rsb 1310–1600 | gap  48 | hscroll 0
  issues list   SOURCE  content  304–1552 | nav 0–256 |                          hscroll 0
  issues list   MOCK    content  304–1552 | nav 0–256 |                          hscroll 0
  project ovw   SOURCE  content  449–1407 | nav 0–256 |                          hscroll 0
  project ovw   MOCK    content  449–1407 | nav 0–256 |                          hscroll 0
  profile edit  MOCK    content  449–1407 | nav 0–256 |                          hscroll 0
  profile keys  MOCK    content  449–1407 | nav 0–256 |                          hscroll 0

===== 1280 px =====
  issue detail  SOURCE  content  272– 974 | nav 0–256 | rsb  990–1280 | gap  16 | hscroll 0
  issue detail  MOCK    content  272– 974 | nav 0–256 | rsb  990–1280 | gap  16 | hscroll 0
  MR detail     SOURCE  content  272– 974 | nav 0–256 | rsb  990–1280 | gap  16 | hscroll 0
  MR detail     MOCK    content  272– 974 | nav 0–256 | rsb  990–1280 | gap  16 | hscroll 0
  issues list   SOURCE  content  272–1264 | nav 0–256 |                          hscroll 0
  issues list   MOCK    content  272–1264 | nav 0–256 |                          hscroll 0
  project ovw   SOURCE  content  289–1247 | nav 0–256 |                          hscroll 0
  project ovw   MOCK    content  289–1247 | nav 0–256 |                          hscroll 0
  profile edit  MOCK    content  289–1247 | nav 0–256 |                          hscroll 0
  profile keys  MOCK    content  289–1247 | nav 0–256 |                          hscroll 0
```

**Mock and source now agree to the pixel on all four comparable page types at all
three widths**, and `hscroll` (`scrollWidth − clientWidth`) is 0 everywhere — no
horizontal overflow. Compare against `TEST.md` BUG-702's table: the mock's issue
detail went from `609–1567 / OVERLAP 63px-clear` at 1920 and `289–1247 /
OVERLAP 257px` at 1280 to source-identical numbers.

`/-/profile*` has no `SOURCE` row because driving the source's settings pages
needs a login POST, which the read-only rule forbids. It is checkable another
way: the source's settings pages use `container-fluid container-limited
limit-container-width` inside `page-with-contextual-sidebar`
(`assets/html/profile-preferences.html`), which is the *same* container class as
a project overview — and the mock's `profile edit` row is byte-identical to the
`project ovw` SOURCE row at every width. The geometry is right by construction.

The one thing the numbers say that is worth stating plainly: **the source does
not reflow between 1280 and 1920.** The gutters are a flat 256/290 at every
width; only the centred container's max-width changes what that leaves. Nothing
collapses, nothing scrolls. The mock does the same now.

---

## 4 · Every control TEST.md named — hit-tested and really clicked

`/tmp/r8_accept.py`, three widths, cold load per page, fresh `?sid=` per width.
`hit` is an `elementFromPoint` test at the control's centre (does the topmost
element belong to the control?); `click` is a real Playwright
`locator.click(trial=True)`, which runs the full actionability check including
pointer-event interception and names the intercepting element on failure.

| control | route | 1920 | 1600 | 1280 |
|---|---|---|---|---|
| `Update profile settings` | `/-/profile` | HIT / ok | HIT / ok | **HIT / ok** |
| status 🙂 emoji picker | `/-/profile` | HIT / ok | HIT / ok | **HIT / ok** |
| `Remove status` | `/-/profile` | HIT / ok | HIT / ok | **HIT / ok** |
| status message field | `/-/profile` | HIT / ok | HIT / ok | **HIT / ok** |
| `Website url` field | `/-/profile` | HIT / ok | HIT / ok | **HIT / ok** |
| `Add key` | `/-/profile/keys` | HIT / ok | HIT / ok | **HIT / ok** |
| `Add email address` | `/-/profile/emails` | HIT / ok | HIT / ok | **HIT / ok** |
| `Create personal access token` | `/-/profile/personal_access_tokens` | HIT / ok | HIT / ok | **HIT / ok** |
| `Save changes` | `/-/profile/preferences` | HIT / ok | HIT / ok | **HIT / ok** |
| `Close issue` / `Reopen issue` | issue 719 | HIT / ok | HIT / ok | **HIT / ok** |
| `Issue actions` (⋮) | issue 719 | HIT / ok | HIT / ok | **HIT / ok** |
| `Edit title and description` | issue 719 | HIT / ok | HIT / ok | **HIT / ok** |
| Activity `Sort or filter` | issue 719 | HIT / ok | HIT / ok | **HIT / ok** |
| MR `Code` dropdown | MR 1531 | HIT / ok | HIT / ok | **HIT / ok** |

**14 controls × 3 widths = 42 checks, 0 failures, 0 console errors, 0
pageerrors** on the mock at every width. Against `TEST.md` §7's threshold table,
every cell that read BLOCKED now reads ok.

---

## 5 · Acceptance test for BUG-701 — webarena-418 and webarena-448 at 1280×720

`/tmp/r8_tasks.py`. Drives the real flow: load `/-/profile` at 1280×720, fill
`Website url` with `egg.tart.com`, open and close the emoji picker, type
`Cruising` into the status message, click `Update profile settings`, navigate to
`/byteblaze`, **reload**, then read the two anchor locators.

```
===== task replay at 1280x720 =====
  anchor 5  .cover-status                      n=1 text='💬Cruising'
  anchor 8  .profile-header [itemprop="url"]   n=1 text='egg.tart.com'
  console/page errors: none

===== task replay at 1920x1080 =====
  anchor 5  .cover-status                      n=1 text='💬Cruising'
  anchor 8  .profile-header [itemprop="url"]   n=1 text='egg.tart.com'
  console/page errors: none

RESULT: PASS
```

Both anchors resolve with the expected values **at 1280**, which is what
`TEST.md` set as the acceptance condition (they were `ABSENT` there before, and
only appeared at 1920). Tasks webarena-418…422 and 448…452 are unblocked.

Screenshots at 1280×720, for the record:
`assets/screenshots/r8_mock_profile_1280.png` (compare against
`r7_mock_profile_1280_OVERLAP.png` — the form labels are no longer behind the
nav), `r8_mock_profile_keys_1280.png`, `r8_mock_issue719_1280.png`,
`r8_mock_mr1531_1280.png`. On the issue capture the body wraps and completes
inside the 272–974 column instead of running under the sidebar, and `Reopen
issue`, the ⋮ actions button, the pencil and `Sort or filter` are all clear of
it.

*(One rendering artifact, not a defect: emoji render as tofu boxes in these
captures — this host has no emoji font. The characters are in the DOM; the
anchor read above returns `💬Cruising` correctly.)*

---

## 6 · Sibling sweep at 1280×720 — 82 routes

`/tmp/r8_sweep.py`. Cold load per route, fresh `?sid=`. For each route it
reports (a) horizontal overflow `scrollWidth − clientWidth`, (b) every visible,
enabled interactive element (`a[href]`, `button`, `input`, `select`, `textarea`,
`[role=button]`, `[role=tab]`, `summary`) whose centre fails an
`elementFromPoint` ownership test, and (c) every fixed/absolute element outside
`#content-body` that geometrically overlaps it. Routes covered: all 10 dashboard
+ 7 explore + search, all 13 `/-/profile*`, user profile + starred + activity,
6 group routes, 27 project routes across repo/issues/MR/settings/CI/analytics,
3 issue and 3 MR detail routes, and the 3 creation forms.

**Results: 0 horizontal overflow, 0 content overlays, 0 console errors, 0
pageerrors on all 82 routes.** One recurring blocked-control class, below.

### FINDING-703 · P2 · `.toggle-sidebar-button` covers whichever project-sidebar item sits in the bottom 48px

- **Where:** `src/styles/global.css` `.toggle-sidebar-button` (the rule is the
  source's own: `position:fixed;bottom:0;width:255px;height:48px`), against
  `ProjectSidebar.jsx` / `GroupSidebar.jsx`'s scrolling item list.
- **What:** on 29 of the 82 routes, exactly two project-sidebar items — whichever
  pair happens to sit at the bottom of the rail at the current scroll offset
  (`Wiki`/`Snippets` on issue-ish pages, `Infrastructure`/`Monitor` on repo
  pages, `Settings` on others) — fail the hit test, intercepted by the fixed
  `Collapse sidebar` footer.
- **Severity, honestly assessed.** I scanned every scroll offset of the rail in
  80px steps: **`neverReachable` is empty — every item is clickable at some
  scroll position.** A real `locator.click()` (which auto-scrolls) succeeded on
  5 of the 6 items I tried; it failed on `Infrastructure` on the tree page only
  because Playwright considered it already in view and therefore did not scroll.
  So this costs an agent a scroll, it does not make anything unreachable. That is
  categorically weaker than BUG-701, hence P2.
- **Why the source does not show it:** the container's rail is shorter than the
  mock's — `scrollHeight` 699 vs 893 on `/byteblaze/dotfiles/-/tree/main` at
  720px tall — so nothing lands under the footer. **But that comparison is not
  usable as evidence**: the source can only be driven logged out (the read-only
  rule forbids the sign-in POST), and the anonymous rail is missing
  `Security & Compliance`, `Infrastructure` and `Settings`. I checked those
  against the logged-in capture `assets/html/proj-dotfiles-activity.html` and
  both `Security &amp; Compliance` and `Infrastructure` are present there, so the
  mock's item set is right and the height difference is an artifact of being
  logged out. **I have no measurement of the logged-in source's rail height, so I
  cannot say whether the source has this same behaviour or not.** Recorded rather
  than "fixed", because inventing a rule the source does not have is exactly what
  the brief said not to do.
- **Fix, if a later round wants it:** the mock already carries
  `.nav-sidebar-inner-scroll { padding-bottom: 60px }`, which the source does
  *not* have — it makes the *last* item clear the footer. Extending that idea
  (sticky footer in flow, or reserving the footer height inside the scroll
  container rather than only after the last item) would close it. One rule in
  `global.css`; no component change.

### Checked and clean

- **Left-nav collapse now reflows the content column** (this round's fix,
  verified against the source at both widths):

  ```
  1280  SOURCE expanded  nav 0–256  wrap x=256  body x=289   cls "…page-with-contextual-sidebar"
  1280  MOCK   expanded  nav 0–256  wrap x=256  body x=289   cls "…page-with-contextual-sidebar"
  1280  SOURCE collapsed nav 0– 56  wrap x= 56  body x=189   cls "…page-with-contextual-sidebar page-with-icon-sidebar"
  1280  MOCK   collapsed nav 0– 56  wrap x= 56  body x=189   cls "…page-with-contextual-sidebar page-with-icon-sidebar"
  1920  SOURCE collapsed nav 0– 56  wrap x= 56  body x=509   (same class pair)
  1920  MOCK   collapsed nav 0– 56  wrap x= 56  body x=509   (same class pair)
  ```

  Identical geometry **and** identical class list. Note the source keeps *both*
  classes when collapsed and relies on source order — its `page-with-icon-sidebar`
  @768 rule is declared after the `page-with-contextual-sidebar` @1200 rule, so
  56px wins at 1920. `global.css` now orders them the same way, with a comment,
  because getting that order wrong silently reintroduces a 200px dead strip.
- **Bulk-edit right sidebar** on issue/MR lists (`IssuablesList.jsx:731`) already
  reserved its own width inline; no overlap at any width.
- **Milestone detail's right sidebar** (`MilestoneDetail.jsx:354`) overrides
  `.right-sidebar` to `position: static` inline, so it is in flow; clean.
- **Navbar dropdowns, modals, flash container, sticky headers**: no
  fixed/absolute element outside `#content-body` overlaps it on any of the 82
  routes.

---

## 7 · No-regression checks

| Check | Result |
|---|---|
| `npm run build` | **PASS** — `✓ 166 modules transformed … ✓ built in 2.97s` |
| Built bundle cold-loaded under `npm run preview` (port 5272) | 8 routes × 2 widths = **16/16 render, 0 console errors, 0 pageerrors**. Run because a green build has white-screened this app before. |
| Anchor routes | all **145** loaded cold at 1280×720: **0 console errors, 0 pageerrors**. 50 return the 404 page — every one is a project absent from `projects.json` (`byteblaze/AutoAGI`, `byteblaze/agi_index`, …), i.e. a project its task *creates*; that is pre-existing and correct. 16 more are `/-/raw/…`, which `RawFile.jsx` deliberately mounts outside `<Layout>` with no `#content-body`, so my "is `#content-body` non-empty" probe flags them; they serve their file text. |
| Seed / identifiers | **untouched** — the only files modified are the 10 listed in §2; `src/data/*.json` mtimes are unchanged from 12:57/13:10. |
| State size | `/go` `initial_state` = **1.981 MB** compact JSON, inside the 1–2 MB ceiling. No state-shaped change was made (nothing I edited writes state), so this is the pre-existing figure; it differs from the brief's ~1.968 MB by serialization method, not content. |
| Anchor locators 5 and 8 | resolve **with values** at 1280 (§5) — they returned nothing before. |
| Session isolation | untouched; every check above used a distinct `?sid=` and none leaked. |

## 8 · What this round did NOT do

- **The source's `/-/profile*` pages were never driven live.** Reaching them
  needs a `POST /users/sign_in`, which the read-only rule forbids. Their target
  geometry comes from `assets/html/profile-preferences.html` (which shows the
  shell classes and the container class verbatim) plus the fact that the mock's
  profile rows are byte-identical to the source's `project ovw` rows, which use
  the same container class. Same caveat applies to FINDING-703's rail height.
- **Below 1280 was not tested.** GitLab hard-floors at `body{min-width:992px}`
  and the brief named three widths; the 768px rules are transcribed from the
  source but not exercised.
- **Not re-run this round:** the full 132-row `ROUTES.md` parity sweep, the 243
  anchor-string pairs, and the `/go` `state_diff` contract. §7 covers the parts
  my changes could plausibly touch (route resolution, cold render, console
  cleanliness); the exhaustive sweeps are the playwright agent's.
- **`.d-*` Bootstrap breakpoint shims** in `Layout.jsx`'s inline `<style>` were
  left alone. They are display-only and did not appear in any hit test.
