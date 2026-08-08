import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'
import Icon from '../components/layout/Icon.jsx'
import { labelIsLight } from '../components/issuable/Controls.jsx'
import { renderMarkdown } from '../utils/markdown.js'
import Dropdown from '../components/ui/Dropdown.jsx'
import QueryForm from '../components/ui/QueryForm.jsx'
import { dbStamp } from '../components/create/mutations.js'
import { labelFilterUrl } from '../utils/issuableUrl.js'

// ROUTES #87 — `/:ns/:proj/-/labels`. assets/README.md §16a.
//
// Headings are title-cased on BOTH words: `Prioritized Labels` / `Other Labels`
// (§16a, and TODO.md P2 calls it out because it is easy to get wrong).

const SORTS = [
  ['name_asc', 'Name'],
  ['name_desc', 'Name, descending'],
  ['created_desc', 'Last created'],
  ['created_asc', 'Oldest created'],
  ['updated_desc', 'Updated date'],
  ['updated_asc', 'Oldest updated'],
]

const PER_PAGE = 20

/** `Gitlab::IssuesLabels.generate` — the 8 defaults, verbatim (§16a). */
export const DEFAULT_LABELS = [
  ['bug', '#d9534f'], ['critical', '#d9534f'], ['confirmed', '#d9534f'],
  ['documentation', '#f0ad4e'], ['support', '#f0ad4e'], ['discussion', '#428bca'],
  ['suggestion', '#428bca'], ['enhancement', '#5cb85c'],
]

function LabelRow({ label, project, canAdmin, onDelete, subscribed, onToggleSubscribe, onTogglePriority, prioritized }) {
  const [menu, setMenu] = useState(false)
  const base = `/${project.full_path}`
  const light = labelIsLight(label.color)
  // TEST.md DIFF-1303 — the source's server-rendered href here is
  // `/-/issues?label_name%5B%5D=help+wanted` (§16a, assets/html/labels-a11y.html),
  // but its issue list rewrites the URL on arrival to the slash-and-`%20` form
  // that webarena-102…105 and 339…343 are graded against. The mock has no
  // equivalent rewrite, so it emits the landing form directly — this is the only
  // click path to the anchor URL for a label that no sampled issue carries
  // (webarena-103's `question` on kkroening/ffmpeg-python).
  const projectTitle = `${project.namespace ? `${project.namespace.name} / ` : ''}${project.path || project.name}`

  return (
    <li className="label-list-item gl-p-5 gl-border-b" id={`project_label_${label.id}`} data-id={label.id}>
      <div className="gl-display-flex" style={{ gap: 16, alignItems: 'flex-start' }}>
        <div className="label-name gl-flex-shrink-0 gl-mt-2 gl-mr-5">
          <span className="gl-label">
            <span className={`gl-label-text ${light ? 'gl-label-text-dark' : 'gl-label-text-light'}`}
              style={{ backgroundColor: label.color, padding: '0 8px', borderRadius: 12, color: light ? '#333238' : '#fff' }}>
              {label.title}</span>
          </span>
        </div>
        <div className="label-description gl-w-full">
          <div className="gl-display-flex gl-mt-2" style={{ gap: 16, flexWrap: 'wrap' }}>
            <div className="gl-flex-basis-half gl-flex-grow-1 gl-mr-5">
              {label.description
                ? <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(label.description) }} />
                : <div className="label-badge gl-bg-gray-50 gl-max-w-full gl-text-truncate" title={projectTitle}
                  style={{ display: 'inline-block', background: 'var(--gray-50, #ececef)', padding: '2px 8px', borderRadius: 4 }}>
                  {projectTitle}</div>}
            </div>
            <ul className="label-links gl-m-0 gl-p-0 gl-white-space-nowrap list-unstyled">
              <li className="inline"><a className="gl-text-blue-600!"
                href={labelFilterUrl(`${base}/-/issues`, label.title)}>Issues</a></li>
              {' · '}
              <li className="inline"><a className="gl-text-blue-600!"
                href={labelFilterUrl(`${base}/-/merge_requests`, label.title)}>Merge requests</a></li>
              {prioritized ? (
                <li className="js-priority-badge inline gl-ml-3">
                  <div className="label-badge gl-bg-blue-50">Prioritized label</div></li>
              ) : null}
            </ul>
          </div>
        </div>
        <ul className="label-actions-list list-unstyled gl-display-flex gl-ml-auto" style={{ gap: 4 }}>
          {canAdmin ? (
            <>
              <li className="gl-display-inline-block js-toggle-priority gl-ml-3">
                {prioritized ? (
                  <button type="button" className="btn gl-button btn-default-tertiary btn-icon remove-priority has-tooltip"
                    title="Remove priority" aria-label="Deprioritize label" onClick={onTogglePriority}>
                    <Icon name="star" /></button>
                ) : (
                  <button type="button" className="btn gl-button btn-default-tertiary btn-icon add-priority has-tooltip"
                    title="Prioritize" aria-label="Prioritize label" onClick={onTogglePriority}>
                    <Icon name="star" /></button>
                )}
              </li>
              <li><a className="edit has-tooltip btn gl-button btn-default-tertiary btn-icon"
                href={`${base}/-/labels/${label.id}/edit`} title="Edit" aria-label="Edit">
                <Icon name="pencil" /></a></li>
              <li>
                <div className={`dropdown${menu ? ' show' : ''}`}>
                  <button type="button" className="js-label-options-dropdown btn gl-button btn-default-tertiary btn-icon"
                    aria-label="Label actions dropdown" onClick={() => setMenu(m => !m)}>⋮</button>
                  <div className="dropdown-menu dropdown-open-left dropdown-menu-right">
                    <ul><li><span>
                      <button type="button" data-label-name={label.title} data-subject-name={project.path || project.name}
                        data-destroy-path={`${base}/-/labels/${label.id}`}
                        className="gl-button btn btn-md btn-default btn-default-tertiary text-danger js-delete-label-modal-button"
                        onClick={() => { setMenu(false); onDelete(label) }}>
                        <span className="gl-button-text">Delete</span></button>
                    </span></li></ul>
                  </div>
                </div>
              </li>
            </>
          ) : null}
          <li className="label-subscription js-label-subscription gl-ml-3">
            <button type="button" className="btn gl-button btn-default js-subscribe-button gl-w-full"
              title="Subscribe at project level" onClick={onToggleSubscribe}>
              {subscribed ? 'Unsubscribe' : 'Subscribe'}</button>
          </li>
        </ul>
      </div>
    </li>
  )
}

