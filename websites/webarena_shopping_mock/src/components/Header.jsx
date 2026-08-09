import React, { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useStoreNavigate, useUrlBuilder } from '../utils/url.js'
import { topCategories, childrenOf, categoryUrl, searchTerms, productsById } from '../utils/catalog.js'
import { money } from '../utils/format.js'
import { CartIcon, SearchIcon } from './Icons.jsx'
import ProductImage from './ProductImage.jsx'

/*
 * `ul.header.links`. The source renders this list TWICE: once in
 * `.panel.header` (the desktop bar) and once inside
 * `div#store.links.nav-sections-item-content`, the "Account links" tab panel of
 * the mobile nav-sections. Both copies are identical markup; the second carries
 * an inline `display:none` at desktop widths. Hence every `.header.links`
 * descendant — including the greeting — occurs twice in the source's DOM.
 */
function HeaderLinks() {
  const { state } = useApp()
  const c = state.customer
  // Magento's `customer` customer-data section exposes `fullname`; for this
  // customer it is "Emma Lopez" = firstname + ' ' + lastname.
  const fullname = [c.firstname, c.lastname].filter(Boolean).join(' ')
  const compareCount = state.compareList.items.length
  const compareCaption = compareCount === 1 ? '1 item' : `${compareCount} items`
  return (
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
      {/* DIFF-N01. The source ships this `<li>` on EVERY page, empty list or
          not — the entry point into the comparison list is site chrome, not a
          conditional. Verified in the source HTML:

            <li class="item link compare" data-bind="scope: 'compareProducts'"
                data-role="compare-products-link">
              <a class="action compare no-display" title="Compare Products"
                 data-bind="… css: {'no-display': !compareProducts().count}">
                Compare Products        <span class="counter qty"
                       data-bind="text: compareProducts().countCaption"></span>
              </a>
            </li>

          `countCaption` is Magento\Catalog\CustomerData\CompareProducts:
          `1 item` at one, `%1 items` otherwise — so the empty state reads
          `Compare Products 0 items`, not a bare `0`. The mock rendered the link
          only once the list was non-empty and printed the raw count.

          Measured on the live source at 1280x720 with an empty compare list:
          `.panel.header .action.compare` IS in the DOM, with the `no-display`
          class and a computed `display: none` / zero-area box. So the node is
          unconditional and the class carries the empty state — matched here in
          both directions. */}
      <li className="item link compare" data-role="compare-products-link">
        <SLink
          to="/catalog/product_compare/index/"
          className={`action compare${compareCount ? '' : ' no-display'}`}
          title="Compare Products"
        >
          Compare Products <span className="counter qty">{compareCaption}</span>
        </SLink>
      </li>
      {/* Magento renders this greeting from the `customer` customer-data
          section, which is populated by JS *after* first paint. Measured on the
          live container while LOGGED IN as emma.lopez@gmail.com,
          /customer/section/load/?sections=customer returns
          {"fullname":"Emma Lopez","firstname":"Emma",…}, so the Knockout
          `if: customer().fullname` branch wins and every page renders
          `<span class="logged-in">Welcome, Emma Lopez!</span>` — two of them,
          one per copy of this list.

          A previous round asserted the opposite (that the container never
          populates the section and the store greeting always shows). That
          measurement was taken on a LOGGED-OUT session, where the source really
          does render `Welcome to One Stop Market` inside
          `<span class="not-logged-in">`. The mock boots pre-logged-in, so the
          logged-in branch is the only correct one here. Re-check this only
          against a source session that reports `span.logged-in` count 2. */}
      <li className="greet welcome">
        <span className="logged-in">Welcome, {fullname}!</span>
      </li>
    </ul>
  )
}

function PanelBar() {
  return (
    <div className="panel wrapper">
      <div className="panel header">
        <a className="action skip contentarea visually-hidden" href="#contentarea"><span>Skip to Content</span></a>
        <HeaderLinks />
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
              {/*
                The source's button is
                  <button type="submit" title="Search" class="action search"
                          aria-label="Search" disabled><span>Search</span></button>
                — the label lives in a clipped <span> (Luma's abs-visually-hidden:
                position:absolute; 1x1; margin:-1px; clip:rect(0,0,0,0)), and the
                magnifier is an ::before icon-font glyph, so `innerText` reads
                'Search' on a 22x32 button. Magento's quickSearch widget keeps the
                button `disabled` until the input holds `minSearchLength` = 3
                characters; measured on the live source: '' → disabled,
                'a' → disabled, 'ab' → disabled, 'abc' → enabled.
              */}
              <button
                type="submit"
                title="Search"
                className="action search"
                aria-label="Search"
                disabled={value.length < 3}
              >
                <SearchIcon size={18} />
                <span className="visually-hidden">Search</span>
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
      {/* DIFF-N02. The source's showcart is an `<a href="…/checkout/cart/">`
          whose FIRST child is `<span class="text">My Cart</span>`; the counter
          follows it and carries `empty` while the cart is empty:

            <a class="action showcart" href="…/checkout/cart/">
              <span class="text">My Cart</span>
              <span class="counter qty empty">
                <span class="counter-number">3</span>
                <span class="counter-label">3 items</span>
              </span>
            </a>

          The mock rendered the counter alone, so `.action.showcart` innerText
          was `3` where the source reads `My Cart`. The click still opens the
          minicart flyout rather than following the href, which is what the
          source's JS does too. */}
      <SLink
        to="/checkout/cart/"
        className="action showcart"
        aria-label="My Cart"
        onClick={e => { e.preventDefault(); setOpen(o => !o) }}
      >
        <CartIcon />
        <span className="text">My Cart</span>
        <span className={`counter qty${count > 0 ? '' : ' empty'}`}>
          <span className="counter-number">{count > 0 ? count : ''}</span>
          <span className="counter-label">{count > 0 ? `${count} ${count === 1 ? 'item' : 'items'}` : ''}</span>
        </span>
      </SLink>
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
      {/* Luma's mobile "Account links" tab panel. The source ships it on every
          page inside `.sections.nav-sections` with an inline `display: none` at
          desktop widths, carrying a second, identical copy of
          `ul.header.links` — which is why `span.logged-in` counts 2 on the
          source and not 1. Kept hidden so it contributes nothing to `innerText`
          or to hit-testing, exactly as on the source at 1280px and up. */}
      <div className="section-item-content nav-sections-item-content" id="store.links"
        data-role="content" role="tabpanel" aria-hidden="true" style={{ display: 'none' }}>
        <HeaderLinks />
      </div>
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
