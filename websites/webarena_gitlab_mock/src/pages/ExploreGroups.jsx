import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { useQuery } from './hooks.js'
import GroupsList, { SearchEmptyState, sortGroups } from './GroupsList.jsx'
import { GroupsToolbar } from './DashboardGroups.jsx'
import '../components/create/create.css'

// ROUTES #19 — `/explore/groups`. assets/README.md §6c.
//
// The seed has exactly two groups and only `robert1003` is public, so this page
// renders one row until a task creates more. Public groups created through
// /groups/new appear here immediately (§6c.3 point 4).

export default function ExploreGroups() {
  const { state } = useApp()
  const q = useQuery()
  const [bannerHidden, setBannerHidden] = useState(false)

  usePageChrome({ title: 'Groups · Explore · GitLab' })

  if (!state) return null

  const filter = q.get('filter', '') || ''
  const sort = q.get('sort', 'created_desc')

  let rows = state.groups.filter(g => g.visibility === 'public')
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
      <GroupsToolbar action="/explore/groups" activeTab="explore"
        filter={filter} onFilter={v => setParam('filter', v)}
        sort={sort} onSort={v => setParam('sort', v)} />

      <div className={`explore-groups landing content-block js-explore-groups-landing${bannerHidden ? ' hide' : ''}`}>
        <button type="button" className="dismiss-button btn gl-button btn-default-tertiary btn-icon"
          aria-label="Dismiss" onClick={() => setBannerHidden(true)}>×</button>
        <p>Below you will find all the groups that are public.</p>
        <p>You can easily contribute to them by requesting to join these groups.</p>
      </div>

      {rows.length ? <GroupsList state={state} groups={rows} /> : <SearchEmptyState />}
    </div>
  )
}
