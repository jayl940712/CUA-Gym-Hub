import React from 'react'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import { useApp } from '../context/AppContext.jsx'
import { useProject } from './hooks.js'
import NotFound from './NotFound.jsx'

// ---------------------------------------------------------------------------
// AUDIT P1-3 — the CI/CD, Deployments, Monitor, Registry, Snippets and Wiki
// routes that used to render <Placeholder> and its literal
// "…has not been implemented yet." sentence.
//
// Every string, heading level, wrapper class and button target below was read
// off a fresh capture of the SOURCE container (`/byteblaze/dotfiles/-/…`,
// saved to /tmp/r4cap). NOTHING here is invented: this WebArena GitLab
// instance has no runners, no environments, no packages, no snippets and no
// wikis on any project, so the source serves the *bundled empty state* on
// every one of the routes still in this file, and that empty state is what the
// mock serves too.
//
// TEST.md DIFF-1105 corrected one over-generalisation in that list: the
// instance DOES have pipelines and jobs — 1 465 and 14 179 of them across 67
// projects — and `dotfiles`, the project every round-4 capture was taken from,
// is simply one of the 108 that have none. The pipelines / jobs / CI-analytics
// views moved to `PipelinesCi.jsx`; see the CI/CD note below.
//
// Two deliberate omissions, both decorative and both `alt=""`/`role="img"` on
// the source:
//   * the illustration <img> (`/assets/illustrations/*.svg`) — vendoring ~15
//     SVGs off the container for pages no task reaches is not worth the bytes,
//     and an <img> pointing at the container would be a runtime network call
//     the migration contract forbids;
//   * GitLab's Vue `<!---->` placeholder comments.
// The `.svg-content` wrapper is kept where the source has one so the layout
// spacing survives.
//
// Documentation links keep the source's own `/help/...` hrefs (the mock serves
// a help shell); `about.gitlab.com` / `console.cloud.google.com` links are kept
// verbatim because the source renders them as plain external anchors and no
// navigation happens until an agent clicks one.
// ---------------------------------------------------------------------------

/** Standard project page shell: resolves `/:ns/:proj` and sets the title. */
function useOpsPage(suffix) {
  const { state } = useApp()
  const { project, base } = useProject()
  usePageChrome({
    title: project
      ? `${suffix} · ${project.namespace.name} / ${project.name} · GitLab`
      : 'GitLab',
  })
  return { ready: Boolean(state), project, base }
}

/**
 * The `section.empty-state` block GitLab's Vue pages share
 * (`gl-display-flex empty-state gl-text-center gl-flex-direction-column`),
 * with the `h1.gl-font-size-h-display…h4` heading it always uses.
 */
export function GlEmptyState({ title, children, actions, testid }) {
  return (
    <section className="gl-display-flex empty-state gl-text-center gl-flex-direction-column"
      data-testid={testid}>
      <div className="gl-max-w-full"><div className="svg-250 svg-content" /></div>
      <div className="gl-max-w-full gl-m-auto">
        <div className="gl-mx-auto gl-my-0 gl-p-5">
          <h1 className="gl-font-size-h-display gl-line-height-36 h4">{title}</h1>
          <p className="gl-mt-3">{children}</p>
          <div className="gl-display-flex gl-flex-wrap gl-justify-content-center">{actions}</div>
        </div>
      </div>
    </section>
  )
}

