import React from 'react'
import Toolbar, { Limiter, Pager } from './Toolbar.jsx'
import ProductGrid from './ProductGrid.jsx'
import { useUrlBuilder } from '../utils/url.js'

/** Toolbar → grid → pager + per-page limiter. Shared by category and search. */
export default function Listing({ listing, isSearch }) {
  const { query } = useUrlBuilder()
  const mode = query.product_list_mode === 'list' ? 'list' : 'grid'

  // A zero-result listing drops BOTH toolbars on the source — the empty-state
  // message is the only thing between the page title and the footer. Verified
  // on /clothing-shoes-jewelry/men/shoes.html?price=1000- , whose HTML contains
  // no `toolbar toolbar-products` div at all. (Toolbar already returns null at
  // count 0; without this guard the bottom div still rendered, empty.)
  if (listing.totalCount === 0) {
    return <ProductGrid products={listing.items} mode={mode} />
  }

  return (
    <>
      <Toolbar listing={listing} isSearch={isSearch} />
      <ProductGrid products={listing.items} mode={mode} />
      <div className="toolbar toolbar-products toolbar-bottom">
        <Pager page={listing.page} totalPages={listing.totalPages} />
        <Limiter listing={listing} />
      </div>
    </>
  )
}
