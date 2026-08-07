# reddit (Postmill) — Data Model

> Derived from the real Postgres schema in container `forum`
> (`docker exec forum psql -U postmill -d postmill -c '\d <table>'`).
> Seed files live in `src/data/`. Raw un-curated dumps live in `assets/dumps/`.

---

## 0. Seed inventory

| File | Records | Size | What it is |
|---|---:|---:|---|
| `src/data/forums.json` | **95** | 21 KB | **Every** forum on the source site |
| `src/data/submissions.json` | **2,359** | 1,355 KB | Curated sample, all 95 forums represented |
| `src/data/comments.json` | **2,593** | 840 KB | Trees for the 57 anchored submissions + top comments elsewhere + the full comment history of the users webarena-27..31 resolve to |
| `src/data/users.json` | **70** | 11 KB | "Rich" users — profile-visitable, with real activity counts |
| `src/data/userDirectory.json` | **3,899** | 107 KB | `{username: "YYYY-MM-DD"}` join dates for every author in the seed |
| `src/data/currentUser.json` | 1 | 0.9 KB | `MarvelsGrantMan136` + her one real vote + empty subs |
| `src/data/images.json` | **769** | 118 KB | Image manifest, written by the asset shard |
| **Total** | | **≈2.4 MB on disk · 2.26 MB of `createInitialData()` state** | Within the §4 budget |

> **Dev fix 13** added 14 submissions, 88 comments, 38 `userDirectory` entries and
> 4 images, every field SELECTed verbatim out of container `forum`. Nothing was
> renamed, renumbered or regenerated — all 2,345 / 2,505 / 3,861 / 765 pre-existing
> records are byte-identical. Rationale in `TODO.md` "Gaps" 3.

Source totals for scale: 95 forums, **127,391** submissions, **2,551,513**
comments, **661,782** users. The seed is a sample, by design (`WEBARENA_MIGRATION.md` §4).

### Sampling rule actually used

Per forum, the sample is the **union** of the head of each sort order, so every
sort mode has correct content on page 1 and 2:

| Forum class | Count | Quotas (per sort dimension) |
|---|---:|---|
| "deep" — the 40 forums a WebArena task touches | 33–51 each | `hot`≤14, `new`≤14, `top`≤14, `most_commented`≤5, `controversial`≤5, `active`≤5 |
| "shallow" — the other 55 | ≤14 each | `hot`≤7, `new`≤7 |
| forced | +57 | every anchored submission id, by id |

Deep forums: `BuyItForLife DIY EarthPorn Futurology IAmA LifeProTips
MachineLearning Showerthoughts UpliftingNews Washington WorcesterMA aww books
consoles dataisbeautiful deeplearning explainlikeimfive funny gadgets gaming
headphones history iphone massachusetts movies news nyc photoshopbattles pics
pittsburgh relationship_advice science singularity space sports technology
television videos wallstreetbets washingtondc`.

**Known consequence:** `forums[].submissionCount` is the *real* site count (e.g.
`news` = 3,322) while only 51 `news` submissions are seeded. Keep the real count
— it is what `/forums?sortBy=by_submissions` orders on and what the forum cards
display, and it matches the source pixel-for-pixel there. Listings simply
paginate over what is seeded. Shallow forums have fewer than one full page (25),
which is a visible sampling artefact; see `TODO.md` "Gaps".

---

## 1. `Forum`

Source table `forums`. Real columns: `id, name, title, sidebar, created,
normalized_name, featured, description, suggested_theme_id,
light_background_image_id, dark_background_image_id, background_image_mode,
moderation_log_public`.

