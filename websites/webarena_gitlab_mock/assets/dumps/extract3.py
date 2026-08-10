#!/usr/bin/env python3
"""Stage 3: shape the final src/data/*.json seed, incl. git trees/blobs/commits."""
import json, os, collections, subprocess
from q import q, git

OUT = "/webarena/CUA-Gym-Hub/websites/webarena_gitlab_mock/src/data"
DUMP = "/webarena/CUA-Gym-Hub/websites/webarena_gitlab_mock/assets/dumps"

def write(name, obj, where=OUT):
    p = os.path.join(where, name)
    with open(p, "w") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    n = len(obj) if isinstance(obj, (list, dict)) else "?"
    print(f"  {name}: {os.path.getsize(p)/1024:.0f} KB  ({n})")

VIS = {0: "private", 10: "internal", 20: "public"}
ACCESS = {5: "Minimal Access", 10: "Guest", 20: "Reporter", 30: "Developer",
          40: "Maintainer", 50: "Owner"}
ISTATE = {1: "opened", 2: "closed"}
MSTATE = {1: "opened", 2: "closed", 3: "merged", 4: "locked"}

ctx = json.load(open("/tmp/recon/gitlab/ctx.json"))
full = {int(k): v for k, v in ctx["full"].items()}
default_branch = {int(k): v for k, v in ctx["default_branch"].items()}
disk = {int(k): v for k, v in ctx["disk"].items()}
projects_raw = json.load(open("/tmp/recon/gitlab/projects_raw.json"))
S = json.load(open("/tmp/recon/gitlab/stage2.json"))

star_counts = {s["project_id"]: s["c"] for s in S["star_counts"]}
ns_by_id = {n["id"]: n for n in q(
    "SELECT id,name,path,type,owner_id,description,avatar,visibility_level FROM namespaces")}

# ---------------------------------------------------------------- projects
print("projects")
projects = []
for p in projects_raw:
    pid = p["id"]
    projects.append({
        "id": pid,
        "full_path": full[pid],
        "path": p["path"],
        "name": p["name"],
        "namespace": {"id": p["namespace_id"], "path": p["ns_path"],
                      "name": p["ns_name"], "kind": "group" if p["ns_type"] == "Group" else "user"},
        "description": p["description"] or "",
        "visibility": VIS.get(p["visibility_level"], "public"),
        "star_count": star_counts.get(pid, p["star_count"]),
        "forks_count": p["forks_count"] or 0,
        "archived": bool(p["archived"]),
        "created_at": p["created_at"],
        "last_activity_at": p["last_activity_at"],
        "default_branch": default_branch.get(pid, "main"),
        "commit_count": p["commit_count"] or 0,
        "repo_size": p["repo_size"] or 0,
        "open_issues_count": ctx["issue_counts"].get(full[pid], {}).get("opened", 0),
        "closed_issues_count": ctx["issue_counts"].get(full[pid], {}).get("closed", 0),
        "open_mrs_count": ctx["mr_counts"].get(full[pid], {}).get("opened", 0),
        "merged_mrs_count": ctx["mr_counts"].get(full[pid], {}).get("merged", 0),
        "closed_mrs_count": ctx["mr_counts"].get(full[pid], {}).get("closed", 0),
    })
write("projects.json", projects)
proj_by_id = {p["id"]: p for p in projects}

# ---------------------------------------------------------------- users
print("users")
referenced = set()
for i in S["issues"]: referenced.add(i["author_id"])
for m in S["mrs"]: referenced.add(m["author_id"])
for a in S["issue_assignees"] + S["mr_assignees"] + S["mr_reviewers"]:
    referenced.add(a["user_id"])
for n in S["notes"]: referenced.add(n["author_id"])
for m in S["members"]: referenced.add(m["user_id"])
for s in S["stars"]: referenced.add(s["user_id"])
for f in S["follows"]: referenced.add(f["follower_id"]); referenced.add(f["followee_id"])
for t in S["todos"]: referenced.add(t["author_id"])
# owners of namespaces that actually hold a project
for p in projects_raw:
    o = ns_by_id.get(p["namespace_id"], {}).get("owner_id")
    if o: referenced.add(o)
referenced.add(2330)
referenced.discard(None)
users = []
for u in S["users"]:
    if u["id"] not in referenced:
        continue
    users.append({
        "id": u["id"], "username": u["username"], "name": u["name"],
        "email": u["email"], "public_email": u["public_email"] or "",
        "state": u["state"], "created_at": u["created_at"],
        "location": u["location"] or "", "organization": u["organization"] or "",
        "website_url": u["website_url"] or "", "twitter": u["twitter"] or "",
        "linkedin": u["linkedin"] or "", "skype": u["skype"] or "",
        "job_title": u["job_title"] or "", "bio": u["bio"] or "",
        "pronouns": u["pronouns"] or "", "pronunciation": u["pronunciation"] or "",
        "avatar": u["avatar"], "admin": u["admin"],
        "followers": u["followers"], "following": u["following"],
        **({"feed_token": u["feed_token"]} if u["id"] == 2330 else {}),
        **({"status": None} if u["id"] == 2330 else {}),
    })
write("users.json", users)
user_ids = {u["id"] for u in users}

