# webarena_classifieds_mock — TEST part: SHARD DIFF

> Round: diff-1
> Date: 2026-08-08
> Mock: http://localhost:5184
> Source: http://10.186.197.203:9980/ (reachable: YES)
> Scope: source-vs-mock differential comparison at 1280x720 AND 1920x1080, plus
>        hit-tested interactive-element sweep on every route.
> Tested by: playwright agent SHARD DIFF

_STATUS: COMPLETE._

## Summary

| Metric | Count |
|---|---|
| Views compared **in a browser** on source **and** mock | **19** |
| Viewports per view | **2** (1280x720 and 1920x1080) |
| Full-page screenshot pairs captured | **38 pairs / 76 files** |
| Views whose geometry was measured programmatically | 8 x 2 viewports x 19 selectors |
| Horizontal-geometry / font / colour differences found | **0** |
| Behavioural URLs compared field-by-field | 30 — **28 identical**, 2 P2 |
| Keyword-count checks re-verified live | 9 / 9 ✅ |
| Interactive elements enumerated + hit-tested | 1035 per viewport, 23 routes — **0 BLOCKED** at either viewport |
| Interactions driven end to end | 29 (part 1) + 40 (part 2), at both viewports |
| Console / page errors across the whole sweep | **0** |
| **P0** | **0** |
| **P1** | **4** (BUG-A, BUG-B, DIFF-001, DIFF-002) |
| **P2** | **8** (BUG-C, DIFF-003…DIFF-009) |

**Headline:** the mock is a near-exact reproduction — identical horizontal
layout, identical structural copy, identical search/sort/filter/pagination
semantics down to the item id, and no unreachable controls at either viewport.
The one finding that matters is **BUG-A**: every form's validation message is
computed correctly and then rendered inside a `display:none` container, so seven
forms fail silently.

## Method

- Source accessed READ-ONLY. The only POST issued to the source was the single
  `page=login&action=login_post` needed to become `blake.sullivan@gmail.com`
  (the access mechanism named in SOURCE.md). No publish/edit/delete/comment/
  profile form was ever submitted on the source. Everything else is GET.
- Screenshots land in `assets/screenshots/diff/{source,mock}_<view>.<vp>.png`.

## 1. Per-view comparison

**19 views compared in a real browser (chromium), each at BOTH 1280x720 and
1920x1080 → 76 full-page screenshots** in `assets/screenshots/diff/`
(`source_<view>.<vp>.png` / `mock_<view>.<vp>.png`).

Beyond eyeballing, geometry was measured programmatically on 8 of the views at
both viewports: `getBoundingClientRect()` + `getComputedStyle()` for
`header, #main, #sidebar, #content, .wrapper, footer, .listing-card,
.list-header, .filters, .paginate, h1, .price, .form-container, #home-cats,
#home-regs, .listing-thumb img, .see_by, .doublebutton, #comments`
(x/width, font-family, font-size, font-weight, color, background, padding,
line-height) — see `/tmp/pw-diff/measure.json`.

**Result: every measured box matches on every horizontal and typographic axis at
both viewports** — zero differences in `x`, `width`, `font-family`, `font-size`,
`font-weight`, `color`, `background-color`, `padding` or `line-height` across
19 selectors x 8 views x 2 viewports. The only geometric deviation is vertical
(`y` / `height`), and it has a single root cause — see **DIFF-008**.

| # | View | Path | VP | Layout | Styling | Structural copy | Content shape | Verdict |
|---|---|---|---|---|---|---|---|---|
| 1 | home | `/` | 1280 + 1920 | ✅ px-identical | ✅ | ✅ | ✅ same 12 latest, same order/prices; 23 cat tiles; 7 region rows w/ same counts | **PASS** |
| 2 | search list | `?page=search&sCategory=9` | 1280 + 1920 | ✅ sidebar 210 / main 728 identical | ✅ | ✅ | ✅ same 12 rows, same order, prices, locations, dates; counter `1 - 12 of 1489 listings` | **PASS** |
| 3 | search gallery | `…&sShowAs=gallery` | 1280 + 1920 | ✅ 3-up grid identical | ✅ | ✅ | ✅ 12 cards, `.desc` hidden, same pager `1 2 3 > »` | **PASS** |
| 4 | search sorted | `sCategory=11&sOrder=i_price&iOrderType=asc&sShowAs=gallery` | 1280 + 1920 | ✅ | ✅ | ✅ | ✅ same 12 items in same price-asc order | **PASS** |
| 5 | search deep page | `sCategory=9&iPage=124&sOrder=i_price&iOrderType=asc&sShowAs=gallery` | 1280 + 1920 | ✅ | ✅ | ✅ | ✅ item-for-item identical; counter `1477 - 1488 of 1489 listings`; pager `« < 122 123 124 125 >` | **PASS** |
| 6 | keyword search | `?page=search&sPattern=kayak` | 1280 + 1920 | ✅ | ✅ | ✅ | ✅ same first 12 hits, same order/prices/dates | **PASS** |
| 7 | empty state | `?page=search&sPattern=zzzznothing` | 1280 + 1920 | ✅ | ✅ | ✅ verbatim `There are no results matching "zzzznothing". Note that only search terms of 4 or more characters are valid.` | ✅ no counter/sort/pager, sidebar retained, 23 refine links | **PASS** |
| 8 | item | `?page=item&id=4799` | 1280 + 1920 | ✅ main 640 / sidebar 300 identical | ✅ | ✅ | ✅ price, dates, location, desc, seller card, Useful information x4 | **PASS** (related listings differ — source `RAND()`) |
| 9 | item w/ comment | `?page=item&id=10727` | 1280 + 1920 | ✅ | ✅ | ✅ `Hello! by Blake Sullivan:` verbatim | ✅ 3/5 stars, `(3 of 5)`, `Nice bracelet`, Delete + Reply, comment form | **PASS** |
| 10 | own item | `?page=item&id=84144` | 1280 + 1920 | ✅ | ✅ | ✅ | ✅ | **PASS** |
| 11 | 404 | `?page=item&id=999999` | 1280 + 1920 | ✅ | ✅ | ✅ `404` / `OOPS! Page Not Found!` / `Either something get wrong…` / `Take me home` | ✅ no sidebar | **PASS** |
| 12 | my listings | `?page=user&action=items` | 1280 + 1920 | ✅ | ✅ | ✅ | ✅ 12 cards, Edit item + Delete on each | **PASS** |
| 13 | publish form | `?page=item&action=item_add` | 1280 + 1920 | ✅ | ✅ | ✅ all 3 `<h2>`, all labels, `Publish` | ✅ | **PASS** (see DIFF-004) |
| 14 | edit form | `?page=item&action=item_edit&id=84144` | 1280 + 1920 | ✅ | ✅ | ✅ | ✅ prefilled title/desc/price 30000.00, Region=Pennsylvania, City=Pittsburgh both correctly selected, `Update` | **PASS** (see DIFF-005) |
| 15 | profile | `?page=user&action=profile` | 1280 + 1920 | ✅ | ✅ | ✅ | ✅ identical incl. disabled City select | **PASS** |
| 16 | alerts | `?page=user&action=alerts` | 1280 + 1920 | ✅ | ✅ | ✅ | ✅ | **PASS** |
| 17 | change email | `?page=user&action=change_email` | 1280 + 1920 | ✅ | ✅ | ✅ | ✅ | **PASS** |
| 18 | contact | `?page=contact` | 1280 + 1920 | ✅ | ✅ | ✅ | ✅ | **PASS** |
| 19 | public profile | `?page=user&action=pub_profile&id=1` | 1280 + 1920 | ✅ | ✅ | ❌ breadcrumb (DIFF-002) | ❌ Edit/Delete missing (DIFF-001) | **DIFF** |

