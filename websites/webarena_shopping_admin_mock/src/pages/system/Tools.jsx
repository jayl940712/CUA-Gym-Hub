import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import LegacyAdminGrid from '../../components/grid/LegacyAdminGrid.jsx'
import RecordForm, { useSystemCollection, useSystemMap, useSystemLog } from '../../components/system/RecordForm.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { formatDateTime } from '../../utils/formatters.js'
import { useSidNavigate } from '../../utils/navigation.js'
import {
  CACHE_TYPES, INDEXERS, INTEGRATIONS, IMPORT_HISTORY, ADMIN_NOTIFICATIONS,
} from '../../components/system/systemData.js'
import '../../components/system/system.css'

/**
 * System > Tools / Data Transfer / Other Settings — ROUTES rows 122-130, 133.
 *
 * The source's server-side machinery (cache flush, reindex, import/export job
 * execution) is explicitly out of scope per ROUTES "Intentionally Not Migrated":
 * the screens render with real rows and the actions report the same message the
 * source shows, without pretending to have done server work.
 */

/* ------------------------------------------------------ Custom Variables (122) */

export function CustomVariables() {
  const { state } = useApp()
  const navigate = useSidNavigate()
  const rows = state?.systemConfig?.variables || []
  const columns = [
    { id: 'variable_id', label: 'Variable ID', filterType: 'text', sortValue: r => Number(r.variable_id) },
    { id: 'code', label: 'Variable Code', filterType: 'text' },
    { id: 'name', label: 'Name', filterType: 'text' },
  ]
  const actions = (
    <button type="button" id="add" title="Add New Variable"
      className="action-default scalable add primary"
      onClick={() => navigate('/admin/admin/system_variable/new/')}>
      <span>Add New Variable</span>
    </button>
  )
  return (
    <PageShell title="Custom Variables" actions={actions}
      actionsUiPrefix="adminhtml-system-variable-grid-container-">
      {/* Round 10. LEGACY on the source. */}
      <LegacyAdminGrid legacyToolbarBase={0} gridId="customVariablesGrid"
        basePath="/admin/admin/system_variable/index" rows={rows} columns={columns}
        rowKey={r => r.variable_id} exportable={false} exportFileName="custom_variables"
        defaultSort={{ field: 'variable_id', direction: 'asc' }} />
    </PageShell>
  )
}

/* ------------------------------------------------------ Cache Management (123) */

export function CacheManagement() {
  const { addMessage } = useApp()
  // PIPELINE-021: the status overlay and the flush log both live in
  // `state.systemConfig`, so enabling a cache type or flushing a store survives
  // navigation and shows up in /go's state_diff. Previously both printed the
  // source's success copy against a component-local useState.
  const { map: statuses, setMany } = useSystemMap('cacheStatus')
  const { append: logFlush } = useSystemLog('cacheFlushLog')

  const rows = CACHE_TYPES.map(c => ({ ...c, status: statuses[c.tags] ?? c.status }))

  /** Record a flush the way the source's cache log would: what, and when. */
  function flush(target, message) {
    logFlush({ target, at: new Date().toISOString() })
    addMessage(message)
  }

  const columns = [
    { id: 'type', label: 'Cache Type', filterType: 'text', searchValue: r => r.type },
    { id: 'desc', label: 'Description', filterType: 'text' },
    { id: 'tags', label: 'Tags', filterType: 'text' },
    {
      id: 'status', label: 'Status', filterType: 'select',
      options: [{ value: 'Enabled', label: 'Enabled' }, { value: 'Disabled', label: 'Disabled' }],
    },
  ]

  /* Order and ids are `adminhtml_cache_block.xml`'s `massaction` options
     verbatim — Enable · Disable · Refresh, with `refresh` carrying
     `<item name="selected">1</item>`, which is why the source's cold-load
     `#cache_grid_massaction-select` already reads `refresh`. The mock had
     Refresh first, so an evaluator selecting by option INDEX landed on the
     wrong action. */
  const massActions = [
    {
      id: 'enable',
      label: 'Enable',
      onApply: ids => { setMany(ids, 'Enabled'); addMessage(`${ids.length} cache type(s) enabled.`) },
    },
    {
      id: 'disable',
      label: 'Disable',
      onApply: ids => { setMany(ids, 'Disabled'); addMessage(`${ids.length} cache type(s) disabled.`) },
    },
    {
      id: 'refresh',
      label: 'Refresh',
      onApply: ids => flush(`cache types: ${ids.join(', ')}`, `${ids.length} cache type(s) refreshed.`),
    },
  ]

  const actions = (
    <>
      {/* F-07. Source ids, verbatim from assets/html/admin-cache.html: the two
          header buttons are `#flush_magento` / `#flush_system` and carry
          `data-ui-id="adminhtml-cache-container-flush-{magento,system}-button"`;
          the three Additional Cache Management buttons are bare
          `<button id="flushJsCss" type="button">` with NO data-ui-id, so they
          opt out of PageShell's derivation with `data-ui-id={null}`. */}
      <button type="button" id="flushJsCss" data-ui-id={null} className="action-default scalable"
        onClick={() => flush('js_css', 'The JavaScript/CSS cache has been cleaned.')}>
        <span>Flush JavaScript/CSS Cache</span>
      </button>
      <button type="button" id="flushStaticFiles" data-ui-id={null} className="action-default scalable"
        onClick={() => flush('static_files', 'The static files cache has been cleaned.')}>
        <span>Flush Static Files Cache</span>
      </button>
      <button type="button" id="flushCatalogImages" data-ui-id={null} className="action-default scalable"
        onClick={() => flush('catalog_images', 'The image cache was cleaned.')}>
        <span>Flush Catalog Images Cache</span>
      </button>
      <button type="button" id="flush_system" title="Flush Cache Storage"
        className="action-default scalable flush-cache-storage"
        onClick={() => flush('cache_storage', 'You flushed the cache storage.')}>
        <span>Flush Cache Storage</span>
      </button>
      <button type="button" id="flush_magento" title="Flush Magento Cache"
        className="action-default scalable primary flush-cache-magento"
        onClick={() => flush('magento_cache', 'The Magento cache storage has been flushed.')}>
        <span>Flush Magento Cache</span>
      </button>
    </>
  )

  return (
    <PageShell title="Cache Management" actions={actions}
      actionsUiPrefix="adminhtml-cache-container-">
      {/* Round 10. LEGACY on the source, but a legacy grid with NO filter row
        * (1-row `<thead>`, no Search / Reset Filter) and NO pager — the records
        * count still sits in `.admin__control-support-text`, and the massaction
        * bar (`cache_grid_massaction-select` + Submit) is there. */}
      <LegacyAdminGrid legacyMassactionIndex={2} gridId="cache_grid"
        basePath="/admin/admin/cache" rows={rows} columns={columns} rowKey={r => r.tags}
        filterRow={false} sortableColumns={false}
        rowSelectValue={r => r.tags} rowSelectName="types"
        selectable massActions={massActions} massActionDefault="refresh" pager={false}
        exportable={false} exportFileName="cache_types" />
    </PageShell>
  )
}

