#!/usr/bin/env python3
"""VWA seed backfill — dump the new products out of the `shopping` container.

READ-ONLY against the source: every SQL statement is a SELECT and the only
thing that leaves the container is a tar of media files, streamed to stdout.

Inputs (entity_id lists, one per line):
    vwa_anchor_ids.txt    products an evaluator names by SKU / url_key / name
    vwa_catdepth_ids.txt  the price extremes of every anchored category
    name_coverage_ids.txt shard D's advanced-search name-coverage list
    vwa_review_ids.txt    products whose reviews an evaluator reads (optional)

Outputs into assets/dumps/:
    vwa_products.jsonl    one row per new product (same shape as products_raw.jsonl)
    vwa_gallery.jsonl     gallery rows for the new products
    vwa_desc.jsonl        descriptions, RAW (the Brand/Manufacturer table intact)
    vwa_options.jsonl     custom options for the new products
    vwa_reviews.jsonl     approved reviews for the new products
    vwa_media_list.txt    media paths to pull out of the container

Tiering: only TIER-A products (anchored / review-anchored) carry a description
and their full gallery. TIER-B products (category depth, name coverage) exist so
that price-extremum and search-count queries resolve against real inventory;
they ship their main image only and no description. This is a sampling
decision, recorded in DEV.part-F.md — nothing is invented either way.
"""
import json, os, re, subprocess, sys

MOCK = "/webarena/CUA-Gym-Hub/websites/webarena_shopping_mock"
DUMPS = f"{MOCK}/assets/dumps"
# Each invocation writes its own generation of dumps (vwa_products.jsonl,
# vwa_products.2.jsonl, ...). vwa_merge.py globs them all, so a follow-up round
# that backfills a handful of newly-found ids cannot silently drop the
# descriptions and galleries the previous round pulled.
ROUND = os.environ.get("VWA_ROUND", "")
SUF = f".{ROUND}" if ROUND else ""

MYSQL = ["docker", "exec", "shopping", "mysql", "-umagentouser", "-pMyPassword",
         "magentodb", "-N", "--raw", "-B", "-e"]
_LITERAL = re.compile(r"'(?:\\.|[^'\\])*'", re.S)


def q(sql):
    bare = _LITERAL.sub("''", sql)
    assert bare.lstrip().upper().startswith("SELECT"), "not a SELECT"
    assert not re.search(r'\b(update|insert|delete|drop|alter|create|truncate|replace)\b',
                         bare, re.I), "refusing to run a mutating statement"
    r = subprocess.run(MYSQL + [sql], capture_output=True, text=True, errors="replace")
    if r.returncode:
        sys.exit("mysql failed: " + r.stderr[:2000])
    return r.stdout


def jrows(sql, chunk_ids, out):
    """Run a JSON_OBJECT SELECT over id chunks, appending raw JSON lines."""
    n = 0
    for i in range(0, len(chunk_ids), 2000):
        ids = ",".join(str(x) for x in chunk_ids[i:i + 2000])
        # R7-003: `.split("\n")`, NOT `.splitlines()`. splitlines() also breaks
        # on U+0085 NEL and U+2028 LINE SEPARATOR, which do occur inside review
        # bodies. Splitting there produced an unparseable half-record, which
        # jl()'s continuation path then rejoined with a literal "\n" -- so the
        # shipped review was the same length as the container's with one
        # character silently substituted. Five fields shipped that way.
        for ln in q(sql.replace("__IDS__", ids)).split("\n"):
            ln = ln.strip()
            if ln and ln != "NULL":
                # `--raw` is required: JSON_OBJECT already emits valid JSON text
                # (control chars escaped), and mysql's default batch escaping
                # would double the backslashes and break json.loads.
                out.write(ln + "\n")
                n += 1
    return n


