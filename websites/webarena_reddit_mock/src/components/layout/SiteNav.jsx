import React, { useState, useRef, useEffect } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import SLink, { useSidNavigate } from '../SLink.jsx'
import Icon from '../Icon.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { forumFromPath } from '../../utils/nav.js'
import { SORT_MODES } from '../../utils/listing.js'

// templates/_layouts/site_nav.html.twig — verified against
// assets/html/f_news-auth.html and assets/screenshots/reference/03-forum-news.png.
// The wordmark is altered per TRADEMARKS.md; every other string is verbatim
// from messages.en.yml.

export const SITE_NAME = 'Xostmill'

/**
 * `{% block site_nav_active %}` / `{% block site_nav_main_menu_active %}`.
 *
 * Postmill sets these per template; the nav then stamps `site-nav__link--active`
 * on the matching link (which draws the 2px underline in
 * `.site-nav__link--active::after`). Measured on the container while logged in
 * as MarvelsGrantMan136 — the desktop-visible results are:
 *
 *   /, /hot, /new, /top, /active, /all, /all/new, /moderated, /comments,
 *   /featured, /subscribed .......... Postmill (home)      [front/_base, comment/list]
 *   /forums ......................... Forums               [forum/list]
 *   /forums/all ..................... (none)               [forum/list_all sets nothing]
 *   /wiki, /wiki/index .............. Wiki                 [wiki/*]
 *   /notifications, /messages ....... the notifications icon
 *   /submit, /submit/books .......... Submit
 *   /user/MarvelsGrantMan136(/…) .... the username dropdown toggle
 *   /user/smita16, /f/books, /create_forum, /tags, a submission page … (none)
 *
 * `/search` sets active='search', which only lights the mobile-only search
 * toggle — an element this nav does not render — so it stays blank on desktop,
 * exactly as the source does at 1920px.
 */
export function navActive(pathname, currentUsername) {
  const seg = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const [a, b] = seg
  const FRONT_LISTS = ['featured', 'subscribed', 'all', 'moderated']
  const front =
    seg.length === 0 ||
    (seg.length === 1 && (FRONT_LISTS.includes(a) || a === 'comments' || SORT_MODES.includes(a))) ||
    (seg.length === 2 && FRONT_LISTS.includes(a) && SORT_MODES.includes(b))

  const same = (x, y) => !!x && !!y && x.toLowerCase() === y.toLowerCase()

  return {
    front,
    forums: a === 'forums' && b !== 'all',
    wiki: a === 'wiki' || a === 'w',
    notifications: a === 'notifications' || a === 'inbox' ||
                   a === 'messages' || a === 'message_reply',
    submit: a === 'submit',
    user: (a === 'user' || a === 'u') && same(b, currentUsername)
  }
}

/**
 * `{% block site_nav_user_menu_active %}` — only evaluated when the site-nav
 * `active` block is `user`, i.e. on the CURRENT user's own pages. Values from
 * the container's templates: user.html.twig / submissions.html.twig /
 * comments.html.twig -> `profile`, edit.html.twig -> `account`,
 * settings.html.twig -> `preferences`, block_list.html.twig -> `block_list`.
 */
export function userMenuActiveItem(pathname, currentUsername) {
  const seg = pathname.split('/').filter(Boolean).map(decodeURIComponent)
  const [a, b, c] = seg
  if (a !== 'user' && a !== 'u') return ''
  if (!b || !currentUsername || b.toLowerCase() !== currentUsername.toLowerCase()) return ''
  if (c === undefined || c === 'submissions' || c === 'comments') return 'profile'
  if (c === 'account') return 'account'
  if (c === 'preferences') return 'preferences'
  if (c === 'block_list') return 'block_list'
  return ''
}

/** `class="menu-item {{ … ? 'menu-item--active' }}"`. */
function menuItemClass(active) {
  return active ? 'menu-item menu-item--active' : 'menu-item'
}

/** `class="site-nav__link {{ … ? 'site-nav__link--active' }}"`. */
function linkClass(base, active) {
  return active ? `${base} site-nav__link--active` : base
}

