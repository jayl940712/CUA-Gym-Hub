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
      {address.city}, {address.region}, {address.postcode}<br />
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
