import React, { useState } from 'react'
import PageShell from '../../components/layout/PageShell.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import { useApp } from '../../context/AppContext.jsx'
import '../../components/system/system.css'

/**
 * Menu-reachable external / SaaS surfaces (ROUTES "Intentionally Not Migrated").
 * The rail links to all five, so they must render the source's real page rather
 * than 404 or show a blank area — but they make no network call, and the actions
 * that would reach an outside service say so instead of pretending.
 *
 * All copy below is transcribed from the live source pages.
 */

/* ------------------------------------------------------- Magento Marketplace */

const PLATINUM_PARTNERS = [
  {
    name: 'Yotpo',
    blurb: 'Yotpo is a game-changing reviews and marketing solution disrupting how businesses generate and use feedback. We help companies generate reviews, acquire traffic and increase conversions.',
  },
  {
    name: 'Akeneo PIM',
    blurb: 'Akeneo enables retailers and corporate brands to deliver a consistent and enriched customer experience across all sales channels, including eCommerce, marketplace, mobile, print, and retail points of sale. Akeneo’s open source enterprise PIM (Product Information Management) manages and feeds high-quality product information to the Magento platform. It dramatically improves product data quality and accuracy while simplifying and accelerating product catalog management. This increases sales conversions, reduces product returns and accelerates time-to-market.',
  },
  {
    name: 'Vertex',
    blurb: 'Vertex is the leading and most trusted provider of comprehensive, integrated tax technology solutions for corporations worldwide. Since 1978, more than 10,000 companies from around the world have relied on Vertex for our unparalleled expertise in tax technology and data management. Vertex combines sophisticated software and an award-winning team of tax experts to help Magento merchants stay on top of ever-changing tax laws. Use Vertex for simple sales and use tax calculations, or all the way through the filing and remittance process.',
  },
  {
    name: 'dotmailer',
    blurb: 'A multichannel marketing automation platform with email at its core and a Platinum Technology Partner. B2B & B2C clients such as Fred Perry, Bidvest 3663 and Venroy use dotmailer’s powerful yet user-friendly platform for smarter marketing.',
  },
]

export function Marketplace() {
  const { addMessage } = useApp()
  const offsite = () => addMessage('This link opens magento.com, which is outside this environment.', 'notice')

  return (
    <PageShell title="Magento Marketplace">
      <div className="marketplace-page">
        <h2>Platinum Partners</h2>
        <p>
          Representing Magento&apos;s highest level of partner engagement, Magento Platinum Partners have
          established themselves as leaders and innovators of key products and services designed to help
          merchants and brands grow their business. Magento reserves the Platinum level for select trusted
          partners that are committed to offering integrations of commerce features, functions, and tools, as
          well as back-end systems and operations, to extend and enhance the power of the Magento commerce
          platform.
        </p>

        <h3>Featured Platinum Partners</h3>
        <ul className="marketplace-partners">
          {PLATINUM_PARTNERS.map(p => (
            <li key={p.name}>
              <h4>{p.name}</h4>
              <p>{p.blurb}</p>
              <button type="button" className="action-tertiary" onClick={offsite}>Read More</button>
              <button type="button" className="action-tertiary" onClick={offsite}>Partner Page</button>
            </li>
          ))}
        </ul>

        <h3>Partner search</h3>
        <p>
          Magento has a thriving ecosystem of technology partners to help merchants and brands deliver the best
          possible customer experiences. They are recognized as experts in eCommerce, search, email marketing,
          payments, tax, fraud, optimization and analytics, fulfillment, and more. Visit the Magento Partner
          Directory to see all of our trusted partners.
        </p>
        <button type="button" className="action-default" onClick={offsite}>More Partners</button>

        <h3>Magento Marketplace</h3>
        <p>
          Extensions and Themes are an essential component of the Magento Ecosystem. Please visit the Magento
          Marketplace to see the latest innovations that developers have created to enhance your Magento Store.
        </p>
        <button type="button" className="action-default" onClick={offsite}>Visit Magento Marketplace</button>
      </div>
    </PageShell>
  )
}

/* ------------------------------------------------ Braintree Virtual Terminal */

