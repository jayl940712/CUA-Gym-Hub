import React, { useMemo } from 'react'
import { Routes, useLocation, useParams } from 'react-router-dom'
import { useApp } from '../../context/AppContext.jsx'
import { getBranches, getTags, defaultBranchOf } from '../../utils/dataManager.js'

// ---------------------------------------------------------------------------
// Git refs may contain `/`.
//
// `amwhalen/archive-my-tweets` really has a branch called
// `github/fork/chtitux/addRssFeed` (src/data/branches.json), and webarena-788
// starts the agent on
//
//   /amwhalen/archive-my-tweets/-/tree/github/fork/chtitux/addRssFeed
//
// React Router binds `:ref` to a single segment, so a `/-/tree/:ref/*` route
// resolves that as ref=`github` + path=`fork/chtitux/addRssFeed` and the page
// renders "This directory is empty."  Single-segment routes like
// `/-/graphs/:ref` don't match the URL at all and fall through to NotFound.
//
// Rather than teach every repo page to re-parse its params, the ref-bearing
// routes are registered with a bare splat (`/-/tree/*`) and wrapped in
// <RefRoute>. It resolves the longest prefix of the splat that is a real branch
// or tag for this project, then re-matches a descendant route against a
// synthetic location in which that ref is percent-encoded into one segment.
// React Router turns `%2F` back into `/` when it binds params, so the pages'
// existing `useParams().ref` / `params['*']` come out correct with no
// page-side change.
// ---------------------------------------------------------------------------

/**
 * Longest-prefix ref resolution.
 *
 * @param knownRefs iterable of branch + tag names for the project
 * @param splat     the raw `*` param, e.g. `github/fork/chtitux/addRssFeed/docs`
 * @returns { ref, path }
 */
export function resolveRef(knownRefs, splat) {
  const raw = (splat || '').replace(/\/+$/, '')
  if (!raw) return { ref: '', path: '' }
  const segs = raw.split('/')
  const known = knownRefs instanceof Set ? knownRefs : new Set(knownRefs)
  for (let i = segs.length; i > 0; i -= 1) {
    const candidate = segs.slice(0, i).join('/')
    if (known.has(candidate)) return { ref: candidate, path: segs.slice(i).join('/') }
  }
  // Unknown ref (a task may have typed one): fall back to the old single-segment
  // reading so the page can render its own "not found" state.
  return { ref: segs[0], path: segs.slice(1).join('/') }
}

export default function RefRoute({ children }) {
  const params = useParams()
  const location = useLocation()
  const { state } = useApp()

  const project = state
    ? state.projects.find(p => p.full_path === `${params.ns}/${params.proj}`) || null
    : null

  const known = useMemo(() => {
    if (!project) return []
    return [
      ...getBranches(state, project).map(b => b.name),
      ...getTags(state, project).map(t => t.name),
    ]
  }, [state, project])

  const splat = params['*'] || ''
  const resolved = resolveRef(known, splat)
  // `/:ns/:proj/-/tree` with no ref at all → the project's default branch,
  // which is what GitLab redirects to.
  const ref = resolved.ref || (project ? defaultBranchOf(project) : 'main')
  const path = resolved.path

  const syntheticPathname = useMemo(() => {
    // The parent route matched `…/-/<section>/*`; strip exactly as many trailing
    // segments as the splat holds to recover the parent's pathname base. Counting
    // segments (rather than slicing characters) keeps this correct whether or not
    // the live pathname is percent-encoded.
    const trimmedSplat = splat.replace(/\/+$/, '')
    const splatSegs = trimmedSplat ? trimmedSplat.split('/') : []
    const liveSegs = location.pathname.replace(/\/+$/, '').split('/')
    const base = liveSegs.slice(0, liveSegs.length - splatSegs.length).join('/')
    const tail = path ? path.split('/').map(encodeURIComponent).join('/') : ''
    return `${base}/${encodeURIComponent(ref)}${tail ? `/${tail}` : ''}`
  }, [location.pathname, splat, ref, path])

  const syntheticLocation = useMemo(
    () => ({ ...location, pathname: syntheticPathname }),
    [location, syntheticPathname]
  )

  return <Routes location={syntheticLocation}>{children}</Routes>
}
