# classifieds — Data Model

> Derived from the live MySQL schema (`docker exec classifieds_db mysql … osclass`).
> Raw dumps: `assets/dumps/*.jsonl`. Curated seed: `src/data/`.
> Regenerate with `python3 assets/build-seed.py`.

Real ids, slugs, prices, timestamps, seller names and e-mails are preserved verbatim.
Nothing in the seed was invented.

---

## 0. The two tiers

`DESIGN.md` §8 explains why. In short: the catalogue is 84,149 items / 71 MB, and the
session state posted to `/go` must stay ≈1 MB. So:

| Tier | Lives in | Mutable? | Size |
|---|---|---|---|
| **Static catalogue** | `src/data/catalog/`, `src/data/descriptions/`, reference tables | no | 74.6 MB on disk, lazily imported |
| **Session state** | `src/data/session_seed.json` → `createInitialData()` | yes | ~2 KB seeded; grows with agent actions |

Item resolution at read time:

```js
function getItem(id, state) {
  if (state.deletedItemIds.includes(id)) return null;          // 404/410 path
  const created = state.newItems.find(i => i.id === id);
  if (created) return created;
  const base = catalog.get(id);                                 // static shard
  if (!base) return null;
  return { ...base, ...(state.itemOverrides[id] || {}) };
}
```

---

## 1. Item

Source: `oc_t_item` ⋈ `oc_t_item_description` ⋈ `oc_t_item_location` ⋈ `oc_t_item_resource`.
**84,149 rows**, ids 1..84,154 with five gaps (4688, 11903, 13241, 57186, 84142).

Stored in `src/data/catalog/cat-<N>.json` as positional tuples to keep the files small.
The field order is published in each file's `fields` array and in
`assets/build-seed.py:CATALOG_FIELDS`:

