import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import UserPage from '../../components/user/UserPage.jsx'
import ListingCardList from '../../components/ListingCardList.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { indexUrl } from '../../utils/urls.js'
import {
  getOrderedIds, pageOf, loadCategory, loadAll, loadAllDescriptions,
  isDeleted, applyOverrides
} from '../../data/catalog.js'
import { parseTerms, matches, hasPattern } from '../../utils/search.js'
import { regionOf } from '../../utils/format.js'
import { sortKeyOf } from '../Search.jsx'

/**
 * ROUTES #22 — `index.php?page=user&action=alerts`.
 *
 * `oc_t_alerts` is empty for Blake, so the source renders only the `<h1>` and
 * `<p class="empty">You do not have any alerts yet.</p>`. The search sidebar's
 * `Subscribe now!` pushes a row onto `state.alerts` and anything there is
 * listed here.
 *
 * THE RECORD SHAPE (AUDIT PIPELINE-004 / HANDLERS-001). `Search.jsx` writes
 * `{id, userId, email, search, active}` where `search` is a **JSON string** of
 * the search params — faithful to `oc_t_alerts.s_search` and to SCHEMA.md.
 * This file used to read `a.params` / `a.description`, which nobody writes, so
 * every subscription rendered as the literal text "All listings" linked to a
 * bare `page=search`. The producer is right; this consumer now parses `search`.
 *
 * WHAT THE SOURCE ACTUALLY RENDERS PER ALERT — `oc-content/themes/sigma/user-alerts.php`
 * (read out of the container), which is NOT a label + link:
 *
 *   <div class="userItem">
 *     <div class="title-has-actions">
 *       <h3>Alert 1</h3> <a onclick="…confirm…" href="…unsub_alert…">Delete this alert</a>
 *       <div class="clear"></div>
 *     </div>
 *     <div>  …loop.php: <ul class="listing-card-list listing-list items">…  </div>
 *   </div>
 *
 * i.e. the alert is described by *running its search* and showing the first 12
 * matches, exactly as `controller/user.php:110-126` does
 * (`$search->setJsonAlert(json_decode($a['s_search']))`, `limit(0, 12)`), with
 * `<br />0 Listings` when the search matches nothing. That is reproduced below,
 * over the same catalogue + session-state pipeline the search page uses, and the
 * `<h3>` links to the reconstructed search URL so the query is still reachable
 * (the source's `<h3>` is plain text — the link is the one addition, and it is
 * what makes the alert's own query visible to an agent).
 */

/** `osc_apply_filter('limit_alert_items', 12)` — controller/user.php:120. */
const ALERT_LIMIT = 12

export default function Alerts() {
  const { state, setState, sid } = useApp()
  const alerts = state.alerts || []

  // results[i] = { params, total, items } | null while that alert is loading
  const [results, setResults] = useState([])

  useEffect(() => {
    let live = true
    setResults(alerts.map(() => null))
    Promise.all(alerts.map(a => runAlertSearch(a.search, state).catch(() => ({
      params: parseSearch(a.search), total: 0, items: []
    })))).then(rs => { if (live) setResults(rs) })
    return () => { live = false }
    // `alerts` lives inside `state`, so one dependency covers both.
  }, [state])

  function unsubscribe(e, id) {
    e.preventDefault()
    if (!window.confirm("This action can't be undone. Are you sure you want to continue?")) return
    setState(prev => ({ ...prev, alerts: (prev.alerts || []).filter(a => a.id !== id) }))
  }

  return (
    <UserPage title="Alerts" crumb="Alerts">
      <h1>Alerts</h1>
      {alerts.length === 0 ? (
        <p className="empty">You do not have any alerts yet.</p>
      ) : alerts.map((a, i) => {
        const r = results[i] || null
        const params = r ? r.params : parseSearch(a.search)
        return (
          <React.Fragment key={a.id != null ? a.id : i}>
            <div className="userItem">
              <div className="title-has-actions">
                <h3>
                  <Link to={indexUrl({ page: 'search', ...params }, sid)}>Alert {i + 1}</Link>
                </h3>
                {' '}
                <a
                  href={indexUrl({
                    page: 'user', action: 'unsub_alert', email: a.email, id: a.id
                  }, sid)}
                  onClick={e => unsubscribe(e, a.id)}
                >Delete this alert</a>
                <div className="clear"></div>
              </div>
              <div>
                <ListingCardList items={r ? r.items : []} showAs="list" extraClass="items" />
                {r && r.items.length === 0 ? (<><br />0 Listings</>) : null}
              </div>
            </div>
            <br />
          </React.Fragment>
        )
      })}
    </UserPage>
  )
}

/**
 * `(array) json_decode($alert['s_search'], true)` — the source's own first step
 * (controller/user.php:114). A malformed or absent descriptor degrades to the
 * unfiltered search, which is what PHP's cast to array does too.
 */
export function parseSearch(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return stripPage(raw)
  try {
    const p = JSON.parse(raw || '{}')
    if (p && typeof p === 'object' && !Array.isArray(p)) return stripPage(p)
  } catch (e) { /* fall through */ }
  return {}
}

/** `page` is re-supplied by indexUrl(); keep it out of the params object. */
function stripPage(p) {
  const out = {}
  for (const k in p) {
    if (k === 'page' || k === 'sid') continue
    const v = p[k]
    if (v !== undefined && v !== null && v !== '') out[k] = v
  }
  return out
}

/**
 * Run one alert's stored query against the catalogue + session state.
 *
 * Mirrors the two code paths in `Search.jsx` on purpose — unfiltered scopes
 * slice the precomputed order arrays, filtered ones sort by
 * `(sort column, id ASC)` — because the source runs the same `Search` object
 * here that it runs for `page=search`.
 */
async function runAlertSearch(raw, state) {
  const params = parseSearch(raw)
  const catId = params.sCategory ? Number(params.sCategory) : null
  const sort = sortKeyOf(params)
  const pattern = (params.sPattern || '').trim()
  const terms = parseTerms(pattern)
  const patternActive = hasPattern(pattern)
  const priceMin = numOrNull(params.sPriceMin)
  const priceMax = numOrNull(params.sPriceMax)
  const regionIds = splitIds(params.sRegion)
  const cityIds = splitIds(params.sCity)
  const cityText = !cityIds.length && params.sCity ? String(params.sCity) : ''

  const filtered = patternActive || priceMin !== null || priceMax !== null ||
    regionIds.length > 0 || !!params.sCity

  if (!filtered) {
    const { ids, byId } = await getOrderedIds({ catId, sort, state })
    return { params, total: ids.length, items: pageOf(ids, byId, 1, state, ALERT_LIMIT) }
  }

  // A pattern whose every word is <4 chars or a stopword matches nothing.
  if (patternActive && terms.length === 0) return { params, total: 0, items: [] }

  const [scope, descs] = await Promise.all([
    catId ? loadCategory(catId) : loadAll(),
    terms.length ? loadAllDescriptions() : Promise.resolve(null)
  ])

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
    if (regionIds.length) {
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
  return { params, total: out.length, items: out.slice(0, ALERT_LIMIT) }
}

function comparator(sort) {
  if (sort === 'priceAsc') return (a, b) => (a.price - b.price) || (a.id - b.id)
  if (sort === 'priceDesc') return (a, b) => (b.price - a.price) || (a.id - b.id)
  return (a, b) => (a.pub < b.pub ? 1 : a.pub > b.pub ? -1 : a.id - b.id)
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
