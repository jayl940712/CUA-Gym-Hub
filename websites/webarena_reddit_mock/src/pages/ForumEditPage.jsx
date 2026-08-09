import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import Forbidden from '../components/forms/Forbidden.jsx'
import SLink, { useSidNavigate } from '../components/SLink.jsx'
import MarkdownHelp from '../components/MarkdownHelp.jsx'
import { ForumSidebar } from '../components/Sidebars.jsx'
import { FormRow, FormErrors, ButtonRow, CheckboxRow, useNativeValidation } from '../components/forms/FormBits.jsx'
import { validateForumData, ForumNameField } from './CreateForumPage.jsx'
import { useApp } from '../context/AppContext.jsx'

// ROUTES #15 — `/f/{forum_name}/edit`, templates/forum/edit.html.twig +
// forum/_form.html.twig.
//
// ⚠️ THE FIELD IDS ARE EVALUATOR LOCATORS. webarena-580..584 run
//     document.querySelector("#forum_description").value
//     document.querySelector("#forum_sidebar").value
// against this page, so both must be real form controls carrying the SAVED
// value on a cold deep-link. Local state is seeded from the store on the first
// render (AppProvider blocks rendering until the store is loaded) and the form
// is keyed on the forum id, so switching forums resyncs.
//
// The full field list was resolved from the container's own
// templates/forum/_form.html.twig + src/Form/ForumType.php (TODO.md gap #7 —
// the live page 403s so it could not be render-confirmed):
//   name · title · description · sidebar · tags · [moderationLogPublic] ·
//   [featured (ROLE_ADMIN only — omitted, the seeded user is not admin)]
// There is no `suggestedTheme` here; that lives on /f/{name}/appearance.
//
// @IsGranted("moderator", subject="forum", statusCode=403) — the 95 seeded
// forums have no moderators and MarvelsGrantMan136 is not admin, so
// /f/news/edit renders the bare 403 the source serves. A forum she created via
// /create_forum is moderated by her and renders the form.

export default function ForumEditPage() {
  const params = useParams()
  const { getForum, moderates } = useApp()

  const forum = getForum(params.forum)
  if (!forum) return <NotFound />
  if (!moderates(forum.name)) return <Forbidden />

  return <ForumEditForm key={forum.id} forum={forum} />
}

function ForumEditForm({ forum }) {
  const { getForum, editForum, renameForum, addFlash } = useApp()
  const navigate = useSidNavigate()

  const [name, setName] = useState(forum.name)
  const [title, setTitle] = useState(forum.title || '')
  const [description, setDescription] = useState(forum.description || '')
  const [sidebar, setSidebar] = useState(forum.sidebar || '')
  const [tags, setTags] = useState((forum.tags || []).join(', '))
  const [logPublic, setLogPublic] = useState(forum.moderationLogPublic !== false)
  const [errors, setErrors] = useState({})
  // Source parity: forum/_form.html.twig emits no `novalidate`. See
  // useNativeValidation() — the browser bubble AND the Symfony error list.
  const formRef = useNativeValidation(setErrors)

  const canSetLogVisibility = true // moderator + site.moderatorsCanSetForumLogVisibility

  function onSubmit(e) {
    e.preventDefault()
    const next = validateForumData({ name, title, description, sidebar },
      { getForum, currentName: forum.name })
    if (Object.keys(next).length > 0) { setErrors(next); return }
    setErrors({})

    const newName = name.trim()
    const updates = {
      name: newName,
      title: title.trim(),
      description: description.trim(),
      sidebar: sidebar.trim(),
      tags: tags.split(/[\s,]+/).map(t => t.trim()).filter(Boolean),
      moderationLogPublic: logPublic
    }

    if (newName !== forum.name) {
      // Submissions, subscriptions and moderatorOf all key off the forum NAME,
      // so a rename has to carry them along or the forum's contents orphan.
      // AppContext.renameForum records it as an overlay entry applied to
      // `submission.forum` at materialization.
      renameForum(forum.name, updates)
      // ForumController::edit redirects to the RENAMED forum. Without this the
      // component re-renders against the stale `:forum` param, getForum(old)
      // returns null, and a successful save dead-ends on "Page not found".
      // useSidNavigate keeps ?sid= on the new URL.
      navigate(`/f/${newName}/edit`, { replace: true })
    } else {
      editForum(forum.name, updates)
    }

    addFlash('The changes have been saved.')
  }

  return (
    <Layout sidebar={<ForumSidebar forum={forum} />} title={`Editing /f/${forum.name}`}>
      <h1 className="page-heading break-text">
        Editing forum <SLink to={`/f/${forum.name}`}>/f/{forum.name}</SLink>
      </h1>

      <form ref={formRef} name="forum" method="post" className="form flow" onSubmit={onSubmit}>
        <FormErrors errors={errors.form} />

        <FormRow id="forum_name" label="Name" required errors={errors.name}
                 help="Will appear in the URL.">
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
            <textarea id="forum_sidebar" name="forum[sidebar]" required rows={8} maxLength={1500}
                      aria-describedby="forum_sidebar_help" className="flex__grow form-control"
                      value={sidebar} onChange={e => setSidebar(e.target.value)} />
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

        {canSetLogVisibility && (
          <CheckboxRow id="forum_moderationLogPublic" name="forum[moderationLogPublic]"
                       label="Moderation log is public" checked={logPublic}
                       onChange={e => setLogPublic(e.target.checked)} />
        )}

        <ButtonRow label="Save changes" />
      </form>
    </Layout>
  )
}
