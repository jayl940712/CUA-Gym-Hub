/**
 * Client-side state tracking for webarena_shopping_admin_mock.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY THIS EXISTS ALONGSIDE THE SERVER DIFF
 * ─────────────────────────────────────────────────────────────────────────────
 * `GET /go?sid=` is answered by `calculateStateDiff()` in `vite.config.js`, which
 * reads `.mock-states/<sid>.json` + `<sid>.initial.json` and compares them
 * **one top-level key at a time**. That is the hub contract and it stays the
 * authority — nothing here changes what `/go` returns.
 *
 * This module is the client-side counterpart, and it does three jobs the server
 * cannot do:
 *
 *   1. `computeStateDiff()` — a byte-for-byte reimplementation of the server's
 *      algorithm, so an in-app navigation to `/go?sid=` (`src/pages/GoPage.jsx`)
 *      and a cold `GET /go?sid=` produce the *same* object. If these two ever
 *      disagree the mock is lying to the evaluator about what changed; keeping
 *      one canonical implementation is how that stays true.
 *
 *   2. `OBSERVABLE_STATE_CHANGES` — SCHEMA.md's "Observable State Changes"
 *      table as data. Every user action that mutates anything is listed here
 *      with the exact state path it writes, so the table can be *checked*
 *      instead of trusted. `describeStateDiff()` turns a raw diff back into the
 *      admin actions that could have produced it.
 *
 *   3. `verifyTrackerCoverage()` — asserts that every root key named by the
 *      table is declared in `createInitialData()`. An undeclared key diffs as
 *      `{new}` with no `old` member on its first write (this is exactly how
 *      PIPELINE-024 / PIPELINE-026 got in), so this is the regression guard for
 *      that whole class of bug. Callers pass the baseline in — this module
 *      deliberately does not import `dataManager.js`, which imports it.
 *
 * The paths below use dotted notation. A root key like `orderComments` is the
 * granularity `/go` reports; sub-paths like `systemConfig.cacheStatus` are
 * recorded because that is where the write actually lands, and
 * `computeDeepStateDiff()` can resolve them for tooling. Bracketed segments
 * (`orderOverrides[id].status`) are documentation of the shape, not lookups.
 */

/* ------------------------------------------------------------------------- *
 * 1. The diff itself
 * ------------------------------------------------------------------------- */

/**
 * Server-parity diff. MUST stay identical to `calculateStateDiff()` in
 * `vite.config.js` — same key set, same `{old, new}` shape, same
 * JSON.stringify comparison (which is key-order sensitive on both sides, and
 * both sides are producing their JSON from the same object literals, so that is
 * fine and is what the server does).
 *
 * Note the asymmetry, inherited deliberately: keys present in `initial` but
 * absent from `current` are NOT reported, because the loop walks `current`.
 * Reproducing that is the point — a client diff that "improved" on it would
 * disagree with `/go`.
 */
export function computeStateDiff(initial, current) {
  const diff = {}
  for (const key in current) {
    if (!initial || JSON.stringify(current[key]) !== JSON.stringify(initial[key])) {
      diff[key] = { old: initial ? initial[key] : undefined, new: current[key] }
    }
  }
  return diff
}

/**
 * Path-granular diff, for inspection and for the audit pipeline — NOT for `/go`.
 *
 * The top-level diff reports `systemConfig` as one blob, so a Cache Refresh and
 * a URL Rewrite delete are indistinguishable in its output. This walks plain
 * objects down to their leaves and names the precise path, which is what
 * `describeStateDiff()` needs to tell those two actions apart. Arrays are leaves
 * — an array's identity is its contents, and expanding indices would produce
 * noise rather than signal for a 351-row collection.
 */
export function computeDeepStateDiff(initial, current) {
  const diff = {}

  const isPlainObject = v => v !== null && typeof v === 'object' && !Array.isArray(v)

  function walk(path, a, b) {
    if (isPlainObject(a) && isPlainObject(b)) {
      const keys = new Set([...Object.keys(a), ...Object.keys(b)])
      for (const k of keys) walk(path ? `${path}.${k}` : k, a[k], b[k])
      return
    }
    if (JSON.stringify(a) !== JSON.stringify(b)) diff[path] = { old: a, new: b }
  }

  if (!initial || !current) return diff
  walk('', initial, current)
  return diff
}

/* ------------------------------------------------------------------------- *
 * 2. SCHEMA.md's Observable State Changes table, as data
 *
 * One entry per row of that table, in the table's own order and section
 * grouping. `paths` is empty for the rows that deliberately mutate nothing —
 * those are declared declines (a `notice`/`error` with `state_diff = []`), and
 * they are listed so a future reader does not mistake them for missing
 * tracking.
 * ------------------------------------------------------------------------- */

