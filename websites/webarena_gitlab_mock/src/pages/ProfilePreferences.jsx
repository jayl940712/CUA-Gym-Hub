import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import ProfileLayout from '../components/people/ProfileLayout.jsx'
import SettingsSection, { SettingsSearch } from '../components/people/SettingsSection.jsx'

// ROUTES #38 — `/-/profile/preferences`. assets/README.md §22b.
// Every option list below is the VERIFIED source list; §22b flags several
// plausible-but-wrong guesses (there is no plain `Dark` colour theme, no
// `Integrations` section, and the label is `Dashboard`, not "Default dashboard").

const COLOR_THEMES = [
  { id: '1', cls: 'ui-indigo', label: 'Indigo' },
  { id: '6', cls: 'ui-light-indigo', label: 'Light Indigo' },
  { id: '4', cls: 'ui-blue', label: 'Blue' },
  { id: '7', cls: 'ui-light-blue', label: 'Light Blue' },
  { id: '5', cls: 'ui-green', label: 'Green' },
  { id: '8', cls: 'ui-light-green', label: 'Light Green' },
  { id: '9', cls: 'ui-red', label: 'Red' },
  { id: '10', cls: 'ui-light-red', label: 'Light Red' },
  { id: '2', cls: 'ui-gray', label: 'Gray' },
  { id: '3', cls: 'ui-light-gray', label: 'Light Gray' },
  { id: '11', cls: 'gl-dark', label: 'Dark Mode (alpha)' },
]

const SYNTAX_THEMES = [
  { id: '1', label: 'Light' }, { id: '2', label: 'Dark' },
  { id: '3', label: 'Solarized Light' }, { id: '4', label: 'Solarized Dark' },
  { id: '5', label: 'Monokai' }, { id: '6', label: 'None' },
]

const DASHBOARDS = [
  ['projects', 'Your Projects (default)'], ['stars', 'Starred Projects'],
  ['project_activity', "Your Projects' Activity"], ['starred_project_activity', "Starred Projects' Activity"],
  ['groups', 'Your Groups'], ['todos', 'Your To-Do List'],
  ['issues', 'Assigned Issues'], ['merge_requests', 'Assigned merge requests'],
  ['followed_user_activity', "Followed Users' Activity"],
]

const LANGUAGES = [
  ['zh_CN', 'Chinese, Simplified - 简体中文 (97% translated)'],
  ['zh_TW', 'Chinese, Traditional (Taiwan) - 繁體中文 (台灣) (99% translated)'],
  ['da_DK', 'Danish - dansk (36% translated)'],
  ['en', 'English (100% translated)'],
  ['fr', 'French - français (94% translated)'],
  ['de', 'German - Deutsch (17% translated)'],
  ['ja', 'Japanese - 日本語 (30% translated)'],
  ['ko', 'Korean - 한국어 (20% translated)'],
  ['nb_NO', 'Norwegian (Bokmål) - norsk (bokmål) (24% translated)'],
  ['pl_PL', 'Polish - polski (3% translated)'],
  ['pt_BR', 'Portuguese (Brazil) - português (Brasil) (57% translated)'],
  ['ro_RO', 'Romanian - română (96% translated)'],
  ['ru', 'Russian - русский (26% translated)'],
  ['si_LK', 'Sinhalese - සිංහල (11% translated)'],
  ['es', 'Spanish - español (35% translated)'],
  ['tr_TR', 'Turkish - Türkçe (11% translated)'],
  ['uk', 'Ukrainian - українська (52% translated)'],
]

const CHECKBOXES = [
  ['render_whitespace_in_code', 'Render whitespace characters in the Web IDE', null, false],
  ['show_whitespace_in_diffs', 'Show whitespace changes in diffs', null, true],
  ['view_diffs_file_by_file', "Show one file at a time on merge request's Changes tab",
    'Instead of all the files changed, show only one file at a time. To switch between files, use the file browser.', false],
  ['markdown_surround_selection', 'Surround text selection when typing quotes or brackets',
    'When you type in a description or comment box, selected text is surrounded by the corresponding character after typing one of the following characters: " , \' , ` , ( , [ , { , < , * , _ .', true],
  ['markdown_automatic_lists', 'Automatically add new list items',
    'When you type in a description or comment box, pressing Enter in a list adds a new item below.', true],
]

