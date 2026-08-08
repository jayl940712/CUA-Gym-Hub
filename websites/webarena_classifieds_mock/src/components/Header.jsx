import React from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { indexUrl, homeUrl } from '../utils/urls.js'

/**
 * The global header. White bar, padding 10px 15px; body:not(.home) draws the
 * bottom hairline. Nav order on the source (logged in): My account, Logout,
 * then the solid black "Publish Ad" pill.
 */
export default function Header() {
  const { sid } = useApp()
  return (
    <header>
      <div className="wrapper">
        <div className="box">
          <div id="logo">
            <Link to={homeUrl(sid)}>
              <img border="0" alt="Classifieds" src="/img/sigma_logo.png" />
            </Link>
          </div>

          <div className="menu-icon isTablet isMobile">
            <div>
              <span className="l1"></span>
              <span className="l2"></span>
              <span className="l3"></span>
            </div>
          </div>

          <div className="nav">
            <Link to={homeUrl(sid)} className="isMobile">Home</Link>
            <Link className="isMobile" to={indexUrl({ page: 'item', action: 'item_add' }, sid)}>Publish Ad</Link>
            <Link to={indexUrl({ page: 'contact' }, sid)} className="isMobile">Contact</Link>

            <Link to={indexUrl({ page: 'user', action: 'dashboard' }, sid)}>My account</Link>
            <Link to={indexUrl({ page: 'main', action: 'logout' }, sid)}>Logout</Link>

            <Link className="publish isTablet isDesktop" to={indexUrl({ page: 'item', action: 'item_add' }, sid)}>Publish Ad</Link>
          </div>
        </div>
      </div>
    </header>
  )
}
