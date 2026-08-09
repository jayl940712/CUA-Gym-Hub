#!/usr/bin/env python3
"""Shard V — choose the phase-2 expansion set: a per-category floor, plus a rate.

The seed was 11 % of the container but distributed by *anchors*, not by
breadth: 85 of 301 categories carried fewer than 10 products and 133 fewer than
25, so a category page whose source holds 45 products rendered 4. This picks the
products that fix that, and nothing else.

THE RULE
--------

    target(c) = min( avail(c), max( FLOOR, round(RATE * avail(c)) ) )

`avail(c)` is the number of products in the container that are **listable**
(`status=1`, `visibility IN (2,4)`, `is_in_stock=1`) and directly assigned to
category `c`. Selection is greedy from the **thinnest** category outward
(ascending `avail`), taking unseeded candidates in ascending `entity_id`; each
pick credits **every** category the product belongs to, so covering a level-4
leaf also feeds its level-3 and level-2 ancestors and no product is bought
twice.

Two components, deliberately:

  * **FLOOR = 40** is what fixes the thin categories. It is a floor and not a
    quota — a category whose container total is below the floor is taken
    whole (`min(avail(c), ...)`), so nothing is invented to reach it.
  * **RATE = 0.17** is what lets the big categories grow proportionally instead
    of being frozen at their current depth while only the thin ones move.

RATE is calibrated, not chosen for roundness: 0.15 lands 21 275 products,
**0.17 lands 22 721**, 0.20 lands 25 004. 0.17 is the value that hits the
~22 700 target.

Why `avail`, and not `categories[].dbProductCount`: the round-12 audit found
`dbProductCount` disagrees with both link tables on 289 of 301 categories while
still being the number the live source *renders*, so it is right for display and
wrong as a denominator. `avail` is counted from the rows we are actually
selecting from, so the floor cannot ask for products that do not exist.

Ordering candidates by `entity_id` is arbitrary but it is *stable* and it
invents nothing. It cannot disturb the category price extrema, which are the
most fragile thing in this seed: every anchored category's true cheapest and
priciest product is ALREADY seeded (earlier rounds' `vwa_catdepth_ids`), so any
product added here is priced between them by construction and can only ever tie
an extremum, never beat it.

Input:  candidates.V.tsv  — entity_id \t image \t url_key \t categories
        (dumped read-only from the container; see DEV.part-V.md for the SELECT)
Output: vwa_floor_ids.V.txt — one entity_id per line
"""
import collections
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
MOCK = os.path.normpath(os.path.join(HERE, "..", ".."))

FLOOR = int(os.environ.get("VWA_FLOOR", 40))
RATE = float(os.environ.get("VWA_RATE", 0.17))
CANDIDATES = os.path.join(HERE, "candidates.V.tsv")
OUT = os.path.join(HERE, "vwa_floor_ids.V.txt")


def load_candidates():
    """Container products that could be seeded, with the merge's own guards applied."""
    rows, dropped = [], collections.Counter()
    with open(CANDIDATES, encoding="utf8", errors="replace") as fh:
        for ln in fh:
            f = ln.rstrip("\n").split("\t")
            if len(f) != 4:
                dropped["malformed"] += 1
                continue
            eid, img, url_key, cats = f
            # Mirror vwa_merge.py's skip rules exactly, so the floor is computed
            # over products that will actually survive the merge. A candidate
            # counted here but dropped there would leave a category short of its
            # floor with nothing in the log to say why.
            if img in ("NULL", "", "no_selection"):
                dropped["no image"] += 1
                continue
            if url_key in ("NULL", ""):
                dropped["no url_key"] += 1
                continue
            if cats in ("NULL", ""):
                dropped["no category"] += 1
                continue
            rows.append((int(eid), tuple(int(x) for x in cats.split(","))))
    rows.sort()
    return rows, dropped


def main():
    rows, dropped = load_candidates()
    products = json.load(open(os.path.join(MOCK, "src", "data", "products.json")))
    seeded = {p["id"] for p in products}

    def listable(p):
        return p["status"] == 1 and p["visibility"] in (2, 4) and p["inStock"]

    # `have` must use the same predicate the mock's isListable() uses, or the
    # floor is measured against products the category page never renders.
    have = collections.Counter()
    for p in products:
        if listable(p):
            for c in p["categoryIds"]:
                have[c] += 1
    have0 = collections.Counter(have)

    avail = collections.Counter()
    for _, cats in rows:
        for c in cats:
            avail[c] += 1

    pool = [(e, cats) for e, cats in rows if e not in seeded]
    cats_of = dict(pool)
    by_cat = collections.defaultdict(list)
    for e, cats in pool:
        for c in cats:
            by_cat[c].append(e)

    target = {c: min(avail[c], max(FLOOR, round(RATE * avail[c]))) for c in avail}

    chosen, chosen_order = set(), []
    # Thinnest first: a scarce category has the fewest candidates to satisfy it,
    # and spending them before a broad category consumes them is what keeps the
    # total selection small.
    for c in sorted(avail, key=lambda c: (avail[c], c)):
        need = target[c] - have[c]
        if need <= 0:
            continue
        for e in by_cat[c]:
            if need <= 0:
                break
            if e in chosen:
                continue
            chosen.add(e)
            chosen_order.append(e)
            for x in cats_of[e]:
                have[x] += 1
            need = target[c] - have[c]

    with open(OUT, "w") as fh:
        fh.write("\n".join(str(e) for e in sorted(chosen)) + "\n")

    cats = json.load(open(os.path.join(MOCK, "src", "data", "categories.json")))
    buckets = [("<10", lambda v: v < 10), ("10-24", lambda v: 10 <= v < 25),
               ("25-39", lambda v: 25 <= v < 40), ("40-99", lambda v: 40 <= v < 100),
               (">=100", lambda v: v >= 100)]
    print(f"candidates usable {len(rows)}  dropped {dict(dropped)}")
    print(f"unseeded pool     {len(pool)}")
    print(f"FLOOR={FLOOR} RATE={RATE}")
    print(f"selected          {len(chosen)}   -> {len(products) + len(chosen)} products")
    print("per-category seeded-product buckets, before -> after:")
    for label, fn in buckets:
        b = sum(1 for c in cats if fn(have0.get(c["id"], 0)))
        a = sum(1 for c in cats if fn(have.get(c["id"], 0)))
        print(f"  {label:<6} {b:4d} -> {a:4d}")
    short = [(have[c["id"]], avail[c["id"]], c["id"], c["name"])
             for c in cats if have[c["id"]] < FLOOR]
    print(f"still under the floor: {short or 'none'}")
    unmet = [c for c in avail if have[c] < target[c]]
    print(f"targets unmet: {len(unmet)}")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    sys.exit(main())
