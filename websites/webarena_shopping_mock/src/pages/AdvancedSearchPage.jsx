import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../components/Page.jsx'
import ProductGrid from '../components/ProductGrid.jsx'
import { ToolbarAmount, Limiter, Pager } from '../components/Toolbar.jsx'
import { GridIcon, ListIcon, ArrowUp, ArrowDown } from '../components/Icons.jsx'
import { useUrlBuilder, currentSid } from '../utils/url.js'
import { useDetailReady } from '../components/DetailGate.jsx'
import {
  products, isListable, finalPrice, sortProducts, clampLimit, getDescription,
} from '../utils/catalog.js'

/**
 * The advanced-search form's own parameters, in the order Magento renders the
 * criteria summary (`Magento\CatalogSearch\Model\Advanced::addFilters()` walks
 * the attribute collection in sort order). Verified live on
 * `/catalogsearch/advanced/result/?name=lamp&sku=B0&description=blue&short_description=red&price[from]=1&price[to]=2`
 * → `Product Name`, `SKU`, `Description`, `Short Description`, `Price`.
 */
const ADVANCED_PARAMS = [
  'name', 'sku', 'description', 'short_description',
  'price[from]', 'price[to]', 'price[currency]',
]

/** `price[from]` → `price`; used to sort the way Magento sorts (see below). */
function topLevelKey(k) {
  const i = k.indexOf('[')
  return i < 0 ? k : k.slice(0, i)
}

/**
 * The source's "Modify your search." link echoes back exactly the advanced
 * params that were in the request — empty values included — sorted by
 * *top-level* key, with a param array's sub-keys left in request order:
 *
 *   …/result/?name=lamp&sku=&description=&short_description=&price[from]=10
 *             &price[to]=50&price[currency]=USD
 *     → …/advanced/?description=&name=lamp&price%5Bfrom%5D=10&price%5Bto%5D=50
 *                  &price%5Bcurrency%5D=USD&short_description=&sku=
 *   …/result/?price[currency]=USD&price[to]=50&price[from]=10&name=lamp
 *     → …/advanced/?name=lamp&price%5Bcurrency%5D=USD&price%5Bto%5D=50&price%5Bfrom%5D=10
 *
 * Both verified live 2026-08-08. Note the second: `price` still sorts after
 * `name`, but currency/to/from keep the order they arrived in — so this is a
 * stable sort on the bracket-stripped key, not a plain lexical sort (which
 * would put `price[currency]` before `price[from]` in the first case too).
 */
function modifySearchHref(query) {
  const sp = new URLSearchParams()
  const keys = Object.keys(query).filter(k => ADVANCED_PARAMS.includes(k))
  keys.sort((a, b) => topLevelKey(a) < topLevelKey(b) ? -1 : topLevelKey(a) > topLevelKey(b) ? 1 : 0)
  for (const k of keys) sp.append(k, query[k])
  const sid = currentSid()
  if (sid) sp.set('sid', sid)
  const qs = sp.toString()
  return qs ? `/catalogsearch/advanced/?${qs}` : '/catalogsearch/advanced/'
}

