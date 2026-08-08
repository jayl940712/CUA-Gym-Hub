import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { MarkdownEditor, DateField, useNavigateWithQuery } from '../components/issuable/Controls.jsx'
import { dbStamp } from '../components/create/mutations.js'

// ROUTES #91 / #93 — `/:ns/:proj/-/milestones/new` and `…/:iid/edit`.
// assets/README.md §16b "`/-/milestones/new`".
//
// ANCHOR (webarena-590…594): the dates entered here are read straight back out
// of `.block.start_date` / `.block.due_date` / `#content-body` on the detail
// page, formatted `MMM D, YYYY` (`Jan 16, 2030`, `Mar 15, 2044`).
//
// Note the label casing: `Start Date` / `Due Date` on THIS form, but
// `Start date` / `Due date` in the sidebar. Both are in the spec verbatim.

export default function NewMilestone({ edit = false }) {
  const { iid } = useParams()
  const { state, appendTo, updateIn, allocateId } = useApp()
  const { project, base } = useProject()
  const navigate = useNavigateWithQuery()

  const milestone = edit && project
    ? state.milestones.find(m => m.project_id === project.id && String(m.iid) === String(iid))
    : null

  const [title, setTitle] = useState(milestone ? milestone.title : '')
  const [startDate, setStartDate] = useState(milestone ? milestone.start_date : null)
  const [dueDate, setDueDate] = useState(milestone ? milestone.due_date : null)
  const [description, setDescription] = useState(milestone ? milestone.description || '' : '')

  usePageChrome({
    title: project
      ? `${edit ? 'Edit Milestone' : 'New Milestone'} · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    breadcrumbExtra: [{ text: edit ? 'Edit' : 'New', href: `${base}/-/milestones/new` }],
  })

  if (!project) return <NotFound />
  if (edit && !milestone) return <NotFound />

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    const now = dbStamp(new Date(), { micros: false })

    if (edit) {
      updateIn('milestones', m => m.id === milestone.id, () => ({
        title: title.trim(),
        description,
        start_date: startDate || null,
        due_date: dueDate || null,
        updated_at: now,
      }))
      navigate(`${base}/-/milestones/${milestone.iid}`)
      return
    }

    const iids = state.milestones.filter(m => m.project_id === project.id).map(m => Number(m.iid) || 0)
    const nextIid = (iids.length ? Math.max(...iids) : 0) + 1
    appendTo('milestones', {
      id: allocateId('milestone'),
      iid: nextIid,
      project_id: project.id,
      title: title.trim(),
      description,
      state: 'active',
      due_date: dueDate || null,
      start_date: startDate || null,
      created_at: now,
      updated_at: now,
    })
    navigate(`${base}/-/milestones/${nextIid}`)
  }

  return (
    <div>
      <h1 className="page-title gl-font-size-h-display">{edit ? 'Edit Milestone' : 'New Milestone'}</h1>
      <hr />
      <form id={edit ? 'edit_milestone' : 'new_milestone'}
        className="milestone-form common-note-form js-quick-submit js-requires-input gfm-form"
        onSubmit={submit}>

        <div className="form-group row">
          <label className="col-form-label col-sm-2" htmlFor="milestone_title">Title</label>
          <div className="col-sm-10">
            <input id="milestone_title" name="milestone[title]" type="text" required
              className="form-control gl-form-input" data-qa-selector="milestone_title_field"
              value={title} onChange={e => setTitle(e.target.value)} />
          </div>
        </div>

        <div className="form-group row gl-display-flex" style={{ gap: 16, flexWrap: 'wrap' }}>
          <div>
            <label className="col-form-label col-sm-2" htmlFor="milestone_start_date">Start Date</label>
            <div className="col-sm-4">
              <DateField id="milestone_start_date" name="milestone[start_date]"
                qaSelector="start_date_field" placeholder="Select start date"
                value={startDate} onChange={setStartDate}
                onClear={() => setStartDate(null)} clearLabel="Clear start date" />
            </div>
          </div>
          <div>
            <label className="col-form-label col-sm-2" htmlFor="milestone_due_date">Due Date</label>
            <div className="col-sm-4">
              <DateField id="milestone_due_date" name="milestone[due_date]"
                qaSelector="due_date_field" placeholder="Select due date"
                value={dueDate} onChange={setDueDate}
                onClear={() => setDueDate(null)} clearLabel="Clear due date" />
            </div>
          </div>
        </div>

        <div className="form-group row milestone-description">
          <label className="col-form-label col-sm-2" htmlFor="milestone_description">Description</label>
          <div className="col-sm-10">
            <MarkdownEditor id="milestone_description" name="milestone[description]"
              qaSelector="milestone_description_field"
              placeholder="Write milestone description..."
              value={description} onChange={setDescription}
              toolbarText={<>Supports <a href="/help/user/markdown">Markdown</a></>} />
          </div>
        </div>

        <div className="form-actions gl-display-flex" style={{ gap: 8 }}>
          <button type="submit" className="gl-button btn btn-md btn-confirm"
            data-qa-selector="create_milestone_button" disabled={!title.trim()}>
            {edit ? 'Save changes' : 'Create milestone'}
          </button>
          <a className="gl-button btn btn-default btn-cancel" href={`${base}/-/milestones`}>Cancel</a>
        </div>
      </form>
    </div>
  )
}
