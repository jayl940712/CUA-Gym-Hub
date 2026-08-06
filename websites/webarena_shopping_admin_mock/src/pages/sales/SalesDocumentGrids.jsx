import React from 'react'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import LegacyAdminGrid from '../../components/grid/LegacyAdminGrid.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { formatDateTime, formatCurrency, formatQty } from '../../utils/formatters.js'
import { downloadFile } from '../../utils/gridUtils.js'
import { PAYMENT_METHOD_OPTIONS, paymentMethodLabel } from '../../components/sales/OrderSubGrids.jsx'
import '../../components/sales/sales.css'

/* ROUTES.md rows 30, 32, 34, 36, 37 — the document listings under Sales.
 * Column sets are the source's, from ROUTES.md and
 * assets/screenshots/reference/sales-{invoice,shipment,creditmemo}-grid.png.
 */

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

/* F-01 — the source renders `[name="payment_method"]` on the invoice, shipment
 * and credit-memo grids as a `<select>` over the 24 active payment methods (the
 * same list the Orders grid already carries). The mock rendered a free-text
 * input, so `page.select_option('[name="payment_method"]', 'checkmo')` raised
 * `Element is not a <select> element` and the option vocabulary was unreachable.
 * Values are the method codes, exactly as the seed stores them. */
const PAYMENT_METHOD_COLUMN = {
  id: 'payment_method',
  label: 'Payment Method',
  defaultVisible: false,
  filterType: 'select',
  options: PAYMENT_METHOD_OPTIONS,
  render: r => paymentMethodLabel(r.payment_method),
  searchValue: r => paymentMethodLabel(r.payment_method),
  exportValue: r => paymentMethodLabel(r.payment_method),
  filterValue: r => String(r.payment_method ?? ''),
}

function stateLabel(options, value) {
  return options.find(o => o.value === String(value))?.label || ''
}

function viewLink(to) {
  return <AdminLink to={to}>View</AdminLink>
}

/* HANDLERS-024 — the document grids are `selectable`, so they need the mass
 * action the source declares for them. Straight out of the embedded
 * `listing_massaction` config in assets/html/sales-{invoice,shipment,creditmemo}-grid.html:
 *
 *   invoices     PDF Invoices                              (pdfinvoices_order)
 *   shipments    PDF Shipments · Print Shipping Labels     (pdfshipments_order,
 *                                                           print_shipping_label)
 *   creditmemos  PDF Credit Memos                          (pdfcreditmemos_order)
 *
 * The source renders these server-side as PDFs; with no server the mock writes
 * the same document as text, exactly as the Orders grid already does
 * (OrdersGrid.printDocuments).
 */
function usePdfMassAction(collection, title, fileName) {
  const { state, addMessage } = useApp()
  return (ids) => {
    const idSet = new Set(ids.map(String))
    const docs = (state[collection] || []).filter(d => idSet.has(String(d.entity_id)))
    if (!docs.length) {
      addMessage('There are no printable documents related to selected orders.', 'error')
      return
    }
    const body = docs.map(d => (
      `${title}\n#${d.increment_id}\nOrder # ${d.order_increment_id}\n`
      + `Customer: ${d.customer_name || d.billing_name || d.shipping_name || ''}\n`
      + `Created: ${d.created_at}\n`
    )).join('\n----------------------------------------\n')
    downloadFile(`${fileName}.txt`, body, 'text/plain')
  }
}

