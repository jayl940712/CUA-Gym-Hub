import React from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import SLink from '../components/SLink.jsx'
import Time from '../components/Time.jsx'
import Forbidden from '../components/user/Forbidden.jsx'
import OffsetPagination from '../components/user/OffsetPagination.jsx'
import { useApp } from '../context/AppContext.jsx'
import { formatNumber } from '../utils/format.js'
import '../components/user/user.css'

// ROUTES #77 — templates/user/list.html.twig + UserController::list.
//
// PARITY DECISION: the live site returns a bare **403 Forbidden** here for
// `MarvelsGrantMan136` (captured in assets/html/users-auth.html — 688 bytes, no
// site chrome). `/users` is admin-only and the seeded user is not an admin, so
// that is what the mock renders by default. SOURCE.md gap 6 and ROUTES.md #77
// both call for reproducing the 403, and an agent that lands here on the source
// sees exactly this page.
//
// The list itself is still implemented, gated on `currentUser.admin`, so the
// route is not a dead end for a task that injects an admin user — and so the
// 3,861-entry userDirectory seed is actually reachable.
//
// Real source behaviour reproduced: 25 rows per page (UserRepository::
// findPaginated), offset pages as a PATH segment (/users/2), the "Filter
// results" disclosure with Order by / Role, and the 9-column table
// (ID, Username, Registration date, Role, Moderates, S, C, SV, CV).
//
// Ordering: the source's default is `id DESC`. userDirectory.json carries only
// `username -> join date`, with no ids, so the mock orders by join date DESC
// (which is what `id DESC` means for this corpus) and breaks ties by username.
// `?orderBy=username` switches to normalized-username ASC, as on the source.

const PER_PAGE = 25

export default function UsersListPage() {
  const params = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const { state } = useApp()

  if (!state.currentUser.admin) return <Forbidden />

  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const orderBy = searchParams.get('orderBy') === 'username' ? 'username' : 'created'
  const role = ['any', 'admin', 'whitelisted', 'none'].includes(searchParams.get('role'))
    ? searchParams.get('role')
    : 'any'

  const rich = new Map(state.users.map(u => [u.username, u]))

  let rows = Object.entries(state.userDirectory).map(([username, joined]) => {
    const u = rich.get(username)
    return {
      username,
      created: u ? u.created : `${joined}T00:00:00+00:00`,
      id: u ? u.id : null,
      admin: !!(u && u.admin),
      whitelisted: !!(u && u.whitelisted),
      submissionCount: u ? u.submissionCount : 0,
      commentCount: u ? u.commentCount : 0
    }
  })

  if (role === 'admin') rows = rows.filter(r => r.admin)
  else if (role === 'whitelisted') rows = rows.filter(r => r.whitelisted && !r.admin)
  else if (role === 'none') rows = rows.filter(r => !r.whitelisted && !r.admin)

  rows.sort(orderBy === 'username'
    ? (a, b) => a.username.toLowerCase().localeCompare(b.username.toLowerCase())
    : (a, b) => Date.parse(b.created) - Date.parse(a.created)
      || a.username.toLowerCase().localeCompare(b.username.toLowerCase()))

  const pageCount = Math.max(1, Math.ceil(rows.length / PER_PAGE))
  const items = rows.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  const query = searchParams.toString()
  const hrefFor = (n) => `/users${n > 1 ? `/${n}` : ''}${query ? `?${query}` : ''}`

  const onFilter = (e) => {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const next = new URLSearchParams(searchParams)
    next.set('orderBy', data.get('user_filter[orderBy]'))
    next.set('role', data.get('user_filter[role]'))
    setSearchParams(next)
  }

  const num = (n) => (n > 0 ? formatNumber(n) : '-')

  return (
    <Layout title={`List of users, page #${page}`}>
      <h1 className="page-heading">List of users, page #{formatNumber(page)}</h1>

      <details>
        <summary>Filter results</summary>

        <form method="get" className="form flow" onSubmit={onFilter}>
          <div className="flow-slim">
            <div className="form-flex form-flex--single-line">
              <label className="form-flex__align text-align-right" htmlFor="user_filter_orderBy">
                Order by
              </label>
              <span className="unstylable-widget">
                <select id="user_filter_orderBy" name="user_filter[orderBy]"
                        className="form-control" defaultValue={orderBy}>
                  <option value="created">Registration date</option>
                  <option value="username">Username</option>
                </select>
                <span className="unstylable-widget__caret" aria-hidden="true"></span>
              </span>
            </div>
          </div>

          <div className="flow-slim">
            <div className="form-flex form-flex--single-line">
              <label className="form-flex__align text-align-right" htmlFor="user_filter_role">
                Role
              </label>
              <span className="unstylable-widget">
                <select id="user_filter_role" name="user_filter[role]"
                        className="form-control" defaultValue={role}>
                  <option value="any">Any</option>
                  <option value="admin">Admins</option>
                  <option value="whitelisted">Whitelisted</option>
                  <option value="none">None</option>
                </select>
                <span className="unstylable-widget__caret" aria-hidden="true"></span>
              </span>
            </div>
          </div>

          <div className="form__row">
            <button className="button" type="submit">Filter</button>
          </div>
        </form>
      </details>

      {items.length > 0 ? (
        <>
          <table className="table">
            <thead>
              <tr>
                <th className="table__shrink">ID</th>
                <th>Username</th>
                <th>Registration date</th>
                <th>Role</th>
                <th>Moderates</th>
                <th className="table__shrink"><abbr title="Submissions">S</abbr></th>
                <th className="table__shrink"><abbr title="Comments">C</abbr></th>
                <th className="table__shrink"><abbr title="Submission votes">SV</abbr></th>
                <th className="table__shrink"><abbr title="Comment votes">CV</abbr></th>
              </tr>
            </thead>
            <tbody>
              {items.map(r => (
                <tr key={r.username}>
                  <td className="table__shrink">{r.id !== null ? r.id : '-'}</td>
                  <td><SLink to={`/user/${r.username}`}>{r.username}</SLink></td>
                  <td><Time iso={r.created} /></td>
                  <td>{r.admin ? 'Admin' : r.whitelisted ? 'Whitelisted' : '-'}</td>
                  <td>-</td>
                  <td className="table__shrink">{num(r.submissionCount)}</td>
                  <td className="table__shrink">{num(r.commentCount)}</td>
                  <td className="table__shrink">-</td>
                  <td className="table__shrink">-</td>
                </tr>
              ))}
            </tbody>
          </table>

          <OffsetPagination page={page} pageCount={pageCount} hrefFor={hrefFor} />
        </>
      ) : (
        <p>
          <small className="fg-muted text-md">There are no entries to display.</small>
        </p>
      )}
    </Layout>
  )
}
