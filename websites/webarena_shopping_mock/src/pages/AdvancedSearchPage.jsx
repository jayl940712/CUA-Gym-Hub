import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Page from '../components/Page.jsx'
import ProductGrid from '../components/ProductGrid.jsx'
import { ToolbarAmount, Limiter, Pager } from '../components/Toolbar.jsx'
import { GridIcon, ListIcon, ArrowUp, ArrowDown } from '../components/Icons.jsx'
import { useStoreNavigate, useUrlBuilder, currentSid } from '../utils/url.js'
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
const ADVANCED_PARAMS = ['name', 'sku', 'description', 'short_description', 'price[from]', 'price[to]']

/**
 * The source's "Modify your search." link echoes back exactly the advanced
 * params that were in the request — empty values included — sorted
 * alphabetically by key:
 *
 *   /catalogsearch/advanced/result/?name=lamp&price[from]=10&price[to]=100&sku=
 *     → …/catalogsearch/advanced/?name=lamp&price%5Bfrom%5D=10&price%5Bto%5D=100&sku=
 *   …?sku=B08&name=&description=&short_description=&price[from]=1000&price[to]=1200
 *     → …?description=&name=&price%5Bfrom%5D=1000&price%5Bto%5D=1200&short_description=&sku=B08
 */
function modifySearchHref(query) {
  const sp = new URLSearchParams()
  const keys = ADVANCED_PARAMS.filter(k => query[k] !== undefined).sort()
  for (const k of keys) sp.append(k, query[k])
  const sid = currentSid()
  if (sid) sp.set('sid', sid)
  const qs = sp.toString()
  return qs ? `/catalogsearch/advanced/?${qs}` : '/catalogsearch/advanced/'
}

/** ROUTES #12 — /catalogsearch/advanced/ (fieldset legend "Search Settings"). */
export default function AdvancedSearchPage() {
  const navigate = useStoreNavigate()
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

  const onSubmit = (e) => {
    e.preventDefault()
    const params = {}
    for (const [k, v] of Object.entries(form)) if (v.trim()) params[k] = v.trim()
    navigate('/catalogsearch/advanced/result/', params)
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

/** ROUTES #13 — /catalogsearch/advanced/result/ */
export function AdvancedSearchResultPage() {
  const { query } = useUrlBuilder()
  const navigate = useNavigate()
  const criteria = []

  const name = (query.name || '').toLowerCase()
  const sku = (query.sku || '').toLowerCase()
  const description = (query.description || '').toLowerCase()
  const shortDescription = (query.short_description || '').toLowerCase()
  const priceFrom = query['price[from]'] !== undefined ? parseFloat(query['price[from]']) : NaN
  const priceTo = query['price[to]'] !== undefined ? parseFloat(query['price[to]']) : NaN

  if (query.name) criteria.push({ label: 'Product Name', value: query.name })
  if (query.sku) criteria.push({ label: 'SKU', value: query.sku })
  if (query.description) criteria.push({ label: 'Description', value: query.description })
  if (query.short_description) criteria.push({ label: 'Short Description', value: query.short_description })
  if (!isNaN(priceFrom) || !isNaN(priceTo)) {
    // Source wording, verified live: both bounds → `10 - 100`, from only →
    // `10 and greater`, to only → `up to 100`.
    let value
    if (!isNaN(priceFrom) && !isNaN(priceTo)) value = `${query['price[from]']} - ${query['price[to]']}`
    else if (!isNaN(priceFrom)) value = `${query['price[from]']} and greater`
    else value = `up to ${query['price[to]']}`
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
    if (!isNaN(priceFrom) && price < priceFrom) return false
    if (!isNaN(priceTo) && price > priceTo) return false
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
