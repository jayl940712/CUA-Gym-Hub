#!/usr/bin/env python3
"""Measure anchored-category price extrema: mock-as-rendered vs source-as-rendered.

VWAP-005. `vwa_catdepth.py` picked its extremes out of `catalog_category_product`
(direct assignment only), but Magento renders a listing from
`catalog_category_product_index_store1`, which rolls up the whole descendant
subtree — and `src/utils/catalog.js:585` agrees with Magento (`descendantIds`).
So the extremes were validated against a set the mock never shows.

Source side here mirrors what the category page actually sorts on:
  catalog_category_product_index_store1 (store_id=1, visibility IN (2,4))
  JOIN catalog_product_index_price (customer_group_id=0, website_id=1)
which is Magento's own price index — so out-of-stock products are already
absent, exactly as `show_out_of_stock=0` makes the page behave.

Mock side reimplements resolveListing's pool: descendant rollup + isListable
(status/visibility/inStock) + finalPrice (specialPrice ?? price).

Read-only. Writes assets/dumps/vwa_extrema.json.
"""
import collections, json, re, subprocess, sys

ROOT = "/webarena/CUA-Gym-Hub"
MOCK = f"{ROOT}/websites/webarena_shopping_mock"
DUMPS = f"{MOCK}/assets/dumps"

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


def anchored_paths(cats, by_path):
    """Same anchoring rule as vwa_catdepth.py, so the denominators line up."""
    anchors = json.load(open(f"{MOCK}/assets/task_anchors_vwa.json"))
    tasks_per_path = collections.Counter()
    for r in anchors["anchor_routes"]:
        b = r["path"].split("?")[0].split("#")[0].lstrip("/")
        if not b.endswith(".html"):
            continue
        path = b[:-5]
        if path in by_path:
            tasks_per_path[path] += len(r["task_ids"])
    name_to_path = {}
    for c in cats:
        name_to_path.setdefault(c["name"], []).append(c["urlPath"])
    for t in anchors["tasks"]:
        qtext = t.get("question") or ""
        for nm, paths in name_to_path.items():
            if len(nm) >= 5 and f'"{nm}"' in qtext:
                for p in paths:
                    tasks_per_path[p] += 1
    return tasks_per_path


def descendants(cats):
    kids = collections.defaultdict(list)
    for c in cats:
        if c.get("parentId") is not None:
            kids[c["parentId"]].append(c["id"])
    def walk(cid):
        out, stack = {cid}, [cid]
        while stack:
            for k in kids[stack.pop()]:
                if k not in out:
                    out.add(k)
                    stack.append(k)
        return out
    return walk


def main():
    cats = json.load(open(f"{MOCK}/src/data/categories.json"))
    products = json.load(open(f"{MOCK}/src/data/products.json"))
    by_path = {c["urlPath"]: c for c in cats}
    walk = descendants(cats)
    tasks_per_path = anchored_paths(cats, by_path)
    targets = sorted(tasks_per_path)

    listable = [p for p in products
                if p.get("status") == 1 and p.get("visibility", 0) >= 4 and p.get("inStock")]
    by_cat = collections.defaultdict(list)
    for p in listable:
        fp = p["specialPrice"] if p.get("specialPrice") is not None else p["price"]
        for cid in p["categoryIds"]:
            by_cat[cid].append((fp, p["sku"], p["name"], p["id"]))

    # Whole source side in one query: every anchored category's indexed inventory.
    cids = sorted({by_path[p]["id"] for p in targets})
    rows = q(
        "SELECT ccpi.category_id, e.entity_id, e.sku, pi.final_price "
        "FROM catalog_category_product_index_store1 ccpi "
        "JOIN catalog_product_entity e ON e.entity_id=ccpi.product_id "
        "JOIN catalog_product_index_price pi ON pi.entity_id=e.entity_id "
        "  AND pi.customer_group_id=0 AND pi.website_id=1 "
        f"WHERE ccpi.store_id=1 AND ccpi.visibility IN (2,4) "
        f"AND ccpi.category_id IN ({','.join(map(str, cids))});")
    src = collections.defaultdict(list)
    for cid, eid, sku, price in rows:
        src[int(cid)].append((float(price), sku, int(eid)))

    out, bad_min, bad_max = {}, [], []
    for path in targets:
        cid = by_path[path]["id"]
        s = sorted(src.get(cid, []))
        pool = []
        for d in walk(cid):
            pool.extend(by_cat.get(d, []))
        pool = sorted(set(pool))
        rec = {
            "categoryId": cid, "tasks": tasks_per_path[path],
            "srcCount": len(s), "mockCount": len(pool),
            "srcMin": s[0][:2] if s else None, "srcMax": s[-1][:2] if s else None,
            "mockMin": pool[0][:2] if pool else None,
            "mockMax": pool[-1][:2] if pool else None,
            "srcMinId": s[0][2] if s else None, "srcMaxId": s[-1][2] if s else None,
        }
        rec["minOk"] = bool(s and pool and s[0][1] == pool[0][1])
        rec["maxOk"] = bool(s and pool and s[-1][1] == pool[-1][1])
        if not rec["minOk"]:
            bad_min.append(path)
        if not rec["maxOk"]:
            bad_max.append(path)
        out[path] = rec

    json.dump(out, open(f"{DUMPS}/vwa_extrema.json", "w"), indent=1)
    n = len(targets)
    print(f"anchored categories: {n}")
    print(f"cheapest exact: {n - len(bad_min)} / {n}")
    print(f"priciest exact: {n - len(bad_max)} / {n}")
    for label, bad in (("MIN", bad_min), ("MAX", bad_max)):
        for p in bad:
            r = out[p]
            print(f"  {label} cat {r['categoryId']:>4} {p}")
            k = "Min" if label == "MIN" else "Max"
            print(f"       src {r['src'+k]}   mock {r['mock'+k]}")
    # entity_ids whose absence (or presence) explains every miss
    need = set()
    for p in bad_min:
        if out[p]["srcMinId"]:
            need.add(out[p]["srcMinId"])
    for p in bad_max:
        if out[p]["srcMaxId"]:
            need.add(out[p]["srcMaxId"])
    seeded = {p["id"] for p in products}
    print("\nsource extremum ids not seeded:", sorted(need - seeded))
    print("source extremum ids seeded but not shown:", sorted(need & seeded))


if __name__ == "__main__":
    main()
