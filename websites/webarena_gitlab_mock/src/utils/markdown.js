// Minimal GitLab-Flavored-Markdown renderer for descriptions, comments and
// READMEs. The seed is full of markdown and evaluators read `outerText`, so
// the priority is producing the right *text* with plausible structure.
// (TODO next shard: task lists, tables, @mentions, #123 / !123 autolinks,
// emoji shortcodes — TODO.md P2.)

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ---------------------------------------------------------------------------
// Raw HTML safelist (BUG-B06)
// ---------------------------------------------------------------------------
// GFM does NOT escape raw HTML — it runs the rendered document through a
// safelist sanitizer (`Banzai::Filter::SanitizationFilter`, which extends
// html-pipeline's LIMITED safelist). Escaping first, as this renderer used to,
// turned every `<img src=…>`, `<br>`, `<sub>`, `<kbd>` and `<details>` in the
// seed into literal angle-bracket text. That is not merely cosmetic here:
// comment and description bodies carry the anchor strings an automated
// evaluator compares verbatim, and a body rendered as `<img alt="x" …>` instead
// of an image changes that text.
//
// So the safelisted tags are lifted out before escaping and put back after the
// inline rules have run. Anything not on the list still gets escaped, exactly
// as the sanitizer would strip it.
const SAFE_TAGS = new Set([
  'a', 'abbr', 'b', 'blockquote', 'br', 'code', 'dd', 'del', 'details', 'div',
  'dl', 'dt', 'em', 'figcaption', 'figure', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'hr', 'i', 'img', 'ins', 'kbd', 'li', 'ol', 'p', 'pre', 'q', 'rp', 'rt',
  'ruby', 's', 'samp', 'small', 'span', 'strike', 'strong', 'sub', 'summary',
  'sup', 'table', 'tbody', 'td', 'tfoot', 'th', 'thead', 'tr', 'ul', 'var',
])

/** Per-tag attribute safelist, mirroring the sanitizer's. */
const SAFE_ATTRS = {
  a: ['href', 'title', 'name', 'rel', 'target'],
  img: ['src', 'alt', 'title', 'width', 'height', 'align', 'data-canonical-src'],
  td: ['colspan', 'rowspan', 'align'],
  th: ['colspan', 'rowspan', 'align'],
  ol: ['start'],
  details: ['open'],
}
const COMMON_ATTRS = ['class', 'title', 'dir', 'id']

const VOID_TAGS = new Set(['br', 'hr', 'img'])

/** `javascript:` and friends never survive the sanitizer. */
function safeUrl(v) {
  return /^\s*(javascript|vbscript|data)\s*:/i.test(v) && !/^\s*data:image\//i.test(v) ? '' : v
}

