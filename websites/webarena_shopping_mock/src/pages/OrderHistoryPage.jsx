import React from 'react'
import Page from '../components/Page.jsx'
import { Pager } from '../components/Toolbar.jsx'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useUrlBuilder, useStoreNavigate } from '../utils/url.js'
import { useNavigate } from 'react-router-dom'
import { money, shortDate, statusLabel } from '../utils/format.js'
import { sortedOrders } from '../utils/orders.js'

const LIMITS = [10, 20, 50]

/** ROUTES #28 — /sales/order/history/. 10 per page, 37 rows, 4 pages. */
export default function OrderHistoryPage() {
  const { state, reorder, addMessage } = useApp()
  const { query, withParams } = useUrlBuilder()
  const navigate = useNavigate()
  const storeNavigate = useStoreNavigate()

  const limit = LIMITS.includes(parseInt(query.limit, 10)) ? parseInt(query.limit, 10) : 10
  const page = Math.max(1, parseInt(query.p, 10) || 1)

  const all = sortedOrders(state.orders)
  const total = all.length
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const rows = all.slice((page - 1) * limit, page * limit)
  const first = total === 0 ? 0 : (page - 1) * limit + 1
  const last = Math.min(page * limit, total)

  const onReorder = (order) => {
    reorder(order.entityId)
    addMessage(`You added ${order.items.length} product(s) to your shopping cart.`)
    storeNavigate('/checkout/cart/')
  }

  return (
    <Page title="My Orders" documentTitle="My Orders" sidebar="account">
      {total === 0 ? (
        <div className="message info"><div>You have placed no orders.</div></div>
      ) : (
        <>
          <table className="data table table-order-items history" id="my-orders-table">
            <caption className="table-caption">Orders</caption>
            <thead>
              <tr>
                <th scope="col" className="col id">Order #</th>
                <th scope="col" className="col date">Date</th>
                <th scope="col" className="col total">Order Total</th>
                <th scope="col" className="col status">Status</th>
                <th scope="col" className="col actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(o => (
                <tr key={o.entityId}>
                  <td className="col id" data-th="Order #">{o.incrementId}</td>
                  <td className="col date" data-th="Date">{shortDate(o.createdAt)}</td>
                  <td className="col total" data-th="Order Total">{money(o.grandTotal)}</td>
                  <td className="col status" data-th="Status">{statusLabel(o.status)}</td>
                  <td className="col actions" data-th="Action">
                    <SLink className="action view" to={`/sales/order/view/order_id/${o.entityId}/`}>
                      <span>View Order</span>
                    </SLink>{' '}
                    <a className="action order" href="#" onClick={e => { e.preventDefault(); onReorder(o) }}>
                      <span>Reorder</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="toolbar toolbar-bottom order-products-toolbar">
            <p className="toolbar-amount">Items {first} to {last} of {total} total</p>
            <div style={{ margin: '0 auto' }}>
              <Pager page={page} totalPages={totalPages} param="p" windowSize={4} />
            </div>
            <div className="field limiter">
              <label className="label" htmlFor="order-limiter"><span>Show</span></label>
              <select id="order-limiter" className="limiter-options" value={limit}
                onChange={e => navigate(withParams({ limit: e.target.value, p: null }))}>
                {LIMITS.map(v => <option key={v} value={v}>{v}</option>)}
              </select>
              <span className="limiter-text">per page</span>
            </div>
          </div>
        </>
      )}
      <div className="actions-toolbar">
        <div className="secondary">
          <SLink to="/" className="action back"><span>Back</span></SLink>
        </div>
      </div>
    </Page>
  )
}
