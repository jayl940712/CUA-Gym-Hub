import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import useGo from '../components/create/useGo.js'
import { forkProject, ownedNamespaces, pathTaken } from '../components/create/mutations.js'
import '../components/create/create.css'

// ROUTES #66 — `/:ns/:proj/-/forks/new`. assets/html/proj-forks-new.html.
//
// ANCHORS: webarena-394…398 fork `yjlou/2019-nCov`, `convexegg/chatgpt`,
// `eriklindernoren/PyTorch-GAN`, `root/metaseq` and aklsh's repos into
// `byteblaze/`; webarena-522 forks both facebook repos and then reads
// `[data-qa-selector="projects_list"]` on /dashboard/projects. The fork must
// therefore be a real project record with a real repo — see
// components/create/mutations.js `forkProject`.
//
// ⚠️ The visibility help text here is NOT the same as on /projects/new:
// private says "access WILL BE granted", internal drops "except external
// users". Both verified in the captured DOM.

const FORK_VISIBILITY = [
  {
    value: 'private',
    testid: 'radio-private',
    label: 'Private',
    icon: 'lock',
    help: 'Project access must be granted explicitly to each user. If this project is part of a group, access will be granted to members of the group.',
  },
  {
    value: 'internal',
    testid: 'radio-internal',
    label: 'Internal',
    icon: 'shield',
    help: 'The project can be accessed by any logged in user.',
  },
  {
    value: 'public',
    testid: 'radio-public',
    label: 'Public',
    icon: 'earth',
    help: 'The project can be accessed without any authentication.',
  },
]

// TEST.part-routes-b.md BUG-B04: the source's fork form re-derives the slug from
// the project name on every keystroke, and it does it with lodash `kebabCase` —
// verified live, typing `ChatGPT` turns `#fork-slug` from `chatgpt` into
// `chat-gpt`. A plain lowercase-and-dash slugify (what /projects/new uses) would
// give `chatgpt`, so the two forms genuinely differ.
function kebabCase(value) {
  const WORDS = /[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]+|[0-9]+/g
  return (String(value).match(WORDS) || []).map(w => w.toLowerCase()).join('-')
}

