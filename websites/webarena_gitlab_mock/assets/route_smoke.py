#!/usr/bin/env python3
"""
Cold-load regression guard.

`npm run build` is green for a module that references an undefined identifier —
last round four routes including `/` white-screened on a runtime ReferenceError
behind a passing build. This walks a broad route sample in a real browser with a
FRESH ?sid= per route and fails on any console error or uncaught pageerror.

  export LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu
  /tmp/pwvenv/bin/python assets/route_smoke.py [BASE_URL]
"""
import json, sys, os, re
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5211"
HERE = os.path.dirname(os.path.abspath(__file__))

with open(os.path.join(HERE, "task_anchors.json")) as fh:
    ANCHORS = json.load(fh)

routes = [r["path"] for r in ANCHORS["anchor_routes"]]

# Breadth beyond the anchor set: the shells an agent reaches by clicking.
routes += [
    "/dashboard/projects", "/dashboard/projects/starred", "/dashboard/groups",
    "/dashboard/issues", "/dashboard/merge_requests", "/dashboard/todos",
    "/dashboard/activity", "/dashboard/milestones", "/dashboard/snippets",
    "/explore", "/explore/projects/trending", "/explore/projects/starred",
    "/explore/projects/topics", "/explore/groups", "/explore/snippets",
    "/search?search=gitlab", "/-/profile", "/-/profile/account",
    "/-/profile/preferences", "/-/profile/notifications", "/-/profile/keys",
    "/-/profile/emails", "/-/snippets/new", "/projects/new", "/groups/new",
    "/help", "/users/byteblaze", "/users/byteblaze/activity",
    "/users/byteblaze/starred", "/users/byteblaze/following",
    "/byteblaze/dotfiles", "/byteblaze/dotfiles/-/tree/main",
    "/byteblaze/dotfiles/-/branches", "/byteblaze/dotfiles/-/tags",
    "/byteblaze/dotfiles/-/commits/main", "/byteblaze/dotfiles/-/network/main",
    "/byteblaze/dotfiles/-/graphs/main", "/byteblaze/dotfiles/-/graphs/main/charts",
    "/byteblaze/dotfiles/-/find_file/main", "/byteblaze/dotfiles/-/compare",
    "/byteblaze/dotfiles/-/starrers", "/byteblaze/dotfiles/-/forks",
    "/byteblaze/dotfiles/-/forks/new", "/byteblaze/dotfiles/-/issues/new",
    "/byteblaze/dotfiles/-/labels", "/byteblaze/dotfiles/-/labels/new",
    "/byteblaze/dotfiles/-/milestones", "/byteblaze/dotfiles/-/milestones/new",
    "/byteblaze/dotfiles/-/project_members", "/byteblaze/dotfiles/-/boards",
    "/byteblaze/dotfiles/-/pipelines", "/byteblaze/dotfiles/edit",
    "/byteblaze/dotfiles/-/merge_requests/new",
    "/byteblaze/a11y-syntax-highlighting/-/issues",
    "/groups/gitlab-instance-58545a48/-/group_members",
    "/no-such-namespace/no-such-project",   # NotFound must render, not throw
]

# Case-insensitive resolution — verified read-only on the source, which answers
# 301 with the canonical path (BUG-B01 / webarena-396).
CANONICAL = [
    ("/byteblaze/DOTFILES", "/byteblaze/dotfiles"),
    ("/ROOT/metaseq", "/root/metaseq"),
    ("/root/METASEQ", "/root/metaseq"),
    ("/convexegg/ChatGPT", "/convexegg/chatgpt"),
    ("/BYTEBLAZE/dotfiles/-/issues", "/byteblaze/dotfiles/-/issues"),
    ("/ByteBlaze", "/byteblaze"),
    ("/users/ByteBlaze", "/users/byteblaze"),
]

# Vite's HMR/websocket noise and favicon 404s are not app errors.
IGNORE = re.compile(r"favicon|\[vite\]|WebSocket|net::ERR_", re.I)

def main():
    failures, checked = [], 0
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})

        for i, route in enumerate(routes):
            sid = f"smoke_{i}"
            sep = "&" if "?" in route else "?"
            url = f"{BASE}{route}{sep}sid={sid}"
            page = ctx.new_page()
            errs = []
            page.on("console", lambda m: errs.append(f"console.{m.type}: {m.text}")
                    if m.type == "error" and not IGNORE.search(m.text) else None)
            page.on("pageerror", lambda e: errs.append(f"pageerror: {e}"))
            try:
                page.goto(url, wait_until="load", timeout=20000)
                # Wait FOR CONTENT, not for a fixed 350 ms. This used to sleep
                # 350 ms and then assert; that turned a white-screen check into
                # a hidden 350 ms latency budget, and `/search?search=…` broke
                # it the moment the seed grew — that route blocks on the whole
                # `search_bodies` module (GitLab matches description, not just
                # title) and now takes ~1 s to have results. A genuine white
                # screen — the ReferenceError case this file exists for — never
                # fills in, so it still fails, 5 s later instead of 350 ms.
                try:
                    page.wait_for_function(
                        "() => document.body && document.body.innerText.trim().length > 0",
                        timeout=5000)
                except Exception:
                    pass
                body = (page.inner_text("body") or "").strip()
                if not body:
                    errs.append("BLANK PAGE (empty <body> text)")
            except Exception as e:
                errs.append(f"navigation failed: {e}")
            checked += 1
            if errs:
                failures.append((route, errs))
                print(f"FAIL {route}\n      " + "\n      ".join(errs[:4]), flush=True)
            page.close()

        print(f"\n--- case-insensitive path resolution ---")
        for src, want in CANONICAL:
            page = ctx.new_page()
            page.goto(f"{BASE}{src}?sid=canon", wait_until="load", timeout=20000)
            page.wait_for_timeout(300)
            got = page.evaluate("location.pathname")
            sid_kept = "sid=canon" in page.evaluate("location.search")
            ok = got == want and sid_kept
            print(f"{'ok  ' if ok else 'FAIL'} {src} -> {got} (sid kept: {sid_kept})")
            if not ok:
                failures.append((src, [f"expected {want}, got {got}, sid kept {sid_kept}"]))
            page.close()

        browser.close()

    print(f"\nroutes cold-loaded: {checked} · failing: {len(failures)}")
    return 1 if failures else 0

if __name__ == "__main__":
    sys.exit(main())
