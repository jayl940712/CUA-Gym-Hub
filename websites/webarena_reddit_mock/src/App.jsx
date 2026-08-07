import React from 'react'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext.jsx'
import ListingPage from './pages/ListingPage.jsx'
import SubmissionPage from './pages/SubmissionPage.jsx'
import SubmitPage from './pages/SubmitPage.jsx'
import EditSubmissionPage from './pages/EditSubmissionPage.jsx'
import DeleteSubmissionPage from './pages/DeleteSubmissionPage.jsx'
import CreateForumPage from './pages/CreateForumPage.jsx'
import ForumEditPage from './pages/ForumEditPage.jsx'
import ForumAppearancePage from './pages/ForumAppearancePage.jsx'
import ForumDeletePage from './pages/ForumDeletePage.jsx'
import ForumModeratorsPage from './pages/ForumModeratorsPage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import CommentsFirehosePage from './pages/CommentsFirehosePage.jsx'
import ForumsIndexPage from './pages/ForumsIndexPage.jsx'
import ForumsAllPage from './pages/ForumsAllPage.jsx'
import EditCommentPage from './pages/EditCommentPage.jsx'
import DeleteCommentPage from './pages/DeleteCommentPage.jsx'
import TagsPage from './pages/TagsPage.jsx'
import TagPage from './pages/TagPage.jsx'
import ModerationLogPage from './pages/ModerationLogPage.jsx'
import WikiPage from './pages/WikiPage.jsx'
import TrashPage from './pages/TrashPage.jsx'
import UserPage from './pages/UserPage.jsx'
import EditBiographyPage from './pages/EditBiographyPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import DeleteAccountPage from './pages/DeleteAccountPage.jsx'
import BlockUserPage from './pages/BlockUserPage.jsx'
import PreferencesPage from './pages/PreferencesPage.jsx'
import UsersListPage from './pages/UsersListPage.jsx'
import NotificationsPage, { ClearNotificationsRoute } from './pages/NotificationsPage.jsx'
import MessagesPage from './pages/MessagesPage.jsx'
import MessageThreadPage, { MessageThreadRedirect } from './pages/MessageThreadPage.jsx'
import ComposeMessagePage, { ComposeMessageShortcut } from './pages/ComposeMessagePage.jsx'
import NightModeRoute from './components/user/NightModeRoute.jsx'
import Placeholder from './pages/Placeholder.jsx'
import NotFound from './pages/NotFound.jsx'
import GoPage from './pages/GoPage.jsx'
import RedirectWithQuery from './components/RedirectWithQuery.jsx'
import { SORT_MODES } from './utils/listing.js'
import { canonicalPath } from './components/Submission.jsx'

// Routing mirrors ROUTES.md verbatim. WebArena evaluators check the agent's
// final URL, so a route that differs by one path segment is a broken task.
//
// Three rules that are easy to get wrong and are called out in TODO.md:
//   1. /f/:forum/:id/:slug resolves on :id ALONE — `-` is a real anchor slug.
//   2. Forum lookup is case-insensitive (/f/earthporn -> EarthPorn).
//   3. Unknown next[...] params are accepted and ignored, never 404ed.

/**
 * The `/{sortBy}` slot (ROUTES #2) collides with the bare-numeric submission
 * shortcut (#36). Disambiguate here rather than registering two dynamic
 * one-segment routes.
 */
function RootSegment() {
  const params = useParams()
  const seg = params.segment || ''
  // The matched param is `segment`, not `sort`, so the sort MUST be handed
  // down explicitly — ListingPage would otherwise read params.sort === undefined
  // and silently render `/new`, `/top`, … as Hot (PARITY-001).
  if (SORT_MODES.includes(seg)) return <ListingPage view="front" sort={seg} />
  if (/^[1-9][0-9]{0,17}$/.test(seg)) return <SubmissionShortcut id={seg} />
  return <NotFound />
}

/** ROUTES #36 — `/{id}` redirects to the canonical submission URL. */
function SubmissionShortcut({ id }) {
  const { getSubmission } = useApp()
  const sub = getSubmission(id)
  if (!sub) return <NotFound />
  return <RedirectWithQuery to={canonicalPath(sub)} />
}

/**
 * ROUTES #38 — the legacy slug-less comment permalink `/f/{forum}/{id}/comment/{cid}`
 * is a **301** to the canonical `-`-slug form on the source, not a render in
 * place. Measured on the container:
 *   /f/books/59421/comment/1235250      -> 301 /f/books/59421/-/comment/1235250
 *   /f/television/113998/comment/1981109 -> 301 /f/television/113998/-/comment/1981109
 *   /f/singularity/69404/comment/1042264 -> 301 /f/singularity/69404/-/comment/1042264
 * The target slug is the literal `-`, not the submission's slug. Same shape as
 * the `/{id}` shortcut (#36), which was already correct. `?sid=` rides along.
 */
