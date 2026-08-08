# DEV — r3-seed (shard A): BUG-A02, per-path last commit

> Scope: close the real seed gap behind the blank `Last commit` / `Last update`
> cells in the repository file tree. Extract the mapping from the container,
> land it as static reference data, wire the tree and blob views to it.
>
> Build: **PASS** (`npm run build`, 2.9 s)
> Files touched: `src/data/tree_last_commits.json` (new),
> `src/pages/RepoTree.jsx`, `src/pages/RepoBlob.jsx`, `assets/data_model.md`,
> `assets/dumps/tree_last_commits/` (new). Nothing outside the owned set.

---

## 1. Extraction

The previous agent's finding was correct: no commit→path mapping exists anywhere
in the seed or in `assets/dumps/`. The real site resolves these cells at runtime
from `/-/refs/<ref>/logs_tree`, so the mapping had to come out of the container's
git repositories.

**Method** — read-only `docker exec`, no writes of any kind:

1. One SELECT for the repository disk paths:
   ```sql
   SELECT r.path, pr.disk_path FROM routes r
     JOIN project_repositories pr ON pr.project_id = r.source_id
    WHERE r.source_type = 'Project';
   ```
   175/175 projects resolved to `@hashed/xx/yy/<sha256>.git` under
   `/var/opt/gitlab/git-data/repositories/`.
2. `git log -1 --format='%H %an %ae %aI %cI %s' <ref> -- <path>` per tree path —
   the same query GitLab's own `logs_tree` answers, so the semantics (history
   simplification, merge handling) are identical by construction rather than by
   approximation. `git -c safe.directory='*'` is required: the repos are owned by
   `git` and `docker exec` runs as root; the flag is in-memory, nothing is
   written to any gitconfig.
3. Work list fed to `bash -s` on **stdin** with `xargs -P12`, so no temp file is
   ever copied into the container. 3 435 paths in **10 s**.

Paths queried = every blob in `repo_trees.json` **plus every derived directory
prefix**, because the tree view synthesises directory rows by splitting blob
paths on `/`, and those rows need a last commit too.

**One extraction subtlety worth recording.** Seven paths in `repo_trees.json` are
stored in git's C-quoted form, escapes and surrounding quotes included —
`"data/members/Luce Carevi\304\207.json"`, `"皮肤制作教程.md"`. They are decoded
for the `git log` query and stored back under the **raw** key, because the raw
string is what the tree component looks up. (The quoting itself is a pre-existing
`repo_trees.json` artifact — it makes the UI render a directory literally named
`"data`. Not re-extracted, per scope.)

Scripts: `assets/dumps/tree_last_commits/build_tree_last_commits.py` +
`container_lastcommit.sh`. Re-running reproduces the shipped file **byte for
byte**.

## 2. The seed — `src/data/tree_last_commits.json`

| | |
|---|---|
| Projects covered | **173 / 173** that have a `repo_trees.json` entry |
| Paths | **3 435** (3 131 blobs + 304 derived directories) |
| Distinct commits | **1 721** |
| Unresolved paths | **0** |
| Size | **369 KB** (377 380 bytes) |

```jsonc
"byteblaze/dotfiles": {
  "ref": "main",
  "commits": [  // [sha, title, author_name, author_email, committed_date, authored_date?]
    ["2e96e2a9ed0b0740fbbf8ead2535a31d453c2ed2", "Remove atom config settings",
     "Eric Bailey", "eric.w.bailey@gmail.com", "2019-11-03T17:34:32-05:00"]
  ],
  "paths": { ".mackup": 0 }
}
```

Kept lean three ways: commits are deduplicated per project and referenced by
index (3 435 paths → 1 721 records); only the fields the tree row and the blob
commit well actually render are stored; `authored_date` is present only for the
497 commits where it differs from `committed_date`.

**It is STATIC reference data.** Imported directly by `src/pages/RepoTree.jsx`,
never by `createInitialData()` — same treatment as `commits.json` /
`repo_trees.json`. Confirmed against the running server: `/go?sid=…` shows
`state_diff {}` after a tree page load and no `tree_last_commits` key anywhere in
`current_state`. The ~2.9 MB session payload is unchanged.

The two projects with a repository but no `repo_trees.json` entry
(`gitlab-instance-58545a48/Monitoring`, `root/sample-gitlab`) are excluded
because there are no tree rows to fill. **No project was skipped for lack of
data — nothing was left empty and nothing was invented.**

## 3. Wiring

`getTreeLastCommit(state, project, ref, path, entry)` — exported from
`RepoTree.jsx`, used by `TreeTable` (which `ProjectOverview.jsx` also renders, so
the project home page picked this up without touching that file) and by
`RepoBlob.jsx`.

Markup copied from `assets/html/proj-dotfiles-tree-main.html`:

```html
<td class="… tree-commit cursor-default gl-text-secondary">
  <a title="…" href="/<project>/-/commit/<sha>"
     class="gl-link str-truncated-100 tree-commit-link gl-text-secondary">…</a> <div></div></td>
<td class="tree-time-ago text-right … gl-text-secondary"><time …>6 years ago</time></td>
```

plus the source's `<th id="name|last-commit|last-update" scope="col">`, the
`aria-label="Files, directories, and submodules in the path / for commit
reference main"` and `aria-live="polite"` on the table.

Three behaviours were **verified against the live source** rather than assumed —
two of them contradicted my first guess:

