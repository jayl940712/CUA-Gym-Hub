import React from 'react'
import Page from '../components/Page.jsx'
import { SLink } from '../utils/url.js'
import { searchTerms } from '../utils/catalog.js'
import { PRIVACY_POLICY_HTML } from '../data/privacyPolicy.js'

/** ROUTES #40 — /privacy-policy-cookie-restriction-mode */
export function PrivacyPolicyPage() {
  return (
    <Page
      title="Privacy and Cookie Policy"
      documentTitle="Privacy and Cookie Policy"
      sidebar="none"
    >
      <div dangerouslySetInnerHTML={{ __html: PRIVACY_POLICY_HTML }} />
    </Page>
  )
}

/*
 * `Magento\Search\Block\Term::_loadTerms()` runs the popular-terms collection
 * through PHP's `natcasesort()`, so the list is ordered by natural,
 * case-insensitive term text — not by popularity. Confirmed against the live
 * source, whose 100 terms run `4090, amazon basic, Amazon Echo Dot 3rd
 * generation, Anker charger, ape escape …` through `… xbox series x, zara`.
 *
 * A plain `toLowerCase()` compare gets that list *almost* right, but PHP's
 * natural order skips whitespace and compares digit runs as numbers, and the
 * seed contains pairs where that changes the answer:
 *
 *   B07GYZVLL6 < B0798BBMLP   (left-aligned digit run `07G` vs `079`)
 *   B08NLM81WZ < B087QJN9W1
 *   shoes      < shoe storage (the space in "shoe storage" is skipped)
 *
 * The three functions below are a transcription of PHP's `strnatcmp_ex()`
 * (ext/standard/strnatcmp.c) with `fold_case` on. Verified to reproduce the
 * live source's exact 100-term sequence.
 */
const isDigit = (c) => c !== undefined && c >= '0' && c <= '9'
const isSpace = (c) => c === ' ' || c === '\t' || c === '\n' || c === '\r' || c === '\v' || c === '\f'

/** Left-aligned (fractional) digit-run compare — the first differing digit wins. */
function compareLeft(a, b, ai, bi) {
  for (;; ai++, bi++) {
    const ca = a[ai], cb = b[bi]
    const da = isDigit(ca), db = isDigit(cb)
    if (!da && !db) return [0, ai, bi]
    if (!da) return [-1, ai, bi]
    if (!db) return [1, ai, bi]
    if (ca < cb) return [-1, ai, bi]
    if (ca > cb) return [1, ai, bi]
  }
}

/** Right-aligned digit-run compare — the longer run wins, else the first bias. */
function compareRight(a, b, ai, bi) {
  let bias = 0
  for (;; ai++, bi++) {
    const ca = a[ai], cb = b[bi]
    const da = isDigit(ca), db = isDigit(cb)
    if (!da && !db) return [bias, ai, bi]
    if (!da) return [-1, ai, bi]
    if (!db) return [1, ai, bi]
    if (ca < cb) { if (!bias) bias = -1 } else if (ca > cb) { if (!bias) bias = 1 }
  }
}

/** PHP `strnatcasecmp()`. */
function strnatcasecmp(a, b) {
  const al = a.length, bl = b.length
  if (al === 0 || bl === 0) return al === bl ? 0 : (al > bl ? 1 : -1)
  let ap = 0, bp = 0, leading = true
  for (;;) {
    let ca = a[ap], cb = b[bp]
    while (leading && ca === '0' && ap + 1 < al && isDigit(a[ap + 1])) ca = a[++ap]
    while (leading && cb === '0' && bp + 1 < bl && isDigit(b[bp + 1])) cb = b[++bp]
    leading = false
    while (isSpace(ca)) ca = a[++ap]
    while (isSpace(cb)) cb = b[++bp]
    if (isDigit(ca) && isDigit(cb)) {
      const fractional = ca === '0' || cb === '0'
      const [result, nap, nbp] = fractional
        ? compareLeft(a, b, ap, bp)
        : compareRight(a, b, ap, bp)
      ap = nap; bp = nbp
      if (result !== 0) return result
      if (ap >= al && bp >= bl) return 0
      if (ap >= al) return -1
      if (bp >= bl) return 1
      continue
    }
    const ua = ca === undefined ? ' ' : ca.toUpperCase()
    const ub = cb === undefined ? ' ' : cb.toUpperCase()
    if (ua < ub) return -1
    if (ua > ub) return 1
    ap++; bp++
    if (ap >= al && bp >= bl) return 0
    if (ap >= al) return -1
    if (bp >= bl) return 1
  }
}

