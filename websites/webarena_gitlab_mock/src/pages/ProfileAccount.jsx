import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import ProfileLayout from '../components/people/ProfileLayout.jsx'
import SettingsSection, { SettingsSearch } from '../components/people/SettingsSection.jsx'

// ROUTES #37 — `/-/profile/account`.
//
// The source serves EXACTLY three sections here, in this order:
//   Two-factor authentication · Change username · Delete account
// (verified against assets/html/profile-account2.html). The feed token is NOT
// one of them — it lives on `/-/profile/personal_access_tokens`, where
// webarena-259's `TMN_bBn9Z48qVbUFZV45` anchor now renders (see ProfileKeys.jsx
// ProfileMisc). There is no `Social sign-in` section anywhere on the source, so
// both were removed rather than left standing as invented elements (BUG-A10).

export default function ProfileAccount() {
  const { state, setState } = useApp()
  const user = state.currentUser
  usePageChrome({ title: 'Account · User Settings · GitLab' })

  const [username, setUsername] = useState(user.username)
  const twofa = !!user.two_factor_enabled

  // §24.5 — host-dependent copy comes off the serving origin, never the
  // container's `http://localhost:8023` (BUG-B05).
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  // The source spells out the real count: `12 personal projects will be removed
  // and cannot be restored.` Derive it so it stays true after a create/fork.
  const personalProjects = state.projects
    .filter(p => p.namespace && p.namespace.path === user.username).length

  function changeUsername(e) {
    e.preventDefault()
    if (!username || username === user.username) return
    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser, username },
      users: prev.users.map(u => (u.id === user.id ? { ...u, username } : u)),
    }))
  }

  return (
    <ProfileLayout crumb="Account">
      <SettingsSearch />

      <SettingsSection title="Two-factor authentication"
        blurb="Increase your account's security by enabling two-factor authentication (2FA).">
        <p>Status: {twofa ? 'Enabled' : 'Disabled'}</p>
        <div className="gl-mb-3">
          <button type="button" className={`gl-button btn btn-md ${twofa ? 'btn-danger' : 'btn-confirm'}`}
            data-qa-selector={twofa ? 'disable_2fa_button' : 'enable_2fa_button'}
            onClick={() => setState(prev => ({
              ...prev, currentUser: { ...prev.currentUser, two_factor_enabled: !twofa },
            }))}>
            <span className="gl-button-text">
              {twofa ? 'Disable two-factor authentication' : 'Enable two-factor authentication'}
            </span>
          </button>
        </div>
      </SettingsSection>

      <SettingsSection title="Change username"
        blurb={(
          <>
            {'Changing your username can have unintended side effects. '}
            <a target="_blank" rel="noopener noreferrer"
              href="/help/user/profile/index#change-your-username">Learn more</a>.
          </>
        )}>
        <form onSubmit={changeUsername}>
          <div className="form-group">
            <label htmlFor="username-change-input">Path</label>
            <div className="input-group">
              <div className="input-group-prepend"><div className="input-group-text">{`${origin}/`}</div></div>
              <input id="username-change-input" required className="form-control"
                value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <p className="form-text text-muted">{`Current path: ${origin}/${user.username}`}</p>
          </div>
          <button type="submit" className="btn btn-confirm btn-md gl-button"
            data-testid="username-change-confirmation-modal"
            disabled={!username || username === user.username}>
            <span className="gl-button-text">Update username</span>
          </button>
        </form>
      </SettingsSection>

      <SettingsSection title="Delete account">
        <p>Deleting an account has the following effects:</p>
        <ul>
          <li>
            <p>
              {'Certain user content will be moved to a system-wide "Ghost User" in order to '}
              {'maintain content for posterity. For further information, please refer to the '}
              <a href="/help/user/profile/account/delete_account#associated-records">
                user account deletion documentation.
              </a>
            </p>
          </li>
          <li>
            {`${personalProjects} personal projects will be removed and cannot be restored.`}
          </li>
        </ul>
        <button type="button" id="delete-account-button" data-qa-selector="delete_account_button"
          className="gl-button btn btn-md btn-danger" disabled>
          <span className="gl-button-text">Delete account</span>
        </button>
      </SettingsSection>
    </ProfileLayout>
  )
}
