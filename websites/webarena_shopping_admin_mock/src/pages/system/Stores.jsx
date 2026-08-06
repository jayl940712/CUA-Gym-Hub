import React, { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import LegacyAdminGrid from '../../components/grid/LegacyAdminGrid.jsx'
import RecordForm from '../../components/system/RecordForm.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useSidNavigate } from '../../utils/navigation.js'
import '../../components/system/system.css'

/**
 * Stores > All Stores / Currency — ROUTES rows 112, 115, 116.
 * All three read `systemConfig.json` (`store_website` / `store_group` / `store`
 * and `directory_currency_rate`), which is a full-copy collection in state, so
 * a rate or symbol edit shows up in /go's state_diff.
 */

/* ------------------------------------------------------------ All Stores (112) */

export function AllStores() {
  const { state } = useApp()
  const navigate = useSidNavigate()

  const rows = useMemo(() => {
    const cfg = state?.systemConfig || {}
    const websites = (cfg.websites || []).filter(w => w.code !== 'admin')
    const groups = cfg.store_groups || []
    return (cfg.stores || []).filter(s => s.code !== 'admin').map(s => {
      const g = groups.find(x => x.group_id === s.group_id)
      const w = websites.find(x => x.website_id === s.website_id)
      return {
        store_id: s.store_id,
        website_id: w?.website_id,
        group_id: g?.group_id,
        website_name: w?.name || '',
        group_name: g?.name || '',
        store_name: s.name,
        /* Round 10 — the source prints the record's own code after the name,
           e.g. `Main Website(Code: base)`. Codes come straight from the seed. */
        website_code: w?.code || '',
        group_code: g?.code || '',
        store_code: s.code || '',
      }
    })
  }, [state])

  const columns = [
    {
      id: 'website_name', label: 'Web Site', filterType: 'text', filterName: 'website_title',
      render: r => (
        <>
          <AdminLink to={`/admin/admin/system_store/editWebsite/website_id/${r.website_id}/`}>{r.website_name}</AdminLink>
          <br />(Code: {r.website_code})
        </>
      ),
      exportValue: r => r.website_name,
    },
    {
      id: 'group_name', label: 'Store', filterType: 'text', filterName: 'group_title',
      render: r => (
        <>
          <AdminLink to={`/admin/admin/system_store/editGroup/group_id/${r.group_id}/`}>{r.group_name}</AdminLink>
          <br />(Code: {r.group_code})
        </>
      ),
      exportValue: r => r.group_name,
    },
    {
      id: 'store_name', label: 'Store View', filterType: 'text', filterName: 'store_title',
      render: r => (
        <>
          <AdminLink to={`/admin/admin/system_store/editStore/store_id/${r.store_id}/`}>{r.store_name}</AdminLink>
          <br />(Code: {r.store_code})
        </>
      ),
      exportValue: r => r.store_name,
    },
  ]

  const actions = (
    /* F-07 — the source's three buttons, in its own order, with its ids and
       `data-ui-id="adminhtml-system-store-container-<id>-button"` (derived by
       PageShell from the id + actionsUiPrefix):
         #add        Create Website   (primary)
         #add_store  Create Store View
         #add_group  Create Store                                          */
    <>
      <button type="button" id="add" title="Create Website"
        className="action-default scalable add primary"
        onClick={() => navigate('/admin/admin/system_store/newWebsite/')}>
        <span>Create Website</span>
      </button>
      <button type="button" id="add_store" title="Create Store View"
        className="action-default scalable add add-store-view"
        onClick={() => navigate('/admin/admin/system_store/newStore/')}>
        <span>Create Store View</span>
      </button>
      <button type="button" id="add_group" title="Create Store"
        className="action-default scalable add add-store"
        onClick={() => navigate('/admin/admin/system_store/newGroup/')}>
        <span>Create Store</span>
      </button>
    </>
  )

  return (
    <PageShell title="Stores" actions={actions}
      actionsUiPrefix="adminhtml-system-store-container-">
      {/* Round 10. LEGACY on the source. */}
      <LegacyAdminGrid legacyToolbarBase={0} gridId="storeGrid"
        basePath="/admin/admin/system_store/index" rows={rows} columns={columns} rowKey={r => r.store_id}
        exportable={false} exportFileName="stores" />
    </PageShell>
  )
}

/* -------------------------------------------------------- Currency Rates (115) */

export function CurrencyRates() {
  const { state, setState, addMessage } = useApp()
  const rates = state?.systemConfig?.currency_rates || []
  const allowed = String((state?.coreConfig || [])
    .find(c => c.path === 'currency/options/allow')?.value || 'USD').split(',').filter(Boolean)
  const base = String((state?.coreConfig || [])
    .find(c => c.path === 'currency/options/base')?.value || 'USD')
  const bases = [...new Set([base, ...rates.map(r => r.currency_from)])].filter(c => allowed.includes(c) || c === base)

  const [draft, setDraft] = useState(() => {
    const d = {}
    for (const r of rates) d[`${r.currency_from}_${r.currency_to}`] = String(r.rate)
    return d
  })

  // HANDLERS-030 — `rate_services` was an uncontrolled `defaultValue` select, so
  // the chosen import service was lost on any re-render of this page.
  const [rateService, setRateService] = useState('fixerio')

  function save() {
    setState(prev => ({
      ...prev,
      systemConfig: {
        ...prev.systemConfig,
        currency_rates: (prev.systemConfig?.currency_rates || []).map(r => {
          const key = `${r.currency_from}_${r.currency_to}`
          return draft[key] === undefined ? r : { ...r, rate: Number(draft[key]) }
        }),
      },
    }))
    addMessage('All valid rates have been saved.')
  }

  const actions = (
    <>
      <button type="button" id="import" title="Import"
        data-ui-id="adminhtml-system-currency-0-import-button"
        className="action-default scalable"
        onClick={() => addMessage('Import service is not configured.', 'error')}><span>Import</span></button>
      <button type="button" id="save" title="Save Currency Rates"
        data-ui-id="page-actions-toolbar-save-button"
        className="action-default scalable primary save" onClick={save}>
        <span>Save Currency Rates</span>
      </button>
    </>
  )

  return (
    <PageShell title="Currency Rates" actions={actions}>
      <div className="currency-rate-service">
        <label className="admin__field-label" htmlFor="rate_services"><span>Import Service</span></label>
        <select id="rate_services" name="rate_services" className="admin__control-select"
          value={rateService} onChange={e => setRateService(e.target.value)}>
          {/* F-05 — source labels verbatim. */}
          <option value="fixerio">Fixer.io (legacy)</option>
          <option value="fixerio_apilayer">Fixer Api (APILayer)</option>
          <option value="currencyconverterapi">Currency Converter API</option>
        </select>
      </div>
      <table className="data-grid currency-rate-grid">
        <thead>
          <tr>
            <th className="data-grid-th" />
            {allowed.map(c => <th key={c} className="data-grid-th">{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {bases.map(from => (
            <tr key={from}>
              <th className="data-grid-th">{from}</th>
              {allowed.map(to => {
                const key = `${from}_${to}`
                const known = rates.some(r => `${r.currency_from}_${r.currency_to}` === key)
                return (
                  <td key={to}>
                    {known ? (
                      <input type="text" className="admin__control-text" name={`rate[${from}][${to}]`}
                        aria-label={`${from} to ${to} rate`}
                        value={draft[key] ?? ''} onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))} />
                    ) : <span className="currency-rate-na">N/A</span>}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  )
}

/* ------------------------------------------------------ Currency Symbols (116) */

const CURRENCY_NAMES = { USD: 'US Dollar', EUR: 'Euro' }
const STANDARD_SYMBOL = { USD: '$', EUR: '€' }

export function CurrencySymbols() {
  const { state, setState, addMessage } = useApp()
  const allowed = String((state?.coreConfig || [])
    .find(c => c.path === 'currency/options/allow')?.value || 'USD').split(',').filter(Boolean)
  const stored = state?.systemConfig?.currency_symbols || {}

  const [draft, setDraft] = useState(() => {
    const d = {}
    for (const c of allowed) {
      d[c] = { symbol: stored[c] ?? STANDARD_SYMBOL[c] ?? c, useDefault: stored[c] === undefined }
    }
    return d
  })

  function save() {
    const next = {}
    for (const [code, v] of Object.entries(draft)) {
      if (!v.useDefault) next[code] = v.symbol
    }
    setState(prev => ({
      ...prev,
      systemConfig: { ...prev.systemConfig, currency_symbols: next },
    }))
    addMessage('You applied the custom currency symbols.')
  }

  const actions = (
    <button type="button" id="save" title="Save Currency Symbols"
      data-ui-id="page-actions-toolbar-save-button"
      className="action-default scalable primary save" onClick={save}>
      <span>Save Currency Symbols</span>
    </button>
  )

  return (
    <PageShell title="Currency Symbols" actions={actions}>
      <form id="currency-symbols-form" onSubmit={e => { e.preventDefault(); save() }}>
        <fieldset className="admin__fieldset">
          <legend className="admin__legend"><span>Currency</span></legend>
          {allowed.map(code => (
            <div className="admin__field" key={code}>
              <label className="admin__field-label" htmlFor={`custom_currency_symbol${code}`}>
                <span>{code} ({CURRENCY_NAMES[code] || code})</span>
              </label>
              <div className="admin__field-control">
                <input id={`custom_currency_symbol${code}`} name={`custom_currency_symbol[${code}]`} type="text"
                  className="admin__control-text" value={draft[code]?.symbol ?? ''}
                  disabled={draft[code]?.useDefault}
                  onChange={e => setDraft(d => ({ ...d, [code]: { ...d[code], symbol: e.target.value } }))} />
                <label className="admin__field-service" htmlFor={`inherit_custom_currency_symbol${code}`}>
                  <input id={`inherit_custom_currency_symbol${code}`} type="checkbox" className="admin__control-checkbox"
                    value="1"
                    checked={draft[code]?.useDefault ?? true}
                    onChange={e => setDraft(d => ({
                      ...d,
                      [code]: {
                        useDefault: e.target.checked,
                        symbol: e.target.checked ? (STANDARD_SYMBOL[code] ?? code) : d[code].symbol,
                      },
                    }))} />
                  <span>Use Standard</span>
                </label>
              </div>
            </div>
          ))}
        </fieldset>
      </form>
    </PageShell>
  )
}

/* ------------------------------- store-hierarchy create/edit forms (HANDLERS-011) */

/**
 * `newWebsite` / `newGroup` / `newStore` and their `edit*` siblings used to
 * re-render the All Stores grid. Labels read off the live source:
 *
 * - New Web Site  — legend `Web Site Information`; `Name`, `Code`, `Sort Order`;
 *   primary button `Save Web Site`
 * - New Store     — legend `Store Information`; `Web Site`, `Name`, `Code`,
 *   `Root Category`; primary `Save Store`
 * - New Store View— legend `Store View Information`; `Store`, `Name`, `Code`,
 *   `Status`, `Sort Order`; primary `Save Store View`
 *
 * The source's H1 on all six is `Stores`; the menu path is what differs, so the
 * `documentTitle` carries the specific one.
 *
 * All three write back into `state.systemConfig.{websites,store_groups,stores}`,
 * the same collections `AllStores` renders from.
 */
function StoreHierarchyForm({ kind }) {
  const { id } = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const cfg = state?.systemConfig || {}
  const backTo = '/admin/admin/system_store/'

  const spec = {
    website: {
      collection: 'websites', idField: 'website_id',
      legend: 'Web Site Information', save: 'Save Web Site',
      docTitle: id ? 'Edit Web Site' : 'New Web Site',
      okMessage: 'You saved the website.', delMessage: 'You deleted the website.',
    },
    group: {
      collection: 'store_groups', idField: 'group_id',
      legend: 'Store Information', save: 'Save Store',
      docTitle: id ? 'Edit Store' : 'New Store',
      okMessage: 'You saved the store.', delMessage: 'You deleted the store.',
    },
    store: {
      collection: 'stores', idField: 'store_id',
      legend: 'Store View Information', save: 'Save Store View',
      docTitle: id ? 'Edit Store View' : 'New Store View',
      okMessage: 'You saved the store view.', delMessage: 'You deleted the store view.',
    },
  }[kind]

  const list = cfg[spec.collection] || []
  const existing = id ? list.find(r => String(r[spec.idField]) === String(id)) : null

  /* Magento's store-hierarchy selects exclude the Admin scope row on every
   * one of these forms (`website_id`/`group_id`/`store_id` 0), the way the
   * website list already did. Including it added a mock-only `Default` /
   * `Admin` option to four selects. */
  const websiteOptions = (cfg.websites || []).filter(w => w.code !== 'admin')
    .map(w => ({ value: String(w.website_id), label: w.name }))
  const groupOptions = (cfg.store_groups || []).filter(g => Number(g.group_id) !== 0)
    .map(g => ({ value: String(g.group_id), label: g.name }))
  const storeViewOptions = (cfg.stores || []).filter(v => Number(v.store_id) !== 0)
    .map(v => ({ value: String(v.store_id), label: v.name }))
  /* The source's Root Category select leads with a blank prompt. */
  const rootCategoryOptions = [
    { value: '', label: '-- Please Select a Category --' },
    { value: '2', label: 'Default Category' },
  ]

  /**
   * G-04b. Every control on these three forms used to be named for the bare
   * column (`name`, `code`, `is_active`) with a mock-invented `#rf_*` id, so
   * `[name="store[name]"]` and `#store_name` — the selectors the source
   * actually exposes and an evaluator would use — resolved to nothing. `field`
   * is the record column; `name`/`id` are the source's verbatim DOM vocabulary.
   *
   * Read off the live source this round (`store_id/1`, `group_id/1`,
   * `website_id/1`): `store[…]`/`#store_*`, `group[…]`/`#group_*`,
   * `website[…]`/`#website_*`, plus the hidden mirrors and the
   * `store_type` / `store_action` pair Magento posts alongside.
   */
  const p = kind // 'website' | 'group' | 'store'
  const f = (field, label, extra = {}) => ({
    field,
    name: `${p}[${field}]`,
    id: `${p}_${field}`,
    label,
    ...extra,
  })

  const fields = kind === 'website' ? [
    f('name', 'Name', { required: true }),
    f('code', 'Code', { required: true }),
    f('sort_order', 'Sort Order'),
    {
      ...f('default_group_id', 'Default Store', { type: 'select' }),
      options: groupOptions,
    },
    { ...f('is_default', ''), type: 'hidden', id: 'is_default' },
    f('website_id', '', { type: 'hidden' }),
  ] : kind === 'group' ? [
    { ...f('website_id', 'Web Site', { type: 'select' }), options: websiteOptions },
    ...(existing ? [{ field: 'website_id', name: 'group[website_id]', id: 'group_hidden_website_id', type: 'hidden', label: '' }] : []),
    f('name', 'Name', { required: true }),
    f('code', 'Code', { required: true }),
    {
      ...f('root_category_id', 'Root Category', { type: 'select' }),
      options: rootCategoryOptions,
    },
    {
      ...f('default_store_id', 'Default Store View', { type: 'select' }),
      options: storeViewOptions,
    },
    f('group_id', '', { type: 'hidden' }),
  ] : [
    { ...f('group_id', 'Store', { type: 'select' }), options: groupOptions },
    ...(existing ? [{ field: 'group_id', name: 'store[original_group_id]', id: 'store_original_group_id', type: 'hidden', label: '' }] : []),
    f('name', 'Name', { required: true }),
    f('code', 'Code', { required: true }),
    {
      ...f('is_active', 'Status', { type: 'select' }),
      /* Source order is Disabled, Enabled. */
      options: [{ value: '0', label: 'Disabled' }, { value: '1', label: 'Enabled' }],
    },
    ...(existing ? [{ field: 'is_active', name: 'store[is_active]', id: 'store_is_active_hidden', type: 'hidden', label: '' }] : []),
    f('sort_order', 'Sort Order'),
    f('is_default', '', { type: 'hidden' }),
    f('store_id', '', { type: 'hidden' }),
  ]

  /* The two bare hidden inputs Magento posts on all three forms. */
  const metaFields = [
    { field: null, name: 'store_type', id: 'store_type', type: 'hidden', label: '' },
    { field: null, name: 'store_action', id: 'store_action', type: 'hidden', label: '' },
  ]
  const allFields = [...fields, ...metaFields]

  const initial = Object.fromEntries(allFields.map(fl => {
    if (fl.name === 'store_type') return [fl.name, kind]
    if (fl.name === 'store_action') return [fl.name, existing ? 'edit' : 'add']
    const v = fl.field ? existing?.[fl.field] : undefined
    if (v !== undefined && v !== null) return [fl.name, String(v)]
    if (fl.type === 'select') return [fl.name, fl.options[0]?.value ?? '']
    return [fl.name, fl.field === 'sort_order' ? '0' : '']
  }))

  function write(patch) {
    setState(prev => {
      const c = prev.systemConfig || {}
      const rows = c[spec.collection] || []
      const next = existing
        ? rows.map(r => (String(r[spec.idField]) === String(existing[spec.idField]) ? { ...r, ...patch } : r))
        : [...rows, {
          [spec.idField]: rows.reduce((m, r) => Math.max(m, Number(r[spec.idField]) || 0), 0) + 1,
          ...patch,
        }]
      return { ...prev, systemConfig: { ...c, [spec.collection]: next } }
    })
  }

  return (
    <RecordForm
      title="Stores"
      documentTitle={spec.docTitle}
      legend={spec.legend}
      backTo={backTo}
      uiPrefix="system-store-edit-0"
      saveLabel={spec.save}
      deleteLabel="Delete"
      initial={initial}
      fields={allFields}
      onDelete={existing ? () => {
        setState(prev => {
          const c = prev.systemConfig || {}
          return {
            ...prev,
            systemConfig: {
              ...c,
              [spec.collection]: (c[spec.collection] || [])
                .filter(r => String(r[spec.idField]) !== String(id)),
            },
          }
        })
        addMessage(spec.delMessage)
        navigate(backTo)
      } : null}
      onSave={form => {
        /* The form is keyed by the source's DOM names (`store[name]`); map it
         * back onto the record columns before writing. Hidden mirrors share a
         * `field` with their visible twin, so the visible one (listed first)
         * wins and the mirror is skipped. */
        const patch = {}
        for (const fl of fields) {
          if (!fl.field || patch[fl.field] !== undefined) continue
          patch[fl.field] = form[fl.name]
        }
        for (const k of ['website_id', 'group_id', 'root_category_id', 'sort_order', 'is_active',
          'default_group_id', 'default_store_id']) {
          if (patch[k] !== undefined && patch[k] !== '') patch[k] = Number(patch[k]) || 0
        }
        delete patch[spec.idField]
        // HANDLERS-033: the group form's Web Site select is bound and editable,
        // and `system_store/editGroup` really does allow reassigning a store
        // group to another website — so let the chosen value through rather
        // than overwriting it with the record's current one and then reporting
        // a save.
        write(patch)
        addMessage(spec.okMessage)
        navigate(backTo)
      }}
    />
  )
}

export function WebsiteForm() { return <StoreHierarchyForm kind="website" /> }
export function StoreGroupForm() { return <StoreHierarchyForm kind="group" /> }
export function StoreViewForm() { return <StoreHierarchyForm kind="store" /> }
