import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UserPage from '../../components/user/UserPage.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { indexUrl } from '../../utils/urls.js'

/**
 * ROUTES #24 — `index.php?page=user&action=change_username`.
 *
 * NOTE ON THE PREFILL: `user-change_username.php` hard-codes
 * `<input type="text" name="s_username" id="s_username" value="" />` — the
 * field is EMPTY on the source even though `oc_t_user.s_username` really is the
 * string `"1"` (see assets/html/user-change-username.html, captured logged in).
 * The current username is only shown by the availability probe, so the empty
 * value is reproduced rather than "corrected".
 *
 * `change_username_post` flashes `The username was updated` and redirects to
 * `page=user&action=profile`.
 *
 * VALIDATION — `controller/user.php:172-200`. Like the other two `page=user`
 * forms this route has no jquery.validate: `user-change_username.php` renders an
 * inert `<ul id="error_list">` and every failure is a server-side
 * `osc_add_flash_error_message(...)` followed by
 * `$this->redirectTo(osc_change_user_username_url())` — a FLASH on this same
 * page (TEST BUG-A). The input is first put through `osc_sanitize_username()`,
 * then:
 *
 *   ''                                -> "The specified username could not be empty"
 *   User::findByUsername() hits a row -> "The specified username is already in use"
 *   osc_is_username_blacklisted()     -> "The specified username is not valid, it contains some invalid words"
 *   otherwise                         -> ok "The username was updated" + redirect to profile
 *
 * `oc_t_user` has one row, so "already in use" means "already yours" — and the
 * seeded username really is the string "1", which is ALSO digits-only and so
 * blacklisted; the in-use branch is checked first and wins, exactly as in the
 * PHP.
 */

/** `osc_sanitize_username()` — `helpers/hSanitize.php:99-107`. */
export function sanitizeUsername(value) {
  if (value === '' || value === null || value === undefined) return ''
  // trim -> spaces to '-' -> drop everything outside [0-9A-Za-z_] (which also
  // eats the '-' just introduced) -> runs of '_' to '-' -> collapse '--'.
  let v = String(value).trim().replace(/ /g, '-')
  v = v.replace(/[^0-9A-Za-z_]/g, '')
  v = v.replace(/_+/g, '-')
  return v.replace(/-{2,}/g, '-')
}

/**
 * `osc_is_username_blacklisted()` — `helpers/hSecurity.php:265-282`.
 * Digits-only is rejected outright ("avoid numbers only usernames"), then a
 * case-insensitive substring test against `oc_t_preference.username_blacklist`,
 * which reads `admin,user` on this deployment (verified via mysql).
 */
const USERNAME_BLACKLIST = ['admin', 'user']
export function isUsernameBlacklisted(username) {
  if (String(username).replace(/\d+/g, '') === '') return true
  return USERNAME_BLACKLIST.some(bl => String(username).toLowerCase().includes(bl))
}

export default function ChangeUsername() {
  const { state, setState, sid } = useApp()
  const navigate = useNavigate()
  const [value, setValue] = useState('')
  const [flash, setFlash] = useState(null)
  const [available, setAvailable] = useState('')

  function onChange(v) {
    setValue(v)
    // The source polls page=ajax&action=check_username_availability; there is
    // exactly one user in this deployment, so anything but "1" is available.
    setAvailable(v === '' ? '' : (v === '1' ? 'The username is NOT available' : 'The username is available'))
  }

  function onSubmit(e) {
    e.preventDefault()
    const username = sanitizeUsername(value)
    if (username === '') {
      setFlash('The specified username could not be empty')
      return
    }
    if (username.toLowerCase() === String(state.user.username || '').toLowerCase()) {
      setFlash('The specified username is already in use')
      return
    }
    if (isUsernameBlacklisted(username)) {
      setFlash('The specified username is not valid, it contains some invalid words')
      return
    }
    setFlash(null)
    setState(prev => ({ ...prev, user: { ...prev.user, username } }))
    navigate(indexUrl({ page: 'user', action: 'profile' }, sid), {
      state: { flash: 'The username was updated' }
    })
  }

  return (
    <UserPage title="Change username" crumb="Change username" flash={flash} flashType="error">
      <h1>Change username</h1>
      <div className="form-container form-horizontal">
        <div className="resp-wrapper">
          {/* Inert on the source too — emitted empty, never filled. DOM parity. */}
          <ul id="error_list"></ul>
          <form action="/index.php" method="post" id="change-username" onSubmit={onSubmit}>
            <input type="hidden" name="page" value="user" />
            <input type="hidden" name="action" value="change_username_post" />
            <div className="control-group">
              <label className="control-label" htmlFor="s_username">Username</label>
              <div className="controls">
                <input type="text" name="s_username" id="s_username" value={value}
                  onChange={e => onChange(e.target.value)} />
                <div id="available">{available}</div>
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
