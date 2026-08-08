# DEV — round 6 (final)

> App: `websites/webarena_gitlab_mock/`
> Source: `http://localhost:8023` — read only. No login, no POST, no form submit,
> no star/follow/create, and **no `?sort=` URL was loaded on 8023**. Docker was
> used for read-only `gitlab-rails runner` queries and to read the Rails views
> and helpers out of the image; nothing was written to the container.
> Verified in real chromium (`/tmp/pwvenv` + `LD_LIBRARY_PATH=/tmp/sysroot/...`),
> in both dev (`--port 5251`) and built/preview mode (`--port 5252`).

---

## 1. DIFF-001 — the two project banners are now scoped exactly as the source

**Root cause, from the container's own code — not guessed.** Both banners live in
`app/views/projects/_flash_messages.html.haml`, and that partial is included by
exactly two views:

```
app/views/projects/show.html.haml:11   = render partial: 'flash_messages', …
app/views/projects/empty.html.haml:6   = render partial: 'flash_messages', …
```

Both are the project **overview**. No project sub-page renders it. That matches
the captures precisely: of the 179 logged-in files in `assets/html/`,
`js-no-ssh-message` appears in **7** and all 7 are project overviews; it appears
in **none** of the 40+ logged-in project sub-page captures (`proj-*-issues`,
`proj-*-members`, `proj-*-labels`, `proj-*-mrs`, `proj-*-tree`, `r4-*`, …).

**Why Auto DevOps was on only 2 of 7 — and why that framing was misleading.**
`ProjectsHelper#user_can_see_auto_devops_implicitly_enabled_banner?`:

```ruby
Ability.allowed?(user, :admin_project, project) &&   # access_level >= 40
  project.has_auto_devops_implicitly_enabled? &&     # no explicit setting row
  project.builds_enabled? &&
  !project.repository.gitlab_ci_yml
```

…plus `unless project.empty_repo?` at the render site. Queried read-only against
the container for byteblaze (id 2330):

| | count |
|---|---|
| projects byteblaze is Maintainer+ on | 13 |
| …of those with `has_auto_devops_implicitly_enabled? == true` | **10** |
| projects with an explicit `project_auto_devops` row | 67 (all `enabled=false`) |
| projects with a `.gitlab-ci.yml` | 2 (`aklsh/dots`, `test123/boo`) |
| projects with `builds_enabled? == false` | 1 |
| empty repos | 2 |

So the banner is not a 2-project thing at all — it is a **10-project** thing
(`dotfiles`, `gimmiethat.space`, `timeit`, `cloud-to-butt`, `solarized-prism-theme`,
`a11y-syntax-highlighting`, `millennials-to-snake-people`,
`accessible-html-content-patterns`, `ericwbailey.website`,
`remove-board-movement-events-from-the-github-issue-timeline`). Only 2 of them
happened to have an overview capture. The 3 Maintainer+ projects it is *absent*
on — `a11yproject.com`, `a11y-webring.club`, `empathy-prompts` — each carry an
explicit `project_auto_devops` row, which turns the implicit default off. Had I
hard-coded "dotfiles and gimmiethat.space" the mock would have been wrong on 8
projects.

**What changed.**

- `src/data/projects.json` gained four optional container-derived fields, written
  **only where they deviate from GitLab's default**, so the payload cost is small:
  `auto_devops_enabled:false` (67 rows), `has_ci_config:true` (2),
  `builds_enabled:false` (1), `empty_repo:true` (2). No identifier was renamed and
  no existing value changed — verified field-by-field against the pre-edit file.
- `src/components/layout/Layout.jsx` — the alert block is now gated on
  `isProjectOverview` (`route.kind === 'project' && route.project && !route.section`),
  and each banner has the source's own predicate:
  - SSH: `!(state.ui.sshKeys || []).length`, i.e. `User#require_ssh_key?`. Adding
    a key on `/-/profile/keys` now removes the banner, as on the source.
  - Auto DevOps: `showAutoDevopsBanner()`, transcribed from the helper above.

**Measured in chromium** (fresh context + fresh `?sid=` per row):

```
ssh=1 ado=1   /byteblaze/dotfiles            ssh=1 ado=0   /a11yproject/a11yproject.com
ssh=1 ado=1   /byteblaze/gimmiethat.space    ssh=1 ado=0   /primer/design
ssh=1 ado=1   /byteblaze/timeit              ssh=1 ado=0   /root/metaseq
ssh=1 ado=1   /byteblaze/cloud-to-butt       ssh=1 ado=0   /vinta/awesome-python
ssh=0 ado=0   on all 19 sub-paths × 4 projects, and on /dashboard/projects
```

That is 7/7 agreement with the seven logged-in overview captures and 0/0 on every
sub-page. 76 route probes, **0 console errors, 0 pageerrors, 0 `?sid=` losses**.

---

## 2. Stale-marker sweep

