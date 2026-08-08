# webarena_gitlab_mock — Test Report

> Round: **7** (gating round — full Definition-of-Done verification)
> Date: 2026-08-07
> Mock: http://localhost:5261 (`npm run dev -- --port 5261`)
> Source: http://localhost:8023 — **reachable: YES**
> Tested by: playwright agent (sole agent this round; nothing else editing the tree)
> Supersedes: round 5, preserved verbatim at `TEST.round5-prev.md`
> Toolchain: real chromium via `/tmp/pwvenv/bin/python` +
> `LD_LIBRARY_PATH=/tmp/sysroot/...`. **No curl-only substitution for any route
> result.** `curl` is used only for HTTP status probes of the source and for the
> mock's `/post` / `/go` JSON endpoints, which have no DOM.

**Source read-only discipline held.** No POST, no login, no form submit and **no
`?sort=` URL** was issued against port 8023. Source-side facts below come from
(a) unauthenticated `GET` status probes, (b) the logged-in captures already in
`assets/html/` and `assets/screenshots/`, and (c) **read-only**
`docker exec gitlab gitlab-rails runner` queries — reads only, nothing written to
the container.

---

## 0 · How to read this round

Everything below was **driven in a browser this round**. Nothing is carried
forward on round 5's or round 6's word. Where a figure is reused from an earlier
round it is labelled **[carried]** and says why.

---

## 1 · Summary

