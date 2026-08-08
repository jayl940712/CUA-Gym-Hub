import React from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import Icon from '../components/layout/Icon.jsx'
import NotFound from './NotFound.jsx'
import GroupOverview from './GroupOverview.jsx'
import { ProjectRow } from './DashboardProjects.jsx'
import { formatLongDate } from '../utils/format.js'
import { STATUS_EMOJI, shortWebsiteUrl, fullWebsiteUrl } from '../components/people/profileUtils.js'

// ROUTES #25 / #26–#33 — `/:username` and `/users/:username/*`.
// assets/README.md §7 / §8a / §8b / §8c / §8d.
//
// All nine routes render the IDENTICAL page (§7.1); only the active tab and
// the active `.tab-pane` differ. There is no `?tab=` variant.
//
// ANCHORS (assets/README.md §0.9, §7.5, §7.6, §8a.2):
//   .cover-status                     `lastChild.textContent` must be exactly
//                                     the message, so the emoji lives in its
//                                     OWN preceding element and the message is
//                                     a BARE text node (tasks 418–422).
//   .profile-header [itemprop="url"]  website, scheme stripped from the TEXT,
//                                     unique inside .profile-header
//                                     (tasks 448–452).
//   .user-profile                     wrapper read whole on
//                                     /users/:u/following (tasks 533–537).
//   /users/:u/starred                 whole-page text match (tasks 523–527).

const TABS = [
  { key: 'overview', label: 'Overview', href: u => `/${u}`, pane: 'js-overview' },
  { key: 'activity', label: 'Activity', href: u => `/users/${u}/activity`, pane: 'activity' },
  { key: 'groups', label: 'Groups', href: u => `/users/${u}/groups`, pane: 'groups' },
  { key: 'contributed', label: 'Contributed projects', href: u => `/users/${u}/contributed`, pane: 'contributed' },
  { key: 'projects', label: 'Personal projects', href: u => `/users/${u}/projects`, pane: 'projects' },
  { key: 'starred', label: 'Starred projects', href: u => `/users/${u}/starred`, pane: 'starred' },
  { key: 'snippets', label: 'Snippets', href: u => `/users/${u}/snippets`, pane: 'snippets' },
  { key: 'followers', label: 'Followers', href: u => `/users/${u}/followers`, pane: 'followers' },
  { key: 'following', label: 'Following', href: u => `/users/${u}/following`, pane: 'following' },
]

/**
 * §8a.3 — the follower/following card grid. `@handle` must be rendered text
 * because `.user-profile`'s outerText is the anchor.
 * Empty list renders NOTHING (the source partial has no empty branch).
 */
