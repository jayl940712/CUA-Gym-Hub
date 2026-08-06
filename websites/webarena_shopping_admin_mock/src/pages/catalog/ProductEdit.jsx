import React, { useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import { Field, Fieldset, Toggle, CollapsibleSection, SplitButton, IndexWrap } from '../../components/catalog/FormControls.jsx'
import { COUNTRY_OPTIONS } from '../../components/catalog/countries.js'
import { orderAttributeOptions } from '../../components/catalog/attributeSwatches.js'
import { useApp } from '../../context/AppContext.jsx'
import {
  getProduct, getProducts, getProductDescription, getCategories, attributeSetLabel,
  nextProductId, getStockItem,
} from '../../utils/selectors.js'
import { staticData as S } from '../../utils/dataManager.js'
import { getAttributes } from './ProductAttributes.jsx'
import { useSidNavigate } from '../../utils/navigation.js'
import { formatPrice, formatCurrency } from '../../utils/formatters.js'
import { withGridParams } from '../../utils/gridUtils.js'

/* ROUTES rows 40, 41, 43 — product edit / configurable variant / new product.
 *
 * Input `name=` attributes are the real Magento ones (`product[name]`,
 * `product[quantity_and_stock_status][qty]`, …) because tasks locate fields by
 * them. Saving goes through patchProduct/addProduct so the change lands in
 * /go's state_diff.
 */

const VISIBILITY_OPTIONS = [
  { value: 1, label: 'Not Visible Individually' },
  { value: 2, label: 'Catalog' },
  { value: 3, label: 'Search' },
  { value: 4, label: 'Catalog, Search' },
]

const TAX_CLASS_OPTIONS = [
  { value: 0, label: 'None' },
  { value: 2, label: 'Taxable Goods' },
]

/**
 * The image roles Magento's Manage Gallery exposes per image, in the order and
 * with the labels the source's `roles-labels` template lists them
 * (`assets/html/catalog-product-edit-126.html`). `swatch_image` is not among
 * them on this deployment, so it is not offered here either.
 */
const IMAGE_ROLES = [
  { code: 'image', label: 'Base' },
  { code: 'small_image', label: 'Small' },
  { code: 'thumbnail', label: 'Thumbnail' },
]

/** Attributes the form renders as first-class fields — never twice. */
const EXPLICIT_CODES = new Set([
  'name', 'sku', 'price', 'status', 'weight', 'visibility', 'tax_class_id',
  'quantity_and_stock_status', 'category_ids', 'country_of_manufacture', 'url_key',
  'news_from_date', 'news_to_date', 'special_price', 'special_from_date', 'special_to_date',
  'description', 'short_description', 'meta_title', 'meta_keyword', 'meta_description',
  'image', 'small_image', 'thumbnail', 'swatch_image', 'media_gallery', 'gallery',
  'gift_message_available', 'custom_design', 'custom_design_from', 'custom_design_to',
  'custom_layout', 'custom_layout_update', 'page_layout', 'options_container',
  'links_purchased_separately', 'samples_title', 'links_title', 'links_exist',
  'msrp', 'msrp_display_actual_price_type', 'price_type', 'price_view', 'sku_type',
  'weight_type', 'shipment_type', 'tier_price', 'cost', 'manufacturer',
])

/** Attribute ids belonging to an attribute set, in group order. */
function setAttributeIds(attributeSetId) {
  const set = S.attributeSetsFull.find(s => String(s.attribute_set_id) === String(attributeSetId))
  if (!set) return []
  const ids = []
  for (const g of set.groups || []) for (const id of g.attribute_ids || []) ids.push(id)
  return ids
}

/** The set's user-defined select/multiselect attributes, with their options. */
function customAttributes(attributeSetId, allAttributes = S.productAttributes) {
  const ids = new Set(setAttributeIds(attributeSetId))
  return allAttributes
    .filter(a => ids.has(a.attribute_id))
    .filter(a => !EXPLICIT_CODES.has(a.attribute_code))
    .filter(a => ['select', 'multiselect', 'boolean'].includes(a.frontend_input))
    .filter(a => a.is_user_defined === 1)
}

/** Magento's url_key generator: lowercase, non-alphanumerics collapsed to `-`. */
function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export default function ProductEdit({ isNew = false }) {
  const params = useParams()
  const {
    state, patchProduct, setProductDescription, addProduct, deleteProducts, addMessage,
  } = useApp()
  const navigate = useSidNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [storeMenuOpen, setStoreMenuOpen] = useState(false)

  const existing = isNew ? null : getProduct(state, params.id)
  const allProducts = useMemo(() => getProducts(state), [state])
  /* Attribute options can grow during a session (the Configurations wizard
     creates new Size/Color values), so always read them through the overlay. */
  const allAttributes = useMemo(() => getAttributes(state), [state?.productAttributeOverrides])
  const categories = useMemo(() => getCategories(state), [state])
  const categoryById = useMemo(
    () => new Map(categories.map(c => [c.entity_id, c])), [categories])

  const newSetId = Number(params.setId ?? 4)
  const newType = params.type || 'simple'

  /* HANDLERS-031. `getStockItem()` only knows the frozen
   * `cataloginventory_stock_item` corpus, so Advanced Inventory's three fields
   * (Out-of-Stock Threshold, Maximum Qty Allowed in Cart, Backorders) were
   * written to `productOverrides[id].stock_item` by `buildPatch` and then never
   * read back — reopening the product showed the seeded values again. Overlay
   * the saved patch here, the way `getProduct` already does for the row itself. */
  function savedStockItem(productId) {
    if (productId == null) return null
    const base = getStockItem(productId)
    const patch = state?.productOverrides?.[String(productId)]?.stock_item
    if (!base && !patch) return null
    return { ...(base || {}), ...(patch || {}) }
  }

  function buildInitialForm() {
    const p = existing
    // Advanced Inventory reads cataloginventory_stock_item, which lives in the
    // static corpus rather than on the product row.
    const stock = p ? savedStockItem(p.entity_id) : null
    // A configurable parent owns neither price nor stock — its variants do — so
    // the source renders both inputs empty and disabled.
    const configurable = (p ? p.type_id : newType) === 'configurable'
    return {
      status: p ? Number(p.status) === 1 : true,
      attribute_set_id: p ? Number(p.attribute_set_id) : newSetId,
      name: p?.name ?? '',
      sku: p?.sku ?? '',
      price: configurable || p?.price == null ? '' : formatPrice(p.price),
      tax_class_id: p ? Number(p.tax_class_id ?? 0) : 2,
      qty: configurable || p?.qty == null ? '' : String(Number(p.qty)),
      is_in_stock: p ? Number(p.is_in_stock) === 1 : true,
      weight: p?.weight == null ? '' : String(Number(p.weight)),
      // Magento's `product_has_weight` defaults to 1 for everything except the
      // weightless product types — a null weight does not mean "no weight".
      has_weight: !['virtual', 'downloadable'].includes(p ? p.type_id : newType),
      categories: p?.category_ids ? [...p.category_ids] : [],
      visibility: p ? Number(p.visibility) : 4,
      news_from_date: p?.news_from_date ?? '',
      news_to_date: p?.news_to_date ?? '',
      country_of_manufacture: p?.country_of_manufacture ?? '',
      url_key: p?.url_key ?? '',
      websites: p?.websites?.length ? [...p.websites] : [1],
      description: isNew ? '' : getProductDescription(state, params.id),
      /* HANDLERS-008 — every field below is bound to an input further down the
       * form, so it has to be seeded from the record and written back by
       * buildPatch(); otherwise an existing value renders blank and an edit is
       * silently dropped on Save. */
      special_price: p?.special_price == null ? '' : formatPrice(p.special_price),
      cost: p?.cost == null ? '' : formatPrice(p.cost),
      min_qty: String(Number(stock?.min_qty ?? 0)),
      max_sale_qty: String(Number(stock?.max_sale_qty ?? 10000)),
      backorders: String(Number(stock?.backorders ?? 0)),
      meta_title: p?.meta_title ?? '',
      meta_keyword: p?.meta_keyword ?? '',
      meta_description: p?.meta_description ?? '',
      related: p?.related ? [...p.related] : [],
      upsell: p?.upsell ? [...p.upsell] : [],
      crosssell: p?.crosssell ? [...p.crosssell] : [],
      customOptions: p?.custom_options ? p.custom_options.map(o => ({ ...o })) : [],
      page_layout: p?.page_layout ?? '',
      options_container: p?.options_container ?? 'container2',
      custom_design_from: p?.custom_design_from ?? '',
      custom_design_to: p?.custom_design_to ?? '',
      custom_design: p?.custom_design ?? '',
      gift_message_available: String(p?.gift_message_available ?? ''),
      links_purchased_separately: Number(p?.links_purchased_separately ?? 0) === 1,
      /* Manage Gallery. The source's Images And Videos section is a real
       * editor — label, sort order, "Hide from Product Page", the four image
       * roles and Remove — not a file listing. The role columns are
       * `catalog_product_entity_varchar` rows on the product itself, which is
       * why they live beside the gallery rather than inside it. */
      media_gallery: (p?.media_gallery || []).map(m => ({ ...m })),
      image: p?.image ?? '',
      small_image: p?.small_image ?? '',
      thumbnail: p?.thumbnail ?? '',
      /* BUG-108 — a `boolean` attribute (Sale, New, Eco Collection, …) is a
         switcher on the source, never a select, so it is always 0 or 1 and
         never the "-- Please Select --" empty string. */
      custom: Object.fromEntries(
        customAttributes(p ? p.attribute_set_id : newSetId, getAttributes(state))
          .map(a => [
            a.attribute_code,
            a.frontend_input === 'boolean'
              ? Number(p?.[a.attribute_code] ?? 0)
              : (p?.[a.attribute_code] ?? ''),
          ])),
    }
  }

  const [form, setForm] = useState(buildInitialForm)
  const [errors, setErrors] = useState({})

  /* ---- Configurations wizard (HANDLERS-005) ---------------------------- */
  const [wizard, setWizard] = useState(null)   // { selected: {code: [optionId]}, draft: {code: string} }
  const [manualQuery, setManualQuery] = useState(null)  // null = picker closed

  /* One <Route> element serves every product, so react-router reuses this
     component when the id changes — clicking a variant's Edit link inside the
     Configurations table left the previous product's values in every field.
     Re-seed the form whenever the route's product changes. */
  const formKey = isNew ? `new:${newSetId}:${newType}` : String(params.id)
  const [formFor, setFormFor] = useState(formKey)
  if (formFor !== formKey) {
    setFormFor(formKey)
    setForm(buildInitialForm())
    setErrors({})
    setWizard(null)
    setManualQuery(null)
  }

  if (!isNew && !existing) {
    return (
      <PageShell title="Product">
        <div className="admin__data-grid-empty">
          This product no longer exists.{' '}
          <AdminLink to="/admin/catalog/product/">Back to Products</AdminLink>
        </div>
      </PageShell>
    )
  }

  const type_id = existing ? existing.type_id : newType
  const isConfigurable = type_id === 'configurable'
  const attrs = customAttributes(form.attribute_set_id, allAttributes)

  function set(key, value) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function setCustom(code, value) {
    setForm(f => ({ ...f, custom: { ...f.custom, [code]: value } }))
  }

  /* ---- Manage Gallery ---------------------------------------------------
   * Edits are held on the form and written by buildPatch() on Save, like every
   * other field on this screen, so a gallery change reaches productOverrides
   * and shows in /go's state_diff. */

  function setGalleryImage(index, patch) {
    setForm(f => ({
      ...f,
      media_gallery: f.media_gallery.map((m, i) => (i === index ? { ...m, ...patch } : m)),
    }))
  }

  /** Removing an image also clears any role it held, as the source does. */
  function removeGalleryImage(index) {
    setForm(f => {
      const gone = f.media_gallery[index]
      const next = { ...f, media_gallery: f.media_gallery.filter((_, i) => i !== index) }
      for (const role of IMAGE_ROLES) if (next[role.code] === gone?.file) next[role.code] = ''
      return next
    })
  }

  /**
   * Magento files an upload under `/<first letter>/<second letter>/<name>`. The
   * mock has no image processing, so the row is the real file name in the real
   * path shape; a first image takes all four roles, exactly as the source does.
   */
  function addGalleryImage(e) {
    const file = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!file) return
    const name = file.name.replace(/[^A-Za-z0-9._-]/g, '-').toLowerCase()
    const path = `/${name[0] || 'x'}/${name[1] || 'x'}/${name}`
    setForm(f => {
      if (f.media_gallery.some(m => m.file === path)) return f
      const first = f.media_gallery.length === 0
      const next = {
        ...f,
        media_gallery: [...f.media_gallery, {
          file: path,
          position: f.media_gallery.reduce((n, m) => Math.max(n, Number(m.position) || 0), 0) + 1,
          disabled: 0,
          label: null,
        }],
      }
      if (first) for (const role of IMAGE_ROLES) next[role.code] = path
      return next
    })
  }

  function validate() {
    const next = {}
    if (!form.name.trim()) next.name = 'This is a required field.'
    if (!form.sku.trim()) next.sku = 'This is a required field.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function buildPatch() {
    const patch = {
      name: form.name,
      sku: form.sku,
      status: form.status ? 1 : 2,
      attribute_set_id: Number(form.attribute_set_id),
      tax_class_id: Number(form.tax_class_id),
      is_in_stock: form.is_in_stock ? 1 : 0,
      weight: form.has_weight && form.weight !== '' ? Number(form.weight) : null,
      category_ids: form.categories.map(Number),
      visibility: Number(form.visibility),
      news_from_date: form.news_from_date || null,
      news_to_date: form.news_to_date || null,
      country_of_manufacture: form.country_of_manufacture || null,
      url_key: form.url_key || null,
      websites: form.websites.map(Number),
      /* HANDLERS-008 — the rest of the bound form. These are
       * catalog_product_entity_* / cataloginventory_stock_item columns that the
       * source's Save writes in the same request. */
      meta_title: form.meta_title || null,
      meta_keyword: form.meta_keyword || null,
      meta_description: form.meta_description || null,
      related: form.related.map(Number),
      upsell: form.upsell.map(Number),
      crosssell: form.crosssell.map(Number),
      custom_options: form.customOptions,
      page_layout: form.page_layout || null,
      options_container: form.options_container || null,
      custom_design_from: form.custom_design_from || null,
      custom_design_to: form.custom_design_to || null,
      custom_design: form.custom_design || null,
      gift_message_available: form.gift_message_available === '' ? null : Number(form.gift_message_available),
      links_purchased_separately: form.links_purchased_separately ? 1 : 0,
      media_gallery: form.media_gallery,
      image: form.image || null,
      small_image: form.small_image || null,
      thumbnail: form.thumbnail || null,
      stock_item: {
        ...(savedStockItem(existing?.entity_id) || {}),
        min_qty: form.min_qty === '' ? 0 : Number(form.min_qty),
        max_sale_qty: form.max_sale_qty === '' ? 10000 : Number(form.max_sale_qty),
        backorders: Number(form.backorders || 0),
      },
    }
    // Price and quantity belong to the variants of a configurable parent; the
    // source leaves the parent's own values untouched, so don't write them.
    if (!isConfigurable) {
      patch.price = form.price === '' ? null : Number(form.price)
      patch.qty = form.qty === '' ? null : Number(form.qty)
      patch.salable_quantity = form.qty === '' ? null : Number(form.qty)
      // Advanced Pricing is a variant-level concern on a configurable parent,
      // exactly like price/qty above.
      patch.special_price = form.special_price === '' ? null : Number(form.special_price)
      patch.cost = form.cost === '' ? null : Number(form.cost)
    }
    for (const a of attrs) {
      const v = form.custom[a.attribute_code]
      patch[a.attribute_code] = v === '' ? null : (Array.isArray(v) ? v : Number(v))
    }
    return patch
  }

  function save(after = 'close') {
    if (!validate()) {
      addMessage('Please fix the highlighted fields.', 'error')
      return
    }
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    if (isNew) {
      const id = nextProductId(state)
      addProduct({
        entity_id: id,
        type_id: newType,
        created_at: now,
        updated_at: now,
        media_gallery: [],
        ...buildPatch(),
      })
      if (form.description) setProductDescription(id, form.description)
      addMessage('You saved the product.')
      if (after === 'new') navigate(`/admin/catalog/product/new/set/${form.attribute_set_id}/type/${newType}/`)
      else if (after === 'stay') navigate(`/admin/catalog/product/edit/id/${id}/`)
      else navigate('/admin/catalog/product/')
      return
    }
    patchProduct(existing.entity_id, { ...buildPatch(), updated_at: now })
    setProductDescription(existing.entity_id, form.description)
    addMessage('You saved the product.')
    if (after === 'stay') return
    if (after === 'duplicate') {
      const id = nextProductId(state)
      addProduct({
        ...existing,
        entity_id: id,
        sku: `${form.sku}-1`,
        status: 2,
        created_at: now,
        updated_at: now,
        ...buildPatch(),
        sku_source: undefined,
      })
      addMessage('You duplicated the product.')
      navigate(`/admin/catalog/product/edit/id/${id}/`)
      return
    }
    navigate('/admin/catalog/product/')
  }

  const title = isNew ? 'New Product' : (existing.name || 'Product')

  const actions = (
    <>
      {/* DOM — the source's scope control is NOT a `<select>`: it is a hidden
          `#store_switcher` plus a `#store-change-button` dropdown whose label is
          the current scope. Rendering a select made `page.click('#store-change-button')`
          time out and put a select where the source has a button. Behaviour is
          unchanged: choosing a scope still writes `store` into the query string
          (HANDLERS-009), so it survives a reload and a deep link. */}
      <div className="store-switcher store-view" style={{ marginRight: 'auto' }}>
        <span className="store-switcher-label">Scope:</span>
        <div className={`actions dropdown closable${storeMenuOpen ? ' active' : ''}`}>
          <input type="hidden" name="store_switcher" id="store_switcher" data-role="store-view-id"
            data-param="store" value={searchParams.get('store') || '0'} data-ui-id="store-switcher" readOnly />
          <button type="button" className="admin__action-dropdown" id="store-change-button"
            aria-expanded={storeMenuOpen} onClick={() => setStoreMenuOpen(o => !o)}>
            {searchParams.get('store') === '1' ? 'Default Store View' : 'All Store Views'}
          </button>
          {storeMenuOpen ? (
            <ul className="dropdown-menu store-switcher-alt" data-role="stores-list">
              {[['0', 'All Store Views'], ['1', 'Default Store View']].map(([v, l]) => (
                <li key={v} className={v === '0' ? 'store-switcher-all' : 'store-switcher-store-view'}>
                  <span className="store-switcher-item" role="button" tabIndex={0}
                    onClick={() => { setStoreMenuOpen(false); setSearchParams(withGridParams(searchParams, { store: v === '0' ? null : v })) }}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setStoreMenuOpen(false); setSearchParams(withGridParams(searchParams, { store: v === '0' ? null : v })) } }}>
                    {l}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
      <button type="button" id="back" data-ui-id="back-button" title="Back"
        className="action- scalable back" onClick={() => navigate('/admin/catalog/product/')}>
        Back
      </button>
      <button
        type="button"
        /* F-07 — the source's id is `addAttribute` (camelCase) with
           `data-ui-id="addattribute-button"`; the mock's `add_attribute`
           matched nothing. */
        id="addAttribute"
        data-ui-id="addattribute-button"
        title="Add Attribute"
        className="action- scalable action-secondary"
        onClick={() => navigate('/admin/catalog/product_attribute/')}
      >
        Add Attribute
      </button>
      <SplitButton
        id="save-button"
        dataUiId="save-button"
        toggleDataUiId="save-button-dropdown"
        label="Save"
        onClick={() => save('close')}
        options={[
          { label: 'Save & New', onSelect: () => save('new') },
          { label: 'Save & Duplicate', onSelect: () => save('duplicate') },
          { label: 'Save & Close', onSelect: () => save('close') },
          ...(isNew ? [] : [{
            label: 'Delete',
            onSelect: () => {
              deleteProducts([existing.entity_id])
              addMessage('You deleted the product.')
              navigate('/admin/catalog/product/')
            },
          }]),
        ]}
      />
    </>
  )

  const variants = (existing?.configurable_children || [])
    .map(id => allProducts.find(p => p.entity_id === id))
    .filter(Boolean)

  /* ------------------------------------------------- Configurations wizard
   * BUG-109. Magento's "Edit Configurations" opens the four-step
   * `Create Product Configurations` slide-out: Select Attributes → Attribute
   * Values → Bulk Images, Price and Quantity → Summary, and Generate Products
   * creates one child per missing combination, named `<parent>-<value>-<value>`.
   * Step copy, step names and grid headers are the source's verbatim.
   * Everything writes through addProduct/patchProduct, so the new variants land
   * in /go's state_diff.
   */

  const WIZARD_STEPS = ['Select Attributes', 'Attribute Values', 'Bulk Images & Price', 'Summary']

  /** Attribute lookup by code, over the session-merged option lists. */
  const attributeByCode = useMemo(
    () => new Map(allAttributes.map(a => [a.attribute_code, a])), [allAttributes])

  /**
   * The attributes step 1 lists. Magento offers global, user-defined dropdown
   * attributes that actually have values — on this deployment that is exactly
   * `color`, `format`, `size` (`manufacturer` is excluded: no options).
   */
  const configCandidates = useMemo(() => allAttributes
    .filter(a => a.frontend_input === 'select' && a.is_global === 1 && a.is_user_defined === 1)
    .filter(a => (a.options || []).length > 0)
    .sort((a, b) => a.attribute_code.localeCompare(b.attribute_code)), [allAttributes])

  /** The parent's configurable attributes, with their (session-merged) options. */
  const configurableAttrs = (existing?.configurable_attributes || [])
    .map(code => attributeByCode.get(code))
    .filter(Boolean)

  function openWizard() {
    /* Pre-check the attributes and the values the existing variants use, as
       the source does ("Selected Attributes: Size, Color"). */
    const codes = (existing?.configurable_attributes || []).filter(c => attributeByCode.has(c))
    const selected = {}
    for (const code of codes) {
      selected[code] = [...new Set(
        variants.map(v => Number(v[code])).filter(v => Number.isFinite(v)))]
    }
    setWizard({
      step: 1, attrs: codes, selected,
      priceMode: 'skip', price: '', qtyMode: 'skip', qty: '',
    })
    setManualQuery(null)
  }

  function toggleWizardAttribute(code) {
    setWizard(w => {
      const on = w.attrs.includes(code)
      return {
        ...w,
        attrs: on ? w.attrs.filter(c => c !== code) : [...w.attrs, code],
        selected: on ? w.selected : { ...w.selected, [code]: w.selected[code] || [] },
      }
    })
  }

  function toggleWizardValue(code, optionId) {
    setWizard(w => {
      const list = w.selected[code] || []
      const next = list.includes(optionId) ? list.filter(v => v !== optionId) : [...list, optionId]
      return { ...w, selected: { ...w.selected, [code]: next } }
    })
  }

  function setWizardValues(code, ids) {
    setWizard(w => ({ ...w, selected: { ...w.selected, [code]: ids } }))
  }

  /** The combinations Generate Products would create — the ones not already used. */
  function pendingCombos(w) {
    if (!w) return []
    const codes = w.attrs
    const chosen = codes.map(c => w.selected[c] || [])
    if (!codes.length || chosen.some(list => list.length === 0)) return []
    const combos = chosen.reduce(
      (acc, list) => acc.flatMap(prefix => list.map(v => [...prefix, v])), [[]])
    const taken = new Set(variants.map(v => codes.map(c => String(v[c])).join('|')))
    return combos.filter(combo => !taken.has(combo.map(String).join('|')))
  }

  /** `[XS, Gray]` for a combination, in the order of the selected attributes. */
  function comboLabels(w, combo) {
    return combo.map((optionId, i) => {
      const a = attributeByCode.get(w.attrs[i])
      const o = (a?.options || []).find(x => Number(x.option_id) === Number(optionId))
      return o ? o.label : String(optionId)
    })
  }

  function wizardNext() {
    setWizard(w => {
      if (w.step === 1 && w.attrs.length === 0) {
        addMessage('Please select attributes.', 'error')
        return w
      }
      if (w.step === 2 && w.attrs.some(c => (w.selected[c] || []).length === 0)) {
        addMessage('Please select options for all attributes.', 'error')
        return w
      }
      return { ...w, step: Math.min(4, w.step + 1) }
    })
  }

  function generateConfigurations() {
    const w = wizard
    const codes = w.attrs
    const combos = pendingCombos(w)
    const sibling = variants[0] || null
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')

    let id = nextProductId(state)
    const created = []
    for (const combo of combos) {
      const suffix = comboLabels(w, combo).join('-')
      const price = w.priceMode === 'single' && w.price !== ''
        ? Number(w.price) : (sibling?.price ?? existing.price ?? null)
      const qty = w.qtyMode === 'single' && w.qty !== ''
        ? Number(w.qty) : (sibling?.qty ?? 0)
      const child = {
        entity_id: id++,
        type_id: 'simple',
        attribute_set_id: Number(existing.attribute_set_id),
        created_at: now,
        updated_at: now,
        name: `${existing.name}-${suffix}`,
        sku: `${existing.sku}-${suffix}`,
        url_key: `${slugify(existing.name)}-${slugify(suffix)}`,
        price,
        weight: sibling?.weight ?? null,
        qty,
        salable_quantity: qty,
        is_in_stock: 1,
        status: 1,
        visibility: 1,
        tax_class_id: Number(existing.tax_class_id ?? 2),
        websites: [...(existing.websites || [1])],
        category_ids: [...(existing.category_ids || [])],
        media_gallery: [],
      }
      codes.forEach((c, i) => { child[c] = combo[i] })
      created.push(child)
    }

    if (!created.length) {
      addMessage('All of those configurations already exist.', 'error')
      return
    }
    created.forEach(addProduct)
    patchProduct(existing.entity_id, {
      configurable_attributes: [...codes],
      configurable_children: [
        ...(existing.configurable_children || []), ...created.map(c => c.entity_id),
      ],
      updated_at: now,
    })
    addMessage(`Product Configurations. ${created.length} product(s) have been generated.`)
    setWizard(null)
  }

  /** "Add Products Manually" — associate an existing simple product. */
  const manualCandidates = manualQuery === null ? [] : allProducts
    .filter(p => p.type_id === 'simple')
    .filter(p => !(existing.configurable_children || []).includes(p.entity_id))
    .filter(p => Number(p.attribute_set_id) === Number(existing.attribute_set_id))
    .filter(p => {
      const q = manualQuery.trim().toLowerCase()
      if (!q) return false
      return String(p.name).toLowerCase().includes(q) || String(p.sku).toLowerCase().includes(q)
    })
    .slice(0, 20)

  function associateProduct(product) {
    patchProduct(existing.entity_id, {
      configurable_children: [...(existing.configurable_children || []), product.entity_id],
    })
    addMessage(`${product.sku} has been added to the configurations.`)
  }

  return (
    <PageShell title={title} documentTitle={isNew ? 'New Product' : title} actions={actions}>
      <form
        id="product_form"
        onSubmit={e => { e.preventDefault(); save('close') }}
        data-product-id={existing?.entity_id}
        data-product-type={type_id}
      >
        <Fieldset dataIndex="product-details">
          <Field label="Enable Product" scope="website" htmlFor="product-status" dataIndex="status">
            {/* BUG-107 — the source's switcher writes the *status attribute
                value* into `value`: 1 = Enabled, 2 = Disabled. Tasks read
                `[name="product[status]"].value` and expect "2" once disabled. */}
            <Toggle
              id="product-status"
              name="product[status]"
              checked={form.status}
              onValue="1"
              offValue="2"
              onChange={v => set('status', v)}
            />
          </Field>

          <Field label="Attribute Set" htmlFor="attribute-set-id" dataIndex="attribute_set_id">
            <select
              id="attribute-set-id"
              name="product[attribute_set_id]"
              className="admin__control-select"
              value={form.attribute_set_id}
              onChange={e => {
                const next = Number(e.target.value)
                setForm(f => ({
                  ...f,
                  attribute_set_id: next,
                  custom: Object.fromEntries(
                    customAttributes(next, allAttributes).map(a => [a.attribute_code, f.custom[a.attribute_code] ?? ''])),
                }))
              }}
            >
              {Object.entries(S.attributeSets)
                .sort((a, b) => a[1].localeCompare(b[1]))
                .map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </Field>

          <Field label="Product Name" scope="store view" required htmlFor="product-name" error={errors.name} dataIndex="name">
            <input
              id="product-name"
              name="product[name]"
              className="admin__control-text"
              type="text"
              value={form.name}
              onChange={e => set('name', e.target.value)}
            />
          </Field>

          <Field label="SKU" scope="global" required htmlFor="product-sku" error={errors.sku} dataIndex="sku">
            <input
              id="product-sku"
              name="product[sku]"
              className="admin__control-text"
              type="text"
              value={form.sku}
              onChange={e => set('sku', e.target.value)}
            />
          </Field>

          <Field label="Price" scope="global" htmlFor="product-price" short dataIndex="container_price">
            <IndexWrap index="price">
              <input
                id="product-price"
                name="product[price]"
                className="admin__control-text"
                type="text"
                placeholder="$"
                value={form.price}
                disabled={isConfigurable}
                onChange={e => set('price', e.target.value)}
              />
            </IndexWrap>
            <button
              type="button"
              className="admin__field-inline-link"
              data-index="advanced_pricing_button"
              onClick={() => set('showAdvancedPricing', !form.showAdvancedPricing)}
            >
              Advanced Pricing
            </button>
            {form.showAdvancedPricing ? (
              <div className="admin__form-section">
                <Field label="Special Price" htmlFor="special-price" short>
                  <input
                    id="special-price"
                    name="product[special_price]"
                    className="admin__control-text"
                    type="text"
                    value={form.special_price}
                    onChange={e => set('special_price', e.target.value)}
                  />
                </Field>
                <Field label="Cost" htmlFor="product-cost" short>
                  <input
                    id="product-cost"
                    name="product[cost]"
                    className="admin__control-text"
                    type="text"
                    value={form.cost}
                    onChange={e => set('cost', e.target.value)}
                  />
                </Field>
              </div>
            ) : null}
          </Field>

          <Field label="Tax Class" scope="website" htmlFor="product-tax-class" short dataIndex="tax_class_id">
            <select
              id="product-tax-class"
              name="product[tax_class_id]"
              className="admin__control-select"
              value={form.tax_class_id}
              onChange={e => set('tax_class_id', Number(e.target.value))}
            >
              {TAX_CLASS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="Quantity" scope="global" htmlFor="product-qty" short dataIndex="quantity_and_stock_status_qty">
            {/* DOM-006 — the source renders this as type="text"; type="number"
                blanks `.value` for any non-numeric keystroke, which fails the
                exact_match on `[name="product[quantity_and_stock_status][qty]"]`. */}
            <IndexWrap index="qty">
              <input
                id="product-qty"
                name="product[quantity_and_stock_status][qty]"
                className="admin__control-text"
                type="text"
                value={form.qty}
                disabled={isConfigurable}
                onChange={e => set('qty', e.target.value)}
              />
            </IndexWrap>
            <button
              type="button"
              className="admin__field-inline-link"
              data-index="advanced_inventory_button"
              onClick={() => set('showAdvancedInventory', !form.showAdvancedInventory)}
            >
              Advanced Inventory
            </button>
            {form.showAdvancedInventory ? (
              <div className="admin__form-section">
                <div className="admin__form-section-title">Advanced Inventory</div>
                <Field label="Out-of-Stock Threshold" htmlFor="min-qty" short>
                  <input
                    id="min-qty"
                    name="product[stock_data][min_qty]"
                    className="admin__control-text"
                    type="number"
                    value={form.min_qty}
                    onChange={e => set('min_qty', e.target.value)}
                  />
                </Field>
                <Field label="Maximum Qty Allowed in Cart" htmlFor="max-sale-qty" short>
                  <input
                    id="max-sale-qty"
                    name="product[stock_data][max_sale_qty]"
                    className="admin__control-text"
                    type="number"
                    value={form.max_sale_qty}
                    onChange={e => set('max_sale_qty', e.target.value)}
                  />
                </Field>
                <Field label="Backorders" htmlFor="backorders" short>
                  <select
                    id="backorders"
                    name="product[stock_data][backorders]"
                    className="admin__control-select"
                    value={form.backorders}
                    onChange={e => set('backorders', e.target.value)}
                  >
                    <option value="0">No Backorders</option>
                    <option value="1">Allow Qty Below 0</option>
                    <option value="2">Allow Qty Below 0 and Notify Customer</option>
                  </select>
                </Field>
              </div>
            ) : null}
          </Field>

          <Field label="Stock Status" scope="global" htmlFor="product-stock-status" short dataIndex="quantity_and_stock_status">
            <select
              id="product-stock-status"
              name="product[quantity_and_stock_status][is_in_stock]"
              className="admin__control-select"
              value={form.is_in_stock ? '1' : '0'}
              onChange={e => set('is_in_stock', e.target.value === '1')}
            >
              <option value="1">In Stock</option>
              <option value="0">Out of Stock</option>
            </select>
          </Field>

          <Field label="Weight" scope="global" htmlFor="product-weight" dataIndex="container_weight">
            <div className="admin__field-addon">
              <IndexWrap index="weight">
                <input
                  id="product-weight"
                  name="product[weight]"
                  className="admin__control-text"
                  type="text"
                  value={form.weight}
                  onChange={e => set('weight', e.target.value)}
                  disabled={!form.has_weight}
                />
              </IndexWrap>
              <span className="admin__addon-suffix">lbs</span>
              <select
                className="admin__control-select"
                data-index="product_has_weight"
                name="product[product_has_weight]"
                value={form.has_weight ? '1' : '0'}
                onChange={e => set('has_weight', e.target.value === '1')}
                aria-label="Weight type"
              >
                <option value="1">This item has weight</option>
                <option value="0">This item has no weight</option>
              </select>
            </div>
          </Field>

          <Field label="Categories" scope="store view" htmlFor="product-categories" dataIndex="container_category_ids">
            <div className="admin__chip-list">
              {form.categories.map(id => (
                <span className="admin__chip" key={id}>
                  {categoryById.get(id)?.name || `ID ${id}`}
                  <button
                    type="button"
                    aria-label={`Remove ${categoryById.get(id)?.name || id}`}
                    onClick={() => set('categories', form.categories.filter(c => c !== id))}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <select
              id="product-categories"
              data-index="category_ids"
              name="product[categories]"
              className="admin__control-select"
              value=""
              onChange={e => {
                const id = Number(e.target.value)
                if (id && !form.categories.includes(id)) set('categories', [...form.categories, id])
              }}
            >
              <option value="">Select…</option>
              {categories
                .filter(c => c.level >= 2)
                .map(c => <option key={c.entity_id} value={c.entity_id}>{c.name}</option>)}
            </select>
            <button
              type="button"
              className="action-secondary"
              data-index="create_category_button"
              onClick={() => navigate('/admin/catalog/category/')}
            >
              New Category
            </button>
          </Field>

          <Field label="Visibility" scope="store view" htmlFor="product-visibility" short dataIndex="visibility">
            <select
              id="product-visibility"
              name="product[visibility]"
              className="admin__control-select"
              value={form.visibility}
              onChange={e => set('visibility', Number(e.target.value))}
            >
              {VISIBILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          <Field label="Set Product as New From" scope="website" htmlFor="news-from-date" dataIndex="container_news_from_date">
            <div className="admin__field-addon">
              {/* DOM-006 — the source is a jQuery datepicker over a text input
                  (`admin__control-text _has-datepicker`), so `.value` is the
                  localized string, not the ISO one `type="date"` reports. */}
              <IndexWrap index="news_from_date">
                <input
                  id="news-from-date"
                  name="product[news_from_date]"
                  className="admin__control-text _has-datepicker"
                  type="text"
                  value={form.news_from_date || ''}
                  onChange={e => set('news_from_date', e.target.value)}
                />
              </IndexWrap>
              <span className="admin__addon-suffix">To</span>
              <IndexWrap index="news_to_date">
                <input
                  name="product[news_to_date]"
                  className="admin__control-text _has-datepicker"
                  type="text"
                  aria-label="Set Product as New To"
                  value={form.news_to_date || ''}
                  onChange={e => set('news_to_date', e.target.value)}
                />
              </IndexWrap>
            </div>
          </Field>

          <Field label="Country of Manufacture" scope="website" htmlFor="country-of-manufacture" dataIndex="country_of_manufacture">
            <select
              id="country-of-manufacture"
              name="product[country_of_manufacture]"
              className="admin__control-select"
              value={form.country_of_manufacture || ''}
              onChange={e => set('country_of_manufacture', e.target.value)}
            >
              {COUNTRY_OPTIONS.map(o => <option key={o.value || 'blank'} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          {/* Attribute-set attributes (Color, Size, Material, Style, Sale, New, …) */}
          {attrs.map(a => (
            <Field key={a.attribute_code} label={a.frontend_label} scope="global" htmlFor={`attribute-${a.attribute_code}`} dataIndex={a.attribute_code}>
              {a.frontend_input === 'boolean' ? (
                /* BUG-108 — Sale / New / Eco Collection / … are switchers on
                   the source (`input[name="product[sale]"][value="0|1"]`), not
                   selects. Their eav options carry no labels, so a select
                   renders a blank line an agent cannot choose. */
                <Toggle
                  id={`attribute-${a.attribute_code}`}
                  name={`product[${a.attribute_code}]`}
                  checked={Number(form.custom[a.attribute_code]) === 1}
                  onChange={v => setCustom(a.attribute_code, v ? 1 : 0)}
                />
              ) : a.frontend_input === 'multiselect' ? (
                <select
                  id={`attribute-${a.attribute_code}`}
                  name={`product[${a.attribute_code}]`}
                  className="admin__control-multiselect"
                  multiple
                  value={Array.isArray(form.custom[a.attribute_code])
                    ? form.custom[a.attribute_code].map(String)
                    : String(form.custom[a.attribute_code] || '').split(',').filter(Boolean)}
                  onChange={e => setCustom(
                    a.attribute_code,
                    Array.from(e.target.selectedOptions).map(o => Number(o.value)))}
                >
                  {orderAttributeOptions(a.attribute_code, a.options).map(o => (
                    <option key={o.option_id} value={o.option_id}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <select
                  id={`attribute-${a.attribute_code}`}
                  name={`product[${a.attribute_code}]`}
                  className="admin__control-select"
                  value={form.custom[a.attribute_code] ?? ''}
                  onChange={e => setCustom(a.attribute_code, e.target.value)}
                >
                  {/* F-05 — the source's caption for these attribute selects
                      is the empty string, not "-- Please Select --":
                      `[name="product[color]"]` option[0] is `['','']`. */}
                  <option value="" />
                  {orderAttributeOptions(a.attribute_code, a.options).map(o => (
                    <option key={o.option_id} value={o.option_id}>{o.label}</option>
                  ))}
                </select>
              )}
            </Field>
          ))}
        </Fieldset>

        {/* ------------------------------------------------ collapsible sections */}

        <CollapsibleSection title="Content" dataIndex="content">
          <Field label="Description" scope="store view" htmlFor="product-description">
            <textarea
              id="product-description"
              name="product[description]"
              className="admin__control-textarea"
              rows={10}
              value={form.description}
              onChange={e => set('description', e.target.value)}
            />
          </Field>
        </CollapsibleSection>

        {type_id === 'configurable' ? (
          <CollapsibleSection title="Configurations" dataIndex="configurable" defaultOpen>
            <div className="admin__configurable-intro">
              <p>
                Configurable products allow customers to choose options
                (Ex: shirt color). You need to create a simple product for each
                configuration (Ex: a product for each color).
              </p>
              <div className="admin__configurable-actions" data-index="configurable_products_button_set">
                <button
                  type="button"
                  className="admin__field-inline-link"
                  data-index="add_products_manually_button"
                  id="add_products_manually_button"
                  onClick={() => { setManualQuery(manualQuery === null ? '' : null); setWizard(null) }}
                >
                  Add Products Manually
                </button>
                <button
                  type="button"
                  className="action-secondary"
                  data-index="create_configurable_products_button"
                  id="configurable_products_button"
                  onClick={() => (wizard ? setWizard(null) : openWizard())}
                >
                  Edit Configurations
                </button>
              </div>
            </div>
            <div className="admin__page-section-title">Current Variations</div>
            <div className="admin__field admin__field-wide _no-header" data-index="configurable-matrix">
            <div data-index="product.form.configurable.matrix.content" style={{ display: 'contents' }}>
            <table className="admin__variations-grid">
              <thead>
                <tr>
                  <th>Image</th><th>Name</th><th>SKU</th><th>Price</th>
                  <th>Quantity</th><th>Weight</th><th>Status</th>
                  <th>Attributes</th><th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {variants.map(v => (
                  <tr key={v.entity_id}>
                    <td data-index="thumbnail_image_container" />
                    <td data-index="name_container"><span data-index="name_text">{v.name}</span></td>
                    <td data-index="sku_container"><span data-index="sku_text">{v.sku}</span></td>
                    <td data-index="price_container"><span data-index="price_text">{formatCurrency(v.price)}</span></td>
                    <td data-index="quantity_container">
                      <span data-index="quantity_text">{v.qty == null ? '' : Number(v.qty)}</span>
                    </td>
                    <td data-index="price_weight">
                      <span data-index="weight_text">{v.weight == null ? '' : Number(v.weight).toFixed(6)}</span>
                    </td>
                    <td data-index="status">
                      <span data-index="status">{Number(v.status) === 1 ? 'Enabled' : 'Disabled'}</span>
                    </td>
                    <td data-index="attributes">
                      <span data-index="attributes">
                        {configurableAttrs.map(a => {
                          const o = (a.options || []).find(x => Number(x.option_id) === Number(v[a.attribute_code]))
                          return o ? `${a.frontend_label}: ${o.label}` : null
                        }).filter(Boolean).join(', ')}
                      </span>
                    </td>
                    <td data-index="actionsList">
                      <AdminLink to={`/admin/catalog/product/edit/id/${v.entity_id}/`}>Edit</AdminLink>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            </div>

            {manualQuery !== null ? (
              <div className="admin__configurable-manual">
                <div className="admin__page-section-title">Select Associated Product</div>
                <input
                  type="text"
                  className="admin__control-text"
                  placeholder="Search by name or SKU"
                  value={manualQuery}
                  onChange={e => setManualQuery(e.target.value)}
                />
                <table className="admin__variations-grid">
                  <thead>
                    <tr><th>Name</th><th>SKU</th><th>Price</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    {manualCandidates.map(p => (
                      <tr key={p.entity_id}>
                        <td>{p.name}</td>
                        <td>{p.sku}</td>
                        <td>{formatCurrency(p.price)}</td>
                        <td>
                          <button type="button" className="action-secondary"
                            onClick={() => associateProduct(p)}>Add</button>
                        </td>
                      </tr>
                    ))}
                    {manualCandidates.length === 0 ? (
                      <tr><td colSpan={4}>We couldn&#39;t find any records.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            ) : null}

            {wizard ? (
              <div className="modal-slide _show" data-role="configurable-wizard">
                <div className="modal-inner-wrap">
                  <header className="modal-header">
                    <h1 className="modal-title">Create Product Configurations</h1>
                    <button type="button" className="action-close" aria-label="Close"
                      onClick={() => setWizard(null)}>✕</button>
                  </header>

                  {wizard.step === 1 ? (
                    <div className="message message-notice">
                      When you remove or add an attribute, we automatically update all
                      configurations and you will need to recreate current configurations
                      manually.
                    </div>
                  ) : null}

                  <div className="admin__wizard-nav">
                    <ol className="admin__wizard-steps">
                      {WIZARD_STEPS.map((label, i) => (
                        <li key={label}
                          className={`admin__wizard-step${wizard.step === i + 1 ? ' _active' : ''}${wizard.step > i + 1 ? ' _complete' : ''}`}>
                          <span className="admin__wizard-step-number">{i + 1}</span>
                          <span className="admin__wizard-step-title">{label}</span>
                        </li>
                      ))}
                    </ol>
                    <div className="admin__wizard-actions">
                      <button type="button" className="admin__field-inline-link"
                        id="wizard_cancel" onClick={() => setWizard(null)}>Cancel</button>
                      <button type="button" className="action-default" id="wizard_back"
                        disabled={wizard.step === 1}
                        onClick={() => setWizard(w => ({ ...w, step: Math.max(1, w.step - 1) }))}>
                        Back
                      </button>
                      {wizard.step < 4 ? (
                        <button type="button" className="action-primary" id="wizard_next"
                          onClick={wizardNext}>Next</button>
                      ) : (
                        <button type="button" className="action-primary" id="generate_configurations"
                          onClick={generateConfigurations}>Generate Products</button>
                      )}
                    </div>
                  </div>

                  {wizard.step === 1 ? (
                    <div className="admin__wizard-content">
                      <div className="page-actions admin__wizard-heading">
                        <h2>Step 1: Select Attributes</h2>
                        <button type="button" className="action-secondary"
                          onClick={() => navigate('/admin/catalog/product_attribute/new/')}>
                          Create New Attribute
                        </button>
                      </div>
                      <p>
                        Selected Attributes:{' '}
                        {wizard.attrs.map(c => attributeByCode.get(c)?.frontend_label || c).join(', ')}
                      </p>
                      <div className="admin__data-grid-header">
                        {configCandidates.length} records found ({wizard.attrs.length} selected)
                      </div>
                      <table className="admin__variations-grid">
                        <thead>
                          <tr>
                            <th>Options</th><th>Attribute Code</th><th>Attribute Label</th>
                            <th>Required</th><th>System</th><th>Visible</th><th>Scope</th>
                            <th>Searchable</th><th>Comparable</th>
                            <th>Use in Layered Navigation</th>
                          </tr>
                        </thead>
                        <tbody>
                          {configCandidates.map(a => (
                            <tr key={a.attribute_id}>
                              <td>
                                <input
                                  type="checkbox"
                                  className="admin__control-checkbox"
                                  name="attributes[]"
                                  value={a.attribute_id}
                                  aria-label={a.frontend_label}
                                  checked={wizard.attrs.includes(a.attribute_code)}
                                  onChange={() => toggleWizardAttribute(a.attribute_code)}
                                />
                              </td>
                              <td>{a.attribute_code}</td>
                              <td>{a.frontend_label}</td>
                              <td>{a.is_required ? 'Yes' : 'No'}</td>
                              <td>{a.is_user_defined ? 'Yes' : 'No'}</td>
                              <td>{a.is_visible_on_front || a.is_filterable ? 'Yes' : 'No'}</td>
                              <td>{a.is_global === 1 ? 'Global' : 'Store View'}</td>
                              <td>{a.is_searchable ? 'Yes' : 'No'}</td>
                              <td>{a.is_comparable ? 'Yes' : 'No'}</td>
                              <td>{a.is_filterable ? 'Filterable (with results)' : 'No'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}

                  {wizard.step === 2 ? (
                    <div className="admin__wizard-content">
                      <h2>Step 2: Attribute Values</h2>
                      <p>
                        Select values from each attribute to include in this product. Each
                        unique combination of values creates a unique product SKU.
                      </p>
                      {wizard.attrs.map(code => {
                        const a = attributeByCode.get(code)
                        if (!a) return null
                        const options = a.options || []
                        return (
                          <fieldset key={code} className="admin__fieldset admin__wizard-values">
                            <legend className="admin__legend">
                              <span>{a.frontend_label}</span>
                              <span className="admin__wizard-option-count">
                                ({options.length} Options)
                              </span>
                            </legend>
                            <div className="admin__wizard-values-actions">
                              <button type="button" className="admin__field-inline-link"
                                onClick={() => setWizardValues(code, options.map(o => Number(o.option_id)))}>
                                Select All
                              </button>
                              <span> | </span>
                              <button type="button" className="admin__field-inline-link"
                                onClick={() => setWizardValues(code, [])}>
                                Deselect All
                              </button>
                              <button type="button" className="admin__field-inline-link"
                                title="Remove Attribute"
                                onClick={() => toggleWizardAttribute(code)}>
                                Remove Attribute
                              </button>
                            </div>
                            <div className="admin__configurable-values">
                              {options.map(o => (
                                <label key={o.option_id} className="admin__field-option">
                                  <input
                                    type="checkbox"
                                    className="admin__control-checkbox"
                                    name={`configurable[${code}][]`}
                                    value={o.option_id}
                                    checked={(wizard.selected[code] || []).includes(Number(o.option_id))}
                                    onChange={() => toggleWizardValue(code, Number(o.option_id))}
                                  />
                                  <span>{o.label}</span>
                                </label>
                              ))}
                            </div>
                          </fieldset>
                        )
                      })}
                    </div>
                  ) : null}

                  {wizard.step === 3 ? (
                    <div className="admin__wizard-content">
                      <h2>Step 3: Bulk Images, Price and Quantity</h2>
                      <p>
                        Based on your selections {pendingCombos(wizard).length} new products
                        will be created. Use this step to customize images and price for your
                        new products.
                      </p>
                      <fieldset className="admin__fieldset">
                        <legend className="admin__legend"><span>Images</span></legend>
                        <div className="admin__field-note">
                          Image upload is disabled in this environment; new configurations
                          are created without images.
                        </div>
                      </fieldset>
                      <fieldset className="admin__fieldset">
                        <legend className="admin__legend"><span>Price</span></legend>
                        <label className="admin__field-option">
                          <input type="radio" name="bulk[price]" value="single"
                            checked={wizard.priceMode === 'single'}
                            onChange={() => setWizard(w => ({ ...w, priceMode: 'single' }))} />
                          <span>Apply single price to all SKUs</span>
                        </label>
                        {wizard.priceMode === 'single' ? (
                          <input type="text" className="admin__control-text"
                            name="bulk[price][value]" aria-label="Price"
                            value={wizard.price}
                            onChange={e => setWizard(w => ({ ...w, price: e.target.value }))} />
                        ) : null}
                        <label className="admin__field-option">
                          <input type="radio" name="bulk[price]" value="skip"
                            checked={wizard.priceMode === 'skip'}
                            onChange={() => setWizard(w => ({ ...w, priceMode: 'skip' }))} />
                          <span>Skip price at this time</span>
                        </label>
                      </fieldset>
                      <fieldset className="admin__fieldset">
                        <legend className="admin__legend"><span>Quantity</span></legend>
                        <label className="admin__field-option">
                          <input type="radio" name="bulk[qty]" value="single"
                            checked={wizard.qtyMode === 'single'}
                            onChange={() => setWizard(w => ({ ...w, qtyMode: 'single' }))} />
                          <span>Apply single quantity to each SKUs</span>
                        </label>
                        {wizard.qtyMode === 'single' ? (
                          <input type="number" className="admin__control-text"
                            name="bulk[qty][value]" aria-label="Quantity"
                            value={wizard.qty}
                            onChange={e => setWizard(w => ({ ...w, qty: e.target.value }))} />
                        ) : null}
                        <label className="admin__field-option">
                          <input type="radio" name="bulk[qty]" value="skip"
                            checked={wizard.qtyMode === 'skip'}
                            onChange={() => setWizard(w => ({ ...w, qtyMode: 'skip' }))} />
                          <span>Skip quantity at this time</span>
                        </label>
                      </fieldset>
                    </div>
                  ) : null}

                  {wizard.step === 4 ? (
                    <div className="admin__wizard-content">
                      <h2>Step 4: Summary</h2>
                      <div className="admin__page-section-title">New Product Review</div>
                      <table className="admin__variations-grid">
                        <thead>
                          <tr>
                            <th>Images</th><th>SKU</th><th>Quantity</th>
                            {wizard.attrs.map(c => (
                              <th key={c}>{attributeByCode.get(c)?.frontend_label || c}</th>
                            ))}
                            <th>Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {pendingCombos(wizard).map(combo => {
                            const labels = comboLabels(wizard, combo)
                            const qty = wizard.qtyMode === 'single' && wizard.qty !== ''
                              ? Number(wizard.qty) : Number(variants[0]?.qty ?? 0)
                            const price = wizard.priceMode === 'single' && wizard.price !== ''
                              ? Number(wizard.price) : Number(variants[0]?.price ?? existing.price ?? 0)
                            return (
                              <tr key={labels.join('-')}>
                                <td>0</td>
                                <td>{`${existing.sku}-${labels.join('-')}`}</td>
                                <td>{qty}</td>
                                {labels.map((l, i) => <td key={wizard.attrs[i]}>{l}</td>)}
                                <td>{`$ ${price.toFixed(6)}`}</td>
                              </tr>
                            )
                          })}
                          {pendingCombos(wizard).length === 0 ? (
                            <tr>
                              <td colSpan={4 + wizard.attrs.length}>
                                Based on your selections 0 new products will be created.
                              </td>
                            </tr>
                          ) : null}
                        </tbody>
                      </table>
                      <div className="admin__page-section-title">Associated Products</div>
                      <p>You created these products for this configuration.</p>
                      <table className="admin__variations-grid">
                        <thead>
                          <tr>
                            <th>Images</th><th>SKU</th><th>Quantity</th>
                            {wizard.attrs.map(c => (
                              <th key={c}>{attributeByCode.get(c)?.frontend_label || c}</th>
                            ))}
                            <th>Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {variants.map(v => (
                            <tr key={v.entity_id}>
                              <td>0</td>
                              <td>{v.sku}</td>
                              <td>{v.qty == null ? '' : Number(v.qty)}</td>
                              {wizard.attrs.map(c => {
                                const a = attributeByCode.get(c)
                                const o = (a?.options || []).find(x => Number(x.option_id) === Number(v[c]))
                                return <td key={c}>{o ? o.label : ''}</td>
                              })}
                              <td>{v.price == null ? '' : `$ ${Number(v.price).toFixed(6)}`}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </CollapsibleSection>
        ) : null}

        {!isNew ? (
          <CollapsibleSection title="Product Reviews" dataIndex="review">
            <ProductReviews productId={existing.entity_id} />
          </CollapsibleSection>
        ) : null}

        <CollapsibleSection title="Images And Videos" dataIndex="gallery">
          <div className="admin__field-note">
            {form.media_gallery.length} image(s) in the gallery.
          </div>
          <table className="data-table admin__table-primary gallery-table" id="media_gallery_content">
            <thead>
              <tr>
                <th className="col-image">Image</th>
                <th className="col-label">Alt Text</th>
                <th className="col-role">Base</th>
                <th className="col-role">Small</th>
                <th className="col-role">Thumbnail</th>
                <th className="col-disabled">Hide from Product Page</th>
                <th className="col-actions">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {form.media_gallery.length === 0 ? (
                <tr className="data-grid-tr-no-data">
                  <td colSpan={7}>Browse to find or drag image here</td>
                </tr>
              ) : form.media_gallery.map((m, i) => (
                <tr key={m.file} data-file={m.file}>
                  <td className="col-image">{m.file}</td>
                  <td className="col-label">
                    <input type="text" className="admin__control-text"
                      name={`product[media_gallery][images][${i}][label]`}
                      aria-label={`Alt Text for ${m.file}`}
                      value={m.label ?? ''}
                      onChange={e => setGalleryImage(i, { label: e.target.value })} />
                  </td>
                  {IMAGE_ROLES.map(role => (
                    <td className="col-role" key={role.code}>
                      <input type="checkbox" className="admin__control-checkbox"
                        name={`product[${role.code}]`}
                        value={m.file}
                        aria-label={`${role.label} role for ${m.file}`}
                        checked={form[role.code] === m.file}
                        onChange={e => set(role.code, e.target.checked ? m.file : '')} />
                    </td>
                  ))}
                  <td className="col-disabled">
                    <input type="checkbox" className="admin__control-checkbox"
                      name={`product[media_gallery][images][${i}][disabled]`}
                      value="1"
                      aria-label={`Hide ${m.file} from Product Page`}
                      checked={Number(m.disabled) === 1}
                      onChange={e => setGalleryImage(i, { disabled: e.target.checked ? 1 : 0 })} />
                  </td>
                  <td className="col-actions">
                    <button type="button" className="action-menu-item"
                      title="Delete image"
                      onClick={() => removeGalleryImage(i)}>Delete image</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="admin__field">
            <div className="admin__field-control">
              <input id="gallery_add_file" name="image[]" type="file" accept="image/*"
                className="admin__control-file" onChange={addGalleryImage} />
              <p className="admin__field-note">
                Browse to find or drag image here
              </p>
            </div>
          </div>
        </CollapsibleSection>

        <CollapsibleSection title="Search Engine Optimization" dataIndex="search-engine-optimization">
          <Field label="URL Key" scope="store view" htmlFor="product-url-key">
            <input
              id="product-url-key"
              name="product[url_key]"
              className="admin__control-text"
              type="text"
              value={form.url_key || ''}
              onChange={e => set('url_key', e.target.value)}
            />
          </Field>
          <Field label="Meta Title" scope="store view" htmlFor="product-meta-title">
            <input
              id="product-meta-title"
              name="product[meta_title]"
              className="admin__control-text"
              type="text"
              value={form.meta_title}
              onChange={e => set('meta_title', e.target.value)}
            />
          </Field>
          <Field label="Meta Keywords" scope="store view" htmlFor="product-meta-keyword">
            <textarea
              id="product-meta-keyword"
              name="product[meta_keyword]"
              className="admin__control-textarea"
              rows={3}
              value={form.meta_keyword}
              onChange={e => set('meta_keyword', e.target.value)}
            />
          </Field>
          <Field label="Meta Description" scope="store view" htmlFor="product-meta-description">
            <textarea
              id="product-meta-description"
              name="product[meta_description]"
              className="admin__control-textarea"
              rows={3}
              value={form.meta_description}
              onChange={e => set('meta_description', e.target.value)}
            />
          </Field>
        </CollapsibleSection>

        <CollapsibleSection title="Related Products, Up-Sells, and Cross-Sells" dataIndex="related">
          <RelatedProducts
            label="Related Products"
            selected={form.related}
            products={allProducts}
            onChange={v => set('related', v)}
          />
          <RelatedProducts
            label="Up-Sell Products"
            selected={form.upsell}
            products={allProducts}
            onChange={v => set('upsell', v)}
          />
          <RelatedProducts
            label="Cross-Sell Products"
            selected={form.crosssell}
            products={allProducts}
            onChange={v => set('crosssell', v)}
          />
        </CollapsibleSection>

        <CollapsibleSection title="Customizable Options" dataIndex="custom_options">
          <div className="admin__field-note">This product has no customizable options.</div>
          <button
            type="button"
            className="action-secondary"
            onClick={() => set('customOptions', [...form.customOptions, { title: '', type: 'field', price: '' }])}
          >
            Add Option
          </button>
          {form.customOptions.map((o, i) => (
            <div className="admin__form-section" key={i}>
              <Field label="Option Title" htmlFor={`option-title-${i}`}>
                <input
                  id={`option-title-${i}`}
                  className="admin__control-text"
                  name={`product[options][${i}][title]`}
                  value={o.title}
                  onChange={e => set('customOptions', form.customOptions.map((x, j) => j === i ? { ...x, title: e.target.value } : x))}
                />
              </Field>
              <Field label="Price" htmlFor={`option-price-${i}`} short>
                <input
                  id={`option-price-${i}`}
                  className="admin__control-text"
                  name={`product[options][${i}][price]`}
                  value={o.price}
                  onChange={e => set('customOptions', form.customOptions.map((x, j) => j === i ? { ...x, price: e.target.value } : x))}
                />
              </Field>
              <button
                type="button"
                className="action-default"
                onClick={() => set('customOptions', form.customOptions.filter((_, j) => j !== i))}
              >
                Delete Option
              </button>
            </div>
          ))}
        </CollapsibleSection>

        <CollapsibleSection title="Product in Websites" dataIndex="websites">
          <label className="admin__field-option">
            <input
              type="checkbox"
              className="admin__control-checkbox"
              name="product[website_ids][1]"
              value="1"
              checked={form.websites.includes(1)}
              onChange={e => set('websites', e.target.checked ? [1] : [])}
            />
            <span>Main Website</span>
          </label>
        </CollapsibleSection>

        <CollapsibleSection title="Design" dataIndex="design">
          <Field label="Layout" scope="store view" htmlFor="product-page-layout" short>
            <select
              id="product-page-layout"
              name="product[page_layout]"
              className="admin__control-select"
              value={form.page_layout}
              onChange={e => set('page_layout', e.target.value)}
            >
              <option value="">No layout updates</option>
              <option value="empty">Empty</option>
              <option value="1column">1 column</option>
              <option value="2columns-left">2 columns with left bar</option>
              <option value="2columns-right">2 columns with right bar</option>
              <option value="3columns">3 columns</option>
            </select>
          </Field>
          <Field label="Display Product Options In" scope="store view" htmlFor="options-container" short>
            <select
              id="options-container"
              name="product[options_container]"
              className="admin__control-select"
              value={form.options_container}
              onChange={e => set('options_container', e.target.value)}
            >
              <option value="container1">Block after Info Column</option>
              <option value="container2">Product Info Column</option>
            </select>
          </Field>
        </CollapsibleSection>

        <CollapsibleSection title="Schedule Design Update" dataIndex="schedule-design-update">
          <Field label="Schedule Update From" scope="website" htmlFor="custom-design-from">
            <input
              id="custom-design-from"
              name="product[custom_design_from]"
              className="admin__control-text"
              type="date"
              value={form.custom_design_from}
              onChange={e => set('custom_design_from', e.target.value)}
            />
          </Field>
          <Field label="Schedule Update To" scope="website" htmlFor="custom-design-to">
            <input
              id="custom-design-to"
              name="product[custom_design_to]"
              className="admin__control-text"
              type="date"
              value={form.custom_design_to}
              onChange={e => set('custom_design_to', e.target.value)}
            />
          </Field>
          <Field label="New Theme" scope="store view" htmlFor="custom-design" short>
            <select
              id="custom-design"
              name="product[custom_design]"
              className="admin__control-select"
              value={form.custom_design}
              onChange={e => set('custom_design', e.target.value)}
            >
              <option value="">-- Please Select --</option>
              <option value="1">Magento Blank</option>
              <option value="3">Magento Luma</option>
            </select>
          </Field>
        </CollapsibleSection>

        <CollapsibleSection title="Gift Options" dataIndex="gift-options">
          <Field label="Allow Gift Message" scope="website" htmlFor="gift-message-available">
            <Toggle
              id="gift-message-available"
              name="product[gift_message_available]"
              checked={form.gift_message_available === '1'}
              onChange={v => set('gift_message_available', v ? '1' : '0')}
            />
          </Field>
        </CollapsibleSection>

        {type_id === 'downloadable' || newType === 'downloadable' ? (
          <CollapsibleSection title="Downloadable Information" dataIndex="downloadable">
            <label className="admin__field-option">
              <input
                type="checkbox"
                className="admin__control-checkbox"
                name="product[links_purchased_separately]"
                value="1"
                checked={!!form.links_purchased_separately}
                onChange={e => set('links_purchased_separately', e.target.checked)}
              />
              <span>Is this downloadable product?</span>
            </label>
          </CollapsibleSection>
        ) : null}
      </form>
    </PageShell>
  )
}

/* --------------------------------------------------------------- sub-blocks */

function ProductReviews({ productId }) {
  const { state } = useApp()
  const reviews = (state?.reviews || []).filter(r => String(r.entity_pk_value) === String(productId))
  /* The source's Product Reviews section links out to the per-product review
     grid — `/admin/review/product/index/productId/<id>/`. */
  const allLink = (
    <div className="admin__field-note">
      <AdminLink to={`/admin/review/product/index/productId/${productId}/`}>
        All Reviews
      </AdminLink>
    </div>
  )
  if (!reviews.length) {
    return (
      <>
        <div className="admin__field-note">No reviews for this product.</div>
        {allLink}
      </>
    )
  }
  return (
    <>
      {allLink}
    <table className="admin__variations-grid">
      <thead>
        <tr><th>ID</th><th>Status</th><th>Title</th><th>Nickname</th><th>Review</th><th>Action</th></tr>
      </thead>
      <tbody>
        {reviews.map(r => (
          <tr key={r.review_id}>
            <td>{r.review_id}</td>
            <td>{{ 1: 'Approved', 2: 'Pending', 3: 'Not Approved' }[Number(r.status_id)]}</td>
            <td>{r.title}</td>
            <td>{r.nickname}</td>
            <td>{r.detail}</td>
            <td><AdminLink to={`/admin/review/product/edit/id/${r.review_id}/`}>Edit</AdminLink></td>
          </tr>
        ))}
      </tbody>
    </table>
    </>
  )
}

function RelatedProducts({ label, selected, products, onChange }) {
  const [q, setQ] = useState('')
  const matches = q.trim()
    ? products.filter(p => p.name.toLowerCase().includes(q.toLowerCase())).slice(0, 10)
    : []
  return (
    <div className="admin__form-section">
      <div className="admin__form-section-title">{label}</div>
      <div className="admin__chip-list">
        {selected.map(p => (
          <span className="admin__chip" key={p.entity_id}>
            {p.name}
            <button type="button" aria-label={`Remove ${p.name}`} onClick={() => onChange(selected.filter(x => x.entity_id !== p.entity_id))}>×</button>
          </span>
        ))}
      </div>
      <input
        className="admin__control-text"
        type="text"
        placeholder={`Add ${label}`}
        aria-label={`Add ${label}`}
        value={q}
        onChange={e => setQ(e.target.value)}
      />
      {matches.length ? (
        <ul className="admin__field-note">
          {matches.map(p => (
            <li key={p.entity_id}>
              <button
                type="button"
                className="admin__field-inline-link"
                onClick={() => { onChange([...selected, p]); setQ('') }}
              >
                {p.name} ({p.sku})
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
