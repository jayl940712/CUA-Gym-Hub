#!/usr/bin/env python3
"""Regression suite for the PER-PROJECT LAZY LOADING refactor.

`assets/dumps/test_overlay.py` covers the frozen-corpus/overlay contract and
still passes unchanged. This covers the failure modes lazy loading ADDS, none of
which the old suite can see because they only exist once part of the corpus is
absent from the page:

  1  cold deep-link on a project route paints the real content, once — no flash
     of an empty state, no second render that fills it in
  2  issue / MR DESCRIPTIONS survive the index/body split: present on detail
     pages, matched by /search, and not lost when a record is edited
  3  the overlay crosses a lazy boundary: create in project A while viewing
     project B, then navigate to A
  4  `state.notes` is complete for the project being viewed even though its base
     array is only the chunks loaded so far
  5  a fork reads its ORIGIN project's chunk
  6  no reducer tombstones the corpus: after a mutation the overlay still holds
     a handful of records, not thousands

    export LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu
    /tmp/pwvenv/bin/python assets/dumps/test_lazy.py --port 5330
"""
import argparse
import json
import os
import re
import sys
import time

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(MOCK, "src", "data")

PASS = []
FAIL = []


def norm(t):
    """innerText collapses runs of whitespace; seed strings do not."""
    return re.sub(r"\s+", " ", t or "").strip()


def probe_word(text, avoid):
    """A distinctive long word from `text` that does not occur in `avoid`.

    Asserting on a whole line does not work: descriptions are MARKDOWN, so
    `## Bug description` renders as `Bug description` and a literal match on the
    raw seed line fails on a perfectly correct page.
    """
    for w in re.findall(r"[A-Za-z][A-Za-z0-9_-]{8,}", text):
        if w.lower() not in avoid:
            return w
    return None


def check(ok, label, detail=""):
    (PASS if ok else FAIL).append(label)
    print("  %s %s%s" % ("PASS" if ok else "FAIL", label, ("   -> " + detail) if detail and not ok else ""))


def seed(name):
    with open(os.path.join(DATA, name), encoding="utf8") as fh:
        return json.load(fh)


def go(page, base, path, sid):
    sep = "&" if "?" in path else "?"
    page.goto("%s%s%ssid=%s" % (base, path, sep, sid), wait_until="networkidle", timeout=60000)


