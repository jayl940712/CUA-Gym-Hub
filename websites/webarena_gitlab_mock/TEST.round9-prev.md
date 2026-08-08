# webarena_gitlab_mock — Test Report

> Round: **9** (gating round — verdict round)
> Date: 2026-08-07
> Mock: http://localhost:5281 (`npm run dev -- --port 5281`)
> Source: http://localhost:8023 — **reachable: YES**
> Tested by: playwright agent (sole agent this round)
> Supersedes: round 7, preserved verbatim at `TEST.round7-prev.md`
> Toolchain: real chromium via `/tmp/pwvenv/bin/python` +
> `LD_LIBRARY_PATH=/tmp/sysroot/...`. Every route result below was produced in a
> real browser. `curl` was used only for HTTP status probes and for the mock's
> `/post` / `/go` JSON endpoints, which have no DOM.

**Source read-only discipline held.** No POST, no login, no form submit and **no
`?sort=` URL** was issued against port 8023. Source-side facts come from
unauthenticated `GET`s driven in a browser, from the captures already in
`assets/html/`, and from reading (never clicking) the source's own dropdown
`href`s.

**What is re-verified THIS round** is everything in §1–§9. Nothing is carried
forward on round 7's or round 8's word; where a figure is reused it is labelled
**[carried]** and says why.

---

## 1 · Summary

| Metric | Result |
|---|---|
| ROUTES.md rows cold-loaded this round | **132 / 132** (146 probe URLs incl. multi-path rows) |
| …rendering the correct view | **146 / 146** |
| Console errors on cold load | **0 / 146** |
| Uncaught pageerrors on cold load | **0 / 146** |
| `?sid=` preserved after load | **146 / 146** |
| `?sid=` preserved after an in-app nav click | **146 / 146** |
| Horizontal overflow at 1280×720 | **0 / 146** |
| `<Placeholder>` / "has not been implemented yet" | **0 / 146** |
| Anchor routes resolving | **145 / 145** (68 render the 404 page — all are entities a task creates) |
| Page-bound anchor strings | **243 pairs · 0 mock-side gaps** (the 238 absent are post-conditions of mutating tasks — triaged one by one in §5.2) |
| `program_html` locators | **54 distinct (page, locator) pairs · 0 mock-side gaps** (§5.3) |
| BUG-701 (`/-/profile*` submit swallowed) | ✅ **FIXED** — verified at 1920 / 1600 / **1280** |
| BUG-702 (issuable right-sidebar overlay) | ✅ **FIXED** — mock geometry is **byte-identical to the source** at all three widths |
| webarena-418…422 + 448…452 at **1280×720** | **10 / 10 PASS** under the real evaluator expression |
| Tasks replayed / completable end to end at 1280×720 | **30 / 30** |
| BUG-004 UTF-8 `/post` round-trip | **24 / 24 chunk-boundary offsets PASS** |
| BUG-B01 case-insensitive project path | ✅ closed |
| BUG-001 members-table evaluator selector | ✅ closed — **agrees with the live source value-for-value** |
| BUG-A01 `?sid=` on sort controls | ✅ closed — 6 / 6 controls keep sid *and* write back to the URL |
| DIFF-001 banner gating | ✅ still closed in both directions |
| Session isolation / reset / injected state | **PASS** |
| Interactive elements hit-tested at 1280×720 (independent hunt) | **4 661 · 0 blocked · 0 clipped · 0 overflow** |
| **P0 bugs** | **0** |
| **P1 functional bugs** | **0** |
| **P0/P1 source-vs-mock differences** | **2** — DIFF-901, DIFF-902 (both with zero measured task impact; §8) |
| P2 findings | 6 (DIFF-903…908) |
| `npm run build` | ✅ `built in 2.98s` |
| **Gate** | **criterion 4 FAILS**; 1, 2, 3, 5, 6 PASS — see §10 |

---

## 2 · BUG-701 and BUG-702 — independently re-driven at three viewports

Round 8 reported measurements. I did not take them on trust; every number below
is from `document.querySelector(...).getBoundingClientRect()` in a live browser
this round, on the **mock** and (for the issuable pages, which are public) on the
**source**.

### 2.1 Geometry — issue and merge-request detail

`#content-body` vs `aside.nav-sidebar` vs `aside.right-sidebar`, plus
`documentElement.scrollWidth − clientWidth`:

| width | side | content x–right | left nav | right sidebar | gap | overflow-x |
|---|---|---|---|---|---|---|
| 1920 | **SOURCE** | 464 – 1422 | 0 – 256 | 1630 – 1920 | 208 | 0 |
| 1920 | **MOCK** | 464 – 1422 | 0 – 256 | 1630 – 1920 | 208 | 0 |
| 1600 | **SOURCE** | 304 – 1262 | 0 – 256 | 1310 – 1600 | 48 | 0 |
| 1600 | **MOCK** | 304 – 1262 | 0 – 256 | 1310 – 1600 | 48 | 0 |
| 1280 | **SOURCE** | 272 – 974 | 0 – 256 | 990 – 1280 | 16 | 0 |
| 1280 | **MOCK** | 272 – 974 | 0 – 256 | 990 – 1280 | 16 | 0 |

