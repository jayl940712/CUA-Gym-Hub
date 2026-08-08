# webarena_classifieds_mock — Audit (dimension: state pipeline integrity)

> Date: 2026-08-08
> Audited by: audit agent (pipeline shard)
> Method: **executed**, not read. `npm run dev -- --port 5187` + `npm run preview -- --port 5188`,
> driven with headless chromium at 1280×720; every assertion below reads the real
> `.mock-states/<sid>.json` on disk and the real `GET /go?sid=` response.
> Scripts: `/tmp/cls_pipe.py`, `/tmp/cls_pipe2.py`, `/tmp/cls_pipe3.py`, `/tmp/cls_pipe4.py`, `/tmp/cls_pipe5.py`.

## Summary

| Category | Issues |
|---|---|
| Mutations that never reach state | 1 (P1) |
| `/go` correctness | 2 (1 P0, 1 P1) |
| State budget blowouts | 0 |
| Session isolation breaks | 0 |
| Item precedence breaks | 0 |
| Preview-server gaps | 0 |
| Cosmetic / dead code | 2 (P2) |
| **Total** | **5** |

**14 of 14 mutating actions were driven end to end.** 13 reach `.mock-states/<sid>.json`,
appear in `/go`'s `state_diff`, and survive a page reload. The pipeline is
fundamentally sound; the P0 below is an *injection*-path defect, not a mutation-path
defect.

---

## P0

### PIPELINE-001 · Partial state injection poisons `/go`'s `state_diff`

- **Files**: `vite.config.js:195-202` (`action:'set'` branch), with
  `src/utils/dataManager.js:63-69` and `src/context/AppContext.jsx:12-19`
- **What I ran**:
  ```
  POST /post?sid=pp_part  {"action":"set","state":{"marks":[{"itemId":1,"as":"spam","userId":1}]}}
  → browser loads /index.php?page=contact&sid=pp_part, no user action at all
  → GET /go?sid=pp_part
  ```
- **What I observed**:
  ```
  state_diff keys = ['alerts','comments','contactMessages','deletedItemIds','itemOverrides',
                     'myItems','newItems','nextCommentId','nextItemId','sendFriendMessages','user']
  state_diff.user = { "new": {...Blake...} }     ← no "old" key at all
  initial_state keys = ['marks']                  ← only what was injected
  ```
  Eleven of the twelve state keys are reported as changed before the agent has done
  anything. Any evaluator that reads `state_diff` for a task set up by injection gets
  a false positive on every field.
- **Root cause**: `set` writes the *raw partial* object to **both** `<sid>.json` and
  `<sid>.initial.json` (`writeState` + `writeInitialStateIfMissing`, lines 197-198).
  The client then does `{...createInitialData(), ...customState}`
  (`dataManager.js:65`) and `registerBaseline()` POSTs that **merged** object as
  `set_current`, which overwrites `<sid>.json` only — `.initial.json` is already
  present so it keeps the 1-key partial. Baseline and current are then structurally
  different objects and the shallow diff in `calculateStateDiff` (`vite.config.js:89-97`)
  flags every filled-in default.
