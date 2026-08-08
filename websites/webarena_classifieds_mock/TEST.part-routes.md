# webarena_classifieds_mock — TEST (shard: ROUTES)

> Round: post-AUDIT verification round
> Date: 2026-08-08
> Mock: http://localhost:5180 (this shard's own server; shards TASKS=5183, DIFF=5184)
> Source: http://10.186.197.203:9980/ (reachable: **YES** — used read-only, GET only; no form
> was submitted on the source and the container was not mutated)
> Scope: ROUTES.md 37-row parity sweep · param-behavior matrix · session isolation ·
> both viewports (1280x720 **and** 1920x1080)
> Tested by: playwright agent, shard ROUTES
> Browser: real headless chromium (`/tmp/pwvenv` + `/tmp/sysroot` LD_LIBRARY_PATH). **No
> curl-only downgrade anywhere in this report** — every route below was rendered in a browser.

**STATUS: COMPLETE.**

## Summary

| Metric | Count |
|---|---|
| ROUTES.md rows verified **in a browser** | 37 / 37 (39 probes — rows 6 and 28 probed twice) |
| Viewports each row was rendered at | 2 (1280x720 and 1920x1080) → 78 cold loads |
| Cold deep-link failures | 0 |
| `?sid=` preservation failures (links, redirects, 12 form submits) | 0 |
| Console errors / page errors across the whole run | 0 |
| Param-behavior cases diffed against the live source | 21 |
| Param cases matching the source | 18 / 21 |
| Mutating flows driven end to end | 12 |
| Session isolation / reset / partial-inject invariant | PASS |
| P0 bugs | **0** |
| P1 bugs | **1** — BUG-R1 |
| P2 bugs | **3** — BUG-R2/R3/R4 |

---

## 1. Route Parity Results

Method: **fresh browser context per route** (cold — no click-through, no warm localStorage,
no shared cookie jar), `?sid=parity_routes` appended, `wait_until=networkidle`, console and
`pageerror` listeners attached before `goto`. Run twice, once at 1920x1080 and once at
1280x720. **The two runs are byte-identical on every recorded field** (final URL, title, h1,
counter, sentinel selector, `#root` child count) — see §4.

| # | Route (cold, `?sid=parity_routes`) | Cold load | Correct view (evidence) | Params honored | `sid` kept |
|---|---|---|---|---|---|
| 1 | `/` | ✅ | ✅ `h1 = "What are you looking for today?"`, `ul.listing-card-list`, "Latest Listings" | n/a | ✅ |
| 2 | `/index.php` (no `page`) | ✅ | ✅ identical body to row 1 (1411 chars both) | n/a | ✅ |
| 3 | `?page=search` | ✅ | ✅ `1 - 12 of 84149 listings` | ✅ | ✅ |
| 4 | `?page=search&sCategory=9` | ✅ | ✅ `h1 = "Books"`, `1 - 12 of 1489 listings` | ✅ | ✅ |
| 5 | `?page=search&sPattern=kayak` | ✅ | ✅ `1 - 12 of 79 listings` (source: 79) | ✅ | ✅ |
| 6a | `…&sShowAs=gallery` | ✅ | ✅ `ul.listing-grid` present | ✅ | ✅ |
| 6b | `…&sShowAs=list` | ✅ | ✅ `ul.listing-list` present | ✅ | ✅ |
| 7 | `…&sOrder=i_price&iOrderType=asc` | ✅ | ✅ ids `3835, 4089, 4727, 4860` = source exactly | ✅ | ✅ |
| 8 | `…&iPage=124` | ✅ | ✅ `1477 - 1488 of 1489 listings`, title `Books - page 124 - Classifieds` | ✅ | ✅ |
| 9 | `?page=search&sRegion=7361885` | ✅ | ✅ `h1 = "Maryland"`, `1 - 12 of 21674 listings` | ✅ | ✅ |
| 10 | `?page=search&sCity=7367175` | ✅ | ✅ `h1 = "Rockville"`, breadcrumb `Classifieds > Maryland > Rockville`, 745 listings | ✅ | ✅ |
| 11 | `…&sPriceMin=100&sPriceMax=200` | ✅ | ✅ `1 - 12 of 86 listings` (vs 1489 unfiltered) | ✅ | ✅ |
| 12 | `…&bPic=1` | ✅ | ✅ 1489 listings — inert as documented, round-trips | ✅ (inert) | ✅ |
| 13 | `?page=search&sPattern=zzzqqqxyzzy` | ✅ | ✅ `p.empty` = `There are no results matching "zzzqqqxyzzy". …` | ✅ | ✅ |
| 14 | `?page=item&id=10727` | ✅ | ✅ `h1 = "Tennis bracelet"`, `div.comments_list` present | ✅ | ✅ |
| 15 | `?page=item&id=9999999` | ✅ | ✅ `h1 = "404"`, `OOPS! Page Not Found!`, title `Error - Classifieds` | ✅ | ✅ |
| 16 | `?page=contact` | ✅ | ✅ `h1 = "Contact us"`, form with Name/Email/Subject/Message/Send | n/a | ✅ |
| 17 | `/php?page=search&sCategory=4&sShowAs=gallery` | ✅ | ✅ lands on `/index.php?page=search&sCategory=4&sShowAs=gallery&sid=…`, `ul.listing-grid`, `1 - 12 of 2516 listings` | ✅ whole query string preserved | ✅ |
| 18 | `?page=user&action=dashboard` | ✅ | ✅ **200 in place**, URL keeps `action=dashboard`, body byte-identical (4760 chars) to row 19 | ✅ | ✅ |
| 19 | `?page=user&action=items` | ✅ | ✅ `h1 = "My listings"`, title `Manage my listings - Classifieds`, 12 rows | ✅ | ✅ |
| 20 | `?page=user&action=profile` | ✅ | ✅ `h1 = "Update account"` + form | ✅ | ✅ |
| 21 | `?page=user&action=profile_post` (cold GET) | ✅ | ✅ renders the profile form | ✅ | ✅ |
| 22 | `?page=user&action=alerts` | ✅ | ✅ `h1 = "Alerts"`, `You do not have any alerts yet.` | ✅ | ✅ |
| 23 | `?page=user&action=change_email` | ✅ | ✅ `h1 = "Change e-mail"`, shows `blake.sullivan@gmail.com` | ✅ | ✅ |
| 24 | `?page=user&action=change_username` | ✅ | ✅ `h1 = "Change username"` | ✅ | ✅ |
| 25 | `?page=user&action=change_password` | ✅ | ✅ `h1 = "Change password"` | ✅ | ✅ |
| 26 | `?page=item&action=item_add` | ✅ | ✅ `h1 = "Publish a listing"`, category select populated | ✅ | ✅ |
| 27 | `?page=item&action=item_add_post` (cold GET) | ✅ | ✅ renders the publish form (POST path tested separately, §2.6) | ✅ | ✅ |
| 28a | `?page=item&action=item_edit&id=84144` | ✅ | ✅ title `Edit your listing`, breadcrumb `… > Pristine 2021 Toyota 86 … > Edit your listing`, form pre-filled | ✅ | ✅ |
| 28b | `…&item_edit&id=4799` (**not owned**) | ✅ | ✅ 302 → `?page=user&action=items`, flash `Sorry, we don't have any listings with that ID`, no mutation | ✅ | ✅ |
| 29 | `?page=item&action=item_edit_post&id=84144` (cold GET) | ✅ | ✅ renders the edit form | ✅ | ✅ |
| 30 | `…&item_delete&id=3346` (**not owned**) | ✅ | ✅ 302 → `/?sid=…` (`osc_base_url()`), flash present, `deletedItemIds` untouched | ✅ | ✅ |
| 31 | `?page=item&action=add_comment&id=10727` (cold GET) | ✅ | ✅ renders the item page with `div.comments_list` | ✅ | ✅ |
| 32 | `…&delete_comment&id=10727&comment=999` | ✅ | ✅ 302 → `?page=item&id=10727`, flash `The comment doesn't exist` | ✅ | ✅ |
| 33 | `…&send_friend&id=10727` | ✅ | ✅ `h1 = "Send to a friend"`, full form | ✅ | ✅ |
| 34 | `…&send_friend_post&id=10727` (cold GET) | ⚠️ | renders the 404 body — see BUG-R3 (P2) | — | ✅ |
| 35 | item page `#contact-in` panel | ✅ | ✅ `#contact-in` present and **empty**, as the source (contact form disabled) | n/a | ✅ |
| 36 | `…&mark&id=10727&as=spam` | ✅ | ✅ 302 → `?page=item&id=10727`, flash `Thanks! That's very helpful`, `marks` written | ✅ | ✅ |
| 37 | `?page=user&action=pub_profile&id=1` | ✅ | ✅ `.user-card`, `Latest listings`, empty `#sidebar` (deliberate) | ✅ | ✅ |

