#!/usr/bin/env python3
"""
build_search_terms.py — re-extract src/data/searchTerms.json from the source.

Why this exists (TEST.md DIFF-208)
----------------------------------
The original seed query took `search_query` ordered by popularity with no
predicate, so it picked up 10 terms that appear on NO source page:
`asdfghjkl`, `chairs`, `xbox controller`, `wireless earphone`, … Magento's
popular-terms block (`Magento\\Search\\Block\\Term`) filters the collection with

    WHERE num_results > 0 AND display_in_terms = 1
    ORDER BY popularity DESC
    LIMIT 100                       -- Block\\Term::_loadTerms(), setPageSize(100)

and only then sorts the 100 survivors alphabetically for display. The terms the
old seed invented all have `num_results = 0` or `display_in_terms = 0`.

Reproducing that SQL is not quite enough on its own: 60-odd terms tie at
popularity 1, so `ORDER BY popularity DESC LIMIT 100` is non-deterministic at
the cut line and MySQL hands back a different 100 than the page renders (12 of
100 differ). So the *rendered page* is the ground truth for **which** terms are
in, and the DB supplies `popularity` / `num_results` for each — the numbers the
font-size ramp and the header autocomplete need.

Read-only: one GET against the container plus SELECTs. Never writes to source.

Usage:  python3 assets/dumps/build_search_terms.py [--check]
"""

import argparse
import html
import json
import os
import re
import subprocess
import sys
import urllib.request

BASE = os.environ.get("WEBARENA_SHOPPING_URL", "http://localhost:7770")
CONTAINER = os.environ.get("WEBARENA_SHOPPING_CONTAINER", "shopping")
HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.dirname(os.path.dirname(HERE))
OUT = os.path.join(MOCK, "src", "data", "searchTerms.json")


def fetch_rendered_terms():
    """(query_id, query_text) for every <li id="term-N"> on /search/term/popular/."""
    req = urllib.request.Request(
        BASE + "/search/term/popular/", headers={"User-Agent": "recon"})
    with urllib.request.urlopen(req, timeout=30) as r:
        page = r.read().decode("utf-8", "replace")
    m = re.search(r'<ul class="search-terms">(.*?)</ul>', page, re.S)
    if not m:
        sys.exit("no <ul class=\"search-terms\"> on /search/term/popular/")
    out = []
    for li in re.finditer(
            r'<li id="term-(\d+)"[^>]*>\s*<a[^>]*>(.*?)</a>', m.group(1), re.S):
        text = html.unescape(re.sub(r"\s+", " ", li.group(2))).strip()
        out.append((int(li.group(1)), text))
    return out


def fetch_db_rows():
    """query_id -> (query_text, num_results, popularity) for the popular set."""
    sql = ("SELECT query_id, popularity, num_results, query_text FROM search_query "
           "WHERE num_results > 0 AND display_in_terms = 1;")
    p = subprocess.run(
        ["docker", "exec", CONTAINER, "mysql", "-u", "magentouser",
         "-pMyPassword", "magentodb", "-N", "--raw", "-e", sql],
        capture_output=True, text=True)
    if p.returncode:
        sys.exit("mysql failed: " + p.stderr.strip())
    rows = {}
    for line in p.stdout.splitlines():
        if not line.strip():
            continue
        qid, pop, nres, text = line.split("\t", 3)
        rows[int(qid)] = (text, int(nres), int(pop))
    return rows


def build():
    rendered = fetch_rendered_terms()
    db = fetch_db_rows()
    terms = []
    for qid, text in rendered:
        if qid not in db:
            sys.exit(f"term-{qid} ({text!r}) rendered but not in the filtered "
                     f"collection — the predicate above is wrong")
        db_text, num_results, popularity = db[qid]
        # The page truncates nothing, but it does HTML-escape; trust the DB for
        # the literal string and assert the two agree.
        if db_text != text:
            sys.exit(f"term-{qid}: page {text!r} != db {db_text!r}")
        terms.append({
            "queryId": qid,
            "queryText": db_text,
            "numResults": num_results,
            "popularity": popularity,
        })
    # Stored popularity-desc (query_id asc within a tie) because SearchPage's
    # "Related search terms" and the header autocomplete both read the head of
    # this array; SearchTermsPage re-sorts alphabetically itself.
    terms.sort(key=lambda t: (-t["popularity"], t["queryId"]))
    return terms


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--check", action="store_true",
                    help="compare against the committed seed, write nothing")
    args = ap.parse_args()
    terms = build()
    if args.check:
        cur = json.load(open(OUT))
        cur_t = {t["queryText"] for t in cur}
        new_t = {t["queryText"] for t in terms}
        print(f"seed {len(cur)} terms, source {len(terms)} terms")
        print("in seed but NOT on source page:", sorted(cur_t - new_t))
        print("on source page but NOT in seed:", sorted(new_t - cur_t))
        return
    with open(OUT, "w") as f:
        json.dump(terms, f, indent=1)
        f.write("\n")
    print(f"wrote {OUT}: {len(terms)} terms "
          f"(popularity {min(t['popularity'] for t in terms)}"
          f"..{max(t['popularity'] for t in terms)})")


if __name__ == "__main__":
    main()
