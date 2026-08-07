# webarena_reddit_mock — TODO

> Status: **READY FOR DEV**
> Source: <http://localhost:9999> · image `postmill-populated-exposed-withimg:latest` · container `forum`
> Recon: `SOURCE.md` | Routes: `ROUTES.md` | Design: `DESIGN.md` | Views: `assets/README.md` | Data: `assets/data_model.md`
> Task contract: `assets/task_anchors.md` (129 tasks · 93 anchor routes · 166 anchor strings · 12 DOM locators)
> **Recon mode: FULL** (docker + live site both reachable)

## Status Legend
- `[ ]` Not started · `[~]` In progress · `[x]` Done

## Read this first — what the 129 tasks actually do

Counted across every reddit task's `question` field:

| Capability | Tasks | Verdict |
|---|---:|---|
| **Create a submission** (`/submit`) | **98** | The single highest-value flow on the site. If `/submit` is wrong, ~3/4 of the benchmark is lost. |
| Sort / find "top", "most", "latest", "hottest" | 39 | Sort correctness is second. |
| Navigate to / read a specific post | 17 | |
| **Create a forum** (`/create_forum`) then edit it | 12 | Unlocks `/f/<new>/edit`, whose `#forum_description` / `#forum_sidebar` are read by the evaluator |
| **Comment / reply** | 10 | |
| Vote (up/down) | 6 | Evaluator asserts the literal class `vote vote--user-upvoted` / `vote vote--user-downvoted` |
| Edit bio | 5 | Evaluator reads `.user-bio__biography` |
| Subscribe to a forum | 5 | Evaluator reads `#sidebar > section` on `/` |

A polished forum listing that cannot post is worth less than an ugly one that
can. Build `/submit` first.

---

## P0 — Shell, Routing, Data Pipeline

- [x] Scaffold from `websites/mixpanel_mock`: `package.json`, `vite.config.js` with
      `secureMockApiPlugin()` **first** in `plugins[]`, then the `mock-api` plugin
      registered under **both** `configureServer` **and** `configurePreviewServer`.
      Endpoints `/post`, `/state`, `/go`, `/upload`, `/files`. State at
      `.mock-states/<sid>.json` + `<sid>.initial.json`, sid sanitized with
      `sid.replace(/[^a-zA-Z0-9_-]/g, '')`.
- [x] **Every request-body reader in `vite.config.js` must
      `Buffer.concat(chunks).toString('utf-8')`, never `body += chunk`.** `+=`
      decodes each ~64 KB Buffer independently, so a multi-byte UTF-8 sequence
      straddling a chunk boundary becomes two U+FFFD and is written to
      `.mock-states/<sid>.json` permanently. The state payload is ~2.7 MB (≈46
      chunks) and is POSTed on **every** mutation, so seeded content containing
      `’ ‘ —` / emoji / CJK — including anchored titles like
      `‘The Night Agent’ Renewed…` and `Don’t Say Gay…` — was being corrupted
      non-deterministically, silently, after the agent acted but before the
      evaluator read the page (TEST BUG-B01). Measured on a 3.5 MB payload:
      `body += chunk` → **37** U+FFFD, `Buffer.concat` → **0**.
      **FIXED in dev-fix-9:** `shared/secureMockApiPlugin.mjs` `readBody()` had
      the same `body += chunk` shape and only ran under `CUA_GYM_HARDENED=1`.
      It is now `Buffer.concat(chunks).toString('utf-8')` — a 6-line, single-
      function change with nothing else touched, since the file is shared by
      every mock. A/B on an identical 128-chunk / 8.3 MB stream dense in
      `’ — 💝 中文テスト`: `body += chunk` → **156** U+FFFD (and it still
      `JSON.parse`s, hence silent); `Buffer.concat` → **0**, string equal to the
      source. Proven end to end through a real hardened server: admin
      `{"action":"set"}` of the mock's own ~2.7 MB state → `/_cua_session`
      cookie flow → browser mutation → `.mock-secure-states/<sid>.json` read
      back as BYTES has **0** `EF BF BD`, and all 370 multi-byte submission
      titles + 519 multi-byte comment bodies round-trip byte-identical. Small
      (`{"a":"ok ’ 💝"}`) and empty bodies still resolve correctly, and
      `webarena_shopping_mock` was booted hardened on the same shared file to
      confirm `/post`, `/state` and `/go` are unaffected for other mocks.
- [x] `src/utils/dataManager.js` with `getSessionId`, `storageKey`, `initialKey`,
      `fetchCustomState`, `createInitialData`, `initializeData(sid, customState)`,
      `saveState(state, sid)` → POST `{action:'set_current', state}`.
- [x] `createInitialData()` returns exactly the shape in `assets/data_model.md` §7,
      loading `src/data/{forums,submissions,comments,users,userDirectory,currentUser,images}.json`.
      Seed `votes.submissions = { "1": 1 }` from `currentUser.submissionVotes`.
      Set `nextSubmissionId = 200000`, `nextCommentId = 3000000`, `nextForumId = 20000`
      so generated ids can never collide with a real one (max real submission id is `135201`).
- [x] `src/context/AppContext.jsx`: check `localStorage.getItem(initialKey(sid))`
      **before** calling `initializeData()`, or injected task state never loads.
- [x] `src/App.jsx`: `/go` route; `RedirectWithQuery` instead of `<Navigate>`
      everywhere so `?sid=` survives; `src/utils/stateTracker.js`.
- [x] `SCHEMA.md` with the state table and the Observable State Changes table.
- [x] **`slugify()` in `src/utils/slug.js`** — copy the JS in `assets/data_model.md` §6
      verbatim. It is a validated port of `Postmill\App\Utils\Slugger` (56/56 against
      the anchor routes). Used for links to *newly created* submissions.
- [x] **Routing ignores the slug.** `/f/:forum/:id/:slug` must resolve on `:id`
      alone — `/f/books/59421/-` and `/f/books/59421/anything` both render
      submission 59421. Do the same for the comment permalink, whose anchor form is
      literally `/f/books/59421/-/comment/1235250`.
