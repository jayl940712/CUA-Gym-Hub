import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useStoreNavigate } from '../utils/url.js'
import ProductImage from '../components/ProductImage.jsx'
import { productsById } from '../utils/catalog.js'
import { money } from '../utils/format.js'
import { flatRateShipping } from '../utils/orders.js'
import { ChevronDown } from '../components/Icons.jsx'

/**
 * ROUTES #20 — /checkout/, a two-step accordion (#shipping → #payment).
 *
 * Step 1 was captured from the live site (28-checkout.png). Step 2 was NOT
 * captured (SOURCE.md "Gaps" #1): it is built from Magento's stock Review &
 * Payments layout, so treat its strings as high-confidence-but-unverified.
 */
export default function CheckoutPage() {
  const { state, placeOrder, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const [step, setStep] = useState(() => (window.location.hash === '#payment' ? 'payment' : 'shipping'))
  const [selectedAddressId, setSelectedAddressId] = useState(state.customer.defaultShipping)
  const [showSummary, setShowSummary] = useState(false)

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

  const OrderSummary = (
    <div className="opc-sidebar">
      <div className="opc-block-summary">
        <span className="title">Order Summary</span>
        {step === 'payment' && (
          <table className="data table totals" style={{ width: '100%', marginBottom: 15 }}>
            <tbody>
              <tr><th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 400 }}>Cart Subtotal</th>
                <td style={{ textAlign: 'right' }}>{money(subtotal)}</td></tr>
              <tr><th style={{ textAlign: 'left', padding: '6px 0', fontWeight: 400 }}>Shipping</th>
                <td style={{ textAlign: 'right' }}>{money(shipping)}</td></tr>
              <tr><th style={{ textAlign: 'left', padding: '6px 0' }}><strong>Order Total</strong></th>
                <td style={{ textAlign: 'right' }}><strong>{money(subtotal + shipping)}</strong></td></tr>
            </tbody>
          </table>
        )}
        <div className="items-in-cart">
          <div className="title" role="button" tabIndex={0}
            onClick={() => setShowSummary(s => !s)}
            onKeyDown={e => { if (e.key === 'Enter') setShowSummary(s => !s) }}>
            <strong><span>{itemCount} Items in Cart</span></strong>
            <ChevronDown size={14} />
          </div>
          {showSummary && (
            <ol className="minicart-items">
              {items.map(i => {
                const product = productsById.get(i.productId)
                return (
                  <li className="product-item" key={i.itemId}>
                    <ProductImage product={product} alt={i.name} />
                    <div className="product-item-details">
                      <strong className="product-item-name">{i.name}</strong>
                      <div className="details-qty">Qty: {i.qty}</div>
                      <div className="price">{money(i.price * i.qty)}</div>
                    </div>
                  </li>
                )
              })}
            </ol>
          )}
        </div>
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
                <button type="button" className="action secondary action-show-popup" style={{ marginTop: 15 }}
                  onClick={() => navigate('/customer/address/new/')}>
                  <span>+ New Address</span>
                </button>

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
                            {a.city}, {a.region}, {a.postcode}<br />
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
