import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useSidNavigate } from '../../utils/navigation.js'
import { ACL_RESOURCES } from '../../components/system/aclTree.js'
import { TAX_COUNTRY_OPTIONS, TAX_REGION_OPTIONS } from '../../components/system/taxVocabularies.js'
import '../../components/catalog/adminForm.css'
import '../../components/system/system.css'

/**
 * Create/edit forms for the Stores > Taxes and System > Permissions grids
 * (HANDLERS-011, PARITY-010, PIPELINE-006).
 *
 * Every "Add New …" button and every row link on those four grids used to point
 * at a route that was never registered, so the primary affordance of each page
 * landed on the 404 and the seeded `taxConfig` / `adminUsers` / `adminRoles`
 * collections had no writer at all. These forms are the writers: each one goes
 * through `setState`, so the change reaches saveState() -> set_current -> /go.
 *
 * Field sets are the source's, transcribed from the grid columns the source
 * renders (assets/html/admin-user.html, admin-user-role.html) plus the DB
 * columns in assets/data_model.md — the source's own form pages were not part
 * of the HTML capture, so the layout is the admin's standard `admin__fieldset`
 * rather than a pixel copy, and the field set is deliberately limited to what
 * the seed actually carries.
 *
 * HANDLERS-027: the Role Resources tab is no longer a stub. The source's
 * `Resource Access` select (`<select id="all" name="all">` with `Custom` / `All`)
 * and its 263-node ACL tree were scraped off the live role form into
 * `components/system/aclTree.js`, and the selection is saved on the role row.
 */

/* ------------------------------------------------------------------ shared */

function Field({ id, label, required, children }) {
  return (
    <div className="admin__field">
      <label className="admin__field-label" htmlFor={id}>
        <span>{label}</span>
        {required ? <span className="admin__field-required" aria-hidden="true"> *</span> : null}
      </label>
      <div className="admin__field-control">{children}</div>
    </div>
  )
}

function Text({ id, value, onChange, type = 'text' }) {
  return (
    <input id={id} name={id} type={type} className="admin__control-text"
      value={value ?? ''} onChange={e => onChange(e.target.value)} />
  )
}

/**
 * Magento's admin checkbox: an explicit `value` that tracks the state, so
 * `.value` reads `"1"`/`"0"` rather than the browser default `"on"`.
 */
function Checkbox({ id, value, onChange, onValue = '1', offValue = '0' }) {
  const checked = String(value) === onValue
  return (
    <input id={id} name={id} type="checkbox" className="admin__control-checkbox"
      value={checked ? onValue : offValue}
      checked={checked}
      onChange={e => onChange(e.target.checked ? onValue : offValue)} />
  )
}

