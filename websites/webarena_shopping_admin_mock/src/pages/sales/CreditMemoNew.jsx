import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import NotFound from '../NotFound.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { getOrder, customerGroupLabel } from '../../utils/selectors.js'
import { useSidNavigate } from '../../utils/navigation.js'
import { formatCurrency } from '../../utils/formatters.js'
import {
  OrderAndAccountInformation, AddressInformation, PaymentAndShippingMethod, ItemProductCell,
} from '../../components/sales/OrderBlocks.jsx'
import {
  makeHistoryEntry, nextEntityId, nextIncrementId, num, canCreditMemo, visibleItems,
} from '../../components/sales/orderHelpers.js'
import '../../components/sales/sales.css'

/**
 * ROUTES row 27 — `sales/order_creditmemo`, `new` and `start`.
 *
 * DIFF-204. What the live source actually does, measured this round on
 * http://localhost:7780/admin (every path below cold-loaded, status read off
 * the response, banner read off `.messages .message`):
 *
 *   new|start/order_id/N/                 404  "We can't create credit memo for
 *                                              the order."   (N = 1,2,3,4,5,299)
 *   new|start/order_id/N/invoice_id/M/    404  same banner
 *   new/invoice_id/M/                     404  no banner at all
 *   new/creditmemo_id/1/                  200  "New Memo"
 *   new/creditmemo_id/99/                 404  "This creditmemo no longer exists."
 *   start/…                               302 -> the matching new/… URL
 *
 * So the *only* way to reach the refund form on this deployment is through an
 * existing credit memo id: `canCreditmemo()` is false for all 308 orders (see
 * orderHelpers.canCreditMemo), which is why no order view offers the button and
 * why every order-keyed URL 404s. The mock reproduces both halves — the working
 * page and the refusal, with the source's exact banner text — rather than
 * over-implementing a page the source will not serve.
 */

/* --------------------------------------------------------------- start/… */

/**
 * `Creditmemo\Start` clears the session form data and 302s to `new` with the
 * same params. Verified: `start/order_id/2/` lands on `new/order_id/2/` (still
 * 404), `start/creditmemo_id/1/` lands on `new/creditmemo_id/1/` (200).
 */
export function CreditMemoStart() {
  const { id, creditmemoId, invoiceId } = useParams()
  const navigate = useSidNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    const target = creditmemoId
      ? `/admin/sales/order_creditmemo/new/creditmemo_id/${creditmemoId}/`
      : `/admin/sales/order_creditmemo/new/order_id/${id}/`
        + (invoiceId ? `invoice_id/${invoiceId}/` : '')
    navigate(target, { replace: true })
  }, [id, creditmemoId, invoiceId])
  return null
}

/* ------------------------------------------------------ the 404 with a banner */

/**
 * Magento's `_getItem()` failure path: `messageManager->addErrorMessage(...)`
 * then `forward('noroute')`, which is why the 404 body carries a message block.
 *
 * The message is added in an effect so it lands in the same commit the page
 * mounts in — AppContext's expiry effect runs after this one and marks it
 * shown, which keeps it visible on this render and drops it on the next
 * navigation, exactly like the source's flash-message lifetime. Flash messages
 * are not persisted state, so a 404 mutates nothing and leaves `state_diff`
 * untouched.
 */
function useNorouteMessage(text) {
  const { addMessage } = useApp()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    addMessage(text, 'error')
  }, [text])
}

/**
 * `new|start/order_id/:id/` (with or without `/invoice_id/:invoiceId/`).
 *
 * `canCreditMemo()` is the source's own `Order::canCreditmemo()`; it is false
 * for every seeded order, so this always renders the admin 404 — the same
 * status page and the same banner the source returns.
 */
export function CreditMemoNewForOrder() {
  const { id } = useParams()
  const { state } = useApp()
  const order = getOrder(state, id)
  useNorouteMessage("We can't create credit memo for the order.")
  // Deliberately unreachable on this seed; kept because it is the source's own
  // condition, not a mock invention. If an injected task state ever hands an
  // order real `total_paid`, the source would serve the form and so will we.
  if (order && canCreditMemo(order)) return <CreditMemoForm order={order} memo={null} />
  return <NotFound />
}

/* ----------------------------------------------------- new/creditmemo_id/… */

/** `new/creditmemo_id/:creditmemoId/` — the one 200 the source serves. */
export default function CreditMemoNew() {
  const { creditmemoId } = useParams()
  const { state } = useApp()
  const memo = (state?.creditMemos || []).find(
    c => String(c.entity_id) === String(creditmemoId))
  const order = memo ? getOrder(state, memo.order_id) : null
  return memo && order
    ? <CreditMemoForm order={order} memo={memo} />
    : <CreditMemoGone />
}

