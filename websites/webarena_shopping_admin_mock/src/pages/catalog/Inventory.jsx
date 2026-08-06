import React, { useMemo } from 'react'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import '../../components/catalog/adminForm.css'
import { useApp } from '../../context/AppContext.jsx'
import { useSidNavigate } from '../../utils/navigation.js'

/* ROUTES rows 50 & 51 — Stores > Inventory > Sources / Stocks.
 *
 * This deployment runs single-source inventory: exactly one source ("Default
 * Source", code `default`) and one stock ("Default Stock", id 1) assigned to the
 * Main Website sales channel. Those are the only rows the source grids show.
 */

const DEFAULT_SOURCE = {
  source_code: 'default',
  name: 'Default Source',
  description: 'Default Source',
  enabled: 1,
  latitude: null,
  longitude: null,
  country_id: null,
  region: null,
  city: null,
  street: null,
  postcode: null,
  phone: null,
}

const DEFAULT_STOCK = {
  stock_id: 1,
  name: 'Default Stock',
  sales_channels: 'Main Website',
}

export function ManageSources() {
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  const rows = useMemo(() => [DEFAULT_SOURCE], [])

  const columns = [
    { id: 'source_code', label: 'Code', filterType: 'text' },
    { id: 'name', label: 'Name', filterType: 'text' },
    { id: 'description', label: 'Description', filterType: 'text' },
    {
      id: 'latitude', label: 'Latitude', defaultVisible: false, filterType: 'range',
      render: r => (r.latitude == null ? '' : String(r.latitude)),
    },
    {
      id: 'longitude', label: 'Longitude', defaultVisible: false, filterType: 'range',
      render: r => (r.longitude == null ? '' : String(r.longitude)),
    },
    {
      id: 'country_id', label: 'Country', filterType: 'text',
      render: r => r.country_id || '',
    },
    {
      id: 'region', label: 'State/Province', filterType: 'text',
      render: r => r.region || '',
    },
    { id: 'city', label: 'City', filterType: 'text', render: r => r.city || '' },
    { id: 'street', label: 'Street', defaultVisible: false, filterType: 'text', render: r => r.street || '' },
    { id: 'postcode', label: 'Postcode', defaultVisible: false, filterType: 'text', render: r => r.postcode || '' },
    { id: 'phone', label: 'Phone', defaultVisible: false, filterType: 'text', render: r => r.phone || '' },
    {
      id: 'enabled',
      label: 'Enable Source',
      filterType: 'select',
      options: [{ value: '1', label: 'Enabled' }, { value: '0', label: 'Disabled' }],
      render: r => (r.enabled ? 'Enabled' : 'Disabled'),
      filterValue: r => String(r.enabled),
      searchValue: r => (r.enabled ? 'Enabled' : 'Disabled'),
    },
    {
      id: 'actions',
      label: 'Action',
      sortable: false,
      render: () => (
        <button
          type="button"
          className="admin__field-inline-link"
          onClick={() => addMessage('The Default Source cannot be edited.', 'notice')}
        >
          Edit
        </button>
      ),
      searchValue: () => '',
      exportValue: () => 'Edit',
    },
  ]

  const actions = (
    <button
      type="button"
      id="add"
      className="action-primary"
      onClick={() => addMessage('Multi Source Inventory is not enabled for this installation.', 'notice')}
    >
      Add New Source
    </button>
  )

  return (
    <PageShell title="Manage Sources" actions={actions}>
      <AdminGrid
        gridId="inventory_source_listing"
        rows={rows}
        columns={columns}
        rowKey={r => r.source_code}
        exportFileName="sources"
        defaultSort={{ field: 'source_code', direction: 'asc' }}
        searchPlaceholder="Search by keyword"
        toolbarLeft={
          <button type="button" className="action-default" onClick={() => navigate('/admin/inventory/stock/index/')}>
            Manage Stock
          </button>
        }
      />
    </PageShell>
  )
}

export function ManageStock() {
  const { addMessage } = useApp()
  const navigate = useSidNavigate()
  const rows = useMemo(() => [DEFAULT_STOCK], [])

  const columns = [
    { id: 'stock_id', label: 'ID', filterType: 'range' },
    { id: 'name', label: 'Name', filterType: 'text' },
    { id: 'sales_channels', label: 'Sales Channels', filterType: 'text', sortable: false },
    {
      id: 'actions',
      label: 'Action',
      sortable: false,
      render: () => (
        <button
          type="button"
          className="admin__field-inline-link"
          onClick={() => addMessage('The Default Stock cannot be edited.', 'notice')}
        >
          Edit
        </button>
      ),
      searchValue: () => '',
      exportValue: () => 'Edit',
    },
  ]

  const actions = (
    <button
      type="button"
      id="add"
      className="action-primary"
      onClick={() => addMessage('Multi Source Inventory is not enabled for this installation.', 'notice')}
    >
      Add New Stock
    </button>
  )

  return (
    <PageShell title="Manage Stock" actions={actions}>
      <AdminGrid
        gridId="inventory_stock_listing"
        rows={rows}
        columns={columns}
        rowKey={r => r.stock_id}
        exportFileName="stocks"
        defaultSort={{ field: 'stock_id', direction: 'asc' }}
        searchPlaceholder="Search by keyword"
        toolbarLeft={
          <button type="button" className="action-default" onClick={() => navigate('/admin/inventory/source/index/')}>
            Manage Sources
          </button>
        }
      />
    </PageShell>
  )
}
