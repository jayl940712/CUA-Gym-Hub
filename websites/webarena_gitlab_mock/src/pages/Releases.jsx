import React, { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import Dropdown from '../components/ui/Dropdown.jsx'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useProject, useQuery } from './hooks.js'
import NotFound from './NotFound.jsx'
import { getReleases } from '../utils/dataManager.js'
import { renderMarkdown } from '../utils/markdown.js'
import { formatTimeTooltip, timeAgo } from '../utils/format.js'
import { GlEmptyState } from './ProjectOps.jsx'

// ---------------------------------------------------------------------------
// ROUTES #111 — `/:ns/:proj/-/releases` and `/:ns/:proj/-/releases/:tag`.
//
// This page used to be `GlEmptyState` unconditionally, because every capture
// taken for the earlier rounds came from `byteblaze/dotfiles`, which has no
// releases. The instance in fact has **1 732 releases over 48 of the 175
// projects** (`SELECT count(*), count(DISTINCT project_id) FROM releases` ->
// `1732 | 48`), so the empty state was right for 127 projects and wrong for 48.
//
// Every class, string, `data-testid` and link target below is read off a live
// capture of `/bblanchon/ArduinoJson/-/releases` and
// `/DynamoRIO/dynamorio/-/releases` (saved to /tmp/rel-*.html). Two deliberate
// omissions, both matching what the rest of this app already does: GitLab's
// Vue `<!---->` placeholder comments, and the gravatar <img> in the footer
// (an external network call the migration contract forbids) — the mock's own
// initials avatar stands in, as it does on every other page.
//
// Not modelled, because this instance has none of it: release milestones,
// release evidence, and non-source-code assets (`links`). `SELECT count(*)
// FROM release_links` is 0 and no release here has a milestone, so the source
// itself renders exactly the four generated source-code archives below.
// ---------------------------------------------------------------------------

/** The source paginates releases 10 at a time (`releases.json._page_size`). */
const PER_PAGE = 10

/**
 * Page-scoped CSS, the same pattern `Search.jsx` uses and for the same reason.
 *
 * `global.css` deliberately does NOT define `gl-flex-direction-column`,
 * `.card*`, `gl-align-self-end`, `gl-float-left`, `gl-rotate-90` or
 * `.collapse` globally — round 8's responsive geometry is a protected contract
 * and defining those utilities globally moved the page height of eight measured
 * routes (see the note above the `:is(.pipelines-container, …)` block in
 * global.css). Without them this page laid its ten cards out in a ROW and blew
 * horizontally off the viewport at both 1920 and 1280; caught by screenshotting
 * at 1280x720, not by any DOM assertion, which is exactly the failure mode the
 * viewport rule exists for.
 *
 * Everything here is scoped under `.releases-page`, so the blast radius outside
 * this route is zero.
 */
const PAGE_CSS = `
.releases-page { display: flex; flex-direction: column; }
/* The sort group and "New release" sit on ONE row at the right-hand edge; without
   these three the .btn-group elements are display:block and each takes a line. */
.releases-page .gl-align-self-end {
  align-self: flex-end; display: flex; align-items: center;
}
.releases-page .gl-sorting.btn-group,
.releases-page .dropdown.b-dropdown.btn-group { display: inline-flex; }
/* font-size-inherit is the class the source puts on the card's title link; the
   default anchor rule would otherwise shrink it from the h2's 24px to 14px.
   (No backticks anywhere in this string - it is a template literal.) */
.releases-page .font-size-inherit { font-size: inherit; }
.releases-page .card {
  background: #fff; border: 1px solid var(--border-default, #dcdcde);
  border-radius: 4px; margin-bottom: 16px;
}
.releases-page .card-header {
  display: flex; align-items: center; background: #fff; padding: 4px 16px;
  border-bottom: 1px solid var(--border-default, #dcdcde);
  border-radius: 4px 4px 0 0;
}
.releases-page .card-title {
  font-size: 24px; line-height: 32px; font-weight: 600; margin: 8px auto 8px 0;
}
.releases-page .card-title a { color: var(--blue-500, #1f75cb); }
.releases-page .card-body { padding: 8px 16px 16px; }
.releases-page .card-footer {
  display: flex; align-items: center; padding: 12px 16px;
  background: var(--gray-10, #fbfafd);
  border-top: 1px solid var(--border-default, #dcdcde);
  border-radius: 0 0 4px 4px;
}
.releases-page .gl-float-left { float: none; }
.releases-page .gl-mr-5 { margin-right: 16px; }
.releases-page .collapse { display: none; }
.releases-page .collapse.show { display: block; }
.releases-page .gl-pl-6 { padding-left: 24px; }
.releases-page .gl-pt-3 { padding-top: 8px; }
.releases-page .js-assets-list ul { margin: 0; padding: 0; list-style: none; }
.releases-page .js-assets-list li { padding: 1px 0; }
.releases-page .gl-line-height-24 { line-height: 24px; }
.releases-page .gl-rotate-90 { transform: rotate(90deg); }
.releases-page .gl-transition-medium { transition: transform .2s ease; }
.releases-page .gl-font-weight-bold { font-weight: 600; }
.releases-page .gl-justify-content-center { justify-content: center; }
.releases-page .gl-my-n1 { margin-top: -4px; margin-bottom: -4px; }
.releases-page .gl-keyset-pagination { margin: 8px 0 24px; }
/* The short connector the source draws between consecutive cards. */
.releases-page .linked-card { position: relative; }
.releases-page .linked-card:not(:last-of-type)::after {
  content: ''; position: absolute; left: 16px; bottom: -16px; height: 16px;
  border-left: 1px solid var(--border-default, #dcdcde);
}
`

