import React, { useState, useEffect } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import useGo from '../components/create/useGo.js'
import { createGroup, deriveSlug } from '../components/create/mutations.js'
import { instanceUrlPrefix } from '../utils/instance.js'
import '../components/create/create.css'

// ROUTES #119 — `/groups/new`. assets/README.md §19b; assets/html/new-group.html.
//
// ANCHORS (webarena-799…803): after creating `n-lab`, `x-lab`, `crew`,
// `coding_friends` or `webagent` the evaluator opens
// `/groups/<slug>/-/group_members`. None of those groups exist in the source —
// the task creates them — so this form must write to state for real.
//
// ⚠️ There is NO "Group description" field on this form (verified: zero
// `group[description]` hits in the captured DOM).

const GROUP_VISIBILITY = [
  { value: 'private', level: 0, qa: 'private_radio', label: 'Private', icon: 'lock', help: 'The group and its projects can only be viewed by members.' },
  { value: 'internal', level: 10, qa: 'internal_radio', label: 'Internal', icon: 'shield', help: 'The group and any internal projects can be viewed by any logged in user except external users.' },
  { value: 'public', level: 20, qa: 'public_radio', label: 'Public', icon: 'earth', help: 'The group and any public projects can be viewed without any authentication.' },
]

const ROLES = [
  ['software_developer', 'Software Developer'],
  ['development_team_lead', 'Development Team Lead'],
  ['devops_engineer', 'Devops Engineer'],
  ['systems_administrator', 'Systems Administrator'],
  ['security_analyst', 'Security Analyst'],
  ['data_analyst', 'Data Analyst'],
  ['product_manager', 'Product Manager'],
  ['product_designer', 'Product Designer'],
  ['other', 'Other'],
]

const JOBS_TO_BE_DONE = [
  ['', ''],
  ['basics', 'I want to learn the basics of Git'],
  ['move_repository', 'I want to move my repository to GitLab from somewhere else'],
  ['code_storage', 'I want to store my code'],
  ['exploring', 'I want to explore GitLab to see if it’s worth switching to'],
  ['ci', 'I want to use GitLab CI with my existing repository'],
  ['other', 'A different reason'],
]

const PANELS = [
  { hash: 'create-group-pane', title: 'Create group', description: 'Assemble related projects together and grant members access to several projects at once.' },
  { hash: 'import-group-pane', title: 'Import group', description: 'Import a group and related data from another GitLab instance.' },
]

function GroupIllustration({ hash }) {
  if (hash === 'import-group-pane') {
    return (
      <svg className="new-namespace-panel-illustration" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M32 10v28M24 30l8 8 8-8" />
        <path d="M12 44v6a2 2 0 0 0 2 2h36a2 2 0 0 0 2-2v-6" />
      </svg>
    )
  }
  return (
    <svg className="new-namespace-panel-illustration" viewBox="0 0 64 64" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="32" cy="20" r="8" />
      <circle cx="16" cy="42" r="7" />
      <circle cx="48" cy="42" r="7" />
      <path d="M32 28v6M22 38l6-4M42 38l-6-4" />
    </svg>
  )
}

