import React, { useMemo, useState } from 'react'
import PageShell from '../components/layout/PageShell.jsx'
import AdminLink from '../components/layout/AdminLink.jsx'
import Icon from '../components/layout/Icon.jsx'
import StoreScopeSwitcher from '../components/layout/StoreScopeSwitcher.jsx'
import { useApp } from '../context/AppContext.jsx'
import { getOrderGridRows, getCustomers, getOrders } from '../utils/selectors.js'
import { reportAggregates } from '../utils/staticData.js'
import { formatCurrency, formatInt, stripHtml } from '../utils/formatters.js'
import { nowSeedTimestamp } from '../components/sales/orderHelpers.js'

/**
 * /admin/admin/dashboard/ — reproduced from assets/html/dashboard.html and
 * assets/screenshots/reference/dashboard.png.
 *
 * Deliberate fidelity notes:
 *  - Lifetime Sales, Average Order and the Revenue/Tax/Shipping/Quantity totals
 *    render "$0.00" / "0" in the source — that is the literal on-screen string
 *    in assets/html/dashboard.html, so it is reproduced rather than computed.
 *    (Do not "fix" it from the seed: `sales_order_aggregated_created` is not
 *    empty in the container — 516 rows — yet the source's own dashboard still
 *    prints $0.00, so a computed figure would diverge from the source.)
 *  - The chart is disabled in the source ("Chart is disabled. To enable the
 *    chart, click here.") — `here` points at the Advanced admin config section,
 *    which is where `admin/dashboard/enable_charts` lives.
 */
