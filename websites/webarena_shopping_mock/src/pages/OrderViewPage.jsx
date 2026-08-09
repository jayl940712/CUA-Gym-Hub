import React from 'react'
import Page from '../components/Page.jsx'
import { OrderAddressCard } from '../components/AddressCard.jsx'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useStoreNavigate } from '../utils/url.js'
import { money, longDate, statusLabel } from '../utils/format.js'
import { findOrder } from '../utils/orders.js'
import NotFoundPage from './NotFoundPage.jsx'

export function OrderItemsTable({ order }) {
  return (
    <table className="data table table-order-items" id="my-orders-table">
      <caption className="table-caption visually-hidden">Items Ordered</caption>
      <thead>
        <tr>
          <th className="col name" scope="col">Product Name</th>
          <th className="col sku" scope="col">SKU</th>
          <th className="col price" scope="col">Price</th>
          <th className="col qty" scope="col">Qty</th>
          <th className="col subtotal" scope="col">Subtotal</th>
        </tr>
      </thead>
      <tbody>
        {order.items.map(item => (
          <tr key={item.itemId} id={`order-item-row-${item.itemId}`}>
            <td className="col name" data-th="Product Name">
              <strong className="product name product-item-name">{item.name}</strong>
              {item.options && item.options.length > 0 && (
                <dl className="item-options">
                  {item.options.map((o, i) => (
                    <React.Fragment key={i}>
                      <dt>{o.label}</dt>
                      <dd>{o.value}</dd>
                    </React.Fragment>
                  ))}
                </dl>
              )}
            </td>
            <td className="col sku" data-th="SKU">{item.sku}</td>
            <td className="col price" data-th="Price"><span className="price">{money(item.price)}</span></td>
            <td className="col qty" data-th="Qty">
              <ul className="items-qty">
                {/* No separator in the markup — the source's `: ` comes from
                    `.items-qty .title:after{content:': '}` in styles-m.css, so
                    the anchored `.order-details-items.ordered` outerText reads
                    `Ordered1`, not `Ordered: 1`. */}
                <li className="item"><span className="title">Ordered</span><span className="content">{item.qtyOrdered}</span></li>
              </ul>
            </td>
            <td className="col subtotal" data-th="Subtotal"><span className="price">{money(item.rowTotal)}</span></td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="subtotal">
          <th colSpan={4} className="mark" scope="row">Subtotal</th>
          <td className="amount" data-th="Subtotal"><span className="price">{money(order.subtotal)}</span></td>
        </tr>
        <tr className="shipping">
          <th colSpan={4} className="mark" scope="row">Shipping &amp; Handling</th>
          <td className="amount" data-th="Shipping &amp; Handling"><span className="price">{money(order.shippingAmount)}</span></td>
        </tr>
        <tr className="grand_total">
          <th colSpan={4} className="mark" scope="row"><strong>Grand Total</strong></th>
          <td className="amount" data-th="Grand Total"><strong><span className="price">{money(order.grandTotal)}</span></strong></td>
        </tr>
      </tfoot>
    </table>
  )
}

export function OrderInformation({ order }) {
  return (
    <div className="block block-order-details-view">
      <div className="block-title"><strong>Order Information</strong></div>
      {/* Source DOM order is a flat list — shipping address, shipping method,
          billing address, payment method — laid into two columns by CSS.
          Reading the boxes in document order must give that sequence. */}
      <div className="block-content">
        <div className="box box-order-shipping-address">
          <strong className="box-title"><span>Shipping Address</span></strong>
          <div className="box-content"><OrderAddressCard address={order.shippingAddress} /></div>
        </div>
        <div className="box box-order-shipping-method">
          <strong className="box-title"><span>Shipping Method</span></strong>
          <div className="box-content">{order.shippingDescription}</div>
        </div>
        <div className="box box-order-billing-address">
          <strong className="box-title"><span>Billing Address</span></strong>
          <div className="box-content"><OrderAddressCard address={order.billingAddress} /></div>
        </div>
        <div className="box box-order-billing-method">
          <strong className="box-title"><span>Payment Method</span></strong>
          <div className="box-content">
            <dl className="payment-method checkmemo">
              <dt className="title">{order.paymentTitle}</dt>
            </dl>
          </div>
        </div>
      </div>
    </div>
  )
}

/** ROUTES #29 — /sales/order/view/order_id/:id/ */
export default function OrderViewPage({ orderId }) {
  const { state, reorder, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const order = findOrder(state.orders, orderId)

  if (!order) return <NotFoundPage />

  const onReorder = () => {
    reorder(order.entityId)
    addMessage(`You added ${order.items.length} product(s) to your shopping cart.`)
    navigate('/checkout/cart/')
  }

  return (
    <Page
      title={`Order # ${order.incrementId}`}
      documentTitle={`Order # ${order.incrementId}`}
      sidebar="account"
    >
      <div className="order-status">{statusLabel(order.status)}</div>
      <div className="order-date"><span className="label">Order Date: </span>{longDate(order.createdAt)}</div>

      <div className="actions-toolbar order-actions-toolbar">
        <a className="action order" href="#" onClick={e => { e.preventDefault(); onReorder() }}>
          <span>Reorder</span>
        </a>
        <SLink className="action print" to={`/sales/order/print/order_id/${order.entityId}/`} target="_self">
          <span>Print Order</span>
        </SLink>
      </div>

      <div className="order-links">
        <ul className="items order-links">
          <li className="nav item current"><strong>Items Ordered</strong></li>
        </ul>
      </div>

      <div className="order-details-items ordered">
        <div className="order-title"><strong>Items Ordered</strong></div>
        <OrderItemsTable order={order} />
        {/* The source closes the items block with this link, between the
            totals table and Order Information. */}
        <div className="actions-toolbar">
          <div className="secondary">
            <SLink className="action back" to="/sales/order/history/"><span>Back to My Orders</span></SLink>
          </div>
        </div>
      </div>

      <OrderInformation order={order} />
    </Page>
  )
}
