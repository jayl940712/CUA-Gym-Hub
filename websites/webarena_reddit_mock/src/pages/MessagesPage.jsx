import React from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import SLink from '../components/SLink.jsx'
import Time from '../components/Time.jsx'
import InboxNav from '../components/user/InboxNav.jsx'
import NotFound from './NotFound.jsx'
import OffsetPagination from '../components/user/OffsetPagination.jsx'
import { threadTitle, otherParticipants, lastMessage } from '../components/user/messages.js'
import { useApp } from '../context/AppContext.jsx'
import { formatNumber } from '../utils/format.js'
import '../components/user/user.css'

// ROUTES #84 — templates/message/threads.html.twig, transcribed from
// assets/html/messages-auth.html and
// assets/screenshots/reference/24-messages.png.
//
// The seed has ZERO message threads (TODO.md gap 8) and none are invented, so
// the empty state — `There are no messages to display.`, verbatim from
// `flash.no_messages` — is what boots. The table below renders once the user
// actually composes a message (ROUTES #86) or a task injects `messages`.
//
// Columns, in source order: Title | Last message | Replies | Participants.
// `Replies` is `messages|length - 1`. No sidebar on this view.

const PER_PAGE = 25

export default function MessagesPage() {
  const params = useParams()
  const { state } = useApp()

  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const me = state.currentUser.username

  const threads = [...(state.messages || [])].sort((a, b) => {
    const at = Date.parse((lastMessage(a) || {}).timestamp) || 0
    const bt = Date.parse((lastMessage(b) || {}).timestamp) || 0
    return bt - at
  })

  const pageCount = Math.max(1, Math.ceil(threads.length / PER_PAGE))
  const items = threads.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  // Postmill pages this with Pagerfanta, which throws NotFoundHttpException for
  // an out-of-range page. Confirmed live: GET /messages/2 -> 404 (page 1 -> 200).
  if (page > 1 && items.length === 0) return <NotFound />

  return (
    <Layout title="Messages">
      <InboxNav active="messages" />

      <h1 className="page-heading">Messages</h1>

      {items.length > 0 ? (
        <>
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th className="table__shrink">Last message</th>
                <th className="table__shrink">Replies</th>
                <th className="table__shrink">Participants</th>
              </tr>
            </thead>
            <tbody>
              {items.map(thread => (
                <tr key={thread.id}>
                  <td>
                    <strong>
                      <SLink to={`/messages/thread/${thread.id}`}>{threadTitle(thread)}</SLink>
                    </strong>
                  </td>
                  <td className="table__shrink text-align-right">
                    <Time iso={(lastMessage(thread) || {}).timestamp} />
                  </td>
                  <td className="table__shrink text-align-right">
                    {formatNumber(Math.max(0, (thread.messages || []).length - 1))}
                  </td>
                  <td className="table__shrink">
                    {otherParticipants(thread, me).map((p, i) => (
                      <React.Fragment key={p}>
                        {i > 0 && ', '}
                        <SLink to={`/user/${p}`}>{p}</SLink>
                      </React.Fragment>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <OffsetPagination
            page={page} pageCount={pageCount}
            hrefFor={n => `/messages${n > 1 ? `/${n}` : ''}`}
          />
        </>
      ) : (
        <p>
          <small className="fg-muted text-md">There are no messages to display.</small>
        </p>
      )}
    </Layout>
  )
}
