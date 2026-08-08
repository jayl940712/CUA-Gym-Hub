import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import AdminLink from './AdminLink.jsx'
import Icon from './Icon.jsx'
import { ADMIN_MENU, activeMenuId } from './adminMenu.js'

/**
 * Fixed 88px left rail (DESIGN.md §4/§5). Hovering — or keyboard-focusing — a
 * rail item slides out its `#4a4542` flyout from `left:100%`.
 *
 * Clicking a rail item that has a submenu does NOT navigate: the source anchor
 * is `<a href="#" onclick="return false;">` (assets/html/dashboard.html), and
 * the click pins the flyout open so it survives the pointer leaving the rail.
 * A pinned flyout closes on its `.action-close` X, Escape, a click outside the
 * rail, following one of its links, or a route change.
 */
export default function AdminSidebar() {
  const location = useLocation()
  const active = activeMenuId(location.pathname)
  const [open, setOpen] = useState(null)
  const [pinned, setPinned] = useState(false)
  const wrapRef = useRef(null)

  const close = useCallback(() => {
    setOpen(null)
    setPinned(false)
  }, [])

  // Route change dismisses the flyout — following a link inside it should not
  // leave the panel covering the page it just navigated to.
  useEffect(close, [location.pathname, location.search, close])

  // Escape, and any click landing outside the rail, unpin it.
  useEffect(() => {
    if (!pinned) return undefined
    const onKey = e => { if (e.key === 'Escape') close() }
    const onDown = e => { if (!wrapRef.current?.contains(e.target)) close() }
    document.addEventListener('keydown', onKey)
    document.addEventListener('mousedown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('mousedown', onDown)
    }
  }, [pinned, close])

  return (
    <div className={`menu-wrapper${pinned ? ' _pinned' : ''}`} ref={wrapRef}>
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
        <ul className="admin__menu" role="menubar">
          {ADMIN_MENU.map(item => {
            const isActive = active === item.id
            const isOpen = open === item.id
            const parent = Boolean(item.groups)
            return (
              <li
                key={item.id}
                id={`menu-${item.id}`}
                className={`level-0${parent ? ' parent' : ''}${isActive ? ' _active' : ''}` +
                  `${isOpen ? ' _hover' : ''}${isOpen && pinned ? ' _show' : ''}`}
                role="menu-item"
                aria-haspopup={parent || undefined}
                // Hover opens transiently; while something is pinned the pin
                // simply follows the pointer, so two panels never overlap.
                onMouseEnter={() => setOpen(item.id)}
                onMouseLeave={() => { if (!pinned) setOpen(null) }}
              >
                {parent ? (
                  <a
                    href="#"
                    className="menu-item"
                    aria-expanded={isOpen && pinned}
                    onFocus={() => setOpen(item.id)}
                    onClick={e => {
                      e.preventDefault()
                      if (isOpen && pinned) close()
                      else { setOpen(item.id); setPinned(true) }
                    }}
                  >
                    <Icon name={item.icon} size={22} className="menu-item__icon" />
                    <span>{item.label}</span>
                  </a>
                ) : (
                  <AdminLink to={item.href} className="menu-item" onFocus={() => setOpen(item.id)}>
                    <Icon name={item.icon} size={22} className="menu-item__icon" />
                    <span>{item.label}</span>
                  </AdminLink>
                )}

                {parent ? (
                  <div className="submenu" aria-hidden={!isOpen} aria-labelledby={`menu-${item.id}`}>
                    <strong className="submenu-title">{item.title}</strong>
                    <button
                      type="button"
                      className="action-close _close"
                      data-role="close-submenu"
                      aria-label="Close"
                      onClick={close}
                    />
                    <ul className="submenu-columns" role="menu">
                      {columnsOf(item.groups).map((groups, ci) => (
                        <li className="column" key={ci}>
                          <ul role="menu">
                            {groups.map((group, gi) => (
                              <li className="submenu-group level-1" key={group.title || gi}>
                                {group.title ? (
                                  <strong className="submenu-group-title" role="presentation">
                                    <span>{group.title}</span>
                                  </strong>
                                ) : null}
                                <ul role="menu">
                                  {group.items.map(sub => (
                                    <li className="level-2" role="menu-item" key={sub.href + sub.label}>
                                      <AdminLink to={sub.href} onClick={close}>
                                        <span>{sub.label}</span>
                                      </AdminLink>
                                    </li>
                                  ))}
                                </ul>
                              </li>
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ul>
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

/** Bucket the flat group list into the source's `li.column` table-cells. */
function columnsOf(groups) {
  const cols = []
  for (const group of groups) {
    const i = group.column || 0
    while (cols.length <= i) cols.push([])
    cols[i].push(group)
  }
  return cols.filter(col => col.length)
}
