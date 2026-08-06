/**
 * URL-param plumbing and client-side query engine for <AdminGrid>.
 *
 * All grid state lives in the query string so deep links work on first load:
 *   ?search=hollister
 *   &filters[status]=complete&filters[created_at][from]=2023-01-01
 *   &sorting[field]=increment_id&sorting[direction]=desc
 *   &paging[pageSize]=50&paging[current]=2
 *   &columns=increment_id,billing_name,status
 * `sid` is never touched by any of these helpers.
 *
 * The source keeps this state in a client-side bookmark and usually does NOT
 * mirror it into the URL, so this is a strict superset of source behaviour
 * (see ROUTES.md "Query Parameters").
 */

export const PAGE_SIZES = [20, 30, 50, 100, 200]
export const DEFAULT_PAGE_SIZE = 20

/**
 * Per-listing default page size (PARITY-007).
 *
 * Magento persists the per-page selector in each grid's saved `ui_bookmark`
 * row, and the bookmarks that ship inside the WebArena image are NOT all 20:
 * the three high-traffic grids were left on a larger page. Taken from the
 * `pageSize` in the grid config of the captured source HTML
 * (`assets/html/sales-order-grid.html`, `catalog-product-grid.html`,
 * `customer-index.html`) and corroborated by the reference screenshots
 * ("200 per page · 1 of 2", "100 per page · 1 of 1").
 *
 * This matters for behaviour, not just chrome: an agent that sees "70 records
 * found · 1 of 1" does not paginate, where "1 of 4" makes it page through.
 * Every grid not listed here keeps Magento's stock default of 20.
 */
export const GRID_PAGE_SIZES = {
  sales_order_grid: 200,
  product_listing: 200,
  customer_listing: 100,
}

/**
 * The default page size for a listing.
 *
 * GRID_PAGE_SIZES wins over the caller's `defaultPageSize` prop on purpose: it
 * is transcribed from the source's own saved bookmark, so it is the parity
 * answer, and it stays right even for a listing whose page still passes the
 * stock 20. A listing NOT in the map keeps whatever its page asks for.
 */
export function defaultPageSizeFor(gridId, propDefault = null) {
  return GRID_PAGE_SIZES[gridId] || propDefault || DEFAULT_PAGE_SIZE
}

/* ------------------------------------------------------- parse / serialise */

/** Read grid state out of a URLSearchParams, applying the listing's defaults. */
export function parseGridState(searchParams, config = {}) {
  const filters = {}
  for (const [key, value] of searchParams.entries()) {
    const m = key.match(/^filters\[([^\]]+)\](?:\[([^\]]+)\])?$/)
    if (!m || value === '') continue
    const [, field, part] = m
    if (part) {
      filters[field] = { ...(typeof filters[field] === 'object' ? filters[field] : {}), [part]: value }
    } else {
      filters[field] = value
    }
  }

  const pageSize = Number(searchParams.get('paging[pageSize]')) || config.defaultPageSize || DEFAULT_PAGE_SIZE
  const current = Number(searchParams.get('paging[current]')) || 1
  const columnsParam = searchParams.get('columns')

  return {
    search: searchParams.get('search') || '',
    filters,
    sorting: {
      field: searchParams.get('sorting[field]') || config.defaultSort?.field || null,
      direction: searchParams.get('sorting[direction]') || config.defaultSort?.direction || 'asc',
    },
    paging: { pageSize, current },
    visibleColumns: columnsParam ? columnsParam.split(',').filter(Boolean) : null,
  }
}

/** Merge patches into a URLSearchParams copy, dropping empties. `sid` survives. */
export function withGridParams(searchParams, patch) {
  const next = new URLSearchParams(searchParams)
  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === '') next.delete(key)
    else next.set(key, String(value))
  }
  return next
}

/** Remove every `filters[...]` key (the "Clear all" affordance). */
export function withoutFilters(searchParams) {
  const next = new URLSearchParams(searchParams)
  for (const key of [...next.keys()]) if (key.startsWith('filters[')) next.delete(key)
  next.delete('paging[current]')
  return next
}

export function filterParamKey(field, part) {
  return part ? `filters[${field}][${part}]` : `filters[${field}]`
}

/**
 * The `name` attribute a filter control renders with (DOM-100).
 *
 * Every filter input on a source grid carries a `name` — that is the selector
 * an evaluator drives the panel through (`[name="increment_id"]`,
 * `[name="created_at[from]"]`, `[name="store_id"]`). It is the column's field
 * name, which usually equals the column id but not always: the Orders grid
 * displays `store_name` and filters on `store_id` (DOM-104). Columns declare
 * the exception via `filterName`.
 *
 * Kept separate from `filterParamKey`, which names the mock's *URL* param and
 * stays keyed by column id.
 */
export function filterName(col) {
  return col.filterName || col.id
}

/* ------------------------------------------------------------ query engine */

function textOf(value) {
  if (value === null || value === undefined) return ''
  return String(value)
}

/** Keyword search across every column's rendered/searchable text. */
function matchesKeyword(row, columns, keyword) {
  const needle = keyword.toLowerCase()
  return columns.some(col => {
    const raw = col.searchValue ? col.searchValue(row) : row[col.id]
    return textOf(raw).toLowerCase().includes(needle)
  })
}

