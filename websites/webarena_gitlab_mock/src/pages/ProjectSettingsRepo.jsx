import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { Section } from './ProjectSettingsGeneral.jsx'
import { getBranches, getTags } from '../utils/dataManager.js'
import { useProjectSettings } from './projectSettingsStore.js'

// ---------------------------------------------------------------------------
// ROUTES #99 — `/:ns/:proj/-/settings/repository`  (P1)
//
// Every heading, description, help-link href, placeholder, empty state and
// button label below was read off the logged-in source capture
// `assets/html/r4-set-repo.html` (byteblaze/dotfiles). Section ids match the
// source's (`branch-defaults-settings`, `js-push-remote-settings`,
// `js-protected-branches-settings`, `js-protected-tags-settings`,
// `js-deploy-tokens`, `js-deploy-keys-settings`, `cleanup`) because the source
// links to them with `?update_section=` anchors.
//
// Nothing here is invented. Where the source shows an empty state — no
// mirrors, no protected tags, no deploy tokens, no deploy keys — the mock
// shows that same empty state, and the form above it works, so submitting one
// replaces the empty state with a real row.
// ---------------------------------------------------------------------------

const ACCESS_LEVELS = ['Maintainers', 'Developers + Maintainers', 'No one']

function Help({ href, children }) {
  return <a href={href} rel="noopener noreferrer">{children}</a>
}

/** The `.form-text.text-muted` help line every GitLab settings input carries. */
function Hint({ children }) {
  return <span className="form-text text-muted">{children}</span>
}

// --- Branch defaults -------------------------------------------------------

