# webarena_gitlab_mock — Source Recon

> Source: http://localhost:8023
> Image: `gitlab-populated-final-port8023:latest` · Container: `gitlab` (9fd7a67ceda0)
> Recon by: plan agent, 2026-08-07
> **Recon mode: FULL** (docker exec + gitlab-psql + live Playwright crawl all confirmed)

---

## Access

| Probe | Result |
|---|---|
| `docker ps --filter name=gitlab` | Up 2 days (healthy), `0.0.0.0:8023->8023/tcp` |
| `curl http://localhost:8023` | `302` → `/users/sign_in` (unauthenticated) |
| `curl http://localhost:8023/users/sign_in` | `200` |
| `docker exec gitlab gitlab-psql -c "\dt"` | OK — full Postgres access (db `gitlabhq_production`, user `gitlab`) |
| Playwright chromium (with `LD_LIBRARY_PATH=/tmp/sysroot/...`) | launches, login as `byteblaze` succeeds |

**Read-only discipline — observed, with one disclosed exception.** All DB access
was `SELECT` only. No record was created, edited or deleted: no issues, MRs,
comments, projects, groups, members, files, stars, forks, follows or profile
edits.

**Exception (disclosed, reverted).** While enumerating the sort menus on the
issue and project lists, the view-documentation pass caused GitLab to persist
byteblaze's two sort *preferences* — `projects_sort` and `issues_sort` — which
GitLab writes to the user record on selection rather than keeping in the URL.
Both were restored to their original values (`name_asc` and `created_date`
respectively). No other row in `gitlabhq_production` was written. Flagging it
rather than burying it: it is a real deviation from read-only discipline, the
benchmark surface it touches is a user preference rather than task data, and it
is back to its original state.

**Two captures are affected by that window.**
`assets/html/proj-a11yproject-issues.html` and `assets/html/issues-label-bug.html`
were saved while `issues_sort` happened to be `created_asc`, so they list
**oldest-first**. That is *not* the default ordering — the default is
`created_date` (newest first). This is flagged inline in `assets/README.md §13b`.
Do not infer default sort behaviour from those two files.

## Stack

| Layer | What it is |
|---|---|
| App | GitLab Community Edition **15.7.5** (revision `358d690d91c`), Omnibus package |
| Server | nginx → gitlab-workhorse → Puma (Rails 6.1) |
| DB | PostgreSQL, database `gitlabhq_production`, role `gitlab`; wrapper `gitlab-psql` |
| Repo storage | Gitaly, repos on disk at `/var/opt/gitlab/git-data/repositories` |
| Frontend | Haml views + Vue 2 islands, GitLab UI (`@gitlab/ui`) component library |
| CSS | Bootstrap 4 fork + GitLab utility classes (`gl-*`), compiled to `/assets/application-*.css` |
| Search | PostgreSQL trigram/basic search (no Elasticsearch in CE) |
| Auth | Devise session cookie `_gitlab_session`; sign-in at `/users/sign_in` |

Root URL is served at port 8023 with **no path prefix** — `external_url` is
`http://<host>:8023`, so paths are plain (`/byteblaze/dotfiles`, not
`/gitlab/byteblaze/dotfiles`).

## Default user

`byteblaze` / `hello1234` — display name **Byte Blaze**, user id **2330**.
The mock boots pre-logged-in as this user. `/users/sign_in`, `/users/sign_up`,
`/users/password/new` are out of scope per the migration contract.

## Site scale (measured, see `assets/data_model.md` for the sampled subset)

Counts come from `SELECT count(*)` against `gitlabhq_production`. They are the
*source* scale, not the seed scale — the seed is a curated sample (§4 of
`WEBARENA_MIGRATION.md`).

