import React, { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import LegacyAdminGrid from '../../components/grid/LegacyAdminGrid.jsx'
import LegacyGrid from '../../components/reports/LegacyGrid.jsx'
import RecordForm, { useSystemCollection } from '../../components/system/RecordForm.jsx'
import { useApp } from '../../context/AppContext.jsx'
import urlRewriteSeed from '../../data/urlRewrites.json'
import { formatDate } from '../../utils/formatters.js'
import { useSidNavigate } from '../../utils/navigation.js'

/**
 * Marketing — Cart / Catalog Price Rules, Search Terms, Newsletter.
 *
 * Cart-rule save is the one high-value mutation here: tasks 699-703 read the
 * saved rule out of `/go` and match on `"name"`, `"customer_group_ids"`,
 * `"simple_action"` and `"discount_amount"`, so those keys are written exactly
 * as the source's schema names them, and `discount_amount` is stored as the
 * string the DB round-trips.
 */

/* DIFF-R58. Price-rule `from_date`/`to_date` are **calendar dates**
 * (`YYYY-MM-DD`), not instants. `formatDate()` parses a seed value as UTC and
 * renders it in America/New_York, which is right for the order/review
 * timestamps it was written for but shifts a bare date back a day: catalog rule
 * 2's `2023-05-01` printed `Apr 30, 2023` where the source prints
 * `May 1, 2023`. Split the string instead of round-tripping it through a Date,
 * so every rule date — not just rule 2 — is immune. Values that do carry a time
 * component fall through to the timezone-aware formatter. */
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatRuleDate(value) {
  if (!value) return ''
  const m = String(value).trim().match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return formatDate(value)
  return `${MONTH_ABBR[+m[2] - 1]} ${+m[3]}, ${m[1]}`
}

const SIMPLE_ACTIONS = [
  { value: 'by_percent', label: 'Percent of product price discount' },
  { value: 'by_fixed', label: 'Fixed amount discount' },
  { value: 'cart_fixed', label: 'Fixed amount discount for whole cart' },
  { value: 'buy_x_get_y', label: 'Buy X get Y free (discount amount is Y)' },
]

const COUPON_TYPES = [
  { value: '1', label: 'No Coupon' },
  { value: '2', label: 'Specific Coupon' },
]

/* -------------------------------------------------- Cart Price Rules (60) */

export function CartPriceRules() {
  const { state } = useApp()
  const rules = state?.cartPriceRules || []
  const coupons = state?.coupons || []

  const rows = useMemo(() => rules.map(r => ({
    ...r,
    coupon_code: coupons.find(c => String(c.rule_id) === String(r.rule_id))?.code || '',
  })), [rules, coupons])

  /* DIFF-R63. `promo_quote_grid` is a **legacy** `Widget\Grid` on the source, not
     a UI-component grid: its `<thead>` carries a second row of per-column filter
     controls plus `Search` / `Reset Filter`, and there is no
     Filters/Columns/Export toolbar at all. Filter `name`s transcribed live:
     `rule_id · name · coupon_code · from_date[from|to] · to_date[from|to] ·
     is_active("Active","Inactive") · rule_website("Main Website") · sort_order`
     — note the Web Site column filters as `rule_website`, not `website_ids`. */
  const columns = [
    { id: 'rule_id', label: 'ID', filter: 'text', numeric: true, className: 'col-id' },
    {
      id: 'name', label: 'Rule', filter: 'text', searchValue: r => r.name,
      render: r => <AdminLink to={`/admin/sales_rule/promo_quote/edit/id/${r.rule_id}/`}>{r.name}</AdminLink>,
      exportValue: r => r.name,
    },
    { id: 'coupon_code', label: 'Coupon Code', filter: 'text' },
    { id: 'from_date', label: 'Start', filter: 'daterange', render: r => formatRuleDate(r.from_date) },
    {
      id: 'to_date', label: 'End', filter: 'daterange',
      render: r => (r.to_date ? formatRuleDate(r.to_date) : '--'),
    },
    {
      id: 'is_active', label: 'Status', filter: 'select',
      options: [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }],
      render: r => (Number(r.is_active) === 1 ? 'Active' : 'Inactive'),
      filterValue: r => String(r.is_active),
      exportValue: r => (Number(r.is_active) === 1 ? 'Active' : 'Inactive'),
    },
    {
      id: 'website_ids', label: 'Web Site', sortable: false,
      filter: 'select', filterId: 'rule_website',
      options: [{ value: '1', label: 'Main Website' }],
      filterValue: () => '1',
      render: () => 'Main Website', exportValue: () => 'Main Website',
    },
    { id: 'sort_order', label: 'Priority', filter: 'text' },
  ]

  const actions = (
    <AdminLink to="/admin/sales_rule/promo_quote/new/" className="action-default primary" id="add"
      data-ui-id="adminhtml-block-promo-quote-grid-container-add-button">
      <span>Add New Rule</span>
    </AdminLink>
  )

  return (
    <PageShell title="Cart Price Rules" actions={actions}>
      {/* The source renders no `Export to:` control on this grid, and numbers its
          two filter buttons `widget-button-0` (Reset Filter) / `-1` (Search). */}
      {/* The cold-load sort is the source's, measured live: `Priority` carries
        * `_ascend` on `/admin/sales_rule/promo_quote/index/`, not `ID`. Every
        * seeded rule has sort_order 0, so the rows themselves come out
        * 1 · 2 · 3 · 4 either way — what was wrong was the indicator and the
        * state the pager and Reset Filter carry forward. */}
      <LegacyGrid gridId="promo_quote_grid" basePath="/admin/sales_rule/promo_quote/index"
        rows={rows} columns={columns} rowKey={r => r.rule_id}
        defaultSort="sort_order" defaultDir="asc" exportable={false}
        widgetButtonIds={{ reset: 'widget-button-0', search: 'widget-button-1' }}
        rowHref={r => `/admin/sales_rule/promo_quote/edit/id/${r.rule_id}/`} />
    </PageShell>
  )
}

/* ----------------------------------------- Cart Price Rule new / edit (61-63) */

const BLANK_RULE = {
  name: '',
  description: '',
  is_active: '1',
  /* G-03. The source's New Cart Price Rule form leaves Websites unselected and
   * Priority empty (`website_ids` value `""`, `sort_order` value `""`); the mock
   * used to pre-fill `['1']` / `'0'`, which is invented default data. */
  website_ids: [],
  customer_group_ids: [],
  coupon_type: '1',
  coupon_code: '',
  use_auto_generation: false,
  uses_per_coupon: '',
  uses_per_customer: '',
  is_rss: true,
  from_date: '',
  to_date: '',
  sort_order: '',
  simple_action: 'by_percent',
  discount_amount: '',
  discount_qty: '',
  discount_step: '',
  apply_to_shipping: '0',
  stop_rules_processing: '0',
  simple_free_shipping: '0',
  store_labels: '',
}

/**
 * The saved rule → form mapping, shared by the initial state and Reset so the
 * two cannot drift (HANDLERS-012: Reset used to copy the edited form onto
 * itself, which reverted nothing).
 */
function formFromRule(existing, existingCoupon) {
  if (!existing) return BLANK_RULE
  return {
    ...BLANK_RULE,
    name: existing.name ?? '',
    description: existing.description ?? '',
    is_active: String(existing.is_active ?? 1),
    website_ids: (existing.website_ids || [1]).map(String),
    customer_group_ids: (existing.customer_group_ids || []).map(String),
    coupon_type: String(existing.coupon_type ?? 1),
    coupon_code: existingCoupon?.code ?? '',
    use_auto_generation: Number(existing.use_auto_generation ?? 0) === 1,
    uses_per_coupon: String(existing.uses_per_coupon ?? ''),
    uses_per_customer: String(existing.uses_per_customer ?? ''),
    is_rss: Number(existing.is_rss ?? 1) === 1,
    from_date: existing.from_date ?? '',
    to_date: existing.to_date ?? '',
    sort_order: String(existing.sort_order ?? 0),
    simple_action: existing.simple_action ?? 'by_percent',
    discount_amount: String(existing.discount_amount ?? ''),
  }
}

