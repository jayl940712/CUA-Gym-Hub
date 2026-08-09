import React, { useState } from 'react'
import Page from '../components/Page.jsx'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useStoreNavigate } from '../utils/url.js'

/**
 * ROUTES #23 / #24 — /customer/account/edit/ and
 * /customer/account/edit/changepass/1/ (boots with the password fields open).
 *
 * There is no auth in the mock, so "Current Password" is accepted as typed;
 * the form never gates anything.
 */
export default function AccountEditPage({ changePassword = false }) {
  const { state, saveAccountInfo, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const [firstname, setFirstname] = useState(state.customer.firstname)
  const [lastname, setLastname] = useState(state.customer.lastname)
  const [changeEmail, setChangeEmail] = useState(false)
  const [changePass, setChangePass] = useState(changePassword)
  const [remoteAssist, setRemoteAssist] = useState(!!state.customer.assistanceAllowed)
  const [email, setEmail] = useState(state.customer.email)
  const [currentPassword, setCurrentPassword] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [errors, setErrors] = useState({})

  const strength = (() => {
    if (!password) return 'No Password'
    if (password.length < 6) return 'Weak'
    if (password.length < 10) return 'Medium'
    return 'Strong'
  })()

  const onSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    if (!firstname.trim()) errs.firstname = 'This is a required field.'
    if (!lastname.trim()) errs.lastname = 'This is a required field.'
    if (changeEmail && !email.trim()) errs.email = 'This is a required field.'
    if (changePass) {
      if (!password) errs.password = 'This is a required field.'
      if (password !== confirmation) errs.confirmation = 'Please enter the same value again.'
    }
    setErrors(errs)
    if (Object.keys(errs).length) return
    saveAccountInfo({
      firstname: firstname.trim(),
      lastname: lastname.trim(),
      // The source posts this alongside the name fields (the
      // `assistance_allowed_checkbox` + hidden `assistance_allowed` pair), so
      // it has to reach state or the toggle is invisible to /go. HANDLERS-002.
      assistanceAllowed: remoteAssist,
      ...(changeEmail ? { email: email.trim() } : {}),
    })
    addMessage('You saved the account information.')
    navigate('/customer/account/')
  }

  return (
    <Page title="Edit Account Information" documentTitle="Account Information" sidebar="account">
      <form className="form form-edit-account" onSubmit={onSubmit} noValidate>
        <fieldset className="fieldset info">
          <legend className="legend"><span>Account Information</span></legend>
          <div className="field required">
            <label className="label" htmlFor="firstname"><span>First Name</span></label>
            <div className="control">
              <input type="text" id="firstname" value={firstname} onChange={e => setFirstname(e.target.value)} />
              {errors.firstname && <span className="field-error">{errors.firstname}</span>}
            </div>
          </div>
          <div className="field required">
            <label className="label" htmlFor="lastname"><span>Last Name</span></label>
            <div className="control">
              <input type="text" id="lastname" value={lastname} onChange={e => setLastname(e.target.value)} />
              {errors.lastname && <span className="field-error">{errors.lastname}</span>}
            </div>
          </div>
          {/* Attribute sets transcribed from assets/html/account-edit.html:
                <input type="checkbox" name="change_email" id="change-email"
                       data-role="change-email" value="1" title="Change Email" class="checkbox" />
                <input type="checkbox" name="change_password" id="change-password"
                       data-role="change-password" value="1" title="Change Password" class="checkbox" />
                <input type="checkbox" name="assistance_allowed_checkbox"
                       title="Allow remote shopping assistance" value="1"
                       id="assistance_allowed_checkbox" class="checkbox">
                <input type="hidden" name="assistance_allowed" value=""/>
              The inline width/height are dropped — the global
              `.field.choice > input[type=checkbox]` rule already covers them. */}
          <div className="field choice">
            <input type="checkbox" name="change_email" id="change-email" data-role="change-email"
              value="1" title="Change Email" className="checkbox"
              checked={changeEmail} onChange={e => setChangeEmail(e.target.checked)} />{' '}
            <label className="label" htmlFor="change-email"><span>Change Email</span></label>
          </div>
          <div className="field choice">
            <input type="checkbox" name="change_password" id="change-password" data-role="change-password"
              value="1" title="Change Password" className="checkbox"
              checked={changePass} onChange={e => setChangePass(e.target.checked)} />{' '}
            <label className="label" htmlFor="change-password"><span>Change Password</span></label>
          </div>
          <div className="field choice">
            <input type="checkbox" name="assistance_allowed_checkbox" id="assistance_allowed_checkbox"
              value="1" title="Allow remote shopping assistance" className="checkbox"
              checked={remoteAssist} onChange={e => setRemoteAssist(e.target.checked)} />{' '}
            <label className="label" htmlFor="assistance_allowed_checkbox">
              <span>Allow remote shopping assistance</span>
            </label>
            <input type="hidden" name="assistance_allowed" value="" readOnly />
            <div className="note">This allows merchants to &quot;see what you see&quot; and take actions on your behalf in order to provide better assistance.</div>
          </div>
        </fieldset>

        {(changeEmail || changePass) && (
          <fieldset className="fieldset password">
            <legend className="legend"><span>Change Email and Password</span></legend>
            {changeEmail && (
              <div className="field required">
                <label className="label" htmlFor="email"><span>Email</span></label>
                <div className="control">
                  <input type="email" id="email" value={email} onChange={e => setEmail(e.target.value)} />
                  {errors.email && <span className="field-error">{errors.email}</span>}
                </div>
              </div>
            )}
            <div className="field required">
              <label className="label" htmlFor="current-password"><span>Current Password</span></label>
              <div className="control">
                <input type="password" id="current-password" value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)} />
              </div>
            </div>
            {changePass && (
              <>
                <div className="field required">
                  <label className="label" htmlFor="password"><span>New Password</span></label>
                  <div className="control">
                    <input type="password" id="password" value={password} onChange={e => setPassword(e.target.value)} />
                    <div id="password-strength-meter-container" className="note">
                      Password Strength: <span id="password-strength-meter-label">{strength}</span>
                    </div>
                    {errors.password && <span className="field-error">{errors.password}</span>}
                  </div>
                </div>
                <div className="field required">
                  <label className="label" htmlFor="password-confirmation"><span>Confirm New Password</span></label>
                  <div className="control">
                    <input type="password" id="password-confirmation" value={confirmation}
                      onChange={e => setConfirmation(e.target.value)} />
                    {errors.confirmation && <span className="field-error">{errors.confirmation}</span>}
                  </div>
                </div>
              </>
            )}
          </fieldset>
        )}

        <div className="actions-toolbar">
          <button type="submit" className="action save primary"><span>Save</span></button>
          <div className="secondary">
            <SLink to="/" className="action back"><span>Go back</span></SLink>
          </div>
        </div>
      </form>
    </Page>
  )
}
