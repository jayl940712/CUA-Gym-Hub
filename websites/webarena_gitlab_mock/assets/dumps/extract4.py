#!/usr/bin/env python3
"""Stage 4: git data — trees, blobs, commits, contributors, branches."""
import json, os, subprocess, collections

OUT = "/webarena/CUA-Gym-Hub/websites/webarena_gitlab_mock/src/data"
ctx = json.load(open("/tmp/recon/gitlab/ctx.json"))
disk = {int(k): v for k, v in ctx["disk"].items()}
full = {int(k): v for k, v in ctx["full"].items()}
default_branch = {int(k): v for k, v in ctx["default_branch"].items()}
projects = json.load(open(OUT + "/projects.json"))
GIT = "/opt/gitlab/embedded/bin/git"

def g(pid, *args, binary=False):
    if pid not in disk: return b"" if binary else ""
    r = "/var/opt/gitlab/git-data/repositories/%s.git" % disk[pid]
    p = subprocess.run(["docker", "exec", "gitlab", GIT, "--git-dir=" + r] + list(args),
                       capture_output=True)
    return p.stdout if binary else p.stdout.decode("utf-8", "replace")

def write(name, obj):
    p = os.path.join(OUT, name)
    json.dump(obj, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"  {name}: {os.path.getsize(p)/1024:.0f} KB ({len(obj)})")

# projects that a task anchor actually reads deeply
DEEP_PATHS = {p["full_path"] for p in projects if p["full_path"].startswith("byteblaze/")}
DEEP_PATHS |= {"a11yproject/a11yproject.com", "primer/design", "root/metaseq",
               "convexegg/chatgpt", "convexegg/super_awesome_robot",
               "vinta/awesome-python", "eriklindernoren/PyTorch-GAN", "yjlou/2019-nCov",
               "aklsh/dots", "aklsh/CacheEval", "aklsh/SimCache", "aklsh/nvidia-patch",
               "aklsh/viewgrades-scraper", "keylase/nvidia-patch",
               "murale127/viewgrades-scraper", "koush/AndroidAsync",
               "lahwaacz/arch-wiki-docs", "auth0/angular-storage",
               "panicsteve/cloud-to-butt", "amwhalen/archive-my-tweets",
               "dehenne/awesome-visibility", "thoughtbot/administrate",
               "umano/AndroidSlidingUpPanel", "wireservice/csvkit",
               "facebook/create-react-app", "facebook/buck",
               "mk-j/PHP_XLSXWriter", "xiaozi/solarized-prism-theme",
               "CellularPrivacy/Android-IMSI-Catcher-Detector",
               "0ang3el/aem-hacker", "kkroening/ffmpeg-python"}
DEEP = {p["id"] for p in projects if p["full_path"] in DEEP_PATHS}

# projects whose CONTRIBUTOR GRAPH a task reads (name, email, per-day counts)
GRAPH = {  # full_path -> [refs to aggregate]
 "a11yproject/a11yproject.com": ["main"],
 "byteblaze/a11y-webring.club": ["main"],
 "primer/design": ["main"],
 "thoughtbot/administrate": ["main"],
 "umano/AndroidSlidingUpPanel": ["master"],
 "eriklindernoren/PyTorch-GAN": ["master"],
 "wireservice/csvkit": ["master"],
 "facebook/create-react-app": ["main"],
 "root/metaseq": ["main"],
 "yjlou/2019-nCov": ["master"],
 "vinta/awesome-python": ["main", "master"],
 "dehenne/awesome-visibility": ["master", "main"],
 "amwhalen/archive-my-tweets": ["php52", "master", "main"],
}

# ---------------------------------------------------------------- branches
print("branches")
branches = {}
for p in projects:
    pid = p["id"]
    out = g(pid, "for-each-ref", "--format=%(refname:short)|%(objectname)|%(committerdate:iso-strict)|%(contents:subject)",
            "--sort=-committerdate", "refs/heads/")
    rows = []
    for ln in out.splitlines()[:40]:
        parts = ln.split("|", 3)
        if len(parts) < 3: continue
        rows.append({"name": parts[0], "sha": parts[1][:8], "committed_date": parts[2],
                     "subject": (parts[3] if len(parts) > 3 else "")[:120]})
    if rows: branches[p["full_path"]] = rows
write("branches.json", branches)

print("tags")
tags = {}
for p in projects:
    if p["id"] not in DEEP: continue
    out = g(p["id"], "for-each-ref", "--format=%(refname:short)|%(objectname)|%(creatordate:iso-strict)|%(contents:subject)",
            "--sort=-creatordate", "refs/tags/")
    rows = []
    for ln in out.splitlines()[:25]:
        parts = ln.split("|", 3)
        if len(parts) < 3: continue
        rows.append({"name": parts[0], "sha": parts[1][:8], "date": parts[2],
                     "message": (parts[3] if len(parts) > 3 else "")[:120]})
    if rows: tags[p["full_path"]] = rows
write("tags.json", tags)