| # | Key | Type | Real example | Notes |
|---:|---|---|---|---|
| 0 | `id` | int | `4799` | `pk_i_id`. **Never regenerate.** Also the image filename. |
| 1 | `cat` | int | `8` | `fk_i_category_id`, 2..24 |
| 2 | `price` | int | `185000000` | `i_price` = **dollars × 1,000,000**. Display `price/1e6` with 2 decimals. |
| 3 | `pub` | string | `"2023-11-01 12:31:44"` | `dt_pub_date`. Displayed as `2023/11/01`. |
| 4 | `title` | string | `"Kayak"` | ≤100 chars |
| 5 | `name` | string | `"Jacob Jefferson"` | `s_contact_name` — **this is "the seller"** |
| 6 | `email` | string | `"jacob_jefferson53@example.com"` | `s_contact_email`; 81,740 distinct |
| 7 | `city` | string | `"City of Akron"` | `s_city` |
| 8 | `regionIdx` | int | `19` | index into `regions.json` (not the GeoNames id — saves ~0.5 MB) |
| 9 | `cityId` | int | `7367175` | `fk_i_city_id`, for `sCity=` filtering |
| 10 | `phone` | string | `""` | usually empty |
| 11 | `showEmail` | 0\|1 | `1` | |
| 12 | `showPhone` | 0\|1 | `1` | |
| 13 | `imgExt` | 0\|1 | `0` | `0 = png`, `1 = jpg` (only Blake's 12 are jpg) |
| 14 | `excerpt` | string | 250 chars + `"..."` | Precomputed listing-card blurb, see §1.1 |

Each shard also carries a `count` and a precomputed `order` object:

```json
{"cat":8,"fields":[…],"count":770,"items":[[…],…],
 "order":{"newest":[ids…],"priceAsc":[ids…],"priceDesc":[ids…]}}
```

`items` holds every item in the category exactly once, in the source's default (`newest`)
sequence, with anything that sequence skips appended by id. Use it for lookups only —
the three `order` arrays are the *only* thing pagination should index into, and they are
deliberately **not** permutations of `items`. See §5.

Fields deliberately dropped from the seed (present in `assets/dumps/items.jsonl` if
needed later): `lat`, `lng`, `address`, `zip`, `city_area`, `country` (always `US`),
`cur` (always `USD`), `mod` (always null), `premium`/`enabled`/`active`/`spam`
(constant), `user_id` (null except Blake's 12 — captured as `myItems` instead),
`img_path`/`img_name` (derivable, see §7).

### 1.1 `excerpt`

The source computes this at render time as `osc_highlight(description, 250)`:
strip tags → replace `\n\r\t` with spaces → trim → collapse runs of whitespace →
`mb_substr(0, 250)` → append `...` if it was longer. `assets/build-seed.py:excerpt()`
reproduces it exactly. Search-term `<strong>` highlighting is applied client-side on top.

**Gallery view hides the excerpt** (`.listing-grid .listing-basicinfo .desc{display:none}`)
but the markup is still emitted.

---

## 2. Item description

Source: `oc_t_item_description.s_description`, 84,152 rows, 40 MB, avg 475 chars,
max 23,283.

`src/data/descriptions/desc-<floor(id/1000)>.json` → `{"4799": "A good size kayak…"}`.
**85 shards, avg 0.48 MB, max 0.57 MB.** Load exactly one, only on the item-detail route.

Renders into `<div class="desc">` inside `#description` — one of the four anchor
locators, asserted by tasks 680, 751, 752, 753.

---

## 3. Category

Source: `oc_t_category` ⋈ `oc_t_category_description`. **23 rows, all top-level**
(`fk_i_parent_id` is NULL for every one; there is no subcategory tree here).
`src/data/categories.json`, ordered by `i_position`:

| id | name | slug | items |
|---:|---|---|---:|
| 2 | Antiques | `antiques` | 5,447 |
| 3 | Appliances | `appliances` | 5,797 |
| 4 | Arts + crafts | `arts+crafts` | 2,516 |
| 5 | Auto parts | `autoparts` | 6,304 |
| 6 | Beauty + health | `beauty+health` | 1,974 |
| 7 | Bikes | `bikes` | 2,537 |
| 8 | Boats | `boats` | 770 |
| 9 | Books | `books` | 1,489 |
| 10 | Cars + trucks | `cars+trucks` | 7,606 |
| 11 | Cell phones | `cellphones` | 875 |
| 12 | Collectibles | `collectibles` | 6,789 |
| 13 | Computer parts | `computerparts` | 1,011 |
| 14 | Computers | `computers` | 1,768 |
| 15 | Electronics | `electronics` | 5,396 |
| 16 | Farm + garden | `farm+garden` | 6,602 |
| 17 | Furniture | `furniture` | 9,467 |
| 18 | Household | `household` | 8,244 |
| 19 | Jewelry | `jewelry` | 1,539 |
| 20 | Motorcycles | `motorcycles` | 814 |
| 21 | Music instruments | `musicinstruments` | 4,744 |
| 22 | Photo + video | `photo+video` | 938 |
| 23 | Rvs + campers | `RVs+campers` | 464 |
| 24 | Video gaming | `videogaming` | 1,058 |

Note the exact display strings — `Arts + crafts` and `Rvs + campers` are cased that way
in the DB and appear in `<h1>`, the breadcrumb, the home tiles and the card metadata.
There is **no category id 1** (deleted upstream).

---

## 4. Location

- **`oc_t_country`** — one row: `US` / `United States`. `src/data/countries.json`.
- **`oc_t_region`** — 51 rows, US states + `Washington, D.C.`. `pk_i_id` is a
  **GeoNames id**, not a sequence: Maryland `7361885`, Virginia `9254928`,
  Pennsylvania `9254927`, Ohio `8165418`. Anchor URLs use these raw ids
  (`sRegion=7361885`), so `regions.json` keeps `id` verbatim; `regionIdx` on an item is
  only a storage optimisation.
- **`oc_t_city`** — 39,888 rows, 6.4 MB. `src/data/cities.json`. Needed for the
  `sCity=` filter and the city autocomplete in the search sidebar.

Only 2,374 distinct cities and 7 distinct regions actually appear on items — the corpus
is concentrated in the mid-Atlantic / Ohio Valley.

Location renders as `City of Akron, Ohio, United States` on the item page
(`<li><strong>Location:</strong> …</li>`) and as `Brimfield  (Ohio)` — note the
**double space** — in listing cards.

---

## 5. Ordering and pagination

Page size is **12** everywhere (`defaultResultsPerPage@search`), for both `list` and
`gallery`. `iPage` is 1-based; offset = `max(iPage-1,0) * 12`.

The source sorts by `i_price` or `dt_pub_date` with **no tie-break**, and thousands of
items share a price. MySQL's order inside a tie group is not a stable total order — it
changes with the LIMIT and with which columns are selected. So the seed does **not**
derive an order; `assets/dump-orderings.py` **captures** it by replaying the site's own
query once per page (`SELECT oc_t_item.*, … ORDER BY … LIMIT 12 OFFSET n`) for every
category × the three sorts. Validated 34/34 against live pages. Full reasoning and the
measurements are in `DESIGN.md` §8 → *Ordering*.

Each shard's `order` object holds those captured sequences under `newest`, `priceAsc`,
`priceDesc`. **Slice them; never re-sort at runtime.**

`order` is deliberately **not** a permutation of `items`: OFFSET paging over an unstable
sort repeats some rows across pages and skips others, and the live site does exactly
that (category 24 `priceDesc` repeats 92 ids and omits 92). `items` holds each item once
for lookups; `order` holds the lossy sequence the site actually renders. Do not
deduplicate `order`.

For a global (no-category) query, `src/data/catalog/global-order.json` carries the
captured all-categories sequence for the first **200 pages** per sort (2,400 ids) — no
anchor route pages it deeper. Beyond that, fall back to a k-way merge of the per-category
arrays and accept the drift.

---

## 6. Comment

Source: `oc_t_item_comment` — **exactly one row in the entire database**:

```json
{"id":1,"itemId":10727,"pubDate":"2023-11-19 05:46:22","title":"Hello!",
 "authorName":"Blake Sullivan","authorEmail":"blake.sullivan@gmail.com",
 "body":"Nice bracelet","rating":3,"userId":1,"replyId":null}
```

Everything else in the comment anchor list is created by the agent during a task.
31 `program_html` tasks depend on this flow. Fields the form supplies:
`title`, `body`, `rating` (1–5, optional), `replyId` (for threaded replies),
`authorName`/`authorEmail` (hidden inputs, prefilled with the logged-in user).

`comments_per_page = 10`; `moderate_comments = -1` so a new comment is visible
immediately, no approval step.

Required DOM (asserted by `func:get_query_text(__page__, '.comments_list h3')` and
`'.comments_list'`) — see `SOURCE.md` §Comments for the full markup. The `h3` must read
`<strong>{title}</strong> <em>by {authorName}:</em>` so its text is
`{title} by {authorName}:`, and the rating must render `<span>({rating} of 5)</span>`.

---

## 7. Image resource

Source: `oc_t_item_resource`, one row per item, and `pk_i_id == fk_i_item_id` for all
84,149 — so nothing needs storing beyond the extension bit already on the item tuple.

Source URL scheme (for reference only; the mock does not use it):
`oc-content/uploads/{dir}/{id}[_thumbnail|_preview|_original].{ext}` where `dir` is the
item id for the 84,137 legacy items and `841` for Blake's 12.

**Mock scheme** (produced by `assets/extract-images.py`):

| Use | Path | Dimensions |
|---|---|---|
| Listing card / gallery tile / related listing | `/img/t/{id//1000}/{id}.webp` | 240×200 |
| Item-detail main photo | `/img/m/{id//1000}/{id}.webp` | 640×480 |
| Item-detail main photo, fallback | the `/img/t/…` file, rendered at 550 px | |
| No image | `/img/no_photo.gif` (extracted from the theme) | |

Tier A covers all 84,149 items; Tier B (640×480) covers the 1,530 ids in
`assets/tier_b_ids.txt`, which includes **all 180 anchor items**.

---

## 8. User

Source: `oc_t_user` — **one row**. `src/data/session_seed.json:user`.

```json
{"id":1,"name":"Blake Sullivan","username":"1","email":"blake.sullivan@gmail.com",
 "regDate":"2023-10-27 21:12:11","nItems":12,"nComments":1,
 "phoneLand":"","phoneMobile":"","website":"","country":"","region":"","city":"",
 "address":"","zip":"","isCompany":0,"profileImg":null}
```

`s_username` really is the string `"1"` — not a typo, and it shows in the
change-username form. Address fields are genuinely empty on the source.

Because there is only one user, "the seller" of any other listing is the item's
`name`/`email` pair, and there are **no public user-profile pages worth seeding**.

---

## 9. `createInitialData()` shape

```js
export function createInitialData() {
  return {
    user:               { …seed.user },
    comments:           [ …seed.comments ],   // 1 row
    myItems:            [84143,84144,84145,84146,84147,84148,84149,
                         84150,84151,84152,84153,84154],
    itemOverrides:      {},                   // { [id]: partial item } ← item_edit_post
    deletedItemIds:     [],                   //                        ← item_delete
    newItems:           [],                   //                        ← item_add_post
    nextItemId:         84155,                // == source AUTO_INCREMENT
    nextCommentId:      2,
    contactMessages:    [],                   //                        ← contact_post
    sendFriendMessages: [],                   //                        ← send_friend_post
    alerts:             [],                   //                        ← Subscribe to this search
    marks:              [],                   //                        ← report listing
  };
}
```

Seeded size ≈ 2 KB. It stays small because the catalogue is never copied into it.

`nextItemId: 84155` is load-bearing. Tasks 684 and 685 create a listing and the
evaluator reads `.price` on the page the agent lands on, so the new item must get the id
the source sequence would have handed out.

---

## 10. Record counts and why

| Entity | Seeded | Rationale |
|---|---:|---|
| Items | **84,149 — the complete table** | Anchors reach `iPage=331`; 61 tasks ask for the cheapest/most expensive item *on the whole site*. Any sampling changes the answer. Held outside session state so it costs disk, not state budget. |
| Item descriptions | 84,152 (all) | Tasks read specs out of the body text ("seat height in inches", "how much RAM"), and the item is not always an anchor. |
| Categories | 23 (all) | Top-level index; every one bears anchors |
| Regions | 51 (all) | `sRegion=` anchors; home page lists 7 |
| Cities | 39,888 (all) | `sCity=` filter + sidebar autocomplete |
| Comments | 1 (all) | That is the entire table; the rest are agent-created |
| Users | 1 (all) | That is the entire table |
| Tier A images | 84,149 | Every listing view is scanned visually (622 MB, gitignored) |
| Tier B images | 1,530 | Anchor-reachable item pages, derived not guessed |

### Coverage self-check

- Something to search for → `kayak` (79), `dogs` (128), `banana boat` (658), `clothes` (212) ✓
- Something to sort → three orders precomputed per category ✓
- Long enough to paginate → 551 pages in category 16, 634 in category 10 ✓
- Every P0/P1 workflow record present → Blake's 12 listings, the 1 comment,
  all 180 anchor items with real title/price/description/seller/location/image ✓
