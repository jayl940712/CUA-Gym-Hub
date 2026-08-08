import React, { useState, useMemo } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import useGo from '../components/create/useGo.js'
import TEMPLATES, { templatePayload } from '../components/create/templates.js'
import { createProject, deriveSlug, ownedNamespaces, pathTaken } from '../components/create/mutations.js'
import { instanceUrlPrefix } from '../utils/instance.js'
import '../components/create/create.css'

// ROUTES #124/#125/#126/#127 — `/projects/new` and its three hash panes.
// assets/README.md §19a; assets/html/new-project*.html.
//
// This is the single highest-value flow on the site: 22 WebArena tasks
// (webarena-742…756 and the 556…566 Web-IDE set) create a project here and the
// evaluator then navigates to a route that DOES NOT EXIST until they do. So
// this page has to genuinely mutate state — see components/create/mutations.js.
//
// ⚠️ THREE cards, not four. `Run CI/CD for external repository` does not exist
// on this build (verified: 3 `.new-namespace-panel-wrapper` in the source DOM).

const VISIBILITY_OPTIONS = [
  {
    value: 'private',
    level: 0,
    label: 'Private',
    qa: 'private_radio',
    icon: 'lock',
    help: 'Project access must be granted explicitly to each user. If this project is part of a group, access is granted to members of the group.',
  },
  {
    value: 'internal',
    level: 10,
    label: 'Internal',
    qa: 'internal_radio',
    icon: 'shield',
    help: 'The project can be accessed by any logged in user except external users.',
  },
  {
    value: 'public',
    level: 20,
    label: 'Public',
    qa: 'public_radio',
    icon: 'earth',
    help: 'The project can be accessed without any authentication.',
  },
]

const PANELS = [
  {
    hash: 'blank_project',
    title: 'Create blank project',
    // ⚠️ "store your files", not "house your files".
    description: 'Create a blank project to store your files, plan your work, and collaborate on code, among other things.',
  },
  {
    hash: 'create_from_template',
    title: 'Create from template',
    description: 'Create a project pre-populated with the necessary files to get you started quickly.',
  },
  {
    hash: 'import_project',
    title: 'Import project',
    description: 'Migrate your data from an external source like GitHub, Bitbucket, or another instance of GitLab.',
  },
]

// §19a — the Import pane's provider grid, in the source's order.
const IMPORT_PROVIDERS = [
  { label: 'GitLab export', platform: 'gitlab_export' },
  { label: 'GitLab.com', platform: null, modal: 'Import projects from GitLab.com' },
  { label: 'GitHub', platform: 'github' },
  { label: 'Bitbucket Cloud', platform: null, modal: 'Import projects from Bitbucket' },
  { label: 'Bitbucket Server', platform: 'bitbucket_server' },
  { label: 'FogBugz', platform: 'fogbugz' },
  { label: 'Gitea', platform: 'gitea' },
  { label: 'Repository by URL', platform: 'repo_url' },
  { label: 'Manifest file', platform: 'manifest_file' },
  { label: 'Phabricator tasks', platform: 'phabricator' },
]

function PanelIllustration({ hash }) {
  // The source ships three SVG illustrations; these are simple stand-ins at the
  // same 64px footprint so the card geometry matches.
  if (hash === 'create_from_template') {
    return (
      <svg className="new-namespace-panel-illustration" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="6" y="14" width="34" height="26" rx="2" />
        <rect x="14" y="22" width="34" height="26" rx="2" />
        <circle cx="48" cy="46" r="9" fill="currentColor" stroke="none" />
        <path d="M48 41v10M43 46h10" stroke="#fff" strokeWidth="2" />
      </svg>
    )
  }
  if (hash === 'import_project') {
    return (
      <svg className="new-namespace-panel-illustration" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="14" cy="32" r="10" />
        <path d="M10 29l-3 3 3 3M18 29l3 3-3 3" />
        <path d="M26 32h14M44 32h6" strokeDasharray="4 3" />
        <rect x="40" y="18" width="18" height="28" rx="2" />
      </svg>
    )
  }
  return (
    <svg className="new-namespace-panel-illustration" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 18a2 2 0 0 1 2-2h14l5 6h29a2 2 0 0 1 2 2v22a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2z" />
      <circle cx="48" cy="46" r="9" fill="currentColor" stroke="none" />
      <path d="M48 41v10M43 46h10" stroke="#fff" strokeWidth="2" />
    </svg>
  )
}

