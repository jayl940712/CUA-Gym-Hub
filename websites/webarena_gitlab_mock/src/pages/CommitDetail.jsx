import React from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import Icon from '../components/layout/Icon.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { getCommits, getBranches, getTags, defaultBranchOf } from '../utils/dataManager.js'
import { shortSha } from '../utils/format.js'

// ROUTES #52 — `/:ns/:proj/-/commit/:sha`.
//
// The mock has no git, so there is no real diff to show. The page renders
// everything that IS derivable from commits.json — title, author, both
// timestamps, the full and short SHA, the parent link, and the refs the commit
// is reachable from — rather than faking a hunk-level diff.

export default function CommitDetail() {
  const { sha } = useParams()
  const { state } = useApp()
  const { project, base } = useProject()

  usePageChrome({
    title: project
      ? `${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  if (!project) return <NotFound />

  const dflt = defaultBranchOf(project)
  const list = getCommits(state, project, dflt)
  const idx = list.findIndex(c => c.sha === sha || c.sha.startsWith(sha))
  const commit = idx === -1 ? null : list[idx]

  if (!commit) {
    return (
      <div className="row empty-state">
        <div className="gl-empty-state-content">
          <h4>Commit not found</h4>
          <p>
            No commit with the reference <code>{sha}</code> exists in this repository.
          </p>
          <a className="btn gl-button btn-confirm" href={`${base}/-/commits/${dflt}`}>Browse commits</a>
        </div>
      </div>
    )
  }

  const parent = list[idx + 1] || null
  const refs = [
    ...getBranches(state, project).filter(b => b.sha === commit.sha || commit.sha.startsWith(b.sha))
      .map(b => ({ kind: 'branch', name: b.name })),
    ...getTags(state, project).filter(t => t.sha === commit.sha || commit.sha.startsWith(t.sha))
      .map(t => ({ kind: 'tag', name: t.name })),
  ]

  return (
    <div>
      <div className="commit-box">
        <div className="commit-header gl-display-flex gl-align-items-center gl-mb-3" style={{ gap: 12 }}>
          <UserAvatar user={{ id: 0, name: commit.author_name }} size={40} />
          <div className="gl-flex-grow-1">
            <h3 className="commit-title gl-mb-1" data-qa-selector="commit_title">{commit.title}</h3>
            <div className="committer gl-text-gray-500">
              <a className="commit-author-link" href={`mailto:${commit.author_email}`}>{commit.author_name}</a>
              {' authored '}
              <TimeAgo value={commit.authored_date} />
            </div>
          </div>
          <div className="commit-actions gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
            <div className="commit-sha-group btn-group gl-display-flex">
              <div className="label label-monospace monospace">{shortSha(commit.sha)}</div>
              <button type="button" className="btn gl-button btn-default btn-icon"
                title="Copy commit SHA" aria-label="Copy commit SHA" data-clipboard-text={commit.sha}
                onClick={() => navigator.clipboard && navigator.clipboard.writeText(commit.sha)}>
                <Icon name="copy" />
              </button>
            </div>
            <a className="btn gl-button btn-default" title="Browse Files" href={`${base}/-/tree/${commit.sha}`}>
              Browse files
            </a>
          </div>
        </div>

        <div className="commit-info-row gl-text-gray-500 gl-mb-3">
          <div>{`Commit ${commit.sha}`}</div>
          {parent ? (
            <div>
              {'Parent '}
              <a className="gl-font-monospace" href={`${base}/-/commit/${parent.sha}`}>{shortSha(parent.sha)}</a>
            </div>
          ) : <div>This is the root commit.</div>}
          <div>
            {'Committed '}<TimeAgo value={commit.committed_date} />
          </div>
          {refs.length ? (
            <div className="gl-display-flex gl-align-items-center gl-mt-2" style={{ gap: 6 }}>
              <span>Contained in:</span>
              {refs.map(r => (
                <a key={`${r.kind}-${r.name}`} className="gl-badge badge badge-pill badge-muted sm"
                  href={`${base}/-/tree/${r.name}`}>{r.name}</a>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="files-changed gl-mt-5">
        <div className="gl-alert gl-alert-info">
          <div className="gl-alert-body">
            Changes are not available for this commit. Browse the repository at this revision to see
            its contents.
          </div>
          <div className="gl-alert-actions">
            <a className="gl-alert-action btn btn-confirm btn-md gl-button" href={`${base}/-/tree/${commit.sha}`}>
              Browse files
            </a>
            <a className="gl-alert-action btn btn-default btn-md gl-button" href={`${base}/-/commits/${dflt}`}>
              All commits
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
