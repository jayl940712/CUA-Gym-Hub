import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery, issuableStateCounts } from './hooks.js'
import { IssuableListBody, StateTabs, NavControls, NoIssuablesEmptyState } from './IssuablesList.jsx'

// ROUTES #78 — `/:ns/:proj/-/merge_requests`. assets/README.md §15a.
// Anchor route for webarena-666/667 (primer/design) and 668/806 (a11yproject):
// each of those starts a create-MR flow from this page.

export default function MergeRequestsList() {
  const { state, indexes } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  const [bulkMode, setBulkMode] = useState(false)

  usePageChrome({
    title: project
      ? `Merge requests · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
  })
  if (!project) return <NotFound />

  const rows = state.mergeRequests.filter(m => m.project_id === project.id)
  const basePath = `${base}/-/merge_requests`

  // §15a: with zero merge requests the tab strip and filter bar are not
  // rendered at all — only the empty state.
  if (rows.length === 0) return <NoIssuablesEmptyState newHref={`${basePath}/new`} kind="merge_requests" />

  // DIFF-1304 — recomputed under the active filter, as the source does.
  const counts = issuableStateCounts(rows, q, indexes)

  return (
    <div>
      <div className="top-area">
        <StateTabs counts={counts} basePath={basePath} current={q.get('state', 'opened')} kind="merge_requests" />
        <NavControls basePath={basePath} kind="merge_requests" onToggleBulk={() => setBulkMode(b => !b)} />
      </div>
      <IssuableListBody rows={rows} kind="merge_requests" project={project}
        basePath={basePath} bulkMode={bulkMode} />
    </div>
  )
}
