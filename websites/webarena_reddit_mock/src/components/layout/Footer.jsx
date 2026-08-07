import React from 'react'
import { SITE_NAME } from './SiteNav.jsx'

// templates/base.html.twig — `site_footer.app: Running %app% %version%`.
// %version% is empty on this build, hence the trailing space.
export default function Footer() {
  return (
    <footer className="site-footer">
      <p>
        <span className="fg-muted text-xs page-shadow">
          Running <a href="https://postmill.xyz/">{SITE_NAME}</a>{' '}
        </span>
      </p>
    </footer>
  )
}
