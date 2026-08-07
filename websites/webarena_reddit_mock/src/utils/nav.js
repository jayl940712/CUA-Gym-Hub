// ?sid= must survive every link, redirect and programmatic navigation.

export function readSid() {
  if (typeof window === 'undefined') return null
  const p = new URLSearchParams(window.location.search)
  return p.get('sid') || sessionStorage.getItem('reddit_sid') || null
}

/**
 * Appends the active session id to an internal path, preserving any query the
 * path already carries. External URLs are returned untouched.
 */
export function withSid(to, sid = readSid()) {
  if (!sid) return to
  if (typeof to !== 'string') return to
  if (/^[a-z][a-z0-9+.-]*:/i.test(to) || to.startsWith('//')) return to
  const [path, hash = ''] = to.split('#')
  if (/[?&]sid=/.test(path)) return to
  const sep = path.includes('?') ? '&' : '?'
  return `${path}${sep}sid=${encodeURIComponent(sid)}${hash ? '#' + hash : ''}`
}

/** The forum name implied by the current path, for the nav's Submit link. */
export function forumFromPath(pathname) {
  const m = pathname.match(/^\/f\/([^/+]+)(?:\/|$)/)
  return m ? decodeURIComponent(m[1]) : null
}
