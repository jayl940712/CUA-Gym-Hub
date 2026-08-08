# classifieds — Route Parity Map

> Source: `http://10.186.197.203:9980/` (`http://localhost:9980` 302s here)
> Discovered by: plan agent, 2026-08-08 — crawled logged in as `blake.sullivan@gmail.com`,
> then cross-checked against `/usr/src/myapp/index.php` and the Osclass controllers.
> Mock route shape: **identical**, plus an additive `&sid=<session>`.

Osclass uses classic query routing. There are no path segments to preserve beyond
`/index.php`; everything is in the query string. `rewrite_enabled` is effectively off for
every URL the tasks use, so the mock only needs the `index.php?page=…` forms.

Status column: dev marks `[x]` when the mock serves the route with correct data.

## Public Routes

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 1 | `/` | GET | `/` | Home: hero search form, 23-category grid, region list, 12 newest listings | `catalog/*`, `categories.json`, `regions.json` | P0 | [x] |
| 2 | `/index.php` (no `page`) | GET | same | Same as row 1 (default branch of the router) | — | P0 | [x] |
| 3 | `/index.php?page=search` | GET | same | All-categories search shell, `1 - 12 of 84149 listings` | all catalog shards | P0 | [x] |
| 4 | `/index.php?page=search&sCategory=N` | GET | same | Category listing, N ∈ 2..24 | `catalog/cat-N.json` | P0 | [x] |
| 5 | `/index.php?page=search&sPattern=…` | GET | same | Keyword search — MyISAM FULLTEXT semantics over title + **full description**; counts verified against the live site (see `CONTRACTS.md` §9) | all catalog + description shards | P0 | [x] |
| 6 | `/index.php?page=search&…&sShowAs=list\|gallery` | GET | same | List rows vs gallery grid | — | P0 | [x] |
| 7 | `/index.php?page=search&…&sOrder=…&iOrderType=…` | GET | same | Re-sorts the listing | — | P0 | [x] |
| 8 | `/index.php?page=search&…&iPage=N` | GET | same | Page N, 12/page, 1-based | — | P0 | [x] |
| 9 | `/index.php?page=search&sRegion=<geonames id>` | GET | same | Region-filtered listing; both anchor pages diff clean against the source | `regions.json` | P1 | [x] |
| 10 | `/index.php?page=search&sCity=<city id>` | GET | same | City-filtered listing; `sCity` accepts a city id **or** a city name, as the source does | `cities.json` | P1 | [x] |
| 11 | `/index.php?page=search&sPriceMin=&sPriceMax=` | GET | same | Price-range filter (sidebar), bounds inclusive | — | P1 | [x] |
| 12 | `/index.php?page=search&bPic=1` | GET | same | "listings with pictures" filter — accepted, round-tripped through the sidebar checkbox and every link; inert because every item has a photo | — | P2 | [x] |
| 13 | `/index.php?page=search` → **no matches** | GET | same | Search shell + `.empty` copy; source returns **HTTP 404** with the page rendered | — | P0 | [x] |
| 14 | `/index.php?page=item&id=N` | GET | same | Item detail: photo, price, description, location, seller sidebar, related listings, comments | `catalog/*`, `descriptions/*`, state `comments` | P0 | [x] |
| 15 | `/index.php?page=item&id=<missing>` | GET | same | Theme 404 body (`<h1>404</h1>`, `OOPS! Page Not Found!`); source status is **410** | — | P0 | [x] |
| 16 | `/index.php?page=contact` | GET | same | Site contact form | static copy | P2 | [x] |
| 17 | `/php?page=…` | GET | same | **301** → `/index.php?page=…` preserving the whole query string | — | P1 | [x] |

## Authenticated Routes (mock boots pre-logged-in as Blake Sullivan)

