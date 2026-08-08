import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import Icon from '../components/layout/Icon.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'

// ROUTES #64 — `/:ns/:proj/-/starrers`.
//
// The star counters on every project row and project header link here, so this
// page must reflect state.stars — including the rows tasks 523–527 create by
// clicking ★. Rendering only the seeded star_count would silently diverge from
// the starred list on /users/byteblaze/starred.

export default function Starrers() {
  const { state, indexes, currentUser } = useApp()
  const { project } = useProject()
  const q = useQuery()
  const [search, setSearch] = useState(q.get('search', ''))

  usePageChrome({
    title: project
      ? `${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  if (!project) return <NotFound />

  const stars = state.stars.filter(s => s.project_id === project.id)
  const rows = stars
    .map(s => ({ star: s, user: indexes.usersById.get(s.user_id) }))
    .filter(r => r.user)
    .filter(r => !search
      || r.user.name.toLowerCase().includes(search.toLowerCase())
      || r.user.username.toLowerCase().includes(search.toLowerCase()))

  // The source shows the seeded aggregate on the tab even when the individual
  // star rows were not all sampled, so take the larger of the two.
  const total = Math.max(project.star_count || 0, stars.length)

  return (
    <div>
      <div className="top-area gl-display-flex gl-align-items-center gl-flex-wrap" style={{ gap: 12 }}>
        <ul className="nav-links nav gl-tabs-nav gl-flex-grow-1">
          <li className="nav-item">
            <a className="nav-link gl-tab-nav-item active gl-tab-nav-item-active" href="#starrers">
              Starrers
              <span className="badge gl-tab-counter-badge badge-muted badge-pill gl-badge sm">{total}</span>
            </a>
          </li>
        </ul>
        <div className="nav-controls">
          <div className="input-group gl-search-box-by-type">
            <input type="search" className="form-control gl-form-input"
              placeholder="Search starrers" aria-label="Search starrers"
              value={search} onChange={e => setSearch(e.target.value)} />
            <div className="input-group-append">
              <span className="input-group-text"><Icon name="search" /></span>
            </div>
          </div>
        </div>
      </div>

      <ul className="content-list gl-mt-3">
        {rows.map(({ star, user }) => (
          <li className="gl-display-flex gl-align-items-center gl-py-3" key={user.id} style={{ gap: 12 }}>
            <a href={`/${user.username}`}><UserAvatar user={user} size={40} /></a>
            <div className="user-info gl-flex-grow-1">
              <div className="item-title">
                <a className="user js-user-link" href={`/${user.username}`}>{user.name}</a>
                {user.id === currentUser.id ? (
                  <span className="badge badge-success badge-pill gl-badge sm gl-ml-2">It&apos;s you</span>
                ) : null}
              </div>
              <div className="cgray gl-text-gray-500">@{user.username}</div>
            </div>
            {star.created_at ? (
              <div className="gl-text-gray-500">Starred <TimeAgo value={star.created_at} /></div>
            ) : null}
          </li>
        ))}
        {rows.length === 0 ? (
          <li className="nothing-here-block">
            {search ? 'Sorry, your filter produced no results.' : "This project isn't starred yet."}
          </li>
        ) : null}
      </ul>
    </div>
  )
}