**Exact agreement at every width, on both `/-/issues/71` and
`/-/merge_requests/40`.** The mock now carries the source's own
`layout-page … page-gutter right-sidebar-expanded page-with-contextual-sidebar`
class set, which is why the numbers coincide rather than merely approximate.
Round 7's measured overlaps (97 px at 1600, 257 px at 1280) are gone.

### 2.2 Geometry — user settings (`/-/profile*`)

The source's settings pages need a login, so they cannot be measured live under
the read-only rule. What *can* be checked is that the mock reproduces the shell
the source capture shows (`assets/html/profile-preferences.html`:
`aside[aria-label="User settings"]` as a sibling of `.content-wrapper`, inside
`page-with-contextual-sidebar`, container `limit-container-width` = 990 px) and
that the arithmetic that shell implies is what the mock actually renders:

| width | `#content-body` x–right (width) | `aside[aria-label]` | overflow-x |
|---|---|---|---|
| 1920 | 609 – 1567 (958) | `User settings` 0 – 256 | 0 |
| 1600 | 449 – 1407 (958) | `User settings` 0 – 256 | 0 |
| 1280 | 289 – 1247 (958) | `User settings` 0 – 256 | 0 |

958 = 990 − 2×16 padding at every width, and 609 = 256 + (1664−990)/2 + 16 —
i.e. a 990 px limited container centred inside the 256 px-offset wrapper, which
is what the source markup produces. **No overlap with the nav at any width.**
Round 7's `x = 16` at 1280 and `x = 176` at 1600 are gone, and the aside now
carries `aria-label="User settings"` as the source does.

### 2.3 Hit tests — not visibility checks, `document.elementFromPoint` at the control's centre

At **1280×720**, every control round 7 reported as swallowed:

| page | control | result |
|---|---|---|
| `/-/profile` | `Update profile settings` | **HIT** |
| `/-/profile` | status emoji picker | **HIT** |
| `/-/profile` | `Remove status` | **HIT** |
| `/-/profile` | status message field | **HIT** |
| `/-/profile/keys` | `Add key` | **HIT** |
| `/-/profile/emails` | `Add email address` | **HIT** |
| `/-/profile/preferences` | `Save changes` | **HIT** |
| `…/-/issues/71` | `Close issue` / `Reopen issue` | **HIT** |
| `…/-/issues/71` | `Issue actions` (⋮) | **HIT** |
| `…/-/issues/71` | `Edit title and description` (pencil) | **HIT** |
| `…/-/issues/71` | Activity `Sort or filter` | **HIT** |
| `…/-/issues/71` | sidebar `[data-testid="edit-button"]` | **HIT** |
| `…/-/issues/71` | comment box | **HIT** |
| `…/-/merge_requests/40` | `Code` clone dropdown | **HIT** |
| `…/-/merge_requests/40` | `.js-issuable-edit` | **HIT** |
| `…/-/merge_requests/40` | sidebar `[data-testid="edit-button"]` | **HIT** |

**16 / 16 HIT at 1280×720**, and the same set is HIT at 1600 and 1920.
Zero console errors during the sweep.

### 2.4 Issue body is not truncated

`/byteblaze/a11y-webring.club/-/issues/71` at 1280×720,
`.detail-page-description .description`: `clientHeight 239 == scrollHeight 239`,
`clientWidth 702 == scrollWidth 702`, `overflow: visible`. The rendered text ends
on the complete final line
`…[X] I agree to follow this project's code of conduct` — no mid-sentence cut.

### 2.5 Acceptance test — webarena-418…422 and 448…452 driven end to end at 1280×720

Each task was driven in its **own fresh sid, reset first**, starting from `/`,
with real clicks (no `evaluate`, no direct state POST), then **reloaded**, then
scored with the evaluator's own expression and WebArena's `clean_answer`
(strip + lowercase):

| task | typed into the form | `document.querySelector('.cover-status').lastChild.textContent` | verdict |
|---|---|---|---|
| webarena-418 | `Cruising` | `'Cruising'` | ✅ exact_match |
| webarena-419 | `Enjoying life` | `'Enjoying life'` | ✅ |
| webarena-420 | `Playing Badminton` | `'Playing Badminton'` | ✅ |
| webarena-421 | `Resting due to leg injury` | `'Resting due to leg injury'` | ✅ |
| webarena-422 | `Out of Office` | `'Out of Office'` | ✅ |

| task | typed into the form | `document.querySelector('.profile-header [itemprop="url"]').outerText` | verdict |
|---|---|---|---|
| webarena-448 | `https://egg.tart.com` | `'egg.tart.com'` | ✅ exact_match |
| webarena-449 | `helloworld.xyz` | `'helloworld.xyz'` | ✅ |
| webarena-450 | `https://a11yproject.contributor.me` | `'a11yproject.contributor.me'` | ✅ |
| webarena-451 | `www.byteblaze.com` | `'www.byteblaze.com'` | ✅ |
| webarena-452 | `https://byteblaze.github.io` | `'byteblaze.github.io'` | ✅ |

