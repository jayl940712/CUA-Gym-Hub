/**
 * Display formatting, all derived from the source's own `oc_t_locale` row
 * (see src/data/locale.json) — not from an intuition about US formatting.
 *
 *   currency_format = "{NUMBER} {CURRENCY}"   -> symbol TRAILS, space separated
 *   num_dec         = 2                       -> always 2 decimals
 *   dec_point       = "."
 *   thousands_sep   = ""                      -> NO thousands separator
 */
import regions from '../data/regions.json'
import categories from '../data/categories.json'

export const CURRENCY_SYMBOL = '$'

/** Item prices are stored as dollars x 1,000,000. `2899500000000` -> "28995.00 $" */
export function formatPrice(rawPrice) {
  if (rawPrice === null || rawPrice === undefined || rawPrice === '') return ''
  const n = Number(rawPrice) / 1e6
  if (!Number.isFinite(n)) return ''
  return `${n.toFixed(2)} ${CURRENCY_SYMBOL}`
}

/** "2023-11-01 12:31:44" -> "2023/11/01" */
export function formatDate(pub) {
  if (!pub) return ''
  const datePart = String(pub).split(' ')[0].split('T')[0]
  return datePart.replace(/-/g, '/')
}

const regionByIdx = regions
const regionById = new Map(regions.map(r => [r.id, r]))

export function regionOf(item) {
  if (!item) return null
  if (item.regionId !== undefined && item.regionId !== null && item.regionId !== '') {
    return regionById.get(Number(item.regionId)) || null
  }
  if (item.regionIdx === undefined || item.regionIdx === null) return null
  return regionByIdx[item.regionIdx] || null
}

export function regionNameOf(item) {
  const r = regionOf(item)
  return r ? r.name : ''
}

/**
 * Listing-card location: "Brimfield  (Ohio)".
 * The DOUBLE space before the parenthesis is what the source emits — evaluators
 * string-match it, so it is deliberate.
 */
export function formatCardLocation(item) {
  const city = item && item.city ? item.city : ''
  const region = regionNameOf(item)
  if (city && region) return `${city}  (${region})`
  if (city) return city
  if (region) return region
  return ''
}

/** Item-page location: "City of Akron, Ohio, United States". */
export function formatItemLocation(item) {
  const parts = []
  if (item && item.city) parts.push(item.city)
  const region = regionNameOf(item)
  if (region) parts.push(region)
  parts.push('United States')
  return parts.join(', ')
}

const categoryById = new Map(categories.map(c => [c.id, c]))

export function categoryName(catId) {
  const c = categoryById.get(Number(catId))
  return c ? c.name : ''
}

export function categoryBySlug(slug) {
  return categories.find(c => c.slug === slug) || null
}

export { categories, regions }

/** Listing thumbnail (240x200). Every one of the 84,149 items has one. */
export function thumbUrl(id) {
  return `/img/t/${Math.floor(Number(id) / 1000)}/${Number(id)}.webp`
}

/** Item-detail photo (640x480); only ~1,530 exist, callers fall back to thumbUrl. */
export function photoUrl(id) {
  return `/img/m/${Math.floor(Number(id) / 1000)}/${Number(id)}.webp`
}

export const NO_PHOTO = '/img/no_photo.gif'
