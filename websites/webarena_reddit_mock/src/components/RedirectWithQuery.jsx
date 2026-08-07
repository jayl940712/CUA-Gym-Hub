import React from 'react'
import { Navigate, useSearchParams } from 'react-router-dom'
import { withSid } from '../utils/nav.js'

/**
 * Never use <Navigate> directly anywhere in this app — ?sid= must survive every
 * redirect, or a task's session state silently detaches.
 *
 * `sidOnly` reproduces a Symfony `redirectToRoute()`, which rebuilds the URL
 * from route params and therefore DROPS the incoming query string. Verified on
 * the source: `/subscribed/top?t=week` -> `302 /featured/top` (no `t`). `?sid=`
 * is mock-only bookkeeping and must survive regardless, so it is re-attached.
 */
export default function RedirectWithQuery({ to, sidOnly = false }) {
  const [searchParams] = useSearchParams()
  if (sidOnly) return <Navigate to={withSid(to)} replace />
  const query = searchParams.toString()
  return <Navigate to={query ? `${to}?${query}` : to} replace />
}
