# webarena_reddit_mock Schema

Mock of the WebArena **Reddit (Postmill)** site, `http://<host>:9999`,
container `forum`, image `postmill-populated-exposed-withimg:latest`.

> Re-derived from the code and re-measured against a running server on
> 2026-08-07, then **re-verified in full after the markdown/search/preview
> round** (which changed `src/utils/markdown.js`, `src/utils/searchHighlight.js`,
> `SubmissionPage.jsx`, `SubmitPage.jsx`, `CreateForumPage.jsx`,
> `EditBiographyPage.jsx`, `Comment.jsx` and added `MarkdownPreview.jsx` —
> none of which writes state), and **re-measured a third time after the
> data-only seed round** (which added 14 submissions, 88 comments, 38
> `userDirectory` entries and 4 images to `src/data/` and changed no code).
> Every size, count and contract statement below was reproduced with a live
> `curl` / chromium call on a fresh sid, not transcribed from a previous
> revision of this file.

**Base URL**: `http://localhost:<port>/`
**Go Endpoint**: `GET /go?sid=<sid>` → `{initial_state, current_state, state_diff}`
**Inject**: `POST /post?sid=<sid>` with body `{"action":"set","state":{...}}`
**Update**: `POST /post?sid=<sid>` with body `{"action":"set_current","state":{...}}`
**Reset**: `POST /post?sid=<sid>` with body `{"action":"reset"}`
**State read**: `GET /state?sid=<sid>` → `{stored_state, has_custom_state, sid}`
**Uploads**: `POST /upload?sid=<sid>` (multipart) → `/files/<sid>/<name>`

The app boots pre-logged-in as `MarvelsGrantMan136` (user id `13915`). There is
no login, logout or registration surface.

Implementation: `vite.config.js:173-260` (`/post`, `/state`, `/go`),
`src/utils/dataManager.js`, `src/context/AppContext.jsx`.

---

## State API contract

Five behaviours differ from the shared `websites/mixpanel_mock` template that
every hub mock is copied from. All five are deliberate, and all five were
re-measured on 2026-08-07 against a fresh sid — twice, the second time after
the seed grew, on run-unique sids each time. None of the five changed.

| Behaviour | Contract | Measured |
|---|---|---|
| **`set_current` never writes the baseline** | `{"action":"set_current"}` writes **`.mock-states/<sid>.json` only** and never `<sid>.initial.json` (`vite.config.js:212-227`). Only `{"action":"set"}` establishes a baseline, and only the first time (`writeInitialStateIfMissing`). A harness that wants a custom baseline **must** seed with `{"action":"set", "state":{…}}`; seeding with `set_current` leaves the baseline at `createInitialData()`. | `POST set_current` on a never-seeded sid produced `<sid>.json` and **no** `<sid>.initial.json` on disk |
| **`/go` on a never-seeded sid baselines against the pristine seed** | `initial_state` is `createInitialData()` (`vite.config.js:255`, `const initial = initialState \|\| defaultState`; the template's `\|\| currentState` fallback is deliberately absent). That is byte-for-byte what the client boots from, so the two agree by construction and the **first** mutation on a fresh sid appears in `state_diff`. | fresh sid + one `set_current` writing `hiddenForums:["books"]` → `initial_state.hiddenForums` `[]`, 16 top-level keys, `state_diff` keys `["hiddenForums"]` |
| **`reset` on a never-seeded sid** | Returns `{"success":true,"sid":…,"message":"State cleared."}` — there is no `.initial.json` to restore from, so it deletes whatever exists. On a **seeded** sid it returns `"State reset to initial."` and restores `<sid>.json` from `<sid>.initial.json`. Both are correct; only the message differs. | `{"success":true,"sid":"freshaud…","message":"State cleared."}` |
| **The client does not POST on boot** | Cold load posts **nothing** (`AppContext.jsx:114-119` — the post-commit persist effect skips the first committed state via `bootSeatedRef`). So until the first mutation: `.mock-states/<sid>.json` does not exist, and `GET /state?sid=<sid>` returns `{"stored_state":null,"has_custom_state":false}`. `GET /go?sid=<sid>` still works — it falls back to the pristine seed on both sides and returns an empty `state_diff`. | `/state` on an unused sid → `{"stored_state":null,"has_custom_state":false,"sid":"…"}`; `.mock-states/` had no file for it |
| **`set_current` replaces, it does not merge** | `const newState = data.merge ? deepMerge(currentState, data.state) : data.state`. The client always POSTs the *whole* state, so this is safe in normal use — but a hand-written `set_current` carrying two keys will truncate the session to those two keys unless it also sends `"merge": true`. | `set_current` with `{"hiddenForums":["books"]}` left `.mock-states/<sid>.json` at 39 bytes |

**localStorage is single-sid.** `initializeData()` calls
`evictForeignSessions(sid)` (`dataManager.js:98-115`), dropping every
`webarena_reddit_mock_*` key that does not belong to the current sid before
writing. One sid's two keys are **4,499,762 chars** (2 × 2,249,832 plus the two
key names) against a measured Chrome per-origin quota of **5,242,880 chars**
(exactly 5 MiB, counted in UTF-16 code units over key + value), so without
eviction a browser context reused across rollouts could not boot a second sid at
all. Eviction makes sequential sids work indefinitely, and **the
server mirror at `.mock-states/<sid>.json` remains authoritative** — an evicted
sid re-hydrates from `GET /state` on reload, losing nothing. Every
`localStorage.setItem` in `initializeData()` additionally goes through
`safeSetItem` (`dataManager.js:84-87`), so a quota error degrades persistence
instead of leaving the page stuck on `Loading…`.

