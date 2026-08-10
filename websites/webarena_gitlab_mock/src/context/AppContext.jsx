import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getSessionId, fetchServerState, initializeData, saveState, flushState,
  readStoredState, readStoredInitial, writeStoredInitial, mergeOverDefaults,
  restoreServerState, sameState, createInitialData,
  CURRENT_USER_ID, SEED_NEXT_IDS, ID_KIND_COLLECTION,
} from '../utils/dataManager.js'
import { materialize, dematerialize, toCore } from '../utils/overlay.js'
import { subscribe as subscribeChunks } from '../data/lazy.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  // -------------------------------------------------------------------------
  // TWO objects, one materialization point (src/utils/overlay.js).
  //
  //   core   the PERSISTED state — small, overlay-shaped, and the only thing
  //          that reaches localStorage, `POST set_current` and `/go`.
  //   state  `materialize(core)` — the same object with the twelve frozen
  //          collections merged in. This is what every component reads and what
  //          every reducer is handed; it is NEVER persisted.
  //
  // `commit()` is the only writer of either, so they can never disagree.
  // -------------------------------------------------------------------------
  const [core, setCoreInternal] = useState(null)
  const [state, setStateInternal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)

  const coreRef = useRef(null)
  const activeSidRef = useRef(null)
  const location = useLocation()
  const sid = useMemo(() => getSessionId(), [location.search])

  // -------------------------------------------------------------------------
  // stateRef mirrors `state` SYNCHRONOUSLY.
  //
  // Everything that has to read the live state from inside an event handler
  // (allocateId, back-to-back setState calls) reads this, not the `state`
  // closure. Reading it through a `setState(prev => …)` updater instead was the
  // root cause of BUG-B03: React 18 runs the updater after the handler returns,
  // so a value assigned inside it is not available to the caller. (It appeared
  // to work intermittently because React's eager-state optimisation runs the
  // updater inline when the fiber has no pending update — which is exactly the
  // first call in a handler and not the rest.)
  // -------------------------------------------------------------------------
  const stateRef = useRef(null)

  // kind -> next free counter value, reserved by allocateId and flushed into
  // `nextIds` by the caller's own setState. See allocateId below.
  const reservedIds = useRef({})

  /**
   * Adopt `nextCore` as the session's state. Materializes ONCE, so `state` and
   * `stateRef` are always exactly `materialize(core)` and no component can see
   * a core that has not been merged.
   */
  const commit = useCallback((nextCore) => {
    const mat = materialize(nextCore)
    coreRef.current = nextCore
    stateRef.current = mat
    setCoreInternal(nextCore)
    setStateInternal(mat)
    return mat
  }, [])

  useEffect(() => {
    let cancelled = false
    activeSidRef.current = null
    coreRef.current = null
    stateRef.current = null
    setCoreInternal(null)
    setStateInternal(null)
    setLoading(true)

    ;(async () => {
      try {
        await flushState()
      } catch (error) {
        console.error('Unable to flush previous GitLab state:', error)
      }
      const server = await fetchServerState(sid)
      if (cancelled) return

      // Read browser state only after the server response, but before
      // initializeData() writes anything. Server files are authoritative when
      // present; localStorage is only a recovery source when those files are
      // genuinely absent.
      const localCurrent = readStoredState(sid)
      const localInitial = readStoredInitial(sid)
      let data
      let baseline
      let shouldRestore = false

      if (server.available && server.current !== null) {
        data = mergeOverDefaults(server.current)
        if (server.initial !== null) {
          baseline = mergeOverDefaults(server.initial)
        } else if (localCurrent !== null && localInitial !== null
                   && sameState(localCurrent, server.current)) {
          baseline = mergeOverDefaults(localInitial)
          shouldRestore = true
        } else {
          // Preserve set_current-on-a-never-seeded-sid semantics: /go uses the
          // pristine default baseline, so the browser reset baseline does too.
          baseline = createInitialData()
        }
      } else if (server.available && server.initial !== null) {
        // A partially lost session can safely rebuild current from its server
        // baseline through the guarded restore action.
        data = mergeOverDefaults(server.initial)
        baseline = data
        shouldRestore = true
      } else if (server.available) {
        data = mergeOverDefaults(localCurrent || localInitial || createInitialData())
        baseline = mergeOverDefaults(localInitial || data)
        shouldRestore = true
      } else {
        // A failed/incompatible /state read is not proof that files vanished.
        // Render the browser cache (or defaults) without publishing over a
        // possibly newer server injection.
        data = mergeOverDefaults(localCurrent || createInitialData())
        baseline = mergeOverDefaults(localInitial || data)
      }

      initializeData(sid, data)
      writeStoredInitial(sid, baseline)

      if (shouldRestore) {
        const result = await restoreServerState(baseline, data, sid)
        if (cancelled) return
        if (!result.restored) {
          // A harness injection landed after our /state read. Fetch once more
          // and adopt it rather than seating stale browser data.
          const latest = await fetchServerState(sid)
          if (cancelled) return
          if (!latest.available) {
            throw new Error('Unable to re-read authoritative GitLab state')
          }
          if (latest.current !== null) {
            data = mergeOverDefaults(latest.current)
            baseline = latest.initial !== null
              ? mergeOverDefaults(latest.initial)
              : createInitialData()
            initializeData(sid, data)
            writeStoredInitial(sid, baseline)
          } else if (latest.initial !== null) {
            data = mergeOverDefaults(latest.initial)
            baseline = data
            const retry = await restoreServerState(baseline, data, sid)
            if (!retry.restored) throw new Error('GitLab initial-only recovery lost a setup race')
            initializeData(sid, data)
            writeStoredInitial(sid, baseline)
          } else {
            throw new Error('GitLab restore conflict returned no authoritative state')
          }
        }
      }

      if (cancelled) return
      activeSidRef.current = server.available ? (sid || '_default') : null
      commit(data)
      setLoading(false)
    })().catch(error => {
      if (cancelled) return
      console.error('Unable to hydrate GitLab session:', error)
      const data = initializeData(sid)
      activeSidRef.current = null
      commit(data)
      setLoading(false)
    })

    return () => {
      cancelled = true
      flushState().catch(error => console.error('Unable to flush GitLab state:', error))
    }
  }, [sid, commit])

  // -------------------------------------------------------------------------
  // A per-project chunk arriving GROWS the frozen base (`state.notes`), so the
  // materialized state has to be rebuilt. Re-committing the SAME core is the
  // whole fix: it goes through the one materialization point like every other
  // write, so there is still no way for two views to see different merges.
  //
  // This must not persist. The core did not change — only the base data behind
  // it — so calling saveState() here would POST an identical state on every
  // navigation and put spurious no-op writes into /go's history.
  // -------------------------------------------------------------------------
  useEffect(() => subscribeChunks(() => {
    if (coreRef.current) commit(coreRef.current)
  }), [commit])

  /**
   * Fold any ids allocateId handed out into the state about to be committed, so
   * the counter bump and the record that consumed it are ONE write.
   */
  const withReservedIds = useCallback((next) => {
    const reserved = reservedIds.current
    const kinds = Object.keys(reserved)
    if (kinds.length === 0) return next
    reservedIds.current = {}
    const nextIds = { ...(next.nextIds || {}) }
    for (const kind of kinds) {
      const cur = typeof nextIds[kind] === 'number' && Number.isFinite(nextIds[kind])
        ? nextIds[kind]
        : (SEED_NEXT_IDS[kind] || 1)
      if (reserved[kind] > cur) nextIds[kind] = reserved[kind]
    }
    return { ...next, nextIds }
  }, [])

  /**
   * Every mutation goes through here -> localStorage + POST set_current.
   *
   * The updater is handed the MATERIALIZED state and returns a materialized
   * state, exactly as before the overlay refactor — all 79 write sites were
   * left untouched. `dematerialize()` then derives the delta against the frozen
   * corpus, and only that delta is persisted. An untouched collection comes
   * back reference-identical from an immutable reducer and is skipped in O(1);
   * see the header of src/utils/overlay.js for why this is a reconciler rather
   * than a set of overlay verbs.
   */
  const setState = useCallback((updater) => {
    if (activeSidRef.current !== (sid || '_default')) return
    const prev = stateRef.current
    if (!prev) return
    const next = withReservedIds(typeof updater === 'function' ? updater(prev) : updater)
    const nextCore = dematerialize(coreRef.current, prev, next)
    commit(nextCore)
    saveState(nextCore, sid)
  }, [commit, sid, withReservedIds])

  const resetState = useCallback(() => {
    if (activeSidRef.current !== (sid || '_default')) return
    reservedIds.current = {}
    const stored = readStoredInitial(sid)
    if (stored) {
      // The baseline key holds a CORE (or, for an injected task state, a core
      // carrying full base arrays). Either way it goes back through toCore()
      // so a fixture that omitted overlay keys still restores cleanly.
      const initial = toCore(stored)
      commit(initial)
      saveState(initial, sid)
      return
    }
    const fresh = createInitialData()
    commit(fresh)
    saveState(fresh, sid)
  }, [commit, sid])

  // -------------------------------------------------------------------------
  // Id allocation. Created records must not collide with real container ids.
  //
  // The counter starts at max(seed id)+1 (SEED_NEXT_IDS in dataManager.js), so
  // a collision should be impossible. The scan below is the backstop: if a task
  // injects records at or above the counter, allocateId skips past them rather
  // than minting a duplicate. A duplicate id is invisible — stateTracker's
  // indexBy() keys by id, so the second record silently replaces the first and
  // /go reports a creation as an edit to seed data.
  //
  // allocateId RESERVES, it does not write. It returns the id synchronously,
  // reading stateRef, and parks the counter bump in reservedIds; the caller's
  // own setState folds that bump into the same object as the new record. So:
  //
  //   * the caller always gets a real id (BUG-B03: it used to get null, because
  //     a setState updater does not run before the calling function returns —
  //     every invited member was stored with `id: null` and React logged
  //     duplicate keys, while `nextIds.member` incremented normally);
  //   * one logical mutation still produces exactly ONE persisted write
  //     (PIPELINE-004), so /go can never observe a half-applied state.
  //
  // Reserving twice before a write yields distinct ids, because the reservation
  // itself advances the counter. A reservation the caller then abandons (form
  // cancelled) is flushed by the next write: the counter skips an id, which is
  // harmless — the alternative is handing the same id out twice.
  // -------------------------------------------------------------------------
  const allocateId = useCallback((kind) => {
    const prev = stateRef.current
    if (!prev) return null
    const collection = prev[ID_KIND_COLLECTION[kind]]
    const taken = Array.isArray(collection)
      ? new Set(collection.map(r => r && r.id))
      : new Set()
    let cur = reservedIds.current[kind]
    if (typeof cur !== 'number' || !Number.isFinite(cur)) cur = prev.nextIds ? prev.nextIds[kind] : undefined
    if (typeof cur !== 'number' || !Number.isFinite(cur)) cur = SEED_NEXT_IDS[kind] || 1
    while (taken.has(cur)) cur += 1
    reservedIds.current[kind] = cur + 1
    return cur
  }, [])

  // -------------------------------------------------------------------------
  // Generic collection helpers — the write surface the feature shards use.
  // -------------------------------------------------------------------------
  const appendTo = useCallback((collection, record) => {
    setState(prev => ({ ...prev, [collection]: [...prev[collection], record] }))
  }, [setState])

  const updateIn = useCallback((collection, predicate, patch) => {
    setState(prev => ({
      ...prev,
      [collection]: prev[collection].map(r => (predicate(r)
        ? { ...r, ...(typeof patch === 'function' ? patch(r) : patch) }
        : r)),
    }))
  }, [setState])

  const removeFrom = useCallback((collection, predicate) => {
    setState(prev => ({ ...prev, [collection]: prev[collection].filter(r => !predicate(r)) }))
  }, [setState])

  /** Write a file body into state.repo.fileOverlay (see dataManager accessors). */
  const setFileOverlay = useCallback((fullPath, ref, path, body) => {
    setState(prev => ({
      ...prev,
      repo: {
        ...prev.repo,
        fileOverlay: { ...prev.repo.fileOverlay, [`${fullPath}:${ref}:${path}`]: body },
      },
    }))
  }, [setState])

  const pushRepoOverlay = useCallback((bucket, key, entries) => {
    setState(prev => ({
      ...prev,
      repo: {
        ...prev.repo,
        [bucket]: { ...prev.repo[bucket], [key]: [...(prev.repo[bucket][key] || []), ...entries] },
      },
    }))
  }, [setState])

  const prependRepoOverlay = useCallback((bucket, key, entries) => {
    setState(prev => ({
      ...prev,
      repo: {
        ...prev.repo,
        [bucket]: { ...prev.repo[bucket], [key]: [...entries, ...(prev.repo[bucket][key] || [])] },
      },
    }))
  }, [setState])

  const setUi = useCallback((patch) => {
    setState(prev => ({ ...prev, ui: { ...prev.ui, ...(typeof patch === 'function' ? patch(prev.ui) : patch) } }))
  }, [setState])

  // -------------------------------------------------------------------------
  // Read-side lookups every view needs.
  // -------------------------------------------------------------------------
  const indexes = useMemo(() => {
    if (!state) return null
    const usersById = new Map(state.users.map(u => [u.id, u]))
    const usersByUsername = new Map(state.users.map(u => [u.username, u]))
    const projectsById = new Map(state.projects.map(p => [p.id, p]))
    const projectsByPath = new Map(state.projects.map(p => [p.full_path, p]))
    const groupsByPath = new Map(state.groups.map(g => [g.path, g]))
    const labelsById = new Map(state.labels.map(l => [l.id, l]))
    const milestonesById = new Map(state.milestones.map(m => [m.id, m]))
    // Case-INSENSITIVE mirrors. GitLab resolves namespace/project paths and
    // usernames without regard to case (see src/utils/canonicalPath.js); these
    // are keyed lowercase and hold the record with its REAL casing, so a lookup
    // never has to lowercase anything in src/data.
    const projectsByPathLower = new Map(state.projects.map(p => [String(p.full_path).toLowerCase(), p]))
    const groupsByPathLower = new Map(state.groups.map(g => [String(g.path).toLowerCase(), g]))
    const usersByUsernameLower = new Map(state.users.map(u => [String(u.username).toLowerCase(), u]))
    return {
      usersById, usersByUsername, projectsById, projectsByPath, groupsByPath,
      labelsById, milestonesById,
      projectsByPathLower, groupsByPathLower, usersByUsernameLower,
    }
  }, [state])

  const value = useMemo(() => ({
    // `state` is materialized (frozen corpus merged in) — read it everywhere.
    // `coreState` is the persisted delta; only /go-style inspection wants it.
    state,
    coreState: core,
    loading,
    setState,
    resetState,
    allocateId,
    appendTo,
    updateIn,
    removeFrom,
    setFileOverlay,
    pushRepoOverlay,
    prependRepoOverlay,
    setUi,
    sidebarCollapsed,
    setSidebarCollapsed,
    indexes,
    currentUser: state ? state.currentUser : null,
    currentUserId: CURRENT_USER_ID,
  }), [state, core, loading, setState, resetState, allocateId, appendTo, updateIn, removeFrom,
    setFileOverlay, pushRepoOverlay, prependRepoOverlay, setUi, sidebarCollapsed, indexes])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}

export default AppContext
