# webarena_classifieds_mock — TODO

> Status: **BUILT AND PASSING** — P0 **11/11**, P1 **21/21**, P2 **8/16** (`npm run build`
> exits 0; AUDIT.md 0 P0 / 0 P1 open; TEST shards 0 P0 / 0 P1). Boxes were last
> reconciled against the code and the test reports by the **P2-CLEANUP** pass; the
> eight unchecked P2s are listed together under *Genuinely outstanding P2s* with the
> reason each is being left.
> Source: `http://10.186.197.203:9980/` · image `jykoh/classifieds:latest` · containers `classifieds` + `classifieds_db`
> Recon: `SOURCE.md` | Routes: `ROUTES.md` | Design: `DESIGN.md` | Views: `assets/README.md` | Data: `assets/data_model.md`
> Recon mode: **FULL** (docker exec + HTTP both available)
> Task contract: `assets/task_anchors.md` — 234 tasks, 227 anchor routes, 140 anchor strings, 4 anchor locators

## Status Legend
- `[ ]` Not started · `[~]` In progress · `[x]` Done

## What already exists in this directory

Recon has produced the seed and the images; do not regenerate unless something changed.

| Path | Contents |
|---|---|
| `src/data/catalog/cat-<2..24>.json` + `manifest.json` | **all 84,149 items**, 30.6 MB, per-category, pre-sorted 3 ways |
| `src/data/descriptions/desc-<0..84>.json` | full descriptions, 41.0 MB, 85 shards, max 0.57 MB each |
| `src/data/{categories,regions,cities,countries,currencies,locale,pages}.json` | reference tables, 3.05 MB |
| `src/data/session_seed.json` | the ~2 KB mutable seed for `createInitialData()` |
| `public/img/t/<id//1000>/<id>.webp` | **84,149** listing thumbnails, 240×200, **622 MB** (gitignored) |
| `public/img/m/<id//1000>/<id>.webp` | 1,530 item-detail photos, 640×480, 47 MB (gitignored) |
| `public/img/{no_photo.gif,default-user-image.png,sigma_logo.png,user_default.gif}`, `public/favicon/` | theme assets |
| `assets/html/*.html` (28) | raw source HTML per route |
| `assets/screenshots/reference/*.{1280,1920}.png` (46) | live captures, 23 views × 2 viewports |
| `assets/dumps/` | raw DB dumps + `orderings.json` (gitignored working area, 96 MB) |
| `assets/{build-seed,extract-images,compute-tier-b,dump-orderings}.py` | regenerators |
| `assets/source-style.css`, `assets/source-responsive.css` | the real theme CSS, for reference |

**Priority is derived from the 234 task questions**, not from how the UI looks:

| Capability | Tasks needing it |
|---|---:|
| Browse a category sorted by price | 88 |
| Browse a category sorted by date | 50 |
| Paginate / reason about "this page" / "second row" | 47 |
| Read a spec out of the item description | 26 |
| Post a comment | 14 |
| Keyword search | 13 |
| Region filter | 8 |
| Edit / delete own listing | 7 |
| Read the seller's e-mail | 5 |
| Create a listing | 2 |

---

## P0 — Shell, Routing, Data Pipeline

- [x] Scaffold from `websites/mixpanel_mock`: `package.json`, `vite.config.js` with
      `secureMockApiPlugin()` **first** in `plugins[]`, then `mock-api` registered under
      **both** `configureServer` and `configurePreviewServer`. Endpoints `/post`, `/state`,
      `/go`, `/upload`, `/files`; state at `.mock-states/<sid>.json` + `<sid>.initial.json`;
      sid sanitized with `sid.replace(/[^a-zA-Z0-9_-]/g, '')`.
- [x] `src/utils/dataManager.js`: `getSessionId`, `storageKey`, `initialKey`,
      `fetchCustomState`, `createInitialData`, `initializeData(sid, customState)`,
      `saveState(state, sid)` → POSTs `{action:'set_current', state}`.