- [x] **Forum lookup is case-insensitive.** `/f/earthporn` → `EarthPorn`,
      `/f/machinelearning` → `MachineLearning`. Source 302-redirects to the
      canonical casing; either redirect or render directly, but do not 404.
- [x] App shell — exact dimensions in `DESIGN.md` §4:
      site nav (fixed top bar: wordmark, forum dropdown, search box, Submit link,
      user menu, notifications), then `.site-content.content-container` splitting
      into `<main class="site-content__body body flow" id="main">` and
      `<aside class="site-content__sidebar sidebar flow" id="sidebar">`, then
      `<footer class="site-footer">`. Keep the `id="main"` / `id="sidebar"` ids —
      `#sidebar > section` is an evaluator locator.
- [x] Routing for all `ROUTES.md` rows marked **P0**/**P1**, including
      query-param handling (`?t=`, `?next=`, `?q=`) and path-segment sorts.
- [x] Boot pre-logged-in as `MarvelsGrantMan136` (id 13915). No `/login`, no
      `/registration`, no `/log_out`.
- [x] Zero runtime network calls. All images are local under `public/`.
- [x] **Render `submission.title` as a plain text node — do not HTML-unescape it.**
      The scrape stored escaped titles and Postmill escapes again on output, so the
      live site literally shows `JPMorgan Chase &amp; Co`. React's default JSX
      interpolation already does the right thing; the bug would be calling a
      decode helper. Verified in `assets/screenshots/reference/03-forum-news.png`.
- [x] **`userFlag` renders next to every author byline** as
      `<small class="fg-grey text-sm user-flag">t3_116e4p2</small>`, and the square
      brackets a user sees come from CSS
      (`.user-flag::before { content: '[' } / ::after { content: ']' }`) — put them
      in CSS, not in the markup. Omit the element entirely when the value is
      `none`. The seed carries `userFlag` on 2,358/2,359 submissions (the only one
      without is the app-created submission `1`) and all 2,593 comments.

## P1 — Core Site Features

### Submitting (highest value — 98 tasks)

- [x] **[ROUTES #49, #50] `/submit` and `/submit/:forum`.** Postmill's create form
      (`templates/submission/create.html.twig` + `_form.html.twig`, transcribed in
      `assets/README.md` §7). Must have: a **forum picker** (typeahead over all 95
      forum names, pre-filled and read-only-ish when arriving at `/submit/:forum`),
      a **URL / Image / Text** media-type control, a **Title** input (max 300 chars,
      `Submission::MAX_TITLE_LENGTH`), a **URL** input (max 2000), a **Body**
      textarea (markdown, max 25000), and the submit button.
      On submit: append to `submissions` with
      `id = nextSubmissionId++`, `author = 'MarvelsGrantMan136'`,
      `timestamp = lastActive = now()`, `netScore = 1`, `ranking = <epoch seconds>`
      (matching submission `1`, whose `ranking` is `1686590745`), `commentCount = 0`,
      `slug = slugify(title)`; auto-upvote it (`votes.submissions[id] = 1`);
      then **navigate to `/f/<forum>/<id>/<slug>`**. That final URL is what
      `func:reddit_get_post_url('__last_url__')` reads, so the redirect is
      load-bearing — 60+ tasks are scored on it.
- [x] Validation copy, verbatim from `assets/README.md`: required-field errors on
      empty title and on a URL post with no URL, and the "forum does not exist"
      error. Do not invent messages.
- [x] A **URL** submission must render its `url` as the title's `href` **and**
      show it as a link in `.submission__inner` — tasks webarena-615..619 re-post a
      `/f/pics` image URL into `/f/funny` and the evaluator runs
      `[...document.querySelector('.submission__inner').querySelectorAll('[href],[src]')].map(…)`
      looking for the image filename. The five filenames are in
      `assets/task_anchors.md`; all five images are seeded (`/f/pics` submissions
      25046, 25055, 45604, 67161, 110715).
- [x] **[ROUTES #40] Edit submission** `/f/:forum/:id/:slug/edit` — title, url, body,
      author-only. Sets `editedAt`. webarena-731 appends `EDIT: This news aged well`
      to submission `1`'s body (`/f/MachineLearning/1/nvidia-rtx-4090`, current body
      `Crazy device for ML!`).
- [x] **[ROUTES #41] Delete own submission** — confirmation page, then remove from
      the listing.

### Listings and sorting (39 tasks)

- [x] **[ROUTES #10, #11] `/f/:forum` and `/f/:forum/:sort`.** 25 per page.
      Sort mapping, exactly (`SOURCE.md` §3):

      | sort | ORDER BY |
      |---|---|
      | `hot` | `ranking DESC, id DESC` |
      | `new` | `id DESC` |
      | `active` | `lastActive DESC, id DESC` |
      | `top` | `netScore DESC, id DESC` |
      | `controversial` | `netScore **ASC**, id **ASC**` |
      | `most_commented` | `commentCount DESC, id DESC` |

      The `id DESC` tiebreak is not cosmetic: in `/f/books` hot, submissions
      `59478` and `17445` are tied at `ranking = 1423` and the tiebreak is what keeps
      `17445` in the top 10, which webarena-66/67/68 depend on. See `SOURCE.md`
      for the full expected `/f/books` hot top-12.
- [x] Submission row: vote widget · thumbnail (image posts, when
      `currentUser.showThumbnails`) · title linking to the submission (or to the
      external URL when `submissionLinkDestination === 'url'` — the seeded value)
      · the link's host in parentheses · byline · comment count · action links.
      Exact element order and copy in `assets/README.md` §3.
- [x] `?t=day|week|month|year|all` time filter on **`submissions.timestamp`**,
      applied to every sort (not just `top`). Default `all`. ⚠ Reproduce the
      source's real behaviour: the corpus ends 2023-03-31, so every value except
      `all` yields an **empty listing** with the standard empty-state copy.
      The `From: …` dropdown that sets it is `_macros/post_nav.html.twig ::
      submission_time`, rendered by `ListNav`/`TimeDropdown` whenever the URL
      carries `t` **or** the sort is `top`/`controversial`/`most_commented`;
      options `Past 24 hours · Past week · Past month · Past year · All time`,
      links = the current path with `t` swapped.
- [x] Pagination, 25/page. Postmill uses PagerWave cursor params (`?next=`,
      `?prev=`); confirm the literal format against
      `assets/html/f_news_page2.html` and reproduce it. Whatever you choose,
      **accept and ignore an unknown `next=`** rather than 404.
- [x] `/f/:forum` sidebar: forum title, `description`, the `sidebar` text (which in
      this corpus is a scraped Reddit id like `t5_2qh3l` — render it as-is), a
      **Subscribe / Unsubscribe** button, `submissionCount`, `subscriberCount`, a
      "Submit" link to `/submit/:forum`, and (for a forum the user moderates) the
      moderator tools.
- [x] **[ROUTES #1..#6] Front page.** `/` renders `currentUser.frontPage`, seeded
      to `subscribed` with zero subscriptions ⇒ **an empty listing**. Do not
      "helpfully" show all posts; the source shows nothing. `/all` shows everything,
      `/featured` shows nothing (no forum has `featured: true`).
- [x] **[ROUTES #31, #32] `/forums` and `/forums/all`.** `/forums/{sortBy}/{page}`
      with `by_name | by_title | by_subscribers | by_submissions (default) |
      by_creation_date`; offset pagination here, not cursors. `/forums/all` is the
      flat A–Z list of all 95.

### Submission page and comment tree (the crux)

- [x] **[ROUTES #33] `/f/:forum/:id/:slug`.** Header block with `.submission__inner`,
      `.submission__title`, `.submission__body` (rendered markdown),
      `div.submission__vote > form.vote`, byline, comment count, action links.
      **Four evaluator locators point at this page** —
      `.submission__inner`, `.submission__title`, `.submission__body`,
      `div.submission__vote form` — so those exact class names must exist.
- [x] **Nested comment tree**, arbitrary depth (no cap in the data or the app).
      Each comment renders: vote widget (`form.vote`, same class contract),
      author link to `/user/:name`, relative timestamp, `.comment__body` with
      rendered markdown, and Reply / Edit / Delete / Permalink actions.
      Build the tree from `comments[].parent`; children ordered as the source does
      (see `assets/README.md` §4 — confirm whether it is `netScore DESC` or
      `timestamp ASC`). `.comment__body` is an evaluator locator (webarena-650/651/652).
- [x] **[ROUTES #52] Reply.** Reply opens an inline textarea below the comment;
      posting appends a comment with `parent = <that comment's id>`,
      `id = nextCommentId++`, `netScore = 1`, and increments the submission's
      `commentCount`. Top-level box at the bottom of the submission page posts with
      no `parent`.
      **Posting REDIRECTS to the new comment's permalink**
      `/f/{forum}/{id}/{slugify(title)}/comment/{new_cid}` (`?sid=` preserved),
      for both top-level comments and replies — `CommentController::comment()`
      ends on `redirect(generateCommentUrl($reply))`. webarena-650/651/652 use
      `"url": "last"` and `exact_match` the FIRST `.comment__body` on whatever
      page the agent ended on; without the redirect that is the highest-scored
      pre-existing comment. **Do not "fix" this by re-sorting new comments to the
      top** — top-level comments sort `netScore DESC`, which matches
      `Submission::getTopLevelComments()` and must stay.
- [x] **[ROUTES #54, #55] Edit / delete own comment.** `Edit` **navigates** to
      `…/comment/{cid}/edit` (EditCommentPage); it is not an inline editor.
      `assets/js/commenting.js` hooks only `.comment__reply-link` on the source,
      so `.comment__edit-link` is a plain link that changes the URL. Applied in
      `CommentNav`, which is the one action row shared by `<Comment>`,
      `<CommentRow>` and `<UserCommentRow>`.
      **dev-fix-9:** saving the edit now lands on `generateCommentUrl($comment)`
      — `/f/{forum}/{id}/{slugify(title)}/comment/{cid}`, the REAL slug — exactly
      as comment creation does. `CommentController::editComment` (container line
      145) ends on `redirect($this->generateCommentUrl($comment))`, and
      `AbstractController::generateCommentUrl` (lines 71–84) builds `slug` from
      `slugger.slugify(submission.title)`; the mock was landing on the `-` form.
      `?sid=` preserved. The fabricated `The comment has been edited.` flash is
      gone: `editComment` calls no `addFlash` and `messages.en.yml` has no
      `flash.comment_edited` key.
      **dev-fix-9:** `<CommentRow>` and `<UserCommentRow>` still carried an
      inline-edit `useState`/`<form>` and passed an `onEdit` prop the unified
      `CommentNav` ignored — dead since the nav was unified. Removed, along with
      the now-unreachable `onEdit`/`editing` parameters on `CommentNav` itself.
      `.comment__body` still routes through the single shared `MarkdownBody` on
      all three renderers and the nav order is unchanged.
- [x] **[ROUTES #37] Comment permalink** `/f/:forum/:id/:slug/comment/:cid` —
      renders only that comment and its subtree, with a link back to the full
      thread. Two anchor routes use it with the `-` slug.
      `submission/comment.html.twig` calls `{{ submission(submission) }}` with
      **no options**, so `show_content` defaults to false: this page has **no
      `.submission__body`** (wrapper is `submission--collapsed`) and **no
      `<h2>Comments</h2>`**, unlike the full submission page. The alert carries
      `single-comment-alert`. `#main` innerText verified identical to the source
      on both anchor routes (21/21 and 180/180 lines).
- [x] **[ROUTES #38] Legacy comment permalink 301.**
      `/f/{f}/{id}/comment/{cid}` redirects to `/f/{f}/{id}/-/comment/{cid}` —
      the literal `-`, not the submission slug. Measured on the source for three
      submissions. Same shape as the `/{id}` shortcut; `?sid=` preserved.
- [x] **[ROUTES #34] `/nested` and `/linear` comment views.** `linear` is flat and
      chronological. The mode arrives as a `view` prop from `App.jsx` (the
      literal `/linear` / `/nested` segments out-rank the `:commentView` param
      route), and `linear` sets Postmill's `post_numbers`: every comment renders
      at level 1, the header carries `#1,042,264` (`number.id`), the
      `Replying to <user> (#<id>)` pointer replaces nesting, and
      Permalink/Parent drop out of the action row. Verified
      character-identical to `:9999` on comments 1042264 and 1042558 in both
      views.

### Voting

- [x] **[ROUTES #51, #60] Vote widget.** Reproduce the source markup exactly —
      it is asserted as a literal string. From
      `templates/_layouts/vote.html.twig`, confirmed against the rendered page:

      ```html
      <div class="submission__vote">
        <form action="/sv/59421" method="post" class="vote">
          <button type="submit" name="choice" value="1"
                  class="unbuttonize vote__button vote__up" title="Upvote">…</button>
          <span class="vote__net-score" data-vote-target="score">3,085</span>
          <span class="vote__spinner">…</span>
          <button type="submit" name="choice" value="-1"
                  class="unbuttonize vote__button vote__down" title="Downvote">…</button>
        </form>
      </div>
      ```

      The form's `class` attribute takes exactly three values:
      `"vote"` · `"vote vote--user-upvoted"` · `"vote vote--user-downvoted"`.
      Evaluators for webarena-404..410 and 714..730 do
      `document.querySelector('div.submission__vote').querySelector('form').getAttribute('class')`
      and string-compare. **Any extra class breaks 16 tasks.** Comment votes use
      the same `form.vote` with `action="/cv/{id}"`.
- [x] Vote semantics: clicking the active direction retracts (button `value`
      becomes `0`); score changes by ±1 or ±2 accordingly. Score display uses a
      thousands separator (`3,085`) and renders negatives with U+2212 MINUS
      (`−`), per `_layouts/vote.html.twig`.
- [x] Seed the one real pre-existing vote: submission `1` is upvoted by
      `MarvelsGrantMan136`, so `/f/MachineLearning/1/nvidia-rtx-4090` boots with
      `class="vote vote--user-upvoted"`.

### Forums: create, edit, subscribe

- [x] **[ROUTES #30] `/create_forum`.** Fields per `assets/README.md` §10. On
      submit: append to `forums` with `id = nextForumId++`,
      `submissionCount = 0`, `subscriberCount = 1`, `featured: false`; add the
      creator to `moderatorOf`; auto-subscribe; redirect to `/f/<name>`.
      This is a hard prerequisite for webarena-580..584, which then edit the new
      forum.
- [x] **[ROUTES #15] `/f/:forum/edit`.** Moderator-only (so: forums the user
      created). The form's field ids are evaluator locators — they must be exactly
      `#forum_title`, `#forum_description`, `#forum_sidebar` (confirm the full list
      against `assets/README.md` §9). Evaluators read
      `document.querySelector("#forum_description").value` and
      `#forum_sidebar.value`, so these must be real `<input>`/`<textarea>`
      elements holding the saved value on page load.
- [x] Existing forums are **not** editable by `MarvelsGrantMan136` — `moderators`
      is empty on the source and the user is not admin. Render the same
      403/"access denied" the source does rather than showing the form.
- [x] **[ROUTES #28, #29] Subscribe / unsubscribe** from the `/f/:forum` sidebar.
      On subscribe: push the forum name into `subscriptions`, increment
      `subscriberCount`, and **add a "Subscribed forums" section to `#sidebar` on
      `/`** listing the subscribed forum names. webarena-595..599 read
      `document.querySelector("#sidebar > section").outerText` on `/` and expect to
      find `space` / `books` / `consoles` / `pittsburgh` / `MachineLearning` there.
      Get the section *ordering* right: whichever section is first in `#sidebar`
      must be the one containing the subscriptions.
- [x] Subscribing also makes `/` (front page = `subscribed`) non-empty.

### User

- [x] **[ROUTES #61] `/user/:username`.** The bio block must use the class
      `.user-bio__biography` (evaluator locator for webarena-399..403) and boot
      showing the seeded literal `t2_5adwlxvn`. Also: join date, submission and
      comment counts, tab nav.
- [x] **[ROUTES #65] `/user/:username/edit_biography`** — textarea prefilled with
      the current bio; saving updates `currentUser.biography` and is immediately
      visible on `/user/MarvelsGrantMan136`.
      *All five webarena-399..403 strings verified end to end in chromium:
      type → Save → cold-load `/user/MarvelsGrantMan136?sid=…` → read
      `.user-bio__biography`.*
- [x] **[ROUTES #63, #64]** Submissions and Comments tabs.
      Orderings read off the live `rel="next"` cursors — overview
      `timestamp DESC`, submissions `id DESC`, comments `timestamp DESC, id DESC`
      — which also settles `assets/README.md` UNVERIFIED item 4.
- [x] **[ROUTES #67] `/user/:username/preferences`** — every field listed in
      `assets/README.md` §12, prefilled from `currentUser`. Changing
      `frontPage` or `frontPageSortMode` must actually change what `/` renders.
      *Verified: setting Front page to `all` makes `/` render 25 submissions.*
      Fieldset order follows the rendered source (General / Posting /
      Notifications / Privacy / Appearance), not §12's grouping.
- [x] **[ROUTES #66] `/user/:username/account`** — email + password fields.

### Search

- [x] **[ROUTES #90] `/search?q=…`.** The source uses Postgres full-text over
      `search_doc`; the mock does client-side matching over submission
      `title` + `body` and comment `body`. Tokenise on whitespace and require all
      terms (case-insensitive substring is close enough and is what the tasks need
      — `machine learning`, `headphone`, `bookshop`). Render results in the same
      submission-row shape, with the real "no results" copy from
      `assets/README.md` §13.
      **Rendering parity added (dev fix 10):** `src/utils/searchHighlight.js`
      reproduces the two `ts_headline()` calls in
      `src/Repository/SearchRepository.php` — `HighlightAll=TRUE` on the title
      and `MaxFragments=3` on the body — so results now carry `<mark>`s and a
      ~35-word match excerpt instead of the whole body. Result *selection* is
      still the substring approximation above; only the presentation changed.

### Firehoses

- [x] **[ROUTES #7] `/comments`** — site-wide comments, newest first.
- [x] **[ROUTES #14] `/f/:forum/comments`** — the same, scoped to one forum.

## P2 — Depth & Realism

- [x] **[ROUTES #13] Multireddit `/f/a+b+c`** — union listing. Regex on the source:
      `(?:\w{3,25}\+){1,70}\w{3,25}`.
- [x] **[ROUTES #36] Numeric shortcut `/:id`** → redirect to the canonical
      submission URL.
- [x] **[ROUTES #62] `/u/:name`** → redirect to `/user/:name`.
- [x] **[ROUTES #77] `/users`** — paginated user list from `userDirectory.json`.
      **Parity decision: the route renders Postmill's bare 403 for the seeded
      user**, because that is what the live site returns (`assets/html/
      users-auth.html`) and both SOURCE.md gap 6 and ROUTES.md #77 ask for it.
      The real 9-column table (25/page, offset pages at `/users/{n}`, the
      Order by / Role filter) is implemented behind `currentUser.admin`, so a
      task that injects an admin still gets a working list instead of a dead end.
- [x] **[ROUTES #78, #80] `/notifications`** + Clear — empty state initially; a
      reply to the user's own content should create one.
      *Empty state shipped verbatim. No notification is generated on reply:
      Postmill notifies the author when **someone else** replies, and this mock
      is single-user, so a self-reply legitimately produces none — inventing one
      would be fabricated state. All four notification renderers (comment,
      comment_mention, submission_mention, message) work against injected state;
      verified by POSTing one and clearing it both ways.*
- [x] **[ROUTES #84–#88] Messages** — thread list, thread view, compose, reply.
      Empty state initially. Compose → thread → reply → thread list verified in
      chromium; thread ids are UUIDs and the title is derived exactly as
      `MessageThread::getTitle()` does (first line, ≤100 chars).
- [x] **[ROUTES #89] Message delete redirects like `MessageController::delete()`.**
      Deleting the **last** message of a thread also removes the thread and
      `redirectToRoute('message_threads')` ⇒ `/messages`; deleting any other
      message stays on the thread. The mock removed the thread but left the agent
      parked on `/messages/thread/{uuid}`, which then rendered `Page not found`
      (TEST BUG-B02). `?sid=` preserved.
- [x] **[ROUTES #81] Night mode** toggle (`light` / `dark` / `auto`) writing
      `data-night-mode` on `<html>`; dark palette is in `DESIGN.md` §2.
      `/night_mode?nightMode=<mode>` applies and returns to the referrer;
      a bare `/night_mode` renders the one-field form. `auto` follows
      `prefers-color-scheme` (media query in `src/styles/index.css` §18).
- [x] **[ROUTES #16] `/f/:forum/appearance`**, **[#17] delete forum**,
      **[#18–#20] moderator management** — for forums the user created.
      `add_moderator` is `ROLE_ADMIN` on the source, so it renders the 403;
      the moderator list itself is public and shows the standard empty state,
      `There are no entries to display.` (`flash.no_entries_to_display`,
      verified live on `/f/news/moderators`), for all 95 seeded forums.
- [ ] **[ROUTES #45, #46] Lock / unlock, pin / unpin** on moderated forums;
      a sticky submission renders at the top of the listing.
- [~] **[ROUTES #42–#44, #56–#59] Moderator/trash flows** — soft delete →
      `/trash`, restore, purge.
      **Done: #8 `/trash` (real page, scoped to moderated forums, empty on boot,
      and now really reachable — `trashComment()` in AppContext is the writer of
      `visibility: 'trashed'`), #56 `/comment/{cid}/delete` and #57
      `/delete_thread` (moderator form whose Reason field is read and stored as
      `trashReason`/`trashedBy`/`trashedAt`, 403 for a non-moderator exactly as
      the source). Verified: mod-deleting with reason `spam reason 42` puts the
      string in `/go` `current_state` and the comment on `/trash`.**
      Still open: #42–#44 submission mod_delete / purge / restore and #58/#59
      comment purge / restore.
- [x] **[ROUTES #92–#95] `/tags`, `/tag/:name`** — 0 tags, so a correct empty state
      is the whole job. `/tags` renders the `There are no entries to display.`
      empty index; `/tags/2` and every `/tag/{name}` 404, matching the source.
      **Both are now derived from `forums[].tags` instead of hard-coded, because
      `#forum_tags` on `/create_forum` and `/f/{name}/edit` is a live writer:**
      a tag created through the UI appears on `/tags`, and `/tag/{name}` +
      `/tag/{name}/{sortBy}` render the source's real listing over the forums
      carrying it (`forum_tag/tag.html.twig`: tag name `h1`, sort + time
      dropdowns only, cursor pager, sidebar with `Forums with this tag`).
      On a fresh seed nothing changes — every `/tag/{name}` still 404s, verified
      against the source. Round-tripped in a browser: create forum with tag
      `AlphaTag` → `/tags` lists it → its link resolves → a new post in that
      forum shows up in the listing → `/tag/AlphaTag/bogus` 404s.
- [x] **[ROUTES #27] `/moderation_log`, `/moderation_log/:page`** — the source
      returns **200** here (the mock used to 404) while `/f/{forum}/moderation_log`
      already renders the source's own `Global moderation log` button pointing at
      it, so it was a live dead link. Implemented as the source's page with its
      real empty state (`Global moderation log` + `There are no entries to
      display.`, empty sidebar); `#main` and `#sidebar` innerText diffed
      **identical** to the live source. The seed has no `forum_log_entry` rows,
      so the empty state is the complete implementation — no log entries were
      fabricated. `/moderation_log/1` 200, `/moderation_log/{0,2}` 404, all
      matching the source.
- [x] **[ROUTES #68, #70] `/user/{u}/delete_account`, `/user/{u}/block_user`** —
      both were rendered as links (`Delete this account` on `/account`,
      `Block user` in every other profile's Toolbox) while neither route was
      registered, so both dead-ended on `Page not found`. Both source templates
      are **real forms**, not empty states, so they are built as such; `#main`
      and `#sidebar` innerText diff **identical** to the live source on both.
      · `delete_account`: validates `#confirm_deletion_name` against the
      username and requires `#confirm_deletion_confirm`, then does exactly what
      the source's *response* does — flash `The account is being deleted.` and
      redirect to `/`. It never destroys the session user: the source deletes
      asynchronously via a `DeleteUser` message-bus dispatch, and real deletion
      is Out of Scope below.
      · `block_user`: appends `{username, timestamp, comment}` to
      `state.blockedUsers` (visible in `/go` `state_diff`), flashes
      `The user was blocked.`, redirects to `/user/{self}/block_list` — which now
      renders the source's live `Username | Blocked | Comment | Unblock` table
      instead of a hard-coded empty state. Both `@Security` guards reproduced:
      blocking yourself 403s and re-blocking 403s, matching the source. The
      Toolbox drops `Block user` and the sidebar grows the source's `Unblock`
      form once you are blocking someone.
      · **dev-fix-9:** these two plus `ForumDeletePage` still carried
      `noValidate`. The source's forms do not — `form_start(form)` with no
      attribute override, confirmed by fetching the *authenticated* render of
      `/user/MarvelsGrantMan136/delete_account` off the container:
      `<form name="confirm_deletion" method="post" class="form flow">`, with
      `<input type="text" id="confirm_deletion_name" … required="required">` and
      `<input type="checkbox" id="confirm_deletion_confirm" … required>`.
      `noValidate` is dropped and `ref={useNativeValidation(setErrors)}` added on
      all three, and the two `ConfirmDeletionType` checkboxes gained the source's
      `required`, so the native bubble fires **and** both Symfony messages land
      in `ul.form-error-list`. `ForumDeletePage` also never rendered its
      `errors.confirm` slot; it does now, in `form_row`'s errors-before-row
      position. `useNativeValidation` now strips the form's **own** `name` from
      the control id instead of everything up to the first `_` — Symfony form
      names can contain underscores (`confirm_deletion_name` is form
      `confirm_deletion`, field `name`), and the old regex keyed that as
      `deletion_name`, which matched no error slot.
- [x] **Out-of-range pagination 404s** — `/messages/{n}`,
      `/notifications/{n}` and `/f/{forum}/moderators/{n}` returned 200 where the
      source 404s (Pagerfanta raises `NotFoundHttpException`). Each source
      behaviour confirmed individually with curl before changing it; all three
      now `<NotFound />` on `page > 1 && items.length === 0`.
- [x] **`/subscribed` redirect divergence** — the source **302s** `/subscribed`
      → `/featured` (and `/subscribed/{sort}` → `/featured/{sort}`) when the user
      has zero subscriptions, whereas the mock rendered in place. Same visible
      page, different final URL, and `url_match` evaluators compare final URLs.
      Matched, including the query-string drop the source's `redirectToRoute()`
      performs (`/subscribed/top?t=week` → `/featured/top`), with `?sid=`
      re-attached. `/` deliberately does **not** redirect — `front()` swaps the
      listing in place. Documented in ROUTES.md "Redirects the mock reproduces".
- [x] **[ROUTES #96–#99] `/wiki`** — ~~a minimal wiki page + index + edit~~.
      **Re-scoped against the source: there is nothing to build.** `/wiki`,
      `/wiki/index` and `/wiki/<anything>` ALL return HTTP 404 on the live site,
      carrying the wiki's own in-layout miss page (`Page not found` /
      `The requested page was not found.`). The mock reproduces that miss for
      `/wiki`, `/wiki/*` and the `/w/*` shortcut. Building a wiki index or an
      editor would be fabricating content the corpus does not have.
- [ ] **[ROUTES #100, #101, #103–#105] Site admin** — the seeded user is not admin;
      the correct behaviour is the source's 403.
- [x] Markdown rendering in submission and comment bodies: links, bold/italic,
      blockquotes, lists, code, and the `[text](url)` form used by anchored comment
      `1235250`. Also Postmill's `/u/name` and `/f/name` autolinking — confirm
      against `/tmp/recon/reddit/src/Markdown/` (documented in `assets/README.md`
      "Formats").
- [x] Relative timestamps in Postmill's exact format (see `assets/README.md`
      "Formats") with the absolute date as a `title`/`<time datetime>` tooltip.
- [ ] User hover-poppers (`poppersEnabled` is `true` for the seeded user) —
      render client-side; do not call `/_up/:username`.

## Data Seed

Already extracted into `src/data/` — **do not regenerate, do not renumber**.
Full field docs in `assets/data_model.md`.

- [x] `forums.json` — **95** real forums (every forum on the source), real ids
      10000–10094, real `name`/`title`/`sidebar`/`description`/`created`, real
      `submissionCount`. All have `featured: false` and `subscriberCount: 0`.
- [x] `submissions.json` — **2,359** real submissions across all 95 forums,
      covering: all **57 anchored** submission ids; the hot/new/top head of each of
      the 40 task-relevant forums (33–51 each ⇒ 2 pages of 25); the
      most_commented / controversial / active heads; 769 image posts including all
      5 anchored image filenames. Real ids, titles, bodies, authors, `netScore`,
      `ranking`, `commentCount`, timestamps, and precomputed verified `slug`s.
      (2,345 originally + **14** carried over by dev fix 13 so that the
      webarena-27..31 profile-comment pages have no orphaned comments — see
      "Gaps" 3.)
- [x] `comments.json` — **2,593** real comments on 427 submissions: connected,
      multi-level trees for the 57 anchored submissions (≤60 each) plus both
      anchored comment ids (`1235250`, `1042264`) with full ancestor chains, and
      the top 2 top-level comments for the head of each deep forum.
      (2,505 originally + **88** carried over by dev fix 13: every real comment by
      `ziostraccette` (7) and `mineinhusdson` (42) plus their 39 real ancestors.)
- [x] `users.json` — **70** rich users (real join dates and real site-wide
      submission/comment/negative-comment counts), including the five users tasks
      webarena-27..31 resolve to. **Unchanged by dev fix 13** — in particular
      `mineinhusdson.negativeCommentCount` is still the true `1`.
- [x] `userDirectory.json` — **3,899** `username → join date` entries so every
      author link resolves (3,861 + 38 real join dates for the authors the fix-13
      rows introduced).
- [x] `currentUser.json` — `MarvelsGrantMan136`, all 25 real preference fields, the
      single real vote, empty subscriptions.
- [x] `images.json` + `public/submission_images/` + thumbnail caches — written by
      the asset extraction; verify the 5 anchored filenames are present and that
      `<img src>` uses `/submission_images/<sha256>.jpg`. **769** entries (765 + 4
      added by dev fix 13 for the image submissions its comments hang off),
      recompressed with the same rules the original extraction used: resize so
      `max(w,h) = 1000` when the source is larger, GIFs capped at 4 frames,
      70×70 / 140×140 centre-cropped thumbnails in the file's native format.

## Out of Scope

- **Submission images are intentionally recompressed (877 MB -> 77 MB).** Do NOT
  re-copy them from the container, do NOT file byte-size or pixel-dimension drift
  against the source as a defect, and do NOT add a thumbnail fallback path. All 765
  files are present and render correctly; `images.json` / `submissions.json` describe
  the shipped files. See SOURCE.md -> "Accepted deviations from the source".

- Login / logout / registration / password reset — app boots as `MarvelsGrantMan136`
- Atom feeds, `/opensearch.xml`, the `.json` read APIs
- `/ft.json` (auto-fetch a title from a URL) — would require an outbound request
- `/site/health_check`
- Server-rendered fragments (`/_up/:username`, `/comment_form/…`) — do the
  equivalent client-side
- Real permission enforcement, real CSRF, multi-user concurrency
- Postgres full-text ranking — client-side matching instead
- The other 38.5 GB of submission images

---

## Gaps / unverified — **do not silently guess past these**

1. **`/f/games` does not exist on the source (404).** It is webarena-644's
   `reference_url` and tasks 671–675 say "post in the games subreddit". There is a
   `gaming` forum but no `games`. The mock **matches the source and 404s**. This
   task is broken upstream; do not invent a `games` forum to paper over it.
2. **webarena-28's gold answer disagrees with the data.** It expects `0` negative
   comments for the author of the latest `WorcesterMA` post (`mineinhusdson`), but
   the DB says `1`. The seed carries the real value (`1`). Unfixable from here.
   **Dev fix 13 made this visible rather than accidental.** Before the fix
   `/user/mineinhusdson/comments` was empty in the mock, so an agent read `0` and
   the task "passed" for the wrong reason. All 42 of that user's real comments are
   now seeded, so the mock renders exactly what `:9999` renders — 42 comments, one
   at `−2`, i.e. the answer is `1` on **both** sides. Do **not** delete those rows
   to make the gold answer come out; that would make the mock more permissive than
   the site it stands in for. Measured this round: mock and source return the same
   42 comment ids **in the same order across both cursor pages**.
3. **Comment coverage is partial by design.** 427 of 2,359 seeded submissions have
   comments; the rest render an empty comment section while displaying their real
   `commentCount` (e.g. "76 comments" with none shown). Anchored submissions are
   never affected. If this reads badly in the audit, the fix is to seed more
   comments and split `comments.json` into modules — not to fake the count.
   **A user-profile comment page is a different matter** and is *not* covered by
   this allowance: task answers are read off `/user/<name>/comments`, so that page
   rendering "There are no entries to display." while the source has content is a
   P0, not a sampling artefact. That was BUG-001 (`ziostraccette`, webarena-29).
   **CLOSED by dev fix 13** for every user the task surface resolves to:

   | User | Reached via | Source comments | Seeded now | Negative | Anchor |
   |---|---|---:|---:|---:|---|
   | `nirinaron` | latest `/f/Showerthoughts` post 122512 | 0 | 0 | 0 | webarena-27 `0` ✅ |
   | `mineinhusdson` | latest `/f/WorcesterMA` post 123052 | 42 | 42 | 1 | webarena-28 `0` ❌ upstream (gap 2) |
   | `ziostraccette` | latest `/f/DIY` post 119019 | 7 | 7 | 1 | webarena-29 `1` ✅ |
   | `Dhghomon` | latest `/f/space` post 134164 | 0 | 0 | 0 | webarena-30 `0` ✅ |
   | `Proud_Idiot` | latest `/f/photoshopbattles` post 131461 | 0 | 0 | 0 | webarena-31 `0` ✅ |

   Carrying those comments required carrying **14 real submissions** they hang off
   (`16332 16335 16336 16354 16444 16447 25507 37565 46132 48107 56278 56349 56440
   114672`) and **39 real ancestor comments**, all extracted verbatim with
   `docker exec forum psql` SELECTs. None of them lands in the top 12 of any
   forum's hot/top/new/active listing, so no listing-order anchor moved.
3b. **`/user/MarvelsGrantMan136/comments` is thin, and is deliberately left thin.**
   The source shows 28 comments there; the seed has 1. It is *not* the empty-page
   defect of gap 3 (the page renders), no task reads it, and the anchors on
   `/user/MarvelsGrantMan136` only assert `.user-bio__biography`. Carrying the
   other 27 would drag in **23 more submissions, 5 of them in `/f/movies`**, which
   is exactly the forum webarena-717 ranks with "top 4 post ever" — a real anchor
   risk for zero task gain. If a future round wants it, seed the comments and the
   23 submissions together and re-verify `/f/movies?sort=top` positions 1–5 first.
4. **365 of 2,359 submission bodies were truncated to 350 chars** (marked
   `bodyTruncated: true`). Never on an anchored submission or on the hot/top-10 of
   a task-relevant forum. Same for 900-char comment truncation. The 14 submissions
   and 88 comments added by dev fix 13 carry their **full** untruncated bodies.
5. **Shallow forums are thin.** The 55 forums no task touches have ≤14 seeded
   submissions against real counts in the hundreds or thousands, so page 1 does
   not fill and there is no page 2 there.
6. **`/f/:forum/edit` and `/users` returned 403** for `MarvelsGrantMan136` on the
   live site — she moderates nothing and is not admin, so those pages could not be
   render-confirmed. **RESOLVED for `/f/:forum/edit`** (dev shard A): the field
   list was read out of the container's own
   `templates/forum/_form.html.twig` + `src/Form/ForumType.php`, and every id
   was then render-confirmed in the MOCK by creating a forum via
   `/create_forum` and opening `/f/<new>/edit`. The form is exactly
   `#forum_name` · `#forum_title` · `#forum_description` · `#forum_sidebar` ·
   `#forum_tags` · `#forum_moderationLogPublic`
   (`set_log_visibility`, moderator-granted); `#forum_featured` is
   `ROLE_ADMIN`-only and therefore absent, and **there is no
   `#forum_suggestedTheme` on this page** — `suggestedTheme` lives on
   `/f/:forum/appearance` (`ForumAppearanceType`). `assets/README.md` §9 lists
   `suggestedTheme` here in error. `#forum_description` and `#forum_sidebar`
   are real `<textarea>`s and were confirmed to carry the saved value on a
   COLD deep-link (fresh browser context, `?sid=` only).
7. **~~Five~~ ~~three~~ two `UNVERIFIED:` items remain, itemised at the end of
   `assets/README.md`** — the `/submit` button label and the remaining forum-edit
   field ids.
   **The `/user/:name/comments` ordering item is RESOLVED** (dev fix 13). Measured
   directly against `:9999` on the two users that now have multi-page histories:
   the list is `timestamp DESC, id DESC` and pages with the cursor pair
   `next[timestamp]` + `next[id]` behind a **`More`** button in
   `nav.pagination li.next`, 25 per page. Mock and source returned identical
   comment-id sequences for `ziostraccette` (7, one page) and `mineinhusdson`
   (42, two pages).
   **Item 1 (the `.empty__emoji` character) is RESOLVED.** Probed live:
   `/f/books/top?t=day` emits
   `<div class="empty"><div class="empty__emoji" role="img" aria-label="A tense emoji">(ﾟдﾟ)</div><div class="empty__text">There's nothing here…</div></div>`
   — note both children are `<div>`, not `<span>` as `assets/README.md`
   "Empty states" implies. It is rendered by `forum/forum.html.twig` **only**:
   `/top?t=day` (front) and `/f/books+news/top?t=day` (multireddit) emit
   nothing at all for an empty listing. `ListingPage.jsx` now matches that
   three-way behaviour exactly.
   **Item 5 (whether `/search` interleaves comment hits with
   submission hits) is RESOLVED: it does.** Probed live — `?q=bookshop`
   returns `50 results`, rendered as 5 `article.submission` followed by 45
   `article.comment`, i.e. submissions first and then comments, capped at 50
   with no pager. The empty state is
   `<h2>No results for <em>q</em></h2>` (no trailing colon) plus
   `<p><small class="fg-muted text-md">There are no entries to display.</small></p>`.
   **Item 2 (the `/submit` button label) is RESOLVED: `Create submission`.**
   `assets/html/submit-auth.html` renders
   `<div class="form__row form__button-row"><button class="button">Create
   submission</button></div>` (`submission_form.create`), and
   `14-submit-form.png` shows the same. The edit variant is `Edit submission`
   (`submission_form.edit`).
   **Item 3 (the forum-edit field ids) is RESOLVED** — see gap 6 above.
   The remaining two (`.empty__emoji`, the `/user/:name/comments` ordering) are
   answerable from `assets/screenshots/reference/` and the `-auth` captures in
   `assets/html/` without touching the source again. **Resolve them from those
   files rather than guessing.**

   Two corrections to the spec, found while building `/submit`:
   * **There is no "Text" media tab.** `SubmissionType.php` offers exactly
     `['label.url' => url, 'label.image' => image]`, and `14-submit-form.png`
     shows only `URL` and `Image`. A text post is a URL post with the URL left
     blank. The TODO's "URL / Image / Text" phrasing is wrong.
   * **The URL field is NOT required.** `SubmissionData::$url` carries only
     `@Assert\Length` + `@Assert\Url`, no `NotBlank`, and the rendered input has
     no `required` attribute — so there is no "URL post with no URL" error to
     copy. The reachable messages are Symfony's `NotBlank`
     (`This value should not be blank.`, on title and forum) and `Url`
     (`This value is not a valid URL.`). Likewise there is **no "forum does not
     exist" string** anywhere in `translations/`; `/submit/<unknown>` 404s via
     the ParamConverter, which is what the mock does.
8. **`messages`, `message_threads`, `notifications`, `wiki_pages` were not
   sampled.** They are implemented as empty states. `/wiki` itself **404s** on the
   source (no index page exists). If a later round needs populated inboxes,
   re-query the container.
9. **Only 64 full-size images** were extracted from the 38.5 GB store (the top
   image posts by `netScore`, plus all 5 anchored filenames). All **765** seeded
   image posts do have both thumbnails, generated with Postmill's exact
   LiipImagine parameters (70×70 / 140×140, `mode: outbound`, quality 60). Posts
   without a full-size copy should fall back to the 2× thumbnail; `images.json`
   records `full`/`thumb1x`/`thumb2x` per file plus the real `w`/`h`.
   `public/` totals ~25 MB.
10. **`src/data/images.json` (100 KB) is a static asset manifest, not mutable
    state.** Import it directly in components; do **not** put it into
    `createInitialData()`'s return value, or it inflates every `/go` diff for no
    reason. That keeps the live state at ~2.1 MB.
