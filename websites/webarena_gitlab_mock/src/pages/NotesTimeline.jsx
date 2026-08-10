import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import Icon from '../components/layout/Icon.jsx'
import { LabelChip } from '../components/issuable/Controls.jsx'
import { renderMarkdown } from '../utils/markdown.js'
import { projectRoleFor } from '../utils/dataManager.js'
import Dropdown from '../components/ui/Dropdown.jsx'
import { dbStamp } from '../components/create/mutations.js'
import { labelFilterUrl } from '../utils/issuableUrl.js'
import { resourceEventsFor } from '../data/lazy.js'

// assets/README.md §14.8 / §15c — the shared notes timeline.
//
// CRITICAL ANCHOR (webarena-390…393):
//   document.querySelector('[id="notes-list"').lastElementChild
//           .querySelector('.timeline-discussion-body').outerText
// must be EXACTLY the comment text — no signature, no timestamp, no trailing
// whitespace inside that element. A newly posted comment must be the LAST
// child of #notes-list.
//
// BUG-B08 — label, milestone and state (closed/reopened) events were missing
// from the timeline entirely. They are missing because GitLab does NOT store
// them in `notes`: since 11.x they live in `resource_label_events`,
// `resource_milestone_events` and `resource_state_events` and are merged into
// the notes list at render time by `ResourceEvents::MergeIntoNotesService`.
// `src/data/notes.json` was dumped from `notes` alone, so all three kinds were
// simply absent — e.g. /a11yproject/a11yproject.com/-/issues/566 shows
// "Byte Blaze closed 8 years ago" on the source and showed nothing here.
// `src/data/resource_events.json` is the container's own three tables for the
// seeded issues/MRs (every user/label/milestone id already present in the
// seed); it is historical and never mutated, so it is reference data rather
// than state. It is also strictly per-issuable, so it rides in the project's
// lazy chunk and is read through `resourceEventsFor(project.id)` — the route is
// already behind the chunk gate, so the rows are there on first render.
//
// Every glyph, wrapper and string below is read off the source's markup — see
// assets/html/issue-a11y-{566,719,1478,1517}.html and mr-a11y-{1265,1270,1485}.html.

/** sprite id in `.timeline-icon` per event kind, read off the captures. */
const EVENT_ICON = [
  [/^(assigned|unassigned|requested review|removed review request)/, 'user'],
  [/^changed (title|the description)/, 'pencil'],
  [/^approved|^unapproved/, 'approval'],
  [/source branch/, 'fork'],
  [/time estimate|time spent/, 'timer'],
  [/^mentioned in/, 'comment'],
  [/^closed/, 'issue-close'],
  [/^reopened/, 'issues'],
  [/^marked as a .*merge request|merged/, 'merge'],
  [/label/, 'label'],
  [/milestone/, 'clock'],
]

function systemNoteIcon(body) {
  const hit = EVENT_ICON.find(([re]) => re.test(String(body)))
  return hit ? hit[1] : 'comment'
}

/**
 * GitLab renders a system note's body as GFM with its references resolved. The
 * three forms the seed actually contains are `@username`, `` `branch` `` and
 * the title diff `**Better {-e-}vent UX**`, which the source paints as
 * `<strong>Better <span class="idiff left right deletion">e</span>vent UX</strong>`.
 */
