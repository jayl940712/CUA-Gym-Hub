import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'
import { getRepoTree, getRepoFile, getCommits, getBranches, getTags, originPath } from '../utils/dataManager.js'
import { shortSha } from '../utils/format.js'
import { renderMarkdown } from '../utils/markdown.js'
import RefSwitcher from '../components/people/RefSwitcher.jsx'
import treeLastCommitsStatic from '../data/tree_last_commits.json'

// ROUTES #45 / #46 — `/:ns/:proj/-/tree/:ref[/*path]`. assets/README.md §10a.
// repo_trees.json is a FLAT blob list; directories are derived by splitting
// each path on `/` (assets/data_model.md §11).
//
// The tree page uses the NEWER Vue ref-selector, whose copy is
// `Select Git revision` / `Search by Git revision` — different from the legacy
// widget on blob / graphs / network (§10b.3).
//
// `?flash_notice=` carries RepoBlob's missing-blob redirect message
// (`"LICENSE" did not exist on "main"`, §10b.1).

/**
 * Newest commit touching `path` at `ref` — what the real site resolves through
 * `/-/refs/<ref>/logs_tree` to fill the tree's `Last commit` / `Last update`
 * cells and the blob page's commit well.
 *
 * Backed by the STATIC seed `src/data/tree_last_commits.json` (assets/data_model.md
 * §11), extracted with `git log -1 -- <path>` against the container's bare
 * repositories. Static reference data, exactly like commits.json /
 * repo_trees.json — never copied into session state.
 *
 * Shape: `{ "<full_path>": { ref, commits: [[sha, title, author_name,
 * author_email, committed_date, authored_date?], …], paths: { "<path>": i } } }`
 * — one commit table per project, paths indexing into it, so a lookup is a
 * single object hit.
 *
 * Two deliberate fallbacks:
 *  - The seed only holds the project's DEFAULT ref, because `getRepoTree` and
 *    `getCommits` are themselves ref-agnostic (they return the default-branch
 *    tree for every ref). Pairing the default-branch rows with a *different*
 *    branch's commits would be less coherent than this, so any ref reuses it.
 *  - A blob created in-session has no seeded commit, but `writeFiles` stamps
 *    its tree entry with the creating commit's short sha, so the matching
 *    record in `commitOverlay` is the real answer and is preferred.
 * Anything else returns null and the cells stay empty — the source is empty
 * there too.
 */
export function getTreeLastCommit(state, project, ref, path, entry) {
  if (!project || !path) return null
  const overlay = (state && state.repo && state.repo.commitOverlay
    && state.repo.commitOverlay[`${project.full_path}:${ref}`]) || []
  if (entry && entry.sha) {
    const made = overlay.find(c => c.sha && c.sha.startsWith(entry.sha))
    if (made) return made
  }
  const rec = treeLastCommitsStatic[originPath(state, project.full_path)]
  const i = rec && rec.paths[path]
  if (i === undefined) return null
  const [sha, title, author_name, author_email, committed_date, authored_date] = rec.commits[i]
  return { sha, title, author_name, author_email, committed_date, authored_date: authored_date || committed_date }
}

/**
 * Tree ordering (TEST.md DIFF-902). Git — and therefore GitLab's tree listing —
 * orders entries by raw BYTE value, so `.nvmrc` < `CODE_OF_CONDUCT.md` <
 * `LICENSE` < `README.md` < `babel-defines.js`: dot-files, then uppercase, then
 * lowercase. `localeCompare` is case-INSENSITIVE and interleaved them
 * (`.nvmrc, babel-defines.js, CODE_OF_CONDUCT.md, …`), which is what the source
 * comparison caught. A plain `<` on the raw name compares UTF-16 code units,
 * which agrees with UTF-8 byte order across the BMP.
 */
function byName(a, b) {
  if (a.name === b.name) return 0
  return a.name < b.name ? -1 : 1
}

