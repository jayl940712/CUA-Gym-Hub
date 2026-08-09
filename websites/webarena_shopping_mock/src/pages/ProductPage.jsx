import React, { useState, useMemo, useEffect } from 'react'
import Breadcrumbs from '../components/Breadcrumbs.jsx'
import Messages from '../components/Messages.jsx'
import Rating from '../components/Rating.jsx'
import { Pager } from '../components/Toolbar.jsx'
import { RawProductImage } from '../components/ProductImage.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useUrlBuilder, useStoreNavigate } from '../utils/url.js'
import DetailGate, { useDetailReady, useDescriptionsFor } from '../components/DetailGate.jsx'
import {
  getOptions, getDescription, reviewsForProduct, ratingPercent, reviewCount, finalPrice,
  reviewRatingPercent, seededReviewCount, mediaUrl,
} from '../utils/catalog.js'
import { money, shortDate } from '../utils/format.js'
import { sanitizeStoredHtml } from '../utils/html.js'
import { ChevronLeft, ChevronRight } from '../components/Icons.jsx'

const REVIEWS_PER_PAGE = 10

/* Fotorama stamps every gallery instance with a millisecond-resolution class
   (`fotorama-item fotorama fotorama1786280284550` on the live source) and emits
   a <style> block scoped to it carrying the thumbnail metrics. The digits are
   the widget's construction time, so the source hands out a different value on
   every page load and nothing can key on them; the mock stamps one per page
   load the same way. The scoped rules are the real source of the 2 px thumbnail
   padding and the 90 px thumb height — reproduced verbatim so the nav frames
   measure 92 x 94 the way they do on the source. */
const FOTORAMA_ID = `fotorama${Date.now()}`
const FOTORAMA_INSTANCE_CSS =
  `.${FOTORAMA_ID} .fotorama__nav--thumbs .fotorama__nav__frame{padding:2px;height:90px}` +
  `.${FOTORAMA_ID} .fotorama__thumb-border{height:90px;border-width:2px;margin-top:2px}`

function activateOnKey(fn) {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); fn() }
  }
}

