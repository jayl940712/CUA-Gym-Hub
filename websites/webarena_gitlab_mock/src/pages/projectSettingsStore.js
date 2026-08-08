import { useApp } from '../context/AppContext.jsx'

// ---------------------------------------------------------------------------
// Backing store for the project-settings routes (ROUTES #99–#105).
//
// Everything an agent creates on those pages — a protected branch, a deploy
// key, a webhook, a CI variable — lands in `state.ui.projectSettings[<path>]`,
// so it flows through `setState` → `saveState()` → `/post?action=set_current`
// and shows up in the `/go` state_diff. See SCHEMA.md § ui.projectSettings.
//
// One bucket per project full_path, created lazily; a project the agent never
// touches contributes nothing to the POSTed payload.
// ---------------------------------------------------------------------------

export const EMPTY_SETTINGS = {
  // Branch defaults / repository
  branchNameTemplate: '',
  autocloseReferencedIssues: true,
  mirrors: [],
  protectedBranches: null,     // null = "use the seeded default" (see below)
  protectedTags: [],
  deployTokens: [],
  deployKeys: [],
  accessTokens: [],
  // Merge requests
  merge: null,
  // CI/CD
  ci: null,
  ciVariables: [],
  triggers: [],
  deployFreezes: [],
  // Webhooks
  hooks: [],
  // Monitor / packages
  operations: null,
  packages: null,
}

/**
 * GitLab protects the default branch of every project out of the box, with
 * `Maintainers` allowed to merge and to push. That is what the source's
 * `/-/settings/repository` shows for `byteblaze/dotfiles`, and it is derived
 * from the project rather than stored, so it is derived here too.
 */
export function defaultProtectedBranches(project) {
  if (!project || !project.default_branch) return []
  return [{
    id: project.id,
    name: project.default_branch,
    isDefault: true,
    merge: 'Maintainers',
    push: 'Maintainers',
    forcePush: false,
  }]
}

export function useProjectSettings(project) {
  const { state, setUi } = useApp()
  const key = project ? project.full_path : ''
  const all = (state && state.ui.projectSettings) || {}
  const settings = { ...EMPTY_SETTINGS, ...(all[key] || {}) }
  if (settings.protectedBranches === null) settings.protectedBranches = defaultProtectedBranches(project)

  const patch = (updater) => {
    if (!key) return
    setUi(ui => {
      const bucket = { ...EMPTY_SETTINGS, ...((ui.projectSettings || {})[key] || {}) }
      if (bucket.protectedBranches === null) bucket.protectedBranches = defaultProtectedBranches(project)
      const next = typeof updater === 'function' ? updater(bucket) : updater
      return { ...ui, projectSettings: { ...(ui.projectSettings || {}), [key]: { ...bucket, ...next } } }
    })
  }

  return [settings, patch]
}
