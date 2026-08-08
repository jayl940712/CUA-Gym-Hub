import React from 'react'
import { useApp } from '../context/AppContext.jsx'
import TimeAgo from '../components/layout/TimeAgo.jsx'
import Icon from '../components/layout/Icon.jsx'
import { UserAvatar } from '../components/layout/Avatar.jsx'
import { useQuery, filterIssuables, sortIssuables } from './hooks.js'
import { LabelChip } from '../components/issuable/Controls.jsx'
import Dropdown from '../components/ui/Dropdown.jsx'
import { dbStamp } from '../components/create/mutations.js'
import { issuableListUrl, issuableListPath, labelFilterUrl } from '../utils/issuableUrl.js'
import { useRawNavigate } from '../utils/RedirectWithQuery.jsx'
import {
  listVariant, tokenTypesFor, parseTokens, searchTerms, valueOptions,
  addTokenUrl, removeTokenUrl, clearAllUrl, OPERATORS, NO_SUGGESTIONS,
  operatorDescription,
} from '../utils/searchTokens.js'

// Shared list body for /-/issues, /-/merge_requests, /dashboard/issues and
// /dashboard/merge_requests. assets/README.md §5a / §13 / §13b / §15a.
//
// Row meta reads `created <relative> by <Name>` — NOT "opened N ago"
// (§13.6: "The word is `created`, NOT `opened`", and §24.4 lists it as a
// commonly-assumed-wrong string).
//
// There is deliberately NO `<h1>Issues</h1>` on the project issue list — §13.1:
// "There is NO <h1>Issues</h1> on this page." The page is identified by the
// breadcrumb and the active sidebar item only.

const PER_PAGE = 20

/** The feed token is an `exact_match` anchor (webarena-259) — §13.3. */
export const FEED_TOKEN = 'TMN_bBn9Z48qVbUFZV45'

/** §13.5 — exactly ten options, verbatim, in this order. */
const ISSUE_SORTS = [
  ['priority_desc', 'Priority'],
  ['created_date', 'Created date'],
  ['updated_desc', 'Updated date'],
  ['closed_at_desc', 'Closed date'],
  ['milestone_due_desc', 'Milestone due date'],
  ['due_date_desc', 'Due date'],
  ['popularity', 'Popularity'],
  ['label_priority_desc', 'Label priority'],
  ['relative_position', 'Manual'],
  ['title_asc', 'Title'],
]

/** §15a — nine options; note the MR-only `Merged date` -> `?sort=merged_at`. */
const MR_SORTS = [
  ['priority', 'Priority'],
  ['created_date', 'Created date'],
  ['closed_at', 'Closed date'],
  ['updated_desc', 'Updated date'],
  ['milestone', 'Milestone due date'],
  ['popularity', 'Popularity'],
  ['label_priority', 'Label priority'],
  ['merged_at', 'Merged date'],
  ['title_asc', 'Title'],
]

/** `created_asc` and `created_date` both display `Created date` (§13.5). */
function sortLabel(sort, sorts) {
  const base = String(sort || 'created_date').replace(/_(asc|desc)$/, '')
  // Both directions render the same title, so fall back to the token's reverse
  // twin (`milestone` -> `milestone_due_desc`) before giving up. §5a.6.
  const twin = SORT_REVERSE[String(sort || '')]
  const found = sorts.find(([v]) => v === sort)
    || sorts.find(([v]) => v.replace(/_(asc|desc)$/, '') === base)
    || (twin ? sorts.find(([v]) => v === twin) : undefined)
  return found ? found[1] : 'Created date'
}

// The sort tokens the `Sort direction` button flips between, verbatim from
// assets/README.md §5a.6 ("Reverse-value aliases"). GitLab's pairs are NOT a
// mechanical `_asc`/`_desc` suffix swap — `closed_at` reverses to
// `closed_at_desc`, `milestone` to `milestone_due_desc` — which is why
// TEST.part-routes-b.md BUG-B02 saw the old suffix arithmetic emit the
// non-existent value `created_date_asc` and reorder nothing.
const SORT_REVERSE = {}
const SORT_ASCENDING = new Set()
;[
  // [ascending token, descending token]
  ['created_asc', 'created_date'],
  ['updated_asc', 'updated_desc'],
  ['closed_at', 'closed_at_desc'],
  ['milestone', 'milestone_due_desc'],
  ['due_date', 'due_date_desc'],
  ['merged_at', 'merged_at_desc'],
  ['popularity_asc', 'popularity'],
  ['title_asc', 'title_desc'],
  ['due_date_asc', 'due_date_desc'],
  ['milestone_due_asc', 'milestone_due_desc'],
  ['closed_at_asc', 'closed_at_desc'],
].forEach(([asc, desc]) => {
  if (!SORT_REVERSE[asc]) SORT_REVERSE[asc] = desc
  if (!SORT_REVERSE[desc]) SORT_REVERSE[desc] = asc
  SORT_ASCENDING.add(asc)
})
// `created_desc` is an accepted alias of `created_date` (§5a.6).
SORT_REVERSE.created_desc = 'created_asc'

/** `priority`, `label_priority` and `relative_position` have no reverse. */
function reverseSort(sort) {
  return SORT_REVERSE[String(sort || 'created_date')] || sort
}

function isAscending(sort) {
  return SORT_ASCENDING.has(String(sort || ''))
}