function BranchDefaults({ project, settings, patch }) {
  const { setState } = useApp()
  const [branch, setBranch] = useState(project.default_branch || 'main')
  const [open, setOpen] = useState(false)
  const [template, setTemplate] = useState(settings.branchNameTemplate)
  const [autoclose, setAutoclose] = useState(settings.autocloseReferencedIssues)
  const [saved, setSaved] = useState(false)
  const { state } = useApp()

  const branches = getBranches(state, project).map(b => b.name)
  const options = branches.length ? branches : [project.default_branch || 'main']

  function save(e) {
    e.preventDefault()
    setState(prev => ({
      ...prev,
      projects: prev.projects.map(p => (p.id === project.id ? { ...p, default_branch: branch } : p)),
    }))
    patch({ branchNameTemplate: template, autocloseReferencedIssues: autoclose })
    setSaved(true)
  }

  return (
    <Section id="branch-defaults-settings" title="Branch defaults"
      description="Select the default branch for this project, and configure the template for branch names.">
      <form onSubmit={save}>
        {saved ? <div className="gl-alert gl-alert-info"><div className="gl-alert-content">
          <div className="gl-alert-body">Project settings were successfully updated.</div>
        </div></div> : null}
        <div className="form-group">
          <h5 className="gl-mt-0">Default branch</h5>
          <span className="form-text text-muted gl-mb-3">
            All merge requests and commits are made against this branch unless you specify a different one.
          </span>
          <div className={`gl-dropdown dropdown${open ? ' show' : ''}`}>
            <button type="button" className="gl-button btn btn-default gl-dropdown-toggle"
              aria-label="Select default branch" onClick={() => setOpen(v => !v)}>
              <span className="gl-dropdown-button-text">{branch}</span>
              <Icon name="chevron-down" />
            </button>
            {open ? (
              <div className="dropdown-menu show gl-dropdown-menu">
                <div className="gl-dropdown-header"><span className="gl-dropdown-header-top">Select default branch</span></div>
                <ul className="gl-dropdown-contents">
                  {options.map(name => (
                    <li key={name} className={`gl-dropdown-item${name === branch ? ' is-active' : ''}`}>
                      <button type="button" className="dropdown-item"
                        onClick={() => { setBranch(name); setOpen(false); setSaved(false) }}>
                        {name}
                        {name === (project.default_branch || 'main')
                          ? <span className="badge badge-info badge-pill gl-badge sm gl-ml-2">default</span> : null}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>
        <div className="form-group gl-form-checkbox custom-control custom-checkbox">
          <input type="checkbox" className="custom-control-input" id="project_autoclose_referenced_issues"
            checked={autoclose} onChange={e => { setAutoclose(e.target.checked); setSaved(false) }} />
          <label className="custom-control-label" htmlFor="project_autoclose_referenced_issues">
            Auto-close referenced issues on default branch
            <Hint>
              When merge requests and commits in the default branch close, any issues they reference also close.
              {' '}
              <Help href="/help/user/project/issues/managing_issues.md#closing-issues-automatically">
                <Icon name="question-o" />
              </Help>
            </Hint>
          </label>
        </div>
        <div className="form-group">
          <label htmlFor="project_issue_branch_template">Branch name template</label>
          <Hint>Branches created from issues follow this pattern.</Hint>
          <input type="text" className="form-control gl-form-input" id="project_issue_branch_template"
            value={template} maxLength={255}
            onChange={e => { setTemplate(e.target.value); setSaved(false) }} />
          <Hint>Leave empty to use default template.</Hint>
          <Hint>Maximum 255 characters.</Hint>
          <Hint>
            <Help href="/help/user/project/repository/web_editor.md#create-a-new-branch-from-an-issue">
              What variables can I use?
            </Help>
          </Hint>
        </div>
        <button type="submit" className="gl-button btn btn-confirm">Save changes</button>
      </form>
    </Section>
  )
}

// --- Mirroring repositories ------------------------------------------------

function Mirroring({ settings, patch }) {
  const [url, setUrl] = useState('')
  const [direction, setDirection] = useState('Push')
  const [auth, setAuth] = useState('Password')
  const [password, setPassword] = useState('')
  const [hostKeys, setHostKeys] = useState('')
  const [manualKeys, setManualKeys] = useState(false)
  const [divergent, setDivergent] = useState(false)
  const [protectedOnly, setProtectedOnly] = useState(false)
  const [error, setError] = useState(null)

  function submit(e) {
    e.preventDefault()
    if (!url.trim()) { setError('This field is required.'); return }
    setError(null)
    patch(b => ({
      mirrors: [...b.mirrors, {
        url: url.trim(), direction, auth, keepDivergentRefs: divergent, protectedOnly,
        lastUpdate: 'Never',
      }],
    }))
    setUrl('')
  }

  const mirrors = settings.mirrors
  return (
    <Section id="js-push-remote-settings" title="Mirroring repositories"
      description="Set up your project to automatically push and/or pull changes to/from another repository. Branches, tags, and commits will be synced automatically.">
      <form onSubmit={submit}>
        <p>
          <Help href="/help/user/project/repository/mirror/index.md">How do I mirror repositories?</Help>
        </p>
        <div className="form-group">
          <label htmlFor="project_mirror_url">Git repository URL</label>
          <input type="text" className={`form-control gl-form-input${error ? ' is-invalid' : ''}`}
            id="project_mirror_url" placeholder="https://username:password@gitlab.company.com/group/project.git"
            value={url} onChange={e => setUrl(e.target.value)} />
          {error ? <span className="invalid-feedback" style={{ display: 'block' }}>{error}</span> : null}
        </div>
        <div className="form-text text-muted">
          <p>The repository must be accessible over <code>http://</code>, <code>https://</code>, <code>ssh://</code> or <code>git://</code>.</p>
          <p>When using the <code>http://</code> or <code>https://</code> protocols, please provide the exact URL to the repository. HTTP redirects will not be followed.</p>
          <p>Include the username in the URL if required: <code>https://username@gitlab.company.com/group/project.git</code>.</p>
          <p>The update action will time out after 180 minutes. For big repositories, use a clone/push combination.</p>
          <p>
            Git LFS objects will be synced if LFS is <Help href="/help/topics/git/lfs/index">enabled for the project</Help>.
            Push mirrors will not sync LFS objects over SSH.
          </p>
          <p>In case of pull mirroring, your user will be the author of all events in the activity feed that are the result of an update, like new branches being created or new commits being pushed to existing branches.</p>
        </div>
        <div className="form-group">
          <label htmlFor="mirror_direction">Mirror direction</label>
          <select id="mirror_direction" className="form-control gl-form-select custom-select"
            value={direction} onChange={e => setDirection(e.target.value)}>
            <option>Push</option>
          </select>
        </div>
        <div className="form-group">
          <button type="button" className="gl-button btn btn-default js-detect-host-keys">Detect host keys</button>
          <div className="gl-mt-3">Fingerprints</div>
          <button type="button" className="gl-button btn btn-link js-ssh-host-keys-manual-toggle"
            onClick={() => setManualKeys(v => !v)}>
            {manualKeys ? 'Hide host keys manual input' : 'Input host keys manually'}
          </button>
          {manualKeys ? (
            <div className="form-group gl-mt-3">
              <label htmlFor="mirror_ssh_host_keys">SSH host keys</label>
              <textarea id="mirror_ssh_host_keys" className="form-control gl-form-input" rows={4}
                value={hostKeys} onChange={e => setHostKeys(e.target.value)} />
              <span className="form-text text-muted">This field is required.</span>
            </div>
          ) : null}
        </div>
        <div className="form-group">
          <label htmlFor="mirror_auth_method">Authentication method</label>
          <select id="mirror_auth_method" className="form-control gl-form-select custom-select"
            value={auth} onChange={e => setAuth(e.target.value)}>
            <option>Password</option>
            <option>SSH public key</option>
          </select>
        </div>
        {auth === 'Password' ? (
          <div className="form-group">
            <label htmlFor="mirror_password">Password</label>
            <input type="password" id="mirror_password" className="form-control gl-form-input"
              value={password} onChange={e => setPassword(e.target.value)} />
            <span className="form-text text-muted">This field is required.</span>
          </div>
        ) : null}
        <div className="form-group gl-form-checkbox custom-control custom-checkbox">
          <input type="checkbox" className="custom-control-input" id="mirror_keep_divergent_refs"
            checked={divergent} onChange={e => setDivergent(e.target.checked)} />
          <label className="custom-control-label" htmlFor="mirror_keep_divergent_refs">
            Keep divergent refs
            <Hint>
              Do not force push over diverged refs. After the mirror is created, this setting can only be modified using the API.
              {' '}
              <Help href="/help/user/project/repository/mirror/push.md#keep-divergent-refs">Learn more about this option</Help>
              {' and '}
              <Help href="/help/api/remote_mirrors">the API.</Help>
            </Hint>
          </label>
        </div>
        <div className="form-group gl-form-checkbox custom-control custom-checkbox">
          <input type="checkbox" className="custom-control-input" id="mirror_only_protected_branches"
            checked={protectedOnly} onChange={e => setProtectedOnly(e.target.checked)} />
          <label className="custom-control-label" htmlFor="mirror_only_protected_branches">
            Mirror only protected branches
            <Hint>
              If enabled, only protected branches will be mirrored.
              {' '}
              <Help href="/help/user/project/repository/mirror/index.md#mirror-only-protected-branches">Learn more.</Help>
            </Hint>
          </label>
        </div>
        <button type="submit" className="gl-button btn btn-confirm js-mirror-repository">Mirror repository</button>
      </form>

      <h5 className="gl-mt-6">Mirrored repositories ({mirrors.length})</h5>
      {mirrors.length === 0 ? (
        <div className="gl-text-center gl-p-5">There are currently no mirrored repositories.</div>
      ) : (
        <table className="table b-table gl-table">
          <thead><tr>
            <th>Mirrored repositories</th><th>Direction</th><th>Last update attempt</th><th>Last successful update</th><th />
          </tr></thead>
          <tbody>
            {mirrors.map((m, i) => (
              <tr key={i}>
                <td>{m.url}</td><td>{m.direction}</td><td>{m.lastUpdate}</td><td>{m.lastUpdate}</td>
                <td>
                  <button type="button" className="gl-button btn btn-danger btn-icon" aria-label="Remove"
                    onClick={() => patch(b => ({ mirrors: b.mirrors.filter((_, j) => j !== i) }))}>
                    <Icon name="close" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

// --- Protected branches ----------------------------------------------------

function ProtectedBranches({ project, settings, patch }) {
  const { state } = useApp()
  const [name, setName] = useState('')
  const [merge, setMerge] = useState('Maintainers')
  const [push, setPush] = useState('Maintainers')
  const [forcePush, setForcePush] = useState(false)
  const branches = getBranches(state, project).map(b => b.name)
  const rows = settings.protectedBranches

  function protectBranch(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || rows.some(r => r.name === trimmed)) return
    patch(b => ({
      protectedBranches: [...(b.protectedBranches || []), {
        id: Date.now(), name: trimmed, isDefault: trimmed === project.default_branch, merge, push, forcePush,
      }],
    }))
    setName('')
  }

  return (
    <Section id="js-protected-branches-settings" title="Protected branches"
      description="Keep stable branches secure and force developers to use merge requests.">
      <p>
        <Help href="/help/user/project/protected_branches">What are protected branches?</Help>
      </p>
      <p>
        By default, protected branches restrict who can modify the branch.
        {' '}
        <Help href="/help/user/project/protected_branches#who-can-modify-a-protected-branch">Learn more.</Help>
      </p>
      <form onSubmit={protectBranch}>
        <h4 className="gl-mt-0">Protect a branch</h4>
        <div className="form-group row">
          <label className="col-sm-2 col-form-label" htmlFor="protected_branch_name">Branch:</label>
          <div className="col-sm-10">
            <input list="protected-branch-options" id="protected_branch_name"
              className="form-control gl-form-input" placeholder="Select branch or create wildcard"
              value={name} onChange={e => setName(e.target.value)} />
            <datalist id="protected-branch-options">
              {branches.map(b => <option key={b} value={b} />)}
            </datalist>
            <span className="form-text text-muted">
              <a href="/help/user/project/protected_branches#configure-multiple-protected-branches-by-using-a-wildcard">Wildcards</a>
              {' such as '}<code>*-stable</code>{' or '}<code>production/*</code>{' are supported.'}
            </span>
          </div>
        </div>
        <div className="form-group row">
          <label className="col-sm-2 col-form-label" htmlFor="protected_branch_merge">Allowed to merge:</label>
          <div className="col-sm-10">
            <select id="protected_branch_merge" className="form-control gl-form-select custom-select"
              value={merge} onChange={e => setMerge(e.target.value)}>
              {ACCESS_LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group row">
          <label className="col-sm-2 col-form-label" htmlFor="protected_branch_push">Allowed to push:</label>
          <div className="col-sm-10">
            <select id="protected_branch_push" className="form-control gl-form-select custom-select"
              value={push} onChange={e => setPush(e.target.value)}>
              {ACCESS_LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <div className="form-group row">
          <label className="col-sm-2 col-form-label" htmlFor="protected_branch_force_push">Allowed to force push:</label>
          <div className="col-sm-10">
            <input type="checkbox" id="protected_branch_force_push" aria-label="Allowed to force push"
              checked={forcePush} onChange={e => setForcePush(e.target.checked)} />
            <span className="form-text text-muted">
              Allow all users with push access to
              {' '}<a href="/help/topics/git/git_rebase#force-push">force push</a>.
            </span>
          </div>
        </div>
        <button type="submit" className="gl-button btn btn-confirm">Protect</button>
      </form>

      <table className="table b-table gl-table protected-branches-list gl-mt-5">
        <thead>
          <tr>
            <th>Branch</th>
            <th>Allowed to merge</th>
            <th>Allowed to push</th>
            <th>Allowed to force push</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.id}>
              <td>
                <a href={`/${project.full_path}/-/tree/${row.name}`}>{row.name}</a>
                {row.isDefault ? <span className="badge badge-info badge-pill gl-badge sm gl-ml-2">default</span> : null}
              </td>
              <td>{row.merge}</td>
              <td>{row.push}</td>
              <td>
                <input type="checkbox" aria-label="Toggle allowed to force push" checked={!!row.forcePush}
                  onChange={e => patch(b => ({
                    protectedBranches: (b.protectedBranches || []).map(r => (
                      r.id === row.id ? { ...r, forcePush: e.target.checked } : r)),
                  }))} />
              </td>
              <td>
                <button type="button" className="gl-button btn btn-danger"
                  onClick={() => patch(b => ({
                    protectedBranches: (b.protectedBranches || []).filter(r => r.id !== row.id),
                  }))}>Unprotect</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Section>
  )
}

// --- Protected tags --------------------------------------------------------

function ProtectedTags({ project, settings, patch }) {
  const { state } = useApp()
  const [name, setName] = useState('')
  const [create, setCreate] = useState('Maintainers')
  const tags = getTags(state, project).map(t => t.name)
  const rows = settings.protectedTags

  function protectTag(e) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed || rows.some(r => r.name === trimmed)) return
    patch(b => ({ protectedTags: [...b.protectedTags, { id: Date.now(), name: trimmed, create }] }))
    setName('')
  }

  return (
    <Section id="js-protected-tags-settings" title="Protected tags"
      description="Limit access to creating and updating tags.">
      <p><Help href="/help/user/project/protected_tags">What are protected tags?</Help></p>
      <p>
        By default, protected tags restrict who can modify the tag.
        {' '}
        <Help href="/help/user/project/protected_tags#who-can-modify-a-protected-tag">Learn more.</Help>
      </p>
      <form onSubmit={protectTag}>
        <h4 className="gl-mt-0">Protect a tag</h4>
        <div className="form-group row">
          <label className="col-sm-2 col-form-label" htmlFor="protected_tag_name">Tag:</label>
          <div className="col-sm-10">
            <input list="protected-tag-options" id="protected_tag_name" className="form-control gl-form-input"
              placeholder="Select tag or create wildcard" value={name} onChange={e => setName(e.target.value)} />
            <datalist id="protected-tag-options">{tags.map(t => <option key={t} value={t} />)}</datalist>
            <span className="form-text text-muted">
              <a href="/help/user/project/protected_tags#wildcard-protected-tags">Wildcards</a>
              {' such as '}<code>v*</code>{' or '}<code>*-release</code>{' are supported.'}
            </span>
          </div>
        </div>
        <div className="form-group row">
          <label className="col-sm-2 col-form-label" htmlFor="protected_tag_create">Allowed to create:</label>
          <div className="col-sm-10">
            <select id="protected_tag_create" className="form-control gl-form-select custom-select"
              value={create} onChange={e => setCreate(e.target.value)}>
              {ACCESS_LEVELS.map(l => <option key={l}>{l}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" className="gl-button btn btn-confirm">Protect</button>
      </form>

      <h5 className="gl-mt-5">Protected tags ({rows.length})</h5>
      {rows.length === 0 ? (
        <div className="gl-text-center gl-p-5">No tags are protected.</div>
      ) : (
        <table className="table b-table gl-table">
          <thead><tr><th>Tag</th><th>Allowed to create</th><th /></tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.create}</td>
                <td>
                  <button type="button" className="gl-button btn btn-danger"
                    onClick={() => patch(b => ({ protectedTags: b.protectedTags.filter(r => r.id !== row.id) }))}>
                    Unprotect
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

// --- Deploy tokens ---------------------------------------------------------

const TOKEN_SCOPES = [
  ['read_repository', 'Allows read-only access to the repository.'],
  ['read_package_registry', 'Allows read-only access to the package registry.'],
  ['write_package_registry', 'Allows read and write access to the package registry.'],
]

function DeployTokens({ settings, patch }) {
  const [name, setName] = useState('')
  const [expires, setExpires] = useState('')
  const [username, setUsername] = useState('')
  const [scopes, setScopes] = useState([])
  const [created, setCreated] = useState(null)
  const rows = settings.deployTokens

  function submit(e) {
    e.preventDefault()
    if (!name.trim() || !scopes.length) return
    const token = {
      id: Date.now(),
      name: name.trim(),
      expires_at: expires || null,
      username: username.trim() || `gitlab+deploy-token-${rows.length + 1}`,
      scopes: [...scopes],
    }
    patch(b => ({ deployTokens: [...b.deployTokens, token] }))
    setCreated(token)
    setName(''); setExpires(''); setUsername(''); setScopes([])
  }

  return (
    <Section id="js-deploy-tokens" title="Deploy tokens"
      description="Deploy tokens allow access to packages, your repository, and registry images.">
      {created ? (
        <div className="gl-alert gl-alert-success"><div className="gl-alert-content">
          <div className="gl-alert-body">Your new project deploy token has been created.</div>
        </div></div>
      ) : null}
      <form onSubmit={submit}>
        <h5 className="gl-mt-0">New deploy token</h5>
        <p>
          Create a new deploy token for all projects in this group.
          {' '}
          <Help href="/help/user/project/deploy_tokens/index.md">What are deploy tokens?</Help>
        </p>
        <div className="form-group">
          <label htmlFor="deploy_token_name">Name</label>
          <input type="text" id="deploy_token_name" className="form-control gl-form-input"
            value={name} onChange={e => setName(e.target.value)} />
          <Hint>Enter a unique name for your deploy token.</Hint>
        </div>
        <div className="form-group">
          <label htmlFor="deploy_token_expires_at">Expiration date (optional)</label>
          <input type="date" id="deploy_token_expires_at" className="form-control gl-form-input"
            value={expires} onChange={e => setExpires(e.target.value)} />
          <Hint>Enter an expiration date for your token. Defaults to never expire.</Hint>
        </div>
        <div className="form-group">
          <label htmlFor="deploy_token_username">Username (optional)</label>
          <input type="text" id="deploy_token_username" className="form-control gl-form-input"
            value={username} onChange={e => setUsername(e.target.value)} />
          <Hint>Enter a username for your token. Defaults to <code>gitlab+deploy-token-{'{n}'}</code>.</Hint>
        </div>
        <fieldset className="form-group">
          <legend className="col-form-label">Scopes (select at least one)</legend>
          {TOKEN_SCOPES.map(([scope, help]) => (
            <div key={scope} className="gl-form-checkbox custom-control custom-checkbox">
              <input type="checkbox" className="custom-control-input" id={`deploy_token_${scope}`}
                checked={scopes.includes(scope)}
                onChange={e => setScopes(s => (e.target.checked ? [...s, scope] : s.filter(x => x !== scope)))} />
              <label className="custom-control-label" htmlFor={`deploy_token_${scope}`}>
                {scope}
                <Hint>{help}</Hint>
              </label>
            </div>
          ))}
        </fieldset>
        <button type="submit" className="gl-button btn btn-confirm">Create deploy token</button>
      </form>

      <h5 className="gl-mt-5">Active Deploy Tokens ({rows.length})</h5>
      {rows.length === 0 ? (
        <div className="settings-message text-center">This project has no active Deploy Tokens.</div>
      ) : (
        <table className="table b-table gl-table">
          <thead><tr><th>Name</th><th>Username</th><th>Created</th><th>Expires</th><th>Scopes</th><th /></tr></thead>
          <tbody>
            {rows.map(row => (
              <tr key={row.id}>
                <td>{row.name}</td>
                <td>{row.username}</td>
                <td>just now</td>
                <td>{row.expires_at || 'Never'}</td>
                <td>{row.scopes.join(', ')}</td>
                <td>
                  <button type="button" className="gl-button btn btn-danger"
                    onClick={() => patch(b => ({ deployTokens: b.deployTokens.filter(t => t.id !== row.id) }))}>
                    Revoke
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Section>
  )
}

// --- Deploy keys -----------------------------------------------------------

function DeployKeys({ settings, patch }) {
  const [title, setTitle] = useState('')
  const [key, setKey] = useState('')
  const [write, setWrite] = useState(false)
  const [tab, setTab] = useState('enabled')
  const rows = settings.deployKeys

  function submit(e) {
    e.preventDefault()
    if (!title.trim() || !key.trim()) return
    patch(b => ({
      deployKeys: [...b.deployKeys, { id: Date.now(), title: title.trim(), key: key.trim(), write }],
    }))
    setTitle(''); setKey(''); setWrite(false)
  }

  const TABS = [
    ['enabled', 'Enabled deploy keys', rows.length],
    ['private', 'Privately accessible deploy keys', 0],
    ['public', 'Publicly accessible deploy keys', 0],
  ]
  const visible = tab === 'enabled' ? rows : []

  return (
    <Section id="js-deploy-keys-settings" title="Deploy keys"
      description="Add deploy keys to grant read/write access to this repository.">
      <p><Help href="/help/user/project/deploy_keys/index">What are deploy keys?</Help></p>
      <form onSubmit={submit}>
        <div className="form-group">
          <label htmlFor="deploy_key_title">Title</label>
          <input type="text" id="deploy_key_title" className="form-control gl-form-input"
            value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="deploy_key_key">Key</label>
          <textarea id="deploy_key_key" className="form-control gl-form-input" rows={5}
            value={key} onChange={e => setKey(e.target.value)} />
          <Hint>Paste a public key here.</Hint>
          <Hint><Help href="/help/user/ssh">How do I generate it?</Help></Hint>
        </div>
        <div className="form-group gl-form-checkbox custom-control custom-checkbox">
          <input type="checkbox" className="custom-control-input" id="deploy_key_can_push"
            checked={write} onChange={e => setWrite(e.target.checked)} />
          <label className="custom-control-label" htmlFor="deploy_key_can_push">
            Grant write permissions to this key
            <Hint>Allow this key to push to this repository</Hint>
          </label>
        </div>
        <button type="submit" className="gl-button btn btn-confirm">Add key</button>
      </form>

      <ul className="nav-links gl-tabs-nav gl-mt-5" role="tablist">
        {TABS.map(([id, label, count]) => (
          <li key={id} className={`gl-tab-nav-item${tab === id ? ' gl-tab-nav-item-active' : ''}`} role="presentation">
            <button type="button" className="gl-tab-nav-item" role="tab" onClick={() => setTab(id)}>
              {label}
              <span className="badge badge-muted badge-pill gl-badge sm gl-tab-counter-badge">{count}</span>
            </button>
          </li>
        ))}
      </ul>
      {visible.length === 0 ? (
        <div className="settings-message text-center">No deploy keys found. Create one with the form above.</div>
      ) : (
        <ul className="gl-list-style-none">
          {visible.map(row => (
            <li key={row.id} className="gl-display-flex gl-align-items-center gl-py-3 gl-border-b-1 gl-border-b-solid gl-border-gray-100">
              <span className="gl-flex-grow-1">{row.title}{row.write ? ' (write)' : ''}</span>
              <button type="button" className="gl-button btn btn-danger"
                onClick={() => patch(b => ({ deployKeys: b.deployKeys.filter(k => k.id !== row.id) }))}>Remove</button>
            </li>
          ))}
        </ul>
      )}
    </Section>
  )
}

// --- Repository cleanup ----------------------------------------------------

function RepositoryCleanup() {
  const [file, setFile] = useState('')
  const [started, setStarted] = useState(false)
  return (
    <Section id="cleanup" title="Repository cleanup">
      <p>
        Clean up after running
        {' '}<a href="https://github.com/newren/git-filter-repo" target="_blank" rel="noopener noreferrer">git filter-repo</a>
        {' on the repository.'}
        {' '}
        <Help href="/help/user/project/repository/reducing_the_repo_size_using_git.md"><Icon name="question-o" /></Help>
      </p>
      <form onSubmit={e => { e.preventDefault(); setStarted(true) }}>
        <div className="form-group">
          <label htmlFor="project_bfg_object_map">Upload object map</label>
          <div className="custom-file gl-form-input-group">
            <input type="file" className="custom-file-input" id="project_bfg_object_map"
              onChange={e => setFile(e.target.files && e.target.files[0] ? e.target.files[0].name : '')} />
            <label className="custom-file-label" htmlFor="project_bfg_object_map">
              <span className="gl-button btn btn-default">Choose a file</span>
              <span className="gl-ml-3">{file || 'No file selected'}</span>
            </label>
          </div>
          <Hint>The maximum file size is 100 MB.</Hint>
        </div>
        {started ? (
          <div className="gl-alert gl-alert-info"><div className="gl-alert-content">
            <div className="gl-alert-body">Repository cleanup has started. You will receive an email once the cleanup operation is complete.</div>
          </div></div>
        ) : null}
        <button type="submit" className="gl-button btn btn-confirm">Start cleanup</button>
      </form>
    </Section>
  )
}

// --- Page ------------------------------------------------------------------

export default function ProjectSettingsRepository() {
  const { state } = useApp()
  const { project } = useProject()
  usePageChrome({
    title: project
      // TEST.md DIFF-1103 — `assets/html/proj-settings-repo.html` (and the
      // r4 recapture) both title this `Repository · Settings · …`, matching
      // `/edit`'s `General · Settings · …`. `Repository Settings · …` put the
      // `· Settings ·` segment in a different place from every sibling page.
      ? `Repository · Settings · ${project.namespace.name} / ${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })
  const [settings, patch] = useProjectSettings(project)

  if (!state) return null
  if (!project) return <NotFound />

  return (
    <div className="js-search-settings-section">
      <BranchDefaults project={project} settings={settings} patch={patch} />
      <Mirroring settings={settings} patch={patch} />
      <ProtectedBranches project={project} settings={settings} patch={patch} />
      <ProtectedTags project={project} settings={settings} patch={patch} />
      <DeployTokens settings={settings} patch={patch} />
      <DeployKeys settings={settings} patch={patch} />
      <RepositoryCleanup />
    </div>
  )
}
