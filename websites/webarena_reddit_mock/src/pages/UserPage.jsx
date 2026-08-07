import React from 'react'
import { useParams, useSearchParams, useLocation } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import Submission from '../components/Submission.jsx'
import Pagination from '../components/Pagination.jsx'
import UserNav from '../components/user/UserNav.jsx'
import UserSidebar from '../components/user/UserSidebar.jsx'
import UserCommentRow from '../components/user/UserCommentRow.jsx'
import NotFound from './NotFound.jsx'
import { useApp } from '../context/AppContext.jsx'
import {
  USER_PAGE_SPECS, sortRows, paginateRows, buildCursorQuery
} from '../components/user/userPaging.js'
import '../components/user/user.css'

// ROUTES #61 / #63 / #64 — templates/user/{user,submissions,comments}.html.twig.
//
//   /user/{name}              overview: submissions AND comments interleaved,
//                             `timestamp DESC` (cursor: next[timestamp])
//   /user/{name}/submissions  `id DESC`        (cursor: next[id])
//   /user/{name}/comments     `timestamp DESC, id DESC`
//                             (cursor: next[timestamp] + next[id])
//
// The orderings and cursor shapes were read verbatim off the live site's
// rel="next" links in assets/html/user_MarvelsGrantMan136*.html — that also
// resolves assets/README.md UNVERIFIED item 4 (the comments-tab ordering).
// 25 rows per page, like every other listing.
//
// ⚠️ /user/MarvelsGrantMan136 is an anchor route (webarena-399..403). The
// evaluator reads `.user-bio__biography`, which UserSidebar renders.

export default function UserPage({ tab = 'overview' }) {
  const { username } = useParams()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const { state, getUser } = useApp()

  const user = getUser(username)
  if (!user) return <NotFound />

  const submissions = state.submissions.filter(
    s => s.author === user.username && s.visibility !== 'trashed'
  )
  const comments = state.comments.filter(
    c => c.author === user.username && c.visibility !== 'trashed'
  )

  let rows
  let spec
  if (tab === 'submissions') {
    rows = submissions
    spec = USER_PAGE_SPECS.submissions
  } else if (tab === 'comments') {
    rows = comments
    spec = USER_PAGE_SPECS.comments
  } else {
    rows = [...submissions, ...comments]
    spec = USER_PAGE_SPECS.overview
  }

  const sorted = sortRows(rows, spec)
  const { items, nextCursor } = paginateRows(sorted, spec, searchParams)

  const nextQuery = nextCursor ? buildCursorQuery(searchParams, nextCursor) : null
  const pagerHref = nextQuery ? `${location.pathname}?${nextQuery}` : null

  const current = tab === 'submissions'
    ? 'user_submissions'
    : tab === 'comments' ? 'user_comments' : 'user'

  // A submission row has a `title`; a comment row does not. That is exactly how
  // user.html.twig discriminates the interleaved contributions.
  const isSubmission = row => row.title !== undefined

  // `{% block title %}`: user/user.html.twig -> user.username,
  // user/submissions.html.twig -> 'user.submissions' ("Submissions"),
  // user/comments.html.twig -> 'user.comments' ("Comments").
  const pageTitle = tab === 'submissions'
    ? 'Submissions'
    : tab === 'comments' ? 'Comments' : user.username

  return (
    <Layout title={pageTitle} sidebar={<UserSidebar user={user} />}>
      <UserNav username={user.username} current={current} />

      {items.length > 0 ? (
        items.map(row => (
          isSubmission(row)
            ? <Submission key={`s${row.id}`} submission={row} />
            : <UserCommentRow key={`c${row.id}`} comment={row} />
        ))
      ) : (
        <p className="no-entries">
          <small className="fg-muted text-md">There are no entries to display.</small>
        </p>
      )}

      <Pagination nextHref={pagerHref} />
    </Layout>
  )
}
