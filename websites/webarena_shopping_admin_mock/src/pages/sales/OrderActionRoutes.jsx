import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { getOrder } from '../../utils/selectors.js'
import { useSidNavigate } from '../../utils/navigation.js'
import {
  canCancel, canHold, canUnhold, makeHistoryEntry,
} from '../../components/sales/orderHelpers.js'

/* ROUTES.md rows 17-20 — the order-view action endpoints.
 *
 * The source handles these as POSTs that mutate and then 302 back to the order
 * view with a flash message. There is no server here, so each is a route that
 * performs the same mutation through the context (so it reaches saveState() ->
 * /go state_diff) and then navigates back — the URL, the state change and the
 * message all match the source.
 */

/**
 * Run the action one commit after mount, then redirect.
 *
 * The delay is load-bearing. AppContext expires a flash message one navigation
 * after it was set, and its expiry effect runs *after* this component's effect
 * in the commit that mounts this route. Adding the message during that same
 * commit would mark it already-shown, so the redirect would drop it and the
 * order view would render with no confirmation at all. Arming first lets the
 * expiry effect pass, so the message is set on a quiet commit and survives the
 * redirect exactly as it does in the source.
 */
export function useDeferredEffect(run, deps) {
  const [armed, setArmed] = useState(false)
  const done = useRef(false)
  useEffect(() => { setArmed(true) }, deps)
  useEffect(() => {
    if (!armed || done.current) return
    done.current = true
    run()
  }, [armed])
}

function useOrderAction(run) {
  const { id } = useParams()
  const app = useApp()
  const navigate = useSidNavigate()

  useDeferredEffect(() => {
    run({ id, ...app })
    navigate(`/admin/sales/order/view/order_id/${id}/`, { replace: true })
  }, [id])

  return null
}

/** Row 17 — status -> Canceled, history entry, "You canceled the order." */
export function OrderCancel() {
  return useOrderAction(({ id, state, setState, addMessage }) => {
    const order = getOrder(state, id)
    if (!order) return
    if (!canCancel(order)) {
      addMessage('You cannot cancel the order.', 'error')
      return
    }
    const key = String(id)
    setState(prev => ({
      ...prev,
      orderOverrides: {
        ...prev.orderOverrides,
        [key]: { ...(prev.orderOverrides[key] || {}), state: 'canceled', status: 'canceled' },
      },
      orderComments: {
        ...prev.orderComments,
        [key]: [makeHistoryEntry({ status: 'canceled' }), ...(prev.orderComments[key] || order.comments || [])],
      },
    }))
    addMessage('You canceled the order.')
  })
}

/** Row 18 — status -> On Hold, remembering what to restore on unhold. */
export function OrderHold() {
  return useOrderAction(({ id, state, setState, addMessage }) => {
    const order = getOrder(state, id)
    if (!order) return
    if (!canHold(order)) {
      addMessage('You cannot put the order on hold.', 'error')
      return
    }
    const key = String(id)
    setState(prev => ({
      ...prev,
      orderOverrides: {
        ...prev.orderOverrides,
        [key]: {
          ...(prev.orderOverrides[key] || {}),
          state: 'holded',
          status: 'holded',
          hold_before_state: order.state,
          hold_before_status: order.status,
        },
      },
      orderComments: {
        ...prev.orderComments,
        [key]: [makeHistoryEntry({ status: 'holded' }), ...(prev.orderComments[key] || order.comments || [])],
      },
    }))
    addMessage('You put the order on hold.')
  })
}

/** Row 19 — restore the pre-hold status. */
export function OrderUnhold() {
  return useOrderAction(({ id, state, setState, addMessage }) => {
    const order = getOrder(state, id)
    if (!order) return
    if (!canUnhold(order)) {
      addMessage('You cannot release the order from on hold status.', 'error')
      return
    }
    const key = String(id)
    const restoredState = order.hold_before_state || 'processing'
    const restoredStatus = order.hold_before_status || 'processing'
    setState(prev => ({
      ...prev,
      orderOverrides: {
        ...prev.orderOverrides,
        [key]: {
          ...(prev.orderOverrides[key] || {}),
          state: restoredState,
          status: restoredStatus,
          hold_before_state: null,
          hold_before_status: null,
        },
      },
      orderComments: {
        ...prev.orderComments,
        [key]: [makeHistoryEntry({ status: restoredStatus }), ...(prev.orderComments[key] || order.comments || [])],
      },
    }))
    addMessage('You released the order from holding status.')
  })
}

