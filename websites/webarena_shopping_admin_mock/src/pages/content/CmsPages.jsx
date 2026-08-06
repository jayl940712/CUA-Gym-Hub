import React, { useState } from 'react'
import { Navigate, useLocation, useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { formatDateTime } from '../../utils/formatters.js'
import { useSidNavigate } from '../../utils/navigation.js'
import '../../components/system/system.css'

/**
 * Content > Pages — ROUTES rows 101-103.
 *
 * Tasks 486-490 edit a CMS page title, so `input[name="title"]` on the edit form
 * is the evaluator target and the save must land in state (→ /go state_diff).
 * Page ids are the real ones out of `cms_page`: 1 = 404 Not Found, 2 = Home Page,
 * 3 = Enable Cookies, 4 = Privacy Policy, 5 = About us, 6 = Customer Service.
 */

export const PAGE_LAYOUTS = [
  { value: '', label: 'Default' },
  { value: 'empty', label: 'Empty' },
  { value: '1column', label: '1 column' },
  { value: '2columns-left', label: '2 columns with left bar' },
  { value: '2columns-right', label: '2 columns with right bar' },
  { value: '3columns', label: '3 columns' },
  { value: 'cms-full-width', label: 'Page -- Full Width' },
  // F-05 — the source's list is 9 long; these two were trimmed off.
  { value: 'category-full-width', label: 'Category -- Full Width' },
  { value: 'product-full-width', label: 'Product -- Full Width' },
]

export function layoutLabel(value) {
  return PAGE_LAYOUTS.find(l => l.value === (value || ''))?.label ?? value
}

/** `store_ids: [0]` is Magento's "All Store Views". */
export function storeViewLabel(storeIds) {
  const ids = storeIds || []
  return ids.includes(0) || ids.length === 0 ? 'All Store Views' : 'Default Store View'
}

/* -------------------------------------------------------- Pages grid (101) */

export function CmsPageGrid() {
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const rows = state?.cmsPages || []

  const columns = [
    { id: 'page_id', label: 'ID', filterType: 'text', sortValue: r => Number(r.page_id) },
    {
      id: 'title', label: 'Title', filterType: 'text', searchValue: r => r.title,
      render: r => <AdminLink to={`/admin/cms/page/edit/page_id/${r.page_id}/`}>{r.title}</AdminLink>,
      exportValue: r => r.title,
    },
    { id: 'identifier', label: 'URL Key', filterType: 'text', searchValue: r => r.identifier },
    {
      id: 'page_layout', label: 'Layout', filterType: 'select',
      options: PAGE_LAYOUTS.filter(l => l.value).map(l => ({ value: l.value, label: l.label })),
      render: r => layoutLabel(r.page_layout), exportValue: r => layoutLabel(r.page_layout),
      filterValue: r => String(r.page_layout || ''),
    },
    {
      id: 'store_ids', label: 'Store View', sortable: false, filterType: null,
      render: r => storeViewLabel(r.store_ids), exportValue: r => storeViewLabel(r.store_ids),
    },
    {
      id: 'is_active', label: 'Status', filterType: 'select',
      options: [{ value: '1', label: 'Enabled' }, { value: '0', label: 'Disabled' }],
      render: r => (Number(r.is_active) === 1 ? 'Enabled' : 'Disabled'),
      filterValue: r => String(r.is_active),
      exportValue: r => (Number(r.is_active) === 1 ? 'Enabled' : 'Disabled'),
    },
    {
      id: 'creation_time', label: 'Created', filterType: 'date',
      render: r => formatDateTime(r.creation_time), exportValue: r => formatDateTime(r.creation_time),
    },
    {
      id: 'update_time', label: 'Modified', filterType: 'date',
      render: r => formatDateTime(r.update_time), exportValue: r => formatDateTime(r.update_time),
    },
    {
      id: 'action', label: 'Action', sortable: false, filterType: null,
      render: r => (
        <AdminLink to={`/admin/cms/page/edit/page_id/${r.page_id}/`} className="action-menu-item">Select</AdminLink>
      ),
      exportValue: () => '',
    },
  ]

  const massActions = [
    {
      id: 'delete',
      label: 'Delete',
      onApply: ids => {
        const set = new Set(ids.map(String))
        setState(prev => ({
          ...prev,
          cmsPages: (prev.cmsPages || []).filter(p => !set.has(String(p.page_id))),
        }))
        addMessage(`A total of ${ids.length} record(s) have been deleted.`)
      },
    },
    {
      id: 'disable',
      label: 'Disable',
      onApply: ids => {
        const set = new Set(ids.map(String))
        setState(prev => ({
          ...prev,
          cmsPages: (prev.cmsPages || []).map(p => (set.has(String(p.page_id)) ? { ...p, is_active: 0 } : p)),
        }))
        addMessage(`A total of ${ids.length} record(s) have been disabled.`)
      },
    },
    {
      id: 'enable',
      label: 'Enable',
      onApply: ids => {
        const set = new Set(ids.map(String))
        setState(prev => ({
          ...prev,
          cmsPages: (prev.cmsPages || []).map(p => (set.has(String(p.page_id)) ? { ...p, is_active: 1 } : p)),
        }))
        addMessage(`A total of ${ids.length} record(s) have been enabled.`)
      },
    },
  ]

  const actions = (
    // Source: <button id="add" title="Add New Page" class="action- scalable primary"
    // data-ui-id="add-button"> — a real <button>, not a link.
    <button type="button" id="add" title="Add New Page" className="action- scalable primary"
      onClick={() => navigate('/admin/cms/page/new/')}>
      <span>Add New Page</span>
    </button>
  )

  return (
    <PageShell title="Pages" actions={actions}>
      <AdminGrid gridId="cms_page_listing" rows={rows} columns={columns} rowKey={r => r.page_id}
        selectable massActions={massActions} exportFileName="cms_page"
        defaultSort={{ field: 'page_id', direction: 'asc' }} />
    </PageShell>
  )
}

/* ------------------------------------------------- Page new / edit (102-103) */

const BLANK_PAGE = {
  title: '',
  identifier: '',
  page_layout: '',
  content_heading: '',
  content: '',
  meta_title: '',
  meta_keywords: '',
  meta_description: '',
  is_active: 1,
  store_ids: [0],
  custom_theme: null,
  custom_root_template: null,
  custom_theme_from: null,
  custom_theme_to: null,
  layout_update_xml: null,
  custom_layout_update_xml: null,
  sort_order: 0,
}

function nowStamp() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

export function CmsPageEdit({ isNew = false }) {
  const { id } = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const page = isNew ? null : (state?.cmsPages || []).find(p => String(p.page_id) === String(id))

  const [form, setForm] = useState(() => ({ ...BLANK_PAGE, ...(page || {}) }))
  const [open, setOpen] = useState({ content: false, seo: false, websites: false, design: false, schedule: false })
  /* The hidden-but-editable `page_id` field — see the note at its markup. */
  const [pageIdField, setPageIdField] = useState(page ? String(page.page_id) : '')

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const toggle = k => setOpen(o => ({ ...o, [k]: !o[k] }))

  if (!isNew && !page) {
    return (
      <PageShell title="Edit Page">
        <div className="admin__data-grid-empty">This page no longer exists.</div>
      </PageShell>
    )
  }

  /* HANDLERS-013. `Save & Duplicate` used to call `save(true)`, which saved the
   * same page and navigated to its own edit form — the label promised a copy
   * that never appeared. The source (Cms\Controller\Adminhtml\Page\Save, `back
   * === 'duplicate'`) saves the page, then inserts a second row with a fresh
   * page_id, the same data, `is_active = 0` and a suffixed identifier, reports
   * `You duplicated the page.` and lands on the NEW page's edit form. Magento
   * suffixes with `uniqid()`; we use the lowest free `-N` so the result is
   * reproducible across rollouts. */
  function duplicate() {
    if (!page) {
      addMessage('This is a required field.', 'error')
      return
    }
    const existing = state.cmsPages || []
    const base = String(form.identifier || page.identifier || 'page')
    let n = 1
    while (existing.some(p => String(p.identifier) === `${base}-${n}`)) n += 1
    const newId = existing.reduce((m, p) => Math.max(m, Number(p.page_id) || 0), 0) + 1
    setState(prev => {
      const list = prev.cmsPages || []
      const saved = {
        ...BLANK_PAGE,
        ...form,
        is_active: Number(form.is_active),
        store_ids: form.store_ids,
        update_time: nowStamp(),
      }
      const copy = {
        ...saved,
        page_id: newId,
        identifier: `${base}-${n}`,
        is_active: 0,
        creation_time: nowStamp(),
        update_time: nowStamp(),
      }
      return {
        ...prev,
        cmsPages: [
          ...list.map(p => (String(p.page_id) === String(page.page_id) ? { ...p, ...saved } : p)),
          copy,
        ],
      }
    })
    addMessage('You saved the page.')
    addMessage('You duplicated the page.')
    navigate(`/admin/cms/page/edit/page_id/${newId}/`)
  }

  function save(andContinue = false) {
    if (!String(form.title).trim()) {
      addMessage('This is a required field.', 'error')
      return
    }
    const record = {
      ...BLANK_PAGE,
      ...form,
      title: form.title,
      identifier: form.identifier,
      is_active: Number(form.is_active),
      store_ids: form.store_ids,
      update_time: nowStamp(),
    }
    let savedId = page?.page_id
    setState(prev => {
      const list = prev.cmsPages || []
      if (page) {
        return { ...prev, cmsPages: list.map(p => (String(p.page_id) === String(page.page_id) ? { ...p, ...record } : p)) }
      }
      savedId = list.reduce((m, p) => Math.max(m, Number(p.page_id) || 0), 0) + 1
      return {
        ...prev,
        cmsPages: [...list, { ...record, page_id: savedId, creation_time: nowStamp() }],
      }
    })
    addMessage('You saved the page.')
    navigate(andContinue ? `/admin/cms/page/edit/page_id/${savedId}/` : '/admin/cms/page/')
  }

  function remove() {
    setState(prev => ({
      ...prev,
      cmsPages: (prev.cmsPages || []).filter(p => String(p.page_id) !== String(page.page_id)),
    }))
    addMessage('You deleted the page.')
    navigate('/admin/cms/page/')
  }

  const actions = (
    <>
      <button type="button" id="back" className="action-default scalable back"
        onClick={() => navigate('/admin/cms/page/')}><span>Back</span></button>
      {page ? (
        <button type="button" id="delete" className="action-default scalable delete" onClick={remove}>
          <span>Delete Page</span>
        </button>
      ) : null}
      <button type="button" id="reset" className="action-default scalable"
        onClick={() => setForm({ ...BLANK_PAGE, ...(page || {}) })}><span>Reset</span></button>
      {/* HANDLERS-013. The source puts these two under the Save split button's
          `Select` dropdown as `#save_and_duplicate` / `#save_and_close`; we keep
          the source's ids and labels but render them flat. `Save & Duplicate`
          now really inserts a copy. It only exists on an existing page — the
          source's New Page form has no duplicate entry either. */}
      {page ? (
        <button type="button" id="save_and_duplicate" title="Save &amp; Duplicate"
          className="action-default scalable" onClick={duplicate}>
          <span>Save &amp; Duplicate</span>
        </button>
      ) : null}
      <button type="button" id="save_and_close" title="Save &amp; Close"
        className="action-default scalable" onClick={() => save(false)}>
        <span>Save &amp; Close</span>
      </button>
      {/* F-07/G-06f — the source's primary Save on both /edit/ and /new/ is
          `id="save-button" data-ui-id="save-button"` (its split-button toggle is
          `data-ui-id="save-button-dropdown"`), NOT `#save`. */}
      <button type="button" id="save-button" title="Save"
        className="action-default scalable primary save" onClick={() => save(true)}>
        <span>Save</span>
      </button>
    </>
  )

  return (
    <PageShell title={page ? page.title : 'New Page'} actions={actions}>
      <form id="edit_form" onSubmit={e => { e.preventDefault(); save(false) }}>
        <fieldset className="admin__fieldset">
          {/* DOM-009 — the source renders the record id as a real (but hidden)
              text field inside `[data-index="page_id"]`, value "1" on page 1.
              F-04 sweep — it is `readonly` on neither side now: the source's
              field is plain `<input type="text" maxlength="255">`, editable
              (`is_editable() == True`). Typing into it does not rename the
              record on the source either — Magento takes the id from the URL —
              so the mock keeps it local to the form rather than writing it
              back, which is the source's own behaviour and not a false
              success. */}
          <div className="admin__field" data-index="page_id" style={{ display: 'none' }}>
            <div className="admin__field-control">
              <input className="admin__control-text" type="text" name="page_id"
                maxLength={255} value={pageIdField}
                onChange={e => setPageIdField(e.target.value)} />
            </div>
          </div>
          <div className="admin__field admin__field-toggle">
            <label className="admin__field-label" htmlFor="page_is_active"><span>Enable Page</span></label>
            <div className="admin__field-control">
              {/* DOM-009 — the source switcher carries an explicit value="1" and the
                  switch class; without the value `.value` reads the browser default "on". */}
              <input id="page_is_active" name="is_active" type="checkbox" value="1"
                className="admin__actions-switch-checkbox"
                checked={Number(form.is_active) === 1}
                onChange={e => set('is_active', e.target.checked ? 1 : 0)} />
              <span className="admin__actions-switch-label">{Number(form.is_active) === 1 ? 'Yes' : 'No'}</span>
            </div>
          </div>

          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="page_title"><span>Page Title</span></label>
            <div className="admin__field-control">
              <input id="page_title" name="title" type="text" className="admin__control-text"
                value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
          </div>
        </fieldset>

        <Collapsible id="content" title="Content" open={open.content} onToggle={() => toggle('content')}>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="content_heading"><span>Content Heading</span></label>
            <div className="admin__field-control">
              <input id="content_heading" name="content_heading" type="text" className="admin__control-text"
                value={form.content_heading || ''} onChange={e => set('content_heading', e.target.value)} />
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="page_content"><span>Content</span></label>
            <div className="admin__field-control">
              <textarea id="page_content" name="content" rows={16} className="admin__control-textarea"
                value={form.content || ''} onChange={e => set('content', e.target.value)} />
            </div>
          </div>
        </Collapsible>

        <Collapsible id="seo" title="Search Engine Optimization" open={open.seo} onToggle={() => toggle('seo')}>
          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="page_identifier"><span>URL Key</span></label>
            <div className="admin__field-control">
              <input id="page_identifier" name="identifier" type="text" className="admin__control-text"
                value={form.identifier || ''} onChange={e => set('identifier', e.target.value)} />
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="meta_title"><span>Meta Title</span></label>
            <div className="admin__field-control">
              <input id="meta_title" name="meta_title" type="text" className="admin__control-text"
                value={form.meta_title || ''} onChange={e => set('meta_title', e.target.value)} />
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="meta_keywords"><span>Meta Keywords</span></label>
            <div className="admin__field-control">
              <textarea id="meta_keywords" name="meta_keywords" rows={3} className="admin__control-textarea"
                value={form.meta_keywords || ''} onChange={e => set('meta_keywords', e.target.value)} />
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="meta_description"><span>Meta Description</span></label>
            <div className="admin__field-control">
              <textarea id="meta_description" name="meta_description" rows={3} className="admin__control-textarea"
                value={form.meta_description || ''} onChange={e => set('meta_description', e.target.value)} />
            </div>
          </div>
        </Collapsible>

        <Collapsible id="websites" title="Page in Websites" open={open.websites} onToggle={() => toggle('websites')}>
          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="store_id"><span>Store View</span></label>
            <div className="admin__field-control">
              <select id="store_id" name="store_id" multiple size={3} className="admin__control-multiselect"
                value={(form.store_ids || []).map(String)}
                onChange={e => set('store_ids', [...e.target.selectedOptions].map(o => Number(o.value)))}>
                <option value="0">All Store Views</option>
                <option value="1">Default Store View</option>
              </select>
            </div>
          </div>
        </Collapsible>

        <Collapsible id="design" title="Design" open={open.design} onToggle={() => toggle('design')}>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="page_layout"><span>Layout</span></label>
            <div className="admin__field-control">
              <select id="page_layout" name="page_layout" className="admin__control-select"
                value={form.page_layout || ''} onChange={e => set('page_layout', e.target.value)}>
                {PAGE_LAYOUTS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
              </select>
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="layout_update_xml"><span>Layout Update XML</span></label>
            <div className="admin__field-control">
              <textarea id="layout_update_xml" name="layout_update_xml" rows={5} className="admin__control-textarea"
                value={form.layout_update_xml || ''} onChange={e => set('layout_update_xml', e.target.value)} />
            </div>
          </div>
        </Collapsible>

        <Collapsible id="schedule" title="Custom Design Update" open={open.schedule} onToggle={() => toggle('schedule')}>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="custom_theme_from"><span>From</span></label>
            <div className="admin__field-control">
              <input id="custom_theme_from" name="custom_theme_from" type="text" className="admin__control-text input-date"
                value={form.custom_theme_from || ''} onChange={e => set('custom_theme_from', e.target.value)} />
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="custom_theme_to"><span>To</span></label>
            <div className="admin__field-control">
              <input id="custom_theme_to" name="custom_theme_to" type="text" className="admin__control-text input-date"
                value={form.custom_theme_to || ''} onChange={e => set('custom_theme_to', e.target.value)} />
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="custom_theme"><span>New Theme</span></label>
            <div className="admin__field-control">
              <select id="custom_theme" name="custom_theme" className="admin__control-select"
                value={form.custom_theme || ''} onChange={e => set('custom_theme', e.target.value || null)}>
                <option value="">-- Please Select --</option>
                <option value="1">Magento Blank</option>
                <option value="3">Magento Luma</option>
              </select>
            </div>
          </div>
        </Collapsible>
      </form>
    </PageShell>
  )
}

/** Magento's `admin__collapsible-block` section. */
export function Collapsible({ id, title, open, onToggle, children }) {
  return (
    <div className={`admin__collapsible-block${open ? ' _show' : ''}`} data-index={id}>
      <div className="admin__collapsible-title" onClick={onToggle} role="button" tabIndex={0}
        aria-expanded={open}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() } }}>
        <span>{title}</span>
      </div>
      {open ? <fieldset className="admin__fieldset admin__collapsible-content">{children}</fieldset> : null}
    </div>
  )
}

/* --------------------------------------------------------- Page save (103) */

/**
 * `/admin/cms/page/save/` is POST-only in the source and redirects to the grid.
 * The mock persists inside the form, so a GET here behaves like that redirect.
 */
export function CmsPageSave() {
  const location = useLocation()
  return <Navigate to={`/admin/cms/page/${location.search}`} replace />
}
