import React, { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext.jsx'
import { SLink } from '../utils/url.js'
import { storeConfig } from '../utils/catalog.js'
import { MailIcon } from './Icons.jsx'

const FOOTER_LINKS = (storeConfig.footerLinks || []).map(l => ({ label: l.label, to: l.href }))

export default function Footer() {
  const { pathname } = useLocation()
  const { state, setNewsletter, addMessage } = useApp()
  const [email, setEmail] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (!email.trim()) return
    setNewsletter(true)
    setEmail('')
    addMessage('Thank you for your subscription.')
  }

  return (
    <footer className="page-footer">
      <div className="footer content">
        <ul className="footer links">
          {FOOTER_LINKS.map(l => {
            const current = pathname.replace(/\/$/, '') === l.to.replace(/\/$/, '')
            return (
              <li key={l.to} className={current ? 'nav item current' : 'nav item'}>
                {current ? <strong>{l.label}</strong> : <SLink to={l.to}>{l.label}</SLink>}
              </li>
            )
          })}
        </ul>
        <div className="block newsletter">
          <form className="form subscribe" onSubmit={submit}>
            <div className="field newsletter">
              <label className="label visually-hidden" htmlFor="newsletter"><span>Sign Up for Our Newsletter:</span></label>
              <span style={{ position: 'absolute', left: 8, top: 7, color: '#757575' }}><MailIcon size={16} /></span>
              <input
                id="newsletter"
                type="email"
                name="email"
                value={email}
                placeholder="Enter your email address"
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <button className="action subscribe primary" type="submit" title="Subscribe">
              <span>Subscribe</span>
            </button>
          </form>
          {state.newsletterSubscribed && <span className="visually-hidden">subscribed</span>}
        </div>
      </div>
      <div className="copyright-wrapper">
        <small className="copyright"><span>{storeConfig.copyright}</span></small>
        <div className="footer-note">
          {storeConfig.footerNote}{' '}
          {/* The source links out to Magento's bug tracker. The mock is fully
              offline, so the link renders but does not navigate. */}
          <a href={storeConfig.footerNoteLink.href} onClick={e => e.preventDefault()}>
            {storeConfig.footerNoteLink.label}
          </a>
        </div>
      </div>
    </footer>
  )
}
