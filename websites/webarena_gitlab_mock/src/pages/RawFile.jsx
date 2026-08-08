import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { getRepoFile } from '../utils/dataManager.js'

/**
 * ROUTES #48 — `/:ns/:proj/-/raw/:ref/*path`
 *
 * The source responds `Content-Type: text/plain` with the bare file body and
 * NO GitLab chrome. 15 tasks fetch these URLs and `must_include` on the
 * plain-text body, so this route is deliberately mounted OUTSIDE <Layout> in
 * App.jsx: no navbar, no sidebar, no breadcrumbs, nothing but the file text.
 *
 * Two details that matter for the graders (assets/README.md §10b.10):
 *  - The body must be the LITERAL file text. Browsers show `text/plain` inside
 *    `<pre style="word-wrap:break-word; white-space:pre-wrap">`, which is what
 *    the styling below reproduces — but nothing else may be in the document.
 *  - A missing file is a real 404 page, not an empty body, so an agent can
 *    tell "no such file" from "empty file".
 *
 * Bodies come from state.repo.fileOverlay first (files a task created or
 * edited) and fall back to the static repo_files.json — see getRepoFile.
 */
export default function RawFile() {
  const { ns, proj, ref } = useParams()
  const params = useParams()
  const path = params['*'] || ''
  const { state, loading } = useApp()

  const project = state ? state.projects.find(p => p.full_path === `${ns}/${proj}`) : null
  const body = state ? getRepoFile(state, project, ref, path) : undefined
  const missing = !state || !project || body === undefined || body === null

  useEffect(() => {
    if (loading || !state) return
    document.title = missing ? 'Not Found' : (path.split('/').pop() || 'raw')
  }, [loading, state, missing, path])

  if (loading || !state) return null

  if (missing) {
    // The source's standard 404 page, verbatim (§10b.10).
    return (
      <div style={{ fontFamily: 'sans-serif', textAlign: 'center', padding: '48px 16px' }}>
        <h1 style={{ fontSize: 96, margin: 0 }}>404</h1>
        <h3>Page Not Found</h3>
        <p>Make sure the address is correct and the page hasn&apos;t moved.</p>
        <p>Please contact your GitLab administrator if you think this is a mistake.</p>
      </div>
    )
  }

  // Reproduce the browser's own text/plain viewer without adding any text of
  // our own: the document's text is exactly the file content.
  return (
    <pre style={{
      margin: 0,
      fontFamily: 'monospace',
      fontSize: '13px',
      whiteSpace: 'pre-wrap',
      wordWrap: 'break-word',
    }}>{body}</pre>
  )
}
