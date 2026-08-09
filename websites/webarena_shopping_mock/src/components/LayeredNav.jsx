import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useUrlBuilder } from '../utils/url.js'
import { categoryFacets, priceFacets, priceBucketLabel, getCategory } from '../utils/catalog.js'

/**
 * "Now Shopping by" chips + the "Shop By / Shopping Options" facet block.
 * Each chip's ✕ points at the current URL minus that one param; Clear All
 * drops every filter param.
 */
/**
 * `showPrice` — whether the Price facet participates at all. Category pages get
 * it; SEARCH pages do not. Measured on the live logged-in source at 1280x720:
 *   /catalogsearch/result/?q=<chairs|tea|laptop|shoes|coffee|desk lamp>
 *     .filter-options-title -> ['Category']  (six for six, never 'Price')
 *   /electronics/headphones.html
 *     .filter-options-title -> ['Category', 'Price']
 * and the source ignores the param outright on search rather than merely
 * hiding the control: ?q=chairs&price=50-100 renders no chip, no Price title,
 * and the same `Items 1-12 of 3418` as ?q=chairs alone.
 */
export default function LayeredNav({ listing, categoryId, showPrice = true }) {
  const navigate = useNavigate()
  const { query, withParams, without } = useUrlBuilder()

  const activeCat = query.cat ? getCategory(query.cat) : null
  const activeChips = []
  if (activeCat) activeChips.push({ label: 'Category', value: activeCat.name, param: 'cat' })
  if (showPrice && listing.priceRange) {
    activeChips.push({ label: 'Price', value: priceBucketLabel(listing.priceRange), param: 'price' })
  }

  // `query.cat` is the active layer: the source narrows the Category facet to
  // the children of the filtered category, not of the page's own category
  // (/home-kitchen.html?cat=34 lists Living Room Furniture … Kids' Furniture).
  // A search page has no page category, so the fallback bottoms out at the
  // store root — which is what makes the block render on EVERY term (BUG-N02).
  const catOptions = categoryFacets(listing, categoryId, query.cat || null)
  const priceOptions = showPrice ? priceFacets(listing, raw => withParams({ price: raw, p: null })) : []

  const hasFacets = catOptions.length > 0 || priceOptions.length > 0

  return (
    <>
      {activeChips.length > 0 && (
        <div className="block filter-current">
          <div className="block-title filter-title"><strong>Now Shopping by</strong></div>
          <div className="block-content filter-content">
            <ol className="items">
              {activeChips.map(chip => (
                <li className="item" key={chip.param}>
                  <span className="filter-label">{chip.label}</span>
                  <span className="filter-value">{chip.value}</span>
                  <a
                    className="action remove"
                    href={without(chip.param)}
                    title="Remove This Item"
                    onClick={e => { e.preventDefault(); navigate(without(chip.param)) }}
                  >
                    <span>Remove This Item</span>
                  </a>
                </li>
              ))}
            </ol>
            <div className="filter-actions">
              <a
                href={withParams({ cat: null, price: null, p: null })}
                className="action clear filter-clear"
                onClick={e => { e.preventDefault(); navigate(withParams({ cat: null, price: null, p: null })) }}
              >
                <span>Clear All</span>
              </a>
            </div>
          </div>
        </div>
      )}

      {hasFacets && (
        <div className="block filter">
          <div className="block-title filter-title"><strong>Shop By</strong></div>
          <div className="block-content filter-content">
            <strong role="heading" aria-level="2" className="block-subtitle filter-subtitle">Shopping Options</strong>
            <dl className="filter-options" id="narrow-by-list">
              {catOptions.length > 0 && (
                <>
                  <dt role="heading" aria-level="3" className="filter-options-title">Category</dt>
                  <dd className="filter-options-content">
                    <ol className="items">
                      {catOptions.map(o => (
                        <li className="item" key={o.cat + o.label}>
                          <a
                            href={withParams({ cat: o.cat, p: null })}
                            rel="nofollow"
                            onClick={e => { e.preventDefault(); navigate(withParams({ cat: o.cat, p: null })) }}
                          >
                            {o.label}
                            <span className="count"> {o.count}<span className="filter-count-label">item</span></span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  </dd>
                </>
              )}
              {priceOptions.length > 0 && (
                <>
                  <dt role="heading" aria-level="3" className="filter-options-title">Price</dt>
                  <dd className="filter-options-content">
                    <ol className="items">
                      {priceOptions.map(o => (
                        <li className="item" key={o.label}>
                          <a
                            href={o.href}
                            rel="nofollow"
                            onClick={e => { e.preventDefault(); navigate(o.href) }}
                          >
                            {o.label}
                            <span className="count"> {o.count}<span className="filter-count-label">item</span></span>
                          </a>
                        </li>
                      ))}
                    </ol>
                  </dd>
                </>
              )}
            </dl>
          </div>
        </div>
      )}
    </>
  )
}
