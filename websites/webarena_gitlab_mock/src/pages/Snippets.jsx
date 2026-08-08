import React from 'react'
import { usePageChrome } from '../components/layout/Layout.jsx'

// ROUTES #13 / #20 — `/dashboard/snippets` and `/explore/snippets`.
// assets/README.md §4e and §6d.
//
// The instance has ZERO snippet rows, so both routes are pure empty states —
// but they are two DIFFERENT empty states and the copy is verbatim:
//   dashboard: an illustration block with `Code snippets` + two buttons
//   explore:   a bare `<div class="nothing-here-block">No snippets found</div>`
// The dashboard page has no `New snippet` button beside the heading; the only
// one lives inside the empty state.

export default function Snippets({ explore = false }) {
  usePageChrome({ title: explore ? 'Snippets · Explore · GitLab' : 'Snippets · Dashboard · GitLab' })

  return (
    <div>
      <div className="page-title-holder d-flex align-items-center">
        <h1 className="page-title gl-font-size-h-display">Snippets</h1>
      </div>

      <div className="top-area">
        <ul className="gl-border-0 nav gl-tabs-nav">
          <li className="nav-item">
            <a title="Your snippets" href="/dashboard/snippets"
              className={`nav-link gl-tab-nav-item${explore ? '' : ' active gl-tab-nav-item-active'}`}>
              Your snippets
            </a>
          </li>
          <li className="nav-item">
            <a title="Explore snippets" href="/explore/snippets"
              className={`nav-link gl-tab-nav-item${explore ? ' active gl-tab-nav-item-active' : ''}`}>
              Explore snippets
            </a>
          </li>
        </ul>
      </div>

      {explore ? (
        <div className="nothing-here-block">No snippets found</div>
      ) : (
        <div className="row empty-state">
          <div className="col-12">
            <div className="svg-content" data-qa-selector="svg_content" />
          </div>
          <div className="col-12">
            <div className="text-content gl-text-center gl-pt-0">
              <h4>Code snippets</h4>
              <p className="gl-mb-0">Store, share, and embed small pieces of code and text.</p>
              <div className="gl-mt-3">
                <a className="btn gl-button btn-confirm" title="New snippet" id="new_snippet_link"
                  data-qa-selector="create_first_snippet_link" href="/-/snippets/new">New snippet</a>
                <a className="btn gl-button btn-default" title="Documentation"
                  href="/help/user/snippets.md">Documentation</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