```json
{
  "id": 10064,
  "name": "news",
  "title": "news",
  "sidebar": "t5_2qh3l",
  "description": "news",
  "created": "2022-10-01T03:28:48+00:00",
  "featured": false,
  "moderationLogPublic": true,
  "submissionCount": 3322,
  "subscriberCount": 0
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | int | Real Postmill id. Range 10000–10094 + a couple of app-created ones. |
| `name` | string | The `/f/<name>` path segment. **Case-preserved**; match case-insensitively (see below). |
| `title` | string | Display title. In this corpus it equals `name` for every forum. |
| `sidebar` | string | **The scraped Reddit fullname**, e.g. `t5_2qh3l` — *not* prose. This is what `/f/news/edit`'s `#forum_sidebar` textarea contains. |
| `description` | string | Also equals `name` for every seeded forum. `#forum_description` on the edit form. |
| `created` | ISO 8601 +00:00 | |
| `featured` | bool | **`false` for all 95** ⇒ `/featured` and the anonymous `/` are empty |
| `moderationLogPublic` | bool | `true` for all |
| `submissionCount` | int | Derived (`count(*) WHERE visibility='visible'`). Drives `/forums?by_submissions`. |
| `subscriberCount` | int | **0 for all 95** — `forum_subscriptions` is empty |

Dropped from the seed (all null/unused in this corpus): `normalized_name`
(derive it as `name.toLowerCase()`), `suggested_theme_id`,
`light_background_image_id`, `dark_background_image_id`, `background_image_mode`.

**`normalized_name` is a UNIQUE index**, so forum lookup must be
`forums.find(f => f.name.toLowerCase() === param.toLowerCase())`. `/f/earthporn`
302-redirects to `/f/EarthPorn` on the source; several anchor routes use the
lowercase form.

**Relationships:** `submissions.forum` → `forums.name` (the seed denormalises to
name, not id, because every URL is name-based).

---

## 2. `Submission`

Source table `submissions`. Real columns: `id, forum_id, user_id, title,
timestamp, url, body, image_id, ip, sticky, ranking, edited_at, moderated,
user_flag, locked, search_doc, last_active, comment_count, net_score, visibility,
media_type`.

Link post:

```json
{
  "id": 129508,
  "forum": "news",
  "author": "Hrekires",
  "title": "Tennessee governor OKs bill to cut Nashville council in half",
  "url": "https://apnews.com/article/nashville-council-half-tennessee-republican-lawmakers-e5c38e8b624058adbef7861740a6962b",
  "timestamp": "2023-03-10T00:39:36+00:00",
  "lastActive": "2023-03-12T18:09:45+00:00",
  "ranking": 414,
  "netScore": 414,
  "commentCount": 76,
  "slug": "tennessee-governor-oks-bill-to-cut-nashville-council-in-half"
}
```

Image post:

```json
{
  "id": 45604,
  "forum": "pics",
  "author": "DinoRoman",
  "title": "A Trejo Thanksgiving.",
  "timestamp": "2022-11-25T03:50:35+00:00",
  "lastActive": "2022-11-26T12:42:56+00:00",
  "ranking": 7522,
  "netScore": 7522,
  "commentCount": 195,
  "image": "2e4fa0a328e653a97a7d07046291c298ef5b4e0d0c73a287f317ca86a8e8685f.jpg",
  "imageWidth": 963,
  "imageHeight": 1280,
  "slug": "a-trejo-thanksgiving"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | int | **Real Postmill id — never renumber.** 57 of these are anchor routes. |
| `forum` | string | `forums[].name` |
| `author` | string | `users[].username` |
| `title` | string | Verbatim, **HTML-escaped as stored** (`&amp;`, `&quot;`, `&#039;`). Render as text; do not double-unescape. |
| `url` | string? | Absent on self/image posts. `mediaType` is derivable: `image ? 'image' : 'url'`. |
| `body` | string? | Markdown. Absent on pure link posts. |
| `bodyTruncated` | bool? | **Present ⇒ the body was cut at 350 chars for size.** Never set on an anchored submission or on the hot/top-10 of a deep forum; those carry the full real body. 365 of 2,359 records (never on one of the 14 dev-fix-13 rows). |
| `timestamp` | ISO 8601 | Post time. Drives `?t=` filtering. |
| `lastActive` | ISO 8601 | Drives the `active` sort. |
| `editedAt` | ISO 8601? | Absent when never edited (all seeded records). |
| `ranking` | int | Drives the `hot` sort. **Store it separately — do not alias it to `netScore`.** In the scraped corpus these two are usually equal, but submission `1` (created in-app) has `ranking = 1686590745` and `netScore = 1`. |
| `netScore` | int | The displayed vote score. Drives `top` and `controversial`. |
| `commentCount` | int | Real site count, e.g. `76`. **Larger than the number of seeded comments** for most records; display the real number. |
| `sticky` | bool? | Omitted when false |
| `locked` | bool? | Omitted when false |
| `image` | string? | `<sha256>.jpg`. Served at `/submission_images/<image>`; thumbnails at `/media/cache/submission_thumbnail_{1x,2x}/submission_images/<image>`. |
| `imageWidth`/`imageHeight` | int? | Real intrinsic dimensions; the template scales height proportionally to a max width. |
| `slug` | string | **Precomputed** with the exact Postmill algorithm (§6). Verified 56/56 against the anchor routes. |

