#!/usr/bin/env python3
"""Select and extract the expanded reddit seed from the `forum` container.

STRICTLY READ-ONLY against the source: every statement is a SELECT run through
`docker exec forum psql`. Nothing is invented — ids, slugs, titles, bodies,
scores and timestamps are copied byte for byte out of Postmill.

Selection, in priority order (WEBARENA_MIGRATION.md §4.1 — anchors first):

  1. every submission already in `src/data/submissions.json`  (frozen, never re-derived)
  2. every submission the 337-task anchor contract names       (unconditional)
  3. **sort coverage**: per forum, the source's top rows under each of Postmill's
     four listing sorts — `hot` (ranking), `top` (net_score), `new` (id) and
     `most_commented` (comment_count). A partial seed reproduces page N of a sort
     if and only if it contains the source's top 25*N rows under that sort, so
     this is what actually makes ordering correct rather than merely plausible.
     `HOT_DEPTH=50` buys two correct `hot` pages; 25 each for the rest buys one.
  4. a per-forum deepening by `ranking DESC, id DESC` if any budget is left

Rule 3 replaced a plain "3x by ranking" deepening after measurement: 3x-by-
ranking gave three correct `hot` pages and left `top`, `new` and
`most_commented` unreliable, while the anchor contract navigates to
`/f/EarthPorn/top?t=all`, `/f/MechanicalKeyboards/top?t=all&next[netScore]=…`
(page 2 of top), `/f/aww/most_commented`, `/f/arlingtonva/new`, `/f/pics/new`
and more. Under the old rule `/f/food` and `/f/Newark` reported the wrong
all-time most-commented post; under this one they do not.

Comments are sampled per submission under a deterministic per-post cap
(`comment_cap`) drawn from a heavy-tailed distribution that mirrors the source's
shape (36% of source submissions have zero comments; median 8, mean 20). The cap
is applied over `ORDER BY timestamp, id`, which is ancestor-closed in Postmill
because a reply is always newer than its parent — so `parent` chains never
dangle. Anchored submissions get a much higher cap so the "how many comments
mention X" evaluators can actually be answered.

Writes to assets/dumps/:
    submissions_expanded.json  comments_expanded.json
    users_expanded.json        images_expanded.json

Then run `merge_seed.py` to fold these into src/data/.

    python3 assets/dumps/extract_expansion.py
"""

import hashlib
import json
import os
import subprocess
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from anchor_ids import load_anchor_ids, page_string_anchors  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(MOCK, "src", "data")

CONTAINER = "forum"
DB = ["psql", "-U", "postgres", "-d", "postmill", "-t", "-A", "-F", "\x01", "--no-align", "-c"]

TARGET_SUBMISSIONS = 7077          # 3x the 2,359 already seeded
TARGET_COMMENTS = 21200            # ~3 per post
PAGE = 25                          # Postmill's listing page size
HOT_DEPTH = 2 * PAGE               # correct `hot` pages per forum
SORT_DEPTH = 1 * PAGE              # correct `top` / `new` / `most_commented` pages

# Cap ladder: cumulative probability -> comments kept for that post. Mean 2.98,
# with a 30% zero mass and a 3% tail at 25, so the per-post distribution has the
# source's shape instead of a flat 3 everywhere.
CAP_LADDER = [(0.30, 0), (0.55, 1), (0.72, 2), (0.84, 4),
              (0.92, 7), (0.97, 12), (1.01, 25)]
# Anchored posts: deep enough that the "how many comments mention X" and "how
# many comments are removed or deleted" evaluators can be answered by counting
# what is on the page (the deepest such post has 28 real comments).
ANCHOR_CAP = 40


def q(sql):
    """Run one SELECT in the container and return rows as lists of strings."""
    out = subprocess.run(
        ["docker", "exec", CONTAINER] + DB + [sql],
        capture_output=True, text=True, check=True).stdout
    rows = []
    for line in out.split("\n"):
        if line == "":
            continue
        rows.append(line.split("\x01"))
    return rows


def qjson(sql):
    """Run a SELECT that already produces one JSON object per row."""
    out = subprocess.run(
        ["docker", "exec", CONTAINER,
         "psql", "-U", "postgres", "-d", "postmill", "-t", "-A", "-c", sql],
        capture_output=True, text=True, check=True).stdout
    return [json.loads(l) for l in out.split("\n") if l.strip()]


def unit(seed, salt):
    """Deterministic U(0,1) from an id — reproducible across runs and machines."""
    h = hashlib.sha256(("%s:%s" % (salt, seed)).encode()).digest()
    return int.from_bytes(h[:8], "big") / 2 ** 64


