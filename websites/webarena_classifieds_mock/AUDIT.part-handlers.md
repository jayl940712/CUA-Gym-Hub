# webarena_classifieds_mock — Audit part: DEAD HANDLERS / COMPLETENESS

> Dimension: `handlers` (unimplemented UI behind implemented-looking chrome)
> Date: 2026-08-08 · Audited by: audit agent (shard `handlers`)
> Method: full read of all 31 files under `src/`, plus **live execution** of the mock
> (`npm run dev` on port 5186, chromium **1280×720**, 6 scripted click-throughs) with
> `/go?sid=` read after every mutation. Source cross-checks: `assets/html/*.html`,
> read-only `curl --noproxy '*'` GETs against `http://10.186.197.203:9980/`, and
> `docker exec classifieds` reads of the Osclass controllers/templates.
> Scope note: findings from the `parity`, `pipeline` and `design` dimensions are not
> repeated here.

## Summary

| Priority | Count |
|---|---:|
| P0 | 0 |
| P1 | 6 |
| P2 | 8 |
| Total | 14 |

**Headline:** the mock is in far better shape on this dimension than a three-shard
parallel build usually is. Every high-traffic control I exercised — sort dropdown,
list/gallery toggle, pagination (incl. `iPage=124` anchor), sidebar filters + Apply,
23 category tiles, 7 region links, home search, comment post/reply/delete/paging, star
rating, `Mark as…`, Share, publish, edit, delete, profile save, change
e-mail/username/password, site contact — **actually mutates state and shows up in
`/go` `state_diff`**. There are **no empty `onClick={() => {}}`, no `TODO`/`FIXME`/
`Lorem`/"coming soon" strings, and no zero console/page errors** across the whole
sweep. The six P1s below are integration seams between shards, not missing work.

---

## P1

### HANDLERS-001 · `Subscribe now!` writes an alert the Alerts page cannot read — two shards disagree on the record shape
- **Files**: `src/pages/Search.jsx:415-432` (writer) vs `src/pages/user/Alerts.jsx:30-38, 46-50` (reader)
- **What I did (RAN)**: opened
  `/index.php?page=search&sCategory=9&sOrder=i_price&iOrderType=asc&sid=…`, clicked
  `Subscribe now!`, then opened `/index.php?page=user&action=alerts`.
- **What happened**: `/go` shows
  `alerts:[{"id":1,"userId":1,"email":"blake.sullivan@gmail.com","search":"{\"page\":\"search\",\"sCategory\":\"9\",\"sOrder\":\"i_price\",\"iOrderType\":\"asc\"}","active":1}]`
  — correct per `SCHEMA.md:41`. The Alerts page renders the row as the literal text
  **`All listings`** linked to **`/index.php?page=search`** — the category and the sort
  are both gone. `Alerts.jsx` reads `a.description` and `a.params`, neither of which any
  writer produces, so `describe()` falls through to its `'All listings'` default and
  `indexUrl({page:'search', ...(a.params||{})})` degrades to a bare search URL.
- **Should have happened**: the alert row should name and link back to the search it was
  created from.
- **Fix**: one of the two sides has to move. `SCHEMA.md` documents
  `{id,userId,email,search,active}`, so prefer fixing the reader: `JSON.parse(a.search)`
  into the params for the link and build the label from it. If instead the writer is
  changed to add `params`/`description`, update `SCHEMA.md` in the same commit.

### HANDLERS-002 · Publish and Edit never render their flash message — the `flash` payload shape doesn't match the consumer
- **Files**: `src/pages/ItemForm.jsx:162` and `:198` (writers), `src/pages/Item.jsx:87`,
  `src/components/item/Flash.jsx:21` (consumer)
- **What I did (RAN)**: published a new listing (landed on `page=item&id=84155`) and
  edited `84144`'s price 30000 → 25000 (landed on `page=item&id=84144`).
- **What happened**: **no flash at all** on either page (`#flashmessage` absent).
  `ItemForm` navigates with `state:{flash:"Your listing has been published"}` — a bare
  **string** — while `Item.jsx` passes it to `<Flash flash={flash}/>`, which bails at
  `if (!flash || !flash.msg …) return null`. Every other producer in the app
  (`MarkItem.jsx:40`, `DeleteComment.jsx:38-42`, `Comments.jsx:229`, `SendFriend.jsx:76`)
  correctly sends `{type,msg}`, and those flashes all render — I saw
  `Thanks! That's very helpful`, `The comment has been deleted`,
  `Your comment has been approved`, `We just sent your message to Ann`.
