import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import SLink, { useSidNavigate } from '../components/SLink.jsx'
import CommentRow from '../components/discovery/CommentRow.jsx'
import NotFound from './NotFound.jsx'
import { useApp } from '../context/AppContext.jsx'
import { canonicalPath } from '../components/Submission.jsx'
import '../components/discovery/discovery.css'

// ROUTES #55 / #56 / #57 — the three standalone comment-delete pages:
//
//   mode="own"     /f/{f}/{id}/{slug}/comment/{cid}/delete_own
//   mode="mod"     /f/{f}/{id}/{slug}/comment/{cid}/delete
//   mode="thread"  /f/{f}/{id}/{slug}/comment/{cid}/delete_thread
//
// templates/comment/delete.html.twig:
//   <h1 class="page-heading">{{ recursive ? 'title.delete_comment_thread'
//                                         : 'title.delete_comment' }}</h1>
//   {{ comment(comment) }}
//   {{ form_row(form.reason) }}        -> label.reason `Reason`
//   {{ button_row(recursive ? 'action.delete_thread' : 'action.delete') }}
//
// `delete_own` has no template of its own on the source — the route is
// POST-only and the submission page posts to it behind a
// `prompt.confirm_comment_delete` confirm(). An agent that GETs the URL on the
// source gets a 405. The mock cannot POST, and dead-ending an agent on a URL it
// legitimately constructed is worse than the small divergence, so `delete_own`
// renders the same confirmation page carrying the source's own confirm copy
// ("Are you sure you want to delete this comment?") and no Reason field.
//
// After a moderator delete Postmill redirects to the submission
// (`generateSubmissionUrl`); `delete_own` redirects "after delete", which for a
// comment is the same submission page. Both are reproduced.

/** templates/bundles/TwigBundle/Exception/error.html.twig — the bare 403 shell. */
export function AccessDenied({ statusCode = 403, statusText = 'Forbidden' }) {
  return (
    <div className="error-page" style={{
      background: '#f8f8f8', color: '#444', fontFamily: 'sans-serif',
      margin: '2em', textAlign: 'center'
    }}>
      <header>
        <h1>{statusCode} {statusText}</h1>
      </header>
      <nav>
        <p><SLink to="/" style={{ color: '#d00', textDecoration: 'none' }}>Go to home page</SLink></p>
      </nav>
    </div>
  )
}

export default function DeleteCommentPage({ mode = 'own' }) {
  const params = useParams()
  const navigate = useSidNavigate()
  const { state, getSubmission, getComment, moderates, deleteComment, trashComment, addFlash } = useApp()
  const [reason, setReason] = useState('')

  const submission = getSubmission(params.id)
  const comment = getComment(params.cid)

  if (!submission || !comment) return <NotFound />
  if (String(comment.submission) !== String(submission.id)) return <NotFound />

  const recursive = mode === 'thread'
  const isOwn = comment.author === state.currentUser.username
  const isMod = moderates(submission.forum)

  // Postmill's voters: `delete_own` needs the author, `mod_delete` needs a
  // moderator of the forum. `MarvelsGrantMan136` moderates nothing on the
  // seeded corpus, so the moderator routes 403 there exactly as they do on the
  // source, and only unlock for a forum the task creates via /create_forum.
  if (mode === 'own' && !isOwn) return <AccessDenied />
  if (mode !== 'own' && !isMod) return <AccessDenied />

  const title = recursive ? 'Delete comment thread' : 'Delete comment'

  /** Recursive delete: deepest descendants first, so no orphan is left behind. */
  const collectThread = (rootId) => {
    const out = []
    const walk = (id) => {
      for (const c of state.comments) {
        if (String(c.parent) === String(id)) walk(c.id)
      }
      out.push(id)
    }
    walk(rootId)
    return out
  }

  const onSubmit = (e) => {
    e.preventDefault()
    if (mode === 'own') {
      // CommentController::deleteOwn — soft delete / hard remove, no reason.
      deleteComment(comment.id)
    } else {
      // CommentController::delete / deleteThread — Comment::trash($reason).
      // The Reason field really is read: it lands on the comment as
      // `trashReason` and shows up in /go's current_state, and the comment
      // becomes `visibility: 'trashed'`, which is what fills /trash (ROUTES #8).
      const trimmed = reason.trim()
      if (recursive) collectThread(comment.id).forEach(id => trashComment(id, trimmed))
      else trashComment(comment.id, trimmed)
    }
    addFlash('The comment has been deleted.')
    navigate(canonicalPath(submission))
  }

  return (
    <Layout title={title}>
      <h1 className="page-heading">{title}</h1>

      <CommentRow comment={comment} submission={submission} showContext={false} />

      <form className="form flow" onSubmit={onSubmit}>
        {mode === 'own' ? (
          <p>Are you sure you want to delete this comment?</p>
        ) : (
          <div className="form__row">
            <label htmlFor="delete_reason_reason" className="form-label">Reason</label>
            <input
              type="text" id="delete_reason_reason" name="delete_reason[reason]"
              className="form-control" value={reason}
              onChange={e => setReason(e.target.value)}
            />
          </div>
        )}

        <div className="form__row form__button-row">
          <button className="button" type="submit">{recursive ? 'Delete thread' : 'Delete'}</button>{' '}
          <SLink to={canonicalPath(submission)} className="button button--secondary">Cancel</SLink>
        </div>
      </form>
    </Layout>
  )
}
