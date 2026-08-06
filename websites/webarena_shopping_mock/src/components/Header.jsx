import React, { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useStoreNavigate, useUrlBuilder } from '../utils/url.js'
import { topCategories, childrenOf, categoryUrl, searchTerms, storeConfig, productsById } from '../utils/catalog.js'
import { money } from '../utils/format.js'
import { CartIcon, SearchIcon } from './Icons.jsx'
import ProductImage from './ProductImage.jsx'

function PanelBar() {
  const { state } = useApp()
  return (
    <div className="panel wrapper">
      <div className="panel header">
        <a className="action skip contentarea visually-hidden" href="#contentarea"><span>Skip to Content</span></a>
        <ul className="header links">
          <li><SLink to="/customer/account/">My Account</SLink></li>
          <li className="link wishlist">
            <SLink to="/wishlist/">My Wish List
              {state.wishlist.items.length > 0 && (
                <span className="counter qty"> {state.wishlist.items.length} items</span>
              )}
            </SLink>
          </li>
          {/* The source shows a Sign Out link; the mock boots pre-logged-in and
              never gates anything, so it simply returns you to the storefront. */}
          <li className="link authorization-link"><SLink to="/">Sign Out</SLink></li>
          {state.compareList.items.length > 0 && (
            <li className="item link compare">
              <SLink to="/catalog/product_compare/index/" className="action compare" title="Compare Products">
                Compare Products <span className="counter qty">{state.compareList.items.length}</span>
              </SLink>
            </li>
          )}
          {/* Magento renders this greeting from the `customer` customer-data
              section. In this deployment that section comes back as
              {"data_id":…} with no `fullname` — verified against
              /customer/section/load/ on the live container — so the Knockout
              `ifnot: customer().fullname` branch wins and every page, including
              the authenticated ones, shows the store greeting. Reference
              captures 14-cart.png and 15-account-dashboard.png agree. */}
          <li className="greet welcome">
            <span className="not-logged-in">{storeConfig.welcomeMessage}</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

function SearchBlock() {
  const { query } = useUrlBuilder()
  const navigate = useStoreNavigate()
  const initial = query.q || ''
  const [value, setValue] = useState(initial)
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)

  useEffect(() => { setValue(initial) }, [initial])

  useEffect(() => {
    const onDocClick = e => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  // The source opens the autocomplete at >= 3 characters and lists previous
  // search terms with their result counts.
  const suggestions = value.trim().length >= 3
    ? searchTerms
        .filter(t => t.queryText.toLowerCase().includes(value.trim().toLowerCase()))
        .slice(0, 10)
    : []

  const submit = (term) => {
    const q = (term != null ? term : value).trim()
    if (!q) return
    setOpen(false)
    navigate('/catalogsearch/result/', { q })
  }

  return (
    <div className="block block-search" ref={boxRef}>
      <div className="block block-title visually-hidden"><strong>Search</strong></div>
      <div className="block block-content">
        <form className="form minisearch" id="search_mini_form" onSubmit={e => { e.preventDefault(); submit() }}>
          <div className="field search">
            <label className="label visually-hidden" htmlFor="search"><span>Search</span></label>
            <div className="control">
              <input
                id="search"
                type="text"
                name="q"
                value={value}
                autoComplete="off"
                maxLength={128}
                placeholder="Search entire store here..."
                className="input-text"
                onChange={e => { setValue(e.target.value); setOpen(true) }}
                onFocus={() => setOpen(true)}
              />
              <button type="submit" title="Search" className="action search" aria-label="Search">
                <SearchIcon size={18} />
              </button>
              {open && suggestions.length > 0 && (
                <div id="search_autocomplete" className="search-autocomplete">
                  <ul>
                    {suggestions.map(s => (
                      <li key={s.queryId} onMouseDown={() => submit(s.queryText)}>
                        <span className="qs-option-name">{s.queryText}</span>
                        <span className="amount">{s.numResults}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="nested">
                <SLink className="action advanced" to="/catalogsearch/advanced/">Advanced Search</SLink>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

function MiniCart() {
  const { state, updateCartQty } = useApp()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const items = state.cart.items
  const count = items.reduce((s, i) => s + i.qty, 0)
  const subtotal = items.reduce((s, i) => s + i.price * i.qty, 0)

  useEffect(() => {
    const onDocClick = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  return (
    <div data-block="minicart" className="minicart-wrapper" ref={ref}>
      <button type="button" className="action showcart" onClick={() => setOpen(o => !o)} aria-label="My Cart">
        <CartIcon />
        {count > 0 && <span className="counter qty"><span className="counter-number">{count}</span></span>}
      </button>
      {open && (
        <div className="block block-minicart">
          <div id="minicart-content-wrapper">
            <strong className="subtitle">My Cart</strong>
            {items.length === 0 ? (
              <p className="empty">You have no items in your shopping cart.</p>
            ) : (
              <>
                <div className="subtotal">
                  <span className="label">Subtotal</span>
                  <span className="price">{money(subtotal)}</span>
                </div>
                <ol className="minicart-items">
                  {items.map(item => {
                    const product = productsById.get(item.productId)
                    return (
                      <li className="minicart-item" key={item.itemId}>
                        <ProductImage product={product} alt={item.name} />
                        <div className="product-item-details">
                          <strong className="product-item-name">
                            <SLink to={product ? `/${product.urlKey}.html` : '/checkout/cart/'} onClick={() => setOpen(false)}>
                              {item.name}
                            </SLink>
                          </strong>
                          <div className="price">{money(item.price)}</div>
                          <div className="details-qty">
                            <label className="label" htmlFor={`cart-item-${item.itemId}-qty`}>Qty</label>{' '}
                            <input
                              id={`cart-item-${item.itemId}-qty`}
                              type="number"
                              min="1"
                              value={item.qty}
                              style={{ width: 48, height: 26, display: 'inline-block' }}
                              onChange={e => updateCartQty(item.itemId, Math.max(1, parseInt(e.target.value, 10) || 1))}
                            />
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ol>
                <div className="actions">
                  <SLink to="/checkout/" className="action primary" onClick={() => setOpen(false)}>Proceed to Checkout</SLink>
                  <SLink to="/checkout/cart/" onClick={() => setOpen(false)}>View and Edit Cart</SLink>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function MenuNode({ cat, level }) {
  const kids = childrenOf(cat.id)
  return (
    <li className={`level${level} category-item${kids.length ? ' parent' : ''}`}>
      <SLink to={categoryUrl(cat)}><span>{cat.name}</span></SLink>
      {kids.length > 0 && (
        <ul className={`level${level} submenu`}>
          {kids.map(k => <MenuNode key={k.id} cat={k} level={level + 1} />)}
        </ul>
      )}
    </li>
  )
}

function NavBand() {
  const { pathname } = useLocation()
  // The top-level item for the category you are currently inside gets the
  // orange underline.
  const activeTopId = (() => {
    const path = pathname.replace(/^\/+/, '').replace(/\.html$/, '')
    for (const cat of topCategories) {
      if (path === cat.urlPath || path.startsWith(`${cat.urlPath}/`)) return cat.id
    }
    return null
  })()
  return (
    <div className="sections nav-sections">
      <nav className="navigation" data-action="navigation">
        <ul>
          {topCategories.map(cat => {
            const kids = childrenOf(cat.id)
            return (
              <li key={cat.id} className={`level0 category-item level-top${kids.length ? ' parent' : ''}${activeTopId === cat.id ? ' active' : ''}`}>
                <SLink to={categoryUrl(cat)} className="level-top"><span>{cat.name}</span></SLink>
                {kids.length > 0 && (
                  <ul className="level0 submenu">
                    {kids.map(k => <MenuNode key={k.id} cat={k} level={1} />)}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

export default function Header() {
  return (
    <header className="page-header">
      <PanelBar />
      <div className="header content">
        <SLink to="/" className="logo" title="one_stop_market_logo" aria-label="store logo">One Stop Market</SLink>
        <div className="header-right">
          <SearchBlock />
          <MiniCart />
        </div>
      </div>
      <NavBand />
    </header>
  )
}
