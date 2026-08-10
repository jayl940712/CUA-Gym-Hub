#!/usr/bin/env python3
"""Shared helpers for the gitlab seed expansion.

STRICTLY READ-ONLY against the `gitlab` container:
  - postgres via `docker exec gitlab gitlab-psql` (SELECT only)
  - git via `docker exec gitlab /opt/gitlab/embedded/bin/git --git-dir=... <read cmd>`

Nothing here writes to the container or to src/data.
"""
import json
import os
import subprocess

HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.abspath(os.path.join(HERE, "..", "..", ".."))
DATA = os.path.join(MOCK, "src", "data")
GIT = "/opt/gitlab/embedded/bin/git"
REPOS = "/var/opt/gitlab/git-data/repositories"


def q(sql):
    """Run a read-only SELECT and return list[dict]. Refuses anything else."""
    head = sql.strip().lstrip("(").split(None, 1)[0].upper()
    if head not in ("SELECT", "WITH"):
        raise RuntimeError("read-only: refusing %r" % head)
    p = subprocess.run(
        ["docker", "exec", "gitlab", "gitlab-psql", "-At", "-F", "\x1f",
         "--no-align", "-c", sql],
        capture_output=True)
    if p.returncode != 0:
        raise RuntimeError(p.stderr.decode()[:2000])
    return p.stdout.decode("utf-8", "replace")


def qj(sql):
    """Run a read-only SELECT and return list[dict], via postgres-side JSON.

    Going through json_agg avoids every quoting/newline hazard in issue
    descriptions and note bodies, which routinely contain tabs, pipes and
    embedded newlines.
    """
    out = q("SELECT coalesce(json_agg(t), '[]'::json) FROM (%s) t"
            % sql.strip().rstrip(";"))
    return json.loads(out.strip() or "[]")


def rows(sql, cols):
    out = []
    for line in q(sql).split("\n"):
        if not line:
            continue
        parts = line.split("\x1f")
        if len(parts) != len(cols):
            continue
        out.append(dict(zip(cols, parts)))
    return out


def n(v):
    return None if v == "" else v


def i(v):
    return None if v == "" else int(v)


def load(name):
    return json.load(open(os.path.join(DATA, name)))


def save(obj, name, where=HERE):
    p = os.path.join(where, name)
    json.dump(obj, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
    sz = os.path.getsize(p)
    ln = len(obj)
    print("  %-34s %8.1f KB  (%d)" % (name, sz / 1024, ln))
    return sz


# ---------------------------------------------------------------- git access
def disk_paths():
    """project_id -> on-disk repo path (relative to REPOS, no .git suffix)."""
    out = {}
    for r in rows("SELECT project_id, disk_path FROM project_repositories",
                  ["pid", "disk"]):
        out[int(r["pid"])] = r["disk"]
    return out


def git(disk, *args, binary=False, timeout=120):
    r = "%s/%s.git" % (REPOS, disk)
    p = subprocess.run(
        ["docker", "exec", "gitlab", GIT, "--git-dir=" + r] + list(args),
        capture_output=True, timeout=timeout)
    return p.stdout if binary else p.stdout.decode("utf-8", "replace")


def head_ref(disk):
    out = git(disk, "symbolic-ref", "--short", "HEAD").strip()
    return out or "master"
