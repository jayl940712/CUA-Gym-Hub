import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import NotFound from '../NotFound.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { getOrder, customerGroupLabel } from '../../utils/selectors.js'
import { useSidNavigate } from '../../utils/navigation.js'
import { downloadFile } from '../../utils/gridUtils.js'
import { formatCurrency, formatQty, orderStatusLabel } from '../../utils/formatters.js'
import {
  OrderAndAccountInformation, AddressInformation, PaymentAndShippingMethod, ItemProductCell, StatusHistoryNoteList,
} from '../../components/sales/OrderBlocks.jsx'
import {
  CARRIERS, carrierLabel, nextEntityId, num, visibleItems,
} from '../../components/sales/orderHelpers.js'
import { useConfirm } from '../../components/sales/ConfirmModal.jsx'
import '../../components/sales/sales.css'

/* ROUTES.md rows 31, 33, 35 — the invoice / shipment / credit-memo views.
 * They reuse the order view's own blocks because the source does: the same
 * `admin__page-section` order/account/address/payment panels appear on all
 * three (assets/html/sales-order-invoice-view-1.html).
 *
 * Page-action buttons come from the source's own block classes, confirmed
 * against the live site's `.page-actions button` list:
 *   invoice      Back | Login as Customer | Send Email | Print
 *   shipment     Back | Login as Customer | Print | Send Tracking Information
 *                (module-shipping Block/Adminhtml/View.php relabels `save`)
 *   credit memo  Back | Login as Customer | Send Email | Print
 * `Print` is a PDF download in the source, so the mock downloads the same
 * document rather than navigating away — the URL does not change either way.
 */

function DocumentShell({ title, order, backTo, children, actions = null, backUiId }) {
  const { state } = useApp()
  const navigate = useSidNavigate()
  return (
    <PageShell
      title={title}
      documentTitle={title}
      actions={
        <div className="page-actions-buttons">
          <button
            id="back"
            title="Back"
            type="button"
            /* F-07 — the source's Back carries a per-view `data-ui-id`
             * (`sales-{invoice,shipment,creditmemo}-view-back-button`). */
            data-ui-id={backUiId}
            className="action-default scalable back"
            onClick={() => navigate(backTo)}
          >
            <span>Back</span>
          </button>
          {actions}
        </div>
      }
    >
      <OrderAndAccountInformation
        order={order}
        customerGroup={customerGroupLabel(state, order.customer_group_id) || 'General'}
      />
      <AddressInformation order={order} />
      <PaymentAndShippingMethod order={order} />
      {children}
    </PageShell>
  )
}

/** The `Print` button's PDF, in the same plain-text form the Orders grid mass
 * actions produce (OrdersGrid.printDocuments). */
function printDocument(title, doc, order) {
  const body = `${title}\n#${doc.increment_id}\n`
    + `Order # ${doc.order_increment_id || order.increment_id}\n`
    + `Customer: ${doc.customer_name || order.customer_name || ''}\n`
    + `Created: ${doc.created_at}\n`
  downloadFile(`${title.toLowerCase().replace(/\s+/g, '')}-${doc.increment_id}.txt`, body, 'text/plain')
}

/**
 * The `Invoice History` / `Credit Memo History` comment block. The source posts
 * it to `.../addComment/id/<doc>/` over AJAX and re-renders the block in place,
 * so the mock mutates `orderStatusHistory` and stays on the page. The entry is
 * tagged with `entity_name` so it shows under the document it was written on.
 */