export function InvoicesGrid() {
  const { state } = useApp()
  const printInvoices = usePdfMassAction('invoices', 'Invoices', 'invoices')
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
      render: r => stateLabel(INVOICE_STATES, r.state), searchValue: r => stateLabel(INVOICE_STATES, r.state),
    },
    {
      id: 'base_grand_total', label: 'Grand Total (Base)', filterType: 'range',
      render: r => formatCurrency(r.base_grand_total), exportValue: r => r.base_grand_total,
    },
    {
      id: 'grand_total', label: 'Grand Total (Purchased)', filterType: 'range',
      render: r => formatCurrency(r.grand_total), exportValue: r => r.grand_total,
    },
    {
      id: 'action', label: 'Action', sortable: false, className: 'col-actions',
      render: r => viewLink(`/admin/sales/invoice/view/invoice_id/${r.entity_id}/`),
      exportValue: () => 'View',
    },
    { id: 'customer_name', label: 'Customer Name', defaultVisible: false, filterType: 'text' },
    { id: 'customer_email', label: 'Customer Email', defaultVisible: false, filterType: 'text' },
    PAYMENT_METHOD_COLUMN,
    { id: 'shipping_information', label: 'Shipping Information', defaultVisible: false, filterType: 'text' },
    { id: 'billing_address', label: 'Billing Address', defaultVisible: false, filterType: 'text' },
    { id: 'shipping_address', label: 'Shipping Address', defaultVisible: false, filterType: 'text' },
  ]
  return (
    <PageShell title="Invoices" documentTitle="Invoices">
      <AdminGrid
        gridId="sales_order_invoice_grid"
        rows={state.invoices || []}
        columns={columns}
        selectable
        massActions={[{ id: 'pdfinvoices_order', label: 'PDF Invoices', onApply: printInvoices }]}
        exportFileName="invoices"
        /* DIFF-001: the source's saved bookmark sorts ascending on the Invoice
         * column — `th.data-grid-th._ascend` sits on `Invoice`, and the first row
         * is 000000001. */
        defaultSort={{ field: 'increment_id', direction: 'asc' }}
      />
    </PageShell>
  )
}

export function ShipmentsGrid() {
  const { state } = useApp()
  const printShipments = usePdfMassAction('shipments', 'Shipments', 'shipments')
  const printLabels = usePdfMassAction('shipments', 'Shipping Labels', 'shipping_labels')
  const columns = [
    { id: 'increment_id', label: 'Shipment', filterType: 'text', sortValue: r => Number(r.entity_id) },
    {
      id: 'created_at', label: 'Ship Date', filterType: 'date',
      render: r => formatDateTime(r.created_at), searchValue: r => formatDateTime(r.created_at),
    },
    { id: 'order_increment_id', label: 'Order #', filterType: 'text' },
    {
      id: 'order_created_at', label: 'Order Date', filterType: 'date',
      render: r => formatDateTime(r.order_created_at), searchValue: r => formatDateTime(r.order_created_at),
    },
    { id: 'shipping_name', label: 'Ship-to Name', filterType: 'text' },
    {
      /* DIFF-003: Magento's qty format in this grid keeps 4 decimals — the source
       * renders `1.0000`, not `1`. */
      id: 'total_qty', label: 'Total Quantity', filterType: 'range',
      render: r => Number(r.total_qty || 0).toFixed(4), exportValue: r => r.total_qty,
    },
    {
      id: 'action', label: 'Action', sortable: false, className: 'col-actions',
      render: r => viewLink(`/admin/sales/shipment/view/shipment_id/${r.entity_id}/`),
      exportValue: () => 'View',
    },
    { id: 'customer_name', label: 'Customer Name', defaultVisible: false, filterType: 'text' },
    { id: 'customer_email', label: 'Customer Email', defaultVisible: false, filterType: 'text' },
    PAYMENT_METHOD_COLUMN,
    { id: 'shipping_information', label: 'Shipping Information', defaultVisible: false, filterType: 'text' },
    { id: 'billing_address', label: 'Billing Address', defaultVisible: false, filterType: 'text' },
    { id: 'shipping_address', label: 'Shipping Address', defaultVisible: false, filterType: 'text' },
  ]
  return (
    <PageShell title="Shipments" documentTitle="Shipments">
      <AdminGrid
        gridId="sales_order_shipment_grid"
        rows={state.shipments || []}
        columns={columns}
        selectable
        massActions={[
          { id: 'pdfshipments_order', label: 'PDF Shipments', onApply: printShipments },
          { id: 'print_shipping_label', label: 'Print Shipping Labels', onApply: printLabels },
        ]}
        exportFileName="shipments"
        /* DIFF-002: as DIFF-001 — the source's `_ascend` marker is on `Shipment`
         * and rows read 000000001, 000000002, 000000003. */
        defaultSort={{ field: 'increment_id', direction: 'asc' }}
      />
    </PageShell>
  )
}

