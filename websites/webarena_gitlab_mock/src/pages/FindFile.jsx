import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import NotFound from './NotFound.jsx'
import { useProject, useQuery } from './hooks.js'
import { getRepoTree, defaultBranchOf } from '../utils/dataManager.js'

// ROUTES #60 — `/:ns/:proj/-/find_file/:ref`. Fuzzy file finder over the flat
// blob list in repo_trees.json (plus anything a task created).

/** GitLab's finder is a subsequence match, not a substring match. */
function fuzzyScore(path, needle) {
  if (!needle) return 0
  const p = path.toLowerCase()
  const n = needle.toLowerCase()
  let pi = 0
  let score = 0
  let streak = 0
  for (let ni = 0; ni < n.length; ni += 1) {
    const found = p.indexOf(n[ni], pi)
    if (found === -1) return -1
    streak = found === pi ? streak + 1 : 0
    score += streak
    pi = found + 1
  }
  // Prefer shorter paths and matches in the file name over directory names.
  return score * 100 - path.length + (p.split('/').pop().includes(n) ? 500 : 0)
}

export default function FindFile() {
  const params = useParams()
  const { state } = useApp()
  const { project, base } = useProject()
  const q = useQuery()
  const refName = params.ref || (project ? defaultBranchOf(project) : 'main')
  const [needle, setNeedle] = useState(q.get('search', ''))

  usePageChrome({
    title: project
      ? `Find File · ${refName} · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  if (!project) return <NotFound />

  const tree = getRepoTree(state, project, refName).filter(e => e.type !== 'tree')
  const rows = (needle
    ? tree.map(e => ({ e, s: fuzzyScore(e.path, needle) })).filter(r => r.s >= 0)
      .sort((a, b) => b.s - a.s).map(r => r.e)
    : tree
  ).slice(0, 200)

  return (
    <div className="file-finder-holder tree-holder">
      <div className="nav-block gl-display-flex gl-align-items-center gl-my-3" style={{ gap: 8 }}>
        <ul className="breadcrumb repo-breadcrumb list-unstyled gl-display-flex gl-mb-0">
          <li className="breadcrumb-item"><a href={`${base}/-/tree/${refName}`}>{project.path}</a></li>
        </ul>
        <a className="btn gl-button btn-default gl-ml-auto" href={`${base}/-/tree/${refName}`}>Go back</a>
      </div>

      <div className="file-finder-input-holder gl-mb-3">
        <div className="input-group gl-search-box-by-type">
          <input type="search" className="form-control gl-form-input file-finder-input" autoFocus
            placeholder="Find by path" aria-label="Find by path"
            value={needle} onChange={e => setNeedle(e.target.value)} />
          <div className="input-group-append">
            <span className="input-group-text"><Icon name="search" /></span>
          </div>
        </div>
      </div>

      <table className="table tree-table gl-table">
        <tbody>
          {rows.map(e => (
            <tr className="tree-item file-finder-row" key={e.path}>
              <td className="tree-item-file-name">
                <Icon name="document-lines" className="gl-mr-2" />
                <a className="tree-item-file-name-link str-truncated"
                  href={`${base}/-/blob/${refName}/${e.path}`}>{e.path}</a>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr><td className="gl-text-gray-500">Sorry, no matching files were found.</td></tr>
          ) : null}
        </tbody>
      </table>
    </div>
  )
}
