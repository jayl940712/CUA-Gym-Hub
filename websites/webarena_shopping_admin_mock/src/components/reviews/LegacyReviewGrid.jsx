import React, { useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { encodeFilter, decodeFilter } from '../reports/reportUtils.js'
import { reviewRank } from './reviewDefaultOrder.js'
import './legacyGrid.css'

/* ===========================================================================
 * The Reviews grid is one of the handful of Magento admin listings that is
 * still a **legacy** `Magento\Backend\Block\Widget\Grid`, not a UI-component
 * grid. Structure transcribed from `assets/html/review-product-index.html`:
 *
 *   - Search / Reset Filter buttons in `.admin__filter-actions`
 *   - a mass-action bar (`#reviewGrid_massaction`) with an Actions select, a
 *     Submit button and a hidden Status select revealed by "Update Status"
 *   - "N records found", a `name="limit"` per-page select and a pager
 *   - `<tr class="data-grid-filters" data-role="filter-form">` **inside the
 *     table head**, one filter control per column, carrying the source's own
 *     `name` attributes: `review_id`, `created_at[from]`, `created_at[to]`,
 *     `status`, `title`, `nickname`, `detail`, `visible_in`, `type`, `name`,
 *     `sku`, plus `massaction`.
 *
 * Agents are trained on that DOM — the previous modern-toolbar rendering had no
 * `[name="detail"]` or `[name="status"]` to reach for and no Visibility filter
 * at all (TEST DIFF-R03). Pressing Enter in any filter cell, or clicking
 * Search, navigates to `<base>/filter/<base64 querystring>/` exactly as the
 * source does; sort/dir/page/limit ride as their own `/key/value/` segments.
 * ======================================================================== */

const STATUS_OPTIONS = [
  { value: '1', label: 'Approved' },
  { value: '2', label: 'Pending' },
  { value: '3', label: 'Not Approved' },
]

/** The source's Type filter is keyed 1/2/3, not by the rendered label. */
const TYPE_OPTIONS = [
  { value: '1', label: 'Administrator' },
  { value: '2', label: 'Customer' },
  { value: '3', label: 'Guest' },
]

const PAGE_SIZES = [20, 30, 50, 100, 200]

const EMPTY_FILTERS = {
  massaction: '', review_id: '', 'created_at[from]': '', 'created_at[to]': '',
  status: '', title: '', nickname: '', detail: '', visible_in: '', type: '',
  name: '', sku: '',
}

/**
 * Magento's legacy grids encode their whole state as `/key/value/` path pairs
 * (`/sort/detail/dir/asc/page/2/limit/50/filter/<base64>/`), which is why the
 * route for this page is a splat. Everything unrecognised — `customerId`,
 * `productId` — is handed back to the caller.
 */
export function parseGridSegments(splat) {
  // Only the leading/trailing empties are dropped — an *interior* empty is a
  // real empty value. The source's own Reset Filter lands on
  // `<base>/filter//internal_reviews//form_key/<hash>/`, and collapsing those
  // would read `internal_reviews` as the filter payload.
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

export default function LegacyReviewGrid({
  gridId = 'reviewGrid', basePath, rows, segments, ret = null, massActions = [], renderCells,
  showStatus = true,
}) {
  const navigate = useNavigate()
  const location = useLocation()

  const applied = useMemo(
    () => ({ ...EMPTY_FILTERS, ...(decodeFilter(segments.filter) || {}) }),
    [segments.filter],
  )
  const [draft, setDraft] = useState(applied)
  // A new filter segment means a new page — resync the inputs with the URL.
  const [lastFilter, setLastFilter] = useState(segments.filter)
  if (lastFilter !== segments.filter) {
    setLastFilter(segments.filter)
    setDraft(applied)
  }

  const sort = segments.sort || 'created_at'
  const dir = segments.dir === 'asc' ? 'asc' : 'desc'
  const limit = PAGE_SIZES.includes(Number(segments.limit)) ? Number(segments.limit) : 20
  const page = Math.max(1, Number(segments.page) || 1)

  const [action, setAction] = useState('')
  const [massStatus, setMassStatus] = useState('')
  const [selected, setSelected] = useState([])

  /* ---------------------------------------------------------- navigation */

  function go(next) {
    const state = {
      sort, dir, page, limit, filter: segments.filter,
      ...next,
    }
    const keep = []
    // Preserve the pre-filter path params the route was entered with.
    for (const key of ['customerId', 'productId']) {
      if (segments[key]) keep.push(`${key}/${encodeURIComponent(segments[key])}`)
    }
    /* Only non-default segments appear, so a plain Search lands on the source's
     * own `<base>/filter/<base64>/` and not a fully-spelled-out state URL —
     * but `sort` and `dir` travel as a PAIR. Driving the live grid gives
     * `…/index/sort/nickname/dir/desc/` on the first header click and
     * `…/index/sort/nickname/dir/asc/` on the second, so the source spells
     * `dir` even when it matches the grid's default direction. */
    if (String(state.sort ?? '') !== 'created_at' || String(state.dir ?? '') !== 'desc') {
      if (state.sort) {
        keep.push(`sort/${encodeURIComponent(state.sort)}`)
        keep.push(`dir/${encodeURIComponent(state.dir || 'desc')}`)
      }
    }
    const DEFAULTS = { page: 1, limit: 20, filter: '' }
    for (const key of ['page', 'limit', 'filter']) {
      const v = state[key]
      if (v === undefined || v === null || v === '') continue
      if (String(v) === String(DEFAULTS[key])) continue
      keep.push(`${key}/${encodeURIComponent(v)}`)
    }
    navigate({ pathname: `${basePath}/${keep.join('/')}/`, search: location.search })
  }

  const doFilter = () => {
    const payload = {}
    for (const [k, v] of Object.entries(draft)) if (v !== '' && v != null) payload[k] = v
    go({ filter: Object.keys(payload).length ? encodeFilter(payload) : '', page: 1 })
  }
  const resetFilter = () => {
    setDraft(EMPTY_FILTERS)
    go({ filter: '', page: 1 })
  }
  const setSort = column => {
    if (sort === column) go({ dir: dir === 'asc' ? 'desc' : 'asc', page: 1 })
    else go({ sort: column, dir: 'asc', page: 1 })
  }

  /* ------------------------------------------------------------ the data */

  const filtered = useMemo(() => {
    let out = rows
    const f = applied
    if (f.review_id) out = out.filter(r => contains(r.review_id, f.review_id))
    if (f['created_at[from]']) out = out.filter(r => String(r.created_at) >= toIso(f['created_at[from]']))
    if (f['created_at[to]']) out = out.filter(r => String(r.created_at) <= `${toIso(f['created_at[to]'])} 23:59:59`)
    if (f.status) out = out.filter(r => String(r.status_id) === String(f.status))
    if (f.title) out = out.filter(r => contains(r.title, f.title))
    if (f.nickname) out = out.filter(r => contains(r.nickname, f.nickname))
    if (f.detail) out = out.filter(r => contains(r.detail, f.detail))
    if (f.visible_in) out = out.filter(r => String(r.store_id ?? 1) === String(f.visible_in))
    if (f.type) {
      // 1 Administrator · 2 Customer · 3 Guest, matching the source's option values.
      out = out.filter(r => String(typeCode(r)) === String(f.type))
    }
    if (f.name) out = out.filter(r => contains(r.product_name, f.name))
    if (f.sku) out = out.filter(r => contains(r.sku, f.sku))
    if (f.massaction === '1') out = out.filter(r => selected.includes(String(r.review_id)))
    else if (f.massaction === '0') out = out.filter(r => !selected.includes(String(r.review_id)))
    return out
  }, [rows, applied, selected])

  /* DIFF-R104 — sorting is STATE, and the `Created` column is decided by ties.
   *
   * The grid's cold-load sort is `created_at DESC`, but the 351 seeded reviews
   * carry only 16 distinct timestamps, so `created_at` fixes barely any of the
   * order — the source's page 2 onward is almost entirely the tie order MySQL's
   * filesort leaves behind (see `reviewDefaultOrder.js` for the measurement).
   * Comparing `created_at` alone left the ties in review_id order, so page 1
   * agreed with the source on its first five rows and then diverged, and every
   * later page listed a different record set than the same URL on the source.
   *
   * `reviewRank()` is the source's own measured order, so it is used as the
   * whole comparison for `created_at` (it is non-increasing in `created_at` by
   * construction) and ascending simply reverses it.
   *
   * The other columns break ties by review_id, and the DIRECTION of that
   * tie-break is a per-column fact of the source, measured page by page:
   *
   *   sort/dir              source's first ids            tie order
   *   sku/asc               1, 2, 3, 4 …                  review_id ASC
   *   sku/desc              340, 341 · 337, 338, 339      review_id ASC
   *   name/desc             80, 81 · 344, 345, 346        review_id ASC
   *   name/asc              223, 224 · 67, 68, 69         review_id ASC
   *   status/asc            1, 2, 3, 4 …                  review_id ASC
   *   status/desc  page 2   331, 330, 329, 328 …          review_id DESC
   *   type/asc              1, 2, 3, 4 …                  review_id ASC
   *   type/desc             351 · 353, 352, 349, 347      review_id DESC
   *
   * `status` and `type` are the two that follow the sort direction, and they are
   * also the two the source can serve straight out of an index — `review` has
   * `REVIEW_STATUS_ID`, and Magento's grid indexes the Type column on
   * `customer_id` rather than on a rendered label. A backward index scan hands
   * back equal keys in descending PK order, which is exactly the shape measured.
   * Everything else goes through a filesort over the joined rows and comes back
   * in PK order regardless of direction.
   *
   * Type also has to sort on `customer_id`, not on the 1/2/3 code the filter
   * uses: `sort/type/dir/desc/` opens on review 351 (the one row with a
   * customer) and `dir/asc` puts it last, i.e. MySQL's NULLs-first ordering on
   * `customer_id`, not `Administrator < Customer < Guest`.
   */
  const sorted = useMemo(() => {
    const sign = dir === 'asc' ? 1 : -1
    if (!sort || sort === 'created_at') {
      // The captured order IS `Created ↓`, so rank ascending is `dir=desc`.
      const rankSign = dir === 'asc' ? -1 : 1
      return [...filtered].sort((a, b) => rankSign * (reviewRank(a.review_id) - reviewRank(b.review_id)))
    }
    /* MySQL compares these columns under `utf8_general_ci`, i.e. case-insensitively.
     * Raw JS `<` is ASCII-ordered, so every uppercase letter sorted before every
     * lowercase one and the two lowercase nicknames in the seed landed at the
     * wrong end: `sort/nickname/dir/desc/` opened `seam miller · customer · Yan`
     * on the mock where the source opens `Yan · Xavier · Wyatt`. Lowercasing the
     * key is what `components/reports/LegacyGrid.jsx` already does. */
    const key = {
      review_id: r => Number(r.review_id),
      status: r => Number(r.status_id),
      title: r => String(r.title || '').toLowerCase(),
      nickname: r => String(r.nickname || '').toLowerCase(),
      detail: r => String(r.detail || '').toLowerCase(),
      // NULL customer_id sorts before every real one ascending, after it descending.
      type: r => (r.customer_id == null ? -1 : Number(r.customer_id)),
      name: r => String(r.product_name || '').toLowerCase(),
      sku: r => String(r.sku || '').toLowerCase(),
    }[sort]
    if (!key) return filtered
    const tieSign = sort === 'status' || sort === 'type' ? sign : 1
    return [...filtered].sort((a, b) => {
      const av = key(a)
      const bv = key(b)
      if (av < bv) return -sign
      if (av > bv) return sign
      return tieSign * (Number(a.review_id) - Number(b.review_id))
    })
  }, [filtered, sort, dir])

  const pages = Math.max(1, Math.ceil(sorted.length / limit))
  const current = Math.min(page, pages)
  const visible = sorted.slice((current - 1) * limit, current * limit)

  /* -------------------------------------------------------- mass actions */

  const toggle = id => setSelected(prev => (
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  ))

  /** F-07 — the source's `#<grid>_massaction-mass-select` row-selection helper. */
  function massSelect(mode) {
    const visibleIds = visible.map(r => String(r.review_id))
    const allIds = sorted.map(r => String(r.review_id))
    if (mode === 'selectAll') setSelected(allIds)
    else if (mode === 'unselectAll') setSelected([])
    else if (mode === 'selectVisible') setSelected(prev => [...new Set([...prev, ...visibleIds])])
    else if (mode === 'unselectVisible') setSelected(prev => prev.filter(id => !visibleIds.includes(id)))
  }

  function submitMassAction() {
    const chosen = massActions.find(a => a.id === action)
    if (!chosen || !selected.length) return
    chosen.onApply(selected, { status: massStatus })
    setSelected([])
    setAction('')
    setMassStatus('')
  }

  const filterCell = (name, extra = {}) => (
    <input type="text" name={name} id={`${gridId}_filter_${name}`}
      value={draft[name] ?? ''} className="input-text admin__control-text no-changes"
      onChange={e => setDraft(d => ({ ...d, [name]: e.target.value }))}
      onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); doFilter() } }}
      {...extra} />
  )

  const th = (column, label, className = '') => (
    <th data-sort={column} data-direction={dir}
      className={`data-grid-th _sortable ${sort === column ? (dir === 'asc' ? '_ascend' : '_descend') : 'not-sort'} ${className}`.trim()}
      onClick={() => setSort(column)}>
      <span>{label}</span>
    </th>
  )

  return (
    <div id={gridId} data-grid-id={gridId}>
      <div className="admin__data-grid-header admin__data-grid-toolbar">
        <div className="admin__data-grid-header-row">
          <div className="admin__filter-actions">
            {/* F-07. Measured live on `/review/product/index/` and `/pending/`:
              * Reset Filter `widget-button-3`, Search `widget-button-4`,
              * Submit `widget-button-5` — Magento's widget counter, identical on
              * both review routes. */}
            <button title="Search" type="button" data-action="grid-filter-apply"
              data-ui-id="widget-button-4"
              className="action-default scalable action-secondary" onClick={doFilter}>
              <span>Search</span>
            </button>
            <button title="Reset Filter" type="button" data-action="grid-filter-reset"
              data-ui-id="widget-button-3"
              className="action-default scalable action-reset action-tertiary" onClick={resetFilter}>
              <span>Reset Filter</span>
            </button>
          </div>
        </div>

        <div className="admin__data-grid-header-row _massaction">
          <div id={`${gridId}_massaction`} className="admin__grid-massaction">
            <div className="admin__grid-massaction-form">
              <select id={`${gridId}_massaction-select`}
                className="required-entry local-validation admin__control-select"
                value={action} onChange={e => setAction(e.target.value)}>
                <option className="admin__control-select-placeholder" value="">Actions</option>
                {massActions.map(a => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
              {/* DOM-016. The source renders the massaction additional Status
                * select on cold load and only *hides* the row until "Update
                * Status" is picked, so `#status` resolves from the moment the
                * grid paints. Source:
                *   <select id="status" name="status"
                *     class="required-entry absolute-advice select admin__control-select"
                *     data-ui-id="widget-grid-massaction-item-additional-defaultadditional-0-element-select-status">
                *   <option value=""></option><option value="1">Approved</option>
                *   <option value="2">Pending</option><option value="3">Not Approved</option>
                * Rendering it conditionally made `document.querySelector('#status')`
                * null and left one `[name="status"]` where the source has two. */}
              <span className="field-row"
                style={action === 'update_status' ? undefined : { display: 'none' }}>
                <label className="label admin__field-label" htmlFor="status"><span>Status</span></label>
                <select id="status" name="status"
                  className="required-entry absolute-advice select admin__control-select"
                  data-ui-id="widget-grid-massaction-item-additional-defaultadditional-0-element-select-status"
                  value={massStatus} onChange={e => setMassStatus(e.target.value)}>
                  <option value="" />
                  {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </span>
              <button title="Submit" type="button" className="action-default scalable"
                data-ui-id="widget-button-5"
                onClick={submitMassAction}>
                <span>Submit</span>
              </button>
            </div>
            {/* F-07. The source ships a *second* select beside the Actions one —
              * the row-selection helper. Its options are `selectAll`,
              * `unselectAll`, `selectVisible`, `unselectVisible` inside an
              * `<optgroup label="Mass Actions">`, with a disabled blank option
              * selected. Without it `select_option('#reviewGrid_massaction-mass-select',
              * 'selectAll')` — the natural way to select every row — has nothing
              * to target. */}
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

          <div className="admin__control-support-text _records-found">
            <span id={`${gridId}-total-count`} data-ui-id="adminhtml-grid-total-count">{sorted.length}</span>
            {' '}records found
            <span id={`${gridId}_massaction-count`}
              className={`mass-select-info${selected.length ? '' : ' _empty'}`}>
              <strong data-role="counter">{selected.length}</strong>
              {' '}<span>selected</span>
            </span>
          </div>

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
        </div>
      </div>

      <div className="admin__data-grid-wrap admin__data-grid-wrap-static">
        <table className="data-grid" id={`${gridId}_table`}>
          <thead>
            <tr>
              <th data-column="massaction" className="data-grid-th col-select col-massaction">&nbsp;</th>
              {th('review_id', 'ID', 'col-id col-review_id')}
              {th('created_at', 'Created', 'col-date col-date-min-width col-created_at')}
              {/* DIFF-R69 / F-06. Pending Reviews has **no** Status column on the
                * source — every row there is Pending by definition — so the mock's
                * extra one shifted every cell after `Created` one place right, and
                * its filter `<select name="status">` made `[name="status"]` resolve
                * to 2 elements (the massaction Status select is the other), which
                * is a Playwright strict-mode violation that fails the whole run.
                * Source header, `/review/product/pending/`: ☐ · ID · Created ·
                * Title · Nickname · Review · Visibility · Type · Product · SKU ·
                * Action (11). `/review/product/index/` does carry Status (12). */}
              {showStatus ? th('status', 'Status', 'col-status') : null}
              {th('title', 'Title', 'col-title')}
              {th('nickname', 'Nickname', 'col-name col-nickname')}
              {th('detail', 'Review', 'col-detail')}
              <th className="data-grid-th no-link col-visible_in"><span>Visibility</span></th>
              {th('type', 'Type', 'col-type')}
              {th('name', 'Product', 'col-name')}
              {th('sku', 'SKU', 'col-sku')}
              <th className="data-grid-th no-link col-action"><span>Action</span></th>
            </tr>
            <tr className="data-grid-filters" data-role="filter-form">
              <td data-column="massaction" className="col-select col-massaction">
                <span className="head-massaction">
                  <select name="massaction" id={`${gridId}_filter_massaction`}
                    className="no-changes admin__control-select"
                    value={draft.massaction} onChange={e => setDraft(d => ({ ...d, massaction: e.target.value }))}>
                    <option value="">Any</option>
                    <option value="1">Yes</option>
                    <option value="0">No</option>
                  </select>
                </span>
              </td>
              <td data-column="review_id" className="col-id col-review_id">{filterCell('review_id')}</td>
              <td data-column="created_at" className="col-date col-date-min-width col-created_at">
                <div className="range" id={`${gridId}_filter_created_at_range`}>
                  <div className="range-line date">{filterCell('created_at[from]', { placeholder: 'From' })}</div>
                  <div className="range-line date">{filterCell('created_at[to]', { placeholder: 'To' })}</div>
                </div>
                <input type="hidden" name="created_at[locale]" value="en_US" readOnly />
              </td>
              {showStatus ? (
                <td data-column="status" className="col-status">
                  <select name="status" id={`${gridId}_filter_status`} className="no-changes admin__control-select"
                    value={draft.status} onChange={e => setDraft(d => ({ ...d, status: e.target.value }))}>
                    <option value="" />
                    {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </td>
              ) : null}
              <td data-column="title" className="col-title">{filterCell('title')}</td>
              <td data-column="nickname" className="col-name col-nickname">{filterCell('nickname')}</td>
              <td data-column="detail" className="col-detail">{filterCell('detail')}</td>
              <td data-column="visible_in" className="no-link col-visible_in">
                <select className="admin__control-select" name="visible_in"
                  value={draft.visible_in} onChange={e => setDraft(d => ({ ...d, visible_in: e.target.value }))}>
                  <option value="" />
                  <optgroup label="Main Website" />
                  <optgroup label="    Main Website Store">
                    <option value="1">&nbsp;&nbsp;&nbsp;&nbsp;Default Store View</option>
                  </optgroup>
                </select>
              </td>
              <td data-column="type" className="col-type">
                <select name="type" id={`${gridId}_filter_type`} className="no-changes admin__control-select"
                  value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value }))}>
                  <option value="" />
                  {TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </td>
              <td data-column="name" className="col-name">{filterCell('name')}</td>
              <td data-column="sku" className="col-sku">{filterCell('sku')}</td>
              <td data-column="action" className="no-link col-action">&nbsp;</td>
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr className="data-grid-tr-no-data even">
                <td className="empty-text" colSpan={showStatus ? 12 : 11}>We couldn&apos;t find any records.</td>
              </tr>
            ) : visible.map((r, i) => (
              <tr key={r.review_id} className={i % 2 === 0 ? 'even' : ''}>
                <td className="col-select col-massaction data-grid-checkbox-cell">
                  <label className="data-grid-checkbox-cell-inner">
                    {/* DOM-017 / NEW-DOM-208. The source emits
                      * `id="id_<n>"` on every row checkbox, but `<n>` is a fresh
                      * `mt_rand()` on each page load (`id_692`/`id_91` for the
                      * same review across two loads), so an exact match is not
                      * reachable. We keep the source's `id_` shape and derive
                      * `<n>` from the review id, which is stable across reloads
                      * and unique per row. */}
                    <input type="checkbox" name="reviews" data-role="select-row" value={r.review_id}
                      id={`id_${r.review_id}`}
                      className="admin__control-checkbox"
                      checked={selected.includes(String(r.review_id))}
                      onChange={() => toggle(String(r.review_id))} />
                  </label>
                </td>
                {renderCells(r, ret)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function typeCode(r) {
  if (r.customer_id) return 2
  if (Number(r.store_id) === 0) return 1
  return 3
}

/** `M/D/YY` (the source's admin locale) → the ISO prefix the seed stores. */
function toIso(value) {
  const m = String(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return String(value)
  const year = m[3].length === 2 ? `20${m[3]}` : m[3]
  return `${year}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`
}

export { STATUS_OPTIONS, TYPE_OPTIONS, typeCode }
