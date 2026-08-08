# webarena_gitlab_mock — Test Report

> Round: **11** (gating round)
> Date: 2026-08-08
> Mock: http://localhost:5301 (`npm run dev -- --port 5301`)
> Source: http://localhost:8023 — **reachable: YES**
> Tested by: playwright agent (sole agent this round)
> Supersedes: round 9, preserved verbatim at `TEST.round9-prev.md`
> Toolchain: real chromium via `/tmp/pwvenv/bin/python` +
> `LD_LIBRARY_PATH=/tmp/sysroot/...`. Every result below was produced in a real
> browser. `curl` was used only for HTTP status probes and for the mock's
> `/post` / `/go` JSON endpoints, which have no DOM.

**Source read-only discipline held.** No POST, no login, no form submit and **no
`?sort=` URL** was issued against port 8023. Source-side facts come from
anonymous `GET`s driven in a browser plus the captures in `assets/html/`.

**Everything below is re-verified THIS round** against the round-10 tree. Nothing
is carried on round 9's or round 10's word; where a figure is reused it is
labelled **[carried]** and says why.

*(report is written incrementally as findings are confirmed)*

---

## 1 · Summary

| Metric | Result |
|---|---|
| ROUTES.md rows cold-loaded this round | **132 / 132** (146 probe URLs; rows 92/93 driven separately in §3) |
| …rendering the correct view | **146 / 146** |
| Console errors on cold load | **0 / 146** |
| Uncaught pageerrors on cold load | **0 / 146** |
| `?sid=` preserved after load / after an in-app nav click | **146 / 146** · **146 / 146** |
| `?sid=` across history back/forward, form submit, pagination | **PASS** |
| Horizontal overflow at 1280×720 | **0 / 146** |
| `<Placeholder>` / "has not been implemented yet" | **0 / 146** |
| Anchor routes resolving | **145 / 145** (68 render the 404 page — all entities a task creates) |
| Page-bound anchor strings | **243 pairs · 0 mock-side gaps** · machine-diffed vs round 9: **0 newly missing, 0 newly present** |
| `program_html` locators | **54 distinct (page, locator) pairs · 0 mock-side gaps** |
| DIFF-901 · MR Commits tab | ✅ **FIXED** — 6 MRs × 2 viewports, **24/24 tab badges** and **17/17 commit rows** identical to the source |
| DIFF-902 · file-tree ordering | ✅ **FIXED** — **8 / 8 trees, 177 entries**, same set and order as the source |
| DIFF-903 · quoted seed paths | ✅ **FIXED at the seed** — **0** quoted/escaped paths remain in any `src/data/*.json` |
| DIFF-904 / 905 / 906 / 907 / 908 | ✅ landed as described (906 3-of-4, 907 4-of-6; both unlanded parts genuinely P2) |
| BUG-004 UTF-8 `/post` round-trip | **24 / 24 chunk-boundary offsets PASS** |
| BUG-B01 case-insensitive project path | ✅ closed |
| BUG-001 members-table evaluator selector | ✅ closed — under the **upstream** `td.col-max-role span`, matching the live source value-for-value |
| BUG-A01 `?sid=` on sort controls | ✅ closed — 9 / 9 controls keep sid *and* write back to the URL *and* stick on cold reload |
| BUG-701 / BUG-702 · round-8 responsive fixes | ✅ still closed — geometry **byte-identical to the source** at 1280 / 1600 / 1920 |
| webarena-418…422 + 448…452 at **1280×720** | **10 / 10 PASS** under the verbatim evaluator |
| Tasks replayed / completable end to end at 1280×720 | **30 / 30** |
| DIFF-001 banner gating | ✅ still closed in both directions |
| Session isolation / reset / injected state | **PASS** |
| Interactive elements hit-tested at 1280×720 (independent hunt) | **4 700 · 0 blocked · 0 clipped · 0 overflow · 0 console errors** |
| Cold state size | **2 069 758 B = 1.974 MiB** — inside budget, unchanged by round 10's two STATIC seeds |
| **P0 bugs** | **0** |
| **P1 functional bugs** | **0** |
| **P0/P1 source-vs-mock differences** | **1** — DIFF-1105 (project CI/CD surface; zero measured task impact; §12) |
| P2 findings (new this round) | 5 — DIFF-1101…1104, 1106 |
| `npm run build` | ✅ `✓ 168 modules transformed · built in 3.21s` |
| **Gate** | **criterion 4 FAILS**; 1, 2, 3, 5, 6 PASS — see §15 |

---

## 2 · Round-10 fixes — verified against the live source

### 2.1 DIFF-901 · MR Commits tab now lists the MR's OWN commits — ✅ FIXED

Driven in a real browser at **1920×1080 and 1280×720**, mock vs live source, on
**6** merge requests spanning 4 projects. Tab badges read from the rendered
`.merge-request-tabs`; commit titles read from `#commits-list li.commit`.

| MR | source tabs | mock tabs | commit rows |
|---|---|---|---|
| `byteblaze/a11y-webring.club!40` | `Overview 0 · Commits 4 · Pipelines 1 · Changes 7` | **identical** | 4 / 4 titles identical |
| `a11yproject/a11yproject.com!1265` | `Overview 1 · Commits 1 · Pipelines 0 · Changes 2` | **identical** | 1 / 1 |
| `a11yproject/a11yproject.com!1531` | `Overview 0 · Commits 1 · Pipelines 1 · Changes 2` | **identical** | 1 / 1 |
| `a11yproject/a11yproject.com!1071` | `Overview 0 · Commits 5 · Pipelines 0 · Changes 34` | **identical** | 5 / 5 |
| `primer/design!450` | `Overview 2 · Commits 5 · Pipelines 0 · Changes 5` | **identical** | 5 / 5 |
| `byteblaze/empathy-prompts!19` | `Overview 1 · Commits 1 · Pipelines 1 · Changes 1` | **identical** | 1 / 1 |

**24 / 24 tab badges identical, 17 / 17 commit rows identical, at both
viewports.** The round-9 symptom (every MR of a project showing that project's
own 40-commit head) is gone. Day-grouping headers carry the same dates and the
same `N commit(s)` counts.

One residual, new and cosmetic → **DIFF-1101 (P2)**: the mock's `.commit-header`
omits the whitespace text node the source has between `<span class="day">` and
`<span class="commits-count">`, so the header renders `26 Jan, 20231 commit`
instead of `26 Jan, 2023 1 commit`. Header row height is 21 px vs the source's
32 px. No anchor reads it.

### 2.2 DIFF-902 · file-tree ordering is now ASCII/byte order — ✅ FIXED

Entry lists read off the tree table and compared **element by element, in order**,
mock vs live source, at both viewports:

