import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { SLink } from '../utils/url.js'

/**
 * ROUTES #21 — /checkout/onepage/success/.
 * Copy taken from Magento's stock success page; SOURCE.md "Gaps" #1 records
 * that this page was never rendered on the live container.
 */
export default function CheckoutSuccessPage() {
  const { state } = useApp()
  const order = state.lastPlacedOrderId
    ? state.orders.find(o => o.entityId === state.lastPlacedOrderId)
    : state.orders[0]

  return (
    <main id="maincontent" className="page-main">
      <div className="page-title-wrapper">
        <h1 className="page-title"><span className="base">Thank you for your purchase!</span></h1>
      </div>
      <div className="checkout-success">
        {order && (
          <p>Your order number is: <SLink to={`/sales/order/view/order_id/${order.entityId}/`}>
            <strong>{order.incrementId}</strong>
          </SLink>.</p>
        )}
        <p>We&#039;ll email you an order confirmation with details and tracking info.</p>
        <div className="actions-toolbar">
          <SLink to="/" className="action primary continue"><span>Continue Shopping</span></SLink>
        </div>
      </div>
    </main>
  )
}
