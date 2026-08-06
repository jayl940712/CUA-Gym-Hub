/* Swatch facts for Stores > Attributes > Product > Edit (F-03 / F-04).
 *
 * `eav_attribute.frontend_input` is `select` for both Color and Size — Magento
 * keeps the swatch flavour in `swatch_input_type` (Magento_Swatches), which the
 * seed does not carry. The edit form is driven by that flavour, not by the DB
 * column: it decides the `frontend_input` option set, the option-row name
 * prefix (`optionvisual` / `optiontext` / `option`), and whether the block is
 * titled "Manage Swatch" or "Manage Options".
 *
 * Every value below was read off the LIVE source's rendered DOM, not invented:
 *   /admin/catalog/product_attribute/edit/attribute_id/93/   (color → swatch_visual)
 *   /admin/catalog/product_attribute/edit/attribute_id/144/  (size  → swatch_text)
 *   /admin/catalog/product_attribute/edit/attribute_id/114/  (country_of_manufacture
 *                                                             → plain select)
 *   /admin/catalog/product_attribute/edit/attribute_id/75/   (description → pagebuilder)
 */

/**
 * attribute_code -> the `frontend_input` the SOURCE's edit form shows, where it
 * differs from `eav_attribute.frontend_input` in the seed.
 */
export const SOURCE_FRONTEND_INPUT = {
  color: 'swatch_visual',
  size: 'swatch_text',
  description: 'pagebuilder',
}

/**
 * `swatchvisual[value][<option_id>]` for the Color attribute — the source's own
 * hex values, in option order (Black … Yellow).
 */
export const VISUAL_SWATCH_VALUES = {
  color: {
    49: '#000000', 50: '#1857f7', 51: '#945454', 52: '#8f8f8f',
    53: '#53a828', 54: '#ce64d4', 55: '#ffffff', 56: '#eb6703',
    57: '#ef3dff', 58: '#ff0000', 59: '#ffffff', 60: '#ffd500',
  },
}

/**
 * The three `frontend_input` vocabularies the source serves. Magento will not
 * let an existing attribute cross groups, so the option set depends on the
 * attribute's CURRENT type — the mock previously served all 12-14 raw codes on
 * every attribute, inventing 9 values the source never offers for Color.
 */
export const INPUT_TYPES_FULL = [
  ['text', 'Text Field'], ['textarea', 'Text Area'], ['texteditor', 'Text Editor'],
  ['pagebuilder', 'Page Builder'], ['date', 'Date'], ['datetime', 'Date and Time'],
  ['boolean', 'Yes/No'], ['multiselect', 'Multiple Select'], ['select', 'Dropdown'],
  ['price', 'Price'], ['media_image', 'Media Image'], ['weee', 'Fixed Product Tax'],
  ['swatch_visual', 'Visual Swatch'], ['swatch_text', 'Text Swatch'],
]

/** select / swatch_visual / swatch_text — verified on 93, 144 and 114. */
export const INPUT_TYPES_SELECT_GROUP = [
  ['select', 'Dropdown'], ['swatch_visual', 'Visual Swatch'], ['swatch_text', 'Text Swatch'],
]

/** textarea / texteditor / pagebuilder — verified on 75 and 86. */
export const INPUT_TYPES_TEXT_GROUP = [
  ['textarea', 'Text Area'], ['texteditor', 'Text Editor'], ['pagebuilder', 'Page Builder'],
]

export function frontendInputOptions(current) {
  if (INPUT_TYPES_SELECT_GROUP.some(([v]) => v === current)) return INPUT_TYPES_SELECT_GROUP
  if (INPUT_TYPES_TEXT_GROUP.some(([v]) => v === current)) return INPUT_TYPES_TEXT_GROUP
  return INPUT_TYPES_FULL
}

/** Name prefixes for the option rows — `optionvisual[…]` / `optiontext[…]` / `option[…]`. */
export function optionNames(frontendInput) {
  if (frontendInput === 'swatch_visual') return { opt: 'optionvisual', def: 'defaultvisual', swatch: 'swatchvisual' }
  if (frontendInput === 'swatch_text') return { opt: 'optiontext', def: 'defaulttext', swatch: 'swatchtext' }
  return { opt: 'option', def: 'default', swatch: null }
}

/**
 * F-05 — real `eav_attribute_option.sort_order` ordering, read off the live
 * source's own `[name="product[material]"]` on
 * `/admin/catalog/product/edit/id/1/`. The seed's `sort_order` column is a
 * regular 0,0,1,1,2,2… interleave that does not reproduce the source's list,
 * so the source's observed id order is carried here verbatim. Only attributes
 * whose rendered order diverges from the seed order need an entry.
 */
export const SOURCE_OPTION_ORDER = {
  material: [
    31, 142, 32, 143, 33, 144, 34, 145, 146, 35, 147, 36, 148, 37, 149, 38,
    39, 150, 151, 40, 152, 41, 42, 153, 43, 154, 155, 44, 156, 45, 157, 46,
    47, 158, 48, 159,
  ],
}

/** Reorder an attribute's options to the source's order where one is known. */
export function orderAttributeOptions(attributeCode, options) {
  const order = SOURCE_OPTION_ORDER[attributeCode]
  if (!order || !options) return options || []
  const rank = new Map(order.map((id, i) => [String(id), i]))
  return [...options].sort((a, b) => {
    const ra = rank.has(String(a.option_id)) ? rank.get(String(a.option_id)) : Number.MAX_SAFE_INTEGER
    const rb = rank.has(String(b.option_id)) ? rank.get(String(b.option_id)) : Number.MAX_SAFE_INTEGER
    return ra - rb
  })
}
