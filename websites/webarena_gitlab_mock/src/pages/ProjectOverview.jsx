import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import { EntityAvatar } from '../components/layout/Avatar.jsx'
import Icon from '../components/layout/Icon.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { VISIBILITY_TITLES, numberWithDelimiter } from '../utils/format.js'
import { renderMarkdown } from '../utils/markdown.js'
import { getRepoTree, getRepoFile, getCommits, getBranches, getTags } from '../utils/dataManager.js'
import repoLanguages from '../data/repo_languages.json'
import { TreeTable, LastCommitBanner, ReadmeHolder, findReadmeEntry } from './RepoTree.jsx'
import Dropdown from '../components/ui/Dropdown.jsx'
import RefSwitcher from '../components/people/RefSwitcher.jsx'
import { dbStamp } from '../components/create/mutations.js'
import useGo from '../components/create/useGo.js'

// ROUTES #44 — `/:ns/:proj`. assets/README.md §9. Anchor route for ~30 tasks.
//
// ANCHORS on this page:
//   .visibility-icon[title]              webarena-742…756 (verbatim sentence)
//   .home-panel-description-markdown     webarena-750, 751, 755, 756

/**
 * ROUTES #96 / #97 — the `Leave project` / `Request Access` link the source
 * renders inside `.home-panel-metadata`, right of `Project ID: N`. This is
 * `shared/members/_access_request_links.html.haml`, transcribed:
 *
 *   member of the project        -> Leave project      (DELETE …/-/project_members/leave)
 *   already requested access     -> Withdraw Access Request
 *   otherwise                    -> Request Access     (POST   …/-/project_members/request_access)
 *
 * The holder of a personal namespace cannot leave their own project, which is
 * why the source shows neither link on `byteblaze/dotfiles` and
 * `byteblaze/gimmiethat.space` but shows `Leave project` on
 * `a11yproject/a11yproject.com` (Maintainer) and `primer/design` (Developer),
 * and `Request Access` on `vinta/awesome-python`, `root/metaseq` and
 * `CellularPrivacy/Android-IMSI-Catcher-Detector`. Verified against all seven
 * logged-in project-overview captures in assets/html/.
 *
 * `projectpresenter` in the confirm text is not a typo: GitLab builds it with
 * `member_source.class.to_s.humanize` on a `ProjectPresenter`, and the source's
 * own `data-confirm` attribute reads
 * `…leave the "The A11Y Project / a11yproject.com" projectpresenter?`.
 */
function AccessRequestLinks({ project, base }) {
  const { state, currentUser, setState } = useApp()
  const go = useGo()
  const membership = state.members.find(m => m.source_type === 'project'
    && m.source_id === project.id && m.user_id === currentUser.id)
  const isNamespaceHolder = project.namespace.kind !== 'group'
    && project.namespace.path === currentUser.username

  if (membership && !membership.requested_at) {
    if (isNamespaceHolder) return null
    const nameWithNamespace = `${project.namespace.name} / ${project.name}`
    return (
      <span className="gl-ml-3 gl-mb-3">
        <a aria-label="Leave project" className="js-leave-link" rel="nofollow" data-method="delete"
          data-confirm-btn-variant="danger" data-qa-selector="leave_group_link"
          data-confirm={`Are you sure you want to leave the "${nameWithNamespace}" projectpresenter?`}
          href={`${base}/-/project_members/leave`}
          onClick={e => {
            e.preventDefault()
            if (!window.confirm(`Are you sure you want to leave the "${nameWithNamespace}" projectpresenter?`)) return
            setState(prev => ({
              ...prev,
              members: prev.members.filter(m => m.id !== membership.id),
            }))
            go('/dashboard/projects')
          }}>Leave project</a>
      </span>
    )
  }

  if (membership && membership.requested_at) {
    return (
      <span className="gl-ml-3 gl-mb-3">
        <a rel="nofollow" data-method="delete" href={`${base}/-/project_members/leave`}
          data-confirm={`Are you sure you want to withdraw your access request for the ${project.namespace.name} / ${project.name} project?`}
          onClick={e => {
            e.preventDefault()
            setState(prev => ({ ...prev, members: prev.members.filter(m => m.id !== membership.id) }))
          }}>Withdraw Access Request</a>
      </span>
    )
  }

  if (project.request_access_enabled === false) return null
  return (
    <span className="gl-ml-3 gl-mb-3">
      <a rel="nofollow" data-method="post" href={`${base}/-/project_members/request_access`}
        onClick={e => {
          e.preventDefault()
          setState(prev => ({
            ...prev,
            members: [...prev.members, {
              id: Math.max(0, ...prev.members.map(m => m.id || 0)) + 1,
              source_type: 'project',
              source_id: project.id,
              user_id: currentUser.id,
              access_level: 10,
              access_label: 'Guest',
              created_at: dbStamp(),
              requested_at: dbStamp(),
              expires_at: null,
              created_by_id: null,
            }],
          }))
        }}>Request Access</a>
    </span>
  )
}

