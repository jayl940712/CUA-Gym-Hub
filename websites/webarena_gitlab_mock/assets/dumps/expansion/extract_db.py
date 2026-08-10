#!/usr/bin/env python3
"""Expansion stage 1 — issues, merge requests, notes and their dependencies.

ADDITIVE. Reads the current src/data/*.json to learn what already exists, then
emits ONLY the new rows as `<entity>.add.json`, in exactly the schema the
existing file uses. Nothing under src/ is written.

Selection rule
  issues : per project keep everything already in the seed, then top up to
           min(upstream_count, CAP_ISSUES), split across states in the upstream
           proportion, each state ordered created_at DESC.
  MRs    : same, CAP_MRS, states opened/closed/merged.
  notes  : up to NOTES_PER non-system notes per newly added issue/MR, oldest
           first, body clipped to 500 chars (the clip the existing seed uses).

Read-only: SELECT only, through common.qj().
"""
import collections
import json
import os

import common as C

CAP_ISSUES = 450
CAP_MRS = 850
NOTES_PER = 3
DESC_CLIP = 700          # matches trim.py's non-anchored description clip
BODY_CLIP = 500          # matches trim.py's non-anchored note clip

ISTATE = {1: "opened", 2: "closed"}
MSTATE = {1: "opened", 2: "closed", 3: "merged", 4: "locked"}


def clip(s, n):
    if s and len(s) > n:
        return s[:n].rsplit(" ", 1)[0] + "\n\n…"
    return s or ""


def inlist(s):
    return ",".join(str(x) for x in s) or "-1"


def allocate(cap, per_state, have):
    """Split `cap` across states proportionally to upstream availability.

    `have` is how many of each state the seed already holds; those are kept
    regardless, so allocation only sizes the top-up.
    """
    avail = {k: v for k, v in per_state.items() if v > 0}
    total = sum(avail.values())
    if not total:
        return {}
    want = {}
    if total <= cap:
        want = dict(avail)
    else:
        for k, v in avail.items():
            want[k] = max(1, int(round(cap * v / total)))
        # correct rounding drift
        while sum(want.values()) > cap:
            k = max(want, key=lambda x: want[x])
            if want[k] <= 1:
                break
            want[k] -= 1
        while sum(want.values()) < cap:
            k = min(want, key=lambda x: want[x] / avail[x])
            if want[k] >= avail[k]:
                break
            want[k] += 1
    for k in want:
        want[k] = min(want[k], avail[k])
    return want


