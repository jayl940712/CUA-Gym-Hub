import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'
import { formatDate, formatDateRange } from '../utils/format.js'
import { renderMarkdown } from '../utils/markdown.js'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import { LabelChip } from '../components/issuable/Controls.jsx'
import { useQueryNavigate } from '../utils/RedirectWithQuery.jsx'
import { dbStamp } from '../components/create/mutations.js'
import { issuableListUrl } from '../utils/issuableUrl.js'

// ROUTES #92 — `/:ns/:proj/-/milestones/:iid`. assets/README.md §16b.
//
// ANCHORS (webarena-590…594):
//   #content-body            the <main> wrapper — provided by <Layout>, and the
//                            right sidebar is INSIDE it, so `#content-body`
//                            outerText contains both dates.
//   .block.start_date        right sidebar
//   .block.due_date          right sidebar
//
// `.block.due_date` / `.block.start_date` exist ONLY here. The issue sidebar
// uses [data-testid="sidebar-due-date"] instead — do not add these classes
// there or the two task sets cross-contaminate (assets/README.md §0.9).

/** `%b %-d, %Y` date-only comparison against today, in local terms. */
function dayValue(v) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v || ''))
  return m ? Number(`${m[1]}${m[2]}${m[3]}`) : null
}

function todayValue() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return Number(`${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`)
}

/** Turn a `YYYYMMDD` day value back into a UTC epoch, for day arithmetic. */
function utcOf(dayVal) {
  const s = String(dayVal)
  return Date.UTC(Number(s.slice(0, 4)), Number(s.slice(4, 6)) - 1, Number(s.slice(6, 8)))
}

/** `milestone_status_string` — the `.status-box` copy (§16b). */
function statusBox(m) {
  const today = todayValue()
  const due = dayValue(m.due_date)
  const start = dayValue(m.start_date)
  if (m.state === 'closed') return ['Closed', 'gl-bg-red-500']
  if (due !== null && due < today) return ['Past due', 'gl-bg-orange-500']
  if (start !== null && start > today) return ['Upcoming', 'gl-bg-gray-500']
  return ['Open', 'gl-bg-green-500']
}

/** The `.status-box` colour classes are GitLab utilities the mock's stylesheet
 *  does not carry, so paint them here. */
function statusBoxStyle(boxClass) {
  const bg = {
    'gl-bg-red-500': '#dd2b0e',
    'gl-bg-orange-500': '#ab6100',
    'gl-bg-gray-500': '#89888d',
    'gl-bg-green-500': '#108548',
  }[boxClass]
  return { background: bg, color: '#fff', borderRadius: 4, padding: '2px 10px', fontSize: 12, fontWeight: 600 }
}

/** `milestone_date_range` (§16b) — five distinct sentences, verbatim. */
export function milestoneDateRange(m) {
  const today = todayValue()
  const due = dayValue(m.due_date)
  const start = dayValue(m.start_date)
  if (start !== null && due !== null) return formatDateRange(m.start_date, m.due_date)
  if (due !== null) return `${due < today ? 'expired on' : 'expires on'} ${formatDate(m.due_date)}`
  if (start !== null) return `${start < today ? 'started on' : 'starts on'} ${formatDate(m.start_date)}`
  return ''
}

/** `remaining_days_in_words` — the parenthesised suffix on `.block.due_date`. */
function remainingDays(m) {
  const today = todayValue()
  const due = dayValue(m.due_date)
  const start = dayValue(m.start_date)
  if (due !== null) {
    if (due < today) return 'Past due'
    if (due === today) return 'Today'
    if (start !== null && start > today) return 'Upcoming'
    const days = Math.round((utcOf(due) - utcOf(today)) / 86400000)
    if (days >= 365) { const y = Math.round(days / 365); return `${y} year${y === 1 ? '' : 's'} remaining` }
    if (days >= 30) { const mo = Math.round(days / 30); return `${mo} month${mo === 1 ? '' : 's'} remaining` }
    return `${days} day${days === 1 ? '' : 's'} remaining`
  }
  return ''
}