/** ROUTES #12 — /catalogsearch/advanced/ (fieldset legend "Search Settings"). */
export default function AdvancedSearchPage() {
  // Plain useNavigate, not useStoreNavigate: onSubmit builds the whole query
  // string itself (empty params and all) and appends sid, so routing it through
  // buildUrl() again would both drop the blanks and double the `?`.
  const navigate = useNavigate()
  const { query } = useUrlBuilder()
  // The source's "Modify your search." link comes back here with the criteria
  // still attached and Magento repopulates every input from them.
  const [form, setForm] = useState(() => ({
    name: query.name || '',
    sku: query.sku || '',
    description: query.description || '',
    short_description: query.short_description || '',
    'price[from]': query['price[from]'] || '',
    'price[to]': query['price[to]'] || '',
  }))
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  /**
   * The source's advanced search is a plain `<form method="get">`, so the
   * browser submits *every* field — blanks included — in DOM order, plus the
   * hidden `price[currency]`. Searching for just a name on the live site lands
   * on
   *   /catalogsearch/advanced/result/?name=lamp&sku=&description=
   *     &short_description=&price%5Bfrom%5D=&price%5Bto%5D=&price%5Bcurrency%5D=USD
   *
   * The previous version dropped empty fields, which diverged from that URL on
   * every submit and — worse — could emit `?price[from]=200` with no
   * `price[to]` key at all, a URL the source answers with an empty page (see
   * `priceKeysUnbalanced` below). `buildUrl()` strips empty params by design,
   * so the query string is assembled here instead.
   */
  const onSubmit = (e) => {
    e.preventDefault()
    const sp = new URLSearchParams()
    for (const k of ADVANCED_PARAMS) {
      sp.append(k, k === 'price[currency]' ? 'USD' : (form[k] || '').trim())
    }
    const sid = currentSid()
    if (sid) sp.set('sid', sid)
    navigate(`/catalogsearch/advanced/result/?${sp.toString()}`)
  }

  // Live source (`curl /catalogsearch/advanced/`):
  //   <li class="item home"><a href="/" title="Go to Home Page">Home</a></li>
  //   <li class="item search"><strong>Catalog Advanced Search</strong></li>
  const breadcrumbs = [{ label: 'Catalog Advanced Search', className: 'search' }]

  return (
    <Page title="Advanced Search" documentTitle="Advanced Search" breadcrumbs={breadcrumbs} sidebar="none">
      <form className="form search advanced" id="form-validate" onSubmit={onSubmit}>
        <fieldset className="fieldset">
          <legend className="legend"><span>Search Settings</span></legend><br />
          <div className="field name">
            <label className="label" htmlFor="name"><span>Product Name</span></label>
            <div className="control">
              <input type="text" id="name" name="name" className="input-text" title="Product Name" maxLength={128}
                value={form.name} onChange={e => set('name', e.target.value)} />
            </div>
          </div>
          <div className="field sku">
            <label className="label" htmlFor="sku"><span>SKU</span></label>
            <div className="control">
              <input type="text" id="sku" name="sku" className="input-text" title="SKU" maxLength={128}
                value={form.sku} onChange={e => set('sku', e.target.value)} />
            </div>
          </div>
          <div className="field description">
            <label className="label" htmlFor="description"><span>Description</span></label>
            <div className="control">
              <input type="text" id="description" name="description" className="input-text" title="Description" maxLength={128}
                value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
          </div>
          <div className="field short_description">
            <label className="label" htmlFor="short_description"><span>Short Description</span></label>
            <div className="control">
              <input type="text" id="short_description" name="short_description" className="input-text"
                title="Short Description" maxLength={128}
                value={form.short_description} onChange={e => set('short_description', e.target.value)} />
            </div>
          </div>
          {/* The source has no placeholder text on either price input; the only
              extra copy in the row is the `USD` addafter label on price_to. */}
          <div className="field price">
            <label className="label" htmlFor="price"><span>Price</span></label>
            <div className="control">
              <div className="range price fields group group-2">
                <div className="field no-label">
                  <div className="control">
                    <input type="text" id="price" name="price[from]" className="input-text" title="Price" maxLength={128}
                      value={form['price[from]']} onChange={e => set('price[from]', e.target.value)} />
                  </div>
                </div>
                <div className="field with-addon no-label">
                  <div className="control">
                    <div className="addon">
                      <input type="text" id="price_to" name="price[to]" className="input-text" title="Price" maxLength={128}
                        value={form['price[to]']} onChange={e => set('price[to]', e.target.value)} />
                      <label className="addafter" htmlFor="price_to">USD</label>
                      {/* Source: <input type="hidden" name="price[currency]" value="USD">
                          sits inside .addon right after the addafter label. Its
                          presence is what makes the result page format the
                          Price criterion as currency. */}
                      <input type="hidden" name="price[currency]" value="USD" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </fieldset>
        <div className="actions-toolbar">
          <div className="primary">
            <button type="submit" className="action search primary" title="Search"><span>Search</span></button>
          </div>
        </div>
      </form>
    </Page>
  )
}

/**
 * The advanced-result sorter is NOT the quick-search sorter.
 *
 * Live `/catalogsearch/advanced/result/?name=lamp&price[from]=10&price[to]=100&sku=`
 * renders exactly two options and selects the first by default:
 *
 *   <option value="name" selected="selected">Product Name</option>
 *   <option value="price">Price</option>
 *
 * No `Relevance` (that only exists on /catalogsearch/result/) and no
 * `Position` (that only exists on category pages). The default therefore sorts
 * the result set alphabetically by product name ascending, which is what the
 * source's page 1 shows.
 */
