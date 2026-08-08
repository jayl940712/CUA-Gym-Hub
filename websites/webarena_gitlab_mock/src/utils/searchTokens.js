// ---------------------------------------------------------------------------
// The filtered-search token bar — token types, their values, and the URL each
// one emits.
//
// TEST.md DIFF-1501: the bar rendered applied tokens but its input opened
// nothing, so the token types, operators and value lists the source offers were
// unreachable by clicking. That made `not[label_name][]` (webarena-106) and
// `label_name[]=None` (webarena-343) reachable only by typing a URL.
//
// Everything in this file was measured on the live source (8023), read-only:
// the token type lists per page, their order, the operator labels and their
// descriptions, the value lists, and the exact query each emits. DEV.r16-
// tokenbar.md §1 records the measurements.
//
// TWO IMPLEMENTATIONS ON THE SOURCE. `/:ns/:proj/-/issues` runs the new Vue
// `GlFilteredSearch` (`input[data-testid="filtered-search-term-input"]`,
// `ul.gl-filtered-search-suggestion-list`); the project MR list and both
// dashboards still run the legacy bar (`input#filtered-search-issues`,
// `#js-dropdown-hint`). The mock has rendered the NEW bar on all four since
// round 4 and no round has filed that as a difference — so this keeps one
// interaction model and takes the TOKEN TYPE LIST for each page from that
// page's own source dropdown. The differences that follow from the two
// implementations are real and are listed here rather than smoothed over:
//
//   * the project issue list sends `assignee_username[]` (repeatable) and
//     renders user tokens as the USERNAME (`Assignee = byteblaze`);
//   * the legacy pages send `assignee_username` (scalar) — which is what
//     webarena-156 and -357 anchor on — and render the DISPLAY NAME
//     (`Assignee = Byte Blaze`).
//
// Both are reproduced per page.
//
// URL FORM. Every token routes through `issuableListUrl()`, so the trailing
// slash, the `encodeURIComponent` escaping and the param order round 14
// established are unchanged. The source additionally emits `sort=created_date`
// on every filter apply; the mock deliberately does NOT add it, because round
// 14's forms are compared by `url_match` and were signed off byte-for-byte.
// (`URLEvaluator` ignores extra prediction keys, so it is inert either way.)
// ---------------------------------------------------------------------------

import { issuableListUrl } from './issuableUrl.js'
import { getBranches } from './dataManager.js'
import { labelIsLight } from '../components/issuable/Controls.jsx'

/** GitLab's `DEFAULT_NONE_ANY`, offered on `=` only. */
const NONE_ANY = [{ value: 'None', text: 'None' }, { value: 'Any', text: 'Any' }]

/** The source's own empty value list. */
export const NO_SUGGESTIONS = 'No suggestions found'

/**
 * `=` / `!=` with the descriptions the source renders beside them. `Assignee`
 * and `Author` describe `!=` as `is not one of` rather than `is not` — measured
 * on the source, twice.
 */
export const OPERATORS = [
  { value: '=', description: 'is' },
  { value: '!=', description: 'is not' },
]

export function operatorDescription(type, op) {
  if (op === '!=' && type.notDescription) return type.notDescription
  return OPERATORS.find(o => o.value === op).description
}

// --- value sources ---------------------------------------------------------

function projectLabels({ project, state }) {
  const rows = project
    ? state.labels.filter(l => l.project_id === project.id)
    : state.labels
  const seen = new Map()
  for (const l of rows) if (!seen.has(l.title)) seen.set(l.title, l)
  return [...seen.values()].sort((a, b) => a.title.localeCompare(b.title))
}

/**
 * The users a user-typed token offers, with **the current user pinned first**.
 *
 * GitLab pins the signed-in user at the head of every one of these lists
 * regardless of membership. Measured: `root/metaseq` has exactly ONE member on
 * the source (`Administrator / @root`, confirmed on its own members page), and
 * its `Assignee =` list is still `None, Any, ―, Byte Blaze / @byteblaze,
 * Administrator / @root`. Without the pin, "assigned to me" — the single most
 * likely filter an agent reaches for — is unclickable on every project
 * `byteblaze` is not a member of.
 */
function projectMembers({ project, state, indexes }) {
  const currentUser = state.currentUser
  const ids = project
    ? state.members
      .filter(m => m.source_type === 'project' && m.source_id === project.id)
      .map(m => m.user_id)
    : state.users.map(u => u.id)
  const out = []
  const seen = new Set()
  if (currentUser) { seen.add(currentUser.id); out.push(currentUser) }
  for (const id of ids) {
    const u = indexes.usersById.get(id)
    if (u && !seen.has(u.id)) { seen.add(u.id); out.push(u) }
  }
  return out
}