const SORTS = [
  { key: 'released_at', label: 'Released date' },
  { key: 'created_at', label: 'Created date' },
]

/**
 * The keyset cursor GitLab puts in `?after=` / `?before=`.
 *
 * Live example, decoded:
 *   {"released_at":"2023-01-14 03:01:34.000000000 +0000","id":"1585"}
 * base64, `=` padding stripped. Same shape here; the timestamp is this seed's
 * own `released_at` text rather than postgres' nanosecond rendering, because
 * only the `id` is ever read back — the timestamp is carried so a cursor stays
 * self-describing when a human decodes one, which is exactly how GitLab uses
 * it too (the tie-break, never the lookup key).
 */
function encodeCursor(rel) {
  try {
    return btoa(JSON.stringify({ released_at: rel.released_at, id: String(rel.id) }))
      .replace(/=+$/, '')
  } catch (e) { return '' }
}

function cursorId(raw) {
  if (!raw) return null
  try {
    const pad = raw + '==='.slice((raw.length + 3) % 4)
    const obj = JSON.parse(atob(pad))
    const n = Number(obj && obj.id)
    return Number.isFinite(n) ? n : null
  } catch (e) { return null }
}

/** `Source code (zip)` … — generated from the tag, exactly as the source does. */
function assetsFor(project, tag) {
  const name = project.path || project.name
  return [
    ['zip', `${name}-${tag}.zip`],
    ['tar.gz', `${name}-${tag}.tar.gz`],
    ['tar.bz2', `${name}-${tag}.tar.bz2`],
    ['tar', `${name}-${tag}.tar`],
  ].map(([ext, file]) => ({
    ext,
    href: `/${project.full_path}/-/archive/${tag}/${file}`,
  }))
}

/**
 * One `.card.release-block`. `linked` adds the `linked-card` class the index
 * uses and the detail page does not.
 */
