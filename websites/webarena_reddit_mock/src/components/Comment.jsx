import React, { useState } from 'react'
import SLink, { useSidNavigate } from './SLink.jsx'
import Vote from './Vote.jsx'
import Time from './Time.jsx'
import Icon from './Icon.jsx'
import MarkdownHelp from './MarkdownHelp.jsx'
import MarkdownPreview from './MarkdownPreview.jsx'
import { useApp } from '../context/AppContext.jsx'
import { renderMarkdown } from '../utils/markdown.js'

// templates/_layouts/comment.html.twig, verbatim.
//
// Ordering (read out of src/Entity/Submission.php and src/Entity/Comment.php,
// see assets/README.md §4):
//   nested, top level  -> netScore DESC
//   nested, replies    -> netScore DESC   (Criteria::orderBy netScore DESC)
//   linear             -> timestamp ASC
//
// Collapse is pure CSS: a checked .hideable__checkbox plus a <label> whose
// indicator carries data-hide-text / data-unhide-text.
// `.comment__body` is a WebArena evaluator locator (webarena-650/651/652).

export function buildTree(comments) {
  const byParent = new Map()
  for (const c of comments) {
    const key = c.parent === undefined || c.parent === null ? 'root' : String(c.parent)
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key).push(c)
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => (b.netScore || 0) - (a.netScore || 0) || a.id - b.id)
  }
  return byParent
}

export function MarkdownBody({ source, className }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: renderMarkdown(source || '') }} />
}

/** `number.id` — `'#%number%'` with `|format_number` (en-US grouping). */
export function formatCommentId(id) {
  return `#${Number(id).toLocaleString('en-US')}`
}

/** The `-`-slug comment permalink Postmill's `path('comment', …)` builds. */
export function commentPermalink(submission, commentId) {
  return `/f/${submission.forum}/${submission.id}/-/comment/${commentId}`
}

/**
 * THE comment action row — `_layouts/comment.html.twig :: comment_nav`.
 *
 * One entity, one action row. This is rendered identically by <Comment>
 * (submission page), <CommentRow> (/comments, /f/x/comments, /search, /trash)
 * and <UserCommentRow> (/user/*, /notifications); the only per-surface switch
 * in the source is `show_context` / `recurse` / `post_numbers`, none of which
 * touch the nav.
 *
 * Source block order, verbatim:
 *   comment_nav_reply · comment_nav_permalink · comment_nav_parent ·
 *   comment_nav_delete_own · comment_nav_edit
 * — i.e. Delete comes BEFORE Edit, and Permalink/Parent are suppressed when
 * `post_numbers` is on (the linear view, which shows `#1,042,264` in the header
 * instead). Verified live against localhost:9999 on
 * /f/television/134942/- (own comment) and
 * /f/singularity/69404/…/linear (post_numbers).
 *
 * Reply and Delete are inline; **Edit NAVIGATES**. On the source,
 * `assets/js/commenting.js` hooks only `.comment__reply-link` — the edit link
 * (`comment.html.twig:280`) is a bare `<a>` that performs a full page
 * transition to `/f/{forum}/{id}/-/comment/{cid}/edit` (which the mock already
 * serves correctly cold, 200 for an owned comment and 403 otherwise). Swallowing
 * that click into an in-place editor meant the address bar never became `…/edit`,
 * so a `url_match` on the edit page was unreachable by clicking (TEST BUG-B03).
 * `?sid=` is appended because, unlike the source, we must carry the session.
 *
 * This nav is THE action row for <Comment>, <CommentRow> and <UserCommentRow>,
 * so the change lands on all three renderers at once. There is no `onEdit` /
 * `editing` pair any more: no renderer has an inline editor to toggle, so
 * carrying them here only invited a caller to wire up an editor that would
 * never open.
 */
export function CommentNav({
  comment, submission, postNumbers = false, onReply, onDelete
}) {
  const { state } = useApp()
  const isOwn = comment.author === state.currentUser.username
  const permalink = commentPermalink(submission, comment.id)
  const hasParent = comment.parent !== undefined && comment.parent !== null

  return (
    <nav className="comment__nav hideable__hide">
      <ul className="fg-muted flex flex--guttered unlistify">
        <li>
          <a
            href={permalink}
            className="comment__reply-link text-sm"
            onClick={e => { e.preventDefault(); if (onReply) onReply() }}
          >
            <strong>Reply</strong>
          </a>
        </li>

        {!postNumbers && (
          <li>
            <SLink to={permalink} className="comment__permalink fg-inherit text-sm">
              Permalink
            </SLink>
          </li>
        )}

        {!postNumbers && hasParent && (
          <li>
            <SLink to={commentPermalink(submission, comment.parent)}
                   className="comment__parent-link fg-inherit text-sm">
              Parent
            </SLink>
          </li>
        )}

        {isOwn && (
          <>
            <li>
              <a href={`${permalink}/delete_own`} className="fg-inherit text-sm"
                 onClick={e => { e.preventDefault(); if (onDelete) onDelete() }}>Delete</a>
            </li>
            <li>
              <SLink to={`${permalink}/edit`} className="comment__edit-link fg-inherit text-sm">
                Edit
              </SLink>
            </li>
          </>
        )}
      </ul>
    </nav>
  )
}

