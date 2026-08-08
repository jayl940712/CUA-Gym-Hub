# GitLab 15.7.5 Design System (extracted from http://localhost:8023)

**Provenance.** Every value below carries a citation of one of these forms:

| Citation form | Meaning |
|---|---|
| `CSS app.css:NNNN` | Rule from `/assets/application-1e8c169a1e3fd710539d4a64b60f69b9d1bca3ec4b8272d22f36b158ffc276fe.css`. Line numbers refer to that file after `sed 's/}/}\n/g'` (one rule per line) — reproduce with `curl --noproxy '*' <url> \| sed 's/}/}\n/g' > app.lines.css`. |
| `CSS util.css` | Rule from `/assets/application_utilities-9738b4b8a2a962938594e4e9a61166f460a24bef1c8d8513d8c5a2dab6c234d1.css` (same line-splitting). |
| `CSS highlight-white.css` | `/assets/highlight/themes/white-50af3266b171499d73d3026e07fecd6a0fbd80766f824cd0c2866752b8182752.css`. |
| `INLINE theme` | The `<style>` block emitted per-page for `body.ui-indigo` (the active navigation theme). Verified present in `assets/html/proj-dotfiles.html`. |
| `MEASURED <url> <selector>` | `getComputedStyle` / `getBoundingClientRect` in real Chromium at 1920×1080, logged in as `byteblaze`. |

The GitLab source SCSS is **not** available in this container (the image ships
precompiled assets only — `/opt/gitlab/embedded/service/gitlab-rails/app/assets/stylesheets`
does not exist). Everything here therefore comes from the compiled CSS or from
live computed styles, which is the more authoritative source anyway.

---

## 1. Visual Theme

GitLab 15.7 is a **light, high-density, information-first admin UI**. Character:

* **Dark indigo top bar, light everything else.** A single 48px-tall `#292961`
  navbar spans the full width; below it the page is white (`#fff`) with a very
  slightly tinted left sidebar (`#fbfafd`). There is no dark mode in play —
  `<body class="ui-indigo …">` (`MEASURED /byteblaze/dotfiles body.className`).
