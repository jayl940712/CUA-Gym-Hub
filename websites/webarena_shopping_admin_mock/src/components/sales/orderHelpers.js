/**
 * Shared order logic for the Sales area.
 *
 * Everything here is derived from the seed (`orders.json`) or from the source's
 * own rules — nothing is invented. Magento's state machine is reproduced only as
 * far as the admin UI exposes it: which of Cancel / Hold / Unhold / Invoice /
 * Ship / Credit Memo are offered, and what the resulting status is.
 */

import { formatCurrency, formatDateTime, orderStatusLabel } from '../../utils/formatters.js'

/**
 * "May 31, 2023, 2:55:09 AM" — the order/invoice/shipment *view* pages put a
 * comma after the year, where the grids do not ("May 31, 2023 2:55:09 AM").
 * Both forms are in the source; see assets/html/sales-order-view-299.html vs
 * assets/screenshots/reference/sales-order-grid.png.
 */
export function formatViewDateTime(value) {
  const s = formatDateTime(value)
  return s.replace(/^(\w{3} \d{1,2}, \d{4}) /, '$1, ')
}

/** "7:42:37 PM" — the `.note-list-time` half of a history entry timestamp. */
export function formatNoteTime(value) {
  const s = formatDateTime(value)
  const m = s.match(/(\d{1,2}:\d{2}:\d{2} [AP]M)$/)
  return m ? m[1] : ''
}

/* ------------------------------------------------------------------ payment */

/** "Check / Money order" — the payment title lives in a JSON blob on payment. */
export function paymentMethodTitle(order) {
  const raw = order?.payment?.additional_information
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
      if (parsed?.method_title) return parsed.method_title
    } catch (e) { /* fall through to the code map */ }
  }
  return PAYMENT_TITLES[order?.payment?.method] || order?.payment?.method || ''
}

const PAYMENT_TITLES = {
  checkmo: 'Check / Money order',
  free: 'No Payment Information Required',
  banktransfer: 'Bank Transfer Payment',
  cashondelivery: 'Cash On Delivery',
  purchaseorder: 'Purchase Order',
  braintree: 'Credit Card (Braintree)',
}

/* -------------------------------------------------------------------- items */

/**
 * Magento's `getAllVisibleItems()`: a configurable order line is stored as a
 * parent row plus a $0.00 child row carrying the variant SKU, and only the
 * parent is rendered. Order 299 has 10 rows in the seed and shows 5 in
 * assets/html/sales-order-view-299.html — this is that filter.
 */
export function visibleItems(order) {
  return (order?.items || []).filter(i => !i.parent_item_id)
}

/* ------------------------------------------------------------------- totals */

export function num(value) {
  const n = Number(value)
  return Number.isNaN(n) ? 0 : n
}

/**
 * The Order Totals block. `total_paid` / `total_refunded` are absent from most
 * seed rows (only settled orders carry them) — absent means 0, as in the source.
 */
export function orderTotals(order) {
  const subtotal = num(order?.subtotal)
  const discount = num(order?.discount_amount)
  const shipping = num(order?.shipping_amount)
  const tax = num(order?.tax_amount)
  const grand = num(order?.grand_total)
  const paid = num(order?.total_paid)
  const refunded = num(order?.total_refunded)
  const due = order?.total_due !== undefined && order?.total_due !== null
    ? num(order.total_due)
    : grand - paid
  return { subtotal, discount, shipping, tax, grand, paid, refunded, due }
}

export const money = formatCurrency

/* ------------------------------------------------- confirmation email flag */

/**
 * `sales_order.email_sent`. The source renders
 * `Order # 000000001 (The order confirmation email is not sent)` for exactly the
 * two orders whose column is NULL, and `… was sent` for the other 306:
 *
 *   SELECT email_sent, COUNT(*) FROM sales_order GROUP BY email_sent;
 *   NULL -> 2 (entity_id 1, 2)   |   1 -> 306
 *
 * Those two are the only orders with invoices / shipments / credit memos, so
 * they are precisely the records the document views land on. The seed does not
 * carry the column, so the unsent set is pinned here from the container; if
 * `orders.json` ever gains `email_sent`, that value wins.
 */
const ORDERS_WITHOUT_CONFIRMATION_EMAIL = new Set(['1', '2'])

export function orderEmailSent(order) {
  if (!order) return false
  if (order.email_sent !== undefined) return !!order.email_sent
  return !ORDERS_WITHOUT_CONFIRMATION_EMAIL.has(String(order.entity_id))
}

