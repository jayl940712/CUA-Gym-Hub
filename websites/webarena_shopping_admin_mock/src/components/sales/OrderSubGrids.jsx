import React from 'react'
import AdminGrid from '../grid/AdminGrid.jsx'
import AdminLink from '../layout/AdminLink.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { formatCurrency, formatDateTime, formatQty } from '../../utils/formatters.js'
import { downloadFile } from '../../utils/gridUtils.js'

/**
 * The Invoices / Credit Memos / Shipments sub-grids on
 * `/admin/sales/order/view/order_id/:id/` (NEW-DOM-207).
 *
 * The source renders these as full UI-component grids — column headers, the
 * multicheck cell, and the whole filter panel — **eagerly on cold load**, for
 * all three panes, even when the order has no such documents and no tab has
 * been clicked. The mock previously rendered only the empty-state string, so
 * `[name="order_increment_id"]`, `[name="state"]`, `[name="total_qty[from]"]`,
 * … all resolved to `null` and an agent asked to find a shipment inside an
 * order had nothing to drive.
 *
 * Every column set, filter name, filter kind and option list below is
 * transcribed from the live source's rendered DOM at
 * `/admin/sales/order/view/order_id/299/`. Filters the source declares without
 * a matching column are `filterOnly` so the table and the Columns chooser stay
 * exactly as the source's headers.
 */

/* ------------------------------------------------- shared filter vocabularies */

/** Source `[name="store_id"]` on all three sub-grids. */
const STORE_OPTIONS = [{ value: '1', label: 'Default Store View' }]

/** Source `[name="customer_group_id"]` — the real customer_group table, id order. */
const CUSTOMER_GROUP_OPTIONS = [
  { value: '0', label: 'NOT LOGGED IN' },
  { value: '1', label: 'General' },
  { value: '2', label: 'Wholesale' },
  { value: '3', label: 'Retailer' },
]

/** Source `[name="order_status"]` — identical to the Orders grid's `status`. */
const ORDER_STATUS_OPTIONS = [
  { value: 'canceled', label: 'Canceled' },
  { value: 'closed', label: 'Closed' },
  { value: 'complete', label: 'Complete' },
  { value: 'fraud', label: 'Suspected Fraud' },
  { value: 'holded', label: 'On Hold' },
  { value: 'payment_review', label: 'Payment Review' },
  { value: 'paypal_canceled_reversal', label: 'PayPal Canceled Reversal' },
  { value: 'paypal_reversed', label: 'PayPal Reversed' },
  { value: 'pending', label: 'Pending' },
  { value: 'pending_payment', label: 'Pending Payment' },
  { value: 'pending_paypal', label: 'Pending PayPal' },
  { value: 'processing', label: 'Processing' },
]

/** Source `[name="payment_method"]` — the 24 active methods, by label. */
export const PAYMENT_METHOD_OPTIONS = [
  { value: 'braintree_ach_direct_debit', label: 'ACH Direct Debit' },
  { value: 'braintree_applepay', label: 'Apple Pay' },
  { value: 'banktransfer', label: 'Bank Transfer Payment' },
  { value: 'cashondelivery', label: 'Cash On Delivery' },
  { value: 'checkmo', label: 'Check / Money order' },
  { value: 'braintree', label: 'Credit Card' },
  { value: 'payflow_advanced', label: 'Credit Card (Payflow Advanced)' },
  { value: 'payflow_link', label: 'Credit Card (Payflow Link)' },
  { value: 'payflowpro', label: 'Credit Card (Payflow Pro)' },
  { value: 'braintree_googlepay', label: 'Google Pay' },
  { value: 'braintree_local_payment', label: 'Local Payments' },
  { value: 'free', label: 'No Payment Information Required' },
  { value: 'braintree_paypal', label: 'PayPal' },
  { value: 'paypal_billing_agreement', label: 'PayPal Billing Agreement' },
  { value: 'payflow_express_bml', label: 'PayPal Credit (Payflow Express Bml)' },
  { value: 'paypal_express_bml', label: 'PayPal Credit (Paypal Express Bml)' },
  { value: 'paypal_express', label: 'PayPal Express Checkout' },
  { value: 'payflow_express', label: 'PayPal Express Checkout Payflow Edition' },
  { value: 'hosted_pro', label: 'Payment by cards or by PayPal account' },
  { value: 'purchaseorder', label: 'Purchase Order' },
  { value: 'braintree_paypal_vault', label: 'Stored Accounts (PayPal)' },
  { value: 'braintree_cc_vault', label: 'Stored Cards' },
  { value: 'payflowpro_cc_vault', label: 'Stored Cards (Payflow Pro)' },
  { value: 'braintree_venmo', label: 'Venmo' },
]

