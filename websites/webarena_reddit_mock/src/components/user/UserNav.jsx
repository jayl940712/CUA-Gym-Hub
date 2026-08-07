import React from 'react'
import SLink from '../SLink.jsx'

// templates/user/_nav.html.twig, verbatim:
//
//   <nav class="user-nav">
//     <ul class="unlistify flex">
//       <li><a href="/user/{n}"             class="tab tab--active">Overview</a></li>
//       <li><a href="/user/{n}/submissions" class="tab ">Submissions</a></li>
//       <li><a href="/user/{n}/comments"    class="tab ">Comments</a></li>
//     </ul>
//   </nav>
//   <h1 class="page-heading break-text no-desktop">{username}</h1>
//
// Copy keys: label.overview / user.submissions / user.comments.

const TABS = [
  { key: 'user', suffix: '', label: 'Overview' },
  { key: 'user_submissions', suffix: '/submissions', label: 'Submissions' },
  { key: 'user_comments', suffix: '/comments', label: 'Comments' }
]

export default function UserNav({ username, current = 'user' }) {
  return (
    <>
      <nav className="user-nav">
        <ul className="unlistify flex">
          {TABS.map(tab => (
            <li key={tab.key}>
              <SLink
                to={`/user/${username}${tab.suffix}`}
                className={`tab ${tab.key === current ? 'tab--active' : ''}`}
              >
                {tab.label}
              </SLink>
            </li>
          ))}
        </ul>
      </nav>

      <h1 className="page-heading break-text no-desktop">{username}</h1>
    </>
  )
}