### Pixel-diff corroboration (all 38 pairs, objective)

Every pair was also compared numerically. Raw overlay diffs are dominated by the
+10 px vertical shift of DIFF-008, so I searched for the best vertical alignment
offset per pair and report the **residual** difference at that offset:

| view | best offset | residual @1280 | residual @1920 |
|---|---|---|---|
| user_items | +10 px | 0.89 % | 0.66 % |
| contact | +10 px | 0.80 % | 0.48 % |
| item_404 | +5 px | 0.60 % | 0.28 % |
| user_alerts | +5 px | 1.40 % | 0.64 % |
| search_list | +10 px | 1.58 % | 1.13 % |
| user_profile | +10 px | 1.62 % | 1.36 % |
| item_add | −14 px | 2.78 % | 1.83 % |
| search_empty | +16 px | 4.24 % | 3.39 % |
| home | +16 px | 10.5 % | 7.5 % |

Sub-2 % residual on most views is anti-aliasing plus the deliberate `osclazz`
wordmark. `home` stays high only because the shift is not uniform down the page
(the hero, the card rows and the category panel each accumulate their own
5-12 px), not because anything is laid out differently.

Two page-height deltas independently corroborate real findings rather than the
shift: `pub_profile` is **322 px shorter** on the mock (= 10 missing
`admin-options` rows, DIFF-001) and `item_edit` is **63 px shorter**
(= the missing image `Delete` link and a shorter image tile, DIFF-005).

### Rendered-text (structural copy) diff

`page.innerText('body')` on both sides, all 19 views. Excluding the deliberate
`osclass` → `osclazz` wordmark alteration (TRADEMARKS.md) and innerText
whitespace-collapse artefacts, the only real copy differences found were
DIFF-002 (pub_profile breadcrumb), DIFF-004 (`No value` city option) and
DIFF-005 (image `Delete` link). Every heading, label, button, empty-state and
validation string on the other 18 views matched **verbatim**.

## 2. Behavioral comparison

30 URLs loaded on **both** sides in a browser; for each I captured
`.counter-search` text, the ordered list of item ids from every `.listing-card`
href, every `.currency-value`, the `.empty` copy, the full `.paginate` `<li>`
text, the `.see_by` current-sort label, the `.doublebutton` active class and
`document.title`, then diffed field by field. Raw: `/tmp/pw-diff/behav.json`.

**28 of 30 matched on every field — the same items, in the same order, at the
same prices, with the same pager and the same counter.**

### 2a. Keyword search result counts (re-measured live this round)

| pattern | source | mock | expected (recon) | verdict |
|---|---|---|---|---|
| `banana` | 30 | 30 | 30 | ✅ |
| `boat` | 628 | 628 | 628 | ✅ |
| `banana boat` | 658 | 658 | 658 | ✅ |
| `dogs` | 128 | 128 | 128 | ✅ |
| `dog` | 0 (`.empty`) | 0 (`.empty`) | 0 | ✅ — both render `There are no results matching "dog". Note that only search terms of 4 or more characters are valid.` verbatim |
| `kayak` | 79 | 79 | 79 | ✅ |
| `kayaks` | 31 | 31 | 31 | ✅ |
| `painting` | 529 | 529 | 529 | ✅ |
| `paintings` | 110 | 110 | 110 | ✅ |

Not just the counts — the first 12 result **ids and prices** are identical on
every one of these nine queries.

### 2b. Sort

| `sOrder` / `iOrderType` | source first-12 ids | mock | dropdown label | verdict |
|---|---|---|---|---|
| `dt_pub_date` `desc` (Newly listed) | 12 ids | identical | `Newly listed` both | ✅ |
| `i_price` `asc` (Lower price first) | 12 ids | identical | `Lower price first` both | ✅ |
| `i_price` `desc` (Higher price first) | 12 ids | identical | `Higher price first` both | ✅ |
| `iOrderType=1` (numeric) | falls back to `desc` | identical | ✅ | ✅ |
| `sOrder=zzz` (invalid) | see DIFF-007 | differs | differs | ⚠️ P2 |

### 2c. Pagination — same items on the same page number

| page | source counter | mock counter | ids match |
|---|---|---|---|
| 1 (`sCategory=9`) | `1 - 12 of 1489 listings` | same | ✅ |
| 2 | `13 - 24 of 1489 listings` | same | ✅ |
| 5 | `49 - 60 of 1489 listings` | same | ✅ |
| 125 (last) | `1489 - 1489 of 1489 listings` | same | ✅ 1 card, pager `«|<|123|124|125` |
| 2 in gallery | `13 - 24 of 1489 listings` | same | ✅ same ids as list page 2 |
| `iPage=0` | page 1 | page 1 | ✅ |
| `iPage=4y` | page 1 | page 1 | ✅ (and both `<title>`s echo the raw `4y`) |

