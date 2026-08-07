import React, { useEffect } from 'react'
import SLink from '../SLink.jsx'
import './user.css'

// Postmill's 403, verbatim from assets/html/users-auth.html — the response the
// live site actually returns to `MarvelsGrantMan136` for admin-only pages such
// as `/users`. It is a standalone error document: no site nav, no sidebar, no
// footer, centred sans-serif text on #f8f8f8.
//
// The source markup includes
// `<img src="/apple-touch-icon-precomposed.png" width="128" height="128">`.
// That asset was not extracted into public/, and requesting a missing file
// would be a runtime network call, so the <img> is omitted rather than left
// dangling. Everything textual is unchanged.
//
// Copy: 'action.go_to_home_page: Go to home page'.

export default function Forbidden({ title = '403 Forbidden' }) {
  useEffect(() => { document.title = title }, [title])

  return (
    <div className="http-error">
      <header>
        <h1>{title}</h1>
      </header>
      <nav>
        <p><SLink to="/">Go to home page</SLink></p>
      </nav>
    </div>
  )
}