def ids_from(name):
    """Union of an id list and every generation of it.

    `vwa_anchor_ids.txt` + `vwa_anchor_ids.*.txt`, matching the dump-generation
    convention above: a later round that finds a handful of new ids drops them
    in its own file instead of rewriting an earlier round's list, so no id can
    be silently lost by an edit. Already-seeded ids are subtracted in main(),
    which makes re-reading old generations a no-op.
    """
    import glob
    stem, ext = name.rsplit(".", 1)
    ids = set()
    for p in sorted(glob.glob(f"{DUMPS}/{stem}.{ext}") + glob.glob(f"{DUMPS}/{stem}.*.{ext}")):
        ids |= {int(x) for x in open(p) if x.strip()}
    return ids


# Shard V: two scope fixes, both measured against the container before the edit.
#
# 1. `name`/`status`/`visibility` now read COALESCE(store 1, store 0). 7 841
#    products carry a store-1 row for each of these three, which is the trap the
#    round-12 audit recorded. Measured here: 0 of those 7 841 hold a value that
#    DIFFERS from store 0 (`NOT (a.value <=> b.value)` -> 0 for all three
#    attributes), so this changes no byte today — it is the query being correct
#    rather than lucky. `url_key`, `image`, `small_image`, `thumbnail`, `price`
#    and `special_price` have 0 store-1 rows at all, so they stay at store 0.
#
# 2. `categories` now comes from Magento's own rollup,
#    `catalog_category_product_index_store1` at `store_id=1, visibility IN (2,4)`,
#    which is what the mock's `descendantIds()` filter is derived against.
#    Measured: this container's `catalog_category_product` and
#    `catalog_category_product_index_store1` are the SAME 410 544 rows
#    (0 only-in-ccp, 0 only-in-index), and all 410 544 index rows already carry
#    `visibility IN (2,4)`, so the filter is a no-op. The already-seeded 11 358
#    products therefore keep identical `categoryIds` under either table — there
#    is no old-vs-new inconsistency to reconcile.
PRODUCT_SQL = """SELECT JSON_OBJECT(
 'entity_id', e.entity_id, 'sku', e.sku, 'type_id', e.type_id,
 'created_at', e.created_at, 'updated_at', e.updated_at,
 'has_options', e.has_options, 'required_options', e.required_options,
 'name', (SELECT COALESCE(MAX(CASE WHEN store_id=1 THEN value END), MAX(CASE WHEN store_id=0 THEN value END)) FROM catalog_product_entity_varchar WHERE entity_id=e.entity_id AND attribute_id=73 AND store_id IN (0,1)),
 'url_key', (SELECT value FROM catalog_product_entity_varchar WHERE entity_id=e.entity_id AND attribute_id=121 AND store_id=0),
 'image', (SELECT value FROM catalog_product_entity_varchar WHERE entity_id=e.entity_id AND attribute_id=87 AND store_id=0),
 'small_image', (SELECT value FROM catalog_product_entity_varchar WHERE entity_id=e.entity_id AND attribute_id=88 AND store_id=0),
 'thumbnail', (SELECT value FROM catalog_product_entity_varchar WHERE entity_id=e.entity_id AND attribute_id=89 AND store_id=0),
 'price', (SELECT value FROM catalog_product_entity_decimal WHERE entity_id=e.entity_id AND attribute_id=77 AND store_id=0),
 'special_price', (SELECT value FROM catalog_product_entity_decimal WHERE entity_id=e.entity_id AND attribute_id=78 AND store_id=0),
 'weight', (SELECT value FROM catalog_product_entity_decimal WHERE entity_id=e.entity_id AND attribute_id=82 AND store_id=0),
 'status', (SELECT COALESCE(MAX(CASE WHEN store_id=1 THEN value END), MAX(CASE WHEN store_id=0 THEN value END)) FROM catalog_product_entity_int WHERE entity_id=e.entity_id AND attribute_id=97 AND store_id IN (0,1)),
 'visibility', (SELECT COALESCE(MAX(CASE WHEN store_id=1 THEN value END), MAX(CASE WHEN store_id=0 THEN value END)) FROM catalog_product_entity_int WHERE entity_id=e.entity_id AND attribute_id=99 AND store_id IN (0,1)),
 'qty', (SELECT qty FROM cataloginventory_stock_item WHERE product_id=e.entity_id LIMIT 1),
 'is_in_stock', (SELECT is_in_stock FROM cataloginventory_stock_item WHERE product_id=e.entity_id LIMIT 1),
 'rating_summary', (SELECT rating_summary FROM review_entity_summary WHERE entity_pk_value=e.entity_id AND entity_type=1 AND store_id=1 LIMIT 1),
 'reviews_count', (SELECT reviews_count FROM review_entity_summary WHERE entity_pk_value=e.entity_id AND entity_type=1 AND store_id=1 LIMIT 1),
 'categories', (SELECT GROUP_CONCAT(category_id) FROM catalog_category_product_index_store1 WHERE product_id=e.entity_id AND store_id=1 AND visibility IN (2,4))
) FROM catalog_product_entity e WHERE e.entity_id IN (__IDS__);"""

