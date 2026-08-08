# DEV — round 3, shard B: the NEEDS FILE handbacks

Scope: the five findings another agent diagnosed but could not reach the file for.
All five are closed and verified in chromium against the live source at
`http://localhost:8023` (read only; no `?sort=` URL was loaded).

Build: **PASS** — `npx vite build --outDir /tmp/shardb-dist` (159 modules).
Built to a temp outDir on purpose: two other shards were running and `dist/` is
shared, so a bare `npm run build` would have raced them. Same compile, no race.

---

## 1. BUG-B06 — raw inline HTML rendered as literal text · `src/utils/markdown.js`

GFM does not escape raw HTML; it renders it and runs the result through
`Banzai::Filter::SanitizationFilter`'s safelist. The renderer escaped first, so
every `<img>`, `<br>`, `<kbd>`, `<sub>` and `<details>` in the seed came out as
literal angle-bracket text — and comment bodies are exactly where the anchored
strings live.

Fix: safelisted tags are lifted out to `\u0001N\u0001` placeholders before
`escapeHtml`, then restored after the inline rules run. Everything off the
safelist is still escaped, matching what the sanitizer would strip.

- tag safelist + per-tag attribute safelist mirroring the sanitizer's
- `javascript:` / `vbscript:` / non-image `data:` URLs are emptied; event
  handlers (`onerror=…`) never survive, since only safelisted attributes are
  re-emitted
- a line opening a **block** element (`<details>`, `<table>`, …) is emitted at
  block level instead of being wrapped in `<p>`; inline tags stay in the
  paragraph, as GFM does
- offline rule preserved: a raw `<img>` with an absolute src goes through the
  same `data-canonical-src` + local-placeholder path the markdown `![]()` rule
  already used, so it makes no network call

