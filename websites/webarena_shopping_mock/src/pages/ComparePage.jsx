import React from 'react'
import Page from '../components/Page.jsx'
import ProductImage from '../components/ProductImage.jsx'
import Rating from '../components/Rating.jsx'
import { AddToCartButton } from '../components/ProductGrid.jsx'
import { useApp } from '../context/AppContext.jsx'
import { SLink } from '../utils/url.js'
import { productsById, ratingPercent, getDescription } from '../utils/catalog.js'
import { money } from '../utils/format.js'
import { sanitizeStoredHtml } from '../utils/html.js'

function stripHtml(html, max = 300) {
  const text = sanitizeStoredHtml(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

/** ROUTES #8 — /catalog/product_compare/index/ */
export default function ComparePage() {
  const { state, removeFromCompare, clearCompare, addMessage } = useApp()
  const products = state.compareList.items
    .map(i => productsById.get(i.productId))
    .filter(Boolean)

  return (
    // The <h1> and the document <title> genuinely differ on the source:
    // h1 = "Compare Products", <title> = "Products Comparison List - Magento Commerce".
    <Page title="Compare Products" documentTitle="Products Comparison List - Magento Commerce" sidebar="none">
      {products.length === 0 ? (
        <div className="message info empty"><div><span>You have no items to compare.</span></div></div>
      ) : (
        <>
          <div className="actions-toolbar" style={{ marginBottom: 15 }}>
            <button type="button" className="action secondary" onClick={() => {
              clearCompare()
              addMessage('You cleared the comparison list.')
            }}><span>Clear All</span></button>
          </div>
          <table className="data table table-comparison" id="product-comparison">
            <tbody>
              <tr>
                {products.map(p => (
                  <td key={p.id} className="cell product info">
                    <SLink to={`/${p.urlKey}.html`}><ProductImage product={p} /></SLink>
                    <strong className="product-item-name">
                      <SLink to={`/${p.urlKey}.html`}>{p.name}</SLink>
                    </strong>
                    <Rating percent={ratingPercent(p, state.myReviews)} />
                    <div className="price-box"><span className="price">{money(p.price)}</span></div>
                    <div className="product-item-inner">
                      <AddToCartButton product={p} />{' '}
                      <button type="button" className="action delete secondary action small"
                        onClick={() => removeFromCompare(p.id)}>
                        <span>Remove Product</span>
                      </button>
                    </div>
                  </td>
                ))}
              </tr>
              <tr>
                {products.map(p => (
                  <td key={p.id} className="cell product attribute"><strong>SKU</strong><div>{p.sku}</div></td>
                ))}
              </tr>
              <tr>
                {products.map(p => (
                  <td key={p.id} className="cell product attribute">
                    <strong>Description</strong>
                    <div>{stripHtml(getDescription(p.id))}</div>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </>
      )}
    </Page>
  )
}
