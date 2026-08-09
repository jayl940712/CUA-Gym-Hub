import React, { useState } from 'react'
import Page from '../components/Page.jsx'
import { RawProductImage } from '../components/ProductImage.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useStoreNavigate, SLink } from '../utils/url.js'
import { productsById, getOptions } from '../utils/catalog.js'
import { money } from '../utils/format.js'
import NotFoundPage from './NotFoundPage.jsx'

/**
 * ROUTES #18 — /checkout/cart/configure/id/:itemId/product_id/:productId/
 * Reopens the product form pre-filled with the cart line's options and qty.
 */
export default function CartConfigurePage({ itemId, productId }) {
  const { state, updateCartItem, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const line = state.cart.items.find(i => String(i.itemId) === String(itemId))
  const product = productsById.get(Number(productId))

  const [selected, setSelected] = useState(() => {
    const init = {}
    for (const o of (line && line.options) || []) init[o.optionId] = o.optionTypeId
    return init
  })
  const [qty, setQty] = useState(line ? line.qty : 1)
  const [errors, setErrors] = useState({})

  if (!line || !product) return <NotFoundPage />

  const groups = getOptions(product.id)

  const onUpdate = (e) => {
    e.preventDefault()
    const errs = {}
    for (const g of groups) {
      if (g.isRequire && !selected[g.optionId]) errs[g.optionId] = 'This is a required field.'
    }
    setErrors(errs)
    if (Object.keys(errs).length) return

    const options = groups
      .filter(g => selected[g.optionId])
      .map(g => {
        const value = g.values.find(v => String(v.optionTypeId) === String(selected[g.optionId]))
        return {
          optionId: g.optionId,
          optionTypeId: value ? value.optionTypeId : null,
          label: g.title,
          value: value ? value.title : '',
        }
      })

    // `groups` is getOptions()' PDP order, which is NOT Magento's storage order.
    // updateCartItem() runs the line through sortLineOptions() so the stored
    // state is right without CartPage having to re-sort at render.
    updateCartItem(itemId, { qty, options, productId: product.id })
    addMessage(`${product.name} was updated in your shopping cart.`)
    navigate('/checkout/cart/')
  }

  return (
    <Page
      title={product.name}
      documentTitle={product.name}
      breadcrumbs={[{ label: product.name }]}
      sidebar="none"
    >
      <div className="product-info-wrapper">
        <div className="product media">
          <RawProductImage product={product} path={product.image || product.smallImage}
            alt={product.name} style={{ maxWidth: '100%', maxHeight: 480, objectFit: 'contain' }} />
        </div>
        <form className="product-info-main" onSubmit={onUpdate}>
          <div className="product-info-stock-sku">
            <div className="stock available"><span>{product.inStock ? 'IN STOCK' : 'OUT OF STOCK'}</span></div>
            <div className="product attribute sku"><strong className="type">SKU</strong>
              <div className="value">{product.sku}</div></div>
          </div>
          <div className="product-info-price"><span className="price">{money(line.price)}</span></div>

          {groups.length > 0 && (
            <div className="product-options-wrapper">
              {groups.map(group => (
                <div className={`field${group.isRequire ? ' required' : ''}`} key={group.optionId}>
                  <label className="label"><span>{group.title}</span></label>
                  <div className="control">
                    <ul className="options-list">
                      {group.values.map(v => (
                        <li key={v.optionTypeId}>
                          <input
                            type="radio"
                            id={`cfg-opt-${v.optionTypeId}`}
                            name={`options[${group.optionId}]`}
                            checked={String(selected[group.optionId]) === String(v.optionTypeId)}
                            onChange={() => setSelected(s => ({ ...s, [group.optionId]: v.optionTypeId }))}
                          />
                          <label htmlFor={`cfg-opt-${v.optionTypeId}`}>{v.title}</label>
                        </li>
                      ))}
                    </ul>
                    {errors[group.optionId] && <div className="field-error">{errors[group.optionId]}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="box-tocart">
            <div className="field qty">
              <label className="label" htmlFor="qty"><span>Qty</span></label>
              <div className="control">
                <input type="number" id="qty" min="1" value={qty} onChange={e => setQty(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="action primary tocart"><span>Update Cart</span></button>
          </div>

          <div className="actions-toolbar">
            <SLink to="/checkout/cart/" className="action back"><span>Back to Shopping Cart</span></SLink>
          </div>
        </form>
      </div>
    </Page>
  )
}