function Gallery({ product }) {
  /*
    Magento's gallery payload lists one entry per image but repeats the SAME
    file across that entry's `thumb` / `img` / `full` roles, so a seed built by
    flattening it can carry the same path two or more times. The source renders
    one `.fotorama__nav__frame` per DISTINCT image (2 for B071GML3JS), so
    dedupe here: this component must never draw a photo twice, and never mint a
    duplicate React key, however the seed is shaped. The thumb key is
    index-based for the same reason — a repeated path cannot collide with
    itself. (BUG-004, component half; the seed is fixed separately.)
  */
  const images = useMemo(() => {
    const raw = product.gallery && product.gallery.length
      ? product.gallery
      : [product.image || product.smallImage || product.thumbnail]
    return [...new Set(raw.filter(Boolean))]
  }, [product.id, product.gallery, product.image, product.smallImage, product.thumbnail])
  /*
    Fotorama opens on the image carrying Magento's `image` (base) role, not on
    gallery[0]: on the source `/catalog/product/view/id/34309/` the active stage
    frame and active thumb are both `B07SYHF5R2.1.jpg`, which is that product's
    `image`, while `gallery[0]` is `.0.jpg`. That is the frame a
    `page_image_query` evaluator crops, so it has to be the same one.
  */
  const baseIdx = useMemo(() => {
    const i = images.indexOf(product.image)
    return i >= 0 ? i : 0
  }, [images, product.image])
  const [idx, setIdx] = useState(baseIdx)
  useEffect(() => { setIdx(baseIdx) }, [product.id, baseIdx])
  const multi = images.length > 1

  /*
    VWA's 7 shopping `page_image_query` tasks select `.fotorama__stage__frame`,
    so the mock emits fotorama's own element chain rather than mock-local names.

    Frame ORDER is the one place the mock deliberately does not copy the source:
    fotorama recycles a sliding window of at most 3 frames and leaves them in
    construction order, which is [prev, active] for a 2-image product and
    [next, active, prev] for a 4-image one — the active frame is never first and
    the rule changes with the image count. The mock renders one frame per image
    (a superset — identical for the 1- and 2-image products that are 99.6 % of
    the catalog) and puts the ACTIVE frame first, so an evaluator that takes the
    first match and one that takes every match both get the on-screen photo.
    `left` is still computed from each image's gallery index, so what renders is
    unchanged by the reordering, and the keys are image paths (unique after the
    dedupe above) so reordering moves nodes instead of remounting <img>.
  */
  const frameOrder = useMemo(() => (
    [idx, ...images.map((_, i) => i).filter((i) => i !== idx)]
  ), [images, idx])

  const stageFrame = (i) => {
    const active = i === idx
    return (
      <div
        key={images[i]}
        className={`fotorama__stage__frame${active ? ' fotorama__active' : ''} fotorama_vertical_ratio fotorama__loaded fotorama__loaded--img`}
        aria-hidden={active ? 'false' : 'true'}
        data-active={active ? 'true' : 'false'}
        href={mediaUrl(images[i])}
        /* Fotorama parks every frame one stage-width plus the 2 px inter-frame
           gutter away from the active one (`left: -708.797px` against a 706.797
           px stage on the source); percentages resolve against the shaft, so
           this holds at any column width. */
        style={multi ? { left: i === idx ? '0px' : `calc((100% + 2px) * ${i - idx})` } : undefined}
      >
        <RawProductImage product={product} path={images[i]} alt="Image"
          className="fotorama__img" ariaHidden="false" />
      </div>
    )
  }

  return (
    <div className="product media">
      {/* Magento wraps the gallery in a pair of skip anchors and their
          visually-hidden links — verified verbatim on the live source
          (`/quoizel-tf9404m-grove-park-tiffany-multi-color-floor-lamp.html`):
            <a id="gallery-prev-area" tabindex="-1"></a>
            <div class="action-skip-wrapper"><a class="action skip gallery-next-area"
               href="#gallery-next-area"><span>Skip to the end of the images gallery</span></a></div>
            …gallery…
            <div class="action-skip-wrapper"><a class="action skip gallery-prev-area"
               href="#gallery-prev-area"><span>Skip to the beginning of the images gallery</span></a></div>
            <a id="gallery-next-area" tabindex="-1"></a> */}
      <a id="gallery-prev-area" tabIndex={-1} />
      <div className="action-skip-wrapper">
        <a className="action skip gallery-next-area" href="#gallery-next-area">
          <span>Skip to the end of the images gallery</span>
        </a>
      </div>
      <div className="gallery-placeholder" data-gallery-role="gallery-placeholder">
        <div className="fotorama--hidden" />
        <style>{FOTORAMA_INSTANCE_CSS}</style>
        <div className={`fotorama-item fotorama ${FOTORAMA_ID}`} data-gallery-role="gallery">
          <div data-gallery-role="fotorama__focusable-start" tabIndex={-1} />
          <div className="fotorama__wrap fotorama__wrap--css3 fotorama__wrap--slide fotorama__wrap--toggle-arrows">
            <div className="fotorama__stage" data-fotorama-stage="fotorama__stage">
              <div className="fotorama__fullscreen-icon" data-gallery-role="fotorama__fullscreen-icon" />
              {/* Source arrows are 80 x <stage height> hit areas pinned to the
                  stage edges, `role="button"` divs rather than <button>, and
                  they CLAMP at the ends (`fotorama__arr--disabled` + opacity 0)
                  instead of wrapping around. A gallery with a single image can
                  never navigate, and there the source drops both arrows out of
                  the layout with an inline `display: none` (measured 0 x 0)
                  rather than merely fading them. */}
              <div className={`fotorama__arr fotorama__arr--prev${idx === 0 || !multi ? ' fotorama__arr--disabled' : ''}`}
                tabIndex={idx === 0 || !multi ? -1 : 0} role="button" aria-label="Previous"
                data-gallery-role="arrow" {...(idx === 0 || !multi ? { disabled: true } : {})}
                style={multi ? undefined : { display: 'none' }}
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
                onKeyDown={activateOnKey(() => setIdx((i) => Math.max(0, i - 1)))}>
                <div className="fotorama__arr__arr"><ChevronLeft size={18} /></div>
              </div>
              <div className="fotorama__stage__shaft fotorama__grab" tabIndex={0} data-gallery-role="stage-shaft">
                {frameOrder.map(stageFrame)}
              </div>
              <div className={`fotorama__arr fotorama__arr--next${idx >= images.length - 1 ? ' fotorama__arr--disabled' : ''}`}
                tabIndex={idx >= images.length - 1 ? -1 : 0} role="button" aria-label="Next"
                data-gallery-role="arrow" {...(idx >= images.length - 1 ? { disabled: true } : {})}
                style={multi ? undefined : { display: 'none' }}
                onClick={() => setIdx((i) => Math.min(images.length - 1, i + 1))}
                onKeyDown={activateOnKey(() => setIdx((i) => Math.min(images.length - 1, i + 1)))}>
                <div className="fotorama__arr__arr"><ChevronRight size={18} /></div>
              </div>
              <div className="fotorama__video-close" />
              <div className="fotorama__zoom-in" data-gallery-role="fotorama__zoom-in" />
              <div className="fotorama__zoom-out" data-gallery-role="fotorama__zoom-out" />
              <div className="fotorama__spinner" />
            </div>
            {/* Single-image products keep the nav in the DOM but drop the
                `--horizontal` / `--thumbs` modifiers and hide it inline, which
                is how the source's `.gallery-placeholder` is 707 tall there and
                801 (707 + 94) once there is a thumbnail strip. */}
            <div className={`fotorama__nav-wrap${multi ? ' fotorama__nav-wrap--horizontal' : ''}`}
              data-gallery-role="nav-wrap" style={multi ? undefined : { display: 'none' }}>
              <div className={`fotorama__nav${multi ? ' fotorama__nav--thumbs' : ''}`} style={{ height: 94 }}>
                <div className="fotorama__thumb__arr fotorama__thumb__arr--left fotorama__arr--disabled"
                  role="button" aria-label="Previous" data-gallery-role="arrow" tabIndex={-1} disabled>
                  <div className="fotorama__thumb--icon" />
                </div>
                <div className="fotorama__nav__shaft">
                  {multi && (
                    <div className="fotorama__thumb-border"
                      style={{ transform: `translate3d(${idx * 92}px, 0px, 0px)`, width: 90, height: 90 }} />
                  )}
                  {multi && images.map((img, i) => (
                    <div key={img} className={`fotorama__nav__frame fotorama__nav__frame--thumb${i === idx ? ' fotorama__active' : ''}`}
                      tabIndex={0} role="button" data-gallery-role="nav-frame" data-nav-type="thumb"
                      aria-label="Image" style={{ width: 90 }} data-active={i === idx ? 'true' : 'false'}
                      onClick={() => setIdx(i)} onKeyDown={activateOnKey(() => setIdx(i))}>
                      <div className="fotorama__thumb fotorama_vertical_ratio fotorama__loaded fotorama__loaded--img">
                        <RawProductImage product={product} path={img} alt="Image"
                          className="fotorama__img" ariaHidden="false" />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="fotorama__thumb__arr fotorama__thumb__arr--right fotorama__arr--disabled"
                  role="button" aria-label="Next" data-gallery-role="arrow" tabIndex={-1} disabled>
                  <div className="fotorama__thumb--icon" />
                </div>
              </div>
            </div>
          </div>
          <div data-gallery-role="fotorama__focusable-end" tabIndex={-1} />
        </div>
        <div className="magnifier-preview" data-gallery-role="magnifier" id="preview" style={{ display: 'none' }} />
      </div>
      <div className="action-skip-wrapper">
        <a className="action skip gallery-prev-area" href="#gallery-prev-area">
          <span>Skip to the beginning of the images gallery</span>
        </a>
      </div>
      <a id="gallery-next-area" tabIndex={-1} />
    </div>
  )
}

function ReviewForm({ product }) {
  const { submitReview, addMessage, state } = useApp()
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
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
    <div className="block review-add">
      <div className="block-title"><strong>Write Your Own Review</strong></div>
      {/* Attributes verbatim from assets/html/product-with-options.html:
          <form action="…/review/product/post/id/87030/" class="review-form"
                method="post" id="review-form" data-role="product-review-form"
                data-bind="scope: 'review-form'">
          The radios are `name="ratings[4]" id="Rating_1".."Rating_5"` with
          `class="radio"` and a `label.rating-N[for][title][id="Rating_N_label"]`. */}
      <form className="review-form" id="review-form" method="post"
        data-role="product-review-form" onSubmit={onSubmit}>
        <fieldset className="fieldset review-fieldset">
          <legend className="legend review-legend">
            <span>You&#039;re reviewing:</span> <strong>{product.name}</strong>
          </legend><br />
          <fieldset className="field required review-field-ratings">
            <legend className="label"><span>Your Rating</span></legend><br />
            <div className="control">
              <div className="nested" id="product-review-table">
                <div className="field choice review-field-rating">
                  <label className="label" id="Rating_rating_label"><span>Rating</span></label>
                  {/* DOM order is ASCENDING — Rating_1 … Rating_5, values
                      16…20 — which is what the source emits, verbatim:
                        <input type="radio" name="ratings[4]" id="Rating_1" value="16"
                               class="radio" data-validate="{'rating-required':true}"
                               aria-labelledby="Rating_rating_label Rating_1_label"
                               aria-required="true">
                      (`16` is the option_id of "1 star" for rating_id 4.)
                      This matters because an agent that clicks by POSITION —
                      "the last radio", "the 5th star" — must record 5 stars,
                      not 1. `visualwebarena-262/263/264` assert
                      shopping_get_sku_latest_review_rating ⊇ "100".

                      Luma reverses the widget visually with overlapping
                      absolutely-positioned labels, not in the DOM, so the mock
                      cannot use the usual `input:checked ~ label` trick that
                      needs descending DOM order. The fill is driven instead by
                      `data-rating` on the container (see globals.css), which
                      keeps the labels laid out left-to-right ascending. */}
                  <div className="control review-control-vote rating"
                    data-rating={hoverRating || rating || 0}
                    onMouseLeave={() => setHoverRating(0)}>
                    {[1, 2, 3, 4, 5].map(v => (
                      <React.Fragment key={v}>
                        <input type="radio" name="ratings[4]" id={`Rating_${v}`} value={15 + v}
                          className="radio" data-validate="{'rating-required':true}"
                          aria-labelledby={`Rating_rating_label Rating_${v}_label`} aria-required="true"
                          checked={rating === v} onChange={() => setRating(v)} />
                        <label className={`rating-${v}`} htmlFor={`Rating_${v}`}
                          title={`${v} star${v > 1 ? 's' : ''}`} id={`Rating_${v}_label`}
                          onMouseEnter={() => setHoverRating(v)}>
                          <span>{v} star{v > 1 ? 's' : ''}</span>
                        </label>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              </div>
              {errors.rating && <span className="field-error">{errors.rating}</span>}
            </div>
          </fieldset>
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
                <Rating percent={reviewRatingPercent(r)} variant="review" />
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

  /*
   * R7-004 / R8-001. The PDP reads all three code-split detail seeds —
   * `getDescription` for the Details tab, `getOptions` for the
   * customisable-option fields, `reviewsForProduct` for the review LIST. A cold
   * deep link straight onto a PDP must paint its body complete on its first
   * frame (an RL agent is dropped onto arbitrary URLs and cannot be expected to
   * reload), so the shell is held back until what it paints has landed, rather
   * than being filled in afterwards. The header, nav, minicart and footer above
   * this stay on screen throughout.
   *
   * R7-004 gated on all three. But the review LIST is not first content: it
   * lives in the Reviews tab pane, which is only mounted once the tab is
   * clicked — on the source too (`.review-items .review-item` is 0 on both
   * sides until `#tab-label-reviews-title` fires). Everything about reviews
   * that IS on the first frame is now chunk-free:
   *
   *   `N Reviews` / `Add Your Review` in `.reviews-actions`  -> products.json
   *   the star rating                                        -> products.json
   *   the `Reviews <counter>` tab label                      -> reviewCounts.json
   *
   * so `reviews` (18.09 MB raw / 5.19 MB gzip) comes off the critical path and
   * finishes loading behind the painted page. The one case where the review
   * list IS first content is a `?review_page=` deep link, which opens on the
   * Reviews tab — that keeps the chunk in the gate.
   *
   * The description and the option fields DO stay in the gate — the Details tab
   * is the default pane and the option fields sit in the add-to-cart form, both
   * above the fold. But the description is now taken one SHARD at a time
   * (`useDescriptionsFor`, 32 shards keyed `id % 32`), so this PDP waits on its
   * own product's ~0.29 MB gzip instead of the whole 9.35 MB corpus.
   */
  const detailPending = !useDetailReady(
    query.review_page ? ['options', 'reviews'] : ['options'])
  const descPending = !useDescriptionsFor([product.id])

  const optionGroups = useMemo(() => getOptions(product.id), [product.id, detailPending])
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
  // The tab counted the review bodies the mock has LOADED, which is only right
  // where the seed carries them: reviews.json ships bodies for 493 of the 3 010
  // products that declare a `reviewsCount`, so 2 517 PDPs rendered a bare
  // `Reviews` tab directly above their own `10  Reviews` summary. The source
  // never does that — `B0002CEVPQ` (0 bodies in the mock) reads `Reviews 10`
  // there. So the label comes off the container's own count, falling back to
  // the loaded list wherever that is larger.
  // R8-001: `seededReviewCount()` answers from `reviewCounts.json` (35 KB, in
  // the always-loaded `seed` chunk) until the review corpus installs, and from
  // the live index afterwards, so this number is identical before and after the
  // chunk lands. Reading `reviewsForProduct().length` here instead would make
  // the label tick 9 -> 10 mid-flight on the 89 products whose seeded review
  // count exceeds their `review_entity_summary` aggregate.
  const tabCount = Math.max(
    count,
    seededReviewCount(product.id) + state.myReviews.filter(
      r => Number(r.productId) === Number(product.id)).length)
  const description = sanitizeStoredHtml(getDescription(product.id))

  /**
   * Collect the chosen options in the PDP's own field order. Magento's STORAGE
   * order differs (`sort_order ASC, option_id ASC`, no title tiebreak), and
   * three VWA cart tasks read `td.col.item > div > dl > dd:nth-child(4)` — the
   * SECOND option's value — so the order is the whole assertion. Normalising is
   * `addToCart`'s job now (`sortLineOptions()` in AppContext.jsx), so every
   * writer lands the same order in the STORED state rather than only on screen.
   */
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

  useEffect(() => { document.title = product.name }, [product.name])

  /*
    The PDP builds its own <main> instead of going through <Page>, because two
    VWA anchor selectors pin the shell shape and <Page> cannot express either:

      #maincontent > div.page-title-wrapper.product > h1 > span          (6 tasks)
      #maincontent > div.columns > div > div.product-info-main > …       (price, §2.4)

    i.e. the source puts `page-title-wrapper` — carrying an extra `product`
    class — as a DIRECT CHILD of #maincontent, outside div.columns, and makes
    `div.product-info-main` a DIRECT CHILD of `div.column.main`. <Page> emits a
    class-less `div.page-title-wrapper`, and the old `div.product-info-wrapper`
    flex box inserted one extra level between .column.main and .product-info-main,
    which broke both chains.

    Source child order inside .column.main is `.product-info-main`,
    `.product.media`, `.product.info.detailed` (offsets 78473 / 83587 / 86805 in
    /tmp/vwaE/pdp.html) — the gallery renders on the left because Luma floats it,
    not because it comes first. Reproduced with floats in globals.css.

    If <Page> ever grows a `titleClass` prop, this shell can fold back into it.
  */
  if (detailPending || descPending) {
    return (
      <main id="maincontent" className="page-main page-layout-1column">
        <a id="contentarea" tabIndex={-1} />
      </main>
    )
  }

  return (
    <>
      <Breadcrumbs items={productBreadcrumbs} />
      <main id="maincontent" className="page-main page-layout-1column">
        <a id="contentarea" tabIndex={-1} />
        <Messages />
        <div className="page-title-wrapper product">
          <h1 className="page-title">
            <span className="base" data-ui-id="page-title-wrapper" itemProp="name">{product.name}</span>
          </h1>
        </div>
        <div className="columns">
          <div className="column main">

            <div className="product-info-main">
              <div className="product-info-stock-sku">
                {/* The source DOM says "In stock"; the caps come from
                    `text-transform: uppercase` on .stock.available, so
                    textContent- and innerText-based extraction disagree if the
                    JSX carries the uppercase form. */}
                <div className={`stock ${product.inStock ? 'available' : 'unavailable'}`} title="Availability">
                  <span>{product.inStock ? 'In stock' : 'Out of stock'}</span>
                </div>
                {/* The `{' '}`s are load-bearing: the source separates these
                    three inline boxes with real whitespace, so its innerText
                    reads `IN STOCK SKU B00J8RZL7I` as one spaced line. JSX
                    strips the newline between adjacent elements. */}
                {' '}
                <div className="product attribute sku">
                  <strong className="type">SKU</strong>{' '}
                  <div className="value">{product.sku}</div>
                </div>
              </div>

              {/* The PDP summary is the ONLY place the source spells the
                  rating out as `N% of 100`; tiles and review items carry a
                  bare `N%`. Source (product-6s-headphones.html):
                    <span itemprop="reviewCount">12</span>&nbsp;
                    <span>Reviews                </span>
                  which normalises to the code points
                    12 · \xa0 · \x20 · Reviews · \x20
                  i.e. the NBSP comes FIRST and the label carries a trailing
                  space. Both orders render as `12  Reviews`; this one is the
                  source's (DIFF-R3). */}
              {count > 0 ? (
                <div className="product-reviews-summary">
                  <Rating percent={pct} variant="summary" />
                  <div className="reviews-actions">
                    <a className="action view" href="#reviews"
                      onClick={e => { e.preventDefault(); setTab('reviews') }}>
                      <span itemProp="reviewCount">{count}</span>{'\u00a0 '}
                      <span>{count === 1 ? 'Review' : 'Reviews'}{' '}</span>
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

              {/*
                The price chain is transcribed from the source PDP
                (`/quoizel-tf9404m-grove-park-tiffany-multi-color-floor-lamp.html`,
                saved at /tmp/vwaE/pdp.html):

                  div.price-box.price-final_price[data-role=priceBox][data-product-id][data-price-box]
                    span.price-container.price-final_price.tax.weee[itemprop=offers][itemscope][itemtype]
                      span#product-price-<id>.price-wrapper[data-price-amount][data-price-type=finalPrice]
                        span.price   "$749.99"
                      meta[itemprop=price][content=749.99]
                      meta[itemprop=priceCurrency][content=USD]

                VWA's `shopping_get_product_price` and one explicit-selector task
                read
                `#maincontent > div.columns > div > div.product-info-main >
                 div.product-info-price > div.price-box.price-final_price > span > span`,
                so every link in the chain is load-bearing — a bare `span.price`
                makes the whole selector return null.

                The source catalog has ZERO products with a `special_price`
                (`SELECT COUNT(*) … attribute_code='special_price'` → 0), so stock
                Magento's `.special-price` / `.old-price` split is unreachable
                there and could not be captured. The branch below keeps the *final*
                price inside the canonical chain and hangs the struck-through
                original off a following sibling, so the anchor resolves either way.
              */}
              <div className="product-info-price">
                <div className="price-box price-final_price" data-role="priceBox"
                  data-product-id={product.id} data-price-box={`product-id-${product.id}`}>
                  <span className="price-container price-final_price tax weee"
                    itemProp="offers" itemScope itemType="http://schema.org/Offer">
                    {product.specialPrice != null && (
                      <span className="price-label">Special Price</span>
                    )}
                    <span id={`product-price-${product.id}`}
                      data-price-amount={finalPrice(product)}
                      data-price-type="finalPrice"
                      className="price-wrapper ">
                      <span className="price">{money(finalPrice(product))}</span>
                    </span>
                    <meta itemProp="price" content={finalPrice(product)} />
                    <meta itemProp="priceCurrency" content="USD" />
                  </span>
                  {product.specialPrice != null && (
                    <span className="old-price">
                      <span className="price-container price-final_price tax weee">
                        <span className="price-label">Regular Price</span>
                        <span id={`old-price-${product.id}`}
                          data-price-amount={product.price}
                          data-price-type="oldPrice"
                          className="price-wrapper ">
                          <span className="price">{money(product.price)}</span>
                        </span>
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/*
                Transcribed from the live source, in-stock PDP
                (`/quoizel-tf9404m-grove-park-tiffany-multi-color-floor-lamp.html`):

                  div.product-add-form
                    form#product_addtocart_form[data-product-sku][method=post][action]
                      input[type=hidden][name=product|selected_configurable_option|
                                              related_product|item]
                      div.box-tocart > div.fieldset
                        div.field.qty > label.label[for=qty] + div.control > input#qty
                        div.actions > button#product-addtocart-button.action.primary.tocart

                On an OUT-OF-STOCK PDP the same fetch of
                `/coffeecakes-apple-walnut-coffee-cake.html` shows the wrapper and
                the form still present with only the hidden inputs — and
                `box-tocart` / `#qty` / `#product-addtocart-button` counts of
                literally 0. The whole qty+add block is dropped, which is why the
                mock must not offer it either (BUG-005): the source will not sell
                these 261 products.
              */}
              <div className="product-add-form">
                <form data-product-sku={product.sku} method="post"
                  action={`/checkout/cart/add/product/${product.id}/`}
                  id="product_addtocart_form"
                  onSubmit={e => { e.preventDefault(); onAddToCart() }}>
                  <input type="hidden" name="product" value={product.id} readOnly />
                  <input type="hidden" name="selected_configurable_option" value="" readOnly />
                  <input type="hidden" name="related_product" id="related-products-field" value="" readOnly />
                  <input type="hidden" name="item" value={product.id} readOnly />
                  {/* The source drops the options wrapper on an out-of-stock
                      product too, not just the cart block: fetched
                      `/diidmo-candy-skull-girl-makeup-mirror-…-rose-gold.html`
                      (id 865, which the seed gives a required `Color` option)
                      and `product-options-wrapper` / `product-custom-option`
                      both count 0 while `.stock.unavailable` is present. The
                      wrapper also lives INSIDE `#product_addtocart_form` on the
                      source, with `id` and `data-hasrequired` set. */}
                  {product.inStock && optionGroups.length > 0 && (
                    <div className="product-options-wrapper" id="product-options-wrapper"
                      data-hasrequired="* Required Fields">
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
                  {product.inStock && (
                    <div className="box-tocart">
                      <div className="fieldset">
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
                        <div className="actions">
                          <button type="submit" title="Add to Cart"
                            className="action primary tocart" id="product-addtocart-button">
                            <span>Add to Cart</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </form>
              </div>

              {/*
                Source, both in-stock and out-of-stock:
                  div.product-social-links
                    div.product-addto-links[data-role=add-to-links]
                      a.action.towishlist[href="#"][data-post][data-action=add-to-wishlist]
                      a.action.tocompare[href="#"][data-post][data-role=add-to-links]
                The mock rendered `<button>`s with no wrapper, so `a.towishlist`,
                `[data-role=add-to-links]` and `[data-action=add-to-wishlist]`
                all missed (DIFF-R4).

                `tocompare` is absent from the out-of-stock page — `grep -c
                tocompare` on the fetched OOS PDP is 0 — while `towishlist` stays,
                so the compare link is gated on stock and the wishlist one is not.
              */}
              <div className="product-social-links">
                <div className="product-addto-links" data-role="add-to-links">
                  <a href="#" className="action towishlist" data-action="add-to-wishlist"
                    data-post={JSON.stringify({ action: '/wishlist/index/add/', data: { product: product.id } })}
                    onClick={e => {
                      e.preventDefault()
                      // Same #qty input, same form, same source validation — so this
                      // link has to reject a bad qty too, or `0` would be blocked
                      // for Add to Cart and silently become `1` here. Out of stock
                      // there is no #qty at all, so there is nothing to validate.
                      if (product.inStock) {
                        const qtyErr = validateQty(qty)
                        setQtyError(qtyErr)
                        if (qtyErr) return
                      }
                      addToWishlist(product, product.inStock ? { qty: Number(String(qty).trim()) } : { qty: 1 })
                      addMessage(
                        <span>{product.name} has been added to your Wish List.{' '}
                          <a href="#" onClick={e2 => { e2.preventDefault(); navigate('/') }}>Click here</a> to continue shopping.</span>
                      )
                    }}>
                    <span>Add to Wish List</span>
                  </a>
                  {/* The source separates the two anchors with whitespace, so
                      its innerText reads `Add to Wish List Add to Compare`.
                      JSX strips the newline between adjacent elements, which
                      ran them together as `Add to Wish ListAdd to Compare`
                      (DIFF-F05); `{' '}` restores the separator. */}
                  {product.inStock && ' '}
                  {product.inStock && (
                    <a href="#" className="action tocompare" data-role="add-to-links"
                      data-post={JSON.stringify({ action: '/catalog/product_compare/add/', data: { product: String(product.id) } })}
                      onClick={e => {
                        e.preventDefault()
                        addToCompare(product)
                        addMessage(`You added product ${product.name} to the comparison list.`)
                      }}>
                      <span>Add to Compare</span>
                    </a>
                  )}
                </div>
              </div>
            </div>

            <Gallery product={product} />

            {/*
              Source markup, read off the live PDP:

                div.product.data.items[role=tablist]
                  div.data.item.title.active#tab-label-description
                      [data-role=collapsible][role=tab][aria-controls=description]
                      [aria-expanded=true][tabindex=0]
                    a.data.switch#tab-label-description-title[href="#description"]
                  div.data.item.content#description
                      [data-role=content][role=tabpanel]
                      [aria-labelledby=tab-label-description][aria-hidden=false]
                  div.data.item.title#tab-label-reviews[aria-controls=reviews]
                    a.data.switch#tab-label-reviews-title[href="#reviews"]
                  div.data.item.content#reviews[aria-labelledby=tab-label-reviews]
                      [aria-hidden=true]  <- display:none, but IN THE DOM

              Two things the mock used to get wrong (DIFF-F3-03): the titles were
              boxed in an `.items-title` wrapper the source does not have, and
              only the active pane was mounted, so the review form and its
              `You're reviewing:` / `Your Rating` legends did not exist until the
              tab was clicked. Both panes are now always mounted and the inactive
              one is hidden by `[aria-hidden="true"]` in CSS, as the source does.

              `id="reviews"` moves off the wrapper onto its own pane, matching the
              source. Nothing navigates to that fragment — both `href="#reviews"`
              links `preventDefault()` and call `setTab`.

              Ordering is load-bearing: 5 webarena evaluators read
              `document.querySelector('.data.item.content').outerText`, so the
              FIRST `.data.item.content` has to be the description. It is on the
              source, and now unconditionally here too — previously that selector
              returned review text whenever the Reviews tab happened to be open.
            */}
            <div className="product data items" role="tablist">
              <div className={`data item title${tab === 'details' ? ' active' : ''}`}
                data-role="collapsible" id="tab-label-description" role="tab"
                aria-controls="description" aria-expanded={tab === 'details'}
                tabIndex={tab === 'details' ? 0 : -1}>
                <a className="data switch" href="#description" id="tab-label-description-title"
                  data-toggle="trigger" tabIndex={-1}
                  onClick={e => { e.preventDefault(); setTab('details') }}>Details</a>
              </div>
              <div className="data item content" id="description" data-role="content"
                role="tabpanel" aria-labelledby="tab-label-description"
                aria-hidden={tab !== 'details'}>
                {description
                  ? <div className="description-body" dangerouslySetInnerHTML={{ __html: description }} />
                  : <p>No additional information is available for this product.</p>}
              </div>
              <div className={`data item title${tab === 'reviews' ? ' active' : ''}`}
                data-role="collapsible" id="tab-label-reviews" role="tab"
                aria-controls="reviews" aria-expanded={tab === 'reviews'}
                tabIndex={tab === 'reviews' ? 0 : -1}>
                {/* Source: `Reviews <span class="counter">12</span>` — the
                    parentheses come from .counter:before/:after. */}
                <a className="data switch" href="#reviews" id="tab-label-reviews-title"
                  data-toggle="trigger" tabIndex={-1}
                  onClick={e => { e.preventDefault(); setTab('reviews') }}>
                  {tabCount > 0 ? <>Reviews <span className="counter">{tabCount}</span></> : 'Reviews'}
                </a>
              </div>
              <div className="data item content" id="reviews" data-role="content"
                role="tabpanel" aria-labelledby="tab-label-reviews"
                aria-hidden={tab !== 'reviews'}>
                {/* R8-001: `reviews` is no longer in the boot gate, so on a
                    click that beats the chunk this pane would otherwise print
                    "Customer Reviews" over an empty list — a 0-review page for
                    a product that has 12. main.jsx has had the chunk in flight
                    since before React mounted, so in practice it is already
                    there; render nothing rather than something false if it is
                    not. A `?review_page=` deep link never reaches this branch
                    unready — that URL puts `reviews` back in the gate above. */}
                <DetailGate needs={['reviews']}>
                  <ReviewsTab product={product} />
                </DetailGate>
              </div>
            </div>
          </div>
        </div>
      </main>
    </>
  )
}

export { finalPrice }
