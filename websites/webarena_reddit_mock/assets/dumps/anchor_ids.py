#!/usr/bin/env python3
"""Resolve the reddit task contract down to the concrete records the seed must hold.

Reads BOTH anchor contracts — `assets/task_anchors.json` (webarena.jsonl, 129
tasks) and `assets/task_anchors_vwa.json` (visualwebarena.jsonl, 208 tasks) —
and turns their routes and evaluator expressions into sets of primary keys:

    submissions   /f/<forum>/<id>[/<slug>]           and reddit_get_post_url
    comments      /f/<forum>/<id>/<slug>/comment/<c>
    forums        /f/<forum>...           (every route under /f/)
    users         /user/<name>[/...]      and the username argument of the
                  reddit_get_*_by_username evaluators

Used by `select_expansion.py` to seed anchored records FIRST and
unconditionally, before any numeric fill. Importable (`load_anchor_ids()`) and
runnable (prints a gap report against the current seed).

    python3 assets/dumps/anchor_ids.py            # gap report vs src/data
"""

import json
import os
import re
import sys
from urllib.parse import unquote

HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.dirname(os.path.dirname(HERE))
ASSETS = os.path.join(MOCK, "assets")
DATA = os.path.join(MOCK, "src", "data")

# /f/<forum>/<sort> collides with /f/<forum>/<id>; Postmill's sort segments are
# a closed set (SubmissionController::frontPage sortModes) so list them out.
SORT_SEGMENTS = {
    "hot", "new", "top", "active", "controversial", "most_commented",
    "edit", "moderators", "bans", "log", "wiki", "delete", "subscribe",
    "unsubscribe", "submit", "appearance", "flairs", "tags",
}

USERNAME_ARG_RE = re.compile(r"reddit_get_\w*by_username\(\s*__page__\s*,\s*['\"]([^'\"]+)['\"]")

# Postmill's listing sorts (SubmissionPage::$sortModes). `hot`, `top`, `new` and
# `most_commented` get blanket coverage in the expansion; `active` and
# `controversial` are covered only for the forums an anchor route actually names,
# because `controversial` is net_score ASC and pulls in a completely disjoint set
# of low-scored rows.
LISTING_SORTS = {"hot", "new", "top", "active", "controversial", "most_commented"}


def _anchor_files():
    for name in ("task_anchors.json", "task_anchors_vwa.json"):
        path = os.path.join(ASSETS, name)
        if os.path.exists(path):
            yield name, json.load(open(path))


def _paths(doc):
    """Every path the contract names: anchor routes plus per-task start/url/page anchors."""
    seen = []
    for row in doc.get("anchor_routes", []):
        seen.append(row["path"])
    for task in doc.get("tasks", []):
        for key in ("start_urls", "url_anchors", "page_anchors"):
            for value in task.get(key, []) or []:
                if isinstance(value, str):
                    seen.append(value)
    for row in doc.get("anchor_strings", []):
        for page in row.get("pages", []) or []:
            if page.startswith("/"):
                seen.append(page)
    return seen


def page_string_anchors():
    """[(submission_id, string)] for every anchor string scoped to a submission page.

    `program_html` assertions name a page and a string that must appear on it.
    Most of those strings are content the *agent* creates (a new comment, an
    edited bio), and are correctly absent from the seed — the live source does
    not render them either. But a few are quoting the source's own comment
    bodies or a commenter's username, and those only render if the specific
    comment is seeded. Capping a thread at N by timestamp can drop exactly that
    comment, so `extract_expansion.py` pulls them back in by content.
    """
    out = []
    for _, doc in _anchor_files():
        for row in doc.get("anchor_strings", []):
            value = row.get("value") or ""
            if "|OR|" in value or len(value) < 3:
                continue
            for page in row.get("pages", []) or []:
                segs = [s for s in unquote(page).split("/") if s]
                if len(segs) >= 3 and segs[0] == "f" and segs[2].isdigit():
                    out.append((int(segs[2]), value))
    return sorted(set(out))


def load_anchor_ids():
    """-> dict with submissions/comments/forums/users sets and a per-source breakdown."""
    out = {
        "submissions": set(), "comments": set(), "forums": set(), "users": set(),
        "forum_sorts": set(), "by_source": {},
    }
    for name, doc in _anchor_files():
        src = {"submissions": set(), "comments": set(), "forums": set(),
               "users": set(), "forum_sorts": set()}
        for raw in _paths(doc):
            path = unquote(raw.split("?", 1)[0].split("#", 1)[0])
            segs = [s for s in path.split("/") if s]
            if not segs:
                continue
            if segs[0] == "f" and len(segs) >= 2:
                src["forums"].add(segs[1])
                if len(segs) >= 3 and segs[2] in LISTING_SORTS:
                    src["forum_sorts"].add((segs[1], segs[2]))
                if len(segs) >= 3 and segs[2].isdigit():
                    src["submissions"].add(int(segs[2]))
                    # /f/<forum>/<id>/<slug>/comment/<cid>
                    if len(segs) >= 6 and segs[4] == "comment" and segs[5].isdigit():
                        src["comments"].add(int(segs[5]))
            elif segs[0] == "user" and len(segs) >= 2:
                src["users"].add(segs[1])
            elif segs[0] == "comment" and len(segs) >= 2 and segs[1].isdigit():
                src["comments"].add(int(segs[1]))
        for row in doc.get("evaluator_functions", []) or []:
            for expr in row.get("expressions", []) or [row.get("example", "")]:
                for match in USERNAME_ARG_RE.finditer(expr or ""):
                    src["users"].add(match.group(1))
        # the extractor's md/json shape varies; sweep the raw text as a backstop
        for match in USERNAME_ARG_RE.finditer(json.dumps(doc)):
            src["users"].add(match.group(1))
        out["by_source"][name] = {k: sorted(v) for k, v in src.items()}
        for k in ("submissions", "comments", "forums", "users", "forum_sorts"):
            out[k] |= src[k]
    # forum route segments that are really sort modes, not forums
    out["forums"] -= SORT_SEGMENTS
    return out


def main():
    ids = load_anchor_ids()
    subs = {s["id"] for s in json.load(open(os.path.join(DATA, "submissions.json")))}
    coms = {c["id"] for c in json.load(open(os.path.join(DATA, "comments.json")))}
    forums = {f["name"] for f in json.load(open(os.path.join(DATA, "forums.json")))}
    users = set(json.load(open(os.path.join(DATA, "userDirectory.json"))))

    print("ANCHOR CONTRACT (webarena + visualwebarena)")
    print("  forum/sort routes anchored: %s" % ", ".join(
        "%s/%s" % pair for pair in sorted(ids["forum_sorts"])))
    for name, block in ids["by_source"].items():
        print("  %-24s subs=%-4d comments=%-3d forums=%-3d users=%d" % (
            name, len(block["submissions"]), len(block["comments"]),
            len(block["forums"]), len(block["users"])))
    print()
    rows = [
        ("submissions", ids["submissions"], subs),
        ("comments", ids["comments"], coms),
        ("forums", ids["forums"], forums),
        ("users", ids["users"], users),
    ]
    for label, wanted, have in rows:
        missing = sorted(wanted - have, key=str)
        print("%-12s anchored=%-4d present=%-4d MISSING=%d" % (
            label, len(wanted), len(wanted & have), len(missing)))
        if missing:
            print("             %s" % ", ".join(str(m) for m in missing[:40]))
            if len(missing) > 40:
                print("             ... +%d more" % (len(missing) - 40))
    return 0


if __name__ == "__main__":
    sys.exit(main())
