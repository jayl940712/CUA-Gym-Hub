import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import UserPage from '../../components/user/UserPage.jsx'
import ListingCardList from '../../components/ListingCardList.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { getItem } from '../../data/catalog.js'
import { indexUrl } from '../../utils/urls.js'

/** `user.php:238` — `$itemsPerPage = Params('itemsPerPage') ?: 20`. */
const ITEMS_PER_PAGE = 20

export const DELETE_CONFIRM =
  'This action can not be undone. Are you sure you want to continue?'

/**
 * ROUTES #19 — `index.php?page=user&action=items`, "Manage my listings".
 *
 * Blake's ids live in `state.myItems`; anything he creates during a task lands
 * in `state.newItems`, and `state.deletedItemIds` removes rows from both.
 * Ordering is `dt_pub_date DESC` like the source's `findItemTypesByUserID`.
 */
export default function MyListings({ params = {} }) {
  const { state, sid } = useApp()
  const [items, setItems] = useState(null)

  const ownedKey = JSON.stringify([state.myItems, state.newItems.map(i => i.id), state.deletedItemIds])

  useEffect(() => {
    let live = true
    const deleted = new Set((state.deletedItemIds || []).map(Number))
    const ids = []
    for (const id of state.myItems || []) if (!deleted.has(Number(id))) ids.push(Number(id))
    for (const it of state.newItems || []) if (!deleted.has(Number(it.id))) ids.push(Number(it.id))

    Promise.all(ids.map(id => getItem(id, state))).then(found => {
      if (!live) return
      const rows = found.filter(Boolean)
      rows.sort((a, b) => (a.pub < b.pub ? 1 : a.pub > b.pub ? -1 : b.id - a.id))
      setItems(rows)
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ownedKey, state.itemOverrides])

  const rawPage = Number(params.iPage)
  const page = Number.isFinite(rawPage) && rawPage > 1 ? Math.floor(rawPage) : 1
  const total = items ? items.length : 0
  const lastPage = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE))
  const visible = items ? items.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE) : []

  function onDelete(e, id) {
    // The source's inline `onclick="javascript:return confirm('…')"`.
    if (!window.confirm(DELETE_CONFIRM)) {
      e.preventDefault()
      return
    }
    // Let the item_delete route own the mutation so a hand-typed URL behaves
    // identically to the link.
  }

  return (
    <UserPage title="Manage my listings - Classifieds" bodyClass="user user-items" crumb="Listings">
      <div className="list-header">
        <h1>My listings</h1>
        {items && total === 0 ? <p className="empty">No listings have been added yet</p> : null}
      </div>

      {items && total > 0 ? (
        <>
          <ListingCardList
            items={visible}
            showAs="list"
            extraClass="items"
            adminOptionsFor={item => (
              <span className="admin-options">
                <Link to={indexUrl({ page: 'item', action: 'item_edit', id: item.id }, sid)} rel="nofollow">Edit item</Link>
                <Link
                  className="delete"
                  to={indexUrl({ page: 'item', action: 'item_delete', id: item.id }, sid)}
                  onClick={e => onDelete(e, item.id)}
                >Delete</Link>
              </span>
            )}
          />
          <div className="clear"></div>
          <div className="paginate">
            <ul>
              {Array.from({ length: lastPage }, (_, i) => i + 1).map(p => (
                <li key={p}>
                  {p === page
                    ? <span className={`searchPaginationSelected${p === 1 ? ' list-first' : ''}`}>{p}</span>
                    : <Link
                        className={`searchPaginationNonSelected${p === 1 ? ' list-first' : ''}`}
                        to={indexUrl({ page: 'user', action: 'items', iPage: p > 1 ? p : undefined }, sid)}
                      >{p}</Link>}
                </li>
              ))}
            </ul>
          </div>
        </>
      ) : null}
    </UserPage>
  )
}
