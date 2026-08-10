#!/usr/bin/env python3
"""Stage 2: materialise the seed JSON files from stage-1 id sets."""
import json, os, collections, re
from q import q, git

OUT = "/webarena/CUA-Gym-Hub/websites/webarena_gitlab_mock/src/data"
DUMP = "/webarena/CUA-Gym-Hub/websites/webarena_gitlab_mock/assets/dumps"
os.makedirs(OUT, exist_ok=True); os.makedirs(DUMP, exist_ok=True)

def write(name, obj, where=OUT):
    p = os.path.join(where, name)
    with open(p, "w") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    print(f"  {name}: {os.path.getsize(p)/1024:.0f} KB  ({len(obj)} rows)")

VIS = {0: "private", 10: "internal", 20: "public"}
ACCESS = {5: "Minimal Access", 10: "Guest", 20: "Reporter", 30: "Developer",
          40: "Maintainer", 50: "Owner"}
STATE = {1: "opened", 2: "closed", 3: "merged", 4: "locked"}

ctx = json.load(open("/tmp/recon/gitlab/ctx.json"))
full = {int(k): v for k, v in ctx["full"].items()}
default_branch = {int(k): v for k, v in ctx["default_branch"].items()}
disk = {int(k): v for k, v in ctx["disk"].items()}
projects_raw = json.load(open("/tmp/recon/gitlab/projects_raw.json"))
issue_ids = set(json.load(open("/tmp/recon/gitlab/issue_ids.json")))
mr_ids = set(json.load(open("/tmp/recon/gitlab/mr_ids.json")))

# ---- force in the issues/MRs named by anchor strings, whatever the sampler did
FORCED_ISSUE_TITLES = [
 "Support linking to an accessibility statement",
 "Clarify usage of flash alert",
 "Add documentation on using Flash alerts in dialog components",
 "404s, bad host, timeouts, bad urls for URLs linked from website",
 "Integrating LLMs for better prompts", "Let's keep the project alive",
 "add support for oh-my-zsh", "Tm Theme Editor", "Outdated dependencies",
]
for t in FORCED_ISSUE_TITLES:
    for r in q("SELECT id FROM issues WHERE title ILIKE '%%%s%%' LIMIT 5"
               % t.replace("'", "''")):
        issue_ids.add(r["id"])

def inlist(s):
    return ",".join(str(x) for x in s) or "-1"

# ---------------------------------------------------------------- issues
print("issues")
issues = q(f"""SELECT i.id, i.iid, i.project_id, i.title, i.description, i.author_id,
    i.state_id, i.confidential, i.due_date::text, i.milestone_id,
    i.created_at::text, i.updated_at::text, i.closed_at::text, i.closed_by_id,
    i.upvotes_count, i.issue_type,
    (SELECT count(*) FROM notes n WHERE n.noteable_type='Issue'
       AND n.noteable_id=i.id AND n.system=false) AS user_notes_count
    FROM issues i WHERE i.id IN ({inlist(issue_ids)}) ORDER BY i.project_id, i.iid""")
issue_ids = {i["id"] for i in issues}

# ---------------------------------------------------------------- merge requests
print("merge requests")
mrs = q(f"""SELECT m.id, m.iid, m.target_project_id AS project_id, m.source_project_id,
    m.title, m.description, m.author_id, m.state_id, m.draft,
    m.source_branch, m.target_branch, m.milestone_id, m.merge_status,
    m.created_at::text, m.updated_at::text, m.merge_commit_sha, m.squash,
    (SELECT count(*) FROM notes n WHERE n.noteable_type='MergeRequest'
       AND n.noteable_id=m.id AND n.system=false) AS user_notes_count
    FROM merge_requests m WHERE m.id IN ({inlist(mr_ids)})
    ORDER BY m.target_project_id, m.iid""")
mr_ids = {m["id"] for m in mrs}

