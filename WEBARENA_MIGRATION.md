# WebArena → CUA-Gym-Hub Migration Guide

This repository's agent pipeline (`.claude/agents/`) is targeted at **migrating
locally-hosted WebArena websites into CUA-Gym-Hub mock apps**.

A WebArena site is a heavyweight, stateful Docker deployment (Magento + MySQL,
GitLab + Postgres, Postmill + Postgres, OSM Rails + Postgres). A CUA-Gym-Hub
mock is a self-contained React + Vite SPA with no server, no database, and
per-session state isolation. Migration means **rebuilding the site's
user-visible surface as a mock, using the container as ground truth** — not
containerizing, proxying, or forking the original app.

Read this before running any migration agent. Every agent prompt in
`.claude/agents/` assumes the doctrine below.

---

## 0. Toolchain Environment (read this first — nothing works without it)

This host has **no system-wide node, no venv on PATH, and no browser libraries**.
All three are provided out of `/tmp`, and none of them are on your PATH by default.
Export these before using them. Every agent needs at least the first; any agent
that wants to *see* the site needs all three.

```bash
# node / npm — required for npm run build, npm run dev
export PATH="/tmp/node-v20.18.1-linux-x64/bin:$PATH"

# browser libraries — required for ANY Playwright/chromium launch
export LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu

# python with playwright installed
/tmp/pwvenv/bin/python  your_script.py
```

**Why `LD_LIBRARY_PATH` is mandatory.** `libatk-1.0.so.0` and 7 other libraries
chromium needs are NOT installed system-wide. They exist only in the hand-built
sysroot at `/tmp/sysroot/usr/lib/x86_64-linux-gnu` (252 libs). Measured on the
shipped headless binary:

```
without LD_LIBRARY_PATH : 8 missing libs  -> chromium will not start
with    LD_LIBRARY_PATH : 0 missing libs  -> works
```

If you launch chromium without it you get a missing-`libatk` error and may
wrongly conclude this machine has no browser. **It does.** A dev agent already
made exactly that mistake and had to hand four fixes to the playwright agent for
visual confirmation it could have done itself.

Quick self-check before you decide you cannot see the site:

```bash
LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu /tmp/pwvenv/bin/python -c "
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_page(); pg.goto('http://localhost:5180')
    print('browser OK:', pg.title()); b.close()"
```

**These live in `/tmp` and are not permanent.** If `/tmp` is cleared, every agent
loses node, python, and the browser at once.

### If anything is missing — rebuild it, don't work around it

```bash
bash shared/setup-toolchain.sh --check    # status only, non-zero if incomplete
bash shared/setup-toolchain.sh            # idempotent rebuild of whatever is missing
```

The script is idempotent and safe to run every round: it skips any stage already
satisfied and finishes by launching a real browser to prove the rig works.

What it does, and why it is not a simple `apt-get install`: chromium's system
dependencies (`libatk`, `libnss3`, `libcups`, …) are **not installed and `sudo -n`
is denied**. So it `apt-get download`s the recursive dependency closure (~120
`.deb`s), `dpkg-deb -x` extracts them all into `/tmp/sysroot` (~502 `.so` files),
and points `LD_LIBRARY_PATH` at the result — nothing is installed system-wide.
Takes ~90 seconds. This procedure was worked out by hand during round-1 recon;
it is captured in the script so no future migration has to rediscover it.

**Never silently work around a missing toolchain** — do not skip visual
verification, do not substitute curl for a browser, and do not report a fix as
confirmed when you could not look at it. Run the script; if it fails, say so
explicitly and name what you could not verify.

---

## 1. The Migration Contract

### What you MUST carry over from the source

