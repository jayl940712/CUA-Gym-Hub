// ---------------------------------------------------------------------------
// Case-insensitive namespace/project path resolution (TEST BUG-B01).
//
// GitLab looks routes up case-insensitively but stores ONE canonical casing.
// Verified read-only against the source container (GitLab 15.7):
//
//   GET /byteblaze/DOTFILES  -> 301 Location: /byteblaze/dotfiles
//   GET /ROOT/metaseq        -> 301 Location: /root/metaseq
//   GET /convexegg/ChatGPT   -> 301 Location: /convexegg/chatgpt
//
// This matters beyond convenience: webarena-396 asserts `program_html` at
// `/byteblaze/ChatGPT`, while the project's real path is `chatgpt` — the task
// is only reachable through the redirect.
//
// The seed's casing is ground truth and is never lowercased: the maps below are
// lowercase-KEYED, and every value is the record's own stored casing. A hit
// therefore redirects TO the canonical path, exactly like the source's 301.
// ---------------------------------------------------------------------------

/**
 * First path segments that are GitLab routes, not namespaces. A project or
 * user can never be named one of these, so they must never be rewritten.
 */
const RESERVED_TOP_SEGMENTS = new Set([
  '-', 'admin', 'api', 'assets', 'dashboard', 'explore', 'files', 'go', 'help',
  'projects', 'groups', 'public', 'search', 'sitemap', 'snippets', 'state',
  'post', 'upload', 'uploads', 'users', 'favicon.ico', 'robots.txt',
])

/**
 * Lowercase-keyed lookup tables built once per state change.
 * `projects` maps "ns/proj".toLowerCase() -> the seed's real `full_path`.
 * `namespaces` maps a user username / group path, lowercased -> real casing.
 */
export function buildPathIndex(state) {
  const projects = new Map()
  const namespaces = new Map()
  if (!state) return { projects, namespaces }

  for (const p of state.projects || []) {
    if (!p || typeof p.full_path !== 'string') continue
    const key = p.full_path.toLowerCase()
    if (!projects.has(key)) projects.set(key, p.full_path)
    // `namespace` is the object shape from the container dump
    // ({id, path, name, kind}); tolerate a bare string too, since the create
    // and fork flows write the namespace they were given.
    const ns = p.namespace && typeof p.namespace === 'object' ? p.namespace.path : p.namespace
    if (typeof ns === 'string' && ns && !namespaces.has(ns.toLowerCase())) {
      namespaces.set(ns.toLowerCase(), ns)
    }
  }
  // Users and groups win over the namespace strings scraped off projects — a
  // user record is the authoritative spelling of its own namespace.
  for (const g of state.groups || []) {
    if (g && typeof g.path === 'string' && g.path) namespaces.set(g.path.toLowerCase(), g.path)
  }
  for (const u of state.users || []) {
    if (u && typeof u.username === 'string' && u.username) namespaces.set(u.username.toLowerCase(), u.username)
  }
  return { projects, namespaces }
}

/** Real casing for a namespace segment, or null when it is already canonical / unknown. */
function canonicalNamespace(index, segment) {
  if (!segment) return null
  const hit = index.namespaces.get(segment.toLowerCase())
  return hit && hit !== segment ? hit : null
}

/**
 * The canonical pathname for `pathname`, or `null` when it is already canonical
 * (or matches nothing, in which case the app's own NotFound should render).
 *
 * Only the namespace and project segments are touched — refs, file paths, iids
 * and every `/-/…` suffix are copied through byte-for-byte, because branch names
 * and blob paths ARE case sensitive in git.
 */
export function canonicalPathname(pathname, index) {
  if (typeof pathname !== 'string' || !pathname.startsWith('/')) return null
  const segs = pathname.split('/')
  // segs[0] is always '' for a leading-slash path.
  const first = segs[1]
  if (!first) return null

  const rewrite = (i, value) => {
    const out = segs.slice()
    out[i] = value
    return out.join('/')
  }

  if (RESERVED_TOP_SEGMENTS.has(first)) {
    // `/groups/:group/…` and `/users/:username/…` carry the namespace one
    // segment deeper. Everything else under a reserved prefix is a fixed route.
    if ((first === 'groups' || first === 'users') && segs[2] && segs[2] !== 'new' && segs[2] !== '-') {
      const canon = canonicalNamespace(index, segs[2])
      return canon ? rewrite(2, canon) : null
    }
    return null
  }

  // `/:ns/:proj/…` — resolve the pair first, so a project whose namespace AND
  // path both differ in case is fixed in one hop.
  if (segs[2] && segs[2] !== '-') {
    const canonPair = index.projects.get(`${first}/${segs[2]}`.toLowerCase())
    if (canonPair) {
      if (canonPair === `${first}/${segs[2]}`) return null
      const [ns, proj] = canonPair.split('/')
      const out = segs.slice()
      out[1] = ns
      out[2] = proj
      return out.join('/')
    }
  }

  // Bare namespace page: `/byteblaze`, `/byteblaze/-/…`.
  const canonNs = canonicalNamespace(index, first)
  return canonNs ? rewrite(1, canonNs) : null
}