/** `1 Commit` / `553 Commits`, but always `0 Tags` (assets/README.md §9.4). */
function plural(n, singular, pluralForm) {
  return n === 1 ? singular : (pluralForm || `${singular}s`)
}

/**
 * The licence chip's label. GitLab runs Licensee over the LICENSE blob and
 * labels the chip with what it detects (`MIT License`, `GNU GPLv3`), falling
 * back to the bare filename word when it detects nothing. Licensee is not
 * portable to the browser, so this matches on a licence's own VERBATIM text —
 * an exact substring of the real blob, never a guess — and only when that text
 * starts inside the first 128 characters, i.e. with nothing but a copyright
 * header in front of it. That leading-offset rule is what reproduces Licensee's
 * ~98%-similarity threshold: `amwhalen/archive-my-tweets` prefixes its MIT text
 * with a sentence of prose, and the source labels it plain `LICENSE`.
 *
 * Checked against the live source on all 27 public seeded projects whose
 * LICENSE blob body is in the seed: 27 / 27 exact agreement, including the four
 * that must read `LICENSE`. The GPL/AGPL/LGPL entries use Licensee's NICKNAME
 * (`GNU GPLv3`), which is what the source renders; only `GNU GPLv3` was
 * verifiable here — no seeded project carries the other three.
 */
const LICENSE_PHRASES = [
  ['MIT License', 'Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction'],
  ['Apache License 2.0', 'Apache License Version 2.0, January 2004'],
  ['GNU GPLv3', 'GNU GENERAL PUBLIC LICENSE Version 3, 29 June 2007'],
  ['GNU GPLv2', 'GNU GENERAL PUBLIC LICENSE Version 2, June 1991'],
  ['GNU AGPLv3', 'GNU AFFERO GENERAL PUBLIC LICENSE Version 3, 19 November 2007'],
  ['GNU LGPLv3', 'GNU LESSER GENERAL PUBLIC LICENSE Version 3, 29 June 2007'],
  ['BSD 3-Clause "New" or "Revised" License', 'Neither the name of the copyright holder nor the names of its contributors may be used to endorse'],
  ['Mozilla Public License 2.0', 'Mozilla Public License Version 2.0'],
  ['The Unlicense', 'This is free and unencumbered software released into the public domain'],
  ['Creative Commons Zero v1.0 Universal', 'CC0 1.0 Universal'],
  ['Do What The F*ck You Want To Public License', 'DO WHAT THE FUCK YOU WANT TO PUBLIC LICENSE'],
]

const LICENSE_LEAD = 128

function detectLicense(body) {
  const text = String(typeof body === 'string' ? body : '').replace(/\s+/g, ' ').trim()
  for (const [label, phrase] of LICENSE_PHRASES) {
    const i = text.indexOf(phrase)
    if (i !== -1 && i <= LICENSE_LEAD) return label
  }
  return 'LICENSE'
}

