import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { readStoredInitial } from '../utils/dataManager.js'

/**
 * Client-side view of `{initial_state, current_state, state_diff}` — the §5
 * counterpart to the `/go` middleware in vite.config.js. The middleware answers
 * a cold `GET /go?sid=` from the state file; this answers an in-app navigation
 * to `/go?sid=` from the browser's own view of state, so the two can be
 * compared. Mirrors websites/mixpanel_mock/src/pages/GoPage.jsx.
 */

/** Same shape as calculateStateDiff() in vite.config.js. */
function computeStateDiff(initial, current) {
  const diff = {}
  for (const key in current) {
    if (!initial || JSON.stringify(current[key]) !== JSON.stringify(initial[key])) {
      diff[key] = { old: initial ? initial[key] : undefined, new: current[key] }
    }
  }
  return diff
}

export default function GoPage() {
  const { state } = useApp()

  const sid = new URLSearchParams(window.location.search).get('sid')
  const initial = readStoredInitial(sid) || state
  const current = state

  const output = {
    initial_state: initial,
    current_state: current,
    state_diff: computeStateDiff(initial, current),
  }

  return (
    <pre style={{
      margin: 0,
      padding: 16,
      fontFamily: 'monospace',
      fontSize: 12,
      background: '#fff',
      color: '#303030',
      minHeight: '100vh',
      overflowX: 'auto',
    }}>
      {JSON.stringify(output, null, 2)}
    </pre>
  )
}
