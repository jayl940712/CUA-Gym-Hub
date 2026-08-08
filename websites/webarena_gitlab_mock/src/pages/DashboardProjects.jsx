import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { EntityAvatar } from '../components/layout/Avatar.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import Icon from '../components/layout/Icon.jsx'
import { useQuery, sortProjects } from './hooks.js'
import { VISIBILITY_TITLES } from '../utils/format.js'
import QueryForm from '../components/ui/QueryForm.jsx'
import {
  ProjectsPrimaryTabs, ProjectsFilterControls, filterArchived, DEFAULT_PROJECT_SORT,
} from '../components/ui/ProjectsNav.jsx'

// ROUTES #1 / #2 / #3 — `/`, `/dashboard/projects`, `/dashboard/projects/starred`
// assets/README.md §2. `/` is the landing anchor route for 168 tasks.
//
// ANCHOR: the <ul> wrapping the rows carries data-qa-selector="projects_list"
// (webarena-522 reads its outerText after forking two projects).

const PER_PAGE = 20

// TEST.part-routes-a.md BUG-A06: the source's card carries a role badge and FOUR
// stat counters in this order — stars, forks, merge requests, issues — and every
// one of them renders even at zero (verified across all 14 rows of
// assets/html/dashboard-projects-yours.html and all 20 of explore.html). The
// role badge renders only where the current user is actually a member: 4 of the
// 20 explore rows have one.
export function ProjectRow({ project, starred, compact = false }) {
  const { state, currentUser } = useApp()
  const vis = project.visibility || 'private'
  const icon = vis === 'public' ? 'earth' : vis === 'internal' ? 'shield' : 'lock'
  const membership = state.members.find(m => m.source_type === 'project'
    && m.source_id === project.id && m.user_id === currentUser.id)
  const stats = [
    { key: 'stars', icon: 'star-o', title: 'Stars', count: project.star_count || 0, href: `/${project.full_path}/-/starrers` },
    { key: 'forks', icon: 'fork', title: 'Forks', count: project.forks_count || 0, href: `/${project.full_path}/-/forks` },
    { key: 'merge-requests', icon: 'git-merge', title: 'Merge requests', count: project.open_mrs_count || 0, href: `/${project.full_path}/-/merge_requests` },
    { key: 'issues', icon: 'issues', title: 'Issues', count: project.open_issues_count || 0, href: `/${project.full_path}/-/issues` },
  ]
  return (
    <li className="project-row" data-qa-selector="project_content">
      <div className="gl-display-flex gl-align-items-center" style={{ gap: 12 }}>
        <EntityAvatar entity={project} size={48} kind="project" />
        <div className="project-details gl-display-flex" style={{ flexDirection: 'column', flex: 1 }}>
          <div className="gl-display-flex gl-align-items-center" style={{ gap: 6 }}>
            <a className="text-plain js-prefetch-document" href={`/${project.full_path}`}>
              {/* The profile's "Personal projects" panel renders the bare path (DIFF-A02). */}
              {!compact && project.namespace
                ? <span className="namespace-name gl-font-weight-normal">{project.namespace.name} / </span>
                : null}
              <span className="project-name">{project.name}</span>
            </a>
            <span className="visibility-icon gl-text-secondary has-tooltip" data-container="body"
              title={VISIBILITY_TITLES[vis]}>
              <Icon name={icon} className="icon" />
            </span>
            {membership ? (
              <span className="user-access-role gl-display-block gl-m-0" data-qa-selector="user_role_content">
                {membership.access_label}
              </span>
            ) : null}
          </div>
          {project.description
            ? <p className="description gl-mb-0 gl-text-gray-500">{project.description}</p>
            : null}
        </div>
        <div className="project-controls gl-display-flex gl-align-items-center" data-testid="project_controls" style={{ gap: 12 }}>
          <div className="controls gl-display-flex gl-align-items-center" style={{ gap: 12 }}>
            {stats.map(s => (
              <a key={s.key} className={`icon-wrapper has-tooltip ${s.key}`} title={s.title}
                data-container="body" href={s.href}>
                <Icon name={s.icon} size={14} className="s14 gl-mr-2" /> {s.count}
              </a>
            ))}
          </div>
          <div className="updated-note last-updated gl-text-gray-500 gl-font-sm">
            Updated <TimeAgo value={project.last_activity_at} />
          </div>
        </div>
      </div>
    </li>
  )
}