/* --------------------------------------------------------- state machine */

/**
 * DIFF-S801. Every predicate below is a line-for-line port of
 * `Magento\Sales\Model\Order` and `Magento\Sales\Model\Order\Item` as they ship
 * in THIS deployment — read out of the running container, read-only:
 *
 *   docker exec shopping_admin cat \
 *     /var/www/magento2/vendor/magento/module-sales/Model/Order.php
 *   docker exec shopping_admin cat \
 *     /var/www/magento2/vendor/magento/module-sales/Model/Order/Item.php
 *
 * The bug they replace was a single shared `CLOSED_STATES = {canceled, closed,
 * complete}` set used by all five gates. That set is correct for `canInvoice()`
 * and wrong for `canShip()`: Magento's `canShip()` excludes only
 * canUnhold / isPaymentReview / isVirtual / isCanceled — **never `complete`** —
 * so the mock refused shipments on all 153 Complete orders that the live source
 * serves a New Shipment form for. Confirmed on the source over a 58-order
 * sample; see the round-9 agreement table in TEST.part-sales.md.
 *
 * The reason `complete` orders are still shippable in this deployment is data,
 * not logic: `sales_order_item` holds `qty_shipped > 0` on exactly 4 of 1630
 * rows, so almost every order — whatever its status — still has quantity left
 * to ship.
 *
 * `holded` and `payment_review` do not occur in the 308-order seed, but the
 * mock's own Hold action produces `state: 'holded'` at runtime, so those
 * branches are live. They are ported from the PHP above rather than measured,
 * because putting a source order on hold would mean writing to the container.
 */

const STATE_CANCELED = 'canceled'
const STATE_CLOSED = 'closed'
const STATE_COMPLETE = 'complete'
const STATE_HOLDED = 'holded'
const STATE_PAYMENT_REVIEW = 'payment_review'

function isCanceled(order) {
  return order.state === STATE_CANCELED
}

function isPaymentReview(order) {
  return order.state === STATE_PAYMENT_REVIEW
}

/**
 * `Order\Item::isDummy()`. For a configurable line the parent row carries the
 * quantities and the child row is the dummy — in both the shipment and the
 * invoice variant, because the seed has no bundle with `shipment_type` /
 * `product_calculations` set (checked: `sales_order_item.product_options`
 * contains no `shipment_type` in this deployment). `visibleItems()` is exactly
 * "the non-dummy rows", so both quantity walks run over it.
 */
export function qtyToShip(item) {
  const qty = num(item.qty_ordered)
    - Math.max(num(item.qty_shipped), num(item.qty_refunded))
    - num(item.qty_canceled)
  return Math.max(Math.round(qty * 1e8) / 1e8, 0)
}

export function qtyToInvoice(item) {
  const qty = num(item.qty_ordered) - num(item.qty_invoiced) - num(item.qty_canceled)
  return Math.max(Math.round(qty * 1e8) / 1e8, 0)
}

/**
 *   if ($this->getActionFlag(ACTION_FLAG_UNHOLD) === false || $this->isPaymentReview())
 *       return false;
 *   return $this->getState() === STATE_HOLDED;
 */
export function canUnhold(order) {
  if (!order) return false
  if (isPaymentReview(order)) return false
  return order.state === STATE_HOLDED
}

/**
 *   $notHoldableStates = [CANCELED, PAYMENT_REVIEW, COMPLETE, CLOSED, HOLDED];
 *   if (in_array($this->getState(), $notHoldableStates)) return false;
 *   return true;
 */
export function canHold(order) {
  if (!order) return false
  return ![STATE_CANCELED, STATE_PAYMENT_REVIEW, STATE_COMPLETE, STATE_CLOSED, STATE_HOLDED]
    .includes(order.state)
}

/**
 *   if (!$this->_canVoidOrder())  return false;   // !(canceled || canUnhold || paymentReview)
 *   if ($this->canUnhold())       return false;
 *   $allInvoiced = every item getQtyToInvoice() == 0;
 *   if ($allInvoiced)             return false;
 *   if (isCanceled() || $state === COMPLETE || $state === CLOSED) return false;
 *   return true;
 *
 * The `canReviewPayment() / canFetchPaymentReviewUpdate()` clause between the
 * two is false for every offline payment method in this deployment (checkmo,
 * free, banktransfer, cashondelivery, purchaseorder), so it never fires.
 */