/**
 * Row 20 — Send Email.
 *
 * The mock cannot send mail, but in the source the action is still observable,
 * so it must not be a bare success message. `OrderSender::send()` sets
 * `sales_order.email_sent = 1` — which is what the order view's
 * `The order confirmation email was sent` / `is not sent` line reads — and
 * `NotifierAbstract::notifySender()` flips the newest un-notified
 * `sales_order_status_history` row to `is_customer_notified = 1`. Both are
 * reproduced here so the click leaves a real footprint in state_diff.
 */
export function OrderEmail() {
  return useOrderAction(({ id, state, setState, addMessage }) => {
    const order = getOrder(state, id)
    if (!order) return
    const key = String(id)
    setState(prev => {
      const history = prev.orderComments[key] || order.comments || []
      const unnotified = history.findIndex(h => !h.is_customer_notified)
      const next = {
        ...prev,
        orderOverrides: {
          ...prev.orderOverrides,
          [key]: { ...(prev.orderOverrides[key] || {}), email_sent: 1 },
        },
      }
      if (unnotified !== -1) {
        next.orderComments = {
          ...prev.orderComments,
          [key]: history.map((h, i) => (i === unnotified ? { ...h, is_customer_notified: 1 } : h)),
        }
      }
      return next
    })
    addMessage('You sent the order email.')
  })
}

/* --------------------------------------- invoice / shipment / credit memo
 *
 * The `Send Email` button on each document view. URLs and messages are the
 * source's own:
 *   invoice     /admin/sales/order_invoice/email/order_id/N/invoice_id/M/
 *               -> "You sent the message."
 *   shipment    /admin/admin/order_shipment/email/shipment_id/M/
 *               -> "You sent the shipment."
 *   credit memo /admin/sales/order_creditmemo/email/creditmemo_id/M/order_id/N/
 *               -> "You sent the message."
 * (Adminhtml/Invoice/AbstractInvoice/Email.php, Shipment/Email.php,
 * Creditmemo/AbstractCreditmemo/Email.php in the container.)
 *
 * As with the order email above, the send itself is unreproducible but its
 * record is not: each document sender sets `email_sent = 1` on its own row
 * (`sales_invoice`, `sales_shipment`, `sales_creditmemo`), so the mock writes
 * that through the context rather than printing an unbacked success.
 */
function useDocumentEmail(collection, paramName, backPath, message) {
  const params = useParams()
  const { state, updateCollectionItem, addMessage } = useApp()
  const navigate = useSidNavigate()
  const docId = params[paramName]
  useDeferredEffect(() => {
    const doc = (state[collection] || []).find(d => String(d.entity_id) === String(docId))
    navigate(backPath(docId, params), { replace: true })
    // No such document: fall through to the view, which renders Not Found.
    // Claiming the mail was sent would be a false success.
    if (!doc) return
    updateCollectionItem(collection, 'entity_id', docId, { email_sent: 1 })
    addMessage(message)
  }, [docId])
  return null
}

/* DIFF-206. Each `Email` controller ends in `_redirect('sales/order_<doc>/view', …)`
 * — its *own* controller's view action, not the grid's — so the URL an agent is
 * left on is not the one the grid's View link produces. Measured on the live
 * source (cold-load the email URL, read `page.url` after the 302):
 *
 *   sales/order_invoice/email/order_id/1/invoice_id/1/
 *       -> /admin/sales/invoice/view/order_id/1/invoice_id/1/
 *   admin/order_shipment/email/shipment_id/1/
 *       -> /admin/admin/order_shipment/view/shipment_id/1/
 *   sales/order_creditmemo/email/creditmemo_id/1/order_id/2/
 *       -> /admin/sales/order_creditmemo/view/creditmemo_id/1/
 *
 * All three targets return 200 on the source and are registered in App.jsx as
 * aliases of the same view components. WebArena evaluators read the final URL,
 * so these must match segment for segment.
 */
export function InvoiceEmail() {
  return useDocumentEmail(
    'invoices', 'invoiceId',
    (id, params) => `/admin/sales/invoice/view/order_id/${params.id}/invoice_id/${id}/`,
    'You sent the message.')
}

export function ShipmentEmail() {
  return useDocumentEmail(
    'shipments', 'shipmentId',
    id => `/admin/admin/order_shipment/view/shipment_id/${id}/`, 'You sent the shipment.')
}

export function CreditMemoEmail() {
  return useDocumentEmail(
    'creditMemos', 'creditmemoId',
    id => `/admin/sales/order_creditmemo/view/creditmemo_id/${id}/`, 'You sent the message.')
}

/**
 * Row 16 — the comment form posts here. The form itself writes the comment
 * (it holds the field values), so this route exists for URL parity and to land
 * the agent back on the history it just wrote.
 */
export function OrderAddComment() {
  const { id } = useParams()
  const navigate = useSidNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    navigate(`/admin/sales/order/view/order_id/${id}/#order_history`, { replace: true })
  }, [id])
  return null
}
