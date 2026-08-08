# classifieds mock — Audit part: MIGRATION PARITY

> Dimension: `parity` (workflow item 1 only)
> Date: 2026-08-08
> Audited by: audit agent (shard: parity)
> Source: `http://10.186.197.203:9980/` — live, read-only. Docker WAS reachable this
> round (`classifieds`, `classifieds_db`), so every finding below is checked against
> the Osclass PHP source and the MySQL rows, not inferred from a screenshot.

## Summary

| Category | P0 | P1 | P2 |
|---|---:|---:|---:|
| Route parity | 0 | 2 | 2 |
| Seed integrity | 0 | 0 | 0 |
| Network / auth leaks | 0 | 0 | 0 |
| Visible strings | 0 | 1 | 2 |
| **Total** | **0** | **3** | **4** |

No P0. The seed is clean, the mock is fully offline, and there is no auth gate.
Three P1s are real source-behaviour divergences; the first is the one that
actually changes task difficulty.

---

## P1 — source-behaviour divergence

### PARITY-001 · `item_add_post` redirects to the new item instead of the category search page  ← **highest priority**

- **File**: `src/pages/ItemForm.jsx:198`
- **Spec**: `ROUTES.md` row 27 (which is itself wrong — see PARITY-006)
- **Observed (mock)**: `navigate(itemUrl(newId, sid), …)` → lands on
  `/index.php?page=item&id=<new id>`
- **Expected (source, verified)**: lands on `/index.php?page=search&sCategory=<catId>`

  Verification chain, all done this round:
  1. `oc_t_preference.item_post_redirect` = `''` (empty string) —
     `docker exec classifieds_db mysql … WHERE s_name LIKE '%redirect%'`.
     Corroborated inside the container by
     `/usr/src/myapp/oc-content/queries.log:383844`
     (`REPLACE INTO oc_t_preference … VALUES ('item_post_redirect', '', 'osclass', 'STRING')`)
     and by the installer default at `oc-includes/osclass/installer/basic_data.sql:100`.
     It is empty by deployment, not by accident.
  2. `oc-includes/osclass/helpers/hPreference.php:786` —
     `osc_get_redirect_after_publish()` returns exactly that preference.
  3. `oc-includes/osclass/controller/item.php:181-209` — with the value neither
     `DASH-ITEM-CAT` nor `ITEM-CAT`, control falls through both `if`s to the
     unconditional tail:
     ```php
     208:  $this->redirectTo(osc_search_category_url());
     209:  exit;
     ```
     Note this tail is reached even for a logged-in user; the "go to my listings"
     branch lives only under `DASH-ITEM-CAT`.
  4. `hDefines.php:629` → `osc_search_category_url()` =
     `osc_search_url(['sCategory' => osc_category_id()])`, and with
     `oc_t_preference.rewriteEnabled = 0` the non-rewrite branch of
     `hSearch.php:664-686` emits literally
     `<base>/index.php?page=search&sCategory=<catId>`.
  5. `oc_t_preference.moderate_items = -1` → `ItemActions::add()` returns 2 →
     the flash is `Your listing has been published` (not "Check your inbox…").

- **Why it matters**: tasks `visualwebarena-684` and `visualwebarena-685` are
  `program_html` with `"page": "last"` and
  `locator: func:get_query_text(__page__, '.price')`, requiring `270.00` / `785.00`.
  The category search page has **no `.price` element** (listing cards use
  `.currency-value`), so on the source the agent must obey the "…and navigate to
  it" half of the instruction to score. The mock currently teleports the agent
  onto the item page, so those two tasks pass without the navigation step. That
  is a strictly-easier mock, i.e. corrupted reward signal. Both task prompts say
  "Help me make a post selling this item **and navigate to it**", so parity is
  safe — the tasks remain solvable.

- **Fix** (`src/pages/ItemForm.jsx`, replace line 198):
  ```js
  navigate(indexUrl({ page: 'search', sCategory: Number(form.catId) }, sid), {
    state: { flash: { type: 'ok', msg: 'Your listing has been published' } }
  })
  ```
  and add flash rendering to `Search.jsx` (see PARITY-003 — the flash shape is
  also wrong today, and `Search.jsx` currently passes no `flash` to `Layout`).
  `getOrderedIds()` already merges `state.newItems` into the category ordering,
  so the new listing will be row 1 of that page under the default
  `dt_pub_date DESC` — same as the source.

