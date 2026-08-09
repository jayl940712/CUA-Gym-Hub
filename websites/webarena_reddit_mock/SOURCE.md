# webarena_reddit_mock — Source Recon

> Source site: <http://localhost:9999>
> Docker image: `postmill-populated-exposed-withimg:latest` · container `forum`
> Recon by: plan agent, 2026-08-06
> **Recon mode: FULL** (docker reachable, site returns 200)

---

## Access

| Probe | Result |
|---|---|
| `docker ps --filter ancestor=postmill-populated-exposed-withimg` | container `ec123191a4ad` / **`forum`**, Up 29h, `0.0.0.0:9999->80/tcp` |
| `curl --noproxy '*' -o /dev/null -w '%{http_code}' http://localhost:9999` | **200** |
| `docker exec forum psql -U postmill -d postmill -c '\dt'` | **OK**, 30 tables |
| `docker cp forum:/var/www/html/{templates,config,src} /tmp/recon/reddit/` | **OK** |

Everything in this document was observed directly from the container or the live
HTTP surface. Nothing is reconstructed from memory or from the public Postmill
docs.

**Read-only discipline.** No `INSERT`/`UPDATE`/`DELETE` was issued against the
source DB and no mutating form was submitted through the source UI. The only
POST performed against the live site was `/login_check` (authentication), by the
crawl shard, to reach authenticated-only DOM.

---

## Stack

| Layer | What it actually is |
|---|---|
| App | **Postmill** (a Reddit clone), PHP 8 / **Symfony 5** |
| Templates | **Twig**, in `/var/www/html/templates` (copied to `/tmp/recon/reddit/templates`) |
| Routing | YAML, one file per controller, in `/var/www/html/config/app_routes/*.yaml` |
| DB | **PostgreSQL**, database `postmill`, user `postmill` |
| Assets | Webpack Encore → `/build/*.css`, `/build/*.js`, SVG sprite `/build/images/icons.*.svg` |
| Front controller | nginx + php-fpm inside the single `forum` container, exposed on :9999 |
| Version | `Postmill` (footer renders `Running Postmill` with no version string) |

Postmill terminology maps onto Reddit's as follows, and the **Postmill** words are
what appear in the UI:

| Reddit word | Postmill word / URL |
|---|---|
| subreddit | **forum**, `/f/<name>` |
| post | **submission** |
| karma / score | **net score** (`submissions.net_score`) |

---

## Credentials

| Purpose | Value |
|---|---|
| Site login (WebArena default user) | `MarvelsGrantMan136` / `test1234` |
| Postgres | `docker exec forum psql -U postmill -d postmill` (no password needed from inside) |

### The default user, verbatim from `users`

```
id                    13915
username              MarvelsGrantMan136
email                 (NULL)
created               2020-06-24 15:02:10+00
admin                 false
biography             t2_5adwlxvn
front_page            subscribed
front_page_sort_mode  hot
locale                en
night_mode            light
timezone              America/New_York
```

Two consequences the mock must reproduce:

1. **`biography` is the literal string `t2_5adwlxvn`** (a leftover Reddit user
   fullname from the scrape), *not* empty. Tasks webarena-399..403 rewrite it, and
   the evaluator reads `document.querySelector(".user-bio__biography").outerText`.
2. **`front_page = 'subscribed'` and `forum_subscriptions` has 0 rows**, so the
   logged-in front page `/` is **empty** — see "Notable findings" below.

---

## Database: real row counts

Measured on the live container.

| Table | Rows |
|---|---|
| `forums` | **95** |
| `submissions` | **127,391** |
| `comments` | **2,551,513** |
| `users` | **661,782** |
| `images` | **31,467** |
| `submission_votes` | **1** |
| `comment_votes` | **0** |
| `forum_subscriptions` | **0** |
| `moderators` | **0** |
| `forum_tags` / `forums_tags` | 0 / 0 |
| `messages` / `message_threads` / `notifications` | see gaps |

