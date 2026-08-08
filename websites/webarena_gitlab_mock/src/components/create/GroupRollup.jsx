import React from 'react'
import { useParams, Link } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import NotFound from '../../pages/NotFound.jsx'
import { usePageChrome } from '../layout/Layout.jsx'
import TimeAgo from '../layout/TimeAgo.jsx'
import { formatDateRange } from '../../utils/format.js'
import './create.css'

// ROUTES #122 — the group-scoped rollups the group sidebar links to
// (`/groups/:group/-/{activity,issues,merge_requests,milestones,labels,boards,packages}`).
//
// P2 and unanchored, but the sidebar links here, so each one renders the real
// aggregate over the group's projects rather than a dead page. A freshly
// created group has no projects, which is exactly the empty state the source
// shows.

const TITLES = {
  activity: 'Activity',
  issues: 'Issues',
  merge_requests: 'Merge requests',
  milestones: 'Milestones',
  labels: 'Labels',
  boards: 'Issue Boards',
  packages: 'Package Registry',
}

function EmptyState({ heading, body }) {
  return (
    <div className="empty-state gl-empty-state">
      <div className="gl-empty-state-content">
        <h4>{heading}</h4>
        {body ? <p>{body}</p> : null}
      </div>
    </div>
  )
}

export default function GroupRollup({ section }) {
  const { group: slug } = useParams()
  const { state, indexes } = useApp()

  const group = state ? state.groups.find(g => g.path === slug) : null
  usePageChrome({ title: `${TITLES[section]} · ${group ? group.name : slug} · GitLab` })

  if (!state) return null
  // AUDIT P2-4 — a group that is neither seeded nor in state 404s, as on the
  // source. Task-created groups are in `state.groups` before this renders.
  if (!group) return <NotFound />

  const projects = state.projects.filter(p => p.namespace && p.namespace.path === slug)
  const projectIds = new Set(projects.map(p => p.id))
  const pathOf = id => (indexes.projectsById.get(id) || {}).full_path || ''

  let body = null

  if (section === 'issues' || section === 'merge_requests') {
    const rows = (section === 'issues' ? state.issues : state.mergeRequests)
      .filter(r => projectIds.has(r.project_id) && r.state === 'opened')
    body = rows.length ? (
      <ul className="content-list issuable-list">
        {rows.map(r => (
          <li key={`${r.project_id}-${r.iid}`} className="issue">
            <div className="issue-title-text">
              <Link to={`/${pathOf(r.project_id)}/-/${section === 'issues' ? 'issues' : 'merge_requests'}/${r.iid}`}>
                {r.title}
              </Link>
            </div>
            <div className="issuable-info gl-text-gray-500 gl-font-sm">
              {pathOf(r.project_id)}#{r.iid} · created <TimeAgo value={r.created_at} />
            </div>
          </li>
        ))}
      </ul>
    ) : (
      <EmptyState
        heading={section === 'issues' ? 'There are no open issues' : 'There are no open merge requests'}
        body="To keep this project going, create a new issue" />
    )
  } else if (section === 'milestones') {
    const rows = state.milestones.filter(m => projectIds.has(m.project_id))
    body = rows.length ? (
      <ul className="content-list">
        {rows.map(m => (
          <li key={m.id}>
            <Link to={`/${pathOf(m.project_id)}/-/milestones/${m.iid}`}>{m.title}</Link>
            <div className="gl-text-gray-500 gl-font-sm">{formatDateRange(m.start_date, m.due_date)}</div>
          </li>
        ))}
      </ul>
    ) : <EmptyState heading="Use milestones to track issues and merge requests over a fixed period of time" />
  } else if (section === 'labels') {
    const rows = state.labels.filter(l => projectIds.has(l.project_id))
    body = rows.length ? (
      <ul className="content-list">
        {rows.map(l => (
          <li key={l.id}>
            <span className="gl-label">
              <span className="gl-label-text" style={{ background: l.color, color: '#fff', padding: '2px 8px', borderRadius: 10 }}>
                {l.title}
              </span>
            </span>
          </li>
        ))}
      </ul>
    ) : <EmptyState heading="Manage labels" body="Labels can be applied to issues and merge requests." />
  } else if (section === 'activity') {
    body = <EmptyState heading="No activity to display" />
  } else if (section === 'boards') {
    body = <EmptyState heading="There are no issues to show" body="Issues can be planned in a sprint or added to a milestone." />
  } else {
    body = (
      <EmptyState heading="There are no packages yet"
        body="Learn how to publish and share your packages with GitLab." />
    )
  }

  return (
    <div className="create-flow">
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">{TITLES[section]}</h1>
      </div>
      {body}
    </div>
  )
}
