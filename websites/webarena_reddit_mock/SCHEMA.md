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
> `userDirectory` entries and 4 images to `src/data/` and changed no code), and
> **re-measured a fourth time after the 2026-08-09 overlay refactor**, which
> moved the frozen corpus out of state entirely — every size figure below is
> from that measurement.
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

Uploads are content-addressed and isolated by SID. Legacy `reset` deletes JSON
state but deliberately leaves session fixture files available.

The app boots pre-logged-in as `MarvelsGrantMan136` (user id `13915`). There is
no login, logout or registration surface.

Implementation: `vite.config.js:173-260` (`/post`, `/state`, `/go`),
`src/utils/dataManager.js`, `src/utils/overlay.js`, `src/data/frozen.js`,
`src/context/AppContext.jsx`.

---

## State API contract

The state API deliberately differs from the shared
`websites/mixpanel_mock` template. The compatibility-sensitive rules and the
2026-08 persistence hardening are summarized below.

| Behaviour | Contract | Measured |
|---|---|---|
| **`set_current` never writes the baseline** | `{"action":"set_current"}` writes **`.mock-states/<sid>.json` only** and never `<sid>.initial.json`. `{"action":"set"}` establishes or replaces the baseline on every call, so retrying setup on the same SID starts a new clean episode. A harness that wants a custom baseline **must** seed with `{"action":"set", "state":{…}}`; seeding with `set_current` leaves `/go` falling back to `createInitialData()`. | `POST set_current` on a never-seeded sid produces `<sid>.json` and **no** `<sid>.initial.json` |
| **`/go` on a never-seeded sid baselines against the pristine seed** | `initial_state` is `createInitialData()` (`vite.config.js:255`, `const initial = initialState \|\| defaultState`; the template's `\|\| currentState` fallback is deliberately absent). That is byte-for-byte what the client boots from, so the two agree by construction and the **first** mutation on a fresh sid appears in `state_diff`. | fresh sid + one `set_current` writing `hiddenForums:["books"]` → `initial_state.hiddenForums` `[]`, 22 top-level keys, `state_diff` keys `["hiddenForums"]` |
| **`reset` deletes the session state** | Returns `{"success":true,"sid":…,"message":"State cleared."}` and removes both `<sid>.json` and `<sid>.initial.json`, whether or not the SID was seeded. Session uploads are preserved. | `{"success":true,"sid":"freshaud…","message":"State cleared."}` |
| **Server state is authoritative on boot** | Every boot reads server current and initial state before seating localStorage. A harness reinjection, reset, or another browser's write therefore wins over stale browser cache. If the server genuinely has no files, the client sends an internal guarded `restore`; it fills only files that are still absent/equal, so a concurrent injection wins. The first seated React state is still skipped by the mutation persist effect. | Reinjection on a reused SID replaces warm local current and baseline; changing `?sid=` triggers a fresh hydration |
| **`set_current` replaces, it does not merge** | `const newState = data.merge ? deepMerge(currentState, data.state) : data.state`. The client always POSTs the *whole* state, so this is safe in normal use — but a hand-written `set_current` carrying two keys will truncate the session to those two keys unless it also sends `"merge": true`. | `set_current` with `{"hiddenForums":["books"]}` left `.mock-states/<sid>.json` at 39 bytes |

**localStorage persistence works again.** `initializeData()` calls
`evictForeignSessions(sid)` (`dataManager.js`) and writes the state under two
keys. Since the corpus left state (2026-08-09, overlay refactor) a cold session
serializes to **33,902 chars per key / 67,804 total**, against Chrome's
per-origin quota of **5,242,880 chars** (5 MiB, counted in UTF-16 code units
over key + value) — **1.3 % of the budget**. Measured in a booted page:
**2 `webarena_reddit_mock_*` keys held** (was 0 while the corpus was in state).

The `safeSetItem` guard (`dataManager.js`) stays anyway: a task harness may
still inject a full `submissions` array as the base (see *Frozen corpus vs
overlay* below), which puts the session back over quota. When that happens the
write fails silently rather than leaving the page stuck on `Loading…`,
`saveState()` still POSTs `set_current`, and `AppContext` falls through to
`fetchServerState(sid)` → `GET /state` when browser state is absent.
The page remains usable on quota failure, but the failure is now logged; server
write failures are retained and surfaced by `flushState()`.

> **The old localStorage quota budget is obsolete and so is the seed-size
> ceiling that came with it.** Growing `submissions.json` / `comments.json` no
> longer costs state, `/go` payload, or persistence — those files are imported,
> not copied into state. What a bigger corpus still costs is JS bundle size and
> parse time at first paint. Budget against that, not against the 5 MiB quota.

### Frozen corpus vs overlay

`src/data/submissions.json` (8,012), `src/data/comments.json` (24,149) and
`src/data/userDirectory.json` (21,038) are **not in state**. They are imported by
`src/data/frozen.js` and merged on read by `src/utils/overlay.js`. Agents cannot
create a seeded submission or comment, so those records are read-only base data —
the same split `webarena_shopping_mock` makes between its 37 mutable `orders` and
its 22,721 frozen products.

`AppProvider` holds two objects:

| | what it is | who sees it |
|---|---|---|
| `core` | the persisted state: overlay keys + forums/users/votes/session keys | localStorage, `POST set_current`, `/go`, `state_diff` |
| `state` | `materialize(core)` — `core` plus merged `submissions`, `comments`, `userDirectory` | the whole React tree |

There is exactly **one** materialization point, so no view can disagree with
another about whether a record exists: forum listing, permalink, `/user/<n>`,
search, comment tree and `/go` all read the same merged arrays.

Measured before → after the refactor, same script (`assets/dumps/measure_state.py`):

| | before | after |
|---|---|---|
| state POSTed per mutation | 14,674,815 B | 37,335 B |
| `GET /go` cold | 27,981,597 B | 67,855 B |
| `GET /go` after one vote | 39,577,722 B | 68,852 B |
| `state_diff` after one vote | 12,095,914 B | 615 B |
| localStorage keys held | 0 | 2 |

**A stale `.mock-state.json` can no longer pin an old corpus.** Before the
refactor a snapshot written before a seed expansion carried a full `submissions`
array, and `{...defaults, ...customState}` let it replace the new seed wholesale
— that shipped a 2,345-post site from an 8,012-post seed. Snapshots now contain
only the delta, so the corpus always comes from `src/data/`. A file that
predates the refactor and still carries a `submissions` array is honoured as an
explicit base, by design (see the injection contract below) — delete it if that
is not what you want.

**Hardened mode (`CUA_GYM_HARDENED=1`) does not inject.** See the fleet-wide
note in `AUDIT.md`: `shared/secureMockApiPlugin.mjs` `handleState` returns the
raw state object, while `fetchCustomState` (`dataManager.js:31-40`) requires
`{has_custom_state, stored_state}`. Under `__cua_session__` the injected state
is silently discarded and the app boots the pristine seed. Normal `?sid=` usage
is unaffected — that path is served by `vite.config.js`'s own `/state`, which
returns the correct envelope.

---

## State Schema

22 top-level keys — 13 state keys plus the 9 overlay keys. `createInitialData()`
(`dataManager.js`) serializes to **~33,902 JS characters / ~34 KB** (was
13,799,610 chars while the corpus lived in state). Re-measured 2026-08-09 off a
live `GET /go` on a never-seeded sid. **`GET /go` returns ~66 KB cold** and
**~67 KB after a vote**. `calculateStateDiff` still diffs whole top-level keys —
unchanged, 89 mocks share that convention — but the keys are now small, so one
changed submission emits a 615-byte `submissionEdits` entry instead of the
entire 8,012-record array twice. Shape unchanged:
`{initial_state, current_state, state_diff}`, diff keys after a vote
`submissionEdits, votes`.

| Key | Type | Description |
|-----|------|-------------|
| `currentUser` | object | The logged-in user's row, all 24 real preference fields: `{id, username, email, created, admin, biography, locale, nightMode, timezone, frontPage, frontPageSortMode, showCustomStylesheets, trusted, openExternalLinksInNewTab, autoFetchSubmissionTitles, enablePostPreviews, showThumbnails, notifyOnReply, notifyOnMentions, preferredFonts, allowPrivateMessages, poppersEnabled, fullWidthDisplayEnabled, submissionLinkDestination}`. Mutable: `biography`, `username`, every preference, `nightMode`. |
| `forums` | array | 95 real forums. Each: `{id, name, title, sidebar, description, created, featured, submissionCount, subscriberCount, moderationLogPublic}` plus optional, **written only by mock UI actions**: `{tags[], moderators[], suggestedTheme, backgroundImageMode, lightBackgroundImage, darkBackgroundImage}`. `name` is the `/f/<name>` path segment and is **case-preserved**; lookup is case-insensitive against `name.toLowerCase()` (`AppContext.jsx:148-152`). Mutable: `title`/`description`/`sidebar`/`tags`/`moderationLogPublic` (forum edit), `name` (rename — carries `submissions[].forum`, `subscriptions`, `moderatorOf`, `hiddenForums` with it), `suggestedTheme`/`backgroundImageMode`/background images (appearance), `moderators`, `subscriberCount`, `submissionCount`; appended by `/create_forum`; removed by `/f/<name>/delete`. |
| `users` | array | 70 "rich" users. Each: `{id, username, created, biography?, admin?, submissionCount, commentCount, negativeCommentCount}` — counts are **real site-wide** numbers, not seed counts. Mutable: `biography` for the current user; `username` on an `/account` rename. |
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

### Overlay keys (the delta against the frozen corpus)

All nine start empty. `materialize()` applies them in this order: edits, then
renames, then dead forums, then tombstones; comments whose submission did not
survive are dropped.

| Key | Type | Description |
|-----|------|-------------|
| `newSubmissions` | array | Submissions the agent created, as full records (same field set as the frozen ones). Appended by `/submit`; an edit patches in place; a delete removes the element. |
| `submissionEdits` | object | `{"<id>": <full record>}` — the replacement for a **frozen** submission. Written by edit, vote (`netScore`), comment create/delete (`commentCount`, `lastActive`). The whole record is stored, not a field patch, so materialization is a map lookup. |
| `deletedSubmissions` | array | Ids (strings) of frozen submissions the agent deleted. Every read path honours it because they all go through `materialize()`. |
| `newComments` | array | Comments the agent created, as full records. |
| `commentEdits` | object | `{"<id>": <full record>}` for frozen comments — edit, vote, soft-delete, moderator trash. |
| `deletedComments` | array | Ids of frozen comments hard-deleted (leaf `delete_own`). |
| `deletedForums` | array | Forum names deleted via `/f/<name>/delete`. Drops every submission in that forum, and their comments follow. Costs one string instead of ~110 tombstones. |
| `forumRenames` | array | Ordered `{from, to}`, applied left to right to `submission.forum`. Composes: `A→B` then `B→A` resolves to `A`. |
| `userRenames` | array | Ordered `{from, to}`, applied to `submissions[].author`, `comments[].author` and the `userDirectory` key. |

**Not in state:**

- `src/data/submissions.json`, `src/data/comments.json`, `src/data/userDirectory.json` — the frozen corpus, imported by `src/data/frozen.js`. See *Frozen corpus vs overlay* above.
- `src/data/images.json` — a static asset manifest of **2,748 entries** (`{filename: {w, h, full, thumb1x, thumb2x}}`), one per image-bearing submission, imported directly by components. Putting it in state would inflate every `/go` diff for no reason.

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
(`dataManager.js`) — so a task only needs to send the fields it wants to
change. Note this merge happens **client-side**: the server stores exactly what
you POST, so `/go`'s `initial_state` for a partial `set` is that partial object,
while the running app sees the merged one.

### Injecting submissions and comments

Two paths, both supported, verified to render identically
(`assets/dumps/test_overlay.py` §4 compares `#main` innerText across
`/f/Art`, `/f/Art/new`, `/f/Art/top`, `/user/<n>` and `/search`).

**Lightweight (preferred).** Send only the delta. Adding a post costs one
record, not 8,012:

```json
{"action": "set", "state": {
  "newSubmissions":     [ { "id": 199001, "forum": "Art", "author": "MarvelsGrantMan136",
                            "title": "…", "timestamp": "2024-01-01T00:00:00+00:00",
                            "lastActive": "2024-01-01T00:00:00+00:00", "ranking": 9999999999,
                            "netScore": 1, "commentCount": 0, "slug": "…" } ],
  "submissionEdits":    { "43558": { "…the whole record, with your changes…" } },
  "deletedSubmissions": ["43482"],
  "newComments":        [ { "id": 3000001, "submission": 199001, "author": "…",
                            "body": "…", "netScore": 1, "timestamp": "…" } ],
  "commentEdits":       { "1235250": { "…" } },
  "deletedComments":    ["1042264"]
}}
```

A record in `submissionEdits` / `commentEdits` **replaces** the frozen record
wholesale, so send the complete object, not a field patch.

**Legacy full array.** Injecting `submissions` (or `comments`, or
`userDirectory`) still works and behaves exactly as it did before the refactor:
the array becomes the **base**, verbatim, in the order you sent it, and the
overlay applies on top of it. Nothing about existing task setups had to change.
The cost is that the session's state is then as large as the array you sent —
which is why the lightweight path exists.

---

## Observable State Changes (for LLM evaluation)

Every row below reaches `saveState()` → `POST /post {action:'set_current'}` →
`/go` `state_diff`. Reducer names in parentheses are exported from
`AppContext.jsx`.

| User Action | State Field Changed |
|-------------|---------------------|
| Click ▲ on a submission (`div.submission__vote form`) — `vote('submission', id, 1)` | `votes.submissions["<id>"]` set to `1`; the record's `netScore` +1 (or +2 when flipping a downvote) — on a **frozen** submission that lands as `submissionEdits["<id>"]`, on an agent-created one it patches `newSubmissions` in place. Form class becomes `vote vote--user-upvoted`. |
| Click ▼ on a submission — `vote('submission', id, -1)` | `votes.submissions["<id>"]` set to `-1`; `netScore` −1 / −2. Form class becomes `vote vote--user-downvoted`. |
| Click the already-active arrow (retract) | `votes.submissions["<id>"]` **deleted**; `netScore` returns to its previous value. Form class becomes `vote`. |
| Vote on a comment (`/cv/<id>`) — `vote('comment', …)` | Same, on `votes.comments["<id>"]` and the comment's `netScore` via `commentEdits` / `newComments`. |
| Subscribe from a forum sidebar — `subscribe(name)` | `subscriptions` grows with the forum name; `forums[i].subscriberCount` +1. A "Subscribed forums" section appears as the **first** `#sidebar > section` on `/`, and `/` stops being empty. |
| Unsubscribe — `unsubscribe(name)` | `subscriptions` shrinks; `forums[i].subscriberCount` −1. |
| Create a submission via `/submit` or `/submit/<forum>` — `createSubmission(…)` | `newSubmissions` grows with `{id: nextSubmissionId, author: "MarvelsGrantMan136", netScore: 1, commentCount: 0, ranking: <epoch seconds>, timestamp = lastActive = now, slug: slugify(title)}` (+ `url` / `body` / `image`+`imageWidth`+`imageHeight` / `userFlag` when supplied); `votes.submissions["<newId>"] = 1`; `nextSubmissionId` +1; `forums[i].submissionCount` +1. The browser then navigates to `/f/<forum>/<id>/<slug>` — the URL `func:reddit_get_post_url('__last_url__')` reads. |
| Edit a submission — `editSubmission(id, updates)` | `{title,url,body}` and `editedAt` updated — written to `submissionEdits["<id>"]` for a frozen record, in place in `newSubmissions` for a created one. |
| Delete own submission — `deleteSubmission(id)` | the id is tombstoned in `deletedSubmissions` (or removed from `newSubmissions`); `forums[i].submissionCount` −1. Its comments disappear from every view because `materialize()` drops comments whose submission no longer resolves — no separate comment prune is written. |
| Post a top-level comment — `addComment({submission, body})` | `newComments` grows with `{id: nextCommentId, netScore: 1, submission: <id>}` and **no** `parent`; `nextCommentId` +1; the parent submission's `commentCount` +1 and `lastActive` bumped (via `submissionEdits` when it is frozen); `votes.comments["<newId>"] = 1`. |
| Reply to a comment — `addComment({…, parent})` | Same, with `parent: <that comment's id>`. |
| Edit own comment — `editComment(id, body)` | `body` and `editedAt` updated, via `commentEdits["<id>"]` or in place in `newComments`. |
| Delete own comment (`…/comment/<cid>/delete_own`) — `deleteComment(id)` | Leaf: id tombstoned in `deletedComments` (or removed from `newComments`), parent submission's `commentCount` −1. Has replies: `body` and `author` become `[deleted]` and `visibility` becomes `"soft-deleted"`; the node and the count stay. |
| **Trash a comment as a moderator** (`…/comment/<cid>/delete`) — `trashComment(id, reason)` | the comment's `visibility` becomes `"trashed"` (through `commentEdits`), plus `trashReason` (the Reason box; empty ⇒ `null`), `trashedBy` (current username) and `trashedAt` (ISO now); the parent submission's `commentCount` −1. The node stays in the merged array so `/trash` can list it, but `commentsFor()` filters it out of the tree. **Idempotent** — trashing an already-trashed comment is a no-op. `AppContext.jsx:383-403` is the only writer of `visibility: "trashed"`. |
| Trash a comment thread (`…/comment/<cid>/delete_thread`) | Same, applied to the comment **and every descendant**, each with the same `trashReason` (`DeleteCommentPage.jsx` recurses into `trashComment`). |
| Create a forum via `/create_forum` — `createForum(…)` | `forums` grows with `{id: nextForumId, submissionCount: 0, subscriberCount: 1, featured: false, created: now}`; `moderatorOf` and `subscriptions` grow with the name; `nextForumId` +1. A non-empty Tags field triggers a second write setting `forums[i].tags` to the whitespace/comma-split list, which is what makes the forum appear on `/tags` and `/tag/<tag>`. |
| Edit a forum via `/f/<name>/edit` — `editForum(name, updates)`, or `renameForum(old, updates)` when the name changes | `forums[i].{title,description,sidebar,tags,moderationLogPublic}` updated. **Renaming** appends `{from, to}` to `forumRenames` — which is what carries `submissions[].forum` — and rewrites `subscriptions`, `moderatorOf` and `hiddenForums`, then redirects to the renamed forum. The corpus itself is never rewritten, so the rename costs ~40 bytes of state. |
| Save Appearance on `/f/<name>/appearance` | `forums[i].suggestedTheme` (or `null`) and `forums[i].backgroundImageMode` (`"tile"` \| …); an uploaded file goes through `POST /upload` and lands in `forums[i].lightBackgroundImage` / `darkBackgroundImage` as a `/files/<sid>/<name>` URL. |
| Remove a moderator on `/f/<name>/moderators` | `forums[i].moderators` shrinks (via `editForum`). If the removed user is the current user, `moderatorOf` also drops that forum — which re-locks `/f/<name>/edit`. Flash: "The user was unmodded." |
| Delete a forum via `/f/<name>/delete` (type the name + confirm) | `forums` loses the row; the name is appended to `deletedForums`, which makes `materialize()` drop every submission in that forum and, transitively, all their comments; the name is dropped from `subscriptions`, `moderatorOf` and `hiddenForums`. Redirects to `/`. Used to be the single largest `state_diff` of any control; it is now one of the smallest. |
| Edit biography via `/user/<name>/edit_biography` — `updateBio(text)` | `currentUser.biography` updated **and** `users[i].biography` mirrored. Immediately visible in `.user-bio__biography` on `/user/MarvelsGrantMan136` — the webarena-399..403 locator. Flash "The biography was updated.", redirect to `/user/<name>?sid=…`. |
| Change a preference on `/user/<name>/preferences` — `updatePreferences(updates)` | The matching `currentUser.<field>` updated. Changing `frontPage` / `frontPageSortMode` changes what `/` renders; `fullWidthDisplayEnabled` toggles `<html class="full-width">`. |
| Change the username on `/user/<name>/account` `renameUser(from, to)` | `currentUser.username` and the matching `users[i].username` are updated, and `{from, to}` is appended to `userRenames` — which re-keys `userDirectory` and rewrites **every** `submissions[].author` and `comments[].author` equal to the old name at materialization. Then redirects to `/user/<new>/account`. The `state_diff` is three small keys; it used to carry `submissions` and `comments` in full (~2.25 MB). |
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

`calculateStateDiff` is a **top-level-key** `JSON.stringify` comparison over the
union of initial and current keys. Every row above therefore surfaces as one or more
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
- Removing a top-level key is observable as `{old: <previous>, new: null}`;
  deletions no longer disappear merely because the key is absent from current.

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
| `ForumModeratorsPage.jsx` | 69 | `moderatorOf` (self-unmod; the `forums[i].moderators` write goes through `editForum`) |
| `NotificationsPage.jsx` | 56 | `notifications` (single-item clear; "Clear all" uses the `clearNotifications` reducer) |

The three writes that used to rewrite the corpus in place — forum delete, forum
rename, username rename — moved into `AppContext` as `deleteForum`,
`renameForum` and `renameUser` when the corpus left state. `ForumDeletePage`,
`ForumEditPage` and `AccountPage` now call those reducers, so overlay knowledge
lives in exactly one file.

### Persistence timing

`saveState()` coalesces whole-state writes scheduled in the same tick and
serializes the resulting `set_current` requests. A later click can therefore
never land before an earlier request and be overwritten by it. `flushState()`
forces any pending write into the chain, resolves after the final response, and
rejects if a request failed. The payload is the ~37 KB overlay state, not the
corpus: `AppContext`'s persist effect writes `core`, never the materialized
`state`. Persistence lives in a post-commit `useEffect`, **not** inside the state updater, because React
double-invokes updaters under `<React.StrictMode>` and doing it there produced
two full POSTs per mutation. Do not move it back.

### Transport, SID, and files

Provided SIDs must fully match `[A-Za-z0-9_-]{1,128}`. Invalid SIDs are rejected
instead of being stripped into colliding filenames; omitting `sid` keeps the
legacy default session. JSON request bodies are bounded at 64 MiB, buffered,
decompressed when needed, and decoded once with strict UTF-8 validation.
State and upload writes use same-directory temporary files plus atomic rename,
and mutations are serialized per SID. `/state` returns both current and
baseline envelopes: `{stored_state, has_custom_state, initial_state,
has_initial_state, sid}`. Upload names use an 8-character SHA-1 content prefix,
so re-uploading identical bytes under one SID is deterministic.
