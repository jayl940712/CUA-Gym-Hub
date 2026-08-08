# classifieds — Per-View UI Reference

> Structure, copy and behavior observed on the live site and cross-checked against the
> sigma theme's PHP templates (`/tmp/recon/classifieds/theme/`, copied from the container).
> Raw HTML: `assets/html/*.html`. Screenshots: `assets/screenshots/reference/<view>.<1280|1920>.png`.
> Every quoted string below is copy-pasted from the source — reproduce verbatim.

Dimensions and colors are in `DESIGN.md`. Routes and params are in `ROUTES.md`.

---

## Global chrome

### `<header>` — every page

White bar, `padding:10px 15px`, `1px solid rgba(0,0,0,0.1)` bottom border on every page
**except** home (where it sits on the `#F1FAEE` wash).

- **Left:** `#logo` → `<a href="/"><img alt="Classifieds" src="…/sigma_logo.png"></a>`
- **Right:** `.nav`, pill-shaped links, in order — `My account`, `Logout`,
  then `Publish Ad` as a solid black pill (`a.publish`).
  Mobile-only duplicates `Home`, `Publish Ad`, `Contact` carry class `isMobile`.
- The mock boots logged in, so `My account` / `Logout` are always the logged-in variant.
  `My account` links to `page=user&action=dashboard`, which redirects to
  `page=user&action=items`.

### `<footer>` — every page

`#cde8e9`, `padding:35px 0 25px 0`. One link, `Contact`, then:

> `Powered by best classifieds scripts osclass`

("best classifieds scripts" is a link to osclass-classifieds.com. Per `TRADEMARKS.md`,
alter the wordmark in the mock but keep the sentence shape.)

### `<body>` classes

`home` · `search` · `item` · `item item-post` · `user` · `user-items` · `login` ·
`register` · `contact`. The CSS keys column widths off these — see `DESIGN.md` §4.

### Breadcrumb (item pages)

`Classifieds > <Category> > <Item title>`, with literal ` > ` text nodes between
`<li>`s and schema.org `BreadcrumbList` microdata. Last crumb is a bare `<span>`, not a
link. `margin:0 0 20px 0`.

---

## 1. Home — `/`

`body.home`. Header and hero share the `#F1FAEE` wash. Layout: `#main` 640 px **left**,
`#sidebar` right (no fixed width on this page).

**Hero** (`section.home-search`) — a GET form to `index.php` with `page=search` hidden:

- `<h1>What are you looking for today?</h1>` (EB Garamond 56/58)
- `Keyword` label + `input[name=sPattern]`, placeholder `e.g., a blue used car`
- `Category` label + `select[name=sCategory]`, first option `Select a category`,
  then all 23 in `i_position` order
- Submit button: magnifier icon + `Search`

**`.home-latest`** — `<h2>Latest listings</h2>`, the **12** most recent items site-wide
(`maxLatestItems@home = 12`) as `.listing-card`s.

**`#home-cats`** — `<h2>All categories</h2>`, panel `#f6f6f4`, radius 5 px.
23 tiles, each 110×120 px white with a Font Awesome icon (`#75a9ab`, 34 px) over a bold
label, linking to `index.php?page=search&sCategory=<id>`:

| id | Label | Icon |
|---:|---|---|
| 2 | Antiques | `fas fa-pen-fancy` |
| 3 | Appliances | `fas fa-sink` |
| 4 | Arts + crafts | `fas fa-palette` |
| 5 | Auto parts | `fas fa-car-battery` |
| 6 | Beauty + health | `fas fa-heart` |
| 7 | Bikes | `fas fa-bicycle` |
| 8 | Boats | `fas fa-ship` |
| 9 | Books | `fas fa-book` |
| 10 | Cars + trucks | `fas fa-car` |
| 11 | Cell phones | `fas fa-mobile` |
| 12 | Collectibles | `fas fa-star` |
| 13 | Computer parts | `fas fa-server` |
| 14 | Computers | `fas fa-laptop` |
| 15 | Electronics | `fas fa-plug` |
| 16 | Farm + garden | `fas fa-seedling` |
| 17 | Furniture | `fas fa-couch` |
| 18 | Household | `fas fa-tape` |
| 19 | Jewelry | `fas fa-ring` |
| 20 | Motorcycles | `fas fa-motorcycle` |
| 21 | Music instruments | `fas fa-guitar` |
| 22 | Photo + video | `fas fa-camera` |
| 23 | Rvs + campers | `fas fa-caravan` |
| 24 | Video gaming | `fas fa-gamepad` |