| # | Source path | Method | Mock route | Renders | Data source | Priority | Status |
|---|---|---|---|---|---|---|---|
| 18 | `/index.php?page=user&action=dashboard` | GET | same | **200 in place — NOT a redirect.** `controller/user.php:39-47` `case('dashboard')` has no `redirectTo`; it exports `items`/`max_items` and calls `doView('user-dashboard.php')`, and sigma's `user-dashboard.php` is a two-line include of `user-items.php`. Same body as row 19, URL keeps `action=dashboard` — which is why `assets/html/user-dashboard.html` and `user-items.html` are byte-identical (31463 B). | state `myItems` | P1 | [x] |
| 19 | `/index.php?page=user&action=items` | GET | same | "Manage my listings" — Blake's 12 items, each with Edit / Delete | state `myItems` | P0 | [x] |
| 20 | `/index.php?page=user&action=profile` | GET | same | Profile form (name, phone, country/region/city, description) | state `user` | P1 | [x] |
| 21 | `/index.php?page=user&action=profile_post` | POST | same | Saves profile, flash `Your profile has been updated successfully`, redirect to row 20 | state `user` | P1 | [x] |
| 22 | `/index.php?page=user&action=alerts` | GET | same | Saved-search alerts. Seeded **empty** for Blake → `<p class="empty">You do not have any alerts yet.</p>`. The search sidebar's `Subscribe now!` pushes onto `state.alerts`; each row renders as `user-alerts.php` does — `.userItem` → `.title-has-actions` → `<h3>Alert N</h3>` + `Delete this alert`, followed by that alert's **own search re-run**, limited to 12 (`controller/user.php:110-126`). Round trip (subscribe → listed → delete → empty) re-verified by P2-CLEANUP at both viewports, including the `/go` `state_diff`. | state `alerts` | P2 | [x] |
| 23 | `/index.php?page=user&action=change_email` | GET | same | Change-email form | — | P2 | [x] |
| 24 | `/index.php?page=user&action=change_username` | GET | same | Change-username form | state `user` | P2 | [x] |
| 25 | `/index.php?page=user&action=change_password` | GET | same | Change-password form | — | P2 | [x] |
| 26 | `/index.php?page=item&action=item_add` | GET | same | "Publish Ad" form | `categories.json`, `regions.json` | P0 | [x] |
| 27 | `/index.php?page=item&action=item_add_post` | POST | same | Creates a listing, flashes `Your listing has been published`, then **redirects to `/index.php?page=search&sCategory=<catId>`** — the category search page, *not* the new item. `oc_t_preference.item_post_redirect` is `''` on this deployment, so `controller/item.php:181-209` falls past the `DASH-ITEM-CAT` and `ITEM-CAT` branches to `redirectTo(osc_search_category_url())`, which with `rewriteEnabled=0` emits that URL literally. The new listing is row 1 under the default `dt_pub_date DESC`. Tasks 684/685 must then click through to the item themselves ("…and navigate to it") — the category page has no `.price` element. | state `newItems` | P0 | [x] |
| 28 | `/index.php?page=item&action=item_edit&id=N` | GET | same | Edit form pre-filled from the item. **Owner-scoped** (`item.php:217`): a listing Blake does not own never renders the form — flash `Sorry, we don't have any listings with that ID`, 302 → row 19. | state + catalog | P0 | [x] |
| 29 | `/index.php?page=item&action=item_edit_post` | POST | same | Saves the edit **and stamps `dt_mod_date`** (`ItemActions.php:784`, on every edit, even a no-op), flashes `Great! We've just updated your listing`, redirects to the item — which then shows `Modified date:` | state `itemOverrides` | P0 | [x] |
| 30 | `/index.php?page=item&action=item_delete&id=N` | GET | same | Deletes the listing; the item URL then renders row 15. **Owner-scoped** (`item.php:396`): on a miss nothing is deleted — flash `The listing you are trying to delete couldn't be deleted`, 302 → `osc_base_url()` (`/`), *not* row 19. | state `deletedItemIds` | P0 | [x] |
| 31 | `/index.php?page=item&action=add_comment` | POST | same | Appends to `.comments_list` on the item page | state `comments` | P0 | [x] |
| 32 | `/index.php?page=item&action=delete_comment&id=N&comment=C` | GET | same | Removes a comment authored by Blake | state `comments` | P1 | [x] |
| 33 | `/index.php?page=item&action=send_friend&id=N` | GET | same | "Share" / send-to-friend form | — | P2 | [x] |
| 34 | `/index.php?page=item&action=send_friend_post` | POST | same | Confirmation flash | state `sendFriendMessages` | P2 | [x] |
| 35 | `/index.php?page=item&action=contact_post` | POST | — | **Disabled on this deployment** (`item_contact_form_disabled = 1`). The sidebar renders the "Contact seller" button and a `#contact-in.fixed-layout` panel holding only `<div class="fixed-close"><i class="fas fa-times"></i></div>` and the source's `<!-- Contact form disabled -->` comment — i.e. **no `<form>` at all**. Reproduce the *disabled* state; do not build a working form. (Verified byte-for-byte against the live `page=item&id=4799`; the mock's `#contact-in` holds the same `.fixed-close` and zero forms. The JSX comment is not emitted into the DOM — an HTML comment is invisible either way.) | — | P2 | [x] |
| 36 | `/index.php?page=item&action=mark&id=N&as=…` | GET | same | Report listing (spam/repeated/offensive/expired) | state `marks` | P2 | [x] |
| 37 | `/index.php?page=user&action=pub_profile&id=1` | GET | same | Public profile — `.user-card`, `Latest listings` (**10**/page), last breadcrumb `Blake Sullivan's profile` (`Breadcrumb.php:350-351,491`, TEST DIFF-002). Viewing your own profile, all 10 cards carry `<span class="admin-options">` with `Edit item` / `Delete` (`loop-single.php:54`, TEST DIFF-001). `#sidebar` is **empty**: `user-public-sidebar.php:20` gates the contact block on `osc_logged_user_id() != osc_user_id()`, and id 1 is the logged-in user. Not found during the original crawl, but the user sidebar's first entry (`Public Profile`) links here on the source, so it is built rather than left dead. | state `myItems`/`newItems` | P2 | [x] |

