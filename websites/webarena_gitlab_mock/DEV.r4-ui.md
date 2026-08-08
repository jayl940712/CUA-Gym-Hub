# DEV.r4-ui.md — Round 4, shard A (UI / routes / controls)

> Owned: `src/pages/**`, `src/components/**`, `src/App.jsx`
> Build: **PASS** (`vite v5.4.21`, 163 modules, `index.js` 5 740 kB / gzip 1 527 kB)
> Regression: `assets/route_smoke.py` → **201/201 cold-loaded, 0 failing, 7/7 canonical redirects**
> Verified in real chromium at `http://localhost:5231`, fresh `?sid=` per check.

---

## 1 · What landed

| Finding | Status | Verified by |
|---|---|---|
| **P1-2** `sortIssuables` ignored 8 sort tokens | **DONE** | 11 tokens driven on `/keycloak/keycloak/-/issues`; all 8 now reorder |
| **P1-3** 20 ROUTES rows rendered `<Placeholder>` | **13 of 20 DONE**, 7 handed back | 23 routes cold-loaded, 0 still carry the placeholder sentence |
| **P2-8** `/-/snippets/new` pointed at `<Placeholder>` | **DONE** | renders `NewSnippet`; title `New Snippet · … · GitLab` |
| **P2-2** six forms hard-coded `http://localhost:8023/` | **DONE** (adopted `instanceUrlPrefix()` per the adjudication) | zero `localhost:8023` left outside `instance.js`'s own comment |
| **P2-3** `ExploreTopics` invented copy | **ALREADY CLOSED** by an earlier shard | file read; only the two source strings remain |
| **P2-1** `Delete branch` / `Delete merged branches` / `Delete tag` inert | **DONE** — shard B's overlays had landed | delete → reload → `/go` `state_diff` |
| **P2-10** assorted dead controls | **DONE** (2 were already live) | each driven |
| **P2-4** `/groups/<nonexistent>` rendered a shell | **DONE** | 404s; group creation still renders |
| **P2-5** missing-blob redirect | **ALREADY CLOSED** | drove it; 302s to `/-/tree/main` |
| **P2-6** `/-/forks` empty state | **NOT A BUG** — the source renders the same string | source capture, below |
| **P2-9** blob syntax highlighting | **NOT DONE** — out of budget |

Two extra defects were found while making P2-1's buttons work and are fixed
(§5): the whole branch-row controls column was CSS-hidden at every viewport
width, and the branch row never flexed.

---

## 2 · P1-2 — the 8 sort tokens (`src/pages/hooks.js`)

`sortIssuables` was a 9-case switch; it is now the full documented token set,
and it takes the `indexes` bag so it can reach milestones and labels
(`IssuablesList.jsx:709`).

### Where the ordering semantics came from

Not from memory and not from `?sort=` URLs on the source — the brief forbids
those and `assets/README.md §5a.6` records why (GitLab persists
`issues_sort` onto the user record, so loading one pollutes every later
observation). The token → direction map is `assets/README.md §5a.6` and the
project-list table at §13.5, both captured pre-pollution. The *ordering* rules
are GitLab's `Issuable.sort_by_attribute` scopes:

* every nullable key is **nulls last in BOTH directions** (`nulls_last` /
  `<col> IS NULL, <col> ASC|DESC`) — reversing does not float empties to the top;
* `milestone*` has a **three-tier** null shape, straight off
  `ORDER BY milestones.due_date IS NULL, milestones.id IS NULL, due_date`:
  rows with a due date → rows whose milestone has no due date → rows with no
  milestone;
* `priority*` is `order_due_date_and_labels_priority`: milestone due date first,
  highest label priority second;
* ties break on `id DESC`.

The `id DESC` tie-break is the one place I went beyond the source: GitLab only
appends it on some scopes and leaves the rest to Postgres' arbitrary row order.
A mock has to be deterministic, so it is applied everywhere. Stated in the
module comment.

Both spellings of every direction are accepted, because the dashboard menu and
the project-list menu emit **different tokens for the same visible label** —
`Closed date` is `closed_at` on one and `closed_at_desc` on the other. That is
the trap the brief flagged, and it is why the switch has paired cases rather
than a suffix swap.

Also fixed while in there, same class of bug, not on the finding list:
`due_date` (bare — what the dashboard menu emits) had no case and fell through
to created-desc; and `due_date_asc` sorted nulls **first**, which GitLab never
does. `merged_at`, `popularity_asc`, `created_desc` and the `*_asc` twins are
now handled too.

### Driven

