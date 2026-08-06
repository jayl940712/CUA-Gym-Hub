import React, { useMemo, useState } from 'react'
import PageShell from '../layout/PageShell.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useSidNavigate } from '../../utils/navigation.js'
/* Supplies `.admin__actions-switch*` / `.admin__control-checkbox` sizing —
 * without it these checkboxes render 0x0 and `page.check()` cannot reach them. */
import '../catalog/adminForm.css'

/**
 * Shared create/edit form for the many small Magento admin entities whose
 * source pages are a single fieldset plus `Back · Reset · Save …`
 * (HANDLERS-011): custom variables, sitemaps, email/newsletter templates,
 * integrations, synonym groups, URL rewrites, terms & conditions, widgets,
 * store design changes and the store hierarchy.
 *
 * Every one of those grids reads its rows out of `state.systemConfig`, which is
 * already a baseline key in `createInitialData()`, so writing through
 * `useSystemCollection` lands in `saveState()` → `/post?action=set_current` and
 * shows up in `/go`'s `state_diff` without inventing a new top-level key.
 *
 * Field labels, legends, button labels and page titles below are transcribed
 * from the live source (`http://localhost:7780/admin`, read-only) — see the
 * per-call-site comments for the page each set came from.
 */

/** Rows for one `state.systemConfig` collection, plus its three writers. */
export function useSystemCollection(key, idField) {
  const { state, setState } = useApp()
  const rows = useMemo(() => (state?.systemConfig?.[key] || []), [state, key])

  const write = updater => setState(prev => {
    const cfg = prev.systemConfig || {}
    return { ...prev, systemConfig: { ...cfg, [key]: updater(cfg[key] || []) } }
  })

  const nextId = () => (rows.reduce((m, r) => Math.max(m, Number(r[idField]) || 0), 0) || 0) + 1
  const add = record => write(list => [...list, record])
  const update = (id, patch) => write(list => list.map(r => (
    String(r[idField]) === String(id) ? { ...r, ...patch } : r)))
  const remove = id => write(list => list.filter(r => String(r[idField]) !== String(id)))

  return { rows, nextId, add, update, remove }
}

/**
 * PIPELINE-021: the maintenance screens (Cache Management, Index Management,
 * Notifications, Integrations) each held their row state in a component-local
 * `useState`, so their mass actions printed the source's success copy, changed
 * the grid until the next navigation, and left `/go`'s `state_diff` empty — a
 * success message with no state footprint, which is worse for a training signal
 * than a button that does nothing.
 *
 * These are overlays over a static seed rather than full row copies, so the
 * baseline stays small and the diff names exactly what the agent touched.
 *
 * @param key   the `state.systemConfig` sub-key holding the overlay
 * @returns `map` (id -> value) plus `setMany` / `clear`
 */
export function useSystemMap(key) {
  const { state, setState } = useApp()
  const map = useMemo(() => (state?.systemConfig?.[key] || {}), [state, key])

  const write = updater => setState(prev => {
    const cfg = prev.systemConfig || {}
    return { ...prev, systemConfig: { ...cfg, [key]: updater(cfg[key] || {}) } }
  })

  /** Set one value for many ids at once (the mass-action shape). */
  const setMany = (ids, value) => write(prev => {
    const next = { ...prev }
    for (const id of ids) next[String(id)] = value
    return next
  })

  /** Merge a patch object into many ids' entries, keeping earlier fields. */
  const mergeMany = (ids, patch) => write(prev => {
    const next = { ...prev }
    for (const id of ids) next[String(id)] = { ...(next[String(id)] || {}), ...patch }
    return next
  })

  return { map, setMany, mergeMany }
}

/** Append-only log in `state.systemConfig[key]`, for actions with no row. */
export function useSystemLog(key) {
  const { state, setState } = useApp()
  const entries = useMemo(() => (state?.systemConfig?.[key] || []), [state, key])
  const append = entry => setState(prev => {
    const cfg = prev.systemConfig || {}
    return { ...prev, systemConfig: { ...cfg, [key]: [...(cfg[key] || []), entry] } }
  })
  return { entries, append }
}

