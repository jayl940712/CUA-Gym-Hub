import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import { Field, Fieldset, PageNav, FormSection } from '../../components/catalog/FormControls.jsx'
import { COUNTRY_OPTIONS, countryLabel } from '../../components/catalog/countries.js'
import '../../components/catalog/adminForm.css'
import { useApp } from '../../context/AppContext.jsx'
import { getCustomer, getOrderGridRows, getReviews } from '../../utils/selectors.js'
import { useSidNavigate } from '../../utils/navigation.js'
import {
  formatDateTime, formatCurrency, formatIncrementId, reviewStatusLabel,
} from '../../utils/formatters.js'

/* ROUTES rows 53, 54, 55 — customer edit / new / save.
 *
 * The left rail is the source's Customer Information nav; `?tab=` deep-links a
 * tab so an agent dropped straight onto Orders sees Orders.
 */

const TABS = [
  { id: 'view', label: 'Customer View' },
  { id: 'account', label: 'Account Information' },
  { id: 'addresses', label: 'Addresses' },
  { id: 'orders', label: 'Orders' },
  { id: 'cart', label: 'Shopping cart' },
  { id: 'newsletter', label: 'Newsletter' },
  { id: 'billing_agreements', label: 'Billing Agreements' },
  { id: 'reviews', label: 'Product Reviews' },
  { id: 'wishlist', label: 'Wish List' },
]

/**
 * PARITY-005 — the source gives every Customer Information tab its own URL
 * (`/admin/customer/index/orders/id/1/`, `/admin/customer/index/cart/id/1/`,
 * `/admin/customer/index/wishlist/id/1/`, `/admin/review/customer/productReviews/id/1/`)
 * and additionally accepts `/admin/customer/index/edit/id/1/active_tab/<tab>/`.
 * Magento's `active_tab` values are singular for reviews, so both spellings
 * resolve here.
 */
const ACTIVE_TAB_ALIASES = {
  view: 'view',
  account: 'account',
  address: 'addresses',
  addresses: 'addresses',
  orders: 'orders',
  order: 'orders',
  cart: 'cart',
  carts: 'cart',
  newsletter: 'newsletter',
  billing_agreements: 'billing_agreements',
  review: 'reviews',
  reviews: 'reviews',
  wishlist: 'wishlist',
}

function blankForm() {
  return {
    website_id: 1,
    group_id: 1,
    disable_auto_group_change: 0,
    prefix: '',
    firstname: '',
    middlename: '',
    lastname: '',
    suffix: '',
    email: '',
    assistance_allowed: 0,
    dob: '',
    taxvat: '',
    gender: '',
    sendemail_store_id: '1',
    created_in: 'Default Store View',
  }
}

/* DOM-209 — the source's Date of Birth is a jQuery datepicker over an
 * `input[type=text]`, so `.value` is the localized `M/D/YYYY` string, not an
 * ISO date. The seed stores ISO; convert at the edges so a `type="date"` never
 * appears in the DOM. */
function dobToDisplay(v) {
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (!m) return String(v || '')
  return `${Number(m[2])}/${Number(m[3])}/${m[1]}`
}

function dobToIso(v) {
  const m = String(v || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!m) return String(v || '').trim()
  return `${m[3]}-${String(m[1]).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}`
}

