# webarena_gitlab_mock — TEST part B (ROUTES.md §6–13)

> Shard: B of 3 · Scope: ROUTES.md rows 66–131 (project issues, merge requests,
> labels, milestones, members, project settings, CI/CD + sidebar leaves, groups,
> creation entry points, help)
> Date: 2026-08-07 · Mock: http://localhost:5202 · Source: http://localhost:8023 (**reachable**, logged in as `byteblaze`)
> Tested by: playwright agent (shard B) · Browser: real chromium, 1920×1080

**STATUS: COMPLETE.**

**Verdict for this shard: NOT PASS** — 1 P0 + 4 P1. Everything else in rows
66–131 marked `[x]` loads cold, honours its query params, keeps `sid`, and
responds to every control I could reach.

---

## ⚠️ Environment warning that affects every source-order comparison

`byteblaze`'s `issues_sort` / `projects_sort` **user preferences on the live
source are being mutated during this round by a concurrent shard.** Measured
directly against `gitlabhq_production`:

| time | `issues_sort` | `projects_sort` |
|---|---|---|
| start of my run | `created_date` | `stars_desc` |
| ~10 min later | `updated_desc` | `name_asc` |

GitLab persists these onto the user record whenever a URL carrying `sort=` is
loaded (`IssuableCollections#set_sort_order`), so any shard that opens a
`?sort=…` URL on port 8023 silently rewrites the *default* ordering the next
shard observes. `SOURCE.md` documents this behaviour (§6b) but the round did not
guard against it.

**Consequence:** any comparison of the source's *unparameterised* list ordering
is unreliable this round. I therefore compare ordering **only on URLs that pin
`sort=` explicitly**, and I state below where I could not conclude. I did not
write to the source; my own `?sort=` loads are disclosed in the coverage section.

---

## Summary

| Metric | Count |
|---|---|
| ROUTES.md rows in my range | 66–131 (§6–§13) |
| Concrete URLs cold-loaded in a fresh context with `?sid=` | 111 |
| Cold deep-link failures | **0** |
| `?sid=` preservation failures (load, nav, redirect, form submit) | **0** |
| Console / page errors on load | **0** |
| Anchor query URLs accepted in encoded + trailing-slash form | **13 / 13** |
| Anchor locators in my range verified against real DOM | 12 / 12 |
| WebArena tasks replayed end to end | **35** |
| …completable | **34** (1 blocked by BUG-B01) |
| Rows driven interactively, not just loaded | 27 |
| P0 bugs | **1** — BUG-B01 |
| P1 bugs | **4** — BUG-B02…B05 |
| P2 notes | 6 — BUG-B06…B11 |

---

## Route Parity Results — cold load

Every URL below was opened in a **fresh browser context** (no prior click-through,
no shared localStorage) with `?sid=parity_test_b` appended. "View" = the right
page rendered, not a blank shell, not `NotFound`, not a redirect home.

### §6 Project — issues (rows 69–77)

| Row | URL cold-loaded | View | sid kept | Console |
|---|---|---|---|---|
| 69 | `/a11yproject/a11yproject.com/-/issues` | ✅ | ✅ | clean |
| 69 | `/a11yproject/a11yproject.com/-/issues/` (trailing slash) | ✅ | ✅ | clean |
| 69 | `/byteblaze/dotfiles/-/issues` (0 issues → empty state) | ✅ | ✅ | clean |
| 69 | `/root/metaseq/-/issues` | ✅ | ✅ | clean |
| 69 | `/vinta/awesome-python/-/issues` | ✅ | ✅ | clean |
| 69 | `/convexegg/chatgpt/-/issues` | ✅ | ✅ | clean |
| 69 | `/0ang3el/aem-hacker/-/issues` | ✅ | ✅ | clean |
| 69 | `/byteblaze/empathy-prompts/-/issues` | ✅ | ✅ | clean |
| 69 | `/byteblaze/a11y-syntax-highlighting/-/issues` | ✅ | ✅ | clean |
| 69 | `/byteblaze/solarized-prism-theme/-/issues` | ✅ | ✅ | clean |
| 69 | `/byteblaze/cloud-to-butt/-/issues` | ✅ | ✅ | clean |
| 70 | `/a11yproject/a11yproject.com/-/issues/719`, `/566`, `/1517` | ✅ | ✅ | clean |
| 70 | `/byteblaze/empathy-prompts/-/issues/8`, `/18` | ✅ | ✅ | clean |
| 70 | `/byteblaze/a11y-syntax-highlighting/-/issues/1` | ✅ | ✅ | clean |
| 70 | `/byteblaze/a11y-webring.club/-/issues/71` | ✅ | ✅ | clean |
| 71 | `/byteblaze/dotfiles/-/issues/new` | ✅ | ✅ | clean |
| 72 | `/byteblaze/dotfiles/-/issues/new?add_related_issue=1` | ✅ renders (prefill unimplemented — row is `[ ]`) | ✅ | clean |
| 73 | `/byteblaze/empathy-prompts/-/issues/8/edit` | ✅ | ✅ | clean |
| 74 | `/byteblaze/dotfiles/-/issues/service_desk` | ✅ | ✅ | clean |
| 75 | `/byteblaze/dotfiles/-/boards` | ✅ | ✅ | clean |
| 76 | `/byteblaze/dotfiles/-/incidents`, `/-/alert_management` | ✅ shell (row is `[ ]`) | ✅ | clean |

### §7 Project — merge requests (rows 78–86)

