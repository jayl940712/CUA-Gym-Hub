import React from 'react'
import SLink from '../SLink.jsx'

// templates/user/_inbox_nav.html.twig, verbatim — confirmed against
// assets/html/notifications-auth.html and messages-auth.html:
//
//   <nav class="flex flex--guttered">
//     <ul class="flex unlistify">
//       <li><a href="/notifications" class="tab tab--active">Notifications</a></li>
//       <li><a href="/messages"      class="tab ">Messages</a></li>
//     </ul>
//   </nav>

export default function InboxNav({ active = 'notifications' }) {
  return (
    <nav className="flex flex--guttered">
      <ul className="flex unlistify">
        <li>
          <SLink to="/notifications" className={`tab ${active === 'notifications' ? 'tab--active' : ''}`}>
            Notifications
          </SLink>
        </li>
        <li>
          <SLink to="/messages" className={`tab ${active === 'messages' ? 'tab--active' : ''}`}>
            Messages
          </SLink>
        </li>
      </ul>
    </nav>
  )
}
