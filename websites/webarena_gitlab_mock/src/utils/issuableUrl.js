// ---------------------------------------------------------------------------
// The URL form the issue / merge-request list controls must emit.
//
// TEST.md DIFF-1303. WebArena's `URLEvaluator` under the default
// `GOLD in PRED` rule splits both URLs into `netloc + path` and asserts
// `ref_base_path in pred_base_path` — a *substring* test — then requires every
// reference query key to carry one of its reference values in the prediction.
// So the base path the agent ends on has to CONTAIN the anchor's base path, and
// the query has to be a superset of the anchor's query.
//
// Twelve anchored tasks (webarena-45, 46, 102, 103, 104, 105, 106, 339, 340,
// 341, 342, 343) are written against the project-scoped issue list with a
// **trailing slash before the `?`**:
//
//   /a11yproject/a11yproject.com/-/issues/?label_name%5B%5D=help%20wanted
//
// `…/-/issues/` is not a substring of `…/-/issues`, so a control that emits the
// slashless form scores 0 on all twelve even though the page, the filter and
// the row set are right. The mock used to emit the slashless form AND to strip
// an incoming slash, so an agent handed the passing URL lost it on its first
// click. Both halves are fixed here.
//
// Escaping is `encodeURIComponent` on key and value, NOT
// `URLSearchParams.toString()`:
//
//   URLSearchParams : label_name%5B%5D=help+wanted   ← `+` for space
//   the anchors     : label_name%5B%5D=help%20wanted ← `%20` for space
//
// which is what GitLab's own `issuable_item.vue#labelTarget()` produces:
// `?${encodeURIComponent(`${labelFilterParam}[]`)}=${encodeURIComponent(title)}`.
// The other anchors agree — `type%3A%20bug%20%F0%9F%90%9E`, `OPT%20model`,
// `OpenAPI%20Generator%20CLI`. Both encodings decode identically under
// `urllib.parse.parse_qs`, so this is fidelity rather than pass/fail, but it is
// free to get right and the round-13 report asked for it byte-for-byte.
//
// `/dashboard/issues` and `/dashboard/merge_requests` do NOT take the slash —
// webarena-156 and -357 anchor on `/dashboard/merge_requests?assignee_username=…`
// — so the slash is added only to the project-scoped `/-/…` lists.
// ---------------------------------------------------------------------------

/**
 * The order GitLab's list app serialises its query in, read off the anchors:
 * `search`, `sort`, `state`, the filter params, then the page params.
 * webarena-342 shows all five groups at once:
 *   ?search=OPT%20model&sort=created_asc&state=opened&label_name%5B%5D=question&first_page_size=20
 */
const PARAM_ORDER = [
  'search',
  'in',
  'sort',
  'state',
  'scope',
  'label_name[]',
  'not[label_name][]',
  'milestone_title',
  'not[milestone_title]',
  'assignee_username',
  'assignee_username[]',
  'not[assignee_username]',
  'not[assignee_username][]',
  'assignee_id',
  'author_username',
  'not[author_username]',
  'reviewer_username',
  'not[reviewer_username]',
  'reviewer_id',
  'approved_by_usernames[]',
  'not[approved_by_usernames][]',
  'target_branch',
  'not[target_branch]',
  'my_reaction_emoji',
  'not[my_reaction_emoji]',
  'release_tag',
  'not[release_tag]',
  'type[]',
  'not[type][]',
  'confidential',
  'draft',
  'environment',
  'deployed_before',
  'deployed_after',
  'page',
  'first_page_size',
]

/** GitLab's list app always sends these, even when they are the defaults. */
export const DEFAULT_STATE = 'opened'
export const DEFAULT_PAGE_SIZE = '20'

/** `?a=b&c=d` from ordered pairs, escaped the way the anchors are. */
export function encodePairs(pairs) {
  return pairs
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join('&')
}

/**
 * The list's own path. `/:ns/:proj/-/issues` and `/-/merge_requests` gain the
 * trailing slash the anchors use; `/dashboard/…` and anything else is returned
 * unchanged. Already-slashed input is left alone so this is idempotent.
 */
export function issuableListPath(basePath) {
  const p = String(basePath || '')
  if (/\/-\/(issues|merge_requests)\/$/.test(p)) return p
  return /\/-\/(issues|merge_requests)$/.test(p) ? `${p}/` : p
}

/** Ordered [key, value] pairs from a URLSearchParams, repeats preserved. */
function orderedPairs(map) {
  const out = []
  for (const key of PARAM_ORDER) {
    const values = map.get(key)
    if (values) for (const v of values) out.push([key, v])
  }
  for (const [key, values] of map) {
    if (PARAM_ORDER.includes(key)) continue
    for (const v of values) out.push([key, v])
  }
  return out
}

/**
 * Build the URL a filter / sort / search / pagination control on an issuable
 * list should navigate to.
 *
 * @param basePath  `/:ns/:proj/-/issues` (no trailing slash — added here)
 * @param current   the page's live `URLSearchParams`
 * @param overrides `{ sort: 'updated_desc' }`; `null` deletes a param, an array
 *                  sets a repeated one
 * @param opts.defaults  send `state` and `first_page_size` even when unset
 *                       (what the source's own controls do) — default true
 *
 * `sid` is never carried here: the global link interceptor in `src/App.jsx`
 * appends the live one textually, which keeps it last and keeps the rest of the
 * query byte-identical to what this function produced.
 */
export function issuableListUrl(basePath, current, overrides = {}, opts = {}) {
  const { defaults = true } = opts
  const map = new Map()
  const src = current instanceof URLSearchParams ? current : new URLSearchParams(current || '')
  for (const [k, v] of src.entries()) {
    if (k === 'sid') continue
    if (!map.has(k)) map.set(k, [])
    map.get(k).push(v)
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === null || v === undefined || v === '') map.delete(k)
    else map.set(k, (Array.isArray(v) ? v : [v]).map(String))
  }
  if (defaults) {
    if (!map.has('state')) map.set('state', [DEFAULT_STATE])
    if (!map.has('first_page_size')) map.set('first_page_size', [DEFAULT_PAGE_SIZE])
  }
  const query = encodePairs(orderedPairs(map))
  const path = issuableListPath(basePath)
  return query ? `${path}?${query}` : path
}

/**
 * A label pill's target. GitLab's pill replaces the whole query with a single
 * param — that is why webarena-102…105 and 339…343 anchor on a URL carrying
 * nothing but `label_name[]`.
 *
 * @param param  `label_name` or `not[label_name]`
 */
export function labelFilterUrl(basePath, title, param = 'label_name') {
  return `${issuableListPath(basePath)}?${encodeURIComponent(`${param}[]`)}=${encodeURIComponent(title)}`
}
