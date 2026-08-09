import React from 'react'
import { Navigate } from 'react-router-dom'
import Page from '../components/Page.jsx'
import Listing from '../components/Listing.jsx'
import LayeredNav from '../components/LayeredNav.jsx'
import RelatedSearchTerms from '../components/RelatedSearchTerms.jsx'
import { buildUrl, useUrlBuilder } from '../utils/url.js'
import { useDetailReady, useSearchIndexFor } from '../components/DetailGate.jsx'
import {
  resolveListing, searchNeedsTokenIndex, searchQueryText,
  MIN_QUERY_LENGTH, isBelowMinQueryLength, searchRedirectsHome,
} from '../utils/catalog.js'

/**
 * ROUTES #9 / #10 / #11 — /catalogsearch/result/ and /catalogsearch/result/index/.
 * Both spellings appear in WebArena task URLs and must both resolve.
 *
 * Magento's search here is fuzzy: q=asdfghjkl still returns "1 Item". Captured
 * queries render the source's own ordering and count from listings.json;
 * anything else falls back to token matching over the seed.
 */
export default function SearchPage() {
  const { query, sid } = useUrlBuilder()
  const term = query.q || ''

  /*
   * DIFF-A01 — the two states in which Magento refuses to run the query.
   *
   * `redirectsHome`: `CatalogSearch\Controller\Result\Index` only renders when
   * the trimmed query text is non-empty; otherwise it redirects to
   * `$this->_redirect->getRedirectUrl()`, which with no referer is the store
   * base URL. Live on 2026-08-09, `/catalogsearch/result/?q=`,
   * `/catalogsearch/result/?q=%20%20` and a bare `/catalogsearch/result/` all
   * serve `<title>One Stop Market</title>` — the homepage — not a search page.
   * The source drops the whole query string on that hop; the mock keeps `sid`
   * and nothing else, which is the standard session-isolation carve-out.
   *
   * `belowMin`: 1–2 characters. See the render branch below.
   *
   * Both are decided here but returned *after* every hook has run — a search
   * page stays mounted while the header search box changes `?q=`, so an early
   * return would reorder hooks between renders on the same instance.
   */
  const redirectsHome = searchRedirectsHome(term)
  const belowMin = !redirectsHome && isBelowMinQueryLength(term)
  const refused = redirectsHome || belowMin

  // The source's search layer carries no price filter — `?q=chairs&price=50-100`
  // returns the same `Items 1-12 of 3418` as `?q=chairs`, with no Price chip and
  // no Price option list. So the param is dropped here before the listing is
  // resolved, and LayeredNav is told not to offer it. (Category pages keep it.)
  const { price, ...searchQuery } = query

  /*
   * R7-004 / R8-001. A search page's RESULTS can depend on the description
   * corpus — Magento searches `description` (search_weight 1) alongside name (5)
   * and sku (6), so `searchSeed()` scores it, and painting before it lands would
   * show a short, wrong result set and then swap it out.
   *
   * "Can", not "does", and now: not with the corpus.
   *
   *  - A CAPTURED page renders the source's own ids, count and facet list and
   *    reads the derived pool for nothing. `searchNeedsTokenIndex()`
   *    (utils/catalog.js) is that four-way test, and it is conservative:
   *    anything it cannot answer from the capture still waits.
   *  - An UNCAPTURED page does read the derived pool, but `searchSeed()` now
   *    scores a sharded inverted index of the description text instead of the
   *    text itself. Same predicate, exactly (see SEARCH_INDEX_BUCKETS), at one
   *    or two ~49 kB-gzip buckets rather than 9.35 MB.
   *
   * `?product_list_mode=list` is the one search surface that still needs the
   * corpus itself — it prints one description line per tile
   * (ProductGrid.jsx:172) — however the results were derived. Same rule as
   * CategoryPage.jsx.
   */
  //
  // A refused query reads nothing derived, so it also waits for nothing: the
  // notice paints on the first frame, as the source's does.
  const needsPool = !refused && searchNeedsTokenIndex('/catalogsearch/result/', searchQuery)
  const corpusPending = !useDetailReady(
    !refused && query.product_list_mode === 'list' ? ['descriptions'] : null)
  const indexPending = !useSearchIndexFor(needsPool ? term : null)
  const detailPending = corpusPending || indexPending

  const listing = refused
    ? null
    : resolveListing({ path: '/catalogsearch/result/', query: searchQuery, term })

  /*
   * The displayed query is `QueryFactory::getRawQueryText()`, i.e. TRIMMED but
   * not otherwise normalised — interior whitespace runs survive. Live source,
   * 2026-08-09, in `<title>`, `h1 .base` and the `li.item.search` crumb alike:
   *
   *   ?q=%20%20anker+charger%20%20  ->  Search results for: 'anker charger'
   *   ?q=anker++charger             ->  Search results for: 'anker  charger'
   *   ?q=%20screwdriver%23          ->  Search results for: 'screwdriver#'
   *
   * (that last one is the single task `?q=` value with a leading space). No
   * evaluator anchors on a `Search results for: '…'` string, so this changes
   * nothing that is graded — it is here because the source does it.
   */
  const title = `Search results for: '${searchQueryText(term)}'`

  if (redirectsHome) return <Navigate to={buildUrl('/', {}, sid)} replace />

  // PARITY-002 — the source's search crumb carries its own class. Live
  // /catalogsearch/result/?q=usb+wifi:
  //   <li class="item search"><strong>Search results for: &#039;usb wifi&#039;</strong></li>
  const searchBreadcrumbs = [{ label: title, className: 'search' }]

  return (
    <Page
      title={title}
      documentTitle={title}
      breadcrumbs={searchBreadcrumbs}
      sidebar="catalog"
      /*
       * Below the minimum, the source's `.sidebar.sidebar-main` is literally
       * `<div class="sidebar sidebar-main">\n</div>` — the layered nav is gone
       * along with the toolbar and the grid, because `Layer\Category\
       * AvailabilityFlag::canShowOptions()` sees no filter with any item. The
       * `2columns-left` shell itself stays, so the empty rail stays too.
       */
      sidebarTop={belowMin
        ? null
        : <LayeredNav listing={listing} categoryId={null} showPrice={false} />}
      pending={detailPending}
    >
      {belowMin ? (
        /*
         * `Magento_CatalogSearch::result.phtml`, no-results branch, with
         * `Result::getNoResultText()` returning
         * `__('Minimum Search query length is %1', $query->getMinQueryLength())`
         * because `Helper\Data::isMinQueryLength()` is true. Read off the live
         * source at `/catalogsearch/result/?q=ab` on 2026-08-09:
         *
         *   <div class="message notice">
         *     <div>
         *       Minimum Search query length is 3   <dl class="block"> … </dl>
         *     </div>
         *   </div>
         *
         * and nothing else in `.column.main` — no `#toolbar-amount`, no
         * `.products.wrapper`, no pager. `<title>`, `<h1 class="page-title">`
         * and the two breadcrumbs are unchanged from a normal search page,
         * which is why they are not special-cased here.
         */
        <div className="message notice">
          <div>
            {`Minimum Search query length is ${MIN_QUERY_LENGTH}`}
            <RelatedSearchTerms term={term} />
          </div>
        </div>
      ) : listing.totalCount === 0 ? (
        <div className="message notice">
          <div>
            Your search returned no results.
            <RelatedSearchTerms term={term} />
          </div>
        </div>
      ) : (
        <Listing listing={listing} isSearch />
      )}
    </Page>
  )
}
