import React from 'react'
import { useParams } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import NotFound from './NotFound.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import MembersTable, { canManageMembers } from './MembersTable.jsx'

// ROUTES #121 — `/groups/:group/-/group_members`. assets/README.md §18b.
//
// The five anchor groups (coding_friends, crew, n-lab, webagent, x-lab) do NOT
// exist in the source: tasks 799–803 create them at /groups/new, and the
// evaluator then loads this route and string-matches the invited `@handle`s.
// So this page must render for a group the task just made and must never 404
// on an unknown slug. Members are stored with source_type 'namespace'
// (assets/data_model.md §9).
//
// §18b: no `Import from a project` button on a group; the sub-copy is
// `You're viewing members of <name>.` rather than the project wording.

export default function GroupMembers() {
  const { group: slug } = useParams()
  const { state, currentUser } = useApp()
  const group = state.groups.find(g => g.path === slug)

  usePageChrome({ title: `Group members · ${group ? group.name : slug} · GitLab` })

  // AUDIT P2-4 / DIFF-001 — the source 404s on a group that does not exist;
  // it does not render a members shell with a "create it first" prompt. That
  // prompt was invented copy and is gone.
  if (!group) return <NotFound />

  return (
    <div className="row gl-mt-3">
      <div className="col-lg-12">
        {/* §18b — unlike the project page, the group page hides the heading
            too when the viewer cannot manage members: the source's header div
            is empty on `/groups/robert1003/-/group_members` (BUG-B10). */}
        <div className="gl-display-flex gl-flex-wrap">
          {canManageMembers(state, currentUser, 'namespace', group.id) ? (
            <>
              <h4>Group members</h4>
              <p className="gl-w-full order-md-1">
                You&apos;re viewing members of <strong>{group.name}</strong>.
              </p>
            </>
          ) : null}
        </div>
        <MembersTable sourceType="namespace" sourceId={group.id} sourceName={group.name} kind="group" />
      </div>
    </div>
  )
}
