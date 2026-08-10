#!/usr/bin/env python3
"""Measure, per project, how big a full recursive tree + text blobs would be.

Writes repo_measure.json — used to size the file-content pull BEFORE staging it.
Read-only: one `git ls-tree -r -l` per repo.
"""
import json
import os
import sys

import common as C

TEXT_EXT = (".md", ".txt", ".html", ".css", ".scss", ".sass", ".js", ".jsx",
            ".mjs", ".ts", ".tsx", ".json", ".yml", ".yaml", ".sh", ".zsh",
            ".bash", ".py", ".rb", ".toml", ".cfg", ".ini", ".xml", ".svg",
            ".gitignore", ".gitattributes", ".editorconfig", ".vim", ".conf",
            ".java", ".c", ".cc", ".cpp", ".h", ".hpp", ".go", ".php", ".rs",
            ".swift", ".kt", ".m", ".mm", ".pl", ".sql", ".r", ".jl", ".ex",
            ".exs", ".erl", ".lua", ".tex", ".gradle", ".properties", ".bat",
            ".ps1", ".dockerfile", ".mk", ".cmake", ".proto", ".graphql",
            ".vue", ".rst", ".org", ".el", ".clj", ".scala", ".hs", ".dart")
NO_EXT_DOC = ("readme", "license", "licence", "copying", "contributing",
              "changelog", "changes", "authors", "notice", "makefile",
              "dockerfile", "rakefile", "gemfile", "procfile", "vagrantfile",
              "code_of_conduct", "codeowners", "todo", "install", "news")


def is_text(path):
    base = path.rsplit("/", 1)[-1].lower()
    if base.startswith("."):
        return True
    if "." not in base:
        return base in NO_EXT_DOC
    return base.endswith(TEXT_EXT)


def main():
    projects = C.load("projects.json")
    disk = C.disk_paths()
    out = {}
    for k, p in enumerate(projects):
        pid = p["id"]
        fp = p["full_path"]
        d = disk.get(pid)
        if not d:
            continue
        ref = p.get("default_branch") or C.head_ref(d)
        try:
            listing = C.git(d, "ls-tree", "-r", "-l", ref)
        except Exception as e:
            print("  !! %s %s" % (fp, e), file=sys.stderr)
            continue
        entries = []
        for ln in listing.splitlines():
            try:
                meta, path = ln.split("\t", 1)
                mode, typ, sha, size = meta.split()
            except ValueError:
                continue
            entries.append((path, mode, sha, int(size) if size.isdigit() else 0))
        txt = [e for e in entries if is_text(e[0])]
        out[fp] = {
            "pid": pid,
            "ref": ref,
            "n_entries": len(entries),
            "n_dirs": len({e[0].rsplit("/", 1)[0] for e in entries if "/" in e[0]}),
            "n_text": len(txt),
            "text_bytes": sum(e[3] for e in txt),
            "text_bytes_le24k": sum(e[3] for e in txt if e[3] <= 24576),
            "n_text_le24k": sum(1 for e in txt if e[3] <= 24576),
        }
        if k % 25 == 0:
            print("  ...%d/%d" % (k, len(projects)), file=sys.stderr)
    json.dump(out, open(os.path.join(C.HERE, "repo_measure.json"), "w"), indent=0)
    tot = lambda f: sum(v[f] for v in out.values())
    print("repos measured: %d" % len(out))
    print("  entries total      : %d" % tot("n_entries"))
    print("  text files total   : %d" % tot("n_text"))
    print("  text bytes total   : %.1f MB" % (tot("text_bytes") / 1e6))
    print("  text <=24k bytes   : %.1f MB (%d files)"
          % (tot("text_bytes_le24k") / 1e6, tot("n_text_le24k")))


if __name__ == "__main__":
    main()
