import React from 'react'
import SLink from '../SLink.jsx'

// templates/forum/_list_tabs (rendered inside forum/list.html.twig,
// list_all.html.twig and tag/list.html.twig) — verbatim from
// assets/html/root-forums.html, root-forums_all.html and tags.html:
//
//   <ul class="unlistify flex">
//     <li><a href="/forums"     class="tab tab--active">Forums</a></li>
//     <li><a href="/tags"       class="tab ">Tags</a></li>
//     <li><a href="/forums/all" class="tab ">Alphabetical</a></li>
//   </ul>
//
// Copy: nav.forums `Forums`, nav.tags `Tags`, nav.alphabetical `Alphabetical`.
export default function ForumsNav({ active = 'forums' }) {
  return (
    <ul className="unlistify flex">
      <li>
        <SLink to="/forums" className={`tab ${active === 'forums' ? 'tab--active' : ''}`}>Forums</SLink>
      </li>
      <li>
        <SLink to="/tags" className={`tab ${active === 'tags' ? 'tab--active' : ''}`}>Tags</SLink>
      </li>
      <li>
        <SLink to="/forums/all" className={`tab ${active === 'all' ? 'tab--active' : ''}`}>Alphabetical</SLink>
      </li>
    </ul>
  )
}
