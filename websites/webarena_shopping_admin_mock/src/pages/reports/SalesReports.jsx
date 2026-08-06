import React, { useMemo } from 'react'
import PageShell from '../../components/layout/PageShell.jsx'
import * as S from '../../utils/staticData.js'
import { formatCurrency, formatInt, decodeEntities } from '../../utils/formatters.js'
import {
  ReportFilterForm, ReportGrid, ReportNotices, ReportScope, useReportFilter,
} from '../../components/reports/ReportPage.jsx'
import {
  aggregateByPeriod, totalsOf, scopeRows, inRange, parseShortDate,
  applyStatusFilter, bestsellersRows, tableFor,
} from '../../components/reports/reportUtils.js'
import orderAggregates from '../../components/reports/reportAggregatesOrder.json'
import bestsellerAggregates from '../../components/reports/bestsellersAggregates.json'
import orderActualColumns from '../../components/reports/reportOrderActualColumns.json'

/**
 * Reports > Sales — every one of these reads a pre-aggregated `report_*` table
 * out of the seed, which is the same table the source's SQL reads. Nothing is
 * per-task hardcoded: change the From/To/Period controls and the numbers move.
 *
 * Magento keeps *two* aggregate tables per report: `sales_<x>_aggregated`, keyed
 * by the shipment/invoice/credit-memo date, and `sales_<x>_aggregated_order`,
 * keyed by the **order** date. The "Date Used" select picks between them and its
 * default is `created_at_order`, so the `_order` tables are what these reports
 * show out of the box. `src/data/reportAggregates.json` only carried the first
 * kind, which is why Shipping and Invoice rendered empty and Refunds put the
 * credit memo in 2023. `reportAggregatesOrder.json` (extracted from the same
 * container, verbatim) carries the second kind.
 */

/** "Date Used" options, per report, verbatim from the source's own selects. */
const DATE_USED = {
  sales: [['created_at_order', 'Order Created'], ['updated_at_order', 'Order Updated']],
  invoiced: [['created_at_order', 'Order Created'], ['created_at_invoice', 'Last Invoice Created Date']],
  shipping: [['created_at_order', 'Order Created'], ['created_at_shipment', 'First Invoice Created Date']],
  refunded: [['created_at_order', 'Order Created'], ['created_at_refunded', 'Last Credit Memo Created Date']],
}

const SALES_DEFAULTS = {
  report_type: 'created_at_order',
  // DOM-005 — every source report page cold-loads `sales_report_period_type` on
  // "day", not "month". Verified on sales/bestsellers/viewed/tax/invoiced/coupons.
  period_type: 'day',
  from: '',
  to: '',
  show_order_statuses: '0',
  order_statuses: [],
  show_empty_rows: '0',
  show_actual_columns: '0',
}

function useRange(values) {
  return useMemo(() => ({
    from: parseShortDate(values.from),
    to: parseShortDate(values.to),
  }), [values.from, values.to])
}

/** Shared frame: scope switcher, notices, filter form, then the grid. */
function SalesReportShell({ title, basePath, fields, values, reportTypeOptions, submitUiId, children }) {
  return (
    <PageShell title={title}>
      <ReportScope />
      <ReportNotices />
      <ReportFilterForm basePath={basePath} fields={fields} values={values}
        reportTypeOptions={reportTypeOptions} submitUiId={submitUiId} />
      <div id="page:main-container" className="page-columns">
        <div className="admin__old">
          <div id="container" className="main-col">{children}</div>
        </div>
      </div>
    </PageShell>
  )
}

/* ------------------------------------------------------- Orders Report (80) */

const SALES_COLUMNS = [
  { id: 'period', label: 'Interval' },
  { id: 'orders_count', label: 'Orders', numeric: true },
  { id: 'total_qty_ordered', label: 'Sales Items', numeric: true },
  { id: 'total_income_amount', label: 'Sales Total', money: true },
  { id: 'total_invoiced_amount', label: 'Invoiced', money: true },
  { id: 'total_refunded_amount', label: 'Refunded', money: true },
  { id: 'total_tax_amount', label: 'Sales Tax', money: true },
  { id: 'total_shipping_amount', label: 'Sales Shipping', money: true },
  { id: 'total_discount_amount', label: 'Sales Discount', money: true },
  { id: 'total_canceled_amount', label: 'Canceled', money: true },
]

