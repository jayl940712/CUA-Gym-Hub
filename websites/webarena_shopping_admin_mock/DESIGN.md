# shopping_admin Design System

> Extracted from the source stylesheet, not from screenshots:
> `http://localhost:7780/static/version1681922233/adminhtml/Magento/backend/en_US/css/styles.css`
> (576 KB, saved during recon to `/tmp/recon/shopping_admin/styles.css`).
> Every token below cites the selector it came from, so the audit agent can verify it.
> Theme: **Magento 2 `Magento/backend`** (the admin backend theme).

Magento's admin sets `font-size: 62.5%` on `html` in its reset, so **`1rem = 10px`**.
All `rem` values below are the source's own; multiply by 10 for pixels.

---

## 1. Visual Theme

A dense, utilitarian enterprise back-office. Warm dark-brown chrome (not black,
not blue), a fixed 88 px icon rail on the left, white content on white page,
orange primary actions, and heavy use of full-width data grids with a dark
brown header row. Type is Open Sans throughout at 13–14 px, with a very large
28 px page title. Corners are square (`border-radius: 0` on buttons, `1px` on
inputs). Shadows are used sparingly and only for floating layers.

---

## 2. Color Palette

### Chrome / structure

| Token | Hex | Source selector |
|---|---|---|
| Left rail background | `#373330` | `.menu-wrapper:before { background-color:#373330 }` |
| Rail item text | `#aaa6a0` | `.admin__menu .level-0>a { color:#aaa6a0 }` |
| Rail item text, active/hover | `#f7f3eb` | `.admin__menu .level-0._active>a, .admin__menu .level-0:hover>a` |
| Rail item bg, active | `#524d49` | `.admin__menu .level-0._active>a` |
| Rail item bg, hover | `#4a4542` | `.admin__menu .level-0:hover>a` |
| Rail flyout submenu bg | `#4a4542` | `.admin__menu .level-0>.submenu { background-color:#4a4542; box-shadow:0 0 3px #000 }` |
| Rail separator rule | `#736963` | `.admin__menu .level-0:first-child>a:after` |
| Page background | `#fff` | `.page-wrapper { background-color:#fff }` |
| Sticky header bg | `#f8f8f8` | `.sticky-header { background-color:#f8f8f8; border-bottom:1px solid #e3e3e3 }` |
| Side panel bg (`.admin__page-nav`, order sidebar) | `#f1f1f1` on `#e3e3e3` border | `.admin__page-nav,.order-sidebar { background:#f1f1f1;border:1px solid #e3e3e3 }` |

### Text

| Token | Hex | Source selector |
|---|---|---|
| Page title / headings | `#41362f` | `.page-title { color:#41362f }` |
| Body & field text | `#303030` | `.admin__control-text { color:#303030 }`, `.admin__field-label { color:#303030 }` |
| Grid cell text | `#303030` | `.data-grid td { color:#303030 }` |
| Muted / scope hint | `#808080` | `.admin__field-label span[data-config-scope]:before` |
| Link / tertiary action | `#007bdb` | `.abs-action-tertiary,button.tertiary { color:#007bdb }` |
| Link (in-content) | `#008bdb` / `#1979c3` | present in the sheet; `#007bdb` is the dominant admin link colour |

### Actions

| Token | Hex | Source selector |
|---|---|---|
| Primary button bg/border | `#eb5202` | `.abs-action-primary,button.primary,.page-actions>button.action-primary { background-color:#eb5202;border-color:#eb5202;color:#fff;text-shadow:1px 1px 0 rgba(0,0,0,.25) }` |
| Primary hover/active | `#ba4000` (border `#b84002`) | `.abs-action-primary:hover` |
| Secondary button bg/border | `#514943` | `.abs-action-secondary,button.secondary,.action-secondary { background-color:#514943;border-color:#514943;color:#fff;text-shadow:1px 1px 1px rgba(0,0,0,.3) }` |
| Secondary hover/active | `#35302c` | `.abs-action-secondary:hover` |
| Tertiary (link-style) button | transparent / `#007bdb` | `.abs-action-tertiary,button.tertiary` |
| Quaternary (page-action button) | transparent / `#41362f` | `.abs-action-quaternary,.page-actions>button` |
| Focus ring | `0 0 0 1px #007bdb` | `.abs-action-primary:focus` |
| Disabled | `opacity:.5; pointer-events:none` | `.abs-action-pattern[disabled]` |

