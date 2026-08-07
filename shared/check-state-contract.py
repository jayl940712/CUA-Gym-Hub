#!/usr/bin/env python3
"""
check-state-contract.py — audit every mock's dev-mode state API against the contract.

THE CONTRACT (shared/secureMockApiPlugin.mjs is the reference implementation):

    action 'set'          -> write <sid>.json AND <sid>.initial.json   (seeds the baseline)
    action 'set_current'  -> write <sid>.json ONLY                     (never the baseline)
    GET /go               -> initial := <sid>.initial.json, else createInitialData()
                             NEVER fall back to the current state

TWO DEFECTS, and a mock needs BOTH fixed to be correct:

  A. `set_current` writes the baseline.
     On a fresh session the first mutation becomes the baseline, so initial ==
     current and /go reports state_diff = [] forever.

  B. /go falls back to the current state when no baseline file exists:
         const initial = initialState || currentState || defaultState
     This turns a missing baseline into a self-comparison — the same empty diff by
     another route. Fixing A alone just relocates the bug here, because neither
     client ever calls action 'set' (only the eval harness does), so a plain
     browsing session never has a baseline file at all.

The correct /go line is:
         const initial = initialState || defaultState

which baselines a never-seeded sid against createInitialData(). That is only sound
if the server's createInitialData() matches what the client boots from — verify
per mock with: GET /go?sid=<untouched> should report state_diff == [].

Usage:
    python3 shared/check-state-contract.py           # full report
    python3 shared/check-state-contract.py --list    # affected mock names only

Exit code 1 if any mock violates either half of the contract.
"""
import re
import os
import glob
import sys

W = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "websites")


def strip_comments(s):
    s = re.sub(r'/\*.*?\*/', '', s, flags=re.S)
    return re.sub(r'(?m)//[^\n]*$', '', s)


def branch_body(src, action):
    """Balanced { ... } body of `if (action === '<action>') {`, or None."""
    m = re.search(r"if\s*\(\s*action\s*===\s*['\"]" + action + r"['\"]\s*\)\s*\{", src)
    if not m:
        return None
    i = m.end() - 1
    depth = 0
    for j in range(i, len(src)):
        if src[j] == '{':
            depth += 1
        elif src[j] == '}':
            depth -= 1
            if depth == 0:
                return src[i:j + 1]
    return None


BASELINE_WRITE = re.compile(r'writeInitialState\w*\s*\(|writeJson\s*\(\s*initialPath|initialPath\s*\(')
# `const initial = initialState || currentState || ...`  (any identifier holding the current state)
GO_FALLBACK = re.compile(
    r'(?:const|let|var)\s+initial\s*=\s*[A-Za-z_$][\w$]*\s*\|\|\s*(current\w*|state)\b')

rows = []
for f in sorted(glob.glob(os.path.join(W, "*", "vite.config.js"))):
    name = os.path.basename(os.path.dirname(f))
    src = strip_comments(open(f, encoding='utf8', errors='replace').read())

    sc = branch_body(src, 'set_current')
    defect_a = bool(sc and BASELINE_WRITE.search(sc))
    shape = sc is not None

    defect_b = bool(GO_FALLBACK.search(src))

    rows.append({
        'name': name,
        'A': defect_a,
        'B': defect_b,
        'shape': shape,
        'set_initial': branch_body(src, 'set_initial') is not None,
    })

bad = [r for r in rows if r['A'] or r['B']]

if "--list" in sys.argv:
    print("\n".join(r['name'] for r in bad))
    sys.exit(1 if bad else 0)

only_a = [r for r in rows if r['A'] and not r['B']]
only_b = [r for r in rows if r['B'] and not r['A']]
both = [r for r in rows if r['A'] and r['B']]
clean = [r for r in rows if not r['A'] and not r['B']]
noshape = [r for r in rows if not r['shape']]

print(f"  scanned {len(rows)} mocks")
print(f"    clean (both halves correct) : {len(clean)}")
print(f"    defect A only (set_current) : {len(only_a)}")
print(f"    defect B only (/go fallback): {len(only_b)}")
print(f"    BOTH defects                : {len(both)}")
print(f"    no set_current branch       : {len(noshape)}")
print(f"    -> needing work             : {len(bad)}")

print("\n  WebArena mocks + template:")
for r in rows:
    if r['name'].startswith('webarena_') or r['name'] == 'mixpanel_mock':
        st = "clean" if not (r['A'] or r['B']) else ("A+B" if r['A'] and r['B'] else ("A" if r['A'] else "B"))
        print(f"    {r['name']:<30} {st:<6} set_initial={'yes' if r['set_initial'] else 'no'}")

if both:
    print(f"\n  BOTH defects ({len(both)}):")
    print("    " + ", ".join(r['name'] for r in both))
if only_a:
    print(f"\n  defect A only ({len(only_a)}):")
    print("    " + ", ".join(r['name'] for r in only_a))
if only_b:
    print(f"\n  defect B only ({len(only_b)}):")
    print("    " + ", ".join(r['name'] for r in only_b))

sys.exit(1 if bad else 0)
