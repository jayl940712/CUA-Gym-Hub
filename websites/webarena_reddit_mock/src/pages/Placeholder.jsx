import React from 'react'
import { useLocation, useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import SLink from '../components/SLink.jsx'
import NotFound from './NotFound.jsx'
import Icon from '../components/Icon.jsx'
import Time from '../components/Time.jsx'
import { ForumSidebar } from '../components/Sidebars.jsx'
import UserSidebar from '../components/user/UserSidebar.jsx'
import { useApp, normalizeBlocks } from '../context/AppContext.jsx'

/**
 * The five ROUTES rows that are still deliberately unbuilt (#21 bans,
 * #26 moderation log, #69 block list, #72 hidden forums, #75 user trash).
 *
 * They stay unbuilt — but they must not *announce* that. Three of them are
 * linked from persistent navigation (Bans and Moderation log sit in the Toolbox
 * of all 95 forum sidebars; Block list sits in the site-nav user menu), so an
 * agent hits them constantly, and the previous body text ("its page component
 * has not been built yet. TODO.md: ROUTES #21") is out-of-world copy an agent
 * will read and act on.
 *
 * What each route renders here is the source's own page with an empty list,
 * transcribed from the container's Twig:
 *
 *   forum/bans.html.twig          h1 'Bans in /f/<name>'   + _layouts/table (empty)
 *   forum/moderation_log.html.twig h1 'Showing moderation log for /f/<name>'
 *                                 + <nav> Global moderation log + p.no-entries
 *   user/block_list.html.twig     h1 'Block list'   + info alert + table (empty)
 *   user/hidden_forums.html.twig  h1 'Hidden forums' + info alert + table (empty)
 *   user/trash.html.twig          h1 'Trash'        + empty
 *
 * `_layouts/table.html.twig`'s empty branch and `moderation_log`'s else branch
 * are both `flash.no_entries_to_display` — "There are no entries to display." —
 * which is also what the source genuinely renders for the seeded user, who has
 * no bans, no blocks, no hidden forums and no trashed posts.
 *
 * The seed has no `bans`, `blocks`, `hiddenForums` or moderation-log entities,
 * so nothing is fabricated: on a fresh session the empty state IS the source's
 * state. Two of these are no longer *hardcoded* empty, though — `block_list`
 * derives from `state.blockedUsers` and `hidden_forums` from
 * `state.hiddenForums`, both of which the mock really writes, so the table
 * appears as soon as the user blocks or hides something.
 */

/** _macros/alert.html.twig with type='info' → `alert bg-yellow` + help-circled. */
function InfoAlert({ children }) {
  return (
    <div className="alert bg-yellow">
      <div className="alert__icon fg-yellow" aria-hidden="true">
        <Icon name="help-circled" />
      </div>
      <div className="alert__text text-flow">{children}</div>
    </div>
  )
}

/** flash.no_entries_to_display — never paraphrase an empty state. */
function NoEntries({ className }) {
  return (
    <p className={className}>
      <small className="fg-muted text-md">There are no entries to display.</small>
    </p>
  )
}

export default function Placeholder({ name }) {
  const { pathname } = useLocation()
  const params = useParams()
  const { state, getForum, unblockUser, unhideForum, addFlash } = useApp()

  const kind = pathname.split('/').pop()

  /* ---- forum sub-pages: forum/base.html.twig sidebar ---- */
  if (params.forum) {
    const forum = getForum(params.forum)
    if (!forum) return <NotFound />

    if (kind === 'moderation_log') {
      // block html_title renders the forum name as a link; block title is the
      // same string striptags'd, which is what <title> gets.
      return (
        <Layout
          sidebar={<ForumSidebar forum={forum} />}
          title={`Showing moderation log for /f/${forum.name}`}
        >
          <h1 className="page-heading">
            Showing moderation log for{' '}
            <SLink to={`/f/${forum.name}`}>/f/{forum.name}</SLink>
          </h1>

          <nav>
            <p>
              <SLink to="/moderation_log" className="button button--small button--secondary">
                Global moderation log
              </SLink>
            </p>
          </nav>

          <NoEntries className="no-entries" />
        </Layout>
      )
    }

    // forum/bans.html.twig
    return (
      <Layout sidebar={<ForumSidebar forum={forum} />} title={`Bans in /f/${forum.name}`}>
        <h1 className="page-heading">Bans in /f/{forum.name}</h1>
        <NoEntries />
      </Layout>
    )
  }

  /* ---- user sub-pages: user/base.html.twig sidebar ---- */
  const username = params.username
  const user = username && username.toLowerCase() === state.currentUser.username.toLowerCase()
    ? state.currentUser
    : (state.users || []).find(u => u.username.toLowerCase() === String(username).toLowerCase())
  if (!user) return <NotFound />

  if (kind === 'block_list') {
    // user/block_list.html.twig embeds _layouts/table.html.twig with
    // `items: blocks`: Username | Blocked | Comment | (Unblock). The seed has
    // zero blocks, so a fresh session still renders the source's empty state —
    // but `/user/{name}/block_user` (ROUTES #70) writes real rows now, and the
    // block controller redirects here, so the table has to be live or the
    // redirect would land on a page that contradicts the flash.
    const blocks = normalizeBlocks(state.blockedUsers)
    return (
      <Layout sidebar={<UserSidebar user={user} />} title="Block list">
        <h1 className="page-heading">Block list</h1>
        <InfoAlert>
          <p>
            Blocking a user hides their posts, prevents them from sending you private
            messages, and you won't receive notifications when they reply to you.
            Blocked users can still view your public posts.
          </p>
        </InfoAlert>
        {blocks.length === 0 ? <NoEntries /> : (
          <table className="table">
            <thead>
              <tr>
                <th className="table__shrink">Username</th>
                <th className="table__shrink">Blocked</th>
                <th>Comment</th>
                <th className="table__shrink" />
              </tr>
            </thead>
            <tbody>
              {blocks.map(b => (
                <tr key={b.username}>
                  <td className="table__shrink">
                    <SLink to={`/user/${b.username}`}>{b.username}</SLink>
                  </td>
                  <td className="table__shrink">
                    {b.timestamp ? <Time iso={b.timestamp} /> : null}
                  </td>
                  <td>{b.comment}</td>
                  <td className="table__shrink">
                    <form
                      action={`/user/${b.username}/unblock_user`}
                      method="post"
                      onSubmit={e => {
                        e.preventDefault()
                        unblockUser(b.username)
                        addFlash('The user was unblocked.')
                      }}
                    >
                      <button className="button button--small inline" type="submit">Unblock</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Layout>
    )
  }

  if (kind === 'hidden_forums') {
    // user/hidden_forums.html.twig embeds _layouts/table.html.twig with
    // `items: forums`: Name | Title | (unhide). `state.hiddenForums` holds forum
    // *names* and is written by AppContext.hideForum / unhideForum off the
    // "Hide this forum" <details> in every forum sidebar, so this table has to be
    // derived or the page contradicts the state (AUDIT-R01). A fresh seed hides
    // nothing, so the source's empty state is still what renders first.
    //
    // The unhide button's label is `action.delete` in the Twig, i.e. literally
    // "Delete" — not "Unhide". Verified in the container's
    // translations/messages.en.yml (action.delete: Delete). UserController::hideForum
    // adds NO flash and redirects back to the referer, so there is no flash here.
    const hiddenForums = (state.hiddenForums || [])
      .map(n => getForum(n) || { name: n, title: n, featured: false })
    return (
      <Layout sidebar={<UserSidebar user={user} activeTool="hidden_forums" />} title="Hidden forums">
        <h1 className="page-heading">Hidden forums</h1>
        <InfoAlert>
          <p>
            By marking forums as hidden, you won't see submissions from those forums
            when browsing the "featured" and "all" submission listings. You can still
            subscribe to and moderate forums you choose to hide.
          </p>
          <p>
            Comments posted to hidden forums will still be displayed in the "recent
            comments" listing.
          </p>
        </InfoAlert>
        {hiddenForums.length === 0 ? <NoEntries /> : (
          <table className="table">
            <thead>
              <tr>
                <th className="table__shrink">Name</th>
                <th>Title</th>
                <th className="table__shrink" />
              </tr>
            </thead>
            <tbody>
              {hiddenForums.map(f => (
                <tr key={f.name}>
                  <td className="table__shrink">
                    <SLink to={`/f/${f.name}`}><strong>{f.name}</strong></SLink>
                    {f.featured ? (
                      <>{' '}<span title="This forum is featured.">&#x2b50;</span></>
                    ) : null}
                  </td>
                  <td>{f.title}</td>
                  <td className="table__shrink">
                    <form
                      action={`/user/${user.username}/unhide_forum/${f.name}`}
                      method="post"
                      onSubmit={e => { e.preventDefault(); unhideForum(f.name) }}
                    >
                      <button className="button button--small inline" type="submit">Delete</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Layout>
    )
  }

  // user/trash.html.twig — `nav.trash` = "Trash"
  return (
    <Layout sidebar={<UserSidebar user={user} activeTool="user_trash" />} title={name || 'Trash'}>
      <h1 className="page-heading">Trash</h1>
      <NoEntries />
    </Layout>
  )
}
