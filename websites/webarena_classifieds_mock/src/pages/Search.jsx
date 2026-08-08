import React, { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Flash from '../components/item/Flash.jsx'
import Breadcrumb from '../components/Breadcrumb.jsx'
import ListingCardList from '../components/ListingCardList.jsx'
import Pagination from '../components/Pagination.jsx'
import { useApp } from '../context/AppContext.jsx'
import {
  PAGE_SIZE, getOrderedIds, pageOf, loadCategory, loadAll, loadAllDescriptions,
  isDeleted, applyOverrides
} from '../data/catalog.js'
import { indexUrl } from '../utils/urls.js'
import { categories, categoryName, regionOf, regions } from '../utils/format.js'
import { parseTerms, matches, hasPattern } from '../utils/search.js'

/**
 * ROUTES #3–13. Search / category browse — the surface 185 of 234 tasks live on.
 *
 * Everything below that could be guessed was instead measured against the live
 * source with curl while this file was written; the load-bearing findings are:
 *
 * TITLE / <h1>
 *   `<h1>` renders ONLY when a category, region or city is in play, and its text
 *   is `{category}{space}{city-or-region}` — hence the trailing space in
 *   `<h1>Books </h1>` and the absence of one in `<h1>Electronics Maryland</h1>`.
 *   A bare `index.php?page=search` emits NO `<h1>` at all (its `<title>` is still
 *   `Search results - Classifieds`), and a keyword-only search emits none either.
 *   `<title>` = `{pattern} » {that same string}` with the empty halves dropped,
 *   falling back to `Search results`, then ` - page {raw iPage}` when the RAW
 *   value compares greater than '1' (so `4y` yields ` - page 4y` while `0`, `1`
 *   and `-3` yield nothing), then ` - Classifieds`.
 *
 * ORDERING — two different code paths, deliberately
 *   * UNFILTERED (category-only, or site-wide): slice the shard's PRECOMPUTED
 *     `order.<sort>` array. Those were captured by replaying the source's own
 *     `LIMIT 12 OFFSET n`, so they carry MySQL's real (unstable) tie order and
 *     `iPage=331` lands on the items recon measured. Re-sorting here scored
 *     13/21 in recon. Never do it.
 *   * FILTERED (sRegion / sCity / price / sPattern): the source runs a DIFFERENT
 *     SQL statement, so its tie order is not the captured one. Sorting the
 *     filtered set by `(sort column, pk_i_id ASC)` reproduces it — verified
 *     item-for-item against both region anchors,
 *       sRegion=7361885&sCategory=15&sOrder=i_price&iOrderType=asc&iPage=4  (1399)
 *       sRegion=9254928&sCategory=10&sOrder=i_price&iOrderType=asc&iPage=2  (3251)
 *     and against `sPattern=banana+boat` page 1 (658 results).
 *     Filtering the captured array instead gets both the count and the page wrong.
 *
 * EMPTY STATE
 *   Triggered by "this page has no rows", not by "the query has no rows" — page
 *   200 of a 65-page category renders it too (HTTP 404 on the source). The `<h1>`
 *   still renders above it when there is one; the counter, the sort dropdown, the
 *   layout toggle, `<h2>Listings</h2>`, the list and the paginator all vanish.
 *
 * SELF-LINKS
 *   The sort dropdown and the list/gallery toggle rebuild the CURRENT url, which
 *   means they KEEP `iPage` — `…&sCategory=9&iPage=124&sOrder=i_price…` is itself
 *   an anchor route, reachable only because the source preserves it. (ROUTES.md
 *   says these links drop `iPage`; the live site disagrees — see DEV PROGRESS.)
 *   The "Refine category" links are built from scratch and DO drop `iPage`.
 */
export default function Search({ params }) {
  const { state, sid } = useApp()
  const navigate = useNavigate()
  const location = useLocation()

  const catId = params.sCategory ? Number(params.sCategory) : null
  // The source TRIMS sPattern for everything it displays — `sPattern=+Xbox+One+games`
  // renders `Xbox One games` in the title, the breadcrumb and the sidebar input —
  // but keeps the RAW value in every link it builds. Both behaviours below.
  const pattern = (params.sPattern || '').trim()
  const showAs = params.sShowAs === 'gallery' ? 'gallery' : 'list'
  const sort = sortKeyOf(params)

  // iPage is 1-based; a non-numeric value (e.g. "4y") renders page 1 while the
  // <title> still echoes the raw string.
  const rawPage = params.iPage === undefined || params.iPage === null ? '' : String(params.iPage)
  const page = /^\d+$/.test(rawPage) ? Math.max(Number(rawPage), 1) : 1
  const offset = (page - 1) * PAGE_SIZE

  const terms = useMemo(() => parseTerms(pattern), [pattern])
  const patternActive = hasPattern(pattern)

  const priceMin = numOrNull(params.sPriceMin)
  const priceMax = numOrNull(params.sPriceMax)
  const regionIds = useMemo(() => splitIds(params.sRegion), [params.sRegion])
  const cityIds = useMemo(() => splitIds(params.sCity), [params.sCity])
  const cityText = !cityIds.length && params.sCity ? String(params.sCity) : ''

  // A PRESENT sRegion always filters, even when it cannot be parsed into ids:
  // `?page=search&sRegion=abc` renders the empty state on the source, same as
  // `sRegion=999999`. Keying off `regionIds.length` alone let `abc` through.
  const regionActive = params.sRegion !== undefined && params.sRegion !== null && String(params.sRegion) !== ''

  const filtered = patternActive || priceMin !== null || priceMax !== null ||
    regionActive || !!params.sCity

  const [result, setResult] = useState(null)   // { total, items } | null while loading
  const [cityRow, setCityRow] = useState(null) // resolved cities.json row, for the label + breadcrumb
  const [cityResolved, setCityResolved] = useState(false)

  // ---- `sCity` accepts a city id OR a city name; both feed <h1>, <title> and
  //      the breadcrumb (which shows the city's own region above it).
  useEffect(() => {
    let live = true
    setCityRow(null)
    setCityResolved(false)
    if (!params.sCity) return
    import('../data/cities.json').then(mod => {
      if (!live) return
      const all = mod.default || mod
      const hit = cityIds.length
        ? all.find(c => c.id === cityIds[0])
        : all.find(c => String(c.name).toLowerCase() === cityText.toLowerCase())
      setCityRow(hit || null)
      setCityResolved(true)
    })
    return () => { live = false }
  }, [params.sCity])

  // An unresolvable city echoes its RAW value, exactly like sRegion — the source
  // renders `<h1>999999</h1>` for `?page=search&sCity=999999`. Held back until the
  // cities.json lookup has actually answered, so a valid id never flashes as raw.
  const cityLabel = cityRow
    ? cityRow.name
    : (cityIds.length ? (cityResolved ? String(params.sCity) : '') : cityText)

  // ---- the record set ---------------------------------------------------------
  useEffect(() => {
    let live = true
    setResult(null)

    ;(async () => {
      // Fast path: no filters, so the precomputed order array IS the answer and
      // only 12 rows ever get materialised.
      if (!filtered) {
        const { ids, byId } = await getOrderedIds({ catId, sort, state })
        if (!live) return
        setResult({ total: ids.length, items: pageOf(ids, byId, page, state) })
        return
      }

      // A supplied pattern whose every word is under 4 chars or a stopword
      // matches nothing at all — `red car` and `used` both return 0 on the source.
      if (patternActive && terms.length === 0) {
        if (live) setResult({ total: 0, items: [] })
        return
      }

      const [scope, descs] = await Promise.all([
        catId ? loadCategory(catId) : loadAll(),
        terms.length ? loadAllDescriptions() : Promise.resolve(null)
      ])
      if (!live) return

      const pool = []
      for (const it of scope.items) {
        if (isDeleted(it.id, state)) continue
        pool.push(applyOverrides(it, state))
      }
      for (const it of (state.newItems || [])) {
        if (catId && Number(it.cat) !== Number(catId)) continue
        if (isDeleted(it.id, state)) continue
        pool.push(applyOverrides(it, state))
      }

      const out = []
      for (const item of pool) {
        if (terms.length) {
          let desc = null
          if (descs) {
            const d = descs.get(Number(item.id))
            desc = d !== undefined ? d : (item.description || '')
          }
          if (!matches(item, terms, desc)) continue
        }
        if (priceMin !== null && Number(item.price) / 1e6 < priceMin) continue
        if (priceMax !== null && Number(item.price) / 1e6 > priceMax) continue
        if (regionActive) {
          if (!regionIds.length) continue      // unparseable sRegion matches nothing
          const r = regionOf(item)
          if (!r || !regionIds.includes(r.id)) continue
        }
        if (cityIds.length) {
          if (!cityIds.includes(Number(item.cityId))) continue
        } else if (cityText) {
          if (String(item.city || '').toLowerCase() !== cityText.toLowerCase()) continue
        }
        out.push(item)
      }

      out.sort(comparator(sort))
      if (!live) return
      setResult({ total: out.length, items: out.slice(offset, offset + PAGE_SIZE) })
    })()

    return () => { live = false }
  }, [
    catId, sort, state, page, pattern, filtered,
    params.sPriceMin, params.sPriceMax, params.sRegion, params.sCity
  ])

  const loading = result === null
  const total = result ? result.total : 0
  const pageItems = result ? result.items : []
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const empty = !loading && pageItems.length === 0

  // ---- headings ---------------------------------------------------------------
  const catName = catId ? categoryName(catId) : ''
  const regionName = regionNameFor(params.sRegion) ||
    (cityRow ? regionNameForId(cityRow.regionId) : '')
  const placeName = cityLabel || regionNameFor(params.sRegion)
  const searchTitle = `${catName ? catName + ' ' : ''}${placeName}`
  const titleBase = [pattern, searchTitle.trim()].filter(Boolean).join(' » ') || 'Search results'
  const title = `${titleBase}${pageSuffix(rawPage)} - Classifieds`

  // Breadcrumb, measured: `Classifieds > {Category} > {Region} > {City} > Search
  // results: {pattern}`, with every empty segment dropped and `Search results`
  // alone when nothing else is set. Only the LAST crumb is unlinked.
  const crumbs = []
  if (catName) crumbs.push({ label: catName, to: indexUrl({ page: 'search', sCategory: catId }, sid) })
  if (regionName) crumbs.push({ label: regionName })
  if (cityLabel) crumbs.push({ label: cityLabel })
  if (pattern) crumbs.push({ label: `Search results: ${pattern}` })
  if (!crumbs.length) crumbs.push({ label: 'Search results' })
  delete crumbs[crumbs.length - 1].to

  // ---- link params ------------------------------------------------------------
  // Sort + layout links rebuild the current URL, so they keep iPage. Refine links
  // are built from scratch and do not.
  //
  // Both are assembled in the REQUEST's own key order — `osc_update_search_url()`
  // rewrites the query in place, so an incoming param keeps its slot and a new one
  // is appended. `?…&sCategory=9&iPage=124&sOrder=i_price&…` therefore sorts to
  // `?…&sCategory=9&iPage=124&sOrder=dt_pub_date&…` with iPage still in slot 2,
  // while `?…&sRegion=9254928` refines to `?…&sRegion=9254928&sCategory=10`.
  // (TEST DIFF-009 / BUG-T1.)
  const currentParams = inUrlOrder(params, SEARCH_LINK_PARAMS)
  const refineParams = omit(currentParams, 'iPage')

  const breadcrumb = <Breadcrumb crumbs={crumbs} />

  // `item_add_post` 302s here (item.php:208) carrying the session flash
  // `Your listing has been published`; the theme renders it in header.php.
  const routedFlash = location.state && location.state.flash ? location.state.flash : null

  return (
    <Layout bodyClass="search" title={title} breadcrumb={breadcrumb} flash={<Flash flash={routedFlash} />}>
      <SearchSidebar
        params={params} refineParams={refineParams} catId={catId} sid={sid} navigate={navigate}
      />

      <div id="main">
        <div className="list-header">
          <div className="resp-wrapper">
            {searchTitle ? <h1>{searchTitle}</h1> : null}

            {empty ? (
              <p className="empty">
                There are no results matching "{pattern}". Note that only search terms of 4 or more characters are valid.
              </p>
            ) : loading ? null : (
              <>
                <span className="counter-search">
                  {`${offset + 1} - ${Math.min(offset + PAGE_SIZE, total)} of ${total} listings`}
                </span>
                <div className="actions">
                  <a href="#" className="resp-toogle show-filters-btn btn btn-secondary" onClick={e => e.preventDefault()}>Show filters</a>

                  <SortBy currentParams={currentParams} params={params} sid={sid} />

                  <span className="doublebutton">
                    <Link
                      to={indexUrl({ ...currentParams, sShowAs: 'list' }, sid)}
                      className={`list-button btn btn-secondary ${showAs === 'list' ? 'active' : ''}`}
                      data-class-toggle="listing-list" data-destination="#listing-card-list"
                    ><i className="fas fa-bars"></i></Link>
                    <Link
                      to={indexUrl({ ...currentParams, sShowAs: 'gallery' }, sid)}
                      className={`grid-button btn btn-secondary ${showAs === 'gallery' ? 'active' : ''}`}
                      data-class-toggle="listing-grid" data-destination="#listing-card-list"
                    ><i className="fas fa-border-all"></i></Link>
                  </span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* No "Premium listings" block, ever — b_premium = 0 on all 84,149 rows. */}
        {!empty && !loading && (
          <>
            <h2>Listings</h2>
            <ListingCardList items={pageItems} showAs={showAs} extraClass="items" terms={terms} />
            <div className="clear"></div>
            {/* currentParams, not refineParams: the source's pager rewrites iPage
                IN PLACE when the request already carried one
                (`…&sCategory=9&iPage=123&sOrder=…`) and appends it last when it
                did not (`…&sCategory=9&sShowAs=gallery&iPage=2`). Both measured. */}
            <Pagination page={page} lastPage={lastPage} params={currentParams} />
          </>
        )}
      </div>
    </Layout>
  )
}

// ---------------------------------------------------------------------------

/** Sidebar: filters form, subscribe-to-search, refine category. */
function SearchSidebar({ params, refineParams, catId, sid, navigate }) {
  const [pattern, setPattern] = useState((params.sPattern || '').trim())
  const [city, setCity] = useState(params.sCity || '')
  const [priceMin, setPriceMin] = useState(params.sPriceMin || '')
  const [priceMax, setPriceMax] = useState(params.sPriceMax || '')
  const [bPic, setBPic] = useState(params.bPic === '1')

  useEffect(() => {
    setPattern((params.sPattern || '').trim())
    setCity(params.sCity || '')
    setPriceMin(params.sPriceMin || '')
    setPriceMax(params.sPriceMax || '')
    setBPic(params.bPic === '1')
  }, [params.sPattern, params.sCity, params.sPriceMin, params.sPriceMax, params.bPic])

  // The GET form drops iPage (a new filter set always lands on page 1) and carries
  // the effective sOrder / iOrderType through as hidden inputs, as the source does.
  function apply(e) {
    e.preventDefault()
    // Field order is the source form's own serialisation order, measured on the
    // live markup: page, sOrder, iOrderType, sPattern, sRegion, sCity, bPic,
    // sPriceMin, sPriceMax, sCategory[].
    navigate(indexUrl(stripEmpty({
      page: 'search',
      sOrder: effectiveOrder(params),
      iOrderType: effectiveDirection(params),
      sPattern: pattern,
      sRegion: params.sRegion,
      sCity: city,
      bPic: bPic ? '1' : '',
      sPriceMin: priceMin,
      sPriceMax: priceMax,
      sCategory: params.sCategory,
      sShowAs: params.sShowAs
    }), sid))
  }

  return (
    <div id="sidebar" className="fixed-layout">
      <div className="fixed-close"><i className="fas fa-times"></i></div>

      <div className="filters">
        <form action="/index.php" method="get" className="nocsrf" onSubmit={apply}>
          <input type="hidden" name="page" value="search" />
          <input type="hidden" name="sOrder" value={effectiveOrder(params)} />
          <input type="hidden" name="iOrderType" value={effectiveDirection(params)} />

          <fieldset className="first">
            <h3>Your search</h3>
            <div className="row">
              <input className="input-text" type="text" name="sPattern" id="query"
                value={pattern} onChange={e => setPattern(e.target.value)} />
            </div>
          </fieldset>

          <fieldset>
            <h3>City</h3>
            <div className="row">
              <input className="input-text" type="hidden" id="sRegion" name="sRegion" value={params.sRegion || ''} readOnly />
              <input className="input-text" type="text" id="sCity" name="sCity"
                value={city} onChange={e => setCity(e.target.value)} />
            </div>
          </fieldset>

          <fieldset>
            <h3>Show only</h3>
            <div className="row picture">
              <input type="checkbox" name="bPic" id="withPicture" value="1"
                checked={bPic} onChange={e => setBPic(e.target.checked)} />
              <label htmlFor="withPicture">listings with pictures</label>
            </div>
          </fieldset>

          <fieldset>
            <div className="row price-slice">
              <h3>Price</h3>
              <div className="left">
                <span>Min.</span>
                <input className="input-text" type="text" id="priceMin" name="sPriceMin"
                  size="6" maxLength="6" value={priceMin} onChange={e => setPriceMin(e.target.value)} />
              </div>
              <div className="right">
                <span>Max.</span>
                <input className="input-text" type="text" id="priceMax" name="sPriceMax"
                  size="6" maxLength="6" value={priceMax} onChange={e => setPriceMax(e.target.value)} />
              </div>
            </div>
          </fieldset>

          <div className="plugin-hooks"></div>
          {catId ? <input type="hidden" name="sCategory[]" value={catId} /> : null}
          <div className="actions">
            <button type="submit" className="btn btn-primary">Apply</button>
          </div>
        </form>
      </div>

      <SubscribeToSearch refineParams={refineParams} />

      <div className="refine">
        <h3>Refine category</h3>
        <ul className="category">
          <li>
            <Link to={indexUrl(stripEmpty({ ...refineParams, sCategory: '' }), sid)}>All categories</Link>
          </li>
          {/* With a category selected the source lists ONLY that category, in
              <strong>; unfiltered it lists all 23. */}
          {(catId ? categories.filter(c => c.id === Number(catId)) : categories).map(c => (
            <li key={c.id}>
              <Link id={`cat_${c.id}`} to={indexUrl({ ...refineParams, sCategory: c.id }, sid)}>
                {Number(catId) === c.id ? <strong>{c.name}</strong> : c.name}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/** "Subscribe to this search" — pushes a descriptor of the current query onto state.alerts. */
function SubscribeToSearch({ refineParams }) {
  const { state, setState, user } = useApp()

  function subscribe(e) {
    e.preventDefault()
    const descriptor = JSON.stringify(refineParams)
    if (!(state.alerts || []).some(a => a.search === descriptor)) {
      setState(prev => ({
        ...prev,
        alerts: [...(prev.alerts || []), {
          // Max+1, not length+1: after an unsubscribe, length+1 re-issues an id
          // that is already in use (AUDIT HANDLERS-008).
          id: (prev.alerts || []).reduce((m, a) => Math.max(m, Number(a.id) || 0), 0) + 1,
          userId: prev.user.id,
          email: prev.user.email,
          search: descriptor,
          active: 1
        }]
      }))
    }
    // The source's only feedback is this native alert (the `$.post` handler in
    // search-default.html:150-160) — the button label never changes, so it must
    // not change here either (AUDIT HANDLERS-007). `sucessfully` is the source's
    // own typo.
    window.alert('You have sucessfully subscribed to the alert')
  }

  return (
    <div className="alert_form">
      <h3><strong>Subscribe to this search</strong></h3>
      <form action="/index.php" method="post" name="sub_alert" id="sub_alert" className="nocsrf" onSubmit={subscribe}>
        <input id="page" type="hidden" name="page" value="search" />
        <input id="alert" type="hidden" name="alert" value={JSON.stringify(refineParams)} />
        <input id="alert_userId" type="hidden" name="alert_userId" value={user.id} />
        <input id="alert_email" type="hidden" name="alert_email" value={user.email} />
        <button type="submit" className="sub_button btn btn-secondary">Subscribe now!</button>
      </form>
    </div>
  )
}

/**
 * The sort menu. Labels and targets are exact.
 *
 * The panel is `display:none` in the theme CSS and is revealed by
 * `.hover ul {display:block}` — the class comes from the sigma theme's own
 * jQuery (`$('.see_by').hover(...)` in `js/global.js`), NOT from a `:hover`
 * selector. There is no jQuery here, so the same class is driven from React.
 * A click on the label also pins it open, so an agent that clicks straight
 * through without generating a mouseover still gets the menu.
 */
const SORT_OPTIONS = [
  { label: 'Newly listed', sOrder: 'dt_pub_date', iOrderType: 'desc' },
  { label: 'Lower price first', sOrder: 'i_price', iOrderType: 'asc' },
  { label: 'Higher price first', sOrder: 'i_price', iOrderType: 'desc' }
]

function SortBy({ currentParams, params, sid }) {
  const [hover, setHover] = useState(false)
  const [pinned, setPinned] = useState(false)
  // When the current (sOrder, iOrderType) pair matches NO menu option the source
  // renders an EMPTY label and marks no option `current` — measured on
  // `sOrder=dt_pub_date&iOrderType=asc`, `sOrder=dt_expiration&…` and
  // `sOrder=zzz&…`, all of which emit `<label> <i class="fa fa-angle-down"></i>`.
  // Only `dt_pub_date&desc` / `i_price&asc` / `i_price&desc` get a label.
  // (TEST DIFF-007.)
  const current =
    SORT_OPTIONS.find(o => o.sOrder === effectiveOrder(params) && o.iOrderType === effectiveDirection(params)) ||
    null
  return (
    <span
      className={`see_by btn btn-secondary${hover || pinned ? ' hover' : ''}`}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPinned(false) }}
      onClick={() => setPinned(p => !p)}
    >
      <span>Sort by:</span>
      <label>{current ? current.label : ''} <i className="fa fa-angle-down"></i></label>
      <ul>
        {SORT_OPTIONS.map(o => (
          <li key={o.label}>
            <Link
              className={o === current ? 'current' : undefined}
              to={indexUrl({ ...currentParams, sOrder: o.sOrder, iOrderType: o.iOrderType }, sid)}
            >{o.label}</Link>
          </li>
        ))}
      </ul>
    </span>
  )
}

// ---------------------------------------------------------------------------
// param helpers

/** Only i_price / dt_pub_date / dt_expiration are sortable; anything else falls back. */
export function effectiveOrder(params) {
  const o = params.sOrder
  return o === 'i_price' || o === 'dt_expiration' ? o : 'dt_pub_date'
}

/** iOrderType is compared as a STRING — 0/1 do not match and fall back to desc. */
export function effectiveDirection(params) {
  return params.iOrderType === 'asc' ? 'asc' : 'desc'
}

/**
 * Sort key for the current params.
 *
 * The DIRECTION matters for the date column too — measured on the live source
 * (`sCategory=9`): `dt_pub_date&iOrderType=asc` returns `32464, 69456, 40883, …`
 * on page 1 and `75204, 2833, 45861, …` on page 50, i.e. the exact reverse of the
 * default `desc` order. An unsortable column (`s_title`, `zzz`) falls the COLUMN
 * back to `dt_pub_date` but still honours the direction — verified at page 50,
 * where `sOrder=zzz&iOrderType=asc` and `sOrder=zzz&iOrderType=desc` return two
 * different pages, so the source is not dropping ORDER BY (see TEST DIFF-007).
 */
export function sortKeyOf(params) {
  if (effectiveOrder(params) === 'i_price') {
    return effectiveDirection(params) === 'asc' ? 'priceAsc' : 'priceDesc'
  }
  return effectiveDirection(params) === 'asc' ? 'oldest' : 'newest'
}

/**
 * Tie-break comparator for FILTERED result sets only — `(sort column, id ASC)`.
 * Verified against both region anchor pages and the `banana boat` anchor page.
 * The unfiltered path must never use it; see the header comment.
 */
function comparator(sort) {
  if (sort === 'priceAsc') return (a, b) => (a.price - b.price) || (a.id - b.id)
  if (sort === 'priceDesc') return (a, b) => (b.price - a.price) || (a.id - b.id)
  if (sort === 'oldest') return (a, b) => (a.pub > b.pub ? 1 : a.pub < b.pub ? -1 : a.id - b.id)
  return (a, b) => (a.pub < b.pub ? 1 : a.pub > b.pub ? -1 : a.id - b.id)
}

/**
 * ` - page {raw}` when the RAW iPage compares greater than '1' the way PHP 8
 * would: numerically for numeric strings, lexicographically otherwise. That is
 * what makes `iPage=4y` render page 1 while the title still says `page 4y`,
 * and what keeps `iPage=0`, `1` and `-3` suffix-free.
 */
function pageSuffix(raw) {
  if (raw === '') return ''
  const numeric = /^-?\d+(\.\d+)?$/.test(raw)
  const greater = numeric ? Number(raw) > 1 : raw > '1'
  return greater ? ` - page ${raw}` : ''
}

function numOrNull(v) {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

function splitIds(v) {
  if (!v) return []
  const parts = String(v).split(',').map(s => s.trim())
  if (!parts.every(p => /^\d+$/.test(p))) return []
  return parts.map(Number).filter(n => n > 0)
}

/**
 * A region that does not resolve echoes its RAW value into the `<h1>`, the
 * `<title>` and the last breadcrumb — measured on the source:
 *   `?page=search&sRegion=999999`            -> h1 `999999`,       title `999999 - Classifieds`
 *   `?page=search&sRegion=999999&sCategory=9`-> h1 `Books 999999`, title `Books 999999 - Classifieds`
 *   `?page=search&sRegion=abc`               -> h1 `abc`
 * (TEST BUG-R4.)
 */
function regionNameFor(sRegion) {
  if (sRegion === undefined || sRegion === null || sRegion === '') return ''
  const ids = splitIds(sRegion)
  return (ids.length ? regionNameForId(ids[0]) : '') || String(sRegion)
}

function regionNameForId(id) {
  const r = regions.find(x => x.id === Number(id))
  return r ? r.name : ''
}

/** The params the source's own search links carry through. */
const SEARCH_LINK_PARAMS = [
  'sCategory', 'sPattern', 'sRegion', 'sCity', 'sPriceMin', 'sPriceMax',
  'bPic', 'sOrder', 'iOrderType', 'sShowAs', 'iPage'
]

/**
 * Pick `keep` out of `params`, preserving the order the REQUEST listed them in,
 * with `page=search` pinned first (as it is in every source URL).
 */
function inUrlOrder(params, keep) {
  const out = { page: 'search' }
  for (const k of Object.keys(params)) {
    if (k === 'page' || !keep.includes(k)) continue
    const v = params[k]
    if (v !== undefined && v !== null && v !== '') out[k] = v
  }
  return out
}

function omit(obj, key) {
  const out = {}
  for (const k in obj) if (k !== key) out[k] = obj[k]
  return out
}

function stripEmpty(obj) {
  const out = {}
  for (const k in obj) {
    const v = obj[k]
    if (v !== undefined && v !== null && v !== '') out[k] = v
  }
  return out
}
