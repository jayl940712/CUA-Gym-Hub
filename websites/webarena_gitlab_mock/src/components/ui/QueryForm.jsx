import React from 'react'
import { useQueryNavigate } from '../../utils/RedirectWithQuery.jsx'

// A `<form method="get">` that submits through the router instead of doing a
// full-page navigation.
//
// AUDIT.part-handlers.md HANDLER-003: a native GET submit rebuilds the URL from
// the form's own fields only, so `?sid=` is silently dropped from the agent's
// URL — which is exactly what a `url_match` evaluator reads. It also costs a
// full page reload on every search.
//
// This keeps `method="get"` and `action=` on the element so the captured DOM
// stays verbatim, reproduces the browser's own serialisation (every named,
// enabled field in document order, empty values included), and then appends the
// live `sid` last so the source's param order is unchanged.

export default function QueryForm({ action, children, ...rest }) {
  const go = useQueryNavigate()

  function handleSubmit(e) {
    e.preventDefault()
    const params = new URLSearchParams()
    for (const [name, value] of new FormData(e.currentTarget).entries()) {
      params.append(name, typeof value === 'string' ? value : '')
    }
    // `action` may itself carry a query string; a real browser discards it in
    // favour of the form fields, so only the path is kept.
    const [path] = String(action || '').split('?')
    const q = params.toString()
    // keepQuery:false — a submit replaces the previous filter set, exactly as a
    // native submit would; only `sid` survives.
    go(q ? `${path}?${q}` : path, { keepQuery: false })
  }

  return (
    <form {...rest} method="get" action={action} onSubmit={handleSubmit}>
      {children}
    </form>
  )
}
