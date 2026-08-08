import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import Icon from '../components/layout/Icon.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import { ProjectRow } from './DashboardProjects.jsx'
import { useQuery } from './hooks.js'
import { useQueryNavigate } from '../utils/RedirectWithQuery.jsx'

// ROUTES #21 / #22 / #23 — `/search`. assets/README.md §23.
//
// Three things the recon explicitly corrected, all easy to get wrong:
//  1. The scope selector is a 240px VERTICAL PILL LIST in a left sidebar, not
//     a horizontal tab strip.
//  2. This build exposes exactly FIVE global scopes. `notes`, `wiki_blobs`,
//     `blobs`, `commits` and `snippet_titles` return 200 but silently fall
//     back to `projects` — they only exist under a project/group scope.
//  3. There is NO `N results for "foo"` header anywhere in the DOM. The only
//     place that phrasing exists is a <meta> tag.
// Counts are capped at 99 (GitLab's `limited_count`).

const SCOPES = [
  { key: 'projects', label: 'Projects', noun: 'projects' },
  { key: 'issues', label: 'Issues', noun: 'issues' },
  { key: 'merge_requests', label: 'Merge requests', noun: 'merge requests' },
  { key: 'milestones', label: 'Milestones', noun: 'milestones' },
  { key: 'users', label: 'Users', noun: 'users' },
]

const LIMITED_COUNT = 99
const PER_PAGE = 20

const cap = n => (n > LIMITED_COUNT ? LIMITED_COUNT : n)

function matches(haystack, needle) {
  return String(haystack || '').toLowerCase().includes(needle)
}