export const OBSERVABLE_STATE_CHANGES = [
  /* ---- Sales ---- */
  { section: 'Sales', action: 'Order view → Hold', paths: ['orderOverrides', 'orderComments'] },
  { section: 'Sales', action: 'Order view → Unhold', paths: ['orderOverrides', 'orderComments'] },
  { section: 'Sales', action: 'Order view → Cancel', paths: ['orderOverrides', 'orderComments'] },
  { section: 'Sales', action: 'Order view → Submit Comment', paths: ['orderComments'] },
  { section: 'Sales', action: 'Order view → Send Email', paths: ['orderOverrides', 'orderStatusHistory'] },
  { section: 'Sales', action: 'Order view → Invoice → Submit Invoice', paths: ['invoices', 'invoiceItems', 'orderOverrides'] },
  { section: 'Sales', action: 'Order view → Ship → Submit Shipment', paths: ['shipments', 'shipmentItems', 'orderOverrides', 'orderComments'] },
  { section: 'Sales', action: 'Shipment view → Add / remove Tracking Number', paths: ['shipmentTracks'] },
  { section: 'Sales', action: 'Order edit → billing/shipping address save', paths: ['orderAddressOverrides'] },
  { section: 'Sales', action: 'Create New Order → Submit Order', paths: ['newOrders', 'orderComments'] },
  { section: 'Sales', action: 'Credit Memo → Refund Offline', paths: ['creditMemos', 'orderComments'] },
  { section: 'Sales', action: 'Invoice view → Send Email', paths: ['invoices'] },
  { section: 'Sales', action: 'Shipment view → Send Email', paths: ['shipments'] },
  { section: 'Sales', action: 'Credit Memo view → Send Email', paths: ['creditMemos'] },
  { section: 'Sales', action: 'Sales > Order Statuses → Create New Status / edit', paths: ['orderStatuses'] },
  { section: 'Sales', action: 'Any grid → Default View → Save View as', paths: ['gridBookmarks'] },

  /* ---- Catalog ---- */
  { section: 'Catalog', action: 'Product edit → Save', paths: ['productOverrides', 'productDescriptionOverrides'] },
  { section: 'Catalog', action: 'Catalog > Add Product → Save', paths: ['newProducts'] },
  { section: 'Catalog', action: 'Products grid → Delete mass action', paths: ['deletedProductIds'] },
  { section: 'Catalog', action: 'Products grid → Update attributes mass action', paths: ['productOverrides'] },
  { section: 'Catalog', action: 'Configurations wizard → Generate Products → Save', paths: ['newProducts', 'productOverrides'] },
  { section: 'Catalog', action: 'Configurations → Add Products Manually → Add → Save', paths: ['productOverrides'] },
  { section: 'Catalog', action: 'Category tree → Save', paths: ['categoryOverrides'] },
  { section: 'Catalog', action: 'Category tree → Add Root/Subcategory', paths: ['newCategories', 'categoryOverrides'] },
  { section: 'Catalog', action: 'Category tree → Delete', paths: ['deletedCategoryIds'] },
  { section: 'Catalog', action: 'Stores > Attributes > Product → edit → Save', paths: ['productAttributeOverrides'] },
  { section: 'Catalog', action: 'Stores > Attributes > Product → Add New Attribute', paths: ['newProductAttributes'] },
  { section: 'Catalog', action: 'Stores > Attribute Set → rename / Save', paths: ['attributeSetOverrides'] },
  { section: 'Catalog', action: 'Stores > Attribute Set → Add Attribute Set', paths: ['newAttributeSets'] },

  /* ---- Customers ---- */
  { section: 'Customers', action: 'Customer edit → Save Customer', paths: ['customers'] },
  { section: 'Customers', action: 'Customer grid → Delete / mass actions', paths: ['customers'] },
  { section: 'Customers', action: 'Customer Groups → create / edit / delete', paths: ['customerGroups'] },
  { section: 'Customers', action: 'Customer edit → Wish List tab → Delete', paths: ['wishlists'], latent: 'both seeded wishlists have items: []' },
  { section: 'Customers', action: 'Customer edit → Reset Password / Force Sign-In', paths: [], declines: true },

  /* ---- Content ---- */
  { section: 'Content', action: 'Content > Pages → edit / create → Save Page', paths: ['cmsPages'] },
  { section: 'Content', action: 'Content > Pages → Delete', paths: ['cmsPages'] },
  { section: 'Content', action: 'Content > Blocks → edit / create → Save Block', paths: ['cmsBlocks'] },
  { section: 'Content', action: 'Content > Blocks → Delete Block', paths: ['cmsBlocks'] },
  { section: 'Content', action: 'Content > Widgets → create / edit / delete', paths: ['systemConfig.widgets'] },
  { section: 'Content', action: 'Content > Design > Schedule → create / edit / delete', paths: ['systemConfig.design_changes'] },

  /* ---- Marketing ---- */
  { section: 'Marketing', action: 'Cart Price Rules → create / edit → Save', paths: ['cartPriceRules', 'coupons'] },
  { section: 'Marketing', action: 'Cart Price Rules → Delete', paths: ['cartPriceRules', 'coupons'] },
  { section: 'Marketing', action: 'Catalog Price Rules → create / edit / delete', paths: ['catalogPriceRules'] },
  { section: 'Marketing', action: 'Catalog Price Rules → Apply Rules', paths: ['catalogPriceRules'] },
  { section: 'Marketing', action: 'Search Terms → create / edit / delete', paths: ['searchTerms'] },
  { section: 'Marketing', action: 'Search Synonyms → create / edit / delete', paths: ['systemConfig.synonyms'] },
  { section: 'Marketing', action: 'Newsletter Templates → create / edit / delete', paths: ['systemConfig.newsletter_templates'] },
  { section: 'Marketing', action: 'Newsletter Subscribers → Unsubscribe / Delete mass action', paths: ['newsletterSubscribers'] },
  { section: 'Marketing', action: 'Terms and Conditions → create / edit / delete', paths: ['systemConfig.checkout_agreements'] },
  { section: 'Marketing', action: 'URL Rewrites → Save (new row)', paths: ['systemConfig.url_rewrites'] },
  { section: 'Marketing', action: 'URL Rewrites → Save (seed row)', paths: ['systemConfig.url_rewrite_edits'] },
  { section: 'Marketing', action: 'URL Rewrites → Delete (seed row)', paths: ['systemConfig.url_rewrite_deleted'] },
  { section: 'Marketing', action: 'Reviews → edit → Save Review', paths: ['reviews'] },
  { section: 'Marketing', action: 'Reviews → New Review', paths: ['reviews'] },
  { section: 'Marketing', action: 'Reviews → Delete mass action', paths: ['deletedReviewIds'] },
  { section: 'Marketing', action: 'Ratings → create / edit / delete', paths: ['ratings'] },

  /* ---- Reports & Dashboard ---- */
  { section: 'Reports', action: 'Reports > Refresh Statistics → mass action', paths: ['systemConfig.report_statistics'] },
  { section: 'Reports', action: 'Dashboard → Reload Data', paths: ['dashboardStatistics'] },

  /* ---- Stores & System ---- */
  { section: 'System', action: 'Stores > Configuration → Save Config', paths: ['coreConfig'] },
  { section: 'System', action: 'Stores > Configuration → Save with nothing changed', paths: [], declines: true },
  { section: 'System', action: 'Stores > Currency Rates → Save Currency Rates', paths: ['systemConfig.currency_rates'] },
  { section: 'System', action: 'Stores > Currency Symbols → Save Currency Symbols', paths: ['systemConfig.currency_symbols'] },
  { section: 'System', action: 'Stores > Tax Zones and Rates → Save Rate', paths: ['taxConfig.rates'] },
  { section: 'System', action: 'Stores > Tax Rules → Save Rule', paths: ['taxConfig.rules', 'taxConfig.calculations'] },
  { section: 'System', action: 'Stores > Tax → Import Tax Rates (valid CSV)', paths: ['taxConfig.rates'] },
  { section: 'System', action: 'Stores > Tax → Import with no/invalid file', paths: [], declines: true },
  { section: 'System', action: 'System > Cache Management → Enable / Disable / Refresh', paths: ['systemConfig.cacheStatus'] },
  { section: 'System', action: 'System > Cache Management → any Flush button', paths: ['systemConfig.cacheFlushLog'] },
  { section: 'System', action: 'System > Index Management → Update on Save / by Schedule / Reindex', paths: ['systemConfig.indexerModes', 'systemConfig.indexerStatuses'] },
  { section: 'System', action: 'System > Notifications → Mark as Read', paths: ['systemConfig.notificationOverrides'] },
  { section: 'System', action: 'System > Notifications → Remove', paths: ['systemConfig.notificationOverrides'] },
  { section: 'System', action: 'System > Integrations → Reauthorize', paths: ['systemConfig.integrationStatus'] },
  { section: 'System', action: 'System > Integrations → create / edit', paths: ['systemConfig.integrations'] },
  { section: 'System', action: 'System > Site Map → create / edit / delete', paths: ['systemConfig.sitemaps'] },
  { section: 'System', action: 'System > Email Templates → create / edit / delete', paths: ['systemConfig.email_templates'] },
  { section: 'System', action: 'System > Custom Variables → create / edit / delete', paths: ['systemConfig.variables'] },
  { section: 'System', action: 'System > All Users → create / edit / delete', paths: ['adminUsers', 'adminRoles'] },
  { section: 'System', action: 'System > User Roles → create / edit / delete', paths: ['adminRoles'] },
  { section: 'System', action: 'System > Permissions > Locked Users → Unlock', paths: ['lockedAdminUsers', 'systemConfig.unlockedAdminUserIds'], latent: 'grid is empty, matching the source' },
  { section: 'System', action: 'System > Bulk Actions Log → Remove', paths: ['systemConfig.notificationOverrides'], latent: 'grid is empty, matching the source' },
  { section: 'System', action: 'System > Encryption Key → Change', paths: [], declines: true },
  { section: 'System', action: 'Account Activity → Log out all other sessions', paths: [], declines: true },
]

