# DEV.r2-members — Round 2 fix shard 2 of 3 (members + profile)

> Date: 2026-08-07
> Mock verified at: `http://localhost:5214` (dev server; `--port 5212` was taken
> by a concurrent shard and vite fell back)
> Source: `http://localhost:8023` — **read only**. Every source interaction was a
> GET or a modal open. No invite, star, follow, profile edit or `?sort=` URL.
> Build: **PASS** (`vite build`, 157 modules)

## Verdict

7 of 9 assigned findings closed and verified in a real browser. 1 is a
confirmed non-bug. 1 needs a file I do not own.

| Finding | Status |
|---|---|
| BUG-001 (P0) members `<td data-label>` | **CLOSED — verified differentially** |
| BUG-002 (P1) invite modal defaults to Developer | **CLOSED** |
| BUG-B03 / BUG-007 (P1) member `id: null` | **CLOSED** |
| BUG-003 / DIFF-A08 (P1) `__GITLAB_SSH__` | **CLOSED** |
| BUG-A10 (P1) feed token on the wrong page | **CLOSED** |
| BUG-A11 (P2) `/-/profile/account` copy drift | **CLOSED** |
| BUG-B10 (P2) owner-only affordances | **CLOSED** |
| DIFF-A02 (P2) `/byteblaze` Personal projects panel | **CLOSED** (partly already fixed) |
| DIFF-A03 (P2) `/-/starrers` empty | **NOT A BUG — investigated, see below** |
| BUG-006 (P2) new group shows "no permissions" | **BLOCKED — `GroupOverview.jsx` is shard 3's** |
| DIFF-002 (P2) `.user-profile` whitespace | **DELIBERATELY NOT DONE — see below** |

---

## BUG-001 · P0 · members-table `<td data-label>` — CLOSED

`src/pages/MembersTable.jsx`. Added a `COLUMNS` table and a `cellProps(label)`
helper so every `<td>` renders the source's exact attribute set, copied verbatim
out of `assets/html/proj-dotfiles-members.html`:

```
<td aria-colindex="1" data-label="Account"        role="cell" class="">
<td aria-colindex="2" data-label="Source"         role="cell" class="col-meta">
<td aria-colindex="3" data-label="Access granted" role="cell" class="col-meta">
<td aria-colindex="4" data-label="Max role"       role="cell" class="col-max-role">
<td aria-colindex="5" data-label="Expiration"     role="cell" class="col-expiration">
<td aria-colindex="6" data-label="Created on"     role="cell" class="">
<td aria-colindex="7" data-label="Last activity"  role="cell" class="">
<td aria-colindex="8" data-label="Actions"        role="cell" class="col-actions">
```

`<th>`s gained `role="columnheader" scope="col" aria-colindex`, the table gained
`aria-busy="false"` and `aria-colcount`, and rows gained `data-pk`. Group and
project members share this component, so both are fixed.