- [x] `createInitialData()` returns **exactly** the shape in `assets/data_model.md` §9,
      loaded from `src/data/session_seed.json`. It must be ≈2 KB.
      **The catalogue must never be copied into state** — `/go` diffs the whole object.
- [x] `src/context/AppContext.jsx`: check `localStorage.getItem(initialKey(sid))` **before**
      calling `initializeData()`.
- [x] `src/App.jsx`: `/go` route, `RedirectWithQuery` instead of `<Navigate>` everywhere so
      `?sid=` survives. `src/utils/stateTracker.js` for the observable-state log.
- [x] **Catalogue loader** (`src/data/catalog.js`) — the load-bearing piece:
      - `loadCategory(catId)` → `import('./catalog/cat-N.json')`, memoized in a module Map
      - `loadDescription(itemId)` → `import('./descriptions/desc-{id//1000}.json')`, memoized
      - `loadAll()` → all 23 shards in parallel, for global (no-`sCategory`) search;
        ~11.7 MB gzipped, cached for the rest of the session. **9 anchor routes need this —
        do not skip it.**
      - `getItem(id, state)` applying `deletedItemIds` → `newItems` → `catalog` → `itemOverrides`
        (see `assets/data_model.md` §0 for the exact precedence)
- [x] Query-string router matching `ROUTES.md` rows 1–36: `index.php?page=…&action=…`.
      A React SPA must serve **`/index.php`** as a real route, and `/` must render the home
      page. `?sid=` is additive and never replaces a source param.
- [x] Route row 17: `/php?page=…` → **301-equivalent redirect** to `/index.php?page=…`
      preserving the entire query string. Task `visualwebarena-829` lands here.
- [x] App shell per `DESIGN.md` §4: `.wrapper` 980 px; header white `padding:10px 15px`
      (no bottom border on home); footer `#cde8e9` `padding:35px 0 25px 0`;
      **body class per page** (`home`/`search`/`item`/`item item-post`/`user`/`user-items`)
      because the column widths depend on it.
- [x] Self-host `EB Garamond 400` and `Nunito 400/700`, and Font Awesome 5 icons (or inline
      SVG equivalents). **Zero runtime network calls** — the source pulls both from CDNs and
      the mock must not.
- [x] `SCHEMA.md` with the state table and the Observable State Changes table.

---

## P1 — Core Site Features

### Search & browse — the surface 185 of 234 tasks live on