`/keycloak/keycloak/-/issues?state=all&sort=<token>`, 11 tokens, comparing the
rendered row order against `created_date`:

```
created_date        (baseline)
milestone           differs ✔     closed_at         differs ✔
milestone_due_desc  differs ✔     closed_at_desc    differs ✔
priority            differs ✔     label_priority    differs ✔
priority_desc       differs ✔     relative_position differs ✔
title_asc           differs ✔     due_date          differs ✔
0 pageerrors, 0 console errors
```

### Three seed facts that make some of these inert — checked, not assumed

These were verified read-only against the container and the captures, and they
mean the mock is behaving exactly as the source would on this data. **They are
seed gaps, not code gaps, and I did not fabricate around them.**

| Token | Why it collapses to the tie-break |
|---|---|
| `label_priority*` | `SELECT count(*) FROM label_priorities` on the source is **0**. Both captured labels pages render `Star labels to start sorting by priority`. No label is prioritized anywhere, so `highest_priority` is null for every row — on the source too. |
| `relative_position` | 31 source issues carry one (project ids 2 and 3, issue ids 1–30 + 293). **None is in the sampled seed**, and `issues.json` has no `relative_position` field. |
| `closed_at*` | **No issue in `issues.json` has `closed_at` set**, including the ones with `state: 'closed'`. This is a real seed gap — the column exists on the source. |
| `merged_at*` | `merge_requests.json` has no `merged_at` (or `closed_at`) column at all. |
| `milestone*` direction | Only **2 issues in the entire seed** have a milestone that has a `due_date` (`OpenAPITools/openapi-generator#14934`, `a11yproject/a11yproject.com#719`) — and they are in different projects, so within any one project list the asc/desc pair can never differ. The three-tier grouping *is* observable and was driven; the direction flip is not testable against this seed. |

**Seed asks for whoever re-cuts it:** `issues.closed_at`,
`merge_requests.merged_at` / `closed_at`, and a wider sample of milestones with
due dates. All four are cheap `SELECT`s and would make five sort tokens
observable instead of inert.

---

## 3 · P1-3 — 13 of 20 placeholder rows replaced with the source's real view

### Recon first

I captured the SOURCE's rendering of all 20 rows before writing anything
(playwright, logged in as byteblaze, GET only, no `?sort=` URL, nothing
mutated). Captures are in `/tmp/r4cap/r4-*.html`. Three of the captures changed
what the fix should be:

* `/-/monitor` → the source returns **HTTP 404**. It now renders `NotFound`.
* `/-/google_cloud/configuration` → the source returns **HTTP 500**. It now
  renders Rails' `public/500.html` (`Whoops, something went wrong on our end.`).
  404 and 500 are different observations and an agent can tell them apart.
* `/-/blob/main/<missing>` → confirmed the source 302s to `/-/tree/main`
  (this is P2-5, already implemented — see §6).

New module `src/pages/ProjectOps.jsx` (20 exports) + `src/App.jsx` repoints.

| Row | Route(s) | Now renders |
|---|---|---|
| 67 | `/:ns/:proj/activity` | 8 filter tabs + `No activities found` |
| 76 | `/-/incidents`, `/-/alert_management` | `Display your incidents in a dedicated view` / `Surface alerts in GitLab` |
| 106 | `/-/pipelines`, `/charts`, `/:id` | `There are currently no pipelines.` · CI/CD Analytics · `/:id` 404s |
| 107 | `/-/jobs` | `Use jobs to automate your tasks` |
| 108 | `/-/pipeline_schedules` | dismissible callout + 3 tabs + `No schedules` |
| 109 | `/-/ci/editor` | `Optimize your workflow with CI/CD Pipelines` |
| 110 | `/-/environments` | `You don't have any environments.` |
| 111 | `/-/releases` | `Getting started with releases` |
| 112 | `/-/packages`, `/-/infrastructure_registry` | `There are no packages yet` / `You have no Terraform modules in your project` |
| 116 | `/-/snippets`, `/-/snippets/new` | `Code snippets` empty state / `NewSnippet` (**P2-8**) |
| 117 | `/-/wikis/home`, `/-/wikis/*` | `The wiki lets you write documentation for your project` |
| 118 | `/-/clusters`, `/-/terraform`, `/-/feature_flags`, `/-/error_tracking`, `/-/metrics` | each source empty state |
| 118 | `/-/monitor`, `/-/google_cloud/configuration` | 404 / 500, matching the source's status codes |

Nothing is invented. This instance has no runners, pipelines, environments,
packages, snippets or wikis on any project, so the source *is* the bundled empty
state on every one of these routes.

