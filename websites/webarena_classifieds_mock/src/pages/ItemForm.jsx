import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Breadcrumb from '../components/Breadcrumb.jsx'
import NotFound from './NotFound.jsx'
import { useApp } from '../context/AppContext.jsx'
import { getItem, loadDescription } from '../data/catalog.js'
import { indexUrl, itemUrl, homeUrl } from '../utils/urls.js'
import { categories, regions, regionOf, categoryName, thumbUrl, NO_PHOTO } from '../utils/format.js'

/**
 * ROUTES #26–29 — `page=item&action=item_add` / `item_edit&id=N`, and the
 * `item_add_post` / `item_edit_post` submissions.
 *
 * One template serves both, exactly as `item-post.php` / `item-edit.php` do:
 * the edit variant only swaps the hidden `action`, adds hidden `id`/`secret`,
 * pre-fills every control, lists the already-uploaded image, and labels the
 * submit button `Update` instead of `Publish`. The `<h1>` stays
 * `Publish a listing` on BOTH — that is the source's own markup
 * (assets/html/item-edit-84144.html); only `<title>` differs.
 *
 * Writes:
 *   add   -> state.newItems + state.nextItemId  (first id is 84155, the source's
 *            AUTO_INCREMENT), then redirect to `page=search&sCategory=<catId>`
 *            (see REDIRECT AFTER PUBLISH below)
 *   edit  -> state.itemOverrides[id], the fields that actually changed plus a
 *            fresh `modDate`, then redirect to the item page.
 * The 84,149-row catalogue is never copied into state.
 *
 * REDIRECT AFTER PUBLISH — `controller/item.php:181-209`.
 * `oc_t_preference.item_post_redirect` is `''` on this deployment (set explicitly
 * by the installer's basic_data.sql and re-asserted in queries.log), so
 * `osc_get_redirect_after_publish()` (hPreference.php:786) matches neither
 * `DASH-ITEM-CAT` nor `ITEM-CAT` and control falls through to the unconditional
 * tail `$this->redirectTo(osc_search_category_url()); exit;`. With
 * `rewriteEnabled = 0` that URL is literally
 * `index.php?page=search&sCategory=<catId>`. The agent is NOT teleported onto
 * the new item page — visualwebarena-684/685 say "…and navigate to it" precisely
 * because the category page has no `.price` element (cards use `.currency-value`).
 *
 * OWNERSHIP — `controller/item.php:217` / `:396`. Both `item_edit` and
 * `item_delete` scope by `i.pk_i_id = %d AND (i.s_secret = %s OR i.fk_i_user_id = %d)`.
 * A miss flashes and 302s; it never renders the form and never mutates.
 */
