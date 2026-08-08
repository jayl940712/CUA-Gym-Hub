import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { indexUrl } from '../../utils/urls.js'

/**
 * ROUTES #32 — `index.php?page=item&action=delete_comment&id=N&comment=C`.
 *
 * The source (CWebItem::doModel, case 'delete_comment') deletes the row only if
 * the logged-in user authored it, then redirects to `osc_item_url()` with one of
 * these flashes:
 *
 *   comment missing              -> error  "The comment doesn't exist"
 *   authored by somebody else    -> error  "The comment was not added by you, you cannot delete it"
 *   deleted                      -> ok     "The comment has been deleted"
 *
 * Replies to a deleted comment go with it (the row's children are orphaned on
 * the source; the mock drops them so the list stays consistent).
 */
export default function DeleteComment({ params }) {
  const { state, setState, sid } = useApp()
  const navigate = useNavigate()
  const done = useRef(false)

  const itemId = params.id
  const commentId = Number(params.comment)

  useEffect(() => {
    if (done.current) return
    done.current = true

    const comments = state.comments || []
    const target = comments.find(c => Number(c.id) === commentId)
    const userId = state.user ? state.user.id : null

    let flash
    if (!target) {
      flash = { type: 'error', msg: "The comment doesn't exist" }
    } else if (Number(target.userId) !== Number(userId)) {
      flash = { type: 'error', msg: 'The comment was not added by you, you cannot delete it' }
    } else {
      flash = { type: 'ok', msg: 'The comment has been deleted' }
      setState(prev => ({
        ...prev,
        comments: (prev.comments || []).filter(
          c => Number(c.id) !== commentId && Number(c.replyId) !== commentId
        )
      }))
    }

    navigate(indexUrl({ page: 'item', id: itemId }, sid), { replace: true, state: { flash } })
  }, [commentId, itemId, sid, state, setState, navigate])

  return null
}