export default function LabelsList() {
  const { state, setUi, removeFrom, appendTo, allocateId } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  const [pendingDelete, setPendingDelete] = useState(null)

  usePageChrome({
    title: project
      ? `Labels · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
  })
  if (!project) return <NotFound />

  const all = state.labels.filter(l => l.project_id === project.id)
  const search = (q.get('search') || '').trim().toLowerCase()
  const subscribedOnly = q.get('subscribed') === 'true'
  const sort = q.get('sort', 'name_asc')
  const page = Math.max(1, parseInt(q.get('page', '1'), 10) || 1)

  const subscriptions = (state.ui && state.ui.labelSubscriptions) || []
  const priorities = (state.ui && state.ui.prioritizedLabels) || []

  let rows = all
  if (search) {
    rows = rows.filter(l => l.title.toLowerCase().includes(search)
      || String(l.description || '').toLowerCase().includes(search))
  }
  if (subscribedOnly) rows = rows.filter(l => subscriptions.includes(l.id))

  const ts = v => (v ? new Date(String(v).replace(' ', 'T')).getTime() : 0)
  rows = [...rows].sort((a, b) => {
    switch (sort) {
      case 'name_desc': return b.title.localeCompare(a.title)
      case 'created_desc': return ts(b.created_at) - ts(a.created_at)
      case 'created_asc': return ts(a.created_at) - ts(b.created_at)
      case 'updated_desc': return ts(b.updated_at || b.created_at) - ts(a.updated_at || a.created_at)
      case 'updated_asc': return ts(a.updated_at || a.created_at) - ts(b.updated_at || b.created_at)
      default: return a.title.localeCompare(b.title)
    }
  })

  const prioritizedRows = rows.filter(l => priorities.includes(l.id))
  const otherRows = rows.filter(l => !priorities.includes(l.id))
  const pageRows = otherRows.slice((page - 1) * PER_PAGE, page * PER_PAGE)
  const totalPages = Math.max(1, Math.ceil(otherRows.length / PER_PAGE))

  const toggleSubscribe = id => setUi(ui => ({
    labelSubscriptions: (ui.labelSubscriptions || []).includes(id)
      ? (ui.labelSubscriptions || []).filter(x => x !== id)
      : [...(ui.labelSubscriptions || []), id],
  }))
  const togglePriority = id => setUi(ui => ({
    prioritizedLabels: (ui.prioritizedLabels || []).includes(id)
      ? (ui.prioritizedLabels || []).filter(x => x !== id)
      : [...(ui.prioritizedLabels || []), id],
  }))

  function generateDefaults() {
    const existing = new Set(all.map(l => l.title))
    for (const [title, color] of DEFAULT_LABELS) {
      if (existing.has(title)) continue
      appendTo('labels', {
        id: allocateId('label'),
        project_id: project.id,
        title,
        color,
        description: '',
        created_at: dbStamp(),
      })
    }
  }

  // §16a: the whole `.top-area` is absent when the project has no labels and
  // there is no search/subscribed param.
  if (all.length === 0 && !search && !subscribedOnly) {
    return (
      <div className="row empty-state labels">
        <div className="col-12"><div className="text-content text-center">
          <h4>Labels can be applied to issues and merge requests to categorize them.</h4>
          <p>You can also star a label to make it a priority label.</p>
          <div className="text-center gl-display-flex gl-justify-content-center" style={{ gap: 8 }}>
            <a className="btn gl-button btn-confirm" title="New label" id="new_label_link"
              href={`${base}/-/labels/new`}>New label</a>
            <button type="button" className="btn gl-button btn-confirm-secondary" id="generate_labels_link"
              title="Generate a default set of labels" onClick={generateDefaults}>
              Generate a default set of labels</button>
          </div>
        </div></div>
      </div>
    )
  }

  const pageLink = n => {
    const p = new URLSearchParams(q.searchParams)
    if (n <= 1) p.delete('page'); else p.set('page', String(n))
    const s = p.toString()
    return s ? `${base}/-/labels?${s}` : `${base}/-/labels`
  }

  return (
    <div>
      <div className="top-area adjust">
        <ul className="gl-flex-grow-1 gl-border-0 nav gl-tabs-nav">
          <li className="nav-item"><a
            className={`nav-link gl-tab-nav-item${subscribedOnly ? '' : ' active gl-tab-nav-item-active'}`}
            href={`${base}/-/labels`}>All</a></li>
          <li className="nav-item"><a
            className={`nav-link gl-tab-nav-item${subscribedOnly ? ' active gl-tab-nav-item-active' : ''}`}
            href={`${base}/-/labels?subscribed=true`}>Subscribed</a></li>
        </ul>
        <div className="nav-controls">
          <QueryForm action={`${base}/-/labels`} className="gl-display-flex" style={{ gap: 4 }}>
            <input id="label-search" className="form-control search-text-input input-short" type="search"
              name="search" placeholder="Filter" spellCheck={false} defaultValue={q.get('search', '')} />
            {subscribedOnly ? <input type="hidden" id="subscribed" name="subscribed" value="true" readOnly /> : null}
            <input type="hidden" name="sort" value={sort} readOnly />
            <button type="submit" aria-label="Submit search" className="btn gl-button btn-default btn-icon">
              <Icon name="search" /></button>
          </QueryForm>
          <Dropdown className="dropdown"
            toggleClassName="btn gl-button btn-default gl-dropdown-toggle"
            toggleProps={{ 'data-testid': 'base-dropdown-toggle', 'aria-haspopup': 'listbox' }}
            toggle={<>
              <span className="gl-dropdown-button-text">{(SORTS.find(s => s[0] === sort) || SORTS[0])[1]}</span>
              <Icon name="chevron-down" />
            </>}
            menuClassName="dropdown-menu dropdown-menu-right"
            menuProps={{ 'data-testid': 'base-dropdown-menu' }}>
            <ul id="listbox" role="listbox">
              {SORTS.map(([v, l]) => {
                const p = new URLSearchParams(q.searchParams)
                p.set('sort', v)
                return <li key={v} className="gl-dropdown-item gl-listbox-item" role="option">
                  <a href={`${base}/-/labels?${p.toString()}`}>{l}</a></li>
              })}
            </ul>
          </Dropdown>
          <a className="gl-button btn btn-md btn-confirm" data-qa-selector="create_new_label_button"
            href={`${base}/-/labels/new`}>New label</a>
        </div>
      </div>

      <div className="labels-container gl-mt-5">
        {!search ? (
          <p className="text-muted">Labels can be applied to issues and merge requests. Star a label to make it a priority label.</p>
        ) : null}

        {subscribedOnly && rows.length === 0 ? (
          <div className="nothing-here-block">You do not have any subscriptions yet</div>
        ) : search && rows.length === 0 ? (
          <div className="nothing-here-block">No labels with such name or description</div>
        ) : (
          <>
            {!search ? (
              <div className="prioritized-labels gl-mb-7">
                <h4 className="gl-mt-3">Prioritized Labels</h4>
                <p className="text-muted">Drag to reorder prioritized labels and change their relative priority.</p>
                <div className="manage-labels-list js-prioritized-labels">
                  {prioritizedRows.length === 0 ? (
                    <div id="js-priority-labels-empty-state" className="priority-labels-empty-state">
                      <p>Star labels to start sorting by priority</p>
                    </div>
                  ) : (
                    <ul className="content-list list-unstyled">
                      {prioritizedRows.map(l => (
                        <LabelRow key={l.id} label={l} project={project} canAdmin prioritized
                          subscribed={subscriptions.includes(l.id)}
                          onToggleSubscribe={() => toggleSubscribe(l.id)}
                          onTogglePriority={() => togglePriority(l.id)}
                          onDelete={setPendingDelete} />
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}

            <div className="other-labels">
              {!search ? <h4>Other Labels</h4> : null}
              <div className="manage-labels-list js-other-labels">
                {pageRows.length === 0 ? (
                  <div className="nothing-here-block">No other labels with such name or description</div>
                ) : (
                  <ul className="content-list list-unstyled">
                    {pageRows.map(l => (
                      <LabelRow key={l.id} label={l} project={project} canAdmin
                        subscribed={subscriptions.includes(l.id)}
                        onToggleSubscribe={() => toggleSubscribe(l.id)}
                        onTogglePriority={() => togglePriority(l.id)}
                        onDelete={setPendingDelete} />
                    ))}
                  </ul>
                )}
                {totalPages > 1 ? (
                  <div className="gl-pagination gl-mt-3">
                    <ul className="pagination justify-content-center">
                      <li className={`page-item js-previous-button${page === 1 ? ' disabled' : ''}`}>
                        <a className="page-link" href={page === 1 ? '#' : pageLink(page - 1)}>Prev</a></li>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(n => (
                        <li key={n} className={`page-item js-pagination-page${n === page ? ' active' : ''}`}>
                          <a className="page-link" href={pageLink(n)}>{n}</a></li>
                      ))}
                      <li className={`page-item js-next-button${page === totalPages ? ' disabled' : ''}`}>
                        <a className="page-link" href={page === totalPages ? '#' : pageLink(page + 1)}>Next</a></li>
                    </ul>
                  </div>
                ) : null}
              </div>
            </div>
          </>
        )}
      </div>

      {pendingDelete ? (
        <>
          <div className="modal-backdrop" onClick={() => setPendingDelete(null)} />
          <div className="modal show" role="dialog">
            <div className="modal-dialog"><div className="modal-content">
              <div className="modal-header">
                <h4 className="modal-title">Delete label: {pendingDelete.title}</h4>
                <button type="button" aria-label="Close" className="close"
                  onClick={() => setPendingDelete(null)}><Icon name="close" /></button>
              </div>
              <div className="modal-body">
                <strong>{pendingDelete.title}</strong> will be permanently deleted from {project.path || project.name}. This cannot be undone.
              </div>
              <div className="modal-footer">
                <button type="button" className="btn gl-button btn-default btn-default-secondary"
                  onClick={() => setPendingDelete(null)}>Cancel</button>
                <button type="button" data-testid="delete-button" className="btn gl-button btn-danger"
                  onClick={() => { removeFrom('labels', l => l.id === pendingDelete.id); setPendingDelete(null) }}>
                  <span className="gl-button-text">Delete label</span></button>
              </div>
            </div></div>
          </div>
        </>
      ) : null}
    </div>
  )
}
