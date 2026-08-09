import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import {
  loadCatalogDetail, prefetchDescriptionCorpus, ensureDescriptionsFor,
  productsByUrlKey, productsById, searchNeedsSeedPool, normalizeListingPath,
} from './utils/catalog.js'
import './styles/globals.css'

/**
 * R8-001. The description corpus is 32 code-split shards keyed `id % 32`
 * (utils/catalog.js), and a PDP gates on exactly one of them.
 *
 * If this URL is a PDP, that one shard goes out immediately, ahead of
 * everything the bulk prefetch would otherwise queue in front of it. An RL
 * agent is dropped straight onto arbitrary URLs, which makes the landing route
 * knowable here and nowhere earlier. Both PDP spellings, matching App.jsx:
 *
 *   /<url_key>.html                     ROUTES #5
 *   /catalog/product/view/id/<id>       ROUTES #6
 *
 * Anything else falls through and costs nothing.
 */
function landingProductId() {
  const path = window.location.pathname
  const byId = path.match(/^\/catalog\/product\/view\/id\/(\d+)/)
  if (byId) return productsById.has(Number(byId[1])) ? Number(byId[1]) : null
  const byKey = path.match(/^\/([^/]+)\.html$/)
  if (byKey) {
    const p = productsByUrlKey.get(decodeURIComponent(byKey[1]))
    return p ? p.id : null
  }
  return null
}

const landing = landingProductId()
if (landing != null) ensureDescriptionsFor([landing])

// Kick the code-split detail seeds off before React mounts, so their chunks
// download in parallel with the app shell and with AppProvider's `/state`
// round-trip instead of after it. AppProvider awaits `options` from the same
// promise (see utils/catalog.js) — starting it here only makes the window
// shorter.
loadCatalogDetail()

/**
 * The whole corpus, for the four views that read all of it: the quick-search
 * fallback (`searchSeed` scores descriptions), advanced search's description
 * filters, list-mode tiles, and compare.
 *
 * Those views ask for it themselves on mount, but that is ~500 ms into the
 * boot, and on a cold deep link straight onto one of them that delay lands on
 * top of the transfer instead of overlapping it — measured, an uncaptured
 * search page went from 1 491 ms to 3 507 ms when the prefetch was simply
 * deferred for everyone. So the landing URL decides, exactly as it does for the
 * PDP shard above: a route that is about to read the corpus starts it at t=0,
 * as it always did, and every other route leaves the network free for its own
 * first content and warms the corpus afterwards for later navigations.
 *
 * The `searchNeedsSeedPool` call mirrors SearchPage's own rule so that a
 * CAPTURED term — which renders the source's ids, count and facets and touches
 * the derived pool for nothing — does not pull 9.35 MB it will not read. This
 * is a prefetch hint only: it can be wrong in either direction without changing
 * what renders, because every consumer still gates on its own `ensureDetail`.
 */
function landingNeedsWholeCorpus() {
  const path = normalizeListingPath(window.location.pathname)
  const params = new URLSearchParams(window.location.search)
  if (params.get('product_list_mode') === 'list') return true
  if (path.startsWith('/catalog/product_compare/')) return true
  if (path.startsWith('/catalogsearch/advanced')) return true
  if (path === '/catalogsearch/result/') {
    const query = {}
    for (const [k, v] of params) query[k] = v
    delete query.price   // SearchPage drops it before resolving; the source ignores it
    return searchNeedsSeedPool('/catalogsearch/result/', query)
  }
  return false
}

if (landingNeedsWholeCorpus()) prefetchDescriptionCorpus()
// Otherwise warm it once first content is safely on screen, so a LATER
// client-side navigation into one of those views is instant. A timer rather
// than `requestIdleCallback` because idle can be granted between the seed parse
// and the first paint, which is precisely the window this must stay out of.
else setTimeout(prefetchDescriptionCorpus, 2000)

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
