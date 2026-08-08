import React from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import { useQuery, sortProjects } from './hooks.js'
import { ProjectRow } from './DashboardProjects.jsx'
import QueryForm from '../components/ui/QueryForm.jsx'
import Dropdown from '../components/ui/Dropdown.jsx'
import {
  ProjectsPrimaryTabs, ProjectsFilterControls, filterArchived, DEFAULT_PROJECT_SORT,
} from '../components/ui/ProjectsNav.jsx'

// ROUTES #14–#17 — `/explore`, `/explore/projects`, `/trending`, `/starred`.
// assets/README.md §6a. `/explore` is an anchor route (webarena-258).
//
// TEST.part-routes-a.md BUG-A07: the source renders TWO tab rows here — the same
// primary strip the dashboard has (`Yours 14 · Starred 3 · Explore · Topics`),
// then a secondary `All · Most stars · Trending` row with a `Visibility:` filter.
// The mock had only the secondary row, in the wrong order.
// See assets/html/explore.html and explore-projects-trending.html.

const PER_PAGE = 20

const VISIBILITY_LEVELS = [
  { value: '', label: 'Any' },
  { value: '0', label: 'Private', visibility: 'private' },
  { value: '10', label: 'Internal', visibility: 'internal' },
  { value: '20', label: 'Public', visibility: 'public' },
]