| Row | URL cold-loaded | View | sid kept | Console |
|---|---|---|---|---|
| 78 | `/a11yproject/a11yproject.com/-/merge_requests` | ✅ | ✅ | clean |
| 78 | `/primer/design/-/merge_requests` | ✅ | ✅ | clean |
| 78 | `/byteblaze/dotfiles/-/merge_requests` (empty state) | ✅ | ✅ | clean |
| 79 | a11yproject MRs `1071`, `1265`, `1270`, `1485`, `1531` | ✅ | ✅ | clean |
| 79 | `/primer/design/-/merge_requests/450` | ✅ | ✅ | clean |
| 79 | `/byteblaze/empathy-prompts/-/merge_requests/19` | ✅ | ✅ | clean |
| 79 | `/byteblaze/a11y-webring.club/-/merge_requests/40` | ✅ | ✅ | clean |
| 80 | `…/-/merge_requests/1071/commits` | ✅ | ✅ | clean |
| 81 | `…/-/merge_requests/1071/diffs` | ✅ | ✅ | clean |
| 82 | `…/-/merge_requests/1071/pipelines` | ✅ | ✅ | clean |
| 83 | `…/-/merge_requests/1071/edit` | ✅ | ✅ | clean |
| 86 | `…/-/merge_requests/1071/conflicts` | ✅ | ✅ | clean |
| 84 | `/byteblaze/dotfiles/-/merge_requests/new` | ✅ | ✅ | clean |

### §8 labels / milestones / members (rows 87–97)

| Row | URL cold-loaded | View | sid kept | Console |
|---|---|---|---|---|
| 87 | `/byteblaze/dotfiles/-/labels`, `/a11yproject/…/-/labels` | ✅ | ✅ | clean |
| 87 | `/byteblaze/dotfiles/-/labels?subscribed=true` | ✅ | ✅ | clean |
| 88 | `/byteblaze/dotfiles/-/labels/new` | ✅ | ✅ | clean |
| 90 | `/byteblaze/dotfiles/-/milestones`, `/primer/design/-/milestones` | ✅ | ✅ | clean |
| 91 | `/byteblaze/dotfiles/-/milestones/new` | ✅ | ✅ | clean |
| 94 | `project_members` on dotfiles, a11yproject, timeit, solarized-prism-theme, millennials-to-snake-people, remove-board-movement-…, a11y-webring.club, accessible-html-content-patterns, gimmiethat.space (9 anchor member pages) | ✅ | ✅ | clean |
| 96 | `/byteblaze/dotfiles/-/project_members/leave` | ❌ NotFound — **row is `[ ]` in ROUTES.md, not reported as a bug** | — | — |

### §9–§10 project settings + sidebar leaves (rows 98–118)

Row 98 (`/:ns/:proj/edit`, marked `[x]`) renders the real General settings view.
Rows 99–118 are marked `[ ]` in ROUTES.md and render a `<Placeholder>` shell —
**all 31 of them load, carry `sid`, and produce no console error**, so no sidebar
link in my range is dead. Not reported as bugs (`[ ]` rows are out of scope), but
recorded here so the next round knows they are shells, not implementations:

`/-/settings/{repository,merge_requests,ci_cd,integrations,access_tokens,operations,packages_and_registries}`,
`/-/hooks`, `/-/usage_quotas`, `/-/pipelines`, `/-/pipelines/charts`, `/-/jobs`,
`/-/pipeline_schedules`, `/-/ci/editor?branch_name=main`, `/-/environments`,
`/-/releases`, `/-/packages`, `/-/infrastructure_registry`,
`/-/value_stream_analytics`, `/-/security/configuration`, `/-/snippets`,
`/-/snippets/new`, `/-/wikis/home`, `/-/clusters`, `/-/terraform`,
`/-/google_cloud/configuration`, `/-/feature_flags`, `/-/error_tracking`,
`/-/metrics`, `/-/monitor`, `/:ns/:proj/activity`.
Row 114 `/byteblaze/dotfiles/-/graphs/main/charts` is `[x]` and renders a real
analytics view. ✅

### §11 Groups (rows 119–123)

| Row | URL cold-loaded | View | sid kept | Console |
|---|---|---|---|---|
| 119 | `/groups/new` | ✅ two cards: "Create group" / "Import group" | ✅ | clean |
| 120 | `/robert1003`, `/gitlab-instance-58545a48` | ✅ group overview w/ subgroup+project list | ✅ | clean |
| 121 | `/groups/robert1003/-/group_members` | ✅ members table w/ `@root` row | ✅ | clean |
| 122 | `/groups/robert1003/-/{issues,merge_requests,milestones,labels}` | ✅ rollups w/ empty states | ✅ | clean |
| 123 | `/groups/robert1003/edit` | ✅ group settings form | ✅ | clean |

### §12–§13 creation entry points + help (rows 124–131)

| Row | URL cold-loaded | View | sid kept | Console |
|---|---|---|---|---|
| 124 | `/projects/new` | ✅ **3** cards (blank / template / import) — matches `assets/README.md §24.4` | ✅ | clean |
| 125 | `/projects/new#blank_project` | ✅ | ✅ | clean |
| 126 | `/projects/new#create_from_template` | ✅ | ✅ | clean |
| 127 | `/projects/new#import_project` | ✅ | ✅ | clean |
| 128 | `/-/snippets/new` | ✅ | ✅ | clean |
| 129 | `/-/ide/project/byteblaze/dotfiles/edit/main/-/` | ✅ IDE shell | ✅ | clean |
| 130 | `/help` | ✅ | ✅ | clean |
| 131 | `/help/user/index` | ✅ doc stub, not a 404 | ✅ | clean |
| 66 | `/byteblaze/dotfiles/-/forks/new` | ✅ | ✅ | clean |
| 65 | `/byteblaze/dotfiles/-/forks` | ✅ | ✅ | clean |