* **Dense.** Base font size is **14px** (`CSS app.css:3828 body{font-size:0.875rem}`,
  overriding Bootstrap's 1rem at `app.css:34`) with 1.5 line-height. List rows are
  ~65px tall including two lines of text (`MEASURED /a11yproject/a11yproject.com/-/issues
  .issuable-list > li → 1248×65, padding 10px 16px`). Table cells are 16px padded.
* **Flat, borders not shadows.** Almost all separation is a 1px `#dcdcde` hairline.
  Shadows appear only on floating layers (dropdowns, modals, popovers). Buttons
  draw their "border" as an *inset* box-shadow, not a real border
  (`CSS app.css:3486 .gl-button.gl-button{border-width:0; … box-shadow:inset 0 0 0 1px #bfbfc3}`).
* **Small radii.** 4px (`0.25rem`) is the universal radius; pills are `0.75rem`/`160px`;
  avatars are circles by default, `rect-avatar` squares them to 2–8px.
* **Two accent hues.** Interactive blue `#1f75cb` for links and confirm buttons;
  theme indigo/purple `#6666c4` for the active-tab underline and `#292961` for
  the navbar. GitLab-brand orange (`#e24329`) appears *only* in the Tanuki logo.
* **Content is width-limited and centred**, not full-bleed — see §4.

Sanity-checked against `assets/screenshots/reference/proj-dotfiles.png` and
`proj-a11yproject-issues.png` (both @1920×1080).

---

## 2. Color Palette

### 2.1 Structural / semantic tokens

| Token | Hex | Source | Used for |
|---|---|---|---|
| `page-bg` | `#ffffff` | `CSS app.css:34 body{background-color:#fff}`; `MEASURED /byteblaze/dotfiles body → rgb(255,255,255)` | Page and content background |
| `content-bg` | `#ffffff` | `MEASURED /a11yproject/…/-/issues/1517 .right-sidebar → rgb(255,255,255)` | Cards, sidebars, tables |
| `navbar-bg` | `#292961` | `INLINE theme body.ui-indigo .navbar-gitlab{background-color:#292961}`; `MEASURED .navbar-gitlab → rgb(41,41,97)` | Top navigation bar |
| `navbar-text` | `#d1d1f0` | `INLINE theme body.ui-indigo .navbar-gitlab .navbar-nav{color:#d1d1f0}`; `MEASURED .navbar-gitlab .navbar-nav .nav-item > a → rgb(209,209,240)` | Navbar icons + links |
| `navbar-item-hover-bg` | `rgba(209,209,240,0.2)` | `INLINE theme … .navbar-nav>li>a:hover{background-color:rgba(209,209,240,0.2)}` | Navbar item hover |
| `navbar-item-active-bg` | `#ffffff` | `INLINE theme … .nav>li.active>a{color:#292961;background-color:#fff}` | Open/active navbar dropdown |
| `navbar-item-active-fg` | `#292961` | same rule as above | Text on active navbar item |
| `navbar-search-bg` | `rgba(209,209,240,0.2)` | `INLINE theme body.ui-indigo .header-search{background-color:rgba(209,209,240,0.2)!important;border-radius:4px}` | Global search field |
| `navbar-toggler-border` | `#6868b9` | `INLINE theme … .navbar-toggler{border-left:1px solid #6868b9}` | Hamburger divider |
| `sidebar-bg` | `#fbfafd` (gray-10) | `CSS app.css:5371 .nav-sidebar{…background-color:#fbfafd;border-right:1px solid #e9e9e9}`; `MEASURED → rgb(251,250,253)` | Left contextual sidebar |
| `sidebar-border` | `#e9e9e9` | `CSS app.css:5371` (same rule) | Sidebar right edge |
| `sidebar-item-hover-bg` | `rgba(31,30,36,0.08)` | `CSS app.css:5384 .nav-sidebar li>a:hover{background-color:rgba(31,30,36,0.08)}` | Sidebar hover |
| `sidebar-item-active-bg` | `rgba(31,30,36,0.08)` | `CSS app.css:5386 .nav-sidebar li.active:not(.fly-out-top-item)>a:not(.has-sub-items)`; `MEASURED .nav-sidebar .active > a → rgba(31,30,36,0.08)` | Selected sidebar item |
| `sidebar-item-active-fg` | `#333238`, weight 600 | `CSS app.css:5385 .nav-sidebar li.active>a{font-weight:600}` + `INLINE theme body.ui-indigo .nav-sidebar li.active>a{color:#333238}` | Selected sidebar label |
| `sidebar-flyout-bg` | `#ececef` / text `#333238` | `INLINE theme … .nav-sidebar .fly-out-top-item a{background-color:var(--gray-100,#ececef);color:var(--gray-900,#333238)}` | Collapsed-sidebar fly-out menu |
| `border-default` | `#dcdcde` (gray-100) | `CSS util.css .gl-border-gray-100{border-color:#dcdcde}`; used by `.card`, `.table`, `.detail-page-header`, `.gl-tabs-nav` | Default 1px hairline |
| `border-light` | `#ececef` (gray-50) | `CSS app.css:6998 .projects-list>li{border-bottom:1px solid #ececef}` | List-row separators |
| `border-strong` | `#bfbfc3` (gray-200) | `CSS app.css:3486` button inset border; `CSS app.css:1136 .modal-header{border-bottom:1px solid #bfbfc3}` | Buttons, modal chrome |
| `border-input` | `#89888d` (gray-400) | `CSS app.css:440 .form-control{border:1px solid #89888d}`; `MEASURED .form-control → rgb(137,136,141)` | Text inputs |
| `body-text` | `#333238` (gray-900) | `CSS app.css:34 body{color:#333238}`; `MEASURED body → rgb(51,50,56)` | Default text |
| `text-strong` | `#1f1e24` (gray-950) | `CSS util.css .gl-text-gray-950{color:#1f1e24}`; `CSS app.css:3836 code{color:#1f1e24}` | Inline code, emphasis |
| `text-muted` | `#737278` (gray-500) | `CSS util.css .gl-text-secondary{color:#737278}`; `CSS app.css:3855 .text-secondary{color:#737278!important}`; `MEASURED .issuable-info → rgb(115,114,120)` | Metadata, timestamps |
| `text-muted-alt` | `#626168` (gray-600) | `CSS app.css:2379 .text-muted{color:#626168!important}`; `CSS app.css:674 .dropdown-header{color:#626168}` | Dropdown headers, `::before` separators |
| `text-disabled` | `#89888d` (gray-400) | `CSS app.css:3680 .gl-tab-nav-item.disabled{color:#89888d}`; `CSS app.css:4725 .form-control::placeholder{color:#89888d}` | Disabled + placeholder |
| `table-cell-text` | `#535158` (gray-700) | `CSS app.css:3714 table.gl-table tr td{color:#535158}`; `MEASURED /byteblaze/dotfiles/-/project_members table tbody td → rgb(83,81,88)` | `.gl-table` body cells |
| `link` | `#1f75cb` (blue-500) | `CSS app.css:51 a{color:#1f75cb}` and `app.css:3407 .gl-link{font-size:0.875rem;color:#1f75cb}`; `MEASURED a → rgb(31,117,203)` | All links |
| `link-active` | `#0b5cad` (blue-700) | `CSS app.css:3409 .gl-link:active{color:#0b5cad}` | Pressed link |
| `focus-ring` | `#428fdc` (blue-400) | `CSS app.css:3494 …:focus{box-shadow:… 0 0 0 1px #fff, 0 0 0 3px #428fdc}` | Universal focus outline |

### 2.2 Action colors (buttons)

| Token | Hex | Source | Used for |
|---|---|---|---|
| `confirm-bg` | `#1f75cb` | `CSS app.css:3507 .gl-button.gl-button.btn-confirm{background-color:#1f75cb;box-shadow:inset 0 0 0 1px #1068bf}`; `MEASURED "New issue" .btn-confirm → rgb(31,117,203)` | Primary/confirm button |
| `confirm-border` | `#1068bf` (blue-600) | same rule | Confirm inset border |
| `confirm-hover-bg` | `#1068bf` | `CSS app.css:3509` (`:focus`) / `:hover` sibling | Confirm hover |
| `confirm-active-bg` | `#0b5cad` | `CSS app.css:3510 .btn-confirm:active{…background-color:#0b5cad}` | Confirm pressed |
| `default-btn-bg` | `#ffffff` | `CSS app.css:3490 .gl-button.gl-button.btn-default{background-color:#fff}` | Secondary button |
| `default-btn-border` | `#bfbfc3` | `CSS app.css:3486` (inset shadow on all `.gl-button`) | Secondary button edge |
| `default-btn-hover-bg` | `#ececef` | `CSS app.css:3492 .btn-default:hover{box-shadow:inset 0 0 0 2px #89888d,0 2px 2px 0 rgba(0,0,0,0.08);background:#ececef}` | Secondary hover |
| `default-btn-active-bg` | `#dcdcde` | `CSS app.css:3496` | Secondary pressed |
| `danger-bg` | `#dd2b0e` (red-500) | `CSS app.css:3527 .gl-button.gl-button.btn-danger{background-color:#dd2b0e;box-shadow:inset 0 0 0 1px #c91c00}` | Destructive button |
| `danger-hover-bg` | `#c91c00` (red-600) | `CSS app.css:3528` | Destructive hover |
| `danger-active-bg` | `#ae1800` (red-700) | `CSS app.css:3530` | Destructive pressed |
| `success-bg` | `#108548` (green-500) | `CSS app.css:3517 .gl-button.gl-button.btn-success{background-color:#108548;box-shadow:inset 0 0 0 1px #217645}` | Success button |
| `warning` | `#ab6100` (orange-500) | `CSS util.css .gl-text-orange-500{color:#ab6100}`; `:root{--warning:#ab6100}` at `app.css` `:root` block | Warning semantic |

### 2.3 Status / badge colors

| Token | BG | FG | Source | Used for |
|---|---|---|---|---|
| `badge-success` | `#c3e6cd` | `#24663b` | `CSS app.css .gl-badge.badge-success{background-color:#c3e6cd;color:#24663b}` | **Issue open**, **MR open** |
| `badge-info` | `#cbe2f9` | `#0b5cad` | `CSS app.css .gl-badge.badge-info{background-color:#cbe2f9;color:#0b5cad}` | **Issue closed**, **MR merged** |
| `badge-warning` | `#f5d9a8` | `#8f4700` | `CSS app.css .gl-badge.badge-warning{…}` | Warning counters |
| `badge-danger` | `#fdd4cd` | `#ae1800` | `CSS app.css .gl-badge.badge-danger{…}` | MR closed / error counters |
| `badge-neutral` | `#dcdcde` | `#535158` | `CSS app.css .gl-badge.badge-neutral{…}` | Neutral counters |
| `badge-muted` | `#ececef` | `#626168` | `CSS app.css .gl-badge.badge-muted{…}`; `MEASURED .gl-tab-counter-badge → bg rgb(236,236,239), fg rgb(98,97,104)` | Tab counters, sidebar counts |
| `badge-tier` | `#e1d8f9` | `#5943b6` | `CSS app.css:3005 .gl-badge.badge-tier{background-color:#e1d8f9;color:#5943b6}` | License-tier pills (not used in this seed) |

**Issue / MR state — verified by direct measurement, do not guess:**

| State | Classes on the element | BG / FG | Source |
|---|---|---|---|
| Issue **Open** | `gl-badge badge badge-pill badge-success md issuable-status-badge issuable-status-badge-open` | `#c3e6cd` / `#24663b` | `MEASURED /a11yproject/a11yproject.com/-/issues/1517 → rgb(195,230,205)/rgb(36,102,59)` |
| Issue **Closed** | `… badge-info … issuable-status-badge-closed` | `#cbe2f9` / `#0b5cad` | `MEASURED /byteblaze/a11y-syntax-highlighting/-/issues/1 → rgb(203,226,249)/rgb(11,92,173)` |
| MR **Open** | `… badge-success … issuable-status-badge-open` | `#c3e6cd` / `#24663b` | `MEASURED /a11yproject/a11yproject.com/-/merge_requests/1071` |
| MR **Merged** | `… badge-info … issuable-status-badge-merged` | `#cbe2f9` / `#0b5cad` | `MEASURED /a11yproject/a11yproject.com/-/merge_requests/1298` |

> ⚠️ **Correction to a common assumption.** In GitLab **15.7 the merged-MR badge is
> BLUE, not purple** — it reuses `badge-info`. The only purple/merge association is
> the text-only helper `CSS app.css:6334 .merge-request-status.merged{color:#1f75cb}`
> (also blue) and the merged-MR widget banner, which is `gl-bg-blue-50` =
> `#e9f3fc` (`MEASURED MR 1298 .mr-widget-body → rgb(233,243,252)`).
> A "MR-merged purple" token does not exist in this build. Build it blue.

Text-only state colors (used in compact list contexts):
`CSS app.css:6334-6336 .merge-request-status.merged{color:#1f75cb}`,
`.closed{color:#dd2b0e}`, `.open{color:#108548}`.

### 2.4 Alert / flash backgrounds

| Token | Hex | Icon color | Source |
|---|---|---|---|
| `alert-info-bg` | `#e9f3fc` | `#1068bf` | `CSS app.css .gl-alert-info{background-color:#e9f3fc}` + `.gl-alert-info .gl-alert-icon{color:#1068bf}`; `MEASURED /byteblaze/dotfiles .gl-alert-info → rgb(233,243,252)` |
| `alert-warning-bg` | `#fdf1dd` | `#9e5400` | `CSS app.css .gl-alert-warning{background-color:#fdf1dd}`; `MEASURED .gl-alert-warning → rgb(253,241,221)` |
| `alert-success-bg` | `#ecf4ee` | `#217645` | `CSS app.css .gl-alert-success{background-color:#ecf4ee}` |
| `alert-danger-bg` | `#fcf1ef` | `#c91c00` | `CSS app.css .gl-alert-danger{background-color:#fcf1ef}` |
| `alert-tip-bg` | `#ececef` | `#626168` | `CSS app.css .gl-alert-tip{background-color:#ececef}` |

Legacy flash classes map identically:
`CSS app.css .flash-alert{background-color:#fcf1ef}`, `.flash-notice{#e9f3fc}`,
`.flash-success{#ecf4ee}`, `.flash-warning{#fdf1dd}`.

### 2.5 Full ramps (from `application_utilities.css` `.gl-text-*` / `.gl-bg-*`)

```
gray   10 #fbfafd   50 #ececef  100 #dcdcde  200 #bfbfc3  300 #a4a3a8
       400 #89888d  500 #737278 600 #626168  700 #535158  800 #434248
       900 #333238  950 #1f1e24
blue    50 #e9f3fc  100 #cbe2f9 200 #9dc7f1  300 #63a6e9  400 #428fdc
       500 #1f75cb  600 #1068bf 700 #0b5cad  800 #064787  900 #033464
green   50 #ecf4ee  100 #c3e6cd 200 #91d4a8  400 #2da160  500 #108548
       600 #217645  700 #24663b 800 #0d532a  900 #0a4020
orange  50 #fdf1dd  100 #f5d9a8 200 #e9be74  300 #d99530  400 #c17d10
       500 #ab6100  600 #9e5400 700 #8f4700  800 #703800  900 #5c2900
red     50 #fcf1ef  100 #fdd4cd 500 #dd2b0e  600 #c91c00  700 #ae1800
       800 #8d1300  900 #660e00
purple  50 #f4f0ff  light #ede8fb  600 #694cc0  700 #5943b6  800 #453894
theme-indigo  50 #f1f1ff  200 #c7c7f2  300 #a2a2e6  500 #6666c4
              700 #41419f  900 #222261   (navbar uses #292961, see INLINE theme)
```

### 2.6 Brand colors (Tanuki logo only)

| Token | Hex | Source | Used for |
|---|---|---|---|
| `tanuki-red` | `#e24329` | `CSS app.css:4979 .tanuki-logo .tanuki{fill:#e24329}` | Logo body |
| `tanuki-orange` | `#fc6d26` | `CSS app.css:4981 .tanuki-logo .left-cheek,.right-cheek{fill:#fc6d26}` | Logo cheeks |
| `tanuki-light-orange` | `#fca326` | `CSS app.css:4983 .tanuki-logo .chin{fill:#fca326}` | Logo chin |
| `theme-accent` (purple/indigo) | `#6666c4` | `INLINE theme body.ui-indigo{--gl-theme-accent:#6666c4}`; `MEASURED .gl-tab-nav-item-active box-shadow → rgb(102,102,196) 0 -2px 0 0 inset` | Active-tab underline |

**GitLab orange is not used anywhere in the chrome** — only inside the SVG logo.
Do not tint buttons or accents orange.

---

## 3. Typography

Font stacks (`CSS app.css :root` block, verbatim):

```css
--font-family-sans-serif:
  var(--default-regular-font, -apple-system), BlinkMacSystemFont, "Segoe UI",
  Roboto, "Noto Sans", Ubuntu, Cantarell, "Helvetica Neue", sans-serif,
  "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";

--font-family-monospace:
  var(--default-mono-font, "Menlo"), "DejaVu Sans Mono", "Liberation Mono",
  "Consolas", "Ubuntu Mono", "Courier New", "andale mono", "lucida console",
  monospace;
```

`MEASURED /byteblaze/dotfiles body fontFamily` resolves to exactly the sans stack above.

| Role | Font | Size | Weight | Line-height | Color | Source |
|---|---|---|---|---|---|---|
| Body / default | sans | **14px** (`0.875rem`) | 400 | 21px (1.5) | `#333238` | `CSS app.css:3828 body{font-size:0.875rem}` + `app.css:34`; `MEASURED body → 14px/400/21px/rgb(51,50,56)` |
| `h1` (Bootstrap base) | sans | 35px (`2.1875rem`) | 600 | 1.2 | `#333238` | `CSS app.css:88 h1,.h1{font-size:2.1875rem}` + `app.css:87` |
| `h2` base | sans | 28px (`1.75rem`) | 600 | 1.2 | `#333238` | `CSS app.css:89` |
| `h3` base | sans | 24.5px (`1.53125rem`) | 600 | 1.2 | `#333238` | `CSS app.css:90` |
| `h4` base | sans | 21px (`1.3125rem`) | 600 | 1.2 | `#333238` | `CSS app.css:91` |
| **Project title** (`.home-panel-title`, an `h1`) | sans | **23px** (`gl-font-size-h1` = `1.4375rem`) | 600 | 27.6px | `#333238` | `MEASURED /byteblaze/dotfiles h1.home-panel-title → 23px/600/27.6px`; matches `CSS util.css .gl-font-size-h1{font-size:1.4375rem}` |
| **Issue/MR title** (`.title-container h1`) | sans | **28px** | 600 | 33.6px | `#333238` | `MEASURED /byteblaze/a11y-syntax-highlighting/-/issues/1 .title-container h1 → 28px/600/33.6px, margin 0 0 16px` |
| Markdown `h1` (`.md h1`) | sans | 24.5px (`1.75em` of 14px) | 600 | — | `#333238`, `border-bottom:1px solid #e6e6ea`, `padding-bottom:0.3em`, `margin:24px 0 16px` | `CSS app.css:5531` |
| Markdown `h2` | sans | 21px (`1.5em`) | 600 | — | same + bottom border | `CSS app.css:5533`; `MEASURED h2 → 21px/600/25.2px, border-bottom 1px rgb(230,230,234)` |
| Markdown `h3` | sans | 18.2px (`1.3em`) | 600 | 21.84px | `#333238` | `CSS app.css:5534`; `MEASURED h3 → 18.2px` |
| Markdown `h4` | sans | 16.8px (`1.2em`) | 600 | 20.16px | `#333238` | `CSS app.css:5535`; `MEASURED h4 → 16.8px` |
| **Navbar item** | sans | **12px** | 600 | 18px | `#d1d1f0` | `MEASURED .navbar-gitlab .navbar-nav .nav-item > a → 12px/600/18px/rgb(209,209,240), padding 6px 8px, margin 4px 0, radius 4px, height 32px` |
| Navbar brand title | sans | 18px | 400 | 27px | inherits `#d1d1f0` | `CSS app.css:4757 .navbar-gitlab .header-content .title{font-size:18px}`; `MEASURED .navbar-gitlab .title → 18px, height 48px` |
| **Sidebar item** | sans | **14px** | 400 (600 when active) | 16px | `#333238` | `CSS app.css:5383` (`padding:0.5rem 0.75rem; line-height:1rem; margin:1px 8px; border-radius:0.25rem`), `app.css:5385`; `MEASURED .nav-sidebar .active>a → 14px/600/16px, padding 4px, margin 2px 8px 4px, 240×40` |
| Sidebar sub-item (fly-out) | sans | 12px | 400 | — | `#333238` on `#ececef` | `CSS app.css:5392` (`font-size:0.75rem`) |
| **Table header** (`.gl-table th`) | sans | **14px** | 600 | 16px | `#333238` | `CSS app.css:3713 table.gl-table tr th{font-weight:600;color:#333238}` + `app.css:3712` (`padding:1rem`); `MEASURED /byteblaze/dotfiles/-/project_members thead th → 14px/600/16px, padding 16px` |
| **Table cell** (`.gl-table td`) | sans | 14px | 400 | 16px | `#535158` | `CSS app.css:3714`; `MEASURED tbody td → 14px/400/16px/rgb(83,81,88), padding 16px, border 1px solid #dcdcde top+bottom` |
| Legacy table header (`.tree-table th`, markdown tables) | sans | 14px | 700 | 21px | `#333238` on `#ececef` | `CSS app.css:5470 table.table:not(.gl-table) tr th{background-color:#ececef;border-bottom:0}` + `app.css:5469` (`padding:10px 16px;line-height:20px`); `MEASURED .tree-table th → bg rgb(236,236,239), 700, padding 10px 16px` |
| **Button** | sans | 14px (`0.875rem`) | 400 | 16px (`1rem`) | per variant | `CSS app.css:3486 .gl-button.gl-button{…line-height:1rem;font-size:0.875rem;border-radius:0.25rem}`; `MEASURED .btn-confirm → 14px/400/16px, padding 8px 12px, height 32px` |
| Button (icon-only / small) | sans | 14px | 400 | 16px | — | `CSS app.css:3502 .gl-button.btn-sm{padding:0.25rem 0.5rem;line-height:1rem;font-size:0.875rem}`; `MEASURED .btn-sm → 24×24, padding 4px` |
| **Small / muted** | sans | 12px (`gl-font-sm` = `0.75rem`) | 400 | 16px | `#737278` | `CSS util.css .gl-font-sm{font-size:0.75rem}` + `.gl-text-secondary{color:#737278}`; `MEASURED .issuable-info → 14px/rgb(115,114,120)` (metadata line is 14px muted; `gl-font-sm` is used for badges/labels) |
| Badge / label pill text | sans | **12px** | 400 | 16px | per variant | `CSS app.css .gl-badge{font-size:0.75rem;font-weight:400;line-height:1rem;padding:0.25rem 0.5rem}`; `MEASURED .gl-label-text → 12px/400/16px` |
| Tab label | sans | 14px | 400 → **600 active** | 16px | `#333238` | `CSS app.css:3677 .gl-tab-nav-item{…padding:1rem 0.75rem;line-height:1rem;font-size:0.875rem}` + `app.css:3684`; `MEASURED .gl-tab-nav-item → 14px/600/16px, padding 16px 12px, height 48px` |
| Dropdown item | sans | 14px | 400 | 16px | `#333238` | `CSS app.css:4320 .dropdown-menu li>a{padding:8px 12px;color:#333238;line-height:16px}`; `MEASURED open dropdown li>a → 14px/400/16px, 338×32` |
| Form label | sans | 14px | **600** | — | `#333238` | `CSS app.css:4699 label{font-weight:600}` + `app.css:63 label{margin-bottom:0.5rem}` |
| Form input | sans | 14px | 400 | 16px | `#333238` | `CSS app.css:3845 .form-control{font-size:0.875rem}`; `MEASURED .form-control → 14px/400/16px` |
| Issue-list row title | sans | 14px | **600** | 21px | `#333238` | `MEASURED /a11yproject/a11yproject.com/-/issues .issue-title-text → 14px/600/21px` |
| Modal title | sans | 16px (`1rem`) | 600 | 24px (`1.5rem`) | `#333238` | `CSS app.css:3470 .gl-modal .modal-header .modal-title{font-size:1rem;font-weight:600;line-height:1.5rem}` |
| **Monospace / code (blob view)** | mono stack above | `90%` of parent (≈12.6px) | 400 | — | per syntax theme | `CSS app.css:4889 .file-content.code pre{font-family:var(--default-mono-font,"Menlo"),…;font-size:90%;padding:10px 0}` |
| Inline code (`code`, `.md code`) | mono | 14px (`0.875rem`) | 400 | 22.4px | `#1f1e24` on `#ececef`, radius 4px, padding 2px 4px | `CSS app.css:3836 code{padding:2px 4px;color:#1f1e24;background-color:#ececef;border-radius:4px}` + `app.css:5530`; `MEASURED .md code → 14px, bg rgb(236,236,239), color rgb(31,30,36), radius 4px, padding 2px 4px` |
| Code block (`.md pre`) | mono | inherits | 400 | `1.6em` | radius 4px, `margin-bottom:16px`, `overflow-x:auto` | `CSS app.css:5573` |
| Commit SHA (`.gfm-commit`) | mono | `95%` | — | — | — | `CSS app.css:4747` |

Line-height utility scale (`CSS util.css`):
`gl-line-height-normal:1rem`, `-20:1.25rem`, `-24:1.5rem`, `-28:1.75rem`,
`-32:2rem`, `-36:2.25rem`, `-42:2.625rem`.
Weight utilities: `.gl-font-weight-normal{400}`, `.gl-font-weight-bold{600}` —
note GitLab's "bold" is **600**, never 700, except legacy `b,strong{font-weight:bold}`
(`CSS app.css:3834`) and legacy table `th`.

---

## 4. Spacing & Layout

### 4.1 Fixed chrome dimensions (all measured)

| Element | Value | Source |
|---|---|---|
| **Navbar height** | **48px** | `CSS app.css:4754 .navbar-gitlab{padding:0 16px;position:fixed;top:0;left:0;right:0;min-height:var(--header-height,48px)}`; `MEASURED .navbar-gitlab → height 48px, padding 0 16px, full 1920px width` |
| Navbar horizontal padding | 16px | same rule |
| Navbar z-index | 1000 | `CSS app.css:4754` |
| Global search field | 320px min-width, 32px tall, 640px max | `CSS app.css:4769 .navbar-gitlab .header-search{min-width:320px}` + `app.css:4767 .header-search-new{max-width:640px}`; `MEASURED .header-search → 320×32` |
| **Left sidebar width (expanded)** | **256px** | `CSS app.css:5371 .nav-sidebar{position:fixed;bottom:0;left:0;width:256px;top:var(--header-height,48px);background-color:#fbfafd;border-right:1px solid #e9e9e9;z-index:600}`; `MEASURED .nav-sidebar → 256×1032 at x=0,y=48` |
| **Left sidebar width (collapsed)** | **56px** | `CSS app.css:5372 .nav-sidebar.sidebar-collapsed-desktop{width:56px}` |
| Page offset for sidebar | `padding-left:56px` @≥768px, `256px` @≥1200px | `CSS app.css:5364,5366 .page-with-contextual-sidebar`; `MEASURED .layout-page → padding 0 0 0 256px at 1920w` |
| Sidebar item box | 240×40, `margin:2px 8px 4px`, `padding:4px`, radius 4px | `CSS app.css:5383 .nav-sidebar li>a{padding:0.5rem 0.75rem;border-radius:0.25rem;margin:1px 8px;line-height:1rem}`; `MEASURED .nav-sidebar .active>a → 240×40` |
| Sidebar icon gutter | `margin-right:8px` | `CSS app.css:5390 .nav-sidebar .nav-icon-container{display:flex;margin-right:8px}` |
| "Collapse sidebar" footer | 255×48, `padding:0 16px`, bg `#fbfafd` | `MEASURED .toggle-sidebar-button → 255×48, padding 0px 16px, rgb(251,250,253)`; icon color `#737278` per `CSS app.css:3882` |
| **Right sidebar (issue/MR), expanded** | **290px** | `MEASURED /a11yproject/…/-/issues/1517 .right-sidebar → 290×1032 at x=1630`; the wrapper reserves it via `MEASURED .content-wrapper padding → 0px 290px 100px 0px`. Inner `.issuable-sidebar` adds `padding:0 20px`. Left edge is `border-left:1px solid #dcdcde` |
| **Right sidebar, collapsed** | **62px** | `CSS app.css:5290 .right-sidebar.right-sidebar-collapsed{display:none;width:62px;padding:0}` (blocks inside are 60px: `app.css:5295`). Content wrapper then uses `padding-right:62px` (`app.css:5187`) |
| Bulk-update right sidebar | 290px expanded, blocks 250px | `CSS app.css:5211-5212` |
| Content wrapper bottom padding | 100px | `MEASURED .content-wrapper → padding 0 0 100px` |
| Breadcrumb bar | `min-height:48px`, container `padding:8px 0`, `border-bottom:1px solid #dcdcde` | `CSS app.css:4813-4814`; `MEASURED .breadcrumbs-container → padding 8px 0` |

### 4.2 Content width — **two container modes**, measured at 1920×1080

| Mode | Container max-width | Container padding | Resulting content width | Where |
|---|---|---|---|---|
| **Wide** (`.container-fluid.container-limited`) | **1280px** | `0 16px` | **1248px** | Issue/MR *lists*, labels, members, dashboards. `MEASURED /a11yproject/…/-/issues .container-limited → maxWidth 1280px, w=1280 at x=448; #content-body → 1248 at x=464` |
| **Narrow** (`… .limit-container-width`) | **990px** | `0 16px` | **958px** | Project overview, file tree, blob, issue **detail**, MR **detail**. `CSS app.css:3901 .container-limited.limit-container-width{max-width:990px}`; `MEASURED /byteblaze/dotfiles .container-limited → 990 at x=593; #content-body → 958 at x=609` |

Base rule: `CSS app.css:3900 .container-limited{max-width:1280px}`.
Both are horizontally **centred inside `.content-wrapper`** (which itself starts at
x=256 when a left sidebar is present, x=0 on dashboard pages —
`MEASURED /dashboard/projects .layout-page padding → 0px; .content-wrapper → 1920 at x=0; #content-body → 1248 at x=336`).

Full page-geometry examples (1920 viewport, logged in):

```
project overview  /byteblaze/dotfiles
  layout-page  padding-left 256   sidebar 0..256
  content-wrapper  x=256 w=1664  padding 0 0 100px
  container         x=593 w=990   (limit-container-width, padding 0 16px)
  #content-body     x=609 w=958

issues list  /a11yproject/a11yproject.com/-/issues
  content-wrapper  x=256 w=1664
  container         x=448 w=1280  (container-limited, padding 0 16px)
  #content-body     x=464 w=1248

issue detail  /a11yproject/a11yproject.com/-/issues/1517
  content-wrapper  x=256 w=1664  padding-right 290  (right sidebar)
  container         x=448 w=990
  #content-body     x=464 w=958
  right-sidebar     x=1630 w=290

dashboard  /dashboard/projects   (no left sidebar)
  content-wrapper  x=0  w=1920
  container         x=320 w=1280
  #content-body     x=336 w=1248
```

### 4.3 `gl-*` spacing scale (`CSS util.css`)

The scale is **shared across `m`/`p` in every direction** — `gl-mt-N`, `gl-mb-N`,
`gl-ml-N`, `gl-mr-N`, `gl-mx-N`, `gl-my-N`, `gl-m-N`, `gl-pt-N`, `gl-pb-N`,
`gl-pl-N`, `gl-pr-N`, `gl-px-N`, `gl-py-N`, `gl-p-N`.

| Step | rem | px |
|---|---|---|
| `0` | 0 | 0 |
| `1` | 0.125rem | 2px |
| `2` | 0.25rem | 4px |
| `3` | 0.5rem | 8px |
| `4` | 0.75rem | 12px |
| `5` | 1rem | 16px |
| `6` | 1.5rem | 24px |
| `7` | 2rem | 32px |
| `8` | 2.5rem | 40px |
| `9` | 3rem | 48px |
| `11` | 4rem | 64px |
| `13` | 6rem | 96px |

Verified verbatim: `.gl-mt-1{margin-top:0.125rem} … .gl-mt-9{margin-top:3rem}
.gl-mt-11{margin-top:4rem}` and `.gl-p-1{padding:0.125rem} … .gl-p-13{padding:6rem}`,
`.gl-px-5{padding-left:1rem;padding-right:1rem}` (`CSS util.css`).
Steps `10` and `12` are **not emitted** in this build.

### 4.4 Border radius (`CSS util.css`)

| Token | Value | Class |
|---|---|---|
| none | 0 | `.gl-rounded-0` |
| small | `0.125rem` (2px) | `.gl-rounded-small` |
| **base** | **`0.25rem` (4px)** | `.gl-rounded-base` — the default everywhere |
| lg | `0.5rem` (8px) | `.gl-rounded-lg` |
| pill | `0.75rem` (12px) | `.gl-rounded-pill` — used by `.gl-label` |
| 6 / 7 | `1.5rem` / `2rem` | `.gl-rounded-6` / `.gl-rounded-7` |
| full | `50%` | `.gl-rounded-full` — avatars |

Badges resolve to a computed `160px` (`MEASURED .gl-badge → borderRadius 160px`),
which is effectively a capsule; `border-radius:9999px` is an acceptable substitute.
Modals use `0.25rem` (`CSS app.css:3466 .gl-modal .modal-content{border-radius:0.25rem}`)
overriding Bootstrap's `0.3rem` (`app.css:1131`).

### 4.5 Breakpoints

From the `:root` block of `application.css`:

```css
--breakpoint-xs: 0;   --breakpoint-sm: 576px;  --breakpoint-md: 768px;
--breakpoint-lg: 992px;  --breakpoint-xl: 1200px;
```

`@media (min-width: …)` values actually present in `application.css`:
**481px, 575px, 576px, 768px, 992px, 1152px, 1200px**.
Key layout ones: `768px` → sidebar reserved at 56px; `1200px` → sidebar reserved at
256px (`CSS app.css:5364,5366`); `576px` → right sidebar collapse behaviour
(`app.css:5187,5291`); `992px` → MR right sidebar (`app.css:5189,5293`).
Note also `CSS app.css:2398 body{min-width:992px !important}` — GitLab hard-floors
the desktop layout at 992px. **The mock only needs to be correct at ≥1200px**
for a 1920×1080 agent viewport.

---

## 5. Component Patterns

### 5.1 Buttons

The Bootstrap `.btn` base is fully overridden by `.gl-button.gl-button`
(doubled class = higher specificity). Copy the `gl-button` rules, not the `.btn` ones.

```css
/* CSS app.css:3486 — base, applies to every .gl-button */
.gl-button.gl-button {
  border-width: 0;
  padding: 0.5rem 0.75rem;          /* 8px 12px */
  background-color: transparent;
  line-height: 1rem;                /* 16px */
  color: #333238;
  fill: currentColor;
  box-shadow: inset 0 0 0 1px #bfbfc3;   /* "border" is an inset shadow */
  justify-content: center;
  align-items: center;
  font-size: 0.875rem;              /* 14px */
  border-radius: 0.25rem;           /* 4px */
  display: flex;                    /* CSS app.css:3480 region */
}
/* CSS app.css:3487 */
.gl-button.gl-button .gl-button-text { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
/* CSS app.css:3488 */
.gl-button.gl-button .gl-button-icon { height:1rem; width:1rem; flex-shrink:0; margin-right:0.25rem; }

/* CSS app.css:3506 — all filled variants get white text */
.gl-button.gl-button.btn-confirm,
.gl-button.gl-button.btn-info,
.gl-button.gl-button.btn-success,
.gl-button.gl-button.btn-danger { color: #fff; }

/* CSS app.css:3490,3492,3494,3496 — DEFAULT (secondary) */
.gl-button.gl-button.btn-default        { background-color:#fff; }
.gl-button.gl-button.btn-default:hover  { box-shadow: inset 0 0 0 2px #89888d, 0 2px 2px 0 rgba(0,0,0,0.08);
                                          background:#ececef; }
.gl-button.gl-button.btn-default:focus  { box-shadow: inset 0 0 0 1px #89888d, 0 0 0 1px #fff, 0 0 0 3px #428fdc;
                                          outline:none; background-color:#ececef; }
.gl-button.gl-button.btn-default:active { box-shadow: inset 0 0 0 1px #626168, 0 0 0 1px #fff, 0 0 0 3px #428fdc;
                                          outline:none; background-color:#dcdcde; }
/* CSS app.css:3500 */
.gl-button.gl-button.btn-default .gl-icon { color:#737278; }
/* CSS app.css:3491 */
.gl-button.gl-button.btn-default.btn-default-tertiary { background-color: transparent; }

/* CSS app.css:3507,3509,3510 — CONFIRM (primary) */
.gl-button.gl-button.btn-confirm        { background-color:#1f75cb; box-shadow: inset 0 0 0 1px #1068bf; }
.gl-button.gl-button.btn-confirm:focus  { box-shadow: inset 0 0 0 1px #064787, 0 0 0 1px #fff, 0 0 0 3px #428fdc;
                                          outline:none; background-color:#1068bf; }
.gl-button.gl-button.btn-confirm:active { box-shadow: inset 0 0 0 1px #033464, 0 0 0 1px #fff, 0 0 0 3px #428fdc;
                                          outline:none; background-color:#0b5cad; }
/* CSS app.css:3512 — confirm secondary/tertiary (outline) */
.gl-button.gl-button.btn-confirm-secondary,
.gl-button.gl-button.btn-confirm-tertiary { background-color:transparent; color:#1f75cb;
                                            font-weight:400; box-shadow: inset 0 0 0 1px #1f75cb; }

/* CSS app.css:3517 — SUCCESS */
.gl-button.gl-button.btn-success { background-color:#108548; box-shadow: inset 0 0 0 1px #217645; }

/* CSS app.css:3527,3528,3530 — DANGER */
.gl-button.gl-button.btn-danger        { background-color:#dd2b0e; box-shadow: inset 0 0 0 1px #c91c00; }
.gl-button.gl-button.btn-danger:hover  { box-shadow: inset 0 0 0 2px #8d1300, 0 2px 2px 0 rgba(0,0,0,0.08);
                                         background:#c91c00; }
.gl-button.gl-button.btn-danger:active { box-shadow: inset 0 0 0 1px #660e00, 0 0 0 1px #fff, 0 0 0 3px #428fdc;
                                         outline:none; background-color:#ae1800; }
/* CSS app.css:3532 — danger secondary/tertiary */
.gl-button.gl-button.btn-danger-secondary,
.gl-button.gl-button.btn-danger-tertiary { background-color:transparent; color:#dd2b0e;
                                           font-weight:400; box-shadow: inset 0 0 0 1px #dd2b0e; }

/* Sizes — CSS app.css:3502, 3504 */
.gl-button.gl-button.btn-sm   { padding: 0.25rem 0.5rem; line-height:1rem; font-size:0.875rem; }
.gl-button.gl-button.btn-icon { padding: 0.5rem; line-height: 1rem; }
/* .btn-md is the default (no extra rule) */

/* Transition — CSS app.css (2nd .btn block) */
.btn { transition: background-color 100ms linear, border-color 100ms linear,
                   color 100ms linear, box-shadow 100ms linear; }
```

Measured results: `.btn-confirm` ("New issue") → **112.8 × 32px**, padding `8px 12px`,
bg `rgb(31,117,203)`, inset shadow `rgb(16,104,191) 0 0 0 1px`, radius 4px, 14px/400.
`.btn-sm` icon button → **24 × 24**, padding 4px.
**Default button height is 32px; small is 24px.**

Markup GitLab actually emits (from `assets/html/*.html`):
`<button class="btn btn-confirm btn-md gl-button"><span class="gl-button-text">New issue</span></button>`
and `<a class="btn btn-default btn-md gl-button btn-default-tertiary btn-icon">…`.
Class-frequency across the 68 captured pages: `btn` 2646, `btn-default` 1905,
`btn-md` 1604, `btn-default-tertiary` 1314, `btn-icon` 676, `btn-confirm` 206,
`btn-sm` 239, `btn-block` 48.

### 5.2 Form controls

```css
/* CSS app.css:440 (Bootstrap base) */
.form-control {
  display:block; width:100%; height:34px;
  padding:0.375rem 0.75rem; font-weight:400; line-height:1.5;
  color:#333238; background-color:#fff; background-clip:padding-box;
  border:1px solid #89888d; border-radius:0.25rem;
  transition: border-color .15s ease-in-out, box-shadow .15s ease-in-out;
}
/* CSS app.css:3845 + 4717 (GitLab overrides) */
.form-control, .search form { font-size: 0.875rem; }
.form-control { border-radius: 4px; padding: 6px 10px; }
/* CSS app.css:4721 */
.form-control:focus { border-color:#89888d; box-shadow: 0 0 0 1px #fff, 0 0 0 3px #428fdc; outline:none; }
/* CSS app.css:4725 */
.form-control::placeholder { color:#89888d; }
/* CSS app.css:460 */
.form-group { margin-bottom: 1rem; }
/* CSS app.css:63 + 4699 */
label { display:inline-block; margin-bottom:0.5rem; font-weight:600; }
```

`MEASURED .form-control` (search box on issues list) → 14px/400/16px,
bg `rgb(255,255,255)`, `boxShadow: rgb(137,136,141) 0 0 0 1px inset`,
`borderColor rgb(137,136,141)`, radius 4px. Note the resolved appearance uses an
**inset 1px `#89888d` shadow**, matching the button convention.
`.gl-form-input` is an alias applying the same box (`CSS app.css:3226`).

### 5.3 Card

```css
/* CSS app.css:1091 (Bootstrap) */
.card {
  position:relative; display:flex; flex-direction:column; min-width:0;
  word-wrap:break-word; background-color:#fff; background-clip:border-box;
  border:1px solid #dcdcde; border-radius:0.25rem;
}
.card-body   { flex:1 1 auto; min-height:1px; padding:1.25rem; }
.card-header { padding:0.75rem 1.25rem; margin-bottom:0;
               background-color:#fbfafd; border-bottom:1px solid #dcdcde; }
.card-footer { padding:0.75rem 1.25rem; background-color:#fbfafd; border-top:1px solid #dcdcde; }
.card-header:first-child { border-radius: calc(0.25rem - 1px) calc(0.25rem - 1px) 0 0; }
.card-footer:last-child  { border-radius: 0 0 calc(0.25rem - 1px) calc(0.25rem - 1px); }

/* GitLab overrides — CSS app.css:4460-ish region */
.card { margin-bottom: 16px; }
.card-header { padding: 6px 16px; line-height: 36px; }
.card-header .controls { margin-top:-2px; float:right; }
```

So the effective card header is **`padding:6px 16px; line-height:36px`** (≈48px tall),
bg `#fbfafd`, 1px `#dcdcde` bottom border.

### 5.4 Labels — `.gl-label` pills (incl. scoped two-tone)

Labels are driven by **two CSS custom properties set inline per label**:

```html
<!-- verbatim from assets/html/issues-primer-bug.html -->
<span class="gl-label gl-label-sm gl-label-text-light"
      style="--label-background-color: #d73a49; --label-inset-border: inset 0 0 0 1px #d73a49;">
  <a href="?label_name[]=type%3A%20bug%20%F0%9F%90%9E" class="gl-link gl-label-link">
    <span class="gl-label-text">type: bug 🐞</span>
  </a>
</span>
```

```css
/* CSS app.css:3639-ish */
.gl-label {
  align-items:center; background-color:#fff; overflow:hidden;
  display:inline-flex; border-radius:0.75rem;   /* 12px pill */
  position:relative; max-width:100%; font-size:0.875rem;
  box-shadow: var(--label-inset-border) !important;
}
.gl-label:not(.gl-label-scoped) { background-color: var(--label-background-color); }
.gl-label .gl-label-link { line-height:1rem; display:flex; font-size:0.75rem;
                           font-weight:400; overflow:hidden; color:inherit; max-width:100%; }
.gl-label .gl-label-link:hover { color:inherit; box-shadow:none; outline:none; }
.gl-label-text-dark  { color:#1f1e24; }   /* light label bg */
.gl-label-text-light { color:#fff; }      /* dark label bg */
.gl-label:focus-within { box-shadow: inset 0 0 0 1px var(--label-background-color),
                                     0 0 0 1px #fff, 0 0 0 3px #428fdc !important; outline:none; }

/* SCOPED (two-tone "key::value") */
.gl-label-scoped .gl-label-text        { padding-right:0.25rem;
                                         background-color: var(--label-background-color); }
.gl-label-scoped .gl-label-text-scoped { color:#1f1e24;                 /* the right half */
                                         padding-left:0.25rem; padding-right:0.5rem; }
.gl-label .gl-label-text-scoped {
  display:inline-block; padding:0.25rem 0.5rem;
  overflow:hidden; text-overflow:ellipsis; vertical-align:top;
  white-space:nowrap; max-width:100%;
}
/* small variant */
.gl-label-sm .gl-label-text-scoped { padding-top:0; padding-bottom:0; }
/* close button inside a label */
.gl-label > .gl-label-close.gl-button { border-width:0; display:flex;
  margin-left:-0.25rem; margin-right:0.25rem; padding:0; border-radius:50%; box-shadow:none; }
.gl-label-text-light .gl-label-close.gl-button:hover { background-color:#fff; }
.gl-label-text-light .gl-label-close.gl-button:hover .gl-icon { color: var(--label-background-color); }
```

**How the two-tone works:** on a scoped label the *whole pill* keeps
`background-color:#fff` (from `.gl-label`) plus `box-shadow: inset 0 0 0 1px <color>`
(the `--label-inset-border`). The **left half** (`.gl-label-text`) is filled with
`var(--label-background-color)`; the **right half** (`.gl-label-text-scoped`) stays
white with `#1f1e24` text. Result: a coloured "key" chip fused to a white "value"
chip inside a single outlined pill.

Measured (`MEASURED /a11yproject/…/-/issues .gl-label`, non-scoped):
outer 63.3×16, `borderRadius 12px`, `bg rgb(59,75,191)`, `color rgb(255,255,255)`,
`boxShadow rgb(59,75,191) 0 0 0 1px inset`; inner `.gl-label-text` 12px/400/16px,
`padding 0 8px`.
Measured on the labels index page (`/byteblaze/dotfiles/-/labels`, `md` size):
outer 42.7×24, `.gl-label-text padding 4px 8px`, bg `rgb(252,41,41)`, fg `#fff`.
→ `gl-label-sm` = 16px tall (`padding:0 8px`), default = 24px tall (`padding:4px 8px`).

Usage counts in captured HTML: `gl-label` 218, `gl-label-text` 218,
`gl-label-link` 211, `gl-label-sm` 199, `gl-label-text-dark` 134,
`gl-label-text-light` 84. **`gl-label-scoped` count = 0** — this seed dataset has
no scoped labels, so the two-tone style above is from CSS only, not observed
rendering. Implement it, but expect not to exercise it.

Real label colors present in the seed (from inline `--label-background-color`):
`#d73a49`, `#B60205`, `#5319E7`, `#C5DEF5`, `#fef2c0`, `#fc2929`, `#3B4BBF`.
Text class is chosen server-side (`gl-label-text-light` on dark bg,
`gl-label-text-dark` on light bg) — replicate with a luminance test.

### 5.5 Badges

```css
/* CSS app.css:2990-ish */
.gl-badge {
  display:inline-flex; align-items:center;
  font-size:0.75rem; font-weight:400; line-height:1rem;
  padding: 0.25rem 0.5rem;
  /* computed border-radius resolves to 160px (capsule) */
}
.gl-badge.sm { padding-top:0; padding-bottom:0; }      /* 16px tall */
.gl-badge.md { padding-top:0.25rem; padding-bottom:0.25rem; }  /* 24px tall */
.gl-badge.lg { padding-top:0.5rem; padding-bottom:0.5rem; font-size:0.875rem; }
.gl-badge .gl-badge-icon { height:1rem; width:1rem; flex-shrink:0; }

.gl-badge.badge-muted   { background-color:#ececef; color:#626168; }
.gl-badge.badge-neutral { background-color:#dcdcde; color:#535158; }
.gl-badge.badge-info    { background-color:#cbe2f9; color:#0b5cad; }
.gl-badge.badge-success { background-color:#c3e6cd; color:#24663b; }
.gl-badge.badge-warning { background-color:#f5d9a8; color:#8f4700; }
.gl-badge.badge-danger  { background-color:#fdd4cd; color:#ae1800; }
.gl-badge.badge-tier    { background-color:#e1d8f9; color:#5943b6; }
/* hover on link badges: + box-shadow: inset 0 0 0 1px #bfbfc3 (per variant) */
```

Markup: `<span class="gl-badge badge badge-pill badge-success md">13</span>`
(`badge`/`badge-pill` are legacy aliases carried along; 698 occurrences each).
`MEASURED .gl-badge → 12px/400/16px, padding 0 8px (sm) or 4px 8px (md),
borderRadius 160px`.

Tab counter badge: `.gl-tab-counter-badge` → `badge-muted` colors,
`font-weight:inherit` (so 600 when the tab is active), `margin-left:0.25rem`
(`CSS app.css:3682`); `MEASURED → 32.7×16, bg rgb(236,236,239), fg rgb(98,97,104), 600`.

### 5.6 Tables

Two distinct table styles coexist. Use `.gl-table` for new/Vue tables and the
legacy style for markdown + the repository file tree.

```css
/* MODERN — CSS app.css:3711-3714 */
table.gl-table { background-color: transparent; width:100%; }
table.gl-table tr th,
table.gl-table tr td {
  border-bottom-style: solid; border-bottom-width: 1px; border-color: #dcdcde;
  padding: 1rem;                 /* 16px */
  background-color: transparent;
  line-height: 1rem; font-size: 0.875rem; vertical-align: top;
}
table.gl-table tr th { font-weight: 600; color: #333238; }
table.gl-table tr td { color: #535158; }
table.gl-table .table-primary > td { background-color: #e9f3fc; }   /* highlighted row */
table.gl-table tr:focus-visible { box-shadow: 0 0 0 1px #fff, 0 0 0 3px #428fdc;
                                  outline:none; position:relative; z-index:1; }

/* LEGACY — CSS app.css:373-375 + 5469,5470 */
.table { width:100%; margin-bottom:0.5rem; color:#333238; }
.table th, .table td { padding:0.75rem; vertical-align:top; border-top:1px solid #dcdcde; }
.table thead th      { vertical-align:bottom; border-bottom:2px solid #dcdcde; }
.md table:not(.code) tr td,
table.table:not(.gl-table) tr td,
… tr th { padding:10px 16px; line-height:20px; vertical-align:top; }
table.table:not(.gl-table) tr th { background-color:#ececef; border-bottom:0; }
table { border-spacing: 0; }   /* CSS app.css:3838 */
```

`MEASURED /byteblaze/dotfiles/-/project_members`: `thead th` → 14px/600/16px,
padding 16px, border 1px `rgb(220,220,222)` top+bottom; `tbody td` → 14px/400/16px,
`rgb(83,81,88)`, padding 16px, row height 84px.
`MEASURED /byteblaze/dotfiles .tree-table th` → bg `rgb(236,236,239)`, weight **700**,
padding `10px 16px`, height 42px; `td` → padding `10px 16px`, `border-top:1px solid rgb(220,220,222)`,
height 42px, `max-width:320px`.

### 5.7 Tabs

Two systems, visually identical:

```css
/* MODERN (Vue) — CSS app.css:3676-3685 */
.gl-tabs-nav {
  border-style: solid; border-color: #dcdcde;
  border-width: 0; border-bottom-width: 1px;
  display: flex;
}
.gl-tab-nav-item {
  color: #333238;
  padding: 1rem 0.75rem;          /* 16px 12px  → 48px tall */
  line-height: 1rem; font-size: 0.875rem;
  display: flex; justify-content: center; overflow: hidden;
  transition: box-shadow 100ms linear;
}
.gl-tab-nav-item:hover:not(.gl-tab-nav-item-active) { box-shadow: inset 0 -2px 0 0 #bfbfc3; }
.gl-tab-nav-item.disabled { pointer-events:auto; cursor:not-allowed; color:#89888d; }
.gl-tab-nav-item > .gl-tab-counter-badge { font-weight: inherit; margin-left: 0.25rem; }
.gl-tab-nav-item-active {
  font-weight: 600; color: #333238;
  box-shadow: inset 0 -2px 0 0 var(--gl-theme-accent, #6666c4);   /* purple underline */
}

/* LEGACY (Rails) — CSS app.css:5083-5089 */
.nav-links { display:flex; padding:0; margin:0; list-style:none; height:auto;
             border-bottom:1px solid #dcdcde; }
.nav-links li:not(.md-header-toolbar) a,
.nav-links li:not(.md-header-toolbar) button {
  padding: 1rem 0.75rem; font-size:0.875rem; line-height:1rem;
  color:#737278; border:0; white-space:nowrap;
}
.nav-links li a:hover { text-decoration:none; color:#000; box-shadow: inset 0 -2px 0 0 #bfbfc3; }
.nav-links li.active a,
.nav-links li a.active { color:#000; font-weight:600;
                         box-shadow: inset 0 -2px 0 0 var(--gl-theme-accent, #6666c4); }
.top-area .nav-links { border-bottom: 0; flex: 1; }
```

`MEASURED /a11yproject/…/-/issues .gl-tab-nav-item → 102.1×48, padding 16px 12px,
box-shadow rgb(102,102,196) 0 -2px 0 0 inset, 14px/600/16px`.
`MEASURED /dashboard/projects .top-area → border-bottom 1px rgb(220,220,222), height 49px`.
Inside a comment editor the tabs shrink: `MEASURED MR .gl-tab-nav-item → padding 12px 8px, 40px tall`.

### 5.8 Dropdowns

```css
/* CSS app.css:4313 (GitLab's, wins over Bootstrap's app.css:639) */
.dropdown-menu {
  display:none; position:absolute; width:auto; top:100%;
  z-index: 300; min-width: 240px; max-width: 500px;
  margin-top: 4px; margin-bottom: 24px;
  font-size: 0.875rem; font-weight: 400;
  padding: 8px 0;
  background-color: #fff;
  border: 1px solid #dcdcde; border-radius: 0.25rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}
.dropdown-menu ul { margin:0; padding:0; }
.dropdown-menu li { display:block; text-align:left; list-style:none; }
/* CSS app.css:4320 */
.dropdown-menu li > a,
.dropdown-menu li > button,
.dropdown-menu li .menu-item {
  background:transparent; border:0; border-radius:0; box-shadow:none;
  display:block; font-weight:400; position:relative;
  padding: 8px 12px; color:#333238; line-height:16px;
  white-space:normal; overflow:hidden; text-align:left; width:100%;
}
/* CSS app.css:4322 */
.dropdown-menu li > a:hover,
.dropdown-menu li > a:focus,
.dropdown-menu li > a.is-focused { background-color:#ececef; color:#333238;
                                   outline:0; text-decoration:none; }
/* CSS app.css:4323 */
.dropdown-menu li > a:focus { box-shadow: inset 0 0 0 2px #428fdc,
                                          inset 0 0 0 3px #fff, inset 0 0 0 1px #fff;
                              outline:none; }
/* CSS app.css:668, 674 */
.dropdown-divider { height:0; margin:4px 0; overflow:hidden; border-top:1px solid #dcdcde; }
.dropdown-header  { display:block; padding:0.5rem 12px; margin-bottom:0;
                    font-size:0.875rem; color:#626168; white-space:nowrap; }
/* CSS app.css:3941 */
.dropdown-menu a, .dropdown-menu button { transition: none; }
```

`MEASURED` opened Clone dropdown on `/byteblaze/dotfiles`:
`.dropdown-menu.show` → **340 × 330**, padding `8px 0`, `margin 4px 0 24px`,
bg `#fff`, `border 1px solid rgb(220,220,222)`, radius 4px,
`box-shadow rgba(0,0,0,0.1) 0 2px 4px`; each `li > a` → **338 × 32**, padding `0 16px`
(GitLab bumps horizontal padding to 16px in the wide variant), 14px/400/16px.

Related classes seen in the captured HTML (use them for structure fidelity):
`dropdown-menu-right` 441, `dropdown-header` 182, `dropdown-divider` 88,
`dropdown-title` 51, `dropdown-input-field` 39, `dropdown-menu-selectable` 62,
`dropdown-toggle` 334, `dropdown-chevron` 171.

### 5.9 Issue / MR list row

Markup shape (Vue `.issuable-list`):

```html
<ul class="issuable-list">
  <li class="issue">
    <div class="issuable-main-info">
      <div class="issue-title"><span class="issue-title-text">…</span></div>
      <div class="issuable-info">
        <span class="issuable-reference">#1533</span> ·
        <span class="issuable-authored">created 3 years ago by <a>Paul McFedries</a></span>
        <span class="gl-label gl-label-sm …">…</span>
      </div>
    </div>
    <div class="issuable-meta"><ul class="controls">…</ul><div>updated 3 years ago</div></div>
  </li>
</ul>
```

Measured (`/a11yproject/a11yproject.com/-/issues`, 1920w):

| Part | Value | Source |
|---|---|---|
| `.issuable-list > li` | 1248 × **65**, `padding:10px 16px`, `border-bottom:1px solid #ececef` | `MEASURED → borderColor rgb(236,236,239), borderWidth 0 0 1px` |
| `.issuable-main-info` | 791 × 44, `margin-right:10px` | `MEASURED` |
| `.issue-title-text` | 14px / **600** / 21px, `#333238` | `MEASURED` |
| `.issuable-info` | 14px / 400 / 21px, **`#737278`** | `MEASURED → rgb(115,114,120)` |
| `.issuable-reference` | 14px, `#737278`, 51.8×16 | `MEASURED` |
| `.issuable-authored` | `margin-right:8px`, `#737278` | `MEASURED` |
| `.controls` (right column) | `line-height:20px`, `margin-bottom:2px` | `MEASURED` |

Closed/merged rows get a tinted background:
`CSS app.css:6337 .merge-request.closed,.merge-request.merged,.issue.closed,.issue.merged{background:#fbfafd;border-color:#dcdcde}`.

Above the list sits `.gl-tabs-nav` (Open / Closed / All + counter badges) and a
`.gl-search-box-by-click` filter bar (`MEASURED → 1043.6 × 32`).

### 5.10 Project card / row on `/dashboard/projects`

Despite the name, this is a **table-layout list**, not a card grid.

```css
/* CSS app.css:6997-7007 */
.projects-list { margin: 5px 0; padding: 0; list-style: none; display: table; }
.projects-list > li { padding:10px 0; border-bottom:1px solid #ececef; display:block; margin:0; }
.projects-list > li:last-child { border-bottom: 0; }
.projects-list > li.active { background:#fbfafd; }
.projects-list > li.active a { font-weight: 600; }
.projects-list .project-row  { display: table-row; }
.projects-list .project-cell { display: table-cell; border-bottom: solid 1px #dcdcde;
                               vertical-align: top; padding-top:0.75rem; padding-bottom:0.75rem; }
.projects-list .project-row:last-of-type .project-cell { border-style: none; }
/* CSS app.css:6996 */
.project-row .description p { margin-bottom:0; color:#737278; display:inline-block;
                              overflow:hidden; text-overflow:ellipsis;
                              vertical-align:top; white-space:nowrap; max-width:100%; }
```

Measured on `/dashboard/projects` at 1920w:

| Part | Value |
|---|---|
| `.projects-list` | 1248 × 1151 at x=336, `margin:4px 0` |
| `.project-row` | 1248 × **73**, `padding:10px 0`, `border-bottom:1px solid rgb(236,236,239)` |
| `.project-details` | 625 wide, `max-width:625px`, `padding-right:48px` |
| `.namespace-name` | 14px / 400 / 20px, `#333238` ("Byte Blaze /") |
| `.project-name` | 14px / **600** / 20px, `#333238` |
| `.project-controls` | 479 × 21 at right edge, `#737278` (star / fork / MR / issue counts + "Updated 3 years ago") |
| `.icon-wrapper` (each stat) | `margin: 0 16px 0 32px` |
| Avatar | `.avatar.s40` + `rect-avatar` → 40×40, radius 4px, 8px right margin |

Above it: `.top-area` + `.gl-tabs-nav` (Yours / Starred / Explore / Topics) —
`MEASURED .top-area → 1248 × 49, border-bottom 1px rgb(220,220,222)`.

### 5.11 Avatars

```css
/* CSS app.css:7119 */
.avatar, .avatar-container { float:left; margin-right:16px; border-radius:50%; }
/* CSS app.css:7134 */
.avatar { transition-property:none; width:40px; height:40px; padding:0;
          background:#fefefe; overflow:hidden;
          box-shadow: inset 0 0 0 1px rgba(31,30,36,0.1); }
/* CSS app.css:7135-7137 */
.avatar.avatar-inline { float:none; display:inline-block; margin-left:2px; flex-shrink:0; }
.avatar.avatar-inline.s16, .avatar.avatar-inline.s24 { margin-right: 4px; }
.avatar.center   { font-size:14px; line-height:1.8em; text-align:center; }
.avatar.avatar-tile { border-radius:0; border:0; }
/* CSS app.css:7157 */
.avatar-container { overflow:hidden; display:flex; }
.avatar-container .avatar { border-radius:0; border:0; height:auto; width:100%; margin:0; align-self:center; }
```

| Size class | W × H | `margin-right` | `rect-avatar` radius | Source |
|---|---|---|---|---|
| `.s16` | 16 | 8px | 2px | `CSS app.css:7120` / `7165` |
| `.s18` | 18 | 8px | 2px | `7121` / `7167` |
| `.s20` | 20 | 8px | 2px | `7122` / `7169` |
| `.s24` | 24 | 8px | 4px | `7123` / `7171` |
| `.s26` | 26 | 8px | 4px | `7124` / `7173` |
| `.s32` | 32 | 8px | **4px** | `7125`; `MEASURED .avatar.s32 → 32×32, borderRadius 4px, boxShadow rgba(31,30,36,0.1) 0 0 0 1px inset` |
| `.s40` | 40 | 8px | 4px | `7126` |
| `.s48` | 48 | 16px | — | `7127` |
| `.s60` | 60 | 16px | — | `7128` |
| `.s64` | 64 | 16px | **8px** | `7129`; `MEASURED .avatar.s64 → 64×64, borderRadius 8px, font-size 28px, line-height 64px` |
| `.s90` | 90 | 16px | — | `7130` |
| `.s96` | 96 | 16px | — | `7131` |
| `.s160` | 160 | 16px | — | `7133` |

Default (no `rect-avatar`) is a **circle** (`border-radius:50%`); with `.rect-avatar`
it becomes a rounded square (`CSS app.css:7164 .rect-avatar{border-radius:2px}`
+ per-size overrides above). GitLab uses `rect-avatar` for **project and group**
avatars and circles for **user** avatars.

Text fallback avatars (`.identicon`) get a tinted background from a fixed 7-color
set and centred initial (`CSS app.css:7139-7156`):
`bg1 #fcf1ef, bg2 #f4f0ff, bg3 #f1f1ff, bg4 #e9f3fc, bg5 #ecf4ee, bg6 #fdf1dd, bg7 #ececef`,
text `#333238`, base `background-color:#ececef`.
Font sizes: `s16 10px/16`, `s24 12px/24`, `s32 14px/32`, `s40 16px/38`,
`s48 20px/48`, `s64 28px/64`, `s96 36px/94`, `s160 96px/158`.
`MEASURED .avatar (project D avatar) → bg rgb(236,244,238)` — one of the identicon tints.

New-style `.gl-avatar` (navbar user menu) is a plain circle:
`MEASURED .gl-avatar → 24×24, border-radius 50%, border 1px solid rgb(209,209,240), 12px/600/16px`.

### 5.12 Alerts / flash messages

```css
/* CSS app.css:3316-ish */
.gl-alert { font-size:0.875rem; position:relative;
            padding: 1rem 3rem; }           /* 16px top/bottom, 48px left/right */
.gl-alert-not-dismissible { padding-right: 1rem; }
.gl-alert-no-icon         { padding-left: 1rem; }
.gl-alert-info    { background-color:#e9f3fc; }  .gl-alert-info .gl-alert-icon    { color:#1068bf; }
.gl-alert-warning { background-color:#fdf1dd; }  .gl-alert-warning .gl-alert-icon { color:#9e5400; }
.gl-alert-success { background-color:#ecf4ee; }  .gl-alert-success .gl-alert-icon { color:#217645; }
.gl-alert-danger  { background-color:#fcf1ef; }  .gl-alert-danger .gl-alert-icon  { color:#c91c00; }
.gl-alert-tip     { background-color:#ececef; }  .gl-alert-tip .gl-alert-icon     { color:#626168; }

/* Legacy flash — CSS app.css:4670-4680 */
.flash-container { margin:0 0 16px; font-size:14px; position:relative; z-index:1; }
.flash-container.sticky { position:sticky; top:48px; z-index:251; }
.flash-container:empty  { margin: 0; }
.flash-container .flash-alert:not(.gl-alert),
.flash-container .flash-notice:not(.gl-alert),
.flash-container .flash-success:not(.gl-alert),
.flash-container .flash-warning:not(.gl-alert) { padding:16px 32px 16px 20px; margin-top:10px; }
.flash-container .flash-alert   { background-color:#fcf1ef; }   /* danger  */
.flash-container .flash-notice  { background-color:#e9f3fc; }   /* info    */
.flash-container .flash-success { background-color:#ecf4ee; }
.flash-container .flash-warning { background-color:#fdf1dd; }
.flash-container .close-icon-wrapper { padding:20px 16px 16px; position:absolute;
                                       right:0; top:0; bottom:0; cursor:pointer; }
.flash-container .close-icon-wrapper .close-icon { width:16px; height:16px; }
```

`MEASURED /byteblaze/dotfiles`: `.gl-alert-warning` → **1664 × 100**, padding `16px 48px`,
bg `rgb(253,241,221)`, text `rgb(51,50,56)`, **no border, no radius** — it is a
full-bleed band across `.content-wrapper` (see the SSH-key banner in
`assets/screenshots/reference/proj-dotfiles.png`). `.gl-alert-body` → line-height 20px.
`.gl-alert-actions` → `margin-top:16px`, 32px tall (a row of buttons).
Alerts live in `.alert-wrapper` (`MEASURED → 1664 wide at x=256`, i.e. **not** width-limited).

### 5.13 Modals

```css
/* Bootstrap base — CSS app.css:1120-1140 */
.modal-dialog  { position:relative; width:auto; margin:0.5rem; pointer-events:none; }
.modal-content { position:relative; display:flex; flex-direction:column; width:100%;
                 pointer-events:auto; background-color:#fff; background-clip:padding-box;
                 border:1px solid rgba(0,0,0,0.2); border-radius:0.3rem; outline:0; }
.modal-header  { display:flex; align-items:flex-start; justify-content:space-between;
                 padding:1rem; border-bottom:1px solid #bfbfc3; }
.modal-title   { margin-bottom:0; line-height:1.25rem; }
.modal-body    { position:relative; flex:1 1 auto; padding:1rem; }
.modal-footer  { display:flex; flex-wrap:wrap; align-items:center; justify-content:flex-end;
                 padding:0.75rem; border-top:1px solid #bfbfc3; }
.modal-backdrop      { position:fixed; inset:0; z-index:1040; width:100vw; height:100vh;
                       background-color:#000; }
.modal-backdrop.show { opacity: 0.64; }

/* GitLab override — CSS app.css:3466-3473  (USE THESE) */
.gl-modal .modal-content { border-radius:0.25rem; border-width:0;
                           box-shadow: 0 4px 16px rgba(31,30,36,0.24); }
.gl-modal .modal-header  { background-color:#fff; padding-bottom:0.5rem; border-style:none; }
.gl-modal .modal-header .modal-title { font-size:1rem; font-weight:600; line-height:1.5rem; }
.gl-modal .modal-body    { min-height:80px; background-color:#fff; position:relative;
                           padding:1rem 1rem 0.5rem; text-align:left; white-space:normal;
                           font-size:0.875rem; line-height:1.25rem; }
.gl-modal .modal-footer  { display:flex; flex-direction:row; padding:1rem 1rem 0.5rem;
                           border-style:none; }
.gl-modal .modal-footer .btn { margin: 0; }
```

Net: **borderless white sheet, 4px radius, `0 4px 16px rgba(31,30,36,0.24)` shadow,
16px padding, backdrop `#000 @ 0.64`.** No header/footer rules.

### 5.14 Pagination

Bootstrap's `.pagination` is overridden by `.gl-pagination`:

```css
/* CSS app.css:3562-3573 */
.gl-pagination { font-size: 0.875rem; }
.gl-pagination a { color: #333238; }
.gl-pagination .page-link {
  border-color: #bfbfc3; line-height: 1rem;
  padding: 0.5rem 0.75rem;                     /* 8px 12px */
}
.gl-pagination .page-link.prev-page-item,
.gl-pagination .page-link.next-page-item { padding-left:0.5rem; padding-right:0.5rem; }
.gl-pagination .page-link:not(.active):hover {
  color:#333238; box-shadow: inset 0 0 0 1px #89888d;
  border-color:#89888d; background:#ececef; z-index:1;
}
.gl-pagination .page-link:not(.active):active { background-color: #dcdcde; }
.gl-pagination .page-link, .gl-pagination .page-link:active { text-decoration: none; }
.gl-pagination .page-item:not(.disabled) a.active {
  background-color:#1f75cb; border-color:#1f75cb; color:#fff; z-index:2; box-shadow:none;
}
.gl-pagination .page-item.disabled .page-link {
  background-color:#fbfafd; border-color:#bfbfc3; color:#737278;
}

/* Bootstrap structure still applies — CSS app.css:940-957 */
.pagination { display:flex; padding-left:0; list-style:none; border-radius:0.25rem; }
.page-link  { position:relative; display:block; margin-left:-1px;
              background-color:#fff; border:1px solid #a4a3a8; }
.page-item:first-child .page-link { margin-left:0; border-radius:0.25rem 0 0 0.25rem; }
.page-item:last-child  .page-link { border-radius: 0 0.25rem 0.25rem 0; }
```

**Note:** the raw Bootstrap active color `#007bff` (`CSS app.css:956`) is *not* what
renders — `.gl-pagination .page-item:not(.disabled) a.active` (`app.css:3571`) wins and
gives `#1f75cb`. Use `#1f75cb`.
None of the 68 captured pages had a rendered `.gl-pagination` element (all lists fit
on one page or use infinite scroll), so this section is **CSS-derived, not measured**.

### 5.15 Breadcrumbs

```css
/* CSS app.css:4813-4816 */
.breadcrumbs           { display:flex; min-height:48px; color:#333238; }
.breadcrumbs-container { display:flex; width:100%; position:relative;
                         padding:8px 0; align-items:center;
                         border-bottom:1px solid #dcdcde; }
.breadcrumbs-links     { flex:1; min-width:0; align-self:center; color:#737278; }
.breadcrumbs-links .avatar-tile { margin-right:4px; border:1px solid #dcdcde;
                                  border-radius:50%; vertical-align:sub; }
/* CSS app.css:944-949 */
.breadcrumb-item { display:flex; }
.breadcrumb-item + .breadcrumb-item { padding-left: 0.5rem; }
.breadcrumb-item + .breadcrumb-item::before { display:inline-block; padding-right:0.5rem;
                                              color:#626168; content:"/"; }
.breadcrumb-item.active { color: #626168; }
```

The `.breadcrumbs` element **is** the width-limited container on project pages
(`MEASURED → class "breadcrumbs container-fluid container-limited limit-container-width", 990 wide`).

### 5.16 Notes / comment timeline (issue + MR detail)

| Part | Value | Source |
|---|---|---|
| `.timeline-entry` / `.note` | `margin: 16px 0`, `color:#333238` | `CSS app.css:5508`; `MEASURED /byteblaze/a11y-syntax-highlighting/-/issues/1 .note → 958×166, margin 16px 0` |
| `.note-header` | 900 × 32, offset 49px from the left (avatar gutter) | `MEASURED` |
| `.note-body` | `padding: 0 8px 8px` | `MEASURED → 900×124` |
| `.system-note` | `padding: 8px 0`, `margin:16px 0` | `MEASURED → 958×37` |
| Targeted note | `background:#e9f3fc !important` | `CSS app.css:5511 .timeline-entry:target .timeline-content` |
| Internal/draft note | `background:#fdf1dd !important` | `CSS app.css:5509` |
| `.timeline-entry .controls` | `padding-top:10px; float:right` | `CSS app.css:5513` |
| `.detail-page-description` | `padding-top:16px`, `.title` has `border-bottom:1px solid #e6e6ea; padding-bottom:0.3em; margin:0 0 16px` | `CSS app.css:6226`; `MEASURED → 958×385.5` |
| `.detail-page-header` | `padding:10px 0; border-bottom:1px solid #dcdcde; line-height:34px; display:flex` | `CSS app.css:6212`; `MEASURED → 958×55` |
| `.detail-page-header a.link, .title a` | `#1068bf` | `CSS app.css:6217` |

### 5.17 Markdown body (`.md`)

```css
/* CSS app.css:5515 */
.md { color:#333238; word-wrap:break-word; }
/* CSS app.css:5531-5535 — see §3 for sizes */
.md h1, .md h2 { border-bottom:1px solid #e6e6ea; padding-bottom:0.3em; margin:24px 0 16px; }
.md h1:first-child { margin-top: 0; }
/* CSS app.css:5538 */
.md blockquote { font-size:inherit; color:#535158;
                 padding:0.5rem 0 0.5rem 1.5rem; margin:0.5rem 0;
                 box-shadow: inset 4px 0 0 0 #dcdcde; }
/* CSS app.css:5573 */
.md pre { margin-bottom:16px; line-height:1.6em; overflow-x:auto; border-radius:4px; }
/* CSS app.css:5530 + 3836 */
.md code { font-family: <mono stack>; font-size:0.875rem;
           white-space:pre-wrap; word-wrap:break-word; }
code { padding:2px 4px; color:#1f1e24; background-color:#ececef; border-radius:4px; }
/* CSS app.css:3837 */
.code > code, .build-log code { background-color: inherit; padding: unset; }
/* CSS app.css:5469-5470 — markdown tables (see §5.6) */
```

`MEASURED /byteblaze/dotfiles .md p → 14px/400/21px, margin 0 0 16px`.

Alternate newer container `.gl-markdown pre` (`CSS app.css:3438`):
`padding:0.5rem 0.75rem; border-radius:0.25rem; box-shadow: inset 0 0 0 1px #dcdcde;
margin:2rem 0; overflow:auto` with `pre code{background-color:#fff; color:#333238; padding:0}`.

### 5.18 File / blob view

```css
/* CSS app.css:4542 */
.file-title-flex-parent {
  display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between;
  background-color:#fbfafd;
  border-top:1px solid #dcdcde; border-bottom:1px solid #dcdcde;
  padding:8px 16px; margin:0; border-radius:4px 4px 0 0;
}
.file-title-flex-parent a { color: #333238; }
/* CSS app.css:4888-4893 */
.file-content.code { border:0; box-shadow:none; margin:0; padding:0; table-layout:fixed; }
.file-content.code pre {
  padding:10px 0; border:0; border-radius:0 0 4px;
  font-family: <mono stack>; font-size: 90%;
  margin:0; overflow:auto; overflow-y:hidden;
  white-space:pre; word-wrap:normal; border-left:1px solid;
}
.file-content.code pre code { display:inline-block; min-width:100%; white-space:normal; padding:0; }
.file-content.code pre code .line { display:block; width:100%; padding:0 10px; white-space:pre; }
.file-content.code .line-numbers { padding:10px; text-align:right; float:left;
                                   border-bottom-left-radius:4px; }
```

`MEASURED /byteblaze/dotfiles/-/blob/main/LICENSE .file-holder →
border 1px solid rgb(220,220,222) (right/bottom), radius 4px, margin 16px 0`;
`.file-content → background #fff, padding 32px` (rendered-markdown mode).

**Syntax theme** (`white`, from `highlight-white.css`, `.code.white .<token>`):

| Token | Color | Meaning |
|---|---|---|
| `.err` | `#a61717` on `#e3d2d2` | error |
| `.cm` / `.cd` | `#998` italic | comment |
| `.cs` | `#999` 600 italic | special comment |
| `.k`, `.nt` | `#000080` | keyword / tag |
| `.s` | `#d14` | string |
| `.m`, `.mf` | `#099` | number |
| `.no`, `.nv` | `#008080` | constant / variable |
| `.ni` | `#800080` | entity |
| `.ne` | `#900` 600 | exception |
| `.nn`, `.gp` | `#555` | namespace / prompt |
| `.gi` | `#000` on `#dfd` | diff added |
| `.gd` | `#000` on `#fdd` | diff removed |
| `.gh`, `.gu` | `#800080` 600 | diff header |
| `.gr`, `.gt` | `#a00` | diff error |
| `.go` | `#888` | output |
| `.w` | `#bbb` | whitespace |

A close-enough substitute for the mock is GitHub's classic light theme; exact token
fidelity is unlikely to matter for agent tasks.

---

## 6. Shadow & Elevation

| Role | Value | Source |
|---|---|---|
| **Utility: none** | `none` | `CSS util.css .gl-shadow-none` |
| **Utility: sm** | `0 1px 2px rgba(31,30,36,0.1)` | `CSS util.css .gl-shadow-sm` |
| **Utility: base** | `0 1px 4px 0 rgba(0,0,0,0.3)` | `CSS util.css .gl-shadow` |
| **Utility: md** | `0 2px 8px rgba(31,30,36,0.16), 0 0 2px rgba(31,30,36,0.16)` | `CSS util.css .gl-shadow-md` |
| **Utility: lg** | `0 4px 12px rgba(31,30,36,0.16), 0 0 4px rgba(31,30,36,0.16)` | `CSS util.css .gl-shadow-lg` |
| **Utility: drawer** | `-4px 0 8px #bfbfc3` | `CSS util.css .gl-shadow-drawer` |
| **Dropdown menu** | `0 2px 4px rgba(0,0,0,0.1)` | `CSS app.css:4313`; `MEASURED .dropdown-menu.show → rgba(0,0,0,0.1) 0 2px 4px` |
| **Modal** | `0 4px 16px rgba(31,30,36,0.24)` | `CSS app.css:3466 .gl-modal .modal-content` |
| **Modal backdrop** | `#000` @ `opacity:0.64` (not a shadow) | `CSS app.css:1149 .modal-backdrop.show{opacity:0.64}` |
| **Button "border" (default)** | `inset 0 0 0 1px #bfbfc3` | `CSS app.css:3486` |
| **Button hover lift** | `inset 0 0 0 2px #89888d, 0 2px 2px 0 rgba(0,0,0,0.08)` | `CSS app.css:3492` |
| **Confirm button border** | `inset 0 0 0 1px #1068bf` | `CSS app.css:3507` |
| **Danger button border** | `inset 0 0 0 1px #c91c00` | `CSS app.css:3527` |
| **Input border** | `inset 0 0 0 1px #89888d` (resolved) | `MEASURED .form-control → rgb(137,136,141) 0 0 0 1px inset` |
| **Focus ring (universal)** | `0 0 0 1px #fff, 0 0 0 3px #428fdc` | `CSS app.css:3494` and ~40 sibling rules |
| **Focus ring (inset variant)** | `inset 0 0 0 2px #428fdc, inset 0 0 0 3px #fff, inset 0 0 0 1px #fff` | `CSS app.css:4323` (dropdown items) |
| **Avatar inner ring** | `inset 0 0 0 1px rgba(31,30,36,0.1)` | `CSS app.css:7134`; `MEASURED .avatar` |
| **Active tab underline** | `inset 0 -2px 0 0 #6666c4` | `CSS app.css:3684`; `MEASURED .gl-tab-nav-item-active` |
| **Tab hover underline** | `inset 0 -2px 0 0 #bfbfc3` | `CSS app.css:3679` |
| **Blockquote bar** | `inset 4px 0 0 0 #dcdcde` | `CSS app.css:5538` |
| **Label pill outline** | `inset 0 0 0 1px <label color>` (via `--label-inset-border`) | `CSS app.css .gl-label{box-shadow:var(--label-inset-border)!important}` |

**Elevation model in one sentence:** flat surfaces separated by 1px `#dcdcde`
hairlines; borders drawn as **inset** shadows on interactive controls;
real drop shadows only on dropdowns (`0 2px 4px /10%`) and modals (`0 4px 16px /24%`).

---

## 7. Icons

### 7.1 The sprite

GitLab serves **one SVG sprite** containing every UI icon:

```
/assets/icons-ce4e8ebe16c824ec266af5c86cfa08b0d35e88b4fa857e862dd87bbc726986bc.svg
```

(extracted from `assets/html/*.html`; that exact digest is the one served by this
instance). A second, mask-oriented sprite exists for CSS `mask-image` use:
`/assets/icons-stacked-25319a7aa6c8f80f5dda2386509ce65d97ebef20db37ede794439fe36c942ec2.svg`
(`CSS highlight-white.css .code.white .file-line-num::before`).

Usage markup is always the same:

```html
<svg class="s16 gl-icon" data-testid="issues-icon" aria-hidden="true">
  <use href="/assets/icons-<digest>.svg#issues"></use>
</svg>
```

Sizing (`CSS app.css:3368-3375`):

```css
.gl-icon { fill: currentColor; }
.gl-icon.s12 { width:12px; height:12px; }
.gl-icon.s14 { width:14px; height:14px; }
.gl-icon.s16 { width:16px; height:16px; }   /* by far the most common */
.gl-icon.s24 { width:24px; height:24px; }
.gl-icon.s32 { width:32px; height:32px; }
.gl-icon.s48 { width:48px; height:48px; }
```

Icons inherit color via `fill:currentColor` — never hard-code an icon color;
set `color` on the parent. Inside `.btn-default` they are explicitly muted:
`CSS app.css:3500 .gl-button.btn-default .gl-icon{color:#737278}`.
Icons inside buttons get `height/width:1rem; margin-right:0.25rem`
(`CSS app.css:3488 .gl-button-icon`).

### 7.2 Icon ids actually used in the 68 captured pages

**168 distinct ids** are referenced. The 30 most-used (occurrence count across
`assets/html/*.html`), which cover essentially all of the chrome:

| id | uses | Where it appears |
|---|---|---|
| `chevron-down` | 935 | Every dropdown toggle |
| `mobile-issue-close` | 695 | Issue-closed / check glyph |
| `search` | 583 | Global search, filter bars |
| `chevron-right` | 472 | Sidebar sub-menu, breadcrumb-ish affordances |
| `close` | 454 | Dismiss buttons on alerts, tokens, modals |
| `project` | 315 | Project entries in nav + lists |
| `snippet` | 313 | Snippets nav item |
| `issues` | 289 | Issues sidebar item + counters |
| `clock` | 278 | Timestamps, milestones, time tracking |
| `git-merge` | 274 | Merge requests nav item + MR rows |
| `history` | 267 | Activity, recent-searches toggle |
| `comments` | 256 | Comment counters on list rows |
| `group` | 234 | Groups nav + group avatars |
| `hamburger` | 232 | Navbar menu toggle |
| `issue-type-issue` | 208 | Issue-type marker on list rows |
| `star-o` | 205 | Star (unstarred) on project rows |
| `chevron-lg-right` | 203 | Breadcrumb separators / disclosure |
| `copy-to-clipboard` | 155 | Copy SHA, copy clone URL |
| `plus` | 143 | "New …" buttons, navbar create menu |
| `question-o` | 132 | Navbar help menu |
| `todo-done` | 121 | Navbar to-do counter, "Mark as done" |
| `plus-square` | 116 | Add file / add README affordances |
| `chevron-double-lg-left` | 115 | "Collapse sidebar" button |
| `doc-text` | 101 | Wiki, file entries |
| `fork` | 98 | Fork count / fork button |
| `rocket` | 90 | CI/CD sidebar item |
| `pencil` | 89 | Edit buttons (title, sidebar fields) |
| `earth` | 88 | Public-visibility marker |
| `sidebar` | 85 | Sidebar toggle |
| `package` | 83 | Packages & registries nav item |

Also frequent and worth having: `deployments` (83), `monitor` (81), `chart` (81),
`book` (81), `ellipsis_v` (80, the "⋮" overflow menu), `shield` (68, Security &
Compliance), `paperclip` (68), `cloud-gear` (68, Infrastructure), `settings` (64),
`calendar` (48), `folder` (44) / `folder-open` (40), `labels` (39), `comment` (38),
`rss` (32), `star` (29), `scale` (28), `eye` (28), `status_failed` (26),
`notifications` (23), `users` (22), `sort-highest` (22), `warning-solid` (20),
`lock` (20), `git` (13), `label` (12), `thumb-up` (9), `approval` (5),
`issue-close` (3), `arrow-right` (2), `timer` (1), `document` (1).

Note that ~40 of the 168 ids are **file-type glyphs** used only in the repository
tree (`file`, `markdown`, `json`, `yaml`, `xml`, `html`, `javascript`, `nodejs`,
`python`, `docker`, `gradle`, `eslint`, `prettier`, `stylelint`, `editorconfig`,
`applescript`, `travis`, `gulp`, `yarn`, `console`, …). A single generic
document icon is an acceptable stand-in for all of them.

### 7.3 How the dev agent should substitute icons

Ranked by fidelity:

1. **Best — copy the real sprite.** Fetch it once and vendor it:
   `curl --noproxy '*' -o public/icons.svg http://localhost:8023/assets/icons-ce4e8ebe16c824ec266af5c86cfa08b0d35e88b4fa857e862dd87bbc726986bc.svg`
   then render `<svg class="s16 gl-icon"><use href="/icons.svg#chevron-down"/></svg>`.
   This reproduces GitLab pixel-for-pixel and keeps `data-testid`/`#id` selectors
   working for anything that keys off icon names. **Recommended.**
2. **Good — inline the ~40 ids you actually need.** Extract just those `<symbol>`
   elements from the sprite into a React `<Icon name="…" />` component backed by a
   `Record<string, JSX.Element>`. Keeps `fill: currentColor` semantics and avoids a
   200KB asset.
3. **Acceptable fallback — a comparable icon set.** The closest freely-available
   match is **[Lucide](https://lucide.dev)** or **Remix Icon** at 16px with
   `stroke/fill: currentColor`. Suggested mapping for the top ids:
   `chevron-down→chevron-down`, `chevron-right→chevron-right`, `close→x`,
   `search→search`, `hamburger→menu`, `plus→plus`, `pencil→pencil`,
   `settings→settings`, `clock→clock`, `history→history`, `comments→message-square`,
   `issues→circle-dot` (or `alert-circle`), `git-merge→git-merge`,
   `mobile-issue-close→check-circle`, `issue-type-issue→circle-dot`,
   `star-o→star` (outline) / `star→star` (filled), `fork→git-fork`,
   `project→box`, `group→users`, `snippet→code`, `doc-text→file-text`,
   `book→book-open`, `rocket→rocket`, `package→package`, `shield→shield`,
   `chart→bar-chart-2`, `monitor→monitor`, `deployments→server`,
   `cloud-gear→cloud-cog`, `ellipsis_v→more-vertical`, `todo-done→check-square`,
   `copy-to-clipboard→copy`, `question-o→help-circle`, `earth→globe`,
   `lock→lock`, `labels`/`label→tag`, `calendar→calendar`, `folder→folder`,
   `rss→rss`, `eye→eye`, `paperclip→paperclip`, `warning-solid→alert-triangle`,
   `chevron-double-lg-left→chevrons-left`, `sidebar→panel-left`,
   `notifications→bell`, `thumb-up→thumbs-up`, `file`+file-types→`file`.
   Lucide's default 24px viewBox must be rendered at 16px and the stroke width
   dropped to ~1.75 to match GitLab's visual weight (GitLab icons are *filled*,
   Lucide's are *stroked*, so they will read slightly lighter).

Whatever route is chosen, preserve `class="s16 gl-icon"` and `fill:currentColor`
so that color inheritance and existing size utilities keep working.

---

## Things I could NOT determine

Listed explicitly rather than guessed:

1. **Source SCSS variables.** The `gitlab-populated-final-port8023` image ships
   precompiled assets only; `app/assets/stylesheets/**` does not exist inside the
   container (`docker exec gitlab find / -name 'variables.scss' -path '*stylesheets*'`
   returns nothing). All values above are from compiled CSS or live measurement.
2. **Scoped (two-tone) labels are never rendered in this dataset.**
   `grep -l 'gl-label-scoped' assets/html/*.html` → 0 files. The CSS in §5.4 is
   accurate but unverified against a real screenshot.
3. **Pagination is never rendered in the 68 captured pages** (`.gl-pagination`
   not found on any measured page). §5.14 is CSS-derived only. In particular the
   exact rendered height of `.page-link` is not measured.
4. **Modals are never open in the captures.** §5.13 is CSS-derived only; I did not
   open one live because opening some GitLab modals is a state-mutating path.
5. **`--default-regular-font` / `--default-mono-font`** are unset on this instance,
   so the stacks fall through to `-apple-system` / `Menlo`. On the Linux Chromium
   used for measurement they resolve to the system default sans and mono. A mock
   should ship the literal stacks in §3 rather than a single font name.
6. **`.home-panel-title` / `.issuable-list` / `.issue-title-text` rules live in
   per-page bundles** (`/assets/page_bundles/project-*.css`, `tree-*.css`, etc.),
   not in `application.css`, so those rows cite *measurements only*, not a line
   number. The page-bundle CSS files were not downloaded.
7. **`gl-mt-10` and `gl-mt-12` do not exist** in this build's utilities — the scale
   skips from 9 (3rem) to 11 (4rem) to 13 (6rem). Do not extrapolate.
8. **There is no "MR-merged purple" token.** See the ⚠️ note in §2.3 — merged MRs
   use `badge-info` blue in 15.7. If the mock needs purple anywhere, the only
   legitimate purples are `badge-tier` (`#e1d8f9`/`#5943b6`, unused in this seed)
   and the theme accent `#6666c4` (active tab underline) / `#292961` (navbar).