- **Control**: injecting a *complete* state (`session_seed.json` + one extra key) gives
  `state_diff = []`. So the defect is specific to partial injection — which is exactly
  what `SCHEMA.md`'s "Minimal Inject Example" tells harnesses to send, and its closing
  line ("Injected keys are merged over `createInitialData()`, so a partial state is
  fine") is currently false.
- **Fix** (one line, server-side, in `vite.config.js`; `createInitialData` is already
  imported at line 7):
  ```js
  if (action === 'set') {
    const newState = { ...createInitialData(), ...data.state }   // was: data.state
    writeState(sid, newState)
    writeInitialStateIfMissing(sid, newState)
  ```
  This makes `.initial.json` identical to what the client will compute, so the diff
  starts empty. Re-run `/tmp/cls_pipe5.py` to confirm `PARTIAL inject diff keys: []`.

---

## P1

### PIPELINE-002 · A mutation can be absorbed into the baseline, emptying `state_diff`

- **Files**: `src/context/AppContext.jsx:36-48`, `vite.config.js:203-211`
- **What I ran**: loaded `?sid=pp_wipe`, deleted `.mock-states/pp_wipe.json` and
  `.mock-states/pp_wipe.initial.json` (simulating a redeploy / a `reset` on a session
  that had no `.initial.json`), reloaded the same tab, then submitted the contact form.
- **What I observed**:
  ```
  after reload, server files present? False        ← registerBaseline never re-ran
  WIPE state_diff keys: []
  initial_state.contactMessages: [{...'after wipe'...}]   ← the mutation IS the baseline
  ```
  The mutation reached disk but is invisible to `/go`.
- **Root cause**: `AppContext.jsx:38` takes the `isRefresh` branch whenever
  `localStorage[initialKey(sid)]` exists, and that branch never calls
  `registerBaseline()`. The first `set_current` after that then satisfies
  `writeInitialStateIfMissing` (`vite.config.js:208`) and becomes the baseline.
- **Fix**: call `registerBaseline(data, s)` on **both** branches — it is idempotent,
  since `set_current` only writes `.initial.json` when it is missing:
  ```js
  if (isRefresh) {
    const data = initializeData(s)
    setStateRaw(data); setLoading(false); registerBaseline(data, s)
  }
  ```
  (Cold deep-links onto auto-mutating routes — `action=mark`, `item_delete`,
  `delete_comment` — were tested separately and are **fine**: `pp_cold` produced
  `state_diff = ['marks']` with `initial_state.marks = []`, so the
  `registerBaseline` / first-mutation POST ordering does not race in practice.)

### PIPELINE-003 · "Change password" writes nothing to state — the action is unobservable

- **File**: `src/pages/user/ChangePassword.jsx:15-32` (no `setState` anywhere in the file;
  it is the only one of the 14 mutating handlers with no state write — confirmed by
  `grep -rn "setState(" src/`)
- **What I ran**: filled `#password` / `#new_password` / `#new_password2`, submitted,
  compared the serialized `.mock-states/pp_user.json` before and after.
- **What I observed**: byte-identical. The flash and the redirect to
  `page=user&action=profile` both fire, so the UI says it worked; `/go` shows nothing.
  Any task phrased "change your password to X" is unscoreable.
- **Fix**: the mock has no auth, so store the fact rather than a secret —
  `user: { ...prev.user, passwordChangedAt: nowStamp() }`, or a `passwordChanges`
  counter. Add the row to `SCHEMA.md`'s Observable State Changes table (it is currently
  and correctly absent).

### PIPELINE-004 · Alert descriptor written in one shape, read in another

- **Files**: writer `src/pages/Search.jsx:419-428`, reader `src/pages/user/Alerts.jsx:32-33`
- **What I ran**: clicked `Subscribe now!` on `?page=search&sCategory=8`, then opened
  `?page=user&action=alerts`.
- **What I observed**: the state row is
  `{"id":1,"userId":1,"email":"…","search":"{\"page\":\"search\",\"sCategory\":\"8\"}","active":1}`
  — correct and faithful to `oc_t_alerts`. But `Alerts.jsx` renders
  `a.description || describe(a)` where `describe()` reads `a.params`, which does not
  exist, so the page shows the literal text **"All listings"** and the link resolves to
  `/index.php?page=search` with the category **dropped**.
- **Fix**: in `Alerts.jsx`, parse the stored descriptor —
  `const p = JSON.parse(a.search || '{}')` — and use it for both the label and the
  `indexUrl(...)` target. Do not change the state shape; `search` as a JSON string is
  what the source column holds.

---

## P2

### PIPELINE-005 · `/go` React page and `computeStateDiff` are unreachable dead code

- **Files**: `src/pages/GoPage.jsx`, `src/utils/stateTracker.js:5-34`, `src/App.jsx:151`
- **Observed**: `curl /go?sid=…` returns the middleware's JSON under **both**
  `npm run dev` and `npm run preview` — the `<Route path="/go">` never renders. The two
  implementations also disagree in shape: the middleware emits top-level keys
  (`{"user":{old,new}}`), `computeStateDiff` emits dot-paths (`{"user.email":{old,new}}`).
- **Fix**: delete `GoPage.jsx`, the `/go` route, and `computeStateDiff`, or add a comment
  marking them as a fallback that must track `calculateStateDiff`. Leaving two diff
  algorithms in the tree invites someone to fix the wrong one.

### PIPELINE-006 · `user.nItems` / `user.nComments` are seeded but never read or updated

- **File**: `src/data/session_seed.json` (`nItems: 12`, `nComments: 1`); `grep -rn "nItems\|nComments" src/` returns **no** reader outside the seed.
- **Observed**: after publishing and deleting a listing, `state.user.nItems` still reads
  `12`. Nothing renders it (My listings and the public profile both count the resolved
  array), so it is inert — but it is a plausible-looking counter an evaluator could be
  pointed at.
