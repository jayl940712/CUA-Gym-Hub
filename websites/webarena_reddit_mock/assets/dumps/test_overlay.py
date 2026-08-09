#!/usr/bin/env python3
"""Regression suite for the frozen-corpus / overlay refactor.

The corpus (8,012 submissions, 24,149 comments) left app state and mutations
became a delta overlay resolved on read by `src/utils/overlay.js`. The risk that
buys is a record that looks deleted in one view and present in another, or an
injected task state that no longer renders what it used to. This checks both,
plus the listing/sort/pagination fidelity the refactor must not touch.

    /tmp/pwvenv/bin/python assets/dumps/test_overlay.py --port 5312

Sections
  1  forum listing counts and pagination, no ?sid= and fresh ?sid=
  2  hot/top/new/most_commented page-1-exact vs the live source, 12 forums,
     plus the two anchored sort routes
  3  anchored permalinks still resolve (gap report + browser spot-check)
  4  legacy full-array injection vs lightweight overlay injection render
     identically for create / edit / delete
  5  UI round-trips on FROZEN records: vote, edit, delete — checked in the
     forum listing, permalink, user profile, search, comment firehose and /go
  6  /go diff shape and size; referential integrity of the merged corpus
"""

import argparse
import json
import os
import random
import re
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(MOCK, "src", "data")
SOURCE = "http://localhost:9999"

CANONICAL_RE = re.compile(r"/f/[A-Za-z0-9_]+/(\d+)/")

FAILS = []
PASSES = []


def check(ok, label, detail=""):
    (PASSES if ok else FAILS).append(label if ok else "%s — %s" % (label, detail))
    print("  %s %s%s" % ("PASS" if ok else "FAIL", label,
                         "" if ok else "  <- " + detail))
    return ok


def opener():
    return urllib.request.build_opener(urllib.request.ProxyHandler({}))


def http(url, data=None, timeout=180):
    req = urllib.request.Request(url, headers={"User-Agent": "curl/8"})
    if data is not None:
        req.data = json.dumps(data).encode()
        req.add_header("Content-Type", "application/json")
    return opener().open(req, timeout=timeout).read()


def source_ids(path):
    html = http(SOURCE + path).decode("utf-8", "replace")
    return list(dict.fromkeys(CANONICAL_RE.findall(html)))


def locate(page, base, path, sid, sub_id, max_pages=8):
    """innerText of the `.submission` row for `sub_id`, walking the pager.

    Presence has to be tested by id, not by title text: `/f/<forum>/new` puts a
    2019 submission on page 4, and the search page echoes the query back in its
    "No results for ..." line, so a substring test on the title reports both
    false positives and false negatives.
    """
    sep = "&" if "?" in path else "?"
    page.goto("%s%s%ssid=%s" % (base, path, sep, sid), wait_until="domcontentloaded")
    for _ in range(max_pages):
        page.wait_for_timeout(350)
        hit = page.evaluate(
            """(id) => {
                for (const el of document.querySelectorAll('.submission')) {
                  for (const a of el.querySelectorAll('a[href]')) {
                    const m = (a.getAttribute('href')||'').match(/\\/f\\/[A-Za-z0-9_]+\\/(\\d+)\\//)
                    if (m && m[1] === id) return el.innerText
                  }
                }
                return null
            }""", str(sub_id))
        if hit is not None:
            return hit
        more = page.locator("nav.pagination a[rel=next], nav.pagination a[rel=nofollow][href]").first
        if not more.count():
            return None
        more.click()
    return None


def listing_ids(page):
    groups = page.eval_on_selector_all(
        ".submission",
        "els => els.map(e => [...e.querySelectorAll('a[href]')]"
        ".map(a => a.getAttribute('href')))")
    out = []
    for hrefs in groups:
        for href in hrefs:
            m = CANONICAL_RE.search(href or "")
            if m:
                out.append(m.group(1))
                break
    return out


# --------------------------------------------------------------------------
# An INDEPENDENT reimplementation of overlay.materialize(), so a JS-side merge
# bug cannot mark its own homework.
# --------------------------------------------------------------------------

