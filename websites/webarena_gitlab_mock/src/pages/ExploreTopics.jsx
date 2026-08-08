import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { useQuery } from './hooks.js'
import { ProjectsPrimaryTabs, DEFAULT_PROJECT_SORT } from '../components/ui/ProjectsNav.jsx'

// ROUTES #18 — `/explore/projects/topics`. The instance has no project topics,
// so the source renders an empty list; the seed carries none either
// (projects.json has no `topics` field), so this stays an empty state rather
// than inventing topics.
//
// TEST BUG-A12 / tail of BUG-A07 — every string and every wrapper below is the
// container's own. `app/views/explore/projects/topics.html.haml` renders
// `explore/topics/_head` (h1 `Projects`, NOT "Explore topics") which in turn
// renders `dashboard/_projects_nav` — the same primary strip as
// `/dashboard/projects` and `/explore/projects`, so this page must use the
// shared <ProjectsPrimaryTabs> rather than a hand-rolled one. The empty state is
// `shared/empty_states/_topics.html.haml`:
//     %h4= _('There are no topics to show.')
//     %p=  _('Add topics to projects to help users find them.')
// and nothing else — the two invented lines and the "Explore projects" button
// that used to live here were a parity break.
// The filter form is `shared/topics/_search_form.html.haml`.

export default function ExploreTopics() {
  const { state, currentUser } = useApp()
  const q = useQuery()
  const [search, setSearch] = useState(q.get('search', ''))
  usePageChrome({ title: 'Topics · Explore · GitLab' })

  // The two badges are the viewer's unfiltered totals, exactly as on the other
  // project-list routes (ProjectsNav.jsx BUG-A05).
  const starredIds = new Set(state.stars.filter(s => s.user_id === currentUser.id).map(s => s.project_id))
  const memberProjectIds = new Set(state.members
    .filter(m => m.source_type === 'project' && m.user_id === currentUser.id)
    .map(m => m.source_id))
  const ownedCount = state.projects.filter(p => memberProjectIds.has(p.id)
    || (p.namespace && p.namespace.path === currentUser.username)).length

  // Topics would come from projects[].topics; none exist on this instance.
  const topics = []
  const rows = topics.filter(t => !search || t.name.toLowerCase().includes(search.toLowerCase()))

  return (
    <div>
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">Projects</h1>
      </div>

      <div className="top-area">
        {/* The source's `.fade-left` / `.fade-right` scroll indicators are
            omitted here as on the other project-list routes: global.css does not
            implement the overflow behaviour, so they would render as two stray
            visible chevrons the source never shows. */}
        <ProjectsPrimaryTabs active="topics" sort={DEFAULT_PROJECT_SORT}
          ownedCount={ownedCount} starredCount={starredIds.size} />
        <div className="nav-controls">
          <form className="topic-filter-form js-topic-filter-form" id="topic-filter-form"
            onSubmit={e => e.preventDefault()}>
            <input type="search" name="search" id="topic-filter-form-field"
              className="topic-filter-form-field form-control input-short"
              placeholder="Filter by name" spellCheck="false"
              value={search} onChange={e => setSearch(e.target.value)} />
          </form>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="row empty-state">
          <div className="col-12">
            <div className="text-content gl-text-center gl-pt-0">
              <h4>There are no topics to show.</h4>
              <p>Add topics to projects to help users find them.</p>
            </div>
          </div>
        </div>
      ) : (
        <div className="row gl-mt-3">
          {rows.map(t => (
            <div className="col-lg-3 col-md-4 col-sm-12" key={t.name}>
              <div className="gl-card gl-mb-5">
                <div className="gl-card-body">
                  <a href={`/explore/projects/topics/${encodeURIComponent(t.name)}`}>{t.name}</a>
                  <div className="gl-text-gray-500">
                    {`${t.count} ${t.count === 1 ? 'project' : 'projects'}`}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