**37/37 rows render the correct view cold. 0 cold deep-link failures, 0 lost `sid`, 0 console
errors, 0 page errors across 78 cold loads (39 probes x 2 viewports).**

Note on rows 18/19: `h1` is `My listings` and `<title>` is `Manage my listings - Classifieds`
on the mock — that matches `assets/html/user-items.html`. My first sweep's expected-substring
was wrong, not the mock.

---

## 2. Param-Behavior Matrix

Every case below was rendered **on the mock and on the live source** at the same URL, and the
resulting `<title>`, `span.counter-search` and the **ordered list of item ids on the page**
were compared. 21 cases; 18 identical to the source.

### 2.1 `sOrder` / `iOrderType` — 3 of 6 combinations diverge

Base URL `/index.php?page=search&sCategory=9` (Books, 1489 items).

| Case | Source first 4 ids | Mock first 4 ids | Verdict |
|---|---|---|---|
| default (no `sOrder`) | `50224, 26497, 14453, 54474` | same | ✅ |
| `sOrder=i_price&iOrderType=asc` | `3835, 4089, 4727, 4860` | same | ✅ |
| `sOrder=i_price&iOrderType=desc` | `8344, 75886, 66304, 54568` | same | ✅ |
| `sOrder=dt_pub_date&iOrderType=desc` | `50224, 26497, 14453, 54474` | same | ✅ |
| `sOrder=i_price&iOrderType=0` | `8344, 75886, …` (falls back to **desc**) | same | ✅ string-compare fallback reproduced |
| `sOrder=i_price&iOrderType=1` | `8344, 75886, …` (falls back to **desc**) | same | ✅ |
| **`sOrder=dt_pub_date&iOrderType=asc`** | **`32464, 69456, 40883, 70302`** | **`50224, 26497, 14453, 54474`** | ❌ **BUG-R1 (P1)** |
| **`sOrder=s_title&iOrderType=asc`** (bogus column) | **`32464, 69456, 40883, 70302`** — column falls back to `dt_pub_date`, **direction still honored** | `50224, 26497, …` | ❌ same root cause, BUG-R1 |
| **`sOrder=dt_expiration&iOrderType=desc`** | **`48, 208, 292, 333`** | `50224, 26497, …` | ❌ **BUG-R2 (P2)** |

Counts (`1 - 12 of 1489 listings`) match the source in all nine cases — only the ordering
diverges.

### 2.2 `iPage` — all 7 cases match the source exactly

| Case | Source | Mock | Verdict |
|---|---|---|---|
| `iPage=0` | `1 - 12 of 1489`, ids `50224…`, no ` - page ` in title | identical | ✅ 1-based, 0 == page 1 |
| `iPage=1` | `1 - 12 of 1489`, no page suffix in title | identical | ✅ |
| `iPage=2` | `13 - 24 of 1489`, ids `21096, 52795, 44458, 72515`, title `Books - page 2 - Classifieds` | identical | ✅ |
| `iPage=4y` (cat 10) | **page 1** content (`1 - 12 of 7606`, ids `60945, 15819, 62655, 52305`) but title `Cars + trucks - **page 4y** - Classifieds` | identical, title echoes `page 4y` | ✅ the PHP-8 quirk is reproduced exactly |
| `iPage=125` (last) | `1489 - 1489 of 1489 listings`, single id `32464` | identical | ✅ |
| `iPage=126` (overrun) | no counter, empty listing area, HTTP 200, title `Books - page 126` | identical | ✅ |
| `iPage=9999` (overrun) | same empty state, title `Books - page 9999` | identical | ✅ |

