import React, { useMemo, useState } from 'react'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import { SplitButton, ThumbnailPlaceholder, Field } from '../../components/catalog/FormControls.jsx'
import { COUNTRY_OPTIONS, countryLabel } from '../../components/catalog/countries.js'
import { useApp } from '../../context/AppContext.jsx'
import { getProducts, stockReservationFor, attributeSetLabel, attrLabel } from '../../utils/selectors.js'
import { staticData as S } from '../../utils/dataManager.js'
import { useSidNavigate } from '../../utils/navigation.js'
import {
  formatCurrency, formatDateTime, productTypeLabel, productStatusLabel, visibilityLabel,
} from '../../utils/formatters.js'

/* ROUTES row 39 — /admin/catalog/product/
 *
 * Column ids are the source's UI-component column names (`entity_id`, `qty`,
 * `attribute_set_id`, …) so `?sorting[field]=qty` matches what an agent would
 * guess from the source's own bookmark payload.
 */

/**
 * Option ORDER is transcribed from the live source's `[name="type_id"]`, not
 * sorted (NEW-DOM-204): `select.options[N]` and `selectedIndex` are real
 * WebArena locators (task 759), so a different order resolves to a different
 * product type.
 */
const TYPE_OPTIONS = [
  { value: 'simple', label: 'Simple Product' },
  { value: 'virtual', label: 'Virtual Product' },
  { value: 'bundle', label: 'Bundle Product' },
  { value: 'downloadable', label: 'Downloadable Product' },
  { value: 'configurable', label: 'Configurable Product' },
  { value: 'grouped', label: 'Grouped Product' },
]

/** Live source `[name="store_id"]` on this grid — filter-only, no column. */
const STORE_OPTIONS = [{ value: '1', label: 'Default Store View' }]

/** Live source `[name="custom_design"]` — the two installed themes. */
const CUSTOM_DESIGN_OPTIONS = [
  { value: '1', label: 'Magento Blank' },
  { value: '3', label: 'Magento Luma' },
]

/**
 * The source's filter-panel field order (its UI-component `filters` fieldset
 * order), which is not the table's column order. Read off the live
 * /admin/catalog/product/ DOM.
 */
const FILTER_ORDER = [
  'entity_id', 'price', 'qty', 'updated_at', 'store_id', 'name', 'type_id',
  'attribute_set_id', 'sku', 'visibility', 'status', 'special_price', 'cost',
  'weight', 'manufacturer', 'meta_title', 'meta_keyword', 'meta_description',
  'color', 'custom_design', 'country_of_manufacture', 'url_key', 'msrp',
  'tax_class_id',
]

const VISIBILITY_OPTIONS = [
  { value: '1', label: 'Not Visible Individually' },
  { value: '2', label: 'Catalog' },
  { value: '3', label: 'Search' },
  { value: '4', label: 'Catalog, Search' },
]

const STATUS_OPTIONS = [
  { value: '1', label: 'Enabled' },
  { value: '2', label: 'Disabled' },
]

/** Magento prints product quantities in the grid with four decimals. */
function gridQty(value) {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(value)
  return Number.isNaN(n) ? String(value) : n.toFixed(4)
}

/**
 * "Default Stock: 97". Configurable / grouped / bundle parents carry no stock
 * item of their own, so the source leaves the cell empty — do not synthesise a
 * number for them.
 */
function salableQuantity(row) {
  if (row.type_id !== 'simple' && row.type_id !== 'virtual' && row.type_id !== 'downloadable') return ''
  if (row.salable_quantity === null || row.salable_quantity === undefined) return ''
  // Salable = stock qty minus the units still reserved against open orders,
  // which is why the source shows "Default Stock: 99" on a Quantity of
  // 100.0000 for MT09-XL-Blue (DIFF-002).
  return `Default Stock: ${Number(row.salable_quantity) - stockReservationFor(row.sku)}`
}

