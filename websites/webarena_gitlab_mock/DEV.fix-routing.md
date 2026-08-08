# DEV — fix shard 2 of 3 (routing + layout)

> Round: fix pass after the 3-shard audit
> Owned: `src/App.jsx`, `src/components/layout/**` (+ `ROUTES.md` status cells, assigned)
> Verified by driving chromium against `npm run dev -- --port 5192`
> Build: **PASS** (`npx vite build --outDir /tmp/gitlab-shard2-dist` — built into a
> temp dir on purpose so it would not race shard 1/3 on `dist/`)

---

## Closed

### PARITY-004 — slash-bearing branch names ✅ CLOSED

`amwhalen/archive-my-tweets` really has a branch named
`github/fork/chtitux/addRssFeed` (`src/data/branches.json`), and webarena-788's
`start_url` is `/amwhalen/archive-my-tweets/-/tree/github/fork/chtitux/addRssFeed`.
React Router binds `:ref` to a single segment, so `/-/tree/:ref/*` was resolving
ref=`github` + path=`fork/chtitux/addRssFeed` → **"This directory is empty."**,
and the single-segment `/-/graphs/:ref`, `/-/network/:ref`, `/-/find_file/:ref`
routes did not match the URL at all → `NotFound`.

**Fix — one choke point, zero page edits.** New file
`src/components/layout/RefRoute.jsx`:

- `resolveRef(knownRefs, splat)` takes the **longest prefix** of the splat that
  is a real branch or tag for that project (`getBranches` / `getTags`), falling
  back to the old first-segment reading when nothing matches, so an unknown ref
  still reaches the page's own not-found state.
- `<RefRoute>` then re-matches a descendant `:ref/*` route against a *synthetic
  location* in which the resolved ref is percent-encoded into a single segment.
  React Router turns `%2F` back into `/` when it binds params
  (`matchPath` → `.replace(/%2F/g, "/")`, after `decodePath` re-escapes literal
  slashes), so the pages' existing `useParams().ref` / `params['*']` come out
  correct. **No page under `src/pages/**` was touched** — this deliberately
  avoided a collision with shard 3.

`src/App.jsx` — every ref-bearing route is now registered as a bare splat and
wrapped:

| before | after |
|---|---|
| `/-/raw/:ref/*` | `/-/raw/*` |
| `/-/tree/:ref`, `/-/tree/:ref/*` | `/-/tree/*` |
| `/-/blob/:ref/*` | `/-/blob/*` |
| `/-/blame/:ref/*` | `/-/blame/*` |
| `/-/commits/:ref`, `/-/commits/:ref/*` | `/-/commits/*` (static `/-/commits` kept) |
| `/-/graphs/:ref`, `/-/graphs/:ref/charts` | `/-/graphs/*` → descendant `:ref/charts` \| `:ref/*` |
| `/-/network/:ref` | `/-/network/*` |
| `/-/find_file/:ref` | `/-/find_file/*` |
| `/-/new/:ref`, `/-/new/:ref/*` | `/-/new/*` |
| `/-/edit/:ref/*` | `/-/edit/*` |

Driven in chromium, cold-loaded with a fresh `?sid=`:

```
/amwhalen/archive-my-tweets/-/tree/github/fork/chtitux/addRssFeed
  title    Files · github/fork/chtitux/addRssFeed · Andrew M. Whalen / archive-my-tweets · GitLab
  ref sw.  github/fork/chtitux/addRssFeed
  body     repository root (amt, build, css, doc, img, json, tests …)  — NOT empty
/-/graphs/github/fork/chtitux/addRssFeed     Contributors          OK
/-/network/github/fork/chtitux/addRssFeed    Graph                 OK
/-/find_file/github/fork/chtitux/addRssFeed  Find File             OK
/-/blob/github/fork/chtitux/addRssFeed/README.md                   OK
/-/commits/github/fork/chtitux/addRssFeed                          OK
/-/tree/github/fork/chtitux/addRssFeed/amt   subdir under a slash-ref  OK
/-/graphs/php52 · /-/graphs/master/charts · /-/tree/main/.config    still OK (no regression)
```

Side effect, matching GitLab: `/:ns/:proj/-/tree` with no ref now resolves to the
project's default branch instead of 404.

### PARITY-007 — `/users/:username` ✅ CLOSED

`src/App.jsx` — was `<RedirectWithQuery to="/" />`, now `<UserProfile />`.
`UserProfile` already reads `params.username || params.name`, so no page change
was needed. `/users/byteblaze?sid=…` → `Byte Blaze · GitLab`, sid intact.

### PARITY-011 — ROUTES.md status cells ✅ CLOSED

Reconciled against the code and against a live render of each row:

- row **114** `/:ns/:proj/-/graphs/:ref/charts` `[ ]` → `[x]`, annotated as a
  duplicate of row 58. Both resolve to `RepoAnalytics`; verified rendering
  `Charts · … · GitLab`.
- row **81** `…/merge_requests/:iid/diffs` `[ ]` → `[x]` (registered,
  `MergeRequestDetail tab="diffs"`, verified).
- row **82** `…/merge_requests/:iid/pipelines` `[ ]` → `[x]` (same).

**No false completions found in the other direction.** I cross-checked every
`routesRow={…}` on a `<Placeholder>` in `App.jsx` (rows 67, 76, 99–113, 115–118)
against its ROUTES.md status: **all 21 are `[ ]`** — every row claiming `[x]`
renders a real component. Added a preamble note to `ROUTES.md` documenting that
`:ref` may contain `/` and how it is resolved.

