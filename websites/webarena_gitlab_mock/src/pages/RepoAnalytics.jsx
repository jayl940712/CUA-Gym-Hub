import React from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { getCommits, defaultBranchOf } from '../utils/dataManager.js'

// ROUTES #58 / #114 — `/:ns/:proj/-/graphs/:ref/charts` (Analytics →
// Repository). Aggregates commits.json into the three panels the source shows:
// commits per month, per weekday, and per hour of day.

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function BarPanel({ title, labels, values }) {
  const max = Math.max(...values, 1)
  return (
    <div className="gl-mb-5">
      <h4 className="gl-mb-3">{title}</h4>
      <div className="gl-display-flex gl-align-items-flex-end" style={{ gap: 4, height: 160 }}>
        {values.map((v, i) => (
          <div key={labels[i]} className="gl-display-flex gl-flex-grow-1"
            style={{ flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}
            title={`${labels[i]}: ${v}`}>
            <span className="gl-font-sm gl-text-gray-500">{v}</span>
            <div style={{ width: '100%', height: `${Math.round((v / max) * 120)}px`, background: '#617ae2', borderRadius: '2px 2px 0 0' }} />
            <span className="gl-font-sm gl-text-gray-500" style={{ marginTop: 4 }}>{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function RepoAnalytics() {
  const params = useParams()
  const { state } = useApp()
  const { project, base } = useProject()
  const refName = params.ref || (project ? defaultBranchOf(project) : 'main')

  usePageChrome({
    title: project
      ? `Charts · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  if (!project) return <NotFound />

  const commits = getCommits(state, project, refName)
  const byMonth = new Array(12).fill(0)
  const byDay = new Array(7).fill(0)
  const byHour = new Array(24).fill(0)
  let authors = new Set()

  for (const c of commits) {
    const d = new Date(String(c.committed_date || '').replace(' ', 'T'))
    if (Number.isNaN(d.getTime())) continue
    byMonth[d.getMonth()] += 1
    byDay[d.getDay()] += 1
    byHour[d.getHours()] += 1
    authors.add(c.author_email)
  }

  return (
    <div>
      <h3 className="page-title">Repository Analytics</h3>
      <div className="gl-display-flex gl-mb-5" style={{ gap: 32 }}>
        <div>
          <div className="gl-font-size-h-display gl-font-weight-bold">{commits.length}</div>
          <div className="gl-text-gray-500">Commits</div>
        </div>
        <div>
          <div className="gl-font-size-h-display gl-font-weight-bold">{authors.size}</div>
          <div className="gl-text-gray-500">Authors</div>
        </div>
        <div>
          <div className="gl-font-size-h-display gl-font-weight-bold">{refName}</div>
          <div className="gl-text-gray-500">Reference</div>
        </div>
      </div>

      <BarPanel title="Commits per month" labels={MONTHS} values={byMonth} />
      <BarPanel title="Commits per weekday" labels={DAYS.map(d => d.slice(0, 3))} values={byDay} />
      <BarPanel title="Commits per hour of the day"
        labels={byHour.map((_, i) => String(i))} values={byHour} />

      <p className="gl-mt-5">
        <a href={`${base}/-/graphs/${refName}`}>Back to Contributors</a>
      </p>
    </div>
  )
}
