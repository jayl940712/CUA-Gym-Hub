#!/usr/bin/env python3
"""R7-003 — make every shipped review field byte-identical to the container.

The defect: `vwa_backfill.jrows()` split mysql's output with `str.splitlines()`,
which breaks on U+0085 NEL and U+2028 LINE SEPARATOR as well as `\\n`. A review
body containing either was cut into two unparseable halves, and `vwa_merge.jl()`
rejoined them with a literal `\\n` -- same length, one character substituted.
Five fields shipped that way (reviews 29941, 29927, 29853, 239835, 131089).

`vwa_backfill.py` now splits on `"\\n"` only, so no future dump can do this. This
script repairs what is already in `src/data/reviews.json`, and does it over the
WHOLE population rather than the five known ids: the same dump path produced
every review in the file, so "five" is the number the audit happened to find,
not a number this script should trust.

Compares `title`, `detail` and `nickname` of every shipped review against the
container and overwrites only fields that differ. Ids, ratings, dates, product
ids and array order are untouched, and a review the container no longer has is
left alone rather than dropped.

READ-ONLY against the container.
"""
import json, os, sys, collections

DUMPS = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.abspath(os.path.join(DUMPS, "..", ".."))
sys.path.insert(0, DUMPS)
import vwa_backfill as B
from vwa_merge import jl

OUT = os.environ.get("SEED_OUT") or f"{MOCK}/src/data"
TMP = f"{DUMPS}/review_bytes_check.jsonl"

reviews = json.load(open(f"{OUT}/reviews.json"))
ids = sorted({r["productId"] for r in reviews})
print(f"seeded reviews: {len(reviews)} over {len(ids)} products")

with open(TMP, "w") as f:
    print("container rows:", B.jrows(B.REVIEWS_SQL, ids, f))

truth = {}
for r in jl(TMP):
    truth[r["review_id"]] = r

fixed = collections.Counter()
for r in reviews:
    t = truth.get(r["reviewId"])
    if not t:
        fixed["not in container"] += 1
        continue
    for mine, theirs in (("title", "title"), ("detail", "detail"), ("nickname", "nickname")):
        if r[mine] != t[theirs]:
            r[mine] = t[theirs]
            fixed[mine] += 1

print("fields repaired:", dict(fixed) or "none")
json.dump(reviews, open(f"{OUT}/reviews.json", "w"), separators=(",", ":"))
print(f"wrote {OUT}/reviews.json ({os.path.getsize(f'{OUT}/reviews.json')} B)")
