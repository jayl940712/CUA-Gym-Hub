import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { getBranches, getCommits, defaultBranchOf } from '../utils/dataManager.js'
import { gitStamp } from '../components/create/mutations.js'

// ROUTES #54 — `/:ns/:proj/-/branches/new`.
//
// A created branch lands in state.repo.branchOverlay so it survives a reload
// and shows up in /go's state_diff, and it points at the head commit of the
// source ref so the branch list renders a real SHA and message.

export default function NewBranch() {
  const { state, pushRepoOverlay } = useApp()
  const { project, base } = useProject()
  const navigate = useNavigate()
  const location = useLocation()

  usePageChrome({
    title: project
      ? `New Branch · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  const [name, setName] = useState('')
  const [from, setFrom] = useState(project ? defaultBranchOf(project) : 'main')
  const [error, setError] = useState('')

  if (!project) return <NotFound />

  const branches = getBranches(state, project)

  function submit(e) {
    e.preventDefault()
    const branchName = name.trim()
    if (!branchName) { setError('Branch name is required'); return }
    if (branches.some(b => b.name === branchName)) { setError('Branch already exists'); return }

    const head = getCommits(state, project, from)[0]
    pushRepoOverlay('branchOverlay', project.full_path, [{
      name: branchName,
      sha: head ? head.sha : '00000000',
      committed_date: head ? head.committed_date : gitStamp(),
      subject: head ? head.title : 'Initial commit',
    }])
    navigate(`${base}/-/tree/${branchName}${location.search}`)
  }

  return (
    <div>
      <h3 className="page-title">New Branch</h3>
      <form className="js-create-branch-form gl-mt-3" onSubmit={submit}>
        {error ? <div className="gl-alert gl-alert-danger gl-mb-3"><div className="gl-alert-body">{error}</div></div> : null}
        <div className="form-group gl-form-group">
          <label htmlFor="branch_name">Branch name</label>
          <input id="branch_name" name="branch_name" required autoFocus
            className="form-control gl-form-input js-branch-name"
            value={name} onChange={e => { setName(e.target.value); setError('') }} />
        </div>
        <div className="form-group gl-form-group">
          <label htmlFor="ref">Create from</label>
          <select id="ref" name="ref" className="gl-form-select custom-select"
            value={from} onChange={e => setFrom(e.target.value)}>
            {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
          <small className="form-text text-gl-muted">Existing branch name, tag, or commit SHA</small>
        </div>
        <div className="form-actions gl-display-flex" style={{ gap: 8 }}>
          <button type="submit" className="btn gl-button btn-confirm">Create branch</button>
          <a className="btn gl-button btn-default" href={`${base}/-/branches`}>Cancel</a>
        </div>
      </form>
    </div>
  )
}
