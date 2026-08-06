import { formatDateTime } from '../../utils/formatters.js'

/**
 * DIFF-R68 — the review grids' date width.
 *
 * Magento renders most admin grids with `IntlDateFormatter::MEDIUM` +
 * `SHORT` time joined by a space (`May 31, 2023 2:55:09 AM` on
 * `/admin/sales/order/`), which is what `utils/formatters.js formatDateTime`
 * produces. The review surfaces use the locale's *full* datetime pattern
 * instead, which carries a comma between the date and the time:
 *
 *   source /admin/review/product/pending/          `Apr 24, 2023, 2:55:10 PM`
 *   source /admin/reports/report_review/product/   `Apr 19, 2023, 12:15:17 PM`
 *   source /admin/reports/report_statistics/       `Aug 6, 2026, 12:00:01 AM`
 *
 * `formatDateTime` must NOT change app-wide — the order and customer grids
 * would then print a comma the source does not have — so the review grids reuse
 * it and re-insert the separator. Everything that renders a review timestamp
 * goes through here.
 */
export function formatReviewDateTime(value) {
  const base = formatDateTime(value)
  if (!base) return base
  return base.replace(/^(\w{3} \d{1,2}, \d{4}) /, '$1, ')
}

export default formatReviewDateTime
