# webarena_gitlab_mock — Data Model

> Extracted from container `gitlab` (`gitlabhq_production`, Postgres) and from the
> Gitaly repositories on disk, read-only, on 2026-08-07.
> Every id, iid, path, username, slug, SHA, timestamp and label colour below is
> **real** — copied verbatim from the source. Nothing was regenerated.

## 0. How the seed was sampled

| Source scale | Seeded | Why |
|---|---|---|
| 175 projects | **all 175** | The catalogue is small enough to keep whole; `/explore` paginates it and 9 tasks fork from it. Dropping any project breaks a fork task or an `/explore` count. |
| 2 399 users | **1 133** | Everyone referenced by a seeded issue/MR/note/member/star/follow/todo, plus every namespace owner that holds a project, plus every username named in an anchor string. |
| 2 groups | **both** | `GitLab Instance` + `robert1003`. The five groups anchors name (`coding_friends`, `crew`, `n-lab`, `webagent`, `x-lab`) **do not exist in the source** — tasks 799–803 create them. |
| 80 962 issues | **613** | ~22 per anchor-heavy project (open + closed), ~8 elsewhere. All 10 anchored issues forced in by `(project_id, iid)` before sampling. |
| 134 338 merge requests | **729** | Same shape, 16/6. All 8 anchored MRs forced in. |
| 303 407 notes | **1 773** | Whole thread for an anchored issue/MR (head 4 + tail 12 when long); 3 non-system notes elsewhere. The tail matters: evaluators read `#notes-list` `lastElementChild`. |
| 1 753 labels | **630** | Every label belonging to a seeded project, plus every label a seeded issue/MR links to. |
| 545 milestones | **202** | Every milestone of a seeded project. |
| 183 members | **all 183** | Tiny, and 20 tasks read `/-/project_members`. |
| 2 218 stars | **569** | All of byteblaze's, plus 6 per project so `/-/starrers` is populated. `projects.star_count` keeps the **real** total. |
| 5 follows | **all 5** | Anchors read `/users/byteblaze/following`. |
| 2 338 todos | **7** (byteblaze's) | Only byteblaze's `/dashboard/todos` is reachable. |

**Known, deliberate drift.** `projects.json` carries the *real* source counts
(`open_issues_count`, `open_mrs_count`, `star_count`, `commit_count`) while the
seeded rows are a sample. Render list badges from the **seed**, not from these
fields, so the page is internally consistent; keep the real fields for the
project-overview panel where GitLab shows a headline number. No evaluator reads
either number.

Total seed: **5.0 MB across 20 JSON modules**, of which only the 12 mutable ones
(**1.97 MB minified**) go into `createInitialData()`; the 8 git/reference modules
stay static. See §11 and §12 — and §12.1 for the round-4 field trim that took the
mutable tier from 2.14 MB to 1.95 MB, before round 5's `merged_at` backfill
(§5.1) put 0.03 MB of it back.

---

## 1. `projects.json` — 175 rows

```jsonc
{
  "id": 193,
  "full_path": "byteblaze/dotfiles",          // the URL path; NEVER regenerate
  "path": "dotfiles",
  "name": "dotfiles",
  "namespace": { "id": 2505, "path": "byteblaze", "name": "Byte Blaze", "kind": "user" },
  "description": "🤖 Computer setup",
  "visibility": "public",                      // private | internal | public
  "star_count": 0,
  "forks_count": 0,
  "archived": false,
  "created_at": "2023-03-27T20:37:47.216479",
  "last_activity_at": "2023-03-27T20:37:47.216479",
  "default_branch": "main",                    // from git symbolic-ref HEAD
  "commit_count": 24,
  "repo_size": 105315,
  "open_issues_count": 3, "closed_issues_count": 0,
  "open_mrs_count": 0, "merged_mrs_count": 0, "closed_mrs_count": 0
}
```

`visibility` drives the `.visibility-icon` `title` attribute an evaluator reads
(webarena-742…745): `private` → **"Private - Project access must be granted explicitly to each user."**,
`internal` → **"Internal - The project can be accessed by any logged in user except external users."**,
`public` → **"Public - The project can be accessed without any authentication."**

Not every project's default branch is `main`. Real values in the seed include
`main`, `master`, `develop`. `/dehenne/awesome-visibility/-/graphs/master` and
`/byteblaze/cloud-to-butt/-/blob/master/LICENSE.txt` are anchors that depend on
this being right — read `default_branch`, never assume.

## 2. `users.json` — 1 133 rows

```jsonc
{
  "id": 2330, "username": "byteblaze", "name": "Byte Blaze",
  "email": "ericwbailey@fakegithub.com",
  "state": "active", "created_at": "2023-03-23T07:30:04.033203",
  "location": "Boston, MA", "organization": "@github",
  "bio": "Inclusive design and accessibility advocate. Accessibility and design systems wonk for @primer.",
  "followers": 0, "following": 5,
  "feed_token": "TMN_bBn9Z48qVbUFZV45",   // byteblaze only — ANCHOR (webarena-259)
  "status": null                           // set by tasks 418–422; see below
}
```

> **`admin` was dropped in round 4** (§12.1). It was `false` for 1 132 of the
> 1 133 rows, had zero readers, and cost 17.7 KB of every POSTed state. There is
> no admin surface in the mock, so nothing can consume it.

Empty-string fields are omitted from the JSON to save space — treat a missing key
as `""`.

**byteblaze is the logged-in user (id 2330).** The app boots as this user.
`website_url` is empty in the source; tasks 448–452 set it via `/-/profile` and
the evaluator reads `.profile-header [itemprop="url"]` on `/byteblaze`, expecting
exactly `egg.tart.com` / `helloworld.xyz` / `a11yproject.contributor.me` /
`www.byteblaze.com` / `byteblaze.github.io`. Render the value **verbatim**, with
no `https://` prefix added.

`status` is `null` for everyone — `user_statuses` is **empty in the source**.
Tasks 418–422 set it through the "Set status" modal; the evaluator reads
`.cover-status` `lastChild.textContent` and expects exactly `Cruising`,
`Enjoying life`, `Playing Badminton`, `Resting due to leg injury`,
`Out of Office`. Shape when set: `{ "emoji": "speech_balloon", "message": "Cruising", "availability": "not_set" }`.

## 3. `groups.json` — 2 rows

```jsonc
{ "id": 6, "path": "robert1003", "name": "robert1003", "description": "", "visibility": "public" }
```

`gitlab-instance-58545a48` ("GitLab Instance", id 2) is the self-monitoring group.
Group creation must append here with a fresh id.

## 4. `issues.json` — 613 rows

```jsonc
{
  "id": 83395, "iid": 719, "project_id": 174,
  "title": "Rethink the homepage's content",
  "description": "…markdown…",
  "author_id": 2295, "state": "closed",          // opened | closed
  "confidential": false, "due_date": null, "milestone_id": null,
  "assignee_ids": [2330], "label_ids": [1755, 1761],
  "created_at": "…", "updated_at": "…",
  "closed_at": null, "closed_by_id": null,       // always null in the seed — §4.1
  "upvotes": 0, "user_notes_count": 4
}
```

`iid` is the per-project number shown as `#719` and used in the URL. `id` is
global and is what `notes.noteable_id`, `label_links.target_id` and
`todos.target_id` point at. **Both must be preserved.**

Anchored issues that must exist, by `(project_id, iid)`:
`(174,719) (174,566) (174,1517) (174,1478) (183,8) (183,18) (186,1) (179,71) (180,316) (180,104)`.

### 4.1 Gaps / unverified — no issue close date exists to extract

`closed_at` and `closed_by_id` are `null` on all 613 rows, including the 326 in
`closed` state. **This is what the source contains**, re-checked directly
against Postgres in round 5, not a sampling shortcut:

```
SELECT count(*), count(closed_at), count(closed_by_id) FROM issues;
--  80962 |  1 |  1
```

One row in 80 962 (`issues.id = 18`, project 3) has the column set; the snapshot
was bulk-imported and the importer never wrote it. That row is not among the 613
sampled, and re-sampling to reach it would swap out an anchored issue, so the
fields stay null. **No timestamp was synthesised** — `closed_at` on a
bulk-imported issue is unknowable, and a plausible-looking value would order
`?sort=closed_at` confidently and wrongly.

Consequence: `?sort=closed_at` / `closed_at_desc` on an issue list is inert
against the seed and falls through to the `id DESC` tie-break. The source
degenerates the same way (`order_closed_at_asc` is
`reorder(closed_at.asc.nulls_last)` with no tie-break, so Postgres picks an
arbitrary order for the all-NULL set). The columns are kept on the row because
the close flows in `IssueDetail.jsx`, `NotesTimeline.jsx` and `IssuablesList.jsx`
write both when a task closes an issue — and those rows *do* then sort correctly.

## 5. `merge_requests.json` — 729 rows

```jsonc
{
  "id": 89216, "iid": 450, "project_id": 180, "source_project_id": 180,
  "title": "Octovisuals Page", "description": "…",
  "author_id": 2166, "state": "opened",          // opened | closed | merged | locked
  "draft": false,
  "source_branch": "octovisuals-page", "target_branch": "main",
  "milestone_id": null, "merge_status": "can_be_merged",
  "assignee_ids": [], "reviewer_ids": [2330], "label_ids": [],
  "created_at": "…", "updated_at": "…",
  "merged_at": "2023-01-16 23:22:46",            // null unless state == "merged"
  "merged_by_id": 2330,                          // null where the source has none
  "user_notes_count": 3, "squash": false
}
```

`source_branch` / `target_branch` render as the two `a.gl-font-monospace` chips
inside `.detail-page-description`; evaluators index them `[0]` (source) and
`[1]` (target) — tasks 666, 667, 668, 806. Keep that DOM order.

### 5.1 `merged_at` / `merged_by_id` — round-5 backfill

Added in round 5 so `?sort=merged_at[_asc|_desc]` has something to order. **Not
on the source's `merge_requests` table** — GitLab keeps the merge timestamp on
`merge_request_metrics` and `MergeRequest.order_by_metric(:merged_at, …)` joins
it (`app/models/merge_request.rb:360`). The mock has no metrics table, so the two
columns are denormalised onto the MR row.

| | rows |
|---|---|
| seeded MRs | 729 |
| `merged` state | 314 |
| `merged_at` populated | **286** — every one of them `merged` |
| `merged_by_id` populated | **210** (76 metrics rows carry `merged_at` but no `merged_by_id`) |
| `merged` but `merged_at` NULL | 28 — no `merge_request_metrics` row at the source |
| `closed_at` populated | **0** — see §5.2 |

All 18 distinct `merged_by_id` values resolve inside `users.json`. Ordering was
verified row-for-row against
`ORDER BY merge_request_metrics.merged_at <dir> NULLS LAST` on the source DB.

### 5.2 Gaps / unverified — no MR close date exists to extract

There is deliberately **no `closed_at` on an MR seed row.** GitLab reads the MR
close date from `merge_request_metrics.latest_closed_at`
(`order_closed_at_asc`), and that column is populated on **1 row in 134 338**
across the entire source DB — none of them among the 729 sampled. The snapshot
was bulk-imported and never wrote it. The field is therefore absent rather than
invented; `?sort=closed_at` on an MR list falls through to the `id DESC`
tie-break, which is what the source does too.

The mock's own close handlers (`IssuablesList.jsx`, `MergeRequestDetail.jsx`) do
write a real `closed_at` on rows closed in-session, and those order correctly
ahead of the untouched rows.

One further source quirk is **not** reproduced: `join_metrics` is an INNER join,
so on the real GitLab `?sort=merged_at` silently drops every MR with no metrics
row (238 of the 729 sampled). The mock keeps them and sorts them nulls-last. A
sort that changes the row *count* reads as a bug to an agent; nulls-last is the
more defensible behaviour. Logged here so the deviation is on the record.

Anchored MRs by `(project_id, iid)`:
`(174,1071) (174,1265) (174,1270) (174,1485) (174,1531) (180,450) (183,19) (179,40)`.

## 6. `notes.json` — 1 599 rows

```jsonc
{
  "id": 305750, "noteable_type": "Issue",       // Issue | MergeRequest
  "noteable_id": 83681, "project_id": 174, "author_id": 2338,
  "body": "…markdown…", "system": false,
  "created_at": "…", "updated_at": "…"
}
```

> **Four fields were dropped in round 4** (§12.1) — `discussion_id`, `type`,
> `resolved_at`, `resolved_by_id`. Together they were 189 KB, a quarter of the
> module, and none had a single reader: `resolved_at` and `resolved_by_id` were
> `null` in all 1 599 rows, `type` was `null` in 1 459, and `discussion_id` is a
> git hash that is never rendered. The mock has no thread-resolution or diff-note
> surface for them to back. **They are not anchors** — no anchor string, route or
> locator was present in any of the removed values (checked against all 252
> strings / 145 routes / 26 locators in `assets/task_anchors.json`).
>
> `src/pages/NotesTimeline.jsx` still *writes* `discussion_id`, `resolved_at` and
> `resolved_by_id` on notes it creates. Harmless — an added record ships whole in
> the diff — but they should be dropped from the write too, so a created note and
> a seeded note have the same shape.

`system: true` notes are the grey activity lines ("changed title", "assigned to
@x"). Render them in the timeline with the system styling, not as comments, and
exclude them from `user_notes_count`.

New comments append here. Four tasks (390–393) post a comment and the evaluator
runs `document.querySelector('[id="notes-list"]').lastElementChild
.querySelector('.timeline-discussion-body').outerText`, expecting exactly `lgtm`,
`close because non reproducible`, `Good idea`, `Thank you`. So a newly posted
comment must be the **last** child of `#notes-list` and its body must live inside
`.timeline-discussion-body`.

## 7. `labels.json` — 630 rows

```jsonc
{ "id": 1755, "project_id": 174, "title": "enhancement",
  "color": "#5CB85C", "description": "", "created_at": "…" }
```

Titles are matched verbatim by `?label_name[]=`. Several contain spaces, colons
and emoji — e.g. `help wanted`, `flaky-test`, `OpenAPI Generator CLI`,
`type: bug 🐞`. A title containing `::` is a **scoped label** and renders as the
two-tone pill described in `DESIGN.md §5`.

`?label_name[]=None` (webarena-343) is not a label — it means "issues with no
label at all".

## 8. `milestones.json` — 202 rows

```jsonc
{ "id": 89, "iid": 6, "project_id": 174, "title": "2019 Replatforming",
  "description": "…", "state": "active",        // active | closed
  "due_date": "2019-08-01", "start_date": "2019-05-01",
  "created_at": "…", "updated_at": "…" }
```

Tasks 590–594 create milestones and read back `#content-body`,
`.block.start_date`, `.block.due_date` on the detail page. Dates must render in
GitLab's format: **`Jan 16, 2030`** (`MMM D, YYYY`, no leading zero on the day).

## 9. `members.json` — 183 rows

```jsonc
{ "id": 501, "source_type": "project",          // project | namespace(group)
  "source_id": 184, "user_id": 168,
  "access_level": 30, "access_label": "Developer",
  "created_at": "…", "expires_at": null, "created_by_id": 2330 }
```

`access_level` → label mapping (this exact wording is what the evaluator helper
`gitlab_get_project_memeber_role` reads out of the Max-role cell):

| level | label |
|---|---|
| 5 | Minimal Access |
| 10 | Guest |
| 20 | Reporter |
| 30 | Developer |
| 40 | Maintainer |
| 50 | Owner |

Adding a member is a P0 write path: 20 tasks add a user at a named role and the
evaluator reads that user's row back.

## 10. `stars.json` / `follows.json` / `todos.json`

```jsonc
// stars.json  (569)
{ "project_id": 122, "user_id": 2330, "created_at": "…" }
// follows.json (5) — byteblaze follows exactly these
{ "follower_id": 2330, "followee_id": 168 }
// todos.json (7)
{ "id": 2970, "user_id": 2330, "project_id": 174, "target_id": 83681,
  "target_type": "Issue", "author_id": 2295, "action": 2, "state": "pending",
  "created_at": "…", "group_id": null }
```

`/users/byteblaze/starred` is an anchor (tasks 523–527) and must list
`create-react-app`, `ffmpeg-python`, `AndroidAsync`, `AndroidSlidingUpPanel`,
`PHP_XLSXWriter`, `administrate`, `keycloak`, `Pytorch-GAN` — verify these are
in byteblaze's star rows before shipping.

`/users/byteblaze/following` must render `@yjlou`, `@convexegg`, `@koush`,
`@vinta`, `@lahwaacz`, `@bblanchon`, `@ghost`, `@R1kk3r`, `@abisubramanya27` per
the anchor table — the source has only 5 follow rows, so **the remainder are
added by the tasks themselves** (follow-a-user flow). Both directions must work.

`todos.action`: `1` assigned, `2` mentioned, `3` build_failed, `4` marked,
`5` approval_required, `7` directly_addressed, `8` merge_train_removed.

## 11. Git-derived modules

### `branches.json` — keyed by `full_path`
```jsonc
"byteblaze/dotfiles": [
  { "name": "main", "sha": "a5b2c1d0", "committed_date": "2023-03-27T20:37:47+00:00",
    "subject": "Add zsh config" }, …up to 40, newest first
]
```

### `tags.json` — same shape, deep projects only.

### `commits.json` — keyed by `full_path`
```jsonc
"a11yproject/a11yproject.com": {
  "ref": "main",
  "list": [
    { "sha": "ed37a2f2f0070d24e9e30f06672ceb27d740fb30",
      "author_name": "Eric Bailey", "author_email": "ericwbailey@users.noreply.github.com",
      "authored_date": "2023-03-13T21:04:49-04:00",
      "committed_date": "2023-03-13T21:04:49-04:00",
      "title": "Update the-power-of-chatgpt-…" }, …40 newest
  ]
}
```
40 commits for deep projects, 10 elsewhere. Short SHA displayed = first 8 chars.

### `contributors.json` — **the highest-value module in the seed**
```jsonc
"root/metaseq": {
  "main": {
    "total": 272,
    "authors": [
      { "name": "Susan Zhang", "email": "suchenzang@users.noreply.github.com",
        "commits": 70, "daily": { "2022-05-03": 2, "2022-05-04": 1, … } },
      { "name": "Stephen Roller", "email": "roller@fb.com", "commits": 51, "daily": {…} },
      { "name": "Peter Albert",  "email": "…", "commits": 12, "daily": {…} }
    ]
  }
}
```
Keyed by `full_path` → ref → aggregate, authors sorted by descending commit count.

**How this was computed — reproduce it exactly, this is not `git shortlog`.**
`Projects::GraphsController#show` (read from the container) does
`repository.commits(ref, limit: 6000, skip_merges: true)`, and the Vue component
then groups the result client-side. Four rules, each of which was verified by
diffing against the live `/-/graphs/:ref?format=json` endpoint:

1. **Skip merge commits**, and cap at the **6 000 most recent** —
   `git log <ref> --no-merges -n6000`. The page says so out loud:
   *"Excluding merge commits. Limited to 6,000 commits."*
2. **Group by `author_email`, lowercased** — never by name. One person with two
   emails gets two cards; two names on one email get merged into one.
3. **The displayed name is the name on that email's NEWEST commit** — not the
   most frequent, not the first alphabetically.
4. **Bucket by COMMITTER date (`%cd`), not author date.**

Getting any of these wrong changes the answer. Worked examples where the naive
computation gives the wrong result and this one gives the right one:

| Project | `git shortlog -sne` says | The site (and this seed) says | Anchor |
|---|---|---|---|
| `umano/AndroidSlidingUpPanel` | Anton Lopyrev 123 | **tokudu 150** | webarena-310 `tokudu` |
| `vinta/awesome-python` | Vinta 797 | **Vinta Chen 414** | webarena-786 `414` |
| `eriklindernoren/PyTorch-GAN` | eriklindernoren 68 | **Erik Linder-Norén 85** | webarena-311 |
| `yjlou/2019-nCov` | Yung-Chieh Lo 281 | **Louis Lo 286** | webarena-318 `Lo` |
| `primer/design` | Inayaili León 120 | **Shawn Allen 95** | webarena-308 |
| `wireservice/csvkit` | James McKinney 600 | **Christopher Groskopf 499** | webarena-312 |

Verification standard met: for `a11yproject/a11yproject.com@main` the seed
reproduces the live endpoint's **1 028 (email, date) buckets with zero
mismatches**. The same rule was spot-checked against the rendered page for 11
projects; every top contributor name and count matches.

**Thirteen projects carry the full `daily` map** because a task counts commits by
author and date on them: `a11yproject/a11yproject.com`,
`byteblaze/a11y-webring.club`, `primer/design`, `thoughtbot/administrate`,
`umano/AndroidSlidingUpPanel`, `eriklindernoren/PyTorch-GAN`, `wireservice/csvkit`,
`facebook/create-react-app`, `root/metaseq`, `yjlou/2019-nCov`,
`vinta/awesome-python`, `dehenne/awesome-visibility`, `amwhalen/archive-my-tweets`.
Every other project stores the top 15 authors with counts only.

This single module answers 20 tasks. The exact strings it must be able to yield:
`Shawn Allen`, `Inayaili León`, `Aurora Pleguezuelo`, `Grayson Wright`, `tokudu`,
`Erik Linder-Norén`, `Christopher Groskopf`, `Ian Sutherland`, `Joe Hadda`,
`Dan Abramov`, `Susan Zhang: 70`, `Stephen Roller: 51`, `Peter Albert: 12`,
`Andrew M. Whalen`, `eriklindernoren@live.se`, `eriklindernoren@gmail.com`,
`pinnacle.chen@qq.com`, `github@amwhalen.com`, `414`, `16`, `14`, `5`, `2`, `1`, `0`.
The `/-/graphs/:ref` page is where an agent reads them, so that page must show
per-author commit counts **and** a date-filterable breakdown.

Note `amwhalen/archive-my-tweets` is aggregated on three refs (`php52`, `master`,
`main`) — webarena-788 asks specifically about branch `php52`.

### `repo_trees.json` — keyed by `full_path`
```jsonc
"byteblaze/dotfiles": [
  { "path": "README.md", "type": "blob", "mode": "100644", "size": 1583, "sha": "0f3d1a2b" },
  { "path": "zsh/.zshrc", "type": "blob", "mode": "100644", "size": 4102, "sha": "9c1e…" }
]
```
Flat blob list; the UI derives directories by splitting on `/`. Full recursive
tree for all 12 `byteblaze/*` projects; two levels for the deep set; root level
only for the rest.

### `tree_last_commits.json` — keyed by `full_path` → `paths[path]` → commit

The per-path "last commit" the tree view's **Last commit** / **Last update**
columns render, and the commit the blob page's commit well shows. The real site
resolves this at runtime from `/-/refs/<ref>/logs_tree`; nothing else in the
seed can answer it, because `commits.json` records no file list and
`repo_trees.json` entries carry only `{path, type, mode, size, sha}`. Round 3
closed that gap (BUG-A02).

```jsonc
"byteblaze/dotfiles": {
  "ref": "main",                       // the project's default branch
  "commits": [                         // deduped per project
    // [ sha, title, author_name, author_email, committed_date, authored_date? ]
    ["2e96e2a9ed0b0740fbbf8ead2535a31d453c2ed2", "Remove atom config settings",
     "Eric Bailey", "eric.w.bailey@gmail.com", "2019-11-03T17:34:32-05:00"],
    ["b82a96fb16bfdced9296dc58016773800370b8c5", "Update .bash_profile",
     "Eric Bailey", "ericwbailey@users.noreply.github.com", "2019-11-16T15:43:25-05:00"]
  ],
  "paths": { ".mackup": 0, ".bash_profile": 1 }   // index into `commits`
}
```

The sixth tuple slot, `authored_date`, is present **only when it differs** from
`committed_date` (497 of 1 721 commits); readers fall back to `committed_date`.
Titles are the raw git subject (`%s`) — the tree cell renders them in full, the
commit well applies GitLab's `Commit#title` 100-char truncation.

**Extraction.** `git log -1 --format=… <ref> -- <path>` run inside the `gitlab`
container against the bare repositories under
`/var/opt/gitlab/git-data/repositories/<disk_path>.git`, where `disk_path` comes
from `SELECT r.path, pr.disk_path FROM routes r JOIN project_repositories pr ON
pr.project_id = r.source_id WHERE r.source_type = 'Project'`. Read-only; scripts
in `assets/dumps/tree_last_commits/`.

**Coverage.** All 173 projects that have a `repo_trees.json` entry; 3 435 paths
(every blob plus every derived directory prefix); 1 721 distinct commits; 0
paths unresolved. 369 KB.

**Two deliberate limits, both matching how the rest of the git seed behaves:**

- **Default ref only.** `getRepoTree` / `getCommits` are themselves ref-agnostic
  — they return the default-branch tree for every ref — so the reader reuses
  this table for any ref rather than blanking the columns on a branch switch.
- **Session-created files** are not in it. `getTreeLastCommit` covers them by
  matching the tree entry's short sha against `state.repo.commitOverlay`, which
  `writeFiles` stamps; no invented data either way.

This module is **static reference data**. It is imported directly by
`src/pages/RepoTree.jsx` and never enters `createInitialData()`, exactly like
`commits.json` and `repo_trees.json` (§12).

### `repo_files.json` — keyed by `full_path` → path → text
```jsonc
"byteblaze/gimmiethat.space": {
  "index.html": "<!DOCTYPE html>\n<html>\n<head>\n<title>…",
  "README.md": "…"
}
```
Text blobs ≤ 40 KB. A key of the form `"master:LICENSE.txt"` is a blob on a
**non-default ref** (only `byteblaze/cloud-to-butt` needs this).

`/-/raw/:ref/*path` must serve these as **bare text with no app chrome** — 15
tasks read `…/-/raw/main/README.md` and friends and match on file content.

## 11b. `ci_pipelines.json` — 1 465 pipelines / 14 179 jobs, STATIC reference data

Round 12, TEST.md **DIFF-1105**. Static for exactly the reasons `tree_last_commits.json`
and `merge_request_diffs.json` are: it is historical, **nothing in the app can
mutate it** (this GitLab instance has no runners, so no pipeline is re-runnable
and no job is retryable), and it is 1 037 KB that must not ride in every POSTed
state. It is imported by `src/utils/ci.js` and never by `createInitialData()` —
measured: cold state is **2 069 758 bytes** before and after, unchanged, and
`ci_pipelines.json` contributes **0 bytes** to `/go`.

**Coverage is complete, not sampled.** Every pipeline and every job the source
has: 1 465 rows of `ci_pipelines` and 14 179 of `ci_builds`, across the **67** of
the 175 seeded projects that have any. The other **108 projects genuinely have
none**, and the four CI/CD views render the source's real empty state for them —
`byteblaze/dotfiles`, from which every round-4 CI capture was taken, is one of
those 108, which is how the mock came to show an empty state everywhere.

### Shape

```jsonc
{
  "job_specs": [["build","build",1,false], ["brakeman-sast","test",2,true], …],  // 14 entries
  "statuses":  ["failed","skipped"],
  "_page_size": { "pipelines": 15, "jobs": 30, "jobs_count_cap": 1000 },
  "projects": {
    "<project_id>": [                       // newest first — the source's order
      {
        "id": 1823, "iid": 1,               // ci_pipelines.id / .iid, verbatim
        "ref": "github/fork/davepgreene/add-verification-function",
        "ref_kind": "branch",               // branch | tag | merge_request
        "sha": "4817a445d1b74904bd695059aea63705370f9205",
        "title": "Merge branch 'main' into add-verification-function",
        "author_name": "Dave Greene",
        "author_email": "davepgreene@users.noreply.github.com",
        "status": "failed",                 // failed | skipped — the only two here
        "source": "push",                   // push | merge_request_event
        "created_at": "2023-03-27T20:10:56.069Z",
        "started_at":  "2023-03-27T22:00:06.927Z",
        "finished_at": "2023-03-27T22:00:08.682Z",
        "duration": 0,
        "stages": [["build","failed"], ["test","failed"]],
        "flags":  ["latest","auto_devops"], // + yaml_errors | failure_reason |
                                            //   merge_request | detached_…
        "mr_iid": 65328, "mr_title": "…",   // merge-request pipelines only
        "yaml_errors": "Request timed out…", // the 2 rows that have one
        "jobs": [[16323, 0, 0, 207, 6549492], [16326, 4, 1, 916, null], …]
      }
    ]
  }
}
```

### Two encodings, both lossless for everything these views render

1. **`job_specs`** — the closed 14-entry vocabulary of
   `(name, stage, stage_idx, allow_failure)`. Valid because
   `name -> (stage, stage_idx, allow_failure)` is a **verified functional
   dependency over all 14 179 rows** (zero names violate it). The instance has
   exactly 14 job names and exactly 2 stages (`build` idx 1, `test` idx 2).
2. **Job tuples** `[id, specIdx, statusIdx, createdOffsetMs, finishedOffsetMs]`,
   where both offsets are **milliseconds from the pipeline's own `created_at`**.
   `ci_builds.started_at` is NULL on all 14 179 rows, so no job has a duration
   and the column is not carried; a null `finishedOffsetMs` means the job never
   finished (every `skipped` job).

Real identifiers are verbatim and never regenerated: pipeline ids and iids, job
ids, full commit SHAs, refs, commit titles, author names and emails, and every
timestamp to the millisecond.

### Provenance

`ci_pipelines` / `ci_builds` / `ci_stages` read **SELECT-only** out of the
container, joined with the source's own `/-/pipelines.json?page=N` payload for
the commit titles and the `latest` / `Auto DevOps` / `yaml invalid` flags that
GitLab computes rather than stores. One project — `abisubramanya27/IntrinsicDimensions`,
the only private one with a pipeline — is not visible anonymously over HTTP, so
its single row came from psql plus the existing `commits.json` seed.

---

## 11a. `resource_events.json` — 1 207 rows, STATIC reference data

Not git-derived, but static for the same reason the git modules are: it is
historical, nothing in the app mutates it, and it is 168 KB that must not ride in
every POSTed state.

GitLab has not stored label, milestone or state changes in `notes` since 11.x —
they live in `resource_label_events`, `resource_milestone_events` and
`resource_state_events`, and `ResourceEvents::MergeIntoNotesService` merges them
into the notes list at render time. `notes.json` was dumped from `notes` alone,
so all three kinds were simply missing from the timeline (BUG-B08): the source
shows `Byte Blaze closed 8 years ago` on
`/a11yproject/a11yproject.com/-/issues/566` and the mock showed nothing.

This module is those three tables for the seeded issues and MRs, flattened into
one array with a `kind` discriminator:

```jsonc
[
  { "id": 12856, "kind": "state",     "noteable_type": "Issue", "noteable_id": 15880,
    "user_id": 900,  "action": 2, "created_at": "2013-03-01 12:59:34" },
  { "id": 14385, "kind": "label",     "noteable_type": "Issue", "noteable_id": 26088,
    "user_id": 1842, "action": 1, "created_at": "2014-03-10 20:27:30", "label_id": 1384 },
  { "id": 12668, "kind": "milestone", "noteable_type": "Issue", "noteable_id": 83395,
    "user_id": 2330, "action": 1, "created_at": "2018-12-30 19:42:28", "milestone_id": 586 }
]
```

| `kind` | rows | extra field | `action` |
|---|---|---|---|
| `state` | 688 | — | GitLab's `ResourceStateEvent.state` enum (`1` reopened, `2` closed, `3` merged) |
| `label` | 500 | `label_id` → `labels.id` | `1` add, `2` remove |
| `milestone` | 19 | `milestone_id` → `milestones.id` | `1` add, `2` remove |

Every `user_id`, `label_id` and `milestone_id` already resolves inside the seed —
no dangling reference, nothing invented.

**Wiring (verify by driving, not grepping).** It is imported directly by
`src/pages/NotesTimeline.jsx:10` and merged with `state.notes` by `created_at`
when the timeline renders. It is **not** in `createInitialData()` and must never
be: it is reference data, exactly like `tree_last_commits.json` (§11) and the six
git modules (§12). A round-3 audit reported it unreferenced; that reading was
taken before the timeline shard landed.

---

## 12. `createInitialData()` shape

Measured off `GET /go` on a cold session: **2 063 847 bytes minified (1.968 MB)**.
`SCHEMA.md` is the authoritative field-by-field description; this is the shape.

> Round 5 added `mergeRequests.merged_at` / `.merged_by_id` (§5.1), which cost
> **+31 779 bytes (+0.030 MB)**: 2 032 068 → 2 063 847, measured off `/go` on a
> cold session either side of the backfill. Still inside `WEBARENA_MIGRATION.md
> §4.4`'s ~1–2 MB budget, but the headroom is now ~33 KB — the next field that
> wants to ride in state should displace one, not join it. (The 2 043 078 figure
> above was the round-4 measurement; the 2 032 068 baseline is the same state
> re-measured after round 4's later note edits.)

```js
{
  currentUser: { id: 2330, username: "byteblaze", name: "Byte Blaze", … },
  users: [...],  projects: [...],  groups: [...],
  issues: [...], mergeRequests: [...], notes: [...],
  labels: [...], milestones: [...], members: [...],
  stars: [...],  follows: [...],    todos: [...],
  snippets: [],                       // no snippets in the source; baseline only
  // git OVERLAYS — the six git modules stay static and are NOT copied in here.
  repo: { fileOverlay: {}, treeOverlay: {}, commitOverlay: {},
          branchOverlay: {}, tagOverlay: {}, forkOrigin: {},
          branchDeletions: {}, tagDeletions: {} },
  ui: { notificationLevels: {}, sidebarCollapsed: false,
        dismissedAlerts: [], preferences: { colorScheme, syntaxTheme } },
  // DERIVED at module load as max(seed id)+1 — never literals (PIPELINE-001)
  nextIds: { project: 194, group: 7, issue: 83821, mr: 139278,
             note: 310827, label: 1927, milestone: 590, member: 206 }
}
```

**Static, never in state (11 modules, 4 594 506 B / ~4.38 MB):** `repo_files` `repo_trees`
`commits` `contributors` `branches` `tags` `merge_request_diffs`
`tree_last_commits` `resource_events` `repo_languages` `ci_pipelines`.
The first seven are reached through the `dataManager.js` accessors so the
`repo.*` overlays apply; the rest are imported straight into the page or helper
that renders them (`RepoTree.jsx`, `NotesTimeline.jsx`, `ProjectOverview.jsx`,
`utils/ci.js`).

### 12.1 The round-4 field trim — 2.14 MB → 1.95 MB

`WEBARENA_MIGRATION.md §4.4` budgets `createInitialData()` at ~1–2 MB because the
whole state is POSTed and diffed on every `/go`. The mutable tier was 2.14 MB.

The obvious cut — sampling `notes` down — is **unsafe**: 36 of the 252 anchor
strings occur verbatim inside note bodies. So the trim only removed *fields* with
**no reader in `src/` and no anchor in any value**:

| Field | Saved | Evidence it is dead |
|---|---|---|
| `notes.discussion_id` | 95.3 KB | Written by `NotesTimeline.jsx` on create, read nowhere. Values are git hashes and are never rendered. |
| `notes.resolved_by_id` | 37.5 KB | `null` in 1 599/1 599 rows. No reader. |
| `notes.resolved_at` | 32.8 KB | `null` in 1 599/1 599 rows. No reader. |
| `notes.type` | 23.4 KB | `null` in 1 459/1 599. No reader; no diff-note surface exists. |
| `users.admin` | 17.7 KB | `false` in 1 132/1 133. No reader; no admin surface exists. |
| **total** | **206.7 KB** | |

Verification, on the file bytes before and after: **0 anchor strings, 0 anchor
routes and 0 anchor locators that were present before the cut are absent after**.
Row counts and the full id sequence of both modules are byte-identical.

Everything else was left alone, and deliberately. `mergeRequests.squash` (12.1 KB,
`false` in all 729 rows) *is* read by `EditMergeRequest.jsx`, and
`issues.closed_by_id` / `mergeRequests.closed_by_id` (13.2 KB) are written by the
close flow — a field a shipped mutation writes belongs in the schema even when no
view reads it back yet. `stars.created_at` (24.4 KB) looks like filler and is not:
`Starrers.jsx:80` renders it.

`nextIds` matters: created records must not collide with real ids, and the
evaluator navigates to the created record's URL. New projects take
`full_path = "<namespace>/<slug>"` with the slug derived exactly as GitLab does
(lowercase, spaces and `.`/`_` runs → `-`, strip leading/trailing `-`) — task 566
creates a project literally named `Do it myself` and the anchor route is
`/byteblaze/Do-it-myself/…`, so **the path preserves case and maps spaces to `-`**.

## 13. Referential integrity to preserve

- `issues.project_id` / `merge_requests.project_id` → `projects.id`
- `issues.milestone_id` → `milestones.id` (same project)
- `label_ids` → `labels.id` (same project)
- `notes.noteable_id` → `issues.id` **or** `merge_requests.id` per `noteable_type`
- `members.source_id` → `projects.id` when `source_type == "project"`,
  `groups.id` when `"namespace"`
- `todos.target_id` → `issues.id` / `merge_requests.id` per `target_type`
- every `*_id` user reference resolves in `users.json`
- `commits`/`contributors`/`trees`/`files`/`branches` keys are `full_path`
  strings that exist in `projects.json`

## 14. Sanity checks before shipping

- [ ] Something to search for: `/search?search=dotfiles&scope=projects` returns rows
- [ ] Something to sort: `/explore?sort=stars_desc` reorders visibly
- [ ] Something to paginate: `/explore/projects?page=2` — 175 projects at 20/page = 9 pages
- [ ] A long comment thread: `/a11yproject/a11yproject.com/-/merge_requests/1485`
- [ ] Every anchored `(project_id, iid)` in §4 and §5 resolves
- [ ] `/users/byteblaze/starred` lists all 8 anchor project names
- [ ] `/byteblaze/dotfiles/-/project_members` shows Byte Blaze as **Owner**
- [ ] `/root/metaseq/-/graphs/main` yields `Susan Zhang: 70`
- [ ] `/byteblaze/gimmiethat.space/-/raw/main/index.html` serves bare HTML text
