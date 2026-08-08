/**
 * Deep, path-keyed diff between the initial and current session state.
 * Used by /go (the React page) and mirrored, shallowly, by the vite middleware.
 */
export function computeStateDiff(initial, current) {
  if (!initial || !current) return {}
  const diff = {}

  function compareValues(path, a, b) {
    if (typeof a !== typeof b) {
      diff[path] = { old: a, new: b }
      return
    }
    if (Array.isArray(a) && Array.isArray(b)) {
      if (JSON.stringify(a) !== JSON.stringify(b)) {
        diff[path] = { old: a, new: b }
      }
      return
    }
    if (a && b && typeof a === 'object') {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)])
      keys.forEach(k => compareValues(`${path}.${k}`, a[k], b[k]))
      return
    }
    if (a !== b) {
      diff[path] = { old: a, new: b }
    }
  }

  const keys = new Set([...Object.keys(initial), ...Object.keys(current)])
  keys.forEach(k => compareValues(k, initial[k], current[k]))

  return diff
}

/**
 * The Observable State Changes table in SCHEMA.md, as data. Every mutating
 * action in the app must map to one of these keys so /go sees it.
 */
export const OBSERVABLE_ACTIONS = {
  item_add_post: ['newItems', 'nextItemId'],
  item_edit_post: ['itemOverrides'],
  item_delete: ['deletedItemIds'],
  add_comment: ['comments', 'nextCommentId'],
  delete_comment: ['comments'],
  profile_post: ['user'],
  change_email: ['user'],
  change_username: ['user'],
  // change_password writes no secret — it bumps user.passwordChanges and stamps
  // user.passwordChangedAt, so the action is observable. See ChangePassword.jsx.
  change_password: ['user'],
  subscribe_alert: ['alerts'],
  unsubscribe_alert: ['alerts'],
  mark: ['marks'],
  send_friend_post: ['sendFriendMessages'],
  contact_post: ['contactMessages']
}
