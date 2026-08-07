import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import MarkdownHelp from '../components/MarkdownHelp.jsx'
import MessageArticle from '../components/user/MessageArticle.jsx'
import { threadTitle, newUuid } from '../components/user/messages.js'
import RedirectWithQuery from '../components/RedirectWithQuery.jsx'
import { useSidNavigate } from '../components/SLink.jsx'
import NotFound from './NotFound.jsx'
import { useApp, nowIso } from '../context/AppContext.jsx'
import '../components/user/user.css'

// ROUTES #85 / #88 / #89 — templates/message/thread.html.twig +
// message/_form.html.twig + MessageController::{thread,reply,deleteMessage}.
//
// The heading is the thread title (MessageThread::getTitle() — the first line
// of the first message; there is no stored title column). The first message
// renders with `heading.message_thread` ("%sender% wrote to %receiver%
// %timestamp%") and every later one with `heading.message_reply`
// ("%sender% replied %timestamp%").
//
// The reply form is `MessageType`, which has exactly one field — `body`,
// labelled `label.message` — and a `action.send` button. Posting appends to
// the thread (ROUTES #88 `/message_reply/{id}`); ?sid= rides along because the
// mutation goes through the context.
//
// The seed has no threads, so this route is only reachable after
// /user/<name>/compose_message or a state injection. An unknown id 404s, which
// is what the source does.

/**
 * ROUTES #88 — `/message_reply/{id}` is POST-only on the source (the reply form
 * on the thread page targets it). A navigation to it lands on the thread, where
 * the reply box lives.
 */
export function MessageThreadRedirect() {
  const { id } = useParams()
  return <RedirectWithQuery to={`/messages/thread/${id}`} />
}

export default function MessageThreadPage() {
  const { id } = useParams()
  const { state, setState } = useApp()
  const navigate = useSidNavigate()
  const [body, setBody] = useState('')

  const thread = (state.messages || []).find(t => String(t.id) === String(id))
  if (!thread) return <NotFound />

  const title = threadTitle(thread)

  const onReply = (e) => {
    e.preventDefault()
    if (!body.trim()) return
    const message = {
      id: newUuid(),
      sender: state.currentUser.username,
      body,
      timestamp: nowIso()
    }
    setState(prev => ({
      ...prev,
      messages: (prev.messages || []).map(t => String(t.id) === String(thread.id)
        ? { ...t, messages: [...t.messages, message] }
        : t)
    }))
    setBody('')
  }

  // MessageController::delete() (container src/Controller/MessageController.php
  // :110-132): remove the message, and if the thread is now empty `$em->remove`
  // the thread and `redirectToRoute('message_threads')` => /messages. Only when
  // the thread survives does it redirect back to the thread. Deleting the LAST
  // message previously left the agent parked on /messages/thread/{uuid}, which
  // then rendered `Page not found` because the thread was gone (TEST BUG-B02).
  const onDelete = (message) => {
    const lastOne = (thread.messages || []).length <= 1
    setState(prev => ({
      ...prev,
      messages: (prev.messages || [])
        .map(t => String(t.id) === String(thread.id)
          ? { ...t, messages: t.messages.filter(m => String(m.id) !== String(message.id)) }
          : t)
        // Postmill drops a thread once its last message is gone.
        .filter(t => t.messages.length > 0)
    }))
    // The source has no flash for this action (no `flash.message_deleted` key
    // in messages.en.yml) — do not invent one.
    if (lastOne) navigate('/messages', { replace: true })
  }

  return (
    <Layout title={title}>
      <h1 className="page-heading">{title}</h1>

      <div className="message-listing flow">
        {thread.messages.map((message, i) => (
          <MessageArticle
            key={message.id}
            message={message}
            thread={thread}
            isReply={i > 0}
            onDelete={onDelete}
          />
        ))}
      </div>

      <form name="message" method="post" action={`/message_reply/${thread.id}`}
            className="form flow" onSubmit={onReply}>
        <div className="flow-slim">
          <div className="form-flex--stretch form-flex form__row">
            <label htmlFor="message_body">Message</label>
            <textarea
              id="message_body" name="message[body]" rows="6" required
              className="flex__grow form-control"
              value={body} onChange={e => setBody(e.target.value)}
            />
          </div>
          <MarkdownHelp />
        </div>

        <div className="form__row form__button-row">
          <button className="button" type="submit">Send</button>
        </div>
      </form>
    </Layout>
  )
}
