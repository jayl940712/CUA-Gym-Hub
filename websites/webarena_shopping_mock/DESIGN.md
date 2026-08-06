# One Stop Market Design System

> Extracted from `http://10.186.197.203:7770` (container `shopping`, image `shopping_final_0712`).
> Source stylesheets: `/static/version1681826198/frontend/Magento/blank/en_US/css/styles-m.css`
> (310 KB) and `styles-l.css` (45 KB) — pulled to `assets/dumps/` as `styles-m.css` /
> `styles-l.css` in the prior recon run and re-read here.
>
> **Every value below is a `getComputedStyle()` reading taken from the live site at
> 1440×900**, not an eyeball from a screenshot. The capture scripts are
> `assets/dumps/tokens.py` / `tokens2.py`; raw output is `assets/dumps/tokens.json`.
> The theme is Magento's stock **`Magento/blank`** theme (not Luma) with a custom
> logo — so most of these values are the Magento blank defaults and will match any
> reference you have for that theme.

---

## 1. Visual Theme

Flat, high-density e-commerce chrome. White page background, a light-grey full-bleed
navigation band, and a single blue accent used for every link, primary button and
active affordance. No rounded cards, no drop shadows anywhere in the main content —
elevation only appears on the two floating overlays (mega-menu flyout, mini-cart).
Typography is Open Sans throughout at a 14 px base with a very light 40 px page
title. Orange (`#ff5501`) appears only as an accent: rating stars and the active
account-nav marker.

---

## 2. Color Palette

| Token | Hex | RGB (measured) | Where it came from |
|---|---|---|---|
| `--text` | `#333333` | `rgb(51,51,51)` | `body { color }` |
| `--bg` | `#ffffff` | `rgb(255,255,255)` | `body { background-color }` — 99 occurrences in `styles-m.css`, the most common colour in the sheet |
| `--link` / `--primary` | `#1979c3` | `rgb(25,121,195)` | `.logo`, `.filter-options-content a`, `.footer.content a`, `.pages a.page`, `.action.primary { background-color }` |
| `--link-hover` | `#006bb4` | — | 33 occurrences in `styles-m.css`; Magento blank's `@link__hover__color` |
| `--accent-orange` | `#ff5501` | `rgb(255,85,1)` | `.block-collapsible-nav .item.current strong { border-color }` (the 3 px left marker on the active account-nav row); also the rating-star fill |
| `--nav-band` | `#f5f5f5` | `rgb(245,245,245)` | `.nav-sections { background-color }` |
| `--panel-bg` | `#f5f5f5` | `rgb(245,245,245)` | `.cart-summary { background-color }` |
| `--secondary-btn-bg` | `#f2f2f2` | `rgb(242,242,242)` | `.cart .action-edit`, `.product-social-links .action.towishlist { background-color }` |
| `--secondary-btn-border` | `#cdcdcd` | `rgb(205,205,205)` | same elements, `border-color` |
| `--muted` | `#7d7d7d` | `rgb(125,125,125)` | `.product.attribute.sku .value { color }` |
| `--nav-link` | `#575757` | `rgb(87,87,87)` | `.navigation .level0 > .level-top`, `.block-collapsible-nav .item a { color }` |
| `--rule` | `#d1d1d1` | `rgb(209,209,209)` | `#my-orders-table th { border-bottom }`; 74 occurrences — the standard table/section rule |
| `--input-border` | `#c2c2c2` | `rgb(194,194,194)` | `#search`, `.sorter-options`, `#qty { border-color }` |
| `--error` | `#e02b27` | — | Magento blank `@message-error`; used for required-field `*` and error messages |
| `--price-strike` | `#ff5216` | — | Special-price / sale styling in `styles-m.css` |

Grey ramp actually present in the sheet, most→least used:
`#d1d1d1`, `#cdcdcd`, `#c2c2c2`, `#e8e8e8`, `#e2e2e2`, `#f0f0f0`, `#c1c1c1`,
`#8f8f8f`, `#f4f4f4`, `#f5f5f5`, `#f2f2f2`, `#303030`, `#575757`.

---

