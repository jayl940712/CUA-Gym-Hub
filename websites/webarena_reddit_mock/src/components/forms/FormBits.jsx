import React, { useEffect, useRef } from 'react'
import './forms.css'

/**
 * Symfony form-theme primitives, transcribed from the rendered source HTML in
 * `assets/html/submit-auth.html` and `assets/html/create_forum-auth.html`
 * (templates/_forms/standard_form_theme.html.twig).
 *
 * The DOM shape matters: `#forum_description` and `#forum_sidebar` are WebArena
 * evaluator locators, and every other id follows Symfony's
 * `<form-name>_<field-name>` convention, which is what an agent's accessibility
 * tree keys off.
 */

/** `{{ form_errors(form) }}` — `<ul class="form-error-list"><li>…</li></ul>`. */
export function FormErrors({ errors }) {
  if (!errors || errors.length === 0) return null
  return (
    <ul className="form-error-list">
      {errors.map((e, i) => <li key={i}>{e}</li>)}
    </ul>
  )
}

/**
 * Symfony's own constraint messages, verbatim from the container
 * (`vendor/symfony/validator/Resources/translations/validators.en.xlf` →
 * `NotBlank` / `Url`). Reused by the native-validation bridge below so the
 * client-side rejection reads exactly like the server round-trip's.
 */
export const ERR_BLANK = 'This value should not be blank.'
export const ERR_BAD_URL = 'This value is not a valid URL.'

/**
 * Bridges the browser's constraint validation into the same `.form-error-list`
 * the server renders.
 *
 * The source forms carry NO `novalidate` (verified on the container:
 * `<form name="forum" method="post" class="form flow">` and
 * `<form name="submission" method="post" … class="form flow" …>` both report
 * `form.noValidate === false`), so a required-field miss is blocked by the
 * browser and never reaches the server. An earlier round added `noValidate` to
 * expose Postmill's server-side error list instead — that suppressed the native
 * bubble, and any case the JS validator did not reach became a silent no-op.
 *
 * This hook keeps BOTH signals: the form stays validating (native bubble, as on
 * the source) and every control the browser rejects also gets its Symfony
 * message rendered under `ul.form-error-list`, so the failure is visible in the
 * DOM and not only in a transient bubble.
 *
 * `invalid` does not bubble, so the listener is registered in the CAPTURE phase
 * on the form — capture still runs on the way down to the target.
 *
 * @param {(errors: Record<string, string[]>) => void} setErrors
 * @returns {React.RefObject<HTMLFormElement>} ref to put on the `<form>`
 */
export function useNativeValidation(setErrors) {
  const formRef = useRef(null)
  const batch = useRef(null)

  useEffect(() => {
    const form = formRef.current
    if (!form) return undefined
    let timer = 0

    const onInvalid = (e) => {
      const el = e.target
      if (!el || !el.id) return
      // `forum_description` → `description`, `submission_forum` → `forum`,
      // `message_body` → `body` — the Symfony `<form>_<field>` id convention.
      // Strip the form's OWN name, not everything up to the first `_`: Symfony
      // form names can contain underscores themselves (`confirm_deletion_name`
      // is form `confirm_deletion`, field `name`), and the naive regex would
      // key that as `deletion_name` and never match the error slot.
      // `getAttribute`, not `form.name`: HTMLFormElement's named getter has
      // LegacyOverrideBuiltIns, so a control named `name` would shadow it.
      const formName = form.getAttribute('name') || ''
      const prefix = formName ? `${formName}_` : ''
      const key = prefix && el.id.startsWith(prefix)
        ? el.id.slice(prefix.length)
        : el.id.replace(/^[^_]+_/, '')
      const v = el.validity || {}
      const message = v.valueMissing ? ERR_BLANK
        : v.typeMismatch ? ERR_BAD_URL
          : (el.validationMessage || ERR_BLANK)

      // Interactive validation fires `invalid` at EVERY invalid control in one
      // task; collect them and publish once, so the list matches a single
      // server round-trip. It must be a timeout, not a microtask: the HTML spec
      // runs a microtask checkpoint after each listener returns, which would
      // flush the batch after the first control only.
      if (!batch.current) {
        batch.current = {}
        timer = setTimeout(() => {
          const collected = batch.current
          batch.current = null
          timer = 0
          if (collected) setErrors(collected)
        }, 0)
      }
      if (!batch.current[key]) batch.current[key] = [message]
    }

    form.addEventListener('invalid', onInvalid, true)
    return () => {
      form.removeEventListener('invalid', onInvalid, true)
      if (timer) clearTimeout(timer)
    }
  }, [setErrors])

  return formRef
}

/** The red `*` after a required field's label. `help.required_field`. */
export function RequiredIndicator() {
  return (
    <b className="fg-red" role="presentation"
       title="This field is required." aria-label="This field is required.">*</b>
  )
}

/**
 * `{{ form_row(field) }}`:
 *
 *   <div class="flow-slim">
 *     <ul class="form-error-list">…</ul>
 *     <div class="form-flex form__row"><label for=…>…</label>…widget…</div>
 *     <div id="<id>_help" class="text-flow-slim">…help…</div>
 *   </div>
 *
 * `form_errors(form)` is emitted BEFORE the `.form__row`, not inside it — see
 * `_forms/standard_form_theme.html.twig`, block `form_row`.
 */
export function FormRow({ id, label, required = false, help = null, hidden = false,
                          stretch = false, labelHidden = false, errors = null, children }) {
  return (
    <div className="flow-slim">
      <FormErrors errors={errors} />
      <div className={`${stretch ? 'form-flex--stretch ' : ' '}form-flex form__row`} hidden={hidden || undefined}>
        <label htmlFor={id} hidden={labelHidden || undefined}>
          {label}{required && <> <RequiredIndicator /></>}
        </label>
        {children}
      </div>
      {help && (
        <div id={`${id}_help`} className="text-flow-slim">
          <p className="text-sm fg-muted">{help}</p>
        </div>
      )}
    </div>
  )
}

/** `{{ button_row(label) }}` — `_macros/form.html.twig`. */
export function ButtonRow({ label, secondary = false }) {
  return (
    <div className="form__row form__button-row">
      <button className={`button${secondary ? ' button--secondary' : ''}`} type="submit">{label}</button>
    </div>
  )
}

/**
 * A single-line checkbox row (`checkbox_row` in the aligned theme):
 * widget first, then the label.
 */
export function CheckboxRow({ id, name, label, checked, onChange, help = null }) {
  return (
    <div className="flow-slim">
      <div className="form-flex form-flex--single-line form__row">
        <span>
          <input type="checkbox" id={id} name={name} className="form-control"
                 checked={checked} onChange={onChange} />
          {' '}
          <label htmlFor={id}>{label}</label>
        </span>
      </div>
      {help && (
        <div id={`${id}_help`} className="text-flow-slim">
          <p className="text-sm fg-muted">{help}</p>
        </div>
      )}
    </div>
  )
}

/** `<span class="unstylable-widget"><select …><span class="…__caret">` */
export function SelectWidget({ children, ...rest }) {
  return (
    <span className="unstylable-widget">
      <select className="form-control" {...rest}>{children}</select>
      <span className="unstylable-widget__caret" aria-hidden="true" />
    </span>
  )
}
