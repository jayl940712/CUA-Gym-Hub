# BUG_P0 — `/go` `state_diff` is silently empty: the RL reward signal is dead

> Status: **open**, investigated 2026-08-07, not fixed except in `webarena_reddit_mock`
> Severity: **P0 for RL/`/go` consumers · not applicable to WebArena benchmark scoring** (see §2)
> Scope: **85 of 97 mocks** carry at least one half of the defect
> Reference implementation (correct): `websites/webarena_reddit_mock/vite.config.js`

---

## 1. The bug in one paragraph

`GET /go?sid=<sid>` returns `{initial_state, current_state, state_diff}`. `README.md`
says *"RL reward functions consume this diff"*, and `WEBARENA_MIGRATION.md`'s
Definition of Done requires *"`/go?sid=` `state_diff` reflects every mutating action
in `SCHEMA.md`'s Observable State Changes table"*. On most mocks that diff comes back
**empty even when the agent successfully performed the task**. The page renders
correctly, the mutation is in `current_state`, the UI shows it — only the *diff*
is wrong. A benchmark run therefore completes normally and reports every
state-graded task as failed.

`SANDBOX_COMPLETENESS_GUIDE.md` §6 already states the invariant this violates:

> The initial baseline must be created **before** the first mutation so diffs are stable.

---

## 2. Who this affects — read before prioritising

**NOT affected: WebArena benchmark scoring.** All 192 `shopping` tasks in
`/webarena/webarena.jsonl` grade via `string_match` (88), `program_html` (47),
`url_match` (42), `url_match+program_html` (15). **None read `/go`.** If WebArena
evaluation is the only consumer, this bug costs nothing today and is a latent
spec violation rather than a live failure.

**Affected: anything using these mocks as RL environments**, i.e. the `/go`
`state_diff` reward path described in `README.md`. For those, the reward signal is
dead on any session the harness did not explicitly seed with `action: 'set'`.
Neither mock client ever calls `set` on its own — only the harness does — so a
plain browsing rollout has no baseline at all.

**Decide this first.** It is the difference between a 3-file fix and an 85-file
campaign.

---

## 3. Root cause — TWO defects, both must be fixed

A mock is only correct when both halves are right. Fixing A alone makes things
**worse** (see the severity table below).

### Defect A — `set_current` writes the baseline

```js
if (action === 'set_current') {
  const newState = data.merge ? deepMerge(currentState, data.state) : data.state
  writeState(sid, newState)
  writeInitialStateIfMissing(sid, newState)   // <-- WRONG
  ...
}
```

On a fresh session the first mutation becomes the baseline, so `initial == current`
and that mutation is invisible forever.

**The contract** (implemented correctly in `shared/secureMockApiPlugin.mjs:277-279`):

```js
if (action === 'set' || action === 'set_current') {
  writeJson(statePath(sid), data.state || {});
  if (action === 'set') writeJson(initialPath(sid), data.state || {});  // baseline ONLY on 'set'
}
```

`set` seeds the baseline. `set_current` records a later state and must never touch it.

### Defect B — `/go` falls back to the current state

```js
const initial = initialState || currentState || defaultState   // <-- WRONG
```

When no baseline file exists this compares the session against itself, so the diff
is **always** empty. Correct form:

```js
const initial = initialState || defaultState
```

A never-seeded sid then baselines against `createInitialData()`, which is what the
client boots from — so the two agree by construction and an untouched session
correctly reports an empty diff.

### Severity ordering (counter-intuitive)

| state | effect |
|---|---|
| **B only** (42 mocks) | **ALL mutations invisible, permanently** — worst |
| **A only** (7 mocks) | first mutation swallowed; later ones visible |
| **A + B** (36 mocks) | A writes a baseline on first mutation, so it degrades to A's behaviour |
| clean (12 mocks) | correct |

**Consequence: never fix A without also fixing B on the same mock**, or you promote
it from the A category into the B category and make it worse.