**10 / 10 PASS at 1280×720, 0 console errors.** Note the URL cases are the
sharper test: the agent types the full `https://…` and the evaluator requires the
scheme-stripped form, which is what GitLab renders — the mock strips it too.
Both mutations survive a reload and coexist (setting the URL did not clear the
status).

**BUG-701 → CLOSED. BUG-702 → CLOSED.**

---

## 3 · Route parity — every ROUTES.md row, cold, this round

146 probe URLs covering all 132 rows (multi-path rows expanded; rows 24, 34, 68,
77, 85 are declared not-migrated in `ROUTES.md` and are not probed). Each probe
used a **fresh browser context and a fresh `?sid=`**, went straight to the deep
link with no click-through, and was checked for: correct view, console errors,
uncaught pageerrors, `sid` on the URL after load, `sid` after clicking the first
visible in-app link, horizontal overflow at 1280×720, and the placeholder string.

**Result: 146 / 146 clean.**

- cold-load failures: **0**
- console errors: **0**
- uncaught pageerrors: **0**
- `sid` dropped on load: **0**
- `sid` dropped after an in-app navigation: **0**
- horizontal overflow: **0**
- placeholder text: **0**

Two probes tripped my *expectation string* and were run down by hand; both pages
are correct and the expectation was mine, not the mock's:

| row | path | what I expected | what renders | verdict |
|---|---|---|---|---|
| 17 | `/explore/projects/starred` | `Most starred` | tab reads **`Most stars`** | mock is right — `Most stars` is GitLab's label |
| 98 | `/:ns/:proj/edit` | `General` | General settings page (`Naming, topics, avatar`, `Project name`, `Project ID`, …), `<title>` = `General · Settings · …` | page correct; **breadcrumb tail differs** → DIFF-901, P2 |

Dynamic rows were resolved from the seed at run time rather than guessed:
row 89 → `/byteblaze/a11y-webring.club/-/labels/1811/edit`, row 52 →
`/byteblaze/dotfiles/-/commit/218b5e72424aca8b580e52342dbb92bd4bd076c8`.
Row 92/93 (milestone detail/edit) had no `/-/milestones/:iid` link on
`a11y-webring.club` to harvest and were replayed separately in §7.

---

## 4 · The four closed P0s — re-verified

### 4.1 BUG-004 · multi-byte UTF-8 through `/post` — ✅ closed

24 payloads, each padding `🐞 Ünïcödé — 日本語 «test»` to a different offset
around the 65536-byte chunk boundary (65496…65520), POSTed to `/post?sid=` and
read back through `/go?sid=`. **24 / 24 exact round-trips, 0 mojibake, 0
replacement characters.**

### 4.2 BUG-B01 · case-insensitive project path — ✅ closed

| probe | result |
|---|---|
| `/ByteBlaze/dotfiles` | renders the project |
| `/byteblaze/DotFiles` | renders the project |
| `/byteblaze/a11y-WebRing.Club` | renders the project |
| `/byteblaze/a11y-webring.club/-/issues/71` | renders |
| `/byteblaze/ChatGPT` | **404 — correct**; that project does not exist until webarena-396 forks `convexegg/chatgpt` into it (§7) |

### 4.3 BUG-001 · members table — ✅ closed, and confirmed against the live source

I ran the evaluator's own row-lookup against the mock:

```js
document.querySelectorAll("td[data-label='Account'] span.gl-avatar-labeled-sublabel")
// → index of '@<username>', then that index into
document.querySelectorAll("td.col-max-role")
```

| project | mock | **live source** (plain GET, public project) |
|---|---|---|
| `a11yproject/a11yproject.com` | `@byteblaze → Maintainer`, `@Roshanjossey → Developer`, `@a11yproject → Owner` | `['Maintainer', 'Developer', 'Owner']` — **identical** |
| `byteblaze/a11y-webring.club` | `@byteblaze → Owner` | `['Owner']` — **identical** |

Seven more project member tables answer the query with a real role
(`gimmiethat.space` → `@yjlou` Developer, `solarized-prism-theme` →
`@abisubramanya27` Guest, etc.), account count == role-cell count everywhere.

> **Correction to my own first pass, recorded so it is not re-found.** I first ran
> the lookup with `document.querySelectorAll("td.role")` and got 0 cells, which
> looked like a P0 regression. It is not: `td.role` selects nothing on the **live
> source either** (the role column's class is `col-max-role`; `role="cell"` is an
> attribute, not a class). The mock's column classes are copied from the source
> capture and match it exactly.

### 4.4 BUG-A01 · `?sid=` on sort controls — ✅ closed, and they write back to the URL

Every control was opened and a different option clicked, then the resulting URL
was **cold-reloaded** to confirm the choice sticks:

