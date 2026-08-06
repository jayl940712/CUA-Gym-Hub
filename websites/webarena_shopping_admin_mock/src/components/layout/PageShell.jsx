import React, { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import AdminHeader from './AdminHeader.jsx'
import MessagesBanner from './MessagesBanner.jsx'
import { adminDocumentTitle } from './adminMenu.js'

/**
 * Standard page frame for every admin route:
 *
 *   .page-header      page title + global search / notifications / account
 *   main.page-content
 *     .page-main-actions   messages, then the .page-actions button row
 *     …children
 *
 * The Magento admin has no breadcrumb trail (verified: no `breadcrumb*` class
 * appears in any of the 93 captured pages) — the page title is the whole
 * orientation cue, so do not invent one.
 *
 * `actions` renders into `.page-actions`; give each button its source id
 * (`#back`, `#order_ship`, …) because tasks assert on them.
 */
/**
 * Magento's `Magento\Backend\Block\Widget\Button` writes BOTH an `id` and a
 * `data-ui-id` on every page-action button, and the `data-ui-id` is derived
 * mechanically from the button id:
 *
 *   id="add"            -> data-ui-id="add-button"
 *   id="create_folder"  -> data-ui-id="create-folder-button"
 *   id="save-button"    -> data-ui-id="save-button"          (already suffixed)
 *
 * Container blocks prepend their own name, e.g. the Stores grid container emits
 * `adminhtml-system-store-container-add-button`; pass `actionsUiPrefix` for
 * those. Verified live against the source on 33 pages (round 8).
 *
 * Deriving it here rather than per page is what stops the "fixed on one page,
 * still missing on the other 83" failure mode: every route that hands PageShell
 * an `actions` row gets its `data-ui-id`s for free.
 */
export function buttonUiId(id, prefix = '') {
  if (!id) return null
  const kebab = String(id).replace(/_/g, '-')
  return `${prefix}${kebab.endsWith('-button') ? kebab : `${kebab}-button`}`
}

function withUiIds(node, prefix) {
  return React.Children.map(node, child => {
    if (!React.isValidElement(child)) return child
    const { props } = child
    // Recurse through wrapper elements (split buttons live in a <div>).
    const kids = props?.children != null && typeof child.type !== 'function'
      ? withUiIds(props.children, prefix)
      : props?.children
    // A page opts out (for the handful of source buttons that carry an `id`
    // and no `data-ui-id`) by passing `data-ui-id={null}` — the key being
    // present at all suppresses the derivation.
    const needsUiId = (child.type === 'button' || child.type === 'input')
      && props.id && !('data-ui-id' in props)
    if (!needsUiId) {
      return kids === props?.children ? child : React.cloneElement(child, undefined, kids)
    }
    return React.cloneElement(child, { 'data-ui-id': buttonUiId(props.id, prefix) }, kids)
  })
}

export default function PageShell({
  title, documentTitle, actions, children, contentClassName = '', actionsUiPrefix = '',
}) {
  const { pathname } = useLocation()
  useEffect(() => {
    // Source shape: "<page title> / <menu path> / Magento Admin" — the menu
    // path comes off the rail definition (see adminMenu.js `menuTitlePath`).
    const pageTitle = documentTitle || title
    document.title = adminDocumentTitle(pathname, pageTitle)
  }, [title, documentTitle, pathname])

  return (
    <>
      <AdminHeader title={title} />
      <main id="anchor-content" className={`page-content ${contentClassName}`.trim()}>
        <div className="page-main-actions">
          <MessagesBanner />
          {actions ? (
            <div className="page-actions floating-header" data-ui-id="page-actions-toolbar-content-header">
              {withUiIds(actions, actionsUiPrefix)}
            </div>
          ) : null}
        </div>
        {children}
      </main>
    </>
  )
}
