import React from 'react'
import SLink from '../SLink.jsx'
import Icon from '../Icon.jsx'
import Time from '../Time.jsx'
import { useApp, normalizeBlocks } from '../../context/AppContext.jsx'
import { renderMarkdown } from '../../utils/markdown.js'

// templates/user/base.html.twig `block sidebar`, verbatim. Shown on every
// /user/<name>* page (profile, tabs, edit_biography, account, preferences,
// compose_message) — confirmed against assets/html/user_MarvelsGrantMan136.html
// and assets/screenshots/reference/{10,16,17,18}-*.png.
//
// ⚠️ `.user-bio__biography` is a WebArena evaluator locator: webarena-399..403
// read its outerText on /user/MarvelsGrantMan136 after editing the biography.
// It must render the *current* `currentUser.biography` and nothing else.
//
// The toolbox item list is Twig-sorted alphabetically and filtered by
// permission. For the seeded (non-admin, self) user exactly two survive:
// "Hidden forums" and "Trash".

export default function UserSidebar({ user, activeTool = null }) {
  const { state, unblockUser, addFlash } = useApp()
  const current = state.currentUser
  const isSelf = user.username === current.username
  // The current user's live biography always wins over the frozen users.json row.
  const biography = isSelf ? current.biography : user.biography

  // `nav.block_user`'s condition in user/base.html.twig is
  //   is_granted('ROLE_USER') and user is not same as(app.user)
  //     and not app.user.isBlocking(user)
  // and the first section carries an Unblock form when you ARE blocking them.
  // Without the isBlocking half the Toolbox would keep offering "Block user"
  // for someone already blocked, whose route is a 403 (verified live).
  const blocking = !isSelf && normalizeBlocks(state.blockedUsers)
    .some(b => b.username.toLowerCase() === user.username.toLowerCase())

  const toolboxItems = []
  if (!isSelf) {
    toolboxItems.push({ label: 'Send message', to: `/user/${user.username}/compose_message`, key: 'compose_message' })
    if (!blocking) {
      toolboxItems.push({ label: 'Block user', to: `/user/${user.username}/block_user`, key: 'block_user' })
    }
  }
  if (isSelf) {
    toolboxItems.push({ label: 'Hidden forums', to: `/user/${user.username}/hidden_forums`, key: 'hidden_forums' })
    toolboxItems.push({ label: 'Trash', to: `/user/${user.username}/trash`, key: 'user_trash' })
  }
  toolboxItems.sort((a, b) => a.label.localeCompare(b.label))

  const moderates = isSelf ? (state.moderatorOf || []) : []

  return (
    <>
      <section className="sidebar__section flow break-text">
        <header>
          <h1 className="sidebar__title">
            <SLink to={`/user/${user.username}`}>{user.username}</SLink>
            {user.admin && (
              <span title="Admin"> <Icon name="wrench" alt="Admin" className="text-sm" /></span>
            )}
          </h1>

          <p>
            <small className="fg-muted text-sm">
              Registered <Time iso={user.created} />
            </small>
            {(isSelf || current.admin) && (
              <>
                <br />
                <small className="fg-muted text-sm">
                  {user.whitelisted ? 'Whitelisted' : 'Not whitelisted'}
                </small>
              </>
            )}
          </p>
        </header>

        {biography && (
          <div
            className="user-bio__biography text-flow"
            dangerouslySetInnerHTML={{ __html: renderMarkdown(biography) }}
          />
        )}

        {isSelf && (
          <p>
            <SLink
              to={`/user/${user.username}/edit_biography`}
              className="button button--flex button--small button--secondary"
            >
              <Icon name="pencil" />
              <span>Edit biography</span>
            </SLink>
          </p>
        )}

        {/* {% if is_granted('ROLE_USER') and app.user.blocking(user) %} */}
        {blocking && (
          <form
            action={`/user/${user.username}/unblock_user`}
            method="POST"
            onSubmit={e => {
              e.preventDefault()
              unblockUser(user.username)
              addFlash('The user was unblocked.')
            }}
          >
            <p>
              <button className="button button--secondary" type="submit">Unblock</button>
            </p>
          </form>
        )}
      </section>

      {toolboxItems.length > 0 && (
        <section className="sidebar__section flow">
          <h1 className="sidebar__title">Toolbox</h1>
          <ul className="unlistify sidebar__no-padding">
            {toolboxItems.map(item => (
              <li key={item.key}>
                <SLink
                  to={item.to}
                  className={`menu-item ${activeTool === item.key ? 'menu-item--active' : ''}`}
                >
                  {item.label}
                </SLink>
              </li>
            ))}
          </ul>
        </section>
      )}

      {moderates.length > 0 && (
        <section className="sidebar__section flow">
          <h1 className="sidebar__title break-text">{user.username} is a moderator on:</h1>
          <ul className="unlistify flex flex--guttered flex--slim-gutters">
            {moderates.map(name => (
              <li key={name}>
                <SLink to={`/f/${name}`} className="button button--secondary button--small">{name}</SLink>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  )
}
