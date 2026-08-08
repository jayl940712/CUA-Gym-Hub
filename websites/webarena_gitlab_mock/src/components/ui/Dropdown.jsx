import React, { useState, useRef, useEffect, useCallback } from 'react'

// The one real GitLab dropdown primitive.
//
// Every `.dropdown` in this app is styled by `src/styles/global.css` §Dropdowns,
// where `.dropdown-menu { display: none }` and only `.dropdown-menu.show` /
// `.dropdown.show > .dropdown-menu` reveal the menu. A dropdown built without
// open state is therefore permanently invisible — AUDIT.part-handlers.md
// HANDLER-001 found fifteen of those. Route every dropdown through this
// component so a new page cannot reintroduce the bug.
//
// The markup is fully caller-controlled so each call site can keep the source's
// verbatim classes and `data-*` attributes (see assets/html/). This component
// only adds the open state, the ` show` classes, dismissal, and the aria
// attributes BootstrapVue emits on the real site:
//   toggle: aria-haspopup="true" aria-expanded="true|false"
//   menu:   role/aria-labelledby left to the caller when the source sets them

/** Close `onClose` when a mousedown or focus lands outside `ref`. */
export function useOutsideClose(ref, onClose, active = true) {
  useEffect(() => {
    if (!active) return undefined
    function handler(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    document.addEventListener('mousedown', handler)
    document.addEventListener('focusin', handler)
    return () => {
      document.removeEventListener('mousedown', handler)
      document.removeEventListener('focusin', handler)
    }
  }, [ref, onClose, active])
}

export default function Dropdown({
  as: Tag = 'div',
  // Wrapper classes, verbatim from the source (usually includes `dropdown`).
  className = 'dropdown',
  // Toggle button. `toggle` is the button's inner content, or a
  // `(open) => node` render function when the label depends on open state.
  toggle,
  toggleAs: ToggleTag = 'button',
  toggleClassName = 'btn gl-button btn-default gl-dropdown-toggle',
  toggleProps = {},
  // Menu element. Callers pass the source's classes, e.g.
  // `dropdown-menu dropdown-menu-right`.
  menuAs: MenuTag = 'div',
  menuClassName = 'dropdown-menu',
  menuProps = {},
  // Menus that are pure navigation/selection close on any click inside them.
  // Set false for menus holding inputs the user must interact with (clone URLs).
  closeOnSelect = true,
  // `children` may be a node or a `({ open, close }) => node` render function.
  children,
  ...rest
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const close = useCallback(() => setOpen(false), [])
  useOutsideClose(ref, close, open)

  // Escape dismisses and returns focus to the toggle, per the source's
  // keyboard behaviour.
  function onKeyDown(e) {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
      const btn = ref.current && ref.current.querySelector('[aria-haspopup]')
      if (btn) btn.focus()
    }
  }

  const isToggleButton = ToggleTag === 'button'

  return (
    <Tag {...rest} ref={ref} className={`${className}${open ? ' show' : ''}`} onKeyDown={onKeyDown}>
      <ToggleTag
        {...(isToggleButton ? { type: 'button' } : { href: '#' })}
        aria-haspopup="true"
        aria-expanded={open ? 'true' : 'false'}
        {...toggleProps}
        className={toggleClassName}
        onClick={e => {
          if (!isToggleButton) e.preventDefault()
          if (toggleProps.onClick) toggleProps.onClick(e)
          setOpen(o => !o)
        }}
      >
        {typeof toggle === 'function' ? toggle(open) : toggle}
      </ToggleTag>
      <MenuTag
        {...menuProps}
        className={`${menuClassName}${open ? ' show' : ''}`}
        onClick={e => {
          if (menuProps.onClick) menuProps.onClick(e)
          if (closeOnSelect) setOpen(false)
        }}
      >
        {typeof children === 'function' ? children({ open, close }) : children}
      </MenuTag>
    </Tag>
  )
}