/** Source `[name="state"]` on the invoices / credit-memo panes. */
const INVOICE_STATES = [
  { value: '1', label: 'Pending' },
  { value: '2', label: 'Paid' },
  { value: '3', label: 'Canceled' },
]
const CREDITMEMO_STATES = [
  { value: '1', label: 'Pending' },
  { value: '2', label: 'Refunded' },
  { value: '3', label: 'Canceled' },
]

const PAYMENT_METHOD_LABELS = Object.fromEntries(PAYMENT_METHOD_OPTIONS.map(o => [o.value, o.label]))
export const paymentMethodLabel = code => PAYMENT_METHOD_LABELS[code] || code || ''
const stateLabel = (options, value) => options.find(o => o.value === String(value))?.label || ''

/* --------------------------------------------------- filter-only descriptors */

const money = id => ({ id, label: id, filterOnly: true, filterType: 'range', searchValue: () => '' })
const textFilter = id => ({ id, label: id, filterOnly: true, filterType: 'text', searchValue: () => '' })
const selectFilter = (id, options, emptyOptionLabel) => ({
  id, label: id, filterOnly: true, filterType: 'select', options, emptyOptionLabel,
  filterValue: r => String(r[id] ?? ''), searchValue: () => '',
})

const STORE_FILTER = selectFilter('store_id', STORE_OPTIONS, 'All Store Views')
const GROUP_FILTER = selectFilter('customer_group_id', CUSTOMER_GROUP_OPTIONS)
const PAYMENT_FILTER = {
  ...selectFilter('payment_method', PAYMENT_METHOD_OPTIONS),
  searchValue: r => paymentMethodLabel(r.payment_method),
}
const ORDER_STATUS_FILTER = selectFilter('order_status', ORDER_STATUS_OPTIONS)

/* -------------------------------------------------------------- mass actions */

/**
 * The source's sub-grids carry the same PDF mass action as the standalone
 * document listings. With no server the mock writes the same document as text,
 * exactly as OrdersGrid and SalesDocumentGrids already do.
 */
function usePdfMassAction(rows, title, fileName) {
  const { addMessage } = useApp()
  return (ids) => {
    const idSet = new Set(ids.map(String))
    const docs = rows.filter(d => idSet.has(String(d.entity_id)))
    if (!docs.length) {
      addMessage('There are no printable documents related to selected orders.', 'error')
      return
    }
    downloadFile(`${fileName}.txt`, docs.map(d => (
      `${title}\n#${d.increment_id}\nOrder # ${d.order_increment_id}\n`
      + `Customer: ${d.customer_name || d.billing_name || d.shipping_name || ''}\n`
      + `Created: ${d.created_at}\n`
    )).join('\n----------------------------------------\n'), 'text/plain')
  }
}

/* ------------------------------------------------------------------- grids */

