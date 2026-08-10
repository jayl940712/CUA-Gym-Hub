// ---------------------------------------------------------------------------
// CI/CD reference data — STATIC, like the seven git modules in dataManager.js.
//
// `src/data/ci_pipelines.json` is read-only reference data extracted from the
// source's `ci_pipelines` / `ci_builds` tables (SELECT only) plus the source's
// own `/-/pipelines.json` payload. It is imported directly by the four CI
// views and is NEVER copied into `createInitialData()`, so it costs the
// mutable session state — the thing `/go` POSTs and diffs — exactly zero bytes.
// Nothing in the mock mutates a pipeline or a job, so there is no state to
// carry: the source has no runners, so no pipeline can ever be re-run here.
//
// Coverage is COMPLETE, not sampled: all 1 465 pipelines and all 14 179 jobs
// the instance has, across all 67 projects that have any. The other 108 seeded
// projects genuinely have none and correctly render the source's empty state.
//
// The 1.06 MB of pipeline rows is per-project, so it was split out of
// `ci_pipelines.json` into the lazy per-project chunks by
// `assets/dumps/build_lazy_chunks.py`. What is left here — the 14-entry job
// vocabulary, the two status strings and the three page sizes — is
// `ci_header.json`, ~2 KB, and stays eager because it is shared by every
// project. `pipelinesFor()` therefore reads the chunk, and the four CI views
// are project routes, so the chunk gate in App.jsx has already awaited it.
// ---------------------------------------------------------------------------
import header from '../data/ci_header.json'
import { chunkFor, EMPTY } from '../data/lazy.js'

/** `[name, stage, stage_idx, allow_failure]` — the closed 14-entry vocabulary. */
const SPECS = header.job_specs
const STATUSES = header.statuses

/** Source page sizes, measured off the live site (DEV.r12-cicd.md §1.3). */
export const PIPELINES_PER_PAGE = header._page_size.pipelines // 15
export const JOBS_PER_PAGE = header._page_size.jobs           // 30
export const JOBS_COUNT_CAP = header._page_size.jobs_count_cap // `1,000+`

/** Every pipeline of a project, newest first — the source's own order. */
export function pipelinesFor(projectId) {
  if (projectId == null) return EMPTY
  const chunk = chunkFor(projectId)
  return (chunk && chunk.pipelines) || EMPTY
}

/** One pipeline by its real id, scoped to the project (`/-/pipelines/:id`). */
export function pipelineById(projectId, id) {
  const n = Number(id)
  if (!Number.isFinite(n)) return null
  return pipelinesFor(projectId).find(p => p.id === n) || null
}

/**
 * Expand a pipeline's packed job tuples.
 *
 * `[id, specIdx, statusIdx, createdOffsetMs, finishedOffsetMs]`, offsets in ms
 * from the pipeline's own `created_at`. `ci_builds.started_at` is NULL for all
 * 14 179 rows on this instance, so no job has a duration and the Duration cell
 * shows only the finish time — exactly as the source renders it.
 */
export function jobsOf(pipeline) {
  if (!pipeline) return EMPTY
  const base = Date.parse(pipeline.created_at)
  return pipeline.jobs.map(([id, specIdx, statusIdx, createdOff, finishedOff]) => {
    const spec = SPECS[specIdx]
    return {
      id,
      name: spec[0],
      stage: spec[1],
      stage_idx: spec[2],
      allow_failure: spec[3],
      status: STATUSES[statusIdx],
      created_at: new Date(base + createdOff).toISOString(),
      finished_at: finishedOff == null ? null : new Date(base + finishedOff).toISOString(),
      pipeline,
    }
  })
}

/**
 * Every job in a project, newest job id first — the source's `/-/jobs` order
 * (verified against `/byteblaze/a11y-webring.club/-/jobs`: #16329 … #16323).
 */
export function jobsFor(projectId) {
  const out = []
  for (const p of pipelinesFor(projectId)) out.push(...jobsOf(p))
  out.sort((a, b) => b.id - a.id)
  return out
}