# ---------------------------------------------------------------- assignees etc
print("assignees / reviewers / label links")
issue_assignees = q(f"SELECT issue_id, user_id FROM issue_assignees WHERE issue_id IN ({inlist(issue_ids)})")
mr_assignees = q(f"SELECT merge_request_id, user_id FROM merge_request_assignees WHERE merge_request_id IN ({inlist(mr_ids)})")
mr_reviewers = q(f"SELECT merge_request_id, user_id, state FROM merge_request_reviewers WHERE merge_request_id IN ({inlist(mr_ids)})")
ll_i = q(f"""SELECT label_id, target_id FROM label_links
             WHERE target_type='Issue' AND target_id IN ({inlist(issue_ids)})""")
ll_m = q(f"""SELECT label_id, target_id FROM label_links
             WHERE target_type='MergeRequest' AND target_id IN ({inlist(mr_ids)})""")

# ---------------------------------------------------------------- labels
print("labels")
focus_pids = sorted({i["project_id"] for i in issues} | {m["project_id"] for m in mrs})
labels = q(f"""SELECT id, title, color, project_id, description, created_at::text
               FROM labels WHERE project_id IN ({inlist(focus_pids)})
               ORDER BY project_id, title""")
# keep every label a seeded issue/MR actually uses, even outside focus
used = {l["label_id"] for l in ll_i} | {l["label_id"] for l in ll_m}
have = {l["id"] for l in labels}
if used - have:
    labels += q(f"""SELECT id, title, color, project_id, description, created_at::text
                    FROM labels WHERE id IN ({inlist(used - have)})""")

# ---------------------------------------------------------------- milestones
print("milestones")
mil_used = {i["milestone_id"] for i in issues if i["milestone_id"]} | \
           {m["milestone_id"] for m in mrs if m["milestone_id"]}
milestones = q(f"""SELECT id, iid, title, project_id, group_id, description, state,
                   due_date::text, start_date::text, created_at::text, updated_at::text
                   FROM milestones WHERE project_id IN ({inlist(focus_pids)})
                      OR id IN ({inlist(mil_used)}) ORDER BY project_id, iid""")

# ---------------------------------------------------------------- notes
print("notes (comments)")
# every note on an anchored issue/MR, plus a bounded tail elsewhere
ANCHOR_ISSUE_KEYS = [(174,719),(174,566),(174,1517),(183,8),(183,18),(186,1),(179,71)]
ANCHOR_MR_KEYS = [(174,1071),(174,1265),(174,1270),(174,1485),(174,1531),
                  (180,450),(183,19),(179,40)]
anchor_issue_ids = [i["id"] for i in issues
                    if (i["project_id"], i["iid"]) in ANCHOR_ISSUE_KEYS]
anchor_mr_ids = [m["id"] for m in mrs
                 if (m["project_id"], m["iid"]) in ANCHOR_MR_KEYS]
notes = q(f"""SELECT id, note, noteable_type, noteable_id, author_id, project_id,
              created_at::text, updated_at::text, system, discussion_id, type,
              resolved_at, resolved_by_id
              FROM notes WHERE (noteable_type='Issue' AND noteable_id IN ({inlist(anchor_issue_ids)}))
                 OR (noteable_type='MergeRequest' AND noteable_id IN ({inlist(anchor_mr_ids)}))
              ORDER BY created_at""")
have_note_targets = {(n["noteable_type"], n["noteable_id"]) for n in notes}
# up to 8 notes on every other seeded issue/MR
rest_i = [i["id"] for i in issues if ("Issue", i["id"]) not in have_note_targets]
rest_m = [m["id"] for m in mrs if ("MergeRequest", m["id"]) not in have_note_targets]
for typ, ids in (("Issue", rest_i), ("MergeRequest", rest_m)):
    for chunk in [ids[k:k+300] for k in range(0, len(ids), 300)]:
        notes += q(f"""SELECT * FROM (
            SELECT id, note, noteable_type, noteable_id, author_id, project_id,
                   created_at::text, updated_at::text, system, discussion_id, type,
                   resolved_at, resolved_by_id,
                   row_number() OVER (PARTITION BY noteable_id ORDER BY created_at) rn
            FROM notes WHERE noteable_type='{typ}' AND noteable_id IN ({inlist(chunk)})
            ) s WHERE rn <= 8""")
