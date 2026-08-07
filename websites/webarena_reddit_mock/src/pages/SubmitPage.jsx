import React, { useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import MarkdownHelp from '../components/MarkdownHelp.jsx'
import MarkdownPreview from '../components/MarkdownPreview.jsx'
import { ForumSidebar } from '../components/Sidebars.jsx'
import { FormRow, FormErrors, ButtonRow, SelectWidget, useNativeValidation } from '../components/forms/FormBits.jsx'
import { useSidNavigate } from '../components/SLink.jsx'
import { useApp } from '../context/AppContext.jsx'
import { slugify } from '../utils/slug.js'
import { getSessionId } from '../utils/dataManager.js'

// ROUTES #49 `/submit` · #50 `/submit/{forum_name}`
//
// The highest-value page on the site: 98 of the 129 reddit tasks post a
// submission, and 60+ of them are scored on the URL this form redirects to
// (`func:reddit_get_post_url('__last_url__')`). The redirect to
// /f/<forum>/<id>/<slug> is therefore load-bearing, and it must keep ?sid=.
//
// DOM transcribed from assets/html/submit-auth.html + submit_books-auth.html
// (templates/submission/create.html.twig + submission/_form.html.twig).
// Field order on the source is: media tabs → Title → Body → Forum → Post as.
// There are only TWO media tabs, URL and Image — a "text" post is simply one
// with the URL left blank (confirmed in 14-submit-form.png; SubmissionType.php
// offers exactly ['label.url' => 'url', 'label.image' => 'image']).

const MAX_TITLE_LENGTH = 300
const MAX_URL_LENGTH = 2000
const MAX_BODY_LENGTH = 25000

/** Symfony's NotBlank / Url / Length defaults, plus Postmill's own keys. */
const ERR_BLANK = 'This value should not be blank.'
const ERR_BAD_URL = 'This value is not a valid URL.'
const ERR_NO_FORUM = 'This value is not valid.'
const tooManyChars = (max, count) =>
  `You entered too many characters (max ${max}, ${count} entered)`

export default function SubmitPage() {
  const params = useParams()
  const navigate = useSidNavigate()
  const { state, getForum, createSubmission } = useApp()

  // /submit/{forum_name} — an unknown forum 404s, exactly as the source's
  // ParamConverter does. Casing is normalised (/submit/books, /submit/BOOKS).
  const routeForum = params.forum ? getForum(params.forum) : null
  const missingForum = !!params.forum && !routeForum

  const forums = useMemo(
    () => [...state.forums].sort((a, b) =>
      a.name.localeCompare(b.name, 'en', { sensitivity: 'base' })),
    [state.forums])

  const [mediaType, setMediaType] = useState('url')
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [forumName, setForumName] = useState(routeForum ? routeForum.name : '')
  const [userFlag, setUserFlag] = useState('none')
  const [image, setImage] = useState(null)
  const [errors, setErrors] = useState({})
  const submitting = useRef(false)
  // Source parity: submission/_form.html.twig emits no `novalidate`, so the
  // browser blocks an empty Title / unset Forum with its own bubble. The hook
  // mirrors that rejection into `ul.form-error-list` as well.
  const formRef = useNativeValidation(setErrors)

  if (missingForum) return <NotFound />

  async function uploadImage(file) {
    // The mock's own /upload endpoint (vite.config.js) — the only network call
    // this app is allowed to make. Falls back to an inline data URL when the
    // plugin is not mounted, so the flow never dead-ends.
    const sid = getSessionId()
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch(`/upload${sid ? `?sid=${encodeURIComponent(sid)}` : ''}`,
        { method: 'POST', body: fd })
      if (res.ok) {
        const data = await res.json()
        if (data?.files?.[0]?.url) return data.files[0].url
      }
    } catch (e) { /* fall through */ }
    return await new Promise(resolve => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => resolve(null)
      reader.readAsDataURL(file)
    })
  }

  /** Postmill stores width/height on the Image entity and `submission.html.twig`
   *  emits them as attributes; `.submission__image:not([width])` otherwise
   *  crops to a 500x375 box. Decoded straight from the picked File — no URL is
   *  fetched, so this stays inside the zero-network contract. */
  async function measureImage(file) {
    try {
      const bitmap = await createImageBitmap(file)
      const size = { width: bitmap.width, height: bitmap.height }
      bitmap.close?.()
      return size
    } catch (e) {
      return null
    }
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (submitting.current) return

    const next = {}
    const trimmedTitle = title.trim()
    if (!trimmedTitle) next.title = [ERR_BLANK]
    else if (title.length > MAX_TITLE_LENGTH) next.title = [tooManyChars(MAX_TITLE_LENGTH, title.length)]
    if (body.length > MAX_BODY_LENGTH) next.body = [tooManyChars(MAX_BODY_LENGTH, body.length)]

    let postUrl = ''
    if (mediaType === 'url') {
      postUrl = url.trim()
      if (postUrl.length > MAX_URL_LENGTH) next.url = [tooManyChars(MAX_URL_LENGTH, postUrl.length)]
      // @Assert\Url(protocols={"http","https"}) — blank is allowed and makes a
      // text post, but a non-empty value must be a real http(s) URL.
      else if (postUrl && !/^https?:\/\/[^\s]+$/i.test(postUrl)) next.url = [ERR_BAD_URL]
    }

    if (!forumName) next.forum = [ERR_BLANK]
    const forum = forumName ? getForum(forumName) : null
    if (forumName && !forum) next.forum = [ERR_NO_FORUM]

    // The Image tab makes an IMAGE post, not a URL post. SubmissionType.php
    // offers exactly ['label.url' => 'url', 'label.image' => 'image'] and a text
    // post is a URL post with the URL left blank — so an uploaded file has to
    // land in `submissions[].image`, which is what renders
    // <img class="submission__image"> and the listing thumbnail. Assigning it to
    // `url` produced a `submission--has-url` article with no image at all.
    let postImage = null
    let dimensions = null
    if (mediaType === 'image' && image) {
      const uploaded = await uploadImage(image)
      if (uploaded) {
        postImage = uploaded
        dimensions = await measureImage(image)
      }
    }

    if (Object.keys(next).length > 0) { setErrors(next); return }
    setErrors({})
    submitting.current = true

    // Derive the canonical URL BEFORE dispatching: React batches the reducer,
    // so createSubmission()'s return value is not reliably populated by the
    // time this function continues. `nextSubmissionId` is the id the reducer
    // will assign, and slugify() is the same validated port it uses.
    const id = state.nextSubmissionId
    const slug = slugify(trimmedTitle) || '-'

    createSubmission({
      forum: forum.name,
      title: trimmedTitle,
      url: postUrl || undefined,
      body: body || undefined,
      image: postImage || undefined,
      imageWidth: dimensions ? dimensions.width : undefined,
      imageHeight: dimensions ? dimensions.height : undefined,
      userFlag
    })

    navigate(`/f/${forum.name}/${id}/${slug}`)
  }

  const sidebar = routeForum ? <ForumSidebar forum={routeForum} /> : null

  return (
    <Layout sidebar={sidebar} title="Create submission">
      <h1 className="page-heading">Create submission</h1>

      <form ref={formRef} name="submission" method="post" className="form flow" onSubmit={onSubmit}
            encType="multipart/form-data">
        <FormErrors errors={errors.form} />

        {/* URL / Image tabs — .form-tabs, radio inputs + .discreet-tab labels */}
        <div className="form-tabs">
          <input type="radio" id="submission_mediaType_url" name="submission[mediaType]"
                 className="form-tabs__checkbox hidden" data-for="0" value="url"
                 checked={mediaType === 'url'} onChange={() => setMediaType('url')} />
          <label className={`discreet-tab form-tabs__tab${mediaType === 'url' ? ' discreet-tab--active' : ''}`}
                 htmlFor="submission_mediaType_url">URL</label>
          <input type="radio" id="submission_mediaType_image" name="submission[mediaType]"
                 className="form-tabs__checkbox hidden" data-for="1" value="image"
                 checked={mediaType === 'image'} onChange={() => setMediaType('image')} />
          <label className={`discreet-tab form-tabs__tab${mediaType === 'image' ? ' discreet-tab--active' : ''}`}
                 htmlFor="submission_mediaType_image">Image</label>

          <div className={`form-tabs__content${mediaType === 'url' ? ' form-tabs__content--active' : ''}`} data-id="0">
            <FormRow id="submission_url" label="URL" labelHidden errors={errors.url}>
              <input type="text" id="submission_url" name="submission[url]" inputMode="url"
                     maxLength={MAX_URL_LENGTH} className="form-control"
                     value={url} onChange={e => setUrl(e.target.value)} />
            </FormRow>
          </div>

          <div className={`form-tabs__content${mediaType === 'image' ? ' form-tabs__content--active' : ''}`} data-id="1">
            <FormRow id="submission_image" label="Upload image" labelHidden>
              <input type="file" id="submission_image" name="submission[image]"
                     accept="image/jpeg,image/gif,image/png" className="form-control"
                     onChange={e => setImage(e.target.files?.[0] || null)} />
            </FormRow>
          </div>
        </div>

        <FormRow id="submission_title" label="Title" required errors={errors.title}>
          <textarea id="submission_title" name="submission[title]" required rows={3}
                    maxLength={MAX_TITLE_LENGTH} className="form-control"
                    value={title} onChange={e => setTitle(e.target.value)} />
        </FormRow>

        <div className="flow-slim">
          <FormErrors errors={errors.body} />
          <div className="form-flex--stretch form-flex form__row">
            <label htmlFor="submission_body">Body</label>
            {/* SubmissionType::body is a MarkdownType, so the source wraps it in
                `_forms/markdown.html.twig`'s markdown_widget — see
                components/MarkdownPreview.jsx. The pane carries the `hidden`
                attribute while the field is empty, so a cold /submit adds no
                text to #main. */}
            <div className="flow-slim" data-controller="markdown">
              <textarea id="submission_body" name="submission[body]" rows={10}
                        maxLength={MAX_BODY_LENGTH}
                        aria-describedby="submission_body_help"
                        className="flex__grow form-control"
                        data-action="markdown#preview"
                        data-markdown-target="input"
                        value={body} onChange={e => setBody(e.target.value)} />
              <MarkdownPreview value={body} />
            </div>
          </div>
          <div id="submission_body_help"><MarkdownHelp /></div>
        </div>

        {/* The source renders the `<select>` directly under the label — there is
            no search box above it (verified on the container: the `Forum *` row
            is `<label for="submission_forum">` then `<span
            class="unstylable-widget"><select id="submission_forum" …>`). The
            select2 enhancement the source loads only decorates that same
            select; it adds no extra <input> to the form's DOM row. */}
        <FormRow id="submission_forum" label="Forum" required errors={errors.forum}>
          <SelectWidget id="submission_forum" name="submission[forum]" required
                        data-forum-selector="data-forum-selector"
                        value={forumName} onChange={e => setForumName(e.target.value)}>
            <option value="">Choose one…</option>
            {forums.map(f => (
              <option key={f.id} value={f.name} data-name={f.name}>{f.name}</option>
            ))}
          </SelectWidget>
        </FormRow>

        <FormRow id="submission_userFlag" label="Post as" hidden>
          <SelectWidget id="submission_userFlag" name="submission[userFlag]"
                        value={userFlag} onChange={e => setUserFlag(e.target.value)}>
            <option value="none">(none)</option>
          </SelectWidget>
        </FormRow>

        <ButtonRow label="Create submission" />
      </form>
    </Layout>
  )
}
