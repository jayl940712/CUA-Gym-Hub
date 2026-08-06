import React from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Header from './Header.jsx'
import Footer from './Footer.jsx'
import { SLink } from '../utils/url.js'

/** Checkout and the print view drop the full site chrome, as in the source. */
function isMinimalChrome(pathname) {
  const p = pathname.replace(/\/+$/, '')
  return p === '/checkout' || p === '/checkout/onepage/success' || p.startsWith('/sales/order/print')
}

export default function Layout() {
  const { pathname } = useLocation()
  const minimal = isMinimalChrome(pathname)
  const printView = pathname.replace(/\/+$/, '').startsWith('/sales/order/print')

  if (printView) {
    return (
      <div className="page-wrapper">
        <Outlet />
      </div>
    )
  }

  if (minimal) {
    return (
      <div className="page-wrapper">
        <header className="page-header">
          <div className="checkout-header">
            <SLink to="/" className="logo" title="one_stop_market_logo" aria-label="store logo">One Stop Market</SLink>
          </div>
        </header>
        <Outlet />
      </div>
    )
  }

  return (
    <div className="page-wrapper">
      <Header />
      <Outlet />
      <Footer />
    </div>
  )
}
