import products from '../data/products.json'
import categories from '../data/categories.json'
import reviews from '../data/reviews.json'
import productOptions from '../data/productOptions.json'
import descriptions from '../data/productDescriptions.json'
import listings from '../data/listings.json'
import homepage from '../data/homepage.json'
import searchTerms from '../data/searchTerms.json'
import storeConfig from '../data/storeConfig.json'

export { products, categories, reviews, productOptions, descriptions, listings, homepage, searchTerms, storeConfig }

/* ------------------------------------------------------------------ */
/* Product indexes                                                     */
/* ------------------------------------------------------------------ */

export const productsById = new Map(products.map(p => [p.id, p]))
export const productsByUrlKey = new Map(products.map(p => [p.urlKey, p]))
export const productsBySku = new Map(products.map(p => [p.sku, p]))

export function getProduct(id) {
  return productsById.get(Number(id)) || null
}

export function getProductByUrlKey(key) {
  return productsByUrlKey.get(key) || null
}

// status 1 = enabled, visibility >= 4 = "Catalog, Search"
export function isListable(p) {
  return !!p && p.status === 1 && p.visibility >= 4
}

export function finalPrice(p) {
  return p.specialPrice != null ? p.specialPrice : p.price
}

// Magento's option collection orders by sort_order ASC, title ASC — which is
// why the topiary PDP renders "Color" above "Size" even though Size has the
// lower option_id.
export function getOptions(productId) {
  const groups = productOptions[String(productId)] || []
  return [...groups].sort((a, b) =>
    (a.sortOrder - b.sortOrder) || a.title.localeCompare(b.title) || a.optionId - b.optionId)
}

export function getDescription(productId) {
  return descriptions[String(productId)] || ''
}

/* ------------------------------------------------------------------ */
/* Category indexes                                                    */
/* ------------------------------------------------------------------ */

export const categoriesById = new Map(categories.map(c => [c.id, c]))
export const categoriesByUrlPath = new Map(categories.map(c => [c.urlPath, c]))

export const topCategories = categories
  .filter(c => c.level === 2 && c.includeInMenu && c.isActive)
  .sort((a, b) => a.position - b.position)

const childIndex = new Map()
for (const c of categories) {
  if (!childIndex.has(c.parentId)) childIndex.set(c.parentId, [])
  childIndex.get(c.parentId).push(c)
}
for (const list of childIndex.values()) list.sort((a, b) => a.position - b.position)

export function childrenOf(categoryId) {
  return (childIndex.get(categoryId) || []).filter(c => c.isActive && c.includeInMenu)
}

export function getCategory(id) {
  return categoriesById.get(Number(id)) || null
}

export function getCategoryByUrlPath(urlPath) {
  return categoriesByUrlPath.get(urlPath) || null
}

export function categoryUrl(cat) {
  return `/${cat.urlPath}.html`
}

// Home > Electronics > Headphones — every ancestor up to (not including) the
// two catalog roots (id 1 "Root Catalog", id 2 "Default Category").
export function categoryAncestors(cat) {
  const chain = []
  let cur = cat
  const guard = new Set()
  while (cur && !guard.has(cur.id)) {
    guard.add(cur.id)
    chain.unshift(cur)
    cur = categoriesById.get(cur.parentId) || null
  }
  return chain
}

// Every descendant id (inclusive) — a product in a leaf counts toward its
// ancestors, which is how Magento's anchor categories behave.
const descendantCache = new Map()
export function descendantIds(categoryId) {
  const key = Number(categoryId)
  if (descendantCache.has(key)) return descendantCache.get(key)
  const out = new Set([key])
  const stack = [key]
  while (stack.length) {
    const id = stack.pop()
    for (const child of childIndex.get(id) || []) {
      if (!out.has(child.id)) {
        out.add(child.id)
        stack.push(child.id)
      }
    }
  }
  descendantCache.set(key, out)
  return out
}

/* ------------------------------------------------------------------ */
/* Reviews                                                             */
/* ------------------------------------------------------------------ */

const reviewIndex = new Map()
for (const r of reviews) {
  if (!reviewIndex.has(r.productId)) reviewIndex.set(r.productId, [])
  reviewIndex.get(r.productId).push(r)
}
for (const list of reviewIndex.values()) {
  list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
}

export function seededReviews(productId) {
  return reviewIndex.get(Number(productId)) || []
}

/**
 * Seeded reviews plus anything submitted during this session, newest first.
 * `myReviews` lives in session state so a review written during a rollout
 * shows up on the PDP and on /review/customer/.
 */
