import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import Icon from '../components/layout/Icon.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import { useQuery } from './hooks.js'
import { ACCESS_LEVELS, accessLabel, formatCommitDate } from '../utils/format.js'
import Dropdown from '../components/ui/Dropdown.jsx'
import { addMembers, dbStamp } from '../components/create/mutations.js'

// ROUTES #94 / #95 / #121 — the members table and the Invite members modal.
// assets/README.md §17 (project) and §18b (group).
//
// Column order is verified against the source DOM and is NOT the obvious one:
//   Account · Source · Access granted · Max role · Expiration · Created on ·
//   Last activity · (sr-only) Actions
// `Max role` comes BEFORE `Expiration`.
//
// ANCHOR — `func:gitlab_get_project_memeber_role(page, '<username>')` resolves
// the member's row INDEX with
//     document.querySelectorAll("td[data-label='Account'] span.gl-avatar-labeled-sublabel")
// and then reads that index out of
//     document.querySelectorAll("td.col-max-role span")
// So all three of these are load-bearing:
//   * every `<td>` carries `data-label="<column header>"` — the Account cell's
//     is what the first querySelectorAll keys on, and without it the helper
//     matches zero nodes and every role assertion silently reads '' (BUG-001),
//   * `@username` MUST render inside `span.gl-avatar-labeled-sublabel` in the
//     Account cell (20 tasks),
//   * the Max-role cell must contain the role label and nothing else when the
//     dropdown is closed — a native <select> would leak every option into the
//     cell text and break the read.
// The `data-label` / `aria-colindex` values below are copied verbatim from
// assets/html/proj-dotfiles-members.html; do not paraphrase them.

/** The source's `<td>` attribute set, by column. Order matches the header. */
const COLUMNS = [
  { label: 'Account', className: '' },
  { label: 'Source', className: 'col-meta' },
  { label: 'Access granted', className: 'col-meta' },
  { label: 'Max role', className: 'col-max-role' },
  { label: 'Expiration', className: 'col-expiration' },
  { label: 'Created on', className: '' },
  { label: 'Last activity', className: '' },
  { label: 'Actions', className: 'col-actions' },
]

/** `<td aria-colindex="4" data-label="Max role" role="cell" class="col-max-role">` */
function cellProps(label) {
  const i = COLUMNS.findIndex(c => c.label === label)
  return {
    'aria-colindex': i + 1,
    'data-label': label,
    role: 'cell',
    className: COLUMNS[i].className,
  }
}

const SORTS = [
  { label: 'Account', asc: 'name_asc', desc: 'name_desc' },
  { label: 'Access granted', asc: 'last_joined', desc: 'first_joined' },
  { label: 'Max role', asc: 'access_level_asc', desc: 'access_level_desc' },
  { label: 'Created on', asc: 'oldest_created_user', desc: 'recent_created_user' },
  { label: 'Last activity', asc: 'oldest_last_activity', desc: 'recent_last_activity' },
  { label: 'Last sign-in', asc: 'recent_sign_in', desc: 'oldest_sign_in' },
]

/** Max-role cell, editable flavour: a GitLab dropdown, never a <select>. */
function RoleDropdown({ member, user, options, onChange }) {
  const [open, setOpen] = useState(false)
  const label = accessLabel(member.access_level)
  return (
    <div className={`dropdown b-dropdown gl-dropdown btn-group${open ? ' show' : ''}`}>
      <button type="button" className="btn dropdown-toggle btn-default btn-md gl-button gl-dropdown-toggle"
        data-qa-selector="access_level_dropdown"
        aria-label={`Change role of ${user.username}`} aria-expanded={open}
        onClick={() => setOpen(o => !o)}>
        <span className="gl-dropdown-button-text">{label}</span>
        <Icon name="chevron-down" />
      </button>
      {open && (
        <ul className="dropdown-menu show" role="menu" style={{ display: 'block' }}>
          <div className="gl-dropdown-inner">
            <div className="gl-dropdown-header gl-border-b-0!">
              <p className="gl-dropdown-header-top">Change role</p>
            </div>
            <div className="gl-dropdown-contents">
              {options.map(a => (
                <li key={a.level} className={`gl-dropdown-item${a.level === member.access_level ? ' is-active' : ''}`}>
                  <button type="button" className="dropdown-item" role="menuitem"
                    data-qa-selector="access_level_link"
                    onClick={() => { onChange(a.level); setOpen(false) }}>
                    <div className="gl-dropdown-item-text-wrapper">
                      <p className="gl-dropdown-item-text-primary">{a.label}</p>
                    </div>
                  </button>
                </li>
              ))}
            </div>
          </div>
        </ul>
      )}
    </div>
  )
}

