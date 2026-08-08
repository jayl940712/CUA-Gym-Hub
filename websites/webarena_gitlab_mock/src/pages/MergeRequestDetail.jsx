import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import Icon from '../components/layout/Icon.jsx'
import NotFound from './NotFound.jsx'
import NotesTimeline from './NotesTimeline.jsx'
import { useProject } from './hooks.js'
import { renderMarkdown, toggleTaskItem } from '../utils/markdown.js'
import { getMrDiff } from '../utils/dataManager.js'
import { shortSha } from '../utils/format.js'
import { commitHeaderDate } from './RepoCommits.jsx'
import {
  UserSelect, MilestoneSelect, LabelSelect, LabelChip, assignableUsers,
} from '../components/issuable/Controls.jsx'
import Dropdown from '../components/ui/Dropdown.jsx'
import { dbStamp } from '../components/create/mutations.js'
import { labelFilterUrl } from '../utils/issuableUrl.js'

// ROUTES #79 — `/:ns/:proj/-/merge_requests/:iid`. assets/README.md §15b–§15d.
//
// CRITICAL ANCHOR (webarena-666…668, 806):
//   On an MR, `.detail-page-description` is the "requested to merge" BANNER,
//   not the description body. The evaluator runs
//     querySelectorAll('.detail-page-description > a.gl-font-monospace')
//   and reads [0] = source branch, [1] = target branch. There are TWO
//   .detail-page-description elements on the page and the banner must be the
//   FIRST in document order. Both branch links must be DIRECT children.
//
// Recon correction: a merged MR badge is badge-info BLUE in 15.7, not purple.

/** `.gl-bg-blue-50` + `.gl-px-2` are not in the mock's stylesheet; pin the
 *  chip look here so the banner reads like the source's. */
const BRANCH_CHIP = {
  background: 'var(--blue-50, #e9f3fc)',
  borderRadius: 4,
  padding: '0 8px',
  margin: '0 8px',
  fontSize: 12,
}

/**
 * Day buckets for the Commits tab, newest first. GitLab groups on the COMMITTED
 * date (the source's `data-day` is the committed date's UTC day, while the row
 * shows the AUTHORED time) — same rule as the project commit list.
 */
function groupCommitsByDay(commits) {
  const groups = []
  for (const c of commits) {
    const day = String(c.committed_date || c.authored_date || '').slice(0, 10)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.rows.push(c)
    else groups.push({ day, rows: [c] })
  }
  return groups
}

/** The pipeline row shows the title of the commit it ran against. */
function commitTitleOf(commits, sha) {
  const found = commits.find(c => c.sha === sha)
  return found ? found.title : shortSha(sha)
}

function stateBadge(mr) {
  if (mr.state === 'merged') return ['badge-info issuable-status-badge-merged', 'Merged', 'git-merge']
  if (mr.state === 'closed') return ['badge-danger issuable-status-badge-closed', 'Closed', 'close']
  return ['badge-success issuable-status-badge-open', 'Open', 'git-merge']
}

/**
 * `Reviewer` / `0 Reviewers` / `3 Reviewers` — the header is the bare singular
 * only at exactly one person (§15d "Header text rule (critical)"). The same
 * rule governs `.block.assignee`.
 */
function peopleHeading(n, singular) {
  return n === 1 ? singular : `${n} ${singular}s`
}

function SidebarEdit({ open, onClick, qaSelector = 'edit_link' }) {
  return (
    <button type="button" data-testid="edit-button" data-qa-selector={qaSelector}
      className="btn gl-text-gray-900! gl-ml-auto hide-collapsed btn-default btn-sm gl-button btn-default-tertiary float-right js-sidebar-dropdown-toggle edit-link"
      aria-expanded={open} onClick={onClick}>
      <span className="gl-button-text">Edit</span>
    </button>
  )
}

