import React, { useMemo } from 'react'
import LegacyGrid from '../reports/LegacyGrid.jsx'

/* ===========================================================================
 * LegacyAdminGrid — the round-10 global grid-classification bridge.
 *
 * Magento renders admin listings two ways and the mock has to pick the same one
 * per route. Round 10 enumerated EVERY grid route in ROUTES.md and classified it
 * against the live source (`http://localhost:7780/admin`) with the discriminator
 * the round-8/9 test agents established:
 *
 *   LEGACY  — `<thead>` has 2 rows (header + in-table filter row), a `Search`
 *             button, a `Reset Filter` button, records count in
 *             `.admin__control-support-text`, `select#<grid>_page-limit`.
 *   MODERN  — 1-row `<thead>`, keyword search box, Filters panel, records count
 *             in `.admin__data-grid-records-count`.
 *
 * 24 routes came back LEGACY on the source while the mock served the modern
 * `<AdminGrid>`. Their column descriptors were already correct — only the
 * chrome was wrong — so rather than rewriting 24 pages by hand this component
 * takes the SAME props `<AdminGrid>` takes and renders `<LegacyGrid>` from
 * them. Converting a page is then a one-word change at the call site, which is
 * what makes a single-pass, whole-app conversion possible at all: the five
 * previous attempts each rewrote a directory's worth of pages by hand and ran
 * out of round before reaching the next directory.
 *
 * Descriptor translation (AdminGrid → LegacyGrid):
 *   filterType 'text'|'select'|'range'  → filter, same name
 *   filterType 'date'                   → filter 'daterange' (the source's
 *                                         two-input `mage/calendar` range plus
 *                                         the hidden `<name>[locale]`)
 *   filterType null/absent              → filter 'none'
 *   filterName                          → filterId
 * Everything else — render/searchValue/filterValue/sortValue/exportValue/
 * options/sortable/className — is already spelled identically in both.
 * ======================================================================== */

const FILTER_KIND = {
  text: 'text',
  select: 'select',
  range: 'range',
  date: 'daterange',
  store: 'store',
}

export function toLegacyColumns(columns, { filterRow = true, sortable = true } = {}) {
  return columns.map(c => {
    const out = {
      id: c.id,
      label: c.label,
      className: c.className,
      sortable: sortable ? c.sortable : false,
      render: c.render,
      searchValue: c.searchValue,
      filterValue: c.filterValue,
      sortValue: c.sortValue,
      exportValue: c.exportValue,
      options: c.options,
      /* F-01a — the leading `<option value="">` sentinel is not uniform across
       * the source's legacy grids, so `LegacyGrid` takes two descriptor knobs
       * for it and they have to survive the AdminGrid→LegacyGrid translation:
       *   emptyOptionLabel — its visible label (`All Countries` on
       *                      /admin/tax/rate/ `tax_country_id`; `''` elsewhere)
       *   noEmptyOption    — drop it entirely, for the grids whose list starts
       *                      at a real value
       * Spelled identically on both sides, so they pass straight through.
       * `AdminGrid` already documents `emptyOptionLabel` for the modern grids. */
      emptyOptionLabel: c.emptyOptionLabel,
      noEmptyOption: c.noEmptyOption,
      /* DIFF-R102 — `LegacyGrid` keys `data-sort` / `data-column` / `col-<x>`
       * off `sortId || filterId || id`. `filterId` is the right default (on the
       * source, a sortable column's `data-sort` is its own filter control's
       * `name`), so `sortId` is only needed where the two genuinely differ —
       * e.g. /admin/admin/locks/ sorts Last login on `last_login` while the
       * column has no filter control at all to derive it from. */
      sortId: c.sortId,
      numeric: c.numeric,
      filter: filterRow && c.filterType ? (FILTER_KIND[c.filterType] || 'text') : 'none',
    }
    if (c.filterName && c.filterName !== c.id) out.filterId = c.filterName
    return out
  })
}