| tree | entries | order matches source |
|---|---|---|
| `primer/design` (root, mixed case) | 20 | ✅ |
| `byteblaze/dotfiles` (root) | 39 | ✅ |
| `a11yproject/a11yproject.com` (root) | 23 | ✅ |
| `byteblaze/a11y-webring.club` (root) | 27 | ✅ |
| `byteblaze/a11y-webring.club/-/tree/main/data` | 3 | ✅ |
| `byteblaze/a11y-webring.club/-/tree/main/data/members` | 39 | ✅ |
| `byteblaze/a11y-syntax-highlighting` (root) | 7 | ✅ |
| `byteblaze/ericwbailey.website` (root) | 19 | ✅ |

**8 / 8 trees, 177 entries, same set and same order as the source at 1920 and
1280.** `primer/design` is the discriminating case (`CODE_OF_CONDUCT.md`,
`CONTRIBUTING.md`, `LICENSE`, `README.md` before `babel-defines.js`) and it
matches.

### 2.3 DIFF-903 · quoted / octal-escaped paths — ✅ FIXED at the seed, verified seed-wide

Not just the one directory. I scanned **every** `src/data/*.json` for keys or
path-like values that begin with `"` or contain a git octal escape (`\NNN`) or a
C-style escape:

```
total findings: 3
  notes.json      body starting with a literal quote (prose, not a path)
  repo_files.json two .vim blob bodies whose comment character is "
```

**Zero quoted or escaped paths remain anywhere in the seed.** No `"data`,
`"data/members` key survives in `repo_trees.json` or `tree_last_commits.json`.
The five affected paths decode correctly and are present as real UTF-8:

`data/members/Cristian Díaz.json`, `data/members/Luce Carević.json`,
`data/members/Taner Aydın.json`, `data/members/Zoë Bijl.json`,
`皮肤制作教程.md` — in both `repo_trees.json` and `tree_last_commits.json`
(including the commit message `Update data/members/Luce Carević.json`).

Rendered: `…/-/tree/main/data/members` lists **39 / 39** files in the source's
own order, with the accented names rendered correctly, and `…/-/tree/main` has
exactly one `data` directory.

---

## 3 · Route parity — every ROUTES.md row, cold, this round

146 probe URLs covering all 132 rows (multi-path rows expanded; rows 24, 34, 68,
77, 85 are declared not-migrated in `ROUTES.md` and are not probed). Each probe
used a **fresh browser context and a fresh `?sid=`**, went straight to the deep
link with no click-through, and was checked for: correct view, console errors,
uncaught pageerrors, `sid` on the URL after load, `sid` after clicking the first
visible in-app link, horizontal overflow at 1280×720, and the placeholder string.

**Result: 146 / 146 clean — `TOTAL 146  CLEAN 146  PROBLEM 0`.**

| check | result |
|---|---|
| cold-load failures | **0** |
| console errors | **0** |
| uncaught pageerrors | **0** |
| `sid` dropped on load | **0** |
| `sid` dropped after an in-app navigation | **0** |
| horizontal overflow at 1280×720 | **0** |
| `<Placeholder>` / "has not been implemented yet" | **0** |

Dynamic rows were resolved from the seed at run time: row 89 →
`/byteblaze/a11y-webring.club/-/labels/1811/edit`, row 52 →
`/byteblaze/dotfiles/-/commit/218b5e72424aca8b580e52342dbb92bd4bd076c8`.

**Rows 92 / 93 were probed separately** — `a11y-webring.club` has no
`/-/milestones/:iid` link to harvest, so they were driven against a project that
does. Both are clean and carry the locators their anchors need:

| row | path | result |
|---|---|---|
| 92 | `/OpenAPITools/openapi-generator/-/milestones/1` | renders · 0 errors · sid kept · `#content-body` ✅ · `.block.start_date` ✅ · `.block.due_date` ✅ |
| 93 | `/OpenAPITools/openapi-generator/-/milestones/1/edit` | renders · 0 errors · sid kept · `#content-body` ✅ |

The seven pages the sweep flags as short-bodied are all legitimate empty states
and were read by hand — `/explore/snippets` → `No snippets found`,
`/dashboard/snippets` → `Code snippets · Store, share, and embed small pieces of
code and text.`, `/explore/projects/topics` → `There are no topics to show. Add
topics to projects to help users find them.` — GitLab's own copy, not blanks.

Only the single expectation-string mismatch round 9 already ran down repeats
(row 17 reads `Most stars`, which is GitLab's label — my round-9 expectation of
`Most starred` was wrong, and the probe list is corrected).

---

## 4 · The four closed P0s — re-verified on the round-10 tree

### 4.1 BUG-004 · multi-byte UTF-8 through `/post` — ✅ still closed

24 payloads, each padding `🐞 Ünïcödé — 日本語 «test»` to a different offset around
the 65536-byte chunk boundary, POSTed to `/post?sid=` and read back through
`/go?sid=`. **`chunk-boundary offsets tested: 24 · failures: 0`** — 24/24 exact
round-trips, 0 mojibake, 0 replacement characters.

### 4.2 BUG-B01 · case-insensitive project path — ✅ still closed

| probe | result |
|---|---|
| `/ByteBlaze/dotfiles` | renders |
| `/byteblaze/DotFiles` | renders |
| `/byteblaze/a11y-WebRing.Club` | renders |
| `/byteblaze/a11y-webring.club/-/issues/71` | renders |
| `/byteblaze/ChatGPT` | **404 — correct**; that project does not exist until webarena-396 forks `convexegg/chatgpt` into it (§7) |
| `/byteblaze/chatgpt` | 404 — same reason, and confirms the 404 is about the record, not the casing |

The route-sweep script additionally re-ran the seven canonicalisation probes in
`assets/route_smoke.py` shape as part of §3 with zero failures.

### 4.3 BUG-001 · members table — ✅ still closed, under the selector the harness really uses

Run this round with the **upstream** helper body, `td.col-max-role span` (not the
`td.role` I mis-reconstructed in round 9 — `td.role` selects nothing on the live
source either):

```js
document.querySelectorAll("td[data-label='Account'] span.gl-avatar-labeled-sublabel")
// → index of '@<username>', then that index into
document.querySelectorAll("td.col-max-role span")
```

| project | accounts / role cells | helper result |
|---|---|---|
| `byteblaze/a11y-webring.club` | 1 / 1 | `@byteblaze → 'Owner'` |
| `byteblaze/dotfiles` | 1 / 1 | `@byteblaze → 'Owner'` |
| `a11yproject/a11yproject.com` | 3 / 3 | `Maintainer`, `Developer`, `Owner` — value-for-value the live source's `['Maintainer','Developer','Owner']` |
| `byteblaze/timeit` | 1 / 1 | `@byteblaze → 'Owner'` |

