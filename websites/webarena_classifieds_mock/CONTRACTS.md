# webarena_classifieds_mock — Contracts Between Dev Agents

> Written by the **foundation** dev agent (round 1, TODO P0 + the home page +
> a thin search/item slice). Later agents build the search page, the item page,
> comments and the user/CRUD views **in parallel** on top of this.
>
> Read this before you write anything. Do not edit a file listed as owned by
> another agent without a stated reason — concurrent edits are silently lost.

---

## 0. File ownership

### Owned by the foundation agent (round 1) — treat as stable API, change only with cause

| File | Why it is shared |
|---|---|
| `vite.config.js`, `package.json`, `index.html`, `.gitignore` | Build + state API contract |
| `src/main.jsx`, `src/App.jsx` | The query-string router. **Add your route branch here** (see §6) — that is the one expected edit. |
| `src/context/AppContext.jsx` | Global state + `sid` |
| `src/utils/dataManager.js` | State lifecycle |
| `src/utils/stateTracker.js` | `/go` diff |
| `src/utils/urls.js` | URL building; every link in the app goes through it |
| `src/utils/format.js` | Price / date / location / category / image-path formatting |
| `src/data/catalog.js` | The catalogue loader |
| `src/components/Layout.jsx`, `Header.jsx`, `Footer.jsx`, `Breadcrumb.jsx`, `ListingCard.jsx`, `ListingCardList.jsx`, `Pagination.jsx` | Shared components |
| `public/css/style.css`, `public/css/responsive.css` | **The source theme CSS, copied verbatim out of the container. Never edit.** Put overrides in `public/css/mock.css`. |
| `src/pages/Home.jsx`, `src/pages/NotFound.jsx`, `src/pages/GoPage.jsx` | Done; ROUTES #1, #2, #15 |

### Free for later agents