| page | control | resulting URL | sid kept | sticks on reload |
|---|---|---|---|---|
| `/dashboard/projects` | `Name` → `Updated date` | `?sort=latest_activity_desc&sid=…` | ✅ | ✅ |
| `/explore/projects` | `Name` → `Updated date` | `?sort=latest_activity_desc&sid=…` | ✅ | ✅ |
| `/dashboard/issues` | `Created date` → `Priority` | `?sid=…&sort=priority_desc` | ✅ | ✅ |
| `/dashboard/merge_requests` | `Created date` → `Priority` | `?sid=…&sort=priority` | ✅ | ✅ |
| `/:ns/:proj/-/issues` | `Created date` → `Priority` | `?sid=…&sort=priority_desc` | ✅ | ✅ |
| `/:ns/:proj/-/merge_requests` | `Created date` → `Priority` | `?sid=…&sort=priority` | ✅ | ✅ |
| `/:ns/:proj/-/issues` | `Show 20 items` → `Show 50 items` | `?sid=…&first_page_size=50` | ✅ | ✅ |

Order actually changes where the seed has a discriminating key
(`/a11yproject/a11yproject.com/-/issues` reorders under `priority_desc`); it does
not change where every record ties on the key, which is correct.

### 4.5 DIFF-001 · banner gating — ✅ still closed in both directions

- SSH "add an SSH key" banner: **19 / 19 project overviews**, matching
  `byteblaze.keys.count == 0 → require_ssh_key? == true`.
- Auto DevOps banner: exactly the 10 projects whose source-side predicate is
  true — `dotfiles`, `timeit`, `cloud-to-butt`, `solarized-prism-theme`,
  `a11y-syntax-highlighting`, `millennials-to-snake-people`,
  `accessible-html-content-patterns`, `ericwbailey.website`, `gimmiethat.space`,
  `remove-board-movement-events-from-the-github-issue-timeline`. Absent from
  `empathy-prompts`, `a11y-webring.club`, `a11yproject.com` (explicit
  `project_auto_devops` row), from `primer/design`, `root/metaseq`,
  `vinta/awesome-python`, `CellularPrivacy/…`, `convexegg/chatgpt` (byteblaze is
  not Maintainer+), and from `aklsh/dots` (has `.gitlab-ci.yml`). **[carried
  predicate]** — the Ruby predicate itself was recomputed read-only against the
  container in round 7; this round re-verified the mock side only.
- **Leakage: 0.** Ten non-overview pages (`/-/issues`, `/-/tree/main`,
  `/-/merge_requests`, `/-/labels`, `/activity`, `/-/project_members`,
  `/dashboard/projects`, `/explore`, `/byteblaze`, `/-/profile`) show neither
  banner.

---

## 5 · Anchor contract

### 5.1 Anchor routes — 145 / 145 resolve

All 145 loaded in a browser against a **pristine, freshly reset sid**: 0 load
failures, 0 console errors, 0 pageerrors, 0 `sid` losses. **68** render the 404
page; every one of them is an entity a task is supposed to *create*
(`/byteblaze/AGISite`, `/byteblaze/web_arena`, `/byteblaze/11711_gitlab`,
`/a11yproject/a11yproject.com/-/merge_requests/1485`, …). None is an unexpected
404.

### 5.2 Anchor strings — 243 page-bound pairs, 0 mock-side gaps

238 of the 243 are absent from the pristine seed. I triaged **every one** rather
than assuming:

- **168** are bound to a page that legitimately 404s (a project the task
  creates). Not gaps.
- **70** are bound to a page that renders. I joined each to its task's
  `question`: **all 70 are post-conditions of a mutating task** — post a comment
  (390–393, 415, 416, 389), set profile status (418–422), set homepage URL
  (448–452), add a member (480–485, 567–579), follow a user (533–537), star a
  repo (523, 524), fork (395, 522), change a LICENSE (411–414, 736), edit
  `index.html`'s `<title>` (441–445), assign an issue (446, 447, 804, 810, 811).
  Correctly absent before the task runs; §7 confirms they appear after.
- **0** strings that the seed should already carry are missing.

### 5.3 `program_html` locators — 54 distinct (page, locator) pairs

Evaluated with `eval()` exactly as the harness does. 3 resolve on the pristine
seed (`[data-qa-selector="projects_list"]`, `.user-profile` on
`/users/byteblaze/following`, `#notes-list` on MR 1265 which already has notes).
The other 51 are the post-condition locators for the same mutating tasks, and
they are exercised **after** the mutation in §7. Notably:

- `func:gitlab_get_project_memeber_role` (12 pairs) — §4.3, resolves to the
  live-source value.
- `.cover-status` / `.profile-header [itemprop="url"]` (10 tasks) — §2.5,
  10 / 10 PASS.
- `.visibility-icon` `title` and `.home-panel-description-markdown` (14 pairs) —
  §7 project-creation replays.
- `#notes-list` `lastElementChild` (7 pairs) — §7 comment replays.

**0 locators fail for a mock-side reason.**

---

## 6 · Session isolation, reset, injected state

| check | result |
|---|---|
| Mutate sid `A` (star `byteblaze/dotfiles` by clicking `Star`) | `/go?sid=A` `state_diff` → `{projects, stars}` |
| sid `B`, untouched | `state_diff` empty — **isolated** |
| `{"action":"reset"}` on `A` | `state_diff` empty again — **restored** |
| Inject custom state (rename `byteblaze` via `/post` `set`) | `/byteblaze` renders `R9 Injected Name` — **honoured on first load** |
| UTF-8 through `/post` | §4.1, 24/24 |

