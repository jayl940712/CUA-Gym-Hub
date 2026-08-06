/**
 * carriers/flatrate is unset in the source's core_config_data, so Magento's
 * shipped default applies: module-offline-shipping/etc/config.xml declares
 * `<price>5.00</price>` with `<type>I</type>` — five dollars *per item*, not a
 * flat $15 per order. All 37 seeded orders satisfy
 * `shippingAmount === 5 * totalQtyOrdered`.
 */
export const FLAT_RATE_PER_ITEM = 5

export function flatRateShipping(items) {
  return FLAT_RATE_PER_ITEM * (items || []).reduce((s, i) => s + i.qty, 0)
}

/**
 * Magento's sales order history grid sorts on the FULL `created_at` timestamp,
 * descending — `Magento\Sales\Block\Order\History` does
 * `->addAttributeToSort('created_at', 'desc')`. Nothing else participates.
 *
 * This used to bucket by rendered day (`storeDayKey`) and tie-break on
 * `entityId` desc, which is right only by coincidence. `createdAt` is the
 * container's raw UTC value, so a plain lexicographic descending compare on it
 * is order-equivalent to the source's SQL sort (the UTC→store-timezone shift is
 * monotonic, so it cannot reorder anything).
 *
 * Verified against the live source's own /sales/order/history/ pages 1–4,
 * logged in as emma.lopez@gmail.com — `b.createdAt.localeCompare(a.createdAt)`
 * reproduces all 37 rows in order:
 *   - the 189/188/187 same-day group the old heuristic was written for still
 *     comes out 189, 188, 187 (17:21:19 > 17:19:42 > 17:16:43)
 *   - the pair the old heuristic INVERTED comes out right: 000000160
 *     (2022-03-02 20:04:12) above 000000169 (2022-03-02 11:01:12), where
 *     entityId-desc had put 169 first
 */
export function sortedOrders(orders) {
  return [...orders].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
}

export function findOrder(orders, id) {
  const n = Number(id)
  return orders.find(o => Number(o.entityId) === n)
    || orders.find(o => o.incrementId === String(id))
    || null
}
