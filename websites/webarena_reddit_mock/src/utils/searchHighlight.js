// Client-side reproduction of what the source's /search page SHOWS.
//
// Postmill's SearchRepository (src/Repository/SearchRepository.php in the
// container) selects, per row:
//
//   title_highlighted = ts_headline(e.title, search_query, 'HighlightAll=TRUE')
//   body_excerpt      = ts_headline(e.body,  search_query, 'MaxFragments=3')
//
// with `search_query = plainto_tsquery(:query)`. Twig then HTML-escapes the
// result and `FormattingExtension::highlightSearch()` rewrites the default
// StartSel/StopSel:
//
//   preg_replace('!&lt;b&gt;(.*?)&lt;/b&gt;!', '<mark>\1</mark>', $html)
//
// so the body is the RAW markdown source (escaped, never rendered) wrapped in a
// single `<p>`, and the title is the escaped title with `<mark>` around matched
// lexemes. `templates/_layouts/submission.html.twig`'s `submission_title` block
// is inside `{% apply spaceless %}`, which is why the source drops the space
// between two adjacent `<mark>`s in a title and not in a body.
//
// Nothing here changes WHICH rows match — result selection stays the declared
// client-side approximation in SearchPage.jsx (TODO.md "Out of Scope": Postgres
// full-text ranking). This module only reproduces the rendering.
//
// ── ts_headline defaults, measured against the container, not guessed ────────
// MaxWords=35, MinWords=15, ShortWord=3, MaxFragments=3, FragmentDelimiter=' ... '
//
//   psql> SELECT ts_headline('alpha bravo … tango machine uniform … tttt',
//                            plainto_tsquery('machine'), 'MaxFragments=3');
//   → 'delta … <b>machine</b> … kkkk'   (35 words, cover centred: 17 either side)
//
//   psql> SELECT ts_headline('one two three … machine … forty', …)
//   → 'three … thirtysix'  ('one'/'two' are <= ShortWord and are skipped at the
//                            start, then 35 words are taken from there)
//
//   psql> SELECT ts_headline(body, plainto_tsquery('machine learning'), 'MaxFragments=3')
//         FROM submissions WHERE id = 82395;
//   → 'there, I''m building a <b>machine</b> for deep <b>learning</b> … trying to decide'
//     (leading 'Hi' skipped as a short word; trailing 'the'/'cpu' trimmed as short)
//
//   A document with no match at all yields the first MinWords=15 words.
//
// Reproduced as: centre a MaxWords window on the cover, clamp to the document,
// skip leading words of <= ShortWord characters, take MaxWords, then trim
// trailing words of <= ShortWord characters. All three measured cases above come
// out character-identical under that rule.

const MAX_WORDS = 35
const MIN_WORDS = 15
const SHORT_WORD = 3
const MAX_FRAGMENTS = 3
const FRAGMENT_DELIMITER = ' ... '

/**
 * /usr/share/postgresql14/tsearch_data/english.stop from the running container,
 * verbatim — the stop list `plainto_tsquery(:q::text)` applies before stemming.
 */
const STOPWORDS = new Set(`i me my myself we our ours ourselves you your yours
yourself yourselves he him his himself she her hers herself it its itself they
them their theirs themselves what which who whom this that these those am is are
was were be been being have has had having do does did doing a an the and but if
or because as until while of at by for with about against between into through
during before after above below to from up down in out on off over under again
further then once here there when where why how all any both each few more most
other some such no nor not only own same so than too very s t can will just don
should now`.split(/\s+/).filter(Boolean))

/* ── Porter stemmer ────────────────────────────────────────────────────────
   Postgres' `english` dictionary is the Snowball English stemmer. This is the
   classic Porter algorithm it descends from; it agrees with Snowball on the
   forms that matter for highlighting (machine/machines -> machin,
   learning/learned/learns -> learn), so a word in the body is marked exactly
   when the source marks it. */

const VOWELS = 'aeiou'

function isConsonant(w, i) {
  const c = w[i]
  if (VOWELS.includes(c)) return false
  if (c === 'y') return i === 0 ? true : !isConsonant(w, i - 1)
  return true
}