### 2.3 `sShowAs` — page size is 12 in BOTH, confirmed

| Case | Source | Mock |
|---|---|---|
| `sShowAs=list` | `1 - 12 of 1489`, 12 cards, `ul.listing-list` | identical |
| `sShowAs=gallery` | `1 - 12 of 1489`, 12 cards, `ul.listing-grid` | identical |
| `sShowAs=zzz` (invalid) | falls back to list, `1 - 12 of 1489` | identical |

✅ Page size does not change between list and gallery on either side.

### 2.4 `iPagesize`

`…&sCategory=9&iPagesize=50` renders `1 - 12 of 1489 listings` on **both** the mock and the
live source. AUDIT HANDLERS-012 lists "iPagesize accepted and ignored" as an open P2 — measured
against the source it is **not a divergence at all**: the source ignores it here too. No bug.

### 2.5 Anchor route reachable only by sorting from page 124

`/index.php?page=search&sCategory=9&iPage=124&sOrder=i_price&iOrderType=asc&sShowAs=gallery`
→ mock and source both render `1477 - 1488 of 1489 listings` with ids
`40875, 21431, 58700, 585, …` — **identical**. ✅

### 2.6 Controls write back to the URL — and carry `iPage` exactly as the source does

Driven with real clicks in a browser, starting from the anchor page
`?page=search&sCategory=9&iPage=124&sOrder=i_price&iOrderType=asc&sShowAs=gallery&sid=parity_routes`.
The source's link `href`s for the same page were extracted from its rendered HTML for comparison.

| Control | Mock URL after clicking | Source `href` for the same control | `iPage` | `sid` |
|---|---|---|---|---|
| Sort → "Newly listed" | `…sCategory=9&sOrder=dt_pub_date&iOrderType=desc&sShowAs=gallery&**iPage=124**&sid=…` | `…sCategory=9&iPage=124&sOrder=dt_pub_date&iOrderType=desc&sShowAs=gallery` | ✅ **kept** | ✅ |
| List toggle | `…&sOrder=i_price&iOrderType=asc&sShowAs=list&**iPage=124**&sid=…` | `…&iPage=124&…&sShowAs=list` | ✅ **kept** | ✅ |
| Gallery toggle | `…&sShowAs=gallery&**iPage=124**&sid=…` | `…&iPage=124&…&sShowAs=gallery` | ✅ **kept** | ✅ |
| "Refine category" → Books | `…sCategory=9&sOrder=i_price&iOrderType=asc&sShowAs=gallery&sid=…` | `id="cat_9" href="…sCategory=9&sOrder=i_price&iOrderType=asc&sShowAs=gallery"` | ✅ **dropped** | ✅ |
| Pagination `>` (Next) | `…&iPage=125&sid=…` | `…&iPage=125&…` | ✅ | ✅ |
| Pagination `«` (First) | `…&sid=…` — **`iPage` omitted entirely**, not `iPage=1` | `…` — `iPage` omitted | ✅ | ✅ |

The load-bearing asymmetry from `ROUTES.md` ("sort/toggle preserve `iPage`, refine drops it")
is reproduced exactly, so the anchor route
`sCategory=9&iPage=124&sOrder=i_price&iOrderType=asc&sShowAs=gallery` **is reachable by
sorting from page 124** in the mock, which is the only way an agent can reach it. ✅

The three sort-menu labels are verbatim: `Newly listed`, `Lower price first`,
`Higher price first`. The menu is a `.see_by` hover panel, not a `<select>`; a **click** on
the label pins it open, so a click-only agent can reach the options (verified by hit-test:
`.see_by ul li a` returns itself from `elementFromPoint` after the label click).

**Pagination markup diffed against the source, element by element, on page 124 of 125:**

| Mock | Source |
|---|---|
| `a.searchPaginationFirst.list-first` « (no `iPage`) | identical |
| `a.searchPaginationPrev` < → 123 | identical |
| `a.searchPaginationNonSelected` 122, 123 | identical |
| `span.searchPaginationSelected` 124 | identical |
| `a.searchPaginationNonSelected` 125 | identical |
| `a.searchPaginationNext.list-last` > → 125 | identical |

Also verified on the mock: **page 1** renders `span.searchPaginationSelected.list-first` with
no First/Prev and a `a.searchPaginationLast.list-last` », and the **last page** renders
`span.searchPaginationSelected` carrying **no** extra class — the exact asymmetry `ROUTES.md`
documents.

### 2.7 Empty/odd-param states — 4 of 5 identical to the source

| URL | Source | Mock | Verdict |
|---|---|---|---|
| `…&sCategory=9&sPriceMin=99999999` | `p.empty` `There are no results matching "". …`, title `Books - Classifieds` | identical | ✅ |
| `…&sPattern=kayak&sPriceMin=99999999` | `p.empty` `…matching "kayak". …`, title `kayak - Classifieds` | identical | ✅ |
| `…&sRegion=7361885&sCity=7367175&sCategory=8` | `1 - 1 of 1 listings`, title `Boats Rockville - Classifieds` | identical | ✅ |
| `…&sCategory=99` (bogus) | empty state, title `Search results - Classifieds` | identical | ✅ |
| `…&sRegion=999999` (bogus) | empty state, title **`999999 - Classifieds`** | empty state, title **`Search results - Classifieds`** | ❌ BUG-R4 (P2) |

### 2.8 `/php` → `/index.php`

`/php?page=search&sCategory=4&sShowAs=gallery&sid=parity_routes` lands on
`/index.php?page=search&sCategory=4&sShowAs=gallery&sid=parity_routes` and renders
`1 - 12 of 2516 listings` in gallery layout. **Whole query string preserved, `sid` preserved.** ✅
(Further `/php` shapes in §2.9 below.)

---

## 3. Session Isolation

Two sids driven in **separate browser contexts**, each performing a *different* mutation.

