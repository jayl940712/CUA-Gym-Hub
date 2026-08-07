import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import SLink, { useSidNavigate } from '../components/SLink.jsx'
import Icon from '../components/Icon.jsx'
import MarkdownHelp from '../components/MarkdownHelp.jsx'
import CommentRow from '../components/discovery/CommentRow.jsx'
import { canonicalPath } from '../components/Submission.jsx'
import NotFound from './NotFound.jsx'
import { AccessDenied } from './DeleteCommentPage.jsx'
import { useApp } from '../context/AppContext.jsx'
import '../components/discovery/discovery.css'

// ROUTES #54 — `/f/{forum}/{id}/{slug}/comment/{cid}/edit`,
// templates/comment/edit.html.twig (which extends submission/base.html.twig,
// hence the "return to forum" nav at the top):
//
//   {{ parent() }}                                  -> forum_return_nav(forum)
//   <h1 class="page-heading">Editing comment</h1>   -> comment_form.edit_title
//   {{ comment(comment) }}                          -> the comment, non-recursive
//   {{ include('comment/_form.html.twig', { editing: true }) }}
//
// The form is the same one the inline editor on the submission page uses; the
// button reads `Save` here (action.save) because `editing` is true, versus
// `Post` (action.post) when creating. On success CommentController::editComment
// redirects to `$this->generateCommentUrl($comment)` — which AbstractController
// builds with `slugger.slugify(submission.title)`, i.e. the REAL slug, the same
// URL comment creation lands on.
//
// The capability itself already worked inline on the submission page; this adds
// the standalone Postmill page at the real URL so an agent that navigates there
// (or is dropped on it cold) gets the form rather than a 404.

export default function EditCommentPage() {
  const params = useParams()
  const navigate = useSidNavigate()
  const { state, getSubmission, getComment, editComment } = useApp()

  const submission = getSubmission(params.id)
  const comment = getComment(params.cid)
  const [body, setBody] = useState(comment ? (comment.body || '') : '')

  if (!submission || !comment) return <NotFound />
  if (String(comment.submission) !== String(submission.id)) return <NotFound />

  // Where saving lands. `CommentController::editComment` REDIRECTS to
  // `$this->generateCommentUrl($comment)` (container CommentController.php:145),
  // and `generateCommentUrl` (AbstractController.php:71-84) builds `slug` from
  // `slugger.slugify(submission.title)` — i.e. the REAL slug, exactly as comment
  // CREATION does. The page's own inline comment links keep using the `-` slug
  // (that is what `path('comment', …)` renders inside a template), but the
  // post-save URL is the canonical one; landing on the `-` form diverged.
  const savedUrl = `${canonicalPath(submission)}/comment/${comment.id}`

  // Postmill's `edit` voter: the author, or a moderator of the forum.
  const isOwn = comment.author === state.currentUser.username
  if (!isOwn) return <AccessDenied />

  const onSubmit = (e) => {
    e.preventDefault()
    if (!body.trim()) return
    editComment(comment.id, body)
    // No flash: `editComment` calls no `addFlash`, and `messages.en.yml` has no
    // `flash.comment_edited` key — the previous string was invented.
    navigate(savedUrl)
  }

  return (
    <Layout title="Editing comment">
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

      <h1 className="page-heading">Editing comment</h1>

      <CommentRow comment={comment} submission={submission} showContext={false} />

      <form className="comment-form form flow" onSubmit={onSubmit}>
        <div className="form__row">
          <textarea
            className="form-control" rows="6" required aria-label="Comment"
            id="comment_comment" name="comment[comment]"
            value={body} onChange={e => setBody(e.target.value)}
          />
        </div>
        <MarkdownHelp />
        {/* `button_row(editing ? 'action.save' : 'action.post')` renders ONE
            button. The authenticated source render of
            /f/television/113998/-/comment/1981109/edit has exactly `['Save']`
            and no Cancel — the previous Cancel link was invented. */}
        <div className="form__row form__button-row">
          <button className="button" type="submit">Save</button>
        </div>
      </form>
    </Layout>
  )
}
