import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import useGo from '../components/create/useGo.js'
import '../components/create/create.css'
import { dbStamp } from '../components/create/mutations.js'

// ROUTES #128 — `/-/snippets/new`. P2, no anchors: the source's snippet
// surfaces are all empty states on this instance.
//
// The seed has no snippets collection (SCHEMA.md §2 lists 12 mutable modules
// and snippets is not one of them). Rather than leave "Create snippet" dead,
// the form appends to a `state.snippets` array created on first use. The
// stateTracker falls back to a recursive value diff for unknown keys, so the
// write still shows up in /go — see DEV.part-create.md.

const SNIPPET_VISIBILITY = [
  ['private', 'Private', 'The snippet is visible only to me.'],
  ['internal', 'Internal', 'The snippet is visible to any logged in user except external users.'],
  ['public', 'Public', 'The snippet can be accessed without any authentication.'],
]

export default function NewSnippet() {
  const { state, setState, currentUser } = useApp()
  const go = useGo()

  usePageChrome({ title: 'New Snippet · GitLab' })

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [fileName, setFileName] = useState('')
  const [content, setContent] = useState('')
  const [visibility, setVisibility] = useState('private')
  const [error, setError] = useState(null)

  if (!state) return null

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) { setError('Title can\'t be blank'); return }
    setState(prev => {
      const snippets = prev.snippets || []
      const id = 1 + snippets.reduce((max, s) => Math.max(max, s.id), 0)
      return {
        ...prev,
        snippets: [...snippets, {
          id,
          title: title.trim(),
          description,
          file_name: fileName || 'snippetfile1.txt',
          content,
          visibility,
          author_id: currentUser.id,
          created_at: dbStamp(),
        }],
      }
    })
    go('/dashboard/snippets')
  }

  return (
    <div className="create-flow">
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">New Snippet</h1>
      </div>

      {error ? (
        <div className="gl-alert gl-alert-danger gl-mb-3" role="alert">
          <div className="gl-alert-content"><div className="gl-alert-body">{error}</div></div>
        </div>
      ) : null}

      <form onSubmit={submit} noValidate>
        <div className="form-group">
          <label className="label-bold" htmlFor="snippet_title">Title</label>
          <input id="snippet_title" name="personal_snippet[title]" required
            className="form-control gl-form-input"
            value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label className="label-bold" htmlFor="snippet_description">Description (optional)</label>
          <textarea id="snippet_description" name="personal_snippet[description]" rows={3}
            className="form-control gl-form-input"
            value={description} onChange={e => setDescription(e.target.value)} />
        </div>
        <div className="file-editor">
          <div className="js-file-title file-title">
            <input type="text" className="form-control gl-form-input new-file-name"
              placeholder="Give your file a name to add code highlighting, e.g. example.rb for Ruby"
              value={fileName} onChange={e => setFileName(e.target.value)} />
          </div>
          <div className="editor-shell">
            <textarea className="editor-textarea" aria-label="Editor content" spellCheck="false"
              value={content} onChange={e => setContent(e.target.value)} />
          </div>
        </div>
        <div className="form-group gl-mt-5">
          <label className="label-bold">Visibility level</label>
          <div className="visibility-level-setting">
            {SNIPPET_VISIBILITY.map(([v, label, help]) => (
              <div className="gl-form-radio custom-control custom-radio" key={v}>
                <input className="custom-control-input" type="radio" name="personal_snippet[visibility_level]"
                  id={`snippet_visibility_${v}`}
                  checked={visibility === v} onChange={() => setVisibility(v)} />
                <label className="custom-control-label" htmlFor={`snippet_visibility_${v}`}>{label}</label>
                <p className="help-text">{help}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="form-actions">
          <button type="submit" className="gl-button btn btn-md btn-confirm">Create snippet</button>
          <a className="gl-button btn btn-md btn-default" href="/dashboard/snippets">Cancel</a>
        </div>
      </form>
    </div>
  )
}
