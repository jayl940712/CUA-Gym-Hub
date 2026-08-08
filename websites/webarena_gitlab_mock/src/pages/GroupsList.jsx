import React from 'react'
import Icon from '../components/layout/Icon.jsx'
import { identiconBg, initialOf } from '../utils/format.js'
import '../components/create/create.css'

// The `groups-list-tree` rows shared by /dashboard/groups and /explore/groups
// (assets/README.md §6c.2). Not routed itself — DashboardGroups.jsx and
// ExploreGroups.jsx both render it.

/** GROUP visibility titles — note these differ from the PROJECT ones. */
export const GROUP_VISIBILITY_TITLES = {
  private: 'Private - The group and its projects can only be viewed by members.',
  internal: 'Internal - The group and any internal projects can be viewed by any logged in user except external users.',
  public: 'Public - The group and any public projects can be viewed without any authentication.',
}

export function groupStats(state, group) {
  return {
    subgroups: 0,
    projects: state.projects.filter(p => p.namespace && p.namespace.path === group.path).length,
    members: state.members.filter(m => m.source_type === 'namespace' && m.source_id === group.id).length,
  }
}

export function GroupRow({ state, group }) {
  const vis = group.visibility || 'private'
  const icon = vis === 'public' ? 'earth' : vis === 'internal' ? 'shield' : 'lock'
  const stats = groupStats(state, group)

  return (
    <li id={`group-${group.id}`} data-testid={`group-overview-item-${group.id}`} className="group-row">
      <div className="group-row-contents d-flex align-items-center py-2 pr-3">
        <div className="folder-toggle-wrap gl-mr-2 d-flex align-items-center">
          <span className="folder-caret gl-display-inline-block gl-text-secondary gl-mr-2">
            <Icon name="chevron-right" size={12} />
          </span>
          <span className="item-type-icon gl-display-inline-block gl-text-secondary">
            <Icon name="group" data-testid="subgroup-icon" />
          </span>
        </div>
        <a href={`/${group.path}`} aria-label={group.path} className="gl-mr-3">
          <div className={`gl-avatar gl-avatar-identicon gl-avatar-s32 identicon ${identiconBg(group.id)}`}>
            {initialOf(group.name)}
          </div>
        </a>
        <div className="group-text-container d-flex flex-fill align-items-center group-row-body">
          <div className="group-text flex-grow-1 flex-shrink-1">
            <div className="title namespace-title gl-font-weight-bold gl-mr-3 gl-display-flex gl-align-items-center">
              <a data-testid="group-name" href={`/${group.path}`} title={group.path}
                className="no-expand gl-mr-3 group-name">{group.name}</a>
              <Icon name={icon} data-testid="group-visibility-icon" className="gl-text-gray-500 gl-mr-3"
                title={GROUP_VISIBILITY_TITLES[vis]} />
            </div>
            {group.description ? <div className="description gl-text-gray-500">{group.description}</div> : null}
          </div>
          <div className="metadata group-row-stats">
            <span className="number-subgroups gl-ml-5" data-testid="subgroups-count" title="Subgroups">
              <Icon name="group" /> <span data-testid="itemStatValue" className="stat-value">{` ${stats.subgroups} `}</span>
            </span>
            <span className="number-projects gl-ml-5" data-testid="projects-count" title="Projects">
              <Icon name="project" /> <span data-testid="itemStatValue" className="stat-value">{` ${stats.projects} `}</span>
            </span>
            <span className="number-users gl-ml-5" title="Direct members">
              <Icon name="group" data-testid="users-icon" /> <span data-testid="itemStatValue" className="stat-value">{` ${stats.members} `}</span>
            </span>
          </div>
        </div>
      </div>
    </li>
  )
}

/** §6c.4 — the search empty state, reached via `?filter=`. */
export function SearchEmptyState() {
  return (
    <section className="gl-display-flex empty-state gl-text-center gl-flex-direction-column"
      data-testid="search-empty-state">
      <div className="gl-max-w-full gl-m-auto">
        <div className="gl-mx-auto gl-my-0 gl-p-5">
          <h1 className="gl-font-size-h-display h4">No results found</h1>
          <p className="gl-mt-3">Edit your search and try again</p>
        </div>
      </div>
    </section>
  )
}

/** Sorts offered by both group listings (§4a.5). Default `created_desc`. */
export const GROUP_SORTS = [
  ['name_asc', 'Name'],
  ['name_desc', 'Name, descending'],
  ['created_desc', 'Last created'],
  ['created_asc', 'Oldest created'],
  ['latest_activity_desc', 'Updated date'],
  ['latest_activity_asc', 'Oldest updated'],
]

export function sortGroups(rows, sort) {
  const s = [...rows]
  switch (sort) {
    case 'name_asc': return s.sort((a, b) => a.name.localeCompare(b.name))
    case 'name_desc': return s.sort((a, b) => b.name.localeCompare(a.name))
    case 'created_asc':
    case 'latest_activity_asc': return s.sort((a, b) => a.id - b.id)
    case 'latest_activity_desc':
    case 'created_desc':
    default: return s.sort((a, b) => b.id - a.id)
  }
}

export default function GroupsList({ state, groups }) {
  return (
    <div className="js-groups-list-holder">
      <div>
        <div className="groups-list-tree-container" data-qa-selector="groups_list_tree_container">
          <ul className="groups-list group-list-tree gl-display-flex gl-flex-direction-column gl-m-0">
            {groups.map(g => <GroupRow key={g.id} state={state} group={g} />)}
          </ul>
        </div>
      </div>
    </div>
  )
}
