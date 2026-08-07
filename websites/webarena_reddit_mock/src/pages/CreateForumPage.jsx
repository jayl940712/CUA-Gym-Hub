import React, { useState } from 'react'
import Layout from '../components/layout/Layout.jsx'
import SLink, { useSidNavigate } from '../components/SLink.jsx'
import MarkdownHelp from '../components/MarkdownHelp.jsx'
import MarkdownPreview from '../components/MarkdownPreview.jsx'
import { FormRow, FormErrors, ButtonRow, useNativeValidation } from '../components/forms/FormBits.jsx'
import { useApp } from '../context/AppContext.jsx'

// ROUTES #30 — `/create_forum`, templates/forum/create.html.twig +
// forum/_form.html.twig. DOM transcribed from assets/html/create_forum-auth.html
// and checked against assets/screenshots/reference/20-create-forum.png.
//
// Fields, in source order: name (with the `/f/` decoration), title, description
// (textarea), sidebar (markdown textarea, rows 8), tags (textarea, rows 2).
// The admin-only `featured` checkbox and the moderator-only
// `moderationLogPublic` checkbox are absent on create — ForumType.php only adds
// them for an existing forum / an admin.
//
// The creator becomes a moderator, which is the ONLY way /f/<name>/edit becomes
// reachable for MarvelsGrantMan136 — the entire webarena-580..584 flow.

const ERR_BLANK = 'This value should not be blank.'
const ERR_NAME_CHARS = 'The name must contain only letters, numbers, and underscores.'
const ERR_DUPLICATE = 'A forum by that name already exists.'
const tooShort = (limit) => `This value is too short. It should have ${limit} characters or more.`
const tooLong = (limit) => `This value is too long. It should have ${limit} characters or less.`

/** Shared with ForumEditPage — the constraints on ForumData. */
export function validateForumData({ name, title, description, sidebar }, { getForum, currentName = null }) {
  const errors = {}

  const n = (name || '').trim()
  if (!n) errors.name = [ERR_BLANK]
  else if (n.length < 3) errors.name = [tooShort(3)]
  else if (n.length > 25) errors.name = [tooLong(25)]
  else if (!/^\w+$/.test(n)) errors.name = [ERR_NAME_CHARS]
  else {
    const clash = getForum(n)
    if (clash && (!currentName || clash.name.toLowerCase() !== currentName.toLowerCase())) {
      errors.name = [ERR_DUPLICATE]
    }
  }

  const t = (title || '').trim()
  if (!t) errors.title = [ERR_BLANK]
  else if (t.length > 100) errors.title = [tooLong(100)]

  const d = (description || '').trim()
  if (!d) errors.description = [ERR_BLANK]
  else if (d.length > 300) errors.description = [tooLong(300)]

  const s = (sidebar || '').trim()
  if (!s) errors.sidebar = [ERR_BLANK]
  else if (s.length > 1500) errors.sidebar = [tooLong(1500)]

  return errors
}

/** The `/f/` prefix in front of the Name input (decorated-form-control). */
export function ForumNameField({ id, name, value, onChange }) {
  return (
    <label className="decorated-form-control decorated-form-control--text">
      <span className="fg-grey no-select" aria-hidden="true">/f/</span>
      <input type="text" id={id} name={name} required maxLength={25}
             className="form-control decorated-form-control__widget form-control--no-decoration"
             value={value} onChange={onChange} />
    </label>
  )
}

export default function CreateForumPage() {
  const navigate = useSidNavigate()
  const { getForum, createForum, editForum } = useApp()

  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sidebar, setSidebar] = useState('')
  const [tags, setTags] = useState('')
  const [errors, setErrors] = useState({})
  // The source form is NOT novalidate, so the browser blocks an empty required
  // field with its own bubble; this mirrors the same rejection into
  // `ul.form-error-list` so the failure is also visible in the DOM.
  const formRef = useNativeValidation(setErrors)

  function onSubmit(e) {
    e.preventDefault()
    const next = validateForumData({ name, title, description, sidebar }, { getForum })
    if (Object.keys(next).length > 0) { setErrors(next); return }
    setErrors({})

    const forumName = name.trim()
    createForum({
      name: forumName,
      title: title.trim(),
      description: description.trim(),
      sidebar: sidebar.trim()
    })
    // createForum() carries the fields ForumData defines; tags round-trip
    // through the same update path so /f/<name>/edit shows them again.
    const tagList = tags.split(/[\s,]+/).map(t => t.trim()).filter(Boolean)
    if (tagList.length > 0) editForum(forumName, { tags: tagList })

    navigate(`/f/${forumName}`)
  }

  return (
    <Layout title="Create new forum">
      <h1 className="page-heading">Create new forum</h1>

      <form ref={formRef} name="forum" method="post" className="form flow" onSubmit={onSubmit}>
        <FormErrors errors={errors.form} />

        <FormRow id="forum_name" label="Name" required errors={errors.name}>
          <ForumNameField id="forum_name" name="forum[name]" value={name}
                          onChange={e => setName(e.target.value)} />
        </FormRow>

        <FormRow id="forum_title" label="Title" required errors={errors.title}>
          <input type="text" id="forum_title" name="forum[title]" required maxLength={100}
                 className="form-control" value={title}
                 onChange={e => setTitle(e.target.value)} />
        </FormRow>

        <FormRow id="forum_description" label="Description" required errors={errors.description}
                 help="A short description of the forum. Search engines will present this description in their results.">
          <textarea id="forum_description" name="forum[description]" required maxLength={300}
                    aria-describedby="forum_description_help" className="form-control"
                    value={description} onChange={e => setDescription(e.target.value)} />
        </FormRow>

        <div className="flow-slim">
          <FormErrors errors={errors.sidebar} />
          <div className="form-flex--stretch form-flex form__row">
            <label htmlFor="forum_sidebar">Sidebar <b className="fg-red" role="presentation"
                   title="This field is required." aria-label="This field is required.">*</b></label>
            {/* ForumType::sidebar is the one MarkdownType on this form (title
                and description are plain), so only it gets the markdown_widget
                wrapper — see components/MarkdownPreview.jsx. */}
            <div className="flow-slim" data-controller="markdown">
              <textarea id="forum_sidebar" name="forum[sidebar]" required rows={8} maxLength={1500}
                        aria-describedby="forum_sidebar_help" className="flex__grow form-control"
                        data-action="markdown#preview" data-markdown-target="input"
                        value={sidebar} onChange={e => setSidebar(e.target.value)} />
              <MarkdownPreview value={sidebar} />
            </div>
          </div>
          <div id="forum_sidebar_help"><MarkdownHelp /></div>
        </div>

        <div className="flow-slim">
          <div className="form-flex form__row">
            <label htmlFor="forum_tags">Tags</label>
            <textarea id="forum_tags" name="forum[tags]" rows={2} className="form-control"
                      value={tags} onChange={e => setTags(e.target.value)} />
          </div>
          <div id="forum_tags_help" className="text-flow-slim">
            <p className="text-sm"><SLink to="/tags">See the full list of tags</SLink></p>
          </div>
        </div>

        <ButtonRow label="Create forum" />
      </form>
    </Layout>
  )
}
