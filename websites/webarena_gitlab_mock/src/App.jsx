import React, { useEffect, useMemo, useState } from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import { useApp } from './context/AppContext.jsx'
import {
  ensureProjects, projectReady, projectIdForPath, projectPathFromPathname,
  ensureSearchBodies, searchBodiesReady,
} from './data/lazy.js'
import { originPath } from './utils/dataManager.js'
import RedirectWithQuery, { appendSid } from './utils/RedirectWithQuery.jsx'
import { buildPathIndex, canonicalPathname } from './utils/canonicalPath.js'
import Layout from './components/layout/Layout.jsx'
import ProjectSettingsRepository from './pages/ProjectSettingsRepo.jsx'
import {
  ProjectSettingsMergeRequests, ProjectSettingsCiCd, ProjectSettingsIntegrations,
  ProjectSettingsAccessTokens, ProjectSettingsOperations, ProjectSettingsPackages,
  ProjectHooks, ProjectUsageQuotas, ProjectValueStreamAnalytics, ProjectSecurityConfiguration,
} from './pages/ProjectSettingsMisc.jsx'
import {
  PipelineSchedules, PipelineEditor,
  Environments, Releases, FeatureFlags, PackageRegistry, InfrastructureRegistry,
  Terraform, Clusters, Incidents, AlertManagement, ErrorTracking, Metrics,
  ProjectSnippets, Wiki, ProjectActivity, ServerError,
} from './pages/ProjectOps.jsx'
import {
  Pipelines, PipelineDetail, PipelineCharts, Jobs, JobDetail,
} from './pages/PipelinesCi.jsx'
import RefRoute from './components/layout/RefRoute.jsx'

import RawFile from './pages/RawFile.jsx'
import Help from './pages/Help.jsx'
import GoPage from './pages/GoPage.jsx'
import DashboardProjects from './pages/DashboardProjects.jsx'
import ExploreProjects from './pages/ExploreProjects.jsx'
import ProjectOverview from './pages/ProjectOverview.jsx'
import RepoTree from './pages/RepoTree.jsx'
import RepoBlob from './pages/RepoBlob.jsx'
import RepoCommits from './pages/RepoCommits.jsx'
import IssuesList from './pages/IssuesList.jsx'
import IssueDetail from './pages/IssueDetail.jsx'
import MergeRequestsList from './pages/MergeRequestsList.jsx'
import MergeRequestDetail from './pages/MergeRequestDetail.jsx'
import ProjectMembers from './pages/ProjectMembers.jsx'
import MilestonesList from './pages/MilestonesList.jsx'
import MilestoneDetail from './pages/MilestoneDetail.jsx'
import UserProfile from './pages/UserProfile.jsx'
import DashboardIssues from './pages/DashboardIssues.jsx'
import DashboardMergeRequests from './pages/DashboardMergeRequests.jsx'
import GroupOverview from './pages/GroupOverview.jsx'
import GroupMembers from './pages/GroupMembers.jsx'
// --- shard C: people, profile, repository browsing, search -----------------
import Search from './pages/Search.jsx'
import ProfileSettings from './pages/ProfileSettings.jsx'
import ProfileAccount from './pages/ProfileAccount.jsx'
import ProfilePreferences from './pages/ProfilePreferences.jsx'
import ProfileNotifications from './pages/ProfileNotifications.jsx'
import ProfileKeys, { ProfileMisc } from './pages/ProfileKeys.jsx'
import ProfileEmails from './pages/ProfileEmails.jsx'
import DashboardActivity from './pages/DashboardActivity.jsx'
import Snippets from './pages/Snippets.jsx'
import ExploreTopics from './pages/ExploreTopics.jsx'
import Contributors from './pages/Contributors.jsx'
import RepoAnalytics from './pages/RepoAnalytics.jsx'
import NetworkGraph from './pages/NetworkGraph.jsx'
import Branches from './pages/Branches.jsx'
import NewBranch from './pages/NewBranch.jsx'
import Tags from './pages/Tags.jsx'
import NewTag from './pages/NewTag.jsx'
import CommitDetail from './pages/CommitDetail.jsx'
import Compare from './pages/Compare.jsx'
import FindFile from './pages/FindFile.jsx'
import Starrers from './pages/Starrers.jsx'
import NewIssue from './pages/NewIssue.jsx'
import EditIssue from './pages/EditIssue.jsx'
import NewMergeRequest from './pages/NewMergeRequest.jsx'
import EditMergeRequest from './pages/EditMergeRequest.jsx'
import NewMilestone from './pages/NewMilestone.jsx'
import LabelsList from './pages/LabelsList.jsx'
import NewLabel from './pages/NewLabel.jsx'
import EditLabel from './pages/EditLabel.jsx'
import Boards from './pages/Boards.jsx'
import ServiceDesk from './pages/ServiceDesk.jsx'
import DashboardTodos, { TodoAction } from './pages/DashboardTodos.jsx'
import DashboardMilestones from './pages/DashboardMilestones.jsx'
import NotFound from './pages/NotFound.jsx'

