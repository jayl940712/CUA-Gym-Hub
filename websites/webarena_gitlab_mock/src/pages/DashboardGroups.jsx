import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import { useQuery } from './hooks.js'
import GroupsList, { GROUP_SORTS, SearchEmptyState, sortGroups } from './GroupsList.jsx'
import '../components/create/create.css'

// ROUTES #4 — `/dashboard/groups`. assets/README.md §4a.
//
// byteblaze belongs to no group in the seed, so the source renders the empty
// state below. Groups created by webarena-799…803 DO appear here, because
// creating one makes byteblaze its Owner (components/create/mutations.js).

/** §4a.5 / §6c.5 — the shared listbox, shown on both group listings. */
export function GroupSortDropdown({ value, onSelect }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return undefined
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  const current = GROUP_SORTS.find(([v]) => v === value) || GROUP_SORTS[2]
  return (
    <div data-testid="group_sort_by_dropdown" ref={ref}>
      <div className={`gl-dropdown dropdown btn-group js-redirect-listbox${open ? ' show' : ''}`}>
        <button type="button" data-testid="base-dropdown-toggle" aria-haspopup="listbox"
          className="btn btn-default btn-md gl-button gl-dropdown-toggle dropdown-toggle"
          onClick={() => setOpen(o => !o)}>
          <span className="gl-button-text">
            <span className="gl-dropdown-button-text">{current[1]}</span>
            <Icon name="chevron-down" />
          </span>
        </button>
        <div className="dropdown-menu dropdown-menu-right" data-testid="base-dropdown-menu">
          <div className="gl-dropdown-inner">
            <ul className="gl-dropdown-contents list-unstyled gl-mb-0" id="listbox">
              {GROUP_SORTS.map(([v, label]) => (
                <li role="option" key={v} aria-selected={v === current[0]}
                  className="gl-dropdown-item gl-listbox-item">
                  <button type="button" className="dropdown-item"
                    onClick={() => { setOpen(false); onSelect(v) }}>
                    <span className="gl-dropdown-item-text-wrapper">{label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Header + tabs + search + sort, identical on both group listings. */
export function GroupsToolbar({ action, activeTab, filter, onFilter, sort, onSort }) {
  return (
    <>
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">Groups</h1>
        <div className="page-title-controls">
          <a className="gl-button btn btn-md btn-confirm" data-testid="new-group-button"
            data-qa-selector="new_group_button" href="/groups/new">
            <span className="gl-button-text">New group</span>
          </a>
        </div>
      </div>

      <div className="top-area">
        <ul className="gl-flex-grow-1 gl-border-0 nav gl-tabs-nav">
          <li className="nav-item">
            <a className={`nav-link gl-tab-nav-item${activeTab === 'yours' ? ' active gl-tab-nav-item-active' : ''}`}
              href="/dashboard/groups">Your groups</a>
          </li>
          <li className="nav-item">
            <a className={`nav-link gl-tab-nav-item${activeTab === 'explore' ? ' active gl-tab-nav-item-active' : ''}`}
              data-qa-selector="public_groups_tab" href="/explore/groups">Explore public groups</a>
          </li>
        </ul>
        <div className="nav-controls">
          <form className="group-filter-form js-group-filter-form" id="group-filter-form"
            action={action} method="get" onSubmit={e => e.preventDefault()}>
            <input type="search" name="filter" id="group-filter-form-field" placeholder="Search by name"
              className="group-filter-form-field form-control js-groups-list-filter"
              data-qa-selector="groups_filter_field" spellCheck="false"
              value={filter} onChange={e => onFilter(e.target.value)} />
          </form>
          <GroupSortDropdown value={sort} onSelect={onSort} />
        </div>
      </div>
    </>
  )
}

export default function DashboardGroups() {
  const { state, currentUser } = useApp()
  const q = useQuery()

  usePageChrome({ title: 'Groups · Dashboard · GitLab' })

  if (!state) return null

  const filter = q.get('filter', '') || ''
  const sort = q.get('sort', 'created_desc')

  const memberGroupIds = new Set(state.members
    .filter(m => m.source_type === 'namespace' && m.user_id === currentUser.id)
    .map(m => m.source_id))
  let rows = state.groups.filter(g => memberGroupIds.has(g.id))
  const needle = filter.trim().toLowerCase()
  if (needle) rows = rows.filter(g => g.name.toLowerCase().includes(needle) || g.path.toLowerCase().includes(needle))
  rows = sortGroups(rows, sort)

  function setParam(key, value) {
    q.setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  return (
    <div>
      <GroupsToolbar action="/dashboard/groups" activeTab="yours"
        filter={filter} onFilter={v => setParam('filter', v)}
        sort={sort} onSort={v => setParam('sort', v)} />

      {rows.length ? <GroupsList state={state} groups={rows} />
        : needle ? <SearchEmptyState />
          : (
            /* §4a.6 — verbatim, including the U+2019 apostrophe in "member’s". */
            <div className="empty-state">
              <div className="row gl-align-items-center gl-justify-content-center">
                <div className="text-content order-md-1">
                  <h4>A group is a collection of several projects.</h4>
                  <p>If you organize your projects under a group, it works like a folder.</p>
                  <p>You can manage your group member’s permissions and access to each project in the group.</p>
                </div>
              </div>
            </div>
          )}
    </div>
  )
}
