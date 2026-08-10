import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import { LabelChip } from '../components/issuable/Controls.jsx'
import boards from '../data/boards.json'

// ROUTES #75 — `/:ns/:proj/-/boards`. The default board in GitLab CE is
// Open / Closed, with a card per issue. Cards link to the issue, so the board
// is a real navigation surface rather than a dead page.
//
// `src/data/boards.json` is the instance's own `boards` + `lists` tables, 9
// rows / 18 lists, 4 KB, eager. Read the measurement before assuming those 9
// rows mean 9 configured boards: every one of them is named `Development`,
// carries exactly the two default lists (`backlog` + `closed`), has no label /
// assignee / milestone list, and has both `hide_*` flags false. They are the
// default board GitLab CREATES LAZILY the first time anyone opens `/-/boards`
// — so the 9 are simply the 9 projects whose board page someone happened to
// visit, not 9 distinct configurations, and a project without a row renders
// the identical default board upstream. The seed is used for the board NAME
// and the list set so those come from the source instead of a literal here;
// the fallback below is what the source itself would create on first visit.
const BOARD_BY_PROJECT = new Map(boards.map(b => [b.project_id, b]))
const DEFAULT_BOARD = { name: 'Development', hide_backlog_list: false, hide_closed_list: false }

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

  const board = BOARD_BY_PROJECT.get(project.id) || DEFAULT_BOARD
  const issues = state.issues.filter(i => i.project_id === project.id)
  const lists = [
    // `backlog` is the list GitLab labels "Open" in the board UI.
    !board.hide_backlog_list && ['Open', issues.filter(i => i.state === 'opened')],
    !board.hide_closed_list && ['Closed', issues.filter(i => i.state === 'closed')],
  ].filter(Boolean)

  return (
    <div className="boards-app">
      <div className="top-area">
        <h1 className="page-title gl-font-size-h-display">{board.name}</h1>
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
