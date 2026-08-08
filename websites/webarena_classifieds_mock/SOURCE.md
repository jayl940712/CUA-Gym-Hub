# classifieds — Source Recon Record

> Source site: `http://localhost:9980` → 302 → `http://10.186.197.203:9980/` (the configured `WEB_PATH`)
> Docker image: `jykoh/classifieds:latest` · containers `classifieds` (web) + `classifieds_db` (MySQL 8.1)
> Recon mode: **FULL** — docker exec and HTTP both available
> Recon date: 2026-08-08 · plan agent
> Read-only: no writes to the container, no UI mutations, `SELECT` only.

---

## Access

| Probe | Result |
|---|---|
| `docker ps --filter ancestor=jykoh/classifieds:latest` | `classifieds` (a5789f479bf3), up, `0.0.0.0:9980->9980` |
| `curl --noproxy '*' -L http://localhost:9980` | `200`, effective URL `http://10.186.197.203:9980/` |
| `docker exec classifieds ...` | works |
| `docker exec classifieds_db mysql -uroot -ppassword osclass` | works |
| Login as `blake.sullivan@gmail.com` / `Password.123` | works (see *Auth* below) |

Compose file: `/webarena/webarena-setup/webarena/classifieds_docker_compose/docker-compose.yml`.
Web container env: `CLASSIFIEDS=http://10.186.197.203:9980/`, `RESET_TOKEN=4b61655535e7ed388f0d40a93600254c`.

---

## Stack

| Layer | Detail |
|---|---|
| App | **Osclass** (osclass-classifieds.com fork, © 2021), PHP **8.1.27** |
| Server | PHP built-in dev server: `php -S 0.0.0.0:9980`, workdir `/usr/src/myapp` |
| Webroot | `/usr/src/myapp` (**not** `/var/www/html`, which is empty) |
| DB | MySQL **8.1** in container `classifieds_db`, db `osclass`, user `root`, pass `password`, host `db`, table prefix `oc_` |
| Theme | `oc-content/themes/sigma` — PHP templates, jQuery + fancybox, Font Awesome |
| Routing | Classic query routing: `index.php?page=<controller>[&action=<action>][&...]`. `rewrite_enabled` is effectively off for the URLs tasks use. |
| Uploads | `oc-content/uploads/` — **73 GB** on disk |
| Config | `/usr/src/myapp/config.php` (credentials above) |

Restore dump present in the image at `/usr/src/myapp/classifieds_restore.sql`.

---

## Data Inventory (measured)

| Table | Rows | Notes |
|---|---:|---|
| `oc_t_item` | **84,149** | ids 1..84,154; 5 gaps: 4688, 11903, 13241, 57186, 84142. `AUTO_INCREMENT = 84155` |
| `oc_t_item_description` | 84,152 | 1 row per item per locale (`en_US`) |
| `oc_t_item_resource` | 84,149 | exactly **one image per item**; `pk_i_id == fk_i_item_id` for every row |
| `oc_t_item_location` | 84,148 | |
| `oc_t_item_comment` | **1** | see *Comments* below |
| `oc_t_user` | **1** | Blake Sullivan only |
| `oc_t_category` | 23 | all top-level, ids 2..24 (id 1 deleted) |
| `oc_t_region` | 51 | US states + DC; ids are **GeoNames ids** (7-digit) |
| `oc_t_city` | 39,888 | |
| `oc_t_country` | 1 | `US` |
| `oc_t_currency` | 3 | `USD` (in use), `EUR`, `GBP` |
| `oc_t_item_meta` / `oc_t_meta_fields` | 0 / 0 | **no custom fields** — the `meta[...]` search params are dead here |
| `oc_t_pages` | 23 | 22 are e-mail templates (`b_indelible=1`); only `example_page` (id 23) is a real static page |
| `oc_t_widget`, `oc_t_latest_searches` | 0 | `save_latest_searches` pref is `0` |

Every item is `b_active=1, b_enabled=1, b_spam=0, b_premium=0` and `fk_c_currency_code='USD'`.
**There are no premium listings** — the "Premium listings" block never renders.
Only Blake's 12 items have `fk_i_user_id` set; all other 84,137 items have `fk_i_user_id = NULL`
(posted as guests, seller identity lives in `s_contact_name` / `s_contact_email`).

### Text volume

