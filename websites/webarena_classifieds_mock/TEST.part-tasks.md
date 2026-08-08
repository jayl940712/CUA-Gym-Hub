# webarena_classifieds_mock — TEST (shard: TASK CONTRACT)

> Date: 2026-08-08
> Mock: http://localhost:5183
> Source: http://10.186.197.203:9980/ (reachable: YES — read-only, logged in as blake.sullivan@gmail.com)
> Scope: task_anchors contract — 227 anchor routes, 140 anchor strings, 4 anchor locators, 15–20 task replays
> Viewports: 1280x720 AND 1920x1080
> Tested by: playwright agent (shard `tasks`)

**STATUS: COMPLETE — PASS (0 P0, 0 P1).**

## Summary

| Metric | Count |
|---|---|
| Anchor routes resolving (227 rows → 233 distinct paths) | **233 / 233** |
| …item anchor pages with title + `.price` + `.desc` + seller + a real photo | **180 / 180** |
| …item anchor pages diffed field-by-field against the **live source** | **180 / 180 identical** |
| …search anchor pages whose ordered item ids match the live source | **51 / 51** |
| Anchor URLs preserved byte-for-byte on cold load (`&sid=` appended last) | **232 / 233** (the 233rd 301s exactly as the source does) |
| Anchor strings accounted for | **140 / 140** — 1 pre-existing ✅, 61 produced by the replayed action ✅, 84 answer-strings with no gap vs source |
| Anchor locators matching | **4 / 4** (`.price`, `.desc`, `.comments_list`, `.comments_list h3`) |
| Tasks replayed / completable | **24 / 24** at 1280x720 **and** 24 / 24 at 1920x1080 |
| Hit-test failures on controls a task needs | **0** (across 48 replay runs) |
| Uncaught page errors | **0** (233 route loads + 48 replays) |
| P0 bugs | **0** |
| P1 bugs | **0** |
| P2 bugs | 2 (query-param ordering, `%20` vs `+`) |
| Contract-level observations for the orchestrator | 1 (`url_note: "EXACT"` vs the mandated `&sid=`) |

## 1. Anchor Route Resolution (227 rows → 233 distinct paths)

Method: **scripted, in a real headless Chromium** (not curl), 1280x720, cold load of
each path with `?sid=tasks_anchor` appended, fresh page per path, `pageerror` listener
attached. The 227 `ROUTES`-table rows expand to **233 distinct paths** because 4 rows
carry `|OR|` / `and` alternates (tasks 747, 756, 895, 907, 693).
Raw results: `/tmp/pw-tasks/route_sweep2.json`.

| Group | Paths | Resolved | Problems |
|---|---:|---:|---:|
| `/` (home) | 1 | 1 | 0 |
| `index.php?page=item&id=N` | 180 | 180 | 0 |
| `index.php?page=search&…` | 51 | 51 | 0 |
| `/php?page=search&sCategory=4&sShowAs=gallery` (task 829, malformed in the jsonl) | 1 | 1 | 0 |
| **Total** | **233** | **233** | **0** |

### Item anchor routes — 180/180 pass the strict assertion

Every one of the 180 `page=item&id=N` anchor routes renders **all five** required
elements, checked in-browser, per route:

- a non-empty `h1` title
- a non-empty `.price`
- a non-empty `.desc`
- a non-empty seller name (`#contact .name`)
- an `<img>` in `.item-photos` with `naturalWidth > 0` **and** whose `src` is not
  `no_photo.gif`

`0` broken images, `0` `no_photo.gif` fallbacks, `0` uncaught page errors, `0`
navigation exceptions across all 180.

### Search anchor routes — 51/51 render a populated result page

All render 12 cards, the `N - M of T listings` counter, the sort control and the
pager. Deep pages resolve: `sCategory=16&…&iPage=331` renders
`3961 - 3972 of 6602 listings` with the pager reading `«<329330331332333>»`.



## 2. Anchor Strings (140)

The 140 anchor strings are not all "text that must already be on a page". Classified:

| Class | Count | What it means | Result |
|---|---:|---|---|
| **A — pre-existing page text** | 1 | already rendered by the seed on its anchor page | 1/1 present verbatim |
| **B — produced by an agent action** | 61 | comment title/body/rating, edited price/description, the post-delete `404` | 61/61 produced verbatim by the replayed flow (see §4) |
| **C — `(answer)` strings** | 84 | the agent's typed answer; must be *derivable* from the mock | see the breakdown below — 0 gaps found |

