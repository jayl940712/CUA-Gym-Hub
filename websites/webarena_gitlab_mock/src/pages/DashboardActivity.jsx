import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import { useQuery } from './hooks.js'

// ROUTES #11 — `/dashboard/activity`. assets/README.md §4c.
//
// Tab labels are verified: `Your projects` / `Starred projects` /
// `Followed users` — the third one is NOT "Your activity". `?filter=starred`
// and `?filter=followed` drive it.
//
// byteblaze has zero events on this instance and there is no events.json in
// the seed, so the feed is the real empty state rather than fabricated rows.

const TABS = [
  { key: '', label: 'Your projects', href: '/dashboard/activity' },
  { key: 'starred', label: 'Starred projects', href: '/dashboard/activity?filter=starred' },
  { key: 'followed', label: 'Followed users', href: '/dashboard/activity?filter=followed' },
]

const EVENT_FILTERS = [
  { id: 'all_event_filter', label: 'All', title: 'Filter by all' },
  { id: 'push_event_filter', label: 'Push events', title: 'Filter by push events' },
  { id: 'merged_event_filter', label: 'Merge events', title: 'Filter by merge events' },
  { id: 'issue_event_filter', label: 'Issue events', title: 'Filter by issue events' },
  { id: 'comments_event_filter', label: 'Comments', title: 'Filter by comments' },
  { id: 'wiki_event_filter', label: 'Wiki', title: 'Filter by wiki' },
  { id: 'designs_event_filter', label: 'Designs', title: 'Filter by designs' },
  { id: 'team_event_filter', label: 'Team', title: 'Filter by team' },
]

export default function DashboardActivity() {
  const { state, currentUser } = useApp()
  const q = useQuery()
  const filter = q.get('filter', '') || ''
  usePageChrome({ title: 'Activity · Dashboard · GitLab' })

  const feedToken = currentUser.feed_token || ''

  return (
    <div>
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">Activity</h1>
      </div>

      <div className="top-area">
        <ul className="gl-border-b-0 nav gl-tabs-nav" data-testid="dashboard-activity-tabs">
          {TABS.map(t => (
            <li className="nav-item" key={t.label}>
              <a className={`nav-link gl-tab-nav-item${filter === t.key ? ' active gl-tab-nav-item-active' : ''}`}
                href={t.href}>{t.label}</a>
            </li>
          ))}
        </ul>
      </div>

      <section className="activities">
        <div className="nav-block activities gl-display-flex gl-align-items-center">
          <div className="scrolling-tabs-container inner-page-scroll-tabs is-smaller flex-fill">
            <ul className="nav-links event-filter scrolling-tabs nav nav-tabs is-initialized">
              {EVENT_FILTERS.map((f, i) => (
                <li className={i === 0 ? 'active' : ''} key={f.id}>
                  <a className="event-filter-link" id={f.id} title={f.title}
                    href={filter ? `/dashboard/activity?filter=${filter}` : '/dashboard/activity'}>
                    <span> {f.label}</span>
                  </a>
                </li>
              ))}
            </ul>
          </div>
          <div className="controls">
            <a title="Subscribe" aria-label="Subscribe"
              className="gl-button btn btn-icon btn-md btn-default gl-display-none gl-sm-display-inline-flex"
              href={`/dashboard/projects.atom?feed_token=${feedToken}`}>
              <Icon name="rss" className="gl-button-icon" />
            </a>
          </div>
        </div>

        {/* TEST.part-routes-a.md BUG-A08: this was the /dashboard/groups empty
            state. byteblaze has zero rows in `events` on this instance, so the
            source's real body here is a bare `No activities found` — verbatim
            from assets/html/dashboard-activity.html, on all three tabs. */}
        <div className="content_list">
          <div className="nothing-here-block">
            <div className="svg-content">
              <div className="text-content">
                <h5>No activities found</h5>
              </div>
            </div>
          </div>
        </div>
        <div className="loading" style={{ display: 'none' }}>
          <div className="gl-spinner-container" role="status">
            <span aria-label="Loading" className="gl-spinner gl-spinner-md gl-spinner-dark" />
          </div>
        </div>
      </section>
    </div>
  )
}
