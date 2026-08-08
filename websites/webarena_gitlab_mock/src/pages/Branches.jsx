import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'
import { getBranches, defaultBranchOf, deleteRefs } from '../utils/dataManager.js'
import { shortSha } from '../utils/format.js'
import Dropdown from '../components/ui/Dropdown.jsx'

// ROUTES #53 — `/:ns/:proj/-/branches` plus the `/active`, `/stale` and `/all`
// sub-paths (also expressible as `?state=`). assets/README.md §12a.
//
// Copy that is easy to get wrong and is pinned by the capture:
//   search placeholder `Filter by branch name`
//   sort options `Name` / `Oldest updated` / `Updated date` (default)
//   empty state `No branches to show` for BOTH "no branches" and "filter
//     matched nothing" (the tags page uses a different string — see §12b)
//   Overview renders TWO cards, `Active branches` / `Stale branches`, and a
//   card is omitted entirely when its set is empty.
//   Tabs carry NO counts, and the sort dropdown is hidden on Overview.

const THREE_MONTHS = 1000 * 60 * 60 * 24 * 91
const OVERVIEW_MAX = 5

const TABS = [
  { key: 'overview', label: 'Overview', suffix: '', title: 'Show overview of the branches' },
  { key: 'active', label: 'Active', suffix: '/active', title: 'Show active branches' },
  { key: 'stale', label: 'Stale', suffix: '/stale', title: 'Show stale branches' },
  { key: 'all', label: 'All', suffix: '/all', title: 'Show all branches' },
]

const SORTS = [
  { key: 'name_asc', label: 'Name' },
  { key: 'updated_asc', label: 'Oldest updated' },
  { key: 'updated_desc', label: 'Updated date' },
]

function BranchRow({ branch, project, base, isDefault, onDelete }) {
  return (
    <li className={`branch-item gl-display-flex! gl-align-items-center! js-branch-item js-branch-${branch.name}`}
      data-name={branch.name} data-qa-selector="branch_container" data-qa-name={branch.name}>
      <div className="branch-info gl-flex-grow-1">
        <div className="gl-display-flex gl-align-items-center" style={{ gap: 6 }}>
          <Icon name="fork" size={12} className="gl-flex-shrink-0" data-testid="branch-icon" />
          <a className="item-title str-truncated-100 ref-name gl-ml-3" data-qa-selector="branch_link"
            href={`${base}/-/tree/${branch.name}`}>{branch.name}</a>
          <button type="button" className="btn btn-clipboard gl-button btn-default-tertiary btn-icon btn-sm"
            title="Copy branch name" aria-label="Copy branch name" data-clipboard-text={branch.name}
            onClick={() => navigator.clipboard && navigator.clipboard.writeText(branch.name)}>
            <Icon name="copy" />
          </button>
          {isDefault ? (
            <>
              <span className="gl-badge badge badge-pill badge-info sm gl-ml-2" data-qa-selector="badge_content">default</span>
              <span className="gl-badge badge badge-pill badge-success sm gl-ml-2" data-qa-selector="badge_content">protected</span>
            </>
          ) : null}
        </div>
        <div className="block-truncated">
          <div className="branch-commit cgray gl-display-flex gl-align-items-center" style={{ gap: 6 }}>
            <a className="commit-sha" href={`${base}/-/commit/${branch.sha}`}>{shortSha(branch.sha)}</a>
            <span>·</span>
            <span className="str-truncated">
              <a className="commit-row-message cgray" href={`${base}/-/commit/${branch.sha}`}>{branch.subject}</a>
            </span>
            <span>·</span>
            <TimeAgo value={branch.committed_date} />
          </div>
        </div>
      </div>

      <div className="controls d-none d-md-block gl-display-flex" style={{ gap: 8 }}>
        {!isDefault ? (
          <a className="gl-button btn btn-md btn-default"
            href={`${base}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(branch.name)}`}>
            <span className="gl-button-text">Merge request</span>
          </a>
        ) : null}
        {!isDefault ? (
          <a className="gl-button btn btn-default js-onboarding-compare-branches" title="Compare"
            href={`${base}/-/compare?from=${encodeURIComponent(defaultBranchOf(project))}&to=${encodeURIComponent(branch.name)}`}>
            Compare
          </a>
        ) : null}
        {/* AUDIT P2-1 — live now that `dataManager.deleteRefs` exists. The
            default branch stays disabled, as on the source. */}
        <button type="button"
          className="btn js-delete-branch-button btn-default btn-md gl-button btn-icon"
          data-qa-selector="delete_branch_button"
          disabled={isDefault}
          onClick={() => onDelete && onDelete(branch.name)}
          title={isDefault ? 'The default branch cannot be deleted' : 'Delete branch'}
          aria-label={isDefault ? 'The default branch cannot be deleted' : 'Delete branch'}>
          <Icon name="close" />
        </button>
      </div>
    </li>
  )
}

