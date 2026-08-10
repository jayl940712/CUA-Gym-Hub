import React from 'react'
import { useParams } from 'react-router-dom'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon, { CiStatusIcon } from '../components/layout/Icon.jsx'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useProject, useQuery } from './hooks.js'
import NotFound from './NotFound.jsx'
import { shortSha } from '../utils/format.js'
import { getMrDiff } from '../utils/dataManager.js'
import {
  PIPELINES_PER_PAGE, JOBS_PER_PAGE,
  pipelinesFor, pipelineById, jobsOf, jobsFor, jobCountFor, jobsBadge,
  stageColumns, jobStatusClass, jobTooltip, failedJobCount,
  analyticsFor, durationChartCommits, pluralPipelines, needsColumns,
  durationTicks, countTicks, pipelinesPerDay,
} from '../utils/ci.js'

// ---------------------------------------------------------------------------
// TEST.md DIFF-1105 — the project CI/CD surface.
//
// Round 4 built these four views off a capture of `byteblaze/dotfiles`, the one
// sampled project that genuinely has NO pipelines, and generalised its empty
// state to the whole instance. That is wrong for 67 of the 175 seeded projects:
// the source has 1 465 pipelines and 14 179 jobs, `/-/pipelines/:id` returns
// 200, and `Success ratio` is `0.00%` wherever a project has pipelines (every
// non-skipped pipeline on this instance failed) — never the `100.00%` the mock
// printed unconditionally.
//
// Everything rendered here comes from `src/data/ci_pipelines.json` via
// `src/utils/ci.js`. That module is STATIC reference data: it is imported
// directly, never copied into `createInitialData()`, and nothing in the mock
// mutates it (the source has no runners, so no pipeline is re-runnable).
//
// The 108 projects the source shows as empty still render the source's empty
// state, byte for byte as round 4 captured it — that part was always correct.
//
// DOM, copy and status vocabulary read off live captures of
// `/byteblaze/a11y-webring.club`, `/a11yproject/a11yproject.com`,
// `/OpenAPITools/openapi-generator`, `/firstcontributions/first-contributions`
// and `/keycloak/keycloak` (DEV.r12-cicd.md §1.3). Nothing here is invented.
// ---------------------------------------------------------------------------

/**
 * Project page shell — same contract as ProjectOps.jsx's `useOpsPage`, plus the
 * two chrome flags the CI detail pages need. Measured against the source at
 * 1920: the pipelines list and CI/CD analytics sit in the usual 1280px
 * `container-limited` box (464-1712), while `/-/pipelines/:id` is full width
 * (272-1904) and `/-/jobs/:id` is full width minus its 290px `.build-sidebar`
 * (272-1614 with the sidebar at 1630-1920).
 */
function useCiPage(suffix, breadcrumbExtra, opts = {}) {
  const { state } = useApp()
  const { project, base } = useProject()
  usePageChrome({
    title: project
      ? `${suffix} · ${project.namespace.name} / ${project.name} · GitLab`
      : 'GitLab',
    breadcrumbExtra: breadcrumbExtra || null,
    ...opts,
  })
  return { ready: Boolean(state), state, project, base }
}

/**
 * `<a class="gl-link ci-status ci-<status>">` + its ringed glyph and label —
 * the source's shared status badge, used in the pipelines table, the jobs
 * table, the pipeline header and the job header.
 */
function CiStatusBadge({ status, href, className = '', size = 16 }) {
  const body = (
    <>
      <CiStatusIcon status={status} size={size} />
      {` ${status} `}
    </>
  )
  const cls = `gl-link ci-status ci-${status} ${className}`.trim()
  return href
    ? <a href={href} title="" data-qa-selector="status_badge_link" className={cls}>{body}</a>
    : <span title="" data-qa-selector="status_badge_link" className={cls}>{body}</span>
}

/**
 * The badge strip under a pipeline's ref, and the same strip in the detail
 * page's info-well. Order, copy and tooltips are the source's — all five are
 * on `/firstcontributions/first-contributions/-/pipelines` and its `/1822`:
 * `latest` · `yaml invalid` · `error` · `Auto DevOps` · `merge request`.
 *
 * The two surfaces differ in one way only, which is preserved here: the Vue
 * table marks each badge with `data-testid="pipeline-url-*"`, while the HAML
 * info-well marks it with a `js-pipeline-url-*` class.
 */
const BADGE_TITLES = {
  latest: 'Latest pipeline for the most recent commit on this branch',
  autodevops: 'This pipeline makes use of a predefined CI/CD configuration enabled by Auto DevOps.',
  failure: 'The pipeline failed due to an error on the CI/CD configuration file.',
  detached: "This pipeline ran on the contents of this merge request's source branch, not the target branch.",
}

function PipelineBadges({ pipeline, variant = 'table' }) {
  const has = f => pipeline.flags.includes(f)
  const table = variant === 'table'
  const mark = key => (table
    ? { 'data-testid': `pipeline-url-${key}` }
    : { className: `js-pipeline-url-${key} has-tooltip` })
  const badge = (key, tone, title, text) => {
    const m = mark(key)
    return (
      <span title={title} data-testid={m['data-testid']}
        className={`badge badge-${tone} badge-pill gl-badge sm${m.className ? ` ${m.className}` : ''}`}>
        {text}
      </span>
    )
  }
  return (
    <div className={`label-container${table ? ' gl-mt-1' : ''}`}>
      {has('latest') ? <>{badge('latest', 'success', BADGE_TITLES.latest, 'latest')}{' '}</> : null}
      {has('yaml_errors') ? <>{badge('yaml', 'danger', pipeline.yaml_errors || '', 'yaml invalid')}{' '}</> : null}
      {has('failure_reason') ? <>{badge('failure', 'danger', BADGE_TITLES.failure, 'error')}{' '}</> : null}
      {has('auto_devops') ? (
        table ? (
          <a id={`pipeline-url-autodevops-${pipeline.id}`} tabIndex={0}
            data-testid="pipeline-url-autodevops" role="button" href="#"
            onClick={e => e.preventDefault()} className="gl-link">
            <span className="badge badge-info badge-pill gl-badge sm">Auto DevOps</span>
          </a>
        ) : (
          <a href="#" role="button" tabIndex={0} onClick={e => e.preventDefault()}
            title={BADGE_TITLES.autodevops}
            className="gl-badge badge badge-pill badge-info sm js-pipeline-url-autodevops">Auto DevOps</a>
        )
      ) : null}
      {has('merge_request')
        ? badge(table ? 'detached' : 'mergerequest', 'info', BADGE_TITLES.detached, 'merge request')
        : null}
    </div>
  )
}

