# reddit (Postmill) Design System — extracted from <http://localhost:9999>

## 0. Source of truth

Every value below is copied from a real file. Nothing was eyeballed from a
screenshot.

| What | Where I got it |
|---|---|
| Built CSS (minified) | `http://localhost:9999/build/core.36e8bfa7.css` (54 KB) and `http://localhost:9999/build/themes/postmill.4bac9561.css` (11 KB) → `/tmp/recon/reddit/css/` |
| **Un-minified sources** | `docker cp forum:/var/www/html/assets /tmp/recon/reddit/assets` — Postmill styles are **LESS**, not SCSS, under `assets/css/` |
| Active theme | `assets/themes.json` → `"_default": "postmill"`; `<head>` loads `/build/themes/postmill.*.css` |
| DB themes | `themes` table: **0 rows**. `css_theme_revisions`: **0 rows**. No DB-stored CSS overrides anything. |
| Font choice | The page emits an inline `<style>:root { --font-family: "Roboto",sans-serif }</style>`; `assets/fonts.json` names `default` → `["Roboto","sans-serif"]` |
| Icons | `assets/icons/icons.svg`, served as an SVG sprite at `/build/images/icons.64b6a2fd.svg` |
| Site settings | `sites` table (single row): `site_name = "Postmill"`, `default_sort_mode = "hot"`, `trash_enabled = false` |

File map for the rules quoted below:

```
assets/css/_variables.less              layout constants
assets/css/_global.less                 :root, html, body, a, blockquote, hr
assets/css/themes/_modern.less          LIGHT palette  (.modern-light())
assets/css/themes/_modern-night.less    DARK  palette  (.modern-dark())
assets/css/themes/postmill/_light.less  brand overrides on top of modern-light
assets/css/themes/postmill/_dark.less   brand overrides on top of modern-dark
assets/css/themes/postmill/index.less   :root[data-night-mode="light|dark|auto"]
assets/css/_layout/*.less               content-container, site-nav, site-content, sidebar, flow, text-flow, site-footer
assets/css/_things/*.less               submission, comment, vote, alert, empty, table, …
assets/css/_widgets/*.less              button, tab, dropdown, menu-item, subscribe-button
assets/css/_form/*.less                 form-control and its mixins
```

---

## 1. Visual Theme

Postmill is a **dense, flat, card-on-page** layout with a **crimson** brand
colour. There is exactly one shadow token and no border radius on anything
except the image frame and the nav search pill; separation comes from 1px
`--border-light` hairlines, not elevation. Base font size is a small **14px**
with a 1.5 line-height, so lists pack tightly. The chrome is a single
full-width gradient bar at the top; everything else sits inside an 1100px
centred column split into a white content card and a 20rem sidebar column.
Themeing is entirely CSS custom properties swapped by a
`data-night-mode` attribute on `<html>`, so light and dark share one stylesheet.

---

## 2. Color Palette

All colours are CSS custom properties. The mock should define them exactly as
below on `:root[data-night-mode="light"]` / `[="dark"]`, and reference them by
variable everywhere else — that is what the source does.

### 2a. Brand (theme `postmill`)

| Token | Light | Dark | Defined in |
|---|---|---|---|
| `--primary` | `#c00` | `#c00` | `themes/postmill/_light.less` / `_dark.less` |
| `--primary-alt` | `#a00` | `#a00` | ↑ |
| `--primary-bright` | `#e10` | `#e10` | ↑ |
| `--primary-alpha` | `#c002` | `#c006` | ↑ (used for focus glows) |
| `--notification` | `#f60` | `#f60` | ↑ |
| `--link` | `var(--primary)` = `#c00` | `#faa` | `_modern.less` / `postmill/_dark.less` |

### 2b. Light palette — `themes/_modern.less`, mixin `.modern-light()`

