import React, { useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { SLink } from '../utils/url.js'
import { longDate, statusLabel } from '../utils/format.js'
import { findOrder } from '../utils/orders.js'
import { OrderItemsTable, OrderInformation } from './OrderViewPage.jsx'
import NotFoundPage from './NotFoundPage.jsx'

/** ROUTES #30 — /sales/order/print/order_id/:id/ — no site chrome. */
export default function OrderPrintPage({ orderId }) {
  const { state } = useApp()
  const order = findOrder(state.orders, orderId)

  useEffect(() => {
    if (order) document.title = `Order # ${order.incrementId}`
  }, [order])

  if (!order) return <NotFoundPage />

  return (
    <main id="maincontent" className="page-main">
      <div className="page-title-wrapper">
        <h1 className="page-title"><span className="base">Order # {order.incrementId}</span></h1>
      </div>
      <div className="order-status">{statusLabel(order.status)}</div>
      <div className="order-date"><span className="label">Order Date: </span>{longDate(order.createdAt)}</div>
      <div className="order-details-items ordered">
        <div className="order-title"><strong>Items Ordered</strong></div>
        <OrderItemsTable order={order} />
      </div>
      <OrderInformation order={order} />
      <div className="actions-toolbar" style={{ marginTop: 30 }}>
        <button type="button" className="action primary" onClick={() => window.print()}>
          <span>Print</span>
        </button>
        <SLink to={`/sales/order/view/order_id/${order.entityId}/`}>Back to Order</SLink>
      </div>
    </main>
  )
}
