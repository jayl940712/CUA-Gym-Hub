import React, { useMemo, useState } from 'react'
import { useSidNavigate } from '../../utils/navigation.js'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import LegacyAdminGrid from '../../components/grid/LegacyAdminGrid.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { formatDateTime } from '../../utils/formatters.js'
import { SESSION_HOST_IP } from '../../components/system/systemData.js'
import '../../components/system/system.css'

/**
 * System > Permissions — ROUTES rows 120, 121, 131, 132.
 * `adminUsers.json` (1 row: `admin`) and `adminRoles.json` (`authorization_role`;
 * the grid lists only `role_type = 'G'`, which is why the source says
 * "1 records found" for three DB rows).
 */

export function AdminUsers() {
  const { state } = useApp()
  const navigate = useSidNavigate()
  const users = state?.adminUsers || []
  const roles = state?.adminRoles || []

  const rows = useMemo(() => users.map(u => {
    // A user's group membership is the `role_type='U'` row pointing at it; its
    // parent is the group role that carries the displayed name.
    const membership = roles.find(r => r.role_type === 'U' && String(r.user_id) === String(u.user_id))
    const group = roles.find(r => String(r.role_id) === String(membership?.parent_id))
    return { ...u, role_name: group?.role_name || '' }
  }), [users, roles])

  const columns = [
    { id: 'user_id', label: 'ID', filterType: 'text', sortValue: r => Number(r.user_id) },
    {
      id: 'username', label: 'User Name', filterType: 'text', searchValue: r => r.username,
      render: r => <AdminLink to={`/admin/admin/user/edit/user_id/${r.user_id}/`}>{r.username}</AdminLink>,
      exportValue: r => r.username,
    },
    { id: 'firstname', label: 'First Name', filterType: 'text' },
    { id: 'lastname', label: 'Last Name', filterType: 'text' },
    { id: 'email', label: 'Email', filterType: 'text', searchValue: r => r.email },
    {
      id: 'logdate', label: 'Last Logged in', filterType: 'date',
      render: r => formatDateTime(r.logdate), exportValue: r => formatDateTime(r.logdate),
    },
    { id: 'role_name', label: 'Role', filterType: 'text' },
    {
      id: 'is_active', label: 'Status', filterType: 'select',
      options: [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }],
      render: r => (Number(r.is_active) === 1 ? 'Active' : 'Inactive'),
      filterValue: r => String(r.is_active),
      exportValue: r => (Number(r.is_active) === 1 ? 'Active' : 'Inactive'),
    },
  ]

  const actions = (
    // Source: <button id="add" title="Add New User" class="action-default scalable add primary"
    //   data-ui-id="adminhtml-user-grid-container-add-button">
    <button type="button" id="add" title="Add New User"
      className="action-default scalable add primary"
      onClick={() => navigate('/admin/admin/user/new/')}>
      <span>Add New User</span>
    </button>
  )

  return (
    <PageShell title="Users" actions={actions}
      actionsUiPrefix="adminhtml-user-grid-container-">
      {/* Round 10. LEGACY on the source.
        * DIFF-R102 (round 11) — the source's cold-load sort is User Name
        * ascending, not ID: `th[data-sort="username"]` carries `_ascend` while
        * the ID column carries `not-sort`. */}
      <LegacyAdminGrid legacyToolbarBase={0} gridId="permissionsUserGrid"
        basePath="/admin/admin/user/index" rows={rows} columns={columns} rowKey={r => r.user_id}
        exportable={false} exportFileName="admin_users"
        defaultSort={{ field: 'username', direction: 'asc' }} />
    </PageShell>
  )
}

export function AdminRoles() {
  const { state } = useApp()
  const navigate = useSidNavigate()
  const rows = (state?.adminRoles || []).filter(r => r.role_type === 'G')

  const columns = [
    { id: 'role_id', label: 'ID', filterType: 'text', sortValue: r => Number(r.role_id) },
    {
      id: 'role_name', label: 'Role', filterType: 'text', searchValue: r => r.role_name,
      render: r => <AdminLink to={`/admin/admin/user_role/editrole/rid/${r.role_id}/`}>{r.role_name}</AdminLink>,
      exportValue: r => r.role_name,
    },
  ]

  const actions = (
    <button type="button" id="add" title="Add New Role"
      className="action-default scalable add primary"
      onClick={() => navigate('/admin/admin/user_role/editrole/')}>
      <span>Add New Role</span>
    </button>
  )

  return (
    <PageShell title="Roles" actions={actions}
      actionsUiPrefix="adminhtml-user-role-container-">
      {/* Round 10. LEGACY on the source. */}
      <LegacyAdminGrid legacyToolbarBase={0} gridId="roleGrid"
        basePath="/admin/admin/user_role/index" rows={rows} columns={columns} rowKey={r => r.role_id}
        exportable={false} exportFileName="admin_roles"
        defaultSort={{ field: 'role_id', direction: 'asc' }} />
    </PageShell>
  )
}