// Creation / mutation flows (TODO.md P1-A, P1-C, P1-D, P1-E)
import NewProject from './pages/NewProject.jsx'
import NewGroup from './pages/NewGroup.jsx'
import GroupSettings from './pages/GroupSettings.jsx'
import GroupRollup from './components/create/GroupRollup.jsx'
import DashboardGroups from './pages/DashboardGroups.jsx'
import ExploreGroups from './pages/ExploreGroups.jsx'
import Forks from './pages/Forks.jsx'
import ForkProject from './pages/ForkProject.jsx'
import NewFile from './pages/NewFile.jsx'
import EditFile from './pages/EditFile.jsx'
import WebIde from './pages/WebIde.jsx'
import NewSnippet from './pages/NewSnippet.jsx'
import ProjectSettingsGeneral from './pages/ProjectSettingsGeneral.jsx'

// ---------------------------------------------------------------------------
// ?sid= survival.
//
// The captured GitLab DOM is full of real `<a href="/byteblaze/dotfiles">`
// elements, and assets/README.md pins those hrefs verbatim — so pages render
// them as-is and this one delegated handler turns them into client-side
// navigations that carry `?sid=` forward. That keeps the DOM identical to the
// source AND keeps the session id on every click.
// ---------------------------------------------------------------------------
function useGlobalLinkInterception() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    function onClick(e) {
      if (e.defaultPrevented || e.button !== 0) return
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const anchor = e.target.closest && e.target.closest('a[href]')
      if (!anchor) return
      if (anchor.target && anchor.target !== '' && anchor.target !== '_self') return
      if (anchor.hasAttribute('download')) return

      const href = anchor.getAttribute('href')
      if (!href || href.startsWith('#') || href.startsWith('mailto:')) return
      // External links stay inert (no network) — let the browser handle them.
      if (/^[a-z][a-z0-9+.-]*:/i.test(href)) return
      if (!href.startsWith('/')) return

      e.preventDefault()
      // TEST.md DIFF-1303 — the href is navigated to VERBATIM apart from the
      // appended `sid`. Rebuilding it through `URLSearchParams` used to turn
      // the anchors' `%20` into `+` and could reorder the query; the twelve
      // anchored issue-filter URLs are compared as strings, so the emitted
      // bytes have to survive the click.
      navigate(appendSid(href, location.search))
    }
    document.addEventListener('click', onClick)
    return () => document.removeEventListener('click', onClick)
  }, [navigate, location.search])
}

/**
 * Block rendering until the current route's project chunk is in memory.
 *
 * 16.8 MB of the seed is per-project and now arrives by `import()`
 * (src/data/lazy.js). The single most important property of this app is that a
 * COLD DEEP LINK on any route renders correctly on first paint — RL agents are
 * dropped straight onto arbitrary URLs — so a project route must not render
 * empty and fill in a tick later. This hook is the gate: `App` returns `null`
 * while the chunk is outstanding, on the same early return that already covered
 * state hydration, so the page appears once and correct.
 *
 * Gating at the App level rather than per page is deliberate. There are ~90
 * project routes and every one of them reads git data, notes, resource events,
 * MR diffs or CI rows from the chunk; a per-route declaration of what to await
 * would be ~90 chances to forget one, and a forgotten one fails SILENTLY as an
 * empty file tree or a missing discussion. One chunk per project, awaited for
 * the whole project subtree, cannot be got wrong. The cost of over-fetching is
 * a median 72 KB — about 2 ms of parse.
 *
 * Forks resolve through `state.repo.forkOrigin`: a fork's git data lives in its
 * source project's chunk (see `originChunk` in dataManager.js), so the origin is
 * what gets awaited. `lazy.js` also fires a prefetch for the opening URL at
 * module-init time, which overlaps the fetch with the eager bundle's parse;
 * this hook is the correctness half and re-resolves once state exists.
 */
