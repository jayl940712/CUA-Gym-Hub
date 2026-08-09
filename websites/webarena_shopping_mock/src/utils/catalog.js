import products from '../data/products.json'
import categories from '../data/categories.json'
import listings from '../data/listings.json'
import homepage from '../data/homepage.json'
import searchTerms from '../data/searchTerms.json'
import storeConfig from '../data/storeConfig.json'
import reviewCounts from '../data/reviewCounts.json'

/* ------------------------------------------------------------------ */
/* Per-product detail — code-split, loaded once at boot                */
/* ------------------------------------------------------------------ */

/**
 * `productDescriptions.json` (28.9 MB), `productOptions.json` (3.3 MB) and
 * `reviews.json` (2.9 MB) are 35.1 MB of the 43.7 MB seed, and they describe
 * one product at a time. Importing them statically put all three in the single
 * `seed-*.js` chunk that every route had to download, parse and evaluate
 * before React could mount.
 *
 * They are three dynamic chunks, fetched in parallel, kicked off from
 * `main.jsx` before React mounts. The catch is that they are read through
 * *synchronous* accessors (`getOptions`, `getDescription`, `reviewsForProduct`,
 * `searchSeed`), so a view that reads one before it lands renders an empty
 * description or an empty review list for a frame.
 *
 * R7-004: the first fix for that was to await ALL THREE inside `AppProvider`'s
 * boot gate. That is correct but far too broad — it put 15.4 MB gzip on the
 * critical path of every route, including the home page, which reads none of
 * it. Measured cold at 1280x720: 4/4 seed chunks transferred before first
 * content on `/`, on a category page and on a PDP.
 *
 * So the modules are tracked and awaited *individually*:
 *
 *   options       — small (0.35 MB gzip) but read from render paths on every
 *                   listing tile, the reorder sidebar block, the wish list, and
 *                   from the SYNCHRONOUS mutators in AppContext (`addToCart`
 *                   normalises a line's options on write, `reorder` rebuilds
 *                   them from an order). Those mutators cannot suspend without
 *                   becoming async and taking the 117-task checkout flow with
 *                   them, so this one stays in the boot gate.
 *   descriptions  — read by the PDP, compare, list-mode tiles, the advanced
 *                   search description filters, and `searchSeed` (Magento
 *                   searches the description, so an uncaptured search term's
 *                   RESULTS depend on it).
 *   reviews       — read by the PDP review list and /review/product/listAjax.
 *
 * `descriptions` and `reviews` — 13.3 of the 15.4 MB — are awaited by the views
 * that read them, through `<Page needs={[...]}>` (components/Page.jsx), which
 * holds back the page body while keeping the header, footer and chrome on
 * screen. Nothing ever renders a half-populated view, and a cold deep link onto
 * a PDP still paints its description, options and reviews without a reload.
 *
 * `let` + reassignment is deliberate. ES module bindings are live, so the
 * closures below and the `export`s at the bottom of this block all see the
 * installed value without any consumer changing.
 */
let reviews = []
let productOptions = {}
let descriptions = {}

export { products, categories, reviews, productOptions, descriptions, listings, homepage, searchTerms, storeConfig }

/** The three code-split detail seeds, by the name callers ask for them by. */
export const DETAIL_MODULES = ['descriptions', 'options', 'reviews']

/* ---- descriptions: 32 shards keyed `id % 32` ------------------------------ *
 *
 * R8-001. The description corpus is 34.71 MB raw / 9.35 MB gzip, twice the
 * size of anything else in the seed, and it was a single chunk. That is why the
 * PDP could not paint until 4/4 seed chunks had landed (16.88 MB gzip, ~1 450 ms
 * cold): the Details tab is the default pane, so the PDP genuinely needs a
 * description — but it needs exactly ONE of 11 358, and it was downloading all
 * of them.
 *
 * The corpus is now `assets/dumps/build_desc_shards.py`'s 32 files, ~1.1 MB raw
 * / ~0.29 MB gzip each. Two entry points, and they share installs:
 *
 *   ensureDescriptionsFor([id, …])  — the shards those products live in. The
 *                                     PDP's gate. One shard for one PDP.
 *   ensureDetail(['descriptions'])  — all 32, i.e. exactly the old semantics.
 *                                     Search (`searchSeed` scores the corpus),
 *                                     advanced search, list-mode tiles, compare.
 *
 * `descriptions` stays one merged object that shards write into, so
 * `getDescription()` and `buildSearchCorpus()` are untouched and the merged
 * result is byte-identical to the old file (`--check` proves it).
 */