| Token | Value | Role |
|---|---|---|
| `--bg-page` | `#fafafa` | `html` background |
| `--bg-content` | `#fff` | content card, sidebar cards, form fields |
| `--bg-grey` | `#efefef` | `--accent`; also disabled form controls |
| `--bg-red` | `#fdd` | alert/danger surface |
| `--bg-orange` | `#ffe8d0` | |
| `--bg-yellow` | `#ffffd0` | |
| `--bg-green` | `#dfd` | alert/success surface |
| `--bg-blue` | `#def` | alert/notice surface |
| `--text` | `#000` | body text |
| `--text-muted` | `#505050` | `.fg-muted` — bylines, meta |
| `--text-invert` | `#fafafa` | on dark chips |
| `--fg-broken` | `#222` | `.submission-meta__short-url` background |
| `--fg-red` | `#f00` | errors; **`--vote--failed` score** |
| `--fg-orange` | `#f80` | **UPVOTE colour** (`.vote--user-upvoted .vote__up`) |
| `--fg-yellow` | `#808000` | |
| `--fg-green` | `#080` | `--submission-link-sticky` |
| `--fg-blue` | `#08f` | **DOWNVOTE colour** (`.vote--user-downvoted .vote__down`) |
| `--fg-grey` | `#888` | idle vote arrows, `.empty__emoji` |
| `--border` | `#aaa` | form-control borders, blockquote rule, image frame |
| `--border-light` | `#ddd` | comment hairlines and reply rails, `<hr>` |
| `--accent` | `var(--bg-grey)` = `#efefef` | `.tab`, `.button--secondary` |
| `--accent-alt` | `#dedede` | `.tab` bottom border, secondary button hover |
| `--accent-fg` | `#000` | |
| `--primary-fg` | `#fff` | text on the nav bar and primary buttons |
| `--submission-link` | `var(--text)` = `#000` | submission titles are **black, not blue** |
| `--submission-link-visited` | `#800080` | visited submission title |
| `--submission-link-sticky` | `var(--fg-green)` = `#080` | pinned submission title |
| `--card-bg` | `var(--bg-content)` = `#fff` | |
| `--card-shadow` | `1px 1px 2px var(--border)` | the only shadow token |
| `--form-bg` | `var(--bg-content)` = `#fff` | |
| `--site-nav-bg` | `linear-gradient(to right, var(--primary-bright), var(--primary))` = `#e10 → #c00` | the top bar |

### 2c. Dark palette — `themes/_modern-night.less`, mixin `.modern-dark()`

| Token | Value |
|---|---|
| `--bg-page` | `#000` |
| `--bg-content` | `#161616` |
| `--bg-grey` / `--accent` | `#424242` |
| `--accent-alt` | `#525252` · `--accent-fg` `#fff` |
| `--bg-red` `#660000` · `--bg-orange` `#663500` · `--bg-yellow` `#505000` · `--bg-green` `#004200` · `--bg-blue` `#003666` |
| `--text` | `#ccc` |
| `--text-muted` | `#a1a1a1` |
| `--text-invert` | `#1a1a1a` · `--fg-broken` `#cfcfcf` |
| `--fg-red` `#f00` · `--fg-orange` `#fa4` · `--fg-yellow` `#ffff80` · `--fg-green` `#8f8` · `--fg-blue` `#4af` · `--fg-grey` `#777` |
| `--border` | `#666` |
| `--border-light` | `rgb(51, 51, 51)` |
| `--submission-link` | `#fff` · `--submission-link-visited` `#ffccff` |
| `--card-shadow` | `0 0 0 1px var(--border-light)` (a hairline, not a shadow) |
| `--dropdown-card-bg` | `#000` · `--dropdown-card-shadow` `0 0 2px 1px var(--border-light)` |
| `--form-bg` | `#000` |

Switching (`themes/postmill/index.less`):

```less
:root[data-night-mode="light"] { .light(); }
:root[data-night-mode="dark"]  { .dark(); }
:root[data-night-mode="auto"]  { .light();
  @media screen and (prefers-color-scheme: dark) { .dark(); } }
```

The seeded user has `night_mode = 'light'`, so the mock boots with
`<html data-night-mode="light">`.

---

## 3. Typography

Root, from `_global.less`:

```less
:root {
  --font-size: 14px;
  --line-height: 1.5;
  --mono-font-family: Roboto Mono, monospace;
  --mono-font-size: 14px;
}
html {
  font-family: var(--font-family);   /* set inline to "Roboto", sans-serif */
  font-size: var(--font-size);
  line-height: var(--line-height);
  color: var(--text);
  background-color: var(--bg-page);
}
```

| Role | Font stack | Size | Weight | Line-height | Selector / file |
|---|---|---|---|---|---|
| Body | `"Roboto", sans-serif` | `14px` | 400 | `1.5` | `html` (`_global.less`) |

