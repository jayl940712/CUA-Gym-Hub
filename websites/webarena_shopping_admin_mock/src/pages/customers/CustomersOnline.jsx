import React from 'react'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import '../../components/catalog/adminForm.css'

/* ROUTES rows 58 & 59.
 *
 * Both grids are empty in the source deployment: `customer_visitor` holds no
 * live sessions (the mock has no visitors at all, by construction) and the
 * Login-as-Customer log has never been written to. Rendering the real empty
 * state is the honest port — there is nothing to seed.
 */

export function CustomersOnline() {
  const columns = [
    { id: 'last_activity', label: 'Last Activity', filterType: 'date' },
    { id: 'first_name', label: 'First Name', filterType: 'text' },
    { id: 'last_name', label: 'Last Name', filterType: 'text' },
    { id: 'email', label: 'Email', filterType: 'text' },
    { id: 'last_url', label: 'Last URL', filterType: 'text' },
    {
      id: 'customer_type',
      label: 'Type',
      filterType: 'select',
      options: [
        { value: 'Customer', label: 'Customer' },
        { value: 'Visitor', label: 'Visitor' },
      ],
    },
  ]

  return (
    <PageShell title="Customers Now Online">
      <AdminGrid
        gridId="customer_online_grid"
        rows={[]}
        columns={columns}
        rowKey={r => r.visitor_id}
        exportFileName="customers-online"
        searchPlaceholder="Search by keyword"
      />
    </PageShell>
  )
}

export function LoginAsCustomerLog() {
  const columns = [
    { id: 'log_id', label: 'ID', filterType: 'range' },
    { id: 'customer_name', label: 'Customer Name', filterType: 'text' },
    { id: 'customer_email', label: 'Customer Email', filterType: 'text' },
    { id: 'admin_name', label: 'Admin Name', filterType: 'text' },
    { id: 'admin_email', label: 'Admin Email', filterType: 'text' },
    { id: 'time', label: 'Date and Time', filterType: 'date' },
  ]

  return (
    <PageShell title="Login as Customer Log">
      <AdminGrid
        gridId="login_as_customer_log"
        rows={[]}
        columns={columns}
        rowKey={r => r.log_id}
        exportFileName="login-as-customer-log"
        searchPlaceholder="Search by keyword"
      />
    </PageShell>
  )
}