## 3. Typography

Font stack (17 rules in `styles-m.css`, and the computed `body` value):

```css
font-family: 'Open Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
```

Magento sets `html { font-size: 62.5% }`, so `1rem = 10px` and the `1.4rem`-style
declarations in the sheet map to the pixel values below.

| Role | Selector | Size | Weight | Line-height | Colour |
|---|---|---|---|---|---|
| Body / default | `body` | 14 px | 400 | 20 px | `#333` |
| Page title (`<h1>`) | `.page-title .base` | **40 px** | **300** | 44 px | `#333` |
| Section heading | `.sidebar .block-title strong`, `.cart-summary .summary.title` | 18 px | 700 / 300 | — | `#333` |
| Top-level nav item | `.navigation .level0 > .level-top` | 14 px | **700** | 53 px | `#575757` |
| Product tile name | `.product-item-name a` | 14 px | 400 | 20 px | `#333` |
| Tile price | `.product-item .price` | 14 px | **700** | 20 px | `#333` |
| PDP price | `.product-info-main .price` | 18 px | 700 | 14 px | `#333` |
| PDP stock label | `.stock.available` | 14 px | 700 | 20 px | `#333` |
| PDP SKU value | `.product.attribute.sku .value` | 14 px | 400 | 20 px | `#7d7d7d` |
| PDP tab label | `.product.data.items > .item.title > .switch` | 14 px | 600 | 20 px | `#333` |
| Table header | `th` (`#my-orders-table`, cart) | 14 px | 700 | — | `#333` |
| Table cell | `td` | 14 px | 400 | — | `#333` |
| Toolbar amount ("Items 1-12 of 631") | `.toolbar-amount` | 14 px | 400 | 26 px | `#333` |
| Breadcrumb | `.breadcrumbs a` | 12 px | 400 | 17 px | `#333` |
| Pager | `.pages a.page`, `.pages .item.current` | 12 px | **700** | 32 px | `#1979c3` / `#333` |
| Copyright | `.copyright` | 12 px | 400 | 17 px | `#333` |
| Small secondary button | `.product-social-links .action.towishlist` | 11 px | 700 | 12 px | `#333` |
| Search input | `#search` | 16 px | 400 | 22.9 px | `#000` |

---

## 4. Spacing & Layout

All measured at a 1440 px viewport.