export function BraintreeVirtualTerminal() {
  const { addMessage } = useApp()
  const [form, setForm] = useState({ amount: '', number: '', expiration: '', cvv: '' })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  function submit(e) {
    e.preventDefault()
    if (!form.amount.trim() || !form.number.trim()) {
      addMessage('Please enter an amount and a card number.', 'error')
      return
    }
    addMessage('Braintree is not connected in this environment, so no payment was taken.', 'notice')
  }

  const field = (id, label, value, onChange) => (
    <div className="admin__field _required">
      <label className="admin__field-label" htmlFor={id}><span>{label}</span></label>
      <div className="admin__field-control">
        <input id={id} name={id} type="text" className="admin__control-text"
          value={value} onChange={e => onChange(e.target.value)} autoComplete="off" />
      </div>
    </div>
  )

  return (
    <PageShell title="Braintree Virtual Terminal">
      <form id="braintree-virtual-terminal" onSubmit={submit}>
        <fieldset className="admin__fieldset">
          <legend className="admin__legend"><span>Take Payment</span></legend>
          {field('amount', 'Amount', form.amount, v => set('amount', v))}
          {field('number', 'Card Number', form.number, v => set('number', v))}
          {field('expiration', 'Expiration Date', form.expiration, v => set('expiration', v))}
          {field('cvv', 'Card Verification Number', form.cvv, v => set('cvv', v))}
          <div className="admin__field">
            <div className="admin__field-control">
              <button type="submit" className="action-default scalable primary"><span>Take Payment</span></button>
            </div>
          </div>
        </fieldset>
      </form>
    </PageShell>
  )
}

/* ------------------------------------------- Braintree Settlement Report (grid) */

export function BraintreeSettlementReport() {
  const columns = [
    { id: 'transaction_id', label: 'Transaction ID', filterType: 'text' },
    { id: 'order_id', label: 'Order ID', filterType: 'text' },
    { id: 'paypal_payment_id', label: 'PayPal Payment ID', filterType: 'text' },
    { id: 'payment_type', label: 'Payment Type', filterType: 'text' },
    { id: 'transaction_type', label: 'Transaction Type', filterType: 'text' },
    { id: 'created_at', label: 'Created At', filterType: 'date' },
    { id: 'amount', label: 'Amount', filterType: 'range' },
    { id: 'settlement_code', label: 'Settlement Code', filterType: 'text' },
    { id: 'status', label: 'Status', filterType: 'text' },
    { id: 'settlement_response_text', label: 'Settlement Response Text', filterType: 'text' },
    { id: 'refund_ids', label: 'Refund Ids', filterType: 'text' },
    { id: 'merchant_account_id', label: 'Merchant Account ID', filterType: 'text' },
    { id: 'settlement_batch_id', label: 'Settlement Batch ID', filterType: 'text' },
    { id: 'currency', label: 'Currency', filterType: 'text' },
  ]
  return (
    <PageShell title="Braintree Settlement Report">
      <div className="admin__page-note">
        Apply filters in order to get results. Only first 100 records will be displayed in the grid, you will be
        able to download full version of the report in .csv format.
      </div>
      <AdminGrid gridId="braintree_report" rows={[]} columns={columns} rowKey={r => r.transaction_id}
        exportFileName="braintree_settlement_report" />
    </PageShell>
  )
}

/* ------------------------------------------------ PayPal Settlement Reports */

export function PaypalSettlementReports() {
  const { addMessage } = useApp()
  const columns = [
    { id: 'report_date', label: 'Report Date', filterType: 'date' },
    { id: 'account_id', label: 'Merchant Account', filterType: 'text' },
    { id: 'transaction_id', label: 'Transaction ID', filterType: 'text' },
    { id: 'invoice_id', label: 'Invoice ID', filterType: 'text' },
    { id: 'paypal_reference_id', label: 'PayPal Reference ID', filterType: 'text' },
    { id: 'transaction_event_code', label: 'Event', filterType: 'text' },
    { id: 'start_date', label: 'Start Date', filterType: 'date' },
    { id: 'finish_date', label: 'Finish Date', filterType: 'date' },
    { id: 'gross_transaction_amount', label: 'Gross Amount', filterType: 'range' },
    { id: 'fee_amount', label: 'Fee Amount', filterType: 'range' },
  ]
  const actions = (
    <button type="button" className="action-default scalable"
      onClick={() => addMessage('PayPal SFTP credentials are not configured in this environment.', 'notice')}>
      <span>Fetch Updates</span>
    </button>
  )
  return (
    <PageShell title="PayPal Settlement Reports" actions={actions}>
      <AdminGrid gridId="paypalSettlementReports" rows={[]} columns={columns} rowKey={r => r.transaction_id}
        exportFileName="paypal_settlement_reports" />
    </PageShell>
  )
}

/* ------------------------------------------------------------- BI Essentials */

/**
 * `/admin/analytics/biessentials/signup/` is a signup splash for Magento
 * Business Intelligence. The live page could not be captured — the container
 * closed the connection with ERR_HTTP2_PROTOCOL_ERROR on every attempt — so the
 * shell renders the page title and states plainly that the product is external,
 * rather than inventing marketing copy.
 */
export function BiEssentials() {
  return (
    <PageShell title="BI Essentials">
      <div className="admin__page-note">
        Magento Business Intelligence Essentials is a hosted product. Sign-up runs against
        magento.com, which is outside this environment.
      </div>
    </PageShell>
  )
}