**Two deliberate omissions**, both decorative on the source: the
`/assets/illustrations/*.svg` images (`alt=""`, `role="img"` — pointing an
`<img>` at the container would be a runtime network call the contract forbids;
the `.svg-content` wrapper is kept so the spacing survives), and GitLab's Vue
`<!---->` comments. The 500 page's `Request ID:` line is dropped because it is a
per-request random.

### Driven

23 routes cold-loaded with a fresh `?sid=`, asserting the expected source string
is present **and** that `has not been implemented yet` is absent:
**23/23 OK, sid kept on all 23, 0 console errors, 0 pageerrors.**

### The 7 rows I did NOT do — handed back

Rows **99–105** (`/-/settings/repository`, `/settings/merge_requests`,
`/settings/ci_cd`, `/settings/integrations`, `/settings/access_tokens`,
`/settings/operations`, `/settings/packages_and_registries`, `/-/hooks`,
`/-/usage_quotas`) plus **113** (`/-/value_stream_analytics`) and **115**
(`/-/security/configuration`).

These are **not** empty states. They are large multi-section settings forms —
`settings/ci_cd` is 9.2 kB of copy across 6 collapsible sections with ~20
persisted controls, `settings/repository` 5.1 kB, `settings/merge_requests` 2.9,
`settings/integrations` 2.8 (a 30-row integrations table), `settings/operations`
2.3, `/-/hooks` 1.7, `settings/access_tokens` 1.7. Building them as *copy* would
produce exactly the dead affordances `SANDBOX_COMPLETENESS_GUIDE.md` forbids;
building them properly is a shard, not a finding. **Captures are already on disk
at `/tmp/r4cap/r4-set-*.html`, `r4-hooks.html`, `r4-usage.html`, `r4-vsa.html`,
`r4-sec-config.html`** — copy them into `assets/html/` and a settings shard can
start immediately without redoing recon.

Suggested split: (a) `settings/repository` + `settings/merge_requests` +
`settings/ci_cd`; (b) `settings/integrations` + `/-/hooks` +
`settings/access_tokens` + `settings/operations` + `settings/packages_and_registries`;
(c) `/-/usage_quotas` + `/-/value_stream_analytics` + `/-/security/configuration`.

---

## 4 · P2-2, P2-4, P2-10 — controls and copy

### P2-2 · `instanceUrlPrefix()` adopted at all six call sites

`NewProject.jsx` ×4, `NewGroup.jsx`, `GroupSettings.jsx`,
`ProjectSettingsGeneral.jsx`. Per the lead's adjudication; not re-litigated.
`grep -rn localhost:8023 src/` now returns only `instance.js`'s own explanatory
comment and `ProfileAccount.jsx`'s. The helper no longer ships with zero callers.

### P2-4 · nonexistent groups 404

`GroupOverview.jsx`, `GroupMembers.jsx`, `GroupRollup.jsx` all `return <NotFound />`
when the slug is in neither the seed nor `state.groups`. Confirmed against the
source: `GET /groups/this-group-does-not-exist-r4` → **404 Not Found**. The
invented `This group does not exist yet` + `Create the group <x> to manage its
members.` block is gone.

The brief's worry — that this would break the group-creation tasks — does not
apply, and I proved it rather than reasoning about it: `createGroup()` writes the
row into `state.groups` in the same `setState` that allocates its id and only
then navigates. Drove a real creation end to end:

```
/groups/new → Create group → "R4 Audit Group" → submit
  → /R4-Audit-Group?sid=r4g   404? False   Group ID: 7
  → owner affordances present: "New subgroup", "New project"
/groups/nope-r4                     -> 404
/groups/nope-r4/-/group_members     -> 404
/groups/nope-r4/-/issues            -> 404
/groups/robert1003                  -> renders
```

### P2-10 · the six dead controls

Two of the six were **already live** and the audit's line numbers were stale:
`Attach a file or image` (`Controls.jsx:486`, wired to `/upload?sid=`) and
`Go full screen` (`:494`, toggles `zen`). The other four:

| Control | Now does |
|---|---|
| `Keyboard shortcuts` (`Navbar.jsx`) | opens `#keyboard-shortcut-modal` — **14 sections, 75 rows, 126 `<kbd>`**, searchable, Esc-closable. `?` toggles it, as the modal's own first row advertises. |
| `What's new` (`Navbar.jsx`) | opens the `.gl-drawer` — **10 release-post items**, and the navbar's `10` badge is now `WHATS_NEW_ITEMS.length` instead of a literal. |
| `Open sidebar` (`Breadcrumbs.jsx`) | `setSidebarCollapsed(false)` |
| `Close sidebar` (`ProjectSidebar.jsx`) | `setSidebarCollapsed(true)` |
| `Invite Members` (assignee dropdown footer, `Controls.jsx`) | links to `<base>/-/project_members`, where the invite form actually lives (GitLab opens a modal in place; navigating is the honest approximation, and the destination is real) |

