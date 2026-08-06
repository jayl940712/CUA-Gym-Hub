import React, { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import NotFound from '../NotFound.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { getOrder, getCustomer, getOrders, customerGroupLabel } from '../../utils/selectors.js'
import * as S from '../../utils/staticData.js'
import { useSidNavigate } from '../../utils/navigation.js'
import { formatCurrency, formatQty } from '../../utils/formatters.js'
import { AddressLines } from '../../components/sales/OrderBlocks.jsx'
import {
  num, orderTotals, visibleItems, makeHistoryEntry, nowSeedTimestamp,
} from '../../components/sales/orderHelpers.js'
import '../../components/sales/sales.css'

/**
 * ROUTES rows 28-29 — Create New Order.
 *   /admin/sales/order_create/reorder/order_id/:id/     reorder an existing order
 *   /admin/sales/order_create/start/customer_id/:id/    start from a customer
 *
 * Both land on the same screen; the entry point only decides what is prefilled.
 * The item lines, addresses and account block are the real records out of
 * `orders.json` / `customers.json` — nothing here is generated.
 *
 * PIPELINE-008 / HANDLERS-023: Submit Order now really places the order. It
 * appends to `state.newOrders` (declared in `createInitialData()`), seeds the
 * order's `orderComments` entry the way Magento's first status history row
 * does, and redirects to the new order's view page — so the order is reachable,
 * appears in the Sales > Orders grid, and shows up in /go's state_diff. The id
 * and increment_id continue the real sequence from `staticData.maxOrderId`.
 */

const SHIPPING_METHODS = [
  { value: 'flatrate_flatrate', label: 'Flat Rate - Fixed' },
  { value: 'tablerate_bestway', label: 'Best Way - Table Rate' },
  { value: 'freeshipping_freeshipping', label: 'Free Shipping - Free' },
]

const PAYMENT_METHODS = [
  { value: 'checkmo', label: 'Check / Money order' },
  { value: 'banktransfer', label: 'Bank Transfer Payment' },
  { value: 'cashondelivery', label: 'Cash On Delivery' },
  { value: 'purchaseorder', label: 'Purchase Order' },
]

export default function OrderCreate({ from = 'customer' }) {
  const { id } = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()

  /* `reorder` and `edit` both start from an existing order; `customer` starts
   * from a customer id. Magento's Edit re-opens the order as a new quote, so it
   * lands on the same screen prefilled the same way. */
  const fromOrder = from === 'reorder' || from === 'edit'
  const sourceOrder = fromOrder ? getOrder(state, id) : null
  const customerId = fromOrder ? sourceOrder?.customer_id : id
  const customer = customerId ? getCustomer(state, customerId) : null

  /** Starting from a customer, Magento prefills nothing but the account block. */
  const items = useMemo(
    () => (sourceOrder ? visibleItems(sourceOrder) : []),
    [sourceOrder])

  const [qtys, setQtys] = useState(() => {
    const init = {}
    for (const i of items) init[i.item_id] = num(i.qty_ordered)
    return init
  })
  const [shippingMethod, setShippingMethod] = useState('flatrate_flatrate')
  const [paymentMethod, setPaymentMethod] = useState(sourceOrder?.payment?.method || 'checkmo')
  const [comment, setComment] = useState('')

  if (fromOrder && !sourceOrder) return <NotFound />

  const subtotal = items.reduce((sum, i) => sum + num(qtys[i.item_id]) * num(i.price), 0)
  const totals = sourceOrder ? orderTotals(sourceOrder) : { shipping: 0, tax: 0, discount: 0 }
  const grand = subtotal + totals.shipping + totals.tax - totals.discount

  const billing = sourceOrder?.addresses?.find(a => a.address_type === 'billing')
  const shipping = sourceOrder?.addresses?.find(a => a.address_type === 'shipping')

  const backTo = sourceOrder
    ? `/admin/sales/order/view/order_id/${sourceOrder.entity_id}/`
    : '/admin/sales/order/'

  /**
   * `#reset_order_top_button`, labelled **Cancel** on the source (not "Reset" —
   * read off the live page's own `.page-actions`). Magento posts it to
   * `sales/order_create/cancel`, which discards the in-progress quote and
   * returns to wherever the screen was entered from, so the mock drops every
   * edit and navigates back. Nothing is persisted, so nothing reaches
   * `saveState` — the source writes nothing here either.
   */
  function cancelOrder() {
    const init = {}
    for (const i of items) init[i.item_id] = num(i.qty_ordered)
    setQtys(init)
    setShippingMethod('flatrate_flatrate')
    setPaymentMethod(sourceOrder?.payment?.method || 'checkmo')
    setComment('')
    navigate(backTo)
  }

  /**
   * Magento's OrderCreate refuses an empty quote —
   * `Adminhtml/Order/Create/Save.php` surfaces "Please specify order items."
   * A customer is required too, since the whole screen hangs off a quote that
   * belongs to one.
   */
  function submitOrder() {
    if (!customer) {
      addMessage('Please select a customer to start the order.', 'error')
      return
    }
    const lines = items
      .map(i => ({ ...i, qty_ordered: num(qtys[i.item_id]) }))
      .filter(i => i.qty_ordered > 0)
    if (lines.length === 0) {
      addMessage('Please specify order items.', 'error')
      return
    }

    const existing = state?.newOrders || []
    const entityId = existing.reduce((m, o) => Math.max(m, Number(o.entity_id) || 0), S.maxOrderId) + 1
    const incrementNum = existing.reduce(
      (m, o) => Math.max(m, Number(String(o.increment_id).replace(/\D/g, '')) || 0),
      S.orderGrid.reduce((m, r) => Math.max(m, Number(String(r.increment_id).replace(/\D/g, '')) || 0), 0),
    ) + 1
    const now = nowSeedTimestamp()
    const shipDesc = SHIPPING_METHODS.find(m => m.value === shippingMethod)?.label || ''
    const qtyTotal = lines.reduce((n, i) => n + i.qty_ordered, 0)

    const order = {
      entity_id: entityId,
      increment_id: String(incrementNum).padStart(9, '0'),
      state: 'new',
      status: 'pending',
      customer_id: Number(customer.entity_id),
      customer_email: customer.email,
      customer_firstname: customer.firstname,
      customer_lastname: customer.lastname,
      customer_group_id: Number(customer.group_id ?? customer.customer_group_id ?? 1),
      created_at: now,
      updated_at: now,
      total_item_count: lines.length,
      total_qty_ordered: qtyTotal,
      subtotal,
      subtotal_incl_tax: subtotal + totals.tax,
      shipping_amount: totals.shipping,
      shipping_incl_tax: totals.shipping,
      shipping_description: shipDesc,
      shipping_method: shippingMethod,
      tax_amount: totals.tax,
      grand_total: grand,
      total_paid: null,
      total_due: grand,
      total_invoiced: null,
      billing_address_id: billing?.entity_id ?? null,
      shipping_address_id: shipping?.entity_id ?? null,
      weight: null,
      // Copied from the source order the flow started at, with fresh ids so the
      // new order's addresses are its own and editing them does not reach back.
      addresses: [billing, shipping].filter(Boolean).map((a, n) => ({
        ...a, entity_id: entityId * 100 + n, parent_id: entityId,
      })),
      items: lines.map((i, n) => ({
        ...i, item_id: entityId * 100 + n, order_id: entityId,
        row_total: i.qty_ordered * num(i.price),
      })),
      payment: { method: paymentMethod, amount_ordered: grand },
      invoices: [],
      shipments: [],
    }

    setState(prev => ({
      ...prev,
      newOrders: [...(prev.newOrders || []), order],
      orderComments: {
        ...prev.orderComments,
        [String(entityId)]: [makeHistoryEntry({
          status: 'pending', comment: comment.trim(), visibleOnFront: comment.trim() ? 1 : 0,
        })],
      },
    }))
    addMessage('You created the order.')
    navigate(`/admin/sales/order/view/order_id/${entityId}/`)
  }

  const actions = (
    <>
      {/* DOM F-01 — the source's Create-New-Order page actions are
          `back_order_top_button` / `reset_order_top_button` /
          `submit_order_top_button`, each with an
          `order-content-<id>-button` `data-ui-id`. The mock had one `back`
          and no Reset, so `#back_order_top_button` and
          `#reset_order_top_button` resolved to nothing. */}
      <button type="button" id="back_order_top_button"
        data-ui-id="order-content-back-order-top-button-button"
        className="action-default scalable back"
        onClick={() => navigate(backTo)}><span>Back</span></button>
      <button type="button" id="reset_order_top_button"
        data-ui-id="order-content-reset-order-top-button-button"
        className="action-default scalable cancel"
        onClick={cancelOrder}><span>Cancel</span></button>
      <button type="button" id="submit_order_top_button"
        data-ui-id="order-content-submit-order-top-button-button"
        className="action-default scalable primary save"
        onClick={submitOrder}>
        <span>Submit Order</span>
      </button>
    </>
  )

  return (
    <PageShell title="Create New Order" actions={actions}>

      <section className="admin__page-section">
        <div className="admin__page-section-title"><span className="title">Account Information</span></div>
        {customer ? (
          <table className="admin__table-secondary">
            <tbody>
              <tr>
                <th>Customer Name</th>
                <td>
                  <AdminLink to={`/admin/customer/index/edit/id/${customer.entity_id}/`}>
                    {customer.name || `${customer.firstname} ${customer.lastname}`}
                  </AdminLink>
                </td>
              </tr>
              <tr><th>Email</th><td>{customer.email}</td></tr>
              <tr>
                <th>Customer Group</th>
                <td>{customerGroupLabel(state, customer.group_id ?? customer.customer_group_id)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p>Please select a customer to start the order.</p>
        )}
      </section>

      {sourceOrder ? (
        <section className="admin__page-section order-addresses">
          <div className="order-billing-address">
            <div className="admin__page-section-title"><span className="title">Billing Address</span></div>
            <AddressLines address={billing} />
          </div>
          <div className="order-shipping-address">
            <div className="admin__page-section-title"><span className="title">Shipping Address</span></div>
            <AddressLines address={shipping} />
          </div>
        </section>
      ) : null}

      <section className="admin__page-section order-items">
        <div className="admin__page-section-title"><span className="title">Items Ordered</span></div>
        <table className="data-table admin__table-primary">
          <thead>
            <tr>
              <th className="col-product">Product</th>
              <th className="col-price">Price</th>
              <th className="col-qty">Qty</th>
              <th className="col-subtotal">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr className="data-grid-tr-no-data">
                <td colSpan={4}>No ordered items</td>
              </tr>
            ) : items.map(item => (
              <tr key={item.item_id}>
                <td className="col-product">
                  <span className="product-title">{item.name}</span>
                  <span className="product-sku">SKU: {item.sku}</span>
                </td>
                <td className="col-price">{formatCurrency(item.price)}</td>
                <td className="col-qty">
                  <input type="text" className="admin__control-text qty-input"
                    name={`item[${item.item_id}][qty]`} aria-label={`Qty for ${item.name}`}
                    value={qtys[item.item_id] ?? ''}
                    onChange={e => setQtys(q => ({ ...q, [item.item_id]: e.target.value }))} />
                </td>
                <td className="col-subtotal">
                  {formatCurrency(num(qtys[item.item_id]) * num(item.price))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="order-items-summary">
          {items.length} item(s), {formatQty(items.reduce((n, i) => n + num(qtys[i.item_id]), 0))} unit(s)
        </p>
      </section>

      <section className="admin__page-section order-totals-section">
        <div className="order-methods">
          <div className="admin__page-section-title"><span className="title">Payment &amp; Shipping Information</span></div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="payment_method">Payment Method</label>
            <div className="admin__field-control">
              <select id="payment_method" name="payment[method]" className="admin__control-select"
                value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="shipping_method">Shipping Method</label>
            <div className="admin__field-control">
              <select id="shipping_method" name="order[shipping_method]" className="admin__control-select"
                value={shippingMethod} onChange={e => setShippingMethod(e.target.value)}>
                {SHIPPING_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </select>
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="order_comment">Order Comments</label>
            <div className="admin__field-control">
              <textarea id="order_comment" name="order[comment][customer_note]" rows={4}
                className="admin__control-textarea" value={comment} onChange={e => setComment(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="order-totals">
          <div className="admin__page-section-title"><span className="title">Order Totals</span></div>
          <table className="data-table admin__table-secondary order-subtotal-table">
            <tbody>
              <tr><th>Subtotal</th><td>{formatCurrency(subtotal)}</td></tr>
              <tr><th>Shipping &amp; Handling</th><td>{formatCurrency(totals.shipping)}</td></tr>
              <tr><th>Tax</th><td>{formatCurrency(totals.tax)}</td></tr>
              <tr><th>Discount</th><td>-{formatCurrency(totals.discount)}</td></tr>
              <tr className="col-label _grand-total"><th>Grand Total</th><td>{formatCurrency(grand)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </PageShell>
  )
}

/** Kept so a future round can start the flow from the Orders grid button. */
export function orderCountForCustomer(state, customerId) {
  return getOrders(state).filter(o => String(o.customer_id) === String(customerId)).length
}
