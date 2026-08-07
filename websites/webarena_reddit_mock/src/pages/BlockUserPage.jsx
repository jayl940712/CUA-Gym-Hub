import React, { useState } from 'react'
import { useParams } from 'react-router-dom'
import Layout from '../components/layout/Layout.jsx'
import UserSidebar from '../components/user/UserSidebar.jsx'
import Forbidden from '../components/user/Forbidden.jsx'
import NotFound from './NotFound.jsx'
import SLink, { useSidNavigate } from '../components/SLink.jsx'
import Icon from '../components/Icon.jsx'
import { FormRow, ButtonRow, useNativeValidation } from '../components/forms/FormBits.jsx'
import { useApp, normalizeBlocks } from '../context/AppContext.jsx'
import '../components/user/user.css'

// ROUTES #70 — `/user/{username}/block_user`, UserController::block +
// templates/user/block.html.twig + src/Form/UserBlockType.php, read out of
// container `forum` and transcribed against the live render of
// http://localhost:9999/user/smita16/block_user (200 as the seeded user).
//
// This route was previously unregistered while `Block user` sat in the Toolbox
// of every other user's profile sidebar, so the item dead-ended on "Page not
// found" (AUDIT HANDLER-012). The source page is a real form, not an empty
// state, so a generic placeholder would be wrong.
//
// Permission, from the controller's annotations — both reproduced, and both
// verified live:
//   @Security("user !== blockee", statusCode=403)
//     -> /user/MarvelsGrantMan136/block_user returns 403 (you cannot block
//        yourself), while /user/smita16/block_user returns 200
//   @Security("not user.isBlocking(blockee)", statusCode=403)
//     -> blocking someone already blocked is a 403
//
// WHAT SUBMIT DOES. The source's handler is
//   $this->getUser()->block($blockee, $data->getComment());
//   $this->addFlash('success', 'flash.user_blocked');
//   return $this->redirectToRoute('user_block_list', {username: <self>});
// all three of which are real here: the block is appended to
// `state.blockedUsers` (so it reaches saveState -> /post -> /go state_diff),
// the flash is "The user was blocked.", and the mock lands on
// /user/<self>/block_list — which renders the new row, and offers the source's
// Unblock button. No fake success.
//
// Copy: title.blocking_user / help.blocking_users / label.comment /
// action.block / flash.user_blocked.

export default function BlockUserPage() {
  const { username } = useParams()
  const { state, getUser } = useApp()

  const user = getUser(username)
  if (!user) return <NotFound />

  if (user.username === state.currentUser.username) return <Forbidden />
  const already = normalizeBlocks(state.blockedUsers)
    .some(b => b.username.toLowerCase() === user.username.toLowerCase())
  if (already) return <Forbidden />

  return <BlockUserForm key={user.username} user={user} />
}

function BlockUserForm({ user }) {
  const navigate = useSidNavigate()
  const { state, blockUser, addFlash } = useApp()
  const [comment, setComment] = useState('')
  const [errors, setErrors] = useState({})
  // The source form carries NO `novalidate` (`form_start(form)` with no attr
  // override, same as every other Postmill form). UserBlockType sets the only
  // field to `required: false`, so nothing is rejected in practice — but the
  // form must still be a validating form, and any future required control gets
  // both the native bubble and the `ul.form-error-list` entry for free.
  const formRef = useNativeValidation(setErrors)

  function onSubmit(e) {
    e.preventDefault()
    blockUser(user.username, comment)
    addFlash('The user was blocked.')
    navigate(`/user/${state.currentUser.username}/block_list`)
  }

  return (
    <Layout
      sidebar={<UserSidebar user={user} activeTool="block_user" />}
      title={`Blocking /u/${user.username}`}
    >
      <h1 className="page-heading">
        Blocking <SLink to={`/user/${user.username}`}>/u/{user.username}</SLink>
      </h1>

      {/* _macros/alert.html.twig with type='info' -> `alert bg-yellow`. */}
      <div className="alert bg-yellow">
        <div className="alert__icon fg-yellow" aria-hidden="true"><Icon name="help-circled" /></div>
        <div className="alert__text">
          <p>
            Blocking a user hides their posts, prevents them from sending you private
            messages, and you won't receive notifications when they reply to you.
            Blocked users can still view your public posts.
          </p>
        </div>
      </div>

      <form ref={formRef} name="user_block" method="post" className="form flow" onSubmit={onSubmit}>
        <FormRow id="user_block_comment" label="Comment" errors={errors.comment}>
          <textarea id="user_block_comment" name="user_block[comment]" className="form-control"
                    value={comment} onChange={e => setComment(e.target.value)} />
        </FormRow>

        <ButtonRow label="Block" />
      </form>
    </Layout>
  )
}
