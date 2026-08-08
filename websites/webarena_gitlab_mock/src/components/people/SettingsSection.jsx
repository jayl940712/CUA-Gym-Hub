import React from 'react'

// assets/README.md §22a — every user-settings page is a stack of
// `div.row.js-search-settings-section` blocks: a left `col-lg-4` with an h4 +
// muted blurb, and a right `col-lg-8` holding the fields. The `Search page`
// box sits above them all.

export function SettingsSearch() {
  return (
    <div className="gl-mt-3 gl-mb-5">
      <input type="search" className="gl-form-input form-control"
        placeholder="Search page" aria-label="Search page" />
    </div>
  )
}

export default function SettingsSection({ title, blurb, id, children }) {
  return (
    <div className="row js-search-settings-section gl-mt-5" id={id}>
      <div className="col-lg-4 profile-settings-sidebar">
        <h4 className="gl-mt-0">{title}</h4>
        {blurb ? <p className="gl-text-secondary">{blurb}</p> : null}
      </div>
      <div className="col-lg-8">{children}</div>
    </div>
  )
}

/** A labelled text field in the `Main settings` shape. */
export function Field({ id, name, label, value, onChange, placeholder, helper, readOnly, type = 'text' }) {
  return (
    <div className="form-group gl-form-group">
      <label htmlFor={id}>{label}</label>
      <input id={id} name={name} type={type} readOnly={readOnly}
        className="gl-form-input form-control gl-md-form-input-lg"
        placeholder={placeholder} value={value == null ? '' : value}
        onChange={onChange ? e => onChange(e.target.value) : undefined} />
      {helper ? <small className="form-text text-gl-muted">{helper}</small> : null}
    </div>
  )
}
