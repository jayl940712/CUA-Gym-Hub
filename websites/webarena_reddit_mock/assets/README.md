# reddit (Postmill) — View Inventory

> Source: <http://localhost:9999> · container `forum` · Postmill / Symfony 5 / Twig
> Templates read from `/var/www/html/templates` (copied to `/tmp/recon/reddit/templates`)
> Copy verified against `assets/source/messages.en.yml` (the app's own translation
> catalogue, 623 keys, copied verbatim out of the container) and against the raw
> captures in `assets/html/`.
> Screenshots: `assets/screenshots/reference/` (34 views, 1920×1080, logged in as
> `MarvelsGrantMan136`).

**Every string below is copied from a template, the translation catalogue, or a
real captured page.** Anything I could not confirm is marked `UNVERIFIED:`.

`assets/source/messages.en.yml` is the authoritative copy file — when this
document says a label comes from `action.upvote`, dev should look it up there
rather than trusting a paraphrase.

---

## 0. Global shell

`templates/base.html.twig`. Body order:

```html
<body class="user-logged-in js-poppers-enabled">
  <div class="site-alerts">…flash messages…</div>
  <nav class="site-accessibility-nav">
    <a href="#main"    class="site-accessibility-nav__link">Jump to main content</a>
    <a href="#sidebar" class="site-accessibility-nav__link">Jump to sidebar</a>
  </nav>
  …site nav…
  <div class="site-content content-container">
    <main  class="site-content__body body flow"     id="main">…</main>
    <aside class="site-content__sidebar sidebar flow" id="sidebar">…</aside>
  </div>
  <footer class="site-footer">…</footer>
</body>
```

