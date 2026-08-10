#!/usr/bin/env python3
"""Trim the seed to the ~2 MB budget WITHOUT touching anchored records."""
import json, os, collections

OUT = "/webarena/CUA-Gym-Hub/websites/webarena_gitlab_mock/src/data"
def load(n): return json.load(open(os.path.join(OUT, n)))
def save(n, o):
    p = os.path.join(OUT, n)
    json.dump(o, open(p, "w"), ensure_ascii=False, separators=(",", ":"))
    print(f"  {n}: {os.path.getsize(p)/1024:.0f} KB ({len(o)})")

# (project_id, iid) pairs an evaluator reads in full
ANCHOR_ISSUES = {(174,719),(174,566),(174,1517),(183,8),(183,18),(186,1),(179,71),
                 (180,316),(180,104),(174,1478)}
ANCHOR_MRS    = {(174,1071),(174,1265),(174,1270),(174,1485),(174,1531),
                 (180,450),(183,19),(179,40)}
BYTEBLAZE = 2330

issues = load("issues.json")
mrs = load("merge_requests.json")
notes = load("notes.json")
users = load("users.json")
stars = load("stars.json")

def clip(s, n):
    if s and len(s) > n:
        return s[:n].rsplit(" ", 1)[0] + "\n\n…"
    return s

anchor_issue_ids, anchor_mr_ids = set(), set()
for i in issues:
    keep = (i["project_id"], i["iid"]) in ANCHOR_ISSUES or i["author_id"] == BYTEBLAZE \
           or BYTEBLAZE in i["assignee_ids"]
    if keep: anchor_issue_ids.add(i["id"])
    else: i["description"] = clip(i["description"], 700)
for m in mrs:
    keep = (m["project_id"], m["iid"]) in ANCHOR_MRS or m["author_id"] == BYTEBLAZE \
           or BYTEBLAZE in m["assignee_ids"] or BYTEBLAZE in m["reviewer_ids"]
    if keep: anchor_mr_ids.add(m["id"])
    else: m["description"] = clip(m["description"], 700)

# notes: keep every note on an anchored issue/MR; cap the rest at 4, clip bodies
by_target = collections.defaultdict(list)
for n in notes:
    by_target[(n["noteable_type"], n["noteable_id"])].append(n)
kept = []
for (typ, tid), rows in by_target.items():
    protected = (typ == "Issue" and tid in anchor_issue_ids) or \
                (typ == "MergeRequest" and tid in anchor_mr_ids)
    rows.sort(key=lambda r: r["created_at"])
    if protected:
        kept += rows
    else:
        for r in rows[:4]:
            r["body"] = clip(r["body"], 500)
            kept.append(r)
kept.sort(key=lambda r: r["created_at"])
notes = kept

# stars: 6 per project besides byteblaze's own
per = collections.Counter(); keep_stars = []
for s in sorted(stars, key=lambda s: s["created_at"]):
    if s["user_id"] == BYTEBLAZE:
        keep_stars.append(s); continue
    if per[s["project_id"]] < 6:
        per[s["project_id"]] += 1; keep_stars.append(s)
stars = keep_stars

# users: drop anyone no longer referenced
ref = {BYTEBLAZE}
for i in issues: ref.add(i["author_id"]); ref |= set(i["assignee_ids"]); ref.add(i["closed_by_id"])
for m in mrs: ref.add(m["author_id"]); ref |= set(m["assignee_ids"]) | set(m["reviewer_ids"])
for n in notes: ref.add(n["author_id"])
for m in load("members.json"): ref.add(m["user_id"])
for s in stars: ref.add(s["user_id"])
for f in load("follows.json"): ref.add(f["follower_id"]); ref.add(f["followee_id"])
for t in load("todos.json"): ref.add(t["author_id"])
ns_owner = {p["namespace"]["id"] for p in load("projects.json")}
# namespace owners: resolved by username == namespace path
by_name = {u["username"]: u for u in users}
for p in load("projects.json"):
    if p["namespace"]["kind"] == "user" and p["namespace"]["path"] in by_name:
        ref.add(by_name[p["namespace"]["path"]]["id"])
ref.discard(None)
users = [u for u in users if u["id"] in ref]

# anchor usernames that must never be dropped
MUST = ["byteblaze","Roshanjossey","Seirdy","primer","abisubramanya27","vinta",
        "convexegg","yjlou","lahwaacz","koush","bblanchon","ghost","R1kk3r",
        "davepgreene","alexhutnik","V13Axel","westurner","patrickhlauke",
        "linkmatrix","ASWATFZLLC","Agnes-U","qhduan","DCMJY","JonasVautherin",
        "bmyun","dawiss1337","dilipchandima","egpast","jontutcher","patou",
        "pandey2000","sayakpaul","amwhalen","eriklindernoren","aklsh",
        "panicsteve","xiaozi","a11yproject","root","tokudu"]
have = {u["username"] for u in users}
allu = {u["username"]: u for u in load("users.json")}
for un in MUST:
    if un not in have and un in allu:
        users.append(allu[un])
        print(f"  restored anchor user @{un}")
users.sort(key=lambda u: u["id"])

save("issues.json", issues); save("merge_requests.json", mrs)
save("notes.json", notes); save("users.json", users); save("stars.json", stars)
