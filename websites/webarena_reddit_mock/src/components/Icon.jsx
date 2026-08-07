import React from 'react'

// Postmill ships icons as an SVG sprite (assets/icons/icons.svg, 48 symbols),
// copied verbatim to public/icons.svg. Default size 16x16.
// _macros/icon.html.twig also emits a 0x0 <img> carrying the alt text for
// screen readers — reproduced here (a data: URI, not a network request).

const BLANK = 'data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%2F%3E'

export default function Icon({ name, alt = null, className = '', altClassName = '' }) {
  const classes = ['icon']
  if (alt) classes.push('icon--with-alt-text')
  if (className) classes.push(className)
  return (
    <span className={classes.join(' ')}>
      {alt && (
        <img src={BLANK} alt={alt} className={`icon__alt ${altClassName}`.trim()}
             aria-hidden="true" width="0" height="0" />
      )}
      <svg width="16" height="16" aria-hidden="true">
        <use xlinkHref={`/icons.svg#${name}`} />
      </svg>
    </span>
  )
}