function ReleaseCard({ release, project, base, author, linked }) {
  const [assetsOpen, setAssetsOpen] = useState(true)
  const assets = assetsFor(project, release.tag)
  return (
    <div id={release.tag} className={`card release-block${linked ? ' linked-card' : ''}`}>
      <div className="card-header d-flex align-items-center bg-white pr-0">
        <h2 className="card-title my-2 mr-auto">
          <a href={`${base}/-/releases/${encodeURIComponent(release.tag)}`}
            className="gl-link font-size-inherit">{release.name || release.tag}</a>
        </h2>
      </div>
      <div className="card-body">
        <div className="card-text gl-mt-3">
          <button data-testid="accordion-button" type="button"
            className="btn gl-font-weight-bold btn-link btn-md gl-button"
            aria-expanded={assetsOpen}
            onClick={() => setAssetsOpen(v => !v)}>
            <span className="gl-button-text">
              <Icon name="chevron-right"
                className={`gl-transition-medium${assetsOpen ? ' gl-rotate-90' : ''}`} />
              {' Assets '}
              <span className="badge gl-display-inline-block badge-neutral badge-pill gl-badge sm">
                {` ${assets.length}`}
              </span>
            </span>
          </button>
          <div className={`collapse${assetsOpen ? ' show' : ''}`}>
            <div className="gl-pl-6 gl-pt-3 js-assets-list">
              <ul className="list-unstyled gl-m-0">
                {assets.map(a => (
                  <li className="gl-display-flex" key={a.ext}>
                    <a href={a.href}
                      className="gl-link gl-display-flex gl-align-items-center gl-line-height-24">
                      <Icon name="doc-code" className="gl-mr-2 gl-flex-shrink-0 gl-flex-grow-0" />
                      {`Source code (${a.ext})`}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        {release.description ? (
          <div className="card-text gl-mt-3">
            <div className="md" dangerouslySetInnerHTML={{ __html: renderMarkdown(release.description) }} />
          </div>
        ) : null}
      </div>
      <div className="card-footer">
        <div className="gl-float-left gl-mr-5 gl-display-flex gl-align-items-center js-tag-info">
          <Icon name="tag" className="gl-mr-2" />
          <div title="Tag">
            <a href={`${base}/-/tags/${encodeURIComponent(release.tag)}`} className="gl-link">
              {release.tag}
            </a>
          </div>
        </div>
        <div className="gl-float-left gl-display-flex gl-align-items-center js-author-date-info">
          <span className="gl-text-secondary">{'Released '}</span>
          <span title={formatTimeTooltip(release.released_at)}
            className="gl-text-secondary gl-flex-shrink-0">
            {`${timeAgo(release.released_at)} `}
          </span>
          {author ? (
            <div className="gl-display-flex">
              <span className="gl-text-secondary">{'by '}</span>
              <a href={`/${author.username}`}
                className="gl-link gl-avatar-link user-avatar-link gl-my-n1 gl-display-flex">
                <UserAvatar user={author} size={24} alt={`${author.username}'s avatar`} />
              </a>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}

/** Newest-first by the selected column; the direction button flips it. */
function sortReleases(rows, key, desc) {
  const ts = v => new Date(String(v || '').replace(' ', 'T')).getTime() || 0
  return [...rows].sort((a, b) => {
    const d = ts(a[key]) - ts(b[key])
    return desc ? -d : d
  })
}

export default function Releases() {
  const { state, indexes } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  const navigate = useNavigate()
  const [sort, setSort] = useState('released_at')
  const [desc, setDesc] = useState(true)

  usePageChrome({
    title: project
      ? `Releases · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
  })
  if (!state) return null
  if (!project) return <NotFound />

  const all = sortReleases(getReleases(project), sort, desc)

  // Keyset window. `after` is the LAST row of the previous page, `before` the
  // FIRST row of the next one — both verified by clicking Next/Prev on the
  // live site and decoding the cursors it put in the URL.
  const afterId = cursorId(q.get('after'))
  const beforeId = cursorId(q.get('before'))
  let start = 0
  if (afterId != null) {
    const i = all.findIndex(r => r.id === afterId)
    if (i >= 0) start = i + 1
  } else if (beforeId != null) {
    const i = all.findIndex(r => r.id === beforeId)
    if (i >= 0) start = Math.max(0, i - PER_PAGE)
  }
  const page = all.slice(start, start + PER_PAGE)
  const hasPrev = start > 0
  const hasNext = start + PER_PAGE < all.length

  const go = (param, rel) => {
    const p = new URLSearchParams(q.searchParams)
    p.delete('after')
    p.delete('before')
    if (rel) p.set(param, encodeCursor(rel))
    const qs = p.toString()
    navigate(`${base}/-/releases${qs ? `?${qs}` : ''}`)
  }

  const sortControl = (
    <div className="gl-align-self-end gl-mb-3">
      <div role="group" className="gl-sorting gl-mr-2 btn-group" data-testid="releases-sort">
        <Dropdown className="dropdown b-dropdown gl-dropdown btn-group"
          toggleClassName="btn dropdown-toggle btn-default btn-md gl-button gl-dropdown-toggle btn-default-secondary"
          toggle={<>
            <span className="gl-dropdown-button-text">
              {(SORTS.find(s => s.key === sort) || SORTS[0]).label}
            </span>
            <Icon name="chevron-down" className="gl-button-icon dropdown-chevron" />
          </>}
          menuAs="ul" menuClassName="dropdown-menu dropdown-menu-right">
          {SORTS.map(s => (
            <li role="presentation" className="gl-dropdown-item" key={s.key}>
              <button role="menuitem" type="button"
                className={`dropdown-item${s.key === sort ? ' active' : ''}`}
                onClick={() => setSort(s.key)}>
                <div className="gl-dropdown-item-text-wrapper">
                  <p className="gl-dropdown-item-text-primary">
                    <Icon name="mobile-issue-close" aria-label="Selected"
                      className={`gl-sorting-item js-active-icon gl-flex-shrink-0 gl-mr-2${s.key === sort ? '' : ' inactive gl-visibility-hidden'}`} />
                    {s.label}
                  </p>
                </div>
              </button>
            </li>
          ))}
        </Dropdown>
        <button title="Sort direction"
          aria-label={`Sorting Direction: ${desc ? 'Descending' : 'Ascending'}`}
          type="button"
          className="btn btn-default btn-md gl-button btn-icon sorting-direction-button"
          onClick={() => setDesc(v => !v)}>
          <Icon name={desc ? 'sort-highest' : 'sort-lowest'} className="gl-button-icon" />
        </button>
      </div>
      <a href={`${base}/-/releases/new`} className="btn btn-confirm btn-md gl-button"
        aria-describedby="releases-description">
        <span className="gl-button-text">New release</span>
      </a>
    </div>
  )

  if (all.length === 0) {
    // Byte-for-byte the empty state this route served before releases were
    // seeded — 127 of the 175 projects still land here, and the source does
    // too. Do not "simplify" it: the strings are anchored in assets/html.
    return (
      <div className="releases-page gl-display-flex gl-flex-direction-column gl-mt-3">
        <style>{PAGE_CSS}</style>
        {sortControl}
        <GlEmptyState title="Getting started with releases">
          <span id="releases-description">
            {`Releases are based on Git tags and mark specific points in a project's development `}
            {'history. They can contain information about the type of changes and can also deliver '}
            {'binaries, like compiled versions of your software. '}
            <a aria-label="Releases documentation" href="/help/user/project/releases/index"
              className="gl-link">More information</a>
          </span>
        </GlEmptyState>
      </div>
    )
  }

  return (
    <div className="releases-page gl-display-flex gl-flex-direction-column gl-mt-3">
      <style>{PAGE_CSS}</style>
      {sortControl}
      {page.map(r => (
        <ReleaseCard key={r.id} release={r} project={project} base={base} linked
          author={indexes.usersById.get(r.author_id)} />
      ))}
      <div className="gl-display-flex gl-justify-content-center">
        <div role="group" className="gl-keyset-pagination btn-group">
          <button data-testid="prevButton" type="button" disabled={!hasPrev}
            className={`btn btn-default btn-md gl-button${hasPrev ? '' : ' disabled'}`}
            onClick={() => go('before', page[0])}>
            <span className="gl-button-text">
              <div className="gl-display-flex gl-align-center">
                <Icon name="chevron-left" />
                {' Prev '}
              </div>
            </span>
          </button>
          <button data-testid="nextButton" type="button" disabled={!hasNext}
            className={`btn btn-default btn-md gl-button${hasNext ? '' : ' disabled'}`}
            onClick={() => go('after', page[page.length - 1])}>
            <span className="gl-button-text">
              <div className="gl-display-flex gl-align-center">
                {' Next '}
                <Icon name="chevron-right" />
              </div>
            </span>
          </button>
        </div>
      </div>
    </div>
  )
}

/**
 * ROUTES #111b — `/:ns/:proj/-/releases/:tag`. The same card, standalone: no
 * `linked-card` class, no sort control, no pagination, and the document title
 * is the release NAME rather than "Releases · …" (checked on the live page,
 * whose <title> is `ArduinoJson 6.21.0 · Benoît Blanchon / ArduinoJson · GitLab`).
 */
export function ReleaseDetail() {
  const { state, indexes } = useApp()
  const { project, base } = useProject()
  const params = useParams()
  const tag = decodeURIComponent(params.tag || '')
  const release = getReleases(project).find(r => r.tag === tag) || null

  usePageChrome({
    title: project && release
      ? `${release.name || release.tag} · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    breadcrumbExtra: project
      ? [{ text: 'Releases', href: `${base}/-/releases` },
        { text: tag, href: `${base}/-/releases/${encodeURIComponent(tag)}` }]
      : undefined,
  })
  if (!state) return null
  if (!project || !release) return <NotFound />

  return (
    <div className="releases-page gl-mt-3">
      <style>{PAGE_CSS}</style>
      <ReleaseCard release={release} project={project} base={base}
        author={indexes.usersById.get(release.author_id)} />
    </div>
  )
}
