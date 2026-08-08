import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { useNavigateWithQuery } from '../components/issuable/Controls.jsx'
import { dbStamp } from '../components/create/mutations.js'

// ROUTES #88 / #89 — `/:ns/:proj/-/labels/new` and `…/:id/edit`.
// assets/README.md §16a "`/-/labels/new`".
//
// The 21 suggested swatches, with the source's tooltip titles in source order.
export const SUGGESTED_COLORS = [
  ['#009966', 'Green-cyan'], ['#8fbc8f', 'Dark sea green'], ['#3cb371', 'Medium sea green'],
  ['#00b140', 'Green screen'], ['#013220', 'Dark green'], ['#6699cc', 'Blue-gray'],
  ['#0000ff', 'Blue'], ['#b76ba3', 'Lavender'], ['#8e44ad', 'Dark violet'],
  ['#44337a', 'Deep violet'], ['#808080', 'Gray'], ['#36454f', 'Charcoal grey'],
  ['#f7e7ce', 'Champagne'], ['#c21e56', 'Rose red'], ['#cc338b', 'Magenta-pink'],
  ['#dc143c', 'Crimson'], ['#ff0000', 'Red'], ['#cd5b45', 'Dark coral'],
  ['#eee600', 'Titanium yellow'], ['#ed9121', 'Carrot orange'], ['#c39953', 'Aztec Gold'],
]

export default function NewLabel({ edit = false }) {
  const { id } = useParams()
  const { state, appendTo, updateIn, allocateId } = useApp()
  const { project, base } = useProject()
  const navigate = useNavigateWithQuery()

  const label = edit && project ? state.labels.find(l => String(l.id) === String(id)) : null

  const [title, setTitle] = useState(label ? label.title : '')
  const [description, setDescription] = useState(label ? label.description || '' : '')
  const [color, setColor] = useState(label ? label.color : '#6699cc')

  usePageChrome({
    title: project
      ? `${edit ? 'Edit Label' : 'New Label'} · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    breadcrumbExtra: [{ text: edit ? 'Edit' : 'New', href: `${base}/-/labels/new` }],
  })

  if (!project) return <NotFound />
  if (edit && !label) return <NotFound />

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    if (edit) {
      updateIn('labels', l => l.id === label.id,
        () => ({ title: title.trim(), description, color, updated_at: dbStamp() }))
    } else {
      appendTo('labels', {
        id: allocateId('label'),
        project_id: project.id,
        title: title.trim(),
        color,
        description,
        created_at: dbStamp(),
      })
    }
    navigate(`${base}/-/labels`)
  }

  return (
    <div>
      <h1 className="page-title gl-font-size-h-display">{edit ? 'Edit Label' : 'New Label'}</h1>
      <form className="label-form js-quick-submit js-requires-input" id={edit ? 'edit_label' : 'new_label'}
        onSubmit={submit}>

        <div className="form-group">
          <label htmlFor="label_title">Title</label>
          <input id="label_title" name="label[title]" type="text" required
            className="gl-form-input form-control js-label-title" data-qa-selector="label_title_field"
            value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div className="form-group">
          <label htmlFor="label_description">Description</label>
          <input id="label_description" name="label[description]" type="text"
            className="gl-form-input form-control js-quick-submit" data-qa-selector="label_description_field"
            value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        <div className="form-group">
          <label htmlFor="label_color">Background color</label>
          <div className="input-group gl-display-flex" style={{ gap: 8, alignItems: 'center' }}>
            <div className="input-group-prepend">
              <span className="input-group-text label-color-preview"
                style={{ display: 'inline-block', width: 32, height: 32, borderRadius: 4, background: color }} />
            </div>
            <input id="label_color" name="label[color]" type="text"
              className="gl-form-input form-control" data-qa-selector="label_color_field"
              value={color} onChange={e => setColor(e.target.value)} style={{ maxWidth: 200 }} />
          </div>
          <div className="form-text text-muted">Choose any color.<br />Or you can choose one of the suggested colors below</div>
          <div className="suggest-colors gl-mt-2 gl-display-flex" style={{ gap: 4, flexWrap: 'wrap', maxWidth: 340 }}>
            {SUGGESTED_COLORS.map(([hex, name]) => (
              <a key={hex} className="has-tooltip" href="#" title={name} aria-label={name}
                style={{ width: 28, height: 28, borderRadius: 4, background: hex, display: 'inline-block' }}
                onClick={e => { e.preventDefault(); setColor(hex) }} />
            ))}
          </div>
        </div>

        <div className="gl-display-flex gl-justify-content-space-between gl-mt-5" style={{ gap: 8, justifyContent: 'flex-start' }}>
          <button type="submit" className="gl-button btn btn-md btn-confirm js-save-button gl-mr-2"
            data-qa-selector="label_create_button" disabled={!title.trim()}>
            {edit ? 'Save changes' : 'Create label'}</button>
          <a className="gl-button btn btn-md btn-default" href={`${base}/-/labels`}>Cancel</a>
        </div>
      </form>
    </div>
  )
}
