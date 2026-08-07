# reddit (Postmill) — Route Parity Map

> Source: <http://localhost:9999> · container `forum`
> Discovered by: plan agent, 2026-08-06
> Authority: `/var/www/html/config/app_routes/*.yaml` (Symfony YAML routing, one
> file per controller), cross-checked by crawling the live site.
> Mock routes are identical to source routes; `?sid=` is additive and never
> replaces a source param.

Route-parameter regexes, from `config/services.yaml`:

```yaml
submission_sort_modes: active|hot|new|top|controversial|most_commented
number_regex:          '[1-9][0-9]{0,17}'
username_regex:        '[\w\-\[\]]{3,25}|!(?:deleted\d+|test)'
uuid_regex:            (standard uuid)
```

Priority: **P0** = app cannot render/route without it · **P1** = a workflow a
WebArena task targets · **P2** = depth/realism · **P3** = present in Postmill but
no task touches it.

Status legend:

| Mark | Meaning |
|---|---|
| `[x] ✅` | Migrated **and independently verified** — cold-loaded in a fresh browser context with a fresh `?sid=`, rendered the correct view, honoured its params, and kept `?sid=` through every redirect and form post |
| `[x]` | Migrated, but **not** independently verified (see the note below for the one such row) |
| `[ ] ✅` | Not counted as a migration target, but verified to render a correct live state matching the source |
| `[ ]` | Not migrated, out of scope, or not exercisable on a fresh seed |

### Verification status — 2026-08-07 (gap-closure pass)

**72 of 106 rows verified. Every one of the 106 rows is now explicitly accounted
for — there are no unverified `[x]` rows and no unexamined `[ ]` rows.**

```
106 rows = 67 [x] ✅ migrated + verified
         +  5 [ ] ✅ non-target, but verified rendering a correct live state
         + 34 [ ]   genuine non-targets, each individually probed on both sides
```

Evidence: `TEST.md` (the earlier consolidation pass) and `TEST.part-gaps.md` (this
pass — rows #20 and #71, the unmarked-row audit, and a 10-row spot re-verification
against the post-polish build). Verification was performed against the live source
at `http://localhost:9999` using **GET only**, plus the one permitted `/login_check`
POST; templates and route YAML were read read-only via `docker exec … cat`.

- **All 67 migrated (`[x]`) rows are verified.** The last hold-out,
  **#20 `/f/{forum}/remove_moderator/{moderator_id}`**, was closed this pass. It is
  unexercisable on a fresh seed for a reason that is *upstream*, not a seeding
  shortfall — the source's `moderators` table is empty for all 95 forums
  (`select count(*) from moderators` → 0), so on the source too the only reachable
  path is to create a forum. Driven end to end in the mock: `/create_forum` →
  `/f/GapProbe20/moderators` renders the `Username · Since · Last seen` table with a
  `Remove` button → click removes the row, flashes `The user was unmodded.`, leaves
  `There are no entries to display.`, keeps `?sid=`, writes `moderators: []` into
  `/go` `state_diff`, and correctly flips `/f/GapProbe20/edit` to `403`.
- **Row #71 `/user/{username}/unblock_user` → `[ ] ✅`.** Reproduced independently
  this pass, both affordances: block `smita16` from the profile Toolbox → row appears
  on `/user/MarvelsGrantMan136/block_list` → re-block and self-block both `403` →
  unblock from the table, and again from the profile sidebar. `/go` `state_diff`
  moves to `["blockedUsers"]` and returns to `{}`. Flash strings match
  `translations/messages.en.yml` verbatim.
- **Row #75 `/user/{username}/trash` → `[ ] ✅`.** Was carried as `[ ]` but is in fact
  implemented and correct: source returns **200** with `#main` = `Trash` /
  `There are no entries to display.`, and the mock's `#main` is identical, with the
  same `Toolbox · Hidden forums · Trash` user sidebar.
- **Row #38** (`/f/{f}/{id}/comment/{cid}` → 301) was reported failing by the first
  parity shard, was fixed, and has since been re-verified twice — most recently by
  cold-loading both anchor cases, each landing on the `-`-slug canonical URL with
  `?sid=` intact and the correct comment rendered.
- **Rows #21, #26, #69** carry `[ ]` but render correct live states matching the
  source's 200 (`Bans in /f/news`, `Showing moderation log for /f/news`, `Block list`),
  so they are marked `[ ] ✅`. **Row #73** (`hide_forum`) is likewise marked: its
  POST-only affordance is a live `preventDefault`ed form behind the `Hide this forum`
  disclosure in the forum sidebar.
