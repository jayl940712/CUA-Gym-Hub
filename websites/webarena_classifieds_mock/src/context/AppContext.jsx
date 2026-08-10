import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getSessionId, fetchServerState, initializeData, saveState,
  flushState, restoreServerState, acknowledgeHandledWrites,
  subscribeRevisionConflicts,
  readStoredState, readStoredInitial, writeStoredInitial,
  mergeOverDefaults, sameState, createInitialData,
} from '../utils/dataManager.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, setStateRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sid, setSid] = useState(null)
  const [recoveryNonce, setRecoveryNonce] = useState(0)
  const sidRef = useRef(null)
  const activeSidRef = useRef(null)
  const location = useLocation()
  const routeSid = new URLSearchParams(location.search).get('sid')
  const renderedRouteSidRef = useRef(routeSid)
  if (renderedRouteSidRef.current !== routeSid) {
    renderedRouteSidRef.current = routeSid
    activeSidRef.current = null
  }

  useEffect(() => subscribeRevisionConflicts(conflictSid => {
    if ((conflictSid || null) !== sidRef.current) return
    activeSidRef.current = null
    setLoading(true)
    setRecoveryNonce(value => value + 1)
  }), [])

  useEffect(() => {
    let cancelled = false
    const s = getSessionId()
    sidRef.current = s
    activeSidRef.current = null
    setSid(s)
    setLoading(true)

    ;(async () => {
      // Do not let a write from the previous SID remain in flight while this
      // provider starts publishing the next SID's state.
      try {
        await flushState()
      } catch (error) {
        console.error('Previous state write failed:', error)
      }
      if (cancelled) return

      // Read browser storage before initializeData(), which creates defaults.
      const localCurrent = readStoredState(s)
      const localInitial = readStoredInitial(s)
      const server = await fetchServerState(s)
      if (cancelled) return
      if (server.available) acknowledgeHandledWrites(s)

      let data
      let baseline
      let shouldRestore = false

      if (server.available && server.current !== null) {
        data = mergeOverDefaults(server.current)
        if (server.initial !== null) {
          baseline = mergeOverDefaults(server.initial)
        } else if (
          localCurrent !== null
          && localInitial !== null
          && sameState(localCurrent, server.current)
        ) {
          baseline = mergeOverDefaults(localInitial)
          shouldRestore = true
        } else {
          baseline = createInitialData()
        }
      } else if (server.available && server.initial !== null) {
        data = mergeOverDefaults(server.initial)
        baseline = data
        shouldRestore = true
      } else if (server.available) {
        data = mergeOverDefaults(localCurrent || localInitial || createInitialData())
        baseline = mergeOverDefaults(localInitial || data)
        shouldRestore = true
      } else {
        data = mergeOverDefaults(localCurrent || createInitialData())
        baseline = mergeOverDefaults(localInitial || data)
      }

      if (cancelled) return
      initializeData(s, data)
      writeStoredInitial(s, baseline)

      if (shouldRestore) {
        let result
        let recoveredConflict = false
        try {
          result = await restoreServerState(baseline, data, s)
        } catch (error) {
          // A 409 means task setup won the race. Re-read until that authoritative
          // state is visible rather than seating stale browser data.
          if (!error.revisionConflict) throw error
          result = { restored: false }
          recoveredConflict = true
        }
        if (!result.restored) {
          let latest = null
          for (let attempt = 0; attempt < 3; attempt += 1) {
            latest = await fetchServerState(s)
            if (cancelled) return
            if (latest.available && (latest.current !== null || latest.initial !== null)) break
            await new Promise(resolve => setTimeout(resolve, 50))
          }
          if (!latest || !latest.available) {
            throw new Error('Unable to re-read authoritative Classifieds state')
          }
          if (latest.current !== null) {
            data = mergeOverDefaults(latest.current)
            baseline = latest.initial !== null
              ? mergeOverDefaults(latest.initial)
              : createInitialData()
          } else if (latest.initial !== null) {
            data = mergeOverDefaults(latest.initial)
            baseline = data
            const retry = await restoreServerState(baseline, data, s)
            if (!retry.restored) {
              throw new Error('Classifieds initial-only recovery lost a setup race')
            }
          } else {
            throw new Error('Classifieds restore conflict returned no authoritative state')
          }
          initializeData(s, data)
          writeStoredInitial(s, baseline)
          if (recoveredConflict) acknowledgeHandledWrites(s)
        }
      }

      if (!cancelled) {
        activeSidRef.current = server.available ? (s || '_default') : null
        setStateRaw(data)
        setLoading(false)
      }
    })().catch(error => {
      if (cancelled) return
      console.error('Unable to initialize classifieds state:', error)
      activeSidRef.current = null
      const fallback = initializeData(s, readStoredState(s) || createInitialData())
      setStateRaw(fallback)
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [routeSid, recoveryNonce])

  const setState = useCallback((updater) => {
    setStateRaw(prev => {
      if (activeSidRef.current !== (sidRef.current || '_default')) return prev
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveState(next, sidRef.current)
      return next
    })
  }, [])

  const resetState = useCallback(() => {
    setState(readStoredInitial(sidRef.current) || createInitialData())
  }, [setState])

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
