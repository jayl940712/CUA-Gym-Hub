/**
 * Merged reads over (static bulk seed) + (session overlay).
 *
 * Every page must read entities through these helpers. Reading
 * `staticData.js` directly skips the session overlay, so an agent's edit would
 * render as if it never happened.
 *
 * Results for whole-collection selectors are memoised per state object, so
 * calling `getOrders(state)` in a render loop is cheap.
 */

import * as S from './staticData.js'
import { decodeEntities } from './formatters.js'

const caches = new WeakMap()

const ENTITY_RE = /&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i

/**
 * 189 product names and 40 review `product_name` values are stored
 * HTML-escaped in the seed (`Quest Lumaflex&trade; Band`). The source renders
 * them decoded, and tasks match the decoded string, so decode once here — the
 * selector is the single read path, so no page has to remember.
 */
function decodeNamed(record, field = 'name') {
  const v = record?.[field]
  if (typeof v !== 'string' || !ENTITY_RE.test(v)) return record
  return { ...record, [field]: decodeEntities(v) }
}

function memo(state, key, compute) {
  if (!state) return compute()
  let bucket = caches.get(state)
  if (!bucket) { bucket = {}; caches.set(state, bucket) }
  if (!(key in bucket)) bucket[key] = compute()
  return bucket[key]
}

/* ------------------------------------------------------------------ orders */

export function getOrder(state, id) {
  // PIPELINE-008: orders placed through Sales > Orders > Create New Order live
  // in `state.newOrders` and are concatenated over the static corpus, exactly
  // as `newProducts` is over the product corpus.
  const created = state?.newOrders?.find(o => String(o.entity_id) === String(id))
  const base = created || S.orderById.get(String(id))
  if (!base) return null
  const patch = state?.orderOverrides?.[String(id)]
  const comments = state?.orderComments?.[String(id)]
  let order = patch ? { ...base, ...patch } : base
  if (comments) order = { ...order, comments }
  else if (!order.comments) order = { ...order, comments: [] }
  const addrPatches = state?.orderAddressOverrides
  if (addrPatches && order.addresses?.some(a => addrPatches[String(a.entity_id)])) {
    order = {
      ...order,
      addresses: order.addresses.map(a =>
        addrPatches[String(a.entity_id)] ? { ...a, ...addrPatches[String(a.entity_id)] } : a)
    }
  }
  return order
}

export function getOrders(state) {
  return memo(state, 'orders', () => [
    ...S.orders.map(o => getOrder(state, o.entity_id)),
    ...(state?.newOrders || []).map(o => getOrder(state, o.entity_id)),
  ])
}

/**
 * Flatten an order created this session into the shape `orderGrid.json` holds,
 * so a placed order appears in Sales > Orders with the same columns as the
 * seeded ones (PIPELINE-008). Magento derives the grid row from the order and
 * its addresses; this does the same, field for field.
 */
function newOrderGridRow(o) {
  const addressLine = a => (a
    ? [a.street, a.city, a.region, a.postcode].filter(Boolean).join(',') : '')
  const fullName = a => (a ? `${a.firstname || ''} ${a.lastname || ''}`.trim() : '')
  const billing = (o.addresses || []).find(a => a.address_type === 'billing')
  const shipping = (o.addresses || []).find(a => a.address_type === 'shipping')
  return {
    entity_id: o.entity_id,
    status: o.status,
    store_id: 1,
    store_name: 'Main Website\nMain Website Store\nDefault Store View',
    customer_id: o.customer_id,
    base_grand_total: o.grand_total,
    base_total_paid: null,
    grand_total: o.grand_total,
    total_paid: null,
    increment_id: o.increment_id,
    base_currency_code: 'USD',
    order_currency_code: 'USD',
    shipping_name: fullName(shipping),
    billing_name: fullName(billing),
    created_at: o.created_at,
    updated_at: o.updated_at,
    billing_address: addressLine(billing),
    shipping_address: addressLine(shipping),
    shipping_information: o.shipping_description,
    customer_email: o.customer_email,
    customer_group: String(o.customer_group_id ?? ''),
    subtotal: o.subtotal,
    shipping_and_handling: o.shipping_amount,
    customer_name: `${o.customer_firstname || ''} ${o.customer_lastname || ''}`.trim(),
    payment_method: o.payment?.method,
    total_refunded: null,
    pickup_location_code: null,
  }
}

