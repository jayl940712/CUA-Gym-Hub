import React, { useState } from 'react'
import SLink from '../SLink.jsx'
import Vote from '../Vote.jsx'
import Time from '../Time.jsx'
import Icon from '../Icon.jsx'
import MarkdownHelp from '../MarkdownHelp.jsx'
import { MarkdownBody, CommentNav } from '../Comment.jsx'
import { useApp } from '../../context/AppContext.jsx'

// A comment rendered *outside* a submission page — i.e. with
// `show_context: true` and `recurse: false`. Used by /user/<name> (overview)
// and /user/<name>/comments.
//
// src/components/Comment.jsx renders the same entity for the submission page,
// but that variant has no `comment__context` slot (the context <div> sits
// INSIDE `.comment__content`, above `.comment__body`, so it cannot be composed
// from outside) and always recurses into replies. This reproduces
// `templates/_layouts/comment.html.twig` for the context-carrying case and
// reuses that file's `MarkdownBody`, plus the shared Vote/Time/Icon.
//
// The ACTION ROW is not forked: `<CommentNav>` (Comment.jsx) is the single
// source of truth for Reply · Permalink · Parent · Delete · Edit and is shared
// with <Comment> and <CommentRow>. Reply and Delete are inline here exactly as
// they are there; Edit navigates to …/comment/{cid}/edit, also as it does there.
//
// Verbatim structure from assets/html/user_MarvelsGrantMan136_comments.html.
// `.comment__body` is a WebArena evaluator locator — keep the class.
//
// Copy keys:
//   comments.info                      '%user% wrote %timestamp%'
//   comments.context.top_level_reply   'Reply to %submission_title% by %submission_author%'
//   comments.context.comment_reply     'Reply to comment by %comment_author% in %submission_title% by %submission_author%'
//   item.op_abbr                       'OP'

export default function UserCommentRow({ comment }) {
  const { getSubmission, getComment, addComment, deleteComment } = useApp()
  const [replying, setReplying] = useState(false)
  const [replyBody, setReplyBody] = useState('')

  const submission = getSubmission(comment.submission)
  const parent = comment.parent !== undefined && comment.parent !== null
    ? getComment(comment.parent)
    : null
  const isOp = submission && comment.author === submission.author

  // The source's context links point at the *slugless* submission path
  // (`/f/television/134942`), which the mock resolves the same way.
  const submissionPath = submission ? `/f/${submission.forum}/${submission.id}` : null

  const classes = [
    'comment',
    'comment--top-level',
    `comment--visibility-${comment.visibility || 'visible'}`,
    'hideable'
  ]

  const onDelete = () => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      deleteComment(comment.id)
    }
  }

  const postReply = (e) => {
    e.preventDefault()
    if (!replyBody.trim()) return
    addComment({ submission: submission.id, parent: comment.id, body: replyBody })
    setReplyBody('')
    setReplying(false)
  }

  const submissionLink = submission && (
    <SLink to={submissionPath} className="fg-inherit"><strong>{submission.title}</strong></SLink>
  )
  const submissionAuthorLink = submission && (
    <SLink to={`/user/${submission.author}`} className="fg-inherit">
      <strong>{submission.author}</strong>
    </SLink>
  )

  return (
    <article className={classes.join(' ')} id={`comment_${comment.id}`} data-level="1">
      <input type="checkbox" className="hideable__checkbox"
             id={`comment_toggle_${comment.id}`} defaultChecked />

      <div className="comment__row">
        <div className="comment__main">
          <header className="comment__header">
            <h1 className="comment__info break-text unheaderize">
              <span className="fg-muted text-sm">
                <SLink to={`/user/${comment.author}`} className="fg-inherit">
                  <strong>{comment.author}</strong>
                </SLink>
                {isOp && (
                  <> <small className="comment__op-text text-sm user-flag"
                            title="Original poster" aria-label="Original poster">OP</small></>
                )}
                {comment.userFlag && comment.userFlag !== 'none' && (
                  <> <small className="fg-grey text-sm user-flag">{comment.userFlag}</small></>
                )}
                {' '}wrote <Time iso={comment.timestamp} />
                {comment.editedAt && (
                  <span className="comment__edited-at fg-muted text-sm">
                    {' '}(edited <Time iso={comment.editedAt} />)
                  </span>
                )}
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
            {submission && (
              <div className="fg-muted flex flex--slim-gutters flex--no-wrap comment__context">
                <Icon name="forward" />
                <p>
                  {parent ? (
                    <>
                      Reply to comment by{' '}
                      <SLink to={`/user/${parent.author}`} className="fg-inherit">
                        <strong>{parent.author}</strong>
                      </SLink>
                      {' '}in {submissionLink} by {submissionAuthorLink}
                    </>
                  ) : (
                    <>Reply to {submissionLink} by {submissionAuthorLink}</>
                  )}
                </p>
              </div>
            )}

            {/* No inline editor: `Edit` in <CommentNav> is a real navigation to
                …/comment/{cid}/edit (EditCommentPage), matching the source. */}
            <MarkdownBody className="comment__body break-text text-flow" source={comment.body} />
          </div>

          {submission && (
            <CommentNav
              comment={comment} submission={submission}
              onReply={() => setReplying(r => !r)}
              onDelete={onDelete}
            />
          )}

          {replying && submission && (
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
