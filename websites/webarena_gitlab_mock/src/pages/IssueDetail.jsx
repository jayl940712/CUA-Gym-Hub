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
import { formatDate } from '../utils/format.js'
import { renderMarkdown, taskListSummary, toggleTaskItem } from '../utils/markdown.js'
import { projectRoleFor } from '../utils/dataManager.js'
import {
  UserSelect, MilestoneSelect, LabelSelect, DateField, LabelChip, assignableUsers,
} from '../components/issuable/Controls.jsx'
import Dropdown from '../components/ui/Dropdown.jsx'
import { useQueryNavigate } from '../utils/RedirectWithQuery.jsx'
import { dbStamp } from '../components/create/mutations.js'
import { labelFilterUrl } from '../utils/issuableUrl.js'

// ROUTES #70 — `/:ns/:proj/-/issues/:iid`. assets/README.md §14 / §14b.
//
// ANCHORS on this page:
//   [data-qa-selector="title_content"]     the <h1> title
//   .detail-page-description               title + rendered description body
//   #notes-list                            see NotesTimeline
//   .block.assignee                        right sidebar (display name)
//   [data-testid="sidebar-due-date"]       right sidebar — NOTE: on an ISSUE
//     the due-date block has NO `due_date` class. `.block.due_date` exists
//     only on the milestone detail page (assets/README.md §0.9). Do not unify.
//
// Sidebar block ORDER is the source's (§14b): Assignee, Labels, Milestone,
// Due date, Time tracking, Confidentiality, Lock issue, Notifications,
// Participants, Reference, Move issue.
//
// Every `Edit` control here mutates state through the context, because
// webarena-658/659/660/808 set the assignee and the due date from this sidebar
// and then read the two anchored blocks back.

/** `Assignee` / `0 Assignees` / `<n> Assignees` — the count-dependent header. */
function assigneeHeading(n) {
  return n === 1 ? 'Assignee' : `${n} Assignees`
}

function EditButton({ open, onClick, testId = 'edit-button' }) {
  return (
    <button type="button" data-testid={testId} data-qa-selector="edit_link"
      className="btn gl-text-gray-900! gl-ml-auto hide-collapsed shortcut-sidebar-dropdown-toggle btn-default btn-sm gl-button btn-default-tertiary float-right js-sidebar-dropdown-toggle edit-link"
      aria-expanded={open} onClick={onClick}>
      <span className="gl-button-text">Edit</span>
    </button>
  )
}

