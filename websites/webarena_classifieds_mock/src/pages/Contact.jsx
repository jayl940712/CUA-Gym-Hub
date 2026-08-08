import React, { useState } from 'react'
import Layout from '../components/Layout.jsx'
import Breadcrumb from '../components/Breadcrumb.jsx'
import Flash from '../components/user/Flash.jsx'
import { useApp } from '../context/AppContext.jsx'

/**
 * ROUTES #16 — `index.php?page=contact`.
 *
 * Unlike the per-item seller form, THIS one is enabled on the deployment
 * (`web_contact_form_disabled = 0`). `contact_post` mails the admin and flashes
 * `Your email has been sent properly. Thank you for contacting us!`; the mock
 * appends the message to `state.contactMessages` instead.
 *
 * Name and e-mail are pre-filled with the logged-in user's, exactly as the
 * source does for a logged-in visitor (assets/html/contact.html).
 */
export default function Contact() {
  const { setState, user } = useApp()
  const [form, setForm] = useState({
    yourName: user.name || '',
    yourEmail: user.email || '',
    subject: '',
    message: ''
  })
  const [errors, setErrors] = useState([])
  const [flash, setFlash] = useState(null)

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })) }

  function onSubmit(e) {
    e.preventDefault()
    const errs = []
    if (!form.yourEmail.trim()) errs.push('Email: this field is required.')
    else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.yourEmail.trim())) errs.push('Invalid email address.')
    if (!form.message.trim()) errs.push('Message: this field is required.')
    setErrors(errs)
    if (errs.length) return

    setState(prev => ({
      ...prev,
      contactMessages: [...(prev.contactMessages || []), {
        name: form.yourName,
        email: form.yourEmail,
        subject: form.subject,
        message: form.message,
        date: new Date().toISOString().slice(0, 19).replace('T', ' ')
      }]
    }))
    setForm(prev => ({ ...prev, subject: '', message: '' }))
    setFlash('Your email has been sent properly. Thank you for contacting us!')
  }

  return (
    <Layout
      bodyClass="contact"
      title="Contact - Classifieds"
      breadcrumb={<Breadcrumb crumbs={[{ label: 'Contact' }]} />}
    >
      <Flash message={flash} />
      <div id="main">
        <div className="form-container form-horizontal form-container-box">
          <div className="header">
            <h1>Contact us</h1>
          </div>
          <div className="resp-wrapper">
            <ul id="error_list">
              {errors.map((m, i) => <li key={i}><label className="error">{m}</label></li>)}
            </ul>
            <form name="contact_form" action="/index.php" method="post" onSubmit={onSubmit}>
              <input type="hidden" name="page" value="contact" />
              <input type="hidden" name="action" value="contact_post" />

              <div className="control-group">
                <label className="control-label" htmlFor="yourName">Your name (optional)</label>
                <div className="controls">
                  <input id="yourName" type="text" name="yourName" value={form.yourName}
                    onChange={e => set('yourName', e.target.value)} />
                </div>
              </div>

              <div className="control-group">
                <label className="control-label" htmlFor="yourEmail">Your email address</label>
                <div className="controls">
                  <input id="yourEmail" type="text" name="yourEmail" value={form.yourEmail}
                    onChange={e => set('yourEmail', e.target.value)} />
                </div>
              </div>

              <div className="control-group">
                <label className="control-label" htmlFor="subject">Subject (optional)</label>
                <div className="controls">
                  <input id="subject" type="text" name="subject" value={form.subject}
                    onChange={e => set('subject', e.target.value)} />
                </div>
              </div>

              <div className="control-group">
                <label className="control-label" htmlFor="message">Message</label>
                <div className="controls textarea">
                  <textarea id="message" name="message" rows="10" value={form.message}
                    onChange={e => set('message', e.target.value)} />
                </div>
              </div>

              <div className="control-group">
                <div className="controls">
                  <button type="submit" className="btn btn-primary">Send</button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Layout>
  )
}