### PARITY-002 · edited listing never gets `dt_mod_date`, so "Modified date" never appears

- **File**: `src/pages/ItemForm.jsx:128-163` (the `isEdit` branch)
- **Observed**: `changes` is built from title/cat/price/description/region/city/
  cityArea/address/phone/showPhone/contactOther/currency. `modDate` is never set.
- **Expected**: `ItemActions.php:784` writes `'dt_mod_date' => date('Y-m-d H:i:s')`
  on every edit, and the sigma theme (`oc-content/themes/sigma/item.php:61`)
  renders
  `<div><strong class="update">Modified date:</strong> 2023/11/14</div>`
  whenever it is non-empty. Confirmed against
  `assets/html/item-84144-mine.html` (has the row) vs `assets/html/item-4799.html`
  (renders a bare `<div></div>`).
- **The consuming code already exists** — `src/pages/Item.jsx:83-85` reads
  `override.modDate` — so this is a one-line producer gap, exactly as Shard B
  reported. Shard C did not implement it.
- **Fix** (`src/pages/ItemForm.jsx`, inside the `if (Object.keys(changes).length)`
  block, or unconditionally to match the source, which stamps it even on a no-op
  edit):
  ```js
  changes.modDate = nowStamp()          // "2023-11-15 09:12:04"; formatDate() -> 2023/11/15
  ```
  Move the `if (Object.keys(changes).length)` guard so `modDate` alone still
  writes an override — the source stamps `dt_mod_date` on every `item_edit_post`.

### PARITY-003 · publish/update flash messages never render (wrong Flash prop shape)

- **Files**: `src/pages/ItemForm.jsx:162` and `:198`
- **Observed**: both `navigate(..., { state: { flash: "…" } })` pass a **string**.
  `src/pages/Item.jsx:87,101` forwards it to `src/components/item/Flash.jsx`,
  whose contract is an **object** `{ type, msg }` (`Flash.jsx:21`:
  `if (!flash || !flash.msg …) return null`). Result: `Your listing has been
  published` and `Great! We've just updated your listing` are silently swallowed.
  The other four callers (`Comments.jsx:229`, `DeleteComment.jsx:51`,
  `SendFriend.jsx:76`, `MarkItem.jsx:40`) all pass the object and do render.
  (`ItemForm.jsx:543` passing a string to `MyListings` IS correct — that page uses
  the *other* Flash, `components/user/Flash.jsx`, whose prop is `message`.)
- **Expected**: both strings are verbatim source copy
  (`controller/item.php:171` and `:288`) and appear on the redirect target.
- **Fix**: change both to `{ state: { flash: { type: 'ok', msg: '…' } } }`.
  Fold into the PARITY-001 fix for line 198.

---

## P2 — cosmetic / low blast radius

### PARITY-004 · `page=user&action=dashboard` redirects; the source renders in place

- **File**: `src/App.jsx:89-92`
- **Observed**: `<RedirectWithQueryParams set={{ page:'user', action:'items' }} />`
  rewrites the URL to `…&action=items`.
- **Expected**: `controller/user.php:39-47` — `case('dashboard')` contains **no**
  `redirectTo`; it exports `items`/`max_items` and calls
  `doView('user-dashboard.php')`, and `oc-content/themes/sigma/user-dashboard.php`
  is a two-line file whose whole body is
  `osc_current_web_theme_path('user-items.php');`. So the source answers **200**
  and the URL stays `page=user&action=dashboard`. That is why
  `assets/html/user-dashboard.html` and `assets/html/user-items.html` are
  byte-identical (31463 bytes each) — same view, not a redirect.
- **Blast radius**: no anchor route targets `action=dashboard`, so no task breaks.
  But the header's "My account" link points there (`Header.jsx:36`), so every
  agent that clicks it gets a URL the source would not produce.
- **Fix**: in `App.jsx`, render the page instead of redirecting —
  ```js
  case '':
  case 'dashboard':
  case 'items':
    return <MyListings params={params} />
  ```
  (`ROUTES.md` row 18 must be corrected too — see PARITY-006.)