# ---------------------------------------------------------------- groups
print("groups")
groups = []
for n in ns_by_id.values():
    if n["type"] != "Group":
        continue
    groups.append({"id": n["id"], "path": n["path"], "name": n["name"],
                   "description": n["description"] or "",
                   "visibility": VIS.get(n["visibility_level"], "public")})
write("groups.json", groups)

# ---------------------------------------------------------------- labels
print("labels")
labels = [{"id": l["id"], "project_id": l["project_id"], "title": l["title"],
           "color": l["color"], "description": l["description"] or "",
           "created_at": l["created_at"]} for l in S["labels"]]
write("labels.json", labels)

# ---------------------------------------------------------------- milestones
print("milestones")
milestones = [{"id": m["id"], "iid": m["iid"], "project_id": m["project_id"],
               "title": m["title"], "description": m["description"] or "",
               "state": m["state"], "due_date": m["due_date"],
               "start_date": m["start_date"], "created_at": m["created_at"],
               "updated_at": m["updated_at"]} for m in S["milestones"]]
write("milestones.json", milestones)

# ---------------------------------------------------------------- issues
print("issues")
ia = collections.defaultdict(list)
for a in S["issue_assignees"]:
    if a["user_id"] in user_ids: ia[a["issue_id"]].append(a["user_id"])
li = collections.defaultdict(list)
for l in S["ll_i"]: li[l["target_id"]].append(l["label_id"])
issues = []
for i in S["issues"]:
    issues.append({
        "id": i["id"], "iid": i["iid"], "project_id": i["project_id"],
        "title": i["title"], "description": i["description"] or "",
        "author_id": i["author_id"], "state": ISTATE.get(i["state_id"], "opened"),
        "confidential": i["confidential"], "due_date": i["due_date"],
        "milestone_id": i["milestone_id"], "assignee_ids": ia.get(i["id"], []),
        "label_ids": li.get(i["id"], []), "created_at": i["created_at"],
        "updated_at": i["updated_at"], "closed_at": i["closed_at"],
        "closed_by_id": i["closed_by_id"], "upvotes": i["upvotes_count"],
        "user_notes_count": i["user_notes_count"],
    })
write("issues.json", issues)

# ---------------------------------------------------------------- merge requests
print("merge requests")
ma = collections.defaultdict(list); mrv = collections.defaultdict(list)
for a in S["mr_assignees"]:
    if a["user_id"] in user_ids: ma[a["merge_request_id"]].append(a["user_id"])
for a in S["mr_reviewers"]:
    if a["user_id"] in user_ids: mrv[a["merge_request_id"]].append(a["user_id"])
lm = collections.defaultdict(list)
for l in S["ll_m"]: lm[l["target_id"]].append(l["label_id"])
mrs = []
for m in S["mrs"]:
    mrs.append({
        "id": m["id"], "iid": m["iid"], "project_id": m["project_id"],
        "source_project_id": m["source_project_id"],
        "title": m["title"], "description": m["description"] or "",
        "author_id": m["author_id"], "state": MSTATE.get(m["state_id"], "opened"),
        "draft": m["draft"], "source_branch": m["source_branch"],
        "target_branch": m["target_branch"], "milestone_id": m["milestone_id"],
        "merge_status": m["merge_status"], "assignee_ids": ma.get(m["id"], []),
        "reviewer_ids": mrv.get(m["id"], []), "label_ids": lm.get(m["id"], []),
        "created_at": m["created_at"], "updated_at": m["updated_at"],
        "user_notes_count": m["user_notes_count"], "squash": m["squash"],
    })
write("merge_requests.json", mrs)

# ---------------------------------------------------------------- notes
print("notes")
notes = [{"id": n["id"], "noteable_type": n["noteable_type"],
          "noteable_id": n["noteable_id"], "project_id": n["project_id"],
          "author_id": n["author_id"], "body": n["note"] or "",
          "system": n["system"], "discussion_id": n["discussion_id"],
          "type": n["type"], "created_at": n["created_at"],
          "updated_at": n["updated_at"],
          "resolved_at": n["resolved_at"], "resolved_by_id": n["resolved_by_id"]}
         for n in S["notes"] if n["author_id"] in user_ids]
write("notes.json", notes)

# ---------------------------------------------------------------- members
print("members")
members = [{"id": m["id"], "source_type": m["source_type"].lower(),
            "source_id": m["source_id"], "user_id": m["user_id"],
            "access_level": m["access_level"],
            "access_label": ACCESS.get(m["access_level"], str(m["access_level"])),
            "created_at": m["created_at"], "expires_at": m["expires_at"],
            "created_by_id": m["created_by_id"]}
           for m in S["members"] if m["user_id"] in user_ids]
write("members.json", members)

# ---------------------------------------------------------------- stars/follows/todos
print("stars / follows / todos")
write("stars.json", [{"project_id": s["project_id"], "user_id": s["user_id"],
                      "created_at": s["created_at"]}
                     for s in S["stars"] if s["user_id"] in user_ids])
write("follows.json", S["follows"])
write("todos.json", [{"id": t["id"], "user_id": t["user_id"],
                      "project_id": t["project_id"], "target_id": t["target_id"],
                      "target_type": t["target_type"], "author_id": t["author_id"],
                      "action": t["action"], "state": t["state"],
                      "created_at": t["created_at"], "group_id": t["group_id"]}
                     for t in S["todos"]])
print("stage 3 (db) done")
