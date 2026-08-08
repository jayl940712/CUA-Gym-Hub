import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { computeStateDiff } from '../utils/stateTracker.js'
import { initialKey } from '../utils/dataManager.js'

export default function GoPage() {
  const { state } = useApp()

  const sid = new URLSearchParams(window.location.search).get('sid')

  let initialState = null
  try {
    const stored = localStorage.getItem(initialKey(sid))
    if (stored) initialState = JSON.parse(stored)
  } catch (e) {}

  const initial = initialState || state
  const output = {
    initial_state: initial,
    current_state: state,
    state_diff: computeStateDiff(initial, state)
  }

  return (
    <pre style={{
      margin: 0, padding: 16, fontFamily: 'monospace', fontSize: 12,
      background: '#fff', color: '#222', minHeight: '100vh', overflowX: 'auto'
    }}>
      {JSON.stringify(output, null, 2)}
    </pre>
  )
}
