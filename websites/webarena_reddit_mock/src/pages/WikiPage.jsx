import React from 'react'
import Layout from '../components/layout/Layout.jsx'

// ROUTES #96 — `/wiki/{path}` (default path `index`).
//
// There are no wiki pages in this corpus, and the source proves it: `/wiki`,
// `/wiki/index` and `/wiki/Something` ALL return HTTP 404 carrying the
// wiki-specific not-found body inside the normal site layout (verified live,
// and captured in assets/html/wiki.html):
//
//   <main …>
//     <h1 class="page-heading">Page not found</h1>
//     <p>The requested page was not found.</p>
//   </main>
//
// Copy: wiki.not_found_title `Page not found`,
//       wiki.not_found_message `The requested page was not found.`
//
// That is deliberately NOT the generic Symfony 404 shell — the wiki controller
// renders its own miss page. Do not fabricate a wiki index; the whole job here
// is the correct miss.

export default function WikiPage() {
  return (
    <Layout title="Page not found">
      <h1 className="page-heading">Page not found</h1>
      <p>The requested page was not found.</p>
    </Layout>
  )
}