export function StateTabs({ counts, basePath, current, kind }) {
  const q = useQuery()
  // DIFF-1303 — `/-/issues/?…`, in the anchors' own escaping. See utils/issuableUrl.js.
  const link = s => issuableListUrl(basePath, q.searchParams, { state: s })
  const tabs = kind === 'merge_requests'
    ? [['opened', 'Open', 'Filter by merge requests that are currently open.', 'opened_issuables_tab'],
      ['merged', 'Merged', 'Filter by merge requests that are currently merged.', 'merged_issuables_tab'],
      ['closed', 'Closed', 'Filter by merge requests that are currently closed and unmerged.', 'closed_issuables_tab'],
      ['all', 'All', 'Show all merge requests.', 'all_issuables_tab']]
    : [['opened', 'Open', 'Filter by issues that are currently opened.', 'opened_issuables_tab'],
      ['closed', 'Closed', 'Filter by issues that are currently closed.', 'closed_issuables_tab'],
      ['all', 'All', 'Show all issues.', 'all_issuables_tab']]
  return (
    <ul className="issues-state-filters gl-border-b-0 gl-flex-grow-1 nav gl-tabs-nav">
      {tabs.map(([value, label, title, qa]) => (
        <li className="nav-item" key={value}>
          <a id={`state-${value}`} data-state={value}
            className={`nav-link gl-tab-nav-item${current === value ? ' active gl-tab-nav-item-active' : ''}`}
            aria-selected={current === value} title={title} href={link(value)}>
            <span title={title} data-qa-selector={qa}>{label}</span>
            <span className="gl-badge badge badge-pill badge-muted sm gl-tab-counter-badge">{counts[value] || 0}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/**
 * `.nav-controls` — the right half of `.top-area` (§13.3 for issues, §15a for
 * merge requests). The RSS/ICS hrefs echo the current filter and carry the
 * feed token, which is itself an anchor string.
 */
export function NavControls({ basePath, kind, onToggleBulk }) {
  const q = useQuery()
  const [importOpen, setImportOpen] = React.useState(false)
  const [exportOpen, setExportOpen] = React.useState(false)
  const feedQuery = new URLSearchParams(q.searchParams)
  feedQuery.delete('sid')
  feedQuery.set('feed_token', FEED_TOKEN)
  const atom = `${basePath}.atom?${feedQuery.toString()}`
  const isIssues = kind === 'issues'
  return (
    <div className="nav-controls">
      <a className="btn btn-default btn-md gl-button btn-icon has-tooltip" data-testid="rss-feed-link"
        title="Subscribe to RSS feed" aria-label="Subscribe to RSS feed" href={atom}>
        <Icon name="rocket" />
      </a>
      {isIssues ? (
        <a className="btn btn-default btn-md gl-button btn-icon" title="Subscribe to calendar"
          aria-label="Subscribe to calendar"
          href={`${basePath}.ics?due_date=next_month_and_previous_two_weeks&feed_token=${FEED_TOKEN}&sort=closest_future_date`}>
          <Icon name="clock" />
        </a>
      ) : null}
      <button type="button" aria-label="Export as CSV" data-qa-selector="export_as_csv_button"
        className="btn btn-default btn-md gl-button btn-icon"
        onClick={() => setExportOpen(true)}><Icon name="doc-text" /></button>
      {isIssues ? (
        <Dropdown className="dropdown gl-dropdown" data-qa-selector="import_issues_dropdown"
          toggleClassName="btn btn-default btn-md gl-button gl-dropdown-toggle"
          toggle={<>
            <span className="gl-dropdown-button-text gl-sr-only">Import issues</span>
            <Icon name="chevron-down" />
          </>}
          menuClassName="dropdown-menu dropdown-menu-right">
          <ul>
            <li><button type="button" className="dropdown-item" onClick={() => setImportOpen(true)}>
              <p className="gl-dropdown-item-text-primary">Import CSV</p></button></li>
            <li><a className="dropdown-item" data-qa-selector="import_from_jira_link"
              href={`${basePath.replace(/\/-\/issues$/, '')}/-/import/jira`}>
              <p className="gl-dropdown-item-text-primary">Import from Jira</p></a></li>
          </ul>
        </Dropdown>
      ) : null}
      <button type="button" className="btn btn-default btn-md gl-button js-bulk-update-toggle"
        onClick={onToggleBulk}>
        <span className="gl-button-text">{isIssues ? 'Edit issues' : 'Edit merge requests'}</span>
      </button>
      <a className="btn btn-confirm btn-md gl-button"
        data-qa-selector={isIssues ? 'new_issue_link' : 'new_merge_request_link'}
        href={`${basePath}/new`}>
        <span className="gl-button-text">{isIssues ? 'New issue' : 'New merge request'}</span>
      </a>
      {importOpen ? <ImportCsvModal onClose={() => setImportOpen(false)} /> : null}
      {exportOpen ? <ExportCsvModal kind={kind} onClose={() => setExportOpen(false)} /> : null}
    </div>
  )
}

/** The source's `Export issues` / `Export merge requests` confirmation modal. */
function ExportCsvModal({ kind, onClose }) {
  const { currentUser } = useApp()
  const noun = kind === 'issues' ? 'issues' : 'merge requests'
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label={`Export ${noun}`}>
        <div className="modal-dialog"><div className="modal-content">
          <div className="modal-header">
            <h4 className="modal-title">{`Export ${noun}`}</h4>
            <button type="button" className="btn gl-button btn-default-tertiary btn-icon"
              aria-label="Close" onClick={onClose}><Icon name="close" /></button>
          </div>
          <div className="modal-body">
            <p>
              {`The CSV export will be created in the background. Once finished, it will be sent to `}
              <strong>{currentUser.email || currentUser.username}</strong>
              {' in an attachment.'}
            </p>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn gl-button btn-default" onClick={onClose}>
              <span className="gl-button-text">Cancel</span></button>
            <button type="button" className="btn gl-button btn-confirm" onClick={onClose}>
              <span className="gl-button-text">{`Export ${noun}`}</span></button>
          </div>
        </div></div>
      </div>
    </>
  )
}

/**
 * The source's `Import issues` modal (the `Import CSV` dropdown entry). It
 * accepts a CSV and reports back with the flash below — issue creation happens
 * asynchronously on the real site, so nothing is added to state here either.
 */
function ImportCsvModal({ onClose }) {
  const [done, setDone] = React.useState(false)
  const [fileName, setFileName] = React.useState('')
  return (
    <>
      <div className="modal-backdrop" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" aria-label="Import issues">
        <div className="modal-dialog">
          <div className="modal-content">
            <div className="modal-header">
              <h4 className="modal-title">Import issues</h4>
              <button type="button" className="btn gl-button btn-default-tertiary btn-icon"
                aria-label="Close" onClick={onClose}><Icon name="close" /></button>
            </div>
            <div className="modal-body">
              {done ? (
                <div className="gl-alert gl-alert-info">
                  <div className="gl-alert-content">
                    Your issues are being imported. Once finished, you&apos;ll get a confirmation email.
                  </div>
                </div>
              ) : (
                <>
                  <p>
                    Your issues will be imported in the background. Once finished, you&apos;ll get a
                    confirmation email.
                  </p>
                  <label htmlFor="file">Upload CSV file</label>
                  <input id="file" type="file" name="file" accept=".csv,text/csv"
                    onChange={e => setFileName(e.target.files && e.target.files[0] ? e.target.files[0].name : '')} />
                  <p className="gl-form-text">
                    It must have a header row and at least two columns: the first column is the issue
                    title and the second column is the issue description. The separator is automatically
                    detected.
                  </p>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button type="button" className="btn gl-button btn-default" onClick={onClose}>
                <span className="gl-button-text">{done ? 'Close' : 'Cancel'}</span>
              </button>
              {done ? null : (
                <button type="button" className="btn gl-button btn-confirm" disabled={!fileName}
                  onClick={() => setDone(true)}>
                  <span className="gl-button-text">Import issues</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * One applied filter token. `token` comes from `parseTokens()`, which already
 * resolved the visible text (sigils, `Yes`/`No`, `Titles`, and the display-name
 * vs username split between the two source implementations) and the label
 * colour. The close button is the source's own — see DEV.r16-tokenbar.md §1.8.
 */
function TokenChip({ token, onRemove }) {
  return (
    <div data-testid="filtered-search-token"
      className="gl-filtered-search-token gl-filtered-search-item">
      <div data-testid="filtered-search-token-segment" className="gl-filtered-search-token-segment">
        <span className="gl-filtered-search-token-type gl-token gl-token-default-variant gl-token-view-only">
          <span className="gl-token-content">{token.type.label}</span></span></div>
      <div data-testid="filtered-search-token-segment" className="gl-filtered-search-token-segment">
        <span className="gl-filtered-search-token-operator gl-token gl-token-search-value-variant gl-token-view-only">
          <span className="gl-token-content">{token.op}</span></span></div>
      <div data-testid="filtered-search-token-segment" className="gl-filtered-search-token-segment">
        <span className="gl-token gl-token-search-value-variant gl-filtered-search-token-data" style={token.style}>
          <span className="gl-token-content">
            <span className="gl-filtered-search-token-data-content">{token.text}</span>
            <button aria-label="Close" type="button"
              className="btn gl-token-close gl-close-btn-color-inherit btn-default btn-sm gl-button btn-default-tertiary btn-icon"
              onClick={e => { e.preventDefault(); e.stopPropagation(); onRemove(token) }}>
              <Icon name="close" className="gl-button-icon" />
            </button>
          </span></span></div>
    </div>
  )
}

/**
 * One row of the suggestion list — `li.gl-dropdown-item.gl-filtered-search-suggestion`,
 * verbatim from the source (DEV.r16-tokenbar.md §1.8). A label value carries the
 * source's colour swatch; a user value carries its `@handle` underneath.
 */
function Suggestion({ icon, primary, secondary, swatch, onPick }) {
  return (
    <li role="presentation" className="gl-dropdown-item gl-filtered-search-suggestion">
      <a data-testid="filtered-search-suggestion" role="menuitem" href="#" target="_self"
        className="dropdown-item"
        onClick={e => { e.preventDefault(); e.stopPropagation(); onPick() }}>
        {icon ? <Icon name={icon} className="gl-dropdown-item-icon gl-text-gray-700" /> : null}
        <div className="gl-dropdown-item-text-wrapper">
          <p className="gl-dropdown-item-text-primary">
            {swatch ? (
              <span className="gl-display-flex gl-align-items-center">
                <span className="gl-display-inline-block gl-mr-3 gl-p-3"
                  style={{ backgroundColor: swatch }} />
                <span>{primary}</span>
              </span>
            ) : primary}
          </p>
          {secondary ? <p className="gl-dropdown-item-text-secondary">{secondary}</p> : null}
        </div>
      </a>
    </li>
  )
}

/**
 * The filtered-search bar — TEST.md DIFF-1501.
 *
 * Clicking the input opens the token-type list this page's source offers
 * (`utils/searchTokens.js` records which list came from which page); picking a
 * type offers `=` / `!=` where the source does; picking a value navigates to
 * the URL the source emits and the list filters. Tokens carry a close button,
 * and arriving at a filtered URL renders them again — the round trip works in
 * both directions because `parseTokens()` reads the URL and
 * `addTokenUrl()`/`removeTokenUrl()` write it, both through
 * `issuableListUrl()`.
 *
 * Deliberate divergence, recorded rather than hidden: the source completes a
 * token on the value click and applies the filter on the following `Enter`.
 * The mock applies it on the value click. The URL is identical either way, and
 * an extra keystroke between a click and any visible response is the exact
 * silent-failure shape this finding was filed for.
 */
export function FilteredSearchBar({ action, kind, project }) {
  const q = useQuery()
  const { state, indexes } = useApp()
  const go = useRawNavigate()
  const sorts = kind === 'merge_requests' ? MR_SORTS : ISSUE_SORTS
  const sort = q.get('sort', 'created_date')
  const asc = isAscending(sort)

  const variant = listVariant(kind, action)
  const ctx = { project: project || null, state, indexes }
  const tokens = parseTokens(q.searchParams, variant, ctx)
  const terms = searchTerms(q.searchParams)

  // `null` -> the type list is next; `{ type }` -> the operator list;
  // `{ type, op }` -> the value list.
  const [pending, setPending] = React.useState(null)
  const [open, setOpen] = React.useState(false)
  const [text, setText] = React.useState('')
  const boxRef = React.useRef(null)
  const inputRef = React.useRef(null)
  const dismiss = React.useCallback(() => { setOpen(false); setPending(null) }, [])
  // Not `useOutsideClose`: React flushes a discrete event's state update before
  // the event finishes bubbling to `document`, so by the time a document-level
  // `mousedown` listener runs, the suggestion row that was just clicked has
  // already been re-rendered away. `contains()` then reports it as OUTSIDE the
  // bar and closes the dropdown on every pick. A detached node was never
  // outside anything, so it is ignored here.
  React.useEffect(() => {
    if (!open) return undefined
    function handler(e) {
      const target = e.target
      if (!target || (target.isConnected === false)) return
      if (boxRef.current && !boxRef.current.contains(target)) dismiss()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, dismiss])

  // DIFF-1303 — all three emit `/-/issues/?search=…&sort=…&state=…&<filters>&first_page_size=20`,
  // the form webarena-45, -46 and -342 anchor on. See utils/issuableUrl.js.
  const sortHref = v => issuableListUrl(action, q.searchParams, { sort: v })
  const directionHref = () => issuableListUrl(action, q.searchParams, { sort: reverseSort(sort) })

  const types = tokenTypesFor(variant)
  const needle = text.trim().toLowerCase()
  const match = s => !needle || String(s).toLowerCase().includes(needle)

  function pickType(type) {
    setText('')
    // `Confidential`, `Draft` and `Search Within` have a single operator and no
    // operator step at all on the source.
    setPending(type.operators.length > 1 ? { type } : { type, op: '=' })
    if (inputRef.current) inputRef.current.focus()
  }

  function applyValue(value) {
    if (!pending || !pending.op || !value) return
    setPending(null); setText(''); setOpen(false)
    go(addTokenUrl(action, q.searchParams, pending.type, pending.op, value))
  }

  function removeToken(token) {
    setPending(null); setOpen(false)
    go(removeTokenUrl(action, q.searchParams, token))
  }

  // A submit sets `search` and keeps every other active filter, the way the
  // source's token bar does — webarena-342 needs `search`, `sort`, `state`,
  // `label_name[]` and `first_page_size` in the URL at once. Terms already in
  // the URL render as their own chips (as on the source), so typed text is
  // appended to them rather than replacing them.
  function handleSubmit(e) {
    e.preventDefault()
    // A pending token with typed text completes on Enter — that is how the
    // source takes a free-text value for `Environment` / `Deployed-before`.
    if (pending && pending.op && text.trim()) { applyValue(text.trim()); return }
    const search = [...terms, ...text.trim().split(/\s+/).filter(Boolean)].join(' ')
    setText(''); setPending(null); setOpen(false)
    go(issuableListUrl(action, q.searchParams, { search, page: null }))
  }

  let suggestions = null
  if (!pending) {
    const rows = types.filter(t => match(t.label) && (t.multi || !tokens.some(k => k.type.key === t.key)))
    suggestions = rows.map(t => (
      <Suggestion key={t.key} icon={t.icon} primary={t.label} onPick={() => pickType(t)} />
    ))
  } else if (!pending.op) {
    suggestions = OPERATORS.filter(o => pending.type.operators.includes(o.value)).map(o => (
      <li key={o.value} role="presentation" className="gl-dropdown-item gl-filtered-search-suggestion">
        <a data-testid="filtered-search-suggestion" role="menuitem" href="#" target="_self"
          className="dropdown-item"
          onClick={e => {
            e.preventDefault(); e.stopPropagation()
            setPending({ ...pending, op: o.value })
            if (inputRef.current) inputRef.current.focus()
          }}>
          <div className="gl-dropdown-item-text-wrapper">
            <p className="gl-dropdown-item-text-primary">
              <span className="gl-display-flex">{o.value}
                <span className="gl-filtered-search-token-operator-description">
                  {operatorDescription(pending.type, o.value)}</span>
              </span>
            </p>
          </div>
        </a>
      </li>
    ))
  } else {
    const options = valueOptions(pending.type, pending.op, ctx)
    const rows = options.filter(o => o.divider || match(o.text) || match(o.secondary || ''))
    const real = rows.filter(o => !o.divider)
    suggestions = rows.map((o, i) => (o.divider
      ? (
        <li key={`divider-${i}`} role="presentation" className="gl-dropdown-divider">
          <hr role="separator" aria-orientation="horizontal" className="dropdown-divider" />
        </li>
      )
      : (
        <Suggestion key={`${o.value}-${i}`} primary={o.text} secondary={o.secondary}
          swatch={o.label ? o.label.color : undefined}
          onPick={() => applyValue(o.value)} />
      )))
    if (!real.length) {
      suggestions = [...suggestions,
        <li key="empty" role="presentation" className="gl-dropdown-text">
          <p className="b-dropdown-text">{NO_SUGGESTIONS}</p>
        </li>]
    }
  }

  const clearable = tokens.length > 0 || terms.length > 0

  return (
    <div className="vue-filtered-search-bar-container issues-filters row-content-block gl-my-3"
      data-qa-selector="issuable_search_container">
      <form className="filter-form filtered-search-wrapper gl-display-flex w-100"
        method="get" action={issuableListPath(action)} onSubmit={handleSubmit}
        style={{ gap: 8 }}>
        <input type="hidden" name="state" value={q.get('state', 'opened')} />
        {/* Keep the active sort across a search, as the source's Vue filtered
            search does; a bare GET submit would otherwise reset it. */}
        <input type="hidden" name="sort" value={sort} />
        <div role="group" ref={boxRef}
          className="input-group gl-search-box-by-click gl-filtered-search flex-grow-1"
          data-testid="filtered-search-input" style={{ flex: 1 }}>
          <div className="gl-filtered-search-scrollable gl-display-flex gl-align-items-center"
            style={{ gap: 4, flexWrap: 'wrap', flex: 1 }}
            onClick={() => { setOpen(true); if (inputRef.current) inputRef.current.focus() }}>
            {tokens.map(t => (
              <TokenChip key={`${t.param}-${t.index}-${t.value}`} token={t} onRemove={removeToken} />
            ))}
            {terms.map((term, i) => (
              <div key={`term-${i}`} data-testid="filtered-search-term"
                className="gl-h-auto gl-filtered-search-term gl-filtered-search-item">
                <div data-testid="filtered-search-token-segment"
                  className="gl-filtered-search-token-segment gl-filtered-search-term-token">{term}</div>
              </div>
            ))}
            {/* A pending token renders as it is being built, exactly as the
                source's does: type, then type + operator. */}
            {pending ? (
              <div data-testid="filtered-search-token"
                className="gl-filtered-search-token gl-filtered-search-item">
                <div data-testid="filtered-search-token-segment" className="gl-filtered-search-token-segment">
                  <span className="gl-filtered-search-token-type gl-token gl-token-default-variant">
                    <span className="gl-token-content">{pending.type.label}</span></span></div>
                {pending.op ? (
                  <div data-testid="filtered-search-token-segment" className="gl-filtered-search-token-segment">
                    <span className="gl-filtered-search-token-operator gl-token gl-token-search-value-variant">
                      <span className="gl-token-content">{pending.op}</span></span></div>
                ) : null}
              </div>
            ) : null}
            <div data-testid="filtered-search-term"
              className="gl-h-auto gl-filtered-search-term gl-filtered-search-item gl-filtered-search-last-item"
              style={{ flex: 1, minWidth: 160 }}>
              <input type="text" name="search" data-testid="filtered-search-term-input" ref={inputRef}
                className="gl-filtered-search-term-input form-control gl-form-input"
                placeholder="Search or filter results..." aria-label="Search or filter results..."
                autoComplete="off" role="combobox" aria-expanded={open ? 'true' : 'false'}
                value={text}
                onChange={e => { setText(e.target.value); setOpen(true) }}
                onFocus={() => setOpen(true)}
                onClick={() => setOpen(true)}
                onKeyDown={e => {
                  if (e.key === 'Escape' && open) { e.stopPropagation(); dismiss() }
                  if (e.key === 'Backspace' && !text && pending) {
                    setPending(pending.op && pending.type.operators.length > 1
                      ? { type: pending.type } : null)
                  }
                }}
                style={{ border: 0, width: '100%' }} />
            </div>
          </div>
          {clearable ? (
            <button type="button" aria-label="Clear" data-testid="clear-icon"
              className="btn gl-button btn-default btn-icon gl-search-box-by-click-clear-button"
              onClick={() => { dismiss(); setText(''); go(clearAllUrl(action, q.searchParams, variant)) }}>
              <Icon name="close" />
            </button>
          ) : null}
          <button type="submit" aria-label="Search" data-testid="search-button"
            className="btn gl-button btn-default gl-search-box-by-click-search-button">
            <Icon name="search" />
          </button>
          <ul role="menu"
            className={`dropdown-menu gl-filtered-search-suggestion-list${open ? ' show' : ''}`}>
            {suggestions}
          </ul>
        </div>

        <div role="group" className="sort-dropdown-container filter-dropdown-container d-flex btn-group">
          <Dropdown className="dropdown gl-dropdown"
            toggleClassName="btn btn-default btn-md gl-button gl-dropdown-toggle dropdown-toggle"
            toggleProps={{ 'data-testid': 'base-dropdown-toggle', 'aria-haspopup': 'listbox' }}
            toggle={<>
              <span className="gl-dropdown-button-text">{sortLabel(sort, sorts)}</span>
              <Icon name="chevron-down" />
            </>}
            menuClassName="dropdown-menu dropdown-menu-right"
            menuProps={{ 'data-testid': 'base-dropdown-menu' }}>
            <ul id="listbox" role="listbox">
              {sorts.map(([v, l]) => (
                <li key={v} className="gl-dropdown-item gl-listbox-item" role="option"
                  aria-selected={sortLabel(sort, sorts) === l}>
                  <a className="dropdown-item" href={sortHref(v)}>
                    <p className="gl-dropdown-item-text-primary">{l}</p></a>
                </li>
              ))}
            </ul>
          </Dropdown>
          {/* assets/README.md §5a.6: the tooltip is literally `Sort direction`
              and the icon is sort-highest (descending) / sort-lowest (ascending). */}
          <a className="gl-button btn btn-default btn-md btn-icon flex-shrink-1 has-tooltip reverse-sort-btn rspec-reverse-sort"
            title="Sort direction" aria-label="Sort direction"
            href={directionHref()}>
            <Icon name={asc ? 'sort-lowest' : 'sort-highest'} />
          </a>
        </div>
      </form>
    </div>
  )
}

/**
 * The `Edit issues` / `Edit merge requests` bulk-update sidebar — the panel the
 * source opens on the right when bulk mode is on (`aside.issues-bulk-update`,
 * see assets/html/issues-primer-bug.html, which captures it collapsed).
 *
 * Every field left on `No change` is untouched, matching the source: a bulk
 * update only writes the attributes the user actually picked.
 */
function BulkUpdateSidebar({ kind, project, selected, onDone }) {
  const { state, updateIn } = useApp()
  const collection = kind === 'issues' ? 'issues' : 'mergeRequests'
  const [status, setStatus] = React.useState('')
  const [assignee, setAssignee] = React.useState('')
  const [milestone, setMilestone] = React.useState('')
  const [labels, setLabels] = React.useState([])
  const [subscription, setSubscription] = React.useState('')
  const [flash, setFlash] = React.useState('')

  const memberIds = state.members
    .filter(m => m.source_type === 'project' && m.source_id === (project ? project.id : null))
    .map(m => m.user_id)
  const assignees = state.users.filter(u => memberIds.includes(u.id))
  const milestones = state.milestones.filter(m => !project || m.project_id === project.id)
  const projectLabels = state.labels.filter(l => !project || l.project_id === project.id)

  const noun = kind === 'issues' ? 'issues' : 'merge requests'

  function apply() {
    if (!selected.length) return
    updateIn(collection, r => selected.includes(r.id), r => {
      const patch = { updated_at: dbStamp(new Date(), { micros: false }) }
      if (status) {
        patch.state = status
        patch.closed_at = status === 'closed' ? dbStamp(new Date(), { micros: false }) : null
      }
      if (assignee) patch.assignee_ids = assignee === 'none' ? [] : [Number(assignee)]
      if (milestone) patch.milestone_id = milestone === 'none' ? null : Number(milestone)
      if (labels.length) {
        patch.label_ids = [...new Set([...(r.label_ids || []), ...labels.map(Number)])]
      }
      if (subscription) patch.subscribed = subscription === 'subscribe'
      return patch
    })
    setFlash(`${selected.length} ${selected.length === 1 ? noun.replace(/s$/, '') : noun} updated`)
    onDone()
    setStatus(''); setAssignee(''); setMilestone(''); setLabels([]); setSubscription('')
  }

  return (
    <aside aria-live="polite" className="issues-bulk-update right-sidebar right-sidebar-expanded"
      data-testid="bulk-update-sidebar">
      <div className="issuable-sidebar">
        <div className="block gl-p-4">
          <strong>{selected.length ? `${selected.length} selected` : `Select ${noun} to update`}</strong>
        </div>
        <div className="block">
          <div className="filter-item">
            <label htmlFor="update_status">Status</label>
            <select id="update_status" name="update[state_event]" value={status}
              onChange={e => setStatus(e.target.value)}>
              <option value="">No change</option>
              <option value="opened">Open</option>
              <option value="closed">Closed</option>
            </select>
          </div>
        </div>
        <div className="block">
          <div className="filter-item">
            <label htmlFor="update_assignee_id">Assignee</label>
            <select id="update_assignee_id" name="update[assignee_ids][]" value={assignee}
              onChange={e => setAssignee(e.target.value)}>
              <option value="">No change</option>
              <option value="none">Unassigned</option>
              {assignees.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>
        <div className="block">
          <div className="filter-item">
            <label htmlFor="update_milestone_id">Milestone</label>
            <select id="update_milestone_id" name="update[milestone_id]" value={milestone}
              onChange={e => setMilestone(e.target.value)}>
              <option value="">No change</option>
              <option value="none">No milestone</option>
              {milestones.map(m => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </div>
        </div>
        <div className="block">
          <div className="filter-item">
            <label htmlFor="update_label_ids">Labels</label>
            <select id="update_label_ids" name="update[add_label_ids][]" multiple size={5}
              value={labels}
              onChange={e => setLabels([...e.target.selectedOptions].map(o => o.value))}>
              {projectLabels.map(l => <option key={l.id} value={l.id}>{l.title}</option>)}
            </select>
          </div>
        </div>
        {kind === 'issues' ? (
          <div className="block">
            <div className="filter-item">
              <label htmlFor="update_subscription_event">Subscriptions</label>
              <select id="update_subscription_event" name="update[subscription_event]"
                value={subscription} onChange={e => setSubscription(e.target.value)}>
                <option value="">No change</option>
                <option value="subscribe">Subscribe</option>
                <option value="unsubscribe">Unsubscribe</option>
              </select>
            </div>
          </div>
        ) : null}
        {flash ? <div className="gl-alert gl-alert-success"><div className="gl-alert-content">{flash}</div></div> : null}
        <div className="block gl-display-flex" style={{ gap: 8 }}>
          <button type="button" className="btn gl-button btn-confirm js-update-selected-issues"
            disabled={!selected.length} onClick={apply}>
            <span className="gl-button-text">
              {kind === 'issues' ? 'Update all issues' : 'Update all merge requests'}
            </span>
          </button>
        </div>
      </div>
    </aside>
  )
}

export function IssuableRow({ row, kind, project, showProject, bulkMode, checked = false, onCheck }) {
  const { indexes } = useApp()
  const author = indexes.usersById.get(row.author_id)
  const labels = (row.label_ids || []).map(id => indexes.labelsById.get(id)).filter(Boolean)
  const milestone = row.milestone_id ? indexes.milestonesById.get(row.milestone_id) : null
  const assignees = (row.assignee_ids || []).map(id => indexes.usersById.get(id)).filter(Boolean)
  const proj = project || indexes.projectsById.get(row.project_id)
  if (!proj) return null
  const href = `/${proj.full_path}/-/${kind}/${row.iid}`
  const sigil = kind === 'issues' ? '#' : '!'
  const listBase = `/${proj.full_path}/-/${kind}`
  // §13.6: `li.issuable-status` holds the literal text `CLOSED` on the
  // Closed/All tabs and is empty on the Open tab.
  const statusText = row.state === 'closed' ? 'CLOSED' : row.state === 'merged' ? 'MERGED' : ''

  return (
    <li className={kind === 'issues' ? 'issue' : 'merge-request'}
      id={`issuable_${row.id}`} data-labels={JSON.stringify(row.label_ids || [])}
      data-qa-selector="issuable_container" data-qa-issuable-title={row.title}>
      <div className="issuable-info-container gl-display-flex" style={{ gap: 12 }}>
        {bulkMode ? (
          <div className="gl-form-checkbox issue-check gl-mr-0">
            <input type="checkbox" className="custom-control-input" data-id={row.id} data-iid={row.iid}
              data-type={kind === 'issues' ? 'ISSUE' : 'MERGE_REQUEST'}
              aria-label={row.title} checked={checked} onChange={onCheck} />
          </div>
        ) : null}
        <div className="issuable-main-info" style={{ flex: 1 }}>
          <div className="issue-title title" data-testid="issuable-title">
            <span className="issue-title-text" dir="auto">
              <a className="gl-link issue-title-text" data-qa-selector="issuable_title_link" href={href}>{row.title}</a>
            </span>
          </div>
          <div className="issuable-info gl-text-gray-500 gl-font-sm">
            {showProject ? <><a href={`/${proj.full_path}`}>{proj.full_path}</a>{' '}</> : null}
            <span className="issuable-reference" data-testid="issuable-reference">{sigil}{row.iid}</span>
            <span aria-hidden="true"> · </span>
            <span className="issuable-authored gl-mr-3">
              {'created '}
              <span data-testid="issuable-created-at"><TimeAgo value={row.created_at} /></span>
              {author ? <>{' by '}<a className="gl-link author-link js-user-link" data-testid="issuable-author"
                data-username={author.username} data-name={author.name} data-user-id={author.id}
                href={`/${author.username}`}><span className="author">{author.name}</span></a></> : null}
            </span>
            {milestone ? (
              <span className="issuable-milestone gl-mr-3" data-testid="issuable-milestone">
                <a className="gl-link" href={`/${proj.full_path}/-/milestones/${milestone.iid}`}>
                  <Icon name="clock" /> {milestone.title}</a></span>
            ) : null}
            {row.due_date ? <span className="issuable-due-date gl-mr-3">{row.due_date}</span> : null}
            {/* TEST.part-routes-b.md BUG-B07: GitLab 15.7's MR list row stops at
                `!450 · created 3 years ago by Josh Bowden`. The source→target
                branch chips belong to the MR detail page, not the list. */}
            {labels.length ? (
              <span role="group" aria-label="Labels">
                {labels.map(l => (
                  // DIFF-1303 — GitLab's `issuable_item.vue#labelTarget()` replaces the
                  // whole query with one `encodeURIComponent`-escaped param, which is
                  // exactly what webarena-102…105 and 339…343 anchor on.
                  <LabelChip key={l.id} label={l} className="gl-ml-2"
                    href={labelFilterUrl(listBase, l.title)} />
                ))}
              </span>
            ) : null}
          </div>
        </div>
        <div className="issuable-meta">
          <ul className="controls list-unstyled gl-display-flex gl-align-items-center" style={{ gap: 8 }}>
            <li className="issuable-status">{statusText}</li>
            {assignees.map(a => (
              <li key={a.id}>
                <a className="gl-link gl-avatar-link user-avatar-link author-link"
                  data-qa-selector="assignee_link" title={`Assigned to ${a.name}`} href={`/${a.username}`}>
                  <UserAvatar user={a} size={16} alt={`Assigned to ${a.name}`} />
                </a>
              </li>
            ))}
            <li data-testid="issuable-comments">
              <a className="gl-link gl-reset-color! issuable-comments gl-text-gray-500"
                title="Comments" href={`${href}#notes`}>
                {row.user_notes_count || 0}</a>
            </li>
            <li>
              <div data-testid="issuable-timestamp" className="gl-text-gray-500 gl-font-sm">
                updated <TimeAgo value={row.updated_at} /></div>
            </li>
          </ul>
        </div>
      </div>
    </li>
  )
}

/** §13b.3 — the project has no issuables at all. Copy is verbatim. */
export function NoIssuablesEmptyState({ newHref, kind }) {
  if (kind === 'merge_requests') {
    return (
      <section className="empty-state gl-text-center">
        <div className="gl-max-w-full gl-m-auto"><div className="gl-mx-auto gl-my-0 gl-p-5">
          <h1 className="gl-font-size-h-display gl-line-height-36 h4">
            Merge requests are a place to propose changes you have made to a project and discuss those changes with others</h1>
          <p className="gl-mt-3">Interested parties can even contribute by pushing commits if they want to.</p>
          <div className="gl-display-flex gl-flex-wrap gl-justify-content-center">
            <a href={newHref} className="btn btn-confirm btn-md gl-button">
              <span className="gl-button-text">New merge request</span></a>
          </div>
        </div></div>
      </section>
    )
  }
  return (
    <>
      <section className="empty-state gl-text-center">
        <div className="gl-max-w-full gl-m-auto"><div className="gl-mx-auto gl-my-0 gl-p-5">
          <h1 className="gl-font-size-h-display gl-line-height-36 h4">
            Use issues to collaborate on ideas, solve problems, and plan work</h1>
          <p className="gl-mt-3">
            <a href="/help/user/project/issues/index" className="gl-link">Learn more about issues.</a></p>
          <div className="gl-display-flex gl-flex-wrap gl-justify-content-center">
            <a href={newHref} className="btn btn-confirm btn-md gl-button">
              <span className="gl-button-text">New issue</span></a>
          </div>
        </div></div>
      </section>
      <hr />
      <p className="gl-text-center gl-font-weight-bold gl-mb-0">Using Jira for issue tracking?</p>
      <p className="gl-text-center gl-mb-0">
        <a href="/help/integration/jira/issues#view-jira-issues" className="gl-link">Enable the Jira integration</a>
        {' to view your Jira issues in GitLab.'}</p>
      <p className="gl-text-center gl-text-secondary">This feature requires a Premium plan.</p>
    </>
  )
}

/**
 * @param rows   all issuables in scope, before state/filter/sort
 * @param kind   'issues' | 'merge_requests'
 */
export function IssuableListBody({ rows, kind, project, basePath, showProject = false, bulkMode = false }) {
  const { indexes } = useApp()
  const q = useQuery()
  const [selected, setSelected] = React.useState(() => [])
  React.useEffect(() => { if (!bulkMode) setSelected([]) }, [bulkMode])
  const toggleSelected = id => setSelected(prev =>
    (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))

  const counts = {
    opened: rows.filter(r => r.state === 'opened').length,
    closed: rows.filter(r => r.state === 'closed').length,
    merged: rows.filter(r => r.state === 'merged').length,
    all: rows.length,
  }

  const filtered = filterIssuables(rows, q, indexes)
  const sorted = sortIssuables(filtered, q.get('sort', 'created_date'), indexes)

  const page = Math.max(1, parseInt(q.get('page', '1'), 10) || 1)
  const pageSize = parseInt(q.get('first_page_size', String(PER_PAGE)), 10) || PER_PAGE
  const pageRows = sorted.slice((page - 1) * pageSize, page * pageSize)
  const hasNext = sorted.length > page * pageSize

  // DIFF-1303 — paging keeps the anchors' URL form too, so a filter that was
  // reached by click survives a page turn.
  const pageLink = n => issuableListUrl(basePath, q.searchParams, { page: String(n) })
  const sizeLink = n => issuableListUrl(basePath, q.searchParams, { first_page_size: String(n) })

  return (
    // `.right-sidebar` is `position: fixed`, so the list needs to make room for
    // the bulk panel the way the source's `.right-sidebar-expanded` does.
    <div className="issuable-list-container"
      style={bulkMode ? { paddingRight: 'var(--right-sidebar-width)' } : undefined}>
      <FilteredSearchBar action={basePath} kind={kind} project={project} />

      {bulkMode ? (
        <BulkUpdateSidebar kind={kind} project={project} selected={selected}
          onDone={() => setSelected([])} />
      ) : null}

      {pageRows.length === 0 ? (
        // §13b.4 — the filter matched nothing. Tabs + search bar stay.
        <section className="empty-state gl-text-center">
          <div className="gl-max-w-full gl-m-auto"><div className="gl-mx-auto gl-my-0 gl-p-5">
            <h1 className="gl-font-size-h-display gl-line-height-36 h4">Sorry, your filter produced no results</h1>
            <p className="gl-mt-3">To widen your search, change or remove filters above</p>
            <div className="gl-display-flex gl-flex-wrap gl-justify-content-center">
              <a href={`${basePath}/new`} className="btn btn-confirm btn-md gl-button">
                <span className="gl-button-text">{kind === 'issues' ? 'New issue' : 'New merge request'}</span></a>
            </div>
          </div></div>
        </section>
      ) : (
        <ul className={`content-list issuable-list ${kind === 'issues' ? 'issues-list' : 'mr-list'}`}>
          {pageRows.map(r => (
            <IssuableRow key={r.id} row={r} kind={kind} project={project}
              showProject={showProject} bulkMode={bulkMode}
              checked={selected.includes(r.id)} onCheck={() => toggleSelected(r.id)} />
          ))}
        </ul>
      )}

      <div className="gl-text-center gl-mt-6 gl-relative">
        <div role="group" className="gl-keyset-pagination btn-group">
          <a data-testid="prevButton"
            className={`btn btn-default btn-md gl-button${page === 1 ? ' disabled' : ''}`}
            href={page === 1 ? '#' : pageLink(page - 1)}>
            <span className="gl-button-text">Prev</span></a>
          <a data-testid="nextButton"
            className={`btn btn-default btn-md gl-button${hasNext ? '' : ' disabled'}`}
            href={hasNext ? pageLink(page + 1) : '#'}>
            <span className="gl-button-text">Next</span></a>
        </div>
        <Dropdown className="dropdown gl-dropdown gl-absolute gl-right-0"
          style={{ position: 'absolute', right: 0, top: 0 }}
          toggle={<>
            <span className="gl-dropdown-button-text">Show {pageSize} items</span>
            <Icon name="chevron-down" />
          </>}
          menuClassName="dropdown-menu dropdown-menu-right">
          <ul>
            {[20, 50, 100].map(n => (
              <li key={n}><a href={sizeLink(n)}>
                <span className="gl-white-space-nowrap">Show {n} items</span></a></li>
            ))}
          </ul>
        </Dropdown>
      </div>
    </div>
  )
}
