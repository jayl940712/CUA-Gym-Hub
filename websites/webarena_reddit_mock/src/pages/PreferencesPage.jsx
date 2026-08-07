import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import UserSidebar from '../components/user/UserSidebar.jsx'
import Forbidden from '../components/user/Forbidden.jsx'
import NotFound from './NotFound.jsx'
import { useApp } from '../context/AppContext.jsx'
import { LOCALES, TIMEZONES } from '../components/user/preferenceOptions.js'
import '../components/user/user.css'

// ROUTES #67 — templates/user/settings.html.twig + src/Form/UserSettingsType.php.
//
// Every field, id, name, option value, option label, help string and fieldset
// legend below is transcribed from the source's own rendered form,
// assets/html/user_preferences-auth.html, cross-checked against
// assets/screenshots/reference/16-user-settings.png. The fieldset ORDER on the
// live page is General / Posting / Notifications / Privacy / Appearance — note
// that this differs from the grouping listed in assets/README.md §12, and the
// rendered page wins.
//
// Two of these fields are load-bearing rather than cosmetic:
//   * frontPage           -> what `/` renders (ListingPage reads
//                            currentUser.frontPage)
//   * frontPageSortMode   -> the default sort on `/`
// Setting frontPage to `all` must make `/` non-empty. Verified in a browser.
//
// The seeded user's 25 real preference fields live on `currentUser`; saving
// routes through updatePreferences(), so every change shows up in /go's
// state_diff.