/**
 * "Show Actual Values" = Yes widens the Orders Report to 17 columns: each
 * aggregate column is followed by its "actual" twin. Column order and labels
 * transcribed from the live grid at
 * `/admin/reports/report_sales/sales/filter/<show_actual_columns=1>/`:
 *
 *   Interval · Orders · Sales Items · Items · Sales Total · Revenue · Profit ·
 *   Invoiced · Paid · Refunded · Sales Tax · Tax · Sales Shipping · Shipping ·
 *   Sales Discount · Discount · Canceled
 */
const SALES_COLUMNS_ACTUAL = [
  { id: 'period', label: 'Interval' },
  { id: 'orders_count', label: 'Orders', numeric: true },
  { id: 'total_qty_ordered', label: 'Sales Items', numeric: true },
  { id: 'total_qty_invoiced', label: 'Items', numeric: true },
  { id: 'total_income_amount', label: 'Sales Total', money: true },
  { id: 'total_revenue_amount', label: 'Revenue', money: true },
  { id: 'total_profit_amount', label: 'Profit', money: true },
  { id: 'total_invoiced_amount', label: 'Invoiced', money: true },
  { id: 'total_paid_amount', label: 'Paid', money: true },
  { id: 'total_refunded_amount', label: 'Refunded', money: true },
  { id: 'total_tax_amount', label: 'Sales Tax', money: true },
  { id: 'total_tax_amount_actual', label: 'Tax', money: true },
  { id: 'total_shipping_amount', label: 'Sales Shipping', money: true },
  { id: 'total_shipping_amount_actual', label: 'Shipping', money: true },
  { id: 'total_discount_amount', label: 'Sales Discount', money: true },
  { id: 'total_discount_amount_actual', label: 'Discount', money: true },
  { id: 'total_canceled_amount', label: 'Canceled', money: true },
]

const ACTUAL_FIELDS = [
  'total_tax_amount_actual', 'total_shipping_amount_actual', 'total_discount_amount_actual',
]

const ACTUAL_BY_KEY = new Map(
  orderActualColumns.rows.map(r => [`${r.period}|${r.store_id}|${r.order_status}`, r]),
)

/**
 * The `*_actual` columns were dropped when `reportAggregates.json` was curated.
 * `reportOrderActualColumns.json` carries the two rows of the source table that
 * are non-zero in them; every other row is 0.0000 on all three (see that file's
 * `_completeness`), so defaulting to 0 reproduces the table exactly.
 */
function withActualColumns(rows) {
  return rows.map(r => {
    const hit = ACTUAL_BY_KEY.get(`${r.period}|${r.store_id}|${r.order_status}`)
    const out = { ...r }
    for (const f of ACTUAL_FIELDS) out[f] = hit ? hit[f] : 0
    return out
  })
}

export function OrdersReport() {
  const { applied, values } = useReportFilter(SALES_DEFAULTS)
  const range = useRange(values)
  const fields = Object.keys(SALES_DEFAULTS)
  const columns = values.show_actual_columns === '1' ? SALES_COLUMNS_ACTUAL : SALES_COLUMNS

  const { rows, totals } = useMemo(() => {
    if (!applied) return { rows: [], totals: null }
    const measures = columns.slice(1).map(c => c.id)
    let src = scopeRows(S.reportAggregates.orders_aggregated_created || [])
      .filter(r => inRange(r.period, range.from, range.to))
    src = applyStatusFilter(src, values.show_order_statuses, values.order_statuses)
    if (values.show_actual_columns === '1') src = withActualColumns(src)
    const out = aggregateByPeriod(src, values.period_type, measures)
    return { rows: out, totals: totalsOf(out, measures) }
  }, [applied, values, range, columns])

  return (
    <SalesReportShell title="Orders Report" basePath="/admin/reports/report_sales/sales" fields={fields} values={values}
      reportTypeOptions={DATE_USED.sales}>
      <ReportGrid gridId="salesReportGrid" columns={columns} rows={rows}
        totals={applied ? totals : null} periodType={values.period_type} exportFileName="sales" />
    </SalesReportShell>
  )
}

/* ---------------------------------------------------------- Tax Report (81) */

const TAX_COLUMNS = [
  { id: 'period', label: 'Interval' },
  { id: 'code', label: 'Tax' },
  { id: 'percent', label: 'Rate', text: r => Number(r.percent).toFixed(2) },
  { id: 'orders_count', label: 'Orders', numeric: true },
  { id: 'tax_base_amount_sum', label: 'Tax Amount', money: true },
]