function DocumentCommentForm({ blockTitle, order, entityName, comments }) {
  const { state, setState, addMessage } = useApp()
  const [comment, setComment] = useState('')
  const [notify, setNotify] = useState(false)
  const [visible, setVisible] = useState(false)

  function submit() {
    const entry = {
      entity_id: nextEntityId(state.orderStatusHistory || []),
      parent_id: order.entity_id,
      is_customer_notified: notify ? 1 : 0,
      is_visible_on_front: visible ? 1 : 0,
      comment: comment.trim(),
      status: order.status,
      created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      entity_name: entityName,
    }
    setState(prev => ({
      ...prev,
      orderStatusHistory: [...(prev.orderStatusHistory || []), entry],
    }))
    setComment('')
    setNotify(false)
    setVisible(false)
    addMessage('You submitted the comment.')
  }

  return (
    <div className="admin__page-section-item order-comments-history">
      <div className="admin__page-section-item-title"><span className="title">{blockTitle}</span></div>
      <div className="admin__page-section-item-content">
        <div id="comments_block" className="edit-order-comments">
          <div className="order-history-block">
            <div className="admin__field field-row">
              <label className="admin__field-label" htmlFor="history_comment">Comment Text</label>
              <div className="admin__field-control">
                <textarea
                  id="history_comment"
                  name="comment[comment]"
                  className="admin__control-textarea"
                  rows={3}
                  cols={5}
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                />
              </div>
            </div>
            <div className="admin__field">
              <div className="order-history-comments-options">
                <div className="admin__field admin__field-option">
                  <input
                    id="history_notify"
                    name="comment[is_customer_notified]"
                    type="checkbox"
                    className="admin__control-checkbox"
                    value="1"
                    checked={notify}
                    onChange={e => setNotify(e.target.checked)}
                  />
                  <label className="admin__field-label" htmlFor="history_notify">Notify Customer by Email</label>
                </div>
                <div className="admin__field admin__field-option">
                  <input
                    id="history_visible"
                    name="comment[is_visible_on_front]"
                    type="checkbox"
                    className="admin__control-checkbox"
                    value="1"
                    checked={visible}
                    onChange={e => setVisible(e.target.checked)}
                  />
                  <label className="admin__field-label" htmlFor="history_visible">Visible on Storefront</label>
                </div>
              </div>
              <div className="order-history-comments-actions">
                <button
                  id="submit_comment_button"
                  title="Submit Comment"
                  type="button"
                  className="action-default scalable action-secondary save"
                  data-ui-id="order-comments-submit-button"
                  onClick={submit}
                >
                  <span>Submit Comment</span>
                </button>
              </div>
            </div>
          </div>
          <StatusHistoryNoteList comments={comments} />
        </div>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ row 31 */

/** `Login as Customer` — present on all three document views in the source. */
function LoginAsCustomerButton({ order, navigate, uiId }) {
  if (!order.customer_id) return null
  return (
    <button
      id="guest_to_customer"
      title="Login as Customer"
      type="button"
      className="action-default scalable reset"
      data-ui-id={uiId}
      onClick={() => navigate(`/admin/customer/index/edit/id/${order.customer_id}/`)}
    >
      <span>Login as Customer</span>
    </button>
  )
}

export function InvoiceView() {
  const { id } = useParams()
  const { state } = useApp()
  const navigate = useSidNavigate()
  const [confirmNode, askConfirm] = useConfirm()
  const invoice = (state.invoices || []).find(i => String(i.entity_id) === String(id))
  const order = invoice ? getOrder(state, invoice.order_id) : null
  if (!invoice || !order) return <NotFound />

  const items = (state.invoiceItems || []).filter(i => String(i.parent_id) === String(invoice.entity_id))
  const shipping = num(invoice.shipping_and_handling)
  const subtotal = num(invoice.subtotal)
  const tax = items.reduce((n, i) => n + num(i.tax_amount), 0)

  const actions = (
    <>
      <LoginAsCustomerButton
        order={order}
        navigate={navigate}
        uiId="sales-invoice-view-guest-to-customer-button"
      />
      <button
        id="send_notification"
        title="Send Email"
        type="button"
        className="action-default scalable send-email"
        data-ui-id="sales-invoice-view-send-notification-button"
        onClick={() => askConfirm(
          'Are you sure you want to send an invoice email to customer?',
          () => navigate(
            `/admin/sales/order_invoice/email/order_id/${order.entity_id}/invoice_id/${invoice.entity_id}/`))}
      >
        <span>Send Email</span>
      </button>
      <button
        id="print"
        title="Print"
        type="button"
        className="action-default scalable print"
        data-ui-id="sales-invoice-view-print-button"
        onClick={() => printDocument('Invoice', invoice, order)}
      >
        <span>Print</span>
      </button>
    </>
  )

  return (
    <DocumentShell
      title={`#${invoice.increment_id}`}
      order={order}
      backTo="/admin/sales/invoice/"
      backUiId="sales-invoice-view-back-button"
      actions={actions}
    >
      {confirmNode}
      <section className="admin__page-section order-items">
        <div className="admin__page-section-title">
          {/* DIFF-019: the source's heading is the bare string. */}
          <span className="title">Items Invoiced</span>
        </div>
        <table className="order-tables data-table admin__table-primary">
          <thead>
            <tr className="headings">
              <th className="col-product">Product</th>
              <th className="col-price">Price</th>
              <th className="col-qty">Qty</th>
              <th className="col-subtotal">Subtotal</th>
              <th className="col-tax">Tax Amount</th>
              <th className="col-discount">Discount Amount</th>
              <th className="col-total">Row Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.entity_id}>
                <td className="col-product"><ItemProductCell item={item} /></td>
                <td className="col-price">{formatCurrency(item.price)}</td>
                <td className="col-qty">{formatQty(item.qty)}</td>
                <td className="col-subtotal">{formatCurrency(item.row_total)}</td>
                <td className="col-tax">{formatCurrency(item.tax_amount)}</td>
                <td className="col-discount">{formatCurrency(item.discount_amount ?? 0)}</td>
                <td className="col-total">{formatCurrency(item.row_total_incl_tax ?? item.row_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* DIFF-020: the source wraps the history + totals pair in an
       * `Order Total` section. */}
      <div className="admin__page-section-title order-total-title">
        <span className="title">Order Total</span>
      </div>
      <section className="admin__page-section order-totals-comments">
        <DocumentCommentForm
          blockTitle="Invoice History"
          order={order}
          entityName="invoice"
          comments={(state.orderStatusHistory || []).filter(
            h => String(h.parent_id) === String(order.entity_id) && h.entity_name === 'invoice')}
        />
        <div className="admin__page-section-item order-totals">
          <div className="admin__page-section-item-title"><span className="title">Invoice Totals</span></div>
          <table className="order-totals-table">
            <tbody>
              <tr className="subtotal"><th>Subtotal</th><td>{formatCurrency(subtotal)}</td></tr>
              <tr className="shipping"><th>Shipping &amp; Handling</th><td>{formatCurrency(shipping)}</td></tr>
              <tr className="tax"><th>Tax</th><td>{formatCurrency(tax)}</td></tr>
              <tr className="grand_total"><th>Grand Total</th><td>{formatCurrency(invoice.grand_total)}</td></tr>
            </tbody>
          </table>
        </div>
      </section>
    </DocumentShell>
  )
}

/* ------------------------------------------------------------------ row 33 */

/**
 * `Shipping and Tracking Information` on the shipment view. The source lets an
 * admin add and delete tracking numbers here, the same row editor as the New
 * Shipment form; each `Save` writes a `shipmentTracks` row and the order history
 * entry `Tracking number <N> for <Carrier> assigned` (tasks 496-500).
 */
function ShipmentTrackingBlock({ shipment, order }) {
  const { state, setState, addMessage } = useApp()
  const tracks = (state.shipmentTracks || []).filter(
    t => String(t.parent_id) === String(shipment.entity_id))
  const [draft, setDraft] = useState([])

  function addRow() {
    setDraft(rows => [...rows, { carrier_code: 'custom', title: '', number: '' }])
  }
  function patchRow(i, patch) {
    setDraft(rows => rows.map((r, n) => (n === i ? { ...r, ...patch } : r)))
  }
  function removeRow(i) {
    setDraft(rows => rows.filter((_, n) => n !== i))
  }

  function deleteTrack(entityId) {
    setState(prev => ({
      ...prev,
      shipmentTracks: (prev.shipmentTracks || []).filter(
        t => String(t.entity_id) !== String(entityId)),
    }))
    addMessage('You deleted the shipment tracking number.')
  }

  function saveTracking() {
    const rows = draft.filter(r => String(r.number).trim() !== '')
    if (!rows.length) {
      addMessage('Please enter a tracking number.', 'error')
      return
    }
    const created = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const baseId = nextEntityId(state.shipmentTracks || [])
    const added = rows.map((r, i) => ({
      entity_id: baseId + i,
      parent_id: shipment.entity_id,
      order_id: order.entity_id,
      carrier_code: r.carrier_code,
      title: r.title || carrierLabel(r.carrier_code),
      track_number: String(r.number).trim(),
      created_at: created,
    }))
    const key = String(order.entity_id)
    const history = added.map(t => ({
      created_at: created,
      status: order.status,
      comment: `Tracking number ${t.track_number} for ${carrierLabel(t.carrier_code)} assigned`,
      is_customer_notified: 0,
      is_visible_on_front: 0,
      entity_name: 'order',
    }))
    setState(prev => ({
      ...prev,
      shipmentTracks: [...(prev.shipmentTracks || []), ...added],
      orderComments: {
        ...prev.orderComments,
        [key]: [...history.reverse(), ...(prev.orderComments[key] || [])],
      },
    }))
    setDraft([])
    addMessage('You saved the shipment tracking information.')
  }

  return (
    <section className="admin__page-section shipment-tracking">
      <div className="admin__page-section-title">
        <span className="title">Shipping and Tracking Information</span>
      </div>
      {/* DIFF-019: the source prints the shipping description and the order's
       * shipping total above the tracking table. */}
      <div className="shipping-description-wrapper">
        <div className="shipping-description-title">{order.shipping_description}</div>
        Total Shipping Charges: <span className="price">{formatCurrency(order.shipping_amount)}</span>
      </div>
      <table className="tracking-table" id="shipment_tracking_info">
        <thead>
          <tr>
            <th className="col-carrier">Carrier</th>
            <th className="col-title">Title</th>
            <th className="col-number">Number</th>
            <th className="col-action">Action</th>
          </tr>
        </thead>
        <tbody>
          {tracks.length === 0 && draft.length === 0 ? (
            <tr className="no-tracking"><td colSpan={4}>No tracking numbers have been added yet.</td></tr>
          ) : null}
          {tracks.map(t => (
            <tr key={t.entity_id}>
              <td className="col-carrier">{carrierLabel(t.carrier_code)}</td>
              <td className="col-title">{t.title}</td>
              <td className="col-number">{t.track_number}</td>
              <td className="col-action">
                <button type="button" className="action-delete" onClick={() => deleteTrack(t.entity_id)}>
                  <span>Delete</span>
                </button>
              </td>
            </tr>
          ))}
          {draft.map((row, i) => (
            <tr key={`draft-${i}`}>
              <td className="col-carrier">
                <select
                  id={`trackingC${i}`}
                  name={`tracking[${i}][carrier_code]`}
                  className="select admin__control-select carrier"
                  value={row.carrier_code}
                  onChange={e => patchRow(i, { carrier_code: e.target.value })}
                >
                  {CARRIERS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </td>
              <td className="col-title">
                <input
                  id={`trackingT${i}`}
                  name={`tracking[${i}][title]`}
                  type="text"
                  className="input-text admin__control-text number-title"
                  value={row.title}
                  onChange={e => patchRow(i, { title: e.target.value })}
                />
              </td>
              <td className="col-number">
                <input
                  id={`trackingN${i}`}
                  name={`tracking[${i}][number]`}
                  type="text"
                  className="input-text admin__control-text required-entry"
                  value={row.number}
                  onChange={e => patchRow(i, { number: e.target.value })}
                />
              </td>
              <td className="col-action">
                <button type="button" className="action-delete" onClick={() => removeRow(i)}>
                  <span>Delete</span>
                </button>
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={4}>
              {/* F-07 — on the shipment VIEW the source's tracking button is
                  `title="Add"`, text `Add`, `data-ui-id="shipment-tracking-save-button"`.
                  (`shipment-tracking-add-button` / "Add Tracking Number" is the
                  NEW-shipment form's button, which ShipmentNew carries.) */}
              <button type="button" className="action-default scalable save"
                title="Add" data-ui-id="shipment-tracking-save-button"
                onClick={addRow}>
                <span>Add</span>
              </button>
              {draft.length ? (
                <button
                  type="button"
                  title="Save"
                  className="action-default scalable save"
                  onClick={saveTracking}
                >
                  <span>Save</span>
                </button>
              ) : null}
            </td>
          </tr>
        </tfoot>
      </table>
    </section>
  )
}

export function ShipmentView() {
  const { id } = useParams()
  const { state } = useApp()
  const navigate = useSidNavigate()
  const [confirmNode, askConfirm] = useConfirm()
  const shipment = (state.shipments || []).find(s => String(s.entity_id) === String(id))
  const order = shipment ? getOrder(state, shipment.order_id) : null
  if (!shipment || !order) return <NotFound />

  const items = (state.shipmentItems || []).filter(i => String(i.parent_id) === String(shipment.entity_id))

  /* DIFF-018 + button order: the live source's `.page-actions button` list is
   * Back | Login as Customer | Print | Send Tracking Information. */
  const actions = (
    <>
      <LoginAsCustomerButton
        order={order}
        navigate={navigate}
        uiId="sales-shipment-view-guest-to-customer-button"
      />
      <button
        id="print"
        title="Print"
        type="button"
        data-ui-id="sales-shipment-view-print-button"
        className="action-default scalable save"
        onClick={() => printDocument('Shipment', shipment, order)}
      >
        <span>Print</span>
      </button>
      <button
        /* F-07 — the source's Send Tracking Information button is `#save`, not
         * `#send_tracking`; `page.click('#save')` timed out on this P1 route. */
        id="save"
        title="Send Tracking Information"
        type="button"
        data-ui-id="sales-shipment-view-save-button"
        className="action-default scalable save primary"
        onClick={() => askConfirm(
          'Are you sure you want to send a Shipment email to customer?',
          () => navigate(`/admin/admin/order_shipment/email/shipment_id/${shipment.entity_id}/`))}
      >
        <span>Send Tracking Information</span>
      </button>
    </>
  )

  return (
    <DocumentShell
      title={`#${shipment.increment_id}`}
      order={order}
      backTo="/admin/sales/shipment/"
      backUiId="sales-shipment-view-back-button"
      actions={actions}
    >
      {confirmNode}
      <ShipmentTrackingBlock shipment={shipment} order={order} />

      {/* DIFF-019: the source's MSI block between tracking and Items Shipped. */}
      <section className="admin__page-section inventory">
        <div className="admin__page-section-title">
          <span className="title">Inventory</span>
        </div>
        <div className="admin__page-section-content">Source: Default Source</div>
      </section>

      <section className="admin__page-section order-items">
        <div className="admin__page-section-title">
          {/* DIFF-019: the source's heading is the bare string. */}
          <span className="title">Items Shipped</span>
        </div>
        <table className="order-tables data-table admin__table-primary">
          <thead>
            <tr className="headings">
              <th className="col-product">Product</th>
              <th className="col-qty">Qty Shipped</th>
            </tr>
          </thead>
          <tbody>
            {items.map(item => (
              <tr key={item.entity_id}>
                <td className="col-product"><ItemProductCell item={item} /></td>
                <td className="col-qty">{formatQty(item.qty)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* DIFF-017: the shipment view's `Order Total` -> `Shipment History`
       * comment block. It posts to `/admin/admin/order_shipment/addComment/id/N/`
       * in the source and re-renders in place, exactly like the invoice and
       * credit-memo history forms. */}
      <div className="admin__page-section-title order-total-title">
        <span className="title">Order Total</span>
      </div>
      <section className="admin__page-section order-totals-comments">
        <DocumentCommentForm
          blockTitle="Shipment History"
          order={order}
          entityName="shipment"
          comments={(state.orderStatusHistory || []).filter(
            h => String(h.parent_id) === String(order.entity_id) && h.entity_name === 'shipment')}
        />
      </section>
    </DocumentShell>
  )
}

/* ------------------------------------------------------------------ row 35 */

export function CreditMemoView() {
  const { id } = useParams()
  const { state } = useApp()
  const navigate = useSidNavigate()
  const [confirmNode, askConfirm] = useConfirm()
  const memo = (state.creditMemos || []).find(c => String(c.entity_id) === String(id))
  const order = memo ? getOrder(state, memo.order_id) : null
  if (!memo || !order) return <NotFound />

  const actions = (
    <>
      <LoginAsCustomerButton
        order={order}
        navigate={navigate}
        uiId="sales-creditmemo-view-guest-to-customer-button"
      />
      <button
        id="send_notification"
        title="Send Email"
        type="button"
        data-ui-id="sales-creditmemo-view-send-notification-button"
        className="action-default scalable send-email"
        onClick={() => askConfirm(
          'Are you sure you want to send a credit memo email to customer?',
          () => navigate(
            `/admin/sales/order_creditmemo/email/creditmemo_id/${memo.entity_id}/order_id/${order.entity_id}/`))}
      >
        <span>Send Email</span>
      </button>
      <button
        id="print"
        title="Print"
        type="button"
        data-ui-id="sales-creditmemo-view-print-button"
        className="action-default scalable print"
        onClick={() => printDocument('Credit Memo', memo, order)}
      >
        <span>Print</span>
      </button>
    </>
  )

  return (
    <DocumentShell
      /* DIFF-005: the credit-memo view's `<h1 class="page-title">` is the literal
       * "View Memo" — unlike the order / invoice / shipment views, which use the
       * increment id. `<title>` is "View Memo / Operations / Sales / Magento Admin". */
      title="View Memo"
      order={order}
      backTo="/admin/sales/creditmemo/"
      actions={actions}
      backUiId="sales-creditmemo-view-back-button"
    >
      {confirmNode}
      <section className="admin__page-section order-items">
        <div className="admin__page-section-title">
          {/* DIFF-019: the source's heading is the bare string. */}
          <span className="title">Items Refunded</span>
        </div>
        <table className="order-tables data-table admin__table-primary">
          <thead>
            <tr className="headings">
              <th className="col-product">Product</th>
              <th className="col-price">Price</th>
              <th className="col-qty">Qty</th>
              <th className="col-total">Row Total</th>
            </tr>
          </thead>
          <tbody>
            {visibleItems(order).map(item => (
              <tr key={item.item_id}>
                <td className="col-product"><ItemProductCell item={item} /></td>
                <td className="col-price">{formatCurrency(item.price)}</td>
                <td className="col-qty">{formatQty(item.qty_ordered)}</td>
                <td className="col-total">{formatCurrency(item.row_total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* DIFF-020: the credit-memo view's wrapper heading is `Memo Total`, not
       * `Order Total` (verified on the live source). */}
      <div className="admin__page-section-title order-total-title">
        <span className="title">Memo Total</span>
      </div>
      <section className="admin__page-section order-totals-comments">
        <DocumentCommentForm
          blockTitle="Credit Memo History"
          order={order}
          entityName="creditmemo"
          comments={(state.orderStatusHistory || []).filter(
            h => String(h.parent_id) === String(order.entity_id) && h.entity_name === 'creditmemo')}
        />
        <div className="admin__page-section-item order-totals">
          <div className="admin__page-section-item-title"><span className="title">Credit Memo Totals</span></div>
          <table className="order-totals-table">
            <tbody>
              <tr className="subtotal"><th>Subtotal</th><td>{formatCurrency(memo.subtotal)}</td></tr>
              <tr className="shipping">
                <th>Refund Shipping</th><td>{formatCurrency(memo.shipping_and_handling)}</td>
              </tr>
              <tr className="grand_total">
                <th>Grand Total</th><td>{formatCurrency(memo.base_grand_total)}</td>
              </tr>
            </tbody>
          </table>
          <div className="order-status-legend">
            Order status: {orderStatusLabel(memo.order_status)}
          </div>
        </div>
      </section>
    </DocumentShell>
  )
}
