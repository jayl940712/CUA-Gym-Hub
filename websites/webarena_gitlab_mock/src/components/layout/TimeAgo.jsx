import React from 'react'
import { timeAgo, formatTimeTooltip, isoDateTime } from '../../utils/format.js'

/**
 * <time class="js-timeago" title="Mar 27, 2023 4:22pm PDT"
 *       datetime="2023-03-27T23:22:59Z" …>3 years ago</time>
 *
 * assets/README.md §0.3 — the visible text is computed live against the real
 * clock, never frozen; `title` holds the absolute time.
 */
export default function TimeAgo({ value, className = '', placement = 'bottom' }) {
  if (!value) return null
  return (
    <time
      className={`js-timeago ${className}`.trim()}
      title={formatTimeTooltip(value)}
      dateTime={isoDateTime(value)}
      data-toggle="tooltip"
      data-placement={placement}
      data-container="body"
    >
      {timeAgo(value)}
    </time>
  )
}
