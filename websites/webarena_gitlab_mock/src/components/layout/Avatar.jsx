import React from 'react'
import { identiconBg, initialOf } from '../../utils/format.js'

// assets/README.md §0.4 — two avatar families. The mock is offline, so the
// gravatar <img> is replaced by a deterministic local identicon; the class
// names and size classes are kept because the captured DOM uses them.

const USER_COLORS = ['#f0f0f7', '#eef6f5', '#f6f0f5', '#f5f3ee', '#ecf4ee', '#eef2f8', '#ececef']

// The source renders avatars as <img>. Here they are letter tiles, and the
// letter is painted by a CSS ::before (`.avatar-initial[data-initial]`) rather
// than as a text node — outerText ignores pseudo-elements, so the letter never
// leaks into anchored reads like `.block.assignee` or the members table.

/** Circular user avatar. */
export function UserAvatar({ user, size = 24, className = '', alt }) {
  const name = (user && (user.name || user.username)) || ''
  const id = (user && user.id) || 0
  const bg = USER_COLORS[Math.abs(id) % USER_COLORS.length]
  return (
    <span
      className={`gl-avatar gl-avatar-s${size} gl-avatar-circle avatar avatar-circle avatar-initial s${size} ${className}`.trim()}
      style={{ background: bg }}
      title={name}
      role="img"
      aria-label={alt || name}
      data-initial={initialOf(name)}
      data-username={user && user.username}
    />
  )
}

/** Square identicon tile used for projects and groups. */
export function EntityAvatar({ entity, size = 32, kind = 'project', className = '' }) {
  const name = (entity && (entity.name || entity.path)) || ''
  const bg = identiconBg(entity && entity.id)
  return (
    <span className={`avatar-container rect-avatar s${size} ${kind}_avatar ${className}`.trim()}>
      <span className={`avatar avatar-tile avatar-initial s${size} identicon ${bg}`}
        role="img" aria-label={name} title={name} data-initial={initialOf(name)} />
    </span>
  )
}

export default UserAvatar
