import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import AdminLink from './AdminLink.jsx'
import Icon from './Icon.jsx'
import { ADMIN_MENU, activeMenuId } from './adminMenu.js'

/**
 * Fixed 88px left rail (DESIGN.md §4/§5). Hovering — or keyboard-focusing — a
 * rail item slides out its `#4a4542` flyout from `left:100%`.
 */
export default function AdminSidebar() {
  const location = useLocation()
  const active = activeMenuId(location.pathname)
  const [open, setOpen] = useState(null)

  return (
    <div className="menu-wrapper">
      <div className="logo">
        <AdminLink to="/admin/admin/dashboard/" className="logo-link" aria-label="Xagento Admin Panel">
          {/* Wordmark deliberately altered per TRADEMARKS.md */}
          <svg className="logo-img" viewBox="0 0 40 46" aria-hidden="true" focusable="false">
            <path fill="#f26322" d="M20 0 0 11.5v23L5.7 37.8V14.8L20 6.6l14.3 8.2v23L40 34.5v-23L20 0Z" />
            <path fill="#f26322" d="M22.9 37.8V14.9L20 13.2l-2.9 1.7v22.9l2.9 1.7 2.9-1.7ZM11.4 41.1V18.2L8.5 16.5v23L20 46l11.5-6.6v-23l-2.9 1.7v22.9L20 44.3l-8.6-3.2Z" />
          </svg>
        </AdminLink>
      </div>

      <nav className="admin__menu-wrap">
        <ul className="admin__menu" role="menu">
          {ADMIN_MENU.map(item => {
            const isActive = active === item.id
            const isOpen = open === item.id
            return (
              <li
                key={item.id}
                className={`level-0${isActive ? ' _active' : ''}${isOpen ? ' _hover' : ''}`}
                onMouseEnter={() => setOpen(item.id)}
                onMouseLeave={() => setOpen(null)}
              >
                <AdminLink
                  to={item.href || item.groups[0].items[0].href}
                  className="menu-item"
                  onFocus={() => setOpen(item.id)}
                >
                  <Icon name={item.icon} size={22} className="menu-item__icon" />
                  <span>{item.label}</span>
                </AdminLink>

                {item.groups ? (
                  <div className="submenu" aria-hidden={!isOpen}>
                    <strong className="submenu-title">{item.title}</strong>
                    <div className="submenu-groups">
                      {item.groups.map((group, gi) => (
                        <div className="submenu-group" key={group.title || gi}>
                          {group.title ? <strong className="submenu-group-title">{group.title}</strong> : null}
                          <ul>
                            {group.items.map(sub => (
                              <li key={sub.href + sub.label}>
                                <AdminLink to={sub.href} onClick={() => setOpen(null)}>{sub.label}</AdminLink>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}
