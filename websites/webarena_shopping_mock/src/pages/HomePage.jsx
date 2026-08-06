import React from 'react'
import Page from '../components/Page.jsx'
import ProductGrid from '../components/ProductGrid.jsx'
import { Pager } from '../components/Toolbar.jsx'
import { useUrlBuilder } from '../utils/url.js'
import { homepage, productsById } from '../utils/catalog.js'

/**
 * ROUTES #1 / #2 — the home CMS page with the "Product Showcases" widget.
 * The pager param is the widget instance hash `pbaocw`, NOT `p`; /?p=2
 * silently returns page 1 on the source.
 */
export default function HomePage() {
  const { query } = useUrlBuilder()
  const pageParam = homepage.pageParam || 'pbaocw'
  const page = Math.max(1, parseInt(query[pageParam], 10) || 1)
  const pageSize = homepage.pageSize || 12

  const all = homepage.productIds.map(id => productsById.get(id)).filter(Boolean)
  const total = homepage.totalCount || all.length
  const items = all.slice((page - 1) * pageSize, page * pageSize)
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const first = (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <Page title={homepage.title} documentTitle="One Stop Market" sidebar="none">
      <div className="block widget block-products">
        <div className="block-title"><strong role="heading" aria-level="2">{homepage.blockTitle}</strong></div>
        <ProductGrid products={items} columns={5} />
        <div className="products-widget-toolbar" style={{ marginTop: 20 }}>
          <p className="toolbar-amount">Items {first} to {last} of {total} total</p>
          <Pager page={page} totalPages={totalPages} param={pageParam} windowSize={5} />
        </div>
      </div>
    </Page>
  )
}