### Data grid

| Token | Hex | Source selector |
|---|---|---|
| Header row bg | `#514943` | `.data-grid th { background-color:#514943;border:.1rem solid #8a837f;border-left-color:transparent;color:#fff;font-weight:600;padding:0;text-align:left }` |
| Header cell hover/focus (sortable) | `#5f564f` | `.data-grid .data-grid-th._sortable:focus,:hover` |
| Cell bg | `#fff` | `.data-grid td { background-color:#fff }` |
| Odd-row bg | `#f5f5f5` | `.data-grid tr._odd-row td` |
| Row hover bg | `#e5f7fe` | `.data-grid tr:hover td` |
| Row active bg | `#e0f6fe` | `.data-grid tr:active td` |
| Cell side borders | `.1rem dashed #d6d6d6` | `.data-grid td { border-left:.1rem dashed #d6d6d6;border-right:.1rem dashed #d6d6d6 }` |
| Filter-row cell border | `1px solid #d6d6d6` | `.data-grid .data-grid-filters td` |
| Active-filter strip rules | `.1rem solid #ccc` top+bottom | `.admin__data-grid-filters-current { border-top:.1rem solid #ccc;border-bottom:.1rem solid #ccc }` |

### Messages / severity

| Token | Hex | Source selector |
|---|---|---|
| Message background | `#fffbbb`, text `#333` | `.message { background:#fffbbb;color:#333;font-size:1.4rem;padding:1.8rem 4rem 1.8rem 5.5rem }` |
| Severity notice | bg `#d0e5a9`, border `#5b8116`, text `#185b00` | `.grid-severity-notice` |
| Severity minor/critical base | bg `#feeee1`, border+text `#ed4f2e` | `.grid-severity-critical,.grid-severity-major,.grid-severity-notice,.grid-severity-minor` |
| Severity major/critical | bg `#f9d4d4`, border+text `#e22626` | `.grid-severity-critical,.grid-severity-major` |
| Required-field asterisk | `#e22626` | `.order-shipping-method .admin__page-section-title>span:after { color:#e22626;content:'*' }` |

### Form controls

| Token | Hex | Source selector |
|---|---|---|
| Input bg / text | `#fff` / `#303030` | `.admin__control-text,.admin__control-select,.admin__control-textarea` |
| Input border | `1px solid #adadad`, radius `1px` | same rule |
| Input border hover | `#878787` | `.admin__control-text:hover` |
| Radio dot | `#514943` | `.admin__control-radio:checked+label:after` |
| Tab (inactive) | bg `#e3e3e3`, border `.1rem solid #adadad` | `.tabs-horiz .ui-state-default` |
| Tab (hover) | `#d6d6d6` | `.tabs-horiz .ui-state-hover` |
| Tab (active) | `#fff`, `font-weight:600`, no bottom border | `.tabs-horiz .ui-state-active` |

---

## 3. Typography

Base stack, verbatim from the sheet:

```css
font-family: 'Open Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
```

(`.abs-action-pattern` and the global `body` rules; icon fonts `'Admin Icons'`,
`'luma-icons'`, `'MUI-Icons'` are used only for glyph pseudo-elements — replace
them with inline SVG or a local icon set in the mock.)