---

## 4. Live reproduction (measured 2026-08-07)

**Broken — `webarena_shopping_mock` (defect B, line 320):**

```
$ npm run dev -- --port 5254
$ curl "/go?sid=fresh_s1"                                  -> state_diff: (EMPTY)
$ curl -X POST "/post?sid=mut_s1" -d '{"action":"set_current","merge":true,
      "state":{"wishlist":[{"id":999}]}}'
$ curl "/go?sid=mut_s1"                                    -> state_diff: (EMPTY)   # invisible
$ # second mutation
$ curl "/go?sid=mut_s1"                                    -> state_diff: (EMPTY)   # still invisible
```

**Correct — `webarena_reddit_mock` (both halves fixed):**

```
$ curl "/go?sid=fresh_r1"                                  -> state_diff: (empty)   # correct
$ curl -X POST "/post?sid=mut_r1" -d '{"action":"set_current","merge":true,
      "state":{"subscriptions":["news"]}}'
$ curl "/go?sid=mut_r1"                                    -> state_diff: ['subscriptions']
```

Note `state_diff` is a **JSON object**, not an array — assertions should test
emptiness, not `== []`.

---

## 5. Measured scope

Run `python3 shared/check-state-contract.py` (added 2026-08-07) for the live figure.
As of 2026-08-07:

```
scanned 97 mocks
  clean (both halves correct) : 12
  defect A only (set_current) :  7
  defect B only (/go fallback): 42
  BOTH defects                : 36
  no set_current branch       :  5   (different shape — inspect individually)
  -> needing work             : 85
```

| mock | state | notes |
|---|---|---|
| `webarena_reddit_mock` | **clean** | fixed 2026-08-06; use as the reference |
| `webarena_shopping_mock` | **B** | all mutations invisible |
| `webarena_shopping_admin_mock` | **B** | all mutations invisible; also has a `set_initial` verb |
| `mixpanel_mock` | **A+B** | the scaffold template — see §8 |

---

## 6. Why it spread

`WEBARENA_MIGRATION.md:333`, `.claude/agents/dev.md:170`, `.claude/commands/dev.md:123`
and `.claude/agents/plan.md:321` all instruct agents to scaffold from
`websites/mixpanel_mock`, which carries both defects. Every migration inherits it,
rediscovers it during its own audit round, and fixes it locally — shopping,
shopping_admin and reddit each paid a fix round for the same bug.

`shared/secureMockApiPlugin.mjs` was always correct, and all 97 mocks import it —
but it hands off to each mock's inline dev-mode handler unless hardened mode is on:

```js
// secureMockApiPlugin.mjs:363
if (isLegacyCompatEnabled()) return next();
```

`CUA_GYM_LEGACY_COMPAT` defaults to enabled, so **the buggy inline handler serves
`/post` in normal use**. Hardened deployments (`CUA_GYM_HARDENED=1`, see `DEPLOY.md`)
are unaffected.

---

## 7. How to fix

### 7.1 Detection

```bash
python3 shared/check-state-contract.py          # full report, exit 1 if any violation
python3 shared/check-state-contract.py --list   # affected mock names only
```

The checker strips comments before matching — an early version produced false
positives by matching explanatory comments rather than code. Keep that behaviour.

### 7.2 Defect B — nearly uniform, scriptable

Delete `|| currentState` (or `|| current`) from the `initial` assignment. 10 forms
across 118 occurrences; two cover 101 of them:

- **55x** `const initial = initialState || currentState || defaultData`
- **46x** `const initial = initialState || currentState || {}`
- **4x** `const initial = initialState || currentState || {}; const current = currentState || initial`
- **3x** `const initial = initialState || currentState || defaultData;`
- **3x** `const initial = initialState || currentState || defaultState` — `mixpanel_mock`, `webarena_shopping_mock`, `webarena_shopping_admin_mock`
- **2x** `const initial = initialState || currentState || {};` — `Zendesk_mock`, `meta_ads_mock`
- **2x** `const initial = initialState || currentState || generateInitialData(); ...` — `instagram_mock`
- **1x** `const initial = initialSt || currentState || {}` — `Canvas-LMS_mock` (**note the truncated identifier — likely a pre-existing typo, inspect**)
- **1x** `const initial = readJSON(ip) || current` — `clio_mock` (**different shape, hand-edit**)
- **1x** `const initial = initialState || currentState || createInitialData()` — `looker_studio_mock`

Leave the third operand (`defaultData` / `{}` / `createInitialData()`) untouched.
**Do not** also strip `const current = currentState || initial` — that one is correct.

### 7.3 Defect A — 21 variants, needs per-group reasoning

Remove the baseline write from the `set_current` branch. These are **not** all the
same bug; some are partial mitigations that behave differently when deleted.

- **8x** `writeInitialStateIfMissing(sid, newState)` — the naive form; delete outright
  - `amazon_seller_mock, datadog_mock, ebay_mock, hotjar_mock, klaviyo_mock, mailchimp_mock, mixpanel_mock, sentry_mock`
- **5x** `writeInitialStateIfMissing(sid, data.initialState || (currentState && Object.keys(currentState).length ? currentState : newState))`
  - `circleci_mock, facebook_mock, instagram_mock, pinterest_mock, youtube_mock`
- **5x** `if (!hasMeaningfulState(existingInitial)) writeInitialState(sid, initial)`
  - `confluence_mock, gitlab_mock, microsoft_teams_mock, miro_mock, monday_mock`
- **3x** `writeInitialState(sid, Object.keys(currentState).length > 0 ? currentState : newState)`
  - `airtable_mock, github_mock, notion_mock`
- **3x** `writeInitialStateIfMissing(sid, readInitialState(sid) || readState(sid) || newState)`
  - `canva_mock, canvas_mock, postman_mock`
- **2x** `writeInitialState(sid, baseline)` — `amazon_mock, trello_mock`
- **2x** `writeInitialState(sid, currentState || newState)` — `paypal_mock, uber_eats_mock`
- **2x** *(indirect — no literal call on one line; inspect manually)* — `google_flights_mock, instacart_mock`
- **1x each**: `Zendesk_mock`, `azure_mock`, `cloudflare_mock`, `coinbase_mock`,
  `google_calendar_mock`, `google_docs_mock`, `greenhouse_mock`, `outlook_web_mock`,
  `robinhood_mock`, `salesforce_mock`, `tripadvisor_mock`, `vercel_mock`, `zoom_web_mock`

Use a balanced-brace parser to isolate the `set_current` body — **do not use a bare
`sed`**, several mocks have similar-looking statements in the `set` branch that are
correct and must stay.

### 7.4 Reference diff

`webarena_reddit_mock/vite.config.js`, applied 2026-08-06, is a working example of
both halves. Its `/go` carries an explanatory comment worth copying.

---

## 8. Stopping the spread

The template `mixpanel_mock` is `A+B`. Two options:

1. **Fix `mixpanel_mock` itself.** Simple, but it is one of the protected commercial
   mocks — `.claude/commands/dev.md:20` says *"Do not overwrite them."* Needs an
   explicit human decision, not an agent's initiative.
2. **Fix the instructions instead** (non-invasive, and broader — it also covers
   scaffolding from any *other* defective mock). Add to `WEBARENA_MIGRATION.md`,
   `.claude/agents/dev.md`, `.claude/agents/plan.md`, `.claude/commands/dev.md`:

   > Scaffold from `websites/mixpanel_mock`, but **do not copy its `set_current`
   > handler or its `/go` initial fallback** — both violate the state contract. Use
   > `shared/secureMockApiPlugin.mjs` as the reference: `set` seeds the baseline,
   > `set_current` never touches it, and `/go` must not fall back to the current
   > state. Run `python3 shared/check-state-contract.py` before finishing a round.