function CreditMemoGone() {
  useNorouteMessage('This creditmemo no longer exists.')
  return <NotFound />
}

/* ------------------------------------------------------------------- form */

/**
 * The refund form, reproduced from the live source's
 * `new/creditmemo_id/1/` DOM: page actions are `Back` and `Reset` only, the
 * items table carries a `Return to Stock` column and an Ordered/Invoiced/
 * Shipped/Refunded qty sub-table, and `Refund Offline` sits at the foot of the
 * Refund Totals block (not in the page-actions bar).
 */
function CreditMemoForm({ order, memo }) {
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()

  const items = visibleItems(order).filter(
    i => num(i.qty_invoiced) > 0 || num(i.qty_refunded) > 0)

  /* Loaded from an existing memo, Magento prefills each line with the memo
   * item's own qty; started from an order it prefills invoiced-minus-refunded. */
  const defaultQty = item => (memo
    ? num(item.qty_refunded) || num(item.qty_invoiced)
    : num(item.qty_invoiced) - num(item.qty_refunded))

  const [qtys, setQtys] = useState(() => {
    const init = {}
    for (const item of items) init[item.item_id] = defaultQty(item)
    return init
  })
  const [appliedQtys, setAppliedQtys] = useState(qtys)
  const [backToStock, setBackToStock] = useState({})
  const [refundShipping, setRefundShipping] = useState(
    () => (memo ? num(memo.shipping_and_handling) : num(order.shipping_amount)).toFixed(2))
  const [adjustmentRefund, setAdjustmentRefund] = useState(
    () => num(memo?.adjustment_positive).toFixed(2))
  const [adjustmentFee, setAdjustmentFee] = useState(
    () => num(memo?.adjustment_negative).toFixed(2))
  const [comment, setComment] = useState('')
  const [appendComments, setAppendComments] = useState(false)
  const [emailCopy, setEmailCopy] = useState(false)

  const lineShare = item => num(appliedQtys[item.item_id]) / (num(item.qty_ordered) || 1)
  const subtotal = items.reduce(
    (sum, i) => sum + num(appliedQtys[i.item_id]) * num(i.price), 0)
  const discount = items.reduce((sum, i) => sum + lineShare(i) * num(i.discount_amount), 0)
  const tax = items.reduce((sum, i) => sum + lineShare(i) * num(i.tax_amount), 0)
  const grand = subtotal - discount + tax
    + num(refundShipping) + num(adjustmentRefund) - num(adjustmentFee)

  function submit() {
    const list = state?.creditMemos || []
    const record = {
      entity_id: nextEntityId(list),
      increment_id: nextIncrementId(list),
      created_at: makeHistoryEntry({ status: order.status }).created_at,
      updated_at: makeHistoryEntry({ status: order.status }).created_at,
      order_id: order.entity_id,
      order_increment_id: order.increment_id,
      order_created_at: order.created_at,
      billing_name: order.billing_name ?? order.customer_name ?? '',
      state: 2,
      base_grand_total: Number(grand.toFixed(2)),
      order_status: order.status,
      store_id: order.store_id ?? 1,
      billing_address: order.billing_address ?? '',
      shipping_address: order.shipping_address ?? '',
      customer_name: order.customer_name ?? '',
      customer_email: order.customer_email ?? '',
      customer_group_id: order.customer_group_id ?? 1,
      payment_method: order.payment?.method ?? '',
      shipping_information: order.shipping_description ?? '',
      subtotal: Number(subtotal.toFixed(2)),
      shipping_and_handling: num(refundShipping),
      adjustment_positive: num(adjustmentRefund) || null,
      adjustment_negative: num(adjustmentFee) || null,
      order_base_grand_total: num(order.grand_total),
    }

    const entry = makeHistoryEntry({
      status: order.status,
      comment: appendComments ? comment : '',
      notified: emailCopy,
      entityName: 'creditmemo',
    })

    setState(prev => ({
      ...prev,
      creditMemos: [...(prev.creditMemos || []), record],
      orderComments: {
        ...prev.orderComments,
        [String(order.entity_id)]: [entry, ...(prev.orderComments?.[String(order.entity_id)] || order.comments || [])],
      },
    }))

    addMessage('You created the credit memo.')
    navigate(`/admin/sales/order/view/order_id/${order.entity_id}/`)
  }

  const actions = (
    <>
      <button type="button" id="back" title="Back" className="action-default scalable back"
        data-ui-id="sales-creditmemo-create-back-button"
        onClick={() => navigate(`/admin/sales/order/view/order_id/${order.entity_id}/`)}>
        <span>Back</span>
      </button>
      {/* Source: `#reset` re-requests the same `new/` URL, throwing away the
          edits. Re-seeding the local form state is the same observable result. */}
      <button type="button" id="reset" title="Reset" className="action-default scalable reset"
        data-ui-id="sales-creditmemo-create-reset-button"
        onClick={() => {
          const init = {}
          for (const item of items) init[item.item_id] = defaultQty(item)
          setQtys(init)
          setAppliedQtys(init)
          setBackToStock({})
          setRefundShipping((memo ? num(memo.shipping_and_handling) : num(order.shipping_amount)).toFixed(2))
          setAdjustmentRefund(num(memo?.adjustment_positive).toFixed(2))
          setAdjustmentFee(num(memo?.adjustment_negative).toFixed(2))
          setComment('')
          setAppendComments(false)
          setEmailCopy(false)
        }}>
        <span>Reset</span>
      </button>
    </>
  )

  return (
    /* Source `<h1 class="page-title">` is the bare "New Memo" — it does not
     * name the order (unlike New Invoice / New Shipment). `<title>` resolves to
     * "New Memo / Credit Memos / Operations / Sales / Magento Admin" through
     * the menu path, which matches the source verbatim. */
    <PageShell title="New Memo" actions={actions}>
      <OrderAndAccountInformation order={order}
        customerGroup={customerGroupLabel(state, order.customer_group_id)} />
      <AddressInformation order={order} />
      <PaymentAndShippingMethod order={order} />

      <section className="admin__page-section order-items">
        <div className="admin__page-section-title"><span className="title">Items to Refund</span></div>
        <div className="admin__table-wrapper">
          {/* `order-tables` carries the shared product-cell / qty-table styling;
              `order-creditmemo-tables` is the source's own class. */}
          <table className="data-table admin__table-primary order-tables order-creditmemo-tables">
            <thead>
              <tr className="headings">
                <th className="col-product"><span>Product</span></th>
                <th className="col-price"><span>Price</span></th>
                <th className="col-ordered-qty"><span>Qty</span></th>
                <th className="col-return-to-stock"><span>Return to Stock</span></th>
                <th className="col-refund"><span>Qty to Refund</span></th>
                <th className="col-subtotal"><span>Subtotal</span></th>
                <th className="col-tax-amount"><span>Tax Amount</span></th>
                <th className="col-discont"><span>Discount Amount</span></th>
                <th className="col-total last"><span>Row Total</span></th>
              </tr>
            </thead>
            <tfoot>
              <tr>
                <td colSpan={4}>&nbsp;</td>
                <td>
                  <button type="button" className="action-default scalable update-button"
                    data-ui-id="order-items-update-button"
                    onClick={() => setAppliedQtys(qtys)}>
                    <span>Update Qty&apos;s</span>
                  </button>
                </td>
                <td colSpan={4} className="last">&nbsp;</td>
              </tr>
            </tfoot>
            <tbody className="even">
              {items.map(item => {
                const qty = num(appliedQtys[item.item_id])
                const share = lineShare(item)
                return (
                  <tr key={item.item_id}>
                    <td className="col-product"><ItemProductCell item={item} /></td>
                    <td className="col-price"><span className="price">{formatCurrency(item.price)}</span></td>
                    <td className="col-ordered-qty">
                      <table className="qty-table">
                        <tbody>
                          <tr><th>Ordered</th><td>{num(item.qty_ordered)}</td></tr>
                          {num(item.qty_invoiced) ? <tr><th>Invoiced</th><td>{num(item.qty_invoiced)}</td></tr> : null}
                          {num(item.qty_shipped) ? <tr><th>Shipped</th><td>{num(item.qty_shipped)}</td></tr> : null}
                          {num(item.qty_refunded) ? <tr><th>Refunded</th><td>{num(item.qty_refunded)}</td></tr> : null}
                        </tbody>
                      </table>
                    </td>
                    <td className="col-return-to-stock">
                      <input type="checkbox" className="admin__control-checkbox" value="1"
                        name={`creditmemo[items][${item.item_id}][back_to_stock]`}
                        aria-label={`Return ${item.name} to Stock`}
                        checked={!!backToStock[item.item_id]}
                        onChange={e => setBackToStock(b => ({ ...b, [item.item_id]: e.target.checked }))} />
                      <label className="admin__field-label" />
                    </td>
                    <td className="col-refund col-qty">
                      <input type="text" className="input-text admin__control-text qty-input"
                        name={`creditmemo[items][${item.item_id}][qty]`}
                        aria-label={`Qty to Refund for ${item.name}`}
                        value={qtys[item.item_id] ?? ''}
                        onChange={e => setQtys(q => ({ ...q, [item.item_id]: e.target.value }))} />
                    </td>
                    <td className="col-subtotal">
                      <span className="price">{formatCurrency(qty * num(item.price))}</span>
                    </td>
                    <td className="col-tax-amount">
                      <span className="price">{formatCurrency(share * num(item.tax_amount))}</span>
                    </td>
                    <td className="col-discont">
                      <span className="price">{formatCurrency(share * num(item.discount_amount))}</span>
                    </td>
                    <td className="col-total last">
                      <span className="price">
                        {formatCurrency(qty * num(item.price) + share * num(item.tax_amount) - share * num(item.discount_amount))}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="admin__page-section order-totals-section">
        <div className="admin__page-section-title"><span className="title">Order Total</span></div>
        <div className="admin__page-section-content">
          <div className="admin__page-section-item order-comments-history">
            <div className="admin__page-section-item-title"><span className="title">Credit Memo Comments</span></div>
            <div className="admin__field">
              <label className="normal admin__field-label" htmlFor="creditmemo_comment_text">
                <span>Comment Text</span>
              </label>
              <div className="admin__field-control">
                <textarea id="creditmemo_comment_text" name="creditmemo[comment_text]" rows={3}
                  className="admin__control-textarea" value={comment}
                  onChange={e => setComment(e.target.value)} />
              </div>
            </div>
          </div>

          <div className="admin__page-section-item order-totals creditmemo-totals">
            <div className="admin__page-section-item-title"><span className="title">Refund Totals</span></div>
            {/* Source DOM order: Grand Total lives in the <tfoot>, above the
                <tbody> rows, so it renders first. */}
            <table className="data-table admin__table-secondary order-subtotal-table">
              <tfoot>
                <tr className="col-0">
                  <td className="label"><strong>Grand Total</strong></td>
                  <td><strong><span className="price">{formatCurrency(grand)}</span></strong></td>
                </tr>
              </tfoot>
              <tbody>
                <tr className="col-0">
                  <td className="label">Subtotal</td>
                  <td><span><span className="price">{formatCurrency(subtotal)}</span></span></td>
                </tr>
                {discount ? (
                  <tr>
                    <td className="label">Discount</td>
                    <td><span className="price">-{formatCurrency(discount)}</span></td>
                  </tr>
                ) : null}
                <tr>
                  <td className="label">Refund Shipping</td>
                  <td>
                    <input id="shipping_amount" name="creditmemo[shipping_amount]" type="text"
                      className="input-text admin__control-text not-negative-amount"
                      aria-label="Refund Shipping" value={refundShipping}
                      onChange={e => setRefundShipping(e.target.value)} />
                  </td>
                </tr>
                <tr>
                  <td className="label">Adjustment Refund</td>
                  <td>
                    <input id="adjustment_positive" name="creditmemo[adjustment_positive]" type="text"
                      className="input-text admin__control-text not-negative-amount"
                      aria-label="Adjustment Refund" value={adjustmentRefund}
                      onChange={e => setAdjustmentRefund(e.target.value)} />
                  </td>
                </tr>
                <tr>
                  <td className="label">Adjustment Fee</td>
                  <td>
                    <input id="adjustment_negative" name="creditmemo[adjustment_negative]" type="text"
                      className="input-text admin__control-text not-negative-amount"
                      aria-label="Adjustment Fee" value={adjustmentFee}
                      onChange={e => setAdjustmentFee(e.target.value)} />
                  </td>
                </tr>
                <tr>
                  <td className="label">Tax</td>
                  <td><span className="price">{formatCurrency(tax)}</span></td>
                </tr>
              </tbody>
            </table>

            <div className="order-totals-actions">
              <button type="button" data-ui-id="update-totals-button"
                className="action-default scalable update-totals-button"
                onClick={() => setAppliedQtys(qtys)}>
                <span>Update Totals</span>
              </button>
              <label className="admin__field-option" htmlFor="append_comments">
                <input id="append_comments" name="creditmemo[comment_customer_notify]" type="checkbox"
                  className="admin__control-checkbox" value="1"
                  checked={appendComments} onChange={e => setAppendComments(e.target.checked)} />
                <span>Append Comments</span>
              </label>
              <label className="admin__field-option" htmlFor="send_email">
                <input id="send_email" name="creditmemo[send_email]" type="checkbox"
                  className="admin__control-checkbox" value="1"
                  checked={emailCopy} onChange={e => setEmailCopy(e.target.checked)} />
                <span>Email Copy of Credit Memo</span>
              </label>
              <button type="button" id="submit_creditmemo" data-ui-id="order-items-submit-button"
                className="action-default scalable save submit-button primary"
                onClick={submit}>
                <span>Refund Offline</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    </PageShell>
  )
}