`TODO.md` — five markers corrected, all in the direction the evidence supports:

| item | was | now | why |
|---|---|---|---|
| ROUTES #30 star/unstar | `[~]` | `[x]` | driven green in round 5, re-confirmed |
| ROUTES #16–19 explore | `[~]` | `[x]` | the "still open" clause (BUG-A12, invented topics empty state + hand-rolled tab strip) is stale — `ExploreTopics.jsx` imports and renders `<ProjectsPrimaryTabs active="topics">` over the source's `_topics.html.haml` copy |
| ROUTES #64, 65 starrers/forks | `[~]` | `[x]` | both render real views, cold-loaded green |
| ROUTES #98–105 settings | `[~]` | `[x]` | row 98 now has all five source sections incl. Badges and Advanced (BUG-B09's premise no longer holds); 99–105 implemented this round |
| ROUTES #106–118 leaves | `[ ]` | `[x]` | 106–112/114–118 landed round 4, 113/115 this round |

Two markers were **left as they are**, because they are accurate:

- *Syntax highlighting in the blob view* stays `[ ]`. `RepoBlob.jsx` ships
  GitLab's `js-syntax-highlight` wrapper classes but no tokenizer; nothing in
  `src/` matches `hljs`/`prism`.
- *Verify the `assets/data_model.md §14` checklist* stays `[~]` — no round has
  run it. Its sub-claim **was** stale and is corrected: `tree_last_commits.json`
  and `resource_events.json` are both wired (`RepoTree.jsx:12`,
  `NotesTimeline.jsx:10`) and both are documented in `data_model.md` and
  `SCHEMA.md`.

Three documentation lines TEST DIFF-007 flagged are fixed in `ROUTES.md`: the
`archived=true` query-param row now states GitLab's real `ProjectsFinder`
semantics, and both feed-token references now point at
`/-/profile/personal_access_tokens` instead of `/-/profile/account`.

---

## 3. The nine placeholder rows and the two 404 rows

`src/components/layout/Placeholder.jsx` **has been deleted.** No route references
it, and `grep "has not been implemented yet" dist/assets/*.js` returns 0. The
string cannot survive anywhere in the app.

Every string, heading, help-link `href`, empty state and default expand/collapse
state below came from a logged-in capture in `assets/html/`. Nothing is invented.

| row | route | file | notes |
|---|---|---|---|
| **99 (P1)** | `/-/settings/repository` | `src/pages/ProjectSettingsRepo.jsx` | all seven source sections with the source's ids (`branch-defaults-settings`, `js-push-remote-settings`, `js-protected-branches-settings`, `js-protected-tags-settings`, `js-deploy-tokens`, `js-deploy-keys-settings`, `cleanup`). Default branch writes `projects[].default_branch`; the protected-branches table starts on `main / default / Maintainers / Maintainers` as the source shows, and Protect/Unprotect/force-push work |
| 100 | `/-/settings/merge_requests` | `ProjectSettingsMisc.jsx` | the one section the source ships **`expanded`** |
| 101 | `/-/settings/ci_cd` | ″ | 9 sections incl. the three badge panels, the runner registration token `GR1348941tBFVancyEKczeWtBv-iC`, variables, triggers, deploy freezes |
| 102 | `/-/settings/integrations` | ″ | active-integrations empty table + all 37 inactive integrations, source order, source slugs |
| 103 | `/-/settings/{access_tokens,operations,packages_and_registries}` | ″ | packages is the source's non-collapsible two-column `settings gl-py-7` block, not an Expand section |
| 104 | `/-/hooks` | ″ | 13 trigger checkboxes, URL-mask radios, `Project Hooks (0)` / `No webhooks enabled. Select trigger events above.` |
| 105 | `/-/usage_quotas` | ″ | recalculation alert + `Storage` tab |
| 113 | `/-/value_stream_analytics` | ″ | filtered-search bar, 6-stage path nav, Key/DORA metrics, `We don't have enough data to show this stage.` |
| 115 | `/-/security/configuration` | ″ | Auto DevOps banner, Ultimate upsell, 3 tabs, 10 scanner cards with real status badges |
| **96** | `…/project_members/leave` | `ProjectOverview.jsx` | `Leave project` link in `.home-panel-metadata` |
| **97** | `…/project_members/request_access` | ″ | `Request Access` / `Withdraw Access Request` |

