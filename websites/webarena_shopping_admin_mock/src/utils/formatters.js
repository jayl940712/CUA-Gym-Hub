/**
 * Display formatters matching the source admin exactly.
 *
 * Timezone: the source stores UTC and renders in the store's locale timezone,
 * America/New_York. Verified against assets/screenshots/reference/sales-order-grid.png:
 * order 299 is `2023-05-31 06:55:09` in the DB and renders as
 * "May 31, 2023 2:55:09 AM" in the grid (UTC-4). Do not render raw UTC.
 */

export const DISPLAY_TZ = 'America/New_York'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Parse a `YYYY-MM-DD HH:MM:SS` (UTC) seed timestamp into a Date. */
export function parseSeedDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  const s = String(value).trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/)
  if (!m) { const d = new Date(s); return isNaN(d) ? null : d }
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)))
}

/** Break a UTC Date into display-timezone calendar parts. */
export function tzParts(date) {
  if (!date) return null
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: DISPLAY_TZ, year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true,
  })
  const parts = {}
  for (const p of fmt.formatToParts(date)) parts[p.type] = p.value
  return {
    year: +parts.year, month: +parts.month, day: +parts.day,
    hour: parts.hour, minute: parts.minute, second: parts.second,
    dayPeriod: (parts.dayPeriod || '').toUpperCase(),
  }
}

/** "May 31, 2023 2:55:09 AM" — the grid / order-view timestamp format. */
export function formatDateTime(value) {
  const d = parseSeedDate(value)
  if (!d) return ''
  const p = tzParts(d)
  return `${MONTHS[p.month - 1]} ${p.day}, ${p.year} ${p.hour}:${p.minute}:${p.second} ${p.dayPeriod}`
}

/** "May 31, 2023" — date-only columns (Customer Since, Created, …). */
export function formatDate(value) {
  const d = parseSeedDate(value)
  if (!d) return ''
  const p = tzParts(d)
  return `${MONTHS[p.month - 1]} ${p.day}, ${p.year}`
}

/** "5/31/23" — the compact form used by report date inputs (M/D/YY). */
export function formatShortDate(value) {
  const d = parseSeedDate(value)
  if (!d) return ''
  const p = tzParts(d)
  return `${p.month}/${p.day}/${String(p.year).slice(2)}`
}

/** Parse the report inputs' `M/D/YY` back into a Date (local midnight). */
export function parseShortDate(text) {
  const m = String(text || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!m) return null
  let year = +m[3]
  if (year < 100) year += 2000
  return new Date(Date.UTC(year, +m[1] - 1, +m[2]))
}

/** "$219.40" — Magento renders base currency with 2 decimals and a $ sign. */
export function formatCurrency(value) {
  const n = Number(value)
  if (value === null || value === undefined || Number.isNaN(n)) return ''
  const abs = Math.abs(n).toFixed(2)
  const [int, dec] = abs.split('.')
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${n < 0 ? '-' : ''}$${grouped}.${dec}`
}

/** "27.00" — the raw value the product form shows in `product[price]`. */
export function formatPrice(value) {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(value)
  return Number.isNaN(n) ? String(value) : n.toFixed(2)
}

/** "1,234" — integer with thousands separators (record counts, quantities). */
export function formatInt(value) {
  const n = Number(value)
  if (Number.isNaN(n)) return ''
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Magento renders quantities as plain integers when whole ("5", "478"). */
export function formatQty(value) {
  if (value === null || value === undefined || value === '') return ''
  const n = Number(value)
  if (Number.isNaN(n)) return String(value)
  return Number.isInteger(n) ? String(n) : String(n)
}

/** "000000299" — order/invoice/shipment increment ids are entity_id padded to 9. */
export function formatIncrementId(id) {
  return String(id).padStart(9, '0')
}

/** Source renders the purchase point as three indented lines. */
export function storeViewLines(storeName) {
  return String(storeName || 'Main Website\nMain Website Store\nDefault Store View').split('\n')
}

const STATUS_LABELS = {
  pending: 'Pending',
  processing: 'Processing',
  complete: 'Complete',
  closed: 'Closed',
  canceled: 'Canceled',
  holded: 'On Hold',
  fraud: 'Suspected Fraud',
  payment_review: 'Payment Review',
  paypal_canceled_reversal: 'PayPal Canceled Reversal',
  paypal_reversed: 'PayPal Reversed',
  pending_payment: 'Pending Payment',
  pending_paypal: 'Pending PayPal',
  stripe_pending: 'Pending Stripe',
}

/** Order status code -> the label tasks 676-680 string-match. */
export function orderStatusLabel(code) {
  return STATUS_LABELS[code] || code || ''
}

export const ORDER_STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }))

export function productTypeLabel(typeId) {
  return {
    simple: 'Simple Product',
    configurable: 'Configurable Product',
    grouped: 'Grouped Product',
    virtual: 'Virtual Product',
    bundle: 'Bundle Product',
    downloadable: 'Downloadable Product',
  }[typeId] || typeId || ''
}

export function productStatusLabel(status) {
  return Number(status) === 1 ? 'Enabled' : 'Disabled'
}

export function visibilityLabel(v) {
  return {
    1: 'Not Visible Individually',
    2: 'Catalog',
    3: 'Search',
    4: 'Catalog, Search',
  }[Number(v)] || ''
}

export function genderLabel(g) {
  return { 1: 'Male', 2: 'Female', 3: 'Not Specified' }[Number(g)] || ''
}

export function reviewStatusLabel(statusId) {
  return { 1: 'Approved', 2: 'Pending', 3: 'Not Approved' }[Number(statusId)] || ''
}

const ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  trade: '™', reg: '®', copy: '©', hellip: '…', mdash: '—', ndash: '–',
  rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”', deg: '°', eacute: 'é',
}

/**
 * Decode the HTML entities the seed carries. Product names in particular are
 * stored escaped — `Quest Lumaflex&trade; Band` must render as
 * "Quest Lumaflex™ Band", which is the string several tasks match on.
 */
export function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m)
}

/** Strip HTML to plain text — review bodies and CMS excerpts render as text. */
export function stripHtml(html) {
  return decodeEntities(String(html || '').replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()
}