## Query Parameters

Names verified in `oc-includes/osclass/controller/search.php` and in the live forms —
not guessed. Note `iPagesize` really is spelled with a lowercase `s`.

| Route | Param | Values | Effect |
|---|---|---|---|
| `page=search` | `sCategory` | `2`..`24` (also accepts `sCategory[]` from the sidebar form, and a category slug) | Filter by category |
| | `sPattern` | free text | FULLTEXT match on title + description. **OR across words, min word length 4, no stemming, stopwords excluded.** |
| | `sOrder` | `i_price` \| `dt_pub_date` \| `dt_expiration` | Sort column. Anything else falls back to `dt_pub_date` **and the direction is still honoured** — re-measured live on `sCategory=9` page 50: `sOrder=zzz&iOrderType=asc` and `sOrder=s_title&iOrderType=asc` both return `75204, 2833, 45861, …` (= `dt_pub_date asc`), while the same columns with `iOrderType=desc` return `42135, 26289, 49905, …` (= `dt_pub_date desc`). Two different pages, so the source is **not** dropping `ORDER BY` (TEST DIFF-007 inferred that from page 1 alone, where `dt_pub_date asc` and storage order happen to coincide). The `.see_by` label does blank out — see the note under the sort table. `dt_expiration` is a genuine third column but **ignores** `iOrderType` (asc and desc return the same page). |
| | `iOrderType` | `asc` \| `desc` | Direction. Compared as a **string**; `0`/`1` do not match and fall back to `desc`. Applies to `dt_pub_date` as well as `i_price` — `dt_pub_date&asc` is the exact reverse of the default order (`32464, 69456, 40883, 70302…` vs `50224, 26497, 14453, 54474…` on `sCategory=9`). |
| | `iPage` | integer ≥ 1 | 1-based page. `0` and `1` are both page 1. Non-numeric (e.g. `4y`) → page 1, but the `<title>` still echoes the raw value. |
| | `iPagesize` | 1..50 | Upstream Osclass overrides the 12/page default (capped at `maxResultsPerPage@search = 50`), but **this deployment ignores it** — MEASURED live: `…&page=search&sCategory=9&iPagesize=50` renders `1 - 12 of 1489 listings` on the source. The mock accepts and round-trips it with no effect, which is parity, not a gap. AUDIT **HANDLERS-012 = won't-fix**. |
| | `sShowAs` | `list` \| `gallery` | Layout. Invalid values fall back to `list`. **Page size is 12 either way.** |
| | `sRegion` | GeoNames region id (e.g. `7361885` = Maryland, `9254928` = Virginia) | Region filter. Comma-separated values allowed. |
| | `sCity` | city id | City filter. Comma-separated allowed. |
| | `sCityArea`, `sCountry`, `sUser`, `sLocale` | ids / codes | Further filters; unused by tasks |
| | `sPriceMin`, `sPriceMax` | integer dollars | Price range (sidebar inputs, `maxlength="6"`) |
| | `bPic` | `1` | Only listings with a photo — inert, all 84,149 have one |
| | `bPremium` | `1` | Only premium — inert, none are premium |
| | `sFeed` | `rss` | RSS output, 50 items. Not required. |
| | `meta[<field id>]` | — | Custom-field filters. **Inert: `oc_t_meta_fields` is empty on this deployment.** |
| `page=item` | `id` | item id | Which listing |
| | `action` | see rows 26–36 | |
| | `comment` | comment id | Target of `delete_comment` |
| | `replyId` | comment id | Threaded reply target on `add_comment` |
| `page=user` | `action` | `dashboard`/`items`/`profile`/`alerts`/`change_email`/`change_username`/`change_password` | |
| | `max_items` | integer (default 20) | Row count on the dashboard |
| any POST | `octoken` | token | CSRF. The field is named `octoken`, **not** `CSRFToken`. Mock can accept and ignore it. |
| all | `sid` | session id | **Mock-only, additive.** Must survive every link, redirect and form submit. |

