import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'
import { getTags, deleteRefs } from '../utils/dataManager.js'
import { shortSha } from '../utils/format.js'
import Dropdown from '../components/ui/Dropdown.jsx'

// ROUTES #55 — `/:ns/:proj/-/tags`. assets/README.md §12b.
//
// Verbatim copy: the header blurb, the two DIFFERENT empty states
// (`Repository has no tags yet.` vs `Sorry, your filter produced no results.`)
// and the `git tag -a v1.4 -m 'version 1.4'` hint.

const SORTS = [
  { key: 'name_asc', label: 'Name' },
  { key: 'updated_asc', label: 'Oldest updated' },
  { key: 'updated_desc', label: 'Updated date' },
  { key: 'version_desc', label: 'Latest version' },
  { key: 'version_asc', label: 'Oldest version' },
]

export default function Tags() {
  const { state, setState } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  const navigate = useNavigate()

  usePageChrome({
    title: project
      ? `Tags · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  if (!project) return <NotFound />

  const all = getTags(state, project)
  const search = q.get('search', '')
  const sort = q.get('sort', 'updated_desc')

  const ts = v => new Date(String(v || '').replace(' ', 'T')).getTime() || 0
  const filtered = all.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))
  const rows = [...filtered].sort((a, b) => {
    switch (sort) {
      case 'name_asc': return a.name.localeCompare(b.name)
      case 'updated_asc': return ts(a.date) - ts(b.date)
      case 'version_asc': return a.name.localeCompare(b.name, undefined, { numeric: true })
      case 'version_desc': return b.name.localeCompare(a.name, undefined, { numeric: true })
      default: return ts(b.date) - ts(a.date)
    }
  })

  function submitSearch(e) {
    e.preventDefault()
    const value = new FormData(e.currentTarget).get('search') || ''
    const p = new URLSearchParams(q.searchParams)
    if (value) p.set('search', String(value))
    else p.delete('search')
    navigate(`${base}/-/tags?${p.toString()}`)
  }

  const sortHref = key => {
    const p = new URLSearchParams(q.searchParams)
    p.set('sort', key)
    return `${base}/-/tags?${p.toString()}`
  }

  return (
    <div className="flex-list">
      <div className="top-area adjust gl-display-flex gl-align-items-center gl-flex-wrap" style={{ gap: 12 }}>
        <div className="nav-text row-main-content gl-flex-grow-1">
          Tags give the ability to mark specific points in history as being important
        </div>
        <div className="nav-controls gl-display-flex gl-align-items-center" style={{ gap: 12 }}>
          <form className="input-group gl-search-box-by-click gl-pr-3" role="group"
            data-testid="tag-search" onSubmit={submitSearch}>
            <input name="search" type="search" className="gl-form-input form-control"
              data-testid="tag-search" placeholder="Filter by tag name" aria-label="Filter by tag name"
              defaultValue={search} />
            <div className="input-group-append">
              <button type="submit" className="btn gl-button btn-default btn-icon"
                data-testid="search-button" aria-label="Search"><Icon name="search" /></button>
            </div>
          </form>
          <Dropdown className="dropdown b-dropdown gl-dropdown btn-group" data-testid="tags-dropdown"
            toggle={<>
              <span className="gl-dropdown-button-text">
                {(SORTS.find(s => s.key === sort) || SORTS[2]).label}
              </span>
              <Icon name="chevron-down" />
            </>}
            menuAs="ul" menuClassName="dropdown-menu dropdown-menu-right">
            {SORTS.map(s => (
              <li key={s.key}><a className="dropdown-item" href={sortHref(s.key)}>{s.label}</a></li>
            ))}
          </Dropdown>
          <a className="gl-button btn btn-confirm" data-qa-selector="new_tag_button"
            href={`${base}/-/tags/new`}>New tag</a>
        </div>
      </div>

      <div className="tags gl-mt-3">
        {rows.length ? (
          <ul className="flex-list content-list">
            {rows.map(t => (
              <li className="flex-row js-tag-list gl-white-space-normal! gl-align-items-flex-start!" key={t.name}>
                <div className="row-main-content gl-flex-grow-1">
                  <div className="gl-display-flex gl-align-items-center" style={{ gap: 6 }}>
                    <Icon name="star" data-testid="tag-icon" />
                    <a className="item-title ref-name" href={`${base}/-/tree/${t.name}`}>{t.name}</a>
                  </div>
                  <div className="block-truncated">
                    <div className="branch-commit cgray gl-display-flex gl-align-items-center" style={{ gap: 6 }}>
                      <a className="commit-sha" href={`${base}/-/commit/${t.sha}`}>{shortSha(t.sha)}</a>
                      <span>·</span>
                      <span className="str-truncated">
                        <a className="commit-row-message cgray" href={`${base}/-/commit/${t.sha}`}>{t.message}</a>
                      </span>
                      <span>·</span>
                      <TimeAgo value={t.date} />
                    </div>
                  </div>
                </div>
                <div className="row-fixed-content controls flex-row gl-display-flex" style={{ gap: 8 }}>
                  <a className="btn gl-button btn-default btn-icon" title="Browse files"
                    aria-label="Browse files" href={`${base}/-/tree/${t.name}`}><Icon name="folder" /></a>
                  {/* AUDIT P2-1 — live now that `dataManager.deleteRefs` exists;
                      the deletion rides `state.repo.tagDeletions[fullPath]`. */}
                  <button type="button" className="gl-button btn btn-icon btn-md btn-default js-delete-tag-button"
                    onClick={() => setState(prev => deleteRefs(prev, project, 'tag', [t.name]))}
                    title="Delete tag" aria-label="Delete tag"><Icon name="close" /></button>
                </div>
              </li>
            ))}
          </ul>
        ) : search ? (
          <div className="nothing-here-block">Sorry, your filter produced no results.</div>
        ) : (
          <div className="nothing-here-block">
            Repository has no tags yet.
            <br />
            <small>
              Use git tag command to add a new one:
              <br />
              <span className="monospace">git tag -a v1.4 -m &apos;version 1.4&apos;</span>
            </small>
          </div>
        )}
      </div>
    </div>
  )
}
