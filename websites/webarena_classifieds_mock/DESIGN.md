# classifieds Design System

> Extracted from the source theme's own stylesheet, not from screenshots:
> `oc-content/themes/sigma/css/style.css` (50 KB) and `css/responsive.css` (8 KB),
> pulled out of the container to `/tmp/recon/classifieds/theme/`.
> Every token below cites the selector it came from.

---

## 1. Visual Theme

Osclass **"sigma"** theme. A light, roomy classifieds layout on a 980 px fixed grid:
white header, serif display headings against a sans-serif body, a single teal accent,
and a pale mint footer. Cards are flat with hairline `rgba(0,0,0,0.1)` borders and
3–4 px radii — no heavy shadows anywhere.

`<body>` carries a page class the CSS keys off: `home`, `search`, `item`,
`item item-post`, `user`, `user-items`, `login`, `register`, `contact`. **The mock must
set the same body classes**, because the sidebar/main widths differ per page (§4).

---

## 2. Color Palette

| Token | Hex | Source selector |
|---|---|---|
| Accent / primary | `#0d9ecc` | `button, .btn {background:#0d9ecc}` · `a {color:#0d9ecc}` |
| Accent hover / active | `#056786` | `.btn.btn-primary:hover {background:#056786}` · `.doublebutton a.active {background:#056786}` |
| Accent light (borders) | `#9bcad8` | `.btn.btn-secondary {border:2px solid #9bcad8}` · `.paginate a {border:2px solid #9bcad8}` |
| Body text | `#222` | `html{color:#222}` |
| Headings / price | `#000` | `h1{color:#000}` · `.listing-card .currency-value{color:#000}` · `#sidebar .price{color:#000}` |
| Muted meta text | `#888` | `.listing-list .listing-details{color:#888}` |
| Icon grey | `#aaa` | `#home-regs a i{color:#aaa}` |
| Panel fill | `#f6f6f4` | `#home-cats{background:#f6f6f4}` · `#sidebar .filters{background:#f6f6f4}` |
| Home hero wash | `#F1FAEE` | `body.home header, body.home section.home-search {background-color:#F1FAEE}` |
| Footer | `#cde8e9` | `footer{background:#cde8e9}` |
| Header | `#fff` | `header{background-color:#fff}` |
| Category icon | `#75a9ab` | `#home-cats a .icon{color:#75a9ab}` |
| Star (filled) | `#ffb900` | `.comment-rating i.fill{color:#ffb900}` |
| Star (empty) | `#ccc` | `.comment-rating i{color:#ccc}` |
| Publish-Ad button | `#000` bg, `#fff` text | `header .nav a.publish{background:#000;color:#fff}` |
| Hairline border | `rgba(0,0,0,0.1)` | `.listing-card{border-bottom:1px solid rgba(0,0,0,0.1)}` |
| Error text | `#b94a48` | validation messages |

No CSS custom properties exist in the source — these are literal values throughout.

---

## 3. Typography

Two webfonts, loaded from Google Fonts on the source. **The mock must self-host them**
(no runtime network calls): `EB Garamond 400`, `Nunito 400/700`.