def cap_for(sub_id):
    u = unit(sub_id, "cap")
    for threshold, cap in CAP_LADDER:
        if u < threshold:
            return cap
    return CAP_LADDER[-1][1]


def main():
    existing = json.load(open(os.path.join(DATA, "submissions.json")))
    existing_ids = [s["id"] for s in existing]
    existing_set = set(existing_ids)
    anchors = load_anchor_ids()
    anchor_subs = anchors["submissions"]
    anchor_coms = anchors["comments"]

    print("existing submissions : %d" % len(existing_set))
    print("anchored submissions : %d (missing %d)" % (
        len(anchor_subs), len(anchor_subs - existing_set)))

    # ---- 1/2. frozen + anchored -------------------------------------------
    # An anchored id must exist in the container; if one does not, say so rather
    # than silently dropping it.
    anchor_missing = sorted(anchor_subs - existing_set)
    if anchor_missing:
        found = {int(r[0]) for r in q(
            "SELECT id FROM submissions WHERE id IN (%s)"
            % ",".join(str(i) for i in anchor_missing))}
        absent = [i for i in anchor_missing if i not in found]
        if absent:
            print("WARNING anchored ids absent from the container: %s" % absent)
        anchor_missing = [i for i in anchor_missing if i in found]

    selected = list(existing_ids) + anchor_missing
    selected_set = set(selected)

    # ---- 3. sort coverage --------------------------------------------------
    # One window function per sort, ranked inside each forum. Everything at or
    # above the depth is taken; that is exactly the set that makes the first
    # page(s) of each listing byte-identical to the source's ordering.
    coverage = q("""
        WITH r AS (
          SELECT s.id,
            row_number() OVER (PARTITION BY s.forum_id ORDER BY s.ranking DESC, s.id DESC)       rn_hot,
            row_number() OVER (PARTITION BY s.forum_id ORDER BY s.net_score DESC, s.id DESC)     rn_top,
            row_number() OVER (PARTITION BY s.forum_id ORDER BY s.id DESC)                       rn_new,
            row_number() OVER (PARTITION BY s.forum_id ORDER BY s.comment_count DESC, s.id DESC) rn_mc
          FROM submissions s WHERE s.visibility = 'visible')
        SELECT id FROM r
        WHERE rn_hot <= %d OR rn_top <= %d OR rn_new <= %d OR rn_mc <= %d
        ORDER BY least(rn_hot, rn_top, rn_new, rn_mc), id
        """ % (HOT_DEPTH, SORT_DEPTH, SORT_DEPTH, SORT_DEPTH))
    print("sort coverage    : %d ids (hot<=%d, top/new/most_commented<=%d per forum)"
          % (len(coverage), HOT_DEPTH, SORT_DEPTH))
    for row in coverage:
        sid = int(row[0])
        if sid not in selected_set:
            selected_set.add(sid)
            selected.append(sid)

    # `active` (last_active DESC) and `controversial` (net_score **ASC**) are not
    # covered for all 95 forums — controversial in particular selects the
    # lowest-scored rows, a set disjoint from everything above, and blanket
    # coverage would cost ~2,400 extra posts for one anchor route. Cover exactly
    # the (forum, sort) pairs the contract navigates to.
    order_for = {
        "hot": "s.ranking DESC, s.id DESC", "top": "s.net_score DESC, s.id DESC",
        "new": "s.id DESC", "most_commented": "s.comment_count DESC, s.id DESC",
        "active": "s.last_active DESC, s.id DESC",
        "controversial": "s.net_score ASC, s.id ASC",
    }
    added = 0
    for forum, sort in sorted(anchors["forum_sorts"]):
        if sort not in order_for:
            continue
        for row in q("SELECT s.id FROM submissions s JOIN forums f ON f.id=s.forum_id "
                     "WHERE f.name=%s AND s.visibility='visible' ORDER BY %s LIMIT %d"
                     % (sql_str(forum), order_for[sort], SORT_DEPTH)):
            sid = int(row[0])
            if sid not in selected_set:
                selected_set.add(sid)
                selected.append(sid)
                added += 1
    print("anchored sorts   : +%d ids across %d (forum, sort) pairs"
          % (added, len(anchors["forum_sorts"])))

    # ---- 4. depth fill, only if the coverage set came in under target -------
    if len(selected_set) < TARGET_SUBMISSIONS:
        short = TARGET_SUBMISSIONS - len(selected_set)
        print("depth fill       : %d more by global ranking" % short)
        rows = q("SELECT id FROM submissions WHERE visibility='visible' "
                 "ORDER BY ranking DESC, id DESC LIMIT %d" % (short + len(selected_set) + 500))
        for r in rows:
            if len(selected_set) >= TARGET_SUBMISSIONS:
                break
            sid = int(r[0])
            if sid not in selected_set:
                selected_set.add(sid)
                selected.append(sid)

    new_ids = [i for i in selected if i not in existing_set]
    print("selected         : %d total, %d new" % (len(selected_set), len(new_ids)))

    # ---- fetch the new submissions ----------------------------------------
    subs = []
    for chunk in chunks(new_ids, 2000):
        subs += qjson("""
            SELECT json_build_object(
              'id', s.id, 'forum', f.name, 'author', u.username,
              'title', s.title, 'body', s.body, 'url', s.url,
              'timestamp', to_char(s.timestamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS+00:00'),
              'lastActive', to_char(s.last_active AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS+00:00'),
              'ranking', s.ranking, 'netScore', s.net_score,
              'commentCount', s.comment_count, 'userFlag', s.user_flag,
              'sticky', s.sticky, 'locked', s.locked, 'visibility', s.visibility,
              'image', i.file_name, 'imageWidth', i.width, 'imageHeight', i.height
            )::text
            FROM submissions s
            JOIN forums f ON f.id = s.forum_id
            JOIN users  u ON u.id = s.user_id
            LEFT JOIN images i ON i.id = s.image_id
            WHERE s.id IN (%s)""" % ",".join(str(i) for i in chunk))
    print("fetched subs     : %d" % len(subs))

    # ---- comment caps ------------------------------------------------------
    all_ids = list(existing_ids) + new_ids
    cc = {}
    for chunk in chunks(all_ids, 5000):
        for r in q("SELECT id, comment_count FROM submissions WHERE id IN (%s)"
                   % ",".join(str(i) for i in chunk)):
            cc[int(r[0])] = int(r[1])

    seeded_now = {}
    for c in json.load(open(os.path.join(DATA, "comments.json"))):
        seeded_now[c["submission"]] = seeded_now.get(c["submission"], 0) + 1

    caps = {}
    for sid in all_ids:
        cap = ANCHOR_CAP if sid in anchor_subs else cap_for(sid)
        # never shrink a post that already has comments in the frozen seed
        cap = max(cap, seeded_now.get(sid, 0))
        cap = min(cap, cc.get(sid, 0))
        if cap:
            caps[sid] = cap
    planned = sum(caps.values())
    print("planned comments : %d over %d posts (mean %.2f)"
          % (planned, len(all_ids), planned / len(all_ids)))

    # Scale the ladder toward the target without touching anchored posts, and
    # never below what the frozen seed already holds for a post.
    if not 0.96 <= planned / TARGET_COMMENTS <= 1.04:
        factor = (TARGET_COMMENTS - sum(v for k, v in caps.items() if k in anchor_subs)) / \
                 max(1, sum(v for k, v in caps.items() if k not in anchor_subs))
        print("scaling unanchored caps by %.2f" % factor)
        for sid in list(caps):
            if sid in anchor_subs:
                continue
            caps[sid] = max(seeded_now.get(sid, 0),
                            min(cc.get(sid, 0), int(round(caps[sid] * factor))))
        caps = {k: v for k, v in caps.items() if v}
        planned = sum(caps.values())
        print("planned comments : %d (mean %.2f)" % (planned, planned / len(all_ids)))

    # ---- fetch the comments -----------------------------------------------
    coms = []
    items = sorted(caps.items())
    for chunk in chunks(items, 1200):
        values = ",".join("(%d,%d)" % (s, c) for s, c in chunk)
        coms += qjson("""
            WITH want(sid, cap) AS (VALUES %s),
            ranked AS (
              SELECT c.*, row_number() OVER (
                       PARTITION BY c.submission_id ORDER BY c.timestamp, c.id) AS rn,
                     w.cap
              FROM comments c JOIN want w ON w.sid = c.submission_id
            )
            SELECT json_build_object(
              'id', r.id, 'submission', r.submission_id, 'parent', r.parent_id,
              'author', u.username, 'body', r.body, 'netScore', r.net_score,
              'timestamp', to_char(r.timestamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS+00:00'),
              'userFlag', r.user_flag, 'visibility', r.visibility
            )::text
            FROM ranked r JOIN users u ON u.id = r.user_id
            WHERE r.rn <= r.cap""" % values)
    print("fetched comments : %d" % len(coms))

    # Two sets have to be re-added by id regardless of the caps: anchored
    # comment permalinks, and every comment the frozen seed already holds — the
    # original seed did not pick by (timestamp, id), so 905 of its comments fall
    # outside the capped window and would otherwise be dropped. We only ever ADD.
    have_com = {c["id"] for c in coms}
    seed_com_ids = {c["id"] for c in json.load(open(os.path.join(DATA, "comments.json")))}
    want_com = sorted((anchor_coms | seed_com_ids) - have_com)
    extra = []
    for chunk in chunks(want_com, 2000):
        extra += qjson("""
            SELECT json_build_object(
              'id', c.id, 'submission', c.submission_id, 'parent', c.parent_id,
              'author', u.username, 'body', c.body, 'netScore', c.net_score,
              'timestamp', to_char(c.timestamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS+00:00'),
              'userFlag', c.user_flag, 'visibility', c.visibility
            )::text
            FROM comments c JOIN users u ON u.id = c.user_id
            WHERE c.id IN (%s)""" % ",".join(str(i) for i in chunk))
    coms += extra
    print("re-added by id   : %d (anchored permalinks + frozen seed)" % len(extra))

    # Anchor-string satisfaction: a `program_html` assertion scoped to a
    # submission page sometimes quotes one of that post's real comments (a body
    # substring, or a commenter's username the agent must reply to). Capping the
    # thread by timestamp can drop exactly that row, so pull it back by content.
    pairs = [(sid, val) for sid, val in page_string_anchors() if sid in set(all_ids)]
    if pairs:
        clauses = []
        for sid, val in pairs:
            literal = sql_str("%%%s%%" % val)
            clauses.append("(c.submission_id = %d AND (c.body ILIKE %s OR u.username = %s))"
                           % (sid, literal, sql_str(val)))
        rows = []
        for chunk in chunks(clauses, 60):
            rows += qjson("""
                SELECT json_build_object(
                  'id', c.id, 'submission', c.submission_id, 'parent', c.parent_id,
                  'author', u.username, 'body', c.body, 'netScore', c.net_score,
                  'timestamp', to_char(c.timestamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS+00:00'),
                  'userFlag', c.user_flag, 'visibility', c.visibility
                )::text
                FROM comments c JOIN users u ON u.id = c.user_id
                WHERE %s""" % " OR ".join(chunk))
        held = {c["id"] for c in coms}
        rows = [r for r in rows if r["id"] not in held]
        coms += rows
        print("anchor strings   : %d (submission, string) pairs -> +%d comments"
              % (len(pairs), len(rows)))

    # Ancestor closure: an added-back comment may reply to one outside the cap.
    # Walk up until every `parent` resolves, so no thread renders detached.
    for _ in range(40):
        held = {c["id"] for c in coms}
        missing = sorted({c["parent"] for c in coms
                          if c.get("parent") is not None and c["parent"] not in held})
        if not missing:
            break
        rows = []
        for chunk in chunks(missing, 2000):
            rows += qjson("""
                SELECT json_build_object(
                  'id', c.id, 'submission', c.submission_id, 'parent', c.parent_id,
                  'author', u.username, 'body', c.body, 'netScore', c.net_score,
                  'timestamp', to_char(c.timestamp AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS+00:00'),
                  'userFlag', c.user_flag, 'visibility', c.visibility
                )::text
                FROM comments c JOIN users u ON u.id = c.user_id
                WHERE c.id IN (%s)""" % ",".join(str(i) for i in chunk))
        coms += rows
        print("ancestor closure : +%d" % len(rows))
    print("total comments   : %d (mean %.2f/post)" % (len(coms), len(coms) / len(all_ids)))

    # ---- authors -----------------------------------------------------------
    authors = sorted({s["author"] for s in subs} | {c["author"] for c in coms})
    users = []
    for chunk in chunks(authors, 2000):
        users += qjson("""
            SELECT json_build_object('username', username,
              'created', to_char(created AT TIME ZONE 'UTC','YYYY-MM-DD'))::text
            FROM users WHERE username IN (%s)"""
            % ",".join(sql_str(a) for a in chunk))
    print("authors          : %d" % len(users))

    imgs = sorted({s["image"] for s in subs if s.get("image")})
    print("new image files  : %d" % len(imgs))

    dump("submissions_expanded.json", subs)
    dump("comments_expanded.json", coms)
    dump("users_expanded.json", users)
    dump("images_expanded.json", imgs)
    return 0


def sql_str(value):
    return "'" + value.replace("'", "''") + "'"


def chunks(seq, n):
    for i in range(0, len(seq), n):
        yield seq[i:i + n]


def dump(name, obj):
    path = os.path.join(HERE, name)
    with open(path, "w") as fh:
        json.dump(obj, fh, ensure_ascii=False)
    print("wrote %-28s %8.1f KB" % (name, os.path.getsize(path) / 1024))


if __name__ == "__main__":
    sys.exit(main())
