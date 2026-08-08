import React, { useState } from 'react'
import { useApp } from '../context/AppContext.jsx'
import { usePageChrome } from '../components/layout/Layout.jsx'
import Icon from '../components/layout/Icon.jsx'
import NotFound from './NotFound.jsx'
import { useProject } from './hooks.js'
import { Section } from './ProjectSettingsGeneral.jsx'
import { useProjectSettings } from './projectSettingsStore.js'
import { instanceOrigin } from '../utils/instance.js'

// ---------------------------------------------------------------------------
// ROUTES #100–#105, #113, #115 — the remaining project routes that rendered
// <Placeholder>.
//
// Source of every string, in order of use:
//   #100 /-/settings/merge_requests        assets/html/r4-set-mr.html
//   #101 /-/settings/ci_cd                 assets/html/r4-set-cicd.html
//   #102 /-/settings/integrations          assets/html/r4-set-integrations.html
//   #103 /-/settings/access_tokens         assets/html/r4-set-tokens.html
//        /-/settings/operations            assets/html/r4-set-operations.html
//        /-/settings/packages_and_registries  assets/html/r4-set-packages.html
//   #104 /-/hooks                          assets/html/r4-hooks.html
//   #105 /-/usage_quotas                   assets/html/r4-usage.html
//   #113 /-/value_stream_analytics         assets/html/r4-vsa.html
//   #115 /-/security/configuration         assets/html/r4-sec-config.html
//
// All ten captures are LOGGED IN as byteblaze on `byteblaze/dotfiles`. Where
// the source shows an empty state (no variables, no triggers, no webhooks, no
// integrations activated, no runners, "We don't have enough data to show this
// stage") the mock shows that same empty state, and the form above it works so
// an agent can move off it. Host-shaped strings go through instanceOrigin() —
// the captures contain the container's own `http://10.186.197.203:8023`, which
// must never be baked in (see src/utils/instance.js).
// ---------------------------------------------------------------------------

function Help({ href, children }) {
  return <a href={href} rel="noopener noreferrer">{children}</a>
}

function Hint({ children }) {
  return <span className="form-text text-muted">{children}</span>
}

/**
 * `usePageChrome` + project resolution, shared by every page in this file.
 *
 * TEST.md DIFF-1103 — the `titlePrefix` each caller passes is now the verbatim
 * leading segment of the matching capture's `<title>` in `assets/html/`
 * (`r4-set-{cicd,mr,integrations,tokens,operations,packages}.html`,
 * `proj-settings-repo.html`). GitLab does NOT use one template here: `· Settings ·`
 * lands in a different place on different pages, and `ci_cd` even repeats itself
 * (`CI/CD Settings · CI/CD · Settings · …`). Reproducing that is cheaper than
 * inventing a consistent rule the source does not have.
 */
function useSettingsPage(titlePrefix) {
  const { state } = useApp()
  const { project, base } = useProject()
  usePageChrome({
    title: project
      ? `${titlePrefix} · ${project.namespace.name} / ${project.name} · GitLab`
      : 'GitLab',
    limited: true,
  })
  return { ready: Boolean(state), project, base }
}

function Radio({ name, id, value, checked, onChange, label, children }) {
  return (
    <div className="form-check gl-form-radio custom-control custom-radio">
      <input type="radio" className="custom-control-input" name={name} id={id} value={value}
        checked={checked} onChange={onChange} />
      <label className="custom-control-label" htmlFor={id}>
        {label}
        {children ? <Hint>{children}</Hint> : null}
      </label>
    </div>
  )
}

function Check({ id, checked, onChange, label, children }) {
  return (
    <div className="form-check gl-form-checkbox custom-control custom-checkbox">
      <input type="checkbox" className="custom-control-input" id={id} checked={checked} onChange={onChange} />
      <label className="custom-control-label" htmlFor={id}>
        {label}
        {children ? <Hint>{children}</Hint> : null}
      </label>
    </div>
  )
}

// ===========================================================================
// ROUTES #100 — /:ns/:proj/-/settings/merge_requests
// ===========================================================================

const DEFAULT_MERGE = {
  method: 'merge',
  resolveOutdated: false,
  showLinkOnPush: true,
  deleteSourceBranch: true,
  squash: 'default_off',
  pipelinesMustSucceed: false,
  allowSkippedPipeline: false,
  resolveThreads: false,
  suggestionTemplate: '',
  mergeCommitTemplate: "Merge branch '%{source_branch}' into '%{target_branch}'\n\n%{title}\n\n%{issues}\n\nSee merge request %{reference}",
  squashCommitTemplate: '%{title}',
}

export function ProjectSettingsMergeRequests() {
  const { ready, project } = useSettingsPage('Merge requests · Settings')
  const [settings, patch] = useProjectSettings(project)
  const saved = settings.merge || DEFAULT_MERGE
  const [form, setForm] = useState(saved)
  const [flash, setFlash] = useState(false)
  const set = (k, v) => { setForm(f => ({ ...f, [k]: v })); setFlash(false) }

  if (!ready) return null
  if (!project) return <NotFound />

  return (
    <Section id="js-merge-request-settings" title="Merge requests" defaultExpanded
      description="Choose your merge method, merge options, merge checks, and merge suggestions.">
      {flash ? (
        <div className="gl-alert gl-alert-info"><div className="gl-alert-content">
          <div className="gl-alert-body">Project settings were successfully updated.</div>
        </div></div>
      ) : null}
      <form onSubmit={e => { e.preventDefault(); patch({ merge: form }); setFlash(true) }}>
        <fieldset className="form-group">
          <legend className="col-form-label">Merge method</legend>
          <Hint>
            Determine what happens to the commit history when you merge a merge request.
            {' '}
            <Help href="/help/user/project/merge_requests/methods/index.md">How do they differ?</Help>
          </Hint>
          <Radio name="merge_method" id="project_merge_method_merge" value="merge"
            checked={form.method === 'merge'} onChange={() => set('method', 'merge')} label="Merge commit">
            Every merge creates a merge commit.
          </Radio>
          <Radio name="merge_method" id="project_merge_method_rebase_merge" value="rebase_merge"
            checked={form.method === 'rebase_merge'} onChange={() => set('method', 'rebase_merge')}
            label="Merge commit with semi-linear history">
            Every merge creates a merge commit.Merging is only allowed when the source branch is up-to-date with its target.When semi-linear merge is not possible, the user is given the option to rebase.
          </Radio>
          <Radio name="merge_method" id="project_merge_method_ff" value="ff"
            checked={form.method === 'ff'} onChange={() => set('method', 'ff')} label="Fast-forward merge">
            No merge commits are created.Fast-forward merges only.When there is a merge conflict, the user is given the option to rebase.If merge trains are enabled, merging is only possible if the branch can be rebased without conflicts.
            {' '}
            <Help href="/help/ci/pipelines/merge_trains.md#enable-merge-trains">What are merge trains?</Help>
          </Radio>
        </fieldset>

        <fieldset className="form-group">
          <legend className="col-form-label">Merge options</legend>
          <Hint>Additional settings that influence how and when merges are done.</Hint>
          <Check id="project_resolve_outdated_diff_discussions" checked={form.resolveOutdated}
            onChange={e => set('resolveOutdated', e.target.checked)}
            label="Automatically resolve merge request diff threads when they become outdated" />
          <Check id="project_printing_merge_request_link_enabled" checked={form.showLinkOnPush}
            onChange={e => set('showLinkOnPush', e.target.checked)}
            label="Show link to create or view a merge request when pushing from the command line" />
          <Check id="project_remove_source_branch_after_merge" checked={form.deleteSourceBranch}
            onChange={e => set('deleteSourceBranch', e.target.checked)}
            label={'Enable "Delete source branch" option by default'}>
            Existing merge requests and protected branches are not affected.
          </Check>
        </fieldset>

        <fieldset className="form-group">
          <legend className="col-form-label">Squash commits when merging</legend>
          <Hint>Set the default behavior of this option in merge requests. Changes to this are also applied to existing merge requests.</Hint>
          <Hint>
            <Help href="/help/user/project/merge_requests/squash_and_merge.md">What is squashing?</Help>
          </Hint>
          <Radio name="squash_option" id="project_squash_option_never" value="never"
            checked={form.squash === 'never'} onChange={() => set('squash', 'never')} label="Do not allow">
            Squashing is never performed and the checkbox is hidden.
          </Radio>
          <Radio name="squash_option" id="project_squash_option_default_off" value="default_off"
            checked={form.squash === 'default_off'} onChange={() => set('squash', 'default_off')} label="Allow">
            Checkbox is visible and unselected by default.
          </Radio>
          <Radio name="squash_option" id="project_squash_option_default_on" value="default_on"
            checked={form.squash === 'default_on'} onChange={() => set('squash', 'default_on')} label="Encourage">
            Checkbox is visible and selected by default.
          </Radio>
          <Radio name="squash_option" id="project_squash_option_always" value="always"
            checked={form.squash === 'always'} onChange={() => set('squash', 'always')} label="Require">
            Squashing is always performed. Checkbox is visible and selected, and users cannot change it.
          </Radio>
        </fieldset>

        <fieldset className="form-group">
          <legend className="col-form-label">Merge checks</legend>
          <Hint>These checks must pass before merge requests can be merged.</Hint>
          <Check id="project_only_allow_merge_if_pipeline_succeeds" checked={form.pipelinesMustSucceed}
            onChange={e => set('pipelinesMustSucceed', e.target.checked)} label="Pipelines must succeed">
            Merge requests can&apos;t be merged if the latest pipeline did not succeed or is still running.
          </Check>
          <Check id="project_allow_merge_on_skipped_pipeline" checked={form.allowSkippedPipeline}
            onChange={e => set('allowSkippedPipeline', e.target.checked)}
            label="Skipped pipelines are considered successful">
            Introduces the risk of merging changes that do not pass the pipeline.
          </Check>
          <Check id="project_only_allow_merge_if_all_discussions_are_resolved" checked={form.resolveThreads}
            onChange={e => set('resolveThreads', e.target.checked)} label="All threads must be resolved" />
        </fieldset>

        <fieldset className="form-group">
          <legend className="col-form-label">Merge suggestions</legend>
          <label htmlFor="project_suggestion_commit_message">The commit message used when applying merge request suggestions.</label>
          <input type="text" className="form-control gl-form-input" id="project_suggestion_commit_message"
            maxLength={255} value={form.suggestionTemplate}
            onChange={e => set('suggestionTemplate', e.target.value)} />
          <Hint>Leave empty to use default template.</Hint>
          <Hint>Maximum 255 characters.</Hint>
          <Hint>
            <Help href="/help/user/project/merge_requests/reviews/suggestions.md#configure-the-commit-message-for-applied-suggestions">What variables can I use?</Help>
          </Hint>
        </fieldset>

        <div className="form-group">
          <label htmlFor="project_merge_commit_template">Merge commit message template</label>
          <Hint>The commit message used when merging, if the merge method creates a merge commit.</Hint>
          <textarea className="form-control gl-form-input" id="project_merge_commit_template" rows={5}
            maxLength={500} value={form.mergeCommitTemplate}
            onChange={e => set('mergeCommitTemplate', e.target.value)} />
          <Hint>Leave empty to use default template.</Hint>
          <Hint>Maximum 500 characters.</Hint>
          <Hint>
            <Help href="/help/user/project/merge_requests/commit_templates.md">What variables can I use?</Help>
          </Hint>
        </div>

        <div className="form-group">
          <label htmlFor="project_squash_commit_template">Squash commit message template</label>
          <Hint>The commit message used when squashing commits.</Hint>
          <textarea className="form-control gl-form-input" id="project_squash_commit_template" rows={3}
            maxLength={500} value={form.squashCommitTemplate}
            onChange={e => set('squashCommitTemplate', e.target.value)} />
          <Hint>Leave empty to use default template.</Hint>
          <Hint>Maximum 500 characters.</Hint>
          <Hint>
            <Help href="/help/user/project/merge_requests/commit_templates.md">What variables can I use?</Help>
          </Hint>
        </div>

        <button type="submit" className="gl-button btn btn-confirm">Save changes</button>
      </form>
    </Section>
  )
}