/** PHP's default float→string conversion (`precision=14`). */
function phpNumber(v) {
  let s = v.toPrecision(14)
  if (s.indexOf('.') !== -1) s = s.replace(/0+$/, '').replace(/\.$/, '')
  return s
}

/**
 * ROUTES #14 — /search/term/popular/. The source h1 is "Popular Search Terms".
 *
 * Markup, verbatim from the source (`assets/html/search-terms.html`):
 *
 *   <ul class="search-terms">
 *     <li id="term-386" class="item">
 *       <a href="…/catalogsearch/result/?q=4090">4090</a>
 *     </li>
 *
 * Magento emits the size as a per-term `<script>` that assigns
 * `element.style.fontSize`; we set the same declaration inline, which lands the
 * identical computed style. The ramp is `75% + ratio * 70%` where
 * `ratio = (popularity - min) / (max - min)` — the seed's 7 distinct
 * popularities (1..7) reproduce the source's 7 distinct sizes exactly:
 * 75, 86.666666666667, 98.333333333333, 110, 121.66666666667,
 * 133.33333333333, 145.
 */
export function SearchTermsPage() {
  const popularity = (t) => t.popularity || 1
  const max = Math.max(...searchTerms.map(popularity), 1)
  const min = Math.min(...searchTerms.map(popularity), 1)
  const fontSize = (p) => (max === min ? 75 : 75 + ((p - min) / (max - min)) * 70)
  const ordered = searchTerms
    .map((t, i) => [t, i])
    .sort((a, b) => strnatcasecmp(a[0].queryText, b[0].queryText) || a[1] - b[1])
    .map(([t]) => t)
  return (
    <Page title="Popular Search Terms" documentTitle="Popular Search Terms" sidebar="none">
      <ul className="search-terms">
        {ordered.map(t => (
          <li
            key={t.queryId}
            id={`term-${t.queryId}`}
            className="item"
            style={{ fontSize: `${phpNumber(fontSize(popularity(t)))}%` }}
          >
            <SLink to="/catalogsearch/result/" params={{ q: t.queryText }}>{t.queryText}</SLink>
          </li>
        ))}
      </ul>
    </Page>
  )
}

/** ROUTES #41 — the CMS 404. Reached by, among others, the malformed WebArena
 *  start URL …sport-specific-clothing.html&product_list_order=price */
export function NotFound() {
  return (
    <Page
      title="Whoops, our bad..."
      documentTitle="404 Not Found"
      sidebar="additional"
    >
      <dl className="cms-content">
        <dt>The page you requested was not found, and we have a fine guess why.</dt>
        <dd>
          <ul>
            <li>If you typed the URL directly, please make sure the spelling is correct.</li>
            <li>If you clicked on a link to get here, the link is outdated.</li>
          </ul>
        </dd>
        <dt>What can you do?</dt>
        <dd>
          Have no fear, help is near! There are many ways you can get back on track with Magento Store.
          <ul>
            <li><a href="#" onClick={e => { e.preventDefault(); window.history.back() }}>Go back</a> to the previous page.</li>
            <li>Use the search bar at the top of the page to search for your products.</li>
            <li>Follow these links to get you back on track!<br />
              <SLink to="/">Store Home</SLink>{' '}<span>|</span>{' '}
              <SLink to="/customer/account/">My Account</SLink>
            </li>
          </ul>
        </dd>
      </dl>
    </Page>
  )
}