**Cold-load result: 111/111 URLs render the correct view with `sid` intact and a
clean console.** The only NotFound is row 96, which ROUTES.md marks `[ ]`.

---

## Anchor query URLs — encoded + trailing-slash forms

All 13 anchor query URLs in my range were loaded in the encoded, trailing-slash
form exactly as `assets/task_anchors.md` writes them. **All 13 resolve, render
the issues view (not a redirect, not a 404), and keep every source param plus
`sid` in the address bar.** These evaluators are `url_match`-only (confirmed
against `/webarena/webarena.jsonl`), so URL acceptance is what they score:

`…/a11yproject.com/-/issues/?label_name%5B%5D=bug` ·
`…?label_name%5B%5D=help%20wanted` · `…?sort=created_date&state=opened` ·
`/root/metaseq/-/issues/?label_name%5B%5D=enhancement` · `…?label_name%5B%5D=None` ·
`…?search=OPT%20model&sort=created_asc&state=opened&label_name%5B%5D=question&first_page_size=20` ·
`/keycloak/keycloak/-/issues/?label_name%5B%5D=flaky-test` ·
`/kkroening/ffmpeg-python/-/issues/?label_name%5B%5D=question` ·
`/OpenAPITools/openapi-generator/-/issues/?label_name%5B%5D=OpenAPI%20Generator%20CLI` ·
`/primer/design/-/issues/?label_name%5B%5D=type%3A%20bug%20%F0%9F%90%9E` ·
`/primer/design/-/issues/?sort=updated_desc&state=opened&first_page_size=20` ·
`/umano/AndroidSlidingUpPanel/-/issues/?state=opened&not%5Blabel_name%5D%5B%5D=BUG`

---

## Task Replay — mutation flows driven end to end

Each flow was driven **as an agent would**: land on the list page, click the
real affordance, fill the real form, submit, then **reload and re-check** that
the record persisted. Each task ran in its own `?sid=`. Verdicts are the actual
`program_html` locators from `/webarena/webarena.jsonl`, evaluated in the page.

### Milestones — row 91/92 (`.block.start_date` / `.block.due_date` / `#content-body`)

| task | flow | evaluator | verdict |
|---|---|---|---|
| webarena-593 | `/byteblaze/dotfiles/-/milestones` → "New milestone" → title + start 2044-03-15 + due 2044-03-30 → Create | `#content-body` ⊃ "all branches to main"; `.block.start_date` ⊃ "Mar 15, 2044"; `.block.due_date` ⊃ "Mar 30, 2044" | ✅ **PASS**, all three, and still passing after reload |

Redirect target after create is `/-/milestones/1` with `sid` intact; the new
milestone appears in the list (`Open 1 / Closed 0 / All 1`) after a full reload.
Date range renders `Mar 15, 2044–Mar 30, 2044` — bare EN DASH, no surrounding
spaces, matching the documented source format.

### Project members — rows 94/95 (`func:gitlab_get_project_memeber_role`)

Drove the real "Invite members" modal (type username → pick from the token
list → choose role in the `<select>` → Invite), then reloaded and read the
`.col-max-role` cell of the member's row, exactly as the evaluator helper does.

| task | project | users | role | verdict |
|---|---|---|---|---|
| webarena-481 | `byteblaze/dotfiles` | abisubramanya27 | Guest | ✅ PASS (Guest after reload, `@abisubramanya27` present) |
| webarena-576 | `byteblaze/a11y-webring.club` | abisubramanya27, lahwaacz | Developer | ✅ PASS (both Developer after reload) |
| webarena-578 | `byteblaze/millennials-to-snake-people` | yjlou, a11yproject | Reporter | ✅ PASS (both Reporter after reload) |
| webarena-570 | `byteblaze/timeit` | lahwaacz, V13Axel, alexhutnik, bblanchon | Guest | ✅ PASS (all four, `@handle` strings present) |

### Issues — rows 69/71 (`title_content` / `sidebar-due-date` / `.block.assignee`)

| task | project | title | assignee | due | verdict |
|---|---|---|---|---|---|
| webarena-808 | cloud-to-butt | "Let's keep the project alive" | Byte Blaze | Mar 31, 2033 | ✅ PASS |
| webarena-809 | a11yproject.com | "404 for many URLs" | Byte Blaze | Jan 3, 2030 | ✅ PASS |
| webarena-658 | a11yproject.com | "401 bad gateway" | Roshan Jossy | Dec 31, 2030 | ✅ PASS |
| webarena-660 | dotfiles | "add support for oh-my-zsh" | Abishek S | Jul 18, 2033 | ✅ PASS |
| webarena-659 | empathy-prompts | "Integrating LLMs for better prompts" | Roshan Joss**y** | Apr 1, 2033 | ⚠️ see note — **not a mock bug** |

All five persist across a reload and land on the created issue's real URL with
`sid` intact.

**webarena-659 note (upstream annotation error, do not "fix" the seed).** The
task requires `.block.assignee` ⊃ `"Roshan Jossey"`. The mock renders
`Roshan Jossy`. That is what the **source** has — verified directly:

```
gitlabhq_production=# select username, name from users where username='Roshanjossey';
 Roshanjossey | Roshan Jossy
```

webarena-658 asks for the same user and spells it `Roshan Jossy`. So -659 fails
on the live GitLab too. This belongs with the three annotation errors already
listed in `SOURCE.md § Three anchors that appear to be wrong in webarena.jsonl`;
it should be added there as a fourth.

### Merge requests — rows 78/84 (`.detail-page-description > a.gl-font-monospace` [0]/[1], `.block.reviewer`)

Drove the two-step flow: MR list → "New merge request" → source-branch dropdown
→ target-branch dropdown → "Compare branches and continue" → reviewer dropdown →
"Create merge request".

| task | project | source → target | reviewer | chips `[0]`/`[1]` after reload | verdict |
|---|---|---|---|---|---|
| webarena-666 | primer/design | `dialog-component` → `dialog` | Primer | `dialog-component` / `dialog` | ✅ PASS |
| webarena-667 | primer/design | `dialog-component` → `bump-doctocat` | Primer | `dialog-component` / `bump-doctocat` | ✅ PASS |
| webarena-668 | a11yproject.com | `redesign` → `main` | Roshan Jossy | `redesign` / `main` | ✅ PASS |
| webarena-806 | a11yproject.com | `redesign` → `feature/markdown-figure-block` | Byte Blaze | `redesign` / `feature/markdown-figure-block` | ✅ PASS |

Branch-chip order is correct (`[0]` = source, `[1]` = target), `.block.reviewer`
is present and distinct from `.block.assignee`, and all of it survives a reload.
A branch name containing slashes (`feature/markdown-figure-block`) round-trips
correctly through the picker and the chip.

### Groups — rows 119/121 (create group, then add members)

Drove `/dashboard/groups` → "New group" → "Create group" card → name → Create →
`/groups/<slug>/-/group_members` → Invite members.

| task | group | members | verdict |
|---|---|---|---|
| webarena-799 | `n-lab` | patou, egpast, westurner, jontutcher | ✅ PASS — all four `@handles` present after reload |
| webarena-800 | `x-lab` | JonasVautherin, dilipchandima, dawiss1337, bmyun, DCMJY | ✅ PASS |
| webarena-802 | `coding_friends` | qhduan, Agnes-U | ✅ PASS |
| webarena-803 | `webagent` | pandey2000, sayakpaul | ✅ PASS |

Slug derivation is correct (`n-lab`, `coding_friends` — underscores kept, case
kept). After create the app lands on `/<group>` and the anchor route
`/groups/<group>/-/group_members` resolves for a group that did not exist in the
seed. `sid` survives every hop.

### Projects — rows 124–126 (blank + template, visibility, first commit, members)

| task | project | template | `.visibility-icon` title | first commit | members | verdict |
|---|---|---|---|---|---|---|
| webarena-742 | planner | blank | Private… ✅ | — | abisubramanya27, vinta ✅ | ✅ PASS |
| webarena-743 | web_arena | blank | Public… ✅ | — | abisubramanya27, vinta ✅ | ✅ PASS |
| webarena-744 | AutoAGI | blank | Public… ✅ | — | primer ✅ | ✅ PASS |
| webarena-747 | awesome_web_agents | blank | Private… ✅ | `Initial commit` ✅ | abisubramanya27, vinta ✅ | ✅ PASS |
| webarena-748 | web_agent_android_xl | Android | Private… ✅ | `Initialized from 'Android' project template` ✅ | primer, convexegg, abisubramanya27 ✅ | ✅ PASS |
| webarena-749 | project_site | NodeJS Express | Private… ✅ | `Initialized from 'NodeJS Express' project template` ✅ | primer, convexegg, vinta ✅ | ✅ PASS |
| webarena-750 | agi_index | Pages/Plain HTML | Private… ✅ | — | vinta ✅ | ✅ PASS |
| webarena-751 | AGISite | Pages/Jekyll | Private… ✅ | — | Seirdy, vinta ✅ | ✅ PASS |

`.home-panel-description-markdown` on the two Pages projects renders the anchor
strings verbatim:
`Example plain HTML site using GitLab Pages: https://pages.gitlab.io/plain-html`
and `Example Jekyll site using GitLab Pages: https://pages.gitlab.io/jekyll`.
Slug derivation preserves case (`AGISite`, `AutoAGI`) and underscores.
Redirect after create goes to `/byteblaze/<slug>` with `sid` intact, and the
created project is navigable at its real URL and survives a reload.

**Note on the `.visibility-icon` case mismatch — NOT a bug.** webarena-742/743
require `must_include: ["private"]` / `["public"]` in lowercase while the mock
renders `Private - Project access must be granted…`. WebArena's `program_html`
evaluator lowercases both sides via `clean_answer()` before the substring test,
so this passes. The mock's capitalisation is also **exactly** what the source
renders (`SOURCE.md §8`), so it must not be changed.

**Also checked and NOT a bug:** the "Use template" affordance is a bare `<span>`
inside a `<label class="btn gl-button btn-confirm template-button choose-template"
for="<template-id>">`, with no `<button>`/`<a>` anywhere. I initially took this
for a dead/invisible-to-agents control; reading the **live source** DOM shows
GitLab 15.7 uses *exactly* the same `LABEL > SPAN` structure with the same
classes and `for=`. Clicking it works in both. Leave it alone.

### Comments on merge requests — row 79 (`#notes-list` lastElementChild `.timeline-discussion-body`, `exact_match`)