function useProjectChunk(state, indexes) {
  const { pathname, search } = useLocation()

  // The project id the URL needs, AFTER walking the fork chain.
  //
  // Resolution goes through the LIVE project index, not the seed map, so a
  // project the agent created resolves too. That is not hypothetical: a fork
  // has no chunk of its own and reads its SOURCE project's (see `originChunk`
  // in dataManager.js), so `/byteblaze/<fork>/-/tree/main` has to await the
  // origin's chunk or the file tree renders empty.
  const needId = useMemo(() => {
    const byPath = indexes && indexes.projectsByPathLower
    const path = projectPathFromPathname(pathname, byPath && (p => byPath.has(p)))
    if (!path) return null
    const project = byPath ? byPath.get(path) : null
    if (!project) return projectIdForPath(path)
    const origin = originPath(state, project.full_path)
    const originId = origin === project.full_path
      ? project.id
      : projectIdForPath(origin)
    // A fork of a project the agent also created has no chunk anywhere; falling
    // back to its own id makes `projectReady` true immediately (no loader), so
    // the route renders its empty repo state rather than hanging.
    return originId == null ? project.id : originId
  }, [pathname, state, indexes])

  // `projectReady` is consulted during RENDER, not in the effect, so a chunk
  // that is already in memory (a second visit, or the module-init prefetch that
  // resolved while React was mounting) never costs an extra blank frame.
  // `/search?search=…` is the one route that reads issue and MR DESCRIPTIONS
  // across every project — GitLab without Elasticsearch matches title OR
  // description, so without the bodies this page would quietly return fewer
  // rows than the source rather than fail visibly. It gets one 2.87 MB module
  // (src/data/lazy.js) instead of fanning out to 173 chunks. An empty `search`
  // renders no results at all, so it needs nothing.
  const needBodies = pathname === '/search'
    && !!new URLSearchParams(search).get('search')

  const ready = (needId == null || projectReady(needId))
    && (!needBodies || searchBodiesReady())
  const [, force] = useState(0)

  useEffect(() => {
    let live = true
    const waits = []
    if (needId != null && !projectReady(needId)) waits.push(ensureProjects(needId))
    if (needBodies && !searchBodiesReady()) waits.push(ensureSearchBodies())
    if (waits.length === 0) return undefined
    Promise.all(waits).then(() => { if (live) force(n => n + 1) })
    return () => { live = false }
  }, [needId, needBodies])

  return ready
}

/** Scroll to top on navigation, like a server-rendered app. */
function useScrollReset() {
  const { pathname } = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
}