const ADVANCED_SORT_OPTIONS = [
  { value: 'name', label: 'Product Name' },
  { value: 'price', label: 'Price' },
]

function AdvancedToolbar({ listing }) {
  const navigate = useNavigate()
  const { withParams, query } = useUrlBuilder()
  const mode = query.product_list_mode === 'list' ? 'list' : 'grid'
  const dir = listing.dir === 'desc' ? 'desc' : 'asc'
  const nextDir = dir === 'asc' ? 'desc' : 'asc'
  const dirTitle = nextDir === 'desc' ? 'Set Descending Direction' : 'Set Ascending Direction'

  return (
    <div className="toolbar toolbar-products">
      <div className="modes">
        <strong className="modes-label visually-hidden">View as</strong>
        <button
          type="button"
          className={`modes-mode mode-grid${mode === 'grid' ? ' active' : ''}`}
          title="Grid"
          onClick={() => navigate(withParams({ product_list_mode: 'grid' }))}
        >
          <GridIcon /><span className="visually-hidden">Grid</span>
        </button>
        <button
          type="button"
          className={`modes-mode mode-list${mode === 'list' ? ' active' : ''}`}
          title="List"
          onClick={() => navigate(withParams({ product_list_mode: 'list' }))}
        >
          <ListIcon /><span className="visually-hidden">List</span>
        </button>
      </div>

      <ToolbarAmount first={listing.first} last={listing.last} total={listing.totalCount} limit={listing.limit} />

      <div className="toolbar-sorter sorter">
        <label className="sorter-label" htmlFor="sorter">Sort By</label>
        <select
          id="sorter"
          data-role="sorter"
          className="sorter-options"
          value={listing.order}
          onChange={e => navigate(withParams({ product_list_order: e.target.value, p: null }))}
        >
          {ADVANCED_SORT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <button
          type="button"
          className={`action sorter-action sort-${dir}`}
          title={dirTitle}
          data-role="direction-switcher"
          data-value={nextDir}
          onClick={() => navigate(withParams({ product_list_dir: nextDir, p: null }))}
        >
          {dir === 'asc' ? <ArrowUp size={16} /> : <ArrowDown size={16} />}
          <span className="visually-hidden">{dirTitle}</span>
        </button>
      </div>
    </div>
  )
}

/**
 * Formatter for the Price criterion. Magento renders the raw request value
 * unless `price[currency]` came along, in which case it runs the bound through
 * the store's currency formatter. Observed live:
 *
 *   price[currency]=USD  price[from]=1000  → `$1,000.00`   (grouped, 2 decimals)
 *   price[currency]=USD  price[from]=12.5  → `$12.50`
 *   price[currency]=USD  price[from]=abc   → `$0.00`       (PHP (float) cast)
 *   price[currency]=     price[from]=1000  → `¤1,000.00`   (unknown currency)
 *   (key absent)         price[from]=1000  → `1000`        (echoed verbatim)
 */
function money(currency) {
  if (currency === undefined) return v => String(v)
  const symbol = currency === 'USD' ? '$' : '¤'
  return (v) => {
    const n = parseFloat(v)
    return symbol + (isNaN(n) ? 0 : n).toLocaleString('en-US', {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    })
  }
}

/**
 * Magento's price criterion is a param *array*, and it needs both members. Give
 * it only one key and the controller bails after the layout has already been
 * built, so the source answers 200 with the chrome intact — `<title>Advanced
 * Search Results</title>`, the `Catalog Advanced Search` h1, the
 * `Home > Catalog Advanced Search > Results` breadcrumbs and the left
 * `sidebar-additional` — and a `.column.main` that is completely empty: no
 * `search found`, no `search summary`, no `message notice`, no toolbar, no grid.
 *
 * Verified live 2026-08-08 (`.column.main` inner length 247 vs ~78 000):
 *   ?name=lamp&price[from]=200              → blank
 *   ?name=lamp&price[to]=20                 → blank
 *   ?price[from]=200                        → blank
 *   ?name=lamp&price[from]=200&price[to]=   → renders, `Price: 200 and greater`
 *
 * The site's own form always posts both keys, so this is only reachable by a
 * hand-written or task-injected deep link — which is exactly the case a
 * WebArena agent can land in.
 */
function priceKeysUnbalanced(query) {
  const hasFrom = query['price[from]'] !== undefined
  const hasTo = query['price[to]'] !== undefined
  return hasFrom !== hasTo
}

/** ROUTES #13 — /catalogsearch/advanced/result/ */
export function AdvancedSearchResultPage() {
  const { query } = useUrlBuilder()
  const navigate = useNavigate()
  // R7-004: the two description criteria filter on `getDescription()` and
  // list mode prints it, so those are the only cases that wait on the
  // `descriptions` chunk. A name/sku/price search does not.
  const detailPending = !useDetailReady(
    query.description || query.short_description || query.product_list_mode === 'list'
      ? ['descriptions'] : null)

  // Safe as an early return: the three hooks above have already run and this
  // component calls no others.
  if (priceKeysUnbalanced(query)) {
    return (
      <Page
        title="Catalog Advanced Search"
        documentTitle="Advanced Search Results"
        breadcrumbs={[
          { label: 'Catalog Advanced Search', to: '/catalogsearch/advanced/', className: 'search' },
          { label: 'Results', className: 'search_result' },
        ]}
        sidebar="additional-left"
      />
    )
  }

  const criteria = []

  const name = (query.name || '').toLowerCase()
  const sku = (query.sku || '').toLowerCase()
  const description = (query.description || '').toLowerCase()
  const shortDescription = (query.short_description || '').toLowerCase()
  // Magento decides a price bound is *set* on string length, then casts it with
  // PHP's `(float)` — which yields 0.0 for anything non-numeric rather than
  // dropping the bound. Live proof:
  //   ?name=lamp&price[from]=abc&price[to]=&price[currency]=USD
  //     → `Price: $0.00 and greater`, and 1607 items — the same total as
  //       ?name=lamp alone, i.e. a `>= 0` bound that filters nothing.
  // A NaN guard here would have dropped the criterion row entirely.
  const phpFloat = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n }
  const hasFrom = query['price[from]'] !== undefined && query['price[from]'] !== ''
  const hasTo = query['price[to]'] !== undefined && query['price[to]'] !== ''
  const priceFrom = hasFrom ? phpFloat(query['price[from]']) : null
  const priceTo = hasTo ? phpFloat(query['price[to]']) : null

  if (query.name) criteria.push({ label: 'Product Name', value: query.name })
  if (query.sku) criteria.push({ label: 'SKU', value: query.sku })
  if (query.description) criteria.push({ label: 'Description', value: query.description })
  if (query.short_description) criteria.push({ label: 'Short Description', value: query.short_description })
  if (hasFrom || hasTo) {
    // All three shapes are real source copy, verified live 2026-08-08 against
    // /catalogsearch/advanced/result/:
    //   ?price[from]=10&price[to]=50&price[currency]=USD   → `$10.00 - $50.00`
    //   ?price[from]=200&price[to]=&price[currency]=USD    → `$200.00 and greater`
    //   ?price[from]=&price[to]=50&price[currency]=USD     → `up to $50.00`
    //   ?price[from]=10&price[to]=50   (no currency key)   → `10 - 50`
    //   ?price[from]=200&price[to]=    (no currency key)   → `200 and greater`
    //   ?price[from]=&price[to]=50     (no currency key)   → `up to 50`
    //
    // An earlier round recorded `and greater` / `up to` as invented copy. They
    // are not: what actually blanks the source's page is an *unbalanced* price
    // array, which is a different condition entirely — see
    // `priceKeysUnbalanced` above.
    const fmt = money(query['price[currency]'])
    let value
    if (hasFrom && hasTo) value = `${fmt(query['price[from]'])} - ${fmt(query['price[to]'])}`
    else if (hasFrom) value = `${fmt(query['price[from]'])} and greater`
    else value = `up to ${fmt(query['price[to]'])}`
    criteria.push({ label: 'Price', value })
  }

  // Magento splits the criteria into two `<ul class="items">` columns at
  // ceil(n/2) — 5 criteria render 3 + 2, 2 criteria render 1 + 1, and a single
  // criterion renders one list only.
  const middle = Math.ceil(criteria.length / 2)
  const criteriaColumns = [criteria.slice(0, middle), criteria.slice(middle)].filter(c => c.length)

  let pool = products.filter(p => {
    if (!isListable(p)) return false
    if (name && !p.name.toLowerCase().includes(name)) return false
    if (sku && !p.sku.toLowerCase().includes(sku)) return false
    if (description && !getDescription(p.id).toLowerCase().includes(description)) return false
    if (shortDescription && !getDescription(p.id).toLowerCase().includes(shortDescription)) return false
    const price = finalPrice(p)
    if (priceFrom !== null && price < priceFrom) return false
    if (priceTo !== null && price > priceTo) return false
    return true
  })

  // Source default: `name`, ascending (the `<option value="name">` carries
  // selected="selected" when no product_list_order is in the URL).
  const order = query.product_list_order || 'name'
  const dir = query.product_list_dir || 'asc'
  pool = sortProducts(pool, order, dir)

  const limit = clampLimit(query.product_list_limit)
  const page = Math.max(1, parseInt(query.p, 10) || 1)
  const totalCount = pool.length
  const totalPages = Math.max(1, Math.ceil(totalCount / limit))

  const listing = {
    items: pool.slice((page - 1) * limit, page * limit),
    pool,
    totalCount,
    page,
    limit,
    totalPages,
    first: totalCount === 0 ? 0 : (page - 1) * limit + 1,
    last: Math.min(page * limit, totalCount),
    captured: null,
    anchor: null,
    order,
    dir,
    priceRange: null,
  }

  const mode = query.product_list_mode === 'list' ? 'list' : 'grid'
  const modifyHref = modifySearchHref(query)
  const onModify = (e) => { e.preventDefault(); navigate(modifyHref) }

  // Live source: `Home > Catalog Advanced Search > Results`, where the middle
  // crumb links back to /catalogsearch/advanced/ and the last is a <strong>.
  //   <li class="item search"><a href="…/catalogsearch/advanced/" title="">Catalog Advanced Search</a></li>
  //   <li class="item search_result"><strong>Results</strong></li>
  const breadcrumbs = [
    { label: 'Catalog Advanced Search', to: '/catalogsearch/advanced/', className: 'search' },
    { label: 'Results', className: 'search_result' },
  ]

  const summary = criteriaColumns.length > 0 && (
    <div className="search summary">
      {criteriaColumns.map((col, i) => (
        <ul className="items" key={i}>
          {col.map(c => (
            <li className="item" key={c.label}><strong>{c.label}:</strong> {c.value}</li>
          ))}
        </ul>
      ))}
    </div>
  )

  // The <h1> and the <title> genuinely differ on the source: the page heading
  // is "Catalog Advanced Search" while document.title is "Advanced Search
  // Results".
  return (
    <Page
      title="Catalog Advanced Search"
      documentTitle="Advanced Search Results"
      breadcrumbs={breadcrumbs}
      pending={detailPending}
      // Unlike the advanced-search *form* (1column), the result page is served
      // as page-layout-2columns-left with a lone `sidebar sidebar-additional`
      // (Compare Products / My Wish List) in the left rail. Verified live:
      //   curl …/catalogsearch/advanced/result/?name=lamp… | grep page-layout
      //     → page-layout-2columns-left
      //     → class="sidebar sidebar-additional"   (no sidebar-main)
      sidebar="additional-left"
    >
      {totalCount === 0 ? (
        <>
          {/* Source (browser DOM, zero-result branch):
              <div role="alert" class="message error"><div>We can't find any
              items matching these search criteria. <a href="…">Modify your
              search.</a></div></div> — then the criteria summary. */}
          <div role="alert" className="message error">
            <div>
              We can&#039;t find any items matching these search criteria.{' '}
              <a href={modifyHref} onClick={onModify}>Modify your search.</a>
            </div>
          </div>
          {summary}
        </>
      ) : (
        <>
          <div className="search found">
            <strong>{totalCount} {totalCount === 1 ? 'item' : 'items'}</strong> were found using the following search criteria
          </div>
          {summary}
          <div className="message notice">
            <div>
              Don&#039;t see what you&#039;re looking for?{' '}
              <a href={modifyHref} onClick={onModify}>Modify your search.</a>
            </div>
          </div>
          <div className="search results">
            <AdvancedToolbar listing={listing} />
            <ProductGrid products={listing.items} mode={mode} />
            <div className="toolbar toolbar-products toolbar-bottom">
              <Pager page={listing.page} totalPages={listing.totalPages} />
              <Limiter listing={listing} />
            </div>
          </div>
        </>
      )}
    </Page>
  )
}
