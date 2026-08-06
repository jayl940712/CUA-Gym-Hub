import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useUrlBuilder } from '../utils/url.js'
import { storeConfig } from '../utils/catalog.js'
import { GridIcon, ListIcon, ArrowUp, ArrowDown } from './Icons.jsx'

/**
 * Magento's `Magento\Catalog\Block\Product\ProductList\Toolbar` renders two
 * different strings and the switch is *pagination*, not the count:
 *
 *   last page == first page  →  `<span class="toolbar-number">N</span> Item(s)`
 *   otherwise                →  `Items <n>-<n> of <n>`
 *
 * Verified live on the container at every boundary (2026-08-05):
 *
 *   /catalogsearch/result/?q=asdfghjkl                              → `1 Item`
 *   /electronics/headphones.html?price=1000-2000                    → `3 Items`
 *   …?price=1000-2000&product_list_limit=36                         → `3 Items`
 *   /home-kitchen/furniture/accent-furniture.html?price=500-600,0-1000 (12)
 *                                                                   → `12 Items`   (N == limit)
 *   /clothing-shoes-jewelry/women/clothing.html?price=200-300 (24)   → `Items 1-12 of 24`
 *   …?price=200-300&product_list_limit=24                            → `24 Items`   (N == limit)
 *   /catalogsearch/result/index/?cat=11&q=Hawaiian+Bamboo+Orchid+Roots&product_list_limit=36 (36)
 *                                                                   → `36 Items`
 *   /beauty-personal-care.html?cat=140&price=20-30,0-100 (14)        → `Items 1-12 of 14`
 *   …&product_list_limit=24                                          → `14 Items`
 *   /catalogsearch/advanced/result/?sku=B087QSCXGT                   → `1 Item`
 *   /catalogsearch/advanced/result/?name=lamp                        → `Items 1-12 of 1607`
 *
 * so the branch is `total <= limit`, singular only at exactly 1. A zero-result
 * page renders no `toolbar-amount` element at all on the source, which the
 * listing pages already handle by not mounting the toolbar.
 */
export function ToolbarAmount({ first, last, total, limit = 12 }) {
  const onePage = total <= (limit || 12)
  if (onePage) {
    return (
      <p className="toolbar-amount" id="toolbar-amount">
        <span className="toolbar-number">{total}</span> {total === 1 ? 'Item' : 'Items'}
      </p>
    )
  }
  return (
    <p className="toolbar-amount" id="toolbar-amount">
      Items <span className="toolbar-number">{first}</span>-<span className="toolbar-number">{last}</span> of{' '}
      <span className="toolbar-number">{total}</span>
    </p>
  )
}

/**
 * Sort By select + direction arrow + view mode toggle.
 *
 * Option order is load-bearing — agents pick a <select> option by index.
 * Category pages list Position, Product Name, Price; search pages list
 * Product Name, Price, Relevance, with Relevance last and selected by
 * default. Both lists come from the seed (storeConfig.sortOptions /
 * .searchSortOptions), captured from the source's own markup.
 */
