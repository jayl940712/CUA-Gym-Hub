import React from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { getContributors, contributorRefs, getBranches, getTags, defaultBranchOf } from '../utils/dataManager.js'
import { formatDate } from '../utils/format.js'
import RefSwitcher from '../components/people/RefSwitcher.jsx'

// ROUTES #57 — `/:ns/:proj/-/graphs/:ref` ("Contributors"). TODO.md P1-K,
// 20 tasks, pure read. assets/README.md §12c.
//
// Copy is verbatim and NOT the obvious phrasing:
//   h4   `Commits to {ref}`        (`Commits to master`, `Commits to php52`)
//   span `Excluding merge commits. Limited to 6,000 commits.`
//   card h4 = author NAME, p = `{n} commits ({email})`, singular `1 commit`.
//
// GitLab groups by e-mail, not by user, so the same human legitimately appears
// twice (Eric Bailey on dotfiles, Scott Vinkle on a11yproject.com). Do not
// de-duplicate.
//
// Anchor refs are NOT always the default branch:
//   /dehenne/awesome-visibility/-/graphs/master   (webarena-787)
//   /amwhalen/archive-my-tweets/-/graphs/php52    (webarena-788)
//
// The per-day detail matters: tasks ask "how many commits did X make on D",
// with expected answers like `0`, `1`, `2`, `5`, `14`, `16`, `414` and
// `Susan Zhang: 70`. A chart alone is not readable enough to answer those, so
// every author with `daily` data also gets a plain per-day table.

/** Aggregate every author's `daily` map into one project-wide series. */
function totalSeries(authors) {
  const acc = new Map()
  for (const a of authors) {
    for (const [day, n] of Object.entries(a.daily || {})) {
      acc.set(day, (acc.get(day) || 0) + n)
    }
  }
  return [...acc.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))
}

/**
 * A commits-over-time bar chart. The real page uses ECharts; the shape (one
 * bar per day, ascending in time, `Number of commits` on the y axis) is what
 * an agent reads, so an inline SVG is a faithful stand-in and keeps the mock
 * offline.
 */
function CommitsChart({ series, height = 180, yLabel = 'Number of commits' }) {
  if (!series.length) {
    return <div className="gl-text-gray-500 gl-my-3">No commit data available for this reference.</div>
  }
  const max = Math.max(...series.map(([, n]) => n), 1)
  const width = 900
  const barW = Math.max(1, Math.min(12, width / series.length))
  const usable = height - 24

  return (
    <div className="gl-my-3">
      <svg width="100%" viewBox={`0 0 ${width} ${height}`} role="img"
        aria-label={`${yLabel} over time`} style={{ maxWidth: '100%' }}>
        <text x="0" y="10" className="gl-font-sm" fontSize="11" fill="#737278">{yLabel}</text>
        <line x1="28" y1={height - 18} x2={width} y2={height - 18} stroke="#dcdcde" />
        {series.map(([day, n], i) => {
          const h = Math.max(1, Math.round((n / max) * (usable - 12)))
          const x = 30 + i * ((width - 34) / series.length)
          return (
            <rect key={day} x={x} y={height - 18 - h} width={barW} height={h} fill="#617ae2">
              <title>{`${formatDate(day)}: ${n} ${n === 1 ? 'commit' : 'commits'}`}</title>
            </rect>
          )
        })}
        <text x="30" y={height - 4} fontSize="11" fill="#737278">{formatDate(series[0][0])}</text>
        <text x={width - 4} y={height - 4} fontSize="11" fill="#737278" textAnchor="end">
          {formatDate(series[series.length - 1][0])}
        </text>
      </svg>
      <div className="gl-legend-inline gl-display-flex gl-align-items-center gl-font-sm" style={{ gap: 8 }}>
        <span style={{ width: 10, height: 10, background: '#617ae2', display: 'inline-block' }} />
        <span className="gl-truncate gl-font-weight-bold" title="Commits">Commits</span>
        <span className="gl-text-gray-500">{`Max: ${max}`}</span>
      </div>
    </div>
  )
}

