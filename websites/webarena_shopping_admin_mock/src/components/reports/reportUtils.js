/**
 * Shared plumbing for the Reports section.
 *
 * Magento's report pages are *not* UI-component grids. They are a "Filter"
 * fieldset that submits, and a static table rendered from the pre-aggregated
 * `report_*` tables. The seed carries those tables verbatim in
 * `src/data/reportAggregates.json`, so every number here is computed from the
 * same rows the source's SQL reads — nothing is hardcoded per task.
 *
 * URL contract (copied from the source): submitting the filter form navigates
 * to `<report path>/filter/<base64 of the query string>/`. Both that form and a
 * plain `?from=…&to=…` query string are accepted on load, so deep links work.
 */

import { parseShortDate, formatShortDate } from '../../utils/formatters.js'

/* -------------------------------------------------------- filter url codec */

export function encodeFilter(values) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined || v === null || v === '') continue
    if (Array.isArray(v)) v.forEach(x => qs.append(`${k}[]`, x))
    else qs.set(k, String(v))
  }
  const raw = qs.toString()
  try { return btoa(raw) } catch (e) { return encodeURIComponent(raw) }
}

export function decodeFilter(segment) {
  if (!segment) return null
  let raw
  try { raw = atob(decodeURIComponent(segment)) } catch (e) { raw = decodeURIComponent(segment) }
  const qs = new URLSearchParams(raw)
  const out = {}
  for (const [k, v] of qs.entries()) {
    if (k.endsWith('[]')) {
      const key = k.slice(0, -2)
      out[key] = [...(out[key] || []), v]
    } else out[k] = v
  }
  return out
}

/* ------------------------------------------------------------- period math */

/**
 * Bucket key for an aggregate row's `period` (always `YYYY-MM-DD` in the seed).
 * The daily/monthly/yearly tables already store the bucket start date, so this
 * only has to truncate when a coarser period is requested.
 */
export function periodKey(dateStr, periodType) {
  const s = String(dateStr).slice(0, 10)
  if (periodType === 'year') return `${s.slice(0, 4)}-01-01`
  if (periodType === 'month') return `${s.slice(0, 7)}-01`
  return s
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/**
 * Interval label exactly as the source renders it, verified live:
 * year `2022` · month `5/2022` · day `Jan 8, 2022`.
 */
export function periodLabel(key, periodType) {
  const [y, m, d] = String(key).split('-').map(Number)
  if (periodType === 'year') return String(y)
  if (periodType === 'month') return `${m}/${y}`
  return `${MONTHS[m - 1]} ${d}, ${y}`
}

/** All bucket keys between two dates — used when "Empty Rows" is Yes. */
export function periodRange(from, to, periodType) {
  if (!from || !to) return []
  const keys = []
  const cur = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()))
  const guard = 4000
  while (cur <= to && keys.length < guard) {
    keys.push(periodKey(isoDate(cur), periodType))
    if (periodType === 'year') cur.setUTCFullYear(cur.getUTCFullYear() + 1)
    else if (periodType === 'month') cur.setUTCMonth(cur.getUTCMonth() + 1)
    else cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return [...new Set(keys)]
}

