import React from 'react'
import { useApp } from '../../context/AppContext.jsx'

/**
 * `.messages` block at the top of `.page-main-actions` (SOURCE.md §4).
 * Yellow `#fffbbb` body shared by every severity; the left glyph carries the
 * severity colour (DESIGN.md §5 "Messages").
 */
export default function MessagesBanner() {
  const { messages, dismissMessage } = useApp()
  if (!messages.length) return null
  return (
    <div className="messages">
      {messages.map(m => (
        <div key={m.id} className={`message message-${m.type} ${m.type}`}>
          <span className="message__text">{m.text}</span>
          <button
            type="button"
            className="message__close"
            title="Close"
            aria-label="Close message"
            onClick={() => dismissMessage(m.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}
