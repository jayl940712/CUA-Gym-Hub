#!/usr/bin/env python3
"""
Split `src/data/productDescriptions.json` into `src/data/descriptions/dNN.json`.

R8-001. The description corpus is 34.71 MB raw / 9.35 MB gzip — the largest
thing in the seed by a factor of two — and it is the reason a PDP could not
paint its body until 4/4 seed chunks had transferred (16.88 MB gzip, ~1 450 ms
cold). A PDP needs exactly ONE product's description out of that corpus.

So the corpus ships as `SHARDS` code-split files keyed `id % SHARDS`, and
`utils/catalog.js` loads them two ways:

  * a PDP calls `ensureDescriptionsFor([id])` -> one shard
  * search / advanced search / list-mode tiles / compare call
    `ensureDetail(['descriptions'])` -> all of them, exactly as before

The merged in-memory object is byte-identical to the original file, so
`getDescription()` and `searchSeed()` are unchanged.

`productDescriptions.json` STAYS as the pipeline artifact — `build_seed.py`,
`clean_desc.py`, `vwa_merge.py` and `vwa_backfill.py` all write it, and the
audit compares it against `catalog_product_entity_text` in the container. It is
simply no longer imported by the app. Re-run this after any of those:

    python3 assets/dumps/build_desc_shards.py

`--check` verifies the shards still reconstruct the corpus exactly and writes
nothing.
"""
import json
import os
import sys

SHARDS = 32

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.normpath(os.path.join(HERE, "..", "..", "src", "data"))
OUT = os.path.join(DATA, "descriptions")

src = json.load(open(os.path.join(DATA, "productDescriptions.json")))

buckets = [{} for _ in range(SHARDS)]
for k, v in src.items():
    buckets[int(k) % SHARDS][k] = v

if "--check" in sys.argv:
    merged = {}
    for i in range(SHARDS):
        merged.update(json.load(open(os.path.join(OUT, "d%02d.json" % i))))
    ok = merged == src
    print(f"{'OK' if ok else 'MISMATCH'}: {len(merged)} keys vs {len(src)}")
    sys.exit(0 if ok else 1)

os.makedirs(OUT, exist_ok=True)
total = 0
for i, b in enumerate(buckets):
    path = os.path.join(OUT, "d%02d.json" % i)
    json.dump(b, open(path, "w"), separators=(",", ":"))
    total += os.path.getsize(path)
print(f"wrote {SHARDS} shards to {OUT} ({total} B over {len(src)} products; "
      f"largest {max(os.path.getsize(os.path.join(OUT, 'd%02d.json' % i)) for i in range(SHARDS))} B)")