> **Quota headroom — read this before growing the seed.** Measured 2026-08-07 by
> binary-searching a filler key in a booted page: **743,103 chars free**
> (~14.2% of the quota) with one sid seated. Because `initializeData()` writes
> the seed **twice** (`_state_` and `_initial_state_`), every character added to
> `createInitialData()` costs two, so the seed can grow by at most **~371,500
> chars (~16.5%)** before the second `setItem` starts failing. The seed round
> that added 88 comments / 14 submissions / 38 directory entries cost 31,766
> chars (+1.43%) and burned ~63,500 chars of headroom — roughly 8% of what was
> left. Failure is graceful (`safeSetItem` swallows it, the server mirror at
> `.mock-states/<sid>.json` stays authoritative, the page still boots), but a
> sid that exceeds it stops persisting across reloads on the client side.
> Re-measure this number after any seed growth.

**Hardened mode (`CUA_GYM_HARDENED=1`) does not inject.** See the fleet-wide
note in `AUDIT.md`: `shared/secureMockApiPlugin.mjs` `handleState` returns the
raw state object, while `fetchCustomState` (`dataManager.js:31-40`) requires
`{has_custom_state, stored_state}`. Under `__cua_session__` the injected state
is silently discarded and the app boots the pristine seed. Normal `?sid=` usage
is unaffected — that path is served by `vite.config.js`'s own `/state`, which
returns the correct envelope.

---

## State Schema

16 top-level keys. `createInitialData()` (`dataManager.js:45-72`) serializes to
**2,249,832 JS characters / 2,255,246 UTF-8 bytes** (re-measured 2026-08-07 off
a live `GET /go` on a never-seeded sid, after the data-only seed round; the
pre-seed figure was 2,218,066 chars / 2,223,403 bytes, so the seed grew by
31,766 chars / +1.43%). `GET /go` returns **4,510,543 bytes**.