function attrValue(raw) {
  return String(raw).replace(/&(?![a-zA-Z#0-9]+;)/g, '&amp;').replace(/"/g, '&quot;')
}

/** Re-emit one raw tag with only its safelisted attributes. */
function sanitizeTag(tag, attrSrc, selfClosing) {
  const allowed = new Set([...(SAFE_ATTRS[tag] || []), ...COMMON_ATTRS])
  const attrs = {}
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g
  let m
  while ((m = re.exec(attrSrc))) {
    const key = m[1].toLowerCase()
    if (!allowed.has(key)) continue
    attrs[key] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : key
  }
  if (tag === 'a' && attrs.href !== undefined) attrs.href = safeUrl(attrs.href)
  if (tag === 'img') {
    // Offline rule (WEBARENA_MIGRATION.md §1): an external src is parked on
    // `data-canonical-src` — GitLab's own attribute — and the rendered src is a
    // local placeholder, so a raw <img> makes no network call either.
    const src = safeUrl(attrs.src || '')
    if (isOffsite(src)) {
      attrs['data-canonical-src'] = src
      attrs.src = IMG_PLACEHOLDER
    } else {
      attrs.src = src
    }
  }
  const body = Object.keys(attrs).map(k => ` ${k}="${attrValue(attrs[k])}"`).join('')
  return `<${tag}${body}${selfClosing && !VOID_TAGS.has(tag) ? ' /' : ''}>`
}

const RAW_TAG_RE = /<(\/?)([a-zA-Z][a-zA-Z0-9]*)((?:\s+[^<>]*?)?)(\/?)>/g
const HOLD = '\u0001'

/**
 * Replace every safelisted raw tag with a `\u0001N\u0001` placeholder and return
 * the stash. U+0001 cannot appear in seed text and is inert to every inline
 * rule below, so the markdown pass runs over the remaining prose untouched.
 */
function liftRawHtml(text) {
  const stash = []
  const held = String(text).replace(RAW_TAG_RE, (m, slash, name, attrSrc, selfClose) => {
    const tag = name.toLowerCase()
    if (!SAFE_TAGS.has(tag)) return m
    const html = slash ? `</${tag}>` : sanitizeTag(tag, attrSrc || '', !!selfClose)
    stash.push(html)
    return `${HOLD}${stash.length - 1}${HOLD}`
  })
  return { held, stash }
}

/** Safelisted tags GFM treats as block level (see renderMarkdown). */
const BLOCK_TAG_RE = /^\s*<\/?(?:details|summary|div|table|thead|tbody|tfoot|tr|td|th|ul|ol|li|dl|dt|dd|p|blockquote|pre|figure|figcaption|h[1-6]|hr)(?:\s[^<>]*)?\/?>/i

function dropRawHtml(text, stash) {
  return String(text).replace(new RegExp(`${HOLD}(\\d+)${HOLD}`, 'g'), (m, i) => stash[Number(i)] || '')
}

// The mock must work fully offline (WEBARENA_MIGRATION.md §1). Seed READMEs
// and descriptions are full of absolute image URLs, so external <img> sources
// are parked on `data-canonical-src` — the same attribute GitLab itself uses —
// and the rendered src is a local placeholder. Zero runtime network calls.
const IMG_PLACEHOLDER = "data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='90'%3E%3Crect width='120' height='90' fill='%23ececef'/%3E%3C/svg%3E"

/**
 * Sources the mock cannot serve: anything absolute, plus GitLab's own
 * `/uploads/<hash>/<file>` store — those bytes were never dumped out of the
 * container, so pointing at them yields a broken image on every screenshot in
 * a comment thread. Both get the placeholder and keep the real path on
 * `data-canonical-src`. `/files/<sid>/<name>` (the mock's own upload endpoint)
 * is served and stays untouched.
 */
function isOffsite(src) {
  return /^(https?:)?\/\//i.test(src) || /^\/uploads\//i.test(src)
}

function imgTag(alt, src) {
  return isOffsite(src)
    ? `<img alt="${alt}" data-canonical-src="${src}" src="${IMG_PLACEHOLDER}">`
    : `<img alt="${alt}" src="${src}">`
}

function inline(text) {
  // Raw safelisted HTML is lifted out first so `escapeHtml` cannot turn it into
  // literal text, then restored once the inline rules have run (BUG-B06).
  const { held, stash } = liftRawHtml(text)
  let s = escapeHtml(held)
  s = s.replace(/`([^`]+)`/g, '<code>$1</code>')
  s = s.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (m, alt, src) => imgTag(alt, src))
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)[^)]*\)/g, '<a href="$2">$1</a>')
  s = s.replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>')
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  s = s.replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1<em>$2</em>')
  s = s.replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
  return dropRawHtml(s, stash)
}

/** `[ ] text` / `[x] text` / `[X] text` — the body of a GFM task-list item. */
const TASK_ITEM_RE = /^\[([ xX])\]\s+([\s\S]*)$/

/**
 * The `#task_status` counts GitLab puts in an issuable's header
 * (`1 of 3 checklist items completed` / `1/3 checklist items`). Counted off the
 * markdown SOURCE, which is what GitLab counts too.
 */
export function taskListSummary(src) {
  let total = 0
  let done = 0
  for (const line of String(src || '').split(/\r?\n/)) {
    const m = /^\s*([-*+]|\d+\.)\s+\[([ xX])\]\s+/.exec(line)
    if (!m) continue
    total += 1
    if (m[2].toLowerCase() === 'x') done += 1
  }
  return { total, done }
}

/**
 * Flip the `n`-th task-list checkbox in a markdown source. Returns the new
 * source, so the caller can persist it the same way any other description edit
 * is persisted (`issues.changed → [].description`).
 */
export function toggleTaskItem(src, n) {
  let seen = -1
  return String(src || '').split('\n').map(line => {
    const m = /^(\s*(?:[-*+]|\d+\.)\s+\[)([ xX])(\]\s+)/.exec(line)
    if (!m) return line
    seen += 1
    if (seen !== n) return line
    const next = m[2].toLowerCase() === 'x' ? ' ' : 'x'
    return m[1] + next + m[3] + line.slice(m[0].length)
  }).join('\n')
}

export function renderMarkdown(src) {
  if (!src) return ''
  const lines = String(src).split(/\r?\n/)
  const out = []
  let i = 0
  let listType = null
  let listItems = []
  let listHasTask = false
  let para = []

  function flushPara() {
    if (!para.length) return
    // Buffered list items are emitted by closeList(), so a paragraph that
    // accumulated while a list was open has to wait for the list to close or
    // it would jump ahead of it in the output.
    closeList()
    out.push(`<p dir="auto">${inline(para.join('\n')).replace(/\n/g, '<br>')}</p>`)
    para = []
  }
  // The `task-list` class lives on the LIST, so items are buffered until the
  // list closes and we know whether any of them was a `- [ ]` (TEST.md
  // DIFF-906). `assets/html/issue-a11ywebring-71.html`:
  //   <ul class="task-list"><li class="task-list-item enabled">
  //     <input type="checkbox" class="task-list-item-checkbox"> text</li>
  function closeList() {
    if (!listType) return
    out.push(`<${listType}${listHasTask ? ' class="task-list"' : ''} dir="auto">`)
    out.push(...listItems)
    out.push(`</${listType}>`)
    listType = null
    listItems = []
    listHasTask = false
  }

  while (i < lines.length) {
    const line = lines[i]

    const fence = /^```(\w*)\s*$/.exec(line)
    if (fence) {
      flushPara(); closeList()
      const body = []
      i++
      while (i < lines.length && !/^```/.test(lines[i])) { body.push(lines[i]); i++ }
      i++
      out.push(`<pre><code>${escapeHtml(body.join('\n'))}</code></pre>`)
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      flushPara(); closeList()
      const lvl = heading[1].length
      out.push(`<h${lvl}>${inline(heading[2])}</h${lvl}>`)
      i++
      continue
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      flushPara()
      const ordered = /^\s*\d+\./.test(line)
      const want = ordered ? 'ol' : 'ul'
      if (listType !== want) { closeList(); listType = want }
      const body = line.replace(/^\s*([-*+]|\d+\.)\s+/, '')
      const task = TASK_ITEM_RE.exec(body)
      if (task) {
        listHasTask = true
        const checked = task[1].toLowerCase() === 'x'
        listItems.push(`<li class="task-list-item enabled"><input type="checkbox" class="task-list-item-checkbox"${checked ? ' checked' : ''}> ${inline(task[2])}</li>`)
      } else {
        listItems.push(`<li>${inline(body)}</li>`)
      }
      i++
      continue
    }

    if (/^\s*>\s?/.test(line)) {
      flushPara(); closeList()
      out.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ''))}</blockquote>`)
      i++
      continue
    }

    if (/^\s*(---|===|\*\*\*)\s*$/.test(line)) {
      flushPara(); closeList()
      out.push('<hr>')
      i++
      continue
    }

    if (line.trim() === '') { flushPara(); closeList(); i++; continue }

    // A line opening a raw BLOCK element is emitted at block level, not wrapped
    // in <p> — the seed's `<details><summary>…` blocks would otherwise come out
    // as invalid `<p><details>` nesting. Inline tags (<img>, <br>, <kbd>) stay
    // in the paragraph, exactly as GFM puts them.
    if (BLOCK_TAG_RE.test(line)) {
      flushPara(); closeList()
      out.push(inline(line))
      i++
      continue
    }

    para.push(line)
    i++
  }
  flushPara(); closeList()
  return out.join('\n')
}

/** <div class="md"> wrapper GitLab uses for every rendered markdown body. */
export function MarkdownBodyProps(src) {
  return { className: 'md', 'data-testid': 'gfm-content', dangerouslySetInnerHTML: { __html: renderMarkdown(src) } }
}
