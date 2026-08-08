import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Layout from '../../components/Layout.jsx'
import Breadcrumb from '../../components/Breadcrumb.jsx'
import ListingCardList from '../../components/ListingCardList.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { getItem } from '../../data/catalog.js'
import { indexUrl } from '../../utils/urls.js'
import { DELETE_CONFIRM } from './MyListings.jsx'

/**
 * `index.php?page=user&action=pub_profile&id=1` — Blake's public profile.
 *
 * ROUTES.md does not carry a row for this one, but the user sidebar's first
 * entry (`Public Profile`, `li.opt_publicprofile`) points at it on the source,
 * so it is built rather than left as a dead link. Verified against the live
 * page: `body.user-public-profile`, `<title>Public profile - Blake Sullivan -
 * Classifieds</title>`, `.user-card` + `<h2>Latest listings</h2>`, **10 per
 * page** (unlike the 20 on `action=items`).
 *
 * `#sidebar` is EMPTY on your own profile. `user-public-sidebar.php:20` wraps the
 * whole `#contact` block in `if(osc_logged_user_id() != osc_user_id())`, and this
 * deployment has exactly one registered user (Blake, id 1) — so
 * `pub_profile&id=1` is always the own-profile case and the source renders
 * `<div id="sidebar"></div>` with no contact form at all.
 */
const PER_PAGE = 10