| Role | Size | Weight | Line height | Colour | Source selector |
|---|---|---|---|---|---|
| Page title | `2.8rem` (28px) | 400 | — | `#41362f` | `.page-title` |
| Section legend | `1.8rem` (18px) | 600 | — | — | `.admin__legend` (`margin-bottom:3rem`) |
| Page-section title | inherited | — | — | — | `.admin__page-section-title { border-bottom:1px solid #ccc; padding:1.4rem 0 .5rem; margin-bottom:1.7rem }` |
| Side-nav title | `1.4rem` | — | `1.2` | `#303030`, uppercase | `.admin__page-nav-title { padding:1.8rem 1.5rem; border-bottom:1px solid #e3e3e3 }` |
| Form control text | `1.4rem` (14px) | 400 | `1.36` | `#303030` | `.admin__control-text` |
| Button label | `1.4rem` | 600 | `1.36` | — | `.abs-action-pattern` |
| Large button (modal) | `1.6rem`, letter-spacing `.025em` | 600 | — | — | `.abs-action-l,.ui-dialog .ui-button` |
| Grid header + cells | `1.3rem` (13px) | 600 header / 400 cell | `1.36` | `#fff` / `#303030` | `.data-grid th,.data-grid td` |
| Grid filter inputs | `1.3rem`, height `2.8rem` | — | — | — | `.data-grid .data-grid-filters select,input[type=text]` |
| Grid toolbar | `1.4rem` | — | — | — | `.admin__data-grid-header` |
| Active-filter strip | `1.3rem` | — | — | — | `.admin__data-grid-filters-current` |
| Left-rail item | `1.0rem` (10px), letter-spacing `.025em`, `text-transform: uppercase` | 400 | — | `#aaa6a0` | `.admin__menu .level-0>a` |
| Rail icon glyph | `2.2rem` | — | — | — | `.admin__menu .level-0>a:before { font-size:2.2rem;height:2.2rem;margin-bottom:.3rem }` |
| Message | `1.4rem` | — | — | `#333` | `.message` |

---

## 4. Spacing & Layout

| Metric | Value | Source selector |
|---|---|---|
| Left rail width | `8.8rem` (88px), fixed, `z-index:700` | `.menu-wrapper { display:inline-block;position:relative;width:8.8rem;z-index:700 }` and `.menu-wrapper:before { position:fixed;top:0;bottom:0;left:0;width:8.8rem }` |
| Content column width | `calc(100% - 8.8rem)` | `.page-wrapper { display:inline-block;margin-left:-4px;vertical-align:top;width:calc(100% - 8.8rem) }` |
| Rail logo block | height `7.5rem`, padding `1.7rem 0`, logo img `3.5rem × 4.1rem` | `.menu-wrapper .logo`, `.menu-wrapper .logo .logo-img` |
| Rail item box | `min-height: 6.2rem`, padding `1.2rem .5rem .5rem`, centered text | `.admin__menu .level-0>a` |
| Rail flyout | `left:100%; top:0; transform:translateX(-100%); padding:2rem 0 0;` 0.3s ease-in-out | `.admin__menu .level-0>.submenu` |
| Page header | padding `1.5rem 3rem`, `margin-bottom:1.2rem` | `.page-header` |
| Page header actions | `padding-top:1.1rem` | `.page-header-actions` |
| Page title wrapper | `margin-top:1.6rem` | `.page-title-wrapper` |
| Page content | padding `0 3rem 3rem` | `.page-content { padding-bottom:3rem;padding-left:3rem;padding-right:3rem }` |
| Sticky header | `position:fixed; top:77px; left:8.8rem; right:0; padding:.5rem 3rem 0; z-index:398; box-shadow:0 5px 5px rgba(0,0,0,.25)` | `.sticky-header` |
| Grid wrap | `padding:2rem 0 1rem; margin-bottom:2rem; max-width:100%` | `.admin__data-grid-wrap` |
| Grid outer wrap | `min-height:8rem; position:relative` | `.admin__data-grid-outer-wrap` |
| Grid header row gutter | `margin-left:30px` between toolbar groups (first child `0`) | `.admin__data-grid-toolbar .admin__data-grid-header-row>div` |
| Grid cell padding | `1rem 1rem` (header `1rem 1rem` on `.data-grid-th`, `th` itself `padding:0`) | `.data-grid td`, `.data-grid .data-grid-th` |
| Checkbox column | `width:5.2rem`, `padding:0` | `.data-grid .data-grid-checkbox-cell` |
| Qty input in order tables | `width:5.4rem` | `.data-grid .col-qty .admin__control-text` |
| Pager block | `display:inline-block; margin-left:3rem`, wrap floats right | `.admin__data-grid-pager`, `.admin__data-grid-pager-wrap { float:right;text-align:right }` |
| Active-filter strip | `padding:1.1rem 0 .8rem; margin-bottom:.9rem; width:100%`; hidden until `._show` (`display:table`) | `.admin__data-grid-filters-current`, `._show` |
| Two-column order blocks | `float:left; width:calc(100% * .5 - 30px)` | `.order-billing-address,.order-information,.order-payment-method,…` |
| Side-nav items | `padding:1rem 0 1.3rem`, item `border-left:3px solid transparent; margin-left:.7rem`, hover border `#e4e4e4` | `.admin__page-nav-items`, `.admin__page-nav-item` |
| Field width presets | x-small `8rem`, small `15rem` | `.abs-field-size-x-small`, `.abs-field-size-small` |
| Field label | `text-align:right; margin:0` (wide fields switch to `display:block; text-align:left; margin-bottom:.86rem`) | `.admin__field-label`, `.admin__field-wide>.admin__field-label` |