### PARITY-005 · `page=login` redirects to `/`; the source redirects to the dashboard

- **File**: `src/App.jsx:116-119`
- **Observed**: `case 'login': case 'register': return <RedirectWithQuery to="/" />`
- **Expected**: the two differ on the source.
  - `page=register`: `controller/register.php:38-40` —
    `if(osc_is_web_user_logged_in()) $this->redirectTo(osc_base_url());` → **`/`**.
    The mock is **correct** here.
  - `page=login`: `controller/login.php:349-354` (the `default:` branch) —
    `if(osc_logged_user_id() > 0) $this->redirectTo(osc_user_dashboard_url());`
    → **`/index.php?page=user&action=dashboard`**, not `/`.
- **Blast radius**: no anchor targets `page=login`; nothing gates on it, so this
  is not an auth-gate finding, only a redirect-target mismatch.
- **Fix**: split the case —
  ```js
  case 'login':
    return <RedirectWithQueryParams set={{ page: 'user', action: 'dashboard' }} />
  case 'register':
    return <RedirectWithQuery to="/" />
  ```
  (apply together with PARITY-004 so `action=dashboard` then renders rather than
  bouncing again).

### PARITY-006 · two `ROUTES.md` rows are factually wrong, one status flag is stale

- **File**: `ROUTES.md`
- Row 18 — "`/index.php?page=user&action=dashboard` … **302 → row 19** on the
  source" is **wrong**; the source renders 200 in place (evidence in PARITY-004).
- Row 27 — "`item_add_post` … then **redirects to its `page=item&id=<new id>`**"
  is **wrong**; the source redirects to `page=search&sCategory=<catId>`
  (evidence in PARITY-001). This row is what led Shard C astray.
- Row 35 (`item_contact_form_disabled`) is still marked `[ ]` but IS implemented:
  `src/pages/Item.jsx:249-252` emits `<div id="contact-in" class="fixed-layout">`
  + `<div class="fixed-close"><i class="fas fa-times"></i></div>` and no form,
  matching `assets/html/item-4799.html` exactly. The only difference is that the
  source emits a literal `<!-- Contact form disabled -->` HTML comment while the
  mock uses a JSX comment (which produces no DOM node) — invisible to any
  evaluator. Flip the status to `[x]`.
- **Fix**: correct rows 18 and 27, flip row 35 to `[x]`.

### PARITY-007 · React text-escaping vs the source's raw echo — 2 titles, 10 descriptions, 0 anchors

- **Files**: `src/data/catalog/cat-*.json` (data is correct), rendering in
  `src/components/ListingCard.jsx:55` and `src/pages/Item.jsx:105`
- Measured against the DB this round (`oc_t_item_description`, 84,149 rows):
  - Titles containing an HTML **entity** (`&amp;|&lt;|&gt;|&quot;|&apos;|&nbsp;|&#N;`):
    **exactly 1** — id `84153`, `Premium Stainless Steel French Door
    Refrigerator - Spacious &amp; Modern`. The source echoes raw so a browser
    shows `Spacious & Modern`; React escapes the `&` and shows `Spacious &amp;
    Modern`. This confirms Shard A/C's measurement of 1 of 84,149.
  - Titles containing a **tag-like** `<letter` sequence: **exactly 1** — id
    `49685`, `Washburn <BD25R 25watt Solid-State Mini Stack Camo`. Here the
    divergence runs the *other* way: the source's browser parses `<BD25R …>` as
    a tag and displays only `Washburn `, while the mock shows the full string.
    (The other 20 `<`/`>` titles — `WATER JET ELECTRIC FOOT MASSAGER>`,
    `2021 Jeep Gladiator Sport S- Lifted. <15,xxx miles`, `==> SodaStream …` —
    are not valid tag starts and render identically on both.)
  - Descriptions containing an entity: **0**. Descriptions containing `<letter`:
    **10** (ids 14682, 18835, 23829, 34896, 37454, 49539, 51492, 57896, 59632,
    81229).
  - **None of these 12 ids appears in `assets/anchor_item_ids.txt` or in any
    anchor string**, and none is an item-page or `.desc` anchor target.
