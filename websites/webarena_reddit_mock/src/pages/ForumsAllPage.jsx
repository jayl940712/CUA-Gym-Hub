import React from 'react'
import Layout from '../components/layout/Layout.jsx'
import SLink from '../components/SLink.jsx'
import ForumsNav from '../components/discovery/ForumsNav.jsx'
import { useApp } from '../context/AppContext.jsx'
import '../components/discovery/discovery.css'

// ROUTES #32 — `/forums/all`, templates/forum/list_all.html.twig.
// Verbatim from assets/html/root-forums_all.html and
// assets/screenshots/reference/09-forums-all.png:
//
//   <h1 class="page-heading">All forums</h1>
//   <div class="columns flow">
//     <div class="text-flow">
//       <h2>A</h2>
//       <ul class="unlistify"><li><a href="/f/allentown">allentown</a></li>…</ul>
//     </div>
//     …
//   </div>
//
// Flat A–Z over every forum, grouped by the UPPERCASED first letter, ordered
// case-insensitively, and with **no pagination at all** (all 95 on one page).
// `.columns` is CSS multi-column, which is what produces the five visual
// columns in the screenshot — the DOM is a single ordered sequence of groups.

export default function ForumsAllPage() {
  const { state } = useApp()

  const sorted = [...state.forums].sort((a, b) =>
    String(a.name).toLowerCase().localeCompare(String(b.name).toLowerCase()))

  const groups = []
  for (const forum of sorted) {
    const letter = String(forum.name).charAt(0).toUpperCase()
    const last = groups[groups.length - 1]
    if (last && last.letter === letter) last.forums.push(forum)
    else groups.push({ letter, forums: [forum] })
  }

  return (
    <Layout title="All forums">
      <ForumsNav active="all" />

      <h1 className="page-heading">All forums</h1>

      <div className="columns flow">
        {groups.map(group => (
          <div className="text-flow" key={group.letter}>
            <h2>{group.letter}</h2>
            <ul className="unlistify">
              {group.forums.map(f => (
                <li key={f.id}><SLink to={`/f/${f.name}`}>{f.name}</SLink></li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Layout>
  )
}
