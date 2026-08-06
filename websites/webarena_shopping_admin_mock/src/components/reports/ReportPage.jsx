import React, { useMemo, useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import DateInput from './DateInput.jsx'
import PageShell from '../layout/PageShell.jsx'
import AdminLink from '../layout/AdminLink.jsx'
import { formatCurrency, formatInt } from '../../utils/formatters.js'
import { rowsToCsv, downloadFile } from '../../utils/gridUtils.js'
import {
  encodeFilter, decodeFilter, periodLabel, ORDER_STATUS_FILTER_OPTIONS,
} from './reportUtils.js'

/* ===========================================================================
 * The "Filter" fieldset shared by every Reports > Sales / Products report.
 *
 * Field ids are the source's verbatim (`sales_report_from`, `sales_report_to`,
 * `sales_report_period_type`, …) because tasks 704-713 assert on
 * `document.querySelector('[id="sales_report_from"]').value`.
 * ======================================================================== */

const PERIOD_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'month', label: 'Month' },
  { value: 'year', label: 'Year' },
]

function Field({ label, htmlFor, note, children, className = '' }) {
  return (
    <div className={`admin__field field ${className}`.trim()}>
      <label className="label admin__field-label" htmlFor={htmlFor}><span>{label}</span></label>
      <div className="admin__field-control control">
        {children}
        {note ? <div className="note admin__field-note">{note}</div> : null}
      </div>
    </div>
  )
}

/**
 * Reads the report filter out of the URL. The source posts the form to
 * `<path>/filter/<base64 querystring>/`; a plain `?from=…&to=…` is accepted too
 * so an agent can deep-link. `applied` is false on a bare page load, which is
 * what makes the source show an empty grid before "Show Report" is pressed.
 */
export function useReportFilter(defaults) {
  const params = useParams()
  const [searchParams] = useSearchParams()

  return useMemo(() => {
    const fromPath = decodeFilter(params.filter || params['*'])
    let values = fromPath
    if (!values) {
      const q = {}
      for (const key of Object.keys(defaults)) {
        if (searchParams.has(key)) q[key] = searchParams.get(key)
      }
      const multi = searchParams.getAll('order_statuses[]')
      if (multi.length) q.order_statuses = multi
      values = Object.keys(q).length ? q : null
    }
    return {
      applied: !!values && !!(values.from || values.to),
      values: { ...defaults, ...(values || {}) },
    }
  }, [params.filter, params['*'], searchParams, defaults])
}

/**
 * The filter form + Show Report button. `fields` names which controls this
 * report shows — Magento renders a different subset per report.
 */
/**
 * "Date Used" options differ per report — Invoice offers *Last Invoice Created
 * Date*, Shipping *First Invoice Created Date*, Refunds *Last Credit Memo
 * Created Date* — and each one selects a different aggregate table. Read off
 * the live source's own `#sales_report_report_type` selects.
 */
const DEFAULT_REPORT_TYPE_OPTIONS = [
  ['created_at_order', 'Order Created'],
  ['updated_at_order', 'Order Updated'],
]

/* F-07. The Show Report button's `data-ui-id` is per report family, measured
 * live: `/reports/report_sales/*` →
 * `sales-report-grid-container-filter-form-submit-button`,
 * `/reports/report_product/viewed/` →
 * `product-report-grid-container-filter-form-submit-button`. */
