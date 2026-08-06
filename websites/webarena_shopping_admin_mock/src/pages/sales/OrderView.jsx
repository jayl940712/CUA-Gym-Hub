import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import NotFound from '../NotFound.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { getOrder, getOrderComments, customerGroupLabel } from '../../utils/selectors.js'
import { useSidNavigate } from '../../utils/navigation.js'
import { formatCurrency, formatDateTime, formatQty, orderStatusLabel } from '../../utils/formatters.js'
import {
  OrderViewNav, OrderAndAccountInformation, AddressInformation, PaymentAndShippingMethod,
  ItemsOrdered, OrderTotalsBlock, NoteList, CommentsBlock, StatusHistoryNoteList,
} from '../../components/sales/OrderBlocks.jsx'
import {
  canCancel, canHold, canUnhold, canInvoice, canShip, canCreditMemo, canEdit, canSendEmail, canReorder,
  makeHistoryEntry, fullOrderHistory,
} from '../../components/sales/orderHelpers.js'
import { useConfirm } from '../../components/sales/ConfirmModal.jsx'
import {
  OrderInvoicesGrid, OrderCreditMemosGrid, OrderShipmentsGrid,
} from '../../components/sales/OrderSubGrids.jsx'
import '../../components/sales/sales.css'

/* ROUTES.md rows 11 & 12 — /admin/sales/order/view/order_id/:id/
 *
 * The five left-rail tabs are the ones this deployment actually renders
 * (assets/html/sales-order-view-299.html: order_info, order_invoices,
 * order_creditmemos, order_shipments, order_history — there is no Transactions
 * tab). The tab is selected by the URL hash, so `#order_history` deep-links.
 */

const TAB_IDS = ['order_info', 'order_invoices', 'order_creditmemos', 'order_shipments', 'order_history']

