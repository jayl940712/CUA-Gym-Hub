import React, { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { EntityAvatar } from '../components/layout/Avatar.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import useGo from '../components/create/useGo.js'
import { deriveSlug, pathTaken } from '../components/create/mutations.js'
import { instanceUrlPrefix } from '../utils/instance.js'
import '../components/create/create.css'

// ROUTES #98 — `/:ns/:proj/edit` (no `/-/` infix — not a typo).
// assets/README.md §21; assets/html/proj-dotfiles-settings.html.
//
// There is no <h1> on this page; "General Settings" appears only in the
// breadcrumb. Section titles, descriptions and the Expand/Collapse buttons are
// verbatim from the source.

const VISIBILITY_SELECT = [
  ['private', '0', 'Private', 'Only accessible by project members. Membership must be explicitly granted to each user.'],
  ['internal', '10', 'Internal', 'Accessible by any user who is logged in.'],
  ['public', '20', 'Public', 'Accessible by anyone, regardless of authentication.'],
]

// §21 section 2 block B — exact rows, order and nesting.
const FEATURE_ROWS = [
  { key: 'issues', label: 'Issues', select: true, description: 'Flexible tool to collaboratively develop ideas and plan work in this project.', help: '/help/user/project/issues/index' },
  { key: 'repository', label: 'Repository', select: true, description: 'View and edit files in this project. When set to **Everyone With Access** non-project members have only read access.' },
  { key: 'merge_requests', label: 'Merge requests', select: true, child: true, description: 'Submit changes to be merged upstream.' },
  { key: 'forking', label: 'Forks', select: true, child: true, description: 'Users can copy the repository to a new project.' },
  { key: 'lfs', label: 'Git Large File Storage (LFS)', select: false, child: true, description: 'Manages large files such as audio, video, and graphics files.', help: '/help/topics/git/lfs/index' },
  { key: 'builds', label: 'CI/CD', select: true, child: true, description: 'Build, test, and deploy your changes.' },
  { key: 'analytics', label: 'Analytics', select: true, description: 'View project analytics.' },
  { key: 'security_and_compliance', label: 'Security & Compliance', select: true, level: '10', description: 'Security & Compliance for this project' },
  { key: 'wiki', label: 'Wiki', select: true, description: 'Pages for project documentation.' },
  { key: 'snippets', label: 'Snippets', select: true, description: 'Share code with others outside the project.' },
  { key: 'package_registry', label: 'Package registry', select: false, description: 'Publish, store, and view packages in a project.', help: '/help/user/packages/index' },
  { key: 'monitor', label: 'Monitor', select: true, description: 'Monitor the health of your project and respond to incidents.' },
  { key: 'metrics_dashboard', label: 'Metrics Dashboard', select: true, child: true, noToggle: true, level: '10', description: "Visualize the project's performance metrics." },
  { key: 'environments', label: 'Environments', select: true, description: 'Every project can make deployments to environments either via CI/CD or API calls. Non-project members have read-only access.', help: '/help/ci/environments/index' },
  { key: 'feature_flags', label: 'Feature flags', select: true, description: 'Roll out new features without redeploying with feature flags.', help: '/help/operations/feature_flags' },
  { key: 'infrastructure', label: 'Infrastructure', select: true, description: 'Configure your infrastructure.', help: '/help/user/infrastructure/index' },
  { key: 'releases', label: 'Releases', select: true, description: 'Combine git tags with release notes, release evidence, and assets to create a release.', help: '/help/user/project/releases/index' },
]

export function Section({ id, className, title, description, defaultExpanded, qa, children }) {
  const [expanded, setExpanded] = useState(!!defaultExpanded)
  return (
    <section id={id} className={`settings no-animate js-search-settings-section${expanded ? ' expanded' : ''} ${className || ''}`.trim()}
      data-qa-selector={qa}>
      <div className="settings-header gl-display-flex gl-align-items-center">
        <h4 className="settings-title js-settings-toggle js-settings-toggle-trigger-only"
          style={{ cursor: 'pointer', margin: 0, flex: 1 }}
          onClick={() => setExpanded(v => !v)}>{title}</h4>
        <button type="button" className="gl-button btn btn-md btn-default js-settings-toggle"
          onClick={() => setExpanded(v => !v)}>{expanded ? 'Collapse' : 'Expand'}</button>
      </div>
      {description ? <p className="settings-sub">{description}</p> : null}
      {expanded ? <div className="settings-content">{children}</div> : null}
    </section>
  )
}

export default function ProjectSettingsGeneral() {
  const { state, setState } = useApp()
  const { project, base } = useProject()
  const go = useGo()

  usePageChrome({
    title: project ? `General · Settings · ${project.namespace.name} / ${project.name} · GitLab` : 'GitLab',
    limited: true,
  })

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [topics, setTopics] = useState('')
  const [visibility, setVisibility] = useState('public')
  const [requestAccess, setRequestAccess] = useState(true)
  const [newPath, setNewPath] = useState('')
  const [search, setSearch] = useState('')
  const [flash, setFlash] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [mrAlert, setMrAlert] = useState(true)
  const [serviceDeskOpen, setServiceDeskOpen] = useState(true)
  const [badges, setBadges] = useState([])
  const [badgeName, setBadgeName] = useState('')
  const [badgeLink, setBadgeLink] = useState('')
  const [badgeImage, setBadgeImage] = useState('')
  // HANDLER-006 — the 17 feature-permission controls used to be uncontrolled,
  // so every change was visually accepted and silently discarded. They are now
  // controlled and persisted onto the project by `Save changes`.
  const [features, setFeatures] = useState({})
  const [avatarFile, setAvatarFile] = useState('')

  useEffect(() => {
    if (!project) return
    setName(project.name)
    setDescription(project.description || '')
    setTopics((project.topics || []).join(', '))
    setVisibility(project.visibility || 'public')
    setNewPath(project.path)
    const saved = project.feature_settings || {}
    const init = {}
    FEATURE_ROWS.forEach(row => {
      const cur = saved[row.key] || {}
      init[row.key] = {
        enabled: cur.enabled != null ? cur.enabled : true,
        level: cur.level != null ? String(cur.level) : String(row.level || '20'),
      }
    })
    setFeatures({ ...init, ...(saved.__flags ? { __flags: saved.__flags } : {}) })
  }, [project && project.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null
  if (!project) return <NotFound />

  function patchProject(patch, message) {
    setState(prev => ({
      ...prev,
      projects: prev.projects.map(p => (p.id === project.id ? { ...p, ...patch } : p)),
    }))
    setFlash(message)
  }

  function saveNaming(e) {
    e.preventDefault()
    patchProject({
      name: name.trim() || project.name,
      description,
      topics: topics.split(',').map(t => t.trim()).filter(Boolean),
    }, 'Project was successfully updated.')
  }

  function saveVisibility(e) {
    e.preventDefault()
    patchProject({ visibility, request_access_enabled: requestAccess, feature_settings: features },
      'Project was successfully updated.')
  }

  const setFeature = (key, patch) => setFeatures(f => ({ ...f, [key]: { ...f[key], ...patch } }))

  function archive(e) {
    e.preventDefault()
    patchProject({ archived: !project.archived },
      project.archived ? 'Project was successfully unarchived.' : 'Project was successfully archived.')
  }

  function changePath(e) {
    e.preventDefault()
    const slug = deriveSlug(newPath)
    if (!slug) { setFlash('Path can\'t be blank'); return }
    const target = `${project.namespace.path}/${slug}`
    if (target !== project.full_path && pathTaken(state, target)) { setFlash('Path has already been taken'); return }
    patchProject({ path: slug, full_path: target }, null)
    go(`/${target}/edit`)
  }

  function deleteProject() {
    setState(prev => ({
      ...prev,
      projects: prev.projects.filter(p => p.id !== project.id),
      members: prev.members.filter(m => !(m.source_type === 'project' && m.source_id === project.id)),
    }))
    go('/dashboard/projects')
  }

  const matches = title => !search.trim() || title.toLowerCase().includes(search.trim().toLowerCase())

  return (
    <div className="create-flow project-edit-container">
      {flash ? (
        <div className="gl-alert gl-alert-success gl-mb-3" role="status">
          <div className="gl-alert-content"><div className="gl-alert-body">{flash}</div></div>
          <button type="button" aria-label="Dismiss" onClick={() => setFlash(null)}
            className="btn gl-dismiss-btn btn-default btn-sm gl-button btn-default-tertiary btn-icon">×</button>
        </div>
      ) : null}

      <div className="gl-my-5">
        <div className="gl-search-box-by-type">
          <input type="search" className="gl-form-input gl-search-box-by-type-input form-control"
            placeholder="Search page" aria-label="Search page"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
      </div>

      {matches('Naming, topics, avatar') ? (
        <Section id="js-general-settings" className="general-settings" defaultExpanded
          title="Naming, topics, avatar"
          description="Update your project name, topics, description, and avatar.">
          <form id={`edit_project_${project.id}`} className="edit-project js-general-settings-form" onSubmit={saveNaming}>
            <div className="row">
              <div className="form-group col-sm-6">
                <label className="label-bold" htmlFor="project_name_edit">Project name</label>
                <input type="text" className="form-control gl-form-input" id="project_name_edit"
                  name="project[name]" data-qa-selector="project_name_field"
                  value={name} onChange={e => setName(e.target.value)} />
              </div>
              <div className="form-group col-sm-6">
                <label className="label-bold" htmlFor="project_id">Project ID</label>
                <input type="text" className="form-control gl-form-input w-auto" id="project_id"
                  name="project[id]" readOnly value={project.id} />
              </div>
            </div>
            <div className="form-group">
              <label className="label-bold" htmlFor="project_topic_list_field">Topics</label>
              <input type="text" className="form-control gl-form-input" id="project_topic_list_field"
                name="project[topics]" placeholder="Search for topic"
                value={topics} onChange={e => setTopics(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label-bold" htmlFor="project_description">Project description (optional)</label>
              <textarea className="form-control gl-form-input" id="project_description" rows={3}
                name="project[description]"
                value={description} onChange={e => setDescription(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label-bold" htmlFor="project_disabled_repository_size_limit">Repository size limit (MB)</label>
              <input type="number" className="form-control" id="project_disabled_repository_size_limit" disabled />
              <div className="form-text text-muted">
                Want to use this feature for free? Read more about the{' '}
                <a href="/help/user/admin_area/settings/usage_statistics.md#registration-features-program">Registration Features Program</a>.
              </div>
            </div>
            <div className="form-group">
              <label className="label-bold">Project avatar</label>
              <div className="avatar-container rect-avatar s90 gl-mb-3">
                <EntityAvatar entity={project} size={64} kind="project" />
              </div>
              <span className="js-filepicker">
                <input id="project_avatar" type="file" accept="image/*" className="hidden"
                  style={{ display: 'none' }}
                  onChange={e => setAvatarFile(e.target.files && e.target.files[0] ? e.target.files[0].name : '')} />
                <button type="button" className="btn gl-button btn-default js-filepicker-button"
                  onClick={() => document.getElementById('project_avatar').click()}>Choose file…</button>
                <span className="file_name js-filepicker-filename gl-ml-3">
                  {avatarFile || 'No file chosen.'}</span>
              </span>
              <div className="form-text text-muted">Max file size is 200 KB.</div>
            </div>
            <button type="submit" data-qa-selector="save_naming_topics_avatar_button"
              className="gl-button btn btn-md btn-confirm gl-mt-6">Save changes</button>
          </form>
        </Section>
      ) : null}

      {matches('Visibility, project features, permissions') ? (
        <Section id="js-shared-permissions" className="sharing-permissions"
          qa="visibility_features_permissions_content"
          title="Visibility, project features, permissions"
          description="Choose visibility level, enable/disable project features and their permissions, disable email notifications, and show default award emoji.">
          <form id="reduce-visibility-form" className="sharing-permissions-form" onSubmit={saveVisibility}>
            <div className="project-visibility-setting gl-mb-5" style={{ border: '1px solid var(--border-default)', padding: 12 }}>
              <label className="label-bold">Project visibility</label>
              <span className="text-muted gl-display-block gl-mb-2">
                Manage who can see the project in the public access directory.{' '}
                <a href="/help/user/public_access">Learn more</a>.
              </span>
              <select className="form-control select-control" name="project[visibility_level]"
                data-qa-selector="project_visibility_dropdown"
                value={visibility} onChange={e => setVisibility(e.target.value)}>
                {VISIBILITY_SELECT.map(([v, , label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <span className="gl-display-block gl-text-gray-500 gl-mt-2">
                {(VISIBILITY_SELECT.find(v => v[0] === visibility) || VISIBILITY_SELECT[2])[3]}
              </span>
              <div className="gl-mt-4">
                <strong className="gl-display-block">Additional options</strong>
                <label className="gl-font-weight-normal gl-mb-0">
                  <input type="checkbox" checked={requestAccess}
                    onChange={e => setRequestAccess(e.target.checked)} />
                  {' '}Users can request access
                </label>
              </div>
            </div>

            <div className="gl-mb-5" style={{ border: '1px solid var(--border-default)', borderTop: 0, background: 'var(--gray-10)' }}>
              {FEATURE_ROWS.map(row => (
                <div className={`project-feature-row${row.child ? ' project-feature-setting-group' : ''}`}
                  key={row.key} style={{ padding: '12px 16px', paddingLeft: row.child ? 40 : 16 }}
                  data-testid={row.key === 'package_registry' ? 'package-registry-access-level' : undefined}>
                  <label className="label-bold">{row.label}</label>
                  <span className="text-muted gl-display-block">
                    {row.description}
                    {row.help ? <> <a href={row.help}>Learn more</a>.</> : null}
                  </span>
                  <div className="project-feature-controls gl-display-flex gl-align-items-center gl-my-3">
                    {!row.noToggle ? (
                      <label className="gl-mb-0 gl-mr-3">
                        <input type="checkbox"
                          checked={!features[row.key] || features[row.key].enabled !== false}
                          onChange={e => setFeature(row.key, { enabled: e.target.checked })}
                          aria-label={row.label} data-testid="toggle-label" />
                      </label>
                    ) : null}
                    {row.select ? (
                      <select className="form-control project-repo-select select-control"
                        style={{ maxWidth: 260 }}
                        value={(features[row.key] || {}).level || String(row.level || '20')}
                        onChange={e => setFeature(row.key, { level: e.target.value })}
                        name={`project[project_feature_attributes][${row.key}_access_level]`}>
                        <option value="10">Only Project Members</option>
                        <option value="20">Everyone With Access</option>
                      </select>
                    ) : null}
                  </div>
                </div>
              ))}
              <div className="project-feature-row mb-3" style={{ padding: '12px 16px' }}>
                <label className="js-emails-disabled">
                  <input type="checkbox" /> Disable email notifications
                </label>
                <span className="form-text text-muted">Override user notification preferences for all project members.</span>
              </div>
              <div className="project-feature-row mb-3" style={{ padding: '12px 16px' }}>
                <label>
                  <input type="checkbox" defaultChecked
                    name="project[project_setting_attributes][show_default_award_emojis]" /> Show default award emojis
                </label>
                <p className="help-text">Always show thumbs-up and thumbs-down award emoji buttons on issues, merge requests, and snippets.</p>
              </div>
              <div className="project-feature-row gl-mb-5" style={{ padding: '12px 16px' }}>
                <label>
                  <input type="checkbox"
                    name="project[project_setting_attributes][warn_about_potentially_unwanted_characters]" /> Warn about Potentially Unwanted Characters
                </label>
                <p className="help-text">Highlight the usage of hidden unicode characters. These have innocent uses for right-to-left languages, but can also be used in potential exploits.</p>
              </div>
            </div>

            <button type="submit" data-testid="project-features-save-button"
              data-qa-selector="visibility_features_permissions_save_button"
              className="btn btn-confirm btn-md gl-button">Save changes</button>
          </form>
        </Section>
      ) : null}

      {mrAlert ? (
        <section className="settings expanded">
          <div className="gl-alert gl-alert-info">
            <div className="gl-alert-content">
              <h4 className="gl-alert-title gl-mt-0 gl-mb-2">Merge requests and approvals settings have moved.</h4>
              <div className="gl-alert-body">
                On the left sidebar, select{' '}
                <a href={`${base}/-/settings/merge_requests`}>Settings &gt; Merge requests</a> to view them.
              </div>
            </div>
            <button type="button" aria-label="Dismiss" onClick={() => setMrAlert(false)}
              className="btn gl-dismiss-btn btn-default btn-sm gl-button btn-default-tertiary btn-icon">×</button>
          </div>
        </section>
      ) : null}

      {matches('Badges') ? (
        <Section title="Badges" qa="badges_settings_content"
          description="Customize this project's badges.">
          <form className="gl-mt-3 gl-mb-3 needs-validation" data-testid="add-new-badge"
            onSubmit={e => {
              e.preventDefault()
              if (!badgeLink || !badgeImage) return
              setBadges(b => [...b, { name: badgeName, link: badgeLink, image: badgeImage }])
              setBadgeName(''); setBadgeLink(''); setBadgeImage('')
            }}>
            <div className="form-group">
              <label className="label-bold" htmlFor="badge-name">Name</label>
              <input id="badge-name" className="form-control gl-form-input" data-qa-selector="badge_name_field"
                value={badgeName} onChange={e => setBadgeName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label-bold" htmlFor="badge-link-url">Link</label>
              <input id="badge-link-url" type="url" required className="form-control gl-form-input"
                data-qa-selector="badge_link_url_field"
                value={badgeLink} onChange={e => setBadgeLink(e.target.value)} />
              <div className="form-text text-muted">
                Supported <a href="/help/user/project/badges">variables</a>: %&#123;project_path&#125;,
                %&#123;project_title&#125;, %&#123;project_name&#125;, %&#123;project_id&#125;,
                %&#123;default_branch&#125;, %&#123;commit_sha&#125;
              </div>
            </div>
            <div className="form-group">
              <label className="label-bold" htmlFor="badge-image-url">Badge image URL</label>
              <input id="badge-image-url" type="url" required className="form-control gl-form-input"
                data-qa-selector="badge_image_url_field"
                value={badgeImage} onChange={e => setBadgeImage(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="label-bold">Badge image preview</label>
              <div id="badge-preview" data-qa-selector="badge_image_link">
                {badgeImage ? badgeImage : 'No image to preview'}
              </div>
            </div>
            <button type="submit" data-qa-selector="add_badge_button"
              className="btn gl-button btn-confirm btn-md">Add badge</button>
          </form>

          <div className="card gl-mt-5" style={{ border: '1px solid var(--border-default)', borderRadius: 4 }}>
            <div className="card-header" style={{ padding: 12, borderBottom: '1px solid var(--border-default)' }}>
              Your badges
              <span className="badge badge-muted badge-pill gl-badge sm gl-ml-2">{badges.length}</span>
            </div>
            <div style={{ padding: 12 }}>
              {badges.length
                ? <ul className="list-unstyled">{badges.map((b, i) => <li key={i}>{b.name || b.link}</li>)}</ul>
                : 'This project has no badges'}
            </div>
          </div>
        </Section>
      ) : null}

      {matches('Service Desk') ? (
        <Section id="js-service-desk" title="Service Desk" qa="service_desk_settings_content"
          description="Enable and disable Service Desk. Some additional configuration might be required.">
          {serviceDeskOpen ? (
            <section className="gl-banner js-service-desk-callout" id="promote_service_desk">
              <h1 className="gl-banner-title" style={{ fontSize: 18 }}>Improve customer support with Service Desk</h1>
              <p>
                Service Desk allows people to create issues in your GitLab instance without their own
                user account. It provides a unique email address for end users to create issues in a
                project. Replies can be sent either through the GitLab interface or by email. End
                users only see threads through email.
              </p>
              <a className="btn btn-md btn-confirm gl-button js-close-callout"
                href="/help/user/project/service_desk.html#configuring-service-desk">Configure Service Desk</a>
              <button type="button" aria-label="Dismiss Service Desk promotion"
                className="btn gl-dismiss-btn btn-default btn-sm gl-button btn-default-tertiary btn-icon"
                onClick={() => setServiceDeskOpen(false)}>×</button>
            </section>
          ) : null}
        </Section>
      ) : null}

      {matches('Advanced') ? (
        <Section id="js-project-advanced-settings" className="advanced-settings" title="Advanced"
          qa="advanced_settings_content"
          description="Housekeeping, export, archive, change path, transfer, and delete.">
          <div className="sub-section settings-section">
            <h4>Housekeeping</h4>
            <p>
              Runs a number of housekeeping tasks within the current repository, such as compressing
              file revisions and removing unreachable objects.{' '}
              <a href="/help/administration/housekeeping">Learn more.</a>
            </p>
            <button type="button" className="btn gl-button btn-default"
              onClick={() => setFlash('Housekeeping successfully started')}>Run housekeeping</button>
          </div>

          <div className="sub-section settings-section" data-qa-selector="export_project_content">
            <h4>Export project</h4>
            <p>
              Export this project with all its related data in order to move it to a new GitLab
              instance. When the exported file is ready, you can download it from this page or from
              the download link in the email notification you will receive. You can then import it
              when creating a new project.{' '}
              <a href="/help/user/project/settings/import_export">Learn more.</a>
            </p>
            <button type="button" className="btn gl-button btn-default" data-qa-selector="export_project_link"
              onClick={() => setFlash('Project export started. A download link will be sent by email and made available on this page.')}>
              Export project
            </button>
          </div>

          <div className="sub-section settings-section">
            <h4 className="warning-title">{project.archived ? 'Unarchive project' : 'Archive project'}</h4>
            <p>
              Archiving the project makes it entirely read-only. It is hidden from the dashboard and
              doesn&apos;t display in searches.{' '}
              <a href="/help/user/project/settings/index#archive-a-project">Learn more.</a>
            </p>
            <button type="button" className="gl-button btn btn-confirm" data-qa-selector="archive_project_link"
              aria-label="Archive project" onClick={archive}>
              {project.archived ? 'Unarchive project' : 'Archive project'}
            </button>
          </div>

          <form className="sub-section rename-repository settings-section" onSubmit={changePath}>
            <h4 className="warning-title">Change path</h4>
            <p>
              A project’s repository name defines its URL (the one you use to access the project via
              a browser) and its place on the file disk where GitLab is installed.{' '}
              <a href="/help/user/project/settings/index#rename-a-repository">Learn more.</a>
            </p>
            <p>Be careful. Renaming a project&apos;s repository can have unintended side effects.</p>
            <div className="form-group">
              <label className="label-bold" htmlFor="project_path">Path</label>
              <div className="input-group">
                <div className="input-group-text">{instanceUrlPrefix(project.namespace.path)}</div>
                <input id="project_path" name="project[path]" data-qa-selector="project_path_field"
                  className="form-control gl-form-input"
                  value={newPath} onChange={e => setNewPath(e.target.value)} />
              </div>
            </div>
            <button type="submit" className="gl-button btn btn-danger" data-qa-selector="change_path_button">
              Change path
            </button>
          </form>

          <div className="sub-section settings-section" data-qa-selector="transfer_project_content">
            <h4 className="danger-title">Transfer project</h4>
            <p>
              Transfer your project into another namespace.{' '}
              <a href="/help/user/project/settings/index#transfer-a-project-to-another-namespace">Learn more.</a>
            </p>
            <p>Don&apos;t have a group? <a href="/groups/new">Create one</a></p>
            <button type="button" disabled data-testid="confirm-danger-button"
              data-qa-selector="transfer_project_button" className="btn btn-danger btn-md gl-button disabled">
              Transfer project
            </button>
          </div>

          <div className="sub-section settings-section">
            <h4 className="danger-title">Delete project</h4>
            <p>
              Deleting the project will delete its repository and all related resources, including
              issues and merge requests.{' '}
              <a href="/help/user/project/settings/index#remove-a-fork-relationship">Learn more.</a>
            </p>
            <p>Deleted projects cannot be restored!</p>
            {confirmDelete ? (
              <div className="gl-alert gl-alert-danger">
                <div className="gl-alert-content">
                  <div className="gl-alert-body">
                    You are going to delete {project.full_path}. Deleted projects CANNOT be restored!
                  </div>
                  <div className="gl-alert-actions">
                    <button type="button" className="btn gl-button btn-danger" onClick={deleteProject}>
                      Yes, delete project
                    </button>
                    <button type="button" className="btn gl-button btn-default"
                      onClick={() => setConfirmDelete(false)}>Cancel</button>
                  </div>
                </div>
              </div>
            ) : (
              <button type="button" data-qa-selector="delete_button" className="btn btn-danger btn-md gl-button"
                onClick={() => setConfirmDelete(true)}>Delete project</button>
            )}
          </div>
        </Section>
      ) : null}
    </div>
  )
}
