import React from 'react'
import { usePageChrome } from '../components/layout/Layout.jsx'

// GitLab's 404. Reached only for records that genuinely do not exist —
// every route in ROUTES.md resolves to a real component.

export default function NotFound() {
  usePageChrome({ title: 'The page could not be found · GitLab' })
  return (
    <div className="row empty-state">
      <div className="gl-empty-state-content">
        <h1 className="gl-font-size-h-display">404</h1>
        <h3>Page Not Found</h3>
        <p>Make sure the address is correct and the page hasn&apos;t moved.</p>
        <p>Please contact your GitLab administrator if you think this is a mistake.</p>
        <a className="btn gl-button btn-confirm" href="/">Go back</a>
      </div>
    </div>
  )
}
