import React from 'react'

/**
 * The source renders five stars as a fixed-width grey background with an orange
 * foreground clipped to a percentage width, and puts title="73%" on the
 * container. Reproduce the percentage clip rather than rounding to whole stars.
 *
 * Magento emits THREE different bodies for the same widget, and the difference
 * is visible to an evaluator because `.rating-summary .label` and
 * `.rating-result > span span` are clip-hidden, not `display:none` — both stay
 * in innerText. Captured verbatim from assets/html/:
 *
 *   variant="tile"     (home.html, cat-headphones.html — .product-item)
 *     <span class="label"><span>Rating:</span></span>
 *     <div class="rating-result" title="20%"><span><span>20%</span></span></div>
 *
 *   variant="review"   (reviews-ajax-76525.html — .review-item)
 *     <span class="label rating-label"><span>Rating</span></span>
 *     <div class="rating-result" title="100%">
 *       <meta itemprop="worstRating" content="1"/>
 *       <meta itemprop="bestRating" content="100"/>
 *       <span><span itemprop="ratingValue">100%</span></span></div>
 *
 *   variant="summary"  (product-6s-headphones.html — .product-info-main)
 *     <span class="label"><span>Rating:</span></span>
 *     <div class="rating-result" title="75%"><span><span>
 *       <span itemprop="ratingValue">75</span>% of <span itemprop="bestRating">100</span>
 *     </span></span></div>
 *
 * So `% of 100` appears ONLY in the PDP summary; tiles and review items read a
 * bare `N%`, and only the tile/summary label carries the colon.
 */
export default function Rating({ percent, variant = 'tile' }) {
  if (percent == null) return null
  const pct = Math.max(0, Math.min(100, Math.round(percent)))

  return (
    <div className={variant === 'review' ? 'rating-summary item' : 'rating-summary'}>
      {variant === 'review' ? (
        <span className="label rating-label"><span>Rating</span></span>
      ) : (
        <span className="label"><span>Rating:</span></span>
      )}
      <div className="rating-result" title={`${pct}%`}>
        {variant === 'review' && (
          <>
            <meta itemProp="worstRating" content="1" />
            <meta itemProp="bestRating" content="100" />
          </>
        )}
        <span style={{ width: `${pct}%` }}>
          {variant === 'summary' ? (
            <span>
              <span itemProp="ratingValue">{pct}</span>% of <span itemProp="bestRating">100</span>
            </span>
          ) : variant === 'review' ? (
            <span itemProp="ratingValue">{pct}%</span>
          ) : (
            <span>{pct}%</span>
          )}
        </span>
      </div>
    </div>
  )
}
