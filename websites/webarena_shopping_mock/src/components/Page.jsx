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
  children,
}) {
  useEffect(() => {
    if (documentTitle || title) document.title = documentTitle || title
  }, [documentTitle, title])

  const layout = LAYOUTS[sidebar] || LAYOUTS.none
  const hasSidebar = sidebar !== 'none'
  const hasMain = sidebar === 'catalog' || sidebar === 'account'

  return (
    <>
      {breadcrumbs && <Breadcrumbs items={breadcrumbs} />}
      <main id="maincontent" className={`page-main ${layout}`}>
        <a id="contentarea" tabIndex={-1} />
        <Messages />
        {(title || titleNode) && (
          <div className="page-title-wrapper">
            <h1 className="page-title">
              <span className="base" data-ui-id="page-title-wrapper">{titleNode || title}</span>
            </h1>
          </div>
        )}
        <div className={`columns${hasSidebar ? ' has-sidebar' : ''}${sidebar === 'account' ? ' has-account-nav' : ''}`}>
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
          <div className="column main">{children}</div>
        </div>
      </main>
    </>
  )
}
