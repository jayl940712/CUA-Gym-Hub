import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { withSid, withQuery } from '../../utils/navigation.js'

/**
 * <Link> that always carries `?sid=` forward. Use this everywhere instead of
 * react-router's <Link> or a bare <a href>.
 *
 * `keepQuery` preserves the whole query string (grid state) rather than sid only.
 */
export default function AdminLink({ to, keepQuery = false, children, ...rest }) {
  const location = useLocation()
  const target = keepQuery ? withQuery(to, location.search) : withSid(to, location.search)
  return <Link to={target} {...rest}>{children}</Link>
}
