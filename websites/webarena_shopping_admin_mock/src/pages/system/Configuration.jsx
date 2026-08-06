import React, { useEffect, useMemo, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { withGridParams } from '../../utils/gridUtils.js'
import { CONFIG_TABS, SECTION_LABELS, CONFIG_FIELDS, configPath, pathLeafLabel } from '../../components/system/configSections.js'
import { TIME_HOUR_OPTIONS, TIME_MINSEC_OPTIONS } from '../../components/system/currencyVocabularies.js'
import '../../components/catalog/adminForm.css'
import '../../components/system/system.css'

/**
 * Stores > Settings > Configuration — ROUTES rows 113-114.
 *
 * `/admin/admin/system_config/` and `/edit/section/:section/` are the same
 * screen; the path param selects the section, exactly as in the source (bare
 * `system_config` shows `general`). Every field that has a `core_config_data`
 * row is editable and writes back to `state.coreConfig`, so a config change is
 * visible in /go's state_diff.
 */

/* DOM-214 — `groups[<g>][fields][<f>][value]` → `…[inherit]`, the name the
 * source gives the "Use system value" checkbox next to each inheritable
 * field. */
/** The source's scope switcher entries, in its order. */
const SCOPES = [
  { value: 'default', label: 'Default Config' },
  { value: 'website_1', label: 'Main Website' },
  { value: 'store_1', label: 'Default Store View' },
]

/* Per-section action buttons the source renders alongside its config fields.
 * Verified live on each section this round. */
const SECTION_BUTTONS = {
  general: [{
    id: 'general_store_information_validate_vat_number', label: 'Validate VAT Number',
    className: 'action-validate-vat',
    message: 'The VAT ID cannot be validated. The service is not available.', messageType: 'error',
  }],
  catalog: [
    { id: 'catalog_search_elasticsearch5_test_connect_wizard', label: 'Test Connection', className: 'scalable' },
    { id: 'catalog_search_elasticsearch7_test_connect_wizard', label: 'Test Connection', className: 'scalable' },
    { id: 'catalog_search_opensearch_test_connect_wizard', label: 'Test Connection', className: 'scalable' },
  ].map(b => ({ ...b, message: 'Connection failed. The search engine is not reachable.', messageType: 'error' })),
  cms: [{
    id: 'cms_pagebuilder_google_maps_api_key_validator', label: 'Test Key', className: 'scalable',
    message: 'The Google Maps API key could not be validated.', messageType: 'error',
  }],
  system: [
    { id: 'system_full_page_cache_varnish_export_button_version4', label: 'Export VCL for Varnish 4' },
    { id: 'system_full_page_cache_varnish_export_button_version5', label: 'Export VCL for Varnish 5' },
    { id: 'system_full_page_cache_varnish_export_button_version6', label: 'Export VCL for Varnish 6' },
  ].map((b, i) => ({
    ...b, className: 'action-default scalable',
    /* Anonymous `Widget\Button` blocks, so Magento falls back to
       `widget-button-<n>` in layout order: the three Varnish exports, then
       Synchronize. Measured live on section/system. */
    uiId: `widget-button-${i}`,
    message: 'The VCL file can only be exported from a Varnish-backed deployment.',
  })).concat([{
    /* F-04 sweep — this button was `disabled`, so `page.click()` RAISED on the
       mock. The source only *starts* disabled: `Magento_Ui/js/form/button`
       re-enables it once the page settles (measured at 1.5s: `disabled` + class
       `…scalable disabled`; at 3s: enabled, class `action-default scalable`).
       An evaluator always sees the settled state, so the mock renders the
       settled state. It reports the same failure the source's AJAX call
       reports with no Adobe/analytics endpoint configured, rather than
       pretending a sync happened. */
    id: 'synchronize_button', label: 'Synchronize', className: 'action-default scalable',
    uiId: 'widget-button-3',
    message: 'Synchronization failed. The analytics service is not reachable.', messageType: 'error',
  }, {
    /* The source's Adobe Stock button carries only the container-derived
       `data-ui-id` and no `id` at all. */
    id: null, uiId: 'adobe-stock-integration-buttons-test-connection',
    label: 'Test Connection', className: 'action-default scalable',
    message: 'Connection failed. Adobe Stock is not reachable.', messageType: 'error',
  }]),
}

function inheritName(f) {
  return String(f.name || '').replace(/\[value\](\[\])?$/, '[inherit]')
}

export default function Configuration() {
  const { section: sectionParam } = useParams()
  const section = sectionParam || 'general'
  const { state, setState, addMessage } = useApp()
  const [searchParams, setSearchParams] = useSearchParams()
  const scope = searchParams.get('store') ? 'store_1'
    : searchParams.get('website') ? 'website_1' : 'default'
  const [scopeOpen, setScopeOpen] = useState(false)

  const dbRows = useMemo(
    () => (state?.coreConfig || []).filter(c => String(c.path).split('/')[0] === section),
    [state, section])

  /**
   * F-04 — the paths this section has a `core_config_data` row for.
   *
   * This is the whole rule Magento uses to decide the "Use system value"
   * checkbox: a field is INHERITED (box checked, control `disabled`) exactly
   * when it has NO row at the current scope, and OVERRIDDEN (box unchecked,
   * control enabled) as soon as it does. The mock had it inverted — every
   * `inherit: true` field defaulted to checked regardless of the seed — so the
   * 8 `admin/*` rows in `coreConfig.json` rendered `disabled` while the source
   * renders them enabled. `fill()`/`select_option()` RAISE on a disabled
   * element, so that aborted an evaluator's whole run rather than merely
   * producing a wrong answer.
   *
   * Verified against the live source on all 12 sections that own a seed row
   * (admin, analytics, carriers, catalog, currency, design, general,
   * msp_securitysuite_recaptcha, sales, system, web): every one of them is
   * enabled there, and every one whose group also renders a checkbox has it
   * unchecked. Deriving it from the seed rather than hand-flagging each field
   * is why the round-7 currency fix never generalised.
   */
  const dbPaths = useMemo(() => new Set(dbRows.map(c => c.path)), [dbRows])

  const captured = CONFIG_FIELDS[section] || null

  /** path -> current value, seeded from the DB then edited locally until Save. */
  const initialDraft = useMemo(() => {
    const d = {}
    for (const row of dbRows) d[row.path] = row.value ?? ''
    if (captured) {
      for (const g of captured) {
        for (const f of g.fields) {
          const key = configPath(f)
          if (d[key] === undefined) d[key] = f.value ?? ''
        }
      }
    }
    return d
  }, [dbRows, captured])

  const [draft, setDraft] = useState(initialDraft)
  /** path -> is the field still inheriting the system value (HANDLERS-032). */
  const [inherit, setInherit] = useState({})
  const [openTab, setOpenTab] = useState(() => (
    CONFIG_TABS.find(t => t.sections.some(([code]) => code === section))?.label || 'General'))

  useEffect(() => { setDraft(initialDraft); setInherit({}) }, [initialDraft])
  useEffect(() => {
    const tab = CONFIG_TABS.find(t => t.sections.some(([code]) => code === section))
    if (tab) setOpenTab(tab.label)
  }, [section])

  const set = (key, value) => setDraft(d => ({ ...d, [key]: value }))

  /**
   * HANDLERS-029 / PIPELINE-019: Magento writes a `core_config_data` row the
   * first time a config.xml default is overridden, so a field with no seeded
   * row must be able to create one. Existing rows are patched in place; edited
   * fields that have no row yet are appended (only when the value actually
   * changed, to keep the /go diff to what the agent touched).
   *
   * Every editable descriptor resolves to a real path via `configPath()`, so
   * there is no longer a class of field that reports success and writes
   * nothing. If a save would touch no row at all, say so instead of claiming
   * one — a message with an empty state footprint is worse than no message.
   */
  function saveConfig() {
    const rows = state?.coreConfig || []
    const known = new Set(rows.map(c => c.path))
    let nextId = rows.reduce((m, c) => Math.max(m, Number(c.config_id) || 0), 0)
    const added = []
    for (const [path, value] of Object.entries(draft)) {
      if (known.has(path)) continue
      if (value === (initialDraft[path] ?? '')) continue
      added.push({ config_id: ++nextId, scope: 'default', scope_id: 0, path, value })
    }
    const patched = rows.map(c => (Object.prototype.hasOwnProperty.call(draft, c.path)
      ? { ...c, value: draft[c.path] } : c))
    const changed = added.length > 0 || patched.some((c, i) => c.value !== rows[i].value)
    if (!changed) {
      addMessage('There is nothing to save — no field on this page was changed.', 'notice')
      return
    }
    setState(prev => ({ ...prev, coreConfig: [...patched, ...added] }))
    addMessage('You saved the configuration.')
  }

  const actions = (
    <button type="button" id="save" data-ui-id="page-actions-toolbar-save-button"
      className="action-default scalable primary save" onClick={saveConfig}>
      <span>Save Config</span>
    </button>
  )

  return (
    <PageShell title="Configuration" actions={actions}>
      {/* HANDLERS-009: the scope select is controlled and writes `?section=`'s
          companion `store`/`website` param, exactly as the source's scope
          switcher does, so the choice survives a reload and a deep link.
          `withGridParams` rebuilds the whole search string, so `sid` rides
          along. The single-store seed renders the same values at every scope —
          the URL is what has to move. */}
      {/* F-07 — the source's scope switcher is NOT a <select>: it is
          `<button id="store-change-button" class="admin__action-dropdown">`
          over a `.dropdown-menu` of scope links, with two hidden inputs
          (`store_switcher`, `store_group_switcher`) carrying the posted scope.
          `page.click('#store-change-button')` raised on all 39 config sections
          while this was a select. Behaviour is unchanged: picking a scope still
          writes `?website=`/`?store=` and `sid` rides along via
          `withGridParams`. */}
      <div className={`store-switcher admin__scope-old${scopeOpen ? ' _active' : ''}`}>
        <span className="admin__field-label"><strong>Store View:</strong></span>
        <input type="hidden" id="store_switcher" name="store_switcher"
          value={scope === 'store_1' ? '1' : ''} readOnly />
        <input type="hidden" id="store_group_switcher" name="store_group_switcher" value="" readOnly />
        <button type="button" id="store-change-button" className="admin__action-dropdown"
          aria-expanded={scopeOpen} onClick={() => setScopeOpen(o => !o)}>
          {SCOPES.find(sc => sc.value === scope)?.label}
        </button>
        {scopeOpen ? (
          <ul className="dropdown-menu admin__action-dropdown-menu">
            {SCOPES.map(sc => (
              <li key={sc.value} className={sc.value === scope ? '_active' : ''}>
                <button type="button" className="admin__action-dropdown-item"
                  onClick={() => {
                    setScopeOpen(false)
                    setSearchParams(withGridParams(searchParams, {
                      website: sc.value === 'website_1' ? '1' : null,
                      store: sc.value === 'store_1' ? '1' : null,
                    }))
                  }}>{sc.label}</button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      <div className="config-layout">
        <nav className="admin__page-nav" aria-label="Configuration sections">
          {CONFIG_TABS.map(tab => (
            <div key={tab.label} className={`admin__page-nav-item-tab${openTab === tab.label ? ' _active' : ''}`}>
              <div className="admin__page-nav-title title _collapsible" data-role="title" role="button" tabIndex={0}
                onClick={() => setOpenTab(t => (t === tab.label ? '' : tab.label))}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenTab(t => (t === tab.label ? '' : tab.label)) } }}
                aria-expanded={openTab === tab.label}>
                <strong>{tab.label}</strong>
              </div>
              {openTab === tab.label ? (
                <ul className="admin__page-nav-items">
                  {tab.sections.map(([code, label]) => (
                    <li key={code} className={`admin__page-nav-item${code === section ? ' _active' : ''}`}>
                      <AdminLink className="admin__page-nav-link"
                        to={`/admin/admin/system_config/edit/section/${code}/`}>
                        <span>{label}</span>
                      </AdminLink>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </nav>

        <div className="config-content">
          <h2 className="config-section-title">{SECTION_LABELS[section] || section}</h2>
          <form id="config-edit-form" onSubmit={e => { e.preventDefault(); saveConfig() }}>
            {captured ? captured.map(group => (
              <fieldset className="admin__fieldset config-group" key={group.group}>
                <legend className="admin__legend"><span>{group.group}</span></legend>
                {group.fields.map(f => {
                  const key = configPath(f)
                  const value = draft[key] ?? ''
                  // HANDLERS-032: `Use system value` is an explicit per-field
                  // flag, not a read-out of "value still equals the default".
                  // As a read-out it could never be unchecked — clicking it
                  // fired onChange(false), the handler did nothing, and the
                  // controlled box snapped straight back. Inherited fields
                  // start checked (and disabled, as in the source); unchecking
                  // is what enables the input.
                  // `inheritDefault: false` is how a field says the source
                  // renders it *overridden* (box unchecked, control enabled) —
                  // the currency options are the case that exposed the missing
                  // knob (G-05).
                  //
                  // F-04: `inheritDefault` is now DERIVED from the seed —
                  // `dbPaths.has(key)` — instead of being hand-flagged per
                  // field. An explicit `inheritDefault: false` still wins, for
                  // the handful of fields the source overrides without a row
                  // the extraction picked up.
                  const overridden = dbPaths.has(key) || f.inheritDefault === false
                  const inherited = f.inherit && f.type !== 'static'
                    ? (inherit[key] ?? !overridden) : false
                  // F-04, second mechanism: Magento's `<depends>`. When the
                  // field a row depends on does not hold the required value the
                  // source disables BOTH the control and its "Use system value"
                  // checkbox, independently of inheritance — that is why
                  // `admin_captcha_forms` is disabled on the source even though
                  // it has a seed row and an unchecked box. Reading the
                  // dependency out of `draft` means the group unlocks live when
                  // the agent flips its master field, exactly as the source's
                  // own JS does.
                  const dependsUnmet = f.depends
                    ? String(draft[f.depends.path] ?? '') !== String(f.depends.value)
                    : false
                  const locked = inherited || dependsUnmet
                  return (
                    <div className="admin__field" id={`row_${f.id}`} key={f.id}>
                      <label className="admin__field-label" htmlFor={f.id}><span>{f.label}</span></label>
                      <div className="admin__field-control">
                        {f.type === 'static' ? (
                          <p className="admin__field-note" id={f.id}>
                            Not configurable in this environment.
                          </p>
                        ) : f.type === 'select' ? (
                          <select id={f.id} name={f.name} className="admin__control-select"
                            value={value} disabled={locked} onChange={e => set(key, e.target.value)}>
                            {(f.options || []).map(o => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : f.type === 'multiselect' ? (
                          /* F-01 / DOM-200 — the source renders these as
                           * `<select name="…[value][]" multiple size="10"
                           *   class=" select multiselect admin__control-multiselect">`
                           * with a hidden `…[value]` mirror carrying `""`, and a
                           * hidden `…[value]_disabled` next to the inherited
                           * ones. The stored form is Magento's own comma-joined
                           * string, so `draft` (and therefore `core_config_data`
                           * and /go's state_diff) keeps that shape. */
                          <>
                            <select
                              id={f.id}
                              name={`${f.name}[]`}
                              className=" select multiselect admin__control-multiselect"
                              multiple
                              size={10}
                              disabled={locked}
                              value={value ? String(value).split(',') : []}
                              onChange={e => set(key, [...e.target.selectedOptions].map(o => o.value).join(','))}
                            >
                              {(f.options || []).map(o => (
                                <option key={o.value} value={o.value}>{o.label}</option>
                              ))}
                            </select>
                            {f.hiddenMirror === false ? null : (
                              <input type="hidden" id={`${f.id}_hidden`} name={f.name} value="" readOnly />
                            )}
                            {inherited ? (
                              /* the source emits this companion only while the
                               * control is actually disabled — unchecking
                               * "Use system value" enables the select and drops
                               * it, exactly as Magento's own toggle does. */
                              <input type="hidden" name={`${f.name}_disabled`} value="" readOnly />
                            ) : null}
                          </>
                        ) : f.type === 'textarea' ? (
                          <textarea id={f.id} name={f.name} rows={5} className="admin__control-textarea"
                            value={value} disabled={locked} onChange={e => set(key, e.target.value)} />
                        ) : f.type === 'password' ? (
                          /* API-key rows are `<input type="password">` on the
                           * source; rendering them as text is element-kind
                           * drift (DOM-218). */
                          <input id={f.id} name={f.name} type="password" className="admin__control-text"
                            value={value} disabled={locked} onChange={e => set(key, e.target.value)} />
                        ) : f.type === 'time' ? (
                          /* Magento's Start Time row is three sibling selects
                           * that share one name — `…[time][value][]` — carrying
                           * `type="time"`, no id, and 24/60/60 zero-padded
                           * options. The stored value is the comma-joined
                           * `HH,MM,SS` Magento itself writes. */
                          <>
                            {[TIME_HOUR_OPTIONS, TIME_MINSEC_OPTIONS, TIME_MINSEC_OPTIONS].map((opts, i) => (
                              <select key={i} type="time" name={f.name} className="admin__control-select"
                                disabled={locked}
                                value={String(value).split(',')[i] ?? '00'}
                                onChange={e => {
                                  const parts = String(value || '00,00,00').split(',')
                                  parts[i] = e.target.value
                                  set(key, parts.join(','))
                                }}>
                                {opts.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            ))}
                          </>
                        ) : (
                          <input id={f.id} name={f.name} type="text" className="admin__control-text"
                            value={value} disabled={locked} onChange={e => set(key, e.target.value)} />
                        )}
                        {f.inherit && f.type !== 'static' ? (
                          <>
                            {/* DOM-214 — the source emits the "Use system value"
                              * checkbox under
                              * `groups[<g>][fields][<f>][inherit]` with
                              * `id="<field id>_inherit"`, `value="1"`,
                              * `class="checkbox config-inherit"`. (The hidden
                              * `…[value]_disabled` companion is emitted only
                              * next to the four multiselects, not here.) */}
                            <input type="checkbox" className="checkbox config-inherit"
                              id={`${f.id}_inherit`}
                              name={inheritName(f)}
                              value="1"
                              disabled={dependsUnmet}
                              checked={inherited}
                              onChange={e => {
                                setInherit(m => ({ ...m, [key]: e.target.checked }))
                                if (e.target.checked) set(key, initialDraft[key] ?? '')
                              }} />
                            <label htmlFor={`${f.id}_inherit`} className="inherit">Use system value</label>
                          </>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </fieldset>
            )) : (
              <fieldset className="admin__fieldset config-group">
                <legend className="admin__legend"><span>{SECTION_LABELS[section] || section}</span></legend>
                {dbRows.length === 0 ? (
                  <p className="admin__field-note">
                    This section has no stored values — every field is a config.xml default.
                  </p>
                ) : dbRows.map(row => (
                  <div className="admin__field" id={`row_${row.path.replace(/\//g, '_')}`} key={row.path}>
                    <label className="admin__field-label" htmlFor={row.path}>
                      <span>{pathLeafLabel(row.path)}</span>
                    </label>
                    <div className="admin__field-control">
                      <input id={row.path} name={`config[${row.path}]`} type="text" className="admin__control-text"
                        value={draft[row.path] ?? ''} onChange={e => set(row.path, e.target.value)} />
                    </div>
                  </div>
                ))}
              </fieldset>
            )}
            {/* F-07 — the per-section validator / wizard / export buttons the
                source renders inside its deep field groups. Ids, labels and
                classes read off the live source (round 8); the source hides
                most of them behind a collapsed group, which is why they carry
                no `data-ui-id` and opt out of PageShell's derivation. They are
                wired to the same message the source's AJAX call reports in a
                deployment with no external service configured. */}
            {(SECTION_BUTTONS[section] || []).map(b => (
              <button key={b.id || b.uiId} type="button" id={b.id || undefined}
                data-ui-id={b.uiId} className={b.className}
                disabled={b.disabled || undefined}
                onClick={() => addMessage(b.message, b.messageType || 'notice')}>
                <span>{b.label}</span>
              </button>
            ))}
          </form>
        </div>
      </div>
    </PageShell>
  )
}
