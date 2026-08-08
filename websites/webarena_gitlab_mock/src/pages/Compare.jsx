import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'
import { getBranches, getTags, getCommits, defaultBranchOf } from '../utils/dataManager.js'
import { shortSha } from '../utils/format.js'

// ROUTES #61 — `/:ns/:proj/-/compare?from=&to=`.
//
// Without git there is no real diff. What IS derivable from commits.json is the
// commit-set difference between the two refs, which is what the branch list's
// "N commits behind / N ahead" numbers mean, so that is what this renders.

export default function Compare() {
  const { state } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  const navigate = useNavigate()

  usePageChrome({
    title: project
      ? `Compare · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  const dflt = project ? defaultBranchOf(project) : 'main'
  const [from, setFrom] = useState(q.get('from') || dflt)
  const [to, setTo] = useState(q.get('to') || dflt)

  if (!project) return <NotFound />

  const refs = [...getBranches(state, project).map(b => b.name), ...getTags(state, project).map(t => t.name)]
  const submitted = q.get('from') && q.get('to')

  const fromShas = new Set(getCommits(state, project, q.get('from') || dflt).map(c => c.sha))
  const toCommits = getCommits(state, project, q.get('to') || dflt)
  const ahead = toCommits.filter(c => !fromShas.has(c.sha))

  function submit(e) {
    e.preventDefault()
    const p = new URLSearchParams(q.searchParams)
    p.set('from', from)
    p.set('to', to)
    navigate(`${base}/-/compare?${p.toString()}`)
  }

  return (
    <div>
      <h3 className="page-title">Compare revisions</h3>
      <p className="gl-text-gray-500">
        Select a branch, tag or commit SHA to compare. Changes are shown as if the
        <b> source </b> revision was being merged into the <b>target</b> revision.
      </p>

      <form className="gl-display-flex gl-align-items-flex-end gl-mb-5" style={{ gap: 12 }} onSubmit={submit}>
        <div className="form-group gl-form-group">
          <label htmlFor="compare-from">Source</label>
          <select id="compare-from" name="from" className="gl-form-select custom-select"
            value={from} onChange={e => setFrom(e.target.value)}>
            {refs.map(r => <option key={`f-${r}`} value={r}>{r}</option>)}
          </select>
        </div>
        <div className="form-group gl-form-group">
          <label htmlFor="compare-to">Target</label>
          <select id="compare-to" name="to" className="gl-form-select custom-select"
            value={to} onChange={e => setTo(e.target.value)}>
            {refs.map(r => <option key={`t-${r}`} value={r}>{r}</option>)}
          </select>
        </div>
        <button type="submit" className="btn gl-button btn-confirm">Compare</button>
        <a className="btn gl-button btn-default"
          href={`${base}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(to)}&merge_request%5Btarget_branch%5D=${encodeURIComponent(from)}`}>
          Create merge request
        </a>
      </form>

      {submitted ? (
        <div className="commits">
          <h4 className="gl-mb-3">
            {`${ahead.length} ${ahead.length === 1 ? 'commit' : 'commits'} behind ${q.get('from')}, ${ahead.length} ${ahead.length === 1 ? 'commit' : 'commits'} ahead`}
          </h4>
          {ahead.length ? (
            <ul className="content-list commit-list">
              {ahead.slice(0, 100).map(c => (
                <li className="commit" key={c.sha}>
                  <div className="gl-display-flex gl-align-items-center" style={{ gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <a className="commit-row-message item-title" href={`${base}/-/commit/${c.sha}`}>{c.title}</a>
                      <div className="committer gl-text-gray-500 gl-font-sm">
                        <span className="commit-author-link">{c.author_name}</span>
                        {' authored '}<TimeAgo value={c.authored_date} />
                      </div>
                    </div>
                    <a className="commit-sha-group btn gl-button btn-default btn-sm gl-font-monospace"
                      href={`${base}/-/commit/${c.sha}`}>{shortSha(c.sha)}</a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="nothing-here-block">
              There isn&apos;t anything to compare. {q.get('from')} and {q.get('to')} are the same.
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
