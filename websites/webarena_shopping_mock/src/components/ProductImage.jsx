import React, { useState } from 'react'
import { mediaUrl } from '../utils/catalog.js'

/**
 * Product JPEGs were copied out of the container into public/media/catalog/product,
 * keeping the source path shape so products.json values resolve unchanged.
 * If a file is missing we fall back to a deterministic local SVG placeholder
 * keyed off the SKU — no network call either way.
 */
function placeholder(sku, label) {
  let hash = 0
  const key = String(sku || label || '')
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) & 0xffff
  const hue = hash % 360
  const initials = String(label || sku || '?').replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="300" viewBox="0 0 240 300">
<rect width="240" height="300" fill="hsl(${hue},18%,93%)"/>
<text x="120" y="160" font-family="Helvetica,Arial,sans-serif" font-size="56" fill="hsl(${hue},22%,62%)" text-anchor="middle">${initials}</text>
</svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export default function ProductImage({ product, path, alt, className }) {
  const src = mediaUrl(path || (product && (product.smallImage || product.thumbnail || product.image)))
  const [failed, setFailed] = useState(false)
  const label = alt != null ? alt : (product ? product.name : '')
  const finalSrc = !src || failed ? placeholder(product && product.sku, label) : src
  return (
    <span className={`product-image-container ${className || ''}`}>
      <span className="product-image-wrapper">
        <img
          className="product-image-photo"
          src={finalSrc}
          alt={label}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      </span>
    </span>
  )
}

export function RawProductImage({ product, path, alt, style, className, ariaHidden }) {
  const src = mediaUrl(path)
  const [failed, setFailed] = useState(false)
  const finalSrc = !src || failed ? placeholder(product && product.sku, alt) : src
  return (
    <img
      src={finalSrc}
      alt={alt || ''}
      className={className}
      aria-hidden={ariaHidden}
      style={style}
      onError={() => setFailed(true)}
    />
  )
}