export function canCancel(order) {
  if (!order) return false
  if (isCanceled(order) || canUnhold(order) || isPaymentReview(order)) return false
  if (!visibleItems(order).some(i => qtyToInvoice(i) > 0)) return false
  if (order.state === STATE_COMPLETE || order.state === STATE_CLOSED) return false
  return true
}

/**
 *   if ($this->canUnhold() || $this->isPaymentReview()) return false;
 *   if ($this->isCanceled() || $state === COMPLETE || $state === CLOSED) return false;
 *   foreach ($this->getAllItems() as $item)
 *       if ($item->getQtyToInvoice() > 0 && !$item->getLockedDoInvoice()) return true;
 *   return false;
 */
export function canInvoice(order) {
  if (!order) return false
  if (canUnhold(order) || isPaymentReview(order)) return false
  if (isCanceled(order) || order.state === STATE_COMPLETE || order.state === STATE_CLOSED) return false
  return visibleItems(order).some(i => qtyToInvoice(i) > 0 && !i.locked_do_invoice)
}

/**
 *   if ($this->canUnhold() || $this->isPaymentReview())  return false;
 *   if ($this->getIsVirtual() || $this->isCanceled())    return false;
 *   foreach ($this->getAllItems() as $item)
 *       if ($item->getQtyToShip() > 0 && !$item->getIsVirtual()
 *           && !$item->getLockedDoShip() && !$this->isRefunded($item)) return true;
 *   return false;
 *
 * `isRefunded($item)` is `qty_refunded == qty_ordered`. Note the absence of any
 * `complete` / `closed` test — that is the whole of DIFF-S801.
 */
export function canShip(order) {
  if (!order) return false
  if (canUnhold(order) || isPaymentReview(order)) return false
  if (order.is_virtual || isCanceled(order)) return false
  return visibleItems(order).some(i => (
    qtyToShip(i) > 0
    && !i.is_virtual
    && !i.locked_do_ship
    && num(i.qty_refunded) !== num(i.qty_ordered)
  ))
}

/**
 * `Order::canCreditmemo()` + `canCreditmemoForZeroTotalRefunded()`:
 *
 *   if (canUnhold() || isPaymentReview() || isCanceled() || $state === CLOSED)
 *       return false;
 *   $totalRefunded = round($this->getTotalPaid()) - $this->getTotalRefunded();
 *   if (abs($this->getGrandTotal()) < .0001) return canCreditmemoForZeroTotal(...);
 *   $isRefundZero    = abs($totalRefunded) < .0001;
 *   $hasAdjustmentFee = abs($totalRefunded - $this->getAdjustmentNegative()) < .0001;
 *   return !($isRefundZero || $hasAdjustmentFee);
 *
 * DIFF-204. The gate is on money *actually paid*, not on the existence of an
 * invoice. The previous port used `abs(paid - refunded) >= .0001`, which also
 * admits a *negative* balance; Magento's `hasAdjustmentFee` clause rejects that
 * case whenever `adjustment_negative` is 0 (which it is for all 308 orders).
 *
 * Over the 308 seeded orders this rule is false everywhere, which is exactly
 * what the source does: order 1 is the only row with `total_paid > total_refunded`
 * and it is canceled; order 2 is closed and fully refunded; the other 306 have
 * no `total_paid` at all. No order view in the deployment renders a
 * `Credit Memo` page-action button (verified over 58 orders, round 9), and
 * `/admin/sales/order_creditmemo/new/order_id/N/` 404s with
 * `We can't create credit memo for the order.`
 */
export function canCreditMemo(order) {
  if (!order) return false
  if (canUnhold(order) || isPaymentReview(order)) return false
  if (isCanceled(order) || order.state === STATE_CLOSED) return false
  const totalRefunded = Math.round(num(order.total_paid) * 100) / 100 - num(order.total_refunded)
  if (Math.abs(num(order.grand_total)) < 0.0001) {
    /* canCreditmemoForZeroTotal(): a zero grand total is refundable only when
     * nothing is still due and the paid amount has not already been refunded.
     * No order in this deployment has a zero grand total. */
    const checkAmtTotalPaid = num(order.total_paid) <= num(order.grand_total)
    const hasDueAmount = canInvoice(order) && checkAmtTotalPaid
    const paidAmtIsRefunded = num(order.total_refunded) === num(order.total_paid)
    if (hasDueAmount || paidAmtIsRefunded) return false
    if (!checkAmtTotalPaid && Math.abs(totalRefunded - num(order.adjustment_negative)) < 0.0001) return false
    return true
  }
  const isRefundZero = Math.abs(totalRefunded) < 0.0001
  const hasAdjustmentFee = Math.abs(totalRefunded - num(order.adjustment_negative)) < 0.0001
  return !(isRefundZero || hasAdjustmentFee)
}