export function CreditMemosGrid() {
  const { state } = useApp()
  const printCreditMemos = usePdfMassAction('creditMemos', 'Credit Memos', 'creditmemos')
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
      render: r => stateLabel(CREDITMEMO_STATES, r.state), searchValue: r => stateLabel(CREDITMEMO_STATES, r.state),
    },
    {
      id: 'base_grand_total', label: 'Refunded', filterType: 'range',
      render: r => formatCurrency(r.base_grand_total), exportValue: r => r.base_grand_total,
    },
    {
      id: 'action', label: 'Action', sortable: false, className: 'col-actions',
      render: r => viewLink(`/admin/sales/creditmemo/view/creditmemo_id/${r.entity_id}/`),
      exportValue: () => 'View',
    },
    { id: 'customer_name', label: 'Customer Name', defaultVisible: false, filterType: 'text' },
    { id: 'customer_email', label: 'Customer Email', defaultVisible: false, filterType: 'text' },
    PAYMENT_METHOD_COLUMN,
    { id: 'billing_address', label: 'Billing Address', defaultVisible: false, filterType: 'text' },
    { id: 'shipping_address', label: 'Shipping Address', defaultVisible: false, filterType: 'text' },
  ]
  return (
    <PageShell title="Credit Memos" documentTitle="Credit Memos">
      <AdminGrid
        gridId="sales_order_creditmemo_grid"
        rows={state.creditMemos || []}
        columns={columns}
        selectable
        massActions={[{ id: 'pdfcreditmemos_order', label: 'PDF Credit Memos', onApply: printCreditMemos }]}
        exportFileName="creditmemos"
        defaultSort={{ field: 'created_at', direction: 'desc' }}
      />
    </PageShell>
  )
}

/* Rows 36 & 37 — both are genuinely empty in this deployment
 * (assets/html/sales-transactions.html), so the grid renders its real
 * "We couldn't find any records." empty state rather than invented rows. */

/* Round 10 · the source's `[name="method"]` option list on the Transactions
 * grid, transcribed verbatim in its own order. */
const TXN_PAYMENT_METHODS = [
  ['braintree_ach_direct_debit', 'ACH Direct Debit'],
  ['braintree_applepay', 'Apple Pay'],
  ['braintree', 'Credit Card'],
  ['braintree_googlepay', 'Google Pay'],
  ['braintree_local_payment', 'Local Payments'],
  ['braintree_paypal', 'PayPal'],
  ['braintree_paypal_vault', 'Stored Accounts (PayPal)'],
  ['braintree_cc_vault', 'Stored Cards'],
  ['braintree_venmo', 'Venmo'],
  ['banktransfer', 'Bank Transfer Payment'],
  ['cashondelivery', 'Cash On Delivery'],
  ['checkmo', 'Check / Money order'],
  ['free', 'No Payment Information Required'],
  ['purchaseorder', 'Purchase Order'],
  ['payflow_advanced', 'Credit Card (Payflow Advanced)'],
  ['payflow_link', 'Credit Card (Payflow Link)'],
  ['payflowpro', 'Credit Card (Payflow Pro)'],
  ['paypal_billing_agreement', 'PayPal Billing Agreement'],
  ['payflow_express_bml', 'PayPal Credit (Payflow Express Bml)'],
  ['paypal_express_bml', 'PayPal Credit (Paypal Express Bml)'],
  ['paypal_express', 'PayPal Express Checkout'],
  ['payflow_express', 'PayPal Express Checkout Payflow Edition'],
  ['hosted_pro', 'Payment by cards or by PayPal account'],
  ['payflowpro_cc_vault', 'Stored Cards (Payflow Pro)'],
].map(([value, label]) => ({ value, label }))