**`#home-regs`** (sidebar) — `<h2>All locations</h2>`. Seven rows, each
`<i class="fas fa-location-arrow"></i> <span>Name</span> <em>(count)</em>` linking to
`index.php?page=search&sRegion=<geonames id>`. Exact values on the source:

| Region | `sRegion` | Count |
|---|---|---:|
| Virginia | `9254928` | 31126 |
| Pennsylvania | `9254927` | 22180 |
| Maryland | `7361885` | 21674 |
| Ohio | `8165418` | 5626 |
| Washington, D.C. | `7138106` | 1567 |
| West Virginia | `7826850` | 1110 |
| Delaware | `7142224` | 870 |

CSS hides any row past the 9th (`#home-regs .wrap > div:nth-of-type(1n+10){display:none}`),
so only these 7 ever show.

---

## 2. Search — `index.php?page=search&…`

`body.search`. `#sidebar` **210 px left**, `#main` **728 px right**.

### Sidebar

1. **`.filters`** panel (`#f6f6f4`, `padding:15px 12px`) — a **GET** form to `index.php`
   with hidden `page=search`, `sOrder`, `iOrderType`, and a hidden `sCategory[]` per
   active category:
   - `Your search` → `input[name=sPattern]#query`
   - `City` → `input[name=sCity]#sCity` (jQuery-UI autocomplete) + hidden
     `input[name=sRegion]#sRegion` that the autocomplete fills in
   - `Show only` → `input[type=checkbox][name=bPic]#withPicture` labelled
     `listings with pictures`
   - `Price` → `Min.` / `Max.` text inputs `sPriceMin` / `sPriceMax`, `maxlength="6"`
   - `<button class="btn btn-primary">Apply</button>`
2. **`.alert_form`** — `<h3><strong>Subscribe to this search</strong></h3>` and a
   `Subscribe now!` button. On the source it POSTs an opaque encrypted `alert` blob;
   in the mock, push a descriptor of the current query onto `state.alerts`.
3. **`.refine`** — `<h3>Refine category</h3>`, a list starting with `All categories`
   (drops `sCategory`, keeps the other params) then every category. The **active**
   category renders its label inside `<strong>`; the rest are plain. Each link
   preserves the current `sPattern` and `sShowAs`.

### `.list-header`

- `<h1>` = the search title: the category name (`Books `, with a trailing space in the
  source), or `Search results` when unfiltered.
- `<span class="counter-search">1 - 12 of 1489 listings</span>` — format
  `%d - %d of %d listings`.
- Right side `.actions`:
  - `Show filters` button (mobile toggle)
  - `.see_by` sort dropdown: `<span>Sort by:</span>` then a `<label>` showing the
    current option and a chevron; the `<ul>` lists **`Newly listed`**,
    **`Lower price first`**, **`Higher price first`**, current one marked
    `class="current"`. Pure CSS hover menu.
  - `.doublebutton` — two 40×40 buttons, `fas fa-bars` (list) and `fas fa-border-all`
    (gallery); the active one gets `.active` (`#056786` fill).

### Results

`<h2>Listings</h2>` then `<ul class="listing-card-list [listing-grid] items" id="listing-card-list">`.

A **Premium listings** block (`<h2>Premium listings</h2>`) precedes it in the template,
but **never renders here** — no item has `b_premium=1`.

Each `<li class="listing-card">`:

```html
<a class="listing-thumb" href="…page=item&id=3346" title="{title}">
  <img src="…/3346_thumbnail.png" title="" alt="{title}" width="240" height="200"></a>
<div class="listing-detail"><div class="listing-cell"><div class="listing-data">
  <div class="listing-basicinfo">
    <a href="…page=item&id=3346" class="title" title="{title}">{title}</a>
    <div class="listing-attributes">
      <span class="currency-value">28995.00 $</span>
      <div class="listing-details">
        <span class="category">Boats</span>
        <span class="location">Brimfield  (Ohio)</span>
        <span class="date">2023/11/10</span>
      </div>
    </div>
    <div class="desc">{first 250 chars}...</div>
  </div>
</div></div></div>
```

- Price format: `28995.00 $` — trailing symbol, 2 decimals, **no thousands separator**.
- Location has a **double space** before the parenthesised region: `Brimfield  (Ohio)`.
- The ` / ` separators between category/location/date are CSS `::after`, not markup.
- `.desc` is present in the DOM in both layouts but **hidden by CSS in gallery view**.
- Gallery cards are 3-up on the search page (`calc(33.33% - 20px)`), 4-up (`23%`) in the
  generic grid; list rows put a 95 px-wide thumb on the left with `margin-left:105px`.

### Pagination

`<div class="paginate"><ul>…</ul></div>` — see `ROUTES.md` for the exact classes.
Page 1 links **omit `iPage` entirely**. 12 per page.

### Empty state

When nothing matches, `.list-header` contains only:

```html
<p class="empty" >There are no results matching "zzzqqqxx". Note that only search terms of 4 or more characters are valid.</p>
```