| Role | Font stack | Size | Line-height | Weight | Source |
|---|---|---|---|---|---|
| Root | `'Nunito', sans-serif` | `14px` | `18px` | 400 | `html{font-size:14px;line-height:18px}` · `html,input,select,textarea,button{font-family:'Nunito',sans-serif}` |
| `h1`, `h2.h1` | **`'EB Garamond', serif`** | `56px` | `58px` | **normal** | `h1, h2.h1 {…font-family:'EB Garamond',serif;font-weight:normal}` |
| Item title (`#item-content h1`) | EB Garamond | `46px` | `50px` | normal | `#item-content h1{font-size:46px;line-height:50px;margin:0 0 20px 0}` |
| `h2`, `h3.h2` | Nunito | `28px` | `36px` | bold | `h2, h3.h2{font-size:28px;line-height:36px;margin:10px 0 25px 0;font-weight:bold}` |
| `h3` | Nunito | `24px` | `30px` | bold | `h3{font-size:24px;line-height:30px;font-weight:bold}` |
| Search-page `h2` | Nunito | `20px` | `22px` | bold | `body.search #main h2{font-size:20px;line-height:22px;margin:10px 0}` |
| Home section `h2` | Nunito | `22px` | `26px` | bold | `#home-cats h2`, `#home-regs h2`, `.home-latest h2` |
| Form `h1` | EB Garamond | `44px` | `46px` | normal | `.form-container-box .header h1{font-size:44px;line-height:46px;text-align:left}` |
| `label` | Nunito | `16px` | — | bold | `label{width:100%;float:left;clear:both;font-size:16px;margin:0 0 3px 0;font-weight:bold}` |
| Nav link | Nunito | `16px` | `25px` | bold | `header .nav a{font-weight:bold;font-size:16px;line-height:25px}` |
| Card price (grid) | Nunito | `17px` | `20px` | bold | `.listing-card .currency-value{font-weight:bold;color:#000;font-size:17px;line-height:20px}` |
| Card price (list) | Nunito | `20px` | `22px` | bold | `.listing-list .listing-card .currency-value{font-size:20px;line-height:22px}` |
| Sidebar price (item page) | Nunito | **`40px`** | `44px` | bold | `#sidebar .price{font-size:40px;line-height:44px;text-align:right;color:#000}` |
| Category tile label | Nunito | `14px` | `18px` | bold | `#home-cats a strong{font-size:14px;line-height:18px;max-height:36px}` |
| Breadcrumb | Nunito | `14px` | `18px` | normal | `div.breadcrumb{line-height:18px;font-size:14px;margin:0 0 20px 0}` |
| Footer | Nunito | `14px` | — | normal | `footer` block |

`html{word-break:break-word}` is set globally — long titles wrap mid-word.

---

## 4. Spacing & Layout

| Metric | Value | Source |
|---|---|---|
| Page container | **`980px`**, auto margins | `.wrapper{width:980px;margin-left:auto;margin-right:auto}` |
| Header | `#fff`, `padding:10px 15px`, nav block `height:65px` | `header{…padding:10px 15px}` · `header .nav{float:right;height:65px}` |
| Header bottom border | `1px solid rgba(0,0,0,0.1)` on every page **except home** | `body:not(.home) header{border-bottom:…}` |
| Section padding | `20px` top, `50px` bottom | `section{padding-top:20px;padding-bottom:50px}` |
| Footer | `padding:35px 0 25px 0` | `footer{…}` |
| **Home** | `#main` `640px` **left**; no right rail | `body.home #main{width:640px;float:left}` |
| **Search / user** | `#sidebar` `210px` **left**, `#main` `728px` **right** | `body.search #sidebar,body.user #sidebar{float:left;width:210px}` · `body.search #main,body.user #main{float:right;width:728px}` |
| **Item detail** | `#main` `640px` **left**, `#sidebar` `300px` **right** | `body.item #main{width:640px;float:left}` · `#sidebar{width:300px;float:right}` |
| **Publish/edit ad** | `#main` `760px` | `body.item.item-post #main{width:760px}` |
| Filters panel | `#f6f6f4`, `padding:15px 12px`, `margin:0 0 15px 0` | `#sidebar .filters{…}` |
| Sidebar inputs | `height:40px;padding:8px 8px;width:100%` | `#sidebar input[type="text"],… {…}` |
| Sidebar buttons | `min-height:40px;padding:8px 20px;font-size:15px` | `#sidebar button, #sidebar .btn{…}` |
| Breakpoints | `490px`, `767px/768px`, `980px/981px` | `responsive.css` `@media` list |

### Listing grid (`sShowAs=gallery`)

```css
.listing-card-list.listing-grid {margin-left:-10px;margin-right:-10px;width:calc(100% + 20px);}
.listing-grid .listing-card {float:left;width:23%;padding:0;background-color:#FFF;border-radius:0;
                             border:1px solid rgba(0,0,0,0.1);margin:0 1% 20px 1%;display:block;}
.listing-grid .listing-card img {width:100%;height:auto;border-top-left-radius:4px;
                                 border-top-right-radius:4px;transition:0.2s;}
.listing-grid .listing-card .listing-thumb:hover img {transform:scale(1.08);}
.listing-grid .listing-basicinfo .desc {display:none;}          /* no excerpt in gallery */
```

