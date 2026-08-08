import React from 'react'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'

// ROUTES #74 — `/:ns/:proj/-/issues/service_desk`. Service Desk is disabled on
// this instance, so the source renders only the "not enabled" empty state.

export default function ServiceDesk() {
  const { project, base } = useProject()
  usePageChrome({
    title: project
      ? `Service Desk · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
    breadcrumbExtra: [{ text: 'Service Desk', href: `${base}/-/issues/service_desk` }],
  })
  if (!project) return <NotFound />

  return (
    <section className="empty-state gl-text-center">
      <div className="gl-max-w-full gl-m-auto"><div className="gl-mx-auto gl-my-0 gl-p-5">
        <h1 className="gl-font-size-h-display gl-line-height-36 h4">Use Service Desk to connect with your users</h1>
        <p className="gl-mt-3">
          Service Desk is enabled but not yet active on this instance.{' '}
          <a href="/help/user/project/service_desk" className="gl-link">Learn more about Service Desk.</a>
        </p>
      </div></div>
    </section>
  )
}
