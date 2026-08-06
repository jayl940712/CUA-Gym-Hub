import React, { useLayoutEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import NotFound from '../NotFound.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { getOrderAddress } from '../../utils/selectors.js'
import { useSidNavigate } from '../../utils/navigation.js'
import {
  COUNTRIES,
  regionsFor,
  isRegionRequired,
  matchDefaultRegion,
} from '../../components/sales/directoryData.js'
import '../../components/sales/sales.css'

/* ROUTES.md row 15 — /admin/sales/order/address/address_id/:addressId/
 *
 * Field set, order, labels and the notice copy are transcribed from
 * assets/html/sales-order-address-603.html; the country list and the US region
 * list come out of that same page (see components/sales/directoryData.js).
 * Tasks 538-542 read the resulting address back off the order view, so the
 * region has to be stored as a label as well as an id.
 */

function initialForm(address) {
  const street = Array.isArray(address.street)
    ? address.street
    : String(address.street || '').split('\n')
  const countryId = address.country_id || 'US'
  return {
    prefix: address.prefix || '',
    firstname: address.firstname || '',
    middlename: address.middlename || '',
    lastname: address.lastname || '',
    suffix: address.suffix || '',
    company: address.company || '',
    street0: street[0] || '',
    street1: street[1] || '',
    city: address.city || '',
    country_id: countryId,
    /* F-02 / DOM-202. On the source `#region`'s DOM *property* is "" whenever a
     * region select is on screen — only the `value` attribute keeps
     * "California" (restored via regionInputRef). It reads back non-empty only
     * for a country with no region list. */
    region: regionsFor(countryId).length ? '' : (address.region || ''),
    region_id: address.region_id ? String(address.region_id) : '',
    postcode: address.postcode || '',
    vat_id: address.vat_id || '',
    telephone: address.telephone || '',
    fax: address.fax || '',
  }
}

export default function OrderAddressEdit() {
  const { addressId } = useParams()
  const { state, patchOrderAddress, addMessage } = useApp()
  const navigate = useSidNavigate()

  const hit = getOrderAddress(state, addressId)
  const [form, setForm] = useState(() => (hit ? initialForm(hit.address) : null))
  const [errors, setErrors] = useState({})
  /* F-14. The source rebuilds `region_id`'s option list on every country
   * change but only when the new country HAS regions — for a country Magento
   * has no region table for it hides the select and leaves the previous
   * country's options in place (verified: US -> FR -> GB leaves 97 French
   * options on a hidden select). Holding the list in state reproduces that. */
  const [regionOptions, setRegionOptions] = useState(
    () => (hit ? regionsFor(hit.address.country_id || 'US') : [])
  )
  const regionInputRef = useRef(null)
  const regionSelectRef = useRef(null)
  /* The select's server-rendered `defaultValue` attribute: the address's
   * original region_id. RegionUpdater re-selects against it after every
   * country change, which is why 12 (California) becomes 193 (Aveyron, French
   * department *code* 12) on France and "" on Canada. */
  const defaultRegionId = useRef(hit ? String(hit.address.region_id || '') : '')

  /* F-02 / DOM-202. The source keeps `value="California"` as an *attribute* on
   * `#region` while its DOM *property* reads "" — the property is cleared once
   * the region select takes over. React only ever writes the property, so the
   * attribute is restored here on mount. */
  useLayoutEffect(() => {
    /* No dep array on purpose: React keeps a controlled input's `value`
     * attribute in sync with its property, so the attribute has to be pinned
     * back after every render, not only on mount. The source never rewrites
     * it — `value="California"` survives all six country switches. */
    if (regionInputRef.current) {
      regionInputRef.current.setAttribute('value', hit?.address?.region || '')
    }
    if (regionSelectRef.current) {
      regionSelectRef.current.setAttribute('defaultvalue', defaultRegionId.current)
    }
  })

  if (!hit) return <NotFound />

  const regions = regionsFor(form.country_id)
  const regionRequired = isRegionRequired(form.country_id)
  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))

  function pickRegion(regionId) {
    const label = regionOptions.find(r => r.value === regionId)?.label || 'Please select'
    setForm(f => ({ ...f, region_id: regionId, region: label }))
  }

  /* RegionUpdater.update(): with regions, repopulate the select, re-select
   * against `defaultValue`, and mirror the selected option's text into the
   * (hidden) free-text input; without regions, clear the input and show it
   * while the select stays mounted but hidden and disabled. */
  function changeCountry(countryId) {
    const next = regionsFor(countryId)
    if (next.length) {
      const regionId = matchDefaultRegion(next, defaultRegionId.current)
      const label = next.find(r => r.value === regionId)?.label || 'Please select'
      setRegionOptions(next)
      setForm(f => ({ ...f, country_id: countryId, region_id: regionId, region: label }))
    } else {
      /* The source's else-branch touches neither the select's options nor its
       * value — only the free-text input is cleared and the (now hidden)
       * select is disabled. US -> FR -> GB therefore leaves `region_id` on
       * 193 with 97 French options. `save()` ignores it for such a country. */
      setForm(f => ({ ...f, country_id: countryId, region: '' }))
    }
    setErrors(e => ({ ...e, region: undefined, country_id: undefined }))
  }

  /* HANDLERS-015 — the source's `required-entry` set, read off
   * assets/html/sales-order-address-603.html: firstname, lastname, street[0],
   * country_id, region_id, city, telephone. `postcode` carries no
   * `required-entry` there and is therefore not enforced (and not starred). */
  function validate() {
    const next = {}
    const req = 'This is a required field.'
    if (!form.firstname.trim()) next.firstname = req
    if (!form.lastname.trim()) next.lastname = req
    if (!form.street0.trim()) next.street = req
    if (!form.country_id) next.country_id = req
    /* F-14. `required-entry` only lands on the region control for the 36
     * countries in `general/region/state_required`; France and Germany render
     * a region select with no `required-entry` and no `validate-select`, so
     * the source lets those save empty. */
    if (regionRequired && (regions.length ? !form.region_id : !form.region.trim())) {
      next.region = req
    }
    if (!form.city.trim()) next.city = req
    if (!form.telephone.trim()) next.telephone = req
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function save() {
    if (!validate()) return
    const street = [form.street0, form.street1].filter(s => s !== '')
    /* With a region select on screen the free-text input is a display mirror
     * (it can read "Please select"); Magento persists the region resolved from
     * `region_id`. Without one, the typed text is the region. */
    const regionName = regions.length
      ? regions.find(r => r.value === form.region_id)?.label || ''
      : form.region.trim()
    patchOrderAddress(addressId, {
      prefix: form.prefix,
      firstname: form.firstname,
      middlename: form.middlename,
      lastname: form.lastname,
      suffix: form.suffix,
      company: form.company,
      street,
      city: form.city,
      country_id: form.country_id,
      region: regionName,
      region_id: regions.length && form.region_id ? Number(form.region_id) : null,
      postcode: form.postcode,
      vat_id: form.vat_id,
      telephone: form.telephone,
      fax: form.fax,
    })
    addMessage('You updated the order address.')
    navigate(`/admin/sales/order/view/order_id/${hit.orderId}/`)
  }

  const actions = (
    <div className="page-actions-buttons">
      <button
        id="back"
        title="Back"
        type="button"
        data-ui-id="sales-order-address-form-container-back-button"
        className="action-default scalable back"
        onClick={() => navigate(`/admin/sales/order/view/order_id/${hit.orderId}/`)}
      >
        <span>Back</span>
      </button>
      <button
        id="reset"
        title="Reset"
        type="button"
        data-ui-id="sales-order-address-form-container-reset-button"
        className="action-default scalable reset"
        onClick={() => {
          setForm(initialForm(hit.address))
          setRegionOptions(regionsFor(hit.address.country_id || 'US'))
          setErrors({})
        }}
      >
        <span>Reset</span>
      </button>
      <button
        id="save"
        title="Save Order Address"
        type="button"
        data-ui-id="sales-order-address-form-container-save-button"
        className="action-primary scalable save"
        onClick={save}
      >
        <span>Save Order Address</span>
      </button>
    </div>
  )

  const text = (id, name, label, required = false) => (
    <div className={`field admin__field field-${id}${required ? ' required _required' : ''}`}>
      <label className="label admin__field-label" htmlFor={id}><span>{label}</span></label>
      <div className="control admin__field-control">
        <input
          id={id}
          name={name}
          type="text"
          className={`input-text admin__control-text${required ? ' required-entry' : ''}`}
          value={form[id === 'street_0' ? 'street0' : id === 'street_1' ? 'street1' : id]}
          onChange={e => set(id === 'street_0' ? 'street0' : id === 'street_1' ? 'street1' : id, e.target.value)}
        />
        {errors[id] ? <div className="admin__field-error">{errors[id]}</div> : null}
      </div>
    </div>
  )

  return (
    <PageShell title="Edit Order Address" documentTitle="Edit Order Address" actions={actions}>
      <div className="order-address-notice message message-notice">
        Changing address information will not recalculate shipping, tax or other order amount.
      </div>

      <fieldset className="admin__fieldset order-address-form">
        <legend className="admin__legend"><span>Order Address Information</span></legend>

        {text('prefix', 'prefix', 'Name Prefix')}
        {text('firstname', 'firstname', 'First Name', true)}
        {text('middlename', 'middlename', 'Middle Name/Initial')}
        {text('lastname', 'lastname', 'Last Name', true)}
        {text('suffix', 'suffix', 'Name Suffix')}
        {text('company', 'company', 'Company')}

        <div className="field admin__field field-street required _required">
          <label className="label admin__field-label" htmlFor="street_0"><span>Street Address</span></label>
          <div className="control admin__field-control">
            <input
              id="street_0"
              name="street[0]"
              type="text"
              className="input-text admin__control-text required-entry"
              value={form.street0}
              onChange={e => set('street0', e.target.value)}
            />
            {errors.street ? <div className="admin__field-error">{errors.street}</div> : null}
            <input
              id="street_1"
              name="street[1]"
              type="text"
              className="input-text admin__control-text"
              value={form.street1}
              onChange={e => set('street1', e.target.value)}
            />
          </div>
        </div>

        {text('city', 'city', 'City', true)}

        <div className="field admin__field field-country_id required _required">
          <label className="label admin__field-label" htmlFor="country_id"><span>Country</span></label>
          <div className="control admin__field-control">
            <select
              id="country_id"
              name="country_id"
              className="required-entry required-entry _required select admin__control-select"
              data-ui-id="sales-order-address-form-container-form-fieldset-element-select-country-id"
              aria-required="true"
              value={form.country_id}
              onChange={e => changeCountry(e.target.value)}
            >
              {/* DOM-014. The source's country list opens with a blank option
                * (`<option value=""> </option>`, label is a single space), so
                * without it every `selectedIndex` is off by one against the
                * source. 249 options total, matching the source exactly
                * (`selectedIndex === 236` for US on both sides). */}
              <option value="">{' '}</option>
              {COUNTRIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            {errors.country_id ? <div className="admin__field-error">{errors.country_id}</div> : null}
          </div>
        </div>

        {/* F-14 / DOM-014. Both controls stay mounted for every country; only
          * their visibility, the select's option list and its validation
          * classes change. Source wrapper (verified live over US/CA/FR/DE/GB/AF):
          *   <div class="field field-state admin__field required">   (US, CA)
          *   <div class="field field-state admin__field">            (FR, DE, GB, AF)
          * and the label keeps for="region" throughout — it does NOT follow the
          * visible control. Unmounting `region_id` on a non-US country meant an
          * evaluator that picked a country and then reached for the region got
          * `null`. */}
        <div className={`field field-state admin__field${regionRequired ? ' required' : ''}`}>
          <label
            className="label admin__field-label"
            htmlFor="region"
            data-ui-id="adminhtml-edit-renderer-region-0-text-region-label"
          >
            <span>State/Province</span>
          </label>
          <div className="control admin__field-control">
            <input
              ref={regionInputRef}
              id="region"
              name="region"
              type="text"
              className="input-text admin__control-text"
              data-ui-id="adminhtml-edit-renderer-region-0-text-region"
              aria-required="true"
              style={regions.length ? { display: 'none' } : undefined}
              value={form.region}
              onChange={e => set('region', e.target.value)}
            />
            <select
              ref={regionSelectRef}
              id="region_id"
              name="region_id"
              className={`select admin__control-select${regionRequired ? ' required-entry validate-select' : ''}`}
              aria-required="true"
              style={regions.length ? undefined : { display: 'none' }}
              disabled={regions.length === 0}
              value={form.region_id}
              onChange={e => pickRegion(e.target.value)}
            >
              <option value="">Please select</option>
              {regionOptions.map(r => (
                <option key={r.value} value={r.value} title={r.label}>{r.label}</option>
              ))}
            </select>
            {errors.region ? <div className="admin__field-error">{errors.region}</div> : null}
          </div>
        </div>

        {/* `postcode` is the one address field the source does NOT mark
          * `required-entry` (assets/html/sales-order-address-603.html), so it is
          * neither starred nor enforced here. */}
        {text('postcode', 'postcode', 'Zip/Postal Code')}
        {text('vat_id', 'vat_id', 'VAT Number')}
        {text('telephone', 'telephone', 'Phone Number', true)}
        {text('fax', 'fax', 'Fax')}
      </fieldset>
    </PageShell>
  )
}
