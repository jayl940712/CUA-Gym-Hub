import React from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { itemUrl } from '../utils/urls.js'
import {
  formatPrice, formatDate, formatCardLocation, categoryName, thumbUrl, NO_PHOTO
} from '../utils/format.js'
import { termsRegex } from '../utils/search.js'

/**
 * One `<li class="listing-card">`. Markup matches the sigma theme exactly.
 *
 * The " / " separators between category / location / date are CSS ::after
 * content, NOT markup — the DOM has three bare <span>s.
 * `.desc` is emitted in both layouts; gallery view hides it with CSS.
 *
 * The row modifier class is NOT the same in every list. Measured on the source:
 *   - search results + "my listings" (`ul.…items`)      -> `last`  on index % 4 === 3
 *   - the home page's latest listings (`ul.…latestItems`) -> `first` on index % 3 === 0
 * so `ListingCardList` decides and passes it down as `modifier`; the legacy
 * `index`-derived fallback is kept only for a direct caller that passes neither.
 *
 * Props:
 *   item      resolved item object (see src/data/catalog.js `toItem`)
 *   index     0-based position in the list
 *   modifier  '' | 'first' | 'last' — the extra class on the <li>
 *   terms     optional string[] of search terms to <strong>-highlight in .desc
 *   adminOptions  optional node rendered inside .listing-data (Edit / Delete)
 */
export default function ListingCard({
  item, index = 0, modifier = null, terms = null, adminOptions = null
}) {
  const { sid } = useApp()
  const href = itemUrl(item.id, sid)
  const title = item.title || ''
  const extra = modifier === null ? (index % 4 === 3 ? 'last' : '') : modifier

  return (
    <li className={`listing-card ${extra}`}>
      <Link className="listing-thumb" to={href} title={title}>
        <img
          src={thumbUrl(item.id)}
          title=""
          alt={title}
          width="240"
          height="200"
          onError={(e) => { if (e.currentTarget.src.indexOf(NO_PHOTO) === -1) e.currentTarget.src = NO_PHOTO }}
        />
      </Link>

      <div className="listing-detail">
        <div className="listing-cell">
          <div className="listing-data">
            <div className="listing-basicinfo">
              <Link to={href} className="title" title={title}>{title}</Link>
              <div className="listing-attributes">
                <span className="currency-value">{formatPrice(item.price)}</span>
                <div className="listing-details">
                  <span className="category">{categoryName(item.cat)}</span>
                  <span className="location">{formatCardLocation(item)}</span>
                  <span className="date">{formatDate(item.pub)}</span>
                </div>
              </div>

              <div className="desc">{highlight(item.excerpt || '', terms)}</div>
            </div>
            {adminOptions}
          </div>
        </div>
      </div>
    </li>
  )
}

/**
 * Wrap each matched search term in <strong>, as the source's osc_highlight does.
 * Whole-word only, and the ORIGINAL casing is preserved inside the <strong> —
 * both confirmed on the live site (`<strong>BOAT</strong>`, `<strong>boat</strong>`,
 * and never a `<strong>boat</strong>s`).
 */
function highlight(text, terms) {
  const re = termsRegex(terms, 'g')
  if (!re) return text
  // String.split with a capture group puts the matches at the odd indices.
  const parts = String(text).split(re)
  if (parts.length === 1) return text
  return parts.map((p, i) => (
    i % 2 === 1 ? <strong key={i}>{p}</strong> : <React.Fragment key={i}>{p}</React.Fragment>
  ))
}