export default function Search() {
  const { state, indexes } = useApp()
  const q = useQuery()
  // PARITY-003 — `withParams()` builds a fresh URLSearchParams, so a raw
  // navigate() would drop ?sid=. keepQuery:false re-attaches sid and nothing
  // else, which is what these filter submits want (they replace the filter set).
  const navigate = useQueryNavigate()

  const term = q.get('search', '') || ''
  const rawScope = q.get('scope', 'projects') || 'projects'
  // Unsupported scopes fall back to projects without changing the URL.
  const scope = SCOPES.some(s => s.key === rawScope) ? rawScope : 'projects'
  const projectId = q.get('project_id')
  const groupId = q.get('group_id')
  const page = Math.max(1, parseInt(q.get('page', '1'), 10) || 1)
  const state_ = q.get('state', '')
  const confidential = q.get('confidential', '')

  const [input, setInput] = useState(term)

  usePageChrome({ title: term ? `${term} · Search · GitLab` : 'Search · GitLab' })

  const needle = term.trim().toLowerCase()
  const scopedProject = projectId
    ? state.projects.find(p => String(p.id) === String(projectId))
    : null
  const projectFilter = row => !scopedProject || row.project_id === scopedProject.id

  // --- result sets, one per scope -------------------------------------------
  const results = {}
  if (needle) {
    results.projects = state.projects.filter(p =>
      (!scopedProject || p.id === scopedProject.id)
      && (!groupId || (p.namespace && String(p.namespace.id) === String(groupId)))
      && (matches(p.name, needle) || matches(p.full_path, needle) || matches(p.description, needle)))

    results.issues = state.issues.filter(i => projectFilter(i)
      && (matches(i.title, needle) || matches(i.description, needle)))
    results.merge_requests = state.mergeRequests.filter(m => projectFilter(m)
      && (matches(m.title, needle) || matches(m.description, needle)))
    results.milestones = state.milestones.filter(m => projectFilter(m)
      && (matches(m.title, needle) || matches(m.description, needle)))
    results.users = state.users.filter(u =>
      matches(u.name, needle) || matches(u.username, needle))
  } else {
    SCOPES.forEach(s => { results[s.key] = [] })
  }

  // Left-sidebar status / confidentiality filters (issues & MRs only).
  let rows = results[scope] || []
  if (scope === 'issues' || scope === 'merge_requests') {
    if (state_) rows = rows.filter(r => r.state === state_)
    if (scope === 'issues' && confidential === 'yes') rows = rows.filter(r => r.confidential)
    if (scope === 'issues' && confidential === 'no') rows = rows.filter(r => !r.confidential)
  }
  const pageRows = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  function submit(e) {
    e.preventDefault()
    const p = new URLSearchParams(q.searchParams)
    p.set('search', input)
    p.delete('page')
    navigate(`/search?${p.toString()}`, { keepQuery: false })
  }

  const withParams = patch => {
    const p = new URLSearchParams()
    // The source emits `scope` first, then `search` (§23).
    const merged = { scope, search: term, ...patch }
    if (merged.page && merged.page !== 1) p.set('page', String(merged.page))
    if (merged.scope) p.set('scope', merged.scope)
    if (merged.search) p.set('search', merged.search)
    if (projectId) p.set('project_id', projectId)
    if (groupId) p.set('group_id', groupId)
    if (merged.state) p.set('state', merged.state)
    if (merged.confidential) p.set('confidential', merged.confidential)
    return `/search?${p.toString()}`
  }

  const activeScope = SCOPES.find(s => s.key === scope) || SCOPES[0]

  return (
    <div>
      {/* TEST.part-routes-a.md BUG-A09. The markup already carried the source's
          `gl-lg-display-flex` / `nav-pills` class names, but global.css does not
          implement those GitLab utilities, so the page collapsed to one column:
          full-width stacked selects, bulleted scope list, results underneath.
          Scoped here rather than in global.css so it cannot collide with the
          other pages sharing those class names. Geometry per assets/README.md
          §23: 240px selects inline with the query input, 240px scope rail
          beside the results, active pill on a grey background. */}
      <style>{`
        .search-page-form > form { display: flex; flex-direction: row; align-items: flex-end; }
        .search-page-form > form > .gl-flex-grow-1 { flex: 1 1 auto; min-width: 0; }
        .search-page-form [data-testid="group-filter"],
        .search-page-form [data-testid="project-filter"] { flex: 0 0 240px; width: 240px; }
        .search-page-form select { width: 100%; }
        .results { display: flex; align-items: flex-start; }
        .results .search-sidebar { width: 240px; flex: 0 0 240px; }
        .results .search-sidebar ul.nav-pills { list-style: none; padding-left: 0; margin: 0; width: 100%; }
        .results .search-sidebar ul.nav-pills > li { list-style: none; width: 100%; }
        .results .search-sidebar .nav-link {
          display: flex; justify-content: space-between; padding: 8px 12px;
          border-radius: 4px; text-decoration: none;
        }
        .results .search-sidebar .nav-link:hover { background-color: var(--gray-50, #f5f5f5); }
        .results .search-sidebar .nav-link.active {
          background-color: var(--gray-100, #ececef); font-weight: 600; text-decoration: none;
        }
      `}</style>

      <div className="page-title-holder gl-display-flex gl-flex-wrap gl-justify-content-space-between">
        <h1 className="page-title gl-font-size-h-display gl-mr-5">Search</h1>
      </div>

      <div className="gl-mt-3">
        <section className="search-page-form gl-lg-display-flex gl-flex-direction-column">
          <form className="gl-lg-display-flex gl-flex-direction-row gl-align-items-flex-end"
            style={{ gap: 16 }} onSubmit={submit}>
            <div className="gl-flex-grow-1">
              <label htmlFor="dashboard_search">What are you searching for?</label>
              <div className="input-group gl-search-box-by-click">
                <input id="dashboard_search" name="search" type="search"
                  className="gl-form-input gl-search-box-by-click-input form-control"
                  placeholder="Search for projects, issues, etc." aria-label="Search for projects, issues, etc."
                  value={input} onChange={e => setInput(e.target.value)} />
                {input ? (
                  <button type="button" name="clear" title="Clear" aria-label="Clear"
                    className="gl-clear-icon-button gl-search-box-by-click-clear-button btn gl-button btn-default"
                    data-testid="filtered-search-clear-button" onClick={() => setInput('')}>
                    {/* BUG-A13: this was a literal `×`, which lands in
                        page.innerText and in any string_match over the body.
                        GitLab renders an icon-only button. */}
                    <Icon name="close" />
                  </button>
                ) : null}
                <div className="input-group-append">
                  <button type="submit" aria-label="Search" data-testid="search-button"
                    className="gl-search-box-by-click-search-button btn-default btn-md gl-button btn-icon">
                    <Icon name="search" />
                  </button>
                </div>
              </div>
            </div>
            <div className="gl-mb-4 gl-lg-mb-0 gl-lg-mx-3" data-testid="group-filter">
              <label htmlFor="search-group-filter">Group</label>
              <select id="search-group-filter" className="gl-form-select custom-select"
                value={groupId || ''}
                onChange={e => {
                  const p = new URLSearchParams(q.searchParams)
                  if (e.target.value) p.set('group_id', e.target.value); else p.delete('group_id')
                  navigate(`/search?${p.toString()}`, { keepQuery: false })
                }}>
                <option value="">Any</option>
                {state.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>
            <div className="gl-mb-4 gl-lg-mb-0 gl-lg-ml-3" data-testid="project-filter">
              <label htmlFor="search-project-filter">Project</label>
              <select id="search-project-filter" className="gl-form-select custom-select"
                value={projectId || ''}
                onChange={e => {
                  const p = new URLSearchParams(q.searchParams)
                  if (e.target.value) p.set('project_id', e.target.value); else p.delete('project_id')
                  navigate(`/search?${p.toString()}`, { keepQuery: false })
                }}>
                <option value="">Any</option>
                {state.projects.slice(0, 200).map(p => (
                  <option key={p.id} value={p.id}>
                    {`${p.name} · ${p.namespace ? p.namespace.name : ''}`}
                  </option>
                ))}
              </select>
            </div>
          </form>
          <hr className="gl-mt-5 gl-mb-0 gl-border-gray-100" />
        </section>
      </div>

      {/* §23: `/search` with no query renders NOTHING below the rule. */}
      {term ? (
        <div className="results gl-md-display-flex gl-mt-0" style={{ gap: 16 }}>
          <section className="search-sidebar gl-display-flex gl-flex-direction-column gl-mr-4 gl-mb-6 gl-mt-5"
            style={{ width: 240, flexShrink: 0 }}>
            <nav data-testid="search-filter">
              <ul className="nav nav-pills flex-column">
                {SCOPES.map(s => (
                  <li className="nav-item gl-mb-1" key={s.key}>
                    <a className={`nav-link gl-display-flex gl-justify-content-space-between gl-text-gray-900${s.key === scope ? ' active gl-font-weight-bold' : ''}`}
                      href={withParams({ scope: s.key, page: 1 })}>
                      <span>{s.label}</span>
                      <span className={`gl-font-sm gl-font-weight-normal ${s.key === scope ? 'gl-text-gray-900' : 'gl-text-gray-500'}`}>
                        {cap((results[s.key] || []).length)}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            {(scope === 'issues' || scope === 'merge_requests') ? (
              <form className="gl-pt-5 gl-md-pt-0" onSubmit={e => {
                e.preventDefault()
                const fd = new FormData(e.currentTarget)
                navigate(withParams({
                  state: String(fd.get('state') || ''),
                  confidential: String(fd.get('confidential') || ''),
                  page: 1,
                }), { keepQuery: false })
              }}>
                <div className="gl-px-5">
                  <h5 className="gl-mt-0">Status</h5>
                  <div className="gl-form-checkbox-group">
                    {(scope === 'issues'
                      ? [['', 'Any status'], ['opened', 'Open'], ['closed', 'Closed']]
                      : [['', 'Any status'], ['opened', 'Open'], ['merged', 'Merged'], ['closed', 'Closed']]
                    ).map(([v, l]) => (
                      <div className="gl-form-radio custom-control custom-radio" key={`st-${v}`}>
                        <input id={`state-${v || 'any'}`} type="radio" name="state" value={v}
                          className="custom-control-input" defaultChecked={state_ === v} />
                        <label className="custom-control-label" htmlFor={`state-${v || 'any'}`}>{l}</label>
                      </div>
                    ))}
                  </div>
                </div>
                {scope === 'issues' ? (
                  <>
                    <hr />
                    <div className="gl-px-5">
                      <h5 className="gl-mt-0">Confidentiality</h5>
                      <div className="gl-form-checkbox-group">
                        {[['', 'Any confidentiality'], ['yes', 'Confidential'], ['no', 'Not confidential']].map(([v, l]) => (
                          <div className="gl-form-radio custom-control custom-radio" key={`cf-${v}`}>
                            <input id={`conf-${v || 'any'}`} type="radio" name="confidential" value={v}
                              className="custom-control-input" defaultChecked={confidential === v} />
                            <label className="custom-control-label" htmlFor={`conf-${v || 'any'}`}>{l}</label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                ) : null}
                <hr />
                <button type="submit" className="btn btn-confirm btn-md gl-button">Apply</button>
              </form>
            ) : null}
          </section>

          <div className="gl-w-full gl-flex-grow-1 gl-overflow-x-hidden">
            {pageRows.length === 0 ? (
              <div className="search_box gl-my-8 gl-text-center">
                <div className="search_glyph" />
                <h4>
                  <Icon name="search" size={24} className="gl-vertical-align-text-bottom" />
                  {` We couldn't find any ${activeScope.noun} matching `}
                  <code>{term}</code>
                </h4>
              </div>
            ) : (
              <div className="search-results">
                {scope === 'projects' ? (
                  <div className="term">
                    <div className="js-projects-list-holder" data-qa-selector="projects_list">
                      <ul className="projects-list gl-text-secondary gl-w-full gl-my-2">
                        {pageRows.map(p => <ProjectRow key={p.id} project={p} />)}
                      </ul>
                    </div>
                  </div>
                ) : scope === 'users' ? (
                  <ul className="content-list">
                    {pageRows.map(u => (
                      <li className="gl-display-flex gl-align-items-center gl-py-3" key={u.id} style={{ gap: 12 }}>
                        <div className="avatar-cell">
                          <a href={`/${u.username}`}><UserAvatar user={u} size={40} /></a>
                        </div>
                        <div className="user-info">
                          <a href={`/${u.username}`}>
                            <div className="item-title">{u.name}</div>
                            <div className="cgray">@{u.username}</div>
                          </a>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : scope === 'milestones' ? (
                  pageRows.map(m => {
                    const p = indexes.projectsById.get(m.project_id)
                    return (
                      <div className="search-result-row gl-mt-5" key={m.id}>
                        <h4>
                          <a data-track-label="milestone_title" href={p ? `/${p.full_path}/-/milestones/${m.iid}` : '#'}>
                            <span className="term str-truncated">{m.title}</span>
                          </a>
                        </h4>
                        {m.description ? <div className="description term"><p>{m.description}</p></div> : null}
                      </div>
                    )
                  })
                ) : (
                  pageRows.map(r => {
                    const p = indexes.projectsById.get(r.project_id)
                    const author = indexes.usersById.get(r.author_id)
                    const isMr = scope === 'merge_requests'
                    const badge = r.state === 'opened' ? ['badge-success', 'Open']
                      : r.state === 'merged' ? ['badge-info', 'Merged'] : ['badge-info', 'Closed']
                    const nsName = p && p.namespace ? `${p.namespace.name} / ${p.name}` : ''
                    return (
                      <div className="search-result-row gl-display-flex gl-sm-flex-direction-row gl-flex-direction-column gl-pb-3! gl-mt-5 gl-mb-0!"
                        key={`${scope}-${r.id}`}>
                        <div className="col-sm-9">
                          <span className="gl-display-flex gl-align-items-center">
                            <span className={`gl-badge badge badge-pill ${badge[0]} sm`}>{badge[1]}</span>
                            <a className="gl-w-full" data-track-action="click_text"
                              data-track-label={isMr ? 'mergerequest_title' : 'issue_title'}
                              data-track-property="search_result"
                              href={p ? `/${p.full_path}/-/${isMr ? 'merge_requests' : 'issues'}/${r.iid}` : '#'}>
                              <span className="term str-truncated gl-font-weight-bold gl-ml-2">{r.title}</span>
                            </a>
                          </span>
                          <div className="gl-text-gray-500 gl-my-3">
                            {`${nsName} ${isMr ? '!' : '#'}${r.iid}`}
                            {' · created '}
                            <TimeAgo value={r.created_at} />
                            {author ? <>{' by '}<a className="author-link js-user-link" href={`/${author.username}`}><span className="author">{author.name}</span></a></> : null}
                          </div>
                          {r.description ? (
                            <div className="description term gl-px-0">{String(r.description).slice(0, 200)}</div>
                          ) : null}
                        </div>
                        <div className="col-sm-3 gl-mt-3 gl-sm-mt-0 gl-text-right">
                          <span className="gl-text-gray-500">updated <TimeAgo value={r.updated_at} /></span>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            <div className="gl-pagination gl-mt-3">
              <ul className="pagination justify-content-center">
                {page > 1 ? (
                  <li className="page-item prev">
                    <a rel="prev" className="page-link" href={withParams({ page: page - 1 })}>Prev</a>
                  </li>
                ) : null}
                {rows.length > page * PER_PAGE ? (
                  <li className="page-item next">
                    <a rel="next" className="page-link" href={withParams({ page: page + 1 })}>Next</a>
                  </li>
                ) : null}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
