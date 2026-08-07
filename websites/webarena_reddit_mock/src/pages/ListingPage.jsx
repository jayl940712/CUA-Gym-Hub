import React from 'react'
import { useParams, useSearchParams, useLocation } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import ListNav, { Dropdown, MenuItem, TimeDropdown } from '../components/ListNav.jsx'
import SLink from '../components/SLink.jsx'
import Pagination from '../components/Pagination.jsx'
import Submission from '../components/Submission.jsx'
import Icon from '../components/Icon.jsx'
import { ForumSidebar, FrontSidebar } from '../components/Sidebars.jsx'
import NotFound from './NotFound.jsx'
import RedirectWithQuery from '../components/RedirectWithQuery.jsx'
import { useApp } from '../context/AppContext.jsx'
import {
  normalizeSort, sortSubmissions, applyTimeFilter, paginate, buildCursorQuery,
  SORT_MODES, SORT_LABELS
} from '../utils/listing.js'

// The generic submission listing. Serves ROUTES #1–#6 (front family),
// #10/#11 (forum) and #13 (multireddit), including every sort variant, the ?t=
// time filter and PagerWave cursor pagination.
//
// Correctness anchors:
//   * `/` renders an EMPTY listing — front_page is `subscribed` and there are
//     zero subscriptions, so the source falls back to `featured` (also empty)
//     and shows only the info alert. Do not "helpfully" show all posts.
//   * `/f/books` hot must reproduce the ranking=1423 tie between 59478 and
//     17445 broken by `id DESC` (SOURCE.md).
//   * `/f/earthporn` resolves to EarthPorn. The source 302s to the canonical
//     casing; we render in place instead so the agent's final URL stays exactly
//     the anchored lowercase form.
//   * an unrecognised `next[...]` cursor is accepted and ignored, never 404ed.

/**
 * ROUTES #13 — the multireddit path param, verbatim from the source route
 * requirement: `(?:\w{3,25}\+){1,70}\w{3,25}`. Anything with a `+` that does
 * NOT match this 404s, exactly as Symfony's router does when no route matches.
 */
const MULTIREDDIT_RE = /^(?:\w{3,25}\+){1,70}\w{3,25}$/