function Field({ f, value, onChange }) {
  /* `f.id` lets a call site pin the source's own id (`#store_name`,
   * `#rating_code`). The `rf_` prefix is only a fallback for the pages where the
   * source id is a per-request knockout hash and there is nothing to copy. */
  const id = f.id || `rf_${f.name}`
  const common = {
    id,
    name: f.name,
    value: value ?? '',
    onChange: e => onChange(f.name, e.target.value),
  }
  let control
  if (f.type === 'select') {
    control = (
      <select {...common} className="admin__control-select">
        {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  } else if (f.type === 'checkbox' || f.type === 'toggle') {
    /* Every Magento admin checkbox carries an explicit `value` that tracks the
     * control's state (knockout's `value: value` binding), so `.value` reads
     * "1"/"0" and never the browser default "on". `toggle` is the same input
     * inside the `.admin__actions-switch` pill the source uses for Active /
     * Enable rows. */
    const on = f.onValue ?? '1'
    const off = f.offValue ?? '0'
    const checked = String(value) === on
    const box = (
      <input id={id} name={f.name} type="checkbox"
        className={f.type === 'toggle' ? 'admin__actions-switch-checkbox' : 'admin__control-checkbox'}
        value={checked ? on : off}
        checked={checked}
        onChange={e => onChange(f.name, e.target.checked ? on : off)} />
    )
    control = f.type === 'toggle'
      ? (
        <div className="admin__actions-switch" data-role="switcher">
          {box}
          <label className="admin__actions-switch-label" htmlFor={id} />
        </div>
      )
      : box
  } else if (f.type === 'multiselect') {
    control = (
      <select id={id} name={f.name} multiple size={f.size || 5} className="admin__control-multiselect"
        value={Array.isArray(value) ? value : []}
        onChange={e => onChange(f.name, [...e.target.selectedOptions].map(o => o.value))}>
        {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    )
  } else if (f.type === 'textarea') {
    control = <textarea {...common} rows={f.rows || 8} className="admin__control-textarea" />
  } else if (f.type === 'date') {
    /* Magento renders date fields as `<input type="text" class="admin__control-text
     * _has-datepicker">` with a JS calendar, not a native `type="date"` box —
     * which also means `page.fill()` accepts the source's `M/D/YY` format. */
    control = <input {...common} type="text" className="admin__control-text _has-datepicker" />
  } else if (f.type === 'hidden') {
    /* Magento mirrors several visible controls into a hidden twin
     * (`store[is_active]` / `#store_is_active_hidden`) and carries the record's
     * own key plus `store_type` / `store_action` the same way. Those names are
     * part of the form an evaluator reads, so they are rendered, not dropped. */
    return <input type="hidden" id={id} name={f.name} value={value ?? ''} readOnly />
  } else {
    control = <input {...common} type="text" className="admin__control-text" />
  }
  return (
    <div className={`admin__field${f.required ? ' _required' : ''}`}>
      <label className="admin__field-label" htmlFor={id}><span>{f.label}</span></label>
      <div className="admin__field-control">
        {control}
        {f.note ? <div className="admin__field-note"><span>{f.note}</span></div> : null}
      </div>
    </div>
  )
}

/**
 * `fields`: `[{ name, label, type, options, required, note }]`, grouped by
 * `legend` when `fieldsets` is passed instead.
 */
export default function RecordForm({
  title, documentTitle, legend, fields, fieldsets, initial, backTo, onSave, onDelete,
  saveLabel = 'Save', deleteLabel = 'Delete', children, extraActions = null,
  /**
   * `uiPrefix` is the source's `data-ui-id` stem for this page's toolbar —
   * Magento names every action button `<prefix>-back-button`,
   * `-reset-button`, `-delete-button`, `-save-button`. Evaluators select on
   * `data-ui-id` as often as on `id`, and the mock emitted neither.
   * `saveAndContinueLabel` opts the page into the source's second save button
   * (`#save_and_continue`), which several of these forms have.
   */
  uiPrefix = null, saveAndContinueLabel = null, onSaveAndContinue = null,
  saveAndContinueId = 'save_and_continue',
}) {
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  const groups = fieldsets || [{ legend, fields }]
  const allFields = groups.flatMap(g => g.fields)
  const [form, setForm] = useState(() => ({ ...initial }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function submit(handler = onSave) {
    const missing = allFields.find(f => f.required && !String(form[f.name] ?? '').trim())
    if (missing) {
      addMessage('This is a required field.', 'error')
      return
    }
    handler(form)
  }

  /* `uiPrefix=""` is meaningful: several source pages emit the bare
   * `data-ui-id="save-button"` with no stem at all. */
  const uiId = suffix => (uiPrefix == null ? undefined : (uiPrefix ? `${uiPrefix}-${suffix}` : suffix))

  const actions = (
    <>
      <button type="button" id="back" data-ui-id={uiId('back-button')}
        className="action-default scalable back"
        onClick={() => navigate(backTo)}><span>Back</span></button>
      {onDelete ? (
        <button type="button" id="delete" data-ui-id={uiId('delete-button')}
          className="action-default scalable delete"
          onClick={onDelete}><span>{deleteLabel}</span></button>
      ) : null}
      <button type="button" id="reset" data-ui-id={uiId('reset-button')}
        className="action-default scalable"
        onClick={() => setForm({ ...initial })}><span>Reset</span></button>
      {extraActions}
      {saveAndContinueLabel ? (
        /* F-07 — the id of "Save and Continue Edit" is per-page on the source:
           `#save_and_continue` on the cart-price-rule and tax-rule forms,
           `#save_and_edit` on /admin/admin/system_variable/new/. Verified live;
           `saveAndContinueId` lets a call site pin its own. */
        <button type="button" id={saveAndContinueId}
          data-ui-id={uiId(`${saveAndContinueId.replace(/_/g, '-')}-button`)}
          className="action-default scalable"
          onClick={() => submit(onSaveAndContinue || onSave)}><span>{saveAndContinueLabel}</span></button>
      ) : null}
      <button type="button" id="save" data-ui-id={uiId('save-button')}
        className="action-default scalable primary save"
        onClick={() => submit()}><span>{saveLabel}</span></button>
    </>
  )

  return (
    <PageShell title={title} documentTitle={documentTitle} actions={actions}>
      <form className="entry-edit" onSubmit={e => { e.preventDefault(); submit() }}>
        {groups.map((g, i) => (
          <fieldset className="admin__fieldset" key={g.legend || i}>
            {g.legend ? <legend className="admin__legend"><span>{g.legend}</span></legend> : null}
            {/* F-09 — key on `id` as well as `name`: Magento posts hidden
                mirrors that repeat a visible control's `name`
                (`store[is_active]` on system_store/editStore), and keying on
                `name` alone made React log "two children with the same key"
                seven times on that route. The ids are unique by construction. */}
            {g.fields.map(f => (
              <Field key={`${f.id || ''}|${f.name}`} f={f} value={form[f.name]} onChange={set} />
            ))}
          </fieldset>
        ))}
        {children}
      </form>
    </PageShell>
  )
}
