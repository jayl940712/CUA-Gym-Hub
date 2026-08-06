# WebArena Migration Workflow

You are now in **WebArena Migration Mode**: rebuilding a locally-hosted WebArena
website as a self-contained CUA-Gym-Hub mock app.

**Read `WEBARENA_MIGRATION.md` at the repo root first.** It defines the migration
contract, the site inventory, docker recon commands, and the data sampling
strategy. This file is the operational workflow on top of it.

## Inputs

```
SITE:         <short name, e.g. reddit>
WEBARENA_URL: <http://host:port/path>   — the live, locally-hosted site
DOCKER_IMAGE: <e.g. postmill-populated-exposed-withimg>
```

Target: `websites/webarena_<SITE>_mock/`. **Always keep the `webarena_` prefix** —
`websites/` already holds `gitlab_mock`, `reddit_mock`, `amazon_mock`, and
`shopify_admin_mock` that mock the real commercial products. Do not overwrite them.

If the arguments are missing, check `WEBARENA_MIGRATION.md` §2 for the inventory,
or derive the URL from `/webarena/webarena-setup/webarena/00_vars.sh`.

---

## The One-Paragraph Version

The container is the ground truth, not your memory of the product. Extract the
site's routes, DOM, copy, design tokens, and a curated sample of its **real
data** — then rebuild the user-visible surface as a React SPA with no server, no
database, and no auth. Preserve URLs and identifiers exactly, because WebArena
evaluators match on them. Everything runs client-side over a frozen JSON seed,
isolated per `?sid=` so parallel RL rollouts don't collide.

---

## Phase 0: Preflight

```bash
curl -s -o /dev/null -w 'site: %{http_code}\n' --max-time 10 --noproxy '*' "$WEBARENA_URL"
docker ps --filter ancestor="$DOCKER_IMAGE" 2>&1 | head -5
sudo -n docker ps 2>&1 | head -3        # only if the socket is root-only
```

- **site 200 + docker OK** → FULL mode.
- **site 200 + docker denied** → DEGRADED mode. HTTP/DOM recon only; say so in
  `SOURCE.md`.
- **site down + docker OK** → `docker start <container>`, poll up to 120s.
- **neither** → stop and report what the operator must fix.

Always `--noproxy '*'` on curl in this environment.

**Read-only rule:** never mutate a WebArena container. No writes through the
source UI, no `UPDATE`/`INSERT`/`DELETE` via `docker exec`. A polluted instance
invalidates the benchmark for everyone using it.

---

## Phase 1: Recon (parallel subagents)

Spawn both at once — they don't depend on each other.

**Every spawn must pass `mode="bypassPermissions"` explicitly — never omit it and
never assume the agent inherits it from you.** A `Task(...)` without `mode` still
reports "launched successfully", so the mistake is invisible: the agent runs a few
tools, then silently stalls at an approval prompt nobody is watching. The
signature is completed tool calls, NO api error, then silence. (A real crash looks
different: zero tool calls plus an api error.) Run the session with
`--dangerously-skip-permissions` as well — that is not a substitute for passing
`mode` on each spawn. Do both.

```
SUBAGENT 1 — Route & Structure Recon:
Task(subagent_type="Explore", mode="bypassPermissions", prompt="
  Crawl <WEBARENA_URL> with the Playwright tools, logged in as the default
  WebArena user (credentials in WEBARENA_MIGRATION.md §2).

  1. Breadth-first from the entry URL. Click every nav item, list item, tab,
     pager, and form submit. Record the resulting URL each time, including
     query params and what they do.
  2. Save raw HTML per route to assets/html/<slug>.html
  3. Screenshot every major view at 1440x900 to assets/screenshots/reference/
  4. Extract the palette, fonts, and spacing from the site's own CSS
  5. Report: route table (path, params, view, priority), per-view layout notes,
     exact visible strings (labels, column headers, empty states, validation)
")

SUBAGENT 2 — Data & Schema Recon:
Task(subagent_type="Explore", mode="bypassPermissions", prompt="
  Inspect the container behind <DOCKER_IMAGE>.

  1. Discover DB credentials: docker exec <c> env | grep -iE 'db|password',
     or app config (Magento: app/etc/env.php)
  2. List tables, identify the entities behind each view found by subagent 1
  3. Sample real rows — 20-60 per major list view, full detail for linked
     records. Keep real ids, slugs, usernames, prices, timestamps verbatim.
  4. Export to assets/dumps/*.jsonl
  5. Report: entity list with real field names/types, relationships, PK formats,
     row counts sampled, and total seed size estimate
")
```

