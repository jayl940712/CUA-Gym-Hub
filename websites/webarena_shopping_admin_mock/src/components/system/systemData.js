/**
 * Read-only System-area reference rows, transcribed verbatim from the live
 * source (logged in as `admin`) and from `assets/html/admin-cache.html`.
 *
 * These are server-side facts (cache type registry, indexer registry, the
 * Magento Analytics integration, the one import-history row) rather than
 * catalog data, so they never enter session state — the mock's cache/index
 * screens toggle their own view-level status only, exactly as ROUTES marks them
 * "Intentionally Not Migrated".
 *
 * All timestamps are stored UTC, the way every `src/data/*.json` seed stores
 * them; the formatters render them in America/New_York, which is what the source
 * displays (verified: cms_page 2023-04-19 15:41:33 renders "Apr 19, 2023 11:41:33 AM").
 *
 * SEED GAP: none of this is in `src/data/`; the plan agent extracted no
 * `cache`/`indexer_state`/`import_history`/`oauth_*` tables. Values below are
 * copied, not invented.
 */

/** assets/html/admin-cache.html — 14 rows, all Enabled. */
export const CACHE_TYPES = [
  { type: 'Configuration', desc: 'Various XML configurations that were collected across modules and merged', tags: 'CONFIG', status: 'Enabled' },
  { type: 'Layouts', desc: 'Layout building instructions', tags: 'LAYOUT_GENERAL_CACHE_TAG', status: 'Enabled' },
  { type: 'Blocks HTML output', desc: 'Page blocks HTML', tags: 'BLOCK_HTML', status: 'Enabled' },
  { type: 'Collections Data', desc: 'Collection data files', tags: 'COLLECTION_DATA', status: 'Enabled' },
  { type: 'Reflection Data', desc: 'API interfaces reflection data', tags: 'REFLECTION', status: 'Enabled' },
  { type: 'Database DDL operations', desc: 'Results of DDL queries, such as describing tables or indexes', tags: 'DB_DDL', status: 'Enabled' },
  { type: 'Compiled Config', desc: 'Compilation configuration', tags: 'COMPILED_CONFIG', status: 'Enabled' },
  { type: 'EAV types and attributes', desc: 'Entity types declaration cache', tags: 'EAV', status: 'Enabled' },
  { type: 'Customer Notification', desc: 'Customer Notification', tags: 'CUSTOMER_NOTIFICATION', status: 'Enabled' },
  { type: 'Integrations Configuration', desc: 'Integration configuration file', tags: 'INTEGRATION', status: 'Enabled' },
  { type: 'Integrations API Configuration', desc: 'Integrations API configuration file', tags: 'INTEGRATION_API_CONFIG', status: 'Enabled' },
  { type: 'Page Cache', desc: 'Full page caching', tags: 'FPC', status: 'Enabled' },
  { type: 'Web Services Configuration', desc: 'REST and SOAP configurations, generated WSDL file', tags: 'WEBSERVICE', status: 'Enabled' },
  { type: 'Translations', desc: 'Translation files', tags: 'TRANSLATE', status: 'Enabled' },
]

/** /admin/indexer/indexer/list/ — "11 records found", in the source's row order. */
export const INDEXERS = [
  { indexer_id: 'design_config_grid', title: 'Design Config Grid', description: 'Rebuild design config grid index', updated: '2023-06-17 21:28:41' },
  { indexer_id: 'customer_grid', title: 'Customer Grid', description: 'Rebuild Customer grid index', updated: '2023-06-17 21:28:41' },
  { indexer_id: 'catalog_category_product', title: 'Category Products', description: 'Indexed category/products association', updated: '2023-06-17 21:28:43' },
  { indexer_id: 'catalog_product_category', title: 'Product Categories', description: 'Indexed product/categories association', updated: '2023-06-17 21:28:43' },
  { indexer_id: 'catalogrule_rule', title: 'Catalog Rule Product', description: 'Indexed rule/product association', updated: '2023-06-17 21:28:46' },
  { indexer_id: 'catalog_product_attribute', title: 'Product EAV', description: 'Index product EAV', updated: '2023-06-17 21:28:48' },
  { indexer_id: 'inventory', title: 'Inventory', description: 'Inventory index (MSI)', updated: '2023-06-17 21:28:48' },
  { indexer_id: 'catalogrule_product', title: 'Catalog Product Rule', description: 'Indexed product/rule association', updated: '2023-06-17 21:28:46' },
  { indexer_id: 'cataloginventory_stock', title: 'Stock', description: 'Index stock', updated: '2023-06-17 21:28:49' },
  { indexer_id: 'catalog_product_price', title: 'Product Price', description: 'Index product prices', updated: '2023-06-17 21:28:51' },
  { indexer_id: 'catalogsearch_fulltext', title: 'Catalog Search', description: 'Rebuild Catalog product fulltext search index', updated: '2023-06-17 21:28:56' },
]

/** /admin/admin/integration/ — "1 records found". */
export const INTEGRATIONS = [
  { integration_id: 1, name: 'Magento Analytics user', note: 'Integration not secure', status: 'Active' },
]

/** /admin/admin/history/ — "1 records found". */
export const IMPORT_HISTORY = [
  {
    history_id: 1,
    started_at: '2023-04-19 16:13:23',
    user: '',
    imported_file: 'Download',
    error_file: '',
    execution_time: '00:01:23',
    summary: 'Created: 1994, Updated: 0, Deleted: 0',
  },
]

/**
 * /admin/security/session/activity/ — the source titles this page
 * "Account Activity" (not the menu label) and lists the admin's concurrent
 * sessions by IP and start time.
 */
export const SESSION_HOST_IP = '10.186.197.203'

/** /admin/admin/notification/ — "2 records found", verbatim copy. */
export const ADMIN_NOTIFICATIONS = [
  {
    notification_id: 1,
    severity: 'critical',
    date_added: '2023-06-13 14:28:45',
    title: 'Magento Open Source June release brings important accessibility and security updates',
    description: 'We are excited to announce great new accessibility updates in PWA Studio, along with multiple security updates in our June release. PWA Studio can now address the needs of people with all types, degrees, and combinations of disability. These guidelines make Web content more usable for individuals with changing abilities due to aging and often improve usability for users in general. We also have new security patches for all versions still under support or extended support.',
    has_details: true,
    is_read: 0,
  },
  {
    notification_id: 2,
    severity: 'notice',
    date_added: '2023-04-19 15:41:36',
    title: 'Disable Notice',
    description: 'To improve performance, collecting statistics for the Magento Report module is disabled by default. You can enable it in System Config.',
    has_details: false,
    is_read: 0,
  },
]
