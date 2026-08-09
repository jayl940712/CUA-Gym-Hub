import json,re,sys

# The mock must work fully offline (WEBARENA_MIGRATION.md §1 forbids "any
# runtime network call"), so no absolute-http reference may survive into
# src/data/productDescriptions.json in ANY form. The raw Magento description
# blobs are Amazon A+ marketing markup and carry five distinct forms:
#
#   6090  <img src="https://…"> / <source src>
#   2622  <img data-src="https://…">
#     48  URLs inside <script> blocks (airyAssetConfig)
#     13  CSS  style='background-image: url("https://…")'
#      6  <link href="https://…">
#
# Element removal alone misses the last two, so each is handled explicitly and
# a generic attribute sweep catches anything not enumerated here.

_VOID_MEDIA = 'img|source|track|embed|link|input'
_PAIRED_MEDIA = 'video|iframe|audio|object|picture'
_ABS_URL = re.compile(r'^\s*(?:https?:)?//', re.I)

# Attributes the browser fetches. `href` is safe to include because within a
# description it is only ever reached via <link> (stylesheet/preload); <a> is
# not in either media list, so ordinary text links are untouched.
_FETCH_ATTRS = ('src', 'srcset', 'data-src', 'data-a-dynamic-image', 'data-a-hires',
                'data-old-hires', 'poster', 'data', 'background', 'lowsrc',
                'href', 'xlink:href')
_ATTR_RE = re.compile(
    r'\s(?:%s)\s*=\s*("([^"]*)"|\'([^\']*)\')' % '|'.join(re.escape(a) for a in _FETCH_ATTRS),
    re.I)

def _attr_values(tag):
    for m in _ATTR_RE.finditer(tag):
        yield m.group(2) if m.group(2) is not None else m.group(3)

def _has_remote(tag):
    return any(_ABS_URL.match(v) for v in _attr_values(tag))

def strip_code_blocks(v):
    # <script>/<style>/<noscript> never render through innerHTML, but their
    # source text leaks into the plain-text extraction used by list tiles and
    # the compare table — and carries absolute URLs.
    v = re.sub(r'<(script|style|noscript)\b[^>]*>.*?</\1\s*>', '', v, flags=re.I | re.S)
    v = re.sub(r'<(?:script|style|noscript)\b[^>]*>.*$', '', v, flags=re.I | re.S)
    return v

def strip_remote_css(v):
    # CSS url() inside a style attribute fetches exactly like <img src>.
    # Neutralise only the URL so sibling declarations (background-color,
    # position, …) survive.
    v = re.sub(r'url\(\s*["\']?\s*(?:https?:)?//[^)]*\)', 'none', v, flags=re.I)
    v = re.sub(r'@import\s+(?:url\()?\s*["\']?\s*(?:https?:)?//[^;]*;?', '', v, flags=re.I)
    return v

def strip_remote_media(v):
    # paired elements: drop the element and everything it wraps
    def paired(m):
        return '' if _has_remote(m.group(1)) else m.group(0)
    v = re.sub(r'(<(?:%s)\b[^>]*>).*?</(?:%s)\s*>' % (_PAIRED_MEDIA, _PAIRED_MEDIA),
               paired, v, flags=re.I | re.S)
    # void elements
    v = re.sub(r'<(?:%s)\b[^>]*>' % _VOID_MEDIA,
               lambda m: '' if _has_remote(m.group(0)) else m.group(0),
               v, flags=re.I)
    # an unterminated media tag left behind by an upstream truncation
    v = re.sub(r'<(?:%s|%s)\b[^>]*$' % (_VOID_MEDIA, _PAIRED_MEDIA), '', v, flags=re.I)
    return v

def strip_remote_attrs(v):
    # Backstop: any fetching attribute holding an absolute URL, on any element
    # not covered above (e.g. a remote poster on a tag we chose to keep).
    def drop(m):
        val = m.group(2) if m.group(2) is not None else m.group(3)
        return '' if _ABS_URL.match(val) else m.group(0)
    return _ATTR_RE.sub(drop, v)

# Presentational attributes worth dropping — they are pure Amazon page chrome
# and roughly a third of the raw corpus by bytes.
_ATTR_NOISE = re.compile(
    r'\s(?:data-[a-z-]+|class|id|cel[_-]widget(?:_id)?|style)\s*=\s*("([^"]*)"|\'([^\']*)\')',
    re.I)

# …except THIS id. In this Magento build Brand/Manufacturer are not EAV
# attributes: they live in an Amazon-scraped
# <table id="productDetails_detailBullets_sections1"> embedded in the product
# description, and VWA's shopping_get_product_attributes() (6 tasks) reads them
# off the rendered PDP. Stripping `id` indiscriminately is what left 0 of 1 105
# seeded descriptions carrying that hook. It is the only table id in the whole
# corpus (1 452 occurrences, no others), so an exact allow-list is enough.
_KEEP_IDS = ('productdetails_detailbullets_sections1',)


def _drop_noise_attr(m):
    val = m.group(2) if m.group(2) is not None else m.group(3)
    if val and val.strip().lower() in _KEEP_IDS:
        return m.group(0)
    return ''


def clean(v):
    if not v: return ''
    # Remote references go first, while the original attributes are still
    # present to match on.
    v = strip_code_blocks(v)
    v = strip_remote_css(v)
    v = strip_remote_media(v)
    v = strip_remote_attrs(v)
    # drop empty aplus placeholder divs
    v=re.sub(r'<div id="dpx-aplus-[^"]*"[^>]*>\s*</div>','',v)
    v=re.sub(r'<div id="[^"]*_feature_div"[^>]*>','<div>',v)
    # Strip noisy presentational attributes. Both quote styles: the source
    # mixes them, and matching only double quotes is exactly what let
    # style='background-image: url("https://…")' through.
    v=_ATTR_NOISE.sub(_drop_noise_attr, v)
    v=re.sub(r'<div>\s*</div>','',v)
    v=re.sub(r'\s+',' ',v)
    v=re.sub(r'>\s+<','><',v)
    return v.strip()

if __name__=='__main__':
    tot=0;n=0;out={}
    for l in open('descriptions.jsonl'):
        d=json.loads(l); c=clean(d['description']); out[d['entity_id']]=c; tot+=len(c); n+=1
    print('cleaned MB',tot/1e6,'n',n)
    json.dump(out,open('descriptions_clean.json','w'))
    ex=out[76525]; print(len(ex)); print(ex[:800])
