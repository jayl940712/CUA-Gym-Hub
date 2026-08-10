#!/usr/bin/env python3
"""Integrity + distribution report for the staged expansion. Writes nothing.

Checks the things a bad merge would silently break:
  * no duplicate id, no duplicate (project_id, iid) after the merge
  * every referenced author/assignee/label/milestone/project resolves
  * no staged row collides with an existing id
  * per-project issue/MR distribution before vs after
"""
import collections
import json
import os

import common as C


def stage(n):
    return json.load(open(os.path.join(C.HERE, n)))


def main():
    ok = True

    def bad(msg):
        nonlocal ok
        ok = False
        print("  FAIL " + msg)

    projects = C.load("projects.json")
    pids = {p["id"] for p in projects}
    issues = C.load("issues.json") + stage("issues.add.json")
    mrs = C.load("merge_requests.json") + stage("merge_requests.add.json")
    notes = C.load("notes.json") + stage("notes.add.json")
    users = {u["id"] for u in C.load("users.json")} | \
            {u["id"] for u in stage("users.add.json")}
    labels = {l["id"] for l in C.load("labels.json")} | \
             {l["id"] for l in stage("labels.add.json")}
    ms = {m["id"] for m in C.load("milestones.json")} | \
         {m["id"] for m in stage("milestones.add.json")}

    print("uniqueness")
    for name, rows in (("issues", issues), ("merge_requests", mrs), ("notes", notes)):
        ids = collections.Counter(r["id"] for r in rows)
        dup = [k for k, v in ids.items() if v > 1]
        if dup:
            bad("%s: %d duplicate ids e.g. %r" % (name, len(dup), dup[:3]))
        else:
            print("  ok   %s: %d unique ids" % (name, len(ids)))
    for name, rows in (("issues", issues), ("merge_requests", mrs)):
        k = collections.Counter((r["project_id"], r["iid"]) for r in rows)
        dup = [x for x, v in k.items() if v > 1]
        if dup:
            bad("%s: duplicate (project_id, iid) e.g. %r" % (name, dup[:3]))
        else:
            print("  ok   %s: (project_id, iid) unique" % name)

    print("referential integrity")
    miss = collections.Counter()
    for r in issues + mrs:
        if r["project_id"] not in pids:
            miss["project"] += 1
        if r["author_id"] and r["author_id"] not in users:
            miss["author"] += 1
        for u in r["assignee_ids"] + r.get("reviewer_ids", []):
            if u not in users:
                miss["assignee"] += 1
        for l in r["label_ids"]:
            if l not in labels:
                miss["label"] += 1
        if r["milestone_id"] and r["milestone_id"] not in ms:
            miss["milestone"] += 1
    iid = {r["id"] for r in issues}
    mid = {r["id"] for r in mrs}
    for nrec in notes:
        if nrec["author_id"] and nrec["author_id"] not in users:
            miss["note_author"] += 1
        tgt = iid if nrec["noteable_type"] == "Issue" else mid
        if nrec["noteable_id"] not in tgt:
            miss["note_target"] += 1
    if miss:
        for k, v in miss.items():
            bad("%d dangling %s references" % (v, k))
    else:
        print("  ok   every author / assignee / label / milestone / target resolves")

    print("per-project distribution")
    bi = collections.Counter(r["project_id"] for r in C.load("issues.json"))
    ai = collections.Counter(r["project_id"] for r in issues)
    bm = collections.Counter(r["project_id"] for r in C.load("merge_requests.json"))
    am = collections.Counter(r["project_id"] for r in mrs)

    def buckets(c):
        b = collections.Counter()
        for p in pids:
            v = c[p]
            b["0" if v == 0 else "1-4" if v < 5 else "5-19" if v < 20
              else "20-49" if v < 50 else "50+"] += 1
        return b

    order = ["0", "1-4", "5-19", "20-49", "50+"]
    print("  issues  before: " + "  ".join("%s=%d" % (k, buckets(bi)[k]) for k in order))
    print("  issues  after : " + "  ".join("%s=%d" % (k, buckets(ai)[k]) for k in order))
    print("  MRs     before: " + "  ".join("%s=%d" % (k, buckets(bm)[k]) for k in order))
    print("  MRs     after : " + "  ".join("%s=%d" % (k, buckets(am)[k]) for k in order))
    print("  projects with >=1 issue: %d -> %d   with >=1 MR: %d -> %d"
          % (len(bi), len(ai), len(bm), len(am)))

    trees = stage("repo_trees.add.json")
    files = stage("repo_files.add.json")
    print("  projects with a file tree: %d   with real file content: %d"
          % (len(trees), len(files)))
    print("\n%s" % ("ALL CHECKS PASSED" if ok else "CHECKS FAILED"))
    return 0 if ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