/**
 * `_layouts/comment.html.twig :: comment_replying_to` — the linear view's
 * substitute for nesting. Rendered inside `.comment__content`, above
 * `.comment__body`, only when `post_numbers` is on and the comment has a
 * parent. Copy: comments.replying_to_comment `Replying to %user% (%id%)`.
 */
export function CommentReplyingTo({ comment, submission, parent }) {
  if (!parent) return null
  const linearPath =
    `/f/${submission.forum}/${submission.id}/${submission.slug || '-'}/linear`
  return (
    <div className="fg-muted flex flex--slim-gutters flex--no-wrap comment__replying-to">
      <Icon name="forward" />
      <p>
        <SLink to={`${linearPath}#comment_${parent.id}`} className="fg-grey no-underline">
          Replying to <span className="fg-muted">{parent.author}</span>{' '}
          (<span className="fg-link no-underline__exempt">{formatCommentId(parent.id)}</span>)
        </SLink>
      </p>
    </div>
  )
}

export default function Comment({
  comment, submission, byParent, level = 1, nested = false, showReplies = true,
  postNumbers = false
}) {
  const { state, addComment, deleteComment, getComment } = useApp()
  const navigate = useSidNavigate()
  const [replying, setReplying] = useState(false)
  const [replyBody, setReplyBody] = useState('')

  const base = `/f/${submission.forum}/${submission.id}/-`
  const children = showReplies ? (byParent.get(String(comment.id)) || []) : []
  const hasParent = comment.parent !== undefined && comment.parent !== null
  const parent = postNumbers && hasParent ? getComment(comment.parent) : null

  const classes = [
    'comment',
    nested ? 'comment--nested' : 'comment--top-level',
    `comment--visibility-${comment.visibility || 'visible'}`,
    'hideable'
  ]

  // Same redirect as a top-level comment — CommentController::comment() is one
  // action for both cases and always ends on `generateCommentUrl($reply)`, i.e.
  // /f/{forum}/{id}/{slug}/comment/{new_cid}. `nextCommentId` is read BEFORE the
  // dispatch because React batches the reducer (see SubmissionPage).
  const postReply = (e) => {
    e.preventDefault()
    if (!replyBody.trim()) return
    const newId = state.nextCommentId
    addComment({ submission: submission.id, parent: comment.id, body: replyBody })
    setReplyBody('')
    setReplying(false)
    navigate(`/f/${submission.forum}/${submission.id}/${submission.slug || '-'}/comment/${newId}`)
  }

  const onDelete = () => {
    if (window.confirm('Are you sure you want to delete this comment?')) {
      deleteComment(comment.id)
    }
  }

  return (
    <article className={classes.join(' ')} id={`comment_${comment.id}`} data-level={level}>
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
              {postNumbers && (
                <li>
                  <SLink to={`${base}/comment/${comment.id}`}
                         className="comment__info-link fg-grey">
                    <span className="text-sm">{formatCommentId(comment.id)}</span>
                  </SLink>
                </li>
              )}
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
            {postNumbers && parent && (
              <CommentReplyingTo comment={comment} submission={submission} parent={parent} />
            )}
            {/* No inline editor: `Edit` is a real navigation to
                …/comment/{cid}/edit (EditCommentPage), matching the source. */}
            <MarkdownBody className="comment__body break-text text-flow" source={comment.body} />
          </div>

          <CommentNav
            comment={comment} submission={submission}
            postNumbers={postNumbers}
            onReply={() => setReplying(r => !r)}
            onDelete={onDelete}
          />

          {replying && (
            <form className="comment-form form flow-slim" onSubmit={postReply}>
              <p className="fg-muted text-sm">Replying to {comment.author} ({comment.id})</p>
              {/* Same MarkdownType widget as the top-level comment form; the
                  reply form only exists after the user opens it and its field
                  starts empty, so the preview pane stays `hidden` until typed
                  into. See components/MarkdownPreview.jsx. */}
              <div className="flow-slim" data-controller="markdown">
                <textarea
                  className="form-control flex__grow" rows="6" required aria-label="Comment"
                  data-action="markdown#preview" data-markdown-target="input"
                  value={replyBody} onChange={e => setReplyBody(e.target.value)}
                />
                <MarkdownPreview value={replyBody} />
              </div>
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

      {children.length > 0 && (
        <div className="comment__replies hideable__hide flow">
          {children.map(child => (
            <Comment
              key={child.id}
              comment={child}
              submission={submission}
              byParent={byParent}
              level={level + 1}
              nested
              postNumbers={postNumbers}
            />
          ))}
        </div>
      )}
    </article>
  )
}
