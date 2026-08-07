import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  getSessionId, fetchCustomState, initializeData, createInitialData, saveState,
  initialKey, storageKey
} from '../utils/dataManager.js'
import { slugify } from '../utils/slug.js'

const AppContext = createContext(null)

/**
 * One in-flight `GET /state` per sid, for the lifetime of the page.
 *
 * `<React.StrictMode>` mounts, runs the boot effect, tears it down and runs it
 * again — so without this the app issued TWO `/state` requests for a ~2.3 MB
 * payload and raced their resolutions against each other (AUDIT PIPELINE-003).
 * Deduping the promise means the second invocation joins the first request
 * instead of starting a competing one.
 */
const bootFetches = new Map()

function bootFetch(sid) {
  const k = sid == null ? '' : String(sid)
  if (!bootFetches.has(k)) bootFetches.set(k, fetchCustomState(sid))
  return bootFetches.get(k)
}

/**
 * `state.blockedUsers` normalised to `{ username, timestamp, comment }` rows.
 *
 * The key shipped as a bare username array (SCHEMA.md) and was inject-only
 * until `/user/{name}/block_user` landed, so both shapes have to keep working:
 * an injected `["smita16"]` must not break the block list, and a UI-created
 * block carries the timestamp and comment the source's table renders.
 */
export function normalizeBlocks(blocks) {
  return (blocks || [])
    .map(b => (typeof b === 'string'
      ? { username: b, timestamp: null, comment: '' }
      : { username: b.username, timestamp: b.timestamp || null, comment: b.comment || '' }))
    .filter(b => b.username)
}

/** ISO 8601 in the shape the seed uses (`2023-03-10T00:39:36+00:00`). */
export function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, '+00:00')
}