function Select({ id, value, onChange, options }) {
  return (
    <select id={id} name={id} className="admin__control-select"
      value={value ?? ''} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

/**
 * Back / Delete / Reset / Save row, matching every other admin edit page.
 *
 * `uiPrefix` is the source's `data-ui-id` stem for the page's toolbar
 * (`content-tax-rule-edit`, `adminhtml-rate-toolbar-save-0`,
 * `adminhtml-user-edit`) — Magento puts a `data-ui-id` on every action button
 * and the mock emitted none, so `[data-ui-id=…-save-button]` matched nothing.
 * `onReset` opts the page into the source's Reset button.
 */
function FormActions({
  backTo, onDelete, onSave, onReset, deleteLabel, saveLabel,
  uiPrefix = null, saveAndContinueLabel = null, onSaveAndContinue = null,
  /* Magento derives the hook from the button block's NAME, and the Role edit
     container names its blocks `backButton` / `saveButton` rather than
     `back` / `save` — so that one page's hooks read
     `page-actions-toolbar-backbutton`, with no separator before "button".
     Verified live on /admin/admin/user_role/editrole/rid/1/. */
  uiCompact = false,
  /* Extra source buttons that sit between Reset and Save on a specific form —
     the Admin User form's `#invalidate` ("Force Sign-In"). */
  extraActions = null,
}) {
  const navigate = useSidNavigate()
  const uiId = name => {
    if (uiPrefix == null) return undefined
    const stem = uiCompact ? name.replace(/-/g, '') : name
    return uiPrefix ? `${uiPrefix}-${stem}` : stem
  }
  return (
    <>
      <button type="button" id="back" data-ui-id={uiId('back-button')}
        className="action-default scalable back"
        onClick={() => navigate(backTo)}><span>Back</span></button>
      {onDelete ? (
        <button type="button" id="delete" data-ui-id={uiId('delete-button')}
          className="action-default scalable delete" onClick={onDelete}>
          <span>{deleteLabel}</span>
        </button>
      ) : null}
      {onReset ? (
        <button type="button" id="reset" data-ui-id={uiId('reset-button')}
          className="action-default scalable" onClick={onReset}><span>Reset</span></button>
      ) : null}
      {extraActions}
      {saveAndContinueLabel ? (
        <button type="button" id="save_and_continue" data-ui-id={uiId('save-and-continue-button')}
          className="action-default scalable" onClick={onSaveAndContinue || onSave}>
          <span>{saveAndContinueLabel}</span>
        </button>
      ) : null}
      <button type="button" id="save" data-ui-id={uiId('save-button')}
        className="action-default scalable primary save" onClick={onSave}>
        <span>{saveLabel}</span>
      </button>
    </>
  )
}

function nextId(list, field) {
  return list.reduce((m, r) => Math.max(m, Number(r[field]) || 0), 0) + 1
}

/* --------------------------------------------------- Stores > Tax Zones and Rates */

const BLANK_RATE = {
  code: '', tax_country_id: 'US', tax_region_id: 0, tax_postcode: '*',
  rate: 0, zip_is_range: null, zip_from: null, zip_to: null,
}

/**
 * The source's full Country and State lists (248 / 66), captured off
 * `/admin/tax/rate/add/`. The mock used to offer only `United States` and the
 * three regions its seeded rates happen to use, which is a trimmed real list —
 * the `*` entry's value is `""` on the source, not `"0"`.
 */
const REGIONS = TAX_REGION_OPTIONS

export function TaxRateForm({ isNew = false }) {
  const { id } = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const rates = state?.taxConfig?.rates || []
  const rate = isNew ? null : rates.find(r => String(r.tax_calculation_rate_id) === String(id))
  const [form, setForm] = useState(() => ({ ...BLANK_RATE, ...(rate || {}) }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (!isNew && !rate) {
    return (
      <PageShell title="Tax Zones and Rates">
        <div className="admin__data-grid-empty">This tax rate no longer exists.</div>
      </PageShell>
    )
  }

  function writeRates(fn) {
    setState(prev => ({
      ...prev,
      taxConfig: { ...prev.taxConfig, rates: fn(prev.taxConfig?.rates || []) },
    }))
  }

  function save() {
    if (!String(form.code).trim()) { addMessage('This is a required field.', 'error'); return }
    const record = {
      ...BLANK_RATE, ...form,
      tax_region_id: Number(form.tax_region_id) || 0,
      rate: Number(form.rate) || 0,
    }
    if (rate) {
      writeRates(list => list.map(r =>
        String(r.tax_calculation_rate_id) === String(rate.tax_calculation_rate_id) ? { ...r, ...record } : r))
    } else {
      writeRates(list => [...list, { ...record, tax_calculation_rate_id: nextId(list, 'tax_calculation_rate_id') }])
    }
    addMessage('You saved the tax rate.')
    navigate('/admin/tax/rate/')
  }

  function remove() {
    writeRates(list => list.filter(r => String(r.tax_calculation_rate_id) !== String(rate.tax_calculation_rate_id)))
    addMessage('You deleted the tax rate.')
    navigate('/admin/tax/rate/')
  }

  const actions = (
    <FormActions backTo="/admin/tax/rate/" onSave={save} saveLabel="Save Rate"
      uiPrefix="adminhtml-rate-toolbar-save-0"
      onReset={() => setForm({ ...BLANK_RATE, ...(rate || {}) })}
      onDelete={rate ? remove : null} deleteLabel="Delete Rate" />
  )

  return (
    <PageShell title={rate ? rate.code : 'New Tax Rate'} actions={actions}>
      <form id="tax-rate-form" onSubmit={e => { e.preventDefault(); save() }}>
        <fieldset className="admin__fieldset">
          <Field id="code" label="Tax Identifier" required>
            <Text id="code" value={form.code} onChange={v => set('code', v)} />
          </Field>
          <Field id="tax_country_id" label="Country" required>
            <Select id="tax_country_id" value={form.tax_country_id} onChange={v => set('tax_country_id', v)}
              options={TAX_COUNTRY_OPTIONS} />
          </Field>
          <Field id="tax_region_id" label="State">
            {/* `*` is `""` on the source; the seed stores it as 0. */}
            <Select id="tax_region_id" value={Number(form.tax_region_id) ? String(form.tax_region_id) : ''}
              onChange={v => set('tax_region_id', v)} options={REGIONS} />
          </Field>
          <Field id="tax_postcode" label="Zip/Post Code">
            <Text id="tax_postcode" value={form.tax_postcode} onChange={v => set('tax_postcode', v)} />
          </Field>
          {/* The source's Rate Percent is `<input type="text">`; a `type="number"`
            * box silently rejects `page.fill('#rate','8.375%')`-style input and
            * reads back "" — the NEW-DOM-200 failure mode. */}
          <Field id="rate" label="Rate Percent" required>
            <Text id="rate" value={form.rate} onChange={v => set('rate', v)} />
          </Field>
        </fieldset>
      </form>
    </PageShell>
  )
}

/* ------------------------------------------------------- Stores > Tax Rules */

const BLANK_RULE = { code: '', priority: 0, position: 0, calculate_subtotal: 0 }

export function TaxRuleForm({ isNew = false }) {
  const { id } = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const rules = state?.taxConfig?.rules || []
  const rule = isNew ? null : rules.find(r => String(r.tax_calculation_rule_id) === String(id))
  const [form, setForm] = useState(() => ({ ...BLANK_RULE, ...(rule || {}) }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (!isNew && !rule) {
    return (
      <PageShell title="Tax Rules">
        <div className="admin__data-grid-empty">This tax rule no longer exists.</div>
      </PageShell>
    )
  }

  function writeRules(fn) {
    setState(prev => ({
      ...prev,
      taxConfig: { ...prev.taxConfig, rules: fn(prev.taxConfig?.rules || []) },
    }))
  }

  function save() {
    if (!String(form.code).trim()) { addMessage('This is a required field.', 'error'); return }
    const record = {
      ...BLANK_RULE, ...form,
      priority: Number(form.priority) || 0,
      position: Number(form.position) || 0,
      calculate_subtotal: Number(form.calculate_subtotal) || 0,
    }
    if (rule) {
      writeRules(list => list.map(r =>
        String(r.tax_calculation_rule_id) === String(rule.tax_calculation_rule_id) ? { ...r, ...record } : r))
    } else {
      writeRules(list => [...list, { ...record, tax_calculation_rule_id: nextId(list, 'tax_calculation_rule_id') }])
    }
    addMessage('You saved the tax rule.')
    navigate('/admin/tax/rule/')
  }

  /* The source's Save and Continue Edit persists and stays on the form. */
  function saveAndContinue() {
    if (!String(form.code).trim()) { addMessage('This is a required field.', 'error'); return }
    const record = {
      ...BLANK_RULE, ...form,
      priority: Number(form.priority) || 0,
      position: Number(form.position) || 0,
      calculate_subtotal: Number(form.calculate_subtotal) || 0,
    }
    if (rule) {
      writeRules(list => list.map(r =>
        String(r.tax_calculation_rule_id) === String(rule.tax_calculation_rule_id) ? { ...r, ...record } : r))
    } else {
      writeRules(list => [...list, { ...record, tax_calculation_rule_id: nextId(list, 'tax_calculation_rule_id') }])
    }
    addMessage('You saved the tax rule.')
  }

  function remove() {
    writeRules(list => list.filter(r => String(r.tax_calculation_rule_id) !== String(rule.tax_calculation_rule_id)))
    addMessage('You deleted the tax rule.')
    navigate('/admin/tax/rule/')
  }

  const actions = (
    <FormActions backTo="/admin/tax/rule/" onSave={save} saveLabel="Save Rule"
      uiPrefix="content-tax-rule-edit"
      onReset={() => setForm({ ...BLANK_RULE, ...(rule || {}) })}
      saveAndContinueLabel="Save and Continue Edit" onSaveAndContinue={saveAndContinue}
      onDelete={rule ? remove : null} deleteLabel="Delete Rule" />
  )

  return (
    <PageShell title={rule ? rule.code : 'New Tax Rule'} actions={actions}>
      <form id="tax-rule-form" onSubmit={e => { e.preventDefault(); save() }}>
        <fieldset className="admin__fieldset">
          {/* G-04a. The source names this control `code` with `id="code"`; the
            * mock's invented `rule_code` meant `[name="code"]` — the selector an
            * evaluator derives from the form — matched nothing. */}
          <Field id="code" label="Name" required>
            <Text id="code" value={form.code} onChange={v => set('code', v)} />
          </Field>
          {/* Priority and Sort Order are `type="text"` on the source; a
            * `type="number"` box rejects any non-integer `page.fill()`. */}
          <Field id="priority" label="Priority">
            <Text id="priority" value={form.priority} onChange={v => set('priority', v)} />
          </Field>
          {/* Calculate Off Subtotal Only is an `<input type="checkbox">` on the
            * source, so `page.check('#calculate_subtotal')` used to raise
            * "Not a checkbox or radio button" against the mock's `<select>`. */}
          <Field id="calculate_subtotal" label="Calculate Off Subtotal Only">
            <Checkbox id="calculate_subtotal" value={String(form.calculate_subtotal)}
              onChange={v => set('calculate_subtotal', v)} />
          </Field>
          <Field id="position" label="Sort Order">
            <Text id="position" value={form.position} onChange={v => set('position', v)} />
          </Field>
        </fieldset>
      </form>
    </PageShell>
  )
}

/* -------------------------------------------------- System > Permissions > Users */

const BLANK_USER = {
  firstname: '', lastname: '', email: '', username: '',
  is_active: 1, interface_locale: 'en_US', lognum: 0, logdate: null,
}

function nowStamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export function AdminUserForm({ isNew = false }) {
  const { id } = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const users = state?.adminUsers || []
  const roles = state?.adminRoles || []
  const user = isNew ? null : users.find(u => String(u.user_id) === String(id))

  // A user's group is the role_type='U' row pointing at it; its parent carries
  // the displayed name. Same resolution as the Users grid.
  const membership = user ? roles.find(r => r.role_type === 'U' && String(r.user_id) === String(user.user_id)) : null
  const groups = roles.filter(r => r.role_type === 'G')

  const [form, setForm] = useState(() => ({ ...BLANK_USER, ...(user || {}) }))
  const [roleId, setRoleId] = useState(() => String(membership?.parent_id ?? (groups[0]?.role_id ?? '')))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (!isNew && !user) {
    return (
      <PageShell title="Users">
        <div className="admin__data-grid-empty">This user no longer exists.</div>
      </PageShell>
    )
  }

  function save() {
    if (!String(form.username).trim() || !String(form.email).trim()) {
      addMessage('This is a required field.', 'error')
      return
    }
    const record = { ...BLANK_USER, ...form, is_active: Number(form.is_active), modified: nowStamp() }
    setState(prev => {
      const list = prev.adminUsers || []
      const rolesList = prev.adminRoles || []
      if (user) {
        return {
          ...prev,
          adminUsers: list.map(u => (String(u.user_id) === String(user.user_id) ? { ...u, ...record } : u)),
          // Re-point the membership row at the chosen group.
          adminRoles: rolesList.map(r =>
            (r.role_type === 'U' && String(r.user_id) === String(user.user_id))
              ? { ...r, parent_id: Number(roleId) } : r),
        }
      }
      const newId = nextId(list, 'user_id')
      return {
        ...prev,
        adminUsers: [...list, { ...record, user_id: newId, created: nowStamp() }],
        adminRoles: [...rolesList, {
          role_id: nextId(rolesList, 'role_id'),
          parent_id: Number(roleId),
          tree_level: 2,
          sort_order: 0,
          role_type: 'U',
          user_id: newId,
          user_type: '2',
          role_name: record.username,
        }],
      }
    })
    addMessage('You saved the user.')
    navigate('/admin/admin/user/')
  }

  function remove() {
    setState(prev => ({
      ...prev,
      adminUsers: (prev.adminUsers || []).filter(u => String(u.user_id) !== String(user.user_id)),
      adminRoles: (prev.adminRoles || []).filter(r =>
        !(r.role_type === 'U' && String(r.user_id) === String(user.user_id))),
    }))
    addMessage('You deleted the user.')
    navigate('/admin/admin/user/')
  }

  const actions = (
    <FormActions backTo="/admin/admin/user/" onSave={save} saveLabel="Save User"
      uiPrefix="adminhtml-user-edit"
      /* F-07 — the source's Force Sign-In button, `#invalidate`
         (`data-ui-id="adminhtml-user-edit-invalidate-button"`). It revokes the
         user's other sessions; with no server there is nothing to revoke, so it
         reports the source's own confirmation copy. */
      extraActions={(
        <button type="button" id="invalidate" data-ui-id="adminhtml-user-edit-invalidate-button"
          className="action-default scalable"
          onClick={() => addMessage('You have forced some users to sign in again.')}>
          <span>Force Sign-In</span>
        </button>
      )}
      onReset={() => setForm({ ...BLANK_USER, ...(user || {}) })}
      onDelete={user ? remove : null} deleteLabel="Delete User" />
  )

  return (
    <PageShell title={user ? user.username : 'New User'} actions={actions}>
      <form id="user-form" onSubmit={e => { e.preventDefault(); save() }}>
        <fieldset className="admin__fieldset">
          <legend className="admin__legend"><span>Account Information</span></legend>
          <Field id="username" label="User Name" required>
            <Text id="username" value={form.username} onChange={v => set('username', v)} />
          </Field>
          <Field id="firstname" label="First Name" required>
            <Text id="firstname" value={form.firstname} onChange={v => set('firstname', v)} />
          </Field>
          <Field id="lastname" label="Last Name" required>
            <Text id="lastname" value={form.lastname} onChange={v => set('lastname', v)} />
          </Field>
          <Field id="email" label="Email" required>
            {/* The source's Email row is `<input type="text">`; `type="email"`
              * is a mock invention that changes validation behaviour. */}
            <Text id="email" value={form.email} onChange={v => set('email', v)} />
          </Field>
          <Field id="interface_locale" label="Interface Locale">
            <Select id="interface_locale" value={form.interface_locale}
              onChange={v => set('interface_locale', v)}
              /* The source offers both locales installed on this Magento;
                the mock listed only one — a trimmed real list. */
              options={[
                { value: 'en_GB', label: 'English (United Kingdom)' },
                { value: 'en_US', label: 'English (United States)' },
              ]} />
          </Field>
          <Field id="is_active" label="This account is">
            <Select id="is_active" value={String(form.is_active)} onChange={v => set('is_active', v)}
              options={[{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }]} />
          </Field>
        </fieldset>
        <fieldset className="admin__fieldset">
          <legend className="admin__legend"><span>User Role</span></legend>
          <Field id="user_role" label="Role">
            <Select id="user_role" value={roleId} onChange={setRoleId}
              options={groups.map(g => ({ value: String(g.role_id), label: g.role_name }))} />
          </Field>
        </fieldset>
      </form>
    </PageShell>
  )
}

/* -------------------------------------------------- System > Permissions > Roles */

const BLANK_ROLE = {
  parent_id: 0, tree_level: 1, sort_order: 0, role_type: 'G', user_id: 0,
  user_type: '2', role_name: '',
  // Magento's `authorization_rule` rows, flattened onto the role: `gws_is_all`
  // is the source's `all` select, `resources` the checked ACL ids.
  gws_is_all: '1', resources: [],
}

export function AdminRoleForm() {
  // The source uses one route for both create and edit: `/editrole/` with no
  // `rid` is the create form, `/editrole/rid/:id/` the edit form.
  const { id } = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const roles = state?.adminRoles || []
  const role = id ? roles.find(r => String(r.role_id) === String(id)) : null
  const [form, setForm] = useState(() => ({ ...BLANK_ROLE, ...(role || {}) }))
  const [tab, setTab] = useState('info')
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (id && !role) {
    return (
      <PageShell title="Roles">
        <div className="admin__data-grid-empty">This role no longer exists.</div>
      </PageShell>
    )
  }

  function save() {
    if (!String(form.role_name).trim()) { addMessage('This is a required field.', 'error'); return }
    const record = { ...BLANK_ROLE, ...form, sort_order: Number(form.sort_order) || 0 }
    setState(prev => {
      const list = prev.adminRoles || []
      if (role) {
        return { ...prev, adminRoles: list.map(r => (String(r.role_id) === String(role.role_id) ? { ...r, ...record } : r)) }
      }
      return { ...prev, adminRoles: [...list, { ...record, role_id: nextId(list, 'role_id') }] }
    })
    addMessage('You saved the role.')
    navigate('/admin/admin/user_role/')
  }

  function remove() {
    setState(prev => ({
      ...prev,
      adminRoles: (prev.adminRoles || []).filter(r => String(r.role_id) !== String(role.role_id)),
    }))
    addMessage('You deleted the role.')
    navigate('/admin/admin/user_role/')
  }

  const actions = (
    <FormActions backTo="/admin/admin/user_role/" onSave={save} saveLabel="Save Role"
      uiPrefix="page-actions-toolbar" uiCompact
      onReset={() => setForm({ ...BLANK_ROLE, ...(role || {}) })}
      onDelete={role ? remove : null} deleteLabel="Delete Role" />
  )

  return (
    <PageShell title={role ? role.role_name : 'New Role'} actions={actions}>
      <div className="admin-form-columns">
        <div className="admin-form-columns__nav">
          <ul className="admin__page-nav-items">
            <li className={`admin__page-nav-item ${tab === 'info' ? '_active' : ''}`}>
              <button type="button" className="admin__page-nav-link" onClick={() => setTab('info')}>
                Role Info
              </button>
            </li>
            <li className={`admin__page-nav-item ${tab === 'resources' ? '_active' : ''}`}>
              <button type="button" className="admin__page-nav-link" onClick={() => setTab('resources')}>
                Role Resources
              </button>
            </li>
          </ul>
        </div>
        <div className="admin-form-columns__body">
          {tab === 'info' ? (
            <form id="role-edit-form" onSubmit={e => { e.preventDefault(); save() }}>
              <fieldset className="admin__fieldset">
                <legend className="admin__legend"><span>Role Information</span></legend>
                <Field id="role_name" label="Role Name" required>
                  <Text id="role_name" value={form.role_name} onChange={v => set('role_name', v)} />
                </Field>
                <Field id="sort_order" label="Sort Order">
                  <Text id="sort_order" type="number" value={form.sort_order} onChange={v => set('sort_order', v)} />
                </Field>
              </fieldset>
            </form>
          ) : (
            <fieldset className="admin__fieldset">
              <legend className="admin__legend"><span>Role Resources</span></legend>
              <Field id="all" label="Resource Access">
                {/* Source: <select id="all" name="all"> — Custom (0) / All (1). */}
                <Select id="all" value={String(form.gws_is_all ?? '1')}
                  onChange={v => setForm(f => ({
                    ...f,
                    gws_is_all: v,
                    // `All` is the wildcard, as in Magento's own
                    // `Magento_Backend::all` rule — the id list is only
                    // meaningful under Custom, so it is cleared here rather than
                    // written out 263 rows deep into state.
                    resources: v === '1' ? [] : (f.resources || []),
                  }))}
                  options={[{ value: '0', label: 'Custom' }, { value: '1', label: 'All' }]} />
              </Field>
              {String(form.gws_is_all ?? '1') === '0' ? (
                <div className="acl-tree" id="rolesTree" role="tree">
                  {ACL_RESOURCES.map(r => (
                    <div className="acl-tree__node" key={r.id} role="treeitem"
                      aria-level={r.level + 1} style={{ paddingLeft: `${r.level * 20}px` }}>
                      <label className="acl-tree__label">
                        <input type="checkbox" className="admin__control-checkbox"
                          value={r.id}
                          checked={(form.resources || []).includes(r.id)}
                          onChange={e => setForm(f => ({
                            ...f,
                            resources: e.target.checked
                              ? [...new Set([...(f.resources || []), r.id])]
                              : (f.resources || []).filter(x => x !== r.id),
                          }))} />
                        <span>{r.label}</span>
                      </label>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="admin__field-note">
                  This role has access to all resources.
                </p>
              )}
            </fieldset>
          )}
        </div>
      </div>
    </PageShell>
  )
}