/** `ul.gl-tabs-nav` with a muted count pill — the shape every list page uses. */
function GlTabs({ tabs, extra }) {
  return (
    <div className="tabs gl-tabs">
      <div>
        <ul role="tablist" className="nav gl-tabs-nav">
          {tabs.map((t, i) => (
            <li role="presentation" className="nav-item" key={t.label}>
              <a role="tab" aria-selected={i === 0} href="#"
                onClick={e => e.preventDefault()}
                className={`nav-link gl-tab-nav-item${i === 0 ? ' active gl-tab-nav-item-active' : ''}`}>
                <span>{t.label}</span>
                {t.count === undefined ? null : (
                  <span className="badge gl-tab-counter-badge badge-muted badge-pill gl-badge sm">
                    {` ${t.count} `}
                  </span>
                )}
              </a>
            </li>
          ))}
          {extra}
        </ul>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------ CI/CD ---
//
// TEST.md DIFF-1105 — `Pipelines`, `PipelineCharts` and `Jobs` used to live
// here and rendered the empty state unconditionally, because the round-4
// capture they were built from was `byteblaze/dotfiles`, the one sampled
// project with no pipelines. 67 of the 175 seeded projects DO have pipelines,
// so those three views (plus `/-/pipelines/:id` and `/-/jobs/:id`) now live in
// `PipelinesCi.jsx` and read the real seed. `PipelineSchedules`,
// `PipelineEditor` and everything below them are unchanged: the source really
// does serve a bundled empty state for those on every project.

/** ROUTES #108 — `/:ns/:proj/-/pipeline_schedules`. */
export function PipelineSchedules() {
  const { ready, project, base } = useOpsPage('Pipeline Schedules')
  const [dismissed, setDismissed] = React.useState(false)
  if (!ready) return null
  if (!project) return <NotFound />
  return (
    <div>
      {dismissed ? null : (
        <div className="pipeline-schedules-user-callout user-callout">
          <div data-testid="innerContent" className="bordered-box landing content-block gl-p-5!">
            <button aria-label="Dismiss" type="button" onClick={() => setDismissed(true)}
              className="btn gl-absolute gl-top-2 gl-right-2 btn-default btn-md gl-button btn-default-tertiary btn-icon">
              <Icon name="close" />
            </button>
            <div className="user-callout-copy">
              <h4>Scheduling Pipelines</h4>
              <p>
                The pipelines schedule runs pipelines in the future, repeatedly, for specific
                branches or tags. Those scheduled pipelines will inherit limited project access
                based on their associated user.
              </p>
              <p>
                {'Learn more in the '}
                <a href="/help/ci/pipelines/schedules">pipeline schedules documentation</a>.
              </p>
            </div>
          </div>
        </div>
      )}
      <div className="top-area">
        <ul className="gl-display-flex gl-flex-grow-1 gl-border-0 nav gl-tabs-nav">
          {[['All', `${base}/-/pipeline_schedules`], ['Active', `${base}/-/pipeline_schedules?scope=active`],
            ['Inactive', `${base}/-/pipeline_schedules?scope=inactive`]].map(([label, href], i) => (
              <li className="nav-item" key={label}>
                <a className={`nav-link gl-tab-nav-item${i === 0 ? ' active gl-tab-nav-item-active' : ''}`}
                  href={href}>
                  {label}
                  <span className="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge">0</span>
                </a>
              </li>
            ))}
        </ul>
        <div className="nav-controls">
          <a className="btn gl-button btn-confirm" href={`${base}/-/pipeline_schedules/new`}>
            <span>New schedule</span>
          </a>
        </div>
      </div>
      <div className="nothing-here-block">No schedules</div>
    </div>
  )
}

/** ROUTES #109 — `/:ns/:proj/-/ci/editor`. */
export function PipelineEditor() {
  const { ready, project } = useOpsPage('Pipeline Editor')
  if (!ready) return null
  if (!project) return <NotFound />
  return (
    <div data-qa-selector="pipeline_editor_app" className="gl-mt-4 gl-relative">
      <div className="gl-display-flex gl-flex-direction-column gl-align-items-center gl-mt-11">
        <div className="gl-display-flex gl-flex-direction-column gl-align-items-center">
          <h1 className="gl-font-size-h1">Optimize your workflow with CI/CD Pipelines</h1>
          <p className="gl-mt-3">
            {'Create a new '}<code>.gitlab-ci.yml</code>
            {' file at the root of the repository to get started.'}
          </p>
          <button data-qa-selector="create_new_ci_button" type="button"
            className="btn gl-mt-3 btn-confirm btn-md gl-button">
            <span className="gl-button-text">Configure pipeline</span>
          </button>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------ Deployments ---

/** ROUTES #110 — `/:ns/:proj/-/environments`. */
export function Environments() {
  const { ready, project, base } = useOpsPage('Environments')
  const [search, setSearch] = React.useState('')
  if (!ready) return null
  if (!project) return <NotFound />
  const actions = (
    <div data-testid="actions-tabs-end" className="gl-actions-tabs-end">
      <button data-testid="action-primary" type="button"
        className="btn btn-confirm btn-md gl-button btn-confirm-secondary">
        <span className="gl-button-text">Enable review app</span>
      </button>
      <a data-testid="action-secondary" href={`${base}/-/environments/new`}
        className="btn btn-confirm btn-md gl-button">
        <span className="gl-button-text">New environment</span>
      </a>
    </div>
  )
  return (
    <div>
      <GlTabs tabs={[{ label: 'Available', count: 0 }, { label: 'Stopped', count: 0 }]}
        extra={actions} />
      <div className="gl-search-box-by-type gl-mb-4">
        <Icon name="search" />
        <input type="search" placeholder="Search by environment name"
          aria-label="Search by environment name"
          className="gl-form-input gl-search-box-by-type-input form-control"
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>
      <section className="gl-display-flex empty-state gl-text-center gl-flex-direction-column">
        <div className="gl-max-w-full"><div className="svg-250 svg-content" /></div>
        <div className="gl-max-w-full gl-m-auto">
          <div className="gl-mx-auto gl-my-0 gl-p-5">
            <h4>You don&apos;t have any environments.</h4>
            <p className="gl-mt-3">
              Environments are places where code gets deployed, such as staging or production.
            </p>
            <div className="gl-display-flex gl-flex-wrap gl-justify-content-center">
              <a href="/help/ci/environments/index.md" className="gl-link">
                How do I create an environment?
              </a>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

// ROUTES #111 — `/:ns/:proj/-/releases` MOVED to `src/pages/Releases.jsx`.
// It was an unconditional empty state here; the instance has 1 732 releases
// over 48 projects, so it needed the real card list. The empty state itself is
// unchanged and still serves the 127 projects that have none — it now lives in
// `Releases.jsx` and re-uses the `GlEmptyState` exported from this file.

/** ROUTES #118 — `/:ns/:proj/-/feature_flags`. */
export function FeatureFlags() {
  const { ready, project, base } = useOpsPage('Feature Flags')
  if (!ready) return null
  if (!project) return <NotFound />
  const buttons = (
    <>
      <a data-testid="ff-user-list-button" href={`${base}/-/feature_flags_user_lists`}
        className="btn gl-mb-0 gl-mr-3 btn-confirm btn-md gl-button btn-confirm-tertiary">
        <span className="gl-button-text">View user lists</span>
      </a>
      <button data-qa-selector="configure_feature_flags_button" data-testid="ff-configure-button"
        type="button" className="btn gl-mb-0 gl-mr-3 btn-confirm btn-md gl-button btn-confirm-secondary">
        <span className="gl-button-text">Configure</span>
      </button>
      <a data-testid="ff-new-button" href={`${base}/-/feature_flags/new`}
        className="btn btn-confirm btn-md gl-button">
        <span className="gl-button-text">New feature flag</span>
      </a>
    </>
  )
  return (
    <div className="gl-display-flex gl-flex-direction-column">
      <div className="gl-display-flex gl-align-items-baseline gl-flex-direction-row gl-justify-content-space-between gl-mt-6">
        <div className="gl-display-flex gl-align-items-center">
          <h2 data-testid="feature-flags-tab-title" className="page-title gl-font-size-h-display gl-my-0">
            Feature Flags
          </h2>
        </div>
        <div className="gl-display-flex gl-align-items-center gl-justify-content-end">{buttons}</div>
      </div>
      <div data-testid="feature-flags-tab">
        <GlEmptyState title="Get started with feature flags" testid="empty-state"
          actions={null}>
          {'Feature flags allow you to configure your code into different flavors by dynamically '}
          {'toggling certain functionality. '}
          <a href="/help/operations/feature_flags" className="gl-link">More information</a>
        </GlEmptyState>
      </div>
    </div>
  )
}

// --------------------------------------------------------------- Registry ---

/** ROUTES #112 — `/:ns/:proj/-/packages`. */
export function PackageRegistry() {
  const { ready, project } = useOpsPage('Package Registry')
  const [banner, setBanner] = React.useState(true)
  const [filter, setFilter] = React.useState('')
  if (!ready) return null
  if (!project) return <NotFound />
  return (
    <div className="row"><div className="col-12">
      {banner ? (
        <div className="gl-card gl-px-8 gl-py-6 gl-line-height-20 gl-mt-3">
          <div className="gl-card-body gl-display-flex gl-p-0!">
            <div className="gl-banner-content">
              <h2 className="gl-banner-title">Help us learn about your registry migration needs</h2>
              <p>
                If you are interested in migrating packages from your private registry to the
                GitLab Package Registry, take our survey and tell us more about your needs.
              </p>
              <a data-testid="gl-banner-primary-button"
                href="https://gitlab.fra1.qualtrics.com/jfe/form/SV_cHomH9FPzOaiDTU"
                className="btn btn-confirm btn-md gl-button">
                <span className="gl-button-text">Take survey</span>
              </a>
            </div>
            <button aria-label="Close banner" type="button" onClick={() => setBanner(false)}
              className="btn gl-banner-close btn-default btn-sm gl-button btn-default-tertiary btn-icon">
              <Icon name="close" />
            </button>
          </div>
        </div>
      ) : null}
      <div className="gl-display-flex gl-flex-direction-column">
        <div className="gl-display-flex gl-justify-content-space-between gl-py-3">
          <div className="gl-flex-direction-column gl-flex-grow-1">
            <h2 data-testid="title" className="gl-font-size-h1 gl-mt-3 gl-mb-0">Package Registry</h2>
            <div className="gl-display-flex gl-flex-wrap gl-align-items-center gl-mt-3">
              <div className="gl-display-inline-flex gl-align-items-center">
                <Icon name="package" />
                <div data-testid="metadata-item-text" className="gl-font-weight-bold gl-display-inline-flex mw-s">
                  <span className="gl-min-w-0 gl-text-truncate">0 Packages</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="gl-display-flex gl-p-5 gl-bg-gray-10 gl-border-solid gl-border-1 gl-border-gray-100 gl-mb-5">
        <div role="group" className="input-group gl-search-box-by-click gl-mr-4 gl-flex-grow-1"
          data-testid="filtered-search-input">
          <input placeholder="Filter results" aria-label="Filter results"
            data-testid="filtered-search-term-input" className="gl-filtered-search-term-input"
            value={filter} onChange={e => setFilter(e.target.value)} />
          <div className="input-group-append">
            <button aria-label="Search" data-testid="search-button" type="button"
              className="btn gl-search-box-by-click-search-button btn-default btn-md gl-button btn-icon">
              <Icon name="search" />
            </button>
          </div>
        </div>
      </div>
      <table className="gl-w-full">
        <thead><tr>
          <th>Name</th><th>Version</th><th>Type</th><th>Published</th>
        </tr></thead>
        <tbody />
      </table>
      <GlEmptyState title="There are no packages yet">
        {'Learn how to '}
        <a href="/help/user/packages/index" className="gl-link">publish and share your packages</a>
        {' with GitLab.'}
      </GlEmptyState>
    </div></div>
  )
}

/** ROUTES #112 — `/:ns/:proj/-/infrastructure_registry`. */
export function InfrastructureRegistry() {
  const { ready, project } = useOpsPage('Infrastructure Registry')
  if (!ready) return null
  if (!project) return <NotFound />
  return (
    <div className="row"><div className="col-12">
      <div className="gl-display-flex gl-flex-direction-column">
        <div className="gl-display-flex gl-justify-content-space-between gl-py-3">
          <h2 data-testid="title" className="gl-font-size-h1 gl-mt-3 gl-mb-0">
            Infrastructure Registry
          </h2>
        </div>
      </div>
      <GlEmptyState title="You have no Terraform modules in your project">
        {'Terraform modules are the main way to package and reuse resource configurations with '}
        {'Terraform. Learn more about how to '}
        <a href="/help/user/infrastructure/index" className="gl-link">create Terraform modules</a>
        {' in GitLab.'}
      </GlEmptyState>
    </div></div>
  )
}

/** ROUTES #118 — `/:ns/:proj/-/terraform`. */
export function Terraform() {
  const { ready, project } = useOpsPage('Terraform')
  if (!ready) return null
  if (!project) return <NotFound />
  return (
    <section>
      <GlTabs tabs={[{ label: 'States' }]} />
      <GlEmptyState title="Your project doesn't have any Terraform state files">
        <a href="/help/user/infrastructure/iac/terraform_state" className="gl-link">
          How to use GitLab-managed Terraform state?
        </a>
      </GlEmptyState>
    </section>
  )
}

/** ROUTES #118 — `/:ns/:proj/-/clusters`. */
export function Clusters() {
  const { ready, project } = useOpsPage('Kubernetes Clusters')
  const [offer, setOffer] = React.useState(true)
  if (!ready) return null
  if (!project) return <NotFound />
  return (
    <div>
      {offer ? (
        <section className="no-animate expanded">
          <div className="gl-alert gcp-signup-offer gl-alert-info" role="alert">
            <button aria-label="Dismiss" onClick={() => setOffer(false)} type="button"
              className="btn gl-dismiss-btn btn-default btn-sm gl-button btn-default-tertiary btn-icon js-close">
              <Icon name="close" />
            </button>
            <div className="gl-alert-content">
              <h4 className="gl-alert-title">Did you know?</h4>
              <div className="gl-alert-body">
                {'Every new Google Cloud Platform (GCP) account receives $300 in credit upon '}
                <a target="_blank" rel="noopener noreferrer"
                  href="https://console.cloud.google.com/freetrial?utm_campaign=2018_cpanel&utm_source=gitlab&utm_medium=referral">sign up</a>
                {`. In partnership with Google, GitLab is able to offer an additional $200 for both new and existing GCP accounts to get started with GitLab's Google Kubernetes Engine Integration.`}
              </div>
              <div className="gl-alert-actions">
                <a rel="noopener noreferrer" className="gl-button btn btn-md btn-confirm" target="_blank"
                  href="https://cloud.google.com/partners/partnercredit/?pcn_code=0014M00001h35gDQAQ#contact-form">
                  <span className="gl-button-text">Apply for credit</span>
                </a>
              </div>
            </div>
          </div>
        </section>
      ) : null}
      <div className="clusters-container">
        <div className="gl-my-6">
          <GlTabs tabs={[{ label: 'Agent' }]} extra={(
            <div className="nav-controls gl-ml-auto">
              <button type="button" className="btn btn-confirm btn-md gl-button split-content-button">
                <span className="gl-dropdown-button-text">Connect a cluster</span>
              </button>
              <button aria-haspopup="true" type="button"
                className="btn dropdown-toggle btn-confirm btn-md gl-button gl-dropdown-toggle dropdown-toggle-split">
                <span className="sr-only">Toggle dropdown</span>
              </button>
            </div>
          )} />
          <div className="gl-mt-5 gl-text-center">
            <p>
              {'Use the '}
              <a href="/help/user/clusters/agent/index" className="gl-link">GitLab agent</a>
              {' to safely connect your Kubernetes clusters to GitLab. You can deploy your '}
              {'applications, run your pipelines, use Review Apps, and much more.'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- Monitor ---

/** ROUTES #76 — `/:ns/:proj/-/incidents`. */
export function Incidents() {
  const { ready, project, base } = useOpsPage('Incidents')
  if (!ready) return null
  if (!project) return <NotFound />
  return (
    <div className="incident-management-list">
      <div className="list-header gl-display-flex gl-justify-content-space-between gl-border-b-solid gl-border-b-1 gl-border-gray-100">
        <GlTabs tabs={[
          { label: 'Open', count: 0 }, { label: 'Closed', count: 0 }, { label: 'All', count: 0 },
        ]} />
      </div>
      <GlEmptyState title="Display your incidents in a dedicated view"
        actions={<a href={`${base}/-/issues/new?issuable_template=incident`}
          className="btn btn-confirm btn-md gl-button">
          <span className="gl-button-text">Create incident</span></a>}>
        {'All alerts promoted to incidents are automatically displayed within the list. '}
        {'You can also create a new incident using the button below.'}
      </GlEmptyState>
    </div>
  )
}

/** ROUTES #76 — `/:ns/:proj/-/alert_management`. */
export function AlertManagement() {
  const { ready, project, base } = useOpsPage('Alerts')
  if (!ready) return null
  if (!project) return <NotFound />
  return (
    <div>
      <GlEmptyState title="Surface alerts in GitLab">
        <span className="gl-display-block">
          <span>
            Display alerts from all your monitoring tools directly within GitLab. Streamline the
            investigation of your alerts and the escalation of alerts to incidents.
          </span>
          <a href="/help/operations/incident_management/alerts.md" className="gl-link">
            More information
          </a>
        </span>
        <span className="gl-display-block center gl-pt-4">
          <a href={`${base}/-/settings/operations#js-alert-management-settings`}
            className="btn btn-confirm btn-md gl-button">
            <span className="gl-button-text">Authorize external service</span>
          </a>
        </span>
      </GlEmptyState>
    </div>
  )
}

/** ROUTES #118 — `/:ns/:proj/-/error_tracking`. */
export function ErrorTracking() {
  const { ready, project, base } = useOpsPage('Errors')
  if (!ready) return null
  if (!project) return <NotFound />
  return (
    <div className="error-list">
      <GlEmptyState title="Get started with error tracking"
        actions={<a href={`${base}/-/settings/operations`}
          className="btn gl-mb-3 btn-confirm btn-md gl-button gl-mx-2">
          <span className="gl-button-text">Enable error tracking</span></a>}>
        Monitor your errors by integrating with Sentry.
      </GlEmptyState>
    </div>
  )
}

/** ROUTES #118 — `/:ns/:proj/-/metrics`. Note the Haml `.row.empty-state` shape. */
export function Metrics() {
  const { ready, project } = useOpsPage('Metrics')
  if (!ready) return null
  if (!project) return <NotFound />
  return (
    <div className="row empty-state">
      <div className="col-sm-12"><div className="svg-content" /></div>
      <div className="col-12">
        <div className="text-content">
          <h4 className="text-center">No deployed environments</h4>
          <p className="state-description">
            Check out the CI/CD documentation on deploying to an environment
          </p>
          <div className="text-center">
            <a className="gl-button btn btn-confirm" href="/help/ci/environments/index.md">
              Learn about environments
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------- Snippets · Wiki ----

/** ROUTES #116 — `/:ns/:proj/-/snippets`. */
export function ProjectSnippets() {
  const { ready, project, base } = useOpsPage('Snippets')
  const { state } = useApp()
  if (!ready) return null
  if (!project) return <NotFound />
  const rows = (state.snippets || []).filter(s => s.project_id === project.id)
  if (rows.length) {
    return (
      <ul className="content-list">
        {rows.map(s => (
          <li key={s.id} className="snippet-row">
            <a className="title" href={`${base}/-/snippets/${s.id}`}>{s.title}</a>
          </li>
        ))}
      </ul>
    )
  }
  return (
    <div className="row empty-state">
      <div className="col-12">
        <div className="svg-content" data-qa-selector="svg_content" />
        <div className="text-content gl-text-center gl-pt-0">
          <h4>Code snippets</h4>
          <p className="gl-mb-0">Store, share, and embed small pieces of code and text.</p>
          <div className="gl-mt-3">
            <a className="btn gl-button btn-confirm" title="New snippet" id="new_snippet_link"
              data-qa-selector="create_first_snippet_link" href={`${base}/-/snippets/new`}>
              New snippet
            </a>
            <a className="btn gl-button btn-default" title="Documentation" href="/help/user/snippets.md">
              Documentation
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}

/** ROUTES #117 — `/:ns/:proj/-/wikis/*`. */
export function Wiki() {
  const { ready, project, base } = useOpsPage('Wiki')
  if (!ready) return null
  if (!project) return <NotFound />
  // No project on this instance has a wiki page, so the source always serves
  // `shared/empty_states/_wikis.html.haml`.
  return (
    <div className="row empty-state empty-state-wiki">
      <div className="col-12">
        <div className="svg-content" data-qa-selector="svg_content" />
      </div>
      <div className="col-12">
        <div className="text-content text-center">
          <h4 className="text-left">The wiki lets you write documentation for your project</h4>
          <p className="text-left">
            {`A wiki is where you can store all the details about your project. This can include why you've created it, its principles, how to use it, and so on. Have a Confluence wiki already? Use that instead.`}
          </p>
          <a className="btn gl-button btn-confirm" title="Create your first page"
            data-qa-selector="create_first_page_link" href={`${base}/-/wikis/home?view=create`}>
            Create your first page
          </a>
          <a className="btn gl-button" title="Enable the Confluence Wiki integration"
            href={`${base}/-/settings/integrations/confluence/edit`}>
            Enable the Confluence Wiki integration
          </a>
        </div>
      </div>
    </div>
  )
}

// --------------------------------------------------------------- Activity ---

/**
 * ROUTES #67 — `/:ns/:proj/activity` (legacy path, NO `/-/` infix; the source
 * serves it 200, it is not a redirect).
 *
 * `assets/README.md` and TEST BUG-A08 both recorded that byteblaze has zero
 * rows in the source's `events` table, so the source shows `No activities
 * found` here. The eight filter tabs are real links and all point back at this
 * same path on the source — GitLab drives them over XHR — so they are rendered
 * as the source renders them.
 */
export function ProjectActivity() {
  const { ready, project, base } = useOpsPage('Activity')
  const [active, setActive] = React.useState('all')
  const { state } = useApp()
  if (!ready) return null
  if (!project) return <NotFound />

  const TABS = [
    ['all', 'all_event_filter', 'Filter by all', 'All'],
    ['push', 'push_event_filter', 'Filter by push events', 'Push events'],
    ['merged', 'merged_event_filter', 'Filter by merge events', 'Merge events'],
    ['issue', 'issue_event_filter', 'Filter by issue events', 'Issue events'],
    ['comments', 'comments_event_filter', 'Filter by comments', 'Comments'],
    ['wiki', 'wiki_event_filter', 'Filter by wiki', 'Wiki'],
    ['designs', 'designs_event_filter', 'Filter by designs', 'Designs'],
    ['team', 'team_event_filter', 'Filter by team', 'Team'],
  ]
  const events = (state.events || []).filter(e => e.project_id === project.id)

  return (
    <div>
      <div className="nav-block d-none d-sm-flex activities gl-static">
        <div className="scrolling-tabs-container inner-page-scroll-tabs is-smaller flex-fill">
          <ul className="nav-links event-filter scrolling-tabs nav nav-tabs is-initialized">
            {TABS.map(([key, id, title, label]) => (
              <li className={active === key ? 'active' : ''} key={key}>
                <a className="event-filter-link" id={id} title={title}
                  href={`${base}/activity`}
                  onClick={e => { e.preventDefault(); setActive(key) }}>
                  <span>{` ${label}`}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="content_list project-activity" data-href={`${base}/activity`}>
        {events.length ? (
          <ul className="content-list">
            {events.map(e => <li key={e.id}>{e.action}</li>)}
          </ul>
        ) : (
          <div className="nothing-here-block">
            <div className="svg-content">
              <div className="text-content"><h5>No activities found</h5></div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * `/:ns/:proj/-/google_cloud/configuration` — the SOURCE returns HTTP 500 here
 * (the Google Cloud integration is not configured on this instance), rendering
 * Rails' static `public/500.html`. Reproduced verbatim rather than 404-ing,
 * because the two are different observations and an agent can tell them apart.
 */
export function ServerError() {
  usePageChrome({ title: 'Something went wrong (500)' })
  return (
    <div className="error-page-500">
      <h1>500</h1>
      <div className="container">
        <h3>Whoops, something went wrong on our end.</h3>
        <hr />
        <p>Try refreshing the page, or going back and attempting the action again.</p>
        <p>Please contact your GitLab administrator if this problem persists.</p>
        <a href="#" className="js-go-back go-back"
          onClick={e => { e.preventDefault(); window.history.back() }}>Go back</a>
      </div>
    </div>
  )
}