---

## 7 · Task replays — 30 tasks driven end to end at 1280×720

Every replay below: **own fresh `sid`, reset first**, started from the task's own
start URL, driven with **real clicks only** (no `evaluate`, no direct state POST),
then **reloaded**, then scored with the evaluator taken **verbatim from
`/webarena/webarena.jsonl`** — `program_html` locators run through `eval()`, and
`exact_match` / `must_include` applied with WebArena's own `clean_answer`
(strip + lowercase) and `ref.lower() in pred.lower()` semantics.

### 7.1 Profile mutations — 10 / 10 PASS

See §2.5: webarena-418…422 (`.cover-status`) and 448…452
(`.profile-header [itemprop="url"]`).

### 7.2 Creation flows — 10 / 10 PASS

| task | flow driven | evaluator | verdict |
|---|---|---|---|
| webarena-752 | `/` → New project → Create blank project → name `web_agent`, Private → Create | `.visibility-icon` title ⊃ `Private`; `/-/commits` ⊃ `Initial commit` | ✅ |
| webarena-753 | `/projects/new` → Create from template → `label[data-testid="use_template_android"]` → Private → Create | `…title ⊃ Private`; commits ⊃ `Initialized from 'Android' project template` | ✅ |
| webarena-756 | same, Jekyll template, name `11711_gitlab` | `…title ⊃ Private`; `.home-panel-description-markdown` ⊃ `Example Jekyll site using GitLab Pages: https://pages.gitlab.io/jekyll` | ✅ |
| webarena-744 | blank project `AutoAGI`, **Public** → Invite members → `primer` | `…title ⊃ public`; members page ⊃ `@primer` | ✅ |
| webarena-742 | blank project `planner`, Private → invite `abisubramanya27`, `vinta` | `…title ⊃ private`; members ⊃ both `@`s | ✅ |
| webarena-803 | `/groups/new` → `webagent` → group members → invite `pandey2000`, `sayakpaul` | `/groups/webagent/-/group_members` ⊃ both | ✅ |
| webarena-808 | `/byteblaze/cloud-to-butt/-/issues` → New issue → title + assignee + due date → Create | `[data-qa-selector="title_content"]` exact `Let's keep the project alive`; `[data-testid="sidebar-due-date"]` ⊃ `Mar 31, 2033`; `.block.assignee` ⊃ `Byte Blaze`; `url_match` | ✅ |
| webarena-806 | `/-/merge_requests` → New merge request → source `redesign` → target `feature/markdown-figure-block` → Compare and continue → Reviewer picker → `Byte Blaze` → Create | `.detail-page-description > a.gl-font-monospace[0]` exact `redesign`; `[1]` exact `feature/markdown-figure-block`; `.block.reviewer` ⊃ `Byte Blaze`; `url_match` | ✅ |
| ROUTES 91/92/93 | `/-/milestones/new` → create → list → detail → edit | milestone appears, detail renders, `.block.due_date` present, edit form loads | ✅ |
| ROUTES 88 | `/-/labels/new` → create → list | label appears | ✅ |

Notable: the slug auto-derivation is right (`web_agent`, `AutoAGI`, `webagent`),
the created project lands the user on `/byteblaze/<slug>`, group creation lands on
`/<group>` as GitLab does, and the new-MR form carries the source's own
`.merge-request-reviewer` / `button.js-reviewer-search` picker so the reviewer can
be set **before** submit.

### 7.3 Mutation flows on seeded records — 10 / 10 PASS

| task | flow driven | evaluator | verdict |
|---|---|---|---|
| webarena-481 | dotfiles members → Invite members → `abisubramanya27`, role **Guest** | `func:gitlab_get_project_memeber_role` → `Guest` | ✅ |
| webarena-576 | a11y-webring.club members → invite `abisubramanya27` + `lahwaacz`, role **Developer** | helper → `Developer` for both | ✅ |
| webarena-396 | `/convexegg/chatgpt` → Fork → namespace `byteblaze` → Fork project | `/byteblaze/ChatGPT` ⊃ `ChatGPT` (case-insensitive `must_include`) | ✅ |
| webarena-390 | MR 1531 → comment `lgtm` | `#notes-list` lastElementChild `.timeline-discussion-body` exact `lgtm` | ✅ |
| webarena-391 | MR 1265 → comment `close because non reproducible` | same locator, exact | ✅ |
| webarena-415 | MR 40 → comment `@davepgreene` | same locator, exact | ✅ |
| webarena-533 | `/convexegg` → Follow, `/yjlou` → Follow (button flips to `Unfollow`) | `.user-profile` ⊃ `@convexegg`, `@yjlou` | ✅ |
| webarena-523 | `/explore/projects/starred` → open the top 5 → Star each (flips to `Unstar`) | `/users/byteblaze/starred` ⊃ all five names | ✅ |
| webarena-811 | search the 404 issue → open → sidebar `assign yourself` | `/dashboard/issues?…assignee_username=byteblaze` ⊃ the issue title | ✅ |
| webarena-441 | `/-/blob/main/index.html` → Edit → rewrite `<title>` → Commit changes | `/-/raw/main/index.html` ⊃ `<title>GIVE ME SPACE</title>` | ✅ |

