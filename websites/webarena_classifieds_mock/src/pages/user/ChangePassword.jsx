import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import UserPage from '../../components/user/UserPage.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { indexUrl } from '../../utils/urls.js'

/**
 * ROUTES #25 — `index.php?page=user&action=change_password`.
 *
 * VALIDATION — `controller/user.php:207-234`, ported branch for branch. This
 * route has no jquery.validate: `user-change_password.php` renders an inert
 * `<ul id="error_list">` and every outcome is a server-side flash followed by a
 * redirect (TEST BUG-A / BUG-B). In the source's own order:
 *
 *   any of the three fields blank -> WARNING "Password cannot be blank"          -> change_password
 *   !osc_verify_password(current) -> ERROR   "Current password doesn't match"    -> change_password
 *   new_password empty            -> ERROR   "Passwords can't be empty"          -> change_password
 *   new_password != new_password2 -> ERROR   "Passwords don't match"             -> change_password
 *   otherwise                     -> OK      "Password has been changed"        -> user profile
 *
 * Every failure redirect targets `osc_change_user_password_url()`, i.e. this
 * same page — so the mock stays put and flashes, which is the identical
 * user-visible result.
 *
 * STATE (AUDIT PIPELINE-003, extended for BUG-B). The source runs
 * `User::update(['s_password' => osc_hash_password($new)])`
 * (`controller/user.php:232`) — it stores a HASH, never the password itself,
 * and `osc_verify_password` checks the typed password against that hash. The
 * mock keeps the same invariant: **the plaintext secret is never written to
 * session state and never appears in this file.**
 *
 *   user.passwordChanges   integer counter, absent → 1 → 2 …  (deterministic,
 *                          so an evaluator can assert "the password was changed")
 *   user.passwordChangedAt "YYYY-MM-DD HH:MM:SS", same stamp format the rest of
 *                          the app writes (comments `pubDate`, item `pub`)
 *   user.passwordHash      the mock's stand-in for `s_password` — a digest of
 *                          the CURRENT password, written on every successful
 *                          change so a second change can be verified too.
 *                          Absent in `session_seed.json`; absent means "still
 *                          the deployment's seeded credential", i.e. compare
 *                          against SEEDED_PASSWORD_HASH below.
 *
 * All three land in `/go`'s `state_diff` under `user`. Documented in SCHEMA.md.
 */

/**
 * `osc_hash_password()` stand-in. FNV-1a/32, hex — deterministic, dependency
 * free, and one-way enough that no plaintext is recoverable from either the
 * state file or this module. It is NOT a security primitive and does not need
 * to be: there is no auth to defeat in the mock. Its only job is to let
 * `change_password` refuse a wrong current password the way the source does.
 */
export function hashPassword(password) {
  const s = String(password === null || password === undefined ? '' : password)
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/**
 * `hashPassword()` of the credential this deployment ships for
 * blake.sullivan@gmail.com — the one documented under *Auth* in `SOURCE.md`,
 * which is where it stays. The digest is stored here rather than the password
 * so that the no-plaintext invariant holds in the code as well as in the state.
 *
 * Regenerate (after reading the credential out of SOURCE.md) with:
 *   node -e "…hashPassword…; console.log(hashPassword(process.argv[1]))" '<pw>'
 */
const SEEDED_PASSWORD_HASH = 'a9120d76'

function nowStamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** `osc_verify_password($typed, $user['s_password'])`. */
export function verifyPassword(typed, user) {
  const current = (user && user.passwordHash) || SEEDED_PASSWORD_HASH
  return hashPassword(typed) === current
}

export default function ChangePassword() {
  const { state, setState, sid } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState({ password: '', new_password: '', new_password2: '' })
  const [flash, setFlash] = useState(null)
  const [flashType, setFlashType] = useState('error')

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  function fail(msg, type = 'error') { setFlashType(type); setFlash(msg) }

  function onSubmit(e) {
    e.preventDefault()
    // user.php:213 — one combined blank check, flashed as a WARNING not an error.
    if (form.password === '' || form.new_password === '' || form.new_password2 === '') {
      fail('Password cannot be blank', 'warning')
      return
    }
    // user.php:218 — this is the check the mock was missing entirely (BUG-B).
    if (!verifyPassword(form.password, state.user)) {
      fail("Current password doesn't match")
      return
    }
    if (form.new_password !== form.new_password2) {
      fail("Passwords don't match")
      return
    }
    setFlash(null)
    setState(prev => ({
      ...prev,
      user: {
        ...prev.user,
        passwordChanges: (Number(prev.user.passwordChanges) || 0) + 1,
        passwordChangedAt: nowStamp(),
        passwordHash: hashPassword(form.new_password)
      }
    }))
    navigate(indexUrl({ page: 'user', action: 'profile' }, sid), {
      state: { flash: 'Password has been changed' }
    })
  }

  return (
    <UserPage title="Change password" crumb="Change password" flash={flash} flashType={flashType}>
      <h1>Change password</h1>
      <div className="form-container form-horizontal">
        <div className="resp-wrapper">
          {/* Inert on the source too — `user-change_password.php:115` emits it
              empty and nothing ever fills it. Kept for DOM parity. */}
          <ul id="error_list"></ul>
          <form action="/index.php" method="post" onSubmit={onSubmit}>
            <input type="hidden" name="page" value="user" />
            <input type="hidden" name="action" value="change_password_post" />
            <div className="control-group">
              <label className="control-label" htmlFor="password">Current password *</label>
              <div className="controls">
                <input type="password" name="password" id="password" autoComplete="off"
                  value={form.password} onChange={e => set('password', e.target.value)} />
              </div>
            </div>
            <div className="control-group">
              <label className="control-label" htmlFor="new_password">New password *</label>
              <div className="controls">
                <input type="password" name="new_password" id="new_password" autoComplete="off"
                  value={form.new_password} onChange={e => set('new_password', e.target.value)} />
              </div>
            </div>
            <div className="control-group">
              <label className="control-label" htmlFor="new_password2">Repeat new password *</label>
              <div className="controls">
                <input type="password" name="new_password2" id="new_password2" autoComplete="off"
                  value={form.new_password2} onChange={e => set('new_password2', e.target.value)} />
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
