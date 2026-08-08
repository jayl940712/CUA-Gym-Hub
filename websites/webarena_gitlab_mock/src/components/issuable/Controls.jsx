import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import Icon from '../layout/Icon.jsx'
import { UserAvatar } from '../layout/Avatar.jsx'
import { renderMarkdown } from '../../utils/markdown.js'
import { useProject } from '../../pages/hooks.js'

// Shared form controls for the issuable surface (issues, merge requests,
// milestones, labels). Every string here is taken verbatim from
// assets/README.md §20 (new issue), §15b (new MR), §16b (new milestone) and
// §14b / §15d (the sidebar edit-in-place dropdowns).
//
// These widgets are what the anchored creation tasks drive:
//   webarena-658/659/660/808  assignee + due date on an issue
//   webarena-666/667/668/806  reviewer on a merge request
//   webarena-590..594         start/due date on a milestone
// so each of them must write through to the caller's state, not just look
// right.

/**
 * `navigate()` that carries the current query string forward, so a form submit
 * never drops `?sid=` (WEBARENA_MIGRATION.md §5 / dev.md "Common Bugs").
 */
export function useNavigateWithQuery() {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback((to, opts) => {
    const [path, ownQuery] = String(to).split('?')
    const params = new URLSearchParams(ownQuery || '')
    const sid = new URLSearchParams(location.search).get('sid')
    if (sid && !params.has('sid')) params.set('sid', sid)
    const q = params.toString()
    navigate(q ? `${path}?${q}` : path, opts)
  }, [navigate, location.search])
}

/**
 * Who the Assignee / Reviewer dropdowns may offer.
 *
 * Members of the project and the current user come first (that is the visible
 * order in the source), but the whole user directory stays reachable through
 * the search box: the anchored creation tasks assign `Roshan Jossy`,
 * `Abishek S` and `Primer`, and none of them is a member row on the project
 * the task targets. Restricting the list to `members.json` would make those
 * four tasks unsatisfiable.
 */
export function assignableUsers(state, indexes, project, currentUser) {
  const first = []
  const seen = new Set()
  const push = (id) => {
    if (id == null || seen.has(id)) return
    const u = indexes.usersById.get(id)
    if (!u) return
    seen.add(id)
    first.push(u)
  }
  push(currentUser && currentUser.id)
  for (const m of state.members) {
    if (String(m.source_type).toLowerCase() === 'project' && m.source_id === (project && project.id)) push(m.user_id)
  }
  const rest = state.users.filter(u => !seen.has(u.id))
  return [...first, ...rest]
}