GALLERY_SQL = """SELECT JSON_OBJECT(
 'product_id', g.entity_id, 'value_id', g.value_id, 'value', mg.value,
 'position', g.position, 'disabled', g.disabled
) FROM catalog_product_entity_media_gallery_value g
JOIN catalog_product_entity_media_gallery mg ON mg.value_id=g.value_id
WHERE g.entity_id IN (__IDS__) AND g.store_id=0;"""

# store_id=1, NOT 0. The default-scope row holds Magento's stock string
# "This is the description placeholder for the product" for all 104 368
# products; the real Amazon-scraped description — including the
# <table id="productDetails_detailBullets_sections1"> the Brand/Manufacturer
# evaluators read — lives only at the store view. dump_desc.sql agrees.
DESC_SQL = """SELECT JSON_OBJECT(
 'entity_id', t.entity_id, 'description', t.value
) FROM catalog_product_entity_text t
WHERE t.attribute_id=75 AND t.store_id=1 AND t.entity_id IN (__IDS__);"""

OPTIONS_SQL = """SELECT JSON_OBJECT(
 'product_id', o.product_id, 'option_id', o.option_id, 'type', o.type,
 'is_require', o.is_require, 'sort_order', o.sort_order,
 'title', (SELECT title FROM catalog_product_option_title WHERE option_id=o.option_id AND store_id=0 LIMIT 1),
 'values', (SELECT JSON_ARRAYAGG(JSON_OBJECT(
     'option_type_id', v.option_type_id, 'sort_order', v.sort_order,
     'title', (SELECT title FROM catalog_product_option_type_title WHERE option_type_id=v.option_type_id AND store_id=0 LIMIT 1),
     'price', (SELECT price FROM catalog_product_option_type_price WHERE option_type_id=v.option_type_id AND store_id=0 LIMIT 1),
     'price_type', (SELECT price_type FROM catalog_product_option_type_price WHERE option_type_id=v.option_type_id AND store_id=0 LIMIT 1)))
   FROM catalog_product_option_type_value v WHERE v.option_id=o.option_id)
) FROM catalog_product_option o WHERE o.product_id IN (__IDS__);"""

REVIEWS_SQL = """SELECT JSON_OBJECT(
 'review_id', r.review_id, 'product_id', r.entity_pk_value, 'created_at', r.created_at,
 'title', d.title, 'detail', d.detail, 'nickname', d.nickname, 'customer_id', d.customer_id,
 'rating', (SELECT ROUND(AVG(ov.value)) FROM rating_option_vote ov WHERE ov.review_id=r.review_id)
) FROM review r JOIN review_detail d ON d.review_id=r.review_id
WHERE r.status_id=1 AND r.entity_id=1 AND r.entity_pk_value IN (__IDS__);"""


