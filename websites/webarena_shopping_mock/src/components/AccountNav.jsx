import React from 'react'
import { useLocation } from 'react-router-dom'
import { SLink } from '../utils/url.js'

// Exact order and grouping from the source (assets/README.md §8).
const GROUPS = [
  [
    { label: 'My Account', to: '/customer/account/' },
    { label: 'My Orders', to: '/sales/order/history/', match: ['/sales/order/'] },
    { label: 'My Downloadable Products', to: '/downloadable/customer/products/' },
    { label: 'My Wish List', to: '/wishlist/' },
  ],
  [
    { label: 'Address Book', to: '/customer/address/' },
    { label: 'Account Information', to: '/customer/account/edit/' },
    { label: 'Stored Payment Methods', to: '/vault/cards/listaction/' },
  ],
  [
    { label: 'My Product Reviews', to: '/review/customer/' },
    { label: 'Newsletter Subscriptions', to: '/newsletter/manage/' },
  ],
]

export default function AccountNav() {
  const { pathname } = useLocation()
  const norm = p => p.replace(/\/+$/, '') || '/'

  const isCurrent = (item) => {
    const here = norm(pathname)
    if (here === norm(item.to)) return true
    if (item.match) return item.match.some(m => here.startsWith(norm(m)))
    // /customer/account/edit/ must not light up "My Account"
    if (item.to === '/customer/account/') return here === '/customer/account'
    if (item.to === '/customer/address/') return here.startsWith('/customer/address')
    if (item.to === '/customer/account/edit/') return here.startsWith('/customer/account/edit')
    if (item.to === '/review/customer/') return here.startsWith('/review/customer')
    return false
  }

  return (
    <div className="block block-collapsible-nav">
      <div className="content">
        <ul className="nav items">
          {GROUPS.map((group, gi) => (
            <React.Fragment key={gi}>
              {gi > 0 && <li className="delimiter" />}
              {group.map(item => (
                <li className={`nav item${isCurrent(item) ? ' current' : ''}`} key={item.to}>
                  {isCurrent(item)
                    ? <strong>{item.label}</strong>
                    : <SLink to={item.to}>{item.label}</SLink>}
                </li>
              ))}
            </React.Fragment>
          ))}
        </ul>
      </div>
    </div>
  )
}
