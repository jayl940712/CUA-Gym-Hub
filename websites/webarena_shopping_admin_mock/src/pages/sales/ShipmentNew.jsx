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
  CARRIERS, carrierLabel, makeHistoryEntry, nextEntityId, nextIncrementId, num, canShip, qtyToShip,
  visibleItems,
} from '../../components/sales/orderHelpers.js'
import { useDeferredEffect } from './OrderActionRoutes.jsx'
import '../../components/sales/sales.css'

/* ROUTES.md rows 24-26 — the New Shipment flow.
 *
 *   /admin/admin/order_shipment/start/order_id/:id/   -> redirect to new
 *   /admin/admin/order_shipment/new/order_id/:id/     -> the form
 *   /admin/admin/order_shipment/save/order_id/:id/    -> creates the shipment
 *
 * (The doubled `admin/admin` is the source's own URL — see the `#order_ship`
 * button in assets/html/sales-order-view-299.html.)
 *
 * Tasks 496-500 assert that the order's comment history then contains
 * `Tracking number <N> for <Carrier> assigned`, so each tracking row submitted
 * writes exactly that entry.
 */

export function ShipmentStart() {
  const { id } = useParams()
  const navigate = useSidNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    navigate(`/admin/admin/order_shipment/new/order_id/${id}/`, { replace: true })
  }, [id])
  return null
}