export function TransactionsGrid() {
  /* Round 10. LEGACY on the source. Header transcribed live: ID · Order ID ·
   * Transaction ID · Parent Transaction ID · Payment Method · Transaction Type ·
   * Closed · Created (8) — the mock was missing Payment Method and Created, had
   * Closed bound to `created_at`, and rendered the modern toolbar. */
  const columns = [
    { id: 'transaction_id', label: 'ID', filterType: 'range', numeric: true },
    { id: 'increment_id', label: 'Order ID', filterType: 'text' },
    { id: 'txn_id', label: 'Transaction ID', filterType: 'text' },
    { id: 'parent_txn_id', label: 'Parent Transaction ID', filterType: 'text' },
    {
      id: 'method', label: 'Payment Method', filterType: 'select',
      options: TXN_PAYMENT_METHODS,
      filterValue: r => String(r.method ?? ''),
    },
    {
      /* F-01 — the source's `[name="txn_type"]` is a select over the five
       * `sales_payment_transaction.txn_type` values. */
      id: 'txn_type',
      label: 'Transaction Type',
      filterType: 'select',
      options: [
        { value: 'order', label: 'Order' },
        { value: 'authorization', label: 'Authorization' },
        { value: 'capture', label: 'Capture' },
        { value: 'void', label: 'Void' },
        { value: 'refund', label: 'Refund' },
      ],
      filterValue: r => String(r.txn_type ?? ''),
    },
    {
      id: 'is_closed', label: 'Closed', filterType: 'select',
      options: [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }],
      filterValue: r => String(r.is_closed ?? ''),
      render: r => (Number(r.is_closed) ? 'Yes' : 'No'),
    },
    { id: 'created_at', label: 'Created', filterType: 'date' },
  ]
  return (
    <PageShell title="Transactions" documentTitle="Transactions">
      <LegacyAdminGrid gridId="sales_transactions_grid" basePath="/admin/sales/transactions/index"
        rows={[]} columns={columns} rowKey={r => r.transaction_id}
        exportable={false} exportFileName="transactions" />
    </PageShell>
  )
}

export function BillingAgreementsGrid() {
  /* Round 10. LEGACY on the source. Header transcribed live: ID · Email ·
   * First Name · Last Name · Reference ID · Status · Created · Updated (8). */
  const columns = [
    { id: 'agreement_id', label: 'ID', filterType: 'text' },
    { id: 'customer_email', label: 'Email', filterType: 'text' },
    { id: 'customer_firstname', label: 'First Name', filterType: 'text' },
    { id: 'customer_lastname', label: 'Last Name', filterType: 'text' },
    { id: 'reference_id', label: 'Reference ID', filterType: 'text' },
    {
      /* F-01 — source `[name="status"]` on this grid is
       * `<select id="billing_agreements_filter_status">` with exactly these two
       * states. */
      id: 'status',
      label: 'Status',
      filterType: 'select',
      options: [
        { value: 'active', label: 'Active' },
        { value: 'canceled', label: 'Canceled' },
      ],
      filterValue: r => String(r.status ?? ''),
    },
    { id: 'created_at', label: 'Created', filterType: 'date' },
    { id: 'updated_at', label: 'Updated', filterType: 'date' },
  ]
  return (
    <PageShell title="Billing Agreements" documentTitle="Billing Agreements">
      <LegacyAdminGrid gridId="billing_agreements" basePath="/admin/paypal/billing_agreement/index"
        rows={[]} columns={columns} rowKey={r => r.agreement_id}
        exportable={false} exportFileName="billing_agreements" />
    </PageShell>
  )
}
