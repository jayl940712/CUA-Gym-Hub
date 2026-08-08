import React from 'react'
import { useApp } from '../../context/AppContext.jsx'
import Icon from './Icon.jsx'
import { EntityAvatar } from './Avatar.jsx'
import { projectSidebarActive } from './routeContext.js'

// assets/README.md §1b — the project contextual sidebar. The inventory below
// is the full §1b.3 table; every href, aria-label, icon and data-track-label
// is verbatim so no chrome link is dead.

function buildSections(p, ref) {
  const b = `/${p.full_path}`
  return [
    {
      key: 'project_information', label: 'Project information', icon: 'project',
      href: `${b}/activity`, linkClass: 'shortcuts-project-information', liClass: 'home',
      items: [
        { key: 'activity', label: 'Activity', href: `${b}/activity`, linkClass: 'shortcuts-project-activity' },
        { key: 'labels', label: 'Labels', href: `${b}/-/labels` },
        { key: 'members', label: 'Members', href: `${b}/-/project_members`, id: 'js-onboarding-members-link' },
      ],
    },
    {
      key: 'repository', label: 'Repository', icon: 'doc-text',
      href: `${b}/-/tree/${ref}`, linkClass: 'shortcuts-tree', nameId: 'js-onboarding-repo-link',
      items: [
        { key: 'files', label: 'Files', href: `${b}/-/tree/${ref}` },
        { key: 'commits', label: 'Commits', href: `${b}/-/commits/${ref}`, id: 'js-onboarding-commits-link' },
        { key: 'branches', label: 'Branches', href: `${b}/-/branches`, id: 'js-onboarding-branches-link' },
        { key: 'tags', label: 'Tags', href: `${b}/-/tags` },
        { key: 'contributors', label: 'Contributors', href: `${b}/-/graphs/${ref}` },
        { key: 'graph', label: 'Graph', href: `${b}/-/network/${ref}` },
        { key: 'compare', label: 'Compare', href: `${b}/-/compare?from=${ref}&to=${ref}` },
      ],
    },
    {
      key: 'issues', label: 'Issues', icon: 'issues', href: `${b}/-/issues`,
      linkClass: 'shortcuts-issues', nameId: 'js-onboarding-issues-link', counter: 'issue',
      items: [
        { key: 'list', label: 'List', aria: 'Issues', href: `${b}/-/issues` },
        { key: 'boards', label: 'Boards', href: `${b}/-/boards` },
        { key: 'service_desk', label: 'Service Desk', href: `${b}/-/issues/service_desk` },
        { key: 'milestones', label: 'Milestones', href: `${b}/-/milestones` },
      ],
    },
    {
      key: 'merge_requests', label: 'Merge requests', icon: 'git-merge', href: `${b}/-/merge_requests`,
      linkClass: 'shortcuts-merge_requests', nameId: 'js-onboarding-mr-link', counter: 'merge', items: [],
    },
    {
      key: 'ci_cd', label: 'CI/CD', icon: 'rocket', href: `${b}/-/pipelines`,
      linkClass: 'shortcuts-pipelines rspec-link-pipelines', nameId: 'js-onboarding-pipelines-link',
      items: [
        { key: 'pipelines', label: 'Pipelines', href: `${b}/-/pipelines` },
        { key: 'editor', label: 'Editor', href: `${b}/-/ci/editor?branch_name=${ref}` },
        { key: 'jobs', label: 'Jobs', href: `${b}/-/jobs`, linkClass: 'shortcuts-builds' },
        { key: 'schedules', label: 'Schedules', href: `${b}/-/pipeline_schedules` },
      ],
    },
    {
      key: 'security_compliance', label: 'Security & Compliance', icon: 'shield',
      href: `${b}/-/security/configuration`,
      items: [{ key: 'configuration', label: 'Configuration', href: `${b}/-/security/configuration` }],
    },
    {
      key: 'deployments', label: 'Deployments', icon: 'deployments', href: `${b}/-/environments`,
      linkClass: 'shortcuts-deployments',
      items: [
        { key: 'environments', label: 'Environments', href: `${b}/-/environments` },
        { key: 'feature_flags', label: 'Feature Flags', href: `${b}/-/feature_flags` },
        { key: 'releases', label: 'Releases', href: `${b}/-/releases` },
      ],
    },
    {
      key: 'packages_registries', label: 'Packages and registries', icon: 'package', href: `${b}/-/packages`,
      items: [
        { key: 'package_registry', label: 'Package Registry', href: `${b}/-/packages`, linkClass: 'shortcuts-container-registry' },
        { key: 'infrastructure_registry', label: 'Infrastructure Registry', href: `${b}/-/infrastructure_registry` },
      ],
    },
    {
      key: 'infrastructure', label: 'Infrastructure', icon: 'cloud-gear', href: `${b}/-/clusters`,
      linkClass: 'shortcuts-infrastructure',
      items: [
        { key: 'kubernetes', label: 'Kubernetes clusters', href: `${b}/-/clusters` },
        { key: 'terraform', label: 'Terraform', href: `${b}/-/terraform` },
        { key: 'google_cloud', label: 'Google Cloud', href: `${b}/-/google_cloud/configuration` },
      ],
    },
    {
      key: 'monitor', label: 'Monitor', icon: 'monitor', href: `${b}/-/metrics`, linkClass: 'shortcuts-monitor',
      items: [
        { key: 'metrics', label: 'Metrics', href: `${b}/-/metrics` },
        { key: 'error_tracking', label: 'Error Tracking', href: `${b}/-/error_tracking` },
        { key: 'alerts', label: 'Alerts', href: `${b}/-/alert_management` },
        { key: 'incidents', label: 'Incidents', href: `${b}/-/incidents` },
      ],
    },
    {
      key: 'analytics', label: 'Analytics', icon: 'chart', href: `${b}/-/value_stream_analytics`,
      linkClass: 'shortcuts-analytics',
      items: [
        { key: 'value_stream', label: 'Value stream', href: `${b}/-/value_stream_analytics` },
        { key: 'ci_cd', label: 'CI/CD', href: `${b}/-/pipelines/charts` },
        { key: 'repository', label: 'Repository', href: `${b}/-/graphs/${ref}/charts` },
      ],
    },
    { key: 'wiki', label: 'Wiki', icon: 'book', href: `${b}/-/wikis/home`, linkClass: 'shortcuts-wiki', items: [] },
    { key: 'snippets', label: 'Snippets', icon: 'snippet', href: `${b}/-/snippets`, linkClass: 'shortcuts-snippets', items: [] },
    {
      key: 'settings', label: 'Settings', icon: 'settings', href: `${b}/edit`, nameId: 'js-onboarding-settings-link',
      items: [
        { key: 'general', label: 'General', href: `${b}/edit` },
        { key: 'integrations', label: 'Integrations', href: `${b}/-/settings/integrations` },
        { key: 'webhooks', label: 'Webhooks', href: `${b}/-/hooks` },
        { key: 'access_tokens', label: 'Access Tokens', href: `${b}/-/settings/access_tokens` },
        { key: 'repository', label: 'Repository', href: `${b}/-/settings/repository` },
        { key: 'merge_requests', label: 'Merge requests', href: `${b}/-/settings/merge_requests` },
        { key: 'ci_cd', label: 'CI/CD', href: `${b}/-/settings/ci_cd` },
        { key: 'packages_and_registries', label: 'Packages and registries', href: `${b}/-/settings/packages_and_registries` },
        { key: 'monitor', label: 'Monitor', href: `${b}/-/settings/operations` },
        { key: 'usage_quotas', label: 'Usage Quotas', href: `${b}/-/usage_quotas` },
      ],
    },
  ]
}

