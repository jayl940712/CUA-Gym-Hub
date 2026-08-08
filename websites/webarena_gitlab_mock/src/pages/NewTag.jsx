import React, { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { getBranches, getTags, getCommits, defaultBranchOf } from '../utils/dataManager.js'
import { gitStamp } from '../components/create/mutations.js'

// ROUTES #56 — `/:ns/:proj/-/tags/new`. Writes state.repo.tagOverlay.

export default function NewTag() {
  const { state, pushRepoOverlay } = useApp()
  const { project, base } = useProject()
  const navigate = useNavigate()
  const location = useLocation()

  usePageChrome({
    title: project
      ? `New Tag · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  const [name, setName] = useState('')
  const [from, setFrom] = useState(project ? defaultBranchOf(project) : 'main')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  if (!project) return <NotFound />

  const branches = getBranches(state, project)

  function submit(e) {
    e.preventDefault()
    const tagName = name.trim()
    if (!tagName) { setError('Tag name is required'); return }
    if (getTags(state, project).some(t => t.name === tagName)) { setError('Tag already exists'); return }

    const head = getCommits(state, project, from)[0]
    pushRepoOverlay('tagOverlay', project.full_path, [{
      name: tagName,
      sha: head ? head.sha : '00000000',
      date: head ? head.committed_date : gitStamp(),
      message: message || (head ? head.title : tagName),
    }])
    navigate(`${base}/-/tags${location.search}`)
  }

  return (
    <div>
      <h3 className="page-title">New Tag</h3>
      <form className="gl-mt-3" onSubmit={submit}>
        {error ? <div className="gl-alert gl-alert-danger gl-mb-3"><div className="gl-alert-body">{error}</div></div> : null}
        <div className="form-group gl-form-group">
          <label htmlFor="tag_name">Tag name</label>
          <input id="tag_name" name="tag_name" required autoFocus className="form-control gl-form-input"
            value={name} onChange={e => { setName(e.target.value); setError('') }} />
        </div>
        <div className="form-group gl-form-group">
          <label htmlFor="tag_ref">Create from</label>
          <select id="tag_ref" name="ref" className="gl-form-select custom-select"
            value={from} onChange={e => setFrom(e.target.value)}>
            {branches.map(b => <option key={b.name} value={b.name}>{b.name}</option>)}
          </select>
          <small className="form-text text-gl-muted">Existing branch name, tag, or commit SHA</small>
        </div>
        <div className="form-group gl-form-group">
          <label htmlFor="tag_message">Message</label>
          <textarea id="tag_message" name="message" rows={5}
            className="form-control gl-form-input gl-form-textarea"
            value={message} onChange={e => setMessage(e.target.value)} />
          <small className="form-text text-gl-muted">Optionally, add a message to the tag.</small>
        </div>
        <div className="form-actions gl-display-flex" style={{ gap: 8 }}>
          <button type="submit" className="btn gl-button btn-confirm">Create tag</button>
          <a className="btn gl-button btn-default" href={`${base}/-/tags`}>Cancel</a>
        </div>
      </form>
    </div>
  )
}
