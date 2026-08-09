#!/usr/bin/env python3
"""Merge the VWA backfill into src/data/ — ADDITIVE ONLY.

The 1 105 products already in the seed keep their ids, slugs, prices, images
and array position untouched; new records are appended. The one thing this
script rewrites in place is `productDescriptions.json`, and only because every
description has to be re-cleaned through the fixed clean_desc.py so the
Brand/Manufacturer table keeps its id (see clean_desc._KEEP_IDS).

Reads the vwa_*.jsonl dumps produced by vwa_backfill.py; writes
src/data/{products,productDescriptions,productOptions,reviews}.json and
assets/dumps/vwa_media_list.txt (the media paths to pull out of the container).
"""
import json, os, glob, collections, sys

MOCK = "/webarena/CUA-Gym-Hub/websites/webarena_shopping_mock"
DUMPS = f"{MOCK}/assets/dumps"
OUT = os.environ.get("SEED_OUT") or f"{MOCK}/src/data"
sys.path.insert(0, DUMPS)
import clean_desc


def jl(path):
    """jsonl reader tolerant of rows split by a literal newline inside a value.

    mysql --raw passes a handful of embedded newlines through unescaped (10 of
    25 039 review rows), which would otherwise abort the merge on a record that
    is perfectly good.
    """
    buf = ""
    with open(path, encoding="utf8", errors="replace") as f:
        for line in f:
            line = line.rstrip("\n")
            buf = line if not buf else buf + "\\n" + line
            try:
                row = json.loads(buf)
            except json.JSONDecodeError:
                continue
            buf = ""
            yield row
    if buf:
        raise ValueError(f"{path}: unterminated record")


def jlmany(paths):
    for p in paths:
        yield from jl(p)


def num(v):
    if v is None:
        return None
    f = float(v)
    return int(f) if f == int(f) else round(f, 4)


