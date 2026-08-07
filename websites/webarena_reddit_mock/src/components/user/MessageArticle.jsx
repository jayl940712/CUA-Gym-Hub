import React from 'react'
import SLink from '../SLink.jsx'
import Time from '../Time.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { renderMarkdown } from '../../utils/markdown.js'
import { otherParticipants } from './messages.js'

// templates/message/_macros.html.twig `block message`, verbatim:
//
//   <article class="message" id="message_{id}">
//     <h1 class="message__head unheaderize">
//       <span class="fg-muted text-sm">{sender} wrote to {receivers} {timestamp}</span>
//     </h1>
//     <div class="message__body text-flow">…markdown…</div>
//     <form class="message__buttons">…Delete…</form>
//   </article>
//
// Copy: heading.message_thread ("%sender% wrote to %receiver% %timestamp%"),
// heading.message_reply ("%sender% replied %timestamp%"),
// action.delete, prompt.confirm_message_delete.

export default function MessageArticle({ message, thread, isReply = false, onDelete = null }) {
  const { state } = useApp()
  const receivers = thread ? otherParticipants(thread, message.sender) : []

  const senderLink = (
    <strong><SLink to={`/user/${message.sender}`} className="fg-inherit">{message.sender}</SLink></strong>
  )

  return (
    <article className="message" id={`message_${message.id}`}>
      <h1 className="message__head unheaderize">
        <span className="fg-muted text-sm">
          {isReply ? (
            <>{senderLink} replied <Time iso={message.timestamp} /></>
          ) : (
            <>
              {senderLink} wrote to{' '}
              {receivers.map((r, i) => (
                <React.Fragment key={r}>
                  {i > 0 && ', '}
                  <strong><SLink to={`/user/${r}`} className="fg-inherit">{r}</SLink></strong>
                </React.Fragment>
              ))}
              {' '}<Time iso={message.timestamp} />
            </>
          )}
        </span>
      </h1>

      <div
        className="message__body text-flow"
        dangerouslySetInnerHTML={{ __html: renderMarkdown(message.body || '') }}
      />

      {onDelete && message.sender === state.currentUser.username && (
        <form
          action={`/messages/message/${message.id}/delete`}
          method="POST"
          className="message__buttons"
          onSubmit={e => {
            e.preventDefault()
            if (window.confirm('Are you sure you want to delete this message?')) onDelete(message)
          }}
        >
          <button className="fg-muted text-sm unbuttonize" type="submit">Delete</button>
        </form>
      )}
    </article>
  )
}
