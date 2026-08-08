import React from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import Icon from './Icon.jsx'
import { UserAvatar } from './Avatar.jsx'

// The `/-/profile*` contextual sidebar. Item order, labels, hrefs, icon names
// and the fly-out sub-lists are transcribed from the source capture
// `assets/html/profile-preferences.html`; the `data-qa-selector` attributes are
// on exactly the four items that carry them there.
//
// This used to live inside `components/people/ProfileLayout.jsx`, nested in
// `#content-body` as an intended flex child — but `.nav-sidebar` is
// `position: fixed` (global.css), so it left the flow and overlaid the form
// below ~1900px (TEST.md BUG-701). It is a sibling of `.content-wrapper` now,
// which is where the source puts it.

const ITEMS = [
  { label: 'Profile', href: '/-/profile', icon: 'profile', liClass: 'home' },
  { label: 'Account', href: '/-/profile/account', icon: 'account', qa: 'profile_account_link' },
  { label: 'Applications', href: '/-/profile/applications', icon: 'applications' },
  { label: 'Chat', href: '/-/profile/chat_names', icon: 'comment' },
  { label: 'Access Tokens', href: '/-/profile/personal_access_tokens', icon: 'token' },
  { label: 'Emails', href: '/-/profile/emails', icon: 'mail', qa: 'profile_emails_link' },
  { label: 'Password', href: '/-/profile/password/edit', icon: 'lock', qa: 'profile_password_link' },
  { label: 'Notifications', href: '/-/profile/notifications', icon: 'notifications' },
  { label: 'SSH Keys', href: '/-/profile/keys', icon: 'key' },
  { label: 'GPG Keys', href: '/-/profile/gpg_keys', icon: 'key' },
  { label: 'Preferences', href: '/-/profile/preferences', icon: 'preferences' },
  { label: 'Active Sessions', href: '/-/profile/active_sessions', icon: 'monitor-lines' },
  // The fly-out repeats this one with different capitalisation on the source.
  { label: 'Authentication log', href: '/-/profile/audit_log', icon: 'log', flyOut: 'Authentication Log' },
]

export default function UserSettingsSidebar() {
  const { state, sidebarCollapsed, setSidebarCollapsed } = useApp()
  const { pathname } = useLocation()
  const user = state.currentUser

  return (
    <aside aria-label="User settings"
      className={`nav-sidebar${sidebarCollapsed ? ' sidebar-collapsed-desktop js-sidebar-collapsed' : ''}`}>
      <div className="nav-sidebar-inner-scroll">
        <div className="context-header">
          <a title="Profile Settings" className="has-tooltip" data-container="body"
            data-placement="right" href="/-/profile">
            <UserAvatar user={user} size={32} className="gl-mr-3 js-sidebar-user-avatar" />
            <span className="sidebar-context-title">User Settings</span>
          </a>
        </div>
        <ul className="sidebar-top-level-items">
          {ITEMS.map(it => {
            const active = pathname.replace(/\/+$/, '') === it.href
            const li = [it.liClass, active ? 'active' : ''].filter(Boolean).join(' ')
            return (
              <li key={it.href} className={li}>
                <a href={it.href} {...(it.qa ? { 'data-qa-selector': it.qa } : {})}>
                  <div className="nav-icon-container"><Icon name={it.icon} /></div>
                  <span className="nav-item-name">{it.label}</span>
                </a>
                <ul className="sidebar-sub-level-items is-fly-out-only">
                  <li className="fly-out-top-item">
                    <a href={it.href}>
                      <strong className="fly-out-top-item-name">{it.flyOut || it.label}</strong>
                    </a>
                  </li>
                </ul>
              </li>
            )
          })}
        </ul>
        <a className="toggle-sidebar-button js-toggle-sidebar rspec-toggle-sidebar" role="button"
          title="Toggle sidebar" type="button" onClick={() => setSidebarCollapsed(c => !c)}>
          <Icon name={sidebarCollapsed ? 'angle-double-right' : 'angle-double-left'} />
          <span className="collapse-text gl-ml-3">Collapse sidebar</span>
        </a>
      </div>
    </aside>
  )
}
