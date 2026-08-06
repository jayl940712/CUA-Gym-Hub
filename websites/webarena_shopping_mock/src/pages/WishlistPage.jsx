import React, { useState, useEffect } from 'react'
import Page from '../components/Page.jsx'
import ProductImage from '../components/ProductImage.jsx'
import Rating from '../components/Rating.jsx'
import { Pager } from '../components/Toolbar.jsx'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useUrlBuilder, useStoreNavigate } from '../utils/url.js'
import { productsById, getOptions, ratingPercent } from '../utils/catalog.js'
import { money } from '../utils/format.js'

/** ROUTES #32 / #33 — /wishlist/ and /wishlist/index/index/. Honours ?limit=. */
export default function WishlistPage() {
  const { state, updateWishlistItem, removeWishlistItem, addToCart, addMessage } = useApp()
  const { query } = useUrlBuilder()
  const navigate = useStoreNavigate()
  const [draft, setDraft] = useState({})

  const items = state.wishlist.items
  useEffect(() => {
    const next = {}
    for (const i of items) next[i.wishlistItemId] = { qty: i.qty, description: i.description || '' }
    setDraft(next)
  }, [state.wishlist.items])

  const limit = Math.max(1, parseInt(query.limit, 10) || 20)
  const page = Math.max(1, parseInt(query.p, 10) || 1)
  const totalPages = Math.max(1, Math.ceil(items.length / limit))
  const rows = items.slice((page - 1) * limit, page * limit)

  const addRowToCart = (item) => {
    const product = productsById.get(item.productId)
    if (!product) return
    if (getOptions(product.id).some(o => o.isRequire)) {
      navigate(`/${product.urlKey}.html`)
      return
    }
    addToCart(product, Math.max(1, Number((draft[item.wishlistItemId] || {}).qty) || 1), [])
    removeWishlistItem(item.wishlistItemId)
    addMessage(`${product.name} has been added to your cart.`)
  }

  const updateAll = () => {
    for (const i of items) {
      const d = draft[i.wishlistItemId]
      if (!d) continue
      const qty = Math.max(1, parseInt(d.qty, 10) || 1)
      if (qty !== i.qty || d.description !== (i.description || '')) {
        updateWishlistItem(i.wishlistItemId, { qty, description: d.description })
      }
    }
    addMessage('Wish List was updated successfully.')
  }

  return (
    <Page title="My Wish List" documentTitle="My Wish List" sidebar="account">
      {items.length === 0 ? (
        <div className="message info empty"><div><span>You have no items in your wish list.</span></div></div>
      ) : (
        <form className="form-wishlist-items" onSubmit={e => { e.preventDefault(); updateAll() }}>
          <div className="products-grid wishlist wishlist-grid">
            <ol className="product-items">
              {rows.map(item => {
                const product = productsById.get(item.productId)
                const d = draft[item.wishlistItemId] || { qty: item.qty, description: item.description || '' }
                return (
                  <li className="product-item" key={item.wishlistItemId}>
                    <SLink to={product ? `/${product.urlKey}.html` : '/wishlist/'} className="product-item-photo">
                      <ProductImage product={product} alt={item.name} />
                    </SLink>
                    <div className="product-item-details">
                      <strong className="product-item-name">
                        <SLink to={product ? `/${product.urlKey}.html` : '/wishlist/'}>{item.name}</SLink>
                      </strong>
                      {product && <Rating percent={ratingPercent(product, state.myReviews)} />}
                      <div className="price-box"><span className="price">{money(item.price)}</span></div>
                      <textarea
                        className="product-item-comment"
                        rows={3}
                        placeholder="Comment"
                        value={d.description}
                        onChange={e => setDraft(s => ({ ...s, [item.wishlistItemId]: { ...d, description: e.target.value } }))}
                      />
                      <div className="box-tocart">
                        <label className="label visually-hidden" htmlFor={`qty-${item.wishlistItemId}`}>Qty</label>
                        <input
                          id={`qty-${item.wishlistItemId}`}
                          type="number"
                          min="1"
                          value={d.qty}
                          onChange={e => setDraft(s => ({ ...s, [item.wishlistItemId]: { ...d, qty: e.target.value } }))}
                        />
                        <button type="button" className="action tocart primary" onClick={() => addRowToCart(item)}>
                          <span>Add to Cart</span>
                        </button>
                      </div>
                      <div className="product-item-inner">
                        <SLink className="action edit" to={product ? `/${product.urlKey}.html` : '/wishlist/'}>
                          <span>Edit</span>
                        </SLink>{' '}
                        <a className="action delete" href="#" onClick={e => {
                          e.preventDefault()
                          removeWishlistItem(item.wishlistItemId)
                          addMessage(`${item.name} has been removed from your Wish List.`)
                        }}><span>Remove item</span></a>
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </div>

          {totalPages > 1 && (
            <div className="toolbar toolbar-bottom">
              <Pager page={page} totalPages={totalPages} param="p" />
            </div>
          )}

          <div className="actions-toolbar">
            <button type="submit" className="action update primary"><span>Update Wish List</span></button>
            <SLink to="/wishlist/index/share/" className="action share secondary"><span>Share Wish List</span></SLink>
          </div>
        </form>
      )}
      <div className="actions-toolbar">
        <div className="secondary">
          <SLink to="/customer/account/" className="action back"><span>Back</span></SLink>
        </div>
      </div>
    </Page>
  )
}
