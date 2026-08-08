import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'
import { dbStamp } from '../components/create/mutations.js'
import {
  MarkdownEditor, UserSelect, MilestoneSelect, LabelSelect, DateField,
  useNavigateWithQuery, assignableUsers,
} from '../components/issuable/Controls.jsx'

// ROUTES #71 — `/:ns/:proj/-/issues/new`. assets/README.md §20.
//
// TODO.md P1-F: 8 tasks create an issue here, then the evaluator reads
// `.block.assignee`, `[data-testid="sidebar-due-date"]` and
// `[data-qa-selector="title_content"]` on the resulting issue page — so the
// assignee and due-date controls have to write real state, not decoration.
//
// ⚠️ There is no bare `/-/issues/new`; the source 404s it (§20 route note).

export default function NewIssue() {
  const { state, indexes, currentUser, appendTo, allocateId } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  const navigate = useNavigateWithQuery()

  const incident = q.get('issue[issue_type]') === 'incident' || q.get('issuable_template') === 'incident'
  const relatedIid = q.get('add_related_issue')

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState(relatedIid ? `relates to #${relatedIid}` : '')
  const [assigneeId, setAssigneeId] = useState(null)
  const [milestoneId, setMilestoneId] = useState(
    q.get('issue[milestone_id]') ? Number(q.get('issue[milestone_id]')) : null)
  const [labelIds, setLabelIds] = useState([])
  const [dueDate, setDueDate] = useState(null)
  const [confidential, setConfidential] = useState(false)
  const [typeOpen, setTypeOpen] = useState(false)
  const [error, setError] = useState(false)

  usePageChrome({
    title: project
      ? `New Issue · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    breadcrumbExtra: [{ text: 'New', href: `${base}/-/issues/new` }],
  })

  if (!project) return <NotFound />

  const projectLabels = state.labels.filter(l => l.project_id === project.id)
  const projectMilestones = state.milestones.filter(m => m.project_id === project.id && m.state !== 'closed')
  const candidates = assignableUsers(state, indexes, project, currentUser)

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) { setError(true); return }

    const iids = state.issues.filter(i => i.project_id === project.id).map(i => Number(i.iid) || 0)
    const iid = (iids.length ? Math.max(...iids) : 0) + 1
    const id = allocateId('issue')
    const now = dbStamp(new Date(), { micros: false })

    appendTo('issues', {
      id,
      iid,
      project_id: project.id,
      title: title.trim(),
      description,
      author_id: currentUser.id,
      state: 'opened',
      confidential,
      due_date: dueDate || null,
      milestone_id: milestoneId,
      assignee_ids: assigneeId ? [assigneeId] : [],
      label_ids: labelIds,
      created_at: now,
      updated_at: now,
      closed_at: null,
      closed_by_id: null,
      upvotes: 0,
      user_notes_count: 0,
      issue_type: incident ? 'incident' : 'issue',
    })
    navigate(`${base}/-/issues/${iid}`)
  }

  return (
    <div>
      <div className="top-area gl-lg-flex-direction-row gl-border-bottom-0">
        <h1 className="page-title gl-font-size-h-display">New Issue</h1>
      </div>

      <form id="new_issue" className="issue-form common-note-form gl-mt-3 js-quick-submit gl-show-field-errors gfm-form"
        onSubmit={submit}>

        <div className="form-group" data-testid="issue-title-input-field">
          <label htmlFor="issue_title">Title (required)</label>
          <input id="issue_title" name="issue[title]" type="text" required maxLength={255}
            className="form-control pad" data-qa-selector="issuable_form_title_field" dir="auto"
            value={title} onChange={e => { setTitle(e.target.value); setError(false) }} />
          <p className={`gl-field-error${error ? '' : ' hidden'}`} style={{ color: 'var(--red-500)' }}>
            This field is required.
          </p>
          <p className="form-text text-muted">
            Add <a href="/help/user/project/description_templates">description templates</a> to help your contributors to communicate effectively!
          </p>
        </div>

        <div className="form-group">
          <div className="gl-pb-3">Similar issues</div>
          <ul className="gl-list-style-none gl-m-0 gl-p-0" />
        </div>

        <div className="form-group">
          <label htmlFor="issue_type">Type</label>
          <div className={`dropdown${typeOpen ? ' show' : ''}`}>
            <button type="button" className="dropdown-menu-toggle btn gl-button btn-default"
              onClick={() => setTypeOpen(o => !o)} style={{ minWidth: 160, justifyContent: 'space-between' }}>
              <span className="dropdown-toggle-text is-default">{incident ? 'Incident' : 'Issue'}</span>
            </button>
            <div className="dropdown-menu dropdown-menu-selectable dropdown-select">
              <div className="dropdown-title gl-display-flex"><span className="gl-ml-auto">Select type</span>
                <button type="button" aria-label="Close" className="dropdown-title-button dropdown-menu-close"
                  onClick={() => setTypeOpen(false)}>×</button></div>
              <div className="dropdown-content" data-testid="issue-type-select-dropdown">
                <ul>
                  <li className={incident ? '' : 'is-active'}><a href={`${base}/-/issues/new`}>Issue</a></li>
                  <li className={incident ? 'is-active' : ''}>
                    <a href={`${base}/-/issues/new?issuable_template=incident&issue%5Bissue_type%5D=incident`}>Incident</a></li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="issue_description">Description</label>
          <MarkdownEditor id="issue_description" name="issue[description]"
            qaSelector="issuable_form_description_field"
            placeholder="Write a description or drag your files here…"
            value={description} onChange={setDescription} />
        </div>

        <div className="form-group">
          <label htmlFor="issue_confidential" className="gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
            <input id="issue_confidential" name="issue[confidential]" type="checkbox"
              checked={confidential} onChange={e => setConfidential(e.target.checked)} />
            <span>This issue is confidential and should only be visible to team members with at least Reporter access.</span>
          </label>
        </div>

        <div className="row">
          <div className="col-lg-6" style={{ flex: 1, minWidth: 280 }}>
            <div className="form-group row merge-request-assignee">
              <label className="col-12" htmlFor="issue_assignee_id">Assignee</label>
              <UserSelect users={candidates} value={assigneeId} onChange={setAssigneeId}
                kind="assignee" currentUser={currentUser} />
            </div>

            <div className="form-group row issue-milestone">
              <label className="col-12" htmlFor="issue_milestone_id">Milestone</label>
              <MilestoneSelect milestones={projectMilestones} value={milestoneId} onChange={setMilestoneId} />
            </div>

            <div className="form-group row">
              <label className="col-12" htmlFor="issue_label_ids">Labels</label>
              <LabelSelect labels={projectLabels} value={labelIds} onChange={setLabelIds}
                manageHref={`${base}/-/labels`} />
            </div>
          </div>

          <div className="col-lg-6" style={{ flex: 1, minWidth: 280 }}>
            <div className="form-group row">
              <label className="col-12" htmlFor="issue_due_date">Due date</label>
              <DateField id="issuable-due-date" name="issue[due_date]" value={dueDate}
                onChange={setDueDate} placeholder="Select due date" />
            </div>
          </div>
        </div>

        <input type="hidden" name="issue[issue_type]" value={incident ? 'incident' : 'issue'} />
        <input type="hidden" name="issue[lock_version]" value="0" />

        <div className="gl-mt-5 footer-block gl-display-flex" style={{ gap: 8 }}>
          <button type="submit" className="gl-button btn btn-md btn-confirm gl-mr-2"
            data-qa-selector="issuable_create_button">Create issue</button>
          <a className="btn gl-button btn-default js-reset-autosave" href={`${base}/-/issues`}>Cancel</a>
        </div>
      </form>
    </div>
  )
}