export const DESCRIPTION_SHARDS = 32

// Static glob: Vite needs the import graph at build time, so this cannot be a
// computed `import('../data/descriptions/' + name)`.
const DESC_SHARD_LOADERS = import.meta.glob('../data/descriptions/*.json')

function descShardKey(productId) {
  return `../data/descriptions/d${String(Number(productId) % DESCRIPTION_SHARDS).padStart(2, '0')}.json`
}

const descShardInstalled = new Set()
const descShardPending = new Map()

function loadDescShard(key) {
  if (descShardInstalled.has(key)) return Promise.resolve()
  if (!descShardPending.has(key)) {
    const load = DESC_SHARD_LOADERS[key]
    if (!load) return Promise.resolve()
    const p = load()
      .catch(() => load())
      .then(m => { Object.assign(descriptions, m.default) })
      .catch(err => {
        console.error(`[catalog] description shard "${key}" failed to load; ` +
          'those products will have no description this session', err)
      })
      .then(() => {
        descShardInstalled.add(key)
        if (descShardInstalled.size === Object.keys(DESC_SHARD_LOADERS).length) {
          detailInstalled.add('descriptions')
        }
        detailVersion += 1
        for (const fn of detailListeners) fn()
      })
    descShardPending.set(key, p)
  }
  return descShardPending.get(key)
}

/**
 * Install only the shards the named products live in. Idempotent, never
 * rejects, and shares its promises with `ensureDetail(['descriptions'])`.
 */
export function ensureDescriptionsFor(productIds) {
  const keys = new Set((productIds || []).map(descShardKey))
  return Promise.all([...keys].map(loadDescShard)).then(() => undefined)
}

/** True once every named product's description is in memory. */
export function descriptionsReadyFor(productIds) {
  return (productIds || []).every(id => descShardInstalled.has(descShardKey(id)))
}

/* ---- description search index: 64 shards keyed by token prefix ------------ *
 *
 * R8-001, last row. The PDP and captured search stopped pulling the corpus in
 * round 9; an UNCAPTURED `?q=` search still did, because `searchSeed()` scores
 * raw description text with `\b<stem>(?:s|es|ies)?\b` per query token. That is
 * 9.35 MB gzip to answer a yes/no question about a handful of words.
 *
 * It is also, exactly, a set-membership test — no approximation, no
 * document-side stemming, nothing "close enough":
 *
 *   `stem` is always `[a-z0-9]+` (query tokens come from `tokenize()`, which
 *   splits on `[^a-z0-9]+`, and `stemToken()` only truncates), so the span the
 *   regex matches is itself all word characters, so `\b` fires exactly at the
 *   edges of a maximal `[A-Za-z0-9_]` run. The regex is therefore true IFF the
 *   text holds a maximal word run whose lowercase form is one of four literals:
 *   `stem`, `stem+"s"`, `stem+"es"`, `stem+"ies"`.
 *
 * `_` counts as part of the run on purpose — it is a word character to `\b`
 * even though `tokenize()` treats it as a separator — so "glass_es" does not
 * match `?q=glass` here, and does not on the regex either.
 *
 * So the artifact is an inverted index, `assets/dumps/build_search_index.py`:
 * token -> delta-base36 product ids, split into 64 buckets by a hash of the
 * token's first 3 characters. A query fetches only the buckets its own tokens
 * live in — median 49 kB gzip, worst 125 kB — instead of the whole corpus.
 * All four candidate keys of a stem of length >= 3 share that prefix and land
 * in one bucket; `searchIndexBuckets()` unions the buckets of all four anyway,
 * so a 1- or 2-character stem is correct too, at up to 4 requests.
 *
 * The shards live in `src/searchindex/`, NOT `src/data/`: `vite.config.js`'s
 * `manualChunks` folds everything under `/src/data/` into the always-loaded
 * `seed` chunk unless it has an explicit rule, and 3.2 MB gzip of index in the
 * chunk every route waits on is the regression this index exists to undo.
 */
