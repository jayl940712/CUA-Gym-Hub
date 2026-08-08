import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import ProfileLayout from '../components/people/ProfileLayout.jsx'
import SettingsSection, { SettingsSearch } from '../components/people/SettingsSection.jsx'
import { EntityAvatar } from '../components/layout/Avatar.jsx'

// ROUTES #39 — `/-/profile/notifications`. The per-project rows are driven off
// the projects byteblaze is a member of; the chosen level persists in
// state.ui.notificationLevels so /go sees it.

const LEVELS = [
  ['global', 'Global'],
  ['watch', 'Watch'],
  ['participate', 'Participate'],
  ['mention', 'On mention'],
  ['disabled', 'Disabled'],
  ['custom', 'Custom'],
]

export default function ProfileNotifications() {
  const { state, currentUser, setUi } = useApp()
  usePageChrome({ title: 'Notifications · User Settings · GitLab' })

  const [globalLevel, setGlobalLevel] = useState(
    (state.ui.notificationLevels && state.ui.notificationLevels.global) || 'participate')

  const memberProjectIds = new Set(state.members
    .filter(m => m.source_type === 'project' && m.user_id === currentUser.id).map(m => m.source_id))
  const projects = state.projects.filter(p => memberProjectIds.has(p.id))

  function setLevel(key, value) {
    setUi(ui => ({ ...ui, notificationLevels: { ...ui.notificationLevels, [key]: value } }))
  }

  return (
    <ProfileLayout crumb="Notifications">
      <SettingsSearch />

      <SettingsSection title="Notifications"
        blurb="You can specify notification level per group or per project.">
        <p className="gl-text-gray-500">
          By default, all projects and groups use the global notifications setting.
        </p>

        <div className="form-group gl-form-group">
          <label htmlFor="user_notification_email">Notification email</label>
          <select id="user_notification_email" className="gl-form-select custom-select" defaultValue={currentUser.email}>
            <option value={currentUser.email}>{currentUser.email}</option>
          </select>
          <small className="form-text text-gl-muted">
            We won&apos;t notify you of your own activity by default.
          </small>
        </div>

        <div className="form-group gl-form-group">
          <label htmlFor="global_notification_level">Global notification level</label>
          <select id="global_notification_level" className="gl-form-select custom-select"
            value={globalLevel}
            onChange={e => { setGlobalLevel(e.target.value); setLevel('global', e.target.value) }}>
            {LEVELS.filter(([v]) => v !== 'global').map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>

        <div className="gl-form-checkbox custom-control custom-checkbox">
          <input id="user_notified_of_own_activity" type="checkbox" className="custom-control-input"
            checked={!!state.ui.notificationLevels.own_activity}
            onChange={e => setLevel('own_activity', e.target.checked)} />
          <label className="custom-control-label" htmlFor="user_notified_of_own_activity">
            Receive notifications about your own activity
          </label>
        </div>
      </SettingsSection>

      <SettingsSection title="Projects" blurb="Set a notification level per project.">
        <ul className="content-list notification-list">
          {projects.map(p => {
            const key = `project:${p.id}`
            const value = state.ui.notificationLevels[key] || 'global'
            return (
              <li className="notification-list-item gl-display-flex gl-align-items-center gl-py-3" key={p.id}
                style={{ gap: 12 }}>
                <EntityAvatar entity={p} size={32} kind="project" />
                <a className="gl-flex-grow-1" href={`/${p.full_path}`}>{p.full_path}</a>
                <select className="gl-form-select custom-select" style={{ width: 180 }}
                  aria-label={`Notification setting for ${p.name}`}
                  value={value} onChange={e => setLevel(key, e.target.value)}>
                  {LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </li>
            )
          })}
          {projects.length === 0 ? <li className="gl-text-gray-500">You are not a member of any projects.</li> : null}
        </ul>
      </SettingsSection>
    </ProfileLayout>
  )
}