/** m() — the number of VC sequences in the stem. */
function measure(stem) {
  let n = 0
  let i = 0
  const len = stem.length
  // skip leading consonants
  while (i < len && isConsonant(stem, i)) i++
  while (i < len) {
    while (i < len && !isConsonant(stem, i)) i++
    if (i >= len) break
    n++
    while (i < len && isConsonant(stem, i)) i++
  }
  return n
}

function hasVowel(stem) {
  for (let i = 0; i < stem.length; i++) if (!isConsonant(stem, i)) return true
  return false
}

function endsDoubleConsonant(w) {
  const n = w.length
  return n >= 2 && w[n - 1] === w[n - 2] && isConsonant(w, n - 1)
}

/** cvc — consonant/vowel/consonant where the final consonant is not w, x or y. */
function endsCVC(w) {
  const n = w.length
  if (n < 3) return false
  if (!isConsonant(w, n - 3) || isConsonant(w, n - 2) || !isConsonant(w, n - 1)) return false
  return !'wxy'.includes(w[n - 1])
}

const STEP2 = [
  ['ational', 'ate'], ['tional', 'tion'], ['enci', 'ence'], ['anci', 'ance'],
  ['izer', 'ize'], ['bli', 'ble'], ['alli', 'al'], ['entli', 'ent'],
  ['eli', 'e'], ['ousli', 'ous'], ['ization', 'ize'], ['ation', 'ate'],
  ['ator', 'ate'], ['alism', 'al'], ['iveness', 'ive'], ['fulness', 'ful'],
  ['ousness', 'ous'], ['aliti', 'al'], ['iviti', 'ive'], ['biliti', 'ble'],
  ['logi', 'log'],
]

const STEP3 = [
  ['icate', 'ic'], ['ative', ''], ['alize', 'al'], ['iciti', 'ic'],
  ['ical', 'ic'], ['ful', ''], ['ness', ''],
]

const STEP4 = [
  'al', 'ance', 'ence', 'er', 'ic', 'able', 'ible', 'ant', 'ement', 'ment',
  'ent', 'ou', 'ism', 'ate', 'iti', 'ous', 'ive', 'ize',
]

export function stem(word) {
  let w = String(word).toLowerCase()
  if (w.length <= 2) return w

  // step 1a
  if (w.endsWith('sses')) w = w.slice(0, -2)
  else if (w.endsWith('ies')) w = w.slice(0, -2)
  else if (w.endsWith('ss')) { /* keep */ }
  else if (w.endsWith('s')) w = w.slice(0, -1)

  // step 1b
  let step1bDidWork = false
  if (w.endsWith('eed')) {
    if (measure(w.slice(0, -3)) > 0) w = w.slice(0, -1)
  } else if (w.endsWith('ed') && hasVowel(w.slice(0, -2))) {
    w = w.slice(0, -2); step1bDidWork = true
  } else if (w.endsWith('ing') && hasVowel(w.slice(0, -3))) {
    w = w.slice(0, -3); step1bDidWork = true
  }
  if (step1bDidWork) {
    if (w.endsWith('at') || w.endsWith('bl') || w.endsWith('iz')) w += 'e'
    else if (endsDoubleConsonant(w) && !'lsz'.includes(w[w.length - 1])) w = w.slice(0, -1)
    else if (measure(w) === 1 && endsCVC(w)) w += 'e'
  }

  // step 1c
  if (w.endsWith('y') && hasVowel(w.slice(0, -1))) w = w.slice(0, -1) + 'i'

  // step 2
  for (const [suf, rep] of STEP2) {
    if (w.endsWith(suf)) {
      if (measure(w.slice(0, -suf.length)) > 0) w = w.slice(0, -suf.length) + rep
      break
    }
  }

  // step 3
  for (const [suf, rep] of STEP3) {
    if (w.endsWith(suf)) {
      if (measure(w.slice(0, -suf.length)) > 0) w = w.slice(0, -suf.length) + rep
      break
    }
  }

  // step 4
  for (const suf of STEP4) {
    if (w.endsWith(suf)) {
      const base = w.slice(0, -suf.length)
      if (measure(base) > 1) w = base
      break
    }
  }
  if (w.endsWith('ion')) {
    const base = w.slice(0, -3)
    if (measure(base) > 1 && (base.endsWith('s') || base.endsWith('t'))) w = base
  }

  // step 5a
  if (w.endsWith('e')) {
    const base = w.slice(0, -1)
    const m = measure(base)
    if (m > 1 || (m === 1 && !endsCVC(base))) w = base
  }

  // step 5b
  if (measure(w) > 1 && endsDoubleConsonant(w) && w.endsWith('l')) w = w.slice(0, -1)

  return w
}