| Key | Type | Description |
|-----|------|-------------|
| `currentUser` | object | The logged-in user's row, all 24 real preference fields: `{id, username, email, created, admin, biography, locale, nightMode, timezone, frontPage, frontPageSortMode, showCustomStylesheets, trusted, openExternalLinksInNewTab, autoFetchSubmissionTitles, enablePostPreviews, showThumbnails, notifyOnReply, notifyOnMentions, preferredFonts, allowPrivateMessages, poppersEnabled, fullWidthDisplayEnabled, submissionLinkDestination}`. Mutable: `biography`, `username`, every preference, `nightMode`. |
| `forums` | array | 95 real forums. Each: `{id, name, title, sidebar, description, created, featured, submissionCount, subscriberCount, moderationLogPublic}` plus optional, **written only by mock UI actions**: `{tags[], moderators[], suggestedTheme, backgroundImageMode, lightBackgroundImage, darkBackgroundImage}`. `name` is the `/f/<name>` path segment and is **case-preserved**; lookup is case-insensitive against `name.toLowerCase()` (`AppContext.jsx:148-152`). Mutable: `title`/`description`/`sidebar`/`tags`/`moderationLogPublic` (forum edit), `name` (rename — carries `submissions[].forum`, `subscriptions`, `moderatorOf`, `hiddenForums` with it), `suggestedTheme`/`backgroundImageMode`/background images (appearance), `moderators`, `subscriberCount`, `submissionCount`; appended by `/create_forum`; removed by `/f/<name>/delete`. |
| `submissions` | array | 2,359 real submissions. Each: `{id, forum, author, title, timestamp, lastActive, ranking, netScore, commentCount, slug}` plus optional `{url, body, bodyTruncated, image, imageWidth, imageHeight, userFlag, editedAt, sticky, locked}`. `ranking` drives `hot` and is **not** an alias of `netScore`. `title` is stored HTML-escaped and rendered as a text node (never through `renderMarkdown`). Mutable: `title`/`url`/`body` + `editedAt` (edit), `netScore` (vote), `commentCount`, `lastActive`; appended by `/submit`; removed on delete. |
| `comments` | array | 2,593 real comments. Each: `{id, submission, author, body, netScore, timestamp}` plus optional `{parent, userFlag, editedAt, bodyTruncated, visibility}` and, on a moderator trash, `{trashReason, trashedBy, trashedAt}`. `visibility` is absent/`"visible"`, `"soft-deleted"` (own delete with replies) or `"trashed"` (moderator delete — the only thing that can fill `/trash`). Absent `parent` ⇒ top-level; arbitrary nesting depth. Mutable: `body` + `editedAt` (edit), `netScore` (vote), `visibility` (+ trash fields); appended by reply. |
| `users` | array | 70 "rich" users. Each: `{id, username, created, biography?, admin?, submissionCount, commentCount, negativeCommentCount}` — counts are **real site-wide** numbers, not seed counts. Mutable: `biography` for the current user; `username` on an `/account` rename. |
| `userDirectory` | object | `{ "<username>": "YYYY-MM-DD" }` join dates for all 3,899 authors in the seed, so every author link resolves. Mutable: the current user's key is re-keyed by an `/account` rename. |
| `votes` | object | `{submissions: {"<id>": 1 \| -1}, comments: {…}}` — the current user's vote map. Seeded with the single real pre-existing vote, `submissions: {"1": 1}`. Scores are stored on the entity, **not** derived from this map. |
| `subscriptions` | array | Forum **names** the user is subscribed to. Starts empty (the source has 0 rows in `forum_subscriptions`). Drives `/subscribed`, the front page, and the `#sidebar > section` on `/`. |
| `moderatorOf` | array | Forum names the user moderates. Starts empty; grows when the user creates a forum, which is what unlocks `/f/<name>/edit`. |
| `hiddenForums` | array | Forum names hidden from the `featured` / `all` listings. Written by the "Hide this forum" `<details>` in every forum sidebar and read back by `/user/<name>/hidden_forums`. |
| `blockedUsers` | array | Blocked-user rows. Starts empty. Canonical shape `{username, timestamp, comment}`; a bare `"username"` string is also accepted on inject and normalised on read by `normalizeBlocks()` (`AppContext.jsx:35-41`), so either form is safe to inject. |
| `notifications` | array | Notification inbox. Starts empty and **nothing in the app creates a notification** — inject them to exercise `/notifications`. Each (as consumed by `NotificationsPage`): `{id, type: "comment"\|"mention"\|…, comment?: <commentId>, submission?: <submissionId>, timestamp?}`. Shrinks via "Clear" (one) and "Clear all" (empties). |
| `messages` | array | Private-message threads. Starts empty; grows only via the UI. Each: `{id: <uuid>, participants: [<username>, <username>], messages: [{id: <uuid>, sender, body, timestamp}]}`. A thread whose `messages` becomes empty is dropped from the array. |
| `nextSubmissionId` | number | `200000` — above every real id (max real is `137402`). |
| `nextCommentId` | number | `3000000` — above every real comment id (max real is `2557260`). |
| `nextForumId` | number | `20000` — above every real forum id (real range `10000`–`10094`). |