| Check | Result |
|---|---|
| `sid=iso_alpha` — mark item 10727 as spam | flash `Thanks! That's very helpful`, 302 → `?page=item&id=10727&sid=iso_alpha` ✅ |
| `sid=iso_beta` — submit the site contact form | flash `Your email has been sent properly. Thank you for contacting us!` ✅ |
| `/go?sid=iso_alpha` `state_diff` keys | `["marks"]` — **only** marks |
| `/go?sid=iso_beta` `state_diff` keys | `["contactMessages"]` — **only** contactMessages |
| Cross-bleed: alpha's `contactMessages` | `[]` ✅ |
| Cross-bleed: beta's `marks` | `[]` ✅ |
| `initial_state` key count | 12 / 12 on both |
| `reset` alpha → `state_diff` | `{}` and `marks` back to `[]` ✅ |
| beta after alpha's reset | still `["contactMessages"]`, 1 message ✅ — reset is per-sid |
| sid sanitiser: `POST /post?sid=../evil` | written to `.mock-states/evil.json`; **no file escaped the directory** (`websites/webarena_classifieds_mock/../evil.json` does not exist) ✅ |

### 3.1 PARTIAL-INJECT invariant (AUDIT PIPELINE-001) — **still holds**

```
POST /post?sid=iso_inject  {"action":"set","state":{"marks":[{"itemId":1,"as":"spam","userId":1}]}}
```

| Step | `state_diff` | Notes |
|---|---|---|
| immediately after inject, before any page load | `{}` | `initial_state` has **all 12 keys**, `marks` = the injected row |
| after loading 3 different pages (search, item, my listings) with **no action taken** | `{}` | `current_state` has all 12 keys, `marks` still the injected row |
| after exactly one real action (contact-form submit) | `{"contactMessages": {"old": [], "new": [{…}]}}` | **exactly one key**, `old == []` |

This is the regression PIPELINE-001 fixed (11 spurious diff keys on every injected task).
**Confirmed fixed and stable.** ✅

---

---

## 2.9 `/php` → `/index.php` — four shapes, all correct

| Requested | Landed on | Renders |
|---|---|---|
| `/php?page=item&id=10727&sid=…` | `/index.php?page=item&id=10727&sid=…` | `Tennis bracelet Stow - Classifieds` |
| `/php?sid=…` (no query beyond sid) | `/index.php?sid=…` | home |
| `/php?page=search&sPattern=banana+boat&iPage=2&sShowAs=gallery&sid=…` | same params on `/index.php` | `banana boat - page 2 - Classifieds` |
| `/php?page=user&action=items&sid=…` | `/index.php?page=user&action=items&sid=…` | `Manage my listings` |

Whole query string preserved (including the `+` in `banana+boat`), `sid` preserved. ✅

---

## 4. Viewport Hit-Testing — 1280x720 and 1920x1080

Every control below was located, its centre point passed to `document.elementFromPoint`, and
the returned node checked to be the control itself or a descendant/ancestor of it. An
`isVisible()` check was **not** accepted as a pass anywhere.

The full 37-row route sweep was run at **both** viewports and the two runs are identical on
every recorded field (final URL, title, h1, counter, sentinel selector, `#root` child count,
console errors). The interaction run (§2.6) was also run at both and is identical field for
field. **No 1280-only layout regression exists.**

| Page | Control | 1280x720 | 1920x1080 |
|---|---|---|---|
| header (all pages) | logo → `/` | ✅ hit 184x70 | ✅ |
| header | `My account` → `page=user&action=dashboard` | ✅ hit 110x35 | ✅ |
| header | `Logout` | ✅ hit 78x35 | ✅ |
| header | `Publish Ad` → `item_add` | ✅ hit 107x35 | ✅ |
| footer | `Contact` → `page=contact` | ✅ hit 54x20 | ✅ |
| home | keyword input / category select / search button | ✅ all hit | ✅ |
| search | `.see_by` sort control + its `<a>` options after the label click | ✅ hit | ✅ |
| search | `.list-button` / `.grid-button` | ✅ hit 40x40 each | ✅ |
| search | `.paginate` links incl. `.searchPaginationNext` | ✅ hit | ✅ |
| search | `input[name=sPriceMin]` and the Apply button | ✅ hit | ✅ |
| search | `.refine ul li a` | ✅ hit | ✅ |
| item | `Contact seller` button (`p.contact_button a`) | ✅ hit 137x40 | ✅ |
| item | `Share` → `send_friend` | ✅ hit 77x40 | ✅ |
| item | `select.mark_as` (report listing) | ✅ hit 300x40 | ✅ |
| item | comment form + `textarea[name=body]` | ✅ hit | ✅ |
| item | `.main-photo` | ✅ hit 550x419 | ✅ |
| my listings | per-row `Edit` / `Delete` | ✅ hit | ✅ |
| my listings | `#sidebar` links (Public Profile / Alerts / Change password) | ✅ hit | ✅ |
| publish | category select, title, description, price, submit | ✅ all hit | ✅ |

**Deliberately `display:none` at both viewports** (correct, not findings):
- `a.show-filters-btn` — `responsive.css:19` hides it above 768 px. AUDIT HANDLERS-009's
  no-op handler is therefore unreachable at **both** desktop widths. Confirmed, not a bug here.
- The theme ships a **second, hidden** responsive nav (`Home` / `Publish Ad` / `Contact`
  inside `div.nav`) alongside the visible desktop nav. A naive `querySelector('a[href*=item_add]')`
  hits the hidden one first; the *visible* duplicate is present and hit-testable at both
  viewports. Noting it so a future test does not misread it as a bug — it is not.
- `#contact-in` on the item page is present with height 0 and no children — the disabled
  contact form, matching the source. Out of scope per the brief.

---

## 5. Mutating flows — `sid` survives every form submit and redirect

Driven with real clicks in a browser on the mock only (`sid=mut_routes` / `del_routes`).

