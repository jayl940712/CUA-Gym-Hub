import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { IssuableListBody, StateTabs } from './IssuablesList.jsx'
import { useQuery, issuableStateCounts } from './hooks.js'

// ROUTES #5 — `/dashboard/issues`. Five anchor URLs use `scope`, `state`,
// `assignee_username` and `milestone_title` (assets/README.md §5a).

export default function DashboardIssues() {
  const { state, currentUser, indexes } = useApp()
  const q = useQuery()
  usePageChrome({ title: 'Issues · Dashboard · GitLab' })

  const scope = q.get('scope', 'assigned_to_me')
  let rows = state.issues
  if (scope === 'assigned_to_me') rows = rows.filter(i => (i.assignee_ids || []).includes(currentUser.id))
  else if (scope === 'created_by_me') rows = rows.filter(i => i.author_id === currentUser.id)

  // DIFF-1304 — recomputed under the active filter, as the source does.
  const counts = issuableStateCounts(rows, q, indexes)

  return (
    <div>
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">Issues</h1>
      </div>
      <div className="top-area">
        <StateTabs counts={counts} basePath="/dashboard/issues" current={q.get('state', 'opened')} kind="issues" />
      </div>
      <IssuableListBody rows={rows} kind="issues" basePath="/dashboard/issues" showProject />
    </div>
  )
}