def main():
    projects = C.load("projects.json")
    pids = [p["id"] for p in projects]
    ex_issues = C.load("issues.json")
    ex_mrs = C.load("merge_requests.json")
    ex_notes = C.load("notes.json")
    ex_users = {u["id"] for u in C.load("users.json")}
    ex_labels = {l["id"] for l in C.load("labels.json")}
    ex_ms = {m["id"] for m in C.load("milestones.json")}
    ex_re = {(r["kind"], r["id"]) for r in C.load("resource_events.json")}

    have_i = {x["id"] for x in ex_issues}
    have_m = {x["id"] for x in ex_mrs}
    have_n = {x["id"] for x in ex_notes}

    # ------------------------------------------------ upstream state counts
    print("counting upstream states")
    cnt_i = collections.defaultdict(dict)
    for r in C.qj("SELECT project_id, state_id, count(*) AS c FROM issues "
                  "GROUP BY 1,2"):
        cnt_i[r["project_id"]][r["state_id"]] = r["c"]
    cnt_m = collections.defaultdict(dict)
    for r in C.qj("SELECT target_project_id AS project_id, state_id, count(*) AS c "
                  "FROM merge_requests GROUP BY 1,2"):
        cnt_m[r["project_id"]][r["state_id"]] = r["c"]

    seed_i = collections.defaultdict(collections.Counter)
    for x in ex_issues:
        seed_i[x["project_id"]][x["state"]] += 1
    seed_m = collections.defaultdict(collections.Counter)
    for x in ex_mrs:
        seed_m[x["project_id"]][x["state"]] += 1

    # ------------------------------------------------ pick ids
    # One ranked query per entity rather than 350 per-project round trips:
    # row_number() over (project, state) ordered newest-first, sliced in python
    # to whatever the per-project allocation asks for.
    print("ranking candidates")
    rank_i = collections.defaultdict(list)
    for r in C.qj("""SELECT id, project_id, state_id FROM (
            SELECT id, project_id, state_id, row_number() OVER (
                PARTITION BY project_id, state_id ORDER BY created_at DESC, id DESC
            ) AS rn FROM issues) z WHERE rn <= %d""" % CAP_ISSUES):
        rank_i[(r["project_id"], r["state_id"])].append(r["id"])
    rank_m = collections.defaultdict(list)
    for r in C.qj("""SELECT id, project_id, state_id FROM (
            SELECT id, target_project_id AS project_id, state_id, row_number() OVER (
                PARTITION BY target_project_id, state_id ORDER BY created_at DESC, id DESC
            ) AS rn FROM merge_requests) z WHERE rn <= %d""" % CAP_MRS):
        rank_m[(r["project_id"], r["state_id"])].append(r["id"])

    pick_i = set()
    for pid in pids:
        for st, n in allocate(CAP_ISSUES, cnt_i.get(pid, {}), seed_i.get(pid)).items():
            pick_i.update(rank_i[(pid, st)][:n])
    new_i = sorted(pick_i - have_i)
    print("  issues: %d selected, %d new" % (len(pick_i), len(new_i)))

    pick_m = set()
    for pid in pids:
        for st, n in allocate(CAP_MRS, cnt_m.get(pid, {}), seed_m.get(pid)).items():
            pick_m.update(rank_m[(pid, st)][:n])
    new_m = sorted(pick_m - have_m)
    print("  merge requests: %d selected, %d new" % (len(pick_m), len(new_m)))

    # ------------------------------------------------ fetch rows
    def chunks(seq, n=400):
        for k in range(0, len(seq), n):
            yield seq[k:k + n]

    print("fetching issues")
    irows = []
    for ch in chunks(new_i):
        irows += C.qj("""SELECT i.id, i.iid, i.project_id, i.title,
            left(i.description, 4000) AS description, i.author_id, i.state_id,
            i.confidential, i.due_date::text, i.milestone_id, i.created_at::text,
            i.updated_at::text, i.closed_at::text, i.closed_by_id, i.upvotes_count,
            (SELECT count(*) FROM notes n WHERE n.noteable_type='Issue'
               AND n.noteable_id=i.id AND n.system=false) AS user_notes_count
            FROM issues i WHERE i.id IN (%s)""" % inlist(ch))

    print("fetching merge requests")
    mrows = []
    for ch in chunks(new_m):
        mrows += C.qj("""SELECT m.id, m.iid, m.target_project_id AS project_id,
            m.source_project_id, m.title, left(m.description, 4000) AS description,
            m.author_id, m.state_id, m.draft, m.source_branch, m.target_branch,
            m.milestone_id, m.merge_status, m.created_at::text, m.updated_at::text,
            m.squash, m.merge_user_id,
            (SELECT merged_at::text FROM merge_request_metrics x
               WHERE x.merge_request_id=m.id LIMIT 1) AS merged_at,
            (SELECT count(*) FROM notes n WHERE n.noteable_type='MergeRequest'
               AND n.noteable_id=m.id AND n.system=false) AS user_notes_count
            FROM merge_requests m WHERE m.id IN (%s)""" % inlist(ch))

    print("fetching assignees / reviewers / label links")
    ia = collections.defaultdict(list)
    ma = collections.defaultdict(list)
    mrv = collections.defaultdict(list)
    li = collections.defaultdict(list)
    lm = collections.defaultdict(list)
    for ch in chunks(new_i):
        for r in C.qj("SELECT issue_id, user_id FROM issue_assignees "
                      "WHERE issue_id IN (%s)" % inlist(ch)):
            ia[r["issue_id"]].append(r["user_id"])
        for r in C.qj("SELECT label_id, target_id FROM label_links "
                      "WHERE target_type='Issue' AND target_id IN (%s)" % inlist(ch)):
            li[r["target_id"]].append(r["label_id"])
    for ch in chunks(new_m):
        for r in C.qj("SELECT merge_request_id, user_id FROM merge_request_assignees "
                      "WHERE merge_request_id IN (%s)" % inlist(ch)):
            ma[r["merge_request_id"]].append(r["user_id"])
        for r in C.qj("SELECT merge_request_id, user_id FROM merge_request_reviewers "
                      "WHERE merge_request_id IN (%s)" % inlist(ch)):
            mrv[r["merge_request_id"]].append(r["user_id"])
        for r in C.qj("SELECT label_id, target_id FROM label_links WHERE "
                      "target_type='MergeRequest' AND target_id IN (%s)" % inlist(ch)):
            lm[r["target_id"]].append(r["label_id"])

    issues_add = [{
        "id": r["id"], "iid": r["iid"], "project_id": r["project_id"],
        "title": r["title"] or "", "description": clip(r["description"], DESC_CLIP),
        "author_id": r["author_id"], "state": ISTATE.get(r["state_id"], "opened"),
        "confidential": bool(r["confidential"]), "due_date": r["due_date"],
        "milestone_id": r["milestone_id"], "assignee_ids": sorted(ia.get(r["id"], [])),
        "label_ids": sorted(li.get(r["id"], [])), "created_at": r["created_at"],
        "updated_at": r["updated_at"], "closed_at": r["closed_at"],
        "closed_by_id": r["closed_by_id"], "upvotes": r["upvotes_count"] or 0,
        "user_notes_count": r["user_notes_count"],
    } for r in irows]

    mrs_add = [{
        "id": r["id"], "iid": r["iid"], "project_id": r["project_id"],
        "source_project_id": r["source_project_id"], "title": r["title"] or "",
        "description": clip(r["description"], DESC_CLIP), "author_id": r["author_id"],
        "state": MSTATE.get(r["state_id"], "opened"), "draft": bool(r["draft"]),
        "source_branch": r["source_branch"], "target_branch": r["target_branch"],
        "milestone_id": r["milestone_id"], "merge_status": r["merge_status"],
        "assignee_ids": sorted(ma.get(r["id"], [])),
        "reviewer_ids": sorted(mrv.get(r["id"], [])),
        "label_ids": sorted(lm.get(r["id"], [])), "created_at": r["created_at"],
        "updated_at": r["updated_at"],
        "merged_at": r["merged_at"] if r["state_id"] == 3 else None,
        "merged_by_id": r["merge_user_id"] if r["state_id"] == 3 else None,
        "user_notes_count": r["user_notes_count"], "squash": bool(r["squash"]),
    } for r in mrows]

    # ------------------------------------------------ notes
    print("fetching notes")
    notes_add = []
    for typ, ids in (("Issue", new_i), ("MergeRequest", new_m)):
        for ch in chunks(ids, 200):
            got = C.qj("""SELECT id, noteable_type, noteable_id, project_id, author_id,
                left(note, 3000) AS note, system, created_at::text, updated_at::text
                FROM (SELECT n.*, row_number() OVER (PARTITION BY n.noteable_id
                        ORDER BY n.created_at, n.id) AS rn
                      FROM notes n WHERE n.noteable_type='%s' AND n.system=false
                        AND n.noteable_id IN (%s)) z WHERE rn <= %d"""
                       % (typ, inlist(ch), NOTES_PER))
            for r in got:
                if r["id"] in have_n:
                    continue
                notes_add.append({
                    "id": r["id"], "noteable_type": r["noteable_type"],
                    "noteable_id": r["noteable_id"], "project_id": r["project_id"],
                    "author_id": r["author_id"], "body": clip(r["note"], BODY_CLIP),
                    "system": bool(r["system"]), "created_at": r["created_at"],
                    "updated_at": r["updated_at"],
                })
    notes_add.sort(key=lambda r: (r["created_at"], r["id"]))
    print("  %d new notes" % len(notes_add))

    # ------------------------------------------------ resource events
    # These drive the issue/MR activity timeline ("closed", "label added").
    # resource_state_events.state is the enum the seed stores as "action".
    # Runs before the referential closure because label events pull in labels.
    print("fetching resource events")
    need_l = set()
    re_add = []
    for typ, ids in (("Issue", new_i), ("MergeRequest", new_m)):
        col = "issue_id" if typ == "Issue" else "merge_request_id"
        for ch in chunks(ids, 300):
            for r in C.qj("""SELECT id, user_id, %s AS nid, state AS action,
                created_at::text FROM resource_state_events
                WHERE %s IN (%s)""" % (col, col, inlist(ch))):
                if ("state", r["id"]) in ex_re or r["nid"] is None:
                    continue
                re_add.append({"id": r["id"], "kind": "state", "noteable_type": typ,
                               "noteable_id": r["nid"], "user_id": r["user_id"],
                               "action": r["action"], "created_at": r["created_at"]})
            for r in C.qj("""SELECT id, user_id, %s AS nid, action, label_id,
                created_at::text FROM resource_label_events
                WHERE %s IN (%s)""" % (col, col, inlist(ch))):
                if ("label", r["id"]) in ex_re or r["nid"] is None or not r["label_id"]:
                    continue
                re_add.append({"id": r["id"], "kind": "label", "noteable_type": typ,
                               "noteable_id": r["nid"], "user_id": r["user_id"],
                               "action": r["action"], "created_at": r["created_at"],
                               "label_id": r["label_id"]})
                need_l.add(r["label_id"])
    re_add.sort(key=lambda r: (r["created_at"], r["id"]))
    print("  %d new resource events" % len(re_add))

    # ------------------------------------------------ referential closure
    print("closing references: users / labels / milestones")
    need_u = {r["user_id"] for r in re_add}
    for r in issues_add:
        need_u.add(r["author_id"]); need_u.add(r["closed_by_id"])
        need_u |= set(r["assignee_ids"])
    for r in mrs_add:
        need_u.add(r["author_id"]); need_u.add(r["merged_by_id"])
        need_u |= set(r["assignee_ids"]) | set(r["reviewer_ids"])
    for r in notes_add:
        need_u.add(r["author_id"])
    need_u.discard(None)
    new_u = sorted(need_u - ex_users)
    urows = []
    for ch in chunks(new_u):
        # bio lives in user_details in GitLab 15.x; location/organization are on
        # both tables, with user_details winning where it is populated.
        urows += C.qj("""SELECT id, username, name, email, state, created_at::text,
            coalesce((SELECT bio FROM user_details d WHERE d.user_id=u.id),'') AS bio,
            coalesce(nullif((SELECT location FROM user_details d WHERE d.user_id=u.id),''),
                     u.location, '') AS location,
            coalesce(nullif((SELECT organization FROM user_details d WHERE d.user_id=u.id),''),
                     u.organization, '') AS organization,
            (SELECT count(*) FROM user_follow_users f WHERE f.followee_id=u.id) AS followers,
            (SELECT count(*) FROM user_follow_users f WHERE f.follower_id=u.id) AS following
            FROM users u WHERE id IN (%s)""" % inlist(ch))
    users_add = []
    for u in urows:
        row = {"id": u["id"], "username": u["username"], "name": u["name"],
               "email": u["email"], "state": u["state"], "created_at": u["created_at"],
               "followers": u["followers"], "following": u["following"]}
        for k in ("bio", "location", "organization"):
            if u[k]:
                row[k] = u[k]
        users_add.append(row)

    for r in issues_add:
        need_l |= set(r["label_ids"])
    for r in mrs_add:
        need_l |= set(r["label_ids"])
    new_l = sorted(need_l - ex_labels)
    labels_add = []
    for ch in chunks(new_l):
        labels_add += [{"id": l["id"], "project_id": l["project_id"],
                        "title": l["title"], "color": l["color"],
                        "description": l["description"] or "",
                        "created_at": l["created_at"]}
                       for l in C.qj("""SELECT id, project_id, title, color,
                           coalesce(description,'') AS description, created_at::text
                           FROM labels WHERE id IN (%s)""" % inlist(ch))]

    need_ms = {r["milestone_id"] for r in issues_add + mrs_add} - {None}
    new_ms = sorted(need_ms - ex_ms)
    ms_add = []
    for ch in chunks(new_ms):
        ms_add += [{"id": m["id"], "iid": m["iid"], "project_id": m["project_id"],
                    "title": m["title"], "description": m["description"] or "",
                    "state": m["state"], "due_date": m["due_date"],
                    "start_date": m["start_date"], "created_at": m["created_at"],
                    "updated_at": m["updated_at"]}
                   for m in C.qj("""SELECT id, iid, project_id, title,
                       coalesce(description,'') AS description,
                       CASE state WHEN 'active' THEN 'active' ELSE state END AS state,
                       due_date::text, start_date::text, created_at::text,
                       updated_at::text FROM milestones WHERE id IN (%s)""" % inlist(ch))]

    # ------------------------------------------------ write
    print("staging")
    os.makedirs(C.HERE, exist_ok=True)
    C.save(issues_add, "issues.add.json")
    C.save(mrs_add, "merge_requests.add.json")
    C.save(notes_add, "notes.add.json")
    C.save(users_add, "users.add.json")
    C.save(labels_add, "labels.add.json")
    C.save(ms_add, "milestones.add.json")
    C.save(re_add, "resource_events.add.json")

    stats = {
        "cap_issues": CAP_ISSUES, "cap_mrs": CAP_MRS, "notes_per": NOTES_PER,
        "issues": {"before": len(ex_issues), "added": len(issues_add),
                   "after": len(ex_issues) + len(issues_add)},
        "merge_requests": {"before": len(ex_mrs), "added": len(mrs_add),
                           "after": len(ex_mrs) + len(mrs_add)},
        "notes": {"before": len(ex_notes), "added": len(notes_add),
                  "after": len(ex_notes) + len(notes_add)},
        "users": {"before": len(ex_users), "added": len(users_add),
                  "after": len(ex_users) + len(users_add)},
        "labels": {"before": len(ex_labels), "added": len(labels_add),
                   "after": len(ex_labels) + len(labels_add)},
        "milestones": {"before": len(ex_ms), "added": len(ms_add),
                       "after": len(ex_ms) + len(ms_add)},
        "resource_events": {"before": len(ex_re), "added": len(re_add),
                            "after": len(ex_re) + len(re_add)},
    }
    json.dump(stats, open(os.path.join(C.HERE, "stats_db.json"), "w"), indent=1)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