export default function ProfilePreferences() {
  const { state, setUi } = useApp()
  usePageChrome({ title: 'Preferences · User Settings · GitLab' })

  const prefs = (state.ui && state.ui.preferences) || {}
  const [form, setForm] = useState(() => ({
    theme_id: prefs.themeId || '1',
    color_scheme_id: prefs.colorSchemeId || '1',
    layout: prefs.layout || 'fixed',
    dashboard: prefs.dashboard || 'projects',
    project_view: prefs.projectView || 'files',
    tab_width: prefs.tabWidth || 8,
    preferred_language: prefs.language || 'en',
    first_day_of_week: prefs.firstDayOfWeek || '',
    time_display_relative: prefs.timeDisplayRelative !== false,
    ...Object.fromEntries(CHECKBOXES.map(([k, , , dflt]) => [k, prefs[k] !== undefined ? prefs[k] : dflt])),
  }))
  const [saved, setSaved] = useState(false)

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function submit(e) {
    e.preventDefault()
    setUi(ui => ({
      ...ui,
      preferences: {
        ...ui.preferences,
        themeId: form.theme_id,
        colorSchemeId: form.color_scheme_id,
        layout: form.layout,
        dashboard: form.dashboard,
        projectView: form.project_view,
        tabWidth: Number(form.tab_width),
        language: form.preferred_language,
        firstDayOfWeek: form.first_day_of_week,
        timeDisplayRelative: form.time_display_relative,
        ...Object.fromEntries(CHECKBOXES.map(([k]) => [k, form[k]])),
      },
    }))
    setSaved(true)
  }

  return (
    <ProfileLayout crumb="Preferences">
      {saved ? (
        <div className="gl-alert flash-notice gl-alert-info" role="alert">
          <div className="gl-alert-body">Preferences saved.</div>
          <button type="button" className="gl-dismiss-btn btn gl-button btn-default-tertiary btn-icon js-close"
            aria-label="Dismiss" onClick={() => setSaved(false)}>×</button>
        </div>
      ) : null}

      <SettingsSearch />

      <form id="profile-preferences-form" className="edit_user" onSubmit={submit}>
        <SettingsSection title="Color theme" blurb="Customize the color of GitLab." id="navigation-theme">
          <div className="row application-theme">
            {COLOR_THEMES.map(t => (
              <label className="col-6 col-sm-4 col-md-3 gl-mb-5 gl-text-center" key={t.id} htmlFor={`user_theme_id_${t.id}`}>
                <div className={`preview ${t.cls}`} style={{ height: 48, borderRadius: 4, background: 'var(--gl-navbar-bg, #292961)' }} />
                <div className="gl-form-radio custom-control custom-radio">
                  <input id={`user_theme_id_${t.id}`} type="radio" name="user[theme_id]" value={t.id}
                    className="custom-control-input"
                    checked={form.theme_id === t.id} onChange={() => set('theme_id', t.id)} />
                  <label className="custom-control-label" htmlFor={`user_theme_id_${t.id}`}>{t.label}</label>
                </div>
              </label>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title="Syntax highlighting theme" id="syntax-highlighting-theme"
          blurb="This setting allows you to customize the appearance of the syntax.">
          <div className="row syntax-theme">
            {SYNTAX_THEMES.map(t => (
              <label className="col-6 col-sm-4 gl-mb-5 gl-text-center" key={t.id} htmlFor={`user_color_scheme_id_${t.id}`}>
                <div className="preview" style={{ height: 48, borderRadius: 4, background: '#f0f0f4' }} />
                <div className="gl-form-radio custom-control custom-radio">
                  <input id={`user_color_scheme_id_${t.id}`} type="radio" name="user[color_scheme_id]" value={t.id}
                    className="custom-control-input"
                    checked={form.color_scheme_id === t.id} onChange={() => set('color_scheme_id', t.id)} />
                  <label className="custom-control-label" htmlFor={`user_color_scheme_id_${t.id}`}>{t.label}</label>
                </div>
              </label>
            ))}
          </div>
        </SettingsSection>

        <SettingsSection title="Behavior" id="behavior"
          blurb="This setting allows you to customize the behavior of the system layout and default views.">
          <div className="form-group gl-form-group">
            <label htmlFor="user_layout">Layout width</label>
            <select id="user_layout" name="user[layout]" className="gl-form-select custom-select"
              value={form.layout} onChange={e => set('layout', e.target.value)}>
              <option value="fixed">Fixed</option>
              <option value="fluid">Fluid</option>
            </select>
            <small className="form-text text-gl-muted">Choose between fixed (max. 1280px) and fluid (100%) application layout.</small>
          </div>

          <div className="form-group gl-form-group">
            <label htmlFor="user_dashboard">Dashboard</label>
            <select id="user_dashboard" name="user[dashboard]" className="gl-form-select custom-select"
              value={form.dashboard} onChange={e => set('dashboard', e.target.value)}>
              {DASHBOARDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <small className="form-text text-gl-muted">Choose what content you want to see by default on your dashboard.</small>
          </div>

          <div className="form-group gl-form-group">
            <label htmlFor="user_project_view">Project overview content</label>
            <select id="user_project_view" name="user[project_view]" className="gl-form-select custom-select"
              value={form.project_view} onChange={e => set('project_view', e.target.value)}>
              <option value="files">Files and Readme (default)</option>
              <option value="activity">Activity</option>
              <option value="readme">Readme</option>
            </select>
            <small className="form-text text-gl-muted">Choose what content you want to see on a project’s overview page.</small>
          </div>

          {CHECKBOXES.map(([key, label, help]) => (
            <div className="gl-form-checkbox custom-control custom-checkbox gl-mb-3" key={key}>
              <input id={`user_${key}`} type="checkbox" className="custom-control-input"
                name={`user[${key}]`} checked={!!form[key]} onChange={e => set(key, e.target.checked)} />
              <label className="custom-control-label" htmlFor={`user_${key}`}>{label}</label>
              {help ? <p className="help-text">{help}</p> : null}
            </div>
          ))}

          <div className="form-group gl-form-group">
            <label htmlFor="user_tab_width">Tab width</label>
            <input id="user_tab_width" type="number" required className="form-control gl-form-input"
              name="user[tab_width]" value={form.tab_width} onChange={e => set('tab_width', e.target.value)} />
            <small className="form-text text-gl-muted">Must be a number between 1 and 12</small>
          </div>
        </SettingsSection>

        <SettingsSection title="Localization" id="localization"
          blurb="Customize language and region related settings.">
          <div className="form-group gl-form-group">
            <label htmlFor="user_preferred_language">Language</label>
            <select id="user_preferred_language" name="user[preferred_language]" className="gl-form-select custom-select"
              value={form.preferred_language} onChange={e => set('preferred_language', e.target.value)}>
              {LANGUAGES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <small className="form-text text-gl-muted">This feature is experimental and translations are not yet complete.</small>
          </div>
          <div className="form-group gl-form-group">
            <label htmlFor="user_first_day_of_week">First day of the week</label>
            <select id="user_first_day_of_week" name="user[first_day_of_week]" className="gl-form-select custom-select"
              value={form.first_day_of_week} onChange={e => set('first_day_of_week', e.target.value)}>
              <option value="">System default (Sunday)</option>
              <option value="0">Sunday</option>
              <option value="1">Monday</option>
              <option value="6">Saturday</option>
            </select>
          </div>
        </SettingsSection>

        <SettingsSection title="Time preferences" id="time-preferences"
          blurb="Configure how dates and times display for you.">
          <div className="gl-form-checkbox custom-control custom-checkbox">
            <input id="user_time_display_relative" type="checkbox" className="custom-control-input"
              name="user[time_display_relative]" checked={form.time_display_relative}
              onChange={e => set('time_display_relative', e.target.checked)} />
            <label className="custom-control-label" htmlFor="user_time_display_relative">Use relative times</label>
            <p className="help-text" data-testid="pajamas-component-help-text">For example: 30 minutes ago.</p>
          </div>
        </SettingsSection>

        <div className="row gl-mt-3 js-preferences-form js-search-settings-section">
          <div className="col-sm-12 js-hide-when-nothing-matches-search">
            <button type="submit" name="commit" value="Save changes"
              className="btn btn-confirm btn-md gl-button">Save changes</button>
          </div>
        </div>
      </form>
    </ProfileLayout>
  )
}
