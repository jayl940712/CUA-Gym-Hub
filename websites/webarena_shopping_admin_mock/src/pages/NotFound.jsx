import React from 'react'
import PageShell from '../components/layout/PageShell.jsx'
import AdminLink from '../components/layout/AdminLink.jsx'

/**
 * Magento's admin 404 page. Copy is taken verbatim from the source's
 * `Magento_Backend::noroute.phtml`.
 */
export default function NotFound() {
  return (
    <PageShell title="404 Error">
      <div className="page-noroute">
        <h3>Sorry! We couldn't find the page you were looking for.</h3>
        <p>
          Please use the navigation menu, or go back to the{' '}
          <AdminLink to="/admin/admin/dashboard/">Dashboard</AdminLink>.
        </p>
      </div>
    </PageShell>
  )
}