/** The `Check out branch` modal behind the header's `Code` dropdown. */
function CheckOutBranchModal({ mr, onClose }) {
  const steps = [
    ['Step 1. Fetch and check out the branch for this merge request',
      `git fetch origin\ngit checkout -b '${mr.source_branch}' 'origin/${mr.source_branch}'`],
    ['Step 2. Review the changes locally', null],
    ['Step 3. Merge the branch and fix any conflicts that come up',
      `git checkout '${mr.target_branch}'\ngit merge --no-ff '${mr.source_branch}'`],
    ['Step 4. Push the result of the merge to GitLab',
      `git push origin '${mr.target_branch}'`],
  ]
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="Check out, review, and merge locally">
        <div className="modal-dialog modal-lg">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Check out, review, and merge locally</h4>
              <button type="button" className="btn gl-button btn-default-tertiary btn-icon"
                aria-label="Close" onClick={onClose}><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              {steps.map(([heading, cmd]) => (
                <div key={heading} className="gl-mb-4">
                  <p className="gl-font-weight-bold gl-mb-2">{heading}</p>
                  {cmd ? (
                    <pre className="gl-font-monospace" style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{cmd}</pre>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn gl-button btn-default" onClick={onClose}>
                <span className="gl-button-text">Close</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default function MergeRequestDetail({ tab = 'overview' }) {
  const { iid } = useParams()
  const { state, indexes, currentUser, updateIn, setUi } = useApp()
  const { project, base } = useProject()
  const [editing, setEditing] = useState(null)
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [commitMsgOpen, setCommitMsgOpen] = useState(false)

  const mr = project
    ? state.mergeRequests.find(m => m.project_id === project.id && String(m.iid) === String(iid))
    : null

  usePageChrome({
    title: mr && project
      ? `${mr.title} (!${mr.iid}) · Merge requests · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
    noBreadcrumbBorder: true,
    // TEST.md BUG-702 — see IssueDetail. `assets/html/mr-a11y-1531.html` carries
    // `page-gutter right-sidebar-expanded` with no `is-merge-request`, so the
    // MR reserve is the same 290px as an issue's.
    rightSidebar: !!(project && mr),
    breadcrumbExtra: mr ? [{ text: `!${mr.iid}`, href: `${base}/-/merge_requests/${mr.iid}` }] : null,
  })

  if (!project || !mr) return <NotFound />

  const author = indexes.usersById.get(mr.author_id)
  const assignees = (mr.assignee_ids || []).map(id => indexes.usersById.get(id)).filter(Boolean)
  const reviewers = (mr.reviewer_ids || []).map(id => indexes.usersById.get(id)).filter(Boolean)
  const labels = (mr.label_ids || []).map(id => indexes.labelsById.get(id)).filter(Boolean)
  const milestone = mr.milestone_id ? indexes.milestonesById.get(mr.milestone_id) : null
  const [badgeClass, badgeText, badgeIcon] = stateBadge(mr)
  // An MR a task created in-session has no frozen diff; its tabs read 0 and
  // render the empty list rather than borrowing another MR's commits.
  const diff = getMrDiff(mr)
  const commits = diff ? diff.commits : []
  const commitsCount = diff ? diff.commitsCount : 0
  const filesCount = diff ? diff.filesCount : 0
  const pipelines = diff && diff.pipeline ? [diff.pipeline] : []
  const commitDays = groupCommitsByDay(commits)

  const projectLabels = state.labels.filter(l => l.project_id === project.id)
  const projectMilestones = state.milestones.filter(m => m.project_id === project.id && m.state !== 'closed')
  const candidates = assignableUsers(state, indexes, project, currentUser)
  const subscribed = !((state.ui.unsubscribed || []).includes(`MergeRequest:${mr.id}`))

  const participantIds = new Set([mr.author_id, ...(mr.assignee_ids || []), ...(mr.reviewer_ids || []),
    ...state.notes.filter(n => n.noteable_type === 'MergeRequest' && n.noteable_id === mr.id).map(n => n.author_id)])
  const participants = [...participantIds].map(id => indexes.usersById.get(id)).filter(Boolean)

  const patch = fields => updateIn('mergeRequests', r => r.id === mr.id,
    () => ({ ...fields, updated_at: dbStamp(new Date(), { micros: false }) }))
  const toggle = key => setEditing(cur => (cur === key ? null : key))

  /** Ticking a description checkbox rewrites the `- [ ]` in the source. */
  // React's synthetic `change` never reaches a node injected through
  // dangerouslySetInnerHTML (it has no fiber), so this listens for `click`,
  // which React does dispatch to the nearest fiber ancestor.
  function onTaskToggle(e) {
    const box = e.target
    if (!box.classList || !box.classList.contains('task-list-item-checkbox')) return
    const all = [...e.currentTarget.querySelectorAll('.task-list-item-checkbox')]
    patch({ description: toggleTaskItem(mr.description, all.indexOf(box)) })
  }

  function setMrState(next) {
    updateIn('mergeRequests', r => r.id === mr.id, () => next)
  }

  return (
    <div className="merge-request issuable-details">
      <div className="detail-page-header border-bottom-0 pt-0 pb-0 gl-display-block">
        <div className="detail-page-header-body">
          <div className="issuable-meta gl-display-flex">
            <h1 className="title page-title gl-font-size-h-display gl-my-0 gl-display-inline-block"
              data-qa-selector="title_content">{mr.title}</h1>
          </div>
        </div>
        <div className="detail-page-header-actions gl-align-self-start is-merge-request js-issuable-actions gl-display-flex" style={{ gap: 8 }}>
          <a className="btn gl-button btn-default js-issuable-edit" data-qa-selector="edit_button"
            href={`${base}/-/merge_requests/${mr.iid}/edit`}>Edit</a>
          <Dropdown className="dropdown"
            toggleClassName="btn dropdown-toggle btn-confirm gl-button gl-dropdown-toggle"
            toggleProps={{ 'data-qa-selector': 'mr_code_dropdown' }}
            toggle={<><span className="gl-dropdown-button-text">Code</span><Icon name="chevron-down" /></>}
            menuClassName="dropdown-menu dropdown-menu-right">
            <ul>
              <li className="gl-dropdown-section-header"><header className="dropdown-header">Review changes</header></li>
              <li><button type="button" className="dropdown-item js-check-out-modal-trigger"
                onClick={() => setCheckoutOpen(true)}>Check out branch</button></li>
              <li><a className="dropdown-item" data-qa-selector="open_in_web_ide_button"
                href={`/-/ide/project/${project.full_path}/merge_requests/${mr.iid}`}>Open in Web IDE</a></li>
            </ul>
          </Dropdown>
        </div>
      </div>

      {checkoutOpen ? (
        <CheckOutBranchModal mr={mr} onClose={() => setCheckoutOpen(false)} />
      ) : null}

      {/* ANCHOR — this must be the FIRST .detail-page-description in the DOM. */}
      <div className="detail-page-description py-2 gl-display-flex gl-align-items-center gl-flex-wrap">
        <span className={`badge issuable-status-badge gl-mr-3 badge-pill gl-badge md ${badgeClass}`}>
          <Icon name={badgeIcon} />
          <span className="gl-ml-2">{badgeText}</span>
        </span>
        {author ? (
          <a className="author-link gl-font-weight-bold gl-mr-2 js-user-link" data-user-id={author.id}
            data-username={author.username} data-name={author.name} href={`/${author.username}`}>
            <span className="author">{author.name}</span>
          </a>
        ) : null}
        {/* `.detail-page-description` is a flex row, so leading/trailing spaces
            inside these text nodes are stripped — the gaps have to be real
            margins on the chips, not whitespace. */}
        <span className="gl-mr-2">requested to merge</span>
        <a title={mr.source_branch} className="gl-text-blue-500! gl-font-monospace gl-bg-blue-50 gl-rounded-base gl-font-sm gl-px-2 gl-mx-2"
          style={BRANCH_CHIP} href={`/${project.full_path}/-/tree/${mr.source_branch}`}>{mr.source_branch}</a>
        <button type="button" className="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon js-source-branch-copy"
          data-title="Copy branch name" data-clipboard-text={mr.source_branch}
          title="Copy branch name" aria-label="Copy branch name"
          onClick={() => navigator.clipboard && navigator.clipboard.writeText(mr.source_branch)}>
          <Icon name="copy" />
        </button>
        <span className="gl-mx-2">into</span>
        <a title={mr.target_branch} className="gl-text-blue-500! gl-font-monospace gl-bg-blue-50 gl-rounded-base gl-font-sm gl-px-2 gl-mx-2"
          style={BRANCH_CHIP} href={`/${project.full_path}/-/tree/${mr.target_branch}`}>{mr.target_branch}</a>
        <TimeAgo value={mr.created_at} className="gl-display-inline-block gl-ml-2" placement="top" />
      </div>

      {/* Tab badges are the MR's OWN counts (TEST.md DIFF-901). The source
          renders all four: Overview = discussion count, Commits =
          merge_request_diffs.commits_count, Pipelines = the MR's pipeline
          count, Changes = merge_request_diffs.files_count. The last three were
          wrong or absent; the `li` class names and the `js-*` badge classes are
          the source's own. */}
      <div className="merge-request-tabs-container">
        <ul className="merge-request-tabs nav gl-tabs-nav">
          <li className={`nav-item notes-tab${tab === 'overview' ? ' active' : ''}`} data-qa-selector="notes_tab">
            <a className={`nav-link gl-tab-nav-item${tab === 'overview' ? ' active gl-tab-nav-item-active' : ''}`}
              href={`${base}/-/merge_requests/${mr.iid}`}>Overview
              <span className="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge js-discussions-count">{mr.user_notes_count || 0}</span></a></li>
          <li className={`nav-item commits-tab${tab === 'commits' ? ' active' : ''}`} data-qa-selector="commits_tab">
            <a className={`nav-link gl-tab-nav-item${tab === 'commits' ? ' active gl-tab-nav-item-active' : ''}`}
              href={`${base}/-/merge_requests/${mr.iid}/commits`}>Commits
              <span className="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge">{commitsCount}</span></a></li>
          <li className={`nav-item pipelines-tab${tab === 'pipelines' ? ' active' : ''}`}>
            <a className={`nav-link gl-tab-nav-item${tab === 'pipelines' ? ' active gl-tab-nav-item-active' : ''}`}
              href={`${base}/-/merge_requests/${mr.iid}/pipelines`}>Pipelines
              <span className="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge js-pipelines-mr-count">{pipelines.length}</span></a></li>
          <li className={`nav-item diffs-tab js-diffs-tab${tab === 'diffs' ? ' active' : ''}`} id="diffs-tab"
            data-qa-selector="diffs_tab">
            <a className={`nav-link gl-tab-nav-item${tab === 'diffs' ? ' active gl-tab-nav-item-active' : ''}`}
              href={`${base}/-/merge_requests/${mr.iid}/diffs`}>Changes
              <span className="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge">{filesCount}</span></a></li>
        </ul>
      </div>

      {tab === 'overview' ? (
        <>
          {/* The SECOND .detail-page-description — the description body. */}
          <div className="issuable-discussion">
            <div className="detail-page-description description js-task-list-container is-task-list-enabled"
              onClick={onTaskToggle}>
              <div className="md" data-testid="gfm-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(mr.description) }} />
            </div>
            <div className="emoji-block gl-display-flex gl-align-items-center gl-mt-3" style={{ gap: 8 }}>
              <button type="button" data-testid="award-button" className="btn gl-button btn-default btn-sm"
                onClick={() => patch({ upvotes: (mr.upvotes || 0) + 1 })}>
                👍 <span className="js-counter">{mr.upvotes || 0}</span></button>
              <button type="button" data-testid="award-button" className="btn gl-button btn-default btn-sm"
                onClick={() => patch({ downvotes: (mr.downvotes || 0) + 1 })}>
                👎 <span className="js-counter">{mr.downvotes || 0}</span></button>
              {(mr.awards || []).map(a => (
                <button key={a.name} type="button" data-testid="award-button"
                  className="btn gl-button btn-default btn-sm"
                  onClick={() => patch({
                    awards: (mr.awards || []).map(x => (x.name === a.name ? { ...x, count: x.count + 1 } : x)),
                  })}>
                  {a.name} <span className="js-counter">{a.count}</span></button>
              ))}
              <Dropdown className="emoji-picker dropdown" data-testid="emoji-picker"
                toggleClassName="btn gl-button btn-default btn-sm add-reaction-button"
                toggle="Add reaction" menuClassName="dropdown-menu">
                <ul>
                  {['🎉', '😄', '🚀', '👀', '❤️'].map(e => (
                    <li key={e}>
                      <button type="button" className="dropdown-item" onClick={() => {
                        const cur = mr.awards || []
                        patch({
                          awards: cur.some(x => x.name === e)
                            ? cur.map(x => (x.name === e ? { ...x, count: x.count + 1 } : x))
                            : [...cur, { name: e, count: 1 }],
                        })
                      }}>{e}</button>
                    </li>
                  ))}
                </ul>
              </Dropdown>
            </div>
          </div>

          {/* §15d merge widget */}
          <div className="mr-state-widget gl-mt-5" style={{ border: '1px solid var(--border-default)', borderRadius: 4 }}>
            <div className="mr-widget-body gl-display-flex gl-align-items-center"
              style={{ padding: 12, gap: 8, background: mr.state === 'merged' ? 'var(--blue-50)' : undefined }}>
              {mr.state === 'opened' ? (
                <>
                  <button type="button" className="btn gl-button btn-confirm qa-merge-button"
                    onClick={() => setMrState({ state: 'merged', merge_status: 'can_be_merged' })}>Merge</button>
                  <button type="button" className="btn gl-button btn-default"
                    onClick={() => setMrState({ state: 'closed' })}>Close merge request</button>
                  <button type="button" className="btn gl-button btn-default js-draft-toggle-button"
                    onClick={() => setMrState({ draft: !mr.draft })}>{mr.draft ? 'Mark as ready' : 'Mark as draft'}</button>
                  <button type="button" className="btn gl-button btn-default"
                    onClick={() => setCommitMsgOpen(o => !o)}>Edit commit message</button>
                  {commitMsgOpen ? (
                    <div className="js-commit-message-editor gl-w-full gl-mt-3" style={{ flexBasis: '100%' }}>
                      <label htmlFor="merge-message-edit">Commit message</label>
                      <textarea id="merge-message-edit" className="form-control gl-form-input" rows={4}
                        value={mr.merge_commit_message
                          || `Merge branch '${mr.source_branch}' into '${mr.target_branch}'\n\n${mr.title}`}
                        onChange={e => patch({ merge_commit_message: e.target.value })} />
                    </div>
                  ) : null}
                </>
              ) : mr.state === 'merged' ? (
                <span>Merged by {author ? author.name : 'a user'} <TimeAgo value={mr.updated_at} /></span>
              ) : (
                <>
                  <span>Closed</span>
                  <button type="button" className="btn gl-button btn-default"
                    onClick={() => setMrState({ state: 'opened' })}>Reopen merge request</button>
                </>
              )}
            </div>
          </div>

          <NotesTimeline noteableType="MergeRequest" noteable={mr} project={project} />
        </>
      ) : tab === 'commits' ? (
        <div className="tab-pane commits" id="commits">
          <ol className="list-unstyled" id="commits-list">
            {commitDays.map(g => (
              <React.Fragment key={g.day}>
                <li className="commit-header js-commit-header" data-day={g.day}>
                  {/* TEST.md DIFF-1101 — the source's HAML leaves a
                      whitespace text node here, so the header reads
                      `26 Jan, 2023 1 commit`, not `26 Jan, 20231 commit`. */}
                  <span className="day">{commitHeaderDate(g.day)}</span>{' '}
                  <span className="commits-count">
                    {`${g.rows.length} ${g.rows.length === 1 ? 'commit' : 'commits'}`}
                  </span>
                </li>
                <li className="commits-row" data-day={g.day}>
                  <ul className="content-list commit-list flex-list">
                    {g.rows.map(c => (
                      <li className="commit flex-row js-toggle-container" key={c.sha} id={`commit-${shortSha(c.sha)}`}>
                        <div className="avatar-cell d-none d-sm-block">
                          <a href={`mailto:${c.author_email}`}>
                            <UserAvatar user={{ id: 0, name: c.author_name }} size={40} />
                          </a>
                        </div>
                        <div className="commit-detail flex-list gl-display-flex gl-justify-content-space-between
                          gl-align-items-flex-start gl-flex-grow-1 gl-min-w-0">
                          <div className="commit-content" data-qa-selector="commit_content">
                            {/* The source links a commit row to the Changes tab
                                scoped to that commit, not to /-/commit/:sha. */}
                            <a className="commit-row-message item-title js-onboarding-commit-item"
                              href={`${base}/-/merge_requests/${mr.iid}/diffs?commit_id=${c.sha}`}>{c.title}</a>
                            <span className="commit-row-message d-inline d-sm-none">
                              {'· '}{shortSha(c.sha)}</span>
                            <div className="committer">
                              <a className="commit-author-link" href={`mailto:${c.author_email}`}>{c.author_name}</a>
                              {' authored '}<TimeAgo value={c.authored_date} />
                            </div>
                          </div>
                          <div className="commit-actions flex-row gl-display-flex gl-align-items-center"
                            style={{ gap: 4 }}>
                            <div className="commit-sha-group btn-group d-none d-sm-flex">
                              <div className="label label-monospace monospace">{shortSha(c.sha)}</div>
                              <button type="button" className="btn gl-button btn-default btn-icon"
                                title="Copy commit SHA" aria-label="Copy commit SHA" data-clipboard-text={c.sha}
                                onClick={() => navigator.clipboard && navigator.clipboard.writeText(c.sha)}>
                                <Icon name="copy" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </li>
              </React.Fragment>
            ))}
          </ol>
        </div>
      ) : tab === 'diffs' ? (
        <div className="gl-mt-3 gl-text-gray-500">
          {/* DIFF-904 / ROUTES #81. The line-by-line diff bodies are ~19 MB in
              `merge_request_diff_files` for the seeded MRs, so they are not
              carried; the file COUNT is the source's own `files_count`. This
              says exactly what ships — see ROUTES.md row 81. */}
          <p>{filesCount} changed file{filesCount === 1 ? '' : 's'} between{' '}
            <span className="gl-font-monospace">{mr.source_branch}</span> and{' '}
            <span className="gl-font-monospace">{mr.target_branch}</span>. Diff contents are
            not rendered in this instance.</p>
        </div>
      ) : tab === 'conflicts' ? (
        // ROUTES #86 — `/-/merge_requests/:iid/conflicts`. This MR has no
        // conflicts, which is the state every seeded MR is in.
        <div className="gl-mt-3">
          <h4>There are no conflicts to resolve</h4>
          <p className="gl-text-gray-500">
            The source branch <span className="gl-font-monospace">{mr.source_branch}</span> can be merged
            into <span className="gl-font-monospace">{mr.target_branch}</span> automatically.</p>
          <a className="btn gl-button btn-default" href={`${base}/-/merge_requests/${mr.iid}`}>Back to the merge request</a>
        </div>
      ) : (
        <div className="tab-pane pipelines" id="pipelines">
          {pipelines.length === 0 ? (
            <div className="gl-mt-3 gl-text-gray-500"><p>There are currently no pipelines.</p></div>
          ) : (
            <div className="content-list pipelines">
              <div className="ci-table">
                <table role="table" className="table b-table gl-table b-table-fixed b-table-stacked-lg">
                  <thead role="rowgroup">
                    <tr role="row">
                      {[['Status', 'status'], ['Pipeline', 'pipeline'], ['Triggerer', 'triggerer'],
                        ['Stages', 'stages'], ['Actions', 'actions']].map(([label, id]) => (
                          <th role="columnheader" scope="col" key={id} data-testid={`${id}-th`}>
                            <div>{label}</div></th>
                        ))}
                    </tr>
                  </thead>
                  <tbody role="rowgroup">
                    {pipelines.map(p => (
                      <tr role="row" className="commit" key={p.id} data-testid="pipeline-table-row"
                        data-qa-selector="pipeline_row_container">
                        <td role="cell" data-label="Status">
                          {/* `#<id>` and the status are TEXT, not links: this
                              mock has no `/-/pipelines/:id` page, and a link
                              into a 404 would be a dead affordance. The
                              project-level Pipelines pages are the follow-up
                              logged in DEV.r10-diffs.md. */}
                          <span className={`gl-mb-3 ci-status ci-${p.status}`} title={p.status}
                            data-qa-selector="pipeline_commit_status">
                            <span className={`ci-status-icon ci-status-icon-${p.status}`} data-testid="ci-icon-wrapper" />
                            {` ${p.status}`}</span>
                          <div className="gl-display-block gl-mt-3">
                            <p className="finished-at d-none d-md-block">
                              <TimeAgo value={p.finished_at || p.created_at} placement="top" /></p>
                          </div>
                        </td>
                        <td role="cell" data-label="Pipeline">
                          <div data-testid="pipeline-url-table-cell" className="pipeline-tags">
                            <div data-testid="commit-title-container" className="commit-title gl-mb-2">
                              <a data-testid="commit-title" className="gl-link commit-row-message gl-text-gray-900"
                                href={`${base}/-/commit/${p.sha}`}>{commitTitleOf(commits, p.sha)}</a>
                            </div>
                            <div className="gl-mb-2">
                              <span data-testid="pipeline-url-link" data-qa-selector="pipeline_url_link"
                                className="gl-mr-3">#{p.id}</span>
                              <a data-testid="commit-ref-name" className="gl-link ref-name gl-mr-3"
                                href={`${base}/-/commits/${p.ref}`}>{p.ref}</a>
                              <a data-testid="commit-short-sha" className="gl-link commit-sha mr-0"
                                href={`${base}/-/commit/${p.sha}`}>{shortSha(p.sha)}</a>
                            </div>
                            <div className="label-container gl-mt-1">
                              <span data-testid="pipeline-url-latest" className="badge badge-success badge-pill gl-badge sm"
                                title="Latest pipeline for the most recent commit on this branch">latest</span>
                            </div>
                          </div>
                        </td>
                        <td role="cell" data-label="Triggerer" />
                        <td role="cell" data-label="Stages" />
                        {/* The source's Actions cell holds a `Download
                            artifacts` dropdown. This instance's pipelines have
                            no artifacts (no runner ever ran), so the cell stays
                            empty rather than offering a dead download. */}
                        <td role="cell" data-label="Actions" />
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* §15d right sidebar. Block ORDER is the source's: Assignee, Reviewer,
          Labels, Milestone, Time tracking, Lock, Notifications, Participants,
          Reference. There is no `.block.due_date` on a merge request. */}
      <aside className="right-sidebar js-right-sidebar js-issuable-sidebar right-sidebar-expanded"
        aria-label="merge request">
        <div className="issuable-sidebar">
          <form className="issuable-context-form inline-update js-issuable-update" onSubmit={e => e.preventDefault()}>

            <div className="block assignee" data-qa-selector="assignee_block_container"
              data-testid="assignee-block-container">
              <div className="title hide-collapsed">
                {peopleHeading(assignees.length, 'Assignee')}
                <SidebarEdit open={editing === 'assignee'} onClick={() => toggle('assignee')} />
              </div>
              <div className="value hide-collapsed" data-testid="expanded-assignee">
                {assignees.length === 0 ? (
                  <span data-testid="no-value" className="no-value">None{' - '}
                    <button type="button" data-testid="assign-yourself" data-qa-selector="assign_yourself_button"
                      className="gl-button btn-link gl-reset-color!"
                      onClick={() => patch({ assignee_ids: [currentUser.id] })}>assign yourself</button>
                  </span>
                ) : assignees.map(a => (
                  <a className="gl-link js-user-link author-link bold" key={a.id} href={`/${a.username}`}
                    data-css-area="user" title={a.name}>
                    <UserAvatar user={a} size={24} />
                    <span data-testid="username" data-qa-selector="username" className="author">{a.name}</span></a>
                ))}
              </div>
              {editing === 'assignee' ? (
                <div className="selectbox hide-collapsed gl-mt-3">
                  <UserSelect users={candidates} kind="assignee" block currentUser={currentUser} defaultOpen
                    value={(mr.assignee_ids || [])[0] || null}
                    onChange={id => { patch({ assignee_ids: id ? [id] : [] }); setEditing(null) }} />
                </div>
              ) : null}
            </div>

            {/* ANCHOR — .block.reviewer (webarena-666, 667, 668, 806).
                Header is the bare word `Reviewer` when there is exactly one. */}
            <div className="block reviewer" data-qa-selector="reviewers_block_container">
              <div className="title hide-collapsed">
                {peopleHeading(reviewers.length, 'Reviewer')}
                <SidebarEdit open={editing === 'reviewer'} onClick={() => toggle('reviewer')}
                  qaSelector="reviewers_edit_button" />
              </div>
              <div className="value hide-collapsed">
                {reviewers.length === 0 ? (
                  <span data-testid="no-value" className="no-value">None{' - '}
                    <button type="button" data-testid="assign-yourself" data-qa-selector="assign_yourself_button"
                      className="gl-button btn-link gl-reset-color!"
                      onClick={() => patch({ reviewer_ids: [currentUser.id] })}>assign yourself</button>
                  </span>
                ) : reviewers.map(r => (
                  <div data-testid="reviewer" className="gl-display-grid gl-align-items-center reviewer-grid gl-mr-2" key={r.id}>
                    <a className="gl-link gl-display-inline-block js-user-link author-link bold" href={`/${r.username}`}
                      data-css-area="user">
                      <UserAvatar user={r} size={24} />
                      <div className="gl-ml-3 gl-display-grid gl-align-items-center">{r.name}</div></a>
                  </div>
                ))}
              </div>
              {editing === 'reviewer' ? (
                <div className="selectbox hide-collapsed gl-mt-3">
                  <UserSelect users={candidates} kind="reviewer" block defaultOpen
                    value={(mr.reviewer_ids || [])[0] || null}
                    onChange={id => { patch({ reviewer_ids: id ? [id] : [] }); setEditing(null) }} />
                </div>
              ) : null}
            </div>

            <div className="labels-select-wrapper gl-relative block labels js-labels-block">
              <div className="title hide-collapsed">
                <span data-testid="title">Labels</span>
                <SidebarEdit open={editing === 'labels'} onClick={() => toggle('labels')} />
              </div>
              <div className="value hide-collapsed">
                {labels.length
                  ? labels.map(l => (
                    <LabelChip key={l.id} label={l}
                      href={labelFilterUrl(`${base}/-/merge_requests`, l.title)}
                      onRemove={() => patch({ label_ids: (mr.label_ids || []).filter(id => id !== l.id) })} />
                  ))
                  : <span className="no-value">None</span>}
              </div>
              {editing === 'labels' ? (
                <div className="gl-mt-3">
                  <LabelSelect labels={projectLabels} value={mr.label_ids || []} block defaultOpen
                    manageHref={`${base}/-/labels`} onChange={ids => patch({ label_ids: ids })} />
                </div>
              ) : null}
            </div>

            <div className="block milestone" data-qa-selector="milestone_block" data-testid="sidebar-milestones">
              <div className="title hide-collapsed">
                <span data-testid="title">Milestone</span>
                <SidebarEdit open={editing === 'milestone'} onClick={() => toggle('milestone')} />
              </div>
              <div className="value hide-collapsed">
                {milestone ? <a href={`${base}/-/milestones/${milestone.iid}`}>{milestone.title}</a>
                  : <span className="no-value">None</span>}
              </div>
              {editing === 'milestone' ? (
                <div className="gl-mt-3">
                  <MilestoneSelect milestones={projectMilestones} value={mr.milestone_id || null} block defaultOpen
                    onChange={id => { patch({ milestone_id: id }); setEditing(null) }} />
                </div>
              ) : null}
            </div>

            <div className="block time-tracking">
              <div className="time-tracker sidebar-help-wrap" data-testid="time-tracker">
                <div className="title hide-collapsed">Time tracking</div>
                <div className="value hide-collapsed">No estimate or time spent</div>
              </div>
            </div>

            <div className="block issuable-sidebar-item lock">
              <div className="title hide-collapsed">Lock merge request
                <SidebarEdit open={editing === 'lock'} onClick={() => toggle('lock')} />
              </div>
              <div className="value sidebar-item-value hide-collapsed">
                <div data-testid="lock-status">{mr.discussion_locked ? 'Locked' : 'Unlocked'}</div>
              </div>
              {editing === 'lock' ? (
                <div className="gl-mt-3">
                  <button type="button" className="btn gl-button btn-default btn-sm"
                    onClick={() => { patch({ discussion_locked: !mr.discussion_locked }); setEditing(null) }}>
                    {mr.discussion_locked ? 'Unlock' : 'Lock'}</button>
                </div>
              ) : null}
            </div>

            <div className="block subscriptions">
              <div className="title hide-collapsed">
                <span data-testid="title">Notifications</span>
                <div data-testid="subscription-toggle" className="gl-toggle-wrapper gl-ml-auto">
                  <button type="button" role="switch" aria-checked={subscribed}
                    className={`gl-toggle${subscribed ? ' is-checked' : ''}`}
                    onClick={() => setUi(ui => {
                      const key = `MergeRequest:${mr.id}`
                      const cur = ui.unsubscribed || []
                      return { unsubscribed: cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key] }
                    })}>
                    <span className="toggle-icon">{subscribed ? '✓' : '✗'}</span></button>
                </div>
              </div>
            </div>

            <div className="block participants">
              <div className="title hide-collapsed">
                {participants.length} participant{participants.length === 1 ? '' : 's'}</div>
              <div className="hide-collapsed gl-display-flex" style={{ gap: 4, flexWrap: 'wrap' }}>
                {participants.map(p => (
                  <div className="participants-author gl-display-inline-block" key={p.id}>
                    <a className="author-link" href={`/${p.username}`} title={p.name}>
                      <UserAvatar user={p} size={24} alt={p.name} /></a>
                  </div>
                ))}
              </div>
            </div>

            <div className="block with-sub-blocks">
              <div className="sub-block gl-display-flex gl-align-items-center hide-collapsed">
                <span title={`${project.full_path}!${mr.iid}`}>Reference: {project.full_path}!{mr.iid}</span>
                <button type="button" className="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon gl-ml-auto"
                  title="Copy Reference" aria-label="Copy Reference" aria-live="polite"
                  data-clipboard-text={`${project.full_path}!${mr.iid}`}
                  onClick={() => navigator.clipboard && navigator.clipboard.writeText(`${project.full_path}!${mr.iid}`)}>
                  <Icon name="copy" /></button>
              </div>
              <div className="sub-block hide-collapsed gl-mt-2">
                <span>Source branch: {mr.source_branch}</span>
              </div>
            </div>
          </form>
        </div>
      </aside>
    </div>
  )
}