export function CartPriceRuleForm() {
  const { id } = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const groups = state?.customerGroups || []
  const existing = id ? (state?.cartPriceRules || []).find(r => String(r.rule_id) === String(id)) : null
  const existingCoupon = existing
    ? (state?.coupons || []).find(c => String(c.rule_id) === String(existing.rule_id))
    : null

  const [form, setForm] = useState(() => formFromRule(existing, existingCoupon))

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function save(keepEditing) {
    if (!form.name.trim()) {
      addMessage('This is a required field.', 'error')
      return
    }
    // Schema keys and value types copied from the source's `salesrule` table so
    // the evaluator's JSON match works verbatim.
    const record = {
      rule_id: existing ? existing.rule_id : nextRuleId(state),
      name: form.name,
      description: form.description,
      from_date: form.from_date || null,
      to_date: form.to_date || null,
      uses_per_customer: Number(form.uses_per_customer) || 0,
      is_active: Number(form.is_active),
      conditions_serialized: existing?.conditions_serialized ?? '',
      actions_serialized: existing?.actions_serialized ?? '',
      stop_rules_processing: Number(form.stop_rules_processing),
      sort_order: Number(form.sort_order) || 0,
      simple_action: form.simple_action,
      discount_amount: String(form.discount_amount === '' ? '0' : form.discount_amount),
      discount_qty: form.discount_qty === '' ? null : Number(form.discount_qty),
      discount_step: Number(form.discount_step) || 0,
      apply_to_shipping: Number(form.apply_to_shipping),
      simple_free_shipping: String(form.simple_free_shipping),
      customer_group_ids: form.customer_group_ids.map(Number).sort((a, b) => a - b),
      website_ids: form.website_ids.map(Number),
      coupon_type: Number(form.coupon_type),
      // DOM-105: the four Rule Information controls the form was not rendering
      // at all. They are `salesrule` columns, so they round-trip like the rest.
      use_auto_generation: form.use_auto_generation ? 1 : 0,
      uses_per_coupon: Number(form.uses_per_coupon) || 0,
      is_rss: form.is_rss ? 1 : 0,
      is_advanced: existing?.is_advanced ?? 1,
      product_ids: existing?.product_ids ?? null,
      times_used: existing?.times_used ?? 0,
      store_labels: form.store_labels ? [form.store_labels] : (existing?.store_labels ?? []),
      coupons: existing?.coupons ?? [],
    }

    setState(prev => {
      const list = prev.cartPriceRules || []
      const nextRules = existing
        ? list.map(r => (String(r.rule_id) === String(existing.rule_id) ? record : r))
        : [...list, record]
      let nextCoupons = prev.coupons || []
      if (Number(form.coupon_type) === 2 && form.coupon_code.trim()) {
        const withoutOld = nextCoupons.filter(c => String(c.rule_id) !== String(record.rule_id))
        nextCoupons = [...withoutOld, {
          coupon_id: (nextCoupons.reduce((m, c) => Math.max(m, c.coupon_id), 0) || 0) + 1,
          rule_id: record.rule_id,
          code: form.coupon_code.trim(),
          usage_limit: null,
          usage_per_customer: Number(form.uses_per_customer) || null,
          times_used: 0,
          expiration_date: record.to_date,
          is_primary: 1,
          created_at: null,
          type: 0,
        }]
      }
      return { ...prev, cartPriceRules: nextRules, coupons: nextCoupons }
    })

    addMessage('You saved the rule.')
    /* Save and Continue Edit persists and stays on the form. */
    if (!keepEditing) navigate('/admin/sales_rule/promo_quote/')
  }

  function remove() {
    setState(prev => ({
      ...prev,
      cartPriceRules: (prev.cartPriceRules || []).filter(r => String(r.rule_id) !== String(id)),
      coupons: (prev.coupons || []).filter(c => String(c.rule_id) !== String(id)),
    }))
    addMessage('You deleted the rule.')
    navigate('/admin/sales_rule/promo_quote/')
  }

  /* G-01 class. Every action button on the source's Cart Price Rule toolbar
   * carries a bare `data-ui-id` (`save-button`, `back-button`, …) and the
   * delete button's id is `delete`, not the mock's invented `rule_delete`;
   * `#save_and_continue` was missing outright. This is ROUTES 61/62/63 —
   * the P0 route family behind tasks 699-703. */
  const actions = (
    <>
      <button type="button" id="back" data-ui-id="back-button"
        className="action-default scalable back"
        onClick={() => navigate('/admin/sales_rule/promo_quote/')}><span>Back</span></button>
      {existing ? (
        <button type="button" id="delete" data-ui-id="delete-button"
          className="action-default scalable delete" onClick={remove}>
          <span>Delete</span>
        </button>
      ) : null}
      <button type="button" id="reset" data-ui-id="reset-button" className="action-default scalable"
        onClick={() => setForm(formFromRule(existing, existingCoupon))}><span>Reset</span></button>
      <button type="button" id="save_and_continue" data-ui-id="save-and-continue-button"
        className="action-default scalable" onClick={() => save(true)}>
        <span>Save and Continue Edit</span>
      </button>
      <button type="button" id="save" data-ui-id="save-button"
        className="action-default scalable primary save" onClick={() => save(false)}>
        <span>Save</span>
      </button>
    </>
  )

  /**
   * DOM-105. The multiselects used to render with no `name` and no `id` — the
   * wrapping div carried the id — so `[name="customer_group_ids"]` resolved to
   * null and tasks 699-703 had no control to drive. The source renders
   * `<select multiple class="admin__control-multiselect" name="<field>"
   * id="<hash>" size="6">` with `data-title` on every option; the id is a
   * per-request knockout hash there, so the mock pins it to the field name.
   */
  const multi = (name, value, onChange, options) => (
    <select multiple id={name} name={name} size={6} className="admin__control-multiselect"
      value={value} onChange={e => onChange([...e.target.selectedOptions].map(o => o.value))}>
      {options}
    </select>
  )

  return (
    <PageShell title={existing ? existing.name : 'New Cart Price Rule'} actions={actions}>
      <form id="promo_quote_form" onSubmit={e => { e.preventDefault(); save() }}>
        <fieldset className="admin__fieldset" id="rule_information">
          <legend className="admin__legend"><span>Rule Information</span></legend>

          <div className="admin__field _required" data-index="name">
            <label className="admin__field-label" htmlFor="rule_name"><span>Rule Name</span></label>
            <div className="admin__field-control">
              <input id="rule_name" name="name" type="text" className="admin__control-text"
                value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
          </div>

          <div className="admin__field" data-index="description">
            <label className="admin__field-label" htmlFor="rule_description"><span>Description</span></label>
            <div className="admin__field-control">
              <textarea id="rule_description" name="description" rows={4} className="admin__control-textarea"
                value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>

          {/* G-03. The source renders Active as `<input type="checkbox"
            * class="admin__actions-switch-checkbox" name="is_active" value="1">`,
            * the same switcher as `is_rss` below — not a Yes/No select. The mock
            * rendered a `<select>`, so `page.check('#is_active')` raised
            * "Not a checkbox or radio button" on ROUTES 61/62/63 (tasks 699-703).
            * `value` tracks the state exactly as the source's knockout binding
            * does (`value: value`): checked -> "1", unchecked -> "0". */}
          <div className="admin__field _required" data-index="is_active">
            <label className="admin__field-label" htmlFor="is_active"><span>Active</span></label>
            <div className="admin__field-control">
              <div className="admin__actions-switch">
                <input id="is_active" name="is_active" type="checkbox"
                  className="admin__actions-switch-checkbox"
                  value={form.is_active === '1' ? '1' : '0'}
                  checked={form.is_active === '1'}
                  onChange={e => set('is_active', e.target.checked ? '1' : '0')} />
                <label className="admin__actions-switch-label" htmlFor="is_active" />
              </div>
            </div>
          </div>

          <div className="admin__field _required" data-index="website_ids">
            <label className="admin__field-label" htmlFor="website_ids"><span>Websites</span></label>
            <div className="admin__field-control">
              {multi('website_ids', form.website_ids, v => set('website_ids', v), (
                <option data-title="Main Website" value="1">Main Website</option>
              ))}
            </div>
          </div>

          <div className="admin__field _required" data-index="customer_group_ids">
            <label className="admin__field-label" htmlFor="customer_group_ids"><span>Customer Groups</span></label>
            <div className="admin__field-control">
              {multi('customer_group_ids', form.customer_group_ids, v => set('customer_group_ids', v),
                groups.map(g => (
                  <option key={g.customer_group_id} data-title={g.customer_group_code}
                    value={String(g.customer_group_id)}>
                    {g.customer_group_code}
                  </option>
                )))}
            </div>
          </div>

          <div className="admin__field _required" data-index="coupon_type">
            <label className="admin__field-label" htmlFor="coupon_type"><span>Coupon</span></label>
            <div className="admin__field-control">
              <select id="coupon_type" name="coupon_type" className="admin__control-select"
                value={form.coupon_type} onChange={e => set('coupon_type', e.target.value)}>
                {COUPON_TYPES.map(o => (
                  <option key={o.value} data-title={o.label} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* DOM-105. The source keeps Coupon Code / Use Auto Generation /
            * Uses per Coupon in the DOM at all times and only hides the rows
            * while `coupon_type` is "No Coupon", so the controls stay
            * addressable by name exactly as they are on the source. */}
          <div className="admin__field _required" data-index="coupon_code"
            style={String(form.coupon_type) === '2' ? undefined : { display: 'none' }}>
            <label className="admin__field-label" htmlFor="coupon_code"><span>Coupon Code</span></label>
            <div className="admin__field-control">
              <input id="coupon_code" name="coupon_code" type="text" maxLength={255}
                className="admin__control-text"
                value={form.coupon_code} onChange={e => set('coupon_code', e.target.value)} />
            </div>
          </div>

          <div className="admin__field" data-index="use_auto_generation"
            style={String(form.coupon_type) === '2' ? undefined : { display: 'none' }}>
            <label className="admin__field-label" htmlFor="use_auto_generation"><span /></label>
            <div className="admin__field-control">
              <label className="admin__field-option" htmlFor="use_auto_generation">
                <input id="use_auto_generation" name="use_auto_generation" type="checkbox"
                  className="admin__control-checkbox" value="0"
                  checked={form.use_auto_generation}
                  onChange={e => set('use_auto_generation', e.target.checked)} />
                <span>Use Auto Generation</span>
              </label>
            </div>
          </div>

          <div className="admin__field" data-index="uses_per_coupon"
            style={String(form.coupon_type) === '2' ? undefined : { display: 'none' }}>
            <label className="admin__field-label" htmlFor="uses_per_coupon"><span>Uses per Coupon</span></label>
            <div className="admin__field-control">
              <input id="uses_per_coupon" name="uses_per_coupon" type="text" maxLength={255}
                className="admin__control-text"
                value={form.uses_per_coupon} onChange={e => set('uses_per_coupon', e.target.value)} />
            </div>
          </div>

          <div className="admin__field" data-index="uses_per_customer">
            <label className="admin__field-label" htmlFor="uses_per_customer"><span>Uses per Customer</span></label>
            <div className="admin__field-control">
              <input id="uses_per_customer" name="uses_per_customer" type="text" maxLength={255}
                className="admin__control-text"
                value={form.uses_per_customer} onChange={e => set('uses_per_customer', e.target.value)} />
            </div>
          </div>

          <div className="admin__field" data-index="from_date">
            <label className="admin__field-label" htmlFor="from_date"><span>From</span></label>
            <div className="admin__field-control">
              <input id="from_date" name="from_date" type="text" className="admin__control-text input-date"
                value={form.from_date || ''} onChange={e => set('from_date', e.target.value)} />
            </div>
          </div>

          <div className="admin__field" data-index="to_date">
            <label className="admin__field-label" htmlFor="to_date"><span>To</span></label>
            <div className="admin__field-control">
              <input id="to_date" name="to_date" type="text" className="admin__control-text input-date"
                value={form.to_date || ''} onChange={e => set('to_date', e.target.value)} />
            </div>
          </div>

          <div className="admin__field" data-index="sort_order">
            <label className="admin__field-label" htmlFor="sort_order"><span>Priority</span></label>
            <div className="admin__field-control">
              <input id="sort_order" name="sort_order" type="text" className="admin__control-text"
                value={form.sort_order} onChange={e => set('sort_order', e.target.value)} />
            </div>
          </div>

          {/* DOM-105. Source: `<input type="checkbox"
            * class="admin__actions-switch-checkbox" name="is_rss" value="1">`
            * under the label "Public In RSS Feed", last field of the fieldset. */}
          <div className="admin__field" data-index="is_rss">
            <label className="admin__field-label" htmlFor="is_rss"><span>Public In RSS Feed</span></label>
            <div className="admin__field-control">
              <div className="admin__actions-switch">
                <input id="is_rss" name="is_rss" type="checkbox" value="1"
                  className="admin__actions-switch-checkbox"
                  checked={form.is_rss} onChange={e => set('is_rss', e.target.checked)} />
                <label className="admin__actions-switch-label" htmlFor="is_rss" />
              </div>
            </div>
          </div>
        </fieldset>

        <fieldset className="admin__fieldset" id="rule_actions">
          <legend className="admin__legend"><span>Actions</span></legend>

          <div className="admin__field">
            <label className="admin__field-label" htmlFor="simple_action"><span>Apply</span></label>
            <div className="admin__field-control">
              <select id="simple_action" name="simple_action" className="admin__control-select"
                value={form.simple_action} onChange={e => set('simple_action', e.target.value)}>
                {SIMPLE_ACTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="discount_amount"><span>Discount Amount</span></label>
            <div className="admin__field-control">
              <input id="discount_amount" name="discount_amount" type="text" className="admin__control-text"
                value={form.discount_amount} onChange={e => set('discount_amount', e.target.value)} />
            </div>
          </div>

          <div className="admin__field">
            <label className="admin__field-label" htmlFor="discount_qty">
              <span>Maximum Qty Discount is Applied To</span>
            </label>
            <div className="admin__field-control">
              <input id="discount_qty" name="discount_qty" type="text" className="admin__control-text"
                value={form.discount_qty} onChange={e => set('discount_qty', e.target.value)} />
            </div>
          </div>

          <div className="admin__field">
            <label className="admin__field-label" htmlFor="discount_step"><span>Discount Qty Step (Buy X)</span></label>
            <div className="admin__field-control">
              <input id="discount_step" name="discount_step" type="text" className="admin__control-text"
                value={form.discount_step} onChange={e => set('discount_step', e.target.value)} />
            </div>
          </div>

          <div className="admin__field">
            <label className="admin__field-label" htmlFor="apply_to_shipping">
              <span>Apply to Shipping Amount</span>
            </label>
            <div className="admin__field-control">
              <select id="apply_to_shipping" name="apply_to_shipping" className="admin__control-select"
                value={form.apply_to_shipping} onChange={e => set('apply_to_shipping', e.target.value)}>
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </div>
          </div>

          <div className="admin__field">
            <label className="admin__field-label" htmlFor="stop_rules_processing">
              <span>Discard subsequent rules</span>
            </label>
            <div className="admin__field-control">
              <select id="stop_rules_processing" name="stop_rules_processing" className="admin__control-select"
                value={form.stop_rules_processing} onChange={e => set('stop_rules_processing', e.target.value)}>
                <option value="1">Yes</option>
                <option value="0">No</option>
              </select>
            </div>
          </div>

          <div className="admin__field">
            <label className="admin__field-label" htmlFor="simple_free_shipping"><span>Free Shipping</span></label>
            <div className="admin__field-control">
              <select id="simple_free_shipping" name="simple_free_shipping" className="admin__control-select"
                value={form.simple_free_shipping} onChange={e => set('simple_free_shipping', e.target.value)}>
                <option value="0">No</option>
                <option value="1">For matching items only</option>
                <option value="2">For shipment with matching items</option>
              </select>
            </div>
          </div>
        </fieldset>

        <fieldset className="admin__fieldset" id="rule_labels">
          <legend className="admin__legend"><span>Labels</span></legend>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="store_labels"><span>Default Rule Label for All Store Views</span></label>
            <div className="admin__field-control">
              <input id="store_labels" name="store_labels[0]" type="text" className="admin__control-text"
                value={form.store_labels} onChange={e => set('store_labels', e.target.value)} />
            </div>
          </div>
        </fieldset>
      </form>
    </PageShell>
  )
}

function nextRuleId(state) {
  return (state?.cartPriceRules || []).reduce((m, r) => Math.max(m, Number(r.rule_id) || 0), 0) + 1
}

/* ------------------------------------------------ Catalog Price Rules (64) */

export function CatalogPriceRules() {
  const { state, setState, addMessage } = useApp()
  const rows = state?.catalogPriceRules || []

  /**
   * PIPELINE-005 — "Apply Rules" used to print `Updated rules applied.` and
   * change nothing. The source's `catalogrule_apply_all` job stamps every
   * active rule's `applied_at` (and refreshes `catalogrule_product_price`), so
   * the button now writes that stamp: an empty diff on a success message is a
   * false success. With no active rule there is nothing to apply, and the
   * message says so rather than claiming a change.
   */
  function applyRules() {
    const active = rows.filter(r => Number(r.is_active) === 1)
    if (!active.length) {
      addMessage('There are no active catalog price rules to apply.', 'notice')
      return
    }
    const appliedAt = new Date().toISOString().slice(0, 19).replace('T', ' ')
    setState(prev => ({
      ...prev,
      catalogPriceRules: (prev.catalogPriceRules || []).map(r => (
        Number(r.is_active) === 1 ? { ...r, applied_at: appliedAt } : r)),
    }))
    addMessage('Updated rules applied.')
  }

  /* DIFF-R63 — same legacy-grid story as Cart Price Rules; the source's filter
     row here is `rule_id · name · from_date · to_date · is_active · rule_website`
     (no coupon code, no priority column). */
  const columns = [
    { id: 'rule_id', label: 'ID', filter: 'text', numeric: true, className: 'col-id' },
    {
      id: 'name', label: 'Rule', filter: 'text', searchValue: r => r.name,
      render: r => <AdminLink to={`/admin/catalog_rule/promo_catalog/edit/id/${r.rule_id}/`}>{r.name}</AdminLink>,
      exportValue: r => r.name,
    },
    { id: 'from_date', label: 'Start', filter: 'daterange', render: r => formatRuleDate(r.from_date) },
    {
      id: 'to_date', label: 'End', filter: 'daterange',
      render: r => (r.to_date ? formatRuleDate(r.to_date) : '--'),
    },
    {
      id: 'is_active', label: 'Status', filter: 'select',
      options: [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }],
      render: r => (Number(r.is_active) === 1 ? 'Active' : 'Inactive'),
      filterValue: r => String(r.is_active),
      exportValue: r => (Number(r.is_active) === 1 ? 'Active' : 'Inactive'),
    },
    {
      id: 'website_ids', label: 'Web Site', sortable: false,
      filter: 'select', filterId: 'rule_website',
      options: [{ value: '1', label: 'Main Website' }],
      filterValue: () => '1',
      render: () => 'Main Website', exportValue: () => 'Main Website',
    },
  ]
  /* F-07 — source ids/`data-ui-id`s: `add` /
     `adminhtml-promo-catalog-grid-container-add-button`, `apply_rules` /
     `adminhtml-promo-catalog-grid-container-apply-rules-button`, in that order. */
  const actions = (
    <>
      <AdminLink to="/admin/catalog_rule/promo_catalog/new/" className="action-default primary" id="add"
        data-ui-id="adminhtml-promo-catalog-grid-container-add-button">
        <span>Add New Rule</span>
      </AdminLink>
      <button type="button" id="apply_rules" className="action-default scalable"
        data-ui-id="adminhtml-promo-catalog-grid-container-apply-rules-button"
        onClick={applyRules}><span>Apply Rules</span></button>
    </>
  )
  return (
    <PageShell title="Catalog Price Rule" actions={actions}>
      {/* Source cold load carries `_ascend` on `Rule` (the `name` column), not
        * on `ID` — measured live on `/admin/catalog_rule/promo_catalog/index/`,
        * where the rows are `20% off all Women's and Men's Pants` then
        * `Spring sale`. */}
      <LegacyGrid gridId="promo_catalog_grid" basePath="/admin/catalog_rule/promo_catalog/index"
        rows={rows} columns={columns} rowKey={r => r.rule_id}
        defaultSort="name" defaultDir="asc" exportable={false}
        widgetButtonIds={{ reset: 'widget-button-0', search: 'widget-button-1' }}
        rowHref={r => `/admin/catalog_rule/promo_catalog/edit/id/${r.rule_id}/`} />
    </PageShell>
  )
}

/* ------------------------------------------------------- Search Terms (70) */

const STORE_VIEW = 'Default Store View'

function searchTermColumns(withId = true) {
  const cols = [
    {
      id: 'query_id', label: 'ID', filterType: 'text', sortValue: r => Number(r.query_id),
      render: r => <AdminLink to={`/admin/search/term/edit/id/${r.query_id}/`}>{r.query_id}</AdminLink>,
      exportValue: r => r.query_id,
    },
    { id: 'query_text', label: 'Search Query', filterType: 'text', searchValue: r => r.query_text },
    {
      id: 'store_id', label: 'Store', filterType: 'select',
      options: [{ value: '1', label: STORE_VIEW }],
      // Source markup for a store-view cell, verbatim (search-term-report.html):
      // `Main Website<br/>&nbsp;&nbsp;&nbsp;Main Website Store<br/>&nbsp;&nbsp;
      // &nbsp;&nbsp;&nbsp;&nbsp;Default Store View<br/>` — three indented lines.
      // Inline <span>s ran the three names together in innerText, which is what
      // an agent reading the accessibility tree sees.
      render: () => (
        <>
          Main Website<br />
          {'\u00a0\u00a0\u00a0'}Main Website Store<br />
          {'\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0'}{STORE_VIEW}<br />
        </>
      ),
      filterValue: r => String(r.store_id),
      exportValue: () => STORE_VIEW,
    },
    { id: 'num_results', label: 'Results', filterType: 'range', sortValue: r => Number(r.num_results) },
    { id: 'popularity', label: 'Uses', filterType: 'range', sortValue: r => Number(r.popularity) },
  ]
  return withId ? cols : cols.slice(1)
}

/**
 * The Search Terms grid (70) and the Search Terms Report (72) are two different
 * Magento grids over the same table and do NOT share a column set:
 *   search_term_grid_table  : [x] Search Query · Store · Results · Uses ·
 *                             Redirect URL · Suggested Terms · Action
 *   search_term_report_grid : ID · Search Query · Store · Results · Hits
 * (`assets/html/search-term.html` vs `assets/html/search-term-report.html`).
 */
/**
 * Legacy-vs-modern classification. `search_term_grid` is a LEGACY grid on the
 * source, not a UI component. Measured live at `/admin/search/term/`:
 *
 *   thead row 1  (empty) · Search Query · Store · Results · Uses ·
 *                Redirect URL · Suggested Terms · Action      — 8 cells, and the
 *                FIRST one is EMPTY, not `Options`
 *   thead row 2  [massaction ▾ Any/Yes/No] [search_query] [store_id ▾]
 *                [num_results[from]][num_results[to]]
 *                [popularity[from]][popularity[to]] [redirect]
 *                [display_in_terms ▾ Yes/No] (empty under Action)
 *   `Search` + `Reset Filter`, the Delete massaction, `7 records found`,
 *   and NO Export block.
 *
 * `data-column` names are the source's own — the Search Query column is
 * `search_query` here even though the Search Terms *Report* grid names the same
 * field `query_text`. Row `title` is the edit URL; the Action cell repeats it.
 */
function searchTermGridColumns() {
  // searchTermColumns(true) = [query_id, query_text, store_id, num_results, popularity]
  const [, , store, results, uses] = searchTermColumns(true)
  return [
    {
      id: 'search_query', label: 'Search Query', className: 'col-search_query', filter: 'text',
      value: r => r.query_text, searchValue: r => r.query_text,
    },
    /* F-01f. The two Search Terms routes disagree on the store filter's
       sentinel, so this one has to spell its own. Measured live:
         /admin/search/term/index/   <option value="" selected></option>
         /admin/search/term/report/  <option value="0">All Store Views</option>
       (the report grid, below, keeps the default). Without this
       `select_option('[name="store_id"]', '')` raised on the mock and passed on
       the source. */
    {
      ...store, className: 'col-store_id', filter: 'store', sortable: false,
      emptyOptionValue: '', emptyOptionLabel: '',
    },
    { ...results, className: 'col-num_results col-number', filter: 'range', numeric: true },
    { ...uses, className: 'col-popularity col-number', filter: 'range', numeric: true },
    {
      id: 'redirect', label: 'Redirect URL', className: 'col-redirect', filter: 'text',
      render: r => r.redirect || ' ',
    },
    {
      id: 'display_in_terms', label: 'Suggested Terms', className: 'col-display_in_terms', filter: 'select',
      options: [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }],
      render: r => (Number(r.display_in_terms) === 1 ? 'Yes' : 'No'),
      filterValue: r => String(Number(r.display_in_terms) === 1 ? 1 : 0),
      exportValue: r => (Number(r.display_in_terms) === 1 ? 'Yes' : 'No'),
    },
    {
      id: 'action', label: 'Action', sortable: false, filter: 'none', className: 'col-action',
      render: r => <AdminLink to={`/admin/search/term/edit/id/${r.query_id}/`}>Edit</AdminLink>,
      exportValue: () => 'Edit',
    },
  ]
}

export function SearchTerms() {
  const { state, setState, addMessage } = useApp()
  /* The source cold-loads this grid in `query_id` ascending order (Joust Bag ·
   * MT02-M-Gray · WP10 · hollister · Antonia Racer Tank · nike · tanks) — the
   * exact reverse of the Search Terms Report's `query_id desc`. There is no ID
   * column to hang a `defaultSort` on, so the order is applied to the rows. */
  const rows = useMemo(
    () => [...(state?.searchTerms || [])].sort((a, b) => Number(a.query_id) - Number(b.query_id)),
    [state],
  )
  const actions = (
    <AdminLink to="/admin/search/term/new/" className="action-default primary" id="add"
      data-ui-id="adminhtml-search-term-grid-container-add-button">
      <span>Add New Search Term</span>
    </AdminLink>
  )
  /* The source grid ships exactly one mass action: Delete. */
  const massActions = [{
    id: 'delete',
    label: 'Delete',
    onApply: ids => {
      const keys = ids.map(String)
      setState(prev => ({
        ...prev,
        searchTerms: (prev.searchTerms || []).filter(t => !keys.includes(String(t.query_id))),
      }))
      addMessage(`A total of ${ids.length} record(s) have been deleted.`)
    },
  }]
  return (
    <PageShell title="Search Terms" actions={actions}>
      {/* F-07 — `Add New Search Term` is the container's button, so the grid's
          own Reset Filter / Search are `widget-button-1` / `widget-button-2`. */}
      <LegacyGrid gridId="search_term_grid" basePath="/admin/search/term/index"
        rows={rows} columns={searchTermGridColumns()} rowKey={r => r.query_id}
        rowHref={r => `/admin/search/term/edit/id/${r.query_id}/`}
        massActions={massActions} massActionFilter rowSelectName="search"
        exportable={false}
        widgetButtonIds={{ reset: 'widget-button-1', search: 'widget-button-2' }} />
    </PageShell>
  )
}

/**
 * Search Terms Report (72) — same rows as the Search Terms grid, but the "Uses"
 * column is labelled **Hits**. The default sort is **ID descending** with no
 * sort arrow on Hits, verified against the live source: `tanks`, `nike`,
 * `Antonia Racer Tank`, `hollister`, `WP10`, `MT02-M-Gray`, `Joust Bag`. Tasks
 * 41-43 ("top N search terms") therefore require the agent to click **Hits** on
 * the source, and must require it here too.
 */
export function SearchTermsReport() {
  const { state } = useApp()
  const rows = state?.searchTerms || []
  /* DIFF-R60 / TODO legacy-grid generalisation. `assets/html/search-term-report.html`
   * shows `searchReportGrid` as a LEGACY grid: `Export to:` + Search /
   * Reset Filter, and an in-`<thead>` filter row — no control under ID, a text
   * `query_text`, the store-view select, and `num_results[from]/[to]` +
   * `popularity[from]/[to]` ranges. Store is the only unsortable column
   * (`no-link`); ID carries `_descend` on cold load. Rows are not links on the
   * source — the whole `<tr>` carries `title="<edit url>"` and navigates. */
  const columns = [
    { id: 'query_id', label: 'ID', className: 'col-id', filter: 'none', numeric: true },
    { id: 'query_text', label: 'Search Query', className: 'col-query', filter: 'text' },
    {
      id: 'store_id', label: 'Store', className: 'col-store', filter: 'store', sortable: false,
      // Source markup for a store-view cell, verbatim (search-term-report.html):
      // `Main Website<br/>&nbsp;&nbsp;&nbsp;Main Website Store<br/>&nbsp;&nbsp;
      // &nbsp;&nbsp;&nbsp;&nbsp;Default Store View<br/>` — three indented lines.
      render: () => (
        <>
          Main Website<br />
          {'   '}Main Website Store<br />
          {'      '}{STORE_VIEW}<br />
        </>
      ),
      exportValue: () => STORE_VIEW,
    },
    { id: 'num_results', label: 'Results', className: 'col-results', filter: 'range', numeric: true },
    { id: 'popularity', label: 'Hits', className: 'col-hits', filter: 'range', numeric: true },
  ]
  return (
    <PageShell title="Search Terms Report">
      <LegacyGrid gridId="searchReportGrid" basePath="/admin/search/term/report"
        rows={rows} columns={columns} rowKey={r => r.query_id}
        rowHref={r => `/admin/search/term/edit/id/${r.query_id}/`}
        defaultSort="query_id" defaultDir="desc" exportFileName="search_terms_report"
        exportPaths={{
          csv: '/admin/search/term/exportSearchCsv/',
          xml: '/admin/search/term/exportSearchExcel/',
        }}
        widgetButtonIds={{ export: 'widget-button-0', reset: 'widget-button-1', search: 'widget-button-2' }} />
    </PageShell>
  )
}

export function SearchTermEdit() {
  const { id } = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const term = id ? (state?.searchTerms || []).find(t => String(t.query_id) === String(id)) : null

  /* DIFF-R29. Field set transcribed from `assets/html/search-term-edit.html`
   * (`/admin/search/term/edit/id/1/`, the `Joust Bag` term):
   *   query_id (hidden) · query_text · store_id · num_results · popularity ·
   *   redirect · display_in_terms
   * `num_results` (the grid's Results) and `popularity` (Uses / Hits) are the
   * numbers the search-term tasks read, and the source makes both editable
   * here. There is no `synonym_for` field on the source — that was invented.
   * The `<legend>` is empty on the source, so it stays empty here. */
  const initial = () => ({
    query_text: term?.query_text ?? '',
    store_id: String(term?.store_id ?? 1),
    num_results: String(term?.num_results ?? 0),
    popularity: String(term?.popularity ?? 0),
    redirect: term?.redirect ?? '',
    display_in_terms: String(term?.display_in_terms ?? 1),
  })
  const [form, setForm] = useState(initial)

  function save() {
    const record = {
      query_text: form.query_text,
      store_id: Number(form.store_id),
      num_results: Number(form.num_results) || 0,
      popularity: Number(form.popularity) || 0,
      redirect: form.redirect || null,
      display_in_terms: Number(form.display_in_terms),
    }
    setState(prev => {
      const list = prev.searchTerms || []
      if (term) {
        return {
          ...prev,
          searchTerms: list.map(t => (String(t.query_id) === String(id) ? { ...t, ...record } : t)),
        }
      }
      const nextId = list.reduce((m, t) => Math.max(m, Number(t.query_id) || 0), 0) + 1
      return {
        ...prev,
        searchTerms: [...list, {
          query_id: nextId,
          ...record,
          updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        }],
      }
    })
    addMessage('You saved the search term.')
    navigate('/admin/search/term/')
  }

  function destroy() {
    setState(prev => ({
      ...prev,
      searchTerms: (prev.searchTerms || []).filter(t => String(t.query_id) !== String(id)),
    }))
    // Magento\Search\Controller\Adminhtml\Term\Delete — "You deleted the
    // search.", not "…the search term." (that string is Save's).
    addMessage('You deleted the search.')
    navigate('/admin/search/term/')
  }

  const actions = (
    <>
      <button type="button" id="back" data-ui-id="adminhtml-search-term-edit-back-button"
        className="action-default scalable back"
        onClick={() => navigate('/admin/search/term/')}><span>Back</span></button>
      <button type="button" id="reset" data-ui-id="adminhtml-search-term-edit-reset-button"
        className="action-default scalable"
        onClick={() => setForm(initial())}><span>Reset</span></button>
      {term ? (
        <button type="button" id="delete" data-ui-id="adminhtml-search-term-edit-delete-button"
          className="action-default scalable delete" onClick={destroy}>
          <span>Delete Search</span>
        </button>
      ) : null}
      <button type="button" id="save" data-ui-id="adminhtml-search-term-edit-save-button"
        className="action-default scalable save primary" onClick={save}>
        <span>Save Search</span>
      </button>
    </>
  )

  return (
    /* The source titles the page with the search term itself — h1 `Joust Bag`,
     * document.title `Joust Bag / Search Terms / SEO & Search / Magento Admin`. */
    <PageShell title={term ? term.query_text : 'New Search Term'} actions={actions}>
      <form id="edit_form" onSubmit={e => { e.preventDefault(); save() }}>
        <fieldset className="fieldset admin__fieldset" id="base_fieldset">
          <legend className="admin__legend legend" />
          {term ? <input id="query_id" name="query_id" type="hidden" value={term.query_id} readOnly /> : null}
          <div className="admin__field field field-query_text required _required">
            <label className="label admin__field-label" htmlFor="query_text"><span>Search Query</span></label>
            <div className="admin__field-control control">
              <input id="query_text" name="query_text" type="text" title="Search Query"
                className="input-text admin__control-text required-entry _required"
                value={form.query_text} onChange={e => setForm(f => ({ ...f, query_text: e.target.value }))} />
            </div>
          </div>
          <div className="admin__field field field-store_id _required">
            <label className="label admin__field-label" htmlFor="store_id"><span>Store</span></label>
            <div className="admin__field-control control">
              <select id="store_id" name="store_id" title="Store"
                className="required-entry _required select admin__control-select"
                value={form.store_id} onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}>
                <option value="" />
                <optgroup label="Main Website" />
                <optgroup label="    Main Website Store">
                  <option value="1">&nbsp;&nbsp;&nbsp;&nbsp;{STORE_VIEW}</option>
                </optgroup>
              </select>
            </div>
          </div>
          <div className="admin__field field field-num_results required _required with-note">
            <label className="label admin__field-label" htmlFor="num_results"><span>Number of results</span></label>
            <div className="admin__field-control control">
              <input id="num_results" name="num_results" type="text"
                title="Number of results (For the last time placed)"
                className="required-entry validate-digits validate-zero-or-greater input-text admin__control-text _required"
                value={form.num_results} onChange={e => setForm(f => ({ ...f, num_results: e.target.value }))} />
              <div className="note admin__field-note" id="num_results-note">For the last time placed.</div>
            </div>
          </div>
          <div className="admin__field field field-popularity required _required">
            <label className="label admin__field-label" htmlFor="popularity"><span>Number of Uses</span></label>
            <div className="admin__field-control control">
              <input id="popularity" name="popularity" type="text" title="Number of Uses"
                className="required-entry validate-digits validate-zero-or-greater input-text admin__control-text _required"
                value={form.popularity} onChange={e => setForm(f => ({ ...f, popularity: e.target.value }))} />
            </div>
          </div>
          <div className="admin__field field field-redirect with-note">
            <label className="label admin__field-label" htmlFor="redirect"><span>Redirect URL</span></label>
            <div className="admin__field-control control">
              <input id="redirect" name="redirect" type="text" title="Redirect URL"
                className="validate-url input-text admin__control-text"
                value={form.redirect || ''} onChange={e => setForm(f => ({ ...f, redirect: e.target.value }))} />
              <div className="note admin__field-note" id="redirect-note">ex. http://domain.com</div>
            </div>
          </div>
          <div className="admin__field field field-display_in_terms">
            <label className="label admin__field-label" htmlFor="display_in_terms">
              <span>Display in Suggested Terms</span>
            </label>
            <div className="admin__field-control control">
              <select id="display_in_terms" name="display_in_terms" title="Display in Suggested Terms"
                className="select admin__control-select"
                value={form.display_in_terms}
                onChange={e => setForm(f => ({ ...f, display_in_terms: e.target.value }))}>
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </div>
          </div>
        </fieldset>
      </form>
    </PageShell>
  )
}

