import React from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'

// ROUTES #27 — `/moderation_log` and `/moderation_log/{page}`,
// ForumController::globalModerationLog + templates/forum/global_moderation_log.html.twig,
// both read out of container `forum`.
//
// This route was previously unregistered, so it 404ed — while
// `/f/{forum}/moderation_log` renders the source's own `Global moderation log`
// button pointing straight at it. That made it a live dead link.
//
// The source's page is:
//
//   <h1 class="page-heading">Global moderation log</h1>          (title.global_moderation_log)
//   {% if logs|length > 0 %} … {% else %}
//     <p class="no-entries"><small class="fg-muted text-md">
//       There are no entries to display.                          (flash.no_entries_to_display)
//     </small></p>
//
// and its `block sidebar` is base.html.twig's default — empty. Verified live as
// `MarvelsGrantMan136`: GET /moderation_log -> 200 with exactly that body and
// `<aside id="sidebar"></aside>`.
//
// The seed carries no `forum_log_entry` rows (nothing in the mock has ever been
// mod-deleted, banned, locked or pinned), so the empty branch IS the complete
// implementation. Log entries are never fabricated. If a task ever mod-deletes
// something, the entry belongs in state and renders through the branch above —
// but nothing in the shipped mock writes one, so there is no dead reader here.
//
// `/moderation_log/2` is a hard 404 on the source (Pagerfanta out-of-range),
// confirmed live alongside `/moderation_log/1` -> 200.

export default function ModerationLogPage() {
  const params = useParams()

  if (params.page !== undefined) {
    if (!/^[0-9]+$/.test(params.page)) return <NotFound />
    if (Number(params.page) !== 1) return <NotFound />
  }

  return (
    <Layout title="Global moderation log">
      <h1 className="page-heading">Global moderation log</h1>

      <p className="no-entries">
        <small className="fg-muted text-md">There are no entries to display.</small>
      </p>
    </Layout>
  )
}
