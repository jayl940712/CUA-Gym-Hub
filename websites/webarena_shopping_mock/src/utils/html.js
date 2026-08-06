// The mock must work fully offline (WEBARENA_MIGRATION.md §1: "Any runtime
// network call" is forbidden). Product descriptions come out of the Magento
// `catalog_product_entity_text` blob and still contain Amazon A+ marketing
// markup, so anything that could fetch a remote asset is stripped before the
// string reaches dangerouslySetInnerHTML.
//
// The seed build (assets/dumps/clean_desc.py) already does this; this is the
// second layer, so an injected or hand-edited description cannot reintroduce a
// network call. Both layers cover the same five forms the raw dump contains:
// src / data-src attributes, URLs inside <script>, CSS url() in a style
// attribute, and <link href>. Element removal alone misses the last two.

const ABS_URL = /^\s*(?:https?:)?\/\//i

// Attributes the browser fetches. `href` is only reached here via <link>;
// <a> is in neither media list, so ordinary text links are untouched.
const FETCH_ATTRS = [
  'src', 'srcset', 'data-src', 'data-a-dynamic-image', 'data-a-hires',
  'data-old-hires', 'poster', 'data', 'background', 'lowsrc', 'href', 'xlink:href',
]
const ATTR_SRC = `\\s(?:${FETCH_ATTRS.map(a => a.replace(':', '\\:')).join('|')})\\s*=\\s*("([^"]*)"|'([^']*)')`

const VOID_MEDIA = 'img|source|track|embed|link|input'
const PAIRED_MEDIA = 'video|iframe|audio|object|picture'

function hasRemoteAsset(tag) {
  const re = new RegExp(ATTR_SRC, 'gi')
  let m
  while ((m = re.exec(tag)) !== null) {
    const value = m[2] !== undefined ? m[2] : m[3]
    if (ABS_URL.test(value)) return true
  }
  return false
}

/**
 * Remove every absolute-http reference from stored HTML, in any form.
 * Text content and non-URL style declarations are left untouched — task
 * evaluators read the description copy.
 */
export function sanitizeStoredHtml(html) {
  if (!html) return ''
  let out = String(html)

  // <script>/<style>/<noscript> never render through innerHTML, but their
  // source text leaks into the plain-text extraction used by list tiles and
  // the compare table — and carries absolute URLs.
  out = out.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, '')
  out = out.replace(/<(?:script|style|noscript)\b[^>]*>[\s\S]*$/i, '')

  // CSS url() in an inline style fetches exactly like <img src>. Neutralise
  // only the URL so sibling declarations (background-color, …) survive.
  out = out.replace(/url\(\s*['"]?\s*(?:https?:)?\/\/[^)]*\)/gi, 'none')
  out = out.replace(/@import\s+(?:url\()?\s*['"]?\s*(?:https?:)?\/\/[^;]*;?/gi, '')

  // Paired media: drop the element and everything it wraps.
  out = out.replace(
    new RegExp(`<(?:${PAIRED_MEDIA})\\b[^>]*>[\\s\\S]*?<\\/(?:${PAIRED_MEDIA})\\s*>`, 'gi'),
    match => (hasRemoteAsset(match.slice(0, match.indexOf('>') + 1)) ? '' : match),
  )

  // Void media.
  out = out.replace(
    new RegExp(`<(?:${VOID_MEDIA})\\b[^>]*>`, 'gi'),
    match => (hasRemoteAsset(match) ? '' : match),
  )

  // A media tag left unterminated by upstream truncation.
  out = out.replace(new RegExp(`<(?:${VOID_MEDIA}|${PAIRED_MEDIA})\\b[^>]*$`, 'i'), '')

  // Backstop: any fetching attribute holding an absolute URL, on any element
  // not covered above.
  out = out.replace(new RegExp(ATTR_SRC, 'gi'), (match, _q, dq, sq) => {
    const value = dq !== undefined ? dq : sq
    return ABS_URL.test(value) ? '' : match
  })

  return out
}
