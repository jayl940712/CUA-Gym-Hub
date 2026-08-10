#!/usr/bin/env python3
"""DIFFERENTIAL anchor-string check: run it against two builds and diff.

`assets/task_anchors.json` splits into three tiers:

  anchor_routes    145 paths — covered by assets/route_smoke.py
  anchor_strings   252 values, 243 of which name at least one real page
  anchor_locators   25 DOM selectors

READ THIS BEFORE TRUSTING THE ABSOLUTE COUNT. It reports ~238 of 243 pairs
"missing" on a HEALTHY build, and that is a property of the input, not of the
site. `shared/extract-task-anchors.py` keys `anchor_strings` by the string VALUE
globally and unions `pages` across every task that ever asserted it:

    entry = strings[anchor["value"]]        # keyed by value alone
    entry["pages"].add(page["page"] or "last")

So the common values ("Private", "0", "@vinta") accumulate the pages of dozens
of unrelated tasks, and this script's page x string cross-product then demands
each value on every page any task ever paired it with. Many `program_html`
`required_contents` are also only expected AFTER the agent acts (create the
issue, then the page contains X), which a cold load cannot show.

What IS meaningful is the DELTA between two builds:

    /tmp/pwvenv/bin/python assets/dumps/check_anchor_strings.py http://localhost:5321 \\
        | grep '^  MISS' | sort > after.miss
    # same against a worktree of the previous commit on another port
    comm -13 before.miss after.miss     # regressions — must be empty
    comm -23 before.miss after.miss     # fixes

Used exactly that way to clear the 6.4x seed expansion (commit c75e0449d):
238 before, 238 after, byte-identical sets, zero regressions.

    export LD_LIBRARY_PATH=/tmp/sysroot/usr/lib/x86_64-linux-gnu
    /tmp/pwvenv/bin/python assets/dumps/check_anchor_strings.py http://localhost:5321
"""
import collections
import json
import os
import sys

from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:5321"
HERE = os.path.dirname(os.path.abspath(__file__))
ANCHORS = os.path.join(HERE, "..", "task_anchors.json")


def settled_text(page, quiet_ms=400, timeout_ms=15000):
    """innerText once it has stopped changing.

    A fixed sleep is NOT safe here: this script is used to compare a build
    against another build, and the two paint at different speeds (the seed
    expansion moved dev FCP 444 -> 636 ms). Sampling at a fixed 250 ms would
    have read the slower build earlier in its render and manufactured a
    "regression" out of pure timing. Waiting for quiescence removes that bias.
    """
    prev, stable, waited = None, 0, 0
    while waited < timeout_ms:
        text = page.evaluate("() => document.body.innerText")
        if text == prev and text:
            stable += 1
            if stable >= 2:
                return text
        else:
            stable = 0
        prev = text
        page.wait_for_timeout(quiet_ms)
        waited += quiet_ms
    return prev or ""


def main():
    anchors = json.load(open(ANCHORS))
    # page -> [string, ...]
    want = collections.defaultdict(list)
    skipped_answer = skipped_unresolved = 0
    for rec in anchors["anchor_strings"]:
        pages = [p for p in rec["pages"] if p.startswith("/")]
        if not pages:
            if any(p == "(answer)" for p in rec["pages"]):
                skipped_answer += 1
            else:
                skipped_unresolved += 1
            continue
        for p in pages:
            want[p].append(rec["value"])

    print("anchor strings: %d total · %d page-bound over %d pages"
          % (len(anchors["anchor_strings"]), sum(len(v) for v in want.values()),
             len(want)))
    print("  skipped: %d free-text '(answer)' · %d unresolved page ref"
          % (skipped_answer, skipped_unresolved))

    missing, checked, failed_pages = [], 0, 0
    with sync_playwright() as pw:
        browser = pw.chromium.launch()
        ctx = browser.new_context(viewport={"width": 1440, "height": 900})
        for i, (path, values) in enumerate(sorted(want.items())):
            page = ctx.new_page()
            sep = "&" if "?" in path else "?"
            try:
                page.goto("%s%s%ssid=anchor_%d" % (BASE, path, sep, i),
                          wait_until="load", timeout=30000)
                text = settled_text(page)
            except Exception as e:                       # noqa: BLE001
                failed_pages += 1
                missing += [(path, v, "PAGE ERROR: %s" % e) for v in values]
                page.close()
                continue
            for v in values:
                checked += 1
                if v not in text:
                    missing.append((path, v, "not in rendered text"))
            page.close()
        browser.close()

    print("\nchecked %d (string, page) pairs across %d pages" % (checked, len(want)))
    if missing:
        print("MISSING: %d  <- ABSOLUTE COUNT IS NOT A DEFECT COUNT, see module"
              " docstring; diff this list against another build" % len(missing))
        for path, v, why in missing:
            print("  MISS\t%s\t%s\t%s" % (path, v, why))
        return 1
    print("ALL PAGE-BOUND ANCHOR STRINGS PRESENT VERBATIM")
    return 0


if __name__ == "__main__":
    sys.exit(main())