- **Should have happened**: `Your listing has been published` and
  `Great! We've just updated your listing` — verified verbatim in the container at
  `/usr/src/myapp/oc-includes/osclass/controller/item.php:171` and `:288`.
- **Fix**: `ItemForm.jsx:162` → `state:{flash:{type:'ok',msg:"Great! We've just updated your listing"}}`;
  `:198` → `state:{flash:{type:'ok',msg:'Your listing has been published'}}`.

### HANDLERS-003 · Editing a listing never sets a modified date — `itemOverrides[id].modDate` is read but written by nobody
- **Files**: `src/pages/Item.jsx:83-85, 111` (reader), `src/pages/ItemForm.jsx:128-161`
  (writer that omits it)
- **What I did (RAN + READ)**: edited `84144`, then re-read the item page; also
  `grep -rn modDate src/` — the only four hits are all in `Item.jsx`, all reads.
- **What happened**: the item page shows only `Published date:`. The `changes` object
  built in `ItemForm.onSubmit` covers title/cat/price/description/region/city/area/
  address/phone/showPhone/contactOther/currency and **never sets `modDate`**, so the
  branch at `Item.jsx:111` is dead for every in-session edit. (The two seeded ids
  84143/84144 do show it *before* an edit, from `SEEDED_MOD_DATE_IDS`.)
- **Should have happened**: the source's `ItemActions.php:784` writes
  `'dt_mod_date' => date('Y-m-d H:i:s')` on every `item_edit_post`, and the theme renders
  `Modified date: …` — so after an edit the row must appear with today's date.
- **Fix**: add `changes.modDate = nowStamp()` in the `isEdit` branch whenever
  `Object.keys(changes).length` is non-zero.

### HANDLERS-004 · Edit / delete of a listing Blake does not own is allowed, and fabricates a state mutation
- **Files**: `src/pages/ItemForm.jsx:43-68` (no ownership check on load),
  `src/pages/ItemForm.jsx:525-549` (`ItemDelete`, no ownership check)
- **What I did (RAN)**: hand-typed `/index.php?page=item&action=item_edit&id=4799` and
  `/index.php?page=item&action=item_delete&id=3346` (both belong to other sellers).
- **What happened**: the edit form rendered fully pre-filled with `Kayak`; submitting
  wrote `itemOverrides:{"4799":{"price":1000000}}` and the item page then showed
  `1.00 $`. The delete URL redirected to `page=user&action=items` with the flash
  `Your listing has been deleted`, wrote `deletedItemIds:[3346]`, and `page=item&id=3346`
  now renders the 404 body — a stranger's listing removed from the whole catalogue.
- **Should have happened**: the source scopes both by owner
  (`item.php:217` and `:396`: `… AND (i.s_secret = %s OR i.fk_i_user_id = %d)`). On a
  miss it flashes `Sorry, we don't have any listings with that ID` (edit) or
  `The listing you are trying to delete couldn't be deleted` (delete) and redirects —
  confirmed live: `GET …&action=item_edit&id=4799` on the source returns **302**, not a form.
- **Why it matters here (not just parity)**: an agent that guesses an `item_delete` URL
  silently poisons `state.deletedItemIds`/`itemOverrides`, i.e. a false reward signal
  that no evaluator can distinguish from a legitimate edit.
- **Fix**: gate both on `(state.myItems ∪ state.newItems).includes(id)`; on a miss,
  redirect to `page=user&action=items` with the source's error flash.