export default function ProductGrid() {
  const { state, patchProduct, deleteProducts, addMessage } = useApp()
  const navigate = useSidNavigate()

  // "Update attributes" opens Magento's bulk-attribute form. The source routes
  // it to its own page; the mock keeps it in-page so no route outside
  // ROUTES.md is invented.
  const [bulkIds, setBulkIds] = useState(null)
  const [bulk, setBulk] = useState({ price: '', qty: '', status: '', visibility: '', is_in_stock: '' })

  const rows = useMemo(() => getProducts(state), [state])

  // Magento emits the attribute sets in `sort_order` (= id order:
  // 4 Default, 9 Top, 10 Bottom, 11 Gear, …), NOT alphabetically by label.
  // Verified against the live `[name="attribute_set_id"]` (NEW-DOM-204).
  const attributeSetOptions = useMemo(
    () => Object.entries(S.attributeSets)
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => Number(a.value) - Number(b.value)),
    [])

  const columns = useMemo(() => [
    {
      id: 'entity_id',
      label: 'ID',
      filterType: 'range',
      sortValue: r => r.entity_id,
    },
    {
      id: 'thumbnail',
      label: 'Thumbnail',
      sortable: false,
      filterType: null,
      render: r => <ThumbnailPlaceholder alt={r.name} />,
      exportValue: r => r.thumbnail || '',
      searchValue: () => '',
    },
    {
      id: 'name',
      label: 'Name',
      filterType: 'text',
    },
    {
      id: 'type_id',
      label: 'Type',
      filterType: 'select',
      options: TYPE_OPTIONS,
      render: r => productTypeLabel(r.type_id),
      exportValue: r => productTypeLabel(r.type_id),
      searchValue: r => productTypeLabel(r.type_id),
      sortValue: r => productTypeLabel(r.type_id),
    },
    {
      id: 'attribute_set_id',
      label: 'Attribute Set',
      filterType: 'select',
      // F-05 / NEW-DOM-201 — this is the one filter the source dresses in the
      // `admin__action-multiselect` ui-select (search box + Done button). The
      // source keeps the plain `<select name="attribute_set_id">` underneath as
      // the model, so the mock renders both and the two hooks
      // (`advanced-select-search`, `close-advanced-select`) have something real
      // to drive.
      uiSelect: true,
      options: attributeSetOptions,
      render: r => attributeSetLabel(r.attribute_set_id),
      exportValue: r => attributeSetLabel(r.attribute_set_id),
      searchValue: r => attributeSetLabel(r.attribute_set_id),
      sortValue: r => attributeSetLabel(r.attribute_set_id),
    },
    {
      id: 'sku',
      label: 'SKU',
      filterType: 'text',
    },
    {
      id: 'price',
      label: 'Price',
      filterType: 'range',
      render: r => formatCurrency(r.price),
      exportValue: r => formatCurrency(r.price),
      searchValue: r => formatCurrency(r.price),
      sortValue: r => Number(r.price ?? 0),
    },
    {
      id: 'qty',
      label: 'Quantity',
      filterType: 'range',
      render: r => gridQty(r.qty),
      exportValue: r => gridQty(r.qty),
      searchValue: r => gridQty(r.qty),
      sortValue: r => Number(r.qty ?? 0),
    },
    {
      id: 'salable_quantity',
      label: 'Salable Quantity',
      sortable: false,
      filterType: null,
      render: salableQuantity,
      exportValue: salableQuantity,
      searchValue: salableQuantity,
    },
    {
      id: 'visibility',
      label: 'Visibility',
      filterType: 'select',
      options: VISIBILITY_OPTIONS,
      render: r => visibilityLabel(r.visibility),
      exportValue: r => visibilityLabel(r.visibility),
      searchValue: r => visibilityLabel(r.visibility),
      sortValue: r => Number(r.visibility ?? 0),
      filterValue: r => String(r.visibility ?? ''),
    },
    {
      id: 'status',
      label: 'Status',
      filterType: 'select',
      options: STATUS_OPTIONS,
      render: r => productStatusLabel(r.status),
      exportValue: r => productStatusLabel(r.status),
      searchValue: r => productStatusLabel(r.status),
      filterValue: r => String(r.status ?? ''),
    },
    {
      id: 'websites',
      label: 'Websites',
      sortable: false,
      // The source ships this as a column but declares no `websites` filter on
      // this grid — its filter panel exposes `store_id` instead (NEW-DOM-205).
      filterType: null,
      options: [{ value: '1', label: 'Main Website' }],
      render: r => (r.websites || []).length ? 'Main Website' : '',
      exportValue: r => (r.websites || []).length ? 'Main Website' : '',
      searchValue: r => (r.websites || []).length ? 'Main Website' : '',
      filterValue: r => String((r.websites || [])[0] ?? ''),
    },
    {
      id: 'updated_at',
      label: 'Last Updated At',
      filterType: 'date',
      render: r => formatDateTime(r.updated_at),
      exportValue: r => formatDateTime(r.updated_at),
      searchValue: r => formatDateTime(r.updated_at),
      sortValue: r => r.updated_at || '',
    },
    {
      // Filter-only, exactly as the source declares it: a `<select
      // name="store_id">` in the filters fieldset with no matching table column
      // and no Columns-chooser entry (NEW-DOM-205). Its empty option reads
      // "All Store Views", like the Orders grid's Purchase Point filter.
      id: 'store_id',
      label: 'Store View',
      filterOnly: true,
      filterType: 'select',
      emptyOptionLabel: 'All Store Views',
      options: STORE_OPTIONS,
      filterValue: r => String((r.websites || [])[0] ?? ''),
      searchValue: () => '',
    },
    /* ---- columns the source ships hidden by default (Columns chooser) ---- */
    {
      id: 'url_key', label: 'URL Key', defaultVisible: false, filterType: 'text',
    },
    {
      id: 'tax_class_id',
      label: 'Tax Class',
      defaultVisible: false,
      filterType: 'select',
      options: [
        { value: '0', label: 'None' },
        { value: '2', label: 'Taxable Goods' },
      ],
      render: r => (Number(r.tax_class_id) === 2 ? 'Taxable Goods' : 'None'),
      exportValue: r => (Number(r.tax_class_id) === 2 ? 'Taxable Goods' : 'None'),
      searchValue: () => '',
      filterValue: r => String(r.tax_class_id ?? ''),
    },
    {
      id: 'color',
      label: 'Color',
      defaultVisible: false,
      filterType: 'select',
      options: Object.entries(S.attributeOptions.color || {}).map(([value, label]) => ({ value, label })),
      render: r => attrLabel('color', r.color),
      exportValue: r => attrLabel('color', r.color),
      searchValue: () => '',
      filterValue: r => String(r.color ?? ''),
    },
    {
      id: 'country_of_manufacture',
      label: 'Country of Manufacture',
      defaultVisible: false,
      // Source renders this as a `<select>` with the full 249-entry Magento
      // country list, not a text box (NEW-DOM-205) — the enumerated vocabulary
      // has to be discoverable from the DOM.
      filterType: 'select',
      options: COUNTRY_OPTIONS.slice(1),
      render: r => countryLabel(r.country_of_manufacture) || '',
      exportValue: r => countryLabel(r.country_of_manufacture) || '',
      searchValue: () => '',
      filterValue: r => String(r.country_of_manufacture ?? ''),
    },
    {
      id: 'gift_message_available',
      label: 'Allow Gift Message',
      defaultVisible: false,
      // Column only — the source declares no `gift_message_available` filter.
      filterType: null,
      options: [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }],
      render: r => (String(r.gift_message_available) === '1' ? 'Yes' : 'No'),
      searchValue: () => '',
      filterValue: r => String(r.gift_message_available ?? ''),
    },
    {
      id: 'special_price',
      label: 'Special Price',
      defaultVisible: false,
      // A SINGLE `<input type="text" name="special_price">` on the source, not
      // a from/to pair — same for cost, weight and msrp (NEW-DOM-205).
      filterType: 'text',
      render: r => (r.special_price == null ? '' : formatCurrency(r.special_price)),
      exportValue: r => (r.special_price == null ? '' : formatCurrency(r.special_price)),
      searchValue: () => '',
      sortValue: r => (r.special_price == null ? -1 : Number(r.special_price)),
    },
    /*
     * The rest of the source's Columns chooser (DIFF-007). The live grid offers
     * 37 columns; these are the ones whose EAV attribute exists on the source
     * product but is unset for most of the catalog, so they render empty there
     * too. They are text/date/range filterable exactly as on the source, and
     * they pick up any value the product form persists.
     */
    { id: 'short_description', label: 'Short Description', defaultVisible: false, filterType: null, render: r => r.short_description || '', searchValue: () => '' },
    {
      id: 'special_from_date',
      label: 'Special Price From Date',
      defaultVisible: false,
      filterType: null,
      render: r => (r.special_from_date ? formatDateTime(r.special_from_date) : ''),
      searchValue: () => '',
      sortValue: r => r.special_from_date || '',
    },
    {
      id: 'special_to_date',
      label: 'Special Price To Date',
      defaultVisible: false,
      filterType: null,
      render: r => (r.special_to_date ? formatDateTime(r.special_to_date) : ''),
      searchValue: () => '',
      sortValue: r => r.special_to_date || '',
    },
    {
      id: 'cost',
      label: 'Cost',
      defaultVisible: false,
      filterType: 'text',
      render: r => (r.cost == null ? '' : formatCurrency(r.cost)),
      searchValue: () => '',
      sortValue: r => (r.cost == null ? -1 : Number(r.cost)),
    },
    {
      id: 'weight',
      label: 'Weight',
      defaultVisible: false,
      filterType: 'text',
      render: r => (r.weight == null ? '' : String(r.weight)),
      searchValue: () => '',
      sortValue: r => (r.weight == null ? -1 : Number(r.weight)),
    },
    {
      // Source: `<select name="manufacturer">` whose only option is the blank
      // one — the attribute has no values in this install (NEW-DOM-205).
      id: 'manufacturer',
      label: 'Manufacturer',
      defaultVisible: false,
      filterType: 'select',
      options: [],
      render: r => r.manufacturer || '',
      searchValue: () => '',
      filterValue: r => String(r.manufacturer ?? ''),
    },
    { id: 'meta_title', label: 'Meta Title', defaultVisible: false, filterType: 'text', render: r => r.meta_title || '', searchValue: () => '' },
    { id: 'meta_keyword', label: 'Meta Keywords', defaultVisible: false, filterType: 'text', render: r => r.meta_keyword || '', searchValue: () => '' },
    { id: 'meta_description', label: 'Meta Description', defaultVisible: false, filterType: 'text', render: r => r.meta_description || '', searchValue: () => '' },
    {
      id: 'news_from_date',
      label: 'Set Product as New from Date',
      defaultVisible: false,
      filterType: null,
      render: r => (r.news_from_date ? formatDateTime(r.news_from_date) : ''),
      searchValue: () => '',
      sortValue: r => r.news_from_date || '',
    },
    {
      id: 'news_to_date',
      label: 'Set Product as New to Date',
      defaultVisible: false,
      filterType: null,
      render: r => (r.news_to_date ? formatDateTime(r.news_to_date) : ''),
      searchValue: () => '',
      sortValue: r => r.news_to_date || '',
    },
    {
      // Source: `<select name="custom_design">` — the installed themes.
      id: 'custom_design',
      label: 'New Theme',
      defaultVisible: false,
      filterType: 'select',
      options: CUSTOM_DESIGN_OPTIONS,
      render: r => CUSTOM_DESIGN_OPTIONS.find(o => o.value === String(r.custom_design))?.label || '',
      searchValue: () => '',
      filterValue: r => String(r.custom_design ?? ''),
    },
    {
      id: 'custom_design_from',
      label: 'Active From',
      defaultVisible: false,
      filterType: null,
      render: r => (r.custom_design_from ? formatDateTime(r.custom_design_from) : ''),
      searchValue: () => '',
      sortValue: r => r.custom_design_from || '',
    },
    {
      id: 'custom_design_to',
      label: 'Active To',
      defaultVisible: false,
      filterType: null,
      render: r => (r.custom_design_to ? formatDateTime(r.custom_design_to) : ''),
      searchValue: () => '',
      sortValue: r => r.custom_design_to || '',
    },
    /* Columns the source's Columns chooser offers but declares NO filter for
       (NEW-DOM-205): filtering them would put selector-visible names in the DOM
       that the source does not have. */
    { id: 'page_layout', label: 'Layout', defaultVisible: false, filterType: null, render: r => r.page_layout || '', searchValue: () => '' },
    { id: 'custom_layout', label: 'New Layout', defaultVisible: false, filterType: null, render: r => r.custom_layout || '', searchValue: () => '' },
    {
      id: 'msrp',
      label: 'Minimum Advertised Price',
      defaultVisible: false,
      filterType: 'text',
      render: r => (r.msrp == null ? '' : formatCurrency(r.msrp)),
      searchValue: () => '',
      sortValue: r => (r.msrp == null ? -1 : Number(r.msrp)),
    },
    {
      id: 'actions',
      label: 'Action',
      sortable: false,
      filterType: null,
      className: 'data-grid-actions-cell',
      render: r => (
        <AdminLink to={`/admin/catalog/product/edit/id/${r.entity_id}/`} aria-label={`Edit ${r.name}`}>
          Edit
        </AdminLink>
      ),
      exportValue: () => 'Edit',
      searchValue: () => '',
    },
  ], [attributeSetOptions])

  const massActions = useMemo(() => [
    {
      id: 'delete',
      label: 'Delete',
      onApply: ids => {
        deleteProducts(ids)
        addMessage(`A total of ${ids.length} record(s) have been deleted.`)
      },
    },
    {
      id: 'status_enable',
      label: 'Change status / Enable',
      onApply: ids => {
        ids.forEach(id => patchProduct(id, { status: 1 }))
        addMessage(`A total of ${ids.length} record(s) have been updated.`)
      },
    },
    {
      id: 'status_disable',
      label: 'Change status / Disable',
      onApply: ids => {
        ids.forEach(id => patchProduct(id, { status: 2 }))
        addMessage(`A total of ${ids.length} record(s) have been updated.`)
      },
    },
    {
      id: 'update_attributes',
      label: 'Update attributes',
      onApply: ids => {
        setBulk({ price: '', qty: '', status: '', visibility: '' })
        setBulkIds(ids)
      },
    },
  ], [deleteProducts, patchProduct, addMessage])

  function applyBulkAttributes(e) {
    e.preventDefault()
    const patch = {}
    if (bulk.price !== '') patch.price = Number(bulk.price)
    if (bulk.qty !== '') { patch.qty = Number(bulk.qty); patch.salable_quantity = Number(bulk.qty) }
    if (bulk.status !== '') patch.status = Number(bulk.status)
    if (bulk.visibility !== '') patch.visibility = Number(bulk.visibility)
    // HANDLERS-022 — "Mark all <product> as out of stock" is the natural bulk
    // path for webarena-501…505.
    if (bulk.is_in_stock !== '') patch.is_in_stock = Number(bulk.is_in_stock)
    if (Object.keys(patch).length) {
      bulkIds.forEach(id => patchProduct(id, patch))
      addMessage(`A total of ${bulkIds.length} record(s) were updated.`)
    }
    setBulkIds(null)
  }

  const actions = (
    <SplitButton
      /* F-07 — the source's id is `add_new_product-button`, with
         `data-ui-id="products-list-add-new-product-button"` on the primary half
         and `…-button-dropdown` on the toggle. */
      id="add_new_product-button"
      dataUiId="products-list-add-new-product-button"
      toggleDataUiId="products-list-add-new-product-button-dropdown"
      label="Add Product"
      onClick={() => navigate('/admin/catalog/product/new/set/4/type/simple/')}
      options={[
        { label: 'Simple Product', onSelect: () => navigate('/admin/catalog/product/new/set/4/type/simple/') },
        { label: 'Configurable Product', onSelect: () => navigate('/admin/catalog/product/new/set/4/type/configurable/') },
        { label: 'Grouped Product', onSelect: () => navigate('/admin/catalog/product/new/set/4/type/grouped/') },
        { label: 'Virtual Product', onSelect: () => navigate('/admin/catalog/product/new/set/4/type/virtual/') },
        { label: 'Bundle Product', onSelect: () => navigate('/admin/catalog/product/new/set/4/type/bundle/') },
        { label: 'Downloadable Product', onSelect: () => navigate('/admin/catalog/product/new/set/4/type/downloadable/') },
      ]}
    />
  )

  return (
    <PageShell title="Products" actions={actions}>
      {bulkIds ? (
        <form className="admin__form-section" onSubmit={applyBulkAttributes}>
          <div className="admin__form-section-title">
            Update Attributes — {bulkIds.length} record(s) selected
          </div>
          <Field label="Price" htmlFor="bulk-price" short>
            <input
              id="bulk-price" className="admin__control-text" type="number" step="0.01"
              value={bulk.price} onChange={e => setBulk(b => ({ ...b, price: e.target.value }))}
            />
          </Field>
          <Field label="Quantity" htmlFor="bulk-qty" short>
            <input
              id="bulk-qty" className="admin__control-text" type="number"
              value={bulk.qty} onChange={e => setBulk(b => ({ ...b, qty: e.target.value }))}
            />
          </Field>
          <Field label="Status" htmlFor="bulk-status" short>
            <select
              id="bulk-status" className="admin__control-select"
              value={bulk.status} onChange={e => setBulk(b => ({ ...b, status: e.target.value }))}
            >
              <option value="">-- Please Select --</option>
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <Field label="Stock Status" htmlFor="bulk-stock-status" short>
            <select
              id="bulk-stock-status" className="admin__control-select"
              value={bulk.is_in_stock} onChange={e => setBulk(b => ({ ...b, is_in_stock: e.target.value }))}
            >
              <option value="">-- Please Select --</option>
              <option value="1">In Stock</option>
              <option value="0">Out of Stock</option>
            </select>
          </Field>
          <Field label="Visibility" htmlFor="bulk-visibility" short>
            <select
              id="bulk-visibility" className="admin__control-select"
              value={bulk.visibility} onChange={e => setBulk(b => ({ ...b, visibility: e.target.value }))}
            >
              <option value="">-- Please Select --</option>
              {VISIBILITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>
          <div className="page-actions">
            <button type="button" className="action-default" onClick={() => setBulkIds(null)}>Cancel</button>
            <button type="submit" className="action-primary">Save</button>
          </div>
        </form>
      ) : null}

      <AdminGrid
        gridId="product_listing"
        rows={rows}
        columns={columns}
        rowKey={r => r.entity_id}
        selectable
        massActions={massActions}
        exportFileName="products"
        // The source's Products listing has no Export control (DIFF-005) —
        // confirmed live: `.admin__data-grid-action-export` does not exist on
        // /admin/catalog/product/, while the Customers listing does have one.
        exportable={false}
        // The bookmark that ships in the WebArena image has the *active* view
        // sorted on Quantity ascending, not the Default View's entity_id
        // (DIFF-001) — confirmed live: `<th class="… _ascend">Quantity`.
        filterOrder={FILTER_ORDER}
        defaultSort={{ field: 'qty', direction: 'asc' }}
        defaultPageSize={20}
      />
    </PageShell>
  )
}