function LegacyCommentPermalink() {
  const { forum, id, cid } = useParams()
  return <RedirectWithQuery to={`/f/${forum}/${id}/-/comment/${cid}`} />
}

/** ROUTES #62 — `/u/{username}` redirects to `/user/{username}`. */
function UserShortcut() {
  const { username } = useParams()
  return <RedirectWithQuery to={`/user/${username}`} />
}

function AppRoutes() {
  return (
    <Routes>
      {/* State inspection endpoint */}
      <Route path="/go" element={<GoPage />} />

      {/* --- 1. Front / global listings (ROUTES #1..#7) ------------------- */}
      <Route path="/" element={<ListingPage view="front" />} />
      <Route path="/featured" element={<ListingPage view="featured" />} />
      <Route path="/featured/:sort" element={<ListingPage view="featured" />} />
      <Route path="/all" element={<ListingPage view="all" />} />
      <Route path="/all/:sort" element={<ListingPage view="all" />} />
      <Route path="/subscribed" element={<ListingPage view="subscribed" />} />
      <Route path="/subscribed/:sort" element={<ListingPage view="subscribed" />} />
      <Route path="/moderated" element={<ListingPage view="moderated" />} />
      <Route path="/moderated/:sort" element={<ListingPage view="moderated" />} />
      <Route path="/comments" element={<CommentsFirehosePage scope="site" />} />
      <Route path="/trash" element={<TrashPage />} />

      {/* --- 2. Forums (ROUTES #10..#32) ---------------------------------- */}
      <Route path="/create_forum" element={<CreateForumPage />} />
      {/* /forums pages by an OFFSET path segment, not the cursor pager. */}
      <Route path="/forums" element={<ForumsIndexPage />} />
      <Route path="/forums/all" element={<ForumsAllPage />} />
      <Route path="/forums/:sortBy" element={<ForumsIndexPage />} />
      <Route path="/forums/:sortBy/:page" element={<ForumsIndexPage />} />

      <Route path="/f/:forum/comments" element={<CommentsFirehosePage scope="forum" />} />
      <Route path="/f/:forum/edit" element={<ForumEditPage />} />
      <Route path="/f/:forum/appearance" element={<ForumAppearancePage />} />
      <Route path="/f/:forum/delete" element={<ForumDeletePage />} />
      <Route path="/f/:forum/moderators" element={<ForumModeratorsPage />} />
      <Route path="/f/:forum/moderators/:page" element={<ForumModeratorsPage />} />
      <Route path="/f/:forum/add_moderator" element={<ForumModeratorsPage mode="add" />} />
      <Route path="/f/:forum/bans" element={<Placeholder name="Bans" todo="ROUTES #21" />} />
      <Route path="/f/:forum/moderation_log" element={<Placeholder name="Moderation log" todo="ROUTES #26" />} />
      {/* #27 — the target of the `Global moderation log` button the per-forum
          moderation log already renders. Source returns 200 with an empty log. */}
      <Route path="/moderation_log" element={<ModerationLogPage />} />
      <Route path="/moderation_log/:page" element={<ModerationLogPage />} />

      {/* --- 3. Submissions (ROUTES #33..#51) ----------------------------- */}
      {/* Longest paths first so they out-rank /f/:forum/:sort. */}
      {/* Standalone comment edit/delete pages (ROUTES #54..#57) — these must
          out-rank the comment permalink below, which they do on specificity. */}
      <Route path="/f/:forum/:id/:slug/comment/:cid/edit" element={<EditCommentPage />} />
      <Route path="/f/:forum/:id/:slug/comment/:cid/delete_own" element={<DeleteCommentPage mode="own" />} />
      <Route path="/f/:forum/:id/:slug/comment/:cid/delete" element={<DeleteCommentPage mode="mod" />} />
      <Route path="/f/:forum/:id/:slug/comment/:cid/delete_thread" element={<DeleteCommentPage mode="thread" />} />
      <Route path="/f/:forum/:id/:slug/comment/:cid" element={<SubmissionPage />} />
      <Route path="/f/:forum/:id/comment/:cid" element={<LegacyCommentPermalink />} />
      <Route path="/f/:forum/:id/:slug/edit" element={<EditSubmissionPage />} />
      <Route path="/f/:forum/:id/:slug/delete" element={<DeleteSubmissionPage />} />
      {/* Literal /nested and /linear out-rank the :commentView param route
          below, so the mode has to arrive as a prop (ROUTES #34). */}
      <Route path="/f/:forum/:id/:slug/nested" element={<SubmissionPage view="nested" />} />
      <Route path="/f/:forum/:id/:slug/linear" element={<SubmissionPage view="linear" />} />
      <Route path="/f/:forum/:id/:slug/:commentView" element={<SubmissionPage />} />
      <Route path="/f/:forum/:id/:slug" element={<SubmissionPage />} />

      <Route path="/submit" element={<SubmitPage />} />
      <Route path="/submit/:forum" element={<SubmitPage />} />

      {/* --- 2b. Forum listings (must come AFTER the submission routes) --- */}
      <Route path="/f/:forum" element={<ListingPage view="forum" />} />
      <Route path="/f/:forum/:sort" element={<ListingPage view="forum" />} />

      {/* --- 5. Users (ROUTES #61..#81) ----------------------------------- */}
      <Route path="/u/:username" element={<UserShortcut />} />
      <Route path="/user/:username" element={<UserPage tab="overview" />} />
      <Route path="/user/:username/submissions" element={<UserPage tab="submissions" />} />
      <Route path="/user/:username/comments" element={<UserPage tab="comments" />} />
      <Route path="/user/:username/edit_biography" element={<EditBiographyPage />} />
      <Route path="/user/:username/account" element={<AccountPage />} />
      {/* #68 / #70 — both are linked from shipped UI (the Delete-this-account
          button on /account, and Block user in every other profile's Toolbox),
          so they must resolve. Both are the source's real forms. */}
      <Route path="/user/:username/delete_account" element={<DeleteAccountPage />} />
      <Route path="/user/:username/block_user" element={<BlockUserPage />} />
      <Route path="/user/:username/preferences" element={<PreferencesPage />} />
      <Route path="/user/:username/compose_message" element={<ComposeMessagePage />} />
      <Route path="/user/:username/block_list" element={<Placeholder name="Block list" todo="ROUTES #69" />} />
      <Route path="/user/:username/hidden_forums" element={<Placeholder name="Hidden forums" todo="ROUTES #72" />} />
      {/* #75 — linked from the profile sidebar's Toolbox, so it must resolve. */}
      <Route path="/user/:username/trash" element={<Placeholder name="Trash" todo="ROUTES #75" />} />

      {/* #77 — admin-only on the source; renders Postmill's 403 for the
          seeded (non-admin) user. */}
      <Route path="/users" element={<UsersListPage />} />
      <Route path="/users/:page" element={<UsersListPage />} />

      {/* #78..#81 — inbox + night mode. `/inbox/{page}` 302s to /notifications
          on the source (verified live). */}
      <Route path="/notifications" element={<NotificationsPage />} />
      <Route path="/notifications/:page" element={<NotificationsPage />} />
      <Route path="/inbox" element={<RedirectWithQuery to="/notifications" />} />
      <Route path="/inbox/:page" element={<RedirectWithQuery to="/notifications" />} />
      <Route path="/clear_notifications" element={<ClearNotificationsRoute />} />
      <Route path="/night_mode" element={<NightModeRoute />} />
      <Route path="/night_mode.html" element={<NightModeRoute />} />
      <Route path="/night_mode.json" element={<NightModeRoute />} />

      {/* #84..#88 — messages. Seeded empty; see TODO.md gap 8. */}
      <Route path="/messages" element={<MessagesPage />} />
      <Route path="/messages/:page" element={<MessagesPage />} />
      <Route path="/messages/thread/:id" element={<MessageThreadPage />} />
      <Route path="/message_reply/:id" element={<MessageThreadRedirect />} />
      <Route path="/compose_message/:username" element={<ComposeMessageShortcut />} />

      {/* --- 7. Search (ROUTES #90) --------------------------------------- */}
      <Route path="/search" element={<SearchPage />} />

      {/* --- 8. Wiki / tags (ROUTES #92..#99) -----------------------------
          The source has 0 wiki pages and 0 tags. `/wiki`, `/wiki/index` and
          `/wiki/<anything>` all 404 with the wiki's own in-layout miss page;
          `/tags` renders an empty index and `/tag/<name>` is a hard 404. Both
          verified live — do not fabricate content for either. */}
      <Route path="/wiki" element={<WikiPage />} />
      <Route path="/w/*" element={<WikiPage />} />
      <Route path="/wiki/*" element={<WikiPage />} />
      <Route path="/tags" element={<TagsPage />} />
      <Route path="/tags/:page" element={<TagsPage />} />
      {/* #93 — a real listing over the forums carrying the tag. On a fresh seed
          there are zero tags, so every /tag/<name> still 404s exactly as the
          source does; a tag created through /create_forum or /f/<name>/edit
          appears on /tags and resolves here. */}
      <Route path="/tag/:name" element={<TagPage />} />
      <Route path="/tag/:name/:sortBy" element={<TagPage />} />

      {/* --- Single-segment fallback: /{sortBy} (#2) and /{id} (#36) ------ */}
      <Route path="/:segment" element={<RootSegment />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  )
}
