import React from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import NotFound from '../NotFound.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { getOrder, getOrderComments } from '../../utils/selectors.js'
import { useSidNavigate } from '../../utils/navigation.js'
import { NoteList, CommentsBlock } from '../../components/sales/OrderBlocks.jsx'
import { fullOrderHistory } from '../../components/sales/orderHelpers.js'
import '../../components/sales/sales.css'

/* ROUTES.md rows 13 & 14 —
 *   /admin/sales/order/commentsHistory/order_id/:id/
 *   /admin/sales/order/commentsHistory/order_id/:id/active_tab/order_shipments/
 *
 * The source serves this as an AJAX fragment (assets/html/sales-order-comments-308.html:
 * a `.admin__page-section.edit-order-comments` holding `ul.note-list` and the
 * "Notes for this Order" block). Tasks 496-500 land on the `/active_tab/order_shipments/`
 * form of the URL and match text anywhere on the page, so the same fragment is
 * rendered for both — inside the admin shell, so the URL is also navigable.
 */

export default function OrderCommentsHistory() {
  const { id } = useParams()
  const { state } = useApp()
  const navigate = useSidNavigate()

  const order = getOrder(state, id)
  if (!order) return <NotFound />

  const items = fullOrderHistory(state, id, getOrderComments(state, id))

  const actions = (
    <div className="page-actions-buttons">
      <button
        id="back"
        title="Back"
        type="button"
        className="action-default scalable back"
        onClick={() => navigate(`/admin/sales/order/view/order_id/${id}/`)}
      >
        <span>Back</span>
      </button>
    </div>
  )

  return (
    <PageShell title={`#${order.increment_id}`} documentTitle={`#${order.increment_id}`} actions={actions}>
      {/* DIFF-S02. history.phtml puts `ul.note-list` FIRST and the
          `Notes for this Order` block after it; the round-2 reordering was a
          readability call taken while the list was always empty, and it is not
          what the source renders. */}
      <section className="admin__page-section edit-order-comments" id="order_history_block">
        <NoteList items={items} />
        <CommentsBlock items={items} />
      </section>
    </PageShell>
  )
}