export function reviewsForProduct(productId, myReviews = []) {
  const mine = (myReviews || []).filter(r => Number(r.productId) === Number(productId))
  return [...mine, ...seededReviews(productId)]
}

export function ratingPercent(product, myReviews = []) {
  const mine = (myReviews || []).filter(r => Number(r.productId) === Number(product.id))
  if (product.ratingSummary != null && mine.length === 0) return product.ratingSummary
  const seeded = product.ratingSummary != null && product.reviewsCount
    ? [{ pct: product.ratingSummary, n: product.reviewsCount }]
    : []
  let total = 0
  let count = 0
  for (const s of seeded) { total += s.pct * s.n; count += s.n }
  for (const r of mine) { total += r.rating * 20; count += 1 }
  if (!count) return null
  return Math.round(total / count)
}

/**
 * 18 of the 3 080 seeded reviews carry `rating: null` (real source data —
 * review 276363 on product 6532, etc.). The source omits the whole Rating row
 * for those; verified against /review/product/listAjax/id/6532/. Guard here
 * because `null * 20` is 0 in JS, which would render an explicit empty-star row.
 */
export function reviewRatingPercent(review) {
  return review && review.rating != null ? review.rating * 20 : null
}

/**
 * Grid tiles print `products[].reviewsCount`, Magento's `review_entity_summary`
 * aggregate. That table is stale on this container relative to the `review`
 * table, and the source reproduces the discrepancy: the tile for product 89814
 * says "9 Reviews" while its PDP tab says "Reviews (10)". Keep the two apart —
 * this is the tile/summary number.
 */
export function reviewCount(product, myReviews = []) {
  const mine = (myReviews || []).filter(r => Number(r.productId) === Number(product.id))
  const base = product.reviewsCount || 0
  return base + mine.length
}

/* ------------------------------------------------------------------ */
/* Captured listings (source ground truth)                             */
/* ------------------------------------------------------------------ */

// Params that change *which* products come back. Sort direction/order do not
// change the count; page size and page do not change the result set.
const FILTER_PARAMS = ['q', 'cat', 'price']
const ORDER_PARAMS = ['product_list_order', 'product_list_dir']
const PAGE_PARAMS = ['p', 'product_list_limit']

export function normalizeListingPath(path) {
  // /catalogsearch/result/index/ and /catalogsearch/result/ are the same page;
  // WebArena task URLs use both spellings.
  let p = path
  if (p === '/catalogsearch/result/index' || p === '/catalogsearch/result/index/') return '/catalogsearch/result/'
  if (p === '/catalogsearch/result') return '/catalogsearch/result/'
  if (p === '/catalogsearch/advanced') return '/catalogsearch/advanced/'
  return p
}

function listingKey(path, query, keys) {
  const parts = []
  for (const k of keys) {
    const v = query[k]
    if (v !== undefined && v !== null && v !== '') parts.push(`${k}=${v}`)
  }
  parts.sort()
  return normalizeListingPath(path) + '?' + parts.join('&')
}

const ALL_KEYS = [...FILTER_PARAMS, ...ORDER_PARAMS, ...PAGE_PARAMS]

const exactIndex = new Map()
const anchorIndex = new Map()
// Every facet option in a captured listing advertises both the URL it links to
// and the source's own count for that URL. Most of those URLs were never
// captured themselves, so without this index clicking a facet lands on a page
// whose toolbar count is derived from the 1 105-product seed and contradicts
// the number the sidebar just showed. Keyed the same way as anchorIndex, so a
// real capture always wins.
const facetCountIndex = new Map()

