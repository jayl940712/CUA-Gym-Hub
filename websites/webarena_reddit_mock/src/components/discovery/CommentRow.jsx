import React, { useState } from 'react'
import SLink from '../SLink.jsx'
import Icon from '../Icon.jsx'
import Vote from '../Vote.jsx'
import Time from '../Time.jsx'
import MarkdownHelp from '../MarkdownHelp.jsx'
import { MarkdownBody, CommentNav } from '../Comment.jsx'
import { useApp } from '../../context/AppContext.jsx'

// A single detached comment, i.e. `_layouts/comment.html.twig` rendered with
// `show_context: true` and `recurse: false`. That is what `/comments`,
// `/f/{name}/comments` and the comment half of `/search` all render.
//
// Why this is not <Comment>: the source puts the context block INSIDE
// `.comment__content`, directly above `.comment__body`, and <Comment> (which
// owns the recursive submission-page tree) has no slot for it. The body itself
// still goes through the exact same `MarkdownBody` helper that <Comment> uses,
// so `.comment__body` — a WebArena evaluator locator — is character-identical
// on both, and the action row goes through the exact same `<CommentNav>`.
// Everything else here is transcribed from assets/html/comments.html
// and f_books_comments.html.
//
// Context copy, from assets/source/messages.en.yml:
//   comments.context.top_level_reply:
//     'Reply to %submission_title% by %submission_author%'
//   comments.context.comment_reply:
//     'Reply to comment by %comment_author% in %submission_title% by %submission_author%'

/** The `/f/{forum}/{id}` form the context link uses — no slug, as the source. */
function contextHref(submission) {
  return `/f/${submission.forum}/${submission.id}`
}

function CommentContext({ comment, submission, parent }) {
  return (
    <div className="fg-muted flex flex--slim-gutters flex--no-wrap comment__context">
      <Icon name="forward" />
      <p>
        {parent ? (
          <>
            Reply to comment by{' '}
            <SLink to={`/user/${parent.author}`} className="fg-inherit"><strong>{parent.author}</strong></SLink>
            {' '}in{' '}
            <SLink to={contextHref(submission)} className="fg-inherit"><strong>{submission.title}</strong></SLink>
            {' '}by{' '}
            <SLink to={`/user/${submission.author}`} className="fg-inherit"><strong>{submission.author}</strong></SLink>
          </>
        ) : (
          <>
            Reply to{' '}
            <SLink to={contextHref(submission)} className="fg-inherit"><strong>{submission.title}</strong></SLink>
            {' '}by{' '}
            <SLink to={`/user/${submission.author}`} className="fg-inherit"><strong>{submission.author}</strong></SLink>
          </>
        )}
      </p>
    </div>
  )
}

/**
 * `rawBody` mirrors the comment macro's `raw_body` option — /search passes the
 * `<mark>`-annotated ts_headline excerpt, every other caller leaves it null and
 * gets the markdown-rendered body.
 */
export default function CommentRow({ comment, submission, parent = null, showContext = true, rawBody = null }) {
  const { addComment, deleteComment } = useApp()
  const [replying, setReplying] = useState(false)
  const [replyBody, setReplyBody] = useState('')

  if (!submission) return null

  const postReply = (e) => {
    e.preventDefault()
    if (!replyBody.trim()) return
    addComment({ submission: submission.id, parent: comment.id, body: replyBody })
    setReplyBody('')
    setReplying(false)
  }

  const onDelete = () => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      deleteComment(comment.id)
    }
  }

  const classes = [
    'comment',
    'comment--top-level',
    `comment--visibility-${comment.visibility || 'visible'}`,
    'hideable'
  ]

  return (
    <article className={classes.join(' ')} id={`comment_${comment.id}`} data-level={1}>
      <input type="checkbox" className="hideable__checkbox" id={`comment_toggle_${comment.id}`} defaultChecked />

      <div className="comment__row">
        <div className="comment__main">
          <header className="comment__header">
            <h1 className="comment__info break-text unheaderize">
              <span className="fg-muted text-sm">
                <SLink to={`/user/${comment.author}`} className="fg-inherit">
                  <strong>{comment.author}</strong>
                </SLink>
                {comment.userFlag && comment.userFlag !== 'none' && (
                  <> <small className="fg-grey text-sm user-flag">{comment.userFlag}</small></>
                )}
                {' '}wrote <Time iso={comment.timestamp} />
                {comment.editedAt && <> (edited <Time iso={comment.editedAt} />)</>}
              </span>
            </h1>

            <ul className="flex unlistify">
              <li>
                <label
                  className="comment__info-link comment__hide-toggle hideable__toggle fg-grey no-wrap"
                  htmlFor={`comment_toggle_${comment.id}`}
                >
                  <span className="hideable__indicator text-sm" role="presentation"
                        data-hide-text="Hide" data-unhide-text="Unhide"></span>
                </label>
              </li>
            </ul>
          </header>

          <div className="comment__content flow-slim hideable__hide">
            {showContext && (
              <CommentContext comment={comment} submission={submission} parent={parent} />
            )}
            {/* No inline editor: `Edit` in <CommentNav> is a real navigation to
                …/comment/{cid}/edit (EditCommentPage), matching the source. */}
            {rawBody != null ? (
              <div className="comment__body break-text text-flow"
                   dangerouslySetInnerHTML={{ __html: rawBody }} />
            ) : (
              <MarkdownBody className="comment__body break-text text-flow" source={comment.body} />
            )}
          </div>

          <CommentNav
            comment={comment} submission={submission}
            onReply={() => setReplying(r => !r)}
            onDelete={onDelete}
          />

          {replying && (
            <form className="comment-form form flow-slim" onSubmit={postReply}>
              <p className="fg-muted text-sm">Replying to {comment.author} ({comment.id})</p>
              <textarea
                className="form-control" rows="6" required aria-label="Comment"
                value={replyBody} onChange={e => setReplyBody(e.target.value)}
              />
              <MarkdownHelp />
              <div className="form__button-row">
                <button className="button" type="submit">Post</button>{' '}
                <button className="button button--secondary" type="button" onClick={() => setReplying(false)}>
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <div className="comment__vote hideable__hide">
          <Vote kind="comment" id={comment.id} netScore={comment.netScore} />
        </div>
      </div>
    </article>
  )
}
