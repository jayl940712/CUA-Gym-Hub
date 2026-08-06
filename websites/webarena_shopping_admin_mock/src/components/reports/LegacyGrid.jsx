import React, { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { encodeFilter, decodeFilter } from './reportUtils.js'
import { rowsToCsv, downloadFile } from '../../utils/gridUtils.js'
import './legacyGrid.css'

/* ===========================================================================
 * LegacyGrid — the generalisation of `components/reviews/LegacyReviewGrid.jsx`.
 *
 * A handful of Magento admin listings are still legacy
 * `Magento\Backend\Block\Widget\Grid` renders rather than UI-component grids:
 * Reviews, Pending Reviews, Search Terms Report, Order Status, Low Stock,
 * Refresh Statistics. Their chrome is completely different from the modern
 * `Filters / Default View / Columns / Export` toolbar and agents are trained on
 * it (TEST DIFF-R56, DIFF-R60):
 *
 *   - `Export to: [CSV|Excel XML] [Export]` in the first header row
 *   - `Search` + `Reset Filter` in `.admin__filter-actions`
 *   - `N records found` + `#<grid>_massaction-count`
 *   - `name="limit"` per-page select and a `‹ n of m ›` pager
 *   - `<tr class="data-grid-filters" data-role="filter-form">` **inside
 *     `<thead>`**, one control per column, carrying the source's own `name`
 *     attributes (`name`, `sku`, `qty[from]`, `qty[to]`, `sourceCode`, …)
 *
 * DOM transcribed verbatim from `assets/html/reports-product-lowstock.html`
 * and `assets/html/search-term-report.html`.
 *
 * URL state. The source spells the grid's state as `/key/value/` path pairs
 * (`/sort/qty/dir/asc/page/2/limit/50/filter/<base64>/`). That needs a splat
 * route to be matchable; where one exists the grid drives the URL, and where it
 * does not (`src/App.jsx` is owned by another agent this round) it falls back to
 * component state so every control still does something coherent. Detection is
 * automatic: `useParams()['*']` is a string on a splat route and `undefined`
 * otherwise, so adding the splat row turns URL mode on with no code change here.
 * ======================================================================== */

const PAGE_SIZES = [20, 30, 50, 100, 200]

/* F-04. The source's `Export to:` select does NOT carry `csv` / `xml` as its
 * option values — it carries the **absolute URL of the export controller**:
 *
 *   <option value="http://<host>/admin/search/term/exportSearchCsv/">CSV</option>
 *   <option value="http://<host>/admin/search/term/exportSearchExcel/">Excel XML</option>
 *
 * `select_option(sel, 'csv')` therefore raises `option not found` on the source
 * and used to succeed on the mock — a locator divergence in the direction that
 * hides a real failure. Callers pass the source's own controller paths and the
 * values are rooted at the mock's own origin, so the shape matches exactly.
 */
function exportOptions(paths) {
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  if (!paths) return [{ value: 'csv', label: 'CSV' }, { value: 'xml', label: 'Excel XML' }]
  return [
    { value: `${origin}${paths.csv}`, label: 'CSV', format: 'csv' },
    { value: `${origin}${paths.xml}`, label: 'Excel XML', format: 'xml' },
  ]
}

/**
 * `/sort/qty/dir/asc/` → `{ sort: 'qty', dir: 'asc' }`.
 *
 * Only the leading/trailing empties are dropped — an *interior* empty is a real
 * empty value. The source's own Reset Filter lands on `<base>/filter//form_key/
 * <hash>/`, and collapsing that would read `form_key` as the filter payload.
 */
export function parseGridSegments(splat) {
  const parts = String(splat || '').replace(/^\/+/, '').replace(/\/+$/, '').split('/')
  const out = {}
  if (parts.length === 1 && parts[0] === '') return out
  for (let i = 0; i < parts.length; i += 2) {
    out[decodeURIComponent(parts[i])] = decodeURIComponent(parts[i + 1] ?? '')
  }
  return out
}

const contains = (haystack, needle) => String(haystack ?? '')
  .toLowerCase().includes(String(needle).trim().toLowerCase())

/** `M/D/YY` (the source's admin locale) → the ISO prefix the seed stores. */
function toIsoDate(value) {
  const m = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return String(value)
  const year = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

/* A column's filter `name` is not always its column id — the Cart Price Rule
 * grid renders its `Web Site` column's filter as `[name="rule_website"]`, not
 * `[name="website_ids"]`. `col.filterId` carries the source's own name. */
const filterId = col => col.filterId || col.id

/**
 * DIFF-R102 — the column's identity in the DOM and in the URL, which is NOT
 * always the descriptor's `id`.
 *
 * Magento derives a legacy grid column's `data-sort`, its `data-column`, its
 * `col-<x>` class AND its filter `name` from ONE value: the column's index in
 * the grid block. Measured on the live source, that invariant holds on every
 * legacy route swept — for every sortable column, `data-sort` is exactly the
 * `name` of that column's own filter control:
 *
 *   /admin/catalog/product_set/  th data-sort="set_name"  td data-column="set_name"
 *                                input name="set_name"    class="… col-set_name"
 *   /admin/sales_rule/promo_quote/  Web Site: no data-sort, filter name="rule_website",
 *                                   td data-column="rule_website" col-rule_website
 *
 * The mock's descriptors were written with the seed's field name as `id` and
 * the source's name as `filterId`, so wherever those two differ the mock
 * emitted a `data-sort` the source has never heard of — and the source's own
 * `/sort/<col>/dir/<dir>/` URL then matched no column and was silently dropped.
 * Swept across all 40 legacy routes, 18 disagreed this way.
 *
 * So `filterId` is the right default, and `sortId` is the escape hatch for a
 * column whose sort key genuinely differs from its filter name. `id` stays the
 * key the ROW DATA is read under (`cellValue`) — only DOM/URL identity moves.
 */
const columnKey = col => col.sortId || col.filterId || col.id

/** The filter `name` attributes a column contributes, in source order. */
function filterNames(col) {
  const n = filterId(col)
  if (col.filter === 'range' || col.filter === 'daterange') return [`${n}[from]`, `${n}[to]`]
  if (!col.filter || col.filter === 'none') return []
  return [n]
}

function cellValue(col, row) {
  if (col.value) return col.value(row)
  return row[col.id]
}

/**
 * @param {object}   props
 * @param {string}   props.gridId        e.g. `gridLowstock` — drives every id the source emits
 * @param {string}   props.basePath      route the `/key/value/` segments hang off
 * @param {object[]} props.columns       `{ id, label, className, filter, options, sortable, value, render, cellClassName }`
 *                                   plus, on a `select` filter, `emptyOptionLabel`
 *                                   (label of the leading sentinel, default `''`)
 *                                   and `noEmptyOption` (omit the sentinel entirely)
 * @param {object[]} props.rows
 * @param {function} props.rowKey
 * @param {string}   [props.defaultSort] column id the source sorts by on cold load
 * @param {string}   [props.defaultDir]  `asc` | `desc`
 * @param {function} [props.rowHref]     row → admin path; the source puts it in `title=` and navigates on click
 * @param {object[]} [props.massActions] `{ id, label, onApply }` — omit for a grid with no massaction bar
 * @param {function} [props.rowSelectValue] row → checkbox value (required when massActions is set)
 * @param {string}   [props.rowSelectName] `name` on the row checkbox (the source's own, e.g. `code`)
 * @param {boolean}  [props.exportable]
 * @param {boolean}  [props.pager]        false for the grids the source renders with no per-page/pager
 */
export default function LegacyGrid({
  gridId, basePath, columns, rows, rowKey,
  defaultSort = '', defaultDir = 'asc',
  rowHref = null, massActions = null, rowSelectValue = null, rowSelectName = null,
  massActionFilter = false,
  /* Magento's massaction layout accepts `<item name="selected">1</item>` on one
   * option — `adminhtml_cache_block.xml` sets it on `refresh`, so the source's
   * Cache Management renders `<option value="refresh" selected="selected">` and
   * the select carries the `_selected` modifier on cold load. Every other
   * legacy grid leaves the placeholder selected. */
  massActionDefault = '',
  exportable = true, exportFileName = null, exportPaths = null, pager = true,
  widgetButtonIds = {},
  /* Legacy grids do not all share one empty-state string: the source prints
   * `No Templates Found` on Newsletter Templates and `We found no problems.` on
   * the Newsletter Problems report, where most grids print the generic line. */
  emptyText = "We couldn't find any records.",
}) {
  /* F-07. Every legacy-grid button on the source carries
   * `data-ui-id="widget-button-<n>"`, where `<n>` is Magento's per-page widget
   * counter — Export, Reset Filter, Search, Submit in creation order, offset by
   * whatever buttons the page container created first. The numbers are page
   * facts, not derivable here, so each caller passes the ones its own route
   * emits (measured live: lowstock/search-term-report/review-reports
   * `0/1/2`, review grids `—/3/4/5`, newsletter subscriber `0/1/2/3`). */
  const wb = widgetButtonIds
  const navigate = useNavigate()
  const location = useLocation()
  const params = useParams()

  /* DIFF-R67. Every page that renders this grid now has the matching splat row
   * in App.jsx §11, so the state always lives in the path — exactly as it does
   * on the source, where clicking Hits leaves you on
   * `…/report/sort/popularity/dir/desc/`. On the bare base URL the plain route
   * matches and `useParams()['*']` is `undefined`, which parses to no segments —
   * so this no longer needs the component-state fallback it carried while
   * App.jsx was another agent's file. */
  const segments = parseGridSegments(params['*'])

  const emptyFilters = useMemo(() => {
    const out = {}
    if (massActionFilter) out.massaction = ''
    for (const c of columns) for (const n of filterNames(c)) out[n] = ''
    return out
  }, [columns, massActionFilter])

  const applied = useMemo(
    () => ({ ...emptyFilters, ...(decodeFilter(segments.filter) || {}) }),
    [emptyFilters, segments.filter],
  )
  const [draft, setDraft] = useState(applied)
  const [lastFilter, setLastFilter] = useState(segments.filter)
  if (lastFilter !== segments.filter) {
    setLastFilter(segments.filter)
    setDraft(applied)
  }

  /* Call sites spell `defaultSort` with whichever name they measured — some the
   * descriptor's `id`, some the source's sort key. Resolve it through the same
   * lookup the headers use so a `columnKey` that differs from `id` cannot make
   * the cold-load sort match no column and silently render unsorted. */
  const resolvedDefault = useMemo(() => {
    const col = columns.find(c => columnKey(c) === defaultSort)
      || columns.find(c => c.id === defaultSort)
    return col ? columnKey(col) : defaultSort
  }, [columns, defaultSort])

  const sort = segments.sort || resolvedDefault
  const dir = (segments.dir || defaultDir) === 'asc' ? 'asc' : 'desc'
  const limit = pager
    ? (PAGE_SIZES.includes(Number(segments.limit)) ? Number(segments.limit) : 20)
    : Number.MAX_SAFE_INTEGER
  const page = Math.max(1, Number(segments.page) || 1)

  const [action, setAction] = useState(massActionDefault)
  const [selected, setSelected] = useState([])
  const exportChoices = useMemo(() => exportOptions(exportPaths), [exportPaths])
  const [exportFormat, setExportFormat] = useState(exportChoices[0].value)

  /* ---------------------------------------------------------- navigation */

  /**
   * Spell the grid's state back into the path, the way the source does.
   *
   * Measured on the live source by driving each grid and reading the address
   * bar (the `form_key` pair it also appends is session machinery the mock has
   * no equivalent of, and is tolerated-and-ignored on the way back in):
   *
   *   click Hits          → `…/report/sort/popularity/dir/asc/`
   *   click Hits again    → `…/report/sort/popularity/dir/desc/`   ← dir ALWAYS spelled
   *   per-page 30         → `…/report/limit/30/`                   ← sort/dir dropped at default
   *   Search              → `…/report/filter/<base64>/`
   *
   * So `sort` and `dir` travel as a pair and appear whenever *either* differs
   * from the grid's cold-load state; everything else is omitted at its default.
   */
  function go(next) {
    const state = { sort, dir, page, limit, filter: segments.filter, ...next }
    const keep = []
    if (String(state.sort ?? '') !== String(resolvedDefault)
        || String(state.dir ?? '') !== String(defaultDir)) {
      if (state.sort) {
        keep.push(`sort/${encodeURIComponent(state.sort)}`)
        keep.push(`dir/${encodeURIComponent(state.dir || defaultDir)}`)
      }
    }
    const DEFAULTS = { page: 1, limit: 20, filter: '' }
    for (const key of ['page', 'limit', 'filter']) {
      const v = state[key]
      if (v === undefined || v === null || v === '') continue
      if (String(v) === String(DEFAULTS[key])) continue
      keep.push(`${key}/${encodeURIComponent(v)}`)
    }
    navigate({ pathname: `${basePath}/${keep.join('/')}${keep.length ? '/' : ''}`, search: location.search })
  }

  const doFilter = () => {
    const payload = {}
    for (const [k, v] of Object.entries(draft)) if (v !== '' && v != null) payload[k] = v
    go({ filter: Object.keys(payload).length ? encodeFilter(payload) : '', page: 1 })
  }
  const resetFilter = () => {
    setDraft(emptyFilters)
    go({ filter: '', page: 1, sort: resolvedDefault, dir: defaultDir, limit: 20 })
  }
  const setSort = column => {
    if (sort === column) go({ dir: dir === 'asc' ? 'desc' : 'asc', page: 1 })
    else go({ sort: column, dir: 'asc', page: 1 })
  }

  /* ------------------------------------------------------------ the data */

  const filtered = useMemo(() => {
    let out = rows
    /* Magento's `massaction` filter narrows to the rows the checkbox column has
     * selected (`Yes`) or not selected (`No`); `Any` is the no-op default. */
    if (massActionFilter && applied.massaction !== '' && applied.massaction != null) {
      const inSel = r => selected.includes(String(rowSelectValue ? rowSelectValue(r) : rowKey(r)))
      out = out.filter(r => (String(applied.massaction) === '1' ? inSel(r) : !inSel(r)))
    }
    for (const col of columns) {
      const f = col.filter
      if (!f || f === 'none') continue
      if (f === 'daterange') {
        const from = applied[`${filterId(col)}[from]`]
        const to = applied[`${filterId(col)}[to]`]
        if (from) out = out.filter(r => String(cellValue(col, r) ?? '') >= toIsoDate(from))
        if (to) out = out.filter(r => String(cellValue(col, r) ?? '') <= `${toIsoDate(to)} 23:59:59`)
        continue
      }
      if (f === 'range') {
        const from = applied[`${filterId(col)}[from]`]
        const to = applied[`${filterId(col)}[to]`]
        if (from !== '' && from != null && Number.isFinite(Number(from))) {
          out = out.filter(r => Number(cellValue(col, r)) >= Number(from))
        }
        if (to !== '' && to != null && Number.isFinite(Number(to))) {
          out = out.filter(r => Number(cellValue(col, r)) <= Number(to))
        }
        continue
      }
      const v = applied[filterId(col)]
      if (v === '' || v == null) continue
      if (f === 'select') out = out.filter(r => String(col.filterValue ? col.filterValue(r) : cellValue(col, r)) === String(v))
      else if (f === 'store') {
        // The source's store filter uses `0` for "All Store Views".
        if (String(v) !== '0') out = out.filter(r => String(cellValue(col, r)) === String(v))
      } else out = out.filter(r => contains(col.searchValue ? col.searchValue(r) : cellValue(col, r), v))
    }
    return out
  }, [rows, columns, applied, massActionFilter, selected, rowSelectValue, rowKey])

  const sorted = useMemo(() => {
    // Tolerate a `sort` segment spelled as the descriptor id as well as the
    // source's own key — an agent may arrive with either.
    const col = columns.find(c => columnKey(c) === sort) || columns.find(c => c.id === sort)
    if (!col) return filtered
    const sign = dir === 'asc' ? 1 : -1
    const key = r => {
      const v = col.sortValue ? col.sortValue(r) : cellValue(col, r)
      if (col.numeric) return Number(v)
      /* A `sortValue` that already returns a number must compare numerically —
       * stringifying it sorted the Widgets grid 1, 10, 11 where the source
       * sorts 1, 2, 3. */
      return typeof v === 'number' ? v : String(v ?? '').toLowerCase()
    }
    return [...filtered].sort((a, b) => {
      const av = key(a)
      const bv = key(b)
      return av < bv ? -sign : av > bv ? sign : 0
    })
  }, [filtered, columns, sort, dir])

  const pages = Math.max(1, Math.ceil(sorted.length / limit))
  const current = Math.min(page, pages)
  const visible = sorted.slice((current - 1) * limit, current * limit)

  /* -------------------------------------------------------- mass actions */

  const toggle = id => setSelected(prev => (
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  ))
  const allVisibleIds = visible.map(r => String(rowSelectValue ? rowSelectValue(r) : rowKey(r)))

  /** The source's `#<grid>_massaction-mass-select` row-selection helper (F-07). */
  function massSelect(mode) {
    const allIds = sorted.map(r => String(rowSelectValue ? rowSelectValue(r) : rowKey(r)))
    if (mode === 'selectAll') setSelected(allIds)
    else if (mode === 'unselectAll') setSelected([])
    else if (mode === 'selectVisible') setSelected(prev => [...new Set([...prev, ...allVisibleIds])])
    else if (mode === 'unselectVisible') setSelected(prev => prev.filter(id => !allVisibleIds.includes(id)))
  }

  function submitMassAction() {
    const chosen = (massActions || []).find(a => a.id === action)
    if (!chosen || !selected.length) return
    chosen.onApply(selected)
    setSelected([])
    setAction('')
  }

  /* -------------------------------------------------------------- export */

  function doExport() {
    const base = exportFileName || gridId
    const chosen = exportChoices.find(o => o.value === exportFormat)
    const format = chosen?.format || (/Excel|xml/i.test(chosen?.label || exportFormat) ? 'xml' : 'csv')
    const cols = columns.map(c => ({
      label: c.label,
      exportValue: r => {
        const v = c.exportValue ? c.exportValue(r) : cellValue(c, r)
        return v == null ? '' : String(v)
      },
    }))
    if (format === 'xml') {
      const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const body = sorted.map(r => (
        `  <Row>\n${cols.map(c => `    <Cell><Data ss:Type="String">${esc(c.exportValue(r))}</Data></Cell>`).join('\n')}\n  </Row>`
      )).join('\n')
      downloadFile(`${base}.xml`,
        `<?xml version="1.0"?>\n<Workbook>\n <Worksheet ss:Name="${gridId}">\n  <Table>\n`
        + `  <Row>\n${cols.map(c => `    <Cell><Data ss:Type="String">${esc(c.label)}</Data></Cell>`).join('\n')}\n  </Row>\n`
        + `${body}\n  </Table>\n </Worksheet>\n</Workbook>\n`, 'application/xml')
    } else {
      downloadFile(`${base}.csv`, rowsToCsv(cols, sorted), 'text/csv')
    }
  }

  /* ------------------------------------------------------------ renderers */

  const textFilter = (name, extra = {}) => (
    <input type="text" name={name} id={`${gridId}_filter_${name.replace(/\[|\]/g, '_').replace(/_$/, '')}`}
      value={draft[name] ?? ''} className="input-text admin__control-text no-changes"
      onChange={e => setDraft(d => ({ ...d, [name]: e.target.value }))}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doFilter() } }}
      {...extra} />
  )

  function filterControl(col) {
    const n = filterId(col)
    switch (col.filter) {
      case 'text':
        return textFilter(n)
      case 'range':
        return (
          <div className="range">
            <div className="range-line">{textFilter(`${n}[from]`, { placeholder: 'From' })}</div>
            <div className="range-line">{textFilter(`${n}[to]`, { placeholder: 'To' })}</div>
          </div>
        )
      case 'daterange':
        // The source renders a `mage/calendar` dateRange here: two `.range-line
        // date` inputs plus a hidden `<name>[locale]` carrying `en_US`.
        return (
          <>
            <div className="range" id={`${gridId}_filter_${n}_range`}>
              <div className="range-line date">{textFilter(`${n}[from]`, { placeholder: 'From' })}</div>
              <div className="range-line date">{textFilter(`${n}[to]`, { placeholder: 'To' })}</div>
            </div>
            <input type="hidden" name={`${n}[locale]`} value="en_US" readOnly />
          </>
        )
      case 'select':
        /* F-01. The leading sentinel is NOT the same on every legacy grid, and
         * getting it wrong is a locator divergence, not a cosmetic one:
         *   most grids                     <option value=""></option>
         *   /admin/tax/rate/ tax_country_id <option value="">All Countries</option>
         *   /admin/checkout/agreement/ stores   no sentinel at all — the list
         *                                       starts at value="0" All Store Views
         * An empty label makes `select_option(label='All Countries')` raise, and
         * an extra sentinel shifts every option index by one. `emptyOptionLabel`
         * and `noEmptyOption` let the caller spell whichever its own route
         * emits; the default is unchanged. */
        return (
          <select name={n} id={`${gridId}_filter_${n}`} className="no-changes admin__control-select"
            value={draft[n] ?? ''} onChange={e => setDraft(d => ({ ...d, [n]: e.target.value }))}>
            {col.noEmptyOption ? null : <option value="">{col.emptyOptionLabel ?? ''}</option>}
            {(col.options || []).map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        )
      case 'store':
        /* `emptyFilters` seeds every filter with `''`, and this select has no
         * `''` option — `??` let that through and left the control with nothing
         * selected. `||` resolves it to the source's own no-op value, `0`
         * (All Store Views). */
        return (
          <select className="admin__control-select" name={n}
            value={draft[n] || (col.emptyOptionValue ?? '0')}
            onChange={e => setDraft(d => ({ ...d, [n]: e.target.value }))}>
            {/* F-01f. The store filter's sentinel is NOT the same on every
              * grid, and the two Search Terms routes disagree with each other.
              * Measured live:
              *   /admin/search/term/report/    <option value="0">All Store Views</option>
              *   /admin/search/term/index/     <option value="" selected></option>
              *   /admin/checkout/agreement/    <option value="0">All Store Views</option>
              * so `select_option('[name=store_id]', '')` raises on the mock's
              * Search Terms grid while passing on the source. The optgroups
              * below are identical on all three. */}
            <option value={col.emptyOptionValue ?? '0'}>
              {col.emptyOptionLabel ?? 'All Store Views'}
            </option>
            <optgroup label="Main Website" />
            <optgroup label="&nbsp;&nbsp;&nbsp;&nbsp;Main Website Store">
              <option value="1">&nbsp;&nbsp;&nbsp;&nbsp;Default Store View</option>
            </optgroup>
          </select>
        )
      default:
        return <>&nbsp;</>
    }
  }

  const hasFilters = columns.some(c => c.filter && c.filter !== 'none')
  const colSpan = columns.length + (massActions ? 1 : 0)

  return (
    <div id={gridId} data-grid-id={gridId} className="legacy-grid">
      <div className="admin__data-grid-header admin__data-grid-toolbar">
        {exportable ? (
          <div className="admin__data-grid-header-row">
            <div className="admin__data-grid-export">
              <label htmlFor={`${gridId}_export`} className="admin__control-support-text">Export to:</label>
              <select name={`${gridId}_export`} id={`${gridId}_export`} className="admin__control-select"
                value={exportFormat} onChange={e => setExportFormat(e.target.value)}>
                {exportChoices.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <button title="Export" type="button" className="action-default scalable task"
                data-ui-id={wb.export || undefined}
                onClick={doExport}><span>Export</span></button>
            </div>
          </div>
        ) : null}

        <div className={`admin__data-grid-header-row${massActions ? ' _massaction' : ''}`}>
          {hasFilters ? (
            <div className="admin__filter-actions">
              <button title="Search" type="button" data-action="grid-filter-apply"
                data-ui-id={wb.search || undefined}
                className="action-default scalable action-secondary" onClick={doFilter}>
                <span>Search</span>
              </button>
              <button title="Reset Filter" type="button" data-action="grid-filter-reset"
                data-ui-id={wb.reset || undefined}
                className="action-default scalable action-reset action-tertiary" onClick={resetFilter}>
                <span>Reset Filter</span>
              </button>
            </div>
          ) : null}

          {massActions ? (
            <div id={`${gridId}_massaction`} className="admin__grid-massaction">
              <div className="admin__grid-massaction-form">
                <select id={`${gridId}_massaction-select`}
                  className={`required-entry local-validation admin__control-select${action ? ' _selected' : ''}`}
                  value={action} onChange={e => setAction(e.target.value)}>
                  <option className="admin__control-select-placeholder" value="">Actions</option>
                  {massActions.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
                </select>
                <button title="Submit" type="button" className="action-default scalable"
                  data-ui-id={wb.submit || undefined}
                  onClick={submitMassAction}><span>Submit</span></button>
              </div>
              {/* DIFF-R56 / F-07. Beside the Actions select the source ships the
                * row-selection helper — `<select id="<grid>_massaction-mass-select"
                * class="action-select-multiselect" data-menu="grid-mass-select">`
                * with a `Mass Actions` optgroup. Verified verbatim on
                * `/admin/reports/report_statistics/`. Without it
                * `select_option('#gridRefreshStatistics_massaction-mass-select',
                * 'selectAll')` has nothing to target. */}
              <div className="mass-select-wrap">
                <select id={`${gridId}_massaction-mass-select`} className="action-select-multiselect"
                  data-menu="grid-mass-select" value="" onChange={e => massSelect(e.target.value)}>
                  <optgroup label="Mass Actions">
                    <option disabled value="" />
                    <option value="selectAll">Select All</option>
                    <option value="unselectAll">Unselect All</option>
                    <option value="selectVisible">Select Visible</option>
                    <option value="unselectVisible">Unselect Visible</option>
                  </optgroup>
                </select>
                <label htmlFor={`${gridId}_massaction-mass-select`} />
              </div>
            </div>
          ) : null}

          <div className="admin__control-support-text">
            <span id={`${gridId}-total-count`} data-ui-id="adminhtml-grid-total-count">{sorted.length}</span>
            {' '}records found
            <span id={`${gridId}_massaction-count`}
              className={`mass-select-info${selected.length ? '' : ' _empty'}`}>
              <strong data-role="counter">{selected.length}</strong>
              {' '}<span>selected</span>
            </span>
          </div>

          {/* The source omits the per-page select and the pager entirely on the
            * grids whose collection is not paginated (Refresh Statistics —
            * `select[name=limit]` count is 0 there). */}
          {pager ? (
          <div className="admin__data-grid-pager-wrap">
            <select name="limit" id={`${gridId}_page-limit`} className="admin__control-select"
              value={limit} onChange={e => go({ limit: e.target.value, page: 1 })}>
              {PAGE_SIZES.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
            <label htmlFor={`${gridId}_page-limit`} className="admin__control-support-text">per page</label>
            <div className="admin__data-grid-pager">
              <button type="button" className={`action-previous${current <= 1 ? ' disabled' : ''}`}
                disabled={current <= 1} onClick={() => go({ page: current - 1 })}>
                <span>Previous page</span>
              </button>
              <input type="text" id={`${gridId}_page-current`} name="page" className="admin__control-text"
                value={current} onChange={e => go({ page: e.target.value })} />
              <label className="admin__control-support-text" htmlFor={`${gridId}_page-current`}>
                of <span>{pages}</span>
              </label>
              <button type="button" title="Next page"
                className={`action-next${current >= pages ? ' disabled' : ''}`}
                disabled={current >= pages} onClick={() => go({ page: current + 1 })}>
                <span>Next page</span>
              </button>
            </div>
          </div>
          ) : null}
        </div>
      </div>

      <div className="admin__data-grid-wrap admin__data-grid-wrap-static">
        <table className="data-grid" id={`${gridId}_table`}>
          <thead>
            <tr>
              {/* The source's massaction header cell is a plain `&nbsp;` —
                * select-all lives in the `_massaction-mass-select` control in
                * the toolbar, not in the header. */}
              {massActions ? (
                <th data-column="massaction" className="data-grid-th">&nbsp;</th>
              ) : null}
              {columns.map((c, i) => (c.sortable === false ? (
                <th key={c.id}
                  className={`data-grid-th ${c.className || ''} ${i === columns.length - 1 ? 'last ' : ''}no-link col-${columnKey(c)}`.replace(/\s+/g, ' ').trim()}>
                  <span>{c.label}</span>
                </th>
              ) : (
                /* The source's `data-direction` is the direction a click would
                 * apply, not the current one: the `_descend` column still
                 * carries `data-direction="asc"`. */
                <th key={c.id} data-sort={columnKey(c)}
                  data-direction={sort === columnKey(c) ? (dir === 'asc' ? 'desc' : 'asc') : 'asc'}
                  className={`data-grid-th _sortable ${sort === columnKey(c) ? (dir === 'asc' ? '_ascend' : '_descend') : 'not-sort'} ${c.className || ''} ${i === columns.length - 1 ? 'last' : ''} col-${columnKey(c)}`.replace(/\s+/g, ' ').trim()}
                  onClick={() => setSort(columnKey(c))}>
                  <span>{c.label}</span>
                </th>
              )))}
            </tr>
            {hasFilters ? (
              <tr className="data-grid-filters" data-role="filter-form">
                {/* The massaction column's filter cell is `&nbsp;` on most legacy
                  * grids, but the Search Terms grid renders Magento's
                  * `massaction` "select rows" filter there —
                  * `<select name="massaction">` with `Any / Yes / No`. Callers
                  * that measured it on the source pass `massActionFilter`. */}
                {massActions ? (
                  <td data-column="massaction" className="col-select col-massaction">
                    {massActionFilter ? (
                      <select className="admin__control-select" name="massaction"
                        id={`${gridId}_filter_massaction`}
                        value={draft.massaction || ''}
                        onChange={e => setDraft(d => ({ ...d, massaction: e.target.value }))}>
                        <option value="">Any</option>
                        <option value="1">Yes</option>
                        <option value="0">No</option>
                      </select>
                    ) : <>&nbsp;</>}
                  </td>
                ) : null}
                {columns.map((c, i) => (
                  <td key={c.id} data-column={columnKey(c)}
                    className={`${c.className || ''} ${i === columns.length - 1 ? 'last' : ''} ${c.sortable === false ? 'no-link' : ''} col-${columnKey(c)}`.replace(/\s+/g, ' ').trim()}>
                    {filterControl(c)}
                  </td>
                ))}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr className="data-grid-tr-no-data" data-role="row">
                <td className="empty-text" colSpan={colSpan}>{emptyText}</td>
              </tr>
            ) : visible.map(r => {
              const href = rowHref ? rowHref(r) : null
              const id = String(rowSelectValue ? rowSelectValue(r) : rowKey(r))
              return (
                <tr key={rowKey(r)} data-role="row" title={href || undefined}
                  onClick={href ? e => {
                    if (e.target.closest('input,select,button,a,label')) return
                    navigate({ pathname: href, search: location.search })
                  } : undefined}>
                  {massActions ? (
                    <td className="col-select col-massaction data-grid-checkbox-cell">
                      <label className="data-grid-checkbox-cell-inner">
                        <input type="checkbox" data-role="select-row" value={id} id={`id_${id}`}
                          name={rowSelectName || undefined}
                          className="admin__control-checkbox"
                          checked={selected.includes(id)} onChange={() => toggle(id)} />
                      </label>
                    </td>
                  ) : null}
                  {columns.map((c, i) => (
                    <td key={c.id} data-column={columnKey(c)}
                      className={`${c.className || ''} col-${columnKey(c)}${c.numeric ? ' col-number' : ''}${i === columns.length - 1 ? ' last' : ''}`.trim()}>
                      {c.render ? c.render(r) : cellValue(c, r)}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
