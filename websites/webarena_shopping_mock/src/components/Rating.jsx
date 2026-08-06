import React from 'react'

/**
 * The source renders five stars as a fixed-width background with an orange
 * foreground clipped to a percentage width, and puts title="73%" on the
 * container. Reproduce the percentage clip rather than rounding to whole stars.
 */
export default function Rating({ percent }) {
  if (percent == null) return null
  const pct = Math.max(0, Math.min(100, Math.round(percent)))
  return (
    <div className="rating-summary">
      <span className="label visually-hidden"><span>Rating</span></span>
      <div className="rating-result" title={`${pct}%`}>
        <span style={{ width: `${pct}%` }}>
          <span className="visually-hidden">{pct}% of 100</span>
        </span>
      </div>
    </div>
  )
}