/** Collapse a flat blob list into the entries visible at `dirPath`. */
export function entriesAt(tree, dirPath) {
  const prefix = dirPath ? `${dirPath.replace(/\/$/, '')}/` : ''
  const dirs = new Map()
  const blobs = []
  for (const e of tree) {
    if (prefix && !e.path.startsWith(prefix)) continue
    const rest = e.path.slice(prefix.length)
    if (!rest) continue
    const slash = rest.indexOf('/')
    if (slash === -1) {
      blobs.push({ ...e, name: rest })
    } else {
      const name = rest.slice(0, slash)
      if (!dirs.has(name)) dirs.set(name, { name, path: prefix + name, type: 'tree' })
    }
  }
  const dirRows = [...dirs.values()].sort(byName)
  blobs.sort(byName)
  return [...dirRows, ...blobs]
}

/**
 * GitLab's `Commit#title`: the full subject under 100 chars, otherwise
 * Rails' `truncate(100, separator: ' ')` — cut at the last space at or before
 * index 97, plus `...`. Confirmed on the source: a11yproject.com's tip commit
 * "Update the-power-of-chatgpt-as-a-cognitive-accessibility-…-survivors.md"
 * renders as `Update...` in both the tree cell and the last-commit well.
 */
export function commitTitle(title) {
  const t = title || ''
  if (t.length < 100) return t
  const i = t.slice(0, 98).lastIndexOf(' ')
  return `${i > 0 ? t.slice(0, i) : t.slice(0, 97)}...`
}

export function LastCommitBanner({ commit, project }) {
  if (!commit) return null
  return (
    <div className="info-well project-last-commit gl-mb-3"
      style={{ border: '1px solid var(--border-default)', borderRadius: 4, padding: 12 }}>
      <div className="gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
        <a className="commit-row-message gl-font-weight-bold" href={`/${project.full_path}/-/commit/${commit.sha}`}>
          {commitTitle(commit.title)}
        </a>
        <span className="commit-author-link gl-text-gray-500 gl-font-sm">{commit.author_name}</span>
        <span className="gl-text-gray-500 gl-font-sm">
          {'authored '}<TimeAgo value={commit.committed_date} />
        </span>
        <a className="commit-sha gl-font-monospace gl-ml-auto"
          href={`/${project.full_path}/-/commit/${commit.sha}`}>{shortSha(commit.sha)}</a>
      </div>
    </div>
  )
}

/**
 * The README GitLab renders BENEATH the file table, on the project overview and
 * on every `/-/tree/:ref[/*path]` page whose directory contains one.
 * (TEST.md DIFF-1701 / AUDIT.md P2-A — the component existed but was only
 * mounted on the overview.)
 *
 * Markup transcribed verbatim from the container's rendered DOM — the byte
 * range around `readme-holder` in `assets/html/proj-dotfiles-tree-main.html`
 * is character-identical to the one in `assets/html/proj-dotfiles.html`, so
 * ONE component is correct for both mount points:
 *
 *   <article class="file-holder limited-width-container readme-holder">
 *     <div class="js-file-title file-title-flex-parent">
 *       <div class="file-header-content">
 *         <svg data-testid="doc-text-icon" …>
 *         <a href="…/-/blob/<ref>/<path>" class="gl-link"><strong>NAME</strong></a>
 *     <div data-qa-selector="blob_viewer_content" itemprop="about" class="blob-viewer">
 *       <div><div data-rich-type="markup" data-path="<path>" class="blob-viewer">
 *         <div class="file-content md">…rendered markdown…
 *
 * The link text is the BASENAME while `data-path` and the href carry the full
 * repo-relative path — measured on the source at
 * `/kkroening/ffmpeg-python/-/tree/master/examples`, which renders
 * `README.md` linking to `…/-/blob/master/examples/README.md`.
 */
export function ReadmeHolder({ project, refName, path, body }) {
  if (body == null || !path) return null
  const name = path.split('/').pop()
  return (
    <article className="file-holder limited-width-container readme-holder">
      <div className="js-file-title file-title-flex-parent">
        <div className="file-header-content">
          <Icon name="doc-text" />
          {' '}
          <a href={`/${project.full_path}/-/blob/${refName}/${path}`} className="gl-link">
            <strong>{name}</strong>
          </a>
        </div>
      </div>
      <div data-qa-selector="blob_viewer_content" itemProp="about" className="blob-viewer">
        <div>
          <div data-rich-type="markup" data-path={path} className="blob-viewer">
            <div className="file-content md" dangerouslySetInnerHTML={{ __html: renderMarkdown(body) }} />
          </div>
        </div>
      </div>
    </article>
  )
}

