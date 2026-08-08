import React, { useEffect, useState } from 'react'
import { getSessionId, initialKey, storageKey } from '../utils/dataManager.js'
import { computeStateDiff } from '../utils/stateTracker.js'

/**
 * `/go?sid=` — the hub's state-inspection endpoint.
 *
 * The dev/preview server answers this first (see vite.config.js), reading the
 * authoritative `.mock-states/<sid>.json` + `<sid>.initial.json`. This route
 * only runs when the SPA is served without that middleware (e.g. a static
 * host); it then reconstructs the same payload from localStorage so `/go`
 * never dead-ends.
 */
export default function GoPage() {
  const [payload, setPayload] = useState(null)

  useEffect(() => {
    const sid = getSessionId()
    fetch(sid ? `/go?sid=${encodeURIComponent(sid)}` : '/go', {
      cache: 'no-store', headers: { Accept: 'application/json' },
    })
      .then(r => (r.ok ? r.json() : Promise.reject(new Error('no middleware'))))
      .then(setPayload)
      .catch(() => {
        let initial = null
        let current = null
        try { initial = JSON.parse(localStorage.getItem(initialKey(sid)) || 'null') } catch (e) { /* ignore */ }
        try { current = JSON.parse(localStorage.getItem(storageKey(sid)) || 'null') } catch (e) { /* ignore */ }
        setPayload({
          initial_state: initial,
          current_state: current || initial,
          state_diff: computeStateDiff(initial, current || initial),
        })
      })
  }, [])

  if (!payload) return null
  return (
    <pre style={{ whiteSpace: 'pre-wrap', wordWrap: 'break-word', padding: 16 }}>
      {JSON.stringify(payload, null, 2)}
    </pre>
  )
}