function SystemNoteBody({ body, usersByUsername }) {
  const out = []
  let key = 0
  const pushText = (text) => {
    // `**…**` runs, with {-del-} / {+add+} inside them.
    const parts = String(text).split(/(\*\*[^*]*\*\*|`[^`]*`)/g)
    for (const part of parts) {
      if (!part) continue
      if (/^`[^`]*`$/.test(part)) { out.push(<code key={key++}>{part.slice(1, -1)}</code>); continue }
      if (/^\*\*[^*]*\*\*$/.test(part)) {
        const inner = part.slice(2, -2).split(/(\{-[^}]*-\}|\{\+[^}]*\+\})/g).filter(Boolean)
        out.push(
          <strong key={key++}>
            {inner.map((seg, i) => {
              if (/^\{-.*-\}$/.test(seg)) return <span key={i} className="idiff left right deletion">{seg.slice(2, -2)}</span>
              if (/^\{\+.*\+\}$/.test(seg)) return <span key={i} className="idiff left right addition">{seg.slice(2, -2)}</span>
              return <React.Fragment key={i}>{seg}</React.Fragment>
            })}
          </strong>,
        )
        continue
      }
      out.push(<React.Fragment key={key++}>{part}</React.Fragment>)
    }
  }
  // @mentions first, so the pieces between them still get the treatment above.
  const chunks = String(body).split(/(@[A-Za-z0-9._-]+)/g)
  for (const chunk of chunks) {
    if (/^@[A-Za-z0-9._-]+$/.test(chunk)) {
      const u = usersByUsername && usersByUsername.get(chunk.slice(1))
      out.push(u
        ? <a key={key++} title={u.name} className="gfm gfm-project_member js-user-link"
          data-reference-type="user" data-user={u.id} href={`/${u.username}`}>{chunk}</a>
        : <React.Fragment key={key++}>{chunk}</React.Fragment>)
      continue
    }
    pushText(chunk)
  }
  return <span>{out}</span>
}

function SystemEntry({ id, icon, author, createdAt, children }) {
  return (
    <li className="timeline-entry note system-note note-wrapper" id={id}>
      <div className="timeline-entry-inner">
        <div className="timeline-icon"><Icon name={icon} /></div>
        <div className="timeline-content">
          <div className="note-header">
            <div className="note-header-info">
              {author ? (
                <a href={`/${author.username}`} data-user-id={author.id} data-username={author.username}
                  className="author-name-link js-user-link">
                  <span className="note-header-author-name gl-font-weight-bold">{author.name}</span>
                </a>
              ) : null}
              {' '}
              <span className="note-headline-light note-headline-meta">
                <span data-qa-selector="system_note_content" className="system-note-message">
                  {children}
                </span>
                {' '}
                <a href={`#${id}`} className="note-timestamp system-note-separator">
                  <TimeAgo value={createdAt} />
                </a>
              </span>
            </div>
          </div>
        </div>
      </div>
    </li>
  )
}

function UserNote({ note, author, role }) {
  return (
    <li className="timeline-entry note note-wrapper" id={`note_${note.id}`}>
      <div className="timeline-entry-inner">
        <div className="timeline-icon">
          {author ? <UserAvatar user={author} size={32} /> : null}
        </div>
        <div className="timeline-content">
          <div className="note-header">
            <div className="note-header-info">
              {author ? (
                <a href={`/${author.username}`} data-user-id={author.id} data-username={author.username}
                  className="author-name-link js-user-link">
                  <span className="note-header-author-name gl-font-weight-bold">{author.name}</span>
                </a>
              ) : null}
              {author ? <span className="note-headline-light">@{author.username}</span> : null}
              {/* TEST.md DIFF-906 — the same `.user-access-role` pill the
                  issuable header carries, on each note's author. */}
              {role ? (
                <span
                  className="badge gl-bg-transparent! gl-inset-border-1-gray-100! gl-mr-3 badge-muted badge-pill gl-badge md"
                  title={role.title}>{role.label}</span>
              ) : null}
              <span className="note-headline-light note-headline-meta">
                {' · '}<TimeAgo value={note.created_at} />
              </span>
            </div>
          </div>
          {/* outerText of this element is the ANCHOR — keep it body-only. */}
          <div className="timeline-discussion-body"><div className="note-body"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(note.body) }} /></div>
        </div>
      </div>
    </li>
  )
}

/** `2019-03-10 15:46:40` → sortable; both tables use the same shape. */
function stamp(v) {
  return new Date(String(v).replace(' ', 'T')).getTime()
}

