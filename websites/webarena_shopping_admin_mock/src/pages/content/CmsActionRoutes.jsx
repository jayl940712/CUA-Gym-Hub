import React, { useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { useSidNavigate } from '../../utils/navigation.js'

/**
 * Content > Pages / Blocks — the grid's Select > Delete row action
 * (PARITY-010 rows 101 and 104).
 *
 * The source deletes through a plain GET on `/admin/cms/{page,block}/delete/…`
 * and then 302s back to the grid with a success message, so these are routes,
 * not buttons. Modelled on `src/pages/sales/OrderActionRoutes.jsx`.
 *
 * The mutation runs in an effect guarded by a ref because React 18 StrictMode
 * mounts effects twice in dev — without the guard the second pass would try to
 * delete an already-deleted record and push a second success message.
 */
function useDeleteAndReturn({ collection, idField, id, message, backTo }) {
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const done = useRef(false)

  useEffect(() => {
    if (done.current || !state) return
    done.current = true
    const exists = (state[collection] || []).some(r => String(r[idField]) === String(id))
    if (exists) {
      setState(prev => ({
        ...prev,
        [collection]: (prev[collection] || []).filter(r => String(r[idField]) !== String(id)),
      }))
      addMessage(message)
    } else {
      addMessage('This record no longer exists.', 'error')
    }
    navigate(backTo)
  }, [state])

  return null
}

export function CmsPageDelete() {
  const { id } = useParams()
  return useDeleteAndReturn({
    collection: 'cmsPages', idField: 'page_id', id,
    message: 'You deleted the page.', backTo: '/admin/cms/page/',
  })
}

export function CmsBlockDelete() {
  const { id } = useParams()
  return useDeleteAndReturn({
    collection: 'cmsBlocks', idField: 'block_id', id,
    message: 'You deleted the block.', backTo: '/admin/cms/block/',
  })
}