export const SEARCH_INDEX_BUCKETS = 64
const SEARCH_INDEX_PREFIX = 3

const SEARCH_INDEX_LOADERS = import.meta.glob('../searchindex/*.json')

/** Must stay byte-identical to `bucket_of()` in build_search_index.py. */
function indexBucket(key) {
  let h = 0
  const n = Math.min(key.length, SEARCH_INDEX_PREFIX)
  for (let i = 0; i < n; i++) h = (Math.imul(h, 131) + key.charCodeAt(i)) >>> 0
  return h % SEARCH_INDEX_BUCKETS
}

function indexShardKey(bucket) {
  return `../searchindex/s${String(bucket).padStart(2, '0')}.json`
}

// bucket -> the raw `{token: "<delta base36>"}` object, kept encoded. A bucket
// holds ~1 100 tokens; a query reads at most four of them, so decoding the whole
// bucket on install would be ~1 000x the work for no benefit.
const indexShardData = new Map()
const indexShardInstalled = new Set()
const indexShardPending = new Map()
const postingsCache = new Map()

function loadIndexShard(bucket) {
  if (indexShardInstalled.has(bucket)) return Promise.resolve()
  if (!indexShardPending.has(bucket)) {
    const load = SEARCH_INDEX_LOADERS[indexShardKey(bucket)]
    if (!load) return Promise.resolve()
    const p = load()
      .catch(() => load())
      .then(m => { indexShardData.set(bucket, m.default) })
      .catch(err => {
        console.error(`[catalog] search index shard ${bucket} failed to load; ` +
          'terms in it will match on name/sku only this session', err)
      })
      .then(() => {
        indexShardInstalled.add(bucket)
        // Any result computed before this landed was scored against a partial
        // index. A stale memo here would be silent and permanent.
        postingsCache.clear()
        searchCache.clear()
        detailVersion += 1
        for (const fn of detailListeners) fn()
      })
    indexShardPending.set(bucket, p)
  }
  return indexShardPending.get(bucket)
}

function decodePostings(encoded) {
  const set = new Set()
  let prev = 0
  for (const part of encoded.split('.')) {
    prev += parseInt(part, 36)
    set.add(prev)
  }
  return set
}

/** Product ids whose description holds the exact word `key`. */
function postingsFor(key) {
  if (postingsCache.has(key)) return postingsCache.get(key)
  const shard = indexShardData.get(indexBucket(key))
  const encoded = shard ? shard[key] : undefined
  const set = encoded ? decodePostings(encoded) : null
  postingsCache.set(key, set)
  return set
}

/**
 * The four literals a query token's word-boundary regex can match, in the
 * order the regex would try them. Exported shape is internal; see the block
 * comment above for why these four and only these four.
 */
function candidateKeys(token) {
  const stem = stemToken(token)
  return [stem, `${stem}s`, `${stem}es`, `${stem}ies`]
}

/** Product ids whose DESCRIPTION matches this query token. */
function weakPostings(token) {
  const out = new Set()
  for (const key of candidateKeys(token)) {
    const set = postingsFor(key)
    if (set) for (const id of set) out.add(id)
  }
  return out
}

/** The index buckets a term's tokens need. */
export function searchIndexBuckets(term) {
  const tokens = queryTokens(term)
  const buckets = new Set()
  for (const t of tokens) {
    for (const key of candidateKeys(t)) buckets.add(indexBucket(key))
  }
  return [...buckets]
}

/** True once every bucket this term reads is in memory. */
export function searchIndexReadyFor(term) {
  return searchIndexBuckets(term).every(b => indexShardInstalled.has(b))
}

/** Fetch this term's buckets. Idempotent, never rejects. */
export function ensureSearchIndexFor(term) {
  return Promise.all(searchIndexBuckets(term).map(loadIndexShard)).then(() => undefined)
}

const DETAIL_LOADERS = {
  descriptions: () => Promise.all(
    Object.keys(DESC_SHARD_LOADERS).map(loadDescShard)).then(() => undefined),
  options: () => import('../data/productOptions.json').then(m => {
    productOptions = m.default
  }),
  reviews: () => import('../data/reviews.json').then(m => {
    reviews = m.default
    buildReviewIndex()
  }),
}

