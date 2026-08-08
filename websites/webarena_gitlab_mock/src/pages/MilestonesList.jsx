import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'
import { milestoneDateRange } from './MilestoneDetail.jsx'
import Dropdown from '../components/ui/Dropdown.jsx'
import QueryForm from '../components/ui/QueryForm.jsx'
import { issuableListUrl } from '../utils/issuableUrl.js'

// ROUTES #90 — `/:ns/:proj/-/milestones`. assets/README.md §16b.
// Date range renders as `Jan 16, 2030–Jan 30, 2030` — EN DASH, no spaces.

const SORTS = [
  ['due_date_asc', 'Due soon'],
  ['due_date_desc', 'Due later'],
  ['start_date_asc', 'Start soon'],
  ['start_date_desc', 'Start later'],
  ['name_asc', 'Name, ascending'],
  ['name_desc', 'Name, descending'],
]

function dayValue(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''))
  return m ? Number(`${m[1]}${m[2]}${m[3]}`) : null
}

function todayValue() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return Number(`${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`)
}

export function sortMilestones(rows, sort) {
  const s = [...rows]
  const key = (m, f) => dayValue(m[f]) || 99999999
  switch (sort) {
    case 'due_date_desc': return s.sort((a, b) => key(b, 'due_date') - key(a, 'due_date'))
    case 'start_date_asc': return s.sort((a, b) => key(a, 'start_date') - key(b, 'start_date'))
    case 'start_date_desc': return s.sort((a, b) => key(b, 'start_date') - key(a, 'start_date'))
    case 'name_asc': return s.sort((a, b) => String(a.title).localeCompare(String(b.title)))
    case 'name_desc': return s.sort((a, b) => String(b.title).localeCompare(String(a.title)))
    case 'due_date_asc':
    default: return s.sort((a, b) => key(a, 'due_date') - key(b, 'due_date'))
  }
}

/**
 * One `li.milestone` row. Shared with `/dashboard/milestones`, where the title
 * gains a ` - Project Milestone` suffix and the counts link at the dashboard
 * lists instead of the project ones (§16b).
 */
export function MilestoneRow({ milestone, project, dashboard = false }) {
  const { state } = useApp()
  const base = `/${project.full_path}`
  const issues = state.issues.filter(i => i.milestone_id === milestone.id)
  const mrs = state.mergeRequests.filter(m => m.milestone_id === milestone.id)
  const closed = issues.filter(i => i.state === 'closed').length
  const pct = issues.length ? Math.round((closed / issues.length) * 100) : 0
  const today = todayValue()
  const due = dayValue(milestone.due_date)
  const start = dayValue(milestone.start_date)
  const isClosed = milestone.state === 'closed'
  const range = milestoneDateRange(milestone)
  // DIFF-1303 — `issuableListUrl` gives the project lists the anchors' trailing
  // slash; `/dashboard/…` is returned unslashed, which is what webarena-156 and
  // -357 are written against.
  const filterHref = list =>
    issuableListUrl(dashboard ? `/dashboard/${list}` : `${base}/-/${list}`, '',
      { milestone_title: milestone.title }, { defaults: false })
  const issuesHref = filterHref('issues')
  const mrsHref = filterHref('merge_requests')
  const projectTitle = `${project.namespace ? `${project.namespace.name} / ` : ''}${project.path || project.name}`

  return (
    <li className={`milestone milestone-${isClosed ? 'closed' : 'open'}`} id={`milestone_${milestone.id}`}>
      <div className="gl-display-flex" style={{ gap: 16, flexWrap: 'wrap' }}>
        <div className="col-md-6" style={{ flex: '1 1 380px' }}>
          <div className="gl-mb-2">
            <strong data-qa-selector="milestone_link" data-qa-milestone-title={milestone.title}>
              <a href={`${base}/-/milestones/${milestone.iid}`}>{milestone.title}</a>
            </strong>
            {dashboard ? ' - Project Milestone' : null}
          </div>
          {range ? <div className="text-tertiary gl-mb-2 gl-text-gray-500">{range}</div> : null}
          <div className="gl-display-flex" style={{ gap: 8, flexWrap: 'wrap' }}>
            {due !== null && due < today && !isClosed
              ? <span className="gl-badge badge badge-pill badge-warning md gl-mb-2">Expired</span> : null}
            {start !== null && start > today
              ? <span className="gl-badge badge badge-pill badge-info md gl-mb-2">Upcoming</span> : null}
            {isClosed ? <span className="gl-badge badge badge-pill badge-danger md gl-mb-2">Closed</span> : null}
            <span className="gl-badge badge badge-pill badge-muted md gl-white-space-normal gl-text-left">
              {projectTitle}</span>
          </div>
        </div>

        <div className="col-md-4 milestone-progress" style={{ flex: '1 1 260px' }}>
          <div className="progress" style={{ height: 8, background: 'var(--gray-100, #ececef)', borderRadius: 4 }}>
            <div className="progress-bar bg-success"
              style={{ width: `${pct}%`, height: '100%', background: 'var(--green-500, #108548)', borderRadius: 4 }} />
          </div>
          <div className="gl-mt-2 gl-font-sm">
            <a href={issuesHref}>{issues.length} Issue{issues.length === 1 ? '' : 's'}</a>
            {' · '}
            <a href={mrsHref}>{mrs.length} Merge request{mrs.length === 1 ? '' : 's'}</a>
            <div className="float-lg-right light gl-text-gray-500">{pct}% complete</div>
          </div>
        </div>

        <div className="col-md-2" style={{ flex: '0 0 auto' }}>
          <div className="milestone-actions d-flex justify-content-md-end">
            <a className={`btn gl-button btn-sm gl-ml-3${isClosed ? '' : ' btn-default btn-default-secondary'}`}
              href={`${base}/-/milestones/${milestone.iid}?milestone%5Bstate_event%5D=${isClosed ? 'activate' : 'close'}`}>
              {isClosed ? 'Reopen Milestone' : 'Close Milestone'}
            </a>
          </div>
        </div>
      </div>
    </li>
  )
}