/* ── tokenisation ─────────────────────────────────────────────────────────── */

// Postgres' default parser splits on everything that is not a letter or digit,
// EXCEPT for a handful of compound token types that it emits whole and hands to
// the `simple` dictionary (lower-case, never stemmed). That matters twice over:
// such a token counts as ONE word against MaxWords, and it is not word-split, so
// the source never puts a <mark> on `machine` inside
// `.../managing-machine-learning-projects`.
//
// The token types below were all read out of the container with `ts_debug`,
// not guessed:
//
//   url       https://www.bookshop.org/lists/x  -> nested host + url_path
//   email     a@b.com
//   float     4.6   -3.5      (`$4.6M` is float `4.6` + asciiword `M`)
//   version   1.2.3
//   host      bookshop.org  node.js  a.bc  e-commerce.com  end.Next
//   file      u.s  u.s.a  e.g  abc.d  a.b.c.d.e   and  /GPT-3.5  /path
//   int       -4    (`GPT-4` is asciiword `GPT` + int `-4`; `5-year` is
//                    uint `5` + asciiword `year` — the sign only binds digits)
//   uint/word 4  GPT  machine
//
// host and file differ only in whether the last label is >= 2 characters; both
// produce one `simple` lexeme, so one branch covers the dotted form. A second
// branch covers the slash-led file form:
//
//   ts_debug('english', 'with GPT-4/GPT-3.5 here')
//     asciiword GPT  ·  int -4  ·  file /GPT-3.5  ·  asciiword here
//
// which is why the source marks `<b>GPT</b><b>-4</b>/GPT-3.5` and leaves the
// second `GPT` bare. (The parser also folds `AI/machine` and `r/books` into one
// file token; this branch splits them as word + `/machine`. Both halves stay
// opaque, so the <mark> set is the same — only the MaxWords count differs, and
// no calibrated record exercises it.)
//
// Alternation order is url, email, float/version, host+file, /file, int, word —
// float/version has to precede host+file so `$4.6M` stops at `4.6` instead of
// swallowing the `M`, and the hyphen inside a host label is barred from being
// followed by a digit so `gpt-4.5` parses as `gpt` + float `-4.5`, exactly as
// the container does.
const HOST_LABEL = '[\\p{L}\\p{N}](?:[\\p{L}\\p{N}]|-(?!\\p{N}))*'
const TOKEN_RE = new RegExp(
  '(https?:\\/\\/[^\\s<>"\')\\]]+)' +
  '|([\\p{L}\\p{N}][\\p{L}\\p{N}._%+-]*@[\\p{L}\\p{N}][\\p{L}\\p{N}.-]*\\.[a-z]{2,24})' +
  '|(-?\\p{N}+(?:\\.\\p{N}+)+)' +
  `|((?:${HOST_LABEL}\\.)+${HOST_LABEL}(?:\\/[^\\s<>"')\\]]*)?)` +
  '|(\\/[\\p{L}\\p{N}][\\p{L}\\p{N}._-]*)' +
  '|(-\\p{N}+)' +
  '|([\\p{L}\\p{N}]+)',
  'gu'
)

const PROTOCOL_RE = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * The lexemes a url/email/host token contributes, with the span each covers.
 *
 * These tokens are opaque to the stemmer but they are NOT single lexemes — the
 * parser nests them. Measured on the container:
 *
 *   ts_debug('english', 'https://www.bookshop.org/lists/x')
 *     protocol 'https://'                 -> (no lexeme)
 *     url      'www.bookshop.org/lists/x' -> {www.bookshop.org/lists/x}
 *     host     'www.bookshop.org'         -> {www.bookshop.org}
 *     url_path '/lists/x'                 -> {/lists/x}
 *
 * and ts_headline marks whichever nested token the query matched, which is why
 *
 *   ts_headline('go to https://bookshop.org/x now', plainto_tsquery('bookshop.org'))
 *     -> 'go to https://<b>bookshop.org</b>/x now'
 *
 * highlights the host only, protocol and path left outside the <b>. Lexemes are
 * lower-cased and never stemmed, so `Bookshop.ORG` matches a `bookshop.org`
 * query; a bare word query can never match one of these (every lexeme here
 * contains a `.`, `/` or `@`, which no Porter stem does). That last property is
 * what makes this safe: it cannot change the output of any word-only query.
 */
