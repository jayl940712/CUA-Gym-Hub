import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import AdminLink from './AdminLink.jsx'
import Icon from './Icon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useSidNavigate } from '../../utils/navigation.js'
import { getProducts, getCustomers, getOrderGridRows } from '../../utils/selectors.js'
import { formatIncrementId } from '../../utils/formatters.js'

/**
 * `.page-header` — page title on the left, global search / notifications /
 * admin account on the right (assets/html/dashboard.html).
 *
 * The global-search dropdown reproduces the source's `search-suggest` template:
 * four fixed "<term> in Products/Orders/Customers/Pages" rows carrying the
 * element ids the source uses, followed by matched records.
 * `data-notification-count` is 0 in this deployment and the bell is a plain
 * link to the Notifications grid, not a dropdown.
 */
export default function AdminHeader({ title }) {
  const { state, currentUser, addMessage } = useApp()
  const navigate = useSidNavigate()
  const location = useLocation()
  const [term, setTerm] = useState('')
  const [suggestOpen, setSuggestOpen] = useState(false)
  const [accountOpen, setAccountOpen] = useState(false)
  const wrapRef = useRef(null)

  useEffect(() => { setSuggestOpen(false); setAccountOpen(false) }, [location.pathname])

  useEffect(() => {
    function onDocClick(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setSuggestOpen(false)
        setAccountOpen(false)
      }
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [])

  const trimmed = term.trim()
  const matches = trimmed.length >= 2 ? buildMatches(state, trimmed) : []

  function submit(e) {
    e.preventDefault()
    if (!trimmed) return
    setSuggestOpen(false)
    navigate(`/admin/catalog/product/index/?search=${encodeURIComponent(trimmed)}`)
  }

  const enc = encodeURIComponent(trimmed)

  return (
    <header className="page-header row" ref={wrapRef}>
      <div className="page-header-hgroup">
        <div className="page-title-wrapper">
          <h1 className="page-title">{title}</h1>
        </div>
      </div>

      <div className="page-header-actions">
        <div className="search-global">
          <form id="form-search" onSubmit={submit} role="search">
            <div className="search-global-field">
              <label className="search-global-label" htmlFor="search-global" />
              {/* The source splits the global search into two elements:
                * `<input type="hidden" name="query">` (the value the form posts)
                * and an unnamed `<input type="text" id="search-global">` the user
                * types into. The mock used to merge them into one named text
                * input, so `[name="query"]` resolved to a text box on all 47
                * form routes swept — element-kind drift on every page. */}
              <input type="hidden" name="query" value={term} readOnly />
              <input
                type="text"
                className="search-global-input"
                id="search-global"
                autoComplete="off"
                value={term}
                onChange={e => { setTerm(e.target.value); setSuggestOpen(true) }}
                onFocus={() => setSuggestOpen(true)}
              />
              <button type="submit" className="search-global-action" title="Search">
                <Icon name="search" size={22} />
              </button>
            </div>
          </form>

          {suggestOpen && trimmed.length >= 2 ? (
            <div className="autocomplete-results">
              <ul className="search-global-menu">
                <li className="item">
                  <AdminLink id="searchPreviewProducts" className="title" to={`/admin/catalog/product/index/?search=${enc}`}>
                    "{trimmed}" in Products
                  </AdminLink>
                </li>
                <li className="item">
                  <AdminLink id="searchPreviewOrders" className="title" to={`/admin/sales/order/index/?search=${enc}`}>
                    "{trimmed}" in Orders
                  </AdminLink>
                </li>
                <li className="item">
                  <AdminLink id="searchPreviewCustomers" className="title" to={`/admin/customer/index/index/?search=${enc}`}>
                    "{trimmed}" in Customers
                  </AdminLink>
                </li>
                <li className="item">
                  <AdminLink id="searchPreviewPages" className="title" to={`/admin/cms/page/index/?search=${enc}`}>
                    "{trimmed}" in Pages
                  </AdminLink>
                </li>
                {matches.map(m => (
                  <li className="item" key={m.url}>
                    <AdminLink to={m.url} className="title">{m.name}</AdminLink>
                    <span className="type">{m.type}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="notifications-wrapper admin__action-dropdown-wrap" data-notification-count="0">
          <AdminLink to="/admin/admin/notification/index/" className="notifications-action admin__action-dropdown" title="Notifications">
            <Icon name="bell" size={22} />
          </AdminLink>
        </div>

        <div className={`admin-user admin__action-dropdown-wrap${accountOpen ? ' _active' : ''}`}>
          <button
            type="button"
            className="admin__action-dropdown"
            title="My Account"
            aria-expanded={accountOpen}
            onClick={() => setAccountOpen(o => !o)}
          >
            <Icon name="user" size={20} />
            <span className="admin__action-dropdown-text">
              <span className="admin-user-account-text">{currentUser.username}</span>
            </span>
            <span className="admin__action-dropdown-caret" aria-hidden="true" />
          </button>
          <ul className="admin__action-dropdown-menu" hidden={!accountOpen}>
            <li>
              <AdminLink to="/admin/admin/system_account/index/" data-ui-id="user-user-account-settings" title="Account Setting">
                Account Setting (<span className="admin-user-name">{currentUser.username}</span>)
              </AdminLink>
            </li>
            <li>
              {/* HANDLERS-019. The source is
                  `<a href="http://<host>:7780/" title="Customer View" target="_blank"
                      class="store-front">` — it opens the storefront. Storefront
                  routes are out of scope for this mock, so linking to `/` just
                  bounced to the dashboard, which reads as a broken link. Decline
                  explicitly instead, keeping the source's title/class. */}
              <a
                href="/"
                title="Customer View"
                className="store-front"
                onClick={e => {
                  e.preventDefault()
                  setAccountOpen(false)
                  addMessage('The storefront is not part of this admin mock.', 'notice')
                }}
              >
                Customer View
              </a>
            </li>
            <li>
              {/* The mock boots pre-logged-in and has no auth; Sign Out is inert
                  by design (TODO.md "Out of Scope"). */}
              <button type="button" className="admin-user-signout" title="Sign Out" onClick={() => setAccountOpen(false)}>
                Sign Out
              </button>
            </li>
          </ul>
        </div>
      </div>
    </header>
  )
}

function buildMatches(state, term) {
  const needle = term.toLowerCase()
  const out = []

  for (const p of getProducts(state)) {
    if (out.length >= 4) break
    if (String(p.name || '').toLowerCase().includes(needle) || String(p.sku || '').toLowerCase().includes(needle)) {
      out.push({ name: p.name, type: 'Product', url: `/admin/catalog/product/edit/id/${p.entity_id}/` })
    }
  }
  for (const c of getCustomers(state)) {
    if (out.length >= 8) break
    if (String(c.name || '').toLowerCase().includes(needle) || String(c.email || '').toLowerCase().includes(needle)) {
      out.push({ name: c.name, type: 'Customer', url: `/admin/customer/index/edit/id/${c.entity_id}/` })
    }
  }
  for (const o of getOrderGridRows(state)) {
    if (out.length >= 12) break
    const inc = o.increment_id || formatIncrementId(o.entity_id)
    if (inc.includes(needle) || String(o.billing_name || '').toLowerCase().includes(needle)) {
      out.push({ name: inc, type: 'Order', url: `/admin/sales/order/view/order_id/${o.entity_id}/` })
    }
  }
  return out
}
