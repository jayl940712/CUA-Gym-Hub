import React, { useEffect, useRef } from 'react'
import {
  BrowserRouter, Routes, Route, Navigate, useSearchParams, useParams, useLocation,
} from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext.jsx'
import Layout from './components/Layout.jsx'

import HomePage from './pages/HomePage.jsx'
import CategoryPage from './pages/CategoryPage.jsx'
import ProductPage from './pages/ProductPage.jsx'
import SearchPage from './pages/SearchPage.jsx'
import AdvancedSearchPage, { AdvancedSearchResultPage } from './pages/AdvancedSearchPage.jsx'
import CartPage from './pages/CartPage.jsx'
import CartConfigurePage from './pages/CartConfigurePage.jsx'
import CheckoutPage from './pages/CheckoutPage.jsx'
import CheckoutSuccessPage from './pages/CheckoutSuccessPage.jsx'
import AccountDashboard from './pages/AccountDashboard.jsx'
import AccountEditPage from './pages/AccountEditPage.jsx'
import AddressBookPage from './pages/AddressBookPage.jsx'
import AddressEditPage from './pages/AddressEditPage.jsx'
import OrderHistoryPage from './pages/OrderHistoryPage.jsx'
import OrderViewPage from './pages/OrderViewPage.jsx'
import OrderPrintPage from './pages/OrderPrintPage.jsx'
import WishlistPage from './pages/WishlistPage.jsx'
import MyReviewsPage, { ReviewViewPage } from './pages/MyReviewsPage.jsx'
import ReviewListAjaxPage from './pages/ReviewListAjaxPage.jsx'
import ComparePage from './pages/ComparePage.jsx'
import ContactPage from './pages/ContactPage.jsx'
import {
  NewsletterPage, DownloadableProductsPage, StoredPaymentMethodsPage,
  ShareWishlistPage, MultishippingPage,
} from './pages/SimpleAccountPages.jsx'
import { PrivacyPolicyPage, SearchTermsPage, NotFound } from './pages/CmsPages.jsx'
import GoPage from './pages/GoPage.jsx'

import {
  getCategory, getCategoryByUrlPath, getProduct, getProductByUrlKey, productsById,
} from './utils/catalog.js'
import { useStoreNavigate } from './utils/url.js'

/** ?sid= must survive every redirect. */
function RedirectWithQuery({ to }) {
  const [searchParams] = useSearchParams()
  const query = searchParams.toString()
  return <Navigate to={query ? `${to}?${query}` : to} replace />
}

/* ------------------------------------------------------------------ */
/* Id-addressed catalog routes                                         */
/* ------------------------------------------------------------------ */

function CategoryById() {
  const { id } = useParams()
  const category = getCategory(id)
  if (!category) return <NotFound />
  return <CategoryPage category={category} path={`/${category.urlPath}.html`} />
}

function ProductById() {
  const { id } = useParams()
  const product = getProduct(id)
  if (!product) return <NotFound />
  return <ProductPage product={product} />
}

function ReviewListAjaxRoute() {
  const { id } = useParams()
  return <ReviewListAjaxPage productId={id} />
}

/* ------------------------------------------------------------------ */
/* In-app action routes (the source performs these as POST/redirect)   */
/* ------------------------------------------------------------------ */

function AddToCartRoute() {
  const { id } = useParams()
  const { addToCart, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    const product = productsById.get(Number(id))
    if (product) {
      addToCart(product, 1, [])
      addMessage(`You added ${product.name} to your shopping cart.`)
    }
    navigate('/checkout/cart/', {}, { replace: true })
  }, [id])
  return null
}

function DeleteCartItemRoute() {
  const { id } = useParams()
  const { removeCartItem, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    removeCartItem(Number(id))
    addMessage('You removed the item.')
    navigate('/checkout/cart/', {}, { replace: true })
  }, [id])
  return null
}

function ReorderRoute() {
  const { id } = useParams()
  const { state, reorder, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    const order = state.orders.find(o => Number(o.entityId) === Number(id))
    if (order) {
      reorder(order.entityId)
      addMessage(`You added ${order.items.length} product(s) to your shopping cart.`)
    }
    navigate('/checkout/cart/', {}, { replace: true })
  }, [id])
  return null
}