Account count == role-cell count on every table, so the helper's index join is
sound.

### 4.4 BUG-A01 · `?sid=` on the sort controls — ✅ still closed, and they write back to the URL

Every control opened and a different option clicked, then the resulting URL
**cold-reloaded** to confirm the choice sticks:

| page | control | resulting URL | sid | writeback | sticks | order changed |
|---|---|---|---|---|---|---|
| `/dashboard/projects` | `Name` → `Updated date` | `?sort=latest_activity_desc&sid=…` | ✅ | ✅ | ✅ | ✅ |
| `/explore/projects` | `Name` → `Updated date` | `?sort=latest_activity_desc&sid=…` | ✅ | ✅ | ✅ | ✅ |
| `/dashboard/issues` | `Created date` → `Priority` | `?sid=…&sort=priority_desc` | ✅ | ✅ | ✅ | ✅ |
| `/dashboard/merge_requests` | `Created date` → `Priority` | `?sid=…&sort=priority` | ✅ | ✅ | ✅ | ties |
| `/a11yproject/a11yproject.com/-/issues?state=all` | `Created date` → `Priority` | `…&sort=priority_desc` | ✅ | ✅ | ✅ | ✅ |
| `/byteblaze/a11y-webring.club/-/merge_requests` | `Created date` → `Priority` | `?sid=…&sort=priority` | ✅ | ✅ | ✅ | ties |
| `/a11yproject/a11yproject.com/-/issues?state=all` | `Show 20 items` → `Show 50 items` | `…&first_page_size=50` | ✅ | ✅ | ✅ | 20 → 50 rows |
| `/a11yproject/a11yproject.com/-/issues?state=all` | `Sort direction` | `…&sort=created_asc` | ✅ | ✅ | ✅ | ✅ |
| `/a11yproject/a11yproject.com/-/merge_requests?state=merged` | `Sort direction` | `…&sort=created_asc` | ✅ | ✅ | ✅ | ✅ |

Twelve sort tokens driven on `a11yproject.com`'s `state=all` issue list produce
**8 distinct orderings**. The four that collapse onto the base order
(`popularity`, `due_date_desc`, `label_priority_desc`, `closed_at_desc`) do so
because every sampled row ties on that key — `src/pages/hooks.js:190-210`
documents the Postgres check behind that (`issues.closed_at` is non-NULL on 1
row in 80 962 at the source, none of them sampled), so this is the source's own
shape, not an ignored token.

### 4.5 DIFF-001 · banner gating — ✅ still closed in both directions

- SSH "add an SSH key" banner: **19 / 19 project overviews**.
- Auto DevOps banner: exactly the same 10 projects as round 9 — `dotfiles`,
  `timeit`, `cloud-to-butt`, `solarized-prism-theme`, `a11y-syntax-highlighting`,
  `millennials-to-snake-people`, `accessible-html-content-patterns`,
  `ericwbailey.website`, `gimmiethat.space`,
  `remove-board-movement-events-from-the-github-issue-timeline`. Absent from the
  nine that must not have it. **[carried predicate]** — the Ruby predicate was
  recomputed read-only against the container in round 7; this round re-verified
  the mock side only.
- **Leakage: 0** across ten non-overview pages.

---

## 5 · Anchor contract — re-run from scratch on the round-10 seed

The seed changed this round, so the whole sweep was re-run against a **pristine,
freshly reset sid** rather than carried forward.

| check | result |
|---|---|
| anchor routes loaded | **145 / 145** · 0 load failures · 0 console errors · 0 pageerrors · 0 `sid` losses |
| …rendering the 404 page | **68** — every one an entity a task is supposed to *create* |
| page-bound anchor string pairs | **243** · 5 present on the pristine seed · 238 absent |
| `program_html` locators | **54** distinct (page, locator) pairs · 3 resolve pristine |

**Machine-diffed against round 9's run: `NEWLY MISSING this round: 0`,
`NEWLY PRESENT this round: 0`, `routes whose 404-ness changed: []`.** The
round-10 seed work (`merge_request_diffs.json`, the quoted-path fix, the
`repo_size` repoint, `repo_languages.json`) perturbed **nothing** in the anchor
contract — the 243 pairs and 145 routes land byte-for-byte where they did before.

The 238 absent strings are the same set round 9 triaged one by one: 168 bound to
a page that legitimately 404s (a project the task creates) and 70 that are
post-conditions of a mutating task. §7 drives a sample of those mutations and
confirms the strings appear afterwards. **0 strings that the pristine seed should
already carry are missing.**

The 3 locators that resolve pristine are the ones that should:
`[data-qa-selector="projects_list"]` on `/dashboard/projects`, `.user-profile` on
`/users/byteblaze/following`, and `#notes-list` `lastElementChild` on MR 1265
(which already has notes). The other 51 are post-condition locators for mutating
tasks — exercised **after** the mutation in §7 — plus the 12
`func:gitlab_get_project_memeber_role` pairs, which are a Python helper and not
an `eval()`-able JS expression (§4.3 runs its real body instead).

---

## 6 · Session isolation, reset, injected state

| check | result |
|---|---|
| Mutate sid `A` (star `byteblaze/dotfiles` with a real click) | `/go?sid=A` `state_diff` → `{projects, stars}` |
| sid `B`, untouched | `state_diff` empty — **isolated** |
| `{"action":"reset"}` on `A` | `state_diff` empty again — **restored** |
| Inject custom state (rename `byteblaze` via `/post` `set`) | `/byteblaze` renders `R11 Injected Name` — **honoured on first load** |
| UTF-8 through `/post` | §4.1, 24 / 24 |

0 console errors across the whole run.

---

## 7 · Round-8 responsive work — re-verified at 1280×720 (and 1600 / 1920)

Every number below is `getBoundingClientRect()` in a live browser this round, on
the **mock** and — for the public issuable pages — on the **source**.

| width | side | `#content-body` x–right (w) | `aside.nav-sidebar` | `aside.right-sidebar` | gap | overflow-x |
|---|---|---|---|---|---|---|
| 1280 | **SOURCE** | 272 – 974 (702) | 0 – 256 | 990 – 1280 | 16 | 0 |
| 1280 | **MOCK** | 272 – 974 (702) | 0 – 256 | 990 – 1280 | 16 | 0 |
| 1600 | **SOURCE** | 304 – 1262 (958) | 0 – 256 | 1310 – 1600 | 48 | 0 |
| 1600 | **MOCK** | 304 – 1262 (958) | 0 – 256 | 1310 – 1600 | 48 | 0 |
| 1920 | **SOURCE** | 464 – 1422 (958) | 0 – 256 | 1630 – 1920 | 208 | 0 |
| 1920 | **MOCK** | 464 – 1422 (958) | 0 – 256 | 1630 – 1920 | 208 | 0 |