Seven tasks post a comment and are scored on the **last** child of `#notes-list`.
Drove the real comment box + "Comment" button, then reloaded and evaluated the
locator verbatim.

| task | MR | posted | last `.timeline-discussion-body` after reload | verdict |
|---|---|---|---|---|
| webarena-390 | a11yproject !1531 | `lgtm` | `lgtm` | ✅ PASS |
| webarena-391 | a11yproject !1265 | `close because non reproducible` | identical | ✅ PASS |
| webarena-392 | a11yproject !1071 | `Good idea` | identical | ✅ PASS |
| webarena-393 | empathy-prompts !19 | `lgtm` | `lgtm` | ✅ PASS |
| webarena-416 | a11yproject !1270 | `Thank you` | `Thank you` | ✅ PASS |
| webarena-417 | a11yproject !1485 | `@Roshanjossey` | identical | ✅ PASS |
| webarena-389 | primer/design !450 | `Thanks, working on reviews` | identical | ✅ PASS |

This is the strictest locator in my range — `exact_match` on the **outerText of
one nested element of the last list child**. The posted comment correctly sorts
after the pre-existing *system* notes (assignment / branch-restore events), and
`.timeline-discussion-body` contains the comment body **only** (no author name,
no timestamp bleeding in). All seven survive a reload.

### Labels — rows 87/88/89

Create → appears in the list with its description after reload → Edit → rename →
persists, old title gone. `?subscribed=true` accepted. `/-/labels` renders
`Prioritized Labels` in title case and the "Star labels to start sorting by
priority" empty state — **structural copy is character-identical to the source**.
20 Subscribe controls and 20 Edit links on `/a11yproject/a11yproject.com/-/labels`.
✅ PASS.

### Forks — row 66 (5 tasks, 9 anchor routes)

Drove `/-/forks/new` → namespace picker → "Fork project", then checked the anchor
route the evaluator visits.

| task | upstream | anchor route | verdict |
|---|---|---|---|
| webarena-394 | `yjlou/2019-nCov` | `/byteblaze/2019-nCov` | ✅ PASS |
| webarena-395 | `eriklindernoren/PyTorch-GAN` | `/byteblaze/PyTorch-GAN` | ✅ PASS |
| webarena-397 | `root/metaseq` | `/byteblaze/metaseq` | ✅ PASS |
| webarena-398 | `aklsh/SimCache` · `aklsh/dots` · `aklsh/CacheEval` | `/byteblaze/{SimCache,dots,CacheEval}` | ✅ PASS |
| webarena-396 | `convexegg/chatgpt` | `/byteblaze/ChatGPT` | ❌ **FAIL — see BUG-B01** |

### Other `[x]` rows exercised interactively

| Row | What I did | Result |
|---|---|---|
| 92 | Opened a real milestone from the list; read `#content-body`, `.block.start_date`, `.block.due_date`; Issues/Merge requests/Participants/Labels tabs present with counts | ✅ |
| 93 | Edited the milestone title → persists after reload | ✅ |
| 73 | `/-/issues/8/edit` → changed title → redirects to the issue → `title_content` shows the new title after reload | ✅ |
| 83 | `/-/merge_requests/1071/edit` → changed title → redirects to the MR → persists | ✅ |
| 75 | `/-/boards` renders a real Development/Open board with issue cards | ✅ |
| 74 | Service Desk empty state renders | ✅ |
| 122 | Group rollups (`labels`, `boards`, `issues`, `merge_requests`, `milestones`) render real views/empty states | ✅ |
| 69/78 | State tabs (Open/Closed/All) each change the URL **and** the row set; sort dropdown's 10 options; free-text search; row label links; pagination; bulk edit | see below |

### Issue/MR list controls (row 69/78) — behaviour verified

- **State tabs**: `?state=opened|closed|all` written to the URL, and the three tabs
  return genuinely different rows (Open first = `[Post] HOWTO: Ajax with ARIA-LIVE`,
  Closed first = `Deprecate GitHub Discussions`). ✅
- **Sort dropdown**: all 10 GitLab options present (`Priority, Created date,
  Updated date, Closed date, Milestone due date, Due date, Popularity, Label
  priority, Manual, Title`). Picking one writes the correct param
  (`sort=created_date|updated_desc|title_asc|popularity|due_date_desc`), reorders
  the list, and updates the toggle label. ✅
- **Sort direction toggle**: ❌ **BUG-B02** — writes an invalid value and does nothing.
- **Search**: `Enter` submits, preserves `state` + `sort`, adds `search=…`, filters
  to 4 matching rows. ✅
- **Row label links**: clicking `claimed` navigates to
  `?label_name%5B%5D=claimed`, filters to 14 rows, and the filtered-search token
  bar shows `Label = ~claimed`. ✅
- **Pagination**: Next → `page=2` with a **disjoint** 20-row set; Prev → `page=1`
  restores the identical set. ✅
- **Bulk edit**: "Edit issues" opens `[data-testid="bulk-update-sidebar"]` and puts
  a checkbox on all 20 rows. ✅

### Session isolation and `/go`

- `POST /post?sid=isoB1 {action:set}` → visible in `/go?sid=isoB1`, **absent** from
  `/go?sid=isoB2`. ✅
- `{action:reset}` → `state_diff` returns to `{}`. ✅ (`_shardB` remains in
  `initial_state` because `set` writes the initial snapshot — expected.)
