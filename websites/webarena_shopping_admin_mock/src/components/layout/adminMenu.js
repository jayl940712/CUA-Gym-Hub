/**
 * The admin left-rail menu, transcribed from the rendered `<nav class="admin__menu">`
 * in assets/html/dashboard.html — labels and hrefs verbatim, in source order.
 * Rail order: Dashboard, Sales, Catalog, Customers, Marketing, Content, Reports,
 * Stores, System, Find Partners & Extensions (DESIGN.md §5).
 */

export const ADMIN_MENU = [
  {
    id: 'dashboard', label: 'Dashboard', icon: 'dashboard', href: '/admin/admin/dashboard/',
    match: ['/admin/admin/dashboard'],
  },
  {
    id: 'sales', label: 'Sales', icon: 'sales', title: 'Sales',
    match: ['/admin/sales', '/admin/paypal/billing_agreement', '/admin/braintree/virtual', '/admin/admin/order_shipment'],
    groups: [
      {
        title: 'Operations', items: [
          { label: 'Orders', href: '/admin/sales/order/', titleLabel: 'Orders' },
          {
            label: 'Invoices', href: '/admin/sales/invoice/', titleLabel: 'Invoices',
            match: ['/admin/sales/invoice', '/admin/sales/order_invoice'],
          },
          {
            label: 'Shipments', href: '/admin/sales/shipment/', titleLabel: 'Shipments',
            match: ['/admin/sales/shipment', '/admin/sales/order_shipment', '/admin/admin/order_shipment'],
          },
          {
            label: 'Credit Memos', href: '/admin/sales/creditmemo/', titleLabel: 'Credit Memos',
            match: ['/admin/sales/creditmemo', '/admin/sales/order_creditmemo'],
          },
          { label: 'Billing Agreements', href: '/admin/paypal/billing_agreement/' },
          { label: 'Transactions', href: '/admin/sales/transactions/' },
          { label: 'Braintree Virtual Terminal', href: '/admin/braintree/virtual/' },
        ],
      },
    ],
  },
  {
    id: 'catalog', label: 'Catalog', icon: 'catalog', title: 'Catalog',
    match: ['/admin/catalog/product', '/admin/catalog/category'],
    groups: [
      {
        // Source submenu-group-title is "Inventory", not "Catalog"
        // (assets/html/dashboard.html, li#menu-magento-catalog-inventory).
        title: 'Inventory', items: [
          { label: 'Products', href: '/admin/catalog/product/', titleLabel: 'Products' },
          { label: 'Categories', href: '/admin/catalog/category/', titleLabel: 'Categories' },
        ],
      },
    ],
  },
  {
    id: 'customers', label: 'Customers', icon: 'customers', title: 'Customers',
    match: ['/admin/customer', '/admin/loginascustomer_log'],
    groups: [
      {
        title: null, items: [
          { label: 'All Customers', href: '/admin/customer/index/', titleLabel: 'Customers' },
          { label: 'Now Online', href: '/admin/customer/online/' },
          { label: 'Login as Customer Log', href: '/admin/loginascustomer_log/log/index/' },
          { label: 'Customer Groups', href: '/admin/customer/group/' },
        ],
      },
    ],
  },
  {
    id: 'marketing', label: 'Marketing', icon: 'marketing', title: 'Marketing',
    match: ['/admin/catalog_rule', '/admin/sales_rule', '/admin/newsletter', '/admin/admin/url_rewrite',
      '/admin/search/term', '/admin/search/synonyms', '/admin/admin/sitemap', '/admin/review/product',
      '/admin/admin/email_template'],
    groups: [
      {
        title: 'Promotions', items: [
          { label: 'Catalog Price Rule', href: '/admin/catalog_rule/promo_catalog/' },
          { label: 'Cart Price Rules', href: '/admin/sales_rule/promo_quote/' },
        ],
      },
      {
        title: 'Communications', items: [
          { label: 'Email Templates', href: '/admin/admin/email_template/' },
          { label: 'Newsletter Templates', href: '/admin/newsletter/template/' },
          { label: 'Newsletter Queue', href: '/admin/newsletter/queue/' },
          { label: 'Newsletter Subscribers', href: '/admin/newsletter/subscriber/' },
        ],
      },
      {
        title: 'SEO & Search', items: [
          {
            label: 'URL Rewrites', href: '/admin/admin/url_rewrite/index/',
            match: ['/admin/admin/url_rewrite'],
          },
          {
            label: 'Search Terms', href: '/admin/search/term/index/', titleLabel: 'Search Terms',
            // /admin/search/term/edit/id/N/ — must not fall through to the
            // Reports > Search Terms item at /admin/search/term/report/.
            // `/admin/search/term` is listed too — an agent types the bare path
            // and the source's own menu link resolves to it. Reports > Search
            // Terms still wins for `/admin/search/term/report/` on length.
            match: ['/admin/search/term', '/admin/search/term/index', '/admin/search/term/edit',
              '/admin/search/term/new'],
          },
          { label: 'Search Synonyms', href: '/admin/search/synonyms/index/' },
          { label: 'Site Map', href: '/admin/admin/sitemap/' },
        ],
      },
      {
        // Source <title> for every page under this group carries an extra
        // "Customer Reviews" level that the rail itself does not render —
        // e.g. "Reviews / Customer Reviews / User Content / Marketing".
        title: 'User Content', titlePath: ['Customer Reviews', 'User Content', 'Marketing'],
        items: [
          { label: 'All Reviews', href: '/admin/review/product/index/', match: ['/admin/review/product'] },
          { label: 'Pending Reviews', href: '/admin/review/product/pending/' },
        ],
      },
    ],
  },
  {
    id: 'content', label: 'Content', icon: 'content', title: 'Content',
    match: ['/admin/cms', '/admin/admin/widget_instance', '/admin/pagebuilder', '/admin/media_gallery',
      '/admin/theme/design_config', '/admin/admin/system_design'],
    groups: [
      {
        title: 'Elements', items: [
          { label: 'Pages', href: '/admin/cms/page/', titleLabel: 'Pages' },
          { label: 'Blocks', href: '/admin/cms/block/' },
          { label: 'Widgets', href: '/admin/admin/widget_instance/' },
          { label: 'Templates', href: '/admin/pagebuilder/template/' },
        ],
      },
      {
        title: 'Media', items: [
          { label: 'Media Gallery', href: '/admin/media_gallery/media/index/' },
        ],
      },
      {
        title: 'Design', items: [
          { label: 'Configuration', href: '/admin/theme/design_config/' },
          // The source's <h1> is "Themes" but its <title> is just
          // "Design / Content / Magento Admin" — this controller does not
          // prepend its page title. Verified live and in
          // assets/html/system-design-theme.html.
          { label: 'Themes', href: '/admin/admin/system_design_theme/', titleOmitsPageTitle: true },
          { label: 'Schedule', href: '/admin/admin/system_design/' },
        ],
      },
    ],
  },
  {
    id: 'reports', label: 'Reports', icon: 'reports', title: 'Reports',
    match: ['/admin/reports', '/admin/search/term/report', '/admin/analytics', '/admin/paypal/paypal_reports',
      '/admin/braintree/report'],
    groups: [
      {
        title: 'Marketing', items: [
          { label: 'Products in Cart', href: '/admin/reports/report_shopcart/product/' },
          { label: 'Search Terms', href: '/admin/search/term/report/' },
          { label: 'Abandoned Carts', href: '/admin/reports/report_shopcart/abandoned/' },
          { label: 'Newsletter Problem Reports', href: '/admin/newsletter/problem/' },
        ],
      },
      {
        title: 'Reviews', items: [
          { label: 'By Customers', href: '/admin/reports/report_review/customer/' },
          { label: 'By Products', href: '/admin/reports/report_review/product/' },
        ],
      },
      {
        title: 'Sales', items: [
          { label: 'Orders', href: '/admin/reports/report_sales/sales/' },
          { label: 'Tax', href: '/admin/reports/report_sales/tax/' },
          { label: 'Invoiced', href: '/admin/reports/report_sales/invoiced/' },
          { label: 'Shipping', href: '/admin/reports/report_sales/shipping/' },
          { label: 'Refunds', href: '/admin/reports/report_sales/refunded/' },
          { label: 'Coupons', href: '/admin/reports/report_sales/coupons/' },
          { label: 'PayPal Settlement', href: '/admin/paypal/paypal_reports/' },
          { label: 'Braintree Settlement', href: '/admin/braintree/report/' },
        ],
      },
      {
        title: 'Customers', items: [
          { label: 'Order Total', href: '/admin/reports/report_customer/totals/' },
          { label: 'Order Count', href: '/admin/reports/report_customer/orders/' },
          { label: 'New', href: '/admin/reports/report_customer/accounts/' },
        ],
      },
      {
        title: 'Products', items: [
          { label: 'Views', href: '/admin/reports/report_product/viewed/' },
          { label: 'Bestsellers', href: '/admin/reports/report_sales/bestsellers/' },
          { label: 'Low Stock', href: '/admin/reports/report_product/lowstock/' },
          { label: 'Ordered', href: '/admin/reports/report_product/sold/' },
          { label: 'Downloads', href: '/admin/reports/report_product/downloads/' },
        ],
      },
      {
        title: 'Statistics', items: [
          { label: 'Refresh Statistics', href: '/admin/reports/report_statistics/' },
        ],
      },
      {
        title: 'Business Intelligence', items: [
          { label: 'Advanced Reporting', href: '/admin/analytics/reports/show/' },
          { label: 'BI Essentials', href: '/admin/analytics/biessentials/signup/' },
        ],
      },
    ],
  },
  {
    id: 'stores', label: 'Stores', icon: 'stores', title: 'Stores',
    match: ['/admin/admin/system_store', '/admin/admin/system_config', '/admin/checkout/agreement',
      '/admin/sales/order_status', '/admin/inventory', '/admin/tax', '/admin/admin/system_currency',
      '/admin/admin/system_currencysymbol', '/admin/catalog/product_attribute', '/admin/catalog/product_set',
      '/admin/review/rating'],
    groups: [
      {
        title: 'Settings', items: [
          { label: 'All Stores', href: '/admin/admin/system_store/' },
          { label: 'Configuration', href: '/admin/admin/system_config/' },
          { label: 'Terms and Conditions', href: '/admin/checkout/agreement/' },
          { label: 'Order Status', href: '/admin/sales/order_status/' },
        ],
      },
      {
        title: 'Inventory', items: [
          { label: 'Sources', href: '/admin/inventory/source/index/' },
          { label: 'Stocks', href: '/admin/inventory/stock/index/' },
        ],
      },
      {
        title: 'Taxes', items: [
          { label: 'Tax Rules', href: '/admin/tax/rule/' },
          { label: 'Tax Zones and Rates', href: '/admin/tax/rate/' },
        ],
      },
      {
        title: 'Currency', items: [
          { label: 'Currency Rates', href: '/admin/admin/system_currency/' },
          { label: 'Currency Symbols', href: '/admin/admin/system_currencysymbol/' },
        ],
      },
      {
        title: 'Attributes', items: [
          { label: 'Product', href: '/admin/catalog/product_attribute/' },
          { label: 'Attribute Set', href: '/admin/catalog/product_set/' },
          { label: 'Rating', href: '/admin/review/rating/' },
        ],
      },
    ],
  },
  {
    id: 'system', label: 'System', icon: 'system', title: 'System',
    match: ['/admin/admin/import', '/admin/admin/export', '/admin/tax/rate/importExport', '/admin/admin/history',
      '/admin/admin/integration', '/admin/admin/cache', '/admin/indexer', '/admin/admin/user',
      '/admin/admin/locks', '/admin/admin/user_role', '/admin/bulk', '/admin/admin/notification',
      '/admin/admin/system_variable', '/admin/admin/crypt_key', '/admin/security/session'],
    groups: [
      {
        // Import / Export / tax import-export carry an extra "Import/Export"
        // level in the source <title> (assets/html/admin-import.html:
        // "Import / Import/Export / Data Transfer / System"); Import History
        // does not, so the override is per item.
        title: 'Data Transfer', items: [
          { label: 'Import', href: '/admin/admin/import/', titlePath: ['Import/Export', 'Data Transfer', 'System'] },
          { label: 'Export', href: '/admin/admin/export/', titlePath: ['Import/Export', 'Data Transfer', 'System'] },
          {
            label: 'Import/Export Tax Rates', href: '/admin/tax/rate/importExport/',
            titlePath: ['Import/Export', 'Data Transfer', 'System'],
          },
          { label: 'Import History', href: '/admin/admin/history/' },
        ],
      },
      {
        title: 'Extensions', items: [
          { label: 'Integrations', href: '/admin/admin/integration/' },
        ],
      },
      {
        title: 'Tools', items: [
          { label: 'Cache Management', href: '/admin/admin/cache/' },
          { label: 'Index Management', href: '/admin/indexer/indexer/list/' },
        ],
      },
      {
        title: 'Permissions', items: [
          { label: 'All Users', href: '/admin/admin/user/' },
          { label: 'Locked Users', href: '/admin/admin/locks/' },
          { label: 'User Roles', href: '/admin/admin/user_role/' },
        ],
      },
      {
        title: 'Action Logs', items: [
          { label: 'Bulk Actions', href: '/admin/bulk/index/' },
        ],
      },
      {
        title: 'Other Settings', items: [
          { label: 'Notifications', href: '/admin/admin/notification/' },
          { label: 'Custom Variables', href: '/admin/admin/system_variable/' },
          { label: 'Manage Encryption Key', href: '/admin/admin/crypt_key/' },
        ],
      },
    ],
  },
  {
    id: 'partners', label: 'Find Partners & Extensions', icon: 'partners',
    href: '/admin/marketplace/index/', match: ['/admin/marketplace'],
  },
]