export function SearchSynonyms() {
  const { rows } = useSystemCollection('synonyms', 'group_id')
  /* F-01. `store_id` / `website_id` are `<select>`s on the source, not free-text
     boxes — `select_option('[name="store_id"]', '1')` raised "Element is not a
     <select> element" against the mock. Option lists transcribed live:
       website_id  "" → `--` · 0 → All Websites   · 1 → Main Website
       store_id    "" → `--` · 0 → All Store Views · 1 → Default Store View
     Column order is the source's too: ID · Synonyms · **Website** · Store View ·
     Action (the mock had Store View and Website transposed and no Action). */
  const columns = [
    { id: 'group_id', label: 'ID', filterType: 'text' },
    { id: 'synonyms', label: 'Synonyms', filterType: 'text' },
    {
      id: 'website_id', label: 'Website', filterType: 'select',
      options: [{ value: '0', label: 'All Websites' }, { value: '1', label: 'Main Website' }],
      emptyOptionLabel: '--',
      filterValue: r => String(r.website_id ?? '0'),
      render: r => (String(r.website_id ?? '0') === '0' ? 'All Websites' : 'Main Website'),
      exportValue: r => (String(r.website_id ?? '0') === '0' ? 'All Websites' : 'Main Website'),
    },
    {
      id: 'store_id', label: 'Store View', filterType: 'select',
      options: [{ value: '0', label: 'All Store Views' }, { value: '1', label: 'Default Store View' }],
      emptyOptionLabel: '--',
      filterValue: r => String(r.store_id ?? '0'),
      render: r => (String(r.store_id ?? '0') === '0' ? 'All Store Views' : 'Default Store View'),
      exportValue: r => (String(r.store_id ?? '0') === '0' ? 'All Store Views' : 'Default Store View'),
    },
    /* Header-only, as the source's is whenever the collection is empty — and it
       is empty on both sides. There is no `/admin/search/synonyms/edit/…` route
       in the mock, so rendering an Edit link here would be a dead affordance. */
    { id: 'action', label: 'Action', sortable: false, filterType: null, render: () => '', exportValue: () => '' },
  ]
  /* F-07 — source: `<button id="add" data-ui-id="add-button">New Synonym Group`. */
  const actions = (
    <AdminLink to="/admin/search/synonyms/new/" className="action-default primary" id="add"
      data-ui-id="add-button">
      <span>New Synonym Group</span>
    </AdminLink>
  )
  return (
    <PageShell title="Search Synonyms" actions={actions}>
      <AdminGrid gridId="synonymsGrid" rows={rows} columns={columns} rowKey={r => r.group_id}
        exportFileName="search_synonyms" />
    </PageShell>
  )
}