// Captured hrefs are the source's raw attribute values, so a stacked facet
// link arrives as `?cat=144&amp;price=0-10,0-100`. Left encoded, the separator
// parses as a parameter named `amp;price` and the filter silently disappears.
function unescapeHref(href) {
  return String(href || '')
    .replace(/&amp;/g, '&')
    .replace(/&#0?38;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
}

function splitHref(href) {
  const [rawPath, qs] = unescapeHref(href).split('?')
  const query = {}
  for (const pair of (qs || '').split('&')) {
    if (!pair) continue
    const i = pair.indexOf('=')
    const k = decodeURIComponent(i < 0 ? pair : pair.slice(0, i))
    const v = decodeURIComponent((i < 0 ? '' : pair.slice(i + 1)).replace(/\+/g, ' '))
    query[k] = v
  }
  return { path: rawPath, query }
}

for (const l of listings) {
  exactIndex.set(listingKey(l.path, l.query, ALL_KEYS), l)
  const ak = listingKey(l.path, l.query, FILTER_PARAMS)
  // Prefer the plainest capture (fewest query params) as the count anchor.
  const prev = anchorIndex.get(ak)
  if (!prev || Object.keys(l.query).length < Object.keys(prev.query).length) {
    anchorIndex.set(ak, l)
  }
  for (const f of l.filters || []) {
    for (const o of f.options || []) {
      if (!o.href || typeof o.count !== 'number') continue
      const { path, query } = splitHref(o.href)
      // The facet href is relative to the store root and carries the full
      // resulting filter state, including any filter already active.
      const key = listingKey(path || l.path, { ...l.query, ...query }, FILTER_PARAMS)
      if (!facetCountIndex.has(key)) facetCountIndex.set(key, o.count)
    }
  }
}

export function capturedListing(path, query) {
  return exactIndex.get(listingKey(path, query, ALL_KEYS)) || null
}

export function capturedAnchor(path, query) {
  return anchorIndex.get(listingKey(path, query, FILTER_PARAMS)) || null
}

/**
 * The source's count for a filter combination that was never captured itself
 * but is advertised by a captured page's facet block. Returns null when no
 * captured facet describes this URL.
 */
export function capturedFacetCount(path, query) {
  const n = facetCountIndex.get(listingKey(path, query, FILTER_PARAMS))
  return n === undefined ? null : n
}

/* ------------------------------------------------------------------ */
/* Client-side listing resolution                                      */
/* ------------------------------------------------------------------ */

// price=0-10,0-100 stacks: Magento intersects the buckets, so the narrowest
// one wins and the "Now Shopping by" chip shows only that bucket.
export function parsePriceParam(raw) {
  if (!raw) return null
  const buckets = String(raw).split(',').map(s => s.trim()).filter(Boolean)
  let lo = -Infinity
  let hi = Infinity
  for (const b of buckets) {
    const [a, z] = b.split('-')
    const from = a === '' || a === undefined ? -Infinity : Number(a)
    const to = z === '' || z === undefined ? Infinity : Number(z)
    if (!isNaN(from) && from > lo) lo = from
    if (!isNaN(to) && to < hi) hi = to
  }
  if (lo === -Infinity && hi === Infinity) return null
  return { from: lo, to: hi, raw: String(raw) }
}

export function priceBucketLabel(range) {
  if (!range) return ''
  const fmt = n => `$${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  if (range.to === Infinity) return `${fmt(range.from)} and above`
  // Magento labels a 0-100 bucket as "$0.00 - $99.99".
  return `${fmt(range.from)} - ${fmt(range.to - 0.01)}`
}

function tokenize(s) {
  return String(s || '').toLowerCase().split(/[^a-z0-9]+/i).filter(Boolean)
}

/* ---- fallback quick-search matcher (Magento/Elasticsearch semantics) ------ */

/**
 * Magento's default English stopword list, read verbatim out of the container:
 * `vendor/magento/module-elasticsearch/etc/stopwords/stopwords_en_US.csv`.
 */
const SEARCH_STOPWORDS = new Set(
  ('a an and are as at be but by for if in into is it no not of on or s such t ' +
   'that the their then there these they this to was will with').split(' '))

/**
 * Attributes with `is_searchable = 1` and their `search_weight`, from
 *   SELECT attribute_code, search_weight FROM catalog_eav_attribute …
 * on the container: sku 6, name 5, description 1, short_description 1,
 * url_key 1, manufacturer 1, color 1. The seed carries name/sku/urlKey and the
 * full description, so the fallback scores those two tiers.
 */
const W_STRONG = 5   // name + sku + url_key
const W_WEAK = 1     // description

/**
 * Approximation of Elasticsearch's `snowball` English stemmer for the only case
 * that measurably matters on this catalog — plurals. Verified on the source:
 *   ?q=candle → 973   ?q=candles → 973      (identical)
 *   ?q=headphone → 1864   ?q=headphones → 1865
 */
function stemToken(t) {
  if (t.length > 4 && t.endsWith('ies')) return t.slice(0, -3) + 'y'
  if (t.length > 4 && /(ches|shes|sses|xes|zes)$/.test(t)) return t.slice(0, -2)
  if (t.length > 3 && t.endsWith('s') && !t.endsWith('ss') && !t.endsWith('us')) return t.slice(0, -1)
  return t
}

/**
 * Word-boundary matcher for one query token, tolerating the plural form.
 * This is the fix for DIFF-102: the previous matcher used `String.includes`,
 * so `hair` matched *c-hair* and the results for `hair dryer` were furniture.
 * The source proves the boundary is real: ?q=hair → 8441 but ?q=chair → 3420,
 * two disjoint result sets.
 */
function tokenMatcher(token) {
  const stem = stemToken(token)
  const esc = stem.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${esc}(?:s|es|ies)?\\b`, 'i')
}

