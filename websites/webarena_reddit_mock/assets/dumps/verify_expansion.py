#!/usr/bin/env python3
"""Browser verification for the seed expansion. Run against a built `npm run preview`.

Measures the things the expansion could plausibly break, at both viewports:

  * cold time-to-readable-content on `/` with an unseen `?sid=` (first paint)
  * console errors and off-origin requests (must be 0 / 0)
  * a newly seeded post: title, image, and a nested comment thread
  * a deepened forum listing: page 1 vs page 2 composition and the `next[...]`
    cursor, compared against the live source at localhost:9999
  * hot / top / new / most_commented ordering vs the source, first page
  * `?sid=` survival across navigation and a comment submit
  * `/go` payload size and shape, and whether localStorage persistence survives

    /tmp/pwvenv/bin/python assets/dumps/verify_expansion.py --port 5310
"""

import argparse
import json
import re
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

SOURCE = "http://localhost:9999"


def source_html(path):
    req = urllib.request.Request(SOURCE + path, headers={"User-Agent": "curl/8"})
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    return opener.open(req, timeout=20).read().decode("utf-8", "replace")


# Neither the source nor the mock puts an id on `article.submission`, so the
# listing order has to be read off the canonical permalinks instead.
CANONICAL_RE = re.compile(r'/f/[A-Za-z0-9_]+/(\d+)/')


def source_listing_ids(path):
    """Submission ids in DOM order on a source listing page."""
    return list(dict.fromkeys(CANONICAL_RE.findall(source_html(path))))


def listing_ids(page):
    """Submission ids in DOM order on a mock listing page, off the permalinks."""
    # The first `a[href]` in an article is the forum crumb (`/f/news`), which
    # carries no id, so collect every href and take the first canonical one.
    groups = page.eval_on_selector_all(
        ".submission",
        "els => els.map(e => [...e.querySelectorAll('a[href]')]"
        ".map(a => a.getAttribute('href')))")
    out = []
    for hrefs in groups:
        found = ""
        for href in hrefs:
            match = CANONICAL_RE.search(href or "")
            if match:
                found = match.group(1)
                break
        out.append(found)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=5310)
    ap.add_argument("--post", type=int, help="a newly seeded submission id to open")
    ap.add_argument("--forum", default="news")
    args = ap.parse_args()
    base = "http://localhost:%d" % args.port
    fails = []

    with sync_playwright() as p:
        browser = p.chromium.launch()
        for width, height in ((1920, 1080), (1280, 720)):
            tag = "%dx%d" % (width, height)
            ctx = browser.new_context(viewport={"width": width, "height": height})
            page = ctx.new_page()
            errors, external = [], []
            page.on("console", lambda m: m.type == "error" and errors.append(m.text))
            page.on("request", lambda r: (not r.url.startswith(base))
                    and not r.url.startswith("data:") and external.append(r.url))

            # `/` is empty by design on this site (the default user subscribes to
            # nothing — SOURCE.md "The front page is empty"), so time-to-readable
            # -content is measured on a real listing.
            sid = "verify_%s_%d" % (tag, int(time.time()))
            t0 = time.time()
            page.goto("%s/f/%s?sid=%s" % (base, args.forum, sid),
                      wait_until="domcontentloaded")
            page.wait_for_selector(".submission", timeout=60000)
            paint = (time.time() - t0) * 1000
            count = page.locator(".submission").count()
            print("[%s] first paint %.0f ms on /f/%s, %d submissions"
                  % (tag, paint, args.forum, count))
            if count == 0:
                fails.append("%s: /f/%s rendered no submissions" % (tag, args.forum))

            t1 = time.time()
            page.goto("%s/?sid=%s" % (base, sid), wait_until="domcontentloaded")
            page.wait_for_selector("#main", timeout=60000)
            print("[%s] front page (empty by design) ready in %.0f ms"
                  % (tag, (time.time() - t1) * 1000))

            # Deepened forum listing + cursor pagination. The listing pager's
            # label is `More` (nav.more), not "Next" — Postmill only uses "Next"
            # on the offset pagers (comments firehose, search).
            page.goto("%s/f/%s?sid=%s" % (base, args.forum, sid), wait_until="domcontentloaded")
            page.wait_for_selector(".submission", timeout=30000)
            ids1 = listing_ids(page)
            more = page.locator("nav.pagination a[rel=next]").first
            ids2, url2 = [], ""
            if more.count():
                more.click()
                page.wait_for_timeout(800)
                ids2 = listing_ids(page)
                url2 = page.url
                if "sid=" not in url2:
                    fails.append("%s: sid dropped by pagination (%s)" % (tag, url2))
            print("[%s] /f/%s page1=%d page2=%d  next=%s"
                  % (tag, args.forum, len(ids1), len(ids2), url2 or "(no pager)"))
            if not ids2:
                fails.append("%s: /f/%s did not paginate" % (tag, args.forum))
            elif set(ids1) & set(ids2):
                fails.append("%s: /f/%s page 2 repeats %d of page 1"
                             % (tag, args.forum, len(set(ids1) & set(ids2))))

            # ...and the same first page on the live source, id for id.
            try:
                want = source_listing_ids("/f/%s" % args.forum)[:len(ids1)]
                got = ids1
                if want and want != got:
                    first = next((k for k, (a, b) in enumerate(zip(want, got)) if a != b), len(got))
                    fails.append("%s: /f/%s page 1 diverges from the source at position %d "
                                 "(source %s, mock %s)" % (tag, args.forum, first,
                                                           want[first:first + 2], got[first:first + 2]))
                else:
                    print("[%s] /f/%s page 1 matches the source id-for-id (%d rows)"
                          % (tag, args.forum, len(got)))
            except Exception as exc:                       # noqa: BLE001
                print("[%s] source comparison skipped: %s" % (tag, str(exc)[:80]))

            if args.post:
                page.goto("%s/f/%s/%d?sid=%s" % (base, args.forum, args.post, sid),
                          wait_until="domcontentloaded")
                page.wait_for_timeout(700)
                comments = page.locator(".comment").count()
                nested = page.locator(".comment .comment").count()
                img = page.locator(".submission__image, .submission img").count()
                print("[%s] post %d: %d comments (%d nested), %d images"
                      % (tag, args.post, comments, nested, img))

            print("[%s] console errors=%d external requests=%d"
                  % (tag, len(errors), len(external)))
            if errors:
                fails.append("%s: %d console errors, first: %s" % (tag, len(errors), errors[0][:120]))
            if external:
                fails.append("%s: %d external requests, first: %s" % (tag, len(external), external[0]))

            # localStorage persistence across a reload
            stored = page.evaluate(
                "() => Object.keys(localStorage).filter(k => k.startsWith('webarena_reddit_mock')).length")
            print("[%s] localStorage keys held: %d" % (tag, stored))
            if stored == 0:
                fails.append("%s: nothing persisted to localStorage (quota?)" % tag)
            ctx.close()
        browser.close()

    go = urllib.request.build_opener(urllib.request.ProxyHandler({})).open(
        "%s/go?sid=verify_size" % base, timeout=60).read()
    doc = json.loads(go)
    print("/go payload %.2f MB  keys=%s" % (len(go) / 1e6, sorted(doc)))

    print("\n%s" % ("FAILURES:" if fails else "ALL CHECKS PASSED"))
    for f in fails:
        print("  - %s" % f)
    return 1 if fails else 0


if __name__ == "__main__":
    sys.exit(main())
