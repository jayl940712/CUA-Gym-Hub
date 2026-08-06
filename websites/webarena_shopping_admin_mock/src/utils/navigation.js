/**
 * `?sid=` must survive every link, redirect and programmatic navigation, and
 * every source path must keep working with an optional trailing slash and an
 * optional Magento `/key/<hash>/` segment.
 */

import { useCallback } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

/** Append the live query string (which carries `sid`) to a bare path. */
export function withQuery(to, search) {
  if (!search) return to
  const qs = typeof search === 'string' ? search.replace(/^\?/, '') : search.toString()
  if (!qs) return to
  return to.includes('?') ? `${to}&${qs}` : `${to}?${qs}`
}

/** Append only `sid` — used when a link intentionally resets grid params. */
export function withSid(to, search) {
  const params = new URLSearchParams(typeof search === 'string' ? search : search?.toString() || '')
  const sid = params.get('sid')
  if (!sid) return to
  return to.includes('?') ? `${to}&sid=${encodeURIComponent(sid)}` : `${to}?sid=${encodeURIComponent(sid)}`
}

/** Current `sid`, or null. */
export function useSid() {
  const [searchParams] = useSearchParams()
  return searchParams.get('sid')
}

/**
 * navigate() that carries `sid` forward. Pass `{ keepQuery: true }` to keep the
 * whole query string (grid state), otherwise only `sid` is preserved.
 */
export function useSidNavigate() {
  const navigate = useNavigate()
  const location = useLocation()
  return useCallback((to, options = {}) => {
    const { keepQuery = false, ...rest } = options
    const target = keepQuery ? withQuery(to, location.search) : withSid(to, location.search)
    navigate(target, rest)
  }, [navigate, location.search])
}

/**
 * Strip a Magento `/key/<hash>/` segment. This deployment never emits one
 * (SOURCE.md §2), but an agent may supply it, and it must not 404.
 */
export function stripKeySegment(pathname) {
  return pathname.replace(/\/key\/[^/]+\/?$/, '/').replace(/\/key\/[^/]+\//, '/')
}