/**
 * GitLab's `Repository#readme` — the README of the directory being VIEWED, not
 * the repository root's. Measured on the source:
 *   /kkroening/ffmpeg-python/-/tree/master/examples  ->  examples/README.md
 *   /kkroening/ffmpeg-python/-/tree/master           ->  README.md
 *   /byteblaze/gimmiethat.space/-/tree/main          ->  no holder at all
 *
 * Two projects in the seed carry BOTH `README` and `README.md` at the root
 * (`kkroening/ffmpeg-python`, `DynamoRIO/dynamorio`) and the source renders the
 * `.md` one on all four of their tree/overview pages — GitLab prefers a readme
 * it can render as markup over an extensionless one, so plain `README` sorts
 * last. Tree order alone picked `README` (9 bytes, a stub), which is why this
 * ranks rather than taking the first match.
 */
const README_RE = /^readme(\.(md|markdown|mdown|mkd|rst|txt))?$/i
const README_RANK = name => {
  const ext = (name.split('.')[1] || '').toLowerCase()
  if (!ext) return 2
  return /^(md|markdown|mdown|mkd)$/.test(ext) ? 0 : 1
}

export function findReadmeEntry(tree, dirPath) {
  const prefix = dirPath ? `${dirPath.replace(/\/$/, '')}/` : ''
  let best = null
  for (const e of tree) {
    if (e.type === 'tree' || !e.path.startsWith(prefix)) continue
    const name = e.path.slice(prefix.length)
    if (!README_RE.test(name)) continue
    if (!best || README_RANK(name) < README_RANK(best.path.slice(prefix.length))) best = e
  }
  return best
}

/**
 * The entry plus its body, or `null` when `repo_files.json` has no body for it
 * — the seed is partial by design (assets/data_model.md §14) and half a README
 * is worse than none.
 */
export function findReadme(state, project, refName, dirPath) {
  const entry = findReadmeEntry(getRepoTree(state, project, refName), dirPath)
  if (!entry) return null
  const body = getRepoFile(state, project, refName, entry.path)
  if (body == null) return null
  return { path: entry.path, body }
}

