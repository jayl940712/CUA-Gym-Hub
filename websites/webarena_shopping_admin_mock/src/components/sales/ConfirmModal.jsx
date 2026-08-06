import React, { useCallback, useState } from 'react'

/**
 * Magento's confirmation dialog (`Magento_Ui/js/modal/confirm`, reached from the
 * admin's `confirmSetLocation()` helper). The source renders it **in the DOM**,
 * not as a native `window.confirm`, so the OK / Cancel buttons are real elements
 * an agent can click. Markup captured from the live source, invoice view →
 * `Send Email`:
 *
 *   <aside role="dialog" class="modal-popup confirm _show" data-role="modal" data-type="popup">
 *     <div class="modal-inner-wrap" data-role="focusable-scope">
 *       <header class="modal-header">
 *         <button class="action-close" data-role="closeBtn" type="button"><span>Close</span></button>
 *       </header>
 *       <div class="modal-content" data-role="content"><div>…question…</div></div>
 *       <footer class="modal-footer">
 *         <button class="action-secondary action-dismiss" type="button" data-role="action"><span>Cancel</span></button>
 *         <button class="action-primary action-accept" type="button" data-role="action"><span>OK</span></button>
 *       </footer>
 *     </div>
 *   </aside>
 *
 * Using `window.confirm` instead made every `Send Email` / `Send Tracking
 * Information` button look dead: a headless driver auto-dismisses native
 * dialogs, and an agent working over the DOM cannot reach them at all.
 */
export function useConfirm() {
  const [pending, setPending] = useState(null)

  const ask = useCallback((message, onAccept) => {
    setPending({ message, onAccept })
  }, [])

  const dismiss = useCallback(() => setPending(null), [])

  // Read the callback out first: React runs a functional updater during the
  // render phase, and navigating from there warns "Cannot update a component
  // while rendering a different component".
  const accept = useCallback(() => {
    const run = pending?.onAccept
    setPending(null)
    if (run) run()
  }, [pending])

  const node = pending ? (
    <div className="modals-wrapper">
      <div className="modals-overlay" onClick={dismiss} />
      <aside
        role="dialog"
        className="modal-popup confirm _show"
        data-role="modal"
        data-type="popup"
        tabIndex={0}
      >
        <div className="modal-inner-wrap" data-role="focusable-scope">
          <header className="modal-header">
            <button className="action-close" data-role="closeBtn" type="button" onClick={dismiss}>
              <span>Close</span>
            </button>
          </header>
          <div className="modal-content" data-role="content">
            <div>{pending.message}</div>
          </div>
          <footer className="modal-footer">
            <button
              className="action-secondary action-dismiss"
              type="button"
              data-role="action"
              onClick={dismiss}
            >
              <span>Cancel</span>
            </button>
            <button
              className="action-primary action-accept"
              type="button"
              data-role="action"
              onClick={accept}
            >
              <span>OK</span>
            </button>
          </footer>
        </div>
      </aside>
    </div>
  ) : null

  return [node, ask]
}