/* ------------------------------------------------------ URL Rewrites (74) */

const REDIRECT_TYPES = [
  { value: '0', label: 'No' },
  { value: '302', label: 'Temporary (302)' },
  { value: '301', label: 'Permanent (301)' },
]

const redirectTypeLabel = v =>
  (REDIRECT_TYPES.find(o => String(o.value) === String(v ?? 0)) || REDIRECT_TYPES[0]).label

/**
 * DIFF-R25. `url_rewrite` has **225 rows** in the source DB and the source grid
 * says `225 records found` across 12 pages at its default page size of 20; the
 * mock rendered `0 records found` because the table had never been extracted.
 * `assets/dumps/extract_url_rewrites.py` pulls it read-only (SELECT only) and
 * writes `src/data/urlRewrites.json` with every real identifier verbatim —
 * `237 · customer-service → cms/page/view/page_id/6`,
 * `235 · collections/eco-new.html → catalog/category/view/id/40`,
 * `219 · erika-running-short.html → catalog/product/view/id/2040`, …
 *
 * 63 KB of read-only reference data, so it is imported as a static module and
 * kept OUT of `createInitialData()`. The page is still editable, so mutations
 * ride as a thin overlay in `state.systemConfig` — added rows, a patch map for
 * edits, and a tombstone list — which is what reaches `/go`'s `state_diff`.
 */