- **Priority**: P2. The seed is right; only two rendered glyphs differ, on
  unanchored records.
- **Fix (optional, and only if a round has slack)**: render the title through
  `dangerouslySetInnerHTML` in `ListingCard`/`Item` to match the source's raw
  echo byte-for-byte. Do **not** pre-decode the entity in the seed — that would
  break the "no regenerated data" rule and diverge from `oc_t_item_description`.

### PARITY-008 · `href="javascript:;"` on `.main-photo` triggers a React console warning

- **File**: `src/pages/Item.jsx:125`
- **Observed**: React 18 logs
  *"Warning: A future version of React will block javascript: URLs as a security
  precaution"* on every item page render.
- **Expected DOM**: the source really does emit
  `<a href="javascript:;" data-fancybox-trigger="gallery" class="main-photo" title="Image 1 / 1">`
  (`assets/html/item-4799.html`), so the attribute value must stay.
- **Fix** that keeps the DOM identical and silences the warning — set it
  imperatively:
  ```jsx
  const photoAnchor = useRef(null)
  useEffect(() => { photoAnchor.current?.setAttribute('href', 'javascript:;') }, [])
  …
  <a ref={photoAnchor} data-fancybox-trigger="gallery" className="main-photo" title="Image 1 / 1">
  ```

---

## Verified clean — checks that passed

### Route parity — 36/37 `ROUTES.md` rows implemented; row 35 is implemented but mis-flagged

All rows resolve through `src/App.jsx`'s `Dispatcher`. Source path shape is
preserved verbatim: everything is `/index.php?page=…&action=…`, `/` and
`/index.php` both enter the dispatcher's default branch, and `?sid=` is purely
additive and always appended last (`src/utils/urls.js:37`).