export default function ShipmentNew() {
  const { id } = useParams()
  const { state, addMessage } = useApp()
  const navigate = useSidNavigate()
  const order = getOrder(state, id)

  /* DIFF-S701 — the source 302s off this route for an order that cannot ship
   * (`/admin/admin/order_shipment/new/order_id/293/` -> the order view) and
   * flashes `Cannot do shipment for the order.` The mock used to stay on the
   * `/new/` URL with a disabled Submit and no message.
   * NOTE: the source's redirect target is the doubled-admin
   * `/admin/admin/order/view/order_id/:id/`, which `src/App.jsx` does not route
   * (not an owned file this round) — the mock lands on the routed
   * `/admin/sales/order/view/order_id/:id/` instead. */
  const declined = !!order && !canShip(order)
  useDeferredEffect(() => {
    if (!declined) return
    addMessage('Cannot do shipment for the order.', 'error')
    navigate(`/admin/sales/order/view/order_id/${id}/`, { replace: true })
  }, [id, declined])

  const [tracking, setTracking] = useState([])
  const [qtys, setQtys] = useState(() => {
    const init = {}
    /* `Order\Item::getQtyToShip()` — the same quantity `canShip()` gates on, so
     * a partly-refunded line pre-fills the quantity the source pre-fills. */
    for (const item of order?.items || []) init[item.item_id] = qtyToShip(item)
    return init
  })
  const [comment, setComment] = useState('')
  const [appendComments, setAppendComments] = useState(false)
  const [emailCopy, setEmailCopy] = useState(false)

  if (!order) return <NotFound />
  if (declined) return null

  const shippableItems = visibleItems(order).filter(i => qtyToShip(i) > 0)

  function addTrackingRow() {
    setTracking(rows => [...rows, { carrier_code: 'custom', title: '', number: '' }])
  }
  function patchRow(index, patch) {
    setTracking(rows => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)))
  }
  function removeRow(index) {
    setTracking(rows => rows.filter((_, i) => i !== index))
  }

  function submit() {
    const rows = tracking.filter(r => String(r.number).trim() !== '')
    navigate(`/admin/admin/order_shipment/save/order_id/${id}/`, {
      state: {
        shipment: {
          tracking: rows,
          items: qtys,
          comment_text: comment,
          append_comments: appendComments,
          send_email: emailCopy,
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
        data-ui-id="sales-shipment-create-back-button"
        className="action-default scalable back"
        onClick={() => navigate(`/admin/sales/order/view/order_id/${id}/`)}
      >
        <span>Back</span>
      </button>
      <button
        id="reset"
        title="Reset"
        type="button"
        data-ui-id="sales-shipment-create-reset-button"
        className="action-default scalable reset"
        onClick={() => { setTracking([]); setComment(''); setAppendComments(false); setEmailCopy(false) }}
      >
        <span>Reset</span>
      </button>
    </div>
  )

  return (
    <PageShell title="New Shipment" documentTitle="New Shipment" actions={actions} contentClassName="order-create-form">
      <OrderAndAccountInformation
        order={order}
        customerGroup={customerGroupLabel(state, order.customer_group_id) || 'General'}
      />
      <AddressInformation order={order} />
      <PaymentAndShippingMethod
        order={order}
        shippingTitle="Shipping Information"
        shippingAmountLabel="Total Shipping Charges:"
      />

      <section className="admin__page-section order-shipping-tracking">
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
            {tracking.length === 0 ? (
              <tr className="no-tracking">
                <td colSpan={4}>No tracking numbers have been added yet.</td>
              </tr>
            ) : tracking.map((row, i) => (
              <tr key={i}>
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
                <button type="button" className="action-default scalable"
                  title="Add Tracking Number" data-ui-id="shipment-tracking-add-button"
                  onClick={addTrackingRow}>
                  <span>Add Tracking Number</span>
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </section>

      <section className="admin__page-section order-items">
        <div className="admin__page-section-title">
          <span className="title">Items to Ship</span>
        </div>
        <div className="shipment-source">Inventory<br />Source: Default Source</div>
        <table className="order-tables data-table admin__table-primary">
          <thead>
            <tr className="headings">
              <th className="col-product">Product</th>
              <th className="col-qty">Qty</th>
              <th className="col-qty">Qty to Ship</th>
            </tr>
          </thead>
          <tbody>
            {shippableItems.map(item => (
              <tr key={item.item_id}>
                <td className="col-product"><ItemProductCell item={item} /></td>
                <td className="col-qty">
                  <table className="qty-table">
                    <tbody>
                      <tr><th>Ordered</th><td>{formatQty(item.qty_ordered)}</td></tr>
                    </tbody>
                  </table>
                </td>
                <td className="col-qty">
                  <input
                    /* F-02 — source is `<input type="text">`; a `number` input
                     * silently rejects `page.fill(…, '1.5')`. */
                    type="text"
                    name={`shipment[items][${item.item_id}]`}
                    className="input-text admin__control-text qty-input"
                    value={qtys[item.item_id] ?? 0}
                    onChange={e => setQtys(q => ({ ...q, [item.item_id]: e.target.value }))}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="admin__page-section order-shipment-totals order-section-columns">
        <div className="admin__page-section-item edit-order-comments">
          <div className="admin__page-section-item-title">
            <span className="title">Shipment Comments</span>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="shipment_comment_text"><span>Comment Text</span></label>
            <textarea
              id="shipment_comment_text"
              name="shipment[comment_text]"
              className="admin__control-textarea"
              rows={5}
              value={comment}
              onChange={e => setComment(e.target.value)}
            />
          </div>
        </div>

        <div className="admin__page-section-item">
          <div className="admin__page-section-item-title">
            <span className="title">Shipment Options</span>
          </div>
          <label className="admin__field-option" htmlFor="notify_customer">
            <input
              id="notify_customer"
              name="shipment[comment_customer_notify]"
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
              name="shipment[send_email]"
              type="checkbox"
              className="admin__control-checkbox"
              value="1"
              checked={emailCopy}
              onChange={e => setEmailCopy(e.target.checked)}
            />
            <span>Email Copy of Shipment</span>
          </label>
          <div className="order-form-actions">
            <button
              type="button"
              data-ui-id="order-items-submit-button"
              className="action-default scalable save submit-button primary"
              title="Submit Shipment"
              onClick={submit}
            >
              <span>Submit Shipment</span>
            </button>
          </div>
        </div>
      </section>
    </PageShell>
  )
}

/* --------------------------------------------------------------- row 26 */

/**
 * Creates the shipment, its items and its tracking rows, advances the order's
 * shipped quantities, and appends one
 * `Tracking number <N> for <Carrier> assigned` history entry per tracking row —
 * the exact string tasks 496-500 assert on the comments-history page.
 */
export function ShipmentSave() {
  const { id } = useParams()
  const location = useLocation()
  const navigate = useSidNavigate()
  const { state, setState, addMessage } = useApp()

  /* BUG-006 — see the matching note in InvoiceNew.InvoiceSave. Without the
   * deferred commit "The shipment has been created." is expired before the
   * order view renders. */
  useDeferredEffect(() => {
    const payload = location.state?.shipment
    const order = getOrder(state, id)
    if (!payload || !order) {
      navigate(`/admin/admin/order_shipment/new/order_id/${id}/`, { replace: true })
      return
    }

    const shipments = state.shipments || []
    const entityId = nextEntityId(shipments)
    const incrementId = nextIncrementId(shipments)
    const created = new Date().toISOString().slice(0, 19).replace('T', ' ')

    const shippedItems = visibleItems(order)
      .map(item => ({ item, qty: Number(payload.items?.[item.item_id]) || 0 }))
      .filter(x => x.qty > 0)
    const totalQty = shippedItems.reduce((n, x) => n + x.qty, 0)

    const shipment = {
      entity_id: entityId,
      increment_id: incrementId,
      store_id: 1,
      order_increment_id: order.increment_id,
      order_id: order.entity_id,
      order_created_at: order.created_at,
      customer_name: `${order.customer_firstname || ''} ${order.customer_lastname || ''}`.trim(),
      total_qty: totalQty,
      shipment_status: null,
      order_status: order.status,
      billing_address: null,
      shipping_address: null,
      billing_name: null,
      shipping_name: `${order.customer_firstname || ''} ${order.customer_lastname || ''}`.trim(),
      customer_email: order.customer_email,
      customer_group_id: order.customer_group_id,
      payment_method: order.payment?.method || null,
      shipping_information: order.shipping_description,
      created_at: created,
      updated_at: created,
    }

    const itemBaseId = nextEntityId(state.shipmentItems || [])
    const shipmentItems = shippedItems.map((x, i) => ({
      entity_id: itemBaseId + i,
      parent_id: entityId,
      order_item_id: x.item.item_id,
      sku: x.item.sku,
      name: x.item.name,
      qty: x.qty,
      price: x.item.price,
      row_total: x.item.row_total,
      weight: x.item.weight ?? null,
    }))

    const trackBaseId = nextEntityId(state.shipmentTracks || [])
    const tracks = (payload.tracking || []).map((t, i) => ({
      entity_id: trackBaseId + i,
      parent_id: entityId,
      order_id: order.entity_id,
      carrier_code: t.carrier_code,
      title: t.title || carrierLabel(t.carrier_code),
      track_number: String(t.number).trim(),
      created_at: created,
    }))

    const key = String(order.entity_id)
    const historyEntries = tracks.map(t => makeHistoryEntry({
      status: order.status,
      comment: `Tracking number ${t.track_number} for ${carrierLabel(t.carrier_code)} assigned`,
    }))
    if (payload.comment_text && payload.comment_text.trim()) {
      historyEntries.push(makeHistoryEntry({
        status: order.status,
        comment: payload.comment_text.trim(),
        notified: payload.append_comments ? 1 : 0,
        entityName: 'shipment',
      }))
    }

    const itemPatch = {}
    for (const x of shippedItems) itemPatch[x.item.item_id] = num(x.item.qty_shipped) + x.qty

    setState(prev => {
      const nextItems = (getOrder(prev, id)?.items || []).map(item => (
        itemPatch[item.item_id] !== undefined
          ? { ...item, qty_shipped: itemPatch[item.item_id] }
          : item
      ))
      const fullyShipped = nextItems.every(i => num(i.qty_shipped) >= num(i.qty_ordered))
      return {
        ...prev,
        shipments: [...(prev.shipments || []), shipment],
        shipmentItems: [...(prev.shipmentItems || []), ...shipmentItems],
        shipmentTracks: [...(prev.shipmentTracks || []), ...tracks],
        orderOverrides: {
          ...prev.orderOverrides,
          [key]: {
            ...(prev.orderOverrides[key] || {}),
            items: nextItems,
            state: fullyShipped && prev.orderOverrides[key]?.state !== 'complete' ? 'processing' : (prev.orderOverrides[key]?.state || order.state),
            status: order.status === 'pending' ? 'processing' : order.status,
            updated_at: created,
          },
        },
        orderComments: {
          ...prev.orderComments,
          [key]: [...historyEntries.reverse(), ...(prev.orderComments[key] || [])],
        },
      }
    })

    addMessage('The shipment has been created.')
    navigate(`/admin/sales/order/view/order_id/${id}/`, { replace: true })
  }, [id])

  return null
}
