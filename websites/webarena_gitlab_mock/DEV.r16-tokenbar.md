# DEV — round 16 — DIFF-1501: make the filtered-search token bar work

Scope handed over: **DIFF-1501 (P1)**, plus if cheap DIFF-1305, DIFF-1308,
DIFF-1309, DIFF-1102, and correcting the stale `P1-2` entry in `AUDIT.md`.

Written incrementally as the round proceeds.

---

## 1 · Source recon — measured on 8023, read-only

Every line below is a **measurement**, not a recollection. Method: Playwright,
logged in as `byteblaze`, driving the source's own bar. No `?sort=` URL was ever
loaded on 8023 — see §1.7 for how that was guaranteed.

### 1.1 There are TWO filtered-search implementations on the source

| source page | implementation | input selector |
|---|---|---|
| `/:ns/:proj/-/issues` | **new** Vue `GlFilteredSearch` | `input[data-testid="filtered-search-term-input"]` |
| `/:ns/:proj/-/merge_requests` | **legacy** | `input#filtered-search-merge_requests.filtered-search` |
| `/dashboard/issues` | **legacy** | `input#filtered-search-issues` |
| `/dashboard/merge_requests` | **legacy** | `input#filtered-search-merge_requests` |

Measured directly: `newInput` count is 1 on the project issue list and **0** on
the other three; `#js-dropdown-hint` exists on those three and not on the first.

The mock renders the **new** bar on all four (since round 4; no round has filed
that as a difference, and DIFF-1501 is filed against inertness, not DOM flavour).
This round keeps one interaction model — the new one — on all four pages and
takes the **token vocabulary and the emitted param names per page from that
page's own source bar**. The bar-flavour divergence on the three legacy pages is
recorded in §5, not papered over.

### 1.2 Token types, verbatim, in source order

`/root/metaseq/-/issues` — new bar, `ul.dropdown-menu.gl-filtered-search-suggestion-list`, 9 items:

| # | label | icon `data-testid` |
|---|---|---|
| 1 | `Assignee` | `user-icon` |
| 2 | `Author` | `pencil-icon` |
| 3 | `Confidential` | `eye-slash-icon` |
| 4 | `Label` | `labels-icon` |
| 5 | `Milestone` | `clock-icon` |
| 6 | `My-Reaction` | `thumb-up-icon` |
| 7 | `Release` | `rocket-icon` |
| 8 | `Search Within` | `search-icon` |
| 9 | `Type` | `issues-icon` |

Anonymous (logged out) the same page shows **7** — `Confidential` and
`My-Reaction` are the two that require a session. TEST.md's round-15 measurement
of "7 visible entries" was taken anonymously; it is not wrong, it is a different
session. The mock boots pre-logged-in as `byteblaze`, so **9** is the right list.

Legacy `#js-dropdown-hint`, measured:

* `/root/metaseq/-/merge_requests` and `/a11yproject/a11yproject.com/-/merge_requests` — 13 +
  `Search for this text`: `Author`, `Assignee`, `Reviewer`, `Approved-By`,
  `Milestone`, `Release`, `Label`, `My-Reaction`, `Draft`, `Target-Branch`,
  `Environment`, `Deployed-before`, `Deployed-after`
* `/dashboard/issues` — 6 + `Search for this text`: `Author`, `Assignee`,
  `Milestone`, `Release`, `Label`, `My-Reaction`
* `/dashboard/merge_requests` — 12 + `Search for this text`: as the project MR
  list but **without `Target-Branch`**

`Search for this text` is the legacy bar's way of committing free text; the new
bar does it implicitly by typing, so it is not rendered as a token type.

### 1.3 Operators

Two entries, each `<symbol>` + `<span class="gl-filtered-search-token-operator-description">`:

```
=    is
!=   is not
```

Exceptions, all measured:

* `Assignee` and `Author` describe `!=` as **`is not one of`**, not `is not`.
* `Confidential` and `Search Within` have **no operator step** — picking the type
  goes straight to values.
* `Draft` offers only `= is`.

### 1.4 Value lists