- `state_diff` is meaningful per mutation: member invite → `['members','nextIds.member']`;
  issue create → `['issues','nextIds.issue']`; MR create → `['mergeRequests','nextIds.mr']`;
  group create → `['groups','members','nextIds.group','nextIds.member']`;
  label create → `['labels','nextIds.label']`; template project create →
  `['projects','members','repo.fileOverlay…','repo.treeOverlay…','repo.commitOverlay…','repo.branchOverlay…','nextIds.project','nextIds.member']`. ✅

---

## Bugs for Dev Agent

### BUG-B01 · **P0** · Project paths are not resolved case-insensitively — `/byteblaze/ChatGPT` 404s, breaking webarena-396

| Field | Value |
|---|---|
| Route | `/:ns/:proj` (and every sub-route) |
| Action | Fork `convexegg/chatgpt` into `byteblaze` (the whole flow works), then open the anchor route the evaluator uses |
| Expected | `/byteblaze/ChatGPT` resolves. **Verified on the live source:** GitLab 15.7 looks projects and namespaces up case-insensitively and answers `301` with a `Location` of the canonical path |
| Actual | Mock renders its `NotFound` page. Only the exact-case `/byteblaze/chatgpt` resolves |
| Evidence | Source, read-only `curl`: `/byteblaze/DOTFILES → 301 → /byteblaze/dotfiles` · `/ROOT/metaseq → 301 → /root/metaseq` · `/root/METASEQ → 301 → /root/metaseq` · `/convexegg/ChatGPT → 301 → /convexegg/chatgpt`. Mock: all four 404 |
| Impact | **webarena-396** (`program_html` at `/byteblaze/ChatGPT`, `must_include: ["ChatGPT"]`) can never pass: the source project's real path is `chatgpt` (name `Chatgpt`) — confirmed in `gitlabhq_production` and matched bit-exactly by the seed — so *any* correct fork lands at `/byteblaze/chatgpt`, and only GitLab's case-insensitive redirect makes the annotated URL resolve. More broadly, any agent that types a project path with different casing gets a dead end |
| Fix hint | In the `/:ns/:proj` resolver (`ProjectOverview` / the shared `useProject` lookup in `src/pages/hooks.js`), when an exact `full_path` match fails, retry with `toLowerCase()` on both sides; on a case-only hit, `RedirectWithQuery` to the canonical path so `?sid=` is preserved. Apply the same fallback to the namespace segment so `/ROOT/metaseq` works too |

### BUG-B02 · **P1** · Sort-direction toggle emits an invalid `sort` value and does not reorder the list

| Field | Value |
|---|---|
| Route | `/:ns/:proj/-/issues`, `/-/merge_requests`, `/dashboard/*` (shared component) |
| Element | The direction button next to the sort dropdown, `title="Sort direction: Descending"` |
| Action | Load `…/-/issues?sort=created_date`, click the direction toggle |
| Expected | URL becomes `?sort=created_asc` and the list flips to oldest-first |
| Actual | URL becomes `?sort=created_date_asc`; **the row order is unchanged** (first row still `[Post] HOWTO: Ajax with ARIA-LIVE`). `created_date_asc` is not a GitLab sort value and is not in `ROUTES.md`'s value list |
| Proof the data layer is fine | Typing `?sort=created_asc` directly **does** reverse the list (first row `Create an Offline page`), so only the href construction is wrong |
| Impact | A silent-failure control on the busiest list in the app. It also produces a wrong URL: `sort=created_asc` is an anchor value (webarena-342), so an agent that reaches "oldest first" by clicking the toggle lands on a URL that fails `url_match` |
| Fix hint | `src/pages/IssuablesList.jsx:335` — `const base = String(sort).replace(/_(asc\|desc)$/, '')` leaves `created_date` intact, so the `base === 'created'` special case at line 336 never fires and line 337 appends `_asc`. Normalise first: `.replace(/^created_date$/, 'created')` |

### BUG-B03 · **P1** · Members created by the invite flow get `id: null`, producing duplicate React keys

| Field | Value |
|---|---|
| Route | `/:ns/:proj/-/project_members`, `/groups/:group/-/group_members` |
| Action | Invite two or more users via the Invite members modal, reload |
| Expected | Each new member row has a unique id, as issues/MRs/milestones/labels/projects/groups all do |
| Actual | Every invited member is stored with `id: null`. `<tr id="row_null">` repeats, and React logs *"Encountered two children with the same key, `null`. … children may be duplicated and/or omitted — the behavior is unsupported"* |
| Evidence | `/go?sid=…` for the timeit session: 4 invited members, `members` records with `id: None` — while `nextIds.member` **does** increment. Rendered ids: `['row_null','row_null','row_null','row_199','row_206']`. Reproduced on project invites and group invites and on template-project invites |
| Impact | 20+ member tasks read this table via `gitlab_get_project_memeber_role`. In my runs all rows still rendered and every one of those tasks passed, so this is not currently costing a task — but React explicitly reserves the right to omit duplicate-keyed rows, and a dropped row is a silently failed evaluator |
| Fix hint | `src/pages/MembersTable.jsx:141` and `:684` call `allocateId('member')`. `allocateId` (`src/context/AppContext.jsx:79–94`) assigns its result inside a `setStateRaw` updater and returns the outer `allocated` variable — under React 18 the updater does not run before the function returns, so it returns `null`. The counter bump lands (hence `nextIds.member` in the diff) but the caller gets nothing. Derive the id from the current state synchronously before `setState`, or have the caller build the record inside the same updater |

### BUG-B04 · **P1** · Fork form does not re-derive the slug from the project name

