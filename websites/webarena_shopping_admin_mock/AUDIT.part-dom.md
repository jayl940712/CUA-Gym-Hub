# AUDIT — Evaluator DOM-Locator Parity (`AUDIT.part-dom.md`)

> **Round 5**
> Dimension: **DOM / selector fidelity only** (not pixels, not layout).
> Method: rendered-DOM extraction from the live source (`http://localhost:7780/admin`,
> **read-only** — navigated and read, never submitted) and the mock
> (`http://localhost:5188`) via Playwright, then a scripted set-diff of every
> `<input>/<select>/<textarea>/<button>/[role]/[data-index]` by `name`, by `id`, by
> element **kind** (tag/type), by `.value`, by option value **and** visible option label,
> by `data-*`, and by associated `<label>` text.
> Extractor `/tmp/pw-dom/extract5.py`, diff `/tmp/pw-dom/diff5.py`.
> Raw dumps `/tmp/pw-dom/src/*.json`, `/tmp/pw-dom/mock/*.json`.

This round swept the surface round 4 explicitly did **not** reach. Round-4 findings that
were re-verified are recorded in the carry-forward table; new findings are numbered
`DOM-2xx`.

---

## Carry-forward: round-4 findings re-verified this round

| Finding | Round-4 claim | Round-5 verdict |
|---|---|---|
| **DOM-005** (`period_type` defaults to `month`) | Fixed on the `sales` panel only; warned it would repeat on the other six | **FIXED EVERYWHERE.** `#sales_report_period_type` `.value === "day"` on all seven panels (`sales`, `refunded`, `tax`, `shipping`, `coupons`, `bestsellers`, `report_product/viewed`) in both source and mock. |
| **DOM-014** (`country_id` had no blank option, two double-escaped labels) | P1 | **FIXED.** `/admin/sales/order/address/address_id/597/` — `country_id` option list is now **byte-identical** to the source: 249 options, same order, first is `["", ""]`, `AG = "Antigua & Barbuda"` and `BA = "Bosnia & Herzegovina"` unescaped. |
| **DOM-014** (`region` free-text input missing) | P1 | **ADDED**, but with a new `.value` divergence — see **DOM-202** below. |
| **NEW-DOM-202** (divergence introduced by the `region` fix) | open | **CONFIRMED** — see DOM-202. |
| **NEW-DOM-201** (products grid missing 2 `data-action` hooks) | P2 | **NOT RE-VERIFIED THIS ROUND** — the shared grid was round 4's lane and I spent the budget on the unswept surface. Still open. |
| **DOM-017** (review-grid row checkboxes lack `id`) | P1 | **NOT RE-VERIFIED THIS ROUND** — same reason. Still open. |
| **DOM-008** (`query` merged into the visible global-search input) | P2 | **STILL PRESENT on every page swept** (10/10). Source: hidden `[name="query"]` + unnamed visible `#search-global`; mock: one `<input type="text" id="search-global" name="query">`. Not re-reported per page. |
| **DOM-007** (`form_key` absent) | P2 | Still absent everywhere; out of contract, not re-reported. |
| **DOM-010** (`store_switcher` / `store_group_switcher` / `website_switcher` / `sales_report_store_ids` hidden inputs) | P2 | Still absent on all report and system-config pages. Not re-reported. |

---

## P0

**None found this round.** Every control that a TASKS.md locator actually drives on the
pages swept resolves with the right name, kind and value. The report panels — the one
place where a P0 was expected to have propagated — are clean (see DOM-200).

---

## P1

### DOM-200 · System Config: six multiselects are rendered as plain text inputs
- **Priority**: P1
- **Pages**: `/admin/admin/system_config/edit/section/general/`,
  `/admin/admin/system_config/edit/section/currency/`
- **Pattern**: this is defect pattern (b) — *a control rendered as a different element
  kind than the source* — and it is the largest instance found this round.
- **Source** (`general`): each of these is a real `<select multiple>` whose `name` carries
  a `[]` suffix, mirrored by a **hidden** input under the un-suffixed name:
  ```html
  <select name="groups[country][fields][allow][value][]" id="general_country_allow"
          multiple="multiple" class="admin__control-multiselect"
          data-ui-id="select-groups-country-fields-allow-value">
    <option value="AF" id="…">Afghanistan</option> … (249 options)
  </select>
  <input type="hidden" name="groups[country][fields][allow][value]"
         id="general_country_allow_hidden" value="">
  <input type="hidden" name="groups[country][fields][allow][value]_disabled" value="">
  ```
- **Mock**:
  ```html
  <input type="text" name="groups[country][fields][allow][value]"
         id="general_country_allow" value="…">
  ```
  — the multiselect (`…[value][]`) **does not exist**, and the mock reuses the source's
  *hidden-mirror* name for a visible text box, taking the multiselect's `id` with it.
