import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useStoreNavigate } from '../utils/url.js'
import ProductImage from '../components/ProductImage.jsx'
import { productsById } from '../utils/catalog.js'
import { money } from '../utils/format.js'
import { flatRateShipping } from '../utils/orders.js'
import { US_REGIONS, COUNTRIES } from '../utils/geo.js'
import { ChevronDown } from '../components/Icons.jsx'

const EMPTY_ADDRESS = {
  firstname: '', lastname: '', company: '', street: ['', ''],
  countryId: 'US', region: '', city: '', postcode: '', telephone: '',
}

/**
 * ROUTES #20 — /checkout/, a two-step accordion (#shipping → #payment).
 *
 * Step 1 was captured from the live site (28-checkout.png). Step 2 was NOT
 * captured (SOURCE.md "Gaps" #1): it is built from Magento's stock Review &
 * Payments layout, so treat its strings as high-confidence-but-unverified.
 */
export default function CheckoutPage() {
  const { state, placeOrder, saveAddress, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const [step, setStep] = useState(() => (window.location.hash === '#payment' ? 'payment' : 'shipping'))
  const [selectedAddressId, setSelectedAddressId] = useState(state.customer.defaultShipping)
  const [showSummary, setShowSummary] = useState(false)
  const [openOptions, setOpenOptions] = useState({})
  const [showNewAddress, setShowNewAddress] = useState(false)
  const [newAddress, setNewAddress] = useState(EMPTY_ADDRESS)
  const [addressErrors, setAddressErrors] = useState({})

  /**
   * Magento's one-page checkout is hash-routed, so `/checkout/#payment` has to
   * open the payment step on a *hard* load and also when the hash changes in
   * place (browser back/forward, or an agent setting location.hash on the page
   * it is already on). `useState`'s initializer covers the first case only.
   */
  useEffect(() => {
    const sync = () => setStep(window.location.hash === '#payment' ? 'payment' : 'shipping')
    window.addEventListener('hashchange', sync)
    return () => window.removeEventListener('hashchange', sync)
  }, [])

  // PARITY-004: this page does not render through <Page>, so it has to set the
  // tab title itself or it keeps whatever the previous route left behind.
  // `assets/html/checkout.html` → <title>Checkout</title> (captured from the
  // live source; the success page's title is still SOURCE.md gap #1 — unobserved,
  // so it is deliberately left alone).
  useEffect(() => { document.title = 'Checkout' }, [])

  const items = state.cart.items
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  const itemCount = items.reduce((s, i) => s + i.qty, 0)
  const shipping = flatRateShipping(items)

  const goToPayment = () => {
    setStep('payment')
    window.location.hash = 'payment'
  }

  // The card the user clicked on step 1. Magento's Review & Payments step ships
  // with "My billing and shipping address are the same" checked, so this one
  // address drives the billing block AND both addresses on the placed order.
  const selectedAddress =
    state.addresses.find(a => a.id === selectedAddressId) ||
    state.addresses.find(a => a.id === state.customer.defaultBilling) ||
    state.addresses[0]

  const onPlaceOrder = () => {
    if (!items.length) return
    placeOrder({ shippingAmount: shipping, addressId: selectedAddressId })
    navigate('/checkout/onepage/success/')
  }

  /**
   * "Ship Here" — Magento's checkout-time new-address entry.
   *
   * The popup config is read off the source's own checkout page
   * (assets/html/checkout.html, `checkout.steps.shipping-step.shippingAddress`):
   *   popUpForm.element  = "#opc-new-shipping-address"
   *   options.modalClass = "new-shipping-address-modal"
   *   options.title      = "Shipping Address"
   *   buttons.save       = { text: "Ship Here",  class: "action primary action-save-address" }
   *   buttons.cancel     = { text: "Cancel",     class: "action secondary action-hide-popup" }
   * and the field order/labels from the same config's `shipping-address-fieldset`
   * sortOrder: firstname 20, lastname 40, company 60, street 70
   * (`Street Address: Line 1` / `Line 2`), country_id 80, region_id 90,
   * city 100, postcode 110, telephone 120.
   *
   * The address goes through `saveAddress()` — the same context action the
   * address book uses — so it lands in `state.addresses`, is visible to `/go`,
   * and `placeOrder({ addressId })` can resolve it into the order's shipping
   * AND billing address (VWA-246 / VWA-247 read it back off the order view).
   */
  const setAddr = (k, v) => setNewAddress(a => ({ ...a, [k]: v }))

  const onShipHere = (e) => {
    e.preventDefault()
    const a = newAddress
    const errs = {}
    if (!a.firstname.trim()) errs.firstname = 'This is a required field.'
    if (!a.lastname.trim()) errs.lastname = 'This is a required field.'
    if (!a.street[0].trim()) errs.street = 'This is a required field.'
    if (!a.city.trim()) errs.city = 'This is a required field.'
    if (!a.region.trim()) errs.region = 'Please select a region, state or province.'
    if (!a.postcode.trim()) errs.postcode = 'This is a required field.'
    if (!a.telephone.trim()) errs.telephone = 'This is a required field.'
    setAddressErrors(errs)
    if (Object.keys(errs).length) return

    const country = COUNTRIES.find(c => c.id === a.countryId)
    const id = saveAddress({
      id: null,
      firstname: a.firstname.trim(),
      lastname: a.lastname.trim(),
      company: a.company.trim() || null,
      telephone: a.telephone.trim(),
      street: a.street.map(s => s.trim()).filter(Boolean),
      city: a.city.trim(),
      region: a.region,
      regionId: (US_REGIONS.find(r => r.name === a.region) || {}).id || null,
      postcode: a.postcode.trim(),
      countryId: a.countryId,
      country: country ? country.name : 'United States',
      isDefaultBilling: false,
      isDefaultShipping: false,
    })
    setSelectedAddressId(id)
    setShowNewAddress(false)
    setNewAddress(EMPTY_ADDRESS)
    setAddressErrors({})
  }

  const onCancelNewAddress = () => {
    setShowNewAddress(false)
    setNewAddress(EMPTY_ADDRESS)
    setAddressErrors({})
  }

  const addressField = (id, name, label, key, { required = true, type = 'text' } = {}) => (
    <div className={`field${required ? ' required' : ''}`}>
      <label className="label" htmlFor={id}><span>{label}</span></label>
      <div className="control">
        <input type={type} id={id} name={name} value={newAddress[key]}
          onChange={e => setAddr(key, e.target.value)} />
        {/* Source emits `<div for="<name>" generated="true" class="mage-error">`
            for every failed field in this modal, not a `span.field-error`
            (DIFF-W02). The copy was already byte-correct. */}
        {addressErrors[key] && (
          <div htmlFor={name} generated="true" className="mage-error">{addressErrors[key]}</div>
        )}
      </div>
    </div>
  )

  const NewAddressModal = (
    <div aria-hidden={!showNewAddress}
      className={`modal-popup modal-slide new-shipping-address-modal${showNewAddress ? ' _show' : ''}`}
      style={{ display: showNewAddress ? 'block' : 'none' }}>
      <div className="modal-inner-wrap">
        <header className="modal-header">
          <h1 className="modal-title">Shipping Address</h1>
          <button type="button" className="action-close" data-role="closeBtn"
            onClick={onCancelNewAddress}><span>Close</span></button>
        </header>
        <div className="modal-content">
          <div id="opc-new-shipping-address">
            <form className="form form-shipping-address" id="co-shipping-form" onSubmit={onShipHere} noValidate>
              <fieldset className="fieldset address">
                {addressField('firstname', 'firstname', 'First Name', 'firstname')}
                {addressField('lastname', 'lastname', 'Last Name', 'lastname')}
                {addressField('company', 'company', 'Company', 'company', { required: false })}
                <div className="field street required">
                  <label className="label" htmlFor="street_1"><span>Street Address</span></label>
                  <div className="control">
                    <div className="field primary">
                      <label className="label" htmlFor="street_1"><span>Street Address: Line 1</span></label>
                    </div>
                    <input type="text" id="street_1" name="street[0]" value={newAddress.street[0]}
                      onChange={e => setAddr('street', [e.target.value, newAddress.street[1]])} />
                    {addressErrors.street && (
                      <div htmlFor="street[0]" generated="true" className="mage-error">{addressErrors.street}</div>
                    )}
                    <div className="nested">
                      <div className="field additional">
                        <label className="label" htmlFor="street_2"><span>Street Address: Line 2</span></label>
                        <div className="control">
                          <input type="text" id="street_2" name="street[1]" value={newAddress.street[1]}
                            onChange={e => setAddr('street', [newAddress.street[0], e.target.value])} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="field country required">
                  <label className="label" htmlFor="country"><span>Country</span></label>
                  <div className="control">
                    <select id="country" name="country_id" value={newAddress.countryId}
                      onChange={e => setAddr('countryId', e.target.value)}>
                      {COUNTRIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>
                <div className="field region required">
                  <label className="label" htmlFor="region_id"><span>State/Province</span></label>
                  <div className="control">
                    {newAddress.countryId === 'US' ? (
                      <select id="region_id" name="region_id" value={newAddress.region}
                        onChange={e => setAddr('region', e.target.value)}>
                        <option value="">Please select a region, state or province.</option>
                        {US_REGIONS.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                      </select>
                    ) : (
                      <input type="text" id="region_id" name="region" value={newAddress.region}
                        onChange={e => setAddr('region', e.target.value)} />
                    )}
                    {addressErrors.region && (
                      <div htmlFor={newAddress.countryId === 'US' ? 'region_id' : 'region'}
                        generated="true" className="mage-error">{addressErrors.region}</div>
                    )}
                  </div>
                </div>
                {addressField('city', 'city', 'City', 'city')}
                {addressField('zip', 'postcode', 'Zip/Postal Code', 'postcode')}
                {addressField('telephone', 'telephone', 'Phone Number', 'telephone', { type: 'tel' })}
              </fieldset>
            </form>
          </div>
        </div>
        <footer className="modal-footer">
          <button type="button" className="action secondary action-hide-popup" onClick={onCancelNewAddress}>
            <span>Cancel</span>
          </button>
          <button type="button" className="action primary action-save-address" onClick={onShipHere}>
            <span>Ship Here</span>
          </button>
        </footer>
      </div>
    </div>
  )

  /**
   * The order summary rail, transcribed node for node from the source's own
   * `#opc-sidebar` (captured from an authenticated `/checkout/` with a
   * non-empty cart — `/tmp/vwaE/opc-sidebar.html`):
   *
   *   div#opc-sidebar
   *     div.opc-block-summary
   *       span.title                       "Order Summary"
   *       table.data.table.table-totals    (payment step only)
   *       div.block.items-in-cart
   *         div.title[data-role=title]     "<n> Items in Cart"
   *         div.content.minicart-items[data-role=content]
   *           div.minicart-items-wrapper
   *             ol.minicart-items
   *               li.product-item > div.product > …
   *     div.opc-block-shipping-information
   *
   * Two things here are load-bearing for VWA's evaluator, which runs
   * `#opc-sidebar > div.opc-block-summary > div > div.content.minicart-items > div > ol`:
   *   1. `opc-sidebar` is an **id**, not a class.
   *   2. Collapsing the block hides `div.content.minicart-items` with
   *      `display: none` — the source does exactly that and keeps the `<ol>`
   *      in the DOM. Unmounting it makes the selector return null.
   * `#opc-sidebar > div.opc-block-summary > div` resolves to
   * `div.block.items-in-cart` because the totals node above it is a `<table>`.
   */
  const OrderSummary = (
    <div id="opc-sidebar">
      <div className="opc-block-summary">
        <span className="title">Order Summary</span>
        {step === 'payment' && (
          <table className="data table table-totals">
            <tbody>
              <tr className="totals sub">
                <th className="mark" scope="row">Cart Subtotal</th>
                <td className="amount"><span className="price">{money(subtotal)}</span></td>
              </tr>
              <tr className="totals shipping excl">
                <th className="mark" scope="row">Shipping <span className="value">Flat Rate - Fixed</span></th>
                <td className="amount"><span className="price">{money(shipping)}</span></td>
              </tr>
              <tr className="grand totals">
                <th className="mark" scope="row"><strong>Order Total</strong></th>
                <td className="amount"><strong><span className="price">{money(subtotal + shipping)}</span></strong></td>
              </tr>
            </tbody>
          </table>
        )}
        <div className={`block items-in-cart${showSummary ? ' active' : ''}`}
          data-collapsible="true" role="tablist">
          <div className="title" data-role="title" role="tab"
            aria-selected={showSummary} aria-expanded={showSummary} tabIndex={0}
            onClick={() => setShowSummary(s => !s)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setShowSummary(s => !s) } }}>
            <strong role="heading" aria-level="1">
              <span>{itemCount}</span>{' '}
              <span>Items in Cart</span>
            </strong>
            <ChevronDown size={14} />
          </div>
          <div className="content minicart-items" data-role="content" role="tabpanel"
            aria-hidden={!showSummary}
            style={showSummary ? undefined : { display: 'none' }}>
            <div className="minicart-items-wrapper">
              <ol className="minicart-items">
                {items.map(i => {
                  const product = productsById.get(i.productId)
                  const options = i.options || []
                  const open = !!openOptions[i.itemId]
                  return (
                    <li className="product-item" key={i.itemId}>
                      <div className="product">
                        <ProductImage product={product} alt={i.name} />
                        <div className="product-item-details">
                          <div className="product-item-inner">
                            <div className="product-item-name-block">
                              <strong className="product-item-name">{i.name}</strong>
                              <div className="details-qty">
                                <span className="label"><span>Qty</span></span>{' '}
                                <span className="value">{i.qty}</span>
                              </div>
                            </div>
                            <div className="subtotal">
                              <span className="price-excluding-tax" data-label="Excl. Tax">
                                <span className="cart-price">
                                  <span className="price">{money(i.price * i.qty)}</span>
                                </span>
                              </span>
                            </div>
                          </div>
                          {options.length > 0 && (
                            <div className={`product options${open ? ' active' : ''}`}
                              data-collapsible="true" role="tablist">
                              <span data-role="title" className="toggle" role="tab"
                                aria-selected={open} aria-expanded={open} tabIndex={0}
                                onClick={() => setOpenOptions(s => ({ ...s, [i.itemId]: !s[i.itemId] }))}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    setOpenOptions(s => ({ ...s, [i.itemId]: !s[i.itemId] }))
                                  }
                                }}>
                                <span>View Details</span>
                              </span>
                              <div data-role="content" className="content" role="tabpanel"
                                aria-hidden={!open} style={open ? undefined : { display: 'none' }}>
                                <strong className="subtitle"><span>Options Details</span></strong>
                                <dl className="item-options">
                                  {options.map(o => (
                                    <React.Fragment key={`${o.optionId}-${o.optionTypeId}`}>
                                      <dt className="label">{o.label}</dt>
                                      <dd className="values">{o.value}</dd>
                                    </React.Fragment>
                                  ))}
                                </dl>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </li>
                  )
                })}
              </ol>
            </div>
          </div>
        </div>
      </div>
      <div className="opc-block-shipping-information">
        {step === 'payment' && selectedAddress && (
          <div className="ship-to">
            <div className="shipping-information-title"><span>Ship To:</span></div>
            <div className="shipping-information-content">
              {selectedAddress.firstname} {selectedAddress.lastname}<br />
              {(Array.isArray(selectedAddress.street) ? selectedAddress.street : [selectedAddress.street]).join(', ')}<br />
              {selectedAddress.city}, {selectedAddress.region}, {selectedAddress.postcode}<br />
              {selectedAddress.country || 'United States'}<br />
              {selectedAddress.telephone}
            </div>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <main id="maincontent" className="page-main">
      <div className="page-title-wrapper visually-hidden">
        <h1 className="page-title"><span className="base">Checkout</span></h1>
      </div>

      <div className="opc-progress-bar">
        <div className={`opc-progress-bar-item${step === 'shipping' || step === 'payment' ? ' _active' : ''}`}>
          <span>Shipping</span>
        </div>
        <div className={`opc-progress-bar-item${step === 'payment' ? ' _active' : ''}`}>
          <span>Review &amp; Payments</span>
        </div>
      </div>

      {items.length === 0 ? (
        <p>You have no items in your shopping cart. <SLink to="/">Continue shopping</SLink>.</p>
      ) : (
        <div className="opc-wrapper">
          <div className="opc-main">
            {step === 'shipping' ? (
              <div id="shipping" className="checkout-shipping-address">
                <div className="step-title">Shipping Address</div>
                <div className="shipping-address-items" style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
                  {state.addresses.map(a => (
                    <div
                      key={a.id}
                      className={`shipping-address-item${a.id === selectedAddressId ? ' selected-item' : ''}`}
                      role="button"
                      tabIndex={0}
                      onClick={() => setSelectedAddressId(a.id)}
                      onKeyDown={e => { if (e.key === 'Enter') setSelectedAddressId(a.id) }}
                    >
                      {a.firstname} {a.lastname}<br />
                      {(Array.isArray(a.street) ? a.street : [a.street]).map((s, i) => <span key={i}>{s}<br /></span>)}
                      {a.city}, {a.region} {a.postcode}<br />
                      {a.country || 'United States'}<br />
                      <a href="#" onClick={e => e.preventDefault()}>{a.telephone}</a>
                    </div>
                  ))}
                </div>
                {/* Magento opens the address form in a popup ON the checkout
                    page — it does not navigate to /customer/address/new/, which
                    would abandon the checkout (VWA-246 / VWA-247 depend on
                    finishing the order from here). */}
                <button type="button" className="action secondary action-show-popup" style={{ marginTop: 15 }}
                  onClick={() => setShowNewAddress(true)}>
                  <span>+ New Address</span>
                </button>
                {NewAddressModal}

                <div className="step-title" style={{ marginTop: 40 }}>Shipping Methods</div>
                <table className="table-checkout-shipping-method">
                  <tbody>
                    <tr>
                      <td><input type="radio" name="shipping_method" defaultChecked readOnly /></td>
                      <td>{money(shipping)}</td>
                      <td>Fixed</td>
                      <td>Flat Rate</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button type="button" className="action primary large button" onClick={goToPayment}>
                    <span>Next</span>
                  </button>
                </div>
              </div>
            ) : (
              <div id="payment" className="checkout-payment-method">
                <div className="step-title">Review &amp; Payments</div>
                <div className="payment-method">
                  <div className="payment-method-title">
                    <input type="radio" name="payment[method]" id="checkmo" defaultChecked readOnly />{' '}
                    <label htmlFor="checkmo"><span>Check / Money order</span></label>
                  </div>
                  <div className="payment-method-content" style={{ padding: '20px 0' }}>
                    <div className="billing-address-details">
                      <strong>Billing Address</strong>
                      {(() => {
                        const a = selectedAddress
                        if (!a) return null
                        return (
                          <address>
                            {a.firstname} {a.lastname}<br />
                            {(Array.isArray(a.street) ? a.street : [a.street]).join(', ')}<br />
                            {/* Magento's address template emits TWO spaces after
                                the city — `San Mateo,  California, 94010`
                                (assets/html/order-view-148.html). */}
                            {a.city}{',  '}{a.region}, {a.postcode}<br />
                            {a.country || 'United States'}<br />
                            T: {a.telephone}
                          </address>
                        )
                      })()}
                    </div>
                    <div className="actions-toolbar" style={{ marginTop: 20 }}>
                      <button type="button" className="action primary checkout large" onClick={onPlaceOrder}>
                        <span>Place Order</span>
                      </button>
                      <button type="button" className="action secondary"
                        onClick={() => { setStep('shipping'); window.location.hash = 'shipping' }}>
                        <span>Back</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          {OrderSummary}
        </div>
      )}
    </main>
  )
}