Consolidate into `SOURCE.md`, `ROUTES.md`, `DESIGN.md`, `assets/data_model.md`,
and curated `src/data/*.json`. Then write `TODO.md` (P0 shell+routing+pipeline,
P1 core workflows, P2 depth, plus an explicit Out of Scope section).

For a full autonomous run, use the `plan` agent (`.claude/agents/plan.md`)
instead — it produces all of these artifacts in one pass.

---

## Phase 2: Build

Scaffold from `websites/mixpanel_mock` (the most complete structural template),
then implement `TODO.md` P0 → P1 → P2, marking `ROUTES.md` rows `[x]` as you go.

Non-negotiables while building:

- **Routes verbatim.** Source paths, path params, and query params exactly as
  `ROUTES.md` records them. Query params must drive behavior, and UI controls
  must write back to the URL.
- **Deep links work cold.** An agent may land on
  `/admin/sales/order/view/order_id/299?sid=x` with empty localStorage.
- **Real identifiers.** Load `src/data/*.json` as-is. Never renumber, rename, or
  regenerate. If the seed lacks something, go back to the container — do not invent.
- **No network, no DB, no auth.** Search/sort/filter/paginate are JS over arrays.
  The only `fetch` calls allowed are the mock's own `/post`, `/state`, `/go`,
  `/upload`, `/files`. Vendor fonts and images locally. App boots pre-logged-in.
- **Copy verbatim.** Button labels, column headers, empty states, validation
  messages, relative-time formats — evaluators match on rendered text.
- **No dead affordances.** WebArena UIs are dense (a Magento admin grid has
  search, filters, column chooser, per-page, bulk actions, export). All of it
  must do something coherent.

---

## Phase 3: Verify

```bash
npm run build && npm run dev -- --port 5180

# Route parity, cold, with sid
curl -s --noproxy '*' -o /dev/null -w '%{http_code}\n' "http://localhost:5180/f/news?sort=top&sid=t1"

# Session isolation
curl -s --noproxy '*' -X POST "http://localhost:5180/post?sid=t1" \
  -H 'Content-Type: application/json' -d '{"action":"set","state":{...}}'
curl -s --noproxy '*' "http://localhost:5180/go?sid=t1" | python3 -m json.tool | head -40
curl -s --noproxy '*' -X POST "http://localhost:5180/post?sid=t1" -d '{"action":"reset"}'

# State API must survive the production build
npm run build && npm run preview
```

Then run the `audit` agent (parity + dead code + pipeline) and the `playwright`
agent (route sweep + interaction tests + **side-by-side comparison against the
live source**). Loop until `WEBARENA_MIGRATION.md` §7 Definition of Done is met.

---

# Session-Based State Isolation Spec

Every mock supports `?sid=xxx` so parallel RL workers never see each other's
mutations. Four files implement it. This spec is unchanged by the migration
retarget — the source site has nothing to say about it.

```
Machine A ──?sid=session_A──┐
Machine B ──?sid=session_B──┼──▶ Vite server ──▶ .mock-states/session_{A,B,C}.json
Machine C ──?sid=session_C──┘
```

Workflow: harness POSTs initial state to `/post?sid=xxx` → browser opens
`http://host:PORT/<source path>?sid=xxx` → app fetches that state → renders →
refresh survives via session-scoped localStorage.

### File 1: `vite.config.js`

