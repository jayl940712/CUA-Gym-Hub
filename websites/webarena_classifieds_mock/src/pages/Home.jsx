import React, { useEffect, useState } from 'react'
import { useNavigate, Link, useLocation } from 'react-router-dom'
import Layout from '../components/Layout.jsx'
import Flash from '../components/item/Flash.jsx'
import ListingCardList from '../components/ListingCardList.jsx'
import { useApp } from '../context/AppContext.jsx'
import { loadHomeLatest, getItemFrom, isDeleted } from '../data/catalog.js'
import { indexUrl } from '../utils/urls.js'
import { categories } from '../utils/format.js'

/** Home category tiles — Font Awesome 5 class per category, copied from the theme. */
export const CATEGORY_ICONS = {
  2: 'fas fa-pen-fancy',
  3: 'fas fa-sink',
  4: 'fas fa-palette',
  5: 'fas fa-car-battery',
  6: 'fas fa-heart',
  7: 'fas fa-bicycle',
  8: 'fas fa-ship',
  9: 'fas fa-book',
  10: 'fas fa-car',
  11: 'fas fa-mobile',
  12: 'fas fa-star',
  13: 'fas fa-server',
  14: 'fas fa-laptop',
  15: 'fas fa-plug',
  16: 'fas fa-seedling',
  17: 'fas fa-couch',
  18: 'fas fa-tape',
  19: 'fas fa-ring',
  20: 'fas fa-motorcycle',
  21: 'fas fa-guitar',
  22: 'fas fa-camera',
  23: 'fas fa-caravan',
  24: 'fas fa-gamepad'
}

/**
 * The 7 regions the source's home page lists, with its exact counts.
 * CSS hides anything past the 9th row, so these 7 are all that ever show.
 */
export const HOME_REGIONS = [
  { id: 9254928, name: 'Virginia', count: 31126 },
  { id: 9254927, name: 'Pennsylvania', count: 22180 },
  { id: 7361885, name: 'Maryland', count: 21674 },
  { id: 8165418, name: 'Ohio', count: 5626 },
  { id: 7138106, name: 'Washington, D.C.', count: 1567 },
  { id: 7826850, name: 'West Virginia', count: 1110 },
  { id: 7142224, name: 'Delaware', count: 870 }
]

const MAX_LATEST = 12   // maxLatestItems@home

export default function Home() {
  const { state, sid } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const [latest, setLatest] = useState([])
  const [pattern, setPattern] = useState('')
  const [category, setCategory] = useState('')

  useEffect(() => {
    let live = true
    loadHomeLatest().then(rows => {
      if (!live) return
      const byId = new Map(rows.map(r => [r.id, r]))
      const created = (state.newItems || []).slice().sort((a, b) => (a.pub < b.pub ? 1 : a.pub > b.pub ? -1 : a.id - b.id))
      const merged = [
        ...created,
        ...rows.filter(r => !isDeleted(r.id, state))
      ]
        .map(r => (byId.has(r.id) ? getItemFrom(r.id, state, byId) : r))
        .filter(Boolean)
        .slice(0, MAX_LATEST)
      setLatest(merged)
    })
    return () => { live = false }
  }, [state])

  function onSubmit(e) {
    e.preventDefault()
    const params = { page: 'search' }
    if (pattern) params.sPattern = pattern
    if (category) params.sCategory = category
    navigate(indexUrl(params, sid))
  }

  const hero = (
    <HomeSearch
      pattern={pattern} setPattern={setPattern}
      category={category} setCategory={setCategory}
      onSubmit={onSubmit}
    />
  )

  // Some source redirects land on `osc_base_url()` carrying a session flash —
  // e.g. `item_delete` on a listing you do not own (item.php:409).
  const routedFlash = location.state && location.state.flash ? location.state.flash : null

  return (
    <Layout bodyClass="home" title="Classifieds" hero={hero} flash={<Flash flash={routedFlash} />}>
        <div className="home-latest">
          <h2>Latest Listings</h2>
          <ListingCardList items={latest} showAs="gallery" extraClass="latestItems" />
        </div>

        <div id="main">
          <div className="clear"></div>

          <div id="home-cats">
            <h2>All categories</h2>
            <div className="wrap">
              {categories.map(c => (
                <Link key={c.id} to={indexUrl({ page: 'search', sCategory: c.id }, sid)}>
                  <div className="icon">
                    <i className={CATEGORY_ICONS[c.id]}></i>
                  </div>
                  <strong>{c.name}</strong>
                </Link>
              ))}
            </div>
          </div>
        </div>

        <div id="sidebar">
          <div id="home-regs">
            <h2>All locations</h2>
            <div className="wrap">
              {HOME_REGIONS.map(r => (
                <div key={r.id}>
                  <Link to={indexUrl({ page: 'search', sRegion: r.id }, sid)}>
                    <i className="fas fa-location-arrow"></i> <span>{r.name}</span> <em>({r.count})</em>
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="clear"></div>
    </Layout>
  )
}

function HomeSearch({ pattern, setPattern, category, setCategory, onSubmit }) {
  return (
    <section className="home-search" id="mock-home-search">
      <div className="wrapper">
        <form action="/index.php" method="get" className="search nocsrf box" onSubmit={onSubmit}>
          <input type="hidden" name="page" value="search" />
          <h1>What are you looking for today?</h1>

          <div className="main-search">
            <div className="cell c1">
              <label>Keyword</label>
              <input
                type="text" name="sPattern" id="query" className="input-text"
                value={pattern} onChange={e => setPattern(e.target.value)}
                placeholder="e.g., a blue used car"
              />
            </div>

            <div className="cell c2">
              <label>Category</label>
              <select name="sCategory" id="sCategory" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Select a category</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="cell c3">
              <label>&nbsp;</label>
              <button className="btn btn-primary"><i className="fa fa-search"></i> <span>Search</span></button>
            </div>
          </div>
          <div id="message-seach"></div>
        </form>
      </div>
    </section>
  )
}