// Lazily-built lowercase corpus: one strong field (name/sku/url key) and one
// weak field (the description, tags stripped) per listable product.
let searchCorpus = null
function buildSearchCorpus() {
  if (searchCorpus) return searchCorpus
  searchCorpus = []
  for (const p of products) {
    if (!isListable(p)) continue
    const urlWords = String(p.urlKey || '').replace(/-/g, ' ')
    const desc = descriptions[String(p.id)] || ''
    searchCorpus.push({
      p,
      strong: `${p.name} ${p.sku} ${urlWords}`.toLowerCase(),
      weak: desc.replace(/<[^>]*>/g, ' ').toLowerCase(),
    })
  }
  return searchCorpus
}

const searchCache = new Map()

/**
 * Fallback quick search over the seeded sample, for terms that were never
 * captured from the source.
 *
 * Semantics copied from the container (all counts observed live 2026-08-05):
 *  - OR across tokens: ?q=hair 8441, ?q=dryer 1096, ?q=hair+dryer 9037 — the
 *    union, not the intersection.
 *  - word-boundary tokens, not substrings: ?q=hair 8441 vs ?q=chair 3420.
 *  - plural-insensitive: ?q=candle == ?q=candles == 973.
 *  - case-insensitive: ?q=B091BB3B86 == ?q=b091bb3b86 == 1 Item.
 *  - the description is searchable (search_weight 1) alongside name (5) and
 *    sku (6), which is why a two-word query can return five figures of results.
 *
 * ⚠️ The *count* still cannot match the source: the seed holds 1 105 of the
 * container's 104 368 products, so an uncaptured term returns roughly 1 % of
 * the source's hits. That is a declared gap in SOURCE.md, not something this
 * function should paper over — it never invents a count it did not observe.
 * Captured terms bypass this entirely (see `capturedListing`).
 */
export function searchSeed(term) {
  const key = String(term || '').toLowerCase().trim()
  if (searchCache.has(key)) return searchCache.get(key)

  const raw = tokenize(term)
  if (!raw.length) return []
  // Magento drops stopwords, but a query made *entirely* of them still runs.
  const kept = raw.filter(t => !SEARCH_STOPWORDS.has(t))
  const tokens = kept.length ? kept : raw
  const matchers = tokens.map(tokenMatcher)

  const scored = []
  for (const entry of buildSearchCorpus()) {
    let score = 0
    for (const re of matchers) {
      if (re.test(entry.strong)) score += W_STRONG
      else if (entry.weak && re.test(entry.weak)) score += W_WEAK
    }
    if (score > 0) scored.push({ p: entry.p, score })
  }
  scored.sort((a, b) => b.score - a.score || a.p.id - b.p.id)
  const out = scored.map(s => s.p)
  searchCache.set(key, out)
  return out
}

/**
 * `naturalDir` is the direction in which the seed pool is already ordered for
 * the unsortable pseudo-attributes (`position`, `relevance`). Category pages
 * hold position ascending, so their natural direction is `asc`. Search result
 * pages hold relevance best-first, which Magento labels *descending* — see
 * `defaultListDir()`. Passing it in keeps "no reversal" tied to the page's own
 * default rather than to the literal string `asc`.
 */
export function sortProducts(list, order, dir, naturalDir = 'asc') {
  const sorted = [...list]
  const sign = dir === 'desc' ? -1 : 1
  if (order === 'name') {
    sorted.sort((a, b) => sign * a.name.localeCompare(b.name))
  } else if (order === 'price') {
    sorted.sort((a, b) => sign * (finalPrice(a) - finalPrice(b)) || a.id - b.id)
  } else if (order === 'position' || order === 'relevance' || !order) {
    if (dir !== naturalDir) sorted.reverse()
  }
  return sorted
}

