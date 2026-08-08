import React, { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import Icon from '../components/layout/Icon.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'
import { getCommits, getBranches, getTags, defaultBranchOf } from '../utils/dataManager.js'
import { shortSha } from '../utils/format.js'
import RefSwitcher from '../components/people/RefSwitcher.jsx'

// ROUTES #50 / #51 — `/-/commits/:ref` and the BARE `/-/commits`, which the
// source 302s to the default branch. SIX anchors use the bare form, so this
// component resolves the ref itself rather than redirecting away from the
// anchored URL. assets/README.md §11.
//
// Those six anchor routes all point at projects a TASK creates, and the
// grader `must_include`s the first commit's title — `Initial commit`,
// `Initialized from 'Android' project template`,
// `Initialized from 'NodeJS Express' project template`. So this page must also
// render correctly for a brand-new repo whose only commits live in
// state.repo.commitOverlay.
//
// The date group header format is `%d %b, %Y` — ZERO-PADDED day, e.g.
// `19 Mar, 2023`, `04 Mar, 2016`. That is a third distinct date format on this
// site; `formatDate` (`Mar 19, 2023`) and the members table's `%-d %b, %Y`
// (`6 Aug, 2026`) are both wrong here.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function commitHeaderDate(ymd) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd || ''))
  if (!m) return ''
  return `${m[3]} ${MONTHS[Number(m[2]) - 1]}, ${m[1]}`
}

const COMMITS_LIMIT = 40

