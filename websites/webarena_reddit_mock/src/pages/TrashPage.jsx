import React from 'react'
import { useLocation } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import SLink from '../components/SLink.jsx'
import Icon from '../components/Icon.jsx'
import Submission from '../components/Submission.jsx'
import CommentRow from '../components/discovery/CommentRow.jsx'
import { useApp } from '../context/AppContext.jsx'
import '../components/discovery/discovery.css'

// ROUTES #8 — `/trash`, templates/front/trash.html.twig (read out of the
// container; the route 302s to /login for anonymous curl so it could not be
// captured):
//
//   <nav class="flex flex--guttered">
//     <h1>Trash</h1>
//     {{ include('front/_moderator_nav.html.twig') }}   -> Forums / Trash tabs
//   </nav>
//   {{ alert('help.front_trash'|trans, 'info') }}
//   …items…  or  <p class="fg-muted"><small class="text-md">There are no entries to display.</small></p>
//
// Copy: nav.trash `Trash`, nav.forums `Forums`,
//       help.front_trash `This page shows posts that were deleted by a
//       moderator in the forums you moderate.`,
//       flash.no_entries_to_display `There are no entries to display.`
//
// `FrontController::trash` scopes the list to forums the user moderates.
// `MarvelsGrantMan136` moderates nothing on the seeded corpus, so this page is
// empty on boot — and it stays honest afterwards: it lists whatever really did
// get trashed in a forum the session's user moderates, rather than hard-coding
// the empty state.

export default function TrashPage() {
  const location = useLocation()
  const { state, getSubmission, getComment, moderates } = useApp()

  const trashedSubmissions = (state.submissions || [])
    .filter(s => s.visibility === 'trashed' && moderates(s.forum))

  const trashedComments = (state.comments || [])
    .filter(c => {
      if (c.visibility !== 'trashed') return false
      const sub = getSubmission(c.submission)
      return !!sub && moderates(sub.forum)
    })

  const empty = trashedSubmissions.length === 0 && trashedComments.length === 0
  const onTrash = location.pathname === '/trash'

  return (
    <Layout title="Trash">
      <nav className="flex flex--guttered">
        <h1 className="page-heading flex__grow">Trash</h1>

        <ul className="unlistify flex">
          <li><SLink to="/moderated" className={`tab ${onTrash ? '' : 'tab--active'}`}>Forums</SLink></li>
          <li><SLink to="/trash" className={`tab ${onTrash ? 'tab--active' : ''}`}>Trash</SLink></li>
        </ul>
      </nav>

      <div className="alert bg-blue">
        <div className="alert__icon fg-blue" aria-hidden="true"><Icon name="info-circled" /></div>
        <div className="alert__text">
          <p>This page shows posts that were deleted by a moderator in the forums you moderate.</p>
        </div>
      </div>

      {empty ? (
        <p className="fg-muted"><small className="text-md">There are no entries to display.</small></p>
      ) : (
        <>
          {trashedSubmissions.map(s => (
            <Submission key={`s${s.id}`} submission={s} showForum />
          ))}
          {trashedComments.map(c => (
            <CommentRow
              key={`c${c.id}`}
              comment={c}
              submission={getSubmission(c.submission)}
              parent={c.parent !== undefined && c.parent !== null ? getComment(c.parent) : null}
            />
          ))}
        </>
      )}
    </Layout>
  )
}
