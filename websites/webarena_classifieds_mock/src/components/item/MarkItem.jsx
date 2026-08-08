import React, { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { indexUrl } from '../../utils/urls.js'

/** The five values the sidebar's `select.mark_as` can submit. */
export const MARK_VALUES = ['spam', 'badcat', 'repeated', 'expired', 'offensive']

/**
 * ROUTES #36 — `index.php?page=item&action=mark&id=N&as=<value>`.
 *
 * The source records the mark and redirects to the item with the flash
 * `Thanks! That's very helpful` (CWebItem::doModel, case 'mark'). Nothing else
 * about the page changes.
 */
export default function MarkItem({ params }) {
  const { setState, sid } = useApp()
  const navigate = useNavigate()
  const done = useRef(false)

  const itemId = params.id
  const as = params.as || ''

  useEffect(() => {
    if (done.current) return
    done.current = true

    if (MARK_VALUES.includes(as)) {
      setState(prev => ({
        ...prev,
        marks: [
          ...(prev.marks || []),
          { itemId: Number(itemId), as, userId: prev.user ? prev.user.id : null }
        ]
      }))
    }

    navigate(indexUrl({ page: 'item', id: itemId }, sid), {
      replace: true,
      state: { flash: { type: 'ok', msg: "Thanks! That's very helpful" } }
    })
  }, [itemId, as, sid, setState, navigate])

  return null
}