Full 30-table list: `bad_phrases, bans, comment_votes, comments,
css_theme_revisions, flairs, forum_bans, forum_log_entries, forum_subscriptions,
forum_tags, forums, forums_tags, hidden_forums, images,
message_thread_participants, message_threads, messages, migration_versions,
moderators, notifications, sites, submission_votes, submissions,
submissions_flairs, themes, user_bans, user_blocks, users, wiki_pages,
wiki_revisions`.

Per-entity column lists are in `assets/data_model.md`.

---

## Notable findings (things the dev agent would otherwise get wrong)

### 1. Vote counts are **stored**, not derived

`submissions.net_score` and `comments.net_score` are materialised integer
columns. The `submission_votes` table has exactly **one** row and
`comment_votes` has **zero**:

```
submission_votes: id=1  user_id=13915  submission_id=1  upvote=t  2023-06-12 16:55:45+00
```

So the entire corpus's scores came in from the Reddit scrape with no backing vote
rows, and **`MarvelsGrantMan136` has exactly one pre-existing vote in the whole
site: an upvote on submission `1` (`/f/MachineLearning/1/nvidia-rtx-4090`).**

The mock must therefore store `netScore` per submission/comment as a plain number
and keep a *separate* per-user vote map, seeded with that single upvote. Do not
try to compute scores from vote rows.

### 2. The front page is empty

`/` is `FrontController::front`, which renders the user's `front_page` view.
For `MarvelsGrantMan136` that is `subscribed`, and there are no subscriptions, so
the listing is empty. Anonymously `/` renders the `featured` view, and
`forums.featured` is `false` for all 95 forums, so that is empty too. Confirmed
by curl on `/`: `#main` contains only the tab/filter/sort nav, and `#sidebar`
contains one section:

```html
<section class="sidebar__section flow">
  <h1 class="sidebar__title">Featured forums</h1>
  <p class="fg-muted"><small class="text-sm">There are no featured forums to display.</small></p>
</section>
```

This is load-bearing: tasks webarena-595..599 subscribe to a forum and the
evaluator then reads `document.querySelector("#sidebar > section").outerText` on
`/`, expecting the new subscription (`space`, `books`, `consoles`, `pittsburgh`,
`MachineLearning`) to appear there. So the mock's `/` must start empty *and* grow
a subscribed-forums sidebar section once the user subscribes.

### 3. Sort semantics, exactly

From `src/Pagination/SubmissionPage.php`:

| Sort | ORDER BY |
|---|---|
| `hot` | `ranking DESC, id DESC` |
| `new` | `id DESC` |
| `active` | `last_active DESC, id DESC` |
| `top` | `net_score DESC, id DESC` |
| `controversial` | `net_score **ASC**, id **ASC**` |
| `most_commented` | `comment_count DESC, id DESC` |

`controversial` is genuinely ascending in this Postmill build — it surfaces the
*lowest*-scored submissions, not a hot/controversy ratio. Reproduce the quirk.

Page size is **25** (`Criteria::$maxPerPage = 25`). Pagination is cursor-based
(PagerWave), not offset-based — see `ROUTES.md` "Query Parameters".

Time filter comes from `?t=` and is applied as `s.timestamp > now() - interval`
for `day|week|month|year`; `t=all` (default) applies no clause
(`SubmissionFinder::addTimeClause`). Note it filters on **submission timestamp**,
so with a corpus that ends 2023-03-31 and a wall clock of today, `?t=day` /
`?t=week` / `?t=month` / `?t=year` all return **zero rows** on the live site.

### 4. The URL slug algorithm — ported and verified

`src/Utils/Slugger.php`:

```php
$input = mb_strtolower($input, 'UTF-8');
$words = preg_split('/[^\w]+/u', $input, -1, PREG_SPLIT_NO_EMPTY);
// join with '-', accumulating grapheme length INCLUDING the joining dash,
// break as soon as the running length exceeds 60; '' -> '-'
```

`SluggerInterface::DEFAULT_MAX_LENGTH = 60`.

