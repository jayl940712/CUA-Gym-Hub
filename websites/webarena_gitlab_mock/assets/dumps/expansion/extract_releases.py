#!/usr/bin/env python3
"""Expansion stage 4 — releases and issue boards.

Two categories the previous expansion left alone:

  releases : 1 732 rows over 48 projects. `/:ns/:proj/-/releases` renders an
             empty state in the mock today, so this is a whole dead page.
  boards   : the 9 `boards` rows plus their `lists`. Every row upstream is the
             default board GitLab lazily creates the first time someone opens
             `/-/boards`, so this is small and degenerate — see the note below.

Writes `releases.add.json` and `boards.add.json`. Read-only throughout;
`merge.py` is still the only script that writes `src/data/`.

Field notes
-----------
* `releases.sha` is EMPTY for all 1 732 rows in this instance (the importer did
  not populate it), so it is not carried. The tag link is `tag`, which is what
  the live footer links to.
* `description` is kept up to DESC_CLIP = 4 000 chars rather than the 700-char
  clip `trim.py` applies to issues and notes: a release description IS the page,
  and the whole column is only 1.1 MB at 4 000 — and it is per-project, so it
  lands in a lazy chunk and costs nothing at first paint. One row upstream is
  56 KB; the clip exists for that one.
* `released_at` is `timestamp with time zone` and `created_at` is not, so
  `released_at::text` would carry a `+00` suffix — and `format.js:parseDate`
  only accepts `[+-]HH:MM` or `[+-]HHMM`, so `2023-03-14 20:06:21+00` parsed as
  `null` and the card's "Released <n> years ago" rendered EMPTY. It is emitted
  as `AT TIME ZONE 'UTC'` instead, which is naive-UTC text in exactly the shape
  every other timestamp in the seed uses. (Caught by screenshotting the page,
  not by any assertion — `timeAgo(null)` returns `''` rather than throwing.)
"""
import collections
import json
import os

import common as C

DESC_CLIP = 4000

# `lists.list_type` enum, GitLab 15.7 (app/models/list.rb)
LIST_TYPE = {0: "backlog", 1: "label", 2: "closed", 3: "assignee",
             4: "milestone", 5: "iteration"}


def clip(s, n):
    if s and len(s) > n:
        return s[:n].rsplit(" ", 1)[0] + "\n\n…"
    return s or ""


def main():
    projects = C.load("projects.json")
    pids = {p["id"] for p in projects}
    ex_users = {u["id"] for u in C.load("users.json")}
    try:
        add_users = {u["id"] for u in json.load(
            open(os.path.join(C.HERE, "users.add.json")))}
    except FileNotFoundError:
        add_users = set()
    known_users = ex_users | add_users

    # ------------------------------------------------------------- releases
    print("fetching releases")
    rows = C.qj("""SELECT id, project_id, tag, name, author_id,
        left(description, %d) AS description,
        (released_at AT TIME ZONE 'UTC')::text AS released_at, created_at::text
        FROM releases ORDER BY project_id, released_at DESC, id DESC"""
                % (DESC_CLIP + 200))

    by_project = collections.defaultdict(list)
    skipped = 0
    for r in rows:
        if r["project_id"] not in pids:
            skipped += 1
            continue
        by_project[str(r["project_id"])].append({
            # `id` is carried because the live keyset cursor is
            # base64({"released_at":…,"id":…}) — see src/pages/Releases.jsx.
            "id": r["id"],
            "tag": r["tag"],
            "name": r["name"] or r["tag"],
            "description": clip(r["description"], DESC_CLIP),
            "author_id": r["author_id"],
            "released_at": r["released_at"],
            "created_at": r["created_at"],
        })
    total = sum(len(v) for v in by_project.values())
    print("  %d releases over %d projects (%d skipped: project not in seed)"
          % (total, len(by_project), skipped))

    need_u = {rel["author_id"] for v in by_project.values() for rel in v} - {None}
    missing_u = sorted(need_u - known_users)
    print("  release authors: %d distinct, %d not yet seeded"
          % (len(need_u), len(missing_u)))

    releases = {
        "_source": "WebArena GitLab 15.7 · releases, read-only",
        "_static": "STATIC REFERENCE DATA — never enters mutable session state",
        "_page_size": 10,
        "projects": {k: by_project[k] for k in
                     sorted(by_project, key=lambda x: int(x))},
    }

    # --------------------------------------------------------------- boards
    # Every `boards` row in this instance is the default board GitLab creates
    # lazily on the first visit to `/-/boards` — same name ("Development"), same
    # two lists (backlog + closed), no label/assignee/milestone lists, both
    # `hide_*` flags false. The 9 rows are therefore the 9 projects whose board
    # page someone happened to open, not 9 distinct configurations; a project
    # WITHOUT a row still renders the identical default board upstream. The data
    # is carried anyway so the mock's board title and list set come from the
    # source rather than from a literal in the component.
    print("fetching boards")
    boards = C.qj("""SELECT id, project_id, name, milestone_id, weight,
        hide_backlog_list, hide_closed_list, created_at::text, updated_at::text
        FROM boards ORDER BY id""")
    lists = collections.defaultdict(list)
    for l in C.qj("""SELECT id, board_id, label_id, list_type, position,
            user_id, milestone_id, created_at::text
            FROM lists ORDER BY board_id, position, id"""):
        lists[l["board_id"]].append({
            "id": l["id"], "list_type": LIST_TYPE.get(l["list_type"], "unknown"),
            "position": l["position"], "label_id": l["label_id"],
            "user_id": l["user_id"], "milestone_id": l["milestone_id"],
        })
    boards_add = [{
        "id": b["id"], "project_id": b["project_id"], "name": b["name"],
        "milestone_id": b["milestone_id"], "weight": b["weight"],
        "hide_backlog_list": bool(b["hide_backlog_list"]),
        "hide_closed_list": bool(b["hide_closed_list"]),
        "created_at": b["created_at"], "updated_at": b["updated_at"],
        "lists": lists.get(b["id"], []),
    } for b in boards if b["project_id"] in pids]
    print("  %d boards, %d lists" % (len(boards_add),
                                     sum(len(b["lists"]) for b in boards_add)))

    print("staging")
    C.save(releases, "releases.add.json")
    C.save(boards_add, "boards.add.json")

    stats = {
        "releases": {"before": 0, "added": total, "after": total,
                     "projects": len(by_project),
                     "authors_missing_from_users": missing_u},
        "boards": {"before": 0, "added": len(boards_add), "after": len(boards_add)},
    }
    json.dump(stats, open(os.path.join(C.HERE, "stats_releases.json"), "w"),
              indent=1)
    print(json.dumps(stats, indent=1))


if __name__ == "__main__":
    main()
