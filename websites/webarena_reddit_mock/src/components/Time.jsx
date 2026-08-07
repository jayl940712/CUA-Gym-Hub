import React from 'react'
import { relativeTime, absoluteDateTime } from '../utils/format.js'

// templates/_macros/time.html.twig + the relative-time Stimulus controller.
// The server renders an absolute timestamp and the controller rewrites it to a
// relative one on connect, so with JS on — which is what an agent sees — the
// text is the relative form ("3 years ago"). datetime keeps the ISO string and
// title keeps the absolute long form.
export default function Time({ iso, className = '' }) {
  if (!iso) return null
  return (
    <time className={className} dateTime={iso} title={absoluteDateTime(iso)}>
      {relativeTime(iso)}
    </time>
  )
}
