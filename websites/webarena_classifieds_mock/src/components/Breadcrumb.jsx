import React from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { homeUrl } from '../utils/urls.js'

/**
 * `Classifieds > <Category> > <Item title>` with literal " > " text nodes and
 * schema.org BreadcrumbList microdata. The last crumb is a bare <span>.
 *
 * Props: crumbs — [{ label, to? }]; the first "Classifieds" crumb is added here.
 */
export default function Breadcrumb({ crumbs = [] }) {
  const { sid } = useApp()
  return (
    <ul className="breadcrumb" itemScope itemType="http://schema.org/BreadcrumbList">
      <meta itemProp="name" content="Breadcrumb" />
      <li itemScope itemProp="itemListElement" itemType="http://schema.org/ListItem" className="first-child">
        <Link to={homeUrl(sid)} itemProp="item"><span itemProp="name">Classifieds</span></Link>
        <meta itemProp="position" content="1" />
      </li>
      {crumbs.map((c, i) => (
        <li
          key={i}
          itemScope
          itemProp="itemListElement"
          itemType="http://schema.org/ListItem"
          className={i === crumbs.length - 1 ? 'last-child' : undefined}
        >
          {' > '}
          {c.to
            ? <Link to={c.to} itemProp="item"><span itemProp="name">{c.label}</span></Link>
            : <span itemProp="name">{c.label}</span>}
          <meta itemProp="position" content={String(i + 2)} />
        </li>
      ))}
    </ul>
  )
}