### HANDLERS-005 · Public profile renders a Contact form the source hides on your own profile, and it accepts a blank submit
- **File**: `src/pages/user/PublicProfile.jsx:55-70, 117-160`
- **What I did (RAN)**: opened `/index.php?page=user&action=pub_profile&id=1` (the target
  of the user sidebar's first link) and clicked **Send** with every field empty.
- **What happened**: `#error_list` stayed empty, the success line
  `Your email has been sent properly. Thank you for contacting us!` appeared, and
  `state.contactMessages` gained a row with `name:"" email:"" message:""`.
- **Should have happened**: the source's `user-public-sidebar.php:20` wraps the whole
  `#contact` block in `if(osc_logged_user_id() != osc_user_id())` — the mock boots as
  user 1 and `pub_profile&id=1` **is** user 1, so the source renders an **empty
  `#sidebar`** here, with no contact form at all. And where the form *is* shown, it runs
  `ContactForm::js_validation()` (`Contact.form.class.php:119-155`):
  `yourEmail` required+email → `Email: this field is required.` / `Invalid email address.`,
  `message` required minlength 1 → `Message: this field is required.` — the same copy
  `src/pages/Contact.jsx:34-36` already implements correctly for `page=contact`.
- **Fix**: hide the `#contact` block when `Number(params.id) === state.user.id` (i.e.
  always, in this deployment). If it is kept for other ids, port the three validation
  messages from `Contact.jsx`.

### HANDLERS-006 · `index.php?page=login` and `page=register` render a completely blank page (redirect loop)
- **File**: `src/App.jsx:116-119` with `RedirectWithQuery` at `:24-28`
- **What I did (RAN)**: navigated to `/index.php?page=login&sid=…`.
- **What happened**: URL settles on `/?page=login&sid=…` and **`#root` is empty** —
  no header, no footer, no 404 body, `document.body` innerHTML is 87 chars. Cause:
  `RedirectWithQuery to="/"` re-emits the *entire* query string, `page=login` included;
  `/` re-enters `Dispatcher`, matches `case 'login'` again, and renders `<Navigate>`
  (which renders `null`) forever. Same for `page=register`.
- **Should have happened**: `TODO.md` "Out of Scope" specifies the behaviour explicitly —
  *"The source already 302s away from `page=login` and `page=register` when logged in;
  the mock should do the same rather than 404."* A blank page is neither.
- **Note on scope**: login/registration is on the do-not-report list, but this is not
  "login is unimplemented" — it is a render failure on a route whose required behaviour
  that same list dictates, and the fix is one line.
- **Fix**: strip `page`/`action` before redirecting, e.g. return
  `<RedirectWithQueryParams set={{}} …/>`-style navigation to `homeUrl(sid)` carrying
  only `sid`.

---

## P2

### HANDLERS-007 · `Subscribe now!` relabels itself to `Subscribed`; the source's button text never changes
- **File**: `src/pages/Search.jsx:442` (`{done ? 'Subscribed' : 'Subscribe now!'}`)
- **RAN**: after clicking, the button reads `Subscribed`. The source's handler
  (`assets/html/search-default.html:150-160`) is a `$.post` to `page=ajax&action=alerts`
  whose only feedback is the native `alert('You have sucessfully subscribed to the alert')`
  — which the mock reproduces exactly, misspelling and all (good). The label is untouched
  on the source, so an agent re-reading the sidebar sees text that does not exist there.
- **Fix**: drop the `done` state from the label.

### HANDLERS-008 · Alert ids collide after an unsubscribe
- **File**: `src/pages/Search.jsx:423` — `id: (prev.alerts||[]).length + 1`
- **READ**: subscribe ×2 → ids 1,2; unsubscribe #1 → `[{id:2}]`; subscribe again → `id:2`
  again. Use `Math.max(...ids)+1` or a `nextAlertId` counter.

### HANDLERS-009 · `Show filters` is a preventDefault-only no-op
- **File**: `src/pages/Search.jsx:254` — `onClick={e => e.preventDefault()}`
- **RAN**: `a.show-filters-btn` is **not visible at 1280×720** (`.resp-toogle{display:none}`
  above 768 px, `public/css/responsive.css:19`), so no desktop task can reach it. Cosmetic
  only until someone tests at ≤767 px, where it is the *only* way to open the filter panel.

### HANDLERS-010 · Two `.fixed-close` buttons have no handler
- **Files**: `src/pages/Search.jsx:329` (search sidebar), `src/pages/Item.jsx:250`
  (`#contact-in`). `UserSidebar.jsx:46` does wire its own.
- **RAN**: both hidden at 1280 (same media query as HANDLERS-009). Same ≤767 px caveat.

### HANDLERS-011 · Item main photo is a live `href="javascript:;"` with no lightbox
- **File**: `src/pages/Item.jsx:125`
- **RAN**: `a.main-photo` **is visible and clickable at 1280** and does nothing.
  `TODO.md` P2 leaves "Fancybox-style lightbox" unchecked, so this is a known gap, but it
  is the one dead control an agent can actually click on the highest-traffic page.

### HANDLERS-012 · `iPagesize` is accepted and ignored
- **RAN**: `…&sCategory=9&iPagesize=30` still renders 12 cards / `1 - 12 of 1489 listings`.
  `TODO.md` P2 leaves it `[ ]`; `ROUTES.md` §Query Parameters documents 1–50 capped at 50.
  Logged for completeness, not a regression.

### HANDLERS-013 · Publish/Edit currency select is stored but never rendered
- **Files**: `src/pages/ItemForm.jsx:263-267` writes `currency` into `newItems`/
  `itemOverrides`; `src/utils/format.js:14,20` hard-codes `CURRENCY_SYMBOL = '$'`.
- **READ**: publishing with `€`/`£` selected still renders `1234.00 $` everywhere.
  No task uses a non-USD currency, so this is cosmetic — but the control is a
  changes-nothing-observable control by the letter of the check.

### HANDLERS-014 · Change-password succeeds with no state footprint
- **File**: `src/pages/user/ChangePassword.jsx:23-32`
- **RAN**: validation copy fires correctly (`Password cannot be blank`,
  `Passwords don't match`) and a valid submit flashes `Password has been changed` —
  but nothing is written, so `/go` `state_diff` is empty. Deliberate and documented in the
  file header (the mock stores no password), and `stateTracker.js:40-53` correctly omits
  it from `OBSERVABLE_ACTIONS`. Noted only so it is not re-discovered as a silent failure.

---

## Surfaces exercised, and how

| Surface | Method | Result |
|---|---|---|
| Home: search box + category select | RAN | → `page=search&sCategory=9&sPattern=kayak` ✅ |
| Home: 23 category tiles / 7 region links | RAN | 23 / 7 present, both navigate with correct ids ✅ |
| Home: Latest listings | RAN | 12 cards ✅ |
| Search: sort dropdown (3 options) | RAN | menu opens on click *and* hover; hrefs exact; re-sorts ✅ |
| Search: list ⇄ gallery toggle | RAN | class flips, page size stays 12 ✅ |
| Search: pagination + `iPage=124` anchor | RAN | `1477 - 1488 of 1489` ✅ |
| Search sidebar: city / price / bPic / Apply | RAN | all round-trip through the URL and back into the inputs ✅ |
| Search: `Subscribe now!` | RAN | writes `alerts` ✅ / unreadable downstream ❌ **HANDLERS-001** |
| Search: Refine-category links | RAN | 24 unfiltered, 2 when a category is active — matches source ✅ |
| Search: empty state | RAN | copy byte-identical to source (incl. the empty `""` for filter-only misses, verified by curl) ✅ |
| Item: comment post + 5-star rating | RAN | `(4 of 5)`, `comments`+`nextCommentId` in `state_diff` ✅ |
| Item: reply / delete comment / comment paging | RAN | `data-text` blurb, cascade delete, 10-per-page ✅ |
| Item: `Mark as…` | RAN | writes `marks`, flashes ✅ |
| Item: `Contact seller` → empty `#contact-in` | RAN | empty panel, as required — **not** reported ✅ |
| Item: `Share` / send-to-friend | RAN | validation copy + `sendFriendMessages` ✅ |
| Item: own-listing variant (84143) | RAN | no `Mark as…`, `Edit item` link, no e-mail row ✅ |
| User: My listings Edit/Delete + confirm/cancel | RAN | confirm text exact; cancel really cancels ✅ |
| User: publish form (validation + 84155) | RAN | id 84155, `.price 1234.00 $` ✅ / no flash ❌ **HANDLERS-002** |
| User: edit form (task 680 path) | RAN | `.price`/`.desc` both update ✅ / no flash, no mod date ❌ |
| User: delete 84144 → 404 (task 681) | RAN | 404 body renders ✅ |
| User: profile save | RAN | flash + `user` persisted across reload ✅ |
| User: change e-mail / username / password | RAN | validation + flashes ✅ |
| User: delete-account dialog | RAN | opens/closes; buttons inert **by design** (out of scope) ✅ |
| User: site contact form | RAN | validation copy matches `Contact.form.class.php` ✅ |
| User: public profile | RAN | listings ✅ / contact form should not exist ❌ **HANDLERS-005** |
| `/php?page=…` redirect | RAN | preserves the whole query ✅ |
| Console / page errors, whole sweep | RAN | **zero** ✅ |

## Out-of-dimension observations
- (parity) `sCategory[]`, `sCity`-by-name, `bPic` and the deep-page orderings all matched the
  source on the pages I happened to hit; the `parity` shard owns confirming that broadly.
- (pipeline) `saveState` is called from exactly one place (`AppContext.setState`), and every
  mutating handler in the app goes through it — no component holds a mutation in local
  `useState`. The only local-only state is the two documented image pickers.