export default function Toolbar({ listing, isSearch }) {
  const navigate = useNavigate()
  const { withParams, query } = useUrlBuilder()

  const sortOptions = isSearch ? storeConfig.searchSortOptions : storeConfig.sortOptions

  // A result set with no matches renders no toolbar at all on the source — no
  // amount, no sorter, no view-mode switch, just the layered nav and
  // "We can't find products matching the selection."  Verified on
  // /clothing-shoes-jewelry/men/shoes.html?price=1000- : the served HTML
  // contains zero occurrences of `id="sorter"`, `id="limiter"` and
  // `class="toolbar toolbar-products"`.
  if (listing.totalCount === 0) return null

  const mode = query.product_list_mode === 'list' ? 'list' : 'grid'
  // `listing.dir` is the direction the page is *currently* in (which on a quick
  // search page defaults to `desc`, not `asc` — see defaultListDir()). The
  // control always advertises the direction it would switch *to*, exactly as
  // the source does: class `sort-<current>`, data-value/title = the other one.
  const dir = listing.dir === 'desc' ? 'desc' : 'asc'
  const nextDir = dir === 'asc' ? 'desc' : 'asc'
  const dirTitle = nextDir === 'desc' ? 'Set Descending Direction' : 'Set Ascending Direction'

  return (
    <div className="toolbar toolbar-products">
      <div className="modes">
        <strong className="modes-label visually-hidden">View as</strong>
        <button
          type="button"
          className={`modes-mode mode-grid${mode === 'grid' ? ' active' : ''}`}
          title="Grid"
          onClick={() => navigate(withParams({ product_list_mode: 'grid' }))}
        >
          <GridIcon /><span className="visually-hidden">Grid</span>
        </button>
        <button
          type="button"
          className={`modes-mode mode-list${mode === 'list' ? ' active' : ''}`}
          title="List"
          onClick={() => navigate(withParams({ product_list_mode: 'list' }))}
        >
          <ListIcon /><span className="visually-hidden">List</span>
        </button>
      </div>

      <ToolbarAmount first={listing.first} last={listing.last} total={listing.totalCount} limit={listing.limit} />

      <div className="toolbar-sorter sorter">
        <label className="sorter-label" htmlFor="sorter">Sort By</label>
        <select
          id="sorter"
          className="sorter-options"
          value={listing.order}
          onChange={e => navigate(withParams({ product_list_order: e.target.value, p: null }))}
        >
          {sortOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          type="button"
          className={`action sorter-action sort-${dir}`}
          title={dirTitle}
          data-role="direction-switcher"
          data-value={nextDir}
          onClick={() => navigate(withParams({ product_list_dir: nextDir, p: null }))}
        >
          {dir === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          <span className="visually-hidden">{dirTitle}</span>
        </button>
      </div>
    </div>
  )
}

export function Limiter({ listing, param = 'product_list_limit', values }) {
  const navigate = useNavigate()
  const { withParams } = useUrlBuilder()
  const options = values || storeConfig.gridPerPageValues || [12, 24, 36]
  // Same rule as the top toolbar: the source emits no `id="limiter"` on a
  // zero-result page.
  if (listing.totalCount === 0) return null
  return (
    <div className="field limiter">
      <label className="label" htmlFor="limiter"><span>Show</span></label>
      <select
        id="limiter"
        className="limiter-options"
        value={listing.limit}
        onChange={e => navigate(withParams({ [param]: e.target.value, p: null }))}
      >
        {options.map(v => <option key={v} value={v}>{v}</option>)}
      </select>
      <span className="limiter-text">per page</span>
    </div>
  )
}

/** Magento's pager: current page as <strong>, then a window of links, then Next. */
export function Pager({ page, totalPages, param = 'p', windowSize = 5 }) {
  const navigate = useNavigate()
  const { withParams } = useUrlBuilder()
  if (totalPages <= 1) return null

  const start = Math.max(1, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1))
  const pages = []
  for (let i = start; i < start + windowSize && i <= totalPages; i++) pages.push(i)

  // The source pager emits real hrefs (…/electronics/headphones.html?p=2), so
  // an agent reading the accessibility tree sees a destination, not "#".
  const hrefFor = (n) => withParams({ [param]: n === 1 ? null : n })
  const go = (n) => navigate(hrefFor(n))

  return (
    <div className="pages">
      <strong className="label pages-label" id="paging-label">Page</strong>
      <ul className="items pages-items" aria-labelledby="paging-label">
        {page > 1 && (
          <li className="item pages-item-previous">
            <a className="action previous" title="Previous" href={hrefFor(page - 1)} onClick={e => { e.preventDefault(); go(page - 1) }}>
              <span className="label">Page</span><span>Previous</span>
            </a>
          </li>
        )}
        {pages.map(n => (
          <li className={`item${n === page ? ' current' : ''}`} key={n}>
            {n === page ? (
              <strong className="page">
                <span className="label">You&#039;re currently reading page</span>
                <span>{n}</span>
              </strong>
            ) : (
              <a className="page" href={hrefFor(n)} onClick={e => { e.preventDefault(); go(n) }}>
                <span className="label">Page</span><span>{n}</span>
              </a>
            )}
          </li>
        ))}
        {page < totalPages && (
          <li className="item pages-item-next">
            <a className="action next" title="Next" href={hrefFor(page + 1)} onClick={e => { e.preventDefault(); go(page + 1) }}>
              <span className="label">Page</span><span>Next</span>
            </a>
          </li>
        )}
      </ul>
    </div>
  )
}
