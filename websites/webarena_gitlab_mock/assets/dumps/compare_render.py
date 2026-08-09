#!/usr/bin/env python3
"""Before/after render diff for the frozen-corpus / overlay refactor.

The refactor must be invisible: on a cold session `overlay.materialize()` returns
the frozen arrays by identity, so every page should render byte-for-byte what it
rendered when the corpus lived in state. This proves that empirically rather than
by argument — it drives the SAME route list against two dev servers (an old
checkout and the working tree) and diffs the rendered text.

    git worktree add /tmp/gl-before <pre-refactor-rev>
    ln -s <mock>/node_modules /tmp/gl-before/websites/webarena_gitlab_mock/node_modules
    (cd /tmp/gl-before/websites/webarena_gitlab_mock && npm run dev -- --port 5321)
    (cd <mock> && npm run dev -- --port 5320)

    export LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu
    /tmp/pwvenv/bin/python assets/dumps/compare_render.py --before 5321 --after 5320

Also reports first paint on both, which is the other thing the refactor was meant
to move.
"""

import argparse
import json
import os
import re
import sys

from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.dirname(os.path.dirname(HERE))

with open(os.path.join(MOCK, "assets", "task_anchors.json")) as fh:
    ANCHORS = json.load(fh)

ROUTES = [r["path"] for r in ANCHORS["anchor_routes"]]
ROUTES += [
    "/dashboard/projects", "/dashboard/projects/starred", "/dashboard/groups",
    "/dashboard/issues", "/dashboard/merge_requests", "/dashboard/todos",
    "/dashboard/activity", "/dashboard/milestones", "/dashboard/snippets",
    "/explore", "/explore/projects/trending", "/explore/projects/starred",
    "/explore/projects/topics", "/explore/groups",
    "/search?search=gitlab", "/search?search=accessibility&scope=issues",
    "/search?search=accessibility&scope=merge_requests",
    "/search?search=byteblaze&scope=users",
    "/-/profile", "/-/profile/account", "/-/profile/preferences",
    "/users/byteblaze", "/users/byteblaze/activity", "/users/byteblaze/starred",
    "/byteblaze/dotfiles", "/byteblaze/dotfiles/-/tree/main",
    "/byteblaze/dotfiles/-/branches", "/byteblaze/dotfiles/-/tags",
    "/byteblaze/dotfiles/-/commits/main", "/byteblaze/dotfiles/-/starrers",
    "/byteblaze/dotfiles/-/labels", "/byteblaze/dotfiles/-/milestones",
    "/byteblaze/dotfiles/-/project_members", "/byteblaze/dotfiles/-/boards",
    "/a11yproject/a11yproject.com/-/issues",
    "/a11yproject/a11yproject.com/-/issues?state=closed",
    "/a11yproject/a11yproject.com/-/issues?sort=created_date&state=opened",
    "/a11yproject/a11yproject.com/-/merge_requests",
    "/a11yproject/a11yproject.com/-/labels",
    "/a11yproject/a11yproject.com/-/milestones",
    "/groups/gitlab-instance-58545a48/-/group_members",
]
ROUTES = list(dict.fromkeys(ROUTES))

# Relative timestamps tick between the two captures; ids of freshly-minted DOM
# nodes and the vite HMR client script do not appear in innerText, so this is
# the only normalisation needed.
TIME = re.compile(r"\d+ (?:second|minute|hour|day|week|month|year)s? ago")


def norm(s):
    return TIME.sub("<t>", s)


def capture(pw, port, routes):
    """innerText per route, one fresh `?sid=` each, on a cold browser.

    Retries once on a transient. The bundle is ~7.8 MB and both dev servers hold
    the whole corpus, so a browser sharing the box with a second suite hits
    `ERR_INSUFFICIENT_RESOURCES`; run this alone. `#root` is waited for rather
    than a fixed delay, because a 650 ms sleep captured an empty body on the
    slower loads and reported it as a diff.
    """
    out = {}
    browser = pw.chromium.launch()
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    for i, path in enumerate(routes):
        sep = "&" if "?" in path else "?"
        for attempt in (0, 1):
            url = "http://localhost:%d%s%ssid=cmp_%d_%d" % (port, path, sep, i, attempt)
            try:
                page.goto(url, wait_until="domcontentloaded", timeout=60000)
                page.wait_for_function(
                    "() => { const r = document.getElementById('root');"
                    " return r && r.innerText.trim().length > 0 }", timeout=30000)
                page.wait_for_timeout(400)
                out[path] = norm(page.inner_text("body"))
                break
            except Exception as e:                             # noqa: BLE001
                out[path] = "<<ERROR %s>>" % e
                page.close()
                page = browser.new_page(viewport={"width": 1920, "height": 1080})
    browser.close()
    return out


def first_paint(pw, port, path="/byteblaze/dotfiles", runs=3):
    """Median `firstContentfulPaint` over `runs` cold loads."""
    browser = pw.chromium.launch()
    vals = []
    for i in range(runs):
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        page.goto("http://localhost:%d%s?sid=fp_%d_%d" % (port, path, port, i),
                  wait_until="load", timeout=60000)
        page.wait_for_timeout(1200)
        v = page.evaluate(
            "() => { const e = performance.getEntriesByName('first-contentful-paint')[0];"
            " return e ? e.startTime : null }")
        if v is not None:
            vals.append(v)
        page.close()
    browser.close()
    vals.sort()
    return vals[len(vals) // 2] if vals else None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--before", type=int, required=True)
    ap.add_argument("--after", type=int, required=True)
    args = ap.parse_args()

    print("comparing %d routes: :%d (before) vs :%d (after)"
          % (len(ROUTES), args.before, args.after))
    with sync_playwright() as pw:
        before = capture(pw, args.before, ROUTES)
        after = capture(pw, args.after, ROUTES)
        fp_b = first_paint(pw, args.before)
        fp_a = first_paint(pw, args.after)

    same = diff = errs = 0
    for path in ROUTES:
        b, a = before[path], after[path]
        if b.startswith("<<ERROR") or a.startswith("<<ERROR"):
            errs += 1
            print("  ERR  %s\n       before: %s\n       after:  %s"
                  % (path, b[:120], a[:120]))
        elif b == a:
            same += 1
        else:
            diff += 1
            i = next((k for k, (x, y) in enumerate(zip(b, a)) if x != y), min(len(b), len(a)))
            print("  DIFF %s\n       before[%d:]: %r\n       after [%d:]: %r"
                  % (path, i, b[i:i + 160], i, a[i:i + 160]))

    print("\nidentical: %d/%d · differing: %d · errored: %d"
          % (same, len(ROUTES), diff, errs))
    print("first contentful paint (median of 3, /byteblaze/dotfiles): "
          "before %s ms · after %s ms"
          % ("%.0f" % fp_b if fp_b else "n/a", "%.0f" % fp_a if fp_a else "n/a"))
    return 1 if (diff or errs) else 0


if __name__ == "__main__":
    sys.exit(main())
