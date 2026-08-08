// Date / string formatting. GitLab 15.7 uses FOUR different date formats on
// different pages and several of them are literal evaluator anchors
// (assets/README.md §0.3, TODO.md P1-F). Do not unify them.
//
//   MMM D, YYYY        Dec 31, 2030      issue due dates, milestone dates
//   D MMM, YYYY        19 Mar, 2023      commit-list date group headers  (§11)
//   MMMM D, YYYY       March 23, 2023    profile "Member since"          (§7)
//   MMM D, YYYY h:mma  Mar 27, 2023 4:22pm PDT   <time title="…"> tooltip

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
  'August', 'September', 'October', 'November', 'December']

/**
 * Parse a seed timestamp. Postgres dumps arrive as "2023-03-27 20:37:47.216479"
 * (UTC, space separated); git dumps arrive as ISO with an offset. A bare
 * space-separated string would be read as *local* time by V8, so normalise.
 */
export function parseDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  let s = String(value)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date(`${s}T00:00:00Z`)
  if (s.includes(' ') && !s.includes('T')) s = s.replace(' ', 'T')
  if (!/[Zz]$|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z'
  const d = new Date(s)
  return isNaN(d.getTime()) ? null : d
}

/** A date-only value ("2030-12-31") rendered without any timezone shift. */
function ymdParts(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(value || ''))
  if (m) return { y: +m[1], mo: +m[2] - 1, d: +m[3] }
  const dt = parseDate(value)
  if (!dt) return null
  return { y: dt.getUTCFullYear(), mo: dt.getUTCMonth(), d: dt.getUTCDate() }
}

/** `Dec 31, 2030` — issue due dates, milestone dates. ANCHOR format. */
export function formatDate(value) {
  const p = ymdParts(value)
  if (!p) return ''
  return `${MONTHS_SHORT[p.mo]} ${p.d}, ${p.y}`
}

/** `19 Mar, 2023` — commit-list date group headers (assets/README.md §11). */
export function formatCommitDate(value) {
  const p = ymdParts(value)
  if (!p) return ''
  return `${p.d} ${MONTHS_SHORT[p.mo]}, ${p.y}`
}

/** `March 23, 2023` — profile "Member since" only (assets/README.md §7). */
export function formatLongDate(value) {
  const p = ymdParts(value)
  if (!p) return ''
  return `${MONTHS_LONG[p.mo]} ${p.d}, ${p.y}`
}

/**
 * `Jan 16, 2030–Jan 30, 2030` — milestone range. EN DASH, NO surrounding
 * spaces (assets/README.md §16b). Anchored.
 */
export function formatDateRange(start, due) {
  if (start && due) return `${formatDate(start)}–${formatDate(due)}`
  if (due) return formatDate(due)
  if (start) return formatDate(start)
  return ''
}

/** `Mar 27, 2023 4:22pm PDT` — the `title` on every <time> element. */
export function formatTimeTooltip(value) {
  const d = parseDate(value)
  if (!d) return ''
  // The source instance renders America/Los_Angeles; PDT Mar–Nov, PST otherwise.
  const mo = d.getUTCMonth()
  const isDst = mo >= 2 && mo <= 10
  const offset = isDst ? -7 : -8
  const tz = isDst ? 'PDT' : 'PST'
  const local = new Date(d.getTime() + offset * 3600 * 1000)
  let h = local.getUTCHours()
  const ampm = h >= 12 ? 'pm' : 'am'
  h = h % 12
  if (h === 0) h = 12
  const mins = String(local.getUTCMinutes()).padStart(2, '0')
  return `${MONTHS_SHORT[local.getUTCMonth()]} ${local.getUTCDate()}, ${local.getUTCFullYear()} ${h}:${mins}${ampm} ${tz}`
}

/** ISO-8601 Zulu for the `datetime` attribute. */
export function isoDateTime(value) {
  const d = parseDate(value)
  return d ? d.toISOString().replace(/\.\d{3}Z$/, 'Z') : ''
}