```javascript
import { secureMockApiPlugin } from '../../shared/secureMockApiPlugin.mjs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'
import path from 'path'

const STATE_DIR = path.join(process.cwd(), '.mock-states')
if (!fs.existsSync(STATE_DIR)) fs.mkdirSync(STATE_DIR, { recursive: true })

function getStateFile(sid) {
  if (!sid) return path.join(process.cwd(), '.mock-state.json')
  const safeSid = sid.replace(/[^a-zA-Z0-9_-]/g, '')   // prevent path traversal
  return path.join(STATE_DIR, `${safeSid}.json`)
}
function getInitialStateFile(sid) {
  if (!sid) return path.join(process.cwd(), '.mock-state.initial.json')
  const safeSid = sid.replace(/[^a-zA-Z0-9_-]/g, '')
  return path.join(STATE_DIR, `${safeSid}.initial.json`)
}

function parseQuery(url) {
  const idx = url.indexOf('?')
  if (idx === -1) return {}
  const params = {}
  url.substring(idx + 1).split('&').forEach(pair => {
    const [k, v] = pair.split('=')
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '')
  })
  return params
}

function setupMiddlewares(server) {
  // POST /post?sid=  — actions: set | set_current | reset
  //   set          → write current AND initial baseline
  //   set_current  → write current, create initial if missing
  //   reset        → restore current from initial
  // GET  /state?sid= → { stored_state, has_custom_state, sid }  (Cache-Control: no-cache)
  // GET  /go?sid=    → { initial_state, current_state, state_diff }
  // POST /upload?sid= and GET /files/:sid/:name where the site has file surfaces
}

export default defineConfig({
  plugins: [
    secureMockApiPlugin(),                                    // MUST be first
    react(),
    {
      name: 'mock-api',
      configureServer(server) { setupMiddlewares(server) },
      configurePreviewServer(server) { setupMiddlewares(server) },  // required for built mode
    },
  ],
})
```

### File 2: `src/utils/dataManager.js`