function opaqueLexemes(word, base) {
  const proto = (PROTOCOL_RE.exec(word) || [''])[0]
  const rest = word.slice(proto.length)
  const off = base + proto.length
  if (!rest) return []
  const slash = rest.indexOf('/')
  const out = [{ lex: rest.toLowerCase(), start: off, end: off + rest.length }]
  if (slash > 0) {
    out.push({ lex: rest.slice(0, slash).toLowerCase(), start: off, end: off + slash })
    out.push({ lex: rest.slice(slash).toLowerCase(), start: off + slash, end: off + rest.length })
  }
  return out
}

export function tokenize(text) {
  const out = []
  const re = new RegExp(TOKEN_RE.source, TOKEN_RE.flags)
  let m
  while ((m = re.exec(text)) !== null) {
    const opaque = m[7] === undefined
    const t = { w: m[0], start: m.index, end: m.index + m[0].length, opaque }
    // `email` (2), `float`/`version` (3), slash-led `file` (5) and `int` (6)
    // are each a single `simple` lexeme; `url` (1) and dotted `host`/`file` (4)
    // nest. Word tokens (7) stem lazily.
    t.lexemes = !opaque
      ? null
      : (m[2] !== undefined || m[3] !== undefined || m[5] !== undefined || m[6] !== undefined
          ? [{ lex: m[0].toLowerCase(), start: t.start, end: t.end }]
          : opaqueLexemes(m[0], t.start))
    out.push(t)
  }
  return out
}

/** plainto_tsquery(): tokenise, drop stop words, stem, keep order, dedupe. */
export function queryStems(query) {
  const seen = new Set()
  for (const t of tokenize(String(query || ''))) {
    if (t.opaque) {
      // plainto_tsquery('https://www.bookshop.org/lists/x') yields all three
      // nested lexemes ANDed, so the query carries all of them.
      for (const l of t.lexemes) seen.add(l.lex)
      continue
    }
    const lower = t.w.toLowerCase()
    if (STOPWORDS.has(lower)) continue
    seen.add(stem(lower))
  }
  return seen
}

/**
 * The span of `t` that a <mark> should cover, or null when `t` does not match.
 * Word tokens mark whole; opaque tokens mark the outermost nested lexeme that
 * the query matched (url before host before url_path — the parser's order).
 */
