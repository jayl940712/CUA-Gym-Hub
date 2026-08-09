#!/usr/bin/env python3
"""R6-006: re-derive `categories.json.dbProductCount` as the count the source's
listing toolbar actually renders.

READ-ONLY against the container: one SELECT.

The seeded value was `COUNT(*)` over `catalog_category_product`, which counts
rows the storefront never shows. Magento's listing collection reads the category
index and then inner-joins the **price index**, which drops products with no
indexed price for the customer group / website. That join is the whole
difference, and it is not a rounding error:

    category   raw   index   index x price   source toolbar
    10         328   328     320             320
    60         650   650     631             "of 631"   (SOURCE.md obs. 9)
    85         103   103      98              98        (AUDIT R6-006)
    226        180   180     176             176        (AUDIT R6-006)

`visibility IN (2,4)` was also tried and changes nothing (the index is already
visibility-scoped), so the price join is the operative filter, not visibility.

This only moves the *fallback* count used for categories with no captured
`listings.json` entry — a captured listing still wins, because its count is the
source's own rendered string.

    /tmp/pwvenv/bin/python assets/dumps/vwa_catcounts.py
"""
import json, os, re, subprocess, sys

MOCK = "/webarena/CUA-Gym-Hub/websites/webarena_shopping_mock"
CATS = f"{MOCK}/src/data/categories.json"

MYSQL = ["docker", "exec", "shopping", "mysql", "-umagentouser", "-pMyPassword",
         "magentodb", "-N", "--raw", "-B", "-e"]

SQL = """SELECT i.category_id, COUNT(DISTINCT i.product_id)
FROM catalog_category_product_index_store1 i
JOIN catalog_product_index_price p
  ON p.entity_id = i.product_id AND p.customer_group_id = 0 AND p.website_id = 1
GROUP BY i.category_id;"""


def main():
    assert SQL.lstrip().upper().startswith("SELECT"), "not a SELECT"
    r = subprocess.run(MYSQL + [SQL], capture_output=True, text=True)
    if r.returncode:
        sys.exit("mysql failed: " + r.stderr[:2000])
    counts = {}
    for ln in r.stdout.splitlines():
        if not ln.strip():
            continue
        cid, n = ln.split("\t")
        counts[int(cid)] = int(n)
    print(f"indexed categories in the container: {len(counts)}")

    cats = json.load(open(CATS))
    changed = missing = 0
    for c in cats:
        n = counts.get(c["id"])
        if n is None:
            # A category with no priced, indexed product: the source's toolbar
            # renders an empty state, so 0 is the faithful value. Do not leave
            # the raw count behind — that is the bug being fixed.
            n = 0
            missing += 1
        if c.get("dbProductCount") != n:
            changed += 1
        c["dbProductCount"] = n
    json.dump(cats, open(CATS, "w"), separators=(",", ":"))
    print(f"categories: {len(cats)} | dbProductCount changed: {changed} | "
          f"absent from the price-indexed join (set to 0): {missing}")


if __name__ == "__main__":
    main()