const detailInstalled = new Set()
const detailPending = new Map()

/* Subscription so a mounted view re-renders the moment its module lands. */
const detailListeners = new Set()
let detailVersion = 0

export function subscribeCatalogDetail(fn) {
  detailListeners.add(fn)
  return () => detailListeners.delete(fn)
}

/** Bumped once per module install; a cheap snapshot for useSyncExternalStore. */
export function catalogDetailVersion() {
  return detailVersion
}

/** True once every named module is in memory. `[]` is trivially ready. */
export function detailReady(mods) {
  return (mods || []).every(m => detailInstalled.has(m))
}

/** True once all three detail seeds are in memory. */
export function catalogDetailLoaded() {
  return detailReady(DETAIL_MODULES)
}

/**
 * Fetch and install the named detail seeds. Idempotent and safe to call from
 * anywhere — concurrent callers share one promise per module.
 *
 * The returned promise must never reject: `AppProvider`'s boot gate awaits it,
 * and a rejection there would skip `setLoading(false)` and strand every route
 * on "Loading..." permanently, with no way back short of the agent reloading.
 * One retry (chunks are same-origin static files, so the only plausible failure
 * is a transient read), then give up, mark the module installed anyway and
 * resolve — a PDP whose description tab is empty is a bad page an agent can
 * recover from, a page that never paints is not. The console error is the
 * signal.
 */
export function ensureDetail(mods) {
  const list = mods && mods.length ? mods : DETAIL_MODULES
  return Promise.all(list.map(mod => {
    if (detailInstalled.has(mod)) return Promise.resolve()
    if (!detailPending.has(mod)) {
      const load = DETAIL_LOADERS[mod]
      if (!load) return Promise.resolve()
      const p = load()
        .catch(() => load())
        .catch(err => {
          console.error(`[catalog] detail seed "${mod}" failed to load; ` +
            'it will be empty this session', err)
        })
        .then(() => {
          detailInstalled.add(mod)
          detailVersion += 1
          for (const fn of detailListeners) fn()
        })
      detailPending.set(mod, p)
    }
    return detailPending.get(mod)
  })).then(() => undefined)
}

/**
 * Prefetch what every route may want at t=0. `main.jsx` calls this before React
 * mounts so the chunks are in flight from the start — it does NOT gate
 * anything, so a route that needs none of them paints as soon as `/state`
 * answers.
 *
 * R8-001: the description corpus is deliberately NOT in here any more. It is 32
 * shards now, and firing all 32 before React mounts costs more than it saves —
 * measured, not assumed: they filled the browser's ~6 connections and pushed
 * `seed` and `seed-options` back, taking first content on `/`, category, cart
 * and orders from 574/523/536/526 ms to 857/782/827/801 ms and their
 * bytes-before-content from 2.36 MB gzip to 11.97 MB. Every view that reads the
 * whole corpus asks for it itself on mount; `prefetchDescriptionCorpus()` below
 * warms the rest for later navigations, off the first-paint critical path.
 */
export function loadCatalogDetail() {
  return ensureDetail(['options', 'reviews'])
}

/**
 * Warm the whole description corpus once first content is safely on screen, so
 * a LATER client-side navigation to search / advanced search / compare / a
 * list-mode listing does not have to wait for it. Never gates anything; a view
 * that needs the corpus before this fires simply calls
 * `ensureDetail(['descriptions'])` itself and shares these promises.
 */
export function prefetchDescriptionCorpus() {
  return ensureDetail(['descriptions'])
}

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

// status 1 = enabled, visibility >= 4 = "Catalog, Search".
// `inStock` matters because cataloginventory/options/show_out_of_stock has no
// row in the source's core_config_data, so Magento defaults it to 0 and drops
// out-of-stock products from every category listing, search result and price
// index. 261 seeded products are out of stock upstream.
export function isListable(p) {
  return !!p && p.status === 1 && p.visibility >= 4 && p.inStock
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

// Built by loadCatalogDetail() rather than at module scope — `reviews` is an
// empty placeholder until the split chunk lands.
const reviewIndex = new Map()
function buildReviewIndex() {
  reviewIndex.clear()
  for (const r of reviews) {
    if (!reviewIndex.has(r.productId)) reviewIndex.set(r.productId, [])
    reviewIndex.get(r.productId).push(r)
  }
  for (const list of reviewIndex.values()) {
    list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0))
  }
}

