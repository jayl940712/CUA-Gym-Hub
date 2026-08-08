import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import ProfileLayout from '../components/people/ProfileLayout.jsx'
import Icon from '../components/layout/Icon.jsx'
import SettingsSection, { SettingsSearch } from '../components/people/SettingsSection.jsx'
import { formatDate } from '../utils/format.js'
import { dbStamp, makeSha } from '../components/create/mutations.js'

// ROUTES #40 — `/-/profile/keys`. Empty in the source (that is why every
// project page carries the "add an SSH key to your profile" warning banner).
// The Add-key form still has to work: it is the destination of that banner's
// `Add SSH key` button, so it must not be a dead end.

// ROUTES #43 — the remaining `/-/profile/*` leaves. All of them are empty in
// the source; render the page shell plus the real empty copy so that no item
// in the User Settings sidebar is a dead link.
const MISC = {
  applications: ['Applications', 'You don’t have any authorized applications.'],
  chat_names: ['Chat', 'You don’t have any active chat names.'],
  gpg_keys: ['GPG Keys', 'There are no GPG keys associated with this account.'],
  active_sessions: ['Active Sessions', 'This is a list of devices that have logged into your account.'],
  audit_log: ['Authentication log', 'This is a security log of authentication events involving your account.'],
  password: ['Password', 'Password management is not available in this instance.'],
}

// The five scope checkboxes and their help text, copied verbatim from the
// source's `/-/profile/personal_access_tokens`.
const TOKEN_SCOPES = [
  ['api', 'Grants complete read/write access to the API, including all groups and projects, the container registry, and the package registry.'],
  ['read_api', 'Grants read access to the API, including all groups and projects, the container registry, and the package registry.'],
  ['read_user', "Grants read-only access to the authenticated user's profile through the /user API endpoint, which includes username, public email, and full name. Also grants access to read-only API endpoints under /users."],
  ['read_repository', 'Grants read-only access to repositories on private projects using Git-over-HTTP or the Repository Files API.'],
  ['write_repository', 'Grants read-write access to repositories on private projects using Git-over-HTTP (not using the API).'],
]

export function ProfileMisc() {
  const { pathname } = useLocation()
  const key = pathname.replace('/-/profile/', '').split('/')[0] || ''
  if (key === 'personal_access_tokens') return <ProfileAccessTokens />
  const [title, copy] = MISC[key] || ['User Settings', 'This settings page has no content in this instance.']
  usePageChrome({ title: `${title} · User Settings · GitLab` })
  return (
    <ProfileLayout crumb={title}>
      <SettingsSearch />
      <SettingsSection title={title} blurb={copy}>
        <div className="nothing-here-block">{copy}</div>
      </SettingsSection>
    </ProfileLayout>
  )
}

/**
 * ROUTES #43 — `/-/profile/personal_access_tokens`.
 *
 * ANCHOR (webarena-259, exact_match `TMN_bBn9Z48qVbUFZV45`): the Feed token
 * section lives HERE, not on `/-/profile/account`. The source ships the token
 * to the browser in `#js-tokens-app[data-tokens-data]` and a Vue app renders it
 * at the bottom of this page behind a masked input; `/-/profile/account` has
 * only Two-factor authentication, Change username and Delete account (BUG-A10).
 * The value comes off users.json as `feed_token` and is never invented.
 */