/**
 * Whether the viewer may manage membership here — Maintainer (40) or above,
 * which is what GitLab's `admin_project_member` / `admin_group_member` policy
 * resolves to. Measured on the source: byteblaze is Owner on
 * `/byteblaze/dotfiles/-/project_members` and gets the intro paragraph, the
 * three buttons and an Actions column; byteblaze is a Developer on
 * `/primer/design/-/project_members` and gets none of them (`aria-colcount`
 * drops from 8 to 7); byteblaze is not a member of `robert1003` at all and
 * `/groups/robert1003/-/group_members` renders an empty header div.
 */
export function canManageMembers(state, currentUser, sourceType, sourceId) {
  const own = state.members.find(m => m.source_type === sourceType
    && m.source_id === sourceId && m.user_id === currentUser.id)
  return !!own && own.access_level >= 40
}

export default function MembersTable({ sourceType, sourceId, sourceName }) {
  const { state, indexes, currentUser, updateIn, removeFrom, setState } = useApp()
  const q = useQuery()
  const [modal, setModal] = useState(null)   // 'invite' | 'group' | 'import' | null
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([])
  // §17 — the source's role select opens on Guest, NOT Developer. Five of the
  // nine member tasks ("invite him to the repo as a guest") match that default,
  // so an agent that submits without touching the dropdown must get Guest.
  const [role, setRole] = useState(10)
  const [expires, setExpires] = useState('')
  const [filter, setFilter] = useState('')
  const [sortOpen, setSortOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(null)
  const [tab, setTab] = useState('members')
  const [unassignIssuables, setUnassignIssuables] = useState(false)

  const kind = sourceType === 'project' ? 'project' : 'group'
  // ROUTES #97 — a row carrying `requested_at` is an access *request*, not a
  // membership. GitLab keeps both in `members` but only lists accepted members
  // in the Members tab (requests live behind an Access requests tab that only
  // a Maintainer sees, and byteblaze is not one anywhere a request is possible).
  const all = state.members.filter(m => m.source_type === sourceType && m.source_id === sourceId && !m.requested_at)
  const groupLinks = (state.groupLinks || [])
    .filter(l => l.source_type === sourceType && l.source_id === sourceId)

  const rows = all
    .map(m => ({ member: m, user: indexes.usersById.get(m.user_id) }))
    .filter(r => r.user)
    .filter(r => !filter
      || r.user.name.toLowerCase().includes(filter.toLowerCase())
      || r.user.username.toLowerCase().includes(filter.toLowerCase()))

  const sort = q.get('sort', 'name_asc')
  const ts = v => (v ? new Date(String(v).replace(' ', 'T')).getTime() : 0)
  rows.sort((a, b) => {
    switch (sort) {
      case 'name_desc': return b.user.name.localeCompare(a.user.name)
      case 'last_joined': return ts(b.member.created_at) - ts(a.member.created_at)
      case 'first_joined': return ts(a.member.created_at) - ts(b.member.created_at)
      case 'access_level_asc': return a.member.access_level - b.member.access_level
      case 'access_level_desc': return b.member.access_level - a.member.access_level
      case 'oldest_created_user': return ts(a.user.created_at) - ts(b.user.created_at)
      case 'recent_created_user': return ts(b.user.created_at) - ts(a.user.created_at)
      default: return a.user.name.localeCompare(b.user.name)
    }
  })
  const sortEntry = SORTS.find(s => s.asc === sort || s.desc === sort) || SORTS[0]
  const descending = sortEntry.desc === sort
  const sortHref = key => {
    const p = new URLSearchParams(q.searchParams)
    p.set('sort', key)
    return `?${p.toString()}`
  }

  // The current user's own access level in this source decides both which rows
  // are editable and how many options the role dropdown offers (§17).
  const own = all.find(m => m.user_id === currentUser.id)
  const ownAccess = own ? own.access_level : 0
  const roleOptions = ACCESS_LEVELS.filter(a => a.level >= 10 && a.level <= Math.max(ownAccess, 10))
  const canManage = ownAccess >= 40

  // §17 — the `Groups` tab only exists once the source/group actually has a
  // group share. Both captured members pages (dotfiles, robert1003) render a
  // single `Members` tab.
  const showGroupsTab = groupLinks.length > 0
  const activeTab = showGroupsTab ? tab : 'members'

  const memberUserIds = new Set(all.map(m => m.user_id))
  const candidates = query.length >= 1
    ? state.users.filter(u => !memberUserIds.has(u.id) && !selected.some(s => s.id === u.id)
      && (u.username.toLowerCase().includes(query.toLowerCase())
        || (u.name || '').toLowerCase().includes(query.toLowerCase()))).slice(0, 8)
    : []

  function invite() {
    if (!selected.length) return
    // One reducer for the whole submit: `addMembers` allocates every id off
    // prev.nextIds.member inside the updater. Calling allocateId() per row
    // returned null for the rows after the first (BUG-B03 / BUG-007) — React 18
    // does not run the updater before allocateId returns.
    setState(prev => addMembers(prev, {
      sourceType,
      sourceId,
      rows: selected.map(u => ({
        user_id: u.id, access_level: Number(role), expires_at: expires || null,
      })),
    }))
    setSelected([])
    setQuery('')
    setExpires('')
    setModal(null)
  }

  function changeRole(memberId, level) {
    updateIn('members', m => m.id === memberId,
      () => ({ access_level: Number(level), access_label: accessLabel(level) }))
  }

  function remove(memberId) {
    const row = all.find(m => m.id === memberId)
    if (row && unassignIssuables) {
      const drop = ids => (ids || []).filter(id => id !== row.user_id)
      updateIn('issues', i => (i.assignee_ids || []).includes(row.user_id),
        i => ({ assignee_ids: drop(i.assignee_ids) }))
      updateIn('mergeRequests', m => (m.assignee_ids || []).includes(row.user_id)
        || (m.reviewer_ids || []).includes(row.user_id),
      m => ({ assignee_ids: drop(m.assignee_ids), reviewer_ids: drop(m.reviewer_ids) }))
    }
    removeFrom('members', m => m.id === memberId)
    setUnassignIssuables(false)
    setConfirmRemove(null)
  }

  // Remove-member modal target string: `"<Owner Name> / <project>"` on a
  // project, bare `"<group name>"` on a group (§17 / §18b).
  const ownerFullName = (() => {
    if (kind !== 'project') return sourceName
    const ownerRow = all.find(m => m.access_level === 50)
    const ownerUser = ownerRow && indexes.usersById.get(ownerRow.user_id)
    return ownerUser ? `${ownerUser.name} / ${sourceName}` : sourceName
  })()

  return (
    <div className="members-wrapper">
      {/* §17 — Import from a project · Invite a group · Invite members.
          §18b: a GROUP page has no `Import from a project` button.
          The whole row is Maintainer+ only; the source renders no button at all
          on `/primer/design/-/project_members` or on a group byteblaze is not a
          member of (BUG-B10). */}
      {canManage ? (
        <div className="gl-display-flex gl-flex-wrap gl-align-items-flex-start gl-mt-3" style={{ gap: 12 }}>
          {kind === 'project' ? (
            <button type="button" className="btn btn-default btn-md gl-button js-import-project-members-trigger"
              onClick={() => setModal('import')}>Import from a project</button>
          ) : null}
          <button type="button" className="btn btn-default btn-md gl-button"
            data-qa-selector="invite_a_group_button" onClick={() => setModal('group')}>Invite a group</button>
          <button type="button" className="btn btn-confirm btn-md gl-button"
            data-qa-selector="invite_members_button" onClick={() => setModal('invite')}>Invite members</button>
        </div>
      ) : null}

      {/* §17 — `Groups` only appears once a group share exists; both captured
          members pages render a lone `Members` tab. */}
      <div className="tabs gl-tabs gl-mt-3">
        <ul className="nav gl-tabs-nav" role="tablist">
          <li className="nav-item">
            <a className={`nav-link gl-tab-nav-item${activeTab === 'members' ? ' gl-tab-nav-item-active active' : ''}`}
              role="tab" aria-selected={activeTab === 'members'} href="#members"
              onClick={e => { e.preventDefault(); setTab('members') }}>
              <span>Members</span>
              <span className="badge gl-tab-counter-badge badge-muted badge-pill gl-badge sm">{all.length}</span>
            </a>
          </li>
          {showGroupsTab ? (
            <li className="nav-item">
              <a className={`nav-link gl-tab-nav-item${activeTab === 'groups' ? ' gl-tab-nav-item-active active' : ''}`}
                role="tab" aria-selected={activeTab === 'groups'} href="#groups"
                onClick={e => { e.preventDefault(); setTab('groups') }}>
                <span>Groups</span>
                <span className="badge gl-tab-counter-badge badge-muted badge-pill gl-badge sm">{groupLinks.length}</span>
              </a>
            </li>
          ) : null}
        </ul>
      </div>

      {activeTab === 'groups' ? (
        <table className="table gl-table b-table" data-testid="group-links-table">
          <thead>
            <tr>
              <th>Group</th><th>Max role</th><th>Expiration</th>
              <th><span className="gl-sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {groupLinks.map(l => (
              <tr key={l.id}>
                <td className="col-account">
                  <a href={`/groups/${l.group_path}`}>{l.group_name}</a>
                </td>
                <td className="col-max-role">
                  <span className="gl-badge badge badge-pill badge-muted md">{l.access_label}</span>
                </td>
                <td className="col-expiration">{l.expires_at || 'Never'}</td>
                <td>
                  <button type="button" className="btn gl-button btn-danger-tertiary btn-icon"
                    aria-label={`Remove ${l.group_name}`}
                    onClick={() => setState(prev => ({
                      ...prev, groupLinks: (prev.groupLinks || []).filter(x => x.id !== l.id),
                    }))}>
                    <Icon name="remove" />
                  </button>
                </td>
              </tr>
            ))}
            {groupLinks.length === 0 ? (
              <tr><td colSpan={4} className="gl-text-gray-500">
                There are no group members with access to this {kind}.</td></tr>
            ) : null}
          </tbody>
        </table>
      ) : null}

      {activeTab === 'members' ? (
      <>
      {/* §17 toolbar — filter box on the left, sort key + direction on the right */}
      <div className="gl-bg-gray-10 gl-p-3 gl-md-display-flex gl-align-items-center" style={{ gap: 12 }}>
        <div className="vue-filtered-search-bar-container" data-testid="members-filtered-search-bar" style={{ flex: 1 }}>
          <div className="input-group gl-search-box-by-click" data-testid="filtered-search-input">
            <input type="text" className="gl-filtered-search-term-input form-control gl-form-input"
              data-testid="filtered-search-term-input" data-qa-selector="search_bar_input"
              placeholder="Filter members" aria-label="Filter members"
              value={filter} onChange={e => setFilter(e.target.value)} />
            <div className="input-group-append">
              <button type="button" className="btn gl-button btn-default btn-icon"
                data-testid="search-button" data-qa-selector="search_button" aria-label="Search"
                onClick={() => setFilter(f => f.trim())}>
                <Icon name="search" />
              </button>
            </div>
          </div>
        </div>
        <div className="gl-sorting gl-display-flex" data-testid="members-sort-dropdown" style={{ gap: 8 }}>
          <div className={`dropdown${sortOpen ? ' show' : ''}`}>
            <button type="button" className="btn gl-button btn-default gl-dropdown-toggle"
              onClick={() => setSortOpen(o => !o)}>
              <span className="gl-dropdown-button-text">{sortEntry.label}</span>
              <Icon name="chevron-down" />
            </button>
            {sortOpen ? (
              <div className="dropdown-menu show" style={{ display: 'block' }}>
                {SORTS.map(s => (
                  <a key={s.asc} className={`dropdown-item${s === sortEntry ? ' active' : ''}`}
                    href={sortHref(s.asc)} onClick={() => setSortOpen(false)}>{s.label}</a>
                ))}
              </div>
            ) : null}
          </div>
          <a className="btn btn-default btn-md gl-button btn-icon sorting-direction-button"
            title={`Sort direction: ${descending ? 'Descending' : 'Ascending'}`}
            aria-label={`Sorting Direction: ${descending ? 'Descending' : 'Ascending'}`}
            href={sortHref(descending ? sortEntry.asc : sortEntry.desc)}>
            <Icon name={descending ? 'chevron-up' : 'chevron-down'} />
          </a>
        </div>
      </div>

      <table className="table b-table gl-table members-table b-table-stacked-lg"
        data-testid="members-table" role="table" aria-busy="false"
        aria-colcount={canManage ? 8 : 7}>
        <thead role="rowgroup">
          <tr role="row">
            {COLUMNS.filter(c => canManage || c.label !== 'Actions').map((c, i) => (
              <th key={c.label} role="columnheader" scope="col" aria-colindex={i + 1}
                className={c.className}>
                {c.label === 'Actions'
                  ? <span className="gl-sr-only" data-testid="col-actions">Actions</span>
                  : c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ member, user }) => {
            const isSelf = user.id === currentUser.id
            const canUpdate = !isSelf && ownAccess >= 40 && member.access_level <= ownAccess
            const granter = member.created_by_id ? indexes.usersById.get(member.created_by_id) : null
            return (
              <tr key={member.id} id={`row_${member.id}`} role="row" data-pk={member.id}
                data-testid={`members-table-row-${member.id}`} data-qa-selector="member_row"
                data-username={user.username}>
                {/* ANCHOR — `td[data-label='Account']` is what
                    gitlab_get_project_memeber_role's row lookup keys on. */}
                <td {...cellProps('Account')}>
                  <div>
                    <a className="gl-link gl-avatar-link js-user-link" href={`/${user.username}`}>
                      <div className="gl-avatar-labeled gl-display-flex gl-align-items-center"
                        style={{ gap: 8 }} data-alt={user.name}>
                        <UserAvatar user={user} size={48} />
                        <div className="gl-avatar-labeled-labels gl-text-left!">
                          <div className="gl-display-flex gl-flex-wrap gl-align-items-center gl-text-left!">
                            <span className="gl-avatar-labeled-label">{user.name}</span>
                            {isSelf ? (
                              <div className="gl-p-1">
                                <span className="badge badge-success badge-pill gl-badge sm">It&apos;s you</span>
                              </div>
                            ) : null}
                          </div>
                          {/* ANCHOR — `@username` on its own line. */}
                          <span className="gl-avatar-labeled-sublabel">@{user.username}</span>
                        </div>
                      </div>
                    </a>
                  </div>
                </td>
                <td {...cellProps('Source')}><div><span>Direct member</span></div></td>
                <td {...cellProps('Access granted')}>
                  <div>
                    <span>
                      <TimeAgo value={member.created_at} />
                      {granter ? <>{' by '}<a href={`/${granter.username}`}>{granter.name}</a></> : null}
                    </span>
                  </div>
                </td>
                {/* ANCHOR cell — role label only. */}
                <td {...cellProps('Max role')}>
                  <div>
                    {canUpdate ? (
                      <RoleDropdown member={member} user={user} options={roleOptions}
                        onChange={level => changeRole(member.id, level)} />
                    ) : (
                      <span className="badge badge-muted badge-pill gl-badge md">{accessLabel(member.access_level)}</span>
                    )}
                  </div>
                </td>
                {/* §17 — always a datepicker, blank when unset. NEVER the word
                    "Never": the source cell's innerText is ''. */}
                <td {...cellProps('Expiration')}>
                  <div>
                    <div className="gl-max-w-full gl-datepicker d-inline-block gl-w-full gl-form-input-md">
                      <div className="gl-relative">
                        <input className="gl-form-input gl-w-full form-control gl-pr-7!" type="text"
                          data-testid="gl-datepicker-input" placeholder="Expiration date" aria-label="Enter date"
                          autoComplete="off" disabled={!canUpdate}
                          value={member.expires_at || ''}
                          onChange={e => updateIn('members', m => m.id === member.id,
                            () => ({ expires_at: e.target.value || null }))} />
                        <div className="gl-datepicker-actions">
                          <span className="gl-px-2 gl-text-gray-400" data-testid="datepicker-calendar-icon">
                            <Icon name="clock" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </td>
                {/* §17 — `%-d %b, %Y`, e.g. `23 Mar, 2023`. Different from every
                    other date format on the site; do not unify. */}
                <td {...cellProps('Created on')}><div><span>{formatCommitDate(user.created_at)}</span></div></td>
                <td {...cellProps('Last activity')}>
                  <div><span>{formatCommitDate(isSelf ? new Date().toISOString() : user.created_at)}</span></div>
                </td>
                {canManage ? (
                  <td {...cellProps('Actions')}>
                    <div>
                      <div className="gl-display-flex gl-justify-content-end">
                        {isSelf ? (
                          <button type="button" className="btn btn-danger btn-md gl-button btn-icon"
                            title="Leave" aria-label="Leave" onClick={() => setConfirmRemove(member)}>
                            <Icon name="close" />
                          </button>
                        ) : canUpdate ? (
                          <button type="button" className="btn btn-danger btn-md gl-button btn-danger-secondary"
                            data-qa-selector="delete_member_button" onClick={() => setConfirmRemove(member)}>
                            <span className="gl-button-text">Remove member</span>
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </td>
                ) : null}
              </tr>
            )
          })}
          {rows.length === 0 ? (
            <tr><td colSpan={canManage ? 8 : 7} className="gl-text-gray-500">No members found</td></tr>
          ) : null}
        </tbody>
      </table>
      </>
      ) : null}

      {confirmRemove ? (
        <Modal title="Remove member" onClose={() => setConfirmRemove(null)}
          footer={(
            <>
              <button type="button" className="btn gl-button btn-default"
                onClick={() => setConfirmRemove(null)}>Cancel</button>
              <button type="button" className="btn gl-button btn-danger"
                onClick={() => remove(confirmRemove.id)}>Remove member</button>
            </>
          )}>
          <p>
            {`Are you sure you want to remove ${(indexes.usersById.get(confirmRemove.user_id) || {}).username} from "${ownerFullName}"?`}
          </p>
          <div className="gl-form-checkbox custom-control custom-checkbox">
            <input id="unassign_issuables" type="checkbox" className="custom-control-input"
              checked={unassignIssuables} onChange={e => setUnassignIssuables(e.target.checked)} />
            <label className="custom-control-label" htmlFor="unassign_issuables">
              Also unassign this user from related issues and merge requests
            </label>
          </div>
        </Modal>
      ) : null}

      {/* §17 — Invite members. The role <select> is a NATIVE select here (the
          modal), unlike the table's Max-role cell. */}
      {modal === 'invite' ? (
        <Modal title="Invite members" onClose={() => setModal(null)}
          footer={(
            <>
              <button type="button" className="btn js-modal-action-cancel btn-default btn-md gl-button"
                onClick={() => setModal(null)}>Cancel</button>
              <button type="button" data-qa-selector="invite_button"
                className="btn js-modal-action-primary btn-confirm btn-md gl-button"
                disabled={!selected.length} onClick={invite}>Invite</button>
            </>
          )}>
          <div data-testid="invite-modal-initial-content" className="invite-modal-content">
            <div data-testid="modal-base-intro-text">
              {"You're inviting members to the "}<strong>{sourceName}</strong>{` ${kind}.`}
            </div>
            <div className="form-group gl-mt-3">
              <label htmlFor="invite-members-search">Username or email address</label>
              <div className="gl-token-selector">
                <div className="gl-display-flex gl-mb-2" style={{ gap: 4, flexWrap: 'wrap' }}>
                  {selected.map(u => (
                    <span key={u.id} className="gl-badge badge badge-pill badge-neutral md">
                      {u.name}
                      <button type="button" aria-label={`Remove ${u.username}`}
                        className="btn gl-button btn-link gl-ml-2"
                        onClick={() => setSelected(s => s.filter(x => x.id !== u.id))}>×</button>
                    </span>
                  ))}
                </div>
                <input id="invite-members-search" type="text" className="form-control gl-form-input"
                  data-testid="members-token-select-input" data-qa-selector="members_token_select_input"
                  value={query} onChange={e => setQuery(e.target.value)} autoComplete="off" />
                {query.length >= 1 ? (
                  <ul className="dropdown-menu show" style={{ position: 'static', display: 'block', marginTop: 4 }}>
                    {candidates.length ? candidates.map(u => (
                      <li key={u.id}>
                        <button type="button" className="dropdown-item"
                          onClick={() => { setSelected(s => [...s, u]); setQuery('') }}>
                          <UserAvatar user={u} size={24} />
                          <span className="gl-ml-2">{u.name}</span>
                          <span className="gl-text-gray-500 gl-ml-2">@{u.username}</span>
                        </button>
                      </li>
                    )) : <li className="dropdown-item gl-text-gray-500">No matches found</li>}
                  </ul>
                ) : null}
              </div>
              <small className="form-text text-gl-muted">Select members or type email addresses</small>
            </div>
            <div className="form-group">
              <label htmlFor="invite-members-role">Select a role</label>
              <select id="invite-members-role" className="gl-form-select custom-select"
                data-qa-selector="access_level_dropdown"
                value={role} onChange={e => setRole(e.target.value)}>
                <option value="10">Guest</option>
                <option value="20">Reporter</option>
                <option value="30">Developer</option>
                <option value="40">Maintainer</option>
                <option value="50">Owner</option>
              </select>
              <small className="form-text text-gl-muted">
                <a href="/help/user/permissions" rel="noopener" target="_blank" className="gl-link">Read more</a>
                {' about role permissions'}
              </small>
            </div>
            <div className="form-group">
              <label htmlFor="invite-members-expires">Access expiration date (optional)</label>
              <input id="invite-members-expires" type="text" className="form-control gl-form-input"
                data-testid="gl-datepicker-input" aria-label="Enter date" placeholder="YYYY-MM-DD"
                value={expires} onChange={e => setExpires(e.target.value)} />
            </div>
          </div>
        </Modal>
      ) : null}

      {modal === 'group' ? (
        <InviteGroupModal sourceType={sourceType} sourceId={sourceId} sourceName={sourceName}
          kind={kind} onClose={() => setModal(null)} />
      ) : null}

      {modal === 'import' ? (
        <ImportMembersModal sourceType={sourceType} sourceId={sourceId} sourceName={sourceName}
          onClose={() => setModal(null)} />
      ) : null}
    </div>
  )
}

