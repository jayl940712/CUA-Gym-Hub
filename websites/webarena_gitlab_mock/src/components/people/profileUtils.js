// Profile helpers shared by UserProfile, ProfileSettings and the navbar's
// Set-status modal. assets/README.md §7.5 / §7.6.

/**
 * §7.5 — emoji reference data from `public/-/emojis/2/emojis.json`.
 * `speech_balloon` is `UserStatus::DEFAULT_EMOJI` and is what the modal submits
 * when the user types a message without picking an emoji.
 */
export const STATUS_EMOJI = {
  speech_balloon: { name: 'speech_balloon', char: '💬', version: '6.0', title: 'speech balloon' },
  palm_tree: { name: 'palm_tree', char: '🌴', version: '6.0', title: 'palm tree' },
  badminton: { name: 'badminton', char: '🏸', version: '8.0', title: 'badminton racquet' },
  sleeping: { name: 'sleeping', char: '😴', version: '6.1', title: 'sleeping face' },
  house: { name: 'house', char: '🏠', version: '6.0', title: 'house building' },
  airplane: { name: 'airplane', char: '✈', version: '1.1', title: 'airplane' },
  coffee: { name: 'coffee', char: '☕', version: '4.0', title: 'hot beverage' },
  bulb: { name: 'bulb', char: '💡', version: '6.0', title: 'electric light bulb' },
}

export const STATUS_EMOJI_PICKER = [
  'speech_balloon', 'palm_tree', 'badminton', 'sleeping', 'house', 'airplane', 'coffee', 'bulb',
]

/**
 * §7.6 / `User#short_website_url` — the LINK TEXT is the stored value with the
 * scheme stripped. A `www.` prefix is kept; only `http://` / `https://` goes.
 * This is what the ANCHOR reads (tasks 448–452), so it must not "normalise"
 * anything else.
 */
export function shortWebsiteUrl(value) {
  return String(value || '').replace(/^https?:\/\//, '')
}

/** `User#full_website_url` — the href gets `http://` when no scheme is stored. */
export function fullWebsiteUrl(value) {
  const s = String(value || '')
  return /^https?:\/\//.test(s) ? s : `http://${s}`
}

/** §22a — the eight `Clear status after` options, verbatim, in source order. */
export const CLEAR_STATUS_OPTIONS = [
  { testid: 'never', label: 'Never' },
  { testid: 'thirtyMinutes', label: '30 minutes' },
  { testid: 'threeHours', label: '3 hours' },
  { testid: 'eightHours', label: '8 hours' },
  { testid: 'oneDay', label: '1 day' },
  { testid: 'threeDays', label: '3 days' },
  { testid: 'oneWeek', label: '7 days' },
  { testid: 'oneMonth', label: '30 days' },
]
