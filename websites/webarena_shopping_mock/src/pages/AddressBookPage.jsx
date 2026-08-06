import React from 'react'
import Page from '../components/Page.jsx'
import AddressCard from '../components/AddressCard.jsx'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useStoreNavigate } from '../utils/url.js'

/** ROUTES #25 — /customer/address/ */
export default function AddressBookPage() {
  const { state, deleteAddress, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const billing = state.addresses.find(a => a.id === state.customer.defaultBilling)
  const shipping = state.addresses.find(a => a.id === state.customer.defaultShipping)
  const additional = state.addresses.filter(
    a => a.id !== state.customer.defaultBilling && a.id !== state.customer.defaultShipping
  )

  return (
    <Page title="Address Book" documentTitle="Address Book" sidebar="account">
      <div className="block block-addresses-default">
        <div className="block-title"><strong>Default Addresses</strong></div>
        <div className="block-content columns2">
          <div className="box box-address-billing">
            <strong className="box-title"><span>Default Billing Address</span></strong>
            <div className="box-content">
              {billing ? <AddressCard address={billing} /> : <p>You have no default billing address in your address book.</p>}
            </div>
            <div className="box-actions">
              <SLink className="action edit" to={billing ? `/customer/address/edit/id/${billing.id}/` : '/customer/address/new/'}>
                <span>Change Billing Address</span>
              </SLink>
            </div>
          </div>
          <div className="box box-address-shipping">
            <strong className="box-title"><span>Default Shipping Address</span></strong>
            <div className="box-content">
              {shipping ? <AddressCard address={shipping} /> : <p>You have no default shipping address in your address book.</p>}
            </div>
            <div className="box-actions">
              <SLink className="action edit" to={shipping ? `/customer/address/edit/id/${shipping.id}/` : '/customer/address/new/'}>
                <span>Change Shipping Address</span>
              </SLink>
            </div>
          </div>
        </div>
      </div>

      <div className="block block-addresses-list">
        <div className="block-title"><strong>Additional Address Entries</strong></div>
        <div className="block-content">
          {additional.length === 0 ? (
            <p className="empty">You have no other address entries in your address book.</p>
          ) : (
            <table className="data table table-additional-addresses-items" id="additional-addresses-table">
              <thead>
                <tr>
                  <th scope="col" className="col firstname">First Name</th>
                  <th scope="col" className="col lastname">Last Name</th>
                  <th scope="col" className="col streetaddress">Street Address</th>
                  <th scope="col" className="col city">City</th>
                  <th scope="col" className="col country">Country</th>
                  <th scope="col" className="col state">State</th>
                  <th scope="col" className="col zip">Zip/Postal Code</th>
                  <th scope="col" className="col phone">Phone</th>
                  <th scope="col" className="col actions">Action</th>
                </tr>
              </thead>
              <tbody>
                {additional.map(a => (
                  <tr key={a.id}>
                    <td data-th="First Name">{a.firstname}</td>
                    <td data-th="Last Name">{a.lastname}</td>
                    <td data-th="Street Address">{(Array.isArray(a.street) ? a.street : [a.street]).join(', ')}</td>
                    <td data-th="City">{a.city}</td>
                    <td data-th="Country">{a.country || 'United States'}</td>
                    <td data-th="State">{a.region}</td>
                    <td data-th="Zip/Postal Code">{a.postcode}</td>
                    <td data-th="Phone">{a.telephone}</td>
                    <td data-th="Action" className="col actions">
                      <SLink className="action edit" to={`/customer/address/edit/id/${a.id}/`}><span>Edit</span></SLink>{' '}
                      <a className="action delete" href="#" onClick={e => {
                        e.preventDefault()
                        deleteAddress(a.id)
                        addMessage('You deleted the address.')
                      }}><span>Delete</span></a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Source order: one toolbar after "Additional Address Entries", with
          Add New Address in .primary and the (CSS-hidden) Back in .secondary. */}
      <div className="actions-toolbar">
        <div className="primary">
          <button type="button" role="add-address" title="Add New Address"
            className="action primary add" onClick={() => navigate('/customer/address/new/')}>
            <span>Add New Address</span>
          </button>
        </div>
        <div className="secondary">
          <SLink to="/customer/account/" className="action back"><span>Back</span></SLink>
        </div>
      </div>
    </Page>
  )
}