export default function Branches({ tab = 'overview' }) {
  const { state, setState } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  const navigate = useNavigate()

  usePageChrome({
    title: project
      ? `Branches · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  if (!project) return <NotFound />

  const dflt = defaultBranchOf(project)
  const all = getBranches(state, project)
  const search = q.get('search', '')
  const sort = q.get('sort', 'updated_desc')

  const now = Date.now()
  const isActive = b => {
    const t = new Date(String(b.committed_date || '').replace(' ', 'T')).getTime()
    return !Number.isNaN(t) && now - t < THREE_MONTHS
  }

  const filtered = all.filter(b => !search || b.name.toLowerCase().includes(search.toLowerCase()))
  const sorted = [...filtered].sort((a, b) => {
    const ta = new Date(String(a.committed_date || '').replace(' ', 'T')).getTime() || 0
    const tb = new Date(String(b.committed_date || '').replace(' ', 'T')).getTime() || 0
    if (sort === 'name_asc') return a.name.localeCompare(b.name)
    if (sort === 'updated_asc') return ta - tb
    return tb - ta
  })

  const active = sorted.filter(isActive)
  const stale = sorted.filter(b => !isActive(b))
  const shown = tab === 'active' ? active : tab === 'stale' ? stale : sorted

  function submitSearch(e) {
    e.preventDefault()
    const value = new FormData(e.currentTarget).get('search') || ''
    const p = new URLSearchParams(q.searchParams)
    if (value) p.set('search', String(value))
    else p.delete('search')
    navigate(`${base}/-/branches${TABS.find(t => t.key === tab).suffix}?${p.toString()}`)
  }

  const sortHref = key => {
    const p = new URLSearchParams(q.searchParams)
    p.set('sort', key)
    return `${base}/-/branches${TABS.find(t => t.key === tab).suffix}?${p.toString()}`
  }

  // §12a — verified live: both "no branches at all" and "filter matched
  // nothing" render the SAME copy. (The tags page uses a different string.)
  const emptyCopy = 'No branches to show'

  // AUDIT P2-1 — deletions ride `state.repo.branchDeletions[fullPath]`, which
  // `getBranches` filters the read-through by, so they survive a reload and
  // show up in `/go`'s `state_diff`.
  const deleteBranch = name => setState(prev => deleteRefs(prev, project, 'branch', [name]))

  const renderList = rows => (
    <ul className="content-list all-branches" data-qa-selector="all_branches_container">
      {rows.map(b => (
        <BranchRow key={b.name} branch={b} project={project} base={base}
          isDefault={b.name === dflt} onDelete={deleteBranch} />
      ))}
    </ul>
  )

  return (
    <div>
      {/* The source's row carries GitLab's `!`-suffixed utilities
          (`gl-display-flex!`, `gl-align-items-center!`). Those class names
          contain a literal `!` and global.css defines none of the escaped
          `.gl-*\\!` selectors, so the row never actually flexed and the
          controls column stacked under the branch name once it became visible.
          Restated here for this page; the general `gl-*!` gap is reported. */}
      <style>{`
        .branch-item { display: flex; align-items: center; }
        .branch-item .controls { flex-shrink: 0; margin-left: auto; }
      `}</style>
      <div className="top-area gl-border-0 gl-display-flex gl-align-items-center gl-flex-wrap" style={{ gap: 12 }}>
        <ul className="gl-flex-grow-1 gl-border-b-0 nav gl-tabs-nav">
          {TABS.map(t => (
            <li className="nav-item" key={t.key}>
              <a className={`nav-link gl-tab-nav-item${tab === t.key ? ' active gl-tab-nav-item-active' : ''}`}
                title={t.title} href={`${base}/-/branches${t.suffix}`}>{t.label}</a>
            </li>
          ))}
        </ul>
        <div className="nav-controls gl-display-flex gl-align-items-center" style={{ gap: 12 }}>
          <form className="input-group gl-search-box-by-click gl-mr-3" role="group"
            data-testid="branch-search" onSubmit={submitSearch}>
            <input name="search" type="search"
              className="gl-form-input gl-search-box-by-click-input form-control"
              data-testid="branch-search" placeholder="Filter by branch name"
              aria-label="Filter by branch name" defaultValue={search} />
            <div className="input-group-append">
              <button type="submit" className="btn gl-button btn-default btn-icon"
                data-testid="search-button" aria-label="Search"><Icon name="search" /></button>
            </div>
          </form>

          {tab !== 'overview' ? (
            <Dropdown className="gl-dropdown dropdown btn-group gl-mr-3" data-testid="branches-dropdown"
              toggleProps={{ 'aria-haspopup': 'listbox' }}
              toggle={<>
                <span className="gl-dropdown-button-text">
                  {(SORTS.find(s => s.key === sort) || SORTS[2]).label}
                </span>
                <Icon name="chevron-down" />
              </>}
              menuAs="ul" menuClassName="dropdown-menu" menuProps={{ role: 'listbox' }}>
              {SORTS.map(s => (
                <li className="gl-dropdown-item gl-listbox-item" role="option" key={s.key}
                  aria-selected={s.key === sort}>
                  <a className="dropdown-item" href={sortHref(s.key)}>{s.label}</a>
                </li>
              ))}
            </Dropdown>
          ) : null}

          {/* AUDIT P2-1. GitLab's `DeleteMergedBranchesService` removes every
              branch whose tip is already contained in the default branch,
              except the default branch and protected ones. The seed's branch
              rows carry `{name, sha, committed_date, subject}` and no
              ahead/behind counts, so the only containment fact available is
              "same tip sha as the default branch" — which is the subset of
              merged branches that can be identified without a real git graph.
              Deliberately narrow rather than guessed: no branch is deleted that
              the source would have kept. */}
          <button type="button" className="btn gl-mr-3 btn-danger btn-md gl-button btn-danger-secondary"
            data-qa-selector="delete_merged_branches_button"
            onClick={() => {
              const head = (all.find(b => b.name === dflt) || {}).sha
              const merged = all
                .filter(b => b.name !== dflt && head && b.sha === head)
                .map(b => b.name)
              if (merged.length) setState(prev => deleteRefs(prev, project, 'branch', merged))
            }}>Delete merged branches</button>
          <a className="gl-button btn btn-confirm" href={`${base}/-/branches/new`}>New branch</a>
        </div>
      </div>

      <div className="js-branch-list gl-mt-3" data-default-branch={dflt}>
        {tab === 'overview' ? (
          <>
            {active.length ? (
              <div className="gl-card gl-mb-5">
                <div className="gl-card-header">Active branches</div>
                <div className="gl-card-body gl-py-0">{renderList(active.slice(0, OVERVIEW_MAX))}</div>
                {active.length > OVERVIEW_MAX ? (
                  <div className="gl-card-footer gl-text-center">
                    <a id="state-active" data-state="active" href={`${base}/-/branches/active`}>Show more active branches</a>
                  </div>
                ) : null}
              </div>
            ) : null}
            {stale.length ? (
              <div className="gl-card gl-mb-5">
                <div className="gl-card-header">Stale branches</div>
                <div className="gl-card-body gl-py-0">{renderList(stale.slice(0, OVERVIEW_MAX))}</div>
                {stale.length > OVERVIEW_MAX ? (
                  <div className="gl-card-footer gl-text-center">
                    <a id="state-stale" data-state="stale" href={`${base}/-/branches/stale`}>Show more stale branches</a>
                  </div>
                ) : null}
              </div>
            ) : null}
            {!active.length && !stale.length ? (
              <div className="nothing-here-block">{emptyCopy}</div>
            ) : null}
          </>
        ) : shown.length ? renderList(shown) : (
          <div className="nothing-here-block">{emptyCopy}</div>
        )}
      </div>
    </div>
  )
}