Also add the checker to `.claude/agents/audit.md`'s pipeline dimension so every
round verifies it instead of rediscovering it.

---

## 9. Verification

Per fixed mock:

```bash
export PATH="/tmp/node-v20.18.1-linux-x64/bin:$PATH"
cd websites/<mock> && npm run dev -- --port <free> --strictPort &

# 1. untouched sid must report an EMPTY diff
curl -s "http://127.0.0.1:<port>/go?sid=fresh1" | python3 -m json.tool | grep -A2 state_diff

# 2. a mutation on a NEVER-SEEDED sid must become visible
curl -s -X POST "http://127.0.0.1:<port>/post?sid=mut1" \
  -H 'Content-Type: application/json' \
  -d '{"action":"set_current","merge":true,"state":{"<some_key>":"<value>"}}'
curl -s "http://127.0.0.1:<port>/go?sid=mut1"          # -> state_diff must contain <some_key>

# 3. a second mutation must also be visible
# 4. static check must pass
python3 shared/check-state-contract.py                  # exit 0
```

**Use `merge: true` and a small payload.** A payload that replaces a whole
collection produces an enormous, unreadable diff.

### The assumption fix B depends on

`initial = initialState || defaultState` is only sound if the server's
`createInitialData()` matches what the client boots from. **Verified true for
`webarena_reddit_mock`** (untouched sid → empty diff). **Unverified for every other
mock.** If a mock's server default diverges from its client seed, an untouched
session will report a spurious non-empty diff — a false positive, which is worse
than the current false negative. Step 1 of the verification above is exactly this
check; do not skip it.

---

## 10. Practical constraints

- **Only 3 of 101 mocks have `node_modules` installed** (`webarena_reddit_mock`,
  `webarena_shopping_mock`, one other). Empirical verification of the others
  requires `npm install` per mock. This, not the edits, is the real cost.
- **`.mock-states/` is gitignored** (0 tracked files). Stale baselines written by the
  buggy path are runtime-only; deleting the directory or calling
  `{"action":"reset"}` clears them. No migration needed.
- **`SCHEMA.md` files need no changes** — they document the contract the fix restores.
- **No shared-module shortcut exists.** The 97 inline handlers are **85 distinct
  implementations**; the largest identical group is 3. Refactoring them all to
  delegate to `secureMockApiPlugin.mjs` is a larger job than the targeted edits.
- **`set_initial` divergence:** `webarena_shopping_mock` and
  `webarena_shopping_admin_mock` added a `set_initial` verb; `webarena_reddit_mock`
  did not, and `shared/secureMockApiPlugin.mjs` **rejects it with `400 Unknown
  action`** — so that verb does not exist under `CUA_GYM_HARDENED=1`. Decide whether
  to standardise or drop it as part of this work.

---

## 11. Recommended order

1. **Decide §2** — is anything consuming `/go` reward diffs? If no, everything below
   is optional cleanup.
2. **`webarena_shopping_mock` + `webarena_shopping_admin_mock`** — defect B only,
   one line each, `node_modules` present for at least one, fully verifiable. These
   are broken *today*.
3. **Stop the spread** — §8, preferring the instruction-layer option.
4. **Defect B across the remaining ~78** — uniform, scriptable, static verification.
5. **Defect A across the remaining ~40** — the expensive half. Only worth doing if
   §2 says yes.

**Do not** fix A on a mock without fixing B on the same mock (§3).

---

## 12. Artifacts

- `shared/check-state-contract.py` — detector for both defects, exits 1 on violation
- `websites/webarena_reddit_mock/vite.config.js` — correct reference implementation
- `shared/secureMockApiPlugin.mjs:277-279` — the canonical contract
- `SANDBOX_COMPLETENESS_GUIDE.md` §6 — the invariant, already written down
- `WEBARENA_MIGRATION.md` Definition of Done — the checklist item this violates