export function TaxReport() {
  const defaults = { ...SALES_DEFAULTS, show_actual_columns: undefined }
  const fields = ['report_type', 'period_type', 'from', 'to', 'show_order_statuses', 'order_statuses', 'show_empty_rows']
  const { applied, values } = useReportFilter(defaults)
  const range = useRange(values)

  const { rows, totals } = useMemo(() => {
    if (!applied) return { rows: [], totals: null }
    let src = scopeRows(S.reportAggregates.tax_aggregated || [])
      .filter(r => inRange(r.period, range.from, range.to))
    src = applyStatusFilter(src, values.show_order_statuses, values.order_statuses)
    const out = aggregateByPeriod(src, values.period_type, ['orders_count', 'tax_base_amount_sum'],
      r => `${r.code}|${r.percent}`, ['code', 'percent'])
    /* DIFF-R74. The source's Tax `Total` row leaves the **Orders** cell blank
       and totals only the tax amount: `Total · · · (blank) · $2.64`. Magento's
       tax report grid declares no total on `orders_count`, so summing it here
       printed a `1` the source never shows. */
    const totals = totalsOf(out, ['tax_base_amount_sum'])
    return { rows: out, totals }
  }, [applied, values, range])

  return (
    <SalesReportShell title="Tax Report" basePath="/admin/reports/report_sales/tax" fields={fields} values={values}>
      <ReportGrid gridId="taxReportGrid" columns={TAX_COLUMNS} rows={rows}
        totals={applied ? totals : null} periodType={values.period_type} exportFileName="tax" />
    </SalesReportShell>
  )
}

/* ------------------------------------------------------ Invoice Report (82) */

const INVOICED_COLUMNS = [
  { id: 'period', label: 'Interval' },
  { id: 'orders_count', label: 'Orders', numeric: true },
  { id: 'orders_invoiced', label: 'Invoiced Orders', numeric: true },
  { id: 'invoiced', label: 'Total Invoiced', money: true },
  { id: 'invoiced_captured', label: 'Paid Invoices', money: true },
  { id: 'invoiced_not_captured', label: 'Unpaid Invoices', money: true },
]

export function InvoicedReport() {
  const fields = ['report_type', 'period_type', 'from', 'to', 'show_order_statuses', 'order_statuses', 'show_empty_rows']
  const { applied, values } = useReportFilter(SALES_DEFAULTS)
  const range = useRange(values)

  const { rows, totals } = useMemo(() => {
    if (!applied) return { rows: [], totals: null }
    const measures = INVOICED_COLUMNS.slice(1).map(c => c.id)
    const table = values.report_type === 'created_at_invoice'
      ? S.reportAggregates.invoiced_aggregated
      : orderAggregates.invoiced_aggregated_order
    let src = scopeRows(table || [])
      .filter(r => inRange(r.period, range.from, range.to))
    src = applyStatusFilter(src, values.show_order_statuses, values.order_statuses)
    const out = aggregateByPeriod(src, values.period_type, measures)
    return { rows: out, totals: totalsOf(out, measures) }
  }, [applied, values, range])

  return (
    <SalesReportShell title="Invoice Report" basePath="/admin/reports/report_sales/invoiced" fields={fields} values={values}
      reportTypeOptions={DATE_USED.invoiced}>
      <ReportGrid gridId="invoicedReportGrid" columns={INVOICED_COLUMNS} rows={rows}
        totals={applied ? totals : null} periodType={values.period_type} exportFileName="invoiced" />
    </SalesReportShell>
  )
}

/* ----------------------------------------------------- Shipping Report (83) */

const SHIPPING_COLUMNS = [
  { id: 'period', label: 'Interval' },
  { id: 'shipping_description', label: 'Carrier/Method' },
  { id: 'orders_count', label: 'Orders', numeric: true },
  { id: 'total_shipping', label: 'Total Sales Shipping', money: true },
  { id: 'total_shipping_actual', label: 'Total Shipping', money: true },
]

export function ShippingReport() {
  const fields = ['report_type', 'period_type', 'from', 'to', 'show_order_statuses', 'order_statuses', 'show_empty_rows']
  const { applied, values } = useReportFilter(SALES_DEFAULTS)
  const range = useRange(values)

  const { rows, totals } = useMemo(() => {
    if (!applied) return { rows: [], totals: null }
    const measures = ['orders_count', 'total_shipping', 'total_shipping_actual']
    const table = values.report_type === 'created_at_shipment'
      ? S.reportAggregates.shipping_aggregated
      : orderAggregates.shipping_aggregated_order
    let src = scopeRows(table || [])
      .filter(r => inRange(r.period, range.from, range.to))
    // No canceled-status default on this report — see applyStatusFilter.
    src = applyStatusFilter(src, values.show_order_statuses, values.order_statuses, false)
    const out = aggregateByPeriod(src, values.period_type, measures,
      r => r.shipping_description, ['shipping_description'])
    return { rows: out, totals: totalsOf(out, measures) }
  }, [applied, values, range])

  return (
    <SalesReportShell title="Shipping Report" basePath="/admin/reports/report_sales/shipping" fields={fields} values={values}
      reportTypeOptions={DATE_USED.shipping}>
      <ReportGrid gridId="shippingReportGrid" columns={SHIPPING_COLUMNS} rows={rows}
        totals={applied ? totals : null} periodType={values.period_type} exportFileName="shipping" />
    </SalesReportShell>
  )
}

