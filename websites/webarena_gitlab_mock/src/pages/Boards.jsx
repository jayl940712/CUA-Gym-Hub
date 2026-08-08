import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import { LabelChip } from '../components/issuable/Controls.jsx'

// ROUTES #75 — `/:ns/:proj/-/boards`. The default board in GitLab CE is
// Open / Closed, with a card per issue. Cards link to the issue, so the board
// is a real navigation surface rather than a dead page.

function Card({ issue, project, indexes }) {
  const labels = (issue.label_ids || []).map(id => indexes.labelsById.get(id)).filter(Boolean)
  const assignees = (issue.assignee_ids || []).map(id => indexes.usersById.get(id)).filter(Boolean)
  return (
    <li className="board-card gl-mb-3" data-issue-id={issue.id}
      style={{ background: '#fff', border: '1px solid var(--border-default, #dcdcde)', borderRadius: 4, padding: 8 }}>
      <div className="board-card-header">
        <a className="js-no-trigger" href={`/${project.full_path}/-/issues/${issue.iid}`}>{issue.title}</a>
      </div>
      <div className="board-card-footer gl-display-flex gl-align-items-center gl-mt-2" style={{ gap: 4, flexWrap: 'wrap' }}>
        <span className="board-card-number gl-text-gray-500 gl-font-sm">#{issue.iid}</span>
        {labels.map(l => <LabelChip key={l.id} label={l} />)}
        <span className="gl-ml-auto gl-display-flex" style={{ gap: 4 }}>
          {assignees.map(a => <UserAvatar key={a.id} user={a} size={24} />)}
        </span>
      </div>
    </li>
  )
}

export default function Boards() {
  const { state, indexes } = useApp()
  const { project, base } = useProject()
  usePageChrome({
    title: project
      ? `Issue Boards · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    breadcrumbExtra: [{ text: 'Boards', href: `${base}/-/boards` }],
  })
  if (!project) return <NotFound />

  const issues = state.issues.filter(i => i.project_id === project.id)
  const lists = [
    ['Open', issues.filter(i => i.state === 'opened')],
    ['Closed', issues.filter(i => i.state === 'closed')],
  ]

  return (
    <div className="boards-app">
      <div className="top-area">
        <h1 className="page-title gl-font-size-h-display">Development</h1>
        <div className="nav-controls">
          <a className="btn gl-button btn-confirm" href={`${base}/-/issues/new`}>New issue</a>
        </div>
      </div>

      <div className="boards-list gl-display-flex gl-mt-3" style={{ gap: 16, alignItems: 'flex-start' }}>
        {lists.map(([name, rows]) => (
          <div className="board" key={name} style={{ flex: 1, minWidth: 260 }}>
            <div className="board-inner" style={{ background: 'var(--gray-10, #fbfafd)', borderRadius: 4, padding: 8 }}>
              <header className="board-header gl-display-flex gl-align-items-center gl-mb-3">
                <h3 className="board-title gl-m-0 gl-font-base">{name}</h3>
                <span className="gl-badge badge badge-pill badge-muted sm gl-ml-2">{rows.length}</span>
              </header>
              <ul className="board-list list-unstyled gl-p-0">
                {rows.slice(0, 20).map(i => (
                  <Card key={i.id} issue={i} project={project} indexes={indexes} />
                ))}
                {rows.length === 0 ? <li className="gl-text-gray-500 gl-font-sm">No issues</li> : null}
              </ul>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