- **Fix**: drop both fields from the seed, or maintain them alongside
  `newItems`/`deletedItemIds`/`comments`. Documented as unused in `SCHEMA.md`.

---

## What was verified working (executed, not inferred)

### All 14 mutating actions

| Action | Reaches `<sid>.json` | In `/go` `state_diff` | Survives reload | State file size after |
|---|---|---|---|---|
| post a comment | ✅ | `comments`, `nextCommentId` | ✅ | 1,365 B |
| reply to a comment | ✅ (`replyId` set) | `comments`, `nextCommentId` | ✅ | 1,659 B |
| delete a comment | ✅ (3→1, reply cascaded) | `comments` | ✅ | 1,071 B |
| publish a listing | ✅ (id 84155, `nextItemId`→84156) | `newItems`, `nextItemId` | ✅ | 1,714 B |
| edit a listing | ✅ `itemOverrides[84154] = {title, price}` | `itemOverrides` | ✅ | 1,141 B |
| delete a listing | ✅ `deletedItemIds` | `deletedItemIds` | ✅ | 1,065 B |
| save profile | ✅ `user.name` | `user` | ✅ | 1,140 B |
| change email | ✅ `user.email` | `user` | ✅ | — |
| change username | ✅ `user.username` | `user` | ✅ | — |
| change password | ❌ **PIPELINE-003** | — | — | unchanged |
| subscribe to a search | ✅ `alerts` | `alerts` | ✅ (label wrong, **PIPELINE-004**) | 1,223 B |
| mark an item | ✅ `marks` | `marks` | ✅ | 1,128 B |
| send to a friend | ✅ `sendFriendMessages` | `sendFriendMessages` | ✅ | 1,300 B |
| site contact form | ✅ `contactMessages` | `contactMessages` | ✅ | 1,244 B |

### State budget — clean, no blowout anywhere

- `createInitialData()` on disk = **1,052 bytes** (`<sid>.initial.json`), against the ≈2 KB target.
- Largest file produced by any single mutation: **1,714 B** (publish).
- Worst case probed deliberately: edit a listing replacing its 641-char description with
  4,000 characters → **5,374 B**, and `itemOverrides["84144"]` contained exactly
  `["description","excerpt"]`. **No handler spreads a catalogue row into state.**
- Edit stores only changed fields — a title+price edit produced `["title","price"]` and nothing else.
- Publish stores only the new record in `newItems`; the 84,149-item catalogue and the
  40 MB description shards stay in `src/data/` behind `import.meta.glob` lazy loaders
  (`src/data/catalog.js`), and never enter state.

### Session isolation — clean

- Two sids (`pp_isoA` / `pp_isoB`) in the same browser: A's contact message never
  appeared in B's state file; B's `/go` `state_diff` was `{}`.
- `<sid>.initial.json` written for both, 1,052 B each.
- `/go` diffs correctly against `.initial.json` (`initial_state.contactMessages == []`,
  diff keys `['contactMessages']`).
- sid sanitizer: loading `?sid=ev/../../il_1` wrote `.mock-states/evil_1.json` — no path
  escape. `sid.replace(/[^a-zA-Z0-9_-]/g,'')` is applied in `getStateFile`,
  `getInitialStateFile`, `getFilesDir` and the `/files` handler
  (`vite.config.js:17, 23, 100, 161`), i.e. on every path-forming endpoint.
- `{"action":"reset"}` restored the server state to the baseline and left `state_diff` empty.

### Item precedence (`deletedItemIds → newItems → catalog → itemOverrides`) — clean

- Deleted item 84154: `page=item&id=84154` renders the 404 body; gone from My listings.
- Deleted item 9877 (Boats, cat 8): search counter went **`1 - 12 of 770 listings` →
  `1 - 12 of 769 listings`** and the row left page 1.
- Edited item shows the new value **everywhere** — item page, My listings, and the search
  results card (verified at `?page=search&sCategory=10&iPage=109`, the page where 84144
  actually sits in the newest ordering; an earlier page-1 check failed only because my
  test looked on the wrong page).
- Published item 84155 resolved at `?page=item&id=84155`, appeared in My listings, and
  appeared on page 1 of its category search.

### `vite.config.js` wiring — clean

- `secureMockApiPlugin()` is `plugins[0]` (`vite.config.js:248`); `mock-api` registers the
  same `setupMiddlewares(server)` under **both** `configureServer` and
  `configurePreviewServer` (lines 252-253).
