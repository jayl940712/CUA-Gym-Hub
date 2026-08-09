#!/usr/bin/env python3
"""Build the sharded description search index used by `searchSeed()`.

R8-001, last row. An uncaptured `?q=` search used to pull the whole 34.71 MB /
9.35 MB-gz description corpus before it could render, because the fallback
matcher scores raw description text with a word-boundary regex per query token:

    src/utils/catalog.js
      function tokenMatcher(token) {
        const stem = stemToken(token)
        return new RegExp(`\\b${stem}(?:s|es|ies)?\\b`, 'i')
      }
      ... re.test(entry.weak)     // weak = desc.replace(/<[^>]*>/g,' ').toLowerCase()

That predicate is EXACTLY a set-membership test, with no approximation:

  * `stem` is always `[a-z0-9]+` — query tokens come from `tokenize()`, which
    splits on `[^a-z0-9]+`, and `stemToken()` only ever truncates. So the span
    the regex matches is itself entirely word characters.
  * `\b` therefore fires precisely at the two edges of a maximal
    `[A-Za-z0-9_]` run.
  * so the regex is true IFF the text contains a maximal word run whose
    lowercase form is one of four literal strings:
        stem, stem+"s", stem+"es", stem+"ies"

`_` is deliberately part of the run: it is a word character to `\b` even though
`tokenize()` treats it as a separator, so "glass_es" must NOT match `?q=glass`
— and it does not, on either side.

So the document side needs no stemming at all, only its distinct lowercased word
runs, and the right artifact is an INVERTED INDEX: token -> product ids. Sharded
by a prefix hash, an uncaptured search fetches only the buckets its own query
tokens live in — tens of kilobytes — instead of the whole corpus.

All four candidate keys share the token's first `PREFIX_LEN` characters whenever
the stem is at least that long, so prefix bucketing keeps them in one bucket for
almost every real query; `catalog.js` unions the buckets of all four keys, so
the short-stem case is correct too, just with up to 4 requests.

Output
------
`src/searchindex/s00.json` … `s63.json`, each `{token: "<delta base36 ids>"}`.

NOT under `src/data/`: `vite.config.js`'s `manualChunks` folds everything in
`/src/data/` into the always-loaded `seed` chunk unless it has an explicit rule,
and folding 3.2 MB gz of index into the chunk every route waits on is the exact
regression this index exists to undo. Outside `/src/data/` the rule returns
`undefined` and Rollup gives each dynamically-imported shard its own chunk.

Usage
-----
    python3 assets/dumps/build_search_index.py            # build
    python3 assets/dumps/build_search_index.py --check    # verify, no write
"""
import json
import os
import random
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, '..', '..'))
CORPUS = os.path.join(ROOT, 'src', 'data', 'productDescriptions.json')
SHARD_DIR = os.path.join(ROOT, 'src', 'data', 'descriptions')
OUT_DIR = os.path.join(ROOT, 'src', 'searchindex')

BUCKETS = 64
PREFIX_LEN = 3

TAG_RE = re.compile(r'<[^>]*>')
WORD_RE = re.compile(r'[a-z0-9_]+')
DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz'


def bucket_of(key):
    """Must stay byte-identical to `indexBucket()` in src/utils/catalog.js."""
    h = 0
    for ch in key[:PREFIX_LEN]:
        h = (h * 131 + ord(ch)) & 0xFFFFFFFF
    return h % BUCKETS


def b36(n):
    if n == 0:
        return '0'
    out = ''
    while n:
        out = DIGITS[n % 36] + out
        n //= 36
    return out


def weak_text(desc):
    """`entry.weak` in catalog.js, character for character."""
    return TAG_RE.sub(' ', desc or '').lower()


def words_of(desc):
    return set(WORD_RE.findall(weak_text(desc)))


def load_corpus():
    with open(CORPUS, encoding='utf-8') as fh:
        return json.load(fh)


def build_postings(corpus):
    postings = {}
    for pid, desc in corpus.items():
        pid = int(pid)
        for w in words_of(desc):
            postings.setdefault(w, []).append(pid)
    return postings


def encode(ids):
    ids.sort()
    prev = 0
    out = []
    for i in ids:
        out.append(b36(i - prev))
        prev = i
    return '.'.join(out)


def stem_token(t):
    """`stemToken()` in catalog.js, verbatim."""
    if len(t) > 4 and t.endswith('ies'):
        return t[:-3] + 'y'
    if len(t) > 4 and re.search(r'(ches|shes|sses|xes|zes)$', t):
        return t[:-2]
    if len(t) > 3 and t.endswith('s') and not t.endswith('ss') and not t.endswith('us'):
        return t[:-1]
    return t