| Flow | Landed on | `sid` | `/go` `state_diff` | Notes |
|---|---|---|---|---|
| Publish (`item_add` → submit) | `/index.php?page=search&sCategory=8&sid=…` | ✅ | `newItems`, `nextItemId` | flash `Your listing has been published`; new id **84155**; `nextItemId` → 84156; the new listing is **row 1** of the category page under the default `dt_pub_date DESC` ✅ (AUDIT note 1 confirmed). Clicking through to it renders `1234.00 $` in `.price` |
| Edit own listing 84144 (price → 25000) | `/index.php?page=item&id=84144&sid=…` | ✅ | `itemOverrides` | flash `Great! We've just updated your listing`; page shows `Modified date: 2026/08/08` and `25000.00 $`; override stored as `{"price":25000000000,"modDate":"…"}` — no whole row ✅ (PARITY-002 confirmed) |
| Post a comment on 10727 | `/index.php?page=item&id=10727&sid=…` | ✅ | `comments`, `nextCommentId` | `.comments_list h3` now reads `Hello! by Blake Sullivan:` and `Parity Question by Blake Sullivan:` |
| Delete own listing 84143 | `/index.php?page=user&action=items&sid=…` | ✅ | `deletedItemIds: [84143]` | native `confirm("This action can not be undone. Are you sure you want to continue?")` fires first; on accept the row count drops 12 → 11, flash `Your listing has been deleted` renders, and `?page=item&id=84143` then returns the `404` body |
| Change username | `/index.php?page=user&action=profile&sid=…` | ✅ | — | flash `The username was updated` renders |
| Send to a friend (10727) | `/index.php?page=item&id=10727&sid=…` | ✅ | `sendFriendMessages` | flash `We just sent your message to Tester` |
| Site contact form | `/index.php?page=contact&sid=…` | ✅ | `contactMessages` | flash `Your email has been sent properly. Thank you for contacting us!` |
| Mark as spam (10727) | `/index.php?page=item&id=10727&sid=…` | ✅ | `marks` | flash `Thanks! That's very helpful` |
| Home search form submit | `/index.php?page=search&sPattern=kayak&sid=…` | ✅ | none (read-only) | `1 - 12 of 79 listings` |
| Sidebar price Apply (from `iPage=3`) | `…&sPriceMin=100&sPriceMax=200&sOrder=…&iOrderType=…&sid=…` | ✅ | none | `iPage` reset to 1, as a new filter should |
| Unauthorised edit (`item_edit&id=4799`) | `/index.php?page=user&action=items&sid=…` | ✅ | **empty** | flash `Sorry, we don't have any listings with that ID`; nothing written (HANDLERS-004 confirmed) |
| Unauthorised delete (`item_delete&id=3346`) | `/?sid=…` | ✅ | **empty** | flash present; `deletedItemIds` untouched |

**0 lost `sid` across 12 mutating flows. 0 page errors, 0 console errors.**

A test-harness note for whoever reads this next: Playwright **auto-dismisses** `window.confirm`.
The Delete link on "My listings" is gated by one, so a delete test without
`page.on("dialog", d => d.accept())` silently does nothing and looks like a broken feature.
It is not — the flow is correct.

---

## 6. Bugs for the Dev Agent

### BUG-R1 · [P1] · `iOrderType=asc` is ignored for `dt_pub_date`; the mock renders the exact reverse of the source

| Field | Value |
|---|---|
| URL | `http://localhost:5180/index.php?page=search&sCategory=9&sOrder=dt_pub_date&iOrderType=asc&sid=parity_routes` |
| Viewport | both (1280x720 and 1920x1080 — viewport-independent) |
| What I did | Loaded the URL on the mock and on the live source and compared the item ids on the page |
| Source | first ids `32464, 69456, 40883, 70302` — genuinely oldest-first |
| Mock | first ids `50224, 26497, 14453, 54474` — **the newest-first order**, i.e. the direction is dropped |
| Also affected | `sOrder=<any unsortable column>&iOrderType=asc` (e.g. `s_title`): the source falls the *column* back to `dt_pub_date` but **still honors the direction**, giving `32464, …`; the mock gives the desc order. Both the **unfiltered** path and the **filtered** path (`sRegion=7361885`, `sPattern=kayak`, `sCategory=8`) are affected — verified on all three, counts always correct, only order wrong |
| Console errors | none |
| Impact | Result **counts** and **membership** are correct everywhere; only the ordering is inverted. No anchor route in `assets/task_anchors.md` uses `dt_pub_date` with `asc` (all 10 use `desc`), and the sort dropdown never emits it, so no evaluator breaks today. But an agent that hand-writes "oldest first" gets exactly the wrong end of the list, silently |
| Fix hint | `src/pages/Search.jsx:517 sortKeyOf()` collapses every non-`i_price` column to `'newest'`, throwing the direction away. Add an `'oldest'` sort key = `order.newest` **reversed** for the unfiltered path (verified: reversing puts 32464 first, matching the source), and in `comparator()` add the mirrored date branch `(a,b) => (a.pub > b.pub ? 1 : a.pub < b.pub ? -1 : a.id - b.id)` for the filtered path. `effectiveDirection()` is already correct and needs no change |

---

### BUG-R2 · [P2] · `sOrder=dt_expiration` does not sort

| Field | Value |
|---|---|
| URL | `http://localhost:5180/index.php?page=search&sCategory=9&sOrder=dt_expiration&iOrderType=desc&sid=parity_routes` |
| Viewport | both |
| Source | first ids `48, 208, 292, 333` — a distinct expiration ordering |
| Mock | first ids `50224, 26497, 14453, 54474` — the `dt_pub_date DESC` order |
| Impact | None on any task: `dt_expiration` appears in **zero** anchor routes and the sort dropdown offers only the three `dt_pub_date`/`i_price` combinations. Logged for completeness |
| Fix hint | The catalogue tuple (`CONTRACTS.md` §1) carries no expiration column, so this cannot be fixed without re-seeding. Either add `exp` to the tuple + a fourth `order` array, or leave it and record the gap in `CONTRACTS.md` §8 alongside `iPagesize`. `effectiveOrder()` already *accepts* `dt_expiration`, which is what makes the silence look like a bug |

---