function projectMilestones({ project, state }) {
  const rows = project
    ? state.milestones.filter(m => m.project_id === project.id)
    : state.milestones
  const seen = new Set()
  return rows.filter(m => (seen.has(m.title) ? false : (seen.add(m.title), true)))
}

const userOptions = ctx => projectMembers(ctx).map(u => ({
  value: u.username, text: u.name, secondary: `@${u.username}`,
}))

const labelOptions = ctx => projectLabels(ctx).map(l => ({
  value: l.title, text: l.title, label: l,
}))

// --- token type descriptors ------------------------------------------------
//
// `param` / `notParam` are the query keys; a key ending in `[]` is repeatable.
// `sigil` is the prefix the source shows inside the token (`~bug`, `%15.7`).
// `noneAny` adds `None` / `Any` on the `=` operator only, as the source does.

const T = {
  // `None` / `Any` do not go through the username param on the source — the
  // assignee and reviewer tokens switch to `assignee_id` / `reviewer_id` for
  // those two values (measured: `Assignee = None` emits `assignee_id=None`).
  assigneeArray: {
    key: 'assignee', label: 'Assignee', icon: 'user',
    param: 'assignee_username[]', notParam: 'not[assignee_username][]',
    noneAnyParam: 'assignee_id', notDescription: 'is not one of',
    operators: ['=', '!='], noneAny: true, values: userOptions, user: true,
  },
  assignee: {
    key: 'assignee', label: 'Assignee', icon: 'user',
    param: 'assignee_username', notParam: 'not[assignee_username]',
    noneAnyParam: 'assignee_id', notDescription: 'is not one of',
    operators: ['=', '!='], noneAny: true, values: userOptions, user: true,
  },
  author: {
    key: 'author', label: 'Author', icon: 'pencil',
    param: 'author_username', notParam: 'not[author_username]',
    notDescription: 'is not one of',
    operators: ['=', '!='], values: userOptions, user: true,
  },
  reviewer: {
    key: 'reviewer', label: 'Reviewer', icon: 'user',
    param: 'reviewer_username', notParam: 'not[reviewer_username]',
    noneAnyParam: 'reviewer_id',
    operators: ['=', '!='], noneAny: true, values: userOptions, user: true,
  },
  approvedBy: {
    key: 'approved_by', label: 'Approved-By', icon: 'approval',
    param: 'approved_by_usernames[]', notParam: 'not[approved_by_usernames][]',
    operators: ['=', '!='], noneAny: true, values: userOptions, user: true,
  },
  confidential: {
    key: 'confidential', label: 'Confidential', icon: 'eye-slash',
    param: 'confidential', operators: ['='],
    values: () => [{ value: 'yes', text: 'Yes' }, { value: 'no', text: 'No' }],
  },
  draft: {
    key: 'draft', label: 'Draft', icon: 'pencil',
    param: 'draft', operators: ['='],
    values: () => [{ value: 'yes', text: 'Yes' }, { value: 'no', text: 'No' }],
  },
  label: {
    key: 'label', label: 'Label', icon: 'labels',
    param: 'label_name[]', notParam: 'not[label_name][]',
    operators: ['=', '!='], noneAny: true, sigil: '~', multi: true,
    values: labelOptions,
  },
  milestone: {
    key: 'milestone', label: 'Milestone', icon: 'clock',
    param: 'milestone_title', notParam: 'not[milestone_title]',
    operators: ['=', '!='], noneAny: true, sigil: '%',
    // `Upcoming` and `Started` sit with `None`/`Any` ABOVE the divider, not
    // below it. Measured on `/root/metaseq/-/issues`:
    //   None, Any, Upcoming, Started, <divider>, <titles>
    extraNoneAny: [{ value: 'Upcoming', text: 'Upcoming' }, { value: 'Started', text: 'Started' }],
    values: ctx => projectMilestones(ctx).map(m => ({ value: m.title, text: m.title })),
  },
  myReaction: {
    key: 'my_reaction', label: 'My-Reaction', icon: 'thumb-up',
    param: 'my_reaction_emoji', notParam: 'not[my_reaction_emoji]',
    operators: ['=', '!='], noneAny: true,
    // The seed carries no award emoji, and the source shows `No suggestions
    // found` on these projects too.
    values: () => [],
  },
  release: {
    key: 'release', label: 'Release', icon: 'rocket',
    param: 'release_tag', notParam: 'not[release_tag]',
    operators: ['=', '!='], noneAny: true,
    // No releases in the seed; the source shows `No suggestions found` here.
    values: () => [],
  },
  searchWithin: {
    key: 'in', label: 'Search Within', icon: 'search',
    param: 'in', operators: ['='],
    values: () => [{ value: 'TITLE', text: 'Titles' }, { value: 'DESCRIPTION', text: 'Descriptions' }],
  },
  type: {
    key: 'type', label: 'Type', icon: 'issues',
    param: 'type[]', notParam: 'not[type][]', operators: ['=', '!='], multi: true,
    values: () => ['issue', 'incident', 'test_case', 'task'].map(v => ({ value: v, text: v })),
  },
  targetBranch: {
    key: 'target_branch', label: 'Target-Branch', icon: 'branch',
    param: 'target_branch', notParam: 'not[target_branch]', operators: ['=', '!='],
    values: ({ project, state }) => (project
      ? getBranches(state, project).map(b => ({ value: b.name, text: b.name }))
      : []),
  },
  environment: {
    key: 'environment', label: 'Environment', icon: 'environment',
    param: 'environment', operators: ['='], freeText: true, values: () => [],
  },
  deployedBefore: {
    key: 'deployed_before', label: 'Deployed-before', icon: 'clock',
    param: 'deployed_before', operators: ['='], freeText: true, values: () => [],
  },
  deployedAfter: {
    key: 'deployed_after', label: 'Deployed-after', icon: 'clock',
    param: 'deployed_after', operators: ['='], freeText: true, values: () => [],
  },
}

