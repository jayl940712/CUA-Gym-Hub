import React from 'react'
import Page from '../components/Page.jsx'
import Rating from '../components/Rating.jsx'
import { useApp } from '../context/AppContext.jsx'
import { SLink } from '../utils/url.js'
import { productsById, reviewRatingPercent } from '../utils/catalog.js'
import { shortDate } from '../utils/format.js'
import NotFoundPage from './NotFoundPage.jsx'

/** ROUTES #34 — /review/customer/. Seeded empty; a review written this session appears here. */
export default function MyReviewsPage() {
  const { state } = useApp()
  const rows = [...state.myReviews].sort((a, b) => b.reviewId - a.reviewId)

  return (
    <Page title="My Product Reviews" documentTitle="My Product Reviews" sidebar="account">
      {rows.length === 0 ? (
        <div className="message info empty"><div><span>You have submitted no reviews.</span></div></div>
      ) : (
        <table className="data table table-reviews" id="my-reviews-table">
          <caption className="table-caption visually-hidden">Product Reviews</caption>
          <thead>
            <tr>
              <th scope="col" className="col date">Created</th>
              <th scope="col" className="col item">Product Name</th>
              <th scope="col" className="col rating">Rating</th>
              <th scope="col" className="col description">Review</th>
              <th scope="col" className="col actions">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => {
              const product = productsById.get(r.productId)
              return (
                <tr key={r.reviewId}>
                  <td className="col date" data-th="Created">{shortDate(r.createdAt)}</td>
                  <td className="col item" data-th="Product Name">
                    <SLink to={product ? `/${product.urlKey}.html` : '/review/customer/'}>
                      {product ? product.name : r.productId}
                    </SLink>
                  </td>
                  <td className="col rating" data-th="Rating"><Rating percent={reviewRatingPercent(r)} variant="review" /></td>
                  <td className="col description" data-th="Review">{r.detail}</td>
                  <td className="col actions">
                    <SLink className="action more" to={`/review/customer/view/id/${r.reviewId}/`}>
                      <span>See Details</span>
                    </SLink>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <div className="actions-toolbar">
        <div className="secondary">
          <SLink to="/" className="action back"><span>Back</span></SLink>
        </div>
      </div>
    </Page>
  )
}

/** ROUTES #35 — /review/customer/view/id/:reviewId/ */
export function ReviewViewPage({ reviewId }) {
  const { state } = useApp()
  const review = state.myReviews.find(r => String(r.reviewId) === String(reviewId))
  if (!review) return <NotFoundPage />
  const product = productsById.get(review.productId)

  return (
    <Page title="Review Details" documentTitle="Review Details" sidebar="account">
      <div className="product-review">
        <div className="product-name">
          <strong>
            <SLink to={product ? `/${product.urlKey}.html` : '/review/customer/'}>
              {product ? product.name : review.productId}
            </SLink>
          </strong>
        </div>
        <div className="review-ratings" style={{ margin: '15px 0' }}>
          {/* the `review` variant supplies `<span class="label rating-label">` itself */}
          <Rating percent={reviewRatingPercent(review)} variant="review" />
        </div>
        <div className="review-title"><strong>{review.title}</strong></div>
        <div className="review-content">{review.detail}</div>
        <div className="review-date">
          <span className="review-details-label">Submitted on </span>
          <time>{shortDate(review.createdAt)}</time>
        </div>
      </div>
      <div className="actions-toolbar">
        <SLink to="/review/customer/" className="action back"><span>Back to My Reviews</span></SLink>
      </div>
    </Page>
  )
}