export default function ItemForm({ params = {}, mode = 'add' }) {
  const { state, setState, sid, user } = useApp()
  const navigate = useNavigate()
  const isEdit = mode === 'edit'
  const editId = isEdit ? Number(params.id) : null

  // undefined = still loading (edit only), null = no such listing
  const [item, setItem] = useState(isEdit ? undefined : null)
  const [baseDescription, setBaseDescription] = useState('')
  const [cities, setCities] = useState(null)
  const [errors, setErrors] = useState([])
  const [form, setForm] = useState(BLANK)

  // ---- ownership gate (item.php:217) --------------------------------------
  // The source's WHERE clause scopes item_edit to the logged-in user, so a
  // stranger's id never renders a pre-filled form — it flashes and 302s.
  const owned = !isEdit || ownsItem(state, editId)

  useEffect(() => {
    if (isEdit && !owned) {
      navigate(indexUrl({ page: 'user', action: 'items' }, sid), {
        replace: true,
        state: { flash: { type: 'error', msg: "Sorry, we don't have any listings with that ID" } }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, owned, editId])

  // ---- load the item being edited -----------------------------------------
  useEffect(() => {
    if (!isEdit || !owned) return
    let live = true
    setItem(undefined)
    getItem(editId, state).then(found => {
      if (!live) return
      setItem(found || null)
      if (!found) return
      const override = (state.itemOverrides || {})[editId] || (state.itemOverrides || {})[String(editId)]
      if (override && override.description !== undefined) {
        setBaseDescription(override.description)
        setForm(formFromItem(found, override.description))
      } else if (found.description !== undefined && found.description !== null) {
        setBaseDescription(found.description)
        setForm(formFromItem(found, found.description))
      } else {
        loadDescription(editId).then(d => {
          if (!live) return
          setBaseDescription(d || '')
          setForm(formFromItem(found, d || ''))
        })
      }
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, isEdit, owned])

  // ---- city list for the selected region ----------------------------------
  // 39,888 rows / 6.4 MB — pulled lazily so only the two form routes pay for it.
  useEffect(() => {
    let live = true
    import('../data/cities.json').then(mod => {
      if (live) setCities(mod.default || mod)
    })
    return () => { live = false }
  }, [])

  const cityOptions = useMemo(() => {
    if (!cities || !form.regionId) return []
    const rid = Number(form.regionId)
    return cities.filter(c => Number(c.regionId) === rid)
  }, [cities, form.regionId])

  const submitted = useRef(false)

  if (isEdit && !owned) return null            // the effect above is redirecting
  if (isEdit && item === undefined) return null
  if (isEdit && item === null) return <NotFound />

  function set(field, value) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  function onRegionChange(value) {
    setForm(prev => ({ ...prev, regionId: value, cityId: '' }))
  }

  function validate() {
    // The source runs jquery.validate with these rules; messages copied verbatim
    // from assets/html/item-post.html and rendered into <ul id="error_list">.
    const out = []
    if (!form.title.trim()) out.push('Title: this field is required')
    else if (form.title.trim().length < 5) out.push('Title: enter at least 5 characters')
    if (!form.description.trim()) out.push('Description: this field is required')
    else if (form.description.trim().length < 10) out.push('Description: enter at least 10 characters')
    if (!form.catId) out.push('Choose one category.')
    if (!form.regionId) out.push('Select a region.')
    if (!form.cityId) out.push('Select a city.')
    return out
  }

  function onSubmit(e) {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    if (errs.length) {
      window.scrollTo(0, 0)
      return
    }
    if (submitted.current) return
    submitted.current = true

    const cityRow = cityOptions.find(c => Number(c.id) === Number(form.cityId)) || null
    const regionRow = regions.find(r => Number(r.id) === Number(form.regionId)) || null
    const regionIdx = regionRow ? regions.indexOf(regionRow) : null

    if (isEdit) {
      const changes = {}
      if (form.title !== item.title) changes.title = form.title
      if (Number(form.catId) !== Number(item.cat)) changes.cat = Number(form.catId)
      const price = parsePrice(form.price)
      if (price !== Number(item.price)) changes.price = price
      if (form.description !== baseDescription) {
        changes.description = form.description
        changes.excerpt = excerptOf(form.description)
      }
      if (regionRow && Number(form.regionId) !== Number(currentRegionId(item))) {
        changes.regionId = Number(form.regionId)
        changes.regionIdx = regionIdx
      }
      if (cityRow && Number(form.cityId) !== Number(item.cityId)) {
        changes.cityId = Number(form.cityId)
        changes.city = cityRow.name
      }
      if (form.cityArea !== (item.cityArea || '')) changes.cityArea = form.cityArea
      if (form.address !== (item.address || '')) changes.address = form.address
      if (form.contactPhone !== (item.phone || '')) changes.phone = form.contactPhone
      if ((form.showPhone ? 1 : 0) !== Number(item.showPhone)) changes.showPhone = form.showPhone ? 1 : 0
      if (form.contactOther !== (item.contactOther || '')) changes.contactOther = form.contactOther
      if (form.currency !== (item.currency || 'USD')) changes.currency = form.currency

      // `ItemActions.php:784` stamps `'dt_mod_date' => date('Y-m-d H:i:s')` on
      // EVERY item_edit_post, even a no-op one, and sigma's item.php:61 renders
      // `<strong class="update">Modified date:</strong> …` whenever it is set.
      // So this is written unconditionally, and the override write is no longer
      // guarded on `changes` being non-empty.
      changes.modDate = nowStamp()

      setState(prev => {
        const prevOv = (prev.itemOverrides || {})[editId] || (prev.itemOverrides || {})[String(editId)] || {}
        return {
          ...prev,
          itemOverrides: { ...prev.itemOverrides, [editId]: { ...prevOv, ...changes } }
        }
      })
      navigate(itemUrl(editId, sid), {
        state: { flash: { type: 'ok', msg: "Great! We've just updated your listing" } }
      })
      return
    }

    const newId = Number(state.nextItemId)
    const description = form.description
    const created = {
      id: newId,
      cat: Number(form.catId),
      price: parsePrice(form.price),
      pub: nowStamp(),
      title: form.title,
      name: user.name,
      email: user.email,
      city: cityRow ? cityRow.name : '',
      regionIdx,
      regionId: regionRow ? Number(regionRow.id) : null,
      cityId: Number(form.cityId) || 0,
      cityArea: form.cityArea,
      address: form.address,
      phone: form.contactPhone,
      showEmail: 1,
      showPhone: form.showPhone ? 1 : 0,
      imgExt: 1,
      excerpt: excerptOf(description),
      description,
      contactOther: form.contactOther,
      currency: form.currency,
      userId: user.id
    }

    setState(prev => ({
      ...prev,
      newItems: [...(prev.newItems || []), created],
      nextItemId: Number(prev.nextItemId) + 1
    }))
    // item.php:208 — `$this->redirectTo(osc_search_category_url()); exit;`
    navigate(indexUrl({ page: 'search', sCategory: Number(form.catId) }, sid), {
      state: { flash: { type: 'ok', msg: 'Your listing has been published' } }
    })
  }

  const crumbs = isEdit
    ? [
        { label: categoryName(item.cat), to: indexUrl({ page: 'search', sCategory: item.cat }, sid) },
        { label: item.title, to: itemUrl(item.id, sid) },
        { label: 'Edit your listing' }
      ]
    : [{ label: 'Publish a listing' }]

  return (
    <Layout
      bodyClass="item item-post"
      title={isEdit ? 'Edit your listing - Classifieds' : 'Publish a listing - Classifieds'}
      breadcrumb={<Breadcrumb crumbs={crumbs} />}
    >
      <div id="main">
        <div className="form-container form-horizontal">
          <div className="resp-wrapper">
            <div className="header">
              <h1>Publish a listing</h1>
            </div>
            <ul id="error_list">
              {errors.map((msg, i) => <li key={i}><label className="error">{msg}</label></li>)}
            </ul>
            <form name="item" action="/index.php" method="post" encType="multipart/form-data" id="item-post" onSubmit={onSubmit}>
              <fieldset>
                <input type="hidden" name="action" value={isEdit ? 'item_edit_post' : 'item_add_post'} />
                <input type="hidden" name="page" value="item" />
                {isEdit ? <input type="hidden" name="id" value={item.id} /> : null}

                <h2 className="gen">General Information</h2>

                <div className="control-group categ">
                  <label className="control-label" htmlFor="select_1">Category</label>
                  <div className="controls">
                    <select name="catId" id="catId" value={form.catId} onChange={e => set('catId', e.target.value)}>
                      <option value="">Select a category</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div className="control-group title">
                  <label className="control-label" htmlFor="title[en_US]">Title</label>
                  <div className="controls">
                    <input id="titleen_US" type="text" name="title[en_US]" value={form.title}
                      onChange={e => set('title', e.target.value)} />
                  </div>
                </div>

                <div className="control-group descr">
                  <label className="control-label" htmlFor="description[en_US]">Description</label>
                  <div className="controls">
                    <textarea id="descriptionen_US" name="description[en_US]" rows="10" value={form.description}
                      onChange={e => set('description', e.target.value)} />
                  </div>
                </div>

                <div className="control-group control-group-price">
                  <label className="control-label" htmlFor="price">Price</label>
                  <div className="controls">
                    <input id="price" type="text" name="price" value={form.price}
                      onChange={e => set('price', e.target.value)} />
                    <select name="currency" id="currency" value={form.currency} onChange={e => set('currency', e.target.value)}>
                      <option value="EUR">&#8364;</option>
                      <option value="GBP">&#163;</option>
                      <option value="USD">$</option>
                    </select>
                  </div>
                </div>

                <div className="control-group img">
                  <ImageUploader />
                  <div style={{ clear: 'both' }}></div>
                  {isEdit ? <UploadedImage itemId={item.id} /> : null}
                  <div style={{ clear: 'both' }}></div>
                </div>

                <div className="box location">
                  <h2>Listing Location</h2>
                  <input type="hidden" id="countryId" name="countryId" value="US" />

                  <div className="control-group">
                    <label className="control-label" htmlFor="region">Region</label>
                    <div className="controls">
                      <select name="regionId" id="regionId" value={form.regionId} onChange={e => onRegionChange(e.target.value)}>
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
                        {/* With no region chosen, osclass's city query yields one
                            empty row and `osc_list_cities()` renders it as
                            `No value`. Verified live: `item_add` emits
                            `<option value="">Select a city...</option><option value="">No value</option>`,
                            while `item_edit&id=84144` (region = Pennsylvania)
                            emits the real city list with no `No value`
                            (TEST DIFF-004). */}
                        {!form.regionId ? <option value="">No value</option> : null}
                        {cityOptions.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="control-group">
                    <label className="control-label" htmlFor="cityArea">City Area</label>
                    <div className="controls">
                      <input id="cityArea" type="text" name="cityArea" value={form.cityArea}
                        onChange={e => set('cityArea', e.target.value)} />
                      <input id="cityAreaId" type="hidden" name="cityAreaId" value="" />
                    </div>
                  </div>

                  <div className="control-group">
                    <label className="control-label" htmlFor="address">Address</label>
                    <div className="controls">
                      <input id="address" type="text" name="address" value={form.address}
                        onChange={e => set('address', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="box seller_info">
                  <h2>Seller's information</h2>

                  <div className="control-group">
                    <label className="control-label" htmlFor="contactPhone">Phone</label>
                    <div className="controls">
                      <input id="contactPhone" type="text" name="contactPhone" value={form.contactPhone}
                        onChange={e => set('contactPhone', e.target.value)} />
                    </div>
                  </div>

                  <div className="control-group">
                    <div className="controls checkbox">
                      <input id="showPhone" type="checkbox" name="showPhone" value="1" checked={form.showPhone}
                        onChange={e => set('showPhone', e.target.checked)} />
                      {' '}
                      <label htmlFor="showPhone">Show phone on the listing page</label>
                    </div>
                  </div>

                  <div className="control-group">
                    <label className="control-label" htmlFor="contactOther">Other contact</label>
                    <div className="controls">
                      <input id="contactOther" type="text" name="contactOther" value={form.contactOther}
                        onChange={e => set('contactOther', e.target.value)} />
                    </div>
                  </div>
                </div>

                <div className="hooks"><div id="plugin-hook"></div></div>

                <div className="control-group">
                  <div className="controls pblbt">
                    <button type="submit" className="btn btn-primary pbl">{isEdit ? 'Update' : 'Publish'}</button>
                  </div>
                </div>
              </fieldset>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  )
}

/**
 * `#restricted-fine-uploader`. On the source this div is filled in by
 * fineUploader, whose stylesheet (`css/ajax-uploader.css`) is not part of the
 * two theme sheets the mock copies — so the button's look is inlined here
 * rather than added to a stylesheet this shard does not own. Copy is
 * fineUploader's configured `text.uploadButton`, verbatim.
 *
 * The picker is real (it lists what you selected and lets you remove it), but
 * nothing is written to session state: the mock serves listing photos from
 * `/img/t/<id//1000>/<id>.webp` on disk, so an uploaded blob has nowhere to
 * live and would blow the ~1 MB state budget /go diffs on every call. Both
 * publish tasks (visualwebarena-684/685) say "You do not need to attach the
 * image in the post."
 */
function ImageUploader() {
  const inputRef = React.useRef(null)
  const [picked, setPicked] = useState([])

  function onPick(e) {
    const files = Array.from(e.target.files || []).slice(0, 4 - picked.length)
    setPicked(prev => [...prev, ...files.map(f => ({ name: f.name, url: URL.createObjectURL(f) }))])
    e.target.value = ''
  }

  function remove(i) {
    setPicked(prev => {
      const next = prev.slice()
      const [gone] = next.splice(i, 1)
      if (gone) URL.revokeObjectURL(gone.url)
      return next
    })
  }

  return (
    <div id="restricted-fine-uploader">
      <div className="qq-uploader">
        <div
          className="btn btn-primary qq-upload-button"
          style={{ cursor: 'pointer' }}
          onClick={() => inputRef.current && inputRef.current.click()}
        >Click or Drop for upload images</div>
        <input
          ref={inputRef}
          type="file"
          name="photos[]"
          accept=".png,.gif,.jpg,.jpeg"
          multiple
          style={{ display: 'none' }}
          onChange={onPick}
        />
        {picked.length ? (
          <ul className="qq-upload-list">
            {picked.map((f, i) => (
              <li key={i} className=" qq-upload-success">
                <span className="qq-upload-file">{f.name}</span>
                <a className="qq-upload-delete" href="#" style={{ display: 'inline', cursor: 'pointer' }}
                  onClick={e => { e.preventDefault(); remove(i) }}>Delete</a>
                <div className="ajax_preview_img">
                  <img src={f.url} alt={f.name} />
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}

/**
 * TEST DIFF-005 — `Images already uploaded`.
 *
 * The source's `item-edit.php` renders, verbatim (assets/html/item-edit-84144.html):
 *
 *   <h3>Images already uploaded</h3>
 *   <ul class="qq-upload-list">
 *     <li class=" qq-upload-success">
 *       <span class="qq-upload-file">84144.jpg</span>
 *       <a class="qq-upload-delete" href="#" photoid="84144" itemid="84144"
 *          photoname="…" photosecret="" style="display: inline; cursor:pointer;">Delete</a>
 *       <div class="ajax_preview_img"><img src="…_thumbnail.jpg" alt="84144.jpg"></div>
 *     </li>
 *   </ul>
 *
 * The mock was missing the `Delete` anchor entirely — a visible affordance on
 * the source with nothing at all in its place, and 63 px of the page-height
 * delta the diff shard measured.
 *
 * Behaviour is the source's inline handler, also quoted in that capture:
 * `confirm("This action can't be undone. Are you sure you want to continue?")`,
 * and on OK the tile is removed from the DOM (`parent.remove()`), the POST to
 * `page=ajax&action=delete_image` being the part TODO.md puts out of scope
 * (there is no image state to mutate — listing photos are static files under
 * `/img/{t,m}/<id//1000>/<id>.webp`). Cancelling leaves the tile in place.
 *
 * `photoname` / `photosecret` carry per-resource values out of
 * `oc_t_item_resource` that nothing in the mock consumes; they are omitted
 * rather than fabricated. `photoid` / `itemid` are the item's real id, as on
 * the source for a single-photo listing.
 */
function UploadedImage({ itemId }) {
  const [removed, setRemoved] = useState(false)

  function onDelete(e) {
    e.preventDefault()
    if (window.confirm("This action can't be undone. Are you sure you want to continue?")) {
      setRemoved(true)
    }
  }

  return (
    <>
      <h3>Images already uploaded</h3>
      <ul className="qq-upload-list">
        {removed ? null : (
          <li className=" qq-upload-success">
            <span className="qq-upload-file">{itemId}.jpg</span>
            {/* `itemID` is React's spelling of the microdata `itemid` attribute
                and renders as lowercase `itemid`, matching the source; writing
                `itemid=` directly trips an "Invalid DOM property" console error.
                The inline `display: inline` is the source's own — fineuploader.css
                ships `.qq-upload-delete { display: none }` and the markup
                overrides it per-element. */}
            <a className="qq-upload-delete" href="#" photoid={String(itemId)} itemID={String(itemId)}
              style={{ display: 'inline', cursor: 'pointer' }} onClick={onDelete}>Delete</a>
            <div className="ajax_preview_img">
              <img src={thumbUrl(itemId)} alt={`${itemId}.jpg`}
                onError={e => { if (e.currentTarget.src.indexOf(NO_PHOTO) === -1) e.currentTarget.src = NO_PHOTO }} />
            </div>
          </li>
        )}
      </ul>
    </>
  )
}

// UPLOAD_LIST / UPLOAD_ITEM / PREVIEW_IMG used to live here as hand-guessed
// inline styles, because the two uploader stylesheets the source loads on this
// route were never copied. They now are — verbatim, in `public/css/mock.css`
// under "TEST DIFF-005" — so the guesses are gone and the tile matches the
// source's fixed 200 px height.

const BLANK = {
  catId: '', title: '', description: '', price: '', currency: 'USD',
  regionId: '', cityId: '', cityArea: '', address: '',
  contactPhone: '', showPhone: true, contactOther: ''
}

function currentRegionId(item) {
  const r = regionOf(item)
  return r ? r.id : ''
}

function formFromItem(item, description) {
  return {
    catId: String(item.cat || ''),
    title: item.title || '',
    description: description || '',
    // The source pre-fills `value="30000.00"` — the raw i_price divided by 1e6.
    price: item.price === null || item.price === undefined || item.price === '' ? '' : (Number(item.price) / 1e6).toFixed(2),
    currency: item.currency || 'USD',
    regionId: String(currentRegionId(item) || ''),
    cityId: String(item.cityId || ''),
    cityArea: item.cityArea || '',
    address: item.address || '',
    contactPhone: item.phone || '',
    showPhone: Number(item.showPhone) === 1,
    contactOther: item.contactOther || ''
  }
}

/**
 * `i_price` is dollars x 1,000,000. Accept what a human types — `25000`,
 * `25000.00`, `25,000`, `$25000` — and never let NaN reach the state.
 */
export function parsePrice(input) {
  if (input === null || input === undefined) return 0
  const cleaned = String(input).replace(/[^0-9.]/g, '')
  if (cleaned === '') return 0
  const n = Number.parseFloat(cleaned)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 1e6)
}

/**
 * `osc_highlight($description, 250)` — strip tags, turn \n\r\t into spaces,
 * trim, collapse whitespace runs, cut at 250 chars, append "..." if it was
 * longer. Mirrors assets/build-seed.py:excerpt(), so an edited listing's card
 * blurb matches how the seed was built.
 */
export function excerptOf(description) {
  const stripped = String(description || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[\n\r\t]/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
  return stripped.length > 250 ? stripped.slice(0, 250) + '...' : stripped
}

/** `dt_pub_date` format: "2023-11-15 09:12:04". */
function nowStamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/**
 * Does the logged-in user (Blake, `oc_t_user.pk_i_id = 1`) own this listing?
 *
 * The source expresses this as
 *   `i.pk_i_id = %d AND (i.s_secret = %s OR i.fk_i_user_id = %d)`
 * — the mock has no secrets, so ownership is the seeded `state.myItems`
 * (84143…84154) plus anything published in-session (`state.newItems`), minus
 * anything already deleted (the row would be gone, so the source's count is 0).
 */
export function ownsItem(state, id) {
  const n = Number(id)
  if (!Number.isFinite(n)) return false
  if ((state.deletedItemIds || []).map(Number).includes(n)) return false
  return (state.myItems || []).map(Number).includes(n) ||
    (state.newItems || []).some(it => Number(it.id) === n)
}

/**
 * ROUTES #30 — `page=item&action=item_delete&id=N`.
 * A plain GET link on the source: it deletes, flashes
 * `Your listing has been deleted` and 302s to `page=user&action=items`.
 * Afterwards `page=item&id=N` renders the 404 body (task visualwebarena-681).
 *
 * A listing the user does not own is NOT deleted: `item.php:396-410` falls into
 * the `else` arm, flashes
 * `The listing you are trying to delete couldn't be deleted` and 302s to
 * `osc_base_url()` — the site root, not the listings page.
 */
export function ItemDelete({ params = {} }) {
  const { state, setState, sid } = useApp()
  const navigate = useNavigate()
  const done = useRef(false)
  const id = Number(params.id)
  const owned = ownsItem(state, id)

  useEffect(() => {
    if (done.current) return
    done.current = true

    if (!owned) {
      navigate(homeUrl(sid), {
        replace: true,
        state: { flash: { type: 'error', msg: "The listing you are trying to delete couldn't be deleted" } }
      })
      return
    }

    setState(prev => (
      (prev.deletedItemIds || []).map(Number).includes(id)
        ? prev
        : { ...prev, deletedItemIds: [...(prev.deletedItemIds || []), id] }
    ))
    navigate(indexUrl({ page: 'user', action: 'items' }, sid), {
      replace: true,
      state: { flash: 'Your listing has been deleted' }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  return null
}