/* ------------------------------------------------------ Index Management (124) */

export function IndexManagement() {
  const { addMessage } = useApp()
  // Every indexer starts "Update on Save" / "Ready" in this deployment.
  // PIPELINE-021: the mode and status overlays live in `state.systemConfig`, so
  // a mode change survives navigation and reaches /go — the source's Index
  // Management mode is a persisted setting, not a view toggle.
  const { map: modes, setMany: setModes } = useSystemMap('indexerModes')
  const { map: statuses, setMany: setStatuses } = useSystemMap('indexerStatuses')

  const rows = INDEXERS.map(i => ({
    ...i,
    mode: modes[i.indexer_id] ?? 'UPDATE ON SAVE',
    status: statuses[i.indexer_id] ?? 'READY',
  }))

  const columns = [
    { id: 'title', label: 'Indexer', filterType: 'text', searchValue: r => r.title },
    { id: 'description', label: 'Description', filterType: 'text' },
    {
      id: 'mode', label: 'Mode', filterType: 'select',
      options: [{ value: 'UPDATE ON SAVE', label: 'Update on Save' },
        { value: 'UPDATE BY SCHEDULE', label: 'Update by Schedule' }],
    },
    {
      id: 'status', label: 'Status', filterType: 'select',
      options: [{ value: 'READY', label: 'Ready' }, { value: 'REINDEX REQUIRED', label: 'Reindex required' }],
    },
    { id: 'schedule_status', label: 'Schedule Status', sortable: false, filterType: null, render: () => '' },
    {
      id: 'updated', label: 'Updated', filterType: 'date',
      render: r => formatDateTime(r.updated), exportValue: r => formatDateTime(r.updated),
    },
  ]

  /* F-01g — the massaction option VALUES are Magento's own action ids, measured
     verbatim on the source's `#gridIndexer_massaction-select`:
     `change_mode_onthefly` / `change_mode_changelog` / `invalidate_index`.
     The mock had shortened them to `realtime` / `schedule` / `invalidate`, so
     `select_option('#gridIndexer_massaction-select', 'change_mode_onthefly')`
     RAISED. Labels and order were already the source's. */
  const massActions = [
    {
      id: 'change_mode_onthefly',
      label: 'Update on Save',
      onApply: ids => { setModes(ids, 'UPDATE ON SAVE'); addMessage(`${ids.length} indexer(s) are invalidated.`) },
    },
    {
      id: 'change_mode_changelog',
      label: 'Update by Schedule',
      onApply: ids => { setModes(ids, 'UPDATE BY SCHEDULE'); addMessage(`${ids.length} indexer(s) are invalidated.`) },
    },
    {
      id: 'invalidate_index',
      label: 'Invalidate index',
      onApply: ids => { setStatuses(ids, 'REINDEX REQUIRED'); addMessage(`${ids.length} indexer(s) are invalidated.`) },
    },
  ]

  return (
    <PageShell title="Index Management">
      {/* Round 10. LEGACY on the source, no filter row and no pager; the
        * source's grid id is `gridIndexer` (`gridIndexer_massaction-select`),
        * not the UI-component `indexer_listing`. */}
      <LegacyAdminGrid legacyMassactionIndex={2} gridId="gridIndexer"
        basePath="/admin/indexer/indexer/list" rows={rows} columns={columns}
        filterRow={false} sortableColumns={false}
        rowKey={r => r.indexer_id} rowSelectValue={r => r.indexer_id} rowSelectName="indexer_ids"
        selectable massActions={massActions} pager={false}
        exportable={false} exportFileName="indexers" />
    </PageShell>
  )
}

/* -------------------------------------------------------- Import / Export (125) */

const IMPORT_ENTITIES = [
  { value: '', label: '-- Please Select --' },
  { value: 'advanced_pricing', label: 'Advanced Pricing' },
  { value: 'catalog_product', label: 'Products' },
  { value: 'customer_composite', label: 'Customers and Addresses (single file)' },
  { value: 'customer', label: 'Customers Main File' },
  { value: 'customer_address', label: 'Customer Addresses' },
  { value: 'stock_sources', label: 'Stock Sources' },
]