/**
 * @param {string}   gridId          the source's own grid id — drives every emitted id
 * @param {string}   basePath        route the `/key/value/` state segments hang off.
 *                                   Magento serves the state URLs only under the
 *                                   ACTION segment: `/admin/sales/order_status/index/
 *                                   sort/…` is 200 and `/admin/sales/order_status/
 *                                   sort/…` is 404, so callers pass `…/index`.
 * @param {object[]} columns         AdminGrid-shaped descriptors
 * @param {object[]} massActions     `{ id, label, onApply(ids) }` — omitted when the
 *                                   source grid has no massaction bar
 */
export default function LegacyAdminGrid({
  gridId, basePath, rows, columns,
  rowKey = row => row.entity_id,
  selectable = false, massActions = [],
  rowSelectName = null, rowSelectValue = null, massActionFilter = false,
  massActionDefault = '',
  exportable = false, exportFileName = null, exportPaths = null,
  defaultSort = '', defaultDir = 'asc',
  rowHref = null, pager = true, widgetButtonIds = null,
  emptyMessage = undefined,
  /* `<AdminGrid>` carried the source's legacy `data-ui-id="widget-button-<n>"`
   * hooks as `legacyToolbarBase` (reset = base, apply = base+1, massaction
   * submit = base+2) plus a separate index for the Export block. Now that these
   * pages render the real legacy chrome the same numbers land on the real
   * buttons, so the props are accepted here unchanged and translated — that way
   * a page converts with a one-word component swap and keeps the F-01 hooks. */
  legacyToolbarBase = null, legacyExportIndex = null, legacyMassactionIndex = null,
  /* Three of the source's legacy grids — Notifications, Cache Management and
   * Index Management — render a ONE-row `<thead>` with no filter controls and
   * therefore no `Search` / `Reset Filter`, while still keeping the legacy
   * records count, massaction bar and (for Notifications) the pager. Cache and
   * Index Management additionally have no sortable headers and no pager. */
  filterRow = true, sortableColumns = true,
}) {
  const legacyColumns = useMemo(
    () => toLegacyColumns(columns, { filterRow, sortable: sortableColumns }),
    [columns, filterRow, sortableColumns],
  )
  /* `<AdminGrid>` spells its cold-load sort as `{ field, direction }` and
   * `<LegacyGrid>` as two scalars — accept either so a call site converts
   * without touching the sort it already measured against the source. */
  const sortField = defaultSort && typeof defaultSort === 'object' ? defaultSort.field : defaultSort
  const sortDir = defaultSort && typeof defaultSort === 'object'
    ? (defaultSort.direction || 'asc') : defaultDir
  const wb = useMemo(() => {
    if (widgetButtonIds) return widgetButtonIds
    const out = {}
    if (legacyToolbarBase != null) {
      out.reset = `widget-button-${legacyToolbarBase}`
      out.search = `widget-button-${legacyToolbarBase + 1}`
      out.submit = `widget-button-${legacyToolbarBase + 2}`
    }
    if (legacyMassactionIndex != null) out.submit = `widget-button-${legacyMassactionIndex}`
    if (legacyExportIndex != null) out.export = `widget-button-${legacyExportIndex}`
    return out
  }, [widgetButtonIds, legacyToolbarBase, legacyExportIndex, legacyMassactionIndex])
  return (
    <LegacyGrid
      gridId={gridId}
      basePath={basePath}
      columns={legacyColumns}
      rows={rows}
      rowKey={rowKey}
      defaultSort={sortField || ''}
      defaultDir={sortDir}
      rowHref={rowHref}
      massActions={selectable && massActions.length ? massActions : null}
      rowSelectName={rowSelectName}
      rowSelectValue={rowSelectValue}
      massActionFilter={massActionFilter}
      massActionDefault={massActionDefault}
      exportable={exportable}
      exportFileName={exportFileName || gridId}
      exportPaths={exportPaths}
      pager={pager}
      widgetButtonIds={wb}
      {...(emptyMessage ? { emptyText: emptyMessage } : {})}
    />
  )
}
