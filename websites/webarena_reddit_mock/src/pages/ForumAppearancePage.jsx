import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import Forbidden from '../components/forms/Forbidden.jsx'
import SLink from '../components/SLink.jsx'
import { ForumSidebar } from '../components/Sidebars.jsx'
import { FormRow, ButtonRow, SelectWidget } from '../components/forms/FormBits.jsx'
import { useApp } from '../context/AppContext.jsx'
import { getSessionId } from '../utils/dataManager.js'

// ROUTES #16 — `/f/{forum_name}/appearance`, templates/forum/appearance.html.twig
// + src/Form/ForumAppearanceType.php. Moderator-only (statusCode=403).
//
// Two field groups: `suggestedTheme` (ThemeSelectorType) and the
// BackgroundImageType block (light/dark image + display mode). The container's
// `themes` table is EMPTY (verified read-only: `SELECT id, name FROM themes` →
// 0 rows), so the theme select only ever offers the "Choose one…" placeholder.
// Save button is `action.save: Save`, not "Save changes".

const BACKGROUND_MODES = [
  ['tile', 'Tile'],
  ['fit_to_page', 'Fit to page'],
  ['center', 'Center']
]

export default function ForumAppearancePage() {
  const params = useParams()
  const { getForum, moderates } = useApp()

  const forum = getForum(params.forum)
  if (!forum) return <NotFound />
  if (!moderates(forum.name)) return <Forbidden />

  return <ForumAppearanceForm key={forum.id} forum={forum} />
}

function ForumAppearanceForm({ forum }) {
  const { editForum, addFlash } = useApp()
  const [theme, setTheme] = useState(forum.suggestedTheme || '')
  const [mode, setMode] = useState(forum.backgroundImageMode || 'tile')
  // BackgroundImageType's two file fields. They previously had no onChange, no
  // ref and no read in onSubmit, so picking a file and pressing Save flashed
  // "The changes have been saved." and stored nothing — a silent success. They
  // now go through the mock's own /upload endpoint (same path /submit uses) and
  // land on the forum record, so the flash is true and /go sees the change.
  const [lightFile, setLightFile] = useState(null)
  const [darkFile, setDarkFile] = useState(null)
  const [saving, setSaving] = useState(false)

  /** POSTs to the mock's /upload; falls back to a local object URL. */
  async function uploadImage(file) {
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
    } catch (e) { /* fall through to the local object URL */ }
    return URL.createObjectURL(file)
  }

  async function onSubmit(e) {
    e.preventDefault()
    if (saving) return
    setSaving(true)

    const updates = {
      suggestedTheme: theme || null,
      backgroundImageMode: mode
    }
    if (lightFile) updates.lightBackgroundImage = await uploadImage(lightFile)
    if (darkFile) updates.darkBackgroundImage = await uploadImage(darkFile)

    editForum(forum.name, updates)
    addFlash('The changes have been saved.')
    setSaving(false)
  }

  return (
    <Layout sidebar={<ForumSidebar forum={forum} />} title={`Appearance for /f/${forum.name}`}>
      <h1 className="page-heading">
        Appearance for <SLink to={`/f/${forum.name}`}>/f/{forum.name}</SLink>
      </h1>

      <form name="forum_appearance" method="post" className="form flow" onSubmit={onSubmit}>
        <FormRow id="forum_appearance_suggestedTheme" label="Suggested theme">
          <SelectWidget id="forum_appearance_suggestedTheme"
                        name="forum_appearance[suggestedTheme]"
                        value={theme} onChange={e => setTheme(e.target.value)}>
            <option value="">Choose one…</option>
          </SelectWidget>
        </FormRow>

        <FormRow id="forum_appearance_backgroundImage_lightBackgroundImage"
                 label="Light background image">
          <input type="file" className="form-control"
                 id="forum_appearance_backgroundImage_lightBackgroundImage"
                 name="forum_appearance[backgroundImage][lightBackgroundImage]"
                 accept="image/jpeg,image/gif,image/png"
                 onChange={e => setLightFile(e.target.files?.[0] || null)} />
        </FormRow>

        <FormRow id="forum_appearance_backgroundImage_darkBackgroundImage"
                 label="Dark background image">
          <input type="file" className="form-control"
                 id="forum_appearance_backgroundImage_darkBackgroundImage"
                 name="forum_appearance[backgroundImage][darkBackgroundImage]"
                 accept="image/jpeg,image/gif,image/png"
                 onChange={e => setDarkFile(e.target.files?.[0] || null)} />
        </FormRow>

        <FormRow id="forum_appearance_backgroundImage_backgroundImageMode" label="Display mode">
          <SelectWidget id="forum_appearance_backgroundImage_backgroundImageMode"
                        name="forum_appearance[backgroundImage][backgroundImageMode]"
                        value={mode} onChange={e => setMode(e.target.value)}>
            {BACKGROUND_MODES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </SelectWidget>
        </FormRow>

        <ButtonRow label="Save" />
      </form>
    </Layout>
  )
}