Reference viewport for screenshots: **1440 × 900**.

---

## 5. Component Patterns

Copy these rules rather than approximating them.

### Buttons

```css
/* base — .abs-action-pattern / .action-default / .action-primary / .action-secondary */
border: 1px solid;
border-radius: 0;
display: inline-block;
font-family: 'Open Sans','Helvetica Neue',Helvetica,Arial,sans-serif;
font-size: 1.4rem;
font-weight: 600;
line-height: 1.36;
padding: .6rem 1em .6rem;
text-align: center;
vertical-align: baseline;

/* primary */
background-color:#eb5202; border-color:#eb5202; color:#fff;
text-shadow: 1px 1px 0 rgba(0,0,0,.25);
/* primary:hover|:active|:focus */
background-color:#ba4000; border-color:#b84002; box-shadow:0 0 0 1px #007bdb; color:#fff;

/* secondary */
background-color:#514943; border-color:#514943; color:#fff;
text-shadow: 1px 1px 1px rgba(0,0,0,.3);
/* secondary:hover */ background-color:#35302c; border-color:#35302c;

/* tertiary (link-look) */
background-color:transparent; border-color:transparent; color:#007bdb; text-shadow:none;
/* tertiary:hover */ text-decoration:underline;

/* page-actions buttons (quaternary) */
background-color:transparent; border-color:transparent; color:#41362f; text-shadow:none;
```

Split buttons (`.actions-split`, e.g. **Add Product ▾**, **Save ▾**):
`.action-default { float:left; margin-right:3.2rem; min-width:9.3rem }`,
toggle caret `padding-right:4rem; border-width:.9rem .6rem 0 .6rem; right:1.4rem`,
open state `background-color:#ba4000; border-color:#ba4000`.

### Inputs / selects / textareas

```css
-webkit-appearance: none;
background-color: #fff;
border: 1px solid #adadad;
border-radius: 1px;
box-shadow: none;
color: #303030;
font-size: 1.4rem;
font-weight: 400;
height: auto;
line-height: 1.36;
padding: .6rem 1rem .6rem;
transition: border-color .1s linear;
vertical-align: baseline;
width: auto;
/* :hover */ border-color:#878787;
```

### Data grid

```css
.data-grid            { border:none; font-size:1.3rem; margin-bottom:0; width:100% }
.data-grid th         { background-color:#514943; border:.1rem solid #8a837f;
                        border-left-color:transparent; color:#fff; font-weight:600;
                        padding:0; text-align:left }
.data-grid .data-grid-th { background-clip:padding-box; color:#fff; padding:1rem 1rem;
                        position:relative; vertical-align:middle }
.data-grid .data-grid-th._sortable        { cursor:pointer; transition:background-color .1s linear }
.data-grid .data-grid-th._sortable:hover  { background-color:#5f564f }
.data-grid td         { background-color:#fff; border-left:.1rem dashed #d6d6d6;
                        border-right:.1rem dashed #d6d6d6; color:#303030; padding:1rem }
.data-grid tr._odd-row td { background-color:#f5f5f5 }
.data-grid tr:hover td    { background-color:#e5f7fe }
.data-grid tr:active td   { background-color:#e0f6fe }
.data-grid tr.data-grid-tr-no-data:hover td { background-color:#fff; cursor:default }
.data-grid-cell-content   { display:inline-block; overflow:hidden; width:100% }
.data-grid .data-grid-checkbox-cell { overflow:hidden; padding:0; vertical-align:middle; width:5.2rem }
```

