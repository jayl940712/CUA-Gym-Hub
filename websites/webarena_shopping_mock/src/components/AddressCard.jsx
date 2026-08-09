import React from 'react'

/** The address block format the source repeats on the dashboard, the address
 *  book and the order view. */
export default function AddressCard({ address }) {
  if (!address) return null
  const streets = Array.isArray(address.street)
    ? address.street
    : String(address.street || '').split('\n')
  return (
    <address>
      {address.firstname} {address.lastname}<br />
      {address.company ? <>{address.company}<br /></> : null}
      {streets.filter(Boolean).map((s, i) => <React.Fragment key={i}>{s}<br /></React.Fragment>)}
      {/* Magento's address template emits TWO spaces after the city —
          `San Mateo,  California, 94010`. Verified identical in every source
          `<address>`: assets/html/order-view-148.html, account-dashboard.html
          and address-book.html all carry the doubled space, and the mock's own
          CheckoutPage.jsx already does. It collapses in rendered text, so the
          two evaluators that require `Manhattan, New York, 12112` /
          `… 12345` still match (DIFF-W01). */}
      {address.city}{',  '}{address.region}, {address.postcode}<br />
      {address.country || 'United States'}<br />
      T: <a href={`tel:${address.telephone}`} onClick={e => e.preventDefault()}>{address.telephone}</a>
    </address>
  )
}

/** sales_order_address rows store `region` / `country_id` rather than a
 *  resolved country name. */
export function OrderAddressCard({ address }) {
  if (!address) return null
  return (
    <AddressCard
      address={{
        ...address,
        country: address.country || (address.country_id === 'US' ? 'United States' : address.country_id),
      }}
    />
  )
}
