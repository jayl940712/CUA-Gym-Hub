import React, { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import SLink, { useSidNavigate } from '../components/SLink.jsx'
import Submission from '../components/Submission.jsx'
import InboxNav from '../components/user/InboxNav.jsx'
import UserCommentRow from '../components/user/UserCommentRow.jsx'
import OffsetPagination from '../components/user/OffsetPagination.jsx'
import MessageArticle from '../components/user/MessageArticle.jsx'
import NotFound from './NotFound.jsx'
import { threadTitle } from '../components/user/messages.js'
import { useApp } from '../context/AppContext.jsx'
import '../components/user/user.css'

// ROUTES #78 / #80 — templates/user/notifications.html.twig, transcribed from
// assets/html/notifications-auth.html and
// assets/screenshots/reference/23-notifications.png.
//
// The seed has ZERO notifications (TODO.md gap 8: the notifications table was
// never sampled), and none can legitimately appear on their own: Postmill only
// notifies you when *someone else* replies to your post or mentions you, and
// the mock is single-user. So the correct, verbatim empty state IS the job
// here — nothing is fabricated. The renderers below exist so that a task which
// injects `notifications` into the state still gets a real page.
//
// This view has NO sidebar on the source (the <aside> is empty).
//
// Copy: title/heading.notifications / flash.no_entries_to_display /
// action.clear / action.clear_all / flash.notifications_cleared /
// heading.you_were_mentioned / inbox.message_reply_head.

const PER_PAGE = 25

export default function NotificationsPage() {
  const params = useParams()
  const { state, clearNotifications, setState, addFlash } = useApp()

  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const all = state.notifications || []
  const pageCount = Math.max(1, Math.ceil(all.length / PER_PAGE))
  const items = all.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  // User::getPaginatedNotifications() is a Pagerfanta pager, which throws
  // NotFoundHttpException for an out-of-range page. Confirmed live:
  // GET /notifications/2 -> 404 (page 1 -> 200).
  const outOfRange = page > 1 && items.length === 0

  const clearAll = (e) => {
    e.preventDefault()
    clearNotifications()
    addFlash('Your notifications have been cleared.')
  }

  const clearOne = (id) => (e) => {
    e.preventDefault()
    setState(prev => ({
      ...prev,
      notifications: (prev.notifications || []).filter(n => String(n.id) !== String(id))
    }))
    addFlash('The notification was successfully cleared.')
  }

  if (outOfRange) return <NotFound />

  return (
    <Layout title="Notifications">
      <InboxNav active="notifications" />

      <h1 className="page-heading">Notifications</h1>

      {all.length > 0 ? (
        <form action="/clear_notifications" method="POST" className="form" onSubmit={clearAll}>
          <div className="form__row">
            <button type="submit" className="button">Clear all</button>
          </div>
        </form>
      ) : (
        <p className="no-entries">
          <small className="fg-muted text-md">There are no entries to display.</small>
        </p>
      )}

      {items.map(n => (
        <div key={n.id}>
          <form action="/clear_notifications" method="POST" onSubmit={clearOne(n.id)}>
            <button type="submit" className="button button--small clear-notification-button">Clear</button>
          </form>
          <NotificationBody notification={n} />
        </div>
      ))}

      <OffsetPagination
        page={page} pageCount={pageCount}
        hrefFor={n => `/notifications${n > 1 ? `/${n}` : ''}`}
      />
    </Layout>
  )
}

/**
 * ROUTES #80 — `/clear_notifications`. POST-only on the source (a bare GET is a
 * 405), but an agent can only navigate, so the mock treats a visit as the
 * action: clear, flash `flash.notifications_cleared`, and bounce back to
 * /notifications with ?sid= intact.
 */
export function ClearNotificationsRoute() {
  const { clearNotifications, addFlash } = useApp()
  const navigate = useSidNavigate()
  const done = useRef(false)

  useEffect(() => {
    if (done.current) return
    done.current = true
    clearNotifications()
    addFlash('Your notifications have been cleared.')
    // No re-assert needed at the destination: AppProvider does not render its
    // children until boot has seated state exactly once (the StrictMode
    // cancellation guard in AppContext.jsx), so nothing can arrive late and
    // re-seat the injected notifications over this mutation.
    navigate('/notifications', { replace: true })
  }, [clearNotifications, addFlash, navigate])

  return null
}

/**
 * One notification. `type` mirrors Postmill's blocks in
 * user/notifications.html.twig: comment | comment_mention | submission_mention
 * | message.
 */
function NotificationBody({ notification }) {
  const { getComment, getSubmission, state } = useApp()

  if (notification.type === 'message' && notification.message) {
    const thread = (state.messages || []).find(t => String(t.id) === String(notification.message.thread))
    const isFirst = thread && thread.messages[0]
      && String(thread.messages[0].id) === String(notification.message.id)
    return (
      <div>
        <h1 className="text-md">
          <SLink to={`/messages/thread/${notification.message.thread}#message_${notification.message.id}`}>
            {isFirst ? (thread ? threadTitle(thread) : '') : `Re: ${thread ? threadTitle(thread) : ''}`}
          </SLink>
        </h1>
        <MessageArticle message={notification.message} thread={thread} />
      </div>
    )
  }

  if (notification.type === 'submission_mention') {
    const submission = getSubmission(notification.submission)
    if (!submission) return null
    return (
      <div>
        <h1 className="text-md">
          You were mentioned by <SLink to={`/user/${submission.author}`}>/u/{submission.author}</SLink>
        </h1>
        <Submission submission={submission} expanded />
      </div>
    )
  }

  const comment = getComment(notification.comment)
  if (!comment) return null

  if (notification.type === 'comment_mention') {
    return (
      <div>
        <h1 className="text-md">
          You were mentioned by <SLink to={`/user/${comment.author}`}>/u/{comment.author}</SLink>
        </h1>
        <UserCommentRow comment={comment} />
      </div>
    )
  }

  return <UserCommentRow comment={comment} />
}