| Entity | Source rows | Seeded |
|---|---|---|
| users | 2 399 | 1 858 |
| projects | **175** | **all 175** |
| namespaces | 2 576 | — (derived from projects) |
| groups | **2** | **both** |
| issues | 80 962 | 3 926 |
| merge_requests | 134 338 | 4 636 |
| notes (comments) | 303 407 | 12 648 |
| labels | 1 753 | 972 |
| milestones | 545 | 252 |
| members | 183 | **all 183** |
| users_star_projects | 2 218 | 569 |
| user_follow_users | **5** | **all 5** |
| todos | 2 338 | 7 (byteblaze's) |
| events | 1 | — (activity feed is derived) |
| snippets | **0** | — (render the real empty state) |

(Seeded counts re-measured off `src/data/*.json`; the column predated the 6.4x
expansion in `c75e0449d` and still read 613 / 729 / 1 599.)

Only **2 groups** exist (`gitlab-instance-58545a48`, `robert1003`). The five
groups the anchors name are created by tasks 799–803.

Seed footprint on disk: **23.8 MB** across `src/data/*.json`. Loaded on a cold
project route: **2.34 MB eagerly** plus the project's own chunk (median 82 KB).
The split, and why each collection falls on the side it does, is in `SCHEMA.md`
§ *Per-project lazy loading*. See also `assets/data_model.md §0` and `§12`.

### Design decision: the corpus is frozen, mutations are an overlay

Those 12 modules used to be **copied into app state** by `createInitialData()`,
which made the cold state 2 072 728 B. That is a defect, not a size preference:

* Chrome bills `localStorage` in UTF-16 and a session needs **two** keys
  (`…_state` and `…_initial_state`), so a cold session claimed
  2 × 2 068 670 = **4 137 340 of the ~5 242 880-unit origin quota — 79 %, before
  the agent did anything.**
* GitLab's task set is overwhelmingly creative: **49 "create", 22 "star",
  20 "assign", 18 "merge", 15 "invite", 13 "close"**. A handful of mutations
  crossed the quota, `dataManager.persist()` swallowed the `QuotaExceededError`
  and dropped both keys, and persistence died **silently** — the mock fell back
  to the server-side state files with no warning at all.
* Every mutation POSTed all 2.07 MB and every `/go` returned 4.15 MB.

Since the corpus is never *replaced*, only *added to and patched*, it is now
read-only base data in `src/data/frozen.js`, and what is persisted is the
**delta**: `src/utils/overlay.js` merges the two on read at a single point.
Cold state is **1 473 B**; the two localStorage keys are 0.06 % of quota.

Two things follow, and both are deliberate:

1. **A stale `.mock-state.json` snapshot can no longer pin an old corpus.** A
   pre-refactor snapshot carries the full arrays; `overlay.baseArray()` still
   honours them as the base, so it renders — but it renders *that snapshot's*
   corpus, not `src/data/`. Delete stale snapshots when the seed changes.
2. **Task setup should inject the overlay keys, not full arrays.** Adding one
   issue costs one record instead of 613. Full-array injection keeps working
   unchanged; see `SCHEMA.md` § *Injecting task state*.

The write side is a **reconciler** rather than a set of overlay verbs, which is
where this diverges from `webarena_reddit_mock`. Reddit had three mutation
shapes and could give each an explicit verb. GitLab has 79 write sites across
33 direct `setState(prev => …)` reducers, four generic helpers in `AppContext`
and six reducers in `src/components/create/mutations.js`; rewriting all of them
would have been 79 chances to miss one, and a missed one is invisible — the UI
still renders and only persistence and `/go` are wrong. So the reducers were
left exactly as they were and `overlay.dematerialize()` derives the delta from
what they return. The full argument is in the header of `src/utils/overlay.js`.

### Design decision: the per-project half of the corpus is loaded on demand

Freezing the corpus fixed *state* size. It did nothing for *load* size — all
23.8 MB of `src/data` was still in the eager module graph on every route, via
`frozen.js` and via a second, larger import site in `dataManager.js` for the
seven STATIC git modules. Bundled JSON parses at ~32 ms/MB over a ~130 ms floor
on this host, so first contentful paint scaled with the size of the WHOLE
corpus regardless of which page was open, and the planned 3-5x seed expansion
would have taken a project route past 1.5 s.

16.8 MB of the corpus is strictly per-project — repo files, trees, commits,
contributors, branches, tags, notes, resource events, MR diffs, CI pipelines —
and 2.9 MB more is issue/MR `description`, read by five views, four of them
project routes. Nobody opening `/byteblaze/dotfiles` needs any of it for the
other 174 projects. So it is sliced by project id into
`src/data/by-project/<id>.json` and loaded with `import()`.

What stays eager is what is genuinely cross-cutting — projects, users, groups,
labels, milestones, members, stars, follows, todos — plus a **metadata index**
for issues and merge requests: every field except `description`, tuple-encoded.
The navbar's assigned-issue counts, both sidebars' open counts, the three
dashboards, the group rollups and `/search` all read across every project on
every route, and `overlay.reconcileCollection()` derives deletion tombstones
from the base array, so those two collections must exist globally or a single
write would tombstone thousands of records. Only their bodies are lazy.

Measured on `/byteblaze/dotfiles`, five interleaved cold loads each:

| | eager seed | preview FCP | dev FCP |
|---|---|---|---|
| before | ~24 MB | 432 ms | 580 ms |
| after | 2.34 MB + one 104 KB chunk | **172 ms** | **376 ms** |

and with the corpus deliberately padded to **139 MB** (every chunk but
dotfiles' 5x, `search_bodies` 5x), preview FCP on that route was **184 ms** —
inside the spread of the unpadded runs. Load time no longer scales with total
corpus size, which is the point: the next seed expansion is now bounded by the
index (~160 B per issue, ~220 B per merge request) rather than by everything.

The correctness rule is in `SCHEMA.md` § *Per-project lazy loading* and in
`src/data/lazy.js`: `App` renders **nothing** until the route's chunk is
resolved, so a cold deep link paints the real page once rather than an empty
one that fills in. `assets/dumps/test_lazy.py` asserts exactly that, plus the
body round-trip and the overlay crossing a lazy boundary.

## Task contract

`assets/task_anchors.md` (pre-generated) is the governing contract:
**204 tasks**, 132 `program_html`, 56 `string_match`, 54 `url_match` →
**145 anchor routes, 252 anchor strings, 25 anchor locators**.

A structurally important detail about GitLab's anchor set: **many anchor routes
name records that do not exist in the source yet.** e.g. `/byteblaze/AGISite`,
`/byteblaze/web_agent_android_xl`, `/byteblaze/nolan_followers`,
`/byteblaze/gimmiethat.space/-/raw/main/funny_pic/urls.txt`. These are the
*post-conditions* of creation tasks — the evaluator navigates there after the
agent has created the project/file. They must be **reachable once created**, not
pre-seeded. This makes the create-project, create-file, and add-member flows P0
rather than P2, and it is the single biggest difference between the gitlab
migration and the reddit/shopping ones.

See `## Anchor coverage` at the bottom of this file for the audit.

## Observations

**1. The `/-/` infix, and the routes that skip it.** GitLab separates project
sub-resources from repo paths with a literal `-` segment (`/:ns/:proj/-/issues/719`).
A few legacy routes sit outside it and are not typos: `/:ns/:proj/edit`,
`/:ns/:proj/activity`, `/:ns/:proj/archive`. Reproduce both shapes.

**2. Trailing slash before the query string.** Twelve anchor URLs are written
`/-/issues/?label_name%5B%5D=bug`. The source serves both that and
`/-/issues?…`. The mock router must too.

**3. Commit history lives in git, not Postgres.** All the contributor/commit
counting tasks (20 of them) read `/-/graphs/:ref`, which Gitaly computes from the
bare repos at `/var/opt/gitlab/git-data/repositories/@hashed/…`. Extracted with
the container's own git:

```bash
docker exec gitlab /opt/gitlab/embedded/bin/git \
  --git-dir=/var/opt/gitlab/git-data/repositories/<disk_path>.git \
  log <ref> --format='%an%x01%ae%x01%ad' --date=short
```

`project_repositories.disk_path` maps project → repo. This is how
`commits.json`, `contributors.json`, `branches.json`, `tags.json`,
`repo_trees.json` and `repo_files.json` were built. Without it, 20 tasks are
unanswerable no matter how good the UI is.

**3b. The contributors graph is NOT `git shortlog`.** This cost real time and is
the single most error-prone thing in this migration. `/-/graphs/:ref` runs
`repository.commits(ref, limit: 6000, skip_merges: true)` and then groups
**by lowercased author email**, labels each card with the name on that email's
**newest** commit, and buckets by **committer** date. Naive `git shortlog -sne`
gives a *different top contributor* on 6 of the 13 task-relevant projects.
The full rule and worked counter-examples are in `assets/data_model.md §11`.
Verified: the seed reproduces the live endpoint's 1 028 (email, date) buckets for
`a11yproject/a11yproject.com@main` with zero mismatches, and the top contributor
name+count matches the rendered page on 11 projects.

**4. Default branch is not always `main`.** Read `git symbolic-ref --short HEAD`
per repo. `byteblaze/cloud-to-butt` is on `master` and its anchor is
`/-/blob/master/LICENSE.txt`; `dehenne/awesome-visibility`'s anchor is
`/-/graphs/master`; `amwhalen/archive-my-tweets` has an anchor on branch `php52`
and another on `github/fork/chtitux/addRssFeed` (a branch name with slashes).

**5. `/-/raw/:ref/*path` returns bare `text/plain`, no app chrome.** Fifteen tasks
read file content through it. `/-/blob/:ref/<missing path>` silently 302s to
`/-/tree/:ref`, while `/-/raw/:ref/<missing path>` 404s.

**6. `user_statuses` is empty and `byteblaze.website_url` is blank.** Both are
written by tasks (418–422, 448–452) and read back through `.cover-status` and
`.profile-header [itemprop="url"]`. Nothing to seed.

**6b. Sort order is a persisted user preference, not just a URL param.** GitLab
writes `projects_sort` and `issues_sort` onto the user record when you pick from
the sort dropdown, so the "default" ordering of a list is per-user state, not a
constant. The mock should keep this in state so a chosen sort survives navigation
— and so `/go` reports it as an observable change.

**6c. Clone URLs are host-dependent.** On this instance they resolve to
`ssh://git@10.186.197.203:2222/<ns>/<proj>.git` and
`http://10.186.197.203:8023/<ns>/<proj>.git`, not `localhost`. WebArena's
evaluator substitutes `__GITLAB__` / `__GITLAB_SSH__` for these (tasks 293–297),
so the mock must render **whatever host it is actually served from** rather than
hard-coding either value. See `assets/README.md §24.5`.

**6d. Two due-date selectors, not one.** An issue's due-date sidebar block is
`<div class="block" data-testid="sidebar-due-date">` and carries **no**
`.due_date` class; `.block.due_date` and `.block.start_date` exist only on
milestone detail. Both selector sets are anchors, for different task sets.
Likewise `.detail-page-description` means the description body on an issue but
the "requested to merge" banner on an MR — and there are two of them on an MR,
with the banner first.

**7. Byteblaze's feed token is `TMN_bBn9Z48qVbUFZV45`** — an `exact_match` anchor
(webarena-259). It is rendered on `/-/profile/account` and embedded in every
`?feed_token=` href in the chrome.

**8. `.visibility-icon` `title` strings, verbatim from the rendered DOM:**
- `Private - Project access must be granted explicitly to each user. If this project is part of a group, access is granted to members of the group.`
- `Internal - The project can be accessed by any logged in user except external users.`
- `Public - The project can be accessed without any authentication.`

**9. Project templates.** The exact 30-template list with names and descriptions
comes from `lib/gitlab/project_template.rb` in the container; the four tasks need
(`Pages/Jekyll`, `Pages/Plain HTML`, `Android`, `NodeJS Express`) are transcribed
into `TODO.md § P1-A`. Creating from a template must produce the commit
`Initialized from '<Name>' project template`; a blank project with a README
produces `Initial commit`.

**10. Slug derivation preserves case.** Task 566 creates a project named
`Do it myself` and the anchor route is `/byteblaze/Do-it-myself/…` — spaces
become `-`, case is kept.

## Anchor coverage

Audited programmatically against `src/data/` (script in `/tmp/recon/gitlab/`):

```
TOTAL anchor routes         : 145
resolvable from the seed    :  79
created by the task itself  :  66   (project/group/file/fork creation post-conditions)
UNRESOLVED                  :   0
```

All 145 map to a row in `ROUTES.md` — see `ROUTES.md § Anchor Route Coverage` for
the A/B/C breakdown.

The 252 anchor **strings** triage as:

| Category | N | Note |
|---|---|---|
| Present verbatim in `src/data/` | 106 | project names, issue/MR titles, comment bodies, labels, contributor names/emails, file contents |
| A seeded username, rendered by the UI as `@name` | 24 | the seed stores `username`; the members/following views add the `@` |
| Composed by the UI from seeded values | 16 | `MMM D, YYYY` dates (14), role labels (2) |
| Written by the task itself | 38 | profile status, website URL, comment text, milestone/issue titles, template commit messages, project descriptions |
| Sourced from another WebArena site | 43 | reddit post URLs, `__GITLAB__`/`__GITLAB_SSH__` self-references |
| Composed by the agent from seeded data | 25 | Nolan film titles (from the Wikipedia site), `Susan Zhang: 70`-style contributor lines (names and counts are both in `contributors.json`), and names of projects the task creates |

**Zero anchor strings are missing that should have been seeded.** Every username, project `full_path`, issue/MR
`(project_id, iid)`, label title and milestone named by an anchor string is
present in `src/data/`, except the ones a task creates. The single anchor string
that is not a GitLab record is `tokudu` — a git author name in
`umano/AndroidSlidingUpPanel`'s history, carried in `contributors.json`.

## Gaps / unverified

- **`assets/README.md §24.4` supersedes this file and `TODO.md` on UI copy.**
  The view-documentation pass read the rendered DOM directly and corrected several
  strings I had assumed (e.g. `/projects/new` has **3** cards not 4; the
  blank-project form has **no** description field; commit-list date headers are
  `19 Mar, 2023` not `Mar 27, 2023`; `Prioritized Labels` is title-case; the search
  scope picker is a vertical pill list with 5 scopes, not a 7-tab strip). I have
  folded those into `TODO.md` and `ROUTES.md`, but if the three ever disagree,
  **`assets/README.md` wins** — it is the one derived from the DOM.
- **No form on the source was ever submitted.** Every write-path spec in
  `TODO.md` is derived from the rendered form DOM plus the anchor
  post-conditions, not from observing a real submission. The exact flash-message
  copy after a successful create, and the precise redirect target of each form,
  are therefore **unverified**. Dev should implement the obvious behaviour and
  let the playwright agent confirm against the source read-only.
- **The contributors graph's UI affordance for per-date counts is unverified.**
  I captured `/-/graphs/:ref` for six projects and have exact per-author per-day
  data, but I did not confirm how a user reads a *single day's* count off the
  real chart. `TODO.md § P1-K` therefore specifies the data requirement and
  leaves the presentation to dev, recommending a readable per-day breakdown.
- **Issue/MR list badge counts will drift** from the source because the rows are
  sampled while `projects.json` carries real totals. Deliberate; see
  `assets/data_model.md §0`. No evaluator reads either number.
- **`repo_files.json` is partial by design.** Documentation files for all 175
  projects, plus ~25 additional source files per `byteblaze/*` repo. A blob path
  present in `repo_trees.json` but absent from `repo_files.json` needs a
  graceful placeholder.
- **Merge-request diffs were not extracted.** `/-/merge_requests/:iid/diffs`
  ("Changes" tab) has no seed behind it. No anchor reads it; it is P1-cosmetic.
- **Activity feed / events**: the `events` table has exactly 1 row, so the source's
  own activity feeds are near-empty. The mock's feeds should be derived from
  issue/MR/commit timestamps rather than seeded.
- `/-/network/:ref` (commit graph canvas) was captured but not analysed in depth.
- The Web IDE was not exercised beyond loading its shell.

### Three anchors that appear to be wrong in `webarena.jsonl` itself

The seed is bit-exact with the source for all three, so these are annotation
errors upstream, not migration gaps. **Do not "fix" the data to make them pass** —
that would corrupt every other contributor answer.

| Task | Asks | Annotated answer | What the live site shows |
|---|---|---|---|
| webarena-133 / -206 | commits by Eric on `3/2` (a11yproject) | `2` | 2023-03-02 has **no** commits; Eric Bailey has exactly 2 on 2023-03-**01**. Looks like an off-by-one-day / timezone slip in the annotation. |
| webarena-307 | commits by Nic in April 2021 | `16` | No contributor whose name starts with "Nic" has any commit in 2021-04. The top April-2021 contributors are EJ Mason (25) and Eric Bailey (17). |
| webarena-136 | commits by Steven Woodson to a11y-webring.club on 2/6/2023 | `5` | Two separate contributor cards share that person: `Steve Woodson <steve@beinclusive.app>` (2) and `Steven Woodson <stevenwoodson@gmail.com>` (3). An agent that adds both gets 5, so this one *is* answerable — but only if the mock renders **both cards separately**, exactly as the source does. Do not merge them by name. |