Both modals' content is **captured from the source, not written from memory** —
that is the whole reason they took a capture round:

* `src/components/layout/shortcutsData.js` — extracted from the container's own
  rendered `#keyboard-shortcut-modal` DOM (clicked `.js-shortcuts-modal-trigger`
  on `http://localhost:8023/byteblaze/dotfiles`). Pure client-side modal, no
  server state touched.
* `src/components/layout/whatsNewData.js` — the 10 items from the container's
  own `GET /-/whats_new` response body, 14 kB. `image_url` is deliberately
  **not** carried over: every item's image is on `about.gitlab.com` and
  rendering it would be a runtime network call. The element is kept, unpainted.
  Descriptions contain no `<img>` (checked: 0 of 10).

Driven:

```
shortcuts modal visible: True | sections: 14 | kbd: 126
  search "boards" -> "Project | g then b | Go to issue boards"
  Escape closes: True   '?' opens: True
whats-new drawer: True | badge: 10 | items: 10 | first: "Introducing the GitLab CLI"
Invite Members href: /a11yproject/a11yproject.com/-/project_members
0 pageerrors, 0 console errors
```

---

## 5 · P2-1 — branch/tag deletion, plus two defects it exposed

Shard B's `repo.branchDeletions` / `repo.tagDeletions` and `deleteRefs()` had
landed by the time I got here, so the handlers are the three lines the brief
predicted. `Delete merged branches` needed a rule: GitLab's
`DeleteMergedBranchesService` deletes every branch whose tip is contained in the
default branch. The seed's branch rows are `{name, sha, committed_date, subject}`
with no ahead/behind counts, so the only containment fact available is *same tip
sha as the default branch*. Deliberately narrow — it never deletes a branch the
source would keep — and stated in the code.

**Driven end to end, with the state read back off `/go`:**

```
/byteblaze/dotfiles/-/branches/all   ['main','master']
  → click Delete branch on master   → ['main']
  → reload                          → ['main']            (persisted)
  → /go state_diff  {'repo.branchDeletions.byteblaze/dotfiles': {'new': ['master']}}

/facebook/buck/-/tags   25 rows
  → click Delete tag    → 24 → reload → 24
  → /go state_diff  {'repo.tagDeletions.facebook/buck': {'new': ['v2022.05.05.01']}}

Delete merged branches on dotfiles (main 218b5e72 ≠ master e19ab89a):
  → deletes nothing, correctly
```

### Two defects this uncovered — both fixed

**(a) The branch-row controls column was hidden at every viewport width.**
The source ships `<div class="controls d-none d-md-block …">`. `global.css`
defines `.d-none { display: none !important }` and **none of Bootstrap's
breakpoint variants**, so `Merge request`, `Compare` and `Delete branch` were
`display:none` at 1280px, 1600px and 1920px alike. This is why `AUDIT.md`
DIFF-A09 recorded "the `Merge request`/`Compare` links on `/-/branches`" as
still absent — they were in the DOM the whole time.