export function ImportPage() {
  const { addMessage } = useApp()
  const [entity, setEntity] = useState('')
  const [behavior, setBehavior] = useState('append')
  /* HANDLERS-030. These were uncontrolled `defaultValue` inputs, so switching
   * Entity Type remounts the Import Behavior fieldset and silently discards
   * whatever the agent typed. The import itself is server-side machinery that
   * TODO.md scopes out, but the fields have to hold their value. */
  const [opts, setOpts] = useState({
    validation_strategy: 'validation-stop-on-errors',
    allowed_error_count: '10',
    _import_field_separator: ',',
    _import_multiple_value_separator: ',',
    _import_empty_attribute_value_constant: '__EMPTY__VALUE__',
    fields_enclosure: false,
    import_file: '',
    import_images_file_dir: '',
  })
  const setOpt = (k, v) => setOpts(o => ({ ...o, [k]: v }))

  const actions = (
    <button type="button" id="upload_button" data-ui-id="import-form-container-upload-button-button"
      className="action-default scalable primary"
      onClick={() => addMessage(entity
        ? 'Data validation is not available in this environment.'
        : 'Entity type is a required field.', entity ? 'notice' : 'error')}>
      <span>Check Data</span>
    </button>
  )

  return (
    <PageShell title="Import" actions={actions}>
      <form id="import_edit_form">
        <fieldset className="admin__fieldset">
          <legend className="admin__legend"><span>Import Settings</span></legend>
          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="entity"><span>Entity Type</span></label>
            <div className="admin__field-control">
              <select id="entity" name="entity" className="admin__control-select"
                value={entity} onChange={e => setEntity(e.target.value)}>
                {IMPORT_ENTITIES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>
        </fieldset>

        {entity ? (
          <>
            <fieldset className="admin__fieldset">
              <legend className="admin__legend"><span>Import Behavior</span></legend>
              <div className="admin__field _required">
                <label className="admin__field-label" htmlFor="behavior"><span>Import Behavior</span></label>
                <div className="admin__field-control">
                  <select id="behavior" name="behavior" className="admin__control-select"
                    value={behavior} onChange={e => setBehavior(e.target.value)}>
                    <option value="append">Add/Update</option>
                    <option value="replace">Replace</option>
                    <option value="delete">Delete</option>
                  </select>
                </div>
              </div>
              <div className="admin__field">
                <label className="admin__field-label" htmlFor="validation_strategy">
                  <span>Validation Strategy</span>
                </label>
                <div className="admin__field-control">
                  <select id="validation_strategy" name="validation_strategy" className="admin__control-select"
                    value={opts.validation_strategy}
                    onChange={e => setOpt('validation_strategy', e.target.value)}>
                    <option value="validation-stop-on-errors">Stop on Error</option>
                    <option value="validation-skip-errors">Skip error entries</option>
                  </select>
                </div>
              </div>
              <div className="admin__field">
                <label className="admin__field-label" htmlFor="allowed_error_count">
                  <span>Allowed Errors Count</span>
                </label>
                <div className="admin__field-control">
                  <input id="allowed_error_count" name="allowed_error_count" type="text"
                    className="admin__control-text" value={opts.allowed_error_count}
                    onChange={e => setOpt('allowed_error_count', e.target.value)} />
                </div>
              </div>
              <div className="admin__field">
                <label className="admin__field-label" htmlFor="_import_field_separator">
                  <span>Field separator</span>
                </label>
                <div className="admin__field-control">
                  <input id="_import_field_separator" name="_import_field_separator" type="text"
                    className="admin__control-text" value={opts._import_field_separator}
                    onChange={e => setOpt('_import_field_separator', e.target.value)} />
                </div>
              </div>
              <div className="admin__field">
                <label className="admin__field-label" htmlFor="_import_multiple_value_separator">
                  <span>Multiple value separator</span>
                </label>
                <div className="admin__field-control">
                  <input id="_import_multiple_value_separator" name="_import_multiple_value_separator" type="text"
                    className="admin__control-text" value={opts._import_multiple_value_separator}
                    onChange={e => setOpt('_import_multiple_value_separator', e.target.value)} />
                </div>
              </div>
              <div className="admin__field">
                <label className="admin__field-label" htmlFor="_import_empty_attribute_value_constant">
                  <span>Empty attribute value constant</span>
                </label>
                <div className="admin__field-control">
                  <input id="_import_empty_attribute_value_constant" name="_import_empty_attribute_value_constant"
                    type="text" className="admin__control-text" value={opts._import_empty_attribute_value_constant}
                    onChange={e => setOpt('_import_empty_attribute_value_constant', e.target.value)} />
                </div>
              </div>
              <div className="admin__field">
                <label className="admin__field-label" htmlFor="basic_behaviorfields_enclosure">
                  <span>Fields enclosure</span>
                </label>
                <div className="admin__field-control">
                  <input id="basic_behaviorfields_enclosure" name="fields_enclosure" type="checkbox"
                    value="1" title="Fields enclosure"
                    data-ui-id="import-form-container-form-fieldset-element-checkbox-fields-enclosure"
                    className="admin__control-checkbox" checked={opts.fields_enclosure}
                    onChange={e => setOpt('fields_enclosure', e.target.checked)} />
                </div>
              </div>
            </fieldset>

            <fieldset className="admin__fieldset">
              <legend className="admin__legend"><span>File to Import</span></legend>
              <div className="admin__field _required">
                <label className="admin__field-label" htmlFor="import_file"><span>Select File to Import</span></label>
                <div className="admin__field-control">
                  <input id="import_file" name="import_file" type="file" accept=".csv" className="admin__control-file"
                    onChange={e => setOpt('import_file', e.target.value)} />
                </div>
              </div>
              <div className="admin__field">
                <label className="admin__field-label" htmlFor="import_images_file_dir">
                  <span>Images File Directory</span>
                </label>
                <div className="admin__field-control">
                  <input id="import_images_file_dir" name="import_images_file_dir" type="text"
                    className="admin__control-text" value={opts.import_images_file_dir}
                    onChange={e => setOpt('import_images_file_dir', e.target.value)} />
                </div>
              </div>
            </fieldset>
          </>
        ) : null}
      </form>
    </PageShell>
  )
}

export function ExportPage() {
  const { addMessage } = useApp()
  const [entity, setEntity] = useState('')
  // HANDLERS-030 — bind the two remaining uncontrolled export fields.
  const [fileFormat, setFileFormat] = useState('csv')
  const [enclosure, setEnclosure] = useState(false)

  const actions = (
    <button type="button" id="export_button" className="action-default scalable primary"
      onClick={() => addMessage(entity
        ? 'Message is added to queue, wait to get your file soon.'
        : 'Entity type is a required field.', entity ? 'success' : 'error')}>
      <span>Continue</span>
    </button>
  )

  return (
    <PageShell title="Export" actions={actions}>
      <form id="export_filter_form">
        <fieldset className="admin__fieldset">
          <legend className="admin__legend"><span>Export Settings</span></legend>
          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="export_entity"><span>Entity Type</span></label>
            <div className="admin__field-control">
              <select id="export_entity" name="entity" className="admin__control-select"
                value={entity} onChange={e => setEntity(e.target.value)}>
                {IMPORT_ENTITIES.filter(o => o.value !== 'customer_composite').map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="file_format"><span>Export File Format</span></label>
            <div className="admin__field-control">
              <select id="file_format" name="file_format" className="admin__control-select"
                value={fileFormat} onChange={e => setFileFormat(e.target.value)}>
                <option value="csv">CSV</option>
              </select>
            </div>
          </div>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="fields_enclosure"><span>Fields Enclosure</span></label>
            <div className="admin__field-control">
              <input id="fields_enclosure" name="fields_enclosure" type="checkbox" value="1"
                title="Fields Enclosure"
                data-ui-id="export-form-container-form-fieldset-element-checkbox-fields-enclosure"
                className="admin__control-checkbox" checked={enclosure}
                onChange={e => setEnclosure(e.target.checked)} />
            </div>
          </div>
        </fieldset>
      </form>
    </PageShell>
  )
}

/* --------------------------------------------------------- Import History (126) */

/**
 * DIFF-R102 sweep — this grid's timestamp carries a comma between the date and
 * the time (`Apr 19, 2023, 12:13:23 PM`), which the shared `formatDateTime`
 * does not emit.
 *
 * Deliberately local rather than a change to `formatDateTime`: the shared form
 * WITHOUT the comma was verified byte-identical to the source on
 * `/admin/customer/index/`, `/admin/cms/page/` and `/admin/sales/invoice/`, so
 * "fixing" it globally would have broken three grids to fix one. Magento
 * renders this legacy grid through `Magento\Framework\Stdlib\DateTime` at
 * MEDIUM date + MEDIUM time, and the modern UI-component grids through a
 * different pattern; the review grid's own formatter already has the comma.
 */
function formatImportDateTime(value) {
  const s = formatDateTime(value)
  return s ? s.replace(/^(\w+ \d+, \d{4}) /, '$1, ') : s
}

export function ImportHistory() {
  const columns = [
    { id: 'history_id', label: 'ID', filterType: 'text' },
    {
      id: 'started_at', label: 'Start Date&Time', filterType: 'date',
      render: r => formatImportDateTime(r.started_at),
      exportValue: r => formatImportDateTime(r.started_at),
    },
    { id: 'user', label: 'User', filterType: 'text', filterName: 'username' },
    { id: 'imported_file', label: 'Imported File', sortable: false, filterType: null },
    { id: 'error_file', label: 'Error File', sortable: false, filterType: null },
    { id: 'execution_time', label: 'Execution Time', filterType: null },
    { id: 'summary', label: 'Summary', filterType: null },
  ]
  return (
    <PageShell title="Import History">
      {/* Round 10. LEGACY on the source. */}
      <LegacyAdminGrid legacyToolbarBase={0} gridId="importHistoryGrid"
        basePath="/admin/admin/history/index" rows={IMPORT_HISTORY} columns={columns}
        rowKey={r => r.history_id} exportable={false} exportFileName="import_history"
        defaultSort={{ field: 'history_id', direction: 'desc' }} />
    </PageShell>
  )
}

/* ----------------------------------------------------------- Integrations (127) */

export function Integrations() {
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  /* `INTEGRATIONS` is the seeded, source-installed set; anything created
     through the New Integration form lives in state so it reaches /go. */
  const { rows: added } = useSystemCollection('integrations', 'integration_id')
  /* PIPELINE-021: Reauthorize activates the integration in the source, so it
     writes the status overlay rather than only printing the success copy. */
  const { map: statusOverride, setMany: setStatus } = useSystemMap('integrationStatus')
  const columns = [
    {
      id: 'name', label: 'Name', filterType: 'text', searchValue: r => r.name,
      render: r => (
        <>
          <span>{r.name}</span>
          {r.note ? <span className="integration-note">{r.note}</span> : null}
        </>
      ),
      exportValue: r => r.name,
    },
    {
      /* F-04 — the source's filter is `<select name="status">` with the raw
         Magento integration-status ints as values, in this order:
         '' / 0 Inactive / 1 Active / 2 Reset. The mock previously used the
         visible label as the value, so `select_option(sel,'1')` raised. */
      id: 'status', label: 'Status', filterType: 'select',
      options: [
        { value: '0', label: 'Inactive' },
        { value: '1', label: 'Active' },
        { value: '2', label: 'Reset' },
      ],
      filterValue: r => (r.status === 'Active' ? '1' : r.status === 'Reset' ? '2' : '0'),
    },
    {
      id: 'activate', label: 'Activate', sortable: false, filterType: null,
      render: r => (
        <button type="button" className="action-menu-item"
          onClick={() => {
            setStatus([r.integration_id], 'Active')
            addMessage(`The integration '${r.name}' has been reauthorized.`)
          }}>
          Reauthorize
        </button>
      ),
      exportValue: () => '',
    },
    {
      /* F-07 — the source renders the row controls as
         `<button id="edit" class="action edit" title="Edit">` /
         `<button id="delete" class="action delete" title="Remove">`, with no
         data-ui-id. The seeded grid has the source's single row, so the ids
         stay unique. */
      id: 'edit', label: 'Edit', sortable: false, filterType: null,
      render: r => (
        <button type="button" id="edit" title="Edit" className="action edit action-menu-item"
          onClick={() => navigate(`/admin/admin/integration/edit/id/${r.integration_id}/`)}>
          Edit
        </button>
      ),
      exportValue: () => '',
    },
    {
      id: 'delete', label: 'Delete', sortable: false, filterType: null,
      render: () => (
        <button type="button" id="delete" title="Remove" className="action delete action-menu-item"
          onClick={() => addMessage('System integrations cannot be deleted.', 'error')}>
          Delete
        </button>
      ),
      exportValue: () => '',
    },
  ]
  const actions = (
    <button type="button" id="add" title="Add New Integration"
      className="action-default scalable add primary"
      onClick={() => navigate('/admin/admin/integration/new/')}>
      <span>Add New Integration</span>
    </button>
  )
  return (
    <PageShell title="Integrations" actions={actions}
      actionsUiPrefix="integration-grid-container-">
      {/* Round 10. LEGACY on the source. */}
      <LegacyAdminGrid legacyToolbarBase={0} gridId="integrationGrid"
        basePath="/admin/admin/integration/index"
        rows={[...INTEGRATIONS, ...added].map(r => (
          statusOverride[String(r.integration_id)]
            ? { ...r, status: statusOverride[String(r.integration_id)] } : r))}
        columns={columns}
        rowKey={r => r.integration_id}
        exportable={false} exportFileName="integrations" />
    </PageShell>
  )
}

/* ------------------------------------------------------- Bulk Actions Log (128) */

export function BulkActions() {
  const columns = [
    { id: 'uuid', label: 'ID', filterType: 'text' },
    { id: 'start_time', label: 'Start Time', filterType: 'date' },
    /* F-01 — both of these are `<select>` on the source, not free text.
       `description` is populated from the distinct operation descriptions in
       `magento_bulk`, which is empty in this deployment, so the source renders
       it with the blank option only; `status` is the fixed
       Magento\AsynchronousOperations bulk-status enum. */
    { id: 'description', label: 'Description of Operation', filterType: 'select', options: [] },
    {
      id: 'status', label: 'Status', filterType: 'select',
      options: [
        { value: '0', label: 'Not Started' },
        { value: '1', label: 'In Progress' },
        { value: '2', label: 'Finished Successfully' },
        { value: '3', label: 'Finished with Failure' },
      ],
    },
    { id: 'action', label: 'Action', sortable: false, filterType: null },
  ]
  return (
    <PageShell title="Bulk Actions Log">
      <AdminGrid gridId="bulk_listing" rows={[]} columns={columns} rowKey={r => r.uuid}
        exportFileName="bulk_actions" />
    </PageShell>
  )
}

/* --------------------------------------------------------------- Site Map (129) */

export function SiteMap() {
  const navigate = useSidNavigate()
  const { rows } = useSystemCollection('sitemaps', 'sitemap_id')
  const columns = [
    { id: 'sitemap_id', label: 'ID', filterType: 'text' },
    { id: 'sitemap_filename', label: 'Filename', filterType: 'text' },
    { id: 'sitemap_path', label: 'Path', filterType: 'text' },
    /* DIFF-R102 — the source DOES emit `data-sort="link"` on this header; the
       mock had it `no-link`, so the source's own `/sort/link/` segment matched
       nothing. */
    { id: 'link', label: 'Link for Google', filterType: 'text' },
    { id: 'sitemap_time', label: 'Last Generated', filterType: 'date' },
    { id: 'store_id', label: 'Store View', filterType: 'select', options: [{ value: '1', label: 'Default Store View' }] },
    { id: 'action', label: 'Action', sortable: false, filterType: null },
  ]
  const actions = (
    <button type="button" id="add" title="Add Sitemap"
      className="action-default scalable add primary"
      onClick={() => navigate('/admin/admin/sitemap/new/')}>
      <span>Add Sitemap</span>
    </button>
  )
  return (
    <PageShell title="Site Map" actions={actions}
      actionsUiPrefix="adminhtml-sitemap-container-">
      {/* Round 10. LEGACY on the source. */}
      <LegacyAdminGrid legacyToolbarBase={0} gridId="sitemapGrid"
        basePath="/admin/admin/sitemap/index" rows={rows} columns={columns}
        defaultSort={{ field: 'sitemap_id', direction: 'desc' }}
        rowKey={r => r.sitemap_id} exportable={false} exportFileName="sitemaps" />
    </PageShell>
  )
}

/* --------------------------------------------------------- Email Templates (130) */

export function EmailTemplates() {
  const navigate = useSidNavigate()
  const { rows } = useSystemCollection('email_templates', 'template_id')
  const columns = [
    { id: 'template_id', label: 'ID', filterType: 'text' },
    { id: 'template_code', label: 'Template', filterType: 'text', filterName: 'code' },
    { id: 'added_at', label: 'Added', filterType: 'date' },
    { id: 'modified_at', label: 'Updated', filterType: 'date' },
    { id: 'template_subject', label: 'Subject', filterType: 'text', filterName: 'subject' },
    {
      /* F-01b — the source's option VALUES are Magento's
         `TemplateTypesInterface` constants (`2` = HTML, `1` = Text), not the
         labels; round 10 re-derived them from the rendered cell text, so
         `select_option('[name="type"]', '2')` raised. Labels and order are the
         source's; the cell keeps rendering the label. */
      id: 'template_type', label: 'Template Type', filterType: 'select', filterName: 'type',
      options: [{ value: '2', label: 'HTML' }, { value: '1', label: 'Text' }],
      filterValue: r => (String(r.template_type) === 'Text' ? '1' : '2'),
    },
    { id: 'action', label: 'Action', sortable: false, filterType: null },
  ]
  const actions = (
    <button type="button" id="add" title="Add New Template"
      className="action-default scalable add primary add-template"
      onClick={() => navigate('/admin/admin/email_template/new/')}>
      <span>Add New Template</span>
    </button>
  )
  return (
    <PageShell title="Email Templates" actions={actions}
      actionsUiPrefix="adminhtml-system-email-template-container-">
      {/* Round 10. LEGACY on the source. */}
      <LegacyAdminGrid legacyToolbarBase={0} gridId="systemEmailTemplateGrid"
        basePath="/admin/admin/email_template/index" rows={rows} columns={columns}
        rowKey={r => r.template_id} exportable={false}
        exportFileName="email_templates" emptyMessage="No Templates Found" />
    </PageShell>
  )
}

/* --------------------------------------------------------- Encryption Key (133) */

export function EncryptionKey() {
  const { addMessage } = useApp()
  const [auto, setAuto] = useState('1')
  const [key, setKey] = useState('')

  const actions = (
    /* F-07 — the source's button is `#save`
       (`data-ui-id="crypt-key-edit-save-button"`), not `#change_encryption_key`. */
    <button type="button" id="save" title="Change Encryption Key"
      className="action-default scalable primary"
      onClick={() => addMessage(
        auto === '0' && !key.trim()
          ? 'Please enter an encryption key.'
          : 'Key changing is disabled in this environment.',
        auto === '0' && !key.trim() ? 'error' : 'notice')}>
      <span>Change Encryption Key</span>
    </button>
  )

  return (
    <PageShell title="Encryption Key" actions={actions}
      actionsUiPrefix="crypt-key-edit-">
      <form id="crypt_key_form">
        <fieldset className="admin__fieldset">
          <legend className="admin__legend"><span>New Encryption Key</span></legend>
          <p className="admin__field-note">
            The encryption key is used to protect passwords and other sensitive data.
          </p>
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="generate_random"><span>Auto-generate a Key</span></label>
            <div className="admin__field-control">
              <select id="generate_random" name="generate_random" className="admin__control-select"
                value={auto} onChange={e => setAuto(e.target.value)}>
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
              <p className="admin__field-note">The generated key will be displayed after changing.</p>
            </div>
          </div>
          {auto === '0' ? (
            <div className="admin__field _required">
              <label className="admin__field-label" htmlFor="crypt_key"><span>New Key</span></label>
              <div className="admin__field-control">
                <input id="crypt_key" name="crypt_key" type="text" className="admin__control-text"
                  value={key} onChange={e => setKey(e.target.value)} />
              </div>
            </div>
          ) : null}
        </fieldset>
      </form>
    </PageShell>
  )
}

/* ----------------------------------------------------------- Notifications (7) */

export function Notifications() {
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  // PIPELINE-021: the two real rows stay static in systemData.js; read state and
  // removals are an overlay in `state.systemConfig.notificationOverrides`, so
  // both mass actions reach /go instead of dying with the component.
  const { map: overrides, mergeMany } = useSystemMap('notificationOverrides')

  const rows = ADMIN_NOTIFICATIONS
    .map(n => ({ ...n, ...(overrides[String(n.notification_id)] || {}) }))
    .filter(n => !n.removed)

  function remove(ids) {
    mergeMany(ids, { removed: true })
    addMessage(`A total of ${ids.length} record(s) have been removed.`)
  }

  const columns = [
    {
      id: 'severity', label: 'Severity', filterType: 'select',
      options: [{ value: 'critical', label: 'critical' }, { value: 'major', label: 'major' },
        { value: 'minor', label: 'minor' }, { value: 'notice', label: 'notice' }],
      render: r => <span className={`severity-${r.severity}`}>{r.severity.toUpperCase()}</span>,
      exportValue: r => r.severity,
    },
    {
      id: 'date_added', label: 'Date Added', filterType: 'date',
      render: r => formatDateTime(r.date_added), exportValue: r => formatDateTime(r.date_added),
    },
    {
      id: 'title', label: 'Message', filterType: 'text',
      searchValue: r => `${r.title} ${r.description}`,
      render: r => (
        <>
          <strong className={r.is_read ? '' : '_unread'}>{r.title}</strong>
          <p>{r.description}</p>
        </>
      ),
      exportValue: r => r.title,
    },
    {
      id: 'actions', label: 'Actions', sortable: false, filterType: null,
      render: r => (
        <>
          {r.has_details ? (
            <button type="button" className="action-menu-item"
              onClick={() => addMessage('Release notes are hosted outside this environment.', 'notice')}>
              Read Details
            </button>
          ) : null}
          <button type="button" className="action-menu-item" onClick={() => remove([r.notification_id])}>
            Remove
          </button>
        </>
      ),
      exportValue: () => '',
    },
  ]

  const massActions = [
    {
      id: 'mark_as_read',
      label: 'Mark as Read',
      onApply: ids => {
        mergeMany(ids, { is_read: 1 })
        addMessage(`A total of ${ids.length} record(s) have been marked as Read.`)
      },
    },
    { id: 'remove', label: 'Remove', onApply: remove },
  ]

  return (
    <PageShell title="Notifications">
      {/* Round 10. LEGACY on the source — a legacy grid with NO filter row
        * (so no Search / Reset Filter) but WITH the massaction bar and the
        * pager, and the records count in `.admin__control-support-text`. */}
      <LegacyAdminGrid legacyMassactionIndex={2} gridId="notificationGrid"
        basePath="/admin/admin/notification/index" rows={rows} columns={columns} filterRow={false}
        rowKey={r => r.notification_id} rowSelectValue={r => r.notification_id}
        rowSelectName="notification" selectable massActions={massActions}
        exportable={false} exportFileName="notifications"
        defaultSort={{ field: 'date_added', direction: 'desc' }} />
    </PageShell>
  )
}

/* -------------------------------------------------------------- My Account (8) */

export function MyAccount() {
  const { state, setState, addMessage } = useApp()
  const user = (state?.adminUsers || [])[0] || {}
  const [form, setForm] = useState(() => ({
    username: user.username ?? '',
    firstname: user.firstname ?? '',
    lastname: user.lastname ?? '',
    email: user.email ?? '',
    password: '',
    password_confirmation: '',
    interface_locale: user.interface_locale ?? 'en_US',
    current_password: '',
  }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function save() {
    if (!form.username.trim() || !form.firstname.trim() || !form.lastname.trim() || !form.email.trim()) {
      addMessage('This is a required field.', 'error')
      return
    }
    if (form.password && form.password !== form.password_confirmation) {
      addMessage('Your password confirmation must match your password.', 'error')
      return
    }
    setState(prev => ({
      ...prev,
      adminUsers: (prev.adminUsers || []).map(u => (String(u.user_id) === String(user.user_id) ? {
        ...u,
        username: form.username,
        firstname: form.firstname,
        lastname: form.lastname,
        email: form.email,
        interface_locale: form.interface_locale,
        modified: new Date().toISOString().slice(0, 19).replace('T', ' '),
      } : u)),
    }))
    addMessage('You saved the account.')
  }

  const actions = (
    <>
      <button type="button" id="reset" className="action-default scalable"
        onClick={() => setForm(f => ({ ...f, password: '', password_confirmation: '', current_password: '' }))}>
        <span>Reset</span>
      </button>
      <button type="button" id="save" className="action-default scalable primary save" onClick={save}>
        <span>Save Account</span>
      </button>
    </>
  )

  const field = (id, label, type = 'text', required = false) => (
    <div className={`admin__field${required ? ' _required' : ''}`}>
      <label className="admin__field-label" htmlFor={id}><span>{label}</span></label>
      <div className="admin__field-control">
        <input id={id} name={id} type={type} className="admin__control-text"
          value={form[id]} onChange={e => set(id, e.target.value)}
          autoComplete={type === 'password' ? 'new-password' : 'off'} />
      </div>
    </div>
  )

  return (
    <PageShell title="My Account" actions={actions}
      actionsUiPrefix="adminhtml-system-account-edit-">
      <form id="edit_form" onSubmit={e => { e.preventDefault(); save() }}>
        <fieldset className="admin__fieldset">
          <legend className="admin__legend"><span>Account Information</span></legend>
          {field('username', 'User Name', 'text', true)}
          {field('firstname', 'First Name', 'text', true)}
          {field('lastname', 'Last Name', 'text', true)}
          {field('email', 'Email', 'text', true)}
          {field('password', 'New Password', 'password')}
          {field('password_confirmation', 'Password Confirmation', 'password')}
          <div className="admin__field">
            <label className="admin__field-label" htmlFor="interface_locale"><span>Interface Locale</span></label>
            <div className="admin__field-control">
              <select id="interface_locale" name="interface_locale" className="admin__control-select"
                value={form.interface_locale} onChange={e => set('interface_locale', e.target.value)}>
                {/* F-05 — the source ships both installed locales, in this
                    order, with the "<locale> / <locale>" label format. */}
                <option value="en_GB">English (United Kingdom) / English (United Kingdom)</option>
                <option value="en_US">English (United States) / English (United States)</option>
              </select>
            </div>
          </div>
          {field('current_password', 'Your Password', 'password', true)}
        </fieldset>
      </form>
    </PageShell>
  )
}

/* ---------------------------- create/edit forms for the System > Tools grids */

/**
 * HANDLERS-011. These four routes used to re-render the grid they were launched
 * from. Legends, field labels and button labels were read off the live source:
 * `/admin/admin/system_variable/new/`, `/admin/admin/sitemap/new/`,
 * `/admin/admin/email_template/new/`, `/admin/admin/integration/new/`.
 *
 * Each writes into `state.systemConfig`, which is already a baseline key, so the
 * new record shows up in `/go`'s `state_diff`.
 */

export function CustomVariableForm() {
  const { id } = useParams()
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  const { rows, nextId, add, update, remove } = useSystemCollection('variables', 'variable_id')
  const existing = id ? rows.find(r => String(r.variable_id) === String(id)) : null
  const backTo = '/admin/admin/system_variable/'

  return (
    <RecordForm
      title={existing ? existing.name : 'New Custom Variable'}
      documentTitle={existing ? existing.name : 'New Custom Variable'}
      legend="Variable"
      backTo={backTo}
      uiPrefix="system-variable-edit-0"
      saveLabel="Save"
      deleteLabel="Delete Variable"
      /* F-07 — the source's third toolbar button on this form is
         `#save_and_edit` / `data-ui-id="system-variable-edit-0-save-and-edit-button"`. */
      saveAndContinueLabel="Save and Continue Edit"
      saveAndContinueId="save_and_edit"
      initial={{
        code: existing?.code ?? '',
        name: existing?.name ?? '',
        html_value: existing?.html_value ?? '',
        plain_value: existing?.plain_value ?? '',
      }}
      fields={[
        { name: 'code', label: 'Variable Code', required: true },
        { name: 'name', label: 'Variable Name', required: true },
        { name: 'html_value', label: 'Variable HTML Value', type: 'textarea', rows: 5 },
        { name: 'plain_value', label: 'Variable Plain Value', type: 'textarea', rows: 5 },
      ]}
      onDelete={existing ? () => {
        remove(existing.variable_id)
        addMessage('You deleted the custom variable.')
        navigate(backTo)
      } : null}
      onSave={form => {
        if (existing) update(existing.variable_id, form)
        else add({ variable_id: nextId(), ...form })
        addMessage('You saved the custom variable.')
        navigate(backTo)
      }}
      /* Save and Continue Edit saves and stays on the form, as the source
         does (App.jsx registers no separate variable-edit route). */
      onSaveAndContinue={form => {
        if (existing) update(existing.variable_id, form)
        else add({ variable_id: nextId(), ...form })
        addMessage('You saved the custom variable.')
      }}
    />
  )
}

export function SitemapForm() {
  const { id } = useParams()
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  const { rows, nextId, add, update, remove } = useSystemCollection('sitemaps', 'sitemap_id')
  const existing = id ? rows.find(r => String(r.sitemap_id) === String(id)) : null
  const backTo = '/admin/admin/sitemap/'

  const save = (form, generate) => {
    const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
    const record = {
      sitemap_filename: form.sitemap_filename,
      sitemap_path: form.sitemap_path,
      store_id: 1,
      ...(generate ? { sitemap_time: now } : {}),
    }
    if (existing) update(existing.sitemap_id, record)
    else add({ sitemap_id: nextId(), sitemap_time: generate ? now : null, ...record })
    addMessage(generate ? 'The sitemap has been saved and generated.' : 'You saved the sitemap.')
    navigate(backTo)
  }

  return (
    <RecordForm
      title={existing ? 'Edit Site Map' : 'New Site Map'}
      documentTitle={existing ? 'Edit Site Map' : 'New Site Map'}
      legend="Sitemap"
      backTo={backTo}
      uiPrefix="adminhtml-edit-0"
      saveLabel="Save"
      deleteLabel="Delete"
      initial={{
        sitemap_filename: existing?.sitemap_filename ?? '',
        sitemap_path: existing?.sitemap_path ?? '/',
      }}
      fields={[
        { name: 'sitemap_filename', label: 'Filename', required: true },
        { name: 'sitemap_path', label: 'Path', required: true },
      ]}
      onDelete={existing ? () => {
        remove(existing.sitemap_id)
        addMessage('You deleted the sitemap.')
        navigate(backTo)
      } : null}
      onSave={form => save(form, false)}
    />
  )
}

export function EmailTemplateForm() {
  const { id } = useParams()
  const { addMessage } = useApp()
  /* Tracks the source's Convert to Plain Text / Return Html Version pair. */
  const [plain, setPlain] = useState(false)
  const navigate = useSidNavigate()
  const { rows, nextId, add, update, remove } = useSystemCollection('email_templates', 'template_id')
  const existing = id ? rows.find(r => String(r.template_id) === String(id)) : null
  const backTo = '/admin/admin/email_template/'

  return (
    <RecordForm
      title={existing ? existing.template_code : 'New Template'}
      documentTitle={existing ? existing.template_code : 'New Template'}
      legend="Template Information"
      backTo={backTo}
      uiPrefix="template-edit"
      saveLabel="Save Template"
      deleteLabel="Delete Template"
      /* F-07 — the source's four extra toolbar buttons on this form, with its
         ids and `data-ui-id="template-edit-*"`. `Return Html Version` is the
         hidden twin of `Convert to Plain Text`, exactly as on the source: it is
         in the DOM on load and shown once the template has been converted. */
      extraActions={(
        <>
          <button type="button" id="convert_button" data-ui-id="template-edit-convert-button-button"
            className="action-default scalable"
            onClick={() => { setPlain(true); addMessage('The template has been converted to plain text.') }}>
            <span>Convert to Plain Text</span>
          </button>
          <button type="button" id="convert_button_back" data-ui-id="template-edit-convert-button-back-button"
            className="action-default scalable"
            style={plain ? undefined : { display: 'none' }}
            onClick={() => { setPlain(false); addMessage('The HTML version of the template has been restored.') }}>
            <span>Return Html Version</span>
          </button>
          <button type="button" id="preview" data-ui-id="template-edit-preview-button"
            className="action-default scalable"
            onClick={() => addMessage('Template preview opens in a new window on the source; nothing to preview yet.', 'notice')}>
            <span>Preview Template</span>
          </button>
          <button type="button" id="load" data-ui-id="template-edit-load-button"
            className="action-default scalable save"
            onClick={() => addMessage('Please select a template to load.', 'notice')}>
            <span>Load Template</span>
          </button>
        </>
      )}
      initial={{
        template_code: existing?.template_code ?? '',
        template_subject: existing?.template_subject ?? '',
        template_text: existing?.template_text ?? '',
        template_styles: existing?.template_styles ?? '',
      }}
      fields={[
        { name: 'template_code', label: 'Template Name', required: true },
        { name: 'template_subject', label: 'Template Subject', required: true },
        { name: 'template_text', label: 'Template Content', type: 'textarea', required: true },
        { name: 'template_styles', label: 'Template Styles', type: 'textarea', rows: 4 },
      ]}
      onDelete={existing ? () => {
        remove(existing.template_id)
        addMessage('You deleted the email template.')
        navigate(backTo)
      } : null}
      onSave={form => {
        const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
        if (existing) update(existing.template_id, { ...form, modified_at: now })
        else add({ template_id: nextId(), ...form, template_type: 'HTML', added_at: now, modified_at: now })
        addMessage('You saved the email template.')
        navigate(backTo)
      }}
    />
  )
}

export function IntegrationForm() {
  const { id } = useParams()
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  const { rows, nextId, add, update, remove } = useSystemCollection('integrations', 'integration_id')
  const seeded = INTEGRATIONS.find(r => String(r.integration_id) === String(id))
  const existing = id ? rows.find(r => String(r.integration_id) === String(id)) : null
  const record = existing || seeded
  const backTo = '/admin/admin/integration/'

  return (
    <RecordForm
      title={record ? record.name : 'New Integration'}
      documentTitle={record ? record.name : 'New Integration'}
      legend="General"
      backTo={backTo}
      uiPrefix="integration-edit-content"
      saveLabel="Save"
      deleteLabel="Delete"
      initial={{
        name: record?.name ?? '',
        email: record?.email ?? '',
        endpoint: record?.endpoint ?? '',
        identity_link_url: record?.identity_link_url ?? '',
      }}
      fields={[
        { name: 'name', label: 'Name', required: true },
        { name: 'email', label: 'Email' },
        { name: 'endpoint', label: 'Callback URL' },
        { name: 'identity_link_url', label: 'Identity link URL' },
      ]}
      onDelete={existing ? () => {
        remove(existing.integration_id)
        addMessage('The integration has been deleted.')
        navigate(backTo)
      } : null}
      onSave={form => {
        if (existing) update(existing.integration_id, form)
        else if (seeded) {
          /* Seeded integrations live in the static list; an edit is stored as a
             state row keyed by the same id so the grid renders the new values. */
          add({ ...seeded, ...form })
        } else {
          const base = INTEGRATIONS.reduce((m, r) => Math.max(m, Number(r.integration_id) || 0), 0)
          add({ integration_id: Math.max(base, nextId() - 1) + 1, status: 'Inactive', ...form })
        }
        addMessage('The integration has been saved.')
        navigate(backTo)
      }}
    />
  )
}