| Thing | Why |
|-------|-----|
| **URL/route structure** — path shape, path params, query params | WebArena evaluators check the agent's final URL. `/f/news`, `/user/byteblaze/project`, `/admin/sales/order/view/order_id/123` must resolve in the mock exactly as in the source. |
| **Real entity IDs, slugs, usernames, SKUs, order numbers** — exactly, for records any task references; faithfully for the rest | Existing WebArena tasks reference specific records by name/id. Invented data breaks every task. See §4.1 for how to tell which records are load-bearing. |
| **Visible strings** — labels, button text, headings, table column names, empty-state and validation copy | Evaluators do string matching on rendered page text. |
| **The workflows tasks perform** — search, filter, add to cart, open a merge request, edit a setting, submit a form | A task fails on a missing capability long before it fails on a wrong pixel. |
| **Layout, CSS, typography, spacing** | Agents are trained on pixels. The mock should be visually indistinguishable at a glance. |
| **User-visible logic** — sort orders, filter semantics, pagination size, search behavior, form validation, permission-dependent UI | This is the behavior the agent must learn. |
| **A representative sample of the real data** | See §4. Enough that browsing feels populated and task-referenced records exist. |

### What you MUST NOT carry over

| Thing | Replacement |
|-------|-------------|
| MySQL / PostgreSQL databases | Frozen JSON seed in `src/data/*.json`, loaded by `createInitialData()` |
| PHP / Ruby / Symfony / Rails server code | React components + client-side logic |
| Login, logout, sessions, CSRF, password reset | App boots **pre-logged-in** as the site's WebArena default user |
| Elasticsearch, Redis, cron, mail, background jobs | Client-side filtering/sorting over the seed |
| External tile servers, geocoding, routing services | Local static analogs (pre-rendered tile images, canned geocode/route results for seeded queries) |
| Any runtime network call | Nothing. The mock must work fully offline. |
| Multi-user concurrency, real permissions enforcement | Single-user view; render permission-dependent UI from a static role field |

### What must be true when you're done

Everything in `SANDBOX_COMPLETENESS_GUIDE.md`, plus:

- The mock serves the same routes as the source for every page an agent can reach.
- `?sid=` session isolation works (per §5) so parallel RL rollouts don't collide.
- `/go?sid=` exposes `{initial_state, current_state, state_diff}` covering every mutation.
- No dead affordances. WebArena sites are dense; a Magento admin grid has dozens of controls and all of them must do something coherent.

---

## 2. Site Inventory

Ports, images, and container names come from
`/webarena/webarena-setup/webarena/00_vars.sh` and `03_docker_create_containers.sh`.
`PUBLIC_HOSTNAME` is `$(hostname -I | awk '{print $1}')`.

| WebArena site | Docker image | Container | Port | Source stack | Target mock dir |
|---|---|---|---|---|---|
| Shopping (OneStopMarket) | `shopping_final_0712` | `shopping` | 7770 | Magento 2 · PHP · MySQL | `websites/webarena_shopping_mock/` |
| Shopping Admin | `shopping_admin_final_0719` | `shopping_admin` | 7780 | Magento 2 Admin · PHP · MySQL | `websites/webarena_shopping_admin_mock/` |
| Reddit (Postmill) | `postmill-populated-exposed-withimg` | `forum` | 9999 | Postmill · Symfony/PHP · Postgres | `websites/webarena_reddit_mock/` |
| GitLab | `gitlab-populated-final-port8023` | `gitlab` | 8023 | GitLab Omnibus · Rails · Postgres | `websites/webarena_gitlab_mock/` |
| Map | `openstreetmap-website-*` (docker compose) | `openstreetmap-website-web-1`, `openstreetmap-website-db-1` | 3000 | OSM Rails · Postgres | `websites/webarena_map_mock/` |
| Wikipedia | `ghcr.io/kiwix/kiwix-serve:3.3.0` | `wikipedia` | 8888 | Kiwix static ZIM | `websites/webarena_wikipedia_mock/` |
| Homepage | — (python http.server) | — | 4399 | Static HTML | — (not migrated) |

**Naming rule: always prefix with `webarena_`.** The hub already contains
`gitlab_mock`, `reddit_mock`, `amazon_mock`, and `shopify_admin_mock` — these
are mocks of the *real commercial products* and must not be overwritten. The
WebArena variants are different sites with different data and different URL
shapes.

