import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getSessionId, fetchServerState, initializeData, saveState, flushState, restoreServerState,
  readStoredState, readStoredInitial, writeStoredInitial, mergeOverDefaults,
  sameState, createInitialData, initialKey, storageKey, assertTrackerCoverage,
} from '../utils/dataManager.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, setStateRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  // Flash messages are deliberately NOT part of the persisted state: they are
  // one-page-load UI chrome and would otherwise pollute /go's state_diff.
  const [messages, setMessages] = useState([])
  const location = useLocation()
  const routeSid = new URLSearchParams(location.search).get('sid')
  const activeSidRef = useRef(null)
  const renderedRouteSidRef = useRef(routeSid)
  if (renderedRouteSidRef.current !== routeSid) {
    renderedRouteSidRef.current = routeSid
    activeSidRef.current = null
  }

  /* ------------------------------------------------------------------ *
   * Boot.
   *
   * The server owns the RL reward signal (`/go`), so boot always asks it what
   * it holds before deciding anything, and always leaves it holding a complete,
   * consistent record of the session. Three cases, in priority order:
   *
   *   (a) ADOPT — the server holds a current state this browser did not write.
   *       That means a task inject (`{"action":"set"}`), a `{"action":"reset"}`,
   *       or another browser profile driving the same sid. The server wins:
   *       a freshly injected state must beat stale localStorage, and a reset
   *       must actually reach the UI. (PIPELINE-009)
   *
   *   (b) REPUBLISH — this browser has a baseline for the sid and the server
   *       agrees with it (or has nothing at all). Render from localStorage, and
   *       push BOTH the baseline and the current state back so a server that
   *       has lost its files — `.mock-states/` is gitignored, hence absent on
   *       every fresh deploy — is repaired instead of silently reporting the
   *       DEFAULT tree with an empty diff.
   *
   *   (c) COLD BOOT — neither side has anything. Seed from createInitialData()
   *       and publish that seed as the baseline BEFORE the user can mutate
   *       anything. This is what makes the very first mutation of an
   *       un-injected session visible in state_diff (PIPELINE-001): the
   *       baseline no longer waits for the first `set_current` to define it.
   *
   * Why (b) cannot erase a real diff: `set_initial` is refused by the plugin
   * whenever the stored current state exists and differs from the stored
   * baseline. So on a plain reload of an already-driven sid the republish is a
   * no-op and `state_diff` survives. It only lands when the baseline file is
   * missing, which is exactly the case being repaired.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    let cancelled = false
    const sid = getSessionId()
    activeSidRef.current = null
    setLoading(true)

    // Every path in stateTracker's Observable State Changes table must be
    // declared in createInitialData(), or its first write lands in state_diff
    // with no `old` member. Warn-only; never blocks the boot.
    assertTrackerCoverage()

    ;(async () => {
      try {
        await flushState()
      } catch (error) {
        console.error('[state persistence] Previous Shopping Admin write failed', error)
      }
      if (cancelled) return

      const server = await fetchServerState(sid)
      if (cancelled) return
      // ⚠️ Read localStorage BEFORE any initializeData() call. initializeData()
      // writes defaults, which would make every boot look like a refresh and
      // injected task state would never load.
      const localCurrent = readStoredState(sid)
      const localInitial = readStoredInitial(sid)

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
      initializeData(sid, data)
      writeStoredInitial(sid, baseline)

      if (shouldRestore) {
        const result = await restoreServerState(baseline, data, sid)
        if (cancelled) return
        if (!result.restored) {
          const latest = await fetchServerState(sid)
          if (cancelled) return
          if (!latest.available) {
            throw new Error('Unable to re-read authoritative Shopping Admin state')
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
            if (!retry.restored) throw new Error('Shopping Admin initial-only recovery lost a setup race')
            initializeData(sid, data)
            writeStoredInitial(sid, baseline)
          } else {
            throw new Error('Shopping Admin restore conflict returned no authoritative state')
          }
        }
      }

      if (cancelled) return
      activeSidRef.current = server.available ? (sid || '_default') : null
      setStateRaw(data)
      setLoading(false)
    })().catch(error => {
      if (cancelled) return
      console.error('[state persistence] Unable to initialize Shopping Admin state', error)
      activeSidRef.current = null
      setStateRaw(initializeData(sid))
      setLoading(false)
    })

    return () => {
      cancelled = true
      flushState().catch(error => console.error('[state persistence] Unable to flush Shopping Admin state', error))
    }
  }, [routeSid])

  const setState = useCallback((updater) => {
    setStateRaw(prev => {
      const sid = getSessionId()
      if (activeSidRef.current !== (sid || '_default')) return prev
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveState(next, sid)
      return next
    })
  }, [])

  /* ------------------------------------------------------------ messages */

  // Magento sets a message, redirects, shows it on the next page, and drops it
  // on the load after that. Mirror the same one-navigation lifetime.
  useEffect(() => {
    setMessages(prev => prev.filter(m => !m.shown).map(m => ({ ...m, shown: true })))
  }, [location.pathname])

  const addMessage = useCallback((text, type = 'success') => {
    setMessages(prev => [...prev, { id: `${Date.now()}_${prev.length}`, text, type, shown: false }])
  }, [])
  const dismissMessage = useCallback((id) => {
    setMessages(prev => prev.filter(m => m.id !== id))
  }, [])
  const clearMessages = useCallback(() => setMessages([]), [])

  /* ---------------------------------------------- entity mutation helpers
   * Every mutation goes through setState so it reaches saveState() ->
   * /post?action=set_current -> /go state_diff. Feature pages should call
   * these rather than reaching into `state` directly.
   */

  const patchOrder = useCallback((orderId, patch) => {
    setState(prev => ({
      ...prev,
      orderOverrides: {
        ...prev.orderOverrides,
        [String(orderId)]: { ...(prev.orderOverrides[String(orderId)] || {}), ...patch },
      },
    }))
  }, [setState])

  const patchOrderAddress = useCallback((addressId, patch) => {
    setState(prev => ({
      ...prev,
      orderAddressOverrides: {
        ...prev.orderAddressOverrides,
        [String(addressId)]: { ...(prev.orderAddressOverrides[String(addressId)] || {}), ...patch },
      },
    }))
  }, [setState])

  const patchProduct = useCallback((productId, patch) => {
    setState(prev => ({
      ...prev,
      productOverrides: {
        ...prev.productOverrides,
        [String(productId)]: { ...(prev.productOverrides[String(productId)] || {}), ...patch },
      },
    }))
  }, [setState])

  const setProductDescription = useCallback((productId, html) => {
    setState(prev => ({
      ...prev,
      productDescriptionOverrides: { ...prev.productDescriptionOverrides, [String(productId)]: html },
    }))
  }, [setState])

  const addProduct = useCallback((product) => {
    setState(prev => ({ ...prev, newProducts: [...prev.newProducts, product] }))
  }, [setState])

  const deleteProducts = useCallback((ids) => {
    setState(prev => ({
      ...prev,
      deletedProductIds: [...new Set([...prev.deletedProductIds, ...ids.map(Number)])],
    }))
  }, [setState])

  const patchCategory = useCallback((categoryId, patch) => {
    setState(prev => ({
      ...prev,
      categoryOverrides: {
        ...prev.categoryOverrides,
        [String(categoryId)]: { ...(prev.categoryOverrides[String(categoryId)] || {}), ...patch },
      },
    }))
  }, [setState])

  const addCategory = useCallback((category) => {
    setState(prev => ({ ...prev, newCategories: [...(prev.newCategories || []), category] }))
  }, [setState])

  /** Delete a category and everything beneath it, as the source cascade does. */
  const deleteCategories = useCallback((ids) => {
    setState(prev => ({
      ...prev,
      deletedCategoryIds: [...new Set([...(prev.deletedCategoryIds || []), ...ids.map(Number)])],
    }))
  }, [setState])

  /** Patch any full-copy collection in state, matched on `idField`. */
  const updateCollectionItem = useCallback((collection, idField, id, patch) => {
    setState(prev => ({
      ...prev,
      [collection]: (prev[collection] || []).map(item =>
        String(item[idField]) === String(id) ? { ...item, ...patch } : item),
    }))
  }, [setState])

  const addCollectionItem = useCallback((collection, item) => {
    setState(prev => ({ ...prev, [collection]: [...(prev[collection] || []), item] }))
  }, [setState])

  const removeCollectionItem = useCallback((collection, idField, id) => {
    setState(prev => ({
      ...prev,
      [collection]: (prev[collection] || []).filter(item => String(item[idField]) !== String(id)),
    }))
  }, [setState])

  /**
   * Customers > Edit > Wish List "Delete" — the one wishlist mutation the
   * Magento admin actually exposes (it can remove an item, not add one).
   */
  const removeWishlistItem = useCallback((customerId, wishlistItemId) => {
    setState(prev => ({
      ...prev,
      wishlists: (prev.wishlists || []).map(w =>
        String(w.customer_id) === String(customerId)
          ? { ...w, items: (w.items || []).filter(i => String(i.wishlist_item_id) !== String(wishlistItemId)) }
          : w),
    }))
  }, [setState])

  const deleteReviews = useCallback((ids) => {
    setState(prev => ({
      ...prev,
      deletedReviewIds: [...new Set([...prev.deletedReviewIds, ...ids.map(Number)])],
    }))
  }, [setState])

  const saveGridBookmark = useCallback((gridId, viewName, params) => {
    setState(prev => ({
      ...prev,
      gridBookmarks: {
        ...prev.gridBookmarks,
        [gridId]: { ...(prev.gridBookmarks[gridId] || {}), [viewName]: params },
      },
    }))
  }, [setState])

  const value = useMemo(() => ({
    state, setState, loading,
    messages, addMessage, dismissMessage, clearMessages,
    patchOrder, patchOrderAddress,
    patchProduct, setProductDescription, addProduct, deleteProducts,
    patchCategory, addCategory, deleteCategories,
    updateCollectionItem, addCollectionItem, removeCollectionItem,
    removeWishlistItem, deleteReviews, saveGridBookmark,
    // The mock boots pre-logged-in; there is no auth gate anywhere.
    currentUser: { username: 'admin', firstname: 'Admin', lastname: 'User', email: 'admin@your-domain.com' },
  }), [state, setState, loading, messages, addMessage, dismissMessage, clearMessages,
    patchOrder, patchOrderAddress, patchProduct, setProductDescription,
    addProduct, deleteProducts, patchCategory, addCategory, deleteCategories,
    updateCollectionItem, addCollectionItem,
    removeCollectionItem, removeWishlistItem, deleteReviews, saveGridBookmark])

  if (loading) {
    return (
      <div className="admin-boot">
        <span className="admin-boot__spinner" />
      </div>
    )
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>')
  return ctx
}
