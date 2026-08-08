import React from 'react'
import { useLocation } from 'react-router-dom'
import Layout from '../Layout.jsx'
import Breadcrumb from '../Breadcrumb.jsx'
import UserSidebar from './UserSidebar.jsx'
import Flash from './Flash.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { indexUrl } from '../../utils/urls.js'

/**
 * Shell shared by every `page=user` view.
 *
 * Source breadcrumb is `Classifieds > Account > <crumb>`, where `Account` links
 * to `page=user&action=dashboard` (which 302s to `action=items`).
 * `#sidebar` (210 px, left) and `#main` (728 px, right) both live inside
 * `.wrapper#content`, so they are passed as Layout children.
 *
 * A flash message can also arrive through router state, e.g. after
 * `item_delete` redirects here: navigate(url, { state: { flash: '…' } }).
 *
 * Props: title, bodyClass, crumb, flash, flashType, children
 */
export default function UserPage({
  title, bodyClass = 'user user-profile', crumb, flash = null, flashType = 'ok', children
}) {
  const { sid } = useApp()
  const location = useLocation()
  // Router-state flash, accepted in either shape: a bare string (the user
  // pages' own convention) or the `{type,msg}` object the item pages use, so an
  // error-typed flash — e.g. `item_edit` on a listing you do not own — keeps its
  // `.flashmessage-error` class.
  const raw = location.state && location.state.flash ? location.state.flash : null
  const routed = typeof raw === 'string' ? raw : (raw && raw.msg) || null
  const routedType = raw && typeof raw === 'object' && raw.type ? raw.type : null

  const breadcrumb = (
    <Breadcrumb crumbs={[
      { label: 'Account', to: indexUrl({ page: 'user', action: 'dashboard' }, sid) },
      { label: crumb }
    ]} />
  )

  return (
    <Layout bodyClass={bodyClass} title={title} breadcrumb={breadcrumb}>
      <Flash message={flash || routed} type={flash ? flashType : (routedType || flashType)} />
      <UserSidebar />
      <div id="main">{children}</div>
    </Layout>
  )
}
