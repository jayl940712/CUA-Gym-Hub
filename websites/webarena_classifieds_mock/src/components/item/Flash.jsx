import React, { useState } from 'react'

/**
 * The source's one-shot session flash, rendered by `osc_show_flash_message()`
 * into `.wrapper.wrapper-flash.flash2` (theme `header.php` line 121):
 *
 *   <div id="flash_js"></div>
 *   <div id="flashmessage" class="flashmessage flashmessage-ok">
 *     <a class="btn ico btn-mini ico-close">x</a>Your comment has been approved
 *   </div>
 *
 * `type` is one of ok | error | info | warning (the `.flashmessage-*` variants
 * in style.css lines 256-259).
 *
 * In the mock the message rides on react-router's location state, so it survives
 * the post-action redirect exactly once and disappears on reload — the same
 * lifetime the PHP session flash has.
 */
export default function Flash({ flash }) {
  const [dismissed, setDismissed] = useState(false)
  if (!flash || !flash.msg || dismissed) return null
  const type = flash.type || 'ok'
  return (
    <>
      <div id="flash_js"></div>
      <div id="flashmessage" className={`flashmessage flashmessage-${type}`}>
        <a className="btn ico btn-mini ico-close" onClick={() => setDismissed(true)}>x</a>
        {flash.msg}
      </div>
    </>
  )
}
