import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import UserSidebar from '../components/user/UserSidebar.jsx'
import Forbidden from '../components/user/Forbidden.jsx'
import NotFound from './NotFound.jsx'
import Icon from '../components/Icon.jsx'
import { useSidNavigate } from '../components/SLink.jsx'
import { FormRow, ButtonRow, RequiredIndicator, useNativeValidation } from '../components/forms/FormBits.jsx'
import { useApp } from '../context/AppContext.jsx'
import '../components/user/user.css'

// ROUTES #68 — `/user/{username}/delete_account`,
// UserController::deleteAccount + templates/user/delete_account.html.twig +
// src/Form/ConfirmDeletionType.php, all read out of container `forum`, and
// transcribed against the live render of
// http://localhost:9999/user/MarvelsGrantMan136/delete_account (200 as the
// seeded user).
//
// This route was previously unregistered while `/user/{name}/account` rendered
// a full-size `Delete this account` button pointing at it, so the button dead-
// ended on "Page not found" (AUDIT HANDLER-012). The source page is a real
// form, not an empty state, so a generic placeholder would be wrong.
//
// Permission: `@IsGranted("edit_user", subject="user")` — self or admin. Any
// other user gets the same bare 403 the source serves.
//
// WHAT SUBMIT DOES. Deleting the account for real is Out of Scope (TODO.md),
// and the source does not actually delete it inline either: the controller
// clears the token, dispatches a `DeleteUser` message onto the bus for a
// worker to process, flashes `flash.account_deletion_in_progress` and
// redirects to the front page. Everything the *response* does is reproduced
// here — both validators run (name must equal the username, confirm must be
// ticked), and on success the mock flashes "The account is being deleted." and
// navigates to `/` with ?sid= intact. Nothing in state is destroyed, so the
// session user survives and the mock keeps booting pre-logged-in. The controls
// are therefore real: a wrong username or an unticked box is rejected with the
// source's own validator copy rather than flashing fake success.
//
// Copy: title.delete_account / delete_account.{lead,submissions,comments,
// messages,votes,metadata} / flash.delete_account_warning /
// label.confirm_username / label.delete_account_confirmation /
// action.delete_account / flash.account_deletion_in_progress.

const ERR_BLANK = 'This value should not be blank.'
const equalTo = (value) => `This value should be equal to ${value}.`

export default function DeleteAccountPage() {
  const { username } = useParams()
  const { state, getUser } = useApp()

  const user = getUser(username)
  if (!user) return <NotFound />

  const isSelf = user.username === state.currentUser.username
  if (!isSelf && !state.currentUser.admin) return <Forbidden />

  return <DeleteAccountForm key={user.username} user={user} isSelf={isSelf} />
}

function DeleteAccountForm({ user, isSelf }) {
  const navigate = useSidNavigate()
  const { addFlash } = useApp()
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [errors, setErrors] = useState({})
  // The source form carries NO `novalidate` (verified on the container:
  // `<form name="confirm_deletion" method="post" class="form flow">`), and both
  // ConfirmDeletionType fields render `required` — the text input as
  // `required="required"`, the checkbox as a bare `required`. Keep the native
  // bubble AND mirror each rejection into `ul.form-error-list`.
  const formRef = useNativeValidation(setErrors)

  function onSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!name.trim()) next.name = [ERR_BLANK]
    else if (name.trim() !== user.username) next.name = [equalTo(user.username)]
    if (!confirm) next.confirm = [ERR_BLANK]
    if (Object.keys(next).length > 0) { setErrors(next); return }
    setErrors({})

    // UserController::deleteAccount — addFlash('notice', …) then
    // redirectToRoute('front'). The account itself is removed asynchronously by
    // a message-bus worker, which the mock does not have and must not fake.
    addFlash('The account is being deleted.')
    navigate('/')
  }

  return (
    <Layout sidebar={<UserSidebar user={user} />} title="Delete account">
      <h1 className="page-heading">Delete account</h1>

      <p>Deleting an account does the following:</p>

      <ul>
        <li>Removes its submissions.</li>
        <li>Removes its comments.</li>
        <li>Removes its sent messages.</li>
        <li>Retracts every vote on submissions and comments.</li>
        <li>
          Makes one unable to log in, scrambles the username, resets preferences,
          and removes other data associated with the account.
        </li>
      </ul>

      <div className="alert bg-orange">
        <div className="alert__icon fg-orange" aria-hidden="true"><Icon name="attention" /></div>
        <div className="alert__text">
          {isSelf ? (
            <p>Once you delete your account, you will never, ever be able to get it back!</p>
          ) : (
            <p>
              <strong className="text-xl">
                You are deleting someone else's account! Once you do this, they
                will never, ever be able to get their account back.
              </strong>
            </p>
          )}
        </div>
      </div>

      <form ref={formRef} name="confirm_deletion" method="post" className="form flow" onSubmit={onSubmit}>
        <FormRow id="confirm_deletion_name" label="Confirm username" required errors={errors.name}>
          <input type="text" id="confirm_deletion_name" name="confirm_deletion[name]"
                 required className="form-control"
                 value={name} onChange={e => setName(e.target.value)} />
        </FormRow>

        {errors.confirm && (
          <ul className="form-error-list"><li>{errors.confirm[0]}</li></ul>
        )}

        <span className="form-flex form-flex--single-line form-flex--no-collapse">
          <span className="unstylable-widget">
            <input type="checkbox" className="form-control" value="1" required
                   id="confirm_deletion_confirm" name="confirm_deletion[confirm]"
                   checked={confirm} onChange={e => setConfirm(e.target.checked)} />
            <span className="icon icon--with-alt-text icon--no-align unstylable-widget__check">
              <svg width="16" height="16" aria-hidden="true">
                <use xlinkHref="/icons.svg#ok" />
              </svg>
            </span>
          </span>
          <label htmlFor="confirm_deletion_confirm">
            I understand there's no way of retrieving this account once it's gone.{' '}
            <RequiredIndicator />
          </label>
        </span>

        <ButtonRow label="Delete account" />
      </form>
    </Layout>
  )
}