/**
 * `Magento\Sales\Model\Order::canEdit()` — verbatim:
 *
 *   if ($this->canUnhold())                                        return false;
 *   if ($this->isCanceled() || $this->isPaymentReview()
 *       || $state === STATE_COMPLETE || $state === STATE_CLOSED)   return false;
 *   if ($this->hasInvoices())                                      return false;
 *
 * DIFF-S01. The mock used to render `Edit` unconditionally, so a Canceled or
 * Closed order offered an affordance the source does not have. Verified live:
 * order 1 (canceled) and order 2 (closed) render no `#order_edit`; orders 299
 * and 300 do.
 */
export function canEdit(order, invoices) {
  if (!order) return false
  if (canUnhold(order)) return false
  if (isCanceled(order) || isPaymentReview(order)) return false
  if (order.state === STATE_COMPLETE || order.state === STATE_CLOSED) return false
  if ((invoices || []).length) return false
  return true
}

/**
 * `Order::_canReorder()`:
 *
 *   if ($this->canUnhold() || $this->isPaymentReview()) return false;
 *   foreach ($itemsCollection as $item)
 *       if (!$productsCollection->getItemById($item->getProductId())) return false;
 *       if (!$product->isSalable())                                   return false;
 *   return true;
 *
 * DIFF-S801 sibling sweep. The mock rendered `#order_reorder` unconditionally,
 * which matches the source on all 308 seeded orders (all products still exist
 * and are salable, and no seeded order is holded) but diverges the moment the
 * mock's own Hold action puts an order into `holded` — Magento hides Reorder on
 * a held order. The salability walk needs the product catalog, so the caller
 * passes it; with no catalog the product test is skipped, exactly as Magento
 * skips it for an order with no items.
 */
export function canReorder(order, products) {
  if (!order) return false
  if (canUnhold(order) || isPaymentReview(order)) return false
  if (!order.customer_id) return true
  if (!products || !products.length) return true
  const byId = new Map(products.map(p => [String(p.entity_id), p]))
  for (const item of order.items || []) {
    const product = byId.get(String(item.product_id))
    if (!product) return false
    if (product.status !== undefined && Number(product.status) !== 1) return false
  }
  return true
}

/**
 * `Block\Adminhtml\Order\View::_construct()`:
 *   if ($this->_isAllowedAction('Magento_Sales::emails') && !$order->isCanceled())
 * — the only gate on `send_notification`. Verified live: absent on order 1
 * (canceled), present on order 2 (closed).
 */
export function canSendEmail(order) {
  return !!order && order.state !== 'canceled'
}

export function statusLabel(order) {
  return orderStatusLabel(order?.status)
}

/* ------------------------------------------------------- full history feed */

/**
 * DIFF-S02. `sales_order_status_history` holds exactly ONE row in the whole
 * source database (checked read-only:
 *   docker exec shopping_admin mysql … -e "SELECT COUNT(*) FROM sales_order_status_history"
 * -> 1), so the "Invoice #000000001 created" / "Shipment #000000001 created"
 * lines the source shows on order 1 are NOT seed rows — they are derived at
 * render time by `Block\Adminhtml\Order\View\Tab\History::getFullHistory()`,
 * which walks the status history, then the credit memos, then the shipments,
 * then the invoices, then the tracks, and stable-sorts the lot by timestamp.
 * This reproduces that walk over the seeded documents.
 *
 * `notified` follows the source exactly: the status-history rows use
 * `is_customer_notified`, the derived rows use the document's `email_sent`, and
 * `null` means the template renders no `.note-list-customer` span at all
 * (`isItemNotified($item, false)` is `isset() && false !== $item['notified']`).
 */
const DOCUMENT_EMAIL_SENT = {
  /* `email_sent` from the source's own sales_invoice / sales_shipment /
   * sales_creditmemo tables (read-only SELECT); absent = NULL = no span. */
  invoice: { 1: 1 },
  shipment: { 1: 1 },
  creditmemo: { 1: 1 },
}

function emailSent(kind, doc) {
  if (doc.email_sent !== undefined && doc.email_sent !== null) return doc.email_sent
  const hit = DOCUMENT_EMAIL_SENT[kind][doc.entity_id]
  return hit === undefined ? null : hit
}

