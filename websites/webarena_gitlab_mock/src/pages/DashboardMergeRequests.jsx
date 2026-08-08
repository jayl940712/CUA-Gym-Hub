import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { IssuableListBody, StateTabs } from './IssuablesList.jsx'
import { useQuery, issuableStateCounts } from './hooks.js'

// ROUTES #6 — `/dashboard/merge_requests`.
// Anchors: `?assignee_username=byteblaze` (webarena-156) and
//          `?reviewer_username=byteblaze` (webarena-357).

export default function DashboardMergeRequests() {
  const { state, currentUser, indexes } = useApp()
  const q = useQuery()
  usePageChrome({ title: 'Merge requests · Dashboard · GitLab' })

  const scope = q.get('scope', null)
  const hasExplicitFilter = q.get('assignee_username') || q.get('reviewer_username') || q.get('author_username')

  let rows = state.mergeRequests
  if (!hasExplicitFilter) {
    if (scope === 'created_by_me') rows = rows.filter(m => m.author_id === currentUser.id)
    else if (scope !== 'all') rows = rows.filter(m => (m.assignee_ids || []).includes(currentUser.id))
  }

  // DIFF-1304 — recomputed under the active filter, as the source does.
  const counts = issuableStateCounts(rows, q, indexes)

  return (
    <div>
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">Merge requests</h1>
      </div>
      <div className="top-area">
        <StateTabs counts={counts} basePath="/dashboard/merge_requests"
          current={q.get('state', 'opened')} kind="merge_requests" />
      </div>
      <IssuableListBody rows={rows} kind="merge_requests" basePath="/dashboard/merge_requests" showProject />
    </div>
  )
}