Legacy grids (Reports, Reviews) reuse `.data-grid` but put the filter row inside
`<thead>`: `.data-grid .data-grid-filters td { border-bottom:1px solid #d6d6d6; padding:1rem }`
with `select`/`input[type=text]` at `font-size:1.3rem; height:2.8rem; width:100%`.

### Left rail

```css
.menu-wrapper        { display:inline-block; position:relative; width:8.8rem; z-index:700 }
.menu-wrapper:before { background-color:#373330; bottom:0; content:''; left:0;
                       position:fixed; top:0; width:8.8rem; z-index:699 }
.admin__menu .level-0>a { color:#aaa6a0; display:block; font-size:1rem; letter-spacing:.025em;
                       min-height:6.2rem; padding:1.2rem .5rem .5rem; position:relative;
                       text-align:center; text-decoration:none; text-transform:uppercase;
                       transition:background-color .1s linear; word-wrap:break-word; z-index:700 }
.admin__menu .level-0:hover>a   { background-color:#4a4542; color:#f7f3eb }
.admin__menu .level-0._active>a { background-color:#524d49; color:#f7f3eb }
.admin__menu .level-0>.submenu  { background-color:#4a4542; box-shadow:0 0 3px #000;
                       left:100%; padding:2rem 0 0; position:absolute; top:0;
                       transform:translateX(-100%); transition-duration:.3s;
                       transition-property:transform,visibility;
                       transition-timing-function:ease-in-out; visibility:hidden }
```

Rail order (verified against `assets/html/dashboard.html`): **Dashboard, Sales,
Catalog, Customers, Marketing, Content, Reports, Stores, System, Find Partners
& Extensions.**

### Side page-nav (order view, customer edit, product-attribute pages)

```css
.admin__page-nav, .order-sidebar { background:#f1f1f1; border:1px solid #e3e3e3 }
.admin__page-nav-title { border-bottom:1px solid #e3e3e3; color:#303030; display:block;
                         font-size:1.4rem; line-height:1.2; margin:0 0 -1px;
                         padding:1.8rem 1.5rem; text-transform:uppercase }
.admin__page-nav-items { list-style:none; margin:0; padding:1rem 0 1.3rem }
.admin__page-nav-item  { border-left:3px solid transparent; margin-left:.7rem; padding:0;
                         transition:border-color .1s ease-out, background-color .1s ease-out }
.admin__page-nav-item:hover { border-color:#e4e4e4 }
```

### Messages

```css
.message { background:#fffbbb; border:none; border-radius:0; color:#333;
           font-size:1.4rem; margin:0 0 1px; padding:1.8rem 4rem 1.8rem 5.5rem;
           position:relative; text-shadow:none }
```
Success/error variants change the left icon glyph and its colour; the yellow body
is shared. Severity pills in grids use `.grid-severity-*` (see §2).

### Horizontal tabs

```css
.tabs-horiz { margin:0; padding:0 }
.tabs-horiz .ui-state-default { background:#e3e3e3; border:.1rem solid #adadad; float:left;
                                letter-spacing:.0183em; list-style:none; margin-right:.4rem }
.tabs-horiz .ui-state-hover   { background:#d6d6d6 }
.tabs-horiz .ui-state-active  { background:#fff; border-bottom:0; font-weight:600;
                                letter-spacing:normal; margin-bottom:-.1rem }
```

---

## 6. Shadow & Elevation

| Layer | Shadow | Source selector |
|---|---|---|
| Sticky header | `0 5px 5px 0 rgba(0,0,0,.25)` | `.sticky-header` |
| Rail flyout submenu | `0 0 3px #000` | `.admin__menu .level-0>.submenu` |
| Open header dropdown (notifications, admin user) | `1px 1px 5px rgba(0,0,0,.5)`, border `#007bdb` | `.notifications-wrapper.active .notifications-action`, `.admin-user._active .admin__action-dropdown` |
| Button focus ring | `0 0 0 1px #007bdb` | `.abs-action-primary:focus`, `.abs-action-secondary:focus` |
| Inputs | **none** (`box-shadow: none`) | `.admin__control-text` |
| Grid rows / cards | **none** — separation is done with borders and the `#f5f5f5` zebra, not elevation | `.data-grid td` |

Everything else in the admin is flat. Do not add shadows the source does not have.