/**
 * `3 years ago` — computed live, never frozen (the container clock is 2026 and
 * the seed is 2023, so the strings drift with real time by design).
 */
export function timeAgo(value, now = Date.now()) {
  const d = parseDate(value)
  if (!d) return ''
  const secs = Math.floor((now - d.getTime()) / 1000)
  if (secs < 0) return 'just now'
  if (secs < 45) return 'just now'
  const units = [
    ['minute', 60], ['hour', 3600], ['day', 86400], ['week', 604800],
    ['month', 2629746], ['year', 31556952],
  ]
  let label = 'minute'
  let size = 60
  for (const [u, s] of units) { if (secs >= s) { label = u; size = s } }
  const n = Math.floor(secs / size)
  return `${n} ${label}${n === 1 ? '' : 's'} ago`
}

/**
 * GitLab's project/group path derivation.
 *
 * Measured on the live source by typing into `#project_name` and reading
 * `#project_path` back:
 *
 *   'Do it myself'      -> 'Do-it-myself'
 *   'nolan_honest_fans' -> 'nolan_honest_fans'   <- `_` and `.` SURVIVE
 *   'gimmiethat.space'  -> 'gimmiethat.space'
 *
 * i.e. `trim().replace(/[^a-zA-Z0-9_.-]+/g, '-')`, edges stripped.
 *
 * Two things this must NOT do:
 *   - collapse `_` or `.` to `-`. It used to, which would have rewritten every
 *     underscore-named anchor route (`nolan_honest_fans`, `web_agent_android_xl`,
 *     `11711_gitlab`, `coding_friends`, …). The function had no callers at the
 *     time, so the trap was latent rather than live — fixed here so it stays that
 *     way if someone wires it up.
 *   - lower-case. The anchor routes are mixed case
 *     (`/byteblaze/Do-it-myself/-/raw/main/README.md`, webarena-566;
 *     `/byteblaze/AGISite`, 751; `/byteblaze/Awesome_DIY_ideas`, 562) and the
 *     mock resolves paths case-sensitively.
 *
 * `deriveSlug()` in src/components/create/mutations.js implements the same rule
 * and is what the create flows actually call; the two should be collapsed into
 * this one when a round owns both files.
 */
export function slugify(name) {
  const slug = String(name || '')
    .trim()
    .replace(/[^a-zA-Z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return slug === '-' ? '' : slug
}

/** Access level -> role label (assets/data_model.md §9). Exact wording. */
export const ACCESS_LEVELS = [
  { level: 5, label: 'Minimal Access' },
  { level: 10, label: 'Guest' },
  { level: 20, label: 'Reporter' },
  { level: 30, label: 'Developer' },
  { level: 40, label: 'Maintainer' },
  { level: 50, label: 'Owner' },
]

export function accessLabel(level) {
  const found = ACCESS_LEVELS.find(a => a.level === Number(level))
  return found ? found.label : ''
}

/** `.visibility-icon` title strings — ANCHOR, tasks 742–756. Verbatim. */
export const VISIBILITY_TITLES = {
  private: 'Private - Project access must be granted explicitly to each user. If this project is part of a group, access is granted to members of the group.',
  internal: 'Internal - The project can be accessed by any logged in user except external users.',
  public: 'Public - The project can be accessed without any authentication.',
}

/** Identicon background bucket (assets/README.md §0.4) — bg1..bg7 by id. */
export function identiconBg(id) {
  const n = Math.abs(Number(id) || 0)
  return `bg${(n % 7) + 1}`
}

export function initialOf(name) {
  const s = String(name || '').trim()
  return s ? s[0].toUpperCase() : '?'
}

/** Short SHA as GitLab renders it — first 8 characters (data_model §11). */
export function shortSha(sha) {
  return String(sha || '').slice(0, 8)
}

export function numberWithDelimiter(n) {
  return String(n == null ? '' : n).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}