export function ReportFilterForm({
  basePath, fields, values: initial, reportTypeOptions,
  submitUiId = 'sales-report-grid-container-filter-form-submit-button',
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const [values, setValues] = useState(initial)

  useEffect(() => { setValues(initial) }, [initial])

  const has = name => fields.includes(name)
  const set = (k, v) => setValues(prev => ({ ...prev, [k]: v }))

  function showReport() {
    const payload = {}
    for (const f of fields) payload[f] = values[f]
    const sid = new URLSearchParams(location.search).get('sid')
    navigate({
      pathname: `${basePath}/filter/${encodeFilter(payload)}/`,
      search: sid ? `?sid=${encodeURIComponent(sid)}` : '',
    })
  }

  return (
    <>
      <div className="page-actions floating-header" data-ui-id="page-actions-toolbar-content-header">
        <button
          id="filter_form_submit"
          title="Show Report"
          data-ui-id={submitUiId}
          type="button"
          className="action-default scalable primary"
          onClick={showReport}
        >
          <span>Show Report</span>
        </button>
      </div>

      <div className="reports-content">
        <div className="entry-edit form-inline">
          <form id="filter_form" onSubmit={e => { e.preventDefault(); showReport() }}>
            <fieldset className="fieldset admin__fieldset" id="sales_report_base_fieldset">
              <legend className="admin__legend legend"><span>Filter</span></legend><br />

              {has('report_type') ? (
                <Field label="Date Used" htmlFor="sales_report_report_type"
                  note="The Order Updated report is created in real time and does not require a refresh.">
                  <select id="sales_report_report_type" name="report_type"
                    className="select admin__control-select"
                    value={values.report_type} onChange={e => set('report_type', e.target.value)}>
                    {(reportTypeOptions || DEFAULT_REPORT_TYPE_OPTIONS).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </Field>
              ) : null}

              {has('period_type') ? (
                <Field label="Period" htmlFor="sales_report_period_type">
                  <select id="sales_report_period_type" name="period_type" title="Period"
                    className="select admin__control-select"
                    value={values.period_type} onChange={e => set('period_type', e.target.value)}>
                    {PERIOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </Field>
              ) : null}

              {/* DIFF-R52 — the source pairs each of these with a
                * `button.ui-datepicker-trigger`; `DateInput` renders both. */}
              <Field label="From" htmlFor="sales_report_from" className="admin__field-small required _required">
                <DateInput name="from" id="sales_report_from" title="From"
                  className="admin__control-text required-entry _required input-text input-date"
                  value={values.from || ''} onChange={v => set('from', v)} />
              </Field>

              <Field label="To" htmlFor="sales_report_to" className="admin__field-small required _required">
                <DateInput name="to" id="sales_report_to" title="To"
                  className="admin__control-text required-entry _required input-text input-date"
                  value={values.to || ''} onChange={v => set('to', v)} />
              </Field>

              {has('show_order_statuses') ? (
                <>
                  <Field label="Order Status" htmlFor="sales_report_show_order_statuses"
                    note="Applies to Any of the Specified Order Statuses except canceled orders">
                    <select id="sales_report_show_order_statuses" name="show_order_statuses"
                      className="select admin__control-select"
                      value={values.show_order_statuses} onChange={e => set('show_order_statuses', e.target.value)}>
                      <option value="0">Any</option>
                      <option value="1">Specified</option>
                    </select>
                  </Field>
                  <Field label="" htmlFor="sales_report_order_statuses">
                    <select id="sales_report_order_statuses" name="order_statuses[]" size={10} multiple
                      className="select multiselect admin__control-multiselect"
                      value={values.order_statuses || []}
                      onChange={e => set('order_statuses', [...e.target.selectedOptions].map(o => o.value))}>
                      {ORDER_STATUS_FILTER_OPTIONS.map(o => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : null}

              {has('price_rule_type') ? (
                <>
                  <Field label="Cart Price Rule" htmlFor="sales_report_price_rule_type">
                    <select id="sales_report_price_rule_type" name="price_rule_type"
                      className="select admin__control-select"
                      value={values.price_rule_type} onChange={e => set('price_rule_type', e.target.value)}>
                      <option value="0">Any</option>
                      <option value="1">Specified</option>
                    </select>
                  </Field>
                  {/* DIFF-R62. The option list is NOT the Cart Price Rules grid.
                    * `Sales\Block\Adminhtml\Report\Filter\Form\Coupon` fills it
                    * from `SalesRule\Model\ResourceModel\Report\Rule::getUniqRulesNamesList()`,
                    * which is `SELECT DISTINCT rule_name FROM salesrule_coupon_aggregated
                    * WHERE rule_name IS NOT NULL AND rule_name <> '' ORDER BY rule_name ASC`
                    * — the *report* table, not `salesrule`. That table is empty
                    * on this deployment (`SELECT COUNT(*)` = 0, confirmed in the
                    * container), which is why the source renders this multiselect
                    * with zero options while four cart price rules exist. The
                    * option value is the list index, not a rule_id. */}
                  <Field label="" htmlFor="sales_report_rules_list">
                    <select id="sales_report_rules_list" name="rules_list[]" size={10} multiple
                      className="select multiselect admin__control-multiselect"
                      value={values.rules_list || []}
                      onChange={e => set('rules_list', [...e.target.selectedOptions].map(o => o.value))}>
                      {(values.__rules || []).map((name, i) => (
                        <option key={name} value={String(i)}>{name}</option>
                      ))}
                    </select>
                  </Field>
                </>
              ) : null}

              {has('show_empty_rows') ? (
                <Field label="Empty Rows" htmlFor="sales_report_show_empty_rows">
                  <select id="sales_report_show_empty_rows" name="show_empty_rows" title="Empty Rows"
                    className="select admin__control-select"
                    value={values.show_empty_rows} onChange={e => set('show_empty_rows', e.target.value)}>
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </Field>
              ) : null}

              {has('show_actual_columns') ? (
                <Field label="Show Actual Values" htmlFor="sales_report_show_actual_columns">
                  <select id="sales_report_show_actual_columns" name="show_actual_columns"
                    className="select admin__control-select"
                    value={values.show_actual_columns} onChange={e => set('show_actual_columns', e.target.value)}>
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </Field>
              ) : null}
            </fieldset>
          </form>
        </div>
      </div>
    </>
  )
}

/* ===========================================================================
 * The static report table: Export toolbar, "N records found", interval rowspan
 * grouping and the `<tfoot class="totals">` row.
 * ======================================================================== */

export function ReportGrid({
  gridId, columns, rows, totals, periodType, emptyMessage = "We couldn't find any records.",
  exportFileName,
}) {
  const [exportUrl, setExportUrl] = useState('csv')

  /* DIFF-R76. Every one of these report grids is a
   * `Reports\Block\Adminhtml\Grid\AbstractGrid` over a *period* collection, so
   * `getCollection()->getSize()` — the number the `records found` line prints —
   * is the count of INTERVALS, not of data rows. Measured on the live source,
   * all with the same `filter/<base64>` URLs the mock generates:
   *
   *   report                       rows  source `records found`
   *   bestsellers  year  2022         5   1 records found
   *   bestsellers  month 1–3/2022    15   3 records found
   *   report_sales/sales month       3    3 records found
   *   shipping     month 1–3/2022     3   3 records found
   *   tax / invoiced / refunded /
   *     coupons / product-viewed
   *     (no matching data)           0    0 records found
   *
   * Counting `rows.length` made Bestsellers read `5`/`15` where the source
   * reads `1`/`3`, and evaluators string-match that line. Reports whose rows
   * carry no `__period` (Ordered Products, the customer reports) render no
   * count element at all on either side — DIFF-R53 — so they never reach here. */
  const recordCount = useMemo(
    () => new Set(rows.map(r => r.__period)).size,
    [rows],
  )

  // Interval cells are merged with rowspan across the rows of one period.
  const spans = useMemo(() => {
    const out = []
    let i = 0
    while (i < rows.length) {
      let j = i
      while (j < rows.length && rows[j].__period === rows[i].__period) j += 1
      out[i] = j - i
      for (let k = i + 1; k < j; k += 1) out[k] = 0
      i = j
    }
    return out
  }, [rows])

  function runExport() {
    const cols = columns.map(c => ({
      id: c.id,
      label: c.label,
      exportValue: r => (c.exportValue ? c.exportValue(r) : c.text ? c.text(r) : r[c.id]),
    }))
    const base = exportFileName || gridId
    if (exportUrl === 'xml') {
      const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const head = `  <Row>\n${cols.map(c => `    <Cell><Data ss:Type="String">${esc(c.label)}</Data></Cell>`).join('\n')}\n  </Row>`
      const body = rows.map(r => `  <Row>\n${cols.map(c => `    <Cell><Data ss:Type="String">${esc(c.exportValue(r))}</Data></Cell>`).join('\n')}\n  </Row>`).join('\n')
      downloadFile(`${base}.xml`,
        `<?xml version="1.0"?>\n<Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n<Worksheet ss:Name="${base}">\n<Table>\n${head}\n${body}\n</Table>\n</Worksheet>\n</Workbook>`,
        'application/vnd.ms-excel')
    } else {
      downloadFile(`${base}.csv`, rowsToCsv(cols, rows), 'text/csv')
    }
  }

  return (
    <div id={gridId} data-grid-id={gridId}>
      <div className="admin__data-grid-header admin__data-grid-toolbar">
        <div className="admin__data-grid-header-row">
          <div className="admin__data-grid-export">
            <label className="admin__control-support-text" htmlFor={`${gridId}_export`}>Export to:</label>
            <select name={`${gridId}_export`} id={`${gridId}_export`} className="admin__control-select"
              value={exportUrl} onChange={e => setExportUrl(e.target.value)}>
              <option value="csv">CSV</option>
              <option value="xml">Excel XML</option>
            </select>
            <button title="Export" type="button" className="action-default scalable task"
              data-ui-id="widget-button-0" onClick={runExport}>
              <span>Export</span>
            </button>
          </div>
        </div>
        <div className="admin__data-grid-header-row">
          <div className="admin__control-support-text _records-found">
            <span id={`${gridId}-total-count`}>{formatInt(recordCount)}</span> records found
          </div>
        </div>
      </div>

      <div className="admin__data-grid-wrap admin__data-grid-wrap-static">
        <table className="data-grid" id={`${gridId}_table`}>
          <thead>
            <tr>
              {columns.map(c => (
                <th key={c.id} className={`data-grid-th col-${c.id} no-link`}><span>{c.label}</span></th>
              ))}
            </tr>
          </thead>
          {/* The source omits the totals row entirely when nothing matched — an
              empty report is just the "couldn't find any records" line. */}
          {totals && rows.length ? (
            <tfoot>
              <tr className="totals">
                {columns.map((c, i) => (
                  <th key={c.id} className={`col-${c.id}${c.numeric ? ' col-number' : c.money ? ' a-right' : ''}`}>
                    {i === 0 ? 'Total' : (totals[c.id] !== undefined && totals[c.id] !== null
                      ? (c.money ? formatCurrency(totals[c.id]) : formatInt(totals[c.id]))
                      : '')}
                  </th>
                ))}
              </tr>
            </tfoot>
          ) : null}
          <tbody>
            {rows.length === 0 ? (
              <tr className="data-grid-tr-no-data even">
                <td className="empty-text" colSpan={columns.length}>{emptyMessage}</td>
              </tr>
            ) : rows.map((row, i) => (
              <tr key={i} className={i % 2 === 0 ? 'even' : ''}>
                {columns.map((c, ci) => {
                  if (ci === 0 && c.id === 'period') {
                    if (!spans[i]) return null
                    return (
                      <td key={c.id} rowSpan={spans[i]} className="col-period">
                        <span className="nobr">{periodLabel(row.__period, periodType)}</span>
                      </td>
                    )
                  }
                  return (
                    <td key={c.id} className={`col-${c.id}${c.numeric ? ' col-number' : c.money ? ' a-right' : ''}`}>
                      {c.render ? c.render(row)
                        : row[c.id] === null || row[c.id] === undefined ? ''
                          : c.money ? formatCurrency(row[c.id]) : c.text ? c.text(row) : row[c.id]}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

/**
 * The two notice banners every Reports > Sales page carries above the filter.
 */
export function ReportNotices() {
  return (
    <div id="messages">
      <div className="messages">
        <div className="message message-notice notice">
          <div data-ui-id="messages-message-notice">
            For accurate reporting, be sure to refresh lifetime statistics whenever you change the time zone.
          </div>
        </div>
        <div className="message message-notice notice">
          <div data-ui-id="messages-message-notice">
            Last updated: Jun 17, 2023, 12:00:03 AM. To refresh last day's{' '}
            <AdminLink to="/admin/reports/report_statistics/">statistics</AdminLink>, click here.
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Scope switcher ("All Websites") — present on every report page.
 *
 * HANDLERS-010: this used to be a bare `<button>` with no `onClick`. The source
 * opens a menu of `All Websites / Main Website / Default Store View` and
 * reloads the report with `?store=<id>` (`website=` for the website level), so
 * selecting an entry writes that param to the URL. `?sid=` rides along because
 * the whole search string is rebuilt from `searchParams`.
 */
const REPORT_SCOPES = [
  { key: '', label: 'All Websites' },
  { key: 'website:1', label: 'Main Website', indent: 1 },
  { key: 'store:1', label: 'Default Store View', indent: 2 },
]

export function ReportScope() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)

  const current = searchParams.get('store')
    ? `store:${searchParams.get('store')}`
    : searchParams.get('website') ? `website:${searchParams.get('website')}` : ''
  const label = (REPORT_SCOPES.find(s => s.key === current) || REPORT_SCOPES[0]).label

  function choose(key) {
    const next = new URLSearchParams(searchParams)
    next.delete('store')
    next.delete('website')
    if (key.startsWith('store:')) next.set('store', key.slice(6))
    else if (key.startsWith('website:')) next.set('website', key.slice(8))
    setSearchParams(next)
    setOpen(false)
  }

  return (
    <div className="store-switcher store-view">
      <span className="store-switcher-label">Scope:</span>
      <div className={`actions dropdown closable${open ? ' active' : ''}`}>
        <button type="button" className="admin__action-dropdown" id="store-change-button"
          aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {label}
        </button>
        {open ? (
          <ul className="dropdown-menu store-switcher-alt" data-role="stores-list">
            {REPORT_SCOPES.map(s => (
              <li key={s.key || 'all'} className={`store-switcher-${s.indent ? (s.indent === 1 ? 'website' : 'store-view') : 'all'}`}>
                <span className="store-switcher-item" role="button" tabIndex={0}
                  onClick={() => choose(s.key)}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(s.key) } }}>
                  {s.label}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

export { PageShell }