| type | `=` | `!=` |
|---|---|---|
| `Label` | `None`, `Any`, divider, then every label alphabetically with its colour swatch | labels only, no `None`/`Any` |
| `Assignee` / `Reviewer` / `Approved-By` | `None`, `Any`, divider, then members (avatar + name + `@handle`), **with the signed-in user pinned first** | same, pinned first |
| `Author` | members only | members only |
| `Milestone` | `None`, `Any`, `Upcoming`, `Started`, **divider**, then milestone titles | same minus `None`/`Any` |
| `Confidential` | `Yes`, `No` | — |
| `Search Within` | `Titles`, `Descriptions` | — |
| `Type` | `issue`, `incident`, `test_case`, `task` | same four |
| `Draft` | `Yes`, `No` | — |
| `Target-Branch` | the project's branches, `main` first | same |
| `My-Reaction` / `Release` | `None`, `Any`, divider, then `No suggestions found` on metaseq | |
| `Environment` | empty list — free text | |
| `Deployed-before` / `Deployed-after` | no list — free text (a date) | |

Empty-state row, verbatim:
`<li role="presentation" class="gl-dropdown-text"><p class="b-dropdown-text">No suggestions found</p></li>`

Typing narrows the **type** list case-insensitively — typing `lab` leaves exactly
`['Label']` (measured).

**The signed-in user is pinned to the head of every user list, membership or
not.** `root/metaseq` has exactly ONE member on the source — `Administrator /
@root`, confirmed on its own `/-/project_members` page — and its `Assignee =`
list is still `None, Any, ―, Byte Blaze / @byteblaze, Administrator / @root`.
Same on `/primer/design` `Author =` (`Byte Blaze`, then `Primer`). Missing this
makes "assigned to me" unclickable on every project `byteblaze` is not a member
of, which is the single most likely filter an agent reaches for.

### 1.5 The param each token emits — measured by driving the source's bar

New bar, `/root/metaseq/-/issues`:

```
Label       =   …/-/issues/?sort=created_date&state=opened&label_name%5B%5D=bug&first_page_size=20
Label       !=  …&not%5Blabel_name%5D%5B%5D=bug&…
Label       =None  …&label_name%5B%5D=None&…            (webarena-343's anchor param)
Assignee    =   …&assignee_username%5B%5D=byteblaze&…   ← ARRAY on the new bar
Assignee    !=  …&not%5Bassignee_username%5D%5B%5D=byteblaze&…
Assignee    =None  …&assignee_id=None&…                 ← different param for None/Any
Assignee    =Any   …&assignee_id=Any&…
Author      =   …&author_username=byteblaze&…           ← scalar
Author      !=  …&not%5Bauthor_username%5D=byteblaze&…
Milestone   =   …&milestone_title=Upcoming&…    !=  …&not%5Bmilestone_title%5D=Upcoming&…
Milestone   =None  …&milestone_title=None&…             ← milestone keeps its own param for None
Type        =   …&type%5B%5D=issue&…            !=  …&not%5Btype%5D%5B%5D=issue&…
Confidential=   …&confidential=yes&…  /  …&confidential=no&…
Search Within=  …&in=TITLE&…  /  …&in=DESCRIPTION&…
My-Reaction =   …&my_reaction_emoji=Any&…
Release     =   …&release_tag=Any&…
```

Legacy bar (navigation intercepted and **aborted**, so the source never loaded it):

```
/dashboard/merge_requests   assignee None   ?scope=all&state=opened&assignee_id=None
/dashboard/merge_requests   author byteblaze ?scope=all&state=opened&author_username=byteblaze
/dashboard/merge_requests   label None      ?scope=all&state=opened&label_name[]=None
/dashboard/merge_requests   reviewer None   ?scope=all&state=opened&reviewer_id=None
/dashboard/merge_requests   draft Yes       ?scope=all&state=opened&draft=yes
/root/metaseq/-/merge_requests approved-by None ?…&approved_by_usernames[]=None
/root/metaseq/-/merge_requests target-branch main ?…&target_branch=main
/root/metaseq/-/merge_requests environment ''  ?…&environment=
/root/metaseq/-/merge_requests deployed-before ''  ?…&deployed_before=
/root/metaseq/-/merge_requests reviewer !=    ?…&not[reviewer_username]=byteblaze
/root/metaseq/-/merge_requests target-branch != ?…&not[target_branch]=main
```