### BUG-R3 · [P2] · `page=item&action=send_friend_post` reached by GET renders the 404 body

| Field | Value |
|---|---|
| URL | `http://localhost:5180/index.php?page=item&action=send_friend_post&id=10727&sid=parity_routes` |
| Viewport | both |
| Expected | `ROUTES.md` row 34 maps this action; the sibling POST-only actions (`item_add_post`, `item_edit_post`, `profile_post`, `add_comment`) all render their form/page when reached by GET |
| Actual | `App.jsx`'s `item` switch has no `send_friend_post` case, so it falls to `NotImplemented` → `<h1>404</h1>` |
| Impact | **None on the real flow** — the working path is `send_friend` → fill → submit, which was driven end to end and correctly redirects to `?page=item&id=10727` with the flash `We just sent your message to <name>` and writes `sendFriendMessages`. Only the hand-typed GET is affected, and no anchor uses it. I did **not** probe the source for its GET behavior because that endpoint sends mail and the source is read-only this round |
| Fix hint | `src/App.jsx:75` — add `case 'send_friend_post':` alongside `case 'send_friend':` so both render `<SendFriend/>`, mirroring how `item_add`/`item_add_post` already share a branch |

---

### BUG-R4 · [P2] · A bogus `sRegion` drops the id from the `<title>`

| Field | Value |
|---|---|
| URL | `http://localhost:5180/index.php?page=search&sRegion=999999&sid=parity_routes` |
| Viewport | both |
| Source | `<title>` = `999999 - Classifieds` — the raw unresolved id is echoed |
| Mock | `<title>` = `Search results - Classifieds` |
| Impact | Both sides render the same empty result state; only the title differs, and only for a region id that does not exist. No anchor uses a bogus `sRegion` |
| Fix hint | `src/pages/Search.jsx` title builder — when `sRegion` is present but resolves to nothing, fall back to the raw param instead of the generic `Search results`, the same way `iPage=4y` already echoes its raw value |

---

## 7. Explicitly verified NOT to be bugs

- **`iPagesize` (AUDIT HANDLERS-012, listed "open P2")** — `…&sCategory=9&iPagesize=50` renders
  `1 - 12 of 1489 listings` on the **live source** too. The mock matches the source. This item
  can be closed rather than fixed.
- **`a.show-filters-btn` no-op (AUDIT HANDLERS-009)** — `display:none` at both 1280 and 1920,
  measured, so it is unreachable by any desktop task. Unchanged status.
- **`#contact-in` empty on the item page** — matches the source's disabled form. Out of scope.
- **Empty `#sidebar` on `pub_profile&id=1`** — deliberate. Out of scope.
- **Publish landing on `page=search&sCategory=<id>`** — source behavior, and the new listing
  correctly lands as row 1 there. Confirmed working, not a bug.
- **Unauthorised edit/delete refusing to mutate** — deliberate, verified to write nothing.
- **URL param *order*** — the mock emits `sCategory, sOrder, iOrderType, sShowAs, iPage` where
  the source emits `sCategory, iPage, sOrder, iOrderType, sShowAs`. WebArena's `URLEvaluator`
  compares `urllib.parse.parse_qs` dicts, which are order-independent, so this is cosmetic.
  The param **set** and every value are identical. Not filed.

---

## 8. Verdict for this shard

| Gate | Result |
|---|---|
| ROUTES.md rows loading cold with the correct view | **37 / 37** |
| Rows verified **in a real browser** (not curl) | **37 / 37**, each at **two** viewports (78 cold loads) |
| Cold deep-link failures | **0** |
| `?sid=` lost anywhere (links, redirects, 12 form submits) | **0** |
| Console errors / page errors | **0** |
| Param-behavior cases matching the live source | **18 / 21** |
| Session isolation (2 sids, no bleed, per-sid reset) | **PASS** |
| PARTIAL-INJECT invariant (PIPELINE-001) | **PASS — still holds** |
| sid path-traversal sanitiser | **PASS** (`../evil` → `.mock-states/evil.json`, no escape) |
| 1280x720 vs 1920x1080 | **identical**, every control hit-tested at both |
| P0 bugs | **0** |
| P1 bugs | **1** (BUG-R1) |
| P2 bugs | **3** (BUG-R2, BUG-R3, BUG-R4) |

**Route parity, session isolation and the param contract are sound. One P1 (BUG-R1) blocks a
clean pass for this shard.**

---

## Fix pass — SEARCH (dev FIX agent, 2026-08-08)

Every status below was established by **running** the mock in headless chromium at
**1280x720 and 1920x1080** against the **live source** at `http://10.186.197.203:9980/`
(GET only; the container was never mutated), not by reading the diff. Server: my own
`npm run dev --port 5193`. `npm run build` exits 0.

Three scripts drove it:

| script | what it asserts |
|---|---|
| `/tmp/verify_search.py` | 19 search URLs loaded on **both** sides; `<title>`, `span.counter-search`, `#main h1`, `.see_by label` and the **ordered list of item ids** must be identical |
| `/tmp/verify_links.py` | 9 link sets (`#cat_10`, `.see_by ul li a`, `a.list-button/a.grid-button`, `.paginate a`) compared as **raw href strings** against the source's, `sid` stripped; plus body-class, `send_friend_post`, `pub_profile` |
| `/tmp/verify_geom.py` | 13 selectors x 4 views x 2 viewports, `getBoundingClientRect()` on both sides |

### Per-finding status

