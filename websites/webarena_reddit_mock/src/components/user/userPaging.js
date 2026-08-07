// PagerWave cursor pagination for the /user/<name>* listings.
//
// src/utils/listing.js already implements this for submission listings, but it
// keys the ORDER BY off a submission sort mode (`hot`/`new`/…). The user pages
// use their own specs, read verbatim off the live `rel="next"` links:
//
//   /user/X               -> ?next%5Btimestamp%5D=2023-03-27T16%3A11%3A28%2B00%3A00
//   /user/X/submissions   -> ?next%5Bid%5D=135139
//   /user/X/comments      -> ?next%5Btimestamp%5D=…&next%5Bid%5D=237436
//
// (assets/html/user_MarvelsGrantMan136*.html). 25 rows per page, like every
// other listing on the site.

import { readCursor, buildCursorQuery, PER_PAGE } from '../../utils/listing.js'

export const USER_PAGE_SPECS = {
  overview: [{ field: 'timestamp', dir: 'DESC' }],
  submissions: [{ field: 'id', dir: 'DESC' }],
  comments: [{ field: 'timestamp', dir: 'DESC' }, { field: 'id', dir: 'DESC' }]
}

function keyValue(row, field) {
  if (field === 'timestamp' || field === 'lastActive') {
    const t = Date.parse(row[field])
    return isNaN(t) ? 0 : t
  }
  return Number(row[field]) || 0
}

function cursorValue(raw, field) {
  if (raw === undefined || raw === null) return null
  if (field === 'timestamp' || field === 'lastActive') {
    const t = Date.parse(raw)
    return isNaN(t) ? null : t
  }
  const n = Number(raw)
  return isNaN(n) ? null : n
}

export function sortRows(rows, spec) {
  return [...rows].sort((a, b) => {
    for (const { field, dir } of spec) {
      const av = keyValue(a, field)
      const bv = keyValue(b, field)
      if (av !== bv) return dir === 'ASC' ? av - bv : bv - av
    }
    return 0
  })
}

/**
 * An unrecognised or malformed `next[...]` is accepted and ignored rather than
 * 404ed, per ROUTES.md.
 */
export function paginateRows(sorted, spec, searchParams, perPage = PER_PAGE) {
  const cursor = readCursor(searchParams, 'next')
  let rows = sorted

  if (cursor) {
    const parsed = spec
      .map(({ field, dir }) => ({ field, dir, value: cursorValue(cursor[field], field) }))
      .filter(c => c.value !== null)

    if (parsed.length) {
      rows = sorted.filter(row => {
        for (const { field, dir, value } of parsed) {
          const v = keyValue(row, field)
          if (v !== value) return dir === 'ASC' ? v > value : v < value
        }
        return true // equal on every cursor field — this IS the first row
      })
    }
  }

  const items = rows.slice(0, perPage)
  const overflow = rows[perPage]
  const nextCursor = overflow
    ? spec.reduce((acc, { field }) => {
        acc[field] = field === 'timestamp' || field === 'lastActive'
          ? overflow[field]
          : String(overflow[field])
        return acc
      }, {})
    : null

  return { items, nextCursor }
}

export { buildCursorQuery }
