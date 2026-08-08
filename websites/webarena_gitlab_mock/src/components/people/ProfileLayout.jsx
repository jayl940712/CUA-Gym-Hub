import React from 'react'
import { useLocation } from 'react-router-dom'
import { usePageChrome } from '../layout/Layout.jsx'

// assets/README.md §22a — the `/-/profile*` family renders inside a
// `User Settings` contextual sidebar.
//
// TEST.md BUG-701: that sidebar used to be rendered HERE, as an `<aside
// className="nav-sidebar">` inside `#content-body`, laid out as a flex child.
// But `.nav-sidebar` is `position: fixed; left: 0; z-index: 600` in
// `global.css` (it has to be — that is what the source's left rail is), so the
// aside left the flow and pinned itself to the viewport's left edge while its
// flex sibling expanded to the full container width underneath it. Above
// ~1900px the centred container happened to clear it; at 1280 the content
// column started at x=16 and every label — and every submit button — sat under
// the nav, un-clickable.
//
// The sidebar now lives in `components/layout/UserSettingsSidebar.jsx` as a
// sibling of `.content-wrapper`, which is where `profile-preferences.html`
// puts it, and `routeContext.js` gives `/-/profile*` its own `kind` so
// `Layout.jsx` builds the whole Shell B chrome for it — left gutter, 990px
// `limit-container-width` container, breadcrumb bar and all.
//
// What is left here is the page's own breadcrumb leaf. Kept as a component so
// the six profile pages keep their `<ProfileLayout crumb="…">` call sites.

export default function ProfileLayout({ crumb, children }) {
  const { pathname } = useLocation()
  usePageChrome({ breadcrumbExtra: crumb ? [{ text: crumb, href: pathname }] : null })
  return <>{children}</>
}