/** Every distinct path the table writes, deduplicated. */
export const TRACKED_PATHS = [...new Set(
  OBSERVABLE_STATE_CHANGES.flatMap(e => e.paths)
)].sort()

/** The top-level state keys `/go` will report for those paths. */
export const TRACKED_ROOT_KEYS = [...new Set(
  TRACKED_PATHS.map(p => p.split('.')[0])
)].sort()

/* ------------------------------------------------------------------------- *
 * 3. Reading a diff back
 * ------------------------------------------------------------------------- */

/**
 * Which observable actions are consistent with `diff`.
 *
 * Pass a deep diff (`computeDeepStateDiff`) to distinguish the `systemConfig.*`
 * actions from one another; a top-level diff still works but will match every
 * action sharing a root key. Returns `[]` for an empty diff, which is the
 * correct answer for the declining actions above.
 */
export function describeStateDiff(diff) {
  const changed = new Set(Object.keys(diff || {}))
  if (changed.size === 0) return []
  const roots = new Set([...changed].map(p => p.split('.')[0]))

  return OBSERVABLE_STATE_CHANGES
    .filter(entry => entry.paths.length > 0 && entry.paths.some(p =>
      changed.has(p) || (!p.includes('.') && roots.has(p)) || changed.has(p.split('.')[0])))
    .map(entry => entry.action)
}

