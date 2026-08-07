import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import Submission from '../components/Submission.jsx'
import CommentRow from '../components/discovery/CommentRow.jsx'
import { useSidNavigate } from '../components/SLink.jsx'
import { useApp } from '../context/AppContext.jsx'
import { queryStems, highlightAll, headlineExcerpt } from '../utils/searchHighlight.js'
import '../components/discovery/discovery.css'

// ROUTES #90 — `/search?q=…`, templates/search/results.html.twig.
// Captures: assets/html/search_q_machine_learning.html, search_q_headphone.html
// plus two live probes taken while building this page (`?q=bookshop`, and a
// deliberately-unmatchable query for the empty state).
// Screenshot: assets/screenshots/reference/13-search-results.png.
//
// The source runs Postgres full-text over `submissions.search_doc` AND
// `comments.search_doc` (both tsvector + GIN). The mock has no server, so it
// does the client-side approximation TODO.md specifies: tokenise the query on
// whitespace, require EVERY term, case-insensitive substring.
//
// Shape confirmed against the source, not guessed:
//   * `<h1 class="page-heading">Search</h1>` then the GET form, then the
//     results — the count lives in an `<h2>`, not the `<h1>`.
//   * heading.search_results:
//       '{0} No results for %query%|{1} 1 result for %query%:|]1,Inf[ %count% results for %query%:'
//     — note the colon is present ONLY when there is at least one result.
//   * the empty state adds
//       <p><small class="fg-muted text-md">There are no entries to display.</small></p>
//   * comments DO appear in results (this resolves assets/README.md UNVERIFIED
//     item 5): `?q=bookshop` returns 5 submissions followed by 45 comments.
//     Submissions are listed first, then comments.
//   * the result set is capped at 50 with no pager — `machine learning`,
//     `headphone` and `bookshop` all return exactly 50 on the source.
//   * `?q=` absent or empty renders the form alone, with no `<h2>` at all.
//
// The `<mark>` highlighting and the ts_headline body excerpt ARE reproduced now
// — see src/utils/searchHighlight.js, whose window/short-word rules were read
// off the container's own `ts_headline()` output. Submission and CommentRow take
// `rawTitle` / `rawBody`, exactly like the Twig macros' `raw_title` / `raw_body`.
// Result SELECTION is unchanged (still the substring approximation below);
// only the rendering matches the source.

export const MAX_RESULTS = 50

/** Postgres tokenises on whitespace; so do we. All terms must match. */
export function searchTerms(query) {
  return String(query || '').trim().toLowerCase().split(/\s+/).filter(Boolean)
}

export function matchesAll(haystack, terms) {
  if (!terms.length) return false
  const hay = String(haystack || '').toLowerCase()
  return terms.every(t => hay.includes(t))
}

/**
 * Submissions match on title + body, comments on body — exactly the two
 * `search_doc` columns the source indexes.
 *
 * Ordering is a stand-in for ts_rank, which cannot be reproduced client-side:
 * title hits before body-only hits, then netScore DESC, then id DESC. The
 * source's own ordering is opaque and unanchored, so this only has to be
 * stable and sensible.
 */
export function runSearch(state, query, limit = MAX_RESULTS) {
  const terms = searchTerms(query)
  if (!terms.length) return { submissions: [], comments: [], total: 0 }

  const submissions = state.submissions
    .filter(s => s.visibility !== 'trashed')
    .filter(s => matchesAll(`${s.title || ''}\n${s.body || ''}`, terms))
    .map(s => ({ s, titleHit: matchesAll(s.title, terms) ? 1 : 0 }))
    .sort((a, b) =>
      b.titleHit - a.titleHit ||
      (b.s.netScore || 0) - (a.s.netScore || 0) ||
      b.s.id - a.s.id)
    .map(x => x.s)
    .slice(0, limit)

  const remaining = limit - submissions.length
  const comments = remaining <= 0 ? [] : state.comments
    .filter(c => c.visibility !== 'trashed')
    .filter(c => matchesAll(c.body, terms))
    .sort((a, b) => (b.netScore || 0) - (a.netScore || 0) || b.id - a.id)
    .slice(0, remaining)

  return { submissions, comments, total: submissions.length + comments.length }
}

/** heading.search_results, pluralised. */
function resultsHeading(total, query) {
  if (total === 0) return <>No results for <em>{query}</em></>
  if (total === 1) return <>1 result for <em>{query}</em>:</>
  return <>{total} results for <em>{query}</em>:</>
}

export default function SearchPage() {
  const [searchParams] = useSearchParams()
  const navigate = useSidNavigate()
  const { state, getSubmission, getComment } = useApp()

  const query = searchParams.get('q') || ''
  const [draft, setDraft] = useState(query)
  useEffect(() => { setDraft(query) }, [query])

  const { submissions, comments, total } = useMemo(
    () => runSearch(state, query), [state, query])

  // plainto_tsquery(:q) — the lexemes ts_headline wraps in <mark>.
  const stems = useMemo(() => queryStems(query), [query])

  const onSubmit = (e) => {
    e.preventDefault()
    navigate(`/search?q=${encodeURIComponent(draft)}`)
  }

  return (
    // `{% block title 'heading.search'|trans %}` — always "Search", never
    // parameterised by the query.
    <Layout title="Search">
      <h1 className="page-heading">Search</h1>

      <form action="/search" method="GET" className="form flow" onSubmit={onSubmit}>
        <div className="form-flex form-flex--single-line form__row">
          <label htmlFor="query" className="form-flex__align text-align-right">Search query</label>
          <input
            name="q" type="search" id="query" className="form-control"
            value={draft} onChange={e => setDraft(e.target.value)}
          />
        </div>

        <div className="form-flex form-flex--single-line form__row form__button-row">
          <span className="form-flex__align" role="presentation"></span>
          <button className="button" type="submit">Search</button>
        </div>
      </form>

      {query !== '' && (
        <>
          <h2>{resultsHeading(total, query)}</h2>

          {total === 0 && (
            <p><small className="fg-muted text-md">There are no entries to display.</small></p>
          )}

          {submissions.map(s => {
            const excerpt = s.body ? headlineExcerpt(s.body, stems) : ''
            return (
              <Submission
                key={`s${s.id}`} submission={s} expanded showForum
                rawTitle={highlightAll(s.title, stems)}
                rawBody={excerpt ? `<p>${excerpt}</p>` : null}
              />
            )
          })}

          {comments.map(c => (
            <CommentRow
              key={`c${c.id}`}
              comment={c}
              submission={getSubmission(c.submission)}
              parent={c.parent !== undefined && c.parent !== null ? getComment(c.parent) : null}
              rawBody={`<p>${headlineExcerpt(c.body || '', stems)}</p>`}
            />
          ))}
        </>
      )}
    </Layout>
  )
}