function useUrlRewrites() {
  const { state, setState } = useApp()
  const cfg = state?.systemConfig
  const added = cfg?.url_rewrites || []
  const edits = cfg?.url_rewrite_edits || {}
  const deleted = cfg?.url_rewrite_deleted || []

  const rows = useMemo(() => {
    const gone = new Set(deleted.map(String))
    const base = [...urlRewriteSeed, ...added]
      .filter(r => !gone.has(String(r.url_rewrite_id)))
      .map(r => (edits[String(r.url_rewrite_id)] ? { ...r, ...edits[String(r.url_rewrite_id)] } : r))
    return base
  }, [added, edits, deleted])

  const write = patch => setState(prev => ({
    ...prev,
    systemConfig: { ...(prev.systemConfig || {}), ...patch(prev.systemConfig || {}) },
  }))

  /** Seeded ids run 1..237; a new row continues past the largest live id. */
  const nextId = () => rows.reduce((m, r) => Math.max(m, Number(r.url_rewrite_id) || 0), 0) + 1

  const add = record => write(c => ({ url_rewrites: [...(c.url_rewrites || []), record] }))

  const update = (id, patch) => write(c => {
    const key = String(id)
    // A user-added row is edited in place; a seeded row gets a patch entry so
    // the 225-row baseline is never copied into state.
    if ((c.url_rewrites || []).some(r => String(r.url_rewrite_id) === key)) {
      return { url_rewrites: c.url_rewrites.map(r => (
        String(r.url_rewrite_id) === key ? { ...r, ...patch } : r)) }
    }
    return { url_rewrite_edits: { ...(c.url_rewrite_edits || {}), [key]: { ...(c.url_rewrite_edits || {})[key], ...patch } } }
  })

  const remove = id => write(c => {
    const key = String(id)
    if ((c.url_rewrites || []).some(r => String(r.url_rewrite_id) === key)) {
      return { url_rewrites: c.url_rewrites.filter(r => String(r.url_rewrite_id) !== key) }
    }
    return { url_rewrite_deleted: [...(c.url_rewrite_deleted || []), Number(id) || id] }
  })

  const find = id => rows.find(r => String(r.url_rewrite_id) === String(id)) || null

  return { rows, nextId, add, update, remove, find }
}

