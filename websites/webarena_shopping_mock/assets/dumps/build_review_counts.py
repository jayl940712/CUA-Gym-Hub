#!/usr/bin/env python3
"""
Derive `src/data/reviewCounts.json` — productId -> number of SEEDED reviews.

R8-001. `reviews.json` is a 18.1 MB / 5.2 MB-gzip code-split chunk (see
`utils/catalog.js`), and the PDP used to block its whole body on it. The only
thing the PDP's FIRST FRAME needs out of that chunk is one integer per product:
the Reviews tab label is `Math.max(products[].reviewsCount, len(review list))`,
because Magento draws those two numbers from different tables and does not
reconcile them (the stale `review_entity_summary` aggregate vs the `review`
collection — product 89814 renders "9 Reviews" above "Reviews (10)", and the
source does the same). 89 of the 11 358 seeded products diverge that way, so
dropping `reviews` from the boot gate without this index would make their tab
label tick 9 -> 10 the moment the chunk landed. That is exactly the flash the
gate exists to prevent.

This file INVENTS NOTHING. It is a pure `len(group_by(productId))` over
`src/data/reviews.json`, which the round-8 audit verified byte-identical to the
container on all 32 594 rows (nickname/title/detail/productId, 0 fabricated,
0 duplicated, 0 container reviews missing for a seeded product). Regenerate it
whenever `reviews.json` changes:

    python3 assets/dumps/build_review_counts.py
"""
import collections
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, "..", "..", "src", "data"))

reviews = json.load(open(os.path.join(DATA, "reviews.json")))
counts = collections.Counter(r["productId"] for r in reviews)
out = {str(k): counts[k] for k in sorted(counts)}

path = os.path.join(DATA, "reviewCounts.json")
json.dump(out, open(path, "w"), separators=(",", ":"))
print(f"wrote {path} ({os.path.getsize(path)} B, {len(out)} products, "
      f"{sum(out.values())} reviews)")