**Override on the search page and in related listings** — cards are 3-up, not 4-up:

```css
body.search .listing-grid .listing-card,
.similar_ads .listing-grid .listing-card {width:calc(33.33% - 20px);margin:0 10px 20px 10px;}
```

### Listing rows (`sShowAs=list`)

```css
.listing-card {clear:both;padding:20px 0;border-bottom:1px solid rgba(0,0,0,0.1);
               width:100%;display:table;position:relative;}
.listing-card .listing-thumb {float:left;}
.listing-card .listing-thumb img {height:auto;width:95px;}
.listing-list .listing-card .listing-detail {width:auto;margin-left:105px;}
.listing-list .listing-details {font-size:14px;margin:0 0 5px 0;color:#888;}
.listing-list .listing-details > span:after {content:"/";margin:0 5px 0 10px;}
.listing-list .listing-details > span:last-child:after {display:none;}
.listing-list .desc {line-height:20px;max-height:80px;overflow:hidden;}
```

The `/` separators between category / location / date are **CSS `::after` content**, not
markup — the DOM has three bare `<span>`s.

### Item detail

```css
.item-header {margin:0 0 15px 0;padding:12px 5px;
              border-top:1px solid rgba(0,0,0,0.1);border-bottom:1px solid rgba(0,0,0,0.1);}
.item-photos .main-photo {width:550px;float:left;}
.item-photos .thumbs {float:right;width:79px;}
.item-photos .thumbs img {margin-bottom:10px;border:solid 2px rgba(0,0,0,0.1);transition:0.2s;}
#description .desc {clear:both;display:block;float:left;width:100%;line-height:24px;margin:0 0 25px 0;}
.contact_button {clear:both;float:left;width:100%;margin:0 0 25px 0;}
```

### Home blocks

```css
body.home header, body.home section.home-search {background-color:#F1FAEE;}
#home-cats {width:100%;border-radius:5px;background:#f6f6f4;padding:25px 13px 14px 25px;}
#home-cats a {float:left;width:110px;height:120px;padding:10px 5px 0 5px;margin:0 10px 11px 0;
              background:#fff;border:1px solid rgba(0,0,0,0.1);border-radius:4px;text-align:center;}
#home-cats a .icon {display:block;margin:0 0 10px 0;color:#75a9ab;}
#home-cats a .icon i {font-size:34px;line-height:56px;}
#home-regs {width:100%;padding:25px 0;}
#home-regs .wrap > div:nth-of-type(1n+10) {display:none;}   /* only 9 regions ever show */
.home-latest {width:100%;margin:0 0 40px 0;}
```

---

## 5. Component Patterns

### Buttons

```css
button, .btn {position:relative;text-align:center;float:left;background:#0d9ecc;color:#fff;
  padding:8px 12px;font-size:14px;line-height:18px;border:1px solid rgba(0,0,0,0.05);
  border-bottom-color:rgba(0,0,0,0.1);border-radius:3px;box-shadow:none;outline:none;
  cursor:pointer;transition:0.2s;}
.btn.btn-primary {background:#0d9ecc;border-color:#0d9ecc;color:#fff;}
.btn.btn-primary:hover {background:#056786;border-color:#056786;color:#fff;}
.btn.btn-secondary {background:transparent;border:2px solid #9bcad8;color:#056786;}
.btn.btn-secondary:hover {border-color:#056786;color:#056786;}
```

Nav links are pill-shaped: `header .nav a {padding:5px 12px;border:1px solid transparent;
border-radius:100px;transition:.2s}` with `:hover {border-color:#0d9ecc}`.
"Publish Ad" is the solid black one.

### Sort control and layout toggle

```css
.btn.see_by {float:right;white-space:nowrap;display:block;position:relative;
             font-size:14px;line-height:18px;font-weight:normal;padding:10px 12px;height:40px;}
.btn.see_by:hover label i:before {content:"\f106";}    /* chevron flips on hover-open */
.doublebutton {float:right;margin-right:10px;}
.doublebutton a {float:left;width:40px;height:40px;padding:0;font-size:20px;margin-left:5px;}
.doublebutton a.active {background:#056786;border-color:#056786;color:#fff;}
.counter-search {float:left;line-height:18px;margin:11px 5px 11px 0;}
```