**Verified by running the evaluator's own lookup** — `td[data-label='Account']
span.gl-avatar-labeled-sublabel` for the row index, then
`td.col-max-role span` at that index — **on the mock and on the live source at
the same three paths**:

| Path | mock | source |
|---|---|---|
| `/byteblaze/dotfiles/-/project_members` (`byteblaze`) | `rows 1, role Owner` | `rows 1, role Owner` |
| `/byteblaze/a11y-webring.club/-/project_members` (`byteblaze`) | `rows 1, role Owner` | `rows 1, role Owner` |
| `/a11yproject/a11yproject.com/-/project_members` (`byteblaze`) | `rows 3, role Maintainer` | `rows 3, role Maintainer` |

Identical on all three, row count included. Also confirmed on freshly invited
members: after inviting `abisubramanya27`, `vinta`, `bblanchon` the helper reads
`Guest` for each. This unblocks webarena-481…485 and 576…579.

## BUG-002 · P1 · invite modal default role — CLOSED

Both role selects now initialise to `10`/`Guest`:
`MembersTable` `useState(10)` and `InviteGroupModal` `useState(10)`.

Verified read-only on the source first — `/byteblaze/dotfiles/-/project_members`,
**Invite members** → `select[data-qa-selector="access_level_dropdown"]` is
`{value: '10', text: 'Guest'}`; **Invite a group** → also `Guest`. Mock now
returns the same for both.

## BUG-B03 / BUG-007 · P1 · members created with `id: null` — CLOSED

Root cause is exactly as shard B diagnosed: `AppContext.allocateId` assigns its
result inside a `setStateRaw` updater and returns the outer variable, which under
React 18 has not been written yet.

Fix stays inside my files rather than touching `src/context/**`: new reducer
**`addMembers(prev, {sourceType, sourceId, rows})`** in
`src/components/create/mutations.js`, alongside `createProject` / `createGroup` /
`forkProject`, which allocate the same way. It reads `prev.nextIds.member`
(**not** a hard-coded constant), skips ids already taken by injected records the
way `allocateId`'s backstop does, and returns the counter bump and every new row
in one object — so a whole multi-invite submit is a single `saveState` and a
single `/go` diff. `invite()` and `ImportMembersModal.run()` now call it through
`setState`.

Verified: invite 3 users in one submit on `/byteblaze/dotfiles/-/project_members`
→ rendered rows `row_206 row_208 row_202 row_207`, unchanged after reload, no
React duplicate-key warning, no console errors. `/go` `state_diff`:

```json
"members": {"added": [{"id": 206, …"access_label": "Guest"},
                      {"id": 207, …}, {"id": 208, …}]}
"nextIds.member": …
```

Also replayed webarena-799 end to end (create group `n-lab` → invite `patou`,
`egpast`, `westurner`, `jontutcher`): ids 207–210 after the owner's 206, all four
`@handle`s present after reload, diff keys
`['groups','members','nextIds.group','nextIds.member']`.

## BUG-003 / DIFF-A08 · P1 · `__GITLAB_SSH__` — CLOSED

`src/pages/ProjectOverview.jsx`:

```js
const sshCloneUrl = `ssh://git@${window.location.hostname}:2222/${project.full_path}.git`
```

`assets/README.md §24.5` is explicit that host-dependent values come from the
serving origin, not a hard-coded host — the source's own
`ssh://git@10.186.197.203:2222/…` is just that instance's address, and WebArena
substitutes `__GITLAB_SSH__` into the *reference* answer, so rendering the literal
placeholder could never match. Only the SSH port (2222) is fixed, because it is
the git daemon's and not the web server's. Verified on `byteblaze/dotfiles`,
`convexegg/chatgpt` and `root/metaseq` (webarena-293…297):
`ssh://git@localhost:2222/root/metaseq.git` next to the already-correct
`http://localhost:5214/root/metaseq.git`.

## BUG-A10 · P1 · feed token was on the wrong page — CLOSED

**Shard A was right and shard C's §"Non-differences" note was wrong.** Checked
directly: `assets/html/profile-account2.html` (the captured `/-/profile/account`)
contains zero occurrences of `feed_token`, and the live source serves the token
inside `#js-tokens-app[data-tokens-data]` on
`/-/profile/personal_access_tokens`, where a Vue app renders it.

- `src/pages/ProfileAccount.jsx`: removed the Feed token section **and** the
  `Social sign-in` section (the source has no `Social sign-in` anywhere). The page
  is now exactly the source's three sections: Two-factor authentication · Change
  username · Delete account.
- `src/pages/ProfileKeys.jsx`: `/-/profile/personal_access_tokens` is no longer a
  MISC stub. New `ProfileAccessTokens` renders the real page — the
  "Add a personal access token" form with the five scope checkboxes and their
  verbatim help text, an Active-tokens table, and the
  `div[data-testid="feed-token-container"]` block with the exact source copy.

The reveal control works and matches the source's behaviour and attributes:
`button[data-testid="toggle-visibility-button"]`, `aria-label` flips
`Click to reveal` → `Click to hide`, `#feed_token` goes
`********************` → `TMN_bBn9Z48qVbUFZV45` (the value off `users.json`,
never invented). Measured the same transition on the source before implementing.

The token-create form actually creates (name + expiration + scopes → a row in the
Active table that survives reload, revocable), and `reset this token` confirms
with GitLab's own wording and regenerates deterministically, so `/go` stays
reproducible.

## BUG-A11 · P2 · `/-/profile/account` copy drift — CLOSED

All four items, against `assets/html/profile-account2.html`:

- `Two-Factor Authentication` → `Two-factor authentication`
- `Learn more.` restored as a link on the Change-username blurb
- `Current path: <origin>/byteblaze` line added under the Path field
- `You don't have access to delete this user.` replaced by the source's real
  `<ul>`: the Ghost User sentence with its documentation link, and
  `12 personal projects will be removed and cannot be restored.`

The `12` is **derived** (`projects` whose `namespace.path` is the current user),
not hard-coded, so it stays true after a create or fork; it evaluates to 12 on the
seed, matching the source.

Also fixed here, from BUG-B05's list: the `http://localhost:8023/` prefix is now
`window.location.origin`. The other five forms in that finding are in files I do
not own.

**Left alone deliberately:** the `Delete account` button is still `disabled`.
The source's is enabled and opens a password-confirmation modal, but there is no
coherent mock semantics for deleting the pre-logged-in user, and no anchor reads
this control. Flagging rather than inventing behaviour.

## BUG-B10 · P2 · owner-only affordances — CLOSED

Measured the real rule on the source rather than guessing, using three viewer
roles:

| Page | byteblaze's role | source renders |
|---|---|---|
| `/byteblaze/dotfiles/-/project_members` | Owner | h4 + intro + 3 buttons, `aria-colcount=8`, Actions column |
| `/primer/design/-/project_members` | Developer | h4 only — no intro, no buttons, `col-actions` absent |
| `/groups/robert1003/-/group_members` | not a member | **empty** header div, no buttons, `aria-colcount=7` |

So: projects always show the `Project members` h4; groups hide theirs too. Intro,
buttons and the Actions column are Maintainer+ (40) only. Implemented as an
exported `canManageMembers(state, currentUser, sourceType, sourceId)` used by
`MembersTable`, `ProjectMembers` and `GroupMembers`. Mock now reproduces all
three rows above exactly, colcount included.

Two smaller source mismatches fixed in the same place:

- the **Groups tab** was rendered unconditionally; the source renders a lone
  `Members` tab and only adds `Groups` once a group share exists. It now follows
  `groupLinks.length > 0`, and the active tab falls back to `members` so removing
  the last share cannot strand the view.
- the Expiration datepicker is now `disabled` on rows the viewer cannot edit,
  which is what the source ships (including the viewer's own row).

Byteblaze is Maintainer or Owner on every project and group any member-task
anchors (checked `members.json` — the only sub-40 row is `primer/design`, which
no member task touches), so the gate cannot break a task.

## DIFF-A02 · P2 · `/byteblaze` Personal projects panel — CLOSED

Two of the three items were already fixed in `ProjectRow` before this round
(`compact` suppresses the namespace prefix, and the `user-access-role` badge
renders) — confirmed in the browser: cards read `solarized-prism-theme` + `Owner`,
not `Byte Blaze / solarized-prism-theme`.

The third was real. The mock's `View all` under **Activity** carries GitLab's
`.hide` class, but the mock ships no `.hide` CSS rule, so it rendered. The source
only unhides it once the activity feed loads rows, and with an empty feed it never
appears. `src/pages/UserProfile.jsx` now sets `style={{display:'none'}}` alongside
the class, keeping the DOM shape. The `View all` under **Personal projects** is
correct and stays — the source has one there (`a.js-view-all`).

## DIFF-A03 · P2 · `/-/starrers` — NOT A BUG

Investigated as asked rather than patched. Three checks:

1. `src/pages/Starrers.jsx` already reads `state.stars` — the single source of
   truth after shard 1 removed the derived `ui.starredProjectIds`. It does not
   read a stale key.
2. The seed's star rows survived: `src/data/stars.json` has 569 rows across 107
   projects, and **0** of them reference a user id that is not in `users.json`.
3. `byteblaze/dotfiles` has `star_count: 0` and 0 star rows in the seed *and* on
   the source — the empty page is correct. On a project that does have stars,
   `/a11yproject/a11yproject.com/-/starrers` renders 7 starrer rows under a
   `Starrers 21` badge.

The 7-vs-21 gap is the declared sampling strategy (`assets/data_model.md §0`);
`Starrers.jsx` already shows `max(star_count, rows)` on the tab so the aggregate
matches the source. Nothing to fix. Nothing was written to `Starrers.jsx` — it is
shard 3's file anyway.

---

## NEEDS FILE — could not fix, not mine

**`NEEDS FILE: src/pages/GroupOverview.jsx:51` — BUG-006.** Still reproduces:
after creating `n-lab`, `/n-lab` renders the empty state to its own Owner. The
empty state is unconditional at line 47 (`projects.length === 0`), so the "no
permissions" copy shows to everybody.

I pulled the correct copy out of the container so whoever owns the file does not
have to guess. GitLab 15.7 has **two** empty states
(`commons-pages.groups.details-pages.groups.show.5b155a2c.chunk.js`, i18n keys
`GroupsEmptyState|…`):

- viewer *can* create (two link cards, to `newSubgroupPath` / `newProjectPath`):
  - `Create new subgroup` / `Groups are the best way to manage multiple projects and members.`
  - `Create new project` / `Projects are where you can store your code, access issues, wiki, and other features of Gitlab.`
- viewer *cannot* create (what the mock shows today, unconditionally):
  - `No subgroups or projects.` / `You do not have necessary permissions to create a subgroup or project in this group. Please contact an owner of this group to create a new subgroup or project.`

`MembersTable.jsx` now exports `canManageMembers(state, currentUser, 'namespace',
group.id)`, which is the same predicate GroupOverview needs.

## Cross-shard finding — `allocateId` is broken for every caller, not just members

Worth escalating beyond BUG-B03. `AppContext.allocateId` (`src/context/AppContext.jsx:79`)
only returns a real id when React takes its *eager state* path, which requires the
fiber to have no pending update. The **first** `allocateId` in an event handler
therefore usually works and every one after a `setState` in the same tick returns
`null`. Members hit it because it allocated in a loop.

Six other call sites are one-allocation-per-handler today and so happen to work,
but are one refactor away from the same silent `null`:

```
src/pages/NewMilestone.jsx:65   src/pages/NewIssue.jsx:60
src/pages/LabelsList.jsx:183    src/pages/NewLabel.jsx:54
src/pages/NewMergeRequest.jsx:169  src/pages/NotesTimeline.jsx:103
```

Recommended: either make `allocateId` derive synchronously from a state ref, or
move these callers onto `prev.nextIds.*` reducers the way
`mutations.js` (`createProject`, `createGroup`, `forkProject`, `addMembers`) does.
`src/context/**` is not mine, so I did not touch it.

## Not done, with reasons

- **DIFF-002 `.user-profile` whitespace.** Left as-is. The `·` separators are
  deliberately CSS `::after` content (documented in `UserProfile.jsx:82`) precisely
  so they stay out of `outerText`; the residual difference is Haml inter-element
  whitespace. Every anchor on this locator (webarena-533…537) is an `@username`
  substring and matches either way. Making `outerText` byte-identical means
  hand-placing whitespace text nodes, which is a lot of fragile churn for no
  evaluator gain.
- **`ProjectRow` compact stats.** Noticed while checking DIFF-A02 and *not* fixed
  because `src/pages/DashboardProjects.jsx` is shard 3's. On the profile overview
  the source's cards carry **stars and forks only**; the mock's compact cards
  carry stars, forks, MRs and issues, so each card reads `0 0 0 0` where the
  source reads `0 0`. No anchor involved.
- **`/byteblaze` overview project order.** Mock leads with `dotfiles`, source with
  `solarized-prism-theme`. Same family as DIFF-003 / DIFF-A01 (the persisted
  `projects_sort` question), which is another shard's call — flagging only so it is
  not lost.

## Files touched

```
src/components/create/mutations.js   + addMembers(), accessLabel import
src/pages/MembersTable.jsx           BUG-001, BUG-002, BUG-B03/007, BUG-B10
src/pages/ProjectMembers.jsx         BUG-B10 (intro paragraph gate)
src/pages/GroupMembers.jsx           BUG-B10 (header gate)
src/pages/ProjectOverview.jsx        BUG-003 / DIFF-A08
src/pages/ProfileAccount.jsx         BUG-A10, BUG-A11, part of BUG-B05
src/pages/ProfileKeys.jsx            BUG-A10 (new /-/profile/personal_access_tokens)
src/pages/UserProfile.jsx            DIFF-A02
```

Nothing outside my ownership list was written. No seed file was regenerated. No
identifier was renamed. No data was fabricated.

## Verification performed

- `npm run build` — PASS.
- Cold-loaded 22 routes in **fresh browser contexts** with unique `?sid=`:
  0 page errors, 0 console errors, 0 white screens, `?sid=` preserved on 22/22.
- Drove and reloaded: project invite (3 users, one submit), group create + group
  invite (4 users), personal-access-token create, feed-token reveal, clone
  dropdown, username field.
- Differential reads against the live source for BUG-001 (3 paths), BUG-002 (both
  modals), BUG-A10 (account page sections, PAT page, reveal transition), BUG-B10
  (3 viewer roles).
</content>
</invoke>
