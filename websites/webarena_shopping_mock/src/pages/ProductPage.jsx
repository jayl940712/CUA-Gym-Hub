import React, { useState, useMemo, useEffect } from 'react'
import Page from '../components/Page.jsx'
import Rating from '../components/Rating.jsx'
import { Pager } from '../components/Toolbar.jsx'
import { RawProductImage } from '../components/ProductImage.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useUrlBuilder, useStoreNavigate } from '../utils/url.js'
import {
  getOptions, getDescription, reviewsForProduct, ratingPercent, reviewCount, finalPrice,
  reviewRatingPercent,
} from '../utils/catalog.js'
import { money, shortDate } from '../utils/format.js'
import { sanitizeStoredHtml } from '../utils/html.js'
import { ChevronLeft, ChevronRight } from '../components/Icons.jsx'

const REVIEWS_PER_PAGE = 10

function Gallery({ product }) {
  const images = product.gallery && product.gallery.length
    ? product.gallery
    : [product.image || product.smallImage || product.thumbnail].filter(Boolean)
  const [idx, setIdx] = useState(0)
  useEffect(() => { setIdx(0) }, [product.id])
  const current = images[idx] || null

  return (
    <div className="product media">
      <div className="gallery-main">
        {images.length > 1 && (
          <button type="button" className="gallery-nav prev" title="Previous"
            onClick={() => setIdx(i => (i - 1 + images.length) % images.length)}>
            <ChevronLeft size={18} />
          </button>
        )}
        <RawProductImage product={product} path={current} alt={product.name}
          style={{ maxWidth: '100%', maxHeight: 560, objectFit: 'contain' }} />
        {images.length > 1 && (
          <button type="button" className="gallery-nav next" title="Next"
            onClick={() => setIdx(i => (i + 1) % images.length)}>
            <ChevronRight size={18} />
          </button>
        )}
      </div>
      {images.length > 1 && (
        <div className="gallery-thumbs">
          {images.map((img, i) => (
            <button type="button" key={img} className={i === idx ? 'active' : ''}
              onClick={() => setIdx(i)} title={`View image ${i + 1}`}>
              <RawProductImage product={product} path={img} alt={product.name} />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ReviewForm({ product }) {
  const { submitReview, addMessage, state } = useApp()
  const [rating, setRating] = useState(0)
  const [nickname, setNickname] = useState('')
  const [summary, setSummary] = useState('')
  const [detail, setDetail] = useState('')
  const [errors, setErrors] = useState({})

  const onSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    if (!rating) errs.rating = 'Please select one of each ratings above.'
    if (!nickname.trim()) errs.nickname = 'This is a required field.'
    if (!summary.trim()) errs.summary = 'This is a required field.'
    if (!detail.trim()) errs.detail = 'This is a required field.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    submitReview({ productId: product.id, rating, nickname: nickname.trim(), title: summary.trim(), detail: detail.trim() })
    setRating(0); setNickname(''); setSummary(''); setDetail('')
    addMessage('You submitted your review for moderation.')
  }

  return (
    <div className="review-add">
      <div className="block-title"><strong>Write Your Own Review</strong></div>
      <form className="review-form" onSubmit={onSubmit}>
        <fieldset className="fieldset review-fieldset">
          <legend className="legend review-legend">
            <span>You&#039;re reviewing:</span> <strong>{product.name}</strong>
          </legend>
          <div className="field review-field-ratings">
            <span className="label required">Your Rating</span>
            <div className="control">
              <div className="control rating">
                {[5, 4, 3, 2, 1].map(v => (
                  <React.Fragment key={v}>
                    <input type="radio" id={`rating-${v}`} name="rating" value={v}
                      checked={rating === v} onChange={() => setRating(v)} />
                    <label htmlFor={`rating-${v}`} title={`${v} star${v > 1 ? 's' : ''}`} />
                  </React.Fragment>
                ))}
              </div>
              {errors.rating && <span className="field-error">{errors.rating}</span>}
            </div>
          </div>
          <div className="field required">
            <label className="label" htmlFor="nickname_field"><span>Nickname</span></label>
            <div className="control">
              <input type="text" id="nickname_field" value={nickname} onChange={e => setNickname(e.target.value)} />
              {errors.nickname && <span className="field-error">{errors.nickname}</span>}
            </div>
          </div>
          <div className="field required">
            <label className="label" htmlFor="summary_field"><span>Summary</span></label>
            <div className="control">
              <input type="text" id="summary_field" value={summary} onChange={e => setSummary(e.target.value)} />
              {errors.summary && <span className="field-error">{errors.summary}</span>}
            </div>
          </div>
          <div className="field required">
            <label className="label" htmlFor="review_field"><span>Review</span></label>
            <div className="control">
              <textarea id="review_field" rows={5} value={detail} onChange={e => setDetail(e.target.value)} />
              {errors.detail && <span className="field-error">{errors.detail}</span>}
            </div>
          </div>
        </fieldset>
        <div className="actions-toolbar review-form-actions">
          <button type="submit" className="action submit primary"><span>Submit Review</span></button>
        </div>
      </form>
      {state.myReviews.length > 0 && <span className="visually-hidden">{state.myReviews.length} submitted</span>}
    </div>
  )
}

function ReviewsTab({ product }) {
  const { state } = useApp()
  const { query } = useUrlBuilder()
  const navigate = useStoreNavigate()
  const list = reviewsForProduct(product.id, state.myReviews)
  const page = Math.max(1, parseInt(query.review_page, 10) || 1)
  const totalPages = Math.max(1, Math.ceil(list.length / REVIEWS_PER_PAGE))
  const items = list.slice((page - 1) * REVIEWS_PER_PAGE, page * REVIEWS_PER_PAGE)

  return (
    <div className="review-list">
      <h3 className="review-title">Customer Reviews</h3>
      <ol className="items review-items">
        {items.map(r => (
          <li className="item review-item" key={r.reviewId}>
            <div className="review-title-line" itemProp="name">{r.title}</div>
            {/* The source omits the whole review-ratings block for a review
                with no vote — verified on /review/product/listAjax/id/6532/. */}
            {reviewRatingPercent(r) != null && (
              <div className="review-ratings">
                <Rating percent={reviewRatingPercent(r)} />
              </div>
            )}
            <div className="review-content-container">
              <div className="review-content">{r.detail}</div>
              <div className="review-details">
                <p className="review-author">
                  <span className="review-details-label">Review by </span>
                  <strong className="review-details-value">{r.nickname}</strong>
                </p>
                <p className="review-date">
                  <span className="review-details-label">Posted on </span>
                  <time className="review-details-value">{shortDate(r.createdAt)}</time>
                </p>
              </div>
            </div>
          </li>
        ))}
      </ol>
      {totalPages > 1 && (
        <div className="toolbar review-toolbar">
          <Pager page={page} totalPages={totalPages} param="review_page" windowSize={5} />
        </div>
      )}
      <ReviewForm product={product} />
    </div>
  )
}

/** ROUTES #5 / #6 — /<url_key>.html and /catalog/product/view/id/:id. */
export default function ProductPage({ product }) {
  const { state, addToCart, addToWishlist, addToCompare, addMessage } = useApp()
  const { query } = useUrlBuilder()
  const navigate = useStoreNavigate()

  const optionGroups = useMemo(() => getOptions(product.id), [product.id])
  const [selected, setSelected] = useState({})
  const [qty, setQty] = useState(1)
  const [optionErrors, setOptionErrors] = useState({})
  const [qtyError, setQtyError] = useState(null)
  const [tab, setTab] = useState(query.review_page ? 'reviews' : 'details')

  /**
   * The source serves `<div class="breadcrumbs"></div>` empty and fills it in
   * from the `x-magento-init` payload right below it, so a `curl` of a PDP looks
   * like the page has no breadcrumbs at all. It does — confirmed in a real
   * browser on 3 products (sony-bdp-s480…, 6s-wireless-headphones…,
   * bornbridge-artificial-spiral-topiary-tree…), all of which render:
   *   <li class="item home"><a href="…/" title="Go to Home Page">Home</a></li>
   *   <li class="item product"><strong>{product name}</strong></li>
   * Do NOT "match the source" by deleting these.
   */
  const productBreadcrumbs = [{ label: product.name, className: 'product' }]

  useEffect(() => {
    setSelected({}); setQty(1); setOptionErrors({}); setQtyError(null)
    setTab(query.review_page ? 'reviews' : 'details')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.id])

  const pct = ratingPercent(product, state.myReviews)
  // The source draws these two numbers from different places and does not
  // reconcile them: the summary link under the rating reads the stale
  // review_entity_summary aggregate, while the Reviews tab counts the review
  // collection. Product 89814 renders "9 Reviews" above and "Reviews (10)" on
  // the tab. Keep both.
  const count = reviewCount(product, state.myReviews)
  const tabCount = reviewsForProduct(product.id, state.myReviews).length
  const description = sanitizeStoredHtml(getDescription(product.id))

  const buildSelectedOptions = () => optionGroups
    .filter(g => selected[g.optionId])
    .map(g => {
      const value = g.values.find(v => String(v.optionTypeId) === String(selected[g.optionId]))
      return {
        optionId: g.optionId,
        optionTypeId: value ? value.optionTypeId : null,
        label: g.title,
        value: value ? value.title : '',
      }
    })

  /**
   * PDP qty validation, transcribed from the source's own rules.
   *
   * The input carries
   *   data-validate="{"required-number":true,"validate-item-quantity":{"maxAllowed":10000}}"
   * and the messages come out of the store's `mage/validation.js`
   * (`curl http://10.186.197.203:7770/static/frontend/Magento/luma/en_US/mage/validation.js`):
   *   'required-number'        -> "Please enter a valid number in this field."   (:851-856)
   *   'validate-item-quantity' -> "Please enter a quantity greater than 0."      (:1642)
   *                            -> "The maximum you may purchase is %1."          (:1658)
   * The add is *blocked*, not silently coerced to 1 as it used to be.
   */
  const QTY_MAX_ALLOWED = 10000
  const validateQty = (raw) => {
    const v = String(raw).trim()
    if (!v.length) return 'Please enter a valid number in this field.'
    const n = Number(v)
    if (!Number.isFinite(n)) return 'Please enter a valid number in this field.'
    if (!(n > 0)) return 'Please enter a quantity greater than 0.'
    if (n > QTY_MAX_ALLOWED) return `The maximum you may purchase is ${QTY_MAX_ALLOWED}.`
    return null
  }

  const onAddToCart = () => {
    // Required custom options block the add with "This is a required field."
    const errs = {}
    for (const g of optionGroups) {
      if (g.isRequire && !selected[g.optionId]) errs[g.optionId] = 'This is a required field.'
    }
    setOptionErrors(errs)
    const qtyErr = validateQty(qty)
    setQtyError(qtyErr)
    if (Object.keys(errs).length || qtyErr) return
    addToCart(product, Number(String(qty).trim()), buildSelectedOptions())
    addMessage(`You added ${product.name} to your shopping cart.`)
  }

  return (
    <Page
      breadcrumbs={productBreadcrumbs}
      title={product.name}
      documentTitle={product.name}
      sidebar="none"
    >
      <div className="product-info-wrapper">
        <Gallery product={product} />

        <div className="product-info-main">
          <div className="product-info-stock-sku">
            {/* The source DOM says "In stock"; the caps come from
                `text-transform: uppercase` on .stock.available, so
                textContent- and innerText-based extraction disagree if the
                JSX carries the uppercase form. */}
            <div className={`stock ${product.inStock ? 'available' : 'unavailable'}`} title="Availability">
              <span>{product.inStock ? 'In stock' : 'Out of stock'}</span>
            </div>
            <div className="product attribute sku">
              <strong className="type">SKU</strong>
              <div className="value">{product.sku}</div>
            </div>
          </div>

          {count > 0 ? (
            <div className="product-reviews-summary">
              <Rating percent={pct} />
              <div className="reviews-actions">
                <a className="action view" href="#reviews"
                  onClick={e => { e.preventDefault(); setTab('reviews') }}>
                  {count} {count === 1 ? 'Review' : 'Reviews'}
                </a>{' '}
                <a className="action add" href="#review-form"
                  onClick={e => { e.preventDefault(); setTab('reviews') }}>Add Your Review</a>
              </div>
            </div>
          ) : (
            <div className="product-reviews-summary empty">
              <a className="action add" href="#review-form"
                onClick={e => { e.preventDefault(); setTab('reviews') }}>Be the first to review this product</a>
            </div>
          )}

          <div className="product-info-price">
            {product.specialPrice != null ? (
              <>
                <span className="special-price"><span className="price">{money(product.specialPrice)}</span></span>{' '}
                <span className="old-price"><span className="price">{money(product.price)}</span></span>
              </>
            ) : (
              <span className="price">{money(product.price)}</span>
            )}
          </div>

          {optionGroups.length > 0 && (
            <div className="product-options-wrapper">
              {optionGroups.map(group => (
                <div className={`field${group.isRequire ? ' required' : ''}`} key={group.optionId}>
                  <label className="label" htmlFor={`option-${group.optionId}`}>
                    <span>{group.title}</span>
                  </label>
                  <div className="control">
                    <ul className="options-list" id={`option-${group.optionId}`}>
                      {group.values.map(v => (
                        <li key={v.optionTypeId}>
                          <input
                            type="radio"
                            id={`opt-${v.optionTypeId}`}
                            name={`options[${group.optionId}]`}
                            value={v.optionTypeId}
                            checked={String(selected[group.optionId]) === String(v.optionTypeId)}
                            onChange={() => setSelected(s => ({ ...s, [group.optionId]: v.optionTypeId }))}
                          />
                          <label htmlFor={`opt-${v.optionTypeId}`}>
                            {v.title}
                            {v.price ? ` +${money(v.price)}` : ''}
                          </label>
                        </li>
                      ))}
                    </ul>
                    {optionErrors[group.optionId] && (
                      <div className="field-error" role="alert">{optionErrors[group.optionId]}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="box-tocart">
            <div className="field qty">
              <label className="label" htmlFor="qty"><span>Qty</span></label>
              <div className="control">
                <input type="number" name="qty" id="qty" min="0" title="Qty"
                  className="input-text qty" value={qty}
                  data-validate='{"required-number":true,"validate-item-quantity":{"maxAllowed":10000}}'
                  onChange={e => { setQty(e.target.value); if (qtyError) setQtyError(null) }} />
                {qtyError && <div className="field-error" role="alert" id="qty-error">{qtyError}</div>}
              </div>
            </div>
            <button type="button" className="action primary tocart" id="product-addtocart-button"
              onClick={onAddToCart}>
              <span>Add to Cart</span>
            </button>
          </div>

          <div className="product-social-links">
            <button type="button" className="action secondary small towishlist"
              onClick={() => {
                // Same #qty input, same form, same source validation — so this
                // button has to reject a bad qty too, or `0` would be blocked
                // for Add to Cart and silently become `1` here.
                const qtyErr = validateQty(qty)
                setQtyError(qtyErr)
                if (qtyErr) return
                addToWishlist(product, { qty: Number(String(qty).trim()) })
                addMessage(
                  <span>{product.name} has been added to your Wish List.{' '}
                    <a href="#" onClick={e => { e.preventDefault(); navigate('/') }}>Click here</a> to continue shopping.</span>
                )
              }}>
              <span>Add to Wish List</span>
            </button>
            <button type="button" className="action secondary small tocompare"
              onClick={() => {
                addToCompare(product)
                addMessage(`You added product ${product.name} to the comparison list.`)
              }}>
              <span>Add to Compare</span>
            </button>
          </div>
        </div>
      </div>

      <div className="product data items" id="reviews">
        <div className="items-title">
          <div className={`item title${tab === 'details' ? ' active' : ''}`}>
            <a className="data switch" href="#description" onClick={e => { e.preventDefault(); setTab('details') }}>Details</a>
          </div>
          <div className={`item title${tab === 'reviews' ? ' active' : ''}`}>
            {/* Source: `Reviews <span class="counter">12</span>` — the
                parentheses come from .counter:before/:after. */}
            <a className="data switch" href="#reviews" onClick={e => { e.preventDefault(); setTab('reviews') }}>
              {tabCount > 0 ? <>Reviews <span className="counter">{tabCount}</span></> : 'Reviews'}
            </a>
          </div>
        </div>
        <div className="item content">
          {tab === 'details' ? (
            description
              ? <div className="description-body" dangerouslySetInnerHTML={{ __html: description }} />
              : <p>No additional information is available for this product.</p>
          ) : (
            <ReviewsTab product={product} />
          )}
        </div>
      </div>
    </Page>
  )
}

export { finalPrice }