| File | Owner |
|---|---|
| `src/pages/Search.jsx`, `src/utils/search.js` | search-page agent (ROUTES #3–13) |
| `src/pages/Item.jsx` | item-page agent (ROUTES #14) |
| `src/pages/Comments*.jsx` (new) | comments agent (ROUTES #31, #32) |
| `src/pages/User*.jsx`, `src/pages/ItemForm*.jsx` (new) | CRUD agent (ROUTES #18–30, #33–36) |
| `public/css/mock.css` | anyone — append, don't rewrite |

`src/pages/Search.jsx` and `src/pages/Item.jsx` were written **minimal but
correct** so the record set, ordering, pagination arithmetic and price/date
formats are already right. Extend them; you do not need to start over.

---

## 1. Catalogue shard layout

`src/data/catalog/cat-<2..24>.json`:

```json
{
  "cat": 8,
  "fields": ["id","cat","price","pub","title","name","email","city",
             "regionIdx","cityId","phone","showEmail","showPhone","imgExt","excerpt"],
  "count": 770,
  "items": [[9877, 8, 2300000000, "2023-11-16 19:31:00", "BOAT 1967 …", "Priya Williams",
             "priya.williams188@example.com", "Rockville", 19, 7367175, "", 1, 1, 0, "1967 FIBRA 24 FOOT/…"]],
  "order": { "newest": [ids…], "priceAsc": [ids…], "priceDesc": [ids…] }
}
```

Tuple positions, exactly:

| # | Key | Notes |
|---:|---|---|
| 0 | `id` | `pk_i_id`. Never regenerate. Also the image filename. |
| 1 | `cat` | 2..24 |
| 2 | `price` | **dollars × 1,000,000** |
| 3 | `pub` | `"2023-11-01 12:31:44"` |
| 4 | `title` | ≤100 chars |
| 5 | `name` | seller name (`s_contact_name`) — **mojibake preserved**, e.g. `Jennifer KovÃ¡cs` |
| 6 | `email` | seller e-mail |
| 7 | `city` | city name string |
| 8 | `regionIdx` | index into `src/data/regions.json`, **not** the GeoNames id |
| 9 | `cityId` | for `sCity=` filtering |
| 10 | `phone` | usually `""` |
| 11 | `showEmail` | 0\|1 |
| 12 | `showPhone` | 0\|1 |
| 13 | `imgExt` | 0 = png, 1 = jpg (source-side only; the mock serves webp) |
| 14 | `excerpt` | precomputed 250-char listing blurb + `...` |

**Never re-sort at runtime.** Slice the `order` arrays. `assets/dump-orderings.py`
captured them by replaying the source's own `LIMIT 12 OFFSET n` queries, so they
reproduce MySQL's real tie order — `iPage=331` lands on the items recon measured.

### `catalog/global-order.json` is PARTIAL — do not treat it as the total

The all-categories orders are capped at `GLOBAL_PAGES = 200` (**2,400 ids per
sort**); no anchor route pages the unfiltered listing deeper. `loadAll()` appends
the remaining 81,749 ids in the deterministic order from `DESIGN.md` §Ordering,
so `order.newest.length === 84149` and the counter reads
`1 - 12 of 84149 listings`. **The first 200 pages are source-exact; beyond that
the order is ours.** If you read `loadGlobalOrder()` directly you get the raw
2,400 — use `loadAll().order` instead.

### Derived index files added by round 1

| File | Shape | Why |
|---|---|---|
| `src/data/catalog/item-category.json` | `{maxId, cat:[…]}` — flat array indexed by item id, value = category id, 0 = no such item (226 KB) | Lets the item route load exactly ONE shard instead of all 23 |
| `src/data/catalog/home-latest.json` | `{fields, count, items:[tuple…]}` — the 60 newest rows site-wide (20 KB) | Lets the home page render `Latest Listings` without pulling 29 MB |

Both are deterministically derived from the existing shards + `global-order.json`.
Neither invents data. **If `src/data/catalog/cat-*.json` or `global-order.json`
is ever rebuilt, regenerate these two as well** — they cache row contents and go
stale silently:

```python
import json
rows, pairs, fields = {}, {}, None
for c in range(2, 25):
    d = json.load(open(f'src/data/catalog/cat-{c}.json'))
    fields = d['fields']
    for r in d['items']:
        rows[r[0]] = r; pairs[r[0]] = c
maxid = max(pairs)
arr = [0] * (maxid + 1)
for i, c in pairs.items(): arr[i] = c
json.dump({"maxId": maxid, "cat": arr},
          open('src/data/catalog/item-category.json', 'w'), separators=(',', ':'))
ids = json.load(open('src/data/catalog/global-order.json'))['newest'][:60]
json.dump({"fields": fields, "count": len(ids), "items": [rows[i] for i in ids]},
          open('src/data/catalog/home-latest.json', 'w'),
          ensure_ascii=False, separators=(',', ':'))
```

---

## 2. `src/data/catalog.js` — every export

All loaders memoise in module-level `Map`s / promises for the life of the page.

| Export | Signature | Semantics |
|---|---|---|
| `CATALOG_FIELDS` | `string[]` | The tuple field order above |
| `PAGE_SIZE` | `12` | `defaultResultsPerPage@search`, list **and** gallery |
| `TOTAL_ITEMS` | `84149` | |
| `CATEGORY_COUNTS` | `{ "8": {count, bytes}, … }` | From `manifest.json` |
| `SORT_KEYS` | `['newest','priceAsc','priceDesc']` | |
| `toItem(row)` | `tuple → object` | Named-field object; the shape every component consumes |
| `loadCategory(catId)` | `→ Promise<{cat,count,items,byId,order}>` | One shard. `items` in `newest` order, `byId` is `Map<number,Item>` |
| `loadDescription(itemId)` | `→ Promise<string\|null>` | Loads `desc-{floor(id/1000)}.json`, returns that item's full text |
| `loadAll()` | `→ Promise<{count,items,byId,order}>` | All 23 shards in parallel + `global-order.json`. ~11.7 MB gz, cached. **9 anchor routes need this.** |
| `loadAllDescriptions()` | `→ Promise<Map<number,string>>` | All 85 description shards (~41 MB). Only the exact-fidelity global keyword search should want it |
| `loadGlobalOrder()` | `→ Promise<{newest,priceAsc,priceDesc}>` | The 3 site-wide id orders |
| `loadHomeLatest()` | `→ Promise<Item[]>` | The 60 newest items, cheap |
| `loadItemCategoryIndex()` | `→ Promise<{maxId,cat}>` | Raw index |
| `categoryOf(itemId)` | `→ Promise<number>` | Category id, or 0 if no such item |
| `isDeleted(id, state)` | `→ boolean` | |
| `findNewItem(id, state)` | `→ Item\|null` | |
| `applyOverrides(item, state)` | `→ Item` | Merges `state.itemOverrides[id]` |
| `getItem(id, state)` | `→ Promise<Item\|null>` | **The precedence function.** `deletedItemIds → newItems → catalog → itemOverrides`. `null` means "render the 404 body" |
| `getItemFrom(id, state, byId)` | `→ Item\|null` | Sync variant when the shard is already loaded |
| `getOrderedIds({catId, sort, state})` | `→ Promise<{ids, byId}>` | Ordered id list for a scope with session state folded in: deleted removed, `newItems` merged into position. `catId` null = site-wide (calls `loadAll()`) |
| `pageOf(ids, byId, page, state, pageSize?)` | `→ Item[]` | Slice one 1-based page; offset = `max(page-1,0)*pageSize` |

---

## 3. Session state and its helpers

State shape and the Observable State Changes table live in **`SCHEMA.md`** —
that is the canonical copy; do not duplicate it in code comments.

### `src/utils/dataManager.js`

| Export | Notes |
|---|---|
| `getSessionId()` | Reads `?sid=`, falls back to `sessionStorage` |
| `storageKey(sid)` / `initialKey(sid)` | `classifieds_mock_state[_sid]` / `classifieds_mock_initial_state[_sid]` |
| `fetchCustomState(sid)` | `GET /state?sid=` → injected state or `null` |
| `createInitialData()` | Returns the ≈2 KB shape from `src/data/session_seed.json`. **Never put catalogue rows in here.** |
| `initializeData(sid, customState)` | Writes both localStorage keys and returns the state |
| `saveState(state, sid)` | localStorage **and** `POST /post?sid=` `{action:'set_current', state}` |

### `src/utils/stateTracker.js`

| Export | Notes |
|---|---|
| `computeStateDiff(initial, current)` | Deep, path-keyed diff (`"user.email": {old,new}`) used by the `/go` page |
| `OBSERVABLE_ACTIONS` | `{ actionName: [stateKeys…] }` — the SCHEMA.md table as data. **Add your action here when you implement it.** |

### `src/context/AppContext.jsx`

`useApp()` → `{ state, setState, resetState, sid, user }`.

- `setState(updater)` takes a value or a function, and **always** persists via
  `saveState`. Every mutation must go through it or `/go` will not see it.
- `sid` is the current session id or `null`.
- The provider renders `null` until state is loaded, so pages can assume
  `state` is non-null.

---

## 4. Shared components

| Component | Props | Notes |
|---|---|---|
| `Layout` | `{bodyClass, title, breadcrumb, hero, children}` | Sets `document.body.className = "has-searchbox " + bodyClass` and `document.title`. Renders `<Header/>`, optional `hero` (home only), `<section>` with `.wrapper#content`, `<Footer/>`. **`bodyClass` is load-bearing** — column widths come from it: `home` / `search` / `item` / `item item-post` / `user user-items` / `error not-found`. |
| `Header` | — | Logo + nav (`My account`, `Logout`, `Publish Ad`). Always the logged-in variant. |
| `Footer` | — | `Contact` + the "Powered by …" line (wordmark altered per TRADEMARKS.md). |
| `Breadcrumb` | `{crumbs: [{label, to?}]}` | Prepends the `Classifieds` crumb itself. Emits schema.org microdata and literal ` > ` text nodes; a crumb with no `to` renders a bare `<span>`. |
| `ListingCard` | `{item, index, terms?, adminOptions?}` | One `<li class="listing-card">`, exact source markup. `index % 3 === 0` gets the `first` class. `adminOptions` is injected inside `.listing-data` — that is the slot for `<span class="admin-options">` on "My listings". `terms` wraps matches in `<strong>` inside `.desc`. |
| `ListingCardList` | `{items, showAs, extraClass, terms?, adminOptionsFor?}` | `<ul class="listing-card-list listing-list\|listing-grid …" id="listing-card-list">`. `showAs: 'list' \| 'gallery'`. |
| `Pagination` | `{page, lastPage, params}` | Source classes and symbols. Page-1 links **omit `iPage` entirely**. Window is `page-2 … page+2`, clamped. |

---

## 5. Formatting helpers — `src/utils/format.js`

These come from the source's `oc_t_locale` row, not from intuition. Use them;
do not re-derive.

| Helper | Input → Output |
|---|---|
| `formatPrice(raw)` | `2899500000000` → `"28995.00 $"` — **trailing symbol, space, always 2 decimals, NO thousands separator** |
| `formatDate(pub)` | `"2023-11-10 08:00:00"` → `"2023/11/10"` |
| `formatCardLocation(item)` | → `"Brimfield  (Ohio)"` — **double space** before the parenthesis, deliberately |
| `formatItemLocation(item)` | → `"City of Akron, Ohio, United States"` |
| `regionOf(item)` / `regionNameOf(item)` | Resolves `regionIdx` (or an explicit `regionId` on a created item) against `regions.json` |
| `categoryName(catId)` | → `"Arts + crafts"`, `"Rvs + campers"` — exact DB casing |
| `categoryBySlug(slug)` | → category object or null |
| `thumbUrl(id)` | `/img/t/{id//1000}/{id}.webp` — 240×200, all 84,149 items |
| `photoUrl(id)` | `/img/m/{id//1000}/{id}.webp` — 640×480, ~1,530 items; **fall back to `thumbUrl`, then `NO_PHOTO`** |
| `NO_PHOTO` | `/img/no_photo.gif` |
| `CURRENCY_SYMBOL` | `"$"` |
| `categories`, `regions` | The re-exported seed arrays |

---

## 6. URL building — `src/utils/urls.js`

**Never hand-build a URL.** `sid` must survive every link, redirect and form submit.

| Helper | Notes |
|---|---|
| `indexUrl(params, sid)` | `/index.php?page=…` with params in the source's own order and `sid` appended **last** |
| `homeUrl(sid)` | `/` or `/?sid=…` |
| `itemUrl(id, sid)` | `/index.php?page=item&id=N[&sid=…]` |
| `searchUrl(params, sid)` | `/index.php?page=search&…[&sid=…]` |
| `withSid(path, sid)` | Append `sid` to an already-built path |
| `sourceParams(searchParams)` | `URLSearchParams` → plain object, **dropping `sid`** and folding `sCategory[]` into `sCategory` |

Programmatic navigation: `navigate(indexUrl({…}, sid))`. In JSX use
`<Link to={indexUrl({…}, sid)}>`, never a bare `<a href>` to an in-app route.

### Adding your routes

`src/App.jsx` has one `Dispatcher` switch on `page` then `action`. Unimplemented
`page`/`action` pairs currently fall through to `NotImplemented`, which renders
the 404 body. Replace **only your branch**:

```jsx
case 'item':
  switch (action) {
    case '':          return <Item params={params} />
    case 'item_add':  return <ItemForm params={params} mode="add" />   // ← your line
    ...
  }
```

`/` and `/index.php` both enter the same `Dispatcher`, so a route added once
works from both. `/php?…` already 301-equivalents to `/index.php?…` with the
whole query string intact (ROUTES #17).

---

## 7. Search semantics — `src/utils/search.js`

Measured against the live site, not guessed:

- match against **title + description**
- **OR across words**, not AND (`banana boat` = 658 = 30 + 628)
- **minimum word length 4** — `dog` → 0, `dogs` → 128
- **no stemming** — `boat` ≠ `boats`, `kayak` ≠ `kayaks`
- stopwords return nothing (list in `src/data/locale.json:stop_words`)
- results ordered by `sOrder`, never by relevance

`parseTerms(pattern)` and `matchesTerms(terms, …haystacks)` implement this.

Sort-param handling (exported from `src/pages/Search.jsx`, move it if you prefer):
`effectiveOrder(params)` (only `i_price` / `dt_pub_date` / `dt_expiration` are
sortable, anything else falls back to `dt_pub_date`), `effectiveDirection(params)`
(`iOrderType` is compared as a **string** — `0`/`1` fall back to `desc`),
`sortKeyOf(params)` → one of `SORT_KEYS`.

---

## 8. Known gaps handed to later agents

1. ~~**Keyword search scans title + the 250-char `excerpt`, not the full
   description.**~~ **CLOSED — dev shard A, round 2.** See §9 below for the
   decision, the measurement behind it and the cost.
2. **The comment form is not built.** `src/pages/Item.jsx` renders
   `.comments_list` read-only, with the exact `<h3><strong>{title}</strong>
   <em>by {author}:</em></h3>` and `<span>({N} of 5)</span>` markup the 31
   `program_html` evaluators query. The posting form, reply threading, delete and
   the 10-per-page paginator are the comments agent's.
3. **Item `action=*` routes** (`item_add`, `item_edit`, `item_delete`,
   `add_comment`, `delete_comment`, `send_friend`, `mark`) and all
   `page=user&action=*` except `dashboard` currently render the 404 body.
4. **Related listings are chosen deterministically** from the same category
   (source uses SQL `RAND()`, so nothing is anchored) — leave or change freely.
5. **`bPic` / `bPremium` / `meta[…]` are inert** on this deployment. Accept and
   ignore them; do not 404.
6. **`iPagesize`** (lowercase `s`, 1–50, capped at 50) is not implemented.

---

## 9. Keyword search — the decision (dev shard A, round 2)

**Decision: match title + the FULL description via `loadAllDescriptions()`.**
It reproduces the source exactly, and it turned out to be cheap.

### Why the excerpt path could not stay

The 250-char excerpt under-counts badly — it is not a rounding error, it is a
different result set:

| pattern | source | title+excerpt | title+full description |
|---|---:|---:|---:|
| `banana` | 30 | 23 | **30** |
| `boat` | 628 | 459 | **628** |
| `boats` | 93 | 38 | **93** |
| `dogs` | 128 | 86 | **128** |
| `kayak` | 79 | 73 | **79** |
| `kayaks` | 31 | 22 | **31** |
| `painting` | 529 | 474 | **529** |
| `paintings` | 110 | 77 | **110** |

### The matching model (this is the part that was previously guessed)

`oc_t_item_description` is **MyISAM**, not InnoDB (`SHOW TABLE STATUS` →
`Engine: MyISAM`, `@@ft_stopword_file = (built-in)`, `@@ft_min_word_len = 4`).
Three consequences that `src/utils/search.js` now implements:

1. **Whole-word, not substring.** `hay.includes(term)` is wrong: substring
   matching gives `boat` 721 instead of 628 because it also hits `boats`,
   `boating`, `boathouse`. `\b(term)\b` — whose word-character class is exactly
   the tokenizer's — gives 628.
2. **MyISAM's built-in stopword list, not `oc_t_locale.stop_words`.** The locale
   column holds 31 words; MyISAM's built-in list holds ~543, and it is the one in
   force. `used` (15,201 documents contain it) returns **0** on the source, as do
   `available`, `please`, `value`, `first`, `name`, `example` and ~370 others.
   Using only the locale list would have made `used car`, `available now` and
   friends return results the source does not.
3. Minimum word length 4 and no stemming, as already documented.

The 377-word list embedded in `search.js` was derived twice and intersected: the
zero-count words among the corpus's 2,398 most frequent >=4-char words, plus the
`ft_static.c` string table read out of the container's `/usr/sbin/mysqld`. All
377 were then re-verified to return 0 against the live site.

**Model accuracy:** of the 2,169 non-stopword frequent terms counted against live
MySQL, 2,157 match exactly and the other 12 differ by 1–2 — fully explained by the
3 orphan `oc_t_item_description` rows with no `oc_t_item` (84,152 vs 84,149).

### The cost, measured

Loading all 85 description shards is ~41 MB of JSON, and it is only triggered when
`sPattern` yields at least one usable term. End-to-end in headless chromium on the
dev server: **1.4 s** from `goto` to a rendered `1 - 12 of 658 listings` for
`sPattern=banana+boat` (the worst case — it also pulls all 23 catalogue shards).
Cached for the life of the page after that. That is well inside what a task step
tolerates, so there is no reason to trade fidelity for it.

### Two behaviours downstream agents should know about

- **`sPattern` is trimmed for display, raw in links.** `sPattern=+Xbox+One+games`
  renders `Xbox One games` in `<title>`, the breadcrumb and the sidebar input, but
  every link the page builds carries `+Xbox+One+games` through unchanged.
- **A pattern with no usable term is not the same as no pattern.** `red car`
  (both words < 4) and `used` (stopword) return **zero** results and the `.empty`
  state, not the unfiltered listing.

### Result ordering, which is two code paths on purpose

`src/pages/Search.jsx` slices the precomputed `order.<sort>` arrays **only** when
no filter is active. As soon as `sRegion` / `sCity` / price / `sPattern` is in
play the source is running a different SQL statement with a different tie order,
and the captured array reproduces neither the count nor the page. The filtered
path sorts by `(sort column, pk_i_id ASC)` instead — verified item-for-item
against both region anchors and the `banana boat` anchor. Do not "simplify" these
two paths into one.