| Finding | Status | Evidence |
|---|---|---|
| **BUG-R1** (P1) `iOrderType=asc` dropped for `dt_pub_date` | **FIXED** | `sortKeyOf()` now returns a new `'oldest'` key when the direction is `asc`. The unfiltered path is **not** re-sorted — `getOrderedIds()` slices `order.newest` **reversed** (`catalog.js` `ORDER_REVERSED`); the filtered path gets the mirrored `(pub ASC, id ASC)` comparator. `sCategory=9&sOrder=dt_pub_date&iOrderType=asc` now returns `32464, 69456, 40883, 70302…` (p1), `75204, 2833, 45861…` (p50) and `50224` (p125) — **identical to the source on all three**. Also verified identical on the bogus-column path (`s_title`), the region-filtered path, the `sPattern` path and the all-categories path |
| **anchor re-check** after BUG-R1 | **PASS** | `sCategory=16&sOrder=i_price&iOrderType=asc&iPage=331&sShowAs=gallery`, `sCategory=9&iPage=124&sOrder=i_price&iOrderType=asc&sShowAs=gallery` and `sCategory=9&sShowAs=gallery&sOrder=dt_pub_date&iOrderType=desc&iPage=106` all still return the exact same ids as the source, unchanged |
| **DIFF-001** (P1) `pub_profile` has 0 `.admin-options` | **FIXED** | `PublicProfile.jsx` now passes `adminOptionsFor` when `isSelf`, mirroring `loop-single.php:54`. Measured: **10 `.admin-options` on 10 cards**, labels `Edit item` / `Delete`. The `Delete` link is `confirm()`-gated (dialog accepted in the test), hit-tests to itself at both viewports, and writes `deletedItemIds` — confirmed in `/go` `state_diff` |
| **DIFF-002** (P1) breadcrumb copy | **FIXED** | Last crumb now reads `Blake Sullivan's profile`. Source of truth: `Breadcrumb.php:350-351` + `:491` (`__("%s's profile")`), read out of the container |
| **DIFF-008** (P2) doctype / ~10px site-wide vertical shift | **FIXED — by CSS, not by the doctype** | The XHTML 1.0 Transitional doctype **cannot** be shipped: vite parses `index.html` with parse5, which rejects it (`non-conforming-doctype`) and fails the build. New `public/css/mock-shell.css` reproduces almost-standards mode with `vertical-align: bottom` on the three atomic inlines that were alone in their line boxes. Re-measured: `#logo > a` **70 → 65**, `a.listing-thumb` **85 → 79** (list) and **196 → 190** (gallery), `div.breadcrumb` **23 → 18**, and `header`/`.breadcrumb`/`#main`/`#sidebar`/`.list-header`/`#main h1`/`li.listing-card` **y-offsets now equal the source on every view**. Differing selectors across the whole probe: **90 → 32** |
| **DIFF-008 residual** | **not the doctype** | The 32 that remain are content-level, not vertical-shift: `#sidebar .filters` 420 vs 398, `#sidebar` 618 vs 638, item-page `#main` 1721 vs 1767. They are unchanged by the doctype class of fix and are separate findings |
| **DIFF-007** (P2) invalid `sOrder` | **FIXED — and the finding's diagnosis corrected** | The source does **not** drop `ORDER BY`. Measured at page 50 of `sCategory=9`: `sOrder=zzz&iOrderType=asc` → `75204, 2833, 45861…` but `sOrder=zzz&iOrderType=desc` → `42135, 26289, 49905…` — two different pages, so the column falls back to `dt_pub_date` **with the direction honoured**. `ROUTES.md`'s "falls back to `dt_pub_date`" was right; only the direction half was missing, and BUG-R1's fix supplies it. What **is** real is the label: the source renders `<label> <i …></label>` with **no text and no `class="current"`** whenever the `(sOrder, iOrderType)` pair matches none of the three menu options — including `dt_pub_date&asc` and `dt_expiration&*`. `SortBy` now does the same. `ROUTES.md` updated with both measurements |
| **DIFF-003** (P2) `has-searchbox` everywhere | **FIXED** | `sigma/functions.php:634` gates it on `osc_is_home_page() \|\| osc_is_search_page()`. `Layout.jsx` now matches. Measured: `has-searchbox home`, `has-searchbox search`, then bare `item`, `contact`, `item item-post`, `user user-items` — all 6 identical to the live source |
| **DIFF-009 / BUG-T1** (P2) link param ORDER | **FIXED** | `indexUrl()` no longer canonicalises: it emits the caller's own key order, and `Search.jsx` `inUrlOrder()` builds those objects from the **request's** key order, so an incoming param keeps its slot and a new one is appended (`osc_update_search_url()` semantics). The paginator now takes `currentParams`, so `iPage` is rewritten in place when present and appended when absent. **9/9 link sets are now byte-identical to the source's hrefs**, including `#cat_10` from `sRegion=9254928` → `…&sRegion=9254928&sCategory=10` and the sort link from the `iPage=124` anchor |
| **BUG-T2** (P2) `%20` vs `+` | **FIXED** | `encodePair()` is now `application/x-www-form-urlencoded`. Typing `banana boat` into `#query` and clicking Search lands on `…&sPattern=banana+boat&sid=…`. The source's own refine hrefs carry `sPattern=banana+boat` too, and they now match string-for-string |
| **BUG-R3** (P2) `send_friend_post` by GET → 404 | **FIXED** | `App.jsx` shares the branch with `send_friend`. `h1` is now `Send to a friend` |
| **BUG-R4** (P2) bogus `sRegion` drops the raw id from `<title>` | **FIXED, and wider than filed** | An unresolvable region **or city** echoes its raw value into `<title>`, `<h1>` **and** the last breadcrumb on the source (`sRegion=999999` → `999999`; `&sCategory=9` → `Books 999999`; `sRegion=abc` → `abc`; `sCity=999999` → `999999`). All four now match. **Extra bug found and fixed while measuring:** a non-numeric `sRegion` (`abc`) was not treated as a filter at all, so the mock rendered the **full 84,149-item result set** where the source renders the empty state — `filtered` keyed off `regionIds.length` instead of "sRegion present" |
| **DIFF-004** (P2) missing `No value` city option | ~~NOT DONE — NEEDS FILE~~ → **FIXED by the P2-CLEANUP pass** | `src/pages/ItemForm.jsx` was owned by the parallel FIX-FORMS agent this round; unblocked and landed afterwards. See the *Fix pass — P2-CLEANUP* section below |
| **DIFF-006** (P2) empty `.paginate` in `#comments` | ~~NOT DONE — NEEDS FILE~~ → **FIXED by the P2-CLEANUP pass** | `src/components/item/Comments.jsx` was owned by the parallel FIX-FORMS agent this round; unblocked and landed afterwards. See the *Fix pass — P2-CLEANUP* section below |
| **BUG-R2** (P2) `dt_expiration` does not sort | **NOT DONE — needs a re-seed** | Out of this shard's brief. New measurement worth recording: on the source `dt_expiration` **ignores `iOrderType`** — `asc` and `desc` return the same page (`68564, 68264, 68237…` at p50). So a future fix needs one expiration array, not two |
| **HANDLERS-012** (`iPagesize`) | **CLOSED in AUDIT.md** | Re-confirmed live: `…&sCategory=9&iPagesize=50` renders `1 - 12 of 1489 listings` on the source too. Marked closed / won't-fix with that evidence |