export function TreeTable({ project, refName, entries, dirPath }) {
  const { state } = useApp()
  const rows = entriesAt(entries, dirPath)
  const base = `/${project.full_path}`
  const parent = dirPath ? dirPath.split('/').slice(0, -1).join('/') : null

  return (
    <div className="tree-content-holder">
      <div className="table-holder bordered-box">
        {/* TEST.md DIFF-1104 — the source's class list is exactly
            `table tree-table gl-table-layout-fixed`. The extra `gl-table` the
            mock carried pulled in `.gl-table th/td` (12px headers, 12px cells,
            auto layout), which is what produced 182/685/91 columns and 59px
            rows against the source's 319/319/319 and 42px. */}
        {/* TEST.md DIFF-1104, second half — the source carries
            `gl-table-layout-fixed` only at the repository ROOT. Inside a
            directory the `..` row's `colspan="3"` cell makes a fixed layout
            meaningless, so GitLab drops the class and the table falls back to
            `auto`. Measured read-only on the source at 1280 and 1920:
              /byteblaze/dotfiles/-/tree/main          fixed  319 / 319 / 319
              /byteblaze/dotfiles/-/tree/main/.mackup  auto   216 / 472 / 269
            The mock was fixed at both, which is why DIFF-1104 kept re-opening
            on the subdirectory measurement after the root one was corrected. */}
        <table className={`table tree-table${dirPath ? '' : ' gl-table-layout-fixed'}`} data-qa-selector="file_tree_table"
          aria-live="polite"
          aria-label={`Files, directories, and submodules in the path ${dirPath ? `/${dirPath}` : '/'} for commit reference ${refName}`}>
          <thead>
            <tr>
              <th id="name" scope="col">Name</th>
              {/* Source: `class="d-none d-sm-table-cell"`. The mock's global.css
                  defines `.d-none` but has no media queries, so keeping `d-none`
                  would hide the column outright — see DEV.r3-seed.md. */}
              <th id="last-commit" scope="col" className="d-sm-table-cell">Last commit</th>
              <th id="last-update" scope="col" className="text-right gl-text-right">Last update</th>
            </tr>
          </thead>
          <tbody>
            {dirPath ? (
              // The source's parent row, verbatim: the `title` sits on the
              // cell, the link carries `aria-label="Go to parent"` and
              // `router-link-active`, its text is ` .. ` with the spaces, and
              // the href back to the root keeps its trailing slash.
              <tr className="tree-item">
                <td title="Go to parent directory" colSpan={3} className="tree-item-file-name">
                  <a href={parent ? `${base}/-/tree/${refName}/${parent}` : `${base}/-/tree/${refName}/`}
                    className="router-link-active" aria-label="Go to parent"> .. </a>
                </td>
              </tr>
            ) : null}
            {rows.map(e => {
              // BUG-A02 — `Last commit` / `Last update`, resolved per path out
              // of tree_last_commits.json (see getTreeLastCommit above).
              const lc = getTreeLastCommit(state, project, refName, e.path, e)
              return (
                <tr className="tree-item" key={e.path}>
                  {/* DIFF-1104 — the source nests the icon INSIDE the link
                      (`a.tree-item-link.str-truncated > span.mr-1 + span`), so
                      the whole cell ellipsises as one run instead of the icon
                      and a wrapping name sitting side by side. */}
                  <td className="tree-item-file-name cursor-default position-relative">
                    <a className="tree-item-link str-truncated" title={e.name}
                      data-qa-selector="file_name_link"
                      href={`${base}/-/${e.type === 'tree' ? 'tree' : 'blob'}/${refName}/${e.path}`}>
                      <span className="mr-1 position-relative text-secondary">
                        <Icon name={e.type === 'tree' ? 'folder' : 'document-lines'} />
                      </span>
                      <span className="position-relative">{e.name}</span>
                    </a>
                  </td>
                  {/* The link text is the RAW subject, not commitTitle():
                      logs_tree hands the row the full subject and only CSS
                      clips it. The source proves it — a11y-webring.club's
                      `functions` row renders all 145 characters of "60: Trying
                      the member gathering …", while the well above truncates. */}
                  <td className="d-sm-table-cell tree-commit cursor-default gl-text-secondary">
                    {lc ? (
                      <a className="gl-link str-truncated-100 tree-commit-link gl-text-secondary"
                        title={lc.title} href={`${base}/-/commit/${lc.sha}`}>{lc.title}</a>
                    ) : null}
                    <div />
                  </td>
                  <td className="tree-time-ago text-right gl-text-right cursor-default gl-text-secondary">
                    {lc ? <TimeAgo value={lc.committed_date} /> : null}
                  </td>
                </tr>
              )
            })}
            {rows.length === 0 ? (
              <tr><td colSpan={3} className="gl-text-gray-500">This directory is empty.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function RepoTree() {
  const params = useParams()
  const { state } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  const refName = params.ref
  const dirPath = params['*'] || ''
  const [addOpen, setAddOpen] = useState(false)
  const [flashDismissed, setFlashDismissed] = useState(false)

  usePageChrome({
    title: project
      ? `${dirPath ? dirPath.split('/').pop() : 'Files'} · ${refName} · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  if (!project) return <NotFound />

  const tree = getRepoTree(state, project, refName)
  const commits = getCommits(state, project, refName)
  const crumbs = dirPath ? dirPath.split('/') : []
  const readme = findReadme(state, project, refName, dirPath)
  const flash = q.get('flash_notice')
  const newFileHref = `${base}/-/new/${refName}${dirPath ? `/${dirPath}` : ''}`

  return (
    <div>
      {flash && !flashDismissed ? (
        <div className="flash-container">
          <div className="gl-alert flash-notice gl-alert-info" data-testid="alert-info" role="alert">
            <div className="gl-alert-body">{flash}</div>
            <button type="button" aria-label="Dismiss"
              className="btn gl-dismiss-btn btn-default btn-sm gl-button btn-default-tertiary btn-icon js-close"
              onClick={() => setFlashDismissed(true)}><Icon name="close" /></button>
          </div>
        </div>
      ) : null}

      <div id="tree-holder" className="tree-holder clearfix">
        {/* In a subdirectory the source's `.project-last-commit` well shows the
            newest commit touching THAT directory, not the repo tip — confirmed
            live on /byteblaze/dotfiles/-/tree/main/.mackup, which shows
            2e96e2a9 "Remove atom config settings". At the root it is the tip. */}
        <LastCommitBanner project={project}
          commit={(dirPath && getTreeLastCommit(state, project, refName, dirPath)) || commits[0]} />

        <div className="nav-block gl-display-flex gl-align-items-center gl-my-3" style={{ gap: 8 }}>
          <div className="tree-ref-container">
            <RefSwitcher project={project} refName={refName} destination="tree"
              branches={getBranches(state, project)} tags={getTags(state, project)}
              hrefFor={r => `${base}/-/tree/${r}${dirPath ? `/${dirPath}` : ''}`}
              title="Select Git revision" searchPlaceholder="Search by Git revision" />
          </div>

          <nav aria-label="Files breadcrumb">
            <ol className="breadcrumb repo-breadcrumb list-unstyled gl-display-flex gl-mb-0" style={{ gap: 4 }}>
              <li className="breadcrumb-item">
                <a className="router-link-active" href={`${base}/-/tree/${refName}`}>{project.path}</a>
              </li>
              {crumbs.map((c, i) => (
                <li className="breadcrumb-item" key={c + i}>
                  {' / '}
                  <a className={i === crumbs.length - 1 ? 'router-link-exact-active router-link-active' : ''}
                    href={`${base}/-/tree/${refName}/${crumbs.slice(0, i + 1).join('/')}`}>{c}</a>
                </li>
              ))}
              <li className="breadcrumb-item">
                <div className={`dropdown${addOpen ? ' show' : ''}`}>
                  <button type="button" className="btn gl-button btn-default btn-sm"
                    aria-label="Add to tree" onClick={() => setAddOpen(o => !o)}>
                    <Icon name="plus" /><Icon name="chevron-down" />
                  </button>
                  {addOpen ? (
                    <div className="dropdown-menu show" style={{ display: 'block' }}>
                      <a className="dropdown-item" href={newFileHref}>New file</a>
                      <a className="dropdown-item" href={`${base}/-/new/${refName}?file_name=README.md`}>Upload file</a>
                      <a className="dropdown-item" href={newFileHref}>New directory</a>
                      <div className="divider" />
                      <a className="dropdown-item" href={`${base}/-/branches/new`}>New branch</a>
                      <a className="dropdown-item" href={`${base}/-/tags/new`}>New tag</a>
                    </div>
                  ) : null}
                </div>
              </li>
            </ol>
          </nav>

          {/* §10a — History · Find file · Web IDE · Download · Clone */}
          <div className="tree-controls gl-ml-auto gl-display-flex" style={{ gap: 8 }}>
            <a className="btn gl-button btn-default" href={`${base}/-/commits/${refName}`}>History</a>
            <a className="btn gl-button btn-default shortcuts-find-file" href={`${base}/-/find_file/${refName}`}>Find file</a>
            <a className="btn gl-button btn-confirm"
              href={`/-/ide/project/${project.full_path}/edit/${refName}/-/${dirPath}`}>Web IDE</a>
          </div>
        </div>

        <TreeTable project={project} refName={refName} entries={tree} dirPath={dirPath} />

        {/* DIFF-1701 — the source renders the current directory's README here,
            inside `#tree-holder`, immediately after `.tree-content-holder`. */}
        {readme ? (
          <ReadmeHolder project={project} refName={refName} path={readme.path} body={readme.body} />
        ) : null}
      </div>
    </div>
  )
}