export default function NotesTimeline({ noteableType, noteable, project }) {
  const { state, indexes, currentUser, appendTo, allocateId, updateIn } = useApp()
  const [draft, setDraft] = useState('')
  const [tab, setTab] = useState('write')
  // The Activity `Sort or filter` dropdown. `oldest` and `all` are the source's
  // defaults; a newly posted comment must stay the LAST child of #notes-list,
  // which only holds while the order is oldest-first (see the anchor above).
  const [order, setOrder] = useState('oldest')
  const [filter, setFilter] = useState('all')

  const usersByUsername = new Map(state.users.map(u => [u.username, u]))
  const labelsById = new Map(state.labels.map(l => [l.id, l]))
  const milestonesById = new Map(state.milestones.map(m => [m.id, m]))
  const listPath = project
    ? `/${project.full_path}/-/${noteableType === 'Issue' ? 'issues' : 'merge_requests'}`
    : ''

  const notes = state.notes
    .filter(n => n.noteable_type === noteableType && n.noteable_id === noteable.id)
    .map(n => ({
      key: `note_${n.id}`,
      at: stamp(n.created_at),
      rank: 0,
      system: !!n.system,
      render: () => (n.system
        ? (
          <SystemEntry key={`note_${n.id}`} id={`note_${n.id}`} icon={systemNoteIcon(n.body)}
            author={indexes.usersById.get(n.author_id)} createdAt={n.created_at}>
            <SystemNoteBody body={n.body} usersByUsername={usersByUsername} />
          </SystemEntry>
        )
        : <UserNote key={`note_${n.id}`} note={n} author={indexes.usersById.get(n.author_id)}
          role={projectRoleFor(state, project, indexes.usersById.get(n.author_id))} />),
    }))

  // --- the three resource-event tables, merged in like the source does -------
  const rows = resourceEventsFor(project && project.id)
    .filter(e => e.noteable_type === noteableType && e.noteable_id === noteable.id)

  // GitLab collapses label events made by one user in the same second into one
  // note: "added bug label" / "added content good first issue help wanted
  // labels" (assets/html/issue-a11y-1478.html).
  const labelGroups = new Map()
  const events = []
  for (const e of rows) {
    if (e.kind !== 'label') { events.push(e); continue }
    const gk = `${e.user_id}|${e.created_at}`
    if (!labelGroups.has(gk)) { labelGroups.set(gk, { ...e, kind: 'label', items: [] }); events.push(labelGroups.get(gk)) }
    labelGroups.get(gk).items.push(e)
  }

  function LabelSet({ items, action }) {
    const picked = items.filter(i => i.action === action)
    if (!picked.length) return null
    // The source lists a grouped event's labels by title, not by event id:
    // "added content good first issue help wanted labels"
    // (assets/html/issue-a11y-1478.html).
    const known = picked.map(i => labelsById.get(i.label_id)).filter(Boolean)
      .sort((a, b) => String(a.title).localeCompare(String(b.title)))
    const deleted = picked.length - known.length
    const verb = action === 1 ? 'added' : 'removed'
    const word = picked.length === 1 ? 'label' : 'labels'
    return (
      <>
        {verb}{' '}
        {known.map(l => (
          <React.Fragment key={l.id}>
            <LabelChip label={l} href={labelFilterUrl(listPath, l.title)} />{' '}
          </React.Fragment>
        ))}
        {/* A label that was deleted after the event is counted, not named —
            "removed 2 deleted labels" (assets/html/mr-a11y-1265.html). */}
        {deleted ? `${deleted} deleted ` : ''}
        {word}
      </>
    )
  }

  function eventBody(e) {
    if (e.kind === 'label') {
      const add = e.items.some(i => i.action === 1)
      const rem = e.items.some(i => i.action === 2)
      return (
        <span>
          <LabelSet items={e.items} action={1} />
          {add && rem ? ' and ' : ''}
          <LabelSet items={e.items} action={2} />
        </span>
      )
    }
    if (e.kind === 'milestone') {
      const m = milestonesById.get(e.milestone_id)
      if (e.action !== 1 || !m) return <span>removed milestone</span>
      return (
        <span>changed milestone to{' '}
          <a className="gfm gfm-milestone has-tooltip" data-reference-type="milestone"
            href={`/${project.full_path}/-/milestones/${m.iid}`}>%{m.title}</a>
        </span>
      )
    }
    // resource_state_events.state — 1 opened, 2 closed, 3 merged, 4 locked, 5 reopened
    const word = { 1: 'opened', 2: 'closed', 3: 'merged', 4: 'locked', 5: 'reopened' }[e.action] || 'changed'
    return <span>{word}</span>
  }

  function eventIcon(e) {
    if (e.kind === 'label') return 'label'
    if (e.kind === 'milestone') return 'clock'
    return e.action === 2 ? 'issue-close' : e.action === 3 ? 'merge' : 'issues'
  }

  const eventEntries = events.map(e => {
    const key = `note_${e.kind}_${e.id}`
    return {
      key,
      at: stamp(e.created_at),
      // MergeIntoNotesService appends the synthetic notes after the real ones
      // and in table order, so a same-second tie reads
      // "assigned … / added … label / changed milestone to …" as on the source.
      rank: { label: 1, milestone: 2, state: 3 }[e.kind] || 4,
      system: true,
      render: () => (
        <SystemEntry key={key} id={key} icon={eventIcon(e)}
          author={indexes.usersById.get(e.user_id)} createdAt={e.created_at}>
          {eventBody(e)}
        </SystemEntry>
      ),
    }
  })

  const timeline = [...notes, ...eventEntries]
    .filter(t => (filter === 'comments' ? !t.system : filter === 'history' ? t.system : true))
    .sort((a, b) => (order === 'newest' ? b.at - a.at : a.at - b.at) || (a.rank - b.rank))

  const closeLabel = noteableType === 'Issue' ? 'Close issue' : 'Close merge request'
  const reopenLabel = noteableType === 'Issue' ? 'Reopen issue' : 'Reopen merge request'
  const isClosed = noteable.state === 'closed' || noteable.state === 'merged'

  function postComment(e) {
    e.preventDefault()
    const body = draft.trim()
    if (!body) return
    const id = allocateId('note')
    appendTo('notes', {
      id,
      noteable_type: noteableType,
      noteable_id: noteable.id,
      project_id: project.id,
      author_id: currentUser.id,
      body,
      system: false,
      discussion_id: `mock-${id}`,
      type: null,
      created_at: dbStamp(new Date(), { micros: false }),
      updated_at: dbStamp(new Date(), { micros: false }),
      resolved_at: null,
      resolved_by_id: null,
    })
    const collection = noteableType === 'Issue' ? 'issues' : 'mergeRequests'
    updateIn(collection, r => r.id === noteable.id, r => ({ user_notes_count: (r.user_notes_count || 0) + 1 }))
    setDraft('')
  }

  function toggleState() {
    const collection = noteableType === 'Issue' ? 'issues' : 'mergeRequests'
    const now = dbStamp(new Date(), { micros: false })
    updateIn(collection, r => r.id === noteable.id,
      () => (isClosed
        ? { state: 'opened', closed_at: null }
        : { state: 'closed', closed_at: now, closed_by_id: currentUser.id }))
    // The source records the state change on the timeline; appending a real
    // note (rather than deriving it) keeps the mutation visible to /go.
    appendTo('notes', {
      id: allocateId('note'),
      noteable_type: noteableType,
      noteable_id: noteable.id,
      project_id: project.id,
      author_id: currentUser.id,
      body: isClosed ? 'reopened' : 'closed',
      system: true,
      discussion_id: null,
      type: null,
      created_at: now,
      updated_at: now,
      resolved_at: null,
      resolved_by_id: null,
    })
  }

  return (
    <div id="notes" className="gl-mt-5">
      {/* global.css lays .note-header-info out as a flex row, which makes
          innerText/outerText break "Byte Blaze" onto its own line. On the source
          a system note is ONE line — "Byte Blaze assigned to @ericwbailey 8 years
          ago" — and that text is what an evaluator reads, so system notes render
          inline here. User notes keep the flex row (the source stacks those too). */}
      <style>{`
        #notes-list .system-note .note-header-info { display: block; }
        #notes-list .system-note .note-header-info > * { display: inline; }
        #notes-list .system-note .timeline-icon { flex: 0 0 16px; color: var(--gray-500, #737278); }
        #notes-list .system-note .note-timestamp { color: inherit; text-decoration: none; }
        #notes-list .system-note .gl-label { display: inline-flex; vertical-align: middle; }
        #notes-list .idiff { background: #c7f0d2; }
        #notes-list .idiff.deletion { background: #fac5cd; }
      `}</style>
      <div className="gl-display-flex gl-align-items-center gl-justify-content-space-between gl-pt-5">
        <h2 className="gl-font-size-h1 gl-m-0">Activity</h2>
        <Dropdown className="dropdown" id="discussion-preferences" data-testid="discussion-preferences"
          toggle={<span className="gl-dropdown-button-text">Sort or filter</span>}
          menuClassName="dropdown-menu dropdown-menu-right">
          <ul id="discussion-sort">
            <li className={`gl-dropdown-item js-newest-first${order === 'newest' ? ' is-active' : ''}`}>
              <button type="button" onClick={() => setOrder('newest')}>Newest first</button></li>
            <li className={`gl-dropdown-item js-oldest-first${order === 'oldest' ? ' is-active' : ''}`}>
              <button type="button" onClick={() => setOrder('oldest')}>Oldest first</button></li>
            <li className="divider" />
            <li className={`gl-dropdown-item${filter === 'all' ? ' is-active' : ''}`}>
              <button type="button" data-filter-type="all" data-qa-selector="filter_menu_item"
                onClick={() => setFilter('all')}>Show all activity</button></li>
            <li className={`gl-dropdown-item${filter === 'comments' ? ' is-active' : ''}`}>
              <button type="button" data-filter-type="comments" data-qa-selector="filter_menu_item"
                onClick={() => setFilter('comments')}>Show comments only</button></li>
            <li className={`gl-dropdown-item${filter === 'history' ? ' is-active' : ''}`}>
              <button type="button" data-filter-type="history" data-qa-selector="filter_menu_item"
                onClick={() => setFilter('history')}>Show history only</button></li>
          </ul>
        </Dropdown>
      </div>

      <ul className="notes main-notes-list timeline" id="notes-list">
        {timeline.map(t => t.render())}
      </ul>

      {/* §14.9 comment form — TODO.md P1-I (8 tasks post a comment here). */}
      <div className="notes-form js-main-target-form">
        <div className="timeline-entry-inner gl-display-flex" style={{ gap: 12 }}>
          <div className="timeline-icon"><UserAvatar user={currentUser} size={32} /></div>
          <form className="common-note-form gfm-form js-main-target-form" style={{ flex: 1 }} onSubmit={postComment}>
            <div className="md-area" style={{ border: '1px solid var(--border-input)', borderRadius: 4 }}>
              <div className="md-header" style={{ display: 'flex', gap: 4, padding: 4, borderBottom: '1px solid var(--border-light)' }}>
                <button type="button" className={`btn gl-button btn-default btn-sm${tab === 'write' ? ' active' : ''}`}
                  onClick={() => setTab('write')}>Write</button>
                <button type="button" className={`btn gl-button btn-default btn-sm${tab === 'preview' ? ' active' : ''}`}
                  onClick={() => setTab('preview')}>Preview</button>
              </div>
              {tab === 'write' ? (
                <div className="md-write-holder">
                  <textarea className="note-textarea js-gfm-input js-note-text" name="note[note]"
                    data-qa-selector="comment_field" rows={6}
                    placeholder="Write a comment or drag your files here…"
                    value={draft} onChange={e => setDraft(e.target.value)}
                    style={{ border: 0, borderRadius: 0 }} />
                </div>
              ) : (
                <div className="md-preview-holder md" style={{ padding: 12, minHeight: 100 }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(draft) }} />
              )}
            </div>
            <div className="note-form-actions gl-mt-3 gl-display-flex" style={{ gap: 8 }}>
              <button type="submit" className="btn gl-button btn-confirm js-comment-submit-button"
                data-qa-selector="comment_button" disabled={!draft.trim()}>Comment</button>
              <button type="button" className="btn gl-button btn-default btn-comment-and-close"
                onClick={toggleState}>{isClosed ? reopenLabel : closeLabel}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