- **Affected fields**:
  | source multiselect name | mock renders |
  |---|---|
  | `groups[country][fields][allow][value][]` | text input under `…[allow][value]` |
  | `groups[country][fields][destinations][value][]` | text input under `…[destinations][value]` |
  | `groups[country][fields][optional_zip_countries][value][]` | text input under `…[optional_zip_countries][value]` |
  | `groups[country][fields][eu_countries][value][]` | text input under `…[eu_countries][value]` (a name the source never emits) |
  | `groups[locale][fields][weekend][value][]` | text input, `value="Sunday, Saturday"` and `disabled` |
  | `groups[region][fields][state_required][value][]` | text input, `value="AL,AR,AU,…"` |
  | `groups[options][fields][allow][value][]` (currency) | text input, `value="USD"` |
  | `groups[import][fields][time][value][]` (currency) | **absent entirely** |
- **Impact**: `document.querySelectorAll('[name="groups[country][fields][allow][value][]"]')`
  is empty in the mock; `select_option` is impossible; and the enumerated vocabulary
  (249 country codes, 7 weekday values) is not discoverable from the DOM. The mock also
  puts a *comma-joined human string* (`"Sunday, Saturday"`) where the source's mirror
  holds `""`.
- **Blocks**: no TASKS.md locator (nothing in the 184 tasks touches System Config), so
  this is P1, not P0 — but it is the exact defect class that produced round-4's P0s.
- **Fix**: render each as `<select multiple name="…[value][]" id="<source id>">` with the
  source's full option list, plus the hidden `…[value]` mirror and `…[value]_disabled`.

### DOM-201 · System Config: option sets are truncated to 1–3 entries
- **Priority**: P1
- **Pages**: both system-config sections swept
- **Source → Mock option counts**:
  | name | source | mock | mock's entire option list |
  |---|---|---|---|
  | `groups[locale][fields][timezone][value]` | **416** | **1** | `[("America/New_York","Eastern Standard Time (America/New_York)")]` |
  | `groups[country][fields][default][value]` | **249** | **1** | `[("US","United States")]` |
  | `groups[store_information][fields][country_id][value]` | **249** | **2** | `[("",  "--Please Select--"), ("US","United States")]` |
  | `groups[options][fields][base][value]` (currency) | **168** | **2** | `[("USD","US Dollar"), ("EUR","Euro")]` |
  | `groups[options][fields][default][value]` (currency) | **168** | **2** | same |
  | `groups[locale][fields][code][value]` | **2** (`en_GB`, `en_US`) | **1** (`en_US`) | |
  | `groups[locale][fields][firstday][value]` | **7** (Sun…Sat) | **3** (`0` Sunday, `1` Monday, `6` Saturday) | |
  | `groups[import][fields][error_email_identity][value]` | **5** (adds `custom1`, `custom2`) | **3** | |
- **Impact**: a single-option `<select>` is a dead affordance — "set the store timezone to
  X" is unachievable for every X but one. The source's `default` country select also
  carries a `["", "--Please Select--"]` first option the mock's dropped.
- **Fix**: seed the full option lists from the source (they are static Magento vocabularies;
  the country list is already present verbatim on the order-address page, so it can be
  reused rather than re-derived).

### DOM-202 · Order address edit: `region` renders its value where the source's is empty
- **Priority**: P1 *(this is the divergence the round-4 `region` fix introduced)*
- **Page**: `/admin/sales/order/address/address_id/597/`
- **Source**:
  ```html
  <input id="region" name="region" data-ui-id="adminhtml-edit-renderer-region-0-text-region"
         value="California" class="input-text admin__control-text" type="text"
         aria-required="true" style="display: none;">
  ```
  `document.querySelector('[name="region"]').value` → **`""`**.
  Magento's `region-updater` clears the *property* when the `region_id` dropdown is the
  active control, leaving the stale `value` **attribute** behind.
- **Mock**:
  ```html
  <input id="region" name="region" type="text" class="input-text admin__control-text"
         data-ui-id="adminhtml-edit-renderer-region-0-text-region" aria-required="true"
         value="California" style="display: none;">
  ```
  `.value` → **`"California"`**.
- **Impact**: attribute, id, class, `data-ui-id` and `display:none` all match exactly — only
  the live `.value` differs. An evaluator reading `[name="region"].value` gets
  `"California"` from the mock and `""` from the source.
- **Blocks**: nothing today (538–542 use an empty locator and match on the rendered page
  text), so P1 rather than P0.
- **Fix**: when a `region_id` dropdown is active for the selected country, clear the
  `region` input's value property (keep the attribute), and mirror the source's inverse
  behaviour: for a country with no region list, show `region` and hide `region_id`.

### DOM-203 · Product attribute edit: every stable source `id` is renamed to kebab-case
- **Priority**: P1
- **Page**: `/admin/catalog/product_attribute/edit/attribute_id/93/` (and every attribute)
- **Note on why this one matters**: on most Magento admin pages the `id` is a per-request
  random hash and was never a usable selector. This page is the **legacy** admin form —
  its ids are *stable, human-readable and canonical*. The mock renames all of them.
- **Source → Mock**:
  | `name` | source `id` | mock `id` |
  |---|---|---|
  | `attribute_code` | `attribute_code` | `attribute-code` |
  | `frontend_label[0]` | `attribute_label` | `attribute-label` |
  | `frontend_input` | `frontend_input` | `frontend-input` |
  | `is_required` | `is_required` | `is-required` |
  | `is_comparable` | `is_comparable` | `is-comparable` |
  | `is_searchable` | `is_searchable` | `is-searchable` |
  | `is_visible_on_front` | `is_visible_on_front` | `is-visible-on-front` |
