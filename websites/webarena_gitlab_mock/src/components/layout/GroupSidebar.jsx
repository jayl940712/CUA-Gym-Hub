import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import Icon from './Icon.jsx'
import { EntityAvatar } from './Avatar.jsx'

// assets/README.md §1c.1 — the group sidebar has FOUR sections, and the Issues
// sub-item is `Board` (singular), unlike the project sidebar's `Boards`.

export default function GroupSidebar({ ctx }) {
  const { state, sidebarCollapsed, setSidebarCollapsed } = useApp()
  const slug = ctx.groupPath
  const group = ctx.group || { id: 0, path: slug, name: slug }
  const g = `/groups/${slug}`

  // Group-scoped rollups: projects whose namespace is this group.
  const projectIds = state.projects.filter(p => p.namespace && p.namespace.path === slug).map(p => p.id)
  const openIssues = state.issues.filter(i => projectIds.includes(i.project_id) && i.state === 'opened').length
  const openMrs = state.mergeRequests.filter(m => projectIds.includes(m.project_id) && m.state === 'opened').length

  const sections = [
    {
      key: 'group_information', label: 'Group information', icon: 'group', href: `${g}/-/activity`,
      qa: 'Group information',
      items: [
        { key: 'activity', label: 'Activity', href: `${g}/-/activity` },
        { key: 'labels', label: 'Labels', href: `${g}/-/labels` },
        { key: 'members', label: 'Members', href: `${g}/-/group_members` },
      ],
    },
    {
      key: 'issues', label: 'Issues', icon: 'issues', href: `${g}/-/issues`, counter: openIssues,
      counterClass: 'issue_counter',
      items: [
        { key: 'list', label: 'List', aria: 'Issues', href: `${g}/-/issues` },
        { key: 'board', label: 'Board', href: `${g}/-/boards` },
        { key: 'milestones', label: 'Milestones', href: `${g}/-/milestones` },
      ],
    },
    {
      key: 'merge_requests', label: 'Merge requests', icon: 'git-merge', href: `${g}/-/merge_requests`,
      counter: openMrs, counterClass: 'merge_counter js-merge-counter', items: [],
    },
    {
      key: 'packages_registries', label: 'Packages and registries', icon: 'package', href: `${g}/-/packages`,
      items: [{ key: 'package_registry', label: 'Package Registry', href: `${g}/-/packages` }],
    },
  ]

  const activeTop = ({
    activity: 'group_information', labels: 'group_information', group_members: 'group_information',
    issues: 'issues', boards: 'issues', milestones: 'issues',
    merge_requests: 'merge_requests', packages: 'packages_registries',
  })[ctx.section] || null

  return (
    <aside className={`nav-sidebar${sidebarCollapsed ? ' sidebar-collapsed-desktop js-sidebar-collapsed' : ''}`}
      aria-label="Group navigation">
      <div className="nav-sidebar-inner-scroll">
        <ul className="sidebar-top-level-items" data-qa-selector="group_sidebar">
          <li data-track-label="scope_menu" className="context-header has-tooltip active" title={slug}>
            <a aria-label={slug} className="gl-link" data-qa-selector="sidebar_menu_link"
              data-qa-menu-item="Group scope" href={`/${slug}`}>
              <EntityAvatar entity={group} size={32} kind="group" />
              <span className="sidebar-context-title">{slug}</span>
            </a>
          </li>
          {sections.map(s => {
            const isActive = activeTop === s.key
            return (
              <li key={s.key} data-track-label={`${s.key}_menu`} className={isActive ? 'active' : ''}>
                <a aria-label={s.label} className={`${s.items.length ? 'has-sub-items ' : ''}gl-link`}
                  data-qa-selector="sidebar_menu_link" data-qa-menu-item={s.qa || s.label} href={s.href}>
                  <span className="nav-icon-container"><Icon name={s.icon} /></span>
                  <span className="nav-item-name">{s.label}</span>
                  {s.counter != null && (
                    <span className={`gl-badge badge badge-pill badge-info sm count ${s.counterClass}`}>{s.counter}</span>
                  )}
                </a>
                <ul className={`sidebar-sub-level-items${s.items.length ? '' : ' is-fly-out-only'}`}
                  style={{ display: isActive && s.items.length ? 'block' : 'none' }}>
                  {s.items.map(it => (
                    <li key={it.key} className={ctx.section === it.key || (it.key === 'members' && ctx.section === 'group_members') ? 'active' : ''}>
                      <a aria-label={it.aria || it.label} className="gl-link"
                        data-qa-selector="sidebar_menu_item_link" data-qa-menu-item={it.label}
                        href={it.href}>{it.label}</a>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}
        </ul>
        <a className="toggle-sidebar-button js-toggle-sidebar rspec-toggle-sidebar" role="button"
          title="Toggle sidebar" type="button" onClick={() => setSidebarCollapsed(c => !c)}>
          <Icon name={sidebarCollapsed ? 'angle-double-right' : 'angle-double-left'} />
          <span className="collapse-text gl-ml-3">Collapse sidebar</span>
        </a>
      </div>
    </aside>
  )
}
