import React from 'react'
import { SLink } from '../utils/url.js'

/**
 * items: [{label, to, className}] — the last crumb renders as plain grey text.
 *
 * Source markup (`/electronics/headphones.html`):
 *   <li class="item home"><a href="/" title="Go to Home Page">Home</a></li>
 *   <li class="item category11"><a href="/electronics.html" title="">Electronics</a></li>
 *   <li class="item category60"><strong>Headphones</strong></li>
 * i.e. every crumb carries its own class (`category<id>`, `search`), and the
 * linked non-home crumbs carry an empty `title=""`.
 */
export default function Breadcrumbs({ items }) {
  if (!items || !items.length) return null
  return (
    <div className="breadcrumbs">
      <ul className="items">
        <li className="item home"><SLink to="/" title="Go to Home Page">Home</SLink></li>
        {items.map((it, idx) => (
          <li className={`item ${it.className || ''}`.trim()} key={idx}>
            {idx === items.length - 1 || !it.to
              ? <strong>{it.label}</strong>
              : <SLink to={it.to} title="">{it.label}</SLink>}
          </li>
        ))}
      </ul>
    </div>
  )
}
