import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import Forbidden from '../components/forms/Forbidden.jsx'
import SLink, { useSidNavigate } from '../components/SLink.jsx'
import Icon from '../components/Icon.jsx'
import { ForumSidebar } from '../components/Sidebars.jsx'
import { FormRow, ButtonRow, useNativeValidation } from '../components/forms/FormBits.jsx'
import { useApp } from '../context/AppContext.jsx'

// ROUTES #17 — `/f/{forum_name}/delete`, templates/forum/delete.html.twig +
// src/Form/ConfirmDeletionType.php.
//
// Permission is Forum::userCanDelete(): admin, OR moderator AND the forum has
// zero submissions. A moderator of a forum that already has posts gets the 403,
// same as the source.
//
// Fields: `confirm_deletion_name` (must equal the forum name) and
// `confirm_deletion_confirm` (checkbox). Copy is verbatim from
// translations/messages.en.yml.

const ERR_BLANK = 'This value should not be blank.'
const equalTo = (value) => `This value should be equal to ${value}.`

export default function ForumDeletePage() {
  const params = useParams()
  const { getForum, moderates, state } = useApp()

  const forum = getForum(params.forum)
  if (!forum) return <NotFound />
  const canDelete = state.currentUser.admin ||
    (moderates(forum.name) && (forum.submissionCount || 0) === 0)
  if (!canDelete) return <Forbidden />

  return <ForumDeleteForm key={forum.id} forum={forum} />
}

function ForumDeleteForm({ forum }) {
  const navigate = useSidNavigate()
  const { deleteForum, addFlash } = useApp()
  const [name, setName] = useState('')
  const [confirm, setConfirm] = useState(false)
  const [errors, setErrors] = useState({})
  // Same ConfirmDeletionType as /user/{name}/delete_account, so the same
  // validating form: no `novalidate`, and both fields render `required`.
  const formRef = useNativeValidation(setErrors)

  function onSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!name.trim()) next.name = [ERR_BLANK]
    else if (name.trim() !== forum.name) next.name = [equalTo(forum.name)]
    if (!confirm) next.confirm = [ERR_BLANK]
    if (Object.keys(next).length > 0) { setErrors(next); return }
    setErrors({})

    // The forum's submissions (and their comments) are dropped by
    // overlay.materialize(), not by filtering the frozen corpus — see
    // AppContext.deleteForum.
    deleteForum(forum.name)
    addFlash('The forum and all its contents have been deleted.')
    navigate('/')
  }

  return (
    <Layout sidebar={<ForumSidebar forum={forum} />} title={`Delete forum /f/${forum.name}`}>
      <h1 className="page-heading">
        Delete forum <SLink to={`/f/${forum.name}`}>/f/{forum.name}</SLink>
      </h1>

      <div className="alert bg-orange">
        <div className="alert__icon fg-orange" aria-hidden="true"><Icon name="attention" /></div>
        <div className="alert__text">
          <p>All content on this forum will be irreversibly deleted!</p>
        </div>
      </div>

      <form ref={formRef} name="confirm_deletion" method="post" className="form flow" onSubmit={onSubmit}>
        <FormRow id="confirm_deletion_name" label="Confirm forum name" required errors={errors.name}>
          <input type="text" id="confirm_deletion_name" name="confirm_deletion[name]"
                 required className="form-control"
                 value={name} onChange={e => setName(e.target.value)} />
        </FormRow>

        <div className="flow-slim">
          {/* `form_row(form.confirm)` emits `form_errors()` before `.form__row`. */}
          {errors.confirm && (
            <ul className="form-error-list"><li>{errors.confirm[0]}</li></ul>
          )}
          <div className="form-flex form-flex--single-line form__row">
            <span>
              <input type="checkbox" id="confirm_deletion_confirm" required
                     name="confirm_deletion[confirm]" className="form-control"
                     checked={confirm} onChange={e => setConfirm(e.target.checked)} />
              {' '}
              <label htmlFor="confirm_deletion_confirm">
                I understand there's no way of reviving the data on this forum once it's gone.
              </label>
            </span>
          </div>
        </div>

        <ButtonRow label="Delete forum" />
      </form>
    </Layout>
  )
}