function ProfileAccessTokens() {
  const { state, setUi } = useApp()
  usePageChrome({ title: 'Personal Access Tokens · User Settings · GitLab' })

  const tokens = state.ui.accessTokens || []
  const feedToken = state.ui.feedToken || state.currentUser.feed_token || ''

  const [name, setName] = useState('')
  const [expires, setExpires] = useState('')
  const [scopes, setScopes] = useState([])
  // The source masks the token until `Click to reveal`; its innerText never
  // carries the value, so the agent has to work the control.
  const [revealed, setRevealed] = useState(false)

  function toggleScope(scope) {
    setScopes(s => (s.includes(scope) ? s.filter(x => x !== scope) : [...s, scope]))
  }

  function createToken(e) {
    e.preventDefault()
    if (!name.trim()) return
    setUi(ui => {
      const list = ui.accessTokens || []
      return {
        ...ui,
        accessTokens: [...list, {
          id: list.reduce((m, t) => Math.max(m, t.id), 0) + 1,
          name: name.trim(),
          scopes: [...scopes],
          created_at: dbStamp(),
          expires_at: expires || null,
          last_used_at: null,
          // Shaped like the source's `glpat-` prefix, derived rather than
          // random so the same flow twice produces the same /go state_diff.
          token: `glpat-${makeSha(name.trim(), list.length).slice(0, 20)}`,
        }],
      }
    })
    setName('')
    setExpires('')
    setScopes([])
  }

  function resetFeedToken() {
    const ok = typeof window === 'undefined' || window.confirm(
      'Are you sure? Any RSS or calendar URLs currently in use will stop working.')
    if (!ok) return
    setUi(ui => ({ ...ui, feedToken: `TMN_${makeSha('feed_token', feedToken).slice(0, 16)}` }))
    setRevealed(false)
  }

  return (
    <ProfileLayout crumb="Access Tokens">
      <SettingsSearch />

      <SettingsSection title="Personal Access Tokens"
        blurb={(
          <>
            <span className="gl-display-block gl-mb-3">
              You can generate a personal access token for each application you use that needs
              access to the GitLab API.
            </span>
            <span className="gl-display-block">
              You can also use personal access tokens to authenticate against Git over HTTP.
              They are the only accepted password when you have Two-Factor Authentication (2FA)
              enabled.
            </span>
          </>
        )}>
        <h5>Add a personal access token</h5>
        <p>Enter the name of your application, and we&apos;ll return a unique personal access token.</p>
        <form onSubmit={createToken}>
          <div className="form-group">
            <label htmlFor="personal_access_token_name">Token name</label>
            <input id="personal_access_token_name" className="gl-form-input form-control"
              data-qa-selector="personal_access_token_name_field"
              value={name} onChange={e => setName(e.target.value)} />
            <small className="form-text text-gl-muted">
              For example, the application using the token or the purpose of the token. Do not give
              sensitive information for the name of the token, as it will be visible to all project
              members.
            </small>
          </div>
          <div className="form-group">
            <label htmlFor="personal_access_token_expires_at">Expiration date</label>
            <input id="personal_access_token_expires_at" type="date" className="gl-form-input form-control"
              data-qa-selector="expiry_date_field"
              value={expires} onChange={e => setExpires(e.target.value)} />
          </div>
          <fieldset className="form-group">
            <legend className="col-form-label">Select scopes</legend>
            <p>
              {'Scopes set the permission levels granted to the token. '}
              <a href="/help/user/profile/personal_access_tokens#personal-access-token-scopes">Learn more.</a>
            </p>
            {TOKEN_SCOPES.map(([scope, help]) => (
              <div className="gl-form-checkbox custom-control custom-checkbox" key={scope}>
                <input id={`personal_access_token_scopes_${scope}`} type="checkbox"
                  className="custom-control-input" data-qa-selector={`${scope}_checkbox`}
                  checked={scopes.includes(scope)} onChange={() => toggleScope(scope)} />
                <label className="custom-control-label" htmlFor={`personal_access_token_scopes_${scope}`}
                  data-qa-selector={`${scope}_label`}>
                  <span>{scope}</span>
                  <p className="help-text" data-testid="pajamas-component-help-text">{help}</p>
                </label>
              </div>
            ))}
          </fieldset>
          <div className="gl-mt-3">
            <button type="submit" data-qa-selector="create_token_button"
              className="gl-button btn btn-md btn-confirm">
              <span className="gl-button-text">Create personal access token</span>
            </button>
          </div>
        </form>

        <h5 className="gl-mt-5">{`Active personal access tokens (${tokens.length})`}</h5>
        <table className="table gl-table b-table" data-testid="active-tokens">
          <thead>
            <tr>
              <th>Token name</th><th>Scopes</th><th>Created</th>
              <th>Last Used</th><th>Expires</th><th>Action</th>
            </tr>
          </thead>
          <tbody>
            {tokens.map(t => (
              <tr key={t.id}>
                <td>{t.name}</td>
                <td>{t.scopes.length ? t.scopes.join(', ') : 'no scopes selected'}</td>
                <td>{formatDate(t.created_at)}</td>
                <td>Never</td>
                <td>{t.expires_at ? formatDate(t.expires_at) : 'Never'}</td>
                <td>
                  <button type="button" className="gl-button btn btn-danger btn-md btn-danger-secondary"
                    onClick={() => setUi(ui => ({
                      ...ui, accessTokens: (ui.accessTokens || []).filter(x => x.id !== t.id),
                    }))}>
                    <span className="gl-button-text">Revoke</span>
                  </button>
                </td>
              </tr>
            ))}
            {tokens.length === 0 ? (
              <tr><td colSpan={6}>This user has no active personal access tokens.</td></tr>
            ) : null}
          </tbody>
        </table>
      </SettingsSection>

      {/* ANCHOR — the feed token string must be reachable from this page. */}
      <div className="row" data-testid="feed-token-container">
        <div className="col-lg-12"><hr /></div>
        <div className="col-lg-4 profile-settings-sidebar">
          <h4 className="gl-mt-0">Feed token</h4>
          <p>
            Your feed token authenticates you when your RSS reader loads a personalized RSS feed or
            when your calendar application loads a personalized calendar. It is visible in those
            feed URLs.
          </p>
          <p>It cannot be used to access any other data.</p>
        </div>
        <div className="col-lg-8">
          <div className="form-group gl-form-group">
            <label htmlFor="feed_token" className="d-block col-form-label">Feed token</label>
            <div className="input-group">
              <input id="feed_token" type="text" readOnly
                className="gl-form-input gl-font-monospace! gl-cursor-default! form-control"
                value={revealed ? feedToken : '*'.repeat(feedToken.length)} />
              <div className="input-group-append">
                <button type="button" data-testid="toggle-visibility-button"
                  data-qa-selector="toggle_visibility_button"
                  aria-label={revealed ? 'Click to hide' : 'Click to reveal'}
                  className="btn btn-default btn-md gl-button btn-icon"
                  onClick={() => setRevealed(r => !r)}>
                  <Icon name="eye" />
                </button>
                <button type="button" id="clipboard-button-1" title="Copy feed token"
                  aria-label="Copy feed token" data-clipboard-text={feedToken}
                  className="btn btn-default btn-md gl-button btn-default-secondary btn-icon"
                  onClick={() => navigator.clipboard && navigator.clipboard.writeText(feedToken)}>
                  <Icon name="copy" />
                </button>
              </div>
            </div>
            <small className="form-text text-gl-muted">
              {'Keep this token secret. Anyone who has it can read activity and issue RSS feeds or '}
              {'your calendar feed as if they were you. If that happens, '}
              <a href="#reset-feed-token" className="gl-link"
                onClick={e => { e.preventDefault(); resetFeedToken() }}>reset this token</a>.
            </small>
          </div>
        </div>
      </div>
    </ProfileLayout>
  )
}

