#!/usr/bin/env python3
"""
capture_listings.py — extend the pre-captured listing corpus from the live
WebArena Magento container.

Why this exists
---------------
`src/data/listings.json` holds real, source-observed listing snapshots: the
toolbar count, the page-1 product ids in source order, and the full layered-nav
facet block with its counts. `src/utils/catalog.js` prefers those snapshots over
anything derived from the 1 105-product seed sample, so a captured URL is exact
and an uncaptured one is only an approximation over the sample.

TEST.md DIFF-101 / DIFF-102 were both instances of that gap:
  /electronics/headphones.html?price=0-100  → source 567, derived 35
  /catalogsearch/result/?q=hair+dryer       → source 9037, derived 31

The fix is to capture more and guess less. This script enumerates the listing
URLs a WebArena agent can actually reach and captures each one:

  1. every layered-nav facet href advertised by an already-captured listing
     (Category and Price groups) — i.e. every URL reachable by *one click* from
     a page we already hold, including the price ranges the nav itself offers
  2. `?price=` on every captured category path, for the ranges ROUTES.md and
     assets/dumps/task_urls.txt actually use (`0-100`, `0-1000`, `200-300`,
     `0-10,0-100`, `20-30,0-100`, `100-200`, `1000-`)
  3. `/catalogsearch/result/?q=<term>` for every term in
     `src/data/searchTerms.json` (the 60 terms /search/term/popular/ links to)
     plus the search terms named in ROUTES.md / TEST.md
  4. every listing URL in `assets/dumps/task_urls.txt`

Read-only: GETs against the container, nothing else. Never writes to the source.

Outputs (idempotent, additive — already-captured URLs are skipped):
  assets/dumps/listings.json          raw parse records (build_seed.py's input)
  assets/dumps/listing_url_map.json   slug -> url map (build_seed.py's input)
  src/data/listings.json              the seed the app imports

The record shape and the src/data projection are kept byte-compatible with
`build_seed.py`'s listings section, so re-running build_seed.py reproduces the
same file rather than clobbering these captures.

Usage:
    python3 assets/dumps/capture_listings.py            # capture + write
    python3 assets/dumps/capture_listings.py --dry-run  # print the plan only
    python3 assets/dumps/capture_listings.py --limit 50 # cap the fetch count
"""

import argparse
import html
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

BASE = os.environ.get("WEBARENA_SHOPPING_URL", "http://10.186.197.203:7770")
HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.dirname(os.path.dirname(HERE))
DUMPS = HERE
SEED = os.path.join(MOCK, "src", "data")
HTML_CACHE = os.environ.get("LISTING_HTML_CACHE", "/tmp/recon/shopping/listings2")

# Price ranges that appear in real WebArena task start URLs (task_urls.txt) or
# in ROUTES.md's query-parameter table. Applied to every captured category path.
TASK_PRICE_RANGES = [
    "0-100",
    "0-1000",
    "200-300",
    "0-10%2C0-100",
    "20-30%2C0-100",
    "100-200",
    "1000-",
]

# Search terms named in ROUTES.md / TEST.md that are not in searchTerms.json.
EXTRA_TERMS = [
    "hair dryer",
    "headphones",
    "hair",
    "dryer",
    "toothpaste",
    "usb wifi",
    "ugreen",
    "table lamp",
    "lamp",
    "shoes",
    "chairs",
    "office chair",
    "monitor",
    "keyboard",
    "mouse",
    "coffee",
    "backpack",
    "water bottle",
    "yoga mat",
]


# --------------------------------------------------------------------------- #
# parsing (same extraction as assets/dumps/parse_listing.py, kept in sync)
# --------------------------------------------------------------------------- #