The sort menu is a **CSS hover dropdown** (`.see_by ul`), not a JS widget.

### Pagination

```css
.paginate {text-align:center;clear:both;margin:25px 0;float:left;width:100%;}
.paginate li {display:inline;list-style-type:none;}
.paginate a, .paginate span {display:inline-block;font-weight:bold;text-decoration:none;
  margin:0 1px;padding:9px 5px;text-align:center;border-radius:0;height:40px;min-width:40px;
  line-height:20px;background:#fff;border:2px solid #9bcad8;color:#056786;}
.paginate a:hover {border-color:#056786;}
```

Current page is a `<span class="searchPaginationSelected">`; the rest are anchors with
`searchPaginationNonSelected` / `Prev` / `Next` / `Last`. See `ROUTES.md` for the markup.

### Comment ratings

```css
.comment-rating i {margin:0 -3px 0 0;font-size:16px;line-height:16px;color:#ccc;}
.comment-rating i.fill, .comment-leave-rating i.is-rating-item.fill {color:#ffb900;}
.comment-leave-rating {margin:7px 0;float:left;}
```

Five `<i class="fa fa-star">`, the first N carrying `fill`, followed by `<span>(N of 5)</span>`.

### Breadcrumb

```css
div.breadcrumb {line-height:18px;font-size:14px;height:auto;margin:0 0 20px 0;padding:0;}
ul.breadcrumb li {float:left;padding:0 2px;font-weight:normal;}
```

Rendered as `Classifieds > <Category> > <Item title>` with literal ` > ` text nodes and
schema.org `BreadcrumbList` microdata.

---

## 6. Shadow & Elevation

There is effectively **none**. `box-shadow:none` is set explicitly on buttons and sidebar
inputs. Elevation is expressed purely with `1px solid rgba(0,0,0,0.1)` borders and the
`#f6f6f4` / `#F1FAEE` / `#cde8e9` background washes. Radii are `3px` (buttons),
`4px` (cards, category tiles), `5px` (the home category panel), `100px` (nav pills).
The only motion is `transition:0.2s` on buttons/links and `transform:scale(1.08)` on
gallery thumbnail hover.

---

## 7. Iconography

Font Awesome **5** (`fa-search`, `fa-angle-down`, `fa-star`, `fas fa-bars`,
`fas fa-border-all`, `fas fa-times`). Loaded from a CDN on the source — **self-host or
inline SVG equivalents in the mock; no runtime network calls.**

---

## 8. Seed Strategy — the architectural call

This is the decision the rest of the migration hangs on. Numbers below are measured, not
estimated (see `SOURCE.md` §Data Inventory).

### The constraint

The state posted to and diffed by `/go` should stay **under ~1–2 MB**. The catalogue is
**84,149 items / 13.6 MB** of metadata and **41 MB** of descriptions. Those two facts are
only compatible if the catalogue is **not part of session state**.

### The options, quantified

| Option | Size | Verdict |
|---|---|---|
| **A.** Full table, all 84,149 items, in `createInitialData()` | 13.6 MB raw metadata + 41 MB descriptions | **Rejected** — 25–50× the state budget; every `/go` call would serialise it |
| **B.** Trim to a sample (e.g. 60 rows/category, 1,380 items) | ~0.4 MB | **Rejected** — breaks the anchors. `sCategory=16&iPage=331` needs 3,972+ rows in one category; `sCategory=9&iPage=124` needs 1,489. And 61 tasks ask for "the cheapest/most expensive X **on this site**", whose answer changes the moment a row is dropped. |
| **C.** Full seed for anchor-bearing categories only | all 23 categories bear anchors | **Not a reduction** — anchors span every category 2–24 |
| **D. Full table, held as static reference data outside session state, lazily sharded** | 29 MB raw / 11.7 MB gzipped on disk; **~30 KB of session state** | **Recommended** |

