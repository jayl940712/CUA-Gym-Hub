/**
 * Magento legacy grid-state URL segments (DIFF-R67).
 *
 * ## The source's rule, measured
 *
 * A Magento admin URL is `/<admin>/<front>/<controller>/<action>/<k>/<v>/…`.
 * Every trailing `/key/value/` pair becomes a request param, so a grid spells
 * its whole state into the path:
 *
 *     /admin/search/term/report/sort/popularity/dir/desc/page/1/limit/30/filter/<base64>/
 *
 * The pairs are only reachable when the **action segment is written out**. Drop
 * it and the first pair slides into the action slot and the source 404s — which
 * is why `/admin/sales/order_status/sort/label/dir/desc/` is a 404 on the source
 * while `/admin/sales/order_status/index/sort/label/dir/desc/` is a 200 with the
 * sort applied. Both were verified against the live container, along with ~30
 * other grids; the mock must reproduce the 404 as faithfully as the 200.
 *
 * `filter/<v>` carries a base64'd query string of the grid's own filter `name`
 * attributes (`cXVlcnlfdGV4dD1uaWtl` → `query_text=nike`), matching the
 * `data-role="filter-form"` row rendered inside `<thead>`.
 *
 * ## Where this is used
 *
 * `components/reports/LegacyGrid.jsx` and `components/reviews/LegacyReviewGrid.jsx`
 * parse the segments themselves and drive the URL from every control. The
 * UI-component `<AdminGrid>` keeps its state in the query string, so it maps the
 * segments onto its own params via `legacySegmentsToParams()` — a cold deep link
 * therefore lands on the page *with the state applied* instead of 404ing.
 */

/** `sort/qty/dir/asc/` → `{ sort: 'qty', dir: 'asc' }`. Odd trailing key → `''`. */
export function parseLegacySegments(splat) {
  const parts = String(splat || '').split('/').filter(Boolean)
  const out = {}
  for (let i = 0; i < parts.length; i += 2) {
    out[decodeURIComponent(parts[i])] = decodeURIComponent(parts[i + 1] ?? '')
  }
  return out
}

/** base64'd query string → `{ name: value }`. Tolerates missing `=` padding. */
export function decodeLegacyFilter(segment) {
  if (!segment) return null
  let raw
  try {
    raw = atob(decodeURIComponent(segment).replace(/-/g, '+').replace(/_/g, '/'))
  } catch (e) {
    raw = decodeURIComponent(segment)
  }
  const qs = new URLSearchParams(raw)
  const out = {}
  for (const [k, v] of qs.entries()) out[k] = v
  return out
}

const PAGE_SIZES = [20, 30, 50, 100, 200]

/**
 * Overlay legacy path-segment state onto an `<AdminGrid>` query string.
 *
 * Returns a **new** URLSearchParams. Real query params always win: a URL that
 * carries both `/sort/name/` and `?sorting[field]=sku` is the mock's own
 * navigation writing over a stale segment, and the query string is the live one.
 *
 * Segments naming something this grid does not have (a column it never renders,
 * a filter field it has no control for) are dropped rather than applied — the
 * source ignores them too, and inventing a filter for an unknown field would
 * silently empty the grid.
 *
 * @param {object} segments  from `parseLegacySegments`
 * @param {object[]} columns `<AdminGrid>` column descriptors
 * @param {URLSearchParams} searchParams the live query string
 */
export function legacySegmentsToParams(segments, columns, searchParams) {
  const next = new URLSearchParams(searchParams)
  if (!segments || !Object.keys(segments).length) return next

  const byId = new Map()
  for (const c of columns || []) {
    byId.set(c.id, c)
    if (c.filterName && !byId.has(c.filterName)) byId.set(c.filterName, c)
  }
  const setIfAbsent = (key, value) => { if (!next.has(key)) next.set(key, String(value)) }

  if (segments.sort && byId.has(segments.sort)) {
    setIfAbsent('sorting[field]', byId.get(segments.sort).id)
    setIfAbsent('sorting[direction]', segments.dir === 'desc' ? 'desc' : 'asc')
  }
  if (PAGE_SIZES.includes(Number(segments.limit))) setIfAbsent('paging[pageSize]', Number(segments.limit))
  if (Number(segments.page) > 0) setIfAbsent('paging[current]', Number(segments.page))

  const filter = decodeLegacyFilter(segments.filter)
  for (const [rawKey, value] of Object.entries(filter || {})) {
    if (value === '' || value == null) continue
    // `qty[from]` / `created_at[to]` — the source's range and date-range fields.
    const m = rawKey.match(/^([^[]+)\[([^\]]+)\]$/)
    const field = m ? m[1] : rawKey
    const part = m ? m[2] : null
    // `<field>[locale]` is the calendar widget's own hidden input, not a filter.
    if (part === 'locale') continue
    const col = byId.get(field)
    if (!col) continue
    setIfAbsent(part ? `filters[${col.id}][${part}]` : `filters[${col.id}]`, value)
  }
  return next
}