- [x] **[ROUTES #3–8] Search results page.** `#sidebar` 210 px left, `#main` 728 px right.
      Header block: `<h1>` = category name (or `Search results`),
      `<span class="counter-search">{from} - {to} of {total} listings</span>` using the exact
      `%d - %d of %d listings` format. Then `<h2>Listings</h2>` and
      `<ul class="listing-card-list [listing-grid] items" id="listing-card-list">`.
      Never render the "Premium listings" block — no item is premium.
- [x] **[ROUTES #8] Pagination, 12 per page, `iPage` 1-based.** Offset =
      `max(iPage-1,0)*12`; `iPage=0` and `iPage=1` are both page 1; a non-numeric value
      such as `4y` renders **page 1** while `<title>` still echoes `page 4y`
      (task `visualwebarena-840`).
      **Slice the shard's precomputed `order.<sort>` array — never sort at runtime.**
      Those arrays were captured page-by-page from the source and validated **34/34**
      against live pages; a client-side "price then id" sort scored 13/21, and roughly a
      dozen tasks say "the item **on this page**" at depths up to `iPage=331`.
      `order` intentionally repeats some ids and omits others — the source's unstable
      sort does that under OFFSET paging. **Do not deduplicate it.** See `DESIGN.md` §8.
      Markup and classes: `ROUTES.md` §Pagination control markup; page-1 links omit
      `iPage` entirely.
- [x] **[ROUTES #7] Sort dropdown.** CSS hover menu (`.see_by`), three options with these
      exact labels and targets: `Newly listed` → `sOrder=dt_pub_date&iOrderType=desc`,
      `Lower price first` → `sOrder=i_price&iOrderType=asc`, `Higher price first` →
      `sOrder=i_price&iOrderType=desc`. Current option gets `class="current"` and fills the
      `<label>`. Rebuilding the URL preserves `sCategory`/`sPattern`/`sShowAs` and drops
      `iPage`. `iOrderType` is matched as a **string** — `0`/`1` must fall back to `desc`.
- [x] **[ROUTES #6] List ⇄ gallery toggle.** `.doublebutton`, two 40×40 buttons
      (`fas fa-bars`, `fas fa-border-all`), active one `.active` with `#056786` fill.
      **Page size stays 12 in both.** Gallery cards are 3-up on the search page
      (`calc(33.33% - 20px)`); list rows use a 95 px thumb with `margin-left:105px`.
      `.desc` stays in the DOM in gallery but is hidden by CSS.
- [x] **[ROUTES #4] Listing card.** Exact markup in `assets/README.md` §2. Price
      `28995.00 $` (trailing symbol, 2 decimals, **no thousands separator**);
      location `Brimfield  (Ohio)` with a **double space**; date `2023/11/10`;
      the ` / ` separators are CSS `::after`, not markup. Thumb
      `/img/t/{id//1000}/{id}.webp` at `width="240" height="200"`.
- [x] **[ROUTES #5] Keyword search with the source's FULLTEXT semantics.** This is subtle
      and measured, not guessed (`SOURCE.md` §Search semantics):
      - match against **title + description**
      - **OR across words**, not AND (`banana boat` = 658 = `banana` 30 + `boat` 628)
      - **minimum word length 4** — `dog` returns nothing, `dogs` returns 128
      - **no stemming** — `boat` ≠ `boats`, `kayak` ≠ `kayaks`
      - drop stopwords — CORRECTION from the implementation: the table is
        **MyISAM** with `ft_stopword_file=(built-in)`, so the list in force is
        MySQL's ~543-word built-in one, **not** the 31 words in
        `src/data/locale.json:stop_words`. `used` matches 15,201 documents and
        still returns 0 on the source. The verified >=4-char subset is embedded in
        `src/utils/search.js`; see `CONTRACTS.md` §9.
      - results are ordered by `sOrder`, not relevance
      - wrap matched terms in `<strong>` inside the card excerpt
- [x] **[ROUTES #13] Empty search state.** `.list-header` contains only
      `<p class="empty" >There are no results matching "{pattern}". Note that only search
      terms of 4 or more characters are valid.</p>` — no counter, no sort, no pagination.
      Sidebar still renders and its "Refine category" links carry the failed `sPattern`.
      (The copy says 4 even though `innodb_ft_min_token_size` is 3; reproduce the copy.)
- [x] **[ROUTES #9–12] Search sidebar.** `.filters` panel `#f6f6f4`: `Your search`
      (`sPattern`), `City` (`sCity` + hidden `sRegion`), `Show only` →
      `listings with pictures` (`bPic`), `Price` `Min.`/`Max.` (`sPriceMin`/`sPriceMax`,
      `maxlength="6"`), `Apply` button. Then `Subscribe to this search` →
      `Subscribe now!` (pushes onto `state.alerts`). Then `Refine category`:
      `All categories` first, active category in `<strong>`, each link preserving
      `sPattern` + `sShowAs`.
- [x] **[ROUTES #9] Region filter.** `sRegion=<geonames id>` — real ids, e.g.
      Maryland `7361885`, Virginia `9254928`. Two anchor routes combine it with a category
      and deep pagination.

### Item detail — where 180 anchor URLs land

- [x] **[ROUTES #14] Item page.** `#main` 640 px left, `#sidebar` 300 px right.
      Breadcrumb `Classifieds > {Category} > {Title}`; `<h1>` in EB Garamond 46/50;
      `.item-header` with `Published date: 2023/11/01` and
      `Location: City of Akron, Ohio, United States`; `.item-photos` with a 550 px
      `.main-photo` (`/img/m/…`, falling back to `/img/t/…` upscaled) and a 79 px
      `.thumbs` strip at `width="75"`; **`<div class="desc">` with the full description**;
      `.contact_button` with `Contact seller` and `Share`;
      `.similar_ads` → `<h2>Related listings</h2>` + **3** same-category cards in a 3-up grid.
      `.desc` and `.price` are anchor locators — they must exist and carry the real text.
- [x] **[ROUTES #14] Item sidebar.** `<div class="price">185.00 $</div>` at **40 px bold,
      right-aligned, `#000`** (the `.price` locator); the `Mark as...` select with all five
      options; `#contact` → `<h2>Contact publisher</h2>`, avatar,
      `<p class="name bld"><span>Name:</span> …</p>` and
      `<p class="email bld"><span>E-mail:</span> <a href="mailto:…">…</a></p>`
      (**5 tasks read the e-mail from here**); `#useful_info` with its four fixed bullets,
      copied verbatim from `assets/README.md` §3.1.
      `Contact seller` opens `#contact-in`, which is **empty** —
      `item_contact_form_disabled = 1` on this deployment. Do not build a working form.
- [x] **[ROUTES #15] Missing / deleted item.** Render the theme 404 body verbatim:
      `<h1>404</h1>`, `<h2>OOPS! Page Not Found!</h2>`,
      `<h3>Either something get wrong or the page doesn't exist anymore.</h3>`,
      `Take me home` button. No sidebar. Task `visualwebarena-681` asserts the string `404`
      after deleting item 84144.

### Comments — 31 `program_html` tasks depend on this

- [x] **[ROUTES #31] Post a comment.** Form fields: `Rating` (five clickable stars writing
      a hidden `rating`), `Title`, `Comment` body, hidden `replyId`/`authorName`/`authorEmail`.
      Header copy: `Leave your comment (spam and offensive messages will be removed)`.
      Appends to `state.comments` and appears **immediately** — no moderation.
- [x] **[ROUTES #14] Render `.comments_list` exactly.** Full markup in `assets/README.md`
      §3.2. Two things are load-bearing:
      - `<h3><strong>{title}</strong> <em>by {author}:</em></h3>` so that
        `.comments_list h3` reads **`{title} by {author}:`** — 4 evaluators query this
      - the rating renders `<span>({N} of 5)</span>` with N filled stars in `#ffb900`
      Also: `Delete` link only on the user's own comments, `Reply` link with
      `data-text="You are replying to: {title} - {body}"`, 10 comments per page.
      Seed already contains the one real comment (id 1, item **10727**, `Hello!` /
      `Nice bracelet`, rating 3).
- [x] **[ROUTES #32] Delete own comment.**

### Owning listings

- [x] **[ROUTES #19] "My listings"** — `<h1>My listings</h1>`, title
      `Manage my listings - Classifieds`, Blake's 12 items (84143–84154) newest first as
      list rows, each with `<span class="admin-options">` containing `Edit item` and
      `Delete`. Delete confirm text exactly:
      `This action can not be undone. Are you sure you want to continue?`
- [x] **[ROUTES #18] `action=dashboard` renders My listings IN PLACE** — CORRECTED
      (AUDIT PARITY-004). The source does **not** redirect: `controller/user.php:39-47`
      `case('dashboard')` has no `redirectTo` and sigma's `user-dashboard.php` is a
      two-line include of `user-items.php`, which is why the two captured HTML files
      are byte-identical. `App.jsx` falls `dashboard` through to `MyListings`, so the
      URL keeps `action=dashboard`. `My account` in the header points at `dashboard`.
- [x] **[ROUTES #28–29] Edit listing.** Same form as Publish, pre-filled, `action=item_edit_post`,
      hidden `id`. Writes into `state.itemOverrides[id]`; redirects to the item page.
      Task `visualwebarena-680` edits item **84144**'s price from `30000.00` to `25000.00`
      *and* the price mentioned in its description, then asserts `.price` and `.desc`.
- [x] **[ROUTES #30] Delete listing.** Pushes to `state.deletedItemIds`; the item URL then
      renders the 404 body, and the item disappears from listings and counters.
- [x] **[ROUTES #26–27] Publish a listing.** Field-for-field per `assets/README.md` §5
      (`catId`, `title[en_US]`, `description[en_US]`, `price` + `currency`, `regionId`,
      `cityId`, `cityArea`, `address`, `contactPhone`, `showPhone`, `contactOther`).
      On submit assign `state.nextItemId` — **starting at 84155** — and increment it.
      Redirect target CORRECTED (AUDIT PARITY-001): the source goes to
      `index.php?page=search&sCategory=<catId>`, **not** to the new item —
      `oc_t_preference.item_post_redirect` is `''`, so `controller/item.php:181-209`
      falls through to `redirectTo(osc_search_category_url())`. Tasks 684/685 must
      click through to the listing themselves ("…and navigate to it"); the category
      page has no `.price`. Both the id sequence and the price rendering matter.

### Home

- [x] **[ROUTES #1] Home page.** `#F1FAEE` wash across header + hero;
      `<h1>What are you looking for today?</h1>`; keyword input with placeholder
      `e.g., a blue used car`; category select starting `Select a category`;
      `Latest listings` = the **12** newest items site-wide; `#home-cats` →
      `<h2>All categories</h2>` with the 23 icon tiles (icon names in
      `assets/README.md` §1); `#home-regs` → `<h2>All locations</h2>` with the 7 regions and
      their exact counts (Virginia 31126, Pennsylvania 22180, Maryland 21674, Ohio 5626,
      Washington, D.C. 1567, West Virginia 1110, Delaware 870).

---

## P2 — Depth & Realism

- [x] **[ROUTES #20–21] Profile page** + save with the flash
      `Your profile has been updated successfully`.
- [x] **[ROUTES #22] Alerts** — `<h1>Alerts</h1>` and, when empty,
      `<p class="empty">You do not have any alerts yet.</p>`. The sidebar's
      `Subscribe now!` is wired and the page was rebuilt to the source's real
      markup (`user-alerts.php`: `.userItem` → `.title-has-actions` → `<h3>Alert N</h3>`
      + `Delete this alert`, then the alert's *own search re-run* limited to 12,
      as `controller/user.php:110-126` does).
      *Verified end to end by P2-CLEANUP at 1280x720 and 1920x1080: `Subscribe now!`
      hit-tests to itself, fires the source's typo'd `You have sucessfully subscribed
      to the alert` alert, keeps its label (HANDLERS-007), writes one
      `{id,userId,email,search,active}` row that reaches `.mock-states/<sid>.json`
      and shows up in `/go` as `state_diff.alerts`; the page then lists `Alert 1`
      with 12 result cards; `Delete this alert` (confirm accepted) empties both the
      page — back to `You do not have any alerts yet.` — and `state.alerts`.*
- [x] **[ROUTES #23–25] Change e-mail / username / password** forms.
      NOTE: `user-change_username.php` hard-codes `value=""` on the `s_username`
      input, so the field renders EMPTY on the source even though the stored
      username really is `1`. Verified in the template and in
      `assets/html/user-change-username.html`; the mock reproduces the empty field.
- [x] **[ROUTES #33–34] Share / send-to-friend** form and confirmation.
- [x] **[ROUTES #36] `Mark as...`** select on the item sidebar → `state.marks`.
- [x] **[ROUTES #16] `page=contact`** site contact form (this one is *enabled*,
      unlike the per-item one).
- [x] User sidebar shared across `page=user` views. The source's own labels are
      `Public Profile`, `Listings`, `Alerts`, `Account`, `Change email`,
      `Change username`, `Change password`, `Delete account` (`li.opt_*`
      classes, `ul.user_menu`) — reproduced verbatim from `user-sidebar.php`.
      `Delete account` opens `#dialog-delete-account`
      (`Are you sure you want to delete your account?`).
- [x] ~~`iPagesize` param (1–50, capped at 50)~~ — **WON'T-FIX, not a divergence.**
      MEASURED on the **live source** by the ROUTES test shard and re-confirmed by
      FIX-SEARCH: `…&page=search&sCategory=9&iPagesize=50` renders
      `1 - 12 of 1489 listings` on the source too — this deployment ignores
      `iPagesize` exactly as the mock does (accepted, round-tripped, no effect).
      Implementing it would make the mock *diverge*. See AUDIT HANDLERS-012 (CLOSED)
      and `TEST.part-routes.md` §2.4. The `ROUTES.md` "Query Parameters" row is the
      upstream Osclass documentation, not this deployment's behaviour.

### Genuinely outstanding P2s — knowingly left open

No anchor route, anchor string, anchor locator or `TODO.md` P0/P1 depends on any of
these; each is left unchecked with its reason.

- [ ] Fancybox-style lightbox on the item main photo. *The `href="javascript:;"` anchor
      is real source DOM and is reproduced (AUDIT PARITY-008), but inert — it is a
      no-op on the source too without Fancybox. No task opens a lightbox.*
- [ ] City autocomplete in the search sidebar, served from `src/data/cities.json`
      (client-side only — the source uses `page=ajax&action=location`). *The `City`
      text input works as a filter (`sCity` accepts a city id **or** a name, ROUTES
      #10); only the type-ahead suggestion list is missing.*
- [ ] `sOrder=dt_expiration` does not actually sort (TEST **BUG-R2**). *Needs a
      re-seed: `dt_expiration` was never dumped into the per-category `order.*`
      arrays. Datum from the route tester — on the source `dt_expiration` **IGNORES
      `iOrderType`** (`asc` and `desc` return the same page, `68564, 68264, 68237…`
      at p50), so the re-seed needs **one** expiration array, not two. The `.see_by`
      label already blanks out for this pair, matching the source (DIFF-007).*
- [ ] **PIPELINE-005** — `src/pages/GoPage.jsx` and `stateTracker.computeStateDiff`
      are unreachable dead code (the vite middleware answers `/go` under both dev and
      preview) and disagree in shape with the live `calculateStateDiff`. *Delete both,
      or comment them as a fallback that must track the middleware's algorithm.*
- [ ] **PIPELINE-006** — `user.nItems` / `user.nComments` are seeded (12 / 1) but never
      read and never updated. *Documented as inert in `SCHEMA.md`; do not point an
      evaluator at them. Drop from the seed or maintain them.*
- [ ] **HANDLERS-009** — `Show filters` (`a.show-filters-btn`) is a `preventDefault`-only
      no-op. *`display:none` above 768 px (`responsive.css:19`), so unreachable by any
      desktop task; real only if the site is ever tested at ≤767 px.*
- [ ] **HANDLERS-010** — the two `.fixed-close` buttons (search sidebar, `#contact-in`)
      have no handler. *Same media query, same caveat. `UserSidebar.jsx:46` wires its own.*
- [ ] **HANDLERS-013** — the publish/edit currency select is stored into state but never
      rendered; `format.js` hard-codes `$`. *No task uses a non-USD currency; the control
      is stored-but-invisible rather than dead.*

---

## Data Seed — built AND verified

Ticked by P2-CLEANUP. Counts re-counted off the files on disk this round; the
behavioural claims are the playwright task shard's, recorded in
`TEST.part-tasks.md` §1 and §5 (**0 P0, 0 P1**).

- [x] Items: **84,149** — the complete table, real ids/titles/prices/dates/sellers.
      Covers every category (2–24) and every anchor id.
      *Re-counted: `src/data/catalog/cat-2…24.json` sum to exactly 84,149.*
- [x] Descriptions: **84,152**, full text, sharded. *Re-counted across the 85
      `desc-*.json` shards.*
- [x] Comments: **1** (the entire source table). *`session_seed.json`: id 1, item 10727.*
- [x] Users: **1**, Blake Sullivan, `blake.sullivan@gmail.com`. *Confirmed in the seed.*
- [x] Categories 23 / regions 51 / cities 39,888 — complete. *Re-counted: 23 / 51 / 39,888.*
- [x] Images: 84,149 thumbnails + 1,530 detail photos, all 180 anchor items covered at
      both sizes. *Re-counted on disk: `public/img/t` = 84,149 `.webp`, `public/img/m`
      = 1,530; 0 of the 180 anchor ids missing at either size.*
- [x] Verify after wiring: **all 180 ids in `assets/anchor_item_ids.txt` resolve** to a
      real title, price, description, category, seller and image.
      *`TEST.part-tasks.md` §1: 180/180 render a non-empty `h1`, `.price`, `.desc`,
      `#contact .name` and an `<img>` with `naturalWidth > 0` that is **not**
      `no_photo.gif` — **0 broken images, 0 `no_photo.gif` fallbacks**, 0 page errors,
      in a real headless chromium. §Summary: the same 180 diffed **field-by-field
      against the live source — 180/180 identical**. §5: all **51/51** search anchor
      routes match the source's ordered item ids **and** the `N - M of T listings`
      counter, covering both sorts, both `sShowAs`, `sPattern`, `sRegion` and deep
      pages (`iPage=331`, `124`, `119`, `106`, `90`, …).*

### Encoding — do not "fix" this

The source renders **mojibake** for non-ASCII seller names: item 1's seller shows as
`Jennifer KovÃ¡cs` with e-mail `jennifer_kovÃ¡cs496@example.com`, verified by curling the
live page. The seed preserves it byte-for-byte. Evaluators string-match these.

---

## Images are on disk but gitignored — read this before you start

`public/img/t/` (622 MB, 84,149 files) and `public/img/m/` (47 MB, 1,530 files) exist in
this working tree and the mock needs them to run, but `.gitignore` excludes them: they are
binary and too large to commit. Anyone starting from a fresh clone must run

```bash
/tmp/pwvenv/bin/python assets/extract-images.py     # idempotent, ~8 min, needs the container
```

`assets/dumps/` (96 MB) is likewise gitignored; regenerate with `assets/dump-*.py`.

If the size still needs to come down, re-encode at q60 (~520 MB) or 160×133 (~290 MB,
visibly soft at the 240 px size the CSS renders at). **Do not resolve it by seeding fewer
items** — that is `DESIGN.md` §8 option B, and it breaks deep pagination and every
"cheapest on this site" task.

---

## Out of Scope

- Login / logout / registration — the app boots as **Blake Sullivan**. The source already
  302s away from `page=login` and `page=register` when logged in; the mock should do the
  same rather than 404.
- Password recovery, e-mail confirmation, account deletion.
- `page=ajax&action=*` server endpoints — reimplement the behavior client-side, not the
  endpoints.
- `page=cron`, `page=language`, `page=custom`, `page=reset` (`RESET_TOKEN`); `/oc-admin/*`.
- `sFeed=rss`.
- Custom fields / `meta[...]` search params — `oc_t_meta_fields` is empty on this
  deployment, so there is nothing behind them.
- Premium listings — no item has `b_premium=1`, so the block never renders.
- The per-item "Contact seller" form — disabled at the source
  (`item_contact_form_disabled = 1`).
