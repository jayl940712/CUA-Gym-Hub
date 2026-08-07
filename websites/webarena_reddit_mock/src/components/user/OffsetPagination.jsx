import React from 'react'
import SLink from '../SLink.jsx'

// templates/_includes/pagination.html.twig, "definite" branch — the OFFSET
// pager used by /users, /notifications and the log pages (the submission
// listings use the PagerWave cursor pager in src/components/Pagination.jsx
// instead, whose button reads "More", not "Next").
//
// Window: `max(1, min(current - 3, nbPages - 6)) .. min(current + max(3, 7 - current), nbPages)`
// — transcribed verbatim so page 1 shows 1..7 exactly as the source does.
// Copy keys: nav.previous / nav.next / nav.page_number.

export default function OffsetPagination({ page, pageCount, hrefFor }) {
  if (pageCount <= 1) return null

  const from = Math.max(1, Math.min(page - 3, pageCount - 6))
  const to = Math.min(page + Math.max(3, 7 - page), pageCount)
  const numbers = []
  for (let i = from; i <= to; i++) numbers.push(i)

  const hasPrev = page > 1
  const hasNext = page < pageCount

  return (
    <nav className="pagination" role="navigation">
      <ul className="flex flex--guttered unlistify">
        <span className="flex__grow" aria-hidden="true"></span>

        <li className="previous">
          {hasPrev ? (
            <SLink to={hrefFor(page - 1)} className="button button--secondary" rel="prev">Previous</SLink>
          ) : (
            <button type="button" className="button button--secondary" disabled>Previous</button>
          )}
        </li>

        {numbers.map(i => (
          <li className="no-mobile" key={i}>
            <SLink
              to={hrefFor(i)}
              className={`button ${i === page ? 'button--transparent' : 'button--secondary'}`}
              aria-label={`Page ${i}`}
              // _includes/pagination.html.twig emits
              //   {{ pager.currentPage ? 'aria-current="true"' }}
              // and currentPage is always >= 1, so EVERY numbered link carries
              // aria-current="true". It is a Postmill bug, but it is the
              // source's accessibility tree — verified in
              // assets/html/forums_by_submissions_2.html, where pages 1,2,3,4
              // all carry it. Do not "fix" it to `i === page`.
              aria-current="true"
            >
              {i}
            </SLink>
          </li>
        ))}

        <li className="next">
          {hasNext ? (
            <SLink to={hrefFor(page + 1)} className="button button--secondary" rel="next">Next</SLink>
          ) : (
            <button className="button button--secondary" disabled>Next</button>
          )}
        </li>

        <span className="flex__grow" aria-hidden="true"></span>
      </ul>
    </nav>
  )
}