Dropped: `ip`, `moderated`, `search_doc`, `visibility` (only `visible` rows were
sampled), `media_type` (derivable), `user_flag` (holds the scraped Reddit
fullname such as `t3_zzvi0q`; not rendered anywhere and not anchored).

**Foreign keys that must stay consistent:** every `submission.forum` exists in
`forums.json`; every `submission.author` exists in `userDirectory.json`.
Verified: 0 violations.

---

## 3. `Comment`

Source table `comments`. Real columns: `id, user_id, submission_id, parent_id,
body, timestamp, visibility, ip, edited_at, moderated, user_flag, search_doc,
net_score`.

Top-level:

```json
{
  "id": 1235250,
  "submission": 59421,
  "author": "ameliaspond",
  "body": "I'm a manager at an indie bookstore and I agree, [Bookshop.org](https://Bookshop.org) is wonderful! …",
  "netScore": 367,
  "timestamp": "2022-12-31T17:36:15+00:00"
}
```

Reply:

```json
{
  "id": 10821,
  "submission": 13170,
  "parent": 10733,
  "author": "UniversityofBath",
  "body": "  \nHi! They are called gentle lemurs as they look like fluffy  \nteddy bears! …",
  "netScore": 4,
  "timestamp": "…"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | int | Real id. Two are anchor routes: `1235250`, `1042264`. |
| `submission` | int | FK → `submissions[].id` |
| `parent` | int? | **Absent ⇒ top-level.** Self-FK, arbitrary depth, no depth column. |
| `author` | string | |
| `body` | string | Markdown. Note the `"  \n"` hard-break convention that survives from Reddit. |
| `netScore` | int | Can be negative — e.g. tasks webarena-27..31 count `netScore < 0`. |
| `timestamp` | ISO 8601 | |
| `editedAt` | ISO 8601? | Absent when never edited |
| `bodyTruncated` | bool? | Set when the body was cut at 900 chars. **Never set on a comment belonging to an anchored submission.** |

Dropped: `ip`, `moderated`, `user_flag`, `search_doc`, `visibility` (only
`visible` sampled).

### Tree integrity — verified

- 0 comments with a `parent` that is not in the seed.
- 0 comments whose `submission` is not in the seed.
- Both anchored comments (`1235250` on `59421`, `1042264` on `69404`) are present
  with their **full ancestor chain and full subtree**.

### Coverage

- **Anchored submissions (57):** best-first over the real tree — highest
  `netScore` root first, then its children, etc. — capped at 60 comments each,
  keeping the tree connected. 1,763 comments.
- **Everything else:** the top 2 top-level comments (by `netScore`) for the
  hot/top-10 of each deep forum. 742 comments.
- **Task-user histories (dev fix 13):** the *complete* real comment history of the
  users webarena-27..31 resolve to — `ziostraccette` (7) and `mineinhusdson` (42);
  the other three have 0 comments on the source — plus the 39 real ancestor
  comments needed to keep those trees connected. 88 comments, on 14 submissions
  that were carried over at the same time so nothing is orphaned.
- **427 of 2,359 submissions have at least one seeded comment.** The other 1,932
  render an empty comment section while displaying their real `commentCount`.
  This is the deliberate size tradeoff; see `TODO.md` "Gaps".
  **It does not extend to `/user/<name>/comments`** — an empty profile-comment
  page where the source has content is a P0, because task answers are read off it.

---

## 4. `User`

Source table `users` (30 columns). Two seed tiers.

### 4a. `users.json` — 70 rich users

Authors of anchored submissions, the five authors that tasks webarena-27..31
resolve to, `MarvelsGrantMan136`, and anyone with ≥4 items in the seed.

```json
{
  "id": 12013,
  "username": "AutoModerator",
  "created": "2012-01-05T05:24:28+00:00",
  "biography": "t2_6l4z3",
  "submissionCount": 629,
  "commentCount": 11687,
  "negativeCommentCount": 305
}
```

| Field | Notes |
|---|---|
| `id` | Real |
| `username` | Real. `[deleted]` (id 10000) is a real row and appears as an author. |
| `created` | Join date. `[deleted]` has `1970-01-01T00:00:00+00:00`. |
| `admin` | Present only when `true` |
| `biography` | Usually the scraped Reddit fullname `t2_xxxxx`; absent when null |
| `submissionCount` / `commentCount` | **Real site-wide counts**, not seed counts |
| `negativeCommentCount` | `count(comments WHERE net_score < 0)` — this is the number tasks webarena-27..31 ask for |

Seeded values for those five tasks (see `SOURCE.md` for the full derivation):

| Username | Reached via | `negativeCommentCount` | `commentCount` |
|---|---|---:|---:|
| `nirinaron` | latest post in `Showerthoughts` (122512) | 0 | 0 |
| `mineinhusdson` | latest post in `WorcesterMA` (123052) | 1 | 42 |
| `ziostraccette` | latest post in `DIY` (119019) | 1 | 7 |
| `Dhghomon` | latest post in `space` (134164) | 0 | 0 |
| `Proud_Idiot` | latest post in `photoshopbattles` (131461) | 0 | 0 |

Since dev fix 13, `comments.json` actually **contains** all 49 of those comments,
so `/user/<name>/comments` derives the same number the table states instead of
rendering an empty list. `negativeCommentCount` stays the true DB value — do not
edit it to agree with webarena-28's gold answer, which is wrong upstream.

### 4b. `userDirectory.json` — 3,899 authors

`{ "<username>": "YYYY-MM-DD" }`. Every distinct author in the seed, with a join
date so `/user/<name>` renders for anyone whose name is clickable. Activity
counts for these can be derived from the seed (they will under-report vs the real
site — acceptable, unanchored).

---

## 5. `currentUser.json`

```json
{
  "user": { "id": 13915, "username": "MarvelsGrantMan136", "email": null,
            "created": "2020-06-24T15:02:10+00:00", "admin": false,
            "biography": "t2_5adwlxvn", "locale": "en", "nightMode": "light",
            "timezone": "America/New_York", "frontPage": "subscribed",
            "frontPageSortMode": "hot", "showCustomStylesheets": true,
            "trusted": false, "openExternalLinksInNewTab": false,
            "autoFetchSubmissionTitles": true, "enablePostPreviews": true,
            "showThumbnails": true, "notifyOnReply": true,
            "notifyOnMentions": true, "preferredFonts": null,
            "allowPrivateMessages": true, "poppersEnabled": true,
            "fullWidthDisplayEnabled": false, "submissionLinkDestination": "url" },
  "submissionVotes": [ { "submission": 1, "upvote": true,
                         "timestamp": "2023-06-12T16:55:45+00:00" } ],
  "commentVotes": [],
  "subscriptions": []
}
```

Every field is copied verbatim from the `users` row. The three loose ends are all
real: **exactly one** pre-existing vote in the entire database, **zero** comment
votes, **zero** subscriptions.

`biography` is the literal `t2_5adwlxvn` — the profile page must render that
string inside `.user-bio__biography` before any task edits it.

---

## 6. Slug generation — port this exactly

`slug` is precomputed for every seeded submission, but the mock must also
generate it for submissions the agent creates. This is a faithful port of
`src/Utils/Slugger.php`, verified against all 56 slug-carrying anchor routes:

```js
// Postmill\App\Utils\Slugger::slugify — SluggerInterface::DEFAULT_MAX_LENGTH = 60
export function slugify(title, maxLength = 60) {
  const words = title.toLowerCase().split(/[^\p{L}\p{N}_]+/u).filter(Boolean);
  let slug = '', len = 0;
  for (const word of words) {
    const add = len > 0 ? `-${word}` : word;
    len += [...add].length;          // grapheme-ish length, INCLUDING the dash
    if (len > maxLength) break;      // truncate at a word boundary
    slug += add;
  }
  return slug || '-';
}
```

`\w` in PHP's `preg_split('/[^\w]+/u')` with the `u` modifier is
`[\p{L}\p{N}_]`, so underscores survive and everything else — apostrophes,
punctuation, emoji — is a separator.

Two behaviours to preserve:

- Titles are stored HTML-escaped, so `&` arrives as `&amp;` and slugifies to the
  word `amp` (`…laverne-amp-shirley-star…`).
- **Routing ignores the slug.** `/f/books/59421/anything`, `/f/books/59421/-`,
  and the canonical slug all resolve to submission 59421. Resolve on the numeric
  id only; use the slug purely to build canonical links.

---

## 7. Shape `createInitialData()` should return

```js
{
  currentUser: { ...currentUser.user },      // mutable: biography, preferences, nightMode
  forums:      [ ...forums ],                // mutable: description, sidebar, title (edit);
                                             //          appended on /create_forum
  submissions: [ ...submissions ],           // mutable: body/title/url (edit), netScore (vote),
                                             //          commentCount, sticky, locked;
                                             //          appended on /submit; visibility on delete
  comments:    [ ...comments ],              // mutable: body (edit), netScore (vote);
                                             //          appended on reply; visibility on delete
  users:       [ ...users ],
  userDirectory: { ...userDirectory },
  votes: {
    submissions: { "1": 1 },                 // id -> 1 (up) | -1 (down); seeded from submissionVotes
    comments:    {}
  },
  subscriptions: [],                         // forum names; drives /subscribed and the `/` sidebar
  moderatorOf:   [],                         // forum names; grows when the user creates a forum
  hiddenForums:  [],
  blockedUsers:  [],
  notifications: [],
  messages:      [],
  nextSubmissionId: 200000,                  // above every real id (max real = 135201)
  nextCommentId:    3000000,                 // above every real id
  nextForumId:      20000
}
```

Rationale for the id counters: **never reuse a real id.** The largest real
submission id in the source is `135201` and the largest comment id is in the
2.5 M range, so new records start well clear of both, and a task that creates a
post then navigates to it gets a URL that cannot collide with an anchor route.

### Derived-at-render, never stored in state

- sort orders (recompute from `ranking` / `id` / `lastActive` / `netScore` / `commentCount`)
- the comment tree (build from `parent` on each render)
- search results
- `forum.submissionCount` for **new** forums (count the seed)
- relative timestamps

---

## 8. Sanity checks against the task surface

| Requirement | Status |
|---|---|
| Something to search for | `machine learning`, `headphone`, `bookshop` all match seeded titles/bodies |
| Something to sort | All six sort modes have ≥33 rows in every deep forum |
| A list longer than one page (25) | 40 deep forums have 33–51 submissions ⇒ 2 pages |
| A submission with a deep comment tree | `13170` (IAmA), `69404` (singularity), `59421` (books) — 60 comments each, multi-level |
| A comment with a negative score | present (`negativeCommentCount > 0` for `mineinhusdson`, `ziostraccette`) |
| Every anchored record present | 92/93 anchor routes resolve; the one miss (`/f/games`) does not exist on the source either |
| An existing vote to toggle | submission `1`, upvoted by the seeded user |
| Image posts with real filenames | 769 image submissions incl. all 5 anchored filenames |