/** Close a popup when the user clicks anywhere outside it. */
export function useOutsideClose(ref, close, open) {
  useEffect(() => {
    if (!open) return undefined
    function onDown(e) {
      if (ref.current && !ref.current.contains(e.target)) close()
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [ref, close, open])
}

// ---------------------------------------------------------------------------
// Label pills
// ---------------------------------------------------------------------------

/**
 * GitLab picks the pill's text colour from the background's luminance and
 * tags the pill `.gl-label-text-dark` / `.gl-label-text-light`
 * (assets/README.md §13.6). Scoped labels (`a::b`) render two-tone.
 */
export function labelIsLight(color) {
  const hex = String(color || '#000000').replace('#', '')
  if (hex.length < 6) return false
  const r = parseInt(hex.slice(0, 2), 16)
  const g = parseInt(hex.slice(2, 4), 16)
  const b = parseInt(hex.slice(4, 6), 16)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) > 165
}

export function LabelChip({ label, href, onRemove, className = '' }) {
  if (!label) return null
  const light = labelIsLight(label.color)
  const scoped = String(label.title).includes('::')
  const cls = [
    'gl-label', 'gl-label-sm',
    light ? 'gl-label-text-dark' : 'gl-label-text-light',
    scoped ? 'gl-label-scoped' : '',
    className,
  ].filter(Boolean).join(' ')
  const style = {
    '--label-background-color': label.color,
    '--label-inset-border': `inset 0 0 0 2px ${label.color}`,
    backgroundColor: label.color,
    borderRadius: 12,
    padding: '0 8px',
    color: light ? '#333238' : '#ffffff',
  }
  const body = <span className="gl-label-text">{label.title}</span>
  return (
    <span className={cls} style={style} data-qa-selector="selected_label_content" data-qa-label-name={label.title}>
      {href
        ? <a tabIndex={0} className="gl-link gl-label-link" href={href} style={{ color: 'inherit' }}>{body}</a>
        : body}
      {onRemove ? (
        <button type="button" aria-label="Remove label"
          className="btn gl-label-close gl-p-0! btn-reset btn-sm gl-button btn-reset-tertiary btn-icon"
          style={{ background: 'transparent', color: 'inherit', marginLeft: 4, height: 16, width: 12, padding: 0 }}
          onClick={onRemove}>×</button>
      ) : null}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Dropdown shell — the legacy `.dropdown-menu-toggle` flavour the issuable
// forms use (assets/README.md §0.8, §20).
// ---------------------------------------------------------------------------

export function SelectDropdown({
  toggleText, isDefault = false, title, searchPlaceholder, options, onPick,
  footer = null, toggleClass = '', toggleAttrs = {}, menuClass = '', qaSelector,
  block = false, defaultOpen = false,
}) {
  // TEST.md DIFF-1106 — GitLab's legacy issuable sidebar opens this dropdown as
  // part of revealing it: clicking `Edit` in `.block.assignee` / `.block.labels`
  // shows the `.selectbox` with its menu ALREADY open. The mock rendered it
  // closed, so the flow needed a second click on `.dropdown-menu-toggle`.
  // `defaultOpen` is set only by the sidebar callers; the issuable FORMS
  // (new/edit issue, new MR) still render their dropdowns closed, which is
  // what the source does there.
  const [open, setOpen] = useState(defaultOpen)
  const [query, setQuery] = useState('')
  const ref = useRef(null)
  useOutsideClose(ref, () => setOpen(false), open)

  // The user list is 1 133 rows; render a window of it and let the search box
  // reach the rest, exactly as the source's AJAX dropdown does.
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matched = q
      ? options.filter(o => String(o.search || o.label).toLowerCase().includes(q))
      : options
    return matched.slice(0, 50)
  }, [options, query])

  return (
    <div className={`dropdown${open ? ' show' : ''}`} ref={ref} style={block ? { width: '100%' } : undefined}>
      <button type="button" data-toggle="dropdown" data-qa-selector={qaSelector}
        className={`dropdown-menu-toggle btn gl-button btn-default ${toggleClass}`.trim()}
        style={{ justifyContent: 'space-between', width: block ? '100%' : undefined, minWidth: 160 }}
        onClick={() => setOpen(o => !o)} {...toggleAttrs}>
        <span className={`dropdown-toggle-text${isDefault ? ' is-default' : ''}`}>{toggleText}</span>
        <Icon name="chevron-down" />
      </button>
      <div className={`dropdown-menu dropdown-select ${menuClass}`.trim()}
        style={{ minWidth: 260, maxHeight: 340, overflowY: 'auto' }}>
        {title ? (
          <div className="dropdown-title gl-display-flex">
            <span className="gl-ml-auto">{title}</span>
            <button type="button" aria-label="Close" className="dropdown-title-button dropdown-menu-close gl-ml-auto"
              onClick={() => setOpen(false)}>×</button>
          </div>
        ) : null}
        {searchPlaceholder ? (
          <div className="dropdown-input">
            <input type="search" className="dropdown-input-field form-control" autoComplete="off"
              data-qa-selector="dropdown_input_field" placeholder={searchPlaceholder}
              value={query} onChange={e => setQuery(e.target.value)} />
          </div>
        ) : null}
        <div className="dropdown-content" data-qa-selector="dropdown_list_content">
          <ul>
            {shown.length === 0 ? <li className="dropdown-item gl-text-gray-500">No matching results</li> : null}
            {shown.map(o => (
              <li key={o.value === null ? '__none__' : String(o.value)}
                className={`gl-dropdown-item${o.active ? ' is-active' : ''}`}>
                <button type="button" className="dropdown-item"
                  onClick={() => { onPick(o.value); if (!o.keepOpen) setOpen(false); setQuery('') }}>
                  {o.render || o.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {footer ? <div className="dropdown-footer">{footer}</div> : null}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// User select (assignee / reviewer)
// ---------------------------------------------------------------------------

/**
 * @param kind 'assignee' | 'reviewer' — drives the verbatim dropdown copy
 *   (§20 assignee: title `Select assignee`; §15d reviewer: `Request review from`).
 */
export function UserSelect({ users, value, onChange, kind = 'assignee', block = false, currentUser, defaultOpen = false }) {
  // AUDIT P2-10 — the dropdown-footer `Invite Members` link had no handler.
  // GitLab opens its invite-members modal here; the mock sends the agent to the
  // project's members page, which is where that modal's form actually lives.
  const { project, base } = useProject()
  const selected = value ? users.find(u => u.id === value) : null
  const title = kind === 'reviewer' ? 'Request review from' : 'Select assignee'
  const toggle = selected ? selected.name : (kind === 'reviewer' ? 'Unassigned' : 'Unassigned')

  const options = [
    { value: null, label: 'Unassigned', search: 'unassigned', active: !selected },
    ...users.map(u => ({
      value: u.id,
      search: `${u.name} ${u.username}`,
      active: selected && selected.id === u.id,
      label: u.name,
      render: (
        <span className="gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
          <UserAvatar user={u} size={24} />
          <span>{u.name}</span>
          <span className="gl-text-gray-500 gl-font-sm">@{u.username}</span>
        </span>
      ),
    })),
  ]

  return (
    <div className="gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
      <SelectDropdown
        defaultOpen={defaultOpen}
        block={block}
        toggleText={toggle}
        isDefault={!selected}
        title={title}
        searchPlaceholder="Search users"
        options={options}
        onPick={onChange}
        menuClass="dropdown-menu-user dropdown-menu-selectable dropdown-menu-author dropdown-extended-height"
        toggleClass={kind === 'reviewer' ? 'js-reviewer-search js-multiselect js-save-user-data' : 'js-user-search js-assignee-search js-multiselect js-save-user-data'}
        toggleAttrs={{
          'data-default-label': 'Unassigned',
          'data-dropdown-header': kind === 'reviewer' ? 'Reviewer' : 'Assignee',
          'data-dropdown-title': title,
          'data-max-select': '1',
          'data-field-name': kind === 'reviewer' ? 'merge_request[reviewer_ids][]' : 'issue[assignee_ids][]',
        }}
        footer={<ul className="dropdown-footer-list"><li>
          <a className="gl-link" data-qa-selector="invite_members_button"
            href={project ? `${base}/-/project_members` : '/dashboard/groups'}>Invite Members</a>
        </li></ul>}
      />
      {kind === 'assignee' && currentUser ? (
        <a className="assign-to-me-link gl-white-space-nowrap gl-pl-4" data-qa-selector="assign_to_me_link" href="#"
          onClick={e => { e.preventDefault(); onChange(currentUser.id) }}>Assign to me</a>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Milestone select
// ---------------------------------------------------------------------------

export function MilestoneSelect({ milestones, value, onChange, block = false, defaultOpen = false }) {
  const selected = value ? milestones.find(m => m.id === value) : null
  const options = [
    { value: null, label: 'No milestone', search: 'no milestone', active: !selected },
    ...milestones.map(m => ({
      value: m.id, label: m.title, search: m.title, active: selected && selected.id === m.id,
    })),
  ]
  return (
    <SelectDropdown
        defaultOpen={defaultOpen}
      block={block}
      qaSelector="issuable_milestone_dropdown"
      toggleText={selected ? selected.title : 'Select milestone'}
      isDefault={!selected}
      title="Assign milestone"
      searchPlaceholder="Search milestones"
      options={options}
      onPick={onChange}
      menuClass="dropdown-menu-selectable"
    />
  )
}

// ---------------------------------------------------------------------------
// Label multi-select
// ---------------------------------------------------------------------------

export function LabelSelect({ labels, value, onChange, manageHref, block = false, defaultOpen = false }) {
  const set = new Set(value || [])
  const options = [
    { value: null, label: 'No label', search: 'no label', active: set.size === 0, keepOpen: false },
    ...labels.map(l => ({
      value: l.id,
      search: l.title,
      active: set.has(l.id),
      keepOpen: true,
      label: l.title,
      render: (
        <span className="gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
          <span style={{ width: 12, height: 12, borderRadius: 2, background: l.color, display: 'inline-block' }} />
          <span>{l.title}</span>
        </span>
      ),
    })),
  ]
  const chosen = (value || []).map(id => labels.find(l => l.id === id)).filter(Boolean)
  return (
    <div>
      <SelectDropdown
        defaultOpen={defaultOpen}
        block={block}
        qaSelector="issuable_label_dropdown"
        toggleText={chosen.length ? chosen.map(l => l.title).join(', ') : 'Labels'}
        isDefault={!chosen.length}
        title="Select label"
        searchPlaceholder="Search"
        options={options}
        onPick={id => {
          if (id === null) { onChange([]); return }
          const next = new Set(value || [])
          if (next.has(id)) next.delete(id); else next.add(id)
          onChange([...next])
        }}
        menuClass="dropdown-menu-paging dropdown-menu-labels dropdown-menu-selectable dropdown-extended-height"
        footer={<ul className="dropdown-footer-list">
          <li><a className="dropdown-toggle-page" href={manageHref}>Create project label</a></li>
          <li><a href={manageHref}>Manage project labels</a></li>
        </ul>}
      />
      {chosen.length ? (
        <div className="gl-mt-2 gl-display-flex" style={{ gap: 4, flexWrap: 'wrap' }}>
          {chosen.map(l => (
            <LabelChip key={l.id} label={l}
              onRemove={() => onChange((value || []).filter(id => id !== l.id))} />
          ))}
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Date field
// ---------------------------------------------------------------------------

/**
 * GitLab's datepicker is a Pikaday bound to a text input. The mock uses a
 * native date input so an agent can type `2030-12-31` or pick from the OS
 * calendar; the emitted value is the same `YYYY-MM-DD` the seed stores.
 */
export function DateField({ id, name, value, onChange, placeholder, qaSelector, onClear, clearLabel }) {
  return (
    <div className="gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
      <input id={id} name={name} type="date"
        className="datepicker form-control gl-form-input"
        data-qa-selector={qaSelector} placeholder={placeholder}
        aria-label={placeholder} title={placeholder}
        value={value || ''} onChange={e => onChange(e.target.value || null)}
        style={{ maxWidth: 250 }} />
      {onClear ? (
        <a className="inline float-right gl-mt-2" href="#"
          onClick={e => { e.preventDefault(); onClear() }}>{clearLabel}</a>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Markdown editor (assets/README.md §20 "Description editor")
// ---------------------------------------------------------------------------

// Order, titles and sprite names are the source's, read off
// `[data-testid="md-header-toolbar"]` in assets/html/issue-a11y-566.html.
const TOOLBAR = [
  ['bold', 'Add bold text (Ctrl+B)', '**', '**'],
  ['italic', 'Add italic text (Ctrl+I)', '_', '_'],
  ['strikethrough', 'Add strikethrough text (Ctrl+⇧X)', '~~', '~~'],
  ['quote', 'Insert a quote', '> ', ''],
  ['code', 'Insert code', '`', '`'],
  ['link', 'Add a link (Ctrl+K)', '[', '](url)'],
  ['list-bulleted', 'Add a bullet list', '- ', ''],
  ['list-numbered', 'Add a numbered list', '1. ', ''],
  ['list-task', 'Add a checklist', '- [ ] ', ''],
  ['list-indent', 'Indent line (Ctrl+])', null, 'indent'],
  ['list-outdent', 'Outdent line (Ctrl+[)', null, 'outdent'],
  ['details-block', 'Add a collapsible section', '<details><summary>Click to expand</summary>\n', '\n</details>'],
  ['table', 'Add a table', '| header | header |\n| ------ | ------ |\n| | |\n| | |', ''],
]

// BUG-B11: these were literal glyphs (`B I S ❝ </> 🔗 • 1. ☑ ▾ ▦ 📎 ⤢`) rendered
// into innerText, where the source emits icon-only sprite SVGs. Every button
// below is now an <Icon>, and every name is the sprite id the source's own
// button carries in `data-testid="<name>-icon"` (assets/html/issue-a11y-566.html
// `[data-testid="md-header-toolbar"]`), so the toolbar contributes no text to a
// page's outerText — which is what an evaluator reads.

export function MarkdownEditor({
  id, name, value, onChange, placeholder, qaSelector, rows = 10,
  toolbarText = null,
}) {
  const [tab, setTab] = useState('write')
  const [zen, setZen] = useState(false)
  const areaRef = useRef(null)
  const fileRef = useRef(null)
  const location = useLocation()

  function surround(before, after) {
    const el = areaRef.current
    if (!el) { onChange(`${value || ''}${before}${after}`); return }
    const start = el.selectionStart
    const end = el.selectionEnd
    const text = value || ''
    const next = `${text.slice(0, start)}${before}${text.slice(start, end)}${after}${text.slice(end)}`
    onChange(next)
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + before.length, end + before.length)
    })
  }

  /** The two list buttons shift the selected lines by two spaces, as GitLab's do. */
  function shiftLines(dir) {
    const el = areaRef.current
    const text = value || ''
    const start = el ? el.selectionStart : text.length
    const end = el ? el.selectionEnd : text.length
    const from = text.lastIndexOf('\n', start - 1) + 1
    const toRaw = text.indexOf('\n', end)
    const to = toRaw === -1 ? text.length : toRaw
    const shifted = text.slice(from, to).split('\n')
      .map(l => (dir === 'indent' ? `  ${l}` : l.replace(/^ {1,2}/, '')))
      .join('\n')
    onChange(`${text.slice(0, from)}${shifted}${text.slice(to)}`)
    requestAnimationFrame(() => el && el.focus())
  }

  /**
   * "Attach a file or image" posts to the mock's own `/upload?sid=` (the only
   * network surface the contract allows) and appends the GFM the source would:
   * `![name](url)` for an image, `[name](url)` otherwise.
   */
  async function attach(files) {
    if (!files || !files.length) return
    const sid = new URLSearchParams(location.search).get('sid') || ''
    const body = new FormData()
    for (const f of files) body.append('file', f)
    let payload = null
    try {
      const res = await fetch(`/upload${sid ? `?sid=${encodeURIComponent(sid)}` : ''}`, { method: 'POST', body })
      payload = await res.json()
    } catch (e) { payload = null }
    const added = ((payload && payload.files) || []).map(f => (/^image\//.test(f.content_type || '')
      ? `![${f.original_name}](${f.url})` : `[${f.original_name}](${f.url})`)).join('\n')
    if (!added) return
    const text = value || ''
    onChange(text ? `${text}\n${added}` : added)
    setTab('write')
  }

  return (
    <div className={`md-area position-relative${zen ? ' is-fullscreen' : ''}`}
      style={zen
        ? { position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--white, #fff)', border: 0, borderRadius: 0, overflow: 'auto' }
        : { border: '1px solid var(--border-input, #dcdcde)', borderRadius: 4 }}>
      <div className="md-header">
        <ul className="clearfix nav-links nav gl-tabs-nav" style={{ alignItems: 'center', paddingLeft: 4 }}>
          <li className={`md-header-tab${tab === 'write' ? ' active' : ''}`}>
            <button type="button" className="js-md-write-button nav-link gl-tab-nav-item"
              onClick={() => setTab('write')}>Write</button>
          </li>
          <li className={`md-header-tab${tab === 'preview' ? ' active' : ''}`}>
            <button type="button" className="js-md-preview-button nav-link gl-tab-nav-item"
              onClick={() => setTab('preview')}>Preview</button>
          </li>
          <li className="md-header-toolbar active gl-py-2" style={{ marginLeft: 'auto' }}>
            <div className="md-header-toolbar active gl-display-flex" style={{ gap: 2 }}>
              {TOOLBAR.map(([key, label, before, after]) => (
                <button key={key} type="button" title={label} aria-label={label}
                  data-md-tag={before === null ? undefined : before} data-container="body"
                  className="btn js-md btn-default btn-md gl-button btn-default-tertiary btn-icon has-tooltip"
                  onClick={() => (before === null ? shiftLines(after) : surround(before, after))}>
                  <Icon name={key} className="gl-button-icon" />
                </button>
              ))}
              <button type="button" title="Attach a file or image" aria-label="Attach a file or image"
                data-testid="button-attach-file" data-container="body"
                className="btn js-md btn-default btn-md gl-button btn-default-tertiary btn-icon js-attach-file-button"
                onClick={() => fileRef.current && fileRef.current.click()}>
                <Icon name="paperclip" className="gl-button-icon" />
              </button>
              <input ref={fileRef} type="file" multiple className="js-file-input"
                style={{ display: 'none' }} onChange={e => { attach(e.target.files); e.target.value = '' }} />
              <button type="button" title="Go full screen" aria-label="Go full screen" data-container="body"
                className="btn js-md btn-default btn-md gl-button btn-default-tertiary btn-icon js-zen-enter"
                onClick={() => setZen(z => !z)}>
                <Icon name="maximize" className="gl-button-icon" />
              </button>
            </div>
          </li>
        </ul>
      </div>

      {tab === 'write' ? (
        <div className="md-write-holder">
          <textarea ref={areaRef} id={id} name={name} rows={rows}
            className="note-textarea js-gfm-input js-autosize markdown-area form-control"
            data-qa-selector={qaSelector} placeholder={placeholder}
            value={value || ''} onChange={e => onChange(e.target.value)}
            style={{ border: 0, borderRadius: 0, width: '100%', resize: 'vertical' }} />
        </div>
      ) : (
        <div className="md md-preview-holder js-md-preview" style={{ padding: 12, minHeight: 120 }}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }} />
      )}

      <div className="comment-toolbar clearfix" style={{ padding: '4px 8px', borderTop: '1px solid var(--border-light, #ececef)' }}>
        <div className="toolbar-text gl-font-sm gl-text-gray-500">
          {toolbarText || (
            <>Supports <a href="/help/user/markdown">Markdown</a>. For{' '}
              <a href="/help/user/project/quick_actions">quick actions</a>, type <kbd>/</kbd>.</>
          )}
        </div>
      </div>
    </div>
  )
}

export default MarkdownEditor