/**
 * The token types each list offers, in the source's own order.
 * DEV.r16-tokenbar.md §1.2 records where each list came from.
 */
const VARIANTS = {
  // `/:ns/:proj/-/issues` — the new bar, nine entries, alphabetical.
  'project-issues': [T.assigneeArray, T.author, T.confidential, T.label, T.milestone,
    T.myReaction, T.release, T.searchWithin, T.type],
  // `/:ns/:proj/-/merge_requests` — the legacy hint dropdown, thirteen entries.
  'project-merge_requests': [T.author, T.assignee, T.reviewer, T.approvedBy, T.milestone,
    T.release, T.label, T.myReaction, T.draft, T.targetBranch, T.environment,
    T.deployedBefore, T.deployedAfter],
  // `/dashboard/issues` — six entries.
  'dashboard-issues': [T.author, T.assignee, T.milestone, T.release, T.label, T.myReaction],
  // `/dashboard/merge_requests` — twelve; no `Target-Branch`.
  'dashboard-merge_requests': [T.author, T.assignee, T.reviewer, T.approvedBy, T.milestone,
    T.release, T.label, T.myReaction, T.draft, T.environment,
    T.deployedBefore, T.deployedAfter],
}

/** `('issues', '/dashboard/issues')` -> `'dashboard-issues'`. */
export function listVariant(kind, basePath) {
  const scope = /^\/dashboard\//.test(String(basePath || '')) ? 'dashboard' : 'project'
  return `${scope}-${kind === 'merge_requests' ? 'merge_requests' : 'issues'}`
}

export function tokenTypesFor(variant) {
  return VARIANTS[variant] || VARIANTS['project-issues']
}

/** The user tokens on the legacy pages show the display name, not the handle. */
export function usesDisplayName(variant) {
  return variant !== 'project-issues'
}

// --- reading tokens back out of the URL ------------------------------------

const isArrayParam = p => /\[\]$/.test(String(p))

/** The text the source puts inside a token for `value`. */
function tokenText(type, value, ctx, variant) {
  if (type.user && usesDisplayName(variant) && value !== 'None' && value !== 'Any') {
    const u = ctx.indexes.usersByUsername.get(value)
    return u ? u.name : value
  }
  if (type.key === 'confidential' || type.key === 'draft') return value === 'yes' ? 'Yes' : 'No'
  if (type.key === 'in') return value === 'DESCRIPTION' ? 'Descriptions' : 'Titles'
  return `${type.sigil || ''}${value}`
}

/**
 * A label token wears its label's colour, exactly as the source's does. Scoped
 * to the project first — 438 distinct titles are spread across 630 label rows,
 * so `bug` alone exists on many projects in different colours.
 */