> **Roboto is vendored** (dev fix 10). `public/fonts/roboto-latin-{400,400italic,500,700,700italic,900}.woff2`
> and `roboto-mono-latin-400.woff2` are byte-copies of the container's
> `/var/www/html/public/build/fonts/*` with the content hash stripped, declared as
> `@font-face` at the top of `src/styles/index.css`. No network fetch. Before this
> the mock fell back to the system sans-serif and every `ch`/`em`-derived width
> drifted (`.vote {width:6ch}` 53.4px vs 48px, the user dropdown 138.6px vs 126px,
> `/f/books` page height 2827px vs 2635px). All three are now exact.
| Code / pre / kbd | `Roboto Mono, monospace` | `14px` | 400 | inherit | `pre, code, kbd` (`_global.less`) |
| Site-nav links | inherit | `16px` (`@nav-font-size`) | 400 | — | `.site-nav__link` (`_layout/site-nav.less`) |
| Sidebar section title | inherit | `1.25rem` | `bold` | 1.5 | `.sidebar__title` (`_layout/sidebar.less`) |
| **Submission title row** | inherit | **`1.33rem`** | **`normal`** | `0` on the row, `var(--line-height)` restored on children | `.submission__title-row` (`_things/submission.less`) |
| Vote score | inherit | 1rem | **`bold`** | **inherited `1.5` (21px)** — `_things/vote.less` sets ONLY `font-weight` | `.vote__net-score` (`_things/vote.less`) |
| Button | inherit | `1rem` (`--font-size`) | `500` (`--font-weight`) | — | `.button-common()` (`_widgets/_mixins.less`) |
| Small button | inherit | `1rem` | `400` | — | `.button-small()` |
| Empty-state emoji | inherit | `4em` | — | — | `.empty__emoji` |
| Alert icon | inherit | `1.5rem` | — | — | `.alert__icon` |

Utility size scale (from the built `core.css`):

```css
.text-xs { font-size: .75rem }    /*  10.5px */
.text-sm { font-size: .85rem }    /*  11.9px — bylines, comment counts */
.text-lg { font-size: 1.15rem }   /*  16.1px */
.fg-muted { color: var(--text-muted) }
```

Links (`_global.less`): `a { color: var(--link); text-decoration: none }`,
`a:hover { text-decoration: underline }`. Note that **submission titles opt out**
via `.submission__link { color: var(--submission-link) }` — they render in body
text colour, not brand red.

Headings have `margin: 0` globally; vertical rhythm comes from the `.flow` and
`.text-flow` utilities (§4).

Available font choices in user preferences (`assets/fonts.json`): `default`
(Roboto), `system` (`-apple-system, BlinkMacSystemFont, Segoe UI, Roboto,
Helvetica, Arial, sans-serif, …`), `opendyslexic`, `roboto`, `ubuntu`.

---

## 4. Spacing & Layout

Constants, `_variables.less`:

```less
@max-content-width: 1100px;
@desktop-min-width: 768px;
@nav-font-size: 16px;
@vote-width: 6ch;
@submission-image-width: 500px;
@submission-image-height: 375px;
@submission-image-max-height: 500px;
```

