#!/usr/bin/env python3
"""Pick the category-depth backfill set (READ-ONLY against `shopping`).

VWA is full of "buy the least/most expensive <thing> from <category>" tasks, so
the right answer is a function of the WHOLE category's inventory. Seeding the
head of the default ordering is useless; what matters is that the category's
true price extremes are present. For every anchored category we therefore take
the cheapest K and the most expensive K by the source's own `price` value.

Writes assets/dumps/vwa_catdepth_ids.txt (entity_ids to add) and
vwa_catdepth.json (per-category diagnostics: source count, current seeded
count, the source's true min/max SKU).
"""
import json, os, re, subprocess, sys, collections

ROOT = "/webarena/CUA-Gym-Hub"
MOCK = f"{ROOT}/websites/webarena_shopping_mock"
DUMPS = f"{MOCK}/assets/dumps"

# Cheapest/priciest K per anchored category. Tasks qualify the extremum
# ("least expensive RED blanket"), so K has to be wide enough that the
# qualifying item is usually inside the band, not just the single extreme.
K_BASE = 30
K_HOT = 60          # categories named by >= 2 tasks
K_OTHER = 2         # unanchored categories: enough to fix both extremes

MYSQL = ["docker", "exec", "shopping", "mysql", "-umagentouser", "-pMyPassword",
         "magentodb", "-N", "-B", "-e"]
_LITERAL = re.compile(r"'(?:\\.|[^'\\])*'", re.S)


def q(sql):
    bare = _LITERAL.sub("''", sql)
    assert bare.lstrip().upper().startswith("SELECT"), "not a SELECT"
    assert not re.search(r'\b(update|insert|delete|drop|alter|create|truncate|replace)\b',
                         bare, re.I), "refusing to run a mutating statement"
    r = subprocess.run(MYSQL + [sql], capture_output=True, text=True)
    if r.returncode:
        sys.exit("mysql failed: " + r.stderr[:2000])
    return [ln.split("\t") for ln in r.stdout.splitlines() if ln]


def main():
    anchors = json.load(open(f"{MOCK}/assets/task_anchors_vwa.json"))
    cats = json.load(open(f"{MOCK}/src/data/categories.json"))
    products = json.load(open(f"{MOCK}/src/data/products.json"))

    by_path = {c["urlPath"]: c for c in cats}
    seeded_per_cat = collections.Counter()
    for p in products:
        for cid in p["categoryIds"]:
            seeded_per_cat[cid] += 1

    # ---- anchored category routes, with the number of tasks naming each ----
    tasks_per_path = collections.Counter()
    for r in anchors["anchor_routes"]:
        b = r["path"].split("?")[0].split("#")[0].lstrip("/")
        if not b.endswith(".html"):
            continue
        path = b[:-5]
        if path in by_path:
            tasks_per_path[path] += len(r["task_ids"])
    # Category names also show up in task questions ("from \"Blankets & Throws\"");
    # count a category as anchored if its *name* appears in a question too.
    name_to_path = {}
    for c in cats:
        name_to_path.setdefault(c["name"], []).append(c["urlPath"])
    for t in anchors["tasks"]:
        qtext = t.get("question") or ""
        for nm, paths in name_to_path.items():
            if len(nm) >= 5 and f'"{nm}"' in qtext:
                for p in paths:
                    tasks_per_path[p] += 1

    # Every category, not just the anchored ones. Which categories count as
    # "anchored" depends on the derivation (vwa_catdepth's rule finds 106, the
    # audit's finds 103, and the two sets are not nested), and an extremum that
    # is right only under one derivation is a coin flip. Covering all of them
    # costs a small id set, so the denominator argument goes away entirely.
    targets = sorted(by_path)
    print(f"categories: {len(targets)}  (anchored: {len(tasks_per_path)})")

    # ---- pull each category's real inventory, price-sorted ----
    #
    # `catalog_category_product` is DIRECT ASSIGNMENT ONLY. Magento renders a
    # listing from `catalog_category_product_index_store1`, which rolls the whole
    # descendant subtree up into the parent, and the mock agrees with Magento
    # (`src/utils/catalog.js:585` uses `descendantIds`). Selecting from the raw
    # table validated the extremes against a set the mock never shows — VWAP-005.
    #
    # Price likewise comes from `catalog_product_index_price` rather than the
    # `price` attribute, because that is what the page sorts on: it carries the
    # special price and it omits out-of-stock products, which Magento hides when
    # `cataloginventory/options/show_out_of_stock` is unset (it is).
    out, ids = {}, set()
    for path in targets:
        cid = by_path[path]["id"]
        rows = q(
            "SELECT e.entity_id, e.sku, pi.final_price "
            "FROM catalog_category_product_index_store1 ccpi "
            "JOIN catalog_product_entity e ON e.entity_id=ccpi.product_id "
            "JOIN catalog_product_index_price pi ON pi.entity_id=e.entity_id "
            "  AND pi.customer_group_id=0 AND pi.website_id=1 "
            f"WHERE ccpi.store_id=1 AND ccpi.visibility IN (2,4) "
            f"AND ccpi.category_id={cid} ORDER BY pi.final_price ASC;")
        prices = [(int(a), b, float(c)) for a, b, c in rows]
        if path in tasks_per_path:
            k = K_HOT if tasks_per_path[path] >= 2 else K_BASE
        else:
            k = K_OTHER
        pick = prices[:k] + prices[-k:]
        ids |= {p[0] for p in pick}
        out[path] = {
            "categoryId": cid, "tasks": tasks_per_path[path],
            "sourceCount": len(prices), "seededBefore": seeded_per_cat[cid], "k": k,
            "minSku": prices[0][1] if prices else None,
            "minPrice": prices[0][2] if prices else None,
            "maxSku": prices[-1][1] if prices else None,
            "maxPrice": prices[-1][2] if prices else None,
        }
        if not prices:
            print(f"  !! {path}: source has 0 priced products")

    open(f"{DUMPS}/vwa_catdepth_ids.txt", "w").write(
        "\n".join(str(i) for i in sorted(ids)) + "\n")
    json.dump(out, open(f"{DUMPS}/vwa_catdepth.json", "w"), indent=1)

    zero = [p for p, v in out.items() if v["seededBefore"] == 0]
    print(f"zero-product anchored categories before: {len(zero)}")
    print(f"entity_ids picked for category depth   : {len(ids)}")


if __name__ == "__main__":
    main()