**Port side effect:** `deploy-all.sh` sorts `websites/*_mock` alphabetically and
assigns ports from 8000. Adding a `webarena_*_mock` shifts the port of every
mock sorting after it. Re-derive any pinned `CUA_GYM_*_URL` after adding one.

### Default logins (source sites)

The mock starts pre-logged-in as this user. Use it to reach authenticated pages
during recon. Verify against the current deployment before relying on them.

| Site | User | Password |
|---|---|---|
| Shopping | `emma.lopez@gmail.com` | `Password.123` |
| Shopping Admin | `admin` | `admin1234` |
| Reddit | `MarvelsGrantMan136` | `test1234` |
| GitLab | `byteblaze` | `hello1234` |

---

## 3. Docker Recon

### 3.0 Preflight — probe access before planning anything

```bash
docker ps                        # preferred
sudo -n docker ps                # if the socket is root-only and sudo is passwordless
```

Three outcomes:

- **Docker reachable** → full recon: DB dumps, template reading, asset extraction.
- **Docker unreachable, site URL reachable** → *degraded recon*. Everything in §3.3
  (live HTTP/DOM scraping) still works and is enough to build a good mock. Say so
  explicitly in `SOURCE.md`; do not silently proceed as if you had DB access.
- **Neither reachable** → stop and report. Do not invent the site from memory.

Also probe the site itself, and always use `--noproxy '*'`:

```bash
curl -s -o /dev/null -w '%{http_code}\n' --max-time 10 --noproxy '*' "$WEBARENA_URL"
```

If the container exists but is stopped: `docker start <container>` (GitLab and
Magento take 30–120s to become healthy; poll the URL until it returns 200).

### 3.1 Read the source code inside the container

```bash
docker exec <container> ls /var/www/magento2/app/design/frontend      # Magento themes
docker exec <container> find /var/www/html -name '*.twig' | head -50  # Postmill templates
docker exec gitlab find /opt/gitlab/embedded/service/gitlab-rails/app/views -name '*.haml' | head
docker cp <container>:/path/to/dir /tmp/recon/<site>/                 # pull it out to read locally
```

Templates tell you the exact DOM structure, class names, and visible strings.
Prefer them over guessing from a screenshot.

### 3.2 Query the database for real data

Discover credentials first rather than assuming:

```bash
docker exec <container> env | grep -iE 'db|database|postgres|mysql|password'
docker exec <container> cat /var/www/magento2/app/etc/env.php     # Magento
docker exec <container> psql -U postgres -l                       # list Postgres DBs
```

Known-good starting points:

```bash
# Shopping / Shopping Admin (confirmed in 05_docker_patch_containers.sh)
docker exec shopping mysql -u magentouser -pMyPassword magentodb -e "SHOW TABLES;"
docker exec shopping mysql -u magentouser -pMyPassword magentodb \
  -e "SELECT entity_id, sku, value FROM catalog_product_entity p
      JOIN catalog_product_entity_varchar v ON v.entity_id=p.entity_id LIMIT 50;"

# Reddit / Postmill
docker exec forum psql -U postmill -d postmill -c "\dt"

# GitLab (omnibus ships a psql wrapper)
docker exec gitlab gitlab-psql -c "\dt"
docker exec gitlab gitlab-rails runner 'puts Project.limit(20).map(&:full_path)'

# Map
docker exec openstreetmap-website-db-1 psql -U openstreetmap -d openstreetmap -c "\dt"
```

Dump to JSON and land it under `<mock>/assets/dumps/` (gitignored working area),
then curate it into `<mock>/src/data/`.

### 3.3 Scrape the live site (always available, always do it)

This is the highest-value recon and does not need Docker.

- Drive the live URL with the Playwright tools. Log in with the §2 credentials.
- Screenshot every major view at 1920×1080 into
  `<mock>/assets/screenshots/reference/` — these replace the `image-search`
  skill entirely. Real site > web-search screenshots.
- Save raw HTML per route (`curl --noproxy '*' -s "$URL/path" > assets/html/<route>.html`)
  and read it for class names, exact copy, and table structure.