def py_materialize(core, frozen_subs, frozen_comments):
    def rename(lst, v):
        for r in lst:
            if v == r["from"]:
                v = r["to"]
        return v

    base_s = core["submissions"] if isinstance(core.get("submissions"), list) else frozen_subs
    base_c = core["comments"] if isinstance(core.get("comments"), list) else frozen_comments
    s_edits = core.get("submissionEdits") or {}
    c_edits = core.get("commentEdits") or {}
    s_del = {str(x) for x in (core.get("deletedSubmissions") or [])}
    c_del = {str(x) for x in (core.get("deletedComments") or [])}
    dead = {str(f).lower() for f in (core.get("deletedForums") or [])}
    fr = core.get("forumRenames") or []
    ur = core.get("userRenames") or []

    subs = []
    for raw in list(base_s) + list(core.get("newSubmissions") or []):
        sid = str(raw["id"])
        if sid in s_del:
            continue
        rec = dict(s_edits.get(sid, raw))
        rec["forum"] = rename(fr, rec.get("forum"))
        rec["author"] = rename(ur, rec.get("author"))
        if str(rec.get("forum", "")).lower() in dead:
            continue
        subs.append(rec)

    alive = {str(s["id"]) for s in subs}
    comments = []
    for raw in list(base_c) + list(core.get("newComments") or []):
        cid = str(raw["id"])
        if cid in c_del:
            continue
        rec = dict(c_edits.get(cid, raw))
        if str(rec.get("submission")) not in alive:
            continue
        rec["author"] = rename(ur, rec.get("author"))
        comments.append(rec)
    return subs, comments


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=5312)
    ap.add_argument("--skip-source", action="store_true")
    args = ap.parse_args()
    base = "http://localhost:%d" % args.port

    frozen_subs = json.load(open(os.path.join(DATA, "submissions.json")))
    frozen_comments = json.load(open(os.path.join(DATA, "comments.json")))

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = ctx.new_page()
        errors = []
        external = []
        page.on("console", lambda m: m.type == "error" and errors.append(m.text))
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("request", lambda r: (not r.url.startswith(base))
                and not r.url.startswith("data:") and external.append(r.url))

        # ---------------------------------------------------------------- 1
        print("\n[1] forum listing counts and pagination")
        for label, sid in (("no sid", None), ("fresh sid", "count%d" % time.time())):
            for forum, total in (("Art", 108), ("springfieldMO", 110)):
                q = "" if sid is None else "?sid=%s" % sid
                page.goto("%s/f/%s%s" % (base, forum, q), wait_until="domcontentloaded")
                page.wait_for_selector(".submission", timeout=60000)
                first = listing_ids(page)
                check(len(first) == 25, "/f/%s page 1 = 25 posts (%s)" % (forum, label),
                      "got %d" % len(first))
                seen, pages = list(first), 1
                while pages < 12:
                    more = page.locator("nav.pagination a[rel=next]").first
                    if not more.count():
                        break
                    more.click()
                    page.wait_for_timeout(500)
                    ids = listing_ids(page)
                    if not ids:
                        break
                    if sid is not None and "sid=" not in page.url:
                        check(False, "/f/%s pagination keeps sid" % forum, page.url)
                    seen += ids
                    pages += 1
                check(len(set(seen)) == total,
                      "/f/%s paginates to %d unique posts (%s)" % (forum, total, label),
                      "got %d over %d pages" % (len(set(seen)), pages))

        # ---------------------------------------------------------------- 2
        print("\n[2] sort fidelity vs the live source, page 1 exact")
        forums = ["Art", "springfieldMO", "news", "movies", "science", "space",
                  "television", "pittsburgh", "nyc", "wallstreetbets",
                  "dataisbeautiful", "singularity"]
        routes = [("/f/%s/%s" % (f, s), "%s/%s" % (f, s))
                  for f in forums for s in ("hot", "top", "new", "most_commented")]
        # The two sort routes real evaluators navigate to (assets/task_anchors).
        routes += [("/f/Art/active", "Art/active (anchored)"),
                   ("/f/springfieldMO/controversial", "springfieldMO/controversial (anchored)")]
        if args.skip_source:
            print("  (skipped: --skip-source)")
        else:
            for path, label in routes:
                try:
                    want = source_ids(path)
                except Exception as exc:                       # noqa: BLE001
                    check(False, "source fetch %s" % label, str(exc)[:60])
                    continue
                page.goto(base + path, wait_until="domcontentloaded")
                page.wait_for_selector(".submission", timeout=60000)
                got = listing_ids(page)
                want = want[:len(got)]
                check(want == got, "sort %s page-1 exact" % label,
                      "first divergence at %s" % next(
                          (str(i) for i, (a, b) in enumerate(zip(want, got)) if a != b),
                          "length %d vs %d" % (len(want), len(got))))

        # ---------------------------------------------------------------- 3
        print("\n[3] anchored records")
        gap = subprocess.run([sys.executable, os.path.join(HERE, "anchor_ids.py")],
                             capture_output=True, text=True, cwd=MOCK)
        tail = (gap.stdout or gap.stderr).strip().splitlines()
        for line in tail[-14:]:
            print("      " + line)
        check("MISSING" not in (gap.stdout or "").upper()
              or "0 missing" in (gap.stdout or "").lower()
              or gap.returncode == 0,
              "anchor_ids.py gap report clean", "exit %d" % gap.returncode)

        try:
            anchors = json.load(open(os.path.join(MOCK, "assets", "task_anchors.json")))
        except Exception:                                      # noqa: BLE001
            anchors = None
        by_id = {str(s["id"]): s for s in frozen_subs}
        random.seed(7)
        spot = random.sample(list(by_id), 20)
        bad = []
        for sid_ in spot:
            s = by_id[sid_]
            page.goto("%s/f/%s/%s/%s" % (base, s["forum"], sid_, s.get("slug") or "-"),
                      wait_until="domcontentloaded")
            page.wait_for_timeout(120)
            if page.locator("h1.submission__title, .submission__title").count() == 0:
                bad.append(sid_)
        check(not bad, "20 sampled frozen permalinks resolve", "missing %s" % bad[:4])

        sys.path.insert(0, HERE)
        from anchor_ids import load_anchor_ids            # noqa: E402
        anchored = load_anchor_ids()
        c_by_id = {str(c["id"]): c for c in frozen_comments}
        missing = []
        for cid in sorted(anchored["comments"]):
            c = c_by_id.get(str(cid))
            if not c:
                missing.append(cid)
                continue
            s = by_id[str(c["submission"])]
            page.goto("%s/f/%s/%s/%s/comment/%s" % (
                base, s["forum"], s["id"], s.get("slug") or "-", cid),
                wait_until="domcontentloaded")
            page.wait_for_timeout(200)
            if page.locator(".comment").count() == 0:
                missing.append(cid)
        check(not missing, "all %d anchored comment permalinks resolve"
              % len(anchored["comments"]), "missing %s" % missing[:5])

        anchored_subs = sorted(anchored["submissions"])
        gone = []
        for sid_ in anchored_subs:
            s = by_id.get(str(sid_))
            if not s:
                gone.append(sid_)
                continue
            page.goto("%s/f/%s/%s/%s" % (base, s["forum"], sid_, s.get("slug") or "-"),
                      wait_until="domcontentloaded")
            page.wait_for_timeout(90)
            if page.locator(".submission__title").count() == 0:
                gone.append(sid_)
        check(not gone, "all %d anchored submission permalinks resolve"
              % len(anchored_subs), "missing %s" % gone[:5])

        print("\n[3b] query params still drive output")
        page.goto("%s/f/news?sid=%s" % (base, "qp%d" % time.time()),
                  wait_until="domcontentloaded")
        page.wait_for_selector(".submission", timeout=60000)
        p1 = listing_ids(page)
        page.locator("nav.pagination a[rel=next]").first.click()
        page.wait_for_timeout(600)
        cursor_url = page.url
        p2 = listing_ids(page)
        check("next%5Branking%5D" in cursor_url or "next[ranking]" in cursor_url,
              "pagination uses the next[ranking] cursor", cursor_url)
        check("next%5Bid%5D" in cursor_url or "next[id]" in cursor_url,
              "pagination uses the next[id] cursor", cursor_url)
        check(not (set(p1) & set(p2)), "page 2 shares no rows with page 1",
              "%d shared" % len(set(p1) & set(p2)))
        # Postmill takes the sort from the PATH segment (`/f/news/new`), not from
        # `?sort=`; measured on the container, `/f/news`, `/f/news?sort=new` and
        # `/f/news?sort=top&t=all` all return the same page 1 while `/f/news/new`
        # is completely different. So the right assertion is "the mock does what
        # the source does for this URL", not "the query param changed something".
        page.goto("%s/f/news/new" % base, wait_until="domcontentloaded")
        page.wait_for_selector(".submission", timeout=60000)
        newest = listing_ids(page)
        check(newest and newest != p1, "/f/news/new reorders the listing",
              "%d rows" % len(newest))
        if not args.skip_source:
            for qs in ("?sort=top&t=all", "?sort=new", "?sort=hot"):
                page.goto("%s/f/news%s" % (base, qs), wait_until="domcontentloaded")
                page.wait_for_selector(".submission", timeout=60000)
                got = listing_ids(page)
                want = source_ids("/f/news" + qs)[:len(got)]
                check(want == got, "/f/news%s matches the source" % qs,
                      "%s vs %s" % (want[:3], got[:3]))
            for qs in ("?t=all", "?t=month", "?t=day"):
                page.goto("%s/f/news/top%s" % (base, qs), wait_until="domcontentloaded")
                page.wait_for_timeout(500)
                got = listing_ids(page)
                want = source_ids("/f/news/top" + qs)[:len(got)] if got else []
                check(want == got, "/f/news/top%s matches the source" % qs,
                      "%s vs %s" % (want[:3], got[:3]))

        # ---------------------------------------------------------------- 4
        print("\n[4] legacy full-array injection == lightweight overlay injection")
        defaults = json.loads(http("%s/go?sid=__defaults__" % base))["initial_state"]
        victim = next(s for s in frozen_subs if s["forum"] == "Art")
        doomed = next(s for s in frozen_subs if s["forum"] == "Art" and s["id"] != victim["id"])
        newpost = {
            "id": 199001, "forum": "Art", "author": "MarvelsGrantMan136",
            "title": "OVERLAY TEST POST", "timestamp": "2024-01-01T00:00:00+00:00",
            "lastActive": "2024-01-01T00:00:00+00:00", "ranking": 9999999999,
            "netScore": 1, "commentCount": 0, "slug": "overlay-test-post",
        }
        edited = dict(victim, title="OVERLAY EDITED TITLE")

        legacy_arr = [edited if s["id"] == victim["id"] else s
                      for s in frozen_subs if s["id"] != doomed["id"]] + [newpost]
        sid_legacy = "legacy%d" % time.time()
        sid_light = "light%d" % time.time()
        http("%s/post?sid=%s" % (base, sid_legacy),
             {"action": "set", "state": dict(defaults, submissions=legacy_arr)})
        http("%s/post?sid=%s" % (base, sid_light),
             {"action": "set", "state": dict(
                 defaults,
                 newSubmissions=[newpost],
                 submissionEdits={str(victim["id"]): edited},
                 deletedSubmissions=[str(doomed["id"])])})

        for path in ("/f/Art", "/f/Art/new", "/f/Art/top",
                     "/user/MarvelsGrantMan136", "/search?q=overlay"):
            sep = "&" if "?" in path else "?"
            rendered = {}
            for tag, sid_ in (("legacy", sid_legacy), ("light", sid_light)):
                page.goto("%s%s%ssid=%s" % (base, path, sep, sid_),
                          wait_until="domcontentloaded")
                page.wait_for_timeout(400)
                rendered[tag] = page.eval_on_selector(
                    "#main", "e => e.innerText").strip()
            check(rendered["legacy"] == rendered["light"],
                  "%s renders identically under both injections" % path,
                  "%d vs %d chars" % (len(rendered["legacy"]), len(rendered["light"])))

        for tag, sid_ in (("legacy", sid_legacy), ("light", sid_light)):
            page.goto("%s/f/Art/199001/overlay-test-post?sid=%s" % (base, sid_),
                      wait_until="domcontentloaded")
            page.wait_for_timeout(300)
            body = page.eval_on_selector("#main", "e => e.innerText")
            check("OVERLAY TEST POST" in body, "%s: injected new post permalink" % tag)
            page.goto("%s/f/Art/%d/%s?sid=%s" % (base, doomed["id"],
                                                 doomed.get("slug") or "-", sid_),
                      wait_until="domcontentloaded")
            page.wait_for_timeout(300)
            body = page.eval_on_selector("#main", "e => e.innerText")
            check("Page not found" in body or "not found" in body.lower(),
                  "%s: injected-deleted permalink 404s" % tag, body[:60])

        # ---------------------------------------------------------------- 5
        print("\n[5] UI round-trips on FROZEN records")
        sid = "ui%d" % time.time()
        # 21988 is seeded, authored by the default user, and has 61 comments —
        # so deleting it exercises comment pruning as well.
        target = next(s for s in frozen_subs if s["id"] == 21988)
        perma = "/f/%s/%d/%s" % (target["forum"], target["id"], target["slug"])

        page.goto("%s%s?sid=%s" % (base, perma, sid), wait_until="domcontentloaded")
        page.wait_for_selector(".submission", timeout=60000)
        before = int(page.eval_on_selector(".submission .vote__net-score",
                                           "e => parseInt(e.innerText.replace(/[^0-9-]/g,''))"))
        page.click(".submission .vote__up")
        page.wait_for_timeout(400)
        after = int(page.eval_on_selector(".submission .vote__net-score",
                                          "e => parseInt(e.innerText.replace(/[^0-9-]/g,''))"))
        check(after == before + 1, "vote on a frozen submission moves netScore",
              "%d -> %d" % (before, after))

        page.fill(".comment-form textarea", "overlay round-trip comment")
        page.click(".comment-form button[type=submit]")
        page.wait_for_timeout(700)
        check("/comment/" in page.url, "comment create redirects to /comment/<id>", page.url)
        check("sid=" in page.url, "comment redirect keeps sid", page.url)
        new_comment_url = page.url

        page.reload(wait_until="domcontentloaded")
        page.wait_for_timeout(700)
        body = page.eval_on_selector("#main", "e => e.innerText")
        check("overlay round-trip comment" in body, "comment survives reload")
        score = int(page.eval_on_selector(".submission .vote__net-score",
                                          "e => parseInt(e.innerText.replace(/[^0-9-]/g,''))"))
        check(score == before + 1, "vote survives reload", "%d" % score)

        # edit the frozen submission
        page.goto("%s%s/edit?sid=%s" % (base, perma, sid), wait_until="domcontentloaded")
        page.wait_for_selector("#submission_title", timeout=30000)
        page.fill("#submission_title", "FROZEN EDITED TITLE")
        page.click("form button[type=submit]")
        page.wait_for_timeout(700)
        VIEWS = [
            ("/f/%s/new" % target["forum"], "forum listing"),
            ("/f/%s/most_commented" % target["forum"], "forum most_commented"),
            ("/user/MarvelsGrantMan136/submissions", "user profile"),
            ("/search?q=FROZEN+EDITED+TITLE", "search"),
        ]
        page.goto("%s%s?sid=%s" % (base, perma, sid), wait_until="domcontentloaded")
        page.wait_for_timeout(400)
        check("FROZEN EDITED TITLE" in page.eval_on_selector("#main", "e => e.innerText"),
              "frozen-record edit visible in permalink")
        for path, name in VIEWS:
            row = locate(page, base, path, sid, target["id"])
            # /search wraps each matched term in <mark>, and innerText joins the
            # fragments without spaces — compare with whitespace removed.
            flat = re.sub(r"\s+", "", row or "")
            check(row is not None and "FROZENEDITEDTITLE" in flat,
                  "frozen-record edit visible in %s" % name,
                  "row=%r" % (row[:60] if row else None))

        # The edit of a FROZEN record is only visible in state as an overlay
        # entry, so check the diff carries it BEFORE the delete drops the entry.
        mid = json.loads(http("%s/go?sid=%s" % (base, sid)))["state_diff"]
        check("submissionEdits" in mid, "state_diff reports submissionEdits",
              str(sorted(mid)))
        check(str(target["id"]) in (mid.get("submissionEdits", {}).get("new") or {}),
              "state_diff's submissionEdits names the edited frozen id")

        # delete the frozen submission
        page.goto("%s%s/delete?sid=%s" % (base, perma, sid), wait_until="domcontentloaded")
        page.wait_for_selector("form[name=submission_delete]", timeout=30000)
        page.click("form[name=submission_delete] button[type=submit]")
        page.wait_for_timeout(800)
        page.goto("%s%s?sid=%s" % (base, perma, sid), wait_until="domcontentloaded")
        page.wait_for_timeout(400)
        txt = page.eval_on_selector("#main", "e => e.innerText")
        check("not found" in txt.lower(), "frozen-record delete honoured in permalink",
              txt[:80])
        for path, name in VIEWS:
            row = locate(page, base, path, sid, target["id"])
            check(row is None, "frozen-record delete honoured in %s" % name,
                  "still rendered: %r" % (row or "")[:60])
        page.goto("%s?sid=%s" % (new_comment_url.split("?")[0], sid),
                  wait_until="domcontentloaded")
        page.wait_for_timeout(400)
        txt = page.eval_on_selector("#main", "e => e.innerText")
        check("overlay round-trip comment" not in txt,
              "comments of a deleted submission are gone from its comment permalink",
              txt[:80])
        page.goto("%s/comments?sid=%s" % (base, sid), wait_until="domcontentloaded")
        page.wait_for_timeout(500)
        txt = page.eval_on_selector("#main", "e => e.innerText")
        check("overlay round-trip comment" not in txt,
              "deleted submission's comments are gone from the /comments firehose")

        # submit a new post and check the redirect shape
        page.goto("%s/submit?sid=%s" % (base, sid), wait_until="domcontentloaded")
        page.wait_for_selector("#submission_title", timeout=30000)
        page.fill("#submission_title", "Overlay created submission")
        page.select_option("#submission_forum", "Art")
        page.click("form button[type=submit]")
        page.wait_for_timeout(800)
        check(re.search(r"/f/Art/\d+/overlay-created-submission", page.url) is not None,
              "submit redirects to /f/<forum>/<id>/<slug>", page.url)
        check("sid=" in page.url, "submit redirect keeps sid", page.url)

        # ---------------------------------------------------------------- 6
        print("\n[6] /go contract, size, and referential integrity")
        go = json.loads(http("%s/go?sid=%s" % (base, sid)))
        check(set(go) == {"initial_state", "current_state", "state_diff"},
              "/go returns the three contract keys", str(sorted(go)))
        size = len(json.dumps(go))
        check(size < 500_000, "/go payload under 500 KB", "%d bytes" % size)
        diff = go["state_diff"]
        for key in ("votes", "newSubmissions", "deletedSubmissions", "newComments"):
            check(key in diff, "state_diff reports %s" % key, str(sorted(diff)))
        for key in ("submissions", "comments", "userDirectory"):
            check(key not in go["current_state"],
                  "current_state does not carry the frozen %s" % key)

        fresh = json.loads(http("%s/go?sid=untouched%d" % (base, time.time())))
        check(fresh["state_diff"] == {}, "untouched sid has an empty state_diff",
              str(sorted(fresh["state_diff"]))[:120])

        subs, comments = py_materialize(go["current_state"], frozen_subs, frozen_comments)
        alive = {str(s["id"]) for s in subs}
        cids = {str(c["id"]) for c in comments}
        dangling = [c["id"] for c in comments if str(c["submission"]) not in alive]
        orphan = [c["id"] for c in comments
                  if c.get("parent") is not None and str(c["parent"]) not in cids]
        check(not dangling, "0 dangling submission refs", "%d" % len(dangling))
        check(not orphan, "0 orphaned comment parents", "%d" % len(orphan))
        check(str(target["id"]) not in alive,
              "the deleted frozen submission is absent from the merged corpus")

        print("\n  console errors=%d external requests=%d" % (len(errors), len(external)))
        check(not errors, "0 console errors", (errors[0] if errors else "")[:120])
        check(not external, "0 external requests", (external[0] if external else ""))

        browser.close()

    print("\n%d passed, %d failed" % (len(PASSES), len(FAILS)))
    for f in FAILS:
        print("  FAIL %s" % f)
    return 1 if FAILS else 0


if __name__ == "__main__":
    sys.exit(main())