### Group context on `/groups/new` ✅ CLOSED

`src/components/layout/routeContext.js` — the `root === 'groups'` branch now
excludes `head[1] === 'new'`, so `/groups/new` falls through to the reserved-root
branch and Layout draws Shell A. Verified: `.nav-sidebar` count **0**,
`.breadcrumbs` count **0** (absent from the DOM, not merely hidden), while
`/groups/robert1003` still renders its sidebar + breadcrumbs correctly.

### HANDLER-002 — project-overview ref switcher ✅ CLOSED BY SHARD 3

Not mine to write and I did not write it: `src/pages/ProjectOverview.jsx` now
imports `src/components/people/RefSwitcher.jsx` and `src/components/ui/Dropdown.jsx`.
I verified it end to end on `/amwhalen/archive-my-tweets`:

```
toggle count 1 · menu visible BEFORE False · AFTER True
items: ['master', 'github/fork/chtitux/addRssFeed', 'php52']
click 'github/fork/chtitux/addRssFeed'
  -> /amwhalen/archive-my-tweets/-/tree/github/fork/chtitux/addRssFeed?sid=h2
  -> renders the tree (not "empty directory"), sid preserved
```

That last hop only works because of the PARITY-004 fix — before it, the switcher
would have navigated to a broken page.

---

## Concurrency check on `src/App.jsx` (the reason this round exists)

Three dev agents edited this file concurrently last round. Result: **no route
lost, none duplicated, none pointing at the wrong component.**

- **153** `<Route path=…>` elements. **Zero duplicate top-level paths.** The only
  repeated literal is `:ref/*`, which appears 8× — once inside each of the 8
  independent descendant `<Routes>` scopes I introduced, so they cannot collide.
- **ROUTES.md replay**: extracted a probe URL from every numbered row that has a
  source path (117 rows in the 8-column tables + the 13-row §10 table) and
  cold-loaded each in chromium with a fresh `?sid=`. Every `[x]` row renders a
  real page; every `[ ]` row renders `<Placeholder>` or is genuinely unrouted.
  The only initial failures were bad probe substitutions on my side
  (`dotfiles` has no issue/MR/label/milestone `#1`, and `dbt-core` is not a
  seeded group — the seeded groups are `gitlab-instance-58545a48` and
  `robert1003`); re-probed with real ids, all resolve:
  rows 70, 73, 79–83, 86, 89, 92, 93, 119–123, 129 all **OK**.
- **`/-/` infix**: intact on every route. **Legacy non-`/-/` routes**:
  `/:ns/:proj/edit` → `ProjectSettingsGeneral` and `/:ns/:proj/activity` →
  `Placeholder` (row 67, `[ ]`, consistent) — both reproduced as written, not
  "corrected".
- **Trailing slash before the query**: `/-/issues/?state=all`,
  `/-/tree/main/?sid=` both resolve, sid intact.
- **URL-encoded params**: `label_name%5B%5D=help%20wanted` and
  `label_name%5B%5D=type%3A%20bug%20%F0%9F%90%9E` both render their filtered
  issue lists (`%5B%5D`→`[]`, `%20`→space, `%3A`→`:`, `%F0%9F%90%9E`→🐞).
- **`?sid=` survives redirects**: `/users/sign_in` and `/users/sign_out` →
  `/?sid=…`; in-page navigation from a slash-ref tree page keeps both the
  slash-bearing ref and the sid.

---

## NEEDS FILE — handed to shard 3

- `src/pages/NewGroup.jsx:85-86` + `src/components/create/create.css:18-20` —
  the `body.page-new-group` workaround the create shard left in. My
  `routeContext.js` fix makes it a **no-op** (the sidebar and breadcrumb bar are
  no longer in the DOM at all on `/groups/new`), so it is dead code, not a
  conflict. Neither file is in my ownership list, so I left both in place.
  Safe to delete whenever shard 3 (or the next round) touches them.

## Not fixed — named explicitly

- **WebIde ref with a `/` in it.** `/-/ide/project/:ns/:proj/edit/:ref/-/*`
  (`App.jsx`, ROUTES #129) still binds `:ref` to a single segment. Its `/-/`
  terminator makes it a different parse from the routes above and no anchor
  reads a slash-bearing ref through the Web IDE, so I left it rather than
  widening the blast radius of this shard. `/-/ide/project/byteblaze/dotfiles/edit/main/-/README.md`
  verified working.

## Observations for other shards (not mine to fix)

- **`/groups/<nonexistent>` renders a group shell instead of 404.**
  `resolveRouteContext` returns `kind: 'group'` with `group: null` and
  `GroupOverview` renders a page for it (e.g. `/groups/dbt-core`, which is not a
  seeded group). GitLab 404s there. This is `GroupOverview`'s call, not the
  route context's — leaving `kind: 'group'` is what lets a task-created group
  render before state settles. → shard 3 / next round.
- During my run, `src/components/ui/Dropdown.jsx` and
  `src/components/ui/QueryForm.jsx` intermittently threw
  `Dropdown is not defined` / `QueryForm is not defined` in the browser console.
  That was shard 3 editing them live under HMR; both resolved on their own and
  the production build is clean. Flagging only so it is not mistaken for a real
  defect if it shows up in a later log.
