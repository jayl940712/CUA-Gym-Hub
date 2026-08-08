#!/usr/bin/env python3
"""Curate assets/dumps/*.jsonl into the mock's src/data/ seed.

Tier 1 (static reference, never in session state):
    src/data/catalog/cat-<2..24>.json    per-category item metadata + 250-char excerpt
    src/data/descriptions/desc-<N>.json  full descriptions, sharded by floor(id/1000)
    src/data/{categories,regions,cities,currencies,locale,pages}.json
Tier 2 (session state seed, loaded by createInitialData()):
    src/data/session_seed.json

See DESIGN.md §8 for why the split exists.
"""
import json, os, re, collections

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DUMPS = os.path.join(ROOT, "assets", "dumps")
DATA = os.path.join(ROOT, "src", "data")

# Field order for a catalogue tuple. Keep in sync with assets/data_model.md.
CATALOG_FIELDS = ["id", "cat", "price", "pub", "title", "name", "email", "city",
                  "regionIdx", "cityId", "phone", "showEmail", "showPhone",
                  "imgExt", "excerpt"]


def load(name):
    with open(os.path.join(DUMPS, name)) as f:
        return [json.loads(l) for l in f if l.strip()]


def write(rel, obj):
    path = os.path.join(DATA, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as f:
        json.dump(obj, f, separators=(",", ":"), ensure_ascii=False)
    return os.path.getsize(path)


def dt(v):
    """MySQL JSON_OBJECT renders DATETIME with a .000000 tail; the site never shows it."""
    return v.replace(".000000", "") if isinstance(v, str) else v


def excerpt(text, n=250):
    """Mirror osc_highlight(): strip tags, collapse whitespace, cut at n, append '...'."""
    t = re.sub(r"<[^>]*>", "", text or "")
    t = re.sub(r"[\n\r\t]", " ", t)
    t = re.sub(r"\s+", " ", t).strip()
    return t[:n] + "..." if len(t) > n else t


def main():
    items = load("items.jsonl")
    descs = {d["id"]: d["desc"] for d in load("item_descriptions.jsonl")}
    cats = load("categories.jsonl")
    regions = load("regions.jsonl")

    # ---- reference tables ---------------------------------------------------
    total = 0
    total += write("categories.json", [
        {"id": c["id"], "name": c["name"], "slug": c["slug"], "pos": c["pos"],
         "enabled": c["enabled"], "priceEnabled": c["price_enabled"]}
        for c in sorted(cats, key=lambda c: c["pos"])])

    region_order = sorted(regions, key=lambda r: r["name"])
    ridx = {r["id"]: i for i, r in enumerate(region_order)}
    total += write("regions.json", [
        {"id": r["id"], "name": r["name"], "slug": r["slug"], "country": r["country"]}
        for r in region_order])

    total += write("cities.json", [
        {"id": c["id"], "regionId": c["region_id"], "name": c["name"], "slug": c["slug"]}
        for c in load("cities.jsonl")])

    total += write("currencies.json", load("currencies.jsonl"))
    total += write("locale.json", load("locale.jsonl")[0])
    total += write("countries.json", load("countries.jsonl"))
    total += write("pages.json", load("pages.jsonl"))
    print("reference tables: %.2f MB" % (total / 1e6))

    # ---- catalogue, sharded by category ------------------------------------
    # Pre-sorted three ways so the client never re-derives an ordering.
    bycat = collections.defaultdict(list)
    for it in items:
        bycat[it["cat"]].append([
            it["id"], it["cat"], it["price"], it["pub"], it["title"],
            it["name"], it["email"], it["city"], ridx.get(it["region_id"], -1),
            it["city_id"], it["phone"] or "", it["show_email"], it["show_phone"],
            0 if it["img_ext"] == "png" else 1, excerpt(descs.get(it["id"], ""))])

    # Orderings are CAPTURED FROM THE SOURCE, not re-derived. Osclass sorts with no
    # tie-break and many items share a price, so deriving "price then id" puts different
    # items on deep pages than the source does — and ~12 tasks assert on "the item on
    # this page" at depths up to iPage=331. See assets/dump-orderings.py.
    with open(os.path.join(DUMPS, "orderings.json")) as f:
        orderings = json.load(f)

    I_ID = 0
    cat_total = 0
    manifest = {}
    for cat in sorted(bycat):
        order = orderings["byCategory"][str(cat)]
        rows = {r[I_ID]: r for r in bycat[cat]}
        # An order array is the literal page-by-page capture, so it may repeat an id and
        # omit another -- LIMIT/OFFSET over a sort with no tie-break really does that on
        # the source. It must never contain an id outside the category, though.
        for key, seq in order.items():
            stray = set(seq) - set(rows)
            if stray:
                raise SystemExit("cat %d/%s: %d ids not in this category" % (cat, key, len(stray)))
        seen, ordered = set(), []
        for i in order["newest"]:                 # source default order first
            if i not in seen:
                seen.add(i); ordered.append(rows[i])
        for i in sorted(set(rows) - seen):        # then anything paging skipped
            ordered.append(rows[i])
        sz = write("catalog/cat-%d.json" % cat,
                   {"cat": cat, "fields": CATALOG_FIELDS, "count": len(ordered),
                    "items": ordered, "order": order})
        manifest[cat] = {"count": len(ordered), "bytes": sz}
        cat_total += sz

    write("catalog/global-order.json", orderings["global"])
    print("catalog shards: %d files, %.2f MB (max %.2f MB)"
          % (len(manifest), cat_total / 1e6,
             max(m["bytes"] for m in manifest.values()) / 1e6))

    # ---- descriptions, sharded by floor(id/1000) ---------------------------
    shards = collections.defaultdict(dict)
    for iid, text in descs.items():
        shards[iid // 1000][str(iid)] = text
    d_total = 0
    d_max = 0
    for s in sorted(shards):
        sz = write("descriptions/desc-%d.json" % s, shards[s])
        d_total += sz
        d_max = max(d_max, sz)
    print("description shards: %d files, %.2f MB (max %.2f MB)"
          % (len(shards), d_total / 1e6, d_max / 1e6))

    # ---- global manifest ----------------------------------------------------
    write("catalog/manifest.json", {
        "totalItems": sum(m["count"] for m in manifest.values()),
        "pageSize": 12,
        "categories": manifest,
        "descriptionShards": sorted(shards),
        "descriptionShardSize": 1000,
        "sorts": ["newest", "priceAsc", "priceDesc"],
        "globalOrderFile": "catalog/global-order.json",
    })

    # ---- session-state seed -------------------------------------------------
    user = load("users.jsonl")[0]
    comments = load("comments.jsonl")
    mine = sorted(it["id"] for it in items if it["user_id"] == user["id"])
    write("session_seed.json", {
        "user": {
            "id": user["id"], "name": user["name"], "username": user["username"],
            "email": user["email"], "regDate": dt(user["reg_date"]),
            "phoneLand": user["phone_land"], "phoneMobile": user["phone_mobile"],
            "website": user["website"], "country": user["country"],
            "region": user["region"], "city": user["city"], "address": user["address"],
            "zip": user["zip"], "isCompany": user["company"],
            "nItems": user["n_items"], "nComments": user["n_comments"],
            "profileImg": user["profile_img"],
        },
        "comments": [{
            "id": c["id"], "itemId": c["item_id"], "pubDate": dt(c["pub_date"]),
            "title": c["title"], "authorName": c["author_name"],
            "authorEmail": c["author_email"], "body": c["body"], "rating": c["rating"],
            "userId": c["user_id"], "replyId": c["reply_id"],
        } for c in comments],
        "myItems": mine,
        "itemOverrides": {},
        "deletedItemIds": [],
        "newItems": [],
        "nextItemId": 84155,
        "nextCommentId": max([c["id"] for c in comments] or [0]) + 1,
        "contactMessages": [],
        "sendFriendMessages": [],
        "alerts": [],
        "marks": [],
    })
    print("session seed: user=%s, myItems=%s, nextItemId=84155"
          % (user["name"], mine))


if __name__ == "__main__":
    main()