export default function Dashboard() {
  const { state, setState, addMessage } = useApp()
  const [tab, setTab] = useState('bestsellers')

  /** BUG-005 — see the Reload Data button below for the full derivation. */
  function refreshStatistics() {
    setState(prev => ({
      ...prev,
      dashboardStatistics: {
        ...(prev.dashboardStatistics || {}),
        lifetime_refreshed_at: nowSeedTimestamp(),
        lifetime_refresh_count: Number(prev.dashboardStatistics?.lifetime_refresh_count || 0) + 1,
      },
    }))
    addMessage('We updated lifetime statistic.')
  }

  const lastOrders = useMemo(() => {
    const rows = [...getOrderGridRows(state)]
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))
      .slice(0, 5)
    const byId = new Map(getOrders(state).map(o => [o.entity_id, o]))
    return rows.map(r => {
      const full = byId.get(r.entity_id)
      return {
        id: r.entity_id,
        customer: r.customer_name || r.billing_name,
        items: full?.total_item_count ?? 0,
        // Magento's "Total" here is revenue net of shipping.
        total: Number(r.grand_total || 0) - Number(r.shipping_and_handling || 0),
      }
    })
  }, [state])

  const lastSearchTerms = useMemo(() => (
    [...(state.searchTerms || [])]
      .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, 5)
  ), [state.searchTerms])

  const topSearchTerms = useMemo(() => (
    (state.searchTerms || [])
      .filter(t => Number(t.num_results) > 0)
      .sort((a, b) => (b.popularity - a.popularity) || String(b.updated_at).localeCompare(String(a.updated_at)))
      .slice(0, 5)
  ), [state.searchTerms])

  const bestsellers = useMemo(() => {
    const agg = new Map()
    for (const row of reportAggregates.bestsellers_yearly) {
      if (row.store_id !== 0) continue
      const cur = agg.get(row.product_id)
      if (cur) cur.qty += row.qty_ordered
      else agg.set(row.product_id, {
        id: row.product_id,
        name: stripHtml(row.product_name),
        price: row.product_price,
        qty: row.qty_ordered,
        pos: row.rating_pos,
      })
    }
    /* DIFF-004. The five products and their quantities are stable on the source;
     * the order *within* a quantity is not, and cannot be matched.
     *
     * Magento's query is
     *   SELECT product_id, MAX(product_name), MAX(product_price), SUM(qty_ordered)
     *   FROM sales_bestsellers_aggregated_yearly WHERE product_id IS NOT NULL
     *   GROUP BY product_id ORDER BY SUM(qty_ordered) DESC LIMIT 5
     * (module-sales/Model/ResourceModel/Report/Bestsellers/Collection.php,
     * `_applyAggregatedTable` no-period branch) — no secondary ORDER BY, so ties
     * come back in whatever order MySQL's grouping produced.
     *
     * Three products tie at 6 (20 Quest Lumaflex, 29 Stasis Ball 65 cm,
     * 33 Yoga Strap 6 foot) and two at 5 (13 Overnight Duffle,
     * 25 Stasis Ball 55 cm). 8 cold loads of the live dashboard returned four
     * different sequences (20,33,29|13,25 ×3; 29,20,33|13,25 ×2;
     * 20,33,29|25,13 ×1; 29,20,33|25,13 ×2), and running the SQL by hand gives
     * yet another. Round 2's 10-load sample saw two of the same four.
     *
     * So there is no source order to copy. The mock pins the sequence the source
     * produced most often across the 18 measured loads — quantity desc, then
     * price desc, then product id — which yields 29, 20, 33 | 13, 25. */
    return [...agg.values()]
      .sort((a, b) => (b.qty - a.qty) || (b.price - a.price) || (a.id - b.id))
      .slice(0, 5)
  }, [])

  const customerRows = useMemo(() => {
    const orders = getOrders(state)
    const stats = new Map()
    for (const o of orders) {
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

  const newestCustomers = useMemo(
    () => [...customerRows].sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 5),
    [customerRows])

  const mostCustomers = useMemo(
    () => [...customerRows].sort((a, b) => (b.orders - a.orders) || (b.total - a.total)).slice(0, 5),
    [customerRows])

  return (
    <PageShell title="Dashboard">
      <div className="admin__scope-old">
        {/* DOM F-01 — the source's dashboard scope control is the shared
            `<button id="store-change-button">` dropdown, not a `<select>`;
            `page.click('#store-change-button')` found nothing here. The
            component writes `store` into the query string exactly as the old
            select did (HANDLERS-009), through `withGridParams`, so `?sid=` and
            any other param ride along and the choice survives a deep link. */}
        <StoreScopeSwitcher label="Scope:" />
        {/* DIFF-010: the source's tooltip trigger carries the accessible label
         * "What is this?" alongside the `?` badge. */}
        <AdminLink to="/admin/admin/system_store/" className="scope-help" title="What is this?">
          ?
          <span style={{
            border: 0, clip: 'rect(0 0 0 0)', height: '1px', margin: '-1px',
            overflow: 'hidden', padding: 0, position: 'absolute', width: '1px',
          }}
          >
            What is this?
          </span>
        </AdminLink>
        {/* BUG-005. The source wraps this button in
         *   <form class="action-element" method="post"
         *         action=".../admin/admin/dashboard/refreshStatistics/">
         * (assets/html/dashboard.html:322). RefreshStatistics.php calls
         * `refreshLifetimeStatistics()` on every report collection — which
         * rewrites the `*_aggregated_*` tables and their `report_statistics`
         * flag rows — then redirects back to the dashboard with
         * "We updated lifetime statistic.".
         *
         * The recomputed figures do not move (the aggregation reads order data
         * no admin action here changes, which is why the source's own tiles are
         * identical before and after), but the refresh itself IS recorded in the
         * source's database. So the honest mock of it is to record the refresh:
         * `dashboardStatistics.lifetime_refreshed_at` + a counter, written
         * through setState so it reaches saveState() -> /go state_diff. The
         * banner is now backed by a real state change instead of being a false
         * success. Final URL is unchanged (`/admin/admin/dashboard/`), which is
         * where the source's POST-then-302 also lands. */}
        <form
          className="action-element"
          style={{ display: 'inline-block' }}
          onSubmit={e => { e.preventDefault(); refreshStatistics() }}
        >
          <button type="submit" className="action-primary" title="Reload Data">
            Reload Data
          </button>
        </form>
      </div>

      <section className="dashboard-advanced-reports">
        <div className="dashboard-advanced-reports-text">
          <strong className="dashboard-advanced-reports-title">Advanced Reporting</strong>
          <p>
            Gain new insights and take command of your business' performance, using our dynamic
            product, order, and customer reports tailored to your customer data.
          </p>
        </div>
        <AdminLink to="/admin/analytics/reports/show/" className="action-advanced-reports">
          Go to Advanced Reporting <Icon name="external" size={14} />
        </AdminLink>
      </section>

      <div className="dashboard-columns">
        <div className="dashboard-secondary">
          <section className="dashboard-totals">
            <div className="dashboard-item">
              <span className="dashboard-item-title">Lifetime Sales</span>
              <span className="dashboard-item-content dashboard-sales-value">$0.00</span>
            </div>
            <div className="dashboard-item">
              <span className="dashboard-item-title">Average Order</span>
              <span className="dashboard-item-content">$0.00</span>
            </div>
          </section>

          <section className="dashboard-item">
            <span className="dashboard-item-title">Last Orders</span>
            <table className="data-grid dashboard-data">
              <thead>
                <tr>
                  <th className="data-grid-th">Customer</th>
                  <th className="data-grid-th">Items</th>
                  <th className="data-grid-th col-right">Total</th>
                </tr>
              </thead>
              <tbody>
                {lastOrders.map((o, i) => (
                  <tr key={o.id} className={i % 2 === 0 ? '' : '_odd-row'}>
                    <td><AdminLink to={`/admin/sales/order/view/order_id/${o.id}/`}>{o.customer}</AdminLink></td>
                    <td>{o.items}</td>
                    <td className="col-right">{formatCurrency(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="dashboard-item">
            <span className="dashboard-item-title">Last Search Terms</span>
            <SearchTermTable terms={lastSearchTerms} />
          </section>

          <section className="dashboard-item">
            <span className="dashboard-item-title">Top Search Terms</span>
            <SearchTermTable terms={topSearchTerms} />
          </section>
        </div>

        <div className="dashboard-primary">
          <p className="dashboard-diagram-nodata">
            Chart is disabled. To enable the chart, click{' '}
            <AdminLink to="/admin/admin/system_config/edit/section/admin/">here</AdminLink>.
          </p>

          <ul className="dashboard-totals-list">
            <li className="dashboard-totals-item">
              <span className="dashboard-totals-label">Revenue</span>
              <span className="dashboard-totals-value price">$0.00</span>
            </li>
            <li className="dashboard-totals-item">
              <span className="dashboard-totals-label">Tax</span>
              <span className="dashboard-totals-value">$0.00</span>
            </li>
            <li className="dashboard-totals-item">
              <span className="dashboard-totals-label">Shipping</span>
              <span className="dashboard-totals-value">$0.00</span>
            </li>
            <li className="dashboard-totals-item">
              <span className="dashboard-totals-label">Quantity</span>
              <span className="dashboard-totals-value">0</span>
            </li>
          </ul>

          <ul className="tabs-horiz">
            {[
              ['bestsellers', 'Bestsellers'],
              ['viewed', 'Most Viewed Products'],
              ['newest', 'New Customers'],
              ['customers', 'Customers'],
            ].map(([id, label]) => (
              <li key={id} className={`ui-state-default${tab === id ? ' ui-state-active' : ''}`}>
                <button type="button" onClick={() => setTab(id)} aria-pressed={tab === id}>{label}</button>
              </li>
            ))}
          </ul>

          <div className="dashboard-tab-body">
            {tab === 'bestsellers' ? (
              <table className="data-grid dashboard-data">
                <thead>
                  <tr>
                    <th className="data-grid-th">Product</th>
                    <th className="data-grid-th col-right">Price</th>
                    <th className="data-grid-th col-right">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {bestsellers.map((p, i) => (
                    <tr key={p.id} className={i % 2 === 0 ? '' : '_odd-row'}>
                      <td><AdminLink to={`/admin/catalog/product/edit/id/${p.id}/`}>{p.name}</AdminLink></td>
                      <td className="col-right">{formatCurrency(p.price)}</td>
                      <td className="col-right">{formatInt(p.qty)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            {tab === 'viewed' ? (
              <table className="data-grid dashboard-data">
                <thead>
                  <tr>
                    <th className="data-grid-th">Product</th>
                    <th className="data-grid-th col-right">Price</th>
                    <th className="data-grid-th col-right">Views</th>
                  </tr>
                </thead>
                <tbody>
                  {/* HANDLERS-017 — not a gap: the source's own tab is empty
                      too. Re-confirmed read-only against the container on
                      2026-08-05:
                        report_viewed_product_aggregated_daily    -> 0 rows
                        report_viewed_product_aggregated_monthly  -> 0 rows
                        report_viewed_product_aggregated_yearly   -> 0 rows
                        report_viewed_product_index               -> 0 rows
                      so `reportAggregates.viewed_{daily,monthly,yearly}` are
                      legitimately `[]` in the seed and this deployment can never
                      show a row here. The same emptiness is why the Reports >
                      Products > Product Views grid (row 89) and the Most Viewed
                      row of Refresh Statistics have no data either. Do not
                      invent view counts. */}
                  <tr className="data-grid-tr-no-data">
                    <td colSpan={3}>We couldn't find any records.</td>
                  </tr>
                </tbody>
              </table>
            ) : null}

            {tab === 'newest' ? <CustomerTable rows={newestCustomers} /> : null}
            {tab === 'customers' ? <CustomerTable rows={mostCustomers} /> : null}
          </div>
        </div>
      </div>
    </PageShell>
  )
}

function SearchTermTable({ terms }) {
  return (
    <table className="data-grid dashboard-data">
      <thead>
        <tr>
          <th className="data-grid-th">Search Term</th>
          <th className="data-grid-th col-right">Results</th>
          <th className="data-grid-th col-right">Uses</th>
        </tr>
      </thead>
      <tbody>
        {terms.map((t, i) => (
          <tr key={t.query_id} className={i % 2 === 0 ? '' : '_odd-row'}>
            <td><AdminLink to={`/admin/search/term/edit/id/${t.query_id}/`}>{t.query_text}</AdminLink></td>
            <td className="col-right">{formatInt(t.num_results)}</td>
            <td className="col-right">{formatInt(t.popularity)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
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
        {rows.map((c, i) => (
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
