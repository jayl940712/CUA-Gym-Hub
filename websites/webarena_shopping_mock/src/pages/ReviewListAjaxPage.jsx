import React from 'react'
import Page from '../components/Page.jsx'
import Rating from '../components/Rating.jsx'
import { Pager } from '../components/Toolbar.jsx'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useUrlBuilder } from '../utils/url.js'
import { productsById, reviewsForProduct, reviewRatingPercent } from '../utils/catalog.js'
import { shortDate } from '../utils/format.js'
import NotFoundPage from './NotFoundPage.jsx'

const PER_PAGE = 10

/**
 * ROUTES #7 — /review/product/listAjax/id/:id/
 * On the source this is the XHR fragment the "Reviews (N)" tab loads. The mock
 * renders the reviews inline on the PDP, but the route stays resolvable and
 * shows the same list so a direct hit is not a 404.
 */
export default function ReviewListAjaxPage({ productId }) {
  const { state } = useApp()
  const { query } = useUrlBuilder()
  const product = productsById.get(Number(productId))
  if (!product) return <NotFoundPage />

  const list = reviewsForProduct(product.id, state.myReviews)
  const page = Math.max(1, parseInt(query.p, 10) || 1)
  const totalPages = Math.max(1, Math.ceil(list.length / PER_PAGE))
  const items = list.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <Page
      title="Customer Reviews"
      documentTitle={`${product.name} Reviews`}
      breadcrumbs={[{ label: product.name, to: `/${product.urlKey}.html` }, { label: 'Customer Reviews' }]}
      sidebar="none"
    >
      <ol className="items review-items">
        {items.map(r => (
          <li className="item review-item" key={r.reviewId}>
            <div className="review-title-line">{r.title}</div>
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
          <Pager page={page} totalPages={totalPages} param="p" />
        </div>
      )}
      <div className="actions-toolbar">
        <SLink to={`/${product.urlKey}.html`} className="action back"><span>Back to product</span></SLink>
      </div>
    </Page>
  )
}