export function MilestonesEmptyState({ newHref }) {
  return (
    <div className="row empty-state">
      <div className="col-12"><div className="text-content text-center">
        <h4>Use milestones to track issues and merge requests over a fixed period of time</h4>
        <p className="state-description">
          Organize issues and merge requests into a cohesive group, and set optional start and due dates.{' '}
          <a href="/help/user/project/milestones/index">Learn more.</a>
        </p>
        <div className="text-center">
          <a className="gl-button btn btn-confirm" data-qa-selector="new_project_milestone_link"
            href={newHref} title="New milestone">New milestone</a>
        </div>
      </div></div>
    </div>
  )
}

export function MilestoneTabs({ counts, basePath, current }) {
  const tabs = [
    ['opened', 'Open', `${basePath}?state=opened`],
    ['closed', 'Closed', `${basePath}?sort=due_date_desc&state=closed`],
    ['all', 'All', `${basePath}?sort=due_date_desc&state=all`],
  ]
  return (
    <ul className="gl-border-b-0 gl-flex-grow-1 nav gl-tabs-nav" data-testid="milestones-filter">
      {tabs.map(([value, label, href]) => (
        <li className="nav-item" key={value}>
          <a className={`nav-link gl-tab-nav-item${current === value ? ' active gl-tab-nav-item-active' : ''}`}
            href={href}>{label}
            <span className="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge">{counts[value]}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

export default function MilestonesList() {
  const { state } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  usePageChrome({
    title: project
      ? `Milestones · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
  })
  if (!project) return <NotFound />

  const all = state.milestones.filter(m => m.project_id === project.id)
  const tab = q.get('state', 'opened')
  const search = (q.get('search_title') || '').trim().toLowerCase()
  const sort = q.get('sort', 'due_date_asc')

  let rows = tab === 'closed' ? all.filter(m => m.state === 'closed')
    : tab === 'all' ? all
      : all.filter(m => m.state !== 'closed')
  if (search) rows = rows.filter(m => String(m.title).toLowerCase().includes(search))
  rows = sortMilestones(rows, sort)

  const counts = {
    opened: all.filter(m => m.state !== 'closed').length,
    closed: all.filter(m => m.state === 'closed').length,
    all: all.length,
  }
  const newHref = `${base}/-/milestones/new`

  // The source hides the whole `.top-area` when the project has no milestones
  // in any state — that is what /byteblaze/dotfiles and /primer/design show
  // today, and both are anchor routes (§16b).
  if (all.length === 0) return <MilestonesEmptyState newHref={newHref} />

  return (
    <div>
      <div className="top-area">
        <MilestoneTabs counts={counts} basePath={`${base}/-/milestones`} current={tab} />
        <div className="nav-controls">
          <QueryForm action={`${base}/-/milestones`} className="gl-display-flex" style={{ gap: 8 }}>
            <input id="search_title" name="search_title" type="search"
              className="form-control gl-form-input input-short" placeholder="Filter by milestone name"
              defaultValue={q.get('search_title', '')} />
            <input type="hidden" id="state" name="state" value={tab} readOnly />
            <input type="hidden" id="sort" name="sort" value={sort} readOnly />
          </QueryForm>
          <Dropdown className="dropdown" data-testid="milestone_sort_by_dropdown"
            toggleClassName="btn gl-button btn-default gl-dropdown-toggle"
            toggle={<span className="gl-dropdown-button-text">
              {(SORTS.find(s => s[0] === sort) || SORTS[0])[1]}</span>}
            menuClassName="dropdown-menu dropdown-menu-right">
            <ul>
              {SORTS.map(([v, l]) => {
                const p = new URLSearchParams(q.searchParams)
                p.set('sort', v)
                return <li key={v}><a href={`${base}/-/milestones?${p.toString()}`}>{l}</a></li>
              })}
            </ul>
          </Dropdown>
          <a className="gl-button btn btn-confirm gl-ml-3" data-qa-selector="new_project_milestone_link"
            href={newHref} title="New milestone">New milestone</a>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="row empty-state"><div className="gl-empty-state-content">
          <h4>No milestones to show</h4>
        </div></div>
      ) : (
        <div className="milestones">
          <ul className="content-list">
            {rows.map(m => <MilestoneRow key={m.id} milestone={m} project={project} />)}
          </ul>
        </div>
      )}
    </div>
  )
}
