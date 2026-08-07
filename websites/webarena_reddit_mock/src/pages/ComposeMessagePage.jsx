import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import SLink, { useSidNavigate } from '../components/SLink.jsx'
import { FormRow, ButtonRow, useNativeValidation, ERR_BLANK } from '../components/forms/FormBits.jsx'
import UserSidebar from '../components/user/UserSidebar.jsx'
import { newUuid } from '../components/user/messages.js'
import RedirectWithQuery from '../components/RedirectWithQuery.jsx'
import NotFound from './NotFound.jsx'
import { useApp, nowIso } from '../context/AppContext.jsx'
import '../components/user/user.css'

// ROUTES #86 — templates/message/compose.html.twig + message/_form.html.twig +
// MessageController::compose.
//
// The form has exactly one field (MessageType has only `body`, labelled
// `label.message`) and one button (`action.send: Send`). On submit the source
// creates a MessageThread with the sender and receiver as participants, adds
// the message, and redirects to `/messages/thread/{id}` — reproduced here, with
// ?sid= carried by useSidNavigate.
//
// The thread has no title column: MessageThread::getTitle() derives it from the
// first line of the first message. See src/components/user/messages.js.
//
// Heading copy: compose_message.title — 'Composing a message to %username%',
// where %username% is a link to the user's profile.

/** ROUTES #87 — `/compose_message/{username}` 302s to #86 (verified live). */
export function ComposeMessageShortcut() {
  const { username } = useParams()
  return <RedirectWithQuery to={`/user/${username}/compose_message`} />
}

export default function ComposeMessagePage() {
  const { username } = useParams()
  const { state, getUser, setState } = useApp()
  const navigate = useSidNavigate()
  const [body, setBody] = useState('')
  const [errors, setErrors] = useState({})
  const formRef = useNativeValidation(setErrors)

  const receiver = getUser(username)
  if (!receiver) return <NotFound />

  const onSubmit = (e) => {
    e.preventDefault()
    // A whitespace-only body passes the browser's `required` but not Symfony's
    // NotBlank — render the same message the server would rather than no-op.
    if (!body.trim()) { setErrors({ body: [ERR_BLANK] }); return }
    setErrors({})
    const thread = {
      id: newUuid(),
      participants: [state.currentUser.username, receiver.username],
      messages: [{
        id: newUuid(),
        sender: state.currentUser.username,
        body,
        timestamp: nowIso()
      }]
    }
    setState(prev => ({ ...prev, messages: [...(prev.messages || []), thread] }))
    navigate(`/messages/thread/${thread.id}`)
  }

  return (
    <Layout
      title={`Composing a message to ${receiver.username}`}
      sidebar={<UserSidebar user={receiver} activeTool="compose_message" />}
    >
      <h1 className="page-heading">
        Composing a message to{' '}
        <SLink to={`/user/${receiver.username}`}>{receiver.username}</SLink>
      </h1>

      {/* message/_form.html.twig is a single `form_row(form.body, {rows: 6})`
          plus `button_row('action.send')`. MessageType declares no `help`, so
          there is NO markdown-help line here (`grep -ci markdown` on the
          rendered source page is 0), and `label.message` is required, so the
          label carries the `*` indicator. Verified against the container:
          `#main` innerText is exactly
          "Composing a message to smita16 / Message * / Send". */}
      <form ref={formRef} name="message" method="post" className="form flow" onSubmit={onSubmit}>
        <FormRow id="message_body" label="Message" required errors={errors.body}>
          <textarea
            id="message_body" name="message[body]" rows="6" required
            className="form-control"
            value={body} onChange={e => setBody(e.target.value)}
          />
        </FormRow>

        <ButtonRow label="Send" />
      </form>
    </Layout>
  )
}