def candidate_keys(token):
    stem = stem_token(token)
    return [stem, stem + 's', stem + 'es', stem + 'ies']


def check(corpus, postings):
    """Prove the index reproduces the regex, on the real corpus.

    Two independent things are verified:
      1. the merged description shards still equal the corpus this index was
         built from (otherwise the index describes a file nobody loads);
      2. for a large token sample, `index membership == regex match` for EVERY
         product — not a sample of products.
    """
    ok = True

    merged = {}
    for name in sorted(os.listdir(SHARD_DIR)):
        if name.endswith('.json'):
            with open(os.path.join(SHARD_DIR, name), encoding='utf-8') as fh:
                merged.update(json.load(fh))
    if merged == corpus:
        print('shards: merge == productDescriptions.json  (%d entries)' % len(merged))
    else:
        print('shards: MERGE DIFFERS from productDescriptions.json')
        ok = False

    random.seed(20260809)
    vocab = sorted(postings)
    sample = random.sample(vocab, 3000)
    # Plus the shapes a real query is most likely to take.
    sample += ['tea', 'teas', 'chair', 'chairs', 'hair', 'dryer', 'candle',
               'candles', 'headphone', 'headphones', 'box', 'boxes', 'glass',
               'glasses', 'battery', 'batteries', 'usb', 'wifi', 'a', 'i',
               'b091bb3b86', '3', 'watch', 'watches']

    # One concatenated haystack + a bisect over start offsets, so each token is
    # ONE pass over 34 MB instead of 11 358 passes. The separator is '\n' * 4,
    # all non-word characters, so it can never join two products' words into one
    # match or swallow a `\b`.
    import bisect
    pids = sorted(int(p) for p in corpus)
    sep = '\n\n\n\n'
    parts = []
    starts = []
    pos = 0
    for pid in pids:
        text = weak_text(corpus[str(pid)])
        starts.append(pos)
        parts.append(text)
        pos += len(text) + len(sep)
    hay = sep.join(parts)

    bad = 0
    for token in sample:
        keys = candidate_keys(token)
        expect = set()
        for k in keys:
            enc = postings.get(k)
            if enc:
                expect.update(enc)
        stem = stem_token(token)
        # `re.ASCII` is load-bearing, not tidiness: Python's `\b` is Unicode-aware
        # by default, so `\bcaf\b` would NOT fire before the 'é' of "café" —
        # JavaScript's non-unicode `\b` uses [A-Za-z0-9_] only and DOES. Without
        # this flag the check would report divergences the browser never has.
        # IGNORECASE is dropped for the same reason (the haystack is already
        # lowercased, and Python would additionally fold 'ſ' onto 's'; JS's `i`
        # never maps a non-ASCII character onto an ASCII one).
        rx = re.compile(r'\b%s(?:s|es|ies)?\b' % re.escape(stem), re.ASCII)
        actual = set()
        for m in rx.finditer(hay):
            actual.add(pids[bisect.bisect_right(starts, m.start()) - 1])
        if expect != actual:
            bad += 1
            if bad <= 5:
                print('  MISMATCH %r stem=%r index=%d regex=%d sym_diff=%d'
                      % (token, stem, len(expect), len(actual),
                         len(expect ^ actual)))
    print("predicate: %d tokens x %d products, %d mismatches"
          % (len(sample), len(pids), bad))
    ok = ok and bad == 0
    return ok


def main():
    corpus = load_corpus()
    postings = build_postings(corpus)
    print('corpus: %d products, %d distinct tokens, %d postings'
          % (len(corpus), len(postings), sum(len(v) for v in postings.values())))

    if '--check' in sys.argv:
        sys.exit(0 if check(corpus, postings) else 1)

    shards = [dict() for _ in range(BUCKETS)]
    for token, ids in postings.items():
        shards[bucket_of(token)][token] = encode(list(ids))

    os.makedirs(OUT_DIR, exist_ok=True)
    for old in os.listdir(OUT_DIR):
        if re.fullmatch(r's\d\d\.json', old):
            os.remove(os.path.join(OUT_DIR, old))

    total = 0
    for i, shard in enumerate(shards):
        path = os.path.join(OUT_DIR, 's%02d.json' % i)
        blob = json.dumps(dict(sorted(shard.items())), separators=(',', ':'))
        with open(path, 'w', encoding='utf-8') as fh:
            fh.write(blob)
        total += len(blob)
    print('wrote %d shards to %s, %.2f MB raw'
          % (BUCKETS, os.path.relpath(OUT_DIR, ROOT), total / 1e6))


if __name__ == '__main__':
    main()