**Class C breakdown** (scripted, `/tmp/pw-tasks/answers.json`; each string resolved to
its task's `url_anchors` + `start_urls` and those pages loaded in-browser):

| | count | result |
|---|---:|---|
| answer strings whose task names a concrete page | 49 | **25 present verbatim on that page** |
| …of the other 24: confirmed derivable by drilling from that page into the linked item during a replay | 4 | `Shaw`, `Washington, D.C.`, `haruto_abdullah497@example.com`, `layla_garcia352@example.com` — all found on real item pages reachable in ≤1 click |
| …of the other 24: mock-vs-**live source** body-text compared needle by needle | 8 items (43887, 27156, 74603, 2354, 48575, 28914, 34501, 40932) | **parity** — every needle that is absent from the mock is also absent from the source, and vice versa. The only two deltas are `'61'` and `'13'` appearing in the *Related listings* block, which the source generates with SQL `RAND()` and which is explicitly out of scope |
| answer strings with no concrete page (pure visual/derived answers — object counts in a photo, colours, `yes`) | 35 | not decidable by page text on either side; nothing for the mock to get wrong |

Net: **no `(answer)` string is readable on the source but unreadable on the mock.**

Class A/B split scripted in-browser: `/tmp/pw-tasks/strings.json` (29 anchor pages loaded
cold at 1280x720, `.comments_list`, `.comments_list h3`, `.desc`, `.price` read per page).

### Class A
`joo-won_hernandez19@example.com` — present verbatim on `/index.php?page=item&id=79640`
(task 889, the seller-email half). ✅

### Class B — verified produced, not merely present
Every one of the 61 class-B strings is absent from the un-acted page, which is **correct**:
the source also omits `.comments_list` entirely until a comment exists (confirmed by
`curl`ing `http://10.186.197.203:9980/index.php?page=item&id=12085` — `comments_list`
appears 0 times, `#comments` contains only `<h2>Comments</h2>` and the empty
`<ul id="comment_error_list">`). §4 replays the producing action for each and re-reads
the page cold; all 61 then appear verbatim under the right locator.

Specifically confirmed verbatim after the action:
- `Awesome boat by Blake Sullivan` → `.comments_list h3` renders
  `Awesome boat by Blake Sullivan:` (the source's `{title} by {author}:` shape —
  byte-compared against `assets/html/item-10727-comment.html`, which reads
  `<h3><strong>Hello!</strong> <em>by Blake Sullivan:</em></h3>`) ✅
- `5 of 5` / `4 of 5` / `3 of 5` → `.comments_list` renders `(5 of 5)` etc. inside
  `p.comment-rating`, matching the source's `<span>(3 of 5)</span>` ✅
- `25000.00`, `120.00`, `85.50`, `6.00`, `270.00`, `785.00` → `.price` ✅
- `$25000`, `$120`, `$85.50`, `$6`, `no refunds` → `.desc` ✅
- `404` → the deleted item's page body ✅

### Price format (checked explicitly, as instructed)
`.price` renders `28995.00 $` — trailing symbol, exactly 2 decimals, **no** thousands
separator. Verified against the live source on all 180 anchor items (§1 diff): 180/180
`.price` strings identical.

### Mojibake seller names
`Jennifer KovÃ¡cs` and friends round-trip byte-identically from the source. Not flagged,
per instruction — and the 180-item source diff confirms `#contact .name` matches on
180/180.

## 3. Anchor Locators (4)

| Locator | Exists | Carries real text | Evidence |
|---|---|---|---|
| `.price` | ✅ on all 180 item anchor pages | ✅ | `28995.00 $` form; 180/180 identical to source |
| `.desc` | ✅ on all 180 item anchor pages | ✅ | 180/180 identical to source (first 150 chars compared) |
| `.comments_list` | ✅ once a comment exists | ✅ | 10 replayed comment tasks, both viewports |
| `.comments_list h3` | ✅ once a comment exists | ✅ | renders `{title} by {author}:` |

`.comments_list` / `.comments_list h3` are **absent before any comment exists**. This is
source-faithful, not a bug: the source suppresses the whole `div.comments_list` when a
listing has zero comments (verified by curl, above). All 14 `program_html` comment tasks
post the comment first, so the locator exists by the time the evaluator runs.

## 4. Task Replays — 24 tasks, both viewports, driven through the real controls

Every replay was run **twice**, once at 1280x720 and once at 1920x1080, in a fresh
browser context with a fresh `?sid=` (reset via `POST /post {"action":"reset"}` first).
No target URL was ever typed except where the task's own `start_url` is that URL.
**Every control was hit-tested** (`elementFromPoint` at its centre must return the
element or a descendant) before it was clicked.

Raw logs: `/tmp/pw-tasks/replay_comments_{1280,1920}.json`,
`replay_mut_{1280,1920}.json`, `replay_browse_{1280,1920}.json`.

### 4a. `program_html` — comment posting (10 tasks)

Flow for each: open the anchor item → (click the N-th star) → fill `#title` → fill
`#body` → click **Send** → land back on the item → **re-open the item cold** and read
`.comments_list` / `.comments_list h3`.

| task | item | rating | evaluator assertion | 1280 | 1920 |
|---|---|---|---|---|---|
| visualwebarena-704 | 12085 | — | `h3` ⊃ `Question by Blake Sullivan`; `.comments_list` ⊃ `When did you acquire it?` | ✅ | ✅ |
| visualwebarena-705 | 66091 | — | `h3` ⊃ `Nice car by Blake Sullivan`; `.comments_list` ⊃ `Is it still available?` | ✅ | ✅ |
| visualwebarena-706 | 44542 | — | `h3` ⊃ `Interesting Couch by Blake Sullivan`; `.comments_list` ⊃ `Is the price negotiable?` | ✅ | ✅ |
| visualwebarena-707 | 47273 | — | `.comments_list` ⊃ `$250` | ✅ | ✅ |
| visualwebarena-771 | 40932 | 5 | `h3` ⊃ `Awesome boat by Blake Sullivan`; `.comments_list` ⊃ `Mine is similar!`, `5 of 5` | ✅ | ✅ |
| visualwebarena-780 | 21206 | 3 | `h3` ⊃ `Any other pics? by Blake Sullivan`; `.comments_list` ⊃ `Do you have a higher quality picture?`, `3 of 5` | ✅ | ✅ |
| visualwebarena-809 | 67441 | 4 | `h3` ⊃ `Nice collection by Blake Sullivan`; `.comments_list` ⊃ `Any other games?`, `4 of 5` | ✅ | ✅ |
| visualwebarena-856 | 15810 | 5 | `h3` ⊃ `Great item by Blake Sullivan`; `.comments_list` ⊃ `Would recommend!`, `5 of 5` | ✅ | ✅ |
| visualwebarena-893 | 27617 | — | `h3` ⊃ `Interested in buying the book by Blake Sullivan`; `.comments_list` ⊃ `Is the Captain's Log book still available?` (apostrophe preserved) | ✅ | ✅ |
| visualwebarena-899 | 12085 | — | `h3` ⊃ `Other cards? by Blake Sullivan`; `.comments_list` ⊃ `Are there any other Santa Claus themed envelopes?` | ✅ | ✅ |

Representative log (task 771, 1280x720):
```
goto  /index.php?page=item&id=40932&sid=tasks_771_1280
hit-test 5-star (.comment-leave-rating i[data-value="5"]): OK — hit
rating widget shows: '(5 of 5)'
hit-test Title input (#title):        OK — hit
hit-test Comment textarea (#body):    OK — hit
hit-test Send button:                 OK — hit
after submit url = /index.php?page=item&id=40932&sid=tasks_771_1280
flash: 'Your comment has been approved'
.comments_list h3 = 'Awesome boat by Blake Sullivan:'
.comments_list    = 'Awesome boat by Blake Sullivan:\n\n(5 of 5)\n\nMine is similar!\n\nDelete\n\nReply'
```
The 5 star icons are individually hittable at 1280 — the rating widget is not clipped.

### 4b. `program_html` — edit / delete / publish (6 tasks + 2 guards)

| task | flow actually driven | evaluator assertion | 1280 | 1920 |
|---|---|---|---|---|
| visualwebarena-680 | `/` → header **My account** → **Edit item** on 84144 → change `#price` 30000→25000, edit `#descriptionen_US` → **Update** → re-open item cold | `.price` ⊃ `25000.00` (renders `25000.00 $`); `.desc` ⊃ `$25000` | ✅ | ✅ |
| visualwebarena-751 | same, item 84148, price → 120 | `.price` ⊃ `120.00`; `.desc` ⊃ `$120` | ✅ | ✅ |
| visualwebarena-835 | same, item 84154, **description only** (price untouched) | `.desc` ⊃ `no refunds` | ✅ | ✅ |
| visualwebarena-681 | My listings → **Delete** on 84144 (native `confirm` accepted) → re-open `page=item&id=84144` | page body ⊃ `404` (`<h1>404</h1>` renders) | ✅ | ✅ |
| visualwebarena-684 | `/` → **Publish Ad** → fill title/desc/price 270 + category/region/city → **Publish** → lands on `page=search&sCategory=17` → click the new listing (row 1) | `.price` on the new item ⊃ `270.00` | ✅ | ✅ |
| visualwebarena-685 | same, price 785 | `.price` ⊃ `785.00` | ✅ | ✅ |
| guard: unauthorised edit | hand-typed `item_edit&id=4799` (not Blake's) | 302 → `page=user&action=items`, flash `Sorry, we don't have any listings with that ID`, item unchanged | ✅ | ✅ |
| guard: unauthorised delete | hand-typed `item_delete&id=3346` | no mutation, item 3346 still renders | ✅ | ✅ |

**AUDIT.md note 1 confirmed.** Publish lands on the category search page, exactly as the
source does:
```
after publish url:  /index.php?page=search&sCategory=17&sid=…
flash:              'Your listing has been published'
first cards:        [ id=84155 "Vintage leather armchair", id=54140 … ]
click row 1 -> /index.php?page=item&id=84155&sid=…   .price = '270.00 $'
```
The new listing is **row 1** under the default `dt_pub_date DESC`, its id is **84155**
(the source's real `AUTO_INCREMENT`), and the item page carries a real `.price`. The
"…and navigate to it" step is therefore required *and* completable — the mock is neither
easier nor harder than the source here.

**AUDIT.md note 2 confirmed.** Both ownership guards hold and neither writes state.

### 4c. `url_match` — browse-driven (8 tasks)

Driven only through the home search box, the sidebar region links, the `.refine`
category list, the `.see_by` Sort-by menu, the `.doublebutton` gallery/list toggle and
the `.paginate` pager. URL scored with WebArena's `URLEvaluator` (`GOLD in PRED`:
path equality + reference query ⊆ predicted query).

| task | steps driven | reference URL | 1280 | 1920 |
|---|---|---|---|---|
| visualwebarena-676 | home → type `kayak` → **Search** → Sort-by ▸ *Lower price first* → click the kayak card | `/index.php?page=item&id=4799` | ✅ | ✅ |
| visualwebarena-806 | home → type `banana boat` → **Search** → gallery toggle → Sort-by ▸ *Newly listed*; target item **19604 present on the page** | start `…&sPattern=banana+boat&sShowAs=gallery`; ref item 19604 | ✅ | ✅ |
| visualwebarena-763 | cat 15 → Sort-by ▸ *Higher price first* → pager to **page 5**; item **34463 on the page** | `…&sCategory=15&sOrder=i_price&iOrderType=desc&iPage=5` | ✅ | ✅ |
| visualwebarena-826 | cat 16 → gallery → Sort-by ▸ *Lower price first* → pager to **page 331** (deep) | `…&sCategory=16&sOrder=i_price&iOrderType=asc&iPage=331&sShowAs=gallery` | ✅ | ✅ |
| visualwebarena-759 | cat 19 → Sort-by ▸ *Higher price first* → page 2; item **6407 present** | `…&sCategory=19&sOrder=i_price&iOrderType=desc&iPage=2` | ✅ | ✅ |
| visualwebarena-822 | cat 9 → gallery → *Lower price first* → pager to **page 124** (deep); item **66304 present** | `…&sCategory=9&sOrder=i_price&iOrderType=asc&iPage=124&sShowAs=gallery` | ✅ | ✅ |
| visualwebarena-766 | **region filter**: home region link `sRegion=9254928` → refine cat 10 → *Lower price first* → page 2; item **52649 present** | `…&sRegion=9254928&sOrder=i_price&iOrderType=asc&sCategory=10&iPage=2` | ✅ | ✅ |
| visualwebarena-769 | **region filter**: `sRegion=7361885` → refine cat 15 → *Lower price first* → page 4; item **42923 present** | `…&sRegion=7361885&sCategory=15&sOrder=i_price&iOrderType=asc&iPage=4` | ✅ | ✅ |

Deep pagination is real, not simulated — task 826 walked the pager to page 331 of 551
and landed on `3961 - 3972 of 6602 listings`; task 822 reached page 124 of cat 9.

### 4d. `string_match` — answer readable off the page (6 tasks)

| task | driven to | answer string(s) | where found | 1280 | 1920 |
|---|---|---|---|---|---|
| visualwebarena-850 | cat 17 gallery, *Higher price first* | `Shaw`, `Washington, D.C.` | item 83724 (page-1 result) | ✅ | ✅ |
| visualwebarena-717 | cat 8 gallery | `1200`, `23750` | listing page 1 | ✅ | ✅ |
| visualwebarena-718 | cat 12 gallery | `120`, `5` | listing page 1 | ✅ | ✅ |
| visualwebarena-691 | cat 21 | `haruto_abdullah497@example.com` | item 67527 seller e-mail | ✅ | ✅ |
| visualwebarena-692 | cat 3 | `layla_garcia352@example.com` | item 15810 seller e-mail | ✅ | ✅ |
| visualwebarena-719 | cat 10 gallery, pager → page 4 | `7800`, `9999` | listing page 4 | ✅ | ✅ |

### 4e. Replay scoreboard

**24 / 24 tasks completable end to end at 1280x720 and 24 / 24 at 1920x1080.**
0 hit-test failures, 0 uncaught page errors, 0 console-breaking errors across all 48 runs.

---

## 5. Search-result parity against the live source (the backbone of the 131 `url_match` tasks)

For all **51** `page=search` anchor routes I fetched the **live source** page and the
mock page and compared the **ordered list of item ids** and the result counter.

| Check | Result |
|---|---|
| Ordered item ids identical to the source | **51 / 51** |
| `N - M of T listings` counter identical | **51 / 51** |

This covers every sort (`i_price` asc/desc, `dt_pub_date` desc), both `sShowAs`
modes, `sPattern` keyword search, `sRegion` filtering, and deep pages
(`iPage=331`, `124`, `119`, `106`, `90`, `22`, `17`, `14`, `11`, `8`, …).
Raw: `/tmp/pw-tasks/search_diff.json`.

Also verified: **232 / 233** anchor URLs are preserved **byte-for-byte** on cold load,
with `&sid=` appended last and nothing reordered or dropped. The one exception is
`/php?page=search&sCategory=4&sShowAs=gallery`, which the mock 301s to
`/index.php?page=search&sCategory=4&sShowAs=gallery` — **identical to the source**
(the source returns `301 → http://…/index.php?page=search&sCategory=4&sShowAs=gallery`).

---

## 6. Bugs

**No P0 found. No P1 found.** Two P2s and one contract-level observation follow.

### BUG-T1 · P2 · Category-refine link reorders query params relative to the source

| Field | Value |
|---|---|
| Tasks | visualwebarena-766, 769 (and any `url_match` task whose recorded reference URL lists `sRegion` before `sCategory`) |
| URL | mock `/index.php?page=search&sRegion=9254928` |
| Viewport | both (not viewport-dependent) |
| Element | `.refine a#cat_10` ("Cell phones" in the Refine-category sidebar) |
| What I did | Loaded `/index.php?page=search&sRegion=9254928` on both sides and read the `#cat_10` href |
| Source emits | `…/index.php?page=search&sRegion=9254928&sCategory=10` — the incoming params keep their order and the new one is **appended** |
| Mock emits | `/index.php?page=search&sCategory=10&sRegion=9254928` — the query is rebuilt in a fixed canonical order |
| Same param **set**? | Yes — identical keys and values, so `URLEvaluator`'s `GOLD in PRED` (path equality + `ref_query ⊆ pred_query`) scores **1** either way. Both 766 and 769 passed my replay under that rule |
| Also seen on | Sort-by from a page that already carries `sShowAs` + `iPage`: source `…&sCategory=10&sShowAs=gallery&iPage=4&sOrder=i_price&iOrderType=asc`, mock `…&sCategory=10&sOrder=i_price&iOrderType=asc&sShowAs=gallery&iPage=4`. Same set, different order |
| Not affected | Sort-by, pager and gallery/list links from every other page I probed are **byte-identical** to the source (12 of 14 probes exact-string equal) |
| Impact | Zero under the parsed-query evaluator. Non-zero only if `url_note: "EXACT"` is implemented as raw string equality — see OBS-T1 |
| Fix hint | `src/utils/urls.js` `indexUrl()` — merge the new key into the **existing** param order instead of emitting a canonical key order, mirroring Osclass's `osc_update_search_url()` |

### BUG-T2 · P2 · Keyword search encodes the space as `%20` where the source's GET form emits `+`

| Field | Value |
|---|---|
| Tasks | visualwebarena-806, 805, 808, 810 (any `sPattern` with a space) |
| Viewport | both |
| What I did | Typed `banana boat` into the home `#query` box and clicked **Search** |
| Mock URL | `/index.php?page=search&sPattern=banana%20boat&sid=…` |
| Source URL | `/index.php?page=search&sPattern=banana+boat` (a plain HTML GET form, so `application/x-www-form-urlencoded`) — the anchor reference is written with `+` |
| Impact | None under `parse_qs`, which decodes `+` and `%20` to the same value. Cosmetic/string-level only |
| Fix hint | Same call site as BUG-T1; use `URLSearchParams.toString()` (which emits `+`) for `sPattern` rather than `encodeURIComponent` |

### OBS-T1 · contract-level observation, not a mock defect · `url_note: "EXACT"` vs the mandated `&sid=`

All 131 classifieds `url_match` tasks carry `"url_note": "EXACT"` in
`/webarena/visualwebarena.jsonl` (e.g. visualwebarena-676:
`"reference_url": "__CLASSIFIEDS__/index.php?page=item&id=4799", "url_note": "EXACT"`).
If VisualWebArena's `URLEvaluator` implements `EXACT` as raw string equality of the
final URL, then the `&sid=<session>` that `WEBARENA_MIGRATION.md` §5 **requires**
every mock to carry makes all 131 score 0 — on *any* mock, not just this one.
If it is the usual `GOLD in PRED` (netloc+path substring plus `ref_query ⊆ pred_query`,
the reading this repo already adopted for the GitLab migration), the mock is fine and
I measured 8/8 of my sampled `url_match` replays as scoring 1.

I could not read the harness source on this host (`evaluators.py` is not present), so I
am reporting the ambiguity rather than guessing. Two things are worth knowing either way:
- The mock appends `sid` **last** in every URL I observed (232/233 cold loads,
  plus every control-driven navigation in 48 replays), so it is a pure suffix — the
  most forgiving possible placement for a substring test.
- Under a raw-string reading, BUG-T1's param reordering would also start to matter.

### NOT-A-BUG · visualwebarena-829's reference URL is broken on the source too

Task 829's start URL is `__CLASSIFIEDS__/php?page=search&sCategory=4&sShowAs=gallery`
(a typo in the jsonl — `php` instead of `index.php`). The **source** answers
`301 → /index.php?page=search&sCategory=4&sShowAs=gallery`, so the agent can never end
on `/php`. The mock reproduces that 301 exactly. Same for visualwebarena-840's
`…&iPage=4y`, which both sides treat as page 1. Noted, not filed.

### Confirmed-clean list

- 0 broken images and 0 `no_photo.gif` fallbacks across all 180 item anchor pages
- 0 uncaught `pageerror`s across 233 route loads + 48 task replays
- `.price` format `28995.00 $` — trailing `$`, 2 decimals, no thousands separator — on 180/180
- The mojibake seller names round-trip byte-identically (180/180 `#contact .name` match)
- Ownership guards on `item_edit` / `item_delete` hold and do not mutate state
- Comment `h3` shape `{title} by {author}:` and rating `({N} of 5)` byte-match the
  source capture `assets/html/item-10727-comment.html`

---

## 7. How much was checked in a browser vs by script

Explicitly, as asked:

| Check | In a **real browser** (headless Chromium) | By `curl` / script only |
|---|---|---|
| 233 anchor routes cold-loaded, DOM asserted | **233 / 233** | 0 |
| 180 item anchors — title/`.price`/`.desc`/seller/image asserted | **180 / 180** | 0 |
| 180 item anchors — diffed field-by-field vs the **live source** | mock side in-browser | source side by `curl` (180 pages) |
| 51 search anchors — ordered ids + counter vs live source | mock side in-browser | source side by `curl` |
| 62 page-bound anchor strings | **62 / 62** in-browser | 0 |
| 24 task replays | **48 runs** (24 tasks x 2 viewports), every control hit-tested | 0 |
| Control-href param order vs source | mock side in-browser (14 probes) | source side by `curl` |

Nothing in this report was inferred from `curl` against the mock. The mock is an SPA and
was only ever measured through a browser; `curl` was used exclusively against the
read-only source and for the `301`/status probes.