- All five endpoints answered under `npm run dev` (5187) **and** `npm run preview` (5188):
  `/post` ✅ `/state` ✅ `/go` ✅ `/upload` ✅ (400 "multipart required" without a body)
  `/files` ✅ (404 for a missing file). `/index.php?page=…` deep links return 200 under
  preview (SPA fallback intact).
- A full mutation was driven through the **preview** server end to end
  (`sid=prevMut` contact form → `.mock-states/prevMut.json`), so this is not a
  dev-server-only pipeline.

## Out-of-dimension observations

- `Search.jsx`'s `Subscribe now!` uses `window.alert(...)` for its confirmation instead of the source's flash markup (handlers dimension).

## SCHEMA.md updates

Rewritten and now current with what the three dev shards actually built. Changes:
`user` gains the four fields `profile_post` really writes (`regionId`, `cityId`,
`cityArea`, `info`) and `nItems`/`nComments` are marked unused; the exact observed
`newItems` record shape is documented; `alerts` gets the `search`-is-a-JSON-string note
and the PIPELINE-004 caveat; `change_password` is called out as writing nothing;
measured state sizes and the deploy port (8087) are recorded; and the false closing claim
that partial injection "is fine" is replaced with the PIPELINE-001 warning.

---

# Fix pass — dev FIX agent PIPELINE (2026-08-08)

> Method: **executed**, not read. `npm run build` (PASS, 2m51s), then
> `npm run dev -- --port 5190` **and** `npm run preview -- --port 5290`, both driven
> with headless chromium at 1280×720. Every assertion below reads the real
> `.mock-states/<sid>.json` on disk and the real `GET /go?sid=` response.
> Script: `/tmp/cls_fixverify.py` (dev) / `/tmp/cls_fixverify_prev.py` (preview).
> **6/6 assertions PASS on dev and 6/6 on preview.**

| Finding | Status | Files touched |
|---|---|---|
| PIPELINE-001 (P0) partial inject poisons `/go` | **RESOLVED** | `vite.config.js` |
| PIPELINE-002 (P1) baseline skipped on the refresh path | **RESOLVED** | `src/context/AppContext.jsx` |
| PIPELINE-003 (P1) change-password writes nothing | **RESOLVED** | `src/pages/user/ChangePassword.jsx`, `src/utils/stateTracker.js` |
| PIPELINE-004 / HANDLERS-001 (P1) alert shape mismatch | **RESOLVED** | `src/pages/user/Alerts.jsx` |
| PIPELINE-005 (P2) dead `/go` React page + `computeStateDiff` | not in scope this pass | — |
| PIPELINE-006 (P2) inert `user.nItems` / `nComments` | not in scope this pass | — |

## PIPELINE-001 — RESOLVED

`vite.config.js`'s `action:'set'` branch now writes
`{ ...createInitialData(), ...injected }` to both `<sid>.json` and
`<sid>.initial.json` — the same shallow merge `dataManager.initializeData()`
performs client-side, so baseline and boot state are byte-identical objects.
`createInitialData` was **already** imported at `vite.config.js:7` (it backs the
`/go` default), so this adds no new coupling; the state shape still has exactly
one definition, in `src/utils/dataManager.js`.

Ran, on dev **and** preview:

```
POST /post?sid=…  {"action":"set","state":{"marks":[{"itemId":1,"as":"spam","userId":1}]}}
→ browser loads /index.php?page=contact&sid=…, NO user action
→ GET /go
   state_diff keys = []                       (was 11 keys)
   initial_state   = all 12 keys, marks as injected
→ then submit the contact form
   state_diff keys = ['contactMessages']      initial_state.contactMessages = []
```

The invariant the brief asked for — *inject a partial state, take no action, `/go`
reports an EMPTY `state_diff`* — holds. SCHEMA.md's "Minimal Inject Example" is
rewritten accordingly and now documents that the merge is shallow (one level), so
a partial `user` object replaces rather than patches the seeded one.

## PIPELINE-002 — RESOLVED

`AppContext.jsx`'s `isRefresh` branch now calls `registerBaseline(data, s)` too.
It is idempotent — `set_current` only writes `.initial.json` when it is missing.

Reproduced the original defect first, then re-ran after the fix:

```
load ?sid=fixWipe  →  delete BOTH .mock-states/fixWipe*.json  →  reload the same tab
   .mock-states/fixWipe.initial.json present after reload = True   (was False)
→ submit the contact form
   state_diff keys = ['contactMessages']     (was [])
   initial_state.contactMessages = []        (was the mutation itself)
```

## PIPELINE-003 — RESOLVED