No counter, no sort controls, no pagination. The sidebar still renders (the "Refine
category" links carry the failed `sPattern` through). **The source returns HTTP 404 for
this page while still rendering it.**

---

## 3. Item detail — `index.php?page=item&id=N`

`body.item`. `#main` **640 px left**, `#sidebar` **300 px right**.

### `#main` / `#item-content`

1. `<h1>` — item title, EB Garamond 46/50.
2. `<div class="price price-alt isMobile">185.00 $</div>` (mobile-only duplicate).
3. `.item-header` — hairline top/bottom borders, `padding:12px 5px`:
   - `<strong class="publish">Published date:</strong> 2023/11/01`
   - `<ul id="item_location"><li><strong>Location:</strong> City of Akron, Ohio, United States</li></ul>`
4. `.item-photos` — `.main-photo` 550 px wide (fancybox trigger, `title="Image 1 / 1"`),
   `.thumbs` 79 px on the right with the `_thumbnail` image at `width="75"`.
   Every item has exactly one photo, so the strip always shows one tile.
5. `#description` → **`<div class="desc">{full description}</div>`** — an anchor locator.
6. `.contact_button` — `Contact seller` (`href="#contact-in"`) and `Share`
   (`…action=send_friend&id=N`), both `.btn.btn-secondary`.
7. `.similar_ads` — `<h2>Related listings</h2>` and **3** cards from the same category,
   rendered as a 3-up gallery grid.
8. `#comments` — see §3.2.

### 3.1 `#sidebar`

1. `<div class="price isDesktop isTablet">185.00 $</div>` — **40 px bold, right-aligned,
   `#000`.** This is the `.price` anchor locator.
2. `#mask_as_form` — a `select.mark_as` with options
   `Mark as...` / `Mark as spam` / `Mark as misclassified` / `Mark as duplicated` /
   `Mark as expired` / `Mark as offensive` (values `spam`, `badcat`, `repeated`,
   `expired`, `offensive`). Submits on change.
3. `#contact` — `<h2>Contact publisher</h2>`, the default user avatar, then
   `<p class="name bld"><span>Name:</span> Jacob Jefferson</p>` and
   `<p class="email bld"><span>E-mail:</span> <a href="mailto:…">jacob_jefferson53@example.com</a></p>`.
   **This is where every `*@example.com` anchor string is read from.**
   The `Contact seller` button opens `#contact-in`, which on this deployment contains
   only `<!-- Contact form disabled -->` (`item_contact_form_disabled = 1`). Reproduce
   the disabled state.
4. `#useful_info` — `<h2>Useful information</h2>` and four fixed bullets:
   - `Avoid scams by acting locally or paying with PayPal`
   - `Never pay with Western Union, Moneygram or other anonymous payment services`
   - `Don't buy or sell outside of your country. Don't accept cashier cheques from outside your country`
   - `This site is never involved in any transaction, and does not handle payments, shipping, guarantee transactions, provide escrow services, or offer "buyer protection" or "seller certification"`

On **Blake's own** listings (84143–84154) the sidebar/card also exposes `Edit item` and
`Delete` (see §5).

### 3.2 `#comments` — the highest-value component on the site

`<h2>Comments</h2>`, `<ul id="comment_error_list"></ul>`, then `.comments_list` (only if
there is at least one comment), then `<div class="paginate"></div>`, then the form.

Each comment:

```html
<div class="comment has-user-img">
  <p class="user-img"><img src="…/default-user-image.png" alt="Blake Sullivan"/></p>
  <h3><strong>Hello!</strong> <em>by Blake Sullivan:</em></h3>
  <p class="comment-rating">
    <i class="fa fa-star fill"></i> ×3 <i class="fa fa-star"></i> ×2
    <span>(3 of 5)</span>
  </p>
  <p>Nice bracelet</p>
  <p class="comment-delete-row"><a rel="nofollow" href="…action=delete_comment&id=10727&comment=1&octoken=…" title="Delete your comment">Delete</a></p>
  <p class="comment-reply-row"><a href="#" class="comment-reply" data-id="1"
     data-text="You are replying to: Hello! - Nice bracelet" data-rating="1">Reply</a></p>
</div>
```

- `.comments_list h3` text is **`{title} by {authorName}:`** — this is exactly what the
  31 `program_html` evaluators compare.
- Rating: 5 stars, first N with `.fill` (`#ffb900`), then `<span>({N} of 5)</span>`.
  Omit the whole `.comment-rating` block when no rating was given.
- `Delete` only appears on comments the logged-in user authored.
- 10 comments per page.

Form (`#comment_form`, POST):

- `<div class="header"><h3>Leave your comment (spam and offensive messages will be removed)</h3></div>`
- hidden `action=add_comment`, `page=item`, `id`, `replyId`, `authorName`, `authorEmail`, `octoken`
- `Rating` — `.comment-leave-rating`, five clickable `<i class="fa fa-star is-rating-item" data-value="1..5">`
  writing to `input[type=hidden][name=rating]`
- `Title` and `Body` fields, then submit

A posted comment appears **immediately** — no moderation (`moderate_comments = -1`).

### 3.3 Missing / deleted item

Source returns **HTTP 410** but renders the theme's 404 body. `#main` contains:

```html
<div class="flashmessage-404"><div class="error404">
  <h1>404</h1>
  <h2>OOPS! Page Not Found!</h2>
  <h3>Either something get wrong or the page doesn't exist anymore.</h3>
  <a href="/" class="btn btn-secondary">Take me home</a>
</div></div>
```

(`Either something get wrong` is the source's own grammar — keep it.)
No sidebar. Task `visualwebarena-681` asserts the literal string `404` here.

---

## 4. My listings — `index.php?page=user&action=items`

`body.user user-items`. `<title>Manage my listings - Classifieds</title>`.
`#sidebar` 210 px left, `#main` 728 px right.

- `.list-header` → `<h1>My listings</h1>` (no counter, no sort, no layout toggle).
- A `listing-list` of Blake's 12 items, newest first, each an ordinary `.listing-card`
  **plus**:

```html
<span class="admin-options">
  <a href="…action=item_edit&id=84154" rel="nofollow">Edit item</a>
  <a class="delete" onclick="javascript:return confirm('This action can not be undone. Are you sure you want to continue?')"
     href="…action=item_delete&id=84154">Delete</a>
</span>
```

The delete confirm text must match: `This action can not be undone. Are you sure you want to continue?`

### User sidebar (shared by all `page=user` views)

`<ul>` of links: `Manage my listings`, `Alerts`, `Change email`, `Change username`,
`Change password`, `Delete account` (`li.opt_delete_account`, `href="#"`, opens
`#dialog-delete-account` — `Are you sure you want to delete your account?`).

---

## 5. Publish a listing — `index.php?page=item&action=item_add`

`body.item item-post`, `#main` **760 px**. `.form-container.form-horizontal`,
`<h1>Publish a listing</h1>`, `<ul id="error_list"></ul>`.

Multipart POST with hidden `action=item_add_post`, `page=item`, `octoken`.

**`<h2 class="gen">General Information</h2>`**

| Label | Field |
|---|---|
| `Category` | `select[name=catId]#catId`, first option `Select a category` |
| `Title` | `input[name="title[en_US]"]#titleen_US` |
| `Description` | `textarea[name="description[en_US]"]#descriptionen_US` rows=10 |
| `Price` | `input[name=price]#price` + `select[name=currency]` with `€` / `£` / `$` (USD selected) |
| — | image drop zone `#restricted-fine-uploader`, max 4 images (`numImages@items`) |

**`<h2>Listing Location</h2>`** — hidden `countryId=US`, then
`Region` (`select[name=regionId]`, `Select a region...`),
`City` (`select[name=cityId]`, `Select a city...`, populated from the region),
`City Area` (`input[name=cityArea]` + hidden `cityAreaId`), `Address` (`input[name=address]`).

**`<h2>Seller's information</h2>`** — `Phone` (`contactPhone`),
checkbox `showPhone` (checked) labelled `Show phone on the listing page`,
`Other contact` (`contactOther`).

Submit: `<button type="submit" class="btn btn-primary pbl">Publish</button>`.

On success the source redirects to the new item's `page=item&id=<new id>`.
**The mock must assign `state.nextItemId`, starting at 84155**, then increment — tasks
684/685 read `.price` on the page they land on.

`index.php?page=item&action=item_edit&id=N` is the same form pre-filled, with
`action=item_edit_post` and a hidden `id`. It renders for Blake's items without needing
the `secret` param.

---

## 6. Smaller views

| View | Route | Content |
|---|---|---|
| Alerts | `page=user&action=alerts` | `<h1>Alerts</h1>`, `<p class="empty">You do not have any alerts yet.</p>` |
| Profile | `page=user&action=profile` | Name / phone / country-region-city / description form. Flash on save: `Your profile has been updated successfully` |
| Change email | `page=user&action=change_email` | Single `new_email` field |
| Change username | `page=user&action=change_username` | Single `s_username` field, prefilled with `1` |
| Change password | `page=user&action=change_password` | Current / new / confirm |
| Share | `page=item&action=send_friend&id=N` | Your name/email, friend's name/email, message |
| Contact | `page=contact` | Site contact form (`web_contact_form_disabled = 0`, so this one **is** enabled) |

---

## Regenerating images

`public/img/t/` (84,149 thumbnails, 761 MB) and `public/img/m/` (1,530 detail
photos, 48 MB) are **gitignored**. They must exist on disk — every one of the 234
tasks is visual and the mock has to work offline — but they are not committed.

```bash
python3 assets/extract-images.py          # idempotent: skips files already present
```

- Runtime: **~8 minutes** for a cold run; seconds if the tree is already populated.
- **Requires the `classifieds` docker container to be running** — it reads the
  original PNG/JPG uploads out of it and re-encodes them to WebP.
- Output paths are fixed by `assets/data_model.md` §7:
  `public/img/t/<id//1000>/<id>.webp` (240×200) and
  `public/img/m/<id//1000>/<id>.webp` (640×480).
- `assets/tier_b_ids.txt` is the derived 1,530-id list for the 640×480 tier; it
  covers all 180 anchor items. Regenerate it with `assets/compute-tier-b.py`.

If the images are missing, listing cards fall back to `public/img/no_photo.gif`
and the site still renders — but every colour/appearance task will fail.

## Screenshots

`assets/screenshots/reference/` holds 23 views × 2 viewports (`.1280.png`, `.1920.png`),
full-page, captured logged in as Blake Sullivan against the live site.
Per the repo's testing guidance, verify the mock at **1280×720 as well as 1920×1080** —
the 980 px fixed container plus the 210/728 and 640/300 splits are the places where a
narrow viewport bites.