- Pull the site's CSS and extract the real palette, fonts, and spacing into
  `DESIGN.md` instead of eyeballing colors.
- Copy static assets (logos, product images, icons) into `public/` where
  license permits, or substitute local placeholders of identical dimensions.
  Follow `TRADEMARKS.md` — alter brand wordmarks in the mock's UI.
- Record every URL you visit, including the ones reached by clicking, into
  `ROUTES.md`.

---

## 4. Data Migration Strategy

The single most important rule: **freeze a curated sample, keep the real
identifiers.**

1. **Inventory the entities.** For each, note the real primary key format
   (Magento `entity_id`/`sku`, Postmill submission id, GitLab project
   `full_path`, OSM node id).
2. **Sample, don't dump.** Target roughly:
   - every top-level index entity (all forums, all categories, all repos owned
     by the default user)
   - 20–60 rows per major list view (enough for pagination to be exercisable)
   - full detail for records that list views link to
   - deep content (comment trees, commit history) for a handful of records
3. **Preserve real values verbatim** — names, prices, dates, usernames, vote
   counts, star counts, order totals. Do not round, translate, or prettify.
4. **Budget the size.** `createInitialData()` output should stay under ~1–2 MB;
   the whole state is POSTed, diffed, and returned by `/go` on every call.
   Split large corpora into separate JSON modules under `src/data/` and import
   them; keep derived/computed views out of state.
5. **Cover the task surface.** Before finalizing, check the sample supports the
   workflows in `TODO.md`: something to search for, something to sort, an item
   with >1 page of comments, an order that can be transitioned, etc.
6. **Wikipedia/Map are special.** Do not attempt to mirror the corpus. Seed a
   bounded set of articles / a bounded bounding box with pre-rendered tiles,
   and make search resolve only within that set — with a realistic "no results"
   state outside it.

### 4.1 Task anchors — what fidelity actually means

A mock is not graded on resembling the source. It is graded on whether the
site's WebArena tasks still pass on it. Those tasks are scored by evaluators in
`webarena.jsonl`, and every evaluator compares against a fixed value:

| eval_type | compares |
|---|---|
| `url_match` | the agent's final URL against `reference_url` |
| `string_match` | the agent's answer against `must_include` / `exact_match` strings |
| `program_html` | a page's rendered text against `required_contents`, optionally under a DOM `locator` |

Those URLs, strings, and locators are **anchors**. Extract them before building:

```bash
python3 shared/extract-task-anchors.py --site <SITE>
# → <mock>/assets/task_anchors.json  (machine-readable, for test scripts)
# → <mock>/assets/task_anchors.md    (human-readable, for agents)
```

This splits the seed into two tiers, and the split governs both what `dev`
builds and what `playwright` reports:

- **Anchored data — reproduce exactly.** A route in the anchor list must
  resolve. A string in the anchor list must appear verbatim on the page that
  should show it. A locator in the anchor list must select a real element. A
  paraphrase, a rounded number, or a regenerated slug fails the task silently:
  the page looks right and the evaluator still returns 0.
- **Unanchored data — reproduce faithfully, not identically.** Everything else
  in the seed exists to make the site feel populated and to exercise sorting,
  filtering, and pagination. It should be plausible, internally consistent, and
  drawn from the real source, but individual prices, counts, timestamps, and
  body text need not match record for record.

The practical rule: **spend fidelity effort where an evaluator is looking.**
A missing anchor is a P0. A drifted unanchored field is a P2 worth logging and
not worth a round.

Anchors also tell you what *capabilities* the site needs. Read the `question`
field of the tasks alongside the anchors — if 40 tasks say "add to cart" or
"find the merge request", those flows must work end to end, whatever they look
like. Capability gaps outrank cosmetic gaps every time.

---

## 5. Mock-Side Requirements (unchanged from the hub contract)

Every migrated mock is a normal CUA-Gym-Hub mock and must satisfy the existing
contract. Copy `websites/mixpanel_mock` as the structural template.