function matchSpan(t, stems) {
  if (!stems || stems.size === 0) return null
  if (!t.opaque) {
    const st = stem(t.w.toLowerCase())
    return stems.has(st) ? { start: t.start, end: t.end, lex: st } : null
  }
  for (const l of t.lexemes) if (stems.has(l.lex)) return { start: l.start, end: l.end, lex: l.lex }
  return null
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/** Escape `text[from..to)`, wrapping every token whose stem is in `stems`. */
function markRange(text, tokens, from, to, stems) {
  let out = ''
  let cursor = from
  for (const t of tokens) {
    if (t.end <= from) continue
    if (t.start >= to) break
    out += escapeHtml(text.slice(cursor, t.start))
    const hit = matchSpan(t, stems)
    if (hit) {
      out += escapeHtml(text.slice(t.start, hit.start))
      out += `<mark>${escapeHtml(text.slice(hit.start, hit.end))}</mark>`
      out += escapeHtml(text.slice(hit.end, t.end))
    } else {
      out += escapeHtml(text.slice(t.start, t.end))
    }
    cursor = t.end
  }
  out += escapeHtml(text.slice(cursor, to))
  return out
}

/** ts_headline(…, 'HighlightAll=TRUE') — the whole string, every match marked. */
export function highlightAll(text, stems) {
  const s = String(text || '')
  if (!s) return ''
  if (!stems || stems.size === 0) return escapeHtml(s)
  return markRange(s, tokenize(s), 0, s.length, stems)
}

/**
 * Twig's `{% apply spaceless %}` around `submission_title` — it removes
 * whitespace BETWEEN tags, which is why the source renders
 * `<mark>machine</mark><mark>learning</mark>` (no space) in a search-result
 * title but keeps the space in a body excerpt.
 */
export function spaceless(html) {
  return String(html).replace(/>\s+</g, '><')
}

/** ts_headline(…, 'MaxFragments=3') — up to 3 windows joined by ' ... '. */
export function headlineExcerpt(text, stems) {
  const s = String(text || '')
  if (!s.trim()) return ''
  const toks = tokenize(s)
  if (toks.length === 0) return ''

  const isShort = (i) => toks[i].w.length <= SHORT_WORD
  const slice = (from, to) => markRange(s, toks, toks[from].start, toks[to].end, stems)

  const matches = []
  const matchStem = []
  if (stems && stems.size > 0) {
    for (let i = 0; i < toks.length; i++) {
      const hit = matchSpan(toks[i], stems)
      if (hit) { matches.push(i); matchStem.push(hit.lex) }
    }
  }

  // No match anywhere in the document -> ts_headline falls back to the head of
  // the document, MinWords long, starting at character 0 (which is why a body
  // of exactly `[removed]` comes back with its brackets intact).
  const headFallback = () => {
    if (toks.length <= MIN_WORDS) return markRange(s, toks, 0, s.length, stems)
    let end = MIN_WORDS - 1
    while (end > 0 && isShort(end)) end--
    return markRange(s, toks, 0, toks[end].end, stems)
  }
  if (matches.length === 0) return headFallback()

  // hlCover() only yields a fragment where a *cover* — a window holding EVERY
  // query lexeme — exists, which is why `machine learning` produces one
  // fragment for submission 82395 (its body says "machine" once) but three for
  // 104061 (one very long cover that gets chopped into windows). Anchor
  // fragments on matches that fall inside a minimal cover; a match outside
  // every cover never starts a fragment of its own.
  const anchorable = new Set()
  if (stems.size === 1) {
    for (let j = 0; j < matches.length; j++) anchorable.add(j)
  } else {
    const counts = new Map()
    let distinct = 0
    let l = 0
    for (let r = 0; r < matches.length; r++) {
      const st = matchStem[r]
      counts.set(st, (counts.get(st) || 0) + 1)
      if (counts.get(st) === 1) distinct++
      while (distinct === stems.size) {
        for (let j = l; j <= r; j++) anchorable.add(j)
        const out = matchStem[l]
        counts.set(out, counts.get(out) - 1)
        if (counts.get(out) === 0) distinct--
        l++
      }
    }
  }
  // Some query terms match but no window holds them ALL: hlCover() yields no
  // cover, so ts_headline emits no fragment and drops through to the same
  // head-of-document fallback as a document with no match at all — it does NOT
  // fall back to a fragment around the partial match. Measured on the container
  // against submission 18454 (`deep/machine learning`, where the parser folds
  // `deep/machine` into one file token so the `machin` lexeme is absent):
  //
  //   ts_headline(body, plainto_tsquery('machine learning'), 'MaxFragments=3')
  //     -> 'I''ve been looking into getting a new laptop for personal use as well as'
  //        (the first MinWords, unmarked)
  if (anchorable.size === 0) return headFallback()

  const frags = []
  let used = 0
  let floor = 0
  while (frags.length < MAX_FRAGMENTS && used < matches.length) {
    if (!anchorable.has(used)) { used++; continue }
    const first = matches[used]
    // Grow the cover rightwards while it still fits and still adds new terms.
    let lastMatch = first
    const seen = new Set([matchStem[used]])
    let j = used + 1
    while (
      j < matches.length &&
      matches[j] - first < MAX_WORDS &&
      seen.size < stems.size
    ) {
      lastMatch = matches[j]
      seen.add(matchStem[j])
      j++
    }

    const coverLen = lastMatch - first + 1
    let start = Math.round(first - (MAX_WORDS - coverLen) / 2)
    if (start < floor) start = floor
    while (start < first && isShort(start)) start++
    let end = Math.min(toks.length - 1, start + MAX_WORDS - 1)
    while (end > lastMatch && isShort(end)) end--

    frags.push(slice(start, end))
    floor = end + 1
    while (used < matches.length && matches[used] <= end) used++
  }

  return frags.join(FRAGMENT_DELIMITER)
}