- **Impact**: `#attribute_code`, `#attribute_label`, `#frontend_input` — the three
  selectors any agent trained on this page would reach for — are `null` in the mock.
  The `name`s do match, so a name-based locator still resolves.
- **Fix**: use the source's underscore ids verbatim.

### DOM-204 · Product attribute edit: `frontend_input` has a fabricated option set and the wrong current value
- **Priority**: P1
- **Page**: `/admin/catalog/product_attribute/edit/attribute_id/93/` (`color`, a visual swatch)
- **Source**:
  ```html
  <select id="frontend_input" name="frontend_input" class="required-entry select admin__control-select">
    <option value="select">Dropdown</option>
    <option value="swatch_visual" selected>Visual Swatch</option>
    <option value="swatch_text">Text Swatch</option>
  </select>
  ```
  `.value === "swatch_visual"` — Magento restricts the catalog-input-type list for an
  existing swatch attribute to these three.
- **Mock**:
  ```html
  <select id="frontend-input" name="frontend_input">
    <option value="text">text</option><option value="textarea">textarea</option>
    <option value="texteditor">texteditor</option><option value="date">date</option>
    … 12 options … </select>
  ```
  `.value === "select"`.
- **Impact**: three problems at once — (1) the current value is wrong, so the page claims
  `color` is a Dropdown when the source says Visual Swatch; (2) nine option values the
  source does not offer here are fabricated; (3) the labels are **lowercase raw codes**
  (`text`, `textarea`) where Magento renders Title Case display names (`Text Field`,
  `Text Area`, `Dropdown`, `Visual Swatch`), which breaks text matching.
- **Fix**: render the source's three options with their labels and select `swatch_visual`.

### DOM-205 · Product attribute edit: swatch option rows use the plain-dropdown name prefix
- **Priority**: P1
- **Page**: `/admin/catalog/product_attribute/edit/attribute_id/93/`
- **Source** (visual-swatch attribute → `optionvisual` / `swatchvisual` / `defaultvisual`):
  ```html
  <input type="text" name="optionvisual[value][49][0]" value="Black" class="input-text required-option">
  <input type="text" name="optionvisual[value][49][1]" value="">        <!-- store-view label -->
  <input type="hidden" name="optionvisual[order][49]" value="0">
  <input type="checkbox" name="optionvisual[delete][49]" value="">
  <input type="hidden" name="swatchvisual[value][49]" value="#000000">
  <input type="radio" name="defaultvisual[]" value="49">
  ```
  (repeated for option ids 49–60 — the twelve colour options)
- **Mock**:
  ```html
  <input name="option[value][49][0]" …>
  <input name="option[order][49]" …>
  <input type="radio" name="default[]" value="49">
  ```
- **Impact**: a **complete name-set mismatch** on the control that edits colour swatches —
  every `optionvisual[*]`, `swatchvisual[*]` and `defaultvisual[]` selector is `null`
  (72 names), and the mock invents 25 `option[*]` / `default[]` names the source does not
  emit on this attribute. Also missing per row: the store-view label column
  (`[value][N][1]`), the delete checkbox (`[delete][N]`) and the swatch colour hex
  (`swatchvisual[value][N]`).
- **Fix**: switch the prefix by `frontend_input` — `option`/`default` for `select`,
  `optionvisual`/`swatchvisual`/`defaultvisual` for `swatch_visual`,
  `optiontext`/`swatchtext`/`defaulttext` for `swatch_text` — and emit all four columns
  per row.

### DOM-206 · Product attribute edit: ~30 Advanced / Storefront Properties fields absent
- **Priority**: P1
- **Page**: `/admin/catalog/product_attribute/edit/attribute_id/93/`
- **Counts**: source exposes **145** controls, the mock **62**.
- **Missing `name`s** (all present in the source's rendered DOM, in the *Advanced Attribute
  Properties* and *Storefront Properties* fieldsets):
  `attribute_id`, `is_global`, `is_unique`, `frontend_class`, `position`,
  `frontend_label[1]`, `default_value_text`, `default_value_textarea`, `default_value_date`,
  `default_value_datetime`, `default_value_yesno`, `is_filterable`,
  `is_filterable_in_search`, `is_filterable_in_grid`, `used_for_sort_by`,
  `used_in_product_listing`, `is_used_for_promo_rules`, `is_html_allowed_on_front`,
  `is_visible_in_advanced_search`, `is_used_in_grid`, `is_visible_in_grid`,
  `search_weight`, `use_product_image_for_swatch`, `update_product_preview_image`,
  `dropdown_attribute_validation`, `dropdown_attribute_validation_unique`,
  `text_swatch_validation`, `text_swatch_validation_unique`, `visual_swatch_validation`,
  `visual_swatch_validation_unique`, `datafile`.
- **Fix**: render the two fieldsets. `is_global` (`0`=Store View, `1`=Global, `2`=Website),
  `is_filterable` (`0`/`1`/`2`) and `is_unique` are the ones an agent is most likely to drive.

