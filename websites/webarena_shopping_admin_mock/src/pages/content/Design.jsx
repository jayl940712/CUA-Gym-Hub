import React, { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import LegacyAdminGrid from '../../components/grid/LegacyAdminGrid.jsx'
import RecordForm, { useSystemCollection } from '../../components/system/RecordForm.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useSidNavigate } from '../../utils/navigation.js'
import { WIDGET_INSTANCES, WIDGET_TYPES } from '../../components/content/contentData.js'
import '../../components/system/system.css'

/**
 * Content > Elements / Design — ROUTES rows 105-111.
 *
 * Themes and the design-config scope rows come out of `systemConfig.json`
 * (`theme`, `store_website`, `store_group`, `store`) and `coreConfig.json`
 * (`design/theme/theme_id` = 3 → Magento Luma at default scope). Tasks 374/375
 * land on the theme pages, so their titles must be exactly
 * "Theme: Magento Blank" / "Theme: Magento Luma".
 */

function themes(state) {
  return state?.systemConfig?.themes || []
}

/** The theme actually applied at a scope; only `default` is set in this DB. */
function appliedThemeId(state) {
  const row = (state?.coreConfig || []).find(c => c.path === 'design/theme/theme_id' && c.scope === 'default')
  return row?.value ?? ''
}

/* A widget row's `type` may be the visible label (seed, matching the source's
 * grid cell) or the FQCN (anything created through the New Widget form, which
 * posts what the source's select posts). Normalise both ways. */
function widgetTypeLabel(type) {
  return WIDGET_TYPES.find(t => t.value === type)?.label ?? type
}
function widgetTypeValue(type) {
  return WIDGET_TYPES.find(t => t.label === type)?.value ?? type
}

/* -------------------------------------------------------------- Widgets (105) */

export function Widgets() {
  /* `WIDGET_INSTANCES` is the source-installed set; widgets created through the
     New Widget form live in state so they reach /go. */
  const navigate = useSidNavigate()
  const { rows: added, remove } = useSystemCollection('widgets', 'instance_id')
  const columns = [
    { id: 'instance_id', label: 'Widget ID', filterType: 'text', sortValue: r => Number(r.instance_id) },
    {
      id: 'title', label: 'Widget', filterType: 'text', searchValue: r => r.title,
      render: r => (
        <AdminLink to={`/admin/admin/widget_instance/edit/instance_id/${r.instance_id}/code/${r.code || 'cms_static_block'}/`}>
          {r.title}
        </AdminLink>
      ),
      exportValue: r => r.title,
    },
    {
      /* The rows carry the human label (that is what the source's grid cell
         shows); the filter posts the FQCN, so map row -> FQCN for comparison. */
      id: 'type', label: 'Type', filterType: 'select',
      options: WIDGET_TYPES.map(t => ({ ...t })),
      render: r => widgetTypeLabel(r.type),
      searchValue: r => widgetTypeLabel(r.type),
      exportValue: r => widgetTypeLabel(r.type),
      filterValue: r => widgetTypeValue(r.type),
    },
    {
      /* Round 10 — the source's control is `[name="theme_id"]`, keyed by theme id. */
      id: 'theme', label: 'Design Theme', filterType: 'select', filterName: 'theme_id',
      options: [{ value: '1', label: 'Magento Blank' }, { value: '3', label: 'Magento Luma' }],
      filterValue: r => ({ 'Magento Blank': '1', 'Magento Luma': '3' }[r.theme] ?? ''),
    },
    { id: 'sort_order', label: 'Sort Order', filterType: 'text', sortValue: r => Number(r.sort_order) },
  ]

  const actions = (
    <button type="button" id="add" title="Add Widget"
      data-ui-id="adminhtml-widget-instance-grid-container-add-button"
      className="action-default scalable add primary"
      onClick={() => navigate('/admin/admin/widget_instance/new/')}>
      <span>Add Widget</span>
    </button>
  )

  return (
    <PageShell title="Widgets" actions={actions}>
      {/* Round 10. LEGACY on the source, with the massaction bar
        * (`widgetInstanceGrid_massaction-select`) and the `massaction`
        * Any/Yes/No filter in the leading column, whose header is EMPTY.
        *
        * F-02 (round 11) — `rowSelectName` is `delete`, the massaction's own
        * field name in `Widget/Adminhtml/Widget/Instance/Grid`, not the grid
        * id. Naming them `widget_instance` made `[name="delete"]` match nothing
        * and put 17 same-named controls on the page that the source never
        * emits. Live source: `<input type="checkbox" name="delete" id="id_<n>"
        * value="<instance_id>">` × 17. */}
      <LegacyAdminGrid legacyToolbarBase={0} gridId="widgetInstanceGrid"
        basePath="/admin/admin/widget_instance/index"
        rows={[...WIDGET_INSTANCES, ...added]} columns={columns}
        rowKey={r => r.instance_id} rowSelectValue={r => r.instance_id}
        rowSelectName="delete" selectable massActionFilter
        massActions={[{
          id: 'delete',
          label: 'Delete',
          /* Only widgets created through the New Widget form live in state and
             can be removed; the source-installed set is part of the frozen seed,
             so a mass delete over those rows is a no-op rather than a fake
             success. */
          onApply: ids => ids.forEach(id => remove(id)),
        }]}
        exportable={false} exportFileName="widgets"
        defaultSort={{ field: 'instance_id', direction: 'asc' }} />
    </PageShell>
  )
}

/* -------------------------------------------------------- Media Gallery (106) */

/**
 * Manage Gallery (106). The source's folder rail and sort menu are transcribed
 * from the live page; `pub/media` itself is not part of the mock, so the asset
 * grid is the source's own "0 records found" empty state.
 */
const MEDIA_FOLDERS = [
  'category',
  'wysiwyg',
  'collection', 'gear', 'giftcards', 'home', 'mens', 'new', 'sale', 'training', 'womens',
]

export function MediaGallery() {
  const { addMessage } = useApp()
  const [folder, setFolder] = useState('category')
  const [sort, setSort] = useState('newest')

  const actions = (
    <>
      {/* F-07 — the source's five gallery buttons, with its ids; PageShell
          derives `search-adobe-stock-button`, `delete-massaction-button`,
          `delete-folder-button`, `create-folder-button` and
          `upload-image-button` from them, which is what the source emits. */}
      <button type="button" id="search_adobe_stock" className="action-default scalable"
        onClick={() => addMessage('Adobe Stock integration is not configured.', 'notice')}>
        <span>Search Adobe Stock</span>
      </button>
      <button type="button" id="delete_massaction" className="action-default scalable"
        onClick={() => addMessage('Please select an image to delete.', 'error')}>
        <span>Delete Images...</span>
      </button>
      <button type="button" id="delete_folder" className="action-default scalable"
        onClick={() => addMessage('Please select a folder to delete.', 'error')}>
        <span>Delete Folder</span>
      </button>
      <button type="button" id="create_folder" className="action-default scalable"
        onClick={() => addMessage('Folder creation is disabled in this environment.', 'notice')}>
        <span>Create Folder</span>
      </button>
      <button type="button" id="upload_image" className="action-default scalable primary"
        onClick={() => addMessage('Image upload is disabled in this environment.', 'notice')}>
        <span>Upload Image</span>
      </button>
    </>
  )

  return (
    <PageShell title="Manage Gallery" actions={actions}>
      <div className="media-gallery">
        <div className="media-gallery__tree">
          <ul className="media-gallery__folders">
            {MEDIA_FOLDERS.map(name => (
              <li key={name}>
                <button type="button" className={folder === name ? '_active' : ''} onClick={() => setFolder(name)}>
                  {name}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="media-gallery__content">
          <div className="admin__data-grid-filters-current _show">
            <span className="admin__current-filters-list-label">Active filters:</span>
            <ul className="admin__current-filters-list">
              <li>
                <span className="admin__current-filters-list-label">Directory:</span>
                <span className="admin__current-filters-list-value">{folder}</span>
              </li>
            </ul>
          </div>
          <div className="media-gallery__toolbar">
            <span className="admin__data-grid-records-count">
              <span className="admin__data-grid-records-count-number">0</span> records found
            </span>
            <label htmlFor="media-sort">Sort by:</label>
            <select id="media-sort" className="admin__control-select" value={sort}
              onChange={e => setSort(e.target.value)}>
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="dir_desc">Directory: Descending</option>
              <option value="dir_asc">Directory: Ascending</option>
              <option value="name_asc">Name: A to Z</option>
              <option value="name_desc">Name: Z to A</option>
            </select>
          </div>
          <div className="admin__data-grid-empty">We couldn&apos;t find any records.</div>
        </div>
      </div>
    </PageShell>
  )
}

/* -------------------------------------------------- Design Configuration (107) */

export function DesignConfig() {
  const { state, setState, addMessage } = useApp()
  const [editing, setEditing] = useState(null)
  const [draft, setDraft] = useState('')

  const themeList = themes(state)
  const defaultThemeId = appliedThemeId(state)

  const rows = useMemo(() => {
    const websites = (state?.systemConfig?.websites || []).filter(w => w.code !== 'admin')
    const groups = state?.systemConfig?.store_groups || []
    const stores = (state?.systemConfig?.stores || []).filter(s => s.code !== 'admin')
    // "3 records found" in the source: the Default (Global) row, one per
    // website, one per store view — every one showing the inherited theme.
    const out = [{ key: 'default/0', scope: 'Global', website: '', store: '', store_view: '', theme_id: defaultThemeId }]
    for (const w of websites) {
      out.push({ key: `websites/${w.website_id}`, scope: 'Global', website: w.name, store: '', store_view: '', theme_id: defaultThemeId })
    }
    for (const s of stores) {
      const g = groups.find(x => x.group_id === s.group_id)
      const w = websites.find(x => x.website_id === s.website_id)
      out.push({
        key: `stores/${s.store_id}`, scope: 'Global',
        website: w?.name || '', store: g?.name || '', store_view: s.name, theme_id: defaultThemeId,
      })
    }
    return out
  }, [state, defaultThemeId])

  function themeName(id) {
    if (!id) return '-- No Theme --'
    return themeList.find(t => String(t.theme_id) === String(id))?.theme_title ?? '-- No Theme --'
  }

  function startEdit(row) { setEditing(row.key); setDraft(String(row.theme_id || '')) }

  function saveEdit() {
    setState(prev => ({
      ...prev,
      coreConfig: (prev.coreConfig || []).map(c => (
        c.path === 'design/theme/theme_id' && c.scope === 'default' ? { ...c, value: draft } : c)),
    }))
    setEditing(null)
    addMessage('You saved the configuration.')
  }

  const columns = [
    { id: 'scope', label: 'Default', filterType: 'text' },
    { id: 'website', label: 'Website', filterType: 'text' },
    { id: 'store', label: 'Store', filterType: 'text' },
    { id: 'store_view', label: 'Store View', filterType: 'text' },
    {
      id: 'theme_id', label: 'Theme Name', filterType: 'select',
      options: [{ value: '', label: '-- No Theme --' },
        ...themeList.filter(t => t.area === 'frontend').map(t => ({ value: String(t.theme_id), label: t.theme_title }))],
      render: r => (editing === r.key ? (
        <select className="admin__control-select" value={draft} onChange={e => setDraft(e.target.value)}
          aria-label="Theme Name">
          <option value="">-- No Theme --</option>
          {themeList.filter(t => t.area === 'frontend').map(t => (
            <option key={t.theme_id} value={String(t.theme_id)}>{t.theme_title}</option>
          ))}
        </select>
      ) : themeName(r.theme_id)),
      exportValue: r => themeName(r.theme_id),
      filterValue: r => String(r.theme_id || ''),
    },
    {
      id: 'action', label: 'Action', sortable: false, filterType: null,
      render: r => (editing === r.key ? (
        <>
          <button type="button" className="action-tertiary" onClick={saveEdit}>Save</button>
          <button type="button" className="action-tertiary" onClick={() => setEditing(null)}>Cancel</button>
        </>
      ) : (
        <button type="button" className="action-menu-item" onClick={() => startEdit(r)}>Edit</button>
      )),
      exportValue: () => '',
    },
  ]

  return (
    <PageShell title="Design Configuration">
      <AdminGrid gridId="design_config_grid" rows={rows} columns={columns} rowKey={r => r.key}
        exportFileName="design_config" />
    </PageShell>
  )
}

/* --------------------------------------------------------------- Themes (108) */

export function ThemesGrid() {
  const { state } = useApp()
  const all = themes(state)
  // The source lists "2 records found": only `area = frontend` themes appear,
  // so the adminhtml theme (id 2, Magento 2 backend) is filtered out. There is
  // no ID column on this grid.
  const rows = all.filter(t => t.area === 'frontend')

  function parentTitle(row) {
    if (!row.parent_id) return ''
    return all.find(t => String(t.theme_id) === String(row.parent_id))?.theme_title ?? ''
  }

  const columns = [
    {
      id: 'theme_title', label: 'Theme Title', filterType: 'text', searchValue: r => r.theme_title,
      render: r => (
        <AdminLink to={`/admin/admin/system_design_theme/edit/id/${r.theme_id}/`}>{r.theme_title}</AdminLink>
      ),
      exportValue: r => r.theme_title,
    },
    { id: 'parent_id', label: 'Parent Theme', filterType: 'text', render: parentTitle, exportValue: parentTitle },
    { id: 'theme_path', label: 'Theme Path', filterType: 'text', searchValue: r => r.theme_path },
    {
      id: 'action', label: 'Action', sortable: false, filterType: null,
      render: r => (
        <AdminLink to={`/admin/admin/system_design_theme/edit/id/${r.theme_id}/`} className="action-menu-item">
          View
        </AdminLink>
      ),
      exportValue: () => '',
    },
  ]

  return (
    <PageShell title="Themes">
      <AdminGrid gridId="theme_listing" rows={rows} columns={columns} rowKey={r => r.theme_id}
        exportFileName="themes" defaultSort={{ field: 'theme_title', direction: 'asc' }} />
    </PageShell>
  )
}

/**
 * Theme settings (109). Every theme in this deployment is a *physical* theme, so
 * the source renders its fields read-only with `Back` as the only button — there
 * is no Save. Tasks 374/375 read the Theme Title / Parent Theme / Theme Path.
 */
export function ThemeEdit() {
  const { id } = useParams()
  const { state } = useApp()
  const navigate = useSidNavigate()
  const list = themes(state)
  const theme = list.find(t => String(t.theme_id) === String(id))

  if (!theme) {
    return (
      <PageShell title="Theme">
        <div className="admin__data-grid-empty">We couldn&apos;t find a theme with this ID.</div>
      </PageShell>
    )
  }

  const parent = list.find(t => String(t.theme_id) === String(theme.parent_id))

  const actions = (
    <button type="button" id="back" data-ui-id="theme-edit-back-button"
      className="action-default scalable back"
      onClick={() => navigate('/admin/admin/system_design_theme/')}><span>Back</span></button>
  )

  return (
    <PageShell title={`Theme: ${theme.theme_title}`} actions={actions}>
      <div className="admin__page-nav">
        <ul className="admin__page-nav-items">
          <li className="admin__page-nav-item _active"><span className="admin__page-nav-link">General</span></li>
          <li className="admin__page-nav-item"><span className="admin__page-nav-link">Theme Files</span></li>
        </ul>
      </div>
      <form id="theme_form">
        <input type="hidden" name="theme[theme_id]" value={theme.theme_id} readOnly />
        <fieldset className="admin__fieldset">
          <legend className="admin__legend"><span>Theme Settings</span></legend>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="theme_parent_id"><span>Parent Theme</span></label>
            <div className="admin__field-control">
              <input id="theme_parent_id" name="theme[parent_id]" type="text" className="admin__control-text"
                value={parent?.theme_title ?? ''} readOnly disabled />
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="theme_path"><span>Theme Path</span></label>
            <div className="admin__field-control">
              <input id="theme_path" name="theme[theme_path]" type="text" className="admin__control-text"
                value={theme.theme_path} readOnly disabled />
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="theme_title"><span>Theme Title</span></label>
            <div className="admin__field-control">
              <input id="theme_title" name="theme[theme_title]" type="text" className="admin__control-text"
                value={theme.theme_title} readOnly disabled />
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="theme_preview"><span>Theme Preview Image</span></label>
            <div className="admin__field-control">
              <span id="theme_preview" className="admin__field-value">{theme.preview_image || ''}</span>
            </div>
          </div>
        </fieldset>
      </form>
    </PageShell>
  )
}

/* ------------------------------------------------ Store Design Schedule (110) */

export function DesignSchedule() {
  const navigate = useSidNavigate()
  const { rows } = useSystemCollection('design_changes', 'design_change_id')
  const columns = [
    /* DIFF-R102 — `no-link` on the source: filterable, not sortable. */
    { id: 'store_id', label: 'Store', filterType: 'select', sortable: false, options: [{ value: '1', label: 'Default Store View' }] },
    {
      /* Round 10 — the source's control is `[name="package"]` keyed by theme id. */
      id: 'design', label: 'Design', filterType: 'select', filterName: 'package',
      options: [{ value: '1', label: 'Magento Blank' }, { value: '3', label: 'Magento Luma' }],
      filterValue: r => ({ 'Magento/blank': '1', 'Magento/luma': '3' }[r.design] ?? ''),
    },
    { id: 'date_from', label: 'Date From', filterType: 'date' },
    { id: 'date_to', label: 'Date To', filterType: 'date' },
  ]
  const actions = (
    /* F-07 — the source's button has a per-request random id and the stable
       hook `data-ui-id="page-actions-toolbar-add-new-button"`. */
    <button type="button" title="Add Design Change"
      data-ui-id="page-actions-toolbar-add-new-button"
      className="action-default scalable add primary add-design-change"
      onClick={() => navigate('/admin/admin/system_design/new/')}>
      <span>Add Design Change</span>
    </button>
  )
  return (
    <PageShell title="Store Design Schedule" actions={actions}>
      {/* Round 10. LEGACY on the source; its grid id is `designGrid`. */}
      <LegacyAdminGrid legacyToolbarBase={0} gridId="designGrid"
        basePath="/admin/admin/system_design/index" rows={rows} columns={columns}
        rowKey={r => r.design_change_id} exportable={false} exportFileName="design_schedule" />
    </PageShell>
  )
}

/* ------------------------------------------------ PageBuilder Templates (111) */

export function PageBuilderTemplates() {
  const columns = [
    { id: 'template_id', label: 'ID', filterType: 'text' },
    { id: 'preview_image', label: 'Preview Image', sortable: false, filterType: null },
    { id: 'name', label: 'Template Name', filterType: 'text' },
    { id: 'created_for', label: 'Created For', filterType: 'text' },
    { id: 'created_at', label: 'Created', filterType: 'date' },
  ]
  return (
    <PageShell title="Templates">
      <AdminGrid gridId="pagebuilder_template_listing" rows={[]} columns={columns} rowKey={r => r.template_id}
        exportFileName="pagebuilder_templates" />
    </PageShell>
  )
}

/* --------------------------- create/edit forms for the Content grids (105/110) */

/**
 * HANDLERS-011. `/admin/admin/widget_instance/new` and
 * `/admin/admin/system_design/new` used to re-render their own grid.
 *
 * Source labels read live: the New Widget page's fieldset is **Settings** with
 * `Type` and `Design Theme` (its H1 is `Widgets`, and `Continue` reveals the
 * storefront-properties step); New Store Design Change is **General Settings**
 * with `Store`, `Custom Design`, `Date From`, `Date To` and a single `Save`.
 */

export function WidgetForm() {
  const { id, code } = useParams()
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  const { rows, add, update, remove } = useSystemCollection('widgets', 'instance_id')
  const seeded = WIDGET_INSTANCES.find(r => String(r.instance_id) === String(id))
  const existing = id ? rows.find(r => String(r.instance_id) === String(id)) : null
  const record = existing || seeded
  const backTo = '/admin/admin/widget_instance/'

  return (
    <RecordForm
      title="Widgets"
      documentTitle={record ? record.title : 'New Widget'}
      legend="Settings"
      backTo={backTo}
      uiPrefix="widget-instance-edit"
      saveLabel="Save"
      deleteLabel="Delete"
      initial={{
        title: record?.title ?? '',
        type: record?.type ?? WIDGET_TYPES[0].value,
        theme: record?.theme ?? 'Magento Luma',
        sort_order: String(record?.sort_order ?? 0),
      }}
      fields={[
        { name: 'title', label: 'Widget Title', required: true },
        {
          name: 'type', label: 'Type', type: 'select',
          options: WIDGET_TYPES.map(t => ({ ...t })),
        },
        {
          name: 'theme', label: 'Design Theme', type: 'select',
          options: [
            { value: 'Magento Luma', label: 'Magento Luma' },
            { value: 'Magento Blank', label: 'Magento Blank' },
          ],
        },
        { name: 'sort_order', label: 'Sort Order' },
      ]}
      onDelete={existing ? () => {
        remove(existing.instance_id)
        addMessage('The widget instance has been deleted.')
        navigate(backTo)
      } : null}
      onSave={form => {
        const patch = { ...form, sort_order: Number(form.sort_order) || 0, code: code || record?.code }
        if (existing) update(existing.instance_id, patch)
        else if (seeded) add({ ...seeded, ...patch })
        else {
          const base = [...WIDGET_INSTANCES, ...rows]
            .reduce((m, r) => Math.max(m, Number(r.instance_id) || 0), 0)
          add({ instance_id: base + 1, ...patch })
        }
        addMessage('The widget instance has been saved.')
        navigate(backTo)
      }}
    />
  )
}

export function DesignChangeForm() {
  const { id } = useParams()
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  const { rows, nextId, add, update, remove } = useSystemCollection('design_changes', 'design_change_id')
  const existing = id ? rows.find(r => String(r.design_change_id) === String(id)) : null
  const backTo = '/admin/admin/system_design/'

  return (
    <RecordForm
      title={existing ? 'Edit Store Design Change' : 'New Store Design Change'}
      documentTitle={existing ? 'Edit Store Design Change' : 'New Store Design Change'}
      legend="General Settings"
      backTo={backTo}
      uiPrefix="page-actions-toolbar"
      saveLabel="Save"
      deleteLabel="Delete"
      initial={{
        store_id: String(existing?.store_id ?? 1),
        design: existing?.design ?? 'Magento/luma',
        date_from: existing?.date_from ?? '',
        date_to: existing?.date_to ?? '',
      }}
      fields={[
        {
          name: 'store_id', label: 'Store', type: 'select',
          options: [{ value: '1', label: 'Default Store View' }],
        },
        {
          name: 'design', label: 'Custom Design', type: 'select',
          options: [
            { value: 'Magento/luma', label: 'Magento Luma' },
            { value: 'Magento/blank', label: 'Magento Blank' },
          ],
        },
        { name: 'date_from', label: 'Date From', type: 'date' },
        { name: 'date_to', label: 'Date To', type: 'date' },
      ]}
      onDelete={existing ? () => {
        remove(existing.design_change_id)
        addMessage('You deleted the design change.')
        navigate(backTo)
      } : null}
      onSave={form => {
        const record = { ...form, store_id: Number(form.store_id) }
        if (existing) update(existing.design_change_id, record)
        else add({ design_change_id: nextId(), ...record })
        addMessage('You saved the design change.')
        navigate(backTo)
      }}
    />
  )
}