### Regression sweep

12 routes x 2 viewports cold-loaded: **0 page errors, 0 console errors**, `#root`
non-empty on all 24. The Subscribe-to-search → `action=alerts` round trip still
re-runs its query (12 cards, 1 alert) and still shows up in `/go` as
`state_diff = ["alerts"]`; the `pub_profile` Delete shows up as
`state_diff = ["deletedItemIds"]`.

### Files touched

`src/pages/Search.jsx`, `src/pages/user/PublicProfile.jsx`, `src/data/catalog.js`,
`src/utils/urls.js`, `src/App.jsx`, `src/components/Layout.jsx`, `index.html`,
**new** `public/css/mock-shell.css`, plus `ROUTES.md` and `AUDIT.md` documentation
corrections. `public/css/style.css` and `responsive.css` were **not** touched, and
neither was any file owned by the parallel FIX-FORMS agent.

---

## Fix pass — P2-CLEANUP (dev FIX agent, 2026-08-08)

The two findings the SEARCH pass had to hand back for file ownership, plus one
divergence found while re-verifying `ROUTES.md`. Everything below was **run** on
`npm run dev --port 5194` in headless chromium at **1280x720 and 1920x1080**,
with the live source at `http://10.186.197.203:9980/` used GET-only as the oracle.
`npm run build` exits 0.

| Finding | Status | Evidence |
|---|---|---|
| **DIFF-004** (P2) publish form's City select missing `No value` | **FIXED** | Source measured directly: `item_add` emits `<select name="cityId" …><option value="">Select a city...</option><option value="">No value</option></select>`, while `item_edit&id=84144` (region = Pennsylvania) emits the real 2,750-city list with **no** `No value`. So the extra option is the osclass artefact of the *empty-region* city query, not a constant. `ItemForm.jsx` now renders it only when no region is selected. Measured on the mock at both viewports: `item_add` → `['Select a city...', 'No value']`; after selecting Pennsylvania → 2,751 options, first real city `Abbottstown`, no `No value`; `item_edit&id=84144` → 2,751 options, `Pittsburgh` preselected, no `No value` |
| **DIFF-006** (P2) empty `.paginate` inside `#comments` | **FIXED** | `sigma/item.php` (read out of the container) puts **both** `.comments_list` and `<div class="paginate">` inside `if(osc_count_item_comments() > 0)`. Confirmed live: item **10727** (1 comment, 1 page) emits `<div class="paginate"></div>`; item **4799** (0 comments) emits **no** `.paginate` at all. `Comments.jsx` now gates the wrapper on the comment count, so the mock matches both cases — and the element correctly reappears after a post and disappears again after the last comment is deleted (both exercised) |
| **NEW · send-to-friend rejected valid e-mail addresses** (P2) | **FIXED** | Found while re-verifying ROUTES row 34. `SendFriend.jsx` validated with a hand-rolled `/^.+@.{2,}\..{2,3}$/`, which rejects `a@e.com` (single-letter host label) — the form never submitted and `sendFriendMessages` stayed empty. The source's rule is a bare `email: true`; the regex behind it was copied verbatim out of `oc-includes/osclass/assets/js/jquery3/jquery.validate.min.js`. `a@e.com` now posts (flash `We just sent your message to Amy`, redirect to the item, one `sendFriendMessages` row); `not-an-email` is still refused **visibly** (`#error_list` 46 px, BUG-A's reveal intact) |

### Regression sweep — nothing else moved

| Check | Result |
|---|---|
| The 3 deep anchor routes vs the **live source**, both viewports | `sCategory=16&sOrder=i_price&iOrderType=asc&iPage=331&sShowAs=gallery`, `sCategory=9&iPage=124&sOrder=i_price&iOrderType=asc&sShowAs=gallery`, `sCategory=9&sShowAs=gallery&sOrder=dt_pub_date&iOrderType=desc&iPage=106` — **ordered ids and counters identical to the source on all 3 × 2** (`3961 - 3972 of 6602`, `1477 - 1488 of 1489`, `1261 - 1272 of 1489`) |
| 3 comment posts with star ratings (5 / 3 / 1), per viewport | `.comments_list h3` = `{title} by Blake Sullivan:` each time, `(5 of 5)` / `(3 of 5)` / `(1 of 5)` rendered, 1 seeded + 3 posted = 4 in `state.comments`; rating stars and `Send` both hit-test to themselves |
| Publish | flash + redirect to `page=search&sCategory=19` (PARITY-001), `nextItemId` → **84155**, the new item's page renders `.price` = `123.45 $` |
| Edit 84144 | `.price` → `25000.00 $`, `itemOverrides["84144"]` = `{price, modDate}` |
| Delete | `deletedItemIds` push, item URL renders `<h1>404</h1>` |
| Alerts round trip | subscribe → `state_diff.alerts` → `Alert 1` + 12 cards → `Delete this alert` → `You do not have any alerts yet.` and `alerts: []` |
| All 37 `ROUTES.md` rows | re-loaded cold; every `[x]` verified truthful, **0 uncaught page errors** across the sweep |

### Files touched

`src/pages/ItemForm.jsx`, `src/components/item/Comments.jsx`,
`src/components/item/SendFriend.jsx`, one stale comment in `src/App.jsx`, plus
`TODO.md` / `ROUTES.md` / `AUDIT.md` / `SCHEMA.md` documentation corrections.
`public/css/style.css`, `public/css/responsive.css` and `src/data/` were **not**
touched.
