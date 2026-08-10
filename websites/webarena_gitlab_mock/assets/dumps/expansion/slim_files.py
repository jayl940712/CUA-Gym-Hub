#!/usr/bin/env python3
"""Derive the slim file-content tier from the full one.

Same records, fewer of them: per project keep the highest-priority files up to
SLIM_FILES / SLIM_BYTES. Priority is the same order extract_repo.py used, so the
slim tier is a strict prefix of the full tier — no different content, just less.
"""
import json
import os

import common as C
from extract_repo import file_priority

SLIM_FILES = 10
SLIM_BYTES = 20 * 1024


def main():
    full = json.load(open(os.path.join(C.HERE, "repo_files.add.json")))
    slim = {}
    n = b = 0
    for fp, files in full.items():
        ranked = sorted(files, key=lambda p: file_priority({"path": p}))
        used = 0
        for path in ranked:
            body = files[path]
            if len(slim.get(fp, {})) >= SLIM_FILES or used + len(body) > SLIM_BYTES:
                continue
            slim.setdefault(fp, {})[path] = body
            used += len(body)
            n += 1
            b += len(body)
    C.save(slim, "repo_files.add.slim.json")
    print("  slim: %d projects, %d files, %.1f MB of content" % (len(slim), n, b / 1e6))


if __name__ == "__main__":
    main()
