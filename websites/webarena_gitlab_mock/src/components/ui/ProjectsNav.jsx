import React from 'react'
import Icon from '../layout/Icon.jsx'
import Dropdown from './Dropdown.jsx'

// The project-list chrome shared by `/`, `/dashboard/projects`,
// `/dashboard/projects/starred` and `/explore/projects*`.
//
// TEST.part-routes-a.md BUG-A07: the source renders ONE primary tab strip
// (`Yours N · Starred N · Explore · Topics`) on every one of those routes —
// the explore pages had lost it entirely and `Topics` was missing everywhere,
// which made `/explore/projects/topics` unreachable by clicking.
//
// TEST.part-routes-a.md BUG-A01 (P0): the sort menu used query-only hrefs
// (`href="?sort=name_asc"`). The global link interceptor in src/App.jsx bails on
// any href that does not start with `/`, so the browser did a real navigation
// that replaced the whole query string — including `?sid=`. The source itself
// emits rooted hrefs (`/dashboard/projects?sort=name_asc`, see
// assets/html/dashboard-projects-yours.html), so matching the source closes the
// bug: rooted hrefs go through the interceptor and keep `sid`.

/** Source sort tokens → the label GitLab renders. assets/html/dashboard-projects-yours.html */
export const PROJECT_SORT_LABELS = {
  latest_activity_desc: 'Updated date',
  created_desc: 'Last created',
  name_asc: 'Name',
  name_desc: 'Name, descending',
  stars_desc: 'Most stars',
  latest_activity_asc: 'Oldest updated',
  created_asc: 'Oldest created',
}

const SORT_ORDER = [
  'latest_activity_desc', 'created_desc', 'name_asc',
  'name_desc', 'stars_desc', 'latest_activity_asc', 'created_asc',
]

/**
 * byteblaze's persisted `projects_sort` in the shipped WebArena image is
 * `name_asc`, so every project list defaults to "Name".
 *
 * Sourced from assets/html/dashboard-projects-yours.html (captured 12:33:38) and
 * dashboard-projects.html (12:33:33) — both show `<span class="dropdown-toggle-text">Name</span>`
 * and an alphabetical row order. assets/html/dashboard-sorted.html (12:56:58) shows
 * "Most stars" because it was captured by loading a `?sort=` URL, which makes
 * GitLab persist a new preference onto the user record; that capture is NOT used
 * here. See TEST.part-anchors.md DIFF-003.
 */
export const DEFAULT_PROJECT_SORT = 'name_asc'

/**
 * Primary tab strip. The two badges are the user's UNFILTERED totals — the
 * source's `Yours 14 · Starred 3` never moves when a name/archived filter is
 * applied (BUG-A05).
 */
export function ProjectsPrimaryTabs({ active, ownedCount, starredCount, sort }) {
  const q = sort && sort !== DEFAULT_PROJECT_SORT ? `?sort=${sort}` : ''
  const cls = key => `nav-link gl-tab-nav-item${active === key ? ' active gl-tab-nav-item-active' : ''}`
  return (
    <div className="scrolling-tabs-container inner-page-scroll-tabs gl-flex-grow-1 gl-min-w-0">
      {/* Rendered once per project-list page. global.css does not implement the
          GitLab utility classes these blocks carry, so the filter form stacked
          instead of sitting inline (DIFF-A06 also had the whole card title in
          link blue; the source greys the namespace and bolds the project name). */}
      <style>{`
        .top-area .nav-controls .project-filter-form {
          display: flex; align-items: center; gap: 8px;
        }
        .top-area .nav-controls .js-project-filter-dropdown-wrap { flex: 0 0 auto; }
        li.project-row a.text-plain { color: var(--gray-900, #303030); text-decoration: none; }
        li.project-row a.text-plain:hover { text-decoration: underline; }
        li.project-row a.text-plain .namespace-name {
          color: var(--gray-500, #737278); font-weight: 400;
        }
        li.project-row a.text-plain .project-name { font-weight: 600; }
        li.project-row .user-access-role {
          color: var(--gray-500, #737278); font-size: 12px; line-height: 16px;
          border: 1px solid var(--gray-100, #dcdcde); border-radius: 4px; padding: 0 4px;
        }
        li.project-row .description { max-width: 600px; }
      `}</style>
      <ul className="scrolling-tabs nav-links gl-display-flex gl-flex-grow-1 gl-w-full nav gl-tabs-nav is-initialized">
        <li className="nav-item">
          <a className={`shortcuts-activity ${cls('yours')}`} data-placement="right"
            href={`/dashboard/projects${q}`}>Yours
            <span className="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge">{ownedCount}</span>
          </a>
        </li>
        <li className="nav-item">
          <a className={cls('starred')} data-placement="right"
            href={`/dashboard/projects/starred${q}`}>Starred
            <span className="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge">{starredCount}</span>
          </a>
        </li>
        <li className="nav-item">
          <a className={cls('explore')} data-placement="right" href="/explore">Explore</a>
        </li>
        <li className="nav-item">
          <a className={cls('topics')} data-placement="right" href="/explore/projects/topics">Topics</a>
        </li>
      </ul>
    </div>
  )
}

