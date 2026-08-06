import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getSessionId, fetchServerState, initializeData, saveState, publishInitialState,
  readStoredState, readStoredInitial, writeStoredInitial, mergeOverDefaults,
  sameState, initialKey, storageKey, assertTrackerCoverage,
} from '../utils/dataManager.js'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, setStateRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  // Flash messages are deliberately NOT part of the persisted state: they are
  // one-page-load UI chrome and would otherwise pollute /go's state_diff.
  const [messages, setMessages] = useState([])

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
    const sid = getSessionId()

    // Every path in stateTracker's Observable State Changes table must be
    // declared in createInitialData(), or its first write lands in state_diff
    // with no `old` member. Warn-only; never blocks the boot.
    assertTrackerCoverage()

    ;(async () => {
      const server = await fetchServerState(sid)
      // ⚠️ Read localStorage BEFORE any initializeData() call. initializeData()
      // writes defaults, which would make every boot look like a refresh and
      // injected task state would never load.
      const localCurrent = readStoredState(sid)
      const localInitial = readStoredInitial(sid)

      let data      // what to render, and to post as `set_current`
      let baseline  // what to post as `set_initial`

      if (server.current !== null && !sameState(server.current, localCurrent)) {
        // (a) ADOPT. The inject may be partial, so merge it over the defaults;
        // that merged tree — not the partial object — is the real baseline.
        data = initializeData(sid, server.current)
        // If the server's session has already diverged, its baseline is the
        // older, correct one. Mirror that rather than the state we just
        // adopted, so the client's notion of "initial" matches /go's.
        baseline = server.initial ? mergeOverDefaults(server.initial) : data
        // initializeData set BOTH localStorage keys to the merged current.
        writeStoredInitial(sid, baseline)
      } else if (localInitial !== null) {
        // (b) REPUBLISH. Merge over defaults so a state written by an older
        // build gains keys added since, and mirror the merged baseline back
        // into localStorage so the client and the server agree on it.
        data = mergeOverDefaults(localCurrent || localInitial)
        baseline = mergeOverDefaults(localInitial)
        writeStoredInitial(sid, baseline)
      } else {
        // (c) COLD BOOT.
        data = initializeData(sid, null)
        baseline = data
      }

      // set_initial must land BEFORE set_current: the plugin only republishes a
      // baseline while the session is still unmutated (current absent, or
      // deep-equal to initial), so if set_current raced ahead on a
      // baseline-less session the guard would see full-tree-vs-partial and
      // correctly refuse.
      await publishInitialState(baseline, sid)
      saveState(data, sid)
      setStateRaw(data)
      setLoading(false)
    })()
  }, [])

  const setState = useCallback((updater) => {
    setStateRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveState(next, getSessionId())
      return next
    })
  }, [])

  /* ------------------------------------------------------------ messages */

  // Magento sets a message, redirects, shows it on the next page, and drops it
  // on the load after that. Mirror the same one-navigation lifetime.
  const location = useLocation()
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