### DOM-207 · Yes/No selects are ordered `No, Yes`; the source orders them `Yes, No`
- **Priority**: P1
- **Page**: `/admin/catalog/product_attribute/edit/attribute_id/93/`
- **Controls**: `is_required`, `is_comparable`, `is_searchable`, `is_visible_on_front`
- **Source**: `[("1","Yes"), ("0","No")]` — **Yes first** on every one.
- **Mock**: `[("0","No"), ("1","Yes")]`
- **Impact**: values and labels are right, only the order is inverted — so
  `select.selectedIndex` and `options[N]`-style locators resolve to the *opposite* answer.
  WebArena does use `selectedIndex` (task 759), which is why option order is a finding and
  not cosmetics. Same defect class as round-4's DOM-103.
- **Fix**: emit `Yes` first.

### DOM-208 · New Customer: `customer[group_id]` fabricates `NOT LOGGED IN` and reorders
- **Priority**: P1
- **Page**: `/admin/customer/index/new/`
- **Source**:
  ```html
  <select name="customer[group_id]" id="U9TNNLY" class="admin__control-select">
    <option value="1">General</option>
    <option value="3">Retailer</option>
    <option value="2">Wholesale</option></select>
  ```
  — three options, **alphabetical by label**, no `NOT LOGGED IN`, no blank.
- **Mock**:
  ```html
  <select id="customer-group-id" name="customer[group_id]">
    <option value="0">NOT LOGGED IN</option><option value="1">General</option>
    <option value="2">Wholesale</option><option value="3">Retailer</option></select>
  ```
- **Impact**: `0 = NOT LOGGED IN` is not assignable to a customer in Magento and is a
  fabricated entry in a selector-visible vocabulary; the order differs so index-based
  selection lands on the wrong group.
- **Fix**: drop `0`, order `General, Retailer, Wholesale`.

### DOM-209 · New Customer: `customer[dob]` and `customer[email]` are the wrong input type
- **Priority**: P1
- **Page**: `/admin/customer/index/new/`
- **Source**: `<input type="text" name="customer[dob]" id="H3RWK6R" class="admin__control-text _has-datepicker">`
  and `<input type="email" name="customer[email]" id="EPBSN3V" class="admin__control-text">`
- **Mock**: `<input type="date" id="customer-dob" name="customer[dob]">` and
  `<input type="text" id="customer-email" name="customer[email]">`
- **Impact**: same class as round-4's DOM-006 (fixed on the product form, recurring here).
  `type="date"` reports `.value` as ISO `YYYY-MM-DD` where the source's datepicker reports
  the localized `M/D/YYYY` string; `type="email"`↔`type="text"` flips the browser's
  validation behaviour an agent may rely on.
- **Fix**: `type="text"` for `dob`, `type="email"` for `email`.

### DOM-210 · New Customer: two source controls are missing
- **Priority**: P1
- **Page**: `/admin/customer/index/new/`
- **Missing from the mock**:
  ```html
  <input type="checkbox" class="admin__actions-switch-checkbox" id="JRQ7EAI"
         name="customer[extension_attributes][assistance_allowed]" value="1">
      <!-- label: "Allow remote shopping assistance" -->
  <select class="admin__control-select" name="customer[sendemail_store_id]" id="OAUF0DT">
      <!-- label: "Send Welcome Email From", .value = "1" -->
  ```
- **Fix**: add both, with `value="1"` on the checkbox (see DOM-211).

### DOM-211 · `customer[disable_auto_group_change]` has `value="on"`
- **Priority**: P1
- **Page**: `/admin/customer/index/new/`
- **Source**: `<input type="checkbox" name="customer[disable_auto_group_change]" id="T63KBX6" value="0" class="admin__control-checkbox">`
- **Mock**: `<input type="checkbox" id="customer-disable-auto-group" name="customer[disable_auto_group_change]">` — no `value` attribute, so `.value` is the browser default `"on"`.
- **Impact**: this is **defect pattern (a)** — a checkbox with no explicit `value` — the
  fifth instance in this migration (BUG-107, DOM-009, DOM-013 ×2, now this).
- **Fix**: `value="0"`. And sweep: `grep -n 'type="checkbox"' src/**` and confirm every
  one carries an explicit `value`.

### DOM-212 · Customer edit: seven page-action buttons lost their stable source `id`s
- **Priority**: P1
- **Page**: `/admin/customer/index/edit/id/1/`
- **Source → Mock** (button text is identical on both sides; only the `id` is lost):
  | button text | source `id` / `data-ui-id` | mock |
  |---|---|---|
  | Login as Customer | `login_as_customer` / `login-as-customer-button` | no `id` |
  | Delete Customer | `customer-edit-delete-button` / `customer-edit-delete-button-button` (+ `data-url`) | no `id` |
  | Reset | `reset` / `reset-button` | no `id` |
  | Create Order | `order` / `order-button` | no `id` |
  | Reset Password | `resetPassword` / `resetpassword-button` | no `id` |
  | Force Sign-In | `invalidateToken` / `invalidatetoken-button` | no `id` |
  | Save and Continue Edit | `save_and_continue` / `save-and-continue-button` | no `id` |
