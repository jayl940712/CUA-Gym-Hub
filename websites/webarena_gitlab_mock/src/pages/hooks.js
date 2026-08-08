import { useParams, useSearchParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'

/** Resolve `/:ns/:proj` from the URL against the seed. */
export function useProject() {
  const { ns, proj } = useParams()
  const { state } = useApp()
  const project = state ? state.projects.find(p => p.full_path === `${ns}/${proj}`) : null
  return { project, ns, proj, fullPath: `${ns}/${proj}`, base: `/${ns}/${proj}` }
}

/**
 * Query params, with the repeated-array forms the anchor URLs use.
 * URLSearchParams already decodes `label_name%5B%5D` -> `label_name[]`,
 * `%20` -> space, `%3A` -> `:` and `%F0%9F%90%9E` -> 🐞, so filters just read
 * the decoded keys (ROUTES.md § Query Parameters).
 */
export function useQuery() {
  const [searchParams, setSearchParams] = useSearchParams()
  const get = (k, dflt = null) => (searchParams.has(k) ? searchParams.get(k) : dflt)
  const getAll = k => searchParams.getAll(k)
  return { searchParams, setSearchParams, get, getAll }
}

/**
 * TEST.md DIFF-1304 — the `Open` / `Closed` / `Merged` / `All` tab counters.
 *
 * GitLab recomputes them under the ACTIVE filter: on
 * `/a11yproject/a11yproject.com/-/issues?label_name[]=bug` the source reads
 * `3 / 64 / 67`, not the project's `40 / 570 / 610`. The mock counted the whole
 * project on every tab, so the three numbers never moved when a filter was
 * applied and any "how many open X issues" question would read the wrong one.
 *
 * Everything except `state` applies — the counter for a state has to count the
 * rows that state's tab would show.
 */
export function issuableStateCounts(rows, q, indexes) {
  const withoutState = {
    searchParams: q.searchParams,
    get: (k, dflt = null) => (k === 'state' ? 'all' : q.get(k, dflt)),
    getAll: k => q.getAll(k),
  }
  const matched = filterIssuables(rows, withoutState, indexes)
  return {
    opened: matched.filter(r => r.state === 'opened').length,
    closed: matched.filter(r => r.state === 'closed').length,
    merged: matched.filter(r => r.state === 'merged').length,
    all: matched.length,
  }
}

/**
 * `/:ns/:proj/-/issues?label_name[]=bug` filter semantics, shared by lists.
 *
 * Every param the filtered-search token bar can emit is honoured here — see
 * `src/utils/searchTokens.js` for where each one came from on the source. The
 * project issue list emits the ARRAY forms (`assignee_username[]`,
 * `not[assignee_username][]`); the MR list and the two dashboards emit the
 * SCALAR forms, which is what webarena-156 and -357 anchor on. Both are read.
 */
export function filterIssuables(rows, q, { labelsById, usersByUsername, milestonesById }) {
  let out = rows

  const state = q.get('state', 'opened')
  if (state && state !== 'all') out = out.filter(r => r.state === state)

  // `in=TITLE` / `in=DESCRIPTION` — the `Search Within` token — narrows which
  // field the free-text search reads. Absent, both are searched.
  const search = q.get('search')
  if (search) {
    const needle = search.toLowerCase()
    const scope = String(q.get('in') || '').toUpperCase()
    const inTitle = scope !== 'DESCRIPTION'
    const inBody = scope !== 'TITLE'
    out = out.filter(r => (inTitle && (r.title || '').toLowerCase().includes(needle))
      || (inBody && (r.description || '').toLowerCase().includes(needle)))
  }

  const wanted = q.getAll('label_name[]')
  if (wanted.length) {
    if (wanted.length === 1 && wanted[0] === 'None') {
      out = out.filter(r => !(r.label_ids || []).length)
    } else if (wanted.length === 1 && wanted[0] === 'Any') {
      out = out.filter(r => (r.label_ids || []).length > 0)
    } else {
      out = out.filter(r => wanted.every(title =>
        (r.label_ids || []).some(id => labelsById.get(id) && labelsById.get(id).title === title)))
    }
  }

  const excluded = q.getAll('not[label_name][]')
  if (excluded.length) {
    out = out.filter(r => !excluded.some(title =>
      (r.label_ids || []).some(id => labelsById.get(id) && labelsById.get(id).title === title)))
  }

  const milestoneMatches = (r, title) => {
    const m = r.milestone_id && milestonesById.get(r.milestone_id)
    if (title === 'None') return !r.milestone_id
    if (title === 'Any') return Boolean(r.milestone_id)
    // GitLab's `Upcoming` / `Started` are computed against the milestone's
    // dates rather than its title.
    const now = Date.now()
    const at = v => (v ? new Date(String(v).replace(' ', 'T')).getTime() : null)
    if (title === 'Upcoming') return Boolean(m && at(m.start_date) !== null && at(m.start_date) > now)
    if (title === 'Started') return Boolean(m && at(m.start_date) !== null && at(m.start_date) <= now
      && (at(m.due_date) === null || at(m.due_date) >= now))
    return Boolean(m && m.title === title)
  }
  const milestoneTitle = q.get('milestone_title')
  if (milestoneTitle) out = out.filter(r => milestoneMatches(r, milestoneTitle))
  const notMilestone = q.get('not[milestone_title]')
  if (notMilestone) out = out.filter(r => !milestoneMatches(r, notMilestone))

  // `assignee_username` (scalar, legacy bar) and `assignee_username[]`
  // (repeatable, the project issue list's new bar) are the same filter.
  const assigneeMatches = (r, name) => {
    if (name === 'None') return !(r.assignee_ids || []).length
    if (name === 'Any') return (r.assignee_ids || []).length > 0
    const u = usersByUsername.get(name)
    return Boolean(u && (r.assignee_ids || []).includes(u.id))
  }
  // `assignee_id=None|Any` is the param the source's bar emits for those two
  // values — it does NOT put them on `assignee_username`.
  const assignees = [...q.getAll('assignee_username[]'),
    ...[q.get('assignee_username'), q.get('assignee_id')].filter(Boolean)]
  for (const name of assignees) out = out.filter(r => assigneeMatches(r, name))
  const notAssignees = [...q.getAll('not[assignee_username][]'),
    ...[q.get('not[assignee_username]')].filter(Boolean)]
  for (const name of notAssignees) out = out.filter(r => !assigneeMatches(r, name))

  const authorMatches = (r, name) => {
    const u = usersByUsername.get(name)
    return Boolean(u && r.author_id === u.id)
  }
  const author = q.get('author_username')
  if (author) out = out.filter(r => authorMatches(r, author))
  const notAuthor = q.get('not[author_username]')
  if (notAuthor) out = out.filter(r => !authorMatches(r, notAuthor))

  const reviewerMatches = (r, name) => {
    if (name === 'None') return !(r.reviewer_ids || []).length
    if (name === 'Any') return (r.reviewer_ids || []).length > 0
    const u = usersByUsername.get(name)
    return Boolean(u && (r.reviewer_ids || []).includes(u.id))
  }
  const reviewer = q.get('reviewer_username') || q.get('reviewer_id')
  if (reviewer) out = out.filter(r => reviewerMatches(r, reviewer))
  const notReviewer = q.get('not[reviewer_username]')
  if (notReviewer) out = out.filter(r => !reviewerMatches(r, notReviewer))

  const confidential = q.get('confidential')
  if (confidential === 'yes') out = out.filter(r => r.confidential)
  if (confidential === 'no') out = out.filter(r => !r.confidential)

  const draft = q.get('draft')
  if (draft === 'yes') out = out.filter(r => r.draft)
  if (draft === 'no') out = out.filter(r => !r.draft)

  const targetBranch = q.get('target_branch')
  if (targetBranch) out = out.filter(r => r.target_branch === targetBranch)
  const notTargetBranch = q.get('not[target_branch]')
  if (notTargetBranch) out = out.filter(r => r.target_branch !== notTargetBranch)

  // `Type`. The seed carries no incidents, test cases or tasks — every sampled
  // issue is a plain issue, as at the source — so `type[]=issue` keeps the
  // whole list and the other three select nothing.
  const isType = (r, t) => t === 'issue'
  const types = q.getAll('type[]')
  if (types.length) out = out.filter(r => types.some(t => isType(r, t)))
  const notTypes = q.getAll('not[type][]')
  if (notTypes.length) out = out.filter(r => !notTypes.some(t => isType(r, t)))

  // Award emoji, releases, approvals, environments and deployments are not in
  // the seed — and are empty on the source for these projects too, which is why
  // its own `My-Reaction` and `Release` dropdowns answer `No suggestions found`.
  // `None` therefore matches everything and any other value matches nothing;
  // the negations are the mirror image.
  for (const [param, notParam] of [['my_reaction_emoji', 'not[my_reaction_emoji]'],
    ['release_tag', 'not[release_tag]']]) {
    const v = q.get(param)
    if (v) out = v === 'None' ? out : []
    const nv = q.get(notParam)
    if (nv && nv === 'None') out = []
  }
  const approvedBy = q.getAll('approved_by_usernames[]')
  if (approvedBy.length) out = approvedBy.every(v => v === 'None') ? out : []
  if (q.get('environment')) out = []
  if (q.get('deployed_before') || q.get('deployed_after')) out = []

  return out
}

// ---------------------------------------------------------------------------
// Issuable sorting — assets/README.md §5a.6 (dashboard menu) and §13.5 / the
// project list menu, which emit DIFFERENT tokens for the same visible label
// (`Closed date` is `closed_at` on the dashboard and `closed_at_desc` on the
// project list; `Milestone due date` is `milestone` vs `milestone_due_desc`).
// Both families plus their direction-toggle twins are accepted here.
//
// Ordering semantics follow GitLab's `Issuable.sort_by_attribute`:
//
//   * every nullable key sorts NULLS LAST in BOTH directions — GitLab uses
//     `nulls_last` / `<col> IS NULL, <col> ASC|DESC`, so reversing the
//     direction does not float the empty rows to the top;
//   * `milestone*` has a THREE-tier null shape, straight off
//     `ORDER BY milestones.due_date IS NULL, milestones.id IS NULL, due_date`:
//     rows with a due date, then rows whose milestone has no due date, then
//     rows with no milestone at all;
//   * `priority*` is `order_due_date_and_labels_priority` — milestone due date
//     first, highest label priority second;
//   * ties break on `id DESC`. GitLab only appends this on some scopes and
//     leaves the rest to Postgres' arbitrary order; a mock has to be
//     deterministic, so it is applied everywhere.
//
// Two of these are inert against this seed, and that is faithful, not a gap:
// the source has ZERO rows in `label_priorities` (the captures show the
// `Star labels to start sorting by priority` empty state on every labels page),
// and none of the 31 source issues carrying a `relative_position` is in the
// sampled seed. Both therefore collapse to the `id DESC` tie-break, exactly as
// the source would.
// ---------------------------------------------------------------------------

const SORT_TS = v => (v ? new Date(String(v).replace(' ', 'T')).getTime() : null)

/** Lowest `priority` across the row's labels — GitLab's `highest_priority`. */
function labelPriority(row, labelsById) {
  if (!labelsById) return null
  let best = null
  for (const id of row.label_ids || []) {
    const p = labelsById.get(id) && labelsById.get(id).priority
    if (p === null || p === undefined) continue
    if (best === null || p < best) best = p
  }
  return best
}

/** `[tier, value]` for the milestone due date, per the three-tier SQL above. */
function milestoneDue(row, milestonesById) {
  const m = row.milestone_id && milestonesById ? milestonesById.get(row.milestone_id) : null
  if (!m) return [2, null]
  const due = SORT_TS(m.due_date)
  return due === null ? [1, null] : [0, due]
}

/**
 * Sort by a list of `[keyFn, direction]` pairs, nulls last in both directions,
 * tie-breaking on `id DESC`.
 */
function orderBy(rows, keys) {
  return [...rows].sort((a, b) => {
    for (const [key, dir] of keys) {
      const av = key(a)
      const bv = key(b)
      if (av === null && bv === null) continue
      if (av === null) return 1
      if (bv === null) return -1
      if (av === bv) continue
      return typeof av === 'string'
        ? dir * String(av).localeCompare(String(bv))
        : dir * (av - bv)
    }
    return (b.id || 0) - (a.id || 0)
  })
}

/** ROUTES.md § sort values. Default `created_date` = newest first. */
export function sortIssuables(rows, sort, indexes = {}) {
  const { labelsById, milestonesById } = indexes
  const ts = SORT_TS
  const created = r => ts(r.created_at)
  const mTier = r => milestoneDue(r, milestonesById)[0]
  const mDue = r => milestoneDue(r, milestonesById)[1]
  const lPrio = r => labelPriority(r, labelsById)
  // `milestone*` and `priority*` lead with the tier column, which is never null
  // and always ascends (it IS the nulls-last encoding), so it takes dir=1.
  const milestoneKeys = dir => [[mTier, 1], [mDue, dir]]
  const priorityKeys = dir => [[mTier, 1], [mDue, dir], [lPrio, dir]]

  switch (sort) {
    case 'created_asc': return orderBy(rows, [[created, 1]])
    case 'updated_desc': return orderBy(rows, [[r => ts(r.updated_at), -1]])
    case 'updated_asc': return orderBy(rows, [[r => ts(r.updated_at), 1]])
    case 'title_asc': return orderBy(rows, [[r => String(r.title || ''), 1]])
    case 'title_desc': return orderBy(rows, [[r => String(r.title || ''), -1]])
    case 'due_date':
    case 'due_date_asc': return orderBy(rows, [[r => ts(r.due_date), 1]])
    case 'due_date_desc': return orderBy(rows, [[r => ts(r.due_date), -1]])
    case 'popularity_asc': return orderBy(rows, [[r => r.upvotes || 0, 1]])
    case 'popularity':
    case 'popularity_desc': return orderBy(rows, [[r => r.upvotes || 0, -1]])

    // `Closed date`. The dashboard menu emits the ASCENDING token (`closed_at`)
    // and its toggle produces `closed_at_desc`; the project list menu emits the
    // descending one. Both spellings of each direction are accepted.
    //
    // Inert against the seed in BOTH collections, and that is the source's own
    // shape, not a shortcut (round 5 checked Postgres directly):
    //   * `issues.closed_at` is populated on 1 row in 80 962 across the whole
    //     source DB — a bulk import that never wrote the column — and that row
    //     is not one of the 613 sampled issues. All 613 are NULL at the source.
    //   * merge requests have no `closed_at` column at all; GitLab reads
    //     `merge_request_metrics.latest_closed_at` (`order_closed_at_asc`),
    //     which is populated on 1 row in 134 338 and on 0 of the 729 sampled.
    // So both fall through to the `id DESC` tie-break, exactly as the source
    // would. Rows closed IN-SESSION do get a real `closed_at` from the close
    // handlers, and those order correctly ahead of the untouched rows.
    case 'closed_at':
    case 'closed_at_asc': return orderBy(rows, [[r => ts(r.closed_at), 1]])
    case 'closed_at_desc': return orderBy(rows, [[r => ts(r.closed_at), -1]])

    // `Merged date` (merge-request menu only). Backfilled in round 5 from
    // `merge_request_metrics.merged_at` onto 286 of the 729 seeded MRs (every
    // one of them in `merged` state; the other 28 merged rows have no metrics
    // row at the source and stay NULL). Verified row-for-row against
    // `ORDER BY merged_at <dir> NULLS LAST` on the source DB.
    //
    // One deliberate deviation: GitLab breaks ties on `merge_request_metrics.id
    // DESC`; the mock does not carry that table, so ties fall to `id DESC` like
    // every other token here. No two seeded MRs in a project share a
    // `merged_at`, so the two are indistinguishable on this seed.
    case 'merged_at':
    case 'merged_at_asc': return orderBy(rows, [[r => ts(r.merged_at), 1]])
    case 'merged_at_desc': return orderBy(rows, [[r => ts(r.merged_at), -1]])

    case 'milestone':
    case 'milestone_due_asc': return orderBy(rows, milestoneKeys(1))
    case 'milestone_desc':
    case 'milestone_due_desc': return orderBy(rows, milestoneKeys(-1))

    case 'priority':
    case 'priority_asc': return orderBy(rows, priorityKeys(1))
    case 'priority_desc': return orderBy(rows, priorityKeys(-1))

    case 'label_priority':
    case 'label_priority_asc': return orderBy(rows, [[lPrio, 1]])
    case 'label_priority_desc': return orderBy(rows, [[lPrio, -1]])

    case 'relative_position':
    case 'relative_position_asc': return orderBy(rows, [[r => r.relative_position ?? null, 1]])

    case 'created_date':
    case 'created_desc':
    default: return orderBy(rows, [[created, -1]])
  }
}

/** Project-list sorts (ROUTES.md § Project / group lists). */
export function sortProjects(rows, sort) {
  const ts = v => (v ? new Date(String(v).replace(' ', 'T')).getTime() : 0)
  const s = [...rows]
  switch (sort) {
    case 'name_asc': return s.sort((a, b) => a.name.localeCompare(b.name))
    case 'name_desc': return s.sort((a, b) => b.name.localeCompare(a.name))
    case 'created_desc': return s.sort((a, b) => ts(b.created_at) - ts(a.created_at))
    case 'created_asc': return s.sort((a, b) => ts(a.created_at) - ts(b.created_at))
    case 'stars_desc': return s.sort((a, b) => (b.star_count || 0) - (a.star_count || 0))
    case 'latest_activity_asc': return s.sort((a, b) => ts(a.last_activity_at) - ts(b.last_activity_at))
    case 'latest_activity_desc':
    default: return s.sort((a, b) => ts(b.last_activity_at) - ts(a.last_activity_at))
  }
}
