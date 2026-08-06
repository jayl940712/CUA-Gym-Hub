import React from 'react'
import Page from '../components/Page.jsx'
import Listing from '../components/Listing.jsx'
import LayeredNav from '../components/LayeredNav.jsx'
import { useUrlBuilder } from '../utils/url.js'
import { resolveListing, categoryAncestors, categoryUrl } from '../utils/catalog.js'

/**
 * ROUTES #3 / #4 — /<url_path>.html and /catalog/category/view/id/:id.
 *
 * ?cat=<id> filters to a descendant but the <h1> stays the *parent's* name;
 * several WebArena start URLs rely on that.
 */
export default function CategoryPage({ category, path }) {
  const { query } = useUrlBuilder()
  const listing = resolveListing({ path, query, categoryId: category.id })

  const ancestors = categoryAncestors(category)
  const breadcrumbs = ancestors.map((c, idx) => ({
    label: c.name,
    to: idx === ancestors.length - 1 ? null : categoryUrl(c),
    // Source renders the crumb's own category id as a class: `item category60`.
    className: `category${c.id}`,
  }))

  // Magento's category meta title is the breadcrumb chain reversed, joined with
  // " - ", roots excluded — /electronics/headphones/over-ear-headphones.html is
  // "Over-Ear Headphones - Headphones - Electronics". Query params (?cat=, ?p=,
  // ?product_list_order=) do not change it; verified against the live source.
  const documentTitle = ancestors.map((c) => c.name).reverse().join(' - ')

  return (
    <Page
      title={category.name}
      documentTitle={documentTitle}
      breadcrumbs={breadcrumbs}
      sidebar="catalog"
      sidebarTop={<LayeredNav listing={listing} categoryId={category.id} />}
    >
      <Listing listing={listing} isSearch={false} />
    </Page>
  )
}