/** Total job count without materialising the rows (for the `All` badge). */
export function jobCountFor(projectId) {
  let n = 0
  for (const p of pipelinesFor(projectId)) n += p.jobs.length
  return n
}

/**
 * Jobs grouped into the pipeline graph's stage columns.
 *
 * Column order is `stage_idx`; within a column the source orders by job name
 * in codepoint order. Confirmed against the source on the widest pipeline
 * this instance has (`/OpenAPITools/openapi-generator/-/pipelines/789`, 13
 * jobs in `test`): brakeman-sast, code_intelligence_go, code_quality,
 * container_scanning, flawfinder-sast, nodejs-scan-sast,
 * phpcs-security-audit-sast, pmd-apex-sast, secret_detection,
 * security-code-scan-sast, semgrep-sast, spotbugs-sast, test.
 */
export function stageColumns(pipeline) {
  const jobs = jobsOf(pipeline)
  const byStage = new Map()
  for (const j of jobs) {
    if (!byStage.has(j.stage)) byStage.set(j.stage, { name: j.stage, idx: j.stage_idx, jobs: [] })
    byStage.get(j.stage).jobs.push(j)
  }
  const cols = [...byStage.values()].sort((a, b) => a.idx - b.idx)
  for (const c of cols) c.jobs.sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
  return cols
}

/**
 * TEST.md DIFF-1309 — `Group jobs by` → `Job dependencies`.
 *
 * GitLab's `needs` view drops the stage grouping and gives every job its own
 * column, headed by the stage that job belongs to. Measured on the source at
 * `/byteblaze/a11y-webring.club/-/pipelines/1823`:
 *
 *   Stage            build | build | test | code_quality | container_scanning | …
 *   Job dependencies build | build | code_quality | test | test | test | …
 *
 * i.e. one `<job name, stage name>` pair per column instead of one column per
 * stage. This instance has never run a job, so `ci_builds.needs` is empty on all
 * 14 179 rows and there is no dependency edge to lay out — every job is a root,
 * which is exactly the flat one-column-per-job layout the source renders.
 *
 * The button used to be inert: clicking it left the DOM byte-identical.
 */
export function needsColumns(pipeline) {
  return jobsOf(pipeline)
    .slice()
    .sort((a, b) => (a.stage_idx - b.stage_idx) || (a.id - b.id))
    .map(j => ({ name: j.stage, key: `needs-${j.id}`, jobs: [j] }))
}

/**
 * The CSS/status class GitLab gives a job: a failed job that is
 * `allow_failure` renders as `failed-with-warnings`, not `failed`
 * (`ci-status-icon-failed-with-warnings` on the source's graph nodes).
 */
export function jobStatusClass(job) {
  return job.status === 'failed' && job.allow_failure ? 'failed-with-warnings' : job.status
}

/**
 * The graph node's `title`, verbatim from the source, e.g.
 *   `build - failed - (stuck or timeout failure)`
 *   `code_quality - failed - (stuck or timeout failure) (allowed to fail)`
 *   `container_scanning - skipped`
 *
 * Every failed build on this instance has `failure_reason = 3`
 * (`stuck_or_timeout_failure`); no other reason occurs. `(allowed to fail)` is
 * appended only when the job actually failed — a *skipped* `allow_failure` job
 * reads plain `brakeman-sast - skipped` on the source, not
 * `… - skipped (allowed to fail)`.
 */
export function jobTooltip(job) {
  let t = `${job.name} - ${job.status}`
  if (job.status !== 'failed') return t
  t += ' - (stuck or timeout failure)'
  if (job.allow_failure) t += ' (allowed to fail)'
  return t
}

/** `Failed Jobs` tab counter — failed jobs that are not `allow_failure`. */
export function failedJobCount(pipeline) {
  return jobsOf(pipeline).filter(j => j.status === 'failed').length
}

