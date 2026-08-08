import React, { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import Navbar from './Navbar.jsx'
import ProjectSidebar from './ProjectSidebar.jsx'
import GroupSidebar from './GroupSidebar.jsx'
import UserSettingsSidebar from './UserSettingsSidebar.jsx'
import Breadcrumbs, { breadcrumbItemsFor } from './Breadcrumbs.jsx'
import Icon from './Icon.jsx'
import { resolveRouteContext } from './routeContext.js'

// assets/README.md §0.1 — Shell A (no left sidebar) for dashboard / explore /
// user / settings routes, Shell B (left contextual sidebar + breadcrumbs) for
// project and group routes.

const LayoutContext = createContext(null)

/**
 * Pages call this to set <title>, extend the breadcrumb trail, override the
 * container width, or drop the breadcrumb bottom border (MR pages).
 *
 *   usePageChrome({ title: 'Issues · Byte Blaze / dotfiles · GitLab' })
 */
export function usePageChrome(opts) {
  const ctx = useContext(LayoutContext)
  const { title, breadcrumbExtra, limited, noBreadcrumbBorder, rightSidebar, wide } = opts || {}
  const extraKey = JSON.stringify(breadcrumbExtra || null)

  useEffect(() => {
    if (title) document.title = title
  }, [title])

  // Merges only the keys the caller actually passed, instead of replacing the
  // whole chrome object. Two components in one mounted tree may each own a
  // different slice — a `/-/profile*` page sets `title` while `ProfileLayout`
  // sets `breadcrumbExtra` — and React fires the deeper effect first, so a
  // wholesale replace let the page silently clobber the breadcrumb leaf.
  // Cleanup clears exactly the keys this call owned.
  useEffect(() => {
    if (!ctx) return undefined
    const patch = {}
    if (breadcrumbExtra !== undefined) patch.breadcrumbExtra = breadcrumbExtra || null
    if (limited !== undefined) patch.limited = limited
    if (noBreadcrumbBorder !== undefined) patch.noBreadcrumbBorder = noBreadcrumbBorder
    if (rightSidebar !== undefined) patch.rightSidebar = rightSidebar
    if (wide !== undefined) patch.wide = wide
    const keys = Object.keys(patch)
    if (!keys.length) return undefined
    ctx.setChrome(c => ({ ...c, ...patch }))
    return () => ctx.setChrome(c => {
      const next = { ...c }
      keys.forEach(k => { next[k] = undefined })
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [extraKey, limited, noBreadcrumbBorder, rightSidebar, wide])
}

export function useRouteCtx() {
  const ctx = useContext(LayoutContext)
  return ctx ? ctx.route : null
}

/**
 * §0.6 — the two dismissible project banners. Copy is verbatim.
 *
 * TEST.md DIFF-001: these used to render on every project route. They do not.
 * Both live in `projects/_flash_messages.html.haml`, which GitLab includes from
 * exactly two views — `projects/show` and `projects/empty` — i.e. the project
 * OVERVIEW and nothing else. Confirmed against the 179 logged-in captures in
 * `assets/html/`: `js-no-ssh-message` appears in the 7 project-overview
 * captures and in none of the 40+ project sub-page captures.
 *
 * The two per-banner predicates below are the source's own, transcribed from
 * `app/helpers/projects_helper.rb` in the running container:
 *
 *   show_no_ssh_key_message?                          -> !current_user.keys.any?
 *   user_can_see_auto_devops_implicitly_enabled_banner?(project, user)
 *       Ability.allowed?(user, :admin_project, project)   -> access_level >= 40
 *     && project.has_auto_devops_implicitly_enabled?      -> no explicit setting
 *     && project.builds_enabled?
 *     && !project.repository.gitlab_ci_yml
 *   …and the render site adds `unless project.empty_repo?`.
 *
 * That is why the Auto DevOps banner shows on only some projects — not a list of
 * paths. On this instance it resolves to byteblaze's own 10 projects: he is
 * Maintainer+ on 13, but `a11yproject.com`, `a11y-webring.club` and
 * `empathy-prompts` each carry an explicit `project_auto_devops` row (67
 * projects do), which turns the implicit default off. The seed carries those
 * facts as `auto_devops_enabled` / `builds_enabled` / `has_ci_config` /
 * `empty_repo`, present only where they deviate from GitLab's default.
 */

// `User#require_ssh_key?` — true while the account has no SSH key. Adding one on
// /-/profile/keys removes the banner, exactly as on the source.
function showNoSshKeyMessage(state) {
  return !(state.ui.sshKeys || []).length
}

function showAutoDevopsBanner(state, project) {
  if (project.empty_repo) return false
  const own = state.members.find(m => m.source_type === 'project'
    && m.source_id === project.id && m.user_id === state.currentUser.id)
  if (!own || own.access_level < 40) return false
  // `auto_devops_enabled` is null/absent when the project has no explicit
  // setting and therefore inherits the instance default, which is ON here.
  if (project.auto_devops_enabled != null) return false
  if (project.builds_enabled === false) return false
  if (project.has_ci_config) return false
  return true
}

function ProjectAlerts({ state, project, dismissed, dismiss }) {
  const items = []
  if (showNoSshKeyMessage(state) && !dismissed.includes('no_ssh')) {
    items.push(
      <div key="ssh" className="gl-alert js-no-ssh-message gl-alert-warning">
        <div className="gl-alert-content">
          <div className="gl-alert-body">You can&apos;t push or pull repositories using SSH until you add an SSH key to your profile.</div>
          <div className="gl-alert-actions">
            <a className="gl-alert-action btn btn-confirm btn-md gl-button" href="/-/profile/keys">Add SSH key</a>
            <a className="gl-alert-action btn btn-default btn-md gl-button" href="/-/profile?user%5Bhide_no_ssh_key%5D=true">Don&apos;t show again</a>
          </div>
        </div>
        <button type="button" className="btn gl-dismiss-btn btn-default btn-sm gl-button btn-default-tertiary btn-icon js-close js-hide-no-ssh-message"
          aria-label="Dismiss" onClick={() => dismiss('no_ssh')}><Icon name="close" /></button>
      </div>
    )
  }
  if (showAutoDevopsBanner(state, project) && !dismissed.includes('auto_devops')) {
    items.push(
      <div key="ado" className="gl-alert auto-devops-implicitly-enabled-banner gl-alert-info"
        data-qa-selector="auto_devops_banner_content">
        <div className="gl-alert-content">
          <div className="gl-alert-body">
            <div>The Auto DevOps pipeline has been enabled and will be used if no alternative CI configuration file is found.</div>
            <div>Container registry is not enabled on this GitLab instance. Ask an administrator to enable it in order for Auto DevOps to work.</div>
          </div>
          <div className="gl-alert-actions">
            <a className="alert-link btn gl-button btn-confirm" href={`/${project.full_path}/-/settings/ci_cd`}>Settings</a>
            <a className="alert-link btn gl-button btn-default gl-ml-3" href="/help/topics/autodevops/index.md">More information</a>
          </div>
        </div>
        <button type="button" className="btn gl-dismiss-btn btn-default btn-sm gl-button btn-default-tertiary btn-icon js-close hide-auto-devops-implicitly-enabled-banner"
          aria-label="Dismiss" onClick={() => dismiss('auto_devops')}><Icon name="close" /></button>
      </div>
    )
  }
  if (!items.length) return null
  return <>{items}</>
}

export default function Layout() {
  const { state, sidebarCollapsed } = useApp()
  const location = useLocation()
  const [chrome, setChrome] = useState({ breadcrumbExtra: null, limited: undefined, noBreadcrumbBorder: undefined, rightSidebar: undefined, wide: undefined })
  const [dismissed, setDismissed] = useState([])

  const route = useMemo(() => resolveRouteContext(location.pathname, state), [location.pathname, state])

  const value = useMemo(() => ({ route, chrome, setChrome }), [route, chrome])

  if (!state) return null

  // `/-/profile*` is Shell B too — the source renders it with a `User settings`
  // contextual sidebar (assets/html/profile-preferences.html), which is what
  // TEST.md BUG-701 was: it was getting Shell A and a stray fixed aside inside
  // the content column.
  const isUserSettings = route.kind === 'profile'
  const hasSidebar = (route.kind === 'project' && route.project) || route.kind === 'group' || isUserSettings
  const limited = chrome.limited !== undefined ? chrome.limited : route.limited
  const isProfile = route.kind === 'user'
  // `projects/show` / `projects/empty` only — a project path with no section.
  const isProjectOverview = route.kind === 'project' && !!route.project && !route.section

  const breadcrumbs = hasSidebar ? breadcrumbItemsFor(route, chrome.breadcrumbExtra) : null

  // §4.1 — the source puts `page-gutter right-sidebar-expanded` on `.layout-page`
  // whenever an issuable renders its fixed 290px right sidebar, and `global.css`
  // turns that into the compensating `padding-right` (TEST.md BUG-702). Pages
  // opt in with `usePageChrome({ rightSidebar: true })`.
  // Collapsing the nav ADDS `page-with-icon-sidebar` alongside
  // `page-with-contextual-sidebar`, exactly as GitLab's own sidebar JS does
  // (measured on the container: collapsed `/byteblaze/dotfiles` carries both).
  // Without it the content column kept a 256px reserve against a 56px rail.
  const layoutPageClass = [
    'layout-page', 'hide-when-top-nav-responsive-open',
    chrome.rightSidebar ? 'page-gutter right-sidebar-expanded' : '',
    hasSidebar ? 'page-with-contextual-sidebar' : '',
    hasSidebar && sidebarCollapsed ? 'page-with-icon-sidebar' : '',
  ].filter(Boolean).join(' ')

  // A handful of pages render inside a bare `container-fluid` on the source,
  // with no 1280px `container-limited` cap: measured at 1920, the pipeline
  // detail page spans 272-1904 where the pipelines LIST stops at 464-1712.
  // Pages opt in with `usePageChrome({ wide: true })`.
  const containerClass = [
    'container-fluid',
    (isProfile || chrome.wide) ? '' : 'container-limited',
    limited ? 'limit-container-width' : '',
  ].filter(Boolean).join(' ')

  return (
    <LayoutContext.Provider value={value}>
      {/* Bootstrap's responsive display utilities. `global.css` implements
          `.d-none { display:none !important }` but none of the breakpoint
          variants, so every element the source ships as `d-none d-*-block|flex`
          — the branch row's `Merge request` / `Compare` / `Delete branch`
          controls, the blob `info-well`, the commit sha group, the profile
          calendar row, the milestone actions — was hidden at EVERY width
          instead of only below the breakpoint. These are the exact Bootstrap 4
          rules; they only ever re-show something the source shows at desktop.
          The `.d-*-block.gl-display-flex` pairs exist because `.d-none` is
          `!important` in global.css while `.gl-display-flex` is not, so an
          element carrying both would otherwise be forced to `block`. */}
      <style>{`
        @media (min-width: 576px) {
          .d-sm-none { display: none !important; }
          .d-sm-block { display: block !important; }
          .d-sm-flex { display: flex !important; }
          .d-sm-inline-block { display: inline-block !important; }
          .d-sm-block.gl-display-flex { display: flex !important; }
        }
        @media (min-width: 768px) {
          .d-md-none { display: none !important; }
          .d-md-block { display: block !important; }
          .d-md-flex { display: flex !important; }
          .d-md-inline-block { display: inline-block !important; }
          .d-md-block.gl-display-flex { display: flex !important; }
        }
        @media (min-width: 992px) {
          .d-lg-none { display: none !important; }
          .d-lg-block { display: block !important; }
          .d-lg-flex { display: flex !important; }
          .d-lg-block.gl-display-flex { display: flex !important; }
        }
        @media (min-width: 1200px) {
          .d-xl-none { display: none !important; }
          .d-xl-block { display: block !important; }
          .d-xl-flex { display: flex !important; }
        }
      `}</style>
      <Navbar ctx={route} />
      <div id="whats-new-app" data-version-digest="3303dbbd" />
      <div className="js-set-status-modal-wrapper"
        data-current-emoji={(state.currentUser.status && state.currentUser.status.emoji) || ''}
        data-current-message={(state.currentUser.status && state.currentUser.status.message) || ''}
        data-default-emoji="speech_balloon" />

      <div className={layoutPageClass}>
        {route.kind === 'project' && route.project && <ProjectSidebar ctx={route} />}
        {route.kind === 'group' && <GroupSidebar ctx={route} />}
        {isUserSettings && <UserSettingsSidebar />}

        <div className="content-wrapper content-wrapper-margin">
          <div className="mobile-overlay" />
          <div className="alert-wrapper gl-force-block-formatting-context">
            {isProjectOverview && (
              <div className={containerClass}>
                <ProjectAlerts state={state} project={route.project} dismissed={dismissed}
                  dismiss={k => setDismissed(d => [...d, k])} />
              </div>
            )}
          </div>

          {breadcrumbs && (
            <Breadcrumbs items={breadcrumbs} className={`${containerClass} project-highlight-puc`}
              noBorder={!!chrome.noBreadcrumbBorder} />
          )}

          <div className={containerClass}>
            <main className="content" id="content-body">
              <div className="flash-container flash-container-page sticky" data-qa-selector="flash_container" />
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </LayoutContext.Provider>
  )
}