def main():
    # Every generation of dumps, oldest first — see vwa_backfill.ROUND.
    def gens(stem, ext="jsonl"):
        return sorted(glob.glob(f"{DUMPS}/{stem}.{ext}") + glob.glob(f"{DUMPS}/{stem}.*.{ext}"))

    tier_a, tier_b = set(), set()
    # Shard V: which products ship the container's whole gallery is now a
    # SEPARATE question from which encode at 500 px. `tierA` still means both
    # (nothing about the earlier rounds changes); `fullGallery` means only the
    # first, and is what phase 2's 11 357 products carry — full gallery, tier-B
    # 320 px encoding. Older tier files have no such key, hence the `.get`.
    full_gallery = set()
    for f in gens("vwa_tiers", "json"):
        t = json.load(open(f))
        tier_a |= set(t["tierA"]); tier_b |= set(t["tierB"])
        full_gallery |= set(t.get("fullGallery") or ())
    full_gallery |= tier_a

    # ---------------- products ----------------
    products = json.load(open(f"{OUT}/products.json"))
    have = {p["id"] for p in products}
    have_key = {p["urlKey"] for p in products}

    # R5-001: keyed by value_id, not appended. `gens()` globs every generation of
    # the dump, and a shard that died mid-run and resumed wrote the *same*
    # gallery rows into two generations (vwa_gallery.4.jsonl and .5.jsonl both
    # carry product 17's two rows). A plain `append` doubled 7 965 of 10 134
    # galleries — 33 979 entries shipped where the container has 19 025 — so
    # every affected PDP rendered each photo twice and React logged a duplicate
    # key error. Dicts make a re-run idempotent; `imgs()` then de-dups by path,
    # because Magento also lists one file once per role (thumb / img / full).
    gallery = collections.defaultdict(dict)
    for g in jlmany(gens("vwa_gallery")):
        if not g["disabled"]:
            gallery[g["product_id"]][g["value_id"]] = (g["position"] or 0, g["value"])

    def imgs_for(pid):
        """Ordered, de-duplicated gallery paths for one product."""
        rows = sorted(gallery.get(pid, {}).values())
        return list(dict.fromkeys(v for _, v in rows))

    added, skipped = [], collections.Counter()
    for p in jlmany(gens("vwa_products")):
        pid = p["entity_id"]
        if pid in have:
            skipped["already seeded"] += 1
            continue
        img = p["image"]
        if not img or img == "no_selection":
            # Shipping a product whose main image does not resolve would regress
            # the mock's 100 % image-resolution rate. Drop it instead.
            skipped["no image"] += 1
            continue
        if not p["url_key"] or not p["name"]:
            skipped["no url_key/name"] += 1
            continue
        if p["url_key"] in have_key:
            # A duplicate url_key would make /<key>.html ambiguous; the already
            # seeded product wins.
            skipped["duplicate url_key"] += 1
            continue
        have_key.add(p["url_key"])

        if pid in full_gallery:
            imgs = imgs_for(pid) or [img]
        else:
            # Tier B exists to make category price-extremum and search-count
            # queries resolve against real inventory; it is browsed in grids,
            # so it ships its main image only.
            imgs = [img]
        if img not in imgs:
            imgs.insert(0, img)

        added.append({
            "id": pid, "sku": p["sku"], "typeId": p["type_id"],
            "name": p["name"], "urlKey": p["url_key"],
            "price": num(p["price"]), "specialPrice": num(p["special_price"]),
            "image": img, "smallImage": p["small_image"] or img,
            "thumbnail": p["thumbnail"] or img,
            "gallery": imgs,
            "status": p["status"], "visibility": p["visibility"],
            "qty": num(p["qty"]), "inStock": bool(p["is_in_stock"]),
            "ratingSummary": p["rating_summary"], "reviewsCount": p["reviews_count"] or 0,
            "categoryIds": [int(x) for x in (p["categories"] or "").split(",") if x],
            "createdAt": p["created_at"],
        })

    # ---------------- gallery upgrade for products already seeded ------------
    # VWAP-002: tier B shipped `gallery == [image]` because GALLERY_SQL only ran
    # over tier A, leaving 6 945 products a strict subset of the source's
    # gallery (mostly short by exactly the `.0.jpg` that VWAP-004 was also
    # missing). The loop above `continue`s on anything already seeded, so the
    # only way to repair them is here.
    #
    # Strictly additive, and it refuses to act unless it is: the new list has to
    # be a superset of the current one, and `image`/`smallImage`/`thumbnail`/
    # price/id/name are never touched. So a product whose gallery already
    # matches the source is left byte-identical, and no ordering the source
    # gave us can be lost.
    #
    # The superset guard below is a *set* comparison, so it could not see the
    # R5-001 duplication — `set(dupes) == set(clean)` — which is why 7 965 wrong
    # galleries survived a round. Dedup now happens in `imgs_for()`, upstream of
    # the guard, so the repair flows through the same additive path.
    upgraded = 0
    for p in products:
        if not gallery.get(p["id"]):
            continue
        imgs = imgs_for(p["id"])
        if p["image"] not in imgs:
            imgs.insert(0, p["image"])
        if imgs == p["gallery"] or not set(p["gallery"]).issubset(imgs):
            continue
        p["gallery"] = imgs
        upgraded += 1
    print(f"galleries upgraded on already-seeded products: {upgraded}")

    # Belt and braces for R5-001: any product whose gallery repeats a path is
    # wrong by construction — the container never lists the same file twice for
    # one product (19 025 rows, 19 025 distinct (product, path) pairs), and the
    # loop above can only reach products that appear in a vwa_gallery dump. This
    # catches the rest, and is a no-op once the pipeline is clean.
    deduped = 0
    for p in products:
        clean = list(dict.fromkeys(p["gallery"]))
        if clean != p["gallery"]:
            p["gallery"] = clean
            deduped += 1
    print(f"galleries de-duplicated (residual): {deduped}")

    added.sort(key=lambda r: r["id"])
    kept_ids = {r["id"] for r in added}
    products.extend(added)
    json.dump(products, open(f"{OUT}/products.json", "w"), separators=(",", ":"))
    print(f"products: {len(products) - len(added)} -> {len(products)} (+{len(added)})")
    for k, v in skipped.items():
        print(f"  skipped {v}: {k}")

    # ---------------- media manifest ----------------
    # Built from the WHOLE seed, not just this round's additions, and over all
    # four media fields rather than `gallery` alone.
    #
    # Both parts of that are load-bearing. Round 4 built the manifest from
    # `imgs` only, so `small_image`/`thumbnail` — which Magento stores as a
    # separate `.0.jpg` variant, not an alias of `image` — were never pulled;
    # 6 942 products then served Vite's SPA HTML fallback for the very path
    # ProductImage.jsx resolves first (VWAP-004). And because this loop skips
    # products that are already seeded, a manifest scoped to `added` can never
    # repair a past round's omission.
    #
    # Whatever is already on disk is subtracted, which both keeps the pull
    # small and stops vwa_images.py from re-encoding the original 1 105
    # products' 500 px files down to tier B.
    ondisk = f"{MOCK}/public/media/catalog/product"
    media = set()
    for p in products:
        for v in set(p["gallery"]) | {p["image"], p["smallImage"], p["thumbnail"]}:
            if v and v != "no_selection" and not os.path.exists(ondisk + v):
                media.add(v)
    open(f"{DUMPS}/vwa_media_list.txt", "w").write("\n".join(sorted(media)) + "\n")
    print(f"media files to pull: {len(media)}")

    # ---------------- descriptions ----------------
    # Re-clean the WHOLE corpus, old and new: the fix to clean_desc.py is what
    # restores <table id="productDetails_detailBullets_sections1"> and the
    # already-seeded 1 105 need it just as much as the new ones.
    desc = {}
    for src in [f"{DUMPS}/descriptions.jsonl"] + gens("vwa_desc"):
        for d in jl(src):
            if d["entity_id"] in have or d["entity_id"] in kept_ids:
                desc[str(d["entity_id"])] = clean_desc.clean(d["description"])
    json.dump(desc, open(f"{OUT}/productDescriptions.json", "w"), separators=(",", ":"))
    withtable = sum(1 for v in desc.values() if "productDetails_detailBullets_sections1" in v)
    print(f"descriptions: {len(desc)} records, {withtable} carry the detail table")

    # ---------------- product options ----------------
    opts = json.load(open(f"{OUT}/productOptions.json"))
    n_before = len(opts)
    newopts = collections.defaultdict(list)
    for o in jlmany(gens("vwa_options")):
        if o["product_id"] not in kept_ids:
            continue
        vals = sorted(o["values"] or [],
                      key=lambda v: (v["sort_order"] or 0, v["option_type_id"]))
        newopts[o["product_id"]].append({
            "optionId": o["option_id"], "title": o["title"], "type": o["type"],
            "isRequire": bool(o["is_require"]), "sortOrder": o["sort_order"],
            "values": [{"optionTypeId": v["option_type_id"], "title": v["title"],
                        "price": num(v["price"]), "priceType": v["price_type"]} for v in vals],
        })
    for k, v in newopts.items():
        opts.setdefault(str(k), sorted(v, key=lambda x: x["sortOrder"] or 0))
    json.dump(opts, open(f"{OUT}/productOptions.json", "w"), separators=(",", ":"))
    print(f"productOptions: {n_before} -> {len(opts)} products with options")

    # ---------------- reviews ----------------
    # R6-005: every approved review the container holds for a SEEDED product,
    # not just tier A's.
    #
    # The old tier-A-only rule left 2 517 products advertising a `reviewsCount`
    # larger than the number of bodies shipped, because `reviewsCount` is the
    # container's true value and the bodies behind it were dropped as a size
    # saving. The alternative fix — clamping `reviewsCount` down to the bodies
    # shipped — was rejected: it would be the seed's first deliberate
    # disagreement with the container on a product field, and it would cut the
    # products satisfying `shopping_get_num_reviews >= 12` (visualwebarena-158,
    # -165) from 1 654 to 273. Reasoning recorded in SOURCE.md.
    seeded = have | kept_ids
    reviews = json.load(open(f"{OUT}/reviews.json"))
    seen = {r["reviewId"] for r in reviews}
    n_before = len(reviews)
    for r in jlmany(gens("vwa_reviews")):
        if r["product_id"] not in seeded or r["review_id"] in seen:
            continue
        seen.add(r["review_id"])
        reviews.append({
            "reviewId": r["review_id"], "productId": r["product_id"],
            "title": r["title"], "detail": r["detail"], "nickname": r["nickname"],
            "customerId": r["customer_id"], "rating": r["rating"],
            "createdAt": r["created_at"],
        })
    reviews.sort(key=lambda r: (r["productId"], -r["reviewId"]))
    json.dump(reviews, open(f"{OUT}/reviews.json", "w"), separators=(",", ":"))
    print(f"reviews: {n_before} -> {len(reviews)}")

    for f in sorted(os.listdir(OUT)):
        print(" ", f, round(os.path.getsize(f"{OUT}/{f}") / 1024, 1), "KB")


if __name__ == "__main__":
    main()