export default function ExploreProjects({ tab = 'all' }) {
  const { state, currentUser } = useApp()
  const q = useQuery()
  const { pathname } = useLocation()
  usePageChrome({ title: 'Projects · Explore · GitLab' })

  const starredIds = new Set(state.stars.filter(s => s.user_id === currentUser.id).map(s => s.project_id))
  const memberProjectIds = new Set(state.members
    .filter(m => m.source_type === 'project' && m.user_id === currentUser.id)
    .map(m => m.source_id))
  const ownedCount = state.projects.filter(p => memberProjectIds.has(p.id)
    || (p.namespace && p.namespace.path === currentUser.username)).length

  let rows = state.projects.filter(p => p.visibility !== 'private')
  if (tab === 'starred') rows = rows.filter(p => (p.star_count || 0) > 0)

  const name = q.get('name')
  const archived = q.get('archived') || ''
  const personal = q.get('personal') === 'true'
  const visibilityLevel = q.get('visibility_level') || ''
  if (name) rows = rows.filter(p => p.name.toLowerCase().includes(name.toLowerCase()))
  rows = filterArchived(rows, archived)
  if (personal) rows = rows.filter(p => memberProjectIds.has(p.id)
    || (p.namespace && p.namespace.path === currentUser.username))
  const level = VISIBILITY_LEVELS.find(v => v.value && v.value === visibilityLevel)
  if (level) rows = rows.filter(p => (p.visibility || 'private') === level.visibility)

  const sort = q.get('sort', tab === 'starred' ? 'stars_desc' : DEFAULT_PROJECT_SORT)
  rows = sortProjects(rows, sort)

  const page = Math.max(1, parseInt(q.get('page', '1'), 10) || 1)
  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  // `/explore` keeps its own path in the filter form's action, exactly as the
  // source does (assets/html/explore.html: action="/explore?sort=name_asc").
  const basePath = pathname === '/explore' ? '/explore'
    : tab === 'trending' ? '/explore/projects/trending'
      : tab === 'starred' ? '/explore/projects/starred' : '/explore/projects'

  const secondaryTabs = [
    { key: 'all', label: 'All', href: '/explore/projects' },
    { key: 'starred', label: 'Most stars', href: '/explore/projects/starred' },
    { key: 'trending', label: 'Trending', href: '/explore/projects/trending' },
  ]

  const visibilityHref = value => {
    const p = new URLSearchParams()
    if (name) p.set('name', name)
    if (archived) p.set('archived', archived)
    if (personal) p.set('personal', 'true')
    if (value) p.set('visibility_level', value)
    p.set('sort', sort)
    return `${basePath}?${p.toString()}`
  }

  const pageHref = n => {
    const p = new URLSearchParams()
    if (name) p.set('name', name)
    if (archived) p.set('archived', archived)
    if (personal) p.set('personal', 'true')
    if (visibilityLevel) p.set('visibility_level', visibilityLevel)
    p.set('sort', sort)
    p.set('page', String(n))
    return `${basePath}?${p.toString()}`
  }

  const activeVisibility = VISIBILITY_LEVELS.find(v => v.value === visibilityLevel) || VISIBILITY_LEVELS[0]

  return (
    <div>
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">Projects</h1>
        <div className="page-title-controls">
          <a className="btn gl-button btn-confirm" data-qa-selector="new_project_button" href="/projects/new">New project</a>
        </div>
      </div>

      <div className="top-area">
        <ProjectsPrimaryTabs active="explore" sort={sort}
          ownedCount={ownedCount} starredCount={starredIds.size} />
        <ProjectsFilterControls basePath={basePath} sort={sort} archived={archived}
          personal={personal} name={name || ''} formAs={QueryForm} />
      </div>

      <div className="top-area">
        <ul className="gl-display-flex gl-flex-grow-1 gl-border-none nav gl-tabs-nav">
          {secondaryTabs.map(t => (
            <li className="nav-item" key={t.key}>
              <a className={`nav-link gl-tab-nav-item${tab === t.key ? ' active gl-tab-nav-item-active' : ''}`}
                href={t.href}>{t.label}</a>
            </li>
          ))}
        </ul>
        <div className="nav-controls">
          <span className="gl-float-left">Visibility:</span>
          <Dropdown className="gl-dropdown dropdown btn-group js-redirect-listbox gl-ml-3"
            toggleClassName="btn btn-default btn-md gl-button gl-dropdown-toggle dropdown-toggle"
            toggleProps={{ 'data-testid': 'base-dropdown-toggle' }}
            toggle={<span className="gl-button-text">
              <span className="gl-dropdown-button-text">{activeVisibility.label}</span>
              <Icon name="chevron-down" className="gl-button-icon dropdown-chevron" />
            </span>}
            menuClassName="dropdown-menu"
            menuProps={{ 'data-testid': 'base-dropdown-menu' }}>
            <div className="gl-dropdown-inner">
              <ul className="gl-dropdown-contents gl-list-style-none gl-pl-0 gl-mb-0" role="listbox">
                {VISIBILITY_LEVELS.map(v => (
                  <li key={v.label} role="option" aria-selected={v.value === visibilityLevel}
                    className="gl-dropdown-item gl-listbox-item">
                    <a className="dropdown-item" href={visibilityHref(v.value)}>
                      <span className="gl-dropdown-item-text-wrapper">{v.label}</span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </Dropdown>
        </div>
      </div>

      <div className="js-projects-list-holder" data-qa-selector="projects_list">
        {/* BUG-A04: GitLab CE's trending list is driven by the `trending_projects`
            table, which is empty on this instance — the source renders no cards
            at all here. assets/html/explore-projects-trending.html, verbatim. */}
        {tab === 'trending' || pageRows.length === 0 ? (
          <div className="nothing-here-block">
            <div className="svg-content">
              <div className="text-content">
                <h5>Explore public groups to find projects to contribute to.</h5>
              </div>
            </div>
          </div>
        ) : (
          <ul className="projects-list content-list gl-text-secondary gl-w-full gl-my-2">
            {pageRows.map(p => <ProjectRow key={p.id} project={p} />)}
          </ul>
        )}
      </div>

      {tab !== 'trending' && page < pageCount && (
        <div className="gl-pagination gl-mt-3">
          <ul className="pagination justify-content-center">
            <li className="page-item next">
              <a rel="next" className="page-link" href={pageHref(page + 1)}>Next</a>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