export default function ForkProject() {
  const { state, setState } = useApp()
  const { project, base } = useProject()
  const go = useGo()

  usePageChrome({
    title: project ? `Fork project · ${project.namespace.name} / ${project.name} · GitLab` : 'GitLab',
    limited: true,
    breadcrumbExtra: [{ text: 'New', href: `${base}/-/forks/new` }],
  })

  const namespaces = useMemo(() => (state ? ownedNamespaces(state) : []), [state])

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('')
  const [namespacePath, setNamespacePath] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const [error, setError] = useState(null)
  // Per-field validity, mirroring the BootstrapVue `invalid-feedback` blocks the
  // source ships (assets/html/proj-forks-new.html). TEST.part-routes-a.md
  // BUG-A03 / TEST.part-anchors.md BUG-005: submitting with no namespace used to
  // be a completely silent no-op.
  const [invalid, setInvalid] = useState({})
  const seeded = useRef(false)
  const menuRef = useRef(null)

  // Prefill from the source project once it has resolved out of state.
  useEffect(() => {
    if (!project || seeded.current) return
    seeded.current = true
    setName(project.name)
    setSlug(project.path)
    setDescription(project.description || '')
    setVisibility(project.visibility || 'public')
  }, [project])

  useEffect(() => {
    if (!menuOpen) return undefined
    function onDown(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  if (!state) return null
  if (!project) return <NotFound />

  const namespace = namespaces.find(n => n.path === namespacePath) || null
  const visible = namespaces.filter(n => n.path.toLowerCase().includes(filter.trim().toLowerCase()))
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  function submit(e) {
    e.preventDefault()
    const bad = {
      namespace: !namespace,
      name: !name.trim(),
      slug: !slug.trim(),
      visibility: !visibility,
    }
    setInvalid(bad)
    if (Object.values(bad).some(Boolean)) {
      setError(null)
      return
    }
    setError(null)
    const fullPath = `${namespace.path}/${slug.trim()}`
    if (pathTaken(state, fullPath)) { setError('Path has already been taken'); return }

    setState(prev => forkProject(prev, project, {
      namespace,
      name: name.trim(),
      path: slug.trim(),
      description,
      visibility,
    }).state)
    go(`/${fullPath}`)
  }

  return (
    <div className="create-flow">
      <div className="row gl-mt-5">
        <div className="col-lg-3">
          <svg className="new-namespace-panel-illustration" viewBox="0 0 64 64" aria-hidden="true"
            fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="20" cy="16" r="6" />
            <circle cx="44" cy="16" r="6" />
            <circle cx="32" cy="48" r="6" />
            <path d="M20 22v8a6 6 0 0 0 6 6h12a6 6 0 0 0 6-6v-8M32 36v6" />
          </svg>
          <h4>Fork project</h4>
          <p>
            A fork is a copy of a project.
            <br />
            Forking a repository allows you to make changes without affecting the original project.
          </p>
        </div>

        <div className="col-lg-9">
          {error ? (
            <div className="gl-alert gl-alert-danger gl-mb-5" role="alert">
              <div className="gl-alert-content"><div className="gl-alert-body">{error}</div></div>
            </div>
          ) : null}

          <form method="POST" onSubmit={submit} noValidate>
            <div role="group" className="form-group gl-form-group">
              <label htmlFor="fork-name" className="d-block col-form-label">Project name</label>
              <input id="fork-name" name="name" type="text" required data-testid="fork-name-input"
                className={`gl-form-input form-control${invalid.name ? ' is-invalid' : ''}`}
                value={name}
                onChange={e => {
                  setName(e.target.value)
                  setSlug(kebabCase(e.target.value))
                  setInvalid(v => ({ ...v, name: false, slug: false }))
                }} />
              {invalid.name ? (
                <div tabIndex={-1} role="alert" aria-live="assertive" aria-atomic="true"
                  className="invalid-feedback" style={{ display: 'block' }}>Project name is required.</div>
              ) : null}
            </div>

            <div className="row">
              <div className="form-group col-sm-6">
                <label htmlFor="fork-url" className="d-block col-form-label">Project URL</label>
                <div className="input-group" ref={menuRef}>
                  {/* DIFF-A05 / BUG-B05: the prefix is the host the mock is
                      actually served from, never the source container's. */}
                  <span className="input-group-text gl-text-truncate" title={`${origin}/`}>
                    {origin}/
                  </span>
                  <div className={`dropdown gl-dropdown gl-flex-grow-1${menuOpen ? ' show' : ''}`}
                    data-qa-selector="select_namespace_dropdown" data-testid="select_namespace_dropdown">
                    <button type="button" aria-haspopup="true" aria-expanded={menuOpen}
                      className="btn dropdown-toggle btn-default btn-md gl-button gl-dropdown-toggle gl-w-full"
                      style={{ borderRadius: '0 4px 4px 0', justifyContent: 'space-between' }}
                      onClick={() => setMenuOpen(o => !o)}>
                      <span className="gl-dropdown-button-text">
                        {namespace ? namespace.path : 'Select a namespace'}
                      </span>
                      <Icon name="chevron-down" className="dropdown-chevron" />
                    </button>
                    <div className="dropdown-menu" style={{ minWidth: 240 }}>
                      <div className="gl-dropdown-inner">
                        <div className="gl-search-box-by-type" style={{ padding: '8px 12px' }}>
                          <input type="search" placeholder="Search" aria-label="Search"
                            className="gl-form-input gl-search-box-by-type-input form-control"
                            data-qa-selector="select_namespace_dropdown_search_field"
                            data-testid="select_namespace_dropdown_search_field"
                            value={filter} onChange={e => setFilter(e.target.value)} />
                        </div>
                        <ul>
                          <li className="gl-dropdown-section-header">
                            <header className="dropdown-header">Namespaces</header>
                          </li>
                          {visible.map(n => (
                            <li className="gl-dropdown-item" key={n.path}>
                              <button type="button" role="menuitem" className="dropdown-item"
                                data-qa-selector="select_namespace_dropdown_item"
                                onClick={() => {
                                  setNamespacePath(n.path)
                                  setMenuOpen(false)
                                  setInvalid(v => ({ ...v, namespace: false }))
                                }}>
                                <p className="gl-dropdown-item-text-primary">{n.path}</p>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
                {invalid.namespace ? (
                  <div tabIndex={-1} role="alert" aria-live="assertive" aria-atomic="true"
                    className="invalid-feedback" style={{ display: 'block' }}>Please select a namespace</div>
                ) : null}
              </div>

              <div className="form-group col-sm-6">
                <label htmlFor="fork-slug" className="d-block col-form-label">Project slug</label>
                <input id="fork-slug" name="slug" type="text" required data-testid="fork-slug-input"
                  className={`gl-form-input form-control${invalid.slug ? ' is-invalid' : ''}`}
                  value={slug}
                  onChange={e => { setSlug(e.target.value); setInvalid(v => ({ ...v, slug: false })) }} />
                {invalid.slug ? (
                  <div tabIndex={-1} role="alert" aria-live="assertive" aria-atomic="true"
                    className="invalid-feedback" style={{ display: 'block' }}>Project slug is required.</div>
                ) : null}
              </div>
            </div>

            <p className="gl-mt-n5 gl-text-gray-500">
              Want to organize several dependent projects under the same namespace?
              {' '}<a href="/groups/new" className="gl-link">Create a group</a>
            </p>

            <div role="group" className="form-group gl-form-group">
              <label htmlFor="fork-description" className="d-block col-form-label">
                Project description (optional)
              </label>
              <textarea id="fork-description" name="description" rows={2}
                className="gl-form-input gl-form-textarea form-control"
                data-testid="fork-description-textarea"
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <fieldset className="form-group gl-form-group">
              <label>
                Visibility level
                <a href="/help/user/public_access" className="gl-link gl-ml-2"><Icon name="question-o" /></a>
              </label>
              <div role="radiogroup" className="gl-form-checkbox-group"
                data-testid="fork-visibility-radio-group" aria-label="visibility">
                {FORK_VISIBILITY.map(o => (
                  <div className="gl-form-radio custom-control custom-radio" key={o.value}>
                    <input type="radio" name="visibility" required className="custom-control-input"
                      data-testid={o.testid} value={o.value} id={`fork_visibility_${o.value}`}
                      checked={visibility === o.value}
                      onChange={() => { setVisibility(o.value); setInvalid(v => ({ ...v, visibility: false })) }} />
                    <label className="custom-control-label" htmlFor={`fork_visibility_${o.value}`}>
                      <div>
                        <Icon name={o.icon} data-qa-selector="fork_privacy_button" data-qa-privacy-level={o.value} />
                        {' '}<span>{o.label}</span>
                      </div>
                      <p className="help-text">{o.help}</p>
                    </label>
                  </div>
                ))}
                {invalid.visibility ? (
                  <div tabIndex={-1} role="alert" aria-live="assertive" aria-atomic="true"
                    className="invalid-feedback" style={{ display: 'block' }}>Please select a visibility level</div>
                ) : null}
              </div>
            </fieldset>

            <div className="gl-display-flex gl-justify-content-space-between gl-mt-8 form-actions">
              <button type="submit" data-testid="submit-button" data-qa-selector="fork_project_button"
                className="btn btn-confirm btn-md gl-button">
                <span className="gl-button-text">Fork project</span>
              </button>
              <a data-testid="cancel-button" href={base} className="btn gl-mr-3 btn-default btn-md gl-button">
                <span className="gl-button-text">Cancel</span>
              </a>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
