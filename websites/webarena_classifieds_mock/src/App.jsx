import React from 'react'
import { BrowserRouter, Routes, Route, Navigate, useSearchParams, useLocation } from 'react-router-dom'
import { AppProvider } from './context/AppContext.jsx'
import Home from './pages/Home.jsx'
import Search from './pages/Search.jsx'
import Item from './pages/Item.jsx'
import NotFound from './pages/NotFound.jsx'
import GoPage from './pages/GoPage.jsx'
import DeleteComment from './components/item/DeleteComment.jsx'
import SendFriend from './components/item/SendFriend.jsx'
import MarkItem from './components/item/MarkItem.jsx'
import ItemForm, { ItemDelete } from './pages/ItemForm.jsx'
import Contact from './pages/Contact.jsx'
import MyListings from './pages/user/MyListings.jsx'
import Profile from './pages/user/Profile.jsx'
import Alerts from './pages/user/Alerts.jsx'
import ChangeEmail from './pages/user/ChangeEmail.jsx'
import ChangeUsername from './pages/user/ChangeUsername.jsx'
import ChangePassword from './pages/user/ChangePassword.jsx'
import PublicProfile from './pages/user/PublicProfile.jsx'
import { sourceParams, homeUrl, indexUrl } from './utils/urls.js'

/**
 * `osc_base_url()` — the site root. Everything except `sid` is dropped, which is
 * what a PHP 302 to `http://host:9980/` does. Re-emitting the whole query string
 * here would put `page=…` back on `/`, which re-enters the dispatcher and loops
 * forever (HANDLERS-006).
 */
function RedirectToBaseUrl() {
  const [searchParams] = useSearchParams()
  return <Navigate to={homeUrl(searchParams.get('sid'))} replace />
}

/**
 * ROUTES #17: `/php?page=…` 301s to `/index.php?page=…` on the source (PHP's dev
 * server resolves `/php` to `index.php`). Preserve the ENTIRE query string.
 * Task visualwebarena-829 lands here.
 */
function PhpRedirect() {
  const { search } = useLocation()
  return <Navigate to={`/index.php${search}`} replace />
}

/**
 * The query-string router. Osclass has no path segments beyond `/index.php` —
 * everything is `?page=<controller>&action=<action>`. `/` and `/index.php` both
 * enter here; with no `page` param they render the home page (the router's
 * default branch on the source).
 */
function Dispatcher() {
  const [searchParams] = useSearchParams()
  const params = sourceParams(searchParams)
  const page = params.page || ''
  const action = params.action || ''

  switch (page) {
    case '':
    case 'main':
      // page=main&action=logout — the mock is always logged in; fall through home.
      return <Home />

    case 'search':
      return <Search params={params} />

    case 'item':
      switch (action) {
        case '':
          return <Item params={params} />
        case 'add_comment':
          // ROUTES #31 is a POST handled inline by the item page's comment form;
          // arriving here by URL just shows the item again.
          return <Item params={params} />
        case 'delete_comment':                                    // ROUTES #32
          return <DeleteComment params={params} />
        case 'send_friend':                                       // ROUTES #33
        case 'send_friend_post':                                  // ROUTES #34
          // Reached by GET (hand-typed URL, reload after submit) this renders the
          // form, matching how `item_add_post` / `item_edit_post` / `profile_post`
          // already behave. Previously it fell through to the 404 body.
          // (TEST BUG-R3.)
          return <SendFriend params={params} />
        case 'mark':                                              // ROUTES #36
          return <MarkItem params={params} />
        case 'item_add':                                          // ROUTES #26
        case 'item_add_post':                                     // ROUTES #27
          return <ItemForm params={params} mode="add" />
        case 'item_edit':                                         // ROUTES #28
        case 'item_edit_post':                                    // ROUTES #29
          return <ItemForm params={params} mode="edit" />
        case 'item_delete':                                       // ROUTES #30
          return <ItemDelete params={params} />
        default:
          return <NotImplemented page={page} action={action} params={params} />
      }

    case 'user':
      switch (action) {
        case '':
        case 'dashboard':                                         // ROUTES #18
          // `controller/user.php:39-47` case('dashboard') has NO redirectTo: it
          // exports items/max_items and calls doView('user-dashboard.php'), and
          // sigma's user-dashboard.php is a two-line include of user-items.php.
          // So the source answers 200 IN PLACE and the URL keeps
          // `action=dashboard` — which is why assets/html/user-dashboard.html and
          // user-items.html are byte-identical.
        case 'items':                                             // ROUTES #19
          return <MyListings params={params} />
        case 'profile':                                           // ROUTES #20
        case 'profile_post':                                      // ROUTES #21
          return <Profile />
        case 'alerts':                                            // ROUTES #22
          return <Alerts />
        case 'change_email':                                      // ROUTES #23
        case 'change_email_post':
          return <ChangeEmail />
        case 'change_username':                                   // ROUTES #24
        case 'change_username_post':
          return <ChangeUsername />
        case 'change_password':                                   // ROUTES #25
        case 'change_password_post':
          return <ChangePassword />
        case 'pub_profile':                                       // ROUTES #37
          return <PublicProfile params={params} />
        default:
          return <NotImplemented page={page} action={action} params={params} />
      }

    case 'login':
      // `controller/login.php:349-354` (default branch):
      //   if(osc_logged_user_id() > 0) $this->redirectTo(osc_user_dashboard_url());
      // -> /index.php?page=user&action=dashboard
      return <RedirectWithQueryParams set={{ page: 'user', action: 'dashboard' }} />

    case 'register':
      // `controller/register.php:38-40`:
      //   if(osc_is_web_user_logged_in()) $this->redirectTo(osc_base_url());
      return <RedirectToBaseUrl />

    case 'contact':                                               // ROUTES #16
      return <Contact params={params} />

    case 'page':
      return <NotImplemented page={page} action={action} params={params} />

    default:
      return <NotFound />
  }
}

/**
 * Rewrite the query string, preserving every other source param, and navigate.
 * Rebuilt through `indexUrl` so the result keeps the source's canonical param
 * order (`page`, `action`, …) with the mock-only `sid` appended last.
 */
function RedirectWithQueryParams({ set }) {
  const [searchParams] = useSearchParams()
  const next = { ...sourceParams(searchParams), ...set }
  return <Navigate to={indexUrl(next, searchParams.get('sid'))} replace />
}

/**
 * A route that ROUTES.md maps but this round does not implement. It renders the
 * theme 404 body so nothing dead-ends; the owning agent replaces it.
 */
function NotImplemented() {
  return <NotFound />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/go" element={<GoPage />} />
      <Route path="/php" element={<PhpRedirect />} />
      <Route path="/php/*" element={<PhpRedirect />} />
      <Route path="/index.php" element={<Dispatcher />} />
      <Route path="/" element={<Dispatcher />} />
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
