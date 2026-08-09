import React, { useEffect } from 'react'
import Breadcrumbs from './Breadcrumbs.jsx'
import Messages from './Messages.jsx'
import SidebarBlocks from './SidebarBlocks.jsx'
import AccountNav from './AccountNav.jsx'

/**
 * The standard content shell.
 *
 *  sidebar:
 *   'none'       — single column (page-layout-1column)
 *   'catalog'    — Shop By column + Compare/Wish List, both on the left
 *   'account'    — account nav + Compare/Wish List, both on the left
 *   'additional' — Compare/Wish List only, on the right (the 404's layout)
 *   'additional-left'
 *                — Compare/Wish List only, on the LEFT. The advanced-search
 *                  *result* page uses this: the source serves
 *                  /catalogsearch/advanced/result/ as page-layout-2columns-left
 *                  with a lone `<div class="sidebar sidebar-additional">` and no
 *                  sidebar-main, which pushes `.column.main` right by one rail.
 *                  (/catalogsearch/advanced/, the form, is genuinely 1column.)
 *
 * The source splits the column into `sidebar sidebar-main` (Shop By / account
 * nav) and `sidebar sidebar-additional` (block-compare, block-wishlist), and
 * picks a page layout per route: 2columns-left for catalog and account pages,
 * 2columns-right for the CMS 404, which has no sidebar-main at all.
 */
const LAYOUTS = {
  none: 'page-layout-1column',
  catalog: 'page-layout-2columns-left',
  account: 'page-layout-2columns-left',
  additional: 'page-layout-2columns-right',
  'additional-left': 'page-layout-2columns-left',
}

export default function Page({
  title,
  titleNode,
  breadcrumbs,
  sidebar = 'none',
  sidebarTop = null,
  documentTitle,
  pending = false,
  children,
}) {
  useEffect(() => {
    if (documentTitle || title) document.title = documentTitle || title
  }, [documentTitle, title])

  const layout = LAYOUTS[sidebar] || LAYOUTS.none
  const hasSidebar = sidebar !== 'none'
  const hasMain = sidebar === 'catalog' || sidebar === 'account'

  // Magento's `customer_account` layout handle moves `page.main.title` into the
  // content container, so on account pages ONLY the h1 sits inside
  // `.column.main` and is indented to the content column (measured on the
  // logged-in source: `.page-title-wrapper` x=641 w=939 at 1920, vs x=340
  // w=1240 on category / search / 1column / the CMS 404, where it stays a
  // direct child of `main.page-main`). Moving it unconditionally would shrink
  // every listing page's title by 207px, which the source does not do.
  const titleInMain = sidebar === 'account'
  const titleBlock = (title || titleNode) ? (
    <div className="page-title-wrapper">
      <h1 className="page-title">
        <span className="base" data-ui-id="page-title-wrapper">{titleNode || title}</span>
      </h1>
    </div>
  ) : null

  // R7-004: `pending` means one of the code-split detail seeds this page reads
  // ('descriptions' / 'reviews' — see utils/catalog.js) has not landed yet. The
  // page body is held back rather than painted half-populated, while the site
  // chrome (header, nav, minicart, footer — all rendered by <Layout> above
  // this) stays on screen. A page that reads none of them never waits.
  //
  // The `useDetailReady()` call that computes this MUST live in the page
  // component, not here: `children` is built by the page, so a re-render of
  // <Page> alone would re-show the same stale elements.
  if (pending) {
    return (
      <main id="maincontent" className={`page-main ${layout}`}>
        <a id="contentarea" tabIndex={-1} />
      </main>
    )
  }

  return (
    <>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <main id="maincontent" className={`page-main ${layout}`}>
        <a id="contentarea" tabIndex={-1} />
        <Messages />
        {!titleInMain && titleBlock}
        {/*
          Child order matches the source's: `.column.main` first, then
          `sidebar sidebar-main`, then `sidebar sidebar-additional`. It is what
          an agent reads out of the accessibility tree, so the page's own
          content has to come before the rails. The rendered layout is
          unaffected — both 2-column layouts place these by `grid-area`, and
          1column has no rail at all.
        */}
        <div className={`columns${hasSidebar ? ' has-sidebar' : ''}${sidebar === 'account' ? ' has-account-nav' : ''}`}>
          <div className="column main">
            {titleInMain && titleBlock}
            {children}
          </div>
          {hasMain && (
            <div className={`sidebar sidebar-main${sidebar === 'account' ? ' sidebar-account' : ''}`}>
              {sidebar === 'account' && <AccountNav />}
              {sidebarTop}
            </div>
          )}
          {hasSidebar && (
            <div className="sidebar sidebar-additional">
              <SidebarBlocks />
            </div>
          )}
        </div>
      </main>
    </>
  )
}
