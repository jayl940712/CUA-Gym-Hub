import React from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'
import FileEditor from '../components/create/FileEditor.jsx'
import useGo from '../components/create/useGo.js'
import { commitToRepo, deleteFile } from '../components/create/mutations.js'
import { getRepoFile } from '../utils/dataManager.js'

// ROUTES #63 — `/:ns/:proj/-/edit/:ref/*path`.
//
// ANCHOR (webarena-441…445): the tasks edit `index.html`'s <title> and the
// evaluator then reads `/byteblaze/gimmiethat.space/-/raw/main/index.html`.
// So the commit has to land in `state.repo.fileOverlay`, which is exactly what
// `/-/raw` serves first (SCHEMA.md §3).
//
// Renaming the file in the name input moves it: the new path is written and the
// old one tomb-stoned, the same as GitLab's "move file" behaviour.

export default function EditFile() {
  const { state, setState, currentUser } = useApp()
  const { project, base } = useProject()
  const params = useParams()
  const q = useQuery()
  const go = useGo()

  const refName = params.ref || (project ? project.default_branch : 'main') || 'main'
  const path = params['*'] || ''
  // The blob view's action menu links here with these flags (RepoBlob.jsx):
  // `Replace` opens the editor on an empty buffer, `Delete` opens the confirm.
  const isReplace = q.get('replace') === '1'
  const isDelete = q.get('delete') === '1'

  usePageChrome({
    title: project ? `Edit · ${path} · ${project.namespace.name} / ${project.name} · GitLab` : 'GitLab',
    limited: true,
    breadcrumbExtra: [{ text: path, href: `${base}/-/blob/${refName}/${path}` }],
  })

  if (!state) return null
  if (!project) return <NotFound />

  const body = getRepoFile(state, project, refName, path)
  const fileName = path.split('/').pop() || ''

  function commit({ path: newPath, body: newBody, message, branch, newBranch }) {
    setState(prev => {
      let next = commitToRepo(prev, project, branch, [{ path: newPath, body: newBody }],
        { title: message, author_name: currentUser.name, author_email: currentUser.email },
        { createBranch: newBranch })
      // A rename leaves the old blob behind unless it is tomb-stoned.
      if (newPath !== path) {
        next = {
          ...next,
          repo: {
            ...next.repo,
            fileOverlay: { ...next.repo.fileOverlay, [`${project.full_path}:${branch}:${path}`]: null },
          },
        }
      }
      return next
    })
    go(`${base}/-/blob/${branch}/${newPath}`)
  }

  function remove() {
    setState(prev => deleteFile(prev, project, refName, path, {
      title: `Delete ${fileName}`,
      author_name: currentUser.name,
      author_email: currentUser.email,
    }))
    go(`${base}/-/tree/${refName}`)
  }

  if (isDelete) {
    return (
      <div className="create-flow">
        <div className="page-title-holder d-flex align-items-center">
          <h1 className="page-title gl-font-size-h-display">Delete {fileName}</h1>
        </div>
        <div className="gl-alert gl-alert-danger">
          <div className="gl-alert-content">
            <div className="gl-alert-body">
              Are you sure you want to delete <strong>{path}</strong> from branch{' '}
              <strong>{refName}</strong>?
            </div>
            <div className="gl-alert-actions">
              <button type="button" className="btn gl-button btn-danger" onClick={remove}>
                Delete file
              </button>
              <a className="btn gl-button btn-default" href={`${base}/-/blob/${refName}/${path}`}>Cancel</a>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">{isReplace ? 'Replace' : 'Edit'} file</h1>
        <div className="page-title-controls">
          <a className="gl-button btn btn-md btn-danger" href={`${base}/-/edit/${refName}/${path}?delete=1`}>
            <span className="gl-button-text">Delete</span>
          </a>
        </div>
      </div>
      {/* Keyed so switching file / branch / replace-mode re-seeds the editor's
          internal draft state instead of keeping the previous buffer. */}
      <FileEditor
        key={`${refName}:${path}:${isReplace ? 'replace' : 'edit'}`}
        mode="edit"
        project={project}
        refName={refName}
        initialPath={path}
        initialBody={isReplace ? '' : (body == null ? '' : body)}
        initialMessage={isReplace ? `Replace ${fileName}` : `Update ${fileName}`}
        authorName={currentUser.name}
        onCommit={commit}
        cancelHref={`${base}/-/blob/${refName}/${path}`}
      />
    </div>
  )
}
