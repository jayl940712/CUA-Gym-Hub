import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'
import { getBranches, defaultBranchOf } from '../utils/dataManager.js'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import { shortSha } from '../utils/format.js'
import { dbStamp } from '../components/create/mutations.js'
import {
  MarkdownEditor, UserSelect, MilestoneSelect, LabelSelect, SelectDropdown,
  useNavigateWithQuery, assignableUsers,
} from '../components/issuable/Controls.jsx'

// ROUTES #84 — `/:ns/:proj/-/merge_requests/new`. assets/README.md §15b
// ("the create flow"). Two steps on ONE route, switched by the presence of
// `merge_request[source_branch]`:
//
//   step 1  branch compare  ->  `Compare branches and continue`
//   step 2  the full form   ->  `Create merge request`
//
// ANCHOR (webarena-666, 667, 668, 806): the Reviewer chosen in step 2 must
// land in `.block.reviewer` on the created MR, and the created MR's banner
// must expose source at `a.gl-font-monospace[0]` and target at `[1]`.

/** `github/fork/x/redesign` -> `Redesign` (GitLab's humanized branch title). */
function humanizeBranch(name) {
  const last = String(name || '').split('/').pop().replace(/[-_]+/g, ' ').trim()
  return last ? last[0].toUpperCase() + last.slice(1) : ''
}

