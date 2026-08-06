import React, { useState, useEffect, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import NotFound from '../NotFound.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { getOrder, customerGroupLabel } from '../../utils/selectors.js'
import { useSidNavigate } from '../../utils/navigation.js'
import { formatCurrency, formatQty } from '../../utils/formatters.js'
import {
  OrderAndAccountInformation, AddressInformation, PaymentAndShippingMethod, ItemProductCell,
} from '../../components/sales/OrderBlocks.jsx'
import {
  makeHistoryEntry, nextEntityId, nextIncrementId, num, canInvoice, qtyToInvoice, orderTotals,
  visibleItems,
} from '../../components/sales/orderHelpers.js'
import { useDeferredEffect } from './OrderActionRoutes.jsx'
import '../../components/sales/sales.css'

/* ROUTES.md rows 21-23 — the New Invoice flow.
 *   /admin/sales/order_invoice/start/order_id/:id/  -> redirect to new
 *   /admin/sales/order_invoice/new/order_id/:id/    -> the form
 *   /admin/sales/order_invoice/save/order_id/:id/   -> creates the invoice
 */

export function InvoiceStart() {
  const { id } = useParams()
  const navigate = useSidNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    navigate(`/admin/sales/order_invoice/new/order_id/${id}/`, { replace: true })
  }, [id])
  return null
}

