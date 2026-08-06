import React, { useMemo } from 'react'
import PageShell from '../../components/layout/PageShell.jsx'
import LegacyAdminGrid from '../../components/grid/LegacyAdminGrid.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useSidNavigate } from '../../utils/navigation.js'
import { STATE_TITLES } from '../../components/sales/orderStatusHelpers.js'
import '../../components/sales/sales.css'

/* ROUTES.md row 38 — /admin/sales/order_status/
 * Columns and the state-title format (`processing[Processing]`) are transcribed
 * from assets/html/sales-order-status.html.
 *
 * The source renders Unassign as an `<a data-post>` POSTing
 * `{status, state}` to /admin/sales/order_status/unassign/ and redirecting back
 * to this grid; the mock does the same mutation through the context so it
 * reaches saveState() and shows in /go state_diff.
 */

/* DIFF-R75. The source's cold-load order is the `sales_order_status_state`
 * join's natural order followed by the statuses assigned to no state — not any
 * sort of a rendered column, so it cannot be derived and is transcribed from the
 * live grid (`/admin/sales/order_status/`, 13 rows, read 2026-08-06). Keyed by
 * `status:state` because `fraud` appears twice, once per state it is assigned
 * to. Anything the seed holds that is not in this list keeps its seed position
 * at the end. */
const SOURCE_ROW_ORDER = [
  'fraud:processing',
  'processing:processing',
  'pending_payment:pending_payment',
  'payment_review:payment_review',
  'fraud:payment_review',
  'pending:new',
  'holded:holded',
  'complete:complete',
  'closed:closed',
  'canceled:canceled',
  'paypal_canceled_reversal:',
  'pending_paypal:',
  'paypal_reversed:',
]

export default function OrderStatusGrid() {
  const { state, addMessage, updateCollectionItem } = useApp()
  const navigate = useSidNavigate()
  const rows = useMemo(() => {
    const rank = r => {
      const i = SOURCE_ROW_ORDER.indexOf(`${r.status}:${r.state || ''}`)
      return i === -1 ? SOURCE_ROW_ORDER.length : i
    }
    return [...(state.orderStatuses || [])]
      .map((r, i) => [r, i])
      .sort((a, b) => (rank(a[0]) - rank(b[0])) || (a[1] - b[1]))
      .map(([r]) => r)
  }, [state.orderStatuses])

  const columns = [
    { id: 'label', label: 'Status', filterType: 'text' },
    { id: 'status', label: 'Status Code', filterType: 'text' },
    {
      /* F-05 — the source's option order on this grid is No first
       * (`'', No(0), Yes(1)`), the reverse of the mock's. */
      id: 'is_default', label: 'Default Status', filterType: 'select',
      options: [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }],
      render: r => (Number(r.is_default) ? 'Yes' : 'No'),
      searchValue: r => (Number(r.is_default) ? 'Yes' : 'No'),
      filterValue: r => String(Number(r.is_default) ? 1 : 0),
    },
    {
      id: 'visible_on_front', label: 'Visible On Storefront', filterType: 'select',
      options: [{ value: '0', label: 'No' }, { value: '1', label: 'Yes' }],
      render: r => (Number(r.visible_on_front) ? 'Yes' : 'No'),
      searchValue: r => (Number(r.visible_on_front) ? 'Yes' : 'No'),
      filterValue: r => String(Number(r.visible_on_front) ? 1 : 0),
    },
    {
      id: 'state', label: 'State Code and Title', filterType: 'text',
      render: r => (r.state ? `${r.state}[${STATE_TITLES[r.state] || r.label}]` : ''),
      searchValue: r => (r.state ? `${r.state}[${STATE_TITLES[r.state] || r.label}]` : ''),
    },
    {
      id: 'action', label: 'Action', sortable: false, className: 'col-actions',
      render: r => (r.state ? (
        <a
          href="#"
          onClick={e => {
            e.preventDefault()
            updateCollectionItem('orderStatuses', 'status', r.status, { state: null, is_default: 0 })
            addMessage('You have unassigned the order status.')
          }}
        >
          Unassign
        </a>
      ) : ''),
      exportValue: r => (r.state ? 'Unassign' : ''),
    },
  ]

  const actions = (
    <div className="page-actions-buttons">
      <button
        type="button"
        /* F-07 — the source's id is `assign`, with
         * `data-ui-id="sales-order-status-grid-container-assign-button"`. */
        id="assign"
        data-ui-id="sales-order-status-grid-container-assign-button"
        className="action-default scalable add"
        title="Assign Status to State"
        onClick={() => navigate('/admin/sales/order_status/assign/')}
      >
        <span>Assign Status to State</span>
      </button>
      <button
        type="button"
        id="add"
        data-ui-id="sales-order-status-grid-container-add-button"
        className="action-default scalable add primary"
        title="Create New Status"
        onClick={() => navigate('/admin/sales/order_status/new/')}
      >
        <span>Create New Status</span>
      </button>
    </div>
  )

  return (
    <PageShell title="Order Status" documentTitle="Order Status" actions={actions}>
      {/* Round 10 · DIFF-R61. The source serves this as a LEGACY grid — 2-row
        * `<thead>` with the in-table filter row, `Search` + `Reset Filter`,
        * `select#sales_order_status_grid_page-limit`, the records count in
        * `.admin__control-support-text` — and ships NO Export control here
        * (the source toolbar is Assign Status to State · Create New Status ·
        * Search · Reset Filter · pager). State rides as `/key/value/` path
        * pairs under the ACTION segment: the source 404s
        * `/admin/sales/order_status/sort/…` and serves
        * `/admin/sales/order_status/index/sort/…`, so that is the basePath. */}
      <LegacyAdminGrid
        gridId="sales_order_status_grid"
        basePath="/admin/sales/order_status/index"
        rows={rows}
        columns={columns}
        rowKey={r => r.status + ':' + (r.state || '')}
        exportable={false}
      />
    </PageShell>
  )
}
