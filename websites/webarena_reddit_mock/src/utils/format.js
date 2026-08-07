// Formatting helpers ported from the running Postmill instance.
//
// Sources:
//   assets/js/lib/intl.js                     — formatNumber
//   assets/js/controller/vote-controller.js   — scoreValueChanged
//   assets/js/controller/relative-time-controller.js
//     -> date-fns formatDistanceStrict(then, now, { addSuffix: true })
//   templates/_macros/time.html.twig          — datetime / title attributes

const MINUTES_IN_DAY = 1440
const MINUTES_IN_MONTH = 43200
const MINUTES_IN_TWO_MONTHS = 86400
const MINUTES_IN_YEAR = 525600

/**
 * Thousands-grouped number. Used for subscriber counts, submission counts and
 * anywhere the source calls Twig's `format_number` and JS does not overwrite it.
 */
export function formatNumber(n) {
  return new Intl.NumberFormat('en').format(n)
}

/**
 * Vote score, exactly as the agent sees it.
 *
 * The Twig template renders `entity.netScore|format_number` (grouped), but for a
 * logged-in user the form carries `data-controller="vote"` and Stimulus fires
 * `scoreValueChanged` on connect, which does `scoreTarget.innerText = score` —
 * i.e. an UNGROUPED integer. Verified against assets/html/f_books-auth.html
 * (`3591`) and assets/screenshots/reference/29-forum-books.png (`3591`), versus
 * the anonymous capture f_books.html (`3,591`). The mock is always logged in.
 *
 * Negative scores render U+2212 MINUS + the absolute value, followed by a
 * visually hidden second U+2212 (see vote-controller.js / vote.html.twig).
 */
export function formatScore(n) {
  const v = Number(n) || 0
  if (v >= 0) return String(v)
  return '−' + Math.abs(v)
}

export function isNegativeScore(n) {
  return (Number(n) || 0) < 0
}

/** Postmill's user timezone (currentUser.timezone). */
const TIME_ZONE = 'America/New_York'

/** `format_datetime('long','long')` — the `title` attribute. */
export function absoluteDateTime(iso, timeZone = TIME_ZONE) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  try {
    // en-US already joins with " at ": "March 9, 2023 at 7:39:36 PM EST"
    return new Intl.DateTimeFormat('en-US', {
      dateStyle: 'long', timeStyle: 'long', timeZone
    }).format(d)
  } catch (e) {
    return d.toISOString()
  }
}

/** `format_datetime('long','medium')`-ish — used where a date alone is shown. */
export function absoluteDate(iso, timeZone = TIME_ZONE) {
  const d = new Date(iso)
  if (isNaN(d)) return ''
  try {
    return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone }).format(d)
  } catch (e) {
    return d.toISOString().slice(0, 10)
  }
}

function plural(n, unit) {
  return `${n} ${unit}${n === 1 ? '' : 's'}`
}

/**
 * date-fns `formatDistanceStrict(then, now, { addSuffix: true })`, en locale.
 * Single unit, rounded. Produces "3 years ago", "26 days ago", "1 minute ago".
 */
export function relativeTime(iso, now = new Date()) {
  const then = new Date(iso)
  if (isNaN(then)) return ''
  const ms = Math.abs(now.getTime() - then.getTime())
  const past = then.getTime() <= now.getTime()
  const seconds = ms / 1000
  const minutes = ms / 60000

  let value, unit
  if (minutes < 1) { value = Math.round(seconds); unit = 'second' }
  else if (minutes < 60) { value = Math.round(minutes); unit = 'minute' }
  else if (minutes < MINUTES_IN_DAY) { value = Math.round(minutes / 60); unit = 'hour' }
  else if (minutes < MINUTES_IN_MONTH) { value = Math.round(minutes / MINUTES_IN_DAY); unit = 'day' }
  else if (minutes < MINUTES_IN_TWO_MONTHS) { value = Math.round(minutes / MINUTES_IN_MONTH); unit = 'month' }
  else if (minutes < MINUTES_IN_YEAR) { value = Math.round(minutes / MINUTES_IN_MONTH); unit = 'month' }
  else { value = Math.round(minutes / MINUTES_IN_YEAR); unit = 'year' }

  const distance = plural(value, unit)
  return past ? `${distance} ago` : `in ${distance}`
}

/**
 * `submission.comments: '{0} No comments|{1} %count% comment|[1,Inf[ %count% comments'`
 */
export function commentCountLabel(count) {
  if (!count) return 'No comments'
  if (count === 1) return '1 comment'
  return `${count} comments`
}

/**
 * `forum.submission_count: '{0} No submissions|{1} %formatted_count% submission|…'`
 */
export function submissionCountLabel(count) {
  if (!count) return 'No submissions'
  if (count === 1) return `${formatNumber(count)} submission`
  return `${formatNumber(count)} submissions`
}

/**
 * `forum.subscriber_count: '{0} No subscribers|{1} %formatted_count% subscriber|…'`
 */
export function subscriberCountLabel(count) {
  if (!count) return 'No subscribers'
  if (count === 1) return `${formatNumber(count)} subscriber`
  return `${formatNumber(count)} subscribers`
}

/**
 * The host shown after a submission title. Postmill strips nothing from the
 * href it links to (`/search?q=www.wboc.com`) but displays the registrable
 * host with a leading `www.` removed — confirmed in assets/html/f_news-auth.html
 * (`href="/search?q=www.wboc.com"` / text `wboc.com`).
 */
export function linkHost(url) {
  try {
    return new URL(url).host
  } catch (e) {
    return ''
  }
}

export function displayHost(url) {
  const h = linkHost(url)
  return h.replace(/^www\./, '')
}