export function seededReviews(productId) {
  return reviewIndex.get(Number(productId)) || []
}

/**
 * How many reviews the seed holds for a product — WITHOUT the `reviews` chunk.
 *
 * R8-001. `reviewCounts.json` is 35 KB and rides in the small `seed` chunk that
 * every route already loads; it is a plain `len(group_by(productId))` over
 * `reviews.json` (see `assets/dumps/build_review_counts.py`). It exists so the
 * PDP can print its Reviews tab label — `Math.max(reviewsCount, list length)`,
 * which the source itself renders inconsistently with the summary above it —
 * on its FIRST frame, without waiting for the 5.2 MB-gzip review corpus.
 * 89 products have more seeded reviews than their `review_entity_summary`
 * aggregate declares, so without this the label would tick up when the chunk
 * landed.
 *
 * Once the chunk IS installed the live index wins, so a session that has
 * loaded reviews never disagrees with what it is about to render.
 */
export function seededReviewCount(productId) {
  const id = Number(productId)
  if (detailInstalled.has('reviews')) return (reviewIndex.get(id) || []).length
  return reviewCounts[String(id)] || 0
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

/**
 * R9-001 — the search term as the CAPTURE is keyed on.
 *
 * Magento's search is neither case- nor edge-whitespace-sensitive, and the live
 * source proves both, byte for byte. Same URL, logged in, 2026-08-09:
 *
 *   ?q=Anker charger   Items 1-12 of 2527   B09J4YHB7J B09C5SC9FW B01N0X3NL5 …
 *   ?q=anker charger   Items 1-12 of 2527   ← identical ids, identical order
 *   ?q=ANKER CHARGER   Items 1-12 of 2527   ← identical
 *   ?q=AnKeR ChArGeR   Items 1-12 of 2527   ← identical
 *   ?q=  anker charger    (padded)     Items 1-12 of 2527  ← identical
 *   ?q=anker  charger     (doubled)    Items 1-12 of 2527  ← identical
 *   ?q=anker%0Acharger    (newline)    Items 1-12 of 2527  ← identical
 *
 * The mechanism is two-sided and both sides are in the container:
 *  - `Magento\Search\Model\QueryFactory::getRawQueryText()` does
 *    `cleanString(trim($queryText))`, so the *edges* are stripped before the
 *    query is ever looked up — which is why the `<title>` on `?q=  x  ` reads
 *    `Search results for: 'x'` while `?q=a  b` keeps its inner double space.
 *  - Elasticsearch tokenises on whitespace and lowercases, so interior runs and
 *    casing never reach the result set at all.
 *
 * The seed already agrees: `listings.json` holds captures for BOTH `Amazon
 * basic` and `amazon basic`, and for both `Lays` and ` Lays`, and each pair is
 * identical in `totalCount` and `productIds` (7332 / 830). Normalising the key
 * therefore merges exactly those 2 pairs of the 1 554 captures and loses
 * nothing — 1 554 keys become 1 552, with no data difference between the
 * merged entries.
 *
 * Only `q` is folded. `cat` is an entity id and `price` a numeric range; both
 * are case-free already and lowercasing them would be noise.
 */
function normalizeQueryTerm(v) {
  return String(v).trim().replace(/\s+/g, ' ').toLowerCase()
}

function listingKey(path, query, keys) {
  const parts = []
  for (const k of keys) {
    let v = query[k]
    if (v === undefined || v === null || v === '') continue
    if (k === 'q') {
      v = normalizeQueryTerm(v)
      if (v === '') continue
    }
    parts.push(`${k}=${v}`)
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

/**
 * R8-001 — does a SEARCH listing's rendered output depend on the derived seed
 * pool, and therefore on the description corpus?
 *
 * `searchSeed()` scores `descriptions` (Magento's `description` attribute is
 * searchable at `search_weight` 1, alongside name 5 and sku 6), so
 * `resolveListing({term})` reads the 9.35 MB-gzip chunk unconditionally. That
 * is why `/catalogsearch/result/` sat behind 4/4 chunks — it was the single
 * most expensive thing on the page and it renders none of it.
 *
 * But the pool only reaches the screen through four paths, and a fully
 * captured page takes none of them:
 *
 *   items       — `exact.productIds` verbatim when every captured id is seeded,
 *                 pool only as filler for the ids the 1 105-sample lacks
 *   totalCount  — `anchor.totalCount`, the source's own number, unless it is
 *                 absent
 *   Category    — `anchor.filters[Category]` verbatim, otherwise counted over
 *                 the pool
 *   Price       — never on a search page (`showPrice={false}`, LayeredNav.jsx)
 *
 * So this returns false only when all four are answered by the capture, which
 * is exactly when the page can paint before the corpus lands. It is deliberately
 * conservative: any doubt returns true and the page waits, as it always did.
 * Nothing that renders changes when the chunk later arrives, so there is no
 * frame to flash — the page simply re-renders identically.
 */
export function searchNeedsTokenIndex(path, query) {
  const exact = capturedListing(path, query)
  const anchor = capturedAnchor(path, query)
  if (!exact || !anchor) return true
  if (anchor.totalCount == null) return true
  if (!(exact.productIds || []).length) return true
  if (!exact.productIds.every(id => productsById.has(id))) return true
  if (!(anchor.filters || []).some(f => f.name === 'Category')) return true
  return false
}

/**
 * Does a SEARCH page need the whole description corpus before it can render?
 *
 * Shard Q: no longer, except in list mode. `searchSeed()` reads the sharded
 * token index (see SEARCH_INDEX_BUCKETS) rather than raw description text, so
 * the derived pool — items, `totalCount`, the Category facet — costs kilobytes.
 * `?product_list_mode=list` is the one search surface that still prints a
 * description per tile (ProductGrid.jsx), and that genuinely needs the corpus
 * however the results were derived.
 *
 * The old name is kept because `main.jsx` — which this shard does not own —
 * imports it as its corpus-prefetch hint, and this is exactly the question that
 * hint is asking. `searchNeedsTokenIndex()` above carries the old body, i.e.
 * "does this page read the derived pool at all", which is now a much cheaper
 * question and the one `SearchPage` gates on.
 */
export function searchNeedsDescriptionCorpus(path, query) {
  return !!query && query.product_list_mode === 'list'
}

export { searchNeedsDescriptionCorpus as searchNeedsSeedPool }

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

/* ---- minimum search query length (DIFF-A01) ------------------------------ */

/**
 * `catalog/search/min_query_length`, read out of THIS container rather than
 * inferred from the `Minimum Search query length is 3` message string:
 *
 *   SELECT COUNT(*) FROM core_config_data;                          -> 56
 *   SELECT COUNT(*) FROM core_config_data
 *     WHERE path LIKE 'catalog/search%';                            -> 0
 *   vendor/magento/module-catalog-search/etc/config.xml:
 *     <min_query_length>3</min_query_length>
 *
 * i.e. the deployment carries no override at any scope, so the effective value
 * is the module default, 3. `storeConfig.minQueryLength` is honoured first so a
 * future re-extraction that does capture the row wins without a code change.
 */
export const MIN_QUERY_LENGTH =
  Number.isFinite(Number(storeConfig.minQueryLength)) ? Number(storeConfig.minQueryLength) : 3

/**
 * `Magento\Search\Model\Query::getQueryText()` after
 * `QueryFactory::getRawQueryText()`, which is `cleanString(trim($queryText))`.
 * The *displayed* query keeps its interior whitespace (`?q=a  b` titles as
 * `'a  b'`), so only the edges are stripped here.
 */
export function searchQueryText(raw) {
  return String(raw == null ? '' : raw).trim()
}

/**
 * `Magento\CatalogSearch\Helper\Data::isMinQueryLength()`:
 *
 *   $thisQueryLength = $this->string->strlen($this->getQueryText());
 *   return !$thisQueryLength || ($minQueryLength !== '' && $thisQueryLength < $minQueryLength);
 *
 * `strlen` there is `Framework\Stdlib\StringUtils::strlen`, i.e. `mb_strlen` —
 * code points, not UTF-16 units — hence the spread rather than `.length`.
 *
 * Note the empty case is folded in on the source too, but never reaches the
 * block: the controller redirects an empty `q` away before rendering (see
 * `searchRedirectsHome()`).
 */
export function isBelowMinQueryLength(raw) {
  const text = searchQueryText(raw)
  return [...text].length < MIN_QUERY_LENGTH
}

/**
 * `Magento\CatalogSearch\Controller\Result\Index::execute()` renders the result
 * page only when the trimmed query text is non-empty; otherwise it issues a
 * redirect (`$this->_redirect->getRedirectUrl()`, which with no referer is the
 * store base URL). Confirmed live on 2026-08-09 — `/catalogsearch/result/?q=`,
 * `/catalogsearch/result/` and `/catalogsearch/result/?q=%20%20` all serve the
 * homepage (`<title>One Stop Market</title>`, 166 814 B, no search notice).
 */
export function searchRedirectsHome(raw) {
  return searchQueryText(raw) === ''
}

/**
 * "Related search terms" — `Magento\AdvancedSearch\Block\Recommendations`,
 * rendered by `search_data.phtml` through `Result::getAdditionalHtml()`, which
 * `result.phtml` emits inside the `.message.notice` on BOTH zero-result states
 * (no matches, and below the minimum query length).
 *
 * Reproduced from `AdvancedSearch\Model\ResourceModel\Recommendations`:
 *
 *  1. `$queryWords = [$query]`, plus — only when the query contains a space —
 *     its unique space-split words, dropping any word shorter than 3 chars.
 *  2. `WHERE (query_text LIKE '<word>%' OR …) AND store_id = 1`
 *     `ORDER BY num_results DESC LIMIT <count + 1>`   (count = 5, below)
 *  3. drop the current query's own row, then `array_slice(…, 0, count)`
 *  4. a second `SELECT query_text, num_results WHERE query_id IN (…) AND
 *     num_results > 0` — no ORDER BY, so InnoDB returns primary-key order.
 *
 * Step 4's ordering is not a guess. Live `?q=a` renders, in this order,
 * `apple iphone 11 screen guard`, `apple iphone 7 screen guard`,
 * `apple iphone 11`, `apple iphone 12`, `Anker Quick Charge 3.0 39W Dual`,
 * whose `search_query.query_id`s are 288, 292, 300, 302, 440 — ascending id,
 * NOT the `num_results DESC` (440, 292, 302, 288, 300) that selected them.
 *
 * The prefix match is case-insensitive because `search_query.query_text` is a
 * `utf8_general_ci` column: live `?q=AB` and `?q=ab` both return `abc`, and
 * `?q=Ze` returns `zebra pillow`.
 *
 * `search_recommendations_count` is 5 and
 * `search_recommendations_count_results_enabled` is 0 in
 * `module-advanced-search/etc/config.xml`, with no `core_config_data` override
 * — so five items and no `<span class="count">`, which is what the source
 * renders.
 */
const SEARCH_RECOMMENDATIONS_COUNT = 5

export function relatedSearchTerms(raw) {
  const query = searchQueryText(raw)
  if (!query) return []

  let words = [query]
  if (query.includes(' ')) {
    for (const w of query.split(' ')) {
      const word = w.trim()
      // PHP measures the UNTRIMMED word here (`strlen($word) < 3`), and keeps
      // the trimmed one; splitting on a single space makes the two the same.
      if (word.length >= 3 && !words.includes(word)) words.push(word)
    }
  }
  const prefixes = words.map(w => w.toLowerCase())
  const self = query.toLowerCase()

  const hits = searchTerms.filter(t => {
    const text = String(t.queryText || '').toLowerCase()
    return prefixes.some(pre => text.startsWith(pre))
  })
  // ORDER BY num_results DESC LIMIT count + 1. MySQL leaves ties unordered;
  // queryId ascending keeps this deterministic.
  hits.sort((a, b) => (b.numResults || 0) - (a.numResults || 0) || a.queryId - b.queryId)

  const picked = hits
    .slice(0, SEARCH_RECOMMENDATIONS_COUNT + 1)
    .filter(t => String(t.queryText || '').toLowerCase() !== self)
    .slice(0, SEARCH_RECOMMENDATIONS_COUNT)
    .filter(t => (t.numResults || 0) > 0)

  // The second SELECT has no ORDER BY -> primary-key order.
  return picked.slice().sort((a, b) => a.queryId - b.queryId)
}

/**
 * The query tokens `searchSeed()` scores, in order.
 *
 * Factored out so the gate (`searchIndexBuckets`) and the scorer read the same
 * tokens from the same term — a gate that waited on a different token set than
 * the one being scored would let a search paint against a partial index.
 */
function queryTokens(term) {
  const raw = tokenize(term)
  if (!raw.length) return []
  // Magento drops stopwords, but a query made *entirely* of them still runs.
  const kept = raw.filter(t => !SEARCH_STOPWORDS.has(t))
  return kept.length ? kept : raw
}

// Lazily-built lowercase strong field (name/sku/url key) per listable product.
//
// R8-001: the weak field — the whole description, tags stripped — used to live
// here too, which is what made `searchSeed()` a 9.35 MB-gzip dependency. The
// description side is now the sharded inverted index above, and this corpus
// depends only on `products.json`, which every route already loads. It is
// therefore built once and never invalidated.
let searchCorpus = null
function buildSearchCorpus() {
  if (searchCorpus) return searchCorpus
  searchCorpus = []
  for (const p of products) {
    if (!isListable(p)) continue
    const urlWords = String(p.urlKey || '').replace(/-/g, ' ')
    searchCorpus.push({
      p,
      strong: `${p.name} ${p.sku} ${urlWords}`.toLowerCase(),
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

  const tokens = queryTokens(term)
  if (!tokens.length) return []
  const matchers = tokens.map(tokenMatcher)
  // Same predicate as `matchers[i].test(weakText)`, read out of the index
  // instead of out of 34.71 MB of raw description. See the block comment on
  // SEARCH_INDEX_BUCKETS for why the two are equal rather than similar.
  const weakSets = tokens.map(weakPostings)

  const scored = []
  for (const entry of buildSearchCorpus()) {
    let score = 0
    for (let i = 0; i < matchers.length; i++) {
      if (matchers[i].test(entry.strong)) score += W_STRONG
      else if (weakSets[i].has(entry.p.id)) score += W_WEAK
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

// Magento's store root ("Default Category"). Every top-level department hangs
// off it, and it is the category layer a SEARCH page sits in when no ?cat= has
// been applied.
export const ROOT_CATEGORY_ID = 2

/**
 * Child-category facet: label + count + the descendant id to filter by.
 *
 * BUG-N02: this used to return `[]` whenever `categoryId == null`, which is
 * every search page. Combined with `LayeredNav`'s `hasFacets` guard, the whole
 * `.block.filter` ("Shop By" / "Shopping Options" / "Category") disappeared on
 * any term that was not captured into `listings.json` during recon — so an
 * agent could only narrow a search by category on 105 hard-coded terms and had
 * no control at all on a term it invented.
 *
 * The source derives the layer from the ACTIVE category, and always has one:
 *
 *   /catalogsearch/result/?q=tea            → children of the root, 12 options
 *                                             (Beauty & Personal Care 867 …
 *                                              Grocery & Gourmet Food 1235)
 *   /catalogsearch/result/?q=tea&cat=6      → children of 6, 8 options
 *                                             (Furniture 386 … Bath 7)
 *   /home-kitchen.html                      → children of 6
 *   /home-kitchen.html?cat=34               → children of 34, NOT of 6
 *
 * — ordered by the category tree's own order, counted within the current result
 * set, and with the zero-count children dropped (?q=blanket omits Tools & Home
 * Improvement and Cell Phones, which ?q=tea and ?q=chairs both list).
 *
 * `activeCategoryId` is the `?cat=` filter when one is applied. It wins over
 * the page's own category, which is the last live case above and was also
 * wrong before.
 *
 * The counts are seed-scale rather than source-scale — the seed is a sample of
 * the container's catalog — which is the same declared gap the toolbar count on
 * the same page already carries. Captured pages still render the source's own
 * facet list and counts verbatim, above.
 */
export function categoryFacets(listing, categoryId, activeCategoryId = null) {
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
  const base = activeCategoryId != null ? Number(activeCategoryId)
    : categoryId != null ? Number(categoryId)
    : ROOT_CATEGORY_ID
  const kids = childrenOf(base)
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