**Rows 96/97 are affordances, not pages.** GitLab routes them DELETE/POST only, so
a GET 404s on the source too; what the row actually is, is the link
`shared/members/_access_request_links.html.haml` puts next to `Project ID: N`.
Gating transcribed from that partial (direct member → Leave, unless you hold the
project's personal namespace; requester → Withdraw; otherwise → Request Access).
Measured against all seven logged-in overview captures — **7/7 exact**:

```
leave=1 request=0  /a11yproject/a11yproject.com      (Maintainer)
leave=1 request=0  /primer/design                    (Developer)
leave=0 request=0  /byteblaze/dotfiles               (own namespace)
leave=0 request=0  /byteblaze/gimmiethat.space       (own namespace)
leave=0 request=1  /vinta/awesome-python
leave=0 request=1  /root/metaseq
leave=0 request=1  /CellularPrivacy/Android-IMSI-Catcher-Detector
```

Both flows were driven: Request Access → `Withdraw Access Request`, survives
reload, `/go` `state_diff` shows `members.added` with `requested_at`, the Members
tab correctly does **not** list byteblaze, Withdraw reverses it. Leave project
raises the source's own confirm text (`…leave the "Primer / design"
projectpresenter?` — `projectpresenter` is not a typo, it is what
`MembersHelper#leave_confirmation_message` produces on a `ProjectPresenter`),
removes the membership, redirects to `/dashboard/projects` with `?sid=` intact,
and the link flips to `Request Access`.

Every settings form mutates through the context, so it reaches `/go`. New state
key: `ui.projectSettings[<full_path>]` (`src/pages/projectSettingsStore.js`),
documented in `SCHEMA.md` with three new Observable-State-Changes rows. Driven and
reload-verified: protect a branch, add a webhook, add a CI variable. All host
strings derive from `window.location` — `grep` for `10.186.197.203` and `:8023`
in the rendered HTML returns nothing.

---

## 4. Declared gap — do not treat this as done

`/:ns/:proj/-/settings/integrations/:slug/edit` (37 slugs, linked from row 102)
is **not implemented**, and I did not guess it. It is a Vue app
(`js-vue-integration-settings`) whose DOM only exists after its bundle runs, so it
cannot be recovered from the static captures we hold, and the only logged-in
capture is the index. Row 102's links carry the source's own hrefs, so a click
currently reaches `NotFound`. Recorded in `ROUTES.md`'s Intentionally-Not-Migrated
table with that reasoning. It needs a fresh logged-in browser capture first.

One behaviour I did **not** change, for consistency with the rest of the app: the
settings routes render for any project, including ones byteblaze is not a
Maintainer on (`/root/metaseq/-/settings/ci_cd`). The source 403/404s those. This
matches how row 98 has always behaved and the contract's "no auth gate" rule; if a
later round wants permission-gated settings it should gate rows 98–105 together.

---

## 5. State size — small, deliberate regression, reported

Re-measured from a live `/go`: `JSON.stringify(initial_state)` = **2 076 855 bytes
= 1.981 MiB**, against the ~1–2 MB ceiling.

Round 6 added **+2 001 bytes**: 1 977 for the four project flags (measured exactly
by stripping them and re-stringifying) and ~24 for the empty `ui.projectSettings`
object. Headroom goes from ~33 KB to ~19 KB.

Honest caveat: round 5 recorded 2 063 847 bytes, so ~11 KB of drift is **not**
mine and I could not attribute it — `src/data/` is untracked so there is no
baseline to diff against. Flagging it rather than absorbing it into my number.
`TODO.md`'s seed-size item now carries this measurement; the "2.14 MB minified"
figure it used to quote was a different metric and is superseded.

---

## DEV PROGRESS: webarena_gitlab_mock

Build: **PASS** (`npm run build`, 165 modules, 2.98s) — and re-verified in a real
browser under `npm run preview`, because a green build has white-screened this app
before.

Completed this session:
- [x] DIFF-001 — SSH + Auto DevOps banners scoped to project overviews, each with
      the source's own predicate  [P1 source-vs-mock difference — closed]
- [x] Repository settings  [ROUTES #99, P1]
- [x] Merge request / CI-CD / Integrations / Access tokens / Monitor / Packages
      settings  [ROUTES #100–103]
- [x] Webhooks, Usage quotas, Value stream analytics, Security configuration
      [ROUTES #104, #105, #113, #115]
- [x] Leave project / Request access / Withdraw access request  [ROUTES #96, #97]
- [x] `<Placeholder>` component deleted — the "has not been implemented yet"
      sentence is gone from `src/` and from `dist/`
- [x] TODO.md + ROUTES.md stale-marker sweep (5 corrected, 2 correctly left open)
- [x] ROUTES.md DIFF-007 documentation fixes (3 lines)
- [x] SCHEMA.md: `ui.projectSettings`, `members.requested_at`, the four project
      flags, 6 new Observable State Changes rows

Route parity: **126 / 126** migrated rows in ROUTES.md `[x]`; 6 rows declared
not-migrated; 1 newly-declared undetermined gap (integration edit pages).

Blockers: none.

Seed gaps hit (did NOT fabricate):
- the per-integration edit page (§4) — left unimplemented and declared

TODO.md: P0 — / — | P1 all `[x]` | P2 2 open (`[ ]` blob syntax highlighting,
`[ ]` seed-size re-cut) + 1 `[~]` (`data_model.md §14` checklist never run)