/** Paths that changed but no table row claims — i.e. an untracked mutation. */
export function untrackedPaths(diff) {
  const tracked = new Set(TRACKED_PATHS)
  const trackedRoots = new Set(TRACKED_ROOT_KEYS)
  return Object.keys(diff || {}).filter(p =>
    !tracked.has(p) && !trackedRoots.has(p) && !tracked.has(p.split('.')[0]))
}

/* ------------------------------------------------------------------------- *
 * 4. Coverage self-check
 * ------------------------------------------------------------------------- */

/**
 * Check the table against a real baseline (`createInitialData()`).
 *
 * `undeclaredRoots` — a table row writes a top-level key the baseline does not
 * declare. Its first write diffs as `{new: …}` with `old: undefined`, so the
 * evaluator sees a whole-object creation rather than a field change.
 *
 * `undeclaredSubPaths` — same problem one level down: the root exists but the
 * sub-key does not, so `systemConfig` diffs as an opaque blob whose `old` is
 * missing the key entirely.
 *
 * Both lists must be empty. This is the check that PIPELINE-024 (
 * `dashboardStatistics`) and PIPELINE-026 (`systemConfig.url_rewrite*`) would
 * have failed.
 */
export function verifyTrackerCoverage(baseline) {
  const undeclaredRoots = []
  const undeclaredSubPaths = []

  for (const p of TRACKED_PATHS) {
    const [root, ...rest] = p.split('.')
    if (!baseline || !(root in baseline)) { undeclaredRoots.push(p); continue }
    let node = baseline[root]
    for (const seg of rest) {
      if (node === null || typeof node !== 'object' || !(seg in node)) { undeclaredSubPaths.push(p); break }
      node = node[seg]
    }
  }

  return {
    ok: undeclaredRoots.length === 0 && undeclaredSubPaths.length === 0,
    undeclaredRoots,
    undeclaredSubPaths,
    trackedPaths: TRACKED_PATHS.length,
    trackedRootKeys: TRACKED_ROOT_KEYS.length,
    actions: OBSERVABLE_STATE_CHANGES.length,
  }
}