**Exact agreement at every width on both `/-/issues/71` and
`/-/merge_requests/40`**, including the `layout-page hide-when-top-nav-responsive-open
page-gutter right-sidebar-expanded page-with-contextual-sidebar` class set.
`/-/profile*` (mock-only — the source's settings pages need a login) holds
958 px content at 289 / 449 / 609 for 1280 / 1600 / 1920, `aria-label="User
settings"` on the aside, `overflowX = 0` at all three.

Hit tests at **1280×720** (`document.elementFromPoint` at the control's centre,
not a visibility check) — **13 / 13 HIT**: `Close issue`, the `Issue actions` ⋮
toggle, `Edit title and description` (`.js-issuable-edit`), Activity `Sort or
filter`, sidebar `[data-testid="edit-button"]`, the comment box, the MR `Code`
dropdown, the MR `.js-issuable-edit`, the MR sidebar edit, `Update profile
settings`, the status emoji picker, `Remove status`, `Add key` / `Add email
address` / `Save changes`.

> Recorded so it is not re-found: my first sweep reported `Issue actions` and
> `Edit title and description` as MISSING. That was **my** selector — I probed
> `button[aria-label='Edit title and description']` and
> `[data-testid='close-reopen-button-dropdown']`, and **neither attribute exists
> on the live source either**. GitLab's real markup is a `.js-issuable-edit`
> pencil and an unlabelled `.gl-dropdown-toggle` whose sr-only text is
> `Issue actions`; the mock renders both and both hit-test clean.

Issue body is not truncated: `.detail-page-description .description` at 1280 has
`clientHeight 239 == scrollHeight 239`, `clientWidth 702 == scrollWidth 702`,
`overflow: visible`, and the text ends on the complete final line
`…I agree to follow this project's code of conduct`.

### 7.1 · webarena-418…422 and 448…452 at 1280×720 — 10 / 10 PASS

Each in its **own fresh sid, reset first**, started from `/`, driven with real
clicks and real typing (no `evaluate`, no direct state POST), then **reloaded**,
then scored with the locator taken **verbatim from `/webarena/webarena.jsonl`**
and `exact_match` applied under WebArena's `clean_answer` (strip + lowercase):

| task | typed into the form | `document.querySelector('.cover-status').lastChild.textContent` | verdict |
|---|---|---|---|
| webarena-418 | `Cruising` | `'Cruising'` | ✅ |
| webarena-419 | `Enjoying life` | `'Enjoying life'` | ✅ |
| webarena-420 | `Playing Badminton` | `'Playing Badminton'` | ✅ |
| webarena-421 | `Resting due to leg injury` | `'Resting due to leg injury'` | ✅ |
| webarena-422 | `Out of Office` | `'Out of Office'` | ✅ |

| task | typed into the form | `document.querySelector('.profile-header [itemprop="url"]').outerText` | verdict |
|---|---|---|---|
| webarena-448 | `https://egg.tart.com` | `'egg.tart.com'` | ✅ |
| webarena-449 | `helloworld.xyz` | `'helloworld.xyz'` | ✅ |
| webarena-450 | `https://a11yproject.contributor.me` | `'a11yproject.contributor.me'` | ✅ |
| webarena-451 | `www.byteblaze.com` | `'www.byteblaze.com'` | ✅ |
| webarena-452 | `https://byteblaze.github.io` | `'byteblaze.github.io'` | ✅ |

**10 / 10 PASS, 0 console errors.** Both mutations survive a reload and coexist
(setting the URL did not clear the status).

---

## 8 · State budget and build

| check | result |
|---|---|
| cold `initial_state` through `/go?sid=` | **2 069 758 bytes = 1.974 MiB** — still inside the ~1–2 MB guidance, ~27 KB of headroom to 2 MiB |
| `/go` `state_diff` on an untouched sid | `{}` |
| top-level state keys | 17 — `currentUser, follows, groups, issues, labels, members, mergeRequests, milestones, nextIds, notes, projects, repo, snippets, stars, todos, ui, users` |
| `npm run build` | ✅ `✓ 168 modules transformed · built in 3.21s` |

Round 10 added two seeds (`merge_request_diffs.json` 478 KB,
`repo_languages.json` 12 KB) and **the mutable state did not grow past budget** —
both are imported as STATIC reference data and never copied into `state`. The
only mutable-state change was the `repo_size` repoint (+27 bytes).

---

## 9 · Task replays — 30 tasks driven end to end at 1280×720

Every replay: **own fresh `sid`, reset first**, started from the task's own start
URL, driven with **real clicks and real typing** (no `evaluate`, no direct state
POST), then **reloaded**, then scored with the evaluator taken **verbatim from
`/webarena/webarena.jsonl`** — `program_html` locators through `eval()`,
`exact_match` / `must_include` under WebArena's `clean_answer`.

### 9.1 Creation flows — 10 / 10 PASS

| task | flow driven | evaluator | verdict |
|---|---|---|---|
| webarena-752 | `/` → New project → blank → `web_agent`, Private → Create | `.visibility-icon` title ⊃ `Private`; `/-/commits` ⊃ `Initial commit` | ✅ |
| webarena-753 | `/projects/new` → template `Android` → Private → Create | title ⊃ `Private`; commits ⊃ `Initialized from 'Android' project template` | ✅ |
| webarena-756 | same, Jekyll template, `11711_gitlab` | title ⊃ `Private`; `.home-panel-description-markdown` ⊃ the Jekyll blurb | ✅ |
| webarena-744 | blank `AutoAGI`, **Public** → invite `primer` | title ⊃ `public`; members ⊃ `@primer` (helper → `Guest`) | ✅ |
| webarena-742 | blank `planner`, Private → invite `abisubramanya27`, `vinta` | title ⊃ `private`; members ⊃ both | ✅ |
| webarena-803 | `/groups/new` → `webagent` → invite `pandey2000`, `sayakpaul` | group members ⊃ both | ✅ |
| webarena-808 | cloud-to-butt → New issue → title + assignee + due date | `[data-qa-selector="title_content"]` exact `Let's keep the project alive`; `[data-testid="sidebar-due-date"]` ⊃ `Mar 31, 2033`; `.block.assignee` ⊃ `Byte Blaze`; `url_match` | ✅ |
| webarena-806 | New MR `redesign` → `feature/markdown-figure-block`, reviewer Byte Blaze | `.detail-page-description > a.gl-font-monospace` [0] / [1] exact; `.block.reviewer` ⊃ `Byte Blaze`; `url_match` | ✅ |
| ROUTES 91/92/93 | `/-/milestones/new` → create → list → detail → edit | milestone appears; detail renders with `.block.due_date`; edit form loads | ✅ |
| ROUTES 88 | `/-/labels/new` → create → list | label appears | ✅ |

### 9.2 Mutation flows on seeded records — 10 / 10 PASS

| task | flow driven | evaluator | verdict |
|---|---|---|---|
| webarena-481 | dotfiles members → invite `abisubramanya27` as **Guest** | `func:gitlab_get_project_memeber_role` → `Guest` | ✅ |
| webarena-576 | a11y-webring.club → invite `abisubramanya27` + `lahwaacz` as **Developer** | helper → `Developer` for both | ✅ |
| webarena-396 | `/convexegg/chatgpt` → Fork → namespace `byteblaze` → Fork project | `/byteblaze/ChatGPT` ⊃ `ChatGPT` (and `/byteblaze/chatgpt` too) | ✅ |
| webarena-522 | `/facebook` → fork **both** repos into `byteblaze` | `[data-qa-selector="projects_list"]` ⊃ `create-react-app`, `buck` | ✅ |
| webarena-390 | MR 1531 → comment `lgtm` | `#notes-list` lastElementChild `.timeline-discussion-body` exact `lgtm` | ✅ |
| webarena-391 | MR 1265 → comment `close because non reproducible` | same locator, exact | ✅ |
| webarena-415 | MR 40 → comment `@davepgreene` | same locator, exact | ✅ |
| webarena-533 | `/convexegg` → Follow, `/yjlou` → Follow (button flips to `Unfollow`) | `.user-profile` ⊃ `@convexegg`, `@yjlou` | ✅ |
| webarena-523 / 524 | `/explore/projects/starred` → open the top 5 / top 8 → Star each | `/users/byteblaze/starred` ⊃ all 5 / all 8 names | ✅ |
| webarena-811 | search the 404 issue → open → sidebar `assign yourself` | `/dashboard/issues?…assignee_username=byteblaze` ⊃ the issue title | ✅ |
| webarena-441 | `/-/blob/main/index.html` → Edit → rewrite `<title>` → Commit | `/-/raw/main/index.html` ⊃ `<title>GIVE ME SPACE</title>` | ✅ |

### 9.3 Profile mutations — 10 / 10 PASS

§7.1 — webarena-418…422 (`.cover-status`) and 448…452
(`.profile-header [itemprop="url"]`).

### 9.4 `/go` reports CREATIONS, not edits to seed data

| task | `state_diff` keys | shape |
|---|---|---|
| webarena-752 | `projects, members, repo.fileOverlay.byteblaze/web_agent:main:README.md, repo.treeOverlay…, repo.commitOverlay…, repo.branchOverlay…` | `projects 175 → 176` — a NEW record |
| webarena-522 | `projects, members, repo.forkOrigin.byteblaze/buck, repo.forkOrigin.byteblaze/create-react-app, nextIds.project, nextIds.member` | `projects.added = 2` (plus `changed = 2`, the two origins' `forks_count`, which is what GitLab does) |
| star a project | `projects, stars` | |
| tick a task-list checkbox | `issues` (→ `issues.changed[].description`) | no new state key |

### 9.5 Corrections to my own reconstruction — recorded so they are not re-found

Four "failures" in my first pass were **my** scripts, not mock defects. Each was
resolved against the verbatim `webarena.jsonl` entry or the live source:

| I first used | ground truth | effect |
|---|---|---|
| `.note-text` on the last note | `.timeline-discussion-body` | 390 / 391 / 415 all pass with the real locator; this is the same mistake round 9 recorded, re-made because I inherited its script |
| `button:has-text('Comment')` | `button.js-comment-submit-button` | the generic text match hits the hidden `Show comments only` filter item |
| `ul.projects-list li a.project-name` on `/facebook` | `facebook` is a **user** namespace (`name: Meta`), so its projects are on the user-profile card list | my harvest returned 0 repos; the page itself is correct and matches the source |
| `button[aria-label='Edit title and description']` | `.js-issuable-edit` | the attribute exists on **neither** the mock nor the source |

**Every locator quoted in this report is the verbatim `webarena.jsonl` string.**

---

## 10 · The round-10 P2 handbacks — which parts landed

### DIFF-904 · MR Changes tab / ROUTES row 81 — **landed as documented**

`…/-/merge_requests/40/diffs`: the `Changes 7` tab badge is **identical** to the
source's, and the body now reads `7 changed files between
github/fork/davepgreene/add-verification-function and main. Diff contents are not
rendered in this instance.` The source renders 5 `.diff-file` blocks, the mock 0.
`ROUTES.md` rows 80 / 81 / 82 now state exactly this (`81` is `[~]`, P2, with the
19 MB reason). Accurate; still P2, no task reads it.

### DIFF-905 · project-settings breadcrumbs — **FIXED**

The source's settings pages need a login, so they cannot be read live under the
read-only rule; compared instead against the `BreadcrumbList` JSON-LD in the
captures, which is the source's own markup:

| page | source (capture) | mock (browser, this round) |
|---|---|---|
| `/byteblaze/dotfiles/edit` | `Byte Blaze / dotfiles / General Settings` | **matches** |
| `…/-/settings/repository` | `… / Repository Settings` | **matches** |
| `…/-/blob/main/README.md` (public, read live) | `Byte Blaze dotfiles Repository` | **matches, and `<title>` matches** |

The other five settings breadcrumbs (`CI/CD Settings`, `Merge requests`,
`Integration Settings`, `Access Tokens`, `Monitor Settings`, `Package and
registry settings`) render but have no capture to check against.

One residual → **DIFF-1103 (P2)**: `<title>` on `/-/settings/repository` reads
`Repository Settings · Byte Blaze / dotfiles · GitLab` where the capture has
`Repository · Settings · Byte Blaze / dotfiles · GitLab`. `/edit` is right
(`General · Settings · …`), so the settings pages are internally inconsistent
about where the `· Settings ·` segment goes. No evaluator reads `<title>`.

### DIFF-906 · issue content depth — **3 of 4 landed; the 4th is correctly deferred**

Read off issue 71, mock vs live source, at 1920:

| probe | source | mock |
|---|---|---|
| `#task_status` | `1 of 3 checklist items completed` | **identical** |
| `#task_status_short` | `1/3 checklist items` | **identical** |
| `ul.task-list` count | 2 | 2 |
| `.task-list-item-checkbox` | 3 (1 checked) | 3 (1 checked) |
| literal `[ ]` / `[X]` in the description text | false | false |
| author role badges | `Contributor` (title *"This user has previously committed to the a11y-webring.club project."*) + `Owner` (title *"This user has the owner role in the a11y-webring.club project."*) | **both present, text and tooltip character-for-character identical** |
| `Linked items` card | present | present |
| design dropzone | present | **absent — deliberate** |

The dropzone is the visible face of GitLab design management; shipping it without
upload/version/comment would be a dead affordance, so leaving it out is the right
call and stays P2.

One new residual → **DIFF-1102 (P2)**: the two role badges carry the right text
and the right tooltip but not the source's chip styling — source
`12px / border 1px #dcdcde / border-radius 100px / padding 0 8px / colour #737278`,
mock `14px / no border / no radius / no padding / colour #333238`. The source also
hides the `Contributor` badge below `xl` (`d-none d-xl-inline-block`); the mock
shows it at every width.

### DIFF-907 · project-overview chrome — **4 of 6 landed, verified against the source**

Compared live on 5 projects at 1920:

| part | result |
|---|---|
| `.repository-languages-bar` | present on **5 / 5**; every bar's `title` **and** width **identical** to the source |
| stats row layout | **one row on 5 / 5** (was a stacked bulleted list) |
| `Project Storage` figure | **5 / 5 identical** — `97.8 MB`, `1.9 MB`, `2.7 MB`, `85.5 MB`, `32.4 MB` |
| detected-licence chip | **7 / 7 identical** where the source shows one — `MIT License` × 4, plain `LICENSE` × 3 (`vinta/awesome-python`, `koush/AndroidAsync`, `byteblaze/ericwbailey.website`). The 3 "differences" are the mock's logged-in `Add LICENSE` quick action against an anonymous source that shows nothing — correct, not divergent |
| `Unverified` GPG badge | not done — needs a `gpg_signatures` extraction (P2, logged by dev) |
| per-type coloured file icons | not done (P2) |

Both unlanded parts are genuinely P2: neither is referenced by any anchor string
or locator, and neither is on a task path.

Two pre-existing seed-sampling gaps surfaced again in the stats row and are **not
round-10 regressions**: branch counts are capped at 30 (`primer/design` shows
`30 Branches` vs the source's `38`; `root/metaseq` `30` vs `112`) and
`a11yproject/a11yproject.com` lacks the source's `5 Releases` stat item. Both are
`branches.json` / `releases` sampling, P2 under the "exact counts and totals"
rule.

### DIFF-908 · `SCHEMA.md` state key — **FIXED**

Line 31 now reads `mergeRequests`, with an explicit sentence that it loads from
`src/data/merge_requests.json`. Machine-checked: **every** one of the 17 live
top-level `/go` keys and **all 8** `repo.*` sub-keys (`fileOverlay`,
`treeOverlay`, `commitOverlay`, `branchOverlay`, `tagOverlay`, `branchDeletions`,
`tagDeletions`, `forkOrigin`) appear in `SCHEMA.md`. Both round-10 static seeds
are documented too (`merge_request_diffs.json`, `repo_languages.json`), and
`SCHEMA.md`'s size figure is the current one.

---

## 11 · Independent hunt — looking where no round has looked

Run **without reference to any previous sweep**, deliberately aimed at what round
10 touched plus surfaces no round has probed.

### 11.1 · Static and overlay element sweep at 1280×720

| check | result |
|---|---|
| routes swept | **80** |
| interactive elements hit-tested with `document.elementFromPoint` at their own centre | **4 700** |
| routes with a finding (covered / clipped / off-viewport / overflow) | **0 / 80** |
| console errors / pageerrors during the whole sweep | **0** |

Every `BLOCKED[COVERED]` the overlay pass reported is page content that an open
modal or dropdown is *supposed* to be covering (the navbar under the Invite-members
modal, project-row badges under the sort menu) — correct behaviour, verified one
by one.

Three "openers not found" were run down by hand and are all fine:

- **project `Clone` dropdown** — `#clone-dropdown` is an `<a>`, matching GitLab's
  own markup. It opens and yields
  `git clone ssh://git@localhost:2222/byteblaze/a11y-webring.club.git` plus the
  HTTP URL, which is what webarena-293…297 need.
- **Keyboard shortcuts / What's new** — both live inside the header help
  dropdown, so they are correctly invisible until it is opened. Opening it gives
  `What's new · 10 | Help | Support | Community forum | Keyboard shortcuts | ? |
  Submit feedback | Contribute to GitLab`, and `Keyboard shortcuts` opens a real
  modal (`Toggle shortcuts · Global Shortcuts · …`).
- **sidebar assignee / labels editors** — see DIFF-1106 below; they work, in two
  clicks.

### 11.2 · Targeted probes

| probe | result |
|---|---|
| 10 MRs × 4 tabs (Overview / Commits / Changes / Pipelines) = **40 loads** | 0 thin pages, 0 console errors, 0 `NaN` / `undefined` / `[object Object]` / `Invalid Date` |
| an MR **created in-session** | `Overview 0 · Commits 0 · Pipelines 0 · Changes 0`, 0 commit rows — it does **not** borrow another MR's commits |
| non-ASCII + percent-encoded blob paths (`Cristian Díaz.json` raw and `%20D%C3%ADaz`, `Zoë Bijl.json`, `皮肤制作教程.md`) | all render, 0 errors; both spellings resolve to the same blob |
| `/-/tree/main/%22data` | renders (a 404-ish empty tree), no crash |
| tree entries containing a quote or backslash, anywhere | **NONE** |
| live task-list checkbox | `1 of 3` → click → `2 of 3` → **reload** → `2 of 3`; `state_diff = ['issues']` exactly |
| `Project Storage` string across a 20-project sample | 0 malformed (`NaN`, `undefined`, `Infinity`, `0 Bytes`) |
| languages bar on projects with **and** without language data | renders where data exists, absent where it does not, 0 errors either way |
| history **back** and **forward** | `sid` intact on all three URLs |
| search form submit (`Enter` in the search box) | `/search?search=a11y&nav_source=navbar&sid=…` — `sid` kept **and** the query written to the URL |
| pagination on `/explore/projects` | 20/page, pages 1/2/3 have **0 overlap**, `?page=2` is deep-linkable and cold-reloads identically, `sid` kept |

**0 problems, 0 console errors across the entire hunt.**

---

## 12 · Source-vs-mock differences

Method: matched full-page pairs at 1920×1080 into
`assets/screenshots/diff/r11_{source,mock}_*.png` for the five views round 10
touched, read side by side; plus behavioural comparison and geometry taken with
`getBoundingClientRect()` / `getComputedStyle()` on both sides.

**Read the source captures with one caveat:** the source side is **anonymous**
(the read-only rule forbids logging in on 8023), so every authenticated
affordance the mock shows and the source does not — `Edit`, `Close issue`,
`Add SSH key`, `Add CHANGELOG` / `Add CONTRIBUTING` / `Add LICENSE`, `Web IDE`,
the sidebar `Edit` links — is the mock being **correct**, and is not listed here.

### DIFF-1105 · **P1** · The whole project CI/CD surface is empty where the source is populated

| Field | Value |
|---|---|
| Paths | `/:ns/:proj/-/pipelines` · `/:ns/:proj/-/pipelines/:id` · `/:ns/:proj/-/pipelines/charts` · `/:ns/:proj/-/jobs` |
| Source | `a11y-webring.club` → `All 1` + a real pipeline row; `a11yproject.com` → `All 7`; `primer/design` → `All 3`; `empathy-prompts` → `All 2`; `root/metaseq` → `All 11`. `/-/pipelines/1823` is a **200** rendering a real `Pipeline · …` page. `/-/pipelines/charts` → `Total: 1 pipeline · Failed: 1 pipeline · Success ratio: 0.00%`. `/-/jobs` → `All 7` / `All 49` with real job rows. |
| Mock | **`All 0` and the empty state on 5 of the 6 projects sampled** (`dotfiles` is genuinely empty on both). `/-/pipelines/1823` renders the **404 page**. `/-/pipelines/charts` → `Total: 0 pipelines · Success ratio: 100.00%`. `/-/jobs` → `All 0` + `Use jobs to automate your tasks`. |
| Internally inconsistent | the same MR's Pipelines **tab** in the mock reads `Pipelines 1` and renders a real `failed` pipeline row from `merge_request_diffs.json` — so the mock shows a pipeline for MR 40 and simultaneously tells you the project has none |
| Impact | **Zero scored tasks.** I grepped all 204 GitLab tasks: 4 mention "pipeline" and all four are template-project creations (webarena-750, 751, 755, 756) where the word appears only in a template description. No task opens a pipelines, jobs or CI-analytics page. |
| Why P1, not P2 | this is the same class as DIFF-901 — a list view rendering a materially different record set from the source — which this project priced P1 and closed, also with zero measured task impact. It is **not** a declared sampling decision: `assets/data_model.md` says nothing about pipelines, and `ROUTES.md` row 106 asserts the **opposite of the source** (*"list + CI/CD Analytics render the source's zero-pipeline state; `/:id` 404s as the source does"*). The analytics page also prints a wrong-and-misleading `Success ratio: 100.00%`. |
| Not a round-10 regression | pre-existing; round 10's dev disclosed it as finding #1 in `DEV.r10-diffs.md` (`ci_pipelines` has 1 465 rows across the seeded projects). It has simply never been priced in `TEST.md` before. |
| Fix hint | `SELECT id, project_id, sha, ref, status, source, created_at, finished_at FROM ci_pipelines WHERE project_id IN (<the 175 seeded ids>)` into a STATIC seed (it is reference data, so the mutable-state budget is untouched, exactly as `merge_request_diffs.json` was); wire `ProjectOps.jsx` to it, make `/-/pipelines/:id` resolve, derive the charts figures from it, and correct `ROUTES.md` row 106. `/-/jobs` needs `ci_builds` for the same treatment, or an honest `[~]` in `ROUTES.md`. |

### DIFF-1101 · **P2** · MR commit-header spacing and commit-row styling

The `.commit-header` omits the whitespace text node the source has between
`<span class="day">` and `<span class="commits-count">`, so it renders
`26 Jan, 20231 commit` instead of `26 Jan, 2023 1 commit`. Header row height is
21 px vs the source's 32 px. Commit rows are also taller than the source's and
render the title as a blue link where the source uses bold near-black. Same
markup, same order, same text otherwise. No anchor reads it, and `1 commit` is
still a substring of the rendered text.

### DIFF-1102 · **P2** · Author role badges have the right text but not the chip styling

Both badges are present with **character-for-character identical text and
tooltips** (§10). Their chrome differs:

| | source | mock |
|---|---|---|
| font-size | 12 px | 14 px |
| border | `1px solid #dcdcde` (Contributor) | none |
| border-radius | 100 px / 160 px | 0 |
| padding | `0 8px` / `4px 8px` | 0 |
| colour | `#737278` / `#626168` | `#333238` |
| responsive | `Contributor` is `d-none d-xl-inline-block` (hidden below xl) | always visible |

### DIFF-1103 · **P2** · `<title>` on project settings pages is internally inconsistent

`/-/settings/repository` renders `Repository Settings · Byte Blaze / dotfiles ·
GitLab`; the capture has `Repository · Settings · Byte Blaze / dotfiles ·
GitLab`. `/edit` is right (`General · Settings · …`), so the `· Settings ·`
segment lands in different places on different settings pages. No WebArena
evaluator reads `<title>`.

### DIFF-1104 · **P2** · File-tree table column widths, and the commit column never truncates

Measured at **both** 1920 and 1280, on `/:ns/:proj` and `/:ns/:proj/-/tree/:ref`:

| | source | mock |
|---|---|---|
| `Name` / `Last commit` / `Last update` column widths | **319 / 319 / 319** | **182 / 685 / 91** |
| row height | 42 px | 59 px |
| `.tree-commit-link` computed style | `overflow:hidden · text-overflow:ellipsis · white-space:nowrap · max-width:82%` | `overflow:visible · text-overflow:clip · white-space:normal · max-width:none` |
| `a11y-webring.club` overview page height | 2 780 px | 3 185 px |

Consequence: long commit messages wrap to 2–3 lines instead of ellipsising, file
names wrap (`apple-touch-<br>icon.png`), and `3 years ago` breaks across two
lines. The same 27 entries in the same order are all present and clickable, so
**no control is hidden** — which is why this is P2 and not P1 — but it is the most
visible remaining layout divergence, and it is on the site's highest-traffic page.

### DIFF-1106 · **P2** · Issue-sidebar assignee / label pickers need a second click

Clicking `Edit` in `.block.assignee` reveals GitLab's legacy
`.js-sidebar-assignee-data.selectbox` with a `.dropdown-menu-toggle` button, but
the menu itself stays `display:none` until that button is clicked too. GitLab's
own legacy sidebar auto-opens the dropdown from `Edit`. **I could not verify the
source side** — the affordance requires a login and the read-only rule forbids
one — so this is priced conservatively.

The flow does complete: `Edit` → toggle → search `Administrator` → pick →
`.block.assignee` reads `Administrator`, survives a reload, and `/go` reports
`state_diff = ['issues']`. Labels behave the same way (15 options, picking `No
label` clears them). Both webarena-808 (assign at creation) and webarena-811
(`assign yourself`) pass without touching this control.

### Re-verified as *not* differences this round

- **MR Commits tab** (DIFF-901) — 24/24 tab badges and 17/17 commit rows
  identical across 6 MRs at 2 viewports.
- **File-tree ordering** (DIFF-902) — 8/8 trees, 177 entries, same order.
- **Quoted / escaped seed paths** (DIFF-903) — 0 remain anywhere in `src/data/`.
- **Languages bar, stats-row layout, `Project Storage`, detected licence**
  (DIFF-907) — 5/5, 5/5, 5/5, 7/7 identical.
- **Task lists, checklist counter, role-badge text, `Linked items`**
  (DIFF-906) — identical.
- **Breadcrumbs** (DIFF-905) — match the captures' `BreadcrumbList`.
- **`SCHEMA.md`** (DIFF-908) — `mergeRequests`, and every live key documented.
- **Banner gating** (DIFF-001) — 19/19, the same 10 Auto DevOps projects, 0 leakage.
- **Sort semantics** — 8 distinct orderings from 12 tokens; the 4 that collapse
  tie on the key at the source too.

### Carried P2s, unchanged and unclosed (none blocks a round)

`Unverified` GPG badge · per-type coloured file icons · design-management
dropzone · branch counts capped at 30 (`primer/design` 30 vs 38, `root/metaseq`
30 vs 112) · `a11yproject.com` missing the `5 Releases` stat item ·
`zhongyang219/TrafficMonitor` missing 7 directories · blob syntax highlighting ·
MR diff bodies not carried (DIFF-904, `ROUTES.md` row 81 `[~]`) · seed size at
the top of budget.

---

## 13 · Bugs for the dev agent

### Functional bugs

**None.** No P0 and no P1 **functional** bug was found this round.

- BUG-001, BUG-004, BUG-A01, BUG-B01 → **CLOSED, re-verified** (§4)
- BUG-701, BUG-702 → **CLOSED, re-verified** (§7)
- DIFF-001 → **CLOSED, re-verified in both directions** (§4.5)
- DIFF-901…908 → **CLOSED or correctly deferred** (§2, §10)

### Handbacks

| id | priority | what | where |
|---|---|---|---|
| DIFF-1105 | **P1** | project pipelines / pipeline detail / CI-CD analytics / jobs are empty where the source is populated; `ROUTES.md` row 106 documents the opposite | §12 |
| DIFF-1101 | P2 | MR commit-header missing whitespace (`26 Jan, 20231 commit`) + commit-row styling | §12 |
| DIFF-1102 | P2 | role badges not styled as chips; `Contributor` missing its `d-none d-xl-inline-block` | §12 |
| DIFF-1103 | P2 | settings-page `<title>` puts `· Settings ·` in the wrong place on `/-/settings/repository` | §12 |
| DIFF-1104 | P2 | file-tree column widths 182/685/91 vs 319/319/319; commit column never ellipsises | §12 |
| DIFF-1106 | P2 | sidebar assignee/label picker needs a second click to open | §12 |

---

## 14 · Round history

### Round 9 → Round 11

| finding | status |
|---|---|
| DIFF-901 · MR Commits tab lists the project's commits | ✅ **FIXED** — 6 MRs, 2 viewports, badges and rows identical to the source |
| DIFF-902 · file-tree ordering case-insensitive | ✅ **FIXED** — 8 trees, 177 entries, ASCII order matches |
| DIFF-903 · phantom `"data` directory | ✅ **FIXED at the seed** — 0 quoted/escaped paths remain seed-wide; non-ASCII names render |
| DIFF-904 · MR Changes tab vs `ROUTES.md` row 81 | ✅ row corrected + real `files_count` in the body; still P2 |
| DIFF-905 · settings breadcrumbs | ✅ **FIXED** (one residual `<title>` nit → DIFF-1103) |
| DIFF-906 · issue content depth | ✅ **3 of 4** — task lists, checklist counter, role badges, `Linked items`; dropzone correctly deferred |
| DIFF-907 · project-overview chrome | ✅ **4 of 6** — languages bar, stats row, storage figure, licence label; GPG badge + file icons deferred |
| DIFF-908 · `SCHEMA.md` key name | ✅ **FIXED** |
| BUG-001 / 004 / A01 / B01, BUG-701 / 702, DIFF-001 | ✅ all still closed |
| — | **NEW: DIFF-1105 (P1), DIFF-1101…1104, 1106 (P2)** |

---

## 15 · Gating criteria

| # | criterion | verdict | evidence |
|---|---|---|---|
| 1 | Every `ROUTES.md` row verified (cold load + params + sid) | **PASS** | §3 — 146/146 probes covering all 132 rows, plus rows 92/93 driven separately; 0 console errors, 0 pageerrors, 0 sid losses, 0 overflow, 0 placeholders |
| 2 | All P0 and P1 `TODO.md` items `[x]` | **PASS** | 3 items remain open, none P0/P1: blob syntax highlighting (accepted P2), the `assets/data_model.md §14` checklist (`[~]`, process), and the seed-size budget note (P2, explicitly "not a blocker") |
| 3 | `AUDIT.md` zero P0 | **PASS** | `AUDIT.md` §3 records **P0: none**; nothing found this round is a P0 |
| 4 | `TEST.md` zero P0, zero P1 functional, zero P0/P1 source-vs-mock differences | **FAIL** | zero P0 ✅, zero P1 functional ✅, but **one P1 source-vs-mock difference: DIFF-1105** |
| 5 | `SCHEMA.md` current | **PASS** | all 17 live top-level `/go` keys and all 8 `repo.*` overlays documented; both round-10 static seeds documented; size figure current; DIFF-908 closed |
| 6 | `npm run build` passes | **PASS** | `✓ 168 modules transformed · built in 3.21s`, only the pre-existing chunk-size advisory |

**Overall: one criterion short of the gate, for one reason.** Criterion 4 fails on
DIFF-1105 — the project-level CI/CD surface (pipelines list, pipeline detail,
CI/CD analytics, jobs) renders an empty state on 5 of 6 sampled projects where
the source is populated, `/-/pipelines/:id` 404s where the source returns 200,
the analytics page prints a wrong `Success ratio: 100.00%`, and `ROUTES.md`
row 106 documents the opposite of the source's behaviour. It costs **zero** of
the 204 GitLab tasks, and it is pre-existing rather than a round-10 regression —
but it is the same class of difference this project has consistently priced P1,
and I am not going to round it down on the gating round.

Everything else passes, and the round-10 work is fully verified: 30 tasks
replayed end to end at 1280×720 under their verbatim evaluators, 4 700
interactive elements hit-tested clean, 146/146 routes, 145/145 anchor routes with
a machine-diffed **zero** change to the anchor contract, session isolation and
`/go` correct, state at 1.974 MiB inside budget, and 0 console errors anywhere in
the round.
