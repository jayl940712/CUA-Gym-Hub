import React, { useMemo, useRef, useState, useEffect } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import Icon from '../layout/Icon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import {
  PAGE_SIZES, parseGridState, withGridParams, withoutFilters, filterParamKey,
  applyGridState, activeFilterChips, rowsToCsv, downloadFile, defaultPageSizeFor,
  filterName, SEARCH_CHIP_FIELD,
} from '../../utils/gridUtils.js'
import { withSid } from '../../utils/navigation.js'
import { parseLegacySegments, legacySegmentsToParams } from './legacySegments.js'
import './grid.css'

/**
 * The Magento UI-component grid (`admin__data-grid`) — one component behind
 * every listing route (Orders, Products, Customers, Invoices, Shipments,
 * Credit Memos, CMS Pages, Cart Price Rules, …).
 *
 * Everything is driven by the query string so deep links work on first load and
 * `?sid=` always survives (see utils/gridUtils.js for the param contract).
 *
 * Column descriptor:
 *   {
 *     id, label,
 *     render?(row),          // cell content; defaults to String(row[id])
 *     searchValue?(row),     // text the keyword search looks at
 *     filterValue?(row),     // value the column filter compares
 *     sortValue?(row),       // value the sorter compares
 *     exportValue?(row),     // CSV cell
 *     filterType?,           // 'text' | 'select' | 'range' | 'date' | null (not filterable)
 *     filterName?,           // the source's `name` attribute for the filter control.
 *                            // Defaults to `id`; set it where the display column
 *                            // and the filter field differ (Orders' Purchase Point
 *                            // column filters on name="store_id" — DOM-104).
 *                            // Range filters emit `<name>[from]` / `<name>[to]`,
 *                            // exactly as the source does (DOM-100).
 *     emptyOptionLabel?,     // visible label of a select filter's empty option. The
 *                            // source leaves it blank everywhere except Purchase
 *                            // Point, which reads "All Store Views" (DOM-104).
 *     options?,              // [{value,label}] for filterType 'select'
 *     sortable?,             // default true
 *     defaultVisible?,       // default true — Columns chooser initial state
 *     className?,
 *   }
 */
const EXPORT_FORMATS = [
  { value: 'csv', label: 'CSV' },
  { value: 'xml', label: 'Excel XML' },
]

/** Labels and order taken verbatim from the source's `data-grid-multicheck-cell`. */
const MULTICHECK_ACTIONS = [
  { value: 'all', label: 'Select All' },
  { value: 'none', label: 'Deselect All' },
  { value: 'page', label: 'Select All on This Page' },
  { value: 'page-none', label: 'Deselect All on This Page' },
]

