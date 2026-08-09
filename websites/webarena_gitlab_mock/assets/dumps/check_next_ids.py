#!/usr/bin/env python3
"""Re-derive SEED_NEXT_IDS from the seed and check the literals in overlayShape.js.

The id-allocation floors used to be computed at module load as `max(seed id)+1`,
which required every seed array imported into `dataManager.js` — and
`vite.config.js` imports that module, so it dragged the whole 2 MB corpus into
the node process answering `/go`. They are literals now
(`src/utils/overlayShape.js`), which means they can drift if the seed is
resampled. This is the check; `overlay.checkSeedNextIds()` is the same check at
runtime in DEV.

A counter that starts INSIDE the seed's id range mints a duplicate id,
`stateTracker.indexBy()` keys by id, the second record silently replaces the
first, and `/go` reports a creation as an edit to seed data.

    python3 assets/dumps/check_next_ids.py          # verify, exit 1 on drift
    python3 assets/dumps/check_next_ids.py --emit   # print the literal block
"""
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(MOCK, "src", "data")
SHAPE = os.path.join(MOCK, "src", "utils", "overlayShape.js")

# allocateId(kind) -> seed file
KINDS = [
    ("project", "projects.json"),
    ("group", "groups.json"),
    ("issue", "issues.json"),
    ("mr", "merge_requests.json"),
    ("note", "notes.json"),
    ("label", "labels.json"),
    ("milestone", "milestones.json"),
    ("member", "members.json"),
]


def derived():
    out = {}
    for kind, fname in KINDS:
        with open(os.path.join(DATA, fname), encoding="utf8") as fh:
            rows = json.load(fh)
        out[kind] = max((r.get("id") or 0) for r in rows) + 1
    return out


def literals():
    src = open(SHAPE, encoding="utf8").read()
    block = re.search(r"SEED_NEXT_IDS = Object\.freeze\(\{(.*?)\}\)", src, re.S)
    if not block:
        sys.exit("could not find SEED_NEXT_IDS in %s" % SHAPE)
    return {k: int(v) for k, v in re.findall(r"(\w+):\s*(\d+)", block.group(1))}


def main():
    want, have = derived(), literals()
    if "--emit" in sys.argv:
        print("export const SEED_NEXT_IDS = Object.freeze({")
        for kind, _ in KINDS:
            print("  %s: %d," % (kind, want[kind]))
        print("})")
        return 0

    bad = []
    for kind, _ in KINDS:
        if have.get(kind) != want[kind]:
            bad.append("  %-10s literal %-8s derived %s"
                       % (kind, have.get(kind), want[kind]))
    if bad:
        print("SEED_NEXT_IDS in src/utils/overlayShape.js has DRIFTED:")
        print("\n".join(bad))
        print("\nRerun with --emit and paste the block.")
        return 1
    print("SEED_NEXT_IDS matches the seed (%d counters)." % len(KINDS))
    return 0


if __name__ == "__main__":
    sys.exit(main())
