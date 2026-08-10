#!/usr/bin/env python3
"""Extract a curated GitLab seed from the WebArena container into src/data/.
READ-ONLY against the container. Preserves real ids, iids, paths, usernames."""
import json, os, sys, collections
from q import q, git

OUT = "/webarena/CUA-Gym-Hub/websites/webarena_gitlab_mock/src/data"
DUMP = "/webarena/CUA-Gym-Hub/websites/webarena_gitlab_mock/assets/dumps"
os.makedirs(OUT, exist_ok=True); os.makedirs(DUMP, exist_ok=True)

def write(name, obj, where=OUT):
    p = os.path.join(where, name)
    with open(p, "w") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {name}: {os.path.getsize(p)/1024:.0f} KB")
    return obj

VIS = {0: "private", 10: "internal", 20: "public"}
ACCESS = {5: "Minimal Access", 10: "Guest", 20: "Reporter", 30: "Developer",
          40: "Maintainer", 50: "Owner"}
STATE = {1: "opened", 2: "closed", 3: "merged", 4: "locked"}

# ---------------------------------------------------------------- namespaces
print("namespaces / groups")
ns = q("""SELECT id, name, path, type, description, avatar, visibility_level,
          owner_id, created_at::text FROM namespaces ORDER BY id""")
groups = [n for n in ns if n["type"] == "Group"]
write("groups.json", [{"id": g["id"], "name": g["name"], "path": g["path"],
                       "description": g["description"] or "",
                       "visibility": VIS.get(g["visibility_level"], "public"),
                       "created_at": g["created_at"]} for g in groups])
ns_by_id = {n["id"]: n for n in ns}

# ---------------------------------------------------------------- projects
print("projects (all 175)")
projects = q("""SELECT p.id, p.name, p.path, p.namespace_id, p.description,
       p.visibility_level, p.star_count, p.created_at::text, p.last_activity_at::text,
       p.archived,
       n.path AS ns_path, n.name AS ns_name, n.type AS ns_type,
       pr.disk_path,
       (SELECT commit_count FROM project_statistics ps WHERE ps.project_id=p.id) AS commit_count,
       (SELECT repository_size FROM project_statistics ps WHERE ps.project_id=p.id) AS repo_size,
       (SELECT count(*) FROM projects f WHERE f.id IN
          (SELECT project_id FROM fork_network_members WHERE forked_from_project_id=p.id)) AS forks_count
       FROM projects p
       JOIN namespaces n ON n.id=p.namespace_id
       LEFT JOIN project_repositories pr ON pr.project_id=p.id
       ORDER BY p.id""")
disk = {p["id"]: p["disk_path"] for p in projects if p["disk_path"]}
full = {p["id"]: f'{p["ns_path"]}/{p["path"]}' for p in projects}
pid_by_path = {v: k for k, v in full.items()}

# default branch per project, from git HEAD
print("  resolving default branches from git HEAD")
default_branch = {}
for p in projects:
    if not p["disk_path"]:
        continue
    hd = git(p["disk_path"], "symbolic-ref", "--short", "HEAD").strip()
    default_branch[p["id"]] = hd or "main"

# ---------------------------------------------------------------- focus set
ANCHOR_PROJECTS = [
 "byteblaze/dotfiles","byteblaze/gimmiethat.space","byteblaze/empathy-prompts",
 "byteblaze/a11y-syntax-highlighting","byteblaze/a11y-webring.club",
 "byteblaze/cloud-to-butt","byteblaze/solarized-prism-theme",
 "byteblaze/accessible-html-content-patterns","byteblaze/millennials-to-snake-people",
 "byteblaze/timeit","byteblaze/ericwbailey.website",
 "byteblaze/remove-board-movement-events-from-the-github-issue-timeline",
 "a11yproject/a11yproject.com","primer/design","root/metaseq","convexegg/chatgpt",
 "convexegg/super_awesome_robot","vinta/awesome-python","0ang3el/aem-hacker",
 "kkroening/ffmpeg-python","keycloak/keycloak","OpenAPITools/openapi-generator",
 "umano/AndroidSlidingUpPanel","dehenne/awesome-visibility","amwhalen/archive-my-tweets",
 "CellularPrivacy/Android-IMSI-Catcher-Detector","eriklindernoren/PyTorch-GAN",
 "yjlou/2019-nCov","aklsh/dots","aklsh/CacheEval","aklsh/SimCache",
 "aklsh/nvidia-patch","aklsh/viewgrades-scraper","koush/AndroidAsync",
 "lahwaacz/arch-wiki-docs","auth0/angular-storage","panicsteve/cloud-to-butt",
 "facebook/create-react-app","facebook/buck","thoughtbot/administrate",
 "mk-j/PHP_XLSXWriter","wireservice/csvkit","keylase/nvidia-patch",
 "murale127/viewgrades-scraper","xiaozi/solarized-prism-theme",
 "Roshanjossey/timeit","abisubramanya27/remove-board-movement-events-from-the-github-issue-timeline",
 "aklsh/empathy-prompts","firstcontributions/first-contributions",
]
FOCUS = [pid_by_path[f] for f in ANCHOR_PROJECTS if f in pid_by_path]
missing = [f for f in ANCHOR_PROJECTS if f not in pid_by_path]
if missing:
    print("  !! anchor projects not found in DB:", missing)
FOCUSSET = set(FOCUS)