export default function ListingPage({ view = 'front', sort: sortProp = null }) {
  const params = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { state, getForum, getSubmission, visibleSubmissions } = useApp()

  // `rawT` is null when the URL carries no `t` at all — post_nav.html.twig
  // branches on `app.request.query.has('t')`, not on the value, so the two
  // cases are NOT interchangeable.
  const rawT = searchParams.get('t')
  const t = rawT || 'all'

  // ---- resolve the forum / multireddit, if any ----------------------------
  //
  // `/f/a+b+c` (ROUTES #13) shares this route with `/f/{name}`. The two differ
  // only in the presence of `+`, so branch on that and keep the single-forum
  // path — which is anchor-critical for 27 tasks — completely untouched.
  //
  // Verified against the live source while building this:
  //   * unknown names inside a multireddit are TOLERATED, not 404ed
  //     (`/f/books+nonexistentxyz` renders books' submissions and still lists
  //     `nonexistentxyz` in the sidebar);
  //   * the sidebar/`<title>` lowercase every name (`/f/EARTHPORN+news` shows
  //     `earthporn`), while the sort links and the pager keep the raw URL
  //     casing;
  //   * there are NO Submissions/Comments tabs and NO filter dropdown on a
  //     multireddit — only the sort dropdown.
  const rawForum = params.forum || ''
  let forum = null
  let multi = null

  if (view === 'forum') {
    if (rawForum.includes('+')) {
      if (!MULTIREDDIT_RE.test(rawForum)) return <NotFound />
      multi = rawForum.split('+').map(n => n.toLowerCase())
    } else {
      forum = getForum(rawForum)
      if (!forum) return <NotFound />
    }
  }

  // ---- resolve the effective view ----------------------------------------
  const subs = state.subscriptions || []
  const mods = state.moderatorOf || []
  let effective = view

  if (view === 'front') effective = state.currentUser.frontPage || 'featured'
  if (effective === 'subscribed' && subs.length === 0) effective = 'featured'
  if (effective === 'moderated' && mods.length === 0) {
    effective = 'moderated-empty'
  }

  // front/featured.html.twig emits this from the user's PREFERENCE, not from
  // the route:
  //   {% if app.user.frontPage == 'subscribed' and app.user.subscriptionCount == 0 %}
  //     {{ alert('front.no_subscriptions'|trans) }}
  // so it shows on `/featured` as well as on `/`. Confirmed live on both, and
  // confirmed absent on `/all` and `/moderated` (different templates).
  const fallbackAlert = (
    effective === 'featured' &&
    (state.currentUser.frontPage || 'featured') === 'subscribed' &&
    subs.length === 0
  )
    ? 'You are not subscribed to any forum. Showing featured forums instead.'
    : null

  // ---- resolve the sort ---------------------------------------------------
  const defaultSort = view === 'front'
    ? (state.currentUser.frontPageSortMode || 'hot')
    : 'hot'
  // `/{sortBy}` (ROUTES #2) matches App.jsx's single-segment fallback, whose
  // param is named `segment`; RootSegment hands the validated sort down as a
  // prop. Every other listing route declares `:sort` and arrives via params.
  const rawSort = sortProp || params.sort
  if (rawSort && !SORT_MODES.includes(rawSort)) {
    // `/f/news/129508` (a bare submission id in the sort slot) is not a source
    // route, but agents build it; send it to the canonical submission URL
    // rather than dead-ending.
    if (/^[1-9][0-9]{0,17}$/.test(rawSort)) {
      const sub = getSubmission(rawSort)
      if (sub) return <RedirectWithQuery to={`/f/${sub.forum}/${sub.id}/${sub.slug || '-'}`} />
    }
    return <NotFound />
  }
  const sort = normalizeSort(rawSort, defaultSort)

  // ROUTES #5 — FrontController::subscribed() redirects to the `featured` route
  // when the user has no subscriptions ("To avoid showing new users a blank
  // page, we show them the featured forums instead."). The redirect is real, so
  // the agent's FINAL URL is /featured, not /subscribed — and WebArena's
  // url_match evaluators compare final URLs. Verified live:
  //   /subscribed          -> 302 /featured
  //   /subscribed/new      -> 302 /featured/new
  //   /subscribed/top?t=week -> 302 /featured/top   (query dropped)
  //   /subscribed/bogus    -> 404                   (route requirement, above)
  // `/` (FrontController::front) does NOT redirect — it swaps the listing in
  // place and the URL stays `/`.
  if (view === 'subscribed' && subs.length === 0) {
    return <RedirectWithQuery to={rawSort ? `/featured/${rawSort}` : '/featured'} sidOnly />
  }

  // ---- build the pool -----------------------------------------------------
  const all = visibleSubmissions()
  const hidden = new Set((state.hiddenForums || []).map(f => f.toLowerCase()))
  let pool
  if (multi) {
    // Union over the named forums. Names are matched on the lowercased form,
    // which is Postmill's `normalized_name` UNIQUE index, so `/f/EARTHPORN+news`
    // picks up EarthPorn's submissions.
    const set = new Set(multi)
    pool = all.filter(s => set.has(String(s.forum).toLowerCase()))
  } else if (view === 'forum') {
    const name = forum.name.toLowerCase()
    pool = all.filter(s => String(s.forum).toLowerCase() === name)
  } else if (effective === 'all') {
    pool = all.filter(s => !hidden.has(String(s.forum).toLowerCase()))
  } else if (effective === 'featured') {
    const featured = new Set(state.forums.filter(f => f.featured).map(f => f.name.toLowerCase()))
    pool = all.filter(s => featured.has(String(s.forum).toLowerCase())
      && !hidden.has(String(s.forum).toLowerCase()))
  } else if (effective === 'subscribed') {
    const set = new Set(subs.map(f => f.toLowerCase()))
    pool = all.filter(s => set.has(String(s.forum).toLowerCase()))
  } else if (effective === 'moderated') {
    const set = new Set(mods.map(f => f.toLowerCase()))
    pool = all.filter(s => set.has(String(s.forum).toLowerCase()))
  } else {
    pool = []
  }

  const filtered = applyTimeFilter(pool, t)
  const sorted = sortSubmissions(filtered, sort)
  const { items, nextCursor } = paginate(sorted, sort, searchParams)

  // ---- nav wiring ---------------------------------------------------------
  // Sort links keep the RAW path segment (`/f/EARTHPORN+news/new`), matching the
  // source's own `path()` output, while the sidebar lowercases.
  const base = multi
    ? `/f/${rawForum}`
    : view === 'forum'
      ? `/f/${forum.name}`
      : view === 'front' ? '' : `/${view}`

  const tabs = view === 'forum' && forum
    ? { submissions: `/f/${forum.name}`, comments: `/f/${forum.name}/comments` }
    : { submissions: '/', comments: '/comments' }

  const isModerated = effective === 'moderated' || effective === 'moderated-empty'
  const filterState = view === 'forum'
    ? null
    : {
      current: isModerated ? 'moderated' : effective,
      // filter_modes.moderated carries `condition: moderatorTokens|length > 0`
      showModerated: mods.length > 0
    }

  // The pager keeps the current path (including any explicit /:sort segment)
  // and only swaps the next[...] cursor params.
  const nextQuery = nextCursor ? buildCursorQuery(searchParams, nextCursor) : null
  const pagerHref = nextQuery ? `${location.pathname}?${nextQuery}` : null

  const sidebar = multi
    ? (
      <section className="sidebar__section flow">
        <h1 className="sidebar__title">Multi-forum view</h1>
        <ul className="unlistify sidebar__no-padding">
          {multi.map(name => (
            <li key={name}><SLink to={`/f/${name}`} className="menu-item">{name}</SLink></li>
          ))}
        </ul>
      </section>
    )
    : view === 'forum'
      ? <ForumSidebar forum={forum} />
      : (effective === 'featured' || effective === 'subscribed' || view === 'front')
        ? <FrontSidebar />
        // front/moderated.html.twig defines `{% block sidebar %}` with markup
        // around the `forums|length > 0` guard, so even with no moderated
        // forums the <aside> still receives a whitespace text node — which is
        // why the source's `.sidebar:empty { display: none }` does NOT fire on
        // /moderated and `#main` stays 806px there instead of widening to 1072
        // (DIFF-D07). Reproduce the whitespace, not a fake card.
        : isModerated
          ? (
            <>
              {'  '}
              {mods.length > 0 && (
                <section className="sidebar__section flow">
                  <h1 className="sidebar__title">Forums you moderate</h1>
                  <ul className="unlistify flex flex--guttered flex--slim-gutters">
                    {mods.map(name => (
                      <li key={name}>
                        <SLink to={`/f/${name}`} className="button button--secondary button--small">{name}</SLink>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </>
          )
          : null

  // `{% block title %}`: forum/forum.html.twig emits `{{ forum.title }}` (the
  // forum's TITLE column, not `/f/<name>`), forum/multi.html.twig emits
  // `/f/a, /f/b`, and every front listing falls through to base.html.twig's
  // `site_name()`.
  const pageTitle = multi
    ? multi.map(n => `/f/${n}`).join(', ')
    : view === 'forum' ? (forum.title || forum.name) : 'Xostmill'

  return (
    <Layout sidebar={sidebar} title={pageTitle}>
      {view === 'forum' && !multi && (
        <h1 className="page-heading forum-name-heading">
          <span className="forum-name-heading__prefix">/f/</span>
          <strong className="forum-name-heading__name">{forum.name}</strong>
        </h1>
      )}

      {/* front/moderated.html.twig overrides `block body` with the alert and
          THEN calls parent(), so this one sits ABOVE the nav — unlike
          featured.html.twig's, which fills `block front_alerts` below it. */}
      {effective === 'moderated-empty' && (
        <div className="alert bg-blue">
          <div className="alert__icon fg-blue" aria-hidden="true"><Icon name="info-circled" /></div>
          <div className="alert__text"><p>You don't moderate any forums.</p></div>
        </div>
      )}

      {multi ? (
        // A multireddit gets the sort dropdown alone — no Submissions/Comments
        // tabs and no filter dropdown (verified against /f/books+news live).
        // It does get the time dropdown: /f/books+news/top renders `From: All time`.
        <nav className="flex flex--guttered">
          <ul className="unlistify flex">
            <Dropdown icon="sort" label={SORT_LABELS[sort]} ariaLabel={`Sort by: ${SORT_LABELS[sort]}`}>
              {SORT_MODES.map(key => (
                <MenuItem
                  key={key}
                  to={`${base}/${key}${['top', 'controversial', 'most_commented'].includes(key) ? '?t=day' : ''}`}
                  active={sort === key}
                >
                  {SORT_LABELS[key]}
                </MenuItem>
              ))}
            </Dropdown>
            <TimeDropdown pathname={location.pathname} rawT={rawT} sort={sort} />
          </ul>
        </nav>
      ) : (
        <ListNav
          base={base}
          sort={sort}
          tabs={tabs}
          activeTab="submissions"
          filter={filterState}
          pathname={location.pathname}
          rawT={rawT}
          moderatorNav={isModerated}
          moderatorNavActive="moderated"
        />
      )}

      {fallbackAlert && (
        <div className="alert bg-blue">
          <div className="alert__icon fg-blue" aria-hidden="true"><Icon name="info-circled" /></div>
          <div className="alert__text"><p>{fallbackAlert}</p></div>
        </div>
      )}

      {items.length > 0 && (
        <div className="submission-listing flow">
          {items.map(s => (
            <Submission key={s.id} submission={s} showForum={view !== 'forum' || !!multi} />
          ))}
        </div>
      )}

      {/* `content.empty`, rendered by forum/forum.html.twig ONLY — verified live:
          /f/books/top?t=day emits the block, while /top?t=day (front) and
          /f/books+news/top?t=day (multireddit) emit nothing at all. This also
          resolves UNVERIFIED item 1 in assets/README.md: the emoji is `(ﾟдﾟ)`
          and it carries role="img" aria-label="A tense emoji". */}
      {view === 'forum' && !multi && items.length === 0 && (
        <div className="empty">
          <div className="empty__emoji" role="img" aria-label="A tense emoji">(ﾟдﾟ)</div>
          <div className="empty__text">There's nothing here…</div>
        </div>
      )}

      <Pagination nextHref={pagerHref} />
    </Layout>
  )
}