export default function OrderView() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useSidNavigate()
  const { state, setState, addMessage } = useApp()
  const [confirmNode, askConfirm] = useConfirm()

  const order = getOrder(state, id)
  const comments = getOrderComments(state, id)

  const hashTab = location.hash.replace(/^#/, '')
  const [activeTab, setActiveTab] = useState(TAB_IDS.includes(hashTab) ? hashTab : 'order_info')
  useEffect(() => {
    if (TAB_IDS.includes(hashTab)) setActiveTab(hashTab)
  }, [hashTab])

  const invoices = useMemo(
    () => (state.invoices || []).filter(i => String(i.order_id) === String(id)),
    [state.invoices, id])
  const creditMemos = useMemo(
    () => (state.creditMemos || []).filter(c => String(c.order_id) === String(id)),
    [state.creditMemos, id])
  const shipments = useMemo(
    () => (state.shipments || []).filter(s => String(s.order_id) === String(id)),
    [state.shipments, id])
  const historyItems = useMemo(
    () => fullOrderHistory(state, id, comments), [state, id, comments])

  if (!order) return <NotFound />

  /* --------------------------------------------------------- comment form */

  function selectTab(tabId) {
    setActiveTab(tabId)
    window.history.replaceState(null, '', `${location.pathname}${location.search}#${tabId}`)
  }

  return (
    <PageShell
      title={`#${order.increment_id}`}
      documentTitle={`#${order.increment_id}`}
      actions={
        <OrderActions
          order={order}
          invoices={invoices}
          products={state.products}
          navigate={navigate}
          askConfirm={askConfirm}
        />
      }
    >
      {confirmNode}

      {/* DOM F-01 — the source ships the gift-options configure dialog on every
          order view, hidden behind its jQuery-UI wrapper (`display: none`), so
          `#gift_options_ok_button` / `#gift_options_cancel_button` resolve on a
          cold load. Copied from the live source's own markup
          (`.ui-dialog > #gift_options_configure > form#gift_options_configuration_form
          > #gift_options_form_contents > .ui-dialog-buttonset`); the mock never
          opens it, exactly as the source does not until an item's
          "Gift Options" link is clicked. */}
      <div className="ui-dialog ui-corner-all ui-widget ui-widget-content ui-front gift-options-popup"
        style={{ display: 'none' }}>
        <div id="gift_options_configure"
          className="gift-options-popup product-configure-popup ui-dialog-content ui-widget-content">
          <form id="gift_options_configuration_form" onSubmit={e => e.preventDefault()}>
            <div id="gift_options_form_contents">
              <div className="content" />
              <div className="ui-dialog-buttonset">
                <button type="button" className="action-close" id="gift_options_cancel_button">
                  <span>Cancel</span>
                </button>
                <button type="button" className="action-primary" id="gift_options_ok_button">
                  <span>OK</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="order-view-layout" id="sales_order_view">
        <OrderViewNav
          activeTab={activeTab}
          onSelect={selectTab}
          commentsHistoryHref={
            `/admin/sales/order/commentsHistory/order_id/${order.entity_id}/${location.search}`}
        />

        <div className="order-view-main">
          {activeTab === 'order_info' ? (
            <div id="sales_order_view_tabs_order_info_content">
              <OrderAndAccountInformation
                order={order}
                customerGroup={customerGroupLabel(state, order.customer_group_id) || 'General'}
              />
              <AddressInformation order={order} />
              <PaymentAndShippingMethod order={order} />
              <ItemsOrdered order={order} />

              {/* DIFF-013: the source's `Order Total` heading above the
                * "Notes for this Order" / "Order Totals" pair. */}
              <div className="admin__page-section-title order-total-title">
                <span className="title">Order Total</span>
              </div>
              <section className="admin__page-section order-totals-comments" id="order_history_block">
                <CommentForm
                  order={order}
                  comments={comments}
                  state={state}
                  setState={setState}
                  addMessage={addMessage}
                />
                <OrderTotalsBlock order={order} />
              </section>
            </div>
          ) : null}

          {/* The three document panes are always MOUNTED and toggled with
              `display`, never conditionally rendered (NEW-DOM-207): the source
              ships all three sub-grids — headers, multicheck cell and the whole
              filter panel — on cold load, before any tab is clicked, so
              `[name="order_increment_id"]`, `[name="state"]`,
              `[name="total_qty[from]"]` … all resolve immediately. */}
          <div
            id="sales_order_view_tabs_order_invoices_content"
            style={activeTab === 'order_invoices' ? undefined : { display: 'none' }}
          >
            <OrderInvoicesGrid invoices={invoices} />
          </div>

          <div
            id="sales_order_view_tabs_order_creditmemos_content"
            style={activeTab === 'order_creditmemos' ? undefined : { display: 'none' }}
          >
            <OrderCreditMemosGrid creditMemos={creditMemos} />
          </div>

          <div
            id="sales_order_view_tabs_order_shipments_content"
            style={activeTab === 'order_shipments' ? undefined : { display: 'none' }}
          >
            <OrderShipmentsGrid shipments={shipments} />
          </div>

          {activeTab === 'order_history' ? (
            <div id="sales_order_view_tabs_order_history_content">
              {/* DIFF-S02 — same fragment the standalone
                  /admin/sales/order/commentsHistory/order_id/N/ route serves:
                  note-list first, then the Notes block. */}
              <section className="admin__page-section edit-order-comments order-comments-history">
                <NoteList items={historyItems} />
                <CommentsBlock items={historyItems} />
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </PageShell>
  )
}

/* --------------------------------------------------------------- buttons */

function OrderActions({ order, invoices, products, navigate, askConfirm }) {
  const id = order.entity_id
  // The source's `confirmSetLocation()` opens an in-DOM Magento modal, not a
  // native dialog — see components/sales/ConfirmModal.jsx.
  const confirmThen = (question, to) => askConfirm(question, () => navigate(to))
  return (
    <div className="page-actions-buttons">
      <button
        id="back"
        data-ui-id="sales-order-ready-for-pickup-back-button"
        title="Back"
        type="button"
        className="action-default scalable back"
        // The source's Back button is `setLocation('…/admin/sales/order/index/order_id/<id>/')`
        // — the grid deep-linked back to this order, not the bare grid URL.
        // Verified in assets/html/sales-order-view-299.html.
        onClick={() => navigate(`/admin/sales/order/index/order_id/${id}/`)}
      >
        <span>Back</span>
      </button>

      {order.customer_id ? (
        <button
          id="guest_to_customer"
          data-ui-id="sales-order-ready-for-pickup-guest-to-customer-button"
          title="Login as Customer"
          type="button"
          className="action-default scalable reset"
          onClick={() => navigate(`/admin/customer/index/edit/id/${order.customer_id}/`)}
        >
          <span>Login as Customer</span>
        </button>
      ) : null}

      {/* DIFF-S01 — `Edit` is gated on Order::canEdit(): no Canceled, Closed,
        * Complete, Payment Review or Held order gets it, and neither does one
        * that already carries an invoice. */}
      {canEdit(order, invoices) ? (
        <button
          id="order_edit"
          data-ui-id="sales-order-ready-for-pickup-order-edit-button"
          title="Edit"
          type="button"
          className="action-default scalable edit primary"
          onClick={() => confirmThen(
            'Are you sure? This order will be canceled and a new one will be created instead.',
            `/admin/sales/order_edit/start/order_id/${id}/`)}
        >
          <span>Edit</span>
        </button>
      ) : null}

      {canCancel(order) ? (
        <button
          id="order-view-cancel-button"
          data-ui-id="sales-order-ready-for-pickup-order-view-cancel-button-button"
          title="Cancel"
          type="button"
          className="action-default scalable cancel"
          onClick={() => confirmThen('Are you sure you want to cancel this order?',
            `/admin/sales/order/cancel/order_id/${id}/`)}
        >
          <span>Cancel</span>
        </button>
      ) : null}

      {/* DIFF-S01 — `!$order->isCanceled()` is the whole gate on this one. */}
      {canSendEmail(order) ? (
        <button
          id="send_notification"
          data-ui-id="sales-order-ready-for-pickup-send-notification-button"
          title="Send Email"
          type="button"
          className="action-default scalable send-email"
          onClick={() => confirmThen('Are you sure you want to send an order email to customer?',
            `/admin/sales/order/email/order_id/${id}/`)}
        >
          <span>Send Email</span>
        </button>
      ) : null}

      {canUnhold(order) ? (
        <button
          id="order-view-unhold-button"
          data-ui-id="sales-order-ready-for-pickup-order-view-unhold-button-button"
          title="Unhold"
          type="button"
          className="action-default scalable unhold"
          onClick={() => navigate(`/admin/sales/order/unhold/order_id/${id}/`)}
        >
          <span>Unhold</span>
        </button>
      ) : canHold(order) ? (
        <button
          id="order-view-hold-button"
          data-ui-id="sales-order-ready-for-pickup-order-view-hold-button-button"
          title="Hold"
          type="button"
          className="action-default scalable hold"
          onClick={() => navigate(`/admin/sales/order/hold/order_id/${id}/`)}
        >
          <span>Hold</span>
        </button>
      ) : null}

      {canInvoice(order) ? (
        <button
          id="order_invoice"
          data-ui-id="sales-order-ready-for-pickup-order-invoice-button"
          title="Invoice"
          type="button"
          className="action-default scalable invoice"
          onClick={() => navigate(`/admin/sales/order_invoice/start/order_id/${id}/`)}
        >
          <span>Invoice</span>
        </button>
      ) : null}

      {/* DIFF-204. Magento's own `canCreditmemo()` gate, which no order in this
          deployment passes — the live source shows no Credit Memo button on
          order 1, 2 or 299 and 404s every `order_creditmemo/new/order_id/N/`.
          The conditional is kept because it is the source's, not the mock's. */}
      {canCreditMemo(order) ? (
        <button
          id="order_creditmemo"
          data-ui-id="sales-order-ready-for-pickup-order-creditmemo-button"
          title="Credit Memo"
          type="button"
          className="action-default scalable creditmemo"
          onClick={() => navigate(`/admin/sales/order_creditmemo/start/order_id/${id}/`)}
        >
          <span>Credit Memo</span>
        </button>
      ) : null}

      {canShip(order) ? (
        <button
          id="order_ship"
          data-ui-id="sales-order-ready-for-pickup-order-ship-button"
          title="Ship"
          type="button"
          className="action-default scalable ship"
          onClick={() => navigate(`/admin/admin/order_shipment/start/order_id/${id}/`)}
        >
          <span>Ship</span>
        </button>
      ) : null}

      {/* `Order::_canReorder()` — hidden for a held or payment-review order, and
          for one whose products no longer exist / are disabled. True on all 308
          seeded orders, matching the source over the round-9 58-order sample;
          it only bites once the mock's own Hold action fires. */}
      {canReorder(order, products) ? (
        <button
          id="order_reorder"
          data-ui-id="sales-order-ready-for-pickup-order-reorder-button"
          title="Reorder"
          type="button"
          className="action-default scalable reorder"
          onClick={() => navigate(`/admin/sales/order_create/reorder/order_id/${id}/`)}
        >
          <span>Reorder</span>
        </button>
      ) : null}

    </div>
  )
}

/* ---------------------------------------------------------- comment form */

/**
 * ROUTES.md row 16. The source posts this to
 * `/admin/sales/order/addComment/order_id/:id/` over AJAX and re-renders the
 * history block in place — so the mock mutates state directly and stays on the
 * page, which is the same user-visible behaviour.
 */
function CommentForm({ order, comments, state, setState, addMessage }) {
  const [status, setStatus] = useState(order.status)
  const [comment, setComment] = useState('')
  const [notify, setNotify] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => { setStatus(order.status) }, [order.status])

  /* F-05 — `Magento\Sales\Block\Adminhtml\Order\View\History::getStatuses()`
   * is `Order\Config::getStateStatuses($order->getState())`, which returns []
   * when no `sales_order_status_state` row carries that state, and otherwise the
   * assigned statuses `orderByLabel()`. Every order in this deployment is in
   * state `pending` / `processing` / `complete` / `closed` / `canceled`, and
   * `pending` has NO row — so the source renders ZERO options for orders 65 and
   * 299 and `.value === ""`. The mock's fallback invented a `pending` option
   * that the source does not have; there is no fallback in Magento. */
  const statusOptions = (state.orderStatuses || [])
    .filter(s => s.state === order.state)
    .map(s => ({ value: s.status, label: s.label }))
    .sort((a, b) => a.label.localeCompare(b.label))

  function submit() {
    /* BUG-007. Sales/Controller/Adminhtml/Order/AddComment.php:41 —
     *   if (empty($data['comment']) && $data['status'] == $order->getStatus())
     *       throw new LocalizedException(__('The comment is missing. Enter and try again.'))
     * An empty comment is only accepted when it carries a status change. */
    if (!comment.trim() && status === order.status) {
      addMessage('The comment is missing. Enter and try again.', 'error')
      return
    }
    const entry = makeHistoryEntry({
      status,
      comment: comment.trim(),
      notified: notify ? 1 : 0,
      visibleOnFront: visible ? 1 : 0,
    })
    const key = String(order.entity_id)
    setState(prev => {
      const next = {
        ...prev,
        orderComments: { ...prev.orderComments, [key]: [entry, ...(prev.orderComments[key] || comments || [])] },
      }
      if (status !== order.status) {
        next.orderOverrides = {
          ...prev.orderOverrides,
          [key]: { ...(prev.orderOverrides[key] || {}), status },
        }
      }
      return next
    })
    setComment('')
    setNotify(false)
    setVisible(false)
    addMessage('You submitted the order comment.')
  }

  return (
    <div className="admin__page-section-item edit-order-comments">
      <div className="edit-order-comments-block-title">Notes for this Order</div>

      <div className="admin__field field-status">
        <label className="admin__field-label" htmlFor="history_status"><span>Status</span></label>
        <select
          id="history_status"
          name="history[status]"
          className="admin__control-select"
          value={status}
          onChange={e => setStatus(e.target.value)}
        >
          {statusOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </div>

      <div className="admin__field field-comment">
        <label className="admin__field-label" htmlFor="history_comment"><span>Comment</span></label>
        <textarea
          id="history_comment"
          name="history[comment]"
          className="admin__control-textarea"
          rows={5}
          value={comment}
          onChange={e => setComment(e.target.value)}
        />
      </div>

      <div className="observed-element">
        <label className="admin__field-option" htmlFor="history_notify">
          <input
            id="history_notify"
            name="history[is_customer_notified]"
            type="checkbox"
            className="admin__control-checkbox"
            value="1"
            checked={notify}
            onChange={e => setNotify(e.target.checked)}
          />
          <span>Notify Customer by Email</span>
        </label>
        <label className="admin__field-option" htmlFor="history_visible">
          <input
            id="history_visible"
            name="history[is_visible_on_front]"
            type="checkbox"
            className="admin__control-checkbox"
            value="1"
            checked={visible}
            onChange={e => setVisible(e.target.checked)}
          />
          <span>Visible on Storefront</span>
        </label>
      </div>

      <div className="note-list-actions">
        <button
          type="button"
          /* DOM F-01 — the source's generic widget fallback hook. */
          data-ui-id="widget-button-0"
          className="action-default scalable action-save action-secondary"
          title="Submit Comment"
          onClick={submit}
        >
          <span>Submit Comment</span>
        </button>
      </div>

      <StatusHistoryNoteList comments={comments} />
    </div>
  )
}

