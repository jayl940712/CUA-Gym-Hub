import React from 'react'

/* The source theme uses the `icons-blank-theme` icon font. These inline SVGs
 * stand in for the glyphs it actually uses: cart, magnifier, chevrons, heart,
 * compare, refresh and the grid/list mode toggles. */

const svg = (props, children, size = 16) => (
  <svg
    width={props.size || size}
    height={props.size || size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    focusable="false"
    {...props}
  >
    {children}
  </svg>
)

export const CartIcon = (p) => svg({ ...p, size: p.size || 26 }, (
  <>
    <circle cx="9" cy="21" r="1" />
    <circle cx="20" cy="21" r="1" />
    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
  </>
))

export const SearchIcon = (p) => svg(p, (
  <>
    <circle cx="11" cy="11" r="7" />
    <path d="M21 21l-4.35-4.35" />
  </>
))

export const HeartIcon = (p) => svg(p, (
  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
))

export const CompareIcon = (p) => svg(p, (
  <>
    <path d="M4 20V10" />
    <path d="M12 20V4" />
    <path d="M20 20v-6" />
  </>
))

export const RefreshIcon = (p) => svg(p, (
  <>
    <path d="M23 4v6h-6" />
    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
  </>
))

export const ChevronLeft = (p) => svg(p, <path d="M15 18l-6-6 6-6" />)
export const ChevronRight = (p) => svg(p, <path d="M9 18l6-6-6-6" />)
export const ChevronDown = (p) => svg(p, <path d="M6 9l6 6 6-6" />)
export const ArrowUp = (p) => svg(p, <path d="M12 19V5M5 12l7-7 7 7" />)
export const ArrowDown = (p) => svg(p, <path d="M12 5v14M19 12l-7 7-7-7" />)

export const GridIcon = (p) => svg({ ...p, strokeWidth: 1.6 }, (
  <>
    <rect x="3" y="3" width="6" height="6" />
    <rect x="15" y="3" width="6" height="6" />
    <rect x="3" y="15" width="6" height="6" />
    <rect x="15" y="15" width="6" height="6" />
  </>
), 18)

export const ListIcon = (p) => svg({ ...p, strokeWidth: 1.6 }, (
  <>
    <path d="M8 6h13M8 12h13M8 18h13" />
    <path d="M3 6h.01M3 12h.01M3 18h.01" />
  </>
), 18)

export const MailIcon = (p) => svg(p, (
  <>
    <rect x="2" y="4" width="20" height="16" rx="1" />
    <path d="M22 6l-10 7L2 6" />
  </>
))
