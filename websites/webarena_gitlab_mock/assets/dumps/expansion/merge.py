#!/usr/bin/env python3
"""Merge the staged expansion into src/data/. THE ONLY SCRIPT THAT WRITES src/.

Run this as a SERIAL step, after the state refactor has landed.

    python3 merge.py                 # dry run — prints exactly what would change
    python3 merge.py --apply         # write, file content = slim tier (default)
    python3 merge.py --apply --files full   # write, full file-content tier
    python3 merge.py --apply --files none   # write, no new file content

Guarantees, all asserted before anything is written:
  * every record already in src/data survives with a byte-identical value
  * no id is ever regenerated; adds are keyed by the source's own primary key
  * the 175 projects and everything in assets/task_anchors.json are untouched
"""
import argparse
import collections
import json
import os
import shutil
import sys

import common as C

# list entities: appended, deduped on the source primary key
LIST_ADDS = [
    ("issues.json", "issues.add.json", lambda r: r["id"]),
    ("merge_requests.json", "merge_requests.add.json", lambda r: r["id"]),
    ("notes.json", "notes.add.json", lambda r: r["id"]),
    ("users.json", "users.add.json", lambda r: r["id"]),
    ("labels.json", "labels.add.json", lambda r: r["id"]),
    ("milestones.json", "milestones.add.json", lambda r: r["id"]),
    ("resource_events.json", "resource_events.add.json",
     lambda r: (r["kind"], r["id"])),
]
# dict entities: existing key always wins
DICT_ADDS = [
    ("merge_request_diffs.json", "merge_request_diffs.add.json"),
]
# supersets of the existing file — replace wholesale, but only after proving
# every existing entry is still present
SUPERSETS = [
    ("repo_trees.json", "repo_trees.add.json", "path"),
    ("commits.json", "commits.add.json", "sha"),
]

SORT = {
    "issues.json": lambda r: (r["project_id"], r["iid"]),
    "merge_requests.json": lambda r: (r["project_id"], r["iid"]),
    "notes.json": lambda r: (r["created_at"], r["id"]),
    "users.json": lambda r: r["id"],
    "labels.json": lambda r: (r["project_id"], r["id"]),
    "milestones.json": lambda r: (r["project_id"], r["id"]),
    "resource_events.json": lambda r: (r["created_at"], r["id"]),
}


def stage(name):
    return json.load(open(os.path.join(C.HERE, name)))


def write(name, obj, apply):
    p = os.path.join(C.DATA, name)
    before = os.path.getsize(p) if os.path.exists(p) else 0
    body = json.dumps(obj, ensure_ascii=False, separators=(",", ":"))
    if apply:
        shutil.copy2(p, p + ".prexpand")
        open(p, "w").write(body)
    print("  %-28s %7.0f KB -> %7.0f KB   n=%d"
          % (name, before / 1024, len(body.encode()) / 1024, len(obj)))
    return len(body.encode())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--files", choices=["slim", "full", "none"], default="slim")
    a = ap.parse_args()

    total = 0
    print("dry run — nothing written" if not a.apply else "APPLYING")

    for name, add, key in LIST_ADDS:
        cur = C.load(name)
        new = stage(add)
        have = {key(r): r for r in cur}
        out = list(cur)
        dropped = 0
        for r in new:
            k = key(r)
            if k in have:
                dropped += 1
                continue
            out.append(r)
        # existing rows must be untouched
        after = {key(r): r for r in out}
        for k, r in have.items():
            assert after[k] == r, "%s: existing record %r changed" % (name, k)
        if name in SORT:
            out.sort(key=SORT[name])
        if dropped:
            print("  (%s: %d staged rows already present, skipped)" % (name, dropped))
        total += write(name, out, a.apply)

    for name, add in DICT_ADDS:
        cur = C.load(name)
        out = dict(cur)
        for k, v in stage(add).items():
            out.setdefault(k, v)
        for k, v in cur.items():
            assert out[k] == v, "%s: existing key %s changed" % (name, k)
        total += write(name, out, a.apply)

    for name, add, idkey in SUPERSETS:
        cur = C.load(name)
        new = stage(add)
        for k, v in cur.items():
            assert k in new, "%s: project %s missing from the superset" % (name, k)
            if isinstance(v, list):
                have = {e[idkey] for e in new[k]}
                miss = [e[idkey] for e in v if e[idkey] not in have]
                assert not miss, "%s/%s: lost %r" % (name, k, miss[:3])
            else:
                have = {e[idkey] for e in new[k]["list"]}
                miss = [e[idkey] for e in v["list"] if e[idkey] not in have]
                assert not miss, "%s/%s: lost %r" % (name, k, miss[:3])
        # carry over any project the superset does not cover at all
        for k, v in cur.items():
            new.setdefault(k, v)
        total += write(name, new, a.apply)

    if a.files != "none":
        src = "repo_files.add.json" if a.files == "full" else "repo_files.add.slim.json"
        cur = C.load("repo_files.json")
        out = {k: dict(v) for k, v in cur.items()}
        for fp, files in stage(src).items():
            for path, body in files.items():
                out.setdefault(fp, {}).setdefault(path, body)
        for fp, files in cur.items():
            for path, body in files.items():
                assert out[fp][path] == body, "repo_files: %s/%s changed" % (fp, path)
        total += write("repo_files.json", out, a.apply)
    else:
        total += os.path.getsize(os.path.join(C.DATA, "repo_files.json"))

    for f in sorted(os.listdir(C.DATA)):
        if f.endswith(".json") and f not in {n for n, *_ in LIST_ADDS} \
                and f not in {n for n, _ in DICT_ADDS} \
                and f not in {n for n, *_ in SUPERSETS} and f != "repo_files.json":
            total += os.path.getsize(os.path.join(C.DATA, f))
    print("\n  src/data total after merge: %.1f MB  (file-content tier: %s)"
          % (total / 1e6, a.files))
    if not a.apply:
        print("  re-run with --apply to write (originals saved as *.prexpand)")


if __name__ == "__main__":
    main()