| Thing | Value | Rule |
|---|---|---|
| Content column max width | **1100px**, centred (`margin-inline: auto`) | `.content-container` |
| Full-width mode | max-width removed when `<html class="full-width">` | `:root:not(.full-width) &` |
| Desktop breakpoint | **768px** — below it the whole shell stacks vertically | `@desktop-min-width` |
| Main / sidebar split | `.site-content { display:flex; align-items:flex-start }` | `_layout/site-content.less` |
| Main content card | `flex: 1 1 auto; padding: 1rem; background: var(--card-bg); box-shadow: var(--card-shadow); margin-top: 1rem` (desktop) | `.site-content__body` |
| **Sidebar width** | **`20rem` (320px)**, `margin-left: 1rem`, `margin-top: 1rem`; collapses to full width below 768px; `&:empty { display:none }` | `.sidebar` |
| Sidebar section | `padding: 1rem`, card bg + card shadow | `.sidebar__section` |
| Site nav padding | `padding: 0 1rem` on the container (desktop); each link `padding: 0.875em 1em` at 16px ⇒ **~14px vertical**, so the bar is ~52px tall | `.site-nav__*` |
| Nav active/hover underline | 2px bar, `bottom: 1px`, full width, `--primary-fg` | `.site-nav__link:hover::after` |
| Nav search input | `border-radius: 8rem`, `padding-left: 2.5rem`, transparent until focused | `.site-nav__search-input` |
| Footer | `margin-top: auto; padding: 1rem; text-align: center` | `.site-footer` |
| **Vote gutter width** | **`6ch`** | `.vote { width: @vote-width }` |
| Vote column padding | `padding-top: 0.5rem` (submissions), `0.5rem 0` (comments) | `.vote`, `.comment__vote` |
| Submission row direction | `display:flex; flex-direction: row-reverse` — **the vote column is markup-last but renders first** | `.submission__row`, `.comment__row` |
| Thumbnail reservation | `.submission--has-thumbnail .submission__inner { padding-left: calc(1rem + 70px) }`, thumb absolutely positioned top-left; thumbnails hidden below 480px | `_things/submission.less` |
| Submission content margin | `margin: 0.5rem 0` | `.submission__content` |
| Submission image frame | `border: 1px solid var(--border); border-radius: 0.25rem; padding: 0.5rem`; image `max-height: 500px`; un-sized images forced to `500×375` with `object-fit: cover` | `.submission__image-link`, `.submission__image` |
| **Comment indent per level** | **`padding-left: 1rem`** plus a **3px** `--border-light` left rail (`0.25rem` padding below 480px) | `.comment__replies` |
| Comment borders | each `.comment` has `border-bottom: 1px var(--border-light)`; `.comment__row` has a 1px box with a **3px left border** | `_things/comment.less` |
| Comment header/content | header `padding: 0.5rem 0`; content `margin-bottom: 0.5rem; padding-right: 0.5rem`; `.comment__body { min-height: 1rem }` | ↑ |
| **No max nesting depth in CSS** | confirmed — indentation is unbounded | ↑ |
| `.flow` | `> * + * { margin-top: 1rem }` (the shell's vertical rhythm) | `_layout/flow.less` |
| `.flow-slim` | `> * + * { margin-top: 0.5rem }` | ↑ |
| `.text-flow` | `1em` top margin on non-first block elements inside prose | `_layout/text-flow.less` |
| `.text-flow-slim` | `0.5em` | ↑ |
| Alert | `padding: 0.5rem 1rem`, flex, icon `margin-right: 1rem` | `_things/alert.less` |
| Empty state | `height: 20rem; max-height: 50vh`, centred column | `_things/empty.less` |
| `<hr>` | `border-top: 1px solid var(--border-light); margin: 0.5rem 0` | `_global.less` |
| Blockquote | `border-left: 0.25em solid var(--border); padding: 0 0.5em`; children `--text-muted`, links `--text` | `_global.less` |

**Responsive breakpoints actually used:** `768px` (`@desktop-min-width`, the
main shell) and `480px` (thumbnails hidden, comment indent shrinks to
`0.25rem`).

---

## 5. Component Patterns

Rules copied from the source, not paraphrased.

### 5a. Buttons — `_widgets/_mixins.less`, `_widgets/button.less`

```less
.button-common() {
  --bg: var(--primary);  --bg-active: var(--primary-bright);
  --border-width: 1px;
  --fg: var(--primary-fg); --fg-active: var(--fg);
  --fg-border: transparent; --fg-border-active: var(--fg-border);
  --font-size: 1rem; --font-weight: 500;
  --padding-v: 0.5em; --padding-h: 1em;

  background-color: var(--bg);
  border: solid var(--border-width);
  border-color: var(--fg-border);
  color: var(--fg);
  cursor: pointer;
  display: inline-block;
  font-size: var(--font-size);
  font-weight: var(--font-weight);
  padding: var(--padding-v) var(--padding-h);
  text-align: center;
  transition: background-color .3s;
}
.button-active()      { background-color: var(--bg-active); border-color: var(--fg-border-active);
                        color: var(--fg-active); outline: none; text-decoration: none; }
.button-small()       { --font-weight: 400;
                        --padding-v: calc(0.25rem - var(--border-width));
                        --padding-h: calc(0.5rem  - var(--border-width)); }
.button-secondary()   { --bg: var(--accent); --bg-active: var(--accent-alt);
                        --fg: var(--accent-fg); --fg-border: var(--accent-alt); }
.button-transparent() { --bg: transparent; --bg-active: transparent;
                        --fg: currentColor; --fg-border: transparent; }
.button-disabled()    { --bg-active: var(--bg); --fg-active: var(--fg);
                        --fg-border-active: var(--fg-border);
                        cursor: not-allowed; opacity: 0.5; }
```

Variants in markup: `.button`, `.button--small`, `.button--secondary`,
`.button--transparent`, `.button--flex` (inline-flex, `> * + * { margin-left: 0.5em }`),
`:disabled`. **No border-radius** — buttons are square.

The pagination control uses `class="button button--secondary"` with the label
`More`.

### 5b. Form controls — `_form/_mixins.less`, `_form/form-control.less`

```less
.form-control-common() {
  --border-width: 1px;
  --height: calc(var(--font-size) * var(--line-height) + 1rem + 2 * var(--border-width));

  background-color: var(--form-bg);
  border: solid var(--border-width) var(--border);
  color: var(--text);
  font-size: var(--font-size);
  min-height: var(--height);      /* = 14*1.5 + 16 + 2 = 39px */
  padding: 0.5rem;
  line-height: var(--line-height);
  transition: background-color .1s, box-shadow .1s, border-color .1s, color .1s;
}
.form-control-focus()    { border-color: var(--primary);
                           box-shadow: 0 0 2px 2px var(--primary-alpha); }
.form-control-disabled() { background-color: var(--bg-grey); color: var(--fg-grey);
                           cursor: default; }
.form-control-readonly() { border-color: var(--border); }
```

`.form-control { border-radius: 0 }`; text inputs and textareas without an
explicit `size`/`cols` are `width: 100%`; `textarea` is `resize: vertical`;
`[type=radio]` gets `border-radius: 9999px`. Focus removes the native outline in
favour of the red glow.

### 5c. Vote widget — `_things/vote.less` (**load-bearing, see below**)

```less
.vote {
  align-items: center;
  display: flex;
  flex-direction: column;
  padding-top: 0.5rem;
  width: 6ch;

  &--loading &__net-score,
  &:not(&--loading) &__spinner { display: none; }

  &__button {
    color: var(--fg-grey);
    cursor: pointer;
    line-height: 1;
    height: 1em;
    transition: opacity .1s;
    white-space: nowrap;
  }
  &--loading &__button        { cursor: default; opacity: 0.5; }
  &--user-upvoted   &__up     { color: var(--fg-orange); }   /* #f80 light / #fa4 dark */
  &--user-downvoted &__down   { color: var(--fg-blue);   }   /* #08f light / #4af dark */
  &__net-score                { font-weight: bold; }
  &--failed &__net-score      { color: var(--fg-red); }
}
```

**The exact rendered class attribute** — from
`templates/_layouts/vote.html.twig`, where `{{-` strips the surrounding
whitespace so the three states produce exactly these strings:

| State | `<form>` class attribute, verbatim |
|---|---|
| no vote | `vote` |
| upvoted | `vote vote--user-upvoted` |
| downvoted | `vote vote--user-downvoted` |

WebArena evaluators for 16 tasks do
`document.querySelector('div.submission__vote').querySelector('form').getAttribute('class')`
and compare against the literal substrings `vote vote--user-upvoted` /
`vote vote--user-downvoted`. **Emitting any additional class breaks them.**

Full rendered markup, copied from the live page for submission 59421:

```html
<div class="submission__vote">
  <form action="/sv/59421" method="post" class="vote">
    <button type="submit" name="choice" value="1"
            class="unbuttonize vote__button vote__up" title="Upvote"
            data-action="vote#up" data-vote-target="up">…</button>
    <span class="vote__net-score" data-vote-target="score">3,085</span>
    <span class="vote__spinner">…</span>
    <button type="submit" name="choice" value="-1"
            class="unbuttonize vote__button vote__down" title="Downvote"
            data-action="vote#down" data-vote-target="down">…</button>
  </form>
</div>
```

Logged in, the `<form>` additionally carries `data-controller="vote"`,
`data-vote-choice-value`, `data-vote-id-value`, `data-vote-route-value`,
`data-vote-score-value`, `data-vote-error-class="vote--failed"`,
`data-vote-loading-class="vote--loading"`,
`data-vote-upvoted-class="vote--user-upvoted"`,
`data-vote-downvoted-class="vote--user-downvoted"`, plus a hidden CSRF `token`
input. The clicked button's `value` becomes `0` when it would retract an
existing vote.

Score formatting: thousands-separated (`3,085`); negatives render as U+2212
MINUS + absolute value, followed by
`<span class="no-visibility" aria-hidden="true">−</span>`.

### 5d. Submission — `_things/submission.less`

```less
.submission {
  &__row   { display: flex; flex-direction: row-reverse; }
  &__inner { flex-grow: 1; min-width: 0; }
  &__title-row { display: inline; font-size: 1.33rem; font-weight: normal;
                 line-height: 0; > * { line-height: var(--line-height); } }
  &__link  { color: var(--submission-link); &:visited { color: var(--submission-link-visited); } }
  &--sticky &__link { color: var(--submission-link-sticky); }
  &__host  { color: var(--submission-link); }
  &__content { margin: 0.5rem 0; }
  &__image-link { border: 1px solid var(--border); border-radius: 0.25rem;
                  display: table; padding: 0.5rem;
                  transition: box-shadow .25s, border .25s; }
  &__image-link:hover, &__image-link:focus {
                  box-shadow: 0 0 2px 2px var(--primary-alpha);
                  border-color: var(--primary); outline: none; }
  &__image { display: table; height: auto; max-width: 100%; max-height: 500px; }
  &__image:not([width]) { object-fit: cover; height: 375px; width: 500px; max-height: 375px; }
  &__flairs { margin-right: 0.5em; }
}
```

Evaluator-relevant class names on this component: `.submission__inner`,
`.submission__title`, `.submission__body`, `.submission__vote`.

### 5e. Comment — `_things/comment.less`

```less
.comment {
  border-bottom: solid 1px var(--border-light);
  display: flex; flex-direction: column;

  &__row { border: solid 1px var(--border-light); border-bottom: none;
           border-left-width: 3px; display: flex; flex-direction: row-reverse; }
  &:target { outline: solid var(--primary); }
  &__vote    { padding: 0.5rem 0; }
  &__main    { flex-grow: 1; min-width: 0; }
  &__replies { border-left: solid 3px var(--border-light);
               display: flex; flex-direction: column; padding-left: 1rem; }
  &__header  { display: flex; padding: 0.5rem 0; width: 100%; }
  &__info    { flex-grow: 1; }
  &__info-link { padding: 0.5rem; }
  &__content { margin-bottom: 0.5rem; padding-right: 0.5rem; }
  &__body    { min-height: 1rem; }
  &__nav     { margin-bottom: 0.5rem; }
  &--nested:last-child { border-bottom: none; margin-bottom: 0; }
  &__reply-link-disabled { opacity: 0.5; pointer-events: none; }
}
```

Collapsed comments (the `.hideable__checkbox` pattern) get a diagonal hatched
header and the info block is shifted right by the vote width:

```less
.hideable__checkbox:not(:checked) ~ .comment__row .comment__header {
  background-image: repeating-linear-gradient(-45deg,
    var(--bg-grey), var(--bg-grey) 0.5rem, transparent 0.5rem, transparent 1rem);
}
.hideable__checkbox:not(:checked) ~ .comment__row .comment__info { padding-left: 6ch; }
```

`.comment__body` is an evaluator locator.

### 5f. Cards — `_layout/sidebar.less`, `_card/dropdown-card.less`

```less
.sidebar__section { background: var(--sidebar-card-bg, var(--card-bg));
                    box-shadow: var(--sidebar-card-shadow, var(--card-shadow));
                    padding: 1rem; }
.sidebar__title   { font-size: 1.25rem; font-weight: bold; }
.dropdown-card    { background: var(--dropdown-card-bg, var(--card-bg));
                    box-shadow: var(--dropdown-card-shadow, var(--card-shadow)); }
```

### 5g. Tabs / sort nav — `_widgets/tab.less`

```less
.tab {
  background-color: var(--accent);
  border-bottom: solid 3px var(--accent-alt);
  color: var(--text);
  cursor: pointer;
  display: inline-block;
  padding: 0.5rem 0.75rem calc(0.5rem - 3px);
}
.tab--active,
.no-js:root .dropdown:hover > .tab,
.js:root .dropdown--expanded > .tab { /* .tab-active() */ }
```

Sort and filter are `.dropdown` widgets whose toggle is a `.tab`; the menu is a
`.dropdown__menu.dropdown-card.unlistify` of `.menu-item` links, with the current
one carrying `.menu-item--active`.

### 5h. Alerts & empty states

```less
.alert { align-items: center; display: flex; padding: 0.5rem 1rem; }
.alert__icon { font-size: 1.5rem; margin-right: 1rem; }

.empty { display: flex; flex-direction: column; align-items: center;
         justify-content: center; height: 20rem; max-height: 50vh; }
.empty__emoji { font-size: 4em; color: var(--fg-grey); }
.empty__text  { color: var(--text-muted); line-height: 2; }
```

Alert surface colours come from `--bg-red / --bg-orange / --bg-yellow /
--bg-green / --bg-blue` (see `_variables.less`'s `@background-colors` map).

### 5i. Misc utilities worth copying

```css
.text-xs { font-size: .75rem }
.text-sm { font-size: .85rem }
.text-lg { font-size: 1.15rem }
.fg-muted { color: var(--text-muted) }
.unlistify   /* list-style:none; margin:0; padding:0 */
.unbuttonize /* strips native button chrome — used on every vote button */
.no-wrap     /* white-space: nowrap */
.flex, .flex--guttered, .flex__grow
.submission-meta__short-url { background-color: var(--fg-broken);
  color: var(--text-invert); display: block; user-select: all;
  margin-bottom: 1rem; padding: 0.25rem 1rem; }
```

---

## 6. Shadow, Elevation, Radius, Borders

There is essentially **one** elevation token.

| Token | Light | Dark |
|---|---|---|
| `--card-shadow` | `1px 1px 2px var(--border)` (`1px 1px 2px #aaa`) | `0 0 0 1px var(--border-light)` — a hairline ring, not a shadow |
| `--dropdown-card-shadow` | falls back to `--card-shadow` | `0 0 2px 1px var(--border-light)` |
| Focus glow (inputs, image frame) | `0 0 2px 2px var(--primary-alpha)` = `0 0 2px 2px #c002` | `#c006` |

Border radius is **0 everywhere** except:

| Selector | Radius |
|---|---|
| `.submission__image-link` | `0.25rem` |
| `.site-nav__search-input` | `8rem` (pill) |
| `.form-control[type="radio"]` | `9999px` |

Border widths: `1px` for form controls, card hairlines and comment boxes; `3px`
for the comment reply rail, the comment row's left edge, and the `.tab` bottom
border; `0.25em` for blockquotes.

---

## 7. Icons

An **SVG sprite**, not an icon font. Source `assets/icons/icons.svg`, served
built at `/build/images/icons.64b6a2fd.svg`, referenced as:

```html
<span class="icon"><svg width="16" height="16">
  <use xlink:href="/build/images/icons.64b6a2fd.svg#up"/></svg></span>
```

Default size is **16×16**. `_macros/icon.html.twig` also emits a 0×0
`<img class="icon__alt" alt="…">` for screen readers, and supports the modifier
classes `icon--with-alt-text`, `icon--no-align`, `icon--pulse` (the spinner).

The sprite contains **44** symbols:

```
attention  block  brush  cancel  cancel-circled  ccw  clock  cog  down
envelope  envelope-open  file-image  filter  fire  forward  hammer  heart
help-circled  home  info-circled  left-small  link  lock  lock-open  logout
mail  menu  moon-inv  ok  ok-circled  pencil  pin  pin-outline  plus
rss-squared  search  settings  sort  spinner  star  sun-inv  tag  trash
unlink  up  user  user-times  wrench
```

The ones that actually appear in the chrome: `up` / `down` (vote arrows),
`filter` (the front-page filter dropdown), `sort` (the sort dropdown),
`spinner` (vote in flight), `search`, `menu`, `user`, `moon-inv` / `sun-inv`
(night-mode toggle), `pencil` (edit), `trash` (delete), `lock`, `pin`.

The mock can ship the sprite verbatim by copying
`/tmp/recon/reddit/assets/icons/icons.svg` into `public/` — it is Postmill's own
asset, not a third-party brand mark. Per `TRADEMARKS.md`, alter the **wordmark**
in the nav (the site name renders as the string `Postmill`), not these icons.