def repair():
    """R6-001 + R6-002: pull gallery and description for an EXPLICIT id list.

    `tierb_upgrade()` recomputes its whole target set from
    `have - tier_a - original`, so a follow-up round that only needs to repair
    the handful of products the previous round missed would re-dump all ~8 000
    tier-B products — 30 MB of description text that is already on disk and
    already merged. Worse, it is the mode that has to be re-run every time new
    tier-B products are added, and forgetting it is exactly what produced
    R6-001 and R6-002.

    This mode takes the ids from `VWA_REPAIR_IDS` (a file, one id per line) and
    dumps only those. Derive that file the way the audit measured the gap:
    seeded ids with no key in productDescriptions.json, union seeded ids that
    appear in no generation of vwa_gallery.*.jsonl. Both are set operations
    over the shipped seed, so the list cannot drift from what is actually
    missing.

    Products, options and reviews are NOT re-dumped: the merge only ever
    skipped gallery and description for these ids, and re-merging the rest
    would be a no-op at best.
    """
    todo = sorted({int(x) for x in open(os.environ["VWA_REPAIR_IDS"]) if x.strip()})
    # Which datasets to pull. Defaults to the R6-001/R6-002 pair; R6-005 runs the
    # same mechanism over the whole seed with parts=reviews, and re-dumping 30 MB
    # of descriptions it already has would be pure waste.
    parts = (os.environ.get("VWA_REPAIR_PARTS") or "gallery,desc").split(",")
    print(f"repair: {len(todo)} products, parts={parts}")
    if "gallery" in parts:
        with open(f"{DUMPS}/vwa_gallery{SUF}.jsonl", "w") as f:
            print("gallery rows:", jrows(GALLERY_SQL, todo, f))
    if "desc" in parts:
        with open(f"{DUMPS}/vwa_desc{SUF}.jsonl", "w") as f:
            print("description rows:", jrows(DESC_SQL, todo, f))
    if "reviews" in parts:
        with open(f"{DUMPS}/vwa_reviews{SUF}.jsonl", "w") as f:
            print("review rows:", jrows(REVIEWS_SQL, todo, f))
    # No new products this pass. These ids keep whatever tier they were
    # originally assigned, so DO NOT write a vwa_tiers generation here — the
    # tier files are what vwa_images.py reads to pick an encoding, and listing
    # them as tier B a second time is harmless only by luck. All 74 short
    # galleries reference files that are already on disk (checked before the
    # run), so this repair pulls no media at all.


def tierb_upgrade():
    """VWAP-002 + VWAP-003: pull gallery and description for products ALREADY seeded.

    The normal path dumps `GALLERY_SQL`/`DESC_SQL` for tier A only, so the 7 965
    tier-B products that shipped in earlier rounds have a one-image gallery and
    no description at all. They are already in products.json, so main()'s
    `- have` subtraction skips them forever. This mode targets exactly them:
    every seeded id that no generation of vwa_tiers*.json lists as tier A and
    that is not one of the original 1 105 (those came from build_seed.py with
    their full gallery and description already).

    Products, options and reviews are NOT re-dumped — those are complete for
    tier B and re-merging them would be a no-op at best.
    """
    import glob
    have = {p["id"] for p in json.load(open(f"{MOCK}/src/data/products.json"))}
    tier_a = set()
    for f in sorted(glob.glob(f"{DUMPS}/vwa_tiers.json") + glob.glob(f"{DUMPS}/vwa_tiers.*.json")):
        tier_a |= set(json.load(open(f))["tierA"])
    original = {int(json.loads(l)["entity_id"]) for l in open(f"{DUMPS}/products_raw.jsonl") if l.strip()}
    todo = sorted(have - tier_a - original)
    print(f"tier-B products to upgrade (gallery + description): {len(todo)}")
    with open(f"{DUMPS}/vwa_gallery{SUF}.jsonl", "w") as f:
        print("gallery rows:", jrows(GALLERY_SQL, todo, f))
    with open(f"{DUMPS}/vwa_desc{SUF}.jsonl", "w") as f:
        print("description rows:", jrows(DESC_SQL, todo, f))
    # No new products this pass; keep the tier file shaped so vwa_images.py's
    # glob still parses it, and leave these ids in tier B so their newly-pulled
    # gallery files encode at 320px like the rest of their set.
    json.dump({"tierA": [], "tierB": todo}, open(f"{DUMPS}/vwa_tiers{SUF}.json", "w"))


