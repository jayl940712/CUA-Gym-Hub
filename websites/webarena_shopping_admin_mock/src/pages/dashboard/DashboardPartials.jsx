import React, { useMemo } from 'react'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { getCustomers, getOrders } from '../../utils/selectors.js'
import { formatCurrency, formatInt } from '../../utils/formatters.js'
import '../../components/system/system.css'

/**
 * ROUTES rows 4-6 — the dashboard's AJAX tab partials:
 *
 *   /admin/admin/dashboard/productsViewed/   "Most Viewed Products"
 *   /admin/admin/dashboard/customersMost/    "Customers" (most orders)
 *   /admin/admin/dashboard/customersNewest/  "New Customers"
 *
 * In the source these are fragment endpoints the dashboard fetches when a tab is
 * clicked; hitting the URL directly returns just the tab's table. The mock
 * renders that same table in the admin shell so a deep link resolves on a cold
 * load, and each one links back to the full dashboard.
 *
 * The row maths mirrors Dashboard.jsx: order counts / averages / totals are
 * computed over `sales_order` grouped by `customer_id`.
 */

function useCustomerRows() {
  const { state } = useApp()
  return useMemo(() => {
    const stats = new Map()
    for (const o of getOrders(state)) {
      if (o.customer_id === null || o.customer_id === undefined) continue
      const s = stats.get(o.customer_id) || { count: 0, sum: 0 }
      s.count += 1
      s.sum += Number(o.grand_total || 0)
      stats.set(o.customer_id, s)
    }
    return getCustomers(state).map(c => {
      const s = stats.get(c.entity_id) || { count: 0, sum: 0 }
      return {
        id: c.entity_id,
        name: c.name || `${c.firstname} ${c.lastname}`,
        created_at: c.created_at,
        orders: s.count,
        average: s.count ? s.sum / s.count : 0,
        total: s.sum,
      }
    })
  }, [state])
}

function CustomerTable({ rows }) {
  return (
    <table className="data-grid dashboard-data">
      <thead>
        <tr>
          <th className="data-grid-th">Customer</th>
          <th className="data-grid-th col-right">Orders</th>
          <th className="data-grid-th col-right">Average</th>
          <th className="data-grid-th col-right">Total</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr className="data-grid-tr-no-data">
            <td colSpan={4}>We couldn&apos;t find any records.</td>
          </tr>
        ) : rows.map((c, i) => (
          <tr key={c.id} className={i % 2 === 0 ? '' : '_odd-row'}>
            <td><AdminLink to={`/admin/customer/index/edit/id/${c.id}/`}>{c.name}</AdminLink></td>
            <td className="col-right">{formatInt(c.orders)}</td>
            <td className="col-right">{formatCurrency(c.average)}</td>
            <td className="col-right">{formatCurrency(c.total)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function PartialShell({ tabLabel, children }) {
  return (
    <PageShell title="Dashboard">
      <div className="dashboard-tab-body dashboard-partial">
        <ul className="tabs-horiz">
          <li className="ui-state-default ui-state-active">
            <AdminLink to="/admin/admin/dashboard/">{tabLabel}</AdminLink>
          </li>
        </ul>
        {children}
      </div>
    </PageShell>
  )
}

/** Row 4 — Most Viewed Products. */
export function ProductsViewed() {
  return (
    <PartialShell tabLabel="Most Viewed Products">
      <table className="data-grid dashboard-data">
        <thead>
          <tr>
            <th className="data-grid-th">Product</th>
            <th className="data-grid-th col-right">Price</th>
            <th className="data-grid-th col-right">Views</th>
          </tr>
        </thead>
        <tbody>
          {/* SEED GAP: `report_viewed_product_aggregated_*` was not extracted, and
              the source's own tab is empty in this deployment. Do not invent
              view counts here. */}
          <tr className="data-grid-tr-no-data">
            <td colSpan={3}>We couldn&apos;t find any records.</td>
          </tr>
        </tbody>
      </table>
    </PartialShell>
  )
}

/** Row 5 — Customers, ordered by order count. */
export function CustomersMost() {
  const rows = useCustomerRows()
  const top = useMemo(
    () => [...rows].sort((a, b) => (b.orders - a.orders) || (b.total - a.total)).slice(0, 5),
    [rows])
  return (
    <PartialShell tabLabel="Customers">
      <CustomerTable rows={top} />
    </PartialShell>
  )
}

/** Row 6 — New Customers, newest account first. */
export function CustomersNewest() {
  const rows = useCustomerRows()
  const newest = useMemo(
    () => [...rows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 5),
    [rows])
  return (
    <PartialShell tabLabel="New Customers">
      <CustomerTable rows={newest} />
    </PartialShell>
  )
}
