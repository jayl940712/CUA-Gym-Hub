import React, { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Breadcrumb from '../components/Breadcrumb.jsx'
import ListingCardList from '../components/ListingCardList.jsx'
import Comments from '../components/item/Comments.jsx'
import Flash from '../components/item/Flash.jsx'
import { MARK_VALUES } from '../components/item/MarkItem.jsx'
import NotFound from './NotFound.jsx'
import { useApp } from '../context/AppContext.jsx'
import { getItem, loadDescription, loadCategory, getItemFrom } from '../data/catalog.js'
import { indexUrl } from '../utils/urls.js'
import {
  formatPrice, formatDate, formatItemLocation, categoryName, thumbUrl, photoUrl, NO_PHOTO
} from '../utils/format.js'

/**
 * ROUTES #14 / #15. Item detail — where 180 of the 227 anchor URLs land.
 *
 * `.desc` and `.price` are anchor LOCATORS and must carry the real text.
 * `#comments` is delegated to components/item/Comments.jsx (31 `program_html`
 * evaluators query `.comments_list` / `.comments_list h3`).
 *
 * Only two items in `oc_t_item` carry a `dt_mod_date`, and on both it equals
 * `dt_pub_date`:
 *     mysql> select pk_i_id, dt_pub_date, dt_mod_date from oc_t_item
 *            where dt_mod_date is not null;
 *     84143  2023-10-13 05:41:57  2023-10-13 05:41:57
 *     84144  2023-11-14 17:18:36  2023-11-14 17:18:36
 * The catalogue tuple has no mod-date column, so those two ids are named here
 * rather than fabricated into the seed. An item edited in-session picks its
 * modified date up from `state.itemOverrides[id].modDate` instead.
 */
const SEEDED_MOD_DATE_IDS = [84143, 84144]

export default function Item({ params }) {
  const { state, sid } = useApp()
  const location = useLocation()
  const id = Number(params.id)
  const [item, setItem] = useState(undefined)     // undefined = loading, null = 404
  const [description, setDescription] = useState('')
  const [related, setRelated] = useState([])

  // The `.main-photo` anchor's href is applied imperatively — see the comment at
  // the render site. Runs on every render because `item` gates that subtree.
  const mainPhotoRef = useRef(null)
  useEffect(() => {
    if (mainPhotoRef.current) mainPhotoRef.current.setAttribute('href', 'javascript:;')
  })

  // Only a change of `id` blanks the page. `state` is also a dependency of the
  // load below (deletions / overrides / new items feed getItem), but posting a
  // comment must not flash the whole item back to the loading state.
  useEffect(() => { setItem(undefined) }, [id])

  useEffect(() => {
    let live = true
    getItem(id, state).then(found => {
      if (!live) return
      setItem(found)
      if (!found) return
      if (found.description !== undefined && found.description !== null) {
        setDescription(found.description)
      } else {
        loadDescription(id).then(d => { if (live) setDescription(d || '') })
      }
      loadCategory(found.cat).then(shard => {
        if (!live) return
        setRelated(pickRelated(shard, id, state))
      })
    })
    return () => { live = false }
  }, [id, state])

  if (item === undefined) return null
  if (item === null) return <NotFound />

  const cat = categoryName(item.cat)
  const price = formatPrice(item.price)
  const override = (state.itemOverrides && state.itemOverrides[id]) || null
  const desc = override && override.description !== undefined ? override.description : description

  // The item belongs to the logged-in user (Blake) when the seed lists it under
  // `myItems` or when it was created in-session. Ownership changes the page:
  // no "Mark as..." select, an "Edit item" link, and no e-mail row (his items
  // carry s_show_email = 0).
  const isMine = (state.myItems || []).map(Number).includes(id) ||
    (state.newItems || []).some(it => Number(it.id) === id)

  const modDate = override && override.modDate
    ? override.modDate
    : (SEEDED_MOD_DATE_IDS.includes(id) ? item.pub : '')

  const flash = location.state && location.state.flash ? location.state.flash : null

  const breadcrumb = (
    <Breadcrumb crumbs={[
      { label: cat, to: indexUrl({ page: 'search', sCategory: item.cat }, sid) },
      { label: item.title }
    ]} />
  )

  return (
    <Layout
      bodyClass="item"
      title={`${item.title}${item.city ? ' ' + item.city : ''} - Classifieds`}
      breadcrumb={breadcrumb}
      flash={<Flash flash={flash} />}
    >
      <div id="main">
        <div id="item-content">
          <h1>{item.title}</h1>

          <div className="price price-alt isMobile">{price}</div>

          <div className="item-header">
            <div><strong className="publish">Published date:</strong> {formatDate(item.pub)}</div>
            <div>{modDate ? <><strong className="update">Modified date:</strong> {' ' + formatDate(modDate)}</> : null}</div>
            <ul id="item_location">
              <li><strong>Location:</strong> {formatItemLocation(item)}</li>
            </ul>
            {isMine && (
              <p id="edit_item_view">
                <strong>
                  <Link to={indexUrl({ page: 'item', action: 'item_edit', id }, sid)} rel="nofollow">Edit item</Link>
                </strong>
              </p>
            )}
          </div>

          <div className="item-photos">
            {/* The source really does emit href="javascript:;" here
                (assets/html/item-4799.html), so the attribute has to stay in the
                DOM — but React 18 warns on a literal `javascript:` href, so it
                is set imperatively instead. There is no Fancybox in the mock, so
                the anchor stays inert; `javascript:;` is itself a no-op. */}
            <a ref={mainPhotoRef} data-fancybox-trigger="gallery" className="main-photo" title="Image 1 / 1"
              onClick={e => e.preventDefault()}>
              <MainPhoto item={item} />
            </a>
            <div className="thumbs">
              <a href={photoUrl(item.id)} data-fancybox="gallery" className="fancybox" title="Image 1 / 1">
                <img src={thumbUrl(item.id)} width="75" alt={item.title} title={item.title}
                  onError={e => { if (e.currentTarget.src.indexOf(NO_PHOTO) === -1) e.currentTarget.src = NO_PHOTO }} />
              </a>
            </div>
          </div>

          <div id="description">
            <div className="desc">{desc}</div>

            <div className="item-hook"></div>

            <p className="contact_button">
              <a href="#contact-in" className="isDesktop isTablet btn btn-secondary">Contact seller</a>
              <Link to={indexUrl({ page: 'item', action: 'send_friend', id: item.id }, sid)} rel="nofollow" className="btn btn-secondary">Share</Link>
            </p>
          </div>

          {related.length > 0 && (
            <div className="similar_ads">
              <h2>Related listings</h2>
              <ListingCardList items={related} showAs="gallery" extraClass="items" />
              <div className="clear"></div>
            </div>
          )}

          <Comments item={item} commentsPage={params['comments-page']} />
        </div>
      </div>

      <ItemSidebar item={item} price={price} sid={sid} isMine={isMine} />
    </Layout>
  )
}

function MainPhoto({ item }) {
  const [src, setSrc] = useState(photoUrl(item.id))
  useEffect(() => { setSrc(photoUrl(item.id)) }, [item.id])
  return (
    <img
      src={src}
      alt={item.title}
      title={item.title}
      onError={() => {
        // Tier B (640x480) only covers ~1,530 items; everything else upscales the
        // 240x200 listing thumbnail, then finally the theme's no_photo.gif.
        if (src !== thumbUrl(item.id) && src !== NO_PHOTO) setSrc(thumbUrl(item.id))
        else if (src !== NO_PHOTO) setSrc(NO_PHOTO)
      }}
    />
  )
}

/** Labels for the five `select.mark_as` values, in the source's own order. */
const MARK_LABELS = {
  spam: 'Mark as spam',
  badcat: 'Mark as misclassified',
  repeated: 'Mark as duplicated',
  expired: 'Mark as expired',
  offensive: 'Mark as offensive'
}

function ItemSidebar({ item, price, sid, isMine }) {
  const navigate = useNavigate()

  // The source posts `#mask_as_form` on change; ROUTES #36 maps the same action
  // onto `index.php?page=item&action=mark&id=N&as=…`, which MarkItem handles.
  function onMark(e) {
    const as = e.target.value
    if (!as) return
    navigate(indexUrl({ page: 'item', action: 'mark', id: item.id, as }, sid))
  }

  return (
    <div id="sidebar">
      <div className="price isDesktop isTablet">{price}</div>

      {/* The source hides the report control on your own listings. */}
      {!isMine && (
        <form action="/index.php" method="post" name="mask_as_form" id="mask_as_form" onSubmit={e => e.preventDefault()}>
          <input type="hidden" name="id" value={item.id} readOnly />
          <input type="hidden" name="action" value="mark" readOnly />
          <input type="hidden" name="page" value="item" readOnly />
          <select name="as" id="as" className="mark_as" value="" onChange={onMark}>
            <option value="">Mark as...</option>
            {MARK_VALUES.map(v => <option key={v} value={v}>{MARK_LABELS[v]}</option>)}
          </select>
        </form>
      )}

      <div id="contact" className="widget-box form-container form-vertical">
        <h2>Contact publisher</h2>

        <p className="user-img">
          <img src="/img/default-user-image.png" alt={item.name} />
        </p>

        {/* A listing owned by the one registered user links its seller name to
            the public profile and flags the session as online; ordinary listings
            carry only the `s_contact_name` string. */}
        {isMine ? (
          <p className="name bld">
            <span>Name:</span>{' '}
            <Link to={indexUrl({ page: 'user', action: 'pub_profile', id: 1 }, sid)}>{item.name}</Link>{' '}
            <span className="is-online">(online)</span>
          </p>
        ) : (
          <p className="name bld"><span>Name:</span> {item.name}</p>
        )}

        {item.showEmail !== 0 && item.email ? (
          <p className="email bld"><span>E-mail:</span> <a href={`mailto:${item.email}`}>{item.email}</a></p>
        ) : null}

        {item.showPhone !== 0 && item.phone ? (
          <p className="phone bld"><span>Phone:</span> {item.phone}</p>
        ) : null}

        <a href="#contact-in" className="resp-toogle btn btn-secondary show-contact-btn">Contact seller</a>

        <div id="contact-in" className="fixed-layout">
          <div className="fixed-close"><i className="fas fa-times"></i></div>
          {/* Contact form disabled — item_contact_form_disabled = 1 on this deployment. */}
        </div>
      </div>

      <div id="useful_info">
        <h2>Useful information</h2>
        <ul>
          <li>Avoid scams by acting locally or paying with PayPal</li>
          <li>Never pay with Western Union, Moneygram or other anonymous payment services</li>
          <li>Don't buy or sell outside of your country. Don't accept cashier cheques from outside your country</li>
          <li>This site is never involved in any transaction, and does not handle payments, shipping, guarantee transactions, provide escrow services, or offer "buyer protection" or "seller certification"</li>
        </ul>
      </div>
    </div>
  )
}

/**
 * The source picks 3 same-category listings with SQL RAND(), so nothing is
 * anchored here. Deterministic pseudo-random offset keeps it stable per item.
 */
function pickRelated(shard, itemId, state) {
  const ids = shard.order && shard.order.newest ? shard.order.newest : []
  const pool = ids.filter(id => id !== itemId)
  if (!pool.length) return []
  const start = (itemId * 2654435761) % pool.length
  const out = []
  for (let i = 0; i < pool.length && out.length < 3; i++) {
    const it = getItemFrom(pool[(start + i) % pool.length], state, shard.byId)
    if (it) out.push(it)
  }
  return out
}