for n in notes:
    n.pop("rn", None)
print(f"  {len(notes)} notes")

# ---------------------------------------------------------------- members
print("members")
members = q("""SELECT m.id, m.source_id, m.source_type, m.user_id, m.access_level,
               m.created_at::text, m.expires_at::text, m.created_by_id
               FROM members m WHERE m.user_id IS NOT NULL
               ORDER BY m.source_type, m.source_id, m.access_level DESC""")

# ---------------------------------------------------------------- stars / follows / todos
print("stars / follows / todos")
stars = q("""SELECT project_id, user_id, created_at::text FROM users_star_projects
             WHERE user_id=2330""")
star_counts = q("""SELECT project_id, count(*) AS c FROM users_star_projects GROUP BY 1""")
# plus a bounded sample of other users' stars so /-/starrers is populated
stars += q("""SELECT * FROM (SELECT project_id, user_id, created_at::text,
              row_number() OVER (PARTITION BY project_id ORDER BY created_at) rn
              FROM users_star_projects WHERE user_id<>2330) s WHERE rn<=12""")
for s in stars:
    s.pop("rn", None)
follows = q("SELECT follower_id, followee_id FROM user_follow_users")
todos = q("""SELECT id, user_id, project_id, target_id, target_type, author_id,
             action, state, created_at::text, note_id, group_id
             FROM todos WHERE user_id=2330 ORDER BY created_at DESC LIMIT 60""")

# ---------------------------------------------------------------- users
print("users")
need = {2330}
need |= {i["author_id"] for i in issues if i["author_id"]}
need |= {m["author_id"] for m in mrs if m["author_id"]}
need |= {a["user_id"] for a in issue_assignees}
need |= {a["user_id"] for a in mr_assignees}
need |= {a["user_id"] for a in mr_reviewers}
need |= {n["author_id"] for n in notes if n["author_id"]}
need |= {m["user_id"] for m in members if m["user_id"]}
need |= {s["user_id"] for s in stars}
need |= {f["follower_id"] for f in follows} | {f["followee_id"] for f in follows}
need |= {t["author_id"] for t in todos if t["author_id"]}
need |= {p["namespace_id"] for p in projects_raw}   # namespace owners resolved below
ns_owner = q("SELECT id, owner_id FROM namespaces WHERE owner_id IS NOT NULL")
need |= {n["owner_id"] for n in ns_owner}
need = {u for u in need if u}
users = q(f"""SELECT u.id, u.username, u.name, u.email, u.public_email, u.state,
    u.created_at::text, u.location, u.organization, u.website_url, u.twitter,
    u.linkedin, u.skype, u.avatar, u.admin, u.feed_token,
    d.job_title, d.bio, d.pronouns, d.pronunciation,
    (SELECT count(*) FROM user_follow_users f WHERE f.followee_id=u.id) AS followers,
    (SELECT count(*) FROM user_follow_users f WHERE f.follower_id=u.id) AS following
    FROM users u LEFT JOIN user_details d ON d.user_id=u.id
    WHERE u.id IN ({inlist(need)}) ORDER BY u.id""")
statuses = q(f"""SELECT user_id, emoji, message, availability, clear_status_at::text
                 FROM user_statuses WHERE user_id IN ({inlist(need)})""")
print(f"  {len(users)} users, {len(statuses)} statuses")

json.dump({"issues": issues, "mrs": mrs, "notes": notes, "users": users,
           "labels": labels, "milestones": milestones, "members": members,
           "stars": stars, "star_counts": star_counts, "follows": follows,
           "todos": todos, "statuses": statuses,
           "issue_assignees": issue_assignees, "mr_assignees": mr_assignees,
           "mr_reviewers": mr_reviewers, "ll_i": ll_i, "ll_m": ll_m},
          open("/tmp/recon/gitlab/stage2.json", "w"))
print("stage 2 raw done")
