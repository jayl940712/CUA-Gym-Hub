import React from 'react'
import SLink from '../SLink.jsx'

// `_includes/pagination.html.twig` in its OFFSET form.
//
// ⚠️ This is NOT the cursor pager used by every submission listing
// (components/Pagination.jsx, label "More"). `/forums`, `/users` and the log
// pages page by an integer path segment instead, and render a full numbered
// control. Transcribed verbatim from assets/html/root-forums.html and
// forums_by_submissions_2.html:
//
//   <nav class="pagination" role="navigation">
//     <ul class="flex flex--guttered unlistify">
//       <span class="flex__grow" aria-hidden="true"></span>
//       <li class="previous"><button … disabled>Previous</button></li>   (page 1)
//       <li class="previous"><a … rel="prev">Previous</a></li>           (page > 1)
//       <li class="no-mobile"><a … aria-label="Page 1" aria-current="true">1</a></li>
//       …
//       <li class="next"><a … rel="next">Next</a></li>
//       <span class="flex__grow" aria-hidden="true"></span>
//     </ul>
//   </nav>
//
// The current page's link carries `button--transparent`, the others
// `button--secondary`. `aria-current="true"` is on every numbered link in the
// source (a Postmill bug); reproduce it rather than "fixing" it.
//
// Copy: nav.previous `Previous`, nav.next `Next`, nav.page_number `Page %number%`.
export default function OffsetPagination({ page, pageCount, hrefFor }) {
  if (pageCount <= 1) return null

  const pages = []
  for (let p = 1; p <= pageCount; p++) pages.push(p)

  return (
    <nav className="pagination" role="navigation">
      <ul className="flex flex--guttered unlistify">
        <span className="flex__grow" aria-hidden="true"></span>

        <li className="previous">
          {page > 1 ? (
            <SLink to={hrefFor(page - 1)} className="button button--secondary" rel="prev">Previous</SLink>
          ) : (
            <button type="button" className="button button--secondary" disabled>Previous</button>
          )}
        </li>

        {pages.map(p => (
          <li className="no-mobile" key={p}>
            <SLink
              to={hrefFor(p)}
              className={`button ${p === page ? 'button--transparent' : 'button--secondary'}`}
              aria-label={`Page ${p}`}
              aria-current="true"
            >
              {p}
            </SLink>
          </li>
        ))}

        <li className="next">
          {page < pageCount ? (
            <SLink to={hrefFor(page + 1)} className="button button--secondary" rel="next">Next</SLink>
          ) : (
            <button type="button" className="button button--secondary" disabled>Next</button>
          )}
        </li>

        <span className="flex__grow" aria-hidden="true"></span>
      </ul>
    </nav>
  )
}