### Recommendation — option D

Split the seed into two tiers with different lifetimes.

**Tier 1 — static catalogue. Never enters `createInitialData()`.**

| File | Shape | Size |
|---|---|---|
| `src/data/catalog/cat-<2..24>.json` | 23 shards, one per category, compact tuples: `[id, cat, price, pub, title, name, email, city, regionIdx, cityId, phone, showEmail, showPhone, imgExt, excerpt250]` | 29.0 MB total / 11.7 MB gz. Largest shard: cat 17 at **3.2 MB**; smallest: cat 23 at 0.18 MB |
| `src/data/descriptions/desc-<0..84>.json` | 85 shards keyed by `floor(id/1000)`, `{id: fullDescription}` | 41 MB total, **avg 0.48 MB, max 0.57 MB per shard** |
| `src/data/{categories,regions,cities,currencies,pages,locale}.json` | reference tables | 6.4 MB (cities dominates) |

Load rules:
- Category browse → `import()` exactly **one** catalogue shard.
- Item detail → that item's catalogue shard **+ one** description shard (~0.5 MB).
- Global search (`sPattern` with no `sCategory`) → all 23 shards in parallel, then cache
  in a module-level `Map` for the rest of the session. One-time ~11.7 MB gz over
  localhost. There are 9 such anchor routes, so this path must work — do not skip it.
- The 250-char excerpt lives in the catalogue shard precisely so that list views never
  need a description shard. That is why the catalogue is 29 MB rather than 13.6 MB, and
  it is the right trade: a search page would otherwise pull 12 description shards (5.7 MB).

**Tier 2 — session state. This is all `createInitialData()` returns.**

```js
{
  user,                 // the single oc_t_user row, Blake Sullivan
  comments,             // the 1 seeded comment (item 10727) + everything the agent posts
  myItems,              // ids 84143..84154 — Blake's 12 listings
  itemOverrides,        // { [id]: {…changed fields} } from item_edit_post
  deletedItemIds,       // [] — item_delete pushes here
  newItems,             // [] — item_add_post pushes here
  nextItemId: 84155,    // matches the source AUTO_INCREMENT exactly
  nextCommentId: 2,
  contactMessages, sendFriendMessages, alerts, marks
}
```

Under 30 KB. Item resolution is `deletedItemIds.has(id) ? null : {…catalog[id], ...itemOverrides[id]}`,
with `newItems` checked first.

`nextItemId` **must** start at 84155. Tasks 684/685 create a listing and the evaluator
reads `.price` on the resulting page, so the new id has to follow the source's sequence.

### Ordering — captured, never re-derived

This is the subtlest part of the migration and it cost a round of measurement to get right.

The source sorts by `i_price` or `dt_pub_date` with **no tie-break**, and thousands of
items share a price. MySQL's order inside a tie group is whatever the query plan yields,
and it is **not** a stable total order — it changes with the LIMIT. Measured on category
11, `i_price ASC`, first 12 rows:

| Query | First 12 ids |
|---|---|
| `LIMIT 12` (what the site issues) | `19982 66339 20278 9379 73349 57653 …` ← matches the live page |
| same query, no `LIMIT` | `9379 15619 19982 20278 23114 23756 …` |
| via `iPagesize=50` | `19982 66339 4696 7915 43992 4188 …` |

Selecting only `pk_i_id` instead of `oc_t_item.*` also changes it — a covering index
produces id order, the site's `SELECT oc_t_item.*` produces a filesort order.

An obvious-looking "sort by price, then id" tie-break therefore puts **different items on
deep pages than the source does**. That is not cosmetic: roughly a dozen tasks are phrased
*"navigate to the item **on this page** whose image has …"* against URLs as deep as
`iPage=331`, so the page's contents are the answer. A derived order scored 13/21 against
live anchor pages; every failure was inside a price tie.

So the seed **captures** the ordering instead of deriving it.
`assets/dump-orderings.py` replays the site's own query once per page
(`SELECT oc_t_item.*, … WHERE … ORDER BY … LIMIT 12 OFFSET n`) for every category × the
three sort options — ~21,000 queries, about 5 minutes — and `build-seed.py` bakes the
result into each shard's `order` object.

