import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import { SLink, useStoreNavigate } from '../utils/url.js'
import { finalPrice, getOptions, getDescription, ratingPercent, reviewCount } from '../utils/catalog.js'
import { money } from '../utils/format.js'
import { sanitizeStoredHtml } from '../utils/html.js'
import ProductImage from './ProductImage.jsx'
import Rating from './Rating.jsx'
import { HeartIcon, CompareIcon } from './Icons.jsx'

function stripHtml(html, max = 220) {
  const text = sanitizeStoredHtml(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max)}…` : text
}

export function PriceBox({ product }) {
  if (product.specialPrice != null) {
    return (
      <div className="price-box price-final_price">
        <span className="special-price"><span className="price">{money(product.specialPrice)}</span></span>{' '}
        <span className="old-price"><span className="price">{money(product.price)}</span></span>
      </div>
    )
  }
  return (
    <div className="price-box price-final_price">
      <span className="price-container"><span className="price">{money(product.price)}</span></span>
    </div>
  )
}

export function ReviewsSummary({ product }) {
  const { state } = useApp()
  const pct = ratingPercent(product, state.myReviews)
  const count = reviewCount(product, state.myReviews)
  if (!count) return null
  return (
    <div className="product-reviews-summary">
      <Rating percent={pct} />
      <div className="reviews-actions">
        <SLink to={`/${product.urlKey}.html`} className="action view">
          {count} {count === 1 ? 'Review' : 'Reviews'}
        </SLink>
      </div>
    </div>
  )
}

export function AddToCartButton({ product, className = 'action tocart primary' }) {
  const { addToCart, addMessage } = useApp()
  const navigate = useStoreNavigate()
  const options = getOptions(product.id)
  const onClick = () => {
    // Magento sends you to the product page when required options are unset.
    if (options.some(o => o.isRequire)) {
      navigate(`/${product.urlKey}.html`)
      return
    }
    addToCart(product, 1, [])
    addMessage(`You added ${product.name} to your shopping cart.`)
  }
  return (
    <button type="button" className={className} onClick={onClick}>
      <span>Add to Cart</span>
    </button>
  )
}

export function TileActions({ product }) {
  const { addToWishlist, addToCompare, addMessage } = useApp()
  return (
    <div className="actions-secondary">
      <button
        type="button"
        className="action towishlist icon-button"
        title="Add to Wish List"
        onClick={() => {
          addToWishlist(product)
          addMessage(
            <span>{product.name} has been added to your Wish List.{' '}
              <SLink to="/">Click here</SLink> to continue shopping.</span>
          )
        }}
      >
        <HeartIcon size={18} />
        <span className="visually-hidden">Add to Wish List</span>
      </button>
      <button
        type="button"
        className="action tocompare icon-button"
        title="Add to Compare"
        onClick={() => {
          addToCompare(product)
          addMessage(`You added product ${product.name} to the comparison list.`)
        }}
      >
        <CompareIcon size={18} />
        <span className="visually-hidden">Add to Compare</span>
      </button>
    </div>
  )
}

export function ProductTile({ product }) {
  return (
    <li className="item product product-item">
      <div className="product-item-info">
        <SLink to={`/${product.urlKey}.html`} className="product photo product-item-photo">
          <ProductImage product={product} />
        </SLink>
        <div className="product-item-details">
          <strong className="product-item-name">
            <SLink to={`/${product.urlKey}.html`} className="product-item-link">{product.name}</SLink>
          </strong>
          <ReviewsSummary product={product} />
          <PriceBox product={product} />
          <div className="product-item-inner">
            <AddToCartButton product={product} />
            <TileActions product={product} />
          </div>
        </div>
      </div>
    </li>
  )
}

function ProductRow({ product }) {
  return (
    <li className="item product product-item">
      <SLink to={`/${product.urlKey}.html`} className="product photo product-item-photo">
        <ProductImage product={product} />
      </SLink>
      <div className="product-item-details">
        <strong className="product-item-name">
          <SLink to={`/${product.urlKey}.html`} className="product-item-link">{product.name}</SLink>
        </strong>
        <ReviewsSummary product={product} />
        <PriceBox product={product} />
        <div className="product-item-description">{stripHtml(getDescription(product.id))}</div>
        <div className="product-item-inner">
          <AddToCartButton product={product} />
          <TileActions product={product} />
        </div>
      </div>
    </li>
  )
}

export default function ProductGrid({ products, mode = 'grid', columns = 4 }) {
  if (!products.length) {
    // Source class is `message info empty`, not `message notice`. Verified on
    // /clothing-shoes-jewelry/men/shoes.html?price=1000- :
    //   <div class="message info empty">
    //       <div>We can&#039;t find products matching the selection.</div>
    //   </div>
    return <div className="message info empty"><div>We can&#039;t find products matching the selection.</div></div>
  }
  if (mode === 'list') {
    return (
      <div className="products wrapper list products-list">
        <ol className="products list items product-items">
          {products.map(p => <ProductRow key={p.id} product={p} />)}
        </ol>
      </div>
    )
  }
  return (
    <div className={`products wrapper grid products-grid${columns === 5 ? ' columns5' : ''}`}>
      <ol className="products list items product-items">
        {products.map(p => <ProductTile key={p.id} product={p} />)}
      </ol>
    </div>
  )
}

export { finalPrice }