/* ------------------------------------------------------------------ titles
 *
 * Magento's admin <title> is
 *
 *     <page title> [/ <section title>] / <menu ancestors…> / Magento Admin
 *
 * e.g. `Orders / Operations / Sales / Magento Admin` for the order grid and
 * `#000000299 / Orders / Operations / Sales / Magento Admin` for one order.
 * The menu-ancestor tail is the leaf's parent chain, which for this rail is
 * `[group.title, topLevel.label]` — overridable per group/item with
 * `titlePath` where the source menu nests deeper than the rail renders
 * (Marketing > User Content, System > Data Transfer).
 *
 * The optional `<section title>` segment is the controller's own index title,
 * prepended by detail/create/edit controllers. It is opt-in via `titleLabel`
 * because most sections do not prepend it.
 */

/** Strip the trailing slash so prefix tests land on a path boundary. */
function trimPath(p) {
  return p && p.length > 1 && p.endsWith('/') ? p.slice(0, -1) : p
}

function matchesPrefix(pathname, prefix) {
  const p = trimPath(prefix)
  return pathname === p || pathname.startsWith(`${p}/`)
}

/**
 * Every prefix a leaf answers to. Magento's front controller defaults a missing
 * action to `index`, so `/admin/inventory/source/` is the same page as
 * `/admin/inventory/source/index/` — and `/admin/inventory/source/new/` sits
 * under the same menu leaf. Deriving the bare controller path from each prefix
 * keeps the <title> menu path identical across all three forms.
 */