export function OrderInvoicesGrid({ invoices }) {
  const printInvoices = usePdfMassAction(invoices, 'Invoices', 'invoices')
  const columns = [
    { id: 'increment_id', label: 'Invoice', filterType: 'text', sortValue: r => Number(r.entity_id) },
    {
      id: 'created_at', label: 'Invoice Date', filterType: 'date',
      render: r => formatDateTime(r.created_at), searchValue: r => formatDateTime(r.created_at),
    },
    { id: 'order_increment_id', label: 'Order #', filterType: 'text' },
    {
      id: 'order_created_at', label: 'Order Date', filterType: 'date',
      render: r => formatDateTime(r.order_created_at), searchValue: r => formatDateTime(r.order_created_at),
    },
    { id: 'billing_name', label: 'Bill-to Name', filterType: 'text' },
    {
      id: 'state', label: 'Status', filterType: 'select', options: INVOICE_STATES,
      render: r => stateLabel(INVOICE_STATES, r.state),
      searchValue: r => stateLabel(INVOICE_STATES, r.state),
      filterValue: r => String(r.state ?? ''),
    },
    {
      id: 'grand_total', label: 'Amount', filterType: 'range',
      render: r => formatCurrency(r.grand_total), exportValue: r => r.grand_total,
    },
    {
      id: 'action', label: 'Action', sortable: false, className: 'col-actions',
      render: r => <AdminLink to={`/admin/sales/invoice/view/invoice_id/${r.entity_id}/`}>View</AdminLink>,
      exportValue: () => 'View',
      searchValue: () => '',
    },
    money('subtotal'), money('shipping_and_handling'),
    STORE_FILTER,
    textFilter('billing_address'), textFilter('shipping_address'),
    textFilter('customer_name'), textFilter('customer_email'),
    GROUP_FILTER, PAYMENT_FILTER, textFilter('shipping_information'),
  ]
  return (
    <AdminGrid
      gridId="sales_order_view_invoice_grid"
      rows={invoices}
      columns={columns}
      selectable
      massActions={[{ id: 'pdfinvoices_order', label: 'PDF Invoices', onApply: printInvoices }]}
      exportable={false}
      exportFileName="invoices"
      defaultSort={{ field: 'increment_id', direction: 'asc' }}
      filterOrder={[
        'created_at', 'order_created_at', 'grand_total', 'subtotal',
        'shipping_and_handling', 'store_id', 'increment_id', 'order_increment_id',
        'billing_name', 'state', 'billing_address', 'shipping_address',
        'customer_name', 'customer_email', 'customer_group_id', 'payment_method',
        'shipping_information',
      ]}
    />
  )
}

export function OrderCreditMemosGrid({ creditMemos }) {
  const printCreditMemos = usePdfMassAction(creditMemos, 'Credit Memos', 'creditmemos')
  const columns = [
    { id: 'increment_id', label: 'Credit Memo', filterType: 'text', sortValue: r => Number(r.entity_id) },
    {
      id: 'created_at', label: 'Created', filterType: 'date',
      render: r => formatDateTime(r.created_at), searchValue: r => formatDateTime(r.created_at),
    },
    { id: 'order_increment_id', label: 'Order #', filterType: 'text' },
    {
      id: 'order_created_at', label: 'Order Date', filterType: 'date',
      render: r => formatDateTime(r.order_created_at), searchValue: r => formatDateTime(r.order_created_at),
    },
    { id: 'billing_name', label: 'Bill-to Name', filterType: 'text' },
    {
      id: 'state', label: 'Status', filterType: 'select', options: CREDITMEMO_STATES,
      render: r => stateLabel(CREDITMEMO_STATES, r.state),
      searchValue: r => stateLabel(CREDITMEMO_STATES, r.state),
      filterValue: r => String(r.state ?? ''),
    },
    {
      id: 'base_grand_total', label: 'Refunded', filterType: 'range',
      render: r => formatCurrency(r.base_grand_total), exportValue: r => r.base_grand_total,
    },
    {
      id: 'action', label: 'Action', sortable: false, className: 'col-actions',
      render: r => <AdminLink to={`/admin/sales/creditmemo/view/creditmemo_id/${r.entity_id}/`}>View</AdminLink>,
      exportValue: () => 'View',
      searchValue: () => '',
    },
    money('subtotal'), money('shipping_and_handling'),
    money('adjustment_positive'), money('adjustment_negative'),
    money('order_base_grand_total'),
    STORE_FILTER, ORDER_STATUS_FILTER,
    textFilter('billing_address'), textFilter('shipping_address'),
    textFilter('customer_name'), textFilter('customer_email'),
    GROUP_FILTER, PAYMENT_FILTER, textFilter('shipping_information'),
  ]
  return (
    <AdminGrid
      gridId="sales_order_view_creditmemo_grid"
      rows={creditMemos}
      columns={columns}
      selectable
      massActions={[{ id: 'pdfcreditmemos_order', label: 'PDF Credit Memos', onApply: printCreditMemos }]}
      exportable={false}
      exportFileName="creditmemos"
      defaultSort={{ field: 'increment_id', direction: 'asc' }}
      filterOrder={[
        'created_at', 'order_created_at', 'base_grand_total', 'subtotal',
        'shipping_and_handling', 'adjustment_positive', 'adjustment_negative',
        'order_base_grand_total', 'store_id', 'increment_id', 'order_increment_id',
        'billing_name', 'state', 'order_status', 'billing_address',
        'shipping_address', 'customer_name', 'customer_email', 'customer_group_id',
        'payment_method', 'shipping_information',
      ]}
    />
  )
}

