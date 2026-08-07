import React from 'react'
import Icon from './Icon.jsx'
import { useApp } from '../context/AppContext.jsx'

// templates/_layouts/vote.html.twig, verbatim.
//
// ⚠️ THE `class` ATTRIBUTE ON <form> IS A LITERAL EVALUATOR ASSERTION.
// It takes exactly three values and nothing else:
//     "vote" | "vote vote--user-upvoted" | "vote vote--user-downvoted"
// webarena-404..410 and 714..730 (16 tasks) run
//   document.querySelector('div.submission__vote').querySelector('form')
//           .getAttribute('class')
// and string-compare. Any extra class breaks all sixteen.
//
// The button `value` is 0 on whichever button would RETRACT the current vote
// (vote.html.twig block vote_button), and the titles swap to
// "Retract upvote" / "Retract downvote" accordingly.
//
// Score text: the Stimulus vote controller sets `scoreTarget.innerText = score`
// on connect for logged-in users, so the agent sees an ungrouped integer.
// Negative scores are U+2212 + abs, followed by a visually hidden U+2212.

export default function Vote({ kind, id, netScore }) {
  const { vote, submissionVote, commentVote } = useApp()
  const choice = kind === 'comment' ? commentVote(id) : submissionVote(id)

  const formClass = choice === 1
    ? 'vote vote--user-upvoted'
    : choice === -1
      ? 'vote vote--user-downvoted'
      : 'vote'

  const action = kind === 'comment' ? `/cv/${id}` : `/sv/${id}`
  const score = Number(netScore) || 0

  const submit = (e, direction) => {
    e.preventDefault()
    vote(kind, id, direction)
  }

  return (
    <form action={action} method="post" className={formClass} onSubmit={e => e.preventDefault()}>
      <button
        type="submit" name="choice" value={choice === 1 ? 0 : 1}
        className="unbuttonize vote__button vote__up"
        title={choice === 1 ? 'Retract upvote' : 'Upvote'}
        onClick={e => submit(e, 1)}
      >
        <span aria-hidden="true"><Icon name="up" alt="up" className="icon--no-align" /></span>
      </button>

      <span className="vote__net-score">
        {score >= 0
          ? String(score)
          : <>&minus;{Math.abs(score)}<span className="no-visibility" aria-hidden="true">&minus;</span></>}
      </span>

      <span className="vote__spinner">
        <Icon name="spinner" alt="loading" className="icon--pulse" />
      </span>

      <button
        type="submit" name="choice" value={choice === -1 ? 0 : -1}
        className="unbuttonize vote__button vote__down"
        title={choice === -1 ? 'Retract downvote' : 'Downvote'}
        onClick={e => submit(e, -1)}
      >
        <span aria-hidden="true"><Icon name="down" alt="down" className="icon--no-align" /></span>
      </button>
    </form>
  )
}
