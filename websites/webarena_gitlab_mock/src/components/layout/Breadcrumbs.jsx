import React from 'react'
import Icon from './Icon.jsx'
import { useApp } from '../../context/AppContext.jsx'

// assets/README.md §1d.1 — `Namespace / project [/ Section [/ #id]]`.
// The namespace shows the DISPLAY name but links to the path.
// Only the middle (project) item wraps its text in .breadcrumb-item-text.
// Rendered only on pages that have a left sidebar.

const PROJECT_SECTION_LABELS = {
  issues: 'Issues',
  merge_requests: 'Merge requests',
  milestones: 'Milestones',
  labels: 'Labels',
  project_members: 'Members',
  tree: 'Repository',
  blob: 'Repository',
  blame: 'Repository',
  commits: 'Commits',
  commit: 'Commits',
  branches: 'Branches',
  tags: 'Tags',
  graphs: 'Contributors',
  network: 'Graph',
  compare: 'Compare',
  find_file: 'Repository',
  new: 'Repository',
  edit: 'Repository',
  forks: 'Forks',
  starrers: 'Starrers',
  boards: 'Boards',
  activity: 'Activity',
  settings: 'Settings',
  snippets: 'Snippets',
  wikis: 'Wiki',
  pipelines: 'Pipelines',
  jobs: 'Jobs',
  environments: 'Environments',
  releases: 'Releases',
  packages: 'Packages',
  clusters: 'Kubernetes',
  metrics: 'Metrics',
  incidents: 'Incidents',
  alert_management: 'Alerts',
  value_stream_analytics: 'Value stream analytics',
  usage_quotas: 'Usage Quotas',
  hooks: 'Webhooks',
}

/**
 * TEST.md DIFF-905 — the settings pages do NOT share one `Settings` crumb; each
 * has its own wording, and it is not derivable from the path segment
 * (`operations` → `Monitor Settings`, `packages_and_registries` →
 * `Package and registry settings`, sentence-cased). Every string below is the
 * `BreadcrumbList` JSON-LD of the matching capture in `assets/html/`:
 * `proj-dotfiles-settings`, `proj-settings-repo`, `r4-set-{cicd,mr,integrations,
 * tokens,operations,packages}`.
 */
const PROJECT_SETTINGS_LABELS = {
  repository: 'Repository Settings',
  ci_cd: 'CI/CD Settings',
  merge_requests: 'Merge requests',
  integrations: 'Integration Settings',
  access_tokens: 'Access Tokens',
  operations: 'Monitor Settings',
  packages_and_registries: 'Package and registry settings',
}

/**
 * @param items [{ text, href, wrapText?: bool }] — last item gets the
 *              breadcrumb-current-link markers.
 */
export default function Breadcrumbs({ items, className = '', noBorder = false }) {
  const { setSidebarCollapsed } = useApp()
  if (!items || !items.length) return null
  return (
    <nav aria-label="Breadcrumbs" className={`breadcrumbs ${className}`.trim()}>
      <div className={`breadcrumbs-container${noBorder ? ' border-bottom-0' : ''}`}>
        {/* AUDIT P2-10 — `Open sidebar`. Mobile-only on the source (and hidden
            above the md breakpoint here too), but it was in the DOM with no
            handler; it now expands the sidebar, which is what it does there. */}
        <button name="button" type="button" className="toggle-mobile-nav"
          data-qa-selector="toggle_mobile_nav_button"
          onClick={() => setSidebarCollapsed(false)}>
          <span className="sr-only">Open sidebar</span>
          <Icon name="sidebar" size={18} />
        </button>
        <div className="breadcrumbs-links" data-testid="breadcrumb-links" data-qa-selector="breadcrumb_links_content">
          <ul className="list-unstyled breadcrumbs-list js-breadcrumbs-list">
            {items.map((it, i) => {
              const isLast = i === items.length - 1
              const marks = isLast && items.length > 1
                ? { 'data-qa-selector': 'breadcrumb_current_link', 'data-testid': 'breadcrumb-current-link' }
                : {}
              return (
                <li key={`${it.href}-${i}`} {...marks}>
                  <a href={it.href} className={it.linkClass}>
                    {it.wrapText
                      ? <span className="breadcrumb-item-text js-breadcrumb-item-text">{it.text}</span>
                      : it.text}
                  </a>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </nav>
  )
}

/** Build the trail for a project/group context (assets/README.md §1d.1). */
export function breadcrumbItemsFor(ctx, extra) {
  // `User Settings › <page>` — assets/html/profile-preferences.html. The page
  // supplies the second crumb through `ProfileLayout`'s `crumb` prop.
  if (ctx.kind === 'profile') {
    return [{ text: 'User Settings', href: '/-/profile' }].concat(extra || [])
  }
  if (ctx.kind === 'group') {
    return [{ text: ctx.groupPath, href: `/${ctx.groupPath}`, linkClass: 'group-path breadcrumb-item-text js-breadcrumb-item-text' }]
      .concat(extra || [])
  }
  if (ctx.kind !== 'project') return null
  const nsName = ctx.project && ctx.project.namespace ? ctx.project.namespace.name : ctx.namespace
  const projName = ctx.project ? ctx.project.path : ctx.projectPath
  const items = [
    { text: nsName, href: `/${ctx.namespace}` },
    { text: projName, href: `/${ctx.namespace}/${ctx.projectPath}`, wrapText: true },
  ]
  const base = `/${ctx.namespace}/${ctx.projectPath}`
  let label = PROJECT_SECTION_LABELS[ctx.section]
  let sectionHref = `${base}/-/${ctx.section}`
  if (ctx.section === 'activity' || (ctx.section === 'edit' && !ctx.infix)) {
    sectionHref = `${base}/${ctx.section}`
    // `/:ns/:proj/edit` is General Settings; only the infixed `/-/edit/…` is
    // the repository file editor (DIFF-905).
    if (ctx.section === 'edit') label = 'General Settings'
  } else if (ctx.section === 'settings' && PROJECT_SETTINGS_LABELS[ctx.sub]) {
    label = PROJECT_SETTINGS_LABELS[ctx.sub]
    sectionHref = `${base}/-/settings/${ctx.sub}`
  }
  if (label) items.push({ text: label, href: sectionHref })
  return items.concat(extra || [])
}