Added the Bootstrap 4 responsive display utilities in `Layout.jsx` (a component
I own; `src/styles/global.css` is outside both shards' ownership). They only
ever re-show something the source shows at desktop. The
`.d-*-block.gl-display-flex` pairs exist because `.d-none` is `!important` in
`global.css` while `.gl-display-flex` is not, so an element carrying both would
otherwise be forced to `block`.

This also un-hides `.info-well` on the blob page, the commit sha group, the
profile calendar row, and the milestone actions — 9 call sites total. All 201
smoke routes stayed clean afterwards.

**(b) `.branch-item` never flexed.** The row carries GitLab's `!`-suffixed
utilities (`gl-display-flex!`, `gl-align-items-center!`). Those class names
contain a **literal `!`**, and `global.css` defines zero escaped `.gl-*\!`
selectors, so the row was a block and the controls stacked under the branch
name once they became visible. Restated for this page in a scoped `<style>` in
`Branches.jsx` (the established pattern here — `Search.jsx`, `Contributors.jsx`,
`NotesTimeline.jsx`, `UserProfile.jsx`, `ProjectsNav.jsx` all do it).

Screenshot after: name + commit left, `Merge request` / `Compare` / `×`
right-aligned — matching `assets/html/proj-dotfiles-branches.html`.

> **Not fixed, reported:** **35 distinct `gl-*!` utility classes are used across
> `src/` and none is defined in `global.css`** (`gl-display-flex!` ×5,
> `gl-reset-color!` ×4, `gl-px-4!` ×4, `gl-p-0!` ×3, `gl-text-gray-900!` ×2,
> `gl-text-blue-600!` ×2, …). Every one is a silent no-op. Earlier shards worked
> around individual cases per file (`UserProfile.jsx:112`, `RepoBlob.jsx:120`,
> `ProjectOverview.jsx:255` all carry comments about it). The right fix is one
> block of escaped `.gl-\*\!` selectors in `global.css` — **which no shard owns.
> Assign it.**

---

## 6 · Findings that turned out not to be bugs

**P2-6 — `/-/forks` empty state is NOT wrong.** The audit said the mock renders
the *profile* empty state (`This user doesn't have any personal projects`) and
should use "the source's real fork empty state". I captured
`http://localhost:8023/byteblaze/dotfiles/-/forks` and the source renders
**exactly that string**, in an `<h5>`, inside
`.nothing-here-block > .svg-content > .text-content`:

```html
<div class="js-projects-list-holder" data-qa-selector="projects_list">
  <div class="nothing-here-block"> <div class="svg-content">
    <img …/> <div class="text-content">
      <h5>This user doesn't have any personal projects</h5>
```

GitLab genuinely reuses `shared/projects/_list.html.haml`'s empty state here.
`Forks.jsx:122-126` already matches it element for element (minus the
decorative illustration). **Nothing to change — do not "fix" this next round.**

**P2-3 — `ExploreTopics` was already clean.** An earlier shard closed it; the
file contains only `There are no topics to show.` + `Add topics to projects to
help users find them.`, uses the shared `<ProjectsPrimaryTabs>`, and the
invented lines and `175 projects on this instance.` are gone.

**P2-5 — the missing-blob redirect already works.** `RepoBlob.jsx:64-68` has
done it since an earlier round. Drove it:
`/byteblaze/dotfiles/-/blob/main/NOPE-DOES-NOT-EXIST.txt?sid=r4b` →
`/byteblaze/dotfiles/-/tree/main?sid=r4b&flash_notice=…`, sid intact — matching
the source's own 302 to `/-/tree/main`.

---

## 7 · Not done

* **P2-9 · blob syntax highlighting** (+ the `ProfilePreferences.jsx`
  syntax-theme picker that consumes nothing). Lowest priority in the brief and
  out of budget. It is a self-contained shard: a tokenizer over the blob body
  plus wiring the existing theme preference.
* **P1-3's 7 settings rows** — §3, with captures already on disk and a
  suggested three-way split.
* **`global.css`'s missing `gl-*!` utilities** — §5, unowned file.

---

## 8 · Files touched

```
src/pages/hooks.js                        P1-2 · sortIssuables rewritten
src/pages/IssuablesList.jsx               P1-2 · pass `indexes` to the sort
src/pages/ProjectOps.jsx                  P1-3 · NEW, 20 views
src/App.jsx                               P1-3/P2-8 · 23 route repoints
src/pages/NewProject.jsx                  P2-2 · instanceUrlPrefix ×4
src/pages/NewGroup.jsx                    P2-2
src/pages/GroupSettings.jsx               P2-2
src/pages/ProjectSettingsGeneral.jsx      P2-2
src/pages/GroupOverview.jsx               P2-4 · 404
src/pages/GroupMembers.jsx                P2-4 · 404, invented copy removed
src/components/create/GroupRollup.jsx     P2-4 · 404
src/pages/Branches.jsx                    P2-1 · delete branch / delete merged; row flex
src/pages/Tags.jsx                        P2-1 · delete tag
src/components/layout/Navbar.jsx          P2-10 · shortcuts modal + what's-new drawer
src/components/layout/shortcutsData.js    NEW · captured from the source
src/components/layout/whatsNewData.js     NEW · captured from the source
src/components/layout/Breadcrumbs.jsx     P2-10 · Open sidebar
src/components/layout/ProjectSidebar.jsx  P2-10 · Close sidebar
src/components/issuable/Controls.jsx      P2-10 · Invite Members
src/components/layout/Layout.jsx          responsive display utilities
ROUTES.md                                 12 status cells → [x]
```

Nothing outside `src/pages/**`, `src/components/**`, `src/App.jsx` and
`ROUTES.md` was written. `SCHEMA.md`, `assets/data_model.md`,
`src/utils/dataManager.js` and `src/data/*.json` were read only.