export default function SiteNav() {
  const { state, setNightMode } = useApp()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const navigate = useSidNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const menuRef = useRef(null)

  useEffect(() => { setQuery(searchParams.get('q') || '') }, [searchParams])

  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  const user = state.currentUser
  const notifications = state.notifications || []
  const forumName = forumFromPath(location.pathname)
  const submitTo = forumName ? `/submit/${forumName}` : '/submit'
  const active = navActive(location.pathname, user.username)
  const userMenuActive = userMenuActiveItem(location.pathname, user.username)

  const onSearch = (e) => {
    e.preventDefault()
    navigate(`/search?q=${encodeURIComponent(query)}`)
  }

  return (
    <nav className="site-nav">
      <div className="site-nav__container content-container">
        <header className="site-nav__header">
          <SLink to="/" className={linkClass('site-nav__link', active.front)} aria-label="Home">
            <Icon name="home" alt="Home" className="no-desktop" />
            <b className="no-mobile">{SITE_NAME}</b>
          </SLink>
        </header>

        <div className="site-nav__main-menu-container">
          <ul className="site-nav__menu site-nav__main-menu unlistify">
            <li><SLink to="/forums" className={linkClass('site-nav__link', active.forums)}>Forums</SLink></li>
            <li><SLink to="/wiki" className={linkClass('site-nav__link', active.wiki)}>Wiki</SLink></li>
          </ul>
        </div>

        <form action="/search" className="site-nav__search" onSubmit={onSearch}>
          <div className="site-nav__search-row">
            <label className="site-nav__search-label" htmlFor="site-nav-search" aria-hidden="true">
              <Icon name="search" className="icon--no-align" />
            </label>
            <input
              name="q" type="search" id="site-nav-search"
              className="form-control site-nav__search-input"
              aria-label="Search query"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </div>
        </form>

        <ul className="site-nav__menu site-nav__user-menu unlistify">
          <li>
            <SLink
              to="/notifications"
              className={linkClass(
                `no-wrap site-nav__link${notifications.length ? ' site-nav__has-notifications' : ''}`,
                active.notifications)}
              title={`Notifications (${notifications.length})`}
              aria-label={`Notifications (${notifications.length})`}
            >
              <Icon name="envelope" alt="Notifications" />
            </SLink>
          </li>
          <li>
            <SLink to={submitTo} className={linkClass('no-wrap site-nav__link', active.submit)}
                   aria-label="Submit">
              <Icon name="plus" alt="Submit" altClassName="no-desktop" />{' '}
              <span className="no-mobile">Submit</span>
            </SLink>
          </li>
          <li className={`dropdown dropdown--right${menuOpen ? ' dropdown--expanded' : ''}`} ref={menuRef}>
            <button
              type="button"
              className={linkClass('dropdown__toggle site-nav__link no-wrap unbuttonize', active.user)}
              aria-haspopup="true"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(o => !o)}
            >
              <Icon name="user" alt="User" altClassName="no-desktop" />{' '}
              <strong className="no-mobile">{user.username}</strong>
              <span className="dropdown__arrow no-mobile" aria-hidden="true"></span>
            </button>

            <ul className="dropdown-card dropdown__menu unlistify no-wrap">
              {/* `site_nav_user_menu_dropdown_items` opens with a mobile-only
                  header. It measures 0x0 at desktop widths (`.no-desktop` is
                  `display:none` there) but it is in the DOM on the source, and
                  its absence was the whole `.menu-item` count delta. */}
              <li className="no-desktop">
                <span className="menu-item ">Logged in as <strong>{user.username}</strong></span>
              </li>
              <li className="no-desktop"><hr /></li>
              <li>
                <SLink to={`/user/${user.username}`}
                       className={menuItemClass(userMenuActive === 'profile')}
                       onClick={() => setMenuOpen(false)}>
                  <Icon name="user" /> Profile
                </SLink>
              </li>
              <li>
                <SLink to={`/user/${user.username}/account`}
                       className={menuItemClass(userMenuActive === 'account')}
                       onClick={() => setMenuOpen(false)}>
                  <Icon name="lock" /> My account
                </SLink>
              </li>
              <li>
                <SLink to={`/user/${user.username}/preferences`}
                       className={menuItemClass(userMenuActive === 'preferences')}
                       onClick={() => setMenuOpen(false)}>
                  <Icon name="cog" /> User settings
                </SLink>
              </li>
              <li>
                <SLink to={`/user/${user.username}/block_list`}
                       className={menuItemClass(userMenuActive === 'block_list')}
                       onClick={() => setMenuOpen(false)}>
                  <Icon name="block" /> Block list
                </SLink>
              </li>
              <li><hr /></li>
              {/* Two buttons, not one: the source renders both and lets
                  `_utilities/night-mode.less` hide whichever does not apply to
                  the current `data-night-mode`. */}
              <li>
                <form onSubmit={e => e.preventDefault()}>
                  <button
                    type="button" name="nightMode" value="dark"
                    className="menu-item unbuttonize light-mode-only"
                    onClick={() => { setNightMode('dark'); setMenuOpen(false) }}
                  >
                    <Icon name="moon-inv" /> Dark mode
                  </button>
                  <button
                    type="button" name="nightMode" value="light"
                    className="menu-item unbuttonize dark-mode-only"
                    onClick={() => { setNightMode('light'); setMenuOpen(false) }}
                  >
                    <Icon name="sun-inv" /> Light mode
                  </button>
                </form>
              </li>
            </ul>
          </li>
        </ul>
      </div>
    </nav>
  )
}