/* ------------------------------------------------------ Refunds Report (84) */

const REFUNDED_COLUMNS = [
  { id: 'period', label: 'Interval' },
  { id: 'orders_count', label: 'Refunded Orders', numeric: true },
  { id: 'refunded', label: 'Total Refunded', money: true },
  { id: 'online_refunded', label: 'Online Refunds', money: true },
  { id: 'offline_refunded', label: 'Offline Refunds', money: true },
]

export function RefundedReport() {
  const fields = ['report_type', 'period_type', 'from', 'to', 'show_order_statuses', 'order_statuses', 'show_empty_rows']
  const { applied, values } = useReportFilter(SALES_DEFAULTS)
  const range = useRange(values)

  const { rows, totals } = useMemo(() => {
    if (!applied) return { rows: [], totals: null }
    const measures = ['orders_count', 'refunded', 'online_refunded', 'offline_refunded']
    const table = values.report_type === 'created_at_refunded'
      ? S.reportAggregates.refunded_aggregated
      : orderAggregates.refunded_aggregated_order
    let src = scopeRows(table || [])
      .filter(r => inRange(r.period, range.from, range.to))
    src = applyStatusFilter(src, values.show_order_statuses, values.order_statuses)
    const out = aggregateByPeriod(src, values.period_type, measures)
    return { rows: out, totals: totalsOf(out, measures) }
  }, [applied, values, range])

  return (
    <SalesReportShell title="Refunds Report" basePath="/admin/reports/report_sales/refunded" fields={fields} values={values}
      reportTypeOptions={DATE_USED.refunded}>
      <ReportGrid gridId="refundedReportGrid" columns={REFUNDED_COLUMNS} rows={rows}
        totals={applied ? totals : null} periodType={values.period_type} exportFileName="refunded" />
    </SalesReportShell>
  )
}

/* ------------------------------------------------------ Coupons Report (85) */

const COUPON_COLUMNS = [
  { id: 'period', label: 'Interval' },
  { id: 'coupon_code', label: 'Coupon Code' },
  { id: 'rule_name', label: 'Price Rule' },
  { id: 'coupon_uses', label: 'Uses', numeric: true },
  { id: 'subtotal_amount', label: 'Sales Subtotal', money: true },
  { id: 'discount_amount', label: 'Sales Discount', money: true },
  { id: 'total_amount', label: 'Sales Total', money: true },
  { id: 'subtotal_amount_actual', label: 'Subtotal', money: true },
  { id: 'discount_amount_actual', label: 'Discount', money: true },
  { id: 'total_amount_actual', label: 'Total', money: true },
]

/**
 * DIFF-R62 — `getUniqRulesNamesList()`: DISTINCT non-empty `rule_name` from the
 * coupon *report* aggregate table, sorted ascending. See the note on the
 * multiselect in `components/reports/ReportPage.jsx`.
 */
const COUPON_RULE_NAMES = [...new Set(
  (S.reportAggregates.coupons_aggregated || [])
    .map(r => r.rule_name)
    .filter(n => n !== null && n !== undefined && n !== ''),
)].sort((a, b) => String(a).localeCompare(String(b)))

export function CouponsReport() {
  const defaults = useMemo(() => ({
    ...SALES_DEFAULTS,
    price_rule_type: '0',
    rules_list: [],
    __rules: COUPON_RULE_NAMES,
  }), [])
  const fields = ['report_type', 'period_type', 'from', 'to', 'show_order_statuses', 'order_statuses',
    'show_empty_rows', 'price_rule_type', 'rules_list']
  const { applied, values } = useReportFilter(defaults)
  const range = useRange(values)

  const { rows, totals } = useMemo(() => {
    if (!applied) return { rows: [], totals: null }
    const measures = COUPON_COLUMNS.slice(3).map(c => c.id)
    let src = scopeRows(S.reportAggregates.coupons_aggregated || [])
      .filter(r => inRange(r.period, range.from, range.to))
    if (String(values.price_rule_type) === '1' && values.rules_list?.length) {
      // The submitted values are indexes into COUPON_RULE_NAMES; the grid
      // filters on `rule_name`, which is what the source's `IN(?)` compares.
      const set = new Set(values.rules_list.map(i => COUPON_RULE_NAMES[Number(i)]))
      src = src.filter(r => set.has(r.rule_name))
    }
    const out = aggregateByPeriod(src, values.period_type, measures,
      r => r.coupon_code, ['coupon_code', 'rule_name'])
    return { rows: out, totals: totalsOf(out, measures) }
  }, [applied, values, range])

  return (
    <SalesReportShell title="Coupons Report" basePath="/admin/reports/report_sales/coupons" fields={fields} values={values}>
      <ReportGrid gridId="couponsReportGrid" columns={COUPON_COLUMNS} rows={rows}
        totals={applied ? totals : null} periodType={values.period_type} exportFileName="coupons" />
    </SalesReportShell>
  )
}

