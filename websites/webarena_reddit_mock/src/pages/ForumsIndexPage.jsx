import React from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import SLink from '../components/SLink.jsx'
import NotFound from './NotFound.jsx'
import ForumsNav from '../components/discovery/ForumsNav.jsx'
import OffsetPagination from '../components/discovery/OffsetPagination.jsx'
import { Dropdown, MenuItem } from '../components/ListNav.jsx'
import { useApp } from '../context/AppContext.jsx'
import { submissionCountLabel, subscriberCountLabel, formatNumber } from '../utils/format.js'
import '../components/discovery/discovery.css'

// ROUTES #31 — `/forums`, `/forums/{sortBy}`, `/forums/{sortBy}/{page}`.
// templates/forum/list.html.twig + _layouts/forum_card.html.twig.
//
// ⚠️ This page does NOT use the cursor pager the submission listings use.
// Postmill pages it by an integer PATH SEGMENT:
//   /forums/by_submissions/2, <link rel="prev" href="/forums">,
//   <link rel="next" href="/forums/by_submissions/3">
// (ROUTES.md "Cursor pagination — confirmed formats", last paragraph.)
//
// The five orderings were verified row-for-row against the live captures
// (assets/html/root-forums.html, forums_by_{name,subscribers,creation_date}.html
// and forums_by_submissions_2.html) — all 25 rows of every capture match:
//
//   by_submissions (DEFAULT) submissionCount DESC, name ASC (case-insensitive)
//   by_subscribers           subscriberCount DESC, name ASC (case-insensitive)
//   by_name                  name  ASC (case-insensitive)
//   by_title                 title ASC (case-insensitive)
//   by_creation_date         created DESC
//
// The canonical URL for the default sort drops the segment entirely: page 1 is
// `/forums`, page 2 is `/forums/by_submissions/2`. That asymmetry is in the
// source's own `rel="next"` links; reproduce it.

// Dropdown order is the source's, not alphabetical:
// Name · Title · Submissions · Subscribers · Creation date
// (assets/html/root-forums.html).
export const FORUM_SORTS = ['by_name', 'by_title', 'by_submissions', 'by_subscribers', 'by_creation_date']

export const FORUM_SORT_LABELS = {
  by_name: 'Name',
  by_title: 'Title',
  by_subscribers: 'Subscribers',
  by_submissions: 'Submissions',
  by_creation_date: 'Creation date'
}

export const FORUMS_PER_PAGE = 25

const ci = (s) => String(s || '').toLowerCase()

export function sortForums(forums, sortBy) {
  const list = [...forums]
  switch (sortBy) {
    case 'by_name':
      return list.sort((a, b) => ci(a.name).localeCompare(ci(b.name)))
    case 'by_title':
      return list.sort((a, b) => ci(a.title).localeCompare(ci(b.title)) || ci(a.name).localeCompare(ci(b.name)))
    case 'by_subscribers':
      return list.sort((a, b) =>
        (b.subscriberCount || 0) - (a.subscriberCount || 0) || ci(a.name).localeCompare(ci(b.name)))
    case 'by_creation_date':
      return list.sort((a, b) => String(b.created).localeCompare(String(a.created)))
    case 'by_submissions':
    default:
      return list.sort((a, b) =>
        (b.submissionCount || 0) - (a.submissionCount || 0) || ci(a.name).localeCompare(ci(b.name)))
  }
}

/** `/forums` for page 1 of the default sort, `/forums/{sort}/{page}` otherwise. */
export function forumsPath(sortBy, page) {
  if (page <= 1) return sortBy === 'by_submissions' ? '/forums' : `/forums/${sortBy}`
  return `/forums/${sortBy}/${page}`
}