export function AppProvider({ children }) {
  const [state, setStateRaw] = useState(null)
  const [loading, setLoading] = useState(true)
  const [flashes, setFlashes] = useState([])

  useEffect(() => {
    // `cancelled` is the StrictMode guard. React mounts -> effect -> cleanup ->
    // effect in dev, so the first invocation MUST NOT seat state: if it does,
    // `loading` flips early, children mount, a mutate-on-mount route such as
    // /night_mode?nightMode=dark writes, and the second invocation's late
    // resolution re-seats the injected baseline on top of it — silently
    // reverting the mutation and propagating the revert to the server on the
    // NEXT write (AUDIT PIPELINE-003, 4/4 lost with a realistic 2.3 MB inject).
    // Do NOT try to lean on `isRefresh` being true the second time round: run
    // A's localStorage write only happens after its fetch resolves.
    let cancelled = false
    const sid = getSessionId()
    const initK = initialKey(sid)
    // ⚠️ Check localStorage BEFORE calling initializeData(). initializeData()
    // writes defaults, which would make isRefresh always true and injected task
    // state would never load.
    const isRefresh = localStorage.getItem(initK) !== null

    if (isRefresh) {
      setStateRaw(initializeData(sid))
      setLoading(false)
      return
    }

    bootFetch(sid)
      .then(custom => {
        if (cancelled) return
        setStateRaw(initializeData(sid, custom))
        setLoading(false)
      })
      // Boot must ALWAYS finish. If anything throws in here the old code left
      // `loading` true forever and #root rendered "Loading…" (PIPELINE-002).
      .catch(() => {
        if (cancelled) return
        try { setStateRaw(initializeData(sid)) }
        catch (e) { setStateRaw(createInitialData()) }
        setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  // Reflect the user's night mode onto <html>, as Postmill does.
  useEffect(() => {
    if (!state) return
    const mode = state.currentUser?.nightMode || 'light'
    document.documentElement.setAttribute('data-night-mode', mode)
    document.documentElement.classList.toggle('full-width', !!state.currentUser?.fullWidthDisplayEnabled)
  }, [state?.currentUser?.nightMode, state?.currentUser?.fullWidthDisplayEnabled])

  // The updater stays PURE. React deliberately double-invokes updaters under
  // <React.StrictMode> to surface impure reducers, and persisting from inside
  // one meant every mutation did two ~2.3 MB `POST /post` round-trips and two
  // 2.7 MB server-side writeFileSync calls in dev (AUDIT PIPELINE-004).
  const setState = useCallback((updater) => {
    setStateRaw(prev => (typeof updater === 'function' ? updater(prev) : updater))
  }, [])

  // Persist AFTER commit, exactly once per committed state. The ref skips the
  // very first committed state — that is the boot seat, not a mutation, and
  // POSTing it would be a pointless 2.3 MB upload on every cold load.
  const bootSeatedRef = useRef(false)
  useEffect(() => {
    if (loading || !state) return
    if (!bootSeatedRef.current) { bootSeatedRef.current = true; return }
    saveState(state, getSessionId())
  }, [state, loading])

  const resetState = useCallback(() => {
    const sid = getSessionId()
    const stored = localStorage.getItem(initialKey(sid))
    if (!stored) return
    try {
      const initial = JSON.parse(stored)
      localStorage.setItem(storageKey(sid), JSON.stringify(initial))
      setStateRaw(initial)
    } catch (e) { /* corrupt baseline */ }
  }, [])

  const addFlash = useCallback((message, type = 'success') => {
    setFlashes(f => [...f, { id: Date.now() + Math.random(), message, type }])
  }, [])
  const dismissFlash = useCallback((id) => {
    setFlashes(f => f.filter(x => x.id !== id))
  }, [])

  /* ------------------------------------------------------------------ *
   * Selectors                                                           *
   * ------------------------------------------------------------------ */

  const selectors = useMemo(() => {
    if (!state) return {}
    return {
      // forums.normalized_name is a UNIQUE lowercase index — /f/earthporn must
      // resolve to EarthPorn (SOURCE.md §5).
      getForum: (name) => {
        if (!name) return null
        const n = String(name).toLowerCase()
        return state.forums.find(f => f.name.toLowerCase() === n) || null
      },
      getSubmission: (id) => state.submissions.find(s => String(s.id) === String(id)) || null,
      getComment: (id) => state.comments.find(c => String(c.id) === String(id)) || null,
      getUser: (username) => {
        if (!username) return null
        const u = state.users.find(x => x.username === username)
        if (u) return u
        const joined = state.userDirectory[username]
        if (joined === undefined) return null
        return {
          username,
          created: `${joined}T00:00:00+00:00`,
          submissionCount: state.submissions.filter(s => s.author === username).length,
          commentCount: state.comments.filter(c => c.author === username).length
        }
      },
      commentsFor: (submissionId) =>
        state.comments.filter(c => String(c.submission) === String(submissionId)
          && c.visibility !== 'trashed'),
      submissionVote: (id) => state.votes.submissions[String(id)] || 0,
      commentVote: (id) => state.votes.comments[String(id)] || 0,
      isSubscribed: (forumName) =>
        state.subscriptions.some(f => f.toLowerCase() === String(forumName).toLowerCase()),
      moderates: (forumName) =>
        state.moderatorOf.some(f => f.toLowerCase() === String(forumName).toLowerCase()),
      visibleSubmissions: () => state.submissions.filter(s => s.visibility !== 'trashed')
    }
  }, [state])

  /* ------------------------------------------------------------------ *
   * Mutations — every one of these flows through setState() so it reaches  *
   * saveState() -> /post?action=set_current -> /go state_diff.            *
   * ------------------------------------------------------------------ */

  /** kind: 'submission' | 'comment'. choice: 1 | -1. Clicking the active
   *  direction retracts (choice becomes 0), per vote-controller.js. */
  const vote = useCallback((kind, id, choice) => {
    const key = String(id)
    setState(prev => {
      const bucket = kind === 'comment' ? 'comments' : 'submissions'
      const old = prev.votes[bucket][key] || 0
      const next = old === choice ? 0 : choice
      const delta = next - old
      const votes = {
        ...prev.votes,
        [bucket]: { ...prev.votes[bucket] }
      }
      if (next === 0) delete votes[bucket][key]
      else votes[bucket][key] = next

      const listKey = kind === 'comment' ? 'comments' : 'submissions'
      return {
        ...prev,
        votes,
        [listKey]: prev[listKey].map(item =>
          String(item.id) === key ? { ...item, netScore: (item.netScore || 0) + delta } : item)
      }
    })
  }, [setState])

  const subscribe = useCallback((forumName) => {
    setState(prev => {
      const forum = prev.forums.find(f => f.name.toLowerCase() === String(forumName).toLowerCase())
      if (!forum) return prev
      if (prev.subscriptions.some(f => f.toLowerCase() === forum.name.toLowerCase())) return prev
      return {
        ...prev,
        subscriptions: [...prev.subscriptions, forum.name],
        forums: prev.forums.map(f => f.id === forum.id
          ? { ...f, subscriberCount: (f.subscriberCount || 0) + 1 } : f)
      }
    })
  }, [setState])

  const unsubscribe = useCallback((forumName) => {
    setState(prev => {
      const forum = prev.forums.find(f => f.name.toLowerCase() === String(forumName).toLowerCase())
      if (!forum) return prev
      if (!prev.subscriptions.some(f => f.toLowerCase() === forum.name.toLowerCase())) return prev
      return {
        ...prev,
        subscriptions: prev.subscriptions.filter(f => f.toLowerCase() !== forum.name.toLowerCase()),
        forums: prev.forums.map(f => f.id === forum.id
          ? { ...f, subscriberCount: Math.max(0, (f.subscriberCount || 0) - 1) } : f)
      }
    })
  }, [setState])

  /**
   * Appends a submission and returns it so the caller can redirect to
   * /f/<forum>/<id>/<slug> — that final URL is read by
   * func:reddit_get_post_url('__last_url__') and 60+ tasks are scored on it.
   */
  const createSubmission = useCallback(({ forum, title, url, body, image, imageWidth, imageHeight, userFlag }) => {
    let created = null
    setState(prev => {
      const f = prev.forums.find(x => x.name.toLowerCase() === String(forum).toLowerCase())
      const ts = nowIso()
      const id = prev.nextSubmissionId
      created = {
        id,
        forum: f ? f.name : forum,
        author: prev.currentUser.username,
        title,
        timestamp: ts,
        lastActive: ts,
        ranking: Math.floor(Date.now() / 1000),
        netScore: 1,
        commentCount: 0,
        slug: slugify(title)
      }
      if (url) created.url = url
      if (body) created.body = body
      if (image) {
        created.image = image
        if (imageWidth) created.imageWidth = imageWidth
        if (imageHeight) created.imageHeight = imageHeight
      }
      if (userFlag && userFlag !== 'none') created.userFlag = userFlag

      return {
        ...prev,
        submissions: [...prev.submissions, created],
        forums: f
          ? prev.forums.map(x => x.id === f.id
              ? { ...x, submissionCount: (x.submissionCount || 0) + 1 } : x)
          : prev.forums,
        votes: {
          ...prev.votes,
          submissions: { ...prev.votes.submissions, [String(id)]: 1 }
        },
        nextSubmissionId: prev.nextSubmissionId + 1
      }
    })
    return created
  }, [setState])

  const editSubmission = useCallback((id, updates) => {
    setState(prev => ({
      ...prev,
      submissions: prev.submissions.map(s => String(s.id) === String(id)
        ? { ...s, ...updates, editedAt: nowIso() }
        : s)
    }))
  }, [setState])

  /** Soft delete, as Postmill's delete_own does. */
  const deleteSubmission = useCallback((id) => {
    setState(prev => {
      const sub = prev.submissions.find(s => String(s.id) === String(id))
      return {
        ...prev,
        submissions: prev.submissions.filter(s => String(s.id) !== String(id)),
        comments: prev.comments.filter(c => String(c.submission) !== String(id)),
        forums: sub
          ? prev.forums.map(f => f.name === sub.forum
              ? { ...f, submissionCount: Math.max(0, (f.submissionCount || 0) - 1) } : f)
          : prev.forums
      }
    })
  }, [setState])

  const addComment = useCallback(({ submission, parent = null, body, userFlag }) => {
    let created = null
    setState(prev => {
      const id = prev.nextCommentId
      created = {
        id,
        submission: Number(submission),
        author: prev.currentUser.username,
        body,
        netScore: 1,
        timestamp: nowIso()
      }
      if (parent !== null && parent !== undefined) created.parent = Number(parent)
      if (userFlag && userFlag !== 'none') created.userFlag = userFlag

      const ts = created.timestamp
      return {
        ...prev,
        comments: [...prev.comments, created],
        submissions: prev.submissions.map(s => String(s.id) === String(submission)
          ? { ...s, commentCount: (s.commentCount || 0) + 1, lastActive: ts }
          : s),
        votes: { ...prev.votes, comments: { ...prev.votes.comments, [String(id)]: 1 } },
        nextCommentId: prev.nextCommentId + 1
      }
    })
    return created
  }, [setState])

  const editComment = useCallback((id, body) => {
    setState(prev => ({
      ...prev,
      comments: prev.comments.map(c => String(c.id) === String(id)
        ? { ...c, body, editedAt: nowIso() } : c)
    }))
  }, [setState])

  /** Soft delete — Postmill replaces the body and keeps the node in the tree. */
  const deleteComment = useCallback((id) => {
    setState(prev => {
      const target = prev.comments.find(c => String(c.id) === String(id))
      if (!target) return prev
      const hasChildren = prev.comments.some(c => String(c.parent) === String(id))
      if (hasChildren) {
        return {
          ...prev,
          comments: prev.comments.map(c => String(c.id) === String(id)
            ? { ...c, body: '[deleted]', author: '[deleted]', visibility: 'soft-deleted' } : c)
        }
      }
      return {
        ...prev,
        comments: prev.comments.filter(c => String(c.id) !== String(id)),
        submissions: prev.submissions.map(s => String(s.id) === String(target.submission)
          ? { ...s, commentCount: Math.max(0, (s.commentCount || 0) - 1) } : s)
      }
    })
  }, [setState])

  /**
   * Moderator delete — `CommentController::delete` / `deleteThread`, which run
   * `Comment::trash($reason)`: visibility becomes `trashed`, the body is kept,
   * and the reason is recorded on the moderation log entry.
   *
   * This is the ONLY writer of `visibility: 'trashed'`, which seven readers
   * (TrashPage, commentsFor, visibleSubmissions, CommentsFirehosePage,
   * SearchPage, UserPage) already honour — so `/trash` (ROUTES #8) only
   * populates through here. `deleteComment()` stays the `delete_own` path.
   */
  const trashComment = useCallback((id, reason) => {
    setState(prev => {
      const target = prev.comments.find(c => String(c.id) === String(id))
      if (!target) return prev
      if (target.visibility === 'trashed') return prev
      return {
        ...prev,
        comments: prev.comments.map(c => String(c.id) === String(id)
          ? {
              ...c,
              visibility: 'trashed',
              trashReason: reason || null,
              trashedBy: prev.currentUser.username,
              trashedAt: nowIso()
            }
          : c),
        submissions: prev.submissions.map(s => String(s.id) === String(target.submission)
          ? { ...s, commentCount: Math.max(0, (s.commentCount || 0) - 1) } : s)
      }
    })
  }, [setState])

  /** Creator becomes a moderator, which is what unlocks /f/<new>/edit. */
  const createForum = useCallback(({ name, title, description, sidebar, moderationLogPublic = true }) => {
    let created = null
    setState(prev => {
      const id = prev.nextForumId
      created = {
        id,
        name,
        title: title || name,
        sidebar: sidebar || '',
        description: description || '',
        created: nowIso(),
        featured: false,
        submissionCount: 0,
        subscriberCount: 1,
        moderationLogPublic
      }
      return {
        ...prev,
        forums: [...prev.forums, created],
        moderatorOf: [...prev.moderatorOf, name],
        subscriptions: [...prev.subscriptions, name],
        nextForumId: prev.nextForumId + 1
      }
    })
    return created
  }, [setState])

  const editForum = useCallback((forumName, updates) => {
    setState(prev => ({
      ...prev,
      forums: prev.forums.map(f => f.name.toLowerCase() === String(forumName).toLowerCase()
        ? { ...f, ...updates } : f)
    }))
  }, [setState])

  /** webarena-399..403 read `.user-bio__biography` after this runs. */
  const updateBio = useCallback((biography) => {
    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser, biography },
      users: prev.users.map(u => u.username === prev.currentUser.username
        ? { ...u, biography } : u)
    }))
  }, [setState])

  const updatePreferences = useCallback((updates) => {
    setState(prev => ({ ...prev, currentUser: { ...prev.currentUser, ...updates } }))
  }, [setState])

  const updateAccount = updatePreferences

  const setNightMode = useCallback((mode) => {
    setState(prev => ({ ...prev, currentUser: { ...prev.currentUser, nightMode: mode } }))
  }, [setState])

  const hideForum = useCallback((forumName) => {
    setState(prev => prev.hiddenForums.includes(forumName)
      ? prev
      : { ...prev, hiddenForums: [...prev.hiddenForums, forumName] })
  }, [setState])

  const unhideForum = useCallback((forumName) => {
    setState(prev => ({ ...prev, hiddenForums: prev.hiddenForums.filter(f => f !== forumName) }))
  }, [setState])

  const clearNotifications = useCallback(() => {
    setState(prev => ({ ...prev, notifications: [] }))
  }, [setState])

  /**
   * ROUTES #70 — `User::block()`. Entries are `{ username, timestamp, comment }`
   * so `/user/{name}/block_list` can render its real Username | Blocked |
   * Comment table. Legacy/injected entries that are plain username strings are
   * still understood everywhere via `normalizeBlocks()`.
   */
  const blockUser = useCallback((username, comment = '') => {
    setState(prev => {
      const list = normalizeBlocks(prev.blockedUsers)
      if (list.some(b => b.username.toLowerCase() === String(username).toLowerCase())) return prev
      return {
        ...prev,
        blockedUsers: [
          ...list,
          { username, timestamp: nowIso(), comment: comment || '' }
        ]
      }
    })
  }, [setState])

  /** ROUTES #71 — `User::unblock()`. */
  const unblockUser = useCallback((username) => {
    setState(prev => ({
      ...prev,
      blockedUsers: normalizeBlocks(prev.blockedUsers)
        .filter(b => b.username.toLowerCase() !== String(username).toLowerCase())
    }))
  }, [setState])

  const value = useMemo(() => ({
    state, setState, resetState, loading,
    flashes, addFlash, dismissFlash,
    ...selectors,
    vote, subscribe, unsubscribe,
    createSubmission, editSubmission, deleteSubmission,
    addComment, editComment, deleteComment, trashComment,
    createForum, editForum,
    updateBio, updatePreferences, updateAccount, setNightMode,
    hideForum, unhideForum, clearNotifications, blockUser, unblockUser
  }), [state, setState, resetState, loading, flashes, addFlash, dismissFlash, selectors,
       vote, subscribe, unsubscribe, createSubmission, editSubmission, deleteSubmission,
       addComment, editComment, deleteComment, trashComment, createForum, editForum,
       updateBio, updatePreferences, updateAccount, setNightMode,
       hideForum, unhideForum, clearNotifications, blockUser, unblockUser])

  if (loading) {
    return (
      <div style={{ padding: '2rem', color: '#505050', fontFamily: 'Roboto, sans-serif' }}>
        Loading…
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

export default AppContext
