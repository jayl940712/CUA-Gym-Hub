import React from 'react'
import PageShell from '../components/layout/PageShell.jsx'

/**
 * Honest stand-in for a route whose page has not been built yet.
 *
 * It renders the real page title from the route table so the URL resolves, the
 * shell is correct and the title matches the source — and nothing else. It must
 * never render invented records, counts or controls: a fabricated grid is worse
 * than an empty one because an evaluator would read it.
 *
 * Feature agents replace `component` in the App.jsx route table; this file
 * should not need to change.
 */
export default function AreaPage({ title }) {
  return (
    <PageShell title={title}>
      <div className="admin__data-grid-empty">
        This page is not implemented in the mock yet.
      </div>
    </PageShell>
  )
}