export function isoDate(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

export { parseShortDate, formatShortDate }

/** True when an aggregate row's period falls inside the requested range. */
export function inRange(rowPeriod, from, to) {
  const p = String(rowPeriod).slice(0, 10)
  if (from && p < isoDate(from)) return false
  if (to && p > isoDate(to)) return false
  return true
}

/**
 * Which pre-aggregated table a period type reads. Magento keeps one table per
 * granularity and picks by the "Period" select.
 */
export function tableFor(base, periodType) {
  return `${base}_${periodType === 'year' ? 'yearly' : periodType === 'month' ? 'monthly' : 'daily'}`
}

/* ------------------------------------------------------------- aggregation */

const num = v => (v === null || v === undefined || v === '' ? 0 : Number(v) || 0)

/**
 * MySQL `SUM()` semantics, which these reports depend on: NULL rows are skipped
 * and the sum of an all-NULL group is NULL, not 0 — the source prints those
 * cells blank. The Shipping Report's *Total Shipping* column is `$5.00` for
 * 2022 (one non-null row) but blank for 2023 (every contributing row NULL), and
 * the Refunds Report leaves *Online Refunds* blank for the same reason.
 */
function sqlSum(acc, v) {
  if (v === null || v === undefined || v === '') return acc
  return (acc === null || acc === undefined ? 0 : acc) + num(v)
}

/**
 * Group aggregate rows into interval buckets and sum the requested measures.
 * `sumFields` are added; `firstFields` are carried from the first row.
 */
export function aggregateByPeriod(rows, periodType, sumFields, extraKey = null, firstFields = []) {
  const buckets = new Map()
  for (const r of rows) {
    const key = periodKey(r.period, periodType)
    const sub = extraKey ? `${key}\x00${extraKey(r)}` : key
    let bucket = buckets.get(sub)
    if (!bucket) {
      bucket = { __period: key }
      for (const f of firstFields) bucket[f] = r[f]
      for (const f of sumFields) bucket[f] = null
      buckets.set(sub, bucket)
    }
    for (const f of sumFields) bucket[f] = sqlSum(bucket[f], r[f])
  }
  return [...buckets.values()].sort((a, b) => (a.__period < b.__period ? -1 : a.__period > b.__period ? 1 : 0))
}

/** Column totals for the `<tfoot class="totals">` row. */
export function totalsOf(rows, fields) {
  const out = {}
  for (const f of fields) out[f] = rows.reduce((a, r) => sqlSum(a, r[f]), null)
  return out
}

/** The "All Websites" scope reads store_id 0; a store view reads its own id. */
export function scopeRows(rows, storeId = 0) {
  return rows.filter(r => Number(r.store_id) === Number(storeId))
}

/* ------------------------------------------------------------- bestsellers */

/**
 * Magento's Bestsellers Report is not a plain "filter the yearly table" query,
 * and getting that wrong makes a Q1 question answer from full-year data.
 * `Magento\Sales\Model\ResourceModel\Report\Bestsellers\Collection::_beforeLoad`
 * (read out of the container at
 * `vendor/magento/module-sales/Model/ResourceModel/Report/Bestsellers/Collection.php`)
 * splits the request into up to three SELECTs UNIONed together:
 *
 * - **boundary selects** for any partial period at either end of the range —
 *   these read the *daily* table, sum by product over the literal date range,
 *   and take the top 5 by quantity (no `rating_pos` involved);
 * - the **main select**, which reads the yearly/monthly table for the whole
 *   periods that remain, keeping only rows with `rating_pos <= 5`.
 *
 * The clause that catches everyone out: when From and To fall in the *same*
 * period, the main select is disabled entirely (`where('1<>1')`) and the whole
 * report comes from one boundary select. That is why `Period=Year`,
 * `1/1/22 – 3/31/22` returns Q1's 12 units on the source and not the year's 20.
 *
 * Ties are the one thing this cannot reproduce: the source's boundary select is
 * `ORDER BY qty DESC LIMIT 5` with no tie-break column, so MySQL returns an
 * arbitrary subset of the tied products — two runs of the identical query on the
 * live site during round 2 returned different rank-3/4/5 rows. We break ties by
 * ascending `product_id` so the mock is at least deterministic.
 */
function ymd(d) {
  return { y: d.getUTCFullYear(), m: d.getUTCMonth() + 1, d: d.getUTCDate() }
}

function utc(y, m, d) {
  return new Date(Date.UTC(y, m - 1, d))
}

/** Last day of the month `m` in year `y`. */
function lastDayOfMonth(y, m) {
  return new Date(Date.UTC(y, m, 0)).getUTCDate()
}

export const BESTSELLER_LIMIT = 5

/**
 * `Reports\Block\Adminhtml\Grid\AbstractGrid::_getStoreIds()` falls back to
 * `array_keys($storeManager->getStores())` when the scope switcher is on "All
 * Websites", and that list excludes the admin store — so these grids read
 * **store 1**, not store 0. For every other report the two store rows are exact
 * duplicates so it makes no difference, but the bestsellers tables carry a
 * per-store `rating_pos` whose tie order differs between them, and reading
 * store 0 produced a completely different set of products for a month whose
 * top 5 are all quantity 1. Verified: store 1, `2022-01`, `rating_pos <= 5` is
 * Cassia Funnel Sweatshirt-L-Orange / Cronus Yoga Pant-36-Red / Helios
 * EverCool™ Tee-M-Black / Thorpe Track Pant-33-Black / Sprite Stasis Ball
 * 55 cm — exactly what the live report renders.
 */
export function bestsellersRows(aggregates, periodType, from, to, storeId = 1, limit = BESTSELLER_LIMIT) {
  const daily = scopeRows(aggregates.bestsellers_daily || [], storeId)
  const main = scopeRows(aggregates[tableFor('bestsellers', periodType)] || [], storeId)

  const collect = (rows, label) => {
    const byProduct = new Map()
    for (const r of rows) {
      const hit = byProduct.get(r.product_id)
      if (hit) hit.qty_ordered += num(r.qty_ordered)
      else {
        byProduct.set(r.product_id, {
          __period: label(r), product_id: r.product_id, product_name: r.product_name,
          product_price: r.product_price, qty_ordered: num(r.qty_ordered),
        })
      }
    }
    return [...byProduct.values()]
  }

  // `_makeBoundarySelect`: daily table, literal range, group by product, top N.
  const boundarySelect = (bFrom, bTo) => {
    const rows = daily.filter(r => inRange(r.period, bFrom, bTo))
    const label = periodKey(isoDate(bFrom), periodType)
    return collect(rows, () => label)
      .sort((a, b) => b.qty_ordered - a.qty_ordered || a.product_id - b.product_id)
      .slice(0, limit)
  }

  const unions = []
  let mainFrom = from
  let mainTo = to
  let mainDisabled = false

  if (periodType === 'year') {
    if (from) {
      const f = ymd(from)
      if (f.m !== 1 || f.d !== 1) {
        const dtTo = utc(f.y, 12, 31)
        if (!to || dtTo < to) {
          unions.push(boundarySelect(from, dtTo))
          mainFrom = utc(f.y + 1, 1, 1)
        }
      }
    }
    if (to) {
      const t = ymd(to)
      if (t.m !== 12 || t.d !== 31) {
        const dtFrom = utc(t.y, 1, 1)
        if (!from || dtFrom > from) {
          unions.push(boundarySelect(dtFrom, to))
          mainTo = utc(t.y - 1, 12, 31)
        }
      }
    }
    if (from && to && ymd(from).y === ymd(to).y) {
      unions.push(boundarySelect(from, to))
      mainDisabled = true
    }
  } else if (periodType === 'month') {
    if (from) {
      const f = ymd(from)
      if (f.d !== 1) {
        const dtTo = utc(f.y, f.m, lastDayOfMonth(f.y, f.m))
        if (!to || dtTo < to) {
          unions.push(boundarySelect(from, dtTo))
          const nextMonth = utc(f.y, f.m, 1)
          nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1)
          mainFrom = nextMonth
        }
      }
    }
    if (to) {
      const t = ymd(to)
      if (t.d !== lastDayOfMonth(t.y, t.m)) {
        const dtFrom = utc(t.y, t.m, 1)
        if (!from || dtFrom > from) {
          unions.push(boundarySelect(dtFrom, to))
          const prevMonthEnd = utc(t.y, t.m, 1)
          prevMonthEnd.setUTCDate(0)
          mainTo = prevMonthEnd
        }
      }
    }
    if (from && to && ymd(from).y === ymd(to).y && ymd(from).m === ymd(to).m) {
      unions.push(boundarySelect(from, to))
      mainDisabled = true
    }
  }

  const out = []
  if (!mainDisabled) {
    const rows = main.filter(r => Number(r.rating_pos) <= limit && inRange(r.period, mainFrom, mainTo))
    const byPeriod = new Map()
    for (const r of rows) {
      const key = periodKey(r.period, periodType)
      if (!byPeriod.has(key)) byPeriod.set(key, [])
      byPeriod.get(key).push(r)
    }
    for (const [key, group] of byPeriod) out.push(...collect(group, () => key))
  }
  for (const u of unions) out.push(...u)

  // `order(['period ASC', 'qty_ordered DESC'])` over the UNION.
  return out.sort((a, b) => (
    a.__period < b.__period ? -1 : a.__period > b.__period ? 1
      : b.qty_ordered - a.qty_ordered || a.product_id - b.product_id
  ))
}

