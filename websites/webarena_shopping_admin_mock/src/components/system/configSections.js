/**
 * Stores > Configuration — the section rail and the field definitions.
 *
 * The rail (7 collapsible tabs, 39 sections) is transcribed verbatim from
 * `assets/html/system-config.html`: same order, same labels, same section codes,
 * so `/admin/admin/system_config/edit/section/<code>/` matches the source for
 * every link the agent can click.
 *
 * FIELD DEFINITIONS: `core_config_data` holds only 34 rows because Magento's
 * effective configuration is overwhelmingly `config.xml` defaults that never
 * reach the DB (SOURCE.md / recon note). So the field maps below are read off
 * the *rendered* source form rather than the DB: `general` and `currency` were
 * captured in round 1; `catalog`, `sales` and `admin` were scraped field by
 * field from the live admin at localhost:7780 (labels, input names, option
 * lists, effective values and the "Use system value" state) — nothing here is
 * invented. `path` is derived from the source input name
 * (`groups[g][fields][f][value]` -> `<section>/<g>/<f>`) so an edit lands on the
 * same `core_config_data` path Magento would write.
 *
 * Rows the source renders with no editable control (image uploads, the
 * Elasticsearch "Test Connection" wizard) carry `type: 'static'`: the label is
 * kept for parity and the control is declined explicitly rather than faked.
 *
 * Sections still without a captured field map render the `core_config_data`
 * rows the DB actually has for them.
 */

import {
  TIMEZONE_OPTIONS, CONFIG_COUNTRY_OPTIONS, LOCALE_OPTIONS, FIRSTDAY_OPTIONS, EMAIL_IDENTITY_OPTIONS,
  CONFIG_COUNTRY_MULTI_OPTIONS, WEEKEND_OPTIONS,
  COUNTRY_ALLOW_DEFAULT, COUNTRY_EU_DEFAULT, COUNTRY_OPTIONAL_ZIP_DEFAULT, WEEKEND_DEFAULT,
} from './configVocabularies.js'
import {
  CURRENCY_OPTIONS, CURRENCY_IMPORT_SERVICE_OPTIONS, CURRENCY_IMPORT_FREQUENCY_OPTIONS,
} from './currencyVocabularies.js'


export const CONFIG_TABS = [
  {
    label: 'General',
    sections: [
      ['general', 'General'],
      ['web', 'Web'],
      ['currency', 'Currency Setup'],
      ['trans_email', 'Store Email Addresses'],
      ['contact', 'Contacts'],
      ['reports', 'Reports'],
      ['cms', 'Content Management'],
      ['newrelicreporting', 'New Relic Reporting'],
      ['analytics', 'Advanced Reporting'],
    ],
  },
  {
    label: 'Catalog',
    sections: [
      ['catalog', 'Catalog'],
      ['cataloginventory', 'Inventory'],
      ['sitemap', 'XML Sitemap'],
      ['rss', 'RSS Feeds'],
      ['sendfriend', 'Email to a Friend'],
    ],
  },
  {
    label: 'Security',
    sections: [
      ['magento_securitytxt_securitytxt', 'Security.txt'],
      ['recaptcha_backend', 'Google reCAPTCHA Admin Panel'],
      ['recaptcha_frontend', 'Google reCAPTCHA Storefront'],
    ],
  },
  {
    label: 'Customers',
    sections: [
      ['login_as_customer', 'Login as Customer'],
      ['newsletter', 'Newsletter'],
      ['customer', 'Customer Configuration'],
      ['wishlist', 'Wish List'],
      ['promo', 'Promotions'],
      ['persistent', 'Persistent Shopping Cart'],
    ],
  },
  {
    label: 'Sales',
    sections: [
      ['sales', 'Sales'],
      ['sales_email', 'Sales Emails'],
      ['sales_pdf', 'PDF Print-outs'],
      ['tax', 'Tax'],
      ['checkout', 'Checkout'],
      ['shipping', 'Shipping Settings'],
      ['multishipping', 'Multishipping Settings'],
      ['carriers', 'Delivery Methods'],
      ['google', 'Google API'],
      ['payment', 'Payment Methods'],
      ['three_d_secure', '3D Secure'],
    ],
  },
  {
    label: 'Services',
    sections: [
      ['webapi', 'Magento Web API'],
      ['oauth', 'OAuth'],
    ],
  },
  {
    label: 'Advanced',
    sections: [
      ['admin', 'Admin'],
      ['system', 'System'],
      ['dev', 'Developer'],
    ],
  },
]

export const SECTION_LABELS = {
  ...Object.fromEntries(CONFIG_TABS.flatMap(t => t.sections)),
  // not in the rail; the source answers /section/design/ with the General body
  design: 'General',
}

const YES_NO = [{ value: '1', label: 'Yes' }, { value: '0', label: 'No' }]

/**
 * Captured field definitions. `id` is the source's `<tr id="row_…">`, `name` its
 * input name, `path` the `core_config_data` path when the DB has one (so edits
 * land where the config screens and the rest of the mock read from).
 */