export function OrderShipmentsGrid({ shipments }) {
  const printShipments = usePdfMassAction(shipments, 'Shipments', 'shipments')
  const columns = [
    { id: 'increment_id', label: 'Shipment', filterType: 'text', sortValue: r => Number(r.entity_id) },
    {
      id: 'created_at', label: 'Ship Date', filterType: 'date',
      render: r => formatDateTime(r.created_at), searchValue: r => formatDateTime(r.created_at),
    },
    {
      // The one oddity in the source's set: on the shipments grid
      // `order_increment_id` is a RANGE filter (`[from]`/`[to]`), not the plain
      // text box the other two panes use.
      id: 'order_increment_id', label: 'Order #', filterType: 'range',
    },
    {
      id: 'order_created_at', label: 'Order Date', filterType: 'date',
      render: r => formatDateTime(r.order_created_at), searchValue: r => formatDateTime(r.order_created_at),
    },
    { id: 'shipping_name', label: 'Ship-to Name', filterType: 'text' },
    {
      id: 'total_qty', label: 'Total Quantity', filterType: 'range',
      render: r => formatQty(r.total_qty), searchValue: r => formatQty(r.total_qty),
    },
    {
      id: 'action', label: 'Action', sortable: false, className: 'col-actions',
      render: r => <AdminLink to={`/admin/sales/shipment/view/shipment_id/${r.entity_id}/`}>View</AdminLink>,
      exportValue: () => 'View',
      searchValue: () => '',
    },
    STORE_FILTER, ORDER_STATUS_FILTER,
    textFilter('customer_name'), textFilter('customer_email'),
    GROUP_FILTER,
    textFilter('billing_address'), textFilter('shipping_address'),
    PAYMENT_FILTER, textFilter('shipping_information'),
  ]
  return (
    <AdminGrid
      gridId="sales_order_view_shipment_grid"
      rows={shipments}
      columns={columns}
      selectable
      massActions={[{ id: 'pdfshipments_order', label: 'PDF Shipments', onApply: printShipments }]}
      exportable={false}
      exportFileName="shipments"
      defaultSort={{ field: 'increment_id', direction: 'asc' }}
      filterOrder={[
        'created_at', 'order_increment_id', 'order_created_at', 'total_qty',
        'store_id', 'increment_id', 'shipping_name', 'order_status',
        'customer_name', 'customer_email', 'customer_group_id',
        'billing_address', 'shipping_address', 'payment_method',
        'shipping_information',
      ]}
    />
  )
}