// ===========================================================================
// ROUTES #101 — /:ns/:proj/-/settings/ci_cd
// ===========================================================================

const DEFAULT_CI = {
  publicPipelines: true,
  autoCancel: true,
  preventOutdated: true,
  separateCaches: true,
  configPath: '',
  gitStrategy: 'fetch',
  gitDepth: '20',
  timeout: '1h',
  autoDevopsEnabled: false,
  deployStrategy: 'continuous',
  keepLatestArtifact: true,
  limitJobToken: true,
}

/** The three badge panels the source renders under "General pipelines". */
function BadgeSettings({ project }) {
  const origin = instanceOrigin()
  const ref = project.default_branch || 'main'
  const base = `${origin}/${project.full_path}`
  const BADGES = [
    ['Pipeline status', 'pipeline status', `${base}/badges/${ref}/pipeline.svg`, `${base}/-/commits/${ref}`],
    ['Coverage report', 'coverage report', `${base}/badges/${ref}/coverage.svg`, `${base}/-/commits/${ref}`],
    ['Latest release', 'Latest Release', `${base}/-/badges/release.svg`, `${base}/-/releases`],
  ]
  return (
    <>
      {BADGES.map(([title, alt, img, link]) => (
        <div key={title} className="gl-mt-5 pipeline-status-badge">
          <h5>{title}</h5>
          <div className="gl-display-flex gl-align-items-center gl-gap-3">
            <span>{title}</span><span>·</span><span>{ref}</span>
            <button type="button" className="gl-button btn btn-default btn-sm">Switch branch/tag</button>
          </div>
          {[['Markdown', `[![${alt}](${img})](${link})`],
            ['HTML', `<a href="${link}"><img alt="${alt}" src="${img}" /></a>`],
            ['AsciiDoc', `image:${img}[link="${link}",title="${alt}"]`]].map(([label, value]) => (
              <div key={label} className="form-group">
                <label>{label}</label>
                <input type="text" readOnly className="form-control gl-form-input" value={value}
                  onFocus={e => e.target.select()} />
              </div>
            ))}
        </div>
      ))}
    </>
  )
}