| Metric | Result |
|---|---|
| ROUTES.md rows cold-loaded this round | **132 / 132** (149 probe URLs incl. multi-path rows) |
| …rendering a real view | **143 / 143 non-`SKIP` probes** |
| `<Placeholder>` / "has not been implemented yet" anywhere in the app | **0** |
| False completions (`[x]` row that renders placeholder / 404 / blank) | **0** |
| Cold deep-link failures | **0** |
| `?sid=` preservation failures | **0 / 149** |
| Console errors on cold load | **0** |
| Uncaught pageerrors on cold load | **0** |
| Trailing-slash + URL-encoded param probes | **26 / 26 clean** |
| Anchor routes resolving | **145 / 145** (65 are task-created 404s, 0 unexpected) |
| Anchor strings verbatim | **243 page-bound pairs, 0 mock-side gaps** |
| Anchor locators | **23 / 23 applicable** (9, 10 are Reddit's) |
| Tasks replayed / completable at **1280×720** | **20 / 22** |
| `merged_at` orderings actually order | ✅ · `closed_at` orderings degrade gracefully ✅ |
| Session isolation / reset / injected state / UTF-8 `/post` | **PASS** (20/20 chunk-boundary round-trips) |
| `npm run build` · built bundle browsed under `preview` | ✅ · ✅ 0 console errors |
| **P0 bugs** | **1** — BUG-701 (`/-/profile*` submit un-clickable at ≤1440 px; blocks webarena-418…422, 448…452 — **viewport caveat in §7**) |
| **P1 functional bugs** | **1** — BUG-702 (issue/MR right sidebar overlays the content column below ~1900 px) |
| P0/P1 source-vs-mock differences | **0** — DIFF-001 closed and re-verified in both directions |
| P2 findings | 11 (DIFF-002, 006, 007, 008, 009, 101–106, 707) |

---

## 2 · Round-6 changes — targeted verification

### 2.1 DIFF-001 (round 5's only P1) — ✅ **CLOSED, verified in both directions**

**Scope.** 76 project **sub-page** probes across 4 projects × 19 sub-paths
(`/-/issues`, `/-/merge_requests`, `/-/labels`, `/-/milestones`,
`/-/project_members`, `/-/pipelines`, `/-/branches`, `/-/tags`, `/-/commits/main`,
`/-/tree/main`, `/activity`, `/-/settings/repository`, `/-/settings/ci_cd`,
`/-/hooks`, `/-/usage_quotas`, `/-/security/configuration`,
`/-/value_stream_analytics`, `/-/snippets`, `/-/wikis/home`) — **0 banners
leaked**. 8 non-project pages (`/`, `/dashboard/projects`, `/byteblaze`,
`/-/profile`, `/explore`, `/groups/new`, `/projects/new`, `/dashboard/issues`) —
**0 banners**. This matches the source: of **181** captures in `assets/html/`,
`js-no-ssh-message` appears in exactly 7 and `Auto DevOps pipeline has been
enabled` in exactly 2 — **all 9 are project overviews**.

**Predicate.** I did not take round 6's word for the Auto DevOps gating. I
re-computed GitLab's own predicate live against the container, read-only:

```ruby
Ability.allowed?(byteblaze, :admin_project, p) && p.has_auto_devops_implicitly_enabled? &&
  p.builds_enabled? && !p.repository.gitlab_ci_yml && !p.empty_repo?
```

for the same 19 project overviews the mock was probed on. **19 / 19 exact
agreement**, including the four discriminating cases:

| project | source predicate | mock | why it differs from its neighbours |
|---|---|---|---|
| `byteblaze/dotfiles` | 1 | 1 | implicit default, no CI config |
| `byteblaze/timeit`, `cloud-to-butt`, `solarized-prism-theme`, `a11y-syntax-highlighting`, `millennials-to-snake-people`, `accessible-html-content-patterns`, `ericwbailey.website`, `remove-board-movement-…` | 1 | 1 | same — **round 5's "only 2 projects" framing was wrong**; 2 was the number of *captures*, not of projects |
| `byteblaze/empathy-prompts`, `a11y-webring.club`, `a11yproject/a11yproject.com` | 0 (`impl=false`) | 0 | explicit `project_auto_devops` row turns the implicit default off |
| `primer/design`, `root/metaseq`, `vinta/awesome-python`, `CellularPrivacy/…`, `convexegg/chatgpt` | 0 (`admin=false`) | 0 | byteblaze is not Maintainer+ |
| `aklsh/dots` | 0 (`ci=true`) | 0 | has a `.gitlab-ci.yml` |

**SSH banner.** Source: `byteblaze.keys.count == 0`, `require_ssh_key? == true`,
so it shows on every overview — which is what the mock does (19/19). The *dynamic*
half was driven at 1920×1080: banner present on `/byteblaze/dotfiles` → add a key
on `/-/profile/keys` (`gate-r7` appears in the list) → reload the project overview
→ **banner gone**. So the mock implements `User#require_ssh_key?` rather than
hard-coding it. *(At 1280×720 that same `Add key` button cannot be clicked — see
BUG-701.)*

0 console errors, 0 pageerrors, 0 `?sid=` losses across all 103 banner probes.

### 2.2 `<Placeholder>` elimination — ✅ verified

- `grep -c Placeholder src/App.jsx` → **0**
- `src/components/layout/Placeholder.jsx` → does not exist
- `"has not been implemented yet"` in `src/` → **1 hit, and it is a `//` comment**
  (`src/pages/ProjectOps.jsx:11`, explaining what the file replaced). Never
  rendered.
- `"has not been implemented yet"` in `dist/assets/*.js` and `*.css` → **0**
- The string was absent from `page.inner_text('body')` on **all 149** route
  probes.

### 2.3 The 11 previously-unimplemented rows — all render real views

*(detail in §3.1 and the source-copy diff in §8)*

Every one of rows **96, 97, 99–105, 113, 115** cold-loads a real view with 0
console errors. `ProjectSettingsRepo.jsx` (row 99) exposes all seven of the
source's `section.settings` ids; `ProjectSettingsMisc.jsx` covers 100–105, 113,
115. The remaining copy gaps against the logged-in source captures are enumerated
in §8 (DIFF-101 … DIFF-105) and are all **P2 depth**, on pages no anchor
references.

**A methodology note that changed three findings, recorded so it is not
re-derived.** GitLab ships collapsed `section.settings` bodies **in the DOM**,
hidden by CSS; the mock **lazily mounts** them (`ProjectSettingsGeneral.jsx:59`
renders `{expanded ? <div className="settings-content">…</div> : null}`). A
`textContent` diff therefore reports a collapsed mock section as ~100 missing
lines. After clicking every `Expand`, row 99 goes from 97 missing phrases to 13
and row 101 from 113 to 22. Separately, `textContent` does **not** include
`<input value=…>`, which made the CI/CD runner registration token and the three
badge snippets look absent; read as element values they are present:

```
GR1348941tBFVancyEKczeWtBv-iC   FOUND (input value)
pipeline status / coverage report / Latest Release   FOUND (input values)
```

### 2.4 Stale-marker spot-check

| ROUTES row | marker | driven this round | verdict |
|---|---|---|---|
| 30 star/unstar | `[x]` | on `/byteblaze/dotfiles`: `Star \| 0` → click → `Unstar \| 1`, survives reload, appears on `/users/byteblaze/starred`, `Unstar` → `Star \| 0`. *(0 is correct — `Project#star_count` for dotfiles is **0** on the container; round 5's "55" was a different project.)* | ✅ genuine |
| 16–19 explore tabs | `[x]` | `/explore/projects{,/trending,/starred,/topics}`, `/explore/groups` all render real views | ✅ genuine |
| 64, 65 starrers/forks | `[x]` | both render real views cold | ✅ genuine |
| 98 general settings | `[x]` | renders; Badges + Advanced sections **now present** (round 5's "~25 of ~130 lines" no longer holds) — see DIFF-105 for what is still thin | ✅ genuine |
| 99–105 settings | `[x]` | all render real views | ✅ genuine |
| 106–118 leaves | `[x]` | all render real views | ✅ genuine |
| blob syntax highlighting | `[ ]` | no tokenizer in `src/` | ✅ correctly still open (accepted P2) |
| `data_model.md §14` checklist | `[~]` | not run by any round | ✅ correctly still open |

**0 false completions.** No `[x]` row renders a placeholder, a 404 or a blank
page.

---

## 3 · Route parity re-sweep (this round)

### 3.1 Cold-load sweep

Every numbered ROUTES.md row was given a concrete probe URL, cold-loaded in a
**fresh browser context** with a **per-row `?sid=`**, and classified by what
actually rendered. Multi-path rows (43, 76, 103, 106, 112, 118, 122) were probed
once per path, giving **149 probe URLs over 132 rows**.

| Class | Count |
|---|---|
| Real view, correct content | **143** |
| Declared not migrated (`SKIP`) | **6** (rows 24, 34, 42, 68, 77, 85) |
| `<Placeholder>` | **0** |
| Unexpected `NotFound` | **0** |
| Blank | **0** |
| **False completions** | **0** |
| `?sid=` lost | **0 / 149** |
| Console errors | **0** |
| Uncaught pageerrors | **0** |

Three first-pass classifications that were **my probe's fault, not the app's**,
re-probed and green:

- Row 20 `/explore/snippets` flagged "blank" on a 120-char threshold. It is the
  source's real empty state — `Snippets / Your snippets / Explore snippets /
  No snippets found`. ✅
- Row 89 `/-/labels/:id/edit` — I used `id=1`. a11yproject.com's label ids start
  at **1752**; `/-/labels/1752/edit` renders `Edit Label`. A 404 on a
  non-existent label id is what the source does. ✅
- Rows 120–123 — I used `/groups/a11yproject/…`. **`a11yproject` is a user**
  (`users.json` id 2325), not a group, on the source too
  (`GET /groups/a11yproject/-/group_members` on 8023 → `302`, while
  `/groups/robert1003/-/group_members` → `200`). Re-probed against the two real
  seeded groups: `/robert1003`, `/gitlab-instance-58545a48`,
  `/groups/robert1003/{-/group_members,-/issues,-/merge_requests,-/milestones,-/labels,edit}`
  and `/groups/gitlab-instance-58545a48/-/group_members` — **all 8 render real
  views**, members table included. ✅

---

## 4 · Anchor contract

### 4.1 Anchor routes — **145 / 145**

Every route in `assets/task_anchors.json`, cold, fresh context, fresh `?sid=`:

| | |
|---|---|
| Routes probed | **145** |
| `?sid=` preserved | **145 / 145** |
| Console errors / pageerrors | **0 / 0** |
| `<Placeholder>` on an anchor route | **0** |
| Rendering seed content | **80** |
| 404 in the mock | **65** |

All 65 404s classified against ROUTES.md's *Anchor Route Coverage*: **every one is
a group-B or group-C route whose record the task creates or forks** — 31
`byteblaze/*` projects and their `/-/project_members`, `/-/commits`,
`/-/raw/main/README.md` sub-routes, 9 fork targets, 5 `/groups/*/-/group_members`,
the 4 `gimmiethat.space` `urls.txt` paths. **0 unexpected 404s; 0 group-B/C routes
pre-seeded** (a pre-seeded one would make its task trivially already-done).

### 4.2 Anchor strings — 243 page-bound pairs, **0 mock-side gaps**

252 anchor entries expand to **355** (string, page) pairs: **243 page-bound** plus
112 `last` / `(answer)` bindings that name no page. Each page-bound pair was
checked **byte-for-byte** against `page.inner_text('body')` on its own page.

| Class | Count |
|---|---|
| Present verbatim on a page that resolves today | **5** |
| Absent because the page is a task-created route that 404s today | **168** |
| Absent because the string is a **post-condition the task writes** | **70** |
| **Absent on a resolving page where the source would show it** | **0** |

All 70 were triaged individually against their task's `ques` text in
`/webarena/webarena.jsonl` — statuses (418–422), website URLs (448–452),
LICENSE bodies (411–414, 736), `<title>` edits (441–445), comments (389–393, 415),
invited members (480–485, 567–579), follows (533–537), stars/forks (522–527),
assignee dashboards (446, 447, 804, 810–811). §5 confirms each appears **after**
its flow is performed.

Read-**preconditions** re-verified present today against the container:

| precondition | source (read-only `gitlab-rails runner`) | mock |
|---|---|---|
| `gimmiethat.space` members | `byteblaze=Owner, yjlou=Developer` | identical ✅ |
| `solarized-prism-theme` members | `byteblaze=Owner, abisubramanya27=Guest` | identical ✅ |
| `a11yproject.com` — byteblaze | `Maintainer` | ✅ |
| `gimmiethat.space/LICENSE` blob | MIT text present on source | present, full 22 lines ✅ |
| `accessible-html-content-patterns/LICENSE` | MIT on source (task 412 changes it to Apache) | MIT ✅ |
| `dotfiles/LICENSE` | **absent on source** | mock renders `"LICENSE" did not exist on "main"` ✅ |
| `gimmiethat.space/index.html` `<title>` | present on source | `<title>gimmiethat/space</title>` ✅ |

> **One anchor fails on the source too — do not "fix" it.** webarena-736 requires
> on `…/-/blob/main/LICENSE` the string
> `The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.`
> — with a **space** between `all` and `copies`. GitLab's blob view puts every
> file line in its own `<span id="LCn">`, so in `page.content()` the source reads
> `…included in all</span></span>…copies…`. Verified in the logged-in captures
> `proj-blob-accessible-license.html` and `proj-blob-a11ysyntax-license.html`:
> the joined sentence is absent raw **and** after `html.unescape`. The mock
> reproduces the source's markup faithfully and therefore has the same gap. Its
> raw view (`/-/raw/main/LICENSE`) has the full text on one logical line.
> **Source-side quirk, not a mock defect.**

### 4.3 Anchor locators — **23 / 23 applicable resolve** (9 and 10 are Reddit's)

Each locator string was evaluated **verbatim** in the page, at 1920×1080, on a
page that should carry it — creating the record first where the task creates it:

| # | page | returned |
|---|---|---|
| 0 | `/primer/design/-/milestones/1` (created) | `Upcoming\nMilestone Jan 16, 2030–Jan 30, 2030\n…\nproduct launch\n…` |
| 1 | `/a11yproject/…/-/issues/1534` (created, then assigned) | `Assignee\nEdit\nByte Blaze` |
| 2 | milestone 1 | `Due date\nEdit\nJan 30, 2030 (Upcoming)` |
| 3 | `/primer/design/-/merge_requests/451` (created) | `0 Reviewers\nEdit\nNone - assign yourself` |
| 4 | milestone 1 | `Start date\nEdit\nJan 16, 2030` |
| 5 | `/byteblaze` after setting status | `Cruising` |
| 6 | issue 719 | the issue body |
| 7 | `/byteblaze/dotfiles` | `🤖 Computer setup` |
| 8 | `/byteblaze` after setting the website | `egg.tart.com` |
| 9, 10 | — | **Reddit `.submission__inner`** (webarena-681…688) — neither pass nor fail |
| 11 | `/users/byteblaze/following` | full `.user-profile` outerText |
| 12 | `/byteblaze/dotfiles` | `Public - The project can be accessed without any authentication.` |
| 13 | `/dashboard/projects` | the project rows |
| 14 | issue 1534 | `401 bad gateway` |
| 15 | issue 1534 | `Due date\nEdit\nNone` |
| 16 | MR 1531 after posting | `lgtm` |
| 17 / 18 | MR 451 | `dialog-component` / `main` |
| 19–24 | members tables, before **and** after invite | `Guest` ×4 (after invite), `Guest`, `Developer` |

**Locators 5 and 8 depend on BUG-701.** They resolve at 1920×1080 because the
profile form can be submitted there. At **1280×720 they return nothing**, because
`Update profile settings` cannot be clicked — see §7 BUG-701.


---

## 5 · Task replay — 20 flows driven at **1280×720**, WebArena's default viewport

Every flow was driven through the UI the way an agent would, the post-condition
read at its real anchor URL **after a full reload in a fresh page**, and `/go?sid=`
inspected.

| task | flow | post-condition | verdict |
|---|---|---|---|
| webarena-742 | create **private** `planner` → invite `abisubramanya27` + `vinta` | `@abisubramanya27` + `@vinta` on `/-/project_members`; `.visibility-icon[title]` = `Private - Project access must be granted…` | ✅ |
| webarena-745 | create **public** `awesome-llms` → invite 3 | `@primer`, `@convexegg`, `@abisubramanya27`; `Public - …` | ✅ |
| webarena-748 / 753 | create from **Android** template | `/-/commits` has `Initialized from 'Android' project template` | ✅ |
| webarena-749 / 754 | create from **NodeJS Express** template (`use_template_express`) | `Initialized from 'NodeJS Express' project template` | ✅ |
| webarena-750 / 755 | create from **Pages/Plain HTML** | `.home-panel-description-markdown` = `Example plain HTML site using GitLab Pages: https://pages.gitlab.io/plain-html` | ✅ |
| webarena-752 | create private blank `web_agent` | `Initial commit` in `/-/commits`; `Private - …` | ✅ |
| webarena-799 | create group `n-lab` → invite 4 | `/groups/n-lab/-/group_members` has `@patou @egpast @westurner @jontutcher` | ✅ |
| webarena-481 | invite `abisubramanya27` to dotfiles as **Guest** | `gitlab_get_project_memeber_role` → `'Guest'` | ✅ |
| webarena-396 | fork `convexegg/chatgpt` | lands `/byteblaze/chatgpt`; `/byteblaze/**ChatGPT**` → `/byteblaze/chatgpt`, `h1 = Chatgpt`, not 404 | ✅ |
| webarena-522 | fork `facebook/buck` + `facebook/create-react-app` | `[data-qa-selector="projects_list"]` contains both | ✅ |
| webarena-523 | star 5 repos | `/users/byteblaze/starred` lists **5/5** | ✅ |
| webarena-533 | follow `convexegg` + `yjlou` | `.user-profile` on `/following` has both | ✅ |
| webarena-390 | comment `lgtm` on a11y MR 1531 | locator 16 → `lgtm` | ✅ |
| webarena-658 | create issue `401 bad gateway` | `/-/issues/1534`; `title_content` exact; assign-yourself → `.block.assignee` = `Byte Blaze` after reload | ✅ |
| webarena-590 | create milestone in primer/design | `/primer/design/-/milestones/1`; `#content-body` has `product launch`; start `Jan 16, 2030`, due `Jan 30, 2030 (Upcoming)` | ✅ |
| webarena-666 | new MR `dialog-component` → `main` | `/primer/design/-/merge_requests/451`; mono[0]=`dialog-component`, mono[1]=`main` | ✅ |
| webarena-414 / 736 | commit LICENSE via `/-/new/main?file_name=LICENSE` | blob contains `MIT License` in `innerText` **and** `page.content()` | ✅ (the second 736 string is the source-side quirk, §4.2) |
| webarena-441 | edit `index.html` `<title>` via the simple editor | `/-/raw/main/index.html` contains `<title>GIVE ME SPACE</title>`, escaped form in `content()` | ✅ |
| webarena-804 / 810 | assign a flash-alert issue to byteblaze | `Clarify usage of flash alert` on `/dashboard/issues?scope=all&state=opened&assignee_username=byteblaze`, after reload | ✅ (both paths: `[data-testid="assign-yourself"]` **and** edit-button → dropdown → `@byteblaze`) |
| label create | new label on dotfiles | appears in `/-/labels` | ✅ |
| **webarena-418…422** | **set profile status** | `.cover-status` → **ABSENT at 1280×720** (`💬Cruising` at 1920) | ❌ **BUG-701** |
| **webarena-448…452** | **set profile website URL** | `.profile-header [itemprop="url"]` → **ABSENT at 1280×720** (`egg.tart.com` at 1920) | ❌ **BUG-701** |

**20 / 22 flows complete at 1280×720. The two that fail are the same defect.**

`/go` for webarena-742 reports a **creation**, not an edit to seed data:

```
projects: added=['byteblaze/alpha_iso'/'byteblaze/planner']  changed=0  removed=0
members:  added / removed / changed present
repo.fileOverlay.<proj>:main:README.md {new}   repo.treeOverlay.<proj>:main {new}
repo.commitOverlay.<proj>:main {new}           repo.branchOverlay.<proj> {new}
nextIds.project {old,new}                      nextIds.member {old,new}
```

**Six "failures" in the first replay pass were my selectors, not the app** — kept
here so the next round does not re-derive them:

- `/projects/new` and `/groups/new` panes are **anchors**, `a[href="#blank_project"]`
  / `a[href="#create_from_template"]` / `a[href="#create-group-pane"]`. There is no
  element with those ids.
- The NodeJS Express template's testid is **`use_template_express`**, not `_nodejs`.
- The fork namespace menu keeps `.show` on the **parent `.dropdown`**, not on
  `.dropdown-menu`. Use `[data-qa-selector="select_namespace_dropdown_item"]`.
- The invite modal's search field is **`#invite-members-search`** and the role
  select is **`#invite-members-role`**; an unscoped `li:has-text('<name>')` matches
  chrome nav items, which silently swallows every user after the first.
- On `/-/edit/:ref/*path` the file body is **`textarea` [0]**; `textarea` [1] is the
  commit message.
- The issue sidebar assignee needs `[data-testid="assign-yourself"]`, or
  `[data-testid="edit-button"]` → `.dropdown-menu-toggle` → an `li` **scoped to
  `.block.assignee`**.

---

## 6 · Session isolation, `/go`, and the state pipeline

| Check | Result |
|---|---|
| Two sids each create a project through the UI; neither sees the other's | `isoA7` sees `alpha_iso` / not `beta_iso`; `isoB7` the reverse — 404 both directions ✅ |
| `/go` shape | `{initial_state, current_state, state_diff}` ✅ |
| `state_diff` reports a **CREATION** | `projects.added=['byteblaze/alpha_iso']`, `changed=0`, `removed=0`; seed rows untouched ✅ |
| `reset` restores initial (**fresh browser context**) | `/byteblaze/resetprobe` → 404, `/dashboard/projects` no longer lists it, `state_diff` empty ✅ |
| The other sid survives a reset of the first | ✅ |
| Injected custom state **wins over the default seed** | `POST /post {action:'set'}` with a hand-added `byteblaze/injectedproj` → the route renders and `INJECTED_DESC_MARKER` is on the page; `ui.injectedMarker == 'HELLO_INJECT'` via `/go` ✅ |
| `POST /post` UTF-8 integrity at chunk boundaries (**BUG-004**) | **20 / 20**, `ensure_ascii=False` so real multi-byte bytes straddle the boundary; the 🐞's first byte placed at offsets 0–3 of 8 KiB / 16 KiB / 64 KiB / 128 KiB / 256 KiB, payload `type: bug 🐞 — “smart” … é ü 中文 🚀 ✔` returned byte-for-byte ✅ |
| `npm run build` | ✅ 165 modules, 3.06 s (only the pre-existing chunk-size advisory) |
| `npm run preview` serves the state API | ✅ `/` 200, `/go` 200, `/post` 200 and round-trips; browsed `/`, `/byteblaze/dotfiles`, issue 719, `/-/profile` in the **built** bundle at 1280×720 with **0 console errors** |

### One caveat worth writing down (P2, not a blocker)

`reset` restores initial state **for a fresh browser context**, which is how an RL
rollout starts. It does **not** dislodge a *warm* context: create a project, `POST
{action:'reset'}`, then reload the same page in the same browser profile and the
project is still listed, because the client trusts `localStorage[storageKey(sid)]`
over the server's reset. Logged as **DIFF-707**; no harness that opens a new
context per episode is affected.

---



---

## 7 · Bugs for the dev agent

> **These are new this round.** They were not found by rounds 1–6 because every
> previous sweep ran at **1600×1100 or 1920×1080 only**, and both defects are
> viewport-dependent. All findings were confirmed with a **real `locator.click()`**
> (which scrolls into view and retries actionability), not with a static hit-test —
> Playwright's own failure log names the intercepting element.
>
> **Measured threshold per control** (real clicks, `/-/profile`, `/-/profile/keys`,
> issue 719):
>
> | viewport | `Update profile settings` | status 🙂 picker | `Add key` | `Reopen issue` | `Issue actions` |
> |---|---|---|---|---|---|
> | 1280 / 1366 / 1440 | **BLOCKED** | BLOCKED | BLOCKED | BLOCKED | BLOCKED |
> | 1536 / 1600 | ok | BLOCKED | BLOCKED | ok | BLOCKED |
> | 1728 | ok | ok | ok | ok | BLOCKED |
> | 1920 | ok | ok | ok | ok | ok |
>
> **One honesty caveat on the P0 rating.** The task-blocking half of BUG-701
> (`Update profile settings`) reproduces at **≤ 1440 px** and not at ≥ 1536. I have
> rated it P0 because WebArena's `ScriptBrowserEnv` runs at **1280×720** by
> default — but the harness source is **not installed on this host** (only
> `/webarena/webarena.jsonl` and the setup scripts are), so **I could not verify
> that default here**; it is from the WebArena codebase, not from a measurement I
> made. If your rollouts are pinned to ≥ 1536 px, BUG-701 drops to P1 (the emoji
> picker, `Remove status` and `Add key` are still dead up to 1600). The **layout
> divergence itself is P1-or-worse at every width below 1920 regardless**, and is
> confirmed against the source, not inferred.

### BUG-701 · **P0** · Every `/-/profile*` submit button is intercepted by the fixed left nav below ~1900 px — webarena-418…422 and 448…452 cannot be completed

| Field | Value |
|-------|-------|
| Route | `/-/profile`, `/-/profile/preferences`, `/-/profile/keys`, `/-/profile/emails`, `/-/profile/personal_access_tokens` |
| Element | the page's primary submit — `Update profile settings`, `Save changes`, `Add key`, `Add email address`, `Create personal access token`; also the status modal's 🙂 emoji picker and `Remove status` |
| Action | `locator.click()` at 1280×720 |
| Expected | form submits |
| Actual | `<aside class="nav-sidebar gl-flex-shrink-0">…</aside> intercepts pointer events` — Playwright times out; the button is `visible: True, enabled: True` |
| Console errors | none |
| Geometry | on `/-/profile*` the content column starts at **x = 176** (1600 px) / **x = 16** (1280 px) while `aside.nav-sidebar` is `position: fixed; z-index: 600; left: 0; width: 220px`. `.content-wrapper` on these pages has `left: 0, width: 100%` — **it never reserves the nav's 220 px**. On the mock's *project* pages the same wrapper correctly starts at `x = 256`, so the app already knows how to do this. |
| Task impact | **10 scored tasks blocked at the default viewport.** Driven end to end: at 1280×720, webarena-448 → `Update profile settings` un-clickable → `.profile-header [itemprop="url"]` on `/byteblaze` stays **ABSENT**; webarena-418 → same button is the only way to commit the status → `.cover-status` stays **ABSENT**. The identical script at 1920×1080 gives `egg.tart.com` and `💬Cruising`. Tasks 418–422, 448–452. |
| Fix hint | give the user-settings layout the same left offset the project layout uses (`.content-wrapper` `margin-left: 220px` / `padding-left` under the `nav-sidebar` breakpoint), or drop `position: fixed` from the settings-page nav. One rule in `src/styles/global.css`; `src/pages/ProfileLayout`-side markup looks fine. |

### BUG-702 · **P1** · Issue/MR detail: the fixed right sidebar overlays the content column below ~1900 px and eats five controls

| Field | Value |
|-------|-------|
| Route | `/:ns/:proj/-/issues/:iid`, `/:ns/:proj/-/merge_requests/:iid` |
| Elements | `Reopen issue` / `Close issue`, `Issue actions` (⋮), `Edit title and description` (pencil), Activity `Sort or filter`, MR `Code` clone dropdown |
| Actual | `…from <aside class="right-sidebar js-right-sidebar js-issuable-sidebar right-sidebar-expanded"> subtree intercepts pointer events` |
| **Source comparison** (plain `GET`, both public pages, no mutation) | measured `#content-body` right edge vs `.right-sidebar` left edge at three widths: |

```
        SOURCE  content 464–1422 | sidebar 1630–1920   → gap  208px   blocked 0
1920 px MOCK    content 609–1567 | sidebar 1630–1920   → gap   63px   blocked 0
        SOURCE  content 304–1262 | sidebar 1310–1600   → gap   48px   blocked 0
1600 px MOCK    content 449–1407 | sidebar 1310–1600   → OVERLAP 97px blocked 3
        SOURCE  content 272– 974 | sidebar  990–1280   → gap   16px   blocked 0
1280 px MOCK    content 289–1247 | sidebar  990–1280   → OVERLAP 257px blocked 4
```

| Field | Value |
|-------|-------|
| Impact | **No scored task blocked** — I grepped all 204 GitLab tasks and none closes/reopens an issue, edits an issue title in place, or clones from an MR (the five "clone with SSH" tasks 293–297 read the **project overview's** Clone dropdown, which is clickable at every width). The sidebar `[data-testid="edit-button"]` controls that tasks 446/447/658/804/810 *do* use are **not** affected and click fine at 1280. So: P1, not P0. |
| Fix hint | the source shrinks the content column when `.right-sidebar` is expanded; the mock keeps it full width. Add the `right-sidebar-expanded` padding-right rule to the issuable content wrapper. |

### Retracted before reporting — recorded so they are not re-found

- `/-/profile/account` `Update username` / `Delete account` "blocked" at 1920:
  both carry `disabled=""`. GitLab disables them until the path field changes /
  the username is typed to confirm. **Correct behaviour, not a bug.**
- `a:has-text('Edit')` "blocked" on `/-/labels`: my selector matched two
  zero-size anchors in the user dropdown (`/-/profile`, `/-/ci/editor`), not a
  label edit link. **Tester error.**
- `Add key` / `Add email address` / `Create personal access token` returning
  no-ops at 1920: I clicked them with the form empty. `ProfileKeys.jsx:272`
  early-returns on a blank key, which is right; filling the form and submitting
  via `requestSubmit()` adds the key and the list goes `0` → `1`. *(The source
  would render `This field is required.` here and the mock renders nothing — a
  separate **P2**, DIFF-106.)*


### 3.2 Trailing-slash and URL-encoded param forms — 26 / 26 clean

Every probe cold, fresh context, fresh `?sid=`. **0 404s, 0 `sid` losses, 0 console
errors, 0 pageerrors.** Includes both halves of every encoding the brief named,
and the params were shown to *drive* the row set, not merely be accepted:

| probe | decodes to | rows rendered |
|---|---|---|
| `/a11yproject/…/-/issues/?label_name%5B%5D=bug` and the no-slash twin | `label_name[]=bug` | 3 / 3 (identical) |
| `/primer/design/-/issues/?label_name%5B%5D=type%3A%20bug%20%F0%9F%90%9E` and the literal `?label_name[]=type: bug 🐞` | `%3A`→`:`, `%20`→space, `%F0%9F%90%9E`→🐞 | 2 / 2 (identical) |
| `/umano/AndroidSlidingUpPanel/-/issues/?state=opened&not%5Blabel_name%5D%5B%5D=BUG` | `not[label_name][]=BUG` | 20 |
| `/root/metaseq/-/issues/?search=OPT%20model&sort=created_asc&state=opened&label_name%5B%5D=question&first_page_size=20` | 5-param form | 1 |
| `…/-/issues/?label_name%5B%5D=None` | "no label" | 1 |
| `/byteblaze/dotfiles/-/blob/main/Adobe/Illustrator/AI24Settings_Dec%202,%202019_9%2040%20PM` | `%20`→space inside a blob path | blob renders |
| `/amwhalen/archive-my-tweets/-/tree/github/fork/chtitux/addRssFeed` | a `:ref` with three `/` | tree renders |
| `/dashboard/issues/?scope=all&…assignee_username=byteblaze` | trailing slash before `?` | 13 |
| `/byteblaze/dotfiles/-/commits/`, `/-/tree/main/`, `/byteblaze/dotfiles/`, `/byteblaze/` | bare trailing slash | 40 / tree / overview / 10 |
| `/explore/projects/?sort=stars_desc&page=2` | paged + sorted | 20 |

### 3.3 `merged_at` / `closed_at` orderings after the round-6 backfill

Compared **only on `sort=`-pinned mock URLs**; no `?sort=` URL was issued on 8023.

| probe | result |
|---|---|
| `…/-/merge_requests?state=merged&sort=merged_at_desc` vs `…_asc` | **different orders** — the 286-row `merged_at` backfill genuinely orders. First row desc `Add The power of ChatGPT as a cognitive accessibility assistive technology…`, asc `Update resources` |
| `…?state=merged` (default) | a third, distinct order — the default is not silently `merged_at` |
| `…/-/merge_requests?state=closed&sort=closed_at_{desc,asc}` | identical to each other and to the unsorted list, **0 console errors, 0 pageerrors** → degrades gracefully, as briefed |
| `…/-/issues?state=closed&sort=closed_at_{desc,asc}` | same — graceful |

Seed check: `merge_requests.json` 729 rows, `merged_at` set on **286**,
`closed_at` on **0**; `issues.json` 613 rows, `closed_at` on **0**. Matches the
round-6 note exactly.


---

## 8 · Source-vs-Mock differences

**Method.** 13 new mock screenshots at 1920×1080 (and 2 at 1280×720) into
`assets/screenshots/diff/r7_mock_*.png`. Structural-copy diff of `#content-body`
`textContent` for the 12 routes round 6 touched, against their **logged-in**
`assets/html/` captures, with every collapsed `section.settings` expanded first and
with `<input>`/`<textarea>` values read separately. The source was never mutated.

### DIFF-101 · **P2** · `/-/settings/repository` (row 99) — 6 copy fragments short

After expanding all seven sections, 111 of 117 source units are present. Missing:
`SSH host keys`, `Hide host keys manual input`, `Create wildcard` /
`Select branch or create wildcard`, `Toggle allowed to force push`, and the
`New deploy token — Create a new deploy token for all projects in this group.`
line. All seven `section.settings` ids are present and the Default-branch dropdown
**does** list `main | default | master` once opened — my first pass reported it
missing only because the mock mounts dropdown contents on open while GitLab ships
them collapsed in the DOM.

### DIFF-102 · **P2** · `/-/settings/ci_cd` (row 101) — host-shaped strings and 4 fragments

The 9 sections, the runner registration token `GR1348941tBFVancyEKczeWtBv-iC` and
all three badge panels (`pipeline status`, `coverage report`, `Latest Release` ×
Markdown / HTML / AsciiDoc) are present **as input values**. The residual diff is
almost entirely the source capture's hard-coded `http://10.186.197.203:8023/…`
badge and trigger URLs, which the mock **correctly** derives from
`window.location` — that is the desired behaviour, not a gap. Genuinely missing:
`Registration token` (label), `Trigger description is required.`,
`Add project` (CI_JOB_TOKEN scope), `There are no secure files yet. / Upload File`.

### DIFF-103 · **P2** · `/-/value_stream_analytics` (row 113) — filtered-search history dropdown

`Toggle history` is in the DOM, but `Recent searches` /
`You don't have any recent searches` are not. Everything else matches: the 6-stage
path nav, Key metrics, DORA metrics, `We don't have enough data to show this stage.`

### DIFF-104 · **P2** · `/-/settings/operations`, `/-/hooks`, `/-/settings/{integrations,access_tokens,packages_and_registries}`, `/-/usage_quotas`, `/-/settings/merge_requests`, `/-/security/configuration`

Fragment-level check: **0 missing** on every one of these. (Row 100 is a clean
43/43. Row 115 renders all 10 scanner cards with their real status badges, the
three tabs, the Ultimate upsell **and** the source's own
`Quickly enable all continuous testing and compliance tools by enabling Auto DevOps`
alert — confirmed present in `r4-sec-config.html`, and distinct from the
DIFF-001 banner.) The only residual "misses" are element-boundary joins in the
capture (`Project Hooks(0)` as one text node vs two).

### DIFF-105 · **P2** · `/:ns/:proj/edit` (row 98) — Badges and Export are thinner

Badges and Advanced now render (round 5's finding is closed), but 7 fragments are
still absent: `What are badges?`, `Supported variables: %{project_path}…`,
`This project has no badges`, `Rename project`, and the Export-project list
(`The following items will be exported:`, `Project and wiki repositories`,
`Project uploads`, `LFS objects`). `Transfer project`, `Archive project`,
`Delete project`, `Additional options`, `Users can request access` are present.

### DIFF-106 · **P2** · no client-side validation messages on the user-settings forms

Submitting `/-/profile/keys`, `/-/profile/emails` or
`/-/profile/personal_access_tokens` with the required field empty is a silent
no-op; the source renders `This field is required.` The handler itself is right
(`ProfileKeys.jsx:272` early-returns on a blank key, and filling the form does add
the key — list `0` → `1`).

### DIFF-707 · **P2** · `reset` does not dislodge a warm browser context

See §6. Fresh contexts are unaffected.

### Carried forward from round 5, re-confirmed this round

- **DIFF-002 (P2)** issue detail still lacks the Designs / Tasks / Linked-items
  blocks (visible in `reference/issue-a11y-719.png`, absent in
  `r7_mock_issue719_1280_OVERLAP.png`). No anchor touches them.
- **DIFF-006 (P2)** the three anchor label-filter routes
  (`ffmpeg-python?label_name[]=question`, `keycloak?label_name[]=flaky-test`,
  `openapi-generator?label_name[]=OpenAPI Generator CLI`) still render **0 rows**
  where the source is populated. Seed sampling, `url_match`-only tasks; the filter
  machinery is proven on five other labels (§3.2).
- **DIFF-007 (P2)** doc drift — mostly fixed in round 6, but **two stale lines
  remain in `ROUTES.md`'s "Rows that are `[x]` and correct but materially thinner"
  block**: it still says row 116 `/-/snippets/new` "is `[ ]` and points at
  `<Placeholder>`" (the component no longer exists and the row renders
  `NewSnippet`), and it still describes row 98 as carrying "~25 of the source's
  ~130 structural copy lines / Missing: Badges, Advanced" (both now render).
  Doc-only.
- **DIFF-008 (P2)** default project-list order is `name_asc`; still not
  adjudicable without resetting byteblaze's persisted `projects_sort`. No
  evaluator asserts it.
- **DIFF-009 (P2)** `#notes-list` timeline thinner than the source. Unchanged.

### DIFF-001 — **closed** (§2.1)


---

## 9 · Verdict against the Definition of Done

| # | Criterion | Verdict |
|---|---|---|
| 1 | Every `ROUTES.md` row verified (cold load + params + sid) | **PASS** |
| 2 | All P0 and P1 `TODO.md` items `[x]` | **PASS** (markers accurate; spot-checked in §2.4) |
| 3 | `AUDIT.md` zero P0 | **PASS** as written — but see the note below |
| 4 | `TEST.md` zero P0, zero P1 functional, zero P0/P1 source-vs-mock differences | **FAIL** — one P0 and one P1 functional bug, both new this round |
| 5 | `SCHEMA.md` current | **PASS** |
| 6 | `npm run build` passes | **PASS** |

**1 — PASS.** 132 rows over 149 probe URLs, cold, fresh context, per-row `?sid=`:
143/143 non-`SKIP` probes render a real view, 6 declared not migrated. **0 false
completions, 0 `<Placeholder>`, 0 sid losses, 0 console errors, 0 pageerrors.** Plus
26 trailing-slash / URL-encoded probes clean, params shown to drive the row set,
and 145 anchor-route loads clean. The `has not been implemented yet` sentence
appears nowhere in `src/` except one `//` comment, and nowhere in `dist/`.

**2 — PASS.** Every `[x]` I spot-checked genuinely works, including all 11 rows
round 6 implemented and the five markers it corrected. The two left open (blob
syntax highlighting, the `data_model.md §14` checklist) are correctly open.

**3 — PASS as written**, with one honest qualification: `AUDIT.md` is a static
read of the tree and carries no P0. BUG-701/702 are runtime-and-viewport defects
that no static audit would have surfaced.

**4 — FAIL.** Zero P0/P1 *source-vs-mock differences* (DIFF-001 is closed and
verified in both directions against the container's own predicate; everything else
in §8 is P2). The blockers are functional:

- **BUG-701 (P0 — see the viewport caveat in §7)** — at **1280×720** the fixed
  `aside.nav-sidebar` intercepts pointer events on every `/-/profile*` primary
  submit button. `Update profile settings` is un-clickable, so **webarena-418…422
  and 448…452 (10 tasks) cannot be completed**, and anchor locators 5
  (`.cover-status`) and 8 (`.profile-header [itemprop="url"]`) return nothing.
  Driven end to end at both widths: ABSENT at 1280, `💬Cruising` / `egg.tart.com`
  at 1920. `r7_mock_profile_1280_OVERLAP.png` shows every field **label** in the
  form's left column hidden behind the nav.
- **BUG-702 (P1)** — on issue and MR detail the fixed `.right-sidebar` overlays
  the content column below ~1900 px (257 px of overlap at 1280), swallowing
  `Reopen/Close issue`, `Issue actions`, `Edit title and description`, Activity
  `Sort or filter` and the MR `Code` dropdown, and visually truncating the issue
  body mid-sentence. **The source does not do this at any width** — measured
  content-vs-sidebar geometry on both sides at 1920 / 1600 / 1280.

**5 — PASS.** `/go` returned the state keys `SCHEMA.md` documents, including
round 6's `ui.projectSettings` path and the per-record `added/removed/changed`
shape, and the creation diff matches the Observable State Changes table.

**6 — PASS.** `vite v5.4.21 … ✓ 165 modules transformed … ✓ built in 3.06s`, and
the built bundle was **browsed in a real browser under `npm run preview`** on four
routes with 0 console errors, because a green build has white-screened this app
before.

---

## VERDICT

**NOT PASS.**

Blocked by two viewport-dependent layout defects, both found by driving real
clicks at **1280×720**, a viewport no previous round tested (rounds 1–6 all ran
at 1600 or 1920). Thresholds and the honest caveat on which viewport the harness
actually uses are in §7:

1. **BUG-701 (P0)** — content column on `/-/profile*` never reserves the 220 px
   fixed nav. 10 scored tasks and 2 anchor locators go dark. Likely one CSS rule;
   the mock's *project* layout already does this correctly (`.content-wrapper`
   starts at `x = 256` there and at `x = 0` here).
2. **BUG-702 (P1)** — issuable content column never reserves the fixed right
   sidebar.

Everything else this gating round was asked to confirm **holds**:
DIFF-001 is genuinely closed and independently re-derived from GitLab's own
`ProjectsHelper` predicate against the live container (19/19, including the 8
projects round 6's "only 2" framing would have got wrong); `<Placeholder>` is gone
from `src/` and `dist/`; all 11 previously-unimplemented rows render real views;
the stale-marker sweep is accurate; `merged_at` orderings now genuinely order and
`closed_at` ones degrade without error; route parity is complete with zero console
errors; the anchor contract holds (145/145 routes, 243/243 string pairs with zero
mock-side gaps, 23/23 applicable locators); 20 of 22 replayed flows complete end to
end at 1280×720 — the 2 that don't are BUG-701; session isolation, reset, injected
state and the UTF-8 chunk-boundary round-trip all pass; the build passes and the
built bundle browses clean.

**Fix BUG-701 and BUG-702 and this is a PASS.**

---

## Appendix · What this round did NOT cover

- **Viewport matrix, exactly:** §2 banners and §3.1 route sweep at 1600×1000;
  §3.2 encoded probes at 1500×950; §4 anchors and locators at 1920×1080; **§5 task
  replay at 1280×720**; §7 at 1280 / 1366 / 1440 / 1536 / 1600 / 1728 / 1920. The
  route sweep and the anchor sweep were **not** repeated at 1280 — a repeat there
  would likely surface more instances of BUG-701/702's class on pages I did not
  hit-test. Below 1280 was not tested at all.
- **The source could not be driven while logged in** (that needs a `POST` to
  `/users/sign_in`, which the read-only rule forbids), so all authenticated
  source facts come from the 181 logged-in captures in `assets/html/`, the
  reference screenshots, and read-only `gitlab-rails runner` queries. The
  `/-/profile*` layout could therefore not be compared to the source directly; the
  BUG-701 finding rests on the mock's own inconsistency (project layout offsets the
  nav, settings layout does not) plus the screenshot.
- **Not replayed:** issue close/reopen, MR merge, drag-and-drop on `/-/boards`,
  `/projects/new#import_project`, the Web IDE commit path, cross-scope search.
- **`/-/settings/integrations/:slug/edit`** (37 slugs) remains declared
  not-migrated in `ROUTES.md`; a click from row 102 reaches `NotFound`. Not counted
  against parity because it is declared, but it *is* a reachable dead link.
- **The WebArena evaluation harness is not installed here.** The
  `func:gitlab_get_project_memeber_role` body was reconstructed from
  `evaluation_harness/helper_functions.py`; the checkable fact is that the mock's
  DOM answers the same query with the same value.
- **The source was never mutated** — no login, no POST, no form submit, and no
  `?sort=` URL on port 8023. `docker exec` was used for reads only.
