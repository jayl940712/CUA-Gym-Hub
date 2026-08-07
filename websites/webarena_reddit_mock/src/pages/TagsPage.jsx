import React from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import ForumsNav from '../components/discovery/ForumsNav.jsx'
import SLink from '../components/SLink.jsx'
import NotFound from './NotFound.jsx'
import { useApp } from '../context/AppContext.jsx'
import '../components/discovery/discovery.css'

// ROUTES #92 — `/tags` and `/tags/{page}`, templates/forum_tag/list.html.twig,
// which embeds `_layouts/table.html.twig` with `items: tags`:
//
//   <ul class="unlistify flex"> …Forums / Tags(active) / Alphabetical… </ul>
//   <h1 class="page-heading">Tags</h1>
//   table  Name | Forums          (when there is at least one tag)
//   <p><small class="fg-muted text-md">There are no entries to display.</small></p>
//                                    (when there is not — verbatim from
//                                     assets/html/tags.html)
//
// The seed has **zero** tags — ForumTag rows do not exist in the container's
// database — so a fresh session still renders exactly the captured empty state
// and nothing is fabricated. But `#forum_tags` on /create_forum and
// /f/{name}/edit writes `forums[i].tags`, and the field's own
// "See the full list of tags" link points here, so a tag the user creates has
// to show up. The list is derived from state, never stored separately.
//
// `label.forums_count` = '{0} No forums|{1} %count% forum|]1,Inf[ %count% forums'.
// `/tags/2` returns a hard 404 on the source (the pager has one page), and the
// source's per-page is 25, so anything past page 1 404s here too.

const PER_PAGE = 25

/** Distinct tag names across every forum, case-insensitively deduped. */
export function collectTags(forums) {
  const byKey = new Map()
  for (const forum of forums || []) {
    for (const raw of forum.tags || []) {
      const name = String(raw).trim()
      if (!name) continue
      const key = name.toLowerCase()
      if (!byKey.has(key)) byKey.set(key, { name, forumCount: 0 })
      byKey.get(key).forumCount += 1
    }
  }
  return [...byKey.values()].sort((a, b) => a.name.localeCompare(b.name))
}

export default function TagsPage() {
  const params = useParams()
  const { state } = useApp()

  const tags = collectTags(state.forums)
  const pageCount = Math.max(1, Math.ceil(tags.length / PER_PAGE))

  let page = 1
  if (params.page !== undefined) {
    if (!/^[1-9][0-9]{0,17}$/.test(params.page)) return <NotFound />
    page = Number(params.page)
    if (page > pageCount) return <NotFound />
  }
  const rows = tags.slice((page - 1) * PER_PAGE, page * PER_PAGE)

  return (
    <Layout title="Tags">
      <ForumsNav active="tags" />

      <h1 className="page-heading">Tags</h1>

      {rows.length === 0 ? (
        <p><small className="fg-muted text-md">There are no entries to display.</small></p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th className="table__shrink">Forums</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(tag => (
              <tr key={tag.name}>
                <td><SLink to={`/tag/${tag.name}`}>{tag.name}</SLink></td>
                <td className="table__shrink">
                  {tag.forumCount === 1 ? '1 forum' : `${tag.forumCount} forums`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Layout>
  )
}