| Behaviour | Source | Wired as |
|---|---|---|
| Tree page banner in a **subdirectory** | `/byteblaze/dotfiles/-/tree/main/.mackup` shows `2e96e2a9 Remove atom config settings`, not the repo tip | banner uses the directory's last commit; root still uses the tip |
| Blob **commit well** | `/byteblaze/dotfiles/-/blob/main/.gitignore` shows `6543937b`, tip is `218b5e72` | the path's last commit |
| Blob **Permalink** | same page pins **`218b5e72`** — the ref's tip, *not* the path's commit | reverted to the tip (I had it wrong first, on a page where the two happened to coincide) |

**Commit-title truncation.** GitLab's `Commit#title` truncates at 100 chars on a
word boundary — a11yproject.com's tip renders as `Update...`. That applies to the
last-commit **well** and the blob well, but **not** to tree rows: a11y-webring's
`functions` row renders all 145 characters. Implemented as `commitTitle()` and
applied only where the source applies it.

**Session-created files.** `writeFiles` stamps a new tree entry with the creating
commit's short sha, so `getTreeLastCommit` matches it against
`state.repo.commitOverlay` and returns that real record. Verified end to end
through the mock's own new-file form: the new row renders
`R3SEED.md | Add R3SEED.md | just now`.

## 4. Differential verification

Live source (`:8023`) vs mock (`:5221`), 17 tree/blob pages, comparing commit
title + relative time + commit href per row:

```
TOTAL source rows 236 | matched 189 | differing 3 | left blank BY THE SOURCE 10
                      | absent from the mock's tree sample 34
```

Per page: `empathy-prompts` 25/25, `ericwbailey.website` 19/19, `primer/design`
20/20, `awesome-python` 11/11, `a11y-webring.club` 25/25, `a11yproject.com`
23/23, `metaseq` 19/19, `dotfiles` 25/25 (root) and 2/2 (`/.mackup`), blob wells
and permalinks on `dotfiles/.gitignore` + `a11yproject/README.md` exact.

The 10 "blank" rows are blank **on the source**: GitLab fetches `logs_tree` in
batches of 25 and the later rows are still empty at load. The mock fills them
immediately, which is a superset, not a mismatch.

## 5. Findings for other owners (files I do not own)

**F1 — `timeAgo()` rounds years differently from the source. `src/utils/format.js`.**
All 3 remaining row differences are this, and only this — identical sha, identical
title, identical timestamp:

```
bin  src ('Allow overriding the sample app database config (#2181)', '4 years ago', 2022-08-08T11:58:01+01:00)
     mock(                     …same title…                       , '3 years ago', same instant)
```

`format.js` uses a 365.2425-day year with `Math.floor` (`31556952` s). GitLab
uses timeago.js, whose chain is `[60, 60, 24, 7, 365/7/12, 12]` — an effective
**365-day** year. 2022-08-08 → today is exactly 1460 days: `/365 = 4.0` → "4
years ago"; `/365.2425 = 3.997` → "3 years ago". Port:

```js
const SEC = [60, 60, 24, 7, 365 / 7 / 12, 12]
let d = secs, i = 0
for (; i < SEC.length && d >= SEC[i]; i++) d /= SEC[i]
// unit = ['second','minute','hour','day','week','month','year'][i], n = Math.floor(d)
```

This affects every relative timestamp on the site, not just these columns, which
is why I left it to the owner of `format.js`.

**F2 — `.d-none` is a permanent hide; `src/styles/global.css` has no media queries.**
`global.css:475` defines `.hidden, .d-none { display: none !important }` and the
file contains **zero** `@media` blocks, so none of the `d-sm-*` counterparts
exist. Consequence: `RepoBlob`'s `info-well d-none d-sm-block` — the entire blob
commit well — was invisible at every viewport width, as was its
`commit-sha-group d-none d-sm-flex`. I dropped the `d-none` in my two files so
the well renders (the source markup is otherwise preserved), but the real fix is
the responsive utilities:

```css
@media (min-width: 576px) {
  .d-sm-block { display: block !important }
  .d-sm-flex { display: flex !important }
  .d-sm-table-cell { display: table-cell !important }
  .d-sm-inline-block { display: inline-block !important }
}
```

`grep -rn 'd-none' src/` will show the other affected views. Also missing:
`.text-right` (only `.gl-text-right` exists — I emit both) and
`.gl-table-layout-fixed`, whose absence is why the mock's `Last commit` column
starts further right than the source's.

**F3 — `repo_trees.json` is a truncated sample (~60 entries/project).** Not a
regression and explicitly out of scope, but it is why 34 source rows have no
mock row at all: `empathy-prompts/src` shows 25 source entries vs 1 in the mock,
`csvkit` 15 vs 11, `administrate` 32 vs 30. Every path the mock *does* have is
now filled; deepening the tree sample is a separate seed job.

## 6. Known limits of this seed (documented, not hidden)

- **Default ref only.** A tree page on a non-default branch reuses the default
  ref's last-commits. That is deliberate: `getRepoTree` and `getCommits` are
  themselves ref-agnostic and already serve the default-branch tree for every
  ref, so pairing those rows with another branch's commits would be strictly
  less coherent. Per-ref extraction only becomes meaningful once `repo_trees.json`
  is per-ref.
- **`title` attribute is the subject, not the full message.** The source puts the
  whole commit message in the tooltip; storing `%B` for 1 721 commits was not
  worth the bytes for a non-rendered attribute.
- **No GFM in the tree cell.** The source renders `#328` in a commit title as an
  issue link; the mock renders the same characters as plain text.
- **No GPG badge.** The source's last-commit well shows `Unverified` next to the
  sha; the mock has no signature data. Pre-existing, unrelated to this seed.
