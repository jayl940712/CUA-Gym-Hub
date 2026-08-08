import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery, issuableStateCounts } from './hooks.js'
import { IssuableListBody, StateTabs, NavControls, NoIssuablesEmptyState } from './IssuablesList.jsx'

// ROUTES #69 — `/:ns/:proj/-/issues` (and `/-/issues/`, the trailing-slash
// form 12 anchor URLs use — React Router matches both).
//
// ⚠️ §13.1: there is NO `<h1>Issues</h1>` on this page in GitLab 15.7. The page
// is identified by the breadcrumb and the active sidebar item. Do not add one.

export default function IssuesList() {
  const { state, indexes } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  const [bulkMode, setBulkMode] = useState(false)

  usePageChrome({
    title: project
      ? `Issues · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
  })
  if (!project) return <NotFound />

  const rows = state.issues.filter(i => i.project_id === project.id)
  const basePath = `${base}/-/issues`

  // §13b.3 — with zero issues the whole `.top-area`, the search bar and the
  // pager are absent; only the empty state renders.
  if (rows.length === 0) return <NoIssuablesEmptyState newHref={`${basePath}/new`} kind="issues" />

  // DIFF-1304 — recomputed under the active filter, as the source does.
  const counts = issuableStateCounts(rows, q, indexes)

  return (
    <div>
      <div className="top-area">
        <StateTabs counts={counts} basePath={basePath} current={q.get('state', 'opened')} kind="issues" />
        <NavControls basePath={basePath} kind="issues" onToggleBulk={() => setBulkMode(b => !b)} />
      </div>
      <IssuableListBody rows={rows} kind="issues" project={project} basePath={basePath} bulkMode={bulkMode} />
    </div>
  )
}