/**
 * CI/CD Analytics `Overall statistics`.
 *
 * GitLab counts the project's pipelines by status and prints
 * `Success ratio: <success / (success + failed) * 100>%`, falling back to
 * **100.00%** only when the denominator is zero — which is why the source
 * shows `100.00%` on `dotfiles` and `0.00%` on every project that has
 * pipelines (all 1 461 non-skipped pipelines on this instance are `failed`).
 */
export function analyticsFor(projectId) {
  const rows = pipelinesFor(projectId)
  const total = rows.length
  const successful = rows.filter(p => p.status === 'success').length
  const failed = rows.filter(p => p.status === 'failed').length
  const denom = successful + failed
  const ratio = denom === 0 ? 100 : (successful / denom) * 100
  return { total, successful, failed, ratio: ratio.toFixed(2) }
}

/** `Pipeline durations for the last 30 commits` — the x-axis labels. */
export function durationChartCommits(projectId) {
  return pipelinesFor(projectId)
    .slice(0, 30)
    .map(p => ({ sha: p.sha, short: (p.sha || '').slice(0, 8), duration: p.duration || 0 }))
    .reverse()
}

/**
 * TEST.md DIFF-1307 — the axis labels of the two ECharts canvases on
 * `/-/pipelines/charts`. The canvases themselves are not readable by an
 * evaluator and are deliberately not reproduced, but their **axis names, tick
 * values, day labels and legend are rendered text on the source** and were
 * missing from the mock entirely.
 *
 * Measured on the source at `/byteblaze/a11y-webring.club/-/pipelines/charts`:
 *
 *   duration chart : Minutes · Commit · 0 0.2 0.4 0.6 0.8 1 · <short shas>
 *   over-time chart: Pipelines · Date · 0 1 · 01 August … 08 August · all success
 */

/** ECharts' `0 0.2 0.4 0.6 0.8 1` when the data maxes out at 0. */
export function durationTicks(maxMinutes) {
  const max = Number(maxMinutes) > 0 ? Number(maxMinutes) : 1
  const step = max / 5
  const decimals = step < 1 ? 1 : 0
  return Array.from({ length: 6 }, (_, i) => {
    const v = step * i
    return decimals ? String(Number(v.toFixed(1))) : String(Math.round(v))
  })
}

/** Integer ticks, `minInterval: 1`, so a max of 0 or 1 still prints `0 1`. */
export function countTicks(max) {
  const top = Math.max(1, Math.ceil(Number(max) || 0))
  const step = Math.max(1, Math.ceil(top / 5))
  const out = []
  for (let v = 0; v <= top; v += step) out.push(String(v))
  if (out[out.length - 1] !== String(top)) out.push(String(top))
  return out
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

/**
 * One bucket per day in the selected window, inclusive of both ends — the same
 * window `dateRange()` prints, so the two never disagree.
 */
export function pipelinesPerDay(projectId, days) {
  const rows = pipelinesFor(projectId)
  const counts = new Map()
  for (const p of rows) {
    const key = String(p.created_at || '').slice(0, 10)
    if (!key) continue
    const bucket = counts.get(key) || { all: 0, success: 0 }
    bucket.all += 1
    if (p.status === 'success') bucket.success += 1
    counts.set(key, bucket)
  }
  const out = []
  const now = new Date()
  for (let i = days; i >= 0; i -= 1) {
    const d = new Date(now.getTime() - i * 86400000)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const bucket = counts.get(key) || { all: 0, success: 0 }
    out.push({
      key,
      label: `${String(d.getDate()).padStart(2, '0')} ${MONTH_NAMES[d.getMonth()]}`,
      all: bucket.all,
      success: bucket.success,
    })
  }
  return out
}

/** `1 pipeline` / `3 pipelines` — GitLab pluralises these figures. */
export function pluralPipelines(n) {
  return `${n} ${n === 1 ? 'pipeline' : 'pipelines'}`
}

/** The `All` badge on `/-/jobs` caps at `1,000+` on the source. */
export function jobsBadge(n) {
  if (n > JOBS_COUNT_CAP) return '1,000+'
  return String(n)
}