`ChangePassword.jsx` now mutates through `setState` in the same shape as
`ChangeEmail`/`ChangeUsername` (one `state.user` update). The source runs
`User::update(['s_password' => osc_hash_password($new)])`
(`controller/user.php:232`) — it stores a **hash**, never the password. The mock
has no auth and no hashing, so it records the fact of the change and **not the
secret**:

- `user.passwordChanges` — integer counter, absent → 1 → 2 … (deterministic, so an
  evaluator can assert "the password was changed")
- `user.passwordChangedAt` — `"YYYY-MM-DD HH:MM:SS"`, the same stamp format
  comments (`pubDate`) and new items (`pub`) use

Ran: filled `#password`/`#new_password`/`#new_password2`, submitted →
redirect to `page=user&action=profile`, flash `Password has been changed`,
`state_diff` keys `['user']`, `user.passwordChanges = 1`,
`user.passwordChangedAt = "2026-08-08 11:49:36"`, and grep of the on-disk state
for the submitted plaintext returns **no hit**. Recorded in SCHEMA.md's state
table and Observable State Changes table; `stateTracker.js:OBSERVABLE_ACTIONS`
gains `change_password: ['user']` and `unsubscribe_alert: ['alerts']`.

## PIPELINE-004 / HANDLERS-001 — RESOLVED (consumer fixed, producer untouched)

`Alerts.jsx` now `JSON.parse`s the stored `search` descriptor. `Search.jsx` was
**not** touched — its record shape matches `oc_t_alerts` and SCHEMA.md.

**The source does not render a label + link.** Read out of the container,
`oc-content/themes/sigma/user-alerts.php` renders, per alert:

```html
<div class="userItem">
  <div class="title-has-actions">
    <h3>Alert 1</h3> <a onclick="…confirm…" href="…action=unsub_alert…">Delete this alert</a>
    <div class="clear"></div>
  </div>
  <div>  <!-- loop.php: <ul class="listing-card-list listing-list items"> --> </div>
</div>
```

i.e. an alert is described by *running its search* and showing the first 12 hits
(`controller/user.php:110-126`: `$search->setJsonAlert(json_decode($a['s_search']))`,
`limit(0, 12)`), with `<br />0 Listings` when nothing matches. That markup and
that copy are now reproduced, over the same catalogue + session-state pipeline the
search page uses (both code paths: precomputed order arrays when unfiltered,
`(sort column, id ASC)` when filtered). The one addition over the source is that
the `<h3>` text is wrapped in a `<Link>` to the reconstructed search URL, so the
alert's own query stays reachable from the page. `Delete this alert` keeps the
source's confirm copy — `This action can't be undone. Are you sure you want to
continue?` — and removes the row from `state.alerts`.

Ran (dev and preview): subscribed on
`?page=search&sCategory=8&sOrder=i_price&iOrderType=asc`, then opened
`?page=user&action=alerts`:

```
state.alerts = [{"id":1,"userId":1,"email":"blake.sullivan@gmail.com",
                 "search":"{\"page\":\"search\",\"sCategory\":\"8\",\"sOrder\":\"i_price\",\"iOrderType\":\"asc\"}",
                 "active":1}]                       ← unchanged, producer untouched
h3            = "Alert 1"
h3 link       = /index.php?page=search&sCategory=8&sOrder=i_price&iOrderType=asc&sid=…
delete link   = "Delete this alert"
listing cards = 12, first price 1.00 $  (price-asc within Boats — correct)
"All listings" anywhere on the page = False        ← was the whole bug
Delete this alert → alerts == [] and the page falls back to
                    "You do not have any alerts yet."
```

Also verified with **two** alerts of different shapes (a category alert and
`sPattern=kayak`): both render their own 12 matching listings, distinct link
targets, zero console/page errors, screenshot at 1280×720 clean.

## Not addressed (out of this shard's brief)

- **PIPELINE-005** (dead `GoPage.jsx` / `computeStateDiff`) — `src/App.jsx` and
  `src/pages/GoPage.jsx` are owned by the parallel dev agent this round, and
  deleting the route needs `App.jsx`. `stateTracker.js:computeStateDiff` is mine
  but is only reachable through `GoPage.jsx`, so removing one without the other
  would break the build. **NEEDS FILE: src/App.jsx, src/pages/GoPage.jsx.**
- **PIPELINE-006** (inert `user.nItems` / `nComments`) — needs
  `src/data/session_seed.json`, which is seed data and must not be edited while
  sharded. Already documented as inert in SCHEMA.md.
