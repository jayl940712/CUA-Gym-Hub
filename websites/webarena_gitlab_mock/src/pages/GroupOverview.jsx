import React from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { EntityAvatar } from '../components/layout/Avatar.jsx'
import { ProjectRow } from './DashboardProjects.jsx'
import { canManageMembers } from './MembersTable.jsx'
import { useQuery } from './hooks.js'
import NotFound from './NotFound.jsx'

// ROUTES #120 — `/:group` group overview. assets/README.md §1c.1.
//
// AUDIT P2-4 / DIFF-001. A slug that is neither seeded nor in `state.groups`
// now 404s, matching the source (`GET /groups/this-group-does-not-exist-r4`
// returns HTTP 404 `Not Found`, captured this round). The invented sentence
// `This group does not exist yet` is gone with it.
//
// This is safe for the five group-creation tasks: `createGroup()` writes the
// row into `state.groups` in the same `setState` that allocates its id, and the
// flow only navigates afterwards — so a task-created group is already in state
// by the time this page resolves its slug, and the shell-before-state-settles
// case the original comment was protecting against cannot occur.
//
// BUG-006 — GitLab 15.7 has TWO empty states here and the mock only had the
// second one, unconditionally, so a group's own OWNER was told they lacked
// permission on it the moment they created it. The switch is
// `groups_helper.rb#group_overview_tabs_app_data`:
//     can_create_subgroups: can?(current_user, :create_subgroup, group)
//     can_create_projects:  can?(current_user, :create_projects, group)
//     new_subgroup_path:    new_group_path(parent_id: group.id, anchor: 'create-group-pane')
//     new_project_path:     new_project_path(namespace_id: group.id)
// and `groups/components/empty_state.vue` renders either the two link cards or
// the permission notice. Copy is verbatim from the container's
// locale/gitlab.pot `GroupsEmptyState|…` msgids; the per-tab titles
// ("No shared projects." / "No archived projects.") come from the same block.

const TAB_EMPTY_TITLE = {
  subgroups_and_projects: 'No subgroups or projects.',
  shared: 'No shared projects.',
  archived: 'No archived projects.',
}

export default function GroupOverview() {
  const params = useParams()
  const slug = params.group || params.name
  const { state, currentUser } = useApp()
  const q = useQuery()
  const group = state.groups.find(g => g.path === slug)

  usePageChrome({ title: `${group ? group.name : slug} · GitLab` })

  if (!group) return <NotFound />

  // The three tabs the source renders. `shared` lists projects owned by other
  // namespaces that were shared into this group — the seed models no group
  // shares, so that tab is legitimately empty.
  const tab = q.get('shared') ? 'shared'
    : q.get('archived') === 'only' ? 'archived' : 'subgroups_and_projects'

  const owned = state.projects.filter(p => p.namespace && p.namespace.path === slug)
  const projects = tab === 'shared' ? []
    : tab === 'archived' ? owned.filter(p => p.archived)
      : owned.filter(p => !p.archived)

  // Same predicate GroupMembers.jsx uses for the group's admin affordances.
  const canCreate = !!group && canManageMembers(state, currentUser, 'namespace', group.id)
  const newSubgroupPath = group ? `/groups/new?parent_id=${group.id}#create-group-pane` : '/groups/new'
  const newProjectPath = group ? `/projects/new?namespace_id=${group.id}` : '/projects/new'

  return (
    <div className="group-home">
      <div className="group-home-panel gl-display-flex gl-align-items-center gl-my-5" style={{ gap: 16 }}>
        <EntityAvatar entity={group || { id: 0, name: slug }} size={64} kind="group" />
        <div>
          <h1 className="home-panel-title gl-font-size-h1 gl-mb-2">{group ? group.name : slug}</h1>
          <div className="home-panel-metadata gl-text-gray-500 gl-font-sm">
            Group ID: {group ? group.id : '—'}
          </div>
          {group && group.description ? <p className="gl-mt-2">{group.description}</p> : null}
        </div>
        {canCreate ? (
          <div className="gl-ml-auto gl-display-flex" style={{ gap: 8 }}>
            <a className="btn gl-button btn-default" href={newSubgroupPath}>New subgroup</a>
            <a className="btn gl-button btn-confirm" href={newProjectPath}>New project</a>
          </div>
        ) : null}
      </div>

      <div className="top-area">
        <ul className="nav-links nav gl-tabs-nav">
          <li className="nav-item"><a className={`nav-link gl-tab-nav-item${tab === 'subgroups_and_projects' ? ' active gl-tab-nav-item-active' : ''}`} href={`/${slug}`}>Subgroups and projects</a></li>
          <li className="nav-item"><a className={`nav-link gl-tab-nav-item${tab === 'shared' ? ' active gl-tab-nav-item-active' : ''}`} href={`/${slug}?shared=1`}>Shared projects</a></li>
          <li className="nav-item"><a className={`nav-link gl-tab-nav-item${tab === 'archived' ? ' active gl-tab-nav-item-active' : ''}`} href={`/${slug}?archived=only`}>Archived projects</a></li>
        </ul>
      </div>

      {projects.length === 0 ? (
        <div className="gl-text-center gl-py-13" data-testid="group-empty-state">
          {canCreate && tab === 'subgroups_and_projects' ? (
            <div className="row">
              <div className="col-md-6">
                <a className="gl-link gl-display-block gl-p-5" href={newSubgroupPath}>
                  <h5>Create new subgroup</h5>
                  <p>Groups are the best way to manage multiple projects and members.</p>
                </a>
              </div>
              <div className="col-md-6">
                <a className="gl-link gl-display-block gl-p-5" href={newProjectPath}>
                  <h5>Create new project</h5>
                  <p>Projects are where you can store your code, access issues, wiki, and other features of Gitlab.</p>
                </a>
              </div>
            </div>
          ) : (
            <>
              <h5>{TAB_EMPTY_TITLE[tab]}</h5>
              {tab === 'subgroups_and_projects' ? (
                <p>You do not have necessary permissions to create a subgroup or project in this group. Please contact an owner of this group to create a new subgroup or project.</p>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <ul className="projects-list content-list group-list-tree" data-qa-selector="projects_list">
          {projects.map(p => <ProjectRow key={p.id} project={p} />)}
        </ul>
      )}
    </div>
  )
}