### Sort dropdown — exact labels and the URLs behind them

| Label | `sOrder` | `iOrderType` |
|---|---|---|
| `Newly listed` (default) | `dt_pub_date` | `desc` |
| `Lower price first` | `i_price` | `asc` |
| `Higher price first` | `i_price` | `desc` |

The dropdown rebuilds the *current* URL with these two params replaced, **keeping
every other param including `iPage`**, and appends anything missing at the end.
The list/gallery toggle uses the same rebuild. Re-measured on the live site by dev
shard A — an earlier revision of this row said `iPage` was dropped, and it is not:

```
in : index.php?page=search&sCategory=9&iPage=124&sOrder=i_price&iOrderType=asc&sShowAs=gallery
out: index.php?page=search&sCategory=9&iPage=124&sOrder=dt_pub_date&iOrderType=desc&sShowAs=gallery
```

That matters because `…&sCategory=9&iPage=124&sOrder=i_price&iOrderType=asc&sShowAs=gallery`
is itself an anchor route — it is only reachable by sorting *from* page 124.

The **"Refine category"** links are built from scratch rather than rebuilt, and
those DO drop `iPage`: `index.php?page=search[&sPattern=…][&sCategory=N][&sOrder=…&iOrderType=…][&sShowAs=…]`.

**Param ORDER is preserved, not canonicalised.** `osc_update_search_url()` rewrites
the current query in place: an incoming key keeps its slot and a genuinely new key
is **appended**. Measured live:

```
in : index.php?page=search&sRegion=9254928
out: index.php?page=search&sRegion=9254928&sCategory=10        (#cat_10, sCategory appended)

in : index.php?page=search&sCategory=9&sShowAs=gallery
out: index.php?page=search&sCategory=9&sShowAs=gallery&iPage=2 (pager, iPage appended)

in : index.php?page=search&sCategory=9&iPage=124&sOrder=i_price&iOrderType=asc&sShowAs=gallery
out: index.php?page=search&sCategory=9&iPage=123&sOrder=i_price&iOrderType=asc&sShowAs=gallery
                                       ^^^^^^^^ pager rewrites iPage IN PLACE
```

Values are `application/x-www-form-urlencoded`, so a space is `+`, never `%20`
(`sPattern=banana+boat` in the address bar and in every link the theme builds).

