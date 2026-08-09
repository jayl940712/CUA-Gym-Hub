#!/usr/bin/env python3
"""Fold the extracted expansion into src/data/, additively.

The 2,359 submissions and 2,593 comments already in `src/data/` are **frozen**:
they are copied through byte for byte, in their existing order, and this script
aborts if any of them would change or disappear. Everything new is appended.

Field shape for new records is normalised to the existing seed's convention —
absent rather than null/false for `body`, `url`, `image`, `sticky`, `locked`, and
`visibility: 'visible'` — so the two halves are indistinguishable downstream.

`slug` is not stored by Postmill; it is derived from the title at render time by
`App\\Utils\\Slugger` (max length 60, split on non-word runs). The port here is
byte-verified against all 2,359 existing slugs before it is used on a new one.

Also refreshes:
    userDirectory.json   every new author, username -> created date
    forums.json          `submissionCount` left at the SOURCE value (see SOURCE.md)

    python3 assets/dumps/merge_seed.py
"""

import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(MOCK, "src", "data")

WORD_RUN = re.compile(r"[^\w]+", re.UNICODE)

# Key order the existing seed uses, so a diff of the merged file stays readable.
SUB_KEYS = ["id", "forum", "author", "title", "body", "bodyTruncated", "url",
            "timestamp", "lastActive", "ranking", "netScore", "commentCount",
            "image", "imageWidth", "imageHeight", "slug", "userFlag",
            "sticky", "locked", "visibility"]
COM_KEYS = ["id", "submission", "parent", "author", "body", "bodyTruncated",
            "netScore", "timestamp", "userFlag", "visibility"]


def slugify(title, max_length=60):
    """Port of App\\Utils\\Slugger::slugify (SluggerInterface::DEFAULT_MAX_LENGTH=60)."""
    words = [w for w in WORD_RUN.split(title.lower()) if w]
    slug, length = "", 0
    for word in words:
        add = ("-" + word) if length else word
        length += len(add)
        if length > max_length:
            break
        slug += add
    return slug or "-"


def prune(record, keys):
    """Emit keys in seed order, dropping the seed's implicit defaults."""
    out = {}
    for key in keys:
        value = record.get(key)
        if value is None or value == "" or value is False:
            continue
        if key == "visibility" and value == "visible":
            continue
        out[key] = value
    return out


def load(name, where=DATA):
    return json.load(open(os.path.join(where, name)))


def save(name, obj):
    path = os.path.join(DATA, name)
    with open(path, "w") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print("wrote src/data/%-22s %8.1f KB" % (name, os.path.getsize(path) / 1024))


def main():
    subs = load("submissions.json")
    coms = load("comments.json")
    directory = load("userDirectory.json")

    # Guard: the slug port must reproduce every frozen slug before it is trusted.
    wrong = [s["id"] for s in subs if slugify(s["title"]) != s.get("slug")]
    if wrong:
        print("ABORT: slugify() disagrees with %d frozen slugs, e.g. %s"
              % (len(wrong), wrong[:5]))
        return 1
    print("slug port verified : %d/%d frozen slugs reproduced" % (len(subs), len(subs)))

    new_subs = load("submissions_expanded.json", HERE)
    new_coms = load("comments_expanded.json", HERE)
    new_users = load("users_expanded.json", HERE)

    have_sub = {s["id"] for s in subs}
    have_com = {c["id"] for c in coms}

    added_subs = []
    for record in new_subs:
        if record["id"] in have_sub:
            continue
        record["slug"] = slugify(record["title"])
        added_subs.append(prune(record, SUB_KEYS))
    added_coms = [prune(c, COM_KEYS) for c in new_coms if c["id"] not in have_com]

    merged_subs = subs + added_subs
    merged_coms = coms + added_coms

    # ---- invariants --------------------------------------------------------
    ok = True
    if len({s["id"] for s in merged_subs}) != len(merged_subs):
        print("ABORT: duplicate submission ids"); ok = False
    if len({c["id"] for c in merged_coms}) != len(merged_coms):
        print("ABORT: duplicate comment ids"); ok = False
    sub_ids = {s["id"] for s in merged_subs}
    dangling = {c["submission"] for c in merged_coms} - sub_ids
    if dangling:
        print("ABORT: %d comments point at absent submissions" % len(dangling)); ok = False
    com_ids = {c["id"] for c in merged_coms}
    orphans = [c["id"] for c in merged_coms
               if c.get("parent") is not None and c["parent"] not in com_ids]
    if orphans:
        print("ABORT: %d comments have an absent parent" % len(orphans)); ok = False
    if not ok:
        return 1

    # ---- authors -----------------------------------------------------------
    before_users = len(directory)
    for user in new_users:
        directory.setdefault(user["username"], user["created"])
    authors = {s["author"] for s in merged_subs} | {c["author"] for c in merged_coms}
    unknown = sorted(authors - set(directory))
    if unknown:
        print("ABORT: %d authors absent from userDirectory, e.g. %s"
              % (len(unknown), unknown[:5]))
        return 1

    print("submissions        : %d -> %d (+%d)" % (len(subs), len(merged_subs), len(added_subs)))
    print("comments           : %d -> %d (+%d)" % (len(coms), len(merged_coms), len(added_coms)))
    print("userDirectory      : %d -> %d (+%d)"
          % (before_users, len(directory), len(directory) - before_users))
    print("image submissions  : %d" % sum(1 for s in merged_subs if s.get("image")))

    save("submissions.json", merged_subs)
    save("comments.json", merged_coms)
    save("userDirectory.json", dict(sorted(directory.items())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