# ---------------------------------------------------------------- commits
print("commits")
commits = {}
for p in projects:
    pid = p["id"]; ref = default_branch.get(pid, "main")
    n = 40 if pid in DEEP else 10
    out = g(pid, "log", ref, f"-n{n}",
            "--format=%H%x01%an%x01%ae%x01%aI%x01%cI%x01%s")
    rows = []
    for ln in out.splitlines():
        f = ln.split("\x01")
        if len(f) < 6: continue
        rows.append({"sha": f[0], "author_name": f[1], "author_email": f[2],
                     "authored_date": f[3], "committed_date": f[4],
                     "title": f[5][:160]})
    if rows: commits[p["full_path"]] = {"ref": ref, "list": rows}
write("commits.json", commits)

# ---------------------------------------------------------------- contributors
print("contributors (per-author, per-day)")
contributors = {}
for p in projects:
    pid = p["id"]
    refs = GRAPH.get(p["full_path"], [default_branch.get(pid, "main")])
    for ref in refs:
        if not g(pid, "rev-parse", "--verify", "--quiet", ref).strip():
            continue
        out = g(pid, "log", ref, "--format=%an%x01%ae%x01%ad", "--date=short")
        agg = collections.OrderedDict()
        for ln in out.splitlines():
            f = ln.split("\x01")
            if len(f) < 3: continue
            k = (f[0], f[1])
            a = agg.setdefault(k, {"name": f[0], "email": f[1], "commits": 0, "daily": {}})
            a["commits"] += 1
            a["daily"][f[2]] = a["daily"].get(f[2], 0) + 1
        if not agg: continue
        authors = sorted(agg.values(), key=lambda a: -a["commits"])
        detailed = p["full_path"] in GRAPH
        if not detailed:                      # keep the seed small
            authors = [{"name": a["name"], "email": a["email"],
                        "commits": a["commits"]} for a in authors[:15]]
        contributors.setdefault(p["full_path"], {})[ref] = {
            "total": sum(a["commits"] for a in agg.values()),
            "authors": authors}
write("contributors.json", contributors)

# ---------------------------------------------------------------- trees + blobs
print("trees + blobs")
TEXT_EXT = (".md", ".txt", ".html", ".css", ".scss", ".js", ".jsx", ".ts", ".json",
            ".yml", ".yaml", ".sh", ".zsh", ".bash", ".py", ".rb", ".toml", ".cfg",
            ".ini", ".xml", ".svg", ".gitignore", ".editorconfig", ".lock", ".vim",
            ".conf", ".java", ".c", ".h", ".go", ".php", ".rs", "")
BLOB_MAX = 40 * 1024
trees = {}; files = {}
for p in projects:
    pid = p["id"]; ref = default_branch.get(pid, "main")
    listing = g(pid, "ls-tree", "-r", "-l", ref)
    entries = []
    for ln in listing.splitlines():
        try:
            meta, path = ln.split("\t", 1)
            mode, typ, sha, size = meta.split()
        except ValueError:
            continue
        entries.append({"path": path, "type": "blob", "mode": mode,
                        "size": int(size) if size.isdigit() else 0, "sha": sha[:8]})
    if not entries:
        continue
    is_bb = p["full_path"].startswith("byteblaze/")
    if is_bb or pid in DEEP:
        trees[p["full_path"]] = entries if is_bb else \
            [e for e in entries if e["path"].count("/") <= 1][:200]
    else:
        trees[p["full_path"]] = [e for e in entries if "/" not in e["path"]][:60]
    # blobs
    want = []
    for e in entries:
        base = e["path"].rsplit("/", 1)[-1]
        low = base.lower()
        is_doc = low.startswith(("readme", "license", "licence", "copying",
                                 "contributing", "changelog", "code_of_conduct"))
        if is_bb and e["size"] <= BLOB_MAX and (
                is_doc or any(low.endswith(x) for x in TEXT_EXT if x)):
            want.append(e)
        elif pid in DEEP and is_doc and e["size"] <= BLOB_MAX:
            want.append(e)
        elif is_doc and low.startswith("readme") and e["size"] <= 12 * 1024:
            want.append(e)
    seen = set()
    for e in want[:120 if is_bb else 8]:
        if e["path"] in seen: continue
        seen.add(e["path"])
        body = g(pid, "cat-file", "-p", f"{ref}:{e['path']}", binary=True)
        try:
            txt = body.decode("utf-8")
        except UnicodeDecodeError:
            continue
        if len(txt) > BLOB_MAX:
            txt = txt[:BLOB_MAX] + "\n… (truncated)"
        files.setdefault(p["full_path"], {})[e["path"]] = txt

# anchored blobs on non-default refs
EXTRA = [("byteblaze/cloud-to-butt", "master", "LICENSE.txt"),
         ("byteblaze/dotfiles", "master", "README.md")]
pid_by_path = {p["full_path"]: p["id"] for p in projects}
for fp, ref, path in EXTRA:
    pid = pid_by_path.get(fp)
    if not pid: continue
    b = g(pid, "cat-file", "-p", f"{ref}:{path}", binary=True)
    if b:
        files.setdefault(fp, {})[f"{ref}:{path}"] = b.decode("utf-8", "replace")[:BLOB_MAX]
write("repo_trees.json", trees)
write("repo_files.json", files)
print("stage 4 done")