- `sCategory[]` (emitted by the sidebar's own form) is normalised to `sCategory`
  — `urls.js:57`. Good; the source accepts both.
- `/php?page=…` → `/index.php?page=…` preserving the whole query string
  (`App.jsx:35-38`). Verified against the live source, which really does answer
  `301` with `Location: http://10.186.197.203:9980/index.php?page=search&sCategory=4&sShowAs=gallery`.
  Task `visualwebarena-829` lands here.
- `page=page` renders the 404 body. Correct: `oc_t_page` holds only e-mail
  templates on this deployment and the live source returns the 404 body for
  `page=page` too (`assets/html/page-static.html`).
- **Deep links render cold** — every page component reads its entity from URL
  params via `catalog.js`; nothing depends on click-through context.
- **`sid` survives everything** — zero `href="/…"` internal anchors, zero
  `<Navigate>` that drops the query (`App.jsx:27,37,137` all rebuild it), and all
  15 `navigate(…)` call sites go through `indexUrl(..., sid)` / `itemUrl(id, sid)`.

**Query params that actually drive behaviour** (`src/pages/Search.jsx`):
`sCategory`, `sPattern`, `sOrder`, `iOrderType`, `iPage`, `sShowAs`, `sRegion`,
`sCity` (id *or* name), `sPriceMin`, `sPriceMax`, `bPic` all read and honoured,
and every control writes them back into the URL.

- **Shard A's correction is confirmed and load-bearing.** The sort dropdown
  (`Search.jsx:484`) and the list/gallery toggle (`Search.jsx:260,265`) both build
  from `currentParams`, which is `refineParams` **plus `iPage`**
  (`Search.jsx:229`). The "Refine category" links (`Search.jsx:393,399`) use
  `refineParams`, which omits `iPage`. That is exactly the source's split, and it
  is what makes `…&sCategory=9&iPage=124&sOrder=i_price&iOrderType=asc&sShowAs=gallery`
  (task `visualwebarena-822`) reachable at all. `ROUTES.md` §"Sort dropdown"
  already carries the correction.
- `iPagesize` is documented in `ROUTES.md` but **not** implemented (`PAGE_SIZE` is
  a constant). Not filed as a finding: no anchor route uses it, and no task does.
  Same for a **slug** value of `sCategory` (`Number(slug)` → `NaN` → all
  categories) — no anchor uses it.

**Deep-page ordering spot-checked live, item-for-item** (mock `order.*` arrays vs
`curl` against the source, comparing the 12 ids and the `of N listings` count):

| anchor route | total | 12 ids |
|---|---|---|
| `sCategory=16&sOrder=i_price&iOrderType=asc&iPage=331` | 6602 = 6602 | match |
| `sCategory=9&sOrder=i_price&iOrderType=asc&iPage=124` | 1489 = 1489 | match |
| `sCategory=24&sOrder=i_price&iOrderType=desc&iPage=22` | 1058 = 1058 | match |
| `sCategory=9&sOrder=dt_pub_date&iOrderType=desc&iPage=106` | 1489 = 1489 | match |

The `sPattern` (FULLTEXT) anchor pages were **not** re-verified this round —
`CONTRACTS.md` §9 claims they were measured; leaving that to the playwright shard.

### Seed integrity — CLEAN

- All **180** ids in `assets/anchor_item_ids.txt` are unique and resolve through
  `src/data/catalog.js`: present in `catalog/item-category.json`, present in the
  matching `catalog/cat-N.json` shard with a consistent category, non-empty
  `title`, non-null `price`, non-empty seller `name`, a non-blank description in
  `descriptions/desc-<id//1000>.json`, and a thumbnail on disk at
  `public/img/t/<id//1000>/<id>.webp`. **0 problems.**
- All 180 were diffed **field-by-field against the live MySQL** (`pk_i_id`,
  `s_title`, `i_price`, `fk_i_category_id`, `s_contact_name`, `dt_pub_date`,
  `s_city`, `s_contact_email`, `b_show_email`, `b_show_phone`, `s_contact_phone`).
  0 titles, 0 prices, 0 categories, 0 dates, 0 cities differ.
- The only 16 raw diffs were 8 items whose seller name/e-mail read
  `Linda KovÃ¡cs` in the seed vs `Linda Kovács` from the mysql client. **The seed
  is right and the mysql client was wrong**: the live page serves the bytes
  `Linda Kov\xc3\x83\xc2\xa1cs` under `<meta charset=utf-8>`, i.e. the source
  itself renders the mojibake. Do not "fix" these.
- `nextItemId = 84155` matches `information_schema.TABLES.AUTO_INCREMENT = 84155`
  exactly (max `pk_i_id` is 84154; 84149 rows). Not a guess.
- `session_seed.comments` has exactly **1** row, matching
  `SELECT COUNT(*) FROM oc_t_item_comment` = 1. The ~40 comment-text anchor
  strings (`Any other pics? by Blake Sullivan`, `3 of 5`, …) are *outcomes* the
  agent produces, not seed — `Comments.jsx:72` emits
  `<h3><strong>{title}</strong> <em>by {name}:</em></h3>` and `Rating` emits
  `<span>({n} of 5)</span>`, both byte-matching
  `assets/html/item-10727-comment.html`.
- `session_seed.myItems` = `[84143 … 84154]` = Blake's 12 items (`oc_t_user.i_items`
  = 12 for `pk_i_id` 1). `SEEDED_MOD_DATE_IDS = [84143, 84144]` in `Item.jsx:34`
  matches `SELECT pk_i_id … WHERE dt_mod_date IS NOT NULL` exactly.
- No `faker`, no `Math.random()` in data construction, no `Lorem ipsum`, no
  sequential placeholder names anywhere in `src/`.
- **State size**: `createInitialData()` serialises to **828 bytes**. The
  84,149-row catalogue (30 MB) + descriptions (40 MB) are lazily-globbed static
  modules and are never copied into state, so `/go` diffs stay trivial. No
  derived/sorted arrays are persisted.

### No external network — CLEAN

- `grep -rE 'https?://'` over `src/**/*.{js,jsx,css}` + `index.html`, excluding
  `src/data/` (whose hits are all real listing-description body text copied from
  the DB): **3 hits, all `itemType="http://schema.org/…"` microdata attributes**
  in `src/components/Breadcrumb.jsx:15,17,26`. These are RDF vocabulary
  identifiers, never fetched, and the source emits the identical attributes
  (`assets/html/user-items.html`). Not a finding.