I ported this to Python and checked it against **all 56 anchor routes that carry
a slug**: **56/56 exact match, 0 mismatches.** The equivalent JS is in
`assets/data_model.md` §Slug. Details that matter:

- `_` is a `\w` character and survives (`relationship_advice`).
- Apostrophes split words: `I can't wait` → `i-can-t-wait`.
- Titles are stored **HTML-escaped** in the DB, so `&` reaches the slugger as
  `&amp;` and becomes the word `amp`:
  `Cindy Williams dies: 'Laverne &amp; Shirley' star…` →
  `cindy-williams-dies-laverne-amp-shirley-star-who-appeared-in`.
- The 60-char cap cuts at a word boundary, which is why so many anchor slugs end
  mid-sentence (`…-most-incredible`, `…-notebook-donations-the`).

Slugs are **not stored** anywhere; Postmill recomputes them in Twig
(`submission.title|slugify`) and, crucially, **ignores the slug when routing** —
`/f/books/59421/anything-at-all` and `/f/books/59421/-` both resolve. The mock
should do the same.

### 5. Forum names resolve case-insensitively, via redirect

`forums.normalized_name` is a unique lowercase index. Observed:

```
/f/EarthPorn      -> 200
/f/earthporn      -> 302   (redirects to the canonical /f/EarthPorn)
/f/machinelearning-> 302   (-> /f/MachineLearning)
```

Several anchor routes use the lowercase form (`/f/earthporn`, `/f/machinelearning`),
so the mock must accept either casing.

### 6. Forums referenced by anchors that **do not exist** in the source

| Anchor route | Live status | Why |
|---|---|---|
| `/f/games` | **404** | webarena-644's `reference_url`. No `games` forum exists (there is `gaming`). Broken upstream. |
| `/f/Cyberpunk/edit` | **404** | webarena-582 *creates* the forum first, then edits it |
| `/f/sci_fi/edit` | **404** | webarena-580 creates it first |
| `/f/PlantsForCatParents/edit` | **404** | webarena-583 creates it first |
| `/f/Karaoke/edit` | **404** | webarena-584 creates it first |
| `/f/cmu_lti/edit` | **404** | webarena-581 creates it first |

The four `…/edit` cases are a **capability** requirement, not a data one: the
mock must support `/create_forum` and then `/f/<newname>/edit`, with the edit form
exposing `#forum_description` and `#forum_sidebar` (the evaluator reads
`.value` off both).

### 7. `MarvelsGrantMan136` moderates nothing

`moderators` has 0 rows and the user is not `admin`. So on the live site the
moderator-only routes (`/f/<name>/edit`, `/f/<name>/moderators`,
`/f/<name>/bans`, forum delete, pin/lock) are **not** reachable for this user on
any pre-existing forum. They *are* reachable on a forum the user creates, because
Postmill makes the creator a moderator.

### 8. Comment nesting has no depth cap in the data

`comments.parent_id` is a self-FK with no depth column and no application-level
limit; the template `_layouts/comment.html.twig` recurses. Deep chains exist in
the corpus. The mock should render arbitrary depth and rely on CSS indentation
(see `DESIGN.md` §4 for the exact per-level indent).

### 9. Two comment views

`/f/{forum}/{id}/{slug}/{commentView}` where `commentView` is `nested` (default)
or `linear`. Both are real routes.

---

## Task-anchor coverage

`assets/task_anchors.{json,md}` (129 reddit tasks; 93 anchor routes, 166 anchor
strings, 12 DOM locators) was supplied and is the grading contract.

- **93/93 anchor routes** are represented in `ROUTES.md` (the 6 non-existent ones
  in §6 above are listed there under their real status).
- **57 anchored submission ids** were extracted by id and are seeded verbatim
  (real id, real title, real body, real author, real `net_score`,
  real `comment_count`, real timestamp) — see `assets/data_model.md`.
- **2 anchored comment ids** (`1042264` on submission `69404`, `1235250` on
  submission `59421`) are seeded with their full ancestor chain.
