// ---------------------------------------------------------------------------
// Instance host derivation (TEST BUG-B05 / DIFF-005 / DIFF-A05, BUG-003).
//
// Six forms shipped `http://localhost:8023/` — the SOURCE container's host and
// port — baked in as a literal, while the mock is served from an arbitrary port
// the deploy script picks. The clone panel had the mirror-image bug: it rendered
// WebArena's own `__GITLAB_SSH__` placeholder, which the harness substitutes
// into the *reference answer*, so an agent that copies it off the page is
// compared against a real host string and fails webarena-293…297 outright.
//
// Everything host-shaped goes through here. Nothing in this module hard-codes a
// host: it all derives from `window.location`, so the mock renders whatever it
// is actually served from, on any port, behind any hostname.
// ---------------------------------------------------------------------------

/** Scheme + host + port the mock is served from, e.g. `http://localhost:5211`. */
export function instanceOrigin() {
  if (typeof window === 'undefined' || !window.location) return ''
  return window.location.origin
}

/** Hostname only, no port — the SSH URL needs its own port. */
export function instanceHostname() {
  if (typeof window === 'undefined' || !window.location) return ''
  return window.location.hostname
}

/**
 * The `http://host:port/` prefix the URL input-groups render.
 * Pass a namespace to get `http://host:port/<namespace>/`, which is the shape
 * the project-URL and fork-URL selects use.
 */
export function instanceUrlPrefix(namespace = '') {
  const base = `${instanceOrigin()}/`
  return namespace ? `${base}${namespace}/` : base
}

/** `http://host:port/ns/proj.git` — the HTTP clone URL. */
export function httpCloneUrl(fullPath) {
  return `${instanceOrigin()}/${fullPath}.git`
}

// GitLab Omnibus publishes SSH on 2222 in the WebArena image; the source's own
// clone panel renders `ssh://git@<host>:2222/ns/proj.git`. The port is part of
// the deployment, not of the page, so it stays a constant here while the host
// is derived.
export const SSH_PORT = 2222

/** `ssh://git@host:2222/ns/proj.git` — the SSH clone URL. */
export function sshCloneUrl(fullPath) {
  return `ssh://git@${instanceHostname()}:${SSH_PORT}/${fullPath}.git`
}
