#!/usr/bin/env python3
"""Cache `git ls-tree -r -l <default-ref>` for every project to /tmp/glcache/.

Read-only. Run once; extract_repo.py then works offline off the cache, so
selection rules can be re-tuned without re-hitting the container.
"""
import json
import os
import sys

import common as C

CACHE = "/tmp/glcache"


def main():
    os.makedirs(CACHE, exist_ok=True)
    projects = C.load("projects.json")
    disk = C.disk_paths()
    refs = {}
    for k, p in enumerate(projects):
        pid, fp = p["id"], p["full_path"]
        d = disk.get(pid)
        if not d:
            continue
        dst = os.path.join(CACHE, "%d.tsv" % pid)
        ref = p.get("default_branch") or C.head_ref(d)
        refs[pid] = ref
        if os.path.exists(dst):
            continue
        try:
            listing = C.git(d, "ls-tree", "-r", "-l", ref, timeout=300)
        except Exception as e:
            print("  !! %s %s" % (fp, e), file=sys.stderr)
            listing = ""
        open(dst, "w").write(listing)
        if k % 25 == 0:
            print("  ...%d/%d" % (k, len(projects)), file=sys.stderr)
    json.dump(refs, open(os.path.join(CACHE, "refs.json"), "w"))
    print("cached %d repos" % len(refs))


if __name__ == "__main__":
    main()
