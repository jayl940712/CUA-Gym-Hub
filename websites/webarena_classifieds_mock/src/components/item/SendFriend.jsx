import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Layout from '../Layout.jsx'
import Breadcrumb from '../Breadcrumb.jsx'
import NotFound from '../../pages/NotFound.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { getItem } from '../../data/catalog.js'
import { indexUrl } from '../../utils/urls.js'
import { categoryName } from '../../utils/format.js'

/**
 * ROUTES #33 / #34 — `index.php?page=item&action=send_friend&id=N` and its POST.
 *
 * Markup from the sigma theme's `item-send-friend.php`, cross-checked against
 * `assets/html/item-send-friend-4799.html`. `body.contact`, title
 * `Send to a friend - {item title} - Classifieds`, breadcrumb
 * `Classifieds > {Category} > {Title}` with the title crumb linking to the item.
 *
 * Logged in, `yourName` / `yourEmail` are hidden fields carrying the session
 * user, so only the friend fields and the message are user-editable. Validation
 * copy is the source's own jQuery-validate `messages` block.
 */
/**
 * jquery.validate's own `email` method, copied verbatim out of the container
 * (`oc-includes/osclass/assets/js/jquery3/jquery.validate.min.js`) — the form's
 * rule really is a bare `email: true`. The previous hand-rolled
 * `/^.+@.{2,}\..{2,3}$/` was stricter than the source and rejected perfectly
 * valid addresses such as `a@e.com` (single-letter host label).
 */
const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/

export default function SendFriend({ params }) {
  const { state, setState, sid } = useApp()
  const navigate = useNavigate()
  const id = Number(params.id)
  const [item, setItem] = useState(undefined)

  const user = state.user || {}
  const [friendName, setFriendName] = useState('')
  const [friendEmail, setFriendEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [errors, setErrors] = useState([])

  useEffect(() => {
    let live = true
    setItem(undefined)
    getItem(id, state).then(found => { if (live) setItem(found) })
    return () => { live = false }
  }, [id, state])

  if (item === undefined) return null
  if (item === null) return <NotFound />

  function onSubmit(e) {
    e.preventDefault()
    const errs = []
    if (!friendName.trim()) errs.push("Friend's name: this field is required.")
    if (!friendEmail.trim()) errs.push("Friend's email: this field is required.")
    else if (!EMAIL_RE.test(friendEmail.trim())) errs.push("Invalid friend's email address.")
    if (!message.trim()) errs.push('Message: this field is required.')
    if (errs.length) { setErrors(errs); return }
    setErrors([])

    setState(prev => ({
      ...prev,
      sendFriendMessages: [
        ...(prev.sendFriendMessages || []),
        {
          itemId: id,
          yourName: user.name || '',
          yourEmail: user.email || '',
          friendName: friendName.trim(),
          friendEmail: friendEmail.trim(),
          subject: subject.trim(),
          message: message.trim()
        }
      ]
    }))

    // The source redirects to the item on success.
    navigate(indexUrl({ page: 'item', id }, sid), {
      state: { flash: { type: 'ok', msg: `We just sent your message to ${friendName.trim()}` } }
    })
  }

  const breadcrumb = (
    <Breadcrumb crumbs={[
      { label: categoryName(item.cat), to: indexUrl({ page: 'search', sCategory: item.cat }, sid) },
      { label: item.title, to: indexUrl({ page: 'item', id }, sid) },
      { label: 'Send to a friend' }
    ]} />
  )

  return (
    <Layout
      bodyClass="contact"
      title={`Send to a friend - ${item.title} - Classifieds`}
      breadcrumb={breadcrumb}
    >
      <div id="main">
        <div className="form-container form-horizontal form-container-box">
          <div className="header">
            <h1>Send to a friend</h1>
          </div>
          <div className="resp-wrapper">
            {/* `wrapper: "li"` + `errorLabelContainer: "#error_list"` — see the
                note in Comments.jsx and the `:not(:empty)` reveal in mock.css
                (TEST BUG-A). Zero children when there is nothing to report. */}
            <ul id="error_list">
              {errors.map((msg, i) => <li key={i}><label className="error">{msg}</label></li>)}
            </ul>
            <form name="sendfriend" action="/index.php" method="post" onSubmit={onSubmit}>
              <input type="hidden" name="action" value="send_friend_post" />
              <input type="hidden" name="page" value="item" />
              <input type="hidden" name="id" value={id} readOnly />
              <input type="hidden" name="yourName" value={user.name || ''} readOnly />
              <input type="hidden" name="yourEmail" value={user.email || ''} readOnly />

              <div className="control-group">
                <label className="control-label" htmlFor="friendName">Your friend's name</label>
                <div className="controls">
                  <input id="friendName" type="text" name="friendName" value={friendName}
                    onChange={e => setFriendName(e.target.value)} />
                </div>
              </div>
              <div className="control-group">
                <label htmlFor="friendEmail">Your friend's e-mail address</label>
                <div className="controls">
                  <input id="friendEmail" type="text" name="friendEmail" value={friendEmail}
                    onChange={e => setFriendEmail(e.target.value)} />
                </div>
              </div>
              <div className="control-group">
                <label className="control-label" htmlFor="subject">Subject (optional)</label>
                <div className="controls">
                  <input id="subject" type="text" name="subject" value={subject}
                    onChange={e => setSubject(e.target.value)} />
                </div>
              </div>
              <div className="control-group">
                <label className="control-label" htmlFor="message">Message</label>
                <div className="controls textarea">
                  <textarea id="message" name="message" rows="10" value={message}
                    onChange={e => setMessage(e.target.value)}></textarea>
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
