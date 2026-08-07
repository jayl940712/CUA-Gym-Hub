// Submission listing engine — sorts, the ?t= time filter and PagerWave cursor
// pagination, ported from src/Pagination/SubmissionPage.php and
// src/Repository/SubmissionFinder.php (SOURCE.md §3, ROUTES.md "Cursor
// pagination — confirmed formats").

export const SORT_MODES = ['hot', 'new', 'active', 'top', 'controversial', 'most_commented']

export const SORT_LABELS = {
  hot: 'Hot',
  new: 'New',
  active: 'Active',
  top: 'Top',
  controversial: 'Controversial',
  most_commented: 'Most commented'
}

export const TIME_LABELS = {
  all: 'All time',
  day: 'Past 24 hours',
  week: 'Past week',
  month: 'Past month',
  year: 'Past year'
}

export const PER_PAGE = 25

/**
 * ORDER BY per sort, exactly as SubmissionPage.php declares it. The `id`
 * tiebreak is not cosmetic — /f/books hot has a tie at ranking=1423 between
 * 59478 and 17445 and `id DESC` is what keeps 17445 at position 8.
 */
export const SORT_FIELDS = {
  hot: [{ field: 'ranking', dir: 'DESC' }, { field: 'id', dir: 'DESC' }],
  new: [{ field: 'id', dir: 'DESC' }],
  active: [{ field: 'lastActive', dir: 'DESC' }, { field: 'id', dir: 'DESC' }],
  top: [{ field: 'netScore', dir: 'DESC' }, { field: 'id', dir: 'DESC' }],
  controversial: [{ field: 'netScore', dir: 'ASC' }, { field: 'id', dir: 'ASC' }],
  most_commented: [{ field: 'commentCount', dir: 'DESC' }, { field: 'id', dir: 'DESC' }]
}

function keyValue(sub, field) {
  const v = sub[field]
  if (field === 'lastActive' || field === 'timestamp') {
    const t = Date.parse(v)
    return isNaN(t) ? 0 : t
  }
  return Number(v) || 0
}

function cursorValue(raw, field) {
  if (field === 'lastActive' || field === 'timestamp') {
    const t = Date.parse(raw)
    return isNaN(t) ? null : t
  }
  const n = Number(raw)
  return isNaN(n) ? null : n
}

export function normalizeSort(sort, fallback = 'hot') {
  return SORT_MODES.includes(sort) ? sort : fallback
}

/** Sticky submissions float to the top of a forum listing (Postmill behaviour). */
export function sortSubmissions(list, sort) {
  const spec = SORT_FIELDS[sort] || SORT_FIELDS.hot
  return [...list].sort((a, b) => {
    if (!!a.sticky !== !!b.sticky) return a.sticky ? -1 : 1
    for (const { field, dir } of spec) {
      const av = keyValue(a, field)
      const bv = keyValue(b, field)
      if (av !== bv) return dir === 'ASC' ? av - bv : bv - av
    }
    return 0
  })
}

const INTERVALS = {
  day: 24 * 3600 * 1000,
  week: 7 * 24 * 3600 * 1000,
  month: 30 * 24 * 3600 * 1000,
  year: 365 * 24 * 3600 * 1000
}

/**
 * `SubmissionFinder::addTimeClause` — `s.timestamp > now() - interval`, applied
 * to EVERY sort mode, not just top. `all` (the default) applies no clause.
 * The corpus ends 2023-03-31, so anything but `all` legitimately returns zero
 * rows — that is the source's real behaviour, not a bug.
 */
export function applyTimeFilter(list, t, now = Date.now()) {
  if (!t || t === 'all' || !INTERVALS[t]) return list
  const cutoff = now - INTERVALS[t]
  return list.filter(s => {
    const ts = Date.parse(s.timestamp)
    return !isNaN(ts) && ts > cutoff
  })
}

/** Reads `next[field]=value` / `prev[field]=value` out of a URLSearchParams. */
export function readCursor(searchParams, prefix = 'next') {
  const cursor = {}
  let found = false
  for (const [k, v] of searchParams.entries()) {
    const m = k.match(/^(next|prev)\[(.+)\]$/)
    if (m && m[1] === prefix) { cursor[m[2]] = v; found = true }
  }
  return found ? cursor : null
}

export function hasAnyCursor(searchParams) {
  for (const k of searchParams.keys()) {
    if (/^(next|prev)\[.+\]$/.test(k)) return true
  }
  return false
}

/**
 * Cursor page. The cursor holds the sort key of the FIRST row of the requested
 * page, so the predicate is `(field, id) <= (cursorField, cursorId)` for a
 * descending sort and `>=` for the ascending one (controversial).
 *
 * An unrecognised or malformed cursor is accepted and ignored rather than 404ed
 * (ROUTES.md: "must accept and ignore an unrecognised next[...] param").
 */
export function paginate(sorted, sort, searchParams, perPage = PER_PAGE) {
  const spec = SORT_FIELDS[sort] || SORT_FIELDS.hot
  const cursor = readCursor(searchParams, 'next')
  let rows = sorted

  if (cursor) {
    const parsed = spec
      .map(({ field, dir }) => ({ field, dir, value: cursorValue(cursor[field], field) }))
      .filter(c => c.value !== null && c.value !== undefined)

    if (parsed.length) {
      rows = sorted.filter(s => {
        for (const { field, dir, value } of parsed) {
          const v = keyValue(s, field)
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
        acc[field] = field === 'lastActive' || field === 'timestamp'
          ? overflow[field]
          : String(overflow[field])
        return acc
      }, {})
    : null

  return { items, nextCursor, hasPrev: !!cursor }
}

/** Builds the `?next%5Bfield%5D=…` query string, preserving `t` and `sid`. */
export function buildCursorQuery(searchParams, cursor, prefix = 'next') {
  const out = new URLSearchParams()
  for (const [k, v] of searchParams.entries()) {
    if (/^(next|prev)\[.+\]$/.test(k)) continue
    out.append(k, v)
  }
  if (cursor) {
    for (const [field, value] of Object.entries(cursor)) {
      out.append(`${prefix}[${field}]`, value)
    }
  }
  return out.toString()
}
