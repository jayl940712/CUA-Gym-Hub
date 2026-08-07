import React from 'react'
import { useParams, useSearchParams, useLocation } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import { Dropdown, MenuItem, TimeDropdown } from '../components/ListNav.jsx'
import SLink from '../components/SLink.jsx'
import Icon from '../components/Icon.jsx'
import Pagination from '../components/Pagination.jsx'
import Submission from '../components/Submission.jsx'
import NotFound from './NotFound.jsx'
import { useApp } from '../context/AppContext.jsx'
import { collectTags } from './TagsPage.jsx'
import {
  normalizeSort, sortSubmissions, applyTimeFilter, paginate, buildCursorQuery,
  SORT_MODES, SORT_LABELS
} from '../utils/listing.js'

// ROUTES #93 — `/tag/{name}` and `/tag/{name}/{sortBy}`,
// ForumTagController::tag + templates/forum_tag/tag.html.twig, read out of
// container `forum`.
//
// The controller builds a plain submission listing scoped to the tag's forums:
//
//   $criteria = (new Criteria($sortBy))
//       ->showForums(...$tag->getForums())
//       ->excludeHiddenForums()
//       ->excludeBlockedUsers();
//
// and the template's body is the tag name as `h1`, a nav carrying ONLY
// `submission_sort` + `submission_time` (no Submissions/Comments tabs, no
// filter dropdown — same shape as a multireddit), the submissions, and the
// cursor pager. The sidebar is two sections: the tag itself (tag icon + name,
// then its description, then an admin-only Edit link) and
// `label.forums_with_this_tag` = "Forums with this tag" listing each forum as a
// small secondary button.
//
// Tags are not a separate entity in the mock — a ForumTag exists exactly when
// some forum carries it, which is also the only way one can come into being
// here (`#forum_tags` on /create_forum and /f/{name}/edit). `collectTags()` is
// shared with /tags so the index and this page can never disagree.
//
// The seed has ZERO tags, so on a fresh session every `/tag/{name}` still 404s
// — verified live on the source (`GET /tag/foo` -> 404), which is the state
// this route was previously hard-wired to. Nothing is fabricated; the page only
// materialises once the agent creates a tag through the forum-edit UI, at which
// point /tags links here and the link resolves.
//
// The tag entity has a `description` column the mock has no writer for (the
// only editor is `/tag/{name}/edit`, ROUTES #94, admin-only and unbuilt), so
// the description block is simply absent — exactly as `{% if
// tag.description is not empty %}` renders it for a freshly created tag.

export default function TagPage() {
  const params = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { state, visibleSubmissions } = useApp()

  const rawT = searchParams.get('t')
  const t = rawT || 'all'

  // Route requirement `sortBy: %submission_sort_modes%` — anything else does
  // not match the route at all, so Symfony 404s before the controller runs.
  const rawSort = params.sortBy
  if (rawSort && !SORT_MODES.includes(rawSort)) return <NotFound />
  const sort = normalizeSort(rawSort, 'hot')

  // findByNameOrRedirectToCanonical() 404s when no ForumTag matches.
  const wanted = String(params.name || '').toLowerCase()
  const tag = collectTags(state.forums).find(x => x.name.toLowerCase() === wanted)
  if (!tag) return <NotFound />

  const key = tag.name.toLowerCase()
  const forums = (state.forums || [])
    .filter(f => (f.tags || []).some(x => String(x).trim().toLowerCase() === key))

  const hidden = new Set((state.hiddenForums || []).map(f => f.toLowerCase()))
  const names = new Set(forums
    .map(f => f.name.toLowerCase())
    .filter(n => !hidden.has(n)))

  const pool = visibleSubmissions().filter(s => names.has(String(s.forum).toLowerCase()))
  const sorted = sortSubmissions(applyTimeFilter(pool, t), sort)
  const { items, nextCursor } = paginate(sorted, sort, searchParams)

  const base = `/tag/${params.name}`
  const nextQuery = nextCursor ? buildCursorQuery(searchParams, nextCursor) : null

  const sidebar = (
    <>
      <section className="sidebar__section flow">
        <h2 className="sidebar__title">
          <span className="flex flex--slim-gutters">
            <Icon name="tag" />
            <span>{tag.name}</span>
          </span>
        </h2>
      </section>

      <section className="sidebar__section flow">
        <h2 className="sidebar__title">Forums with this tag</h2>
        <ul className="flex flex--slim-gutters unlistify">
          {forums.map(f => (
            <li key={f.name}>
              <SLink to={`/f/${f.name}`} className="button button--secondary button--small">
                {f.name}
              </SLink>
            </li>
          ))}
        </ul>
      </section>
    </>
  )

  return (
    <Layout sidebar={sidebar} title={tag.name}>
      <h1 className="page-heading">{tag.name}</h1>

      <nav>
        <ul className="unlistify flex">
          <Dropdown icon="sort" label={SORT_LABELS[sort]} ariaLabel={`Sort by: ${SORT_LABELS[sort]}`}>
            {SORT_MODES.map(k => (
              <MenuItem
                key={k}
                to={`${base}/${k}${['top', 'controversial', 'most_commented'].includes(k) ? '?t=day' : ''}`}
                active={sort === k}
              >
                {SORT_LABELS[k]}
              </MenuItem>
            ))}
          </Dropdown>
          <TimeDropdown pathname={location.pathname} rawT={rawT} sort={sort} />
        </ul>
      </nav>

      {items.length > 0 && (
        <div className="submission-listing flow">
          {items.map(s => <Submission key={s.id} submission={s} showForum />)}
        </div>
      )}

      <Pagination nextHref={nextQuery ? `${location.pathname}?${nextQuery}` : null} />
    </Layout>
  )
}