**The `.see_by` label blanks out when the current `(sOrder, iOrderType)` pair matches
none of the three menu options** — `dt_pub_date&asc`, `dt_expiration&*` and any bogus
column all render `<label> <i class="fa fa-angle-down"></i></label>` with no text and
no `class="current"` on any option.

### Pagination control markup

Measured on `sCategory=9` (125 pages) at pages 1, 2, 3, 50, 123, 124, 125 and on a
single-page result set. Window = `[page-2, page+2]` clamped to `[1, lastPage]`.

```html
<!-- page 50 of 125 -->
<div class="paginate"><ul>
  <li><a class="searchPaginationFirst list-first" href="…">&laquo;</a></li>
  <li><a class="searchPaginationPrev" href="…&iPage=49">&lt;</a></li>
  <li><a class="searchPaginationNonSelected" href="…&iPage=48">48</a></li>
  …
  <li><span class="searchPaginationSelected">50</span></li>
  …
  <li><a class="searchPaginationNext" href="…&iPage=51">&gt;</a></li>
  <li><a class="searchPaginationLast list-last" href="…&iPage=125">&raquo;</a></li>
</ul></div>
```

- `searchPaginationFirst list-first` (`«`) appears only when the window starts past
  page 1. Otherwise the Prev link carries `list-first`; on page 1, where there is
  no Prev link, the selected `<span>` carries it instead.
- `searchPaginationLast list-last` (`»`) appears only when the window ends before
  the last page. Otherwise the Next link carries `list-last`. On the last page
  neither exists and the selected `<span>` carries **no** extra class — asymmetric
  with page 1, but that is what the source emits.
- The control still renders when there is only one page:
  `<span class="searchPaginationSelected list-first">1</span>` alone.
- Page 1 links omit `iPage` entirely rather than emitting `iPage=1`.

## Anchor Route Coverage

All 227 anchor routes from `assets/task_anchors.md` reduce to the shapes above:

| Anchor shape | Count | Covered by |
|---|---:|---|
| `/` | 1 | row 1 |
| `/index.php?page=item&id=N` | 180 distinct ids | row 14 (and row 15 after task 681 deletes 84144) |
| `/index.php?page=search&…` | 45 distinct param combinations | rows 3–11 |
| `/php?page=search&…` | 1 | row 17 |

Deepest anchor pages: `sCategory=16&…&iPage=331` (category has 551 pages),
`sCategory=9&…&iPage=124` (that category's last full page, 125 pages total),
`sCategory=9&…&iPage=119`, `…&iPage=106`, `…&iPage=90`. These only resolve correctly
against the **complete** per-category item set — see `DESIGN.md` §Seed Strategy.

## Intentionally Not Migrated

| Source path | Reason |
|---|---|
| `/index.php?page=login`, `page=main&action=logout`, `page=register` | Mock boots pre-logged-in as Blake Sullivan (migration contract). No login screen is built; the mock reproduces the source's logged-in **302 targets** instead, which differ per route: `page=login` → `/index.php?page=user&action=dashboard` (`login.php:349-354`, `osc_user_dashboard_url()`), `page=register` → `/` (`register.php:38-40`, `osc_base_url()`), `page=main&action=logout` → home, still logged in. |
| `page=user&action=forgot_password` / `recover` / `change_email_confirm` | Password + e-mail confirmation flows require mail; no task touches them |
| `page=user&action=delete` | Account deletion; destructive and untargeted |
| `page=ajax&action=*` | Server-side AJAX (city autocomplete, image rotate/delete, upload). Reimplement the *behavior* client-side where a form needs it; do not mirror the endpoints. |
| `page=cron`, `page=language`, `page=custom` | Server machinery / locale switching; single-locale deployment |
| `page=reset` | WebArena's `RESET_TOKEN` state-reset hook. The mock's equivalent is `/go?sid=…` + `reset`. |
| `/oc-admin/*` | Osclass back office; no task targets it and no admin credentials were supplied |
| `sFeed=rss` | Feed output; no task targets it |
