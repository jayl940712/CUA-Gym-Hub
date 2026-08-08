import React, { useEffect, useMemo, useRef, useState } from 'react'
import UserPage from '../../components/user/UserPage.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { regions } from '../../utils/format.js'

/**
 * ROUTES #20–21 — `index.php?page=user&action=profile` and `profile_post`.
 *
 * `<h1>Update account</h1>`, `<title>Update account</title>`. The source's
 * `profile_post` writes the user row and flashes
 * `Your profile has been updated successfully`, then re-renders this page —
 * so the mock stays put and shows the same flash.
 *
 * All fields map onto `state.user` (see assets/data_model.md §8); every one of
 * them is genuinely empty on the source except the name.
 */
export default function Profile() {
  const { state, setState } = useApp()
  const user = state.user
  const [cities, setCities] = useState(null)
  const [flash, setFlash] = useState(null)
  // Profile picture: previewed locally only. `state.user.profileImg` is null on
  // the source and a data URL would blow the ~1 MB budget /go diffs every call.
  const [picture, setPicture] = useState(null)
  const pictureRef = useRef(null)
  const [form, setForm] = useState(() => formFromUser(user))

  useEffect(() => {
    let live = true
    import('../../data/cities.json').then(mod => { if (live) setCities(mod.default || mod) })
    return () => { live = false }
  }, [])

  const cityOptions = useMemo(() => {
    if (!cities || !form.regionId) return []
    const rid = Number(form.regionId)
    return cities.filter(c => Number(c.regionId) === rid)
  }, [cities, form.regionId])

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  function onSubmit(e) {
    e.preventDefault()
    const regionRow = regions.find(r => Number(r.id) === Number(form.regionId)) || null
    const cityRow = cityOptions.find(c => Number(c.id) === Number(form.cityId)) || null
    setState(prev => ({
      ...prev,
      user: {
        ...prev.user,
        name: form.s_name,
        isCompany: Number(form.b_company),
        phoneMobile: form.s_phone_mobile,
        phoneLand: form.s_phone_land,
        country: form.country,
        region: regionRow ? regionRow.name : '',
        regionId: regionRow ? Number(regionRow.id) : '',
        city: cityRow ? cityRow.name : '',
        cityId: cityRow ? Number(cityRow.id) : '',
        cityArea: form.cityArea,
        zip: form.zip,
        address: form.address,
        website: form.s_website,
        info: form.s_info
      }
    }))
    setFlash('Your profile has been updated successfully')
  }

  return (
    <UserPage title="Update account" crumb="Update account" flash={flash}>
      <h1>Update account</h1>
      <div className="form-container form-horizontal">
        <div className="resp-wrapper">
          <ul id="error_list"></ul>
          <form action="/index.php" method="post" onSubmit={onSubmit}>
            <input type="hidden" name="page" value="user" />
            <input type="hidden" name="action" value="profile_post" />

            <div className="control-group">
              <label className="control-label" htmlFor="name">Picture</label>
              <div className="controls">
                {/* The source ships these rules in an inline <style> inside the
                    picture widget, not in style.css — reproduced as inline
                    styles because this shard does not own the stylesheets. */}
                <div className="user-img" style={{ margin: '0 0 10px 0' }}>
                  <div className="img-preview" style={{ overflow: 'hidden', width: '180px', height: '180px', background: '#ddd' }}>
                    <img src={picture || '/img/default-user-image.png'} alt={user.name}
                      style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }} />
                  </div>
                </div>
                <div className="user-img-button">
                  <a href="#" className="btn btn-primary start-image-upload"
                    onClick={e => { e.preventDefault(); pictureRef.current && pictureRef.current.click() }}>Upload new picture</a>
                  <a href="#" className="btn btn-secondary btn-next remove-profile-picture"
                    onClick={e => { e.preventDefault(); setPicture(null) }}>Remove</a>
                  <input ref={pictureRef} type="file" name="image" className="upload-image"
                    style={{ display: 'none' }} accept=".jpg,.jpeg,.png,.gif"
                    onChange={e => {
                      const f = e.target.files && e.target.files[0]
                      if (f) setPicture(URL.createObjectURL(f))
                      e.target.value = ''
                    }} />
                  <input type="hidden" name="pp_blob" />
                </div>
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="name">Name</label>
              <div className="controls">
                <input id="s_name" type="text" name="s_name" value={form.s_name}
                  onChange={e => set('s_name', e.target.value)} />
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="user_type">User type</label>
              <div className="controls">
                <select name="b_company" id="b_company" value={form.b_company}
                  onChange={e => set('b_company', e.target.value)}>
                  <option value="0">User</option>
                  <option value="1">Company</option>
                </select>
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="phoneMobile">Mobile phone</label>
              <div className="controls">
                <input id="s_phone_mobile" type="text" name="s_phone_mobile" value={form.s_phone_mobile}
                  onChange={e => set('s_phone_mobile', e.target.value)} />
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="phoneLand">Land phone</label>
              <div className="controls">
                <input id="s_phone_land" type="text" name="s_phone_land" value={form.s_phone_land}
                  onChange={e => set('s_phone_land', e.target.value)} />
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="country">Country</label>
              <div className="controls">
                <input id="country" type="text" name="country" value={form.country}
                  onChange={e => set('country', e.target.value)} />
                <input id="countryId" type="hidden" name="countryId" value="" />
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="region">Region</label>
              <div className="controls">
                <select name="regionId" id="regionId" value={form.regionId}
                  onChange={e => setForm(prev => ({ ...prev, regionId: e.target.value, cityId: '' }))}>
                  <option value="">Select a region...</option>
                  {regions.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="city">City</label>
              <div className="controls">
                <select name="cityId" id="cityId" value={form.cityId} disabled={!form.regionId}
                  onChange={e => set('cityId', e.target.value)}>
                  <option value="">Select a city...</option>
                  {cityOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="city_area">City area</label>
              <div className="controls">
                <input id="cityArea" type="text" name="cityArea" value={form.cityArea}
                  onChange={e => set('cityArea', e.target.value)} />
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="city_area">ZIP</label>
              <div className="controls">
                <input id="zip" type="text" name="zip" value={form.zip}
                  onChange={e => set('zip', e.target.value)} />
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="address">Address</label>
              <div className="controls">
                <input id="address" type="text" name="address" value={form.address}
                  onChange={e => set('address', e.target.value)} />
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="webSite">Website</label>
              <div className="controls">
                <input id="s_website" type="text" name="s_website" value={form.s_website}
                  onChange={e => set('s_website', e.target.value)} />
              </div>
            </div>

            <div className="control-group">
              <label className="control-label" htmlFor="s_info">Description</label>
              <div className="controls">
                <textarea id="s_infoen_US" name="s_info[en_US]" rows="10" value={form.s_info}
                  onChange={e => set('s_info', e.target.value)} />
              </div>
            </div>

            <div className="control-group bts">
              <div className="controls">
                <button type="submit" className="btn btn-primary">Update</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </UserPage>
  )
}

function formFromUser(user) {
  return {
    s_name: user.name || '',
    b_company: String(user.isCompany || 0),
    s_phone_mobile: user.phoneMobile || '',
    s_phone_land: user.phoneLand || '',
    // The source pre-fills the country text input with "United States".
    country: user.country || 'United States',
    regionId: user.regionId ? String(user.regionId) : '',
    cityId: user.cityId ? String(user.cityId) : '',
    cityArea: user.cityArea || '',
    zip: user.zip || '',
    address: user.address || '',
    s_website: user.website || '',
    s_info: user.info || ''
  }
}
