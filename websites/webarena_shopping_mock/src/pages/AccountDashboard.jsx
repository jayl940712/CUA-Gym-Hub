import React from 'react'
import Page from '../components/Page.jsx'
import AddressCard from '../components/AddressCard.jsx'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useStoreNavigate } from '../utils/url.js'
import { money, shortDate, statusLabel } from '../utils/format.js'
import { sortedOrders } from '../utils/orders.js'

/** ROUTES #22 — /customer/account/ */
export default function AccountDashboard() {
  const { state, reorder, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const billing = state.addresses.find(a => a.id === state.customer.defaultBilling)
  const shipping = state.addresses.find(a => a.id === state.customer.defaultShipping)
  const recent = sortedOrders(state.orders).slice(0, 5)

  const onReorder = (order) => {
    reorder(order.entityId)
    addMessage(`You added ${order.items.length} product(s) to your shopping cart.`)
    navigate('/checkout/cart/')
  }

  return (
    <Page title="My Account" documentTitle="My Account" sidebar="account">
      <div className="block block-dashboard-info">
        <div className="block-title"><strong>Account Information</strong></div>
        <div className="block-content columns2">
          <div className="box box-information">
            <strong className="box-title"><span>Contact Information</span></strong>
            <div className="box-content">
              {state.customer.firstname} {state.customer.lastname}<br />
              {state.customer.email}<br />
            </div>
            <div className="box-actions">
              <SLink className="action edit" to="/customer/account/edit/"><span>Edit</span></SLink>
              <SLink className="action change-password" to="/customer/account/edit/changepass/1/"><span>Change Password</span></SLink>
            </div>
          </div>
          <div className="box box-newsletter">
            <strong className="box-title"><span>Newsletters</span></strong>
            <div className="box-content">
              <p>{state.newsletterSubscribed
                ? 'You are subscribed to "General Subscription".'
                : "You aren't subscribed to our newsletter."}</p>
            </div>
            <div className="box-actions">
              <SLink className="action edit" to="/newsletter/manage/"><span>Edit</span></SLink>
            </div>
          </div>
        </div>
      </div>

      <div className="block block-dashboard-addresses">
        <div className="block-title">
          <strong>Address Book</strong>
          <SLink className="action edit" to="/customer/address/"><span>Manage Addresses</span></SLink>
        </div>
        <div className="block-content columns2">
          <div className="box box-billing-address">
            <strong className="box-title"><span>Default Billing Address</span></strong>
            <div className="box-content">
              {billing ? <AddressCard address={billing} /> : <p>You have not set a default billing address.</p>}
            </div>
            {billing && (
              <div className="box-actions">
                <SLink className="action edit" to={`/customer/address/edit/id/${billing.id}/`}><span>Edit Address</span></SLink>
              </div>
            )}
          </div>
          <div className="box box-shipping-address">
            <strong className="box-title"><span>Default Shipping Address</span></strong>
            <div className="box-content">
              {shipping ? <AddressCard address={shipping} /> : <p>You have not set a default shipping address.</p>}
            </div>
            {shipping && (
              <div className="box-actions">
                <SLink className="action edit" to={`/customer/address/edit/id/${shipping.id}/`}><span>Edit Address</span></SLink>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="block block-dashboard-orders">
        <div className="block-title">
          <strong>Recent Orders</strong>
          <SLink className="action view" to="/sales/order/history/"><span>View All</span></SLink>
        </div>
        <div className="block-content">
          <table className="data table table-order-items" id="my-orders-table">
            <caption className="table-caption visually-hidden">Recent Orders</caption>
            <thead>
              <tr>
                <th scope="col" className="col id">Order #</th>
                <th scope="col" className="col date">Date</th>
                <th scope="col" className="col shipping">Ship To</th>
                <th scope="col" className="col total">Order Total</th>
                <th scope="col" className="col status">Status</th>
                <th scope="col" className="col actions">Action</th>
              </tr>
            </thead>
            <tbody>
              {recent.map(o => (
                <tr key={o.entityId}>
                  <td className="col id">{o.incrementId}</td>
                  <td className="col date">{shortDate(o.createdAt)}</td>
                  <td className="col shipping">
                    {o.shippingAddress ? `${o.shippingAddress.firstname} ${o.shippingAddress.lastname}` : ''}
                  </td>
                  <td className="col total">{money(o.grandTotal)}</td>
                  <td className="col status">{statusLabel(o.status)}</td>
                  <td className="col actions">
                    <SLink className="action view" to={`/sales/order/view/order_id/${o.entityId}/`}>
                      <span>View Order</span>
                    </SLink>{' '}
                    <a className="action order" href="#" onClick={e => { e.preventDefault(); onReorder(o) }}>
                      <span>Reorder</span>
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Page>
  )
}