export const CONFIG_FIELDS = {
  general: [
    {
      group: 'Country Options',
      fields: [
        { id: 'general_country_default', label: 'Default Country', name: 'groups[country][fields][default][value]', type: 'select', value: 'US', options: CONFIG_COUNTRY_OPTIONS, inherit: true },
        /* F-01 — multiselects, not text inputs. `hiddenMirror` tracks the one
         * per-field quirk in the source: every one of these emits a hidden
         * `…[value]` mirror EXCEPT `eu_countries`, which emits only the
         * `…[value]_disabled` companion. */
        { id: 'general_country_allow', label: 'Allow Countries', name: 'groups[country][fields][allow][value]', type: 'multiselect', options: CONFIG_COUNTRY_MULTI_OPTIONS, value: COUNTRY_ALLOW_DEFAULT, inherit: true },
        { id: 'general_country_optional_zip_countries', label: 'Zip/Postal Code is Optional for', name: 'groups[country][fields][optional_zip_countries][value]', type: 'multiselect', options: CONFIG_COUNTRY_MULTI_OPTIONS, value: COUNTRY_OPTIONAL_ZIP_DEFAULT, inherit: true },
        { id: 'general_country_eu_countries', label: 'European Union Countries', name: 'groups[country][fields][eu_countries][value]', type: 'multiselect', options: CONFIG_COUNTRY_MULTI_OPTIONS, value: COUNTRY_EU_DEFAULT, inherit: true, hiddenMirror: false },
        { id: 'general_country_destinations', label: 'Top destinations', name: 'groups[country][fields][destinations][value]', type: 'multiselect', options: CONFIG_COUNTRY_MULTI_OPTIONS, value: '', inherit: false },
      ],
    },
    {
      group: 'State Options',
      fields: [
        { id: 'general_region_state_required', label: 'State is Required for', name: 'groups[region][fields][state_required][value]', type: 'multiselect', options: CONFIG_COUNTRY_MULTI_OPTIONS, path: 'general/region/state_required' },
        { id: 'general_region_display_all', label: 'Allow to Choose State if It is Optional for Country', name: 'groups[region][fields][display_all][value]', type: 'select', options: YES_NO, path: 'general/region/display_all' },
      ],
    },
    {
      group: 'Locale Options',
      fields: [
        { id: 'general_locale_timezone', label: 'Timezone', name: 'groups[locale][fields][timezone][value]', type: 'select', path: 'general/locale/timezone', options: TIMEZONE_OPTIONS },
        { id: 'general_locale_code', label: 'Locale', name: 'groups[locale][fields][code][value]', type: 'select', path: 'general/locale/code', options: LOCALE_OPTIONS },
        { id: 'general_locale_weight_unit', label: 'Weight Unit', name: 'groups[locale][fields][weight_unit][value]', type: 'select', value: 'lbs', options: [{ value: 'lbs', label: 'lbs' }, { value: 'kgs', label: 'kgs' }], inherit: true },
        { id: 'general_locale_firstday', label: 'First Day of Week', name: 'groups[locale][fields][firstday][value]', type: 'select', value: '0', options: FIRSTDAY_OPTIONS, inherit: true },
        { id: 'general_locale_weekend', label: 'Weekend Days', name: 'groups[locale][fields][weekend][value]', type: 'multiselect', options: WEEKEND_OPTIONS, value: WEEKEND_DEFAULT, inherit: true },
      ],
    },
    {
      group: 'Store Information',
      fields: [
        { id: 'general_store_information_name', label: 'Store Name', name: 'groups[store_information][fields][name][value]', type: 'text', value: '' },
        { id: 'general_store_information_phone', label: 'Store Phone Number', name: 'groups[store_information][fields][phone][value]', type: 'text', value: '' },
        { id: 'general_store_information_hours', label: 'Store Hours of Operation', name: 'groups[store_information][fields][hours][value]', type: 'text', value: '' },
        { id: 'general_store_information_country_id', label: 'Country', name: 'groups[store_information][fields][country_id][value]', type: 'select', value: '', options: CONFIG_COUNTRY_OPTIONS },
        { id: 'general_store_information_region_id', label: 'Region/State', name: 'groups[store_information][fields][region_id][value]', type: 'text', value: '' },
        { id: 'general_store_information_postcode', label: 'ZIP/Postal Code', name: 'groups[store_information][fields][postcode][value]', type: 'text', value: '' },
        { id: 'general_store_information_city', label: 'City', name: 'groups[store_information][fields][city][value]', type: 'text', value: '' },
        { id: 'general_store_information_street_line1', label: 'Street Address', name: 'groups[store_information][fields][street_line1][value]', type: 'text', value: '' },
        { id: 'general_store_information_street_line2', label: 'Street Address Line 2', name: 'groups[store_information][fields][street_line2][value]', type: 'text', value: '' },
        { id: 'general_store_information_merchant_vat_number', label: 'VAT Number', name: 'groups[store_information][fields][merchant_vat_number][value]', type: 'text', value: '' },
      ],
    },
    {
      group: 'Single-Store Mode',
      fields: [
        { id: 'general_single_store_mode_enabled', label: 'Enable Single-Store Mode', name: 'groups[single_store_mode][fields][enabled][value]', type: 'select', value: '0', options: YES_NO },
      ],
    },
  ],
  /**
   * G-05. Three defects lived here, all of them classes this migration has
   * already been burned by elsewhere:
   *   - `allow` was a `<input type="text">` where the source has the same
   *     `multiselect` + hidden-mirror shape that was fixed one section over in
   *     `general` — the fix had been applied per-section instead of per-class;
   *   - `base` / `default` carried a 2-option list trimmed out of the source's
   *     real 168 (now `CURRENCY_OPTIONS`, captured verbatim);
   *   - all three defaulted to "Use system value" *checked*, where the source
   *     renders them overridden — `inheritDefault: false`.
   * The API keys are `type="password"` on the source, and the Scheduled Import
   * group's Service / Start Time / Frequency rows were missing entirely.
   */
  currency: [
    {
      group: 'Currency Options',
      fields: [
        { id: 'currency_options_base', label: 'Base Currency', name: 'groups[options][fields][base][value]', type: 'select', path: 'currency/options/base', value: 'USD', options: CURRENCY_OPTIONS, inherit: true, inheritDefault: false },
        { id: 'currency_options_default', label: 'Default Display Currency', name: 'groups[options][fields][default][value]', type: 'select', path: 'currency/options/default', value: 'USD', options: CURRENCY_OPTIONS, inherit: true, inheritDefault: false },
        { id: 'currency_options_allow', label: 'Allowed Currencies', name: 'groups[options][fields][allow][value]', type: 'multiselect', path: 'currency/options/allow', value: 'USD', options: CURRENCY_OPTIONS, inherit: true, inheritDefault: false },
      ],
    },
    {
      group: 'Fixer.io',
      fields: [
        { id: 'currency_fixerio_api_key', label: 'API Key', name: 'groups[fixerio][fields][api_key][value]', type: 'password', value: '' },
        { id: 'currency_fixerio_timeout', label: 'Connection Timeout in Seconds', name: 'groups[fixerio][fields][timeout][value]', type: 'text', value: '100' },
      ],
    },
    {
      group: 'Fixer.io (Apilayer)',
      fields: [
        { id: 'currency_fixerio_apilayer_api_key', label: 'API Key', name: 'groups[fixerio_apilayer][fields][api_key][value]', type: 'password', value: '' },
        { id: 'currency_fixerio_apilayer_timeout', label: 'Connection Timeout in Seconds', name: 'groups[fixerio_apilayer][fields][timeout][value]', type: 'text', value: '100' },
      ],
    },
    {
      group: 'Currency Converter API',
      fields: [
        { id: 'currency_currencyconverterapi_api_key', label: 'API Key', name: 'groups[currencyconverterapi][fields][api_key][value]', type: 'password', value: '' },
        { id: 'currency_currencyconverterapi_timeout', label: 'Connection Timeout in Seconds', name: 'groups[currencyconverterapi][fields][timeout][value]', type: 'text', value: '100' },
      ],
    },
    {
      group: 'Scheduled Import Settings',
      fields: [
        { id: 'currency_import_enabled', label: 'Enabled', name: 'groups[import][fields][enabled][value]', type: 'select', value: '0', options: YES_NO, inherit: true },
        { id: 'currency_import_service', label: 'Service', name: 'groups[import][fields][service][value]', type: 'select', value: 'fixerio', options: CURRENCY_IMPORT_SERVICE_OPTIONS },
        { id: 'currency_import_time', label: 'Start Time', name: 'groups[import][fields][time][value][]', type: 'time', value: '00,00,00' },
        { id: 'currency_import_frequency', label: 'Frequency', name: 'groups[import][fields][frequency][value]', type: 'select', value: 'D', options: CURRENCY_IMPORT_FREQUENCY_OPTIONS },
        { id: 'currency_import_error_email', label: 'Error Email Recipient', name: 'groups[import][fields][error_email][value]', type: 'text', value: '' },
        { id: 'currency_import_error_email_identity', label: 'Error Email Sender', name: 'groups[import][fields][error_email_identity][value]', type: 'select', value: 'general', options: EMAIL_IDENTITY_OPTIONS, inherit: true },
        { id: 'currency_import_error_email_template', label: 'Error Email Template', name: 'groups[import][fields][error_email_template][value]', type: 'select', value: 'currency_import_error_email_template', options: [{ value: 'currency_import_error_email_template', label: 'Currency Update Warnings (Default)' }], inherit: true },
      ],
    },
  ],
  catalog: [
    {
      group: "Product Fields Auto-Generation",
      fields: [
        { id: "catalog_fields_masks_sku", label: "Mask for SKU", name: "groups[fields_masks][fields][sku][value]", type: "text", path: "catalog/fields_masks/sku", value: "{{name}}", inherit: true },
        { id: "catalog_fields_masks_meta_title", label: "Mask for Meta Title", name: "groups[fields_masks][fields][meta_title][value]", type: "text", path: "catalog/fields_masks/meta_title", value: "{{name}}", inherit: true },
        { id: "catalog_fields_masks_meta_keyword", label: "Mask for Meta Keywords", name: "groups[fields_masks][fields][meta_keyword][value]", type: "text", path: "catalog/fields_masks/meta_keyword", value: "{{name}}", inherit: true },
        { id: "catalog_fields_masks_meta_description", label: "Mask for Meta Description", name: "groups[fields_masks][fields][meta_description][value]", type: "text", path: "catalog/fields_masks/meta_description", value: "{{name}} {{description}}", inherit: true },
      ],
    },
    {
      group: "Storefront",
      fields: [
        { id: "catalog_frontend_list_mode", label: "List Mode", name: "groups[frontend][fields][list_mode][value]", type: "select", path: "catalog/frontend/list_mode", value: "grid-list", options: [{ value: "grid", label: "Grid Only" }, { value: "list", label: "List Only" }, { value: "grid-list", label: "Grid (default) / List" }, { value: "list-grid", label: "List (default) / Grid" }], inherit: true },
        { id: "catalog_frontend_grid_per_page_values", label: "Products per Page on Grid Allowed Values", name: "groups[frontend][fields][grid_per_page_values][value]", type: "text", path: "catalog/frontend/grid_per_page_values", value: "12,24,36", inherit: true },
        { id: "catalog_frontend_grid_per_page", label: "Products per Page on Grid Default Value", name: "groups[frontend][fields][grid_per_page][value]", type: "text", path: "catalog/frontend/grid_per_page", value: "12", inherit: true },
        { id: "catalog_frontend_list_per_page_values", label: "Products per Page on List Allowed Values", name: "groups[frontend][fields][list_per_page_values][value]", type: "text", path: "catalog/frontend/list_per_page_values", value: "5,10,15,20,25", inherit: true },
        { id: "catalog_frontend_list_per_page", label: "Products per Page on List Default Value", name: "groups[frontend][fields][list_per_page][value]", type: "text", path: "catalog/frontend/list_per_page", value: "10", inherit: true },
        { id: "catalog_frontend_default_sort_by", label: "Product Listing Sort by", name: "groups[frontend][fields][default_sort_by][value]", type: "select", path: "catalog/frontend/default_sort_by", value: "position", options: [{ value: "position", label: "Position" }, { value: "name", label: "Product Name" }, { value: "price", label: "Price" }], inherit: true },
        { id: "catalog_frontend_list_allow_all", label: "Allow All Products per Page", name: "groups[frontend][fields][list_allow_all][value]", type: "select", path: "catalog/frontend/list_allow_all", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_frontend_remember_pagination", label: "Remember Category Pagination", name: "groups[frontend][fields][remember_pagination][value]", type: "select", path: "catalog/frontend/remember_pagination", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_frontend_flat_catalog_category", label: "Use Flat Catalog Category", name: "groups[frontend][fields][flat_catalog_category][value]", type: "select", path: "catalog/frontend/flat_catalog_category", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_frontend_flat_catalog_product", label: "Use Flat Catalog Product", name: "groups[frontend][fields][flat_catalog_product][value]", type: "select", path: "catalog/frontend/flat_catalog_product", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_frontend_swatches_per_product", label: "Swatches per Product", name: "groups[frontend][fields][swatches_per_product][value]", type: "text", path: "catalog/frontend/swatches_per_product", value: "16", inherit: true },
        { id: "catalog_frontend_show_swatches_in_product_list", label: "Show Swatches in Product List", name: "groups[frontend][fields][show_swatches_in_product_list][value]", type: "select", path: "catalog/frontend/show_swatches_in_product_list", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_frontend_show_swatch_tooltip", label: "Show Swatch Tooltip", name: "groups[frontend][fields][show_swatch_tooltip][value]", type: "select", path: "catalog/frontend/show_swatch_tooltip", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
      ],
    },
    {
      group: "Product Reviews",
      fields: [
        { id: "catalog_review_active", label: "Enabled", name: "groups[review][fields][active][value]", type: "select", path: "catalog/review/active", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_review_allow_guest", label: "Allow Guests to Write Reviews", name: "groups[review][fields][allow_guest][value]", type: "select", path: "catalog/review/allow_guest", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
      ],
    },
    {
      group: "Product Alerts",
      fields: [
        { id: "catalog_productalert_allow_price", label: "Allow Alert When Product Price Changes", name: "groups[productalert][fields][allow_price][value]", type: "select", path: "catalog/productalert/allow_price", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_productalert_email_price_template", label: "Price Alert Email Template", name: "groups[productalert][fields][email_price_template][value]", type: "select", path: "catalog/productalert/email_price_template", value: "catalog_productalert_email_price_template", options: [{ value: "catalog_productalert_email_price_template", label: "Price Alert (Default)" }], inherit: true },
        { id: "catalog_productalert_allow_stock", label: "Allow Alert When Product Comes Back in Stock", name: "groups[productalert][fields][allow_stock][value]", type: "select", path: "catalog/productalert/allow_stock", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_productalert_email_stock_template", label: "Stock Alert Email Template", name: "groups[productalert][fields][email_stock_template][value]", type: "select", path: "catalog/productalert/email_stock_template", value: "catalog_productalert_email_stock_template", options: [{ value: "catalog_productalert_email_stock_template", label: "Stock Alert (Default)" }], inherit: true },
        { id: "catalog_productalert_email_identity", label: "Alert Email Sender", name: "groups[productalert][fields][email_identity][value]", type: "select", path: "catalog/productalert/email_identity", value: "general", options: [{ value: "general", label: "General Contact" }, { value: "sales", label: "Sales Representative" }, { value: "support", label: "Customer Support" }, { value: "custom1", label: "Custom Email 1" }, { value: "custom2", label: "Custom Email 2" }], inherit: true },
      ],
    },
    {
      group: "Product Alerts Run Settings",
      fields: [
        { id: "catalog_productalert_cron_frequency", label: "Frequency", name: "groups[productalert_cron][fields][frequency][value]", type: "select", path: "catalog/productalert_cron/frequency", value: "D", options: [{ value: "D", label: "Daily" }, { value: "W", label: "Weekly" }, { value: "M", label: "Monthly" }] },
        /* Magento's Start Time is one row of three sibling `type="time"`
         * selects sharing `…[time][value][]` (hours / minutes / seconds); the
         * mock rendered a single hours-only select. */
        { id: "catalog_productalert_cron_time", label: "Start Time", name: "groups[productalert_cron][fields][time][value][]", type: "time", path: "catalog/productalert_cron/time", value: "00,00,00" },
        { id: "catalog_productalert_cron_error_email", label: "Error Email Recipient", name: "groups[productalert_cron][fields][error_email][value]", type: "text", path: "catalog/productalert_cron/error_email", value: "" },
        { id: "catalog_productalert_cron_error_email_identity", label: "Error Email Sender", name: "groups[productalert_cron][fields][error_email_identity][value]", type: "select", path: "catalog/productalert_cron/error_email_identity", value: "general", options: [{ value: "general", label: "General Contact" }, { value: "sales", label: "Sales Representative" }, { value: "support", label: "Customer Support" }, { value: "custom1", label: "Custom Email 1" }, { value: "custom2", label: "Custom Email 2" }], inherit: true },
        { id: "catalog_productalert_cron_error_email_template", label: "Error Email Template", name: "groups[productalert_cron][fields][error_email_template][value]", type: "select", path: "catalog/productalert_cron/error_email_template", value: "catalog_productalert_cron_error_email_template", options: [{ value: "catalog_productalert_cron_error_email_template", label: "Cron Error Warning (Default)" }], inherit: true },
      ],
    },
    {
      group: "Product Image Placeholders",
      fields: [
        { id: "catalog_placeholder_image_placeholder", label: "Base", type: "static" },
        { id: "catalog_placeholder_small_image_placeholder", label: "Small", type: "static" },
        { id: "catalog_placeholder_thumbnail_placeholder", label: "Thumbnail", type: "static" },
        { id: "catalog_placeholder_swatch_image_placeholder", label: "Swatch", type: "static" },
      ],
    },
    {
      group: "Recently Viewed/Compared Products",
      fields: [
        { id: "catalog_recently_products_synchronize_with_backend", label: "Synchronize widget products with backend storage", name: "groups[recently_products][fields][synchronize_with_backend][value]", type: "select", path: "catalog/recently_products/synchronize_with_backend", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_recently_products_scope", label: "Show for Current", name: "groups[recently_products][fields][scope][value]", type: "select", path: "catalog/recently_products/scope", value: "website", options: [{ value: "website", label: "Website" }, { value: "group", label: "Store" }, { value: "store", label: "Store View" }], inherit: true },
        { id: "catalog_recently_products_viewed_count", label: "Default Recently Viewed Products Count", name: "groups[recently_products][fields][viewed_count][value]", type: "text", path: "catalog/recently_products/viewed_count", value: "5", inherit: true },
        { id: "catalog_recently_products_compared_count", label: "Default Recently Compared Products Count", name: "groups[recently_products][fields][compared_count][value]", type: "text", path: "catalog/recently_products/compared_count", value: "5", inherit: true },
        { id: "catalog_recently_products_recently_viewed_lifetime", label: "Lifetime of products in Recently Viewed Widget", name: "groups[recently_products][fields][recently_viewed_lifetime][value]", type: "text", path: "catalog/recently_products/recently_viewed_lifetime", value: "1000", inherit: true },
        { id: "catalog_recently_products_recently_compared_lifetime", label: "Lifetime of products in Recently Compared Widget", name: "groups[recently_products][fields][recently_compared_lifetime][value]", type: "text", path: "catalog/recently_products/recently_compared_lifetime", value: "1000", inherit: true },
      ],
    },
    {
      group: "Product Video",
      fields: [
        { id: "catalog_product_video_youtube_api_key", label: "YouTube API Key", name: "groups[product_video][fields][youtube_api_key][value]", type: "text", path: "catalog/product_video/youtube_api_key", value: "" },
        { id: "catalog_product_video_play_if_base", label: "Autostart base video", name: "groups[product_video][fields][play_if_base][value]", type: "select", path: "catalog/product_video/play_if_base", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_product_video_show_related", label: "Show related video", name: "groups[product_video][fields][show_related][value]", type: "select", path: "catalog/product_video/show_related", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_product_video_video_auto_restart", label: "Auto restart video", name: "groups[product_video][fields][video_auto_restart][value]", type: "select", path: "catalog/product_video/video_auto_restart", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
      ],
    },
    {
      group: "Price",
      fields: [
        { id: "catalog_price_scope", label: "Catalog Price Scope", name: "groups[price][fields][scope][value]", type: "select", path: "catalog/price/scope", value: "0", options: [{ value: "0", label: "Global" }, { value: "1", label: "Website" }] },
      ],
    },
    {
      group: "Layered Navigation",
      fields: [
        { id: "catalog_layered_navigation_display_product_count", label: "Display Product Count", name: "groups[layered_navigation][fields][display_product_count][value]", type: "select", path: "catalog/layered_navigation/display_product_count", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_layered_navigation_price_range_calculation", label: "Price Navigation Step Calculation", name: "groups[layered_navigation][fields][price_range_calculation][value]", type: "select", path: "catalog/layered_navigation/price_range_calculation", value: "auto", options: [{ value: "auto", label: "Automatic (equalize price ranges)" }, { value: "improved", label: "Automatic (equalize product counts)" }, { value: "manual", label: "Manual" }], inherit: true },
        { id: "catalog_layered_navigation_price_range_step", label: "Default Price Navigation Step", name: "groups[layered_navigation][fields][price_range_step][value]", type: "text", path: "catalog/layered_navigation/price_range_step", value: "100", inherit: true },
        { id: "catalog_layered_navigation_one_price_interval", label: "Display Price Interval as One Price", name: "groups[layered_navigation][fields][one_price_interval][value]", type: "select", path: "catalog/layered_navigation/one_price_interval", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_layered_navigation_price_range_max_intervals", label: "Maximum Number of Price Intervals", name: "groups[layered_navigation][fields][price_range_max_intervals][value]", type: "text", path: "catalog/layered_navigation/price_range_max_intervals", value: "10", inherit: true },
        { id: "catalog_layered_navigation_interval_division_limit", label: "Interval Division Limit", name: "groups[layered_navigation][fields][interval_division_limit][value]", type: "text", path: "catalog/layered_navigation/interval_division_limit", value: "9", inherit: true },
        { id: "catalog_layered_navigation_display_category", label: "Display Category Filter", name: "groups[layered_navigation][fields][display_category][value]", type: "select", path: "catalog/layered_navigation/display_category", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
      ],
    },
    {
      group: "Search Engine Optimization",
      fields: [
        { id: "catalog_seo_search_terms", label: "Popular Search Terms", name: "groups[seo][fields][search_terms][value]", type: "select", path: "catalog/seo/search_terms", value: "1", options: [{ value: "1", label: "Enable" }, { value: "0", label: "Disable" }], inherit: true },
        { id: "catalog_seo_product_url_suffix", label: "Product URL Suffix", name: "groups[seo][fields][product_url_suffix][value]", type: "text", path: "catalog/seo/product_url_suffix", value: ".html", inherit: true },
        { id: "catalog_seo_category_url_suffix", label: "Category URL Suffix", name: "groups[seo][fields][category_url_suffix][value]", type: "text", path: "catalog/seo/category_url_suffix", value: ".html", inherit: true },
        { id: "catalog_seo_product_use_categories", label: "Use Categories Path for Product URLs", name: "groups[seo][fields][product_use_categories][value]", type: "select", path: "catalog/seo/product_use_categories", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_seo_save_rewrites_history", label: "Create Permanent Redirect for URLs if URL Key Changed", name: "groups[seo][fields][save_rewrites_history][value]", type: "select", path: "catalog/seo/save_rewrites_history", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_seo_generate_category_product_rewrites", label: "Generate \"category/product\" URL Rewrites", name: "groups[seo][fields][generate_category_product_rewrites][value]", type: "select", path: "catalog/seo/generate_category_product_rewrites", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_seo_title_separator", label: "Page Title Separator", name: "groups[seo][fields][title_separator][value]", type: "text", path: "catalog/seo/title_separator", value: "-", inherit: true },
        { id: "catalog_seo_category_canonical_tag", label: "Use Canonical Link Meta Tag For Categories", name: "groups[seo][fields][category_canonical_tag][value]", type: "select", path: "catalog/seo/category_canonical_tag", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_seo_product_canonical_tag", label: "Use Canonical Link Meta Tag For Products", name: "groups[seo][fields][product_canonical_tag][value]", type: "select", path: "catalog/seo/product_canonical_tag", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
      ],
    },
    {
      group: "Category Top Navigation",
      fields: [
        { id: "catalog_navigation_max_depth", label: "Maximal Depth", name: "groups[navigation][fields][max_depth][value]", type: "text", path: "catalog/navigation/max_depth", value: "0", inherit: true },
      ],
    },
    {
      group: "Catalog Search",
      fields: [
        { id: "catalog_search_min_query_length", label: "Minimal Query Length", name: "groups[search][fields][min_query_length][value]", type: "text", path: "catalog/search/min_query_length", value: "3", inherit: true },
        { id: "catalog_search_max_query_length", label: "Maximum Query Length", name: "groups[search][fields][max_query_length][value]", type: "text", path: "catalog/search/max_query_length", value: "128", inherit: true },
        { id: "catalog_search_max_count_cacheable_search_terms", label: "Number of top search results to cache", name: "groups[search][fields][max_count_cacheable_search_terms][value]", type: "text", path: "catalog/search/max_count_cacheable_search_terms", value: "100", inherit: true },
        { id: "catalog_search_enable_eav_indexer", label: "Enable EAV Indexer", name: "groups[search][fields][enable_eav_indexer][value]", type: "select", path: "catalog/search/enable_eav_indexer", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_search_autocomplete_limit", label: "Autocomplete Limit", name: "groups[search][fields][autocomplete_limit][value]", type: "text", path: "catalog/search/autocomplete_limit", value: "8", inherit: true },
        { id: "catalog_search_engine", label: "Search Engine", name: "groups[search][fields][engine][value]", type: "select", path: "catalog/search/engine", value: "opensearch", options: [{ value: "", label: "--Please Select--" }, { value: "elasticsearch5", label: "Elasticsearch 5.0+ (Deprecated)" }, { value: "elasticsearch7", label: "Elasticsearch 7" }, { value: "opensearch", label: "OpenSearch" }], inherit: true },
        { id: "catalog_search_elasticsearch5_server_hostname", label: "Elasticsearch Server Hostname", name: "groups[search][fields][elasticsearch5_server_hostname][value]", type: "text", path: "catalog/search/elasticsearch5_server_hostname", value: "localhost" },
        { id: "catalog_search_elasticsearch7_server_hostname", label: "Elasticsearch Server Hostname", name: "groups[search][fields][elasticsearch7_server_hostname][value]", type: "text", path: "catalog/search/elasticsearch7_server_hostname", value: "localhost" },
        { id: "catalog_search_opensearch_server_hostname", label: "OpenSearch Server Hostname", name: "groups[search][fields][opensearch_server_hostname][value]", type: "text", path: "catalog/search/opensearch_server_hostname", value: "localhost" },
        { id: "catalog_search_elasticsearch5_server_port", label: "Elasticsearch Server Port", name: "groups[search][fields][elasticsearch5_server_port][value]", type: "text", path: "catalog/search/elasticsearch5_server_port", value: "9200" },
        { id: "catalog_search_elasticsearch7_server_port", label: "Elasticsearch Server Port", name: "groups[search][fields][elasticsearch7_server_port][value]", type: "text", path: "catalog/search/elasticsearch7_server_port", value: "9200" },
        { id: "catalog_search_opensearch_server_port", label: "OpenSearch Server Port", name: "groups[search][fields][opensearch_server_port][value]", type: "text", path: "catalog/search/opensearch_server_port", value: "9200" },
        { id: "catalog_search_elasticsearch5_index_prefix", label: "Elasticsearch Index Prefix", name: "groups[search][fields][elasticsearch5_index_prefix][value]", type: "text", path: "catalog/search/elasticsearch5_index_prefix", value: "magento2" },
        { id: "catalog_search_elasticsearch7_index_prefix", label: "Elasticsearch Index Prefix", name: "groups[search][fields][elasticsearch7_index_prefix][value]", type: "text", path: "catalog/search/elasticsearch7_index_prefix", value: "magento2" },
        { id: "catalog_search_opensearch_index_prefix", label: "OpenSearch Index Prefix", name: "groups[search][fields][opensearch_index_prefix][value]", type: "text", path: "catalog/search/opensearch_index_prefix", value: "magento2" },
        { id: "catalog_search_elasticsearch5_enable_auth", label: "Enable Elasticsearch HTTP Auth", name: "groups[search][fields][elasticsearch5_enable_auth][value]", type: "select", path: "catalog/search/elasticsearch5_enable_auth", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }] },
        { id: "catalog_search_elasticsearch7_enable_auth", label: "Enable Elasticsearch HTTP Auth", name: "groups[search][fields][elasticsearch7_enable_auth][value]", type: "select", path: "catalog/search/elasticsearch7_enable_auth", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }] },
        { id: "catalog_search_opensearch_enable_auth", label: "Enable OpenSearch HTTP Auth", name: "groups[search][fields][opensearch_enable_auth][value]", type: "select", path: "catalog/search/opensearch_enable_auth", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }] },
        { id: "catalog_search_elasticsearch5_username", label: "Elasticsearch HTTP Username", name: "groups[search][fields][elasticsearch5_username][value]", type: "text", path: "catalog/search/elasticsearch5_username", value: "" },
        { id: "catalog_search_elasticsearch7_username", label: "Elasticsearch HTTP Username", name: "groups[search][fields][elasticsearch7_username][value]", type: "text", path: "catalog/search/elasticsearch7_username", value: "" },
        { id: "catalog_search_opensearch_username", label: "OpenSearch HTTP Username", name: "groups[search][fields][opensearch_username][value]", type: "text", path: "catalog/search/opensearch_username", value: "" },
        { id: "catalog_search_elasticsearch5_password", label: "Elasticsearch HTTP Password", name: "groups[search][fields][elasticsearch5_password][value]", type: "text", path: "catalog/search/elasticsearch5_password", value: "" },
        { id: "catalog_search_elasticsearch7_password", label: "Elasticsearch HTTP Password", name: "groups[search][fields][elasticsearch7_password][value]", type: "text", path: "catalog/search/elasticsearch7_password", value: "" },
        { id: "catalog_search_opensearch_password", label: "OpenSearch HTTP Password", name: "groups[search][fields][opensearch_password][value]", type: "text", path: "catalog/search/opensearch_password", value: "" },
        { id: "catalog_search_elasticsearch5_server_timeout", label: "Elasticsearch Server Timeout", name: "groups[search][fields][elasticsearch5_server_timeout][value]", type: "text", path: "catalog/search/elasticsearch5_server_timeout", value: "15" },
        { id: "catalog_search_elasticsearch7_server_timeout", label: "Elasticsearch Server Timeout", name: "groups[search][fields][elasticsearch7_server_timeout][value]", type: "text", path: "catalog/search/elasticsearch7_server_timeout", value: "15" },
        { id: "catalog_search_opensearch_server_timeout", label: "OpenSearch Server Timeout", name: "groups[search][fields][opensearch_server_timeout][value]", type: "text", path: "catalog/search/opensearch_server_timeout", value: "15" },
        { id: "catalog_search_elasticsearch5_test_connect_wizard", label: "", type: "static" },
        { id: "catalog_search_elasticsearch7_test_connect_wizard", label: "", type: "static" },
        { id: "catalog_search_opensearch_test_connect_wizard", label: "", type: "static" },
        { id: "catalog_search_search_recommendations_enabled", label: "Enable Search Recommendations", name: "groups[search][fields][search_recommendations_enabled][value]", type: "select", path: "catalog/search/search_recommendations_enabled", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_search_search_recommendations_count", label: "Search Recommendations Count", name: "groups[search][fields][search_recommendations_count][value]", type: "text", path: "catalog/search/search_recommendations_count", value: "5", inherit: true },
        { id: "catalog_search_search_recommendations_count_results_enabled", label: "Show Results Count for Each Recommendation", name: "groups[search][fields][search_recommendations_count_results_enabled][value]", type: "select", path: "catalog/search/search_recommendations_count_results_enabled", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_search_search_suggestion_enabled", label: "Enable Search Suggestions", name: "groups[search][fields][search_suggestion_enabled][value]", type: "select", path: "catalog/search/search_suggestion_enabled", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_search_search_suggestion_count", label: "Search Suggestions Count", name: "groups[search][fields][search_suggestion_count][value]", type: "text", path: "catalog/search/search_suggestion_count", value: "2", inherit: true },
        { id: "catalog_search_search_suggestion_count_results_enabled", label: "Show Results Count for Each Suggestion", name: "groups[search][fields][search_suggestion_count_results_enabled][value]", type: "select", path: "catalog/search/search_suggestion_count_results_enabled", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_search_elasticsearch5_minimum_should_match", label: "Minimum Terms to Match", name: "groups[search][fields][elasticsearch5_minimum_should_match][value]", type: "text", path: "catalog/search/elasticsearch5_minimum_should_match", value: "" },
        { id: "catalog_search_elasticsearch7_minimum_should_match", label: "Minimum Terms to Match", name: "groups[search][fields][elasticsearch7_minimum_should_match][value]", type: "text", path: "catalog/search/elasticsearch7_minimum_should_match", value: "" },
        { id: "catalog_search_opensearch_minimum_should_match", label: "Minimum Terms to Match", name: "groups[search][fields][opensearch_minimum_should_match][value]", type: "text", path: "catalog/search/opensearch_minimum_should_match", value: "" },
      ],
    },
    {
      group: "Downloadable Product Options",
      fields: [
        { id: "catalog_downloadable_order_item_status", label: "Order Item Status to Enable Downloads", name: "groups[downloadable][fields][order_item_status][value]", type: "select", path: "catalog/downloadable/order_item_status", value: "9", options: [{ value: "1", label: "Pending" }, { value: "9", label: "Invoiced" }], inherit: true },
        { id: "catalog_downloadable_downloads_number", label: "Default Maximum Number of Downloads", name: "groups[downloadable][fields][downloads_number][value]", type: "text", path: "catalog/downloadable/downloads_number", value: "0", inherit: true },
        { id: "catalog_downloadable_shareable", label: "Shareable", name: "groups[downloadable][fields][shareable][value]", type: "select", path: "catalog/downloadable/shareable", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_downloadable_samples_title", label: "Default Sample Title", name: "groups[downloadable][fields][samples_title][value]", type: "text", path: "catalog/downloadable/samples_title", value: "Samples", inherit: true },
        { id: "catalog_downloadable_links_title", label: "Default Link Title", name: "groups[downloadable][fields][links_title][value]", type: "text", path: "catalog/downloadable/links_title", value: "Links", inherit: true },
        { id: "catalog_downloadable_links_target_new_window", label: "Open Links in New Window", name: "groups[downloadable][fields][links_target_new_window][value]", type: "select", path: "catalog/downloadable/links_target_new_window", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "catalog_downloadable_content_disposition", label: "Use Content-Disposition", name: "groups[downloadable][fields][content_disposition][value]", type: "select", path: "catalog/downloadable/content_disposition", value: "inline", options: [{ value: "attachment", label: "attachment" }, { value: "inline", label: "inline" }], inherit: true },
        { id: "catalog_downloadable_disable_guest_checkout", label: "Disable Guest Checkout if Cart Contains Downloadable Items", name: "groups[downloadable][fields][disable_guest_checkout][value]", type: "select", path: "catalog/downloadable/disable_guest_checkout", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
      ],
    },
    {
      group: "Date & Time Custom Options",
      fields: [
        { id: "catalog_custom_options_use_calendar", label: "Use JavaScript Calendar", name: "groups[custom_options][fields][use_calendar][value]", type: "select", path: "catalog/custom_options/use_calendar", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }] },
        { id: "catalog_custom_options_date_fields_order", label: "Date Fields Order", name: "groups[custom_options][fields][date_fields_order][value][]", type: "select", path: "catalog/custom_options/date_fields_order", value: "m", options: [{ value: "d", label: "Day" }, { value: "m", label: "Month" }, { value: "y", label: "Year" }], inherit: true },
        { id: "catalog_custom_options_time_format", label: "Time Format", name: "groups[custom_options][fields][time_format][value]", type: "select", path: "catalog/custom_options/time_format", value: "12h", options: [{ value: "12h", label: "12h AM/PM" }, { value: "24h", label: "24h" }], inherit: true },
        { id: "catalog_custom_options_year_range", label: "Year Range", name: "groups[custom_options][fields][year_range][value][]", type: "text", path: "catalog/custom_options/year_range", value: "" },
      ],
    },
  ],
  sales: [
    {
      group: "General",
      fields: [
        { id: "sales_general_hide_customer_ip", label: "Hide Customer IP", name: "groups[general][fields][hide_customer_ip][value]", type: "select", path: "sales/general/hide_customer_ip", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
      ],
    },
    {
      group: "Checkout Totals Sort Order",
      fields: [
        { id: "sales_totals_sort_subtotal", label: "Subtotal", name: "groups[totals_sort][fields][subtotal][value]", type: "text", path: "sales/totals_sort/subtotal", value: "10", inherit: true },
        { id: "sales_totals_sort_discount", label: "Discount", name: "groups[totals_sort][fields][discount][value]", type: "text", path: "sales/totals_sort/discount", value: "20", inherit: true },
        { id: "sales_totals_sort_shipping", label: "Shipping", name: "groups[totals_sort][fields][shipping][value]", type: "text", path: "sales/totals_sort/shipping", value: "30", inherit: true },
        { id: "sales_totals_sort_tax", label: "Tax", name: "groups[totals_sort][fields][tax][value]", type: "text", path: "sales/totals_sort/tax", value: "40", inherit: true },
        { id: "sales_totals_sort_weee", label: "Fixed Product Tax", name: "groups[totals_sort][fields][weee][value]", type: "text", path: "sales/totals_sort/weee", value: "35", inherit: true },
        { id: "sales_totals_sort_grand_total", label: "Grand Total", name: "groups[totals_sort][fields][grand_total][value]", type: "text", path: "sales/totals_sort/grand_total", value: "100", inherit: true },
      ],
    },
    {
      group: "Reorder",
      fields: [
        { id: "sales_reorder_allow", label: "Allow Reorder", name: "groups[reorder][fields][allow][value]", type: "select", path: "sales/reorder/allow", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
      ],
    },
    {
      group: "Allow Zero GrandTotal",
      fields: [
        { id: "sales_zerograndtotal_creditmemo_allow_zero_grandtotal", label: "Allow Zero GrandTotal for Creditmemo", name: "groups[zerograndtotal_creditmemo][fields][allow_zero_grandtotal][value]", type: "select", path: "sales/zerograndtotal_creditmemo/allow_zero_grandtotal", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
      ],
    },
    {
      group: "Invoice and Packing Slip Design",
      fields: [
        { id: "sales_identity_logo", label: "Logo for PDF Print-outs", type: "static" },
        { id: "sales_identity_logo_html", label: "Logo for HTML Print View", type: "static" },
        { id: "sales_identity_address", label: "Address", name: "groups[identity][fields][address][value]", type: "textarea", path: "sales/identity/address", value: "" },
      ],
    },
    {
      group: "Minimum Order Amount",
      fields: [
        { id: "sales_minimum_order_active", label: "Enable", name: "groups[minimum_order][fields][active][value]", type: "select", path: "sales/minimum_order/active", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }] },
        { id: "sales_minimum_order_amount", label: "Minimum Amount", name: "groups[minimum_order][fields][amount][value]", type: "text", path: "sales/minimum_order/amount", value: "" },
        { id: "sales_minimum_order_include_discount_amount", label: "Include Discount Amount", name: "groups[minimum_order][fields][include_discount_amount][value]", type: "select", path: "sales/minimum_order/include_discount_amount", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "sales_minimum_order_tax_including", label: "Include Tax to Amount", name: "groups[minimum_order][fields][tax_including][value]", type: "select", path: "sales/minimum_order/tax_including", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "sales_minimum_order_description", label: "Description Message", name: "groups[minimum_order][fields][description][value]", type: "textarea", path: "sales/minimum_order/description", value: "" },
        { id: "sales_minimum_order_error_message", label: "Error to Show in Shopping Cart", name: "groups[minimum_order][fields][error_message][value]", type: "textarea", path: "sales/minimum_order/error_message", value: "" },
        { id: "sales_minimum_order_multi_address", label: "Validate Each Address Separately in Multi-address Checkout", name: "groups[minimum_order][fields][multi_address][value]", type: "select", path: "sales/minimum_order/multi_address", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }] },
        { id: "sales_minimum_order_multi_address_description", label: "Multi-address Description Message", name: "groups[minimum_order][fields][multi_address_description][value]", type: "textarea", path: "sales/minimum_order/multi_address_description", value: "" },
        { id: "sales_minimum_order_multi_address_error_message", label: "Multi-address Error to Show in Shopping Cart", name: "groups[minimum_order][fields][multi_address_error_message][value]", type: "textarea", path: "sales/minimum_order/multi_address_error_message", value: "The current cart does not match multi shipping criteria, please review or contact the store administrator" },
      ],
    },
    {
      group: "Dashboard",
      fields: [
        { id: "sales_dashboard_use_aggregated_data", label: "Use Aggregated Data", name: "groups[dashboard][fields][use_aggregated_data][value]", type: "select", path: "sales/dashboard/use_aggregated_data", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
      ],
    },
    {
      group: "Orders Cron Settings",
      fields: [
        { id: "sales_orders_delete_pending_after", label: "Pending Payment Order Lifetime (minutes)", name: "groups[orders][fields][delete_pending_after][value]", type: "text", path: "sales/orders/delete_pending_after", value: "480", inherit: true },
      ],
    },
    {
      group: "Gift Options",
      fields: [
        { id: "sales_gift_options_allow_order", label: "Allow Gift Messages on Order Level", name: "groups[gift_options][fields][allow_order][value]", type: "select", path: "sales/gift_options/allow_order", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "sales_gift_options_allow_items", label: "Allow Gift Messages for Order Items", name: "groups[gift_options][fields][allow_items][value]", type: "select", path: "sales/gift_options/allow_items", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
      ],
    },
    {
      group: "Minimum Advertised Price",
      fields: [
        { id: "sales_msrp_enabled", label: "Enable MAP", name: "groups[msrp][fields][enabled][value]", type: "select", path: "sales/msrp/enabled", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "sales_msrp_display_price_type", label: "Display Actual Price", name: "groups[msrp][fields][display_price_type][value]", type: "select", path: "sales/msrp/display_price_type", value: "1", options: [{ value: "1", label: "On Gesture" }, { value: "2", label: "In Cart" }, { value: "3", label: "Before Order Confirmation" }], inherit: true },
        { id: "sales_msrp_explanation_message", label: "Default Popup Text Message", name: "groups[msrp][fields][explanation_message][value]", type: "textarea", path: "sales/msrp/explanation_message", value: "Our price is lower than the manufacturer's \"minimum advertised price.\" As a result, we cannot show you the price in catalog or the product page. <br /><br /> You have no obligation to purchase the product once you know the price. You can simply remove the item from your cart.", inherit: true },
        { id: "sales_msrp_explanation_message_whats_this", label: "Default \"What's This\" Text Message", name: "groups[msrp][fields][explanation_message_whats_this][value]", type: "textarea", path: "sales/msrp/explanation_message_whats_this", value: "Our price is lower than the manufacturer's \"minimum advertised price.\" As a result, we cannot show you the price in catalog or the product page. <br /><br /> You have no obligation to purchase the product once you know the price. You can simply remove the item from your cart.", inherit: true },
      ],
    },
    {
      group: "Instant Purchase",
      fields: [
        { id: "sales_instant_purchase_active", label: "Enabled", name: "groups[instant_purchase][fields][active][value]", type: "select", path: "sales/instant_purchase/active", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "sales_instant_purchase_button_text", label: "Button Text", name: "groups[instant_purchase][fields][button_text][value]", type: "text", path: "sales/instant_purchase/button_text", value: "Instant Purchase", inherit: true },
      ],
    },
  ],
  admin: [
    {
      group: "Admin User Emails",
      fields: [
        { id: "admin_emails_forgot_email_template", label: "Forgot Password Email Template", name: "groups[emails][fields][forgot_email_template][value]", type: "select", path: "admin/emails/forgot_email_template", value: "admin_emails_forgot_email_template", options: [{ value: "admin_emails_forgot_email_template", label: "Forgot Admin Password (Default)" }], inherit: true },
        { id: "admin_emails_forgot_email_identity", label: "Forgot and Reset Email Sender", name: "groups[emails][fields][forgot_email_identity][value]", type: "select", path: "admin/emails/forgot_email_identity", value: "general", options: [{ value: "general", label: "General Contact" }, { value: "sales", label: "Sales Representative" }, { value: "support", label: "Customer Support" }, { value: "custom1", label: "Custom Email 1" }, { value: "custom2", label: "Custom Email 2" }], inherit: true },
        { id: "admin_emails_user_notification_template", label: "User Notification Template", name: "groups[emails][fields][user_notification_template][value]", type: "select", path: "admin/emails/user_notification_template", value: "admin_emails_user_notification_template", options: [{ value: "admin_emails_user_notification_template", label: "User Notification (Default)" }], inherit: true },
        { id: "admin_emails_new_user_notification_template", label: "New User Notification Template", name: "groups[emails][fields][new_user_notification_template][value]", type: "select", path: "admin/emails/new_user_notification_template", value: "admin_emails_new_user_notification_template", options: [{ value: "admin_emails_new_user_notification_template", label: "New User Notification (Default)" }], inherit: true },
      ],
    },
    {
      group: "Startup Page",
      fields: [
        { id: "admin_startup_menu_item_id", label: "Startup Page", name: "groups[startup][fields][menu_item_id][value]", type: "select", path: "admin/startup/menu_item_id", value: "Magento_Backend::dashboard", options: [{ value: "Magento_Backend::dashboard", label: "Dashboard" }, { value: "Magento_Sales::sales_order", label: "Orders" }, { value: "Magento_Sales::sales_invoice", label: "Invoices" }, { value: "Magento_Sales::sales_shipment", label: "Shipments" }, { value: "Magento_Sales::sales_creditmemo", label: "Credit Memos" }, { value: "Magento_Paypal::paypal_billing_agreement", label: "Billing Agreements" }, { value: "Magento_Sales::sales_transactions", label: "Transactions" }, { value: "PayPal_Braintree::virtual_terminal", label: "Braintree Virtual Terminal" }, { value: "Magento_Catalog::catalog_products", label: "Products" }, { value: "Magento_Catalog::catalog_categories", label: "Categories" }, { value: "Magento_Customer::customer_manage", label: "All Customers" }, { value: "Magento_Customer::customer_online", label: "Now Online" }, { value: "Magento_LoginAsCustomerLog::login_log", label: "Login as Customer Log" }, { value: "Magento_Customer::customer_group", label: "Customer Groups" }, { value: "Magento_CatalogRule::promo_catalog", label: "Catalog Price Rule" }, { value: "Magento_SalesRule::promo_quote", label: "Cart Price Rules" }, { value: "Magento_Email::template", label: "Email Templates" }, { value: "Magento_Newsletter::newsletter_template", label: "Newsletter Templates" }, { value: "Magento_Newsletter::newsletter_queue", label: "Newsletter Queue" }, { value: "Magento_Newsletter::newsletter_subscriber", label: "Newsletter Subscribers" }, { value: "Magento_UrlRewrite::urlrewrite", label: "URL Rewrites" }, { value: "Magento_Search::search_terms", label: "Search Terms" }, { value: "Magento_Search::search_synonyms", label: "Search Synonyms" }, { value: "Magento_Sitemap::catalog_sitemap", label: "Site Map" }, { value: "Magento_Review::catalog_reviews_ratings_reviews_all", label: "All Reviews" }, { value: "Magento_Review::catalog_reviews_ratings_pending", label: "Pending Reviews" }, { value: "Magento_Cms::cms_page", label: "Pages" }, { value: "Magento_Cms::cms_block", label: "Blocks" }, { value: "Magento_Widget::cms_widget_instance", label: "Widgets" }, { value: "Magento_PageBuilder::templates", label: "Templates" }, { value: "Magento_MediaGalleryUi::media_gallery", label: "Media Gallery" }, { value: "Magento_Theme::design_config", label: "Configuration" }, { value: "Magento_Theme::system_design_theme", label: "Themes" }, { value: "Magento_Backend::system_design_schedule", label: "Schedule" }, { value: "Magento_Reports::report_shopcart_product", label: "Products in Cart" }, { value: "Magento_Search::report_search_term", label: "Search Terms" }, { value: "Magento_Reports::report_shopcart_abandoned", label: "Abandoned Carts" }, { value: "Magento_Newsletter::newsletter_problem", label: "Newsletter Problem Reports" }, { value: "Magento_Review::report_review_customer", label: "By Customers" }, { value: "Magento_Review::report_review_product", label: "By Products" }, { value: "Magento_Reports::report_salesroot_sales", label: "Orders" }, { value: "Magento_Reports::report_salesroot_tax", label: "Tax" }, { value: "Magento_Reports::report_salesroot_invoiced", label: "Invoiced" }, { value: "Magento_Reports::report_salesroot_shipping", label: "Shipping" }, { value: "Magento_Reports::report_salesroot_refunded", label: "Refunds" }, { value: "Magento_Reports::report_salesroot_coupons", label: "Coupons" }, { value: "Magento_Paypal::report_salesroot_paypal_settlement_reports", label: "PayPal Settlement" }, { value: "PayPal_Braintree::settlement_report", label: "Braintree Settlement" }, { value: "Magento_Reports::report_customers_totals", label: "Order Total" }, { value: "Magento_Reports::report_customers_orders", label: "Order Count" }, { value: "Magento_Reports::report_customers_accounts", label: "New" }, { value: "Magento_Reports::report_products_viewed", label: "Views" }, { value: "Magento_Reports::report_products_bestsellers", label: "Bestsellers" }, { value: "Magento_Reports::report_products_lowstock", label: "Low Stock" }, { value: "Magento_Reports::report_products_sold", label: "Ordered" }, { value: "Magento_Downloadable::report_products_downloads", label: "Downloads" }, { value: "Magento_Reports::report_statistics_refresh", label: "Refresh Statistics" }, { value: "Magento_Analytics::advanced_reporting", label: "Advanced Reporting" }, { value: "Magento_Analytics::bi_essentials", label: "BI Essentials" }, { value: "Magento_Backend::system_store", label: "All Stores" }, { value: "Magento_Config::system_config", label: "Configuration" }, { value: "Magento_CheckoutAgreements::sales_checkoutagreement", label: "Terms and Conditions" }, { value: "Magento_Sales::system_order_statuses", label: "Order Status" }, { value: "Magento_InventoryAdminUi::source", label: "Sources" }, { value: "Magento_InventoryAdminUi::stock", label: "Stocks" }, { value: "Magento_Tax::sales_tax_rules", label: "Tax Rules" }, { value: "Magento_Tax::sales_tax_rates", label: "Tax Zones and Rates" }, { value: "Magento_CurrencySymbol::system_currency_rates", label: "Currency Rates" }, { value: "Magento_CurrencySymbol::system_currency_symbols", label: "Currency Symbols" }, { value: "Magento_Catalog::catalog_attributes_attributes", label: "Product" }, { value: "Magento_Catalog::catalog_attributes_sets", label: "Attribute Set" }, { value: "Magento_Review::catalog_reviews_ratings_ratings", label: "Rating" }, { value: "Magento_ImportExport::system_convert_import", label: "Import" }, { value: "Magento_ImportExport::system_convert_export", label: "Export" }, { value: "Magento_TaxImportExport::system_convert_tax", label: "Import/Export Tax Rates" }, { value: "Magento_ImportExport::system_convert_history", label: "Import History" }, { value: "Magento_Integration::system_integrations", label: "Integrations" }, { value: "Magento_Backend::system_cache", label: "Cache Management" }, { value: "Magento_Indexer::system_index", label: "Index Management" }, { value: "Magento_User::system_acl_users", label: "All Users" }, { value: "Magento_User::system_acl_locks", label: "Locked Users" }, { value: "Magento_User::system_acl_roles", label: "User Roles" }, { value: "Magento_AsynchronousOperations::system_magento_logging_bulk_operations", label: "Bulk Actions" }, { value: "Magento_AdminNotification::system_adminnotification", label: "Notifications" }, { value: "Magento_Variable::system_variable", label: "Custom Variables" }, { value: "Magento_EncryptionKey::system_crypt_key", label: "Manage Encryption Key" }, { value: "Magento_Marketplace::partners", label: "Find Partners & Extensions" }], inherit: true },
      ],
    },
    {
      group: "Admin Base URL",
      fields: [
        { id: "admin_url_use_custom", label: "Use Custom Admin URL", name: "groups[url][fields][use_custom][value]", type: "select", path: "admin/url/use_custom", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "admin_url_custom", label: "Custom Admin URL", name: "groups[url][fields][custom][value]", type: "text", path: "admin/url/custom", value: "", inherit: true },
        { id: "admin_url_use_custom_path", label: "Use Custom Admin Path", name: "groups[url][fields][use_custom_path][value]", type: "select", path: "admin/url/use_custom_path", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "admin_url_custom_path", label: "Custom Admin Path", name: "groups[url][fields][custom_path][value]", type: "text", path: "admin/url/custom_path", value: "", inherit: true },
      ],
    },
    {
      group: "Security",
      fields: [
        { id: "admin_security_admin_account_sharing", label: "Admin Account Sharing", name: "groups[security][fields][admin_account_sharing][value]", type: "select", path: "admin/security/admin_account_sharing", value: "1", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "admin_security_password_reset_protection_type", label: "Password Reset Protection Type", name: "groups[security][fields][password_reset_protection_type][value]", type: "select", path: "admin/security/password_reset_protection_type", value: "1", options: [{ value: "1", label: "By IP and Email" }, { value: "2", label: "By IP" }, { value: "3", label: "By Email" }, { value: "0", label: "None" }], inherit: true },
        { id: "admin_security_password_reset_link_expiration_period", label: "Recovery Link Expiration Period (hours)", name: "groups[security][fields][password_reset_link_expiration_period][value]", type: "text", path: "admin/security/password_reset_link_expiration_period", value: "2", inherit: true },
        { id: "admin_security_max_number_password_reset_requests", label: "Max Number of Password Reset Requests", name: "groups[security][fields][max_number_password_reset_requests][value]", type: "text", path: "admin/security/max_number_password_reset_requests", value: "5", inherit: true },
        { id: "admin_security_min_time_between_password_reset_requests", label: "Min Time Between Password Reset Requests", name: "groups[security][fields][min_time_between_password_reset_requests][value]", type: "text", path: "admin/security/min_time_between_password_reset_requests", value: "10", inherit: true },
        { id: "admin_security_use_form_key", label: "Add Secret Key to URLs", name: "groups[security][fields][use_form_key][value]", type: "select", path: "admin/security/use_form_key", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "admin_security_use_case_sensitive_login", label: "Login is Case Sensitive", name: "groups[security][fields][use_case_sensitive_login][value]", type: "select", path: "admin/security/use_case_sensitive_login", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "admin_security_session_lifetime", label: "Admin Session Lifetime (seconds)", name: "groups[security][fields][session_lifetime][value]", type: "text", path: "admin/security/session_lifetime", value: "360000", inherit: true },
        { id: "admin_security_lockout_failures", label: "Maximum Login Failures to Lockout Account", name: "groups[security][fields][lockout_failures][value]", type: "text", path: "admin/security/lockout_failures", value: "", inherit: true },
        { id: "admin_security_lockout_threshold", label: "Lockout Time (minutes)", name: "groups[security][fields][lockout_threshold][value]", type: "text", path: "admin/security/lockout_threshold", value: "0", inherit: true },
        { id: "admin_security_password_lifetime", label: "Password Lifetime (days)", name: "groups[security][fields][password_lifetime][value]", type: "text", path: "admin/security/password_lifetime", value: "0", inherit: true },
        { id: "admin_security_password_is_forced", label: "Password Change", name: "groups[security][fields][password_is_forced][value]", type: "select", path: "admin/security/password_is_forced", value: "0", options: [{ value: "0", label: "Recommended" }, { value: "1", label: "Forced" }], inherit: true },
      ],
    },
    {
      group: "Dashboard",
      fields: [
        { id: "admin_dashboard_enable_charts", label: "Enable Charts", name: "groups[dashboard][fields][enable_charts][value]", type: "select", path: "admin/dashboard/enable_charts", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
      ],
    },
    {
      group: "Admin Grids",
      fields: [
        { id: "admin_grid_limit_total_number_of_products", label: "Limit Number of Products in Grid", name: "groups[grid][fields][limit_total_number_of_products][value]", type: "select", path: "admin/grid/limit_total_number_of_products", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "admin_grid_records_limit", label: "Records Limit", name: "groups[grid][fields][records_limit][value]", type: "text", path: "admin/grid/records_limit", value: "20000", inherit: true },
      ],
    },
    {
      group: "CAPTCHA",
      fields: [
        { id: "admin_captcha_enable", label: "Enable CAPTCHA in Admin", name: "groups[captcha][fields][enable][value]", type: "select", path: "admin/captcha/enable", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
        { id: "admin_captcha_font", label: "Font", name: "groups[captcha][fields][font][value]", type: "select", path: "admin/captcha/font", value: "linlibertine", options: [{ value: "linlibertine", label: "LinLibertine" }], inherit: true },
        { id: "admin_captcha_forms", label: "Forms", name: "groups[captcha][fields][forms][value][]", type: "select", path: "admin/captcha/forms", value: "", options: [{ value: "backend_login", label: "Admin Login" }, { value: "backend_forgotpassword", label: "Admin Forgot Password" }], inherit: true },
        { id: "admin_captcha_mode", label: "Displaying Mode", name: "groups[captcha][fields][mode][value]", type: "select", path: "admin/captcha/mode", value: "after_fail", options: [{ value: "always", label: "Always" }, { value: "after_fail", label: "After number of attempts to login" }], inherit: true },
        { id: "admin_captcha_failed_attempts_login", label: "Number of Unsuccessful Attempts to Login", name: "groups[captcha][fields][failed_attempts_login][value]", type: "text", path: "admin/captcha/failed_attempts_login", value: "3", inherit: true },
        { id: "admin_captcha_timeout", label: "CAPTCHA Timeout (minutes)", name: "groups[captcha][fields][timeout][value]", type: "text", path: "admin/captcha/timeout", value: "7", inherit: true },
        { id: "admin_captcha_length", label: "Number of Symbols", name: "groups[captcha][fields][length][value]", type: "text", path: "admin/captcha/length", value: "4-5", inherit: true },
        { id: "admin_captcha_symbols", label: "Symbols Used in CAPTCHA", name: "groups[captcha][fields][symbols][value]", type: "text", path: "admin/captcha/symbols", value: "ABCDEFGHJKMnpqrstuvwxyz23456789", inherit: true },
        { id: "admin_captcha_case_sensitive", label: "Case Sensitive", name: "groups[captcha][fields][case_sensitive][value]", type: "select", path: "admin/captcha/case_sensitive", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], inherit: true },
      ],
    },
    {
      group: "Admin Usage",
      fields: [
        { id: "admin_usage_enabled", label: "Enable Admin Usage Tracking", name: "groups[usage][fields][enabled][value]", type: "select", path: "admin/usage/enabled", value: "0", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }] },
      ],
    },
  ],
}

/**
 * `/section/design/` is not in the section rail; the source answers it by
 * rendering the **General** section body (verified live against
 * localhost:7780). Alias rather than invent a Design form.
 */
CONFIG_FIELDS.design = CONFIG_FIELDS.general

/**
 * F-04 — Magento's `<depends>` relation, by field id.
 *
 * A field whose dependency is not satisfied is rendered with BOTH the control
 * and its "Use system value" checkbox `disabled`, regardless of whether it has
 * a `core_config_data` row. Without this, deriving inheritance from the seed
 * (which is the F-04 fix) would wrongly ENABLE `admin_captcha_forms`, the one
 * seeded `admin/*` path whose group is switched off — the source disables it
 * because `admin/captcha/enable` is `0`.
 *
 * Measured field-by-field on the live source's `section/admin`: these 11 are
 * exactly the fields whose `…_inherit` checkbox is itself `disabled` there.
 * Setting the master field unlocks the group live, as the source's own JS does.
 */
const FIELD_DEPENDS = {
  admin_url_custom: { path: 'admin/url/use_custom', value: '1' },
  admin_url_custom_path: { path: 'admin/url/use_custom_path', value: '1' },
  admin_grid_records_limit: { path: 'admin/grid/limit_total_number_of_products', value: '1' },
  admin_captcha_font: { path: 'admin/captcha/enable', value: '1' },
  admin_captcha_forms: { path: 'admin/captcha/enable', value: '1' },
  admin_captcha_mode: { path: 'admin/captcha/enable', value: '1' },
  admin_captcha_failed_attempts_login: { path: 'admin/captcha/enable', value: '1' },
  admin_captcha_timeout: { path: 'admin/captcha/enable', value: '1' },
  admin_captcha_length: { path: 'admin/captcha/enable', value: '1' },
  admin_captcha_symbols: { path: 'admin/captcha/enable', value: '1' },
  admin_captcha_case_sensitive: { path: 'admin/captcha/enable', value: '1' },
  /* `section/currency` > Scheduled Import Settings. Found by the round-11
     app-wide sweep running the OTHER direction: the source disables all six of
     these (because `currency/import/enabled` is `0`) while the mock left them
     enabled, which is a false-success risk rather than an exception risk — an
     agent could "set" a rate-import service the source would not let it set. */
  currency_import_service: { path: 'currency/import/enabled', value: '1' },
  currency_import_time: { path: 'currency/import/enabled', value: '1' },
  currency_import_frequency: { path: 'currency/import/enabled', value: '1' },
  currency_import_error_email: { path: 'currency/import/enabled', value: '1' },
  currency_import_error_email_identity: { path: 'currency/import/enabled', value: '1' },
  currency_import_error_email_template: { path: 'currency/import/enabled', value: '1' },
  /* `section/catalog` > Catalog Search. This deployment runs `opensearch`, so
     the source disables the whole `elasticsearch5` and `elasticsearch7` blocks
     and leaves the `opensearch` one live. Same sweep, same direction as the
     currency group. */
  ...Object.fromEntries(['elasticsearch5', 'elasticsearch7'].flatMap(engine => [
    'server_hostname', 'server_port', 'index_prefix', 'enable_auth', 'username',
    'password', 'server_timeout', 'minimum_should_match',
  ].map(f => [`catalog_search_${engine}_${f}`, { path: 'catalog/search/engine', value: engine }]))),
  /* …and within the ACTIVE engine's block, credentials depend on its own
     `enable_auth`, which is `0` here. */
  catalog_search_opensearch_username: { path: 'catalog/search/opensearch/enable_auth', value: '1' },
  catalog_search_opensearch_password: { path: 'catalog/search/opensearch/enable_auth', value: '1' },
  /* `section/catalog` > Layered Navigation. `price_range_calculation` is
     `auto`, and each of these four is declared under a different non-auto
     branch in Magento's `Catalog/etc/adminhtml/system.xml`, so all four are
     disabled — controls AND their "Use system value" checkboxes. */
  catalog_layered_navigation_price_range_step: { path: 'catalog/layered_navigation/price_range_calculation', value: 'manual' },
  catalog_layered_navigation_price_range_max_intervals: { path: 'catalog/layered_navigation/price_range_calculation', value: 'manual' },
  catalog_layered_navigation_one_price_interval: { path: 'catalog/layered_navigation/price_range_calculation', value: 'improved' },
  catalog_layered_navigation_interval_division_limit: { path: 'catalog/layered_navigation/price_range_calculation', value: 'improved' },
}

for (const groups of Object.values(CONFIG_FIELDS)) {
  for (const g of groups) {
    for (const f of g.fields) {
      if (FIELD_DEPENDS[f.id]) f.depends = FIELD_DEPENDS[f.id]
    }
  }
}

const FIELD_NAME_RE = /^groups\[([^\]]+)\]\[fields\]\[([^\]]+)\]\[value\]$/

/**
 * The `core_config_data` path a descriptor writes to.
 *
 * Most descriptors were captured from the rendered form, where the only thing
 * carrying the path is the input name (`groups[<group>][fields][<field>][value]`)
 * plus the section the field lives in. The section is recoverable from the
 * source's own `row_` id, which is `<section>_<group>_<field>` — so
 * `general_store_information_name` + `groups[store_information][fields][name]`
 * gives `general/store_information/name`, exactly the path Magento writes.
 *
 * This must never fall back to a non-path: a descriptor whose key has no `/`
 * used to be skipped by `saveConfig`, which made Save Config print the source's
 * `You saved the configuration.` while writing nothing (PIPELINE-019 /
 * HANDLERS-029). Every editable field now resolves to a real path.
 */
export function configPath(f) {
  if (f.path) return f.path
  const m = FIELD_NAME_RE.exec(f.name || '')
  if (!m) return f.id
  const [, group, field] = m
  const suffix = `_${group}_${field}`
  const id = String(f.id)
  return id.endsWith(suffix)
    ? `${id.slice(0, -suffix.length)}/${group}/${field}`
    : `${group}/${field}`
}

/** Humanised leaf of a `core_config_data` path, used for uncaptured sections. */
export function pathLeafLabel(path) {
  return String(path).split('/').slice(1).join(' / ')
}
