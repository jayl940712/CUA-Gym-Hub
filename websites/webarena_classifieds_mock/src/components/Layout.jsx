import React, { useEffect } from 'react'
import Header from './Header.jsx'
import Footer from './Footer.jsx'

/**
 * The app shell.
 *
 * `bodyClass` is load-bearing: the sigma stylesheet keys the #main / #sidebar
 * column widths off it (`home` 640 left / no rail, `search`+`user` 210 left +
 * 728 right, `item` 640 left + 300 right, `item item-post` 760). The source also
 * `has-searchbox` is NOT unconditional. `sigma/functions.php:634` gates it on
 * `osc_is_home_page() || osc_is_search_page()`, so the source emits
 * `<body class="has-searchbox home">` and `<body class="has-searchbox search">`
 * but a bare `<body class="item">` / `contact` / `user user-items` everywhere
 * else — measured live on all five. (TEST DIFF-003.)
 *
 * Props:
 *   bodyClass  string   e.g. "home" | "search" | "item" | "item item-post" | "user user-items"
 *   title      string   full <title> text, e.g. "Books - Classifieds"
 *   breadcrumb node     optional, rendered into .wrapper-flash above the content
 *   hero       node     optional, rendered between <header> and <section> (home only)
 *   flash      node     optional, rendered into .wrapper-flash.flash2
 *   children   node     the page body, placed inside .wrapper#content
 */
export default function Layout({ bodyClass = '', title = 'Classifieds', breadcrumb = null, hero = null, flash = null, children }) {
  useEffect(() => {
    const first = String(bodyClass).split(' ')[0]
    const hasSearchbox = first === 'home' || first === 'search'
    document.body.className = [hasSearchbox ? 'has-searchbox' : '', bodyClass].filter(Boolean).join(' ')
  }, [bodyClass])

  useEffect(() => {
    document.title = title
  }, [title])

  return (
    <>
      <Header />
      {hero}
      <section>
        {breadcrumb ? (
          <div className="wrapper wrapper-flash">
            <div className="breadcrumb">
              {breadcrumb}
              <div className="clear"></div>
            </div>
          </div>
        ) : null}

        {/* `osc_show_flash_message()` renders here on the source (header.php:121). */}
        <div className="wrapper wrapper-flash flash2">{flash}</div>

        <div className="wrapper" id="content">
          {children}
        </div>
      </section>
      <Footer />
    </>
  )
}