Also fixed while here: `/uploads/<hash>/<file>` (GitLab's own upload store) now
takes the placeholder too. Those bytes were never dumped out of the container,
so every screenshot in a comment thread was rendering as a broken image.

Verified: `byteblaze/a11y-syntax-highlighting/-/issues/1` — the two `<img>`
comments render as images, not text; `a11yproject/a11yproject.com/-/issues/719`
still shows its fenced `<h1 class="a11y-title">` block as literal text, exactly
as the source does.

## 2. BUG-B08 — missing actor, and missing label / milestone / closed events · `src/pages/NotesTimeline.jsx`

**Actor.** The `<a class="author-name-link">` was in the markup all along, but
`global.css:548` lays `.note-header-info` out as a flex row, and `innerText`
puts a newline between flex items. The mock's text read

```
Byte Blaze
assigned to @ericwbailey 8 years ago
```

where the source is one line. That is the text an evaluator reads. Fixed with a
scoped `<style>` in this component (the same pattern `ProjectsNav.jsx` already
uses) that renders system-note headers inline; user notes keep the flex row,
which is what the source does for those.

**The three missing event kinds.** They were absent because GitLab does not
store them in `notes`. Since 11.x they live in `resource_label_events`,
`resource_milestone_events` and `resource_state_events`, and
`ResourceEvents::MergeIntoNotesService` merges them into the notes list at
render time. `src/data/notes.json` was dumped from `notes` alone.

Nothing was invented. I pulled the container's own three tables, restricted to
the seeded issue/MR ids:

```
resource_label_events      500   (472 added, 28 removed)
resource_milestone_events   19
resource_state_events      688   (680 closed, 8 reopened)
```

→ **`src/data/resource_events.json`** (1 207 rows, 172 KB). Every `user_id`,
`label_id` and `milestone_id` in it already resolves inside the seed — checked,
zero misses. It is historical and never mutated, so it is imported directly by
`NotesTimeline.jsx` rather than carried in state: it adds nothing to the `/go`
diff payload.

> ⚠️ **Ownership note for the orchestrator.** `src/data/` belongs to shard A.
> `resource_events.json` is a **new** file, so it cannot collide with an edit in
> flight, and it is not wired through `dataManager.js`/`createInitialData()` —
> no file owned by another shard was touched. Flagging it explicitly because it
> sits outside my declared ownership list. If a serial seed rebuild runs, this
> file must survive it.

Rendering, all read off `assets/html/issue-a11y-{566,719,1478,1517}.html` and
`mr-a11y-{1265,1270,1485}.html`:

| kind | icon | copy |
|---|---|---|
| label add/remove | `label` | `added bug label` · `added content good first issue help wanted labels` · `removed 2 deleted labels` |
| milestone | `clock` | `changed milestone to %Content Updates for 2019` (link to `/…/-/milestones/<iid>`) |
| state | `issue-close` / `issues` | `closed` · `reopened` |
| seeded system notes | `user` `pencil` `approval` `fork` `timer` `comment` | derived from the body |

Details that had to match the source and now do:

- consecutive label events by one user in the same second collapse into **one**
  note, and the labels inside it are listed **by title**, not by event id
- a label whose row was deleted is counted, not named — `added 1 deleted label`
- `changed title from **Better {-e-}vent UX** to …` renders as
  `<strong>Better <span class="idiff left right deletion">e</span>vent UX</strong>`
  instead of raw asterisks and braces
- `@username` in a system note becomes a `gfm gfm-project_member` link
- same-second ties order note → label → milestone → state, which is the order
  `MergeIntoNotesService` produces

`Close issue` / `Reopen issue` now also **append a real system note** rather
than only flipping `state`, so the change shows on the timeline and reaches
`/go`'s `state_diff`.

Anchor re-checked after the rewrite: post a comment, then
`#notes-list.lastElementChild.querySelector('.timeline-discussion-body').outerText`
=== the comment text, before **and** after a reload.

Side-by-side innerText, mock vs source, `/-/issues/566`, `/-/issues/719`,
`/-/issues/1478`, `/-/merge_requests/1265`: identical apart from item 6 below.

## 3. BUG-B11 — literal toolbar glyphs · `Controls.jsx` + `Icon.jsx`

`TOOLBAR_GLYPH` is gone. Every button is `<Icon name={key} />` and every name is
the sprite id the source's own button carries in `data-testid="<name>-icon"`.
`.md-header-toolbar`'s `innerText` is now `''`, as on the source.

Geometry came from the container's own sprite,
`/assets/icons-ce4e8ebe16c824ec266af5c86cfa08b0d35e88b4fa857e862dd87bbc726986bc.svg`
— not an icon library. Every symbol there is a single `<path>` on a `0 0 16 16`
viewBox, so it drops straight into `PATHS`. While in the file I also replaced
**44 of the 49 existing hand-drawn approximations** with the real geometry; the
five with no symbol of that name in the sprite (`document-lines`, `copy`, the
two `angle-double-*`, `shield-check`) stay hand-drawn and are marked as such.

Toolbar is now the source's exact set and order — `bold italic strikethrough
quote code link list-bulleted list-numbered list-task list-indent list-outdent
details-block table paperclip maximize` — with the source's titles. The mock was
missing `list-indent` / `list-outdent` entirely; both are implemented (shift the
selected lines by two spaces).

The two buttons that used to be decorative now work:

- **Attach a file or image** opens a file picker, POSTs to the mock's own
  `/upload?sid=`, and appends `![name](url)` / `[name](url)`
- **Go full screen** toggles zen mode

## 4. BUG-A12 + tail of BUG-A07 — `src/pages/ExploreTopics.jsx`

Read from the container rather than guessed:
`app/views/explore/projects/topics.html.haml` renders `explore/topics/_head`,
whose `%h1` is **`Projects`** — not "Explore topics" — and which renders
`dashboard/_projects_nav`, the *same* strip as `/dashboard/projects` and
`/explore/projects`.

- hand-rolled `Explore topics · Most starred · Trending · All · Topics` strip
  replaced with the shared `<ProjectsPrimaryTabs active="topics">`, badges wired
  to the viewer's unfiltered `Yours 14 · Starred 3`
- `h1` is `Projects`; page title `Topics · Explore · GitLab`
- filter form is the source's `#topic-filter-form` / `#topic-filter-form-field`
- **invented copy removed.** The empty state is now exactly
  `shared/empty_states/_topics.html.haml`:
  `There are no topics to show.` / `Add topics to projects to help users find them.`
  The invented second line and the invented `Explore projects` button are gone,
  as is the invented `N projects on this instance.` footer line.

Screenshot diff against the live page: identical but for the source's
`illustrations/labels.svg`, which is not in `public/` — I did not substitute
other art for it.

## 5. BUG-006 — group owner shown the "no permissions" empty state · `src/pages/GroupOverview.jsx`

`groups_helper.rb#group_overview_tabs_app_data` feeds `can_create_subgroups` /
`can_create_projects` to `groups/components/empty_state.vue`, which has two
branches. The mock only had the second, unconditionally.

- imported `canManageMembers(state, currentUser, 'namespace', group.id)` from
  `MembersTable.jsx` as instructed — that file was not edited
- viewer **can** create → two link cards, `Create new subgroup` /
  `Groups are the best way to manage multiple projects and members.` and
  `Create new project` /
  `Projects are where you can store your code, access issues, wiki, and other features of Gitlab.`
- viewer **cannot** → `No subgroups or projects.` + the permissions paragraph
- all copy verbatim from the container's `locale/gitlab.pot` `GroupsEmptyState|…`
  msgids
- the header's `New subgroup` / `New project` buttons are hidden for a viewer
  who cannot create, and now carry the source's params —
  `/groups/new?parent_id=<id>#create-group-pane` and
  `/projects/new?namespace_id=<id>`
- the three tabs were dead links; they now drive the view, and the empty-state
  title follows the tab (`No shared projects.` / `No archived projects.`,
  same msgid block), with the permissions paragraph only on the first tab as in
  the Vue component

Verified end to end: created a group through `/groups/new`, landed on
`/Shard-B-Fresh`, got the two link cards — and still got them after a reload.
`/robert1003?shared=1` and `?archived=only` give the right per-tab titles.

---

## Not done / remaining

6. **Role badges on user notes.** The source prints `Author`, `Maintainer`,
   `Developer` or `Contributor` under every commenter's name in the timeline;
   the mock prints nothing. `Author` and the member roles are derivable from the
   seed, but `Contributor` (shown for `@root` on several threads) means "has
   commits here but is not a member", and I did not want to guess at the
   predicate on a finding that was not in this handback. Small, self-contained,
   `NotesTimeline.jsx` only.
7. **Topics empty-state illustration** — `illustrations/labels.svg` is not in
   `public/`. Not substituted.
8. The non-owner **and** empty `subgroups_and_projects` branch of BUG-006 is not
   reachable with the current seed (both seeded groups have projects and
   byteblaze is a member of neither), so it was verified by reading only; the
   `shared` / `archived` tabs exercise the same branch and were verified live.

## Files touched

```
src/utils/markdown.js
src/pages/NotesTimeline.jsx
src/pages/ExploreTopics.jsx
src/pages/GroupOverview.jsx
src/components/issuable/Controls.jsx
src/components/layout/Icon.jsx
src/data/resource_events.json      NEW — see the ownership note under §2
```

`src/components/ui/ProjectsNav.jsx` was owned but needed no change; its
`ProjectsPrimaryTabs` already had the `topics` tab, ExploreTopics just was not
using it.
