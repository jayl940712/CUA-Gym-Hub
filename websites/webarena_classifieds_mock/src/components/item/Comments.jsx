import React, { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { indexUrl } from '../../utils/urls.js'

/**
 * ROUTES #14 (render) + #31 (post) + #32 (delete) — the `#comments` block.
 *
 * The DOM here is load-bearing: 31 `program_html` evaluators query
 * `.comments_list` / `.comments_list h3`, and `h3` must read
 * `{title} by {author}:` exactly. Markup copied from the sigma theme's
 * `item.php` (lines 150-330) and cross-checked against
 * `assets/html/item-10727-comment.html`.
 *
 * Deployment preferences read out of `oc_t_preference`:
 *   comments_per_page = 10     enable_comment_rating       = 1
 *   moderate_comments = -1     enable_comment_reply        = 1
 *   comment_rating_limit = 10  enable_comment_reply_rating = 1
 *   reg_user_post_comments = 0
 *
 * `moderate_comments = -1` means a posted comment is ACTIVE immediately — there
 * is no approval step to model.
 */

export const COMMENTS_PER_PAGE = 10
const COMMENT_RATING_LIMIT = 10
/** `osc_highlight($text, 60)` truncates the reply blurb at 60 chars. */
const REPLY_TEXT_LEN = 60

/** `<span>(3 of 5)</span>` + N filled stars. Omitted entirely when rating <= 0. */
function Rating({ rating }) {
  if (!rating || rating <= 0) return null
  return (
    <p className="comment-rating">
      {[1, 2, 3, 4, 5].map(n => (
        <i key={n} className={n <= rating ? 'fa fa-star fill' : 'fa fa-star'}></i>
      ))}
      <span>({rating} of 5)</span>
    </p>
  )
}

/** `osc_highlight(implode(' - ', array_filter(array_map('trim', [title, body]))), 60)` */
function replyBlurb(comment) {
  const parts = [comment.title, comment.body]
    .map(s => (s === null || s === undefined ? '' : String(s).trim()))
    .filter(Boolean)
  let txt = parts.join(' - ').replace(/[\n\r\t]/g, ' ').trim().replace(/\s+/g, ' ')
  if (txt.length > REPLY_TEXT_LEN) txt = txt.slice(0, REPLY_TEXT_LEN) + '...'
  return `You are replying to: ${txt}`
}

/** `<p>` with `nl2br()` applied, matching `osc_comment_body()`'s output. */
function Body({ text }) {
  const lines = String(text === null || text === undefined ? '' : text).split(/\r\n|\r|\n/)
  return (
    <p>
      {lines.map((line, i) => (
        <React.Fragment key={i}>{i > 0 ? <br /> : null}{line}</React.Fragment>
      ))}
    </p>
  )
}

function CommentBlock({ comment, itemId, sid, isReply, onReply, canDelete }) {
  return (
    <div className={isReply ? 'comment reply has-user-img' : 'comment has-user-img'}>
      <p className="user-img">
        <img src="/img/default-user-image.png" alt={comment.authorName} />
      </p>

      <h3><strong>{comment.title}</strong> <em>by {comment.authorName}:</em></h3>

      <Rating rating={comment.rating} />

      <Body text={comment.body} />

      {canDelete ? (
        <p className={isReply ? undefined : 'comment-delete-row'}>
          <Link
            rel="nofollow"
            to={indexUrl({ page: 'item', action: 'delete_comment', id: itemId, comment: comment.id }, sid)}
            title="Delete your comment"
          >Delete</Link>
        </p>
      ) : null}

      {!isReply ? (
        <p className="comment-reply-row">
          <a
            href="#"
            className="comment-reply"
            data-id={comment.id}
            data-text={replyBlurb(comment)}
            data-rating="1"
            onClick={e => { e.preventDefault(); onReply(comment) }}
          >Reply</a>
        </p>
      ) : null}
    </div>
  )
}

/**
 * `osc_comments_pagination()`. Same classes as the search paginator, but the
 * page param is `comments-page` (1-based; `all` shows every comment).
 * The source emits an empty `.paginate` when there is only one page.
 */
function CommentsPagination({ page, lastPage, itemId, sid }) {
  if (lastPage <= 1) return null
  const href = (p) => indexUrl({ page: 'item', id: itemId, 'comments-page': p }, sid)
  const from = Math.max(1, page - 2)
  const to = Math.min(lastPage, page + 2)
  const nums = []
  for (let p = from; p <= to; p++) nums.push(p)
  return (
    <ul>
      {page > 1 && <li><Link className="searchPaginationPrev list-first" to={href(page - 1)}>&lt;</Link></li>}
      {nums.map(p => (
        <li key={p}>
          {p === page
            ? <span className="searchPaginationSelected">{p}</span>
            : <Link className="searchPaginationNonSelected" to={href(p)}>{p}</Link>}
        </li>
      ))}
      {page < lastPage && <li><Link className="searchPaginationNext" to={href(page + 1)}>&gt;</Link></li>}
      {page < lastPage && <li><Link className="searchPaginationLast list-last" to={href(lastPage)}>&raquo;</Link></li>}
    </ul>
  )
}

function nowStamp() {
  const d = new Date()
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ` +
    `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

export default function Comments({ item, commentsPage }) {
  const { state, setState, sid } = useApp()
  const navigate = useNavigate()
  const itemId = Number(item.id)
  const user = state.user || {}

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [rating, setRating] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [errors, setErrors] = useState([])

  const all = useMemo(
    () => (state.comments || [])
      .filter(c => Number(c.itemId) === itemId)
      // No ORDER BY in ItemComment::findByItemID -> MySQL returns primary-key
      // order, i.e. oldest first.
      .sort((a, b) => Number(a.id) - Number(b.id)),
    [state.comments, itemId]
  )

  const roots = all.filter(c => !c.replyId)
  const repliesOf = (id) => all.filter(c => Number(c.replyId) === Number(id))

  // `comments-page` is 1-based on the wire; `all` disables paging.
  const showAll = String(commentsPage) === 'all'
  const lastPage = Math.max(1, Math.ceil(roots.length / COMMENTS_PER_PAGE))
  const rawPage = parseInt(commentsPage, 10)
  const page = showAll ? 1 : Math.min(Math.max(Number.isFinite(rawPage) ? rawPage : 1, 1), lastPage)
  const visible = showAll ? roots : roots.slice((page - 1) * COMMENTS_PER_PAGE, page * COMMENTS_PER_PAGE)

  // comment_rating_limit = 10 ratings per user per listing.
  const ownRatings = all.filter(
    c => Number(c.userId) === Number(user.id) && c.rating > 0
  ).length
  const canRate = ownRatings < COMMENT_RATING_LIMIT

  function onReply(comment) {
    setReplyTo(comment)
    const form = document.getElementById('comment_form')
    if (form && form.scrollIntoView) form.scrollIntoView({ block: 'center' })
  }

  function clearReply(e) {
    e.preventDefault()
    setReplyTo(null)
  }

  function onSubmit(e) {
    e.preventDefault()
    // The source's client-side jQuery-validate rules: body required (minlength 1),
    // authorEmail required + valid. authorEmail is a hidden field carrying the
    // logged-in user's address, so only the body can fail here.
    const trimmed = body.trim()
    if (!trimmed) {
      setErrors(['Comment: this field is required.'])
      return
    }
    setErrors([])

    const n = parseInt(rating, 10)
    const clean = canRate && Number.isFinite(n) && n > 0 ? Math.min(n, 5) : null

    const comment = {
      id: state.nextCommentId,
      itemId,
      pubDate: nowStamp(),
      title: title.trim(),
      authorName: user.name || '',
      authorEmail: user.email || '',
      body: trimmed,
      rating: clean,
      userId: user.id,
      replyId: replyTo ? replyTo.id : null
    }

    setState(prev => ({
      ...prev,
      comments: [...(prev.comments || []), comment],
      nextCommentId: (prev.nextCommentId || 1) + 1
    }))

    setTitle('')
    setBody('')
    setRating('')
    setReplyTo(null)

    // The source redirects to `osc_item_url()` (dropping `comments-page`) and
    // flashes status 2, "Your comment has been approved" — moderate_comments = -1.
    navigate(indexUrl({ page: 'item', id: itemId }, sid), {
      state: { flash: { type: 'ok', msg: 'Your comment has been approved' } }
    })
  }

  return (
    <div id="comments">
      <h2>Comments</h2>
      {/* jquery.validate is configured with `wrapper: "li"` and
          `errorLabelContainer: "#comment_error_list"`
          (assets/html/item-10727-comment.html:245-255), so each message lands as
          `<li><label class="error">…</label></li>`. The container itself must be
          left with ZERO child nodes when there is nothing to report — the
          `:not(:empty)` reveal in mock.css stands in for the plugin's
          `.show()` / `.hide()` (TEST BUG-A). */}
      <ul id="comment_error_list">
        {errors.map((msg, i) => <li key={i}><label className="error">{msg}</label></li>)}
      </ul>

      {roots.length > 0 && (
        <div className="comments_list">
          {visible.map(c => {
            const replies = repliesOf(c.id)
            return (
              <React.Fragment key={c.id}>
                <CommentBlock
                  comment={c}
                  itemId={itemId}
                  sid={sid}
                  isReply={false}
                  onReply={onReply}
                  canDelete={Number(c.userId) === Number(user.id)}
                />
                {replies.length > 0 && (
                  <div id="comment-replies">
                    {replies.map(r => (
                      <CommentBlock
                        key={r.id}
                        comment={r}
                        itemId={itemId}
                        sid={sid}
                        isReply={true}
                        onReply={onReply}
                        canDelete={Number(r.userId) === Number(user.id)}
                      />
                    ))}
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      )}

      {/* `item.php:154-247` puts BOTH `.comments_list` and `.paginate` inside
          `if(osc_count_item_comments() > 0)`. Verified live: item 10727 (1
          comment, 1 page) emits `<div class="paginate"></div>`; item 4799 (no
          comments) emits no `.paginate` at all (TEST DIFF-006). */}
      {roots.length > 0 && (
        <div className="paginate">
          <CommentsPagination page={page} lastPage={lastPage} itemId={itemId} sid={sid} />
        </div>
      )}

      <div className="form-container form-horizontal new-comment">
        <div className="header">
          <h3>Leave your comment (spam and offensive messages will be removed)</h3>
        </div>
        <div className="resp-wrapper">
          <form action="/index.php" method="post" name="comment_form" id="comment_form" onSubmit={onSubmit}>
            <fieldset>
              <input type="hidden" name="action" value="add_comment" />
              <input type="hidden" name="page" value="item" />
              <input type="hidden" name="id" value={itemId} readOnly />
              <input type="hidden" name="replyId" value={replyTo ? replyTo.id : ''} readOnly />
              <input type="hidden" name="authorName" value={user.name || ''} readOnly />
              <input type="hidden" name="authorEmail" value={user.email || ''} readOnly />

              <div className="control-group rating">
                <label className="control-label" htmlFor="title">Rating</label>
                <div className="controls">
                  {canRate ? (
                    <>
                      <input type="hidden" name="rating" value={rating} readOnly />
                      <div className="comment-leave-rating">
                        {[1, 2, 3, 4, 5].map(n => (
                          <i
                            key={n}
                            className={
                              'fa fa-star is-rating-item' +
                              (Number(rating) >= n ? ' fill' : '')
                            }
                            data-value={n}
                            role="button"
                            aria-label={`${n} of 5`}
                            onClick={e => { e.preventDefault(); setRating(String(n)) }}
                          ></i>
                        ))}
                      </div>
                      <span className="comment-rating-selected">{rating ? `(${rating} of 5)` : ''}</span>
                    </>
                  ) : (
                    <div className="red">
                      Not available, you have already rated this item {COMMENT_RATING_LIMIT} time(s)
                    </div>
                  )}
                </div>
              </div>

              <div className="control-group">
                <label className="control-label" htmlFor="title">Title</label>
                <div className="controls">
                  <input id="title" type="text" name="title" value={title}
                    onChange={e => setTitle(e.target.value)} />
                </div>
              </div>

              <div
                className="control-group reply-text"
                title="Click to post as standard comment and not reply"
                onClick={clearReply}
              >{replyTo ? replyBlurb(replyTo) : null}</div>

              <div className="control-group">
                <label className="control-label" htmlFor="body">Comment</label>
                <div className="controls textarea">
                  <textarea id="body" name="body" rows="10" value={body}
                    onChange={e => setBody(e.target.value)}></textarea>
                </div>
              </div>

              <div className="actions">
                <button type="submit" className="btn btn-primary">Send</button>
              </div>
            </fieldset>
          </form>
        </div>
      </div>
    </div>
  )
}