`.paginate` `<li>` text matched exactly on all 30 URLs, including the
`«` / `<` / `>` / `»` presence rules at pages 1, 2, 5, 124 and 125.

### 2d. List / gallery toggle

12 per page in **both** layouts on **both** sides; gallery page 2 returns the
same 12 ids as list page 2. `sShowAs=zzz` falls back to list on both.
`.doublebutton` active-class markup identical.

### 2e. Filters

| filter | URL | source | mock | verdict |
|---|---|---|---|---|
| category | `sCategory=9` | `1 - 12 of 1489` | same | ✅ |
| all categories | `page=search` | `1 - 12 of 84149` | same | ✅ |
| region | `sRegion=7361885` (Maryland) | `1 - 12 of 21674` | same | ✅ (matches the home-page region count) |
| region + category | `sCategory=9&sRegion=9254928` | `1 - 12 of 537` | same | ✅ |
| price range | `sCategory=9&sPriceMin=100&sPriceMax=200` | `1 - 12 of 86` | same | ✅ ids identical |
| price range, all cats | `sPriceMin=5000&sPriceMax=6000` | `1 - 12 of 917` | same | ✅ |
| `bPic=1` | `sCategory=9&bPic=1` | `1 - 12 of 1489` | same | ✅ (inert on both — every item has a photo) |
| category + keyword | `sCategory=8&sPattern=kayak` | `1 - 12 of 73` | same | ✅ |
| city | exercised interactively — see §3 | | | ✅ |

### 2f. Counter copy format

`{from} - {to} of {total} listings` — byte-identical on all 28 non-empty result
pages, including the singular last page (`1489 - 1489 of 1489 listings`).

---

### DIFF-007 · [P2] · Invalid `sOrder` value: mock falls back to `dt_pub_date desc`, source drops ORDER BY

| Field | Value |
|-------|-------|
| URL | `/index.php?page=search&sCategory=9&sOrder=zzz&iOrderType=asc` |
| Viewport | 1280 (behaviour, viewport-independent) |
| Source | first ids `32464, 69456, 40883, 70302, 48816, 38752, …` — MySQL storage order, no ORDER BY. Deterministic (3 identical fetches). The `.see_by` label renders **empty** because no option matches. |
| Mock | falls back to `dt_pub_date desc`, i.e. identical to the unsorted default page, and labels the dropdown `Newly listed` |
| Impact | `ROUTES.md` states "Anything else falls back to `dt_pub_date`" — measurably not what the source does. No anchor route and no plausible task passes a garbage `sOrder`, so nothing is blocked. |
| Fix hint | If worth matching: emit results in seed/id order and blank the `.see_by` label when `sOrder` is not one of the three known columns. Otherwise correct the `ROUTES.md` sentence. |

### Re-confirmed (already open in AUDIT.md, not new)

- **HANDLERS-012** — `iPagesize=24` returns **24** cards on the source and **12**
  on the mock. Confirmed live this round. (Source quirk worth noting: its
  `.counter-search` still reads `1 - 12 of 1489 listings` while showing 24 cards.)

## 3. Interactive-element sweep (hit-tested)

### 3a. Mechanical hit-test — every control on every route, both viewports

23 routes x 2 viewports. Every `a, button, input, select, textarea, [role=button],
.is-rating-item` was enumerated, `scrollIntoView({block:'center'})`-ed, and then
`document.elementFromPoint(centreX, centreY)` was required to return the element
itself or a descendant (a wrapping `<label>` whose `.control` is the element also
counts). This is a true reachability check, not `isVisible()`.

| viewport | routes | elements enumerated | reachable | legitimately hidden | **BLOCKED** | offscreen | console errors |
|---|---|---|---|---|---|---|---|
| 1280x720 | 23 | 1035 | 838 | 197 | **0** | 0 | 0 |
| 1920x1080 | 23 | 1035 | 838 | 197 | **0** | 0 | 0 |

**No control is covered, clipped, or unreachable at either viewport**, and the
counts are identical at 1280 and 1920 — nothing regresses at the smaller size.

Breakdown of the 197 hidden-at-1280 elements, all legitimate:

| n | what | why |
|---:|---|---|
| 69 | `a.isMobile` | mobile-only duplicate nav links — `display:none` above 768 px on the source too |
| ~95 | `input[type=hidden]` (`page`, `action`, `id`, `sOrder`, `iOrderType`, `sRegion`, `alert*`, `replyId`, `authorName`, `authorEmail`, `rating`, `countryId`, `cityAreaId`, `pp_blob`, `sCategory[]`) | hidden by definition; several verified to carry the right value |
| 15 | `a.resp-toogle` (`show-menu-btn`, `show-filters-btn`, `show-contact-btn`) | `responsive.css` `display:none` above 768 px — matches source; AUDIT HANDLERS-009/010 |
| 3 | `input[type=file]` | behind the drop zone, as on the source |
| 15 | `.see_by ul li a` (3 per search page) | the pure-CSS hover menu is collapsed until hover — **verified to open and become hittable on hover**, see 3b |

### 3b. Exercised — 29 checks at 1280, all passing