### 7.4 `/go` reports creations, not edits

For webarena-752 the diff after creating `web_agent` was

```
state_diff keys = projects, members,
                  repo.fileOverlay.byteblaze/web_agent:main:README.md,
                  repo.treeOverlay.byteblaze/web_agent:main,
                  repo.commitOverlay.byteblaze/web_agent:main,
                  repo.branchOverlay.byteblaze/web_agent
projects: 175 → 176      ← a NEW record, not a mutated seed row
```

Same shape for the other creations. Starring reports `{projects, stars}`.

### 7.5 Corrections to my own reconstruction — recorded so they are not re-found

Three "failures" in my first pass were **my** locator reconstructions, not mock
defects. In each case I went to `/webarena/webarena.jsonl` and re-ran against the
verbatim evaluator:

| I first used | ground truth in `webarena.jsonl` | effect |
|---|---|---|
| `td.role` | `td.col-max-role` | `td.role` selects nothing on the **source** either |
| `.note-text` on the last note | `.timeline-discussion-body` | mock renders the latter; comment tasks pass |
| `exact_match` on `.visibility-icon` title | `must_include ["Private"]` | GitLab's full tooltip contains it; mock matches |

**Every locator quoted in this report is now the verbatim `webarena.jsonl`
string.**

---

## 8 · Source-vs-mock differences

Method: matched pairs at 1920×1080 into `assets/screenshots/diff/`
(`mock_*.png` / `source_*.png` for 8 paths; `/-/profile*` is mock-only because the
source's settings pages need a login), read side by side, plus behavioural
comparison (same interaction, compare the outcome) and a **structural** copy diff
(labels, headings, buttons, tab names, column names — not record values).

**Read the source captures with one caveat in mind:** the source side is
**anonymous** (the read-only rule forbids logging in on 8023). So every
authenticated affordance the mock shows and the source does not —
`Close issue`, `Comment`, `Edit`, `Add a to do`, `Move issue`, sidebar `Edit`
links, the `Add CHANGELOG` / `Add CONTRIBUTING` / `Web IDE` quick actions — is the
mock being **correct**, not divergent, and is not listed below.

### DIFF-901 · **P1** · An MR's Commits tab lists the *project's* commits, not the MR's

| Field | Value |
|---|---|
| Path | `/:ns/:proj/-/merge_requests/:iid` and `…/commits` |
| Source | MR `!40` → tab reads **`Commits 4`**, page lists **4** commits, first = `Merge branch 'main' into add-verification-function`. MR `!1265` → **`Commits 1`**, first = `Ensure catd text color persists when browser loses…` |
| Mock | Both MRs → tab reads **`Commits 40`**, page lists **40** commits, first = `Add Tiffany Pender (#96)` — i.e. the head of `byteblaze/a11y-webring.club`'s own history, identical on every MR of the project |
| Also | the source's `Pipelines 1` and `Changes 7` tab badges have no counterpart in the mock (no badge at all) |
| Impact | **Zero scored tasks.** I grepped all 204 GitLab tasks: 49 mention commits/diffs and every one of them reads `/-/commits/:ref`, `/-/graphs/:ref/charts` or a contributor list — none opens an MR's Commits or Changes tab. Rated P1 purely because it is the wrong record set in a list view, confirmed against the source in both directions. |
| Fix hint | filter `commits.json` to the MR's own range (source→target) instead of returning the project head; derive the three tab badges from that filtered set, the diff set, and the pipeline set. |

### DIFF-902 · **P1** · Repository file-tree ordering is case-insensitive; the source orders by ASCII

| Field | Value |
|---|---|
| Path | `/:ns/:proj` and `/:ns/:proj/-/tree/:ref` |
| Source | directories first, then files in **ASCII byte order** — dot-files, then uppercase, then lowercase. `primer/design`: `… .nvmrc, CODE_OF_CONDUCT.md, CONTRIBUTING.md, LICENSE, README.md, babel-defines.js, …` |
| Mock | directories first, then files **case-insensitively**: `… .nvmrc, babel-defines.js, CODE_OF_CONDUCT.md, CONTRIBUTING.md, gatsby-config.js, …` |
| Scope | reproduced on **3 / 3** projects checked live against the source (`byteblaze/dotfiles`, `a11yproject/a11yproject.com`, `primer/design`). **Same set of entries every time** — only the order differs. Directory ordering is correct. |
| Impact | **Zero scored tasks** — every file-touching task (411–414, 441–445, 736, 556–566) addresses a file by name, never by position. Rated P1 because the rubric prices sort semantics that differ from the source at P1. |
| Fix hint | the tree comparator should be a plain `<` on the raw name (ASCII), not `localeCompare` / `toLowerCase()`. |

### DIFF-903 · **P2** · A phantom `"data` directory in `byteblaze/a11y-webring.club`'s tree

The mock's tree has **both** `"data` (leading double-quote) and `data`; the source
has only `data`. The phantom entry is not a dead link — it navigates to
`/-/tree/main/%22data` and renders a tree containing `members` — but it is an
entity that does not exist on the source. Looks like a quoted path that survived
seed extraction. Only project affected of the 4 compared.

### DIFF-904 · **P2** · MR Changes tab renders an explanatory message instead of diffs

`…/-/merge_requests/40/diffs` renders *"Changes between
github/fork/davepgreene/add-verification-function and main are not rendered in
this instance."* — the source renders **5** `.diff-file` blocks. The mock degrades
gracefully rather than dying, and no task reads it, so this is P2 — but
**`ROUTES.md` row 81 lists `diffs.json` as the data source for a "Changes tab"**,
which overstates what ships. Worth correcting in `ROUTES.md` either way.

### DIFF-905 · **P2** · Breadcrumb tail on project settings pages

| page | source breadcrumb | mock breadcrumb |
|---|---|---|
| `/:ns/:proj/edit` | `Byte Blaze / dotfiles / General Settings` | `Byte Blaze / dotfiles / Repository` |
| `/:ns/:proj/-/settings/repository` | `… / Repository Settings` | `… / Settings` |

`<title>` is correct on both (`General · Settings · …`, `Repository Settings · …`);
only the breadcrumb's last segment drifts. No anchor or locator reads
`.breadcrumbs`.

### DIFF-906 · **P2** · Issue-detail content-depth gaps (visual comparison)

Seen on `mock_issue_71.png` vs `source_issue_71.png`:

- GFM **task lists render as literal `[ ]` / `[X]` text**; the source renders real
  checkboxes, and its header carries `1 of 3 checklist items completed`, which the
  mock omits.
- The source's `Tasks 0` card, `Linked items 0` card and the
  `Drag your designs here or click to upload.` dropzone are absent from the mock.
- Author role badges (`Contributor` next to the issue author, `Owner` on a note)
  are absent from the mock.

None is referenced by any anchor string or locator.

### DIFF-907 · **P2** · Project-overview chrome

- The source's **repository-languages bar** (`.repository-languages-bar`, the
  green/purple/yellow strip under the stats row) is absent from the mock (0 vs 1).
