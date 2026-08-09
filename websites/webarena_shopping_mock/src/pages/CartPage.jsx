import React, { useState, useEffect } from 'react'
import Page from '../components/Page.jsx'
import ProductImage from '../components/ProductImage.jsx'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useStoreNavigate } from '../utils/url.js'
import { productsById } from '../utils/catalog.js'
import { money } from '../utils/format.js'
import { flatRateShipping } from '../utils/orders.js'
import { COUNTRIES, US_REGIONS } from '../utils/geo.js'
import { ChevronLeft, ChevronDown, RefreshIcon } from '../components/Icons.jsx'

/** ROUTES #15 / #16 / #17 / #19 — /checkout/cart/ (trailing slash optional). */
export default function CartPage() {
  const { state, updateCartQty, removeCartItem, moveToWishlist, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const items = state.cart.items
  const [qtyDraft, setQtyDraft] = useState({})
  const [qtyErrors, setQtyErrors] = useState({})
  const [openShipping, setOpenShipping] = useState(false)
  const [openDiscount, setOpenDiscount] = useState(false)
  const [coupon, setCoupon] = useState('')
  // Prefilled from Emma's default shipping address, exactly as the source's
  // shipping estimator is (San Mateo, California, 94010).
  const [estCountry, setEstCountry] = useState('US')
  const [estRegion, setEstRegion] = useState('12')
  const [estPostcode, setEstPostcode] = useState('94010')

  useEffect(() => {
    const next = {}
    for (const i of items) next[i.itemId] = i.qty
    setQtyDraft(next)
    setQtyErrors({})
  }, [state.cart.items])

  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)
  // Magento's carriers/flatrate rule on this store is "Per Item" at $5.00, so
  // the cart summary shows the same number checkout does. It is recomputed
  // from the committed cart lines, so it follows Update Shopping Cart.
  const shipping = flatRateShipping(items)
  const orderTotal = subtotal + shipping

  /**
   * Cart qty validation, transcribed from the source's own rules.
   *
   * Every cart qty input on the source carries
   *   data-validate="{required:true,'validate-greater-than-zero':true}"
   * (see `assets/html/cart.html`, e.g. `#cart-554-qty`), and the messages come
   * out of the store's `mage/validation.js`
   * (`curl http://10.186.197.203:7770/static/frontend/Magento/luma/en_US/mage/validation.js`):
   *   required                       -> "This is a required field."                        (:1704)
   *   'validate-greater-than-zero'   -> "Please enter a number greater than 0 in this field." (:832)
   *
   * The source REJECTS a 0 and KEEPS the line — validation runs before the form
   * posts, so nothing is committed and no success message appears. The mock used
   * to clamp to 0 and let `updateCartQty`'s `.filter(i => i.qty > 0)` delete the
   * line while still reporting success, which is the opposite behaviour.
   * Removing a line is `Remove item`, not a qty of 0.
   */
  /**
   * The `dl.item-options` order is asserted by three VWA tasks through
   * `dd:nth-child(4)`. It is normalised on WRITE now — every path that creates
   * or edits a line (PDP add-to-cart, cart Edit, reorder) goes through
   * `sortLineOptions()` in AppContext.jsx — so the stored state, the order
   * written at checkout and this render all agree. Render what is stored.
   */

  const validateCartQty = (raw) => {
    const v = String(raw).trim()
    if (!v.length) return 'This is a required field.'
    const n = Number(v)
    if (!Number.isFinite(n) || !(n > 0)) return 'Please enter a number greater than 0 in this field.'
    return null
  }

  const applyUpdates = () => {
    const errs = {}
    for (const i of items) {
      const err = validateCartQty(qtyDraft[i.itemId] != null ? qtyDraft[i.itemId] : i.qty)
      if (err) errs[i.itemId] = err
    }
    setQtyErrors(errs)
    // Magento validates the whole cart form client-side: one bad row blocks the
    // submit entirely, so no line is touched and no success bar is shown.
    if (Object.keys(errs).length) return
    for (const i of items) {
      const q = Number(String(qtyDraft[i.itemId] != null ? qtyDraft[i.itemId] : i.qty).trim())
      if (q !== i.qty) updateCartQty(i.itemId, q)
    }
    addMessage('You updated your shopping cart.')
  }

  return (
    <Page title="Shopping Cart" documentTitle="Shopping Cart" sidebar="none">
      {items.length === 0 ? (
        <div className="cart-empty">
          <p>You have no items in your shopping cart.</p>
          <p>Click <SLink to="/">here</SLink> to continue shopping.</p>
        </div>
      ) : (
        <div className="cart-container">
          <div className="cart-form form-cart">
            <table id="shopping-cart-table" className="cart items data table">
              <caption className="table-caption visually-hidden">Shopping Cart Items</caption>
              <thead>
                <tr>
                  <th className="col item" scope="col"><span>Item</span></th>
                  <th className="col price" scope="col"><span>Price</span></th>
                  <th className="col qty" scope="col"><span>Qty</span></th>
                  <th className="col subtotal" scope="col"><span>Subtotal</span></th>
                </tr>
              </thead>
              {items.map(item => {
                const product = productsById.get(item.productId)
                return (
                  <tbody className="cart item" key={item.itemId}>
                    <tr className="item-info">
                      {/*
                        Source nesting (`/tmp/vwaE/cart.html`, captured from an
                        authenticated /checkout/cart/ with a 3-line cart):

                          td.col.item
                            a.product-item-photo > span.product-image-container
                            div.product-item-details
                              strong.product-item-name > a
                              dl.item-options
                                dt Size
                                dd Large
                                dt Color
                                dd Blue

                        VWA's cart evaluators select
                        `td.col.item > div > dl > dd` and three of them use
                        `dd:nth-child(4)`, so the photo link must be a SIBLING of
                        `.product-item-details` (not nested inside it), the `dl`
                        a direct child of it, and the `dt`/`dd` pairs direct
                        children of the `dl` in the order the options were
                        chosen. Wrapping each pair in a `div.item-option` — as
                        this used to — breaks both selectors.
                        The `:` after the label is CSS (`.item-options dt:after`
                        in Luma), not markup; the source `dt` reads "Size".
                      */}
                      <td className="col item" data-th="Item">
                        <SLink to={product ? `/${product.urlKey}.html` : '/checkout/cart/'}
                          title={item.name} tabIndex={-1} className="product-item-photo">
                          <ProductImage product={product} alt={item.name} />
                        </SLink>
                        <div className="product-item-details">
                          <strong className="product-item-name">
                            <SLink to={product ? `/${product.urlKey}.html` : '/checkout/cart/'}>{item.name}</SLink>
                          </strong>
                          {item.options && item.options.length > 0 && (
                            <dl className="item-options">
                              {item.options.map(o => (
                                <React.Fragment key={`${o.optionId}-${o.optionTypeId}`}>
                                  <dt>{o.label}</dt>
                                  <dd>{o.value}</dd>
                                </React.Fragment>
                              ))}
                            </dl>
                          )}
                        </div>
                      </td>
                      <td className="col price" data-th="Price">
                        <span className="price">{money(item.price)}</span>
                      </td>
                      {/*
                        BUG-P01. Transcribed attribute for attribute from the
                        source's own render (assets/html/cart.html, and
                        module-checkout/view/frontend/templates/cart/item/default.phtml
                        lines 107 and 113 in the container):

                          td.col.qty > div.field.qty > div.control.qty
                            > label[for] > span.label + input

                          <input id="cart-554-qty" name="cart[554][qty]"
                                 data-cart-item-id="B087QSCXGT" value="1"
                                 type="number" min="0" size="4" step="any"
                                 title="Qty" class="input-text qty"
                                 data-validate="…" data-item-qty="1"
                                 data-role="cart-item-qty"/>

                        `data-item-qty` is the ONLY attribute any shopping
                        evaluator reads — visualwebarena-289 / -320 / -321 do
                        `.item-info … querySelector('input').getAttribute('data-item-qty')`
                        — and it was absent, so those three scored 0 whatever the
                        agent did.

                        VALUE SEMANTICS: the source renders BOTH `value` and
                        `data-item-qty` from `$block->getQty()`, i.e. the
                        PERSISTED quote qty, and only re-renders the row on
                        `Update Shopping Cart`. So `data-item-qty` tracks
                        `item.qty`, never the in-flight `qtyDraft` — typing 5
                        without clicking Update leaves it at the stored value on
                        both sides, and clicking Update moves both together.
                        `value` keeps the draft because that is the control the
                        agent is typing into.
                      */}
                      <td className="col qty" data-th="Qty">
                        <div className="field qty">
                          <div className="control qty">
                            <label htmlFor={`cart-${item.itemId}-qty`}>
                              <span className="label">Qty</span>
                              <input
                                id={`cart-${item.itemId}-qty`}
                                name={`cart[${item.itemId}][qty]`}
                                data-cart-item-id={item.sku || (product ? product.sku : undefined)}
                                type="number"
                                min="0"
                                size="4"
                                step="any"
                                title="Qty"
                                className="input-text qty"
                                data-validate="{required:true,'validate-greater-than-zero':true}"
                                data-item-qty={item.qty}
                                data-role="cart-item-qty"
                                value={qtyDraft[item.itemId] != null ? qtyDraft[item.itemId] : item.qty}
                                onChange={e => {
                                  setQtyDraft(d => ({ ...d, [item.itemId]: e.target.value }))
                                  setQtyErrors(errs => (errs[item.itemId] ? { ...errs, [item.itemId]: null } : errs))
                                }}
                              />
                            </label>
                          </div>
                        </div>
                        {qtyErrors[item.itemId] && (
                          <div className="field-error" role="alert" id={`cart-${item.itemId}-qty-error`}>
                            {qtyErrors[item.itemId]}
                          </div>
                        )}
                      </td>
                      <td className="col subtotal" data-th="Subtotal">
                        <span className="price">{money(item.price * item.qty)}</span>
                      </td>
                    </tr>
                    {/* Source (assets/html/cart.html) renders these three as
                        INLINE anchors inside a plain `div.actions-toolbar`:
                          a.use-ajax.action.towishlist.action-towishlist > span
                          a.action.action-edit[href=/checkout/cart/configure/id/N/product_id/M/][title="Edit item parameters"] > span
                          a.action.action-delete[href="#"][title="Remove item"] > span
                        so `innerText` reads them as the single run
                        `Move to Wishlist Edit Remove item`. The mock's flex row
                        of <button>s blockified each child and split the run
                        across three lines (DIFF-R6). */}
                    <tr className="item-actions">
                      <td colSpan={4}>
                        <div className="actions-toolbar">
                          <a href="#" className="use-ajax action towishlist action-towishlist"
                            onClick={e => {
                              e.preventDefault()
                              moveToWishlist(item.itemId)
                              addMessage(`${item.name} has been moved to your wish list.`)
                            }}>
                            <span>Move to Wishlist</span>
                          </a>{' '}
                          <SLink className="action action-edit" title="Edit item parameters"
                            to={`/checkout/cart/configure/id/${item.itemId}/product_id/${item.productId}/`}>
                            <span>Edit</span>
                          </SLink>{' '}
                          <a href="#" title="Remove item" className="action action-delete"
                            onClick={e => {
                              e.preventDefault()
                              removeCartItem(item.itemId)
                              addMessage(`You removed the item.`)
                            }}>
                            <span>Remove item</span>
                          </a>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                )
              })}
            </table>

            <div className="cart-main-actions">
              <SLink to="/" className="action secondary continue">
                <ChevronLeft size={14} /> <span>Continue Shopping</span>
              </SLink>
              <button type="button" className="action secondary update" onClick={applyUpdates}>
                <RefreshIcon size={14} /> <span>Update Shopping Cart</span>
              </button>
            </div>
          </div>

          <div className="cart-summary">
            <strong className="summary title">Summary</strong>
            <div className="block shipping">
              <div className="title" role="button" tabIndex={0}
                onClick={() => setOpenShipping(o => !o)}
                onKeyDown={e => { if (e.key === 'Enter') setOpenShipping(o => !o) }}>
                <strong>Estimate Shipping and Tax</strong><ChevronDown size={14} />
              </div>
              {openShipping && (
                <div className="content" id="block-summary">
                  <form id="shipping-zip-form" onSubmit={e => e.preventDefault()}>
                    <fieldset className="fieldset estimate">
                      <legend className="legend visually-hidden"><span>Estimate Shipping and Tax</span></legend>
                      <p className="field note">Enter your destination to get a shipping estimate.</p>
                      <div className="field">
                        <label className="label" htmlFor="country"><span>Country</span></label>
                        <div className="control">
                          <select id="country" name="country_id" value={estCountry}
                            onChange={e => setEstCountry(e.target.value)}>
                            {COUNTRIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="field">
                        <label className="label" htmlFor="region_id"><span>State/Province</span></label>
                        <div className="control">
                          {estCountry === 'US' ? (
                            <select id="region_id" name="region_id" value={estRegion}
                              onChange={e => setEstRegion(e.target.value)}>
                              <option value="">Please select a region, state or province.</option>
                              {US_REGIONS.map(r => <option key={r.id} value={String(r.id)}>{r.name}</option>)}
                            </select>
                          ) : (
                            <input id="region_id" type="text" name="region" value={estRegion}
                              onChange={e => setEstRegion(e.target.value)} />
                          )}
                        </div>
                      </div>
                      <div className="field">
                        <label className="label" htmlFor="postcode"><span>Zip/Postal Code</span></label>
                        <div className="control">
                          <input id="postcode" type="text" name="postcode" value={estPostcode}
                            onChange={e => setEstPostcode(e.target.value)} />
                        </div>
                      </div>
                    </fieldset>
                  </form>
                  <form id="co-shipping-method-form">
                    <fieldset className="fieldset rate">
                      <dl className="items methods">
                        <dt className="item-title"><span>Flat Rate</span></dt>
                        <dd className="item-options">
                          <div className="field choice item">
                            <input type="radio" className="radio" name="estimate"
                              id="s_method_flatrate_flatrate" value="flatrate_flatrate"
                              checked readOnly />
                            <label className="label" htmlFor="s_method_flatrate_flatrate">
                              Fixed <span className="price">{money(shipping)}</span>
                            </label>
                          </div>
                        </dd>
                      </dl>
                    </fieldset>
                  </form>
                </div>
              )}
            </div>

            <table className="data table totals">
              <tbody>
                <tr className="totals sub">
                  <th className="mark" scope="row">Subtotal</th>
                  <td className="amount"><span className="price" data-th="Subtotal">{money(subtotal)}</span></td>
                </tr>
                <tr className="totals shipping excl">
                  <th className="mark" scope="row">
                    <span className="label">Shipping</span>{' '}
                    <span className="value">(Flat Rate - Fixed)</span>
                  </th>
                  <td className="amount"><span className="price" data-th="Shipping">{money(shipping)}</span></td>
                </tr>
                <tr className="grand totals">
                  <th className="mark" scope="row"><strong>Order Total</strong></th>
                  <td className="amount" data-th="Order Total"><strong><span className="price">{money(orderTotal)}</span></strong></td>
                </tr>
              </tbody>
            </table>

            <div className="block discount">
              <div className="title" role="button" tabIndex={0}
                onClick={() => setOpenDiscount(o => !o)}
                onKeyDown={e => { if (e.key === 'Enter') setOpenDiscount(o => !o) }}>
                <strong>Apply Discount Code</strong><ChevronDown size={14} />
              </div>
              {openDiscount && (
                <div className="content">
                  <div className="field" style={{ marginTop: 10 }}>
                    <label className="label" htmlFor="coupon_code">Enter discount code</label>
                    <input id="coupon_code" type="text" value={coupon} onChange={e => setCoupon(e.target.value)} />
                  </div>
                  <button type="button" className="action primary"
                    onClick={() => addMessage(`The coupon code "${coupon}" is not valid.`, 'error')}>
                    <span>Apply Discount</span>
                  </button>
                </div>
              )}
            </div>

            {/* Source (assets/html/cart.html):
                  <ul class="checkout methods items checkout-methods-items">
                    <li class="item"><button type="button" data-role="proceed-to-checkout"
                        title="Proceed to Checkout" class="action primary checkout">
                        <span>Proceed to Checkout</span></button></li>
                    <li class="item"><a class="action multicheckout" href="…/multishipping/checkout/">
                        <span>Check Out with Multiple Addresses</span></a></li>
                  </ul>
                The flat div ran both labels together in `innerText`
                (`Proceed to CheckoutCheck Out with Multiple Addresses`); the
                `li.item` wrappers put them on two lines as the source does
                (DIFF-R6). */}
            <ul className="checkout methods items checkout-methods-items">
              <li className="item">
                <button type="button" data-role="proceed-to-checkout" title="Proceed to Checkout"
                  className="action primary checkout" onClick={() => navigate('/checkout/')}>
                  <span>Proceed to Checkout</span>
                </button>
              </li>
              <li className="item">
                {/* Source href, measured logged-in on the live cart:
                    `http://10.186.197.203:7770/multishipping/checkout/` — the
                    `/login/` variant is the guest form. Both resolve to
                    MultishippingPage in the mock. */}
                <SLink to="/multishipping/checkout/" className="action multicheckout">
                  <span>Check Out with Multiple Addresses</span>
                </SLink>
              </li>
            </ul>
          </div>
        </div>
      )}
    </Page>
  )
}