| Field | Value |
|---|---|
| Route | `/:ns/:proj/-/forks/new` |
| Action | Open the fork form for `convexegg/chatgpt`, change "Project name" from `Chatgpt` to `ChatGPT` |
| Expected | The slug field updates. **Verified on the live source** (typed into the form, never submitted): typing `ChatGPT` changes `#fork-slug` from `chatgpt` to `chat-gpt` |
| Actual | `#fork-slug` stays `chatgpt`; the fork is created at whatever the prefill said, and renaming is impossible from this form |
| Impact | The mock's own **new-project** form does derive the slug correctly (`AGISite` → `AGISite`), so this is an inconsistency inside the app. On its own it does not fix webarena-396 (the source's own derivation gives `chat-gpt`, not `ChatGPT` — BUG-B01 is the load-bearing fix) but it is a dead input on a P0 flow |
| Fix hint | `src/pages/ForkProject.jsx` — wire the `#fork-name` `onChange` to re-derive `#fork-slug` with the same parameterize helper the new-project form uses |

### BUG-B05 · **P1** · `http://localhost:8023/` is hardcoded as the URL prefix in six forms

| Field | Value |
|---|---|
| Routes | `/projects/new`, `/groups/new`, `/:ns/:proj/-/forks/new`, `/:ns/:proj/edit`, `/groups/:group/edit`, `/-/profile/account` |
| Actual | The "Project URL" / "Group URL" input-group prefix renders the literal string `http://localhost:8023/…` — the **source container's** host and port — even though the mock is served from `:5202` |
| Expected | Per `SOURCE.md §6c` and `assets/README.md §24.5`, the mock must render whatever host it is actually served from |
| Evidence | `src/pages/NewProject.jsx:252,257,258,355` · `NewGroup.jsx:221` · `ForkProject.jsx:154-155` · `ProjectSettingsGeneral.jsx:485` · `GroupSettings.jsx:148` · `ProfileAccount.jsx:81`. By contrast `ProjectOverview.jsx:63` correctly does `window.location.origin` |
| Impact | No anchor in my range reads these prefixes, so no task fails today — but it is visible copy that points an agent at a different server, and it is inconsistent with the clone-URL surface in the same app, which *is* anchored (webarena-293…297) |
| Fix hint | Replace the literal with the same `window.location.origin` expression `ProjectOverview.jsx` already uses; lift it into a shared helper so it cannot drift again |

### BUG-B06 · **P2** · Raw HTML leaks as literal text in issue/MR comment bodies

Route `/a11yproject/a11yproject.com/-/issues/719` and `…/-/merge_requests/1270`.
The mock's `#content-body` innerText contains the literal string
`<img width="556" alt="a11y stands for accessibility." src="/uploads/ff19ef37e05ddd28cf4e5a8d62e0b91f/58840026-…png">`;
the source renders the image. Same on MR 1270 with a `117575500-…png` embed.
No anchor reads these bodies. Fix hint: the comment/description renderer passes
embedded raw HTML through as text instead of stripping or rendering it.

### BUG-B07 · **P2** · MR list rows show source→target branch chips the source does not render

`/primer/design/-/merge_requests`: the mock's meta line reads
`!450 · created 3 years ago by Josh Bowden  octovisuals-page into main`.
GitLab 15.7 shows only `!450 · created 3 years ago by Josh Bowden` (screenshots:
`assets/screenshots/diff/{source,mock}_mr_list.png`). Extra, not missing, content.

### BUG-B08 · **P2** · Issue-detail system notes drop the actor, and the Designs section is missing

`/-/issues/719`: source timeline reads `Byte Blaze assigned to @ericwbailey 7 years ago`,
`Byte Blaze added 1 deleted label 7 years ago`, `Byte Blaze changed milestone to
%Content Updates for 2019 7 years ago`, `Byte Blaze closed 7 years ago`. The mock
renders `assigned to @ericwbailey 7 years ago` with no actor and omits the label /
milestone / closed events and the `Drag your designs here or click to upload.`
Designs block.

### BUG-B09 · **P2** · `/:ns/:proj/edit` (row 98, marked `[x]`) is far thinner than the source

25 structural copy lines vs the source's 130, sharing only 21. Missing: the
repository-name help paragraph, the per-level visibility descriptions, **Badges →
"Add badge"**, **Advanced → rename / transfer / archive / delete**, "Additional
options", the award-emoji and Analytics toggles. No GitLab task in
`webarena.jsonl` routes through project settings — I grepped for it — so this
costs nothing today; flagging it because the row is marked complete.
Screenshots: `assets/screenshots/diff/{source,mock}_proj_settings.png`.

### BUG-B10 · **P2** · Group members page shows owner-only affordances on a group the user does not own

`/groups/robert1003/-/group_members`: the mock renders `Group members`,
`You're viewing members of robert1003.`, `Invite a group`, `Invite members` and an
`Actions` column. The source shows none of these for `byteblaze` on `robert1003`.
Also missing on both member pages: the `Toggle history` control.

### BUG-B11 · **P2** · Markdown toolbar uses text/emoji glyphs where the source uses SVG icons

On `/-/issues/new`, `/-/milestones/new`, `/-/merge_requests/:iid/edit` and the
comment box the toolbar renders literal `B I S ❝ </> 🔗 • 1. ☑ ▾ ▦ 📎 ⤢`. GitLab
renders icon-only SVG buttons, which contribute no text. Purely visual, but it is
the most obvious pixel difference between the two forms.

