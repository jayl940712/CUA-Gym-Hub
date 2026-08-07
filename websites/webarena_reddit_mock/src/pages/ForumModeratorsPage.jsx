import React from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import Forbidden from '../components/forms/Forbidden.jsx'
import SLink from '../components/SLink.jsx'
import Time from '../components/Time.jsx'
import { ForumSidebar } from '../components/Sidebars.jsx'
import '../components/forms/forms.css'
import { useApp } from '../context/AppContext.jsx'

// ROUTES #18 `/f/{forum}/moderators[/{page}]` · #19 `/f/{forum}/add_moderator`
// · #20 `/f/{forum}/remove_moderator/{moderator_id}`
//
// templates/forum/moderators.html.twig embeds _layouts/table.html.twig:
//   Username | Since | Last seen | (Remove)
// The list itself is PUBLIC (ForumController::moderators carries no
// @IsGranted), so /f/news/moderators renders "This forum has no moderators."
// rather than a 403 — the 95 seeded forums genuinely have none.
//
// add_moderator is @IsGranted("ROLE_ADMIN") and the seeded user is not admin,
// so it renders the same bare 403 the source serves. The template's "Add"
// button is likewise admin-only, so nothing dead is rendered here.
//
// remove_moderator is POST-only and gated by Moderator::userCanRemove — a
// moderator may stand down from their own forum, which is the only case
// reachable for MarvelsGrantMan136.

/** Forum::getPaginatedModerators()'s `$maxPerPage = 25`. */
const MODS_PER_PAGE = 25

/** forum.moderators may be absent (seed) or hold plain usernames. */
export function moderatorsOf(forum, state) {
  if (Array.isArray(forum.moderators)) {
    return forum.moderators.map(m => typeof m === 'string'
      ? { username: m, since: forum.created }
      : { username: m.username, since: m.since || forum.created })
  }
  const mine = (state.moderatorOf || [])
    .some(f => f.toLowerCase() === forum.name.toLowerCase())
  return mine
    ? [{ username: state.currentUser.username, since: forum.created }]
    : []
}

export default function ForumModeratorsPage({ mode = 'list' }) {
  const params = useParams()
  const { state, getForum, editForum, setState, addFlash } = useApp()

  const forum = getForum(params.forum)
  if (!forum) return <NotFound />

  // @IsGranted("ROLE_ADMIN", statusCode=403)
  if (mode === 'add' && !state.currentUser.admin) return <Forbidden />

  const all = moderatorsOf(forum, state)

  // `/f/{forum}/moderators/{page}` — Forum::getPaginatedModerators() is a
  // Pagerfanta pager, so an out-of-range page throws NotFoundHttpException.
  // Confirmed live: GET /f/news/moderators/2 -> 404 (page 1 -> 200).
  const page = Math.max(1, parseInt(params.page || '1', 10) || 1)
  const mods = all.slice((page - 1) * MODS_PER_PAGE, page * MODS_PER_PAGE)
  if (page > 1 && mods.length === 0) return <NotFound />

  function remove(username) {
    const remaining = all.filter(m => m.username !== username)
    editForum(forum.name, { moderators: remaining })
    if (username === state.currentUser.username) {
      setState(prev => ({
        ...prev,
        moderatorOf: prev.moderatorOf.filter(f => f.toLowerCase() !== forum.name.toLowerCase())
      }))
    }
    addFlash('The user was unmodded.')
  }

  return (
    <Layout sidebar={<ForumSidebar forum={forum} />} title={`Moderators for /f/${forum.name}`}>
      <h1 className="page-heading">
        Moderators for <SLink to={`/f/${forum.name}`}>/f/{forum.name}</SLink>
      </h1>

      {/* Empty state is `flash.no_entries_to_display`, verbatim — verified live
          on /f/news/moderators. Never paraphrase an empty state. */}
      {mods.length === 0 ? (
        <p><small className="fg-muted text-md">There are no entries to display.</small></p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Username</th>
              <th className="table__shrink">Since</th>
              <th className="table__shrink">Last seen</th>
              <th className="table__shrink" />
            </tr>
          </thead>
          <tbody>
            {mods.map(m => (
              <tr key={m.username}>
                <td><SLink to={`/user/${m.username}`}>{m.username}</SLink></td>
                <td className="table__shrink"><Time iso={m.since} /></td>
                <td className="table__shrink">
                  <small className="fg-muted text-sm">Never</small>
                </td>
                <td className="table__shrink">
                  {m.username === state.currentUser.username && (
                    <form
                      action={`/f/${forum.name}/remove_moderator/${m.username}`}
                      method="post"
                      onSubmit={e => { e.preventDefault(); remove(m.username) }}
                    >
                      <button className="button button--small inline" type="submit">Remove</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  )
}
