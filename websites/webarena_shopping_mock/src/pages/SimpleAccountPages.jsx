import React, { useState, useEffect } from 'react'
import Page from '../components/Page.jsx'
import { useApp } from '../context/AppContext.jsx'
import { SLink } from '../utils/url.js'

/** ROUTES #37 — /newsletter/manage/. The source h1 is singular. */
export function NewsletterPage() {
  const { state, setNewsletter, addMessage } = useApp()
  const [checked, setChecked] = useState(state.newsletterSubscribed)
  useEffect(() => { setChecked(state.newsletterSubscribed) }, [state.newsletterSubscribed])

  const onSubmit = (e) => {
    e.preventDefault()
    setNewsletter(checked)
    addMessage('We have saved your subscription.')
  }

  return (
    <Page title="Newsletter Subscription" documentTitle="Newsletter Subscription" sidebar="account">
      <form className="form form-newsletter-manage" onSubmit={onSubmit}>
        <fieldset className="fieldset">
          <legend className="legend"><span>Subscription option</span></legend>
          <div className="field choice">
            <input type="checkbox" id="subscription" checked={checked}
              onChange={e => setChecked(e.target.checked)} style={{ width: 'auto', height: 'auto' }} />{' '}
            <label htmlFor="subscription" className="label" style={{ display: 'inline' }}>
              <span>General Subscription</span>
            </label>
          </div>
        </fieldset>
        <div className="actions-toolbar">
          <button type="submit" className="action save primary"><span>Save</span></button>
          <div className="secondary">
            <SLink to="/" className="action back"><span>Back</span></SLink>
          </div>
        </div>
      </form>
    </Page>
  )
}

/** ROUTES #36 — /downloadable/customer/products/ */
export function DownloadableProductsPage() {
  return (
    <Page title="My Downloadable Products" documentTitle="My Downloadable Products" sidebar="account">
      <div className="message info empty">
        <div><span>You have not purchased any downloadable products yet.</span></div>
      </div>
      <div className="actions-toolbar">
        <div className="secondary">
          <SLink to="/" className="action back"><span>Back</span></SLink>
        </div>
      </div>
    </Page>
  )
}

/** Linked from the account nav. The source target was not captured
 *  (SOURCE.md Gaps #8); Magento's stock empty state is used. */
export function StoredPaymentMethodsPage() {
  return (
    <Page title="Stored Payment Methods" documentTitle="Stored Payment Methods" sidebar="account">
      <div className="message info empty">
        <div><span>You have no stored payment methods.</span></div>
      </div>
      <div className="actions-toolbar">
        <div className="secondary">
          <SLink to="/" className="action back"><span>Back</span></SLink>
        </div>
      </div>
    </Page>
  )
}

/** Linked from the wish list. Target page was not captured (SOURCE.md Gaps #8). */
export function ShareWishlistPage() {
  const { state, addMessage } = useApp()
  const [emails, setEmails] = useState('')
  const [message, setMessage] = useState('')
  return (
    <Page title="Share Wish List" documentTitle="Share Wish List" sidebar="account">
      <form className="form wishlist share" onSubmit={e => {
        e.preventDefault()
        addMessage('Your wish list has been shared.')
        setEmails(''); setMessage('')
      }}>
        <fieldset className="fieldset">
          <legend className="legend"><span>Sharing Information</span></legend>
          <div className="field required">
            <label className="label" htmlFor="email_address"><span>Email addresses, separated by commas</span></label>
            <div className="control">
              <textarea id="email_address" rows={3} value={emails} onChange={e => setEmails(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="share_message"><span>Message</span></label>
            <div className="control">
              <textarea id="share_message" rows={5} value={message} onChange={e => setMessage(e.target.value)} />
            </div>
          </div>
        </fieldset>
        <div className="actions-toolbar">
          <button type="submit" className="action submit primary" disabled={state.wishlist.items.length === 0}>
            <span>Share Wish List</span>
          </button>
          <div className="secondary"><SLink to="/wishlist/" className="action back"><span>Back</span></SLink></div>
        </div>
      </form>
    </Page>
  )
}

/** Linked from the cart Summary panel. Target page was not captured. */
export function MultishippingPage() {
  return (
    <Page title="Ship to Multiple Addresses" documentTitle="Ship to Multiple Addresses" sidebar="none">
      <div className="message notice">
        <div>Please select shipping addresses for the items in your cart from your address book.</div>
      </div>
      <div className="actions-toolbar">
        <SLink to="/checkout/cart/" className="action back"><span>Back to Shopping Cart</span></SLink>
      </div>
    </Page>
  )
}
