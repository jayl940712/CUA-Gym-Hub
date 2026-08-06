import React, { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { withGridParams } from '../../utils/gridUtils.js'

/**
 * The admin's scope switcher — `<button id="store-change-button">` over a
 * `.dropdown-menu` of store views, with the hidden `store_switcher` input the
 * source posts the chosen scope in.
 *
 * The source renders this on every scope-aware page (Dashboard, Categories,
 * Configuration, Custom Variables, …) and evaluators click it by
 * `#store-change-button`, so it lives here rather than being re-typed per page:
 * the same markup was already open-coded in three places and the pages that
 * missed it had no `#store-change-button` at all (DOM F-01).
 *
 * Picking a scope writes `?store=<id>` (dropped for All Store Views) through
 * `withGridParams`, so `?sid=` and any grid state ride along.
 */
export const STORE_SCOPES = [
  { value: '0', label: 'All Store Views', indent: 0 },
  { value: '1', label: 'Default Store View', indent: 2 },
]

export default function StoreScopeSwitcher({ label = 'Store View:', param = 'store' }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [open, setOpen] = useState(false)
  const current = searchParams.get(param) || '0'
  const currentLabel = STORE_SCOPES.find(s => s.value === current)?.label
    || STORE_SCOPES[0].label

  return (
    <div className={`store-switcher store-view${open ? ' _active' : ''}`}>
      <span className="store-switcher-label">{label}</span>
      <input type="hidden" id="store_switcher" name="store_switcher"
        data-ui-id="store-switcher" data-role="store-view-id"
        value={current === '0' ? '' : current} readOnly />
      <div className="admin__action-dropdown-wrap">
        <button type="button" id="store-change-button" className="admin__action-dropdown"
          aria-expanded={open} onClick={() => setOpen(o => !o)}>
          {currentLabel}
        </button>
        {open ? (
          <ul className="dropdown-menu store-switcher-alt" data-role="stores-list">
            {STORE_SCOPES.map(s => (
              <li key={s.value}
                className={s.indent ? 'store-switcher-store-view' : 'store-switcher-all'}>
                <span className="store-switcher-item" role="button" tabIndex={0}
                  onClick={() => {
                    setOpen(false)
                    setSearchParams(withGridParams(searchParams, {
                      [param]: s.value === '0' ? null : s.value,
                    }))
                  }}
                  onKeyDown={e => {
                    if (e.key !== 'Enter' && e.key !== ' ') return
                    e.preventDefault()
                    setOpen(false)
                    setSearchParams(withGridParams(searchParams, {
                      [param]: s.value === '0' ? null : s.value,
                    }))
                  }}>{s.label}</span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