/** A `.form-flex--single-line` row wrapping a labelled <select>. */
function SelectRow({ id, name, label, value, options, onChange, help }) {
  return (
    <div className="flow-slim">
      <div className="form-flex form-flex--single-line">
        <label className="form-flex__align text-align-right" htmlFor={id}>{label}</label>
        <span className="unstylable-widget">
          <select id={id} name={name} className="form-control" value={value}
                  onChange={e => onChange(e.target.value)}>
            {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <span className="unstylable-widget__caret" aria-hidden="true"></span>
        </span>
      </div>
      {help && (
        <div className="form-flex form-flex--single-line">
          <div className="form-flex__align" aria-hidden="true"></div>
          <div id={`${id}_help`} className="text-flow-slim">
            <p className="text-sm fg-muted">{help}</p>
          </div>
        </div>
      )}
    </div>
  )
}

/** A `.form-flex--no-collapse` row wrapping a labelled checkbox. */
function CheckRow({ id, name, label, checked, onChange, help }) {
  return (
    <div className="flow-slim">
      <div className="form-flex form-flex--single-line form-flex--no-collapse">
        <span className="form-flex__align" aria-hidden="true"></span>
        <span className="unstylable-widget">
          <input type="checkbox" className="form-control" value="1" id={id} name={name}
                 checked={checked} onChange={e => onChange(e.target.checked)} />
          <span className="icon icon--with-alt-text icon--no-align unstylable-widget__check">
            <svg width="16" height="16" aria-hidden="true">
              <use xlinkHref="/icons.svg#ok" />
            </svg>
          </span>
        </span>
        <label htmlFor={id}>{label}</label>
      </div>
      {help && (
        <div className="form-flex form-flex--single-line">
          <div className="form-flex__align" aria-hidden="true"></div>
          <div id={`${id}_help`} className="text-flow-slim">
            <p className="text-sm fg-muted">{help}</p>
          </div>
        </div>
      )}
    </div>
  )
}

const FRONT_PAGE_OPTIONS = [
  ['featured', 'Featured'],
  ['subscribed', 'Subscribed'],
  ['all', 'All'],
  ['moderated', 'Moderated']
]

// The source's front-page sort select offers only these three, even though the
// listing routes accept six sorts.
const FRONT_PAGE_SORT_OPTIONS = [
  ['hot', 'Hot'],
  ['new', 'New'],
  ['active', 'Active']
]

const LINK_DESTINATION_OPTIONS = [
  ['url', 'Open the linked content'],
  ['submission', 'Open the submission']
]

const NIGHT_MODE_OPTIONS = [
  ['auto', 'System preference'],
  ['light', 'Light'],
  ['dark', 'Dark']
]

const THEME_OPTIONS = [['', '(default)']]

export default function PreferencesPage() {
  const { username } = useParams()
  const { state, getUser, updatePreferences, addFlash } = useApp()

  const user = getUser(username)
  const isSelf = user && user.username === state.currentUser.username
  const cu = state.currentUser

  const [form, setForm] = useState({
    locale: cu.locale || 'en',
    timezone: cu.timezone || 'UTC',
    frontPage: cu.frontPage || 'featured',
    frontPageSortMode: cu.frontPageSortMode || 'hot',
    submissionLinkDestination: cu.submissionLinkDestination || 'submission',
    openExternalLinksInNewTab: !!cu.openExternalLinksInNewTab,
    showThumbnails: !!cu.showThumbnails,
    autoFetchSubmissionTitles: !!cu.autoFetchSubmissionTitles,
    enablePostPreviews: !!cu.enablePostPreviews,
    notifyOnReply: !!cu.notifyOnReply,
    notifyOnMentions: !!cu.notifyOnMentions,
    allowPrivateMessages: !!cu.allowPrivateMessages,
    nightMode: cu.nightMode || 'light',
    preferredTheme: cu.preferredTheme || '',
    showCustomStylesheets: !!cu.showCustomStylesheets,
    preferredFonts: cu.preferredFonts || '',
    fullWidthDisplayEnabled: !!cu.fullWidthDisplayEnabled,
    poppersEnabled: !!cu.poppersEnabled
  })

  if (!user) return <NotFound />
  if (!isSelf) return <Forbidden />

  const set = (key) => (value) => setForm(f => ({ ...f, [key]: value }))

  const onSubmit = (e) => {
    e.preventDefault()
    updatePreferences({
      ...form,
      preferredFonts: form.preferredFonts === '' ? null : form.preferredFonts
    })
    addFlash('User settings have been updated.')
  }

  return (
    <Layout
      title={`Editing user settings for ${user.username}`}
      sidebar={<UserSidebar user={user} />}
    >
      <h1 className="page-heading">Editing user settings for {user.username}</h1>

      <form name="user_settings" method="post" className="form flow" onSubmit={onSubmit}>
        <fieldset className="fieldset flow">
          <legend>General</legend>

          <SelectRow
            id="user_settings_locale" name="user_settings[locale]" label="Language"
            value={form.locale} options={LOCALES} onChange={set('locale')}
          />
          <SelectRow
            id="user_settings_timezone" name="user_settings[timezone]" label="Time zone"
            value={form.timezone} options={TIMEZONES} onChange={set('timezone')}
          />

          <div>
            <div className="form-flex form-flex--single-line">
              <label htmlFor="user_settings_frontPage_filterBy" className="form-flex__align text-align-right">
                Front page
              </label>
              <span className="compound-form-widget">
                <span className="unstylable-widget">
                  <select
                    id="user_settings_frontPage_filterBy"
                    name="user_settings[frontPage][filterBy]"
                    aria-label="Filter by" className="form-control"
                    value={form.frontPage} onChange={e => set('frontPage')(e.target.value)}
                  >
                    {FRONT_PAGE_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <span className="unstylable-widget__caret" aria-hidden="true"></span>
                </span>
                <span className="unstylable-widget">
                  <select
                    id="user_settings_frontPage_sortBy"
                    name="user_settings[frontPage][sortBy]"
                    aria-label="Sort by" className="form-control"
                    value={form.frontPageSortMode}
                    onChange={e => set('frontPageSortMode')(e.target.value)}
                  >
                    {FRONT_PAGE_SORT_OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <span className="unstylable-widget__caret" aria-hidden="true"></span>
                </span>
              </span>
            </div>
          </div>

          <SelectRow
            id="user_settings_submissionLinkDestination"
            name="user_settings[submissionLinkDestination]"
            label="When clicking submission links…"
            value={form.submissionLinkDestination}
            options={LINK_DESTINATION_OPTIONS}
            onChange={set('submissionLinkDestination')}
          />

          <CheckRow
            id="user_settings_openExternalLinksInNewTab"
            name="user_settings[openExternalLinksInNewTab]"
            label="Open external links in new tab"
            checked={form.openExternalLinksInNewTab}
            onChange={set('openExternalLinksInNewTab')}
          />
          <CheckRow
            id="user_settings_showThumbnails"
            name="user_settings[showThumbnails]"
            label="Show thumbnails"
            checked={form.showThumbnails}
            onChange={set('showThumbnails')}
          />
        </fieldset>

        <fieldset className="fieldset flow">
          <legend>Posting</legend>

          <CheckRow
            id="user_settings_autoFetchSubmissionTitles"
            name="user_settings[autoFetchSubmissionTitles]"
            label="Auto-fetch submission titles"
            checked={form.autoFetchSubmissionTitles}
            onChange={set('autoFetchSubmissionTitles')}
          />
          <CheckRow
            id="user_settings_enablePostPreviews"
            name="user_settings[enablePostPreviews]"
            label="Show post previews"
            checked={form.enablePostPreviews}
            onChange={set('enablePostPreviews')}
          />
        </fieldset>

        <fieldset className="fieldset flow">
          <legend>Notifications</legend>

          <CheckRow
            id="user_settings_notifyOnReply"
            name="user_settings[notifyOnReply]"
            label="Notify on reply"
            checked={form.notifyOnReply}
            onChange={set('notifyOnReply')}
            help="Get notifications when someone replies to your posts."
          />
          <CheckRow
            id="user_settings_notifyOnMentions"
            name="user_settings[notifyOnMentions]"
            label="Notify on mentions"
            checked={form.notifyOnMentions}
            onChange={set('notifyOnMentions')}
            help="Get notifications when someone links to your user profile."
          />
        </fieldset>

        <fieldset className="fieldset flow">
          <legend>Privacy</legend>

          <CheckRow
            id="user_settings_allowPrivateMessages"
            name="user_settings[allowPrivateMessages]"
            label="Allow private messages"
            checked={form.allowPrivateMessages}
            onChange={set('allowPrivateMessages')}
            help="If disabled, only admins, co-moderators, and moderators of forums you've recently participated in will be able to send you private messages."
          />
        </fieldset>

        <fieldset className="fieldset flow">
          <legend>Appearance</legend>

          <SelectRow
            id="user_settings_nightMode" name="user_settings[nightMode]" label="Night mode"
            value={form.nightMode} options={NIGHT_MODE_OPTIONS} onChange={set('nightMode')}
          />
          <SelectRow
            id="user_settings_preferredTheme" name="user_settings[preferredTheme]"
            label="Preferred theme" value={form.preferredTheme} options={THEME_OPTIONS}
            onChange={set('preferredTheme')}
            help="Asterisk indicates same as default."
          />
          <CheckRow
            id="user_settings_showCustomStylesheets"
            name="user_settings[showCustomStylesheets]"
            label="Let forums override preferred theme"
            checked={form.showCustomStylesheets}
            onChange={set('showCustomStylesheets')}
          />

          <div className="flow-slim">
            <div className="form-flex form-flex--single-line">
              <label className="form-flex__align text-align-right" htmlFor="user_settings_preferredFonts">
                Preferred font(s)
              </label>
              <input
                type="text" id="user_settings_preferredFonts" name="user_settings[preferredFonts]"
                placeholder="Roboto, sans-serif" aria-describedby="user_settings_preferredFonts_help"
                className="form-control"
                value={form.preferredFonts} onChange={e => set('preferredFonts')(e.target.value)}
              />
            </div>
            <div className="form-flex form-flex--single-line">
              <div className="form-flex__align" aria-hidden="true"></div>
              <div id="user_settings_preferredFonts_help" className="text-flow-slim">
                <p className="fg-muted text-sm">
                  Comma-separated list of the fonts you prefer. These can be fonts from your
                  system, or from the list of server-provided fonts below.
                </p>
                <p className="fg-muted text-sm">
                  Server-provided fonts (available everywhere):{' '}
                  <strong>Opendyslexic</strong>, <strong>Roboto</strong>, <strong>Ubuntu</strong>
                </p>
                <p className="fg-muted text-sm">
                  Aliased font names:{' '}
                  <strong><abbr title="Roboto, sans-serif">Default</abbr></strong>,{' '}
                  <strong>
                    <abbr title="-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif, Apple Color Emoji, Segoe UI Emoji, Segoe UI Symbol">
                      System
                    </abbr>
                  </strong>
                </p>
              </div>
            </div>
          </div>

          <CheckRow
            id="user_settings_fullWidthDisplayEnabled"
            name="user_settings[fullWidthDisplayEnabled]"
            label="Full width display"
            checked={form.fullWidthDisplayEnabled}
            onChange={set('fullWidthDisplayEnabled')}
          />
          <CheckRow
            id="user_settings_poppersEnabled"
            name="user_settings[poppersEnabled]"
            label="Enable poppers"
            checked={form.poppersEnabled}
            onChange={set('poppersEnabled')}
            help="Poppers are small panels that display info and buttons when you hover over certain things (e.g. usernames). They are only available when using a mouse."
          />
        </fieldset>

        <div className="form__row form__button-row">
          <button className="button" type="submit">Save changes</button>
        </div>
      </form>
    </Layout>
  )
}