export default function MilestoneDetail() {
  const { iid } = useParams()
  const { state, indexes, updateIn, removeFrom } = useApp()
  const go = useQueryNavigate()
  const [confirmDelete, setConfirmDelete] = React.useState(false)
  const { project, base } = useProject()
  const q = useQuery()
  const [tab, setTab] = useState('issues')

  const milestone = project
    ? state.milestones.find(m => m.project_id === project.id && String(m.iid) === String(iid))
    : null

  usePageChrome({
    title: milestone && project
      ? `${milestone.title} · Milestones · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    breadcrumbExtra: milestone ? [{ text: milestone.title, href: `${base}/-/milestones/${milestone.iid}` }] : null,
  })

  // GitLab toggles the milestone with a PUT link carrying
  // `?milestone[state_event]=close|activate`. The mock honours the same URL and
  // then drops the param so a refresh does not re-apply it.
  const stateEvent = q.get('milestone[state_event]')
  const milestoneId = milestone ? milestone.id : null
  useEffect(() => {
    if (!stateEvent || !milestoneId) return
    updateIn('milestones', m => m.id === milestoneId,
      () => ({ state: stateEvent === 'close' ? 'closed' : 'active', updated_at: dbStamp(new Date(), { micros: false }) }))
    const p = new URLSearchParams(q.searchParams)
    p.delete('milestone[state_event]')
    q.setSearchParams(p, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stateEvent, milestoneId])

  if (!project || !milestone) return <NotFound />

  const issues = state.issues.filter(i => i.milestone_id === milestone.id)
  const mrs = state.mergeRequests.filter(m => m.milestone_id === milestone.id)
  const openIssues = issues.filter(i => i.state === 'opened')
  const closedIssues = issues.filter(i => i.state === 'closed')
  const unstarted = openIssues.filter(i => !(i.assignee_ids || []).length)
  const ongoing = openIssues.filter(i => (i.assignee_ids || []).length)
  const pct = issues.length ? Math.round((closedIssues.length / issues.length) * 100) : 0
  const [boxText, boxClass] = statusBox(milestone)
  const range = milestoneDateRange(milestone)
  const remaining = remainingDays(milestone)
  const closed = milestone.state === 'closed'

  const participantIds = new Set()
  for (const i of issues) for (const a of (i.assignee_ids || [])) participantIds.add(a)
  for (const i of issues) participantIds.add(i.author_id)
  const participants = [...participantIds].map(id => indexes.usersById.get(id)).filter(Boolean)

  const labelIds = new Set()
  for (const i of issues) for (const l of (i.label_ids || [])) labelIds.add(l)
  const labels = [...labelIds].map(id => indexes.labelsById.get(id)).filter(Boolean)

  // DIFF-1303 — every link out of a milestone lands on the issue list, so it
  // uses the same builder the list's own controls do (trailing slash,
  // `encodeURIComponent` escaping, canonical param order).
  const issueFilterHref = (extra = {}) =>
    issuableListUrl(`${base}/-/issues`, '', { milestone_title: milestone.title, ...extra }, { defaults: false })

  function issueColumn(heading, rows, listId, extraHeaderClass) {
    return (
      <div className="col-md-4" style={{ flex: 1, minWidth: 240 }}>
        <div className="gl-card gl-mb-5" style={{ border: '1px solid var(--border-default, #dcdcde)', borderRadius: 4 }}>
          <div className={`gl-card-header gl-display-flex ${extraHeaderClass || ''}`.trim()}
            style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-light, #ececef)' }}>
            <div className="gl-flex-grow-2">{heading}</div>
            <div className="gl-ml-3 gl-flex-shrink-0 gl-font-weight-bold gl-white-space-nowrap gl-text-gray-500">
              <span>{rows.length}</span>
            </div>
          </div>
          <div className="gl-card-body gl-py-0" style={{ padding: '0 12px' }}>
            <ul className="content-list milestone-issues-list" id={listId}>
              {rows.map(i => (
                <li className="issuable-row" key={i.id}>
                  <span><a href={`${base}/-/issues/${i.iid}`} title={i.title}>{i.title}</a></span>
                  <div className="issuable-detail gl-display-flex gl-align-items-center" style={{ gap: 6, flexWrap: 'wrap' }}>
                    <a className="issue-link" href={`${base}/-/issues/${i.iid}`}>
                      <span className="issuable-number">#{i.iid}</span></a>
                    {(i.label_ids || []).map(id => indexes.labelsById.get(id)).filter(Boolean).map(l => (
                      <LabelChip key={l.id} label={l}
                        href={issueFilterHref({ 'label_name[]': l.title, state: 'all' })} />
                    ))}
                    {(i.assignee_ids || []).map(id => indexes.usersById.get(id)).filter(Boolean).map(u => (
                      <span className="assignee-icon" key={u.id}>
                        <a className="has-tooltip" title={`Assigned to ${u.name}`}
                          href={issueFilterHref({ assignee_username: u.username, state: 'all' })}>
                          <UserAvatar user={u} size={16} />
                        </a></span>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="milestone-page gl-display-flex" style={{ gap: 24, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="detail-page-header milestone-page-header">
          <div className={`status-box ${boxClass}`} style={statusBoxStyle(boxClass)}>{boxText}</div>
          <div className="header-text-content">
            <span className="identifier"><strong>Milestone</strong></span>
            {range ? ` ${range}` : null}
          </div>
          <div className="milestone-buttons detail-page-header-actions gl-display-flex" style={{ gap: 8 }}>
            <a className="gl-button btn btn-md btn-default btn-grouped" href={`${base}/-/milestones/${milestone.iid}/edit`}>Edit</a>
            <a className="gl-button btn btn-md btn-default btn-grouped btn-close"
              href={`${base}/-/milestones/${milestone.iid}?milestone%5Bstate_event%5D=${closed ? 'activate' : 'close'}`}>
              {closed ? 'Reopen milestone' : 'Close milestone'}
            </a>
            <button type="button" className="gl-button btn btn-md btn-danger js-delete-milestone-button btn-grouped"
              data-milestone-id={milestone.id} data-milestone-title={milestone.title}
              onClick={() => setConfirmDelete(true)}>
              <span className="gl-button-text">Delete</span>
            </button>
          </div>
        </div>

        {confirmDelete ? (
          <>
            <div className="modal-backdrop" onClick={() => setConfirmDelete(false)} />
            <div className="modal" role="dialog" aria-modal="true" aria-label="Delete milestone">
              <div className="modal-dialog"><div className="modal-content">
                <div className="modal-header"><h4 className="modal-title">Delete milestone</h4></div>
                <div className="modal-body">
                  <p>{`Delete milestone ${milestone.title}?`}</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn gl-button btn-default"
                    onClick={() => setConfirmDelete(false)}>
                    <span className="gl-button-text">Cancel</span></button>
                  <button type="button" className="btn gl-button btn-danger"
                    onClick={() => {
                      // Detach the milestone from anything pointing at it, then drop it.
                      updateIn('issues', i => i.milestone_id === milestone.id, () => ({ milestone_id: null }))
                      updateIn('mergeRequests', m => m.milestone_id === milestone.id, () => ({ milestone_id: null }))
                      removeFrom('milestones', m => m.id === milestone.id)
                      go(`${base}/-/milestones`)
                    }}>
                    <span className="gl-button-text">Delete milestone</span></button>
                </div>
              </div></div>
            </div>
          </>
        ) : null}

        <div className="detail-page-description milestone-detail">
          <h2 className="gl-m-0" data-qa-selector="milestone_title_content">{milestone.title}</h2>
          <div data-qa-selector="milestone_description_content">
            {milestone.description ? (
              <div className="description md gl-px-0 gl-pt-4" data-testid="gfm-content"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(milestone.description) }} />
            ) : null}
          </div>
          {issues.length > 0 && openIssues.length === 0 ? (
            <div className="gl-alert gl-alert-success gl-mt-3">
              <div className="gl-alert-content">
                <div className="gl-alert-body">All issues for this milestone are closed. You may close the milestone now.</div>
              </div>
            </div>
          ) : null}
        </div>

        <div className="scrolling-tabs-container inner-page-scroll-tabs is-smaller gl-mt-5">
          <ul className="scrolling-tabs js-milestone-tabs nav gl-tabs-nav" role="tablist">
            {[['issues', 'Issues', issues.length, '#tab-issues'],
              ['merge-requests', 'Merge requests', mrs.length, '#tab-merge-requests'],
              ['participants', 'Participants', participants.length, '#tab-participants'],
              ['labels', 'Labels', labels.length, '#tab-labels']].map(([key, label, count, href]) => (
              <li className="nav-item" key={key}>
                <a className={`nav-link gl-tab-nav-item${tab === key ? ' active gl-tab-nav-item-active' : ''}`}
                  href={href} role="tab" onClick={e => { e.preventDefault(); setTab(key) }}>{label}
                  <span className="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge">{count}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="tab-content milestone-content">
          {tab === 'issues' ? (
            <div className="tab-pane active" id="tab-issues">
              <div className="row gl-mt-3 gl-display-flex" style={{ gap: 16, flexWrap: 'wrap' }}>
                {issueColumn('Unstarted Issues (open and unassigned)', unstarted, 'issues-list-unassigned')}
                {issueColumn('Ongoing Issues (open and assigned)', ongoing, 'issues-list-ongoing',
                  'gl-border-bottom-0 gl-rounded-base')}
                {issueColumn('Completed Issues (closed)', closedIssues, 'issues-list-closed')}
              </div>
            </div>
          ) : null}

          {tab === 'merge-requests' ? (
            <div className="tab-pane active" id="tab-merge-requests">
              <ul className="content-list milestone-merge-requests-list gl-mt-3">
                {mrs.map(m => (
                  <li className="issuable-row" key={m.id}>
                    <span><a href={`${base}/-/merge_requests/${m.iid}`}>{m.title}</a></span>
                    <div className="issuable-detail"><span className="issuable-number">!{m.iid}</span></div>
                  </li>
                ))}
                {mrs.length === 0 ? <li className="gl-text-gray-500">No merge requests found</li> : null}
              </ul>
            </div>
          ) : null}

          {tab === 'participants' ? (
            <div className="tab-pane active" id="tab-participants">
              <ul className="bordered-list gl-mt-3">
                {participants.map(u => (
                  <li key={u.id}>
                    <a title={u.name} className="gl-display-flex gl-align-items-center" style={{ gap: 8 }}
                      href={`/${u.username}`}>
                      <UserAvatar user={u} size={32} />
                      <div><strong>{u.name}</strong> <small className="cgray">{u.username}</small></div>
                    </a>
                  </li>
                ))}
                {participants.length === 0 ? <li className="gl-text-gray-500">No participants</li> : null}
              </ul>
            </div>
          ) : null}

          {tab === 'labels' ? (
            <div className="tab-pane active" id="tab-labels">
              <ul className="bordered-list manage-labels-list gl-mt-3">
                {labels.map(l => {
                  const withLabel = issues.filter(i => (i.label_ids || []).includes(l.id))
                  const open = withLabel.filter(i => i.state === 'opened').length
                  const done = withLabel.filter(i => i.state === 'closed').length
                  return (
                    <li className="no-border gl-display-flex gl-align-items-center" key={l.id} style={{ gap: 8 }}>
                      <LabelChip label={l}
                        href={issueFilterHref({ 'label_name[]': l.title })} />
                      <span className="prepend-description-left gl-text-gray-500">{l.description}</span>
                      <div className="float-right d-none d-lg-block gl-ml-auto gl-display-flex" style={{ gap: 8 }}>
                        <a className="btn gl-button btn-default-tertiary btn-sm" href={issueFilterHref({ 'label_name[]': l.title, state: 'opened' })}>
                          {open} open issue{open === 1 ? '' : 's'}</a>
                        <a className="btn gl-button btn-default-tertiary btn-sm" href={issueFilterHref({ 'label_name[]': l.title, state: 'closed' })}>
                          {done} closed issue{done === 1 ? '' : 's'}</a>
                      </div>
                    </li>
                  )
                })}
                {labels.length === 0 ? <li className="gl-text-gray-500">No labels with such name or description</li> : null}
              </ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* §16b right sidebar — the ANCHOR blocks. */}
      <aside className="right-sidebar js-right-sidebar right-sidebar-expanded" aria-label="Milestone"
        style={{ position: 'static', width: 290, flexShrink: 0, borderLeft: 0 }}>
        <div className="issuable-sidebar milestone-sidebar">
          <div className="block milestone-progress issuable-sidebar-header">
            <div className="title hide-collapsed" style={{ justifyContent: 'flex-start', gap: 4 }}>
              <strong className="bold">{pct}%</strong>
              <span className="hide-collapsed"> complete </span></div>
            <div className="value hide-collapsed">
              <div className="progress" style={{ height: 8, background: 'var(--gray-100, #ececef)', borderRadius: 4 }}>
                <div className="progress-bar bg-success"
                  style={{ width: `${pct}%`, height: '100%', background: 'var(--green-500, #108548)', borderRadius: 4 }} />
              </div>
            </div>
          </div>

          {/* ANCHOR — `.block.start_date`, milestone detail only. */}
          <div className="block start_date hide-collapsed">
            <div className="title">Start date
              <a className="js-sidebar-dropdown-toggle edit-link float-right"
                href={`${base}/-/milestones/${milestone.iid}/edit`}>Edit</a></div>
            <div className="value">
              <span className="value-content" data-qa-selector="start_date_content">
                {milestone.start_date
                  ? <span className="bold">{formatDate(milestone.start_date)}</span>
                  : <span className="no-value">No start date</span>}
              </span>
            </div>
          </div>

          {/* ANCHOR — `.block.due_date`, milestone detail only. */}
          <div className="block due_date">
            <div className="title hide-collapsed">Due date
              <a className="js-sidebar-dropdown-toggle edit-link float-right"
                href={`${base}/-/milestones/${milestone.iid}/edit`}>Edit</a></div>
            <div className="value hide-collapsed">
              <span className="value-content" data-qa-selector="due_date_content">
                {milestone.due_date
                  ? <span className="bold">{formatDate(milestone.due_date)}</span>
                  : <span className="no-value">No due date</span>}
              </span>
              {milestone.due_date && remaining
                ? <>{' ('}<span className="remaining-days"><strong>{remaining}</strong></span>{')'}</>
                : null}
            </div>
          </div>

          <div className="block issues">
            <div className="title hide-collapsed">Issues
              <span className="gl-badge badge badge-pill badge-muted sm gl-ml-2">{issues.length}</span>
              <a className="float-right" title="New Issue"
                href={`${base}/-/issues/new?issue[milestone_id]=${milestone.id}`}>New issue</a></div>
            <div className="value hide-collapsed bold">
              <span className="milestone-stat">
                <a href={issueFilterHref({ state: 'opened' })}>Open: {openIssues.length}</a></span>{' '}
              <span className="milestone-stat">
                <a href={issueFilterHref({ state: 'closed' })}>Closed: {closedIssues.length}</a></span>
            </div>
          </div>

          <div className="block">
            <div className="js-sidebar-time-tracking-root">
              <div className="title hide-collapsed">Time tracking</div>
              <div className="value hide-collapsed">No estimate or time spent</div>
            </div>
          </div>

          <div className="block merge-requests">
            <div className="title hide-collapsed">Merge requests
              <span className="gl-badge badge badge-pill badge-muted sm gl-ml-2">{mrs.length}</span></div>
            <div className="value hide-collapsed bold">
              <span className="milestone-stat">Open: {mrs.filter(m => m.state === 'opened').length}</span>{' '}
              <span className="milestone-stat">Closed: {mrs.filter(m => m.state === 'closed').length}</span>{' '}
              <span className="milestone-stat">Merged: {mrs.filter(m => m.state === 'merged').length}</span>
            </div>
          </div>

          <div className="block releases">
            <div className="title hide-collapsed">Releases</div>
            <div className="value hide-collapsed"><div className="no-value">None</div></div>
          </div>

          <div className="block reference">
            <div className="title hide-collapsed" style={{ display: 'block', wordBreak: 'break-all' }}>
              Reference: <span title={`${project.full_path}%"${milestone.title}"`}>
                {project.full_path}%&quot;{milestone.title}&quot;</span>
              <button type="button" className="btn gl-button btn-default btn-sm btn-icon"
                title="Copy reference" aria-label="Copy reference"
                data-clipboard-text={`${project.full_path}%"${milestone.title}"`}
                onClick={() => navigator.clipboard && navigator.clipboard.writeText(`${project.full_path}%"${milestone.title}"`)}>⧉</button>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