export default function AdminGrid({
  gridId,
  rows,
  columns,
  rowKey = row => row.entity_id,
  selectable = false,
  massActions = [],
  exportFileName,
  // Not every source grid ships the Export control — the Products listing has
  // none (DIFF-005), the Customers listing does. Pass `exportable={false}` to
  // match a source grid that lacks it.
  exportable = true,
  searchPlaceholder = 'Search by keyword',
  emptyMessage = "We couldn't find any records.",
  defaultSort = null,
  // Optional. gridUtils' GRID_PAGE_SIZES overrides it for the three listings
  // whose source bookmark is not 20 (PARITY-007: 200 orders, 200 products,
  // 100 customers); everything else falls back to this, then to 20.
  defaultPageSize = null,
  toolbarLeft = null,
  // Legacy (non-UI-component) source grids — Product Attributes, Attribute
  // Sets, Stores — have no Action column; the whole `<tr>` carries an
  // `onclick` that opens the record (DIFF-008). Pass `rowHref={row => path}` to
  // reproduce that instead of appending a phantom Edit column.
  rowHref = null,
  // The New Review product chooser is the one source grid whose row click is an
  // AJAX call rather than a navigation — the browser stays on
  // /admin/review/product/new/ while the review form replaces the grid. Pass
  // `onRowClick` for that, with `rowTitle` supplying the URL the source puts in
  // the row's title attribute.
  onRowClick = null,
  rowTitle = null,
  // Optional list of column ids giving the order the source's filter panel
  // renders its fields in (see `filterableColumns` below).
  filterOrder = null,
  /* ---- source `data-ui-id` hooks on the toolbar (DOM F-01) ----------------
   * Magento's LEGACY (non-UI-component) grids hand their toolbar buttons the
   * fallback `data-ui-id="widget-button-<n>"`, where <n> is a page-scoped
   * counter over every anonymous `Widget\Button` block the layout creates —
   * including blocks that never render, which is why the base differs per page
   * (0 on Stores, 1 on Tax Rates, 3 on Product Attributes). The mock renders
   * those grids with the modern toolbar, so the source hook is carried by the
   * control with the SAME ROLE:
   *
   *   Reset Filter  (grid-filter-reset) -> the chips row's "Clear all"
   *   Search        (grid-filter-apply) -> the panel's "Apply Filters"
   *   massaction Submit                 -> the "Actions" dropdown trigger
   *   Export                            -> the Export dropdown trigger
   *
   * Measured on the source: reset = base, apply = base+1, massaction submit =
   * base+2 on all 40 legacy grids; the Export block sits at its own index, so
   * it is passed separately. Pass `legacyToolbarBase` on any grid whose source
   * counterpart is a legacy grid; leave it null for the UI-component grids
   * (orders, products, customers, …) whose source buttons carry no data-ui-id
   * at all.
   *
   * Only ONE element may carry each value — the mock renders two
   * `[data-action="grid-filter-reset"]` buttons (chips row + panel footer) and
   * tagging both would turn a working `page.click('[data-ui-id=…]')` into a
   * strict-mode violation. The chips-row copy is first in document order, so it
   * is the one that gets the hook. */
  legacyToolbarBase = null,
  // Independent indices for the two blocks that are not always adjacent to the
  // filter pair: the Export block, and the massaction Submit on the handful of
  // legacy grids (Cache Management, Notifications, Index Management) that have
  // a massaction but no filter row at all.
  legacyExportIndex = null,
  legacyMassactionIndex = null,
}) {
  const widgetUiId = n => (
    typeof legacyToolbarBase === 'number' ? `widget-button-${legacyToolbarBase + n}` : undefined
  )
  const uiIdAt = n => (typeof n === 'number' ? `widget-button-${n}` : undefined)
  const exportUiId = uiIdAt(legacyExportIndex)
  const massactionUiId = uiIdAt(legacyMassactionIndex) ?? widgetUiId(2)
  const [rawSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const routeParams = useParams()
  const { state, saveGridBookmark, addMessage } = useApp()

  const pageSizeDefault = defaultPageSizeFor(gridId, defaultPageSize)

  /* DIFF-R67. Magento spells a grid's state into the path as `/sort/<col>/
   * dir/<asc|desc>/page/<n>/limit/<n>/filter/<base64>/` pairs, and the source
   * honours them on every listing whose URL writes the action segment out. The
   * matching route in App.jsx is a splat, so `useParams()['*']` is the segment
   * tail here (and `undefined` on a plain route). Fold it into the query string
   * this grid already runs on; the live query string wins on every key, so the
   * grid's own navigation is never fought by a stale segment. */
  const splat = routeParams['*'] || ''
  // Page components build `columns` inline, so the array identity churns every
  // render; key the memo on the ids instead or `searchParams` never settles and
  // the `[searchParams]` effects below re-fire forever.
  const columnKey = (columns || []).map(c => `${c.id}:${c.filterName || ''}`).join(',')
  const searchParams = useMemo(() => (
    splat ? legacySegmentsToParams(parseLegacySegments(splat), columns, rawSearchParams) : rawSearchParams
    // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [splat, columnKey, rawSearchParams])

  /* The path with the legacy `/sort/…/dir/…/` tail removed. Every control
   * navigates against this, so the first click promotes the decoded state into
   * the query string the rest of the grid speaks and the stale segments do not
   * linger behind it. Identical to `location.pathname` on a plain route. */
  const basePathname = useMemo(() => {
    if (!splat) return location.pathname
    const idx = location.pathname.lastIndexOf(splat)
    if (idx < 0) return location.pathname
    return location.pathname.slice(0, idx).replace(/\/+$/, '/') || '/'
  }, [splat, location.pathname])

  const gridState = useMemo(
    () => parseGridState(searchParams, { defaultSort, defaultPageSize: pageSizeDefault }),
    [searchParams, defaultSort, pageSizeDefault])

  const [openPanel, setOpenPanel] = useState(null) // 'filters' | 'view' | 'columns' | 'export' | null
  // F-05 — which `uiSelect` filter column has its ui-select list expanded.
  const [uiSelectOpen, setUiSelectOpen] = useState(null)
  const [uiSelectQuery, setUiSelectQuery] = useState('')
  const [searchDraft, setSearchDraft] = useState(gridState.search)
  const [filterDraft, setFilterDraft] = useState(gridState.filters)
  const [selected, setSelected] = useState([])
  const [selectAllMatching, setSelectAllMatching] = useState(false)
  const [exportFormat, setExportFormat] = useState('csv')
  const [viewName, setViewName] = useState('')
  const [pageSizeDraft, setPageSizeDraft] = useState(String(gridState.paging.pageSize))
  const wrapRef = useRef(null)

  useEffect(() => { setPageSizeDraft(String(gridState.paging.pageSize)) }, [gridState.paging.pageSize])
  useEffect(() => { setSearchDraft(gridState.search) }, [gridState.search])
  useEffect(() => { setFilterDraft(gridState.filters) }, [searchParams])
  useEffect(() => { setSelected([]); setSelectAllMatching(false) }, [location.search])

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpenPanel(null)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  /* -------------------------------------------------------- column visibility */

  // `filterOnly` columns exist purely to render a filter control the source's
  // grid has without a matching table column — Magento declares several of
  // those as bare `<filterSelect name="store_id">` entries in the filters
  // fieldset (NEW-DOM-205). They stay out of the table and out of the Columns
  // chooser, exactly as on the source.
  const tableColumns = columns.filter(c => !c.filterOnly)
  const allColumnIds = tableColumns.map(c => c.id)
  const visibleIds = gridState.visibleColumns
    || tableColumns.filter(c => c.defaultVisible !== false).map(c => c.id)
  const visibleColumns = tableColumns.filter(c => visibleIds.includes(c.id))

  /* ---------------------------------------------------------------- querying */

  const result = useMemo(
    () => applyGridState(rows, columns, gridState),
    [rows, columns, gridState])

  // The keyword search is a chip too (DIFF-012/BUG-001): Magento's
  // `Magento_Ui/js/grid/search/search` declares `label: $t('Keyword')` and feeds
  // the same `filtersChips` provider the column filters use, so a keyword search
  // renders `Active filters: Keyword: <term> Remove Clear all`.
  const chips = useMemo(
    () => activeFilterChips(columns, gridState.filters, gridState.search),
    [columns, gridState.filters, gridState.search])

  /* ------------------------------------------------------------- navigation */

  function go(patch) {
    navigate({ pathname: basePathname, search: `?${withGridParams(searchParams, patch).toString()}` })
  }

  function applySearch(e) {
    e?.preventDefault()
    go({ search: searchDraft, 'paging[current]': null })
  }

  function applyFilters() {
    const next = withoutFilters(searchParams)
    for (const [field, criterion] of Object.entries(filterDraft)) {
      if (criterion && typeof criterion === 'object') {
        for (const part of ['from', 'to']) {
          if (criterion[part]) next.set(filterParamKey(field, part), criterion[part])
        }
      } else if (criterion !== '' && criterion !== undefined && criterion !== null) {
        next.set(filterParamKey(field), String(criterion))
      }
    }
    setOpenPanel(null)
    navigate({ pathname: basePathname, search: `?${next.toString()}` })
  }

  function clearFilters() {
    setFilterDraft({})
    setOpenPanel(null)
    navigate({ pathname: basePathname, search: `?${withoutFilters(searchParams).toString()}` })
  }

  function removeChip(field) {
    const next = new URLSearchParams(searchParams)
    if (field === SEARCH_CHIP_FIELD) {
      next.delete('search')
      setSearchDraft('')
    } else {
      next.delete(filterParamKey(field))
      next.delete(filterParamKey(field, 'from'))
      next.delete(filterParamKey(field, 'to'))
    }
    next.delete('paging[current]')
    navigate({ pathname: basePathname, search: `?${next.toString()}` })
  }

  /** The strip's "Clear all" drops the keyword too — it clears every chip. */
  function clearAllChips() {
    const next = withoutFilters(searchParams)
    next.delete('search')
    setFilterDraft({})
    setSearchDraft('')
    setOpenPanel(null)
    navigate({ pathname: basePathname, search: `?${next.toString()}` })
  }

  function applyPageSize(value) {
    const n = Number(value)
    if (!n || n < 1) { setPageSizeDraft(String(gridState.paging.pageSize)); return }
    if (n === gridState.paging.pageSize) return
    go({ 'paging[pageSize]': n, 'paging[current]': null })
  }

  function toggleSort(col) {
    if (col.sortable === false) return
    const isCurrent = gridState.sorting.field === col.id
    const direction = isCurrent && gridState.sorting.direction === 'asc' ? 'desc' : 'asc'
    go({ 'sorting[field]': col.id, 'sorting[direction]': direction, 'paging[current]': null })
  }

  function toggleColumn(id) {
    const next = visibleIds.includes(id) ? visibleIds.filter(x => x !== id) : allColumnIds.filter(c => visibleIds.includes(c) || c === id)
    go({ columns: next.join(',') })
  }

  function resetColumns() {
    go({ columns: null })
  }

  /* ------------------------------------------------------------- selection */

  const pageIds = result.rows.map(rowKey)
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.includes(id))
  const selectedCount = selectAllMatching ? result.total : selected.length

  function toggleRow(id) {
    setSelectAllMatching(false)
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  function selectAllOnPage() { setSelectAllMatching(false); setSelected(pageIds) }
  function deselectAll() { setSelectAllMatching(false); setSelected([]) }
  function selectAll() { setSelectAllMatching(true); setSelected(result.allMatching.map(rowKey)) }
  function deselectAllOnPage() {
    setSelectAllMatching(false)
    setSelected(prev => prev.filter(id => !pageIds.includes(id)))
  }

  function runMulticheck(value) {
    setOpenPanel(null)
    if (value === 'all') selectAll()
    else if (value === 'none') deselectAll()
    else if (value === 'page') selectAllOnPage()
    else if (value === 'page-none') deselectAllOnPage()
  }

  function runMassAction(actionId) {
    const action = massActions.find(a => a.id === actionId)
    setOpenPanel(null)
    if (!action) return
    const ids = selectAllMatching ? result.allMatching.map(rowKey) : selected
    if (!ids.length) {
      addMessage('Please select items.', 'error')
      return
    }
    action.onApply(ids, selectAllMatching ? result.allMatching : result.allMatching.filter(r => ids.includes(rowKey(r))))
    deselectAll()
  }

  /* ---------------------------------------------------------------- export */

  function runExport() {
    const cols = visibleColumns
    const base = exportFileName || gridId
    if (exportFormat === 'xml') {
      const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      const body = result.allMatching.map(r => (
        `  <Row>\n${cols.map(c => `    <Cell><Data ss:Type="String">${esc(c.exportValue ? c.exportValue(r) : (c.searchValue ? c.searchValue(r) : r[c.id]))}</Data></Cell>`).join('\n')}\n  </Row>`
      )).join('\n')
      const head = `  <Row>\n${cols.map(c => `    <Cell><Data ss:Type="String">${esc(c.label)}</Data></Cell>`).join('\n')}\n  </Row>`
      downloadFile(`${base}.xml`,
        `<?xml version="1.0"?>\n<Workbook xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">\n<Worksheet ss:Name="${base}">\n<Table>\n${head}\n${body}\n</Table>\n</Worksheet>\n</Workbook>`,
        'application/vnd.ms-excel')
    } else {
      downloadFile(`${base}.csv`, rowsToCsv(cols, result.allMatching), 'text/csv')
    }
    setOpenPanel(null)
  }

  /* ------------------------------------------------------------- bookmarks */

  const bookmarks = state?.gridBookmarks?.[gridId] || {}

  function applyView(name) {
    if (name === '__default__') {
      const next = new URLSearchParams()
      const sid = searchParams.get('sid')
      if (sid) next.set('sid', sid)
      navigate({ pathname: basePathname, search: next.toString() ? `?${next.toString()}` : '' })
      setOpenPanel(null)
      return
    }
    const stored = bookmarks[name]
    if (!stored) return
    const next = new URLSearchParams(stored)
    const sid = searchParams.get('sid')
    if (sid) next.set('sid', sid)
    navigate({ pathname: basePathname, search: `?${next.toString()}` })
    setOpenPanel(null)
  }

  function saveView() {
    const name = viewName.trim()
    if (!name) return
    const params = new URLSearchParams(searchParams)
    params.delete('sid')
    saveGridBookmark(gridId, name, params.toString())
    setViewName('')
    setOpenPanel(null)
    addMessage(`View "${name}" saved.`)
  }

  const currentView = searchParams.get('view') || 'Default View'
  // The source's filter panel is NOT ordered by the table's column order — the
  // UI component renders the `filters` fieldset in its own declared order (on
  // /admin/catalog/product/ that is entity_id, price, qty, updated_at,
  // store_id, name, …, nothing like the column order). `filterOrder` lets a
  // page transcribe the source's order; without it the column order is used.
  const filterableColumns = useMemo(() => {
    const cols = columns.filter(c => c.filterType)
    if (!filterOrder?.length) return cols
    const rank = new Map(filterOrder.map((id, i) => [id, i]))
    return [...cols].sort((a, b) =>
      (rank.has(a.id) ? rank.get(a.id) : rank.size + cols.indexOf(a))
      - (rank.has(b.id) ? rank.get(b.id) : rank.size + cols.indexOf(b)))
  }, [columns, filterOrder])

  return (
    <div className="admin__data-grid-outer-wrap" ref={wrapRef} data-grid-id={gridId}>
      <div className="admin__data-grid-header">

        {/* ---- toolbar row 1: keyword search + Filters / View / Columns / Export ---- */}
        <div className="admin__data-grid-header-row">
          <div className="data-grid-search-control-wrap">
            <form onSubmit={applySearch} role="search">
              <input
                type="text"
                className="admin__control-text data-grid-search-control"
                placeholder={searchPlaceholder}
                value={searchDraft}
                onChange={e => setSearchDraft(e.target.value)}
                aria-label={searchPlaceholder}
              />
              <button type="submit" className="action-submit" title="Search">
                <Icon name="search" size={18} />
              </button>
            </form>
          </div>

          <div className="admin__data-grid-actions-wrap">
            <button
              type="button"
              className={`action-default admin__action-filter${chips.length ? ' _active' : ''}`}
              data-action="grid-filter-expand"
              onClick={() => setOpenPanel(p => p === 'filters' ? null : 'filters')}
              aria-expanded={openPanel === 'filters'}
            >
              <Icon name="filter" size={14} /> <span>Filters</span>
            </button>

            <div className={`admin__data-grid-action-bookmarks${openPanel === 'view' ? ' _active' : ''}`}>
              <button type="button" className="admin__action-dropdown" onClick={() => setOpenPanel(p => p === 'view' ? null : 'view')} aria-expanded={openPanel === 'view'}>
                <Icon name="eye" size={16} /> <span>{currentView}</span> <span className="caret" aria-hidden="true" />
              </button>
              {openPanel === 'view' ? (
                <div className="admin__action-dropdown-menu">
                  <ul className="admin__data-grid-action-bookmarks-menu">
                    <li><button type="button" onClick={() => applyView('__default__')}>Default View</button></li>
                    {Object.keys(bookmarks).map(name => (
                      <li key={name}><button type="button" onClick={() => applyView(name)}>{name}</button></li>
                    ))}
                  </ul>
                  <div className="admin__data-grid-action-bookmarks-save">
                    <label htmlFor={`${gridId}-view-name`}>Save View as</label>
                    <input
                      id={`${gridId}-view-name`}
                      className="admin__control-text"
                      type="text"
                      value={viewName}
                      onChange={e => setViewName(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveView() } }}
                    />
                    <button type="button" className="action-default" onClick={saveView}>Save</button>
                  </div>
                </div>
              ) : null}
            </div>

            <div className={`admin__data-grid-action-columns${openPanel === 'columns' ? ' _active' : ''}`}>
              <button type="button" className="admin__action-dropdown" onClick={() => setOpenPanel(p => p === 'columns' ? null : 'columns')} aria-expanded={openPanel === 'columns'}>
                <Icon name="columns" size={16} /> <span>Columns</span> <span className="caret" aria-hidden="true" />
              </button>
              {openPanel === 'columns' ? (
                <div className="admin__action-dropdown-menu admin__action-dropdown-menu-columns">
                  <div className="admin__action-dropdown-menu-header">
                    <span className="admin__action-dropdown-menu-counter">
                      {visibleColumns.length} out of {tableColumns.length} visible
                    </span>
                    <button type="button" className="action-tertiary" onClick={resetColumns}>Reset</button>
                  </div>
                  <div className="admin__action-dropdown-menu-columns-list">
                    {tableColumns.map(c => (
                      <label key={c.id} className="admin__field-option">
                        <input
                          type="checkbox"
                          className="admin__control-checkbox"
                          checked={visibleIds.includes(c.id)}
                          onChange={() => toggleColumn(c.id)}
                        />
                        <span>{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            {exportable ? (
              <div className={`admin__action-dropdown-wrap admin__data-grid-action-export${openPanel === 'export' ? ' _active' : ''}`}>
                <button type="button" className="admin__action-dropdown" data-ui-id={exportUiId} onClick={() => setOpenPanel(p => p === 'export' ? null : 'export')} aria-expanded={openPanel === 'export'}>
                  <Icon name="export" size={16} /> <span className="admin__action-dropdown-text">Export</span> <span className="caret" aria-hidden="true" />
                </button>
                {openPanel === 'export' ? (
                  <div className="admin__action-dropdown-menu admin__action-dropdown-menu-export">
                    {EXPORT_FORMATS.map(f => (
                      <label key={f.value} className="admin__field-option">
                        <input
                          type="radio"
                          className="admin__control-radio"
                          name={`${gridId}-export-format`}
                          value={f.value}
                          checked={exportFormat === f.value}
                          onChange={() => setExportFormat(f.value)}
                        />
                        <span>{f.label}</span>
                      </label>
                    ))}
                    <button type="button" className="action-default" onClick={runExport}>Export</button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {/* ---- Active filters strip — tasks 676-680 read this element's outerText ----
            MUST stay BEFORE the filters panel (F-06). The source's
            `Magento_Ui/templates/grid/filters/filters.html` renders
            `.admin__data-grid-filters-current` first and the panel second, so on
            the source the FIRST `[data-action="grid-filter-reset"]` in document
            order is the VISIBLE one and `page.click(selector)` — which targets
            match #0 and waits for actionability — succeeds. With the panel
            first, the mock's #0 was the panel's hidden copy and the identical
            call timed out and THREW. Same failure class as NEW-DOM-200. */}
        <div className={`admin__data-grid-filters-current${chips.length ? ' _show' : ''}`}>
          <span className="admin__current-filters-list-label">Active filters:</span>
          <ul className="admin__current-filters-list" data-role="filter-list">
            {chips.map(chip => (
              <li key={chip.field}>
                <span className="admin__current-filters-list-label">{chip.label}:</span>
                <span className="admin__current-filters-list-value">{chip.value}</span>
                <button
                  type="button"
                  className="action-remove"
                  data-action="grid-filter-remove-chip"
                  title={`Remove ${chip.label} filter`}
                  onClick={() => removeChip(chip.field)}
                >
                  <span>Remove</span>
                </button>
              </li>
            ))}
          </ul>
          <div className="admin__current-filters-actions-wrap">
            <button
              type="button"
              className="action-tertiary action-clear"
              data-action={chips.length ? 'grid-filter-reset' : ''}
              data-ui-id={widgetUiId(0)}
              onClick={clearAllChips}
            >Clear all</button>
          </div>
        </div>

        {/* ---- Filters panel ----
            Rendered EAGERLY and hidden with CSS, never conditionally mounted:
            the source's knockout template is in the DOM on cold load with every
            filter control present, so `document.querySelector('[name="cost"]')`
            resolves before anything is clicked (NEW-DOM-205/207). Verified on
            /admin/catalog/product/ — the 30 named controls are identical with
            and without expanding the panel. */}
        <div className={`admin__data-grid-filters-wrap${openPanel === 'filters' ? ' _show' : ''}`} data-part="filter-form">
            <div className="admin__data-grid-filters">
              <div className="admin__form-field-label">Filters</div>
              <div className="admin__data-grid-filters-fields">
                {filterableColumns.map(col => {
                  // The `name` is the contract: every source filter control carries
                  // one and evaluators drive the panel through it. The source's own
                  // `id`s are per-request random, so the mock keeps its stable ids.
                  const fname = filterName(col)
                  /* DOM F-03. The synthesized blank first option is what the
                     source emits for every select filter EXCEPT the ones whose
                     own option list already opens with an explicit all-option —
                     Checkout Agreements' `name="stores"` starts at
                     ("0","All Store Views") with no placeholder in front of it,
                     so `select_option(index=0)` picked "" on the mock and
                     "All Store Views" on the source. Detected from the option
                     list rather than flagged per page: a column that supplies
                     its own all-option and no `emptyOptionLabel` does not get a
                     placeholder. (Grids that do want a labelled placeholder —
                     Search Synonyms' "--" — pass `emptyOptionLabel` and keep
                     it.) */
                  const ownsAllOption = !col.emptyOptionLabel
                    && String(col.options?.[0]?.value) === '0'
                    && /^All\b/.test(String(col.options?.[0]?.label ?? ''))
                  return (
                  <div className="admin__form-field" key={col.id}>
                    <label className="admin__field-label" htmlFor={`filter-${gridId}-${col.id}`}>{col.label}</label>
                    {col.filterType === 'select' ? (
                      <select
                        id={`filter-${gridId}-${col.id}`}
                        name={fname}
                        className="admin__control-select"
                        value={filterDraft[col.id] ?? ''}
                        onChange={e => setFilterDraft(d => ({ ...d, [col.id]: e.target.value }))}
                      >
                        {ownsAllOption ? null : <option value="">{col.emptyOptionLabel || ''}</option>}
                        {(col.options || []).map(o => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    ) : null}
                    {col.filterType === 'select' && col.uiSelect ? (
                      /* F-05 — the source layers Magento's `ui-select` on top of
                         the plain `<select>` for the products grid's Attribute
                         Set filter. Both are live here, as they are in the
                         source: the select stays the model (and stays
                         `select_option`-able), the ui-select is the view that
                         carries `[data-action="advanced-select-search"]` and
                         `[data-action="close-advanced-select"]`. */
                      <div className={`admin__action-multiselect-wrap${uiSelectOpen === col.id ? ' _active' : ''}`}>
                        <div className="admin__action-multiselect-search-wrap">
                          <input
                            id={`uiselect-${gridId}-${col.id}`}
                            type="text"
                            className="admin__control-text admin__action-multiselect-search"
                            placeholder="Search"
                            value={uiSelectQuery}
                            onFocus={() => setUiSelectOpen(col.id)}
                            onChange={e => { setUiSelectQuery(e.target.value); setUiSelectOpen(col.id) }}
                          />
                          <label
                            className="admin__action-multiselect-search-label"
                            data-action="advanced-select-search"
                            htmlFor={`uiselect-${gridId}-${col.id}`}
                          />
                        </div>
                        {/* Mounted unconditionally like the source's knockout
                            template, so `[data-action="close-advanced-select"]`
                            resolves on cold load rather than only while open. */}
                        <div
                          className="admin__action-multiselect-menu"
                          style={{ display: uiSelectOpen === col.id ? undefined : 'none' }}
                        >
                            <ul className="admin__action-multiselect-menu-inner">
                              {(col.options || [])
                                .filter(o => !uiSelectQuery
                                  || String(o.label).toLowerCase().includes(uiSelectQuery.toLowerCase()))
                                .map(o => (
                                  <li key={o.value}>
                                    <button
                                      type="button"
                                      className={`action-menu-item${String(filterDraft[col.id] ?? '') === String(o.value) ? ' _selected' : ''}`}
                                      onClick={() => setFilterDraft(d => ({ ...d, [col.id]: o.value }))}
                                    >{o.label}</button>
                                  </li>
                                ))}
                            </ul>
                            <button
                              type="button"
                              className="action-default"
                              data-action="close-advanced-select"
                              onClick={() => setUiSelectOpen(null)}
                            ><span>Done</span></button>
                        </div>
                      </div>
                    ) : null}
                    {col.filterType === 'range' || col.filterType === 'date' ? (
                      // EVERY source range/date filter is
                      // `<input class="admin__control-text" type="text">` —
                      // Magento never uses type=number or type=date here, and
                      // its datepicker fields only add `_has-datepicker`
                      // (NEW-DOM-200). type=number made Playwright's
                      // `fill()`/`type()` throw outright ("Cannot type text into
                      // input[type=number]"), so this is a hard task failure,
                      // not a cosmetic diff. Numeric/date coercion stays in JS
                      // (utils/gridUtils.js `matchesFilter`).
                      <div className="admin__control-support-text">
                        <input
                          id={`filter-${gridId}-${col.id}`}
                          name={`${fname}[from]`}
                          className={`admin__control-text${col.filterType === 'date' ? ' _has-datepicker' : ''}`}
                          type="text"
                          placeholder="from"
                          value={filterDraft[col.id]?.from ?? ''}
                          onChange={e => setFilterDraft(d => ({ ...d, [col.id]: { ...(d[col.id] || {}), from: e.target.value } }))}
                        />
                        <span className="admin__control-support-text-separator">to</span>
                        <input
                          id={`filter-${gridId}-${col.id}-to`}
                          name={`${fname}[to]`}
                          className={`admin__control-text${col.filterType === 'date' ? ' _has-datepicker' : ''}`}
                          type="text"
                          placeholder="to"
                          value={filterDraft[col.id]?.to ?? ''}
                          onChange={e => setFilterDraft(d => ({ ...d, [col.id]: { ...(d[col.id] || {}), to: e.target.value } }))}
                        />
                      </div>
                    ) : col.filterType === 'select' ? null : (
                      <input
                        id={`filter-${gridId}-${col.id}`}
                        name={fname}
                        className="admin__control-text"
                        type="text"
                        value={filterDraft[col.id] ?? ''}
                        onChange={e => setFilterDraft(d => ({ ...d, [col.id]: e.target.value }))}
                      />
                    )}
                  </div>
                  )
                })}
              </div>
              {/* `data-action` values and the `action-clear` class are the source's
                  own hooks (Magento_Ui grid/filters/filters.html + chips.html);
                  `grid-filter-reset` is only set while filters are active, exactly
                  as the source's `hasPreviews() ? 'grid-filter-reset' : ''`. */}
              <div className="admin__data-grid-filters-footer">
                <button
                  type="button"
                  className="action-tertiary action-clear"
                  data-action={chips.length ? 'grid-filter-reset' : ''}
                  onClick={clearFilters}
                >Clear all</button>
                <button type="button" className="action-default" data-action="grid-filter-cancel" onClick={() => setOpenPanel(null)}>Cancel</button>
                <button type="button" className="action-secondary" data-action="grid-filter-apply" data-ui-id={widgetUiId(1)} onClick={applyFilters}>Apply Filters</button>
              </div>
            </div>
          </div>

        {/* ---- toolbar row 2: mass actions / record count / paging ---- */}
        <div className="admin__data-grid-header-row">
          <div className="admin__data-grid-header-row-left">
            {toolbarLeft}
            {selectable && massActions.length ? (
              // Magento dropdown button, not a native <select> (DIFF-021): the
              // menu items must stay out of the page text until it is opened
              // (DIFF-004).
              <div className={`admin__data-grid-action-select-wrap action-select-wrap${openPanel === 'massactions' ? ' _active' : ''}`}>
                <button
                  type="button"
                  className="action-select"
                  title="Select Items"
                  data-ui-id={massactionUiId}
                  aria-expanded={openPanel === 'massactions'}
                  onClick={() => setOpenPanel(p => p === 'massactions' ? null : 'massactions')}
                >
                  <span>Actions</span>
                </button>
                {openPanel === 'massactions' ? (
                  <div className="action-menu-items">
                    <ul className="action-menu _active">
                      {massActions.map(a => (
                        <li key={a.id}>
                          <span
                            className="action-menu-item"
                            role="button"
                            tabIndex={0}
                            onClick={() => runMassAction(a.id)}
                            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); runMassAction(a.id) } }}
                          >
                            {a.label}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : null}
            {selectedCount ? (
              <span className="admin__data-grid-selected-count">{selectedCount} selected</span>
            ) : null}
            {/* The source does NOT group the record count ("2040 records found"). */}
            <span className="admin__data-grid-records-count">
              <span className="admin__data-grid-records-count-number">{result.total}</span> records found
            </span>
          </div>

          <div className="admin__data-grid-pager-wrap">
            <div className="admin__data-grid-pager">
              {/* Magento `selectmenu`: a text value + a "Select" toggle whose
                  option list is not in the page text until it is opened
                  (DIFF-004). Typing a size and pressing Enter also works, as on
                  the source. */}
              <div className={`selectmenu${openPanel === 'pagesize' ? ' _active' : ''}`}>
                <div className="selectmenu-value">
                  <input
                    type="text"
                    id={`${gridId}-paging-sizes`}
                    aria-labelledby={`${gridId}-per-page-text`}
                    value={pageSizeDraft}
                    onChange={e => setPageSizeDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyPageSize(pageSizeDraft) } }}
                    onBlur={() => applyPageSize(pageSizeDraft)}
                  />
                </div>
                <button
                  type="button"
                  className={`selectmenu-toggle${openPanel === 'pagesize' ? ' _active' : ''}`}
                  aria-expanded={openPanel === 'pagesize'}
                  onClick={() => setOpenPanel(p => p === 'pagesize' ? null : 'pagesize')}
                >
                  <span>Select</span>
                </button>
                {openPanel === 'pagesize' ? (
                  <div className="selectmenu-items _active">
                    <ul>
                      {PAGE_SIZES.map(n => (
                        <li key={n}>
                          <div className="selectmenu-item">
                            <button
                              type="button"
                              className="selectmenu-item-action"
                              onClick={() => { setOpenPanel(null); applyPageSize(n) }}
                            >
                              {n}
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              <span className="admin__data-grid-pager-per-page" id={`${gridId}-per-page-text`}>per page</span>
              <button
                type="button"
                className="action-previous"
                title="Previous Page"
                disabled={result.page <= 1}
                onClick={() => go({ 'paging[current]': result.page - 1 })}
              >
                <span>‹</span>
              </button>
              {/* `data-ui-id="current-page-input"` is the source's stable hook for
                  the page box — its `id` is a knockout counter on both sides and
                  unusable (DOM-018). The source pairs it with `<label for>of N`,
                  which is where the control's accessible name comes from. */}
              <input
                type="number"
                className="admin__control-text"
                data-ui-id="current-page-input"
                id={`${gridId}-current-page`}
                value={result.page}
                onChange={e => go({ 'paging[current]': e.target.value })}
              />
              <label className="admin__data-grid-pager-of" htmlFor={`${gridId}-current-page`}>of {result.totalPages}</label>
              <button
                type="button"
                className="action-next"
                title="Next Page"
                disabled={result.page >= result.totalPages}
                onClick={() => go({ 'paging[current]': result.page + 1 })}
              >
                <span>›</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ---- the table ---- */}
      <div className="admin__data-grid-wrap">
        <table className="data-grid">
          <thead>
            <tr>
              {selectable ? (
                <th className="data-grid-th data-grid-checkbox-cell data-grid-multicheck-cell">
                  <div className="data-grid-checkbox-cell-inner">
                    <input
                      type="checkbox"
                      className="admin__control-checkbox"
                      checked={allPageSelected}
                      onChange={() => allPageSelected ? deselectAll() : selectAllOnPage()}
                      aria-label="Select all on this page"
                    />
                    <div className={`action-select-wrap data-grid-multicheck-select${openPanel === 'multicheck' ? ' _active' : ''}`}>
                      <button
                        type="button"
                        className="action-select"
                        title="Options"
                        aria-expanded={openPanel === 'multicheck'}
                        onClick={() => setOpenPanel(p => p === 'multicheck' ? null : 'multicheck')}
                      >
                        <span>Options</span>
                      </button>
                      {openPanel === 'multicheck' ? (
                        <div className="action-menu-items">
                          <ul className="action-menu _active">
                            {MULTICHECK_ACTIONS.map(a => (
                              <li key={a.value}>
                                <span
                                  className="action-menu-item"
                                  role="button"
                                  tabIndex={0}
                                  onClick={() => runMulticheck(a.value)}
                                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); runMulticheck(a.value) } }}
                                >
                                  {a.label}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </th>
              ) : null}
              {visibleColumns.map(col => {
                const isSorted = gridState.sorting.field === col.id
                const sortClass = isSorted ? ` _${gridState.sorting.direction}end` : ''
                return (
                  <th
                    key={col.id}
                    className={`data-grid-th col-${col.id}${col.sortable === false ? '' : ' _sortable'}${sortClass}${col.className ? ` ${col.className}` : ''}`}
                    onClick={() => toggleSort(col)}
                    role={col.sortable === false ? undefined : 'button'}
                    tabIndex={col.sortable === false ? undefined : 0}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSort(col) } }}
                    aria-sort={isSorted ? (gridState.sorting.direction === 'asc' ? 'ascending' : 'descending') : undefined}
                  >
                    {/* The source draws the sort arrow with a CSS pseudo-element
                        on `._ascend` / `._descend`, so the header's text is the
                        bare label — no ↑/↓ character in innerText (DIFF-007,
                        PARITY-015). */}
                    <span className="data-grid-cell-content">{col.label}</span>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {result.rows.length === 0 ? (
              <tr className="data-grid-tr-no-data">
                <td colSpan={visibleColumns.length + (selectable ? 1 : 0)}>{emptyMessage}</td>
              </tr>
            ) : result.rows.map((row, i) => {
              const id = rowKey(row)
              const href = rowHref ? withSid(rowHref(row), searchParams) : null
              const clickable = Boolean(href || onRowClick)
              // The source puts the record's absolute URL in the row title.
              const title = rowTitle
                ? rowTitle(row)
                : (href ? `${window.location.origin}${href}` : undefined)
              return (
                <tr
                  key={id}
                  className={`${i % 2 === 0 ? '' : '_odd-row'}${clickable ? ' _clickable' : ''}`.trim()}
                  title={title}
                  onClick={href ? () => navigate(href) : (onRowClick ? () => onRowClick(row) : undefined)}
                >
                  {selectable ? (
                    <td className="data-grid-checkbox-cell">
                      {/* Source: <input class="admin__control-checkbox" type="checkbox"
                          data-action="select-row" id="idscheck299" value="299">.
                          `#idscheck<id>` is the canonical way to select one row and
                          `value` is how the DOM reports which rows are selected
                          (DOM-101/DOM-017) — the source carries no aria-label here. */}
                      <input
                        className="admin__control-checkbox"
                        type="checkbox"
                        data-action="select-row"
                        id={`idscheck${id}`}
                        value={String(id)}
                        checked={selected.includes(id)}
                        onChange={() => toggleRow(id)}
                      />
                    </td>
                  ) : null}
                  {visibleColumns.map(col => (
                    <td key={col.id} className={`col-${col.id}${col.className ? ` ${col.className}` : ''}`}>
                      <div className="data-grid-cell-content">
                        {col.render ? col.render(row) : renderDefault(row[col.id])}
                      </div>
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

function renderDefault(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}
