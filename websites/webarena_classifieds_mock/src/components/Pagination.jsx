import React from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { indexUrl } from '../utils/urls.js'

/**
 * `.paginate` control. Every class, symbol and visibility rule below was read off
 * the live source (`sCategory=9`, which has 125 pages) at pages 1, 2, 3, 50, 123,
 * 124 and 125, plus a 1-page result set:
 *
 *   page 1    <span class="searchPaginationSelected list-first">1</span> 2 3 > »
 *   page 3    < (list-first) 1 2 [3] 4 5 > »
 *   page 50   « (list-first) < 48 49 [50] 51 52 > »
 *   page 123  « < 121 122 [123] 124 125 > (list-last)
 *   page 125  « < 123 124 [125]
 *   1 page    <span class="searchPaginationSelected list-first">1</span>
 *
 * Rules that fall out of that:
 *   - window is [page-2, page+2] clamped to [1, lastPage]
 *   - `searchPaginationFirst list-first` («) only when the window starts past 1;
 *     otherwise the Prev link (or, on page 1, the selected span) carries `list-first`
 *   - `searchPaginationLast list-last` (») only when the window ends before the
 *     last page; otherwise the Next link carries `list-last`
 *   - the selected span on the LAST page carries no extra class (asymmetric with
 *     page 1 — that is the source's own behaviour, not an oversight here)
 *   - page-1 links omit `iPage` ENTIRELY rather than emitting `iPage=1`
 *   - the control renders even when there is only one page
 *
 * Props:
 *   page      1-based current page
 *   lastPage  1-based last page
 *   params    the other source params to preserve (page=search, sCategory, …)
 */
export default function Pagination({ page, lastPage, params = {} }) {
  const { sid } = useApp()
  if (!lastPage || lastPage < 1) return null

  const href = (p) => indexUrl(p <= 1 ? { ...params, iPage: undefined } : { ...params, iPage: p }, sid)

  const from = Math.max(1, page - 2)
  const to = Math.min(lastPage, page + 2)
  const nums = []
  for (let p = from; p <= to; p++) nums.push(p)

  const showFirst = from > 1
  const showPrev = page > 1
  const showNext = page < lastPage
  const showLast = to < lastPage

  return (
    <div className="paginate">
      <ul>
        {showFirst && (
          <li><Link className="searchPaginationFirst list-first" to={href(1)}>&laquo;</Link></li>
        )}
        {showPrev && (
          <li>
            <Link className={`searchPaginationPrev${showFirst ? '' : ' list-first'}`} to={href(page - 1)}>&lt;</Link>
          </li>
        )}
        {nums.map(p => (
          <li key={p}>
            {p === page
              ? <span className={`searchPaginationSelected${page === 1 ? ' list-first' : ''}`}>{p}</span>
              : <Link className="searchPaginationNonSelected" to={href(p)}>{p}</Link>}
          </li>
        ))}
        {showNext && (
          <li>
            <Link className={`searchPaginationNext${showLast ? '' : ' list-last'}`} to={href(page + 1)}>&gt;</Link>
          </li>
        )}
        {showLast && (
          <li><Link className="searchPaginationLast list-last" to={href(lastPage)}>&raquo;</Link></li>
        )}
      </ul>
    </div>
  )
}
