/**
 * Static (read-only) seed modules.
 *
 * NOTHING in this file is part of the session state that is POSTed to
 * /post?action=set_current, diffed, and returned by /go. These are bulk
 * reference corpora extracted from the source `magentodb` database; the admin
 * either cannot mutate them at all, or mutates them through an overlay held in
 * session state (see `dataManager.js` for the split rationale).
 *
 * Read them through the selectors in `selectors.js`, never directly, so that
 * session overlays are applied.
 */

import productsSeed from '../data/products.json'
import ordersSeed from '../data/orders.json'
import orderGridSeed from '../data/orderGrid.json'
import customerGridSeed from '../data/customerGrid.json'
import stockItemsSeed from '../data/stockItems.json'
import stockReservationsSeed from '../data/stockReservations.json'
import productDescriptionsSeed from '../data/productDescriptions.json'
import categoriesSeed from '../data/categories.json'
import attributeSetsSeed from '../data/attributeSets.json'
import attributeSetsFullSeed from '../data/attributeSetsFull.json'
import attributeOptionsSeed from '../data/attributeOptions.json'
import productAttributesSeed from '../data/productAttributes.json'
import superAttributesSeed from '../data/superAttributes.json'
import reviewSummariesSeed from '../data/reviewSummaries.json'
import reviewStatusesSeed from '../data/reviewStatuses.json'
import reportAggregatesSeed from '../data/reportAggregates.json'

export const products = productsSeed
export const orders = ordersSeed
export const orderGrid = orderGridSeed
export const customerGrid = customerGridSeed
export const stockItems = stockItemsSeed
/**
 * { [sku]: unitsReserved } from the container's `inventory_reservation` table.
 * Read-only reference data — deliberately NOT part of session state.
 */
export const stockReservations = stockReservationsSeed
export const productDescriptions = productDescriptionsSeed
export const categories = categoriesSeed
export const attributeSets = attributeSetsSeed
export const attributeSetsFull = attributeSetsFullSeed
export const attributeOptions = attributeOptionsSeed
export const productAttributes = productAttributesSeed
export const superAttributes = superAttributesSeed
export const reviewSummaries = reviewSummariesSeed
export const reviewStatuses = reviewStatusesSeed
export const reportAggregates = reportAggregatesSeed

/* ---------------------------------------------------------------- indexes */

function indexBy(rows, key) {
  const m = new Map()
  for (const r of rows) m.set(String(r[key]), r)
  return m
}

export const productById = indexBy(products, 'entity_id')
export const orderById = indexBy(orders, 'entity_id')
export const orderGridById = indexBy(orderGrid, 'entity_id')
export const customerGridById = indexBy(customerGrid, 'entity_id')
export const stockItemByProductId = indexBy(stockItems, 'product_id')
export const categoryById = indexBy(categories, 'entity_id')

/** SKU -> product (SKUs are unique in this dataset). */
export const productBySku = (() => {
  const m = new Map()
  for (const p of products) m.set(p.sku, p)
  return m
})()

/**
 * Order-address ids are global across orders (order 299 -> 597/598), so
 * `/admin/sales/order/address/address_id/604/` has to resolve without knowing
 * which order owns it.
 */
export const orderAddressIndex = (() => {
  const m = new Map()
  for (const o of orders) {
    for (const a of o.addresses || []) m.set(String(a.entity_id), { orderId: o.entity_id, address: a })
  }
  return m
})()

/** Highest ids in the seed — the starting point for runtime-created records. */
export const maxProductId = products.reduce((n, p) => Math.max(n, p.entity_id), 0)
export const maxOrderId = orders.reduce((n, o) => Math.max(n, o.entity_id), 0)
export const maxCategoryId = categories.reduce((n, c) => Math.max(n, c.entity_id), 0)
