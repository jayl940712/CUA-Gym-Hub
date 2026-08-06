import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { SLink } from '../utils/url.js'
import { productsById } from '../utils/catalog.js'
import { money } from '../utils/format.js'

export function CompareBlock() {
  const { state, removeFromCompare, clearCompare } = useApp()
  const items = state.compareList.items
  return (
    <div className="block block-compare">
      <div className="block-title"><strong>Compare Products</strong>
        {items.length > 0 && <span className="counter qty"> {items.length} items</span>}
      </div>
      <div className="block-content">
        {items.length === 0 ? (
          <p className="empty">You have no items to compare.</p>
        ) : (
          <>
            <ol className="product-items">
              {items.map(i => (
                <li className="product-item" key={i.productId} style={{ marginBottom: 8 }}>
                  <SLink to={`/${(productsById.get(i.productId) || {}).urlKey}.html`}>{i.name}</SLink>{' '}
                  <button type="button" className="action delete icon-button" title="Remove This Item"
                    onClick={() => removeFromCompare(i.productId)}>
                    <span>&#10005;</span>
                  </button>
                </li>
              ))}
            </ol>
            <div className="actions-toolbar">
              <SLink to="/catalog/product_compare/index/" className="action primary">Compare</SLink>
              <button type="button" className="action clear" onClick={clearCompare}
                style={{ background: 'none', border: 0, color: '#1979c3', cursor: 'pointer' }}>Clear All</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export function WishlistBlock() {
  const { state, removeWishlistItem } = useApp()
  const items = state.wishlist.items
  return (
    <div className="block block-wishlist">
      <div className="block-title"><strong>My Wish List</strong>
        {items.length > 0 && <span className="counter"> {items.length} items</span>}
      </div>
      <div className="block-content">
        {items.length === 0 ? (
          <p className="empty">You have no items in your wish list.</p>
        ) : (
          <>
            <strong className="subtitle" style={{ display: 'block', marginBottom: 8 }}>Last Added Items</strong>
            <ol className="product-items">
              {items.slice(-3).reverse().map(i => {
                const p = productsById.get(i.productId)
                return (
                  <li className="product-item" key={i.wishlistItemId} style={{ marginBottom: 10 }}>
                    <SLink to={p ? `/${p.urlKey}.html` : '/wishlist/'}>{i.name}</SLink>
                    <div className="price">{money(i.price)}</div>
                    <button type="button" className="btn-remove icon-button" title="Remove This Item"
                      onClick={() => removeWishlistItem(i.wishlistItemId)}><span>&#10005;</span></button>
                  </li>
                )
              })}
            </ol>
            <div className="actions-toolbar"><SLink to="/wishlist/">Go to Wish List</SLink></div>
          </>
        )}
      </div>
    </div>
  )
}

/*
 * The source's `block-reorder` ("Recently Ordered" / "Last Ordered Items") is
 * present in the DOM of every account page and the 404, but it ships with
 * `class="block-title no-display"` / `class="block-content no-display"` and is
 * only un-hidden by Knockout once the `lastordereditems` customer-data section
 * returns items. On this container that section is not wired up at all —
 * /customer/section/load/?sections=lastordereditems answers HTTP 400
 * "The 'lastordereditems' section source isn't supported" — so the block never
 * becomes visible. Reference captures 15-account-dashboard.png and 27-404.png
 * both show a sidebar of exactly Compare Products + My Wish List.
 *
 * So the mock renders no reorder block. Reordering is still reachable where the
 * source exposes it: the Reorder action on My Orders and the account dashboard.
 */

export default function SidebarBlocks() {
  return (
    <>
      <CompareBlock />
      <WishlistBlock />
    </>
  )
}
