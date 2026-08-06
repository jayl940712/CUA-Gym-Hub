import React from 'react'
import { Link, useSearchParams, useNavigate, useLocation } from 'react-router-dom'

/** The sid rides as an additive query param and must survive every hop. */
export function currentSid() {
  if (typeof window === 'undefined') return null
  const p = new URLSearchParams(window.location.search)
  return p.get('sid') || sessionStorage.getItem('webarena_shopping_sid') || null
}

/**
 * Build a mock URL. `params` is a plain object; undefined/null/'' drops the
 * param. `sid` is always re-appended last so deep links keep working.
 */
export function buildUrl(path, params = {}, sid = currentSid()) {
  const sp = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === '') continue
    sp.set(k, String(v))
  }
  if (sid) sp.set('sid', sid)
  const qs = sp.toString()
  return qs ? `${path}?${qs}` : path
}

/** Current search params as a plain object, with sid stripped. */
export function paramsToObject(searchParams) {
  const out = {}
  for (const [k, v] of searchParams.entries()) {
    if (k === 'sid') continue
    out[k] = v
  }
  return out
}

/** Merge/override params on the current URL, preserving everything else. */
export function useUrlBuilder() {
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const sid = searchParams.get('sid') || currentSid()

  const base = paramsToObject(searchParams)

  return {
    sid,
    query: base,
    /** Link to another path, keeping only sid. */
    to: (path, params = {}) => buildUrl(path, params, sid),
    /** Same path, with `changes` merged over the current query. */
    withParams: (changes, path = location.pathname) => {
      const next = { ...base }
      for (const [k, v] of Object.entries(changes)) {
        if (v === undefined || v === null || v === '') delete next[k]
        else next[k] = String(v)
      }
      return buildUrl(path, next, sid)
    },
    /** Current URL minus one param — used by "Now Shopping by" chips. */
    without: (name, path = location.pathname) => {
      const next = { ...base }
      delete next[name]
      return buildUrl(path, next, sid)
    },
  }
}

/** navigate() that never drops ?sid=. */
export function useStoreNavigate() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sid = searchParams.get('sid') || currentSid()
  return (path, params = {}, opts) => navigate(buildUrl(path, params, sid), opts)
}

/** <Link> that never drops ?sid=. */
export function SLink({ to, params, children, ...rest }) {
  const [searchParams] = useSearchParams()
  const sid = searchParams.get('sid') || currentSid()
  return <Link to={buildUrl(to, params || {}, sid)} {...rest}>{children}</Link>
}
