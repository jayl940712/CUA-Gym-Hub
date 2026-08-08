import React from 'react'
import ListingCard from './ListingCard.jsx'

/**
 * `<ul class="listing-card-list {listing-list|listing-grid} {extra}" id="listing-card-list">`
 *
 * The per-row modifier class differs by list, measured on the source:
 *   - `items`       (search results, "my listings"): `last` on every 4th row
 *                   `<li class="listing-card ">×3 then <li class="listing-card last">`
 *   - `latestItems` (home page):                     `first` on every 3rd row
 *                   `<li class="listing-card first">` then two plain ones
 *
 * Props:
 *   items      resolved item objects
 *   showAs     'list' | 'gallery'   ('gallery' -> listing-grid)
 *   extraClass e.g. 'items' | 'latestItems'
 *   terms      search terms to highlight inside .desc
 *   adminOptionsFor  optional (item) => node, for the "my listings" Edit/Delete row
 */
export default function ListingCardList({
  items, showAs = 'list', extraClass = 'items', terms = null, adminOptionsFor = null
}) {
  const layout = showAs === 'gallery' ? 'listing-grid' : 'listing-list'
  const modifierAt = extraClass === 'latestItems'
    ? (i) => (i % 3 === 0 ? 'first' : '')
    : (i) => (i % 4 === 3 ? 'last' : '')

  return (
    <ul className={`listing-card-list ${layout} ${extraClass}`.trim()} id="listing-card-list">
      {items.map((item, i) => (
        <ListingCard
          /* the captured order arrays repeat an id here and there — the source's
             unstable sort under OFFSET paging does that — so the index has to be
             part of the key or React warns about duplicates. */
          key={`${item.id}-${i}`}
          item={item}
          index={i}
          modifier={modifierAt(i)}
          terms={terms}
          adminOptions={adminOptionsFor ? adminOptionsFor(item) : null}
        />
      ))}
    </ul>
  )
}