function Modal({ title, children, footer, onClose }) {
  return (
    <>
      <div className="modal-backdrop fade show" onClick={onClose} />
      <div role="dialog" aria-label={title} aria-modal="true"
        className="modal fade show gl-modal" style={{ display: 'block' }}>
        <div className="modal-dialog">
          <div className="modal-content" tabIndex={-1}>
            <header className="modal-header">
              <h4 className="modal-title">{title}</h4>
              <button type="button" aria-label="Close"
                className="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon"
                onClick={onClose}>×</button>
            </header>
            <div className="modal-body">{children}</div>
            <footer className="modal-footer">{footer}</footer>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * §17 — `Invite a group` shares this project/group with another group. The
 * share is recorded in `state.groupLinks` and renders in the members table's
 * **Groups** tab; the collection is created lazily on first invite, exactly as
 * `state.snippets` is.
 */
function InviteGroupModal({ sourceType, sourceId, sourceName, kind, onClose }) {
  const { state, setState } = useApp()
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState(null)
  // Guest, like the Invite members modal — verified on the source's own
  // `Invite a group` dialog (opened read-only, nothing submitted).
  const [role, setRole] = useState(10)
  const [expires, setExpires] = useState('')

  const linked = new Set((state.groupLinks || [])
    .filter(l => l.source_type === sourceType && l.source_id === sourceId).map(l => l.group_id))
  const options = state.groups
    .filter(g => !linked.has(g.id))
    .filter(g => !search || (g.name || '').toLowerCase().includes(search.toLowerCase())
      || (g.path || '').toLowerCase().includes(search.toLowerCase()))
    .slice(0, 20)

  function share() {
    if (!picked) return
    setState(prev => {
      const links = prev.groupLinks || []
      return {
        ...prev,
        groupLinks: [...links, {
          id: (links.reduce((m, l) => Math.max(m, l.id), 0) || 0) + 1,
          source_type: sourceType,
          source_id: sourceId,
          group_id: picked.id,
          group_name: picked.name,
          group_path: picked.full_path || picked.path,
          access_level: Number(role),
          access_label: accessLabel(role),
          expires_at: expires || null,
          created_at: dbStamp(),
        }],
      }
    })
    onClose()
  }

  return (
    <Modal title="Invite a group" onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn gl-button btn-default" onClick={onClose}>Cancel</button>
          <button type="button" className="btn gl-button btn-confirm" disabled={!picked}
            onClick={share}>Invite</button>
        </>
      )}>
      <p>{"You're inviting a group to the "}<strong>{sourceName}</strong>{` ${kind}.`}</p>
      <div className="form-group">
        <label htmlFor="group-select">Select a group to invite</label>
        <Dropdown className="dropdown" data-testid="group-select-dropdown" closeOnSelect={false}
          toggleProps={{ id: 'group-select' }}
          toggleClassName="btn gl-button btn-default gl-dropdown-toggle"
          toggle={<>
            <span className="gl-dropdown-button-text">{picked ? picked.name : 'Select a group'}</span>
            <Icon name="chevron-down" />
          </>}>
          <div className="dropdown-input">
            <input className="form-control gl-form-input" placeholder="Search groups"
              data-qa-selector="group_select_dropdown_search_field"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <ul>
            {options.map(g => (
              <li key={g.id}>
                <button type="button" className={`dropdown-item${picked && picked.id === g.id ? ' active' : ''}`}
                  onClick={() => setPicked(g)}>{g.name}</button>
              </li>
            ))}
            {options.length === 0 ? (
              <li data-testid="empty-result-message" className="dropdown-item gl-text-gray-500">
                No matching results</li>
            ) : null}
          </ul>
        </Dropdown>
      </div>
      <div className="form-group">
        <label htmlFor="invite-group-role">Select a role</label>
        <select id="invite-group-role" className="gl-form-select custom-select"
          value={role} onChange={e => setRole(e.target.value)}>
          <option value="10">Guest</option>
          <option value="20">Reporter</option>
          <option value="30">Developer</option>
          <option value="40">Maintainer</option>
          <option value="50">Owner</option>
        </select>
        <small className="form-text text-gl-muted">
          <a href="/help/user/permissions" className="gl-link">Read more</a>{' about role permissions'}
        </small>
      </div>
      <div className="form-group">
        <label htmlFor="invite-group-expires">Access expiration date (optional)</label>
        <input id="invite-group-expires" className="form-control gl-form-input" placeholder="YYYY-MM-DD"
          value={expires} onChange={e => setExpires(e.target.value)} />
      </div>
    </Modal>
  )
}

