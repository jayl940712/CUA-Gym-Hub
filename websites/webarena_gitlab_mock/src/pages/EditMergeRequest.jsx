import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { dbStamp } from '../components/create/mutations.js'
import {
  MarkdownEditor, UserSelect, MilestoneSelect, LabelSelect,
  useNavigateWithQuery, assignableUsers,
} from '../components/issuable/Controls.jsx'

// ROUTES #83 — `/:ns/:proj/-/merge_requests/:iid/edit`.
// TODO.md P1-G: changing the Reviewer must be reachable BOTH here and from the
// sidebar, because `.block.reviewer` is the anchor those tasks read back.

export default function EditMergeRequest() {
  const { iid } = useParams()
  const { state, indexes, currentUser, updateIn } = useApp()
  const { project, base } = useProject()
  const navigate = useNavigateWithQuery()

  const mr = project
    ? state.mergeRequests.find(m => m.project_id === project.id && String(m.iid) === String(iid))
    : null

  const [title, setTitle] = useState(mr ? mr.title : '')
  const [description, setDescription] = useState(mr ? mr.description || '' : '')
  const [assigneeId, setAssigneeId] = useState(mr && (mr.assignee_ids || [])[0] ? mr.assignee_ids[0] : null)
  const [reviewerId, setReviewerId] = useState(mr && (mr.reviewer_ids || [])[0] ? mr.reviewer_ids[0] : null)
  const [milestoneId, setMilestoneId] = useState(mr ? mr.milestone_id || null : null)
  const [labelIds, setLabelIds] = useState(mr ? mr.label_ids || [] : [])
  const [removeSource, setRemoveSource] = useState(mr ? !!mr.force_remove_source_branch : true)
  const [squash, setSquash] = useState(mr ? !!mr.squash : false)

  usePageChrome({
    title: mr && project
      ? `Edit merge request · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    breadcrumbExtra: mr
      ? [{ text: `!${mr.iid}`, href: `${base}/-/merge_requests/${mr.iid}` },
        { text: 'Edit', href: `${base}/-/merge_requests/${mr.iid}/edit` }]
      : null,
  })

  if (!project || !mr) return <NotFound />

  const projectLabels = state.labels.filter(l => l.project_id === project.id)
  const projectMilestones = state.milestones.filter(m => m.project_id === project.id && m.state !== 'closed')
  const candidates = assignableUsers(state, indexes, project, currentUser)

  function submit(e) {
    e.preventDefault()
    if (!title.trim()) return
    updateIn('mergeRequests', m => m.id === mr.id, () => ({
      title: title.trim(),
      description,
      draft: /^draft:/i.test(title.trim()),
      assignee_ids: assigneeId ? [assigneeId] : [],
      reviewer_ids: reviewerId ? [reviewerId] : [],
      milestone_id: milestoneId,
      label_ids: labelIds,
      force_remove_source_branch: removeSource,
      squash,
      updated_at: dbStamp(new Date(), { micros: false }),
    }))
    navigate(`${base}/-/merge_requests/${mr.iid}`)
  }

  return (
    <div>
      <h1 className="gl-font-size-h-display">Edit merge request</h1>
      <form id="edit_merge_request" className="merge-request-form common-note-form gfm-form" onSubmit={submit}>
        <div className="form-group row d-flex gl-px-5 branch-selector">
          <span>From <code>{mr.source_branch}</code> into </span>
          <code data-branch-name={mr.target_branch} id="js-target-branch-title">{mr.target_branch}</code>
        </div>

        <div className="form-group">
          <label htmlFor="merge_request_title">Title (required)</label>
          <input id="merge_request_title" name="merge_request[title]" type="text" required maxLength={255}
            className="form-control pad" data-qa-selector="issuable_form_title_field" dir="auto"
            value={title} onChange={e => setTitle(e.target.value)} />
        </div>

        <div className="form-group">
          <label htmlFor="merge_request_description">Description</label>
          <MarkdownEditor id="merge_request_description" name="merge_request[description]"
            qaSelector="issuable_form_description_field"
            placeholder="Describe the goal of the changes and what reviewers should be aware of."
            value={description} onChange={setDescription} />
        </div>

        <div className="row">
          <div className="col-lg-6" style={{ flex: 1, minWidth: 280 }}>
            <div className="form-group row merge-request-assignee">
              <label className="col-12" htmlFor="merge_request_assignee_id">Assignee</label>
              <UserSelect users={candidates} value={assigneeId} onChange={setAssigneeId}
                kind="assignee" currentUser={currentUser} />
            </div>
            <div className="form-group row merge-request-reviewer">
              <label className="col-12" htmlFor="merge_request_reviewer_id">Reviewer</label>
              <UserSelect users={candidates} value={reviewerId} onChange={setReviewerId} kind="reviewer" />
            </div>
          </div>
          <div className="col-lg-6" style={{ flex: 1, minWidth: 280 }}>
            <div className="form-group row issue-milestone">
              <label className="col-12" htmlFor="merge_request_milestone_id">Milestone</label>
              <MilestoneSelect milestones={projectMilestones} value={milestoneId} onChange={setMilestoneId} />
            </div>
            <div className="form-group row">
              <label className="col-12" htmlFor="merge_request_label_ids">Labels</label>
              <LabelSelect labels={projectLabels} value={labelIds} onChange={setLabelIds}
                manageHref={`${base}/-/labels`} />
            </div>
          </div>
        </div>

        <div className="form-group">
          <label>Merge options</label>
          <div>
            <label className="gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
              <input type="checkbox" name="merge_request[force_remove_source_branch]"
                checked={removeSource} onChange={e => setRemoveSource(e.target.checked)} />
              <span>Delete source branch when merge request is accepted.</span>
            </label>
            <label className="gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
              <input type="checkbox" name="merge_request[squash]"
                checked={squash} onChange={e => setSquash(e.target.checked)} />
              <span>Squash commits when merge request is accepted.</span>
            </label>
          </div>
        </div>

        <div className="gl-mt-5 footer-block gl-display-flex" style={{ gap: 8 }}>
          <button type="submit" className="gl-button btn btn-md btn-confirm gl-mr-2">Save changes</button>
          <a className="btn gl-button btn-default" href={`${base}/-/merge_requests/${mr.iid}`}>Cancel</a>
        </div>
      </form>
    </div>
  )
}