`<html>` carries `class="no-js"` → `js` (swapped by an inline script),
`data-night-mode="light"` (from the user's `night_mode`), and
`class="full-width"` when `fullWidthDisplayEnabled`.

Widths and colours: `DESIGN.md` §4. `#main` and `#sidebar` **must keep those
ids** — `#sidebar > section` is a WebArena evaluator locator.

### 0.1 Site nav (`templates/_layouts/site_nav.html.twig`)

A single full-width bar, background
`linear-gradient(to right, #e10, #c00)`, links at 16px with `padding: .875em 1em`.
Left→right: site wordmark (`Postmill`, from the `sites.site_name` row), the main
menu, a centred pill search box, then the user menu on the right.

Labels, from `messages.en.yml`:

| Key | Text |
|---|---|
| `nav.home` | `Home` |
| `nav.forums` | `Forums` |
| `nav.wiki` | `Wiki` |
| `nav.submit` | `Submit` |
| `nav.search` | `Search` |
| `nav.notifications` | `Notifications` |
| `nav.notifications_count` | `Notifications (%count%)` |
| `nav.messages` | `Messages` |
| `nav.logged_in_as_user` | `Logged in as %user%` |
| `nav.profile` | `Profile` |
| `nav.my_account` | `My account` |
| `nav.user_settings` | `User settings` |
| `nav.block_list` | `Block list` |
| `nav.hidden_forums` | `Hidden forums` |
| `nav.dark_mode` / `nav.light_mode` | `Dark mode` / `Light mode` |
| `action.log_out` | `Log out` |
| `nav.site_settings` | `Site settings` (admin only) |
| `nav.themes` | `Themes` (admin only) |
| `nav.user_bans` / `nav.ip_bans` | `User bans` / `IP bans` (admin only) |
| `nav.global_moderation_log` | `Global moderation log` |
| `nav.trash` | `Trash` |
| `nav.places` | `Places` |
| `nav.actions` | `Actions` |

Search input: `class="site-nav__search-input"`, pill-shaped, transparent until
focused, with a `site-nav__search-label` magnifier icon overlaid. Submits GET to
`/search` with `q`.

Notification badge: the nav item gets `site-nav__has-notifications`
(background `--notification` = `#f60`) when the count is non-zero.

See `assets/screenshots/reference/27-nav-user-menu.png` for the opened user
dropdown.

### 0.2 Sidebar

`#sidebar` holds zero or more `<section class="sidebar__section flow">`, each with
`<h1 class="sidebar__title">`. `.sidebar:empty { display:none }`, so a view with
no sections shows no sidebar column at all.

Per-view sidebar contents are documented under each view below.

### 0.3 Footer

```html
<footer class="site-footer">
  <p><span class="fg-muted text-xs page-shadow">Running <a href="https://postmill.xyz/">Postmill</a> </span></p>
</footer>
```

From `site_footer.app: Running %app% %version%` — `%version%` is empty on this
build, hence the trailing space. Per `TRADEMARKS.md`, alter the wordmark in the
mock.

### 0.4 Flash / alert region

```html
<div class="site-alerts">
  <div class="alert alert--<type> site-alerts__alert" role="alert">
    <icon/>
    <div class="alert__text"><p>…message…</p></div>
    <button class="site-alerts__dismiss unbuttonize"><span class="hidden">Dismiss</span></button>
  </div>
</div>
```

`action.dismiss: Dismiss`. Flash copy is the `flash.*` block of
`messages.en.yml` — e.g. `flash.submission_edited: The submission was edited.`,
`flash.forum_updated: The changes have been saved.`,
`flash.user_biography_updated: The biography was updated.`,
`flash.submission_deleted: The submission was deleted.`,
`flash.notifications_cleared: Your notifications have been cleared.`

---

## 1. Front page `/` — `templates/front/*.html.twig`

Screenshot: `01-front-page.png`, `02-front-new.png`, `26-front-top-timefilter.png`.
Capture: `assets/html/root.html`, `root-auth.html`.

**It renders EMPTY for the seeded user.** `/` dispatches to the user's
`front_page` view; `MarvelsGrantMan136` has `subscribed` and zero subscriptions.
The main column contains only the nav bar, and the sidebar has one section:

```html
<section class="sidebar__section flow">
  <h1 class="sidebar__title">Featured forums</h1>
  <p class="fg-muted"><small class="text-sm">There are no featured forums to display.</small></p>
</section>
```

(`front.featured_forums: Featured forums`, `front.no_forums: There are no
featured forums to display.`)

Once the user subscribes to a forum, that section becomes
`front.subscribed_forums: Subscribed forums` listing the subscribed forum names.
`front.no_subscriptions: You are not subscribed to any forum. Showing featured
forums instead.` is the copy for the fallback case.
**This is what webarena-595..599 assert on via `#sidebar > section`.**

### Nav bar above the listing (`forum/_list_nav.html.twig`), verbatim

```html
<nav class="flex flex--guttered">
  <ul class="unlistify flex">
    <li><a href="/"         class="tab tab--active">Submissions</a></li>
    <li><a href="/comments" class="tab ">Comments</a></li>
  </ul>
  <ul class="unlistify flex">
    <li class="dropdown">
      <button class="dropdown__toggle tab no-underline unbuttonize" aria-label="Filter on: Featured">
        <span class="icon"><svg…#filter/></svg></span>
        <span class="no-underline__exempt">Featured</span>
        <span class="dropdown__arrow"></span>
      </button>
      <ul class="dropdown__menu dropdown-card unlistify">
        <li><a href="/featured/hot" class="no-wrap menu-item menu-item--active">Featured</a></li>
        <li><a href="/all/hot"      class="no-wrap menu-item ">All</a></li>
      </ul>
    </li>
    <li class="dropdown">
      <button class="dropdown__toggle tab no-underline unbuttonize" aria-label="Sort by: Hot">
        <span class="icon"><svg…#sort/></svg></span>
        <span class="no-underline__exempt">Hot</span>
        <span class="dropdown__arrow"></span>
      </button>
      <ul class="dropdown__menu dropdown-card unlistify">
        <li><a href="/hot"                    class="no-wrap menu-item menu-item--active">Hot</a></li>
        <li><a href="/new"                    class="no-wrap menu-item ">New</a></li>
        <li><a href="/active"                 class="no-wrap menu-item ">Active</a></li>
        <li><a href="/top?t=day"              class="no-wrap menu-item ">Top</a></li>
        <li><a href="/controversial?t=day"    class="no-wrap menu-item ">Controversial</a></li>
        <li><a href="/most_commented?t=day"   class="no-wrap menu-item ">Most commented</a></li>
      </ul>
    </li>
  </ul>
</nav>
```

Note that Top / Controversial / Most commented are linked **with `?t=day`
appended**, while Hot / New / Active are not. Reproduce that exactly.

Filter dropdown values (logged in it also offers Subscribed and Moderated):

| Key | Text |
|---|---|
| `front.featured` | `Featured` |
| `front.all` | `All` |
| `front.subscribed` | `Subscribed` |
| `label.moderated` | `Moderated` |
| `label.filter_on_mode` | `Filter on: %mode%` (the `aria-label`) |
| `label.sort_by_mode` | `Sort by: %mode%` (the `aria-label`) |

Sort labels: `submission.sort_by_hot: Hot`, `…_new: New`, `…_active: Active`,
`…_top: Top`, `…_controversial: Controversial`, `…_most_commented: Most commented`.

Time-filter labels: `submission.time_all: All time`, `time_day: Past 24 hours`,
`time_week: Past week`, `time_month: Past month`, `time_year: Past year`.

Empty listing copy: `content.empty: There's nothing here…` inside
`<div class="empty"><span class="empty__emoji">…</span><p class="empty__text">…</p></div>`.
`UNVERIFIED: the exact emoji character in .empty__emoji` — it was not present in
the captures because the seeded front page renders no `.empty` block at all,
only an absent listing. Check `assets/screenshots/reference/26-front-top-timefilter.png`.

---

## 2. Forum listing `/f/{name}` — `templates/forum/forum.html.twig`

Screenshots: `03-forum-news.png`, `04-forum-news-top.png`, `29-forum-books.png`,
`19-forum-pics-thumbnails.png`.
Captures: `f_news.html`, `f_news_{new,top,active,controversial,most_commented}.html`,
`f_books.html`, `f_pics.html`, `f_news-auth.html`.

Main column: the same tab/filter/sort nav as §1 (tabs are `Submissions` /
`Comments` pointing at `/f/{name}` and `/f/{name}/comments`), then 25 submission
rows, then the pager.

### Sidebar, verbatim from `/f/books`

```html
<section class="sidebar__section flow">
  <h1 class="sidebar__title forum-title break-text"><a href="/f/books">books</a></h1>
  <div class="forum-sidebar-content break-text text-flow"><p lang="vi" dir="ltr">t5_2qh4i</p></div>
  <hr>
  <ul class="text-sm unlistify">
    <li class="fg-muted">Created <time datetime="2022-10-01T02:17:55+00:00"
        title="October 1, 2022 at 2:17:55 AM UTC">October 1, 2022</time></li>
    <li><a href="/f/books/new.atom" rel="alternate" type="application/atom+xml" class="no-underline">
      <span class="icon fg-orange"><svg…#rss-squared/></svg></span>
      <span class="no-underline__exempt">Subscribe via RSS</span></a></li>
  </ul>
</section>

<section class="sidebar__section flow">
  <h1 class="sidebar__title">Toolbox</h1>
  <ul class="unlistify sidebar__no-padding">
    <li><a href="/f/books/bans"           class="menu-item ">Bans</a></li>
    <li><a href="/f/books/moderation_log" class="menu-item ">Moderation log</a></li>
  </ul>
</section>
```

The `forum-sidebar-content` block is the forum's `sidebar` column rendered as
markdown — in this corpus that is the scraped Reddit id (`t5_2qh4i`), which is
why it shows up as a one-word paragraph. Render it as-is.

Copy: `forum.created_on: 'Created %timestamp%'`, `action.subscribe_via_rss:
Subscribe via RSS`, `label.toolbox: Toolbox`, `nav.bans: Bans`,
`nav.moderation_log: Moderation log`.

Logged in, the sidebar additionally shows the **Subscribe button** (§17) and, for
a forum the user moderates, `forum.edit: Edit forum`, `forum.delete: Delete
forum`, `forum.moderators: Moderators`, `nav.appearance: Appearance`.
Counts: `forum.submission_count: '{0} No submissions|{1} %formatted_count%
submission|[1,Inf[ %formatted_count% submissions'` and
`forum.subscriber_count: '{0} No subscribers|{1} %formatted_count%
subscriber|[1,Inf[ %formatted_count% subscribers'`.

**Resolved from `03-forum-news.png` (logged in).** The full sidebar order on
`/f/news` is:

1. `section.sidebar__section` — the forum card:
   `<h1>` with the forum name in brand red, then **immediately below it** a
   horizontal pair: a `Subscribe` button (secondary style, grey) butted against a
   bordered count box reading `0`; then the forum's `sidebar` markdown
   (`t5_2qh3l`), an `<hr>`, `Created 4 years ago`, and the orange-icon
   `Subscribe via RSS` link.
2. `<details class="sidebar__section flow">` — a collapsed disclosure with the
   summary `Hide this forum` (`heading.hide_this_forum`).
3. `section.sidebar__section` — `Toolbox` with `Bans` and `Moderation log`.

Also visible on that screenshot: the main column's `<h1>` is `/f/news`, and the
sort control is a single `.tab` dropdown labelled `Hot` with the sort icon —
there is no separate filter dropdown on a forum page (that one is front-page
only).

---

## 3. Submission row in a listing — `templates/_layouts/submission.html.twig`

The most-reused component on the site. Real markup from
`/f/news/129508/…` (detail view; the listing row is identical minus
`.submission--expanded`):

```html
<article class="submission submission--has-url submission--has-body
                submission--expanded submission--visibility-visible">
  <div class="submission__row">                 <!-- flex-direction: row-reverse -->
    <div class="submission__inner">
      <header class="submission__header">
        <div class="submission__title-row break-text">
          <h1 class="submission__title unheaderize inline">
            <a href="https://apnews.com/article/…"
               class="submission__link"
               rel="nofollow noreferrer noopener"
               target="_self">Tennessee governor OKs bill to cut Nashville council in half</a>
          </h1>
          <a href="/search?q=apnews.com" class="submission__host text-xs">apnews.com</a>
        </div>
        <p class="submission__info">
          <span class="text-sm fg-muted">
            Submitted by
            <a href="/user/Hrekires" class="submission__submitter fg-inherit"><strong>Hrekires</strong></a>
            <small class="fg-grey text-sm user-flag">t3_11n9e44</small>
            <time class="submission__timestamp"
                  data-controller="relative-time"
                  datetime="2023-03-10T00:39:36+00:00"
                  title="March 10, 2023 at 12:39:36 AM UTC">on March 10, 2023 at 12:39 AM</time>
            in <a href="/f/news" class="submission__forum fg-inherit"><strong>news</strong></a>
          </span>
        </p>
      </header>
      <div class="submission__content flow-slim">
        <div class="submission__body break-text text-flow">…rendered markdown…</div>
      </div>
      <nav class="submission__nav">
        <ul class="unlistify fg-muted flex flex--guttered">
          <li><a href="/f/books/59421/friendly-reminder-bookshop-org-exists" class="text-sm"><strong>125 comments</strong></a></li>
          …Edit / Delete / Permalink / moderator actions…
        </ul>
      </nav>
    </div>
    <div class="submission__vote">…see §16…</div>
  </div>
</article>
```

Element order **as rendered** (the vote column is markup-last but paints first
because of `flex-direction: row-reverse`):

1. `div.submission__vote` — up arrow, score, down arrow
2. `img.submission__thumb` (image posts only, `width=70 height=70`, absolutely
   positioned; `.submission--has-thumbnail .submission__inner` reserves
   `calc(1rem + 70px)` of left padding)
3. `h1.submission__title > a.submission__link` — the title
4. `a.submission__host.text-xs` — the link's host **in a link to
   `/search?q=<host>`**, no parentheses, immediately after the title
5. `p.submission__info` — the byline
6. `div.submission__body` — rendered markdown (collapsed listings omit it)
7. `nav.submission__nav` — comment count first, then actions

`article` class list, from `block submission_classes`:

```
submission
submission--has-url          (when url is set)
submission--has-body         (when body is not null)
submission--collapsed | submission--expanded
submission--sticky           (when sticky)
submission--locked           (when locked)
submission--has-thumbnail
submission--visibility-visible | --soft-deleted | --trashed
```

**Where the title links** depends on `submissionLinkDestination` (block
`submission_url`), which is `url` for the seeded user:

- external URL when the submission has one;
- `/submission_images/<file>` for an image post;
- otherwise the canonical `/f/{forum}/{id}/{slug}`.

With the setting flipped to `submission`, the title always links to the
submission page. `submission_link_destination.label: When clicking submission
links…`, `…url: Open the linked content`, `…submission: Open the submission`.

Comment count: `submission.comments: '{0} No comments|{1} %count% comment|[1,Inf[
%count% comments'` — so `No comments` / `1 comment` / `125 comments`, rendered
inside `<strong>`.

Sticky/locked notices: `submission.pinned: This submission is pinned`,
`submission.locked: This submission is locked`.

Edited notices: `submission.edit_info: (edited %edited_at%)` and
`submission.moderator_info: (edited by a moderator %edited_at%)`.

Deleted placeholder: `<del>[deleted]</del>` (`placeholder.deleted: '[deleted]'`),
and `submission.deleted_by_moderator: Deleted by a moderator`.

---

## 4. Submission detail + comment tree — `templates/submission/submission.html.twig`, `comment/list.html.twig`, `_layouts/comment.html.twig`

Screenshots: `05-submission-comments.png`, `06-submission-nested-comments.png`,
`25-submission-image-post.png`, `34-submission-machinelearning-1.png`,
`28-submission-linear.png`.
Captures: `f_news_129508_….html`, `f_books_59421_….html`,
`f_singularity_69404_….html`, `submission_129508-auth.html`.

Above the submission there is a "return to forum" nav:

```html
<nav><ul class="flex flex--guttered unlistify"><li>
  <a href="/f/news" class="flex flex--slim-gutters flex--align-center fg-text" title="Return to /f/news">
    <span class="icon icon--circled text-xl"><svg…#left-small/></svg></span>
    <span class="text-lg">/f/<strong>news</strong></span>
  </a></li></ul></nav>
```

(`comments.return_to_forum: Return to %forum%`)

Then the submission (§3, `--expanded`), then the comment-form, then the
**Nested / Linear** tab pair:

```html
<a href="/f/books/59421/friendly-reminder-bookshop-org-exists"        class="tab tab--active">Nested</a>
<a href="/f/books/59421/friendly-reminder-bookshop-org-exists/linear" class="tab ">Linear</a>
```

(`comments.nested: Nested`, `comments.linear: Linear`)

### Comment markup, verbatim

```html
<article class="comment comment--top-level comment--visibility-visible hideable"
         id="comment_1235250" data-level="1">
  <input type="checkbox" class="hideable__checkbox" id="comment_toggle_1235250" checked>
  <div class="comment__row">
    <div class="comment__main">
      <header class="comment__header">
        <h1 class="comment__info break-text unheaderize">
          <span class="fg-muted text-sm">
            <a href="/user/ameliaspond" class="fg-inherit"><strong>ameliaspond</strong></a>
            <small class="fg-grey text-sm user-flag">t1_j2eg7wq</small>
            wrote <time data-controller="relative-time"
                        datetime="2022-12-31T17:36:15+00:00"
                        title="December 31, 2022 at 5:36:15 PM UTC">on December 31, 2022 at 5:36 PM</time>
          </span>
        </h1>
        <ul class="flex unlistify"><li>
          <label class="comment__info-link comment__hide-toggle hideable__toggle fg-grey no-wrap"
                 for="comment_toggle_1235250">
            <span class="hideable__indicator text-sm" role="presentation"
                  data-hide-text="Hide" data-unhide-text="Unhide"></span>
          </label>
        </li></ul>
      </header>
      <div class="comment__content flow-slim hideable__hide">
        <div class="comment__body break-text text-flow">
          <p lang="af" dir="ltr">I'm a manager at an indie bookstore and I agree,
            <a rel="nofollow noopener noreferrer" href="https://Bookshop.org">Bookshop.org</a> is wonderful! …</p>
        </div>
      </div>
      <nav class="comment__nav hideable__hide">
        <ul class="fg-muted flex flex--guttered unlistify">
          <li><a href="/f/books/59421/-/comment/1235250" class="comment__permalink fg-inherit text-sm">Permalink</a></li>
          …Reply / Edit / Delete / Parent…
        </ul>
      </nav>
    </div>
    <div class="comment__vote hideable__hide">…form.vote action="/cv/1235250"…</div>
  </div>
  <div class="comment__replies">…nested <article class="comment comment--nested">…</div>
</article>
```

Key details:

- `id="comment_<id>"` — the permalink anchor; `.comment:target { outline: solid var(--primary) }`.
- `data-level="1"` on top-level, incrementing per depth.
- Classes: `comment--top-level` vs `comment--nested`, plus
  `comment--visibility-visible|soft-deleted|trashed`, plus `hideable`.
- Collapse is **pure CSS**: a checked `input.hideable__checkbox` + a `<label>`
  toggle whose indicator carries `data-hide-text="Hide"` /
  `data-unhide-text="Unhide"`. Collapsing hatches the header and hides
  `.hideable__hide` (content, nav, vote).
- Nesting container is `div.comment__replies` — `padding-left: 1rem` + a 3px
  `--border-light` rail. **No depth cap.**
- `.comment__body` is a WebArena evaluator locator.

Byline copy: `comments.info: '%user% wrote %timestamp%'`.
Edited: `comments.edit_info: (edited %edited_at%)`,
`comments.moderator_info: (edited by a moderator %edited_at%)`.
Deleted: `comments.deleted_by_moderator: Deleted by a moderator`.
Actions: `comments.reply: Reply`, `comments.parent: Parent`,
`nav.permalink: Permalink`, `action.edit: Edit`, `action.delete: Delete`,
`action.delete_thread: Delete thread`, `action.purge: Purge`,
`action.restore: Restore`.
Delete confirm: `prompt.confirm_comment_delete: Are you sure you want to delete
this comment?`

### Comment ordering — read from the entity code, not guessed

`src/Entity/Submission.php` and `src/Entity/Comment.php`:

| View | Order |
|---|---|
| Nested — top-level comments | **`netScore DESC`** (`Submission::getTopLevelComments()`, `usort` on net score) |
| Nested — replies at every depth | **`netScore DESC`** (`Comment::getChildren()`, `Criteria::orderBy(['netScore' => 'DESC'])`) |
| Linear | **`timestamp ASC`** (`Submission::getComments()`, `orderBy(['timestamp' => 'ASC'])`) |

### Comment form

`comment/_form.html.twig`. Top-level box sits between the submission and the
tree; a Reply link swaps in an inline form under that comment
(`/comment_form/{forumName}/{submissionId}/{commentId}` fetches the fragment on
the real site — do it client-side in the mock).

Copy: `comment_form.create_title: Posting a comment`,
`comment_form.edit_title: Editing comment`,
`comments.replying_to_comment: Replying to %user% (%id%)`,
`label.comment: Comment`, `action.post: Post`,
`markdown.allowed: Markdown allowed.`, `markdown.help: Formatting help`,
`markdown.preview: Preview`.
Validation: `comment.empty: The comment must not be empty.` (validators.en.yml)
Locked: `flash.submission_is_locked: The submission is locked. You cannot post
new comments.`

---

## 5. Comment permalink `/f/{f}/{id}/{slug}/comment/{cid}` — `templates/submission/comment.html.twig`

Screenshot: `07-comment-permalink.png`. Capture:
`f_books_59421_-_comment_1235250.html`, `f_singularity_69404_-_comment_1042264.html`.

Renders the submission header, then a notice, then only the target comment and
its subtree:

- `comments.viewing_thread: Viewing a single comment thread.`
- `comments.thread_return: View all comments` — the link back to the full page.

Both anchor routes use the `-` slug form (`/f/books/59421/-/comment/1235250`),
which is what Postmill generates when it does not have the title handy. Any slug
resolves.

---

## 6. `/forums` and `/forums/all` — `templates/forum/list.html.twig`, `list_all.html.twig`, `_layouts/forum_card.html.twig`

Screenshots: `08-forums-list.png`, `09-forums-all.png`.
Captures: `forums.html`, `forums_all.html`, `forums_by_name.html`,
`forums_by_subscribers.html`, `forums_by_creation_date.html`,
`forums_by_submissions_2.html`.

Tabs: `Forums` (`/forums`, `tab--active`) and `/forums/all`
(`nav.alphabetical: Alphabetical`), plus an **Order by** dropdown
(`label.order_by: Order by`) with the five `by_*` values. `forum_list.page_title:
List of forums`. Column headers: `forum_list.submission_count: Submissions`,
`forum_list.subscribers: Subscribers`, `label.name: Name`, `label.title: Title`,
`label.creation_date: Creation date`.

Pagination here is **offset**, as a path segment:
`<link rel="prev" href="/forums">`, `<link rel="next" href="/forums/by_submissions/3">`.

`/forums/all` is a flat A–Z list of all 95 forums with no pagination.

`label.forums_count: '{0} No forums|{1} %count% forum|]1,Inf[ %count% forums'`

---

## 7. `/submit` and `/submit/{forum}` — `templates/submission/create.html.twig`, `_form.html.twig`

Screenshots: `14-submit-form.png`, `31-submit-forum-prefilled.png`.
Captures: `submit-auth.html`, `submit_books-auth.html`.
**Anonymous access 302s to `/login`; use the `-auth` captures.**

**This is the single most important form on the site — 98 of 129 tasks use it.**

Copy: `title.create_submission: Create submission`,
`submission_form.create: Create submission`,
`submission_form.edit: Edit submission`.

Fields (`label.*` keys):

| Field | Label | Notes |
|---|---|---|
| Forum | `label.forum: Forum` | select2 typeahead over forum names; pre-filled and shown when arriving at `/submit/{forum}` |
| Media type | `label.media_type: Media type` | tabs: `label.url: URL` · `label.image: Image` · `label.text: Text` (`.form-tabs`) |
| URL | `label.url: URL` | max 2000 (`Submission::MAX_URL_LENGTH`) |
| Upload image | `label.upload_image: Upload image` | file input + drop zone |
| Title | `label.title: Title` | max 300 (`MAX_TITLE_LENGTH`); auto-fetched from the URL when `autoFetchSubmissionTitles` (via `/ft.json` — **not migrated**, so the mock leaves it manual) |
| Body | `label.body: Body` | markdown textarea, max 25000 (`MAX_BODY_LENGTH`) |
| Post as | `user_flag.post_as_label: Post as` | `user_flag.none_label: (none)`, `user_flag.moderator_label: Moderator`, `user_flag.admin_label: Admin` — only shown when the user has a role |

Submit button: `action.create: Create` (`UNVERIFIED: whether the button reads
"Create" or "Create submission"` — confirm against `14-submit-form.png`).

Help/validation copy: `help.required_field: This field is required.`,
`flash.too_many_characters: You entered too many characters (max %max%, %count%
entered)`, `ratelimit.error: You cannot post more. Wait a while before trying
again.`, `markdown.allowed: Markdown allowed.`

On success Postmill redirects to the canonical
`/f/{forum}/{id}/{slug}` — **that redirect is scored**, see `TODO.md`.

---

## 8. Edit submission / edit comment / delete confirmations

`templates/submission/edit.html.twig`, `comment/edit.html.twig`,
`submission/delete_with_reason.html.twig`, `comment/delete.html.twig`.

| Key | Text |
|---|---|
| `title.editing_submission` | `Editing submission %title%` |
| `comment_form.edit_title` | `Editing comment` |
| `title.delete_submission` | `Delete submission` |
| `title.delete_comment` | `Delete comment` |
| `title.delete_comment_thread` | `Delete comment thread` |
| `prompt.confirm_submission_delete` | `Are you sure you want to delete this submission?` |
| `prompt.confirm_comment_delete` | `Are you sure you want to delete this comment?` |
| `label.reason` | `Reason` |
| `action.save_changes` | `Save changes` |
| `action.delete` | `Delete` |

Editing sets `edited_at`, which renders as `(edited <time>)` in the byline.

---

## 9. `/f/{name}/edit` — `templates/forum/edit.html.twig`, `_form.html.twig`

Screenshot: `15-forum-edit.png` — **the capture returned HTTP 403** for
`MarvelsGrantMan136`, because `moderators` is empty on the source and she is not
admin. Everything below is therefore **template-derived**, not render-confirmed.
It becomes reachable in the mock for a forum the user creates via
`/create_forum`.

Title: `title.editing_forum: Editing forum %forum%` / `edit_forum.title: Editing
%forum%`.

Fields — the Symfony form is named `forum`, so field ids are `forum_<name>`:

| Field id | Label key → text | Control | Notes |
|---|---|---|---|
| `#forum_name` | `label.name: Name` | text | `help.will_appear_in_the_url: Will appear in the URL.` |
| `#forum_title` | `label.title: Title` | text | |
| **`#forum_description`** | `label.description: Description` | text/textarea | `help.forum_description: A short description of the forum. Search engines will present this description in their results.` — **WebArena evaluator reads `document.querySelector("#forum_description").value`** |
| **`#forum_sidebar`** | `label.sidebar: Sidebar` | textarea (markdown) | **WebArena evaluator reads `document.querySelector("#forum_sidebar").value`** |
| `#forum_tags` | `label.tags: Tags` | tag input | `tag.invalid_characters`, `tag.too_short`, `tag.too_long` |
| `#forum_featured` | `forum_form.featured: Show on front page` | checkbox | admin only |
| `#forum_moderationLogPublic` | `forum_form.moderation_log_public: Moderation log is public` | checkbox | |
| `#forum_suggestedTheme` | `label.suggested_theme: Suggested theme` | select | |

Save: `action.save: Save` / `action.save_changes: Save changes`;
flash `flash.forum_updated: The changes have been saved.`
Validation: `forum.duplicate_name: A forum by that name already exists.`,
`forum.name_characters: The name must contain only letters, numbers, and underscores.`

`UNVERIFIED: the exact id attributes` — Symfony's default is
`<form-name>_<field-name>` and the evaluator strings `#forum_description` /
`#forum_sidebar` confirm those two, but the rest are inferred from the same
convention.

---

## 10. `/create_forum` — `templates/forum/create.html.twig`

Screenshot: `20-create-forum.png`. Capture: `create_forum-auth.html`
(anonymous 302s).

`create_forum.create_new_forum: Create new forum`, `forum.create: Create forum`.
Same field set as §9 minus the admin-only controls. The creator becomes a
moderator, which is what unlocks `/f/<new>/edit` for webarena-580..584.

---

## 11. User profile `/user/{name}` (+ tabs) — `templates/user/*.html.twig`

Screenshots: `10-user-profile.png`, `11-user-submissions.png`,
`12-user-comments.png`. Captures: `user_MarvelsGrantMan136*.html`.

Tabs: `label.overview: Overview` (`/user/{name}`), `user.submissions:
Submissions` (`/user/{name}/submissions`), `user.comments: Comments`
(`/user/{name}/comments`).

The bio block:

```html
<div class="user-bio">
  <div class="user-bio__biography …">…rendered markdown of users.biography…</div>
</div>
```

**`.user-bio__biography` is a WebArena evaluator locator** (webarena-399..403 read
its `outerText`). For the seeded user it initially contains `t2_5adwlxvn`.

Other copy: `user.registered: Registered %timestamp%`,
`user.moderates: '%username% is a moderator on:'`,
`user.message: Send message`, `nav.edit_biography: Edit biography`,
`label.submissions_short: S`, `label.comments_short: C`,
`label.submission_votes_short: SV`, `label.comment_votes_short: CV`,
`heading.this_user_is_banned: This user is banned!`

Submissions tab ordering is `id DESC` (`User::$submissions`,
`@ORM\OrderBy({"id": "DESC"})`).
`UNVERIFIED: the comments tab ordering` — check `12-user-comments.png`; the
firehose (`/comments`) is newest-first, so `timestamp DESC` is the likely match.

---

## 12. `/user/{name}/edit_biography`, `/account`, `/preferences`

Screenshots: `18-edit-biography.png`, `17-user-account.png`, `16-user-settings.png`.
Captures: `user_edit_biography-auth.html`, `user_account-auth.html`,
`user_preferences-auth.html`.

### edit_biography
`title.editing_biography_for_user: Editing biography for %user%`,
`label.biography: Biography` (markdown textarea, prefilled),
flash `flash.user_biography_updated: The biography was updated.`,
warning when editing someone else: `flash.editing_biography_of_other_user: You
are editing the biography of another user.`

### account (`edit_user`)
`edit_user.title: Editing user %username%`, `heading.credentials: Credentials`.
Fields: `label.username: Username` (`user.username_rules: Allowed characters are
A-Z, a-z, 0-9 and underscore.`), `label.confirm_username: Confirm username`,
`label.email_address: Email address` (`user.email_optional: Providing an email
address is optional. We will only use it for resetting passwords.`),
`label.new_password: New password` / `label.repeat_new_password: New password
(repeat)` (`user.password_rules: Minimum of 8 characters.`),
`label.password: Password`.
`heading.delete_account: Delete account` + `nav.delete_this_account: Delete this
account`.
Flash: `flash.user_password_updated: Your password has been updated.`

### preferences (`user_settings`)
`user_settings.title: Editing user settings for %username%`. Grouped under
`label.general: General`, `label.appearance_and_behavior: Appearance & behavior`,
`label.posting: Posting`, `heading.privacy: Privacy`, `label.permissions: Permissions`.

| Field | Label | Control / options |
|---|---|---|
| Language | `label.language: Language` | select |
| Time zone | `label.timezone: Time zone` | select (seeded `America/New_York`) |
| Front page | `label.front_page: Front page` | select: `Featured` / `Subscribed` / `All` / `Moderated` |
| Sort by | `label.sort_by: Sort by` | select: Hot / New / Active / Top / Controversial / Most commented |
| Night mode | `label.night_mode: Night mode` | select: `label.light: Light` / `label.dark: Dark` / `label.system_preference: System preference` |
| Preferred theme | `label.preferred_theme: Preferred theme` | select (`help.theme_selector: Asterisk indicates same as default.`) |
| Let forums override theme | `label.let_forums_override_preferred_theme` | checkbox |
| Preferred font(s) | `label.preferred_fonts: Preferred font(s)` | text (`help.preferred_fonts`, `help.preferred_fonts_aliases`, `help.preferred_fonts_served`) |
| Full width display | `label.full_width_display: Full width display` | checkbox |
| Show thumbnails | `label.show_thumbnails: Show thumbnails` | checkbox |
| Show post previews | `label.show_post_previews: Show post previews` | checkbox |
| Enable poppers | `label.poppers_enabled: Enable poppers` | checkbox (`help.poppers_enabled`) |
| Open external links in new tab | `label.open_external_links_in_new_tab` | checkbox |
| Submission link destination | `submission_link_destination.label: When clicking submission links…` | radio: `Open the linked content` / `Open the submission` |
| Auto-fetch submission titles | `label.auto_fetch_submission_titles: Auto-fetch submission titles` | checkbox |
| Notify on reply | `label.notify_on_reply: Notify on reply` | checkbox (`help.notify_on_reply`) |
| Notify on mentions | `label.notify_on_mentions: Notify on mentions` | checkbox (`help.notify_on_mentions`) |
| Allow private messages | `label.allow_private_messages: Allow private messages` | checkbox (`help.allow_private_messages`) |

Flash: `flash.user_settings_updated: User settings have been updated.`

---

## 13. `/search?q=…` — `templates/search/results.html.twig`

Screenshot: `13-search-results.png`. Captures: `search_q_machine_learning.html`,
`search_q_headphone.html`.

Heading, pluralised:

```
heading.search_results: '{0} No results for %query%|{1} 1 result for %query%:|]1,Inf[ %count% results for %query%:'
```

So the empty state is literally **`No results for <query>`**.
Also `heading.search: Search`, `label.search_query: Search query`,
`action.search: Search`, `nav.filter_results: Filter results`.

Results render as submission rows (§3). The source searches
`submissions.search_doc` **and** `comments.search_doc` (both are Postgres
`tsvector` columns with GIN indexes), so comments can appear in results.
`UNVERIFIED: whether the results page interleaves comments with submissions or
tabs them` — check `13-search-results.png` and `search_q_headphone.html`.

The `submission__host` link on every row points at `/search?q=<host>`, so
host-name searches must work.

---

## 14. `/comments` and `/f/{name}/comments`

Screenshots: `22-comments-firehose.png`, `30-forum-books-comments.png`.
Captures: `comments.html`, `f_books_comments.html`.

`title.recent_comments: Recent comments`,
`title.recent_comments_forum: Recent comments in %forum%`.
Each row is a comment with its submission context:
`comments.context.top_level_reply: Reply to %submission_title% by
%submission_author%` and
`comments.context.comment_reply: Reply to comment by %comment_author% in
%submission_title% by %submission_author%`.
Newest first.

---

## 15. `/users`, `/notifications`, `/messages`

Screenshots: `21-users-list.png` (**HTTP 403** — the list is admin-only and the
seeded user is not admin), `23-notifications.png`, `24-messages.png`.

| View | Copy |
|---|---|
| `/users` | `title.list_of_users: 'List of users, page #%page%'`; columns `label.username`, `label.registration_date`, `label.admin`, `label.banned` |
| `/notifications` | `title.notifications: Notifications`, `heading.notifications: Notifications`; empty state `flash.no_entries_to_display: There are no entries to display.`; `action.clear: Clear`, `action.clear_all: Clear all`; flashes `flash.notification_cleared` / `flash.notifications_cleared`; `heading.you_were_mentioned: You were mentioned by %user%` |
| `/messages` | `title.messages: Messages`; empty state `flash.no_messages: There are no messages to display.`; columns `label.participants`, `label.last_message`; `compose_message.title: Composing a message to %username%`; `heading.message_thread: "%sender% wrote to %receiver% %timestamp%"`; `heading.message_reply: "%sender% replied %timestamp%"`; `inbox.message_reply_head: 'Re: %title%'`; `prompt.confirm_message_delete: Are you sure you want to delete this message?` |
| moderated (empty) | `flash.no_moderated_forums: You don't moderate any forums.` |
| moderators (empty) | `flash.no_moderators: This forum has no moderators.` |

---

## 16. The vote widget — `templates/_macros/vote.html.twig`, `_layouts/vote.html.twig`

**The highest-risk component in the migration.** Rendered markup, copied from
`/f/books/59421/…`:

```html
<div class="submission__vote">
  <form action="/sv/59421" method="post" class="vote">
    <button type="submit" name="choice" value="1"
            class="unbuttonize vote__button vote__up" title="Upvote"
            data-action="vote#up" data-vote-target="up">
      <span aria-hidden="true"><span class="icon icon--with-alt-text icon--no-align">
        <img src="data:image/svg+xml,…" alt="up" class="icon__alt " aria-hidden="true" width="0" height="0">
        <svg width="16" height="16"><use xlink:href="/build/images/icons.64b6a2fd.svg#up"/></svg>
      </span></span>
    </button>
    <span class="vote__net-score" data-vote-target="score">3,085</span>
    <span class="vote__spinner"><span class="icon icon--with-alt-text icon--pulse">…#spinner…</span></span>
    <button type="submit" name="choice" value="-1"
            class="unbuttonize vote__button vote__down" title="Downvote"
            data-action="vote#down" data-vote-target="down">…#down…</button>
  </form>
</div>
```

Comment votes are identical with `action="/cv/{id}"` inside
`<div class="comment__vote">`.

### The class attribute contract

From the Twig source — `{{-` strips the surrounding whitespace, so the `class`
attribute is exactly one of:

```
vote
vote vote--user-upvoted
vote vote--user-downvoted
```

WebArena evaluators for **16 tasks** (webarena-404..410, 714..730) read
`document.querySelector('div.submission__vote').querySelector('form').getAttribute('class')`
and compare against the literal substrings `vote vote--user-upvoted` /
`vote vote--user-downvoted`. Emitting any extra class breaks them.

### Button `value`

`value="{{ user_choice == (up ? VOTE_UP : VOTE_DOWN) ? VOTE_NONE : (up ? VOTE_UP : VOTE_DOWN) }}"`
— i.e. `1` / `-1` normally, and **`0` on the button that would retract the
current vote**.

Titles switch too: `action.upvote: Upvote` / `action.downvote: Downvote`, and
`action.retract_upvote: Retract upvote` / `action.retract_downvote: Retract
downvote` when that direction is already active.

### Score rendering

`{{ entity.netScore|format_number }}` → thousands-separated (`3,085`).
Negative scores render `&minus;` (U+2212) + the absolute value, followed by
`<span class="no-visibility" aria-hidden="true">&minus;</span>`.

Colours: upvoted arrow `--fg-orange` (`#f80`), downvoted arrow `--fg-blue`
(`#08f`), idle `--fg-grey` (`#888`). See `DESIGN.md` §5c.

Logged in, the form also gets `data-controller="vote"` plus
`data-vote-{choice,id,route,score}-value` and the four state-class data
attributes, and a hidden `<input type="hidden" name="token">` CSRF field.

Also available in the codebase but not seen rendered:
`submission.total_votes: '{1} %count% point|[0,Inf[ %count% points'` and
`submission.vote_stats: (+%up%, −%down%)`.

---

## 17. Subscribe / unsubscribe — `templates/_widgets/subscribe-button`, `forum/_macros.html.twig`

A `<form>` POSTing to `/f/{name}/subscribe` or `/f/{name}/unsubscribe`
(`.json` variants for XHR), rendered as
`button.subscribe-button` with `.subscribe-button__label` and
`.subscribe-button__subscriber-count` spans.

Labels: `action.subscribe: Subscribe` ⇄ `action.unsubscribe: Unsubscribe`.
Count: `forum.subscriber_count: '{0} No subscribers|{1} %formatted_count%
subscriber|[1,Inf[ %formatted_count% subscribers'`.

`UNVERIFIED: the rendered subscribe-button markup` — the anonymous captures omit
it and I did not isolate it in the `-auth` DOM. Read
`assets/html/f_news-auth.html` / `f_books-auth.html` before implementing.

Subscribing must add a `Subscribed forums` section to `#sidebar` on `/`
(webarena-595..599).

---

## Formats

### Relative time — `templates/_macros/time.html.twig`

The server renders an **absolute** timestamp; a Stimulus controller
(`data-controller="relative-time"`) rewrites it to a relative one in the browser.
Real example:

```html
<time class="submission__timestamp"
      data-controller="relative-time"
      datetime="2023-03-10T00:39:36+00:00"
      title="March 10, 2023 at 12:39:36 AM UTC">on March 10, 2023 at 12:39 AM</time>
```

- `datetime` = ISO 8601 (`|date('c')`)
- `title` = `format_datetime('long','long')` in the user's timezone
- text = `format_datetime('long','short')`, prefixed by `on ` when the macro is
  called with `natural: true` (`time.on_timestamp: on %timestamp%`)
- other formats: `time.at_relative_time: '%relative_time%'`,
  `time.earlier_format: '%relative_time% earlier'`,
  `time.later_format: '%relative_time% later'`

The seeded user's timezone is `America/New_York`, but the captured `title`
renders `UTC` because curl is anonymous. **The mock should render the relative
form directly** (that is what an agent sees with JS on) and keep the absolute in
`title` and the ISO string in `datetime`.

**Resolved from `assets/screenshots/reference/03-forum-news.png`:** the
client-side wording is the long form — `3 years ago`, `4 years ago`,
`Created 4 years ago`. Not `3y`.

### Submission byline

```
Submitted by <strong>{username}</strong> {user_flag} <time>{timestamp}</time> in <strong>{forum}</strong>
```

`submission.info_with_forum_name: Submitted by %submitter% %timestamp% in %forum%`
`submission.info_without_forum_name: Submitted by %submitter% %timestamp%`
(the latter on a forum listing, where the forum is implied).

Real example: `Submitted by Hrekires t3_11n9e44 on March 10, 2023 at 12:39 AM in news`

### Comment byline

`comments.info: '%user% wrote %timestamp%'` →
`ameliaspond t1_j2eg7wq wrote on December 31, 2022 at 5:36 PM`

### The `user-flag` suffix — do not drop it

Both bylines render `<small class="fg-grey text-sm user-flag">t3_11n9e44</small>`
right after the username. That is `submissions.user_flag` / `comments.user_flag`,
which in this scraped corpus holds the **original Reddit fullname** of every
post and comment. `user/_macros.html.twig`:

```twig
{% macro user_flag(flag) %}
  {%- if flag == FLAG_NONE -%}{# nothing #}
  {%- elseif flag == FLAG_ADMIN -%}<small class="fg-red text-sm user-flag ">admin</small>
  {%- elseif flag == FLAG_MODERATOR -%}<small class="fg-green text-sm user-flag">moderator</small>
  {%- else -%}<small class="fg-grey text-sm user-flag">{{ flag|trans }}</small>
  {%- endif -%}
{% endmacro %}
```

`user_flag.admin: admin`, `user_flag.moderator: moderator`. The seed carries
`userFlag` on 2,344 of 2,345 submissions and all 2,505 comments; omit the element
entirely when the value is `none`.

**The square brackets are CSS, not markup** (`_things/user-flag.less`):

```less
.user-flag {
  &::before { content: '['; }
  &::after  { content: ']'; }
}
```

so the byline reads `Submitted by langis_on [t3_116e4p2] 3 years ago` on screen
while the DOM holds only `t3_116e4p2`. Confirmed in
`assets/screenshots/reference/03-forum-news.png`.

### Link host

`<a href="/search?q=apnews.com" class="submission__host text-xs">apnews.com</a>`
— rendered immediately after the title, **no parentheses**, and it is a link into
search, not plain text.

### Comment-count pluralisation

`submission.comments: '{0} No comments|{1} %count% comment|[1,Inf[ %count% comments'`
→ `No comments` · `1 comment` · `125 comments`, wrapped in `<strong>`.

### Empty states

| Where | Copy | Key |
|---|---|---|
| Any empty listing | `There's nothing here…` | `content.empty` |
| No featured forums | `There are no featured forums to display.` | `front.no_forums` |
| No subscriptions | `You are not subscribed to any forum. Showing featured forums instead.` | `front.no_subscriptions` |
| Search | `No results for %query%` | `heading.search_results` |
| Notifications / logs | `There are no entries to display.` | `flash.no_entries_to_display` |
| Messages | `There are no messages to display.` | `flash.no_messages` |
| Moderated forums | `You don't moderate any forums.` | `flash.no_moderated_forums` |
| Forum moderators | `This forum has no moderators.` | `flash.no_moderators` |
| Wiki 404 | `The requested page was not found.` / `Page not found` | `wiki.not_found_message` / `wiki.not_found_title` |

### Markdown

`src/Markdown/`, surfaced by the `markdown.*` copy keys, which name every
supported construct:

`markdown.heading: 'Heading %count%'`, `paragraph`, `emphasis`,
`strong_emphasis`, `strikethrough`, `link`, `blockquote`, `list_item`,
`inline_code`, `code_block`, `horizontal_rule`, `break`, and — importantly —
`markdown.user: user`, `markdown.forum: forum`, `markdown.wiki_page: wiki_page`,
which are the **`/u/name`, `/f/name` and wiki-page autolinks**.
`markdown.allowed: Markdown allowed.` appears under every body textarea, next to
`markdown.help: Formatting help` and `markdown.preview: Preview`.

Rendered output adds `lang` and `dir` attributes per paragraph (language
detection) and `rel="nofollow noopener noreferrer"` on external links — see the
comment example in §4.

Spoilers are `a[href="#s"]` / `a[href="#spoiler"]`, styled to hide their text
until hover (`_global.less`).

### Pagination

Submission listings, verbatim:

```html
<nav class="pagination" role="navigation">
  <ul class="flex flex--guttered unlistify">
    <span class="flex__grow" aria-hidden="true"></span>
    <li class="next">
      <a href="http://localhost:9999/f/news?next%5Branking%5D=3396&amp;next%5Bid%5D=65117"
         class="button button--secondary" rel="next">
        More
      </a>
    </li>
    <span class="flex__grow" aria-hidden="true"></span>
  </ul>
</nav>
```

Label is **`More`** (`nav.more`), not "Next". Cursor formats per sort are in
`ROUTES.md` "Cursor pagination — confirmed formats". `nav.next: Next`,
`nav.previous: Previous`, `nav.page_number: 'Page %number%'`,
`nav.current_page: Current page` exist for the offset pager used by `/forums`,
`/users`, and the log pages.

### Images

| Use | URL |
|---|---|
| Listing thumbnail | `src="/media/cache/submission_thumbnail_1x/<sha256>.jpg"` (70×70) |
| ↑ 2× | `srcset="/media/cache/submission_thumbnail_2x/<sha256>.jpg 2x"` (140×140) |
| Full image on the detail page | `src="http://localhost:9999/submission_images/<sha256>.jpg"` |

Thumbnail spec from `config/packages/liip_imagine.yaml`: `thumbnail`
`size: [70,70]` / `[140,140]`, `mode: outbound` (centre-crop), `quality: 60`,
`allow_upscale: true`, after `auto_rotate` and `strip`. The mock's assets in
`public/` were generated with exactly those parameters.

Tasks webarena-615..619 read
`[...document.querySelector('.submission__inner').querySelectorAll('[href],[src]')]`
and look for the image filename, so the `/submission_images/<name>` path must
appear in an `href` or `src` inside `.submission__inner`.

---

## Titles are stored double-escaped — render them as plain text

`03-forum-news.png` shows a real listing row reading

```
Women sue Deutsche Bank, JPMorgan over Epstein ties | … JPMorgan Chase &amp; Co on Thursday, …
```

The literal `&amp;` is on screen. The scrape stored HTML-escaped titles and
Postmill escapes again on output, so the user sees the entity. **Render
`submission.title` as a text node — do not unescape it.** This is also why the
slugger turns `&` into the word `amp` (`assets/data_model.md` §6).

---

## UNVERIFIED items — collected

Three of the original seven were resolved above from
`assets/screenshots/reference/03-forum-news.png`: the relative-time wording
(`3 years ago`), the subscribe-button placement and the forum sidebar order, and
the `user-flag` brackets being CSS pseudo-elements.

Still open:

1. The exact emoji character in `.empty__emoji`.
2. Whether `/submit`'s primary button reads `Create` or `Create submission` —
   check `assets/screenshots/reference/14-submit-form.png`.
3. `/f/{name}/edit` field ids other than `#forum_description` and
   `#forum_sidebar` (the page 403s for the seeded user; the rest are inferred
   from Symfony's `<form>_<field>` convention).
4. The ordering of the `/user/{name}/comments` tab — check
   `assets/screenshots/reference/12-user-comments.png`.
5. Whether `/search` interleaves comment hits with submission hits or separates
   them — check `13-search-results.png` and `assets/html/search_q_headphone.html`.

All five are answerable from `assets/screenshots/reference/` and the `-auth`
captures in `assets/html/` without touching the source again.
