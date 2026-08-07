import React, { useEffect } from 'react'
import SiteNav from './SiteNav.jsx'
import Footer from './Footer.jsx'
import Icon from '../Icon.jsx'
import { useApp } from '../../context/AppContext.jsx'

// templates/base.html.twig body order — see assets/README.md §0.
//
//   .site-alerts
//   nav.site-accessibility-nav
//   nav.site-nav
//   .site-content.content-container
//       main#main.site-content__body.body.flow
//       aside#sidebar.site-content__sidebar.sidebar.flow
//   footer.site-footer
//
// `id="main"` and `id="sidebar"` are WebArena evaluator locators
// (`#sidebar > section` is read by webarena-595..599). Do not rename them.

export default function Layout({ children, sidebar = null, title = null }) {
  const { flashes, dismissFlash } = useApp()

  useEffect(() => {
    document.title = title ? `${title}` : 'Xostmill'
  }, [title])

  return (
    <>
      <div className="site-alerts">
        {flashes.map(f => (
          <div key={f.id} className={`alert alert--${f.type} site-alerts__alert bg-${f.type === 'error' ? 'red' : 'green'}`} role="alert">
            <div className="alert__icon" aria-hidden="true">
              <Icon name={f.type === 'error' ? 'attention' : 'ok-circled'} />
            </div>
            <div className="alert__text"><p>{f.message}</p></div>
            <button className="site-alerts__dismiss unbuttonize" onClick={() => dismissFlash(f.id)}>
              <span className="hidden">Dismiss</span>
            </button>
          </div>
        ))}
      </div>

      <nav className="site-accessibility-nav">
        <a href="#main" className="site-accessibility-nav__link">Jump to main content</a>
        <a href="#sidebar" className="site-accessibility-nav__link">Jump to sidebar</a>
      </nav>

      <SiteNav />

      <div className="site-content content-container">
        <main className="site-content__body body flow" id="main">{children}</main>
        <aside className="site-content__sidebar sidebar flow" id="sidebar">{sidebar}</aside>
      </div>

      <Footer />
    </>
  )
}