- The stats row reads the same text on both, but the mock renders it as a stacked
  bulleted list where the source lays it out inline on one row.
- The source's commit header carries an `Unverified` signature badge; the mock's
  does not.
- The LICENSE quick-action reads `LICENSE` in the mock and `MIT License` in the
  source (GitLab labels it with the detected licence).
- `Project Storage` reads `1.6 MB` in the mock, `1.9 MB` in the source
  (unanchored value drift).
- File-type icons are generic in the mock, per-type and coloured in the source.

### DIFF-908 · **P2** · `SCHEMA.md` line 31 lists the state key as `merge_requests`

Everywhere else in `SCHEMA.md` (and in the live state and in `/go`) it is
`mergeRequests`. Documentation typo only — §5's row and the Observable-State-Changes
table both use the correct camelCase name.

### Re-verified as *not* differences

- **Sort semantics on issue and MR lists.** AUDIT's P1-2 / BUG-B02 (*"the sort
  direction toggle emits a correct URL that the list does not honour"*) is
  **closed**: `a[title="Sort direction"]` was driven from four different active
  sort keys and inverted the list every time —
  `created_date → created_asc`, `updated_desc → updated_asc`,
  `title_asc → title_desc`, `merged_at → merged_at_desc` — each with `sid`
  intact and the order actually reversed. On a discriminating dataset
  (`?state=all` issues, `?state=merged` MRs) `created`, `updated`, `closed_at`,
  `title`, `milestone_due`, `priority` and `merged_at` all produce **distinct**
  orderings. The tokens that collapse onto the base order (`popularity`,
  `due_date_desc`, `label_priority_desc`) do so because every row in the sample
  ties on that key — which is correct behaviour, not an ignored token. All 7
  project-list tokens (`latest_activity`, `created`, `name`, `stars`, both
  directions) produce distinct correct orderings.
- **`<Placeholder>` copy** (AUDIT P1-3): 0 occurrences across 146 route probes.
- **New group shows "no permissions" to its own Owner** (AUDIT P1-4): creating
  `webagent` and inviting two members through the group members page worked end
  to end.
- **System notes drop the actor** (AUDIT P1-5): `Rohan Kumar added feature label`,
  `Byte Blaze added being discussed label`, `Roshan Jossy assigned to
  @Roshanjossey` — actors present.
- **`SCHEMA.md` stale / 7 undocumented state keys** (AUDIT P1-1): all **17**
  top-level keys returned by `/go` (`currentUser, follows, groups, issues, labels,
  members, mergeRequests, milestones, nextIds, notes, projects, repo, snippets,
  stars, todos, ui, users`) and all four `repo.*` overlays
  (`fileOverlay, treeOverlay, commitOverlay, branchOverlay`, plus `forkOrigin`)
  are documented. Only DIFF-908's naming typo remains.
- **Seed size** (AUDIT P1-6): `.mock-state.initial.json` is **2.75 MB** on disk;
  the round-6 in-memory measure was 1.98 MiB. At/over the ~1–2 MB guidance in
  `WEBARENA_MIGRATION.md §4`. Budget note, P2 — nothing fails because of it.

