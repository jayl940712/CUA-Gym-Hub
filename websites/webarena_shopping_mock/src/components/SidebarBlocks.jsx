import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { Link } from 'react-router-dom'
import { SLink, buildUrl } from '../utils/url.js'
import { productsById, getOptions } from '../utils/catalog.js'
import { money } from '../utils/format.js'
import { sortedOrders } from '../utils/orders.js'

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
        {/*
          The source renders this subtitle unconditionally, ahead of the
          empty/non-empty branch, and hides it with `.sidebar .subtitle
          {display:none}` (Luma's `.abs-no-display` group in styles-m.css) — so
          it is always in `page.content()` and never in `innerText`, in BOTH
          states. It was previously mock-rendered only when the list had items,
          and visibly, which was wrong in both directions.
        */}
        <strong className="subtitle">Last Added Items</strong>
        {items.length === 0 ? (
          <p className="empty">You have no items in your wish list.</p>
        ) : (
          <>
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
 * `block-reorder` — the source's "Recently Ordered" / "Last Ordered Items"
 * sidebar block. Knockout un-hides it as soon as the `last-ordered-items`
 * customer-data section returns items, and on this container, LOGGED IN as
 * emma.lopez@gmail.com, it does:
 *
 *   GET /customer/section/load/?sections=customer,last-ordered-items  -> 200
 *   {"last-ordered-items":{"items":[
 *      {"id":"490","name":"NOZE Rustic Coat Rack…","url":"…","is_saleable":true,"product_id":"15787"},
 *      {"id":"489","name":"Uttermost Volterra…"},{"id":"491","name":"Plus Size Lingerie…"}]}}
 *
 * and the block measures 276.5 x 345 at top 795 on /customer/account/ and
 * 206.7 x 445 on /electronics/headphones.html, with 3 <li> in
 * #cart-sidebar-reorder. A previous round recorded the opposite — that the
 * section answers HTTP 400 and the block is never visible. Two things were
 * wrong with that: the probe was run on a LOGGED-OUT session (which is
 * redirected away from every account page), and it asked for a section named
 * `lastordereditems`, which does not exist. The real name is hyphenated,
 * `last-ordered-items`; the 400 was the container rejecting the typo, not
 * reporting a missing feature. Re-check this only against a source session
 * that reports `span.logged-in` count 2.
 *
 * Behaviour taken from the container's own PHP rather than guessed:
 *  - Magento\Sales\CustomerData\LastOrderedItems::getItems() takes the most
 *    recent order visible on the front and up to SIDEBAR_ORDER_LIMIT = 5 of its
 *    parent items. It reads them through getParentItemsRandomCollection(), so
 *    the source's own order really is random per request (490,491,489 on one
 *    load, 490,489,491 on the next). The mock keeps the order's own line order,
 *    which is inside the source's range of behaviour and is reproducible.
 *  - `is_saleable` is the product's stock status; a non-saleable line renders a
 *    disabled checkbox titled `Product is not salable.`
 *  - Submitting posts the checked `order_items[]` to /checkout/cart/addgroup/,
 *    which is Magento\Checkout\Controller\Cart\Addgroup -> Cart::addOrderItem
 *    ($item, 1): quantity ONE per checked line regardless of how many were
 *    ordered, carrying the line's product options, one success message each.
 *  - With nothing checked, mage's `validate-one-checkbox-required-by-name` rule
 *    renders `Please select one of the options.` into
 *    #cart-sidebar-reorder-advice-container.
 */
export function ReorderBlock() {
  const { state, addToCart, addMessage } = useApp()
  const [checked, setChecked] = useState({})
  const [error, setError] = useState('')

  const order = sortedOrders(state.orders)[0]
  const lines = (order ? order.items : []).slice(0, 5)
  if (!lines.length) return null

  const saleable = (line) => {
    const p = productsById.get(line.productId)
    return !!p && p.inStock
  }
  const toggle = (itemId) => {
    setChecked(prev => ({ ...prev, [itemId]: !prev[itemId] }))
    setError('')
  }

  const submit = (e) => {
    e.preventDefault()
    const picked = lines.filter(l => checked[l.itemId] && saleable(l))
    if (!picked.length) {
      setError('Please select one of the options.')
      return
    }
    for (const line of picked) {
      const product = productsById.get(line.productId)
      if (!product) continue
      const groups = getOptions(line.productId)
      const options = (line.options || []).map(o => {
        const group = groups.find(g => g.title === o.label)
        const value = group ? group.values.find(v => v.title === o.value) : null
        return {
          optionId: group ? group.optionId : null,
          optionTypeId: value ? value.optionTypeId : null,
          label: o.label,
          value: o.value,
        }
      })
      addToCart(product, 1, options)
      addMessage(`You added ${product.name} to your shopping cart.`)
    }
    setChecked({})
    setError('')
  }

  return (
    <div className="block block-reorder">
      <div className="block-title">
        <strong id="block-reorder-heading" role="heading" aria-level="2">Recently Ordered</strong>
      </div>
      <div className="block-content" aria-labelledby="block-reorder-heading">
        <form className="form reorder" id="reorder-validate-detail" onSubmit={submit}>
          <strong className="subtitle">Last Ordered Items</strong>
          <ol id="cart-sidebar-reorder" className="product-items product-items-names">
            {lines.map(line => {
              const p = productsById.get(line.productId)
              const ok = saleable(line)
              return (
                <li className="product-item" key={line.itemId}>
                  <div className="field item choice">
                    <label className="label" htmlFor={`reorder-item-${line.itemId}`}>
                      <span>Add to Cart</span>
                    </label>
                    <div className="control">
                      <input
                        type="checkbox"
                        name="order_items[]"
                        className="checkbox"
                        id={`reorder-item-${line.itemId}`}
                        value={line.itemId}
                        title={ok ? 'Add to Cart' : 'Product is not salable.'}
                        disabled={!ok}
                        checked={!!checked[line.itemId]}
                        onChange={() => toggle(line.itemId)}
                      />
                    </div>
                  </div>
                  <strong className="product-item-name">
                    <SLink className="product-item-link" to={p ? `/${p.urlKey}.html` : '/customer/account/'}>
                      <span>{line.name}</span>
                    </SLink>
                  </strong>
                </li>
              )
            })}
          </ol>
          <div id="cart-sidebar-reorder-advice-container">
            {error && <div className="mage-error">{error}</div>}
          </div>
          <div className="actions-toolbar">
            <div className="primary">
              <button type="submit" title="Add to Cart" className="action tocart primary">
                <span>Add to Cart</span>
              </button>
            </div>
            <div className="secondary">
              {/* The source's View All is /customer/account/#my-orders-table.
                  SLink cannot carry a fragment (the sid has to land before it),
                  so the href is built explicitly. */}
              <Link className="action view" to={`${buildUrl('/customer/account/')}#my-orders-table`}>
                <span>View All</span>
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function SidebarBlocks() {
  return (
    <>
      <CompareBlock />
      <ReorderBlock />
      <WishlistBlock />
    </>
  )
}
