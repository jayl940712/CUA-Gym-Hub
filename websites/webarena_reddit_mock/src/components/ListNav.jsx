import React, { useState, useRef, useEffect } from 'react'
import SLink from './SLink.jsx'
import Icon from './Icon.jsx'

// templates/forum/_list_nav.html.twig — verbatim from assets/html/root-auth.html
// and f_news-auth.html.
//
// Note the exact link shapes in the sort menu: Hot / New / Active carry no
// query, while Top / Controversial / Most commented are linked WITH `?t=day`
// appended. That asymmetry is in the source; reproduce it.

export function Dropdown({ icon, label, ariaLabel, children }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <li className={`dropdown${open ? ' dropdown--expanded' : ''}`} ref={ref}>
      <button
        type="button"
        className="dropdown__toggle tab no-underline unbuttonize"
        aria-label={ariaLabel}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <Icon name={icon} />{' '}
        <span className="no-underline__exempt">{label}</span>
        <span className="dropdown__arrow"></span>
      </button>
      <ul className="dropdown__menu dropdown-card unlistify" onClick={() => setOpen(false)}>
        {children}
      </ul>
    </li>
  )
}

export function MenuItem({ to, active, children }) {
  return (
    <li>
      <SLink to={to} className={`no-wrap menu-item ${active ? 'menu-item--active' : ''}`}>
        {children}
      </SLink>
    </li>
  )
}

const SORT_ORDER = [
  { key: 'hot', label: 'Hot', time: false },
  { key: 'new', label: 'New', time: false },
  { key: 'active', label: 'Active', time: false },
  { key: 'top', label: 'Top', time: true },
  { key: 'controversial', label: 'Controversial', time: true },
  { key: 'most_commented', label: 'Most commented', time: true }
]

const SORT_LABEL = Object.fromEntries(SORT_ORDER.map(s => [s.key, s.label]))

// `_macros/post_nav.html.twig :: submission_time`, read out of the container:
//
//   {% set times = constant('App\\Entity\\Submission::TIME_OPTIONS') %}   -> day, week, month, year, all
//   {% if current not in times %}{% set current = 'all' %}{% endif %}
//   {% if app.request.query.has('t') or sort_by not in ['active','hot','new'] %}
//
// so the dropdown is rendered on top / controversial / most_commented ALWAYS,
// and on hot / new / active only when the URL already carries `?t=`. Its links
// are `path(_route, _route_params|merge({t: time}))` — i.e. the CURRENT path
// with `t` swapped and every other query param (the next[...] cursor) dropped.
// Labels are `submission.time_*` in translations/messages.en.yml.
const TIME_OPTIONS = ['day', 'week', 'month', 'year', 'all']
const TIME_LABEL = {
  day: 'Past 24 hours',
  week: 'Past week',
  month: 'Past month',
  year: 'Past year',
  all: 'All time'
}
const UNTIMED_SORTS = ['active', 'hot', 'new']

/**
 * @param pathname  the current path, used verbatim as the link base
 * @param rawT      the raw `?t=` value (null when absent — that is the switch
 *                  that decides whether the control renders on an untimed sort)
 * @param sort      the active sort mode
 */
export function TimeDropdown({ pathname, rawT = null, sort = 'hot' }) {
  const hasT = rawT !== null && rawT !== undefined
  if (!hasT && UNTIMED_SORTS.includes(sort)) return null
  const current = TIME_OPTIONS.includes(rawT) ? rawT : 'all'

  return (
    <Dropdown icon="clock" label={TIME_LABEL[current]} ariaLabel={`From: ${TIME_LABEL[current]}`}>
      {TIME_OPTIONS.map(key => (
        <MenuItem key={key} to={`${pathname}?t=${key}`} active={key === current}>
          {TIME_LABEL[key]}
        </MenuItem>
      ))}
    </Dropdown>
  )
}

// `submission_filter`'s `filter_modes` map, in template order. `moderated`
// carries `condition: (app.user.moderatorTokens ?? [])|length > 0`, so it is
// absent from the MENU for a user who moderates nothing — but its label is
// still what the toggle shows on /moderated, because the macro reads
// `filter_modes[choice].label` regardless of the condition.
const FILTER_ORDER = ['featured', 'subscribed', 'all', 'moderated']
const FILTER_LABEL = {
  featured: 'Featured',
  subscribed: 'Subscribed',
  all: 'All',
  moderated: 'Moderated'
}

/** `front/_moderator_nav.html.twig`, appended inside the nav on /moderated. */
function ModeratorNav({ active }) {
  return (
    <>
      <div className="flex__grow"></div>
      <ul className="unlistify flex">
        <li>
          <SLink to="/moderated" className={`tab ${active === 'moderated' ? 'tab--active' : ''}`}>Forums</SLink>
        </li>
        <li>
          <SLink to="/trash" className={`tab ${active === 'trash' ? 'tab--active' : ''}`}>Trash</SLink>
        </li>
      </ul>
    </>
  )
}

/**
 * @param base          path prefix for sort links ('' for the front page,
 *                      '/all', '/f/news', …)
 * @param sort          the active sort mode
 * @param tabs          { submissions, comments } hrefs
 * @param activeTab     'submissions' | 'comments'
 * @param filter        null, or
 *                      { current: 'featured'|'subscribed'|'all'|'moderated',
 *                        showModerated: bool }
 * @param pathname      current path — the `?t=` links hang off it verbatim
 * @param rawT          raw `?t=` value, or null when the URL has no `t`
 * @param moderatorNav  render the Forums | Trash moderator tabs
 */
export default function ListNav({
  base = '', sort = 'hot', tabs, activeTab = 'submissions', filter = null,
  pathname = null, rawT = null, moderatorNav = false, moderatorNavActive = 'moderated'
}) {
  const sortHref = (key, withTime) => `${base}/${key}${withTime ? '?t=day' : ''}` || '/'

  const filterKeys = filter
    ? FILTER_ORDER.filter(k => k !== 'moderated' || filter.showModerated)
    : []
  const currentFilterLabel = filter ? (FILTER_LABEL[filter.current] || 'Featured') : null

  return (
    <nav className="flex flex--guttered">
      <ul className="unlistify flex">
        <li>
          <SLink to={tabs.submissions} className={`tab ${activeTab === 'submissions' ? 'tab--active' : ''}`}>
            Submissions
          </SLink>
        </li>
        <li>
          <SLink to={tabs.comments} className={`tab ${activeTab === 'comments' ? 'tab--active' : ''}`}>
            Comments
          </SLink>
        </li>
      </ul>

      <ul className="unlistify flex">
        {filter && (
          <Dropdown
            icon="filter"
            label={currentFilterLabel}
            ariaLabel={`Filter on: ${currentFilterLabel}`}
          >
            {filterKeys.map(key => (
              <MenuItem key={key} to={`/${key}/${sort}`} active={filter.current === key}>
                {FILTER_LABEL[key]}
              </MenuItem>
            ))}
          </Dropdown>
        )}

        <Dropdown icon="sort" label={SORT_LABEL[sort] || 'Hot'} ariaLabel={`Sort by: ${SORT_LABEL[sort] || 'Hot'}`}>
          {SORT_ORDER.map(s => (
            <MenuItem key={s.key} to={sortHref(s.key, s.time)} active={sort === s.key}>
              {s.label}
            </MenuItem>
          ))}
        </Dropdown>

        {pathname && <TimeDropdown pathname={pathname} rawT={rawT} sort={sort} />}
      </ul>

      {moderatorNav && <ModeratorNav active={moderatorNavActive} />}
    </nav>
  )
}
