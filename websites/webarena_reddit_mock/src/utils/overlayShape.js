/**
 * The overlay's key list and empty value — deliberately import-free.
 *
 * `dataManager.js` needs the shape for `createInitialData()`, and
 * `vite.config.js` imports `createInitialData()` to baseline `/go`. Keeping
 * this module free of `src/data/frozen.js` is what stops the vite config (and
 * every `/go` request) from pulling in the 14.6 MB corpus.
 */

/** Keys that describe mutations against the frozen corpus. */
export const OVERLAY_KEYS = [
  'newSubmissions', 'submissionEdits', 'deletedSubmissions',
  'newComments', 'commentEdits', 'deletedComments',
  'deletedForums', 'forumRenames', 'userRenames'
]

export function emptyOverlay() {
  return {
    /** Submissions the agent created — full records. */
    newSubmissions: [],
    /** `{ [submissionId]: fullRecord }` — a frozen record's replacement. */
    submissionEdits: {},
    /** Ids of frozen submissions the agent deleted. */
    deletedSubmissions: [],
    newComments: [],
    commentEdits: {},
    deletedComments: [],
    /** Forum names deleted via `/f/<name>/delete` — takes their content with them. */
    deletedForums: [],
    /** Ordered `{ from, to }` forum renames, applied to `submission.forum`. */
    forumRenames: [],
    /** Ordered `{ from, to }` user renames, applied to `author` and userDirectory. */
    userRenames: []
  }
}