- **Correct**: `#back` and `#save` match on both sides.
- **`#reset` and `#save_and_continue` are missing on `/admin/customer/index/new/` too.**
- **Fix**: add the source `id`s (and ideally the `data-ui-id`s).

### DOM-213 · Attribute-set edit: three buttons absent, and `attribute_set_name`'s id drifts
- **Priority**: P1
- **Page**: `/admin/catalog/product_set/edit/id/4/`
- **`attribute_set_name`**: source `<input name="attribute_set_name" id="attribute_set_name">`
  (another *stable* legacy id); mock uses `id="attribute-set-name"` → `#attribute_set_name`
  is `null`.
- **Buttons the mock does not render at all** (source ids are per-request hashes, so
  `data-ui-id` is the stable hook):
  | text | source `data-ui-id` |
  |---|---|
  | Reset | `page-actions-toolbar-reset-button` |
  | Add New | `adminhtml-catalog-product-set-edit-add-group-button` |
  | Delete Selected Group | `adminhtml-catalog-product-set-edit-delete-group-button` |
  The mock's `Back` and `Save` render but carry neither `id` nor `data-ui-id`
  (source: `page-actions-toolbar-back-button` / `page-actions-toolbar-save-button`).
- **Fix**: add the three buttons and the five `data-ui-id`s; restore the underscore id.

### DOM-214 · System Config: all `[inherit]` "Use system value" checkboxes are missing
- **Priority**: P1
- **Pages**: both system-config sections
- **Source**: every inheritable field is followed by
  ```html
  <input type="checkbox" name="groups[country][fields][allow][inherit]"
         id="general_country_allow_inherit" value="1" class="checkbox config-inherit">
  ```
  — 8 on `general` (`country/allow`, `country/default`, `country/eu_countries`,
  `country/optional_zip_countries`, `locale/firstday`, `locale/weekend`,
  `locale/weight_unit`), 6 on `currency` (`import/enabled`, `import/error_email_identity`,
  `import/error_email_template`, `options/allow`, `options/base`, `options/default`).
- **Mock**: none of them exist.
- **Impact**: the "Use system value" checkbox is what *enables* the field next to it in
  Magento — without it, an agent cannot make a locked field editable, and the pattern is
  the single most-repeated control shape in System Config.
- **Fix**: emit `name="groups[<g>][fields][<f>][inherit]"` `id="<section>_<g>_<f>_inherit"`
  `value="1"` next to each inheritable field, plus the hidden
  `name="groups[<g>][fields][<f>][value]_disabled"` companion.

### DOM-215 · CMS block edit: `data-index` wrappers, `block_id` field and `#save-button` absent
- **Priority**: P1
- **Page**: `/admin/cms/block/edit/block_id/1/`
- **`data-index` missing entirely** — source emits 7 (`general`, `block_id`, `is_active`,
  `title`, `identifier`, `storeviews`, `content`), mock emits **0**. Same defect as
  round-4's DOM-002 on the product form, one page over; `[data-index="…"]` is the
  evaluator hook that tasks 547–551 already depend on elsewhere.
- **Missing control**: `<input class="admin__control-text" type="text" name="block_id" id="WVKVRQI" value="1">`
  inside `[data-index="block_id"]` — the source renders the block id as an editable field.
