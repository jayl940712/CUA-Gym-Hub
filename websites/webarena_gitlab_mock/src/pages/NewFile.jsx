import React from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'
import FileEditor from '../components/create/FileEditor.jsx'
import useGo from '../components/create/useGo.js'
import { commitToRepo } from '../components/create/mutations.js'

// ROUTES #62 — `/:ns/:proj/-/new/:ref[/*dir]`. assets/html/proj-newfile-dotfiles.html.
//
// 20 WebArena tasks route through here. The two prefill params matter: the
// project overview's "Add LICENSE" chip links to
// `/-/new/main?commit_message=Add+LICENSE&file_name=LICENSE`, which tasks
// 411–414 and 736 follow.
//
// ANCHOR (webarena-552…555): creating `real_space/urls.txt` has to make both
// `/-/tree/main/real_space` and `/-/raw/main/real_space/urls.txt` resolve. A
// slash in the file name creates the folder — the tree is a flat blob list, so
// writing the nested path is all it takes (assets/data_model.md §11).

export default function NewFile() {
  const { state, setState, currentUser } = useApp()
  const { project, base } = useProject()
  const params = useParams()
  const q = useQuery()
  const go = useGo()

  const refName = params.ref || (project ? project.default_branch : 'main') || 'main'
  const dir = params['*'] || ''

  usePageChrome({
    title: project ? `New File · ${project.namespace.name} / ${project.name} · GitLab` : 'GitLab',
    limited: true,
    // The source's trail stops at `Byte Blaze › dotfiles › Repository`; there
    // is no extra "New file" crumb (reference/proj-newfile-dotfiles.png).
  })

  if (!state) return null
  if (!project) return <NotFound />

  const prefillName = q.get('file_name') || ''
  const initialPath = dir ? `${dir.replace(/\/$/, '')}/${prefillName}` : prefillName

  function commit({ path, body, message, branch, newBranch }) {
    setState(prev => commitToRepo(prev, project, branch, [{ path, body }],
      { title: message, author_name: currentUser.name, author_email: currentUser.email },
      { createBranch: newBranch }))
    go(`${base}/-/blob/${branch}/${path}`)
  }

  return (
    <div>
      <h1 className="page-title blob-new-page-title gl-font-size-h-display">New file</h1>
      <FileEditor
        key={`${refName}:${initialPath}`}
        mode="create"
        project={project}
        refName={refName}
        initialPath={initialPath}
        initialBody=""
        initialMessage={q.get('commit_message') || 'Add new file'}
        authorName={currentUser.name}
        onCommit={commit}
        cancelHref={dir ? `${base}/-/tree/${refName}/${dir}` : `${base}/-/tree/${refName}`}
      />
    </div>
  )
}
