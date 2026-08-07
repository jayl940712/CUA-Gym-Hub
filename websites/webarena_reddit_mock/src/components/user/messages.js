// Private-message helpers.
//
// The seed carries `messages: []` — TODO.md gap 8 records that the
// `messages` / `message_threads` tables were never sampled, so nothing here
// invents inbox content. These helpers exist so that composing a message (a
// real user action) and any injected task state both produce well-formed
// threads.
//
// Shape, mirroring src/Entity/MessageThread.php + Message.php:
//
//   { id: '<uuid>',
//     participants: ['MarvelsGrantMan136', 'other'],
//     messages: [ { id: '<uuid>', sender, body, timestamp } ] }

/**
 * `MessageThread::getTitle()` — the first line of the first message with a
 * leading `# ` stripped, truncated to 100 characters + `…`. There is no stored
 * title column; the source derives it exactly like this.
 */
export function threadTitle(thread) {
  if (!thread || !thread.messages || !thread.messages.length) return ''
  const body = thread.messages[0].body || ''
  const firstLine = body.replace(/^# /, '').split(/\r\n|\r|\n/)[0]
  return firstLine.length <= 100 ? firstLine : `${firstLine.slice(0, 100)}…`
}

/** Postmill message/thread ids are UUIDs; the route regex expects that shape. */
export function newUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
    const r = (Math.random() * 16) | 0
    const v = ch === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/** The other participants of a thread, i.e. everyone but the given user. */
export function otherParticipants(thread, username) {
  return (thread.participants || []).filter(p => p !== username)
}

export function lastMessage(thread) {
  return thread.messages && thread.messages.length
    ? thread.messages[thread.messages.length - 1]
    : null
}