function forOrder(rows, orderId) {
  return (rows || []).filter(r => String(r.order_id) === String(orderId))
}

export function fullOrderHistory(state, orderId, comments) {
  const key = String(orderId)
  const history = []

  /* `$order->getAllStatusHistory()` — every `sales_order_status_history` row
   * whose `parent_id` is this order, whatever its `entity_name`. The one row
   * the source database holds (parent_id 2, entity_name "creditmemo",
   * "We refunded $39.64 offline.") is exactly this case: it renders on order
   * 2's Comments History as a plain `Closed` entry. `orderComments` holds the
   * comments the mock's own comment form has added. */
  const seeded = (state?.orderStatusHistory || []).filter(h => String(h.parent_id) === key)
  for (const c of [...(comments || []), ...seeded]) {
    history.push({
      created_at: c.created_at,
      title: orderStatusLabel(c.status),
      notified: c.is_customer_notified,
      comment: c.comment || '',
    })
  }
  for (const memo of forOrder(state?.creditMemos, key)) {
    history.push({
      created_at: memo.created_at,
      title: `Credit memo #${memo.increment_id} created`,
      notified: emailSent('creditmemo', memo),
      comment: '',
    })
  }
  for (const shipment of forOrder(state?.shipments, key)) {
    history.push({
      created_at: shipment.created_at,
      title: `Shipment #${shipment.increment_id} created`,
      notified: emailSent('shipment', shipment),
      comment: '',
    })
  }
  for (const invoice of forOrder(state?.invoices, key)) {
    history.push({
      created_at: invoice.created_at,
      title: `Invoice #${invoice.increment_id} created`,
      notified: emailSent('invoice', invoice),
      comment: '',
    })
  }
  for (const track of (state?.shipmentTracks || [])) {
    const shipment = (state?.shipments || []).find(s => s.entity_id === track.parent_id)
    if (!shipment || String(shipment.order_id) !== key) continue
    history.push({
      created_at: track.created_at,
      title: `Tracking number ${track.track_number} for ${track.title} assigned`,
      notified: false,
      comment: '',
    })
  }

  /* `usort($history, sortHistoryByTimestamp)` — ascending, and stable, so ties
   * keep the walk order above. Verified on order 2, where all four entries
   * share 12:15:47 PM and the source renders
   * Closed / Credit memo #000000001 / Shipment #000000002 / Invoice #000000002. */
  return history
    .map((item, i) => [item, i])
    .sort((a, b) => (Date.parse(`${a[0].created_at}Z`) - Date.parse(`${b[0].created_at}Z`)) || (a[1] - b[1]))
    .map(pair => pair[0])
}

/* ------------------------------------------------------- comment history */

/** `YYYY-MM-DD HH:MM:SS` in UTC — the same shape every seed timestamp uses. */
export function nowSeedTimestamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} `
    + `${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`
}

/**
 * A `sales_order_status_history` row. `entity_name` mirrors the source column
 * that decides which order-view tab the entry belongs to.
 */
export function makeHistoryEntry({
  status, comment = '', notified = 0, visibleOnFront = 0, entityName = 'order',
}) {
  return {
    created_at: nowSeedTimestamp(),
    status,
    comment,
    is_customer_notified: notified ? 1 : 0,
    is_visible_on_front: visibleOnFront ? 1 : 0,
    entity_name: entityName,
  }
}

/* ------------------------------------------------------------- increments */

/** Next `000000NNN` for a collection keyed on `increment_id`. */
export function nextIncrementId(rows) {
  let max = 0
  for (const r of rows || []) {
    const n = Number(String(r.increment_id).replace(/\D/g, ''))
    if (!Number.isNaN(n)) max = Math.max(max, n)
  }
  return String(max + 1).padStart(9, '0')
}

export function nextEntityId(rows) {
  let max = 0
  for (const r of rows || []) max = Math.max(max, Number(r.entity_id) || 0)
  return max + 1
}

/* --------------------------------------------------------------- carriers */

/** Verbatim from the source's `tracking[N][carrier_code]` <select>. */
export const CARRIERS = [
  { value: 'custom', label: 'Custom Value' },
  { value: 'dhl', label: 'DHL' },
  { value: 'fedex', label: 'Federal Express' },
  { value: 'ups', label: 'United Parcel Service' },
  { value: 'usps', label: 'United States Postal Service' },
]

export function carrierLabel(code) {
  return CARRIERS.find(c => c.value === code)?.label || code || ''
}