- `vite.config.js`: `secureMockApiPlugin()` first in `plugins[]`, then
  `mock-api` registered under **both** `configureServer` and
  `configurePreviewServer`. Endpoints `/post`, `/state`, `/go`, `/upload`,
  `/files`. State files at `.mock-states/<sid>.json` + `<sid>.initial.json`,
  sid sanitized with `sid.replace(/[^a-zA-Z0-9_-]/g, '')`.
- `src/utils/dataManager.js`: `getSessionId`, `storageKey`, `initialKey`,
  `fetchCustomState`, `createInitialData`, `initializeData(sid, customState)`,
  `saveState(state, sid)` → POSTs `{action:'set_current', state}`.
- `src/context/AppContext.jsx`: check `localStorage.getItem(initialKey(sid))`
  **before** calling `initializeData()`, or injected task state never loads.
- `src/App.jsx`: `/go` route, and `RedirectWithQuery` instead of `<Navigate>`
  everywhere so `?sid=` survives.
- `SCHEMA.md` with the state table and the Observable State Changes table.

### Route parity with `?sid=`

Session id rides as a query param, so it composes with source paths without
disturbing them:

```
source:  http://host:9999/f/news?sort=hot
mock:    http://host:8042/f/news?sort=hot&sid=task_042
```

Any redirect, form post, or programmatic navigation must preserve `sid`. Deep
links must work on first load — an agent may be dropped directly onto
`/admin/sales/order/view/order_id/299?sid=x`.

---

## 6. Per-Site Notes

**Shopping (Magento storefront).** Category tree nav, product grid with
sort/paginate/filter, product detail with configurable options (size/color),
cart, checkout up to order placement, account pages (orders, addresses,
wishlist, reviews). Preserve `/catalog/category/view/id/N`-style and
url-key-style paths — both are reachable in Magento.

**Shopping Admin.** Dashboard, then the grid-heavy sections: Sales > Orders,
Catalog > Products, Customers, Reports, Marketing. Magento admin grids
(search, filters, column chooser, per-page, bulk actions, export) are the core
training surface — implement them fully. Order view with invoice/ship/credit
memo tabs is high value. Admin URLs contain a `/key/<hash>` segment; drop it in
the mock but accept and ignore it if present.

**Reddit (Postmill).** Forum list, `/f/<forum>` listings with hot/top/new/active
sorts, submission pages with nested comment trees, voting, submit/edit/delete,
user profiles, subscriptions, search. Vote counts and comment nesting are the
crux — get them exactly right.

**GitLab.** `/explore`, project pages (files tree, blob view, README render),
issues + merge requests with labels/milestones/assignees, project members,
groups, user profile, activity feed, new-project and new-issue flows. Do not
implement real git; back the file tree with a seeded tree structure.

**Map (OSM).** Search box with canned geocode results, map pane with
pre-rendered static tiles for a bounded bbox/zoom range, directions between
seeded points with canned routes, node/way detail panels, layer switcher.
Never call `tile.openstreetmap.org`, Nominatim, or OSRM at runtime.

**Wikipedia (Kiwix).** Article view with real article HTML for a seeded set,
search with prefix matching over seeded titles, internal links resolving within
the set and degrading gracefully outside it.

---

## 7. Definition of Done

- [ ] `ROUTES.md` lists every source route and its mock counterpart, with parity status
- [ ] Real IDs/slugs/usernames from the container appear in the seed
- [ ] Zero runtime network calls (verify: DevTools network panel is empty after a full click-through)
- [ ] No login required; app boots as the site's default user
- [ ] `?sid=` isolation verified: two sids, independent mutations, `reset` restores
- [ ] `/go?sid=` `state_diff` reflects every mutating action in `SCHEMA.md`'s Observable State Changes table
- [ ] Side-by-side visual check against the live site passes on every major route
- [ ] `npm run build` and `npm run preview` both serve the state API
- [ ] `SANDBOX_COMPLETENESS_GUIDE.md` acceptance criteria met