- Anchors that describe *content the agent creates* (new posts, new comments,
  edited bios, new forums) are capability requirements and are itemised in
  `TODO.md`.

### Anchor-derived data that had to be resolved from the DB

Tasks webarena-27..31 ask for "the count of comments with more downvotes than
upvotes, for the user who made the latest post on forum X". Resolved exactly:

| Forum | Latest submission (by id DESC) | Author | comments with `net_score < 0` | total comments | expected answer |
|---|---|---|---|---|---|
| Showerthoughts | 122512 | `nirinaron` | 0 | 0 | `0` |
| WorcesterMA | 123052 | `mineinhusdson` | 1 | 42 | `0` * |
| DIY | 119019 | `ziostraccette` | 1 | 7 | `1` |
| space | 134164 | `Dhghomon` | 0 | 0 | `0` |
| photoshopbattles | 131461 | `Proud_Idiot` | 0 | 0 | `0` |

\* webarena-28 expects `0` for WorcesterMA while the DB says 1 — the task's
gold answer disagrees with the live data. Recorded, not "fixed": the seed carries
the real value. See "Gaps / unverified".

Tasks webarena-66..69 need `/f/books` **hot top 10** to match the source exactly.
The real order (`ranking DESC, id DESC`), read straight from the DB:

| # | id | ranking | net_score | comments | author | title |
|---|---|---|---|---|---|---|
| 1 | 81371 | 3591 | 3591 | 184 | RunDNA | The letters of T. S. Eliot to Emily Hale that were kept sealed from 19… |
| 2 | 59421 | 3085 | 3085 | 125 | smita16 | Friendly reminder bookshop.org exists. |
| 3 | 59447 | 1716 | 1716 | 33 | SAT0725 | Appalachian prison book project seeks notebook donations… |
| 4 | 103102 | 1695 | 1695 | 27 | drak0bsidian | After Two Decades And 38 Children's Books Lin Oliver Continues… |
| 5 | 124017 | 1539 | 1539 | 43 | ZebZ | Museum issues appeal to save famed "Misty of Chincoteague" ranch… |
| 6 | 59466 | 1434 | 1434 | 31 | livingmybestestlyfe | How Ukrainian publishers are fighting to survive |
| 7 | 59478 | 1423 | 1423 | 147 | -something_something | The simple greatness of Agatha Christie |
| 8 | **17445** | 1423 | 1423 | 138 | Shaosil | I just finished reading The Hobbit to my 6 year old daughter, and she… |
| 9 | **59396** | 1335 | 1335 | 39 | ancienthippo | Apple Books has a free audiobook of A Christmas Carol narrated by LeVa… |
| 10 | 103061 | 1334 | 1334 | 142 | zsreport | What Is It That Makes Used Bookstores So Wonderful? |
| 11 | 81489 | 1321 | 1321 | 81 | drak0bsidian | After 30+ years, 'The Stinky Cheese Man' is aging well |
| 12 | 59401 | 1103 | 1103 | 116 | SublimeLime1 | Just finished Things Fall Apart (Chinua Achebe) and I LOVED it |