/** §17 — `Import from a project` copies another project's direct members. */
function ImportMembersModal({ sourceType, sourceId, sourceName, onClose }) {
  const { state, currentUser, setState } = useApp()
  const [search, setSearch] = useState('')
  const [picked, setPicked] = useState(null)

  const memberProjectIds = new Set(state.members
    .filter(m => m.source_type === 'project' && m.user_id === currentUser.id).map(m => m.source_id))
  const options = state.projects
    .filter(p => memberProjectIds.has(p.id) && !(sourceType === 'project' && p.id === sourceId))
    .filter(p => !search || p.full_path.toLowerCase().includes(search.toLowerCase()))
    .slice(0, 20)

  const existing = new Set(state.members
    .filter(m => m.source_type === sourceType && m.source_id === sourceId).map(m => m.user_id))

  function run() {
    if (!picked) return
    setState(prev => addMembers(prev, {
      sourceType,
      sourceId,
      rows: prev.members
        .filter(m => m.source_type === 'project' && m.source_id === picked.id && !existing.has(m.user_id))
        .map(m => ({ user_id: m.user_id, access_level: m.access_level })),
    }))
    onClose()
  }

  return (
    <Modal title="Import members from another project" onClose={onClose}
      footer={(
        <>
          <button type="button" className="btn gl-button btn-default" onClick={onClose}>Cancel</button>
          <button type="button" className="btn gl-button btn-confirm" disabled={!picked}
            onClick={run}>Import project members</button>
        </>
      )}>
      <p>{"You're importing members to the "}<strong>{sourceName}</strong>{' project.'}</p>
      <div className="form-group">
        <label id="project-select" htmlFor="project-select-search">Project</label>
        <Dropdown className="dropdown" data-testid="project-select-dropdown" closeOnSelect={false}
          toggleClassName="btn gl-button btn-default gl-dropdown-toggle"
          toggle={<>
            <span className="gl-dropdown-button-text">{picked ? picked.full_path : 'Select a project'}</span>
            <Icon name="chevron-down" />
          </>}>
          <div className="dropdown-input">
            <input id="project-select-search" className="form-control gl-form-input"
              placeholder="Search projects" data-qa-selector="project_select_dropdown_search_field"
              value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <ul>
            {options.map(p => (
              <li key={p.id}>
                <button type="button" className={`dropdown-item${picked && picked.id === p.id ? ' active' : ''}`}
                  onClick={() => setPicked(p)}>
                  {p.namespace ? `${p.namespace.name} / ` : ''}{p.name}
                </button>
              </li>
            ))}
            {options.length === 0 ? <li className="dropdown-item gl-text-gray-500">No matching results</li> : null}
          </ul>
        </Dropdown>
      </div>
      <p className="gl-text-gray-500">
        Only project members (not group members) are imported, and they get the same permissions as
        the project you import from.
      </p>
    </Modal>
  )
}
