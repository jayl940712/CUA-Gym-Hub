import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import NotFound from './NotFound.jsx'
import MembersTable, { canManageMembers } from './MembersTable.jsx'
import { useProject } from './hooks.js'

// ROUTES #94 / #95 — `/:ns/:proj/-/project_members`. Anchor route for 20 tasks.
// assets/README.md §17: heading is an `h4` reading `Project members`, and the
// intro paragraph renders BELOW the button row (`order-md-1`).
//
// The h4 is unconditional but the intro paragraph is not — `/primer/design`,
// where byteblaze is only a Developer, renders the heading and nothing else
// (BUG-B10).

export default function ProjectMembers() {
  const { state, currentUser } = useApp()
  const { project } = useProject()
  usePageChrome({
    title: project
      ? `Members · ${project.namespace ? `${project.namespace.name} / ` : ''}${project.name} · GitLab`
      : 'GitLab',
  })
  if (!project) return <NotFound />

  return (
    <div className="row gl-mt-3">
      <div className="col-lg-12">
        <div className="gl-display-flex gl-flex-wrap">
          <h4>Project members</h4>
          {canManageMembers(state, currentUser, 'project', project.id) ? (
            <p className="gl-w-full order-md-1">
              You can invite a new member to <strong>{project.name}</strong> or invite another group.
            </p>
          ) : null}
        </div>
        <MembersTable sourceType="project" sourceId={project.id} sourceName={project.name} />
      </div>
    </div>
  )
}
