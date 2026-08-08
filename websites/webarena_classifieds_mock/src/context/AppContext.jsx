import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import {
  getSessionId, fetchCustomState, initializeData, saveState, initialKey, storageKey
} from '../utils/dataManager.js'

/**
 * Register the state we booted with on the server, so `/go`'s baseline exists
 * before the first mutation. Without this the server writes its initial file
 * from the FIRST set_current, which would absorb that mutation into the
 * baseline and leave `state_diff` empty.
 */
function registerBaseline(state, sid) {
  const sidParam = sid ? `?sid=${encodeURIComponent(sid)}` : ''
  fetch(`/post${sidParam}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'set_current', state })
  }).catch(() => {})
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, setStateRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sid, setSid] = useState(null)

  useEffect(() => {
    const s = getSessionId()
    setSid(s)
    const initK = initialKey(s)

    // ⚠️ Check localStorage BEFORE calling initializeData(): initializeData()
    // writes defaults, which would make isRefresh always true and injected
    // task state would never load.
    const isRefresh = localStorage.getItem(initK) !== null

    if (isRefresh) {
      // registerBaseline() has to run on THIS branch too. The server files can
      // be absent while localStorage is warm (redeploy, a `reset` on a session
      // that never had a baseline, a cleared .mock-states dir). Without it the
      // first mutation's `set_current` is what creates `<sid>.initial.json`, so
      // the mutation becomes the baseline and `/go` reports an empty
      // `state_diff` (AUDIT PIPELINE-002). It is idempotent: `set_current` only
      // writes the initial file when it is missing.
      const data = initializeData(s)
      setStateRaw(data)
      setLoading(false)
      registerBaseline(data, s)
    } else {
      fetchCustomState(s).then(custom => {
        const data = initializeData(s, custom)
        setStateRaw(data)
        setLoading(false)
        registerBaseline(data, s)
      })
    }
  }, [])

  const setState = useCallback((updater) => {
    setStateRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveState(next, getSessionId())
      return next
    })
  }, [])

  const resetState = useCallback(() => {
    const s = getSessionId()
    const stored = localStorage.getItem(initialKey(s))
    if (stored) {
      try {
        const initial = JSON.parse(stored)
        localStorage.setItem(storageKey(s), JSON.stringify(initial))
        setStateRaw(initial)
      } catch (e) {}
    }
  }, [])

  if (loading) {
    return null
  }

  return (
    <AppContext.Provider value={{ state, setState, resetState, sid, user: state.user }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
