import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

/**
 * `osc_show_flash_message()` output, rendered where the source puts it —
 * inside `<div class="wrapper wrapper-flash flash2">`, which `Layout` emits
 * empty on every page:
 *
 *   <div id="flash_js"></div>
 *   <div id="flashmessage" class="flashmessage flashmessage-ok">
 *     <a class="btn ico btn-mini ico-close">x</a>Your profile has been updated successfully
 *   </div>
 *
 * `Layout` is a shared file this shard does not own, so the node is portalled
 * into that container after mount instead of being passed down as a prop.
 *
 * Props: message (string), type ('ok' | 'error' | 'warning' | 'info')
 */
export default function Flash({ message, type = 'ok' }) {
  const [host, setHost] = useState(null)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setHost(document.querySelector('.wrapper-flash.flash2'))
  }, [])

  useEffect(() => { setDismissed(false) }, [message])

  if (!message || !host || dismissed) return null

  return createPortal(
    <>
      <div id="flash_js"></div>
      <div id="flashmessage" className={`flashmessage flashmessage-${type}`}>
        <a className="btn ico btn-mini ico-close" onClick={() => setDismissed(true)}>x</a>
        {message}
      </div>
    </>,
    host
  )
}
