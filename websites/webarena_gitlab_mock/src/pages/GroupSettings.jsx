import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import useGo from '../components/create/useGo.js'
import { deriveSlug } from '../components/create/mutations.js'
import { instanceUrlPrefix } from '../utils/instance.js'
import '../components/create/create.css'

// ROUTES #123 — `/groups/:group/edit`. The source's group settings page;
// P2, but the group sidebar links here so it must not dead-end.

const GROUP_VISIBILITY = [
  ['private', 'Private', 'The group and its projects can only be viewed by members.'],
  ['internal', 'Internal', 'The group and any internal projects can be viewed by any logged in user except external users.'],
  ['public', 'Public', 'The group and any public projects can be viewed without any authentication.'],
]

export default function GroupSettings() {
  const { state, setState } = useApp()
  const { group: slug } = useParams()
  const go = useGo()

  const group = state ? state.groups.find(g => g.path === slug) : null

  usePageChrome({ title: group ? `General · Settings · ${group.name} · GitLab` : 'GitLab' })

  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('private')
  const [flash, setFlash] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (!group) return
    setName(group.name)
    setPath(group.path)
    setDescription(group.description || '')
    setVisibility(group.visibility || 'private')
  }, [group && group.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null
  if (!group) return <NotFound />

  function saveNaming(e) {
    e.preventDefault()
    setState(prev => ({
      ...prev,
      groups: prev.groups.map(g => (g.id === group.id
        ? { ...g, name: name.trim() || g.name, description, visibility } : g)),
    }))
    setFlash('Group was successfully updated.')
  }

  function changePath(e) {
    e.preventDefault()
    const next = deriveSlug(path)
    if (!next) { setFlash("Group URL can't be blank"); return }
    if (next !== group.path && state.groups.some(g => g.path === next)) {
      setFlash('Group URL has already been taken')
      return
    }
    setState(prev => ({
      ...prev,
      groups: prev.groups.map(g => (g.id === group.id ? { ...g, path: next } : g)),
      // Projects inside the group move with it.
      projects: prev.projects.map(p => (p.namespace && p.namespace.id === group.id
        ? { ...p, namespace: { ...p.namespace, path: next }, full_path: `${next}/${p.path}` }
        : p)),
    }))
    go(`/groups/${next}/edit`)
  }

  function deleteGroup() {
    setState(prev => ({
      ...prev,
      groups: prev.groups.filter(g => g.id !== group.id),
      members: prev.members.filter(m => !(m.source_type === 'namespace' && m.source_id === group.id)),
    }))
    go('/dashboard/groups')
  }

  return (
    <div className="create-flow">
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">Group Settings</h1>
      </div>

      {flash ? (
        <div className="gl-alert gl-alert-success gl-mb-3" role="status">
          <div className="gl-alert-content"><div className="gl-alert-body">{flash}</div></div>
          <button type="button" aria-label="Dismiss" onClick={() => setFlash(null)}
            className="btn gl-dismiss-btn btn-default btn-sm gl-button btn-default-tertiary btn-icon">×</button>
        </div>
      ) : null}

      <section className="settings-section">
        <h4>Naming, visibility</h4>
        <p className="settings-sub">Update your group name, description, avatar, and visibility.</p>
        <form onSubmit={saveNaming}>
          <div className="form-group">
            <label className="label-bold" htmlFor="group_name">Group name</label>
            <input id="group_name" name="group[name]" className="form-control gl-form-input"
              value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="label-bold" htmlFor="group_id">Group ID</label>
            <input id="group_id" className="form-control gl-form-input w-auto" readOnly value={group.id} />
          </div>
          <div className="form-group">
            <label className="label-bold" htmlFor="group_description">Group description (optional)</label>
            <textarea id="group_description" name="group[description]" rows={3}
              className="form-control gl-form-input"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="label-bold">Visibility level</label>
            <div className="visibility-level-setting">
              {GROUP_VISIBILITY.map(([v, label, help]) => (
                <div className="gl-form-radio custom-control custom-radio" key={v}>
                  <input className="custom-control-input" type="radio" name="group[visibility_level]"
                    id={`group_settings_visibility_${v}`}
                    checked={visibility === v} onChange={() => setVisibility(v)} />
                  <label className="custom-control-label" htmlFor={`group_settings_visibility_${v}`}>{label}</label>
                  <p className="help-text">{help}</p>
                </div>
              ))}
            </div>
          </div>
          <button type="submit" className="gl-button btn btn-md btn-confirm">Save changes</button>
        </form>
      </section>

      <section className="settings-section">
        <h4>Advanced</h4>
        <p className="settings-sub">Perform advanced options such as changing path, transferring, exporting, or removing the group.</p>

        <form className="sub-section" onSubmit={changePath}>
          <h4 className="warning-title">Change group URL</h4>
          <p>
            Changing a group&apos;s URL can have unintended side effects.{' '}
            <a href="/help/user/group/index#change-a-groups-path">Learn more.</a>
          </p>
          <div className="form-group">
            <label className="label-bold" htmlFor="group_path">Group URL</label>
            <div className="input-group">
              <div className="input-group-text group-root-path">{instanceUrlPrefix()}</div>
              <input id="group_path" name="group[path]" className="form-control gl-form-input"
                value={path} onChange={e => setPath(e.target.value)} />
            </div>
          </div>
          <button type="submit" className="gl-button btn btn-danger">Change group URL</button>
        </form>

        <div className="sub-section gl-mt-5">
          <h4 className="danger-title">Remove group</h4>
          <p>Removing a group also removes all child projects, including archived projects, and their resources.</p>
          <p>Removed groups cannot be restored!</p>
          {confirmDelete ? (
            <div className="gl-alert gl-alert-danger">
              <div className="gl-alert-content">
                <div className="gl-alert-body">You are going to remove {group.path}. Removed groups CANNOT be restored!</div>
                <div className="gl-alert-actions">
                  <button type="button" className="btn gl-button btn-danger" onClick={deleteGroup}>Yes, remove group</button>
                  <button type="button" className="btn gl-button btn-default"
                    onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" className="btn btn-danger btn-md gl-button"
              onClick={() => setConfirmDelete(true)}>Remove group</button>
          )}
        </div>
      </section>
    </div>
  )
}