/** The mini pipeline graph in the `Stages` cell — one bubble per stage. */
function PipelineMiniGraph({ pipeline }) {
  if (!pipeline.stages.length) return <div data-testid="pipeline-mini-graph" />
  return (
    <div data-testid="pipeline-mini-graph">
      <div data-testid="pipeline-stages" className="gl-display-inline gl-vertical-align-middle">
        {pipeline.stages.map(([name, status]) => (
          <div key={name}
            className="pipeline-mini-graph-stage-container gl-display-inline-block gl-mr-2 gl-my-2 gl-vertical-align-middle">
            <div className="gl-dropdown btn-group" data-testid="mini-pipeline-graph-dropdown"
              aria-label={`View Stage: ${name}: ${status}`}>
              <button type="button" aria-haspopup="true" aria-expanded="false"
                onClick={e => e.preventDefault()}
                className="btn btn-link btn-md gl-button gl-dropdown-toggle">
                <CiStatusIcon status={status} size={24} borderless
                  className="gl-display-inline-flex gl-align-items-center gl-border gl-z-index-1 interactive" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/** `<nav class="gl-pagination">` — the numbered pager the source renders. */
function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null
  // The window is `page ± 4`, clamped to [1, pages], and an ellipsis that would
  // hide only one or two pages is expanded into those pages instead. Derived by
  // reading the pager off the source for ALL 52 pages of
  // `/OpenAPITools/openapi-generator/-/pipelines` (26) and
  // `/keycloak/keycloak/-/pipelines` (16) — it reproduces every one:
  //   p1  → `Prev 1 2 3 4 5 … 26 Next`
  //   p7  → `Prev 1 2 3 4 5 6 7 8 9 10 11 … 26 Next`   (left `…` would hide only p2)
  //   p8  → `Prev 1 … 4 5 6 7 8 9 10 11 12 … 26 Next`
  //   p20 → `Prev 1 … 16 17 18 19 20 21 22 23 24 25 26 Next`
  //   p26 → `Prev 1 … 22 23 24 25 26 Next`
  let start = Math.max(1, page - 4)
  let end = Math.min(pages, page + 4)
  if (start <= 3) start = 1
  if (end >= pages - 2) end = pages
  const nums = []
  if (start > 1) { nums.push(1, '…') }
  for (let p = start; p <= end; p += 1) nums.push(p)
  if (end < pages) { nums.push('…', pages) }

  const item = (label, target, key, extra = '') => (
    <li className={`page-item${target == null ? ' disabled' : ''}${extra}`} key={key}>
      {target == null
        ? <span aria-disabled="true" className="page-link">{label}</span>
        : (
          <a href="#" aria-label={typeof label === 'number' ? `Go to page ${label}` : undefined}
            aria-current={target === page ? 'page' : undefined}
            onClick={e => { e.preventDefault(); onPage(target) }}
            className={`gl-link page-link${target === page ? ' active' : ''}`}>{label}</a>
        )}
    </li>
  )
  return (
    <nav aria-label="Pagination" className="gl-pagination text-nowrap justify-content-center gl-mt-3">
      <ul className="pagination">
        <li className={`page-item${page === 1 ? ' disabled' : ''}`}>
          {page === 1
            ? <span className="gl-link page-link prev-page-item gl-display-flex"><Icon name="chevron-left" /> <span>Prev</span></span>
            : <a href="#" aria-label="Go to previous page" onClick={e => { e.preventDefault(); onPage(page - 1) }}
              className="gl-link page-link prev-page-item gl-display-flex"><Icon name="chevron-left" /> <span>Prev</span></a>}
        </li>
        {nums.map((n, i) => (n === '…'
          ? item('…', null, `gap-${i}`)
          : item(n, n, `p-${n}`)))}
        <li className={`page-item${page === pages ? ' disabled' : ''}`}>
          {page === pages
            ? <span className="gl-link page-link next-page-item gl-display-flex"><span>Next</span> <Icon name="chevron-right" /></span>
            : <a href="#" aria-label="Go to next page" onClick={e => { e.preventDefault(); onPage(page + 1) }}
              className="gl-link page-link next-page-item gl-display-flex"><span>Next</span> <Icon name="chevron-right" /></a>}
        </li>
      </ul>
    </nav>
  )
}

/**
 * The MR a pipeline belongs to — GitLab's `Ci::Pipeline#all_merge_requests`:
 *
 *   merge_request?  ->  MergeRequest.where(id: merge_request_id)
 *   otherwise       ->  MergeRequest.where(source_project_id:, source_branch: ref)
 *                                   .by_commit_sha(sha)
 *
 * The `by_commit_sha` half matters: `primer/design` has TWO merge requests off
 * `github/fork/mbappai/patch-2` (!302 closed, !303 open) and the source lists
 * only `!303` for pipeline 1828, because only !303's diff contains that
 * pipeline's commit. `merge_request_diffs.json` (the round-10 static seed)
 * already carries each MR's commit list, so the filter is exact rather than
 * approximated by the branch name alone.
 */
function relatedMergeRequests(state, project, pipeline) {
  if (pipeline.mr_iid) return [{ iid: pipeline.mr_iid, title: pipeline.mr_title }]
  if (!state || pipeline.ref_kind !== 'branch') return []
  return state.mergeRequests
    .filter(m => m.project_id === project.id && m.source_branch === pipeline.ref)
    .filter(m => {
      const diff = getMrDiff(m)
      if (!diff || !diff.commits) return true
      return diff.commits.some(c => c.sha === pipeline.sha)
    })
    .map(m => ({ iid: m.iid, title: m.title }))
}

// ------------------------------------------------------- pipelines list ----

/** ROUTES #106 — `/:ns/:proj/-/pipelines`. */
export function Pipelines() {
  const { ready, state, project, base } = useCiPage('Pipelines')
  const q = useQuery()
  const [keyMode, setKeyMode] = React.useState('id')
  const [keyOpen, setKeyOpen] = React.useState(false)

  const rows = pipelinesFor(project && project.id)
  const page = Math.min(Math.max(1, Number(q.get('page', '1')) || 1),
    Math.max(1, Math.ceil(rows.length / PIPELINES_PER_PAGE)))
  const pages = Math.ceil(rows.length / PIPELINES_PER_PAGE)
  const slice = rows.slice((page - 1) * PIPELINES_PER_PAGE, page * PIPELINES_PER_PAGE)

  const setPage = p => {
    const next = new URLSearchParams(q.searchParams)
    if (p === 1) next.delete('page')
    else next.set('page', String(p))
    q.setSearchParams(next)
  }

  if (!ready) return null
  if (!project) return <NotFound />

  return (
    <div className="pipelines-container">
      <div className="top-area scrolling-tabs-container inner-page-scroll-tabs gl-border-none">
        <div className="tabs gl-tabs gl-display-flex gl-w-full">
          <div>
            <ul role="tablist" className="nav gl-border-0! gl-tabs-nav">
              {[['All', rows.length], ['Finished'], ['Branches'], ['Tags']].map(([label, count], i) => (
                <li role="presentation" className="nav-item" key={label}>
                  <a data-testid={`pipelines-tab-${label.toLowerCase()}`} role="tab"
                    aria-selected={i === 0} href="#" onClick={e => e.preventDefault()}
                    className={`nav-link js-pipelines-tab-${label.toLowerCase()} gl-display-inline-flex gl-tab-nav-item${i === 0 ? ' active gl-tab-nav-item-active' : ''}`}>
                    <span className="gl-mr-2">{` ${label} `}</span>
                    {count === undefined ? null : (
                      <span className="badge gl-tab-counter-badge badge-muted badge-pill gl-badge sm">{` ${count}`}</span>
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* `assets/html/proj-pipelines.html` is an AUTHENTICATED capture, so it
            is the ground truth for these three: the anonymous source hides them.
            Their hrefs and testids are the capture's — round 4 rendered `CI
            lint` as a root-relative `/-/ci/lint` and `Run pipeline` as a bare
            button, neither of which is the source's shape. */}
        <div className="nav-controls">
          <button data-testid="clear-cache-button" type="button"
            className="btn js-clear-cache btn-default btn-md gl-button">
            <span className="gl-button-text">Clear runner caches</span>
          </button>
          <a data-testid="ci-lint-button" href={`${base}/-/ci/lint`}
            className="btn js-ci-lint btn-default btn-md gl-button">
            <span className="gl-button-text">CI lint</span>
          </a>
          <a data-testid="run-pipeline-button" data-qa-selector="run_pipeline_button"
            href={`${base}/-/pipelines/new`} className="btn js-run-pipeline btn-confirm btn-md gl-button">
            <span className="gl-button-text">Run pipeline</span>
          </a>
        </div>
      </div>

      {/* The filter row and the `Show Pipeline ID` dropdown render on an EMPTY
          project too — `/byteblaze/dotfiles/-/pipelines` shows them above the
          empty state on both the anonymous source and the round-4 capture. */}
      <>
          <div className="gl-display-flex">
            <div className="row-content-block gl-display-flex gl-flex-grow-1">
              <div role="group" className="input-group gl-search-box-by-click gl-display-flex gl-flex-grow-1 gl-mr-4"
                data-testid="filtered-search-input">
                <div className="gl-filtered-search-scrollable">
                  <div data-testid="filtered-search-term" className="gl-h-auto gl-filtered-search-term gl-filtered-search-item gl-filtered-search-last-item">
                    <div data-testid="filtered-search-token-segment" className="gl-filtered-search-token-segment gl-filtered-search-term-token gl-w-full">
                      <input placeholder="Filter pipelines" aria-label="Filter pipelines"
                        data-testid="filtered-search-term-input" className="gl-filtered-search-term-input" />
                    </div>
                  </div>
                </div>
                <div className="input-group-append">
                  <button aria-label="Search" data-testid="search-button" type="button"
                    className="btn gl-search-box-by-click-search-button btn-default btn-md gl-button btn-icon">
                    <Icon name="search" />
                  </button>
                </div>
              </div>
              {/* `Show Pipeline ID` / `Show Pipeline IID` swaps the `#` column
                  between `ci_pipelines.id` and the per-project `iid` — both are
                  real columns in the seed, so the toggle is live. */}
              <div className="dropdown gl-dropdown gl-display-flex btn-group" data-testid="pipeline-key-dropdown">
                <button aria-haspopup="true" aria-expanded={keyOpen} type="button"
                  onClick={() => setKeyOpen(o => !o)}
                  className="btn dropdown-toggle btn-default btn-md gl-button gl-dropdown-toggle">
                  <span className="gl-dropdown-button-text">
                    {keyMode === 'id' ? 'Show Pipeline ID' : 'Show Pipeline IID'}
                  </span>
                  <Icon name="chevron-down" className="gl-button-icon dropdown-chevron" />
                </button>
                <ul role="menu" className={`dropdown-menu${keyOpen ? ' show' : ''}`}>
                  <div className="gl-dropdown-inner">
                    <div className="gl-dropdown-contents">
                      {[['id', 'Show Pipeline ID'], ['iid', 'Show Pipeline IID']].map(([mode, label]) => (
                        <li role="presentation" className="gl-dropdown-item" key={mode}>
                          <button role="menuitem" type="button" className="dropdown-item"
                            onClick={() => { setKeyMode(mode); setKeyOpen(false) }}>
                            <Icon name="mobile-issue-close"
                              className={`gl-dropdown-item-check-icon gl-mt-3 gl-align-self-start${keyMode === mode ? '' : ' gl-visibility-hidden'}`} />
                            <div className="gl-dropdown-item-text-wrapper">
                              <p className="gl-dropdown-item-text-primary">{label}</p>
                            </div>
                          </button>
                        </li>
                      ))}
                    </div>
                  </div>
                </ul>
              </div>
            </div>
          </div>

          <div className="content-list pipelines">
            {rows.length === 0 ? (
              // Verbatim from the authenticated capture: a
              // `section.empty-state` whose heading is an
              // `h1.gl-font-size-h-display.gl-line-height-36.h4`, not the bare
              // `h4` round 4 used. The sentence itself is unchanged.
              <section className="gl-display-flex empty-state gl-text-center gl-flex-direction-column">
                <div className="gl-max-w-full"><div className="svg-250 svg-content" /></div>
                <div className="gl-max-w-full gl-m-auto">
                  <div className="gl-mx-auto gl-my-0 gl-p-5">
                    <h1 className="gl-font-size-h-display gl-line-height-36 h4">
                      There are currently no pipelines.
                    </h1>
                    <div className="gl-display-flex gl-flex-wrap gl-justify-content-center" />
                  </div>
                </div>
              </section>
            ) : (
              <div>
                <div className="ci-table">
                  <table role="table" aria-colcount="5"
                    className="table b-table gl-table b-table-fixed b-table-stacked-lg">
                    <colgroup>
                      <col className="gl-w-15p" /><col className="gl-w-30p" /><col className="gl-w-10p" />
                      <col className="gl-w-quarter" /><col className="gl-w-15p" />
                    </colgroup>
                    <thead role="rowgroup">
                      <tr role="row">
                        {[['Status', 'status'], ['Pipeline', 'pipeline'], ['Triggerer', 'triggerer'],
                          ['Stages', 'stages']].map(([label, id], i) => (
                            <th role="columnheader" scope="col" aria-colindex={i + 1} key={id}
                              data-testid={`${id}-th`}><div>{label}</div></th>
                          ))}
                        <th role="columnheader" scope="col" aria-colindex="5" data-testid="actions-th">
                          <span className="gl-display-block gl-lg-display-none!">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody role="rowgroup">
                      {slice.map(p => (
                        <PipelineRow key={p.id} pipeline={p} base={base} state={state}
                          project={project} keyMode={keyMode} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pager page={page} pages={pages} onPage={setPage} />
              </div>
            )}
          </div>
      </>
    </div>
  )
}

function PipelineRow({ pipeline: p, base, state, project, keyMode }) {
  const triggerer = state.users.find(u => u.username === 'root')
  return (
    <tr role="row" className="commit" data-testid="pipeline-table-row"
      data-qa-selector="pipeline_row_container">
      <td aria-colindex="1" data-label="Status" role="cell" className="gl-p-5!">
        <div><div>
          <CiStatusBadge status={p.status} href={`${base}/-/pipelines/${p.id}`} className="gl-mb-3" />
          <div className="gl-display-block gl-mt-3">
            <p className="finished-at d-none d-md-block">
              <Icon name="calendar" size={12} className="gl-vertical-align-baseline!" />
              <TimeAgo value={p.finished_at || p.created_at} placement="top" />
            </p>
          </div>
        </div></div>
      </td>
      <td aria-colindex="2" data-label="Pipeline" role="cell" className="gl-p-5!">
        <div><div data-testid="pipeline-url-table-cell" className="pipeline-tags">
          <div data-testid="commit-title-container" className="commit-title gl-mb-2">
            <span className="gl-display-flex"><span className="gl-min-w-0 gl-flex-grow-1 gl-text-truncate">
              <a data-testid="commit-title" href={`${base}/-/commit/${p.sha}`}
                className="gl-link commit-row-message gl-text-gray-900">{p.title}</a>
            </span></span>
          </div>
          <div className="gl-mb-2">
            <a data-testid="pipeline-url-link" data-qa-selector="pipeline_url_link"
              href={`${base}/-/pipelines/${p.id}`}
              className="gl-link gl-text-decoration-underline gl-text-blue-600! gl-mr-3">
              #{keyMode === 'id' ? p.id : p.iid}</a>
            {/* DIFF-1306 — without this the row reads `#1823github/fork/…`. */}
            {' '}
            <div className="icon-container gl-display-inline-block gl-mr-1">
              <Icon name={p.ref_kind === 'tag' ? 'label' : 'branch'}
                title={p.ref_kind === 'tag' ? 'Tag' : 'Branch'} data-testid="commit-icon-type" />
            </div>
            {/* A merge-request pipeline shows the MR iid where a branch pipeline
                shows the ref, under a different testid —
                `/firstcontributions/first-contributions` renders
                `#1822  65328  cdc25f76` with `data-testid="merge-request-ref"`. */}
            <span className="gl-min-w-0">
              {p.ref_kind === 'merge_request' ? (
                <a data-testid="merge-request-ref" href={`${base}/-/merge_requests/${p.mr_iid}`}
                  className="gl-link ref-name gl-mr-3">{p.mr_iid}</a>
              ) : (
                <a data-testid="commit-ref-name" href={`${base}/-/commits/${p.ref}`}
                  className="gl-link ref-name gl-mr-3">{p.ref}</a>
              )}
            </span>
            {/* TEST.md DIFF-1306 — JSX drops the newline between sibling
                elements, so the row's innerText read
                `#1823github/fork/…add-verification-function4817a445` where the
                source has whitespace text nodes between all three. */}
            {' '}
            <Icon name="commit" title="Commit" data-testid="commit-icon" className="commit-icon gl-mr-1" />
            {' '}
            <a data-testid="commit-short-sha" href={`${base}/-/commit/${p.sha}`}
              className="gl-link commit-sha mr-0">{shortSha(p.sha)}</a>
            {/* The source's commit-author avatar is a `mailto:` anchor round a
                gravatar <img>. The href and the address are the real ones from
                `ci_pipelines`' commit; the image is the mock's local identicon
                (assets/README.md §0.4 — no runtime network calls). */}
            {p.author_email ? (
              <a href={`mailto:${p.author_email}`} className="gl-link gl-avatar-link user-avatar-link gl-ml-1">
                <UserAvatar user={{ id: 0, name: p.author_name }} size={16} alt="" />
              </a>
            ) : null}
          </div>
          <PipelineBadges pipeline={p} />
        </div></div>
      </td>
      <td aria-colindex="3" data-label="Triggerer" role="cell"
        className="gl-p-5! gl-display-none! gl-lg-display-table-cell!">
        <div><div data-testid="pipeline-triggerer" className="pipeline-triggerer">
          <a title="Administrator" to="/root" className="gl-link gl-avatar-link gl-ml-3">
            <UserAvatar user={triggerer} size={32} alt="avatar" />
          </a>
        </div></div>
      </td>
      <td aria-colindex="4" data-label="Stages" role="cell" className="gl-p-5!">
        <div><PipelineMiniGraph pipeline={p} /></div>
      </td>
      <td aria-colindex="5" data-label="Actions" role="cell" className="gl-p-5!">
        <div><div className="gl-text-right"><div className="btn-group">
          {/* The source's `Download artifacts` dropdown. No job on this
              instance produced an artifact (no runner ever ran), so the menu
              opens empty rather than offering a dead download — which is what
              the source's own lazy menu does here too. */}
          <div className="dropdown gl-dropdown btn-group" title="Download artifacts"
            aria-label="Download artifacts" data-testid="pipeline-multi-actions-dropdown">
            <button aria-haspopup="true" aria-expanded="false" type="button"
              onClick={e => e.preventDefault()}
              className="btn dropdown-toggle btn-default btn-md gl-button gl-dropdown-toggle dropdown-icon-only">
              <Icon name="download" className="dropdown-icon" />
              <span className="gl-dropdown-button-text gl-sr-only">Download artifacts</span>
              <Icon name="chevron-down" className="gl-button-icon dropdown-chevron" />
            </button>
          </div>
        </div></div></div>
      </td>
    </tr>
  )
}

// ------------------------------------------------------ pipeline detail ----

/**
 * ROUTES #106 — `/:ns/:proj/-/pipelines/:id`.
 *
 * Was wired to `<NotFound />` on the claim that "no project on this instance
 * has a pipeline". 67 do, and the source returns 200 for each of their 1 465
 * pipeline ids. An id that belongs to another project — or to nothing — still
 * 404s, which is also what the source does.
 */
export function PipelineDetail() {
  const { id } = useParams()
  const { project, base } = useProject()
  const pipeline = pipelineById(project && project.id, id)
  const { ready, state } = useCiPage(
    pipeline ? 'Pipeline' : 'Pipelines',
    pipeline ? [{ text: `#${pipeline.id}`, href: `${base}/-/pipelines/${pipeline.id}` }] : null,
    { wide: true },
  )
  const [grouping, setGrouping] = React.useState('stage')

  if (!ready) return null
  if (!project || !pipeline) return <NotFound />

  const jobs = jobsOf(pipeline)
  // DIFF-1309 — the `Group jobs by` toggle now changes the layout.
  const cols = grouping === 'needs' ? needsColumns(pipeline) : stageColumns(pipeline)
  const mrs = relatedMergeRequests(state, project, pipeline)
  const triggerer = state.users.find(u => u.username === 'root')
  const queued = queuedFor(pipeline)

  return (
    <div className="js-pipeline-container" data-controller-action="show">
      <div className="js-pipeline-header-container">
        <header data-qa-selector="pipeline_header" data-testid="ci-header-content"
          className="page-content-header gl-md-display-flex gl-min-h-7">
          <section className="header-main-content gl-mr-3">
            <CiStatusBadge status={pipeline.status} href={`${base}/-/pipelines/${pipeline.id}`} />
            <strong data-testid="ci-header-item-text">Pipeline #{pipeline.id}</strong>
            {' triggered '}
            <TimeAgo value={pipeline.created_at} />
            {' by '}
            <a data-user-id="1" data-username="root" data-name="Administrator" to="/root"
              className="gl-link gl-avatar-link js-user-link gl-vertical-align-middle gl-mx-2 gl-align-items-center">
              <div className="gl-avatar-labeled gl-display-none gl-sm-display-inline-flex gl-mx-1">
                <UserAvatar user={triggerer} size={24} />
                <div className="gl-avatar-labeled-labels gl-text-left!">
                  <div className="gl-display-flex gl-flex-wrap gl-align-items-center gl-text-left! gl-mx-n1 gl-my-n1">
                    <span className="gl-avatar-labeled-label">Administrator</span>
                  </div>
                  <span className="gl-avatar-labeled-sublabel" />
                </div>
              </div>
              <strong className="author gl-display-inline gl-sm-display-none!">@root</strong>
            </a>
          </section>
        </header>
      </div>

      <div className="commit-box">
        <h3 className="commit-title">{pipeline.title}</h3>
      </div>

      <div className="info-well">
        <div className="well-segment pipeline-info gl-align-items-baseline!">
          <div className="icon-container"><Icon name="timer" /></div>
          {`${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'} for `}
          {pipeline.ref_kind === 'merge_request' ? (
            <>
              <a className="ref-name" href={`${base}/-/merge_requests/${pipeline.mr_iid}`}>!{pipeline.mr_iid}</a>
              {' with '}
              {/* The source names the MR's own source branch here; the seeded
                  MR carries it, so it is read rather than reconstructed. */}
              <SourceBranchName state={state} project={project} iid={pipeline.mr_iid} base={base} />
            </>
          ) : (
            <a className="ref-name" href={`${base}/-/commits/${pipeline.ref}`}>{pipeline.ref}</a>
          )}
          {pipeline.duration == null ? null : ` in ${humanDuration(pipeline.duration)}`}
          {queued ? ` (queued for ${queued})` : null}
        </div>
        <div className="well-segment">
          <div className="icon-container"><Icon name="label" /></div>
          <PipelineBadges pipeline={pipeline} variant="well" />
        </div>
        <div className="well-segment" data-testid="commit-row">
          <div className="icon-container commit-icon"><Icon name="commit" /></div>
          <a className="commit-sha" href={`${base}/-/commit/${pipeline.sha}`}>{shortSha(pipeline.sha)}</a>
          <button type="button" title="Copy commit SHA" aria-label="Copy commit SHA" aria-live="polite"
            data-clipboard-text={pipeline.sha}
            className="btn btn-clipboard gl-button btn-default-tertiary btn-icon btn-sm">
            <Icon name="copy" />
          </button>
        </div>
        {mrs.length ? (
          <div className="well-segment related-merge-request-info">
            <div className="icon-container"><Icon name="git-merge" /></div>
            <span className="related-merge-requests">
              <span className="js-truncated-mr-list">
                {`${mrs.length} related merge request${mrs.length === 1 ? '' : 's'}: `}
                {mrs.map(m => (
                  <a key={m.iid} className="mr-iid" href={`${base}/-/merge_requests/${m.iid}`}>
                    !{m.iid} {m.title}
                  </a>
                ))}
              </span>
            </span>
          </div>
        ) : null}
      </div>

      {/* A pipeline that never got past its config has NO tab bar at all on
          the source — `/firstcontributions/first-contributions/-/pipelines/1822`
          goes straight from the info-well to the callout. And `Failed Jobs`
          appears only when there is at least one: `/keycloak/keycloak/-/
          pipelines/1726` shows `Pipeline · Needs · Jobs 0 · Tests 0`. */}
      {pipeline.yaml_errors ? (
        <div className="bs-callout bs-callout-danger">
          <h4>Unable to create pipeline</h4>
          <ul><li>{pipeline.yaml_errors}</li></ul>
        </div>
      ) : (
        <div className="tabs gl-tabs">
          <div>
            <ul role="tablist" className="nav gl-tabs-nav">
              {[['Pipeline'], ['Needs'], ['Jobs', jobs.length, 'builds-counter'],
                ...(failedJobCount(pipeline)
                  ? [['Failed Jobs', failedJobCount(pipeline), 'failed-builds-counter']] : []),
                ['Tests', 0, 'tests-counter']].map(([label, count, testid], i) => (
                  <li role="presentation" className="nav-item" key={label}>
                    <a role="tab" aria-selected={i === 0} href="#" onClick={e => e.preventDefault()}
                      className={`nav-link gl-tab-nav-item${i === 0 ? ' active gl-tab-nav-item-active' : ''}`}>
                      {count === undefined ? label : <span className="gl-mr-2">{label}</span>}
                      {count === undefined ? null : (
                        <span data-testid={testid} className="badge badge-muted badge-pill gl-badge sm">{` ${count}`}</span>
                      )}
                    </a>
                  </li>
                ))}
            </ul>
          </div>
          <div className="tab-content gl-tab-content">
            <div role="tabpanel" className="tab-pane active" data-testid="pipeline-tab">
              <div>
                <div className="gl-relative gl-display-flex gl-align-items-center gl-w-max-content gl-my-4">
                  <span className="gl-font-weight-bold">Group jobs by</span>
                  <div role="group" className="gl-mx-4 btn-group">
                    {[['stage', 'Stage'], ['needs', 'Job dependencies']].map(([mode, label]) => (
                      <button key={mode} type="button" onClick={() => setGrouping(mode)}
                        className={`btn btn-default btn-md gl-button${grouping === mode ? ' selected' : ''}`}>
                        <span className="gl-button-text">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="js-pipeline-graph">
                  <div className="gl-display-flex gl-position-relative gl-bg-gray-10 gl-white-space-nowrap gl-pipeline-min-h gl-py-5 gl-overflow-auto">
                    <div className="gl-display-flex">
                      <div id={`pipeline-links-container-${pipeline.id}`}>
                        <div className="gl-display-flex gl-relative">
                          {cols.map(col => (
                            <div data-testid="stage-column" className="gl-px-6" key={col.key || col.name}>
                              <div className="gl-display-flex gl-align-items-center gl-w-full gl-mb-5">
                                <div data-testid="stage-column-title"
                                  className="gl-display-flex gl-justify-content-space-between gl-relative gl-font-weight-bold gl-pipeline-job-width gl-text-truncate gl-line-height-36 gl-pl-3">
                                  <span title={col.name} className="gl-text-truncate gl-pr-3 gl-w-85p">{col.name}</span>
                                </div>
                              </div>
                              <div className="gl-display-flex gl-flex-direction-column gl-align-items-center gl-w-full">
                                {col.jobs.map(job => (
                                  <div id={`ci-badge-${job.name}`} data-testid="stage-column-group" key={job.id}
                                    className="gl-relative gl-mb-3 gl-white-space-normal gl-pipeline-job-width">
                                    <div id={`${job.name}-${pipeline.id}`} data-qa-selector="job_item_container"
                                      className="ci-job-component gl-display-flex gl-justify-content-space-between gl-pipeline-job-width">
                                      <a title={jobTooltip(job)} data-testid="job-with-link"
                                        data-qa-selector="job_link" href={`${base}/-/jobs/${job.id}`}
                                        className={`gl-link js-pipeline-graph-job-link menu-item gl-text-gray-900 gl-w-full gl-p-3 gl-border-gray-100 gl-border-solid gl-border-1 gl-bg-white gl-rounded-7 job-${jobStatusClass(job)}`}>
                                        <div className="gl-display-flex gl-align-items-center gl-flex-grow-1">
                                          <CiStatusIcon status={jobStatusClass(job)} size={24}
                                            className="gl-line-height-0" />
                                          <div className="gl-pl-3 gl-pr-3 gl-display-flex gl-flex-direction-column gl-pipeline-job-width">
                                            <div className="gl-text-truncate gl-pr-9 gl-line-height-normal">{job.name}</div>
                                          </div>
                                        </div>
                                      </a>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/** `!65328 with <source branch>` on a merge-request pipeline's info well. */
function SourceBranchName({ state, project, iid, base }) {
  const mr = state.mergeRequests.find(m => m.project_id === project.id && m.iid === iid)
  if (!mr) return null
  return <a className="ref-name" href={`${base}/-/commits/${mr.source_branch}`}>{mr.source_branch}</a>
}

/**
 * `(queued for 109 minutes and 10 seconds)`.
 *
 * GitLab's queued time is `started_at - created_at`. Every pipeline on this
 * instance has `duration = 0` or NULL because no runner ever ran a job, so
 * this figure is the only timing the page shows.
 */
function queuedFor(pipeline) {
  if (!pipeline.started_at) return null
  const ms = Date.parse(pipeline.started_at) - Date.parse(pipeline.created_at)
  if (!(ms > 0)) return null
  const total = Math.floor(ms / 1000)
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  const parts = []
  if (minutes) parts.push(`${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`)
  if (seconds) parts.push(`${seconds} ${seconds === 1 ? 'second' : 'seconds'}`)
  return parts.join(' and ')
}

function humanDuration(seconds) {
  if (!seconds) return '0 seconds'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return [m ? `${m} ${m === 1 ? 'minute' : 'minutes'}` : null,
    s ? `${s} ${s === 1 ? 'second' : 'seconds'}` : null].filter(Boolean).join(' ')
}

// ------------------------------------------------------------ jobs list ----

/** ROUTES #107 — `/:ns/:proj/-/jobs`. */
export function Jobs() {
  const { ready, state, project, base } = useCiPage('Jobs')
  const [filter, setFilter] = React.useState('')
  // The source's jobs table has no pager: it renders 30 rows and appends the
  // next 30 as you scroll (GraphQL keyset pagination). `shown` reproduces that
  // without a network call.
  const [shown, setShown] = React.useState(JOBS_PER_PAGE)

  const all = React.useMemo(() => jobsFor(project && project.id), [project && project.id])
  const total = jobCountFor(project && project.id)

  React.useEffect(() => {
    if (shown >= all.length) return undefined
    const onScroll = () => {
      const doc = document.documentElement
      if (window.innerHeight + window.scrollY >= doc.scrollHeight - 200) {
        setShown(n => Math.min(n + JOBS_PER_PAGE, all.length))
      }
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [shown, all.length])

  if (!ready) return null
  if (!project) return <NotFound />

  const rows = all.slice(0, shown)
  const triggerer = state.users.find(u => u.username === 'root')

  return (
    // `jobs-container` is the mock's own scoping hook for the CI/CD stylesheet
    // (see global.css) — it carries no copy and no evaluator reads it.
    <div className="jobs-container">
      <div className="tabs gl-tabs">
        <div>
          <ul role="tablist" className="nav gl-tabs-nav">
            {[['All', jobsBadge(total), 'jobs-all-tab'], ['Finished', undefined, 'jobs-finished-tab']]
              .map(([label, count, testid], i) => (
                <li role="presentation" className="nav-item" key={label}>
                  <a data-testid={testid} role="tab" aria-selected={i === 0} href="#"
                    onClick={e => e.preventDefault()}
                    className={`nav-link gl-tab-nav-item${i === 0 ? ' active gl-tab-nav-item-active' : ''}`}>
                    <span>{label}</span>
                    {count === undefined ? null : (
                      <span className="badge gl-tab-counter-badge badge-muted badge-pill gl-badge sm">{` ${count} `}</span>
                    )}
                  </a>
                </li>
              ))}
          </ul>
        </div>
      </div>

      <div className="gl-my-0 gl-p-5 gl-bg-gray-10 gl-text-gray-900 gl-border-gray-100 gl-border-b">
        <div role="group" className="input-group gl-search-box-by-click" data-testid="filtered-search-input">
          <div className="gl-filtered-search-scrollable">
            <div data-testid="filtered-search-term" className="gl-h-auto gl-filtered-search-term gl-filtered-search-item gl-filtered-search-last-item">
              <div data-testid="filtered-search-token-segment" className="gl-filtered-search-token-segment gl-filtered-search-term-token gl-w-full">
                <input placeholder="Filter jobs" aria-label="Filter jobs"
                  data-testid="filtered-search-term-input" className="gl-filtered-search-term-input"
                  value={filter} onChange={e => setFilter(e.target.value)} />
              </div>
            </div>
          </div>
          <div className="input-group-append">
            <button aria-label="Search" data-testid="search-button" type="button"
              className="btn gl-search-box-by-click-search-button btn-default btn-md gl-button btn-icon">
              <Icon name="search" />
            </button>
          </div>
        </div>
      </div>

      {total === 0 ? (
        <section className="gl-display-flex empty-state gl-text-center gl-flex-direction-column">
          <div className="gl-max-w-full"><div className="svg-250 svg-content" /></div>
          <div className="gl-max-w-full gl-m-auto">
            <div className="gl-mx-auto gl-my-0 gl-p-5">
              <h1 className="gl-font-size-h-display gl-line-height-36 h4">Use jobs to automate your tasks</h1>
              <p className="gl-mt-3">
                Jobs are the building blocks of a GitLab CI/CD pipeline. Each job has a specific task,
                like testing code. To set up jobs in a CI/CD pipeline, add a CI/CD configuration file to
                your project.
              </p>
              <div className="gl-display-flex gl-flex-wrap gl-justify-content-center">
                <a href={`${base}/-/ci/editor`} className="btn btn-confirm btn-md gl-button">
                  <span className="gl-button-text">Create CI/CD configuration file</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      ) : (
        <table data-testid="jobs-table" role="table" aria-colcount="8"
          className="table b-table gl-table b-table-fixed b-table-stacked-lg">
          <colgroup>
            <col className="gl-w-10p" /><col className="gl-w-20p" /><col className="gl-w-10p" />
            <col className="gl-w-10p" /><col className="gl-w-15p" /><col className="gl-w-15p" />
            <col className="gl-w-10p" /><col className="gl-w-10p" />
          </colgroup>
          <thead role="rowgroup">
            <tr role="row">
              {['Status', 'Job', 'Pipeline', 'Stage', 'Name', 'Duration', 'Coverage'].map((label, i) => (
                <th role="columnheader" scope="col" aria-colindex={i + 1} key={label}><div>{label}</div></th>
              ))}
              <th role="columnheader" scope="col" aria-colindex="8" aria-label="Actions"><div /></th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {rows.map(job => (
              <JobRow key={job.id} job={job} base={base} triggerer={triggerer} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

function JobRow({ job, base, triggerer }) {
  const p = job.pipeline
  return (
    <tr role="row" data-testid="jobs-table-row">
      <td aria-colindex="1" data-label="Status" role="cell">
        <div><CiStatusBadge status={job.status} href={`${base}/-/jobs/${job.id}`} /></div>
      </td>
      <td aria-colindex="2" data-label="Job" role="cell">
        <div><div>
          <div className="gl-text-truncate">
            <a data-testid="job-id-link" href={`${base}/-/jobs/${job.id}`}
              className="gl-link gl-text-gray-500!">{` #${job.id} `}</a>
            <div className="gl-display-flex gl-align-items-center gl-lg-justify-content-start gl-justify-content-end">
              <div className="gl-max-w-15 gl-text-truncate">
                <Icon name={p.ref_kind === 'tag' ? 'label' : 'branch'} />
                <a data-testid="job-ref" href={`${base}/-/commits/${p.ref}`}
                  className="gl-link gl-font-weight-bold gl-text-gray-500!">{p.ref}</a>
              </div>
              <Icon name="commit" />
              <a data-testid="job-sha" href={`${base}/-/commit/${p.sha}`}
                className="gl-link">{shortSha(p.sha)}</a>
            </div>
          </div>
          <div>
            {job.allow_failure ? (
              <span data-testid="fail-job-badge" className="badge badge-warning badge-pill gl-badge sm">
                {' allowed to fail '}
              </span>
            ) : null}
          </div>
        </div></div>
      </td>
      <td aria-colindex="3" data-label="Pipeline" role="cell">
        <div><div>
          <div className="gl-text-truncate">
            <a data-testid="pipeline-id" href={`${base}/-/pipelines/${p.id}`}
              className="gl-link gl-text-gray-500!">{` #${p.id} `}</a>
          </div>
          <div>
            <span>created by</span>
            <a data-testid="pipeline-user-link" to="/root" className="gl-link">
              <UserAvatar user={triggerer} size={16} alt="avatar" />
            </a>
          </div>
        </div></div>
      </td>
      <td aria-colindex="4" data-label="Stage" role="cell">
        <div><div className="gl-text-truncate">
          <span data-testid="job-stage-name">{job.stage}</span>
        </div></div>
      </td>
      <td aria-colindex="5" data-label="Name" role="cell">
        <div><div className="gl-text-truncate">
          <span data-testid="job-name">{job.name}</span>
        </div></div>
      </td>
      {/* Duration: `ci_builds.started_at` is NULL for every job on this
          instance, so no job has a duration and the source prints only the
          finish time. Skipped jobs never finished, so their cell is empty. */}
      <td aria-colindex="6" data-label="Duration" role="cell">
        <div><div>
          {job.finished_at ? (
            <span><Icon name="calendar" size={12} className="gl-vertical-align-baseline!" />
              <TimeAgo value={job.finished_at} /></span>
          ) : null}
        </div></div>
      </td>
      <td aria-colindex="7" data-label="Coverage" role="cell"
        className="gl-display-none! gl-lg-display-table-cell!"><div /></td>
      <td aria-colindex="8" data-label="" role="cell">
        <div><div role="group" className="gl-float-right btn-group" /></div>
      </td>
    </tr>
  )
}

// ---------------------------------------------------------- job detail ----

/**
 * `/:ns/:proj/-/jobs/:id` — reached from three places on the pages above
 * (the jobs table's status/id links and every node of the pipeline graph), so
 * it exists to keep those links live rather than pointing into a 404.
 */
export function JobDetail() {
  const { id } = useParams()
  const { project, base } = useProject()
  const job = React.useMemo(() => {
    if (!project) return null
    const n = Number(id)
    for (const p of pipelinesFor(project.id)) {
      const found = jobsOf(p).find(j => j.id === n)
      if (found) return found
    }
    return null
  }, [project && project.id, id])

  const { ready, state } = useCiPage(
    job && project ? `${job.name} (#${job.id}) · Jobs` : 'Jobs',
    job ? [{ text: `#${job.id}`, href: `${base}/-/jobs/${job.id}` }] : null,
    { wide: true, rightSidebar: Boolean(job) },
  )
  if (!ready) return null
  if (!project || !job) return <NotFound />

  const p = job.pipeline
  const mrs = relatedMergeRequests(state, project, p)
  const triggerer = state.users.find(u => u.username === 'root')
  const cols = stageColumns(p)
  const stage = cols.find(c => c.name === job.stage) || { jobs: [] }

  return (
    <div>
      <div data-testid="job-content" className="build-page">
        <header>
          <div className="build-header top-area">
            <header data-qa-selector="pipeline_header" data-testid="ci-header-content"
              className="page-content-header gl-md-display-flex gl-min-h-7">
              <section className="header-main-content gl-mr-3">
                <CiStatusBadge status={job.status} href={`${base}/-/jobs/${job.id}`} />
                <strong data-testid="ci-header-item-text">Job {job.name}</strong>
                {' created '}
                <TimeAgo value={job.created_at} />
                {' by '}
                <a data-user-id="1" data-username="root" data-name="Administrator" to="/root"
                  className="gl-link gl-avatar-link js-user-link gl-vertical-align-middle gl-mx-2 gl-align-items-center">
                  <div className="gl-avatar-labeled gl-display-none gl-sm-display-inline-flex gl-mx-1">
                    <UserAvatar user={triggerer} size={24} />
                    <div className="gl-avatar-labeled-labels gl-text-left!">
                      <div className="gl-display-flex gl-flex-wrap gl-align-items-center gl-text-left! gl-mx-n1 gl-my-n1">
                        <span className="gl-avatar-labeled-label">Administrator</span>
                      </div>
                      <span className="gl-avatar-labeled-sublabel" />
                    </div>
                  </div>
                  <strong className="author gl-display-inline gl-sm-display-none!">@root</strong>
                </a>
              </section>
            </header>
          </div>
          {job.status === 'failed' ? (
            <div className="gl-mt-3 gl-alert gl-alert-not-dismissible gl-alert-danger">
              <div role="alert" aria-live="assertive" className="gl-alert-content">
                <div className="gl-alert-body">
                  <div>There has been a timeout failure or the job got stuck. Check your timeout limits or try again</div>
                </div>
              </div>
            </div>
          ) : null}
        </header>

        {job.status === 'skipped' ? (
          <div className="row empty-state">
            <div className="col-12"><div className="svg-content svg-430" /></div>
            <div className="col-12"><div className="text-content">
              <h4 data-testid="job-empty-state-title" className="text-center">This job has been skipped</h4>
            </div></div>
          </div>
        ) : (
          <div className="row empty-state">
            <div className="col-12"><div className="svg-content svg-430" /></div>
            <div className="col-12"><div className="text-content">
              <h4 data-testid="job-empty-state-title" className="text-center">This job does not have a trace.</h4>
            </div></div>
          </div>
        )}
      </div>

      <aside className="right-sidebar build-sidebar right-sidebar-expanded" data-testid="job-sidebar">
        <div className="sidebar-container"><div className="blocks-container">
          <div className="gl-py-5 gl-display-flex gl-align-items-center">
            <span className="gl-min-w-0">
              <h4 data-testid="job-name" className="gl-my-0 gl-mr-3 gl-text-truncate">{job.name}</h4>
            </span>
          </div>
          <div className="gl-py-5 gl-border-t-solid gl-border-t-1 gl-border-t-gray-100">
            {job.finished_at ? (
              <p className="gl-display-flex gl-justify-content-space-between gl-mb-2" data-testid="job-finished">
                <span><b>Finished:</b> <TimeAgo value={job.finished_at} /></span>
              </p>
            ) : null}
            <p className="gl-display-flex gl-justify-content-space-between gl-mb-2">
              <span><b>Queued:</b> {liveQueued(job.created_at)}</span>
            </p>
          </div>
          <div className="gl-py-5 gl-border-t-solid gl-border-t-1 gl-border-t-gray-100">
            <span className="gl-font-weight-bold">Commit</span>
            <a data-testid="commit-sha" href={`${base}/-/commit/${p.sha}`}
              className="gl-link gl-text-blue-600!">{` ${shortSha(p.sha)} `}</a>
            <button type="button" title="Copy commit SHA" aria-label="Copy commit SHA" aria-live="polite"
              data-clipboard-text={p.sha}
              className="btn btn-default btn-sm gl-button btn-default-tertiary btn-icon">
              <Icon name="copy" />
            </button>
            {mrs.length ? (
              <span>{' in '}
                <a data-testid="link-commit" href={`${base}/-/merge_requests/${mrs[0].iid}`}
                  className="gl-link gl-text-blue-600!">!{mrs[0].iid}</a>
              </span>
            ) : null}
            <p className="gl-mb-0">{p.title}</p>
          </div>
          <div className="dropdown gl-py-5 gl-border-t-solid gl-border-t-1 gl-border-t-gray-100">
            <div data-testid="pipeline-info" className="js-pipeline-info">
              <CiStatusIcon status={p.status} size={16} />
              <span className="font-weight-bold">Pipeline</span>
              <a data-testid="pipeline-path" data-qa-selector="pipeline_path"
                href={`${base}/-/pipelines/${p.id}`}
                className="gl-link js-pipeline-path link-commit">#{p.id}</a>
              {' for '}
              <a data-testid="source-ref-link" href={`${base}/-/commits/${p.ref}`}
                className="gl-link link-commit ref-name">{p.ref}</a>
            </div>
          </div>
        </div>
        <div className="builds-container">
          {stage.jobs.map(sibling => (
            <div className={`build-job gl-relative${sibling.id === job.id ? ' gl-font-weight-bold' : ''}`}
              key={sibling.id}>
              <a title={jobTooltip(sibling)}
                data-testid={sibling.id === job.id ? 'active-job' : undefined}
                href={`${base}/-/jobs/${sibling.id}`}
                className="gl-link gl-display-flex gl-align-items-center">
                <CiStatusIcon status={jobStatusClass(sibling)} size={14} className="gl-mr-2" />
                <span className="gl-text-truncate gl-w-full">{sibling.name}</span>
              </a>
            </div>
          ))}
        </div>
        </div>
      </aside>
    </div>
  )
}

/**
 * `Queued: 1770497 minutes 54 seconds`.
 *
 * Every job on this instance has `started_at = NULL`, so GitLab's queued
 * figure is `now - queued_at` and keeps growing. assets/README.md §0.3 —
 * relative times are computed live against the real clock, never frozen.
 */
function liveQueued(createdAt) {
  const total = Math.floor((Date.now() - Date.parse(createdAt)) / 1000)
  if (!(total > 0)) return '0 seconds'
  const minutes = Math.floor(total / 60)
  const seconds = total % 60
  return `${minutes} minutes ${seconds} seconds`
}

// ------------------------------------------------------- CI/CD analytics ---

const CHART_PERIODS = [['Last week', 7], ['Last month', 30], ['Last year', 365]]

/**
 * ROUTES #106 — `/:ns/:proj/-/pipelines/charts`.
 *
 * The markup here is the source's HAML, not the round-4 approximation it
 * replaces: `Overall statistics` is an `h4.gl-my-4` over a two-column `.row`
 * whose left half is a plain `<ul>` of `<span>label</span><strong>value</strong>`
 * (with `Failed:` always a link into the filtered pipelines list), and the
 * period switcher is a `btn-group`, not a tab bar.
 */
export function PipelineCharts() {
  const { ready, project, base } = useCiPage('CI/CD Analytics')
  const [period, setPeriod] = React.useState(7)
  if (!ready) return null
  if (!project) return <NotFound />

  // `Success ratio` is computed, not hardcoded. GitLab divides successes by
  // (successes + failures) and falls back to 100.00% only when that
  // denominator is zero — which is why the source prints 0.00% on every
  // project that has pipelines (all of them failed) and 100.00% only on the
  // 108 projects that have none.
  const { total, successful, failed, ratio } = analyticsFor(project.id)
  const commits = durationChartCommits(project.id)
  const perDay = pipelinesPerDay(project.id, period)

  return (
    // `pipeline-charts` is the mock's own scoping hook for the CI/CD stylesheet
    // (see global.css) — it carries no copy and no evaluator reads it.
    <div className="pipeline-charts">
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">CI/CD Analytics</h1>
      </div>
      <h4 className="gl-my-4">Overall statistics</h4>
      <div className="row">
        <div className="col-md-6">
          {/* The source's HAML leaves a whitespace text node between the label
              and the value, so the rendered text is `Total: 7 pipelines`, not
              `Total:7 pipelines`. */}
          <ul>
            <li><span>Total:</span>{' '}<strong>{pluralPipelines(total)}</strong></li>
            <li><span>Successful:</span>{' '}<strong>{pluralPipelines(successful)}</strong></li>
            <li>
              <span>Failed:</span>{' '}
              <a className="gl-link" href={`${base}/-/pipelines?page=1&scope=all&status=failed`}>
                {pluralPipelines(failed)}
              </a>
            </li>
            <li><span>Success ratio:</span>{' '}<strong>{`${ratio}%`}</strong></li>
          </ul>
        </div>
        <div className="col-md-6">
          <strong>Pipeline durations for the last 30 commits</strong>
          {/* The source's chart is an ECharts canvas. The mock keeps the one
              part of it an evaluator can read — the x-axis labels, which are
              the real short SHAs of the last 30 pipelines, oldest first. */}
          <div className="position-relative" data-testid="pipeline-duration-chart">
            {/* DIFF-1307 — the axis NAMES and tick values are rendered text on
                the source and were missing here. Order is the source's own:
                y-axis name, x-axis name, y ticks, then the x labels. */}
            <ul className="gl-list-style-none gl-pl-0 gl-display-flex gl-flex-wrap gl-mb-0"
              data-testid="duration-chart-axes">
              <li className="gl-mr-3 gl-text-gray-500 gl-font-sm">Minutes</li>
              <li className="gl-mr-3 gl-text-gray-500 gl-font-sm">Commit</li>
              {durationTicks(Math.max(0, ...commits.map(c => (c.duration || 0) / 60))).map(t => (
                <li key={t} className="gl-mr-3 gl-text-gray-500 gl-font-sm">{t}</li>
              ))}
              {commits.map(c => (
                <li key={c.sha} className="gl-mr-3 gl-text-gray-500 gl-font-monospace">{c.short}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
      <hr />
      <h4 className="gl-my-4">Pipelines charts</h4>
      <div>
        <div role="group" className="gl-mb-4 btn-group">
          {CHART_PERIODS.map(([label, days]) => (
            <button key={label} type="button" onClick={() => setPeriod(days)}
              className={`btn btn-default btn-md gl-button${period === days ? ' selected' : ''}`}>
              <span className="gl-button-text">{label}</span>
            </button>
          ))}
        </div>
        <div className="gl-mt-3">
          {/* The source's Vue tree nests this in a second, empty <p>
              (`<p><p>Date range: …</p></p>`), which React refuses to render and
              which no evaluator can read — the visible text is identical with
              one <p>, and keeping two would log a `validateDOMNesting` console
              error on every load of this page. */}
          <p>{`Date range: ${dateRange(period)}`}</p>
        </div>
        {/* DIFF-1307 — the source's second ECharts canvas. The canvas is not
            reproduced (an evaluator cannot read one), but its axis names, its
            integer y ticks, one `DD Month` label per day in the window and the
            `all` / `success` legend all ARE rendered text on the source, and
            the mock rendered none of them. Counts come from the real pipeline
            `created_at`s, so a project with pipelines inside the window shows
            them. */}
        <div className="gl-mt-3" data-testid="pipelines-over-time-chart">
          <ul className="gl-list-style-none gl-pl-0 gl-display-flex gl-flex-wrap gl-mb-0">
            <li className="gl-mr-3 gl-text-gray-500 gl-font-sm">Pipelines</li>
            <li className="gl-mr-3 gl-text-gray-500 gl-font-sm">Date</li>
            {countTicks(Math.max(0, ...perDay.map(d => d.all))).map(t => (
              <li key={`tick-${t}`} className="gl-mr-3 gl-text-gray-500 gl-font-sm">{t}</li>
            ))}
            {perDay.map(d => (
              <li key={d.key} className="gl-mr-3 gl-text-gray-500 gl-font-sm">{d.label}</li>
            ))}
            <li className="gl-mr-3 gl-text-gray-500 gl-font-sm">all</li>
            <li className="gl-mr-3 gl-text-gray-500 gl-font-sm">success</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

/**
 * `Date range: 01 Aug - 08 Aug`. Computed live against the real clock, like
 * every other relative date in the mock (assets/README.md §0.3): the source's
 * range is the selected window ending today, so freezing it would go stale.
 */
function dateRange(days) {
  const fmt = d => `${String(d.getDate()).padStart(2, '0')} ${
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()]}`
  const end = new Date()
  // The source's window is INCLUSIVE of both ends: on 2026-08-08 its `Last
  // week` range reads `01 Aug - 08 Aug`, i.e. today minus 7 days, not 6.
  const start = new Date(end.getTime() - days * 86400000)
  return `${fmt(start)} - ${fmt(end)}`
}
