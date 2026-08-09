import React, { createContext, useContext, useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  getSessionId, fetchCustomState, initializeData, createInitialData, saveState,
  initialKey, storageKey
} from '../utils/dataManager.js'
import { slugify } from '../utils/slug.js'
import {
  materialize, groupCommentsBySubmission,
  resolveSubmission, resolveComment, patchSubmission, patchComment,
  addSubmission as overlayAddSubmission, addComment as overlayAddComment,
  removeSubmission, removeComment, hasChildComments
} from '../utils/overlay.js'

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
  /**
   * `core` is the PERSISTED state — small, overlay-shaped, and the only thing
   * that reaches localStorage, `POST set_current` and `/go`. `state` is
   * `materialize(core)`: the same object plus fully merged `submissions`,
   * `comments` and `userDirectory`, which is what the whole component tree
   * reads. Every mutation writes `core`; nothing ever writes the merged arrays
   * back, so there is exactly one place where the frozen corpus and the
   * agent's delta are combined. See src/utils/overlay.js.
   */
  const [core, setStateRaw] = useState(null)
  const state = useMemo(() => materialize(core), [core])
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
    if (loading || !core) return
    if (!bootSeatedRef.current) { bootSeatedRef.current = true; return }
    // `core`, never `state`: persisting the materialized arrays would put the
    // frozen corpus back on the wire — that was the 14.67 MB POST / 40 MB `/go`
    // this refactor removed.
    saveState(core, getSessionId())
  }, [core, loading])

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

  /**
   * Id indexes over the MERGED arrays.
   *
   * `getSubmission()` used to be `state.submissions.find(...)` — a linear scan
   * of 8,012 records on every submission-page render, and `commentsFor()` a
   * scan of 24,149. Building the maps once per committed state is strictly
   * cheaper and, because they are built from `state.submissions` /
   * `state.comments`, they cannot drift from what the listings render.
   *
   * Built LAZILY, via getters: a forum listing never calls `getComment()` or
   * `commentsFor()`, and eagerly indexing 24,149 comments on every committed
   * state made it pay for them anyway — on the cold-boot render most of all.
   */
  const indexes = useMemo(() => {
    if (!state) return null
    let subById = null
    let comById = null
    let bySubmission = null
    return {
      get submissionById() {
        if (!subById) {
          subById = new Map()
          for (const s of state.submissions) subById.set(String(s.id), s)
        }
        return subById
      },
      get commentById() {
        if (!comById) {
          comById = new Map()
          for (const c of state.comments) comById.set(String(c.id), c)
        }
        return comById
      },
      get commentsBySubmission() {
        if (!bySubmission) bySubmission = groupCommentsBySubmission(state.comments)
        return bySubmission
      }
    }
  }, [state])

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
      getSubmission: (id) => indexes.submissionById.get(String(id)) || null,
      getComment: (id) => indexes.commentById.get(String(id)) || null,
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
        (indexes.commentsBySubmission.get(String(submissionId)) || [])
          .filter(c => c.visibility !== 'trashed'),
      submissionVote: (id) => state.votes.submissions[String(id)] || 0,
      commentVote: (id) => state.votes.comments[String(id)] || 0,
      isSubscribed: (forumName) =>
        state.subscriptions.some(f => f.toLowerCase() === String(forumName).toLowerCase()),
      moderates: (forumName) =>
        state.moderatorOf.some(f => f.toLowerCase() === String(forumName).toLowerCase()),
      visibleSubmissions: () => state.submissions.filter(s => s.visibility !== 'trashed')
    }
  }, [state, indexes])

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
      if (delta === 0) return prev
      const votes = {
        ...prev.votes,
        [bucket]: { ...prev.votes[bucket] }
      }
      if (next === 0) delete votes[bucket][key]
      else votes[bucket][key] = next

      const withVotes = { ...prev, votes }
      // A seeded record can't be mutated in place, so the new netScore lands in
      // the overlay's edit map and wins at materialization. `patch*` handles
      // agent-created records by updating them in `newSubmissions`/`newComments`.
      const current = kind === 'comment'
        ? resolveComment(withVotes, key)
        : resolveSubmission(withVotes, key)
      if (!current) return withVotes
      const patch = { netScore: (current.netScore || 0) + delta }
      return kind === 'comment'
        ? patchComment(withVotes, key, patch)
        : patchSubmission(withVotes, key, patch)
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

      return overlayAddSubmission({
        ...prev,
        forums: f
          ? prev.forums.map(x => x.id === f.id
              ? { ...x, submissionCount: (x.submissionCount || 0) + 1 } : x)
          : prev.forums,
        votes: {
          ...prev.votes,
          submissions: { ...prev.votes.submissions, [String(id)]: 1 }
        },
        nextSubmissionId: prev.nextSubmissionId + 1
      }, created)
    })
    return created
  }, [setState])

  const editSubmission = useCallback((id, updates) => {
    setState(prev => patchSubmission(prev, id, { ...updates, editedAt: nowIso() }))
  }, [setState])

  /**
   * Delete. The record is tombstoned in the overlay rather than filtered out of
   * an array, and `materialize()` drops every comment whose submission no
   * longer resolves — so the forum listing, the permalink, `/user/<n>`, search
   * and the firehose all agree, without each maintaining its own prune.
   */
  const deleteSubmission = useCallback((id) => {
    setState(prev => {
      const sub = resolveSubmission(prev, id)
      return removeSubmission({
        ...prev,
        forums: sub
          ? prev.forums.map(f => f.name === sub.forum
              ? { ...f, submissionCount: Math.max(0, (f.submissionCount || 0) - 1) } : f)
          : prev.forums
      }, id)
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
      const withComment = overlayAddComment({
        ...prev,
        votes: { ...prev.votes, comments: { ...prev.votes.comments, [String(id)]: 1 } },
        nextCommentId: prev.nextCommentId + 1
      }, created)
      const parentSub = resolveSubmission(withComment, submission)
      if (!parentSub) return withComment
      return patchSubmission(withComment, submission, {
        commentCount: (parentSub.commentCount || 0) + 1,
        lastActive: ts
      })
    })
    return created
  }, [setState])

  const editComment = useCallback((id, body) => {
    setState(prev => patchComment(prev, id, { body, editedAt: nowIso() }))
  }, [setState])

  /** Soft delete — Postmill replaces the body and keeps the node in the tree. */
  const deleteComment = useCallback((id) => {
    setState(prev => {
      const target = resolveComment(prev, id)
      if (!target) return prev
      if (hasChildComments(prev, id)) {
        return patchComment(prev, id, {
          body: '[deleted]', author: '[deleted]', visibility: 'soft-deleted'
        })
      }
      const removed = removeComment(prev, id)
      const sub = resolveSubmission(removed, target.submission)
      if (!sub) return removed
      return patchSubmission(removed, target.submission, {
        commentCount: Math.max(0, (sub.commentCount || 0) - 1)
      })
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
      const target = resolveComment(prev, id)
      if (!target) return prev
      if (target.visibility === 'trashed') return prev
      const trashed = patchComment(prev, id, {
        visibility: 'trashed',
        trashReason: reason || null,
        trashedBy: prev.currentUser.username,
        trashedAt: nowIso()
      })
      const sub = resolveSubmission(trashed, target.submission)
      if (!sub) return trashed
      return patchSubmission(trashed, target.submission, {
        commentCount: Math.max(0, (sub.commentCount || 0) - 1)
      })
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

  /**
   * `ForumController::edit` with a changed name. Submissions, subscriptions and
   * moderatorOf all key off the forum NAME, so a rename has to carry them or the
   * forum's contents orphan — but 8,012 frozen submissions cannot be rewritten.
   * The rename is recorded as an ordered `{from, to}` entry and applied to
   * `submission.forum` at materialization, so it costs ~40 bytes of state and
   * composes correctly across repeated renames (A→B→A resolves to A).
   */
  const renameForum = useCallback((oldName, updates) => {
    const newName = updates.name
    setState(prev => ({
      ...prev,
      forums: prev.forums.map(f => f.name.toLowerCase() === String(oldName).toLowerCase()
        ? { ...f, ...updates } : f),
      forumRenames: [...(prev.forumRenames || []), { from: oldName, to: newName }],
      subscriptions: prev.subscriptions.map(f => f === oldName ? newName : f),
      moderatorOf: prev.moderatorOf.map(f => f === oldName ? newName : f),
      hiddenForums: prev.hiddenForums.map(f => f === oldName ? newName : f)
    }))
  }, [setState])

  /**
   * `ForumController::delete` — the forum and all its content. Recorded as a
   * tombstoned forum name rather than a filter over the corpus: `materialize()`
   * drops submissions in a dead forum, and their comments follow because their
   * submission no longer resolves.
   */
  const deleteForum = useCallback((forumName) => {
    setState(prev => ({
      ...prev,
      forums: prev.forums.filter(f => f.name.toLowerCase() !== String(forumName).toLowerCase()),
      deletedForums: [...(prev.deletedForums || []), forumName],
      subscriptions: prev.subscriptions.filter(f => f !== forumName),
      moderatorOf: prev.moderatorOf.filter(f => f !== forumName),
      hiddenForums: prev.hiddenForums.filter(f => f !== forumName)
    }))
  }, [setState])

  /**
   * `/user/<name>` rename. Same shape as `renameForum`: an ordered entry
   * applied to `submission.author`, `comment.author` and the userDirectory key
   * at materialization, instead of rewriting every record the user ever wrote.
   */
  const renameUser = useCallback((from, to) => {
    setState(prev => ({
      ...prev,
      currentUser: { ...prev.currentUser, username: to },
      users: prev.users.map(u => u.username === from ? { ...u, username: to } : u),
      userRenames: [...(prev.userRenames || []), { from, to }]
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
    // `state` is materialized (corpus merged in) — read it everywhere.
    // `coreState` is the persisted delta — only /go and diffing want it.
    state, coreState: core, setState, resetState, loading,
    flashes, addFlash, dismissFlash,
    ...selectors,
    vote, subscribe, unsubscribe,
    createSubmission, editSubmission, deleteSubmission,
    addComment, editComment, deleteComment, trashComment,
    createForum, editForum, renameForum, deleteForum, renameUser,
    updateBio, updatePreferences, updateAccount, setNightMode,
    hideForum, unhideForum, clearNotifications, blockUser, unblockUser
  }), [state, core, setState, resetState, loading, flashes, addFlash, dismissFlash, selectors,
       vote, subscribe, unsubscribe, createSubmission, editSubmission, deleteSubmission,
       addComment, editComment, deleteComment, trashComment, createForum, editForum,
       renameForum, deleteForum, renameUser,
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