/** _layouts/forum_card.html.twig, verbatim from assets/html/root-forums.html. */
function ForumCard({ forum }) {
  const { isSubscribed, subscribe, unsubscribe } = useApp()
  const subscribed = isSubscribed(forum.name)

  return (
    <article className="flex flex--slim-gutters flex--no-wrap flex--column flex-desktop--row flex-desktop--align-center pad-v">
      <div className="flex__grow flex__shrink">
        <h2 className="fw-normal text-md">
          <SLink to={`/f/${forum.name}`} className="no-underline" aria-label={`${forum.name} — ${forum.title}`}>
            <span className="flex flex--slim-gutters">
              <span aria-hidden="true">/f/<b>{forum.name}</b></span>
            </span>
            <b className="block fg-text text-xl no-underline__exempt" aria-hidden="true">{forum.title}</b>
          </SLink>
        </h2>
        <p className="break-text">{forum.description}</p>
      </div>
      <div>
        <div className="flex flex--guttered flex-desktop--slim-gutters flex--align-center flex-desktop--column">
          <form
            action={`/f/${forum.name}/${subscribed ? 'unsubscribe' : 'subscribe'}`}
            method="POST"
            className="form subscribe-form"
            data-forum={forum.name}
            onSubmit={e => { e.preventDefault(); subscribed ? unsubscribe(forum.name) : subscribe(forum.name) }}
          >
            <button
              type="submit"
              className={`subscribe-button subscribe-button--${subscribed ? 'unsubscribe' : 'subscribe'}`}
            >
              <span className="subscribe-button__label">
                <span className="subscribe-button__label-text">{subscribed ? 'Unsubscribe' : 'Subscribe'}</span>
                {/* See Sidebars.jsx — the two aria-hidden dummy labels from
                    templates/forum/_macros.html.twig that pin the button width. */}
                <span aria-hidden="true" className="subscribe-button__dummy-label">Subscribe</span>
                <span aria-hidden="true" className="subscribe-button__dummy-label">Unsubscribe</span>
              </span>
              <b className="subscribe-button__subscriber-count"
                 aria-label={subscriberCountLabel(forum.subscriberCount || 0)}>
                {formatNumber(forum.subscriberCount || 0)}
              </b>
            </button>
          </form>

          <p className="fg-muted">{submissionCountLabel(forum.submissionCount || 0)}</p>
        </div>
      </div>
    </article>
  )
}

export default function ForumsIndexPage() {
  const params = useParams()
  const { state } = useApp()

  const sortBy = params.sortBy || 'by_submissions'
  if (!FORUM_SORTS.includes(sortBy)) return <NotFound />

  const rawPage = params.page
  if (rawPage !== undefined && !/^[1-9][0-9]{0,17}$/.test(rawPage)) return <NotFound />
  const page = rawPage ? Number(rawPage) : 1

  const sorted = sortForums(state.forums, sortBy)
  const pageCount = Math.max(1, Math.ceil(sorted.length / FORUMS_PER_PAGE))
  // Postmill's pager 404s past the last page (verified: /tags/2 -> 404).
  if (page > pageCount) return <NotFound />

  const items = sorted.slice((page - 1) * FORUMS_PER_PAGE, page * FORUMS_PER_PAGE)

  return (
    <Layout title="List of forums">
      <nav className="flex flex--guttered">
        <ForumsNav active="forums" />

        <ul className="unlistify">
          <Dropdown
            icon="sort"
            label={FORUM_SORT_LABELS[sortBy]}
            ariaLabel={`Sort by: ${FORUM_SORT_LABELS[sortBy]}`}
          >
            {FORUM_SORTS.map(key => (
              <MenuItem key={key} to={forumsPath(key, 1)} active={key === sortBy}>
                {FORUM_SORT_LABELS[key]}
              </MenuItem>
            ))}
          </Dropdown>
        </ul>
      </nav>

      <div className="flex flex--guttered">
        <h1 className="page-heading flex__grow">List of forums</h1>
        {/* forum/list.html.twig wraps the button in a bare <div>; without it
            the <a> is itself the flex item and `align-items: stretch` pulls it
            to the 42px heading height instead of its natural 37px. */}
        <div>
          <SLink to="/create_forum" className="button">Create forum</SLink>
        </div>
      </div>

      <div className="border-list">
        {items.map(f => <ForumCard key={f.id} forum={f} />)}
      </div>

      <OffsetPagination page={page} pageCount={pageCount} hrefFor={p => forumsPath(sortBy, p)} />
    </Layout>
  )
}