/* -------------------------------------------------- Bestsellers Report (86) */

const BESTSELLER_COLUMNS = [
  { id: 'period', label: 'Interval' },
  { id: 'product_name', label: 'Product', text: r => decodeEntities(r.product_name) },
  { id: 'product_price', label: 'Price', money: true },
  { id: 'qty_ordered', label: 'Order Quantity', numeric: true },
]

export function BestsellersReport() {
  const defaults = { period_type: 'day', from: '', to: '', show_empty_rows: '0' }
  const fields = ['period_type', 'from', 'to', 'show_empty_rows']
  const { applied, values } = useReportFilter(defaults)
  const range = useRange(values)

  const { rows, totals } = useMemo(() => {
    if (!applied) return { rows: [], totals: null }
    // See `bestsellersRows` — the source's boundary-select/union algorithm, so a
    // partial period (Q1 2022 with Period=Year) is constrained by the literal
    // From/To instead of returning the whole calendar year.
    // `bestsellersAggregates.json` re-extracts the three bestsellers tables from
    // the container. Magento reassigns `rating_pos` from scratch on every
    // statistics refresh, and with a month whose top 5 are all quantity 1 the
    // positions land on entirely different products; the copy in
    // `reportAggregates.json` predates the current refresh, so 1/2022 listed
    // five products the source does not show. Quantities are identical in both.
    const out = bestsellersRows(bestsellerAggregates, values.period_type, range.from, range.to)
    return { rows: out, totals: totalsOf(out, ['qty_ordered']) }
  }, [applied, values, range])

  return (
    <SalesReportShell title="Bestsellers Report" basePath="/admin/reports/report_sales/bestsellers" fields={fields} values={values}>
      <ReportGrid gridId="bestsellersReportGrid" columns={BESTSELLER_COLUMNS} rows={rows}
        totals={applied ? totals : null} periodType={values.period_type} exportFileName="bestsellers" />
    </SalesReportShell>
  )
}

/* ------------------------------------------------ Product Views Report (89) */

const VIEWED_COLUMNS = [
  { id: 'period', label: 'Interval' },
  { id: 'product_name', label: 'Product', text: r => decodeEntities(r.product_name) },
  { id: 'product_price', label: 'Price', money: true },
  { id: 'views_num', label: 'Views', numeric: true },
]

export function ProductViewsReport() {
  const defaults = { period_type: 'day', from: '', to: '', show_empty_rows: '0' }
  const fields = ['period_type', 'from', 'to', 'show_empty_rows']
  const { applied, values } = useReportFilter(defaults)
  const range = useRange(values)

  const { rows, totals } = useMemo(() => {
    if (!applied) return { rows: [], totals: null }
    const table = S.reportAggregates[tableFor('viewed', values.period_type)] || []
    const src = scopeRows(table).filter(r => inRange(r.period, range.from, range.to))
    const out = aggregateByPeriod(src, values.period_type, ['views_num'],
      r => r.product_id, ['product_id', 'product_name', 'product_price'])
      .sort((a, b) => (a.__period < b.__period ? -1 : a.__period > b.__period ? 1 : b.views_num - a.views_num))
    return { rows: out, totals: totalsOf(out, ['views_num']) }
  }, [applied, values, range])

  return (
    <SalesReportShell title="Product Views Report" basePath="/admin/reports/report_product/viewed" fields={fields} values={values}
      submitUiId="product-report-grid-container-filter-form-submit-button">
      <ReportGrid gridId="viewedReportGrid" columns={VIEWED_COLUMNS} rows={rows}
        totals={applied ? totals : null} periodType={values.period_type} exportFileName="viewed" />
    </SalesReportShell>
  )
}

export { formatCurrency, formatInt }
