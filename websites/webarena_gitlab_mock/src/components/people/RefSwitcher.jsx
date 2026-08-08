import React, { useState } from 'react'
import Icon from '../layout/Icon.jsx'

// assets/README.md §10b.3 — the LEGACY `form.project-refs-form` ref dropdown,
// used on blob, `/-/graphs/:ref` and `/-/network/:ref`. Its copy differs from
// the newer Vue `ref-selector` on the tree page: header `Switch branch/tag`,
// search placeholder `Search branches and tags`.
//
// (Lives under components/people/ because that is this shard's owned
// component directory; it is a generic repo control.)

export default function RefSwitcher({
  project, refName, branches = [], tags = [], hrefFor, destination = 'blob', path,
  // The tree page uses the newer Vue `ref-selector` whose copy differs:
  // `Select Git revision` / `Search by Git revision`.
  title = 'Switch branch/tag',
  searchPlaceholder = 'Search branches and tags',
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const match = r => !query || r.name.toLowerCase().includes(query.toLowerCase())
  const b = branches.filter(match)
  const t = tags.filter(match)

  return (
    <form className="project-refs-form tree-ref-holder" onSubmit={e => e.preventDefault()}>
      <input type="hidden" id="destination" name="destination" value={destination} readOnly />
      {path ? <input type="hidden" name="path" value={path} readOnly /> : null}
      <div className={`dropdown${open ? ' show' : ''}`}>
        <button type="button" className="dropdown-menu-toggle js-project-refs-dropdown btn gl-button btn-default"
          data-testid="branches-select" data-qa-selector="branches_dropdown"
          aria-expanded={open} onClick={() => setOpen(o => !o)}>
          <span className="dropdown-toggle-text">{refName}</span>
          <Icon name="chevron-down" />
        </button>
        {open ? (
          <div className="dropdown-menu dropdown-menu-selectable git-revision-dropdown show"
            data-qa-selector="branches_dropdown_content" style={{ display: 'block', minWidth: 280 }}>
            <div className="dropdown-page-one">
              <div className="dropdown-title gl-display-flex">
                <span className="gl-ml-auto">{title}</span>
                <button type="button" className="dropdown-title-button dropdown-menu-close gl-ml-auto"
                  aria-label="Close" onClick={() => setOpen(false)}>×</button>
              </div>
              <div className="dropdown-input">
                <input type="search" className="dropdown-input-field form-control gl-form-input"
                  data-qa-selector="dropdown_input_field" placeholder={searchPlaceholder}
                  value={query} onChange={e => setQuery(e.target.value)} />
              </div>
              <div className="dropdown-content" style={{ maxHeight: 300, overflowY: 'auto' }}>
                {b.length ? (
                  <>
                    <div className="dropdown-header">Branches</div>
                    <ul className="list-unstyled">
                      {b.map(r => (
                        <li key={`b-${r.name}`}>
                          <a className={`dropdown-item${r.name === refName ? ' is-active' : ''}`}
                            href={hrefFor(r.name)} onClick={() => setOpen(false)}>{r.name}</a>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {t.length ? (
                  <>
                    <div className="dropdown-header">Tags</div>
                    <ul className="list-unstyled">
                      {t.map(r => (
                        <li key={`t-${r.name}`}>
                          <a className={`dropdown-item${r.name === refName ? ' is-active' : ''}`}
                            href={hrefFor(r.name)} onClick={() => setOpen(false)}>{r.name}</a>
                        </li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {!b.length && !t.length ? (
                  <div className="dropdown-item gl-text-gray-500">No matching results</div>
                ) : null}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </form>
  )
}