export const ORDER_STATUS_FILTER_OPTIONS = [
  { value: 'canceled', label: 'Canceled' },
  { value: 'closed', label: 'Closed' },
  { value: 'complete', label: 'Complete' },
  { value: 'fraud', label: 'Suspected Fraud' },
  { value: 'holded', label: 'On Hold' },
  { value: 'payment_review', label: 'Payment Review' },
  { value: 'paypal_canceled_reversal', label: 'PayPal Canceled Reversal' },
  { value: 'paypal_reversed', label: 'PayPal Reversed' },
  { value: 'processing', label: 'Processing' },
]

/**
 * Source semantics for the "Order Status" control, transcribed from the note
 * under the field: *"Applies to Any of the Specified Order Statuses except
 * canceled orders"*. Verified against the live report — Jan 2022 with "Any"
 * shows 11 orders / $1,591.89, which is the seed's totals with canceled
 * excluded (all statuses would give 17 / $2,229.09).
 *
 * That default is **not** universal. It comes from
 * `Reports\Block\Adminhtml\Sales\Sales\Grid::_prepareCollection`, which
 * pre-populates `order_statuses` with every non-canceled status when the filter
 * carries none; the collections themselves apply no status filter at all. The
 * Shipping Report has no such override, so "Any" there really does mean any —
 * 2022 reads 215 orders / $3,145.00 on the source, and only 116 of those are
 * non-canceled. Pass `excludeCanceled = false` for those reports.
 */
export function applyStatusFilter(rows, showOrderStatuses, statuses, excludeCanceled = true) {
  if (String(showOrderStatuses) === '1' && statuses && statuses.length) {
    const set = new Set(statuses)
    return rows.filter(r => set.has(r.order_status))
  }
  if (!excludeCanceled) return rows
  return rows.filter(r => r.order_status !== 'canceled')
}