/**
 * Magento's default sort direction is a property of the *page*, not of the
 * chosen attribute. `/catalogsearch/result/` defaults to descending — verified
 * on the source, logged in:
 *
 *   /catalogsearch/result/?q=headphones                       → sort-desc, "Set Ascending Direction"
 *   /catalogsearch/result/?q=headphones&product_list_order=price
 *                                                             → sort-desc, prices $17,774.32 … descending
 *   /catalogsearch/result/?q=headphones&product_list_dir=asc  → sort-asc,  "Set Descending Direction"
 *   /electronics/headphones.html                              → sort-asc,  "Set Descending Direction"
 *   /catalogsearch/advanced/result/?name=headphones           → sort-asc,  "Set Descending Direction"
 *
 * so only the quick-search result page flips, and it flips for every sort
 * attribute, not just relevance.
 */
export function defaultListDir({ isQuickSearch }) {
  return isQuickSearch ? 'desc' : 'asc'
}

/**
 * Resolve a category/search listing.
 *
 * Priority:
 *  1. an exact captured listing for this path + query → source ordering and count
 *  2. a captured listing with the same filters → source count, seed ordering
 *  3. pure seed derivation
 *
 * Captured listings only cover page 1 of most URLs (plus page 2 for Headphones,
 * Video Games and q=usb wifi). Deeper pages are synthesised from the seeded
 * pool and are documented in SOURCE.md as not matching the source item for item.
 */
export function resolveListing({ path, query, categoryId, term }) {
  const order = query.product_list_order || null
  const dir = query.product_list_dir || null
  const limit = clampLimit(query.product_list_limit)
  const page = Math.max(1, parseInt(query.p, 10) || 1)

  // ---- build the seed pool -------------------------------------------------
  let pool
  if (term != null) {
    pool = searchSeed(term)
  } else if (categoryId != null) {
    const ids = descendantIds(categoryId)
    pool = products.filter(p => isListable(p) && p.categoryIds.some(c => ids.has(c)))
  } else {
    pool = products.filter(isListable)
  }

  // ?cat=<id> narrows the current listing to a descendant category
  if (query.cat) {
    const ids = descendantIds(query.cat)
    pool = pool.filter(p => p.categoryIds.some(c => ids.has(c)))
  }

  const range = parsePriceParam(query.price)
  if (range) {
    pool = pool.filter(p => {
      const v = finalPrice(p)
      return v >= range.from && v < (range.to === Infinity ? Infinity : range.to)
    })
  }

  const defaultOrder = term != null
    ? (storeConfig.defaultSearchSortBy || 'relevance')
    : (storeConfig.defaultSortBy || 'position')
  const defaultDir = defaultListDir({ isQuickSearch: term != null })
  const effectiveDir = dir || defaultDir
  pool = sortProducts(pool, order || defaultOrder, effectiveDir, defaultDir)

  // ---- reconcile with the captured source ---------------------------------
  const exact = capturedListing(path, query)
  const anchor = capturedAnchor(path, query)

  let totalCount = pool.length
  const facetCount = anchor ? null : capturedFacetCount(path, query)
  if (anchor) {
    // A captured page with no matches renders no toolbar at all, so the capture
    // has `totalCount: 0` (see capture_listings.py's `empty` detection). Guard
    // the null that older build_seed.py output produced for the same pages.
    totalCount = anchor.totalCount == null
      ? (anchor.productIds && anchor.productIds.length ? pool.length : 0)
      : anchor.totalCount
  } else if (facetCount != null) totalCount = facetCount
  else if (categoryId != null && !query.cat && !query.price && term == null) {
    const cat = getCategory(categoryId)
    if (cat) totalCount = cat.dbProductCount
  }

  const offset = (page - 1) * limit
  let items
  if (exact) {
    // The capture records the source's real page-1 ids, but the seed is a
    // 1 105-product sample of a 104 368-product catalog, so a captured page can
    // name products the sample does not hold. Show every captured product that
    // *is* seeded, in the source's order, then top the page up from the derived
    // pool rather than rendering "Items 1-12 of 9037" over an empty grid.
    // Nothing is invented — the filler rows are real seeded products that match
    // the same filters.
    const fromCapture = exact.productIds.map(id => productsById.get(id)).filter(Boolean)
    if (fromCapture.length >= Math.min(limit, totalCount) ||
        fromCapture.length === exact.productIds.length) {
      items = fromCapture
    } else {
      const seen = new Set(fromCapture.map(p => p.id))
      items = fromCapture.concat(pool.filter(p => !seen.has(p.id)))
        .slice(0, Math.min(limit, totalCount || limit))
    }
  } else {
    items = pool.slice(offset, offset + limit)
  }

  const totalPages = Math.max(1, Math.ceil(totalCount / limit))
  const first = totalCount === 0 ? 0 : (page - 1) * limit + 1
  const last = Math.min(page * limit, totalCount)

  return {
    items,
    pool,
    totalCount,
    page,
    limit,
    totalPages,
    first,
    last,
    captured: exact || null,
    anchor: anchor || null,
    order: order || defaultOrder,
    dir: effectiveDir,
    priceRange: range,
  }
}