So on the **legacy** pages `Assignee` and `Reviewer` are **scalar**
(`assignee_username=`), which is exactly the form webarena-156 and -357 anchor on
(`/dashboard/merge_requests?assignee_username=byteblaze`). The array form is
new-bar-only. The mock now honours that split per page.

**The `not[…]` spelling is a measured rule, 7/7:** `not[<scalar>]` and
`not[<array>][]`. Confirmed directly on `label_name[]`, `assignee_username[]`,
`author_username`, `milestone_title`, `type[]`, `reviewer_username` and
`target_branch`. `my_reaction_emoji` and `release_tag` could not be driven to `!=`
on the source because their value lists are empty on every seeded project, so
their `not[…]` spelling is **derived from that 7/7 rule**, not measured. Flagged
here rather than presented as measured.

### 1.6 Param order, and the two params the mock deliberately does not copy

Two tokens plus free text, applied by clicking, emitted:

```
…/-/issues/?search=hello&sort=created_date&state=opened&label_name%5B%5D=bug&assignee_username%5B%5D=byteblaze&first_page_size=20
```

`search`, `sort`, `state`, filters in the order the tokens sit in the bar, then
`first_page_size` — the order `src/utils/issuableUrl.js#PARAM_ORDER` already
produces (it orders filters by a fixed list rather than by bar position; no anchor
carries two filters, so this is not observable by any evaluator).

The mock does **not** copy two things the source's bar emits:

1. **`sort=created_date` unconditionally.** `issuableListUrl()` carries `sort`
   only when it is already in the query. Round 14 established every control's
   emitted form and this round is forbidden from moving it.
2. **`scope=all`** on the legacy pages, for the same reason.

Both are inert for `URLEvaluator`, which iterates the *reference* query keys only
and never penalises extra or missing non-reference keys.

### 1.7 How the read-only rule was kept

The new bar filters by **`pushState` + GraphQL**, never a document navigation —
measured (`full_page_load: false` on every drive). So driving it never hit the
Rails controller and never touched the user's sort preference. The legacy bar
*does* submit a GET, so every legacy drive was run with the navigation request
**intercepted and aborted**; the URL was read off the aborted request. Only three
kinds of source URL were ever loaded: a bare list path, a filter URL with no
`sort` key, and `/users/sign_in`.

### 1.8 DOM to reproduce, verbatim from the source

```html
<ul class="dropdown-menu gl-filtered-search-suggestion-list">
  <li role="presentation" class="gl-dropdown-item gl-filtered-search-suggestion">
    <a data-testid="filtered-search-suggestion" role="menuitem" href="#" target="_self" class="dropdown-item">
      <svg data-testid="user-icon" class="gl-icon s16 gl-dropdown-item-icon gl-text-gray-700">…</svg>
      <div class="gl-dropdown-item-text-wrapper"><p class="gl-dropdown-item-text-primary">Assignee</p></div>
    </a>
  </li>
  <li role="presentation" class="gl-dropdown-divider">
    <hr role="separator" aria-orientation="horizontal" class="dropdown-divider">
  </li>
  <li role="presentation" class="gl-dropdown-text"><p class="b-dropdown-text">No suggestions found</p></li>
</ul>
```

Operator item body:
`<div class="gl-display-flex">= <span class="gl-filtered-search-token-operator-description">is</span></div>`

Label value body:
`<div class="gl-display-flex gl-align-items-center"><span class="gl-display-inline-block gl-mr-3 gl-p-3" style="background-color:…"></span> <div>api</div></div>`

Token close button, inside the data segment:
`<button aria-label="Close" type="button" class="btn gl-token-close gl-close-btn-color-inherit btn-default btn-sm gl-button btn-default-tertiary btn-icon">`

Computed styles measured on the source:

| element | measured |
|---|---|
| `.gl-filtered-search-token-type` | bg `#ececef`, fg `#333238`, radius `2px 0 0 2px`, padding `4px 8px`, height 24, margin-right 2 |
| `.gl-filtered-search-token-operator` | same, radius `0` |
| `.gl-filtered-search-token-data` (label) | the label's own colour, radius `0 2px 2px 0`, padding `0 0 0 8px` |
| `.gl-filtered-search-token-data` (other) | bg `#dcdcde`, fg `#333238` |
| `.gl-token-close` | 24×24, padding 4, margin-left 4, radius 4 |
| `.gl-filtered-search-scrollable` | padding `4px 4px 4px 12px`, height 32, `box-shadow: inset 0 0 0 1px #89888d` |
| `.gl-filtered-search-suggestion-list` | absolute, width/min-width 240, max-height 312, `overflow-y:auto`, radius 4, border `1px solid #dcdcde`, `box-shadow 0 2px 4px rgba(0,0,0,.1)`, z-index 300, padding `8px 0` |
| suggestion `li` | height 32 |

### 1.9 Token text on cold load — the round trip, measured on the source

| URL | token rendered |
|---|---|
| `?state=opened&label_name%5B%5D=bug` | `Label = ~bug` (label colour) |
| `?state=opened&not%5Blabel_name%5D%5B%5D=bug` | `Label != ~bug` |
| `?state=opened&assignee_username%5B%5D=byteblaze` | `Assignee = byteblaze` |
| `?state=opened&not%5Bassignee_username%5D%5B%5D=byteblaze` | `Assignee != byteblaze` |
| `?state=opened&author_username=byteblaze` | `Author = byteblaze` |
| `?state=opened&not%5Bauthor_username%5D=byteblaze` | `Author != byteblaze` |
| `?state=opened&type%5B%5D=issue` | `Type = issue` |
| `?state=opened&confidential=yes` | `Confidential = Yes` |
| `?state=opened&in=TITLE&search=model` | `Search Within = Titles` + term chip `model` |
| `?state=opened&my_reaction_emoji=Any` | `My-Reaction = Any` |
| `?state=opened&release_tag=Any` | `Release = Any` |
| `?state=opened&milestone_title=Upcoming` | `Milestone = %Upcoming` |
| `?state=opened&not%5Bmilestone_title%5D=Upcoming` | `Milestone != %Upcoming` |
| `?state=all&label_name[]=bug&assignee_username[]=byteblaze` | `Label = ~bug` \| `Assignee = byteblaze` |