export default function NewGroup() {
  const { state, setState } = useApp()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const go = useGo()

  usePageChrome({ title: 'New Group · GitLab' })

  // `/groups/new` reads as a group context to routeContext.js, so the layout
  // would draw a contextual sidebar for a group named "new". The source has
  // neither a sidebar nor a breadcrumb bar here — see create.css.
  useEffect(() => {
    document.body.classList.add('page-new-group')
    return () => document.body.classList.remove('page-new-group')
  }, [])

  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [pathEdited, setPathEdited] = useState(false)
  const [visibility, setVisibility] = useState('public')
  const [role, setRole] = useState('software_developer')
  const [setupForCompany, setSetupForCompany] = useState('true')
  const [jobs, setJobs] = useState('')
  const [error, setError] = useState(null)
  const [alertDismissed, setAlertDismissed] = useState(false)

  if (!state) return null

  const pane = (location.hash || '').replace(/^#/, '')
  const activePanel = PANELS.find(p => p.hash === pane) || null

  function openPane(e, hash) {
    e.preventDefault()
    setError(null)
    navigate({ pathname: '/groups/new', search: searchParams.toString(), hash: `#${hash}` })
  }

  function onNameChange(value) {
    setName(value)
    if (!pathEdited) setPath(deriveSlug(value))
  }

  function submit(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) { setError('Enter a descriptive name for your group.'); return }
    const slug = (path || deriveSlug(trimmed)).trim()
    if (!slug) { setError('Choose a group URL.'); return }
    if (state.groups.some(g => g.path === slug)) { setError('Group URL has already been taken'); return }
    if (state.users.some(u => u.username === slug)) { setError('Group URL has already been taken'); return }

    setState(prev => createGroup(prev, { name: trimmed, path: slug, visibility }).state)
    go(`/${slug}`)
  }

  return (
    <div className="create-flow">
      <div className="group-edit-container gl-mt-5">
        {error ? (
          <div className="gl-alert gl-alert-danger" role="alert">
            <div className="gl-alert-content"><div className="gl-alert-body">{error}</div></div>
          </div>
        ) : null}

        <div className="container gl-display-flex gl-flex-direction-column">
          {!activePanel ? <h2 className="gl-my-7 gl-font-size-h1 gl-text-center">Create new group</h2> : null}

          {!activePanel ? (
            <div className="new-namespace-panel-grid">
              {PANELS.map(p => (
                <div className="new-namespace-panel-wrapper gl-display-inline-block gl-float-left gl-px-3" key={p.hash}>
                  <a className="new-namespace-panel gl-w-full" data-qa-selector="panel_link"
                    href={`#${p.hash}`} onClick={e => openPane(e, p.hash)}>
                    <GroupIllustration hash={p.hash} />
                    <div className="gl-pl-4">
                      <h3 className="gl-font-size-h2 gl-reset-color">{p.title}</h3>
                      <p className="gl-text-gray-900">{p.description}</p>
                    </div>
                  </a>
                </div>
              ))}
            </div>
          ) : null}

          {/* ── Create group ──────────────────────────────────────────────── */}
          {pane === 'create-group-pane' ? (
            <div className="row">
              <div className="col-lg-3">
                <h4>Create group</h4>
                <p>
                  <a href="/help/user/group/index">Groups</a>
                  {' '}allow you to manage and collaborate across multiple projects.
                  Members of a group have access to all of its projects.
                </p>
                <p>
                  Groups can also be nested by creating{' '}
                  <a href="/help/user/group/subgroups/index">subgroups</a>.
                </p>
              </div>
              <div className="col-lg-9">
                {!alertDismissed ? (
                  <div className="gl-alert gl-alert-info gl-mb-5">
                    <div className="gl-alert-content">
                      <h4 className="gl-alert-title gl-mb-2 gl-mt-0">You&apos;re creating a new top-level group</h4>
                      <div className="gl-alert-body">
                        Members, projects, trials, and paid subscriptions are tied to a specific
                        top-level group. If you are already a member of a top-level group, you can
                        create a subgroup so your new work is part of your existing top-level group.
                        Do you want to create a subgroup instead?
                      </div>
                      <div className="gl-alert-actions">
                        <a className="gl-alert-action btn btn-confirm btn-md gl-button"
                          href="/help/user/group/subgroups/index">Learn more about subgroups</a>
                      </div>
                    </div>
                    <button type="button" aria-label="Dismiss" onClick={() => setAlertDismissed(true)}
                      className="btn gl-dismiss-btn btn-default btn-sm gl-button btn-default-tertiary btn-icon">×</button>
                  </div>
                ) : null}

                <nav className="gl-breadcrumbs" aria-label="Breadcrumb">
                  <ol className="breadcrumb gl-breadcrumb-list">
                    <li className="gl-breadcrumb-item">
                      <a href="#"><span>New group</span></a>
                      <span className="gl-breadcrumb-separator"><Icon name="chevron-right" /></span>
                    </li>
                    <li className="gl-breadcrumb-item">
                      <a aria-current="page" href="#create-group-pane"><span>Create group</span></a>
                    </li>
                  </ol>
                </nav>

                <form id="new_group" className="group-form gl-show-field-errors gl-mt-3"
                  onSubmit={submit} noValidate>
                  <div className="form-group">
                    <label className="label-bold" htmlFor="group_name">Group name</label>
                    <input type="text" className="form-control gl-form-input input-lg" id="group_name"
                      name="group[name]" data-qa-selector="group_name_field" required
                      placeholder="My awesome group" autoComplete="off"
                      value={name} onChange={e => onNameChange(e.target.value)} />
                    <small className="form-text text-gl-muted">
                      Must start with letter, digit, emoji, or underscore. Can also contain periods, dashes, spaces, and parentheses.
                    </small>
                  </div>

                  <div className="form-group">
                    <label className="label-bold" htmlFor="group_path">Group URL</label>
                    <div className="input-group">
                      <div className="input-group-text group-root-path">{instanceUrlPrefix()}</div>
                      <input type="text" className="form-control gl-form-input" id="group_path"
                        name="group[path]" data-qa-selector="group_path_field" required maxLength={255}
                        placeholder="my-awesome-group" autoComplete="off"
                        value={path} onChange={e => { setPathEdited(true); setPath(e.target.value) }} />
                    </div>
                  </div>

                  <input type="hidden" id="group_parent_id" name="group[parent_id]" />

                  <div className="form-group">
                    <label className="label-bold">Visibility level</label>
                    <div className="form-text text-muted gl-mb-3">
                      Who will be able to see this group?{' '}
                      <a href="/help/user/public_access">View the documentation</a>
                    </div>
                    <div className="visibility-level-setting">
                      {GROUP_VISIBILITY.map(o => (
                        <div className="gl-form-radio custom-control custom-radio" key={o.value}>
                          <input className="custom-control-input" type="radio" name="group[visibility_level]"
                            id={`group_visibility_level_${o.level}`} value={o.level} data-qa-selector={o.qa}
                            checked={visibility === o.value} onChange={() => setVisibility(o.value)} />
                          <label className="custom-control-label" htmlFor={`group_visibility_level_${o.level}`}>
                            <Icon name={o.icon} /> {o.label}
                          </label>
                          <p className="help-text"><span className="option-description">{o.help}</span></p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="label-bold">Now, personalize your GitLab experience</label>
                    <div className="form-text text-muted">
                      We&apos;ll use this to help surface the right features and information to you.
                    </div>
                  </div>

                  <div className="row">
                    <div className="form-group col-sm-4">
                      <label className="label-bold" htmlFor="user_role">Role</label>
                      <select className="form-control" id="user_role" name="user[role]"
                        value={role} onChange={e => setRole(e.target.value)}>
                        {ROLES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="label-bold" htmlFor="group_setup_for_company">Who will be using this group?</label>
                    <div className="gl-form-radio custom-control custom-radio">
                      <input className="custom-control-input" type="radio" name="group[setup_for_company]"
                        id="group_setup_for_company_true" value="true"
                        checked={setupForCompany === 'true'} onChange={() => setSetupForCompany('true')} />
                      <label className="custom-control-label" htmlFor="group_setup_for_company_true">My company or team</label>
                    </div>
                    <div className="gl-form-radio custom-control custom-radio">
                      <input className="custom-control-input" type="radio" name="group[setup_for_company]"
                        id="group_setup_for_company_false" value="false"
                        checked={setupForCompany === 'false'} onChange={() => setSetupForCompany('false')} />
                      <label className="custom-control-label" htmlFor="group_setup_for_company_false">Just me</label>
                    </div>
                  </div>

                  <div className="row">
                    <div className="form-group col-sm-4">
                      <label className="label-bold" htmlFor="group_jobs_to_be_done">What will you use this group for?</label>
                      <select className="form-control" id="group_jobs_to_be_done" name="group[jobs_to_be_done]"
                        value={jobs} onChange={e => setJobs(e.target.value)}>
                        {JOBS_TO_BE_DONE.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="row js-invite-members-section" />

                  <div className="form-actions">
                    <button type="submit" data-qa-selector="create_group_button"
                      className="gl-button btn btn-md btn-confirm">
                      <span className="gl-button-text">Create group</span>
                    </button>
                    <a className="gl-button btn btn-md btn-default" href="/dashboard/groups">Cancel</a>
                  </div>
                </form>
              </div>
            </div>
          ) : null}

          {/* ── Import group ──────────────────────────────────────────────── */}
          {pane === 'import-group-pane' ? (
            <div className="row">
              <div className="col-lg-3">
                <h4>Import group</h4>
                <p>{PANELS[1].description}</p>
              </div>
              <div className="col-lg-9">
                <nav className="gl-breadcrumbs" aria-label="Breadcrumb">
                  <ol className="breadcrumb gl-breadcrumb-list">
                    <li className="gl-breadcrumb-item">
                      <a href="#"><span>New group</span></a>
                      <span className="gl-breadcrumb-separator"><Icon name="chevron-right" /></span>
                    </li>
                    <li className="gl-breadcrumb-item">
                      <a aria-current="page" href="#import-group-pane"><span>Import group</span></a>
                    </li>
                  </ol>
                </nav>
                <div className="gl-display-flex gl-align-items-center gl-mb-3">
                  <h4 className="gl-mb-0">Import groups from another instance of GitLab</h4>
                  <a className="gl-link gl-ml-auto" href="/import/bulk_imports/history">History</a>
                </div>
                <div className="gl-alert gl-alert-warning gl-mb-3">
                  <div className="gl-alert-content">
                    <div className="gl-alert-body">
                      Not all related objects are migrated.{' '}
                      <a href="/help/user/group/import/index.md">More info</a>.
                    </div>
                  </div>
                </div>
                <p className="gl-mt-3">
                  Provide credentials for another instance of GitLab to import your groups directly.
                </p>
                <div className="form-group">
                  <label className="label-bold" htmlFor="import_gitlab_url">GitLab source URL</label>
                  <input type="text" className="form-control gl-form-input" id="import_gitlab_url"
                    name="bulk_import_gitlab_url" placeholder="https://gitlab.example.com"
                    title="Please fill in GitLab source URL." />
                </div>
                <div className="form-group">
                  <label className="label-bold" htmlFor="import_gitlab_token">Personal access token</label>
                  <div className="form-text text-muted gl-mb-2">
                    Create a token with api and read_repository scopes in the{' '}
                    <a href="/-/profile/personal_access_tokens">user settings</a> of the source GitLab
                    instance. For security reasons, set a short expiration date for the token. Keep in
                    mind that large migrations take more time.
                  </div>
                  <input type="text" className="form-control gl-form-input" id="import_gitlab_token"
                    name="bulk_import_gitlab_access_token" placeholder="e.g. h8d3f016698e…" />
                </div>
                <div className="form-actions">
                  <button type="button" data-qa-selector="connect_instance_button"
                    className="gl-button btn btn-md btn-confirm"
                    onClick={() => setError('Please fill in GitLab source URL.')}>
                    <span className="gl-button-text">Connect instance</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
