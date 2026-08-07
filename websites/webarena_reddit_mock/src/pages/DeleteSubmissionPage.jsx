import React from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import Forbidden from '../components/forms/Forbidden.jsx'
import Submission from '../components/Submission.jsx'
import SLink, { useSidNavigate } from '../components/SLink.jsx'
import { ForumSidebar } from '../components/Sidebars.jsx'
import { ButtonRow } from '../components/forms/FormBits.jsx'
import { useApp } from '../context/AppContext.jsx'

// ROUTES #41 — `/f/{forum}/{id}/{slug}/delete`.
//
// On the source `submission_delete_own` is POST-only and is reached from the
// "Delete" action link via a JS-submitted form. The mock has no server, so the
// GET renders the confirmation page Postmill shows for its other delete flows
// (templates/submission/delete_with_reason.html.twig: heading, the submission
// itself, then the button) and the button performs the mutation.
//
// Copy, verbatim: title.delete_submission / prompt.confirm_submission_delete /
// action.delete / flash.submission_deleted.

export default function DeleteSubmissionPage() {
  const params = useParams()
  const navigate = useSidNavigate()
  const { state, getSubmission, getForum, deleteSubmission, addFlash } = useApp()

  const submission = getSubmission(params.id)
  if (!submission) return <NotFound />
  if (submission.author !== state.currentUser.username) return <Forbidden />

  const forum = getForum(submission.forum)

  function onSubmit(e) {
    e.preventDefault()
    const forumName = submission.forum
    deleteSubmission(submission.id)
    addFlash('The submission was deleted.')
    navigate(`/f/${forumName}`)
  }

  return (
    <Layout sidebar={forum ? <ForumSidebar forum={forum} /> : null} title="Delete submission">
      <h1 className="page-heading">Delete submission</h1>

      <Submission submission={submission} />

      <form name="submission_delete" method="post" className="form flow" onSubmit={onSubmit}>
        <p>Are you sure you want to delete this submission?</p>
        <ButtonRow label="Delete" />
      </form>

      <p>
        <SLink to={`/f/${submission.forum}/${submission.id}/${submission.slug || '-'}`}>
          Cancel
        </SLink>
      </p>
    </Layout>
  )
}
