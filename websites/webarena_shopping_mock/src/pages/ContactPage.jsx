import React, { useState } from 'react'
import Page from '../components/Page.jsx'
import { useApp } from '../context/AppContext.jsx'

/**
 * ROUTES #39 — /contact/ and /contact.
 *
 * Twelve WebArena tasks fill this form and five of them explicitly say "do not
 * submit, keep it ready for review" — so the typed values must stay visible in
 * the DOM without a submit.
 *
 * The store has no phone number: general/store_information/phone is NULL and
 * none appears on this page. The "customer service phone number" task expects
 * N/A. Do not invent one.
 */
export default function ContactPage() {
  const { state, submitContact, addMessage } = useApp()
  const [name, setName] = useState(`${state.customer.firstname} ${state.customer.lastname}`)
  const [email, setEmail] = useState(state.customer.email)
  const [telephone, setTelephone] = useState('')
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState({})

  const onSubmit = (e) => {
    e.preventDefault()
    const errs = {}
    if (!name.trim()) errs.name = 'This is a required field.'
    if (!email.trim()) errs.email = 'This is a required field.'
    if (!comment.trim()) errs.comment = 'This is a required field.'
    setErrors(errs)
    if (Object.keys(errs).length) return
    submitContact({ name: name.trim(), email: email.trim(), telephone: telephone.trim(), comment: comment.trim() })
    setComment('')
    addMessage("Thanks for contacting us with your comments and questions. We'll respond to you very soon.")
  }

  return (
    <Page title="Contact Us" documentTitle="Contact Us" sidebar="none">
      {/* Markup mirrors the container's contact/form.phtml verbatim: the legend
          is followed by a <br/>, the intro copy is a `field note no-label`
          div (not a <p>), every input carries `class="input-text"`, the
          textarea is cols=5/rows=3, and the submit button sits inside
          `.actions-toolbar > .primary`. Combined with the `.form.contact`
          rules in globals.css this reproduces Magento's two-column skeleton:
          label x=100 w=160 right-aligned, control x=260 w=460, same row. */}
      <form className="form contact" id="contact-form" data-hasrequired="&#x2A;&#x20;Required&#x20;Fields"
        onSubmit={onSubmit} noValidate>
        <fieldset className="fieldset">
          <legend className="legend"><span>Write Us</span></legend><br />
          <div className="field note no-label">
            Jot us a note and we&rsquo;ll get back to you as quickly as possible.
          </div>
          <div className="field name required">
            <label className="label" htmlFor="name"><span>Name</span></label>
            <div className="control">
              <input name="name" id="name" title="Name" className="input-text" type="text"
                value={name} onChange={e => setName(e.target.value)} />
              {errors.name && <span className="field-error">{errors.name}</span>}
            </div>
          </div>
          <div className="field email required">
            <label className="label" htmlFor="email"><span>Email</span></label>
            <div className="control">
              <input name="email" id="email" title="Email" className="input-text" type="email"
                value={email} onChange={e => setEmail(e.target.value)} />
              {errors.email && <span className="field-error">{errors.email}</span>}
            </div>
          </div>
          <div className="field telephone">
            <label className="label" htmlFor="telephone"><span>Phone Number</span></label>
            <div className="control">
              <input name="telephone" id="telephone" title="Phone Number" className="input-text" type="tel"
                value={telephone} onChange={e => setTelephone(e.target.value)} />
            </div>
          </div>
          <div className="field comment required">
            <label className="label" htmlFor="comment"><span>What&rsquo;s on your mind?</span></label>
            <div className="control">
              <textarea name="comment" id="comment" title="What&rsquo;s on your mind?" className="input-text"
                cols={5} rows={3} value={comment} onChange={e => setComment(e.target.value)} />
              {errors.comment && <span className="field-error">{errors.comment}</span>}
            </div>
          </div>
        </fieldset>
        <div className="actions-toolbar">
          <div className="primary">
            <button type="submit" title="Submit" className="action submit primary"><span>Submit</span></button>
          </div>
        </div>
      </form>
    </Page>
  )
}