- `fetch(` — **3 call sites, all mock-API**: `dataManager.js:29` (`/state?sid=`),
  `dataManager.js:93` and `AppContext.jsx:14` (`/post?sid=`). No
  `XMLHttpRequest`, no `axios`.
- `index.html` loads only local assets: `/css/fonts.css` (self-hosted EB Garamond
  + Nunito woff2 under `public/fonts/`), `/fa/css/all.min.css` (self-hosted Font
  Awesome 5 with local `public/fa/webfonts/` — the source pulls this from cdnjs),
  `/css/style.css` + `/css/responsive.css` (copied verbatim out of the container),
  `/css/mock.css`, and local favicons.
- `grep -E "url\(['\"]?https?://"` over `public/css`, `public/fa`, `public/theme`:
  **0 hits**.
- No reference anywhere in `src/` or `index.html` to `10.186.197.203`,
  `localhost:9980`, or any absolute http(s) host.
- All 84,149 listing images are on disk (`public/img/` = 809 MB, 85,679 `.webp`).

### No auth gates — CLEAN

- Nothing in `src/` guards a route, checks a session, or can redirect to a login
  screen. `grep -niE 'login|signin|logout|password|csrf|authenticat'` over `src/`
  returns only: the `ChangePassword` page (a form that writes nothing), the
  `page=login`/`register` redirect case, the header's cosmetic "Logout" link, and
  comments.
- The app boots as Blake Sullivan from `src/data/session_seed.json` `user`
  (`pk_i_id` 1, `blake.sullivan@gmail.com`) with no gate.
- `page=main&action=logout` falls through to the home page and stays logged in
  (`App.jsx:53-56`) — correct per the migration contract.
- `page=register` → `/` matches the source exactly. `page=login` does not — see
  PARITY-005 (a wrong redirect *target*, not a gate).

### Visible strings — 14 spot-checks against `assets/html/` and live `curl`, 14 match

| String / format | Source | Mock | ✓ |
|---|---|---|---|
| result counter | `1 - 12 of 84149 listings` (`search-default.html`) | `Search.jsx:250-252` | ✓ |
| price format | `28995.00 $` / `150.00 $` / `185.00 $` | `format.js:20` `${n.toFixed(2)} $` from `locale.json` `{NUMBER} {CURRENCY}`, `num_dec=2`, `thousands_sep=''` | ✓ |
| card location double-space | `Borough of Red Lion  (Pennsylvania)` | `format.js:55` | ✓ |
| item-page location | `City of Akron, Ohio, United States` | `format.js:62-68` | ✓ |
| date | `2023/11/16` | `format.js:24-28` | ✓ |
| 404 body | `<h1>404</h1>` / `OOPS! Page Not Found!` / `Either something get wrong or the page doesn't exist anymore.` / `Take me home`, `<title>Error - Classifieds</title>` (live 410) | `NotFound.jsx` | ✓ |
| empty state | `There are no results matching "zzzqqqxx". Note that only search terms of 4 or more characters are valid.` | `Search.jsx:245-247` | ✓ |
| empty state, no pattern | live `sCategory=8&iPage=200` → `<h1>Boats </h1>` + `There are no results matching "".` (trailing space in the h1, empty quotes) | `Search.jsx:198,242,246` | ✓ |
| header nav | `Home / Publish Ad / Contact / My account / Logout / Publish Ad` with the exact hrefs | `Header.jsx:32-39` | ✓ |
| home headings | `Latest Listings`, `All categories`, `All locations`, `What are you looking for today?`, placeholder `e.g., a blue used car`, `<em>(31126)</em>` | `Home.jsx` | ✓ |
| item header | `<strong class="publish">Published date:</strong> 2023/11/14` and `<strong class="update">Modified date:</strong> …` | `Item.jsx:110-111` | ✓ (shape; producer gap = PARITY-002) |
| disabled contact panel | `<div id="contact-in" class="fixed-layout"><div class="fixed-close">…` and no form | `Item.jsx:249-252` | ✓ |
| useful info block | 4 `<li>`s verbatim | `Item.jsx:257-262` | ✓ |
| contact page | `Contact us`, `Your name (optional)`, `Your email address`, `Subject (optional)`, `Message`, `Send` | `Contact.jsx` | ✓ |

