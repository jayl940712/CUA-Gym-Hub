import React, { useState, useRef, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import Icon, { TanukiLogo } from './Icon.jsx'
import { UserAvatar } from './Avatar.jsx'
import { useQueryNavigate } from '../../utils/RedirectWithQuery.jsx'
import KEYBOARD_SHORTCUTS from './shortcutsData.js'
import WHATS_NEW_ITEMS from './whatsNewData.js'

// assets/README.md §1 — the top navbar renders on every authenticated route.
// Every string, href, class and data-* attribute below is verbatim from the
// captured DOM.

function useOutsideClose(ref, onClose) {
  useEffect(() => {
    function handler(e) { if (ref.current && !ref.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, onClose])
}

function Dropdown({ id, className, toggle, children, align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useOutsideClose(ref, () => setOpen(false))
  return (
    <li className={`${className} dropdown${open ? ' show' : ''}`} ref={ref} id={id}>
      {toggle(open, () => setOpen(o => !o))}
      <div className={`dropdown-menu${align === 'right' ? ' dropdown-menu-right' : ''}${open ? ' show' : ''}`}
        onClick={() => setOpen(false)}>
        {children}
      </div>
    </li>
  )
}

/**
 * AUDIT P2-10 — `What's new` in the Help menu was an inert <button>. GitLab
 * opens a right-hand `.gl-drawer` listing the release-post items its
 * `GET /-/whats_new` endpoint returns; those 10 items are vendored verbatim in
 * `whatsNewData.js` (see that file for why the images are dropped).
 */
function WhatsNewDrawer({ onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const fmt = iso => new Date(iso).toLocaleDateString('en-US',
    { year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <aside className="gl-drawer gl-drawer-default" data-testid="whats-new-drawer"
      style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 400, zIndex: 1000 }}>
      <div className="gl-drawer-header">
        <div className="gl-drawer-title">
          <h4 className="page-title gl-my-2">What&apos;s new</h4>
          <button aria-label="Close drawer" type="button" onClick={onClose}
            className="btn gl-drawer-close-button btn-default btn-sm gl-button btn-default-tertiary btn-icon">
            <Icon name="close" />
          </button>
        </div>
      </div>
      <div className="gl-drawer-body gl-drawer-body-scrim">
        <div className="gl-p-0">
          <div className="gl-infinite-scroll-container">
            {WHATS_NEW_ITEMS.map(item => (
              <div className="gl-py-6 gl-px-6 gl-border-b-1 gl-border-b-solid gl-border-b-gray-100"
                key={item.name}>
                <a data-testid="whats-new-image-link" href={item.documentation_link}
                  rel="noopener noreferrer" target="_blank" className="gl-link gl-display-block">
                  <div className="whats-new-item-image gl-bg-size-cover">
                    <span className="gl-sr-only">{item.name}</span>
                  </div>
                </a>
                <a href={item.documentation_link} rel="noopener noreferrer" target="_blank"
                  className="gl-link whats-new-item-title-link gl-display-block gl-mt-4 gl-mb-1">
                  <h5 data-test-id="feature-name" className="gl-font-lg gl-my-0">{item.name}</h5>
                </a>
                <div data-testid="release-date" className="gl-mb-3">{fmt(item.published_at)}</div>
                <div className="gl-mb-3">
                  {item.available_in.map(tier => (
                    <span className="badge gl-mr-2 badge-tier badge-pill gl-badge md" key={tier}>
                      {` ${tier} `}
                    </span>
                  ))}
                </div>
                <div className="gl-pt-3 gl-line-height-20"
                  dangerouslySetInnerHTML={{ __html: item.description }} />
                <a href={item.documentation_link} rel="noopener noreferrer" target="_blank"
                  className="btn btn-default btn-md gl-button">
                  <span className="gl-button-text">Learn more</span>
                </a>
              </div>
            ))}
          </div>
        </div>
      </div>
    </aside>
  )
}

/**
 * AUDIT P2-10 — `Keyboard shortcuts` in the Help menu was an inert <button>.
 * GitLab renders `#keyboard-shortcut-modal`, a searchable list of every binding
 * grouped by section. Contents come from `shortcutsData.js`, extracted from the
 * source container's own modal DOM — nothing here is written from memory.
 *
 * The `?` binding that opens it is wired too, matching the row the modal itself
 * advertises ("Toggle keyboard shortcuts help dialog").
 */
function ShortcutsModal({ onClose }) {
  const [search, setSearch] = useState('')
  const needle = search.trim().toLowerCase()
  const sections = KEYBOARD_SHORTCUTS
    .map(([title, rows]) => [title, needle
      ? rows.filter(([toks, desc]) => desc.toLowerCase().includes(needle)
        || toks.some(([, v]) => v.toLowerCase() === needle))
      : rows])
    .filter(([, rows]) => rows.length)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal show" id="keyboard-shortcut-modal" role="dialog"
      style={{ display: 'block' }} onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal-dialog modal-lg">
        <div className="modal-content">
          <header className="modal-header">
            <h4 className="modal-title">Keyboard shortcuts</h4>
            <button aria-label="Close" type="button" onClick={onClose}
              className="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon">
              <Icon name="close" />
            </button>
          </header>
          <div className="modal-body shortcut-help-body gl-p-0!">
            <div className="gl-sticky gl-top-0 gl-py-5 gl-px-5 gl-display-flex gl-align-items-center gl-bg-white">
              <div className="gl-search-box-by-type gl-w-half gl-mr-3">
                <input type="search" placeholder="Search" aria-label="Search keyboard shortcuts"
                  className="gl-form-input gl-search-box-by-type-input form-control"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
              <div className="js-toggle-shortcuts gl-w-half gl-ml-3">
                <div data-testid="toggle-wrapper" className="gl-toggle-wrapper gl-display-flex gl-mb-0 gl-toggle-label-inline">
                  <span data-testid="toggle-label" className="gl-toggle-label gl-flex-shrink-0">Toggle shortcuts</span>
                </div>
              </div>
            </div>
            <div className="shortcut-help-container gl-mt-8 gl-px-5 gl-pb-5">
              {sections.map(([title, rows]) => (
                <section className="shortcut-help-mapping gl-mb-4" key={title}>
                  <strong className="shortcut-help-mapping-title gl-w-half gl-display-inline-block">
                    {` ${title} `}
                  </strong>
                  {rows.map(([toks, desc]) => (
                    <div className="gl-display-flex gl-align-items-center" key={`${title}-${desc}`}>
                      <div className="gl-w-40p gl-flex-shrink-0 gl-text-right gl-pr-4">
                        {toks.map(([t, v], i) => (
                          t === 'kbd'
                            ? <kbd key={i}>{v}</kbd>
                            : <React.Fragment key={i}>{` ${v} `}</React.Fragment>
                        ))}
                      </div>
                      <div className="gl-w-half gl-flex-shrink-0 gl-flex-grow-1">{` ${desc} `}</div>
                    </div>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Navbar({ ctx }) {
  const { state, currentUser } = useApp()
  const go = useQueryNavigate()
  const [searchValue, setSearchValue] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
  const project = ctx && ctx.project

  // `?` toggles the shortcuts dialog, as the dialog's own first row says.
  useEffect(() => {
    function onKey(e) {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return
      const t = e.target
      const tag = t && t.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return
      e.preventDefault()
      setShortcutsOpen(o => !o)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  // §1.8 — counter values are the real ones from the source chrome.
  const assignedIssues = state ? state.issues.filter(i =>
    i.state === 'opened' && (i.assignee_ids || []).includes(currentUser.id)).length : 0
  const assignedMrs = state ? state.mergeRequests.filter(m =>
    m.state === 'opened' && (m.assignee_ids || []).includes(currentUser.id)).length : 0
  const reviewerMrs = state ? state.mergeRequests.filter(m =>
    m.state === 'opened' && (m.reviewer_ids || []).includes(currentUser.id)).length : 0
  const mrCount = assignedMrs + reviewerMrs
  const todoCount = state ? state.todos.filter(t => t.state === 'pending').length : 0

  function submitSearch(e) {
    e.preventDefault()
    const q = new URLSearchParams()
    q.set('search', searchValue)
    q.set('nav_source', 'navbar')
    if (project) q.set('project_id', String(project.id))
    go(`/search?${q.toString()}`, { keepQuery: false })
  }

  const projPrefix = project ? `/${project.full_path}` : null

  return (
    <header className="navbar navbar-gitlab navbar-expand-sm js-navbar" data-qa-selector="navbar">
      <a className="gl-sr-only gl-accessibility" href="#content-body">Skip to content</a>
      <div className="container-fluid">
        <div className="header-content js-header-content">

          {/* §1.4 Logo */}
          <div className="title-container">
            <div className="title">
              <span className="gl-sr-only">GitLab</span>
              <a title="Dashboard" id="logo" className="has-tooltip" href="/"><TanukiLogo /></a>
            </div>
          </div>

          {/* §1.5 Hamburger mega-menu */}
          <ul className="nav navbar-sub-nav">
            <Dropdown
              className="nav-item b-nav-dropdown gl-dropdown"
              align="left"
              toggle={(open, t) => (
                <a role="button" aria-haspopup="true" aria-expanded={open} href="#" target="_self"
                  data-qa-selector="navbar_dropdown" data-qa-title="Menu"
                  className="nav-link dropdown-toggle top-nav-toggle js-top-nav-dropdown-toggle gl-px-3! dropdown-toggle-no-caret"
                  onClick={e => { e.preventDefault(); t() }}>
                  <Icon name="hamburger" />
                </a>
              )}>
              <ul>
                <li><strong data-testid="menu-header" className="dropdown-header gl-display-block">Switch to</strong></li>
                <li><a data-testid="menu-item" aria-label="Projects" href="/dashboard/projects"><Icon name="project" />Projects</a></li>
                <li><a data-testid="menu-item" aria-label="Groups" href="/dashboard/groups"><Icon name="group" />Groups</a></li>
                <li><strong data-testid="menu-header" className="dropdown-header gl-display-block gl-pt-3!">Explore</strong></li>
                <li><a data-testid="menu-item" aria-label="Milestones" href="/dashboard/milestones"><Icon name="clock" />Milestones</a></li>
                <li><a data-testid="menu-item" aria-label="Snippets" data-qa-selector="snippets_link" href="/dashboard/snippets"><Icon name="snippet" />Snippets</a></li>
                <li><a data-testid="menu-item" aria-label="Activity" href="/dashboard/activity"><Icon name="history" />Activity</a></li>
                <li className="divider" />
                <li><a data-qa-selector="menu_item_link" data-qa-title="View all projects" aria-label="View all projects" href="/dashboard/projects">View all projects</a></li>
              </ul>
            </Dropdown>
          </ul>
          {/* §1.5 hidden keyboard-shortcut targets */}
          <div className="hidden">
            <a className="dashboard-shortcuts-projects" href="/dashboard/projects">Projects</a>
            <a className="dashboard-shortcuts-groups" href="/dashboard/groups">Groups</a>
            <a className="dashboard-shortcuts-milestones" href="/dashboard/milestones">Milestones</a>
            <a className="dashboard-shortcuts-snippets" href="/dashboard/snippets">Snippets</a>
            <a className="dashboard-shortcuts-activity" href="/dashboard/activity">Activity</a>
          </div>

          {/* §1.6 Search box */}
          <div className={`header-search gl-relative gl-w-full${searchFocused ? ' is-focused' : ' is-not-active'}`}
            id="js-header-search"
            data-autocomplete-path="/search/autocomplete"
            data-issues-path="/dashboard/issues"
            data-mr-path="/dashboard/merge_requests"
            data-search-path="/search">
            <form action="/search" acceptCharset="UTF-8" method="get" onSubmit={submitSearch} role="search" aria-label="Search GitLab">
              <div className="gl-search-box-by-type">
                <Icon name="search" className="gl-search-box-by-type-search-icon" />
                <input autoComplete="off" className="form-control gl-form-input gl-search-box-by-type-input"
                  data-qa-selector="search_box" id="search" name="search" placeholder="Search GitLab" type="text"
                  value={searchValue}
                  onChange={e => setSearchValue(e.target.value)}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)} />
              </div>
              {project && <input type="hidden" name="project_id" id="project_id" value={project.id} />}
              {project && <input type="hidden" name="scope" id="scope" defaultValue="" />}
              {project && <input type="hidden" name="search_code" id="search_code" value="true" />}
              <input type="hidden" name="snippets" id="snippets" defaultValue="" />
              <input type="hidden" name="repository_ref" id="repository_ref"
                value={project ? project.default_branch || 'main' : ''} />
              <input type="hidden" name="nav_source" id="nav_source" value="navbar" />
              {!searchFocused && (
                <kbd className="gl-absolute gl-right-3 gl-top-0 keyboard-shortcut-helper gl-z-index-1 has-tooltip"
                  data-html="true" data-placement="bottom"
                  title="Use the shortcut key <kbd>/</kbd> to start a search">/</kbd>
              )}
            </form>
            {searchFocused && (
              <div data-testid="header-search-dropdown-menu" className="header-search-dropdown-menu">
                <ul className="header-search-dropdown-content gl-py-2">
                  <li className="gl-dropdown-section-header">
                    <header className="dropdown-header">{project ? project.name : 'All GitLab'}</header>
                  </li>
                  <li className="gl-dropdown-item"><a className="dropdown-item" role="menuitem" tabIndex={-1} id="default-issues-assigned"
                    href={projPrefix ? `${projPrefix}/-/issues/?assignee_username=${currentUser.username}` : `/dashboard/issues/?assignee_username=${currentUser.username}`}>Issues assigned to me</a></li>
                  <li className="gl-dropdown-item"><a className="dropdown-item" role="menuitem" tabIndex={-1} id="default-issues-created"
                    href={projPrefix ? `${projPrefix}/-/issues/?author_username=${currentUser.username}` : `/dashboard/issues/?author_username=${currentUser.username}`}>Issues I&apos;ve created</a></li>
                  <li className="gl-dropdown-item"><a className="dropdown-item" role="menuitem" tabIndex={-1} id="default-mrs-assigned"
                    href={projPrefix ? `${projPrefix}/-/merge_requests/?assignee_username=${currentUser.username}` : `/dashboard/merge_requests/?assignee_username=${currentUser.username}`}>Merge requests assigned to me</a></li>
                  <li className="gl-dropdown-item"><a className="dropdown-item" role="menuitem" tabIndex={-1} id="default-mrs-reviewer"
                    href={projPrefix ? `${projPrefix}/-/merge_requests/?reviewer_username=${currentUser.username}` : `/dashboard/merge_requests/?reviewer_username=${currentUser.username}`}>Merge requests that I&apos;m a reviewer</a></li>
                  <li className="gl-dropdown-item"><a className="dropdown-item" role="menuitem" tabIndex={-1} id="default-mrs-created"
                    href={projPrefix ? `${projPrefix}/-/merge_requests/?author_username=${currentUser.username}` : `/dashboard/merge_requests/?author_username=${currentUser.username}`}>Merge requests I&apos;ve created</a></li>
                </ul>
                <span id="search-input-description" className="gl-sr-only">Type for new suggestions to appear below.</span>
                <span data-testid="search-results-description" className="gl-sr-only">5 default results provided. Use the up and down arrow keys to navigate search results list.</span>
              </div>
            )}
          </div>

          <div className="navbar-collapse gl-transition-medium">
            <ul className="nav navbar-nav gl-w-full gl-align-items-center gl-justify-content-end">

              {/* §1.7 `+` create-new */}
              <Dropdown className="header-new gl-white-space-nowrap gl-text-right"
                toggle={(open, t) => (
                  <a className="header-new-dropdown-toggle has-tooltip gl-display-flex"
                    id="js-onboarding-new-project-link" title="Create new..." aria-label="Create new..."
                    data-qa-selector="new_menu_toggle" href="/projects/new"
                    onClick={e => { e.preventDefault(); t() }}>
                    <Icon name="plus-square" /><Icon name="chevron-down" className="caret-down" />
                  </a>
                )}>
                <ul>
                  {project && <>
                    <li className="dropdown-bold-header">This project</li>
                    <li><a data-qa-selector="new_issue_link" href={`${projPrefix}/-/issues/new`}>New issue</a></li>
                    <li><a href={`${projPrefix}/-/merge_requests/new`}>New merge request</a></li>
                    <li><a href={`${projPrefix}/-/snippets/new`}>New snippet</a></li>
                    <li><a href={`${projPrefix}/-/project_members`}>Invite members{' '}
                      <gl-emoji title="handshake" data-name="handshake" data-unicode-version="9.0" aria-hidden="true"
                        className="gl-font-base gl-vertical-align-baseline">🤝</gl-emoji></a></li>
                    <li className="divider" />
                    <li className="dropdown-bold-header">GitLab</li>
                  </>}
                  <li><a data-qa-selector="global_new_project_link" href="/projects/new">New project/repository</a></li>
                  <li><a data-qa-selector="global_new_group_link" href="/groups/new">New group</a></li>
                  <li><a data-qa-selector="global_new_snippet_link" href="/-/snippets/new">New snippet</a></li>
                </ul>
              </Dropdown>

              {/* §1.8 Issues counter */}
              <li className="user-counter">
                <a title="Issues" aria-label="Issues" className="dashboard-shortcuts-issues js-prefetch-document"
                  data-qa-selector="issues_shortcut_button" data-toggle="tooltip" data-placement="bottom"
                  data-container="body" data-track-action="click_issues_link"
                  href={`/dashboard/issues?assignee_username=${currentUser.username}`}>
                  <Icon name="issues" />
                  <span aria-label={`${assignedIssues} assigned issues`}
                    className="gl-badge badge badge-pill badge-success sm gl-ml-n2 ">{assignedIssues}</span>
                </a>
              </li>

              {/* §1.8 Merge requests counter */}
              <Dropdown className="user-counter"
                toggle={(open, t) => (
                  <a className="dashboard-shortcuts-merge_requests has-tooltip" title="Merge requests"
                    aria-label="Merge requests" data-qa-selector="merge_requests_shortcut_button"
                    data-placement="bottom" data-container="body"
                    href={`/dashboard/merge_requests?assignee_username=${currentUser.username}`}
                    onClick={e => { e.preventDefault(); t() }}>
                    <Icon name="git-merge" />
                    <span aria-label={`${mrCount} merge requests`}
                      className="gl-badge badge badge-pill badge-warning sm js-merge-requests-count gl-ml-n2 ">{mrCount}</span>
                    <Icon name="chevron-down" className="caret-down" />
                  </a>
                )}>
                <ul>
                  <li className="dropdown-header">Merge requests</li>
                  <li><a className="gl-display-flex! gl-align-items-center js-prefetch-document"
                    href={`/dashboard/merge_requests?assignee_username=${currentUser.username}`}>Assigned to you
                    <span className="gl-badge badge badge-pill badge-neutral sm js-assigned-mr-count gl-ml-auto">{assignedMrs}</span></a></li>
                  <li><a className="dashboard-shortcuts-review_requests gl-display-flex! gl-align-items-center js-prefetch-document"
                    href={`/dashboard/merge_requests?reviewer_username=${currentUser.username}`}>Review requests for you
                    <span className="gl-badge badge badge-pill badge-neutral sm js-reviewer-mr-count gl-ml-auto">{reviewerMrs}</span></a></li>
                </ul>
              </Dropdown>

              {/* §1.8 To-Do List counter */}
              <li className="user-counter">
                <a title="To-Do List" aria-label="To-Do List" className="shortcuts-todos js-prefetch-document"
                  data-qa-selector="todos_shortcut_button" data-toggle="tooltip" data-placement="bottom"
                  data-container="body" href="/dashboard/todos">
                  <Icon name="todo-done" />
                  <span aria-label="Todos count"
                    className="gl-badge badge badge-pill badge-info sm js-todos-count gl-ml-n2 ">{todoCount}</span>
                </a>
              </li>

              {/* §1.9 Help */}
              <Dropdown className="nav-item header-help with-notifications"
                toggle={(open, t) => (
                  <a className="header-help-dropdown-toggle gl-relative" href="/help"
                    onClick={e => { e.preventDefault(); t() }}>
                    <span className="gl-sr-only">Help</span>
                    <Icon name="question-o" />
                    <span className="notification-dot rounded-circle gl-absolute" />
                    <Icon name="chevron-down" className="caret-down" />
                  </a>
                )}>
                <ul>
                  <li />
                  <li><button type="button" onClick={() => setWhatsNewOpen(true)}
                    className="js-whats-new-trigger gl-justify-content-space-between gl-align-items-center gl-display-flex!">
                    What&apos;s new
                    <span className="gl-badge badge badge-pill badge-muted sm js-whats-new-notification-count">
                      {WHATS_NEW_ITEMS.length}
                    </span>
                  </button></li>
                  <li><a href="/help">Help</a></li>
                  <li><a href="https://about.gitlab.com/getting-help/">Support</a></li>
                  <li><a className="text-nowrap" target="_blank" rel="noopener noreferrer" href="https://forum.gitlab.com">Community forum</a></li>
                  <li><button type="button" className="js-shortcuts-modal-trigger"
                    onClick={() => setShortcutsOpen(true)}>Keyboard shortcuts
                    <kbd aria-hidden="true" className="flat float-right">?</kbd></button></li>
                  <li className="divider" />
                  <li><a href="https://about.gitlab.com/submit-feedback">Submit feedback</a></li>
                  <li><a className="text-nowrap" target="_blank" rel="noopener noreferrer" href="https://about.gitlab.com/contributing">Contribute to GitLab</a></li>
                </ul>
              </Dropdown>

              {/* §1.10 User avatar */}
              <Dropdown className="nav-item header-user js-nav-user-dropdown"
                toggle={(open, t) => (
                  <a className="header-user-dropdown-toggle" href={`/${currentUser.username}`}
                    onClick={e => { e.preventDefault(); t() }}>
                    <UserAvatar user={currentUser} size={24} className="header-user-avatar" alt={currentUser.name} />
                    <Icon name="chevron-down" className="caret-down" />
                  </a>
                )}>
                <ul>
                  <li className="current-user">
                    <a className="gl-line-height-20!" data-user={currentUser.username}
                      data-testid="user-profile-link" data-qa-selector="user_profile_link"
                      href={`/${currentUser.username}`}>
                      <div className="gl-font-weight-bold">{currentUser.name}</div>
                      @{currentUser.username}
                    </a>
                  </li>
                  <li className="divider" />
                  <li><a className="js-set-status-modal-trigger" href="/-/profile?set_status=1">Set status</a></li>
                  <li><a data-qa-selector="edit_profile_link" href="/-/profile">Edit profile</a></li>
                  <li><a href="/-/profile/preferences">Preferences</a></li>
                  <li className="divider" />
                  <li><a className="sign-out-link" data-qa-selector="sign_out_link" href="/users/sign_out">Sign out</a></li>
                </ul>
              </Dropdown>
            </ul>
          </div>
        </div>
      </div>
      {shortcutsOpen ? <ShortcutsModal onClose={() => setShortcutsOpen(false)} /> : null}
      {whatsNewOpen ? <WhatsNewDrawer onClose={() => setWhatsNewOpen(false)} /> : null}
    </header>
  )
}