export function UrlRewrites() {
  const { rows, remove } = useUrlRewrites()
  const { addMessage } = useApp()

  /* Columns, labels, filter types and the `sorting: desc` default all come out
   * of `url_rewrite_listing_columns` in `assets/html/url-rewrite.html`:
   *   ids (checkbox) · ID (textRange) · Store View (html, not sortable) ·
   *   Request Path (text) · Target Path (text) · Redirect Type (select) ·
   *   Action. The source grid has NO Description column and no Export. */
  const columns = [
    {
      id: 'url_rewrite_id', label: 'ID', filterType: 'range',
      sortValue: r => Number(r.url_rewrite_id),
      render: r => (
        <AdminLink to={`/admin/admin/url_rewrite/edit/id/${r.url_rewrite_id}/`}>{r.url_rewrite_id}</AdminLink>
      ),
      exportValue: r => r.url_rewrite_id,
    },
    {
      id: 'store_id', label: 'Store View', sortable: false, filterType: 'select',
      // F-05 — the source's blank option is labelled `All Store Views`, not "".
      options: [{ value: '1', label: STORE_VIEW }], emptyOptionLabel: 'All Store Views',
      // Same three-line store hierarchy the source emits for every store cell
      // (PARITY-022) — `Main Website<br/>&nbsp;&nbsp;&nbsp;Main Website Store…`.
      render: () => (
        <>
          Main Website<br />
          {'   '}Main Website Store<br />
          {'      '}{STORE_VIEW}<br />
        </>
      ),
      filterValue: r => String(r.store_id),
      exportValue: () => STORE_VIEW,
    },
    { id: 'request_path', label: 'Request Path', filterType: 'text' },
    { id: 'target_path', label: 'Target Path', filterType: 'text' },
    {
      id: 'redirect_type', label: 'Redirect Type', filterType: 'select',
      options: REDIRECT_TYPES,
      render: r => redirectTypeLabel(r.redirect_type),
      filterValue: r => String(r.redirect_type ?? 0),
      exportValue: r => redirectTypeLabel(r.redirect_type),
    },
    {
      id: 'action', label: 'Action', sortable: false, filterType: null,
      render: r => (
        <AdminLink to={`/admin/admin/url_rewrite/edit/id/${r.url_rewrite_id}/`}
          className="action-menu-item">Select</AdminLink>
      ),
      exportValue: () => '',
    },
  ]

  // The source's only mass action is Delete (`url_rewrite/massDelete`).
  const massActions = [
    {
      id: 'delete',
      label: 'Delete',
      onApply: ids => {
        for (const id of ids) remove(id)
        addMessage(`A total of ${ids.length} record(s) have been deleted.`)
      },
    },
  ]

  /* F-07 — source: `<button id="add" data-ui-id="add-button">Add URL Rewrite`. */
  const actions = (
    <AdminLink to="/admin/admin/url_rewrite/edit/" className="action-default primary" id="add"
      data-ui-id="add-button">
      <span>Add URL Rewrite</span>
    </AdminLink>
  )
  return (
    <PageShell title="URL Rewrites" actions={actions}>
      <AdminGrid gridId="urlRewriteGrid" rows={rows} columns={columns} rowKey={r => r.url_rewrite_id}
        selectable massActions={massActions} exportable={false}
        defaultSort={{ field: 'url_rewrite_id', direction: 'desc' }} />
    </PageShell>
  )
}

/* ---------------------------------------------------------- Newsletter (75-78) */

export function NewsletterSubscribers() {
  const { state, setState, addMessage } = useApp()
  const rows = useMemo(() => (state?.newsletterSubscribers || []).map(s => {
    const c = (state?.customers || []).find(x => String(x.entity_id) === String(s.customer_id))
    return {
      ...s,
      type: s.customer_id ? 'Customer' : 'Guest',
      firstname: c?.firstname ?? '',
      lastname: c?.lastname ?? '',
      status_label: { 1: 'Subscribed', 2: 'Not Activated', 3: 'Unsubscribed', 4: 'Unconfirmed' }[s.subscriber_status] || '',
    }
  }), [state])

  const columns = [
    { id: 'subscriber_id', label: 'ID', filterType: 'text' },
    { id: 'subscriber_email', label: 'Email', filterType: 'text', filterName: 'email', searchValue: r => r.subscriber_email },
    {
      /* F-04. The source keys this filter by the DB code, not the rendered
         label: `<option value="1">Guest</option><option value="2">Customer`.
         The mock used the label as the value, so `select_option(sel,'1')` raised
         `option not found` — and the order was reversed on top of that. */
      id: 'type', label: 'Type', filterType: 'select',
      options: [{ value: '1', label: 'Guest' }, { value: '2', label: 'Customer' }],
      filterValue: r => (r.customer_id ? '2' : '1'),
    },
    { id: 'firstname', label: 'Customer First Name', filterType: 'text' },
    { id: 'lastname', label: 'Customer Last Name', filterType: 'text' },
    {
      /* Source order and values: 2 Not Activated · 1 Subscribed ·
         3 Unsubscribed · 4 Unconfirmed. */
      id: 'status_label', label: 'Status', filterType: 'select', filterName: 'status',
      options: [{ value: '2', label: 'Not Activated' }, { value: '1', label: 'Subscribed' },
        { value: '3', label: 'Unsubscribed' }, { value: '4', label: 'Unconfirmed' }],
      filterValue: r => String(r.subscriber_status),
    },
    /* Round 10 — the source's last three columns each carry a `<select>`:
       `website` (Main Website), `group` (Main Website Store) and `store`
       (Default Store View). This deployment has exactly one of each. */
    /* DIFF-R102 sweep — these three ARE sortable on the source
       (`data-sort="website"` / `"group"` / `"store"`, i.e. their own filter
       names); the mock marked all three `no-link`. */
    {
      id: 'website', label: 'Web Site', filterType: 'select',
      options: [{ value: '1', label: 'Main Website' }],
      render: () => 'Main Website', filterValue: () => '1',
    },
    {
      id: 'store', label: 'Store', filterType: 'select', filterName: 'group',
      options: [{ value: '1', label: 'Main Website Store' }],
      render: () => 'Main Website Store', filterValue: () => '1',
    },
    {
      id: 'store_view', label: 'Store View', filterType: 'select', filterName: 'store',
      options: [{ value: '1', label: 'Default Store View' }],
      render: () => 'Default Store View', filterValue: () => '1',
    },
  ]

  const massActions = [
    {
      id: 'unsubscribe',
      label: 'Unsubscribe',
      onApply: ids => {
        const set = new Set(ids.map(Number))
        setState(prev => ({
          ...prev,
          newsletterSubscribers: (prev.newsletterSubscribers || []).map(s =>
            (set.has(Number(s.subscriber_id)) ? { ...s, subscriber_status: 3 } : s)),
        }))
        addMessage(`A total of ${ids.length} record(s) were updated.`)
      },
    },
    {
      id: 'delete',
      label: 'Delete',
      onApply: ids => {
        const set = new Set(ids.map(Number))
        setState(prev => ({
          ...prev,
          newsletterSubscribers: (prev.newsletterSubscribers || [])
            .filter(s => !set.has(Number(s.subscriber_id))),
        }))
        addMessage(`A total of ${ids.length} record(s) were deleted.`)
      },
    },
  ]

  return (
    <PageShell title="Newsletter Subscribers">
      {/* Round 10 · DIFF-R80. LEGACY on the source: 2-row `<thead>`, `Search` +
        * `Reset Filter`, `select#subscriberGrid_page-limit`,
        * `select#subscriberGrid_export` (CSV / Excel XML), the massaction bar
        * with Unsubscribe/Delete, and the `massaction` Any/Yes/No filter in the
        * checkbox column — whose header on the source is EMPTY, not `Options`. */}
      <LegacyAdminGrid gridId="subscriberGrid" basePath="/admin/newsletter/subscriber/index"
        rows={rows} columns={columns} rowKey={r => r.subscriber_id}
        defaultSort="subscriber_id" defaultDir="desc"
        selectable massActions={massActions} massActionFilter
        rowSelectValue={r => r.subscriber_id} rowSelectName="subscriber"
        exportable exportFileName="newsletter_subscribers"
        exportPaths={{ csv: '/admin/newsletter/subscriber/exportCsv/', xml: '/admin/newsletter/subscriber/exportXml/' }} />
    </PageShell>
  )
}

/** Magento stores `template_type` as `TYPE_HTML` (2) / `TYPE_TEXT` (1). Tolerate
 *  a legacy row that kept the label instead of the constant. */
function newsletterTemplateType(r) {
  const t = String(r.template_type ?? '').toLowerCase()
  if (t === '1' || t === 'text') return '1'
  if (t === '2' || t === 'html') return '2'
  return ''
}

export function NewsletterTemplates() {
  const { rows } = useSystemCollection('newsletter_templates', 'template_id')
  /* Round 10 · DIFF-R81. LEGACY on the source, and the mock was also DROPPING
   * the last two columns. Source header: ID · Template · Added · Updated ·
   * Subject · Sender · Template Type · Action (8). The filter `name`s are
   * Magento's own column ids, which on this grid do NOT match their meaning —
   * the ID column filters on `template_code` and the Template column on `code`
   * (`Newsletter/Block/Adminhtml/Template/Grid`), so both carry `filterName`. */
  const columns = [
    { id: 'template_id', label: 'ID', filterType: 'text', filterName: 'template_code' },
    { id: 'template_code', label: 'Template', filterType: 'text', filterName: 'code' },
    { id: 'added_at', label: 'Added', filterType: 'date' },
    { id: 'modified_at', label: 'Updated', filterType: 'date' },
    { id: 'template_subject', label: 'Subject', filterType: 'text', filterName: 'subject' },
    { id: 'template_sender_name', label: 'Sender', filterType: 'text', filterName: 'sender' },
    {
      /* F-01c — the source's option VALUES are Magento's
         `TemplateTypesInterface` constants, not the labels:
         `Newsletter/Block/Adminhtml/Template/Grid.php` declares
         `'type' => 'options', 'options' => [TYPE_HTML => 'html', TYPE_TEXT =>
         'text']` with `TYPE_HTML = 2` / `TYPE_TEXT = 1`. Round 11 measured
         `[['',''],['2','html'],['1','text']]` on the source, so
         `select_option('[name="type"]', '2')` raised against the mock's
         `html`/`text` values. Same fix already applied to the email-template
         grid. A Magento `options` column renders the LABEL for the stored
         numeric, hence `render`. */
      id: 'template_type', label: 'Template Type', filterType: 'select', filterName: 'type',
      options: [{ value: '2', label: 'html' }, { value: '1', label: 'text' }],
      filterValue: r => newsletterTemplateType(r),
      render: r => ({ 2: 'html', 1: 'text' })[newsletterTemplateType(r)] ?? '',
    },
    /* The seed holds zero newsletter templates — the source's grid is empty too
     * (`No Templates Found`) — so this column's header is all that ever paints. */
    { id: 'action', label: 'Action', sortable: false, filterType: null, render: () => '' },
  ]
  const actions = (
    <AdminLink to="/admin/newsletter/template/new/" className="action-default primary" id="add"
      data-ui-id="page-actions-toolbar-add-button">
      <span>Add New Template</span>
    </AdminLink>
  )
  return (
    <PageShell title="Newsletter Templates" actions={actions}>
      <LegacyAdminGrid gridId="newsletterTemplateGrid" basePath="/admin/newsletter/template/index"
        rows={rows} columns={columns} rowKey={r => r.template_id}
        emptyMessage="No Templates Found"
        exportable={false} exportFileName="newsletter_templates" />
    </PageShell>
  )
}

