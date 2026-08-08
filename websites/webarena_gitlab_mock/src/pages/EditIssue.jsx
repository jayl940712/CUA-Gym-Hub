import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { dbStamp } from '../components/create/mutations.js'
import {
  MarkdownEditor, UserSelect, MilestoneSelect, LabelSelect, DateField,
  useNavigateWithQuery, assignableUsers,
} from '../components/issuable/Controls.jsx'

// ROUTES #73 — `/:ns/:proj/-/issues/:iid/edit`. Same form as §20 with the
// record's values pre-filled; the submit button reads `Save changes`.

export default function EditIssue() {
  const { iid } = useParams()
  const { state, indexes, currentUser, updateIn } = useApp()
  const { project, base } = useProject()
  const navigate = useNavigateWithQuery()

  const issue = project
    ? state.issues.find(i => i.project_id === project.id && String(i.iid) === String(iid))
    : null

  const [title, setTitle] = useState(issue ? issue.title : '')
  const [description, setDescription] = useState(issue ? issue.description || '' : '')
  const [assigneeId, setAssigneeId] = useState(issue && (issue.assignee_ids || [])[0] ? issue.assignee_ids[0] : null)
  const [milestoneId, setMilestoneId] = useState(issue ? issue.milestone_id || null : null)
  const [labelIds, setLabelIds] = useState(issue ? issue.label_ids || [] : [])
  const [dueDate, setDueDate] = useState(issue ? issue.due_date || null : null)
  const [confidential, setConfidential] = useState(issue ? !!issue.confidential : false)

  usePageChrome({
    title: issue && project
      ? `Edit Issue · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    breadcrumbExtra: issue
      ? [{ text: `#${issue.iid}`, href: `${base}/-/issues/${issue.iid}` },
        { text: 'Edit', href: `${base}/-/issues/${issue.iid}/edit` }]
      : null,
  })

  if (!project || !issue) return <NotFound />

  const projectLabels = state.labels.filter(l => l.project_id === project.id)
  const projectMilestones = state.milestones.filter(m => m.project_id === project.id && m.state !== 'closed')
  const candidates = assignableUsers(state, indexes, project, currentUser)

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    updateIn('issues', i => i.id === issue.id, () => ({
      title: title.trim(),
      description,
      assignee_ids: assigneeId ? [assigneeId] : [],
      milestone_id: milestoneId,
      label_ids: labelIds,
      due_date: dueDate || null,
      confidential,
      updated_at: dbStamp(new Date(), { micros: false }),
    }))
    navigate(`${base}/-/issues/${issue.iid}`)
  }

  return (
    <div>
      <div className="top-area gl-lg-flex-direction-row gl-border-bottom-0">
        <h1 className="page-title gl-font-size-h-display">Edit Issue</h1>
      </div>

      <form id="edit_issue" className="issue-form common-note-form gl-mt-3 gfm-form" onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="issue_title">Title (required)</label>
          <input id="issue_title" name="issue[title]" type="text" required maxLength={255}
            className="form-control pad" data-qa-selector="issuable_form_title_field" dir="auto"
            value={title} onChange={e => setTitle(e.target.value)} />
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

        <div className="gl-mt-5 footer-block gl-display-flex" style={{ gap: 8 }}>
          <button type="submit" className="gl-button btn btn-md btn-confirm gl-mr-2">Save changes</button>
          <a className="btn gl-button btn-default" href={`${base}/-/issues/${issue.iid}`}>Cancel</a>
        </div>
      </form>
    </div>
  )
}
