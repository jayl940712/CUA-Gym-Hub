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
    // Source (home.html, cat-headphones.html):
    //   <div class="product-reviews-summary short">
    //     <div class="rating-summary">…</div>
    //     <div class="reviews-actions">
    //       <a class="action view" href="…html#reviews">12{ws}&nbsp;<span>Reviews{ws}</span></a>
    //   Collapsible whitespace AND a non-breaking space sit between the count
    //   and the word, which is why the source's innerText reads `12  Reviews`
    //   with two spaces. The `#reviews` fragment is dropped: buildUrl() appends
    //   `?sid=` after the path, so a fragment here would swallow the sid.
    <div className="product-reviews-summary short">
      <Rating percent={pct} variant="tile" />
      <div className="reviews-actions">
        <SLink to={`/${product.urlKey}.html`} className="action view">
          {`${count} \u00a0`}<span>{count === 1 ? 'Review' : 'Reviews'}</span>
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
  // DIFF-N03. Both tile actions are anchors on the source, inside a wrapper
  // that carries `data-role="add-to-links"`:
  //
  //   <div data-role="add-to-links" class="actions-secondary">
  //     <a href="#" class="action towishlist" title="Add to Wish List"
  //        aria-label="Add to Wish List" data-action="add-to-wishlist"
  //        role="button"><span>Add to Wish List</span></a>
  //     <a href="#" class="action tocompare" title="Add to Compare"
  //        aria-label="Add to Compare" role="button">
  //        <span>Add to Compare</span></a>
  //   </div>
  //
  // They were <button>s here, so a locator written as `a.towishlist` — the
  // shape anyone reading the source would write — selected nothing. `href="#"`
  // plus preventDefault keeps them anchors without navigating, and the icon
  // styling is attached by selector in globals.css so the class list stays
  // byte-identical to the source's.
  return (
    <div data-role="add-to-links" className="actions-secondary">
      <a
        href="#"
        className="action towishlist"
        title="Add to Wish List"
        aria-label="Add to Wish List"
        data-action="add-to-wishlist"
        role="button"
        onClick={e => {
          e.preventDefault()
          addToWishlist(product)
          addMessage(
            <span>{product.name} has been added to your Wish List.{' '}
              <SLink to="/">Click here</SLink> to continue shopping.</span>
          )
        }}
      >
        <HeartIcon size={18} />
        <span className="visually-hidden">Add to Wish List</span>
      </a>
      <a
        href="#"
        className="action tocompare"
        title="Add to Compare"
        aria-label="Add to Compare"
        role="button"
        onClick={e => {
          e.preventDefault()
          addToCompare(product)
          addMessage(`You added product ${product.name} to the comparison list.`)
        }}
      >
        <CompareIcon size={18} />
        <span className="visually-hidden">Add to Compare</span>
      </a>
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
