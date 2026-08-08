import React, { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import Icon from '../components/layout/Icon.jsx'
import { useQuery } from './hooks.js'
import { useNavigateWithQuery } from '../components/issuable/Controls.jsx'
import Dropdown from '../components/ui/Dropdown.jsx'
import QueryForm from '../components/ui/QueryForm.jsx'

// ROUTES #7–#10 — `/dashboard/todos` and its three mutating sub-routes.
// assets/README.md §4b. Anchor route for webarena-44 ("Open my todos page").
//
// GitLab's action ids (`todos.action`); only 1 and 6 occur in this seed.
const ACTION_SENTENCE = {
  1: 'assigned you.',
  2: 'mentioned you on.',
  3: 'The pipeline failed.',
  4: 'added a to do.',
  5: 'set you as an approver.',
  6: 'Could not merge.',
  7: 'directly addressed you on.',
  9: 'requested a review of.',
  10: 'has requested access.',
}
/** Actions GitLab renders with no author line — a system to-do. */
const SYSTEM_ACTIONS = new Set([3, 6, 8])

const SORTS = [
  ['label_priority', 'Label priority'],
  ['created_desc', 'Last created'],
  ['created_asc', 'Oldest created'],
  ['updated_desc', 'Updated date'],
]

const TYPES = [
  ['', 'Any Type'], ['Issue', 'Issue'], ['MergeRequest', 'Merge request'],
  ['DesignManagement::Design', 'Design'], ['AlertManagement::Alert', 'Alert'],
]

const ACTIONS = [
  ['', 'Any Action'], ['1', 'Assigned'], ['9', 'Review requested'], ['2', 'Mentioned'],
  ['4', 'Added'], ['3', 'Pipelines'], ['10', 'Member access requested'],
]

function ts(v) { return v ? new Date(String(v).replace(' ', 'T')).getTime() : 0 }

function TodoRow({ todo, target, project, author, currentUserId }) {
  const isMr = todo.target_type === 'MergeRequest'
  const ref = `${isMr ? '!' : '#'}${target.iid}`
  const href = `/${project.full_path}/-/${isMr ? 'merge_requests' : 'issues'}/${target.iid}`
  const done = todo.state === 'done'
  const system = SYSTEM_ACTIONS.has(todo.action)
  const self = author && author.id === currentUserId
  const sentence = ACTION_SENTENCE[todo.action] || 'added a to do.'
  const namespaceName = project.namespace ? project.namespace.name : project.full_path.split('/')[0]

  return (
    <li className={`todo gl-relative todo-${done ? 'done' : 'pending'}`} id={`todo_${todo.id}`}>
      <div className="gl-display-flex gl-sm-align-items-center" style={{ gap: 8 }}>
        <div className="todo-item gl-w-full" data-qa-selector="todo_item_container">
          <div className="todo-title gl-font-sm gl-text-gray-500">
            <span className="todo-target-title" data-qa-selector="todo_target_title_content"
              id={`todo_${todo.id}_describer`}>{target.title} ·</span>{' '}
            <span><span className="namespace-name">{namespaceName} / </span>
              <span className="project-name">{project.path || project.name}</span></span>{' '}
            <span className="todo-label">
              <a className="todo-target-link gl-text-gray-500!" aria-describedby={`todo_${todo.id}_describer`}
                aria-label={`${isMr ? 'Merge Request' : 'Issue'} ${ref}`} href={href}>{ref}</a>
            </span>
          </div>
          <div className="todo-body gl-mb-2 gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
            {author ? (
              <div className="todo-avatar">
                <a href={`/${author.username}`}><UserAvatar user={author} size={24} /></a>
              </div>
            ) : null}
            <div className="todo-note">
              {system ? (
                <span className="action-name" data-qa-selector="todo_action_name_content">{sentence}</span>
              ) : self ? (
                <>
                  <div className="author-name bold gl-display-inline">
                    <a title="You" href={`/${author.username}`}>You</a></div>{' '}
                  <span className="action-name">assigned</span>{' '}
                  <span className="action-name" data-qa-selector="todo_action_name_content">to yourself.</span>
                </>
              ) : (
                <>
                  <div className="author-name bold gl-display-inline">
                    <a title={author ? author.name : ''} href={author ? `/${author.username}` : '#'}>
                      {author ? author.name : ''}</a></div>{' '}
                  <span className="action-name" data-qa-selector="todo_action_name_content">{sentence}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="todo-timestamp gl-white-space-nowrap gl-ml-auto">
          <span className="todo-timestamp gl-font-sm gl-text-gray-500">
            <TimeAgo value={todo.created_at} placement="top" /></span>
        </div>

        <div className="todo-actions gl-ml-3">
          {done ? (
            <a className="gl-button btn btn-md btn-default btn-icon gl-display-flex js-add-todo has-tooltip"
              href={`/dashboard/todos/${todo.id}/restore`} title="Add a to do" aria-label="Add a to do">
              <Icon name="history" /></a>
          ) : (
            <a className="gl-button btn btn-md btn-default btn-icon gl-display-flex js-done-todo has-tooltip"
              href={`/dashboard/todos/${todo.id}`} title="Mark as done" aria-label="Mark as done">
              <Icon name="check-circle" /></a>
          )}
        </div>
      </div>
    </li>
  )
}

/**
 * `/dashboard/todos/:id`, `/dashboard/todos/:id/restore` and
 * `/dashboard/todos/destroy_all` are mutating routes in the source. In the mock
 * they apply the mutation and bounce back to the list, so a deep link still
 * works and the change reaches `/go`'s state_diff.
 */
export function TodoAction({ action }) {
  const { id } = useParams()
  const { updateIn, setState } = useApp()
  const navigate = useNavigateWithQuery()

  useEffect(() => {
    if (action === 'destroy_all') {
      setState(prev => ({
        ...prev,
        todos: prev.todos.map(t => (t.state === 'pending' ? { ...t, state: 'done' } : t)),
      }))
    } else if (action === 'bulk_restore') {
      setState(prev => ({
        ...prev,
        todos: prev.todos.map(t => (t.state === 'done' ? { ...t, state: 'pending' } : t)),
      }))
    } else {
      updateIn('todos', t => String(t.id) === String(id),
        () => ({ state: action === 'restore' ? 'pending' : 'done' }))
    }
    navigate('/dashboard/todos', { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, id])

  return null
}

export default function DashboardTodos() {
  const { state, indexes, currentUser } = useApp()
  const q = useQuery()
  usePageChrome({ title: 'To-Do List · Dashboard · GitLab' })

  const tab = q.get('state', 'pending')
  const sort = q.get('sort', 'created_desc')

  const mine = state.todos.filter(t => t.user_id === currentUser.id)
  const counts = {
    pending: mine.filter(t => t.state === 'pending').length,
    done: mine.filter(t => t.state === 'done').length,
  }

  let rows = mine.filter(t => t.state === tab)
  const projectId = q.get('project_id')
  if (projectId) rows = rows.filter(t => String(t.project_id) === String(projectId))
  const authorId = q.get('author_id')
  if (authorId) rows = rows.filter(t => String(t.author_id) === String(authorId))
  const type = q.get('type')
  if (type) rows = rows.filter(t => t.target_type === type)
  const actionId = q.get('action_id')
  if (actionId) rows = rows.filter(t => String(t.action) === String(actionId))

  rows = [...rows].sort((a, b) => (sort === 'created_asc'
    ? ts(a.created_at) - ts(b.created_at)
    : ts(b.created_at) - ts(a.created_at)))

  const resolved = rows.map(t => {
    const project = indexes.projectsById.get(t.project_id)
    const target = t.target_type === 'MergeRequest'
      ? state.mergeRequests.find(m => m.id === t.target_id)
      : state.issues.find(i => i.id === t.target_id)
    return { todo: t, project, target, author: indexes.usersById.get(t.author_id) }
  }).filter(r => r.project && r.target)

  const projectOptions = [...new Set(mine.map(t => t.project_id))]
    .map(id => indexes.projectsById.get(id)).filter(Boolean)
  const authorOptions = [...new Set(mine.map(t => t.author_id))]
    .map(id => indexes.usersById.get(id)).filter(Boolean)

  const filterHref = (key, value) => {
    const p = new URLSearchParams(q.searchParams)
    if (value) p.set(key, value); else p.delete(key)
    return `/dashboard/todos?${p.toString()}`
  }

  return (
    <div>
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">To-Do List</h1>
      </div>

      <div className="top-area">
        <ul className="gl-flex-grow-1 gl-border-0 nav gl-tabs-nav">
          <li className="nav-item">
            <a className={`js-todos-pending nav-link gl-tab-nav-item${tab === 'pending' ? ' active gl-tab-nav-item-active' : ''}`}
              href="/dashboard/todos?state=pending">To Do
              <span className="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge js-todos-badge">{counts.pending}</span></a>
          </li>
          <li className="nav-item">
            <a className={`js-todos-done nav-link gl-tab-nav-item${tab === 'done' ? ' active gl-tab-nav-item-active' : ''}`}
              href="/dashboard/todos?state=done">Done
              <span className="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge js-todos-badge">{counts.done}</span></a>
          </li>
        </ul>
        <div className="nav-controls">
          {tab === 'pending' ? (
            <div className="gl-mr-3">
              <a className="gl-button btn btn-default align-items-center js-todos-mark-all"
                href="/dashboard/todos/destroy_all">Mark all as done</a>
            </div>
          ) : null}
        </div>
      </div>

      <div className="todos-filters">
        <div className="issues-details-filters row-content-block second-block"
          style={{ background: 'var(--gray-10, #fbfafd)', padding: 8 }}>
          <QueryForm className="filter-form gl-display-flex" action="/dashboard/todos"
            style={{ gap: 8, flexWrap: 'wrap' }}>
            <div className="filter-categories gl-display-flex gl-flex-grow-1 gl-flex-wrap" style={{ gap: 8 }}>
              <FilterDropdown className="js-group-search" label="Group" title="Filter by group"
                placeholder="Search groups" options={[]} hrefFor={v => filterHref('group_id', v)} current={null} />
              <FilterDropdown className="js-project-search" label="Project" title="Filter by project"
                placeholder="Search projects" current={projectId}
                options={projectOptions.map(p => [String(p.id),
                  `${p.namespace ? `${p.namespace.name} / ` : ''}${p.path || p.name}`])}
                hrefFor={v => filterHref('project_id', v)} />
              <FilterDropdown className="js-user-search js-author-search" label="Author" title="Filter by author"
                placeholder="Search authors" current={authorId}
                options={[['', 'Any Author'], ...authorOptions.map(u => [String(u.id), u.name])]}
                hrefFor={v => filterHref('author_id', v)} />
              <FilterDropdown className="js-type-search" label="Type" options={TYPES} current={type}
                hrefFor={v => filterHref('type', v)} />
              <FilterDropdown className="js-action-search" label="Action" options={ACTIONS} current={actionId}
                hrefFor={v => filterHref('action_id', v)} wrapperClass="actions-filter" />
            </div>
            <div className="filter-item sort-filter">
              <Dropdown className="dropdown"
                toggleClassName="dropdown-menu-toggle dropdown-menu-toggle-sort btn gl-button btn-default"
                toggle={<>
                  <span className="light">{(SORTS.find(s => s[0] === sort) || SORTS[1])[1]}</span>
                  <Icon name="chevron-down" />
                </>}
                menuAs="ul" menuClassName="dropdown-menu dropdown-menu-sort dropdown-menu-right">
                {SORTS.map(([v, l]) => <li key={v}><a href={filterHref('sort', v)}>{l}</a></li>)}
              </Dropdown>
            </div>
          </QueryForm>
        </div>
      </div>

      <div className="row js-todos-all">
        {resolved.length === 0 ? (
          <div className="col todos-all-done empty-state">
            <div className="text-content gl-text-center">
              <h4>Nothing is on your to-do list. Nice work!</h4>
            </div>
          </div>
        ) : (
          <div className="col js-todos-list-container" data-qa-selector="todos_list_container">
            <div className="js-todos-options" data-page="1" data-per-page="5" data-total-pages="1">
              <ul className="content-list todos-list">
                {resolved.map(r => (
                  <TodoRow key={r.todo.id} todo={r.todo} target={r.target} project={r.project}
                    author={r.author} currentUserId={currentUser.id} />
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function FilterDropdown({ className, label, title, placeholder, options, hrefFor, current, wrapperClass = '' }) {
  const chosen = options.find(([v]) => v && String(v) === String(current))
  // The source's filter dropdowns narrow their list as you type in the search
  // box, so the box is a live control rather than decoration.
  const [query, setQuery] = React.useState('')
  const shown = query
    ? options.filter(([, l]) => String(l).toLowerCase().includes(query.toLowerCase()))
    : options
  return (
    <div className={`filter-item gl-m-2 ${wrapperClass}`.trim()}>
      <Dropdown className="dropdown"
        toggleClassName={`dropdown-menu-toggle btn gl-button btn-default js-filter-submit ${className}`}
        toggle={<>
          <span className={`dropdown-toggle-text${chosen ? '' : ' is-default'}`}>{chosen ? chosen[1] : label}</span>
          <Icon name="chevron-down" />
        </>}
        menuClassName="dropdown-menu dropdown-select dropdown-menu-selectable js-filter-submit">
        {title ? (
          <div className="dropdown-title gl-display-flex"><span className="gl-ml-auto">{title}</span></div>
        ) : null}
        {placeholder ? (
          <div className="dropdown-input" onClick={e => e.stopPropagation()}>
            <input className="dropdown-input-field form-control" data-qa-selector="dropdown_input_field"
              placeholder={placeholder} type="search" value={query}
              onChange={e => setQuery(e.target.value)} />
          </div>
        ) : null}
        <div className="dropdown-content" data-qa-selector="dropdown_list_content">
          <ul>
            {shown.length === 0
              ? <li className="dropdown-item gl-text-gray-500">No matching results</li>
              : shown.map(([v, l]) => (
                <li key={v || '__any__'} className={String(v) === String(current || '') ? 'is-active' : ''}>
                  <a href={hrefFor(v)}>{l}</a></li>
              ))}
          </ul>
        </div>
      </Dropdown>
    </div>
  )
}
