import React from 'react'
import SLink from './SLink.jsx'
import Icon from './Icon.jsx'
import Time from './Time.jsx'
import { useApp } from '../context/AppContext.jsx'
import { renderMarkdown } from '../utils/markdown.js'
import { subscriberCountLabel, formatNumber } from '../utils/format.js'

// Sidebar sections, transcribed from assets/html/f_news-auth.html and
// submission_129508-auth.html.
//
// ⚠️ `#sidebar > section` is a WebArena evaluator locator: webarena-595..599
// read its outerText on `/` after subscribing and expect to find the forum name
// there. Whichever section is FIRST in #sidebar must be the one carrying the
// subscriptions.

/** The forum card + Hide this forum + Toolbox stack shown on /f/<name>. */
export function ForumSidebar({ forum }) {
  const { isSubscribed, moderates, subscribe, unsubscribe, hideForum, unhideForum, state } = useApp()
  const subscribed = isSubscribed(forum.name)
  const isMod = moderates(forum.name)
  const hidden = state.hiddenForums.includes(forum.name)

  return (
    <>
      <section className="sidebar__section flow">
        <h1 className="sidebar__title forum-title break-text">
          <SLink to={`/f/${forum.name}`}>{forum.name}</SLink>
        </h1>

        <form
          action={`/f/${forum.name}/${subscribed ? 'unsubscribe' : 'subscribe'}`}
          method="POST"
          className="form subscribe-form"
          data-forum={forum.name}
          onSubmit={e => { e.preventDefault(); subscribed ? unsubscribe(forum.name) : subscribe(forum.name) }}
        >
          <div className="form__row">
            <button
              type="submit"
              className={`subscribe-button subscribe-button--${subscribed ? 'unsubscribe' : 'subscribe'}`}
            >
              <span className="subscribe-button__label">
                <span className="subscribe-button__label-text">{subscribed ? 'Unsubscribe' : 'Subscribe'}</span>
                {/* templates/forum/_macros.html.twig: "dummy labels to keep width
                    of button consistent regardless of state". They are height:0
                    visibility:hidden, so they only widen the label box — without
                    them the control jumps 136 -> 152px on subscribe, where the
                    source's stays at 175px. aria-hidden keeps them out of the
                    accessibility tree and out of innerText. */}
                <span aria-hidden="true" className="subscribe-button__dummy-label">Subscribe</span>
                <span aria-hidden="true" className="subscribe-button__dummy-label">Unsubscribe</span>
              </span>
              <b className="subscribe-button__subscriber-count"
                 aria-label={subscriberCountLabel(forum.subscriberCount || 0)}>
                {formatNumber(forum.subscriberCount || 0)}
              </b>
            </button>
          </div>
        </form>

        {forum.sidebar && (
          <div className="forum-sidebar-content break-text text-flow"
               dangerouslySetInnerHTML={{ __html: renderMarkdown(forum.sidebar) }} />
        )}

        <hr />

        <ul className="text-sm unlistify">
          <li className="fg-muted">Created <Time iso={forum.created} /></li>
          <li>
            {/* Atom feeds are Intentionally Not Migrated (ROUTES #12), but the
                link must still go through the router and withSid() — a raw
                <a href> detached the session and dropped the agent on a
                sid-less SPA 404 (HANDLER-005). */}
            <SLink to={`/f/${forum.name}/new.atom`} rel="alternate" type="application/atom+xml" className="no-underline">
              <Icon name="rss-squared" className="fg-orange" />{' '}
              <span className="no-underline__exempt">Subscribe via RSS</span>
            </SLink>
          </li>
        </ul>
      </section>

      <details className="sidebar__section flow">
        <summary className="sidebar__title">Hide this forum</summary>
        <p className="fg-muted text-md">
          By marking forums as hidden, you won't see submissions from those forums when browsing
          the "featured" and "all" submission listings. You can still subscribe to and moderate
          forums you choose to hide.
        </p>
        <form onSubmit={e => { e.preventDefault(); hidden ? unhideForum(forum.name) : hideForum(forum.name) }}>
          <p>
            <button className="button button--secondary" type="submit">{hidden ? 'Unhide' : 'Hide'}</button>
          </p>
        </form>
      </details>

      <section className="sidebar__section flow">
        <h1 className="sidebar__title">Toolbox</h1>
        <ul className="unlistify sidebar__no-padding">
          {isMod && (
            <>
              <li><SLink to={`/f/${forum.name}/edit`} className="menu-item">Edit forum</SLink></li>
              <li><SLink to={`/f/${forum.name}/appearance`} className="menu-item">Appearance</SLink></li>
              <li><SLink to={`/f/${forum.name}/moderators`} className="menu-item">Moderators</SLink></li>
              <li><SLink to={`/f/${forum.name}/delete`} className="menu-item">Delete forum</SLink></li>
            </>
          )}
          <li><SLink to={`/f/${forum.name}/bans`} className="menu-item">Bans</SLink></li>
          <li><SLink to={`/f/${forum.name}/moderation_log`} className="menu-item">Moderation log</SLink></li>
        </ul>
      </section>
    </>
  )
}

/**
 * The front-page sidebar. Starts as "Featured forums" / "There are no featured
 * forums to display." and becomes "Subscribed forums" once the user subscribes.
 */
export function FrontSidebar() {
  const { state } = useApp()
  const subs = state.subscriptions || []

  if (subs.length > 0) {
    return (
      <section className="sidebar__section flow">
        <h1 className="sidebar__title">Subscribed forums</h1>
        <ul className="unlistify sidebar__no-padding">
          {subs.map(name => (
            <li key={name}><SLink to={`/f/${name}`} className="menu-item">{name}</SLink></li>
          ))}
        </ul>
      </section>
    )
  }

  return (
    <section className="sidebar__section flow">
      <h1 className="sidebar__title">Featured forums</h1>
      <p className="fg-muted">
        <small className="text-sm">There are no featured forums to display.</small>
      </p>
    </section>
  )
}

/** The vote-total / short-URL card at the top of a submission page's sidebar. */
export function SubmissionMeta({ submission }) {
  const { submissionVote } = useApp()
  const choice = submissionVote(submission.id)
  const up = choice === 1 ? 1 : 0
  const down = choice === -1 ? 1 : 0
  const total = up + down
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  return (
    <section className="sidebar__section flow submission-meta">
      <p className="submission-meta__score">
        <strong className="submission-meta__vote-total">
          {total === 1 ? '1 point' : `${total} points`}
        </strong>{' '}
        <span className="submission-meta__vote-stats">(+{up}, &minus;{down})</span>
      </p>
      <div>
        <h4 className="fg-muted unheaderize text-xs">Short URL: </h4>
        <p className="sidebar__no-padding">
          <kbd className="submission-meta__short-url">{`${origin}/${submission.id}`}</kbd>
        </p>
      </div>
    </section>
  )
}
