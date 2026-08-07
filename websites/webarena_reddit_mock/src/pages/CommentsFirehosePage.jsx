import React from 'react'
import { useParams, useSearchParams, useLocation } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import SLink from '../components/SLink.jsx'
import Pagination from '../components/Pagination.jsx'
import { ForumSidebar } from '../components/Sidebars.jsx'
import CommentRow from '../components/discovery/CommentRow.jsx'
import NotFound from './NotFound.jsx'
import { useApp } from '../context/AppContext.jsx'
import { readCursor, buildCursorQuery, PER_PAGE } from '../utils/listing.js'
import '../components/discovery/discovery.css'

// ROUTES #7 `/comments` and #14 `/f/{forum}/comments` — the comment firehoses.
// templates/comment/list.html.twig, captured in assets/html/comments.html and
// f_books_comments.html, screenshots 22-comments-firehose.png and
// 30-forum-books-comments.png.
//
// Page shape differs slightly between the two, and the difference is in the
// captures, not invented:
//
//   /comments            nav(tabs) THEN <h1>Recent comments</h1>, empty sidebar
//   /f/{name}/comments   <h1>Recent comments in <a href="/f/x">/f/x</a></h1>
//                        THEN nav(tabs), forum sidebar
//
// Neither has a sort dropdown — the order is fixed newest-first.
//
// Ordering + paging are the source's, read off the `rel="next"` link:
//   /comments?next%5Btimestamp%5D=2023-03-31T23%3A59%3A39%2B00%3A00&next%5Bid%5D=2561487
// i.e. ORDER BY timestamp DESC, id DESC with a 25-row PagerWave cursor whose
// value is the sort key of the FIRST row of the next page. Same cursor
// machinery as the submission listings, so it reuses readCursor() /
// buildCursorQuery() out of utils/listing.js rather than restating it.

const COMMENT_SORT = [
  { field: 'timestamp', dir: 'DESC' },
  { field: 'id', dir: 'DESC' }
]

function keyValue(comment, field) {
  if (field === 'timestamp') {
    const t = Date.parse(comment.timestamp)
    return isNaN(t) ? 0 : t
  }
  return Number(comment[field]) || 0
}

function cursorValue(raw, field) {
  if (raw === undefined || raw === null) return null
  if (field === 'timestamp') {
    const t = Date.parse(raw)
    return isNaN(t) ? null : t
  }
  const n = Number(raw)
  return isNaN(n) ? null : n
}

/**
 * Cursor page over the comment firehose. An unrecognised or malformed
 * `next[...]` is accepted and ignored rather than 404ed, exactly as the
 * submission listings do (ROUTES.md).
 */
export function paginateComments(sorted, searchParams, perPage = PER_PAGE) {
  const cursor = readCursor(searchParams, 'next')
  let rows = sorted

  if (cursor) {
    const parsed = COMMENT_SORT
      .map(({ field, dir }) => ({ field, dir, value: cursorValue(cursor[field], field) }))
      .filter(c => c.value !== null)

    if (parsed.length) {
      rows = sorted.filter(c => {
        for (const { field, dir, value } of parsed) {
          const v = keyValue(c, field)
          if (v !== value) return dir === 'ASC' ? v > value : v < value
        }
        return true
      })
    }
  }

  const items = rows.slice(0, perPage)
  const overflow = rows[perPage]
  const nextCursor = overflow
    ? { timestamp: overflow.timestamp, id: String(overflow.id) }
    : null

  return { items, nextCursor }
}

export default function CommentsFirehosePage({ scope = 'site' }) {
  const params = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { state, getForum, getSubmission, getComment } = useApp()

  let forum = null
  if (scope === 'forum') {
    forum = getForum(params.forum)
    if (!forum) return <NotFound />
  }

  const forumName = forum ? forum.name.toLowerCase() : null

  // A comment is only reachable if its submission still is — deleting a
  // submission removes its comments from the firehose too.
  const pool = state.comments.filter(c => {
    if (c.visibility === 'trashed') return false
    const sub = getSubmission(c.submission)
    if (!sub) return false
    if (forumName && String(sub.forum).toLowerCase() !== forumName) return false
    return true
  })

  const sorted = [...pool].sort((a, b) =>
    Date.parse(b.timestamp) - Date.parse(a.timestamp) || b.id - a.id)

  const { items, nextCursor } = paginateComments(sorted, searchParams)

  const nextQuery = nextCursor ? buildCursorQuery(searchParams, nextCursor) : null
  const pagerHref = nextQuery ? `${location.pathname}?${nextQuery}` : null

  const tabs = forum
    ? { submissions: `/f/${forum.name}`, comments: `/f/${forum.name}/comments` }
    : { submissions: '/', comments: '/comments' }

  const heading = forum
    ? (
      <h1 className="page-heading">
        Recent comments in <SLink to={`/f/${forum.name}`}>/f/{forum.name}</SLink>
      </h1>
    )
    : <h1 className="page-heading">Recent comments</h1>

  const nav = (
    <nav className="flex flex--guttered">
      <ul className="unlistify flex">
        <li><SLink to={tabs.submissions} className="tab ">Submissions</SLink></li>
        <li><SLink to={tabs.comments} className="tab tab--active">Comments</SLink></li>
      </ul>
    </nav>
  )

  const title = forum ? `Recent comments in /f/${forum.name}` : 'Recent comments'

  return (
    <Layout sidebar={forum ? <ForumSidebar forum={forum} /> : null} title={title}>
      {forum ? <>{heading}{nav}</> : <>{nav}{heading}</>}

      {items.length === 0 && (
        <p className="fg-muted"><small className="text-md">There are no entries to display.</small></p>
      )}

      {items.map(c => (
        <CommentRow
          key={c.id}
          comment={c}
          submission={getSubmission(c.submission)}
          parent={c.parent !== undefined && c.parent !== null ? getComment(c.parent) : null}
        />
      ))}

      <Pagination nextHref={pagerHref} />
    </Layout>
  )
}