export default function IssueDetail() {
  const { iid } = useParams()
  const { state, indexes, currentUser, updateIn, setUi, appendTo, removeFrom } = useApp()
  const { project, base } = useProject()
  const go = useQueryNavigate()
  const [editing, setEditing] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [moveTarget, setMoveTarget] = useState('')
  const [tasksOpen, setTasksOpen] = useState(true)
  const [linkedOpen, setLinkedOpen] = useState(true)

  const issue = project
    ? state.issues.find(i => i.project_id === project.id && String(i.iid) === String(iid))
    : null

  usePageChrome({
    title: issue && project
      ? `${issue.title} (#${issue.iid}) · Issues · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
    // TEST.md BUG-702 — `.right-sidebar` is `position: fixed`, so `.layout-page`
    // has to carry `page-gutter right-sidebar-expanded` for `.content-wrapper`
    // to reserve its 290px. The source sets exactly those classes here
    // (assets/html/issue-primer-316.html). Not on the NotFound branch below.
    rightSidebar: !!(project && issue),
    breadcrumbExtra: issue ? [{ text: `#${issue.iid}`, href: `${base}/-/issues/${issue.iid}` }] : null,
  })

  if (!project || !issue) return <NotFound />

  const author = indexes.usersById.get(issue.author_id)
  const assignees = (issue.assignee_ids || []).map(id => indexes.usersById.get(id)).filter(Boolean)
  const labels = (issue.label_ids || []).map(id => indexes.labelsById.get(id)).filter(Boolean)
  const milestone = issue.milestone_id ? indexes.milestonesById.get(issue.milestone_id) : null
  const isOpen = issue.state === 'opened'
  // §14.3 `.user-access-role` — the author's role in THIS project: their member
  // role, else `Contributor` if they have committed to it, else nothing.
  const authorRole = projectRoleFor(state, project, author)
  const tasks = taskListSummary(issue.description)
  const participantIds = new Set([issue.author_id, ...(issue.assignee_ids || []),
    ...state.notes.filter(n => n.noteable_type === 'Issue' && n.noteable_id === issue.id).map(n => n.author_id)])
  const participants = [...participantIds].map(id => indexes.usersById.get(id)).filter(Boolean)

  const projectLabels = state.labels.filter(l => l.project_id === project.id)
  const projectMilestones = state.milestones.filter(m => m.project_id === project.id && m.state !== 'closed')
  const candidates = assignableUsers(state, indexes, project, currentUser)

  const patch = fields => updateIn('issues', i => i.id === issue.id,
    () => ({ ...fields, updated_at: dbStamp(new Date(), { micros: false }) }))
  const toggle = key => setEditing(cur => (cur === key ? null : key))

  // React's synthetic `change` never reaches a node injected through
  // dangerouslySetInnerHTML (it has no fiber), so this listens for `click`,
  // which React does dispatch to the nearest fiber ancestor.
  function onTaskToggle(e) {
    const box = e.target
    if (!box.classList || !box.classList.contains('task-list-item-checkbox')) return
    const all = [...e.currentTarget.querySelectorAll('.task-list-item-checkbox')]
    patch({ description: toggleTaskItem(issue.description, all.indexOf(box)) })
  }

  // `Move issue` — only projects the current user is a member of, minus this one.
  const memberProjectIds = new Set(state.members
    .filter(m => m.source_type === 'project' && m.user_id === currentUser.id).map(m => m.source_id))
  const moveTargets = state.projects
    .filter(p => memberProjectIds.has(p.id) && p.id !== project.id).slice(0, 50)

  function moveIssue() {
    const target = state.projects.find(p => String(p.id) === String(moveTarget))
    if (!target) return
    const nextIid = Math.max(0, ...state.issues.filter(i => i.project_id === target.id)
      .map(i => Number(i.iid) || 0)) + 1
    updateIn('issues', i => i.id === issue.id,
      () => ({ project_id: target.id, iid: nextIid, milestone_id: null, label_ids: [],
        moved_from: `${project.full_path}#${issue.iid}`, updated_at: dbStamp(new Date(), { micros: false }) }))
    go(`/${target.full_path}/-/issues/${nextIid}`)
  }

  const todos = state.todos.filter(t => t.target_type === 'Issue' && t.target_id === issue.id
    && t.user_id === currentUser.id && t.state === 'pending')
  const subscribed = !((state.ui.unsubscribed || []).includes(`Issue:${issue.id}`))
  const milestoneExpired = milestone && milestone.due_date
    && Date.parse(`${milestone.due_date}T00:00:00Z`) < Date.now()

  return (
    <div className="issuable-details content-block js-details-container">
      <div className="detail-page-header">
        <div className="detail-page-header-body">
          <span className={`gl-badge badge badge-pill md issuable-status-badge ${isOpen ? 'badge-success issuable-status-badge-open' : 'badge-info issuable-status-badge-closed'}`}>
            <Icon name={isOpen ? 'issues' : 'mobile-issue-close'} />
            <span className="gl-ml-2">{isOpen ? 'Open' : 'Closed'}</span>
          </span>
          {/* §14.3 — the source's sentence begins `Issue created`, not
              `Created`, and is followed by a `.user-access-role` pill. */}
          <span className="gl-mr-2" aria-hidden="true">
            <Icon name="issues" className="gl-vertical-align-middle gl-text-gray-500" />
          </span>
          <span className="gl-mr-2">
            {'Issue created '}<TimeAgo value={issue.created_at} />{' by '}
          </span>
          {/* The source also ships an `@username` variant behind `d-sm-none`;
              this stylesheet has `.d-none` but no responsive re-show, so only
              the desktop (display-name) link is rendered. */}
          {author ? (
            <strong>
              <a className="author-link js-user-link" data-user-id={author.id}
                data-username={author.username} data-name={author.name} href={`/${author.username}`}>
                <span className="author">{author.name}</span>
              </a>
            </strong>
          ) : null}
          {/* TEST.md DIFF-1102 — the source's class list, verbatim. `d-none
              d-xl-inline-block` really does hide this pill below Bootstrap's
              xl breakpoint (1200px); global.css now carries that one media
              query so the class means what it means on the source instead of
              hiding the pill outright. */}
          {authorRole ? (
            <span className="user-access-role has-tooltip d-none d-xl-inline-block gl-ml-3"
              title={authorRole.title}>
              {authorRole.label}
            </span>
          ) : null}
          {/* `1 of 3 checklist items completed` — the source's `#task_status`,
              rendered only when the description has a task list (DIFF-906). */}
          {tasks.total ? (
            <>
              <span id="task_status" className="d-none d-md-inline-block gl-ml-3">
                {`${tasks.done} of ${tasks.total} checklist items completed`}</span>
              <span id="task_status_short" className="d-md-none">
                {`${tasks.done}/${tasks.total} checklist items`}</span>
            </>
          ) : null}
        </div>
        {/* §14.3 — Close/Reopen plus a `⋮` `Issue actions` dropdown. The source
            renders NEITHER an `Edit` nor a `New issue` button here. */}
        <div className="detail-page-header-actions gl-display-flex gl-align-self-start" style={{ gap: 8 }}>
          <button type="button" className="btn btn-default btn-md gl-button"
            data-qa-selector={isOpen ? 'close_issue_button' : 'reopen_issue_button'}
            onClick={() => patch(isOpen
              ? { state: 'closed', closed_at: dbStamp(new Date(), { micros: false }), closed_by_id: currentUser.id }
              : { state: 'opened', closed_at: null })}>
            <span className="gl-button-text">{isOpen ? 'Close issue' : 'Reopen issue'}</span>
          </button>
          <Dropdown className="dropdown b-dropdown gl-dropdown gl-ml-3 btn-group"
            data-qa-selector="issue_actions_ellipsis_dropdown" data-testid="desktop-dropdown"
            title="Issue actions" aria-label="Issue actions"
            toggleClassName="btn dropdown-toggle btn-default btn-md gl-button gl-dropdown-toggle btn-default-tertiary dropdown-icon-only dropdown-toggle-no-caret"
            toggle={<>
              <Icon name="ellipsis_v" className="dropdown-icon" />
              <span className="gl-dropdown-button-text gl-sr-only">Issue actions</span>
              <Icon name="chevron-down" className="dropdown-chevron" />
            </>}
            menuAs="ul" menuClassName="dropdown-menu dropdown-menu-right" menuProps={{ role: 'menu' }}>
            <li role="presentation" className="gl-dropdown-item">
              <a role="menuitem" className="dropdown-item"
                href={`${base}/-/issues/new?add_related_issue=${issue.iid}`}>
                <div className="gl-dropdown-item-text-wrapper">
                  <p className="gl-dropdown-item-text-primary">New related issue</p>
                </div>
              </a>
            </li>
            <li role="presentation" className="gl-dropdown-item">
              <button role="menuitem" type="button" className="dropdown-item"
                onClick={() => setConfirmDelete(true)}>
                <div className="gl-dropdown-item-text-wrapper">
                  <p className="gl-dropdown-item-text-primary">Delete issue</p>
                </div>
              </button>
            </li>
          </Dropdown>
        </div>
      </div>

      {confirmDelete ? (
        <>
          <div className="modal-backdrop" onClick={() => setConfirmDelete(false)} />
          <div className="modal" role="dialog" aria-modal="true" aria-label="Delete issue">
            <div className="modal-dialog"><div className="modal-content">
              <div className="modal-header"><h4 className="modal-title">Delete issue</h4></div>
              <div className="modal-body">
                <p>Issue will be removed! Are you sure?</p>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn gl-button btn-default"
                  onClick={() => setConfirmDelete(false)}>
                  <span className="gl-button-text">Cancel</span></button>
                <button type="button" className="btn gl-button btn-danger"
                  onClick={() => { removeFrom('issues', i => i.id === issue.id); go(`${base}/-/issues`) }}>
                  <span className="gl-button-text">Delete issue</span></button>
              </div>
            </div></div>
          </div>
        </>
      ) : null}

      {/* ANCHOR — .detail-page-description carries the title then the body. */}
      <div className="detail-page-description content-block js-detail-page-description gl-pb-0 gl-border-none">
        <div className="title-container">
          <h1 data-qa-selector="title_content" dir="auto" className="title gl-font-size-h-display">{issue.title}</h1>
          <a title="Edit title and description" aria-label="Edit title and description"
            className="btn btn-edit js-issuable-edit btn-default btn-md gl-button btn-icon"
            href={`${base}/-/issues/${issue.iid}/edit`}><Icon name="pencil" /></a>
        </div>
        {/* Ticking a checkbox rewrites the `- [ ]` in the description source,
            exactly as the source does — so it persists, survives a reload and
            shows up in `/go` as `issues.changed → [].description`. */}
        <div className="description js-task-list-container is-task-list-enabled"
          data-qa-selector="description_content" onClick={onTaskToggle}>
          <div className="md" data-testid="gfm-content"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(issue.description) }} />
        </div>
        <div className="emoji-block emoji-list-container js-noteable-awards gl-display-flex gl-align-items-center gl-mt-3"
          style={{ gap: 8 }}>
          <button type="button" data-testid="award-button" className="btn gl-button btn-default btn-sm"
            onClick={() => patch({ upvotes: (issue.upvotes || 0) + 1 })}>
            👍 <span className="js-counter">{issue.upvotes || 0}</span></button>
          <button type="button" data-testid="award-button" className="btn gl-button btn-default btn-sm"
            onClick={() => patch({ downvotes: (issue.downvotes || 0) + 1 })}>
            👎 <span className="js-counter">{issue.downvotes || 0}</span></button>
          {(issue.awards || []).map(a => (
            <button key={a.name} type="button" data-testid="award-button"
              className="btn gl-button btn-default btn-sm"
              onClick={() => patch({
                awards: (issue.awards || []).map(x => (x.name === a.name ? { ...x, count: x.count + 1 } : x)),
              })}>
              {a.name} <span className="js-counter">{a.count}</span></button>
          ))}
          <Dropdown className="emoji-picker dropdown" data-testid="emoji-picker"
            toggleProps={{ title: 'Add reaction' }}
            toggleClassName="btn gl-button btn-default btn-sm add-reaction-button"
            toggle={<><span className="gl-sr-only">Add reaction</span>☺</>}
            menuClassName="dropdown-menu">
            <ul>
              {['🎉', '😄', '🚀', '👀', '❤️'].map(e => (
                <li key={e}>
                  <button type="button" className="dropdown-item" onClick={() => {
                    const cur = issue.awards || []
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

      {/* TEST.md DIFF-906 — the `Tasks` and `Linked items` cards that sit
          between the description and Activity. Every string is from
          `assets/html/issue-a11ywebring-71.html`. No seeded issue has a task
          child or a linked item, so both render the source's own empty state
          with a `0` count; the collapse toggles work. The `Add` controls the
          source puts in these headers are NOT reproduced — creating a task
          work-item / linking an issue is a feature the mock does not have, and
          a button that opens nothing is worse than its absence. */}
      <div data-testid="work-item-links" className="gl-rounded-base gl-border-1 gl-border-solid gl-border-gray-100 gl-bg-gray-10 gl-mt-4">
        <div className="gl-px-5 gl-py-3 gl-display-flex gl-justify-content-space-between gl-border-b-1 gl-border-b-solid gl-border-b-gray-100">
          <div className="gl-display-flex gl-flex-grow-1">
            <h5 className="gl-m-0 gl-line-height-24">Tasks</h5>
            <span data-testid="children-count" className="gl-display-inline-flex gl-align-items-center gl-line-height-24 gl-ml-3">0</span>
          </div>
          <button type="button" data-testid="toggle-links" aria-label={tasksOpen ? 'Collapse tasks' : 'Expand tasks'}
            className="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon"
            onClick={() => setTasksOpen(o => !o)}>
            <Icon name={tasksOpen ? 'chevron-up' : 'chevron-down'} />
          </button>
        </div>
        {tasksOpen ? (
          <div data-testid="links-body" className="gl-bg-gray-10 gl-p-5 gl-pb-3">
            <div data-testid="links-empty">
              <p className="gl-mb-3">No tasks are currently assigned. Use tasks to break down this issue into smaller parts.</p>
            </div>
          </div>
        ) : null}
      </div>

      <div id="related-issues" className="related-issues-block">
        <div className="card card-slim gl-overflow-hidden gl-mt-5 gl-mb-0">
          <div className="gl-display-flex gl-justify-content-space-between gl-line-height-24 gl-py-3 gl-px-5 gl-bg-gray-10 gl-border-b-solid gl-border-b-gray-100 gl-border-b-1">
            <h3 className="card-title h5 gl-my-0 gl-display-flex gl-align-items-center gl-flex-grow-1">
              {'Linked items '}
              <div className="js-related-issues-header-issue-count gl-display-inline-flex gl-mx-3">
                <span className="gl-display-inline-flex gl-align-items-center">
                  <Icon name="issues" className="gl-mr-2 gl-text-gray-500" />0</span>
              </div>
            </h3>
            <button type="button" data-testid="toggle-links" aria-label={linkedOpen ? 'Collapse' : 'Expand'}
              className="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon"
              onClick={() => setLinkedOpen(o => !o)}>
              <Icon name={linkedOpen ? 'chevron-up' : 'chevron-down'} />
            </button>
          </div>
          {linkedOpen ? (
            <div data-testid="related-issues-body" className="linked-issues-card-body gl-bg-gray-10">
              <div data-testid="related-items-empty">
                <p className="gl-my-5 gl-px-5">
                  {"Link issues together to show that they're related. "}
                  <a data-testid="help-link" aria-label="Learn more about linking issues"
                    className="gl-link" href="/help/user/project/issues/related_issues">Learn more.</a>
                </p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <NotesTimeline noteableType="Issue" noteable={issue} project={project} />

      {/* §14b right sidebar — block order and classes are evaluator-visible. */}
      <aside className="right-sidebar js-right-sidebar js-issuable-sidebar right-sidebar-expanded"
        data-issuable-type="issue" aria-live="polite" aria-label="issue">
        <div className="issuable-sidebar">
          <div className="issuable-sidebar-header gl-display-flex gl-align-items-center">
            <div data-testid="sidebar-todo">
              <button type="button" className="btn hide-collapsed btn-default btn-sm gl-button"
                aria-label={todos.length ? 'Mark as done' : 'Add a to do'}
                onClick={() => {
                  if (todos.length) {
                    updateIn('todos', t => todos.some(x => x.id === t.id), () => ({ state: 'done' }))
                  } else {
                    appendTo('todos', {
                      // `nextIds` has no todo counter; todos are a tiny table,
                      // so derive the next id from the collection itself.
                      id: Math.max(0, ...state.todos.map(t => t.id)) + 1,
                      user_id: currentUser.id,
                      project_id: project.id,
                      target_id: issue.id,
                      target_type: 'Issue',
                      author_id: currentUser.id,
                      action: 4,
                      state: 'pending',
                      created_at: dbStamp(new Date(), { micros: false }),
                      group_id: null,
                    })
                  }
                }}>
                <span className="gl-button-text">{todos.length ? 'Mark as done' : 'Add a to do'}</span>
              </button>
            </div>
            <a className="gutter-toggle float-right js-sidebar-toggle has-tooltip gl-ml-auto" role="button"
              href="#" aria-label="Toggle sidebar" title="Collapse sidebar"
              onClick={e => e.preventDefault()}>
              <span className="js-sidebar-toggle-container" data-is-expanded="true">
                <Icon name="angle-double-right" /></span>
            </a>
          </div>

          <form className="issuable-context-form inline-update js-issuable-update"
            onSubmit={e => e.preventDefault()}>

            {/* 1. ANCHOR — .block.assignee */}
            <div className="block assignee" data-qa-selector="assignee_block_container"
              data-testid="assignee-block-container">
              <div className="title hide-collapsed">
                {assigneeHeading(assignees.length)}
                <EditButton open={editing === 'assignee'} onClick={() => toggle('assignee')} />
              </div>
              <div className="value hide-collapsed" data-testid="expanded-assignee">
                {assignees.length === 0 ? (
                  <span data-testid="no-value" className="no-value">None
                    {' - '}
                    <button type="button" data-testid="assign-yourself" data-qa-selector="assign_yourself_button"
                      className="gl-button btn-link gl-reset-color!"
                      onClick={() => patch({ assignee_ids: [currentUser.id] })}>assign yourself</button>
                  </span>
                ) : assignees.map(a => (
                  <div className="assignee-grid gl-display-grid gl-align-items-center gl-w-full" key={a.id}>
                    <a className="gl-link gl-display-inline-block js-user-link author-link bold"
                      data-user-id={a.id} data-css-area="user" title={a.name} href={`/${a.username}`}>
                      <UserAvatar user={a} size={24} />
                      <span data-testid="username" data-qa-selector="username" className="author">{a.name}</span>
                    </a>
                  </div>
                ))}
              </div>
              {editing === 'assignee' ? (
                <div className="js-sidebar-assignee-data selectbox hide-collapsed gl-mt-3">
                  <UserSelect users={candidates} kind="assignee" block currentUser={currentUser} defaultOpen
                    value={(issue.assignee_ids || [])[0] || null}
                    onChange={id => { patch({ assignee_ids: id ? [id] : [] }); setEditing(null) }} />
                </div>
              ) : null}
            </div>

            {/* 2. .block.labels */}
            <div className="labels-select-wrapper gl-relative block labels js-labels-block"
              data-testid="sidebar-labels" data-qa-selector="labels_block">
              <div className="title hide-collapsed">
                <span data-testid="title">Labels</span>
                <EditButton open={editing === 'labels'} onClick={() => toggle('labels')} />
              </div>
              <div className="value hide-collapsed issuable-show-labels js-value" data-testid="value-wrapper">
                {labels.length
                  ? labels.map(l => (
                    <LabelChip key={l.id} label={l}
                      href={labelFilterUrl(`${base}/-/issues`, l.title)}
                      onRemove={() => patch({ label_ids: (issue.label_ids || []).filter(id => id !== l.id) })} />
                  ))
                  : <span className="no-value">None</span>}
              </div>
              {editing === 'labels' ? (
                <div className="gl-mt-3" data-testid="expanded-content">
                  <LabelSelect labels={projectLabels} value={issue.label_ids || []} block defaultOpen
                    manageHref={`${base}/-/labels`}
                    onChange={ids => patch({ label_ids: ids })} />
                </div>
              ) : null}
            </div>

            {/* 3. .block.milestone */}
            <div className="block milestone" data-qa-selector="milestone_block" data-testid="sidebar-milestones">
              <div className="title hide-collapsed">
                <span data-testid="title">Milestone</span>
                <EditButton open={editing === 'milestone'} onClick={() => toggle('milestone')} />
              </div>
              <div className="value hide-collapsed" data-testid="select-milestone">
                {milestone ? (
                  <a data-qa-selector="milestone_link" className="gl-link gl-reset-color"
                    href={`${base}/-/milestones/${milestone.iid}`}>
                    {milestone.title}{milestoneExpired ? <> <span>(expired)</span></> : null}
                  </a>
                ) : <span className="no-value">None</span>}
              </div>
              {editing === 'milestone' ? (
                <div className="gl-mt-3" data-testid="expanded-content">
                  <MilestoneSelect milestones={projectMilestones} value={issue.milestone_id || null} block defaultOpen
                    onChange={id => { patch({ milestone_id: id }); setEditing(null) }} />
                </div>
              ) : null}
            </div>

            {/* 4. ANCHOR — issues use data-testid, NOT `.block.due_date`. */}
            <div className="block" data-testid="sidebar-due-date">
              <div className="title hide-collapsed">
                <span data-testid="title">Due date</span>
                <EditButton open={editing === 'dueDate'} onClick={() => toggle('dueDate')} />
              </div>
              <div className="gl-display-flex gl-align-items-center hide-collapsed" data-testid="collapsed-content">
                {issue.due_date ? (
                  <>
                    <span data-testid="sidebar-date-value" className="gl-text-gray-900">{formatDate(issue.due_date)}</span>
                    <div className="gl-display-flex">
                      <span className="gl-px-2">-</span>
                      <button type="button" data-testid="reset-button" className="btn btn-link gl-text-gray-500!"
                        onClick={() => patch({ due_date: null })}>remove due date</button>
                    </div>
                  </>
                ) : (
                  <span data-testid="sidebar-date-value" className="gl-text-gray-500">None</span>
                )}
              </div>
              {editing === 'dueDate' ? (
                <div className="gl-mt-3" data-testid="expanded-content">
                  <DateField id="issuable-due-date" name="issue[due_date]" value={issue.due_date || null}
                    placeholder="YYYY-MM-DD"
                    onChange={v => patch({ due_date: v })} />
                </div>
              ) : null}
            </div>

            {/* 5. .block.time-tracking */}
            <div className="block time-tracking">
              <div className="time-tracker sidebar-help-wrap" data-testid="time-tracker">
                <div className="title hide-collapsed">Time tracking
                  <button type="button" data-testid="add-time-entry-button" title="Add time entry"
                    className="btn gl-ml-auto btn-default btn-sm gl-button btn-default-tertiary"
                    onClick={() => toggle('time')}>
                    <span className="gl-button-text">+</span></button>
                </div>
                {issue.time_estimate || issue.total_time_spent ? (
                  <div className="value hide-collapsed" data-testid="timeTrackingComparisonPane">
                    <span className="gl-text-gray-900">
                      {issue.time_estimate ? `Estimated: ${issue.time_estimate}` : null}
                      {issue.time_estimate && issue.total_time_spent ? ' · ' : null}
                      {issue.total_time_spent ? `Spent: ${issue.total_time_spent}` : null}
                    </span>
                  </div>
                ) : (
                  <div className="value hide-collapsed" data-testid="noTrackingPane">
                    <span className="gl-text-gray-500">No estimate or time spent</span></div>
                )}
                {editing === 'time' ? (
                  <div className="gl-mt-3" data-testid="set-time-entry-form">
                    <label htmlFor="issue-time-estimate">Estimate</label>
                    <input id="issue-time-estimate" className="form-control gl-form-input" placeholder="e.g. 1h 30m"
                      defaultValue={issue.time_estimate || ''}
                      onBlur={e => patch({ time_estimate: e.target.value.trim() || null })} />
                    <label htmlFor="issue-time-spent" className="gl-mt-2">Time spent</label>
                    <input id="issue-time-spent" className="form-control gl-form-input" placeholder="e.g. 45m"
                      defaultValue={issue.total_time_spent || ''}
                      onBlur={e => patch({ total_time_spent: e.target.value.trim() || null })} />
                    <button type="button" className="btn gl-button btn-confirm btn-sm gl-mt-3"
                      onClick={() => setEditing(null)}>
                      <span className="gl-button-text">Save</span></button>
                  </div>
                ) : null}
              </div>
            </div>

            {/* 6. .block.confidentiality */}
            <div className="block confidentiality">
              <div className="title hide-collapsed">
                <span data-testid="title">Confidentiality</span>
                <EditButton open={editing === 'confidential'} onClick={() => toggle('confidential')} />
              </div>
              <div className="value hide-collapsed" data-testid="collapsed-content">
                <span data-testid="confidential-text">
                  {issue.confidential ? 'Confidential' : 'Not confidential'}</span>
              </div>
              {editing === 'confidential' ? (
                <div className="sidebar-item-warning-message gl-mt-3">
                  <p data-testid="warning-message">
                    You are going to turn {issue.confidential ? 'off' : 'on'} confidentiality. Only project members with{' '}
                    <strong>at least the Reporter role, the author, and assignees</strong> can view or be notified about this issue.
                  </p>
                  <div className="sidebar-item-warning-message-actions gl-display-flex" style={{ gap: 8 }}>
                    <button type="button" data-testid="confidential-cancel" className="btn gl-mr-3 btn-default btn-md gl-button"
                      onClick={() => setEditing(null)}><span className="gl-button-text">Cancel</span></button>
                    <button type="button" data-testid="confidential-toggle" className="btn btn-confirm btn-md gl-button btn-confirm-secondary"
                      onClick={() => { patch({ confidential: !issue.confidential }); setEditing(null) }}>
                      <span className="gl-button-text">{issue.confidential ? 'Turn off' : 'Turn on'}</span></button>
                  </div>
                </div>
              ) : null}
            </div>

            {/* 7. .block.issuable-sidebar-item.lock — select with `.block.lock` */}
            <div className="block issuable-sidebar-item lock">
              <div className="title hide-collapsed">Lock issue
                <EditButton open={editing === 'lock'} onClick={() => toggle('lock')} testId="edit-link" />
              </div>
              <div className="value sidebar-item-value hide-collapsed">
                <div data-testid="lock-status" className="sidebar-item-value hide-collapsed">
                  {issue.discussion_locked ? 'Locked' : 'Unlocked'}</div>
              </div>
              {editing === 'lock' ? (
                <div className="gl-mt-3">
                  <button type="button" className="btn gl-button btn-default btn-sm"
                    onClick={() => { patch({ discussion_locked: !issue.discussion_locked }); setEditing(null) }}>
                    {issue.discussion_locked ? 'Unlock' : 'Lock'}</button>
                </div>
              ) : null}
            </div>

            {/* 8. .block.subscriptions */}
            <div className="block subscriptions">
              <div className="title hide-collapsed">
                <span data-testid="title">Notifications</span>
                <div data-testid="subscription-toggle" className="gl-toggle-wrapper gl-ml-auto">
                  <span data-testid="toggle-label" className="gl-toggle-label gl-sr-only">Notifications</span>
                  <button type="button" role="switch" aria-checked={subscribed}
                    className={`gl-flex-shrink-0 gl-toggle${subscribed ? ' is-checked' : ''}`}
                    onClick={() => setUi(ui => {
                      const key = `Issue:${issue.id}`
                      const cur = ui.unsubscribed || []
                      return { unsubscribed: cur.includes(key) ? cur.filter(k => k !== key) : [...cur, key] }
                    })}>
                    <span className="toggle-icon">{subscribed ? '✓' : '✗'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* 9. .block.participants */}
            <div className="block participants">
              <div className="title hide-collapsed">
                {participants.length} participant{participants.length === 1 ? '' : 's'}</div>
              <div className="hide-collapsed gl-display-flex" style={{ gap: 4, flexWrap: 'wrap' }}>
                {participants.map(p => (
                  <div className="participants-author gl-display-inline-block" key={p.id}>
                    <a className="author-link" href={`/${p.username}`} title={p.name}>
                      <UserAvatar user={p} size={24} alt={p.name} />
                    </a>
                  </div>
                ))}
              </div>
            </div>

            {/* 10. .block.with-sub-blocks — the Reference block */}
            <div className="block with-sub-blocks">
              <div className="sub-block gl-display-flex gl-align-items-center hide-collapsed" style={{ gap: 4 }}>
                <span title={`${project.full_path}#${issue.iid}`} style={{ wordBreak: 'break-all' }}>
                  Reference: {project.full_path}#{issue.iid}</span>
                <button type="button" className="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon gl-ml-auto"
                  title="Copy Reference" aria-label="Copy Reference" aria-live="polite"
                  data-clipboard-text={`${project.full_path}#${issue.iid}`}
                  onClick={() => navigator.clipboard && navigator.clipboard.writeText(`${project.full_path}#${issue.iid}`)}>
                  <Icon name="copy" />
                </button>
              </div>
            </div>

            {/* 11. .block.js-sidebar-move-issue-block */}
            <div className="block js-sidebar-move-issue-block">
              <div className="dropdown sidebar-move-issue-dropdown hide-collapsed">
                <button type="button" className="gl-button btn btn-block btn-md btn-default js-sidebar-dropdown-toggle js-move-issue"
                  onClick={() => toggle('move')}>
                  <span className="gl-button-text">Move issue</span></button>
                {editing === 'move' ? (
                  <div className="gl-mt-3">
                    <label htmlFor="move-issue-project">Move issue to</label>
                    <select id="move-issue-project" className="form-control gl-form-input"
                      value={moveTarget} onChange={e => setMoveTarget(e.target.value)}>
                      <option value="">Select project</option>
                      {moveTargets.map(p => (
                        <option key={p.id} value={p.id}>{p.full_path}</option>
                      ))}
                    </select>
                    <button type="button" className="btn gl-button btn-confirm btn-sm gl-mt-3"
                      disabled={!moveTarget} onClick={moveIssue}>
                      <span className="gl-button-text">Move</span></button>
                  </div>
                ) : null}
              </div>
            </div>
          </form>
        </div>
      </aside>
    </div>
  )
}