function PaneBreadcrumb({ title, hash }) {
  return (
    <nav className="gl-breadcrumbs" aria-label="Breadcrumb">
      <ol className="breadcrumb gl-breadcrumb-list">
        <li className="gl-breadcrumb-item">
          <a href="#"><span>New project</span></a>
          <span className="gl-breadcrumb-separator"><Icon name="chevron-right" /></span>
        </li>
        <li className="gl-breadcrumb-item">
          <a aria-current="page" href={`#${hash}`}><span>{title}</span></a>
        </li>
      </ol>
    </nav>
  )
}

/** The Visibility Level radio group, shared by all three panes. */
export function VisibilityRadios({ value, onChange, idPrefix = 'project', helpFor }) {
  return (
    <div className="form-group">
      <label className="label-bold" htmlFor={`${idPrefix}_visibility_level`}>Visibility Level</label>
      <a href="/help/user/public_access" aria-label="Documentation for Visibility Level" className="gl-ml-2">
        <Icon name="question-o" />
      </a>
      <div className="visibility-level-setting">
        {VISIBILITY_OPTIONS.map(o => (
          <div className="gl-form-radio custom-control custom-radio" key={o.value}>
            <input className="custom-control-input" type="radio" name={`${idPrefix}[visibility_level]`}
              id={`${idPrefix}_visibility_level_${o.level}`} value={o.level}
              data-qa-selector={o.qa}
              checked={value === o.value} onChange={() => onChange(o.value)} />
            <label className="custom-control-label js-visibility-level-radio" htmlFor={`${idPrefix}_visibility_level_${o.level}`}>
              <Icon name={o.icon} /> {o.label}
            </label>
            <p className="help-text" data-testid="pajamas-component-help-text">
              <span className="option-description">{helpFor ? helpFor(o) : o.help}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function NewProject() {
  const { state, setState, currentUser } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const go = useGo()

  usePageChrome({ title: 'New Project · GitLab' })

  const namespaces = useMemo(() => (state ? ownedNamespaces(state) : []), [state])

  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [pathEdited, setPathEdited] = useState(false)
  const [namespacePath, setNamespacePath] = useState(currentUser ? currentUser.username : '')
  const [visibility, setVisibility] = useState('public')
  const [initReadme, setInitReadme] = useState(true)
  const [initSast, setInitSast] = useState(false)
  const [description, setDescription] = useState('')
  const [templateKey, setTemplateKey] = useState(null)
  const [importUrlOpen, setImportUrlOpen] = useState(false)
  const [importUrl, setImportUrl] = useState('')
  const [notice, setNotice] = useState(null)
  const [error, setError] = useState(null)

  if (!state) return null

  const pane = (location.hash || '').replace(/^#/, '')
  const activePanel = PANELS.find(p => p.hash === pane) || null
  const template = templateKey ? TEMPLATES.find(t => t.key === templateKey) : null
  const namespace = namespaces.find(n => n.path === namespacePath) || namespaces[0]

  function openPane(e, hash) {
    e.preventDefault()
    setError(null)
    navigate({ pathname: '/projects/new', search: searchParams.toString(), hash: `#${hash}` })
  }

  function onNameChange(value) {
    setName(value)
    if (!pathEdited) setPath(deriveSlug(value))
  }

  function submit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Project name is required.'); return }
    const slug = (path || deriveSlug(trimmed)).trim()
    if (!slug) { setError('Project slug is required.'); return }
    const fullPath = `${namespace.path}/${slug}`
    if (pathTaken(state, fullPath)) { setError('Path has already been taken'); return }

    setState(prev => createProject(prev, {
      name: trimmed,
      path: slug,
      namespace,
      visibility,
      description,
      initReadme,
      template: templatePayload(template),
    }).state)
    go(`/${fullPath}`)
  }

  // The shared field block (name / URL / slug / visibility).
  //
  // Deliberately a plain function returning JSX rather than a nested component:
  // a component declared inside render is a NEW type on every keystroke, so
  // React would unmount and remount the inputs and the field would lose focus
  // after every character.
  function fields({ withDescription, trackLabel }) {
    return (
      <>
        <div className="row">
          <div className="form-group project-name col-sm-12">
            <label className="label-bold" htmlFor="project_name">Project name</label>
            <input type="text" className="form-control gl-form-input input-lg" id="project_name"
              name="project[name]" data-qa-selector="project_name" required
              placeholder="My awesome project" autoComplete="off"
              data-track-label={trackLabel} data-track-action="activate_form_input"
              value={name} onChange={e => onNameChange(e.target.value)} />
            <div className="gl-field-error hidden" id="project_name_error" />
          </div>
        </div>

        <div className="row">
          <div className="form-group project-path col-sm-6 gl-pr-0">
            <label className="label-bold" htmlFor="project_path_prefix">Project URL</label>
            <div className="input-group">
              {namespaces.length > 1 ? (
                <select className="form-control" id="project_namespace_id" name="project[namespace_id]"
                  style={{ borderRadius: 4 }}
                  value={namespacePath} onChange={e => setNamespacePath(e.target.value)}>
                  {namespaces.map(n => (
                    <option key={n.path} value={n.path}>{instanceUrlPrefix(n.path)}</option>
                  ))}
                </select>
              ) : (
                <div className="input-group-prepend static-namespace flex-shrink-0 has-tooltip"
                  title={instanceUrlPrefix(namespace.path)}>
                  <div className="input-group-text border-0">{instanceUrlPrefix(namespace.path)}</div>
                </div>
              )}
            </div>
            <div className="js-group-namespace-error form-text gl-text-red-500 gl-display-none">
              Pick a group or namespace where you want to create this project.
            </div>
          </div>
          <div className="path-separator gl-align-self-center gl-pl-5">/</div>
          <div className="form-group project-path col-sm-6">
            <label className="label-bold" htmlFor="project_path">Project slug</label>
            <input type="text" className="form-control gl-form-input" id="project_path"
              name="project[path]" data-qa-selector="project_path" required
              placeholder="my-awesome-project" autoComplete="off"
              data-track-label={trackLabel} data-track-action="activate_form_input"
              value={path} onChange={e => { setPathEdited(true); setPath(e.target.value) }} />
          </div>
        </div>

        <p className="form-text text-muted">
          Want to organize several dependent projects under the same namespace?
          {' '}<a href="/groups/new">Create a group.</a>
        </p>

        {withDescription ? (
          <div className="form-group">
            <label className="label-bold" htmlFor="project_description">Project description (optional)</label>
            <textarea id="project_description" name="project[description]" rows={3} maxLength={250}
              className="form-control gl-form-input" placeholder="Description format"
              data-qa-selector="project_description"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>
        ) : null}

        <VisibilityRadios value={visibility} onChange={setVisibility} />
      </>
    )
  }

  function actions() {
    return (
      <div className="form-actions">
        <button type="submit" data-qa-selector="project_create_button"
          className="gl-button btn btn-md btn-confirm js-create-project-button">
          <span className="gl-button-text">Create project</span>
        </button>
        <a className="btn gl-button btn-md btn-default btn-cancel" href="/dashboard/projects">Cancel</a>
      </div>
    )
  }

  return (
    <div className="create-flow">
      <div className="project-edit-container gl-mt-5">
        <div className="project-edit-errors">
          {error ? (
            <div className="gl-alert gl-alert-danger" role="alert">
              <div className="gl-alert-content">
                <div className="gl-alert-body">{error}</div>
              </div>
            </div>
          ) : null}
          {notice ? (
            <div className="gl-alert gl-alert-info" role="alert">
              <div className="gl-alert-content"><div className="gl-alert-body">{notice}</div></div>
              <button type="button" className="btn gl-dismiss-btn btn-default btn-sm gl-button btn-default-tertiary btn-icon"
                aria-label="Dismiss" onClick={() => setNotice(null)}>×</button>
            </div>
          ) : null}
        </div>

        <div className="container gl-display-flex gl-flex-direction-column">
          {/* The heading and the 3-card grid are both replaced by the pane once
              one is opened — verified against new-project-blank.png. */}
          {!activePanel ? <h2 className="gl-my-7 gl-font-size-h1 gl-text-center">Create new project</h2> : null}

          {!activePanel ? (
            <>
              <div className="new-namespace-panel-grid">
                {PANELS.map(p => (
                  <div className="new-namespace-panel-wrapper gl-display-inline-block gl-float-left gl-px-3" key={p.hash}>
                    <a className="new-namespace-panel gl-w-full" data-qa-selector="panel_link"
                      href={`#${p.hash}`} onClick={e => openPane(e, p.hash)}>
                      <PanelIllustration hash={p.hash} />
                      <div className="gl-pl-4">
                        <h3 className="gl-font-size-h2 gl-reset-color">{p.title}</h3>
                        <p className="gl-text-gray-900">{p.description}</p>
                      </div>
                    </a>
                  </div>
                ))}
              </div>
              <div className="gl-pt-5 gl-text-center">
                You can also create a project from the command line.
                {' '}
                <a href="#" onClick={e => {
                  e.preventDefault()
                  setNotice(`git push --set-upstream ${instanceUrlPrefix(currentUser.username)}<project-slug>.git main`)
                }}>Show command</a>
              </div>
            </>
          ) : null}

          {/* ── Blank project ─────────────────────────────────────────────── */}
          {pane === 'blank_project' ? (
            <div className="row">
              <div className="col-lg-3">
                <PanelIllustration hash="blank_project" />
                <h4>Create blank project</h4>
                <p>{PANELS[0].description}</p>
              </div>
              <div className="col-lg-9">
                <PaneBreadcrumb title="Create blank project" hash="blank_project" />
                <div className="tab-pane active" id="blank-project-pane">
                  <form id="new_project" onSubmit={submit} noValidate>
                    {fields({ withDescription: false, trackLabel: 'blank_project' })}

                    <div className="form-group">
                      <label className="label-bold" htmlFor="project_project_configuration">Project Configuration</label>
                      <div className="gl-form-checkbox custom-control custom-checkbox">
                        <input className="custom-control-input" type="checkbox"
                          id="project_initialize_with_readme" name="project[initialize_with_readme]"
                          data-qa-selector="initialize_with_readme_checkbox"
                          checked={initReadme} onChange={e => setInitReadme(e.target.checked)} />
                        <label className="custom-control-label" htmlFor="project_initialize_with_readme">
                          Initialize repository with a README
                        </label>
                        <p className="help-text">
                          Allows you to immediately clone this project’s repository. Skip this if you plan to push up an existing repository.
                        </p>
                      </div>
                      <div className="gl-form-checkbox custom-control custom-checkbox gl-mt-3">
                        <input className="custom-control-input" type="checkbox"
                          id="project_initialize_with_sast" name="project[initialize_with_sast]"
                          data-qa-selector="initialize_with_sast_checkbox"
                          checked={initSast} onChange={e => setInitSast(e.target.checked)} />
                        <label className="custom-control-label" htmlFor="project_initialize_with_sast">
                          Enable Static Application Security Testing (SAST)
                        </label>
                        <p className="help-text">
                          Analyze your source code for known security vulnerabilities.
                          {' '}<a href="/help/user/application_security/sast/index">Learn more.</a>
                        </p>
                      </div>
                    </div>

                    {actions()}
                  </form>
                </div>
              </div>
            </div>
          ) : null}

          {/* ── Create from template ──────────────────────────────────────── */}
          {pane === 'create_from_template' ? (
            <div className="row">
              <div className="col-lg-3">
                <PanelIllustration hash="create_from_template" />
                <h4>Create from template</h4>
                <p>{PANELS[1].description}</p>
              </div>
              <div className="col-lg-9">
                <PaneBreadcrumb title="Create from template" hash="create_from_template" />
                <div className="tab-pane active" id="create-from-template-pane">
                  {!template ? (
                    <>
                      <div className="gl-alert gl-alert-tip gl-mb-3">
                        <div className="gl-alert-content">
                          <div className="gl-alert-body">
                            Learn how to{' '}
                            <a href="https://gitlab.com/gitlab-org/project-templates/contributing">contribute to the built-in templates</a>
                          </div>
                        </div>
                      </div>
                      <ul className="nav-links scrolling-tabs nav gl-tabs-nav">
                        <li className="nav-item built-in-tab">
                          <a className="active nav-link gl-tab-nav-item" href="#built-in">
                            Built-in
                            <span className="gl-badge badge-pill badge-muted sm gl-tab-counter-badge gl-ml-2">
                              {TEMPLATES.length}
                            </span>
                          </a>
                        </li>
                      </ul>
                      <div className="project-templates-buttons import-buttons tab-pane active" id="built-in">
                        {TEMPLATES.map(t => (
                          <div className="template-option d-flex align-items-center" key={t.key}
                            data-qa-selector="template_option_container">
                            <div className="logo gl-mr-3 px-1">
                              <span className={`btn-template-icon icon-${t.key}`}>{t.name.slice(0, 2)}</span>
                            </div>
                            <div>
                              <div className="description">{t.name}</div>
                              <div className="text-muted">{t.description}</div>
                            </div>
                            <div className="controls d-flex align-items-center">
                              <a className="btn gl-button btn-default gl-mr-3"
                                href={`https://gitlab.com/gitlab-org/project-templates/${t.key}`}>Preview</a>
                              <label className="btn gl-button btn-confirm template-button choose-template gl-mb-0"
                                data-testid={`use_template_${t.key}`} htmlFor={t.key}>
                                <input id={t.key} type="radio" name="project[template_name]" value={t.key}
                                  style={{ display: 'none' }}
                                  checked={false}
                                  onChange={() => {
                                    setTemplateKey(t.key)
                                    setDescription(t.blurb)
                                  }} />
                                <span data-qa-selector="use_template_button">Use template</span>
                              </label>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <form id="new_project" onSubmit={submit} noValidate>
                      <div className="template-selected-banner">
                        <div className="logo"><span>{template.name.slice(0, 2)}</span></div>
                        <div>
                          <div className="description">{template.name}</div>
                          <div className="text-muted">{template.description}</div>
                        </div>
                        <button type="button" className="btn gl-button btn-default gl-ml-auto"
                          onClick={() => { setTemplateKey(null); setDescription('') }}>Change template</button>
                      </div>
                      {fields({ withDescription: true, trackLabel: 'create_from_template' })}
                      {actions()}
                    </form>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          {/* ── Import project ────────────────────────────────────────────── */}
          {pane === 'import_project' ? (
            <div className="row">
              <div className="col-lg-3">
                <PanelIllustration hash="import_project" />
                <h4>Import project</h4>
                <p>{PANELS[2].description}</p>
              </div>
              <div className="col-lg-9">
                <PaneBreadcrumb title="Import project" hash="import_project" />
                <div className="tab-pane active" id="import-project-pane">
                  <div className="gl-display-flex gl-align-items-center gl-mb-3">
                    <h4 className="gl-mb-0">Import project from</h4>
                    <a className="gl-link gl-ml-auto gl-font-weight-normal" href="/import/history">History</a>
                  </div>
                  <div className="import-buttons-grid gl-mb-5">
                    {IMPORT_PROVIDERS.map(p => (
                      <button type="button" key={p.label}
                        className="gl-button btn btn-md btn-default js-import-project-btn"
                        data-platform={p.platform || undefined}
                        onClick={() => {
                          if (p.platform === 'repo_url') { setImportUrlOpen(v => !v); return }
                          setNotice(p.modal
                            ? `${p.modal}: to enable importing projects from ${p.label}, ask your GitLab administrator to configure OAuth integration.`
                            : `Importing from ${p.label} is not configured on this GitLab instance.`)
                        }}>
                        <span className="gl-button-text">{p.label}</span>
                      </button>
                    ))}
                  </div>

                  {importUrlOpen ? (
                    <form id="new_project" onSubmit={submit} noValidate>
                      <p>The repository must be accessible over http://, https:// or git://.</p>
                      <p>When using the http:// or https:// protocols, please provide the exact URL to the repository. HTTP redirects will not be followed.</p>
                      <p>If your HTTP repository is not publicly accessible, add your credentials.</p>
                      <p>The import will time out after 180 minutes. For repositories that take longer, use a clone/push combination.</p>
                      <p>
                        To import an SVN repository, check out{' '}
                        <a href="/help/user/project/import/svn">this document</a>.
                      </p>
                      <div className="form-group">
                        <label className="label-bold" htmlFor="project_import_url">Git repository URL</label>
                        <input type="text" className="form-control gl-form-input" id="project_import_url"
                          value={importUrl} onChange={e => setImportUrl(e.target.value)} />
                      </div>
                      <div className="row">
                        <div className="form-group col-sm-6">
                          <label className="label-bold" htmlFor="project_import_url_user">Username (optional)</label>
                          <input type="text" className="form-control gl-form-input" id="project_import_url_user" />
                        </div>
                        <div className="form-group col-sm-6">
                          <label className="label-bold" htmlFor="project_import_url_password">Password (optional)</label>
                          <input type="password" className="form-control gl-form-input" id="project_import_url_password" />
                        </div>
                      </div>
                      {fields({ withDescription: true, trackLabel: 'import_project' })}
                      {actions()}
                    </form>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
