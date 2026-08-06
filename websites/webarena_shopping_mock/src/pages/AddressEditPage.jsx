import React, { useState } from 'react'
import Page from '../components/Page.jsx'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useStoreNavigate } from '../utils/url.js'
import { US_REGIONS, COUNTRIES } from '../utils/geo.js'

/** ROUTES #26 / #27 — /customer/address/edit/id/:id/ and /customer/address/new/ */
export default function AddressEditPage({ addressId }) {
  const { state, saveAddress, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const existing = addressId != null
    ? state.addresses.find(a => Number(a.id) === Number(addressId))
    : null
  const isOnly = state.addresses.length <= 1 && !!existing

  const [form, setForm] = useState(() => ({
    id: existing ? existing.id : null,
    firstname: existing ? existing.firstname : state.customer.firstname,
    lastname: existing ? existing.lastname : state.customer.lastname,
    company: existing ? existing.company || '' : '',
    telephone: existing ? existing.telephone : '',
    street: existing
      ? [(Array.isArray(existing.street) ? existing.street[0] : existing.street) || '',
         (Array.isArray(existing.street) ? existing.street[1] : '') || '']
      : ['', ''],
    city: existing ? existing.city : '',
    region: existing ? existing.region : '',
    postcode: existing ? existing.postcode : '',
    countryId: existing ? existing.countryId || 'US' : 'US',
    isDefaultBilling: existing ? !!existing.isDefaultBilling : state.addresses.length === 0,
    isDefaultShipping: existing ? !!existing.isDefaultShipping : state.addresses.length === 0,
  }))
  const [errors, setErrors] = useState({})

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const onSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    if (!form.firstname.trim()) errs.firstname = 'This is a required field.'
    if (!form.lastname.trim()) errs.lastname = 'This is a required field.'
    if (!form.telephone.trim()) errs.telephone = 'This is a required field.'
    if (!form.street[0].trim()) errs.street = 'This is a required field.'
    if (!form.city.trim()) errs.city = 'This is a required field.'
    if (!form.region.trim()) errs.region = 'Please select a region, state or province.'
    if (!form.postcode.trim()) errs.postcode = 'This is a required field.'
    setErrors(errs)
    if (Object.keys(errs).length) return

    const country = COUNTRIES.find(c => c.id === form.countryId)
    saveAddress({
      id: form.id,
      firstname: form.firstname.trim(),
      lastname: form.lastname.trim(),
      company: form.company.trim() || null,
      telephone: form.telephone.trim(),
      street: form.street.map(s => s.trim()).filter(Boolean),
      city: form.city.trim(),
      region: form.region,
      regionId: (US_REGIONS.find(r => r.name === form.region) || {}).id || null,
      postcode: form.postcode.trim(),
      countryId: form.countryId,
      country: country ? country.name : 'United States',
      isDefaultBilling: form.isDefaultBilling,
      isDefaultShipping: form.isDefaultShipping,
    })
    addMessage('You saved the address.')
    navigate('/customer/address/')
  }

  const title = existing ? 'Edit Address' : 'Add New Address'

  return (
    <Page title={title} documentTitle={title} sidebar="account">
      <form className="form-address-edit" onSubmit={onSubmit} noValidate>
        <fieldset className="fieldset">
          <legend className="legend"><span>Contact Information</span></legend>
          <div className="field required">
            <label className="label" htmlFor="firstname"><span>First Name</span></label>
            <div className="control">
              <input type="text" id="firstname" value={form.firstname} onChange={e => set('firstname', e.target.value)} />
              {errors.firstname && <span className="field-error">{errors.firstname}</span>}
            </div>
          </div>
          <div className="field required">
            <label className="label" htmlFor="lastname"><span>Last Name</span></label>
            <div className="control">
              <input type="text" id="lastname" value={form.lastname} onChange={e => set('lastname', e.target.value)} />
              {errors.lastname && <span className="field-error">{errors.lastname}</span>}
            </div>
          </div>
          <div className="field">
            <label className="label" htmlFor="company"><span>Company</span></label>
            <div className="control">
              <input type="text" id="company" value={form.company} onChange={e => set('company', e.target.value)} />
            </div>
          </div>
          <div className="field required">
            <label className="label" htmlFor="telephone"><span>Phone Number</span></label>
            <div className="control">
              <input type="text" id="telephone" value={form.telephone} onChange={e => set('telephone', e.target.value)} />
              {errors.telephone && <span className="field-error">{errors.telephone}</span>}
            </div>
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="legend"><span>Address</span></legend>
          <div className="field required">
            <label className="label" htmlFor="street_1"><span>Street Address</span></label>
            <div className="control">
              <input type="text" id="street_1" placeholder="Street Address: Line 1"
                value={form.street[0]} onChange={e => set('street', [e.target.value, form.street[1]])} />
              {errors.street && <span className="field-error">{errors.street}</span>}
              <input type="text" id="street_2" placeholder="Street Address: Line 2" style={{ marginTop: 8 }}
                value={form.street[1]} onChange={e => set('street', [form.street[0], e.target.value])} />
            </div>
          </div>
          <div className="field required">
            <label className="label" htmlFor="country"><span>Country</span></label>
            <div className="control">
              <select id="country" value={form.countryId} onChange={e => set('countryId', e.target.value)}>
                {COUNTRIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="field required">
            <label className="label" htmlFor="region"><span>State/Province</span></label>
            <div className="control">
              {form.countryId === 'US' ? (
                <select id="region" value={form.region} onChange={e => set('region', e.target.value)}>
                  <option value="">Please select a region, state or province.</option>
                  {US_REGIONS.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
                </select>
              ) : (
                <input type="text" id="region" value={form.region} onChange={e => set('region', e.target.value)} />
              )}
              {errors.region && <span className="field-error">{errors.region}</span>}
            </div>
          </div>
          <div className="field required">
            <label className="label" htmlFor="city"><span>City</span></label>
            <div className="control">
              <input type="text" id="city" value={form.city} onChange={e => set('city', e.target.value)} />
              {errors.city && <span className="field-error">{errors.city}</span>}
            </div>
          </div>
          <div className="field required">
            <label className="label" htmlFor="zip"><span>Zip/Postal Code</span></label>
            <div className="control">
              <input type="text" id="zip" value={form.postcode} onChange={e => set('postcode', e.target.value)} />
              {errors.postcode && <span className="field-error">{errors.postcode}</span>}
            </div>
          </div>
          <div className="field choice">
            {isOnly ? (
              <span>It&#039;s a default billing address.</span>
            ) : (
              <>
                <input type="checkbox" id="primary_billing" checked={form.isDefaultBilling}
                  onChange={e => set('isDefaultBilling', e.target.checked)} style={{ width: 'auto', height: 'auto' }} />{' '}
                <label className="label" htmlFor="primary_billing" style={{ display: 'inline' }}>
                  <span>Use as my default billing address</span>
                </label>
              </>
            )}
          </div>
          <div className="field choice">
            {isOnly ? (
              <span>It&#039;s a default shipping address.</span>
            ) : (
              <>
                <input type="checkbox" id="primary_shipping" checked={form.isDefaultShipping}
                  onChange={e => set('isDefaultShipping', e.target.checked)} style={{ width: 'auto', height: 'auto' }} />{' '}
                <label className="label" htmlFor="primary_shipping" style={{ display: 'inline' }}>
                  <span>Use as my default shipping address</span>
                </label>
              </>
            )}
          </div>
        </fieldset>

        <div className="actions-toolbar">
          <button type="submit" className="action save primary"><span>Save Address</span></button>
          <div className="secondary"><SLink to="/customer/address/" className="action back"><span>Go back</span></SLink></div>
        </div>
      </form>
    </Page>
  )
}