/** `2.7 MB`, `82 KB` — the humanised `Project Storage` figure the source prints
 *  (`project_statistics.storage_size`, carried in the seed as `repo_size`). */
function humanSize(bytes) {
  const b = Number(bytes) || 0
  if (b < 1024) return `${b} B`
  const kb = b / 1024
  if (kb < 1024) return `${Math.round(kb)} KB`
  const mb = kb / 1024
  if (mb < 1024) return `${(Math.round(mb * 10) / 10)} MB`
  return `${(Math.round((mb / 1024) * 10) / 10)} GB`
}

export default function ProjectOverview() {
  const { state, currentUser, setState } = useApp()
  const { project, base } = useProject()

  usePageChrome({
    title: project
      ? `${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  if (!project) return <NotFound />

  const ref = project.default_branch || 'main'
  const vis = project.visibility || 'private'
  const visIcon = vis === 'public' ? 'earth' : vis === 'internal' ? 'shield' : 'lock'

  const isStarred = state.stars.some(s => s.project_id === project.id && s.user_id === currentUser.id)
  const liveStarCount = project.star_count || 0

  // §24.5 — the source renders the instance host in BOTH clone URLs
  // (`ssh://git@10.186.197.203:2222/<ns>/<proj>.git`,
  // `http://10.186.197.203:8023/<ns>/<proj>.git`) and WebArena substitutes
  // `__GITLAB_SSH__` / `__GITLAB__` into the *reference* answer at eval time.
  // So the page must show a real host: rendering the literal `__GITLAB_SSH__`
  // hands the agent the evaluator's own placeholder, which is then compared
  // against the substituted reference and never matches (webarena-293…297).
  // Both are derived from wherever the mock is actually served; only the SSH
  // port is fixed, because it is the git daemon's, not the web server's.
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const host = typeof window !== 'undefined' ? window.location.hostname : ''
  const sshCloneUrl = `ssh://git@${host}:2222/${project.full_path}.git`
  const httpCloneUrl = `${origin}/${project.full_path}.git`

  const tree = getRepoTree(state, project, ref)
  const commits = getCommits(state, project, ref)
  const branches = getBranches(state, project)
  const tags = getTags(state, project)

  // projects.commit_count is the REAL source total; commits.json only carries
  // the 40 newest (assets/data_model.md §11). Show the real number.
  const commitCount = project.commit_count != null ? project.commit_count : commits.length
  const languages = repoLanguages[String(project.id)] || []

  // README rendered below the tree (§9.10). `findReadmeEntry` is RepoTree's, so
  // the overview and `/-/tree/:ref` pick the same file — including on the two
  // projects that carry both `README` and `README.md` (see its comment).
  const readmeEntry = findReadmeEntry(tree, '')
  const readmeBody = readmeEntry ? getRepoFile(state, project, ref, readmeEntry.path) : undefined
  const findRoot = re => tree.find(e => re.test(e.path) && !e.path.includes('/'))
  const licenseEntry = findRoot(/^licen[cs]e(\.\w+)?$/i)
  const changelogEntry = findRoot(/^changelog(\.\w+)?$/i)
  const contributingEntry = findRoot(/^contributing(\.\w+)?$/i)

  const ctaChips = [
    readmeEntry
      ? { label: 'README', icon: 'doc-text', href: `${base}/-/blob/${ref}/${readmeEntry.path}` }
      : { label: 'Add README', dashed: true, href: `${base}/-/new/${ref}?commit_message=Add+README.md&file_name=README.md` },
    licenseEntry
      ? { label: detectLicense(getRepoFile(state, project, ref, licenseEntry.path)),
        license: true, icon: 'document-lines', href: `${base}/-/blob/${ref}/${licenseEntry.path}` }
      : { label: 'Add LICENSE', dashed: true, href: `${base}/-/new/${ref}?commit_message=Add+LICENSE&file_name=LICENSE` },
    changelogEntry
      ? { label: 'CHANGELOG', icon: 'doc-text', href: `${base}/-/blob/${ref}/${changelogEntry.path}` }
      : { label: 'Add CHANGELOG', dashed: true, href: `${base}/-/new/${ref}?commit_message=Add+CHANGELOG&file_name=CHANGELOG` },
    contributingEntry
      ? { label: 'CONTRIBUTING', icon: 'doc-text', href: `${base}/-/blob/${ref}/${contributingEntry.path}` }
      : { label: 'Add CONTRIBUTING', dashed: true, href: `${base}/-/new/${ref}?commit_message=Add+CONTRIBUTING&file_name=CONTRIBUTING.md` },
    // TEST.md DIFF-1308 — the source shows this quick link on SOME projects and
    // hides it on the rest; the mock showed it on all 175. It was measured, not
    // guessed: every seeded project's overview was fetched from the source and
    // checked for the string. 99 carry it, 76 do not.
    //
    // It is deliberately NOT keyed off `auto_devops_enabled`. That field is a
    // tri-state (`false` = an explicit `project_auto_devops` opt-out row on 67
    // projects, absent = inherits the instance default) and `Layout.jsx` reads
    // it for the Auto DevOps *banner*. All 67 explicit opt-outs do hide the
    // quick link, but 9 of the 108 that inherit ON also hide it and only 4 of
    // those 9 are explained by `empty_repo` / `builds_enabled` / `has_ci_config`.
    // Deriving the link from the banner field would therefore be wrong on five
    // projects, so the rendered fact gets its own measured field.
    ...(project.auto_devops_quick_link
      ? [{ label: 'Auto DevOps enabled', icon: 'settings', href: `${base}/-/settings/ci_cd#autodevops-settings` }]
      : []),
    { label: 'Add Kubernetes cluster', dashed: true, href: `${base}/-/clusters` },
    { label: 'Configure Integrations', icon: 'settings', href: `${base}/-/settings/integrations` },
  ]

  function toggleStar() {
    setState(prev => {
      const has = prev.stars.some(s => s.project_id === project.id && s.user_id === currentUser.id)
      const stars = has
        ? prev.stars.filter(s => !(s.project_id === project.id && s.user_id === currentUser.id))
        : [...prev.stars, { project_id: project.id, user_id: currentUser.id, created_at: dbStamp() }]
      return {
        ...prev,
        stars,
        projects: prev.projects.map(p => (p.id === project.id
          ? { ...p, star_count: Math.max(0, (p.star_count || 0) + (has ? -1 : 1)) } : p)),
      }
    })
  }

  return (
    <div>
      <div className="project-home-panel js-show-on-project-root gl-my-5">
        <div className="gl-display-flex gl-justify-content-space-between gl-flex-wrap gl-mb-3" style={{ gap: 20 }}>
          <div className="home-panel-title-row gl-display-flex gl-align-items-center">
            <div className="avatar-container rect-avatar s64 home-panel-avatar gl-flex-shrink-0 gl-mr-3! float-none">
              <EntityAvatar entity={project} size={64} kind="project" />
            </div>
            <div>
              <h1 className="home-panel-title gl-font-size-h1 gl-mt-3 gl-mb-2 gl-display-flex"
                data-qa-selector="project_name_content" itemProp="name">
                {project.name}
                <span className="visibility-icon gl-text-secondary has-tooltip gl-ml-2"
                  data-container="body" title={VISIBILITY_TITLES[vis]}>
                  <Icon name={visIcon} className="icon" />
                </span>
              </h1>
              <div className="home-panel-metadata gl-font-sm gl-text-secondary gl-font-base"
                data-qa-selector="project_id_content" itemProp="identifier">
                <span className="gl-display-inline-block">
                  Project ID: {project.id}
                  <button className="btn btn-clipboard gl-button btn-default-tertiary btn-icon btn-sm"
                    title="Copy project ID" aria-label="Copy project ID"
                    data-clipboard-text={String(project.id)} type="button"
                    onClick={() => navigator.clipboard && navigator.clipboard.writeText(String(project.id))}>
                    <Icon name="copy" />
                  </button>
                </span>
                <AccessRequestLinks project={project} base={base} />
                {/* `forkProject()` writes `project.forked_from`; the source
                    renders the parent's full name under the title. */}
                {project.forked_from ? (
                  <span className="gl-display-inline-block gl-vertical-align-middle gl-ml-3">
                    {'Forked from '}
                    <a href={`/${project.forked_from.full_path}`}>
                      {project.forked_from.name_with_namespace || project.forked_from.full_path}
                    </a>
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="project-repo-buttons gl-display-flex gl-align-items-center gl-flex-wrap" style={{ gap: 12 }}>
            <div className="btn-group">
              <button type="button" className="btn gl-button btn-default" onClick={toggleStar}>
                <Icon name="star" /> <span className="gl-button-text">{isStarred ? 'Unstar' : 'Star'}</span>
              </button>
              <a className="btn gl-button btn-default count" href={`${base}/-/starrers`}>{liveStarCount}</a>
            </div>
            <div className="btn-group">
              <a className="btn gl-button btn-default" href={`${base}/-/forks/new`}>
                <Icon name="fork" /> <span className="gl-button-text">Fork</span>
              </a>
              <a className="btn gl-button btn-default count" href={`${base}/-/forks`}>{project.forks_count || 0}</a>
            </div>
          </div>
        </div>

        {/* §9.4 counts row. The source shows Commits / Branches / Tags /
            Project Storage — NOT issue or MR counts — and pluralises for real
            (`1 Commit`, `1 Branch`, but `0 Tags`). Storage is a humanised size. */}
        <nav className="project-stats">
          <ul className="nav gl-gap-5">
            <li className="nav-item">
              <a className="nav-link gl-display-flex gl-align-items-center stat-link" href={`${base}/-/commits/${ref}`}>
                <Icon name="history" className="gl-mr-2 gl-text-gray-500" />
                <strong className="project-stat-value">{numberWithDelimiter(commitCount)}</strong>
                {` ${plural(commitCount, 'Commit')}`}
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link gl-display-flex gl-align-items-center stat-link" href={`${base}/-/branches`}>
                <Icon name="fork" className="gl-mr-2 gl-text-gray-500" />
                <strong className="project-stat-value">{numberWithDelimiter(branches.length)}</strong>
                {` ${plural(branches.length, 'Branch', 'Branches')}`}
              </a>
            </li>
            <li className="nav-item">
              <a className="nav-link gl-display-flex gl-align-items-center stat-link" href={`${base}/-/tags`}>
                <Icon name="star" className="gl-mr-2 gl-text-gray-500" />
                <strong className="project-stat-value">{numberWithDelimiter(tags.length)}</strong>
                {` ${plural(tags.length, 'Tag')}`}
              </a>
            </li>
            <li className="nav-item">
              {/* Not a link on the source — a plain `.stat-text` cell. */}
              <div className="stat-text d-flex align-items-center">
                <Icon name="package" className="gl-mr-2 gl-text-gray-500" />
                <strong className="project-stat-value">{humanSize(project.repo_size)}</strong>
                {' Project Storage'}
              </div>
            </li>
          </ul>
        </nav>

        {/* §9.5 description — ANCHOR */}
        {project.description ? (
          <div className="home-panel-home-desc mt-1">
            <div className="home-panel-description text-break">
              <div className="home-panel-description-markdown read-more-container" itemProp="description"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(project.description) }} />
            </div>
          </div>
        ) : null}
      </div>

      {/* TEST.md DIFF-907 — the language shares strip. Names, colours and
          shares are `repository_languages` × `programming_languages`, frozen in
          `repo_languages.json`; the source renders it right here, below the
          home panel and above the file-browser controls, and omits it entirely
          for a project with no detected language. */}
      {languages.length ? (
        <div className="progress repository-languages-bar js-show-on-project-root">
          {languages.map(([name, color, share]) => (
            <div key={name} className="progress-bar has-tooltip" data-html="true"
              style={{ width: `${share}%`, backgroundColor: color }}
              title={`<span class="repository-language-bar-tooltip-language">${name}</span>&nbsp;<span class="repository-language-bar-tooltip-share">${share.toFixed(1)}%</span>`} />
          ))}
        </div>
      ) : null}

      {/* §9.6 button row above the file browser */}
      <div className="nav-block gl-display-flex gl-align-items-center gl-mb-3" style={{ gap: 8 }}>
        {/* The tree page uses the newer Vue `ref-selector`, whose copy differs
            from the legacy blob/graphs one (assets/README.md §10b.3). */}
        <div className="tree-ref-container gl-display-flex">
          <RefSwitcher project={project} refName={ref} branches={branches} tags={tags}
            destination="tree" title="Select Git revision" searchPlaceholder="Search by Git revision"
            hrefFor={name => `${base}/-/tree/${name}`} />
        </div>
        <span className="gl-ml-2">{project.path} /</span>
        <Dropdown className="dropdown"
          toggleClassName="btn gl-button btn-default gl-dropdown-toggle add-to-tree"
          toggleProps={{ title: 'Add to tree' }}
          toggle={<><Icon name="plus" /><Icon name="chevron-down" /></>}>
          <ul>
            <li><a href={`${base}/-/new/${ref}`}>New file</a></li>
            <li><a href={`${base}/-/edit/${ref}/`}>Upload file</a></li>
            <li><a href={`${base}/-/branches/new`}>New branch</a></li>
            <li><a href={`${base}/-/tags/new`}>New tag</a></li>
          </ul>
        </Dropdown>
        <a className="btn gl-button btn-default gl-ml-auto" href={`${base}/-/find_file/${ref}`}>Find file</a>
        <a className="btn gl-button btn-default"
          href={`/-/ide/project/${project.full_path}/edit/${ref}/-/`}>Web IDE</a>
        {/* §9.7 clone widget. The clone URLs are the `exact_match` answers for
            webarena-293…297, so the menu must actually open and the strings must
            be verbatim. The source renders them in readonly inputs, not as
            text, and derives both from the instance host — never hard-coded. */}
        {/* The source adds `d-none d-md-inline-block`; this stylesheet has
            `.d-none` but no responsive re-show, so it is omitted. */}
        <div className="project-clone-holder">
          <Dropdown className="git-clone-holder js-git-clone-holder dropdown"
            closeOnSelect={false}
            toggleAs="a" toggleClassName="gl-button btn btn-confirm clone-dropdown-btn"
            toggleProps={{ 'data-qa-selector': 'clone_dropdown', id: 'clone-dropdown', 'data-toggle': 'dropdown' }}
            toggle={<><span className="gl-mr-2 js-clone-dropdown-label">Clone</span><Icon name="chevron-down" /></>}
            menuAs="ul"
            menuClassName="dropdown-menu dropdown-menu-large dropdown-menu-selectable clone-options-dropdown dropdown-menu-right"
            menuProps={{ 'data-qa-selector': 'clone_dropdown_content' }}>
            <li className="gl-px-4!">
              <label className="label-bold" htmlFor="ssh_project_clone">Clone with SSH</label>
              <div className="input-group btn-group">
                <input type="text" name="ssh_project_clone" id="ssh_project_clone" readOnly
                  className="js-select-on-focus form-control" aria-label="Repository clone URL"
                  data-qa-selector="ssh_clone_url_content" value={sshCloneUrl} />
                <div className="input-group-append">
                  <button className="btn input-group-text gl-button btn btn-icon btn-default" type="button"
                    title="Copy URL" aria-label="Copy URL" data-clipboard-target="#ssh_project_clone"
                    onClick={() => navigator.clipboard && navigator.clipboard.writeText(sshCloneUrl)}>
                    <Icon name="copy" />
                  </button>
                </div>
              </div>
            </li>
            <li className="pt-2 gl-px-4!">
              <label className="label-bold" htmlFor="http_project_clone">Clone with HTTP</label>
              <div className="input-group btn-group">
                <input type="text" name="http_project_clone" id="http_project_clone" readOnly
                  className="js-select-on-focus form-control" aria-label="Repository clone URL"
                  data-qa-selector="http_clone_url_content" value={httpCloneUrl} />
                <div className="input-group-append">
                  <button className="btn input-group-text gl-button btn btn-icon btn-default" type="button"
                    title="Copy URL" aria-label="Copy URL" data-clipboard-target="#http_project_clone"
                    onClick={() => navigator.clipboard && navigator.clipboard.writeText(httpCloneUrl)}>
                    <Icon name="copy" />
                  </button>
                </div>
              </div>
            </li>
            <li className="divider mt-2" />
            <li className="pt-2 gl-dropdown-item">
              <label className="label-bold gl-px-4!">Open in your IDE</label>
              <a className="dropdown-item open-with-link"
                href={`vscode://vscode.git/clone?url=${encodeURIComponent(sshCloneUrl)}`}>
                <div className="gl-dropdown-item-text-wrapper">Visual Studio Code (SSH)</div>
              </a>
              <a className="dropdown-item open-with-link"
                href={`vscode://vscode.git/clone?url=${encodeURIComponent(httpCloneUrl)}`}>
                <div className="gl-dropdown-item-text-wrapper">Visual Studio Code (HTTPS)</div>
              </a>
            </li>
            {/* The full `git clone …` sentences the exact_match answers use. */}
            <li className="gl-px-4! gl-pb-2 gl-font-sm gl-text-secondary">
              <code className="gl-font-monospace">{`git clone ${sshCloneUrl}`}</code>
            </li>
          </Dropdown>
        </div>
      </div>

      {/* §9.9 CTA chips. Existing artefacts render `btn-default`, missing ones
          `btn-dashed` with an "Add …" label; the Add-LICENSE href is the one
          tasks 411–414 / 736 navigate to. */}
      <div className="project-buttons gl-mb-5 js-show-on-project-root" data-qa-selector="project_buttons">
        <ul className="nav gl-gap-3" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, listStyle: 'none', padding: 0, margin: 0 }}>
          {ctaChips.map(c => (
            <li className="nav-item" key={c.label}>
              {/* Only the licence chip carries `itemprop="license"` and wraps
                  its label in `.project-stat-value` — the source's own markup. */}
              <a className={`nav-link gl-display-flex gl-align-items-center gl-button btn ${c.dashed ? 'btn-dashed' : 'btn-default'}`}
                href={c.href} itemProp={c.license ? 'license' : undefined}>
                <Icon name={c.dashed ? 'plus-square' : c.icon || 'doc-text'} className="gl-mr-2" />
                {c.license ? <span className="project-stat-value">{c.label}</span> : c.label}
              </a>
            </li>
          ))}
        </ul>
      </div>

      <LastCommitBanner commit={commits[0]} project={project} refName={ref} />
      <TreeTable project={project} refName={ref} entries={tree} dirPath="" />

      {/* DIFF-1701 — the source's readme block is byte-identical here and on
          `/-/tree/:ref`, so both mount the one component (RepoTree.jsx). */}
      {readmeBody != null && readmeEntry ? (
        <ReadmeHolder project={project} refName={ref} path={readmeEntry.path} body={readmeBody} />
      ) : null}
    </div>
  )
}
