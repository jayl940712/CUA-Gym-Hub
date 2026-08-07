import React, { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../layout/Layout.jsx'
import { useSidNavigate } from '../SLink.jsx'
import { useApp } from '../../context/AppContext.jsx'
import './user.css'

// ROUTES #81 — `/night_mode.{_format}`, UserController::changeNightMode.
//
// On the source this is a form target: it reads the POST field `nightMode`,
// writes it to the user, then redirects to the Referer (or `/`). A bare GET
// with no field is a 400. The mock cannot 400 usefully and must not leave a
// registered route as a dead end, so:
//
//   /night_mode?nightMode=dark   -> applies it and returns to the referring
//                                   page (or `/`), exactly like the source
//   /night_mode                  -> renders the one-field form that would post
//                                   there, so the route does something coherent
//
// Valid values are `light` | `dark` | `auto`, matching the Appearance select on
// /user/<name>/preferences. `auto` follows prefers-color-scheme; the dark
// palette (DESIGN.md §2) is applied by AppContext writing `data-night-mode` on
// <html>, plus the media query in components/user/user.css.
//
// The user-menu toggle in SiteNav already calls setNightMode(); this is the
// standalone route for the same mutation.

const MODES = ['light', 'dark', 'auto']

const OPTIONS = [
  ['auto', 'System preference'],
  ['light', 'Light'],
  ['dark', 'Dark']
]

export default function NightModeRoute() {
  const [searchParams] = useSearchParams()
  const { state, setNightMode } = useApp()
  const navigate = useSidNavigate()
  const applied = useRef(false)

  const requested = searchParams.get('nightMode')
  const valid = MODES.includes(requested) ? requested : null

  const [mode, setMode] = useState(state.currentUser.nightMode || 'light')

  useEffect(() => {
    if (!valid || applied.current) return
    applied.current = true
    setNightMode(valid)
    // Postmill redirects to the Referer, falling back to the front page.
    const referrer = typeof document !== 'undefined' ? document.referrer : ''
    let back = '/'
    try {
      if (referrer && new URL(referrer).origin === window.location.origin) {
        back = new URL(referrer).pathname + new URL(referrer).search
      }
    } catch (e) { /* opaque referrer */ }
    navigate(back, { replace: true })
  }, [valid, setNightMode, navigate])

  if (valid) return null

  const onSubmit = (e) => {
    e.preventDefault()
    setNightMode(mode)
    navigate('/')
  }

  return (
    <Layout title="Night mode">
      <h1 className="page-heading">Night mode</h1>

      <form name="night_mode" method="post" action="/night_mode" className="form flow" onSubmit={onSubmit}>
        <div className="flow-slim">
          <div className="form-flex form-flex--single-line">
            <label className="form-flex__align text-align-right" htmlFor="night_mode_nightMode">
              Night mode
            </label>
            <span className="unstylable-widget">
              <select
                id="night_mode_nightMode" name="nightMode" className="form-control"
                value={mode} onChange={e => setMode(e.target.value)}
              >
                {OPTIONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <span className="unstylable-widget__caret" aria-hidden="true"></span>
            </span>
          </div>
        </div>

        <div className="form__row form__button-row">
          <button className="button" type="submit">Save changes</button>
        </div>
      </form>
    </Layout>
  )
}