function WishlistAddRoute() {
  const { id } = useParams()
  const { addToWishlist, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const done = useRef(false)
  useEffect(() => {
    if (done.current) return
    done.current = true
    const product = productsById.get(Number(id))
    if (product) {
      addToWishlist(product)
      addMessage(`${product.name} has been added to your Wish List.`)
    }
    navigate('/wishlist/', {}, { replace: true })
  }, [id])
  return null
}

function CartConfigureRoute() {
  const { itemId, productId } = useParams()
  return <CartConfigurePage itemId={itemId} productId={productId} />
}

function OrderViewRoute() {
  const { id } = useParams()
  return <OrderViewPage orderId={id} />
}

function OrderPrintRoute() {
  const { id } = useParams()
  return <OrderPrintPage orderId={id} />
}

function AddressEditRoute() {
  const { id } = useParams()
  return <AddressEditPage addressId={id} />
}

function ReviewViewRoute() {
  const { id } = useParams()
  return <ReviewViewPage reviewId={id} />
}

/* ------------------------------------------------------------------ */
/* Catch-all — url-key catalog routes and the 404 CMS page             */
/* ------------------------------------------------------------------ */

/**
 * Magento serves categories at /<url_path>.html and products at
 * /<url_key>.html from the same root namespace, so one catch-all resolves
 * both. Anything else — including the malformed WebArena start URL
 * …sport-specific-clothing.html&product_list_order=price — renders the 404
 * page, exactly as the source does.
 */
function CatchAll() {
  const { pathname } = useLocation()
  let path = pathname
  try { path = decodeURIComponent(pathname) } catch (e) { /* keep raw */ }
  const trimmed = path.replace(/^\/+/, '').replace(/\/+$/, '')

  if (trimmed.endsWith('.html')) {
    const key = trimmed.slice(0, -'.html'.length)
    const category = getCategoryByUrlPath(key)
    if (category) return <CategoryPage category={category} path={`/${key}.html`} />
    const product = getProductByUrlKey(key)
    if (product) return <ProductPage product={product} />
    // Products are addressed at the root, but tolerate a nested path whose
    // last segment is a real url_key.
    const last = key.split('/').pop()
    const nested = getProductByUrlKey(last)
    if (nested) return <ProductPage product={nested} />
  }

  return <NotFound />
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/go" element={<GoPage />} />
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />

        {/* Search */}
        <Route path="/catalogsearch/result" element={<SearchPage />} />
        <Route path="/catalogsearch/result/index" element={<SearchPage />} />
        <Route path="/catalogsearch/advanced" element={<AdvancedSearchPage />} />
        <Route path="/catalogsearch/advanced/index" element={<AdvancedSearchPage />} />
        <Route path="/catalogsearch/advanced/result" element={<AdvancedSearchResultPage />} />
        <Route path="/search/term/popular" element={<SearchTermsPage />} />

        {/* Catalog by id */}
        <Route path="/catalog/category/view/id/:id" element={<CategoryById />} />
        <Route path="/catalog/category/view/id/:id/*" element={<CategoryById />} />
        <Route path="/catalog/product/view/id/:id" element={<ProductById />} />
        <Route path="/catalog/product/view/id/:id/*" element={<ProductById />} />
        <Route path="/review/product/listAjax/id/:id" element={<ReviewListAjaxRoute />} />
        <Route path="/catalog/product_compare" element={<ComparePage />} />
        <Route path="/catalog/product_compare/index" element={<ComparePage />} />

        {/* Cart & checkout */}
        <Route path="/checkout/cart" element={<CartPage />} />
        <Route path="/checkout/cart/index" element={<CartPage />} />
        <Route path="/checkout/cart/add/product/:id" element={<AddToCartRoute />} />
        <Route path="/checkout/cart/add/product/:id/*" element={<AddToCartRoute />} />
        <Route path="/checkout/cart/delete/id/:id" element={<DeleteCartItemRoute />} />
        <Route path="/checkout/cart/configure/id/:itemId/product_id/:productId" element={<CartConfigureRoute />} />
        <Route path="/checkout" element={<CheckoutPage />} />
        <Route path="/checkout/index/index" element={<CheckoutPage />} />
        <Route path="/checkout/onepage/success" element={<CheckoutSuccessPage />} />
        <Route path="/multishipping/checkout/login" element={<MultishippingPage />} />
        <Route path="/multishipping/checkout" element={<MultishippingPage />} />

        {/* Customer account */}
        <Route path="/customer/account" element={<AccountDashboard />} />
        <Route path="/customer/account/index" element={<AccountDashboard />} />
        <Route path="/customer/account/edit" element={<AccountEditPage />} />
        <Route path="/customer/account/edit/changepass/1" element={<AccountEditPage changePassword />} />
        <Route path="/customer/address" element={<AddressBookPage />} />
        <Route path="/customer/address/index" element={<AddressBookPage />} />
        <Route path="/customer/address/new" element={<AddressEditPage />} />
        <Route path="/customer/address/edit/id/:id" element={<AddressEditRoute />} />

        {/* The mock boots pre-logged-in; auth routes never gate anything. */}
        <Route path="/customer/account/login" element={<RedirectWithQuery to="/customer/account/" />} />
        <Route path="/customer/account/create" element={<RedirectWithQuery to="/customer/account/" />} />
        <Route path="/customer/account/forgotpassword" element={<RedirectWithQuery to="/customer/account/" />} />
        <Route path="/customer/account/logout" element={<RedirectWithQuery to="/" />} />

        {/* Orders */}
        <Route path="/sales/order/history" element={<OrderHistoryPage />} />
        <Route path="/sales/order/view/order_id/:id" element={<OrderViewRoute />} />
        <Route path="/sales/order/view/order_id/:id/*" element={<OrderViewRoute />} />
        <Route path="/sales/order/print/order_id/:id" element={<OrderPrintRoute />} />
        <Route path="/sales/order/reorder/order_id/:id" element={<ReorderRoute />} />

        {/* Wish list, reviews, newsletter, downloads */}
        <Route path="/wishlist" element={<WishlistPage />} />
        <Route path="/wishlist/index/index" element={<WishlistPage />} />
        <Route path="/wishlist/index/add/product/:id" element={<WishlistAddRoute />} />
        <Route path="/wishlist/index/share" element={<ShareWishlistPage />} />
        <Route path="/review/customer" element={<MyReviewsPage />} />
        <Route path="/review/customer/index" element={<MyReviewsPage />} />
        <Route path="/review/customer/view/id/:id" element={<ReviewViewRoute />} />
        <Route path="/downloadable/customer/products" element={<DownloadableProductsPage />} />
        <Route path="/vault/cards/listaction" element={<StoredPaymentMethodsPage />} />
        <Route path="/newsletter/manage" element={<NewsletterPage />} />

        {/* CMS */}
        <Route path="/contact" element={<ContactPage />} />
        <Route path="/contact/index/index" element={<ContactPage />} />
        <Route path="/privacy-policy-cookie-restriction-mode" element={<PrivacyPolicyPage />} />

        <Route path="*" element={<CatchAll />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  )
}
