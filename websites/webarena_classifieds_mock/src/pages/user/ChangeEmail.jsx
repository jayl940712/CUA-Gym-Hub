import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UserPage from '../../components/user/UserPage.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { indexUrl } from '../../utils/urls.js'

/**
 * ROUTES #23 — `index.php?page=user&action=change_email`.
 *
 * `change_email_post` on the source stores a pending address, mails a
 * confirmation link and redirects to `page=user&action=profile` with **no**
 * flash message. The mock has no mail (e-mail confirmation is out of scope),
 * so the address is applied to `state.user.email` directly and the redirect is
 * reproduced as-is.
 *
 * VALIDATION — `controller/user.php:139-166`. This route does NOT use
 * jquery.validate: `user-change_email.php` renders an inert `<ul id="error_list">`
 * and the two failure paths are server-side, each of them
 * `osc_add_flash_error_message(...)` followed by
 * `$this->redirectTo(osc_change_user_email_url())` — i.e. a FLASH on this same
 * page, not an entry in the error list (TEST BUG-A / BUG-C):
 *
 *   !osc_validate_email(new_email)          -> "The specified e-mail is not valid"
 *   User::findByEmail(new_email) hits a row -> "The specified e-mail is already in use"
 *
 * `oc_t_user` has exactly one row on this deployment, so the only address that
 * can collide is the logged-in user's own (SOURCE.md: oc_t_user count = 1).
 */
export default function ChangeEmail() {
  const { state, setState, sid } = useApp()
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [flash, setFlash] = useState(null)

  function onSubmit(e) {
    e.preventDefault()
    const email = value.trim()
    if (!validateEmail(email)) {
      setFlash('The specified e-mail is not valid')
      return
    }
    // findByEmail() — one user row, so "in use" means "already yours".
    if (email.toLowerCase() === String(state.user.email || '').toLowerCase()) {
      setFlash('The specified e-mail is already in use')
      return
    }
    setFlash(null)
    setState(prev => ({ ...prev, user: { ...prev.user, email } }))
    navigate(indexUrl({ page: 'user', action: 'profile' }, sid))
  }

  return (
    <UserPage title="Change e-mail" crumb="Change email" flash={flash} flashType="error">
      <h1>Change e-mail</h1>
      <div className="form-container form-horizontal">
        <div className="resp-wrapper">
          {/* Inert on the source too — `user-change_email.php` emits it empty and
              nothing ever fills it. Kept for DOM parity. */}
          <ul id="error_list"></ul>
          <form id="change-email" action="/index.php" method="post" onSubmit={onSubmit}>
            <input type="hidden" name="page" value="user" />
            <input type="hidden" name="action" value="change_email_post" />
            <div className="control-group">
              <label htmlFor="email">Current e-mail</label>
              <div className="controls mls">{state.user.email}</div>
            </div>
            <div className="control-group">
              <label className="control-label" htmlFor="new_email">New e-mail *</label>
              <div className="controls">
                <input type="text" name="new_email" id="new_email" value={value}
                  onChange={e => setValue(e.target.value)} />
              </div>
            </div>
            <div className="control-group bts">
              <div className="controls">
                <button type="submit" className="btn btn-primary">Update</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </UserPage>
  )
}

/**
 * `osc_validate_email($email)` — `helpers/hValidate.php:257-307`, ported rule for
 * rule so the mock accepts and rejects exactly what the source does. It is NOT a
 * single regex: length >= 3, an `@` after position 0, a restricted local part,
 * and a domain of >= 2 dot-separated subs with no doubled/edge periods and no
 * leading/trailing hyphens.
 */
export function validateEmail(email) {
  const s = String(email === null || email === undefined ? '' : email)
  if (s.length < 3) return false
  if (s.indexOf('@', 1) === -1) return false
  // `explode('@', $email, 2)` splits on the FIRST '@', which is not necessarily
  // the one `strpos(…, 1)` found — keep the two steps distinct.
  const at = s.indexOf('@')
  const local = s.slice(0, at)
  const domain = s.slice(at + 1)
  if (!/^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+$/.test(local)) return false
  if (/\.{2,}/.test(domain)) return false
  // PHP trim()'s default charlist plus '.' — leading/trailing whitespace or dot.
  if (domain.replace(/^[ \t\n\r\0\x0B.]+|[ \t\n\r\0\x0B.]+$/g, '') !== domain) return false
  const subs = domain.split('.')
  if (subs.length < 2) return false
  for (const sub of subs) {
    if (sub.replace(/^[ \t\n\r\0\x0B-]+|[ \t\n\r\0\x0B-]+$/g, '') !== sub) return false
    if (!/^[a-z0-9-]+$/i.test(sub)) return false
  }
  return true
}
