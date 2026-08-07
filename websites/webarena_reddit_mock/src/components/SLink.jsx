import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { withSid } from '../utils/nav.js'

/** <Link> that always carries the active ?sid=. */
export default function SLink({ to, children, ...rest }) {
  return <Link to={withSid(to)} {...rest}>{children}</Link>
}

/** navigate() that always carries the active ?sid=. */
export function useSidNavigate() {
  const navigate = useNavigate()
  return React.useCallback((to, opts) => {
    if (typeof to === 'number') return navigate(to)
    return navigate(withSid(to), opts)
  }, [navigate])
}
