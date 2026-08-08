import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import ProfileLayout from '../components/people/ProfileLayout.jsx'
import SettingsSection, { SettingsSearch, Field } from '../components/people/SettingsSection.jsx'
import {
  STATUS_EMOJI, STATUS_EMOJI_PICKER, CLEAR_STATUS_OPTIONS,
} from '../components/people/profileUtils.js'

// ROUTES #35 / #36 — `/-/profile`. assets/README.md §22a.
//
// TWO ANCHOR WRITE PATHS live on this page, and neither has a live example in
// the source DOM (byteblaze has no status and an empty website_url):
//
//   `Website url` -> users[byteblaze].website_url
//        -> /byteblaze renders `.profile-header [itemprop="url"]`
//           (tasks 448–452, exact_match on `egg.tart.com` etc.)
//   `Current status` -> users[byteblaze].status
//        -> /byteblaze renders `.cover-status` whose lastChild is the message
//           (tasks 418–422, exact_match on `Cruising` etc.)
//
// Both must survive a reload, so they are written through setState/saveState.

const TIMEZONES = [
  'Select timezone', 'Pacific Time (US & Canada)', 'Mountain Time (US & Canada)',
  'Central Time (US & Canada)', 'Eastern Time (US & Canada)', 'UTC', 'London',
  'Berlin', 'Kolkata', 'Beijing', 'Tokyo', 'Sydney',
]