function BranchColumn({ heading, project, branches, value, onPick, qaSelector, defaultText }) {
  const tip = branches.find(b => b.name === value)
  return (
    <div className="col-lg-6" style={{ flex: 1, minWidth: 320 }}>
      <div className="card-new-merge-request">
        <h2 className="gl-font-size-h2">{heading}</h2>
        <div className="gl-display-flex gl-mt-3" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="dropdown-menu-toggle btn gl-button btn-default js-compare-dropdown"
            disabled>{project.full_path}</button>
          <SelectDropdown
            qaSelector={qaSelector}
            toggleText={value || defaultText}
            isDefault={!value}
            title={defaultText}
            searchPlaceholder="Search branches"
            options={branches.map(b => ({ value: b.name, label: b.name, search: b.name, active: b.name === value }))}
            onPick={onPick}
            toggleClass="js-compare-dropdown monospace"
          />
        </div>
        <div className="gl-bg-gray-50 gl-rounded-base gl-mx-2 gl-my-4"
          style={{ background: 'var(--gray-10, #fbfafd)', borderRadius: 4, padding: 12, marginTop: 12 }}>
          {tip ? (
            <ul className="list-unstyled mr_source_commit">
              <li>
                <a className="commit-row-message item-title" href={`/${project.full_path}/-/commit/${tip.sha}`}>{tip.subject}</a>
                <div className="committer gl-text-gray-500 gl-font-sm">
                  authored <TimeAgo value={tip.committed_date} />
                  <span className="gl-font-monospace gl-ml-3">{shortSha(tip.sha)}</span>
                </div>
              </li>
            </ul>
          ) : (
            <div className="compare-commit-empty js-source-commit-empty gl-text-gray-500">Select a branch to compare</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function NewMergeRequest() {
  const { state } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  const navigate = useNavigateWithQuery()

  const paramSource = q.get('merge_request[source_branch]')
  const paramTarget = q.get('merge_request[target_branch]')
  const changing = q.get('change_branches') === 'true'

  const branches = project ? getBranches(state, project) : []
  const defaultBranch = project ? defaultBranchOf(project) : 'main'

  const [source, setSource] = useState(paramSource || null)
  const [target, setTarget] = useState(paramTarget || defaultBranch)

  usePageChrome({
    title: project
      ? `New merge request · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    breadcrumbExtra: [{ text: 'New', href: `${base}/-/merge_requests/new` }],
  })

  if (!project) return <NotFound />

  // Step 1 and step 2 live on the same route, so the step-2 form is keyed on
  // the branch pair — otherwise React keeps its `useState` prefills from the
  // moment the (unparameterised) step-1 page mounted.
  if (paramSource && !changing) {
    return <MergeRequestForm key={`${paramSource}|${paramTarget}`} project={project} base={base}
      branches={branches} defaultBranch={defaultBranch}
      paramSource={paramSource} paramTarget={paramTarget || defaultBranch} />
  }

  function compareAndContinue(e) {
    e.preventDefault()
    if (!source) return
    const p = new URLSearchParams()
    p.set('merge_request[source_project_id]', String(project.id))
    p.set('merge_request[source_branch]', source)
    p.set('merge_request[target_project_id]', String(project.id))
    p.set('merge_request[target_branch]', target || defaultBranch)
    navigate(`${base}/-/merge_requests/new?${p.toString()}`)
  }

  return (
    <div>
      <h1 className="gl-font-size-h-display">New merge request</h1>
      <form id="new_merge_request" className="merge-request-form js-requires-input gfm-form"
        method="get" action={`${base}/-/merge_requests/new`} onSubmit={compareAndContinue}>
        <div className="js-merge-request-new-compare row gl-display-flex" style={{ gap: 16, flexWrap: 'wrap' }}>
          <BranchColumn heading="Source branch" project={project} branches={branches}
            value={source} onPick={setSource} qaSelector="source_branch_dropdown"
            defaultText="Select source branch" />
          <BranchColumn heading="Target branch" project={project} branches={branches}
            value={target} onPick={setTarget} qaSelector="target_branch_dropdown"
            defaultText="Select target branch" />
        </div>
        <input type="hidden" name="merge_request[source_branch]" value={source || ''} />
        <input type="hidden" name="merge_request[target_branch]" value={target || ''} />
        {/* The source's form carries `js-requires-input`, which keeps this
            button disabled until a source branch is chosen. Without that it
            silently no-ops on the primary CTA (HANDLER-004). */}
        <div className="gl-mt-5">
          <button type="submit" className="btn gl-button btn-confirm" disabled={!source}>
            Compare branches and continue
          </button>
        </div>
      </form>
    </div>
  )
}

function MergeRequestForm({ project, base, branches, defaultBranch, paramSource, paramTarget }) {
  const { state, indexes, currentUser, appendTo, allocateId } = useApp()
  const navigate = useNavigateWithQuery()

  const srcTip = branches.find(b => b.name === paramSource)
  const tgtTip = branches.find(b => b.name === paramTarget)
  const noCommits = !srcTip || (!!tgtTip && srcTip.sha === tgtTip.sha)
  const prefill = noCommits ? `Draft: ${humanizeBranch(paramSource)}` : srcTip.subject

  const [title, setTitle] = useState(prefill)
  const [description, setDescription] = useState('')
  const [assigneeId, setAssigneeId] = useState(null)
  const [reviewerId, setReviewerId] = useState(null)
  const [milestoneId, setMilestoneId] = useState(null)
  const [labelIds, setLabelIds] = useState([])
  const [removeSource, setRemoveSource] = useState(true)
  const [squash, setSquash] = useState(false)

  function createMr(e) {
    e.preventDefault()
    if (!title.trim()) return
    const iids = state.mergeRequests.filter(m => m.project_id === project.id).map(m => Number(m.iid) || 0)
    const iid = (iids.length ? Math.max(...iids) : 0) + 1
    const id = allocateId('mr')
    const now = dbStamp(new Date(), { micros: false })
    appendTo('mergeRequests', {
      id,
      iid,
      project_id: project.id,
      source_project_id: project.id,
      title: title.trim(),
      description,
      author_id: currentUser.id,
      state: 'opened',
      draft: /^draft:/i.test(title.trim()),
      source_branch: paramSource,
      target_branch: paramTarget || defaultBranch,
      milestone_id: milestoneId,
      merge_status: 'can_be_merged',
      assignee_ids: assigneeId ? [assigneeId] : [],
      reviewer_ids: reviewerId ? [reviewerId] : [],
      label_ids: labelIds,
      created_at: now,
      updated_at: now,
      user_notes_count: 0,
      squash,
      force_remove_source_branch: removeSource,
    })
    navigate(`${base}/-/merge_requests/${iid}`)
  }

  const projectLabels = state.labels.filter(l => l.project_id === project.id)
  const projectMilestones = state.milestones.filter(m => m.project_id === project.id && m.state !== 'closed')
  const candidates = assignableUsers(state, indexes, project, currentUser)
  const changeBranchesHref = `${base}/-/merge_requests/new?change_branches=true`
    + `&merge_request%5Bsource_branch%5D=${encodeURIComponent(paramSource)}`
    + `&merge_request%5Btarget_branch%5D=${encodeURIComponent(paramTarget || defaultBranch)}`

  return (
    <div>
      <h1 className="gl-font-size-h-display">New merge request</h1>
      <form id="new_merge_request" className="merge-request-form common-note-form js-requires-input gfm-form"
        onSubmit={createMr}>

        <div className="form-group row d-flex gl-px-5 branch-selector">
          <span>From <code>{paramSource}</code> into </span>
          <code data-branch-name={paramTarget || defaultBranch} id="js-target-branch-title">{paramTarget || defaultBranch}</code>
          &nbsp;<a href={changeBranchesHref}>Change branches</a>
        </div>

        <div className="form-group">
          <label htmlFor="merge_request_title">Title (required)</label>
          <input id="merge_request_title" name="merge_request[title]" type="text" required maxLength={255}
            className="form-control pad" data-qa-selector="issuable_form_title_field" dir="auto"
            value={title} onChange={e => setTitle(e.target.value)} />
          <div className={/^draft:/i.test(title) ? 'js-wip-explanation form-text text-muted' : 'js-no-wip-explanation form-text text-muted'}>
            {/^draft:/i.test(title)
              ? 'Remove the Draft prefix from the title to allow this merge request to be merged when it’s ready.'
              : 'Start the title with Draft: to prevent a merge request draft from merging before it’s ready.'}
          </div>
          <p className="form-text text-muted">
            Add <a href="/help/user/project/description_templates">description templates</a> to help your contributors to communicate effectively!
          </p>
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
            {/* ANCHOR — this feeds `.block.reviewer` on the created MR. */}
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
              <input id="merge_request_force_remove_source_branch" type="checkbox"
                name="merge_request[force_remove_source_branch]"
                checked={removeSource} onChange={e => setRemoveSource(e.target.checked)} />
              <span>Delete source branch when merge request is accepted.</span>
            </label>
            <label className="gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
              <input id="merge_request_squash" type="checkbox" name="merge_request[squash]"
                checked={squash} onChange={e => setSquash(e.target.checked)} />
              <span>Squash commits when merge request is accepted.</span>
            </label>
          </div>
        </div>

        <div className="gl-mt-5 footer-block gl-display-flex" style={{ gap: 8 }}>
          <button type="submit" className="gl-button btn btn-md btn-confirm gl-mr-2"
            data-qa-selector="issuable_create_button">Create merge request</button>
          <a className="btn gl-button btn-default js-reset-autosave" href={`${base}/-/merge_requests`}>Cancel</a>
        </div>
      </form>

      {noCommits ? (
        <div className="gl-text-center gl-mt-5"><h4>There are no commits yet.</h4></div>
      ) : (
        <div className="merge-request-tabs-container gl-mt-5">
          <ul className="merge-request-tabs nav nav-tabs nav-links">
            <li className="commits-tab new-tab active"><a className="nav-link gl-tab-nav-item active gl-tab-nav-item-active"
              href={`${base}/-/merge_requests/new?merge_request%5Bsource_branch%5D=${encodeURIComponent(paramSource)}&merge_request%5Btarget_branch%5D=${encodeURIComponent(paramTarget || defaultBranch)}`}>
              Commits <span className="gl-badge badge badge-pill badge-muted sm">1</span></a></li>
            <li className="diffs-tab" data-qa-selector="diffs_tab"><a className="nav-link gl-tab-nav-item"
              href={`${base}/-/merge_requests/new/diffs?merge_request%5Bsource_branch%5D=${encodeURIComponent(paramSource)}&merge_request%5Btarget_branch%5D=${encodeURIComponent(paramTarget || defaultBranch)}`}>
              Changes</a></li>
          </ul>
          <ul className="content-list commit-list gl-mt-3">
            <li className="commit">
              <a href={`/${project.full_path}/-/commit/${srcTip.sha}`}>{srcTip.subject}</a>
              <span className="gl-text-gray-500 gl-ml-3 gl-font-monospace">{shortSha(srcTip.sha)}</span>
            </li>
          </ul>
        </div>
      )}
    </div>
  )
}
