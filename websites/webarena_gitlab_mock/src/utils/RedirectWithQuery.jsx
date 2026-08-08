import React from 'react'
import { Navigate, useSearchParams, useNavigate, useLocation } from 'react-router-dom'

/**
 * Drop-in replacement for <Navigate>. Never use a bare <Navigate> in this app —
 * `?sid=` must survive every redirect, or the RL harness loses the session.
 *
 *   <RedirectWithQuery to="/dashboard/projects" />
 *
 * Params already present on `to` are kept; the current query string is merged
 * in behind them (so an explicit ?state=closed beats an inherited one).
 */
export default function RedirectWithQuery({ to, replace = true }) {
  const [searchParams] = useSearchParams()
  const [path, ownQuery] = String(to).split('?')
  const merged = new URLSearchParams(ownQuery || '')
  searchParams.forEach((value, key) => {
    if (!merged.has(key)) merged.append(key, value)
  })
  const q = merged.toString()
  return <Navigate to={q ? `${path}?${q}` : path} replace={replace} />
}

export { RedirectWithQuery }

/**
 * Programmatic navigation that carries the existing query string forward.
 * `go('/byteblaze/dotfiles')`                 -> keeps ?sid=
 * `go('/-/issues?state=closed')`              -> keeps ?sid=, adds state
 * `go('/-/issues', { keepQuery: false })`     -> keeps only ?sid=
 */
export function useQueryNavigate() {
  const navigate = useNavigate()
  const location = useLocation()
  return React.useCallback((to, options = {}) => {
    const { keepQuery = true, replace = false, state } = options
    const [path, ownQuery] = String(to).split('?')
    const merged = new URLSearchParams(ownQuery || '')
    const current = new URLSearchParams(location.search)
    if (keepQuery) {
      current.forEach((value, key) => { if (!merged.has(key)) merged.append(key, value) })
    } else {
      const sid = current.get('sid')
      if (sid && !merged.has('sid')) merged.set('sid', sid)
    }
    const q = merged.toString()
    navigate(q ? `${path}?${q}` : path, { replace, state })
  }, [navigate, location.search])
}

/** Append the live ?sid= to an href. Used by the global link interceptor. */
export function withSid(href, search) {
  const sid = new URLSearchParams(search || '').get('sid')
  if (!sid) return href
  const [path, ownQuery] = String(href).split('?')
  const params = new URLSearchParams(ownQuery || '')
  if (!params.has('sid')) params.set('sid', sid)
  return `${path}?${params.toString()}`
}

/**
 * `withSid` without the round trip through `URLSearchParams`.
 *
 * TEST.md DIFF-1303: rebuilding the query re-encodes it — `%20` comes back as
 * `+`, and the order of a hand-built query is not guaranteed to survive. The
 * anchored issue-list URLs are written with `%20`, so every href this app emits
 * has to reach `history.pushState` byte-for-byte. This appends `sid=` as text
 * and touches nothing else.
 *
 * The fragment is split off first, so an href like `/…/-/issues/12#notes`
 * becomes `/…/-/issues/12?sid=x#notes` rather than `…#notes?sid=x`, which
 * `parsePath` would read as part of the hash and drop the session.
 */
export function appendSid(href, search) {
  const sid = new URLSearchParams(search || '').get('sid')
  if (!sid) return href
  const str = String(href)
  const hashAt = str.indexOf('#')
  const head = hashAt >= 0 ? str.slice(0, hashAt) : str
  const hash = hashAt >= 0 ? str.slice(hashAt) : ''
  const queryAt = head.indexOf('?')
  const query = queryAt >= 0 ? head.slice(queryAt + 1) : null
  if (query !== null && new URLSearchParams(query).has('sid')) return str
  const separator = query === null ? '?' : (query ? '&' : '')
  return `${head}${separator}sid=${encodeURIComponent(sid)}${hash}`
}

/**
 * Navigate to a URL string verbatim, adding only `?sid=`. The counterpart of
 * `useQueryNavigate` for callers that have already built the exact query they
 * need (the issuable list's filtered search — see `utils/issuableUrl.js`).
 */
export function useRawNavigate() {
  const navigate = useNavigate()
  const location = useLocation()
  return React.useCallback((to, options = {}) => {
    navigate(appendSid(to, location.search), options)
  }, [navigate, location.search])
}