/** Per-day counts, newest first — this is what makes "on date D" answerable. */
function DailyTable({ daily, name }) {
  const rows = Object.entries(daily).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  if (!rows.length) return null
  return (
    <details className="gl-mt-2">
      <summary className="gl-text-blue-500" style={{ cursor: 'pointer' }}>Commits per day</summary>
      <table className="table gl-table gl-mt-2 contributors-daily-table">
        <thead><tr><th>Date</th><th>Commits</th></tr></thead>
        <tbody>
          {rows.map(([day, n]) => (
            <tr key={`${name}-${day}`}>
              <td>{formatDate(day)}</td>
              <td>{n}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  )
}

export default function Contributors() {
  const params = useParams()
  const { state } = useApp()
  const { project, base } = useProject()
  const refName = params.ref || (project ? defaultBranchOf(project) : 'main')

  usePageChrome({
    title: project
      ? `Contributors · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })

  if (!project) return <NotFound />

  const refs = contributorRefs(project)
  const data = getContributors(project, refName)
  const authors = data && data.authors ? [...data.authors].sort((a, b) => b.commits - a.commits) : []
  const series = totalSeries(authors)

  const branches = getBranches(state, project)
  const tags = getTags(state, project)

  return (
    <div>
      <div className="sub-header-block gl-bg-gray-10 gl-p-5 gl-display-flex gl-align-items-center" style={{ gap: 12 }}>
        <RefSwitcher project={project} refName={refName} branches={branches} tags={tags}
          hrefFor={r => `${base}/-/graphs/${r}`} destination="graphs" />
        <a className="btn gl-button btn-default gl-ml-auto" href={`${base}/-/commits/${refName}`}>History</a>
      </div>

      {/* §12c — contributor cards are two per row (`col-lg-6`). Scoped here
          because global.css is shared with the other feature shards. */}
      <style>{`
        .contributors-charts .row { display: flex; flex-wrap: wrap; margin: 0 -12px; }
        .contributors-charts .row > .col-lg-6 { width: 50%; padding: 0 12px; box-sizing: border-box; }
        @media (max-width: 1200px) { .contributors-charts .row > .col-lg-6 { width: 100%; } }
        .contributors-daily-table { max-height: 320px; display: block; overflow-y: auto; }
      `}</style>
      <div className="contributors-charts">
        <h4 className="gl-mb-2 gl-mt-5">{`Commits to ${refName}`}</h4>
        <span>Excluding merge commits. Limited to 6,000 commits.</span>

        {data ? (
          <>
            <CommitsChart series={series} />
            <p className="gl-text-gray-500">
              {`${data.total} ${data.total === 1 ? 'commit' : 'commits'} by ${authors.length} ${authors.length === 1 ? 'contributor' : 'contributors'}`}
            </p>

            <div className="row">
              {authors.map((a, i) => (
                <div className="col-lg-6 col-12 gl-my-5" key={`${a.email}-${i}`}>
                  <h4 className="gl-mb-2 gl-mt-0">{a.name}</h4>
                  {/* ANCHOR-shaped line: `{n} commits ({email})`, singular at 1. */}
                  <p className="gl-mb-3">{`${a.commits} ${a.commits === 1 ? 'commit' : 'commits'} (${a.email})`}</p>
                  {a.daily ? (
                    <>
                      <CommitsChart
                        series={Object.entries(a.daily).sort((x, y) => (x[0] < y[0] ? -1 : 1))}
                        height={120} yLabel="Commits" />
                      <DailyTable daily={a.daily} name={a.email} />
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="row empty-state gl-mt-5">
            <div className="gl-empty-state-content">
              <h4>This repository has no commits yet.</h4>
              {refs.length ? (
                <p>
                  {'Contributor data exists for: '}
                  {refs.map((r, i) => (
                    <React.Fragment key={r}>
                      {i ? ', ' : null}
                      <a href={`${base}/-/graphs/${r}`}>{r}</a>
                    </React.Fragment>
                  ))}
                </p>
              ) : null}
            </div>
          </div>
        )}
      </div>

      <p className="gl-mt-5">
        <a href={`${base}/-/graphs/${refName}/charts`}>
          <Icon name="chart" className="gl-mr-2" />Repository analytics
        </a>
      </p>
    </div>
  )
}
