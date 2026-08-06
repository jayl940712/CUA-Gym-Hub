/**
 * Real Content-area reference rows transcribed verbatim from the captured
 * source DOM. These entities are read-only in the mock (no admin screen in
 * scope creates or edits them), so they never enter session state.
 *
 * SEED GAP: `widget_instance` and `design_change` were not extracted into
 * `src/data/` by the plan agent. The widget rows below come straight out of
 * `assets/html/widget-instance.html` (17 rows, "17 records found") rather than
 * being invented; they should be promoted to `src/data/widgets.json` on the
 * next seed pass.
 */

export const WIDGET_INSTANCES = [
  { instance_id: 1, title: 'Contact us info', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 2, title: 'Footer Links', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 3, title: 'Sale Left Menu', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 4, title: 'Gear Left Menu', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 5, title: "Men's Left Menu", type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 6, title: "Women's Left Menu", type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 7, title: "What's New Left Menu", type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 8, title: 'Women Category Content', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 9, title: 'Training Category Content', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 10, title: 'Men Category Content', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 11, title: 'Gear Category Content', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 12, title: 'New Products Category Content', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 13, title: 'Sale Category Content', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 14, title: 'Home Page', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 15, title: 'Performance Fabrics', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 16, title: 'Eco Friendly', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
  { instance_id: 17, title: 'Login Info', type: 'CMS Static Block', theme: 'Magento Luma', sort_order: 0 },
]

/** The `Type` filter options rendered by the source's widget grid. */
/* F-04 — the source's Type filter/select posts the widget block's FQCN, not the
 * visible label, so `select_option(sel, 'Magento\\Cms\\Block\\Widget\\Page\\Link')`
 * is what an evaluator sends. Values and order read off the live source. */
export const WIDGET_TYPES = [
  { value: 'Magento\\Cms\\Block\\Widget\\Page\\Link', label: 'CMS Page Link' },
  { value: 'Magento\\Cms\\Block\\Widget\\Block', label: 'CMS Static Block' },
  { value: 'Magento\\Catalog\\Block\\Category\\Widget\\Link', label: 'Catalog Category Link' },
  { value: 'Magento\\Catalog\\Block\\Product\\Widget\\NewWidget', label: 'Catalog New Products List' },
  { value: 'Magento\\Catalog\\Block\\Product\\Widget\\Link', label: 'Catalog Product Link' },
  { value: 'Magento\\CatalogWidget\\Block\\Product\\ProductsList', label: 'Catalog Products List' },
  { value: 'Magento\\Sales\\Block\\Widget\\Guest\\Form', label: 'Orders and Returns' },
  { value: 'Magento\\Catalog\\Block\\Widget\\RecentlyCompared', label: 'Recently Compared Products' },
  { value: 'Magento\\Catalog\\Block\\Widget\\RecentlyViewed', label: 'Recently Viewed Products' },
]
