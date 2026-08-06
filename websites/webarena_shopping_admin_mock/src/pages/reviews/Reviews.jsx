import React, { useMemo, useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import PageShell from '../../components/layout/PageShell.jsx'
import RecordForm from '../../components/system/RecordForm.jsx'
import AdminLink from '../../components/layout/AdminLink.jsx'
import AdminGrid from '../../components/grid/AdminGrid.jsx'
import LegacyReviewGrid, { parseGridSegments } from '../../components/reviews/LegacyReviewGrid.jsx'
import LegacyGrid from '../../components/reports/LegacyGrid.jsx'
import { formatReviewDateTime } from '../../components/reviews/reviewFormat.js'
import { useApp } from '../../context/AppContext.jsx'
import * as S from '../../utils/staticData.js'
import { getReviews, getReview } from '../../utils/selectors.js'
import { formatDateTime, reviewStatusLabel, formatCurrency } from '../../utils/formatters.js'
import { useSidNavigate } from '../../utils/navigation.js'

/**
 * Marketing > User Content > Reviews.
 *
 * The store view a review is visible in is rendered as the same three indented
 * lines the source uses; several tasks read the grid's "N records found" after
 * filtering the Review column, so the keyword search and the per-column filter
 * both look at `detail`.
 */

const STORE_VIEW_LINES = ['Main Website', 'Main Website Store', 'Default Store View']

const STATUS_OPTIONS = [
  { value: '1', label: 'Approved' },
  { value: '2', label: 'Pending' },
  { value: '3', label: 'Not Approved' },
]

/**
 * DOM-004. The star radios are keyed by `rating_option.option_id`, not by the
 * 1-5 star number. Source, review 352 (`rating_id` 4, code `Rating`):
 *   <input type="radio" name="ratings[4]" id="Rating_1" value="16" aria-required="true">
 *   … id="Rating_4" value="19" checked="checked" … id="Rating_5" value="20"
 * The ids 16-20 are the `rating_option` rows in src/data/ratings.json, so the
 * value comes out of the seed rather than being computed. `id` is
 * `<rating_code>_<star>`, which is what makes `#Rating_5` the source's selector.
 */
function ratingOptionId(ratingDefs, ratingId, star) {
  const def = (ratingDefs || []).find(r => String(r.rating_id) === String(ratingId))
  const opt = (def?.options || []).find(o => Number(o.value) === Number(star))
  return opt ? String(opt.option_id) : String(star)
}

function StoreView() {
  return (
    <div className="store-view-cell">
      {STORE_VIEW_LINES.map((line, i) => (
        // `_level-N` carries the source's indentation (3 / 6 &nbsp; per level);
        // `store-view-line--N` was styled nowhere, so the three lines rendered flush.
        <span key={line} className={`store-view-line _level-${i}`}>{line}</span>
      ))}
    </div>
  )
}

/**
 * Magento truncates the Review column to 50 characters **including** the
 * ellipsis (`Magento\Framework\Filter\Truncate`: `substr(0, $length - strlen($etc))`),
 * so a cut cell is 47 characters of text plus `...`. The mock was cutting at 50
 * and then appending, giving 53 — every truncated Review cell on both review
 * grids carried three characters the source does not print:
 *   source  `I recently purchased the Circe Hooded Ice Fleec...`
 *   mock    `I recently purchased the Circe Hooded Ice Fleece a...`
 * Words are broken mid-word, exactly as above — this is not a word-boundary cut.
 */
function truncate(text, len = 50, etc = '...') {
  const s = String(text || '')
  return s.length > len ? `${s.slice(0, len - etc.length)}${etc}` : s
}

/**
 * `ret` rides in the Edit link and on the edit form's Back/Save target, exactly
 * as the source does: the Pending Reviews grid emits
 * `/admin/review/product/edit/id/<id>/ret/pending/` so the edit page knows to
 * return to the pending grid rather than the full one.
 */
function retPath(ret) {
  return ret === 'pending' ? '/admin/review/product/pending/' : '/admin/review/product/index/'
}

/**
 * The data cells, in the same order as the legacy grid's header row.
 *
 * DIFF-R69 — `showStatus` is false on Pending Reviews, where the source renders
 * no Status column at all. It has to be threaded through here as well as
 * through the header, or every cell after `Created` sits one column right of
 * the source's.
 */
function reviewCells(r, ret, showStatus = true) {
  return (
    <>
      <td className="col-id col-review_id">{r.review_id}</td>
      {/* DIFF-R68 — the review grids print `Apr 24, 2023, 2:55:10 PM`; the
        * order/customer grids print the same instant without the comma. */}
      <td className="col-date col-created_at">{formatReviewDateTime(r.created_at)}</td>
      {showStatus ? <td className="col-status">{reviewStatusLabel(r.status_id)}</td> : null}
      <td className="col-title">{r.title}</td>
      <td className="col-name col-nickname">{r.nickname}</td>
      <td className="col-detail">{truncate(r.detail)}</td>
      <td className="col-visible_in"><StoreView /></td>
      <td className="col-type">{r.customer_id ? 'Customer' : 'Guest'}</td>
      <td className="col-name">{r.product_name}</td>
      <td className="col-sku">{r.sku}</td>
      <td className="col-action">
        <AdminLink to={`/admin/review/product/edit/id/${r.review_id}/${ret ? `ret/${ret}/` : ''}`}>Edit</AdminLink>
      </td>
    </>
  )
}

function ReviewsGridPage({ title, pendingOnly = false }) {
  const { state, setState, deleteReviews, addMessage } = useApp()
  const params = useParams()
  /* Magento's legacy grid carries its whole state in `/key/value/` path pairs,
     so the route is a splat and the pre-filter params (`customerId`,
     `productId`) arrive the same way. */
  const segments = useMemo(() => parseGridSegments(params['*']), [params])

  const rows = useMemo(() => {
    let all = getReviews(state)
    if (pendingOnly) all = all.filter(r => Number(r.status_id) === 2)
    if (segments.customerId) all = all.filter(r => String(r.customer_id) === String(segments.customerId))
    /* PARITY-004: `/admin/review/product/index/productId/<id>/` is the source's
       canonical per-product review set — `entity_pk_value` is the product id. */
    if (segments.productId) all = all.filter(r => String(r.entity_pk_value) === String(segments.productId))
    return all
  }, [state, pendingOnly, segments.customerId, segments.productId])

  /* The source ships exactly two: Delete, and Update Status with its own Status
     select (`assets/html/review-product-index.html`). */
  const massActions = useMemo(() => [
    {
      id: 'delete',
      label: 'Delete',
      onApply: ids => {
        deleteReviews(ids)
        addMessage(`A total of ${ids.length} record(s) have been deleted.`)
      },
    },
    {
      id: 'update_status',
      label: 'Update Status',
      onApply: (ids, { status }) => {
        if (!status) return
        const label = STATUS_OPTIONS.find(o => o.value === String(status))?.label
        const set = new Set(ids.map(Number))
        setState(prev => ({
          ...prev,
          reviews: (prev.reviews || []).map(r => (set.has(Number(r.review_id))
            ? { ...r, status_id: Number(status), status_code: label }
            : r)),
        }))
        addMessage(`A total of ${ids.length} record(s) have been updated.`)
      },
    },
  ], [deleteReviews, setState, addMessage])

  /* F-07 / parity. `New Review` exists only on the full Reviews grid — the
     source's Pending Reviews page-actions toolbar is empty (verified live: its
     only buttons are the grid's Search / Reset Filter / Submit). */
  const actions = pendingOnly ? null : (
    <AdminLink to="/admin/review/product/new/" className="action-default primary" id="add"
      data-ui-id="adminhtml-main-0-add-button">
      <span>New Review</span>
    </AdminLink>
  )

  return (
    <PageShell title={title} actions={actions}>
      <LegacyReviewGrid
        gridId="reviewGrid"
        basePath={pendingOnly ? '/admin/review/product/pending' : '/admin/review/product/index'}
        rows={rows}
        segments={segments}
        ret={pendingOnly ? 'pending' : null}
        massActions={massActions}
        showStatus={!pendingOnly}
        renderCells={(r, ret) => reviewCells(r, ret, !pendingOnly)}
      />
    </PageShell>
  )
}

export function ReviewsIndex() { return <ReviewsGridPage title="Reviews" /> }
export function PendingReviews() { return <ReviewsGridPage title="Pending Reviews" pendingOnly /> }

/**
 * `massUpdateStatus` / `massDelete` are POST targets of the grid's own mass
 * action form in the source (`.../ret/index/` or `.../ret/pending/`). The mock
 * applies the mutation from the Actions control itself, so landing on one of
 * these URLs renders the grid the `ret` segment points back to — the same page
 * the source redirects to once the POST completes.
 */
export function ReviewMassAction() {
  const { ret } = useParams()
  return ret === 'pending' ? <PendingReviews /> : <ReviewsIndex />
}

/* ------------------------------------------------------------ review edit */

/**
 * A deleted (or never-existing) review id must still resolve and render the
 * exact string `Rating isn't Available` — tasks 772-776 assert on it.
 */
export function ReviewEdit() {
  const { id, ret } = useParams()
  const { state, setState, deleteReviews, addMessage } = useApp()
  const navigate = useSidNavigate()
  const review = getReview(state, id)
  const backTo = retPath(ret)

  const [form, setForm] = useState(() => ({
    status_id: String(review?.status_id ?? 1),
    nickname: review?.nickname ?? '',
    title: review?.title ?? '',
    detail: review?.detail ?? '',
    ratings: Object.fromEntries((review?.ratings || []).map(r => [String(r.rating_id), String(r.value)])),
  }))

  useEffect(() => {
    if (!review) return
    setForm({
      status_id: String(review.status_id),
      nickname: review.nickname ?? '',
      title: review.title ?? '',
      detail: review.detail ?? '',
      ratings: Object.fromEntries((review.ratings || []).map(r => [String(r.rating_id), String(r.value)])),
    })
  }, [review?.review_id])

  if (!review) {
    return (
      <PageShell title="Edit Review">
        <div className="entry-edit">
          <fieldset className="admin__fieldset">
            <legend className="admin__legend"><span>Review Details</span></legend>
            <div className="admin__field">
              <span className="admin__field-value">Rating isn&#39;t Available</span>
            </div>
          </fieldset>
        </div>
      </PageShell>
    )
  }

  function save(andBack = true) {
    setState(prev => ({
      ...prev,
      reviews: (prev.reviews || []).map(r => (String(r.review_id) === String(id) ? {
        ...r,
        status_id: Number(form.status_id),
        status_code: reviewStatusLabel(form.status_id),
        nickname: form.nickname,
        title: form.title,
        detail: form.detail,
        ratings: (r.ratings || []).map(x => (form.ratings[String(x.rating_id)] !== undefined
          ? { ...x, value: Number(form.ratings[String(x.rating_id)]), percent: Number(form.ratings[String(x.rating_id)]) * 20 }
          : x)),
      } : r)),
    }))
    addMessage('You saved the review.')
    if (andBack) navigate(backTo)
  }

  function remove() {
    deleteReviews([Number(id)])
    addMessage('The review has been deleted.')
    navigate(backTo)
  }

  /* F-07. Source button set on `/admin/review/product/edit/id/:id/`, id and
     `data-ui-id` measured live:
       back        adminhtml-edit-0-back-button          Back
       reset       adminhtml-edit-0-reset-button         Reset
       delete      adminhtml-edit-0-delete-button        Delete Review
       save_button adminhtml-edit-0-save-button-button   Save Review
     The mock's Save carried `id="save"`, so `page.click('#save_button')` raised. */
  const actions = (
    <>
      <button type="button" id="back" data-ui-id="adminhtml-edit-0-back-button"
        className="action-default scalable back"
        onClick={() => navigate(backTo)}><span>Back</span></button>
      <button type="button" id="reset" data-ui-id="adminhtml-edit-0-reset-button"
        className="action-default scalable"
        onClick={() => setForm({
          status_id: String(review.status_id), nickname: review.nickname, title: review.title,
          detail: review.detail,
          ratings: Object.fromEntries((review.ratings || []).map(r => [String(r.rating_id), String(r.value)])),
        })}><span>Reset</span></button>
      <button type="button" id="delete" data-ui-id="adminhtml-edit-0-delete-button"
        className="action-default scalable delete" onClick={remove}>
        <span>Delete Review</span>
      </button>
      <button type="button" id="save_button" data-ui-id="adminhtml-edit-0-save-button-button"
        className="action-default scalable primary save" onClick={() => save(true)}>
        <span>Save Review</span>
      </button>
    </>
  )

  return (
    <PageShell title="Edit Review" actions={actions}>
      <div className="entry-edit">
        <fieldset className="admin__fieldset" id="review_details">
          <legend className="admin__legend"><span>Review Details</span></legend>

          {/* DOM-004: the source's rating validation carrier, present on every
            * review form next to the star radios. */}
          <input type="hidden" name="validate_rating" className="validate-rating" value=""
            aria-required="true" readOnly />

          <div className="admin__field">
            <span className="admin__field-label"><span>Product</span></span>
            <div className="admin__field-control">
              <AdminLink to={`/admin/catalog/product/edit/id/${review.entity_pk_value}/`}>
                {review.product_name}
              </AdminLink>
              <span className="admin__field-note">SKU: {review.sku}</span>
            </div>
          </div>

          <div className="admin__field">
            <span className="admin__field-label"><span>Posted By</span></span>
            <div className="admin__field-control">
              <span className="admin__field-value">{review.nickname}</span>
            </div>
          </div>

          <div className="admin__field">
            <span className="admin__field-label"><span>Summary Rating</span></span>
            <div className="admin__field-control">
              <span className="admin__field-value rating-summary">
                {review.rating_summary ? `${review.rating_summary} star(s)` : "Rating isn't Available"}
              </span>
            </div>
          </div>

          <div className="admin__field">
            <span className="admin__field-label"><span>Detailed Rating</span></span>
            <div className="admin__field-control">
              {(review.ratings || []).length === 0 ? (
                <span className="admin__field-value">Rating isn&#39;t Available</span>
              ) : (
                <table className="data-grid review-ratings">
                  <thead>
                    <tr>
                      <th />
                      {[1, 2, 3, 4, 5].map(n => <th key={n}>{n}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {(review.ratings || []).map(r => (
                      <tr key={r.rating_id}>
                        <td>{r.rating_code}</td>
                        {[1, 2, 3, 4, 5].map(n => (
                          <td key={n}>
                            <input
                              type="radio"
                              className="admin__control-radio"
                              name={`ratings[${r.rating_id}]`}
                              id={`${r.rating_code}_${n}`}
                              value={ratingOptionId(state.ratings, r.rating_id, n)}
                              aria-required="true"
                              checked={String(form.ratings[String(r.rating_id)]) === String(n)}
                              onChange={() => setForm(f => ({
                                ...f, ratings: { ...f.ratings, [String(r.rating_id)]: String(n) },
                              }))}
                              aria-label={`${r.rating_code} ${n}`}
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="admin__field">
            <label className="admin__field-label" htmlFor="status_id"><span>Status</span></label>
            <div className="admin__field-control">
              <select id="status_id" name="status_id" className="admin__control-select"
                value={form.status_id} onChange={e => setForm(f => ({ ...f, status_id: e.target.value }))}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="admin__field">
            <label className="admin__field-label" htmlFor="nickname"><span>Nickname</span></label>
            <div className="admin__field-control">
              <input id="nickname" name="nickname" type="text" className="admin__control-text"
                value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
            </div>
          </div>

          <div className="admin__field">
            <label className="admin__field-label" htmlFor="title"><span>Summary of Review</span></label>
            <div className="admin__field-control">
              <input id="title" name="title" type="text" className="admin__control-text"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
          </div>

          <div className="admin__field">
            <label className="admin__field-label" htmlFor="detail"><span>Review</span></label>
            <div className="admin__field-control">
              <textarea id="detail" name="detail" rows={8} className="admin__control-textarea"
                value={form.detail} onChange={e => setForm(f => ({ ...f, detail: e.target.value }))} />
            </div>
          </div>
        </fieldset>
      </div>
    </PageShell>
  )
}

/* -------------------------------------------------------------- new review */

/**
 * HANDLERS-025. In the source, `New Review` is a two-step page on ONE URL: a
 * product chooser, and — once a product is picked — the same review form the
 * edit page uses, rendered in its place.
 *
 * The chooser's rows carry `/admin/review/product/jsonProductInfo/id/<id>/` in
 * their `title` attribute, but that is an AJAX endpoint: clicking a row leaves
 * the browser on `/admin/review/product/new/` (verified live — click a row on
 * the source and `location.href` does not change). The mock used to *navigate*
 * to the JSON endpoint, so an evaluator reading the agent's final URL saw an
 * AJAX path where the source shows a page URL. Selection is local state now.
 *
 * `/admin/review/product/jsonProductInfo/id/<id>/` stays routed here, so an
 * agent that types the endpoint still lands on step two.
 */
export function NewReview() {
  const { id } = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()

  const [selectedId, setSelectedId] = useState(null)
  const productId = id || selectedId

  const product = useMemo(
    () => (productId ? S.products.find(p => String(p.entity_id) === String(productId)) : null),
    [productId])

  const ratingDefs = useMemo(
    () => (state?.ratings || []).filter(r => Number(r.is_active) === 1), [state])

  const [form, setForm] = useState({ status_id: '2', nickname: '', title: '', detail: '', ratings: {} })

  /* F-07. Source button set on `/admin/review/product/new/` — present on BOTH
     steps, the product chooser and the review form:
       back         adminhtml-add-0-back-button           Back
       reset_button adminhtml-add-0-reset-button-button   Reset
       save_button  adminhtml-add-0-save-button-button    Save Review
     The mock emitted `#reset` / `#save` and nothing at all on the chooser. */
  const resetForm = () => setForm({ status_id: '2', nickname: '', title: '', detail: '', ratings: {} })
  const formActions = onSave => (
    <>
      <button type="button" id="back" data-ui-id="adminhtml-add-0-back-button"
        className="action-default scalable back"
        onClick={() => navigate('/admin/review/product/new/')}><span>Back</span></button>
      <button type="button" id="reset_button" data-ui-id="adminhtml-add-0-reset-button-button"
        className="action-default scalable" onClick={resetForm}><span>Reset</span></button>
      <button type="button" id="save_button" data-ui-id="adminhtml-add-0-save-button-button"
        className="action-default scalable primary save" onClick={onSave}>
        <span>Save Review</span>
      </button>
    </>
  )

  // Chooser columns verbatim from the source's grid header:
  // ID · Name · SKU · Price · Quantity · Status · Websites.
  const columns = [
    { id: 'entity_id', label: 'ID', filterType: 'text' },
    { id: 'name', label: 'Name', filterType: 'text', searchValue: r => r.name },
    { id: 'sku', label: 'SKU', filterType: 'text', searchValue: r => r.sku },
    {
      id: 'price', label: 'Price', filterType: 'range', sortValue: r => Number(r.price),
      render: r => formatCurrency(r.price), exportValue: r => formatCurrency(r.price),
    },
    {
      id: 'qty', label: 'Quantity', filterType: 'range', sortValue: r => Number(r.qty),
      render: r => String(Math.trunc(Number(r.qty) || 0)),
      exportValue: r => String(Math.trunc(Number(r.qty) || 0)),
    },
    {
      id: 'status', label: 'Status', filterType: 'select',
      options: [{ value: '1', label: 'Enabled' }, { value: '2', label: 'Disabled' }],
      render: r => (Number(r.status) === 1 ? 'Enabled' : 'Disabled'),
      filterValue: r => String(r.status),
      exportValue: r => (Number(r.status) === 1 ? 'Enabled' : 'Disabled'),
    },
    {
      id: 'websites', label: 'Websites', sortable: false, filterType: null,
      render: () => 'Main Website', exportValue: () => 'Main Website',
    },
  ]
  const rows = useMemo(() => S.products, [])

  if (!product) {
    return (
      <PageShell title="New Review" documentTitle="New Review"
        actions={formActions(() => addMessage('Please select a product to review.', 'error'))}>
        <p className="admin__field-note">Please select a product to review.</p>
        <AdminGrid gridId="reviewProductGrid" rows={rows} columns={columns} rowKey={r => r.entity_id}
          exportFileName="review_products"
          onRowClick={r => setSelectedId(r.entity_id)}
          rowTitle={r => `${window.location.origin}/admin/review/product/jsonProductInfo/id/${r.entity_id}/`} />
      </PageShell>
    )
  }

  function save() {
    if (!form.nickname.trim() || !form.title.trim() || !form.detail.trim()) {
      addMessage('This is a required field.', 'error')
      return
    }
    const chosen = ratingDefs
      .filter(rd => form.ratings[String(rd.rating_id)])
      .map(rd => ({
        rating_id: rd.rating_id,
        rating_code: rd.rating_code,
        value: Number(form.ratings[String(rd.rating_id)]),
        percent: Number(form.ratings[String(rd.rating_id)]) * 20,
      }))
    const values = chosen.map(r => r.value)
    const summary = values.length
      ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null

    setState(prev => {
      const list = prev.reviews || []
      const nextId = list.reduce((m, r) => Math.max(m, Number(r.review_id) || 0), 0) + 1
      const record = {
        review_id: nextId,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
        entity_pk_value: product.entity_id,
        status_id: Number(form.status_id),
        status_code: reviewStatusLabel(form.status_id),
        title: form.title,
        detail: form.detail,
        nickname: form.nickname,
        customer_id: null,
        product_name: product.name,
        sku: product.sku,
        rating_summary: summary,
        ratings: chosen,
      }
      return { ...prev, reviews: [...list, record] }
    })
    addMessage('You saved the review.')
    navigate('/admin/review/product/index/')
  }

  return (
    <PageShell title="New Review" documentTitle="New Review" actions={formActions(save)}>
      <div className="entry-edit">
        <fieldset className="admin__fieldset" id="review_details">
          <legend className="admin__legend"><span>Review Details</span></legend>

          {/* DOM-004: the source's rating validation carrier, present on every
            * review form next to the star radios. */}
          <input type="hidden" name="validate_rating" className="validate-rating" value=""
            aria-required="true" readOnly />

          <div className="admin__field">
            <span className="admin__field-label"><span>Product</span></span>
            <div className="admin__field-control">
              <AdminLink to={`/admin/catalog/product/edit/id/${product.entity_id}/`}>{product.name}</AdminLink>
              <span className="admin__field-note">SKU: {product.sku}</span>
            </div>
          </div>

          <div className="admin__field">
            <span className="admin__field-label"><span>Detailed Rating</span></span>
            <div className="admin__field-control">
              <table className="data-grid review-ratings">
                <thead>
                  <tr>
                    <th />
                    {[1, 2, 3, 4, 5].map(n => <th key={n}>{n}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {ratingDefs.map(rd => (
                    <tr key={rd.rating_id}>
                      <td>{rd.rating_code}</td>
                      {[1, 2, 3, 4, 5].map(n => (
                        <td key={n}>
                          <input type="radio" className="admin__control-radio"
                            name={`ratings[${rd.rating_id}]`}
                            id={`${rd.rating_code}_${n}`} aria-required="true"
                            value={ratingOptionId(ratingDefs, rd.rating_id, n)}
                            checked={String(form.ratings[String(rd.rating_id)]) === String(n)}
                            onChange={() => setForm(f => ({
                              ...f, ratings: { ...f.ratings, [String(rd.rating_id)]: String(n) },
                            }))}
                            aria-label={`${rd.rating_code} ${n}`} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="status_id"><span>Status</span></label>
            <div className="admin__field-control">
              <select id="status_id" name="status_id" className="admin__control-select"
                value={form.status_id} onChange={e => setForm(f => ({ ...f, status_id: e.target.value }))}>
                {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          </div>

          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="nickname"><span>Nickname</span></label>
            <div className="admin__field-control">
              <input id="nickname" name="nickname" type="text" className="admin__control-text"
                value={form.nickname} onChange={e => setForm(f => ({ ...f, nickname: e.target.value }))} />
            </div>
          </div>

          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="title"><span>Summary of Review</span></label>
            <div className="admin__field-control">
              <input id="title" name="title" type="text" className="admin__control-text"
                value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
            </div>
          </div>

          <div className="admin__field _required">
            <label className="admin__field-label" htmlFor="detail"><span>Review</span></label>
            <div className="admin__field-control">
              <textarea id="detail" name="detail" rows={8} className="admin__control-textarea"
                value={form.detail} onChange={e => setForm(f => ({ ...f, detail: e.target.value }))} />
            </div>
          </div>
        </fieldset>
      </div>
    </PageShell>
  )
}

/* ----------------------------------------------------------- ratings grid */

export function RatingsGrid() {
  const { state } = useApp()
  const rows = state?.ratings || []
  /* DIFF-R73 / legacy-vs-modern classification. `ratingsGrid` is a LEGACY
   * `Widget\Grid` on the source, not a UI component: 2-row `<thead>` (headers +
   * `tr.data-grid-filters`), `Search` + `Reset Filter`, no Export block.
   * Measured live at `/admin/review/rating/`:
   *   thead row 1  ID · Rating · Sort Order · Is Active
   *   thead row 2  [rating_id] [rating_code] [position] [is_active ▾ Active/Inactive]
   *   `4 records found`, `_ascend` on `col-rating_code`
   * Cell classes taken verbatim from the source `<td data-column=…>`; the row
   * itself carries `title="…/review/rating/edit/id/3/"` and navigates on click —
   * the source puts NO `<a>` inside the Rating cell. */
  const columns = [
    { id: 'rating_id', label: 'ID', className: 'col-id col-rating_id', filter: 'text', numeric: true },
    {
      /* PARITY-008: the source's `<th>` is `Rating`, not `Rating Name`
         (`assets/html/review-rating.html`, `data-column="rating_code"`). */
      id: 'rating_code',
      label: 'Rating',
      className: 'col-rating_code',
      filter: 'text',
      searchValue: r => r.rating_code,
    },
    { id: 'position', label: 'Sort Order', className: 'col-position', filter: 'text', numeric: true },
    {
      /* DIFF-R71: the source's Is Active cell reads `Active` / `Inactive`, not
         `Yes` / `No` — and so do its filter options
         (`#ratingsGrid_filter_is_active` → `"" · 1=Active · 0=Inactive`). */
      id: 'is_active', label: 'Is Active', className: 'col-is_active', filter: 'select',
      options: [{ value: '1', label: 'Active' }, { value: '0', label: 'Inactive' }],
      render: r => (Number(r.is_active) === 1 ? 'Active' : 'Inactive'),
      filterValue: r => String(r.is_active),
      exportValue: r => (Number(r.is_active) === 1 ? 'Active' : 'Inactive'),
    },
  ]
  /* F-07 — source: `<button id="add" data-ui-id="adminhtml-rating-container-add-button">`. */
  const actions = (
    <AdminLink to="/admin/review/rating/new/" className="action-default primary" id="add"
      data-ui-id="adminhtml-rating-container-add-button"><span>Add New Rating</span></AdminLink>
  )
  return (
    <PageShell title="Ratings" actions={actions}>
      {/* DIFF-R71: the source cold-loads sorted by Rating name ascending — its
          `rating_code` header carries `_ascend` — giving
          `3 Price · 1 Quality · 4 Rating · 2 Value`, not id order.
          F-07 — `Add New Rating` is the container's button, so the grid's own
          Reset Filter / Search are `widget-button-1` / `widget-button-2`. */}
      <LegacyGrid gridId="ratingsGrid" basePath="/admin/review/rating/index"
        rows={rows} columns={columns} rowKey={r => r.rating_id}
        rowHref={r => `/admin/review/rating/edit/id/${r.rating_id}/`}
        defaultSort="rating_code" defaultDir="asc" exportable={false}
        widgetButtonIds={{ reset: 'widget-button-1', search: 'widget-button-2' }} />
    </PageShell>
  )
}

/* ------------------------------------------------------------ rating form */

/**
 * PIPELINE-013 — `/admin/review/rating/new/` and `/edit/id/:id/` used to render
 * the grid again, and `state.ratings` had no writer at all.
 *
 * Field labels, legends and button labels transcribed from the live source
 * (`/admin/review/rating/edit/id/1/`): fieldset **Rating Title** with
 * `Default Value` and `Default Store View`, fieldset **Rating Visibility** with
 * `Visibility`, `Is Active` and `Sort Order`; actions
 * `Back · Reset · Delete Rating · Save Rating` (no Delete on New). The page
 * title is the rating's own name on edit, `New Rating` on create.
 */
export function RatingForm() {
  const { id } = useParams()
  const { state, setState, addMessage } = useApp()
  const navigate = useSidNavigate()
  const existing = id ? (state?.ratings || []).find(r => String(r.rating_id) === String(id)) : null
  const backTo = '/admin/review/rating/'

  const initial = {
    rating_code: existing?.rating_code ?? '',
    store_title: existing?.store_title ?? '',
    visibility: existing ? ['1'] : ['1'],
    is_active: String(existing?.is_active ?? 1),
    position: String(existing?.position ?? 0),
  }

  function onSave(form) {
    setState(prev => {
      const list = prev.ratings || []
      if (existing) {
        return {
          ...prev,
          ratings: list.map(r => (String(r.rating_id) === String(existing.rating_id) ? {
            ...r,
            rating_code: form.rating_code,
            store_title: form.store_title || null,
            is_active: Number(form.is_active),
            position: Number(form.position) || 0,
          } : r)),
        }
      }
      const nextId = list.reduce((m, r) => Math.max(m, Number(r.rating_id) || 0), 0) + 1
      const baseOption = list.reduce((m, r) => Math.max(
        m, ...(r.options || []).map(o => Number(o.option_id) || 0)), 0)
      return {
        ...prev,
        ratings: [...list, {
          rating_id: nextId,
          entity_id: 1,
          rating_code: form.rating_code,
          store_title: form.store_title || null,
          position: Number(form.position) || 0,
          is_active: Number(form.is_active),
          options: [1, 2, 3, 4, 5].map(n => ({
            option_id: baseOption + n, rating_id: nextId, code: String(n), value: n, position: n,
          })),
        }],
      }
    })
    addMessage('You saved the rating.')
    navigate(backTo)
  }

  function remove() {
    setState(prev => ({
      ...prev,
      ratings: (prev.ratings || []).filter(r => String(r.rating_id) !== String(id)),
    }))
    addMessage('You deleted the rating.')
    navigate(backTo)
  }

  return (
    <RecordForm
      title={existing ? existing.rating_code : 'New Rating'}
      documentTitle={existing ? existing.rating_code : 'New Rating'}
      backTo={backTo}
      initial={initial}
      saveLabel="Save Rating"
      deleteLabel="Delete Rating"
      /* F-07 — source toolbar stem on `/admin/review/rating/edit/id/:id/`:
         `adminhtml-rating-edit-0-{back,reset,delete,save}-button`. */
      uiPrefix="adminhtml-rating-edit-0"
      onDelete={existing ? remove : null}
      onSave={onSave}
      fieldsets={[
        {
          legend: 'Rating Title',
          fields: [
            { name: 'rating_code', label: 'Default Value', required: true },
            { name: 'store_title', label: 'Default Store View' },
          ],
        },
        {
          legend: 'Rating Visibility',
          fields: [
            {
              name: 'visibility',
              label: 'Visibility',
              type: 'multiselect',
              options: [{ value: '1', label: 'Default Store View' }],
            },
            { name: 'is_active', label: 'Is Active', type: 'checkbox' },
            { name: 'position', label: 'Sort Order' },
          ],
        },
      ]}
    />
  )
}
