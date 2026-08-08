import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { getCommits, getBranches, getTags, defaultBranchOf } from '../utils/dataManager.js'
import RefSwitcher from '../components/people/RefSwitcher.jsx'

// ROUTES #59 — `/:ns/:proj/-/network/:ref` ("Graph"). assets/README.md §12d.
//
// Copy corrections the recon flagged: the hint line is
// `You can move around the graph by using the arrow keys.`, the search box
// placeholder is `Git revision` (name `extended_sha1`) and the checkbox reads
// `Begin with the selected commit`. There is NO "Show whole repository graph".

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const ROW_H = 22
const MAX_ROWS = 300

export default function NetworkGraph() {
  const params = useParams()
  const { state } = useApp()
  const { project, base } = useProject()
  const refName = params.ref || (project ? defaultBranchOf(project) : 'main')
  const [sha1, setSha1] = useState('')
  const [filterRef, setFilterRef] = useState(false)

  usePageChrome({
    title: project
      ? `Graph · ${refName} · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  if (!project) return <NotFound />

  const branches = getBranches(state, project)
  const tags = getTags(state, project)
  const headNames = new Map()
  for (const b of branches) headNames.set(b.sha, b.name)
  for (const t of tags) if (!headNames.has(t.sha)) headNames.set(t.sha, t.name)

  const commits = getCommits(state, project, refName).slice(0, MAX_ROWS)
  const height = Math.max(120, commits.length * ROW_H + 20)

  // The two dark gutters print the month and the day only on the row where
  // each changes, exactly like the source SVG.
  let lastMonth = null
  let lastDay = null

  return (
    <div>
      <div className="row-content-block second-block content-component-block gl-px-0 gl-py-3
        gl-display-flex gl-align-items-center" style={{ gap: 12 }}>
        <RefSwitcher project={project} refName={refName} branches={branches} tags={tags}
          hrefFor={r => `${base}/-/network/${r}`} destination="graph" />
        <div className="oneline gl-text-gray-500">You can move around the graph by using the arrow keys.</div>
      </div>

      <div className="gl-mt-5">
        <div className="project-network gl-border-1 gl-border-solid gl-border-gray-300"
          style={{ border: '1px solid var(--border-default)', borderRadius: 4 }}>
          <div className="controls gl-bg-gray-50 gl-p-2 gl-font-base gl-text-gray-400 gl-border-b-1"
            style={{ borderBottom: '1px solid var(--border-default)' }}>
            <form className="form-inline network-form gl-display-flex gl-align-items-center"
              style={{ gap: 12 }} onSubmit={e => e.preventDefault()}>
              <input id="extended_sha1" name="extended_sha1" type="text"
                className="search-input form-control gl-form-input input-mx-250 search-sha gl-mr-2"
                placeholder="Git revision" value={sha1} onChange={e => setSha1(e.target.value)} />
              <button type="submit" className="gl-button btn btn-icon btn-md btn-confirm" aria-label="Search">
                Search
              </button>
              <div className="inline gl-ml-5">
                <div className="form-check light">
                  <input id="filter_ref" name="filter_ref" value="1" type="checkbox"
                    className="form-check-input"
                    checked={filterRef} onChange={e => setFilterRef(e.target.checked)} />
                  <label className="form-check-label" htmlFor="filter_ref">
                    <span>Begin with the selected commit</span>
                  </label>
                </div>
              </div>
            </form>
          </div>

          <div className="network-graph gl-bg-white gl-overflow-scroll gl-overflow-x-hidden"
            style={{ maxHeight: 700, overflowY: 'auto' }}>
            <svg width="100%" height={height} role="img" aria-label={`Commit graph for ${refName}`}>
              <rect x="0" y="0" width="46" height={height} fill="#2e2e2e" />
              <rect x="46" y="0" width="46" height={height} fill="#3a3a3a" />
              <line x1="120" y1="10" x2="120" y2={height - 10} stroke="#e24329" strokeWidth="2" />
              {commits.map((c, i) => {
                const d = new Date(String(c.committed_date || '').replace(' ', 'T'))
                const y = 20 + i * ROW_H
                const month = Number.isNaN(d.getTime()) ? null : MONTHS[d.getMonth()]
                const day = Number.isNaN(d.getTime()) ? null : String(d.getDate())
                const showMonth = month && month !== lastMonth
                const showDay = day && day !== lastDay
                lastMonth = month || lastMonth
                lastDay = day || lastDay
                const head = headNames.get(c.sha)
                return (
                  <g key={c.sha}>
                    {showMonth ? <text x="8" y={y + 4} fill="#fff" fontSize="11" fontFamily="monospace">{month}</text> : null}
                    {showDay ? <text x="54" y={y + 4} fill="#fff" fontSize="11" fontFamily="monospace">{day}</text> : null}
                    {head ? (
                      <>
                        <rect x="96" y={y - 8} width={Math.min(120, head.length * 7 + 10)} height="16"
                          rx="3" fill="#dcdcde" />
                        <text x="101" y={y + 4} fontSize="10" fontFamily="monospace" fill="#333238">{head}</text>
                      </>
                    ) : null}
                    <circle cx="120" cy={y} r="4" fill="#e24329" />
                    <text x="134" y={y + 4} fontSize="12" fontFamily="monospace" fill="#333238">
                      {c.title}
                    </text>
                  </g>
                )
              })}
              {commits.length === 0 ? (
                <text x="120" y="40" fontSize="13" fill="#737278">This repository has no commits yet.</text>
              ) : null}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}
