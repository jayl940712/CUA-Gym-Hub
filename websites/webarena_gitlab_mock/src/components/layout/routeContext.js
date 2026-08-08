// Derives the chrome context (which sidebar, which breadcrumbs, how wide the
// container is) from the URL, so pages never have to declare it.
// See assets/README.md §1b / §1c / §1c.3.

// Top-level segments GitLab reserves — these can never be a namespace.
export const RESERVED_ROOTS = new Set([
  '-', 'dashboard', 'explore', 'projects', 'groups', 'search', 'help', 'users',
  'admin', 'api', 'assets', 'uploads', 'public', 'favicon.ico', 'go', 'v2',
])

/** Sections of `/a/b/-/c/d` → { head:['a','b'], infix:true, rest:['c','d'] } */
export function splitPath(pathname) {
  const parts = pathname.replace(/\/+$/, '').split('/').filter(Boolean)
  const i = parts.indexOf('-')
  if (i === -1) return { head: parts, infix: false, rest: [] }
  return { head: parts.slice(0, i), infix: true, rest: parts.slice(i + 1) }
}

/**
 * @param pathname current location.pathname
 * @param state    app state (needed to tell a project path from a user path)
 */
export function resolveRouteContext(pathname, state) {
  const empty = { kind: 'dashboard', project: null, group: null, user: null, section: null, sub: null, limited: false }
  if (!state) return empty

  const { head, infix, rest } = splitPath(pathname)

  // ---- /-/profile… — the "User Settings" shell -------------------------------
  // TEST.md BUG-701. `splitPath('/-/profile/keys')` yields `head: []`, so these
  // URLs used to fall through the `head.length === 0` early return below and
  // resolve as `kind: 'dashboard'` — no contextual sidebar, no left gutter, and
  // a 1280px container. `assets/html/profile-preferences.html` shows the source
  // renders them in the ordinary contextual-sidebar shell with a 990px
  // `limit-container-width` container, so they get their own kind.
  if (head.length === 0 && infix && rest[0] === 'profile') {
    return {
      ...empty, kind: 'profile',
      section: 'profile', sub: rest.slice(1).join('/') || null,
      limited: true,
    }
  }

  if (head.length === 0) return { ...empty, section: 'projects' }

  const root = head[0]

  // ---- /groups/:group/-/… ---------------------------------------------------
  // `new` is the group-creation form, not a group named "new": assets/README.md
  // §19b shows no contextual sidebar and no breadcrumb bar there.
  if (root === 'groups' && head.length >= 2 && head[1] !== 'new') {
    const group = state.groups.find(g => g.path === head[1]) || null
    return {
      kind: 'group', project: null, group, user: null,
      section: rest[0] || 'group_information', sub: rest[1] || null,
      groupPath: head[1], limited: false,
    }
  }

  // ---- /users/:username/… ---------------------------------------------------
  if (root === 'users' && head.length >= 2) {
    const user = state.users.find(u => u.username === head[1]) || null
    return { ...empty, kind: 'user', user, username: head[1], section: head[2] || 'activity' }
  }

  if (RESERVED_ROOTS.has(root)) {
    return { ...empty, section: root, sub: head[1] || null }
  }

  // ---- /:ns/:proj[/-/…] -----------------------------------------------------
  if (head.length >= 2) {
    const fullPath = `${head[0]}/${head[1]}`
    const project = state.projects.find(p => p.full_path === fullPath) || null
    if (project || infix || head.length > 2) {
      const section = infix ? rest[0] : head[2] || null
      return {
        kind: 'project', project, group: null, user: null,
        namespace: head[0], projectPath: head[1],
        section, sub: infix ? rest[1] || null : null,
        // `edit` is two different sections depending on the infix:
        // `/:ns/:proj/edit` is General Settings, `/:ns/:proj/-/edit/:ref/*path`
        // is the file editor. The breadcrumb needs to tell them apart.
        infix,
        limited: isLimitedProjectView(section, infix, head),
        fullPath,
      }
    }
  }

  // ---- /:name → group overview or user profile ------------------------------
  const group = state.groups.find(g => g.path === root)
  if (group) {
    return { kind: 'group', project: null, group, user: null, section: 'group_information', sub: null, groupPath: root, limited: false }
  }
  const user = state.users.find(u => u.username === root) || null
  return { ...empty, kind: 'user', user, username: root, section: 'activity' }
}

/**
 * assets/README.md §1c.3 — detail / overview / repo views render inside a
 * 990px `limit-container-width`; list views render at 1280px.
 */
function isLimitedProjectView(section, infix, head) {
  if (!infix) {
    // project overview, /edit, /activity
    return head.length === 2
  }
  const LIMITED = new Set(['tree', 'blob', 'blame', 'commits', 'commit', 'graphs',
    'network', 'find_file', 'compare', 'new', 'edit', 'forks', 'starrers', 'tags', 'branches'])
  return LIMITED.has(section)
}

/** Which project-sidebar top-level item is active for a given section. */
export function projectSidebarActive(ctx) {
  const s = ctx.section
  if (!s) return { top: null, sub: null }
  const map = {
    activity: ['project_information', 'activity'],
    labels: ['project_information', 'labels'],
    project_members: ['project_information', 'members'],
    tree: ['repository', 'files'],
    blob: ['repository', 'files'],
    blame: ['repository', 'files'],
    raw: ['repository', 'files'],
    new: ['repository', 'files'],
    edit: ['repository', 'files'],
    find_file: ['repository', 'files'],
    commits: ['repository', 'commits'],
    commit: ['repository', 'commits'],
    branches: ['repository', 'branches'],
    tags: ['repository', 'tags'],
    graphs: ['repository', 'contributors'],
    network: ['repository', 'graph'],
    compare: ['repository', 'compare'],
    issues: ['issues', 'list'],
    boards: ['issues', 'boards'],
    milestones: ['issues', 'milestones'],
    merge_requests: ['merge_requests', null],
    pipelines: ['ci_cd', 'pipelines'],
    jobs: ['ci_cd', 'jobs'],
    pipeline_schedules: ['ci_cd', 'schedules'],
    ci: ['ci_cd', 'editor'],
    security: ['security_compliance', 'configuration'],
    environments: ['deployments', 'environments'],
    feature_flags: ['deployments', 'feature_flags'],
    releases: ['deployments', 'releases'],
    packages: ['packages_registries', 'package_registry'],
    infrastructure_registry: ['packages_registries', 'infrastructure_registry'],
    clusters: ['infrastructure', 'kubernetes'],
    terraform: ['infrastructure', 'terraform'],
    google_cloud: ['infrastructure', 'google_cloud'],
    metrics: ['monitor', 'metrics'],
    error_tracking: ['monitor', 'error_tracking'],
    alert_management: ['monitor', 'alerts'],
    incidents: ['monitor', 'incidents'],
    value_stream_analytics: ['analytics', 'value_stream'],
    wikis: ['wiki', null],
    snippets: ['snippets', null],
    settings: ['settings', null],
    hooks: ['settings', 'webhooks'],
    usage_quotas: ['settings', 'usage_quotas'],
  }
  const hit = map[s]
  return hit ? { top: hit[0], sub: hit[1] } : { top: null, sub: null }
}
