import React, { useEffect, useRef, useState } from 'react'
import './dateInput.css'

/* ===========================================================================
 * DIFF-R52 — the report filter forms' date fields.
 *
 * The source pairs every `input.input-date` with a jQuery-UI datepicker:
 *
 *   <input name="from" id="sales_report_from" title="From" type="text"
 *          class="admin__control-text required-entry _required input-text
 *                 input-date _has-datepicker">
 *   <button type="button" class="ui-datepicker-trigger">
 *
 * The mock had the input but not the trigger, so an agent reaching for the
 * calendar icon — the affordance `_has-datepicker` advertises — found nothing
 * to click. This renders the real thing: the trigger opens a month grid and
 * picking a day writes the source's own `MM/d/yyyy` (observed live as
 * `08/1/2026`). Typed values are never normalised — both sides preserve them
 * verbatim and the evaluators depend on that.
 * ======================================================================== */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']
const DAY_NAMES = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa']

/** The source's picker writes zero-padded month, bare day, 4-digit year. */
function formatPicked(year, month, day) {
  return `${String(month + 1).padStart(2, '0')}/${day}/${year}`
}

/** Best-effort read of whatever is typed, so the calendar opens on that month. */
function parseTyped(value) {
  const m = String(value || '').trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/)
  if (!m) return null
  let year = +m[3]
  if (year < 100) year += 2000
  return { year, month: +m[1] - 1, day: +m[2] }
}

export default function DateInput({ value, onChange, className = '', ...rest }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef(null)
  const typed = parseTyped(value)
  const today = new Date()
  const [view, setView] = useState(() => ({
    year: typed?.year ?? today.getFullYear(),
    month: typed?.month ?? today.getMonth(),
  }))

  useEffect(() => {
    if (!open) return undefined
    const onDown = e => { if (wrap.current && !wrap.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  function openPicker() {
    const t = parseTyped(value)
    if (t) setView({ year: t.year, month: t.month })
    setOpen(o => !o)
  }

  function pick(day) {
    onChange(formatPicked(view.year, view.month, day))
    setOpen(false)
  }

  const first = new Date(Date.UTC(view.year, view.month, 1)).getUTCDay()
  const days = new Date(Date.UTC(view.year, view.month + 1, 0)).getUTCDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]

  return (
    <span className="date-input-wrap" ref={wrap}>
      <input type="text" {...rest}
        className={`${className} _has-datepicker`.trim()}
        value={value || ''} onChange={e => onChange(e.target.value)} />
      <button type="button" className="ui-datepicker-trigger" title="Select Date"
        onClick={openPicker}><span>Select Date</span></button>
      {open ? (
        <div className="ui-datepicker ui-datepicker-inline" role="dialog">
          <div className="ui-datepicker-header">
            <button type="button" className="ui-datepicker-prev" title="Prev"
              onClick={() => setView(v => (v.month === 0
                ? { year: v.year - 1, month: 11 } : { ...v, month: v.month - 1 }))}>
              <span>Prev</span>
            </button>
            <div className="ui-datepicker-title">
              <span className="ui-datepicker-month">{MONTH_NAMES[view.month]}</span>{' '}
              <span className="ui-datepicker-year">{view.year}</span>
            </div>
            <button type="button" className="ui-datepicker-next" title="Next"
              onClick={() => setView(v => (v.month === 11
                ? { year: v.year + 1, month: 0 } : { ...v, month: v.month + 1 }))}>
              <span>Next</span>
            </button>
          </div>
          <table className="ui-datepicker-calendar">
            <thead>
              <tr>{DAY_NAMES.map(d => <th key={d}><span>{d}</span></th>)}</tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.ceil(cells.length / 7) }, (_, w) => (
                <tr key={w}>
                  {cells.slice(w * 7, w * 7 + 7).concat(Array(7).fill(null)).slice(0, 7).map((d, i) => (
                    <td key={i}>
                      {d ? (
                        <a href="#" className="ui-state-default"
                          onClick={e => { e.preventDefault(); pick(d) }}>{d}</a>
                      ) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </span>
  )
}
