import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { computeStateDiff } from '../utils/stateTracker.js'
import { initialKey } from '../utils/dataManager.js'

export default function GoPage() {
  // The PERSISTED state, not the materialized one: `/go` must report the same
  // object the server holds in `.mock-states/<sid>.json`, and materializing the
  // 8,012-submission / 24,149-comment corpus back into this response would
  // restore the 40 MB payload the overlay refactor removed.
  const { coreState: state } = useApp()

  const sid = (() => {
    const p = new URLSearchParams(window.location.search)
    return p.get('sid')
  })()

  let initialState = null
  try {
    const stored = localStorage.getItem(initialKey(sid))
    if (stored) initialState = JSON.parse(stored)
  } catch (e) { /* corrupt baseline */ }

  const initial = initialState || state
  const output = {
    initial_state: initial,
    current_state: state,
    state_diff: computeStateDiff(initial, state)
  }

  return (
    <pre style={{
      margin: 0, padding: 16, fontFamily: 'monospace', fontSize: 12,
      background: '#fff', color: '#000', minHeight: '100vh', overflowX: 'auto'
    }}>
      {JSON.stringify(output, null, 2)}
    </pre>
  )
}
