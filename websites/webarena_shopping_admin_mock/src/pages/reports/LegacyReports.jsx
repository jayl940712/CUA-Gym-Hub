import React, { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import LegacyAdminGrid from '../../components/grid/LegacyAdminGrid.jsx'
import { useApp } from '../../context/AppContext.jsx'
import * as S from '../../utils/staticData.js'
import { getReviews, getProducts, getOrders } from '../../utils/selectors.js'
import { formatCurrency, formatInt, decodeEntities } from '../../utils/formatters.js'
import { rowsToCsv, downloadFile } from '../../utils/gridUtils.js'
import { ReportScope } from '../../components/reports/ReportPage.jsx'
import LegacyGrid from '../../components/reports/LegacyGrid.jsx'
import DateInput from '../../components/reports/DateInput.jsx'
import { encodeFilter, decodeFilter, periodKey, periodLabel } from '../../components/reports/reportUtils.js'
import { formatReviewDateTime } from '../../components/reviews/reviewFormat.js'
import ratingVoteAggregates from '../../components/reports/ratingVoteAggregates.json'

/**
 * Reports > Products / Customers — Magento's *legacy* report grids.
 *
 * Their filter toolbar differs from the Sales reports: `report_period`
 * (Year/Month/Day) plus `report_from` / `report_to` in `M/D/YYYY`, and a
 * "Refresh" button rather than "Show Report". Ids are the source's verbatim
 * (`gridOrdersCustomer_period_date_from`, …).
 *
 * An interval with no rows renders an inline
 * "We can't find records for this period." cell rather than being dropped —
 * copied from the live grid.
 */

/* ---------------------------------------------------------- date utilities */

function parseLongDate(text) {
  const m = String(text || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (!m) return null
  let year = +m[3]
  if (year < 100) year += 2000
  return new Date(Date.UTC(year, +m[1] - 1, +m[2]))
}

function iso(d) {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`
}

function intervalsBetween(from, to, period) {
  if (!from || !to) return []
  const keys = []
  const cur = new Date(from.getTime())
  while (cur <= to && keys.length < 4000) {
    keys.push(periodKey(iso(cur), period))
    if (period === 'year') cur.setUTCFullYear(cur.getUTCFullYear() + 1)
    else if (period === 'month') cur.setUTCMonth(cur.getUTCMonth() + 1)
    else cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return [...new Set(keys)]
}

/* --------------------------------------------------- legacy filter toolbar */

/**
 * DIFF-R66. `Magento\Reports\Block\Adminhtml\Grid::_prepareCollection` (read out
 * of the container) fills in a missing date on the *decoded filter*, not on the
 * form:
 *
 *   if (!isset($data['report_from'])) { $date = new \DateTime('-1 month'); … }
 *   if (!isset($data['report_to']))   { $date = new \DateTime();           … }
 *
 * The toolbar omits an empty field from the query string, so `Show By = Year` +
 * Refresh with no range submits `report_period=year` alone and the report is
 * computed over **today−1 month … today** — which is why the source renders the
 * interval row `2026` (and `7/6/26 … 8/6/26` for Day, `07/2026 · 08/2026` for
 * Month) plus a `Total · 0`, where the mock rendered no interval label and a
 * Total over the whole table.
 *
 * Cold load — no `/filter/` segment at all — takes the other branch
 * (`_setFilterValues($this->_defaultFilter)`), leaves `report_from` empty and so
 * never calls `setInterval()`: no intervals, no totals. That is `applied:false`.
 */
/**
 * `IntlDateFormatter::SHORT` in `en_US` — `7/6/26`, which is what the source
 * writes back into the From/To fields (verified live).
 */
function shortDate(d) {
  return `${d.getMonth() + 1}/${d.getDate()}/${String(d.getFullYear()).slice(-2)}`
}

function defaultReportFrom() {
  const d = new Date()
  d.setMonth(d.getMonth() - 1)
  return shortDate(d)
}

function useLegacyFilter(defaults) {
  const params = useParams()
  return useMemo(() => {
    const decoded = decodeFilter(params.filter || params['*'])
    if (!decoded) return { applied: false, values: { ...defaults } }
    // `_setFilterValues($data)` runs *after* the defaults are filled in, so the
    // toolbar shows the resolved dates rather than staying blank.
    return {
      applied: true,
      values: {
        ...defaults,
        ...decoded,
        report_from: decoded.report_from || defaultReportFrom(),
        report_to: decoded.report_to || shortDate(new Date()),
      },
    }
  }, [params.filter, params['*'], defaults])
}

function LegacyFilterToolbar({ basePath, gridPrefix, values: initial }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState(initial)
  useEffect(() => { setValues(initial) }, [initial])

  function refresh() {
    const sid = new URLSearchParams(location.search).get('sid')
    navigate({
      pathname: `${basePath}/filter/${encodeFilter(values)}/`,
      search: sid ? `?sid=${encodeURIComponent(sid)}` : '',
    })
  }

  return (
    <div className="page-actions floating-header" data-ui-id="page-actions-toolbar-content-header">
      <div className="filter-actions field-row">
        <label className="admin__control-support-text" htmlFor={`${gridPrefix}_report_period`}>Period:</label>
        <select id={`${gridPrefix}_report_period`} name="report_period" className="admin__control-select"
          value={values.report_period} onChange={e => setValues(v => ({ ...v, report_period: e.target.value }))}>
          <option value="day">Day</option>
          <option value="month">Month</option>
          <option value="year">Year</option>
        </select>
        <label className="admin__control-support-text" htmlFor={`${gridPrefix}_period_date_from`}>From:</label>
        {/* DIFF-R52 — the source's legacy report toolbar carries a
          * `button.ui-datepicker-trigger` beside each date field. */}
        <DateInput name="report_from" id={`${gridPrefix}_period_date_from`}
          className="admin__control-text input-text input-date"
          value={values.report_from} onChange={v => setValues(p2 => ({ ...p2, report_from: v }))} />
        <label className="admin__control-support-text" htmlFor={`${gridPrefix}_period_date_to`}>To:</label>
        <DateInput name="report_to" id={`${gridPrefix}_period_date_to`}
          className="admin__control-text input-text input-date"
          value={values.report_to} onChange={v => setValues(p2 => ({ ...p2, report_to: v }))} />
        {/* F-07 — source `data-ui-id` on the interval reports' Refresh button. */}
        <button type="button" className="action-default scalable"
          data-ui-id="adminhtml-report-grid-refresh-button"
          onClick={refresh}><span>Refresh</span></button>
      </div>
    </div>
  )
}

/**
 * Interval-grouped static table with the legacy empty-interval row and the
 * `<tfoot class="totals">` summary.
 */
function IntervalGrid({ gridId, columns, groups, period, totals, exportPaths = null }) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const choices = exportPaths ? [
    { value: `${origin}${exportPaths.csv}`, label: 'CSV', format: 'csv' },
    { value: `${origin}${exportPaths.xml}`, label: 'Excel XML', format: 'xml' },
  ] : []
  const [exportValue, setExportValue] = useState(choices.length ? choices[0].value : '')

  /* F-05. The Export block runs over the rendered rows, interval column
   * included, so the file matches what the grid shows. */
  function doExport() {
    const chosen = choices.find(o => o.value === exportValue) || choices[0]
    const flat = []
    for (const g of groups) {
      const label = periodLabel(g.key, period)
      if (!g.rows.length) flat.push([label, ...columns.slice(1).map(() => '')])
      for (const row of g.rows) {
        flat.push([label, ...columns.slice(1).map(c => {
          const v = c.money ? formatCurrency(row[c.id]) : row[c.id]
          return v == null ? '' : String(v)
        })])
      }
    }
    const cols = columns.map((c, i) => ({ label: c.label, exportValue: r => r[i] }))
    if (chosen?.format === 'xml') {
      const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const head = `  <Row>\n${cols.map(c => `    <Cell><Data ss:Type="String">${esc(c.label)}</Data></Cell>`).join('\n')}\n  </Row>`
      const body = flat.map(r => `  <Row>\n${cols.map(c => `    <Cell><Data ss:Type="String">${esc(c.exportValue(r))}</Data></Cell>`).join('\n')}\n  </Row>`).join('\n')
      downloadFile(`${gridId}.xml`,
        `<?xml version="1.0"?>\n<Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n<Worksheet ss:Name="${gridId}">\n<Table>\n${head}\n${body}\n</Table>\n</Worksheet>\n</Workbook>`,
        'application/vnd.ms-excel')
    } else {
      downloadFile(`${gridId}.csv`, rowsToCsv(cols, flat), 'text/csv')
    }
  }

  return (
    <div className="admin__data-grid-outer-wrap" data-grid-id={gridId}>
      {/* F-05 — the source ships an `Export to:` block on all four interval
        * report grids, and the mock shipped none. Measured live, one cold
        * context per route (`div.admin__data-grid-export` outerHTML):
        *   report_customer/accounts  gridAccounts_export
        *     …/reports/report_customer/exportAccountsCsv|exportAccountsExcel/
        *   report_customer/totals    gridTotalsCustomer_export
        *     …/reports/report_customer/exportTotalsCsv|exportTotalsExcel/
        *   report_product/sold       gridProductsSold_export
        *     …/reports/report_product/exportSoldCsv|exportSoldExcel/
        *   report_customer/orders    gridOrdersCustomer_export
        *     …/reports/report_customer/exportOrdersCsv|exportOrdersExcel/
        * As with F-04 the option VALUES are the export controller's absolute
        * URL, not `csv`/`xml`, so `select_option(sel, 'csv')` raises on both
        * sides. The button is `class="action-default scalable task"` with
        * `title="Export"` and `data-ui-id="widget-button-0"`. */}
      {exportPaths ? (
        <div className="admin__data-grid-header admin__data-grid-toolbar">
          <div className="admin__data-grid-header-row">
            <div className="admin__data-grid-export">
              <label htmlFor={`${gridId}_export`} className="admin__control-support-text">Export to:</label>
              <select name={`${gridId}_export`} id={`${gridId}_export`} className="admin__control-select"
                value={exportValue} onChange={e => setExportValue(e.target.value)}>
                {choices.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button title="Export" type="button" className="action-default scalable task"
                data-ui-id="widget-button-0" onClick={doExport}><span>Export</span></button>
            </div>
          </div>
        </div>
      ) : null}
      {/* DIFF-R53. These four legacy report grids render NO "N records found"
        * line on the source — verified live: the only
        * `.admin__control-support-text` nodes on
        * `/admin/reports/report_product/sold/` and `report_customer/*` are
        * `From:`, `To:`, `Show By:` and `Export to:`. The mock used to print
        * `0 records found`, which no source page there ever shows. */}
      <div className="admin__data-grid-wrap admin__data-grid-wrap-static">
        <table className="data-grid" id={`${gridId}_table`}>
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.id} className={`data-grid-th col-${c.id} no-link`}><span>{c.label}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.length === 0 ? (
              <tr className="data-grid-tr-no-data even">
                <td className="empty-text" colSpan={columns.length}>We can&#39;t find records for this period.</td>
              </tr>
            ) : groups.map((g, gi) => (
              g.rows.length === 0 ? (
                <tr key={g.key} className={gi % 2 === 0 ? 'even' : ''} data-role="row">
                  <td className="col-period">{periodLabel(g.key, period)}</td>
                  <td className="col-no-records empty-text last" colSpan={columns.length - 1}>
                    We can&#39;t find records for this period.
                  </td>
                </tr>
              ) : g.rows.map((row, ri) => (
                <tr key={`${g.key}-${ri}`} data-role="row" className={ri % 2 === 0 ? 'even' : ''}>
                  {ri === 0 ? (
                    <td rowSpan={g.rows.length} className="col-period">{periodLabel(g.key, period)}</td>
                  ) : null}
                  {columns.slice(1).map(c => (
                    <td key={c.id} className={`col-${c.id}${c.numeric ? ' col-number' : c.money ? ' a-right' : ''}`}>
                      {c.render ? c.render(row) : c.money ? formatCurrency(row[c.id]) : row[c.id]}
                    </td>
                  ))}
                </tr>
              ))
            ))}
          </tbody>
          {/* DIFF-R15: the source prints the Total row *below* the interval
            * rows. `<tfoot>` has to follow `<tbody>` in the DOM for that — a
            * `<tfoot>` placed before it renders above the body here. */}
          {totals ? (
            <tfoot>
              <tr className="totals">
                {/* MySQL's AVG()/SUM() over an empty group is NULL, which the
                  * source prints as a blank cell: with `Show By = Year` and no
                  * date range the Order Count/Total footers read
                  * `Total · · 0 · ·`, not `… · $0.00 · $0.00` (DIFF-R66). */}
                {columns.map((c, i) => (
                  <th key={c.id} className={`col-${c.id}${c.numeric ? ' col-number' : c.money ? ' a-right' : ''}`}>
                    {i === 0 ? 'Total' : totals[c.id] !== undefined && totals[c.id] !== null
                      ? (c.money ? formatCurrency(totals[c.id]) : formatInt(totals[c.id])) : ''}
                  </th>
                ))}
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}

function LegacyReportShell({ title, basePath, gridPrefix, values, children }) {
  return (
    <PageShell title={title}>
      <ReportScope />
      <LegacyFilterToolbar basePath={basePath} gridPrefix={gridPrefix} values={values} />
      <div id="page:main-container" className="page-columns">
        <div className="admin__old"><div id="container" className="main-col">{children}</div></div>
      </div>
    </PageShell>
  )
}

// DIFF-R35 — the four legacy report grids (`gridProductsSold`, `gridOrdersCustomer`,
// `gridTotalsCustomer`, `gridAccounts`) all cold-load `report_period` on "day" on the
// source, matching the sales reports' `sales_report_period_type`. Verified live on all
// four routes.
const LEGACY_DEFAULTS = { report_period: 'day', report_from: '', report_to: '' }

/* ---------------------------------------------- customer order aggregation
 *
 * Magento's expression, read out of the container at
 * `module-reports/Model/ResourceModel/Order/Collection.php`
 * (`getTotalsExpressionWithDiscountRefunded`, store scope 0):
 *
 *   (base_subtotal - base_subtotal_refunded - base_subtotal_canceled
 *      - (|base_discount_amount| - |base_discount_refunded| - |base_discount_canceled|))
 *   * base_to_global_rate
 *
 * with `customer_id IS NOT NULL`, `state <> 'canceled'`, grouped by customer_id.
 *
 * Mapping onto the seed:
 *   base_to_global_rate      is 1 on every order in this dataset
 *   base_subtotal_canceled   is NULL on every order in this dataset
 *   |base_discount_amount|   = (subtotal + tax + shipping) - grand_total
 *   base_subtotal_refunded   = SUM(credit memo subtotal) for the order
 *
 * Verified row-for-row against the live report for Year 1/1/22–12/31/22 (36
 * customer rows + Total 116 / $118.07 / $13,695.82). The previous
 * `grand_total - shipping_and_handling` shorthand agreed on every order that
 * carries no tax and no refund, but printed $34.64 for Veronica Costello where
 * the source prints $0.00 — order 2 is fully refunded (base_subtotal 32,
 * base_subtotal_refunded 32).
 */
function orderReportAmount(order, refundedSubtotal) {
  const subtotal = Number(order.subtotal) || 0
  const tax = Number(order.tax_amount) || 0
  const shipping = Number(order.shipping_amount) || 0
  const grand = Number(order.grand_total) || 0
  // Discounts are stored on the order only as the delta the grand total carries.
  const discount = Math.abs(Math.round((grand - (subtotal + tax + shipping)) * 10000) / 10000)
  return subtotal - refundedSubtotal - discount
}

/** SUM(base_subtotal_refunded) per order, from the session's credit memos. */
function refundedSubtotalByOrder(state) {
  const m = new Map()
  for (const cm of state?.creditMemos || []) {
    const key = String(cm.order_id)
    m.set(key, (m.get(key) || 0) + (Number(cm.subtotal) || 0))
  }
  return m
}

function customerOrderRows(state, period, from, to) {
  const refunds = refundedSubtotalByOrder(state)
  const byInterval = new Map()
  for (const o of getOrders(state)) {
    if (o.state === 'canceled' || o.status === 'canceled') continue
    if (o.customer_id === null || o.customer_id === undefined) continue
    const day = String(o.created_at).slice(0, 10)
    if (from && day < iso(from)) continue
    if (to && day > iso(to)) continue
    const key = periodKey(day, period)
    if (!byInterval.has(key)) byInterval.set(key, new Map())
    const bucket = byInterval.get(key)
    const cid = String(o.customer_id)
    const name = `${o.customer_firstname || ''} ${o.customer_lastname || ''}`.trim()
    const hit = bucket.get(cid) || { customer_id: Number(cid), name, orders_count: 0, sum: 0 }
    hit.orders_count += 1
    hit.sum += orderReportAmount(o, refunds.get(String(o.entity_id)) || 0)
    bucket.set(cid, hit)
  }
  return byInterval
}

function buildGroups(byInterval, intervals, mapRows) {
  return intervals.map(key => ({ key, rows: mapRows(byInterval.get(key) || new Map(), key) }))
}

const CUSTOMER_COLUMNS = [
  { id: 'period', label: 'Interval' },
  { id: 'name', label: 'Customer' },
  { id: 'orders_count', label: 'Orders', numeric: true },
  { id: 'orders_avg_amount', label: 'Average', money: true },
  { id: 'orders_sum_amount', label: 'Total', money: true },
]

function CustomerOrdersLike({ title, basePath, gridPrefix, sortBy, exportPaths }) {
  const { state } = useApp()
  const { applied, values } = useLegacyFilter(LEGACY_DEFAULTS)
  const from = parseLongDate(values.report_from)
  const to = parseLongDate(values.report_to)

  const { groups, totals } = useMemo(() => {
    if (!applied) return { groups: [], totals: null }
    const intervals = intervalsBetween(from, to, values.report_period)
    const byInterval = customerOrderRows(state, values.report_period, from, to)
    const g = buildGroups(byInterval, intervals, bucket =>
      [...bucket.values()]
        .map(r => ({
          customer_id: r.customer_id,
          name: r.name,
          orders_count: r.orders_count,
          orders_avg_amount: r.sum / r.orders_count,
          orders_sum_amount: r.sum,
        }))
        .sort(sortBy))
    /* DIFF-R13. The source renders a `<tfoot class="totals">` row on both
     * customer reports — `Total · · 116 · $118.07 · $13,695.82` for
     * Year 1/1/22–12/31/22. Magento reloads the same collection with
     * `isTotals()`, i.e. COUNT/AVG/SUM over every order in the window rather
     * than over the per-customer rows, so Average is total ÷ order count, not
     * the mean of the customers' averages. */
    let count = 0
    let sum = 0
    for (const group of g) {
      for (const row of group.rows) {
        count += row.orders_count
        sum += row.orders_sum_amount
      }
    }
    return {
      groups: g,
      totals: {
        orders_count: count,
        // NULL, not 0, when the window holds no orders — see IntervalGrid.
        orders_avg_amount: count ? sum / count : null,
        orders_sum_amount: count ? sum : null,
      },
    }
  }, [applied, state, values.report_period, values.report_from, values.report_to])

  return (
    <LegacyReportShell title={title} basePath={basePath} gridPrefix={gridPrefix} values={values}>
      <IntervalGrid gridId={gridPrefix} columns={CUSTOMER_COLUMNS} groups={groups}
        period={values.report_period} totals={totals} exportPaths={exportPaths} />
    </LegacyReportShell>
  )
}

export function OrderCountReport() {
  /* DIFF-R26. Magento's Orders collection sorts `orders_count DESC` and leaves
   * the tie to the GROUP BY's own `customer_id` order — and unlike Bestsellers
   * or Ordered Products this report is stable on the source (3 back-to-back
   * loads returned the identical sequence). Year 1/1/22–12/31/22 the source
   * gives `Jane Smith 8`, then the `Orders = 5` tie as
   * `John Smith (2) · Jane Doe (3) · Bob Johnson (7) · Matt Baker (13) ·
   *  Grace Nguyen (18) · Lucy Garcia (19) · Ava Brown (21) · Adam Garcia (33)`
   * — customer-id ascending, not Total desc. */
  return <CustomerOrdersLike
    title="Order Count Report"
    basePath="/admin/reports/report_customer/orders"
    gridPrefix="gridOrdersCustomer"
    exportPaths={{
      csv: '/admin/reports/report_customer/exportOrdersCsv/',
      xml: '/admin/reports/report_customer/exportOrdersExcel/',
    }}
    sortBy={(a, b) => b.orders_count - a.orders_count || a.customer_id - b.customer_id} />
}

export function OrderTotalReport() {
  return <CustomerOrdersLike
    title="Order Total Report"
    basePath="/admin/reports/report_customer/totals"
    gridPrefix="gridTotalsCustomer"
    exportPaths={{
      csv: '/admin/reports/report_customer/exportTotalsCsv/',
      xml: '/admin/reports/report_customer/exportTotalsExcel/',
    }}
    sortBy={(a, b) => b.orders_sum_amount - a.orders_sum_amount} />
}

/* ------------------------------------------------- New Accounts Report (93) */

export function NewAccountsReport() {
  const { state } = useApp()
  const { applied, values } = useLegacyFilter(LEGACY_DEFAULTS)
  const from = parseLongDate(values.report_from)
  const to = parseLongDate(values.report_to)

  const { groups, totals } = useMemo(() => {
    if (!applied) return { groups: [], totals: null }
    const intervals = intervalsBetween(from, to, values.report_period)
    const counts = new Map()
    for (const c of state?.customers || []) {
      const day = String(c.created_at).slice(0, 10)
      if (from && day < iso(from)) continue
      if (to && day > iso(to)) continue
      const key = periodKey(day, values.report_period)
      counts.set(key, (counts.get(key) || 0) + 1)
    }
    const g = intervals.map(key => ({
      key,
      rows: counts.has(key) ? [{ accounts: counts.get(key) }] : [],
    }))
    // The source's New Accounts footer prints `Total · 0` for an empty window —
    // COUNT() is 0, not NULL — so this one stays numeric.
    return { groups: g, totals: { accounts: [...counts.values()].reduce((a, b) => a + b, 0) } }
  }, [applied, state, values.report_period, values.report_from, values.report_to])

  const columns = [
    { id: 'period', label: 'Interval' },
    { id: 'accounts', label: 'New Accounts', numeric: true },
  ]

  return (
    <LegacyReportShell title="New Accounts Report" basePath="/admin/reports/report_customer/accounts"
      gridPrefix="gridAccounts" values={values}>
      <IntervalGrid gridId="gridAccounts" columns={columns} groups={groups}
        period={values.report_period} totals={applied ? totals : null}
        exportPaths={{
          csv: '/admin/reports/report_customer/exportAccountsCsv/',
          xml: '/admin/reports/report_customer/exportAccountsExcel/',
        }} />
    </LegacyReportShell>
  )
}

/* --------------------------------------------- Ordered Products Report (87) */

/**
 * DIFF-R12. Magento's collection
 * (`module-reports/Model/ResourceModel/Product/Sold/Collection::addOrderedQty`,
 * read out of the container) is
 *
 *   FROM sales_order_item JOIN sales_order ON state <> 'canceled' AND created_at BETWEEN …
 *   WHERE parent_item_id IS NULL  GROUP BY sku  HAVING SUM(qty_ordered) > 0
 *
 * The `parent_item_id IS NULL` clause is the one the mock was missing. Every
 * configurable line in the seed is stored twice — the parent row and its simple
 * child row carry the **same sku and the same qty_ordered** — so summing both
 * doubled the quantity of every configurable product. That, not the date
 * filter, is why 2022 showed ~28 products at 4 instead of the source's long
 * tail at 2 (`Ana Running Short WSH10-29-White`: source 2, mock 4; order 22 has
 * items 102 (parent) and 103 (child), both qty 1).
 */
export function OrderedProductsReport() {
  const { applied, values } = useLegacyFilter(LEGACY_DEFAULTS)
  const from = parseLongDate(values.report_from)
  const to = parseLongDate(values.report_to)

  const groups = useMemo(() => {
    if (!applied) return []
    const intervals = intervalsBetween(from, to, values.report_period)
    const byInterval = new Map()
    for (const order of S.orders) {
      if (order.state === 'canceled' || order.status === 'canceled') continue
      const day = String(order.created_at).slice(0, 10)
      if (from && day < iso(from)) continue
      if (to && day > iso(to)) continue
      const key = periodKey(day, values.report_period)
      if (!byInterval.has(key)) byInterval.set(key, new Map())
      const bucket = byInterval.get(key)
      for (const item of order.items || []) {
        // parent_item_id IS NULL — skip the simple child row of a configurable.
        if (item.parent_item_id !== null && item.parent_item_id !== undefined) continue
        const hit = bucket.get(item.sku) || { name: decodeEntities(item.name), sku: item.sku, ordered_qty: 0 }
        hit.ordered_qty += Number(item.qty_ordered) || 0
        bucket.set(item.sku, hit)
      }
    }
    return intervals.map(key => ({
      key,
      // HAVING SUM(qty_ordered) > 0. The source has no secondary sort — its tie
      // order is MySQL's group order and is not stable between page loads — so
      // the mock keeps a deterministic name sort within a quantity.
      rows: [...(byInterval.get(key) || new Map()).values()]
        .filter(r => r.ordered_qty > 0)
        .sort((a, b) => b.ordered_qty - a.ordered_qty || a.name.localeCompare(b.name)),
    }))
  }, [applied, values.report_period, values.report_from, values.report_to])

  /* DIFF-R65. The source closes this grid with `<tfoot class="totals">`
   * `Total · · · <SUM(qty_ordered)>` — `510` for Year 1/1/2022–12/31/2023, `0`
   * for Year with no range. `getCountTotals()` sums the same collection the
   * body renders, so summing the interval rows reproduces it exactly. */
  const totals = useMemo(() => {
    if (!applied) return null
    let qty = 0
    for (const g of groups) for (const r of g.rows) qty += r.ordered_qty
    return { ordered_qty: qty }
  }, [applied, groups])

  const columns = [
    { id: 'period', label: 'Interval' },
    { id: 'name', label: 'Product' },
    { id: 'sku', label: 'SKU' },
    { id: 'ordered_qty', label: 'Ordered Quantity', numeric: true },
  ]

  return (
    <LegacyReportShell title="Ordered Products Report" basePath="/admin/reports/report_product/sold"
      gridPrefix="gridProductsSold" values={values}>
      <IntervalGrid gridId="gridProductsSold" columns={columns} groups={groups}
        period={values.report_period} totals={totals}
        exportPaths={{
          csv: '/admin/reports/report_product/exportSoldCsv/',
          xml: '/admin/reports/report_product/exportSoldExcel/',
        }} />
    </LegacyReportShell>
  )
}

/* -------------------------------------------------- Low Stock Report (88) */

/**
 * The source's Low Stock report is EMPTY on this deployment ("0 records found",
 * re-verified live in round 2). It is MSI's grid, not the old CatalogInventory
 * one, and `InventoryLowQuantityNotification`'s `LowQuantityCollection` applies
 * two conditions the mock was missing (read out of the container at
 * `vendor/magento/module-inventory-low-quantity-notification/Model/ResourceModel/LowQuantityCollection.php`):
 *
 *   addSourceItemInStockFilter : `quantity > 0 AND status = 1`
 *   addNotifyStockQtyFilter    : `quantity < notify_stock_qty`   (strict)
 *
 * Every product in this dataset sits at `notify_stock_qty = 1`, so a row would
 * have to have `0 < qty < 1` to qualify and none does. Without the `qty > 0`
 * clause the mock listed two out-of-stock products (MH05, MP12-33-Blue) that
 * the source never shows. Product quantities are answered from
 * Catalog > Products, not from here.
 */
export function LowStockReport() {
  const { state } = useApp()
  const rows = useMemo(() => {
    const products = getProducts(state)
    const out = []
    for (const p of products) {
      const stock = S.stockItemByProductId.get(String(p.entity_id))
      if (!stock) continue
      const qty = Number(stock.qty)
      // addSourceItemInStockFilter: quantity > 0 AND status = In Stock
      if (!(qty > 0) || Number(stock.is_in_stock) !== 1) continue
      const notify = Number(stock.notify_stock_qty)
      if (!Number.isFinite(notify) || notify <= 0) continue
      // addNotifyStockQtyFilter: quantity < notify_stock_qty (strict)
      if (!(qty < notify)) continue
      out.push({ entity_id: p.entity_id, name: p.name, sku: p.sku, qty, sourceCode: 'default' })
    }
    return out
  }, [state])

  /* DIFF-R60. The source renders this as a LEGACY grid, not a UI-component one:
   * an in-`<thead>` filter row (text `name`, text `sku`, `qty[from]`/`qty[to]`,
   * a `sourceCode` select whose only option is `default`), `Search` +
   * `Reset Filter`, and `Export to: [CSV|Excel XML]`. Column classes and every
   * `name`/`id` below are transcribed from
   * `assets/html/reports-product-lowstock.html`. All four headers carry
   * `no-link` there — none of them is sortable, so the mock must not paint a
   * sort arrow on Quantity either. */
  const columns = [
    { id: 'name', label: 'Product', className: 'col-product', filter: 'text', sortable: false },
    { id: 'sku', label: 'SKU', className: 'col-sku', filter: 'text', sortable: false },
    { id: 'qty', label: 'Quantity', className: 'col-qty', filter: 'range', numeric: true, sortable: false },
    {
      id: 'sourceCode', label: 'Source Code', className: 'col-source-code', filter: 'select', sortable: false,
      options: [{ value: 'default', label: 'default' }],
    },
  ]

  return (
    <PageShell title="Low Stock Report">
      <ReportScope />
      {/* F-04 — the source's `Export to:` options carry the export controller's
          absolute URL as their `value`, not `csv`/`xml`; F-07 — its three
          buttons are `widget-button-0/1/2` (Export / Reset Filter / Search). */}
      <LegacyGrid gridId="gridLowstock" basePath="/admin/reports/report_product/lowstock"
        rows={rows} columns={columns} rowKey={r => r.entity_id} exportFileName="lowstock"
        exportPaths={{
          csv: '/admin/InventoryLowQuantityNotification/report/exportLowstockCsv/',
          xml: '/admin/InventoryLowQuantityNotification/report/exportLowstockExcel/',
        }}
        widgetButtonIds={{ export: 'widget-button-0', reset: 'widget-button-1', search: 'widget-button-2' }} />
    </PageShell>
  )
}

/* ------------------------------------------------- Downloads Report (90) */

export function DownloadsReport() {
  /* DIFF-R59 residual / legacy-vs-modern classification. `downloadsGrid` is a
   * LEGACY grid on the source, measured live at
   * `/admin/reports/report_product/downloads/`:
   *   thead row 1  Product · Link · SKU · Purchases · Downloads   (5 cols)
   *   thead row 2  [name] [link_title] [sku] (empty) (empty)
   * — Purchases and Downloads render NO filter control at all, and the grid has
   * the `Export to:` block plus `Search` / `Reset Filter`. `0 records found`
   * (the seed has no downloadable products, which is the source's state too).
   * Cell classes are the source's own `col-product col-name`, `col-qty
   * col-downloads`, … */
  const columns = [
    { id: 'name', label: 'Product', className: 'col-product col-name', filter: 'text' },
    { id: 'link', label: 'Link', className: 'col-link col-link_title', filter: 'text', filterId: 'link_title' },
    { id: 'sku', label: 'SKU', className: 'col-sku', filter: 'text' },
    { id: 'purchases', label: 'Purchases', className: 'col-purchases', filter: 'none', numeric: true },
    { id: 'downloads', label: 'Downloads', className: 'col-qty col-downloads', filter: 'none', numeric: true },
  ]
  return (
    <PageShell title="Downloads Report">
      <ReportScope />
      <LegacyGrid gridId="downloadsGrid" basePath="/admin/reports/report_product/downloads"
        rows={[]} columns={columns} rowKey={r => r.sku} exportFileName="downloads"
        exportPaths={{
          csv: '/admin/reports/report_product/exportDownloadsCsv/',
          xml: '/admin/reports/report_product/exportDownloadsExcel/',
        }}
        widgetButtonIds={{ export: 'widget-button-0', reset: 'widget-button-1', search: 'widget-button-2' }} />
    </PageShell>
  )
}

/* ------------------------------------------- Review reports (94, 95, 96) */

export function CustomerReviewsReport() {
  const { state } = useApp()
  const rows = useMemo(() => {
    const counts = new Map()
    for (const r of getReviews(state)) {
      if (!r.customer_id) continue
      const key = String(r.customer_id)
      const hit = counts.get(key) || { customer_id: r.customer_id, customer_name: r.nickname, review_cnt: 0 }
      hit.review_cnt += 1
      counts.set(key, hit)
    }
    // Prefer the real customer record's name over the review nickname.
    for (const hit of counts.values()) {
      const c = (state?.customers || []).find(x => String(x.entity_id) === String(hit.customer_id))
      if (c) hit.customer_name = c.name
    }
    return [...counts.values()]
  }, [state])

  /* Legacy-vs-modern classification. `customers_grid` is a LEGACY grid on the
   * source, measured live at `/admin/reports/report_review/customer/`:
   *   thead row 1  Customer · Reviews · Action        (3 cols, `_descend` on
   *                                                    `col-qty col-review_cnt`)
   *   thead row 2  [customer_name] [review_cnt] (empty under Action)
   *   `Export to:` block + `Search` / `Reset Filter`, `1 records found`
   * The row carries `title=".../review/product/index/customerId/70/"` and the
   * Action cell holds the same href. */
  const columns = [
    {
      id: 'customer_name', label: 'Customer', className: 'col-name col-customer_name',
      filter: 'text', searchValue: r => r.customer_name,
    },
    { id: 'review_cnt', label: 'Reviews', className: 'col-qty col-review_cnt', filter: 'text', numeric: true },
    {
      id: 'action', label: 'Action', className: 'col-actions col-action', sortable: false, filter: 'none',
      render: r => (
        <AdminLink to={`/admin/review/product/index/customerId/${r.customer_id}/`}>Show Reviews</AdminLink>
      ),
      exportValue: () => 'Show Reviews',
    },
  ]

  return (
    <PageShell title="Customer Reviews Report">
      <ReportScope />
      <LegacyGrid gridId="customers_grid" basePath="/admin/reports/report_review/customer"
        rows={rows} columns={columns} rowKey={r => r.customer_id}
        rowHref={r => `/admin/review/product/index/customerId/${r.customer_id}/`}
        defaultSort="review_cnt" defaultDir="desc" exportFileName="customer_reviews"
        exportPaths={{
          csv: '/admin/reports/report_review/exportCustomerCsv/',
          xml: '/admin/reports/report_review/exportCustomerExcel/',
        }}
        widgetButtonIds={{ export: 'widget-button-0', reset: 'widget-button-1', search: 'widget-button-2' }} />
    </PageShell>
  )
}

/**
 * `avg_rating` / `avg_rating_approved` come out of the pre-aggregated
 * `rating_option_vote_aggregated` table, NOT from re-averaging the individual
 * reviews. `Magento\Reports\Model\ResourceModel\Review\Product\Collection::_joinReview()`
 * computes `SUM(table_rating.percent)/COUNT(table_rating.rating_id)` (and the
 * `percent_approved` twin) over that table's rows for the product, joined on
 * `store_id > 0`. `percent` is stored already rounded to an integer, which is
 * why the source shows `67.0000` for product 4 where averaging the three raw
 * star votes gives `66.6667`.
 */
const REVIEW_AGGREGATES_BY_PRODUCT = (() => {
  const byProduct = new Map()
  for (const r of ratingVoteAggregates.rows) {
    if (Number(r.store_id) <= 0) continue
    const key = String(r.entity_pk_value)
    const hit = byProduct.get(key) || { count: 0, percent: 0, percentApproved: 0 }
    hit.count += 1
    hit.percent += Number(r.percent || 0)
    hit.percentApproved += Number(r.percent_approved || 0)
    byProduct.set(key, hit)
  }
  return byProduct
})()

export function ProductReviewsReport() {
  const { state } = useApp()
  return <ProductReviewsReportBody state={state} />
}

function ProductReviewsReportBody({ state }) {
  const rows = useMemo(() => {
    const byProduct = new Map()
    for (const r of getReviews(state)) {
      const key = String(r.entity_pk_value)
      const hit = byProduct.get(key) || {
        entity_id: r.entity_pk_value, name: r.product_name, review_cnt: 0,
        created_at: r.created_at,
      }
      hit.review_cnt += 1
      if (String(r.created_at) > String(hit.created_at)) hit.created_at = r.created_at
      byProduct.set(key, hit)
    }
    // COUNT(table_rating.rating_id) = 0 makes MySQL's division NULL, which the
    // source renders as an empty cell.
    return [...byProduct.values()].map(h => {
      const agg = REVIEW_AGGREGATES_BY_PRODUCT.get(String(h.entity_id))
      return {
        ...h,
        avg_rating: agg ? agg.percent / agg.count : null,
        avg_rating_approved: agg ? agg.percentApproved / agg.count : null,
      }
    })
  }, [state])

  const fmtRating = v => (v === null || v === undefined ? '' : Number(v).toFixed(4))
  /* Legacy-vs-modern classification. `gridProducts` is a LEGACY grid on the
   * source, measured live at `/admin/reports/report_review/product/`:
   *   thead row 1  ID · Product · Reviews · Average · Average (Approved) ·
   *                Last Review · Action     (7 cols, `_descend` on
   *                `col-qty col-review_cnt`)
   *   thead row 2  [entity_id] [name] [review_cnt] [avg_rating]
   *                [avg_rating_approved] [created_at[from]] [created_at[to]]
   *                + a hidden `created_at[locale]`, then an empty Action cell
   *   `Export to:` block + `Search` / `Reset Filter`, `127 records found`
   * Show Reviews points at `/admin/review/product/index/productId/<id>/` on the
   * source — the `report_review/product/detail/id/<id>/` URL the mock used to
   * link is a route the source reaches only from elsewhere. */
  const columns = [
    { id: 'entity_id', label: 'ID', className: 'col-id col-entity_id', filter: 'text', numeric: true },
    { id: 'name', label: 'Product', className: 'col-product col-name', filter: 'text', searchValue: r => r.name },
    { id: 'review_cnt', label: 'Reviews', className: 'col-qty col-review_cnt', filter: 'text', numeric: true },
    {
      id: 'avg_rating', label: 'Average', className: 'col-rating col-avg_rating',
      filter: 'text', numeric: true, render: r => fmtRating(r.avg_rating),
    },
    {
      id: 'avg_rating_approved', label: 'Average (Approved)', className: 'col-avg-rating col-avg_rating_approved',
      filter: 'text', numeric: true, render: r => fmtRating(r.avg_rating_approved),
    },
    // DIFF-R68 — the source prints `Apr 19, 2023, 12:15:17 PM` here.
    {
      id: 'created_at', label: 'Last Review', className: 'col-date col-created_at',
      filter: 'daterange', render: r => formatReviewDateTime(r.created_at),
    },
    {
      id: 'action', label: 'Action', className: 'col-actions col-action', sortable: false, filter: 'none',
      cellClassName: 'a-center',
      render: r => (
        <AdminLink to={`/admin/review/product/index/productId/${r.entity_id}/`}>Show Reviews</AdminLink>
      ),
      exportValue: () => 'Show Reviews',
    },
  ]

  return (
    <PageShell title="Product Reviews Report">
      <ReportScope />
      <LegacyGrid gridId="gridProducts" basePath="/admin/reports/report_review/product"
        rows={rows} columns={columns} rowKey={r => r.entity_id}
        rowHref={r => `/admin/review/product/index/productId/${r.entity_id}/`}
        defaultSort="review_cnt" defaultDir="desc" exportFileName="product_reviews"
        exportPaths={{
          csv: '/admin/reports/report_review/exportProductCsv/',
          xml: '/admin/reports/report_review/exportProductExcel/',
        }}
        widgetButtonIds={{ export: 'widget-button-0', reset: 'widget-button-1', search: 'widget-button-2' }} />
    </PageShell>
  )
}

/**
 * DIFF-R70 — `/reports/report_review/product/detail/id/:id/`.
 *
 * `Magento\Reports\Controller\Adminhtml\Report\Review\Detail` renders the same
 * `Reports\Block\Adminhtml\Review\Detail` layout the index action does, and the
 * grid it contains is the product-level one: the source serves **the Product
 * Reviews Report** from this URL — `h1` "Product Reviews Report", headers
 * `ID · Product · Reviews · Average · Average (Approved) · Last Review · Action`
 * and `127 records found` — for every id (checked `id/1` and `id/39`). The `id`
 * segment scopes the *per-review* drill-down the block never reaches.
 *
 * The mock used to render a per-review list here (7 different columns, 4 rows on
 * `id/39`), so an evaluator reading the 4th cell of row 1 saw a review title
 * where the source shows a review count. The per-product review list still has a
 * real home at `/admin/review/product/index/productId/<id>/`, which is the URL
 * the source itself uses for it.
 */
export function ProductReviewsDetail() {
  const { state } = useApp()
  return <ProductReviewsReportBody state={state} />
}

/* ------------------------------------------- Shopping cart reports (97, 98) */

export function ProductsInCartsReport() {
  /* Round 10. LEGACY on the source, and one of the three legacy grids there
   * that render NO filter row at all — the source's only toolbar controls are
   * `Export to:` + `Export` and the pager, with the records count in
   * `.admin__control-support-text`. Grid id `gridProducts`. */
  const columns = [
    { id: 'entity_id', label: 'ID', filterType: null },
    { id: 'name', label: 'Product', filterType: null },
    { id: 'price', label: 'Price', filterType: null, numeric: true },
    { id: 'carts', label: 'Carts', filterType: null, numeric: true },
    { id: 'orders', label: 'Orders', filterType: null, numeric: true },
  ]
  return (
    <PageShell title="Products in Carts">
      {/* DIFF-R102 sweep — every one of the five `<th>` here is `no-link` on the
        * source (no `data-sort` at all); the mock made all five `_sortable`, so
        * it advertised five sort URLs the source does not serve. */}
      <LegacyAdminGrid gridId="gridProducts" basePath="/admin/reports/report_shopcart/product"
        rows={[]} columns={columns} rowKey={r => r.entity_id}
        sortableColumns={false}
        exportable exportFileName="products_in_carts"
        exportPaths={{
          csv: '/admin/reports/report_shopcart/exportProductCsv/',
          xml: '/admin/reports/report_shopcart/exportProductExcel/',
        }} />
    </PageShell>
  )
}

/* DIFF-R57. Nine columns, not five, and the grid id is `gridAbandoned` — every
 * header, column class and filter `name` below is transcribed from
 * `assets/html/reports-shopcart-abandoned.html`. The mock previously showed
 * `Number of Items` for `items_count`, dropped Products/Quantity/Created/
 * Updated/IP Address entirely, and mislabelled `created_at` as
 * `Applied Rule IDs`. Every header carries `no-link` on the source, so nothing
 * here is sortable. The grid is empty on this deployment (`colspan="9"`,
 * `We couldn't find any records.`) — that part was already right. */
export function AbandonedCartsReport() {
  const columns = [
    { id: 'customer_name', label: 'Customer', className: 'col-name', filter: 'text', sortable: false },
    { id: 'email', label: 'Email', className: 'col-email', filter: 'text', sortable: false },
    { id: 'items_count', label: 'Products', className: 'col-number', filter: 'range', numeric: true, sortable: false },
    { id: 'items_qty', label: 'Quantity', className: 'col-qty', filter: 'range', numeric: true, sortable: false },
    { id: 'subtotal', label: 'Subtotal', className: 'col-subtotal', filter: 'range', numeric: true, sortable: false },
    { id: 'coupon_code', label: 'Applied Coupon', className: 'col-coupon', filter: 'text', sortable: false },
    { id: 'created_at', label: 'Created', className: 'col-created', filter: 'daterange', sortable: false },
    { id: 'updated_at', label: 'Updated', className: 'col-updated', filter: 'daterange', sortable: false },
    { id: 'remote_ip', label: 'IP Address', className: 'col-ip', filter: 'text', sortable: false },
  ]
  return (
    <PageShell title="Abandoned Carts">
      {/* F-07 — the source renders the scope switcher (`#store-change-button`,
          label `All Websites`) above this grid; the mock omitted it. */}
      <ReportScope />
      <LegacyGrid gridId="gridAbandoned" basePath="/admin/reports/report_shopcart/abandoned"
        rows={[]} columns={columns} rowKey={r => r.email} exportFileName="abandoned_carts"
        exportPaths={{
          csv: '/admin/reports/report_shopcart/exportAbandonedCsv/',
          xml: '/admin/reports/report_shopcart/exportAbandonedExcel/',
        }}
        widgetButtonIds={{ export: 'widget-button-0', reset: 'widget-button-3', search: 'widget-button-4' }} />
    </PageShell>
  )
}

/* --------------------------------------------- Refresh Statistics (99) */

/* DIFF-R17. Columns are `Report · Description · Updated` on the source — the
 * Description column was missing here, and the Most Viewed row printed the
 * literal string `undefined`. Descriptions and the Most Viewed timestamp are
 * copied verbatim off the live grid; the other seven rows share the seed's
 * frozen `Jun 17, 2023, 12:00:03 AM` snapshot (the live host's own cron keeps
 * moving those, so they are not a fixed target to match). */
const STATISTICS = [
  { code: 'sales', label: 'Orders', description: 'Total Ordered Report', updated_at: 'Jun 17, 2023, 12:00:03 AM' },
  { code: 'tax', label: 'Tax', description: 'Order Taxes Report Grouped by Tax Rates', updated_at: 'Jun 17, 2023, 12:00:03 AM' },
  { code: 'shipping', label: 'Shipping', description: 'Total Shipped Report', updated_at: 'Jun 17, 2023, 12:00:03 AM' },
  { code: 'invoiced', label: 'Total Invoiced', description: 'Total Invoiced VS Paid Report', updated_at: 'Jun 17, 2023, 12:00:03 AM' },
  { code: 'refunded', label: 'Total Refunded', description: 'Total Refunded Report', updated_at: 'Jun 17, 2023, 12:00:03 AM' },
  { code: 'coupons', label: 'Coupons', description: 'Promotion Coupons Usage Report', updated_at: 'Jun 17, 2023, 12:00:03 AM' },
  { code: 'bestsellers', label: 'Bestsellers', description: 'Products Bestsellers Report', updated_at: 'Jun 17, 2023, 12:00:03 AM' },
  { code: 'viewed', label: 'Most Viewed', description: 'Most Viewed Products Report', updated_at: 'Jun 10, 2023, 10:05:19 PM' },
]

/**
 * PIPELINE-016 — both mass actions used to print `Statistics updated for N
 * report(s).` and change nothing at all, which is a false success: the
 * evaluator sees an empty `state_diff` while the agent has been told the job
 * ran. The source's refresh stamps `report_updated_at` on each selected report
 * and the grid's Updated At column moves, so the mock now writes that stamp
 * into `state.systemConfig.report_statistics` and renders the grid from it.
 *
 * The aggregate tables themselves are *not* recomputed — they are frozen seed —
 * so this records the refresh without pretending the numbers changed.
 */
export function RefreshStatistics() {
  const { state, setState, addMessage } = useApp()
  const stamps = state?.systemConfig?.report_statistics || {}

  const rows = STATISTICS.map(s => ({ ...s, updated_at: stamps[s.code] ?? s.updated_at }))

  function refresh(ids) {
    /* The source stamps `Aug 6, 2026, 12:00:01 AM` — a comma between the date
     * and the time, which is also the shape of every literal in STATISTICS
     * above (re-verified live this round). `formatDateTime()` drops that comma
     * app-wide and must keep doing so for the order/customer grids, so this
     * grid uses the review-width variant. */
    const now = formatReviewDateTime(new Date().toISOString())
    setState(prev => {
      const cfg = prev.systemConfig || {}
      const next = { ...(cfg.report_statistics || {}) }
      for (const id of ids) next[id] = now
      return { ...prev, systemConfig: { ...cfg, report_statistics: next } }
    })
    addMessage(`Statistics updated for ${ids.length} report(s).`)
  }

  /* DIFF-R56. The source renders this as a LEGACY grid, not a UI-component one.
   * Verified live on `/admin/reports/report_statistics/`:
   *   DIV#gridRefreshStatistics · SELECT#gridRefreshStatistics_massaction-select
   *   (Actions / Refresh Lifetime Statistics / Refresh Statistics for the Last Day)
   *   · a `Submit` button · SELECT#gridRefreshStatistics_massaction-mass-select
   *   · SPAN#gridRefreshStatistics-total-count "8 records found"
   *   · TABLE#gridRefreshStatistics_table with ONE `<thead>` row
   *     `<th data-column="massaction">&nbsp;</th>` + `Report · Description · Updated`
   *   · NO filter row, NO `Export to:`, NO `select[name=limit]` and no pager
   * Row checkboxes carry `name="code"` and the report code as their value
   * (`value="sales"`). Column ids are the source's `data-column` values
   * (`report`, `comment`, `updated_at`), which is why Description is `comment`. */
  const columns = [
    { id: 'report', label: 'Report', className: 'col-report', sortable: false, value: r => r.label },
    { id: 'comment', label: 'Description', className: 'col-description', sortable: false, value: r => r.description },
    { id: 'updated_at', label: 'Updated', className: 'col-period', sortable: false },
  ]
  const massActions = [
    { id: 'refresh_lifetime', label: 'Refresh Lifetime Statistics', onApply: refresh },
    { id: 'refresh_recent', label: 'Refresh Statistics for the Last Day', onApply: refresh },
  ]
  return (
    <PageShell title="Refresh Statistics">
      <LegacyGrid gridId="gridRefreshStatistics" basePath="/admin/reports/report_statistics"
        rows={rows} columns={columns} rowKey={r => r.code} rowSelectValue={r => r.code}
        rowSelectName="code" massActions={massActions} exportable={false} pager={false}
        /* `refresh_recent` carries Magento's `selected` flag here — the
           source's `#gridRefreshStatistics_massaction-select` reads
           `refresh_recent` (selectedIndex 2) on cold load. */
        massActionDefault="refresh_recent"
        widgetButtonIds={{ submit: 'widget-button-2' }} />
    </PageShell>
  )
}

/* --------------------------------------------- Advanced Reporting (100) */

export function AdvancedReporting() {
  return (
    /* DIFF-R55 — the source's h1 on this route is `Reports menu`; "Advanced
       Reporting" is the panel heading inside it, not the page title. */
    <PageShell title="Reports menu">
      <div className="analytics-placeholder">
        <h2>Advanced Reporting</h2>
        <p>
          Gain new insights and make data-driven decisions with a suite of dynamic reports.
          Advanced Reporting is a cloud-based service that requires no additional installation.
        </p>
        <p>
          <a href="https://magento.com/products/business-intelligence/essentials" target="_blank" rel="noreferrer">
            Go to Advanced Reporting
          </a>
        </p>
      </div>
    </PageShell>
  )
}