**User tokens render the `username`, not the display name.** The mock's `Tokens`
carried a comment asserting the opposite ("user filters render the DISPLAY name,
not the handle") and rendered `Byte Blaze`. That assertion is wrong against this
measurement and is corrected this round.

---

## 2 · What landed

| file | change |
|---|---|
| `src/utils/searchTokens.js` | **new.** The token registry: every token type with its label, icon, operators, `=`/`!=` params, `None`/`Any` param, value source and token text; the per-page type lists; `parseTokens()` (URL → tokens), `addTokenUrl()` / `removeTokenUrl()` / `clearAllUrl()` (tokens → URL) and `valueOptions()`. |
| `src/pages/IssuablesList.jsx` | `FilteredSearchBar` rewritten: a three-step suggestion list (type → operator → value) in the source's DOM, a pending token that renders as it is built, removable applied tokens, a `Clear` button, and free-text terms as their own chips. `Tokens` became `TokenChip` and now reads `parseTokens()`. |
| `src/pages/hooks.js` | `filterIssuables()` honours every param the bar can emit — the array *and* scalar assignee forms, `assignee_id` / `reviewer_id` for `None`/`Any`, all the `not[…]` forms, `in=TITLE|DESCRIPTION`, `type[]`, `draft`, `target_branch`, `confidential`, and the empty-by-construction ones. |
| `src/utils/issuableUrl.js` | `PARAM_ORDER` extended with the new params so they serialise in the source's order. Existing entries and their order are untouched, so no already-emitted URL moves. |
| `src/components/layout/Icon.jsx` | `labels`, `thumb-up`, `eye-slash`, `environment` paths, lifted verbatim from the source's own sprite. |
| `src/styles/global.css` | The token bar's styles, at the source's measured dimensions (§1.8). |
| `src/pages/ProjectOverview.jsx`, `src/data/projects.json` | DIFF-1308 (§4). |
| `AUDIT.md` | the stale `P1-2` corrected (§5). |
| `SCHEMA.md` | cold-state figure re-measured (§4). |

### 2.1 The bug that ate the first implementation

Picking a token type did nothing: the dropdown closed and no token appeared.

`Dropdown.jsx`'s `useOutsideClose` listens for `mousedown` on `document` and
closes when `ref.current.contains(e.target)` is false. React flushes a discrete
event's state update *before* the event finishes bubbling to `document`, so by
the time that listener ran, the suggestion row that had just been clicked was
already re-rendered away. `contains()` reported the detached node as **outside**
the bar and closed the dropdown on every single pick.

`FilteredSearchBar` now uses a local outside-close that ignores a target which is
no longer connected — a detached node was never outside anything. `useOutsideClose`
itself is untouched, because every other dropdown in the app renders a static menu
and does not hit this.

### 2.2 One deliberate divergence, stated rather than hidden

The source completes a token when you click its value and applies the filter on
the **following `Enter`**. The mock applies it on the value click. The URL is
identical either way; the extra keystroke is the difference. An affordance that
looks applied but has not navigated is the same silent-failure shape DIFF-1501
was filed for, so the click is made to do the whole job. `Enter` and the search
button still work, and still submit free text.

Three smaller ones, all pre-existing and all recorded rather than changed:

* the mock renders the new-style bar on the three pages where the source runs the
  legacy one (§1.1);
* the source removes the trailing `<input>` from the bar entirely once a token is
  applied and re-creates it on focus; the mock keeps it. Measured:
  `/root/metaseq/-/issues/?state=opened&label_name[]=bug` has **zero** inputs
  inside `.gl-filtered-search` on the source. Round 15's DIFF-1501 probe used
  that input as its handle, so keeping it is also what keeps the finding
  re-testable.
* the source's bar carries a `Recent searches` history toggle at its left edge.
  The mock does not, and did not before this round. Adding it unbacked would be a
  dead affordance; it is left out and recorded here.

### 2.3 Three corrections after an independent re-test

A second agent (`r16-tokenbar-retry`) was spawned as a duplicate of me on the
mistaken belief that I had died, and re-tested this implementation on its own
port. Its report found three divergences. I re-measured all three against the
source myself before acting on any of them — an agent's report is a lead, not an
authority — and all three were real:

| # | finding | verified how | fixed in |
|---|---|---|---|
| A | the source pins the **signed-in user** at the head of every user value list, membership or not; the mock listed members only | `root/metaseq`'s own members page lists exactly one member (`@root`), yet the source's `Assignee =` list leads with `@byteblaze`. Reproduced on `primer/design` `Author =` too | `projectMembers()` in `searchTokens.js` |
| B | the milestone divider sat one row too early — mock `None, Any, ―, Upcoming, Started`, source `None, Any, Upcoming, Started, ―` | my own §1.4 probe already recorded the source's order; the implementation did not follow it | `extraNoneAny` + `valueOptions()` |
| C | `.gl-filtered-search-scrollable` rendered 40px against the source's 32px | measured: the input's default `form-control` height was pushing the row past the 24px the tokens use | `global.css` |

**A is the one that mattered.** "Assigned to me" is the most likely filter an
agent reaches for, and it was unclickable on every project `byteblaze` is not a
member of. It is now `…?state=opened&assignee_username%5B%5D=byteblaze&first_page_size=20`
from three clicks on `/root/metaseq/-/issues`.

After the fixes, measured against the source list for list:

| page · token | source | mock |
|---|---|---|
| `/root/metaseq` `Assignee =` | `None, Any, ―, Byte Blaze /@byteblaze, Administrator /@root` | **identical** |
| `/primer/design` `Author =` | `Byte Blaze /@byteblaze, Primer /@primer` | **identical** |
| `/root/metaseq` `Milestone =` | `None, Any, Upcoming, Started, ―` | **identical** |
| `.gl-filtered-search-scrollable` / token height | 32px / 24px | **32px / 24px** |

One residual, recorded not fixed: on `/a11yproject/a11yproject.com` the source
orders the two non-current members `Roshan Jossy`, `The A11Y Project` and the
mock orders them `The A11Y Project`, `Roshan Jossy` — seed member order rather
than whatever GitLab sorts by. The pin is right, the set is right, no anchor
reads the order.

The same agent's report also confirmed independently: the 9/13/6/12 token-type
split and its ordering (4/4 pages), the operator copy including `is not one of`,
`not[…]` spelling on all 7 params that can be driven, and that the source's
`sort=created_date` / `scope=all` are correctly not copied.

---

## 3 · Verification

Dev server `--port 5351`, production preview `--port 5353`, 1280×720 unless
stated. Every number below is from a run, not an estimate.

### 3.1 Token acceptance — apply by CLICKING, then round-trip the URL

27 cases across all four list flavours. For each: click the type, the operator
and the value; assert the URL carries the source's param form; assert the row set
changed; **load that URL cold in a fresh context** and assert the token renders
and the row count matches; then click the token's close button and assert the
param leaves the URL.

```
dev  (5351)  TOKEN CASES 27/27 · console errors 0 · pageerrors 0   [after §2.3]
prod (5353)  TOKEN CASES 25/25 · console errors 0 · pageerrors 0   [before §2.3]
```

**Be precise about which bundle carries which run.** The 27-case suite was run
on the dev bundle *after* §2.3's fixes. The production bundle was fully verified
*before* them (25 cases, plus the 145-route sweep and the 12-task test, all
clean); its re-run after the fixes was still in flight when this round closed and
is **not** claimed here. §2.3 changes one value list's contents, one array's
order and three CSS declarations — none of it bundle-specific, and `npm run
build` after the fixes is clean and the emitted bundle contains them — but that
is an argument, not a measurement, and it is labelled as one.

Two of the 27 were added after §2.3's fixes and would have failed before them:
`Assignee = Byte Blaze` on `root/metaseq` (a project `byteblaze` is not a member
of) and `Milestone = Started` on `a11yproject.com`.

Covered: `Label` `=` / `!=` / `= None`; `Assignee` `=` / `!=` / `= None` / `= Any`
/ `= <the signed-in user>` (both the array and the scalar page);
`Author` `=` / `!=`; `Confidential`;
`Search Within`; `Type` `=` / `!=`; `Milestone` `=` / `!=` / `= None`;
`My-Reaction`; `Release`; `Draft`; `Target-Branch`; `Reviewer`; on
`/root/metaseq/-/issues`, `/a11yproject/a11yproject.com/-/issues`,
`/primer/design/-/merge_requests`, `/dashboard/issues` and
`/dashboard/merge_requests`.

Value lists come from the seed only — the `Assignee` list on `root/metaseq` is
`Administrator/@root` because that is the project's only seeded member, and the
test was corrected to click a real member rather than the label being invented to
fit it.

### 3.2 Round 14's 12-task URL test — driven AND direct

```
dev  (5351)  exact-on-drive 9/12 · evaluator-on-drive 12/12
             preserved-on-direct 12/12 · evaluator-on-direct 12/12 · 0 errors
prod (5353)  exact-on-drive 9/12 · evaluator-on-drive 12/12
             preserved-on-direct 12/12 · evaluator-on-direct 12/12 · 0 errors
```

Round 15 scored **10/12 on drive**, counting webarena-106 and webarena-343 as
*not driven* because no click path existed. Both are now driven through the token
bar (`Label != BUG`, `Label = None`) and both score 1. The three that are not
byte-exact are supersets that `URLEvaluator` scores 1:

| task | driven | why not byte-exact |
|---|---|---|
| webarena-45 | `…&first_page_size=20` extra | round 15's known, provably inert extra param |
| webarena-106 | `…&first_page_size=20` extra | the source's own bar adds `sort`, `state` **and** `first_page_size` here too, so byte-exactness against this anchor is not reachable while matching the source |
| webarena-343 | `…&state=opened…&first_page_size=20` extra | same |

### 3.3 Interaction edge cases, driven

| # | check | result |
|---|---|---|
| 1 | typing `lab` narrows the type list | `['Label']` — exactly what the source does |
| 2 | two tokens compose | `…?state=opened&label_name%5B%5D=bug&author_username=root&first_page_size=20`, both chips render |
| 3 | `Label` is repeatable | `…&label_name%5B%5D=bug&label_name%5B%5D=enhancement&…` |
| 4 | free text composes with tokens | `…?search=model&state=opened&label_name%5B%5D=bug&label_name%5B%5D=enhancement&author_username=root&…` |
| 5 | `Clear` | back to `…?state=opened&first_page_size=20`, 0 tokens |
| 6 | `Escape` | 9 suggestions → 0 |
| 7 | `?sid=` | preserved across every one of the above |

0 console errors, 0 pageerrors across the whole sequence.

### 3.4 Anchor-route sweep — 145 routes, cold, fresh context, fresh `?sid=`

Each route: fresh browser context, straight to the deep link with no
click-through, then checked for render, console errors, uncaught pageerrors,
`sid` after load, `sid` after clicking the first in-app link, horizontal overflow
at 1280×720, and `<Placeholder>` copy.

```
dev  (5351)  routes 145/145   PROBLEMS 0
prod (5353)  routes 145/145   PROBLEMS 0
```

| check | dev | production |
|---|---|---|
| console errors | 0 / 145 | 0 / 145 |
| uncaught pageerrors | 0 / 145 | 0 / 145 |
| `sid` dropped on load | 0 / 145 | 0 / 145 |
| `sid` dropped after an in-app click | 0 / 145 | 0 / 145 |
| horizontal overflow at 1280×720 | 0 / 145 | 0 / 145 |
| blank / near-empty body | 0 / 145 | 0 / 145 |
| `has not been implemented yet` | 0 / 145 | 0 / 145 |

One production sweep was run and then **discarded**: I rebuilt `dist/` while it
was in flight, and it reported a 404 for a chunk that had just been replaced
under the running preview server. That is an artefact of my own timing, not a
defect; the numbers above are from a clean rebuild-then-sweep on a fresh port,
and the discarded run is named here rather than quietly dropped.

None of the 25 `program_html` anchor locators selects anything inside the
filtered-search bar — checked by pattern over all 25 — so this round could not
move them.

### 3.5 Everything else

| check | result |
|---|---|
| `npm run build` | **PASS** — 173 modules transformed, only the pre-existing chunk-size advisory |
| `npm run preview` on the production bundle | serves the state API; `/go?sid=` answers; **the 145-route sweep, 25 token cases and the 12-task URL test were all run against it and all pass** — all three measured *before* §2.3's fixes. The re-run afterwards was still in flight at close; see §3.1 |
| round-8 responsive geometry, a11y-webring MR 40 | 1280 → content 272–974, nav 0–256, right 990–1280; 1600 → 304–1262 / 0–256 / 1310–1600; 1920 → 464–1422 / 0–256 / 1630–1920; **zero horizontal scroll at all three** — identical to rounds 8 and 15 |
| `?sid=` isolation | `r16A` `state_diff` → `{"a":{"old":1,"new":2}}`, `r16B` → `{}` |
| `{"action":"reset"}` | diff → `{}`, `a` back to `1` |
| `{"action":"set"}` with multi-byte content | `/go` echoes `R16 Injected Name 🐞 Ünïcödé` |
| `/go` top-level keys | 17, unchanged; `ci_pipelines` / `job_specs` / `stage_idx` absent from the payload |
| cold state size | **2 072 728 B**, `SCHEMA.md` updated with the delta and its cause |

---

## 4 · The P2s

### DIFF-1308 · `Auto DevOps enabled` quick link — **FIXED**

The mock rendered it on 175/175 projects. It is `project_auto_devops.enabled`,
and it is **not** derivable from anything already in the seed, so it was measured:
all 175 seeded project overviews were fetched from the source and grepped for the
string. **99 carry it, 76 do not** — and the 4 the round-15 report named
(`byteblaze/dotfiles`, `yjlou/2019-nCov`, `byteblaze/cloud-to-butt`,
`byteblaze/timeit`) are in the 99, which cross-checks the measurement.

It is stored as a new field, `auto_devops_quick_link`, and deliberately **not**
folded into the existing `auto_devops_enabled`. That field is a tri-state
(`false` = an explicit `project_auto_devops` opt-out row on 67 projects, absent =
inherits the instance default) and `Layout.jsx` reads it for the Auto DevOps
**banner** (`if (project.auto_devops_enabled != null) return false`). Writing
`true` onto 99 projects would silently change the banner predicate for all of
them. And the two facts genuinely do not coincide: all 67 explicit opt-outs hide
the link, but **9 of the 108 that inherit ON also hide it**, and only 4 of those 9
are explained by `empty_repo` / `builds_enabled` / `has_ci_config`. Deriving the
link from the banner field would be wrong on five projects.

Re-measured after the fix: **12/12** of the round-15 sample now match the source.
Cost: +2 970 bytes of cold state (99 × 30), reflected in `SCHEMA.md`.

### DIFF-1309 · pipeline `Stage` / `Job dependencies` toggle — **already worked; measured**

`src/utils/ci.js#needsColumns()` and `PipelinesCi.jsx:558` were already wired.
Driven on `/byteblaze/a11y-webring.club/-/pipelines/1823`:

```
Stage            columns: ['build', 'test']
Job dependencies columns: ['build', 'test', 'test', 'test', 'test', 'test', 'test']
```

The graph regroups from 2 stage columns to 7 per-job columns. Round 15's
"clicking leaves `document.body.innerText` byte-identical" does not reproduce.
Nothing was changed for it; it should be closed on this measurement.

### DIFF-1102 · role-badge chip styling — **already fixed; now verified logged in**

Round 15 could not check it anonymously. Measured on both sides **logged in as
`byteblaze`**, on `/a11yproject/a11yproject.com/-/issues/1478`:

| chip | text | title | font-size | border | box-shadow | radius | padding | colour |
|---|---|---|---|---|---|---|---|---|
| `.detail-page-header .user-access-role` | `Developer` = | identical | 12px = | `1px solid rgb(220,220,222)` = | none = | 100px = | `0px 8px` = | `rgb(115,114,120)` = |
| note-author `gl-badge` | `Maintainer` = | identical | 12px = | none = | `rgb(220,220,222) 0 0 0 1px inset` = | 160px = | `4px 8px` = | `rgb(98,97,104)` = |

Every measured property is identical on both sides. **Close it.**

One thing that surfaced while measuring, recorded as a NEW observation rather
than claimed as fixed: on `/primer/design/-/merge_requests/450` the source
renders an `Author` chip (`This user is the author of this merge request.`) where
the mock renders none. It is outside this round's scope and is not DIFF-1102.

### DIFF-1305 · three anchor label filters select zero rows — **NOT attempted, with a reason**

This is the one handed-over P2 that was not cheap, and it was left rather than
half-done. The three anchored labels are real and reachable by clicking; the row
set is empty because **no sampled issue carries them**. Measured the overlap:

| project | label | rows on the source | seeded issues | seeded issues among the source's rows |
|---|---|---|---|---|
| `OpenAPITools/openapi-generator` | `OpenAPI Generator CLI` | 14 | 44 | **0** |
| `keycloak/keycloak` | `flaky-test` | 20 | 44 | **0** |
| `kkroening/ffmpeg-python` | `question` | 20 | 44 | **0** |

Zero overlap in all three, so there is no honest one-line fix: attaching the
label to an already-sampled issue would be fabricating an association the source
does not have. The real fix is importing ~54 new issue rows (plus any authors
they reference that are not seeded) — a seed re-cut, which the pipeline runs as a
serial step, and which needs a state-budget measurement given the ~24 KB of
headroom left under 2 MiB. It costs zero task passes: all three are `url_match`
only and the URLs resolve.

---

## 5 · `AUDIT.md` `P1-2` — corrected

`P1-2` claimed `sortIssuables` has no case for 8 sort tokens and that they fall
through to created-desc. `src/pages/hooks.js` implements all 17, and TEST.md §10
probe 3 showed the 8 collapses are the source's own data (`closed_at` NULL on
610/610 a11yproject issues, `due_date` set on 3 instance-wide,
`relative_position` on 31, `label_priorities` empty). The row is struck through
and annotated with that evidence, and the `BUG-B02` row that pointed at it is
updated to "closed, both halves". Nothing else in `AUDIT.md` was touched.
