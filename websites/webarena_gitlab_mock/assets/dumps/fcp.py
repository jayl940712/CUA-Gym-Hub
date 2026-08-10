#!/usr/bin/env python3
"""First-contentful-paint probe, interleaved across two live servers.

Same method DEV.part-state.md used: N cold loads of /byteblaze/dotfiles per
server, alternating between servers so any host drift hits both equally, then
the median per server. Cold = a brand-new browser context every load (no HTTP
cache, no localStorage) and a fresh ?sid= so state is never reused.

    fcp.py --dev 5321 --preview 5322 --n 5
"""
import argparse
import json
import statistics
import sys
import time

from playwright.sync_api import sync_playwright

PATH = "/byteblaze/dotfiles"


def probe(browser, port, sid):
    ctx = browser.new_context(bypass_csp=False)
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.goto("http://localhost:%d%s?sid=%s" % (port, PATH, sid),
              wait_until="load", timeout=60000)
    # wait for the paint entry to actually exist
    page.wait_for_function(
        "() => performance.getEntriesByName('first-contentful-paint').length > 0",
        timeout=30000)
    m = page.evaluate("""() => {
        const fcp = performance.getEntriesByName('first-contentful-paint')[0];
        const nav = performance.getEntriesByType('navigation')[0];
        return {fcp: fcp.startTime, dcl: nav.domContentLoadedEventEnd,
                load: nav.loadEventEnd};
    }""")
    m["errors"] = errors
    ctx.close()
    return m


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dev", type=int, default=0)
    ap.add_argument("--preview", type=int, default=0)
    ap.add_argument("--n", type=int, default=5)
    ap.add_argument("--label", default="")
    a = ap.parse_args()

    servers = [(k, p) for k, p in (("dev", a.dev), ("preview", a.preview)) if p]
    out = {k: {"fcp": [], "dcl": [], "load": []} for k, _ in servers}
    allerr = []
    with sync_playwright() as pw:
        b = pw.chromium.launch()
        for i in range(a.n):
            for k, port in servers:
                m = probe(b, port, "fcp_%s_%d_%d" % (k, i, int(time.time())))
                for f in ("fcp", "dcl", "load"):
                    out[k][f].append(m[f])
                allerr += m["errors"]
        b.close()

    print("== FCP %s ==" % a.label)
    res = {}
    for k, _ in servers:
        res[k] = {f: round(statistics.median(out[k][f])) for f in ("fcp", "dcl", "load")}
        print("  %-8s FCP median %4d ms  (raw %s)   DCL %4d ms  load %4d ms"
              % (k, res[k]["fcp"], " ".join("%.0f" % v for v in out[k]["fcp"]),
                 res[k]["dcl"], res[k]["load"]))
    print("  console errors: %d %s" % (len(allerr), allerr[:3]))
    print(json.dumps(res))
    return 0


if __name__ == "__main__":
    sys.exit(main())