export function clampLimit(raw) {
  const n = parseInt(raw, 10)
  const allowed = storeConfig.gridPerPageValues || [12, 24, 36]
  if (allowed.includes(n)) return n
  return storeConfig.gridPerPage || 12
}

/**
 * The source's toolbar string. Magento switches on *pagination*, not on the
 * count: a result set that fits on one page reads `N Item` / `N Items`, and
 * only a paginated one reads `Items X-Y of Z`. Verified live at the N == limit
 * boundary — see the block comment on `ToolbarAmount` in components/Toolbar.jsx,
 * which is what actually renders this.
 */
export function toolbarAmount(first, last, total, limit = 12) {
  if (total <= (limit || 12)) return `${total} Item${total === 1 ? '' : 's'}`
  return { first, last, total }
}

/* ------------------------------------------------------------------ */
/* Layered-navigation facets                                           */
/* ------------------------------------------------------------------ */

/**
 * Price buckets are *computed per result set* in Magento, not fixed. Where the
 * source page was captured we copy its buckets verbatim; otherwise we derive
 * $100-wide buckets from the pool, which is Magento's default behaviour.
 */
export function priceFacets(listing, buildHref) {
  // The anchor is keyed on the active filters, so its buckets already describe
  // this exact result set — use them verbatim when we have them.
  const captured = listing.anchor && listing.anchor.filters
    ? listing.anchor.filters.find(f => f.name === 'Price')
    : null
  if (captured) {
    return captured.options.map(o => ({
      label: o.label,
      count: o.count,
      href: buildHref(paramFromCapturedHref(o.href, 'price')),
    }))
  }
  const values = listing.pool.map(finalPrice).filter(v => v != null)
  if (!values.length) return []
  // Magento sizes the bucket to the range of the current result set.
  const span = Math.max(...values) - Math.min(...values)
  const STEPS = [1, 5, 10, 50, 100, 500, 1000, 5000]
  const step = STEPS.find(s => span / s <= 10) || 10000
  const buckets = new Map()
  for (const v of values) {
    const b = Math.floor(v / step) * step
    buckets.set(b, (buckets.get(b) || 0) + 1)
  }
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([from, count], idx, arr) => ({
      label: idx === arr.length - 1 && arr.length > 1
        ? priceBucketLabel({ from, to: Infinity })
        : priceBucketLabel({ from, to: from + step }),
      count,
      href: buildHref(idx === arr.length - 1 && arr.length > 1 ? `${from}-` : `${from}-${from + step}`),
    }))
}

function paramFromCapturedHref(href, name) {
  try {
    const qs = unescapeHref(href).split('?')[1] || ''
    const params = new URLSearchParams(qs)
    return params.get(name) || ''
  } catch (e) {
    return ''
  }
}

/** Child-category facet: label + count + the descendant id to filter by. */
export function categoryFacets(listing, categoryId) {
  const captured = listing.anchor && listing.anchor.filters
    ? listing.anchor.filters.find(f => f.name === 'Category')
    : null
  if (captured) {
    return captured.options.map(o => ({
      label: o.label,
      count: o.count,
      cat: paramFromCapturedHref(o.href, 'cat'),
    }))
  }
  if (categoryId == null) return []
  const kids = childrenOf(categoryId)
  return kids
    .map(c => {
      const ids = descendantIds(c.id)
      const count = listing.pool.filter(p => p.categoryIds.some(x => ids.has(x))).length
      return { label: c.name, count, cat: String(c.id) }
    })
    .filter(f => f.count > 0)
}

/* ------------------------------------------------------------------ */
/* Media                                                               */
/* ------------------------------------------------------------------ */

// Real product JPEGs copied out of the container preserve the source path
// shape, so products.json values resolve unchanged. Served from public/.
export function mediaUrl(suffix) {
  if (!suffix) return null
  return `/media/catalog/product${suffix}`
}