| control | route | result |
|---|---|---|
| `#logo a` | any | → `/`, `sid` kept ✅ |
| `a.publish` "Publish Ad" | any | → `page=item&action=item_add` ✅ |
| "My account" | any | → `page=user&action=dashboard`, renders `My listings` in place (no redirect) ✅ |
| "Logout" | any | navigates, stays logged in (`a.publish` still present) ✅ |
| footer "Contact" | any | → `page=contact` ✅ |
| hero keyword + category + Search | `/` | → `page=search&sCategory=8&sPattern=kayak`, `1 - 12 of 73 listings` ✅ |
| category tile | `/` | → `page=search&sCategory=9`, `h1=Books` ✅ |
| region link | `/` | → `sRegion=9254928`, `1 - 12 of 31126 listings` (= home tile count) ✅ |
| latest-listing card | `/` | → correct `page=item&id=…`, title matches ✅ |
| sort menu hover | search | opens; option box 117x28 and **hit-test passes** ✅ |
| sort → Lower price first | search | URL + order + label all change ✅ |
| sort → Higher price first | search | ✅ |
| sort → Newly listed | search | ✅ |
| sort from `iPage=124` | deep search | keeps `iPage=124` **and** `sShowAs=gallery` ✅ (matches source href) |
| list/gallery toggle | search | `sShowAs=gallery` / `sShowAs=list`, 12 cards both ways ✅ |
| pager 2 / next / prev / last / first | search | counters `13-24`, `25-36`, `13-24`, `1489-1489`, `1-12` ✅ |
| filters Apply (pattern+min+max+bPic) | search | all four params written to URL **and** round-tripped back into the inputs ✅ |
| filters City | search | `sCity=Pittsburgh` → `1 - 4 of 4 listings` — **identical to source** ✅ |
| Refine category | search | keeps `sPattern` + `sShowAs`, `All categories` drops `sCategory` ✅ |
| `Subscribe now!` | search | native alert `You have sucessfully subscribed to the alert` (source's typo preserved), alert then lists on `action=alerts` with the query re-run ✅ |
| listing thumb | search | → correct item ✅ |
| breadcrumb category link | item | → `page=search&sCategory=8` ✅ |
| `Share` | item | → `action=send_friend&id=4799`, `h1=Send to a friend` ✅ |
| `Contact seller` | item | anchors to `#contact-in` ✅ (panel empty by design) |
| related listing | item | → correct item ✅ |
| `select.mark_as` → spam | item | flash `Thanks! That's very helpful` ✅ |
| comment rating star 4 | item 10727 | hidden `rating` input = `4` ✅ |
| comment submit | item 10727 | 1→2 comments, `h3` = `Diff shard test title by Blake Sullivan:`, `(4 of 5)` ✅ |
| comment `Reply` | item 10727 | sets `replyId=1` ✅ |
| comment `Delete` | item 10727 | 2→1 ✅ |
| `Edit item` → Update | my listings | flash `Great! We've just updated your listing`, redirect to item, title + `4321.00 $` + `Modified date:` all persist, and the new title shows on My listings ✅ |
| publish region select | item_add | populates 2751 city options ✅ |
| `Publish` | item_add | flash `Your listing has been published`, redirect to `page=search&sCategory=9` (source parity), new listing is **row 1**, its item page shows `.price` = `1234.00 $`, id `84155` ✅ |
| `Delete` on own listing | my listings | confirm dialog copy verbatim, 13→12 cards ✅ |
| unauthorised `item_edit&id=4799` | — | flash `Sorry, we don't have any listings with that ID`, → `action=items`, no mutation ✅ |
| unauthorised `item_delete&id=3346` | — | flash `The listing you are trying to delete couldn't be deleted`, → `/`, no mutation ✅ |
| profile `Update` | profile | flash `Your profile has been updated successfully`, value persists across reload ✅ |
| profile region select | profile | populates 1452 city options ✅ |
| change username `Update` | — | flash `The username was updated` ✅ |
| change password `Update` | — | flash `Password has been changed` ✅ |
| change email `Update` | — | redirects to `action=profile` with **no** flash — **matches the source exactly** (`user.php:162` `redirectTo(osc_user_profile_url())` with no `osc_add_flash_*` on the happy path) ✅ |
| contact `Send` | contact | flash `Your email has been sent properly. Thank you for contacting us!` ✅ |
| send_friend `Send` | — | flash `We just sent your message to …` ✅ |
| user sidebar x6 | user pages | all 6 navigate correctly, `sid` kept; `Delete account` opens `#dialog-delete-account` ✅ |
| alerts `Delete this alert` | alerts | removes the alert ✅ |

Zero `pageerror` and zero `console.error` across the entire sweep, at both
viewports.

### 3c. The one silent-failure class found — see BUG-A

## 4. Bug list

### BUG-A · [P1] · **Every validation message in the mock is computed correctly and then rendered invisible** — 7 forms affected

| Field | Value |
|-------|-------|
| Routes | `page=item&action=item_add`, `item_edit`, `page=item&id=N` (comment form), `page=contact`, `action=send_friend`, `page=user&action=change_email`, `change_username`, `change_password` |
| Viewport | both 1280x720 and 1920x1080 |
| Action | Click the form's submit button with required fields blank / invalid |
| Expected | The error box appears above the form, as it does on the source |
| Actual | **Nothing visible happens at all.** The correct `<li>`s ARE written into `#error_list` / `#comment_error_list`, but `public/css/style.css:267` sets `#error_list, .error_list, #comment_error_list { … display: none; }`, so the box measures **0 px high**, `isVisible() === false`, and the text does not appear in `page.innerText('body')` |
| Console errors | none — that is the point; it is completely silent |

Measured, all at height 0 / `display:none`:

| form | DOM actually produced |
|---|---|
| Publish (`item_add`) | `<ul id="error_list"><li><label class="error">Title: this field is required</label></li><li><label class="error">Description: this field is required</label></li><li><label class="error">Choose one category.</label></li><li><label class="error">Select a region.</label></li><li><label class="error">Sel…` |
| Edit (`item_edit`) | `Title: this field is required` + `Description: this field is required` |
| Comment | `<ul id="comment_error_list"><li>Comment: this field is required.</li></ul>` |
| Contact | `<ul id="error_list"><li><label class="error">Message: this field is required.</label></li></ul>` |
| Share (`send_friend`) | `Friend's name: …` + `Friend's email: …` + `Message: …` |
| Change e-mail | `The specified e-mail is not valid` |
| Change username | `The specified username could not be empty` |
| Change password | `Password cannot be blank` |

**Why the source does not have this problem.** The CSS is byte-identical to the
source (`oc-content/themes/sigma/css/style.css:267` — I diffed them), but the
source pairs it with jQuery-validate:
`oc-includes/osclass/frm/Item.form.class.php:1077` and
`frm/User.form.class.php:217/325` configure
`errorLabelContainer: "#error_list", wrapper: "li"`, and the plugin calls
`.show()` on that container whenever it has errors (and `.hide()` when it does
not). The mock ported the markup and the CSS but not the `.show()`.

For the three `page=user` forms the source does not even use jQuery-validate —
`controller/user.php:139-167`, `:180-200`, `:207-234` do the checks server-side
and emit `osc_add_flash_error_message(...)`, so the user sees a **flash message**
at the top of the page. The mock's own flash channel already works everywhere
else (verified on 8 other flows this round), so those three would be more
faithful as flashes than as `#error_list` entries.

**Impact.** A WebArena agent that submits an incomplete Publish form — the most
common write flow on this site — gets **zero** feedback and will reasonably
conclude the `Publish` button is dead. Same for a comment with an empty body. No
task's *evaluator* string is missing, so this is not P0, but it is the textbook
P1 "interaction does nothing (silent failure)".

**Fix hint.** One line each way:
- give `#error_list` / `#comment_error_list` `style={{display: items.length ? 'block' : 'none'}}` (or add a `.has-errors { display:block }` class) wherever the mock populates them, and
- for `ChangeEmail.jsx` / `ChangeUsername.jsx` / `ChangePassword.jsx`, route the message through the existing flash mechanism instead, matching `user.php`.

The message **copy is already correct** — I diffed `Title: this field is
required`, `Description: this field is required`, `Choose one category.`,
`Select a region.`, `Select a city.` against
`Item.form.class.php:1071-1077,1414-1415` and
`The specified e-mail is not valid` / `The specified username could not be
empty` / `Password cannot be blank` / `Passwords don't match` /
`Current password doesn't match` against `controller/user.php`. Only the
visibility is wrong.

---

### BUG-B · [P1] · Change-password accepts a wrong current password, and mismatched new passwords fail silently

| Field | Value |
|-------|-------|
| Route | `/index.php?page=user&action=change_password` |
| Viewport | both |
| Action A | `password=WRONG`, `new_password=Aa123456`, `new_password2=Aa123456` → submit |
| Mock | flash `Password has been changed`, redirect to `page=user&action=profile` |
| Source | `controller/user.php:216-219` — `osc_verify_password` fails → flash **`Current password doesn't match`**, redirect back to `change_password`, nothing changed |
| Action B | `password=Password.123`, `new_password=Aa123456`, `new_password2=Bb123456` → submit |
| Mock | stays on `change_password`, **no visible feedback** (the `Passwords don't match` string is in the hidden `#error_list` — same root cause as BUG-A) |
| Source | `user.php:226-229` → flash `Passwords don't match` |
| Impact | Any "change your password" task that is scored on the *failure* path, or that expects the current-password check to bite, diverges. The mutation footprint (`user.passwordChanges` / `passwordChangedAt`, added by PIPELINE-003) is written on the wrong-password path too, so `/go` records a change the source would have refused. |
| Fix hint | The mock deliberately never stores the password (correctly). But it can still compare against the deployment's known default, which is public in `SOURCE.md` — or store a boolean "still the seeded password" flag. Then emit the two flashes above. |

---

### BUG-C · [P2] · Change-email does not reject an address already in use

| Field | Value |
|-------|-------|
| Route | `/index.php?page=user&action=change_email` |
| Viewport | both |
| Action | Enter `blake.sullivan@gmail.com` (the logged-in user's own address) → `Update` |
| Mock | treated as success, redirect to `action=profile` |
| Source | `user.php:163-166` — `findByEmail` hits → flash `The specified e-mail is already in use`, redirect back to `change_email` |
| Impact | `oc_t_user` has exactly **one** row on this deployment, so the only address that can collide is Blake's own. Very narrow. |

---

### DIFF-001 · [P1] · `pub_profile` listings lack the `Edit item` / `Delete` admin options

| Field | Value |
|-------|-------|
| URL | `/index.php?page=user&action=pub_profile&id=1` |
| Viewport | both 1280x720 and 1920x1080 |
| Action | Load the page, inspect each `.listing-card` |
| Mock | `document.querySelectorAll('.admin-options').length === 0`; the 10 cards show title/price/category/location/date/desc only |
| Source | `.admin-options` x 10, each with `<a …action=item_edit&id=N>Edit item</a>` and `<a class="delete" onclick="…confirm('This action can not be undone. Are you sure you want to continue?')" …action=item_delete&id=N>Delete</a>` — sigma renders them because the viewer owns the listings |
| Impact | An empty region where the source has content on every row. No anchor route or task targets `pub_profile` (ROUTES.md row 37 is P2, and it was not even in the original crawl), and the same two controls are present on `page=user&action=items`, so no task is blocked. |
| Screenshots | `assets/screenshots/diff/source_pub_profile.1280.png` vs `mock_pub_profile.1280.png` (and `.1920.png`) |
| Fix hint | Reuse the `admin-options` fragment from `MyListings` when `params.id === state.user.id` |

---

### DIFF-002 · [P1] · `pub_profile` breadcrumb says `Blake Sullivan`, source says `Blake Sullivan's profile`

| Field | Value |
|-------|-------|
| URL | `/index.php?page=user&action=pub_profile&id=1` |
| Viewport | both |
| Source | `Classifieds > Blake Sullivan's profile` |
| Mock | `Classifieds > Blake Sullivan` |
| Note | `<title>` matches exactly on both (`Public profile - Blake Sullivan - Classifieds`); only the last crumb differs |
| Impact | Structural copy drift. Unanchored route, so no evaluator reads it. |
| Screenshots | as DIFF-001 |

---

### DIFF-003 · [P2] · `<body>` carries `has-searchbox` on every page; source emits it only on home + search

| Field | Value |
|-------|-------|
| URL | every route except `/` and `?page=search…` |
| Viewport | both |
| Source | `<body class="item">`, `<body class="user user-items">`, `<body class="contact">`, `<body class="item item-post">`, `<body class="user user-profile">` |
| Mock | `<body class="has-searchbox item">`, `has-searchbox user user-items`, … |
| Source (home/search) | `<body class="has-searchbox home">` / `<body class="has-searchbox search">` — mock matches here |
| Impact | Purely a DOM-attribute difference: grep found no CSS rule keyed on `has-searchbox` in the mock, and the geometry sweep confirms zero visual effect. Only bites a hypothetical `program_html` locator like `body.item`, which still matches (class list contains `item`). |
| Fix hint | `src/components/Layout.jsx:23` — gate `has-searchbox` on `bodyClass` being `home` or `search` |

---

### DIFF-004 · [P2] · Publish form's City select is missing the source's `No value` option

| Field | Value |
|-------|-------|
| URL | `/index.php?page=item&action=item_add` |
| Viewport | both |
| Source | the (disabled) `select[name=cityId]` contains `Select a city...` then `No value` |
| Mock | contains only `Select a city...` |
| Impact | `No value` is an osclass artefact of an empty city row; the select is disabled until a region is chosen on both sides. Invisible to a user. |

---

### DIFF-005 · [P2] · Edit form's already-uploaded image has no `Delete` link

| Field | Value |
|-------|-------|
| URL | `/index.php?page=item&action=item_edit&id=84144` |
| Viewport | both |
| Source | under `Images already uploaded`, the tile reads `84144.jpg` then a `Delete` link |
| Mock | the tile reads `84144.jpg` with no `Delete` |
| Impact | Backed by `page=ajax&action=delete` on the source, which `TODO.md` puts out of scope. Logged because it is a visible affordance the source has and the mock does not. |
| Screenshots | `source_item_edit.1280.png` vs `mock_item_edit.1280.png` |

---

### DIFF-006 · [P2] · Empty `<div class="paginate">` rendered inside `#comments` on item pages with no comments

| Field | Value |
|-------|-------|
| URL | `/index.php?page=item&id=4799` |
| Viewport | both |
| Mock | `.paginate` exists, measured 0x0 |
| Source | no `.paginate` element on this page at all |
| Impact | Zero-size, invisible. Would only matter to a locator counting `.paginate`. |

---

### DIFF-008 · [P2] · Every image-containing box is ~5-6 px taller than the source, shifting all page content down ~10 px

| Field | Value |
|-------|-------|
| URL | every route |
| Viewport | both 1280x720 and 1920x1080 (identical offsets at each) |
| Measured | `#logo > a` **65 px** source / **70 px** mock (its `<img>` is 55 px in both, `margin: 5px 0` in both). `a.listing-thumb` **79** / **85** (`<img>` 79 in both). `.breadcrumb` **18** / **23**. |
| Knock-on | `#main`, `#sidebar`, `.list-header`, `h1` and every `.listing-card` sit `+10 px` lower on the mock on every page; `#sidebar .filters` is `+22 px` taller; gallery cards `+12 px` taller; `#main` up to `+54 px` taller on gallery/item pages |
| Not affected | **all horizontal geometry is exact** — same x, same widths, same fonts, colours, padding and line-heights on all 19 measured selectors x 8 views x 2 viewports |
| Root cause (high confidence) | The stylesheets and the markup are identical; the **doctypes are not**. Source: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" …>` → Chrome **almost-standards mode**, in which a line box containing only images gets no descender leading. Mock (`index.html`): `<!DOCTYPE html>` → full standards mode, so every inline `<img>` picks up ~5 px of baseline descender space under it. (`document.compatMode` is `CSS1Compat` on both — Chrome does not distinguish almost-standards there, which is why this hid from a normal check.) |
| Impact | Purely vertical cosmetics; nothing is clipped, hidden or moved out of reach, and 0 controls failed the hit-test at either viewport. |
| Fix hint | Either copy the source's XHTML 1.0 Transitional doctype into `index.html`, or add `#logo img, .listing-thumb img, .breadcrumb img { vertical-align: middle }` (or `display:block`). Verify by re-running the geometry probe — `#logo > a` should return to 65 px. |
| Screenshots | most visible on `source_search_gallery.1920.png` vs `mock_search_gallery.1920.png` |

---

### DIFF-009 · [P2] · Sort / layout-toggle links rebuild the query in a different parameter order

| Field | Value |
|-------|-------|
| URL | `/index.php?page=search&sCategory=9&iPage=124&sOrder=i_price&iOrderType=asc&sShowAs=gallery` → click `Newly listed` |
| Viewport | both |
| Source href | `…?page=search&sCategory=9&iPage=124&sOrder=dt_pub_date&iOrderType=desc&sShowAs=gallery` |
| Mock URL | `…?page=search&sCategory=9&sOrder=dt_pub_date&iOrderType=desc&sShowAs=gallery&iPage=124&sid=…` |
| Impact | **Same parameter set, same values** — only the order differs, and the mock correctly keeps `iPage` and `sShowAs` (the behaviour that actually matters, and that the recon flagged). WebArena's `url_match` parses the query rather than comparing the raw string, so this does not cost a task. Logged only because an exact-string comparison would see it. |

---

### NON-BUG · currency-symbol mojibake runs the other way

`item_add` / `item_edit` currency select: the **source** renders `â‚¬` and `Â£`
(double-encoded UTF-8); the **mock** renders the correct `€` and `£`. The mock is
"wrong" only in the sense of being more correct. USD `$` — the only currency any
task uses — is identical on both. Not reported as a bug.

---

## 5. Scope notes

**What I compared in a browser:** 19 views x 2 viewports on **both** sides =
38 matched screenshot pairs (76 PNGs) in
`/webarena/CUA-Gym-Hub/websites/webarena_classifieds_mock/assets/screenshots/diff/`.
I read 13 of those pairs visually myself (home, search_list, search_gallery@1920,
search_deep, search_empty, item_comment, item_add, item_edit, user_profile,
pub_profile, user_items@1920 and their counterparts); the remaining pairs were
covered by the programmatic geometry probe, the innerText diff and the aligned
pixel-diff above, all three of which were clean.

**Source access was read-only.** One `page=login&action=login_post` POST to
become `blake.sullivan@gmail.com` (the mechanism `SOURCE.md` documents); after
that every source request was a GET. No listing was published, edited, deleted,
commented on or reported on the source, and no profile/contact/alert form was
submitted there. All write flows were exercised on the mock only, under
dedicated sids (`ix_s4`, `ix2_1280`, `ix2_1920`, `ev_s4`, `ev2_s4`, `vl_s4`,
`rt_s4`). Two `docker exec … grep/sed` reads of `/usr/src/myapp` were used to
quote the source's PHP for BUG-A/BUG-B/BUG-C — reads only, no container change.

**Deliberately not reported**, per the shard brief and `AUDIT.md`: the empty
`#contact-in` panel; the empty `#sidebar` on `pub_profile&id=1`; image upload not
persisting; related listings differing (source `RAND()` — confirmed as the cause,
the mock's picks are stable and same-category); the mojibake seller names; the
entity-escaped title on item 84153 (`Spacious &amp; Modern`, visible on
`user_items` and `pub_profile`); publish landing on the category search page;
unauthorised edit/delete refusing to mutate; the `osclass` → `osclazz` wordmark;
and the six P2s already open in `AUDIT.md` (of which HANDLERS-012 / `iPagesize`
was re-confirmed live and is noted in §2 for the record).

**Not in this shard's scope** (covered by the other two agents): the ROUTES.md
cold-deep-link sweep, the `assets/task_anchors.md` anchor sweep and task replay,
`?sid=` round-tripping as a dedicated pass, `/go` `state_diff` and session
isolation. I did observe incidentally that `sid` survived all 69 navigations,
redirects and form submits I performed, and that `/go`-visible state
(newItems, itemOverrides, deletedItemIds, comments, alerts, marks, user) changed
as expected after each mutation.

## 6. Priority roll-up for the dev agent

| id | pri | one-line |
|---|---|---|
| **BUG-A** | **P1** | Validation messages on 7 forms render into a `display:none` `#error_list` — every invalid submit is a silent no-op |
| **BUG-B** | **P1** | Change-password accepts a wrong current password (`Password has been changed`); mismatched new passwords fail silently |
| **DIFF-001** | **P1** | `pub_profile` is missing the `Edit item` / `Delete` admin options the source renders on all 10 cards |
| **DIFF-002** | **P1** | `pub_profile` breadcrumb: `Blake Sullivan` vs source `Blake Sullivan's profile` |
| BUG-C | P2 | Change-email does not reject an address already in use |
| DIFF-003 | P2 | `has-searchbox` body class emitted on every page instead of home + search only |
| DIFF-004 | P2 | Publish form's City select missing the source's `No value` option |
| DIFF-005 | P2 | Edit form's uploaded image has no `Delete` link |
| DIFF-006 | P2 | Empty 0x0 `.paginate` inside `#comments` on comment-less items |
| DIFF-007 | P2 | Invalid `sOrder` falls back to `dt_pub_date desc`; source drops ORDER BY and blanks the sort label |
| DIFF-008 | P2 | `<!DOCTYPE html>` vs the source's XHTML Transitional → +5 px under every image, +10 px content shift site-wide |
| DIFF-009 | P2 | Sort / layout-toggle links rebuild the query in a different param order (same set, same values) |

**0 P0.** Both P1 bugs and both P1 diffs are fixable without touching the seed.

---

## Fix pass — FORMS

> Agent: dev FIX shard **FORMS**, 2026-08-08.
> Owned: `public/css/mock.css`, `src/pages/ItemForm.jsx`, `src/pages/Contact.jsx`,
> `src/components/item/SendFriend.jsx`, `src/components/item/Comments.jsx`,
> `src/pages/user/{ChangePassword,ChangeEmail,ChangeUsername,Profile}.jsx`.
> Verified in headless chromium against the real tree on `:5192`, at **both**
> 1280x720 and 1920x1080, hit-testing every control with `elementFromPoint`.
> **101 assertions x 2 viewports, 0 failures, 0 console/page errors.**
> `npm run build` — **PASS**.

| id | pri | status | one-line |
|---|---|---|---|
| **BUG-A** | P1 | **FIXED** | All 7 forms now report validation visibly; one CSS mechanism for the 5 jquery-validate forms, source-faithful flashes for the 3 `page=user` forms |
| **BUG-B** | P1 | **FIXED** | Wrong current password is refused (`Current password doesn't match`) and writes no state; mismatched new passwords now say so |
| **BUG-C** | P2 | **FIXED** | `The specified e-mail is already in use` |
| **DIFF-005** | P2 | **FIXED** | Image `Delete` control added; the two uploader stylesheets the mock never copied were ported, so the tile is the source's 200 px again |

### BUG-A — root-cause fix, one mechanism

`style.css:267` (`display:none`) is left untouched, as required. What the mock was
missing is the *imperative* half of the source's behaviour: jquery.validate calls
`.show()` on `errorLabelContainer` when it holds errors and `.hide()` when it does
not. That is expressed declaratively in `public/css/mock.css`:

```css
#error_list:not(:empty),
.error_list:not(:empty),
#comment_error_list:not(:empty) { display: block; }
```

Higher specificity than line 267 **and** later in the cascade (`index.html` loads
`mock.css` last), so it wins either way. The container is `:empty` exactly when
React renders it with zero children, i.e. exactly when there is nothing to report
— so the box appears on an invalid submit and disappears again on a valid one, with
no per-form code. It covers every form that owns one of these containers, including
`PublicProfile.jsx`, which this shard does not own.

Two components also gained the `<label class="error">` wrapper jquery.validate
emits under `wrapper: "li"` (`Comments.jsx`, `SendFriend.jsx`) — they were emitting
a bare `<li>`, which `style.css:269` does not style.

**The three `page=user` forms were checked against the source rather than assumed.**
`controller/user.php:139-234` shows they do **not** use jquery.validate at all:
`user-change_{email,username,password}.php` each render an inert
`<ul id="error_list"></ul>` and every failure is
`osc_add_flash_error_message(...)` + `redirectTo(<same page>)`. So those three now
flash and leave the inline list permanently empty — verified: `#error_list` height
is `0` on all three after a failed submit, while `#flashmessage` is hit-tested
visible.

Measured after the fix (1280 shown; 1920 identical):

| form | box | before | after | first `<li>` hit-tested |
|---|---|---|---|---|
| Publish | `#error_list` | 532x**0** | 532x**134** | ✅ |
| Edit | `#error_list` | 532x**0** | 532x**68** | ✅ |
| Comment | `#comment_error_list` | 600x**0** | 600x**46** | ✅ |
| Contact | `#error_list` | 440x**0** | 440x**46** | ✅ |
| Share | `#error_list` | 440x**0** | 440x**90** | ✅ |
| Change e-mail | `#flashmessage` | — | 980x**60** `.flashmessage-error` | ✅ |
| Change username | `#flashmessage` | — | 980x**60** `.flashmessage-error` | ✅ |
| Change password | `#flashmessage` | — | 980x**60** `.flashmessage-warning` | ✅ |

Every message string listed in the BUG-A table now appears in
`page.innerText('body')`, verbatim. The box re-hides on a valid submit (checked on
contact), and the copy was not touched — it was already right.

### BUG-B — the current-password check

`user.php:207-234` ported branch for branch, in the source's own order: blank →
**warning** `Password cannot be blank`; wrong current → `Current password doesn't
match`; mismatch → `Passwords don't match`; success → `Password has been changed`
+ redirect to profile. (`Passwords can't be empty` is dead code on the source too —
the blank check above it already catches it.)

Verification of the mutation footprint, which is the part BUG-B called out:

```
typed='WRONG'   -> flash "Current password doesn't match"
typed='hunter2' -> flash "Current password doesn't match"
typed=''        -> flash "Password cannot be blank"
state_diff after 3 rejected attempts: {}          <-- was: a spurious user change
user.passwordChanges: None | user.passwordHash: None

after a VALID change:
keys ADDED to user: {"passwordChanges": 1, "passwordChangedAt": "...", "passwordHash": "1cbde5a0"}
plaintext in the /go payload: none
```

A **second** change is also verified: the old password is now rejected and the new
one accepted, so the flow is not a one-shot. How the check works without storing a
secret — and the compromises it carries — is written up in **SCHEMA.md**
(`user.passwordHash`). Short version: the source stores a hash, so the mock stores a
hash; the seeded value is a constant *digest* of the credential SOURCE.md documents,
so no plaintext exists in the state **or** in the source tree, and
`session_seed.json` was not modified.

### BUG-C — and the rest of the `user.php` branches

`change_email` now rejects an address already in use (one user row, so: your own),
and keeps the source's happy path exactly — redirect to `action=profile` with **no**
flash. `osc_validate_email()` (`hValidate.php:257-307`) was ported rule for rule
rather than approximated with one regex.

While matching `change_username` to the source, the other two branches of the same
`if` came with it: `The specified username is already in use` and `The specified
username is not valid, it contains some invalid words` (`osc_is_username_blacklisted`
rejects digits-only names plus the deployment's `username_blacklist` = `admin,user`,
read from `oc_t_preference`). The stored value now goes through
`osc_sanitize_username()`. All three verified in the browser.

### DIFF-005 — image `Delete`

The anchor is the source's, verbatim
(`class="qq-upload-delete" href="#" photoid itemid style="display: inline; cursor:pointer;"`),
with its inline handler's behaviour: `confirm("This action can't be undone. Are you
sure you want to continue?")` → tile removed; cancel leaves it. The POST to
`page=ajax&action=delete_image` stays out of scope per TODO.md (listing photos are
static files; there is no image state to mutate). `photoname` / `photosecret` are
omitted rather than fabricated.

Chasing the *other* half of this finding ("a shorter image tile", 63 px) turned up
the actual cause: **`item_post` / `item_edit` are the only routes where the source
loads two stylesheets the mock never copied** —
`assets/js/fineuploader/fineuploader.css` and `themes/sigma/css/ajax-uploader.css`
(both in the `<link>` list of `assets/html/item-edit-84144.html`). `ItemForm.jsx`
had been compensating with hand-guessed inline styles. The rules that paint the
uploader are now in `mock.css`, copied verbatim and in source order, and the inline
guesses are gone:

| selector | was (guessed) | now | source |
|---|---|---|---|
| `li.qq-upload-success` | 145x**152** | 175x**200** | `height: 200px` |
| `span.qq-upload-file` | inline, 13px | **block**, 16px, 145px wide | `display:block; width:145px; height:1em` |
| `a.qq-upload-delete` | absent | inline, **12px**, `#000` | `font-size:12px; font-weight:normal` |
| `.ajax_preview_img` | 1px #fff | 125x125, white, 2px #777 | ajax-uploader + `style.css:571` |

The three theme rules that outrank both sheets on the source
(`body #restricted-fine-uploader`, `body .qq-upload-button`, `body .ajax_preview_img`)
still win here by specificity, so loading the port *after* `style.css` reproduces the
same cascade. Side-by-side against `source_item_edit.1280.png`: the block filename,
the small dark `Delete` beneath it and the white-bordered preview now match.

### Regression guard — comments (31 `program_html` tasks)

Re-run end to end **at both viewports**, 3 posts per viewport with a star rating each:

- rating stars 5 / 4 / 1 → hidden `input[name=rating]` carried the right value each time
- `.comments_list h3` read `Question by Blake Sullivan:`, `Nice car by Blake Sullivan:`,
  `Third one by Blake Sullivan:` — the `{title} by {author}:` contract holds
- `(5 of 5)` / `(4 of 5)` / `(1 of 5)` rendered; `Your comment has been approved` flashed
- 1 seeded + 3 posted = 4 in `.comments_list` **and** 4 in `state.comments`, and `/go`
  `state_diff` saw them
- `#comment_error_list` measured **0 px on every successful post** — the reveal does not
  leak onto the happy path
- a whitespace-only body is still refused, now visibly, and does **not** post

Publish was re-run too (flash + redirect to `page=search&sCategory=9` + no stray error
box). **No valid submit is blocked by any change in this pass.**

### Note for whoever owns `index.html`

Mid-pass, `index.html` was switched to the source's XHTML 1.0 Transitional doctype for
DIFF-008. Vite parses `index.html` with parse5, which rejects it
(`non-conforming-doctype`): `npm run dev` 500s on every route and `npm run build` exits
1. Reverted by its owner after being flagged; DIFF-008 should be closed with that
finding's own `vertical-align: middle` alternative instead. Recorded here so the
doctype route is not retried.