/**
 * Locked Users (132). `admin_user_session` records no lockouts in this DB
 * (`lock_expires` is null for the only user), so the grid is empty — that is the
 * source's state, not a missing seed.
 */
export function LockedUsers() {
  const { state, setState, addMessage } = useApp()
  // PIPELINE-021 (latent): the grid is empty because the source has no locked
  // users, but Unlock must still write state rather than print success against
  // nothing — an injected task state can seed a locked row.
  const unlocked = state?.systemConfig?.unlockedAdminUserIds || []
  const rows = (state?.lockedAdminUsers || [])
    .filter(u => !unlocked.map(String).includes(String(u.user_id)))
  const columns = [
    /* Round 10 — on the source only Username carries a filter control here;
       every other cell in the filter row is empty, and the leading checkbox
       column holds the `massaction` Any/Yes/No select. */
    /* DIFF-R102 — two columns sort on a DB field that is not the descriptor id
       and is not recoverable from a `filterName` either (neither carries a
       filter control here), so both need an explicit `sortId`: the source
       emits `data-sort="last_login"` on Last login and
       `data-sort="lock_expires"` on Unlocked. */
    { id: 'user_id', label: 'ID', filterType: null },
    { id: 'username', label: 'Username', filterType: 'text' },
    { id: 'logdate', label: 'Last login', filterType: null, sortId: 'last_login' },
    { id: 'failures_num', label: 'Failures', filterType: null },
    {
      id: 'unlocked', label: 'Unlocked', filterType: null, sortId: 'lock_expires',
    },
  ]
  return (
    <PageShell title="Locked Users">
      {/* Round 10. LEGACY on the source, massaction bar included
        * (`select#lockedAdminsGrid_massaction-select`). */}
      {/* This grid's only massaction carries Magento's `selected` flag, so the
        * source's `#lockedAdminsGrid_massaction-select` already reads `unlock`
        * on cold load (measured: value `unlock`, selectedIndex 1). */}
      <LegacyAdminGrid legacyToolbarBase={0} gridId="lockedAdminsGrid"
        basePath="/admin/admin/locks/index" rows={rows} columns={columns} rowKey={r => r.user_id}
        rowSelectValue={r => r.user_id} rowSelectName="login_ids"
        exportable={false} selectable massActionFilter massActionDefault="unlock"
        defaultSort={{ field: 'user_id', direction: 'desc' }}
        massActions={[{
          id: 'unlock',
          label: 'Unlock',
          onApply: ids => {
            setState(prev => ({
              ...prev,
              systemConfig: {
                ...prev.systemConfig,
                unlockedAdminUserIds: [...new Set([
                  ...(prev.systemConfig?.unlockedAdminUserIds || []), ...ids.map(Number),
                ])],
              },
            }))
            addMessage(`${ids.length} user(s) unlocked.`)
          },
        }]}
        exportFileName="locked_users" />
    </PageShell>
  )
}

/**
 * ROUTES row 131 — `/admin/security/session/activity/`. The menu calls it
 * "Login Sessions" but the page itself is titled **Account Activity**; it lists
 * the admin's concurrent sessions by IP and start time and offers
 * "Log out all other sessions".
 */
export function AccountActivity() {
  const { state, addMessage } = useApp()
  const user = (state?.adminUsers || [])[0]
  const [sessions, setSessions] = useState(
    () => (user ? [{ id: 1, ip: SESSION_HOST_IP, started: user.logdate }] : []))

  return (
    <PageShell title="Account Activity">
      <div className="admin__page-section">
        <h2 className="admin__page-section-title">Account Activity</h2>
        <p>
          This administrator account is open in more than one location. Note that other locations might be
          different browsers or sessions on the same computer.
        </p>
        <p>Concurrent session information:</p>
        <table className="data-grid">
          <thead>
            <tr>
              <th className="data-grid-th">IP Address</th>
              <th className="data-grid-th">Time of session start</th>
            </tr>
          </thead>
          <tbody>
            {sessions.map(s => (
              <tr key={s.id}>
                <td>{s.ip}</td>
                <td>{formatDateTime(s.started)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {/* PIPELINE-016: this used to print the source's success copy while
            slicing a one-element array to one element — a claim of success with
            no state footprint at all. The mock runs a single admin session, so
            there is genuinely nothing to terminate; say so rather than report a
            change that did not happen. */}
        <button type="button" className="action-default scalable"
          onClick={() => {
            const others = sessions.slice(1)
            if (!others.length) {
              addMessage('There are no other open sessions to terminate.', 'notice')
              return
            }
            setSessions(prev => prev.slice(0, 1))
            addMessage('All other open sessions were terminated.')
          }}>
          <span>Log out all other sessions</span>
        </button>
        <p>This computer is using IP address {SESSION_HOST_IP}.</p>
      </div>
    </PageShell>
  )
}
