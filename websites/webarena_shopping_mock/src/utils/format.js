// Magento renders every stored UTC timestamp in the store timezone.
// general/locale/timezone = America/New_York — this is load-bearing:
// order 170 stores "2023-05-18 03:39:44" and the grid prints "5/17/23".
export const STORE_TZ = 'America/New_York'

export function money(value) {
  const n = Number(value || 0)
  const sign = n < 0 ? '-' : ''
  return `${sign}$${Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

// Seed timestamps are "YYYY-MM-DD HH:MM:SS" in UTC.
function toDate(stamp) {
  if (!stamp) return null
  if (stamp instanceof Date) return stamp
  const s = String(stamp).trim()
  const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z'
  const d = new Date(iso)
  return isNaN(d.getTime()) ? null : d
}

function parts(stamp) {
  const d = toDate(stamp)
  if (!d) return null
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TZ,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  })
  const out = {}
  for (const p of fmt.formatToParts(d)) out[p.type] = p.value
  return out
}

// Magento "short" date format used in every grid: M/D/YY
export function shortDate(stamp) {
  const p = parts(stamp)
  if (!p) return ''
  return `${Number(p.month)}/${Number(p.day)}/${String(p.year).slice(-2)}`
}

// Magento "long"/medium date used on the order view: "March 11, 2023"
export function longDate(stamp) {
  const d = toDate(stamp)
  if (!d) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TZ,
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(d)
}

// Sortable key in the store timezone (YYYYMMDD as a number).
export function storeDayKey(stamp) {
  const p = parts(stamp)
  if (!p) return 0
  return Number(p.year) * 10000 + Number(p.month) * 100 + Number(p.day)
}

export function statusLabel(status) {
  if (!status) return ''
  return status.charAt(0).toUpperCase() + status.slice(1)
}