**Not in state:** `src/data/images.json` is a static asset manifest of **769
entries** (`{filename: {w, h, full, thumb1x, thumb2x}}`), one per image-bearing
submission, imported directly by components. Putting it in state would inflate
every `/go` diff for no reason — and would push localStorage past its quota.

**Derived at render, never stored:** sort orders, the comment tree, search
results and `<mark>` highlighting, relative timestamps, pagination cursors,
`collectTags()`'s tag index.

### Key identifiers to reference in tasks

- Current user: `MarvelsGrantMan136` (id `13915`), seeded bio `t2_5adwlxvn`
- Anchored submission: `1` (`/f/MachineLearning/1/nvidia-rtx-4090`, upvoted at boot, 0 comments)
- Deep comment trees: `13170` (IAmA), `59421` (books), `69404` (singularity)
- Anchored comments: `1235250` (on `59421`), `1042264` (on `69404`)
- Forums: 95, ids `10000`–`10094`, e.g. `news`, `books`, `MachineLearning`, `EarthPorn`
- Anchored locator: `.user-bio__biography` on `/user/MarvelsGrantMan136` (webarena-399..403)

## Minimal Inject Example

```json
{
  "action": "set",
  "state": {
    "currentUser": {
      "id": 13915,
      "username": "MarvelsGrantMan136",
      "biography": "t2_5adwlxvn",
      "nightMode": "light",
      "frontPage": "subscribed",
      "frontPageSortMode": "hot",
      "showThumbnails": true,
      "submissionLinkDestination": "url"
    },
    "subscriptions": ["books"],
    "votes": { "submissions": { "1": 1 }, "comments": {} },
    "moderatorOf": [],
    "hiddenForums": [],
    "blockedUsers": [],
    "notifications": [],
    "messages": [],
    "nextSubmissionId": 200000,
    "nextCommentId": 3000000,
    "nextForumId": 20000
  }
}
```

Keys omitted from an injected state fall back to the seeded defaults —
`initializeData()` merges `createInitialData()` underneath
(`dataManager.js:117-124`) — so a task only needs to send the fields it wants to
change. Note this merge happens **client-side**: the server stores exactly what
you POST, so `/go`'s `initial_state` for a partial `set` is that partial object,
while the running app sees the merged one.

---

## Observable State Changes (for LLM evaluation)

Every row below reaches `saveState()` → `POST /post {action:'set_current'}` →
`/go` `state_diff`. Reducer names in parentheses are exported from
`AppContext.jsx`.

