import React from 'react'
import SLink from './SLink.jsx'

// PagerWave cursor pager, verbatim from assets/html/f_news-auth.html.
// The label is literally `More` (nav.more), not "Next".
export default function Pagination({ nextHref }) {
  if (!nextHref) return null
  return (
    <nav className="pagination" role="navigation">
      <ul className="flex flex--guttered unlistify">
        <span className="flex__grow" aria-hidden="true"></span>
        <li className="next">
          <SLink to={nextHref} className="button button--secondary" rel="next">More</SLink>
        </li>
        <span className="flex__grow" aria-hidden="true"></span>
      </ul>
    </nav>
  )
}
