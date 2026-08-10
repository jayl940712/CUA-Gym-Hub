import React, { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react'
import {
  getSessionId, fetchCustomState, initializeData, saveState,
  initialKey, storageKey, createInitialData, publishInitialState,
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
    const sid = getSessionId()

    // ⚠️ Order is load-bearing. initializeData() writes defaults into
    // localStorage, which would make this check always true and mean injected
    // task state never loads. Read the key BEFORE calling it.
    const isRefresh = localStorage.getItem(initialKey(sid)) !== null

    if (isRefresh) {
      commit(initializeData(sid))
      setLoading(false)
    } else {
      fetchCustomState(sid).then(custom => {
        const data = initializeData(sid, custom)
        commit(data)
        setLoading(false)
        // Cold session with no injected state: hand the server a pristine
        // baseline now, so the first mutation shows up in /go's state_diff.
        if (!custom) publishInitialState(data, sid)
      })
    }
  }, [])

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
    const prev = stateRef.current
    if (!prev) return
    const next = withReservedIds(typeof updater === 'function' ? updater(prev) : updater)
    const nextCore = dematerialize(coreRef.current, prev, next)
    commit(nextCore)
    saveState(nextCore, getSessionId())
  }, [commit, withReservedIds])

  const resetState = useCallback(() => {
    const sid = getSessionId()
    reservedIds.current = {}
    const stored = localStorage.getItem(initialKey(sid))
    if (stored) {
      try {
        // The baseline key holds a CORE (or, for an injected task state, a core
        // carrying full base arrays). Either way it goes back through toCore()
        // so a fixture that omitted overlay keys still restores cleanly.
        const initial = toCore(JSON.parse(stored))
        localStorage.setItem(storageKey(sid), JSON.stringify(initial))
        commit(initial)
        saveState(initial, sid)
        return
      } catch (e) { /* fall through */ }
    }
    const fresh = createInitialData()
    commit(fresh)
    saveState(fresh, sid)
  }, [commit])

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
