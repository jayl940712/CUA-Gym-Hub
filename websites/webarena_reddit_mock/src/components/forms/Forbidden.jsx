import React from 'react'
import SLink from '../SLink.jsx'
import './forms.css'

/**
 * The source's 403. Captured verbatim in `assets/html/f_news_edit-auth.html`:
 * Postmill does NOT render its own shell for a 403 — it serves the bare
 * Symfony/nginx error document.
 *
 *   <h1>403 Forbidden</h1>
 *   <nav><p><a href="/">Go to home page</a></p></nav>
 *
 * `MarvelsGrantMan136` moderates none of the 95 seeded forums and is not admin,
 * so `/f/news/edit` must land here — while a forum she creates via
 * `/create_forum` must render the real form (webarena-580..584).
 */
export default function Forbidden() {
  React.useEffect(() => { document.title = '403 Forbidden' }, [])
  return (
    <div className="error-page">
      <header>
        <h1>403 Forbidden</h1>
      </header>
      <nav>
        <p><SLink to="/">Go to home page</SLink></p>
      </nav>
    </div>
  )
}