# anchored issue/MR iids that MUST survive sampling
ANCHOR_ISSUES = {  # full_path -> iids
 "a11yproject/a11yproject.com": [719, 566, 1517],
 "byteblaze/empathy-prompts": [8, 18],
 "byteblaze/a11y-syntax-highlighting": [1],
 "byteblaze/a11y-webring.club": [71],
}
ANCHOR_MRS = {
 "a11yproject/a11yproject.com": [1071, 1265, 1270, 1485, 1531],
 "primer/design": [450],
 "byteblaze/empathy-prompts": [19],
 "byteblaze/a11y-webring.club": [40],
}

CAP_OPEN, CAP_CLOSED = 25, 25

# ---------------------------------------------------------------- issues
print("issues")
keep_issue_ids = set()
issue_rows = []
issue_counts = {}
for pid in FOCUS:
    fp = full[pid]
    forced = ANCHOR_ISSUES.get(fp, [])
    cnt = q(f"""SELECT state_id, count(*) AS c FROM issues WHERE project_id={pid}
                GROUP BY state_id""")
    issue_counts[fp] = {STATE.get(c["state_id"], "other"): c["c"] for c in cnt}
    sel = []
    if forced:
        sel += q(f"""SELECT * FROM issues WHERE project_id={pid}
                     AND iid IN ({','.join(map(str, forced))})""")
    # everything byteblaze touches (dashboard views depend on it)
    sel += q(f"""SELECT * FROM issues WHERE project_id={pid} AND (author_id=2330
                 OR id IN (SELECT issue_id FROM issue_assignees WHERE user_id=2330))
                 ORDER BY created_at DESC LIMIT 40""")
    sel += q(f"""SELECT * FROM issues WHERE project_id={pid} AND state_id=1
                 ORDER BY created_at DESC LIMIT {CAP_OPEN}""")
    sel += q(f"""SELECT * FROM issues WHERE project_id={pid} AND state_id=2
                 ORDER BY created_at DESC LIMIT {CAP_CLOSED}""")
    for r in sel:
        if r["id"] in keep_issue_ids:
            continue
        keep_issue_ids.add(r["id"]); issue_rows.append(r)
print(f"  {len(issue_rows)} issues from {len(FOCUS)} projects")

# issues assigned to the anchor dashboard usernames, wherever they live
extra_users = q("""SELECT id, username FROM users
                   WHERE username IN ('byteblaze','Roshanjossey','Seirdy','primer')""")
for u in extra_users:
    sel = q(f"""SELECT i.* FROM issues i
                JOIN issue_assignees a ON a.issue_id=i.id AND a.user_id={u['id']}
                WHERE i.state_id=1 ORDER BY i.created_at DESC LIMIT 40""")
    for r in sel:
        if r["id"] not in keep_issue_ids:
            keep_issue_ids.add(r["id"]); issue_rows.append(r)
            FOCUSSET.add(r["project_id"])
print(f"  {len(issue_rows)} issues after dashboard-assignee pass")

# ---------------------------------------------------------------- merge requests
print("merge requests")
keep_mr_ids = set(); mr_rows = []; mr_counts = {}
for pid in FOCUS:
    fp = full[pid]
    forced = ANCHOR_MRS.get(fp, [])
    cnt = q(f"""SELECT state_id, count(*) AS c FROM merge_requests
                WHERE target_project_id={pid} GROUP BY state_id""")
    mr_counts[fp] = {STATE.get(c["state_id"], "other"): c["c"] for c in cnt}
    sel = []
    if forced:
        sel += q(f"""SELECT * FROM merge_requests WHERE target_project_id={pid}
                     AND iid IN ({','.join(map(str, forced))})""")
    sel += q(f"""SELECT * FROM merge_requests WHERE target_project_id={pid}
                 AND (author_id=2330
                      OR id IN (SELECT merge_request_id FROM merge_request_assignees WHERE user_id=2330)
                      OR id IN (SELECT merge_request_id FROM merge_request_reviewers WHERE user_id=2330))
                 ORDER BY created_at DESC LIMIT 40""")
    for st in (1, 2, 3):
        sel += q(f"""SELECT * FROM merge_requests WHERE target_project_id={pid}
                     AND state_id={st} ORDER BY created_at DESC LIMIT 18""")
    for r in sel:
        if r["id"] in keep_mr_ids:
            continue
        keep_mr_ids.add(r["id"]); mr_rows.append(r)
for u in extra_users:
    for col in ("merge_request_assignees", "merge_request_reviewers"):
        sel = q(f"""SELECT m.* FROM merge_requests m
                    JOIN {col} x ON x.merge_request_id=m.id AND x.user_id={u['id']}
                    WHERE m.state_id=1 ORDER BY m.created_at DESC LIMIT 40""")
        for r in sel:
            if r["id"] not in keep_mr_ids:
                keep_mr_ids.add(r["id"]); mr_rows.append(r); FOCUSSET.add(r["target_project_id"])
print(f"  {len(mr_rows)} merge requests")

json.dump(sorted(keep_issue_ids), open("/tmp/recon/gitlab/issue_ids.json", "w"))
json.dump(sorted(keep_mr_ids), open("/tmp/recon/gitlab/mr_ids.json", "w"))
json.dump({"focus": sorted(FOCUSSET), "full": full, "default_branch": default_branch,
           "disk": disk, "issue_counts": issue_counts, "mr_counts": mr_counts},
          open("/tmp/recon/gitlab/ctx.json", "w"))
json.dump(projects, open("/tmp/recon/gitlab/projects_raw.json", "w"))
print("stage 1 done")