function UserCardGrid({ users }) {
  if (!users.length) return null
  return (
    <div className="row gl-mt-3">
      {users.map(u => (
        <div className="col-lg-3 col-md-4 col-sm-12" key={u.id}>
          <div className="gl-card gl-mb-5">
            <div className="gl-card-body">
              <UserAvatar user={u} size={48} className="gl-float-left gl-mr-3" />
              <div className="user-info">
                <div className="block-truncated">
                  <a className="user js-user-link" data-user-id={u.id} data-qa-selector="user_link"
                    data-qa-username={u.username} href={`/${u.username}`}>{u.name}</a>
                </div>
                <div className="block-truncated">
                  <span className="gl-text-gray-900">@{u.username}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

/**
 * §7.2 / §7.7 layout, scoped to `.user-profile`.
 *
 * These rules live here rather than in src/styles/global.css because that file
 * is shared with the other feature shards; everything below is prefixed with
 * `.user-profile` so it cannot leak. The measurements come from §7.2 (cover
 * band centred at 1920px, 96px circular avatar, 600px bio column, centred tab
 * strip with a 2px active indicator) and §7.4 (the `·` separators are CSS
 * ::after content on .middle-dot-divider, NOT text nodes — putting them in the
 * DOM would corrupt the `.user-profile` outerText anchor).
 */
const PROFILE_CSS = `
.user-profile { position: relative; }
.user-profile .cover-block.user-cover-block {
  background: #fbfafd; padding: 24px 0 0; text-align: center; position: relative;
}
.user-profile .cover-controls {
  position: absolute; top: 16px; right: 16px; display: flex; gap: 8px;
}
.user-profile .cover-controls .btn { width: auto; }
.user-profile .avatar-holder { display: flex; justify-content: center; margin-bottom: 16px; }
.user-profile h1.cover-title {
  font-size: 23px; font-weight: 600; color: #333238; margin: 0 0 8px;
}
.user-profile .cover-status { justify-content: center; margin-bottom: 8px; }
.user-profile .user-info { color: #333238; }
.user-profile .middle-dot-divider:not(:last-child)::after {
  content: "\\00b7"; margin: 0 8px; color: #737278;
}
.user-profile .middle-dot-divider-sm:not(:last-child)::after {
  content: "\\00b7"; margin: 0 8px; color: #737278;
}
.user-profile .gl-mb-3 { margin-bottom: 4px; }
/* The header chips are one wrapped line, not a stack — the gl-* utility
   classes carry that in the source's own CSS, which the mock does not ship. */
.user-profile .user-info .gl-display-inline-block { display: inline-block; }
.user-profile .user-info .gl-sm-display-inline-block { display: inline-block; }
.user-profile .user-info > div { line-height: 1.6; }
/* The calendar row is d-none d-sm-flex; restore it above the sm breakpoint. */
.user-profile .row.d-none.d-sm-flex { display: flex !important; }
.user-profile .calendar { display: inline-block; }
.user-profile .profile-user-bio {
  max-width: 600px; margin: 8px auto 0; color: #333238;
}
.user-profile .btn-clipboard { padding: 0 4px; vertical-align: middle; }
.user-profile .scrolling-tabs-container { margin-top: 16px; }
.user-profile ul.user-profile-nav {
  display: flex; justify-content: center; list-style: none; margin: 0; padding: 0;
  border-bottom: 1px solid #dcdcde; background: #fbfafd;
}
.user-profile ul.user-profile-nav .nav-link {
  display: block; padding: 16px 12px; color: #737278; font-weight: 400;
  border-bottom: 2px solid transparent; text-decoration: none;
}
.user-profile ul.user-profile-nav .nav-link:hover { color: #333238; }
.user-profile ul.user-profile-nav .nav-link.active {
  color: #000; font-weight: 600; border-bottom-color: #000;
}
.user-profile .tab-content { max-width: 1248px; margin: 0 auto; padding: 16px; }
.user-profile .calendar-hint { text-align: right; color: #737278; font-size: 12px; }
.user-profile .nothing-here-block { text-align: center; padding: 32px 16px; color: #333238; }
.user-profile .nothing-here-block .btn { margin: 4px; }
.user-profile .activities-block h4, .user-profile .projects-block h4 { margin: 0; }
.user-profile .activities-block > .gl-display-flex,
.user-profile .projects-block > .gl-display-flex {
  border-bottom: 1px solid #dcdcde; padding-bottom: 8px; margin-bottom: 8px;
}
.user-profile .gl-card { border: 1px solid #dcdcde; border-radius: 4px; background: #fff; }
.user-profile .gl-card-body { padding: 16px; overflow: hidden; }
.user-profile .gl-card-body .user-info { text-align: left; }
.user-profile .row { display: flex; flex-wrap: wrap; margin: 0 -8px; }
.user-profile .row > [class^="col-"] { padding: 0 8px; box-sizing: border-box; }
.user-profile .col-12 { width: 100%; }
.user-profile .col-md-12 { width: 100%; }
.user-profile .col-lg-6 { width: 50%; }
.user-profile .col-lg-3 { width: 25%; }
@media (max-width: 1200px) {
  .user-profile .col-lg-6, .user-profile .col-lg-3 { width: 100%; }
}
`

/**
 * §7.9 — the contribution calendar. 53 week columns x 7 day rows, 15px cells
 * on a 17px pitch, three weekday labels (M/W/F), a 5-swatch legend with the
 * source's tooltip strings, and the `.calendar-hint` caption. byteblaze's real
 * calendar is entirely empty (every cell data-level="0"), and there is no
 * "N contributions in the last year" heading in 15.7 — that is GitHub.
 */
const LEGEND_TITLES = ['No contributions', '1-9 contributions', '10-19 contributions',
  '20-29 contributions', '30+ contributions']
const LEVEL_FILL = ['#ededf0', '#acd5f2', '#7fa8d1', '#3c76ab', '#254e77']
const MONTH_LABELS = ['Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug']
const MONTH_X = [35, 103, 171, 239, 324, 392, 460, 528, 613, 681, 766, 834, 902]

function ContributionCalendar() {
  const weeks = []
  for (let w = 0; w < 53; w += 1) {
    const cells = []
    for (let d = 0; d < 7; d += 1) {
      cells.push(
        <rect key={d} x="0" y={17 * d} width="15" height="15" data-level="0"
          className="user-contrib-cell has-tooltip" fill={LEVEL_FILL[0]} />
      )
    }
    weeks.push(<g key={w} transform={`translate(${18 + 17 * w}, 18)`}>{cells}</g>)
  }
  return (
    <svg width="924" height="169" className="contrib-calendar" role="img"
      aria-label="Contribution calendar" style={{ maxWidth: '100%' }}>
      {MONTH_LABELS.map((m, i) => (
        <text key={`${m}-${i}`} x={MONTH_X[i]} y="10" className="user-contrib-text"
          fontSize="10" fill="#737278">{m}</text>
      ))}
      {['M', 'W', 'F'].map((d, i) => (
        <text key={d} textAnchor="middle" x="8" y={29 + 17 * (i * 2 + 1)}
          className="user-contrib-text" fontSize="10" fill="#737278">{d}</text>
      ))}
      {weeks}
      <g transform="translate(18, 152)">
        {LEGEND_TITLES.map((t, i) => (
          <rect key={t} x={17 * i} y="0" width="15" height="15" data-level={i}
            className="user-contrib-cell has-tooltip contrib-legend" fill={LEVEL_FILL[i]}>
            <title>{t}</title>
          </rect>
        ))}
      </g>
    </svg>
  )
}

/** §7.8 / §8d.2 — the `nothing-here-block` empty state, verbatim copy. */
function NothingHere({ children, extraClass = '' }) {
  return (
    <div className={`nothing-here-block${extraClass ? ` ${extraClass}` : ''}`}>
      <div className="svg-content">
        <div className="text-content">{children}</div>
      </div>
    </div>
  )
}

function ActivityEmptyState() {
  return (
    <NothingHere>
      <h5>Join or create a group to start contributing by commenting on issues or submitting merge requests!</h5>
      <a className="gl-button btn btn-confirm btn-inverted" href="/explore/groups">Explore groups</a>
      <a className="gl-button btn btn-confirm" href="/groups/new">New group</a>
    </NothingHere>
  )
}

export default function UserProfile({ tab }) {
  const params = useParams()
  const username = params.username || params.name
  const { state, currentUser, setState } = useApp()

  const user = state.users.find(u => u.username === username)
  const group = state.groups.find(g => g.path === username)

  // `/:name` is shared with the group overview. The child's title effect fires
  // BEFORE the parent's, so this hook would otherwise clobber GroupOverview's.
  usePageChrome({ title: user ? `${user.name} · GitLab` : group ? `${group.name} · GitLab` : 'GitLab' })

  // `/:name` resolves to a group overview when the namespace is a group.
  if (!user && group) return <GroupOverview />
  if (!user) return <NotFound />

  const activeTab = tab || 'overview'
  const isSelf = user.id === currentUser.id
  const status = user.status || null

  const starredIds = new Set(state.stars.filter(s => s.user_id === user.id).map(s => s.project_id))
  // StarredProjectsFinder / ProjectsFinder default sort is project id DESC (§8b.2).
  const byIdDesc = rows => [...rows].sort((a, b) => b.id - a.id)
  const personal = byIdDesc(state.projects.filter(p => p.namespace && p.namespace.path === user.username))
  const starred = byIdDesc(state.projects.filter(p => starredIds.has(p.id)))
  const contributedIds = new Set(state.members
    .filter(m => m.source_type === 'project' && m.user_id === user.id).map(m => m.source_id))
  const contributed = byIdDesc(state.projects.filter(p => contributedIds.has(p.id)))

  const following = state.follows.filter(f => f.follower_id === user.id)
    .map(f => state.users.find(u => u.id === f.followee_id)).filter(Boolean)
  const followers = state.follows.filter(f => f.followee_id === user.id)
    .map(f => state.users.find(u => u.id === f.follower_id)).filter(Boolean)
  const isFollowing = state.follows.some(f => f.follower_id === currentUser.id && f.followee_id === user.id)

  const groupIds = new Set(state.members
    .filter(m => m.source_type === 'namespace' && m.user_id === user.id).map(m => m.source_id))
  const userGroups = state.groups.filter(g => groupIds.has(g.id))

  // §7.3 — POST /users/:u/follow.json; the mock mutates local state so the
  // Following tab, the header counts and the button label all move together.
  function toggleFollow() {
    setState(prev => {
      const has = prev.follows.some(f => f.follower_id === currentUser.id && f.followee_id === user.id)
      return {
        ...prev,
        follows: has
          ? prev.follows.filter(f => !(f.follower_id === currentUser.id && f.followee_id === user.id))
          : [...prev.follows, { follower_id: currentUser.id, followee_id: user.id }],
        users: prev.users.map(u => {
          if (u.id === user.id) return { ...u, followers: Math.max(0, (u.followers || 0) + (has ? -1 : 1)) }
          if (u.id === currentUser.id) return { ...u, following: Math.max(0, (u.following || 0) + (has ? -1 : 1)) }
          return u
        }),
      }
    })
  }

  const emoji = STATUS_EMOJI[(status && status.emoji) || 'speech_balloon'] || STATUS_EMOJI.speech_balloon
  const website = user.website_url || ''

  return (
    <div className="user-profile">
      <style>{PROFILE_CSS}</style>
      <div className="cover-block user-cover-block">
        {/* §7.3 — icon buttons, right aligned. Follow/Unfollow only on someone
            else's profile; that is the control tasks 533–537 drive. */}
        <div className="cover-controls d-flex px-2 pb-4 d-sm-block p-sm-0">
          {isSelf ? (
            <>
              <a className="gl-button btn btn-icon btn-md btn-default gl-flex-grow-1 gl-mx-1 has-tooltip"
                title="Edit profile" aria-label="Edit profile" href="/-/profile">
                <Icon name="pencil" className="gl-button-icon" />
              </a>
              <a className="gl-button btn btn-icon btn-md btn-default gl-flex-grow-1 gl-mx-1 has-tooltip"
                title="Subscribe" aria-label="Subscribe"
                href={`/${user.username}.atom?feed_token=${user.feed_token || ''}`}>
                <Icon name="rocket" className="gl-button-icon" />
              </a>
            </>
          ) : (
            <>
              <a className="gl-button btn btn-icon btn-md btn-default gl-flex-grow-1 gl-mx-1 has-tooltip"
                title="Report abuse to administrator" aria-label="Report abuse to administrator"
                href={`/-/abuse_reports/new?user_id=${user.id}`}>
                <Icon name="close" className="gl-button-icon" />
              </a>
              <a className="gl-button btn btn-icon btn-md btn-default gl-flex-grow-1 gl-mx-1 has-tooltip"
                title="Subscribe" aria-label="Subscribe"
                href={`/${user.username}.atom`}>
                <Icon name="rocket" className="gl-button-icon" />
              </a>
              <button type="button"
                className="gl-button btn btn-md btn-confirm gl-flex-grow-1 gl-mx-1"
                data-qa-selector="follow_user_link"
                data-track-label={isFollowing ? 'unfollow_from_profile' : 'follow_from_profile'}
                onClick={toggleFollow}>
                <span className="gl-button-text">{isFollowing ? 'Unfollow' : 'Follow'}</span>
              </button>
            </>
          )}
        </div>

        <div className="profile-header">
          <div className="avatar-holder">
            <UserAvatar user={user} size={96} className="gl-avatar-s96" />
          </div>

          <div className="user-info">
            <h1 className="cover-title" itemProp="name">
              {user.name}
              {user.pronouns
                ? <span className="gl-font-base gl-text-gray-500 gl-vertical-align-middle">{` (${user.pronouns})`}</span>
                : null}
              {status && status.availability === 'busy'
                ? <span className="gl-font-base gl-text-gray-500 gl-vertical-align-middle"> (Busy)</span>
                : null}
            </h1>

            {/* ANCHOR §7.5 — `.cover-status`. The emoji is its OWN element and
                the message is the LAST child, a bare text node, so that
                `.cover-status.lastChild.textContent` is exactly the message.
                Nothing may be appended after it. */}
            {status && (status.message || (status.emoji && status.emoji !== 'speech_balloon')) ? (
              <div className="cover-status gl-display-inline-flex gl-align-items-center">
                <gl-emoji title={emoji.title} data-name={emoji.name}
                  data-unicode-version={emoji.version} class="gl-mr-2">{emoji.char}</gl-emoji>
                {status.message || ''}
              </div>
            ) : null}

            {/* users/_profile_basic_info */}
            <div className="gl-text-gray-900 gl-mt-4">
              <div className="gl-mb-3 gl-display-inline-block middle-dot-divider">
                @{user.username}
              </div>
              <div className="gl-mb-3 gl-display-inline-block middle-dot-divider">
                {`User ID: ${user.id}`}
                <button type="button" title="Copy user ID" aria-label="Copy user ID" aria-live="polite"
                  className="btn btn-clipboard gl-button btn-default-tertiary btn-icon btn-sm"
                  data-clipboard-text={String(user.id)}
                  onClick={() => navigator.clipboard && navigator.clipboard.writeText(String(user.id))}>
                  <Icon name="copy" />
                </button>
              </div>
              <div className="gl-mb-3 gl-display-inline-block middle-dot-divider">
                {`Member since ${formatLongDate(user.created_at)}`}
              </div>
            </div>

            {/* location / organisation */}
            <div className="gl-text-gray-900 mb-1 mb-sm-2">
              {user.location ? (
                <div className="gl-mb-3 middle-dot-divider-sm gl-display-block gl-sm-display-inline-block"
                  itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
                  <Icon name="earth" className="fgray" data-testid="location-icon" />
                  <span itemProp="addressLocality">{user.location}</span>
                </div>
              ) : null}
              {user.organization ? (
                <div className="gl-mb-3 middle-dot-divider-sm gl-display-block gl-sm-display-inline-block">
                  <Icon name="project" className="fgray" data-testid="work-icon" />
                  <span>
                    {user.job_title ? <span itemProp="jobTitle">{user.job_title}</span> : null}
                    {user.job_title ? ' at ' : null}
                    <span itemProp="worksFor">{user.organization}</span>
                  </span>
                </div>
              ) : null}
            </div>

            {/* ANCHOR §7.6 — website / public email row. Empty in the seed;
                a task fills it in via /-/profile. The visible text is the bare
                host (scheme stripped); the href keeps/adds a scheme. */}
            <div className="gl-text-gray-900">
              {website ? (
                <div className="gl-mb-3 middle-dot-divider-sm gl-display-block gl-sm-display-inline-block">
                  <a target="_blank" rel="me noopener noreferrer nofollow" itemProp="url"
                    href={fullWebsiteUrl(website)}>{shortWebsiteUrl(website)}</a>
                </div>
              ) : null}
              {user.public_email ? (
                <div className="gl-mb-3 middle-dot-divider-sm gl-display-block gl-sm-display-inline-block">
                  <a itemProp="email" href={`mailto:${user.public_email}`}>{user.public_email}</a>
                </div>
              ) : null}
            </div>

            {/* followers / following */}
            <div className="gl-text-gray-900">
              <Icon name="group" className="gl-vertical-align-middle gl-text-gray-500" data-testid="users-icon" />
              <div className="gl-mb-3 gl-display-inline-block middle-dot-divider">
                <a href={`/users/${user.username}/followers`}>
                  {`${followers.length} ${followers.length === 1 ? 'follower' : 'followers'}`}
                </a>
              </div>
              <div className="gl-mb-3 gl-display-inline-block middle-dot-divider">
                <a data-qa-selector="following_link" href={`/users/${user.username}/following`}>
                  {`${following.length} following`}
                </a>
              </div>
            </div>
          </div>

          <div className="gl-text-gray-900">
            {user.bio ? <div className="profile-user-bio">{user.bio}</div> : null}
          </div>
        </div>
      </div>

      {/* §7.7 — nine tabs, no counts, centred. */}
      <div className="scrolling-tabs-container">
        <ul className="nav-links user-profile-nav scrolling-tabs nav nav-tabs is-initialized">
          {TABS.map(t => (
            <li className={`nav-item js-${t.key}-tab`} key={t.key}>
              <a className={`nav-link${activeTab === t.key ? ' active' : ''}`}
                data-toggle="tab" data-target={`div#${t.pane}`} data-action={t.key}
                href={t.href(user.username)}>{t.label}</a>
            </li>
          ))}
        </ul>
      </div>

      <div className="tab-content">
        {activeTab === 'overview' && (
          <div className="tab-pane active" id="js-overview">
            <div className="row d-none d-sm-flex">
              <div className="col-12 calendar-block gl-my-3">
                <div className="user-calendar light"
                  data-calendar-path={`/users/${user.username}/calendar.json`} data-utc-offset="0">
                  <div className="calendar">
                    <div className="js-contrib-calendar"><ContributionCalendar /></div>
                    <div className="calendar-hint">Issues, merge requests, pushes, and comments.</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="row"><div className="col-12 user-calendar-activities" /></div>
            <div className="row">
              <div className="col-md-12 col-lg-6">
                <div className="activities-block">
                  <div className="gl-display-flex gl-align-items-center">
                    <h4 className="gl-flex-grow-1">Activity</h4>
                    {/* DIFF-A02 — the source ships this link with `.hide` and
                        only unhides it once the activity feed loads rows; with
                        an empty feed it never appears in the page text. The
                        mock has no `.hide` rule, so the class alone left a
                        `View all` standing under `Activity` that the source
                        does not render. */}
                    <a className="hide js-view-all" style={{ display: 'none' }}
                      href={`/users/${user.username}/activity`}>View all</a>
                  </div>
                  <div className="overview-content-list" data-href={`/users/${user.username}/activity`}
                    data-qa-selector="user_activity_content">
                    <ActivityEmptyState />
                  </div>
                </div>
              </div>
              <div className="col-md-12 col-lg-6">
                <div className="projects-block">
                  <div className="gl-display-flex gl-align-items-center">
                    <h4 className="gl-flex-grow-1">Personal projects</h4>
                    <a className="js-view-all" href={`/users/${user.username}/projects`}>View all</a>
                  </div>
                  <div className="overview-content-list" data-href={`/users/${user.username}/projects`}>
                    <div className="js-projects-list-holder" data-qa-selector="projects_list">
                      <ul className="projects-list gl-text-secondary gl-w-full gl-my-2 compact">
                        {personal.slice(0, 10).map(p => <ProjectRow key={p.id} project={p} compact />)}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="tab-pane active" id="activity">
            <div className="flash-container" />
            <h4 className="prepend-top-20">Most Recent Activity</h4>
            <div className="content_list" data-href={`/users/${user.username}/activity`}>
              <ActivityEmptyState />
            </div>
          </div>
        )}

        {activeTab === 'groups' && (
          <div className="tab-pane active" id="groups">
            {userGroups.length ? (
              <ul className="content-list">
                {userGroups.map(g => (
                  <li className="group-row py-3 gl-align-items-center gl-display-flex!" key={g.id}>
                    <div className="gl-min-w-0 gl-flex-grow-1">
                      <div className="title"><a className="group-name" href={`/${g.path}`}>{g.name}</a></div>
                      {g.description ? <div className="description">{g.description}</div> : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : isSelf ? (
              <NothingHere>
                <h5>You can create a group for several dependent projects.</h5>
                <p>Groups are the best way to manage projects and members.</p>
                <a className="gl-button btn btn-confirm" href="/groups/new">New group</a>
              </NothingHere>
            ) : (
              <NothingHere><h5>This user is not a member of any groups.</h5></NothingHere>
            )}
          </div>
        )}

        {activeTab === 'contributed' && (
          <div className="tab-pane active" id="contributed">
            <div className="js-projects-list-holder" data-qa-selector="projects_list">
              <ul className="projects-list gl-text-secondary gl-w-full gl-my-2">
                {contributed.map(p => <ProjectRow key={p.id} project={p} />)}
              </ul>
            </div>
            {contributed.length === 0 ? (
              <NothingHere><h5>No projects found</h5></NothingHere>
            ) : null}
          </div>
        )}

        {activeTab === 'projects' && (
          <div className="tab-pane active" id="projects">
            <div className="js-projects-list-holder" data-qa-selector="projects_list">
              <ul className="projects-list gl-text-secondary gl-w-full gl-my-2">
                {personal.map(p => <ProjectRow key={p.id} project={p} />)}
              </ul>
            </div>
            {personal.length === 0 ? (
              <NothingHere>
                <h5>You haven&apos;t created any personal projects.</h5>
                <a className="gl-button btn btn-confirm" href="/projects/new">New project</a>
              </NothingHere>
            ) : null}
          </div>
        )}

        {/* §8b — ANCHOR page for tasks 523–527: the project names must be
            readable in the page text once starred. */}
        {activeTab === 'starred' && (
          <div className="tab-pane active" id="starred">
            <div className="js-projects-list-holder" data-qa-selector="projects_list">
              <ul className="projects-list gl-text-secondary gl-w-full gl-my-2">
                {starred.map(p => <ProjectRow key={p.id} project={p} />)}
              </ul>
            </div>
            {starred.length === 0 ? (
              <NothingHere>
                <h5>You don&apos;t have starred projects yet.</h5>
                <p>Visit a project page and press on a star icon. Then, you can find the project on this page.</p>
                <a className="gl-button btn btn-confirm" href="/explore/projects/starred">Explore projects</a>
              </NothingHere>
            ) : null}
          </div>
        )}

        {activeTab === 'snippets' && (
          <div className="tab-pane active" id="snippets">
            <NothingHere>
              <h5>You don&apos;t have any snippets yet.</h5>
              <p>Store, share, and embed bits of code and text.</p>
              <a className="gl-button btn btn-confirm" href="/-/snippets/new">New snippet</a>
            </NothingHere>
          </div>
        )}

        {activeTab === 'followers' && (
          <div className="tab-pane active" id="followers"><UserCardGrid users={followers} /></div>
        )}

        {/* ANCHOR §8a.2 — every followed user's `@handle` must be rendered text
            inside `.user-profile` (tasks 533–537). */}
        {activeTab === 'following' && (
          <div className="tab-pane active" id="following"><UserCardGrid users={following} /></div>
        )}
      </div>
    </div>
  )
}
