import React, { useEffect, useRef, useState } from 'react'
import './adminForm.css'

/**
 * The handful of Magento admin form primitives the Catalog and Customers pages
 * share. Class names mirror the source's (`admin__field`, `admin__field-label`,
 * `admin__actions-switch`, `admin__collapsible-title`) so the DOM an agent reads
 * looks like the real page.
 */

/**
 * A DOM-only wrapper carrying the source's `data-index` for a control that the
 * mock renders inside another `.admin__field` (Magento nests `[data-index=price]`
 * inside `[data-index=container_price]`). `display: contents` keeps the extra
 * element out of layout entirely, so the selector resolves without moving a pixel.
 */
export function IndexWrap({ index, children }) {
  return <div data-index={index} style={{ display: 'contents' }}>{children}</div>
}

/** One labelled row of an `.admin__fieldset`. */
export function Field({
  label, scope, required = false, htmlFor, note, error, children, short = false,
  dataIndex,
}) {
  return (
    <div className="admin__field" data-index={dataIndex}>
      <div className="admin__field-label-wrap">
        <label className="admin__field-label" htmlFor={htmlFor}>
          {label}
          {required ? <span className="admin__field-required-mark" aria-hidden="true">*</span> : null}
        </label>
        {scope ? <span className="admin__field-scope">[{scope}]</span> : null}
      </div>
      <div className={`admin__field-control${short ? ' admin__field-control--short' : ''}`}>
        {children}
        {note ? <div className="admin__field-note">{note}</div> : null}
        {error ? <div className="admin__field-error">{error}</div> : null}
      </div>
    </div>
  )
}

export function Fieldset({ legend, children, dataIndex }) {
  return (
    <fieldset className="admin__fieldset" data-index={dataIndex}>
      {legend ? <legend className="admin__legend"><span>{legend}</span></legend> : null}
      {children}
    </fieldset>
  )
}

/**
 * Magento's Yes/No pill switch (`Enable Product`, `Active`, `Include in Menu`).
 *
 * The markup is the source's `ui/form/element/switcher` template verbatim
 * (BUG-107 / BUG-108): the checkbox carries a real `value`, and the Yes/No text
 * is a `data-text-on` / `data-text-off` pseudo-element inside the label rather
 * than a literal text node — so `product[status]` reads `1`/`2` the way an
 * evaluator expects, and the word "Yes" does not leak into the page's
 * `innerText`.
 *
 * `onValue`/`offValue` are the two states of the `value` attribute. Magento
 * uses `1`/`2` for `product[status]` (2 = Disabled) and `1`/`0` everywhere
 * else, so the caller supplies them.
 */
export function Toggle({
  id, name, checked, onChange, yesLabel = 'Yes', noLabel = 'No',
  onValue = '1', offValue = '0',
}) {
  /* The source's switcher never carries a `checked` *attribute* — knockout only
     ever sets the property — so a disabled product reads `checked=false` in the
     DOM an agent inspects. React writes the attribute once on mount; drop it so
     the markup does not contradict the live property. */
  const ref = useRef(null)
  useEffect(() => { ref.current?.removeAttribute('checked') }, [])
  return (
    <div className="admin__actions-switch" data-role="switcher">
      <input
        ref={ref}
        type="checkbox"
        className="admin__actions-switch-checkbox"
        id={id}
        name={name}
        value={checked ? onValue : offValue}
        checked={!!checked}
        onChange={e => onChange(e.target.checked)}
      />
      <label className="admin__actions-switch-label" htmlFor={id}>
        <span className="admin__actions-switch-text" data-text-on={yesLabel} data-text-off={noLabel} />
      </label>
    </div>
  )
}

/** A collapsible product/customer form section. */
export function CollapsibleSection({ title, dataIndex, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className={`admin__collapsible-block${open ? ' _show' : ''}`} data-index={dataIndex}>
      <button
        type="button"
        className="admin__collapsible-title"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
      >
        <span>{title}</span>
        <span className="admin__collapsible-title__caret" aria-hidden="true">▾</span>
      </button>
      {open ? <div className="admin__collapsible-content">{children}</div> : null}
    </div>
  )
}

/** A white card with a heading — the "Personal Information" / "Account Information" panels. */
export function FormSection({ title, children, className = '' }) {
  return (
    <div className={`admin__form-section ${className}`.trim()}>
      {title ? <div className="admin__form-section-title">{title}</div> : null}
      {children}
    </div>
  )
}

/**
 * The left `.admin__page-nav` rail (Customer Information tabs, attribute-set
 * groups). `items` is `[{ id, label, badge }]`.
 */
export function PageNav({ title, items, activeId, onSelect }) {
  return (
    <div className="admin__page-nav">
      {title ? <div className="admin__page-nav-title"><strong>{title}</strong></div> : null}
      <ul className="admin__page-nav-items">
        {items.map(item => (
          <li key={item.id} className={`admin__page-nav-item${item.id === activeId ? ' _active' : ''}`}>
            <button
              type="button"
              className="admin__page-nav-link"
              onClick={() => onSelect(item.id)}
              aria-current={item.id === activeId ? 'page' : undefined}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The grey placeholder box Magento renders when a product has no local image. */
export function ThumbnailPlaceholder({ alt = '' }) {
  return (
    <span className="admin__thumbnail-placeholder" role="img" aria-label={alt || 'No image'}>
      <svg viewBox="0 0 50 50" aria-hidden="true">
        <path
          fill="currentColor"
          d="M25 8 8 17.5v15L25 42l17-9.5v-15L25 8zm0 4.6 12 6.7-12 6.7-12-6.7 12-6.7zM11.5 22.2l11.8 6.6v10.4l-11.8-6.6V22.2zm15.2 17v-10.4l11.8-6.6v10.4l-11.8 6.6z"
        />
      </svg>
    </span>
  )
}

/**
 * Magento's split "Add Product / Select" button. `options` is
 * `[{label, onSelect}]`.
 *
 * F-07 — the source gives both halves a `data-ui-id`
 * (`products-list-add-new-product-button` / `…-dropdown`,
 * `save-button` / `save-button-dropdown`) and the toggle's visible text is
 * `Select`, not a glyph. Callers pass `dataUiId` / `toggleDataUiId`; the toggle
 * keeps no `id` because the source's has none.
 */
export function SplitButton({ label, onClick, options = [], id, dataUiId, toggleDataUiId, toggleLabel = 'Select' }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="admin__split-button">
      <button type="button" id={id} data-ui-id={dataUiId} title={label}
        className="action-primary" onClick={onClick}>{label}</button>
      {options.length ? (
        <>
          <button
            type="button"
            data-ui-id={toggleDataUiId}
            className="admin__split-button-toggle"
            aria-expanded={open}
            aria-label={`${label} options`}
            onClick={() => setOpen(o => !o)}
          >
            <span className="admin__split-button-toggle-text">{toggleLabel}</span>
          </button>
          {open ? (
            <div className="admin__split-button-menu">
              {options.map(o => (
                <button key={o.label} type="button" onClick={() => { setOpen(false); o.onSelect() }}>
                  {o.label}
                </button>
              ))}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