export function ProjectSettingsCiCd() {
  const { ready, project } = useSettingsPage('CI/CD Settings · CI/CD · Settings')
  const [settings, patch] = useProjectSettings(project)
  const stored = settings.ci || DEFAULT_CI
  const [form, setForm] = useState(stored)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Variables / triggers / deploy freezes each have their own small form.
  const [varKey, setVarKey] = useState('')
  const [varValue, setVarValue] = useState('')
  const [varType, setVarType] = useState('Variable')
  const [triggerDesc, setTriggerDesc] = useState('')
  const [triggerError, setTriggerError] = useState(false)
  const [freezeStart, setFreezeStart] = useState('')
  const [freezeEnd, setFreezeEnd] = useState('')
  const [freezeTz, setFreezeTz] = useState('UTC')

  if (!ready) return null
  if (!project) return <NotFound />

  const origin = instanceOrigin()
  const apiBase = `${origin}/api/v4/projects/${project.id}`

  return (
    <div className="js-search-settings-section">
      <Section id="js-general-pipeline-settings" title="General pipelines"
        description="Customize your pipeline configuration.">
        <form onSubmit={e => { e.preventDefault(); patch({ ci: form }) }}>
          <Check id="project_public_builds" checked={form.publicPipelines}
            onChange={e => set('publicPipelines', e.target.checked)} label="Public pipelines">
            Allow public access to pipelines and job details, including output logs and artifacts.
          </Check>
          <Check id="project_auto_cancel_pending_pipelines" checked={form.autoCancel}
            onChange={e => set('autoCancel', e.target.checked)} label="Auto-cancel redundant pipelines">
            New pipelines cause older pending or running pipelines on the same branch to be cancelled.
          </Check>
          <Check id="project_prevent_outdated_deployment_jobs" checked={form.preventOutdated}
            onChange={e => set('preventOutdated', e.target.checked)} label="Prevent outdated deployment jobs">
            When a deployment job is successful, prevent older deployment jobs that are still pending.
          </Check>
          <Check id="project_ci_separated_caches" checked={form.separateCaches}
            onChange={e => set('separateCaches', e.target.checked)} label="Use separate caches for protected branches">
            Unprotected branches will not have access to the cache from protected branches.
          </Check>
          <div className="form-group">
            <label htmlFor="project_ci_config_path">CI/CD configuration file</label>
            <input type="text" className="form-control gl-form-input" id="project_ci_config_path"
              placeholder=".gitlab-ci.yml" value={form.configPath} onChange={e => set('configPath', e.target.value)} />
            <Hint>The name of the CI/CD configuration file. A path relative to the root directory is optional (for example <code>my/path/.myfile.yml</code>).</Hint>
          </div>
          <fieldset className="form-group">
            <legend className="col-form-label">Git strategy</legend>
            <Hint>Choose which Git strategy to use when fetching the project.</Hint>
            <Radio name="build_allow_git_fetch" id="project_build_allow_git_fetch_false" value="clone"
              checked={form.gitStrategy === 'clone'} onChange={() => set('gitStrategy', 'clone')} label="git clone">
              For each job, clone the repository.
            </Radio>
            <Radio name="build_allow_git_fetch" id="project_build_allow_git_fetch_true" value="fetch"
              checked={form.gitStrategy === 'fetch'} onChange={() => set('gitStrategy', 'fetch')} label="git fetch">
              For each job, re-use the project workspace. If the workspace doesn&apos;t exist, use <code>git clone</code>.
            </Radio>
          </fieldset>
          <div className="form-group">
            <label htmlFor="project_ci_default_git_depth">Git shallow clone</label>
            <input type="number" className="form-control gl-form-input" id="project_ci_default_git_depth"
              value={form.gitDepth} onChange={e => set('gitDepth', e.target.value)} />
            <Hint>The number of changes to fetch from GitLab when cloning a repository. Lower values can speed up pipeline execution. Set to <code>0</code> or blank to fetch all branches and tags for each job</Hint>
          </div>
          <div className="form-group">
            <label htmlFor="project_build_timeout_human_readable">Timeout</label>
            <input type="text" className="form-control gl-form-input" id="project_build_timeout_human_readable"
              value={form.timeout} onChange={e => set('timeout', e.target.value)} />
            <Hint>Jobs fail if they run longer than the timeout time. Input value is in seconds by default. Human readable input is also accepted, for example <code>1 hour</code>.</Hint>
          </div>
          <button type="submit" className="gl-button btn btn-confirm">Save changes</button>
        </form>
        <BadgeSettings project={project} />
      </Section>

      <Section id="autodevops-settings" title="Auto DevOps"
        description="Automate building, testing, and deploying your applications based on your continuous integration and delivery configuration.">
        <p><Help href="/help/topics/autodevops/index.md">How do I get started?</Help></p>
        <form onSubmit={e => { e.preventDefault(); patch({ ci: form }) }}>
          <Check id="project_auto_devops_attributes_enabled" checked={form.autoDevopsEnabled}
            onChange={e => set('autoDevopsEnabled', e.target.checked)}
            label={<>Default to Auto DevOps pipeline<span className="badge badge-info badge-pill gl-badge sm gl-ml-2">instance enabled</span></>}>
            The Auto DevOps pipeline runs if no alternative CI configuration file is found.
            {' '}<Help href="/help/topics/autodevops/index.md">Learn more.</Help>
          </Check>
          <p>Add a Kubernetes cluster integration with a domain, or create an AUTO_DEVOPS_PLATFORM_TARGET CI variable.</p>
          <fieldset className="form-group">
            <legend className="col-form-label">Deployment strategy</legend>
            <Radio name="deploy_strategy" id="deploy_strategy_continuous" value="continuous"
              checked={form.deployStrategy === 'continuous'} onChange={() => set('deployStrategy', 'continuous')}
              label="Continuous deployment to production" />
            <Radio name="deploy_strategy" id="deploy_strategy_timed_incremental" value="timed_incremental"
              checked={form.deployStrategy === 'timed_incremental'} onChange={() => set('deployStrategy', 'timed_incremental')}
              label="Continuous deployment to production using timed incremental rollout" />
            <Radio name="deploy_strategy" id="deploy_strategy_manual" value="manual"
              checked={form.deployStrategy === 'manual'} onChange={() => set('deployStrategy', 'manual')}
              label="Automatic deployment to staging, manual deployment to production" />
          </fieldset>
          <button type="submit" className="gl-button btn btn-confirm">Save changes</button>
        </form>
      </Section>

      <Section id="js-runners-settings" title="Runners"
        description="Runners are processes that pick up and execute CI/CD jobs for GitLab.">
        <p><Help href="/help/ci/runners/index.md">What is GitLab Runner?</Help></p>
        <p>Register as many runners as you want. You can register runners as separate users, on separate servers, and on your local machine.</p>
        <p><Help href="/help/ci/runners/configure_runners.md">How do runners pick up jobs?</Help></p>
        <p>Runners are either:</p>
        <ul>
          <li><span className="badge badge-success badge-pill gl-badge sm">active</span> - Available to run jobs.</li>
          <li><span className="badge badge-muted badge-pill gl-badge sm">paused</span> - Not available to run jobs.</li>
        </ul>
        <p>
          Tags control which type of jobs a runner can handle. By tagging a runner, you make sure shared runners only handle the jobs they are equipped to run.
          {' '}<Help href="/help/ci/runners/configure_runners.md#use-tags-to-control-which-jobs-a-runner-can-run">Learn more.</Help>
        </p>
        <h4>Specific runners</h4>
        <p>These runners are specific to this project.</p>
        <h5>Set up a specific runner for a project</h5>
        <ol>
          <li>Install GitLab Runner and ensure it&apos;s running.</li>
          <li>
            Register the runner with this URL:
            <input type="text" readOnly className="form-control gl-form-input" value={`${origin}/`}
              onFocus={e => e.target.select()} />
          </li>
          <li>
            And this registration token:
            <input type="text" readOnly className="form-control gl-form-input"
              value="GR1348941tBFVancyEKczeWtBv-iC" onFocus={e => e.target.select()} />
          </li>
        </ol>
        <button type="button" className="gl-button btn btn-default">Reset registration token</button>
        <button type="button" className="gl-button btn btn-link">Show runner installation instructions</button>
        <h4 className="gl-mt-5">Shared runners</h4>
        <p>These runners are available to all groups and projects.</p>
        <button type="button" className="gl-button btn btn-confirm">Enable shared runners for this project</button>
        <p className="gl-mt-3">This GitLab instance does not provide any shared runners yet. Instance administrators can register shared runners in the admin area.</p>
        <h4 className="gl-mt-5">Group runners</h4>
        <p>These runners are shared across projects in this group.</p>
        <p>Group runners can be managed with the <Help href="/help/api/runners.md">Runner API</Help>.</p>
        <p>This project does not belong to a group and cannot make use of group runners.</p>
      </Section>

      <Section id="js-artifacts-settings" title="Artifacts"
        description="A job artifact is an archive of files and directories saved by a job when it finishes.">
        <Check id="keep_latest_artifact" checked={form.keepLatestArtifact}
          onChange={e => { set('keepLatestArtifact', e.target.checked); patch({ ci: { ...form, keepLatestArtifact: e.target.checked } }) }}
          label={<>Keep artifacts from most recent successful jobs <Help href="/help/ci/pipelines/job_artifacts">More information</Help></>}>
          The latest artifacts created by jobs in the most recent successful pipeline will be stored.
        </Check>
      </Section>

      <Section id="js-cicd-variables-settings" title="Variables"
        description="Variables store information, like passwords and secret keys, that you can use in job scripts. Each project can define a maximum of 200 variables.">
        <p><Help href="/help/ci/variables/index">Learn more.</Help></p>
        <p>Variables can have several attributes. <Help href="/help/ci/variables/index#define-a-cicd-variable-in-the-ui">Learn more.</Help></p>
        <ul>
          <li><strong>Protected:</strong> Only exposed to protected branches or protected tags.</li>
          <li><strong>Masked:</strong> Hidden in job logs. Must match masking requirements.</li>
          <li><strong>Expanded:</strong> Variables with <code>$</code> will be treated as the start of a reference to another variable.</li>
        </ul>
        <p>Environment variables are configured by your administrator to be <strong>protected</strong> by default.</p>
        <table className="table b-table gl-table ci-variable-table">
          <thead><tr><th>Type</th><th>Key</th><th>Value</th><th>Options</th><th>Environments</th><th /></tr></thead>
          <tbody>
            {settings.ciVariables.length === 0 ? (
              <tr><td colSpan={6} className="text-center">There are no variables yet.</td></tr>
            ) : settings.ciVariables.map(v => (
              <tr key={v.id}>
                <td>{v.type}</td><td>{v.key}</td><td>{v.value}</td><td /><td>All (default)</td>
                <td>
                  <button type="button" className="gl-button btn btn-default btn-icon" aria-label="Delete"
                    onClick={() => patch(b => ({ ciVariables: b.ciVariables.filter(x => x.id !== v.id) }))}>
                    <Icon name="close" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="gl-display-flex gl-gap-3 gl-flex-wrap" onSubmit={e => {
          e.preventDefault()
          if (!varKey.trim()) return
          patch(b => ({ ciVariables: [...b.ciVariables, { id: Date.now(), type: varType, key: varKey.trim(), value: varValue }] }))
          setVarKey(''); setVarValue('')
        }}>
          <select className="form-control gl-form-select custom-select" aria-label="Type"
            value={varType} onChange={e => setVarType(e.target.value)}>
            <option>Variable</option>
            <option>File</option>
          </select>
          <input type="text" className="form-control gl-form-input" aria-label="Key" placeholder="Key"
            value={varKey} onChange={e => setVarKey(e.target.value)} />
          <input type="text" className="form-control gl-form-input" aria-label="Value" placeholder="Value"
            value={varValue} onChange={e => setVarValue(e.target.value)} />
          <button type="submit" className="gl-button btn btn-confirm">Add variable</button>
        </form>
      </Section>

      <Section id="js-pipeline-triggers" title="Pipeline triggers"
        description="Trigger a pipeline for a branch or tag by generating a trigger token and using it with an API call. The token impersonates a user's project access and permissions.">
        <p><Help href="/help/ci/triggers/index">Learn more.</Help></p>
        <h5>Manage your project&apos;s triggers</h5>
        <form onSubmit={e => {
          e.preventDefault()
          if (!triggerDesc.trim()) { setTriggerError(true); return }
          setTriggerError(false)
          patch(b => ({ triggers: [...b.triggers, { id: Date.now(), description: triggerDesc.trim() }] }))
          setTriggerDesc('')
        }}>
          <div className="form-group">
            <label htmlFor="trigger_description">Description</label>
            <input type="text" id="trigger_description"
              className={`form-control gl-form-input${triggerError ? ' is-invalid' : ''}`}
              value={triggerDesc} onChange={e => setTriggerDesc(e.target.value)} />
            {triggerError ? <span className="invalid-feedback" style={{ display: 'block' }}>Trigger description is required.</span> : null}
          </div>
          <button type="submit" className="gl-button btn btn-confirm">Add trigger</button>
        </form>
        {settings.triggers.length === 0 ? (
          <p className="gl-mt-3">No triggers exist yet. Use the form above to create one.</p>
        ) : (
          <table className="table b-table gl-table gl-mt-3">
            <thead><tr><th>Token</th><th>Description</th><th>Owner</th><th /></tr></thead>
            <tbody>
              {settings.triggers.map(t => (
                <tr key={t.id}>
                  <td><code>****************</code></td>
                  <td>{t.description}</td>
                  <td>Byte Blaze</td>
                  <td>
                    <button type="button" className="gl-button btn btn-danger"
                      onClick={() => patch(b => ({ triggers: b.triggers.filter(x => x.id !== t.id) }))}>Revoke</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="gl-mt-3">These examples show how to trigger this project&apos;s pipeline for a branch or tag.</p>
        <p>In each example, replace <code>TOKEN</code> with the trigger token you generated and replace <code>REF_NAME</code> with the branch or tag name.</p>
        <h5>Use cURL</h5>
        <pre className="gl-bg-gray-10">{`curl -X POST \\
     --fail \\
     -F token=TOKEN \\
     -F ref=REF_NAME \\
     ${apiBase}/trigger/pipeline`}</pre>
        <h5>Use .gitlab-ci.yml</h5>
        <pre className="gl-bg-gray-10">{`script:
  - "curl -X POST --fail -F token=TOKEN -F ref=REF_NAME ${apiBase}/trigger/pipeline"`}</pre>
        <h5>Use webhook</h5>
        <pre className="gl-bg-gray-10">{`${apiBase}/ref/REF_NAME/trigger/pipeline?token=TOKEN`}</pre>
        <h5>Pass job variables</h5>
        <p>To pass variables to the triggered pipeline, add <code>variables[VARIABLE]=VALUE</code> to the API request.</p>
        <p>cURL:</p>
        <pre className="gl-bg-gray-10">{`curl -X POST \\
     --fail \\
     -F token=TOKEN \\
     -F "ref=REF_NAME" \\
     -F "variables[RUN_NIGHTLY_BUILD]=true" \\
     ${apiBase}/trigger/pipeline`}</pre>
        <p>Webhook:</p>
        <pre className="gl-bg-gray-10">{`${apiBase}/ref/REF_NAME/trigger/pipeline?token=TOKEN&variables[RUN_NIGHTLY_BUILD]=true`}</pre>
      </Section>

      <Section id="js-deploy-freeze-settings" title="Deploy freezes"
        description="Add a freeze period to prevent unintended releases during a period of time for a given environment. You must update the deployment jobs in .gitlab-ci.yml according to the deploy freezes added here.">
        <p><Help href="/help/user/project/releases/index#prevent-unintentional-releases-by-setting-a-deploy-freeze">Learn more.</Help></p>
        <p>Specify deploy freezes using <a href="https://crontab.guru/" target="_blank" rel="noopener noreferrer">cron</a> syntax.</p>
        <table className="table b-table gl-table">
          <thead><tr><th>Freeze start</th><th>Freeze end</th><th>Time zone</th><th>Edit</th><th>Delete</th></tr></thead>
          <tbody>
            {settings.deployFreezes.length === 0 ? (
              <tr><td colSpan={5} className="text-center">No deploy freezes exist for this project. To add one, select <strong>Add deploy freeze</strong></td></tr>
            ) : settings.deployFreezes.map(f => (
              <tr key={f.id}>
                <td>{f.start}</td><td>{f.end}</td><td>{f.tz}</td>
                <td><button type="button" className="gl-button btn btn-default btn-icon" aria-label="Edit"><Icon name="pencil" /></button></td>
                <td>
                  <button type="button" className="gl-button btn btn-default btn-icon" aria-label="Delete"
                    onClick={() => patch(b => ({ deployFreezes: b.deployFreezes.filter(x => x.id !== f.id) }))}>
                    <Icon name="close" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form className="gl-display-flex gl-gap-3 gl-flex-wrap" onSubmit={e => {
          e.preventDefault()
          if (!freezeStart.trim() || !freezeEnd.trim()) return
          patch(b => ({ deployFreezes: [...b.deployFreezes, { id: Date.now(), start: freezeStart.trim(), end: freezeEnd.trim(), tz: freezeTz }] }))
          setFreezeStart(''); setFreezeEnd('')
        }}>
          <input type="text" className="form-control gl-form-input" aria-label="Freeze start" placeholder="0 23 * * 5"
            value={freezeStart} onChange={e => setFreezeStart(e.target.value)} />
          <input type="text" className="form-control gl-form-input" aria-label="Freeze end" placeholder="0 7 * * 1"
            value={freezeEnd} onChange={e => setFreezeEnd(e.target.value)} />
          <input type="text" className="form-control gl-form-input" aria-label="Time zone"
            value={freezeTz} onChange={e => setFreezeTz(e.target.value)} />
          <button type="submit" className="gl-button btn btn-confirm">Add deploy freeze</button>
        </form>
      </Section>

      <Section id="js-token-access" title="Token Access"
        description="Control how the CI_JOB_TOKEN CI/CD variable is used for API access between projects.">
        <Check id="limit_job_token_scope" checked={form.limitJobToken}
          onChange={e => { set('limitJobToken', e.target.checked); patch({ ci: { ...form, limitJobToken: e.target.checked } }) }}
          label="Limit CI_JOB_TOKEN access">
          Select the projects that can be accessed by API requests authenticated with this project&apos;s CI_JOB_TOKEN CI/CD variable. It is a security risk to disable this feature, because unauthorized projects might attempt to retrieve an active token and access the API.
          {' '}<Help href="/help/ci/jobs/ci_job_token">Learn more.</Help>
        </Check>
        <button type="button" className="gl-button btn btn-default">Add an existing project to the scope</button>
        <p className="gl-mt-3">Enable feature to limit job token access to the following projects.</p>
        <table className="table b-table gl-table">
          <thead><tr><th>Projects that can be accessed</th><th>Namespace</th></tr></thead>
          <tbody><tr><td>{project.path}</td><td>{project.namespace.path}</td></tr></tbody>
        </table>
      </Section>

      <Section id="js-secure-files" title="Secure Files"
        description="Use Secure Files to store files used by your pipelines such as Android keystores, or Apple provisioning profiles and signing certificates.">
        <p><Help href="/help/ci/secure_files/index">Learn more</Help></p>
        <table className="table b-table gl-table">
          <thead><tr><th>File name</th><th>Uploaded date</th></tr></thead>
          <tbody><tr><td colSpan={2} className="text-center">There are no secure files yet.</td></tr></tbody>
        </table>
        <button type="button" className="gl-button btn btn-confirm">Upload File</button>
      </Section>
    </div>
  )
}

// ===========================================================================
// ROUTES #102 — /:ns/:proj/-/settings/integrations
// ===========================================================================

// The 37 rows the source lists, in the source's own order, with its own slugs
// (the `href` segment) and descriptions. Extracted from r4-set-integrations.html.
const INTEGRATIONS = [
  ['asana', 'Asana', 'Add commit messages as comments to Asana tasks.'],
  ['assembla', 'Assembla', 'Manage projects.'],
  ['bamboo', 'Atlassian Bamboo', 'Run CI/CD pipelines with Atlassian Bamboo.'],
  ['bugzilla', 'Bugzilla', "Use Bugzilla as this project's issue tracker."],
  ['buildkite', 'Buildkite', 'Run CI/CD pipelines with Buildkite.'],
  ['campfire', 'Campfire', 'Send notifications about push events to Campfire chat rooms.'],
  ['confluence', 'Confluence Workspace', 'Link to a Confluence Workspace from the sidebar.'],
  ['custom_issue_tracker', 'Custom issue tracker', "Use a custom issue tracker as this project's issue tracker."],
  ['datadog', 'Datadog', 'Trace your GitLab pipelines with Datadog.'],
  ['discord', 'Discord Notifications', 'Send notifications about project events to a Discord channel.'],
  ['drone_ci', 'Drone', 'Run CI/CD pipelines with Drone.'],
  ['ewm', 'EWM', "Use IBM Engineering Workflow Management as this project's issue tracker."],
  ['emails_on_push', 'Emails on push', 'Email the commits and diff of each push to a list of recipients.'],
  ['external_wiki', 'External wiki', 'Link to an external wiki from the sidebar.'],
  ['hangouts_chat', 'Google Chat', 'Send notifications from GitLab to a room in Google Chat.'],
  ['harbor', 'Harbor', "Use Harbor as this project's container registry."],
  ['jenkins', 'Jenkins', 'Run CI/CD pipelines with Jenkins.'],
  ['teamcity', 'JetBrains TeamCity', 'Run CI/CD pipelines with JetBrains TeamCity.'],
  ['jira', 'Jira', "Use Jira as this project's issue tracker."],
  ['mattermost', 'Mattermost notifications', 'Send notifications about project events to Mattermost channels.'],
  ['mattermost_slash_commands', 'Mattermost slash commands', 'Perform common tasks with slash commands.'],
  ['microsoft_teams', 'Microsoft Teams notifications', 'Send notifications about project events to Microsoft Teams.'],
  ['packagist', 'Packagist', 'Keep your PHP dependencies updated on Packagist.'],
  ['pipelines_email', 'Pipeline status emails', 'Email the pipeline status to a list of recipients.'],
  ['pivotaltracker', 'Pivotal Tracker', 'Add commit messages as comments to Pivotal Tracker stories.'],
  ['prometheus', 'Prometheus', 'Monitor application health with Prometheus metrics and dashboards'],
  ['pumble', 'Pumble', 'Send notifications about project events to Pumble.'],
  ['pushover', 'Pushover', 'Get real-time notifications on your device.'],
  ['redmine', 'Redmine', "Use Redmine as this project's issue tracker."],
  ['shimo', 'Shimo', 'Link to a Shimo Workspace from the sidebar.'],
  ['slack', 'Slack notifications', 'Send notifications about project events to Slack.'],
  ['slack_slash_commands', 'Slack slash commands', 'Perform common operations in Slack.'],
  ['unify_circuit', 'Unify Circuit', 'Send notifications about project events to Unify Circuit.'],
  ['webex_teams', 'Webex Teams', 'Send notifications about project events to Webex Teams.'],
  ['youtrack', 'YouTrack', "Use YouTrack as this project's issue tracker."],
  ['zentao', 'ZenTao', "Use ZenTao as this project's issue tracker."],
  ['irker', 'irker (IRC gateway)', 'Send update messages to an irker server.'],
]

export function ProjectSettingsIntegrations() {
  const { ready, project, base } = useSettingsPage('Integrations · Settings')
  if (!ready) return null
  if (!project) return <NotFound />
  return (
    <div>
      <h4 className="gl-mt-0">Integrations</h4>
      <p>
        Integrations enable you to make third-party applications part of your GitLab workflow. If the available integrations don&apos;t meet your needs, consider using a
        {' '}<a href={`${base}/-/hooks`}>webhook</a>.
      </p>

      <h5>Active integrations</h5>
      <table role="table" aria-colcount="4" className="table b-table gl-table gl-mb-7! b-table-fixed"
        data-testid="active-integrations-table">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" aria-colindex="1" aria-label="Active" className="gl-w-10"><div /></th>
            <th role="columnheader" aria-colindex="2" className="gl-w-quarter"><div>Integration</div></th>
            <th role="columnheader" aria-colindex="3" className="gl-display-none d-sm-table-cell"><div>Description</div></th>
            <th role="columnheader" aria-colindex="4" className="gl-w-20p"><div>Last updated</div></th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          <tr role="row" className="b-table-empty-row">
            <td colSpan={4} role="cell">
              <div role="alert" aria-live="polite">
                <div className="text-center my-2">You haven&apos;t activated any integrations yet.</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <h5>Add an integration</h5>
      <table role="table" aria-colcount="3" className="table b-table gl-table b-table-fixed"
        data-testid="inactive-integrations-table">
        <thead role="rowgroup">
          <tr role="row">
            <th role="columnheader" aria-colindex="1" className="gl-w-10"><div /></th>
            <th role="columnheader" aria-colindex="2" className="gl-w-quarter"><div>Integration</div></th>
            <th role="columnheader" aria-colindex="3" className="gl-display-none d-sm-table-cell"><div>Description</div></th>
          </tr>
        </thead>
        <tbody role="rowgroup">
          {INTEGRATIONS.map(([slug, name, description]) => (
            <tr key={slug} role="row">
              <td role="cell" />
              <td role="cell">
                <a href={`${base}/-/settings/integrations/${slug}/edit`}>{name}</a>
              </td>
              <td role="cell" className="gl-display-none d-sm-table-cell">{description}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ===========================================================================
// ROUTES #103 — access_tokens / operations / packages_and_registries
// ===========================================================================

const PROJECT_TOKEN_SCOPES = [
  ['api', 'Grants complete read and write access to the scoped project API, including the Package Registry.'],
  ['read_api', 'Grants read access to the scoped project API, including the Package Registry.'],
  ['read_repository', 'Grants read access (pull) to the repository.'],
  ['write_repository', 'Grants read and write access (pull and push) to the repository.'],
]

const TOKEN_ROLES = ['Guest', 'Reporter', 'Developer', 'Maintainer', 'Owner']

export function ProjectSettingsAccessTokens() {
  const { ready, project } = useSettingsPage('Project Access Tokens · Settings')
  const [settings, patch] = useProjectSettings(project)
  const [name, setName] = useState('')
  const [expires, setExpires] = useState('')
  const [role, setRole] = useState('Guest')
  const [scopes, setScopes] = useState([])
  const tokens = settings.accessTokens || []

  if (!ready) return null
  if (!project) return <NotFound />

  return (
    <div>
      <h4 className="gl-mt-0">Project Access Tokens</h4>
      <p>Generate project access tokens scoped to this project for your applications that need access to the GitLab API.</p>
      <p>
        You can also use project access tokens with Git to authenticate over HTTP(S).
        {' '}<Help href="/help/user/project/settings/project_access_tokens">Learn more.</Help>
      </p>
      <h5>Add a project access token</h5>
      <p>Enter the name of your application, and we&apos;ll return a unique project access token.</p>
      <form onSubmit={e => {
        e.preventDefault()
        if (!name.trim() || !scopes.length) return
        patch(b => ({
          accessTokens: [...(b.accessTokens || []), {
            id: Date.now(), name: name.trim(), expires_at: expires || null, role, scopes: [...scopes],
          }],
        }))
        setName(''); setExpires(''); setScopes([])
      }}>
        <div className="form-group">
          <label htmlFor="project_access_token_name">Token name</label>
          <input type="text" id="project_access_token_name" className="form-control gl-form-input"
            value={name} onChange={e => setName(e.target.value)} />
          <Hint>For example, the application using the token or the purpose of the token. Do not give sensitive information for the name of the token, as it will be visible to all project members.</Hint>
        </div>
        <div className="form-group">
          <label htmlFor="project_access_token_expires_at">Expiration date</label>
          <input type="date" id="project_access_token_expires_at" className="form-control gl-form-input"
            value={expires} onChange={e => setExpires(e.target.value)} />
        </div>
        <div className="form-group">
          <label htmlFor="project_access_token_access_level">Select a role</label>
          <select id="project_access_token_access_level" className="form-control gl-form-select custom-select"
            value={role} onChange={e => setRole(e.target.value)}>
            {TOKEN_ROLES.map(r => <option key={r}>{r}</option>)}
          </select>
        </div>
        <fieldset className="form-group">
          <legend className="col-form-label">Select scopes</legend>
          <Hint>Scopes set the permission levels granted to the token.</Hint>
          <Hint>
            <Help href="/help/user/project/settings/project_access_tokens#scopes-for-a-project-access-token">Learn more.</Help>
          </Hint>
          {PROJECT_TOKEN_SCOPES.map(([scope, help]) => (
            <Check key={scope} id={`project_access_token_scopes_${scope}`} checked={scopes.includes(scope)}
              onChange={e => setScopes(s => (e.target.checked ? [...s, scope] : s.filter(x => x !== scope)))}
              label={scope}>{help}</Check>
          ))}
        </fieldset>
        <button type="submit" className="gl-button btn btn-confirm">Create project access token</button>
      </form>

      <h5 className="gl-mt-5">Active project access tokens ({tokens.length})</h5>
      <table className="table b-table gl-table">
        <thead>
          <tr>
            <th>Token name</th><th>Scopes</th><th>Created</th>
            <th>
              <Help href="/help/user/profile/personal_access_tokens.md#view-the-last-time-a-token-was-used">Last Used</Help>
            </th>
            <th>Expires</th><th>Role</th><th>Action</th>
          </tr>
        </thead>
        <tbody>
          {tokens.length === 0 ? (
            <tr><td colSpan={7} className="text-center">This project has no active access tokens.</td></tr>
          ) : tokens.map(t => (
            <tr key={t.id}>
              <td>{t.name}</td>
              <td>{t.scopes.join(', ')}</td>
              <td>just now</td>
              <td>Never</td>
              <td>{t.expires_at || 'Never'}</td>
              <td>{t.role}</td>
              <td>
                <button type="button" className="gl-button btn btn-danger"
                  onClick={() => patch(b => ({ accessTokens: (b.accessTokens || []).filter(x => x.id !== t.id) }))}>
                  Revoke
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const DEFAULT_OPS = {
  timezone: "User's local timezone",
  externalDashboard: '',
  errorTrackingActive: false,
  sentryUrl: '',
  sentryToken: '',
  createIncident: false,
  singleEmail: false,
  autoCloseIncident: false,
  pagerdutyActive: false,
  grafanaActive: false,
  grafanaUrl: '',
  grafanaToken: '',
}

export function ProjectSettingsOperations() {
  const { ready, project } = useSettingsPage('Monitor Settings · Settings')
  const [settings, patch] = useProjectSettings(project)
  const [form, setForm] = useState(settings.operations || DEFAULT_OPS)
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const save = e => { e.preventDefault(); patch({ operations: form }) }

  if (!ready) return null
  if (!project) return <NotFound />

  return (
    <div className="js-search-settings-section">
      <Section id="js-operations-metrics-settings" title="Metrics"
        description="Manage metrics dashboard settings.">
        <p><Help href="/help/operations/metrics/index">Learn more.</Help></p>
        <form onSubmit={save}>
          <div className="form-group">
            <label htmlFor="metrics_dashboard_timezone">Dashboard timezone</label>
            <select id="metrics_dashboard_timezone" className="form-control gl-form-select custom-select"
              value={form.timezone} onChange={e => set('timezone', e.target.value)}>
              <option>User&apos;s local timezone</option>
              <option>UTC (Coordinated Universal Time)</option>
            </select>
            <Hint>Choose whether to display dashboard metrics in UTC or the user&apos;s local timezone.</Hint>
          </div>
          <div className="form-group">
            <label htmlFor="metrics_external_dashboard_url">External dashboard URL</label>
            <input type="text" id="metrics_external_dashboard_url" className="form-control gl-form-input"
              value={form.externalDashboard} onChange={e => set('externalDashboard', e.target.value)} />
            <Hint>Add a button to the metrics dashboard linking directly to your existing external dashboard.</Hint>
          </div>
          <button type="submit" className="gl-button btn btn-confirm">Save Changes</button>
        </form>
      </Section>

      <Section id="js-error-tracking-settings" title="Error tracking"
        description="Link Sentry to GitLab to discover and view the errors your application generates.">
        <p><Help href="/help/operations/error_tracking">Learn more.</Help></p>
        <form onSubmit={save}>
          <Check id="error_tracking_enabled" checked={form.errorTrackingActive}
            onChange={e => set('errorTrackingActive', e.target.checked)} label="Enable error tracking">
            Active
          </Check>
          <div className="form-group">
            <label htmlFor="error_tracking_api_host">Sentry API URL</label>
            <input type="text" id="error_tracking_api_host" className="form-control gl-form-input"
              value={form.sentryUrl} onChange={e => set('sentryUrl', e.target.value)} />
            <Hint>If you self-host Sentry, enter your Sentry instance&apos;s full URL. If you use Sentry&apos;s hosted solution, enter https://sentry.io</Hint>
          </div>
          <div className="form-group">
            <label htmlFor="error_tracking_token">Auth Token</label>
            <input type="text" id="error_tracking_token" className="form-control gl-form-input"
              value={form.sentryToken} onChange={e => set('sentryToken', e.target.value)} />
            <button type="button" className="gl-button btn btn-default gl-mt-3">Connect</button>
            <Hint>After adding your Auth Token, select the Connect button to load projects.</Hint>
          </div>
          <div className="form-group">
            <label htmlFor="error_tracking_project">Project</label>
            <select id="error_tracking_project" className="form-control gl-form-select custom-select" disabled>
              <option>No projects available</option>
            </select>
            <Hint>To enable project selection, enter a valid Auth Token.</Hint>
          </div>
          <button type="submit" className="gl-button btn btn-confirm">Save changes</button>
        </form>
      </Section>

      <Section id="js-alert-management-settings" title="Alerts"
        description="Display alerts from all configured monitoring tools.">
        <p><Help href="/help/operations/incident_management/integrations">Learn more.</Help></p>
        <ul className="nav-links gl-tabs-nav" role="tablist">
          <li className="gl-tab-nav-item gl-tab-nav-item-active"><button type="button" className="gl-tab-nav-item">Current integrations</button></li>
          <li className="gl-tab-nav-item"><button type="button" className="gl-tab-nav-item">Alert settings</button></li>
        </ul>
        <table className="table b-table gl-table">
          <thead><tr><th>Status</th><th>Integration Name</th><th>Type</th><th>Actions</th></tr></thead>
          <tbody><tr><td colSpan={4} className="text-center">No integrations have been added yet.</td></tr></tbody>
        </table>
        <button type="button" className="gl-button btn btn-confirm">Add new integration</button>
        <form onSubmit={save} className="gl-mt-5">
          <p>Action to take when receiving an alert. <Help href="/help/operations/incident_management/incidents">Learn more.</Help></p>
          <Check id="create_issue" checked={form.createIncident} onChange={e => set('createIncident', e.target.checked)}
            label="Create an incident. Incidents are created for each alert triggered." />
          <div className="form-group">
            <label htmlFor="issue_template_key">Incident template (optional).</label>
            {' '}<Help href="/help/user/project/description_templates">Learn more.</Help>
            <select id="issue_template_key" className="form-control gl-form-select custom-select" defaultValue="">
              <option value="">No template selected</option>
            </select>
          </div>
          <Check id="send_email" checked={form.singleEmail} onChange={e => set('singleEmail', e.target.checked)}
            label="Send a single email notification to Owners and Maintainers for new alerts." />
          <Check id="auto_close_incident" checked={form.autoCloseIncident}
            onChange={e => set('autoCloseIncident', e.target.checked)}
            label="Automatically close associated incident when a recovery alert notification resolves an alert" />
          <button type="submit" className="gl-button btn btn-confirm">Save changes</button>
        </form>
      </Section>

      <Section id="js-incident-management-settings" title="Incidents"
        description="Fine-tune incident settings and set up integrations with external tools to help better manage incidents.">
        <h5>PagerDuty integration</h5>
        <p>Create a GitLab incident for each PagerDuty incident by configuring a webhook in PagerDuty</p>
        <Check id="pagerduty_active" checked={form.pagerdutyActive}
          onChange={e => { set('pagerdutyActive', e.target.checked); patch({ operations: { ...form, pagerdutyActive: e.target.checked } }) }}
          label="Active" />
        <div className="form-group">
          <label htmlFor="pagerduty_webhook_url">Webhook URL</label>
          <input type="text" readOnly id="pagerduty_webhook_url" className="form-control gl-form-input"
            value={`${instanceOrigin()}/${project.full_path}/-/incident_management/pagerduty.json`}
            onFocus={e => e.target.select()} />
          <button type="button" className="gl-button btn btn-default gl-mt-3">Reset webhook URL</button>
        </div>
      </Section>

      <Section id="js-grafana-integration" title="Grafana authentication"
        description="Set up Grafana authentication to embed Grafana panels in GitLab Flavored Markdown.">
        <p><Help href="/help/operations/metrics/embed_grafana">Learn more.</Help></p>
        <form onSubmit={save}>
          <Check id="grafana_enabled" checked={form.grafanaActive} onChange={e => set('grafanaActive', e.target.checked)}
            label="Enable authentication">Active</Check>
          <div className="form-group">
            <label htmlFor="grafana_url">Grafana URL</label>
            <input type="text" id="grafana_url" className="form-control gl-form-input"
              value={form.grafanaUrl} onChange={e => set('grafanaUrl', e.target.value)} />
            <Hint>Enter the base URL of the Grafana instance.</Hint>
          </div>
          <div className="form-group">
            <label htmlFor="grafana_token">API token</label>
            <input type="text" id="grafana_token" className="form-control gl-form-input"
              value={form.grafanaToken} onChange={e => set('grafanaToken', e.target.value)} />
            <Hint>Enter the <Help href="/help/operations/metrics/embed_grafana">Grafana API token</Help>.</Hint>
          </div>
          <button type="submit" className="gl-button btn btn-confirm">Save changes</button>
        </form>
      </Section>
    </div>
  )
}

export function ProjectSettingsPackages() {
  const { ready, project } = useSettingsPage('Package and registry settings · Settings')
  const [settings, patch] = useProjectSettings(project)
  const [keep, setKeep] = useState((settings.packages && settings.packages.keep) || '1')

  if (!ready) return null
  if (!project) return <NotFound />

  // The source's packages section is NOT collapsible: `class="settings gl-py-7"`
  // with no toggle, laid out as `.row > .col-lg-4` (title + description) beside
  // `.col-lg-8` (the form). Everything is visible on load.
  return (
    <section className="settings gl-py-7">
      <div className="row">
        <div className="col-lg-4">
          <h4>Manage storage used by package assets</h4>
          <p><span data-testid="description">When a package with same name and version is uploaded to the registry, more assets are added to the package. To save storage space, keep only the most recent assets.</span></p>
        </div>
        <div className="col-lg-8 gl-pt-3">
      <form onSubmit={e => { e.preventDefault(); patch({ packages: { keep } }) }}>
        <div className="form-group" id="keep-n-duplicated-package-files-form-group">
          <label htmlFor="keep-n-duplicated-package-files">Number of duplicate assets to keep</label>
          <select id="keep-n-duplicated-package-files" className="gl-form-select custom-select"
            value={keep} onChange={e => setKeep(e.target.value)}>
            {['1', '10', '20', '30', '40', '50', 'All'].map(v => <option key={v}>{v}</option>)}
          </select>
          <Hint>Examples of assets include .pom &amp; .jar files</Hint>
        </div>
        <button type="submit" className="gl-button btn btn-confirm">Save changes</button>
      </form>
        </div>
      </div>
    </section>
  )
}

// ===========================================================================
// ROUTES #104 — /:ns/:proj/-/hooks
// ===========================================================================

const HOOK_TRIGGERS = [
  ['push_events', 'Push events', null],
  ['tag_push_events', 'Tag push events', 'A new tag is pushed to the repository.'],
  ['note_events', 'Comments', 'A comment is added to an issue or merge request.'],
  ['confidential_note_events', 'Confidential comments', 'A comment is added to a confidential issue.'],
  ['issues_events', 'Issues events', 'An issue is created, updated, closed, or reopened.'],
  ['confidential_issues_events', 'Confidential issues events', 'A confidential issue is created, updated, closed, or reopened.'],
  ['merge_requests_events', 'Merge request events', 'A merge request is created, updated, or merged.'],
  ['job_events', 'Job events', "A job's status changes."],
  ['pipeline_events', 'Pipeline events', "A pipeline's status changes."],
  ['wiki_page_events', 'Wiki page events', 'A wiki page is created or updated.'],
  ['deployment_events', 'Deployment events', 'A deployment starts, finishes, fails, or is canceled.'],
  ['feature_flag_events', 'Feature flag events', 'A feature flag is turned on or off.'],
  ['releases_events', 'Releases events', 'A release is created or updated.'],
]

export function ProjectHooks() {
  const { ready, project, base } = useSettingsPage('Webhook Settings')
  const [settings, patch] = useProjectSettings(project)
  const [url, setUrl] = useState('')
  const [maskUrl, setMaskUrl] = useState(false)
  const [token, setToken] = useState('')
  const [triggers, setTriggers] = useState(['push_events'])
  const [ssl, setSsl] = useState(true)
  const [error, setError] = useState(false)

  if (!ready) return null
  if (!project) return <NotFound />

  const hooks = settings.hooks

  return (
    <div>
      <h4 className="gl-mt-0">Webhooks</h4>
      <p>
        <Help href="/help/user/project/integrations/webhooks">Webhooks</Help>
        {' enable you to send notifications to web applications in response to events in a group or project. We recommend using an '}
        <a href={`${base}/-/settings/integrations`}>integration</a>
        {' in preference to a webhook.'}
      </p>
      <form onSubmit={e => {
        e.preventDefault()
        if (!url.trim()) { setError(true); return }
        setError(false)
        patch(b => ({
          hooks: [...b.hooks, { id: Date.now(), url: url.trim(), maskUrl, token, triggers: [...triggers], ssl }],
        }))
        setUrl(''); setToken('')
      }}>
        <div className="form-group">
          <label htmlFor="hook_url">URL</label>
          <input type="text" id="hook_url" className={`form-control gl-form-input${error ? ' is-invalid' : ''}`}
            value={url} onChange={e => setUrl(e.target.value)} />
          {error ? <span className="invalid-feedback" style={{ display: 'block' }}>This field is required.</span> : null}
          <Hint>URL must be percent-encoded if it contains one or more special characters.</Hint>
          <div className="gl-mt-3">
            <Radio name="url_mask" id="hook_url_show_full" value="show" checked={!maskUrl}
              onChange={() => setMaskUrl(false)} label="Show full URL" />
            <Radio name="url_mask" id="hook_url_mask" value="mask" checked={maskUrl}
              onChange={() => setMaskUrl(true)} label="Mask portions of URL">
              Do not show sensitive data such as tokens in the UI.
            </Radio>
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="hook_token">Secret token</label>
          <input type="text" id="hook_token" className="form-control gl-form-input"
            value={token} onChange={e => setToken(e.target.value)} />
          <Hint>Used to validate received payloads. Sent with the request in the <code>X-Gitlab-Token</code> HTTP header.</Hint>
        </div>
        <fieldset className="form-group">
          <legend className="col-form-label">Trigger</legend>
          {HOOK_TRIGGERS.map(([key, label, help]) => (
            <Check key={key} id={`hook_${key}`} checked={triggers.includes(key)}
              onChange={e => setTriggers(t => (e.target.checked ? [...t, key] : t.filter(x => x !== key)))}
              label={label}>{help}</Check>
          ))}
        </fieldset>
        <fieldset className="form-group">
          <legend className="col-form-label">SSL verification</legend>
          <Check id="hook_enable_ssl_verification" checked={ssl} onChange={e => setSsl(e.target.checked)}
            label="Enable SSL verification" />
        </fieldset>
        <button type="submit" className="gl-button btn btn-confirm">Add webhook</button>
      </form>

      <h4 className="gl-mt-5">
        Project Hooks
        <span className="badge badge-muted badge-pill gl-badge sm gl-ml-2">({hooks.length})</span>
      </h4>
      {hooks.length === 0 ? (
        <p className="text-center">No webhooks enabled. Select trigger events above.</p>
      ) : (
        <ul className="content-list hooks-list">
          {hooks.map(h => (
            <li key={h.id} className="gl-display-flex gl-align-items-center">
              <div className="gl-flex-grow-1">
                <strong className="gl-display-block">{h.url}</strong>
                <span className="gl-text-secondary">
                  {h.triggers.map(t => (HOOK_TRIGGERS.find(x => x[0] === t) || [null, t])[1]).join(', ')}
                </span>
              </div>
              <button type="button" className="gl-button btn btn-default">Test</button>
              <button type="button" className="gl-button btn btn-danger gl-ml-3"
                onClick={() => patch(b => ({ hooks: b.hooks.filter(x => x.id !== h.id) }))}>Delete</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ===========================================================================
// ROUTES #105 — /:ns/:proj/-/usage_quotas
// ===========================================================================

export function ProjectUsageQuotas() {
  const { ready, project } = useSettingsPage('Usage Quotas')
  if (!ready) return null
  if (!project) return <NotFound />
  return (
    <div>
      <div className="gl-alert gl-alert-info">
        <div className="gl-alert-content">
          <div className="gl-alert-body">
            Repository usage recalculation started
            <div>To view usage, refresh this page in a few minutes.</div>
          </div>
        </div>
      </div>
      <h4 className="gl-mt-0">Usage Quotas</h4>
      <p>
        Usage of project resources across the <strong>{project.name}</strong> project.
        {' '}<Help href="/help/user/usage_quotas.md">Learn more about usage quotas.</Help>
      </p>
      <ul className="nav-links gl-tabs-nav" role="tablist">
        <li className="gl-tab-nav-item gl-tab-nav-item-active" role="presentation">
          <a className="gl-tab-nav-item" href="#storage-quota-tab" role="tab">Storage</a>
        </li>
      </ul>
    </div>
  )
}

// ===========================================================================
// ROUTES #113 — /:ns/:proj/-/value_stream_analytics
// ===========================================================================

const VSA_STAGES = ['Issue', 'Plan', 'Code', 'Test', 'Review', 'Staging']

export function ProjectValueStreamAnalytics() {
  const { ready, project } = useSettingsPage('Value Stream Analytics')
  const [historyOpen, setHistoryOpen] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [stage, setStage] = useState('Issue')

  if (!ready) return null
  if (!project) return <NotFound />

  return (
    <div>
      <h3 className="page-title">Value Stream Analytics</h3>
      <div className="gl-filtered-search vue-filtered-search-bar-container">
        <button type="button" className="gl-button btn btn-default btn-icon" aria-label="Toggle history"
          onClick={() => setHistoryOpen(v => !v)}>
          <Icon name="history" />
        </button>
        {historyOpen ? (
          <div className="dropdown-menu show">
            <div className="dropdown-header">Recent searches</div>
            <div className="gl-p-3">You don&apos;t have any recent searches</div>
          </div>
        ) : null}
        <label htmlFor="vsa-from" className="gl-ml-3">From</label>
        <input type="date" id="vsa-from" className="form-control gl-form-input"
          value={from} onChange={e => setFrom(e.target.value)} />
        <label htmlFor="vsa-to" className="gl-ml-3">To</label>
        <input type="date" id="vsa-to" className="form-control gl-form-input"
          value={to} onChange={e => setTo(e.target.value)} />
      </div>
      <div className="gl-mt-3">30 days selected</div>

      <ul className="gl-path-nav gl-list-style-none gl-display-flex gl-flex-wrap">
        {VSA_STAGES.map(s => (
          <li key={s}>
            <button type="button" className={`gl-path-button${stage === s ? ' gl-path-active-item' : ''}`}
              onClick={() => setStage(s)}>{s}<span className="gl-path-nav-list-item-metric">-</span></button>
          </li>
        ))}
      </ul>

      <h4>Key metrics</h4>
      <div className="gl-display-flex gl-flex-wrap gl-gap-5">
        {[['New Issues', '-'], ['Commits', '-'], ['Deploys', '-']].map(([label, value]) => (
          <div key={label} className="gl-single-stat">
            <span className="gl-single-stat-title">{label}</span>
            <span className="gl-single-stat-content">{value}</span>
          </div>
        ))}
      </div>
      <h4>DORA metrics</h4>
      <div className="gl-single-stat">
        <span className="gl-single-stat-title">Deployment Frequency</span>
        <span className="gl-single-stat-content">- /day</span>
      </div>
      <div className="gl-text-center gl-p-5">We don&apos;t have enough data to show this stage.</div>
    </div>
  )
}

// ===========================================================================
// ROUTES #115 — /:ns/:proj/-/security/configuration
// ===========================================================================

// The 10 scanner cards the source renders, in its order, with its status
// badges and its per-card action. `Not enabled` is a real badge on three of
// them; the seven Ultimate-only cards carry the `Available with Ultimate`
// notice instead and no status badge, exactly as in r4-sec-config.html.
const SCANNERS = [
  ['Static Application Security Testing (SAST)', 'Not enabled',
    'Analyze your source code for known vulnerabilities.',
    '/help/user/application_security/sast/index', 'Configure with a merge request', null],
  ['Infrastructure as Code (IaC) Scanning', null,
    'Analyze your infrastructure as code configuration files for known vulnerabilities.',
    '/help/user/application_security/iac_scanning/index', null, null],
  ['Dynamic Application Security Testing (DAST)', null,
    'Analyze a deployed version of your web application for known vulnerabilities by examining it from the outside in. DAST works by simulating external attacks on your application while it is running.',
    '/help/user/application_security/dast/index', null, ['DAST profiles', 'Manage profiles for use by DAST scans.']],
  ['Dependency Scanning', null,
    'Analyze your dependencies for known vulnerabilities.',
    '/help/user/application_security/dependency_scanning/index', null, null],
  ['Container Scanning', 'Not enabled',
    'Check your Docker images for known vulnerabilities.',
    '/help/user/application_security/container_scanning/index', 'Configuration guide', null],
  ['Cluster Image Scanning', null,
    'Check your Kubernetes cluster images for known vulnerabilities.',
    '/help/user/application_security/cluster_image_scanning/index', null, null],
  ['Secret Detection', 'Not enabled',
    'Analyze your source code and git history for secrets.',
    '/help/user/application_security/secret_detection/index', 'Configure with a merge request', null],
  ['API Fuzzing', null, 'Find bugs in your code with API fuzzing.',
    '/help/user/application_security/api_fuzzing/index', null, null],
  ['Coverage Fuzzing', null, 'Find bugs in your code with coverage-guided fuzzing.',
    '/help/user/application_security/coverage_fuzzing/index', null,
    ['Corpus Management', 'Manage corpus files used as seed inputs with coverage-guided fuzzing.']],
]

const ULTIMATE_ONLY = new Set([
  'Dynamic Application Security Testing (DAST)', 'Dependency Scanning',
  'Cluster Image Scanning', 'API Fuzzing', 'Coverage Fuzzing',
])

export function ProjectSecurityConfiguration() {
  const { ready, project, base } = useSettingsPage('Security Configuration')
  const [tab, setTab] = useState('testing')
  if (!ready) return null
  if (!project) return <NotFound />

  return (
    <div>
      <div className="gl-alert gl-alert-info gl-mb-5">
        <div className="gl-alert-content">
          <div className="gl-alert-body">
            Quickly enable all continuous testing and compliance tools by enabling
            {' '}<Help href="/help/topics/autodevops/index">Auto DevOps</Help>
          </div>
          <div className="gl-alert-actions">
            <a className="gl-alert-action btn btn-confirm btn-md gl-button"
              href={`${base}/-/settings/ci_cd`}>Enable Auto DevOps</a>
          </div>
        </div>
      </div>

      <h1 className="gl-font-size-h-display gl-line-height-36 h4">Security Configuration</h1>
      <h2 className="gl-font-size-h2">Secure your project</h2>
      <p>
        Immediately begin risk analysis and remediation with application security features. Start with SAST and Secret Detection, available to all plans. Upgrade to Ultimate to get all features, including:
      </p>
      <ul>
        <li>Vulnerability details and statistics in the merge request</li>
        <li>High-level vulnerability statistics across projects and groups</li>
        <li>Runtime security metrics for application environments</li>
        <li>More scan types, including DAST, Dependency Scanning, Fuzzing, and Licence Compliance</li>
      </ul>
      <a className="gl-button btn btn-confirm" href="/help/subscriptions/index">Upgrade or start a free trial</a>

      <ul className="nav-links gl-tabs-nav gl-mt-5" role="tablist">
        {[['testing', 'Security testing'], ['compliance', 'Compliance'], ['vulnerability', 'Vulnerability Management']].map(([id, label]) => (
          <li key={id} className={`gl-tab-nav-item${tab === id ? ' gl-tab-nav-item-active' : ''}`} role="presentation">
            <button type="button" className="gl-tab-nav-item" role="tab" onClick={() => setTab(id)}>{label}</button>
          </li>
        ))}
      </ul>

      {tab === 'testing' ? (
        <>
          <h2 className="gl-font-size-h2">Security testing</h2>
          <p>The status of the tools only applies to the default branch and is based on the latest pipeline.</p>
          <p>Once you&apos;ve enabled a scan for the default branch, any subsequent feature branch you create will include the scan. An enabled scanner will not be reflected as such until the pipeline has been successfully executed and it has generated valid artifacts.</p>
          {SCANNERS.map(([name, status, description, help, action, secondary]) => (
            <div key={name} className="gl-border-b-1 gl-border-b-solid gl-border-gray-100 gl-py-5">
              <div className="gl-display-flex gl-align-items-center gl-gap-3">
                <h3 className="gl-font-size-h2 gl-m-0">{name}</h3>
                {status ? <span className="badge badge-muted badge-pill gl-badge sm">{status}</span> : null}
              </div>
              {ULTIMATE_ONLY.has(name) ? <div className="gl-text-secondary">Available with Ultimate</div> : null}
              <p className="gl-mt-3">{description}</p>
              <Help href={help}>Learn more</Help>
              {action ? <div className="gl-mt-3"><a className="gl-button btn btn-default" href={`${base}/-/security/configuration`}>{action}</a></div> : null}
              {secondary ? (
                <div className="gl-mt-3">
                  <strong>{secondary[0]}</strong>
                  <div className="gl-text-secondary">{secondary[1]}</div>
                </div>
              ) : null}
            </div>
          ))}
        </>
      ) : null}
      {tab === 'compliance' ? (
        <>
          <h2 className="gl-font-size-h2">Compliance</h2>
          <p>The status of the tools only applies to the default branch and is based on the latest pipeline.</p>
        </>
      ) : null}
      {tab === 'vulnerability' ? (
        <>
          <h2 className="gl-font-size-h2">Vulnerability Management</h2>
          <p>The status of the tools only applies to the default branch and is based on the latest pipeline.</p>
        </>
      ) : null}
    </div>
  )
}
