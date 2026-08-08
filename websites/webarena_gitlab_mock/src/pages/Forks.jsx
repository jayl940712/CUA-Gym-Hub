import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery, sortProjects } from './hooks.js'
import { ProjectRow } from './DashboardProjects.jsx'
import '../components/create/create.css'

// ROUTES #65 — `/:ns/:proj/-/forks`. assets/README.md §12e.1.
//
// Every project in the seed has 0 forks, so the source only ever shows the
// empty state; rows appear once a task forks something (webarena-394…398, 522).

const SORTS = [
  ['created_desc', 'Created date'],
  ['latest_activity_desc', 'Updated date'],
]

function pluralize(n, word) {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export default function Forks() {
  const { state } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  usePageChrome({
    title: project ? `${project.namespace.name} / ${project.name} · GitLab` : 'GitLab',
    limited: true,
  })

  useEffect(() => {
    if (!open) return undefined
    function onDown(e) { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  if (!state) return null
  if (!project) return <NotFound />

  const filter = (q.get('filter_projects', '') || '').trim().toLowerCase()
  const sort = q.get('sort', 'created_desc')

  let forks = state.projects.filter(p => p.forked_from && p.forked_from.id === project.id)
  if (filter) forks = forks.filter(p => p.name.toLowerCase().includes(filter))
  forks = sortProjects(forks, sort === 'created_asc' ? 'created_asc' : sort)

  const counts = { public: 0, internal: 0, private: 0 }
  for (const f of forks) counts[f.visibility] = (counts[f.visibility] || 0) + 1

  // If byteblaze already forked this project, the CTA points at their fork.
  const mine = forks.find(p => p.namespace && p.namespace.path === state.currentUser.username)
  const current = SORTS.find(([v]) => v === sort) || SORTS[0]

  function setParam(key, value) {
    q.setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  return (
    <div>
      <div className="top-area">
        <div className="nav-text">
          {`${pluralize(forks.length, 'fork')}: ${counts.public} public, ${counts.internal} internal, and ${counts.private} private`}
        </div>
        <div className="nav-controls">
          <form id="project-filter-form" className="project-filter-form gl-display-flex"
            onSubmit={e => e.preventDefault()}>
            <input type="search" name="filter_projects" id="filter_projects" placeholder="Search forks"
              spellCheck="false" className="projects-list-filter project-filter-form-field form-control input-short"
              value={q.get('filter_projects', '') || ''} onChange={e => setParam('filter_projects', e.target.value)} />
          </form>
          <div className="dropdown issue-sort-dropdown" ref={ref}>
            <div className="btn-group" role="group">
              <button type="button" className="btn gl-button btn-default gl-dropdown-toggle js-redirect-listbox"
                onClick={() => setOpen(o => !o)}>
                <span className="gl-dropdown-button-text">{current[1]}</span>
                <Icon name="chevron-down" />
              </button>
              <a className="gl-button btn btn-default btn-icon has-tooltip reverse-sort-btn"
                href={`${base}/-/forks?sort=created_asc`} title="Sort direction">
                <Icon name="chevron-up" />
              </a>
            </div>
            <div className={`dropdown-menu dropdown-menu-right${open ? ' show' : ''}`}>
              <ul>
                {SORTS.map(([v, label]) => (
                  <li key={v}>
                    <button type="button" onClick={() => { setOpen(false); setParam('sort', v) }}>{label}</button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {mine ? (
            <a className="btn gl-button btn-confirm gl-md-ml-3" href={`/${mine.full_path}`} title="Go to your fork">
              <Icon name="fork" /><span>Fork</span>
            </a>
          ) : (
            <a className="btn gl-button btn-confirm gl-md-ml-3" href={`${base}/-/forks/new`} title="Fork project">
              <Icon name="fork" data-testid="fork-icon" /><span>Fork</span>
            </a>
          )}
        </div>
      </div>

      <div className="js-projects-list-holder" data-qa-selector="projects_list">
        {forks.length ? (
          <ul className="projects-list content-list">
            {forks.map(p => <ProjectRow key={p.id} project={p} />)}
          </ul>
        ) : (
          <div className="nothing-here-block">
            <div className="text-content">
              <h5>This user doesn&apos;t have any personal projects</h5>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
