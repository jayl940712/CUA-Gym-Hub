#!/usr/bin/env python3
"""Expansion stage 3 — deeper commit history, and MR commit lists for the new MRs.

commits.json    : `git log` on the default ref, DEPTH per project (one docker
                  exec per repo), merged over the existing shallower lists.
merge_request_diffs.json : from merge_request_diffs + merge_request_diff_commits,
                  for the MRs added by extract_db.py.

Read-only throughout.
"""
import collections
import json
import os
import sys

import common as C

DEPTH = 30          # commits per project on the default ref
MR_COMMITS = 10     # commits listed per newly added MR
SEP = "\x1e"


def main():
    projects = C.load("projects.json")
    disk = C.disk_paths()
    ex_commits = C.load("commits.json")
    ex_diffs = C.load("merge_request_diffs.json")

    # ---------------------------------------------------------- commits
    print("commits")
    commits = {}
    for k, p in enumerate(projects):
        pid, fp = p["id"], p["full_path"]
        d = disk.get(pid)
        if not d:
            continue
        ref = (ex_commits.get(fp) or {}).get("ref") or p.get("default_branch") or "main"
        try:
            log = C.git(d, "log", "--format=%H{0}%an{0}%ae{0}%aI{0}%cI{0}%s".format(SEP),
                        "-n", str(DEPTH), ref, timeout=120)
        except Exception as e:
            print("  !! %s %s" % (fp, e), file=sys.stderr)
            continue
        lst = []
        # NOT splitlines(): python treats \x1e (our field separator) as a line
        # boundary, which silently yields one field per line.
        for ln in log.split("\n"):
            f = ln.split(SEP)
            if len(f) != 6:
                continue
            lst.append({"sha": f[0], "author_name": f[1], "author_email": f[2],
                        "authored_date": f[3], "committed_date": f[4], "title": f[5]})
        if not lst:
            continue
        # union with what is already seeded, preserving existing order first
        old = (ex_commits.get(fp) or {}).get("list", [])
        seen = {c["sha"] for c in old}
        merged = list(old) + [c for c in lst if c["sha"] not in seen]
        commits[fp] = {"ref": ref, "list": merged}
        if k % 40 == 0:
            print("  ...%d/%d" % (k, len(projects)), file=sys.stderr)

    # ---------------------------------------------------------- MR diffs
    print("merge request diffs")
    new_mrs = json.load(open(os.path.join(C.HERE, "merge_requests.add.json")))
    ids = [m["id"] for m in new_mrs]
    diffs = {}

    def chunks(seq, n=300):
        for k in range(0, len(seq), n):
            yield seq[k:k + n]

    for ch in chunks(ids):
        inl = ",".join(map(str, ch))
        # latest diff record per MR
        head = {}
        for r in C.qj("""SELECT DISTINCT ON (merge_request_id) merge_request_id,
                id, commits_count, files_count FROM merge_request_diffs
                WHERE merge_request_id IN (%s) ORDER BY merge_request_id, id DESC""" % inl):
            head[r["merge_request_id"]] = r
        if not head:
            continue
        dids = ",".join(str(v["id"]) for v in head.values())
        by_diff = collections.defaultdict(list)
        for r in C.qj("""SELECT merge_request_diff_id, encode(sha,'hex') AS sha,
                left(message, 400) AS message,
                (SELECT name FROM merge_request_diff_commit_users u
                   WHERE u.id=c.commit_author_id) AS author_name,
                (SELECT email FROM merge_request_diff_commit_users u
                   WHERE u.id=c.commit_author_id) AS author_email,
                authored_date::text, committed_date::text
                FROM merge_request_diff_commits c
                WHERE merge_request_diff_id IN (%s) AND relative_order < %d
                ORDER BY merge_request_diff_id, relative_order""" % (dids, MR_COMMITS)):
            by_diff[r["merge_request_diff_id"]].append(
                [r["sha"], (r["message"] or "").strip().split("\n")[0],
                 r["author_name"] or "", r["author_email"] or "",
                 r["authored_date"], r["committed_date"]])
        for mid, h in head.items():
            key = str(mid)
            if key in ex_diffs:
                continue
            diffs[key] = {"commits_count": h["commits_count"] or 0,
                          "files_count": h["files_count"] or 0,
                          "commits": by_diff.get(h["id"], [])}

    C.save(commits, "commits.add.json")
    C.save(diffs, "merge_request_diffs.add.json")
    stats = {
        "depth": DEPTH, "mr_commits": MR_COMMITS,
        "commits": {"projects": len(commits),
                    "before_total": sum(len(v["list"]) for v in ex_commits.values()),
                    "after_total": sum(len(v["list"]) for v in commits.values())},
        "merge_request_diffs": {"before": len(ex_diffs), "added": len(diffs),
                                "after": len(ex_diffs) + len(diffs)},
    }
    json.dump(stats, open(os.path.join(C.HERE, "stats_git2.json"), "w"), indent=1)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