/** Flattened rows for the Sales > Orders grid, with session edits applied. */
export function getOrderGridRows(state) {
  return memo(state, 'orderGrid', () => [...S.orderGrid, ...(state?.newOrders || []).map(newOrderGridRow)].map(row => {
    const patch = state?.orderOverrides?.[String(row.entity_id)]
    if (!patch) return row
    const merged = { ...row }
    if (patch.status !== undefined) merged.status = patch.status
    if (patch.grand_total !== undefined) merged.grand_total = patch.grand_total
    if (patch.updated_at !== undefined) merged.updated_at = patch.updated_at
    const addrPatches = state?.orderAddressOverrides
    if (addrPatches) {
      const order = S.orderById.get(String(row.entity_id))
      for (const a of order?.addresses || []) {
        const ap = addrPatches[String(a.entity_id)]
        if (!ap) continue
        const merged2 = { ...a, ...ap }
        const line = [merged2.street, merged2.city, merged2.region, merged2.postcode].filter(Boolean).join(',')
        const name = `${merged2.firstname || ''} ${merged2.lastname || ''}`.trim()
        if (a.address_type === 'billing') { merged.billing_address = line; merged.billing_name = name }
        else { merged.shipping_address = line; merged.shipping_name = name }
      }
    }
    return merged
  }))
}

export function getOrderComments(state, id) {
  return state?.orderComments?.[String(id)] || S.orderById.get(String(id))?.comments || []
}

/** Order-address lookup by the global address id used in the source URL. */
export function getOrderAddress(state, addressId) {
  const hit = S.orderAddressIndex.get(String(addressId))
  if (!hit) return null
  const patch = state?.orderAddressOverrides?.[String(addressId)]
  return { orderId: hit.orderId, address: patch ? { ...hit.address, ...patch } : hit.address }
}

/* ---------------------------------------------------------------- products */

export function getProduct(state, id) {
  const key = String(id)
  if (state?.deletedProductIds?.includes(Number(id))) return null
  const created = state?.newProducts?.find(p => String(p.entity_id) === key)
  const base = created || S.productById.get(key)
  if (!base) return null
  const patch = state?.productOverrides?.[key]
  return decodeNamed(patch ? { ...base, ...patch } : base)
}

export function getProducts(state) {
  return memo(state, 'products', () => {
    const deleted = new Set((state?.deletedProductIds || []).map(Number))
    const rows = []
    for (const p of S.products) {
      if (deleted.has(p.entity_id)) continue
      const patch = state?.productOverrides?.[String(p.entity_id)]
      rows.push(decodeNamed(patch ? { ...p, ...patch } : p))
    }
    for (const p of state?.newProducts || []) {
      if (deleted.has(p.entity_id)) continue
      const patch = state?.productOverrides?.[String(p.entity_id)]
      rows.push(decodeNamed(patch ? { ...p, ...patch } : p))
    }
    return rows
  })
}

/**
 * Salable Quantity = stock qty − MSI reservations (DIFF-002).
 *
 * Magento's Inventory module holds a reservation for every ordered unit whose
 * shipment has not yet been created, so Salable Quantity sits *below* Quantity
 * for any SKU with an outstanding order against it — MT09-XL-Blue is Quantity
 * 100.0000 / "Default Stock: 99" on the live source, MT09-M-Blue is 98.
 *
 * The reservations cannot be re-derived from `orders.json`: several of them
 * belong to orders whose status is already `complete` or `canceled` (Magento
 * releases a reservation on shipment, not on status), so the numbers only come
 * out right if the real `inventory_reservation` rows are used. They were dumped
 * read-only from the container (644 SKUs) into `src/data/stockReservations.json`
 * and live in staticData, NOT in session state — they are bulk reference data.
 */
export function stockReservationFor(sku) {
  return S.stockReservations[sku] || 0
}

export function getProductBySku(state, sku) {
  const base = S.productBySku.get(sku)
  if (base) return getProduct(state, base.entity_id)
  return state?.newProducts?.find(p => p.sku === sku) || null
}

/** Description HTML for a product: session override wins over the seed body. */
export function getProductDescription(state, id) {
  const override = state?.productDescriptionOverrides?.[String(id)]
  if (override !== undefined) return override
  const p = getProduct(state, id)
  if (!p) return ''
  return (p.description_ref && S.productDescriptions[p.description_ref]) || ''
}

