import React, { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import '../../components/catalog/adminForm.css'
import { COUNTRY_OPTIONS, countryLabel } from '../../components/catalog/countries.js'
import { useApp } from '../../context/AppContext.jsx'
import { getCustomerGridRows } from '../../utils/selectors.js'
import { useSidNavigate } from '../../utils/navigation.js'
import { formatDateTime, formatDate, genderLabel } from '../../utils/formatters.js'

/* ROUTES row 52 — /admin/customer/index/ ("All Customers", 70 rows). */

/**
 * The source's filter-panel field order, read off the live
 * /admin/customer/index/ DOM — the UI component's `filters` fieldset order,
 * which is not the table's column order.
 */
const FILTER_ORDER = [
  'entity_id', 'created_at', 'dob', 'name', 'email', 'group_id',
  'billing_telephone', 'billing_postcode', 'billing_country_id',
  'billing_region', 'website_id', 'taxvat', 'gender', 'billing_city',
  'billing_fax', 'billing_vat_id', 'billing_company', 'billing_firstname',
  'billing_lastname',
]

export default function CustomerGrid() {
  const {
    state, updateCollectionItem, removeCollectionItem, addCollectionItem, addMessage,
  } = useApp()
  const navigate = useSidNavigate()

  const rows = useMemo(() => getCustomerGridRows(state), [state])
  /* This component serves two routes (ROUTES rows 52 and 29); the Create New
   * Order customer picker differs from the All Customers grid in one option
   * label — see `billing_country_id` below. */
  const orderCreate = useLocation().pathname.includes('/sales/order_create/start')
  const groups = state?.customerGroups || []
  // A registered-customer grid cannot hold NOT-LOGGED-IN customers, so the
  // source's `[name="group_id"]` omits group 0 and lists the rest alphabetically
  // by label — General(1), Retailer(3), Wholesale(2) (NEW-DOM-206). Group 0 is
  // still offered where the source offers it (the cart-price-rule form).
  const groupOptions = groups
    .filter(g => String(g.customer_group_id) !== '0')
    .map(g => ({ value: String(g.customer_group_id), label: g.customer_group_code }))
    .sort((a, b) => a.label.localeCompare(b.label))
  const groupLabel = id => groups.find(g => String(g.customer_group_id) === String(id))?.customer_group_code || ''

  const columns = useMemo(() => [
    {
      // Hidden by default on the source too — it heads the Columns chooser but
      // is not one of the 8 rendered columns.
      id: 'entity_id',
      label: 'ID',
      defaultVisible: false,
      filterType: 'range',
      render: r => r.entity_id,
    },
    {
      id: 'name',
      label: 'Name',
      filterType: 'text',
      render: r => r.name,
    },
    { id: 'email', label: 'Email', filterType: 'text' },
    {
      id: 'group_id',
      label: 'Group',
      filterType: 'select',
      options: groupOptions,
      render: r => groupLabel(r.group_id),
      exportValue: r => groupLabel(r.group_id),
      searchValue: r => groupLabel(r.group_id),
      filterValue: r => String(r.group_id ?? ''),
      sortValue: r => groupLabel(r.group_id),
    },
    {
      id: 'billing_telephone',
      label: 'Phone',
      filterType: 'text',
      render: r => r.billing_telephone || '',
    },
    {
      id: 'billing_postcode',
      label: 'ZIP',
      filterType: 'text',
      render: r => r.billing_postcode || '',
    },
    {
      id: 'billing_country_id',
      label: 'Country',
      filterType: 'select',
      // The full 249-entry Magento country list, exactly as the source's
       // `[name="billing_country_id"]` renders it — NOT just the countries
       // present in the seed, which left `select_option('AF')` throwing
       // (NEW-DOM-203). COUNTRY_OPTIONS[0] is the blank entry, which AdminGrid
       // renders itself.
      options: COUNTRY_OPTIONS.slice(1),
      /* F-06c. The blank sentinel's LABEL is not the same on the two routes
         this grid serves. Measured on both, cold:
           /admin/customer/index/            <option value=""></option>
           /admin/sales/order_create/start/  <option value="">All Countries</option>
         (the latter is Magento's legacy `country` column filter, which prints
         `__('All Countries')`). With the blank label everywhere,
         `select_option(label='All Countries')` raised on the order-create
         customer picker. */
      emptyOptionLabel: orderCreate ? 'All Countries' : '',
      render: r => countryLabel(r.billing_country_id),
      exportValue: r => countryLabel(r.billing_country_id),
      searchValue: r => countryLabel(r.billing_country_id),
      filterValue: r => String(r.billing_country_id ?? ''),
      sortValue: r => countryLabel(r.billing_country_id),
    },
    {
      id: 'billing_region',
      label: 'State/Province',
      filterType: 'text',
      render: r => r.billing_region || '',
    },
    {
      id: 'created_at',
      label: 'Customer Since',
      filterType: 'date',
      render: r => formatDateTime(r.created_at),
      exportValue: r => formatDateTime(r.created_at),
      searchValue: r => formatDateTime(r.created_at),
      sortValue: r => r.created_at || '',
    },
    /* ---- available through the Columns chooser, hidden by default ---- */
    {
      id: 'website_id',
      label: 'Web Site',
      defaultVisible: false,
      filterType: 'select',
      options: [{ value: '1', label: 'Main Website' }],
      render: () => 'Main Website',
      filterValue: r => String(r.website_id ?? ''),
      searchValue: () => 'Main Website',
    },
    {
      id: 'confirmation',
      label: 'Confirmed email',
      defaultVisible: false,
      filterType: null, // column only — the source declares no `confirmation` filter (NEW-DOM-206)
      options: [
        { value: 'confirmed', label: 'Confirmed' },
        { value: 'not_confirmed', label: 'Confirmation Required' },
      ],
      render: r => (r.confirmation ? 'Confirmation Required' : 'Confirmed'),
      filterValue: r => (r.confirmation ? 'not_confirmed' : 'confirmed'),
      searchValue: r => (r.confirmation ? 'Confirmation Required' : 'Confirmed'),
    },
    {
      id: 'created_in',
      label: 'Account Created in',
      defaultVisible: false,
      filterType: null, // column only — the source declares no `created_in` filter (NEW-DOM-206)
      render: r => r.created_in || '',
    },
    {
      id: 'billing_full',
      label: 'Billing Address',
      defaultVisible: false,
      filterType: null, // column only — the source declares no `billing_full` filter (NEW-DOM-206)
      render: r => r.billing_full || '',
    },
    {
      id: 'shipping_full',
      label: 'Shipping Address',
      defaultVisible: false,
      filterType: null, // column only — the source declares no `shipping_full` filter (NEW-DOM-206)
      render: r => r.shipping_full || '',
    },
    {
      id: 'dob',
      label: 'Date of Birth',
      defaultVisible: false,
      filterType: 'date',
      render: r => (r.dob ? formatDate(r.dob) : ''),
      exportValue: r => (r.dob ? formatDate(r.dob) : ''),
      searchValue: () => '',
      sortValue: r => r.dob || '',
    },
    {
      id: 'taxvat',
      label: 'Tax VAT Number',
      defaultVisible: false,
      filterType: 'text',
      render: r => r.taxvat || '',
    },
    {
      id: 'gender',
      label: 'Gender',
      defaultVisible: false,
      filterType: 'select',
      options: [
        { value: '1', label: 'Male' },
        { value: '2', label: 'Female' },
        { value: '3', label: 'Not Specified' },
      ],
      render: r => genderLabel(r.gender),
      filterValue: r => String(r.gender ?? ''),
      searchValue: r => genderLabel(r.gender),
    },
    {
      id: 'billing_street',
      label: 'Street Address',
      defaultVisible: false,
      filterType: null, // column only — the source declares no `billing_street` filter (NEW-DOM-206)
      render: r => r.billing_street || '',
    },
    {
      id: 'billing_city',
      label: 'City',
      defaultVisible: false,
      filterType: 'text',
      render: r => r.billing_city || '',
    },
    {
      id: 'billing_fax',
      label: 'Fax',
      defaultVisible: false,
      filterType: 'text',
      render: r => r.billing_fax || '',
    },
    {
      id: 'billing_vat_id',
      label: 'VAT Number',
      defaultVisible: false,
      filterType: 'text',
      render: r => r.billing_vat_id || '',
    },
    {
      id: 'billing_company',
      label: 'Company',
      defaultVisible: false,
      filterType: 'text',
      render: r => r.billing_company || '',
    },
    {
      id: 'billing_firstname',
      label: 'Billing Firstname',
      defaultVisible: false,
      filterType: 'text',
      render: r => r.billing_firstname || '',
    },
    {
      id: 'billing_lastname',
      label: 'Billing Lastname',
      defaultVisible: false,
      filterType: 'text',
      render: r => r.billing_lastname || '',
    },
    {
      id: 'lock_expires',
      label: 'Account Lock',
      defaultVisible: false,
      filterType: null, // column only — the source declares no `lock_expires` filter (NEW-DOM-206)
      options: [
        { value: 'unlocked', label: 'Unlocked' },
        { value: 'locked', label: 'Locked' },
      ],
      render: r => (r.lock_expires ? 'Locked' : 'Unlocked'),
      filterValue: r => (r.lock_expires ? 'locked' : 'unlocked'),
      searchValue: r => (r.lock_expires ? 'Locked' : 'Unlocked'),
    },
    {
      // The source's `Action` column ships hidden ("actions":{"visible":false}
      // in the image's bookmark), so the listing renders 8 columns (DIFF-006).
      id: 'actions',
      label: 'Action',
      sortable: false,
      defaultVisible: false,
      render: r => (
        <AdminLink to={`/admin/customer/index/edit/id/${r.entity_id}/`} aria-label={`Edit ${r.name}`}>
          Edit
        </AdminLink>
      ),
      searchValue: () => '',
      exportValue: () => 'Edit',
    },
  ], [rows, groupOptions.length, state?.customerGroups, orderCreate])

  const massActions = useMemo(() => {
    const base = [
      {
        id: 'delete',
        label: 'Delete',
        onApply: ids => {
          ids.forEach(id => removeCollectionItem('customers', 'entity_id', id))
          addMessage(`A total of ${ids.length} record(s) were deleted.`)
        },
      },
      {
        id: 'subscribe',
        label: 'Subscribe to Newsletter',
        onApply: (ids, matched) => {
          const existing = new Set((state?.newsletterSubscribers || []).map(s => String(s.customer_id)))
          let nextId = (state?.newsletterSubscribers || []).reduce((n, s) => Math.max(n, s.subscriber_id), 0)
          matched.forEach(row => {
            if (existing.has(String(row.entity_id))) {
              updateCollectionItem('newsletterSubscribers', 'customer_id', row.entity_id, { subscriber_status: 1 })
            } else {
              nextId += 1
              addCollectionItem('newsletterSubscribers', {
                subscriber_id: nextId,
                store_id: 1,
                customer_id: row.entity_id,
                subscriber_email: row.email,
                subscriber_status: 1,
              })
            }
          })
          addMessage(`A total of ${ids.length} record(s) were updated.`)
        },
      },
      {
        id: 'unsubscribe',
        label: 'Unsubscribe from Newsletter',
        onApply: ids => {
          ids.forEach(id => updateCollectionItem('newsletterSubscribers', 'customer_id', id, { subscriber_status: 3 }))
          addMessage(`A total of ${ids.length} record(s) were updated.`)
        },
      },
      {
        id: 'edit',
        label: 'Edit',
        onApply: ids => navigate(`/admin/customer/index/edit/id/${ids[0]}/`),
      },
    ]
    /* F-12 / G-06d — the source's "Assign a Customer Group" submenu lists
       General, Wholesale and Retailer ONLY (verified live: the submenu's four
       seeded groups minus NOT LOGGED IN, which Magento excludes because it is
       the guest pseudo-group and cannot be assigned to a customer account).
       The mock was offering a fourth, invented entry. */
    for (const g of groups.filter(x => Number(x.customer_group_id) !== 0)) {
      base.push({
        id: `group_${g.customer_group_id}`,
        label: `Assign a Customer Group / ${g.customer_group_code}`,
        onApply: ids => {
          ids.forEach(id => updateCollectionItem('customers', 'entity_id', id, { group_id: g.customer_group_id }))
          addMessage(`A total of ${ids.length} record(s) were updated.`)
        },
      })
    }
    return base
  }, [groups, state?.newsletterSubscribers, updateCollectionItem, removeCollectionItem, addCollectionItem, addMessage, navigate])

  const actions = (
    <button
      type="button"
      id="add"
      className="action-primary"
      onClick={() => navigate('/admin/customer/index/new/')}
    >
      Add New Customer
    </button>
  )

  return (
    <PageShell title="Customers" actions={actions}>
      <AdminGrid
        filterOrder={FILTER_ORDER}
        gridId="customer_listing"
        rows={rows}
        columns={columns}
        rowKey={r => r.entity_id}
        selectable
        massActions={massActions}
        exportFileName="customers"
        defaultSort={{ field: 'name', direction: 'asc' }}
        defaultPageSize={20}
      />
    </PageShell>
  )
}