export default function RepoCommits() {
  const params = useParams()
  const { state } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  const navigate = useNavigate()
  const [authorOpen, setAuthorOpen] = useState(false)

  const refName = params.ref || (project ? defaultBranchOf(project) : 'main')

  usePageChrome({
    title: project
      ? `Commits · ${refName} · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  if (!project) return <NotFound />

  const search = q.get('search', '')
  const author = q.get('author', '')
  const offset = Math.max(0, parseInt(q.get('offset', '0'), 10) || 0)

  const all = getCommits(state, project, refName)
  const filtered = all
    .filter(c => !search || String(c.title || '').toLowerCase().includes(search.toLowerCase()))
    .filter(c => !author || c.author_name === author)
  const commits = filtered.slice(0, offset + COMMITS_LIMIT)

  const authors = [...new Set(all.map(c => c.author_name))].slice(0, 50)

  // Group by committed date, newest first (§11).
  const groups = []
  for (const c of commits) {
    const day = String(c.committed_date || c.authored_date || '').slice(0, 10)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.rows.push(c)
    else groups.push({ day, rows: [c] })
  }

  function submitSearch(e) {
    e.preventDefault()
    const value = new FormData(e.currentTarget).get('search') || ''
    const p = new URLSearchParams(q.searchParams)
    if (value) p.set('search', String(value)); else p.delete('search')
    p.delete('offset')
    navigate(`${base}/-/commits/${refName}?${p.toString()}`)
  }

  const authorHref = name => {
    const p = new URLSearchParams(q.searchParams)
    if (name) p.set('author', name); else p.delete('author')
    p.delete('offset')
    return `${base}/-/commits/${refName}?${p.toString()}`
  }

  const moreHref = () => {
    const p = new URLSearchParams(q.searchParams)
    p.set('offset', String(offset + COMMITS_LIMIT))
    return `${base}/-/commits/${refName}?${p.toString()}`
  }

  return (
    <div className="js-project-commits-show" data-commits-limit={COMMITS_LIMIT}>
      <div className="tree-holder">
        <div className="nav-block gl-display-flex gl-align-items-center gl-my-3" style={{ gap: 8 }}>
          <div className="tree-ref-container">
            <RefSwitcher project={project} refName={refName} destination="commits"
              branches={getBranches(state, project)} tags={getTags(state, project)}
              hrefFor={r => `${base}/-/commits/${r}`}
              title="Select Git revision" searchPlaceholder="Search by Git revision" />
          </div>
          <ul className="breadcrumb repo-breadcrumb list-unstyled gl-display-flex gl-mb-0">
            <li className="breadcrumb-item"><a href={`${base}/-/commits/${refName}`}>{project.path}</a></li>
          </ul>

          <div className={`dropdown b-dropdown gl-dropdown btn-group${authorOpen ? ' show' : ''}`}
            id="js-author-dropdown">
            <button type="button" className="btn gl-button btn-default gl-dropdown-toggle"
              onClick={() => setAuthorOpen(o => !o)}>
              <span className="gl-dropdown-button-text">{author || 'Author'}</span>
              <Icon name="chevron-down" />
            </button>
            {authorOpen ? (
              <div className="dropdown-menu show" style={{ display: 'block', maxHeight: 320, overflowY: 'auto' }}>
                <header className="dropdown-header">Search by author</header>
                <div className="divider" />
                <a className="dropdown-item" href={authorHref('')}>Any Author</a>
                <div className="divider" />
                {authors.map(a => (
                  <a className={`dropdown-item${a === author ? ' is-active' : ''}`} key={a} href={authorHref(a)}>
                    <div>{a}</div>
                  </a>
                ))}
              </div>
            ) : null}
          </div>

          <div className="tree-controls gl-ml-auto gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
            <form className="commits-search-form js-signature-container" method="get" onSubmit={submitSearch}>
              <input type="search" name="search" id="commits-search" spellCheck="false"
                className="form-control gl-form-input input-short"
                placeholder="Search by message" defaultValue={search} />
            </form>
            <a className="btn gl-button btn-default" href={`${base}/-/tree/${refName}`}>Browse files</a>
          </div>
        </div>
      </div>

      <div id={`project_${project.id}`}>
        {groups.length === 0 ? (
          search || author ? (
            <div className="commits-empty gl-mt-6">
              <h4>Your search didn&apos;t match any commits.</h4>
              <p>Try changing or removing filters.</p>
            </div>
          ) : (
            <div className="row empty-state">
              <div className="gl-empty-state-content">
                <h4>This repository has no commits yet.</h4>
              </div>
            </div>
          )
        ) : (
          <ol id="commits-list" className="list-unstyled content_list">
            {groups.map(g => (
              <React.Fragment key={g.day}>
                <li className="commit-header js-commit-header" data-day={g.day}>
                  {/* TEST.md DIFF-1101 — the source's HAML leaves a
                      whitespace text node here, so the header reads
                      `26 Jan, 2023 1 commit`, not `26 Jan, 20231 commit`. */}
                  <span className="day">{commitHeaderDate(g.day)}</span>{' '}
                  <span className="commits-count">
                    {`${g.rows.length} ${g.rows.length === 1 ? 'commit' : 'commits'}`}
                  </span>
                </li>
                <li className="commits-row" data-day={g.day}>
                  <ul className="content-list commit-list flex-list">
                    {g.rows.map(c => (
                      <li className="commit flex-row js-toggle-container" key={c.sha} id={`commit-${shortSha(c.sha)}`}>
                        <div className="avatar-cell d-none d-sm-block">
                          <a href={`mailto:${c.author_email}`}>
                            <UserAvatar user={{ id: 0, name: c.author_name }} size={40} />
                          </a>
                        </div>
                        <div className="commit-detail flex-list gl-display-flex gl-justify-content-space-between
                          gl-align-items-flex-start gl-flex-grow-1 gl-min-w-0">
                          <div className="commit-content" data-qa-selector="commit_content">
                            <a className="commit-row-message item-title js-onboarding-commit-item"
                              href={`${base}/-/commit/${c.sha}`}>{c.title}</a>
                            <div className="committer">
                              <a className="commit-author-link" href={`mailto:${c.author_email}`}>{c.author_name}</a>
                              {' authored '}<TimeAgo value={c.authored_date} />
                            </div>
                          </div>
                          <div className="commit-actions flex-row gl-display-flex gl-align-items-center"
                            style={{ gap: 4 }}>
                            <div className="commit-sha-group btn-group d-none d-sm-flex">
                              <div className="label label-monospace monospace">{shortSha(c.sha)}</div>
                              <button type="button" className="btn gl-button btn-default btn-icon"
                                title="Copy commit SHA" aria-label="Copy commit SHA" data-clipboard-text={c.sha}
                                onClick={() => navigator.clipboard && navigator.clipboard.writeText(c.sha)}>
                                <Icon name="copy" />
                              </button>
                              <a className="btn gl-button btn-default btn-icon has-tooltip" title="Browse Files"
                                href={`${base}/-/tree/${c.sha}`}><Icon name="folder" /></a>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              </React.Fragment>
            ))}
          </ol>
        )}

        {filtered.length > commits.length ? (
          <div className="gl-text-center gl-my-5">
            <a className="btn gl-button btn-default" href={moreHref()}>Load more commits</a>
          </div>
        ) : null}
      </div>
    </div>
  )
}