| Field | Total | Avg | Max |
|---|---:|---:|---:|
| `s_title` | 3.12 MB | 37 chars | 100 |
| `s_description` | 40.0 MB | 475 chars | 23,283 |

Description bytes are very unevenly distributed — category 10 (Cars + trucks) alone is
12.7 MB of the 40 MB.

### Items per category

| id | Category | Items | Pages @12 |
|---:|---|---:|---:|
| 2 | Antiques | 5,447 | 454 |
| 3 | Appliances | 5,797 | 484 |
| 4 | Arts + crafts | 2,516 | 210 |
| 5 | Auto parts | 6,304 | 526 |
| 6 | Beauty + health | 1,974 | 165 |
| 7 | Bikes | 2,537 | 212 |
| 8 | Boats | 770 | 65 |
| 9 | Books | 1,489 | 125 |
| 10 | Cars + trucks | 7,606 | 634 |
| 11 | Cell phones | 875 | 73 |
| 12 | Collectibles | 6,789 | 566 |
| 13 | Computer parts | 1,011 | 85 |
| 14 | Computers | 1,768 | 148 |
| 15 | Electronics | 5,396 | 450 |
| 16 | Farm + garden | 6,602 | 551 |
| 17 | Furniture | 9,467 | 789 |
| 18 | Household | 8,244 | 687 |
| 19 | Jewelry | 1,539 | 129 |
| 20 | Motorcycles | 814 | 68 |
| 21 | Music instruments | 4,744 | 396 |
| 22 | Photo + video | 938 | 79 |
| 23 | Rvs + campers | 464 | 39 |
| 24 | Video gaming | 1,058 | 89 |

The deepest anchor page (`sCategory=16&iPage=331`) sits comfortably inside category 16's
551 pages, and `sCategory=9&iPage=124` is that category's **last full page**. Pagination
depth is therefore only reachable with the **complete** per-category item set. See
`DESIGN.md` §Seed Strategy for the resulting architectural call.

---

## Observed Behavior (probed against the live site, not assumed)

### Pagination
- Page size is **12** for `sShowAs=list` *and* `sShowAs=gallery`
  (`defaultResultsPerPage@search = 12`; `maxResultsPerPage@search = 50` caps the
  undocumented `iPagesize` param — note the lowercase `s`, it is `iPagesize`, not `iPageSize`).
- `iPage` is **1-based**; `iPage=0` and `iPage=1` both render the first page.
  Offset = `max(iPage - 1, 0) * 12` (`search.php:341`).
- Counter copy: `<span class="counter-search">1477 - 1488 of 1489 listings</span>`.
- Overrunning the last page renders an empty listing area, still HTTP 200.

