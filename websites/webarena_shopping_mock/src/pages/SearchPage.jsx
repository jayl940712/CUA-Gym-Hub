import React from 'react'
import Page from '../components/Page.jsx'
import Listing from '../components/Listing.jsx'
import LayeredNav from '../components/LayeredNav.jsx'
import { SLink, useUrlBuilder } from '../utils/url.js'
import { resolveListing, searchTerms } from '../utils/catalog.js'

/**
 * ROUTES #9 / #10 / #11 — /catalogsearch/result/ and /catalogsearch/result/index/.
 * Both spellings appear in WebArena task URLs and must both resolve.
 *
 * Magento's search here is fuzzy: q=asdfghjkl still returns "1 Item". Captured
 * queries render the source's own ordering and count from listings.json;
 * anything else falls back to token matching over the seed.
 */
export default function SearchPage() {
  const { query } = useUrlBuilder()
  const term = query.q || ''
  const listing = resolveListing({ path: '/catalogsearch/result/', query, term })

  const title = `Search results for: '${term}'`

  const related = listing.totalCount === 0
    ? searchTerms.slice(0, 10)
    : []

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
      sidebarTop={<LayeredNav listing={listing} categoryId={null} />}
    >
      {listing.totalCount === 0 ? (
        <>
          <div className="message notice"><div>Your search returned no results.</div></div>
          {related.length > 0 && (
            <div className="block block-related-search">
              <div className="block-title"><strong>Related search terms</strong></div>
              <div className="block-content">
                <ul className="search-terms">
                  {related.map(t => (
                    <li key={t.queryId}>
                      <SLink to="/catalogsearch/result/" params={{ q: t.queryText }}>{t.queryText}</SLink>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      ) : (
        <Listing listing={listing} isSearch />
      )}
    </Page>
  )
}