def state_of(page, base, sid):
    r = page.request.get("%s/go?sid=%s" % (base, sid))
    return r.json()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--port", type=int, default=5330)
    a = ap.parse_args()
    base = "http://localhost:%d" % a.port
    stamp = int(time.time())

    projects = {p["full_path"]: p for p in seed("projects.json")}
    issues = seed("issues.json")
    mrs = seed("merge_requests.json")
    notes = seed("notes.json")

    # A project with issues that HAVE descriptions, and enough notes to matter.
    target = projects["a11yproject/a11yproject.com"]
    tid = target["id"]
    with_body = [i for i in issues
                 if i["project_id"] == tid and (i.get("description") or "").strip()]
    with_body.sort(key=lambda i: -len(i["description"]))
    probe_issue = with_body[0]
    mr_body = [m for m in mrs if m["project_id"] == tid and (m.get("description") or "").strip()]
    probe_mr = sorted(mr_body, key=lambda m: -len(m["description"]))[0] if mr_body else None

    with sync_playwright() as pw:
        browser = pw.chromium.launch()

        # -- 1. cold deep link, one paint ---------------------------------
        print("\n[1] cold deep-link on a project route")
        ctx = browser.new_context()
        page = ctx.new_page()
        errors = []
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        page.on("pageerror", lambda e: errors.append(str(e)))

        sid = "lazy_cold_%d" % stamp
        path = "/%s/-/issues/%s" % (target["full_path"], probe_issue["iid"])
        page.goto("%s%s?sid=%s" % (base, path, sid), wait_until="domcontentloaded", timeout=60000)
        # The FIRST contentful frame must already be the real page. Sample as
        # soon as anything is painted rather than after networkidle, which is
        # what would hide a fill-in-later bug.
        page.wait_for_function(
            "() => performance.getEntriesByName('first-contentful-paint').length > 0",
            timeout=30000)
        first_paint_text = norm(page.inner_text("body"))
        title = norm(probe_issue["title"])
        head = probe_word(probe_issue["description"], norm(title).lower())
        check(title in first_paint_text,
              "issue title present in the FIRST painted frame", first_paint_text[:200])
        check(bool(head) and head in first_paint_text,
              "issue description present in the FIRST painted frame", str(head))

        page.wait_for_load_state("networkidle")
        settled = norm(page.inner_text("body"))
        check(title in settled, "title still present once settled")
        check(head in settled, "description still present once settled")
        check(len(errors) == 0, "no console errors on the cold deep link", str(errors[:2]))

        # -- 2. descriptions across the index/body split ------------------
        print("\n[2] descriptions survive the index / body split")
        if probe_mr:
            go(page, base, "/%s/-/merge_requests/%s" % (target["full_path"], probe_mr["iid"]), sid)
            mhead = probe_word(probe_mr["description"], norm(probe_mr["title"]).lower())
            check(bool(mhead) and mhead in norm(page.inner_text("body")),
                  "MR description renders", str(mhead))

        # a term that occurs in a description but NOT in any title
        titles = " ".join(i["title"] for i in issues).lower()
        term = None
        for i in with_body[:80]:
            for w in re.findall(r"[A-Za-z]{9,}", i["description"]):
                if w.lower() not in titles:
                    term, term_issue = w, i
                    break
            if term:
                break
        if term:
            go(page, base, "/search?search=%s&scope=issues" % term, sid)
            txt = norm(page.inner_text("body"))
            check(norm(term_issue["title"]) in txt,
                  "/search matches a term that only appears in a DESCRIPTION (%s)" % term,
                  txt[:300])
        else:
            check(False, "found a description-only search term")

        # editing must not drop the body
        go(page, base, "/%s/-/issues/%s/edit" % (target["full_path"], probe_issue["iid"]), sid)
        new_title = "LAZY-EDIT-%d" % stamp
        page.fill("#issue_title", new_title)
        page.click("button[type=submit].btn-confirm, input[type=submit]")
        page.wait_for_load_state("networkidle")
        txt = norm(page.inner_text("body"))
        check(new_title in txt, "edited title renders", txt[:200])
        check(head in txt, "description SURVIVED the edit", txt[:300])
        page.reload(wait_until="networkidle")
        txt = norm(page.inner_text("body"))
        check(new_title in txt and head in txt, "title + description survive a reload", txt[:300])

        # -- 3. overlay across a lazy boundary ----------------------------
        print("\n[3] overlay across a lazy boundary")
        sid2 = "lazy_cross_%d" % stamp
        other = projects["byteblaze/dotfiles"]
        created = "LAZY-CROSS-%d" % stamp
        go(page, base, "/%s/-/issues/new" % target["full_path"], sid2)
        page.fill("#issue_title", created)
        page.fill("#issue_description", "cross-boundary body %d" % stamp)
        page.click("button[type=submit].btn-confirm, input[type=submit]")
        page.wait_for_load_state("networkidle")
        # navigate to a DIFFERENT project (loads another chunk), then back
        go(page, base, "/%s" % other["full_path"], sid2)
        check(other["name"] in page.inner_text("body") or "dotfiles" in page.inner_text("body"),
              "second project renders after the first")
        go(page, base, "/%s/-/issues/?state=all" % target["full_path"], sid2)
        check(created in page.inner_text("body"),
              "issue created before the chunk switch is still listed")
        go(page, base, "/dashboard/issues?scope=all&state=all&search=%s" % created, sid2)
        check(created in page.inner_text("body"),
              "…and is visible on the cross-project dashboard")
        go(page, base, "/search?search=%s&scope=issues" % created, sid2)
        check(created in page.inner_text("body"), "…and in global search")

        # -- 4. notes complete for the viewed project ---------------------
        print("\n[4] notes are complete for the project being viewed")
        counts = {}
        for n in notes:
            if n.get("noteable_type") == "Issue" and not n.get("system"):
                counts[n["noteable_id"]] = counts.get(n["noteable_id"], 0) + 1
        best = max((c, i) for i, c in counts.items()
                   if any(x["id"] == i and x["project_id"] == tid for x in issues))
        n_expected, iid_of = best
        rec = next(x for x in issues if x["id"] == iid_of)
        sid3 = "lazy_notes_%d" % stamp
        go(page, base, "/%s/-/issues/%s" % (target["full_path"], rec["iid"]), sid3)
        rendered = page.locator("#notes-list .note, #notes-list li").count()
        check(rendered >= n_expected,
              "all %d seeded notes render on the busiest issue (got %d)" % (n_expected, rendered))

        # -- 5. a fork reads its origin's chunk ---------------------------
        # A fork has NO chunk of its own — `originChunk()` in dataManager.js
        # walks `state.repo.forkOrigin` to the source project's. The route gate
        # has to walk the same chain, and it has to resolve the fork's path
        # through the LIVE project list, because a project created in-session is
        # not in the seed path map. Get that wrong and every repo view on the
        # fork renders empty while looking perfectly healthy.
        print("\n[5] fork reads its origin project's chunk")
        sid4 = "lazy_fork_%d" % stamp
        src = projects["a11yproject/a11yproject.com"]
        ref = src.get("default_branch") or "main"
        go(page, base, "/%s/-/forks/new" % src["full_path"], sid4)
        page.click("button.gl-dropdown-toggle:has-text('Select a namespace')")
        page.click("button[role=menuitem]")
        page.click("button[data-testid=submit-button]")
        page.wait_for_load_state("networkidle")
        fork_path = page.url.split("?")[0].replace(base, "").strip("/")
        check(fork_path and fork_path != "%s/-/forks/new" % src["full_path"],
              "fork created (landed on /%s)" % fork_path, page.url)

        if fork_path:
            # Cold context: prove it on a DEEP LINK, not just after the click,
            # since the click leaves the origin's chunk already resolved.
            cctx = browser.new_context()
            cpage = cctx.new_page()
            cerr = []
            cpage.on("console", lambda m: cerr.append(m.text) if m.type == "error" else None)
            cpage.on("pageerror", lambda e: cerr.append(str(e)))
            go(cpage, base, "/%s/-/tree/%s" % (fork_path, ref), sid4)
            txt = norm(cpage.inner_text("body"))
            origin_tree = seed("repo_trees.json").get(src["full_path"], [])
            top = sorted({e["path"].split("/")[0] for e in origin_tree})[:6]
            hit = [t for t in top if t in txt]
            check(len(hit) >= 2,
                  "cold deep link to the FORK's file tree shows the origin's files "
                  "(%d/%d of %s)" % (len(hit), len(top), top), txt[:300])
            go(cpage, base, "/%s/-/commits/%s" % (fork_path, ref), sid4)
            ctxt = norm(cpage.inner_text("body"))
            check("commit" in ctxt.lower() and len(ctxt) > 600,
                  "fork's commit list resolves through the origin chunk", ctxt[:200])
            check(len(cerr) == 0, "no console errors on the fork deep links", str(cerr[:2]))
            cctx.close()

        # -- 6. no mass tombstoning ---------------------------------------
        print("\n[6] the overlay stays a delta")
        st = state_of(page, base, sid2)
        cur = st.get("current_state", st)
        big = {k: len(v) for k, v in cur.items()
               if isinstance(v, (list, dict)) and re.match(r"(new|deleted)[A-Z]|.*Edits$", k)
               and len(v) > 50}
        check(not big, "no overlay key holds more than 50 records", json.dumps(big))
        blob = json.dumps(cur)
        check(len(blob) < 200000, "current_state under 200 KB (%d B)" % len(blob))

        browser.close()

    print("\n%d passed, %d failed" % (len(PASS), len(FAIL)))
    for f in FAIL:
        print("  FAILED: " + f)
    return 1 if FAIL else 0


if __name__ == "__main__":
    sys.exit(main())