export default function InvoiceNew() {
  const { id } = useParams()
  const { state, addMessage } = useApp()
  const navigate = useSidNavigate()
  const order = getOrder(state, id)

  /* DIFF-S701 — the source never renders this form for an order that cannot be
   * invoiced: `/admin/sales/order_invoice/new/order_id/294/` 302s to the order
   * view and flashes `The order does not allow an invoice to be created.`
   * The mock used to stay on the `/new/` URL with a disabled Submit and no
   * message — a different final URL (which is what a URL-checking evaluator
   * reads) and a silent dead end. */
  const declined = !!order && !canInvoice(order)
  useDeferredEffect(() => {
    if (!declined) return
    addMessage('The order does not allow an invoice to be created.', 'error')
    navigate(`/admin/sales/order/view/order_id/${id}/`, { replace: true })
  }, [id, declined])

  const [qtys, setQtys] = useState(() => {
    const init = {}
    for (const item of order?.items || []) {
      init[item.item_id] = qtyToInvoice(item)
    }
    return init
  })
  const [comment, setComment] = useState('')
  const [appendComments, setAppendComments] = useState(false)
  const [emailCopy, setEmailCopy] = useState(false)
  /** "Update Qty's" recomputes the totals from the current inputs, as in the source. */
  const [appliedQtys, setAppliedQtys] = useState(qtys)

  if (!order) return <NotFound />
  if (declined) return null

  const invoiceableItems = visibleItems(order).filter(i => qtyToInvoice(i) > 0)
  const totals = orderTotals(order)
  const subtotal = invoiceableItems.reduce(
    (sum, i) => sum + (num(appliedQtys[i.item_id]) * num(i.price)), 0)
  const discount = invoiceableItems.reduce(
    (sum, i) => sum + (num(appliedQtys[i.item_id]) / (num(i.qty_ordered) || 1)) * num(i.discount_amount), 0)
  const tax = invoiceableItems.reduce(
    (sum, i) => sum + (num(appliedQtys[i.item_id]) / (num(i.qty_ordered) || 1)) * num(i.tax_amount), 0)
  const grand = subtotal - discount + tax + totals.shipping

  function submit() {
    navigate(`/admin/sales/order_invoice/save/order_id/${id}/`, {
      state: {
        invoice: {
          items: appliedQtys,
          comment_text: comment,
          append_comments: appendComments,
          send_email: emailCopy,
          grand_total: grand,
          subtotal,
        },
      },
    })
  }

  const actions = (
    <div className="page-actions-buttons">
      <button
        id="back"
        title="Back"
        type="button"
        data-ui-id="sales-invoice-create-back-button"
        className="action-default scalable back"
        onClick={() => navigate(`/admin/sales/order/view/order_id/${id}/`)}
      >
        <span>Back</span>
      </button>
      <button
        id="reset"
        title="Reset"
        type="button"
        data-ui-id="sales-invoice-create-reset-button"
        className="action-default scalable reset"
        onClick={() => { setComment(''); setAppendComments(false); setEmailCopy(false) }}
      >
        <span>Reset</span>
      </button>
    </div>
  )

  return (
    <PageShell title="New Invoice" documentTitle="New Invoice" actions={actions} contentClassName="order-create-form">
      <OrderAndAccountInformation
        order={order}
        customerGroup={customerGroupLabel(state, order.customer_group_id) || 'General'}
      />
      <AddressInformation order={order} />
      <PaymentAndShippingMethod order={order} />

      <section className="admin__page-section order-items">
        <div className="admin__page-section-title">
          <span className="title">Items to Invoice</span>
        </div>
        <table className="order-tables data-table admin__table-primary">
          <thead>
            <tr className="headings">
              <th className="col-product">Product</th>
              <th className="col-price">Price</th>
              <th className="col-qty">Qty</th>
              <th className="col-qty">Qty to Invoice</th>
              <th className="col-subtotal">Subtotal</th>
              <th className="col-tax">Tax Amount</th>
              <th className="col-discount">Discount Amount</th>
              <th className="col-total">Row Total</th>
            </tr>
          </thead>
          <tbody>
            {invoiceableItems.map(item => {
              const qty = num(appliedQtys[item.item_id])
              const ratio = qty / (num(item.qty_ordered) || 1)
              return (
                <tr key={item.item_id}>
                  <td className="col-product"><ItemProductCell item={item} /></td>
                  <td className="col-price">{formatCurrency(item.price)}</td>
                  <td className="col-qty">
                    <table className="qty-table">
                      <tbody>
                        <tr><th>Ordered</th><td>{formatQty(item.qty_ordered)}</td></tr>
                      </tbody>
                    </table>
                  </td>
                  <td className="col-qty">
                    <input
                      /* F-02 — the source's qty control is
                       * `<input type="text" class="input-text admin__control-text qty-input">`.
                       * A `number` input silently rejects `page.fill(…, '1.5')`
                       * and `'2 '`, which the source accepts, so the mock stores
                       * the raw string and coerces only where it computes. */
                      type="text"
                      name={`invoice[items][${item.item_id}]`}
                      className="input-text admin__control-text qty-input"
                      value={qtys[item.item_id] ?? 0}
                      onChange={e => setQtys(q => ({ ...q, [item.item_id]: e.target.value }))}
                    />
                  </td>
                  <td className="col-subtotal">{formatCurrency(qty * num(item.price))}</td>
                  <td className="col-tax">{formatCurrency(ratio * num(item.tax_amount))}</td>
                  <td className="col-discount">{formatCurrency(ratio * num(item.discount_amount))}</td>
                  <td className="col-total">
                    {formatCurrency(qty * num(item.price) - ratio * num(item.discount_amount) + ratio * num(item.tax_amount))}
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={8}>
                <button
                  type="button"
                  /* F-07 — the source's ids here are random per render, but the
                   * stable `data-ui-id`s are `order-items-update-button` /
                   * `order-items-submit-button` / `tracking-add-button`. */
                  data-ui-id="order-items-update-button"
                  className="action-default scalable update-button"
                  title="Update Qty's"
                  onClick={() => setAppliedQtys(qtys)}
                >
                  <span>Update Qty&apos;s</span>
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="admin__page-section order-shipment-totals order-section-columns">
        <div className="admin__page-section-item edit-order-comments">
          <div className="admin__page-section-item-title">
            <span className="title">Invoice Comments</span>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="invoice_comment_text"><span>Comment Text</span></label>
            <textarea
              id="invoice_comment_text"
              name="invoice[comment_text]"
              className="admin__control-textarea"
              rows={5}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </div>
        </div>

        <div className="admin__page-section-item order-totals">
          <div className="admin__page-section-item-title">
            <span className="title">Invoice Totals</span>
          </div>
          <table className="order-totals-table">
            <tbody>
              <tr className="subtotal"><th>Subtotal</th><td>{formatCurrency(subtotal)}</td></tr>
              {discount ? (
                <tr className="discount"><th>Discount</th><td>{formatCurrency(-Math.abs(discount))}</td></tr>
              ) : null}
              <tr className="shipping"><th>Shipping &amp; Handling</th><td>{formatCurrency(totals.shipping)}</td></tr>
              {tax ? <tr className="tax"><th>Tax</th><td>{formatCurrency(tax)}</td></tr> : null}
              <tr className="grand_total"><th>Grand Total</th><td>{formatCurrency(grand)}</td></tr>
            </tbody>
          </table>

          <label className="admin__field-option" htmlFor="notify_customer">
            <input
              id="notify_customer"
              name="invoice[comment_customer_notify]"
              type="checkbox"
              className="admin__control-checkbox"
              value="1"
              checked={appendComments}
              onChange={e => setAppendComments(e.target.checked)}
            />
            <span>Append Comments</span>
          </label>
          <label className="admin__field-option" htmlFor="send_email">
            <input
              id="send_email"
              name="invoice[send_email]"
              type="checkbox"
              className="admin__control-checkbox"
              value="1"
              checked={emailCopy}
              onChange={e => setEmailCopy(e.target.checked)}
            />
            <span>Email Copy of Invoice</span>
          </label>

          <div className="order-form-actions">
            <button
              type="button"
              data-ui-id="order-items-submit-button"
              className="action-default scalable save submit-button primary"
              title="Submit Invoice"
              onClick={submit}
            >
              <span>Submit Invoice</span>
            </button>
          </div>
        </div>
      </section>
    </PageShell>
  )
}

/* --------------------------------------------------------------- row 23 */

export function InvoiceSave() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useSidNavigate()
  const { state, setState, addMessage } = useApp()

  /* BUG-006. The success banner needs the deferred commit for the same reason
   * the order actions do: AppContext expires a flash message one navigation
   * after it is set, and its expiry effect runs *after* this route's effect on
   * the commit that mounts it. Setting the message in that commit marks it
   * already-shown, so the redirect to the order view dropped it and Magento's
   * "The invoice has been created." never rendered. */
  useDeferredEffect(() => {
    const payload = location.state?.invoice
    const order = getOrder(state, id)
    if (!payload || !order) {
      navigate(`/admin/sales/order_invoice/new/order_id/${id}/`, { replace: true })
      return
    }

    const invoices = state.invoices || []
    const entityId = nextEntityId(invoices)
    const incrementId = nextIncrementId(invoices)
    const created = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const customerName = `${order.customer_firstname || ''} ${order.customer_lastname || ''}`.trim()

    const invoicedItems = visibleItems(order)
      .map(item => ({ item, qty: Number(payload.items?.[item.item_id]) || 0 }))
      .filter(x => x.qty > 0)

    const invoice = {
      entity_id: entityId,
      increment_id: incrementId,
      state: 2,
      store_id: 1,
      store_name: 'Main Website\nMain Website Store\nDefault Store View',
      order_id: order.entity_id,
      order_increment_id: order.increment_id,
      order_created_at: order.created_at,
      customer_name: customerName,
      customer_email: order.customer_email,
      customer_group_id: order.customer_group_id,
      payment_method: order.payment?.method || null,
      order_currency_code: 'USD',
      billing_name: customerName,
      billing_address: null,
      shipping_address: null,
      shipping_information: order.shipping_description,
      subtotal: payload.subtotal,
      shipping_and_handling: num(order.shipping_amount),
      grand_total: payload.grand_total,
      base_grand_total: payload.grand_total,
      created_at: created,
      updated_at: created,
    }

    const itemBaseId = nextEntityId(state.invoiceItems || [])
    const invoiceItems = invoicedItems.map((x, i) => ({
      entity_id: itemBaseId + i,
      parent_id: entityId,
      order_item_id: x.item.item_id,
      sku: x.item.sku,
      name: x.item.name,
      qty: x.qty,
      price: x.item.price,
      row_total: x.qty * num(x.item.price),
      tax_amount: num(x.item.tax_amount),
      price_incl_tax: num(x.item.price_incl_tax),
      row_total_incl_tax: num(x.item.row_total_incl_tax),
    }))

    const key = String(order.entity_id)
    const historyEntries = []
    if (payload.comment_text && payload.comment_text.trim()) {
      historyEntries.push(makeHistoryEntry({
        status: 'processing',
        comment: payload.comment_text.trim(),
        notified: payload.append_comments ? 1 : 0,
        entityName: 'invoice',
      }))
    }

    const itemPatch = {}
    for (const x of invoicedItems) itemPatch[x.item.item_id] = num(x.item.qty_invoiced) + x.qty

    setState(prev => {
      const nextItems = (getOrder(prev, id)?.items || []).map(item => (
        itemPatch[item.item_id] !== undefined
          ? { ...item, qty_invoiced: itemPatch[item.item_id] }
          : item
      ))
      const fullyInvoiced = nextItems.every(i => num(i.qty_invoiced) >= num(i.qty_ordered))
      return {
        ...prev,
        invoices: [...(prev.invoices || []), invoice],
        invoiceItems: [...(prev.invoiceItems || []), ...invoiceItems],
        orderOverrides: {
          ...prev.orderOverrides,
          [key]: {
            ...(prev.orderOverrides[key] || {}),
            items: nextItems,
            state: fullyInvoiced ? 'complete' : 'processing',
            status: fullyInvoiced ? 'complete' : 'processing',
            total_paid: num(order.total_paid) + num(payload.grand_total),
            total_invoiced: num(order.total_invoiced) + num(payload.grand_total),
            total_due: Math.max(0, num(order.grand_total) - (num(order.total_paid) + num(payload.grand_total))),
            updated_at: created,
          },
        },
        orderComments: historyEntries.length
          ? { ...prev.orderComments, [key]: [...historyEntries, ...(prev.orderComments[key] || [])] }
          : prev.orderComments,
      }
    })

    addMessage('The invoice has been created.')
    navigate(`/admin/sales/order/view/order_id/${id}/`, { replace: true })
  }, [id])

  return null
}