| Region | Value |
|---|---|
| Page content max width | **1280 px**, `padding: 0 20px` → 1240 px inner (`.page-main { max-width }`) |
| `.columns` inner width | 1240 px |
| Left sidebar (`.sidebar-main`) | **207 px** wide, `padding-right: 24.8px` |
| Main column beside sidebar (`.column.main`) | 1033 px, `padding: 0 0 40px 24.8px` |
| Top panel bar (`.panel.wrapper`) | 41 px tall; `.panel.header` `padding: 10px 20px` |
| Header block (`.header.content`) | 87 px tall; `padding: 30px 20px 0` |
| Logo | 200 × 27 px, `max-width: 50%` |
| Search input | 250 × 32 px |
| Nav band (`.nav-sections`) | full-bleed, `background #f5f5f5`, 109 px tall (it **wraps to two rows** at 1440 px — 12 top-level categories don't fit on one line) |
| Nav item | 53 px line-height, `padding: 0 20px 0 12px` |
| Product grid | 4 columns inside `.column.main`; tile 237 × 506 px; grid `<ol>` 1009 px |
| Home page grid | **5 columns** (no sidebar on the home page → wider `.column.main`) |
| Toolbar | 1009 × 40 px, `padding: 0 10px` |
| Cart summary panel | 285 px wide, `background #f5f5f5`, `padding: 1px 15px 25px` |
| Account nav (`.block-collapsible-nav`) | 252 px wide; rows `padding: 5px 18px 5px 15px`, 30 px tall |
| Cart table `th` | `padding: 20px 10px 8px` |
| Cart table `td` | `padding: 27px 8px 10px` |
| Orders table `th`/`td` | `padding: 8px 10px`; `th` has `border-bottom: 1px solid #d1d1d1` |
| Footer | 310 px tall |

Page-size defaults: **12 products per grid page** (`catalog/frontend/grid_per_page`,
options 12/24/36); **10 orders per page** on `/sales/order/history/`; **10 reviews
per page** on the PDP Reviews tab.

---

## 5. Component Patterns

### Primary button (`.action.primary`)
```css
background: #1979c3;
border: 1px solid #1979c3;
border-radius: 3px;
color: #fff;
font-size: 14px;      /* 18px on the PDP "Add to Cart" and cart "Proceed to Checkout" */
font-weight: 700;
line-height: 16px;    /* 22px at the 18px size */
padding: 7px 15px;    /* 14px 17px at the 18px size */
```
Measured sizes: grid-tile "Add to Cart" 112 × 32; PDP "Add to Cart" 137 × 52;
"Proceed to Checkout" 255 × 52; newsletter "Subscribe" 99 × 32.

### Secondary button (`.action.secondary`, cart row actions, "Add to Wish List")
```css
background: #f2f2f2;
border: 1px solid #cdcdcd;
border-radius: 3px;
color: #333;
font-weight: 700;
padding: 7px 15px;    /* 5px 8px, 11px font on the PDP social links */
```

### Text input / select
```css
background: #fff;
border: 1px solid #c2c2c2;
border-radius: 1px;
height: 32px;                      /* 52px for the PDP #qty */
padding: 0 9px;                    /* 5px 10px 4px on <select> */
```
`#search` is 250 × 32 with `padding: 0 35px 0 9px` to clear the magnifier button.

### Table
No outer border. Header cells are bold with `border-bottom: 1px solid #d1d1d1`;
body cells have no rule (rows are separated by whitespace only) — this is why the
order grid reads as an airy list rather than a boxed table.

### Grey panel (cart summary, account nav block)
```css
background: #f5f5f5;
border: none;
border-radius: 0;
```

### Rating widget (`.rating-result`)
100 × 28 px. Five stars rendered as a fixed-width background with an orange
(`#ff5501`) foreground clipped to a **percentage width** — the source writes
`element.style.width = '73%'` inline and puts `title="73%"` on the container.
Percentages seen: multiples of 20 for whole-star products, arbitrary values
(73 %, 57 %, 95 %, 83 %) for averaged products. Reproduce the percentage-clip
approach rather than rounding to whole stars.

### Active account-nav row
```css
.block-collapsible-nav .item.current strong {
  border-color: #ff5501;   /* 3px left marker */
  color: #000;
  font-weight: 600;
}
```

---

## 6. Shadow & Elevation

There is **no `box-shadow` on any element in the main content flow** — panels,
buttons, inputs, tables and product tiles are all flat. Elevation exists only on:

- the mega-menu flyout (`.navigation .submenu`) — a white panel with a 1 px
  `#d1d1d1` border overlapping the page below;
- the mini-cart dropdown (`.block-minicart`) — same treatment, plus the caret;
- the search autocomplete list.

Use a 1 px `#d1d1d1` border plus `background:#fff` for these rather than inventing
a shadow.

---

## 7. Assets & Trademarks

- The wordmark is a text logo rendering "**One Stop Market**" in a heavy
  condensed slab face at 200 × 27 px. Per `TRADEMARKS.md`, alter it in the mock —
  render it as styled text, do not copy the source bitmap.
- Product imagery lives at
  `/media/catalog/product/cache/<hash>/<A>/<B>/<SKU>.<n>.jpg`; `products.json`
  stores the un-cached suffix (`/B/0/B08LG9TYC9.0.jpg`) in `image` / `smallImage`
  / `thumbnail` / `gallery[]`. Grid thumbnails are served at 240 × 300
  (`padding-bottom: 125%` aspect box). See `assets/data_model.md` §Images for how
  to map these to local placeholders.
- Icon font is `icons-blank-theme` (73 rules). Substitute inline SVG or a common
  icon set; the glyphs used are: cart, magnifier, chevron-down, chevron-right,
  chevron-left, star, heart (wishlist), compare, refresh (update cart), and the
  pager next/prev arrows.