export default function PublicProfile({ params = {} }) {
  const { state, setState, sid, user } = useApp()
  const [items, setItems] = useState(null)
  const [form, setForm] = useState({ yourName: '', yourEmail: '', phoneNumber: '', message: '' })
  const [errors, setErrors] = useState([])
  const [sent, setSent] = useState(false)

  // `user-public-sidebar.php:20` — the contact block only exists when you are
  // looking at someone else's profile.
  const isSelf = Number(params.id || 1) === Number(user.id)

  const key = JSON.stringify([state.myItems, state.newItems.map(i => i.id), state.deletedItemIds])

  useEffect(() => {
    let live = true
    const deleted = new Set((state.deletedItemIds || []).map(Number))
    const ids = [
      ...(state.myItems || []).map(Number),
      ...(state.newItems || []).map(i => Number(i.id))
    ].filter(id => !deleted.has(id))
    Promise.all(ids.map(id => getItem(id, state))).then(found => {
      if (!live) return
      const rows = found.filter(Boolean)
      rows.sort((a, b) => (a.pub < b.pub ? 1 : a.pub > b.pub ? -1 : b.id - a.id))
      setItems(rows)
    })
    return () => { live = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, state.itemOverrides])

  const rawPage = Number(params.iPage)
  const page = Number.isFinite(rawPage) && rawPage > 1 ? Math.floor(rawPage) : 1
  const total = items ? items.length : 0
  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE))
  const visible = items ? items.slice((page - 1) * PER_PAGE, page * PER_PAGE) : []

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  /** The source's inline `onclick="javascript:return confirm('…')"` on `.delete`. */
  function onDelete(e) {
    if (!window.confirm(DELETE_CONFIRM)) e.preventDefault()
    // The item_delete route owns the mutation, so the link and a hand-typed URL
    // behave identically.
  }

  function onSubmit(e) {
    e.preventDefault()
    // `ContactForm::js_validation()` (Contact.form.class.php:119-155) — same
    // rules and same copy as `page=contact`.
    const errs = []
    if (!form.yourEmail.trim()) errs.push('Email: this field is required.')
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.yourEmail.trim())) errs.push('Invalid email address.')
    if (!form.message.trim()) errs.push('Message: this field is required.')
    setErrors(errs)
    if (errs.length) { setSent(false); return }

    setState(prev => ({
      ...prev,
      contactMessages: [...(prev.contactMessages || []), {
        toUserId: Number(params.id) || 1,
        name: form.yourName,
        email: form.yourEmail,
        phone: form.phoneNumber,
        message: form.message,
        date: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }]
    }))
    setForm({ yourName: '', yourEmail: '', phoneNumber: '', message: '' })
    setSent(true)
  }

  // `Breadcrumb.php:350-351` + `:491` — the pub_profile crumb is
  // `sprintf(__("%s's profile"), osc_user_name())`, not the bare name.
  // TEST DIFF-002.
  const profileCrumb = `${user.name}'s profile`

  const pageUrl = p => indexUrl(
    { page: 'user', action: 'pub_profile', id: params.id || 1, iPage: p > 1 ? p : undefined }, sid
  )

  return (
    <Layout
      bodyClass="user-public-profile"
      title={`Public profile - ${user.name} - Classifieds`}
      breadcrumb={<Breadcrumb crumbs={[{ label: profileCrumb }]} />}
    >
      <div id="main">
        <div id="item-content">
          <div className="user-card">
            <p className="user-img">
              <img src="/img/default-user-image.png" alt={user.name} />
            </p>
            <ul id="user_data">
              <li className="name">{user.name}</li>
            </ul>
          </div>

          <div className="similar_ads">
            <h2>Latest listings</h2>
            {items ? (
              <ListingCardList
                items={visible}
                showAs="list"
                extraClass="items"
                /* `loop-single.php:54` renders `.admin-options` on EVERY card whose
                   `osc_item_user_id() == osc_logged_user_id()`, so your own public
                   profile shows Edit item / Delete on all 10 rows exactly as
                   `action=items` does. `Renew` / `Activate` / `Deactivate` are the
                   other three branches and none of them fire on this deployment
                   (every listing is active and non-renewable). TEST DIFF-001. */
                adminOptionsFor={isSelf ? (item => (
                  <span className="admin-options">
                    <Link to={indexUrl({ page: 'item', action: 'item_edit', id: item.id }, sid)} rel="nofollow">Edit item</Link>
                    <Link
                      className="delete"
                      to={indexUrl({ page: 'item', action: 'item_delete', id: item.id }, sid)}
                      onClick={onDelete}
                    >Delete</Link>
                  </span>
                )) : null}
              />
            ) : null}
            {lastPage > 1 ? (
              <div className="paginate">
                <ul>
                  {Array.from({ length: lastPage }, (_, i) => i + 1).map(p => (
                    <li key={p}>
                      {p === page
                        ? <span className={`searchPaginationSelected${p === 1 ? ' list-first' : ''}`}>{p}</span>
                        : <Link className="searchPaginationNonSelected" to={pageUrl(p)}>{p}</Link>}
                    </li>
                  ))}
                  {page < lastPage ? (
                    <li><Link className="searchPaginationNext list-last" to={pageUrl(page + 1)}>&gt;</Link></li>
                  ) : null}
                </ul>
              </div>
            ) : null}
            <div className="clear"></div>
          </div>
        </div>
      </div>

      <div id="sidebar">
        {isSelf ? null : (
        <div id="contact" className="widget-box form-container form-vertical">
          <h2>Contact</h2>
          <ul id="error_list">
            {errors.map((m, i) => <li key={i}><label className="error">{m}</label></li>)}
          </ul>
          {sent ? <p className="ok">Your email has been sent properly. Thank you for contacting us!</p> : null}
          <form action="/index.php" method="post" name="contact_form" id="contact_form" onSubmit={onSubmit}>
            <input type="hidden" name="action" value="contact_post" />
            <input type="hidden" name="page" value="user" />
            <input type="hidden" name="id" value={params.id || 1} />
            <div className="control-group">
              <label className="control-label" htmlFor="yourName">Your name:</label>
              <div className="controls">
                <input id="yourName" type="text" name="yourName" value={form.yourName}
                  onChange={e => set('yourName', e.target.value)} />
              </div>
            </div>
            <div className="control-group">
              <label className="control-label" htmlFor="yourEmail">Your email address:</label>
              <div className="controls">
                <input id="yourEmail" type="text" name="yourEmail" value={form.yourEmail}
                  onChange={e => set('yourEmail', e.target.value)} />
              </div>
            </div>
            <div className="control-group">
              <label className="control-label" htmlFor="phoneNumber">Phone number (optional):</label>
              <div className="controls">
                <input id="phoneNumber" type="text" name="phoneNumber" value={form.phoneNumber}
                  onChange={e => set('phoneNumber', e.target.value)} />
              </div>
            </div>
            <div className="control-group">
              <label className="control-label" htmlFor="message">Message:</label>
              <div className="controls textarea">
                <textarea id="message" name="message" rows="10" value={form.message}
                  onChange={e => set('message', e.target.value)} />
              </div>
            </div>
            <div className="control-group">
              <div className="controls">
                <button type="submit" className="btn btn-primary">Send</button>
              </div>
            </div>
          </form>
        </div>
        )}
      </div>
    </Layout>
  )
}