export function NewsletterQueue() {
  /* Round 10 · DIFF-R82. LEGACY on the source and one column short. Source
   * header: ID · Queue Start · Queue End · Subject · Status · Processed ·
   * Recipients · Action (8). Status is a `<select name="status">` there, not a
   * text box, and Processed/Recipients are numeric FROM/TO ranges. */
  const columns = [
    { id: 'queue_id', label: 'ID', filterType: 'text' },
    { id: 'start_at', label: 'Queue Start', filterType: 'date' },
    { id: 'finish_at', label: 'Queue End', filterType: 'date' },
    { id: 'newsletter_subject', label: 'Subject', filterType: 'text' },
    {
      /* F-01d — `Sent` and `Cancelled` were SWAPPED against the source, which
         filtered silently to the wrong status instead of raising.
         `Newsletter/Model/Queue.php`: STATUS_NEVER=0, STATUS_SENDING=1,
         STATUS_CANCEL=2, STATUS_SENT=3, STATUS_PAUSE=4. The source's rendered
         option order is Sent · Cancelled · Not Sent · Sending · Paused. */
      id: 'queue_status', label: 'Status', filterType: 'select', filterName: 'status',
      options: [{ value: '3', label: 'Sent' }, { value: '2', label: 'Cancelled' },
        { value: '0', label: 'Not Sent' }, { value: '1', label: 'Sending' },
        { value: '4', label: 'Paused' }],
    },
    { id: 'subscribers_sent', label: 'Processed', filterType: 'range', numeric: true },
    { id: 'subscribers_total', label: 'Recipients', filterType: 'range', numeric: true },
    /* The seed holds zero queued newsletters, as does the source. */
    { id: 'action', label: 'Action', sortable: false, filterType: null, render: () => '' },
  ]
  return (
    <PageShell title="Newsletter Queue">
      {/* Source cold load carries `_descend` on `Queue Start` (`start_at`),
        * measured live; the mock showed no sort indicator at all. */}
      <LegacyAdminGrid gridId="queueGrid" basePath="/admin/newsletter/queue/index"
        rows={[]} columns={columns} rowKey={r => r.queue_id}
        defaultSort="start_at" defaultDir="desc"
        exportable={false} exportFileName="newsletter_queue" />
    </PageShell>
  )
}

export function NewsletterProblems() {
  /* DIFF-R31 / DIFF-R32. The source's `h1` and `<title>` are `Newsletter
   * Problems Report` — the menu entry is the one that reads "Newsletter Problem
   * Reports". Columns and the empty message are the source's too. */
  /* Round 10. LEGACY on the source. Source header: '' · ID · Subscriber ·
   * Queue Start Date · Queue Subject · Error Code · Error Text (7) — the first
   * cell is the select-row column and its header is EMPTY. The source ships no
   * `problemGrid_massaction-select`, so the leading column is rendered as an
   * empty column rather than a massaction bar that does not exist there. Error
   * Code is a numeric FROM/TO range on the source, not a text box. */
  const columns = [
    { id: 'massaction', label: '', sortable: false, filterType: null, render: () => '' },
    { id: 'problem_id', label: 'ID', filterType: 'text' },
    { id: 'subscriber', label: 'Subscriber', filterType: 'text' },
    { id: 'queue_start_date', label: 'Queue Start Date', filterType: 'date', filterName: 'queue_start' },
    { id: 'queue_subject', label: 'Queue Subject', filterType: 'text', filterName: 'queue' },
    { id: 'error_code', label: 'Error Code', filterType: 'range', filterName: 'problem_code', numeric: true },
    { id: 'error_text', label: 'Error Text', filterType: 'text', filterName: 'problem_text' },
  ]
  return (
    <PageShell title="Newsletter Problems Report">
      <LegacyAdminGrid gridId="problemGrid" basePath="/admin/newsletter/problem/index"
        rows={[]} columns={columns} rowKey={r => r.problem_id}
        emptyMessage="We found no problems."
        exportable={false} exportFileName="newsletter_problems" />
    </PageShell>
  )
}

export function CheckoutAgreements() {
  const { rows } = useSystemCollection('checkout_agreements', 'agreement_id')
  /* Source header order and labels: `ID · Condition · Store View · Status`
     (the mock read `Condition Name` and put Status before Store View), and
     F-01: `is_active` is a `<select>` there — `"" · 0 Disabled · 1 Enabled` —
     not the free-text box the mock rendered. `stores` is the Store View
     filter's own `name`, with `0 All Store Views · 1 Default Store View`. */
  const columns = [
    { id: 'agreement_id', label: 'ID', filterType: 'text' },
    { id: 'name', label: 'Condition', filterType: 'text' },
    {
      /* F-01e. The source's `stores` control is Magento's STORE filter, not a
       * plain select: no blank sentinel, `0 All Store Views` first, then the
       * website/store optgroups with a 4-&nbsp;-indented `Default Store View`.
       * Measured live on `/admin/checkout/agreement/index/`:
       *   <select class="admin__control-select" name="stores"
       *     data-ui-id="widget-grid-column-filter-store-0-filter-stores">
       *     <option value="0">All Store Views</option>
       *     <optgroup label="Main Website"></optgroup>
       *     <optgroup label="&nbsp;×4 Main Website Store">
       *       <option value="1">&nbsp;×4 Default Store View</option>
       * The mock's plain select added a leading blank, which shifts every
       * option index by one. `filterType: 'store'` is that exact control.
       * The source's `<th>` here also carries no `data-sort` — the column is
       * not sortable there, and the mock made it so. */
      id: 'store_id', label: 'Store View', filterType: 'store', filterName: 'stores',
      sortable: false,
      render: r => (String(r.store_id ?? '0') === '0' ? 'All Store Views' : 'Default Store View'),
      exportValue: r => (String(r.store_id ?? '0') === '0' ? 'All Store Views' : 'Default Store View'),
    },
    {
      id: 'is_active', label: 'Status', filterType: 'select',
      options: [{ value: '0', label: 'Disabled' }, { value: '1', label: 'Enabled' }],
      filterValue: r => String(r.is_active ?? '0'),
      render: r => (Number(r.is_active) === 1 ? 'Enabled' : 'Disabled'),
      exportValue: r => (Number(r.is_active) === 1 ? 'Enabled' : 'Disabled'),
    },
  ]
  /* F-07 — source: `<button id="add" data-ui-id="adminhtml-agreement-0-add-button">`. */
  const actions = (
    <AdminLink to="/admin/checkout/agreement/new/" className="action-default primary" id="add"
      data-ui-id="adminhtml-agreement-0-add-button">
      <span>Add New Condition</span>
    </AdminLink>
  )
  return (
    <PageShell title="Terms and Conditions" actions={actions}>
      {/* Round 10. LEGACY on the source (2-row thead, Search + Reset Filter,
        * `0 records found 0 selected` in `.admin__control-support-text`). */}
      {/* Source cold load carries `_ascend` on `ID`; the mock showed none. */}
      <LegacyAdminGrid gridId="agreementGrid" basePath="/admin/checkout/agreement/index"
        rows={rows} columns={columns} rowKey={r => r.agreement_id}
        defaultSort="agreement_id" defaultDir="asc"
        exportable={false} exportFileName="agreements" />
    </PageShell>
  )
}

/* ------------------------------- create/edit forms for the Marketing grids */

/**
 * HANDLERS-011 / PIPELINE-005. Every form below replaces a route that used to
 * re-render the grid it was launched from. Legends, field labels, button labels
 * and page titles were read off the live source page-by-page (see
 * `/admin/catalog_rule/promo_catalog/new/`, `/admin/search/synonyms/new/`,
 * `/admin/admin/url_rewrite/edit/`, `/admin/newsletter/template/new/`,
 * `/admin/checkout/agreement/new/`).
 */

export function CatalogPriceRuleForm() {
  const { id } = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const groups = state?.customerGroups || []
  const existing = id
    ? (state?.catalogPriceRules || []).find(r => String(r.rule_id) === String(id)) : null
  const backTo = '/admin/catalog_rule/promo_catalog/'

  const initial = {
    name: existing?.name ?? '',
    description: existing?.description ?? '',
    is_active: String(existing?.is_active ?? 1),
    website_ids: (existing?.website_ids || [1]).map(String),
    customer_group_ids: (existing?.customer_group_ids || []).map(String),
    from_date: existing?.from_date ?? '',
    to_date: existing?.to_date ?? '',
    sort_order: String(existing?.sort_order ?? 0),
  }

  // `catalogrule` column names, so the saved row matches the source's schema.
  function recordFrom(form) {
    return {
      rule_id: existing ? existing.rule_id : nextCatalogRuleId(state),
      name: form.name,
      description: form.description,
      is_active: Number(form.is_active),
      website_ids: form.website_ids.map(Number),
      customer_group_ids: form.customer_group_ids.map(Number).sort((a, b) => a - b),
      from_date: form.from_date || null,
      to_date: form.to_date || null,
      sort_order: Number(form.sort_order) || 0,
      simple_action: existing?.simple_action ?? 'by_percent',
      discount_amount: existing?.discount_amount ?? '0',
      stop_rules_processing: existing?.stop_rules_processing ?? 0,
      conditions_serialized: existing?.conditions_serialized ?? '',
    }
  }

  function write(form, applied) {
    const record = applied
      ? { ...recordFrom(form), applied_at: new Date().toISOString().slice(0, 19).replace('T', ' ') }
      : recordFrom(form)
    setState(prev => {
      const list = prev.catalogPriceRules || []
      return {
        ...prev,
        catalogPriceRules: existing
          ? list.map(r => (String(r.rule_id) === String(existing.rule_id) ? record : r))
          : [...list, record],
      }
    })
  }

  function onSave(form) {
    write(form, false)
    addMessage('You saved the rule.')
    navigate(backTo)
  }

  function remove() {
    setState(prev => ({
      ...prev,
      catalogPriceRules: (prev.catalogPriceRules || []).filter(r => String(r.rule_id) !== String(id)),
    }))
    addMessage('You deleted the rule.')
    navigate(backTo)
  }

  const fields = [
    { name: 'name', label: 'Rule Name', required: true },
    { name: 'description', label: 'Description', type: 'textarea', rows: 4 },
    /* G-03 (same class). The source renders Active as the
     * `.admin__actions-switch` checkbox here too, not a select. */
    { name: 'is_active', label: 'Active', type: 'toggle' },
    {
      name: 'website_ids', label: 'Websites', type: 'multiselect', size: 3,
      options: [{ value: '1', label: 'Main Website' }],
    },
    {
      name: 'customer_group_ids', label: 'Customer Groups', type: 'multiselect',
      options: groups.map(g => ({ value: String(g.customer_group_id), label: g.customer_group_code })),
    },
    { name: 'from_date', label: 'From', type: 'date' },
    { name: 'to_date', label: 'To', type: 'date' },
    { name: 'sort_order', label: 'Priority' },
  ]

  return (
    <RecordForm
      title={existing ? existing.name : 'New Catalog Price Rule'}
      documentTitle={existing ? existing.name : 'New Catalog Price Rule'}
      legend="Rule Information"
      backTo={backTo}
      initial={initial}
      fields={fields}
      saveLabel="Save"
      deleteLabel="Delete Rule"
      uiPrefix=""
      saveAndContinueLabel="Save and Continue Edit"
      onSaveAndContinue={form => { write(form, false); addMessage('You saved the rule.') }}
      onDelete={existing ? remove : null}
      onSave={onSave}
    />
  )
}

