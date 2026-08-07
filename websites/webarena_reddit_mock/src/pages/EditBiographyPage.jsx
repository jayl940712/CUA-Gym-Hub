import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import SLink, { useSidNavigate } from '../components/SLink.jsx'
import MarkdownHelp from '../components/MarkdownHelp.jsx'
import MarkdownPreview from '../components/MarkdownPreview.jsx'
import UserSidebar from '../components/user/UserSidebar.jsx'
import Forbidden from '../components/user/Forbidden.jsx'
import NotFound from './NotFound.jsx'
import { useApp } from '../context/AppContext.jsx'
import '../components/user/user.css'

// ROUTES #65 — templates/user/edit_biography.html.twig, transcribed from
// assets/html/user_edit_biography-auth.html and
// assets/screenshots/reference/18-edit-biography.png.
//
// This is the write half of the webarena-399..403 anchor pair: the task types
// one of
//   `I am a robot`
//   `Pro Python Developer with 20 years of Experience`
//   `Seeking SDE positions`
//   `Freelance Web Developer`
//   `Awesome Prompt Artist`
// here, saves, and the evaluator then reads `.user-bio__biography` on
// /user/MarvelsGrantMan136. So the save must land in `currentUser.biography`
// (via updateBio, which also mirrors it into `users[]`) and the redirect must
// carry ?sid= — otherwise the mutation lands in a different session.
//
// Copy: title.editing_biography_for_user / label.biography / action.save /
// flash.user_biography_updated / flash.editing_biography_of_other_user.

export default function EditBiographyPage() {
  const { username } = useParams()
  const { state, getUser, updateBio, addFlash } = useApp()
  const navigate = useSidNavigate()

  const user = getUser(username)
  const isSelf = user && user.username === state.currentUser.username
  const [body, setBody] = useState(
    (isSelf ? state.currentUser.biography : user && user.biography) || ''
  )

  if (!user) return <NotFound />
  // `is_granted('edit_biography', user)` — self or admin. The seeded user is
  // neither admin nor whitelisted, so any other profile 403s, as on the source.
  if (!isSelf) return <Forbidden />

  const onSubmit = (e) => {
    e.preventDefault()
    updateBio(body)
    addFlash('The biography was updated.')
    navigate(`/user/${user.username}`)
  }

  return (
    <Layout
      title={`Editing biography for ${user.username}`}
      sidebar={<UserSidebar user={user} activeTool="edit_biography" />}
    >
      <h1>
        Editing biography for{' '}
        <SLink to={`/user/${user.username}`}>/u/{user.username}</SLink>
      </h1>

      <form name="user_biography" method="post" className="form flow" onSubmit={onSubmit}>
        <div className="flow-slim">
          <div className="form-flex--stretch form-flex form__row">
            <label htmlFor="user_biography_biography">Biography</label>
            {/* _forms/markdown.html.twig block markdown_widget. The source wraps
                the textarea in `.flow-slim[data-controller="markdown"]` and ships
                the preview container with a `hidden` attribute; the Stimulus
                markdown controller then clears `hidden` whenever the rendered
                output is non-empty and re-sets it when the input is empty
                (assets/js/controller/markdown-controller.js). Measured on the live
                source logged in as MarvelsGrantMan136: with the seeded biography
                `t2_5adwlxvn` present the pane IS visible, and `#main` innerText is
                `…Biography\nPreview\n\nt2_5adwlxvn\n\nMarkdown allowed.…`. So the
                pane is not "hidden on the source" (AUDIT-R02 measured it inside the
                600 ms debounce window) — it is hidden only while the field is
                empty, which is what this reproduces. */}
            <div className="flow-slim" data-controller="markdown">
              <textarea
                id="user_biography_biography"
                name="user_biography[biography]"
                rows="5"
                className="flex__grow form-control"
                data-action="markdown#preview"
                data-markdown-target="input"
                value={body}
                onChange={e => setBody(e.target.value)}
              />
              <MarkdownPreview value={body} />
            </div>
          </div>
          <MarkdownHelp />
        </div>

        <div className="form__row form__button-row">
          <button className="button" type="submit">Save</button>
        </div>
      </form>
    </Layout>
  )
}
