import React from 'react'
import { useParams, Navigate, useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { getRepoFile, getRepoTree, getCommits, getBranches, getTags } from '../utils/dataManager.js'
import { renderMarkdown } from '../utils/markdown.js'
import { shortSha } from '../utils/format.js'
import RefSwitcher from '../components/people/RefSwitcher.jsx'
import { getTreeLastCommit, commitTitle } from './RepoTree.jsx'

// ROUTES #47 / #49 — `/:ns/:proj/-/blob/:ref/*path` and `/-/blame/…`.
// assets/README.md §10b.
//
// MISSING-BLOB BEHAVIOUR IS LOAD-BEARING (§10b.1). `byteblaze/dotfiles` has no
// LICENSE at main, and the source redirects a missing blob to the tree root
// with the flash `"LICENSE" did not exist on "main"`. Anchors 414/736 are
// POST-conditions: the task adds the file and only then does the grader read
// the blob. So the mock must do both — redirect before, render after.
//
// §10b.7: there is no standalone `Edit` button in 15.7 CE. `Edit` lives inside
// the `Open in Web IDE` split-button menu, and there is no `Lock` button.

const LICENSE_BLURBS = [
  [/MIT License/i, 'MIT License', 'http://choosealicense.com/licenses/mit/'],
  [/Apache License/i, 'Apache License 2.0', 'http://choosealicense.com/licenses/apache-2.0/'],
  [/DO WHAT THE F\w*CK YOU WANT/i, 'Do What The F*ck You Want To Public License', 'http://choosealicense.com/licenses/wtfpl/'],
  [/GNU GENERAL PUBLIC LICENSE/i, 'GNU General Public License v3.0', 'http://choosealicense.com/licenses/gpl-3.0/'],
  [/BSD/i, 'BSD License', 'http://choosealicense.com/licenses/bsd-3-clause/'],
]

/** §10b.7 — `483 bytes`, `1.04 KiB`, `9.42 KiB`. Binary prefixes, 2 decimals. */
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KiB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MiB`
}

export default function RepoBlob({ blame = false }) {
  const params = useParams()
  const location = useLocation()
  const { state } = useApp()
  const { project, base } = useProject()
  const refName = params.ref
  const path = params['*'] || ''

  usePageChrome({
    title: project
      ? `${path.split('/').pop()} · ${refName} · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
  })

  if (!project) return <NotFound />

  const body = getRepoFile(state, project, refName, path)
  const tree = getRepoTree(state, project, refName)
  const entry = tree.find(e => e.path === path)

  // §10b.1 — a path that is not a blob at this ref redirects to the tree root
  // and flashes `"{path}" did not exist on "{ref}"`.
  if (body === undefined && !entry) {
    const p = new URLSearchParams(location.search)
    p.set('flash_notice', `"${path}" did not exist on "${refName}"`)
    return <Navigate to={`${base}/-/tree/${refName}?${p.toString()}`} replace />
  }

  const name = path.split('/').pop()
  const isMarkdown = /\.(md|markdown)$/i.test(name)
  const dirs = path.split('/').slice(0, -1)
  const lines = typeof body === 'string' ? body.split('\n') : []
  const size = typeof body === 'string'
    ? new TextEncoder().encode(body).length
    : (entry && entry.size) || 0

  // §10b — the commit well shows the newest commit touching THIS path, not the
  // repo tip. Verified live: /byteblaze/dotfiles/-/blob/main/.gitignore shows
  // 6543937b "Update .gitignore" while the tip is 218b5e72.
  // tree_last_commits.json (assets/data_model.md §11) resolves it; the tip is
  // only the fallback for a path the seed does not cover.
  const refCommit = getCommits(state, project, refName)[0]
  const lastCommit = getTreeLastCommit(state, project, refName, path, entry) || refCommit
  const license = typeof body === 'string' && /^LICENSE/i.test(name)
    ? LICENSE_BLURBS.find(([re]) => re.test(body))
    : null

  return (
    <div id="tree-holder" className="tree-holder">
      <div className="nav-block gl-display-flex gl-align-items-center gl-my-3" style={{ gap: 8 }}>
        <div className="tree-ref-container">
          <RefSwitcher project={project} refName={refName} path={path} destination="blob"
            branches={getBranches(state, project)} tags={getTags(state, project)}
            hrefFor={r => `${base}/-/blob/${r}/${path}`} />
        </div>
        <ul className="breadcrumb repo-breadcrumb list-unstyled gl-display-flex gl-mb-0" style={{ gap: 4 }}>
          <li className="breadcrumb-item"><a href={`${base}/-/tree/${refName}`}>{project.path}</a></li>
          {dirs.map((c, i) => (
            <li className="breadcrumb-item" key={c + i}>{' / '}
              <a href={`${base}/-/tree/${refName}/${dirs.slice(0, i + 1).join('/')}`}>{c}</a></li>
          ))}
          <li className="breadcrumb-item">{' / '}
            <a href={`${base}/-/blob/${refName}/${path}`}><strong>{name}</strong></a></li>
        </ul>
        {/* §10b.4 — exactly these four, in this order. */}
        <div className="tree-controls gl-children-ml-sm-3 gl-ml-auto gl-display-flex" style={{ gap: 8 }}>
          <a className="gl-button btn btn-default shortcuts-find-file" href={`${base}/-/find_file/${refName}`}>Find file</a>
          <a className="gl-button btn btn-default js-blob-blame-link" href={`${base}/-/blame/${refName}/${path}`}>Blame</a>
          <a className="gl-button btn btn-default" href={`${base}/-/commits/${refName}/${path}`}>History</a>
          {/* Permalink pins the REF's current commit, not the path's last one.
              Verified live: /byteblaze/dotfiles/-/blob/main/.gitignore last
              changed in 6543937b but permalinks to the tip 218b5e72. */}
          <a className="gl-button btn btn-default js-data-file-blob-permalink-url"
            href={`${base}/-/blob/${refCommit ? refCommit.sha : refName}/${path}`}>Permalink</a>
        </div>
      </div>

      {lastCommit ? (
        // Source: `class="info-well d-none d-sm-block"`. global.css defines
        // `.d-none` with no media queries, so `d-none` here hid the whole
        // commit well at every width — see DEV.r3-seed.md.
        <div className="info-well d-sm-block">
          <div className="well-segment">
            <ul className="blob-commit-info list-unstyled gl-mb-0">
              <li className="commit flex-row" id={`commit-${shortSha(lastCommit.sha)}`}>
                <div className="commit-detail gl-display-flex gl-justify-content-space-between gl-align-items-flex-start">
                  <div className="commit-content" data-qa-selector="commit_content">
                    <a className="commit-row-message item-title" href={`${base}/-/commit/${lastCommit.sha}`}>
                      {commitTitle(lastCommit.title)}
                    </a>
                    <div className="committer">
                      <a className="commit-author-link" href={`mailto:${lastCommit.author_email}`}>
                        {lastCommit.author_name}
                      </a>
                      {' authored '}<TimeAgo value={lastCommit.authored_date} />
                    </div>
                  </div>
                  <div className="commit-actions flex-row">
                    <div className="commit-sha-group btn-group d-sm-flex">
                      <div className="label label-monospace monospace">{shortSha(lastCommit.sha)}</div>
                      <button type="button" className="btn gl-button btn-default btn-icon"
                        title="Copy commit SHA" aria-label="Copy commit SHA"
                        data-clipboard-text={lastCommit.sha}
                        onClick={() => navigator.clipboard && navigator.clipboard.writeText(lastCommit.sha)}>
                        <Icon name="copy" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            </ul>
          </div>
        </div>
      ) : null}

      {/* §10b.6 — the licence summary strip. */}
      {license ? (
        <div className="well-segment blob-auxiliary-viewer">
          <div className="blob-viewer">
            <Icon name="book" className="gl-mr-2" data-testid="scale-icon" />
            {'This project is licensed under the '}<strong>{license[1]}</strong>{'. '}
            <a href={license[2]}>Learn more</a>
          </div>
        </div>
      ) : null}

      <div id="blob-content-holder" className="blob-content-holder">
        <div className="file-holder" style={{ border: '1px solid var(--border-default)', borderRadius: 4 }}>
          <div className="js-file-title file-title-flex-parent gl-display-flex gl-align-items-center"
            style={{ padding: '8px 12px', borderBottom: '1px solid var(--border-default)', gap: 8 }}>
            <div className="file-header-content d-flex align-items-center lh-100" style={{ gap: 8 }}>
              <Icon name="document-lines" />
              <strong className="file-title-name mr-1 js-blob-header-filepath"
                data-qa-selector="file_title_content">{name}</strong>
              <button type="button" title="Copy file path" aria-label="Copy file path"
                className="btn btn-default btn-md gl-button btn-default-tertiary btn-icon btn-clipboard"
                data-clipboard-text={JSON.stringify({ text: path, gfm: `\`${path}\`` })}
                onClick={() => navigator.clipboard && navigator.clipboard.writeText(path)}>
                <Icon name="copy" />
              </button>
              <small className="gl-mr-3">{formatFileSize(size)}</small>
            </div>

            <div className="gl-display-flex gl-flex-wrap file-actions gl-ml-auto" style={{ gap: 4 }}>
              {/* §10b.7 — the split button IS the edit affordance. */}
              <div className="dropdown b-dropdown gl-dropdown btn-group" id="web-ide-link"
                data-qa-selector="action_dropdown">
                <a className="btn btn-confirm btn-md gl-button split-content-button"
                  href={`/-/ide/project/${project.full_path}/edit/${refName}/-/${path}`}>
                  <span className="gl-dropdown-button-text" data-qa-selector="web_ide_button"
                    data-track-label="web_ide">Open in Web IDE</span>
                </a>
                <a className="btn btn-confirm btn-md gl-button" data-testid="action_edit"
                  data-qa-selector="edit_menu_item" href={`${base}/-/edit/${refName}/${path}`}>Edit</a>
              </div>
              <div className="btn-group" role="group">
                <a className="btn btn-default btn-md gl-button" data-testid="replace"
                  href={`${base}/-/edit/${refName}/${path}?replace=1`}>Replace</a>
                <a className="btn btn-default btn-md gl-button" data-testid="delete"
                  href={`${base}/-/edit/${refName}/${path}?delete=1`}>Delete</a>
              </div>
              <div className="btn-group" data-qa-selector="default_actions_container" role="group">
                <button type="button" className="btn gl-button btn-default btn-md btn-icon js-copy-blob-source-btn"
                  data-testid="copyContentsButton" data-qa-selector="copy_contents_button"
                  title="Copy file contents" aria-label="Copy file contents"
                  onClick={() => navigator.clipboard && navigator.clipboard.writeText(String(body || ''))}>
                  <Icon name="copy" />
                </button>
                <a className="btn gl-button btn-default btn-md btn-icon" title="Open raw" aria-label="Open raw"
                  href={`${base}/-/raw/${refName}/${path}`}><Icon name="doc-text" /></a>
                <a className="btn gl-button btn-default btn-md btn-icon" title="Download" aria-label="Download"
                  href={`${base}/-/raw/${refName}/${path}?inline=false`}><Icon name="doc-text" /></a>
              </div>
            </div>
          </div>

          {body === undefined || body === null ? (
            /* assets/data_model.md §14 — a path in repo_trees.json with no body
               in repo_files.json renders the source's placeholder, not an error. */
            <div className="file-content code" style={{ padding: 24, textAlign: 'center' }}>
              <p className="gl-text-gray-500">This file is not displayed because it is too large or is binary.</p>
              <a className="btn gl-button btn-default" href={`${base}/-/raw/${refName}/${path}?inline=false`}>Download</a>
            </div>
          ) : isMarkdown ? (
            <div className="blob-viewer js-syntax-highlight">
              <div className="file-content md" style={{ padding: 16 }}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
            </div>
          ) : (
            /* §10b.8 — one row per source line, `#L{n}` / `#LC{n}` targetable. */
            <div className="file-content code js-syntax-highlight blob-content white"
              data-qa-selector="blob_viewer_file_content" style={{ display: 'flex' }}>
              <div className="line-numbers diff-line-num line-links gl-text-gray-400 gl-text-right"
                style={{ padding: '10px 8px', userSelect: 'none', fontFamily: 'var(--font-mono)', fontSize: 12, borderRight: '1px solid var(--border-light)' }}>
                {lines.map((_, i) => (
                  <a key={i} className="file-line-num gl-user-select-none" id={`L${i + 1}`} href={`#L${i + 1}`}
                    style={{ display: 'block' }}>{i + 1}</a>
                ))}
              </div>
              <pre className="code highlight" style={{ padding: '10px 12px', overflowX: 'auto', flex: 1, margin: 0 }}>
                <code>
                  {lines.map((l, i) => (
                    <span className="line" id={`LC${i + 1}`} data-testid="content" key={i}
                      style={{ display: 'block' }}>{l}</span>
                  ))}
                </code>
              </pre>
            </div>
          )}
        </div>
      </div>

      {blame ? (
        <p className="gl-text-gray-500 gl-mt-3">
          Blame information is derived from the repository history; this instance shows the file
          contents and its most recent commit above.
        </p>
      ) : null}
    </div>
  )
}
