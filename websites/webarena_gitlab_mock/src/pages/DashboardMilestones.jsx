import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { useQuery } from './hooks.js'
import { MilestoneRow, MilestoneTabs, sortMilestones } from './MilestonesList.jsx'

// ROUTES #12 — `/dashboard/milestones`. assets/README.md §16b: same rows as the
// project list, with ` - Project Milestone` appended after the title link and
// the counts pointing at `/dashboard/issues?milestone_title=…`.

export default function DashboardMilestones() {
  const { state, indexes, currentUser } = useApp()
  const q = useQuery()
  usePageChrome({ title: 'Milestones · Dashboard · GitLab' })

  // The dashboard shows milestones of projects the user is a member of, plus
  // anything in their own namespace.
  const memberProjectIds = new Set(state.members
    .filter(m => String(m.source_type).toLowerCase() === 'project' && m.user_id === currentUser.id)
    .map(m => m.source_id))
  for (const p of state.projects) {
    if (p.full_path.split('/')[0] === currentUser.username) memberProjectIds.add(p.id)
  }

  const all = state.milestones
    .filter(m => memberProjectIds.has(m.project_id))
    .map(m => ({ milestone: m, project: indexes.projectsById.get(m.project_id) }))
    .filter(r => r.project)

  const tab = q.get('state', 'opened')
  const sort = q.get('sort', 'due_date_asc')
  const counts = {
    opened: all.filter(r => r.milestone.state !== 'closed').length,
    closed: all.filter(r => r.milestone.state === 'closed').length,
    all: all.length,
  }
  const filtered = tab === 'closed' ? all.filter(r => r.milestone.state === 'closed')
    : tab === 'all' ? all
      : all.filter(r => r.milestone.state !== 'closed')
  const order = sortMilestones(filtered.map(r => r.milestone), sort)
  const rows = order.map(m => filtered.find(r => r.milestone.id === m.id)).filter(Boolean)

  return (
    <div>
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">Milestones</h1>
        <div className="page-title-controls">
          <button type="button" className="btn gl-button btn-confirm">Select project to create milestone</button>
        </div>
      </div>

      <div className="top-area">
        <MilestoneTabs counts={counts} basePath="/dashboard/milestones" current={tab} />
      </div>

      {rows.length === 0 ? (
        <div className="row empty-state"><div className="gl-empty-state-content">
          <h4>Use milestones to track issues and merge requests over a fixed period of time</h4>
          <p className="state-description">
            Organize issues and merge requests into a cohesive group, and set optional start and due dates.{' '}
            <a href="/help/user/project/milestones/index">Learn more.</a></p>
        </div></div>
      ) : (
        <div className="milestones">
          <ul className="content-list">
            {rows.map(r => (
              <MilestoneRow key={r.milestone.id} milestone={r.milestone} project={r.project} dashboard />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
