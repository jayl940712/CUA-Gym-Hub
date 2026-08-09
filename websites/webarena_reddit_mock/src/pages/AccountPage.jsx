import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import SLink, { useSidNavigate } from '../components/SLink.jsx'
import UserSidebar from '../components/user/UserSidebar.jsx'
import Forbidden from '../components/user/Forbidden.jsx'
import NotFound from './NotFound.jsx'
import { useApp } from '../context/AppContext.jsx'
import '../components/user/user.css'

// ROUTES #66 — templates/user/edit.html.twig, transcribed field for field from
// assets/html/user_account-auth.html (field ids, names, help text and button
// labels are verbatim) and assets/screenshots/reference/17-user-account.png.
//
// The mock has no auth, so the password inputs are real controls that validate
// and flash, but they change nothing in state — there is no password in the
// seed to change. Username and email DO persist onto `currentUser`, which is
// what /go reports. Deleting the account for real is explicitly Out of Scope in
// TODO.md, so "Delete this account" links at the source's confirmation route.
//
// Copy: edit_user.title / heading.credentials / label.username /
// user.username_rules / label.new_password / user.password_rules /
// label.email_address / user.email_optional / action.save_changes /
// heading.delete_account / nav.delete_this_account /
// flash.user_password_updated.

export default function AccountPage() {
  const { username } = useParams()
  const navigate = useSidNavigate()
  const { state, getUser, updateAccount, renameUser, addFlash } = useApp()

  const user = getUser(username)
  const isSelf = user && user.username === state.currentUser.username

  const [name, setName] = useState(state.currentUser.username)
  const [email, setEmail] = useState(state.currentUser.email || '')
  const [pw1, setPw1] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState(null)

  if (!user) return <NotFound />
  if (!isSelf) return <Forbidden />

  const onSubmit = (e) => {
    e.preventDefault()
    if (!name.trim()) { setError('This field is required.'); return }
    if (pw1 || pw2) {
      if (pw1 !== pw2) { setError('The passwords must match.'); return }
      if (pw1.length < 8) { setError('Minimum of 8 characters.'); return }
    }
    setError(null)
    updateAccount({ email: email || null })
    // Postmill really does let you rename yourself, so the field must not be a
    // dead control — but a rename that only touched `currentUser` would strand
    // every submission, comment and directory entry keyed on the old name (and
    // 404 the /user/<name> anchor route). Carry it through everywhere instead.
    if (name !== state.currentUser.username) {
      renameUser(state.currentUser.username, name)
      // UserController::editUser redirects to the RENAMED user's settings page.
      // Without this the component re-renders against the stale `:username`
      // param, getUser(old) returns null, and a successful rename dead-ends on
      // "Page not found". useSidNavigate keeps ?sid= on the new URL.
      navigate(`/user/${name}/account`, { replace: true })
    }
    setPw1(''); setPw2('')
    addFlash(pw1 ? 'Your password has been updated.' : 'User settings have been updated.')
  }

  return (
    <Layout
      title={`Editing user ${user.username}`}
      sidebar={<UserSidebar user={user} />}
    >
      <h1 className="page-heading break-text">Editing user {user.username}</h1>

      <fieldset className="fieldset">
        <legend>Credentials</legend>

        <form name="user" method="post" className="form flow" onSubmit={onSubmit}>
          {error && (
            <ul className="form-error-list fg-red"><li>{error}</li></ul>
          )}

          <div className="flow-slim">
            <div className="form-flex form__row">
              <label htmlFor="user_username">
                Username{' '}
                <b className="fg-red" role="presentation" title="This field is required."
                   aria-label="This field is required.">*</b>
              </label>
              <input
                type="text" id="user_username" name="user[username]" required
                aria-describedby="user_username_help" className="form-control"
                value={name} onChange={e => setName(e.target.value)}
              />
            </div>
            <div id="user_username_help" className="text-flow-slim">
              <p className="text-sm fg-muted">Allowed characters are A-Z, a-z, 0-9 and underscore.</p>
            </div>
          </div>

          <div className="flow-slim">
            <div className="form-flex form__row">
              <label htmlFor="user_password_first">New password</label>
              <div className="compound-form-widget">
                <input
                  type="password" id="user_password_first" name="user[password][first]"
                  autoComplete="new-password" aria-describedby="user_password_help"
                  className="form-control"
                  value={pw1} onChange={e => setPw1(e.target.value)}
                />
                <input
                  type="password" id="user_password_second" name="user[password][second]"
                  autoComplete="new-password" aria-describedby="user_password_help"
                  placeholder="(repeat)" aria-label="New password (repeat)"
                  className="form-control"
                  value={pw2} onChange={e => setPw2(e.target.value)}
                />
              </div>
            </div>
            <div id="user_password_help" className="text-flow-slim">
              <p className="text-sm fg-muted">Minimum of 8 characters.</p>
            </div>
          </div>

          <div className="flow-slim">
            <div className="form-flex form__row">
              <label htmlFor="user_email">Email address</label>
              <input
                type="email" id="user_email" name="user[email]"
                aria-describedby="user_email_help" className="form-control"
                value={email} onChange={e => setEmail(e.target.value)}
              />
            </div>
            <div id="user_email_help" className="text-flow-slim">
              <p className="text-sm fg-muted">
                Providing an email address is optional. We will only use it for resetting passwords.
              </p>
            </div>
          </div>

          <div className="form__row form__button-row">
            <button className="button" type="submit">Save changes</button>
          </div>
        </form>
      </fieldset>

      <fieldset className="fieldset">
        <legend>Delete account</legend>
        <p>
          <SLink to={`/user/${user.username}/delete_account`} className="button button--secondary">
            Delete this account
          </SLink>
        </p>
      </fieldset>
    </Layout>
  )
}
