import React from 'react'
import { Routes, Route, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import AdminLayout from './components/layout/AdminLayout.jsx'
import Dashboard from './pages/Dashboard.jsx'
import GoPage from './pages/GoPage.jsx'
import AreaPage from './pages/AreaPage.jsx'
import NotFound from './pages/NotFound.jsx'
import {
  OrdersReport, TaxReport, InvoicedReport, ShippingReport, RefundedReport,
  CouponsReport, BestsellersReport, ProductViewsReport,
} from './pages/reports/SalesReports.jsx'
import {
  OrderCountReport, OrderTotalReport, NewAccountsReport, OrderedProductsReport,
  LowStockReport, DownloadsReport, CustomerReviewsReport, ProductReviewsReport,
  ProductReviewsDetail, ProductsInCartsReport, AbandonedCartsReport,
  RefreshStatistics, AdvancedReporting,
} from './pages/reports/LegacyReports.jsx'
import {
  ReviewsIndex, PendingReviews, ReviewEdit, NewReview, RatingsGrid, RatingForm, ReviewMassAction,
} from './pages/reviews/Reviews.jsx'
import {
  CartPriceRules, CartPriceRuleForm, CatalogPriceRules, SearchTerms,
  SearchTermsReport, SearchTermEdit, SearchSynonyms, UrlRewrites,
  NewsletterSubscribers, NewsletterTemplates, NewsletterQueue,
  NewsletterProblems, CheckoutAgreements, CatalogPriceRuleForm, SynonymGroupForm,
  UrlRewriteForm, NewsletterTemplateForm, CheckoutAgreementForm,
} from './pages/marketing/Marketing.jsx'

/* ---- Catalog area (ROUTES rows 39-51) ---- */
import ProductGrid from './pages/catalog/ProductGrid.jsx'
import ProductEdit from './pages/catalog/ProductEdit.jsx'
import ProductSave from './pages/catalog/ProductSave.jsx'
import CategoryPage from './pages/catalog/CategoryPage.jsx'
import { ProductAttributeGrid, ProductAttributeEdit, ProductAttributeNew } from './pages/catalog/ProductAttributes.jsx'
import { AttributeSetGrid, AttributeSetEdit, AttributeSetNew } from './pages/catalog/AttributeSets.jsx'
import { ManageSources, ManageStock } from './pages/catalog/Inventory.jsx'

/* ---- Customers area (ROUTES rows 52-59) ---- */
import CustomerGrid from './pages/customers/CustomerGrid.jsx'
import CustomerEdit from './pages/customers/CustomerEdit.jsx'
import CustomerSave from './pages/customers/CustomerSave.jsx'
import { CustomerGroupGrid, CustomerGroupEdit } from './pages/customers/CustomerGroups.jsx'
import { CustomersOnline, LoginAsCustomerLog } from './pages/customers/CustomersOnline.jsx'

/* ---- Sales area (ROUTES rows 10-38) ---- */
import OrdersGrid from './pages/sales/OrdersGrid.jsx'
import OrderView from './pages/sales/OrderView.jsx'
import OrderCommentsHistory from './pages/sales/OrderCommentsHistory.jsx'
import OrderAddressEdit from './pages/sales/OrderAddressEdit.jsx'
import {
  OrderCancel, OrderHold, OrderUnhold, OrderEmail, OrderAddComment,
  InvoiceEmail, ShipmentEmail, CreditMemoEmail,
} from './pages/sales/OrderActionRoutes.jsx'
import InvoiceNew, { InvoiceStart, InvoiceSave } from './pages/sales/InvoiceNew.jsx'
import ShipmentNew, { ShipmentStart, ShipmentSave } from './pages/sales/ShipmentNew.jsx'
import {
  InvoicesGrid, ShipmentsGrid, CreditMemosGrid, TransactionsGrid, BillingAgreementsGrid,
} from './pages/sales/SalesDocumentGrids.jsx'
import { InvoiceView, ShipmentView, CreditMemoView } from './pages/sales/SalesDocumentViews.jsx'
import OrderStatusGrid from './pages/sales/OrderStatusGrid.jsx'
import { OrderStatusNew, OrderStatusEdit, OrderStatusAssign } from './pages/sales/OrderStatusForms.jsx'
import CreditMemoNew, { CreditMemoStart, CreditMemoNewForOrder } from './pages/sales/CreditMemoNew.jsx'
import OrderCreate from './pages/sales/OrderCreate.jsx'

/* ---- Dashboard AJAX partials (ROUTES rows 4-6) ---- */
import {
  ProductsViewed, CustomersMost, CustomersNewest,
} from './pages/dashboard/DashboardPartials.jsx'

/* ---- Content area (ROUTES rows 101-111) ---- */
import { CmsPageGrid, CmsPageEdit, CmsPageSave } from './pages/content/CmsPages.jsx'
import { CmsBlockGrid, CmsBlockEdit } from './pages/content/CmsBlocks.jsx'
import {
  Widgets, MediaGallery, DesignConfig, ThemesGrid, ThemeEdit, DesignSchedule, PageBuilderTemplates,
  WidgetForm, DesignChangeForm,
} from './pages/content/Design.jsx'

/* ---- Stores / System area (ROUTES rows 7-8, 112-133) ---- */
import Configuration from './pages/system/Configuration.jsx'
import {
  AllStores, CurrencyRates, CurrencySymbols, WebsiteForm, StoreGroupForm, StoreViewForm,
} from './pages/system/Stores.jsx'
import { TaxRates, TaxRules, TaxImportExport } from './pages/system/Tax.jsx'
import {
  AdminUsers, AdminRoles, LockedUsers, AccountActivity,
} from './pages/system/Permissions.jsx'
import {
  CustomVariables, CacheManagement, IndexManagement, ImportPage, ExportPage, ImportHistory,
  Integrations, BulkActions, SiteMap, EmailTemplates, EncryptionKey, Notifications, MyAccount,
  CustomVariableForm, SitemapForm, EmailTemplateForm, IntegrationForm,
} from './pages/system/Tools.jsx'
import {
  Marketplace, BraintreeVirtualTerminal, BraintreeSettlementReport, PaypalSettlementReports, BiEssentials,
} from './pages/system/External.jsx'
import {
  TaxRateForm, TaxRuleForm, AdminUserForm, AdminRoleForm,
} from './pages/system/SystemForms.jsx'
import { CmsPageDelete, CmsBlockDelete } from './pages/content/CmsActionRoutes.jsx'

/**
 * `?sid=` must survive every redirect — never use a bare <Navigate>.
 */
function RedirectWithQuery({ to }) {
  const [searchParams] = useSearchParams()
  const q = searchParams.toString()
  return <Navigate to={q ? `${to}?${q}` : to} replace />
}

/**
 * Stock Magento appends `/key/<sha256>/` to admin URLs. This deployment has it
 * disabled (SOURCE.md §2) so the mock emits bare paths, but an agent may still
 * supply one — accept and ignore it rather than 404ing.
 */
function KeySegmentRedirect() {
  const location = useLocation()
  const stripped = location.pathname.replace(/\/key\/[^/]+(\/|$)/, '/')
  return <Navigate to={`${stripped}${location.search}`} replace />
}

/* ---------------------------------------------------------------------------
 * ROUTE TABLE — one row per ROUTES.md row, source path VERBATIM.
 *
 * Trailing slashes are optional everywhere: react-router v6 matches
 * `/admin/sales/order` and `/admin/sales/order/` against the same pattern, so
 * paths are declared without the trailing slash and both forms resolve.
 *
 * FEATURE AGENTS: swap `component` on your rows and leave every other line
 * alone. Do not reorder or reformat — three agents edit this table in parallel.
 * `title` is the source's `<h1 class="page-title">`, transcribed from
 * assets/html/. Pages with a dynamic title (order view, product edit, …) set it
 * from their own data and ignore this field.
 * ------------------------------------------------------------------------- */

const ROUTE_TABLE = [
  /* ---- 1. Dashboard & shell (ROUTES rows 1-8) ---- */
  { row: 3, path: '/admin/admin/dashboard', title: 'Dashboard', component: <Dashboard /> },
  { row: 4, path: '/admin/admin/dashboard/productsViewed', title: 'Dashboard', component: <ProductsViewed /> },
  { row: 5, path: '/admin/admin/dashboard/customersMost', title: 'Dashboard', component: <CustomersMost /> },
  { row: 6, path: '/admin/admin/dashboard/customersNewest', title: 'Dashboard', component: <CustomersNewest /> },
  { row: 7, path: '/admin/admin/notification', title: 'Notifications', component: <Notifications /> },
  { row: 7, path: '/admin/admin/notification/index', title: 'Notifications', component: <Notifications /> },
  { row: 8, path: '/admin/admin/system_account', title: 'My Account', component: <MyAccount /> },
  { row: 8, path: '/admin/admin/system_account/index', title: 'My Account', component: <MyAccount /> },

  /* ---- 2. Sales (ROUTES rows 10-38) ---- */
  { row: 10, path: '/admin/sales/order', title: 'Orders', component: <OrdersGrid /> },
  { row: 10, path: '/admin/sales/order/index', title: 'Orders', component: <OrdersGrid /> },
  { row: 10, path: '/admin/sales/order/index/order_id/:id', title: 'Orders', component: <OrdersGrid /> },
  { row: 11, path: '/admin/sales/order/view/order_id/:id', title: 'Order View', component: <OrderView /> },
  { row: 13, path: '/admin/sales/order/commentsHistory/order_id/:id', title: 'Comments History', component: <OrderCommentsHistory /> },
  { row: 14, path: '/admin/sales/order/commentsHistory/order_id/:id/active_tab/:tab', title: 'Comments History', component: <OrderCommentsHistory /> },
  { row: 15, path: '/admin/sales/order/address/address_id/:addressId', title: 'Edit Order Address', component: <OrderAddressEdit /> },
  { row: 16, path: '/admin/sales/order/addComment/order_id/:id', title: 'Order View', component: <OrderAddComment /> },
  { row: 17, path: '/admin/sales/order/cancel/order_id/:id', title: 'Order View', component: <OrderCancel /> },
  { row: 18, path: '/admin/sales/order/hold/order_id/:id', title: 'Order View', component: <OrderHold /> },
  { row: 19, path: '/admin/sales/order/unhold/order_id/:id', title: 'Order View', component: <OrderUnhold /> },
  { row: 20, path: '/admin/sales/order/email/order_id/:id', title: 'Order View', component: <OrderEmail /> },
  { row: 20, path: '/admin/sales/order/emailOrder/order_id/:id', title: 'Order View', component: <OrderEmail /> },
  { row: 21, path: '/admin/sales/order_invoice/start/order_id/:id', title: 'New Invoice', component: <InvoiceStart /> },
  { row: 22, path: '/admin/sales/order_invoice/new/order_id/:id', title: 'New Invoice', component: <InvoiceNew /> },
  { row: 23, path: '/admin/sales/order_invoice/save/order_id/:id', title: 'New Invoice', component: <InvoiceSave /> },
  { row: 24, path: '/admin/admin/order_shipment/start/order_id/:id', title: 'New Shipment', component: <ShipmentStart /> },
  { row: 25, path: '/admin/admin/order_shipment/new/order_id/:id', title: 'New Shipment', component: <ShipmentNew /> },
  { row: 26, path: '/admin/admin/order_shipment/save/order_id/:id', title: 'New Shipment', component: <ShipmentSave /> },
  /* DIFF-204 — row 27. The source 404s every order-keyed credit-memo URL
     ("We can't create credit memo for the order.") and only serves the form for
     an existing `creditmemo_id`. `CreditMemoNewForOrder` reproduces the refusal;
     `CreditMemoNew` is the 200. `start/…` 302s to the matching `new/…`. */
  { row: 27, path: '/admin/sales/order_creditmemo/start/order_id/:id', title: 'New Credit Memo', component: <CreditMemoStart /> },
  { row: 27, path: '/admin/sales/order_creditmemo/start/order_id/:id/invoice_id/:invoiceId', title: 'New Credit Memo', component: <CreditMemoStart /> },
  { row: 27, path: '/admin/sales/order_creditmemo/start/creditmemo_id/:creditmemoId', title: 'New Memo', component: <CreditMemoStart /> },
  { row: 27, path: '/admin/sales/order_creditmemo/new/order_id/:id', title: 'New Credit Memo', component: <CreditMemoNewForOrder /> },
  { row: 27, path: '/admin/sales/order_creditmemo/new/order_id/:id/invoice_id/:invoiceId', title: 'New Credit Memo', component: <CreditMemoNewForOrder /> },
  { row: 27, path: '/admin/sales/order_creditmemo/new/creditmemo_id/:creditmemoId', title: 'New Memo', component: <CreditMemoNew /> },
  { row: 28, path: '/admin/sales/order_create/reorder/order_id/:id', title: 'Create New Order', component: <OrderCreate from="reorder" /> },
  { row: 28, path: '/admin/sales/order_edit/start/order_id/:id', title: 'Create New Order', component: <OrderCreate from="edit" /> },
  { row: 29, path: '/admin/sales/order_create/start/customer_id/:id', title: 'Create New Order', component: <OrderCreate from="customer" /> },
  /* DIFF-206 — `order_create/` and `order_create/index/customer_id/N/` are 200 on
     the source (they are where `reorder/` and `start/` land after their 302) but
     were 404 in the mock. */
  { row: 28, path: '/admin/sales/order_create', title: 'Create New Order', component: <OrderCreate from="customer" /> },
  { row: 28, path: '/admin/sales/order_create/index', title: 'Create New Order', component: <OrderCreate from="customer" /> },
  { row: 29, path: '/admin/sales/order_create/index/customer_id/:id', title: 'Create New Order', component: <OrderCreate from="customer" /> },
  { row: 30, path: '/admin/sales/invoice', title: 'Invoices', component: <InvoicesGrid /> },
  { row: 30, path: '/admin/sales/invoice/index', title: 'Invoices', component: <InvoicesGrid /> },
  { row: 31, path: '/admin/sales/invoice/view/invoice_id/:id', title: 'Invoice', component: <InvoiceView /> },
  /* DIFF-206 — the source's own post-email redirect target; 200 on the source. */
  { row: 31, path: '/admin/sales/invoice/view/order_id/:orderId/invoice_id/:id', title: 'Invoice', component: <InvoiceView /> },
  { row: 31, path: '/admin/sales/order_invoice/email/order_id/:id/invoice_id/:invoiceId', title: 'Invoice', component: <InvoiceEmail /> },
  { row: 32, path: '/admin/sales/shipment', title: 'Shipments', component: <ShipmentsGrid /> },
  { row: 32, path: '/admin/sales/shipment/index', title: 'Shipments', component: <ShipmentsGrid /> },
  { row: 33, path: '/admin/sales/shipment/view/shipment_id/:id', title: 'Shipment', component: <ShipmentView /> },
  /* DIFF-206 — the source's own post-email redirect target; 200 on the source. */
  { row: 33, path: '/admin/admin/order_shipment/view/shipment_id/:id', title: 'Shipment', component: <ShipmentView /> },
  { row: 33, path: '/admin/admin/order_shipment/email/shipment_id/:shipmentId', title: 'Shipment', component: <ShipmentEmail /> },
  { row: 34, path: '/admin/sales/creditmemo', title: 'Credit Memos', component: <CreditMemosGrid /> },
  { row: 34, path: '/admin/sales/creditmemo/index', title: 'Credit Memos', component: <CreditMemosGrid /> },
  { row: 35, path: '/admin/sales/creditmemo/view/creditmemo_id/:id', title: 'Credit Memo', component: <CreditMemoView /> },
  /* DIFF-206 — the source's own post-email redirect target; both forms 200 there. */
  { row: 35, path: '/admin/sales/order_creditmemo/view/creditmemo_id/:id', title: 'Credit Memo', component: <CreditMemoView /> },
  { row: 35, path: '/admin/sales/order_creditmemo/view/creditmemo_id/:id/order_id/:orderId', title: 'Credit Memo', component: <CreditMemoView /> },
  { row: 35, path: '/admin/sales/order_creditmemo/email/creditmemo_id/:creditmemoId/order_id/:id', title: 'Credit Memo', component: <CreditMemoEmail /> },
  { row: 36, path: '/admin/sales/transactions', title: 'Transactions', component: <TransactionsGrid /> },
  { row: 37, path: '/admin/paypal/billing_agreement', title: 'Billing Agreements', component: <BillingAgreementsGrid /> },
  { row: 38, path: '/admin/sales/order_status', title: 'Order Status', component: <OrderStatusGrid /> },
  { row: 38, path: '/admin/sales/order_status/index', title: 'Order Status', component: <OrderStatusGrid /> },
  { row: 38, path: '/admin/sales/order_status/new', title: 'Create New Order Status', component: <OrderStatusNew /> },
  { row: 38, path: '/admin/sales/order_status/assign', title: 'Assign Order Status to State', component: <OrderStatusAssign /> },

  /* ---- 3. Catalog (ROUTES rows 39-51) ---- */
  { row: 39, path: '/admin/catalog/product', title: 'Products', component: <ProductGrid /> },
  { row: 39, path: '/admin/catalog/product/index', title: 'Products', component: <ProductGrid /> },
  { row: 40, path: '/admin/catalog/product/edit/id/:id', title: 'Product', component: <ProductEdit /> },
  { row: 42, path: '/admin/catalog/product/save/id/:id', title: 'Product', component: <ProductSave /> },
  { row: 43, path: '/admin/catalog/product/new/set/:setId/type/:type', title: 'New Product', component: <ProductEdit isNew /> },
  { row: 43, path: '/admin/catalog/product/new', title: 'New Product', component: <ProductEdit isNew /> },
  { row: 44, path: '/admin/catalog/category', title: 'Default Category (ID: 2)', component: <CategoryPage /> },
  { row: 45, path: '/admin/catalog/category/edit/id/:id', title: 'Category', component: <CategoryPage /> },
  { row: 46, path: '/admin/catalog/product_attribute', title: 'Product Attributes', component: <ProductAttributeGrid /> },
  { row: 47, path: '/admin/catalog/product_attribute/edit/attribute_id/:id', title: 'Edit Product Attribute', component: <ProductAttributeEdit /> },
  { row: 48, path: '/admin/catalog/product_set', title: 'Attribute Sets', component: <AttributeSetGrid /> },
  { row: 49, path: '/admin/catalog/product_set/edit/id/:id', title: 'Edit Attribute Set', component: <AttributeSetEdit /> },
  { row: 50, path: '/admin/inventory/source', title: 'Manage Sources', component: <ManageSources /> },
  { row: 50, path: '/admin/inventory/source/index', title: 'Manage Sources', component: <ManageSources /> },
  { row: 51, path: '/admin/inventory/stock', title: 'Manage Stock', component: <ManageStock /> },
  { row: 51, path: '/admin/inventory/stock/index', title: 'Manage Stock', component: <ManageStock /> },

  /* ---- 4. Customers (ROUTES rows 52-59) ---- */
  { row: 52, path: '/admin/customer', title: 'Customers', component: <CustomerGrid /> },
  { row: 52, path: '/admin/customer/index', title: 'Customers', component: <CustomerGrid /> },
  { row: 52, path: '/admin/customer/index/index', title: 'Customers', component: <CustomerGrid /> },
  { row: 53, path: '/admin/customer/index/edit/id/:id', title: 'Customer', component: <CustomerEdit /> },
  /* Customer Information sub-tabs — each has its own source URL. */
  { row: 53, path: '/admin/customer/index/edit/id/:id/active_tab/:tab', title: 'Customer', component: <CustomerEdit /> },
  { row: 53, path: '/admin/customer/index/orders/id/:id', title: 'Customer', component: <CustomerEdit tab="orders" /> },
  { row: 53, path: '/admin/customer/index/cart/id/:id', title: 'Customer', component: <CustomerEdit tab="cart" /> },
  { row: 53, path: '/admin/customer/index/wishlist/id/:id', title: 'Customer', component: <CustomerEdit tab="wishlist" /> },
  { row: 53, path: '/admin/review/customer/productReviews/id/:id', title: 'Customer', component: <CustomerEdit tab="reviews" /> },
  { row: 54, path: '/admin/customer/index/new', title: 'New Customer', component: <CustomerEdit isNew /> },
  { row: 55, path: '/admin/customer/index/save', title: 'New Customer', component: <CustomerSave /> },
  { row: 56, path: '/admin/customer/group', title: 'Customer Groups', component: <CustomerGroupGrid /> },
  { row: 57, path: '/admin/customer/group/new', title: 'New Customer Group', component: <CustomerGroupEdit isNew /> },
  { row: 57, path: '/admin/customer/group/edit/id/:id', title: 'Edit Customer Group', component: <CustomerGroupEdit /> },
  { row: 58, path: '/admin/customer/online', title: 'Customers Now Online', component: <CustomersOnline /> },
  { row: 59, path: '/admin/loginascustomer_log/log', title: 'Login as Customer Log', component: <LoginAsCustomerLog /> },
  { row: 59, path: '/admin/loginascustomer_log/log/index', title: 'Login as Customer Log', component: <LoginAsCustomerLog /> },

  /* ---- 5. Marketing (ROUTES rows 60-79) ---- */
  { row: 60, path: '/admin/sales_rule/promo_quote', title: 'Cart Price Rules', component: <CartPriceRules /> },
  { row: 60, path: '/admin/sales_rule/promo_quote/index', title: 'Cart Price Rules', component: <CartPriceRules /> },
  { row: 61, path: '/admin/sales_rule/promo_quote/new', title: 'New Cart Price Rule', component: <CartPriceRuleForm /> },
  { row: 62, path: '/admin/sales_rule/promo_quote/edit/id/:id', title: 'Edit Rule', component: <CartPriceRuleForm /> },
  { row: 63, path: '/admin/sales_rule/promo_quote/save', title: 'Cart Price Rules', component: <CartPriceRules /> },
  { row: 64, path: '/admin/catalog_rule/promo_catalog', title: 'Catalog Price Rule', component: <CatalogPriceRules /> },
  { row: 65, path: '/admin/review/product', title: 'Reviews', component: <ReviewsIndex /> },
  /* The Reviews grid is a LEGACY Magento grid, and a legacy grid carries its
     whole state as `/key/value/` path pairs — `customerId/1`, `productId/1`,
     `sort/detail`, `dir/asc`, `page/2`, `limit/50`, `filter/<base64>` — in any
     order. The splat route that accepts all of them is generated from
     GRID_STATE_PATHS below, together with every other grid's. */
  { row: 65, path: '/admin/review/product/index', title: 'Reviews', component: <ReviewsIndex /> },
  { row: 65, path: '/admin/review/product/new', title: 'New Review', component: <NewReview /> },
  { row: 66, path: '/admin/review/product/pending', title: 'Pending Reviews', component: <PendingReviews /> },
  { row: 67, path: '/admin/review/product/edit/id/:id', title: 'Edit Review', component: <ReviewEdit /> },
  /* The Pending Reviews grid links every Edit through `/ret/pending/`, which is
     what sends Back/Save back to the pending grid instead of the full one. */
  { row: 67, path: '/admin/review/product/edit/id/:id/ret/:ret', title: 'Edit Review', component: <ReviewEdit /> },
  { row: 68, path: '/admin/review/product/save', title: 'Reviews', component: <ReviewsIndex /> },
  { row: 68, path: '/admin/review/product/save/id/:id', title: 'Reviews', component: <ReviewsIndex /> },
  { row: 68, path: '/admin/review/product/delete/id/:id', title: 'Reviews', component: <ReviewEdit /> },
  { row: 68, path: '/admin/review/product/massUpdateStatus/ret/:ret', title: 'Reviews', component: <ReviewMassAction /> },
  { row: 68, path: '/admin/review/product/massDelete/ret/:ret', title: 'Reviews', component: <ReviewMassAction /> },
  { row: 69, path: '/admin/review/rating', title: 'Ratings', component: <RatingsGrid /> },
  { row: 70, path: '/admin/search/term', title: 'Search Terms', component: <SearchTerms /> },
  { row: 70, path: '/admin/search/term/index', title: 'Search Terms', component: <SearchTerms /> },
  { row: 71, path: '/admin/search/term/edit/id/:id', title: 'Edit Search Term', component: <SearchTermEdit /> },
  { row: 71, path: '/admin/search/term/new', title: 'New Search Term', component: <SearchTermEdit /> },
  { row: 72, path: '/admin/search/term/report', title: 'Search Terms Report', component: <SearchTermsReport /> },
  { row: 73, path: '/admin/search/synonyms', title: 'Search Synonyms', component: <SearchSynonyms /> },
  { row: 73, path: '/admin/search/synonyms/index', title: 'Search Synonyms', component: <SearchSynonyms /> },
  { row: 74, path: '/admin/admin/url_rewrite', title: 'URL Rewrites', component: <UrlRewrites /> },
  { row: 74, path: '/admin/admin/url_rewrite/index', title: 'URL Rewrites', component: <UrlRewrites /> },
  { row: 75, path: '/admin/newsletter/template', title: 'Newsletter Templates', component: <NewsletterTemplates /> },
  { row: 76, path: '/admin/newsletter/queue', title: 'Newsletter Queue', component: <NewsletterQueue /> },
  { row: 77, path: '/admin/newsletter/subscriber', title: 'Newsletter Subscribers', component: <NewsletterSubscribers /> },
  { row: 78, path: '/admin/newsletter/problem', title: 'Newsletter Problems Report', component: <NewsletterProblems /> },
  { row: 79, path: '/admin/checkout/agreement', title: 'Terms and Conditions', component: <CheckoutAgreements /> },

  /* ---- 6. Reports (ROUTES rows 80-100) ---- */
  /* Every report also answers at `<path>/filter/<base64 querystring>/`, which is
   * where the source's own filter form submits to. */
  { row: 80, path: '/admin/reports/report_sales/sales', title: 'Orders Report', component: <OrdersReport /> },
  { row: 80, path: '/admin/reports/report_sales/sales/filter/:filter/*', title: 'Orders Report', component: <OrdersReport /> },
  { row: 81, path: '/admin/reports/report_sales/tax', title: 'Tax Report', component: <TaxReport /> },
  { row: 81, path: '/admin/reports/report_sales/tax/filter/:filter/*', title: 'Tax Report', component: <TaxReport /> },
  { row: 82, path: '/admin/reports/report_sales/invoiced', title: 'Invoice Report', component: <InvoicedReport /> },
  { row: 82, path: '/admin/reports/report_sales/invoiced/filter/:filter/*', title: 'Invoice Report', component: <InvoicedReport /> },
  { row: 83, path: '/admin/reports/report_sales/shipping', title: 'Shipping Report', component: <ShippingReport /> },
  { row: 83, path: '/admin/reports/report_sales/shipping/filter/:filter/*', title: 'Shipping Report', component: <ShippingReport /> },
  { row: 84, path: '/admin/reports/report_sales/refunded', title: 'Refunds Report', component: <RefundedReport /> },
  { row: 84, path: '/admin/reports/report_sales/refunded/filter/:filter/*', title: 'Refunds Report', component: <RefundedReport /> },
  { row: 85, path: '/admin/reports/report_sales/coupons', title: 'Coupons Report', component: <CouponsReport /> },
  { row: 85, path: '/admin/reports/report_sales/coupons/filter/:filter/*', title: 'Coupons Report', component: <CouponsReport /> },
  { row: 86, path: '/admin/reports/report_sales/bestsellers', title: 'Bestsellers Report', component: <BestsellersReport /> },
  { row: 86, path: '/admin/reports/report_sales/bestsellers/filter/:filter/*', title: 'Bestsellers Report', component: <BestsellersReport /> },
  { row: 87, path: '/admin/reports/report_product/sold', title: 'Ordered Products Report', component: <OrderedProductsReport /> },
  { row: 87, path: '/admin/reports/report_product/sold/filter/:filter/*', title: 'Ordered Products Report', component: <OrderedProductsReport /> },
  { row: 88, path: '/admin/reports/report_product/lowstock', title: 'Low Stock Report', component: <LowStockReport /> },
  { row: 89, path: '/admin/reports/report_product/viewed', title: 'Product Views Report', component: <ProductViewsReport /> },
  { row: 89, path: '/admin/reports/report_product/viewed/filter/:filter/*', title: 'Product Views Report', component: <ProductViewsReport /> },
  { row: 90, path: '/admin/reports/report_product/downloads', title: 'Downloads Report', component: <DownloadsReport /> },
  { row: 91, path: '/admin/reports/report_customer/orders', title: 'Order Count Report', component: <OrderCountReport /> },
  { row: 91, path: '/admin/reports/report_customer/orders/filter/:filter/*', title: 'Order Count Report', component: <OrderCountReport /> },
  { row: 92, path: '/admin/reports/report_customer/totals', title: 'Order Total Report', component: <OrderTotalReport /> },
  { row: 92, path: '/admin/reports/report_customer/totals/filter/:filter/*', title: 'Order Total Report', component: <OrderTotalReport /> },
  { row: 93, path: '/admin/reports/report_customer/accounts', title: 'New Accounts Report', component: <NewAccountsReport /> },
  { row: 93, path: '/admin/reports/report_customer/accounts/filter/:filter/*', title: 'New Accounts Report', component: <NewAccountsReport /> },
  { row: 94, path: '/admin/reports/report_review/customer', title: 'Customer Reviews Report', component: <CustomerReviewsReport /> },
  { row: 95, path: '/admin/reports/report_review/product', title: 'Product Reviews Report', component: <ProductReviewsReport /> },
  { row: 96, path: '/admin/reports/report_review/product/detail/id/:productId', title: 'Product Reviews Report', component: <ProductReviewsDetail /> },
  { row: 97, path: '/admin/reports/report_shopcart/product', title: 'Products in Carts', component: <ProductsInCartsReport /> },
  { row: 98, path: '/admin/reports/report_shopcart/abandoned', title: 'Abandoned Carts', component: <AbandonedCartsReport /> },
  { row: 99, path: '/admin/reports/report_statistics', title: 'Refresh Statistics', component: <RefreshStatistics /> },
  { row: 100, path: '/admin/analytics/reports/show', title: 'Advanced Reporting', component: <AdvancedReporting /> },

  /* ---- 7. Content (ROUTES rows 101-111) ---- */
  { row: 101, path: '/admin/cms/page', title: 'Pages', component: <CmsPageGrid /> },
  { row: 101, path: '/admin/cms/page/index', title: 'Pages', component: <CmsPageGrid /> },
  { row: 102, path: '/admin/cms/page/edit/page_id/:id', title: 'Edit Page', component: <CmsPageEdit /> },
  { row: 103, path: '/admin/cms/page/new', title: 'New Page', component: <CmsPageEdit isNew /> },
  { row: 103, path: '/admin/cms/page/save', title: 'Pages', component: <CmsPageSave /> },
  { row: 104, path: '/admin/cms/block', title: 'Blocks', component: <CmsBlockGrid /> },
  { row: 104, path: '/admin/cms/block/index', title: 'Blocks', component: <CmsBlockGrid /> },
  { row: 104, path: '/admin/cms/block/edit/block_id/:id', title: 'Edit Block', component: <CmsBlockEdit /> },
  { row: 104, path: '/admin/cms/block/new', title: 'New Block', component: <CmsBlockEdit isNew /> },
  { row: 105, path: '/admin/admin/widget_instance', title: 'Widgets', component: <Widgets /> },
  { row: 106, path: '/admin/media_gallery/media', title: 'Manage Gallery', component: <MediaGallery /> },
  { row: 106, path: '/admin/media_gallery/media/index', title: 'Manage Gallery', component: <MediaGallery /> },
  { row: 107, path: '/admin/theme/design_config', title: 'Design Configuration', component: <DesignConfig /> },
  { row: 108, path: '/admin/admin/system_design_theme', title: 'Themes', component: <ThemesGrid /> },
  { row: 109, path: '/admin/admin/system_design_theme/edit/id/:id', title: 'Theme', component: <ThemeEdit /> },
  { row: 110, path: '/admin/admin/system_design', title: 'Store Design Schedule', component: <DesignSchedule /> },
  { row: 111, path: '/admin/pagebuilder/template', title: 'Templates', component: <PageBuilderTemplates /> },

  /* ---- 8. Stores / System (ROUTES rows 112-133) ---- */
  { row: 112, path: '/admin/admin/system_store', title: 'Stores', component: <AllStores /> },
  { row: 113, path: '/admin/admin/system_config', title: 'Configuration', component: <Configuration /> },
  { row: 114, path: '/admin/admin/system_config/edit/section/:section', title: 'Configuration', component: <Configuration /> },
  { row: 115, path: '/admin/admin/system_currency', title: 'Currency Rates', component: <CurrencyRates /> },
  { row: 116, path: '/admin/admin/system_currencysymbol', title: 'Currency Symbols', component: <CurrencySymbols /> },
  { row: 117, path: '/admin/tax/rate', title: 'Tax Zones and Rates', component: <TaxRates /> },
  { row: 118, path: '/admin/tax/rule', title: 'Tax Rules', component: <TaxRules /> },
  { row: 119, path: '/admin/tax/rate/importExport', title: 'Import and Export Tax Rates', component: <TaxImportExport /> },
  { row: 120, path: '/admin/admin/user', title: 'Users', component: <AdminUsers /> },
  { row: 121, path: '/admin/admin/user_role', title: 'Roles', component: <AdminRoles /> },
  { row: 122, path: '/admin/admin/system_variable', title: 'Custom Variables', component: <CustomVariables /> },
  { row: 123, path: '/admin/admin/cache', title: 'Cache Management', component: <CacheManagement /> },
  { row: 124, path: '/admin/indexer/indexer/list', title: 'Index Management', component: <IndexManagement /> },
  { row: 125, path: '/admin/admin/import', title: 'Import', component: <ImportPage /> },
  { row: 125, path: '/admin/admin/export', title: 'Export', component: <ExportPage /> },
  { row: 126, path: '/admin/admin/history', title: 'Import History', component: <ImportHistory /> },
  { row: 127, path: '/admin/admin/integration', title: 'Integrations', component: <Integrations /> },
  { row: 128, path: '/admin/bulk', title: 'Bulk Actions Log', component: <BulkActions /> },
  { row: 128, path: '/admin/bulk/index', title: 'Bulk Actions Log', component: <BulkActions /> },
  { row: 129, path: '/admin/admin/sitemap', title: 'Site Map', component: <SiteMap /> },
  { row: 130, path: '/admin/admin/email_template', title: 'Email Templates', component: <EmailTemplates /> },
  { row: 131, path: '/admin/security/session/activity', title: 'Login Sessions', component: <AccountActivity /> },
  { row: 132, path: '/admin/admin/locks', title: 'Locked Users', component: <LockedUsers /> },
  { row: 133, path: '/admin/admin/crypt_key', title: 'Encryption Key', component: <EncryptionKey /> },

  /* ---- menu-reachable external/SaaS surfaces (ROUTES "Intentionally Not
   * Migrated"): the rail links to them, so they must resolve rather than 404,
   * but they render nothing beyond the shell. ---- */
  { row: null, path: '/admin/marketplace', title: 'Find Partners & Extensions', component: <Marketplace /> },
  { row: null, path: '/admin/marketplace/index', title: 'Find Partners & Extensions', component: <Marketplace /> },
  { row: null, path: '/admin/braintree/virtual', title: 'Braintree Virtual Terminal', component: <BraintreeVirtualTerminal /> },
  { row: null, path: '/admin/braintree/report', title: 'Braintree Settlement Report', component: <BraintreeSettlementReport /> },
  { row: null, path: '/admin/paypal/paypal_reports', title: 'PayPal Settlement Reports', component: <PaypalSettlementReports /> },
  { row: null, path: '/admin/analytics/biessentials/signup', title: 'BI Essentials', component: <BiEssentials /> },

  /* =========================================================================
   * 10. GET-navigable source paths that were reachable by clicking but had no
   *     route, so they landed on <NotFound /> (PARITY-010, HANDLERS-011).
   *
   * Paths are the source's, VERBATIM. Two kinds of entry:
   *
   *   (a) a real create/edit form, where the collection behind it is in state
   *       and the mock can genuinely write it;
   *   (b) the area's own index page rendered AT the source URL, where the
   *       editor is out of scope. That keeps the URL an evaluator checks
   *       intact and shows the agent the honest listing it came from, instead
   *       of a 404 or an invented form. Each such row says so.
   * ========================================================================= */

  /* ---- (a) real forms — Stores > Taxes, System > Permissions ---- */
  { row: 117, path: '/admin/tax/rate/add', title: 'New Tax Rate', component: <TaxRateForm isNew /> },
  { row: 117, path: '/admin/tax/rate/edit/rate/:id', title: 'Edit Tax Rate', component: <TaxRateForm /> },
  { row: 118, path: '/admin/tax/rule/new', title: 'New Tax Rule', component: <TaxRuleForm isNew /> },
  { row: 118, path: '/admin/tax/rule/edit/rule/:id', title: 'Edit Tax Rule', component: <TaxRuleForm /> },
  { row: 120, path: '/admin/admin/user/new', title: 'New User', component: <AdminUserForm isNew /> },
  { row: 120, path: '/admin/admin/user/edit/user_id/:id', title: 'Edit User', component: <AdminUserForm /> },
  /* The source uses ONE path for create and edit: no `rid` means create. */
  { row: 121, path: '/admin/admin/user_role/editrole', title: 'New Role', component: <AdminRoleForm /> },
  { row: 121, path: '/admin/admin/user_role/editrole/rid/:id', title: 'Edit Role', component: <AdminRoleForm /> },

  /* ---- (a) real delete actions — Content > Pages / Blocks ---- */
  { row: 101, path: '/admin/cms/page/delete/page_id/:id', title: 'Pages', component: <CmsPageDelete /> },
  { row: 104, path: '/admin/cms/block/delete/block_id/:id', title: 'Blocks', component: <CmsBlockDelete /> },

  /* ---- dashboard alias ---- */
  { row: 3, path: '/admin/admin/dashboard/index', title: 'Dashboard', component: <Dashboard /> },

  /* ---- (b) reports: the report's own store filter appends `/store/null/`.
   *      Both are served by the grid-state splat in §11 — `store/null` is just
   *      one more `/key/value/` pair — so no explicit row is needed here. ---- */

  /* ---- (b) Content: editors ROUTES.md already records as out of scope ---- */
  /* Design Configuration: ROUTES row 107 declares the in-row editor a deliberate
     deviation, but the source's per-scope Edit URLs must still resolve. */
  { row: 107, path: '/admin/theme/design_config/edit/scope/default', title: 'Design Configuration', component: <DesignConfig /> },
  { row: 107, path: '/admin/theme/design_config/edit/scope/websites/scope_id/:id', title: 'Design Configuration', component: <DesignConfig /> },
  { row: 107, path: '/admin/theme/design_config/edit/scope/stores/scope_id/:id', title: 'Design Configuration', component: <DesignConfig /> },
  { row: 105, path: '/admin/admin/widget_instance/new', title: 'Widgets', component: <WidgetForm /> },
  { row: 105, path: '/admin/admin/widget_instance/edit/instance_id/:id/code/:code', title: 'Widgets', component: <WidgetForm /> },
  { row: 110, path: '/admin/admin/system_design/new', title: 'Store Design Schedule', component: <DesignChangeForm /> },

  /* ---- (b) Stores / System: scope + tool editors, out of scope ---- */
  { row: 112, path: '/admin/admin/system_store/newWebsite', title: 'Stores', component: <WebsiteForm /> },
  { row: 112, path: '/admin/admin/system_store/newGroup', title: 'Stores', component: <StoreGroupForm /> },
  { row: 112, path: '/admin/admin/system_store/newStore', title: 'Stores', component: <StoreViewForm /> },
  { row: 112, path: '/admin/admin/system_store/editWebsite/website_id/:id', title: 'Stores', component: <WebsiteForm /> },
  { row: 112, path: '/admin/admin/system_store/editGroup/group_id/:id', title: 'Stores', component: <StoreGroupForm /> },
  { row: 112, path: '/admin/admin/system_store/editStore/store_id/:id', title: 'Stores', component: <StoreViewForm /> },
  { row: 122, path: '/admin/admin/system_variable/new', title: 'Custom Variables', component: <CustomVariableForm /> },
  { row: 127, path: '/admin/admin/integration/new', title: 'Integrations', component: <IntegrationForm /> },
  { row: 127, path: '/admin/admin/integration/edit/id/:id', title: 'Integrations', component: <IntegrationForm /> },
  { row: 129, path: '/admin/admin/sitemap/new', title: 'Site Map', component: <SitemapForm /> },
  { row: 130, path: '/admin/admin/email_template/new', title: 'Email Templates', component: <EmailTemplateForm /> },

  /* ---- (b) sibling-owned areas: routed to the honest area page so the click
   *      does not 404. The editors themselves belong to the sales / catalog /
   *      customers / marketing / reviews agents. ---- */
  /* `/order_status/new` and `/assign` are registered with real pages in the
     Sales section above. HANDLERS-034: the per-status Edit route is a real
     `Edit Order Status` form on the source, not an alias of the grid. */
  { row: 38, path: '/admin/sales/order_status/edit/status/:status', title: 'Edit Order Status', component: <OrderStatusEdit /> },
  { row: 29, path: '/admin/sales/order_create/start', title: 'Create New Order', component: <CustomerGrid /> },
  { row: 44, path: '/admin/catalog/category/add', title: 'Categories', component: <CategoryPage /> },
  { row: 45, path: '/admin/catalog/category/delete/id/:id', title: 'Categories', component: <CategoryPage /> },
  { row: 46, path: '/admin/catalog/product_attribute/new', title: 'New Product Attribute', component: <ProductAttributeNew /> },
  { row: 48, path: '/admin/catalog/product_set/add', title: 'New Attribute Set', component: <AttributeSetNew /> },
  { row: 50, path: '/admin/inventory/source/new', title: 'Manage Sources', component: <ManageSources /> },
  { row: 50, path: '/admin/inventory/source/edit/source_code/:code', title: 'Manage Sources', component: <ManageSources /> },
  { row: 51, path: '/admin/inventory/stock/new', title: 'Manage Stock', component: <ManageStock /> },
  { row: 51, path: '/admin/inventory/stock/edit/stock_id/:id', title: 'Manage Stock', component: <ManageStock /> },
  { row: 56, path: '/admin/customer/group/delete/id/:id', title: 'Customer Groups', component: <CustomerGroupGrid /> },
  { row: 64, path: '/admin/catalog_rule/promo_catalog/new', title: 'Catalog Price Rule', component: <CatalogPriceRuleForm /> },
  { row: 64, path: '/admin/catalog_rule/promo_catalog/edit/id/:id', title: 'Catalog Price Rule', component: <CatalogPriceRuleForm /> },
  { row: 69, path: '/admin/review/rating/new', title: 'Ratings', component: <RatingForm /> },
  { row: 69, path: '/admin/review/rating/edit/id/:id', title: 'Ratings', component: <RatingForm /> },
  /* The New Review picker's "Select" link. In the source it swaps the picker for
     the review form in place; until Reviews.jsx does that it must at least land
     back on the New Review page rather than the 404. */
  { row: 65, path: '/admin/review/product/jsonProductInfo/id/:id', title: 'New Review', component: <NewReview /> },
  { row: 73, path: '/admin/search/synonyms/new', title: 'Search Synonyms', component: <SynonymGroupForm /> },
  { row: 74, path: '/admin/admin/url_rewrite/edit', title: 'URL Rewrites', component: <UrlRewriteForm /> },
  { row: 74, path: '/admin/admin/url_rewrite/edit/id/:id', title: 'URL Rewrites', component: <UrlRewriteForm /> },
  { row: 75, path: '/admin/newsletter/template/new', title: 'Newsletter Templates', component: <NewsletterTemplateForm /> },
  { row: 79, path: '/admin/checkout/agreement/new', title: 'Terms and Conditions', component: <CheckoutAgreementForm /> },
]

/* =========================================================================
 * 11. LEGACY GRID-STATE DEEP LINKS (DIFF-R67)
 *
 * A Magento admin URL is `/admin/<front>/<controller>/<action>/<k>/<v>/…`, and
 * a grid spells its whole state into those trailing pairs:
 *
 *     /admin/search/term/report/sort/popularity/dir/desc/page/1/limit/30/filter/<base64>/
 *
 * An agent that sorts or pages ANY admin listing ends up on a URL of that shape,
 * and the evaluator checks the URL it ends up on — so every one of them has to
 * cold-load here, with the encoded state actually applied.
 *
 * ── The rule, measured against the live source ──────────────────────────────
 * The pairs are reachable only when the **action segment is written out**. Omit
 * it and the first pair slides into the action slot and the source 404s:
 *
 *     /admin/sales/order_status/sort/label/dir/desc/         → 404 on the source
 *     /admin/sales/order_status/index/sort/label/dir/desc/   → 200, sort applied
 *     /admin/review/product/sort/created_at/dir/asc/         → 404 on the source
 *     /admin/review/product/index/sort/created_at/dir/asc/   → 200, sort applied
 *
 * So the splat hangs off the action-qualified path ONLY. `/admin/search/term`,
 * `/admin/review/product`, `/admin/sales/order_status` and friends keep landing
 * on <NotFound /> when segments follow them, which is the source's answer too.
 *
 * ── Which grid applies what ─────────────────────────────────────────────────
 * Pages the mock renders with the legacy grid (Reviews, Pending Reviews, Search
 * Terms Report, Low Stock, Abandoned Carts) read the segments directly in
 * components/reports/LegacyGrid.jsx / components/reviews/LegacyReviewGrid.jsx.
 * Everything else renders <AdminGrid>, which maps them onto its own query-param
 * state in components/grid/legacySegments.js. Either way the state is applied,
 * not merely tolerated.
 *
 * Each entry is `[sourcePath, rowToCopy]`. `rowToCopy` names the ROUTE_TABLE row
 * whose component serves that path, so the splat can never drift away from the
 * page it decorates; it is omitted when `sourcePath` is itself in ROUTE_TABLE.
 * Every `sourcePath` below was cold-loaded against the live source at
 * localhost:7780 and returns 200.
 * ========================================================================= */

const GRID_STATE_PATHS = [
  /* ---- legacy grids in the mock: sort/dir/page/limit/filter all applied ---- */
  ['/admin/review/product/index'],
  ['/admin/review/product/pending'],
  ['/admin/search/term/report'],
  ['/admin/reports/report_product/lowstock'],
  ['/admin/reports/report_shopcart/abandoned'],

  /* ---- legacy on the source, <AdminGrid> in the mock ---- */
  ['/admin/sales/order_status/index'],
  ['/admin/review/rating/index', '/admin/review/rating'],
  ['/admin/search/term/index'],
  ['/admin/sales_rule/promo_quote/index'],
  ['/admin/catalog_rule/promo_catalog/index', '/admin/catalog_rule/promo_catalog'],
  ['/admin/newsletter/template/index', '/admin/newsletter/template'],
  ['/admin/newsletter/queue/index', '/admin/newsletter/queue'],
  ['/admin/newsletter/subscriber/index', '/admin/newsletter/subscriber'],
  ['/admin/newsletter/problem/index', '/admin/newsletter/problem'],
  ['/admin/checkout/agreement/index', '/admin/checkout/agreement'],
  ['/admin/admin/url_rewrite/index'],
  ['/admin/admin/user/index', '/admin/admin/user'],
  ['/admin/admin/user_role/index', '/admin/admin/user_role'],
  ['/admin/tax/rate/index', '/admin/tax/rate'],
  ['/admin/tax/rule/index', '/admin/tax/rule'],
  ['/admin/catalog/product_attribute/index', '/admin/catalog/product_attribute'],
  ['/admin/catalog/product_set/index', '/admin/catalog/product_set'],
  ['/admin/admin/system_variable/index', '/admin/admin/system_variable'],
  ['/admin/admin/email_template/index', '/admin/admin/email_template'],
  ['/admin/admin/locks/index', '/admin/admin/locks'],
  ['/admin/admin/sitemap/index', '/admin/admin/sitemap'],
  ['/admin/admin/integration/index', '/admin/admin/integration'],
  ['/admin/admin/history/index', '/admin/admin/history'],
  ['/admin/admin/widget_instance/index', '/admin/admin/widget_instance'],
  ['/admin/admin/system_design/index', '/admin/admin/system_design'],
  /* Round 10 — both are LEGACY grids on the source and now on the mock too, so
     their `/sort/…/dir/…/page/…/limit/…/filter/<base64>/` state needs the same
     splat every other legacy grid has. Both cold-load 200 on the source. */
  ['/admin/admin/system_store/index', '/admin/admin/system_store'],
  ['/admin/admin/notification/index', '/admin/admin/notification'],
  ['/admin/sales/transactions/index', '/admin/sales/transactions'],
  ['/admin/paypal/billing_agreement/index', '/admin/paypal/billing_agreement'],
  ['/admin/reports/report_product/downloads'],
  ['/admin/reports/report_review/product'],
  ['/admin/reports/report_review/customer'],
  ['/admin/reports/report_shopcart/product'],

  /* ---- UI-component on both sides: the source 200s and ignores the segments;
   *      the mock resolves rather than 404ing, which is what the evaluator
   *      checks. <AdminGrid> applies whatever names a real column — a
   *      deliberate superset, documented in ROUTES.md. ---- */
  ['/admin/sales/order/index'],
  ['/admin/sales/invoice/index'],
  ['/admin/sales/shipment/index'],
  ['/admin/sales/creditmemo/index'],
  ['/admin/catalog/product/index'],
  ['/admin/customer/index/index'],
  ['/admin/customer/group/index', '/admin/customer/group'],
  ['/admin/customer/online/index', '/admin/customer/online'],
  ['/admin/loginascustomer_log/log/index'],
  ['/admin/inventory/source/index'],
  ['/admin/inventory/stock/index'],
  ['/admin/search/synonyms/index'],
  ['/admin/cms/page/index'],
  ['/admin/cms/block/index'],
  ['/admin/bulk/index'],
  ['/admin/admin/system_design_theme/index', '/admin/admin/system_design_theme'],
  ['/admin/media_gallery/media/index'],
]

/**
 * Expand GRID_STATE_PATHS into route rows: the action-qualified path itself
 * (when ROUTE_TABLE lacks it) plus its `/*` splat, both served by the same
 * component as the row they copy.
 */
function gridStateRoutes(table) {
  const byPath = new Map(table.map(r => [r.path, r]))
  const out = []
  for (const [sourcePath, copyFrom] of GRID_STATE_PATHS) {
    const base = byPath.get(sourcePath) || byPath.get(copyFrom || sourcePath)
    if (!base) continue
    if (!byPath.has(sourcePath)) out.push({ ...base, path: sourcePath })
    out.push({ ...base, path: `${sourcePath}/*` })
  }
  return out
}

const GRID_STATE_ROUTES = gridStateRoutes(ROUTE_TABLE)

export default function App() {
  const location = useLocation()

  if (/\/key\/[^/]+(\/|$)/.test(location.pathname)) {
    return <KeySegmentRedirect />
  }

  /* WEBARENA_MIGRATION.md §5: `/go` renders the raw state JSON with no admin
     chrome, like websites/mixpanel_mock/src/App.jsx:26. It is matched here,
     ahead of AdminLayout, so the viewer is not wrapped in the admin shell. */
  if (location.pathname === '/go' || location.pathname === '/go/') {
    return (
      <Routes>
        <Route path="/go" element={<GoPage />} />
        <Route path="/go/" element={<GoPage />} />
      </Routes>
    )
  }

  return (
    <AdminLayout>
      <Routes>
        {/* ROUTES rows 1-2: the source 302s through the login form; the mock is
            already logged in and goes straight to the dashboard. */}
        <Route path="/" element={<RedirectWithQuery to="/admin/admin/dashboard/" />} />
        <Route path="/admin" element={<RedirectWithQuery to="/admin/admin/dashboard/" />} />
        <Route path="/admin/admin" element={<RedirectWithQuery to="/admin/admin/dashboard/" />} />
        {/* Login/logout are never migrated — land on the dashboard instead of a gate. */}
        <Route path="/admin/admin/auth/login" element={<RedirectWithQuery to="/admin/admin/dashboard/" />} />
        <Route path="/admin/admin/auth/logout" element={<RedirectWithQuery to="/admin/admin/dashboard/" />} />

        {[...ROUTE_TABLE, ...GRID_STATE_ROUTES].map(r => (
          <Route
            key={r.path}
            path={r.path}
            element={r.component || <AreaPage title={r.title} />}
          />
        ))}

        <Route path="*" element={<NotFound />} />
      </Routes>
    </AdminLayout>
  )
}

export { ROUTE_TABLE, GRID_STATE_PATHS, GRID_STATE_ROUTES }
