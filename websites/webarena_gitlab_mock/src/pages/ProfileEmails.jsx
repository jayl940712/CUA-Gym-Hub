import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import ProfileLayout from '../components/people/ProfileLayout.jsx'
import SettingsSection, { SettingsSearch } from '../components/people/SettingsSection.jsx'

// ROUTES #41 — `/-/profile/emails`. The primary address comes from
// users.json; secondary addresses are session state so the form is not dead.

export default function ProfileEmails() {
  const { state, currentUser, setUi } = useApp()
  usePageChrome({ title: 'Emails · User Settings · GitLab' })

  const extra = state.ui.emails || []
  const [value, setValue] = useState('')

  function addEmail(e) {
    e.preventDefault()
    const email = value.trim()
    if (!email || email === currentUser.email || extra.includes(email)) return
    setUi(ui => ({ ...ui, emails: [...(ui.emails || []), email] }))
    setValue('')
  }

  const total = extra.length + 1

  return (
    <ProfileLayout crumb="Emails">
      <SettingsSearch />

      <SettingsSection title="Emails" blurb="Control emails linked to your account.">
        <form onSubmit={addEmail}>
          <div className="form-group gl-form-group">
            <label htmlFor="email_email">Email</label>
            <input id="email_email" type="text" className="gl-form-input form-control"
              value={value} onChange={e => setValue(e.target.value)} />
          </div>
          <button type="submit" className="gl-button btn btn-confirm btn-md">Add email address</button>
        </form>
      </SettingsSection>

      <SettingsSection title="Linked emails" blurb={`${total} emails`}>
        <ul className="content-list">
          <li className="gl-display-flex gl-align-items-center gl-py-3" style={{ gap: 12 }}>
            <span className="gl-flex-grow-1">{currentUser.email}</span>
            <span className="gl-badge badge badge-pill badge-info sm">Primary email</span>
            <span className="gl-badge badge badge-pill badge-muted sm">Verified</span>
          </li>
          {extra.map(e => (
            <li className="gl-display-flex gl-align-items-center gl-py-3" key={e} style={{ gap: 12 }}>
              <span className="gl-flex-grow-1">{e}</span>
              <span className="gl-badge badge badge-pill badge-warning sm">Unverified</span>
              <button type="button" className="gl-button btn btn-danger btn-md btn-danger-secondary"
                onClick={() => setUi(ui => ({ ...ui, emails: (ui.emails || []).filter(x => x !== e) }))}>
                Remove
              </button>
            </li>
          ))}
        </ul>
      </SettingsSection>
    </ProfileLayout>
  )
}