### Malformed / odd URLs the anchors reference
| URL | Source behavior |
|---|---|
| `index.php?page=search&sCategory=10&iPage=4y` | **HTTP 200, page 1.** `is_numeric('4y')` is false so `p_iPage` stays 0. The `<title>` still echoes the raw string: `Cars + trucks - page 4y - Classifieds`. |
| `/php?page=search&sCategory=4&sShowAs=gallery` | **HTTP 301** → `Location: http://10.186.197.203:9980/index.php?page=search&sCategory=4&sShowAs=gallery`. (PHP's dev server resolves `/php` to `index.php`.) |
| `index.php?page=item&id=<nonexistent>` | **HTTP 410 Gone**, but the *body* is the theme's 404 page: `<title>Error - Classifieds`, `<h1>404</h1>`, `<h2>OOPS! Page Not Found!</h2>`. Task `visualwebarena-681` asserts the literal string `404`, so the body copy is what matters. |
| `index.php?page=search&sPattern=<no matches>` | **HTTP 404** status, but renders the normal search shell with `<p class="empty" >There are no results matching "<pattern>". Note that only search terms of 4 or more characters are valid.</p>` |
| `index.php?page=page&id=1` | 410/404 — the numeric-id page route is not how static pages resolve here. |

### Search semantics (measured, then confirmed in `Search.php:829-841`)
- SQL is `MATCH(d.s_title, d.s_description) AGAINST('<pattern>' IN BOOLEAN MODE)`.
- **Multi-word patterns are OR, not AND.** Measured: `banana` → 30, `boat` → 628,
  `banana boat` → **658** = 30 + 628.
- **Minimum word length is 4 characters.** `dog` → 0 results, `dogs` → 128.
  `cat` → 0. (`ft_min_word_len = 4`; `innodb_ft_min_token_size` is 3 but the index behaves at 4.)
- **No stemming.** `boat` → 628 but `boats` → 93; `kayak` → 79, `kayaks` → 31;
  `painting` → 529, `paintings` → 110.
- **Stopwords return zero.** Verified 0 results for `with from that what when where will been have`.
- Sortable columns (`Search::getAllowedColumnsForSorting`): **`i_price`, `dt_pub_date`,
  `dt_expiration`** only. Anything else silently falls back to the default.
- `iOrderType` is compared against the *strings* `'asc'` / `'desc'`. Numeric `0`/`1` do
  **not** match under PHP 8 and fall through to the default (`desc`).
- Defaults: `sOrder=dt_pub_date`, `iOrderType=desc`, `sShowAs=list`.
- When `sPattern` is empty and `sOrder` would be `relevance`, it is forced to `dt_pub_date`.

### Prices
`oc_t_item.i_price` is an integer of **price × 1,000,000**.
`i_price = 30000000000` renders as `30000.00 $`. Divide by 1e6 for the display value.

Display format is `<amount> $` — **symbol trailing, space-separated, always 2 decimals,
no thousands separator** (e.g. `28995.00 $`, `8.00 $`). This comes from the `en_US`
row in `oc_t_locale` (`s_currency_format`), not from an intuition about US formatting.

### Dates
Listing/item dates render as `YYYY/MM/DD` (e.g. `2023/11/01`). The corpus is dated
Oct–Nov 2023.

### Character encoding — reproduce the mojibake
The DB stores UTF-8 bytes in `utf8mb3` columns read over a latin1 connection, so the
live site **renders double-encoded text**. Item 1's seller renders on the page as
`Jennifer KovÃ¡cs` with email `jennifer_kovÃ¡cs496@example.com` — not `Kovács`.
Confirmed by curling the live item page, not just by reading the DB.
The dumps in `assets/dumps/` were taken with `--default-character-set=utf8mb4`, which
reproduces exactly what the browser shows. **Do not "fix" this** — seller names are
compared by string-matching evaluators.

### Auth
- `page=login` POSTs `page=login&action=login_post&email=&password=` plus a hidden
  `octoken` (name is literally `octoken`, not `CSRFToken`).
- Once logged in, `page=login` **302s to `index.php?page=user&action=items`** and
  `page=register` 302s to `/`.
- `page=user&action=dashboard` **302s to `page=user&action=items`** — the dashboard is
  not a distinct rendered view on this deployment.
- `page=item&action=contact&id=N` 302s to `/` — contacting the seller happens through
  the inline form in the item sidebar, not a standalone page.

### Comments
`oc_t_item_comment` contains exactly **one** row: id 1 on item **10727**, title
`Hello!`, author `Blake Sullivan`, body `Nice bracelet`, rating **3**.

This is decisive for the migration: **every other comment string in the anchor list is
something the agent is expected to create during the task.** 31 `program_html` tasks
post a comment and then assert on `.comments_list` / `.comments_list h3`. The
comment-posting flow is therefore P0, and it must render into exactly this DOM:

```html
<div class="comments_list">
  <div class="comment has-user-img">
    <p class="user-img"><img src=".../default-user-image.png" alt="Blake Sullivan"/></p>
    <h3><strong>Hello!</strong> <em>by Blake Sullivan:</em></h3>
    <p class="comment-rating"> …five <i class="fa fa-star[ fill]"></i>… <span>(3 of 5)</span></p>
    <p>Nice bracelet</p>
    <p class="comment-delete-row"><a …>Delete</a></p>
    <p class="comment-reply-row"><a href="#" class="comment-reply" data-id="1" …>Reply</a></p>
  </div>
</div>
```

`.comments_list h3` yields the text `Hello! by Blake Sullivan:` — which is why anchors
read `Question by Blake Sullivan`, `Nice car by Blake Sullivan`, and so on.
Rating renders as `(N of 5)`, matching the `3 of 5` / `4 of 5` / `5 of 5` anchors.
`moderate_comments = -1` and `reg_user_post_comments = 0`, so a posted comment appears
immediately with no approval step. `comments_per_page = 10`.

### Sellers
There is only one registered user, so "the seller" of an ordinary listing is
`s_contact_name` + `s_contact_email` on the item row: 81,740 distinct emails across
7,393 distinct names. All the `*@example.com` anchor strings are these fields.

---

## Images

- One resource per item, `pk_i_id == fk_i_item_id`, so the URL is derivable from the item id.
- Two path schemes coexist:
  - **Legacy (84,137 items):** `s_path = oc-content/uploads/<id>/`, extension `png`.
  - **Blake's 12 items (84143–84154):** `s_path = oc-content/uploads/841/`, extension `jpg`.
    (`841` = `floor(id/100)`. That directory also contains legacy item 841's `841.png`.)
- Four files per resource: `<id>.<ext>`, `<id>_original.<ext>`, `<id>_preview.<ext>`,
  `<id>_thumbnail.<ext>`. Typical sizes ≈ 460 KB / 380 KB / 270 KB / 90 KB.
- Item page uses `<id>.<ext>` as the main photo and `<id>_thumbnail.<ext>` in the strip;
  listing cards use `<id>_thumbnail.<ext>` at `width="240" height="200"`.
- **Total on disk: 73 GB.** Copying wholesale is not an option; see `DESIGN.md`
  §Image Strategy for the measured re-encode plan.
- 234 of the 234 tasks are *visual* tasks ("the cheapest **blue** kayak", "the **red** car
  in the second row"). Images are not decoration here — they carry the answer.

---

## Task-Contract Coverage

Anchors were pre-generated (`assets/task_anchors.{json,md}`, `assets/anchor_item_ids.txt`).
234 tasks: 131 `url_match`, 78 `string_match`, 31 `program_html`.

| Check | Result |
|---|---|
| Anchor routes present in `ROUTES.md` | **227 / 227** — every anchor path shape is mapped |
| Distinct anchor item ids | 180 |
| Anchor item ids that exist in `oc_t_item` | **180 / 180** (verified by id, see `assets/data_model.md`) |
| Anchor locators (`.desc`, `.price`, `.comments_list`, `.comments_list h3`) | all 4 exist in the source DOM; captured in `assets/html/` |
| Cross-site tasks | 2 (`visualwebarena-712`, `-713`) also need the shopping mock |

Anchor ids 84144–84154 are Blake's own listings and are the targets of the edit/delete/
post tasks, so their **current** field values are not what the evaluator expects — e.g.
task 680 edits item 84144's price from `30000.00` to `25000.00`, and task 681 deletes it
and expects the `404` body. Seed them at their *current* DB values; the tasks do the rest.

---

## Gaps / Unverified

- **Region/city browse pages.** The home page links `index.php?page=search&sRegion=<id>`
  for 7 regions only. I did not find a dedicated region *index* page in this theme; region
  filtering is a search parameter, not its own route. If one exists behind rewrite rules it
  is unreachable with `rewrite_enabled` off, which is how the tasks address the site.
- **`page=custom` and `page=reset`.** Controllers exist (`reset.php` is the WebArena
  state-reset hook keyed on `RESET_TOKEN`). Not exercised — resetting would mutate the
  source container. Out of scope for the mock.
- **Alerts.** `oc_t_alerts` was not sampled; the alerts view renders empty for Blake and
  no task touches it.
- **Custom fields.** `oc_t_meta_fields` is empty, so the `meta[...]` search parameters and
  the per-category custom-field UI have no data behind them on this deployment. I recorded
  the parameters for completeness but they are inert.
- **Premium listings.** `b_premium = 0` for all 84,149 items, so I never saw the premium
  block render and cannot describe its live appearance beyond the template source.
- **Keyword-search result ordering is not pre-captured.** Category and all-categories
  orderings were captured page-by-page from the source and validated 34/34 (see
  `DESIGN.md` §8 → *Ordering*). Searches with an `sPattern` were not: the result set
  depends on the FULLTEXT match, so it cannot be enumerated ahead of time the same way.
  Nine anchor routes carry an `sPattern`. Their **membership** is reproducible from the
  documented FULLTEXT semantics, but the order **within equal prices/dates** will drift
  from the source. Flagging rather than hiding it.
- **All-categories listing captured to 200 pages only** (2,400 of 84,149 ids) per sort.
  No anchor route pages it deeper, but a human clicking past page 200 of
  `index.php?page=search` will see order drift.
- **Related-listings selection.** The item page shows 3 same-category items; I confirmed
  the count and the markup but did not reverse the exact selection rule from
  `Search::_makeSQLPremium`-adjacent code. No task asserts on them.