export default function DashboardProjects({ starred = false }) {
  const { state, currentUser } = useApp()
  const q = useQuery()
  usePageChrome({ title: starred ? 'Dashboard · GitLab' : 'Projects · Dashboard · GitLab' })

  const starredIds = new Set(state.stars.filter(s => s.user_id === currentUser.id).map(s => s.project_id))
  const memberProjectIds = new Set(state.members
    .filter(m => m.source_type === 'project' && m.user_id === currentUser.id)
    .map(m => m.source_id))

  const owned = state.projects.filter(p => memberProjectIds.has(p.id)
    || (p.namespace && p.namespace.path === currentUser.username))
  let rows = starred ? state.projects.filter(p => starredIds.has(p.id)) : owned

  const name = q.get('name')
  const archived = q.get('archived') || ''
  const personal = q.get('personal') === 'true'
  if (name) rows = rows.filter(p => p.name.toLowerCase().includes(name.toLowerCase()))
  rows = filterArchived(rows, archived)
  if (personal) rows = rows.filter(p => p.namespace && p.namespace.kind === 'user')

  const sort = q.get('sort', DEFAULT_PROJECT_SORT)
  rows = sortProjects(rows, sort)

  const page = Math.max(1, parseInt(q.get('page', '1'), 10) || 1)
  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const basePath = starred ? '/dashboard/projects/starred' : '/dashboard/projects'
  // `All`/`Personal` renders on `/` and `/dashboard/projects` only — the source
  // omits it on the starred tab (assets/html/dashboard-projects-starred.html).
  const personalHref = personal || sort !== DEFAULT_PROJECT_SORT
    ? `${basePath}?personal=true&sort=${sort}` : `${basePath}?personal=true`

  // Rooted, not `?page=N` — a query-only href bypasses the sid-preserving link
  // interceptor in src/App.jsx and loses the session (BUG-A01's class).
  const pageHref = n => {
    const p = new URLSearchParams()
    if (name) p.set('name', name)
    if (archived) p.set('archived', archived)
    if (personal) p.set('personal', 'true')
    p.set('sort', sort)
    p.set('page', String(n))
    return `${basePath}?${p.toString()}`
  }

  return (
    <div>
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">Projects</h1>
        <div className="page-title-controls">
          <a className="btn gl-button btn-confirm" data-qa-selector="new_project_button" href="/projects/new">New project</a>
        </div>
      </div>

      <div className="top-area">
        <ProjectsPrimaryTabs active={starred ? 'starred' : 'yours'} sort={sort}
          ownedCount={owned.length} starredCount={starredIds.size} />
        <ProjectsFilterControls basePath={basePath} sort={sort} archived={archived}
          personal={personal} name={name || ''} formAs={QueryForm} />
      </div>

      {!starred && (
        <div className="nav-block">
          <ul className="nav gl-tabs-nav">
            <li className="nav-item">
              <a className={`nav-link gl-tab-nav-item${personal ? '' : ' active gl-tab-nav-item-active'}`}
                href={basePath}>All</a>
            </li>
            <li className="nav-item">
              <a className={`nav-link gl-tab-nav-item${personal ? ' active gl-tab-nav-item-active' : ''}`}
                href={personalHref}>Personal</a>
            </li>
          </ul>
        </div>
      )}

      {pageRows.length === 0 ? (
        <div className="row empty-state">
          <div className="gl-empty-state-content">
            <h4>Welcome to GitLab</h4>
            <p>Faster releases. Better code. Less pain.</p>
            <a className="btn gl-button btn-confirm" href="/projects/new">Create a project</a>
          </div>
        </div>
      ) : (
        <ul className="projects-list content-list" data-qa-selector="projects_list">
          {pageRows.map(p => <ProjectRow key={p.id} project={p} />)}
        </ul>
      )}

      {pageCount > 1 && (
        <div className="gl-pagination gl-mt-3">
          <ul className="pagination justify-content-center">
            <li className={`page-item js-previous-button${page === 1 ? ' disabled' : ''}`}>
              <a rel="prev" className="page-link" href={page === 1 ? '#' : pageHref(page - 1)}>Prev</a>
            </li>
            {Array.from({ length: pageCount }, (_, i) => i + 1).map(n => (
              <li key={n} className={`page-item js-pagination-page${n === page ? ' active' : ''}`}>
                <a className={`page-link${n === page ? ' active' : ''}`} href={pageHref(n)}>{n}</a>
              </li>
            ))}
            <li className={`page-item js-next-button${page === pageCount ? ' disabled' : ''}`}>
              <a rel="next" className="page-link" href={page === pageCount ? '#' : pageHref(page + 1)}>Next</a>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