Note the tie at `ranking = 1423` between `59478` and `17445`, broken by
`id DESC` — get the tiebreak wrong and `17445` falls out of the top 10 and
webarena-66/67/68 fail. Both string-anchored posts — `17445`
("I just finished reading The Hobbit to my 6 year old daughter…", body contains
`The Hobbit` / `J. R. R. Tolkien`) and `59396` ("Apple Books has a free audiobook
of A Christmas Carol narrated by LeVar Burton!", body contains `A Christmas
Carol` / `LeVar Burton`) — land at positions **8** and **9**, so the mock must
seed at least the full top-12 of `/f/books` hot in the right order.

Observed here: for `/f/books`, `ranking` happens to equal `net_score` row for
row, so `hot` and `top` coincide. This is a property of the scraped data, not of
the algorithm — seed `ranking` as its own field, do not alias it to `net_score`.

---

## Seed scale and selection (rewritten 2026-08-09 — the expansion round)

| | before | after | source |
|---|---|---|---|
| submissions | 2,359 | **8,012** | 127,391 |
| comments | 2,593 | **23,667** | 2,551,513 |
| posts carrying >=1 comment | 427 (18%) | **5,180 (65%)** | 64% |
| `userDirectory` | 3,899 | **20,749** | 661,782 |
| submission images | 770 files | **2,748 files** | 31,467 |

The pipeline that produces all of this is committed in `assets/dumps/*.py` and is
re-runnable from a clean checkout: `anchor_ids.py` (contract → primary keys),
`extract_expansion.py` (selection + SELECT-only extraction),
`fetch_images.py`, `compress_images.py`, `merge_seed.py`, `verify_expansion.py`.
The `.json` dumps stay gitignored; the scripts deliberately do not.

**Selection is sort-coverage driven, not "N per forum".** A partial seed
reproduces page *N* of a listing sort if and only if it holds the source's top
25·*N* rows under that sort. So the seed takes, per forum, `hot`<=50 and
`top`/`new`/`most_commented`<=25, plus depth-25 coverage for the 13 (forum, sort)
pairs the anchor contract navigates to. Measured against the container:

| page-1 exact, of 95 forums | before | after |
|---|---|---|
| `hot` / `top` / `new` / `most_commented` | 5 / 5 / 5 / 5 | **95 / 95 / 95 / 95** |
| `active` | — | 18 (incl. the anchored `/f/Art/active`) |
| `controversial` | — | 9 (incl. the anchored `/f/springfieldMO/controversial`) |

`active` and `controversial` are covered only where an anchor names them:
`controversial` is `net_score ASC`, so blanket coverage would drag in ~2,400
lowest-scored rows for one anchor route.

---

## `commentCount` carries the SOURCE value, not the seeded count — do not "fix" this

A submission's `commentCount` is the container's `comment_count`. It sums to
**140,363** across the seed while only 23,667 comments are seeded, so a listing
can advertise "45 comments" over a thread that renders fewer. **That is
deliberate.** It was decided against the anchor contract, and re-deciding it
breaks tasks:

1. **Evaluator answers *are* the count.** VWA "How many comments did the post
   with this image receive?" ships `must_include: ["146"]`, `["23"]`, `["29"]`;
   "Tell me how many comments this post has" ships `["121"]`, and `["28"]` for
   `/f/food/82940`. Renumbering to the seeded count fails every one.
2. **A pagination cursor embeds it.** The anchor route
   `/f/EarthPorn/most_commented?t=all&next[commentCount]=89&next[id]=76289`
   requires submission 76289 to carry `commentCount = 89` exactly.
3. **`most_commented` ordering is anchored** on `/f/aww`,
   `/f/MechanicalKeyboards`, `/f/EarthPorn`, and webarena's "subscribe from the
   all-time most commented post in f/pittsburgh". Sorting by a seeded count
   changes which post leads.

The divergence is mitigated rather than removed: seeded comments went up 9.1x,
every anchored post carries up to 40 real comments, and 65% of posts now have a
thread at all (was 18%). Do not file "listing count > rendered comments" as a
defect; do not renumber `commentCount`.

`forums.json` `submissionCount` and `users.json` `submissionCount`/`commentCount`
follow the same rule and were re-verified against the container this round:
**0 mismatches on all 95 forums and all 70 user records.**

---

## Accepted deviations from the source

### Submission images are recompressed — do NOT "restore" them from the container

`public/submission_images/` holds all **2,748** files the seed references, but
they are **not byte-identical to the container**. They were recompressed on
2026-08-06 and again, harder, on 2026-08-09 when the seed tripled. The
2026-08-09 brief was explicit: keep the ~1000px long edge, do **not** try to
preserve perceptual detail.

| | files | bytes | mean |
|---|---|---|---|
| container originals for this set | 2,748 | ~3.4 GB | ~1.3 MB |
| **before 2026-08-09** (770-file seed) | 770 | 80.7 MB | 102.3 KB |
| **after 2026-08-09** (2,748-file seed) | 2,748 | **143.4 MB** | **51.0 KB** |

3.6x more images for 1.8x the bytes; mean file size **halved**. Per format after:

| bucket | files | bytes | mean | method |
|---|---|---|---|---|
| JPEG | 2,602 | 131.7 MB | 49.4 KB | long edge -> 1000px, **q30** progressive, 4:2:0 |
| GIF  |   128 |  10.1 MB | 77.2 KB | 4 frames evenly sampled, 1000px, 64 colours |
| PNG  |    18 |   1.6 MB | 85.5 KB | 1000px, adaptive-palette PNG8 (real alpha only) |

Thumbnails (`media/cache/submission_thumbnail_{1x,2x}`, 70px / 140px `outbound`
crop, quality 45) are 2,748 each: **4.5 MB** and **11.6 MB**. LiipImagine builds
these lazily, so the container's cache holds only 5 files — `fetch_images.py`
generates them locally from `config/packages/liip_imagine.yaml`, verified against
the previously shipped thumbnails at 4-12/255 mean absolute difference.

**The encoder is chosen by decoded content, not by file extension.** A `.png`
holding a photo is written back as JPEG bytes under its original `.png` name;
browsers sniff image content and ignore the declared type. 45 files already
shipped this way from the 2026-08-06 pass. Only PNGs with genuinely non-opaque
alpha stay PNG.

**Preserved:** filenames byte-identical (every URL still resolves, including the
two anchor routes `/submission_images/361ec602….jpg` and `…73199932….gif`) ·
aspect ratio · animation on every animated GIF · rendered `<img>` box
(`imageBox()` in `src/components/Submission.jsx` caps at 500px, so the box maths
is scale-invariant above that).

**Why 1000px:** `.submission__image { max-height: 500px }` in `src/styles/index.css`,
so nothing above ~1000px is ever displayed, even at 2x retina.

**Seed updated to match:** `images.json` is **regenerated from what is on disk**
by `compress_images.py` at the end of every run, so `w`/`h`/`full`/`thumb1x`/
`thumb2x` cannot drift from the files. Verified after this round: 2,748 manifest
entries, 2,748 referenced by a submission, **0 referenced-but-missing, 0 orphaned
entries, 0 entries above 1000px, 0 missing a thumbnail**. `compress_images.py
--prune` deletes files no submission references (601 orphans, 28.1 MB, were left
behind when the selection rule changed mid-round). The manifests describe the
SHIPPED files, not the container's originals.

**DO NOT re-copy from `/var/www/html/public/submission_images/` to restore parity,
and do not file image byte-size or pixel-dimension drift as a defect.** An audit
comparing bytes or dimensions against the container will see a difference; that
difference is intentional and accepted. Originals remain recoverable from the
container at any time.

---

## What I could not observe / left out

See "Gaps / unverified" at the end of `TODO.md` for the actionable list. In
summary:

- `messages`, `message_threads`, `notifications` row counts were not sampled;
  the mock treats these as empty-state-only screens.
- `themes` / `css_theme_revisions` (Postmill's DB-stored custom CSS) — checked
  for the design pass only; see `DESIGN.md` §0 for what was found.
- `wiki_pages` / `wiki_revisions` were not sampled; `/wiki` is P2.
- `flairs`, `submissions_flairs`, `bad_phrases`, `bans`, `user_blocks`,
  `hidden_forums`, `forum_log_entries` were not sampled — all are 0-or-near-0 and
  no anchor touches them.
- Image files: `images` has 31,467 rows and the real binaries live under the
  container's image store. Anchor strings include four real image filenames
  (e.g. `2e4fa0a328e653a97a7d07046291c298ef5b4e0d0c73a287f317ca86a8e8685f.jpg`);
  see `TODO.md` for the handling decision.