- **Undocumented deviation found earlier:** `GET /night_mode` (**#81**) returns
  **400 Bad Request** on the source but renders a full `Night mode` settings form in
  the mock. This is the same "no dead affordance" trade-off already recorded for
  `/f/…/delete_own` (#55, source 405) in §"Discovery routes — deliberate deviations",
  but it is **not** listed there. Row #81 is P2 and no anchor references it; filed as
  P2-007 in `TEST.md`. Either 400 to match, or add the row to that table.

#### The 34 remaining `[ ]` rows, by category

Each was probed on **both** sides this pass (§3b of `TEST.part-gaps.md`). **None is
reachable, task-relevant and merely unimplemented**, and no anchor route sits in this
set — all 93 anchor routes in `assets/task_anchors.json` reduce to rows
**#1, #10, #15, #33, #37, #61**, every one of which is `[x] ✅`.

| Category | Rows | Basis |
|---|---|---|
| Declared in § "Intentionally Not Migrated" | 9, 12, 35, 39, 82, 83, 91, 102, 106 | `.atom` feeds, `.json` read APIs, `/opensearch.xml`, `/_up/`, `/registration`, `/site/health_check`, `/ft.json` |
| POST-only, no GET surface, no affordance rendered | 43, 44, 45, 46, 48, 58, 59, 76 | Source returns **405** to a GET on all eight; `Submission.jsx` renders no Lock/Pin/Flair/purge control, so nothing dead points at them |
| Moderator-gated, **403** on the source for `MarvelsGrantMan136`, and unlinked | 22, 23, 24, 25, 42, 47 | Reachable only from a non-empty ban list or a moderator action row, neither of which exists on a fresh seed |
| Admin-only, **403** on the source for this user, and unlinked | 74, 100, 101, 103, 104, 105 | Mock returns its 404 page instead of a 403 shell; both are error pages, no task, no link. #74 `/user/{name}/forum_bans` is **403 even for the user's own profile** — measured |
| Progressive-enhancement XHR fragment | 53 | `/comment_form/…` backs the source's inline reply box; the mock's reply box is client-side |
| Matches the source's own miss/redirect | 94, 95 | `/tag/{name}/edit` is **404** on the source too while 0 tags exist; `/c/{n}/{sort}` 302s to a `/tag/…` that then 404s |
| Wiki CRUD / history — P3, 0 tasks | 98, 99 | 200 on the source and linked from the wiki page's `#main`/`#sidebar`; the mock renders neither the links nor the pages (F-GAPS-004 in `TEST.part-gaps.md`, P2) |

Note on `.atom`: measured live, `/all.atom` and `/f/{forum}.atom` are themselves
**404** — only `/featured/{sortBy}.atom` and `/f/{f}/{sortBy}.atom` exist. Immaterial
(not migrated), recorded for accuracy.

---

## 1. Front / global listings

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 1 | `/` | GET | `/` | Front page = the user's `front_page` view (`subscribed` for the seeded user ⇒ **empty listing**), tab nav + filter dropdown + sort dropdown, sidebar. **Anchor route for 119 of 129 tasks** (start URL). | `currentUser.json`, `subscriptions` state | P0 || [x] ✅ |
| 2 | `/{sortBy}` | GET | `/hot` `/new` `/top` `/active` `/controversial` `/most_commented` | Same view, explicit sort. Matched by `App.jsx`'s single-segment fallback, whose param is `segment`, so `RootSegment` passes the sort to `ListingPage` as a **prop** (PARITY-001 — it used to be dropped and every one of the six rendered as Hot). | ↑ | P0 || [x] ✅ |
| 3 | `/featured` `/featured/{sortBy}` | GET | same | Submissions from forums where `featured = true` (**none**, so empty). Carries the "You are not subscribed to any forum…" alert, which `front/featured.html.twig` emits from the user's *preference*, not from the route (PARITY-004). | `forums.json` | P1 || [x] ✅ |
| 4 | `/all` `/all/{sortBy}` | GET | same | Every submission on the site, sorted | `submissions.json` | P0 || [x] ✅ |
| 5 | `/subscribed` `/subscribed/{sortBy}` | GET | same | Submissions from subscribed forums. **With zero subscriptions this is a 302, not a page** — `FrontController::subscribed()` does `redirectToRoute('featured', {sortBy})` ("To avoid showing new users a blank page"), so the agent's FINAL URL becomes `/featured` / `/featured/{sortBy}`. See "Redirects" below. | subscriptions state | P1 || [x] ✅ |
| 6 | `/moderated` `/moderated/{sortBy}` | GET | same | Submissions in forums the user moderates (empty until the user creates a forum). Filter dropdown reads **Moderated**; the `Forums \| Trash` moderator sub-nav (`front/_moderator_nav.html.twig`) is appended inside the nav; the "You don't moderate any forums." alert sits **above** the nav (PARITY-003). | moderators state | P2 || [x] ✅ |
| 7 | `/comments` | GET | `/comments` | Site-wide comment firehose, newest first | `comments.json` | P1 | [x] ✅ |
| 8 | `/trash` | GET | `/trash` | Site-wide trash (admin) — empty state | — | P3 | [x] ✅ |
| 9 | `/all.atom` `/featured/{sortBy}.atom` | GET | — | Atom feeds | — | P3 (not migrated) | [ ] |

## 2. Forums

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 10 | `/f/{forum_name}` | GET | `/f/:name` | Forum listing, 25/page, default sort `hot`. Sidebar shows forum title, description, `sidebar` text, Subscribe button, submission/subscriber counts. | `forums.json`, `submissions.json` | P0 || [x] ✅ |
| 11 | `/f/{forum_name}/{sortBy}` | GET | `/f/:name/:sort` | `hot`\|`new`\|`top`\|`active`\|`controversial`\|`most_commented` | ↑ | P0 || [x] ✅ |
| 12 | `/f/{forum_name}.atom`, `/f/{f}/{sort}.atom` | GET | — | Atom feed | — | P3 (not migrated) | [ ] |
| 13 | `/f/{names}` (`a+b+c`) | GET | `/f/:names` | **Multireddit** — `+`-joined forum names, 3–25 chars each, up to 70. Same listing UI over the union. | `submissions.json` | P2 | [x] ✅ |
| 14 | `/f/{forum_name}/comments` | GET | `/f/:name/comments` | Comments made in this forum, newest first | `comments.json` | P1 | [x] ✅ |
| 15 | `/f/{forum_name}/edit` | GET, POST | `/f/:name/edit` | **Forum settings form.** Fields incl. `#forum_title`, `#forum_description`, `#forum_sidebar`. **Anchor route** (webarena-580..584) — evaluator reads `document.querySelector("#forum_description").value` and `#forum_sidebar.value`. Moderator-only. | forums state | **P0** | [x] ✅ |
| 16 | `/f/{forum_name}/appearance` | GET, POST | `/f/:name/appearance` | Forum theme/background image form | forums state | P2 | [x] ✅ |
| 17 | `/f/{forum_name}/delete` | GET, POST | `/f/:name/delete` | Delete-forum confirmation. Validating form (no `novalidate`), both `ConfirmDeletionType` fields `required`, errors mirrored into `ul.form-error-list` (dev-fix-9). | forums state | P2 | [x] ✅ |
| 18 | `/f/{forum_name}/moderators` `/…/moderators/{page}` | GET | same | Moderator list, paginated | moderators state | P2 | [x] ✅ |
| 19 | `/f/{forum_name}/add_moderator` | GET, POST | same | Add-moderator form | moderators state | P2 | [x] ✅ |
| 20 | `/f/{forum_name}/remove_moderator/{moderator_id}` | POST | same | uuid param. **Verified** by the only path that exists on either side: the source's `moderators` table is empty for all 95 forums, so a removable row requires `/create_forum` first (creator ⇒ moderator). Driven end to end — `Remove` button in the `/f/{new}/moderators` table removes the row, flashes `The user was unmodded.`, keeps `?sid=`, writes `moderators: []` to `/go` `state_diff`, and flips `/f/{new}/edit` to 403. The mock's form `action` carries the **username** where the source's carries a uuid `moderator_id` (F-GAPS-001, P2) — the form is `preventDefault`ed, so the attribute is never dereferenced. | moderators state | P2 | [x] ✅ |
| 21 | `/f/{forum_name}/bans` `/…/bans/{page}` | GET | same | Forum ban list | — (empty) | P3 | [ ] ✅ |
| 22 | `/f/{forum_name}/bans/history/{username}/{page}` | GET | same | Per-user ban history | — (empty) | P3 | [ ] |
| 23 | `/f/{forum_name}/ban/{username}` | GET, POST | same | Ban form | — | P3 | [ ] |
| 24 | `/f/{forum_name}/unban/{username}` | GET, POST | same | Unban form | — | P3 | [ ] |
| 25 | `/f/{forum_name}/trash` | GET | same | Forum trash | — | P3 | [ ] |
| 26 | `/f/{forum_name}/moderation_log` `/…/{page}` | GET | same | Per-forum moderation log | — (empty) | P3 | [ ] ✅ |
| 27 | `/moderation_log` `/moderation_log/{page}` | GET | same | Global moderation log. `200` with `Global moderation log` + `There are no entries to display.` and an **empty** sidebar — no `forum_log_entry` rows exist, so the empty state is the complete implementation. `/moderation_log/1` 200, `/moderation_log/{0,2,…}` 404 (all verified live). The target of the `Global moderation log` button row #26 already renders. | — (empty) | P3 | [x] ✅ |
| 28 | `/f/{forum_name}/subscribe` | POST | same | **Subscribe.** Also `/f/{n}/subscribe.json` (AJAX). Mutates sidebar on `/`. | subscriptions state | **P0** || [x] ✅ |
| 29 | `/f/{forum_name}/unsubscribe` | POST | same | Unsubscribe (+ `.json`) | subscriptions state | **P0** || [x] ✅ |
| 30 | `/create_forum` | GET, POST | `/create_forum` | **Create-forum form.** Creator becomes moderator ⇒ unlocks `/f/<new>/edit`. Required for webarena-580..584. | forums state | **P0** | [x] ✅ |
| 31 | `/forums` `/forums/{sortBy}` `/forums/{sortBy}/{page}` | GET | same | Paginated forum index with a sort dropdown. Default `sortBy = by_submissions`, `page = 1`. | `forums.json` | P1 | [x] ✅ |
| 32 | `/forums/all` | GET | `/forums/all` | Flat A–Z list of every forum, no pagination | `forums.json` | P1 | [x] ✅ |

## 3. Submissions

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 33 | `/f/{forum_name}/{submission_id}/{slug}` | GET | `/f/:name/:id/:slug` | **Submission page + nested comment tree.** 57 of these are anchor routes. Slug is decorative — any slug (incl. `-`) resolves. | `submissions.json`, `comments.json` | **P0** || [x] ✅ |
| 34 | `/f/{f}/{id}/{slug}/{commentView}` | GET | same + `/nested` \| `/linear` | `commentView` ∈ `nested` (default) \| `linear`. Linear = flat, chronological. | ↑ | P1 || [x] ✅ |
| 35 | `/f/{f}/{id}.json` | GET | — | Submission JSON API | — | P3 (not migrated) | [ ] |
| 36 | `/{id}` | GET | `/:id` | **Submission shortcut** — bare numeric id redirects to the canonical submission URL | `submissions.json` | P2 || [x] ✅ |
| 37 | `/f/{f}/{id}/{slug}/comment/{comment_id}` | GET | same | **Comment permalink** — renders the submission with only that comment's subtree, plus a "view the rest of the comments" link. Anchor routes: `/f/books/59421/-/comment/1235250`, `/f/singularity/69404/-/comment/1042264`. Note the `-` slug form. `submission/comment.html.twig` calls the submission macro with **no options**, so this page carries **no `.submission__body`** (`submission--collapsed`) and **no `<h2>Comments</h2>`** — unlike #33. `#main` innerText verified identical to the source on both anchor routes. | `comments.json` | **P0** || [x] ✅ |
| 38 | `/f/{f}/{id}/comment/{comment_id}` | GET | same | Legacy permalink → **301** to `/f/{f}/{id}/-/comment/{comment_id}` (literal `-` slug, not the submission slug). Measured on the source for `/f/books/59421/…`, `/f/television/113998/…`, `/f/singularity/69404/…`. | — | P2 || [x] ✅ |
| 39 | `/f/{f}/{id}/{slug}/comment/{comment_id}.json` | GET | — | Comment JSON | — | P3 | [ ] |
| 40 | `/f/{f}/{id}/{slug}/edit` | GET, POST | same | **Edit submission** (title/url/body). Author-only. webarena-731 edits submission `1`'s body to append `EDIT: This news aged well`. | submissions state | **P0** | [x] ✅ |
| 41 | `/f/{f}/{id}/{slug}/delete` | POST | same | Delete own submission | submissions state | P1 | [x] ✅ |
| 42 | `/f/{f}/{id}/{slug}/mod_delete` | GET, POST | same | Moderator delete with reason | submissions state | P2 | [ ] |
| 43 | `/f/{f}/{id}/{slug}/purge` | POST | same | Hard delete | submissions state | P3 | [ ] |
| 44 | `/f/{f}/{id}/{slug}/restore` | POST | same | Restore from trash | submissions state | P3 | [ ] |
| 45 | `/f/{f}/{id}/{slug}/lock` · `/unlock` | POST | same | Lock/unlock comments (mod) | submissions state | P2 | [ ] |
| 46 | `/f/{f}/{id}/{slug}/pin` · `/unpin` | POST | same | Sticky on/off (mod) | submissions state | P2 | [ ] |
| 47 | `/f/{f}/{id}/{slug}/flair` | GET, POST | same | Add flair | — (0 flairs) | P3 | [ ] |
| 48 | `/f/{f}/{id}/{slug}/remove_flairs` | POST | same | Remove flairs | — | P3 | [ ] |
| 49 | `/submit` | GET, POST | `/submit` | **New submission form** — forum picker, URL / Image / Text tabs, title, body. | submissions state | **P0** | [x] ✅ |
| 50 | `/submit/{forum_name}` | GET, POST | `/submit/:name` | Same, forum pre-selected. This is the URL the "Submit" button in a forum sidebar points at. | submissions state | **P0** | [x] ✅ |
| 51 | `/sv/{id}` | POST | same | **Submission vote.** Also `/sv/{id}.json` (AJAX). Body carries the direction. | votes state | **P0** || [x] ✅ |

## 4. Comments

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 52 | `/f/{f}/{id}/{slug}/comment/{comment_id}` | POST | same | **Post a comment.** `comment_id` omitted ⇒ top-level; present ⇒ reply to that comment. Redirects to the **new comment's permalink** `/f/{f}/{id}/{slug}/comment/{new_cid}` (`CommentController.php:107`), `?sid=` preserved — webarena-650/651/652 read `.comment__body` on `url: "last"`. Comments on the submission page stay sorted `netScore DESC`; the redirect is what makes the new comment the first `.comment__body` on the landing page. | comments state | **P0** || [x] ✅ |
| 53 | `/comment_form/{forumName}/{submissionId}/{commentId}` | GET | same | HTML fragment for the inline reply box (progressive enhancement) | — | P2 | [ ] |
| 54 | `/f/{f}/{id}/{slug}/comment/{cid}/edit` | GET, POST | same | **Edit comment.** The `Edit` link in the comment action row is a plain `<a>` that **navigates** here — the source's `assets/js/commenting.js` hooks only `.comment__reply-link`, never `.comment__edit-link`, so there is no inline editor (TEST BUG-B03). 403 for a comment the user does not own. Saving redirects to `generateCommentUrl($comment)` = `/f/{f}/{id}/{slugify(title)}/comment/{cid}` — the REAL slug, exactly as creation (#52) does — `CommentController.php:145` + `AbstractController.php:71`; `?sid=` preserved (dev-fix-9; it was landing on the `-` slug). | comments state | **P0** | [x] ✅ |
| 55 | `/f/{f}/{id}/{slug}/comment/{cid}/delete_own` | POST | same | **Delete own comment** (soft) | comments state | **P0** | [x] ✅ |
| 56 | `/f/{f}/{id}/{slug}/comment/{cid}/delete` | GET, POST | same | Moderator delete (non-recursive) | comments state | P2 | [x] ✅ |
| 57 | `/f/{f}/{id}/{slug}/comment/{cid}/delete_thread` | GET, POST | same | Moderator delete, recursive | comments state | P2 | [x] ✅ |
| 58 | `/f/{f}/{id}/{slug}/comment/{cid}/purge` | POST | same | Hard delete | comments state | P3 | [ ] |
| 59 | `/f/{f}/{id}/{slug}/comment/{cid}/restore` | POST | same | Restore | comments state | P3 | [ ] |
| 60 | `/cv/{id}` | POST | same | **Comment vote** (+ `/cv/{id}.json`) | votes state | **P0** || [x] ✅ |

## 5. Users

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 61 | `/user/{username}` | GET | `/user/:name` | **Profile overview** — bio block (`.user-bio__biography`), join date, tabs. Anchor route for webarena-399..403. | `users.json`, `currentUser.json` | **P0** | [x] ✅ |
| 62 | `/u/{username}` | GET | same | Shortcut → 302 to #61 | — | P2 || [x] ✅ |
| 63 | `/user/{username}/submissions` | GET | same | Submissions tab | `submissions.json` | **P0** | [x] ✅ |
| 64 | `/user/{username}/comments` | GET | same | Comments tab | `comments.json` | **P0** | [x] ✅ |
| 65 | `/user/{username}/edit_biography` | GET, POST | same | **Edit bio form.** webarena-399..403 set it to `I am a robot` / `Pro Python Developer with 20 years of Experience` / `Seeking SDE positions` / `Freelance Web Developer` / `Awesome Prompt Artist`; evaluator then reads `.user-bio__biography` on `/user/MarvelsGrantMan136`. | currentUser state | **P0** | [x] ✅ |
| 66 | `/user/{username}/account` | GET, POST | same | Account settings — email, password, delete account | currentUser state | P1 | [x] ✅ |
| 67 | `/user/{username}/preferences` | GET, POST | same | **User settings** — locale, night mode, front page, front-page sort, timezone, thumbnails, previews, notifications, full-width, link destination, poppers | currentUser state | P1 | [x] ✅ |
| 68 | `/user/{username}/delete_account` | GET, POST | same | **Delete-account confirmation form** (not an empty state): the `delete_account.*` bullet list, the `flash.delete_account_warning` alert, `#confirm_deletion_name` (must equal the username) and `#confirm_deletion_confirm`. `@IsGranted("edit_user")` ⇒ 403 for anyone else. Linked from the `Delete this account` button on #66. Submit reproduces the controller's *response* — validate, flash `The account is being deleted.`, redirect to `/` — but never destroys the session user (deleting for real is Out of Scope; the source deletes asynchronously on a message bus). Validating form (no `novalidate`), both fields `required`, errors mirrored into `ul.form-error-list` (dev-fix-9). `#main`/`#sidebar` innerText diffed **identical** to the source. | — | P3 | [x] ✅ |
| 69 | `/user/{username}/block_list` `/…/{page}` | GET, POST | same | Blocked-user list. Empty state on a fresh seed; the `Username \| Blocked \| Comment \| Unblock` table is live and renders whatever #70 wrote. `/…/{page}` itself is not registered (matches the source's 404 for an out-of-range page). | `blockedUsers` state | P3 | [ ] ✅ |
| 70 | `/user/{username}/block_user` | GET, POST | same | **Block form** (not an empty state): `Blocking /u/{name}` heading, `help.blocking_users` info alert, `#user_block_comment`. Both `@Security` guards reproduced — blocking yourself and re-blocking someone already blocked are 403s (verified live). Submit appends to `blockedUsers`, flashes `The user was blocked.` and redirects to `/user/{self}/block_list`. Validating form (no `novalidate`); `UserBlockType` sets the only field `required: false`, so nothing is rejected (dev-fix-9). Linked from `Block user` in every other profile's Toolbox. `#main`/`#sidebar` innerText diffed **identical** to the source. | `blockedUsers` state | P3 | [x] ✅ |
| 71 | `/user/{username}/unblock_user` | POST | same | Unblock. POST-only, so no `<Route>`; the affordance is live as a `preventDefault`ed form in the profile sidebar and in the block-list table (same shape as #89). **Verified** end to end on the mock, both affordances: block → row on `/user/{self}/block_list` → re-block **403** and self-block **403** → unblock from the table, then again from the profile sidebar. `?sid=` intact throughout; `/go` `state_diff` moves to `["blockedUsers"]` and returns to `{}`. Form action `/user/{name}/unblock_user` matches `user/block_list.html.twig` exactly (the source keys this route by **username**, not by id); flashes `The user was blocked.` / `The user was unblocked.` match `messages.en.yml` verbatim; source redirects to the Referer, which is what the mock reproduces. | `blockedUsers` state | P3 | [ ] ✅ |
| 72 | `/user/{username}/hidden_forums` `/…/{page}` | GET | same | Hidden-forum list. Live: derived from `hiddenForums`, `Name \| Title \| (Delete)` table transcribed from `user/hidden_forums.html.twig` (the unhide button's label really is `action.delete` = `Delete`). Empty state on a fresh seed — `#main` innerText diffed **identical** to the source. `/…/{page}` itself is not registered (matches the source's 404 for an out-of-range page). | `hiddenForums` state | P3 | [x] ✅ |
| 73 | `/user/{username}/hide_forum/{forum}` · `/unhide_forum/{forum}` | POST | same | Hide/unhide a forum. POST-only, so no `<Route>`; the affordances are live `preventDefault`ed forms — `Hide`/`Unhide` in the forum sidebar's `Hide this forum` disclosure, and `Delete` in each #72 row. No flash (the source's `UserController::hideForum` adds none and redirects to the referer). | `hiddenForums` state | P3 | [x] ✅ |
| 74 | `/user/{username}/forum_bans` `/…/{page}` | GET | same | Forum bans against this user | — (empty) | P3 | [ ] |
| 75 | `/user/{username}/trash` | GET | same | User's trash. Live and correct: source returns **200** with `#main` = `Trash` / `There are no entries to display.`; the mock's `#main` is identical, under the same `UserSidebar` (`Toolbox · Hidden forums · Trash`). Linked from the profile Toolbox on both sides. | — | P3 | [ ] ✅ |
| 76 | `/user/{username}/whitelist` · `/dewhitelist` | POST | same | Admin trust toggle | — | P3 | [ ] |
| 77 | `/users` `/users/{page}` | GET | same | Site user list, paginated. **Observed 403 as `MarvelsGrantMan136`** — admin-only. Reproduce the 403. | `userDirectory.json` | P3 | [x] ✅ |
| 78 | `/notifications` `/notifications/{page}` | GET | same | Notification inbox | notifications state | P2 | [x] ✅ |
| 79 | `/inbox/{page}` | GET | same | Legacy → 302 to `/notifications` | — | P3 | [x] ✅ |
| 80 | `/clear_notifications` | POST | same | Clear all | notifications state | P2 | [x] ✅ |
| 81 | `/night_mode` (+`.json`) | GET, POST | same | Toggle light/dark/auto | currentUser state | P2 | [x] ✅ |
| 82 | `/_up/{username}` | GET | — | User-popper HTML fragment (hover card) | — | P3 | [ ] |
| 83 | `/registration` | GET, POST | — | **Not migrated** — mock boots pre-logged-in | — | — | [ ] |

## 6. Messages

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 84 | `/messages` `/messages/{page}` | GET | same | Message-thread list | messages state | P2 | [x] ✅ |
| 85 | `/messages/thread/{id}` | GET | same | One thread | messages state | P2 | [x] ✅ |
| 86 | `/user/{username}/compose_message` | GET, POST | same | Compose to a user | messages state | P2 | [x] ✅ |
| 87 | `/compose_message/{username}` | GET | same | Legacy → 302 to #86 | — | P3 | [x] ✅ |
| 88 | `/message_reply/{id}` | POST | same | Reply in thread | messages state | P2 | [x] ✅ |
| 89 | `/messages/message/{id}/delete` | POST | same | Delete a message (uuid). If it was the thread's last message the thread is removed and the redirect goes to `/messages`; otherwise back to the thread (`MessageController::delete()` :110-132). | messages state | P3 | [x] ✅ |

## 7. Search

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 90 | `/search?q=…` | GET | `/search` | **Search results.** Postgres full-text over `submissions.search_doc` / `comments.search_doc`. Client-side substring+token match in the mock. | `submissions.json`, `comments.json` | **P0** | [x] ✅ |
| 91 | `/opensearch.xml` | GET | — | OpenSearch descriptor | — | P3 (not migrated) | [ ] |

## 8. Tags, wiki, site admin

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 92 | `/tags` `/tags/{page}` | GET | same | Forum-tag index | — (0 tags ⇒ empty state) | P3 | [x] ✅ |
| 93 | `/tag/{name}` `/tag/{name}/{sortBy}` | GET | same | **Real listing** over the forums carrying the tag (`Criteria->showForums(...$tag->getForums())->excludeHiddenForums()`), with the tag name as `h1`, the sort + time dropdowns only (no tabs, no filter — same nav shape as a multireddit), the cursor pager, and a sidebar of the tag plus `Forums with this tag`. Tags are derived from `forums[].tags`, so a fresh seed has none and every `/tag/{name}` still 404s exactly as the source does; a tag created through `/create_forum` or `/f/{name}/edit` lands on `/tags` and its link now resolves here. `{sortBy}` outside `%submission_sort_modes%` 404s. | `forums`, `submissions` state | P3 | [x] ✅ |
| 94 | `/tag/{name}/edit` | GET, POST | same | Edit tag | — | P3 | [ ] |
| 95 | `/c/{name}/{sortBy}` | GET | same | Legacy → 302 to `/tag/…` | — | P3 | [ ] |
| 96 | `/wiki/{path}` (default `index`) | GET | same | Wiki page | wiki state | P2 | [x] ✅ |
| 97 | `/w/{path}` | GET | same | Shortcut → 302 | — | P3 | [x] ✅ |
| 98 | `/wiki/_create/{path}` · `_edit` · `_delete` · `_lock` · `_unlock` | GET/POST | same | Wiki CRUD | wiki state | P3 | [ ] |
| 99 | `/wiki/_all/{page}` · `_recent/{page}` · `_history/{path}/{page}` · `_diff` · `_revision/{id}` | GET | same | Wiki index / changes / history / diff / revision | wiki state | P3 | [ ] |
| 100 | `/site/settings` | GET, POST | same | Site-wide admin settings (admin-only; seeded user is **not** admin ⇒ 403) | — | P3 | [ ] |
| 101 | `/site/trash` | GET | same | Site-wide trash (admin) | — | P3 | [ ] |
| 102 | `/site/health_check` | GET | — | Health probe | — | P3 (not migrated) | [ ] |
| 103 | `/site/themes` `/…/{page}`, `/site/themes/css/*` | GET/POST | same | Theme manager (admin) | — | P3 | [ ] |
| 104 | `/site/bad_phrases*` | GET/POST | same | Bad-phrase filter admin | — | P3 | [ ] |
| 105 | `/bans` `/bans/*` `/banned` | GET/POST | same | Site ban admin / "you are banned" page | — | P3 | [ ] |
| 106 | `/ft.json` | POST | — | AJAX: auto-fetch a submission title from a URL | — | P3 (not migrated) | [ ] |

## 9. Auth — intentionally not migrated

| Source path | Method | Reason |
|---|---|---|
| `/login` | GET | Mock boots pre-logged-in as `MarvelsGrantMan136` (migration contract §1) |
| `/login_check` | POST | ↑ |
| `/login_url` | GET | ↑ |
| `/log_out` | * | ↑ |
| `/registration` | GET, POST | ↑ |
| `/reset_password`, `/reset_password/{id}/{expires}/{checksum}` | GET, POST | ↑ |

---

## Query Parameters

| Route family | Param | Values | Effect |
|---|---|---|---|
| all submission listings | `t` | `day` \| `week` \| `month` \| `year` \| `all` (default) | Filters on `submissions.timestamp > now() − interval`. Applied by `SubmissionFinder::addTimeClause`, **independent of the sort mode** (it applies to `new` too). The sort dropdown only *links* `t=day` from top/controversial/most_commented. ⚠ On the live corpus (latest submission 2023-03-31) every value except `all` returns **zero rows**. **Settable from the UI**: `ListNav` renders the source's `From: …` dropdown (`_macros/post_nav.html.twig :: submission_time`) whenever the URL carries `t` **or** the sort is top/controversial/most_commented; its links are the current path with `t` swapped (PARITY-002). |
| all submission listings | `next[<field>]` | cursor values | **Cursor pagination** (PagerWave), 25/page — *not* an offset. See the confirmed formats below. Presence of any `next` key is what makes `isOnFirstPage()` false. |
| all submission listings | `prev[<field>]` | cursor values | Backwards page (PagerWave), same shape |
| `/search` | `q` | free text | The query. Required. |
| `/f/{f}/{id}/{slug}` | — | — | `commentView` is a **path** segment (`/nested`, `/linear`), not a query param |
| `/forums/{sortBy}/{page}` | — | `by_name` \| `by_title` \| `by_subscribers` \| `by_submissions` (default) \| `by_creation_date` | Path segment, not a query param. `page` is a real offset page here (not a cursor). |
| `/{sortBy}`, `/f/{f}/{sortBy}` | — | `active` \| `hot` \| `new` \| `top` \| `controversial` \| `most_commented` | Path segment |
| `/night_mode.{_format}` | `_format` | `html` \| `json` | Suffix format |
| `/sv/{id}.{_format}`, `/cv/{id}.{_format}` | `_format` | `html` \| `json` | `html` = full page reload + redirect; `json` = XHR |
| every mock route | `sid` | task session id | **Mock-only**, additive. Must survive every redirect, form post, and programmatic navigation. |

### Cursor pagination — confirmed formats

Read verbatim off the live site's `rel="next"` links (`assets/html/f_news*.html`,
`assets/html/all.html`). The cursor fields are exactly the sort's ORDER BY
fields, passed as PHP-style array params (`next[field]=value`, URL-encoded
`next%5Bfield%5D`):

| Listing | `rel="next"` href, verbatim |
|---|---|
| `/f/news` (hot) | `/f/news?next%5Branking%5D=3396&next%5Bid%5D=65117` |
| `/f/news/new` | `/f/news/new?next%5Bid%5D=129880` |
| `/f/news/top` | `/f/news/top?next%5BnetScore%5D=3396&next%5Bid%5D=65117` |
| `/f/news/active` | `/f/news/active?next%5BlastActive%5D=2023-03-31T23%3A05%3A49%2B00%3A00&next%5Bid%5D=129463` |
| `/f/news/controversial` | `/f/news/controversial?next%5BnetScore%5D=0&next%5Bid%5D=23181` |
| `/f/news/most_commented` | `next%5BcommentCount%5D=…&next%5Bid%5D=…` |
| `/all` | `/all?next%5Branking%5D=22446&next%5Bid%5D=13128` |

The cursor value is the sort key of the **first row of the next page**; the query
is `WHERE (field, id) < (cursorField, cursorId)` for a descending sort and `>`
for `controversial`.

The visible control, verbatim:

```html
<nav class="pagination" role="navigation">
  <ul class="flex flex--guttered unlistify">
    <span class="flex__grow" aria-hidden="true"></span>
    <li class="next">
      <a href="http://localhost:9999/f/news?next%5Branking%5D=3396&amp;next%5Bid%5D=65117"
         class="button button--secondary"
         rel="next">
        More
      </a>
    </li>
    <span class="flex__grow" aria-hidden="true"></span>
  </ul>
</nav>
```

The button label is **`More`** (not "Next"). There is also a
`<link rel="next" href="…">` in `<head>`.

`/forums` is the exception — it uses **offset** pages as a path segment
(`/forums/by_submissions/2`, `<link rel="prev" href="/forums">`,
`<link rel="next" href="/forums/by_submissions/3">`).

Whatever the mock implements internally, it must **accept and ignore an
unrecognised `next[...]` param** rather than 404, so deep links survive.

---

## Anchor-route coverage

All 93 anchor routes from `assets/task_anchors.md` map onto rows above:

| Anchor shape | Count | Row |
|---|---|---|
| `/` | 1 (119 tasks) | #1 |
| `/f/<forum>` | 27 | #10 |
| `/f/<forum>/<id>/<slug>` | 57 | #33 |
| `/f/<forum>/<id>/-/comment/<cid>` | 2 | #37 |
| `/f/<forum>/edit` | 5 | #15 |
| `/user/MarvelsGrantMan136` | 1 | #61 |

The `|OR|` anchors (`/f/deeplearning |OR| /f/MachineLearning |OR| /f/singularity`,
etc.) are alternatives within a single task and are all covered by #10.

Six anchor paths **do not exist on the live source** and are documented in
`SOURCE.md` §"Forums referenced by anchors that do not exist":
`/f/games` (404 — no such forum; there is `gaming`), and
`/f/{Cyberpunk,sci_fi,PlantsForCatParents,Karaoke,cmu_lti}/edit`, which only
become reachable after the task creates the forum via `/create_forum` (row #30).

Lowercase anchor forms (`/f/earthporn`, `/f/machinelearning`,
`/f/washington`) rely on the case-insensitive redirect described in
`SOURCE.md` §5 — the mock must resolve `/f/:name` against
`normalized_name` (lowercased), then canonicalise.

---

## Redirects the mock reproduces

WebArena `url_match` evaluators compare the agent's **final** URL, so a source
302 the mock renders in place (or vice versa) silently fails a task even when
the two pages look identical. Every one of these was confirmed with
`curl -s -o /dev/null -w '%{http_code} %{redirect_url}'` against
<http://localhost:9999> logged in as `MarvelsGrantMan136`.

| Row | Source | Final URL | Mock |
|---|---|---|---|
| #5 | `/subscribed` → **302** `/featured` (only when `subscriptionCount == 0`) | `/featured` | Same. `FrontController::subscribed()` returns `redirectToRoute('featured', {sortBy})`, so `/subscribed/new` → `/featured/new` and `/subscribed/top` → `/featured/top`. `redirectToRoute()` rebuilds the URL from route params and therefore **drops the query string** — confirmed: `/subscribed/top?t=week` → `302 /featured/top`, no `t`. The mock matches, and re-attaches `?sid=` (mock-only bookkeeping that must survive every hop). Once the user subscribes to anything the redirect stops and `/subscribed` renders in place. `/subscribed/{bogus}` is a 404 from the route requirement, ahead of the redirect. |
| #1 | `/` — **no redirect** | `/` | `FrontController::front()` swaps the listing to `featured` *in place* when the front-page preference is `subscribed` and there are no subscriptions. The URL stays `/`. This is the asymmetry that makes #5 easy to get wrong. |
| #36 | `/{id}` → 302 canonical submission URL | `/f/{f}/{id}/{slug}` | Same |
| #38 | `/f/{f}/{id}/comment/{cid}` → 301 | `/f/{f}/{id}/-/comment/{cid}` — the target slug is the **literal `-`**, not the submission's slug (`/f/books/59421/comment/1235250` → `301 /f/books/59421/-/comment/1235250`; same for `/f/television/113998/…` and `/f/singularity/69404/…`) | Same. Was rendering in place until dev-fix-7 (TEST BUG-A1) — this row previously claimed a redirect the mock did not perform. |
| #52 | `POST /f/{f}/{id}/{slug}/comment[/{cid}]` → 302 the **new comment's** permalink | `/f/{f}/{id}/{slug}/comment/{new_cid}` (slug recomputed by `slugify(title)`, not the literal `-`) | Same, for top-level comments and replies. `CommentController::comment()` ends on `redirect(generateCommentUrl($reply))`. Load-bearing: webarena-650/651/652 evaluate `.comment__body` on `url: "last"`. **Comment EDIT (#54) redirects to the same URL shape** — `editComment` ends on the same `generateCommentUrl` call. |
| #89 | `POST /messages/message/{id}/delete` → 302 | `/messages` when the deleted message was the thread's last (the thread is removed too); otherwise back to `/messages/thread/{id}` | Same. `MessageController::delete()`. |
| #62 | `/u/{username}` → 302 | `/user/{username}` | Same |
| #79 | `/inbox/{page}` → 302 | `/notifications` | Same |
| #87 | `/compose_message/{username}` → 302 | `/user/{username}/compose_message` | Same |
| #97 | `/w/{path}` → 302 `/wiki/{path}` (which then misses) | `/wiki/{path}` | Mock renders the miss page directly — same terminal state, one hop shorter |

---

## Out-of-range pagination

Postmill pages these with Pagerfanta / PagerWave, which raise
`NotFoundHttpException` for a page past the end. All confirmed live:

| Path | Source | Mock |
|---|---|---|
| `/messages/2` | 404 | 404 |
| `/notifications/2` | 404 | 404 |
| `/f/news/moderators/2` | 404 | 404 |
| `/moderation_log/{0,2}` | 404 | 404 |
| `/forums/by_submissions/99` | 404 | 404 |
| `/tags/2` | 404 | 404 |

The rule in the mock is `page > 1 && items.length === 0 ⇒ <NotFound />`, which
degrades correctly as the seed grows. Cursor-paginated **submission** listings
are different — an unrecognised `next[...]` is accepted and ignored, never
404ed (see "Cursor pagination" above).

---

## Discovery routes — deliberate deviations from the source

Confirmed against the live source while implementing rows #7, #8, #13, #14, #31,
#32, #54–#57, #90, #92, #93, #96, #97.

| Row | Source behaviour | Mock behaviour | Why |
|---|---|---|---|
| #8 `/trash` | 302 → `/login` for anonymous; scoped to forums the user moderates | Renders the real page (`Trash` + moderator nav + `help.front_trash` alert + the trashed items in forums the session user moderates, else the empty state) | The mock has no auth; the seeded user moderates nothing, so it boots empty exactly as the source would show it |
| #55 `delete_own` | **POST only** — a GET returns 405 | Renders a confirmation page carrying `prompt.confirm_comment_delete` and a Delete button | The mock cannot POST. Dead-ending an agent on a URL it legitimately constructed is worse than the divergence |
| #56/#57 `delete` / `delete_thread` | `mod_delete` voter → 403 for a non-moderator | Same 403 shell (`403 Forbidden` + `Go to home page`), and the real form once the user moderates the forum | Matches the source for `MarvelsGrantMan136`, unlocks after `/create_forum` |
| #90 `/search` | Postgres full-text + `ts_headline` `<mark>` highlighting, capped at 50 results | Token-AND case-insensitive substring over submission `title`+`body` and comment `body`; submissions listed before comments, capped at 50 | No server. **Highlighting IS reproduced as of the P2 polish round** (`src/utils/searchHighlight.js`) — measured 2026-08-07: source `<h2>32 results for <em>bookshop.org</em>:</h2>` + 37 `<mark>`s over `bookshop.org`/`Bookshop.org`; mock `<h2>11 results for <em>bookshop.org</em>:</h2>` + 13 `<mark>`s over the same two casings, confined to `.submission__link` and result-body `<p>`, with **0 `<mark>` on submission pages**. The 32→11 count gap is the curated seed. No evaluator anchors on `/search` |
| #93 `/tag/{name}` | Hard 404 while 0 tags exist; a real listing once one does | Same — 404 until a forum carries the tag, then the source's listing | Do not fabricate tags. The 404 is now a *consequence* of the empty tag set, not a hard-wired `<NotFound />`, so a tag the agent creates through the forum-edit UI resolves instead of dead-ending |
| #96 `/wiki/{path}` | HTTP 404 with the wiki's own in-layout miss page — `/wiki`, `/wiki/index` and `/wiki/<anything>` all miss. `#main` also carries a **`Create this page`** link (→ `/wiki/_create/index`) and `#sidebar` carries **`Navigation` · `All pages` · `Recent changes` · `Create new page`** (→ `/wiki/_all`, `/wiki/_recent`, `/wiki/_create`, all 200 on the source) | The miss **body only** — `Page not found` / `The requested page was not found.` The four wiki-navigation links and the sidebar are **not** rendered, and rows #98/#99 are not implemented | Do not fabricate wiki pages. Omitting the links keeps them from dead-ending, but it is a divergence, not parity — see F-GAPS-004 (P2) in `TEST.part-gaps.md`. 0 of 129 tasks touch the wiki |
| #97 `/w/{path}` | 302 → `/wiki/{path}`, which then misses | Renders the miss page directly | Same terminal state, one hop shorter |

`/forums` (#31) uses **offset** paging (`/forums/by_submissions/2`) and a fully
numbered pager with `Previous` / `Next`; the last page renders a **disabled
`<button>`** for `Next`, matching `/forums/by_submissions/4` on the source.
All five orderings were diffed row-for-row against the captures and match on
every one of the 25 rows.

---

## Intentionally Not Migrated

| Source path | Reason |
|---|---|
| `/login`, `/login_check`, `/login_url`, `/log_out`, `/registration`, `/reset_password*` | Mock boots pre-logged-in (migration contract) |
| `*.atom` feeds, `/opensearch.xml` | Non-HTML surfaces, no task touches them |
| `*.json` API variants of submission/comment reads | Server API; the mock has no server |
| `/ft.json` (auto-fetch title) | Requires an outbound network call — forbidden |
| `/site/health_check` | Infrastructure probe |
| `/_up/{username}` | Server-rendered hover-card fragment; render the popper client-side instead |