export default function ProfileKeys() {
  const { state, setUi } = useApp()
  usePageChrome({ title: 'SSH Keys · User Settings · GitLab' })

  const keys = state.ui.sshKeys || []
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [expires, setExpires] = useState('')

  function addKey(e) {
    e.preventDefault()
    if (!body.trim()) return
    const derived = title.trim() || body.trim().split(/\s+/).slice(2).join(' ') || 'SSH key'
    setUi(ui => ({
      ...ui,
      sshKeys: [...(ui.sshKeys || []), {
        id: (ui.sshKeys || []).length + 1,
        title: derived,
        key: body.trim(),
        expires_at: expires || null,
        created_at: dbStamp(),
      }],
    }))
    setTitle('')
    setBody('')
    setExpires('')
  }

  function removeKey(id) {
    setUi(ui => ({ ...ui, sshKeys: (ui.sshKeys || []).filter(k => k.id !== id) }))
  }

  return (
    <ProfileLayout crumb="SSH Keys">
      <SettingsSearch />

      <SettingsSection title="SSH Keys"
        blurb="SSH keys allow you to establish a secure connection between your computer and GitLab.">
        <form onSubmit={addKey}>
          <div className="form-group gl-form-group">
            <label htmlFor="key_key">Key</label>
            <textarea id="key_key" rows={8} className="gl-form-input gl-form-textarea form-control"
              placeholder="Typically starts with &quot;ssh-ed25519 …&quot; or &quot;ssh-rsa …&quot;"
              value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div className="form-group gl-form-group">
            <label htmlFor="key_title">Title</label>
            <input id="key_title" className="gl-form-input form-control"
              placeholder="e.g. My MacBook key" value={title} onChange={e => setTitle(e.target.value)} />
            <small className="form-text text-gl-muted">Key titles are publicly visible.</small>
          </div>
          <div className="form-group gl-form-group">
            <label htmlFor="key_expires_at">Expiration date (optional)</label>
            <input id="key_expires_at" type="date" className="gl-form-input form-control"
              value={expires} onChange={e => setExpires(e.target.value)} />
          </div>
          <button type="submit" className="gl-button btn btn-confirm btn-md">Add key</button>
        </form>
      </SettingsSection>

      <SettingsSection title="Your SSH keys" blurb={`${keys.length}`}>
        {keys.length === 0 ? (
          <div className="nothing-here-block">There are no SSH keys with access to your account.</div>
        ) : (
          <ul className="content-list">
            {keys.map(k => (
              <li className="gl-display-flex gl-align-items-center gl-py-3" key={k.id} style={{ gap: 12 }}>
                <div className="gl-flex-grow-1">
                  <div className="gl-font-weight-bold">{k.title}</div>
                  <div className="gl-text-gray-500 gl-font-monospace" style={{ wordBreak: 'break-all' }}>{k.key}</div>
                  <div className="gl-text-gray-500">
                    {k.expires_at ? `Expires: ${formatDate(k.expires_at)}` : 'Expires: Never'}
                  </div>
                </div>
                <button type="button" className="gl-button btn btn-danger btn-md btn-danger-secondary"
                  onClick={() => removeKey(k.id)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </SettingsSection>
    </ProfileLayout>
  )
}
