#!/usr/bin/env python3
"""Measure the reddit mock's state cost: state size, /go payload, first paint,
localStorage keys held. Run identically before and after the overlay refactor.

    /tmp/pwvenv/bin/python assets/dumps/measure_state.py [--port 5312] [--width 1920]
"""
import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request

from playwright.sync_api import sync_playwright

ap = argparse.ArgumentParser()
ap.add_argument("--port", type=int, default=5312)
ap.add_argument("--width", type=int, default=1920)
ap.add_argument("--label", default="")
args = ap.parse_args()

BASE = f"http://localhost:{args.port}"
SID = f"measure{int(time.time())}"
H = 1080 if args.width >= 1920 else 720


def get(path):
    req = urllib.request.Request(BASE + path)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


out = {"label": args.label, "width": args.width}

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={"width": args.width, "height": H})
    pg = ctx.new_page()
    errors = []
    externals = []
    pg.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("request", lambda r: externals.append(r.url)
          if not r.url.startswith(BASE) and not r.url.startswith("data:") else None)

    t0 = time.time()
    pg.goto(f"{BASE}/f/Art?sid={SID}", wait_until="load")
    pg.wait_for_selector("h1, .submission", timeout=30000)
    out["first_paint_ms"] = round((time.time() - t0) * 1000)

    ls = pg.evaluate(
        "() => Object.keys(localStorage).filter(k => k.startsWith('webarena_reddit_mock_'))"
        ".map(k => [k, localStorage.getItem(k).length])")
    out["localstorage_keys"] = len(ls)
    out["localstorage_chars"] = sum(n for _, n in ls)
    out["localstorage_detail"] = ls

    out["posts_on_page"] = pg.eval_on_selector_all(".submission", "els => els.length")

    out["go_cold_bytes"] = len(get(f"/go?sid={SID}"))

    # one vote
    pg.click(".submission .vote__up >> nth=0")
    pg.wait_for_timeout(1200)
    out["go_after_vote_bytes"] = len(get(f"/go?sid={SID}"))
    # what the client POSTed = the app state it holds
    out["state_bytes"] = len(json.dumps(json.loads(get(f"/state?sid={SID}"))["stored_state"]))
    go = json.loads(get(f"/go?sid={SID}"))
    out["diff_keys"] = sorted(go.get("state_diff", {}).keys())
    out["diff_bytes"] = len(json.dumps(go.get("state_diff", {})))
    out["initial_bytes"] = len(json.dumps(go.get("initial_state")))
    out["current_bytes"] = len(json.dumps(go.get("current_state")))

    sf = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                      "..", "..", ".mock-states", SID + ".json")
    out["persisted_file_bytes"] = os.path.getsize(sf) if os.path.exists(sf) else None

    out["console_errors"] = errors[:10]
    out["external_requests"] = externals[:10]
    b.close()

print(json.dumps(out, indent=2))
