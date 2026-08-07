import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import SLink from '../components/SLink.jsx'
import Icon from '../components/Icon.jsx'
import Submission, { canonicalPath } from '../components/Submission.jsx'
import { useSidNavigate } from '../components/SLink.jsx'
import Comment, { buildTree } from '../components/Comment.jsx'
import { ForumSidebar, SubmissionMeta } from '../components/Sidebars.jsx'
import NotFound from './NotFound.jsx'
import MarkdownHelp from '../components/MarkdownHelp.jsx'
import MarkdownPreview from '../components/MarkdownPreview.jsx'
import { useApp } from '../context/AppContext.jsx'

// ROUTES #33 / #34 / #37 — the submission page, its nested comment tree, the
// linear view and the single-comment permalink.
//
// Routing resolves on the numeric id ALONE. `/f/books/59421/-`,
// `/f/books/59421/anything` and the canonical slug all render submission 59421;
// the slug is only ever used to build canonical links.
//
// Four evaluator locators live on this page: .submission__inner,
// .submission__title, .submission__body and `div.submission__vote form`
// (plus .comment__body in the tree).

export default function SubmissionPage({ view = 'nested' }) {
  const params = useParams()
  const { state, getSubmission, getForum, commentsFor, addComment } = useApp()
  const navigate = useSidNavigate()
  const [body, setBody] = useState('')

  const submission = getSubmission(params.id)
  if (!submission) return <NotFound />

  const forum = getForum(submission.forum)
  const comments = commentsFor(submission.id)
  const canonical = canonicalPath(submission)

  // Path segment /nested | /linear (ROUTES #34). `/…/linear` and `/…/nested`
  // are registered as LITERAL segments in App.jsx (they out-rank the
  // :commentView param route), so the mode arrives as the `view` prop; the
  // param route still catches `/…/<anything-else>`, which Postmill's
  // `commentView` requirement collapses to nested.
  const commentView =
    (params.commentView || view) === 'linear' ? 'linear' : 'nested'
  const targetCommentId = params.cid || null
  const targetComment = targetCommentId
    ? comments.find(c => String(c.id) === String(targetCommentId))
    : null

  if (targetCommentId && !targetComment) return <NotFound />

  const byParent = buildTree(comments)
  const topLevel = byParent.get('root') || []

  const linear = [...comments].sort((a, b) =>
    Date.parse(a.timestamp) - Date.parse(b.timestamp) || a.id - b.id)

  // CommentController::comment() ends with
  //   `return $this->redirect($this->generateCommentUrl($reply));`
  // (container /var/www/html/src/Controller/CommentController.php:107), i.e.
  // posting a comment 302s to /f/{forum}/{id}/{slug}/comment/{new_cid}. The
  // `url: "last"` evaluators of webarena-650/651/652 re-open the page the agent
  // ENDED on and read the FIRST `.comment__body`; on the submission page that
  // is the highest-scored pre-existing comment (comments sort netScore DESC,
  // which is correct and must not change), so staying put fails the exact_match.
  //
  // The id is derived from `state.nextCommentId` BEFORE dispatch: React batches
  // the reducer, so addComment()'s return value is not reliably populated yet —
  // the same pattern SubmitPage uses for `nextSubmissionId`.
  const postTopLevel = (e) => {
    e.preventDefault()
    if (!body.trim()) return
    const newId = state.nextCommentId
    addComment({ submission: submission.id, body })
    setBody('')
    navigate(`${canonical}/comment/${newId}`)
  }

  const sidebar = (
    <>
      <SubmissionMeta submission={submission} />
      {forum && <ForumSidebar forum={forum} />}
    </>
  )

  return (
    <Layout sidebar={sidebar} title={submission.title}>
      <nav>
        <ul className="flex flex--guttered unlistify">
          <li>
            <SLink
              to={`/f/${submission.forum}`}
              className="flex flex--slim-gutters flex--align-center fg-text"
              title={`Return to /f/${submission.forum}`}
            >
              <Icon name="left-small" className="icon--circled text-xl" />
              <span className="text-lg">/f/<strong>{submission.forum}</strong></span>
            </SLink>
          </li>
        </ul>
      </nav>

      {/* submission/submission.html.twig renders the macro with
          `show_content: true` (=> .submission__body, submission--expanded);
          submission/comment.html.twig — the single-comment permalink — calls
          `{{ submission(submission) }}` with NO options, so `show_content`
          falls back to its `?? false` default and the permalink page carries
          NO .submission__body and NO <h2>Comments</h2>. Verified against the
          container: `grep -c submission__body` on
          /f/books/59421/-/comment/1235250 is 0 and the wrapper class is
          `submission--collapsed`. Both permalinks are anchor routes
          (webarena-409 / webarena-410), so the drift mattered. */}
      <Submission submission={submission} expanded={!targetComment} showForum />

      {!targetComment && <h2>Comments</h2>}

      {targetComment && (
        <div className="alert bg-blue single-comment-alert">
          <div className="alert__icon fg-blue" aria-hidden="true"><Icon name="info-circled" /></div>
          <div className="alert__text">
            <p>
              Viewing a single comment thread.{' '}
              <SLink to={canonical}>View all comments</SLink>
            </p>
          </div>
        </div>
      )}

      {!targetComment && (
        <form className="comment-form form flow" onSubmit={postTopLevel}>
          <div className="form__row">
            {/* CommentType::comment is a MarkdownType — the source's comment
                form carries the markdown_widget wrapper and its Stimulus
                controller un-hides the preview 600 ms after the first
                keystroke (measured: `.markdown-preview[hidden]` goes null).
                Empty field => `hidden`, so a cold submission page still has 0
                extra text in #main and 0 <mark> elements. */}
            <div className="flow-slim" data-controller="markdown">
              <textarea
                className="form-control flex__grow" rows="6" required aria-label="Comment"
                data-action="markdown#preview" data-markdown-target="input"
                value={body} onChange={e => setBody(e.target.value)}
              />
              <MarkdownPreview value={body} />
            </div>
          </div>
          <MarkdownHelp />
          <div className="form__row form__button-row">
            <button className="button" type="submit">Post</button>
          </div>
        </form>
      )}

      {/* submission/submission.html.twig gates the Nested/Linear tab strip on
          `{% if comments is not empty %}` and closes the comment loop with
          `{% else %}{{ include('_includes/empty.html.twig') }}{% endfor %}`, so a
          0-comment submission shows the empty state and NO tabs. Measured on the
          container, /f/MachineLearning/1/nvidia-rtx-4090 `#main` innerText tail:
          `…Formatting help \nPost\n(￣□￣;)\nThere's nothing here…`.
          `_includes/empty.html.twig` picks its kaomoji with `random([…8 faces…])`
          on every request, so only the structure is reproducible; this keeps the
          same deterministic face ListingPage:324 already uses. */}
      {!targetComment && comments.length > 0 && (
        <div className="flex flex--slim-gutters">
          <ul className="flex unlistify">
            <li>
              <SLink to={canonical} className={`tab ${commentView === 'nested' ? 'tab--active' : ''}`}>
                Nested
              </SLink>
            </li>
            <li>
              <SLink to={`${canonical}/linear`} className={`tab ${commentView === 'linear' ? 'tab--active' : ''}`}>
                Linear
              </SLink>
            </li>
          </ul>
        </div>
      )}

      {!targetComment && comments.length === 0 ? (
        <div className="empty">
          <div className="empty__emoji" role="img" aria-label="A tense emoji">(ﾟдﾟ)</div>
          <div className="empty__text">There's nothing here…</div>
        </div>
      ) : (
      <div className="comment-listing">
        {targetComment ? (
          <Comment comment={targetComment} submission={submission} byParent={byParent} level={1} />
        ) : commentView === 'linear' ? (
          // SubmissionController: linear => $submission->getComments(), i.e.
          // EVERY visible comment, flat, timestamp ASC, all at level 1. The
          // `post_numbers` flag swaps Permalink/Parent for the `#1,042,264`
          // header label and adds the "Replying to …" pointer.
          linear.map(c => (
            <Comment key={c.id} comment={c} submission={submission} byParent={byParent}
                     level={1} showReplies={false} postNumbers />
          ))
        ) : (
          topLevel.map(c => (
            <Comment key={c.id} comment={c} submission={submission} byParent={byParent} level={1} />
          ))
        )}
      </div>
      )}
    </Layout>
  )
}