function itemPrefixes(item) {
  const declared = item.match || [item.href]
  const out = []
  for (const prefix of declared) {
    const p = trimPath(prefix)
    if (!out.includes(p)) out.push(p)
    if (p.endsWith('/index')) {
      const bare = p.slice(0, -'/index'.length)
      if (bare.length > 1 && !out.includes(bare)) out.push(bare)
    }
  }
  return out
}

/** Longest-prefix match of `pathname` against every leaf item in the rail. */
function findMenuLeaf(pathname) {
  const path = trimPath(pathname)
  let best = null
  let bestLen = 0
  for (const top of ADMIN_MENU) {
    for (const group of top.groups || []) {
      for (const item of group.items || []) {
        for (const prefix of itemPrefixes(item)) {
          const len = trimPath(prefix).length
          if (len > bestLen && matchesPrefix(path, prefix)) {
            best = { top, group, item }
            bestLen = len
          }
        }
      }
    }
  }
  return best
}

/**
 * The `<title>` segments between the page title and `Magento Admin`, in
 * source order (nearest ancestor first). Empty for pages outside the rail
 * (Dashboard, My Account).
 */
export function menuTitlePath(pathname, pageTitle = '') {
  const leaf = findMenuLeaf(pathname)
  if (!leaf) return []
  const { top, group, item } = leaf
  // A group whose title *is* the page title collapses — Content > Themes is
  // "Design / Content", not "Design / Design / Content". A top-level label that
  // repeats does not: Customers is "Customers / Customers".
  const groupTitle = group.title && group.title !== pageTitle ? group.title : null
  const ancestors = item.titlePath || group.titlePath || [groupTitle, top.label].filter(Boolean)
  const section = item.titleLabel && item.titleLabel !== pageTitle ? [item.titleLabel] : []
  return [...section, ...ancestors]
}

/**
 * The full `document.title` for a route: `<page title> / <menu path> /
 * Magento Admin`, minus the page title for the handful of controllers whose
 * source `<title>` does not prepend it (`titleOmitsPageTitle`).
 */
export function adminDocumentTitle(pathname, pageTitle = '') {
  const leaf = findMenuLeaf(pathname)
  const head = leaf && leaf.item.titleOmitsPageTitle ? [] : [pageTitle]
  return [...head, ...menuTitlePath(pathname, pageTitle), 'Magento Admin']
    .filter(Boolean)
    .join(' / ')
}

/** Which rail item should be highlighted for a given pathname. */
export function activeMenuId(pathname) {
  let best = null
  let bestLen = 0
  for (const item of ADMIN_MENU) {
    for (const prefix of item.match || []) {
      if (pathname.startsWith(prefix) && prefix.length > bestLen) {
        best = item.id
        bestLen = prefix.length
      }
    }
  }
  return best
}