export default function ProjectSidebar({ ctx }) {
  const { state, sidebarCollapsed, setSidebarCollapsed } = useApp()
  const p = ctx.project
  if (!p) return null
  const ref = p.default_branch || 'main'
  const active = projectSidebarActive(ctx)
  const isOverview = ctx.section == null

  // §1b.3 — badges are the OPEN counts, rendered from the seed.
  const openIssues = state.issues.filter(i => i.project_id === p.id && i.state === 'opened').length
  const openMrs = state.mergeRequests.filter(m => m.project_id === p.id && m.state === 'opened').length

  const sections = buildSections(p, ref)
  const b = `/${p.full_path}`

  return (
    <aside className={`nav-sidebar${sidebarCollapsed ? ' sidebar-collapsed-desktop js-sidebar-collapsed' : ''}`}
      aria-label="Project navigation">
      <div className="nav-sidebar-inner-scroll">
        <ul className="sidebar-top-level-items" data-qa-selector="project_sidebar">
          <li data-track-label="scope_menu" data-container="body" data-placement="right"
            className={`context-header has-tooltip${isOverview ? ' active' : ''}`} title={p.name}>
            <a aria-label={p.name} className="shortcuts-project rspec-project-link gl-link"
              data-qa-selector="sidebar_menu_link" data-qa-menu-item="Project scope" href={b}>
              <EntityAvatar entity={p} size={32} kind="project" />
              <span className="sidebar-context-title">{p.name}</span>
            </a>
          </li>

          {sections.map(s => {
            const isActive = active.top === s.key
            const count = s.counter === 'issue' ? openIssues : s.counter === 'merge' ? openMrs : null
            return (
              <li key={s.key} data-track-label={`${s.key}_menu`} className={`${s.liClass || ''}${isActive ? ' active' : ''}`.trim()}>
                <a aria-label={s.label}
                  className={`${s.linkClass || ''}${s.items.length ? ' has-sub-items' : ''} gl-link`.trim()}
                  data-qa-selector="sidebar_menu_link" data-qa-menu-item={s.label} href={s.href}>
                  <span className="nav-icon-container"><Icon name={s.icon} /></span>
                  <span className="nav-item-name" id={s.nameId}>{s.label}</span>
                  {count != null && (
                    <span className={`gl-badge badge badge-pill badge-info sm count ${s.counter === 'issue' ? 'issue_counter' : 'merge_counter js-merge-counter'}`}>{count}</span>
                  )}
                </a>
                <ul className={`sidebar-sub-level-items${s.items.length ? '' : ' is-fly-out-only'}`}
                  style={{ display: isActive && s.items.length ? 'block' : 'none' }}>
                  <li className="fly-out-top-item"><span className="fly-out-top-item-container">
                    <strong className="fly-out-top-item-name">{s.label}</strong>
                  </span></li>
                  <li className="divider fly-out-top-item" />
                  {s.items.map(it => (
                    <li key={it.key} data-track-label={it.key} className={active.sub === it.key ? 'active' : ''}>
                      <a aria-label={it.aria || it.label} className={`${it.linkClass || ''} gl-link`.trim()}
                        data-qa-selector="sidebar_menu_item_link" data-qa-menu-item={it.label}
                        id={it.id} href={it.href}>{it.label}</a>
                    </li>
                  ))}
                </ul>
              </li>
            )
          })}

          {/* §1b.3 hidden shortcut links */}
          <li className="hidden"><a className="shortcuts-project-activity" aria-label="Activity" href={`${b}/activity`}>Activity</a></li>
          <li className="hidden"><a className="shortcuts-network" aria-label="Graph" href={`${b}/-/network/${ref}`}>Graph</a></li>
          <li className="hidden"><a className="shortcuts-new-issue" aria-label="Create a new issue" href={`${b}/-/issues/new`}>Create a new issue</a></li>
          <li className="hidden"><a className="shortcuts-builds" aria-label="Jobs" href={`${b}/-/jobs`}>Jobs</a></li>
          <li className="hidden"><a className="shortcuts-commits" aria-label="Commits" href={`${b}/-/commits/${ref}`}>Commits</a></li>
          <li className="hidden"><a className="shortcuts-issue-boards" aria-label="Issue Boards" href={`${b}/-/boards`}>Issue Boards</a></li>
        </ul>

        <a className="toggle-sidebar-button js-toggle-sidebar rspec-toggle-sidebar" role="button"
          title="Toggle sidebar" type="button" onClick={() => setSidebarCollapsed(c => !c)}>
          <Icon name={sidebarCollapsed ? 'angle-double-right' : 'angle-double-left'} />
          <span className="collapse-text gl-ml-3">Collapse sidebar</span>
        </a>
        {/* AUDIT P2-10 — the source's mobile-only close control. `global.css`
            hides it above the md breakpoint exactly as GitLab does, but it is
            in the DOM, so it collapses the sidebar rather than doing nothing. */}
        <button name="button" type="button" className="close-nav-button"
          onClick={() => setSidebarCollapsed(true)}>
          <Icon name="close" /><span className="collapse-text gl-ml-3">Close sidebar</span>
        </button>
      </div>
    </aside>
  )
}