function tokenStyle(type, value, ctx) {
  if (type.key !== 'label') return undefined
  const label = (ctx.project
    && ctx.state.labels.find(l => l.project_id === ctx.project.id && l.title === value))
    || ctx.state.labels.find(l => l.title === value)
  if (!label) return undefined
  return { backgroundColor: label.color, color: labelIsLight(label.color) ? '#333333' : '#FFFFFF' }
}

/**
 * The tokens a URL should render, in the order the params appear in it — which
 * is how the source renders them, and what makes the round trip
 * (URL -> tokens -> URL) stable.
 *
 * @returns [{ type, op, value, param, text, style, index }]
 */
export function parseTokens(searchParams, variant, ctx) {
  const types = tokenTypesFor(variant)
  const byParam = new Map()
  for (const t of types) {
    byParam.set(t.param, [t, '='])
    if (t.notParam) byParam.set(t.notParam, [t, '!='])
    // `assignee_id=None` renders as `Assignee = None`, same as any other value.
    if (t.noneAnyParam) byParam.set(t.noneAnyParam, [t, '='])
  }
  const out = []
  const counters = new Map()
  for (const [key, value] of searchParams.entries()) {
    const hit = byParam.get(key)
    if (!hit || value === '') continue
    const [type, op] = hit
    const n = counters.get(key) || 0
    counters.set(key, n + 1)
    out.push({
      type, op, value, param: key, index: n,
      text: tokenText(type, value, ctx, variant),
      style: tokenStyle(type, value, ctx),
    })
  }
  return out
}

/** The free-text search terms, which the source renders as their own chips. */
export function searchTerms(searchParams) {
  return String(searchParams.get('search') || '').split(/\s+/).filter(Boolean)
}

// --- building URLs ---------------------------------------------------------

function valuesOf(searchParams, param) {
  return searchParams.getAll(param)
}

/**
 * The URL for adding `value` under `type`/`op`. Repeatable params append;
 * scalar params replace. The counterpart param (`label_name[]` vs
 * `not[label_name][]`) is cleared for scalars so a token cannot appear twice
 * with both operators, which is what the source does.
 */
export function addTokenUrl(basePath, searchParams, type, op, value) {
  const noneAny = value === 'None' || value === 'Any'
  const param = noneAny && type.noneAnyParam
    ? type.noneAnyParam
    : (op === '!=' && type.notParam ? type.notParam : type.param)
  const overrides = {}
  // One token per type on the single-valued types: adding it clears whichever
  // of the type's other params was carrying it, which is what the source's bar
  // does. `Label` and `Type` are repeatable, so their `=` and `!=` sets coexist.
  if (!type.multi) {
    for (const other of [type.param, type.notParam, type.noneAnyParam]) {
      if (other && other !== param) overrides[other] = null
    }
  }
  if (isArrayParam(param)) {
    const existing = valuesOf(searchParams, param)
    overrides[param] = existing.includes(value) ? existing : [...existing, value]
  } else {
    overrides[param] = value
  }
  // A new filter always returns to page 1, as the source's own controls do.
  overrides.page = null
  return issuableListUrl(basePath, searchParams, overrides)
}

/** The URL with one token removed. */
export function removeTokenUrl(basePath, searchParams, token) {
  const overrides = { page: null }
  if (isArrayParam(token.param)) {
    const rest = valuesOf(searchParams, token.param).filter((v, i) => !(v === token.value && i === token.index))
    overrides[token.param] = rest.length ? rest : null
  } else {
    overrides[token.param] = null
  }
  return issuableListUrl(basePath, searchParams, overrides)
}

/** The `Clear` button: every filter and the search terms go, `state`/`sort` stay. */
export function clearAllUrl(basePath, searchParams, variant) {
  const overrides = { search: null, page: null }
  for (const t of tokenTypesFor(variant)) {
    overrides[t.param] = null
    if (t.notParam) overrides[t.notParam] = null
    if (t.noneAnyParam) overrides[t.noneAnyParam] = null
  }
  return issuableListUrl(basePath, searchParams, overrides)
}

/**
 * The value list the source shows for `type` under `op`, including the
 * `None` / `Any` pair (equality only) and the divider that follows it.
 *
 * @returns [{ value, text, secondary, label, divider }]
 */
export function valueOptions(type, op, ctx) {
  const rows = type.values(ctx) || []
  if (!type.noneAny || op !== '=') return [...(type.extraNoneAny || []), ...rows]
  return [...NONE_ANY, ...(type.extraNoneAny || []), { divider: true }, ...rows]
}
