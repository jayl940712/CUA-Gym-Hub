/**
 * URL building. Osclass uses classic query routing — `index.php?page=…&action=…`
 * — so every link in this app is built here, and `sid` is ALWAYS carried through.
 *
 * `sid` is additive and mock-only: it never replaces a source param, and it is
 * always emitted last so the source-shaped prefix of the URL is untouched.
 */

/**
 * Params are emitted in the caller's OWN key order — deliberately, not in a
 * canonical order.
 *
 * Osclass's `osc_update_search_url()` rewrites the current query in place: an
 * incoming key keeps its slot and a NEW key is appended. Measured on the source
 * from `/index.php?page=search&sRegion=9254928`, the Refine-category link is
 * `…&sRegion=9254928&sCategory=10` (appended), and from
 * `…&sCategory=9&iPage=124&sOrder=i_price&iOrderType=asc&sShowAs=gallery` the
 * sort link is `…&sCategory=9&iPage=124&sOrder=dt_pub_date&iOrderType=desc&sShowAs=gallery`
 * (`iPage` still in slot 2). Canonicalising here emitted the same param SET in a
 * different order — TEST DIFF-009 / BUG-T1.
 *
 * Callers therefore spread the incoming params first and override, which keeps
 * an existing key in place and appends a genuinely new one. `Search.jsx`
 * `inUrlOrder()` builds those objects straight off the request's key order.
 */
function orderKeys(params) {
  return Object.keys(params).filter(k =>
    k !== 'sid' && params[k] !== undefined && params[k] !== null && params[k] !== '')
}

/**
 * `application/x-www-form-urlencoded`, i.e. a space is `+`, not `%20`.
 *
 * Every source link is either a plain GET form submission or built by
 * `osc_update_search_url()`, and both emit `+`: the live site answers
 * `sPattern=banana+boat` and its own refine links carry `sPattern=banana+boat`
 * too. `URLSearchParams` (and Python's `parse_qs`) decode `+` and `%20`
 * identically, so this is string-level fidelity only — TEST BUG-T2.
 */
function encodePair(k, v) {
  return `${encodeURIComponent(k)}=${encodeURIComponent(v).replace(/%20/g, '+')}`
}

/** Build `/index.php?…` with `sid` appended last. */
export function indexUrl(params = {}, sid = null) {
  const pairs = []
  for (const k of orderKeys(params)) {
    const v = params[k]
    if (Array.isArray(v)) v.forEach(one => pairs.push(encodePair(k, one)))
    else pairs.push(encodePair(k, v))
  }
  if (sid) pairs.push(encodePair('sid', sid))
  return pairs.length ? `/index.php?${pairs.join('&')}` : '/index.php'
}

/** The site root, preserving `sid`. */
export function homeUrl(sid = null) {
  return sid ? `/?sid=${encodeURIComponent(sid)}` : '/'
}

/** Append `sid` to an already-built path. */
export function withSid(path, sid = null) {
  if (!sid) return path
  return path + (path.includes('?') ? '&' : '?') + `sid=${encodeURIComponent(sid)}`
}

/** Read every source param out of a URLSearchParams, dropping the mock-only sid. */
export function sourceParams(searchParams) {
  const out = {}
  for (const [k, v] of searchParams.entries()) {
    if (k === 'sid') continue
    if (k === 'sCategory[]') { out.sCategory = v; continue }
    if (out[k] === undefined) out[k] = v
  }
  return out
}

export function itemUrl(id, sid = null) {
  return indexUrl({ page: 'item', id }, sid)
}

export function searchUrl(params = {}, sid = null) {
  return indexUrl({ page: 'search', ...params }, sid)
}