export default function CustomerEdit({ isNew = false, tab: tabProp = null }) {
  const params = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const {
    state, updateCollectionItem, addCollectionItem, removeCollectionItem, removeWishlistItem, addMessage,
  } = useApp()
  const navigate = useSidNavigate()

  const customer = isNew ? null : getCustomer(state, params.id)

  /* Route-supplied tab (own path segment, or `/active_tab/<tab>/`) wins over
     `?tab=`, which is the mock's own deep-link convenience. */
  const routeTab = tabProp || ACTIVE_TAB_ALIASES[String(params.tab || '').toLowerCase()] || null

  const [tab, setTab] = useState(() => {
    if (routeTab) return routeTab
    const t = searchParams.get('tab')
    if (t && TABS.some(x => x.id === t)) return t
    return isNew ? 'account' : 'view'
  })

  useEffect(() => { if (routeTab) setTab(routeTab) }, [routeTab])

  const [form, setForm] = useState(() => {
    if (!customer) return blankForm()
    return {
      website_id: customer.website_id ?? 1,
      group_id: customer.group_id ?? 1,
      disable_auto_group_change: customer.disable_auto_group_change ?? 0,
      prefix: customer.prefix ?? '',
      firstname: customer.firstname ?? '',
      middlename: customer.middlename ?? '',
      lastname: customer.lastname ?? '',
      suffix: customer.suffix ?? '',
      email: customer.email ?? '',
      assistance_allowed: customer.assistance_allowed ?? 0,
      dob: dobToDisplay(customer.dob ?? ''),
      taxvat: customer.taxvat ?? '',
      gender: customer.gender == null ? '' : String(customer.gender),
      sendemail_store_id: String(customer.sendemail_store_id ?? 1),
      created_in: customer.created_in ?? 'Default Store View',
    }
  })
  const [errors, setErrors] = useState({})

  const groups = state?.customerGroups || []
  const groupLabel = id => groups.find(g => String(g.customer_group_id) === String(id))?.customer_group_code || ''

  /* DOM-208 — `customer[group_id]` on the source offers only the assignable
   * groups (NOT LOGGED IN, id 0, is the guest pseudo-group and is never
   * offered), ordered alphabetically by label: General, Retailer, Wholesale. */
  const assignableGroups = useMemo(
    () => groups.filter(g => Number(g.customer_group_id) !== 0)
      .slice()
      .sort((a, b) => String(a.customer_group_code).localeCompare(String(b.customer_group_code))),
    [groups])

  const orders = useMemo(
    () => (customer ? getOrderGridRows(state).filter(o => String(o.customer_id) === String(customer.entity_id)) : []),
    [state, customer?.entity_id])

  const reviews = useMemo(
    () => (customer ? getReviews(state).filter(r => String(r.customer_id) === String(customer.entity_id)) : []),
    [state, customer?.entity_id])

  const wishlist = useMemo(
    () => (customer ? (state?.wishlists || []).find(w => String(w.customer_id) === String(customer.entity_id)) : null),
    [state?.wishlists, customer?.entity_id])

  const subscription = customer
    ? (state?.newsletterSubscribers || []).find(s => String(s.customer_id) === String(customer.entity_id))
    : null

  if (!isNew && !customer) {
    return (
      <PageShell title="Customer">
        <div className="admin__data-grid-empty">
          This customer no longer exists.{' '}
          <AdminLink to="/admin/customer/index/">Back to Customers</AdminLink>
        </div>
      </PageShell>
    )
  }

  function selectTab(id) {
    setTab(id)
    const next = new URLSearchParams(searchParams)
    next.set('tab', id)
    setSearchParams(next, { replace: true })
  }

  function validate() {
    const next = {}
    if (!form.firstname.trim()) next.firstname = 'This is a required field.'
    if (!form.lastname.trim()) next.lastname = 'This is a required field.'
    if (!form.email.trim()) next.email = 'This is a required field.'
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim())) next.email = 'Please enter a valid email address.'
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function nextCustomerId() {
    return (state?.customers || []).reduce((n, c) => Math.max(n, c.entity_id), 0) + 1
  }

  function save(stay = false) {
    if (!validate()) {
      setTab('account')
      addMessage('Please fix the highlighted fields.', 'error')
      return
    }
    const name = [form.firstname, form.lastname].filter(Boolean).join(' ')
    const patch = {
      website_id: Number(form.website_id),
      group_id: Number(form.group_id),
      disable_auto_group_change: Number(form.disable_auto_group_change),
      prefix: form.prefix || null,
      firstname: form.firstname,
      middlename: form.middlename || null,
      lastname: form.lastname,
      suffix: form.suffix || null,
      email: form.email,
      assistance_allowed: Number(form.assistance_allowed),
      dob: form.dob ? dobToIso(form.dob) : null,
      taxvat: form.taxvat || null,
      gender: form.gender === '' ? null : Number(form.gender),
      sendemail_store_id: Number(form.sendemail_store_id),
      name,
      updated_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    }
    if (isNew) {
      const id = nextCustomerId()
      addCollectionItem('customers', {
        entity_id: id,
        store_id: 1,
        is_active: 1,
        created_at: patch.updated_at,
        created_in: form.created_in,
        addresses: [],
        ...patch,
      })
      addMessage('You saved the customer.')
      navigate(stay ? `/admin/customer/index/edit/id/${id}/` : '/admin/customer/index/')
      return
    }
    updateCollectionItem('customers', 'entity_id', customer.entity_id, patch)
    addMessage('You saved the customer.')
    if (!stay) navigate('/admin/customer/index/')
  }

  const title = isNew ? 'New Customer' : (customer.name || `${customer.firstname} ${customer.lastname}`)

  const actions = isNew ? (
    <>
      <button type="button" id="back" title="Back" data-ui-id="back-button" className="action-default" onClick={() => navigate('/admin/customer/index/')}>Back</button>
      <button type="button" id="reset" title="Reset" data-ui-id="reset-button" className="action-default" onClick={() => setForm(blankForm())}>Reset</button>
      <button type="button" id="save_and_continue" title="Save and Continue Edit" data-ui-id="save-and-continue-button" className="action-secondary" onClick={() => save(true)}>Save and Continue Edit</button>
      <button type="button" id="save" title="Save Customer" data-ui-id="save-button" className="action-primary" onClick={() => save(false)}>Save Customer</button>
    </>
  ) : (
    <>
      <button type="button" id="back" title="Back" data-ui-id="back-button" className="action-default" onClick={() => navigate('/admin/customer/index/')}>Back</button>
      <button
        type="button"
        id="login_as_customer"
        title="Login as Customer"
        data-ui-id="login-as-customer-button"
        className="action-default"
        /* HANDLERS-037. The source opens the storefront in a new tab as this
         * customer. Storefront routes are out of scope for this mock, so there
         * is no session to create — decline honestly rather than assert a login
         * that did not happen. */
        onClick={() => addMessage(
          'The storefront is not part of this admin mock, so we can\'t log you in as '
          + `${customer.email}.`, 'notice')}
      >
        Login as Customer
      </button>
      <button
        type="button"
        id="customer-edit-delete-button"
        title="Delete Customer"
        data-ui-id="customer-edit-delete-button-button"
        data-url={`/admin/customer/index/delete/id/${customer.entity_id}/`}
        className="action-default"
        onClick={() => {
          removeCollectionItem('customers', 'entity_id', customer.entity_id)
          addMessage('You deleted the customer.')
          navigate('/admin/customer/index/')
        }}
      >
        Delete Customer
      </button>
      <button
        type="button"
        id="reset"
        title="Reset"
        data-ui-id="reset-button"
        className="action-default"
        onClick={() => setForm({
          website_id: customer.website_id ?? 1,
          group_id: customer.group_id ?? 1,
          disable_auto_group_change: customer.disable_auto_group_change ?? 0,
          prefix: customer.prefix ?? '',
          firstname: customer.firstname ?? '',
          middlename: customer.middlename ?? '',
          lastname: customer.lastname ?? '',
          suffix: customer.suffix ?? '',
          email: customer.email ?? '',
          dob: customer.dob ?? '',
          taxvat: customer.taxvat ?? '',
          gender: customer.gender == null ? '' : String(customer.gender),
          created_in: customer.created_in ?? 'Default Store View',
        })}
      >
        Reset
      </button>
      <button
        type="button"
        id="order"
        title="Create Order"
        data-ui-id="order-button"
        className="action-default"
        onClick={() => navigate(`/admin/sales/order_create/start/customer_id/${customer.entity_id}/`)}
      >
        Create Order
      </button>
      <button
        type="button"
        id="resetPassword"
        title="Reset Password"
        data-ui-id="resetpassword-button"
        className="action-default"
        onClick={() => addMessage('The customer will receive an email with a link to reset password.')}
      >
        Reset Password
      </button>
      <button
        type="button"
        id="invalidateToken"
        title="Force Sign-In"
        data-ui-id="invalidatetoken-button"
        className="action-default"
        onClick={() => addMessage('You have signed out the customer from all devices.')}
      >
        Force Sign-In
      </button>
      <button type="button" id="save_and_continue" title="Save and Continue Edit" data-ui-id="save-and-continue-button" className="action-secondary" onClick={() => save(true)}>Save and Continue Edit</button>
      <button type="button" id="save" title="Save Customer" data-ui-id="save-button" className="action-primary" onClick={() => save(false)}>Save Customer</button>
    </>
  )

  const billing = customer?.addresses?.find(a => a.entity_id === customer.default_billing)
    || customer?.addresses?.[0] || null

  return (
    <PageShell title={title} documentTitle={isNew ? 'New Customer' : null} actions={actions}>
      <div className="admin-form-columns">
        <div className="admin-form-columns__nav">
          <PageNav
            title="CUSTOMER INFORMATION"
            items={isNew ? TABS.filter(t => t.id === 'account' || t.id === 'addresses') : TABS}
            activeId={tab}
            onSelect={selectTab}
          />
        </div>

        <div className="admin-form-columns__body">
          {tab === 'view' ? (
            <div className="admin__form-columns-2">
              <div>
                <div className="admin__page-section-title">Personal Information</div>
                <table className="admin__table-secondary customer-information-table">
                  <tbody>
                    <tr><th>Last Logged In:</th><td>Never (Offline)</td></tr>
                    <tr><th>Account Lock:</th><td>Unlocked</td></tr>
                    <tr>
                      <th>Confirmed email:</th>
                      <td>{customer.confirmation ? 'Confirmation Required' : 'Confirmation Not Required'}</td>
                    </tr>
                    <tr><th>Account Created:</th><td>{formatDateTime(customer.created_at)}</td></tr>
                    <tr><th>Account Created in:</th><td>{customer.created_in || 'Default Store View'}</td></tr>
                    <tr><th>Customer Group:</th><td>{groupLabel(customer.group_id)}</td></tr>
                  </tbody>
                </table>
              </div>
              <div className="admin__address-card">
                <strong>Default Billing Address</strong>
                {billing ? (
                  <>
                    <div>{billing.firstname} {billing.lastname}</div>
                    {billing.company ? <div>{billing.company}</div> : null}
                    <div>{billing.street}</div>
                    <div>{[billing.city, billing.region].filter(Boolean).join(', ')}{billing.postcode ? `, ${billing.postcode}` : ''}</div>
                    <div>{countryLabel(billing.country_id)}</div>
                    <div>T: {billing.telephone}</div>
                  </>
                ) : (
                  <div>The customer does not have default billing address.</div>
                )}
              </div>
            </div>
          ) : null}

          {tab === 'account' ? (
            <form onSubmit={e => { e.preventDefault(); save(false) }}>
              {/* F-12 — the source's ui-form emits a `data-index` wrapper per
                * field plus the `customer` and `container_group` containers;
                * `[data-index="firstname"]` is how an evaluator addresses a row
                * on this page. `display: contents` keeps the extra elements out
                * of layout entirely. */}
              <div className="fieldset-wrapper" data-index="customer" style={{ display: 'contents' }}>
              <Fieldset legend="Account Information">
                <Field label="Associate to Website" required htmlFor="customer-website-id" short dataIndex="website_id">
                  <select
                    id="customer-website-id"
                    name="customer[website_id]"
                    className="admin__control-select"
                    value={form.website_id}
                    onChange={e => setForm(f => ({ ...f, website_id: e.target.value }))}
                  >
                    <option value="1">Main Website</option>
                  </select>
                </Field>
                {/* a <div>, not the source's <fieldset>: Chrome ignores
                  * `display: contents` on a fieldset, which broke this row's
                  * label/control alignment. `[data-index="container_group"]`
                  * resolves either way. */}
                <div className="admin__field" data-index="container_group" style={{ display: 'contents' }}>
                <Field label="Group" required htmlFor="customer-group-id" short dataIndex="group_id">
                  <select
                    id="customer-group-id"
                    name="customer[group_id]"
                    className="admin__control-select"
                    value={form.group_id}
                    onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}
                  >
                    {assignableGroups.map(g => (
                      <option key={g.customer_group_id} value={g.customer_group_id}>{g.customer_group_code}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Disable Automatic Group Change Based on VAT ID" htmlFor="customer-disable-auto-group" dataIndex="disable_auto_group_change">
                  {/* DOM-211 — the source emits an explicit `value="0"`; without
                    * it the browser reports the default `"on"`. */}
                  <input
                    id="customer-disable-auto-group"
                    name="customer[disable_auto_group_change]"
                    type="checkbox"
                    value="0"
                    className="admin__control-checkbox"
                    checked={Number(form.disable_auto_group_change) === 1}
                    onChange={e => setForm(f => ({ ...f, disable_auto_group_change: e.target.checked ? 1 : 0 }))}
                  />
                </Field>
                </div>
                <Field label="Name Prefix" htmlFor="customer-prefix" short dataIndex="prefix">
                  <input
                    id="customer-prefix" name="customer[prefix]" className="admin__control-text" type="text"
                    value={form.prefix} onChange={e => setForm(f => ({ ...f, prefix: e.target.value }))}
                  />
                </Field>
                <Field label="First Name" required htmlFor="customer-firstname" error={errors.firstname} dataIndex="firstname">
                  <input
                    id="customer-firstname" name="customer[firstname]" className="admin__control-text" type="text"
                    value={form.firstname} onChange={e => setForm(f => ({ ...f, firstname: e.target.value }))}
                  />
                </Field>
                <Field label="Middle Name/Initial" htmlFor="customer-middlename" dataIndex="middlename">
                  <input
                    id="customer-middlename" name="customer[middlename]" className="admin__control-text" type="text"
                    value={form.middlename} onChange={e => setForm(f => ({ ...f, middlename: e.target.value }))}
                  />
                </Field>
                <Field label="Last Name" required htmlFor="customer-lastname" error={errors.lastname} dataIndex="lastname">
                  <input
                    id="customer-lastname" name="customer[lastname]" className="admin__control-text" type="text"
                    value={form.lastname} onChange={e => setForm(f => ({ ...f, lastname: e.target.value }))}
                  />
                </Field>
                <Field label="Name Suffix" htmlFor="customer-suffix" short dataIndex="suffix">
                  <input
                    id="customer-suffix" name="customer[suffix]" className="admin__control-text" type="text"
                    value={form.suffix} onChange={e => setForm(f => ({ ...f, suffix: e.target.value }))}
                  />
                </Field>
                <Field label="Email" required htmlFor="customer-email" error={errors.email} dataIndex="email">
                  {/* DOM-209 — the source's email control is `type="email"`. */}
                  <input
                    id="customer-email" name="customer[email]" className="admin__control-text" type="email"
                    value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  />
                </Field>
                <Field label="Allow remote shopping assistance" htmlFor="customer-assistance-allowed" dataIndex="extension_attributes.assistance_allowed">
                  {/* DOM-210 — the source renders this as its toggle switch. */}
                  <div className="admin__actions-switch">
                    <input
                      id="customer-assistance-allowed"
                      name="customer[extension_attributes][assistance_allowed]"
                      type="checkbox"
                      value="1"
                      className="admin__actions-switch-checkbox"
                      checked={Number(form.assistance_allowed) === 1}
                      onChange={e => setForm(f => ({ ...f, assistance_allowed: e.target.checked ? 1 : 0 }))}
                    />
                    <label className="admin__actions-switch-label" htmlFor="customer-assistance-allowed" />
                  </div>
                </Field>
                <Field label="Date of Birth" htmlFor="customer-dob" short dataIndex="dob">
                  <input
                    id="customer-dob" name="customer[dob]" className="admin__control-text _has-datepicker" type="text"
                    value={form.dob || ''}
                    onChange={e => setForm(f => ({ ...f, dob: e.target.value }))}
                  />
                </Field>
                <Field label="Tax/VAT Number" htmlFor="customer-taxvat" short dataIndex="taxvat">
                  <input
                    id="customer-taxvat" name="customer[taxvat]" className="admin__control-text" type="text"
                    value={form.taxvat} onChange={e => setForm(f => ({ ...f, taxvat: e.target.value }))}
                  />
                </Field>
                <Field label="Gender" htmlFor="customer-gender" short dataIndex="gender">
                  <select
                    id="customer-gender" name="customer[gender]" className="admin__control-select"
                    value={form.gender} onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}
                  >
                    {/* DOM-219 — the source's empty option renders a single
                      * space, not a "-- Please Select --" caption. */}
                    <option value="">{' '}</option>
                    <option value="1">Male</option>
                    <option value="2">Female</option>
                    <option value="3">Not Specified</option>
                  </select>
                </Field>
                <Field label="Send Welcome Email From" htmlFor="customer-sendemail-store-id" short dataIndex="sendemail_store_id">
                  {/* DOM-210 */}
                  <select
                    id="customer-sendemail-store-id" name="customer[sendemail_store_id]"
                    className="admin__control-select"
                    value={form.sendemail_store_id}
                    onChange={e => setForm(f => ({ ...f, sendemail_store_id: e.target.value }))}
                  >
                    <optgroup label="Main Website"></optgroup>
                    <optgroup label="Main Website Store"></optgroup>
                    <option data-title="Main Website Store/Default Store View" value="1">
                      {'      Default Store View'}
                    </option>
                  </select>
                </Field>
              </Fieldset>
              </div>
            </form>
          ) : null}

          {tab === 'addresses' ? (
            <CustomerAddresses customer={customer} isNew={isNew} />
          ) : null}

          {tab === 'orders' ? (
            <FormSection title="Orders">
              <table className="admin__variations-grid">
                <thead>
                  <tr>
                    <th>Order</th><th>Purchased</th><th>Bill-to Name</th>
                    <th>Ship-to Name</th><th>Order Total</th><th>Purchase Point</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.length === 0 ? (
                    <tr><td colSpan={6}>We couldn&apos;t find any records.</td></tr>
                  ) : orders.map(o => (
                    <tr key={o.entity_id}>
                      <td>
                        <AdminLink to={`/admin/sales/order/view/order_id/${o.entity_id}/`}>
                          {o.increment_id || formatIncrementId(o.entity_id)}
                        </AdminLink>
                      </td>
                      <td>{formatDateTime(o.created_at)}</td>
                      <td>{o.billing_name}</td>
                      <td>{o.shipping_name}</td>
                      <td>{formatCurrency(o.grand_total)}</td>
                      <td>{o.store_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FormSection>
          ) : null}

          {tab === 'cart' ? (
            <FormSection title="Shopping cart">
              <div className="admin__data-grid-empty">There are no items in customer&apos;s shopping cart.</div>
            </FormSection>
          ) : null}

          {tab === 'newsletter' ? (
            <FormSection title="Newsletter Information">
              <Field label="Subscribed to Newsletter" htmlFor="customer-newsletter">
                <input
                  id="customer-newsletter"
                  name="subscription_status[1]"
                  type="checkbox"
                  className="admin__control-checkbox"
                  checked={Number(subscription?.subscriber_status) === 1}
                  onChange={e => {
                    if (subscription) {
                      updateCollectionItem('newsletterSubscribers', 'subscriber_id', subscription.subscriber_id,
                        { subscriber_status: e.target.checked ? 1 : 3 })
                    } else if (e.target.checked) {
                      const nextId = (state?.newsletterSubscribers || [])
                        .reduce((n, s) => Math.max(n, s.subscriber_id), 0) + 1
                      addCollectionItem('newsletterSubscribers', {
                        subscriber_id: nextId,
                        store_id: 1,
                        customer_id: customer.entity_id,
                        subscriber_email: customer.email,
                        subscriber_status: 1,
                      })
                    }
                    addMessage('You saved the customer.')
                  }}
                />
              </Field>
            </FormSection>
          ) : null}

          {tab === 'billing_agreements' ? (
            <FormSection title="Billing Agreements">
              <div className="admin__data-grid-empty">We couldn&apos;t find any records.</div>
            </FormSection>
          ) : null}

          {tab === 'reviews' ? (
            <FormSection title="Product Reviews">
              <table className="admin__variations-grid">
                <thead>
                  <tr><th>ID</th><th>Created</th><th>Status</th><th>Title</th><th>Nickname</th><th>Product</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {reviews.length === 0 ? (
                    <tr><td colSpan={7}>We couldn&apos;t find any records.</td></tr>
                  ) : reviews.map(r => (
                    <tr key={r.review_id}>
                      <td>{r.review_id}</td>
                      <td>{formatDateTime(r.created_at)}</td>
                      <td>{reviewStatusLabel(r.status_id)}</td>
                      <td>{r.title}</td>
                      <td>{r.nickname}</td>
                      <td>{r.product_name}</td>
                      <td><AdminLink to={`/admin/review/product/edit/id/${r.review_id}/`}>Edit</AdminLink></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FormSection>
          ) : null}

          {tab === 'wishlist' ? (
            <FormSection title="Wish List">
              <table className="admin__variations-grid">
                <thead>
                  <tr><th>ID</th><th>Product</th><th>User Description</th><th>Qty</th><th>Date Added</th><th>Action</th></tr>
                </thead>
                <tbody>
                  {!wishlist || !(wishlist.items || []).length ? (
                    <tr><td colSpan={6}>We couldn&apos;t find any records.</td></tr>
                  ) : wishlist.items.map(i => (
                    <tr key={i.wishlist_item_id || i.product_id}>
                      <td>{i.product_id}</td>
                      <td>{i.product_name || ''}</td>
                      <td>{i.description || ''}</td>
                      <td>{i.qty ?? 1}</td>
                      <td>{formatDateTime(i.added_at || wishlist.updated_at)}</td>
                      <td>
                        <button
                          type="button"
                          className="action-link"
                          onClick={() => {
                            removeWishlistItem(customer.entity_id, i.wishlist_item_id)
                            addMessage('You deleted the item from wish list.')
                          }}
                        >Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </FormSection>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}

/* ---------------------------------------------------------------- addresses */

function CustomerAddresses({ customer, isNew }) {
  const { updateCollectionItem, addMessage } = useApp()
  const [editing, setEditing] = useState(null)

  if (isNew || !customer) {
    return (
      <FormSection title="Addresses">
        <div className="admin__data-grid-empty">Save the customer before adding addresses.</div>
      </FormSection>
    )
  }

  const addresses = customer.addresses || []

  function saveAddress(next) {
    const list = next.entity_id
      ? addresses.map(a => (a.entity_id === next.entity_id ? { ...a, ...next } : a))
      : [...addresses, { ...next, entity_id: addresses.reduce((n, a) => Math.max(n, a.entity_id), 0) + 1, parent_id: customer.entity_id }]
    const primary = list.find(a => a.entity_id === (customer.default_billing ?? list[0]?.entity_id)) || list[0]
    updateCollectionItem('customers', 'entity_id', customer.entity_id, {
      addresses: list,
      billing_full: primary
        ? [primary.street, primary.city, primary.region, primary.postcode].filter(Boolean).join(' ')
        : customer.billing_full,
      billing_telephone: primary?.telephone ?? customer.billing_telephone,
    })
    addMessage('Customer address has been updated.')
    setEditing(null)
  }

  function deleteAddress(id) {
    updateCollectionItem('customers', 'entity_id', customer.entity_id, {
      addresses: addresses.filter(a => a.entity_id !== id),
    })
    addMessage('You deleted the address.')
  }

  return (
    <FormSection title="Addresses">
      <div className="page-actions">
        <button
          type="button"
          className="action-secondary"
          onClick={() => setEditing({
            firstname: customer.firstname, lastname: customer.lastname,
            street: '', city: '', region: '', postcode: '', country_id: 'US', telephone: '', company: '',
          })}
        >
          Add New Address
        </button>
      </div>

      <table className="admin__variations-grid">
        <thead>
          <tr>
            <th>First Name</th><th>Last Name</th><th>Street Address</th><th>City</th>
            <th>Country</th><th>State</th><th>Zip</th><th>Phone</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {addresses.length === 0 ? (
            <tr><td colSpan={9}>We couldn&apos;t find any records.</td></tr>
          ) : addresses.map(a => (
            <tr key={a.entity_id}>
              <td>{a.firstname}</td>
              <td>{a.lastname}</td>
              <td>{a.street}</td>
              <td>{a.city}</td>
              <td>{countryLabel(a.country_id)}</td>
              <td>{a.region}</td>
              <td>{a.postcode}</td>
              <td>{a.telephone}</td>
              <td>
                <button type="button" className="admin__field-inline-link" onClick={() => setEditing(a)}>Edit</button>
                {' | '}
                <button type="button" className="admin__field-inline-link" onClick={() => deleteAddress(a.entity_id)}>Delete</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editing ? (
        <AddressForm
          address={editing}
          onCancel={() => setEditing(null)}
          onSave={saveAddress}
        />
      ) : null}
    </FormSection>
  )
}

function AddressForm({ address, onCancel, onSave }) {
  const [a, setA] = useState(address)
  const set = (k, v) => setA(prev => ({ ...prev, [k]: v }))
  return (
    <form
      className="admin__form-section"
      onSubmit={e => { e.preventDefault(); onSave(a) }}
    >
      <div className="admin__form-section-title">
        {a.entity_id ? 'Edit Customer Address' : 'Add New Address'}
      </div>
      <Fieldset>
        <Field label="First Name" required htmlFor="address-firstname">
          <input id="address-firstname" name="address[firstname]" className="admin__control-text" value={a.firstname || ''} onChange={e => set('firstname', e.target.value)} />
        </Field>
        <Field label="Last Name" required htmlFor="address-lastname">
          <input id="address-lastname" name="address[lastname]" className="admin__control-text" value={a.lastname || ''} onChange={e => set('lastname', e.target.value)} />
        </Field>
        <Field label="Company" htmlFor="address-company">
          <input id="address-company" name="address[company]" className="admin__control-text" value={a.company || ''} onChange={e => set('company', e.target.value)} />
        </Field>
        <Field label="Street Address" required htmlFor="address-street">
          <input id="address-street" name="address[street][0]" className="admin__control-text" value={a.street || ''} onChange={e => set('street', e.target.value)} />
        </Field>
        <Field label="City" required htmlFor="address-city">
          <input id="address-city" name="address[city]" className="admin__control-text" value={a.city || ''} onChange={e => set('city', e.target.value)} />
        </Field>
        <Field label="Country" required htmlFor="address-country" short>
          <select id="address-country" name="address[country_id]" className="admin__control-select" value={a.country_id || ''} onChange={e => set('country_id', e.target.value)}>
            {COUNTRY_OPTIONS.map(o => <option key={o.value || 'blank'} value={o.value}>{o.label}</option>)}
          </select>
        </Field>
        <Field label="State/Province" htmlFor="address-region" short>
          <input id="address-region" name="address[region]" className="admin__control-text" value={a.region || ''} onChange={e => set('region', e.target.value)} />
        </Field>
        <Field label="Zip/Postal Code" required htmlFor="address-postcode" short>
          <input id="address-postcode" name="address[postcode]" className="admin__control-text" value={a.postcode || ''} onChange={e => set('postcode', e.target.value)} />
        </Field>
        <Field label="Phone Number" required htmlFor="address-telephone" short>
          <input id="address-telephone" name="address[telephone]" className="admin__control-text" value={a.telephone || ''} onChange={e => set('telephone', e.target.value)} />
        </Field>
      </Fieldset>
      <div className="page-actions">
        <button type="button" className="action-default" onClick={onCancel}>Cancel</button>
        <button type="submit" className="action-primary">Save</button>
      </div>
    </form>
  )
}
