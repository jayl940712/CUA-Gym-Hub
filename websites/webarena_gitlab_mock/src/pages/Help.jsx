import React from 'react'
import { useLocation } from 'react-router-dom'
import { usePageChrome } from '../components/layout/Layout.jsx'

/**
 * ROUTES #130 / #131 — `/help` and the `/help/*` catch-all.
 *
 * The GitLab chrome links deep into `/help/user/...` from dozens of places
 * (alert banners, empty states, form hints). Without this catch-all every one
 * of those links 404s, which reads as a dead affordance.
 */
export default function Help() {
  const location = useLocation()
  const path = location.pathname.replace(/^\/help\/?/, '')
  usePageChrome({ title: 'Help · GitLab' })

  return (
    <div>
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">GitLab Documentation</h1>
      </div>
      {path ? (
        <p>
          Documentation page <code>{path}</code>. This GitLab instance ships the
          documentation offline.
        </p>
      ) : (
        <p>
          Welcome to GitLab Community Edition 15.7.5. Documentation is served from
          this instance.
        </p>
      )}
      <ul>
        <li><a href="/help/user/index">User documentation</a></li>
        <li><a href="/help/administration/index">Administrator documentation</a></li>
        <li><a href="/help/topics/autodevops/index.md">Auto DevOps</a></li>
        <li><a href="/help/api/index">API reference</a></li>
      </ul>
    </div>
  )
}