- **Save button**: source `<button id="save-button" data-ui-id="save-button" class="action-default primary">`;
  mock `<button id="save" class="action-default scalable primary save">` → `#save-button` is `null`.
  (Same drift as round-4's DOM-004 note on the review form.)
- **Correct on this page**: `is_active` is
  `<input type="checkbox" class="admin__actions-switch-checkbox" name="is_active" value="1">`
  on both — **no `value="on"` bug here**; `title`, `identifier` and the `store_id`
  multiselect match on name, kind and option pairs.
- **Fix**: add the seven `data-index` wrappers, the `block_id` input, and `id="save-button"`.

### DOM-222 · Configurations wizard: the whole wizard uses a mock-invented selector vocabulary
- **Priority**: P1 *(functionally the wizard works — see the verdict below — so this is not P0)*
- **Page**: `/admin/catalog/product/edit/id/1130/` → "Edit Configurations"
- **Verdict first — tasks 547–551 RESOLVE.** I drove the mock's wizard end to end by
  selector, the way an evaluator would: open → step 1 (attributes) → step 2 (values,
  checked Brown) → step 3 → step 4 → Generate Products → Save. Result:
  - `document.querySelector('[data-index="configurable"]').outerText` **contains
    `"Phoebe Zipper Sweatshirt-S-Brown"`** (task 547's exact locator + assertion)
  - `[data-index="configurable-matrix"]` is present and contains the same string
  - the string **survives a cold reload** of `/admin/catalog/product/edit/id/1130/?sid=…`
  - `/go?sid=` `state_diff` carries it: keys `productOverrides` (1130 gains
    `configurable_children: […, 2041, 2042, 2043, 2044, 2045]`),
    `productDescriptionOverrides`, `newProducts`; 4457 bytes, `"S-Brown"` present.
  - The mock's option ids are **real**: `attributes[]` = `93` (color) / `144` (size) /
    `150` (format), `configurable[size][]` `167 = S`, `configurable[color][]` `51 = Brown`
    — these match the source's attribute and option ids exactly.
- **But every selector differs.** The source's wizard is a Knockout UI grid and carries
  **no `name` attribute anywhere in the modal**; the mock invents five:
  | step | mock invents | source has |
  |---|---|---|
  | 1 | `[name="attributes[]"]` (value = attribute id) | no `name`; `<input type="checkbox" class="admin__control-checkbox" id="idscheck93" value="93">` — the shared-grid row-checkbox pattern |
  | 2 | `[name="configurable[size][]"]`, `[name="configurable[color][]"]` | no `name`; checkboxes keyed only by a per-request random id (`id="EKVKN32" value="EKVKN32"`) |
  | 3 | `[name="bulk[price]"]`, `[name="bulk[qty]"]` | no `name` on those; instead **nine mode radios** — see below |
- **Source hooks that are `null` in the mock** (checked on all four steps):
  - `#idscheck93`, `#idscheck144`, `#idscheck150` — step 1's per-attribute checkboxes.
    The mock's step-1 checkboxes carry the right `value` but **no `id`**. This is round-4's
    DOM-101 row-checkbox defect recurring *inside* the wizard.
  - the nine step-3 radios, all with stable non-hash ids:
    `#apply-single-set-radio` (`value="single"`), `#apply-unique-images-radio` (`each`),
    `#skip-images-uploading-radio` (`none`), `#apply-single-price-radio`,
    `#apply-unique-prices-radio`, `#skip-pricing-radio`, `#apply-single-inventory-radio`,
    `#apply-unique-inventory-radio`, `#skip-inventory-radio` — plus the four hidden
    `<input name="image">`, `name="small_image"`, `name="thumbnail"`, `name="swatch_image"`.
    **The mock renders none of the nine**, so "apply a single price to all new SKUs" vs
    "apply unique prices" is not expressible.
  - classes `.action-next-step`, `.action-back-step`, `.action-cancel`,
    `.action-select-all`, `.action-deselect-all`, `.action-remove-all`, `.action-basic`
    — the source's buttons have **no `id`**, so these classes are their only stable hook.
    The mock uses `#wizard_next` / `#wizard_back` / `#wizard_cancel` /
    `#generate_configurations` with classes `action-primary` / `action-default` /
    `admin__field-inline-link`.
  - `.steps-wizard-title` — the source renders the four step headings
    `Step 1: Select Attributes`, `Step 2: Attribute Values`,
    `Step 3: Bulk Images, Price and Quantity`, `Step 4: Summary`.
    **The mock renders no step titles at all** (`document.querySelectorAll('.steps-wizard-title')`
    is empty on every step) — a visible-string loss for an agent orienting inside the modal.
- **Fix**, in priority order: (1) give the step-1 checkboxes `id="idscheck<attrId>"`;
  (2) add the nine step-3 mode radios with the source's ids and `single`/`each`/`none`
  values; (3) add `.action-next-step` / `.action-back-step` / `.action-cancel` /
  `.action-select-all` / `.action-deselect-all` / `.action-remove-all` alongside the
  existing ids; (4) render the four `.steps-wizard-title` headings.
  Keep the invented `name`s — they are harmless additions and are what the mock's own
  handlers bind to.

---

## P2

### DOM-216 · Report `Export to:` select is renamed on all seven report panels
- **Source**: `<select id="id_<32-char-hash>_export" name="id_<hash>_export">` whose option
  **values are absolute export URLs** —
  `http://…/admin/reports/report_sales/exportRefundedCsv/`,
  `…/exportTaxCsv/`, `…/exportShippingCsv/`, `…/exportCouponsCsv/`,
  `…/exportBestsellersCsv/`, `…/report_product/exportViewedCsv/`.
- **Mock**: `<select id="refundedReportGrid_export" name="refundedReportGrid_export">` with
  option values `csv` / `xml` (and `taxReportGrid_export`, `shippingReportGrid_export`,
  `couponsReportGrid_export`, `bestsellersReportGrid_export`, `viewedReportGrid_export`).
- The source's id/name is a per-request hash, so no stable selector existed on either
  side and the visible labels (`CSV`, `Excel XML`) match. Restatement of round-4's DOM-011,
  now confirmed on all six additional panels. No task impact.

### DOM-217 · Coupons report: `rules_list[]` is enabled and populated where the source's is disabled and empty
- **Page**: `/admin/reports/report_sales/coupons/`
- **Source**: `<select id="sales_report_rules_list" name="rules_list[]" size="10" multiple disabled style="display:none">` — **0 options**, disabled, hidden (because `price_rule_type` is `Any`).
- **Mock**: same id/name/size/multiple, but **visible, enabled, and carrying 4 options**
  (`1` Buy 3 tee shirts…, `2` Spend $50 or more…, `3` 20% OFF Ever $200-plus purchase!*,
  `4` $4 Luma water bottle (save 70%)). The four rule names are real seed values, so this
  is not fabricated data — only the disabled/hidden state and the eager option render differ.
- **Fix**: disable + hide `rules_list[]` while `price_rule_type === "0"`, and enable it
  when the user selects `Specified`.

### DOM-218 · Currency config: API-key fields are `type="text"`, source uses `type="password"`
- **Page**: `/admin/admin/system_config/edit/section/currency/`
- `groups[currencyconverterapi][fields][api_key][value]`,
  `groups[fixerio][fields][api_key][value]`,
  `groups[fixerio_apilayer][fields][api_key][value]` — source `input/password`,
  mock `input/text`. Names and ids match.

### DOM-219 · `customer[gender]` blank option carries invented label text
- **Page**: `/admin/customer/index/new/`
- Source: `[("", ""), ("1","Male"), ("2","Female"), ("3","Not Specified")]`
- Mock: `[("", "-- Please Select --"), …]` — the three real options match exactly; only the
  empty option's visible text is fabricated. Breaks text matching over the select.

### DOM-220 · CMS block content editor: mock invents `textarea[name="content"]`
- **Page**: `/admin/cms/block/edit/block_id/1/`
- The source renders the content field as a **PageBuilder stage** inside
  `[data-index="content"]` (`.admin__field-page-builder`) with no `name`d control in the
  DOM; the mock renders `<textarea id="block_content" name="content" class="admin__control-textarea">`.
- Listed as a set-difference, **not** as a defect to fix: PageBuilder is out of the
  migration contract and the textarea is the only workable affordance. Flagged so the
  extra `name` is not mistaken for a bug later.

### DOM-221 · System Config: `config_state[...]` hidden inputs absent
- Source emits one per fieldset (`config_state[general_country]`, `[general_locale]`,
  `[general_region]`, `[general_single_store_mode]`, `[general_store_information]`, and
  five more on `currency`), each `id="<group>-state" value="1"`, tracking which fieldsets
  are expanded. Mock emits none. No task reads them.

---

## Verified-correct this round (no finding)

| Page | Control | Status |
|---|---|---|
| all 7 report panels | `#sales_report_from` / `[name="from"]` and `#sales_report_to` / `[name="to"]` | `<input type="text" name="from" id="sales_report_from">` on **both** sides, id + name + kind + empty initial value identical → **tasks 705, 706, 707, 708, 709, 710, 711, 712, 713 all resolve** |
| all 7 report panels | `period_type` | `<select id="sales_report_period_type" name="period_type">`, options `day/Day, month/Month, year/Year`, `.value === "day"` on cold load — **exact match, DOM-005 fully fixed** |
| refunded | `report_type` | `created_at_order/Order Created`, `created_at_refunded/Last Credit Memo Created Date` — exact |
| shipping | `report_type` | `created_at_order/Order Created`, `created_at_shipment/First Invoice Created Date` — exact |
| tax, coupons | `report_type` | `created_at_order/Order Created`, `updated_at_order/Order Updated` — exact |
| refunded, tax, shipping, coupons | `show_order_statuses` | `0/Any`, `1/Specified`, `.value="0"` — exact |
| all 7 | `show_empty_rows` | `1/Yes`, `0/No`, `.value="0"` — exact |
| coupons | `price_rule_type` | `0/Any`, `1/Specified`, `.value="0"` — exact |
| bestsellers, report_product/viewed | full named-control set | exact apart from the export select (DOM-216) |
| order address 597 | `country_id` | **249 options, byte-identical values, labels and order** to the source |
| order address 597 | `region_id` | 66 options, exact match (`12 = California`) |
| order address 597 | `firstname`, `lastname`, `company`, `city`, `postcode`, `telephone`, `fax` | name + kind + value match |
| CMS block 1 | `is_active` | `class="admin__actions-switch-checkbox" value="1"` — correct, no `value="on"` bug |
| CMS block 1 | `title`, `identifier`, `store_id` | names, kinds and option pairs match (`store_id` multiselect: `0/All Store Views`, `1/Default Store View`) |
| New Customer | `customer[firstname]`, `[middlename]`, `[lastname]`, `[prefix]`, `[suffix]`, `[taxvat]`, `[website_id]` | names and kinds match |
| system config `general` | all 23 `groups[…][value]` field **names** | present with the source's exact names (the kinds/options are what diverge — DOM-200/201) |
| product attribute 93 | `attribute_code`, `frontend_label[0]`, `is_required`, `is_comparable`, `is_searchable`, `is_visible_on_front` **names** and option **values** | match (ids and option order are what diverge — DOM-203/207) |

---

## Coverage

### Pages compared, source vs mock, at the DOM level, this round

| # | Page | Result |
|---|---|---|
| 1 | `/admin/reports/report_sales/refunded/` | clean (DOM-216 only) |
| 2 | `/admin/reports/report_sales/tax/` | clean (DOM-216 only) |
| 3 | `/admin/reports/report_sales/shipping/` | clean (DOM-216 only) |
| 4 | `/admin/reports/report_sales/coupons/` | DOM-216, DOM-217 |
| 5 | `/admin/reports/report_sales/bestsellers/` | clean (DOM-216 only) |
| 6 | `/admin/reports/report_product/viewed/` | clean (DOM-216 only) |
| 7 | `/admin/admin/system_config/edit/section/general/` | DOM-200, DOM-201, DOM-214, DOM-221 |
| 8 | `/admin/admin/system_config/edit/section/currency/` | DOM-200, DOM-201, DOM-214, DOM-218, DOM-221 |
| 9 | `/admin/customer/index/new/` | DOM-208, DOM-209, DOM-210, DOM-211, DOM-212, DOM-219 |
| 10 | `/admin/customer/index/edit/id/1/` | DOM-212 |
| 11 | `/admin/catalog/product_attribute/edit/attribute_id/93/` | DOM-203…207 |
| 12 | `/admin/catalog/product_set/edit/id/4/` | DOM-213 |
| 13 | `/admin/cms/block/edit/block_id/1/` | DOM-215, DOM-220 |
| 14 | `/admin/sales/order/address/address_id/597/` (re-check) | DOM-202; `country_id` **fixed** |
| 15 | `/admin/catalog/product/edit/id/1130/` → **Configurations wizard, driven end to end on both sides** (source read-only: opened and stepped 1→4, never generated, never saved) | DOM-222 |

### Not reached — for a follow-up shard

- **NEW-DOM-201** (products grid `data-action` hooks) and **DOM-017** (review-grid row
  checkbox `id`s) were not re-verified — both live on the shared grid, which was round 4's
  lane, and the budget went to the unswept surface as instructed. **Still open.**
- **Customer edit sub-tabs** — the mock renders all nine tab buttons (`Customer View`,
  `Account Information`, `Addresses`, `Orders`, `Shopping cart`, `Newsletter`,
  `Billing Agreements`, `Product Reviews`, `Wish List`) with matching labels, but I
  compared only the cold-load DOM. The source's cold load is lazy (17 controls, 3 named),
  so a per-tab comparison needs a click-through on both sides.
- **Order sub-tab grids** (Invoices / Credit Memos / Shipments / Comments History) —
  still not opened; round 4 flagged ~40 named filter inputs there. Overlaps DOM-100.
- **Other System Config sections** — only `general` and `currency` were compared. There
  are ~40 sections; DOM-200/201/214 are structural and will repeat in all of them.
- **Other attribute pages** — only attribute 93 (`color`, visual swatch) was compared.
  DOM-205's prefix bug needs re-checking for a plain dropdown attribute (`option[*]`,
  which is what the mock always emits) and a text swatch (`optiontext[*]`).
- **New Attribute Set** (`/admin/catalog/product_set/add/`) and the **New Attribute** form.

---

## Summary

| Priority | Count | IDs |
|---|---|---|
| **P0** | **0** | — |
| **P1** | **16** | DOM-200…215, DOM-222 *(DOM-216…221 are P2)* |
| **P2** | **6** | DOM-216, DOM-217, DOM-218, DOM-219, DOM-220, DOM-221 |
| **Total** | **22** | |

### Task impact

**No task on the pages swept this round is blocked.** Specifically confirmed resolving:

| Tasks | Why they resolve |
|---|---|
| **706, 708, 710, 711, 712, 713** | `#sales_report_from` / `#sales_report_to` are `input[type=text]` with the source's exact ids and names on all six non-`sales` report panels, and `period_type` now defaults to `day` on every one — the round-4 warning that DOM-005 would repeat is **disproved**. |
| **705, 707, 709** | unchanged and still correct on the `sales` panel. |
| **547, 548, 549, 550, 551** | wizard driven end to end; `[data-index="configurable"]`.outerText carries the new variant, survives cold reload, and reaches `/go` `state_diff`. |
| **538–542** | order-address `country_id` is now byte-identical to the source (249 options); `region_id` unchanged and correct. |

Everything found this round is P1/P2 because the affected surfaces — System Config,
attribute editing, attribute sets, New Customer, CMS blocks — carry **no TASKS.md locator
among the 184 tasks**. They matter because an agent trained on the source will reach for
selectors that are `null` in the mock.

### The two hunted patterns, this round's tally

**(a) `<input type="checkbox">` with no explicit `value`** — one new instance:
`customer[disable_auto_group_change]` (DOM-211), the fifth in this migration. CMS block's
`is_active` is **correct** (`value="1"`), so the sweep is landing; it is not finished.
The dev agent should run a mechanical sweep rather than fixing instances by hand.

**(b) control rendered as a different element kind** — six new instances, and it is now
the dominant defect class: six System Config multiselects rendered as text inputs
(DOM-200), three currency API-key fields `password`→`text` (DOM-218), `customer[dob]`
`text`→`date` and `customer[email]` `email`→`text` (DOM-209).

**A third pattern is emerging: option-set drift.** Truncated option lists (DOM-201:
416→1, 249→1, 168→2), inverted option order (DOM-207: `Yes,No` → `No,Yes`), fabricated
options (DOM-204's nine invented `frontend_input` values, DOM-208's `NOT LOGGED IN`), and
fabricated empty-option labels (DOM-219). Because WebArena reads `selectedIndex`
(task 759), option **order** is as load-bearing as option values.
