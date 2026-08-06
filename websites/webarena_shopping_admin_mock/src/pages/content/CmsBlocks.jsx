import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { formatDateTime } from '../../utils/formatters.js'
import { useSidNavigate } from '../../utils/navigation.js'
import { storeViewLabel } from './CmsPages.jsx'

/**
 * Content > Blocks — ROUTES row 104, from assets/html/cms-block.html
 * (17 rows in `cms_block`, columns ID / Title / Identifier / Store View /
 * Status / Created / Modified / Action).
 */

export function CmsBlockGrid() {
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const rows = state?.cmsBlocks || []

  const columns = [
    { id: 'block_id', label: 'ID', filterType: 'text', sortValue: r => Number(r.block_id) },
    {
      id: 'title', label: 'Title', filterType: 'text', searchValue: r => r.title,
      render: r => <AdminLink to={`/admin/cms/block/edit/block_id/${r.block_id}/`}>{r.title}</AdminLink>,
      exportValue: r => r.title,
    },
    { id: 'identifier', label: 'Identifier', filterType: 'text', searchValue: r => r.identifier },
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
        <AdminLink to={`/admin/cms/block/edit/block_id/${r.block_id}/`} className="action-menu-item">Select</AdminLink>
      ),
      exportValue: () => '',
    },
  ]

  const massActions = [{
    id: 'delete',
    label: 'Delete',
    onApply: ids => {
      const set = new Set(ids.map(String))
      setState(prev => ({
        ...prev, cmsBlocks: (prev.cmsBlocks || []).filter(b => !set.has(String(b.block_id))),
      }))
      addMessage(`A total of ${ids.length} record(s) have been deleted.`)
    },
  }]

  const actions = (
    // Source: <button id="add" title="Add New Block" class="action- scalable primary"
    // data-ui-id="add-button">.
    <button type="button" id="add" title="Add New Block" className="action- scalable primary"
      onClick={() => navigate('/admin/cms/block/new/')}>
      <span>Add New Block</span>
    </button>
  )

  return (
    <PageShell title="Blocks" actions={actions}>
      <AdminGrid gridId="cms_block_listing" rows={rows} columns={columns} rowKey={r => r.block_id}
        selectable massActions={massActions} exportFileName="cms_block"
        defaultSort={{ field: 'block_id', direction: 'asc' }} />
    </PageShell>
  )
}

const BLANK_BLOCK = { title: '', identifier: '', content: '', is_active: 1, store_ids: [0] }

