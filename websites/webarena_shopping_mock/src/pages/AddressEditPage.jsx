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
      {/* Attributes transcribed from assets/html/address-edit.html: the source
          form is `<form class="form-address-edit" id="form-validate">`, every
          control carries a real `name`, each field div carries a semantic class,
          and each legend is followed by a `<br>` (hidden by CSS). */}
      <form className="form-address-edit" id="form-validate" onSubmit={onSubmit} noValidate>
        <fieldset className="fieldset">
          <legend className="legend"><span>Contact Information</span></legend><br />
          <div className="field field-name-firstname required">
            <label className="label" htmlFor="firstname"><span>First Name</span></label>
            <div className="control">
              <input type="text" id="firstname" name="firstname" title="First Name"
                value={form.firstname} onChange={e => set('firstname', e.target.value)} />
              {errors.firstname && <span className="field-error">{errors.firstname}</span>}
            </div>
          </div>
          <div className="field field-name-lastname required">
            <label className="label" htmlFor="lastname"><span>Last Name</span></label>
            <div className="control">
              <input type="text" id="lastname" name="lastname" title="Last Name"
                value={form.lastname} onChange={e => set('lastname', e.target.value)} />
              {errors.lastname && <span className="field-error">{errors.lastname}</span>}
            </div>
          </div>
          <div className="field company">
            <label className="label" htmlFor="company"><span>Company</span></label>
            <div className="control">
              <input type="text" id="company" name="company" title="Company"
                value={form.company} onChange={e => set('company', e.target.value)} />
            </div>
          </div>
          <div className="field telephone required">
            <label className="label" htmlFor="telephone"><span>Phone Number</span></label>
            <div className="control">
              <input type="tel" id="telephone" name="telephone" title="Phone Number"
                value={form.telephone} onChange={e => set('telephone', e.target.value)} />
              {errors.telephone && <span className="field-error">{errors.telephone}</span>}
            </div>
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend className="legend"><span>Address</span></legend><br />
          {/* The source spells the two lines out as real sublabels, not
              placeholders: `.field.primary > label[for=street_1]` reading
              "Street Address: Line 1", then `.nested > .field.additional`
              holding "Street Address: Line 2". */}
          <div className="field street required">
            <label className="label" htmlFor="street_1"><span>Street Address</span></label>
            <div className="control">
              <div className="field primary">
                <label className="label" htmlFor="street_1"><span>Street Address: Line 1</span></label>
              </div>
              <input type="text" id="street_1" name="street[0]" title="Street Address"
                value={form.street[0]} onChange={e => set('street', [e.target.value, form.street[1]])} />
              {errors.street && <span className="field-error">{errors.street}</span>}
              <div className="nested">
                <div className="field additional">
                  <label className="label" htmlFor="street_2"><span>Street Address: Line 2</span></label>
                  <div className="control">
                    <input type="text" id="street_2" name="street[1]" title="Street Address 2"
                      value={form.street[1]} onChange={e => set('street', [form.street[0], e.target.value])} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="field country required">
            <label className="label" htmlFor="country"><span>Country</span></label>
            <div className="control">
              <select id="country" name="country_id" title="Country"
                value={form.countryId} onChange={e => set('countryId', e.target.value)}>
                {COUNTRIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          {/* The source ships BOTH controls in the DOM and shows whichever the
              selected country needs: `select#region_id[name=region_id]` for
              countries with a region table, `input#region[name=region]` for the
              rest. Keeping both means a source-derived `#region_id` OR `#region`
              selector resolves, exactly as it does on the container. */}
          <div className="field region required">
            <label className="label" htmlFor="region_id"><span>State/Province</span></label>
            <div className="control">
              <select id="region_id" name="region_id" title="State/Province"
                className="validate-select region_id"
                value={form.region} onChange={e => set('region', e.target.value)}
                style={{ display: form.countryId === 'US' ? '' : 'none' }}>
                <option value="">Please select a region, state or province.</option>
                {US_REGIONS.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              <input type="text" id="region" name="region" title="State/Province"
                value={form.region} onChange={e => set('region', e.target.value)}
                style={{ display: form.countryId === 'US' ? 'none' : '' }} />
              {errors.region && <span className="field-error">{errors.region}</span>}
            </div>
          </div>
          <div className="field city required">
            <label className="label" htmlFor="city"><span>City</span></label>
            <div className="control">
              <input type="text" id="city" name="city" title="City"
                value={form.city} onChange={e => set('city', e.target.value)} />
              {errors.city && <span className="field-error">{errors.city}</span>}
            </div>
          </div>
          <div className="field zip required">
            <label className="label" htmlFor="zip"><span>Zip/Postal Code</span></label>
            <div className="control">
              <input type="text" id="zip" name="postcode" title="Zip/Postal Code"
                value={form.postcode} onChange={e => set('postcode', e.target.value)} />
              {errors.postcode && <span className="field-error">{errors.postcode}</span>}
            </div>
          </div>
          {/* When the address is the customer's only one Magento cannot let it
              stop being the default, so it swaps each checkbox for
              `<div class="message info"><span>It's a default … address.</span></div>`
              (verbatim from address-edit.html). */}
          {isOnly ? (
            <div className="message info"><span>It&#039;s a default billing address.</span></div>
          ) : (
            <div className="field choice">
              <input type="checkbox" name="default_billing" id="primary_billing" value="1"
                title="Use as my default billing address" className="checkbox"
                checked={form.isDefaultBilling} onChange={e => set('isDefaultBilling', e.target.checked)} />{' '}
              <label className="label" htmlFor="primary_billing">
                <span>Use as my default billing address</span>
              </label>
            </div>
          )}
          {isOnly ? (
            <div className="message info"><span>It&#039;s a default shipping address.</span></div>
          ) : (
            <div className="field choice">
              <input type="checkbox" name="default_shipping" id="primary_shipping" value="1"
                title="Use as my default shipping address" className="checkbox"
                checked={form.isDefaultShipping} onChange={e => set('isDefaultShipping', e.target.checked)} />{' '}
              <label className="label" htmlFor="primary_shipping">
                <span>Use as my default shipping address</span>
              </label>
            </div>
          )}
        </fieldset>

        <div className="actions-toolbar">
          <div className="primary">
            <button type="submit" className="action save primary" data-action="save-address"
              title="Save Address"><span>Save Address</span></button>
          </div>
          <div className="secondary"><SLink to="/customer/address/" className="action back"><span>Go back</span></SLink></div>
        </div>
      </form>
    </Page>
  )
}
