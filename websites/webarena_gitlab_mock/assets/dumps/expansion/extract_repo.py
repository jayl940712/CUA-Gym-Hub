#!/usr/bin/env python3
"""Expansion stage 2 — real file trees and real file content.

Works off the /tmp/glcache listings written by cache_trees.py, so the selection
rule can be re-tuned without re-walking the repos. Blob content is pulled with a
SINGLE `git cat-file --batch` per repo (one docker exec, not one per file);
that is the difference between ~3 minutes and ~20.

Read-only: `git ls-tree` (cached) and `git cat-file --batch`. No API, no writes.

Outputs
  repo_trees.add.json   full merged tree per project (replaces, not appends —
                        the existing trees are truncated subsets of these)
  repo_files.add.json   path -> content, additive over the existing README-only map
"""
import collections
import json
import os
import subprocess
import sys

import common as C

CACHE = "/tmp/glcache"

TREE_CAP = 400          # entries per project; p75 upstream is 256
BLOB_MAX = 16 * 1024    # per file
FILES_PER_REPO = 25
BYTES_PER_REPO = 60 * 1024

from measure_repos import is_text  # noqa: E402  (shared classifier)

DOC = ("readme", "license", "licence", "copying", "contributing", "changelog",
       "changes", "code_of_conduct", "authors", "notice", "install", "todo",
       "security", "support", "history", "news")
ROOT_CONFIG = ("package.json", "setup.py", "setup.cfg", "pyproject.toml",
               "requirements.txt", "gemfile", "cargo.toml", "go.mod",
               "composer.json", "makefile", "dockerfile", "docker-compose.yml",
               ".gitignore", ".editorconfig", ".travis.yml", "tox.ini",
               "index.js", "index.html", "main.py", "app.py", "manifest.json")


def read_tree(pid):
    p = os.path.join(CACHE, "%d.tsv" % pid)
    if not os.path.exists(p):
        return []
    out = []
    for ln in open(p, encoding="utf-8", errors="replace"):
        try:
            meta, path = ln.rstrip("\n").split("\t", 1)
            mode, typ, sha, size = meta.split()
        except ValueError:
            continue
        if typ != "blob":
            continue
        out.append({"path": path, "type": "blob", "mode": mode,
                    "size": int(size) if size.isdigit() else 0, "sha": sha})
    return out


def tree_slice(entries):
    """Cap a tree while keeping it a coherent, browsable hierarchy.

    Shallow paths first, so capping truncates the deep corners of a huge repo
    rather than lopping off whole top-level directories.
    """
    if len(entries) <= TREE_CAP:
        return sorted(entries, key=lambda e: e["path"])
    ranked = sorted(entries, key=lambda e: (e["path"].count("/"), e["path"]))
    return sorted(ranked[:TREE_CAP], key=lambda e: e["path"])


def file_priority(e):
    path = e["path"]
    base = path.rsplit("/", 1)[-1].lower()
    depth = path.count("/")
    if depth == 0 and base.split(".")[0] in DOC:
        return (0, path)
    if depth == 0 and base in ROOT_CONFIG:
        return (1, path)
    if depth == 0:
        return (2, path)
    if base.split(".")[0] in DOC:
        return (3, path)
    return (4 + min(depth, 5), path)


def pick_files(entries, already):
    cand = [e for e in entries
            if is_text(e["path"]) and 0 < e["size"] <= BLOB_MAX
            and e["path"] not in already]
    cand.sort(key=file_priority)
    out, used = [], 0
    for e in cand:
        if len(out) >= FILES_PER_REPO or used + e["size"] > BYTES_PER_REPO:
            continue
        out.append(e)
        used += e["size"]
    return out


def cat_batch(disk, shas):
    """One `git cat-file --batch` per repo. Returns sha -> bytes."""
    if not shas:
        return {}
    r = "%s/%s.git" % (C.REPOS, disk)
    p = subprocess.run(
        ["docker", "exec", "-i", "gitlab", C.GIT, "--git-dir=" + r,
         "cat-file", "--batch"],
        input=("\n".join(shas) + "\n").encode(), capture_output=True, timeout=600)
    out, pos, got = p.stdout, 0, {}
    while pos < len(out):
        nl = out.find(b"\n", pos)
        if nl < 0:
            break
        header = out[pos:nl].decode("utf-8", "replace").split()
        pos = nl + 1
        if len(header) < 3:
            continue                       # "<sha> missing"
        sha, _typ, size = header[0], header[1], int(header[2])
        got[sha] = out[pos:pos + size]
        pos += size + 1                    # trailing newline
    return got


def main():
    projects = C.load("projects.json")
    disk = C.disk_paths()
    ex_trees = C.load("repo_trees.json")
    ex_files = C.load("repo_files.json")

    trees, files = {}, {}
    n_entries = n_files = n_bytes = 0
    for k, p in enumerate(projects):
        pid, fp = p["id"], p["full_path"]
        d = disk.get(pid)
        entries = read_tree(pid)
        if not entries:
            continue
        sl = tree_slice(entries)
        # keep every path the current seed already exposes, even if the cap
        # would have dropped it — those paths may be linked from a task anchor
        have_paths = {e["path"] for e in sl}
        for e in ex_trees.get(fp, []):
            if e["path"] not in have_paths:
                sl.append(e)
                have_paths.add(e["path"])
        sl.sort(key=lambda e: e["path"])

        # Pull content BEFORE the sha is shortened for the tree — cat-file needs
        # the full 40-char oid, and tree_slice hands back the same dict objects.
        want = [e for e in pick_files(entries, set(ex_files.get(fp, {})))
                if e["path"] in have_paths]
        full_sha = {e["path"]: e["sha"] for e in want}
        got = cat_batch(d, sorted(set(full_sha.values()))) if d else {}

        for e in sl:
            e["sha"] = e["sha"][:8]
        trees[fp] = sl
        n_entries += len(sl)

        if k % 25 == 0:
            print("  ...%d/%d" % (k, len(projects)), file=sys.stderr)
        for e in want:
            body = got.get(full_sha[e["path"]])
            if not body:
                continue
            try:
                txt = body.decode("utf-8")
            except UnicodeDecodeError:
                continue
            if "\x00" in txt:
                continue
            if len(txt) > BLOB_MAX:
                txt = txt[:BLOB_MAX] + "\n… (truncated)"
            files.setdefault(fp, {})[e["path"]] = txt
            n_files += 1
            n_bytes += len(txt)

    C.save(trees, "repo_trees.add.json")
    C.save(files, "repo_files.add.json")
    stats = {"tree_cap": TREE_CAP, "files_per_repo": FILES_PER_REPO,
             "bytes_per_repo": BYTES_PER_REPO, "blob_max": BLOB_MAX,
             "projects_with_tree": len(trees), "tree_entries": n_entries,
             "projects_with_files": len(files), "files": n_files,
             "file_bytes": n_bytes}
    json.dump(stats, open(os.path.join(C.HERE, "stats_repo.json"), "w"), indent=1)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
