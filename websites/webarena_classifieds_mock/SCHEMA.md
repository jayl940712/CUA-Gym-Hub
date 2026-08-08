# webarena_classifieds_mock Schema

**Base URL**: `http://localhost:8087/` (position of `webarena_classifieds_mock` in
`deploy-all.sh`'s alphabetical sweep from 8000; re-derive after adding any mock)
**Go Endpoint**: `GET /go?sid=<sid>` → `{initial_state, current_state, state_diff}`
**Inject**: `POST /post?sid=<sid>` with body `{"action":"set","state":{...}}`
**Update**: `POST /post?sid=<sid>` with body `{"action":"set_current","state":{...}}`
**Reset**: `POST /post?sid=<sid>` with body `{"action":"reset"}`
**State read**: `GET /state?sid=<sid>` → `{stored_state, has_custom_state, sid}`
**Uploads**: `POST /upload?sid=<sid>` (multipart) → `{files:[{url:"/files/<sid>/<name>"}]}`

State files live at `.mock-states/<sid>.json` and `.mock-states/<sid>.initial.json`;
`sid` is sanitised with `sid.replace(/[^a-zA-Z0-9_-]/g, '')` on every path-forming
endpoint. All five endpoints are served under **both** `npm run dev` and
`npm run preview` (`vite.config.js` registers the same middleware stack under
`configureServer` and `configurePreviewServer`).

---

## Two tiers — read this before injecting anything

The site has **84,149 listings**. They are **NOT** in the session state and must
never be put there: `/go` serialises and diffs the whole state object on every
call. The catalogue is static reference data under `src/data/catalog/` and
`src/data/descriptions/` (74.6 MB on disk), loaded lazily by `src/data/catalog.js`.

Session state is only the **mutable** slice. Measured on disk:

| | bytes |
|---|---|
| `createInitialData()` (`<sid>.initial.json`) | **1,052** |
| after any single mutation | 1,065 – 1,714 |
| worst case probed (edit replacing a description with 4,000 chars) | 5,374 |

A task that needs a different listing does not inject a listing — it injects an
*override* (`itemOverrides`), a *deletion* (`deletedItemIds`) or a *creation*
(`newItems`).

## State Schema

| Key | Type | Description |
|-----|------|-------------|
| `user` | object | The single `oc_t_user` row — Blake Sullivan. Seeded: `{id:1, name:"Blake Sullivan", username:"1", email:"blake.sullivan@gmail.com", regDate:"2023-10-27 21:12:11", phoneLand:"", phoneMobile:"", website:"", country:"", region:"", city:"", address:"", zip:"", isCompany:0, nItems:12, nComments:1, profileImg:null}`. `username` really is the string `"1"`. **`profile_post` additionally writes `regionId`, `cityId`, `cityArea`, `info`** (absent from the seed, present after the first profile save). **`change_password` additionally writes `passwordChanges` (integer, absent → 1 → 2 …), `passwordChangedAt` (`"YYYY-MM-DD HH:MM:SS"`) and `passwordHash` (see below).** The source stores `s_password` as a hash (`controller/user.php:232`); the mock has no auth, so it records the *fact* of the change and **never the password itself** — assert on `user.passwordChanges`, not on a secret. **`nItems` / `nComments` are inert** — nothing reads them and no mutation updates them; do not use them as counters. `profileImg` stays `null`: the profile picture is previewed locally only, never stored (a data URL would blow the state budget). |
| `comments` | array | Item comments. Each: `{id, itemId, pubDate, title, authorName, authorEmail, body, rating(1..5\|null), userId, replyId}`. `replyId` is `null` for a root comment, otherwise the parent comment's id. Seeded with the entire source table: **one** row, id 1 on item 10727. |
| `myItems` | number[] | Item ids owned by the logged-in user — `[84143 … 84154]` (Blake's 12 listings). Not appended to on publish; "My listings" is the union of `myItems` and `newItems` minus `deletedItemIds`. |
| `itemOverrides` | object | `{ "<itemId>": {…only the fields that changed} }`, merged on top of the resolved item at read time. Written by `item_edit_post`. Keys are the catalogue row names (`title`, `price`, `cat`, `city`, `cityId`, `regionId`, `regionIdx`, `cityArea`, `address`, `phone`, `showPhone`, `contactOther`, `currency`) plus `description` + `excerpt`, which shadow the description shard, plus `modDate` (`"YYYY-MM-DD HH:MM:SS"`), which `ItemActions.php:784` stamps on **every** `item_edit_post` — even a no-op one — and which the item page renders as `Modified date: YYYY/MM/DD`. A title+price edit stores exactly `{"title":…,"price":…,"modDate":…}` — never a whole row. |
| `deletedItemIds` | number[] | Ids removed by `item_delete`. A deleted id renders the 404 body and disappears from every listing **and from the search result counter**. |
| `newItems` | array | Listings created by `item_add_post`. Observed record: `{id, cat, price, pub, title, name, email, city, regionIdx, regionId, cityId, cityArea, address, phone, showEmail, showPhone, imgExt, excerpt, description, contactOther, currency, userId}`. |
| `nextItemId` | number | Next id to hand out. Seeded **84155** = the source `AUTO_INCREMENT`. Load-bearing: tasks 684/685 read `.price` on the page the new id lands on. |
| `nextCommentId` | number | Next comment id. Seeded `2`. |
| `contactMessages` | array | Written by **two** forms: the site-wide contact form (`{name, email, subject, message, date}`) and the seller-contact form on a public profile (same plus `toUserId`, `phone`). |
| `sendFriendMessages` | array | `send_friend_post` submissions: `{itemId, yourName, yourEmail, friendName, friendEmail, subject, message}`. |
| `alerts` | array | Saved-search subscriptions. Each: `{id, userId, email, search, active}` where **`search` is a JSON *string*** of the search params, e.g. `"{\"page\":\"search\",\"sCategory\":\"8\"}"` — this mirrors `oc_t_alerts.s_search`. The producer is `Search.jsx`'s `Subscribe now!`; the consumer `src/pages/user/Alerts.jsx` `JSON.parse`s `search` and re-runs that query over the catalogue, exactly as `controller/user.php:110-126` does (PIPELINE-004 fixed — it used to read a non-existent `a.params`/`a.description` and render "All listings"). |
| `marks` | array | "Mark as…" reports. Each: `{itemId, as, userId}` where `as` ∈ `spam\|badcat\|repeated\|expired\|offensive`. |

### `user.passwordHash` — how "current password" is verified without a secret

The source refuses a change whose *current password* is wrong
(`controller/user.php:216-219` → flash `Current password doesn't match`). The mock
used to accept anything, which is TEST **BUG-B**. Reproducing the check needs
*something* to compare against, and the constraint from AUDIT PIPELINE-003 is that
the plaintext must never enter the state.

The resolution mirrors what the source actually does — it stores a **hash**, not a
password:

| | |
|---|---|
| Key | `user.passwordHash` — hex digest of the **current** password |
| Written by | `change_password` on success only |
| Seeded? | **No.** `session_seed.json` has no such key. **Absent means "still the deployment's seeded credential"**, and the check falls back to a constant digest in `src/pages/user/ChangePassword.jsx` (`SEEDED_PASSWORD_HASH`) |
| Digest | FNV-1a/32, `hashPassword()` in that same file — deterministic, dependency-free, one-way |

**Compromises, stated plainly.**

1. `session_seed.json` carries **no credential of any kind**, so the "is this the
   original password?" question can only be answered against a constant compiled
   into the page. That constant is the *digest* of the credential documented under
   *Auth* in `SOURCE.md` — the plaintext appears in neither the state nor the
   source tree. No password was invented and no seed file was changed.
2. FNV-1a is not a password hash and is not pretending to be one. There is no auth
   in the mock and nothing to defend; its only job is to make the wrong-password
   branch reachable. Do not read `user.passwordHash` as a security boundary.
3. An evaluator should still assert on **`user.passwordChanges`**, never on
   `passwordHash` — the digest is an implementation detail and may change.

Injecting `user` replaces the whole sub-object (the merge is shallow), so a task
that wants the change-password flow to start from the seeded credential should
simply omit `passwordHash`; one that wants a *different* current password should
inject the digest of it.

### Default IDs

- User: `id 1`, Blake Sullivan, `blake.sullivan@gmail.com`, username `"1"`
- Blake's listings: `84143 … 84154` (12 items)
- Seeded comment: `id 1` on item `10727`
- First id a publish hands out: `84155`; first comment id: `2`
- Catalogue: ids `1 … 84154` with five gaps (4688, 11903, 13241, 57186, 84142), categories `2 … 24`

### Item resolution precedence (assets/data_model.md §0)

```
deletedItemIds  →  newItems  →  static catalogue  →  itemOverrides
```

`src/data/catalog.js` implements this in `getItem(id, state)` /
`getItemFrom(id, state, byId)`. Verified end to end: a deleted item 404s and drops
the search counter, an edited item shows its new values on the item page, in My
listings and on its search-results card, and a published item resolves at its own
URL and appears in search.

## Observable State Changes (for LLM evaluation)

Every mutation flows through `AppContext.setState` → `saveState()` →
`POST /post?sid=…` with `{"action":"set_current"}` → visible in `/go`'s `state_diff`.

| Action (source route) | Trigger in UI | State keys changed |
|---|---|---|
| `page=item&action=item_add_post` | Publish a listing | `newItems` (push), `nextItemId` (+1) |
| `page=item&action=item_edit_post` | Edit own listing | `itemOverrides["<id>"]` (changed fields **plus `modDate`**, which is stamped on every edit) |
| `page=item&action=item_delete&id=N` | Delete own listing | `deletedItemIds` (push) |
| `page=item&action=add_comment` | Post a comment | `comments` (push), `nextCommentId` (+1) |
| `page=item&action=add_comment` with `replyId` | Reply to a comment | `comments` (push, `replyId` set), `nextCommentId` (+1) |
| `page=item&action=delete_comment&id=N&comment=C` | Delete own comment | `comments` (remove, replies cascade) |
| `page=item&action=mark&id=N&as=…` | "Mark as…" select | `marks` (push) |
| `page=item&action=send_friend_post` | Send to a friend | `sendFriendMessages` (push) |
| `page=contact` submit | Site contact form | `contactMessages` (push) |
| `page=user&action=pub_profile` contact form | Message the seller | `contactMessages` (push, with `toUserId`) |
| `page=user&action=profile_post` | Save profile | `user` (name, isCompany, phones, country, region, regionId, city, cityId, cityArea, zip, address, website, info) |
| `page=user&action=change_email` submit | Change e-mail | `user.email` |
| `page=user&action=change_username` submit | Change username | `user.username` |
| `Subscribe now!` (search sidebar) | Subscribe to this search | `alerts` (push) |
| `page=user&action=unsub_alert&email=…&id=N` | `Delete this alert` on `page=user&action=alerts` (confirm-gated) | `alerts` (remove) |
| `page=user&action=change_password` submit | Change password (**valid current password only**) | `user.passwordChanges` (+1), `user.passwordChangedAt` (stamp), `user.passwordHash` (digest of the new password). **The password itself is never stored** — the source keeps a hash, the mock keeps only the fact of the change plus a one-way digest (AUDIT PIPELINE-003 + TEST BUG-B, fixed). A **rejected** attempt — wrong current password, blank field, or mismatched new passwords — writes **nothing**: `state_diff` stays `{}` |

Read-only routes (`page=search`, `page=item` view, pagination, sorting, the
list/gallery toggle, region/city refinement) change **no** state — they are pure
URL-driven views over the static catalogue.

## Minimal Inject Example

**A partial `set` is fine — inject only the keys you care about.** The server
merges the injected object over `createInitialData()` before writing **both**
`<sid>.json` and `<sid>.initial.json` (`vite.config.js`, `action:'set'` branch),
which is the same shallow merge the client performs in
`dataManager.initializeData()`. Baseline and boot state are therefore identical
objects and `/go` starts from an empty diff.

The merge is **shallow, one level deep**: injecting
`"user": {"email": "x@y.z"}` replaces the whole `user` object rather than
patching it, so send the complete sub-object for any key you touch.

Verified on dev **and** preview (AUDIT PIPELINE-001, fixed): inject
`{"marks":[{"itemId":1,"as":"spam","userId":1}]}`, load a page, take no action →
`state_diff == {}` and `initial_state` has all 12 keys with `marks` as injected;
then submit the contact form → `state_diff == ['contactMessages']` with
`old == []`. Before the fix the same sequence produced 11 spurious diff keys.

Minimal form (pre-delete item 84144 so `index.php?page=item&id=84144` 404s):

```json
{ "action": "set", "state": { "deletedItemIds": [84144] } }
```

Full-state form — the same setup with every key pinned explicitly:

```json
{
  "action": "set",
  "state": {
    "user": {
      "id": 1, "name": "Blake Sullivan", "username": "1",
      "email": "blake.sullivan@gmail.com", "regDate": "2023-10-27 21:12:11",
      "phoneLand": "", "phoneMobile": "", "website": "", "country": "",
      "region": "", "city": "", "address": "", "zip": "",
      "isCompany": 0, "nItems": 12, "nComments": 1, "profileImg": null
    },
    "comments": [
      {
        "id": 1, "itemId": 10727, "pubDate": "2023-11-19 05:46:22",
        "title": "Hello!", "authorName": "Blake Sullivan",
        "authorEmail": "blake.sullivan@gmail.com", "body": "Nice bracelet",
        "rating": 3, "userId": 1, "replyId": null
      }
    ],
    "myItems": [84143, 84144, 84145, 84146, 84147, 84148, 84149, 84150, 84151, 84152, 84153, 84154],
    "itemOverrides": {},
    "deletedItemIds": [84144],
    "newItems": [],
    "nextItemId": 84155,
    "nextCommentId": 2,
    "contactMessages": [],
    "sendFriendMessages": [],
    "alerts": [],
    "marks": []
  }
}
```

Other setups, as the `state` keys to change from that baseline:

```jsonc
// pre-edit item 84144's price to 25000.00
"itemOverrides": { "84144": { "price": 25000000000 } }

// pre-subscribe to the Boats search
"alerts": [{ "id": 1, "userId": 1, "email": "blake.sullivan@gmail.com",
             "search": "{\"page\":\"search\",\"sCategory\":\"8\"}", "active": 1 }]
```

Prices are integers of **dollars × 1,000,000**; `25000000000 / 1e6` renders as
`25000.00 $` (trailing symbol, 2 decimals, no thousands separator).