def txt(s):
    s = re.sub(r"<script.*?</script>", "", s, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    return html.unescape(re.sub(r"\s+", " ", s)).strip()


def parse_html(s, fname):
    out = {"file": fname}
    m = re.search(r'<span class="base" data-ui-id="page-title-wrapper"[^>]*>(.*?)</span>', s, re.S)
    out["title"] = txt(m.group(1)) if m else None
    m = re.search(r'<p class="toolbar-amount"[^>]*>(.*?)</p>', s, re.S)
    out["toolbar_amount"] = txt(m.group(1)) if m else None

    prods = []
    m = re.search(r'<ol class="products list items product-items">(.*?)</ol>', s, re.S)
    if m:
        for it in re.split(r'(?=<li class="item product product-item")', m.group(1))[1:]:
            pid = re.search(r'id="product-item-info_(\d+)"', it)
            link = re.search(r'class="product-item-link"\s*\n?\s*href="([^"]+)"[^>]*>\s*(.*?)\s*</a>', it, re.S)
            price = re.search(r'data-price-amount="([\d.]+)"', it)
            rating = re.search(r'id="rating-result_\d+"\s*\n?\s*title="(\d+)%"', it)
            nrev = re.search(r'#reviews">(\d+)\s', it)
            sku = re.search(r'data-product-sku="([^"]+)"', it)
            img = re.search(r'class="product-image-photo"\s*\n?\s*src="([^"]+)"', it)
            prods.append({
                "id": int(pid.group(1)) if pid else None,
                "url_key": link.group(1).rsplit("/", 1)[-1].replace(".html", "") if link else None,
                "name": html.unescape(txt(link.group(2))) if link else None,
                "price": float(price.group(1)) if price else None,
                "rating_pct": int(rating.group(1)) if rating else None,
                "review_count": int(nrev.group(1)) if nrev else 0,
                "sku": sku.group(1) if sku else None,
                "image": img.group(1).split("/product/")[-1] if img else None,
            })
    out["products"] = prods

    m = re.search(r'<select id="sorter"[^>]*>(.*?)</select>', s, re.S)
    out["sorter"] = [{"value": v, "label": txt(l), "selected": "selected" in a}
                     for v, a, l in re.findall(r'<option value="([^"]+)"(.*?)>(.*?)</option>', m.group(1), re.S)] if m else []
    m = re.search(r'<select id="limiter"[^>]*>(.*?)</select>', s, re.S)
    out["limiter"] = [{"value": v, "label": txt(l), "selected": "selected" in a}
                      for v, a, l in re.findall(r'<option value="([^"]+)"(.*?)>(.*?)</option>', m.group(1), re.S)] if m else []
    m = re.search(r'data-role="direction-switcher"\s*\n?\s*data-value="(\w+)"', s)
    out["sort_dir_next"] = m.group(1) if m else None

    filters = []
    nb = re.search(r'<dl class="filter-options" id="narrow-by-list">(.*?)</dl>', s, re.S)
    if nb:
        parts = re.split(r'<dt[^>]*class="filter-options-title"[^>]*>', nb.group(1))[1:]
        for part in parts:
            name = txt(part.split("</dt>")[0])
            body = part.split("</dt>", 1)[1] if "</dt>" in part else ""
            opts = []
            for om in re.finditer(r'<a\s+href="([^"]+)"[^>]*>(.*?)</a>', body, re.S):
                lbl = txt(om.group(2))
                cnt = re.search(r"(\d+)\s*item", lbl)
                opts.append({
                    "href": om.group(1).replace(BASE, ""),
                    "label": re.sub(r"\s*\d+\s*items?$", "", lbl).strip(),
                    "count": int(cnt.group(1)) if cnt else None,
                })
            if name:
                filters.append({"name": name, "options": opts[:40]})
    out["filters"] = filters

    cur = []
    for cm in re.finditer(r'<span class="filter-label">(.*?)</span>\s*<span class="filter-value">(.*?)</span>', s, re.S):
        cur.append({"label": txt(cm.group(1)), "value": txt(cm.group(2))})
    out["current_filters"] = cur
    out["pages"] = sorted(set(re.findall(r"[?&]p=(\d+)", s)))
    # A filter combination with no matches renders neither a toolbar nor a grid,
    # just `<div class="message info empty">We can't find products matching the
    # selection.</div>` (search uses "Your search returned no results."). Record
    # that as an observed zero rather than as "unknown" — it is a real answer.
    out["empty"] = bool(re.search(r'class="message info empty"', s)) or \
        "Your search returned no results" in s
    return out


# --------------------------------------------------------------------------- #
# url handling
# --------------------------------------------------------------------------- #

def slug_for(url):
    """Same slug rule as fetch_listings.sh, so the two corpora interleave."""
    return re.sub(r"[^A-Za-z0-9]", "_", url)[:90] + ".html"


def canonical(url):
    """
    Dedupe key: path + query params sorted, values percent-decoded.
    `?cat=140&price=20-30%2C0-100` and `?price=20-30,0-100&cat=140` are the
    same page on the source, so they must not be captured twice.
    """
    u = html.unescape(url)
    pu = urllib.parse.urlsplit(u)
    q = sorted(urllib.parse.parse_qsl(pu.query, keep_blank_values=True))
    path = pu.path
    if path in ("/catalogsearch/result/index", "/catalogsearch/result/index/", "/catalogsearch/result"):
        path = "/catalogsearch/result/"
    return path + "?" + urllib.parse.urlencode(q)


def fetch(url, retries=2):
    """Plain GET against the container. No proxy, no cookies, read-only."""
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for attempt in range(retries + 1):
        try:
            with opener.open(BASE + url, timeout=60) as r:
                return r.read().decode("utf8", errors="replace")
        except Exception as e:  # noqa: BLE001 - report and move on
            if attempt == retries:
                print("  FETCH FAILED %s: %s" % (url, e), file=sys.stderr)
                return None
            time.sleep(1.0)
    return None


# --------------------------------------------------------------------------- #
# enumeration
# --------------------------------------------------------------------------- #

def enumerate_targets(existing_listings):
    """Return an ordered, deduped list of listing URLs worth capturing."""
    targets = []
    seen = set()

    def add(url, reason):
        key = canonical(url)
        if key in seen:
            return
        seen.add(key)
        targets.append((url, reason))

    # (4) real WebArena task start URLs.
    #
    # Every generation of the file: `task_urls.txt` was derived from
    # webarena.jsonl alone, so all 479 visualwebarena shopping tasks -- which is
    # where the tile-position questions live ("the brown box in the bottom row")
    # -- contributed no capture targets at all. `task_urls.vwa.txt` is generated
    # by `anchor_sweep.py --emit-task-urls` over BOTH files.
    #
    # The bare-`.html` rule below used to drop every category landing page as
    # "a product detail page", which is only true for slugs that are not
    # categories. `visualwebarena-67` starts on
    # /beauty-personal-care/hair-care/hair-coloring-products.html and asks about
    # "the second product in the first row", so that page has to be captured,
    # not derived.
    import glob as _glob
    try:
        cat_slugs = {c["urlPath"] for c in
                     json.load(open(os.path.join(SEED, "categories.json"), encoding="utf8"))}
    except Exception:
        cat_slugs = set()
    for task_file in sorted(_glob.glob(os.path.join(DUMPS, "task_urls.txt"))
                            + _glob.glob(os.path.join(DUMPS, "task_urls.*.txt"))):
        for line in open(task_file, encoding="utf8"):
            u = line.strip()
            if not u:
                continue
            if u.startswith(("/sales/", "/customer/", "/checkout", "/wishlist", "/newsletter", "/contact")):
                continue
            path = u.split("?")[0]
            is_cat = path.endswith(".html") and path[1:-5] in cat_slugs
            if ".html?" in u or u.startswith("/catalogsearch/result") or is_cat:
                add(u, "task_url")

    # (1) every facet href advertised by an already-captured listing
    cat_paths = set()
    for l in existing_listings:
        p = l.get("path") or ""
        if p.endswith(".html"):
            cat_paths.add(p)
        for f in l.get("filters", []):
            for o in f.get("options", []):
                href = o.get("href")
                if href:
                    add(html.unescape(href), "facet:%s" % f.get("name"))

    # (2) task-shaped price ranges on every captured category path
    for p in sorted(cat_paths):
        for rng in TASK_PRICE_RANGES:
            add("%s?price=%s" % (p, rng), "price_range")

    # (3) every popular search term + the terms ROUTES/TEST name
    terms = []
    st = os.path.join(SEED, "searchTerms.json")
    if os.path.exists(st):
        terms += [t["queryText"] for t in json.load(open(st, encoding="utf8"))]
    terms += EXTRA_TERMS
    for t in terms:
        add("/catalogsearch/result/?q=" + urllib.parse.quote_plus(t), "search_term")

    return targets


# --------------------------------------------------------------------------- #
# seed projection (must stay identical to build_seed.py's listings section)
# --------------------------------------------------------------------------- #

def parse_amount(s):
    if not s:
        return None
    m = re.search(r"of ([\d,]+)", s)
    if m:
        return int(m.group(1).replace(",", ""))
    m = re.search(r"^(\d+) Item", s)
    return int(m.group(1)) if m else None


def project(records, umap):
    out = []
    for r in records:
        u = umap.get(r["file"])
        if not u:
            continue
        pu = urllib.parse.urlparse(u)
        total = parse_amount(r["toolbar_amount"])
        if total is None and r.get("empty") and not r["products"]:
            total = 0
        out.append({
            "url": u,
            "path": pu.path or "/",
            "query": dict(urllib.parse.parse_qsl(pu.query)),
            "title": r["title"],
            "toolbarAmount": r["toolbar_amount"],
            "totalCount": total,
            "productIds": [p["id"] for p in r["products"] if p["id"]],
            "sorterOptions": r["sorter"],
            "limiterOptions": r["limiter"],
            "sortDirNext": r.get("sort_dir_next"),
            "filters": r["filters"],
            "currentFilters": r.get("current_filters", []),
            "pageLinks": r["pages"],
        })
    return out


def write_all(raw, umap, raw_path, map_path, seed_path):
    json.dump(raw, open(raw_path, "w", encoding="utf8"), indent=1)
    json.dump(umap, open(map_path, "w", encoding="utf8"), indent=1, sort_keys=True)
    listings = project(raw, umap)
    # Drop exact duplicates (same canonical url), keeping the first capture.
    seen = set()
    deduped = []
    for l in listings:
        k = canonical(l["url"])
        if k in seen:
            continue
        seen.add(k)
        deduped.append(l)
    json.dump(deduped, open(seed_path, "w", encoding="utf8"), separators=(",", ":"))
    print("src/data/listings.json: %d listings, %.1f KB"
          % (len(deduped), os.path.getsize(seed_path) / 1024))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--only", default="", help="substring filter on the reason tag")
    ap.add_argument("--reparse", action="store_true",
                    help="re-parse every already-captured page whose HTML is still in "
                         "LISTING_HTML_CACHE and rewrite the seed; no network")
    ap.add_argument("--plan", action="store_true",
                    help="print '<cache-file>\\t<url>' for every target and exit; feed it to "
                         "`xargs -P8` to warm LISTING_HTML_CACHE in parallel, then re-run "
                         "without --plan to parse the cache offline")
    args = ap.parse_args()

    os.makedirs(HTML_CACHE, exist_ok=True)

    raw_path = os.path.join(DUMPS, "listings.json")
    map_path = os.path.join(DUMPS, "listing_url_map.json")
    seed_path = os.path.join(SEED, "listings.json")

    raw = json.load(open(raw_path, encoding="utf8"))
    umap = json.load(open(map_path, encoding="utf8"))
    seed = json.load(open(seed_path, encoding="utf8"))

    if args.reparse:
        by_file = {r["file"]: r for r in raw}
        n = 0
        for fname in list(by_file):
            cache = os.path.join(HTML_CACHE, fname)
            if not (os.path.exists(cache) and os.path.getsize(cache) > 1000):
                continue
            body = open(cache, encoding="utf8", errors="replace").read()
            by_file[fname] = parse_html(body, fname)
            n += 1
        raw = [by_file[r["file"]] for r in raw]
        print("re-parsed %d cached pages" % n)
        write_all(raw, umap, raw_path, map_path, seed_path)
        return

    have = {canonical(u) for u in umap.values() if u}
    targets = [t for t in enumerate_targets(seed) if canonical(t[0]) not in have]
    if args.only:
        targets = [t for t in targets if args.only in t[1]]
    if args.limit:
        targets = targets[:args.limit]

    if args.plan:
        used = set(umap)
        for i, (url, _) in enumerate(targets, 1):
            fname = slug_for(url)
            while fname in used:
                fname = slug_for(url)[:-5] + "__%d.html" % i
            used.add(fname)
            print("%s\t%s%s" % (os.path.join(HTML_CACHE, fname), BASE, url))
        return

    by_reason = {}
    for _, reason in targets:
        by_reason[reason] = by_reason.get(reason, 0) + 1
    print("already captured : %d" % len(have))
    print("new targets      : %d  %s" % (len(targets), by_reason))
    if args.dry_run:
        for u, r in targets[:40]:
            print("  %-14s %s" % (r, u))
        return

    added = 0
    failed = 0
    for i, (url, reason) in enumerate(targets, 1):
        fname = slug_for(url)
        # 90-char truncation makes long search URLs collide; keep them distinct.
        while fname in umap:
            fname = slug_for(url)[:-5] + "__%d.html" % i
        cache = os.path.join(HTML_CACHE, fname)
        if os.path.exists(cache) and os.path.getsize(cache) > 1000:
            body = open(cache, encoding="utf8", errors="replace").read()
        else:
            body = fetch(url)
            if body is None:
                failed += 1
                continue
            open(cache, "w", encoding="utf8").write(body)
        rec = parse_html(body, fname)
        if rec["toolbar_amount"] is None and not rec["products"]:
            # A genuinely empty result set (Magento renders no toolbar at all).
            # Still worth recording: it is the source's real answer.
            rec["toolbar_amount"] = None
        raw.append(rec)
        umap[fname] = url
        added += 1
        if i % 50 == 0:
            print("  %d/%d captured" % (i, len(targets)))

    print("captured %d, failed %d" % (added, failed))
    write_all(raw, umap, raw_path, map_path, seed_path)


if __name__ == "__main__":
    main()
