import React from 'react'
import { useApp } from '../context/AppContext.jsx'

/** .message-success bar at the top of .page-main after every mutation. */
export default function Messages() {
  const { messages } = useApp()
  if (!messages.length) return null
  return (
    <div className="messages">
      {messages.map(m => (
        <div key={m.id} className={`message message-${m.type} ${m.type}`} role="alert">
          <div data-ui-id={`message-${m.type}`}>{m.node || m.text}</div>
        </div>
      ))}
    </div>
  )
}