```javascript
const BASE_STORAGE_KEY = 'webarena<Site>State'
const BASE_INITIAL_KEY = 'webarena<Site>InitialState'

export function storageKey(sid) { return sid ? `${BASE_STORAGE_KEY}_${sid}` : BASE_STORAGE_KEY }
export function initialKey(sid) { return sid ? `${BASE_INITIAL_KEY}_${sid}` : BASE_INITIAL_KEY }

export function getSessionId() {
  const urlSid = new URLSearchParams(window.location.search).get('sid')
  if (urlSid) { sessionStorage.setItem('mock_sid', urlSid); return urlSid }
  return sessionStorage.getItem('mock_sid') || null       // survives SPA navigation + refresh
}

export async function fetchCustomState(sid = null) {
  const url = sid ? `/state?sid=${encodeURIComponent(sid)}` : '/state'
  try {
    const res = await fetch(url, { cache: 'no-store' })
    if (res.ok) {
      const data = await res.json()
      if (data.has_custom_state && data.stored_state) return data.stored_state
    }
  } catch (e) { /* no custom state */ }
  return null
}

export function createInitialData() {
  // Load the frozen seed extracted from the container.
  // Real ids, slugs, usernames, prices, timestamps — verbatim.
  return { /* ...import from src/data/*.json... */ }
}

export function initializeData(sid = null, customState = null) {
  const sk = storageKey(sid), ik = initialKey(sid)
  if (customState) {                                        // first load with injected state
    const data = deepMergeWithDefaults(createInitialData(), customState)
    localStorage.setItem(sk, JSON.stringify(data))
    localStorage.setItem(ik, JSON.stringify(data))
    return data
  }
  const stored = localStorage.getItem(sk)                   // refresh
  if (stored) {
    if (!localStorage.getItem(ik)) localStorage.setItem(ik, stored)
    return JSON.parse(stored)
  }
  const data = createInitialData()                          // fresh
  localStorage.setItem(sk, JSON.stringify(data))
  localStorage.setItem(ik, JSON.stringify(data))
  return data
}

export function saveState(state, sid = null) {
  localStorage.setItem(storageKey(sid), JSON.stringify(state))
  const q = sid ? `?sid=${encodeURIComponent(sid)}` : ''
  fetch(`/post${q}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set_current', state }),
  })
}
```

Deep merge rules for injected state: **objects** merge recursively, **arrays**
replace wholesale, **primitives** override, **null/undefined** are skipped.

### File 3: `src/context/AppContext.jsx`

```javascript
export const AppProvider = ({ children }) => {
  const [state, setState] = useState(null)
  const [loading, setLoading] = useState(true)
  const sidRef = useRef(getSessionId())
  const initDone = useRef(false)                 // guards React Strict Mode double-init

  useEffect(() => {
    if (initDone.current) return
    initDone.current = true
    const sid = sidRef.current

    if (sid) {
      // ⚠️ Check localStorage BEFORE initializeData().
      // initializeData() writes defaults, which would make isRefresh always true.
      const isRefresh = localStorage.getItem(initialKey(sid)) !== null
      if (isRefresh) {
        setState(initializeData(sid)); setLoading(false)         // sync
      } else {
        fetchCustomState(sid).then(custom => {                   // async
          setState(initializeData(sid, custom)); setLoading(false)
        })
      }
    } else {
      setState(initializeData()); setLoading(false)
    }
  }, [])

  const updateState = (updates) => setState(prev => {
    const next = { ...prev, ...updates }
    saveState(next, sidRef.current)
    return next
  })
}
```

### File 4: `src/App.jsx`

```javascript
function RedirectWithQuery({ to }) {
  const [searchParams] = useSearchParams()
  const query = searchParams.toString()
  return <Navigate to={query ? `${to}?${query}` : to} replace />
}
```

Replace **every** `<Navigate>` with it, and make every programmatic `navigate()`
carry the current search params forward.

---

## Common Pitfalls

**1. First-load detection always thinks it's a refresh.** Injected task state
never loads. Cause: `initializeData()` called before the localStorage check — it
writes defaults, so the check always finds data. Fix: check first, always.

**2. `?sid=` lost after navigation.** `<Navigate>` and bare `navigate('/path')`
drop query params. Fix: `RedirectWithQuery`, params-preserving `navigate()`, and
the `sessionStorage` fallback in `getSessionId()`.

**3. State API dead under `npm run preview`.** The `mock-api` plugin was only
registered on `configureServer`. Fix: register on `configurePreviewServer` too.

**4. Hardened mode silently off.** `secureMockApiPlugin()` isn't first in
`plugins[]`. Fix: put it first.

**5. Route drift.** A source path got "cleaned up" during implementation. This is
invisible locally and breaks every task whose evaluator checks the URL. Fix:
treat `ROUTES.md` as a contract; the audit agent diffs it against `App.jsx`.

**6. Fabricated seed data.** A missing field got filled with something plausible.
Every task referencing that record now resolves differently. Fix: report the gap,
go back to the container.

**7. Oversized state.** The full DB got dumped into `createInitialData()`. `/go`
and diffing crawl. Fix: sample per `WEBARENA_MIGRATION.md` §4, keep derived views
out of state.

**8. `curl` behind a proxy** returns 000. Fix: `--noproxy '*'`.

---

## Autonomous Mode

When launched via the ralph loop (`.claude/prompts/ralph-loop-prompt.md`):

1. **DO NOT ASK** for confirmation — proceed.
2. Read `SITE`, `WEBARENA_URL`, and `DOCKER_IMAGE` from the launch prompt.
3. Run Phase 0 preflight; stop only if both the site and docker are unreachable.
4. Execute all phases, spawning `plan` → `dev` → `audit` → `playwright` in rounds.
5. Stop when `WEBARENA_MIGRATION.md` §7 Definition of Done is satisfied.

```
Preflight → Recon → Scaffold → Build P0/P1 → Audit → Playwright diff vs source
   → fix → repeat → Definition of Done → COMPLETE
```