def bulk():
    """Shard V phase 2: dump an explicit id list COMPLETE — gallery and
    description included.

    The tier-A / tier-B split exists to keep media affordable, and it does its
    job: tier B encodes at 320 px instead of 500. But `main()` also uses that
    same flag to decide whether to dump `GALLERY_SQL` and `DESC_SQL` at all,
    which is a different question, and answering both with one bit is what left
    7 965 products with a one-image gallery and no description for two rounds
    (VWAP-002, VWAP-003) and then needed `tierb_upgrade()` to walk it back.

    So this mode separates them. Everything it selects is dumped complete, and
    the tier file it writes says `tierA: []` — so `vwa_images.py` still encodes
    all of it at tier B's 320 px — plus a third key, `fullGallery`, which is
    the only thing `vwa_merge.py` consults when deciding between the container's
    gallery and `[image]`.

    Read the ids from VWA_BULK_IDS (one entity_id per line); already-seeded ids
    are subtracted, so re-running is a no-op.
    """
    have = {p["id"] for p in json.load(open(f"{MOCK}/src/data/products.json"))}
    todo = sorted({int(x) for x in open(os.environ["VWA_BULK_IDS"]) if x.strip()} - have)
    print(f"bulk: {len(todo)} new products (complete: gallery + description)")
    for name, sql in (("products", PRODUCT_SQL), ("gallery", GALLERY_SQL),
                      ("options", OPTIONS_SQL), ("reviews", REVIEWS_SQL),
                      ("desc", DESC_SQL)):
        with open(f"{DUMPS}/vwa_{name}{SUF}.jsonl", "w") as f:
            print(f"  {name} rows:", jrows(sql, todo, f), flush=True)
    json.dump({"tierA": [], "tierB": todo, "fullGallery": todo},
              open(f"{DUMPS}/vwa_tiers{SUF}.json", "w"))


def main():
    if os.environ.get("VWA_BULK_IDS"):
        return bulk()
    if os.environ.get("VWA_REPAIR_IDS"):
        return repair()
    if os.environ.get("VWA_TIERB_UPGRADE"):
        return tierb_upgrade()
    have = {p["id"] for p in json.load(open(f"{MOCK}/src/data/products.json"))}
    tier_a = (ids_from("vwa_anchor_ids.txt") | ids_from("vwa_review_ids.txt")) - have
    tier_b = (ids_from("vwa_catdepth_ids.txt") | ids_from("name_coverage_ids.txt")) - have - tier_a
    new = sorted(tier_a | tier_b)
    print(f"tier A (full: gallery + description) : {len(tier_a)}")
    print(f"tier B (main image, no description)  : {len(tier_b)}")
    print(f"new products total                   : {len(new)}")

    with open(f"{DUMPS}/vwa_products{SUF}.jsonl", "w") as f:
        print("products rows:", jrows(PRODUCT_SQL, new, f))
    with open(f"{DUMPS}/vwa_gallery{SUF}.jsonl", "w") as f:
        print("gallery rows:", jrows(GALLERY_SQL, sorted(tier_a), f))
    with open(f"{DUMPS}/vwa_options{SUF}.jsonl", "w") as f:
        print("option rows:", jrows(OPTIONS_SQL, new, f))
    with open(f"{DUMPS}/vwa_reviews{SUF}.jsonl", "w") as f:
        print("review rows:", jrows(REVIEWS_SQL, new, f))
    with open(f"{DUMPS}/vwa_desc{SUF}.jsonl", "w") as f:
        print("description rows:", jrows(DESC_SQL, sorted(tier_a), f))

    json.dump({"tierA": sorted(tier_a), "tierB": sorted(tier_b)},
              open(f"{DUMPS}/vwa_tiers{SUF}.json", "w"))


if __name__ == "__main__":
    main()