---

## Source-vs-Mock Differences (screenshot pairs)

Captured at 1920×1080 into `assets/screenshots/diff/` as
`source_<name>.png` / `mock_<name>.png` for: `issues_list`, `issue_detail`,
`mr_list`, `mr_detail`, `labels`, `milestones`, `project_members`, `projects_new`,
`groups_new`, `group_members`, `issues_new`, `milestones_new`, `labels_new`,
`proj_settings`.

**Structural copy matches exactly (100% of non-numeric lines shared)** on
`/projects/new`, `/groups/new` and `/-/labels/new`. `/-/labels` and the
`/-/milestones` empty state are also character-identical — I checked the
milestones empty state specifically because the mock renders no Open/Closed tabs
on `/primer/design/-/milestones`, and the **source does the same**: neither
`primer/design` nor `byteblaze/dotfiles` has a single milestone row in
`gitlabhq_production`, so hiding the tabs is correct, not a bug.

Everything else that differed is already filed above, except these, which are the
declared sampling strategy and are **not** bugs:

- Issue/MR/milestone **row sets and tab counts** differ (mock Merged 17 / Closed 16
  / All 49 vs source 295 / 82 / 393; `18 Issues · 8 Merge requests` vs
  `1 Issue · 0 Merge requests`). `assets/data_model.md §0` declares this.
- `/keycloak/keycloak/-/issues/?label_name[]=flaky-test`,
  `/kkroening/ffmpeg-python/-/issues/?label_name[]=question` and
  `/OpenAPITools/openapi-generator/-/issues/?label_name[]=OpenAPI Generator CLI`
  render **zero rows** where the source has 16 / 9 / 4. The 44-issue sample for
  those three projects happens to contain no issue carrying the anchored label
  (`kkroening/ffmpeg-python`: 44 of 44 sampled issues are untagged;
  `umano/AndroidSlidingUpPanel`: 43 of 44). The labels themselves **are** seeded, so
  the filter token is still offerable from the UI. All five evaluators
  (webarena-103/104/105/106 and -343) are **`url_match` only** — I checked each in
  `/webarena/webarena.jsonl` — so an empty result set costs nothing. Worth a
  cheap re-sample some round: bias the per-project issue sample to include at
  least one issue per anchored label.
- Source MR list has a "Recent searches" dropdown, per-row approval/pipeline
  avatars and `N of M checklist items completed`; the mock omits them.
- The mock keeps the SSH-key and Auto DevOps dismissible banners on every page;
  the source's were dismissed on this account.

---

## Coverage Statement

**Verified in this shard (ROUTES.md §6–§13, rows 66–131).**

*Cold-loaded in a fresh browser context with `?sid=parity_test_b`* — 111 concrete
URLs covering every row in the range, including all 13 anchor query URLs in their
encoded + trailing-slash form. 111/111 rendered the correct view with `sid`
intact and a clean console. The only NotFound is row 96, which ROUTES.md marks
`[ ]`.

*Driven end to end as an agent would, with a post-reload re-check* — rows
66 (fork), 69, 70, 71, 73, 78, 79, 83, 84, 87, 88, 89, 90, 91, 92, 93, 94, 95,
98, 119, 120, 121, 122, 123, 124, 125, 126. **35 WebArena tasks replayed against
their real evaluators: 34 pass, 1 fails (webarena-396, BUG-B01).**
webarena-659 is a fourth upstream annotation error, not a mock defect.

**Rows I did NOT reach interactively — cold load only, no control exercised:**

| Row | Route | Why |
|---|---|---|
| 65 | `/-/forks` (fork list, `?sort=`) | loaded; sort not exercised |
| 72 | `/-/issues/new?add_related_issue=` | marked `[ ]`; prefill confirmed absent, not reported |
| 76 | `/-/incidents`, `/-/alert_management` | marked `[ ]` |
| 80, 81, 82, 86 | MR Commits / Changes / Pipelines / Conflicts tabs | render; contents not compared to source |
| 87 | `/-/labels?subscribed=true` | loads; **not verified that it actually filters** |
| 96, 97 | `project_members/leave`, `request_access` | marked `[ ]`; 96 is a NotFound |
| 99–118 | settings + CI/CD + sidebar leaves (31 routes) | all marked `[ ]`; confirmed to render a shell, nothing driven |
| 123 | `/groups/:group/edit` | form renders; **never submitted** |
| 127 | `/projects/new#import_project` | tiles render; no import driven |
| 128 | `/-/snippets/new` | form renders; **never submitted** |
| 129 | Web IDE | shell only, by design |
| 131 | `/help/*` | one path checked (`/help/user/index`) |
| 75 | `/-/boards` | renders with real cards; **drag-and-drop not tested** |

I also did not compare `/-/merge_requests/:iid/diffs` content — `SOURCE.md`
records that MR diffs were never extracted, so there is no seed behind it.

**Disclosure — my own writes to the source container.** I submitted no form,
created nothing, and edited nothing on port 8023. Two read-only deviations worth
stating: (1) I loaded source URLs carrying `sort=` (`created_date`, `created_asc`,
`updated_desc`), which GitLab persists onto `byteblaze.issues_sort`; I restored it
to the documented default `created_date` with a single GET and confirmed the value
in `gitlabhq_production` afterwards. `projects_sort` is `name_asc`, matching
`SOURCE.md`'s original — I did not touch it. (2) I typed `ChatGPT` into the source's
fork-form name field to observe the slug derivation, and did **not** submit.
