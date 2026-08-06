import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import {
  getSessionId, fetchServerState, initializeData, saveState, publishInitialState,
  readStoredState, readStoredInitial, writeStoredInitial, mergeOverDefaults,
  sameState, createInitialData,
} from '../utils/dataManager.js'
import { finalPrice, getOptions, productsById } from '../utils/catalog.js'
import { flatRateShipping } from '../utils/orders.js'

const AppContext = createContext(null)

function nowStamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19)
}

export function AppProvider({ children }) {
  const [state, setStateRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [messages, setMessages] = useState([])
  const location = useLocation()
  const navCount = useRef(0)

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
   *       must actually reach the UI. (PIPELINE-001, PIPELINE-P1-a)
   *
   *   (b) REPUBLISH — this browser has a baseline for the sid and the server
   *       agrees with it (or has nothing at all). Render from localStorage, and
   *       push BOTH the baseline and the current state back so a server that
   *       has lost its files — `.mock-states/` is gitignored, hence absent on
   *       every fresh deploy — is repaired instead of silently reporting the
   *       DEFAULT tree with an empty diff. (PIPELINE-002)
   *
   *   (c) COLD BOOT — neither side has anything. Seed from createInitialData().
   *
   * Why (b) cannot erase a real diff: `set_initial` is refused by the plugin
   * whenever the stored current state exists and differs from the stored
   * baseline. So on a plain reload of an already-driven sid the republish is a
   * no-op and `state_diff` survives — the behaviour the pipeline audit verified
   * clean (T4/T7). It only lands when the baseline file is missing, which is
   * exactly the case being repaired.
   * ------------------------------------------------------------------ */
  useEffect(() => {
    const sid = getSessionId()

    ;(async () => {
      const server = await fetchServerState(sid)
      // Read localStorage BEFORE any initializeData() call — initializeData
      // writes defaults, which would make every boot look like a refresh and
      // injected task state would never load.
      const localCurrent = readStoredState(sid)
      const localInitial = readStoredInitial(sid)

      let data      // what to render, and to post as `set_current`
      let baseline  // what to post as `set_initial`

      if (server.current !== null && !sameState(server.current, localCurrent)) {
        // (a) ADOPT. The inject may be partial (SCHEMA.md §2.2), so merge it
        // over the 15-key defaults; that merged tree — not the partial object —
        // is the real baseline.
        data = initializeData(sid, server.current)
        // If the server's session has already diverged, its baseline is the
        // older, correct one. Mirror that rather than the state we just
        // adopted, so the client's notion of "initial" matches /go's.
        baseline = server.initial ? mergeOverDefaults(server.initial) : data
        // initializeData set BOTH localStorage keys to the merged current.
        writeStoredInitial(sid, baseline)
      } else if (localInitial !== null) {
        // (b) REPUBLISH.
        data = localCurrent || localInitial
        baseline = localInitial
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

  // Magento shows a message on the page you land on, then it is gone.
  useEffect(() => {
    navCount.current += 1
    setMessages(ms => ms.filter(m => m.nav >= navCount.current - 1))
  }, [location.key])

  const setState = useCallback((updater) => {
    setStateRaw(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveState(next, getSessionId())
      return next
    })
  }, [])

  /**
   * Restore the session to its baseline.
   *
   * PIPELINE-P1-b: this used to be the one mutator that called `setStateRaw`
   * directly, so it wrote localStorage but never POSTed — the reset was
   * invisible to `/go` and the next real mutation re-uploaded a tree that had
   * been reset only in the browser. It now goes through `setState`, which is
   * the single path to `saveState()` → `POST /post?action=set_current`, so the
   * client and the server land on the same tree.
   *
   * (The server-initiated `{"action":"reset"}` reaches the client from the
   * other direction: it rewrites `<sid>.json` from the baseline, and boot case
   * (a) above then adopts it.)
   */
  const resetState = useCallback(() => {
    const sid = getSessionId()
    setState(readStoredInitial(sid) || createInitialData())
  }, [setState])

  const addMessage = useCallback((text, type = 'success') => {
    setMessages(ms => [...ms, { text, type, nav: navCount.current, id: `${Date.now()}_${ms.length}` }])
  }, [])

  const clearMessages = useCallback(() => setMessages([]), [])

  /* ---------------------------------------------------------------- */
  /* Cart                                                              */
  /* ---------------------------------------------------------------- */

  const addToCart = useCallback((product, qty = 1, selectedOptions = []) => {
    setState(prev => {
      const items = [...prev.cart.items]
      const key = JSON.stringify(selectedOptions.map(o => o.optionTypeId).sort())
      const existing = items.findIndex(i =>
        i.productId === product.id &&
        JSON.stringify((i.options || []).map(o => o.optionTypeId).sort()) === key)
      if (existing >= 0) {
        items[existing] = { ...items[existing], qty: items[existing].qty + qty }
      } else {
        items.push({
          itemId: prev.nextCartItemId,
          productId: product.id,
          sku: product.sku,
          name: product.name,
          price: finalPrice(product),
          qty,
          options: selectedOptions,
        })
      }
      return {
        ...prev,
        cart: { ...prev.cart, items },
        nextCartItemId: existing >= 0 ? prev.nextCartItemId : prev.nextCartItemId + 1,
      }
    })
  }, [setState])

  const updateCartQty = useCallback((itemId, qty) => {
    setState(prev => ({
      ...prev,
      cart: {
        ...prev.cart,
        items: prev.cart.items
          .map(i => (i.itemId === itemId ? { ...i, qty } : i))
          .filter(i => i.qty > 0),
      },
    }))
  }, [setState])

  const removeCartItem = useCallback((itemId) => {
    setState(prev => ({
      ...prev,
      cart: { ...prev.cart, items: prev.cart.items.filter(i => i.itemId !== itemId) },
    }))
  }, [setState])

  const clearCart = useCallback(() => {
    setState(prev => ({ ...prev, cart: { ...prev.cart, items: [] } }))
  }, [setState])

  /* ---------------------------------------------------------------- */
  /* Wish list                                                         */
  /* ---------------------------------------------------------------- */

  const addToWishlist = useCallback((product, extra = {}) => {
    setState(prev => {
      if (prev.wishlist.items.some(i => i.productId === product.id)) return prev
      return {
        ...prev,
        wishlist: {
          ...prev.wishlist,
          items: [...prev.wishlist.items, {
            wishlistItemId: prev.nextWishlistItemId,
            productId: product.id,
            sku: product.sku,
            name: product.name,
            price: finalPrice(product),
            qty: extra.qty || 1,
            description: extra.description || '',
            addedAt: nowStamp(),
          }],
        },
        nextWishlistItemId: prev.nextWishlistItemId + 1,
      }
    })
  }, [setState])

  const updateWishlistItem = useCallback((wishlistItemId, changes) => {
    setState(prev => ({
      ...prev,
      wishlist: {
        ...prev.wishlist,
        items: prev.wishlist.items.map(i =>
          i.wishlistItemId === wishlistItemId ? { ...i, ...changes } : i),
      },
    }))
  }, [setState])

  const removeWishlistItem = useCallback((wishlistItemId) => {
    setState(prev => ({
      ...prev,
      wishlist: {
        ...prev.wishlist,
        items: prev.wishlist.items.filter(i => i.wishlistItemId !== wishlistItemId),
      },
    }))
  }, [setState])

  const moveToWishlist = useCallback((itemId) => {
    setState(prev => {
      const line = prev.cart.items.find(i => i.itemId === itemId)
      if (!line) return prev
      const already = prev.wishlist.items.some(i => i.productId === line.productId)
      return {
        ...prev,
        cart: { ...prev.cart, items: prev.cart.items.filter(i => i.itemId !== itemId) },
        wishlist: already ? prev.wishlist : {
          ...prev.wishlist,
          items: [...prev.wishlist.items, {
            wishlistItemId: prev.nextWishlistItemId,
            productId: line.productId,
            sku: line.sku,
            name: line.name,
            price: line.price,
            qty: line.qty,
            description: '',
            addedAt: nowStamp(),
          }],
        },
        nextWishlistItemId: already ? prev.nextWishlistItemId : prev.nextWishlistItemId + 1,
      }
    })
  }, [setState])

  /* ---------------------------------------------------------------- */
  /* Compare                                                           */
  /* ---------------------------------------------------------------- */

  const addToCompare = useCallback((product) => {
    setState(prev => {
      if (prev.compareList.items.some(i => i.productId === product.id)) return prev
      return {
        ...prev,
        compareList: {
          items: [...prev.compareList.items, {
            productId: product.id, sku: product.sku, name: product.name,
          }],
        },
      }
    })
  }, [setState])

  const removeFromCompare = useCallback((productId) => {
    setState(prev => ({
      ...prev,
      compareList: { items: prev.compareList.items.filter(i => i.productId !== productId) },
    }))
  }, [setState])

  const clearCompare = useCallback(() => {
    setState(prev => ({ ...prev, compareList: { items: [] } }))
  }, [setState])

  /* ---------------------------------------------------------------- */
  /* Reviews                                                           */
  /* ---------------------------------------------------------------- */

  const submitReview = useCallback(({ productId, rating, nickname, title, detail }) => {
    let newId = null
    setState(prev => {
      newId = prev.nextReviewId
      return {
        ...prev,
        myReviews: [...prev.myReviews, {
          reviewId: prev.nextReviewId,
          productId: Number(productId),
          title,
          detail,
          nickname,
          customerId: prev.customer.id,
          rating: Number(rating),
          createdAt: nowStamp(),
        }],
        nextReviewId: prev.nextReviewId + 1,
      }
    })
    return newId
  }, [setState])

  /* ---------------------------------------------------------------- */
  /* Account                                                           */
  /* ---------------------------------------------------------------- */

  const saveAccountInfo = useCallback((changes) => {
    setState(prev => ({ ...prev, customer: { ...prev.customer, ...changes } }))
  }, [setState])

  const setNewsletter = useCallback((subscribed) => {
    setState(prev => ({ ...prev, newsletterSubscribed: !!subscribed }))
  }, [setState])

  const saveAddress = useCallback((address) => {
    let savedId = address.id
    setState(prev => {
      const isNew = !address.id
      const id = isNew ? prev.nextAddressId : address.id
      savedId = id
      const record = { ...address, id }
      let addresses = isNew
        ? [...prev.addresses, record]
        : prev.addresses.map(a => (a.id === id ? { ...a, ...record } : a))

      const customer = { ...prev.customer }
      if (record.isDefaultBilling) {
        customer.defaultBilling = id
        addresses = addresses.map(a => ({ ...a, isDefaultBilling: a.id === id }))
      }
      if (record.isDefaultShipping) {
        customer.defaultShipping = id
        addresses = addresses.map(a => ({ ...a, isDefaultShipping: a.id === id }))
      }
      return {
        ...prev,
        customer,
        addresses,
        nextAddressId: isNew ? prev.nextAddressId + 1 : prev.nextAddressId,
      }
    })
    return savedId
  }, [setState])

  const deleteAddress = useCallback((id) => {
    setState(prev => ({ ...prev, addresses: prev.addresses.filter(a => a.id !== id) }))
  }, [setState])

  const submitContact = useCallback((payload) => {
    setState(prev => ({
      ...prev,
      contactSubmissions: [...prev.contactSubmissions, { ...payload, submittedAt: nowStamp() }],
    }))
  }, [setState])

  /* ---------------------------------------------------------------- */
  /* Orders                                                            */
  /* ---------------------------------------------------------------- */

  /**
   * `addressId` is the address the user actually picked on the checkout's
   * Shipping Address step. It wins over `customer.defaultShipping` — HANDLERS-001:
   * the selection used to stop at CheckoutPage's local state, so the "I recently
   * moved" task cluster (add a second address, order to it) silently shipped to
   * the default address and `/go` could not see the difference.
   */
  const placeOrder = useCallback(({ shippingAmount, addressId } = {}) => {
    let placed = null
    setState(prev => {
      const items = prev.cart.items
      // Flat Rate is $5.00 per item (see flatRateShipping). Derived from the
      // cart when the caller omits it, so no call site can write a wrong
      // shippingAmount into state.orders.
      const shipping = shippingAmount == null ? flatRateShipping(items) : shippingAmount
      const subtotal = Math.round(items.reduce((s, i) => s + i.price * i.qty, 0) * 100) / 100
      const grandTotal = Math.round((subtotal + shipping) * 100) / 100
      const addr =
        (addressId != null && prev.addresses.find(a => a.id === addressId)) ||
        prev.addresses.find(a => a.id === prev.customer.defaultShipping) ||
        prev.addresses[0]
      const orderAddress = addr ? {
        firstname: addr.firstname,
        lastname: addr.lastname,
        street: Array.isArray(addr.street) ? addr.street.join('\n') : addr.street,
        city: addr.city,
        region: addr.region,
        postcode: addr.postcode,
        country_id: addr.countryId || 'US',
        telephone: addr.telephone,
        company: addr.company || null,
        email: null,
      } : null
      const incrementId = String(prev.nextOrderIncrementId).padStart(9, '0')
      const order = {
        entityId: prev.nextOrderEntityId,
        incrementId,
        status: 'pending',
        state: 'new',
        createdAt: nowStamp(),
        grandTotal,
        subtotal,
        shippingAmount: shipping,
        taxAmount: 0,
        discountAmount: 0,
        totalQtyOrdered: items.reduce((s, i) => s + i.qty, 0),
        shippingDescription: 'Flat Rate - Fixed',
        customerEmail: prev.customer.email,
        shippingMethod: 'flatrate_flatrate',
        paymentMethod: 'checkmo',
        paymentTitle: 'Check / Money order',
        billingAddress: orderAddress,
        shippingAddress: orderAddress,
        items: items.map((i, idx) => ({
          itemId: 100000 + idx,
          productId: i.productId,
          sku: i.sku,
          name: i.name,
          price: i.price,
          qtyOrdered: i.qty,
          rowTotal: Math.round(i.price * i.qty * 100) / 100,
          productType: 'simple',
          options: (i.options || []).map(o => ({ label: o.label, value: o.value })),
        })),
      }
      placed = order
      return {
        ...prev,
        orders: [order, ...prev.orders],
        cart: { ...prev.cart, items: [] },
        nextOrderIncrementId: prev.nextOrderIncrementId + 1,
        nextOrderEntityId: prev.nextOrderEntityId + 1,
        lastPlacedOrderId: order.entityId,
      }
    })
    return placed
  }, [setState])

  const reorder = useCallback((orderEntityId) => {
    setState(prev => {
      const order = prev.orders.find(o => Number(o.entityId) === Number(orderEntityId))
      if (!order) return prev
      const items = [...prev.cart.items]
      let nextId = prev.nextCartItemId
      for (const line of order.items) {
        const product = productsById.get(line.productId)
        const groups = getOptions(line.productId)
        const options = (line.options || []).map(o => {
          const group = groups.find(g => g.title === o.label)
          const value = group ? group.values.find(v => v.title === o.value) : null
          return {
            optionId: group ? group.optionId : null,
            optionTypeId: value ? value.optionTypeId : null,
            label: o.label,
            value: o.value,
          }
        })
        const key = JSON.stringify(options.map(o => o.optionTypeId).sort())
        const existing = items.findIndex(i =>
          i.productId === line.productId &&
          JSON.stringify((i.options || []).map(o => o.optionTypeId).sort()) === key)
        if (existing >= 0) {
          items[existing] = { ...items[existing], qty: items[existing].qty + line.qtyOrdered }
        } else {
          items.push({
            itemId: nextId++,
            productId: line.productId,
            sku: line.sku,
            name: line.name,
            price: product ? finalPrice(product) : line.price,
            qty: line.qtyOrdered,
            options,
          })
        }
      }
      return { ...prev, cart: { ...prev.cart, items }, nextCartItemId: nextId }
    })
  }, [setState])

  if (loading) {
    return <div style={{ padding: 40, fontSize: 14, color: '#333' }}>Loading...</div>
  }

  return (
    <AppContext.Provider value={{
      state, setState, resetState,
      messages, addMessage, clearMessages,
      addToCart, updateCartQty, removeCartItem, clearCart,
      addToWishlist, updateWishlistItem, removeWishlistItem, moveToWishlist,
      addToCompare, removeFromCompare, clearCompare,
      submitReview,
      saveAccountInfo, setNewsletter, saveAddress, deleteAddress, submitContact,
      placeOrder, reorder,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