/**
 * Normalise a date a user typed into a range filter to `YYYY-MM-DD`.
 *
 * The source's range filters are plain `type="text"` inputs backed by a jQuery
 * datepicker (NEW-DOM-200), so what lands in the box is either the datepicker's
 * localized `M/D/YY` / `M/D/YYYY` or whatever the agent typed. Both that and
 * ISO have to compare correctly; anything unparseable is ignored rather than
 * silently excluding every row.
 */
function toIsoDate(input) {
  const s = String(input ?? '').trim()
  if (!s) return ''
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (iso) return `${iso[1]}-${iso[2].padStart(2, '0')}-${iso[3].padStart(2, '0')}`
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/)
  if (us) {
    const year = us[3].length === 2 ? `20${us[3]}` : us[3]
    return `${year}-${us[1].padStart(2, '0')}-${us[2].padStart(2, '0')}`
  }
  return ''
}

function compareDates(value, from, to) {
  const v = toIsoDate(String(value || '').slice(0, 10))
  if (!v) return false
  const f = toIsoDate(from)
  const t = toIsoDate(to)
  if (f && v < f) return false
  if (t && v > t) return false
  return true
}

/** `$1,234.50` / ` 12 ` -> a number; NaN when there is no number in there. */
function toNumber(input) {
  if (typeof input === 'number') return input
  const s = String(input ?? '').replace(/[^0-9.\-]/g, '')
  return s === '' || s === '-' ? NaN : Number(s)
}

function matchesFilter(row, col, criterion) {
  const raw = col.filterValue ? col.filterValue(row) : row[col.id]
  const type = col.filterType || 'text'

  if (criterion && typeof criterion === 'object') {
    // range: { from, to } — numeric or date depending on the column
    const { from, to } = criterion
    if (type === 'date') return compareDates(raw, from, to)
    const n = toNumber(raw)
    if (Number.isNaN(n)) return false
    const lo = toNumber(from)
    const hi = toNumber(to)
    if (!Number.isNaN(lo) && n < lo) return false
    if (!Number.isNaN(hi) && n > hi) return false
    return true
  }

  if (type === 'select') return textOf(raw) === textOf(criterion)
  return textOf(raw).toLowerCase().includes(textOf(criterion).toLowerCase())
}

function defaultCompare(a, b) {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : -1
  if (b === null || b === undefined) return 1
  const na = Number(a), nb = Number(b)
  if (!Number.isNaN(na) && !Number.isNaN(nb) && a !== '' && b !== '') return na - nb
  return String(a).localeCompare(String(b), 'en', { numeric: true, sensitivity: 'base' })
}

/**
 * Run search -> filters -> sort -> page over the row set.
 * Returns { rows, total, totalPages, page } where `rows` is the current page.
 */
export function applyGridState(allRows, columns, gridState) {
  let rows = allRows

  if (gridState.search) {
    rows = rows.filter(r => matchesKeyword(r, columns, gridState.search))
  }

  const activeFilters = Object.entries(gridState.filters || {})
  if (activeFilters.length) {
    rows = rows.filter(row => activeFilters.every(([field, criterion]) => {
      const col = columns.find(c => c.id === field)
      if (!col) return true
      return matchesFilter(row, col, criterion)
    }))
  }

  const { field, direction } = gridState.sorting || {}
  if (field) {
    const col = columns.find(c => c.id === field)
    const dir = direction === 'desc' ? -1 : 1
    const get = col?.sortValue || (r => r[field])
    rows = [...rows].sort((a, b) => dir * (col?.compare ? col.compare(a, b) : defaultCompare(get(a), get(b))))
  }

  const total = rows.length
  const pageSize = gridState.paging.pageSize
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const page = Math.min(Math.max(1, gridState.paging.current), totalPages)
  const start = (page - 1) * pageSize

  return { rows: rows.slice(start, start + pageSize), total, totalPages, page, allMatching: rows }
}

/**
 * Chip descriptors for `.admin__data-grid-filters-current`.
 * Labels use the human column label and the human option label — tasks 676-680
 * string-match e.g. "Status: Suspected Fraud".
 */
/**
 * Pseudo-field the keyword-search chip is keyed by. Not a column id — the
 * source's search component feeds the same chips provider under the label
 * "Keyword", and removing the chip clears `?search=`.
 */
export const SEARCH_CHIP_FIELD = '__search__'

export function activeFilterChips(columns, filters, search = '') {
  const chips = []
  if (search) chips.push({ field: SEARCH_CHIP_FIELD, label: 'Keyword', value: search })
  for (const [field, criterion] of Object.entries(filters || {})) {
    const col = columns.find(c => c.id === field)
    if (!col) continue
    if (criterion && typeof criterion === 'object') {
      const { from, to } = criterion
      const parts = []
      if (from) parts.push(from)
      if (to) parts.push(to)
      chips.push({ field, label: col.label, value: parts.join(' - '), isRange: true })
    } else {
      const opt = col.options?.find(o => String(o.value) === String(criterion))
      chips.push({ field, label: col.label, value: opt ? opt.label : String(criterion) })
    }
  }
  return chips
}

/** Naive CSV serialisation for the Export control. */
export function rowsToCsv(columns, rows) {
  const escape = v => {
    const s = textOf(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const head = columns.map(c => escape(c.label)).join(',')
  const body = rows.map(r => columns.map(c => escape(c.exportValue ? c.exportValue(r) : (c.searchValue ? c.searchValue(r) : r[c.id]))).join(','))
  return [head, ...body].join('\n')
}

/** Trigger a client-side download without touching the network. */
export function downloadFile(filename, content, mime = 'text/csv') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 0)
}