Flash strings all match `controller/item.php` / `controller/user.php` verbatim:
`Your listing has been published` (:171), `Great! We've just updated your listing`
(:288), `Your listing has been deleted` (:401), `Thanks! That's very helpful`
(:496), `Your profile has been updated successfully` (user.php:92),
`The username was updated` (user.php:189). Two of them just never reach the DOM —
PARITY-003.

### Anchor strings — sampled 20 of 140

- Comment-shaped anchors (`Any other pics? by Blake Sullivan`, `3 of 5`,
  `5 of 5`, `Can I get one?`, `Do you accept PayPal?`, …) are agent outcomes and
  the DOM that must carry them exists: `.comments_list`, `.comments_list h3`
  (`Comments.jsx:241,72`) — both are `program_html` locators for 8 tasks.
- `.desc` locator (tasks 680/751/752/753) → `Item.jsx:137`, and it honours
  `state.itemOverrides[id].description` (`Item.jsx:74`) so a post-edit check sees
  the new text. ✓
- `.price` locator (tasks 680/684/685/751) → `Item.jsx:107` and `:204`, both
  formatted `25000.00 $`. Overridden price flows through `applyOverrides`. ✓
- `404` on `/index.php?page=item&id=84144` after deletion (task 681):
  `getItem()` returns `null` for a deleted id (`catalog.js:254`) → `NotFound` →
  `<h1>404</h1>`. ✓
- Price/number anchors on items 84144/84145/84146/84148 are post-edit targets,
  not seed values — current seed prices (30000/300/250/80) match the DB, correct.

---

## Out-of-dimension observations (one line each, for the owning shard)

- `handlers`: `Search.jsx:431` uses `window.alert('You have sucessfully subscribed to the alert')` for "Subscribe to this search" — the source flashes it, and the typo `sucessfully` is the source's own.
- `handlers`: `Search.jsx` never renders a `Flash`, which the PARITY-001 fix will require.
- `pipeline`: `loadAllDescriptions()` pulls ~40 MB whenever `sPattern` is set with no `sCategory` — every keyword-search anchor route pays it; worth a perf look.
- `design`: `src/pages/Home.jsx:141` adds a mock-only `id="mock-home-search"` to the hero `<section>`; harmless but not in the source DOM.

---

## Migration Parity Status

| Check | Status | Notes |
|---|---|---|
| Route coverage (ROUTES.md) | ✅ | 37/37 rows serve; row 35 is implemented but still flagged `[ ]` |
| Path/param fidelity | ✅ | verbatim `/index.php?page=…`; `sid` additive and last |
| Query params drive behavior | ✅ | 11 params honoured + written back; `iPagesize`/category-slug unimplemented but unanchored |
| Deep links render cold | ✅ | every page reads its entity from URL params |
| `sid` survives navigation | ✅ | 0 raw `href="/"`, 3 `<Navigate>` all query-preserving, 15 `navigate()` all via `indexUrl(…, sid)` |
| Seed uses real identifiers | ✅ | 180/180 anchor ids diff clean against live MySQL on 11 fields |
| Seed size | ✅ | `createInitialData()` = 828 bytes; catalogue lazily globbed, never in state |
| Zero external network calls | ✅ | 3 `fetch()`, all `/state` + `/post`; 0 CDN/font/tile hosts |
| No auth gates | ✅ | boots as Blake Sullivan; `page=login` target wrong (P2) but not a gate |
| Visible-string fidelity | ✅ | 14 spot-checks, 0 mismatches; 2 flashes swallowed by a prop-shape bug (P1) |
| Source-behaviour parity | ⚠️ | 3 divergences: `item_add_post` redirect (P1), `dt_mod_date` (P1), flash shape (P1) |

---

AUDIT COMPLETE (parity shard): webarena_classifieds_mock

Issues found: P0=0 P1=3 P2=4 (numbered PARITY-001 … PARITY-008)
Route parity:  37/37 ROUTES.md rows serve (2 rows document the source wrongly)
Seed integrity: CLEAN — 180/180 anchor ids verified against live MySQL, 0 fabrications
Offline check:  CLEAN — 0 external calls, 0 CDN references
Auth check:     CLEAN — no gate, boots as Blake Sullivan
