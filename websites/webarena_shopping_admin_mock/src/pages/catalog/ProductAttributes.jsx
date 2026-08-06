import React, { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import LegacyAdminGrid from '../../components/grid/LegacyAdminGrid.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import { Field, Fieldset } from '../../components/catalog/FormControls.jsx'
import {
  SOURCE_FRONTEND_INPUT, VISUAL_SWATCH_VALUES, INPUT_TYPES_FULL,
  frontendInputOptions, optionNames,
} from '../../components/catalog/attributeSwatches.js'
import '../../components/catalog/adminForm.css'
import { useApp } from '../../context/AppContext.jsx'
import { staticData as S } from '../../utils/dataManager.js'
import { useSidNavigate } from '../../utils/navigation.js'

/* ROUTES rows 46 & 47 — Stores > Attributes > Product.
 *
 * `productAttributes.json` is bulk static reference data (see dataManager.js's
 * split rationale), so edits ride in a sparse `productAttributeOverrides` map
 * added to state at runtime. See DEV PROGRESS — this key should be declared in
 * createInitialData()/SCHEMA.md by whoever owns dataManager.js.
 */

const YESNO = [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]

/**
 * Attributes the source's grid does NOT list (DIFF-008).
 *
 * `Magento\Catalog\Block\Adminhtml\Product\Attribute\Grid` builds its
 * collection with `addVisibleFilter()`, i.e. `catalog_eav_attribute.is_visible
 * = 1`. The seed carries all 81 product attributes (correctly — the attribute
 * *edit* pages and the product form both need the hidden ones) but has no
 * `is_visible` column, so the 15 codes it excludes are pinned here. Verified
 * read-only against the container:
 *
 *   SELECT a.attribute_code FROM eav_attribute a
 *     JOIN catalog_eav_attribute c ON c.attribute_id = a.attribute_id
 *    WHERE a.entity_type_id = 4 AND c.is_visible = 0;
 *
 * 81 total - 15 hidden = the source's `66 records found`.
 */
const GRID_HIDDEN_ATTRIBUTE_CODES = new Set([
  'created_at', 'custom_layout_update', 'has_options', 'image_label',
  'links_exist', 'links_purchased_separately', 'links_title', 'minimal_price',
  'old_id', 'required_options', 'samples_title', 'small_image_label',
  'thumbnail_label', 'updated_at', 'url_path',
])

/** `eav_attribute.is_global` — the source's own option labels, verbatim. */
function scopeLabel(a) {
  if (a.is_global === 1) return 'Global'
  if (a.is_global === 2) return 'Web Site'
  return 'Store View'
}

/** `catalog_eav_attribute.is_filterable` is tri-state, not a boolean. */
function filterableLabel(a) {
  if (a.is_filterable === 1) return 'Filterable (with results)'
  if (a.is_filterable === 2) return 'Filterable (no results)'
  return 'No'
}

/**
 * `frontend_input` options, value+label verbatim from the source's
 * `select[name="frontend_input"]` on /admin/catalog/product_attribute/new/.
 */
const INPUT_TYPES = INPUT_TYPES_FULL

/** DOM-207 — every Yes/No select on these forms emits Yes first in the source. */
const YESNO_OPTS = [['1', 'Yes'], ['0', 'No']]

/**
 * One `<select>` row of the attribute edit form. Declared at module scope, not
 * inline: a component redefined on every render remounts its subtree, which
 * would drop focus out of the control between keystrokes.
 */
function AttrSelect({ label, id, name, value, onChange, options, note }) {
  return (
    <Field label={label} htmlFor={id} short note={note}>
      <select id={id} name={name} className="admin__control-select" value={value}
        onChange={e => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Field>
  )
}

/** Ids removed by the attribute form's Delete Attribute button (G-01). */
function deletedIds(state) {
  return new Set((state?.deletedProductAttributes || []).map(String))
}

export function getAttribute(state, id) {
  if (deletedIds(state).has(String(id))) return null
  const created = (state?.newProductAttributes || [])
    .find(a => String(a.attribute_id) === String(id) || a.attribute_code === String(id))
  if (created) return created
  const base = S.productAttributes.find(a => String(a.attribute_id) === String(id))
  if (!base) return null
  const patch = state?.productAttributeOverrides?.[String(id)]
  return patch ? { ...base, ...patch } : base
}

export function getAttributes(state) {
  const patches = state?.productAttributeOverrides || {}
  const gone = deletedIds(state)
  const base = S.productAttributes.map(a => {
    const p = patches[String(a.attribute_id)]
    return p ? { ...a, ...p } : a
  })
  return [...base, ...(state?.newProductAttributes || [])]
    .filter(a => !gone.has(String(a.attribute_id)))
}

/** `eav_attribute.attribute_id` is global; allocate above everything seeded. */
export function nextAttributeId(state) {
  let max = 0
  for (const a of S.productAttributes) max = Math.max(max, Number(a.attribute_id))
  for (const a of state?.newProductAttributes || []) max = Math.max(max, Number(a.attribute_id))
  return max + 1
}

/** `eav_attribute_option.option_id` is global too — same allocation rule. */
export function nextOptionId(state) {
  let max = 0
  for (const map of Object.values(S.attributeOptions)) {
    for (const id of Object.keys(map)) max = Math.max(max, Number(id))
  }
  for (const a of S.productAttributes) {
    for (const o of a.options || []) max = Math.max(max, Number(o.option_id))
  }
  for (const a of state?.newProductAttributes || []) {
    for (const o of a.options || []) max = Math.max(max, Number(o.option_id))
  }
  return max + 1
}

export function ProductAttributeGrid() {
  const { state } = useApp()
  const rows = useMemo(
    () => getAttributes(state).filter(a => !GRID_HIDDEN_ATTRIBUTE_CODES.has(a.attribute_code)),
    [state])

  const columns = [
    { id: 'attribute_code', label: 'Attribute Code', filterType: 'text' },
    { id: 'frontend_label', label: 'Default Label', filterType: 'text' },
    {
      id: 'is_required',
      label: 'Required',
      filterType: 'select',
      options: YESNO,
      render: r => (r.is_required ? 'Yes' : 'No'),
      filterValue: r => String(r.is_required ?? 0),
      searchValue: r => (r.is_required ? 'Yes' : 'No'),
    },
    {
      id: 'is_user_defined',
      label: 'System',
      filterType: 'select',
      /* DOM: the source's option *values* are the raw `is_user_defined` column,
       * so "Yes" (a system attribute) is value 0 and "No" is value 1 — the
       * inverse of the mock's old YESNO ordering. `select_option(…, '0')` must
       * select Yes. Verified against `[name="is_user_defined"]` on the source. */
      options: [
        { value: '0', label: 'Yes' },
        { value: '1', label: 'No' },
      ],
      // Magento shows "System = Yes" for attributes that are NOT user defined.
      render: r => (r.is_user_defined ? 'No' : 'Yes'),
      filterValue: r => String(r.is_user_defined ? 1 : 0),
      searchValue: r => (r.is_user_defined ? 'No' : 'Yes'),
    },
    {
      id: 'is_visible_on_front',
      label: 'Visible',
      filterType: 'select',
      // Round 10 — the source's filter control is `[name="is_visible"]`.
      filterName: 'is_visible',
      options: YESNO,
      render: r => (r.is_visible_on_front ? 'Yes' : 'No'),
      filterValue: r => String(r.is_visible_on_front ?? 0),
      searchValue: r => (r.is_visible_on_front ? 'Yes' : 'No'),
    },
    {
      id: 'scope',
      label: 'Scope',
      filterType: 'select',
      /* Round 10 — the source's control is `[name="is_global"]` and its option
       * values are the raw `is_global` codes: 0 Store View, 2 Web Site,
       * 1 Global. */
      filterName: 'is_global',
      options: [
        { value: '0', label: 'Store View' },
        { value: '2', label: 'Web Site' },
        { value: '1', label: 'Global' },
      ],
      render: scopeLabel,
      // The filter compares the source's `is_global` codes, the labels don't.
      filterValue: a => ({ 'Store View': '0', 'Web Site': '2', Global: '1' }[scopeLabel(a)] ?? ''),
      searchValue: scopeLabel,
      sortValue: scopeLabel,
    },
    {
      id: 'is_searchable',
      label: 'Searchable',
      filterType: 'select',
      options: YESNO,
      render: r => (r.is_searchable ? 'Yes' : 'No'),
      filterValue: r => String(r.is_searchable ?? 0),
      searchValue: r => (r.is_searchable ? 'Yes' : 'No'),
    },
    {
      id: 'is_filterable',
      label: 'Use in Layered Navigation',
      filterType: 'select',
      /* DOM: the source filters on `catalog_eav_attribute.is_filterable`, so the
       * option values are 1 / 2 / 0 — not the visible labels. */
      options: [
        { value: '1', label: 'Filterable (with results)' },
        { value: '2', label: 'Filterable (no results)' },
        { value: '0', label: 'No' },
      ],
      render: filterableLabel,
      filterValue: r => String(r.is_filterable ?? 0),
      searchValue: filterableLabel,
      sortValue: filterableLabel,
    },
    {
      id: 'is_comparable',
      label: 'Comparable',
      filterType: 'select',
      options: YESNO,
      render: r => (r.is_comparable ? 'Yes' : 'No'),
      filterValue: r => String(r.is_comparable ?? 0),
      searchValue: r => (r.is_comparable ? 'Yes' : 'No'),
    },
    /* No Action column — the source's legacy grid has exactly 9 `<th>`s and
     * opens a record by clicking anywhere in the row (DIFF-008). */
  ]

  const navigate = useSidNavigate()
  const actions = (
    <button
      type="button"
      id="add"
      data-ui-id="adminhtml-product-attribute-0-add-button"
      className="action-primary"
      title="Add New Attribute"
      onClick={() => navigate('/admin/catalog/product_attribute/new/')}
    >
      Add New Attribute
    </button>
  )

  return (
    <PageShell title="Product Attributes" actions={actions}>
      {/* Round 10. LEGACY on the source; its grid id is `attributeGrid`
        * (`select#attributeGrid_page-limit`), not `product_attribute_grid`. */}
      <LegacyAdminGrid
        legacyToolbarBase={3} gridId="attributeGrid"
        basePath="/admin/catalog/product_attribute/index"
        rows={rows}
        columns={columns}
        rowKey={r => r.attribute_id}
        exportable={false}
        defaultSort={{ field: 'attribute_code', direction: 'asc' }}
        rowHref={r => `/admin/catalog/product_attribute/edit/attribute_id/${r.attribute_id}/`}
      />
    </PageShell>
  )
}

/**
 * BUG-101 — Stores > Attributes > Product > Add New Attribute.
 *
 * Field names, option values/labels, section legends, tab titles and the four
 * page actions are transcribed from the live source at
 * `/admin/catalog/product_attribute/new/`. Saving appends to
 * `state.newProductAttributes`, so the record shows up in the grid AND in /go's
 * `state_diff`.
 */
export function ProductAttributeNew() {
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const [tab, setTab] = useState('properties')
  const [error, setError] = useState(null)
  const [form, setForm] = useState({
    frontend_label: '',
    frontend_input: 'text',
    is_required: '0',
    attribute_code: '',
    is_global: '0',
    default_value_text: '',
    is_unique: '0',
    frontend_class: '',
    is_used_in_grid: '0',
    is_searchable: '0',
    is_visible_in_advanced_search: '0',
    is_comparable: '0',
    is_filterable: '0',
    is_filterable_in_search: '0',
    position: '0',
    is_used_for_promo_rules: '0',
    is_html_allowed_on_front: '1',
    is_visible_on_front: '0',
    used_in_product_listing: '0',
    used_for_sort_by: '0',
    storeLabel: '',
    options: [],
    defaultOption: '',
  })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  /* F-07 — the source renders the Manage Options grid, and all three of its add
   * buttons (`#add_new_option_button`, `#add_new_swatch_visual_option_button`,
   * `#add_new_swatch_text_option_button`), on `/new/` exactly as on `/edit/`,
   * hiding the two that do not apply to the current `frontend_input`. Round 7
   * added them to `/edit/` only, so `page.click('#add_new_option_button')` timed
   * out on the sibling route. New rows use Magento's `option_<n>` row keys. */
  const newNames = optionNames(form.frontend_input)
  const newIsVisualSwatch = form.frontend_input === 'swatch_visual'
  const newIsTextSwatch = form.frontend_input === 'swatch_text'
  const newIsSwatch = newIsVisualSwatch || newIsTextSwatch
  const newMultiDefault = form.frontend_input === 'multiselect'
  const newHasOptions = newIsSwatch
    || form.frontend_input === 'select' || form.frontend_input === 'multiselect'
    || form.options.length > 0

  function addNewOption() {
    setForm(f => ({
      ...f,
      options: [...f.options, { key: `option_${f.options.length}`, label: '', store_label: '', swatch_value: '' }],
    }))
  }
  const patchNewOption = (i, patch) => setForm(f => ({
    ...f, options: f.options.map((x, j) => (j === i ? { ...x, ...patch } : x)),
  }))

  /** Magento derives the code from the label when the field is left blank. */
  function derivedCode() {
    if (form.attribute_code.trim()) return form.attribute_code.trim()
    return form.frontend_label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  }

  function save(andContinue) {
    const label = form.frontend_label.trim()
    if (!label) {
      setError('This is a required field.')
      addMessage('This is a required field.', 'error')
      return
    }
    const code = derivedCode()
    if (getAttributes(state).some(a => a.attribute_code === code)) {
      setError('An attribute with this code already exists.')
      addMessage('An attribute with this code already exists.', 'error')
      return
    }
    const attribute_id = nextAttributeId(state)
    const record = {
      attribute_id,
      attribute_code: code,
      frontend_label: label,
      frontend_input: form.frontend_input,
      backend_type: form.frontend_input === 'select' || form.frontend_input === 'multiselect' ? 'int' : 'varchar',
      is_required: Number(form.is_required),
      is_user_defined: 1,
      default_value: form.default_value_text,
      is_global: Number(form.is_global),
      is_unique: Number(form.is_unique),
      frontend_class: form.frontend_class,
      is_used_in_grid: Number(form.is_used_in_grid),
      is_searchable: Number(form.is_searchable),
      is_visible_in_advanced_search: Number(form.is_visible_in_advanced_search),
      is_comparable: Number(form.is_comparable),
      is_filterable: Number(form.is_filterable),
      is_filterable_in_search: Number(form.is_filterable_in_search),
      position: Number(form.position),
      is_used_for_promo_rules: Number(form.is_used_for_promo_rules),
      is_html_allowed_on_front: Number(form.is_html_allowed_on_front),
      is_visible_on_front: Number(form.is_visible_on_front),
      used_in_product_listing: Number(form.used_in_product_listing),
      used_for_sort_by: Number(form.used_for_sort_by),
      store_labels: form.storeLabel ? { 1: form.storeLabel } : {},
      options: form.options
        .filter(o => String(o.label).trim())
        .map((o, i) => ({
          option_id: nextOptionId(state) + i,
          label: o.label,
          store_label: o.store_label,
          sort_order: i + 1,
        })),
    }
    setState(prev => ({
      ...prev,
      newProductAttributes: [...(prev.newProductAttributes || []), record],
    }))
    addMessage('You saved the product attribute.')
    navigate(andContinue
      ? `/admin/catalog/product_attribute/edit/attribute_id/${attribute_id}/`
      : '/admin/catalog/product_attribute/')
  }

  function reset() {
    setForm(f => Object.fromEntries(Object.keys(f).map(k => [k, k === 'frontend_input' ? 'text' : (k === 'is_html_allowed_on_front' ? '1' : (/^(is_|used_|position)/.test(k) ? '0' : ''))])))
    setError(null)
  }

  /* G-01. The source gives every action button on this page both an `id` and a
   * `data-ui-id`; the mock gave neither, so `page.click('#save')` timed out
   * rather than merely missing. Ids and stems read off the live form. */
  const actions = (
    <>
      <button type="button" id="back" title="Back" data-ui-id="attribute-edit-content-back-button"
        className="action-default scalable back"
        onClick={() => navigate('/admin/catalog/product_attribute/')}>Back</button>
      <button type="button" id="reset" title="Reset" data-ui-id="attribute-edit-content-reset-button"
        className="action-default scalable" onClick={reset}>Reset</button>
      <button type="button" id="save_and_edit_button"
        data-ui-id="attribute-edit-content-save-and-edit-button-button"
        className="action-default scalable" onClick={() => save(true)}>Save and Continue Edit</button>
      <button type="button" id="save" data-ui-id="attribute-edit-content-save-button"
        className="action-primary" onClick={() => save(false)}>Save Attribute</button>
    </>
  )

  const Select = ({ label, name, id, value, onChange, options, note }) => (
    <Field label={label} htmlFor={id} short note={note}>
      <select id={id} name={name} className="admin__control-select" value={value} onChange={e => onChange(e.target.value)}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </Field>
  )
  /* Every Yes/No select on the source's attribute form lists Yes first
   * (`YESNO_OPTS`); the mock's local copy had them reversed, so option order —
   * and therefore the value a plain `selectOption(index=0)` picks — differed. */
  const YN = YESNO_OPTS

  return (
    <PageShell title="New Product Attribute" documentTitle="New Product Attribute" actions={actions}>
      <div className="admin-form-columns">
        <nav className="admin-form-columns__nav admin__page-nav" aria-label="Attribute Information">
          <div className="admin__page-nav-title">ATTRIBUTE INFORMATION</div>
          <ul className="admin__page-nav-items">
            {[['properties', 'Properties'], ['labels', 'Manage Labels'], ['storefront', 'Storefront Properties']].map(([k, l]) => (
              <li key={k} className={`admin__page-nav-item${tab === k ? ' _active' : ''}`}>
                <button type="button" className="admin__page-nav-link" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
              </li>
            ))}
          </ul>
        </nav>

        <form className="admin-form-columns__body" onSubmit={e => { e.preventDefault(); save(false) }}>
          {tab === 'properties' ? (
            <>
              <Fieldset legend="Attribute Properties">
                <Field label="Default Label" required htmlFor="attribute_label" error={error}>
                  <input
                    id="attribute_label" name="frontend_label[0]"
                    data-ui-id="attribute-edit-content-form-fieldset-element-text-frontend-label-0"
                    title="Default label"
                    className="validate-no-html-tags input-text admin__control-text required-entry _required"
                    type="text"
                    value={form.frontend_label} onChange={e => set('frontend_label', e.target.value)}
                  />
                </Field>
                <Select label="Catalog Input Type for Store Owner" name="frontend_input" id="frontend-input"
                  value={form.frontend_input} onChange={v => set('frontend_input', v)} options={INPUT_TYPES} />
                <Select label="Values Required" name="is_required" id="is-required"
                  value={form.is_required} onChange={v => set('is_required', v)} options={YN} />
              </Fieldset>

              {/* F-07 — the source renders this fieldset (and its three add
                  buttons) for EVERY input type and hides it when the type takes
                  no options, so `#add_new_option_button` resolves on `/new/`
                  even before the type is switched. Verified: on the live
                  `/new/` the button exists with `is_visible() === False`. */}
              <div data-index="attribute_options_select_container"
                style={newHasOptions ? undefined : { display: 'none' }}>
                  <fieldset className="admin__fieldset" data-index="attribute_options_select">
                    <legend className="admin__legend">
                      <span>{newIsSwatch ? 'Manage Swatch (Values of Your Attribute)' : 'Manage Options (Values of Your Attribute)'}</span>
                    </legend>
                    <table className="admin__variations-grid">
                      <thead>
                        <tr>
                          <th />
                          <th>Is Default</th>
                          {newIsSwatch ? <th>Swatch</th> : null}
                          <th>Admin</th>
                          <th>Default Store View</th>
                          <th>&nbsp;</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.options.length ? form.options.map((o, i) => (
                          <tr key={o.key}>
                            <td>
                              <input type="hidden" name={`${newNames.opt}[order][${o.key}]`} value={String(i + 1)} readOnly />
                              <input type="hidden" name={`${newNames.opt}[delete][${o.key}]`} value="" readOnly />
                              <span className="admin__variations-grid-handle" aria-hidden="true">⋮⋮</span>
                            </td>
                            <td>
                              <input
                                type={newMultiDefault ? 'checkbox' : 'radio'}
                                name={`${newNames.def}[]`}
                                value={o.key}
                                className="input-radio"
                                checked={String(form.defaultOption).split(',').includes(o.key)}
                                onChange={() => setForm(f => {
                                  if (!newMultiDefault) return { ...f, defaultOption: o.key }
                                  const cur = String(f.defaultOption || '').split(',').filter(Boolean)
                                  return {
                                    ...f,
                                    defaultOption: (cur.includes(o.key)
                                      ? cur.filter(x => x !== o.key) : [...cur, o.key]).join(','),
                                  }
                                })}
                                aria-label={`Default ${o.label}`}
                              />
                            </td>
                            {newIsVisualSwatch ? (
                              <td>
                                <input type="hidden" id={`swatch_visual_value_${o.key}`}
                                  name={`swatchvisual[value][${o.key}]`} value={o.swatch_value || ''} readOnly />
                                <input type="color" className="admin__swatch-preview"
                                  value={o.swatch_value || '#ffffff'} aria-label={`Swatch ${o.label}`}
                                  onChange={e => patchNewOption(i, { swatch_value: e.target.value })} />
                              </td>
                            ) : null}
                            {newIsTextSwatch ? (
                              <td>
                                <input className="admin__control-text admin__control-text--short"
                                  name={`swatchtext[value][${o.key}][0]`} value={o.swatch_value || ''}
                                  aria-label={`Swatch ${o.label}`}
                                  onChange={e => patchNewOption(i, { swatch_value: e.target.value })} />
                                <input type="hidden" name={`swatchtext[value][${o.key}][1]`}
                                  value={o.swatch_value || ''} readOnly />
                              </td>
                            ) : null}
                            <td>
                              <input type="text" className="admin__control-text"
                                name={`${newNames.opt}[value][${o.key}][0]`} value={o.label}
                                aria-label={`Option ${o.key} label`}
                                onChange={e => patchNewOption(i, { label: e.target.value })} />
                            </td>
                            <td>
                              <input type="text" className="admin__control-text"
                                name={`${newNames.opt}[value][${o.key}][1]`} value={o.store_label || ''}
                                aria-label={`Option ${o.key} store label`}
                                onChange={e => patchNewOption(i, { store_label: e.target.value })} />
                            </td>
                            <td>
                              <button type="button" className="action-default" title="Delete"
                                id={newIsSwatch ? undefined : `delete_button_${o.key}`}
                                onClick={() => setForm(f => ({
                                  ...f,
                                  options: f.options.filter((_, j) => j !== i),
                                  defaultOption: String(f.defaultOption || '').split(',')
                                    .filter(x => x && x !== o.key).join(','),
                                }))}>
                                Delete
                              </button>
                            </td>
                          </tr>
                        )) : (
                          <tr><td colSpan={newIsSwatch ? 6 : 5}>We couldn&apos;t find any records.</td></tr>
                        )}
                      </tbody>
                    </table>
                    {[
                      ['add_new_swatch_visual_option_button', 'Add Swatch', newIsVisualSwatch],
                      ['add_new_swatch_text_option_button', 'Add Swatch', newIsTextSwatch],
                      ['add_new_option_button', 'Add Option', !newIsSwatch],
                    ].map(([bid, blabel, visible]) => (
                      <button
                        key={bid}
                        type="button"
                        id={bid}
                        title={blabel}
                        className="action-default scalable add"
                        style={visible ? undefined : { display: 'none' }}
                        onClick={addNewOption}
                      >
                        <span>{blabel}</span>
                      </button>
                    ))}
                  </fieldset>
              </div>

              <Fieldset legend="Advanced Attribute Properties">
                <Field label="Attribute Code" htmlFor="attribute-code"
                  note="This is used internally. Make sure you don't use spaces or more than 30 symbols.">
                  <input
                    id="attribute-code" name="attribute_code" className="admin__control-text" type="text"
                    maxLength={30} value={form.attribute_code} onChange={e => set('attribute_code', e.target.value)}
                  />
                </Field>
                <Select label="Scope" name="is_global" id="is-global" value={form.is_global}
                  onChange={v => set('is_global', v)} note="Declare attribute value saving scope."
                  /* The form's own label is `Website`; only the GRID's Scope
                    * column reads `Web Site` (see `scopeLabel`). */
                  options={[['0', 'Store View'], ['2', 'Website'], ['1', 'Global']]} />
                <Field label="Default Value" htmlFor="default-value-text">
                  <input
                    id="default-value-text" name="default_value_text" className="admin__control-text" type="text"
                    value={form.default_value_text} onChange={e => set('default_value_text', e.target.value)}
                  />
                </Field>
                <Select label="Unique Value" name="is_unique" id="is-unique" value={form.is_unique}
                  onChange={v => set('is_unique', v)} options={YN}
                  note="Not shared with other products." />
                <Select label="Input Validation for Store Owner" name="frontend_class" id="frontend-class"
                  value={form.frontend_class} onChange={v => set('frontend_class', v)}
                  options={[['', 'None'], ['validate-number', 'Decimal Number'], ['validate-digits', 'Integer Number'],
                    ['validate-email', 'Email'], ['validate-url', 'URL'], ['validate-alpha', 'Letters'],
                    ['validate-alphanum', 'Letters (a-z, A-Z) or Numbers (0-9)']]} />
                <Select label="Add to Column Options" name="is_used_in_grid" id="is-used-in-grid"
                  value={form.is_used_in_grid} onChange={v => set('is_used_in_grid', v)} options={YN}
                  note="Select &quot;Yes&quot; to add this attribute to the list of column options in the product grid." />
                <Select label="Use in Filter Options" name="is_filterable_in_grid" id="is-filterable-in-grid"
                  value={form.is_filterable_in_grid || '0'} onChange={v => set('is_filterable_in_grid', v)} options={YN}
                  note="Select &quot;Yes&quot; to add this attribute to the list of filters in the product grid." />
              </Fieldset>
            </>
          ) : null}

          {/* G-02 (same class). The Admin row is the Properties tab's
            * `#attribute_label`; duplicating `frontend_label[0]` here is a
            * Playwright strict-mode violation. */}
          {tab === 'labels' ? (
            <Fieldset legend="Manage Titles (Size, Color, etc.)">
              <Field label="Default Store View">
                <input name="frontend_label[1]" className="input-text validate-no-html-tags " type="text"
                  value={form.storeLabel} onChange={e => set('storeLabel', e.target.value)} />
              </Field>
            </Fieldset>
          ) : null}

          {tab === 'storefront' ? (
            <Fieldset legend="Storefront Properties">
              <Select label="Use in Search" name="is_searchable" id="sf-is-searchable"
                value={form.is_searchable} onChange={v => set('is_searchable', v)} options={YN} />
              <Select label="Visible in Advanced Search" name="is_visible_in_advanced_search" id="sf-adv-search"
                value={form.is_visible_in_advanced_search} onChange={v => set('is_visible_in_advanced_search', v)} options={YN} />
              <Select label="Comparable on Storefront" name="is_comparable" id="sf-comparable"
                value={form.is_comparable} onChange={v => set('is_comparable', v)} options={YN} />
              <Select label="Use in Layered Navigation" name="is_filterable" id="sf-filterable"
                value={form.is_filterable} onChange={v => set('is_filterable', v)}
                options={[['0', 'No'], ['1', 'Filterable (with results)'], ['2', 'Filterable (no results)']]} />
              <Select label="Use in Search Results Layered Navigation" name="is_filterable_in_search" id="sf-filterable-search"
                value={form.is_filterable_in_search} onChange={v => set('is_filterable_in_search', v)} options={YN} />
              <Field label="Position" htmlFor="sf-position" short>
                <input id="sf-position" name="position" className="admin__control-text" type="number"
                  value={form.position} onChange={e => set('position', e.target.value)} />
              </Field>
              <Select label="Use for Promo Rule Conditions" name="is_used_for_promo_rules" id="sf-promo"
                value={form.is_used_for_promo_rules} onChange={v => set('is_used_for_promo_rules', v)} options={YN} />
              <Select label="Allow HTML Tags on Storefront" name="is_html_allowed_on_front" id="sf-html"
                value={form.is_html_allowed_on_front} onChange={v => set('is_html_allowed_on_front', v)} options={YN} />
              <Select label="Visible on Catalog Pages on Storefront" name="is_visible_on_front" id="sf-visible"
                value={form.is_visible_on_front} onChange={v => set('is_visible_on_front', v)} options={YN} />
              <Select label="Used in Product Listing" name="used_in_product_listing" id="sf-listing"
                value={form.used_in_product_listing} onChange={v => set('used_in_product_listing', v)} options={YN} />
              <Select label="Used for Sorting in Product Listing" name="used_for_sort_by" id="sf-sort"
                value={form.used_for_sort_by} onChange={v => set('used_for_sort_by', v)} options={YN} />
            </Fieldset>
          ) : null}
        </form>
      </div>
    </PageShell>
  )
}

export function ProductAttributeEdit() {
  const params = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const attribute = getAttribute(state, params.id)
  const [tab, setTab] = useState('properties')
  const [advancedOpen, setAdvancedOpen] = useState(false)

  /* Hoisted out of the useState initializer so Reset can rebuild the exact
   * same object (G-01 added the source's Reset button to this toolbar). */
  const buildInitialForm = () => ({
    frontend_label: attribute?.frontend_label ?? '',
    // F-03 — the source's edit form shows the swatch flavour, which lives in
    // `swatch_input_type`, not in `eav_attribute.frontend_input`.
    frontend_input: SOURCE_FRONTEND_INPUT[attribute?.attribute_code]
      ?? attribute?.frontend_input ?? 'text',
    is_required: attribute?.is_required ?? 0,
    is_searchable: attribute?.is_searchable ?? 0,
    is_comparable: attribute?.is_comparable ?? 0,
    is_filterable: attribute?.is_filterable ?? 0,
    is_visible_on_front: attribute?.is_visible_on_front ?? 0,
    options: (attribute?.options || []).map(o => ({ ...o })),
    defaultOption: attribute?.default_value ?? null,
    // F-04 — Advanced Attribute Properties / Manage Titles / Storefront.
    update_product_preview_image: String(attribute?.update_product_preview_image ?? 1),
    use_product_image_for_swatch: String(attribute?.use_product_image_for_swatch ?? 0),
    is_global: String(attribute?.is_global ?? 0),
    default_value_text: String(attribute?.default_value ?? ''),
    default_value_yesno: String(attribute?.default_value_yesno ?? 1),
    default_value_date: String(attribute?.default_value_date ?? ''),
    default_value_datetime: String(attribute?.default_value_datetime ?? ''),
    default_value_textarea: String(attribute?.default_value ?? ''),
    is_unique: String(attribute?.is_unique ?? 0),
    frontend_class: attribute?.frontend_class ?? '',
    is_used_in_grid: String(attribute?.is_used_in_grid ?? 1),
    is_visible_in_grid: String(attribute?.is_visible_in_grid ?? 0),
    is_filterable_in_grid: String(attribute?.is_filterable_in_grid ?? 1),
    storeLabel: String(attribute?.store_labels?.[1] ?? ''),
    search_weight: String(attribute?.search_weight ?? 1),
    is_visible_in_advanced_search: String(attribute?.is_visible_in_advanced_search ?? 0),
    is_filterable_in_search: String(attribute?.is_filterable_in_search ?? 0),
    position: String(attribute?.position ?? 0),
    is_used_for_promo_rules: String(attribute?.is_used_for_promo_rules ?? 0),
    is_html_allowed_on_front: String(attribute?.is_html_allowed_on_front ?? 1),
    used_in_product_listing: String(attribute?.used_in_product_listing ?? 0),
    used_for_sort_by: String(attribute?.used_for_sort_by ?? 0),
  })
  const [form, setForm] = useState(buildInitialForm)

  // `/edit/attribute_id/new/` is not a source route, but agents guess it —
  // send them to the real Add-New form rather than a dead end (BUG-101).
  if (!attribute && String(params.id) === 'new') return <ProductAttributeNew />

  if (!attribute) {
    return (
      <PageShell title="Edit Product Attribute">
        <div className="admin__data-grid-empty">
          That product attribute does not exist.{' '}
          <AdminLink to="/admin/catalog/product_attribute/">Back to Product Attributes</AdminLink>
        </div>
      </PageShell>
    )
  }

  function save(keepEditing) {
    setState(prev => ({
      ...prev,
      productAttributeOverrides: {
        ...(prev.productAttributeOverrides || {}),
        [String(attribute.attribute_id)]: {
          frontend_label: form.frontend_label,
          frontend_input: form.frontend_input,
          is_required: Number(form.is_required),
          is_searchable: Number(form.is_searchable),
          is_comparable: Number(form.is_comparable),
          is_filterable: Number(form.is_filterable),
          is_visible_on_front: Number(form.is_visible_on_front),
          options: form.options,
          // HANDLERS-007 — the "Is Default" radio is `default_value` in
          // eav_attribute; without this the choice was silently discarded.
          default_value: form.defaultOption,
          // F-04 — everything the Advanced / Manage Titles / Storefront
          // fieldsets expose is editable, so every one of them writes back.
          is_global: Number(form.is_global),
          is_unique: Number(form.is_unique),
          frontend_class: form.frontend_class,
          is_used_in_grid: Number(form.is_used_in_grid),
          is_visible_in_grid: Number(form.is_visible_in_grid),
          is_filterable_in_grid: Number(form.is_filterable_in_grid),
          search_weight: Number(form.search_weight),
          is_visible_in_advanced_search: Number(form.is_visible_in_advanced_search),
          is_filterable_in_search: Number(form.is_filterable_in_search),
          position: Number(form.position),
          is_used_for_promo_rules: Number(form.is_used_for_promo_rules),
          is_html_allowed_on_front: Number(form.is_html_allowed_on_front),
          used_in_product_listing: Number(form.used_in_product_listing),
          used_for_sort_by: Number(form.used_for_sort_by),
          update_product_preview_image: Number(form.update_product_preview_image),
          use_product_image_for_swatch: Number(form.use_product_image_for_swatch),
          store_labels: form.storeLabel
            ? { ...(attribute.store_labels || {}), 1: form.storeLabel }
            : (attribute.store_labels || {}),
        },
      },
    }))
    addMessage('You saved the product attribute.')
    if (!keepEditing) navigate('/admin/catalog/product_attribute/')
  }

  /* G-01. The source's Delete Attribute drops the attribute; a user-defined one
   * created this session lives in `newProductAttributes`, a seeded one is
   * hidden with a `deleted` override the grid and `getAttribute` already
   * respect via the override map. */
  function removeAttribute() {
    setState(prev => ({
      ...prev,
      newProductAttributes: (prev.newProductAttributes || [])
        .filter(x => String(x.attribute_id) !== String(attribute.attribute_id)),
      deletedProductAttributes: [
        ...(prev.deletedProductAttributes || []).filter(x => String(x) !== String(attribute.attribute_id)),
        String(attribute.attribute_id),
      ],
    }))
    addMessage('You deleted the product attribute.')
    navigate('/admin/catalog/product_attribute/')
  }

  const swatchNames = optionNames(form.frontend_input)
  const isVisualSwatch = form.frontend_input === 'swatch_visual'
  const isTextSwatch = form.frontend_input === 'swatch_text'
  const isSwatch = isVisualSwatch || isTextSwatch
  const swatchHex = VISUAL_SWATCH_VALUES[attribute.attribute_code] || {}

  /* F-03 — Magento's option grid renders the "Is Default" control as a
   * `checkbox` for a `multiselect` attribute (several values may be default)
   * and a `radio` for every other input type. The mock forced radio, so
   * `features_bags` (141) enforced single-select where the source allows
   * multiple. Verified: source 141 = 11 `input[type=checkbox][name="default[]"]`,
   * source 93 = 12 `input[type=radio][name="defaultvisual[]"]`. */
  const multiDefault = form.frontend_input === 'multiselect'
  const defaultIds = form.defaultOption == null || form.defaultOption === ''
    ? []
    : String(form.defaultOption).split(',').filter(Boolean)
  const isDefaultOption = id => defaultIds.includes(String(id))
  const toggleDefault = (id) => setForm(f => {
    if (!multiDefault) return { ...f, defaultOption: String(id) }
    const cur = f.defaultOption == null || f.defaultOption === ''
      ? [] : String(f.defaultOption).split(',').filter(Boolean)
    const next = cur.includes(String(id))
      ? cur.filter(x => x !== String(id))
      : [...cur, String(id)]
    return { ...f, defaultOption: next.join(',') }
  })

  const hasOptions = isSwatch
    || form.frontend_input === 'select' || form.frontend_input === 'multiselect'
    || form.options.length > 0

  /**
   * Option ids are global in `eav_attribute_option`, so allocate above the
   * highest id in the whole seed rather than per attribute — a new Size value
   * must not collide with an existing Color value.
   */
  function addOption() {
    let max = 0
    for (const map of Object.values(S.attributeOptions)) {
      for (const id of Object.keys(map)) max = Math.max(max, Number(id))
    }
    for (const a of S.productAttributes) {
      for (const o of a.options || []) max = Math.max(max, Number(o.option_id))
    }
    for (const o of form.options) max = Math.max(max, Number(o.option_id))
    const sort = form.options.reduce((n, o) => Math.max(n, Number(o.sort_order ?? 0)), 0) + 1
    setForm(f => ({ ...f, options: [...f.options, { option_id: max + 1, label: '', sort_order: sort }] }))
  }

  const patchOption = (i, patch) => setForm(f => ({
    ...f, options: f.options.map((x, j) => (j === i ? { ...x, ...patch } : x)),
  }))

  /* G-01. All five of these carried neither `id` nor `data-ui-id`, so
   * `page.click('#save')` raised a timeout on this page; Reset, Delete
   * Attribute and Save and Continue Edit were missing outright, and the mock's
   * Delete read `Delete` where the source reads `Delete Attribute`. Ids, titles
   * and `data-ui-id` stems are the live form's. */
  const actions = (
    <>
      <button type="button" id="back" title="Back" data-ui-id="attribute-edit-content-back-button"
        className="action-default scalable back"
        onClick={() => navigate('/admin/catalog/product_attribute/')}>
        Back
      </button>
      <button type="button" id="reset" title="Reset" data-ui-id="attribute-edit-content-reset-button"
        className="action-default scalable" onClick={() => setForm(buildInitialForm())}>Reset</button>
      <button type="button" id="delete" data-ui-id="attribute-edit-content-delete-button"
        className="action-default scalable delete" onClick={removeAttribute}>Delete Attribute</button>
      <button type="button" id="save_and_edit_button"
        data-ui-id="attribute-edit-content-save-and-edit-button-button"
        className="action-default scalable" onClick={() => save(true)}>Save and Continue Edit</button>
      <button type="button" id="save" data-ui-id="attribute-edit-content-save-button"
        className="action-primary" onClick={() => save(false)}>Save Attribute</button>
    </>
  )

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <PageShell title={attribute.frontend_label || attribute.attribute_code} documentTitle="Edit Product Attribute" actions={actions}>
      <form onSubmit={e => { e.preventDefault(); save() }}>
        {/* F-04 — the source keeps `attribute_id` and the six option-count /
          * uniqueness validation carriers on the page as hidden inputs. */}
        <input type="hidden" id="attribute_id" name="attribute_id" value={String(attribute.attribute_id)} readOnly />
        <input type="hidden" name="visual_swatch_validation" value="" readOnly />
        <input type="hidden" name="visual_swatch_validation_unique" value="" readOnly />
        <input type="hidden" id="swatch-visual-option-count-check" value={isVisualSwatch ? '1' : ''} readOnly />
        <input type="hidden" name="text_swatch_validation" value="" readOnly />
        <input type="hidden" name="text_swatch_validation_unique" value="" readOnly />
        <input type="hidden" id="swatch-text-option-count-check" value={isTextSwatch ? '1' : ''} readOnly />
        <input type="hidden" name="dropdown_attribute_validation" value="" readOnly />
        <input type="hidden" name="dropdown_attribute_validation_unique" value="" readOnly />
        <input type="hidden" id="option-count-check" value={hasOptions && !isSwatch ? '1' : ''} readOnly />

        <div className="admin-form-columns">
          {/* The source's three-item Attribute Information rail. Every panel
            * stays MOUNTED and is hidden with CSS — the source's own tabs work
            * the same way, so `[name="search_weight"]` resolves on cold load
            * (F-04) exactly as it does on the source. */}
          <nav className="admin-form-columns__nav admin__page-nav" aria-label="Attribute Information">
            <div className="admin__page-nav-title">ATTRIBUTE INFORMATION</div>
            <ul className="admin__page-nav-items">
              {[['properties', 'Properties'], ['labels', 'Manage Labels'], ['storefront', 'Storefront Properties']].map(([k, l]) => (
                <li key={k} className={`admin__page-nav-item${tab === k ? ' _active' : ''}`}>
                  <button type="button" className="admin__page-nav-link" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="admin-form-columns__body">
            <div className="admin-form-panel" style={{ display: tab === 'properties' ? undefined : 'none' }}>
              <Fieldset legend="Attribute Properties">
                <Field label="Default Label" required htmlFor="attribute_label">
                  <input
                    id="attribute_label"
                    name="frontend_label[0]"
                    className="admin__control-text"
                    type="text"
                    value={form.frontend_label}
                    onChange={e => setForm(f => ({ ...f, frontend_label: e.target.value }))}
                  />
                </Field>
                {/* F-03 — the source restricts `frontend_input` to the group the
                  * attribute already belongs to (Dropdown/Visual Swatch/Text
                  * Swatch here); the mock used to offer 12 raw codes, 9 of which
                  * the source never renders for this attribute. */}
                <AttrSelect label="Catalog Input Type for Store Owner" id="frontend_input" name="frontend_input"
                  value={form.frontend_input} onChange={v => setField('frontend_input', v)}
                  options={frontendInputOptions(form.frontend_input)} />
                <AttrSelect label="Values Required" id="is_required" name="is_required"
                  value={String(form.is_required)} onChange={v => setField('is_required', v)} options={YESNO_OPTS} />
                {isSwatch ? (
                  <>
                    <AttrSelect label="Update Product Preview Image" id="update_product_preview_image" name="update_product_preview_image"
                      value={form.update_product_preview_image} onChange={v => setField('update_product_preview_image', v)} options={YESNO_OPTS} />
                    <AttrSelect label="Use Product Image for Swatch if Possible" id="use_product_image_for_swatch" name="use_product_image_for_swatch"
                      value={form.use_product_image_for_swatch} onChange={v => setField('use_product_image_for_swatch', v)} options={YESNO_OPTS} />
                  </>
                ) : null}
              </Fieldset>

              {/* HANDLERS-006 / F-04 — swatch attributes use the
                * `optionvisual[…]` / `optiontext[…]` name family and a
                * "Manage Swatch" legend; plain dropdowns use `option[…]`. */}
              {/* F-07 (same class as the `/new/` fieldset above) — rendered for
                  every input type, hidden when the type takes no options. */}
              <div data-index="attribute_options_select_container"
                style={hasOptions ? undefined : { display: 'none' }}>
                  <fieldset className="admin__fieldset" data-index="attribute_options_select">
                    <legend className="admin__legend">
                      <span>{isSwatch ? 'Manage Swatch (Values of Your Attribute)' : 'Manage Options (Values of Your Attribute)'}</span>
                    </legend>
                    <table className="admin__variations-grid">
                      <thead>
                        <tr>
                          <th />
                          <th>Is Default</th>
                          {isSwatch ? <th>Swatch</th> : null}
                          <th>Admin</th>
                          <th>Default Store View</th>
                          <th>&nbsp;</th>
                        </tr>
                      </thead>
                      <tbody>
                        {form.options.length ? form.options.map((o, i) => {
                          const id = o.option_id
                          const swatchValue = o.swatch_value ?? (isVisualSwatch ? (swatchHex[id] || '#ffffff') : (o.label ?? ''))
                          return (
                            <tr key={id}>
                              <td>
                                <input type="hidden" name={`${swatchNames.opt}[order][${id}]`} value={String(o.sort_order ?? 0)} readOnly />
                                <input type="hidden" name={`${swatchNames.opt}[delete][${id}]`} value="" readOnly />
                                <span className="admin__variations-grid-handle" aria-hidden="true">⋮⋮</span>
                              </td>
                              <td>
                                <input
                                  type={multiDefault ? 'checkbox' : 'radio'}
                                  name={`${swatchNames.def}[]`}
                                  value={String(id)}
                                  /* The source uses `class="input-radio"` on
                                   * BOTH the radio and the checkbox variant. */
                                  className="input-radio"
                                  checked={isDefaultOption(id)}
                                  onChange={() => toggleDefault(id)}
                                  aria-label={`Default ${o.label}`}
                                />
                              </td>
                              {isVisualSwatch ? (
                                <td>
                                  <input
                                    type="hidden"
                                    id={`swatch_visual_value_${id}`}
                                    name={`swatchvisual[value][${id}]`}
                                    value={swatchValue}
                                    readOnly
                                  />
                                  <input
                                    type="color"
                                    className="admin__swatch-preview"
                                    value={swatchValue}
                                    aria-label={`Swatch ${o.label}`}
                                    onChange={e => patchOption(i, { swatch_value: e.target.value })}
                                  />
                                </td>
                              ) : null}
                              {isTextSwatch ? (
                                <td>
                                  <input
                                    className="admin__control-text admin__control-text--short"
                                    name={`swatchtext[value][${id}][0]`}
                                    value={swatchValue}
                                    aria-label={`Swatch ${o.label}`}
                                    onChange={e => patchOption(i, { swatch_value: e.target.value })}
                                  />
                                  <input
                                    type="hidden"
                                    name={`swatchtext[value][${id}][1]`}
                                    value={swatchValue}
                                    readOnly
                                  />
                                </td>
                              ) : null}
                              <td>
                                <input
                                  /* G-06a — the source carries type="text" here;
                                   * with no `type` at all,
                                   * `input[type="text"][name="optionvisual…"]`
                                   * matched nothing. */
                                  type="text"
                                  className="admin__control-text"
                                  name={`${swatchNames.opt}[value][${id}][0]`}
                                  value={o.label}
                                  aria-label={`Option ${id} label`}
                                  onChange={e => patchOption(i, { label: e.target.value })}
                                />
                              </td>
                              <td>
                                <input
                                  /* G-06a — the source carries type="text" here;
                                   * with no `type` at all,
                                   * `input[type="text"][name="optionvisual…"]`
                                   * matched nothing. */
                                  type="text"
                                  className="admin__control-text"
                                  name={`${swatchNames.opt}[value][${id}][1]`}
                                  value={o.store_label ?? ''}
                                  aria-label={`Option ${id} store label`}
                                  onChange={e => patchOption(i, { store_label: e.target.value })}
                                />
                              </td>
                              <td>
                                <button
                                  type="button"
                                  /* F-07 — the source ids each option row's
                                   * Delete as `delete_button_<option_id>`
                                   * (verified on attribute 141: 69…79). Swatch
                                   * attributes use a different template whose
                                   * row Delete carries no id — 93 emits none, so
                                   * do not fabricate one there. */
                                  id={isSwatch ? undefined : `delete_button_${id}`}
                                  title="Delete"
                                  className="action-default"
                                  onClick={() => setForm(f => ({
                                    ...f,
                                    options: f.options.filter((_, j) => j !== i),
                                    defaultOption: (f.defaultOption == null ? '' : String(f.defaultOption))
                                      .split(',').filter(x => x && x !== String(id)).join(',') || null,
                                  }))}
                                >
                                  Delete
                                </button>
                              </td>
                            </tr>
                          )
                        }) : (
                          <tr><td colSpan={isSwatch ? 6 : 5}>We couldn&apos;t find any records.</td></tr>
                        )}
                      </tbody>
                    </table>
                    {/* G-01. The source renders ALL THREE add buttons and hides
                      * the two that do not apply to the current
                      * `frontend_input`, so `#add_new_swatch_visual_option_button`
                      * and `#add_new_swatch_text_option_button` resolve on every
                      * attribute. The mock rendered one button, reusing
                      * `#add_new_option_button` for the *swatch* label — so the
                      * two swatch ids matched nothing and `#add_new_option_button`
                      * carried the wrong text. Titles and classes are the
                      * source's. */}
                    {[
                      ['add_new_swatch_visual_option_button', 'Add Swatch', isVisualSwatch, false],
                      ['add_new_swatch_text_option_button', 'Add Swatch', isTextSwatch, false],
                      ['add_new_option_button', 'Add Option', !isSwatch, true],
                    ].map(([bid, label, visible, addRow]) => (
                      <button
                        key={bid}
                        type="button"
                        id={bid}
                        title={label}
                        className="action- scalable add"
                        data-action={addRow ? 'add_new_row' : undefined}
                        style={visible ? undefined : { display: 'none' }}
                        onClick={addOption}
                      >
                        <span>{label}</span>
                      </button>
                    ))}
                    {/* the source's "Import Options" file control */}
                    <input type="file" name="datafile" className="admin__control-file" aria-label="Import Options" />
                  </fieldset>
                </div>
              ) : null}

              {/* Collapsed on cold load, exactly as the source's
                * `#advanced_fieldset-wrapper` is — present in the DOM, hidden. */}
              <div className={`fieldset-wrapper admin__collapsible-block-wrapper${advancedOpen ? ' opened' : ''}`} id="advanced_fieldset-wrapper">
                <div className="fieldset-wrapper-title">
                  <strong className="admin__collapsible-title" role="button" tabIndex={0}
                    aria-expanded={advancedOpen}
                    onClick={() => setAdvancedOpen(o => !o)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setAdvancedOpen(o => !o) } }}>
                    <span>Advanced Attribute Properties</span>
                  </strong>
                </div>
                <fieldset className="admin__fieldset" id="advanced_fieldset" style={{ display: advancedOpen ? undefined : 'none' }}>
                  <Field label="Attribute Code" htmlFor="attribute_code"
                    note="This is used internally. Make sure you don't use spaces or more than 30 symbols.">
                    <input
                      id="attribute_code"
                      name="attribute_code"
                      className="admin__control-text"
                      type="text"
                      value={attribute.attribute_code}
                      readOnly
                    />
                  </Field>
                  <AttrSelect label="Scope" id="is_global" name="is_global" value={form.is_global}
                    onChange={v => setField('is_global', v)} note="Declare attribute value saving scope."
                    options={[['0', 'Store View'], ['2', 'Website'], ['1', 'Global']]} />
                  <Field label="Default Value" htmlFor="default_value_text" short>
                    <input id="default_value_text" name="default_value_text" className="admin__control-text" type="text"
                      value={form.default_value_text} onChange={e => setField('default_value_text', e.target.value)} />
                  </Field>
                  <AttrSelect label="Default Value" id="default_value_yesno" name="default_value_yesno"
                    value={form.default_value_yesno} onChange={v => setField('default_value_yesno', v)} options={YESNO_OPTS} />
                  <Field label="Default Value" htmlFor="default_value_date" short>
                    <input id="default_value_date" name="default_value_date" className="admin__control-text" type="text"
                      value={form.default_value_date} onChange={e => setField('default_value_date', e.target.value)} />
                  </Field>
                  <Field label="Default Value" htmlFor="default_value_datetime" short>
                    <input id="default_value_datetime" name="default_value_datetime" className="admin__control-text" type="text"
                      value={form.default_value_datetime} onChange={e => setField('default_value_datetime', e.target.value)} />
                  </Field>
                  <Field label="Default Value" htmlFor="default_value_textarea">
                    <textarea id="default_value_textarea" name="default_value_textarea" className="admin__control-textarea" rows={5}
                      value={form.default_value_textarea} onChange={e => setField('default_value_textarea', e.target.value)} />
                  </Field>
                  <AttrSelect label="Unique Value" id="is_unique" name="is_unique" value={form.is_unique}
                    onChange={v => setField('is_unique', v)} options={YESNO_OPTS}
                    note="Not shared with other products." />
                  <AttrSelect label="Input Validation for Store Owner" id="frontend_class" name="frontend_class"
                    value={form.frontend_class} onChange={v => setField('frontend_class', v)}
                    options={[['', 'None'], ['validate-number', 'Decimal Number'], ['validate-digits', 'Integer Number'],
                      ['validate-email', 'Email'], ['validate-url', 'URL'], ['validate-alpha', 'Letters'],
                      ['validate-alphanum', 'Letters (a-z, A-Z) or Numbers (0-9)']]} />
                  <AttrSelect label="Add to Column Options" id="is_used_in_grid" name="is_used_in_grid"
                    value={form.is_used_in_grid} onChange={v => setField('is_used_in_grid', v)} options={YESNO_OPTS} />
                  <input type="hidden" id="is_visible_in_grid" name="is_visible_in_grid" value={form.is_visible_in_grid} readOnly />
                  <AttrSelect label="Use in Filter Options" id="is_filterable_in_grid" name="is_filterable_in_grid"
                    value={form.is_filterable_in_grid} onChange={v => setField('is_filterable_in_grid', v)} options={YESNO_OPTS} />
                </fieldset>
              </div>
            </div>

            <div className="admin-form-panel" style={{ display: tab === 'labels' ? undefined : 'none' }}>
              <div className="fieldset-wrapper admin__collapsible-block-wrapper opened" id="manage-titles-wrapper">
                <div className="fieldset-wrapper-title">
                  <strong className="admin__collapsible-title"><span>Manage Titles (Size, Color, etc.)</span></strong>
                </div>
                {/* G-02. The source's Manage Titles tab starts at
                  * `frontend_label[1]` — the Admin row IS the Properties tab's
                  * `#attribute_label`, rendered once. The mock emitted a second
                  * `[name="frontend_label[0]"]` here, so every `locator()` /
                  * `get_by_*` form of that selector raised a strict-mode
                  * violation and failed the whole run, not just one assertion.
                  * The source's store-view input also carries no `id`, so the
                  * mock-invented `#frontend_label_0/1` are gone with it. */}
                <Fieldset>
                  <Field label="Default Store View">
                    <input name="frontend_label[1]" className="input-text validate-no-html-tags " type="text"
                      value={form.storeLabel} onChange={e => setField('storeLabel', e.target.value)} />
                  </Field>
                </Fieldset>
              </div>
            </div>

            <div className="admin-form-panel" style={{ display: tab === 'storefront' ? undefined : 'none' }}>
              <fieldset className="admin__fieldset" id="front_fieldset">
                <legend className="admin__legend"><span>Storefront Properties</span></legend>
                <AttrSelect label="Use in Search" id="is_searchable" name="is_searchable"
                  value={String(form.is_searchable)} onChange={v => setField('is_searchable', v)} options={YESNO_OPTS} />
                <AttrSelect label="Search Weight" id="search_weight" name="search_weight"
                  value={form.search_weight} onChange={v => setField('search_weight', v)}
                  options={['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'].map(n => [n, n])} />
                <AttrSelect label="Visible in Advanced Search" id="is_visible_in_advanced_search" name="is_visible_in_advanced_search"
                  value={form.is_visible_in_advanced_search} onChange={v => setField('is_visible_in_advanced_search', v)} options={YESNO_OPTS} />
                <AttrSelect label="Comparable on Storefront" id="is_comparable" name="is_comparable"
                  value={String(form.is_comparable)} onChange={v => setField('is_comparable', v)} options={YESNO_OPTS} />
                <AttrSelect label="Use in Layered Navigation" id="is_filterable" name="is_filterable"
                  value={String(form.is_filterable)} onChange={v => setField('is_filterable', v)}
                  options={[['0', 'No'], ['1', 'Filterable (with results)'], ['2', 'Filterable (no results)']]} />
                <AttrSelect label="Use in Search Results Layered Navigation" id="is_filterable_in_search" name="is_filterable_in_search"
                  value={form.is_filterable_in_search} onChange={v => setField('is_filterable_in_search', v)} options={YESNO_OPTS} />
                <Field label="Position" htmlFor="position" short>
                  <input id="position" name="position" className="admin__control-text" type="text"
                    value={form.position} onChange={e => setField('position', e.target.value)} />
                </Field>
                <AttrSelect label="Use for Promo Rule Conditions" id="is_used_for_promo_rules" name="is_used_for_promo_rules"
                  value={form.is_used_for_promo_rules} onChange={v => setField('is_used_for_promo_rules', v)} options={YESNO_OPTS} />
                <AttrSelect label="Allow HTML Tags on Storefront" id="is_html_allowed_on_front" name="is_html_allowed_on_front"
                  value={form.is_html_allowed_on_front} onChange={v => setField('is_html_allowed_on_front', v)} options={YESNO_OPTS} />
                <AttrSelect label="Visible on Catalog Pages on Storefront" id="is_visible_on_front" name="is_visible_on_front"
                  value={String(form.is_visible_on_front)} onChange={v => setField('is_visible_on_front', v)} options={YESNO_OPTS} />
                <AttrSelect label="Used in Product Listing" id="used_in_product_listing" name="used_in_product_listing"
                  value={form.used_in_product_listing} onChange={v => setField('used_in_product_listing', v)} options={YESNO_OPTS} />
                <AttrSelect label="Used for Sorting in Product Listing" id="used_for_sort_by" name="used_for_sort_by"
                  value={form.used_for_sort_by} onChange={v => setField('used_for_sort_by', v)} options={YESNO_OPTS} />
              </fieldset>
            </div>
          </div>
        </div>
      </form>
    </PageShell>
  )
}
