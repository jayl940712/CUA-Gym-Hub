import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { indexUrl } from '../../utils/urls.js'

/**
 * The `page=user` left rail, copied from the sigma theme's `user-sidebar.php`
 * (`osc_private_user_menu(get_user_menu())`).
 *
 * The labels and the `li.opt_*` classes are the SOURCE's, verified against
 * `assets/html/user-items.html`:
 *   Public Profile · Listings · Alerts · Account · Change email ·
 *   Change username · Change password · Delete account
 *
 * `Delete account` is an `href="#"` that opens `#dialog-delete-account`
 * (`Are you sure you want to delete your account?`). Account deletion itself is
 * TODO.md "Out of Scope", so the dialog's own buttons only close it.
 */
const MENU = [
  { cls: 'opt_publicprofile', label: 'Public Profile', params: { page: 'user', action: 'pub_profile', id: 1 } },
  { cls: 'opt_items', label: 'Listings', params: { page: 'user', action: 'items' } },
  { cls: 'opt_alerts', label: 'Alerts', params: { page: 'user', action: 'alerts' } },
  { cls: 'opt_account', label: 'Account', params: { page: 'user', action: 'profile' } },
  { cls: 'opt_change_email', label: 'Change email', params: { page: 'user', action: 'change_email' } },
  { cls: 'opt_change_username', label: 'Change username', params: { page: 'user', action: 'change_username' } },
  { cls: 'opt_change_password', label: 'Change password', params: { page: 'user', action: 'change_password' } }
]

export default function UserSidebar() {
  const { sid } = useApp()
  const [open, setOpen] = useState(false)
  const [dialog, setDialog] = useState(false)

  return (
    <>
      <div className="actions">
        <a
          href="#"
          data-bclass-toggle="display-filters"
          className="resp-toogle show-menu-btn btn btn-secondary"
          onClick={e => { e.preventDefault(); setOpen(v => !v) }}
        >Display menu</a>
      </div>

      <div id="sidebar" className={`fixed-layout${open ? ' opened' : ''}`}>
        <div className="fixed-close" onClick={() => setOpen(false)}><i className="fas fa-times"></i></div>
        <ul className="user_menu">
          {MENU.map((m, i) => (
            <li key={m.cls} className={`${m.cls}${i === 0 ? ' first' : ''}`}>
              <Link to={indexUrl(m.params, sid)}>{m.label}</Link>
            </li>
          ))}
          <li className="opt_delete_account last">
            <a href="#" onClick={e => { e.preventDefault(); setDialog(true) }}>Delete account</a>
          </li>
        </ul>
      </div>

      <div
        id="dialog-delete-account"
        title="Delete account"
        style={dialog ? undefined : { display: 'none' }}
      >
        Are you sure you want to delete your account?
        {dialog ? (
          <p className="dialog-buttons">
            {/* Account deletion is out of scope (TODO.md "Out of Scope"); both
                buttons dismiss the dialog, as Cancel does on the source. */}
            <button type="button" className="btn btn-primary" onClick={() => setDialog(false)}>Delete</button>
            <button type="button" className="btn btn-secondary" onClick={() => setDialog(false)}>Cancel</button>
          </p>
        ) : null}
      </div>
    </>
  )
}
