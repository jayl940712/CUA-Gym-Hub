import React, { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import NotFound from './NotFound.jsx'
import useGo from '../components/create/useGo.js'
import { commitToRepo } from '../components/create/mutations.js'
import { getRepoTree, getRepoFile } from '../utils/dataManager.js'
import '../components/create/create.css'

// ROUTES #129 — `/-/ide/project/:ns/:proj/edit/:ref/-/*`.
//
// webarena-556…566 all say "Use the Web IDE to create the README", then the
// evaluator reads `/byteblaze/<repo>/-/raw/main/README.md`. It does not look at
// the IDE itself, so a two-pane editor over the same overlay is enough — what
// has to be right is the write, not the chrome (TODO.md P1-C).

export default function WebIde() {
  const { state, setState, currentUser } = useApp()
  const params = useParams()
  const go = useGo()

  const { ns, proj } = params
  const refName = params.ref || 'main'
  const openPath = params['*'] || ''
  const fullPath = `${ns}/${proj}`

  const project = state ? state.projects.find(p => p.full_path === fullPath) : null

  usePageChrome({ title: project ? `${project.name} · Web IDE · GitLab` : 'Web IDE · GitLab' })

  const tree = useMemo(
    () => (state && project ? getRepoTree(state, project, refName) : []),
    [state, project, refName],
  )

  const [selected, setSelected] = useState(openPath)
  const [draft, setDraft] = useState(null)
  const [message, setMessage] = useState('')
  const [newPath, setNewPath] = useState('')
  const [creating, setCreating] = useState(false)
  const [status, setStatus] = useState(null)

  if (!state) return null
  if (!project) return <NotFound />

  const blobs = tree.filter(e => e.type !== 'tree').map(e => e.path).sort()
  const stored = selected ? getRepoFile(state, project, refName, selected) : undefined
  const body = draft != null ? draft : (stored == null ? '' : stored)

  function open(path) {
    setSelected(path)
    setDraft(null)
    setStatus(null)
  }

  function addFile(e) {
    e.preventDefault()
    const path = newPath.trim().replace(/^\/+/, '')
    if (!path) return
    setSelected(path)
    setDraft('')
    setNewPath('')
    setCreating(false)
    setStatus(null)
  }

  function commit(e) {
    e.preventDefault()
    if (!selected) { setStatus('Select or create a file first.'); return }
    const title = message.trim() || `Update ${selected.split('/').pop()}`
    setState(prev => commitToRepo(prev, project, refName, [{ path: selected, body }],
      { title, author_name: currentUser.name, author_email: currentUser.email }))
    setDraft(null)
    setMessage('')
    setStatus(`Committed “${title}” to ${refName}.`)
  }

  return (
    <div className="create-flow">
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">Web IDE</h1>
        <div className="page-title-controls">
          <a className="btn gl-button btn-default" href={`/${fullPath}/-/tree/${refName}`}>Go to project</a>
        </div>
      </div>

      {status ? (
        <div className="gl-alert gl-alert-success gl-mb-3" role="status">
          <div className="gl-alert-content"><div className="gl-alert-body">{status}</div></div>
        </div>
      ) : null}

      <div className="ide-shell">
        <div className="ide-sidebar">
          <div className="ide-sidebar-header gl-display-flex gl-align-items-center">
            <span>{project.path}</span>
            <button type="button" className="btn gl-button btn-default btn-sm gl-ml-auto"
              onClick={() => setCreating(c => !c)}>New file</button>
          </div>
          {creating ? (
            <form className="gl-p-3" onSubmit={addFile} style={{ padding: 8 }}>
              <input type="text" className="form-control gl-form-input" placeholder="README.md"
                aria-label="New file path" autoFocus
                value={newPath} onChange={e => setNewPath(e.target.value)} />
              <button type="submit" className="btn gl-button btn-confirm btn-sm gl-mt-2">Create file</button>
            </form>
          ) : null}
          <ul className="ide-file-list">
            {selected && !blobs.includes(selected) ? (
              <li className="active">
                <button type="button" onClick={() => open(selected)}>
                  <Icon name="document-lines" className="gl-mr-2" />{selected}
                </button>
              </li>
            ) : null}
            {blobs.map(p => (
              <li key={p} className={p === selected ? 'active' : ''}>
                <button type="button" onClick={() => open(p)}>
                  <Icon name="document-lines" className="gl-mr-2" />{p}
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div className="ide-main">
          <div className="ide-sidebar-header">{selected || 'No file selected'}</div>
          <textarea aria-label="Editor content" spellCheck="false" value={body}
            disabled={!selected}
            onChange={e => setDraft(e.target.value)} />
          <form className="ide-commit-panel" onSubmit={commit}>
            <label className="label-bold" htmlFor="ide_commit_message">Commit message</label>
            <textarea id="ide_commit_message" rows={2} className="form-control gl-form-input"
              placeholder={selected ? `Update ${selected.split('/').pop()}` : 'Commit message'}
              value={message} onChange={e => setMessage(e.target.value)} />
            <div className="form-actions">
              <button type="submit" className="btn gl-button btn-confirm btn-md">
                <span className="gl-button-text">Commit</span>
              </button>
              <button type="button" className="btn gl-button btn-default btn-md"
                onClick={() => go(`/${fullPath}/-/tree/${refName}`)}>
                <span className="gl-button-text">Cancel</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