/**
 * The `Filter by name` form with the sort dropdown nested inside it, exactly as
 * the source nests them (`#project-filter-form` wraps `#sort-projects-dropdown`).
 * `formAs` lets the caller supply the sid-preserving <QueryForm>.
 */
export function ProjectsFilterControls({
  basePath, sort, archived = '', personal = false, name = '', formAs: Form = 'form',
}) {
  // Every menu href keeps the other two facets, like the source's do.
  const href = (over = {}) => {
    const p = new URLSearchParams()
    const a = 'archived' in over ? over.archived : archived
    const pe = 'personal' in over ? over.personal : personal
    if (a) p.set('archived', a)
    if (pe) p.set('personal', 'true')
    p.set('sort', 'sort' in over ? over.sort : sort)
    return `${basePath}?${p.toString()}`
  }
  const active = cond => (cond ? 'is-active' : undefined)

  return (
    <div className="nav-controls">
      <Form className="project-filter-form" data-qa-selector="project_filter_form_container"
        id="project-filter-form" action={basePath}>
        <input type="search" name="name" id="project-filter-form-field" placeholder="Filter by name"
          className="project-filter-form-field form-control input-short js-projects-list-filter"
          spellCheck="false" defaultValue={name} />
        <input type="hidden" name="sort" id="sort" value={sort} readOnly />
        {archived ? <input type="hidden" name="archived" value={archived} readOnly /> : null}
        {personal ? <input type="hidden" name="personal" value="true" readOnly /> : null}
        <Dropdown className="dropdown js-project-filter-dropdown-wrap gl-display-inline"
          toggleClassName="dropdown-menu-toggle"
          toggleProps={{ id: 'sort-projects-dropdown', 'data-display': 'static' }}
          toggle={<>
            <span className="dropdown-toggle-text">
              {PROJECT_SORT_LABELS[sort] || PROJECT_SORT_LABELS[DEFAULT_PROJECT_SORT]}
            </span>
            <Icon name="chevron-down" className="s16 dropdown-menu-toggle-icon gl-top-3" />
          </>}
          menuAs="ul"
          menuClassName="dropdown-menu dropdown-menu-right dropdown-menu-selectable">
          <li className="dropdown-header">Sort by</li>
          {SORT_ORDER.map(key => (
            <li key={key}>
              <a className={active(sort === key)} href={href({ sort: key })}>{PROJECT_SORT_LABELS[key]}</a>
            </li>
          ))}
          <li className="divider" />
          <li><a className={active(!archived)} href={href({ archived: '' })}>Hide archived projects</a></li>
          <li><a className={active(archived === 'true')} href={href({ archived: 'true' })}>Show archived projects</a></li>
          <li><a className={active(archived === 'only')} href={href({ archived: 'only' })}>Show archived projects only</a></li>
          <li className="divider" />
          <li><a className={active(!personal)} href={href({ personal: false })}>Owned by anyone</a></li>
          <li><a className={active(personal)} href={href({ personal: true })}>Owned by me</a></li>
        </Dropdown>
      </Form>
    </div>
  )
}

/**
 * GitLab's archived filter is tri-state, matching the three menu items above:
 * unset hides archived, `true` shows everything, `only` shows archived alone.
 * `non_archived=true` is the explicit form of the default.
 */
export function filterArchived(rows, archived) {
  if (archived === 'only') return rows.filter(p => p.archived)
  if (archived === 'true') return rows
  return rows.filter(p => !p.archived)
}
