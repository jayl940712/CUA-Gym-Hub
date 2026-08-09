/**
 * The frozen Postmill corpus — imported, never copied into app state.
 *
 * 8,012 submissions + 24,149 comments + 21,038 userDirectory entries is 14.6 MB
 * of JSON. Putting it in `createInitialData()` made the app state 14.67 MB, so
 * every mutation POSTed 14.67 MB, `/go` returned 28–40 MB, and localStorage
 * (5 MB/origin in Chrome) could hold nothing at all. Agents cannot create a
 * seeded submission or comment, so these records are read-only base data, not
 * state — the same split `webarena_shopping_mock` makes between its 37 mutable
 * `orders` and its 22,721 frozen products.
 *
 * Mutations to these records live in the overlay (`src/utils/overlay.js`) and
 * are resolved on read. Import this module ONLY from `overlay.js` so that
 * `dataManager.js` — and therefore `vite.config.js`, which calls
 * `createInitialData()` on every `/go` — stays free of the 14.6 MB payload.
 */
import submissions from './submissions.json'
import comments from './comments.json'
import userDirectory from './userDirectory.json'

export const FROZEN_SUBMISSIONS = submissions
export const FROZEN_COMMENTS = comments
export const FROZEN_USER_DIRECTORY = userDirectory
