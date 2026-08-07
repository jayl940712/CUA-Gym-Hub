import React from 'react'
import Layout from '../components/layout/Layout.jsx'

// Postmill's 404. `/f/games` genuinely 404s on the source (no such forum —
// there is `gaming`), and the mock matches it rather than inventing a forum.
export default function NotFound() {
  return (
    <Layout title="Page not found">
      <h1 className="page-heading">Page not found</h1>
      <p className="fg-muted">The requested page was not found.</p>
    </Layout>
  )
}