export function getStockItem(productId) {
  return S.stockItemByProductId.get(String(productId)) || null
}

export function nextProductId(state) {
  let max = S.maxProductId
  for (const p of state?.newProducts || []) max = Math.max(max, p.entity_id)
  return max + 1
}

/* -------------------------------------------------------------- categories */

export function getCategory(state, id) {
  if ((state?.deletedCategoryIds || []).some(d => String(d) === String(id))) return null
  const base = S.categoryById.get(String(id))
    || (state?.newCategories || []).find(c => String(c.entity_id) === String(id))
  if (!base) return null
  const patch = state?.categoryOverrides?.[String(id)]
  return patch ? { ...base, ...patch } : base
}

export function getCategories(state) {
  return memo(state, 'categories', () => {
    const all = [...S.categories, ...(state?.newCategories || [])]
    return all.map(c => getCategory(state, c.entity_id)).filter(Boolean)
  })
}

export function nextCategoryId(state) {
  let max = S.maxCategoryId
  for (const c of state?.newCategories || []) max = Math.max(max, c.entity_id)
  return max + 1
}

/* ----------------------------------------------------------------- reviews */

export function getReviews(state) {
  return memo(state, 'reviews', () => {
    const deleted = new Set((state?.deletedReviewIds || []).map(Number))
    return (state?.reviews || [])
      .filter(r => !deleted.has(r.review_id))
      .map(r => decodeNamed(r, 'product_name'))
  })
}

export function getReview(state, id) {
  if (state?.deletedReviewIds?.includes(Number(id))) return null
  const hit = (state?.reviews || []).find(r => String(r.review_id) === String(id))
  return hit ? decodeNamed(hit, 'product_name') : null
}

/* --------------------------------------------------------------- customers */

export function getCustomer(state, id) {
  return (state?.customers || []).find(c => String(c.entity_id) === String(id)) || null
}

export function getCustomers(state) {
  return state?.customers || []
}

/** Flattened rows for the Customers grid, with session edits applied. */
export function getCustomerGridRows(state) {
  return memo(state, 'customerGrid', () => {
    const byId = new Map((state?.customers || []).map(c => [String(c.entity_id), c]))
    const rows = S.customerGrid.map(row => {
      const c = byId.get(String(row.entity_id))
      if (!c) return row
      return {
        ...row,
        name: c.name ?? row.name,
        email: c.email ?? row.email,
        group_id: c.group_id ?? row.group_id,
        dob: c.dob ?? row.dob,
        gender: c.gender ?? row.gender,
        created_at: c.created_at ?? row.created_at,
        billing_telephone: c.billing_telephone ?? row.billing_telephone,
        billing_full: c.billing_full ?? row.billing_full,
        shipping_full: c.shipping_full ?? row.shipping_full,
      }
    })
    // customers created at runtime have no pre-flattened grid row
    const seen = new Set(S.customerGrid.map(r => String(r.entity_id)))
    for (const c of state?.customers || []) {
      if (seen.has(String(c.entity_id))) continue
      rows.push({
        entity_id: c.entity_id, name: c.name, email: c.email, group_id: c.group_id,
        created_at: c.created_at, website_id: c.website_id, created_in: c.created_in,
        dob: c.dob, gender: c.gender, taxvat: c.taxvat ?? null, confirmation: null,
        billing_telephone: c.billing_telephone ?? null, billing_full: c.billing_full ?? null,
        shipping_full: c.shipping_full ?? null, billing_postcode: null,
        billing_country_id: null, billing_region: null,
      })
    }
    return rows
  })
}

export function customerGroupLabel(state, groupId) {
  const g = (state?.customerGroups || []).find(x => String(x.customer_group_id) === String(groupId))
  return g ? g.customer_group_code : ''
}

/* -------------------------------------------------------------- attributes */

/** Human label for an attribute option id, e.g. attrLabel('color', 49) -> 'Black'. */
export function attrLabel(code, optionId) {
  if (optionId === null || optionId === undefined || optionId === '') return ''
  const map = S.attributeOptions[code]
  return (map && map[String(optionId)]) || ''
}

export function attrOptions(code) {
  const map = S.attributeOptions[code] || {}
  return Object.entries(map).map(([option_id, label]) => ({ option_id, label }))
}

export function attributeSetLabel(setId) {
  return S.attributeSets[String(setId)] || ''
}