---

## 9 · Bugs for the dev agent

### Functional bugs

**None.** No P0 and no P1 functional bug was found this round.

- BUG-701 → **CLOSED** (§2.1–2.3, 2.5)
- BUG-702 → **CLOSED** (§2.1, 2.3)
- BUG-001, BUG-004, BUG-A01, BUG-B01 → **CLOSED, re-verified** (§4)
- DIFF-001 → **CLOSED, re-verified in both directions** (§4.5)

### 9.1 · Independent hunt for the BUG-701/702 defect class — clean

This was run **without reference to round 8's sweep**. At **1280×720**, across
**80 routes** covering every creation form, every settings page, every wide list
view, the blob/edit/compare/network/graph views, the boards, the group pages and
the profile pages:

| check | result |
|---|---|
| interactive elements hit-tested with `document.elementFromPoint` at their own centre | **4 661** |
| elements covered by another element | **0** |
| elements scrolled off-viewport and unreachable | **0** |
| routes with horizontal overflow | **0 / 80** |
| elements clipped by an ancestor `overflow:hidden` (excluding deliberate ellipsis) | **0** |
| console errors / pageerrors during the whole hunt | **0** |

Then **14 overlays** were opened and their contents hit-tested: the Invite-members
modal, the issue-actions `⋮` dropdown, the Activity sort dropdown, the assignee /
labels / milestone / due-date sidebar editors, the MR `Code` dropdown, the project
`Clone` dropdown, the issues sort and page-size dropdowns, the navbar `+`
dropdown, the projects sort dropdown. Every one opened and every control inside it
was reachable. The only "blocked" elements reported were the page content the
overlay is *supposed* to be covering (the navbar under an open modal, project-row
badges under an open dropdown) — correct behaviour.

Two openers my selectors missed and then confirmed by hand:
`#clone-dropdown` is an `<a>`, not a `<button>` (matching GitLab's own markup) —
it opens and yields `git clone ssh://git@localhost:2222/<path>.git`, which is what
webarena-293…297 need, verified on all five of their projects; and the *What's
new* trigger lives inside the help dropdown, so it is correctly not visible until
that dropdown is opened.

### 9.2 · Handbacks (all P2 — none blocks a round)

| id | what | where |
|---|---|---|
| DIFF-901 | MR Commits tab lists the project's commits; three tab badges wrong/absent | §8 |
| DIFF-902 | file-tree ordering case-insensitive instead of ASCII | §8 |
| DIFF-903 | phantom `"data` directory in `a11y-webring.club` | §8 |
| DIFF-904 | MR Changes tab ships a message, but `ROUTES.md` row 81 claims `diffs.json` | §8 |
| DIFF-905 | project-settings breadcrumb tail | §8 |
| DIFF-906 | task-list checkboxes, `Tasks`/`Linked items` cards, author role badges | §8 |
| DIFF-907 | languages bar, `Unverified` badge, `MIT License` button label, stats-row layout | §8 |
| DIFF-908 | `SCHEMA.md:31` says `merge_requests`, state says `mergeRequests` | §8 |

*(DIFF-901 and DIFF-902 are rated P1 as source-vs-mock differences in §8 — both
have zero measured task impact, which is stated there.)*

---

## 10 · Gating criteria

| # | criterion | verdict | evidence |
|---|---|---|---|
| 1 | Every `ROUTES.md` row verified (cold load + params + sid) | **PASS** | §3 — 146/146 probes covering all 132 rows; 0 console errors, 0 pageerrors, 0 sid losses, 0 overflow |
| 2 | All P0 and P1 `TODO.md` items `[x]` | **PASS** | 3 items remain open and none is P0/P1: blob syntax highlighting (accepted P2), the seed-size budget note (P2), and a `[~]` process item to run `assets/data_model.md §14`'s checklist |
| 3 | `AUDIT.md` zero P0 | **PASS** | AUDIT §3; nothing found this round is a P0 |
| 4 | `TEST.md` zero P0, zero P1 functional, zero P0/P1 source-vs-mock differences | **FAIL** | zero P0 ✅, zero P1 functional ✅, but **two P1 source-vs-mock differences**: DIFF-901 and DIFF-902 |
| 5 | `SCHEMA.md` current | **PASS** | all 17 live top-level state keys and all `repo.*` overlays documented; only DIFF-908's naming typo |
| 6 | `npm run build` passes | **PASS** | `✓ 166 modules transformed · built in 2.98s`; the built bundle is the same tree the 146-route browser sweep exercised |

**Overall: the migration is one criterion short of the gate.** Criterion 4 fails on
two source-vs-mock differences, both priced P1 by the rubric's own wording (*"sort
/filter/search/pagination semantics differ from the source"* and a list rendering
the wrong record set), and **both with zero measured impact on any of the 204
GitLab tasks**. Every functional check passes: 30 tasks replayed end to end at
1280×720 under their verbatim evaluators, 4 661 interactive elements hit-tested
clean, 145/145 anchor routes, 0 anchor-string gaps, 0 locator gaps, session
isolation and `/go` correct.