Validated against **34 live pages** (every anchor pagination shape plus the first page of
every category): **34/34 exact**, ids and order.

**The client must slice those arrays and never sort at runtime.** Sorting client-side
reintroduces exactly the bug this measurement exists to prevent.

#### The captured order is not a permutation — and that is correct

`LIMIT`/`OFFSET` paging over a sort with no tie-break can hand back the same row on two
pages and never show another. The source really does this. Measured, e.g. category 24
`i_price DESC`: 92 ids appear twice across the 89 pages and 92 others never appear at all.
Category 6 `i_price ASC` repeats 278 of its 1,974 items. Every captured id is a genuine
member of its category (`extra = 0` for all 69 category × sort combinations), so nothing
is fabricated — the sequence is simply lossy, exactly as the live site is.

The seed models this honestly:

- `items` — the complete category, every item exactly once (for `getItem` lookups)
- `order.<sort>` — the literal page-by-page capture, duplicates and gaps intact

Do not "repair" `order` by deduplicating it. The tasks were authored against pages the
live site actually renders, and those pages contain the duplicates.

Scope limit: the all-categories listing (`page=search` with no `sCategory`) is captured
for the first **200 pages** per sort, since no anchor route pages it deeper.
Keyword searches (`sPattern`) have their own FULLTEXT-dependent ordering and are not
pre-captured — see `SOURCE.md` §Gaps.

---

## 9. Image Strategy

Measured: 84,149 photos, one per item, **73 GB** on disk as PNG
(`<id>.png` 640×480 ≈ 422 KB, `<id>_thumbnail.png` 240×200 ≈ 82 KB).
All 234 tasks are *visual* — "the cheapest **blue** kayak", "the **red** car in the
second row". Images carry the answers; placeholders would fail the site outright.

Re-encoding measured on real samples:

| Variant | Avg | × 84,149 |
|---|---:|---:|
| 240×200 WebP q75 | 7.5 KB | **0.64 GB** |
| 240×200 WebP q60 | 6.1 KB | 0.53 GB |
| 240×200 JPEG q80 | 10.9 KB | 0.93 GB |
| 640×480 WebP q75 | 34.9 KB | 3.01 GB |
| 640×480 JPEG q82 | 59.0 KB | 5.08 GB |

**Adopted plan** (already executed by `assets/extract-images.py`):

| Tier | Content | Output | Size |
|---|---|---|---|
| **A** | All 84,149 thumbnails → 240×200 WebP q75 | `public/img/t/<id//1000>/<id>.webp` | **622 MB** measured, 85 dirs × ~1,000 files |
| **B** | 1,530 items → 640×480 WebP q75 | `public/img/m/<id//1000>/<id>.webp` | **47 MB** measured |
| **C** | Everything else | item detail falls back to the Tier A image, upscaled | 0 |

Tier B is not a guess — `assets/compute-tier-b.py` derives it from the anchors: the 180
anchor item ids, every item on all 52 anchor search-result pages, the home page's latest
12, the first page of every category under all three sort orders, and 24 related-listings
candidates per anchor-bearing category. The id list is checked in at
`assets/tier_b_ids.txt`.

Serving rules for the mock:
- Listing cards, gallery tiles, related listings → `/img/t/<id//1000>/<id>.webp`
- Item detail main photo → `/img/m/…` if present, else the `/img/t/…` file scaled to
  550 px wide (`.item-photos .main-photo{width:550px}`)
- Never reference `10.186.197.203:9980` or any external host. Missing file → the theme's
  own `images/no_photo.gif`, which is also extracted.

**Repo size:** Tier A is 622 MB of binary, so `.gitignore` excludes `public/img/t/` and
`public/img/m/`. The files exist in this working tree and the mock needs them to run
offline; a fresh clone must run `assets/extract-images.py` (idempotent, skips what already
exists, ~8 min, needs the container up). If it must shrink further: q60 ≈ 520 MB, or
160×133 ≈ 290 MB but visibly soft at the 240 px size the CSS renders at.
**Do not resolve this by shrinking the item count** — that is option B above, and it
breaks the anchors.
