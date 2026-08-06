import React from 'react'
import AdminLink from './AdminLink.jsx'
import { useApp } from '../../context/AppContext.jsx'

/**
 * Source footer copy (assets/html/dashboard.html), with the wordmark altered
 * per TRADEMARKS.md.
 *
 * HANDLERS-019 — the three links were `href="#"` + `preventDefault`, i.e. dead
 * affordances. The source's own hrefs, read live off
 * `/admin/admin/dashboard/`:
 *
 *   #footer_privacy          https://www.adobe.com/privacy/policy.html   (external)
 *   #footer_account_activity /admin/security/session/activity/           (in-app)
 *   #footer_bug_tracking     https://github.com/magento/magento2/issues  (external)
 *
 * Account Activity is a real admin route and is now wired to it. The other two
 * leave the site entirely; the mock is offline by contract, so they decline
 * with a notice the way `Inventory.jsx` and `External.jsx` already do, rather
 * than silently doing nothing. The source's element `id`s and link classes are
 * carried over either way.
 */
export default function AdminFooter() {
  const { addMessage } = useApp()

  function decline(e, label, href) {
    e.preventDefault()
    addMessage(`${label} lives at ${href}, which is outside this admin mock.`, 'notice')
  }

  return (
    <footer className="page-footer">
      <div className="footer-content">
        <div className="footer-legal">
          <ul className="footer-links">
            <li>
              <a
                className="link-report"
                id="footer_privacy"
                href="https://www.adobe.com/privacy/policy.html"
                onClick={e => decline(e, 'Privacy Policy', 'https://www.adobe.com/privacy/policy.html')}
              >
                Privacy Policy
              </a>
            </li>
            <li>
              <AdminLink
                className="link-account-activity"
                id="footer_account_activity"
                to="/admin/security/session/activity/"
              >
                Account Activity
              </AdminLink>
            </li>
            <li>
              <a
                className="link-report"
                id="footer_bug_tracking"
                href="https://github.com/magento/magento2/issues"
                onClick={e => decline(e, 'Report an Issue', 'https://github.com/magento/magento2/issues')}
              >
                Report an Issue
              </a>
            </li>
          </ul>
          <p className="copyright">Copyright &copy; 2026 Xagento Commerce Inc. All rights reserved.</p>
        </div>
        <div className="footer-version">
          <strong>Xagento</strong>
          <span className="magento-version">ver. 2.4.6</span>
        </div>
      </div>
    </footer>
  )
}