export default function App() {
  const { loading, state, indexes } = useApp()
  const location = useLocation()
  useGlobalLinkInterception()
  useScrollReset()

  // GitLab resolves namespace/project paths case-insensitively and answers a
  // 301 to the canonical casing (verified read-only on the source: /ROOT/metaseq
  // -> /root/metaseq, /convexegg/ChatGPT -> /convexegg/chatgpt). webarena-396
  // asserts at `/byteblaze/ChatGPT` while the real path is `chatgpt`, so without
  // this the task is unreachable. Done here rather than per-page so it covers
  // every `/:ns/:proj/…` sub-route at once, and rendered as a redirect rather
  // than run from an effect so NotFound never flashes first.
  const pathIndex = useMemo(() => buildPathIndex(state), [state])
  const canonical = state ? canonicalPathname(location.pathname, pathIndex) : null
  // Case-insensitive like `canonicalPathname` above, so `/byteblaze/ChatGPT`
  // awaits `chatgpt`'s chunk during the render that also emits the redirect —
  // the corrected URL then lands on a chunk that is already in memory.
  const chunkReady = useProjectChunk(state, indexes)

  if (loading) return null
  if (canonical) return <RedirectWithQuery to={canonical} />
  // Nothing has painted yet at this point — this is the same blank the app
  // already showed during hydration, not a flash of a half-built page.
  if (!chunkReady) return null

  return (
    <Routes>
      {/* ROUTES #48 — bare text/plain, deliberately OUTSIDE the app shell. */}
      <Route path="/:ns/:proj/-/raw/*" element={
        <RefRoute><Route path=":ref/*" element={<RawFile />} /></RefRoute>
      } />

      {/* Hub state-inspection endpoint (also served by vite middleware). */}
      <Route path="/go" element={<GoPage />} />

      <Route element={<Layout />}>
        {/* ── 1. Root, dashboard, explore ─────────────────────────────────── */}
        <Route path="/" element={<DashboardProjects />} />                                   {/* #1 */}
        <Route path="/dashboard/projects" element={<DashboardProjects />} />                 {/* #2 */}
        <Route path="/dashboard/projects/starred" element={<DashboardProjects starred />} /> {/* #3 */}
        <Route path="/dashboard/groups" element={<DashboardGroups />} />                     {/* #4 */}
        <Route path="/dashboard/issues" element={<DashboardIssues />} />                     {/* #5 */}
        <Route path="/dashboard/merge_requests" element={<DashboardMergeRequests />} />      {/* #6 */}
        <Route path="/dashboard/todos" element={<DashboardTodos />} />                       {/* #7 */}
        <Route path="/dashboard/todos/destroy_all" element={<TodoAction action="destroy_all" />} />  {/* #10 */}
        <Route path="/dashboard/todos/bulk_restore" element={<TodoAction action="bulk_restore" />} />
        <Route path="/dashboard/todos/:id/restore" element={<TodoAction action="restore" />} />      {/* #9 */}
        <Route path="/dashboard/todos/:id" element={<TodoAction action="done" />} />                 {/* #8 */}
        <Route path="/dashboard/activity" element={<DashboardActivity />} />                 {/* #11 */}
        <Route path="/dashboard/milestones" element={<DashboardMilestones />} />             {/* #12 */}
        <Route path="/dashboard/snippets" element={<Snippets />} />                          {/* #13 */}
        <Route path="/explore" element={<ExploreProjects />} />                              {/* #14 */}
        <Route path="/explore/projects" element={<ExploreProjects />} />                     {/* #15 */}
        <Route path="/explore/projects/trending" element={<ExploreProjects tab="trending" />} />
        <Route path="/explore/projects/starred" element={<ExploreProjects tab="starred" />} />
        <Route path="/explore/projects/topics" element={<ExploreTopics />} />                {/* #18 */}
        <Route path="/explore/groups" element={<ExploreGroups />} />                         {/* #19 */}
        <Route path="/explore/snippets" element={<Snippets explore />} />                    {/* #20 */}

        {/* ── 2. Search ───────────────────────────────────────────────────── */}
        <Route path="/search" element={<Search />} />                                        {/* #21–#23 */}

        {/* ── 4. User settings ────────────────────────────────────────────── */}
        <Route path="/-/profile" element={<ProfileSettings />} />                            {/* #35/#36 */}
        <Route path="/-/profile/account" element={<ProfileAccount />} />                     {/* #37 */}
        <Route path="/-/profile/preferences" element={<ProfilePreferences />} />             {/* #38 */}
        <Route path="/-/profile/notifications" element={<ProfileNotifications />} />         {/* #39 */}
        <Route path="/-/profile/keys" element={<ProfileKeys />} />                           {/* #40 */}
        <Route path="/-/profile/emails" element={<ProfileEmails />} />                       {/* #41 */}
        <Route path="/-/profile/*" element={<ProfileMisc />} />                              {/* #43 */}
        <Route path="/-/snippets/new" element={<NewSnippet />} />                            {/* #128 */}
        <Route path="/-/ide/project/:ns/:proj/edit/:ref/-/*" element={<WebIde />} />         {/* #129 */}

        {/* ── 11/12. Groups & creation entry points ───────────────────────── */}
        <Route path="/projects/new" element={<NewProject />} />                              {/* #124-#127 */}
        <Route path="/groups/new" element={<NewGroup />} />                                  {/* #119 */}
        <Route path="/groups/:group/-/group_members" element={<GroupMembers />} />           {/* #121 */}
        <Route path="/groups/:group/-/activity" element={<GroupRollup section="activity" />} />
        <Route path="/groups/:group/-/issues" element={<GroupRollup section="issues" />} />
        <Route path="/groups/:group/-/merge_requests" element={<GroupRollup section="merge_requests" />} />
        <Route path="/groups/:group/-/milestones" element={<GroupRollup section="milestones" />} />
        <Route path="/groups/:group/-/labels" element={<GroupRollup section="labels" />} />
        <Route path="/groups/:group/-/boards" element={<GroupRollup section="boards" />} />
        <Route path="/groups/:group/-/packages" element={<GroupRollup section="packages" />} />
        <Route path="/groups/:group/edit" element={<GroupSettings />} />                     {/* #123 */}
        <Route path="/groups/:group" element={<GroupOverview />} />

        {/* ── 13. Help ────────────────────────────────────────────────────── */}
        <Route path="/help" element={<Help />} />                                            {/* #130 */}
        <Route path="/help/*" element={<Help />} />                                          {/* #131 */}

        {/* Auth surfaces are never gated — the app boots as byteblaze. */}
        <Route path="/users/sign_out" element={<RedirectWithQuery to="/" />} />
        <Route path="/users/sign_in" element={<RedirectWithQuery to="/" />} />

        {/* ── 3. User profile tabs ────────────────────────────────────────────
            ROUTES #24 — GitLab serves `/users/byteblaze` as the profile (it
            redirects to `/byteblaze`); UserProfile reads either param. */}
        <Route path="/users/:username" element={<UserProfile />} />
        <Route path="/users/:username/activity" element={<UserProfile tab="activity" />} />
        <Route path="/users/:username/groups" element={<UserProfile tab="groups" />} />
        <Route path="/users/:username/contributed" element={<UserProfile tab="contributed" />} />
        <Route path="/users/:username/projects" element={<UserProfile tab="projects" />} />
        <Route path="/users/:username/starred" element={<UserProfile tab="starred" />} />     {/* #30 */}
        <Route path="/users/:username/snippets" element={<UserProfile tab="snippets" />} />
        <Route path="/users/:username/followers" element={<UserProfile tab="followers" />} />
        <Route path="/users/:username/following" element={<UserProfile tab="following" />} /> {/* #33 */}

        {/* ── 5. Project — repository ─────────────────────────────────────────
            Every ref-bearing path is registered as a bare splat and wrapped in
            <RefRoute>, because GitLab branch names may contain `/` (see
            src/components/layout/RefRoute.jsx). The descendant `:ref/*` route
            below is what actually binds `params.ref` / `params['*']` for the
            page, so the pages are unchanged. */}
        <Route path="/:ns/:proj/-/tree/*" element={                                           /* #45/#46 */
          <RefRoute><Route path=":ref/*" element={<RepoTree />} /></RefRoute>
        } />
        <Route path="/:ns/:proj/-/blob/*" element={                                           /* #47 */
          <RefRoute><Route path=":ref/*" element={<RepoBlob />} /></RefRoute>
        } />
        <Route path="/:ns/:proj/-/blame/*" element={                                          /* #49 */
          <RefRoute><Route path=":ref/*" element={<RepoBlob blame />} /></RefRoute>
        } />
        <Route path="/:ns/:proj/-/commits" element={<RepoCommits />} />                       {/* #51 */}
        <Route path="/:ns/:proj/-/commits/*" element={                                        /* #50 */
          <RefRoute><Route path=":ref/*" element={<RepoCommits />} /></RefRoute>
        } />
        <Route path="/:ns/:proj/-/commit/:sha" element={<CommitDetail />} />                  {/* #52 */}
        <Route path="/:ns/:proj/-/branches" element={<Branches tab="overview" />} />          {/* #53 */}
        <Route path="/:ns/:proj/-/branches/active" element={<Branches tab="active" />} />
        <Route path="/:ns/:proj/-/branches/stale" element={<Branches tab="stale" />} />
        <Route path="/:ns/:proj/-/branches/all" element={<Branches tab="all" />} />
        <Route path="/:ns/:proj/-/branches/new" element={<NewBranch />} />                    {/* #54 */}
        <Route path="/:ns/:proj/-/tags" element={<Tags />} />                                 {/* #55 */}
        <Route path="/:ns/:proj/-/tags/new" element={<NewTag />} />                           {/* #56 */}
        <Route path="/:ns/:proj/-/graphs/*" element={                                         /* #57 + #58/#114 */
          <RefRoute>
            <Route path=":ref/charts" element={<RepoAnalytics />} />
            <Route path=":ref/*" element={<Contributors />} />
          </RefRoute>
        } />
        <Route path="/:ns/:proj/-/network/*" element={                                        /* #59 */
          <RefRoute><Route path=":ref/*" element={<NetworkGraph />} /></RefRoute>
        } />
        <Route path="/:ns/:proj/-/find_file/*" element={                                      /* #60 */
          <RefRoute><Route path=":ref/*" element={<FindFile />} /></RefRoute>
        } />
        <Route path="/:ns/:proj/-/compare" element={<Compare />} />                           {/* #61 */}
        <Route path="/:ns/:proj/-/new/*" element={                                            /* #62 */
          <RefRoute><Route path=":ref/*" element={<NewFile />} /></RefRoute>
        } />
        <Route path="/:ns/:proj/-/edit/*" element={                                           /* #63 */
          <RefRoute><Route path=":ref/*" element={<EditFile />} /></RefRoute>
        } />
        <Route path="/:ns/:proj/-/starrers" element={<Starrers />} />                         {/* #64 */}
        <Route path="/:ns/:proj/-/forks" element={<Forks />} />                               {/* #65 */}
        <Route path="/:ns/:proj/-/forks/new" element={<ForkProject />} />                     {/* #66 */}

        {/* ── 6. Project — issues ─────────────────────────────────────────── */}
        <Route path="/:ns/:proj/-/issues" element={<IssuesList />} />                         {/* #69 */}
        <Route path="/:ns/:proj/-/issues/new" element={<NewIssue />} />                       {/* #71 */}
        <Route path="/:ns/:proj/-/issues/service_desk" element={<ServiceDesk />} />           {/* #74 */}
        <Route path="/:ns/:proj/-/issues/:iid" element={<IssueDetail />} />                   {/* #70 */}
        <Route path="/:ns/:proj/-/issues/:iid/edit" element={<EditIssue />} />                {/* #73 */}
        <Route path="/:ns/:proj/-/boards" element={<Boards />} />                             {/* #75 */}
        <Route path="/:ns/:proj/-/incidents" element={<Incidents />} />                     {/* #76 */}
        <Route path="/:ns/:proj/-/alert_management" element={<AlertManagement />} />        {/* #76 */}

        {/* ── 7. Project — merge requests ─────────────────────────────────── */}
        <Route path="/:ns/:proj/-/merge_requests" element={<MergeRequestsList />} />          {/* #78 */}
        <Route path="/:ns/:proj/-/merge_requests/new" element={<NewMergeRequest />} />        {/* #84 */}
        <Route path="/:ns/:proj/-/merge_requests/new/diffs" element={<NewMergeRequest />} />
        <Route path="/:ns/:proj/-/merge_requests/:iid" element={<MergeRequestDetail />} />    {/* #79 */}
        <Route path="/:ns/:proj/-/merge_requests/:iid/commits" element={<MergeRequestDetail tab="commits" />} />
        <Route path="/:ns/:proj/-/merge_requests/:iid/diffs" element={<MergeRequestDetail tab="diffs" />} />
        <Route path="/:ns/:proj/-/merge_requests/:iid/pipelines" element={<MergeRequestDetail tab="pipelines" />} />
        <Route path="/:ns/:proj/-/merge_requests/:iid/edit" element={<EditMergeRequest />} /> {/* #83 */}
        <Route path="/:ns/:proj/-/merge_requests/:iid/conflicts" element={<MergeRequestDetail tab="conflicts" />} /> {/* #86 */}

        {/* ── 8. Project — labels, milestones, members ────────────────────── */}
        <Route path="/:ns/:proj/-/labels" element={<LabelsList />} />                         {/* #87 */}
        <Route path="/:ns/:proj/-/labels/new" element={<NewLabel />} />                       {/* #88 */}
        <Route path="/:ns/:proj/-/labels/:id/edit" element={<EditLabel />} />                 {/* #89 */}
        <Route path="/:ns/:proj/-/milestones" element={<MilestonesList />} />                 {/* #90 */}
        <Route path="/:ns/:proj/-/milestones/new" element={<NewMilestone />} />               {/* #91 */}
        <Route path="/:ns/:proj/-/milestones/:iid" element={<MilestoneDetail />} />           {/* #92 */}
        <Route path="/:ns/:proj/-/milestones/:iid/edit" element={<NewMilestone edit />} />    {/* #93 */}
        <Route path="/:ns/:proj/-/project_members" element={<ProjectMembers />} />            {/* #94/#95 */}

        {/* ── 9. Project — settings ───────────────────────────────────────── */}
        <Route path="/:ns/:proj/-/settings/repository" element={<ProjectSettingsRepository />} />          {/* #99 */}
        <Route path="/:ns/:proj/-/settings/merge_requests" element={<ProjectSettingsMergeRequests />} />   {/* #100 */}
        <Route path="/:ns/:proj/-/settings/ci_cd" element={<ProjectSettingsCiCd />} />                     {/* #101 */}
        <Route path="/:ns/:proj/-/settings/integrations" element={<ProjectSettingsIntegrations />} />      {/* #102 */}
        <Route path="/:ns/:proj/-/settings/access_tokens" element={<ProjectSettingsAccessTokens />} />     {/* #103 */}
        <Route path="/:ns/:proj/-/settings/operations" element={<ProjectSettingsOperations />} />          {/* #103 */}
        <Route path="/:ns/:proj/-/settings/packages_and_registries" element={<ProjectSettingsPackages />} />{/* #103 */}
        <Route path="/:ns/:proj/-/hooks" element={<ProjectHooks />} />                                     {/* #104 */}
        <Route path="/:ns/:proj/-/usage_quotas" element={<ProjectUsageQuotas />} />                        {/* #105 */}

        {/* ── 10. Project — CI/CD, analytics, registries ─────────────────── */}
        <Route path="/:ns/:proj/-/pipelines" element={<Pipelines />} />                     {/* #106 */}
        <Route path="/:ns/:proj/-/pipelines/charts" element={<PipelineCharts />} />         {/* #106 */}
        <Route path="/:ns/:proj/-/pipelines/:id" element={<PipelineDetail />} />            {/* #106 — 200 for the project's own pipeline ids, 404 otherwise, as the source does */}
        <Route path="/:ns/:proj/-/jobs" element={<Jobs />} />                               {/* #107 */}
        <Route path="/:ns/:proj/-/jobs/:id" element={<JobDetail />} />                      {/* #107 */}
        <Route path="/:ns/:proj/-/pipeline_schedules" element={<PipelineSchedules />} />    {/* #108 */}
        <Route path="/:ns/:proj/-/ci/editor" element={<PipelineEditor />} />                {/* #109 */}
        <Route path="/:ns/:proj/-/environments" element={<Environments />} />               {/* #110 */}
        <Route path="/:ns/:proj/-/releases" element={<Releases />} />                       {/* #111 */}
        <Route path="/:ns/:proj/-/packages" element={<PackageRegistry />} />                {/* #112 */}
        <Route path="/:ns/:proj/-/infrastructure_registry" element={<InfrastructureRegistry />} /> {/* #112 */}
        <Route path="/:ns/:proj/-/value_stream_analytics" element={<ProjectValueStreamAnalytics />} />     {/* #113 */}
        <Route path="/:ns/:proj/-/security/configuration" element={<ProjectSecurityConfiguration />} />    {/* #115 */}
        <Route path="/:ns/:proj/-/snippets" element={<ProjectSnippets />} />                {/* #116 */}
        <Route path="/:ns/:proj/-/snippets/new" element={<NewSnippet />} />                  {/* #116 */}
        <Route path="/:ns/:proj/-/wikis/home" element={<Wiki />} />                         {/* #117 */}
        <Route path="/:ns/:proj/-/wikis/*" element={<Wiki />} />                            {/* #117 */}
        <Route path="/:ns/:proj/-/clusters" element={<Clusters />} />                       {/* #118 */}
        <Route path="/:ns/:proj/-/terraform" element={<Terraform />} />                     {/* #118 */}
        <Route path="/:ns/:proj/-/google_cloud/configuration" element={<ServerError />} />  {/* #118 — source returns HTTP 500 here */}
        <Route path="/:ns/:proj/-/feature_flags" element={<FeatureFlags />} />              {/* #118 */}
        <Route path="/:ns/:proj/-/error_tracking" element={<ErrorTracking />} />            {/* #118 */}
        <Route path="/:ns/:proj/-/metrics" element={<Metrics />} />                         {/* #118 */}
        <Route path="/:ns/:proj/-/monitor" element={<NotFound />} />                        {/* #118 — the source 404s on this path */}

        {/* Legacy routes that sit OUTSIDE the `/-/` infix — not typos. */}
        <Route path="/:ns/:proj/edit" element={<ProjectSettingsGeneral />} />                 {/* #98 */}
        <Route path="/:ns/:proj/activity" element={<ProjectActivity />} />                  {/* #67 */}

        {/* Project overview + the bare namespace page. Both are last so every
            static segment above wins the match. */}
        <Route path="/:ns/:proj" element={<ProjectOverview />} />                             {/* #44 */}
        <Route path="/:name" element={<UserProfile />} />                                     {/* #25 / #120 */}

        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
