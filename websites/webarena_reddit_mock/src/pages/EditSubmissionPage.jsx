import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import Forbidden from '../components/forms/Forbidden.jsx'
import MarkdownHelp from '../components/MarkdownHelp.jsx'
import { ForumSidebar } from '../components/Sidebars.jsx'
import { FormRow, FormErrors, ButtonRow, SelectWidget, useNativeValidation } from '../components/forms/FormBits.jsx'
import { useSidNavigate } from '../components/SLink.jsx'
import { useApp } from '../context/AppContext.jsx'
import { slugify } from '../utils/slug.js'

// ROUTES #40 — `/f/{forum}/{id}/{slug}/edit`, templates/submission/edit.html.twig.
//
// Editing reuses submission/_form.html.twig with `editing: true`, which drops
// the forum picker, the media-type tabs and the image field (SubmissionType.php
// only adds those when `$data->getId() === null`). The URL field survives only
// for a URL-media submission.
//
// Author-only: @IsGranted("edit", subject="submission", statusCode=403).
//
// webarena-731 appends `EDIT: This news aged well` to submission 1's body at
// /f/MachineLearning/1/nvidia-rtx-4090 (seed body: `Crazy device for ML!`), so
// the anchored page must still resolve after saving — the slug only moves if
// the title itself changes, which Postmill recomputes on redirect.

const MAX_TITLE_LENGTH = 300
const MAX_URL_LENGTH = 2000
const MAX_BODY_LENGTH = 25000

const ERR_BLANK = 'This value should not be blank.'
const ERR_BAD_URL = 'This value is not a valid URL.'
const tooManyChars = (max, count) =>
  `You entered too many characters (max ${max}, ${count} entered)`

export default function EditSubmissionPage() {
  const params = useParams()
  const navigate = useSidNavigate()
  const { state, getSubmission, getForum, editSubmission, addFlash } = useApp()

  const submission = getSubmission(params.id)
  const [title, setTitle] = useState(() => submission?.title ?? '')
  const [url, setUrl] = useState(() => submission?.url ?? '')
  const [body, setBody] = useState(() => submission?.body ?? '')
  const [userFlag, setUserFlag] = useState(() => submission?.userFlag ?? 'none')
  const [errors, setErrors] = useState({})
  // Source parity: submission/_form.html.twig emits no `novalidate`.
  const formRef = useNativeValidation(setErrors)

  if (!submission) return <NotFound />
  if (submission.author !== state.currentUser.username) return <Forbidden />

  const forum = getForum(submission.forum)
  // Only a URL-media submission keeps its url field (SubmissionType.php).
  const hasUrlField = !submission.image

  function onSubmit(e) {
    e.preventDefault()
    const next = {}
    const trimmedTitle = title.trim()
    if (!trimmedTitle) next.title = [ERR_BLANK]
    else if (title.length > MAX_TITLE_LENGTH) next.title = [tooManyChars(MAX_TITLE_LENGTH, title.length)]
    if (body.length > MAX_BODY_LENGTH) next.body = [tooManyChars(MAX_BODY_LENGTH, body.length)]

    const trimmedUrl = hasUrlField ? url.trim() : (submission.url || '')
    if (hasUrlField && trimmedUrl) {
      if (trimmedUrl.length > MAX_URL_LENGTH) next.url = [tooManyChars(MAX_URL_LENGTH, trimmedUrl.length)]
      else if (!/^https?:\/\/[^\s]+$/i.test(trimmedUrl)) next.url = [ERR_BAD_URL]
    }

    if (Object.keys(next).length > 0) { setErrors(next); return }
    setErrors({})

    const updates = { title: trimmedTitle, body: body || undefined }
    // Postmill derives the slug from the title on every redirect, so a title
    // edit moves the canonical URL. Keep the stored slug in step.
    if (trimmedTitle !== submission.title) updates.slug = slugify(trimmedTitle) || '-'
    if (hasUrlField) updates.url = trimmedUrl || undefined
    updates.userFlag = userFlag !== 'none' ? userFlag : undefined

    editSubmission(submission.id, updates)
    addFlash('The submission was edited.')
    navigate(`/f/${submission.forum}/${submission.id}/${updates.slug || submission.slug || '-'}`)
  }

  return (
    <Layout sidebar={forum ? <ForumSidebar forum={forum} /> : null}
            title={`Editing submission ${submission.title}`}>
      <h1 className="page-heading">Editing submission {submission.title}</h1>

      <form ref={formRef} name="submission" method="post" className="form flow" onSubmit={onSubmit}>
        <FormErrors errors={errors.form} />

        {hasUrlField && (
          <FormRow id="submission_url" label="URL" errors={errors.url}>
            <input type="text" id="submission_url" name="submission[url]" inputMode="url"
                   maxLength={MAX_URL_LENGTH} className="form-control"
                   value={url} onChange={e => setUrl(e.target.value)} />
          </FormRow>
        )}

        <FormRow id="submission_title" label="Title" required errors={errors.title}>
          <textarea id="submission_title" name="submission[title]" required rows={3}
                    maxLength={MAX_TITLE_LENGTH} className="form-control"
                    value={title} onChange={e => setTitle(e.target.value)} />
        </FormRow>

        <div className="flow-slim">
          <FormErrors errors={errors.body} />
          <div className="form-flex--stretch form-flex form__row">
            <label htmlFor="submission_body">Body</label>
            <textarea id="submission_body" name="submission[body]" rows={10}
                      maxLength={MAX_BODY_LENGTH}
                      aria-describedby="submission_body_help"
                      className="flex__grow form-control"
                      value={body} onChange={e => setBody(e.target.value)} />
          </div>
          <div id="submission_body_help"><MarkdownHelp /></div>
        </div>

        <FormRow id="submission_userFlag" label="Post as" hidden>
          <SelectWidget id="submission_userFlag" name="submission[userFlag]"
                        value={userFlag} onChange={e => setUserFlag(e.target.value)}>
            <option value="none">(none)</option>
          </SelectWidget>
        </FormRow>

        <ButtonRow label="Edit submission" />
      </form>
    </Layout>
  )
}