function nextCatalogRuleId(state) {
  return (state?.catalogPriceRules || []).reduce((m, r) => Math.max(m, Number(r.rule_id) || 0), 0) + 1
}

export function SynonymGroupForm() {
  const { id } = useParams()
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  const { rows, nextId, add, update, remove } = useSystemCollection('synonyms', 'group_id')
  const existing = id ? rows.find(r => String(r.group_id) === String(id)) : null
  const backTo = '/admin/search/synonyms/index/'

  return (
    <RecordForm
      title={existing ? 'Edit Synonym Group' : 'New Synonym Group'}
      documentTitle={existing ? 'Edit Synonym Group' : 'New Synonym Group'}
      backTo={backTo}
      saveLabel="Save Synonym Group"
      deleteLabel="Delete Synonym Group"
      uiPrefix=""
      /* F-07 — the source's synonym form carries `#save_and_continue`
         (`data-ui-id="save-and-continue-button"`) between Reset and Save. */
      saveAndContinueLabel="Save and Continue Edit"
      initial={{
        scope: existing?.scope ?? 'all',
        synonyms: existing?.synonyms ?? '',
        /* Source name is `mergeOnConflict` (`mergeExisting` was mock-invented),
         * and the source checkbox carries `value="0"` when unchecked. */
        mergeOnConflict: existing?.mergeOnConflict ?? existing?.mergeExisting ?? '0',
      }}
      fields={[
        {
          name: 'scope', label: 'Scope', type: 'select',
          options: [
            { value: 'all', label: 'All Websites' },
            { value: 'website_1', label: 'Main Website' },
            { value: 'store_1', label: 'Default Store View' },
          ],
        },
        /* The source's Synonyms control is a `<textarea>`, not a text input. */
        { name: 'synonyms', label: 'Synonyms', type: 'textarea', rows: 4, required: true, note: 'Comma separated.' },
        { name: 'mergeOnConflict', label: 'Merge existing synonyms', type: 'checkbox' },
      ]}
      onDelete={existing ? () => {
        remove(existing.group_id)
        addMessage('The synonym group has been deleted.')
        navigate(backTo)
      } : null}
      onSave={form => {
        const record = {
          synonyms: form.synonyms,
          scope: form.scope,
          mergeOnConflict: form.mergeOnConflict,
          store_id: form.scope === 'store_1' ? 1 : 0,
          website_id: form.scope === 'all' ? 0 : 1,
        }
        if (existing) update(existing.group_id, record)
        else add({ group_id: nextId(), ...record })
        addMessage('You saved the synonym group.')
        navigate(backTo)
      }}
    />
  )
}

export function UrlRewriteForm() {
  const { id } = useParams()
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  const { nextId, add, update, remove, find } = useUrlRewrites()
  const existing = id ? find(id) : null
  const backTo = '/admin/admin/url_rewrite/index/'
  /* The source's h1/title names the rewritten entity — verified live on
   * ids 237 / 235 / 219 and on the New form:
   *   cms-page → `Edit URL Rewrite for CMS page`
   *   category → `Edit URL Rewrite for a Category`
   *   product  → `Edit URL Rewrite for a Product`
   *   custom / new → `Add New URL Rewrite`
   * Now that the grid has all 225 seeded rows, every one of them links here. */
  const ENTITY_TITLES = {
    'cms-page': 'Edit URL Rewrite for CMS page',
    category: 'Edit URL Rewrite for a Category',
    product: 'Edit URL Rewrite for a Product',
  }
  const title = existing
    ? (ENTITY_TITLES[existing.entity_type] || 'Edit URL Rewrite')
    : 'Add New URL Rewrite'

  return (
    <RecordForm
      title={title}
      documentTitle={title}
      legend="URL Rewrite Information"
      backTo={backTo}
      uiPrefix="edit-0"
      saveLabel="Save"
      deleteLabel="Delete"
      initial={{
        entity_type: existing?.entity_type ?? 'custom',
        entity_id: String(existing?.entity_id ?? 0),
        store_id: String(existing?.store_id ?? 1),
        request_path: existing?.request_path ?? '',
        target_path: existing?.target_path ?? '',
        redirect_type: String(existing?.redirect_type ?? 0),
        description: existing?.description ?? '',
      }}
      fields={[
        {
          name: 'store_id', label: 'Store', type: 'select',
          options: [{ value: '1', label: 'Default Store View' }],
        },
        { name: 'request_path', label: 'Request Path', required: true },
        { name: 'target_path', label: 'Target Path', required: true },
        // Source option order (url_rewrite_listing redirect_type column).
        { name: 'redirect_type', label: 'Redirect Type', type: 'select', options: REDIRECT_TYPES },
        { name: 'description', label: 'Description', type: 'textarea', rows: 4 },
      ]}
      onDelete={existing ? () => {
        remove(existing.url_rewrite_id)
        addMessage('You deleted the URL Rewrite.')
        navigate(backTo)
      } : null}
      onSave={form => {
        const record = {
          entity_type: form.entity_type,
          entity_id: Number(form.entity_id) || 0,
          store_id: Number(form.store_id),
          request_path: form.request_path,
          target_path: form.target_path,
          redirect_type: Number(form.redirect_type),
          description: form.description,
        }
        if (existing) update(existing.url_rewrite_id, record)
        else add({ url_rewrite_id: nextId(), is_autogenerated: 0, metadata: null, ...record })
        addMessage('The URL Rewrite has been saved.')
        navigate(backTo)
      }}
    />
  )
}

export function NewsletterTemplateForm() {
  const { id } = useParams()
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  const { rows, nextId, add, update, remove } = useSystemCollection('newsletter_templates', 'template_id')
  const existing = id ? rows.find(r => String(r.template_id) === String(id)) : null
  const backTo = '/admin/newsletter/template/'

  return (
    <RecordForm
      title={existing ? 'Edit Template' : 'New Template'}
      documentTitle={existing ? 'Edit Template' : 'New Template'}
      legend="Template Information"
      backTo={backTo}
      uiPrefix="page-actions-toolbar"
      saveLabel="Save Template"
      deleteLabel="Delete Template"
      initial={{
        template_code: existing?.template_code ?? '',
        template_subject: existing?.template_subject ?? '',
        template_sender_name: existing?.template_sender_name ?? '',
        template_sender_email: existing?.template_sender_email ?? '',
        template_text: existing?.template_text ?? '',
        template_styles: existing?.template_styles ?? '',
      }}
      fields={[
        { name: 'template_code', label: 'Template Name', required: true },
        { name: 'template_subject', label: 'Template Subject', required: true },
        { name: 'template_sender_name', label: 'Sender Name' },
        { name: 'template_sender_email', label: 'Sender Email' },
        { name: 'template_text', label: 'Template Content', type: 'textarea', required: true },
        { name: 'template_styles', label: 'Template Styles', type: 'textarea', rows: 4 },
      ]}
      onDelete={existing ? () => {
        remove(existing.template_id)
        addMessage('The newsletter template has been deleted.')
        navigate(backTo)
      } : null}
      onSave={form => {
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
        if (existing) update(existing.template_id, { ...form, modified_at: now })
        /* Source `Template\Save.php`: a template without an id is saved as
           `TemplateTypesInterface::TYPE_HTML` (2). */
        else add({ template_id: nextId(), ...form, template_type: 2, added_at: now, modified_at: now })
        addMessage('The newsletter template has been saved.')
        navigate(backTo)
      }}
    />
  )
}

export function CheckoutAgreementForm() {
  const { id } = useParams()
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  const { rows, nextId, add, update, remove } = useSystemCollection('checkout_agreements', 'agreement_id')
  const existing = id ? rows.find(r => String(r.agreement_id) === String(id)) : null
  const backTo = '/admin/checkout/agreement/'

  return (
    <RecordForm
      title={existing ? existing.name : 'New Condition'}
      documentTitle={existing ? existing.name : 'New Condition'}
      legend="Terms and Conditions Information"
      backTo={backTo}
      uiPrefix="adminhtml-agreement-edit-0"
      saveLabel="Save Condition"
      deleteLabel="Delete"
      initial={{
        name: existing?.name ?? '',
        is_active: String(existing?.is_active ?? 1),
        mode: String(existing?.mode ?? 0),
        is_html: String(existing?.is_html ?? 0),
        store_id: String(existing?.store_id ?? 1),
        checkbox_text: existing?.checkbox_text ?? '',
        content: existing?.content ?? '',
        content_height: existing?.content_height ?? '',
      }}
      fields={[
        { name: 'name', label: 'Condition Name', required: true },
        {
          name: 'is_active', label: 'Status', type: 'select',
          options: [{ value: '1', label: 'Enabled' }, { value: '0', label: 'Disabled' }],
        },
        {
          name: 'is_html', label: 'Show Content as', type: 'select',
          options: [{ value: '0', label: 'Text' }, { value: '1', label: 'HTML' }],
        },
        {
          name: 'mode', label: 'Applied', type: 'select',
          options: [
            { value: '0', label: 'Automatically' },
            { value: '1', label: 'Manually' },
          ],
        },
        {
          name: 'store_id', label: 'Store View', type: 'select',
          options: [{ value: '1', label: 'Default Store View' }],
        },
        /* The source's Checkbox Text control is a `<textarea>`. */
        { name: 'checkbox_text', label: 'Checkbox Text', type: 'textarea', rows: 5, required: true },
        { name: 'content', label: 'Content', type: 'textarea', required: true },
        { name: 'content_height', label: 'Content Height (css)' },
      ]}
      onDelete={existing ? () => {
        remove(existing.agreement_id)
        addMessage('You deleted the condition.')
        navigate(backTo)
      } : null}
      onSave={form => {
        const record = {
          name: form.name,
          is_active: Number(form.is_active),
          is_html: Number(form.is_html),
          mode: Number(form.mode),
          store_id: Number(form.store_id),
          checkbox_text: form.checkbox_text,
          content: form.content,
          content_height: form.content_height,
        }
        if (existing) update(existing.agreement_id, record)
        else add({ agreement_id: nextId(), ...record })
        addMessage('You saved the condition.')
        navigate(backTo)
      }}
    />
  )
}