| User Action | State Field Changed |
|-------------|---------------------|
| Click ▲ on a submission (`div.submission__vote form`) — `vote('submission', id, 1)` | `votes.submissions["<id>"]` set to `1`; `submissions[i].netScore` +1 (or +2 when flipping a downvote). Form class becomes `vote vote--user-upvoted`. |
| Click ▼ on a submission — `vote('submission', id, -1)` | `votes.submissions["<id>"]` set to `-1`; `netScore` −1 / −2. Form class becomes `vote vote--user-downvoted`. |
| Click the already-active arrow (retract) | `votes.submissions["<id>"]` **deleted**; `netScore` returns to its previous value. Form class becomes `vote`. |
| Vote on a comment (`/cv/<id>`) — `vote('comment', …)` | Same, on `votes.comments["<id>"]` and `comments[i].netScore`. |
| Subscribe from a forum sidebar — `subscribe(name)` | `subscriptions` grows with the forum name; `forums[i].subscriberCount` +1. A "Subscribed forums" section appears as the **first** `#sidebar > section` on `/`, and `/` stops being empty. |
| Unsubscribe — `unsubscribe(name)` | `subscriptions` shrinks; `forums[i].subscriberCount` −1. |
| Create a submission via `/submit` or `/submit/<forum>` — `createSubmission(…)` | `submissions` grows with `{id: nextSubmissionId, author: "MarvelsGrantMan136", netScore: 1, commentCount: 0, ranking: <epoch seconds>, timestamp = lastActive = now, slug: slugify(title)}` (+ `url` / `body` / `image`+`imageWidth`+`imageHeight` / `userFlag` when supplied); `votes.submissions["<newId>"] = 1`; `nextSubmissionId` +1; `forums[i].submissionCount` +1. The browser then navigates to `/f/<forum>/<id>/<slug>` — the URL `func:reddit_get_post_url('__last_url__')` reads. |
| Edit a submission — `editSubmission(id, updates)` | `submissions[i].{title,url,body}` updated; `submissions[i].editedAt` set to now. |
| Delete own submission — `deleteSubmission(id)` | `submissions` shrinks; that submission's `comments` removed; `forums[i].submissionCount` −1. |
| Post a top-level comment — `addComment({submission, body})` | `comments` grows with `{id: nextCommentId, netScore: 1, submission: <id>}` and **no** `parent`; `nextCommentId` +1; `submissions[i].commentCount` +1 and `lastActive` bumped; `votes.comments["<newId>"] = 1`. |
| Reply to a comment — `addComment({…, parent})` | Same, with `parent: <that comment's id>`. |
| Edit own comment — `editComment(id, body)` | `comments[i].body` updated; `comments[i].editedAt` set. |
| Delete own comment (`…/comment/<cid>/delete_own`) — `deleteComment(id)` | Leaf: removed from `comments`, `submissions[i].commentCount` −1. Has replies: `body` and `author` become `[deleted]` and `visibility` becomes `"soft-deleted"`; the node and the count stay. |
| **Trash a comment as a moderator** (`…/comment/<cid>/delete`) — `trashComment(id, reason)` | `comments[i].visibility` becomes `"trashed"`, plus `trashReason` (the Reason box; empty ⇒ `null`), `trashedBy` (current username) and `trashedAt` (ISO now); `submissions[i].commentCount` −1. The node stays in the array so `/trash` can list it, but `commentsFor()` filters it out of the tree. **Idempotent** — trashing an already-trashed comment is a no-op. `AppContext.jsx:383-403` is the only writer of `visibility: "trashed"`. |
| Trash a comment thread (`…/comment/<cid>/delete_thread`) | Same, applied to the comment **and every descendant**, each with the same `trashReason` (`DeleteCommentPage.jsx` recurses into `trashComment`). |
| Create a forum via `/create_forum` — `createForum(…)` | `forums` grows with `{id: nextForumId, submissionCount: 0, subscriberCount: 1, featured: false, created: now}`; `moderatorOf` and `subscriptions` grow with the name; `nextForumId` +1. A non-empty Tags field triggers a second write setting `forums[i].tags` to the whitespace/comma-split list, which is what makes the forum appear on `/tags` and `/tag/<tag>`. |
| Edit a forum via `/f/<name>/edit` — `editForum(name, updates)` + a direct `setState` on rename | `forums[i].{title,description,sidebar,tags,moderationLogPublic}` updated. **Renaming** also rewrites `submissions[].forum`, `subscriptions`, `moderatorOf` and `hiddenForums` from the old name to the new one, then redirects to the renamed forum. |
| Save Appearance on `/f/<name>/appearance` | `forums[i].suggestedTheme` (or `null`) and `forums[i].backgroundImageMode` (`"tile"` \| …); an uploaded file goes through `POST /upload` and lands in `forums[i].lightBackgroundImage` / `darkBackgroundImage` as a `/files/<sid>/<name>` URL. |
| Remove a moderator on `/f/<name>/moderators` | `forums[i].moderators` shrinks (via `editForum`). If the removed user is the current user, `moderatorOf` also drops that forum — which re-locks `/f/<name>/edit`. Flash: "The user was unmodded." |
| Delete a forum via `/f/<name>/delete` (type the name + confirm) | `forums` loses the row; every submission in it is removed from `submissions`; all their comments are removed from `comments`; the name is dropped from `subscriptions`, `moderatorOf` and `hiddenForums`. Redirects to `/`. The single largest `state_diff` of any control. |
| Edit biography via `/user/<name>/edit_biography` — `updateBio(text)` | `currentUser.biography` updated **and** `users[i].biography` mirrored. Immediately visible in `.user-bio__biography` on `/user/MarvelsGrantMan136` — the webarena-399..403 locator. Flash "The biography was updated.", redirect to `/user/<name>?sid=…`. |
| Change a preference on `/user/<name>/preferences` — `updatePreferences(updates)` | The matching `currentUser.<field>` updated. Changing `frontPage` / `frontPageSortMode` changes what `/` renders; `fullWidthDisplayEnabled` toggles `<html class="full-width">`. |
| Change the username on `/user/<name>/account` (`renameUser`, a direct `setState`) | `currentUser.username`, the matching `users[i].username`, the `userDirectory` key (re-keyed, old key deleted), and **every** `submissions[].author` and `comments[].author` equal to the old name. Then redirects to `/user/<new>/account`. ⚠️ This rewrites author strings across the entire seed — expect `state_diff` to contain `submissions` and `comments` in full (~2.25 MB). |
| Submit `/user/<name>/account` **at all** — `updateAccount({email})` (an alias of `updatePreferences`) | `currentUser.email` is written on **every** submit of that form, before the rename check, so a submit that changes nothing still puts `currentUser` in `state_diff` (`null` when the field is blank). The password fields are validated client-side (match, ≥8 chars) but **write no state** — the mock stores no password. Flash: "Your password has been updated." when a password was typed, otherwise "User settings have been updated." |
| Toggle night mode from the user menu, or `GET /night_mode?nightMode=<light\|dark\|auto>` — `setNightMode(mode)` | `currentUser.nightMode` set; `<html data-night-mode>` follows. The query-param route applies the mode and redirects back to the referrer. |
| **Hide a forum** from its sidebar ("Hide this forum" `<details>` → `Hide`) — `hideForum(name)` | `hiddenForums` grows with the forum name; the forum drops out of `/all` and `/featured`, and a row appears in the `Name \| Title \|` table on `/user/<name>/hidden_forums`. **No flash** — `UserController::hideForum` adds none, it just redirects to the referer. |
| **Unhide a forum** from `/user/<name>/hidden_forums` — `unhideForum(name)` | `hiddenForums` shrinks; the row disappears and the table reverts to "There are no entries to display." The button is labelled **`Delete`** (`action.delete` in the source's Twig), not "Unhide". No flash. |
| **Block a user** (`/user/<name>/block_user`) — `blockUser(username, comment)` | `blockedUsers` grows with `{username, timestamp: nowIso(), comment}` (the optional Reason box; empty ⇒ `""`). Duplicate blocks are a no-op. Flash "The user was blocked."; redirects to `/user/<me>/block_list`. Blocking yourself is a `403 Forbidden`, as on the source. |
| **Unblock** — `unblockUser(username)`, from **two** surfaces: the `/user/<me>/block_list` table and the `Unblock` button that replaces "Block user" in the sidebar of a blocked user's `/user/<name>` page (`UserSidebar.jsx:104`) | `blockedUsers` shrinks. Flash "The user was unblocked." |
| Clear one notification / Clear all (`/notifications`) | One: that entry is filtered out of `notifications` (direct `setState`). All: `notifications` emptied (`clearNotifications`). Nothing in the app ever *adds* a notification — inject them. |
| **Compose a message** (`/user/<name>/compose_message`) | `messages` grows with one thread: `{id: <uuid>, participants: [me, them], messages: [{id: <uuid>, sender: me, body, timestamp}]}`. Redirects to `/messages/thread/<uuid>`. |
| **Reply in a thread** (`/messages/thread/<id>`) | `messages[i].messages` grows with `{id: <uuid>, sender: me, body, timestamp}`. |
| **Delete a message** (thread page, `form.message__buttons`) | That message is filtered out of `messages[i].messages`; a thread left with zero messages is dropped from `messages` entirely. Fires a `window.confirm` first — an automated driver must accept the dialog. No flash (the source has none). |
| Confirm account deletion (`/user/<name>/delete_account`) | **No state change.** The source hands the deletion to an async message-bus worker the mock does not have; it flashes "The account is being deleted." and redirects to `/`. Client-side validation of the typed username + confirm checkbox is real. |
| Sort, filter by `?t=`, paginate with `next[...]`, search | **No state change** — all derived at render from the seed. |
| Collapse a comment (Hide/Unhide) | **No state change** — pure CSS `:checked` toggle, as in the source. |
| Type into a markdown field (`/submit` body, `/create_forum` sidebar, the comment form, the reply form, `edit_biography`) | **No state change.** Five forms carry a live `.markdown-preview` pane (`src/components/MarkdownPreview.jsx`), which re-renders on every keystroke from local React state. The pane carries the HTML `hidden` attribute while the rendered output is empty, so it contributes nothing to `document.body.outerText` on a cold form. Do not wait for a `state_diff` while typing — it arrives only on submit. |
| Open a dropdown, expand "Formatting help", type in the search box | **No state change** — local React state only. |

### How to read `state_diff`

`calculateStateDiff` (`vite.config.js:89-97`) is a **top-level-key**
`JSON.stringify` comparison. Every row above therefore surfaces as one or more
of the 16 top-level keys, with `{old, new}` holding the *whole* array/object,
not a path-level delta. Three consequences worth knowing when writing
evaluators:

- A mutation that returns a key to its baseline value (unsubscribe after
  subscribe, unhide after hide, delete the only message after composing it)
  **leaves the diff entirely.** Measured: hide `books` → `state_diff` keys
  `["hiddenForums"]`; unhide it again → `state_diff` keys `[]`. Assert on
  `current_state` for round-trips, not on `state_diff`.
- Any write that reaches `saveState()` is in `state_diff` by construction, so
  "the action worked but the diff is empty" almost always means the above.
- **Seeding with `{"action":"set", …}` first is a recommendation, not a
  requirement.** It used to be mandatory: `set_current` established the
  baseline, so on a never-seeded sid the *first* mutation was folded into
  `initial_state` and silently vanished (AUDIT PIPELINE-001). That is fixed — a
  never-seeded sid baselines against `createInitialData()`, and a
  single-mutation rollout diffs correctly. Seed anyway when the task needs the
  baseline to be the *task's* starting state rather than the pristine seed —
  e.g. a task that begins with subscriptions or notifications already present,
  where diffing against the pristine seed would report those as agent-caused
  changes.

### Mutations that bypass the AppContext reducers

Most writes go through a named reducer in `AppContext.jsx` (`vote`, `subscribe`,
`createSubmission`, `addComment`, `trashComment`, `createForum`, `editForum`,
`updateBio`, `hideForum`, `unhideForum`, `blockUser`, `unblockUser`,
`clearNotifications`, …). **Seven pages instead mutate state directly**, calling
the context's raw `setState` with their own updater.

They are fully observable — every one reaches `saveState` → `POST /post` → `/go`
`state_diff`, and `calculateStateDiff` is a top-level-key comparison, so a
`setState`-routed write cannot be invisible. But **there is no `sendMessage` /
`replyMessage` / `deleteMessage` / `renameUser` / `deleteForum` / `renameForum`
reducer to grep for.** This is a real inconsistency in the codebase: reading
`AppContext.jsx` alone will not tell you that private messages, forum deletion,
forum rename, moderator self-removal, username rename or single-notification
clear exist at all. Treat this table as part of the mutation surface, not as a
list of second-class writes.

| Page | `setState` at | Keys written |
|---|---|---|
| `ComposeMessagePage.jsx` | 61 | `messages` (new thread) |
| `MessageThreadPage.jsx` | 61, 78 | `messages` (reply, delete) |
| `ForumDeletePage.jsx` | 59 | `forums`, `submissions`, `comments`, `subscriptions`, `moderatorOf`, `hiddenForums` |
| `ForumEditPage.jsx` | 85 | `forums`, `submissions`, `subscriptions`, `moderatorOf`, `hiddenForums` (rename path only) |
| `ForumModeratorsPage.jsx` | 69 | `moderatorOf` (self-unmod; the `forums[i].moderators` write goes through `editForum`) |
| `AccountPage.jsx` | 42 | `currentUser`, `users`, `userDirectory`, `submissions`, `comments` |
| `NotificationsPage.jsx` | 56 | `notifications` (single-item clear; "Clear all" uses the `clearNotifications` reducer) |

### Persistence timing

`saveState()` (`dataManager.js:144-154`) is **not debounced** — every committed
state POSTs the full ~2.25 MB payload immediately. Writes are last-write-wins and
ordered by the click sequence. Persistence lives in a post-commit `useEffect`
(`AppContext.jsx:115-119`), **not** inside the state updater, because React
double-invokes updaters under `<React.StrictMode>` and doing it there produced
two full POSTs per mutation. Do not move it back.