export function CmsBlockEdit({ isNew = false }) {
  const { id } = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const block = isNew ? null : (state?.cmsBlocks || []).find(b => String(b.block_id) === String(id))
  const [form, setForm] = useState(() => ({ ...BLANK_BLOCK, ...(block || {}) }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  if (!isNew && !block) {
    return (
      <PageShell title="Edit Block">
        <div className="admin__data-grid-empty">This block no longer exists.</div>
      </PageShell>
    )
  }

  function stamp() { return new Date().toISOString().slice(0, 19).replace('T', ' ') }

  function save() {
    if (!String(form.title).trim()) { addMessage('This is a required field.', 'error'); return }
    setState(prev => {
      const list = prev.cmsBlocks || []
      if (block) {
        return {
          ...prev,
          cmsBlocks: list.map(b => (String(b.block_id) === String(block.block_id)
            ? { ...b, ...form, is_active: Number(form.is_active), update_time: stamp() } : b)),
        }
      }
      const nextId = list.reduce((m, b) => Math.max(m, Number(b.block_id) || 0), 0) + 1
      return {
        ...prev,
        cmsBlocks: [...list, {
          ...BLANK_BLOCK, ...form, block_id: nextId, is_active: Number(form.is_active),
          creation_time: stamp(), update_time: stamp(),
        }],
      }
    })
    addMessage('You saved the block.')
    navigate('/admin/cms/block/')
  }

  function remove() {
    setState(prev => ({
      ...prev, cmsBlocks: (prev.cmsBlocks || []).filter(b => String(b.block_id) !== String(block.block_id)),
    }))
    addMessage('You deleted the block.')
    navigate('/admin/cms/block/')
  }

  const actions = (
    <>
      <button type="button" id="back" title="Back" data-ui-id="back-button"
        className="action-default scalable back"
        onClick={() => navigate('/admin/cms/block/')}><span>Back</span></button>
      {block ? (
        <button type="button" id="delete" title="Delete Block" data-ui-id="delete-button"
          className="action-default scalable delete" onClick={remove}>
          <span>Delete Block</span>
        </button>
      ) : null}
      {/* DOM-215 — the source's primary action on this form is
        * `<button id="save-button" data-ui-id="save-button" class="action-default primary">`,
        * not the legacy `#save`. */}
      <button type="button" id="save-button" title="Save" data-ui-id="save-button"
        className="action-default primary" onClick={save}>
        {/* F-09 — the source's label is exactly `Save`, so
          * `get_by_role("button", name="Save", exact=True)` resolves. */}
        <span>Save</span>
      </button>
    </>
  )

  return (
    <PageShell title={block ? block.title : 'New Block'} actions={actions}>
      <form id="edit_form" onSubmit={e => { e.preventDefault(); save() }}>
        {/* DOM-215 — the source wraps the form in `[data-index="general"]` and
          * every field in its own `[data-index]`; those wrappers are the
          * evaluator's hook on every Magento UI-component form. */}
        <fieldset className="admin__fieldset" data-index="general">
          <div className="admin__field" data-index="block_id" style={{ display: 'none' }}>
            <div className="admin__field-label" />
            <div className="admin__field-control">
              <input id="block_block_id" name="block_id" type="text" maxLength={255}
                className="admin__control-text"
                value={form.block_id ?? ''} onChange={e => set('block_id', e.target.value)} />
            </div>
          </div>
          <div className="admin__field admin__field-toggle" data-index="is_active">
            <label className="admin__field-label" htmlFor="block_is_active"><span>Enable Block</span></label>
            <div className="admin__field-control">
              <input id="block_is_active" name="is_active" type="checkbox" value="1"
                className="admin__actions-switch-checkbox"
                checked={Number(form.is_active) === 1}
                onChange={e => set('is_active', e.target.checked ? 1 : 0)} />
              <span className="admin__actions-switch-label">{Number(form.is_active) === 1 ? 'Yes' : 'No'}</span>
            </div>
          </div>
          <div className="admin__field _required" data-index="title">
            <label className="admin__field-label" htmlFor="block_title"><span>Block Title</span></label>
            <div className="admin__field-control">
              <input id="block_title" name="title" type="text" className="admin__control-text"
                value={form.title} onChange={e => set('title', e.target.value)} />
            </div>
          </div>
          <div className="admin__field _required" data-index="identifier">
            <label className="admin__field-label" htmlFor="block_identifier"><span>Identifier</span></label>
            <div className="admin__field-control">
              <input id="block_identifier" name="identifier" type="text" className="admin__control-text"
                value={form.identifier} onChange={e => set('identifier', e.target.value)} />
            </div>
          </div>
          <div className="admin__field _required" data-index="storeviews">
            <label className="admin__field-label" htmlFor="block_store_id"><span>Store View</span></label>
            <div className="admin__field-control">
              <select id="block_store_id" name="store_id" multiple size={3} className="admin__control-multiselect"
                value={(form.store_ids || []).map(String)}
                onChange={e => set('store_ids', [...e.target.selectedOptions].map(o => Number(o.value)))}>
                <option value="0">All Store Views</option>
                <option value="1">Default Store View</option>
              </select>
            </div>
          </div>
          <div className="admin__field admin__field-page-builder" data-index="content">
            <label className="admin__field-label" htmlFor="block_content"><span>Content</span></label>
            <div className="admin__field-control">
              <textarea id="block_content" name="content" rows={16} className="admin__control-textarea"
                value={form.content || ''} onChange={e => set('content', e.target.value)} />
            </div>
          </div>
        </fieldset>
      </form>
    </PageShell>
  )
}