export default function ProfileSettings() {
  const { state, setState } = useApp()
  const user = state.currentUser
  usePageChrome({ title: 'Edit Profile · User Settings · GitLab' })

  const [form, setForm] = useState(() => ({
    name: user.name || '',
    pronouns: user.pronouns || '',
    pronunciation: user.pronunciation || '',
    email: user.email || '',
    public_email: user.public_email || '',
    commit_email: '',
    skype: user.skype || '',
    linkedin: user.linkedin || '',
    twitter: user.twitter || '',
    website_url: user.website_url || '',
    location: user.location || '',
    job_title: user.job_title || '',
    organization: user.organization || '',
    bio: user.bio || '',
    timezone: user.timezone || '',
    private_profile: !!user.private_profile,
    include_private_contributions: !!user.include_private_contributions,
  }))

  const currentStatus = user.status || {}
  const [statusEmoji, setStatusEmoji] = useState(currentStatus.emoji || '')
  const [statusMessage, setStatusMessage] = useState(currentStatus.message || '')
  const [busy, setBusy] = useState(currentStatus.availability === 'busy')
  const [clearAfter, setClearAfter] = useState('Never')
  const [emojiOpen, setEmojiOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)
  const [saved, setSaved] = useState(false)
  const [avatarFile, setAvatarFile] = useState('')

  // HANDLER-011 — the navbar's `Set status` links here with `?set_status=1`.
  // Scroll the Current status section into view and focus its message field so
  // the entry point actually lands somewhere.
  React.useEffect(() => {
    if (new URLSearchParams(window.location.search).get('set_status') !== '1') return
    const el = document.getElementById('current-status')
    if (el) el.scrollIntoView({ block: 'center' })
    const input = document.querySelector('[name="user[status][message]"]')
    if (input) input.focus()
  }, [])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  /**
   * `Update profile settings`. Writes BOTH the main settings and the status
   * onto users[currentUser] AND onto state.currentUser, because the profile
   * page reads from state.users while the navbar reads state.currentUser.
   */
  function submit(e) {
    if (e) e.preventDefault()
    const message = statusMessage.trim()
    const emoji = statusEmoji || (message ? 'speech_balloon' : '')
    const status = (message || (emoji && emoji !== 'speech_balloon'))
      ? { emoji: emoji || 'speech_balloon', message, availability: busy ? 'busy' : 'not_set', clear_status_after: clearAfter }
      : null

    const raw = {
      name: form.name,
      pronouns: form.pronouns,
      pronunciation: form.pronunciation,
      email: form.email,
      public_email: form.public_email,
      skype: form.skype,
      linkedin: form.linkedin,
      twitter: form.twitter,
      // stored VERBATIM — the scheme is stripped at render time, not here
      website_url: form.website_url,
      location: form.location,
      job_title: form.job_title,
      organization: form.organization,
      bio: form.bio,
      timezone: form.timezone,
      private_profile: form.private_profile,
      include_private_contributions: form.include_private_contributions,
      status,
    }

    // Only carry through fields that actually changed. Writing `''` over an
    // absent field would otherwise put a dozen no-op keys into /go's
    // state_diff on every save and drown the real signal.
    const patch = {}
    for (const [k, v] of Object.entries(raw)) {
      const norm = x => (typeof v === 'boolean' ? !!x : (x === undefined || x === null ? '' : x))
      if (JSON.stringify(norm(user[k])) !== JSON.stringify(norm(v))) patch[k] = v
    }
    if (!Object.keys(patch).length) { setSaved(true); return }

    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser, ...patch },
      users: prev.users.map(u => (u.id === user.id ? { ...u, ...patch } : u)),
    }))
    setSaved(true)
  }

  function removeStatus() {
    setStatusEmoji('')
    setStatusMessage('')
    setBusy(false)
    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser, status: null },
      users: prev.users.map(u => (u.id === user.id ? { ...u, status: null } : u)),
    }))
  }

  const pickedEmoji = STATUS_EMOJI[statusEmoji] || null

  return (
    <ProfileLayout crumb="Edit Profile">
      {saved ? (
        <div className="gl-alert flash-notice gl-alert-info" role="alert" data-testid="alert-info">
          <div className="gl-alert-body">Profile was successfully updated</div>
          <button type="button" className="gl-dismiss-btn btn gl-button btn-default-tertiary btn-icon js-close"
            aria-label="Dismiss" onClick={() => setSaved(false)}>×</button>
        </div>
      ) : null}

      <SettingsSearch />

      <form id={`edit_user_${user.id}`} className="edit-user js-edit-user gl-mt-3" onSubmit={submit}>
        <SettingsSection title="Public avatar"
          blurb="You can upload your avatar here or change it at gravatar.com">
          <div className="avatar-image gl-display-flex" style={{ gap: 16 }}>
            <UserAvatar user={user} size={96} className="gl-float-left gl-mr-5" />
            <div>
              <h5 className="gl-mt-0">Upload new avatar</h5>
              <input id="user_avatar" type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => setAvatarFile(e.target.files && e.target.files[0] ? e.target.files[0].name : '')} />
              <button type="button" className="gl-button btn btn-md btn-default js-choose-user-avatar-button"
                onClick={() => document.getElementById('user_avatar').click()}>Choose file...</button>
              <span className="gl-ml-3 js-avatar-filename">{avatarFile || 'No file chosen.'}</span>
              <div className="gl-text-gray-500">The maximum file size allowed is 200KB.</div>
            </div>
          </div>
        </SettingsSection>

        {/* ANCHOR — tasks 418–422 read `.cover-status` on /byteblaze. */}
        <SettingsSection title="Current status" id="current-status"
          blurb="This emoji and message will appear on your profile and throughout the interface.">
          <div className="gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
            <div className={`emoji-picker dropdown${emojiOpen ? ' show' : ''}`}>
              <button type="button" className="btn gl-button btn-default emoji-menu-toggle-button"
                aria-label="Set status emoji" onClick={() => setEmojiOpen(o => !o)}>
                {pickedEmoji
                  ? <span>{pickedEmoji.char}</span>
                  : <span className="gl-relative" data-testid="no-emoji-placeholder">🙂</span>}
              </button>
              {emojiOpen ? (
                <div className="dropdown-menu dropdown-extended-height show" style={{ display: 'block' }}>
                  <ul className="list-unstyled gl-display-flex gl-p-3" style={{ gap: 6, flexWrap: 'wrap' }}>
                    {STATUS_EMOJI_PICKER.map(key => (
                      <li key={key}>
                        <button type="button" className="btn gl-button btn-default btn-sm"
                          title={STATUS_EMOJI[key].title}
                          onClick={() => { setStatusEmoji(key); setEmojiOpen(false) }}>
                          {STATUS_EMOJI[key].char}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="input-group" style={{ flex: 1 }}>
              <input type="text" className="gl-form-input form-control js-gfm-input-initialized"
                placeholder="What's your status?" name="user[status][message]"
                value={statusMessage} onChange={e => setStatusMessage(e.target.value)} />
              <div className="input-group-append">
                <button type="button" className="btn gl-button btn-default js-clear-user-status-button"
                  title="Clear status" aria-label="Clear status"
                  onClick={() => { setStatusMessage(''); setStatusEmoji('') }}>×</button>
              </div>
            </div>
          </div>

          <div className="gl-form-checkbox custom-control custom-checkbox gl-mt-3">
            <input id="user_availability" type="checkbox" className="custom-control-input"
              data-testid="user-availability-checkbox"
              checked={busy} onChange={e => setBusy(e.target.checked)} />
            <label className="custom-control-label" htmlFor="user_availability">Set yourself as busy</label>
            <p className="help-text">Displays that you are busy or not able to respond</p>
          </div>

          <fieldset className="gl-mt-3">
            <legend className="col-form-label">Clear status after</legend>
            <div className={`dropdown${clearOpen ? ' show' : ''}`} data-testid="clear-status-at-dropdown">
              <button type="button" className="btn gl-button btn-default gl-dropdown-toggle"
                onClick={() => setClearOpen(o => !o)}>
                <span className="gl-dropdown-button-text">{clearAfter}</span>
              </button>
              {clearOpen ? (
                <div className="dropdown-menu show" style={{ display: 'block' }}>
                  {CLEAR_STATUS_OPTIONS.map(o => (
                    <button key={o.testid} type="button" className="dropdown-item" data-testid={o.testid}
                      onClick={() => { setClearAfter(o.label); setClearOpen(false) }}>{o.label}</button>
                  ))}
                </div>
              ) : null}
            </div>
          </fieldset>

          <button type="button" className="btn gl-button btn-default gl-mt-3" onClick={removeStatus}>Remove status</button>
        </SettingsSection>

        <SettingsSection title="Time settings" blurb="Set your local time zone.">
          <div className="form-group gl-form-group gl-md-form-input-lg">
            <label htmlFor="user_user_timezone">Time zone</label>
            <select id="user_user_timezone" name="user[timezone]" className="gl-form-select custom-select"
              value={form.timezone} onChange={e => set('timezone', e.target.value)}>
              {TIMEZONES.map(tz => (
                <option key={tz} value={tz === 'Select timezone' ? '' : tz}>{tz}</option>
              ))}
            </select>
          </div>
        </SettingsSection>

        <SettingsSection title="Main settings" blurb="This information will appear on your profile.">
          <div className="row">
            <div className="col-md-9 rspec-full-name">
              <Field id="user_name" name="user[name]" label="Full name" value={form.name}
                onChange={v => set('name', v)}
                helper="Enter your name, so people you know can recognize you." />
            </div>
            <div className="col-md-3">
              <Field id="user_id" name="user[id]" label="User ID" value={String(user.id)} readOnly />
            </div>
          </div>
          <Field id="user_pronouns" name="user[pronouns]" label="Pronouns" value={form.pronouns}
            onChange={v => set('pronouns', v)}
            helper="Enter your pronouns to let people know how to refer to you." />
          <Field id="user_pronunciation" name="user[pronunciation]" label="Pronunciation" value={form.pronunciation}
            onChange={v => set('pronunciation', v)}
            helper="Enter how your name is pronounced to help people address you correctly." />
          <Field id="user_email" name="user[email]" label="Email" value={form.email}
            onChange={v => set('email', v)}
            helper="We also use email for avatar detection if no avatar is uploaded." />

          <div className="form-group gl-form-group">
            <label htmlFor="user_public_email">Public email</label>
            <select id="user_public_email" name="user[public_email]" className="gl-form-select custom-select"
              value={form.public_email} onChange={e => set('public_email', e.target.value)}>
              <option value="">Do not show on profile</option>
              <option value={user.email}>{user.email}</option>
            </select>
            <small className="form-text text-gl-muted">This email will be displayed on your public profile.</small>
          </div>

          <div className="form-group gl-form-group">
            <label htmlFor="user_commit_email">Commit email</label>
            <select id="user_commit_email" name="user[commit_email]" className="gl-form-select custom-select"
              value={form.commit_email} onChange={e => set('commit_email', e.target.value)}>
              <option value="">{`Use primary email (${user.email})`}</option>
              <option value="_private">{`Use a private email - ${user.id}-${user.username}@users.noreply.db0150aa304d`}</option>
              <option value={user.email}>{user.email}</option>
            </select>
            <small className="form-text text-gl-muted">
              This email will be used for web based operations, such as edits and merges.{' '}
              <a href="/help/user/profile/index#change-the-email-displayed-on-your-commits">Learn more.</a>
            </small>
          </div>

          <Field id="user_skype" name="user[skype]" label="Skype" value={form.skype}
            onChange={v => set('skype', v)} placeholder="username" />
          <Field id="user_linkedin" name="user[linkedin]" label="Linkedin" value={form.linkedin}
            onChange={v => set('linkedin', v)}
            helper="Your LinkedIn profile name from linkedin.com/in/profilename" />
          <Field id="user_twitter" name="user[twitter]" label="Twitter" value={form.twitter}
            onChange={v => set('twitter', v)} placeholder="@username" />

          {/* ANCHOR — tasks 448–452 type here and read `[itemprop="url"]`. */}
          <Field id="user_website_url" name="user[website_url]" label="Website url" value={form.website_url}
            onChange={v => set('website_url', v)} placeholder="https://website.com" />

          <Field id="user_location" name="user[location]" label="Location" value={form.location}
            onChange={v => set('location', v)} placeholder="City, country" />
          <Field id="user_job_title" name="user[job_title]" label="Job title" value={form.job_title}
            onChange={v => set('job_title', v)} />
          <Field id="user_organization" name="user[organization]" label="Organization" value={form.organization}
            onChange={v => set('organization', v)} helper="Who you represent or work for." />

          <div className="form-group gl-form-group">
            <label htmlFor="user_bio">Bio</label>
            <textarea id="user_bio" name="user[bio]" rows={4} maxLength={250}
              className="gl-form-input gl-form-textarea form-control"
              value={form.bio} onChange={e => set('bio', e.target.value)} />
            <small className="form-text text-gl-muted">Tell us about yourself in fewer than 250 characters.</small>
          </div>

          <fieldset className="form-group gl-form-group">
            <legend className="col-form-label">Private profile</legend>
            <div className="gl-form-checkbox custom-control custom-checkbox">
              <input id="user_private_profile" type="checkbox" className="custom-control-input"
                checked={form.private_profile} onChange={e => set('private_profile', e.target.checked)} />
              <label className="custom-control-label" htmlFor="user_private_profile">
                Don&apos;t display activity-related personal information on your profile.
              </label>
            </div>
          </fieldset>

          <fieldset className="form-group gl-form-group">
            <legend className="col-form-label">Private contributions</legend>
            <div className="gl-form-checkbox custom-control custom-checkbox">
              <input id="user_include_private_contributions" type="checkbox" className="custom-control-input"
                checked={form.include_private_contributions}
                onChange={e => set('include_private_contributions', e.target.checked)} />
              <label className="custom-control-label" htmlFor="user_include_private_contributions">
                Include private contributions on my profile
              </label>
              <p className="help-text" data-testid="pajamas-component-help-text">
                Choose to show contributions of private projects on your public profile without any
                project, repository or organization information.
              </p>
            </div>
          </fieldset>
        </SettingsSection>

        <div className="row js-hide-when-nothing-matches-search gl-mt-5">
          <div className="col-lg-12">
            <button type="submit" className="gl-button btn btn-md btn-confirm gl-mr-3 js-password-prompt-btn">
              Update profile settings
            </button>
            <a className="gl-button btn btn-md btn-default" href={`/${user.username}`}>Cancel</a>
          </div>
        </div>
      </form>
    </ProfileLayout>
  )
}
