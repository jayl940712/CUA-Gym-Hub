import React, { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import { Field, Fieldset } from '../../components/catalog/FormControls.jsx'
import '../../components/catalog/adminForm.css'
import { useApp } from '../../context/AppContext.jsx'
import { useSidNavigate } from '../../utils/navigation.js'

/* ROUTES rows 56 & 57 — Customers > Customer Groups.
 * The four seeded groups are NOT LOGGED IN (0), General (1), Wholesale (2),
 * Retailer (3); task 699-703 references `customer_group_ids: [1]` = General.
 */

const TAX_CLASSES = [{ value: 3, label: 'Retail Customer' }]

export function CustomerGroupGrid() {
  const { state, removeCollectionItem, addMessage } = useApp()
  const navigate = useSidNavigate()

  const rows = useMemo(() => state?.customerGroups || [], [state?.customerGroups])
  const customers = state?.customers || []

  const columns = [
    { id: 'customer_group_id', label: 'ID', filterType: 'range' },
    {
      id: 'customer_group_code',
      label: 'Group',
      filterType: 'text',
      render: r => (
        <AdminLink to={`/admin/customer/group/edit/id/${r.customer_group_id}/`}>
          {r.customer_group_code}
        </AdminLink>
      ),
      exportValue: r => r.customer_group_code,
      searchValue: r => r.customer_group_code,
    },
    {
      id: 'tax_class_id',
      label: 'Tax Class',
      filterType: 'select',
      options: TAX_CLASSES.map(t => ({ value: String(t.value), label: t.label })),
      render: r => TAX_CLASSES.find(t => t.value === Number(r.tax_class_id))?.label || '',
      exportValue: r => TAX_CLASSES.find(t => t.value === Number(r.tax_class_id))?.label || '',
      searchValue: r => TAX_CLASSES.find(t => t.value === Number(r.tax_class_id))?.label || '',
      filterValue: r => String(r.tax_class_id ?? ''),
    },
    {
      id: 'actions',
      label: 'Action',
      sortable: false,
      render: r => {
        const inUse = customers.some(c => String(c.group_id) === String(r.customer_group_id))
        return (
          <>
            <AdminLink to={`/admin/customer/group/edit/id/${r.customer_group_id}/`}>Edit</AdminLink>
            {Number(r.customer_group_id) === 0 || inUse ? null : (
              <>
                {' | '}
                <button
                  type="button"
                  className="admin__field-inline-link"
                  onClick={() => {
                    removeCollectionItem('customerGroups', 'customer_group_id', r.customer_group_id)
                    addMessage('You deleted the customer group.')
                  }}
                >
                  Delete
                </button>
              </>
            )}
          </>
        )
      },
      searchValue: () => '',
      exportValue: () => 'Edit',
    },
  ]

  const actions = (
    // Source: <button id="add" title="Add New Customer Group" data-ui-id="add-button">
    // (PageShell derives the data-ui-id from the id).
    <button
      type="button"
      id="add"
      title="Add New Customer Group"
      className="action-primary"
      onClick={() => navigate('/admin/customer/group/new/')}
    >
      Add New Customer Group
    </button>
  )

  return (
    <PageShell title="Customer Groups" actions={actions}>
      <AdminGrid
        gridId="customer_group_listing"
        rows={rows}
        columns={columns}
        rowKey={r => r.customer_group_id}
        exportFileName="customer-groups"
        defaultSort={{ field: 'customer_group_id', direction: 'asc' }}
        searchPlaceholder="Search by keyword"
      />
    </PageShell>
  )
}

export function CustomerGroupEdit({ isNew = false }) {
  const params = useParams()
  const { state, updateCollectionItem, addCollectionItem, addMessage } = useApp()
  const navigate = useSidNavigate()

  const group = isNew
    ? null
    : (state?.customerGroups || []).find(g => String(g.customer_group_id) === String(params.id))

  const [code, setCode] = useState(group?.customer_group_code ?? '')
  const [taxClass, setTaxClass] = useState(String(group?.tax_class_id ?? 3))
  const [error, setError] = useState('')

  if (!isNew && !group) {
    return (
      <PageShell title="Customer Group">
        <div className="admin__data-grid-empty">
          That customer group does not exist.{' '}
          <AdminLink to="/admin/customer/group/">Back to Customer Groups</AdminLink>
        </div>
      </PageShell>
    )
  }

  function save() {
    if (!code.trim()) {
      setError('This is a required field.')
      return
    }
    if (isNew) {
      const nextId = (state?.customerGroups || [])
        .reduce((n, g) => Math.max(n, g.customer_group_id), 0) + 1
      addCollectionItem('customerGroups', {
        customer_group_id: nextId,
        customer_group_code: code.trim(),
        tax_class_id: Number(taxClass),
      })
    } else {
      updateCollectionItem('customerGroups', 'customer_group_id', group.customer_group_id, {
        customer_group_code: code.trim(),
        tax_class_id: Number(taxClass),
      })
    }
    addMessage('You saved the customer group.')
    navigate('/admin/customer/group/')
  }

  /* G-01 class — the source's toolbar carries a `group-*` `data-ui-id` on every
   * button and has a Reset the mock was missing. */
  const actions = (
    <>
      <button type="button" id="back" data-ui-id="group-back-button"
        className="action-default" onClick={() => navigate('/admin/customer/group/')}>
        Back
      </button>
      <button type="button" id="reset" data-ui-id="group-reset-button"
        className="action-default" onClick={() => {
          setCode(group?.customer_group_code ?? '')
          setTaxClass(String(group?.tax_class_id ?? 3))
          setError('')
        }}>
        Reset
      </button>
      <button type="button" id="save" data-ui-id="group-save-button"
        className="action-primary" onClick={save}>
        Save Customer Group
      </button>
    </>
  )

  const title = isNew ? 'New Customer Group' : group.customer_group_code

  return (
    <PageShell title={title} documentTitle={isNew ? 'New Customer Group' : 'Edit Customer Group'} actions={actions}>
      <form onSubmit={e => { e.preventDefault(); save() }}>
        <Fieldset legend="Group Information">
          <Field label="Group Name" required htmlFor="customer-group-code" error={error}>
            <input
              id="customer-group-code"
              name="code"
              className="admin__control-text"
              type="text"
              maxLength={32}
              value={code}
              onChange={e => { setCode(e.target.value); setError('') }}
            />
          </Field>
          <Field label="Tax Class" required htmlFor="customer-group-tax-class" short>
            <select
              id="customer-group-tax-class"
              name="tax_class_id"
              className="admin__control-select"
              value={taxClass}
              onChange={e => setTaxClass(e.target.value)}
            >
              {TAX_CLASSES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </Field>
        </Fieldset>
      </form>
    </PageShell>
  )
}
